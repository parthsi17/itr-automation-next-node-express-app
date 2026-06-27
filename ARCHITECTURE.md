# Architecture

## State machine

The bot models a run as an explicit finite state machine. Each state handler returns the next state; the runner loops until a terminal state is reached.

```
OPENING_PORTAL
    │
    ▼
ENTERING_PAN
    │
    ▼
SOLVING_CAPTCHA ──(retry up to 3)──┐
    │                               │
    ▼ (captcha ok)                  │
WAITING_OTP  ◄──(wrong OTP, retry)─┘
    │
    ▼
ENTERING_OTP
    │
    ▼
SETTING_PASSWORD
    │
    ▼
SUCCESS  /  FAILED  /  CANCELLED
```

**Design call:** states are explicit string constants, not numeric enums, so they map directly to the `phase` field in the DB and appear readable in the event log without a lookup table.

---

## Event schema

```json
{
  "jobId":   "uuid-v4",
  "seq":     1,
  "phase":   "WAITING_OTP",
  "level":   "WARN",
  "message": "OTP dispatched — waiting for operator",
  "requestId": "uuid-v4",
  "createdAt": "ISO-8601"
}
```

`seq` is a monotonically increasing integer per run. It is the `id` in the SSE stream, which lets the browser send `Last-Event-ID` on reconnect and the server query `{ jobId, seq: { $gt: lastSeq } }` — no missed events, no duplicates.

Secrets (PAN, OTP, password) are masked at the webhook client layer before any event crosses the wire. The raw password is only stored in MongoDB on the `Job.result` sub-document (never in the `events` collection).

---

## Live streaming + replay

```
Bot ──POST /webhook──► Server ──► MongoDB (durable log)
                          │
                          └──► SSE fan-out (in-memory, per-job + global)
                                    │
                                    ▼
                               Browser (EventSource)
```

- **Bot → server:** authenticated `POST /webhook` per event, exponential-backoff retry (up to 5 attempts) so no event is lost.
- **Server → browser:** pure SSE. Each event is written with `id:<seq>`. The browser's `EventSource` sends `Last-Event-ID` automatically on reconnect; the server replays from MongoDB for that `seq` forward.
- **Global channel:** `GET /stream` (no jobId) fans out all events to the admin dashboard so the table live-updates without polling.
- **Bounded memory:** the `sseManager` holds only live `res` connections (a `Map<jobId, Set<res>>`). Replay always comes from MongoDB — never from an unbounded in-memory array.

---

## MongoDB modelling

### Collections

**`jobs`** — one document per run.

```js
{
  jobId, panMasked, phase, status,
  startedAt, endedAt, durationMs,
  result: { userId, password },   // only on SUCCESS
  createdAt, updatedAt
}
```

**`events`** — one document per emitted event.

```js
{ jobId, seq, phase, level, message, createdAt }
```

### Embedding vs separate collection

Events are in a **separate collection** rather than embedded in the job document because:
- A single run can emit 10–50 events; embedding them would make every job-list query load the full event array.
- The event firehose is append-only; separate documents allow efficient `insertOne` without rewriting the parent.
- Replay queries (`find({ jobId, seq: { $gt: N } })`) hit the `{ jobId: 1, seq: 1 }` compound index and never scan.

### Indexes

| Collection | Index | Purpose |
|------------|-------|---------|
| `jobs` | `{ jobId: 1 }` unique | Single-job lookup |
| `jobs` | `{ status: 1, updatedAt: -1 }` | Admin list filter + sort |
| `jobs` | `{ phase: 1, updatedAt: -1 }` | Phase filter |
| `events` | `{ jobId: 1, seq: 1 }` unique | Replay + dedup |

### Access patterns

- **Admin list:** `find(filter, projection)` — projection excludes `result` so credentials never travel to the list view.
- **Event replay:** range query `{ jobId, seq: { $gt: lastSeq } }` — cursor-based, no `skip`.
- **Metrics p50/p99:** `find({ durationMs: { $exists: true } }, { durationMs: 1 }).sort({ durationMs: 1 })` — sorted cursor, percentile computed in JS.

---

## OTP pause/resume

The bot calls `waitForOtp(jobId)` which returns a `Promise`. The resolver is stored in a `Map<jobId, Function>`. When the operator POSTs `/jobs/:id/otp`, the server calls `resolveOtp(jobId, otp)` which looks up and calls the resolver — the bot's `await` unblocks and continues.

The same mechanism handles cancellation: `resolveOtp(jobId, "__cancel__")` unblocks the bot which then transitions to `CANCELLED`.

A 5-minute timeout auto-rejects stale waits so the process never leaks.

---

## Trade-offs & decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| SSE vs WebSocket | SSE | Unidirectional (server → browser) is sufficient; SSE is simpler, HTTP/2-compatible, and has built-in reconnect |
| Separate events collection | Yes | Avoids unbounded document growth; replay queries are cheap with the compound index |
| OTP store location | In-process Map | Bot and server run in the same Node process; a shared Map is the simplest correct design. For multi-process deployments this would move to Redis |
| CAPTCHA handling | `page.pause()` (human-in-the-loop) | No CAPTCHA-solving API is wired up; the Playwright Inspector lets a human solve it in the headed browser |
| Password storage | Plaintext in MongoDB result field | For this assignment credentials are stored as-is. Production would encrypt with a KMS-managed key before writing |
