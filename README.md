# Architecture

## Goals

Build a resilient automation platform where:

* automation runs independently
* events are durable
* operators can observe progress in real time
* reconnects never lose history

---

# System Design

```txt
Operator UI
     │
     │ SSE
     ▼

Next.js Dashboard
     │
     ▼

Node Service
├── Job Orchestrator
├── Event Store
├── Replay Engine
├── Metrics
└── OTP Gateway

     ▲
Webhook

Playwright Automation
     │
     ▼

Income Tax Portal
```

---

# State Machine

```txt
CREATED
↓

STARTING

↓

OPEN_PORTAL

↓

ENTER_PAN

↓

WAIT_CAPTCHA

↓

REQUEST_OTP

↓

WAIT_OTP

↓

VERIFY_OTP

↓

GENERATE_PASSWORD

↓

SAVE_RESULT

↓

SUCCESS
```

Failure:

```txt
FAILED
CANCELLED
TIMEOUT
```

State transitions are explicit and validated.

---

# Event Model

```ts
type JobEvent = {
 id:string
 jobId:string
 seq:number
 timestamp:string

 level:
 | "info"
 | "warn"
 | "error"

 phase:string
 step:string
 message:string

 replayable:boolean
}
```

Rules:

* append only
* ordered by seq
* secrets masked
* immutable

---

# Live Streaming

Flow:

```txt
Automation
↓

Webhook POST

↓

Persist Mongo

↓

Ring Buffer

↓

SSE Clients
```

Replay:

```txt
Client reconnect
↓

Last-Event-ID

↓

Load missed events

↓

Resume stream
```

Guarantees:

* no gaps
* no duplicates
* bounded memory

---

# Persistence

## jobs

```js
{
 jobId,
 maskedPan,
 phase,
 outcome,
 startedAt,
 updatedAt,
 duration,
 credentialsEncrypted
}
```

Indexes:

```txt
phase + updatedAt
outcome + updatedAt
jobId
```

---

## events

Separate collection.

Reason:

* event volume is high
* replay becomes cheap
* avoids document growth

Schema:

```js
{
 jobId,
 seq,
 level,
 phase,
 timestamp
}
```

Indexes:

```txt
jobId + seq
jobId + timestamp
```

---

# Service Layers

```txt
Routes
↓

Controllers
↓

Domain Services
↓

Repositories
↓

Mongo
```

Automation isolated.

No business logic in controllers.

---

# Reliability

* retries for webhook
* graceful shutdown
* browser cleanup
* SSE reconnect
* fail isolated jobs

---

# Tradeoffs

SSE chosen because:

* simpler than WebSockets
* native browser support
* ordered delivery

Separate event collection chosen because:

* replay performance
* append efficiency
* dashboard scalability

---

# Future Improvements

* concurrent runs
* distributed queue
* resume after restart
* websocket adapter
* stale-run sweeper
