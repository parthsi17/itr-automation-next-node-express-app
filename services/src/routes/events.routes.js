import express from "express";
import Event from "../../Models/Event.js";
import Job from "../../Models/Job.js";
import { publish, subscribe, subscribeGlobal } from "../../sse/sseManager.js";
import { requireWebhookSecret } from "../middleware/auth.js";

const router = express.Router();

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

// Bot → server: authenticated event ingest
router.post("/webhook", requireWebhookSecret, async (req, res) => {
  const requestId = req.headers["x-request-id"] ?? null;

  const event = await Event.create(req.body);

  // Update job phase / status / timing
  const updates = { phase: event.phase };
  if (["FAILED", "SUCCESS", "CANCELLED"].includes(event.phase)) {
    const endedAt = new Date();
    const job = await Job.findOne({ jobId: event.jobId }, { startedAt: 1 });
    updates.status = event.phase;
    updates.endedAt = endedAt;
    if (job?.startedAt) updates.durationMs = endedAt - job.startedAt;
    if (event.phase === "SUCCESS" && event.result) updates.result = event.result;
  } else if (event.phase === "WAITING_OTP") {
    updates.status = "WAITING_OTP";
  }

  await Job.findOneAndUpdate({ jobId: event.jobId }, updates);
  publish(event.jobId, event.toObject());

  const headers = requestId ? { "X-Request-Id": requestId } : {};
  res.set(headers).json({ ok: true });
});

// Server → browser: per-job SSE stream with Last-Event-ID replay
router.get("/stream/:jobId", async (req, res) => {
  res.writeHead(200, SSE_HEADERS);
  res.flushHeaders();

  // Replay from the last seq the client saw (Last-Event-ID header)
  const lastSeq = parseInt(req.headers["last-event-id"] ?? "0", 10);
  const filter = { jobId: req.params.jobId };
  if (lastSeq > 0) filter.seq = { $gt: lastSeq };

  const backlog = await Event.find(filter).sort({ seq: 1 });
  for (const ev of backlog) {
    res.write(`id:${ev.seq}\ndata:${JSON.stringify(ev.toObject())}\n\n`);
  }

  subscribe(req.params.jobId, res);
});

// Server → browser: global SSE for admin dashboard live updates
router.get("/stream", (_req, res) => {
  res.writeHead(200, SSE_HEADERS);
  res.flushHeaders();
  subscribeGlobal(res);
});

export default router;
