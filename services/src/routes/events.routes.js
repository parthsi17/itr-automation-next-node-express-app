import express from "express";

import Event from "../../Models/Event.js";
import Job from "../../Models/Job.js";
import { publish } from "../../sse/sseManager.js";

const router = express.Router();

router.post("/webhook", async (req, res) => {
  const event = await Event.create(req.body);
  const updates: Record<string, unknown> = { phase: event.phase };

  if (event.phase === "FAILED") {
    updates.status = "FAILED";
  } else if (event.phase === "WAITING_OTP") {
    updates.status = "WAITING_OTP";
  } else if (event.phase === "SUCCESS") {
    updates.status = "SUCCESS";
    if (event.result) {
      updates.result = event.result;
    }
  }

  if (Object.keys(updates).length > 0) {
    await Job.findOneAndUpdate({ jobId: event.jobId }, updates, { new: true });
  }

  publish(event.jobId, event);
  res.json({ ok: true });
});

router.get("/stream/:jobId", async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  const backlog = await Event.find({ jobId: req.params.jobId }).sort({ seq: 1 });
  backlog.forEach((event) => {
    res.write(`data:${JSON.stringify(event)}\n\n`);
  });

  publish(req.params.jobId, res);
});

export default router;
