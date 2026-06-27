# ITR Credentials Generation Automation

A full-stack system that automates Income Tax e-filing portal credential generation, streams every step as live events, and surfaces every run on an operations dashboard.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20.9 |
| MongoDB | ≥ 6 (local or Atlas) |
| Playwright Chromium | `npx playwright install chromium` |

---

## Environment variables

Edit `.env` at the repo root:

```
MONGODB_URI=mongodb://localhost:27017/itr-automation
PORT=5000
API_TOKEN=change-me-before-production
WEBHOOK_SECRET=change-me-webhook-secret
EVENT_URL=http://localhost:5000/webhook
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
NEXT_PUBLIC_API_TOKEN=change-me-before-production
```

**Never commit real PAN values or credentials.**

---

## Running locally

### Terminal 1 — Backend service

```bash
cd services
npm install
npm run dev
# Listens on http://localhost:5000
```

### Terminal 2 — Frontend

```bash
# from repo root
npm install
npx playwright install chromium   # first time only
npm run dev
# Listens on http://localhost:3000
```

### Trigger a run

1. Open `http://localhost:3000`
2. Enter a PAN (e.g. `ABCDE1234F`) and click **Start run**
3. A Playwright browser opens (headed) and navigates the IT portal
4. Pass the CAPTCHA manually in the browser inspector
5. The dashboard shows an OTP input — enter the OTP
6. The bot sets the password and emits `SUCCESS`

---

## API reference

All mutating routes require `Authorization: Bearer <API_TOKEN>`. The webhook route requires `Authorization: Bearer <WEBHOOK_SECRET>`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | none | Health check |
| `POST` | `/jobs` | bearer | Start a run — body: `{ pan }` |
| `GET` | `/jobs` | bearer | List all runs — query: `?status=&phase=` |
| `GET` | `/jobs/:id` | bearer | Single run detail |
| `POST` | `/jobs/:id/otp` | bearer | Supply OTP — body: `{ otp }` |
| `POST` | `/jobs/:id/cancel` | bearer | Cancel a running/waiting job |
| `GET` | `/metrics` | none | Aggregate metrics |
| `GET` | `/stream/:id` | none | SSE — per-job live events (supports `Last-Event-ID`) |
| `GET` | `/stream` | none | SSE — global admin stream |
| `POST` | `/webhook` | webhook secret | Bot → server event ingest |

---

## Project layout

```
automation/           Playwright bot + webhook client
  bot.js              State machine (OPENING_PORTAL → … → SUCCESS/FAILED)
  webhookClient.js    Authenticated POST with exponential-backoff retry

services/
  src/
    routes/           Express route handlers (transport layer only)
    lib/db.js         Mongoose connect / close
    lib/otpStore.js   In-process OTP resolver (Promise-based pause/resume)
    middleware/auth.js Bearer + webhook-secret middleware
  Models/             Mongoose schemas (Job, Event)
  sse/sseManager.js   Per-job + global SSE fan-out

app/                  Next.js 15 frontend
  page.tsx            Admin dashboard — live-updating table + metrics strip
  runs/[id]/page.tsx  Live console — phase stepper, OTP input, event log
  components/
    StartRunForm.tsx
```
