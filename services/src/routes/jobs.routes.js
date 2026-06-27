import express from "express";
import { randomUUID } from "crypto";
import Job from "../../Models/Job.js";
import { requireBearer } from "../middleware/auth.js";
import { resolveOtp } from "../lib/otpStore.js";
import { encrypt, decrypt } from "../lib/encrypt.js";
import startRun from "../../../automation/bot.js";

const router = express.Router();

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// POST /jobs — start a new automation run
router.post("/jobs", requireBearer, async (req, res) => {
  const requestId = req.headers["x-request-id"] ?? randomUUID();
  const { pan } = req.body;

  if (!pan || !PAN_RE.test(pan)) {
    return res.status(400).json({ error: "Invalid PAN — must be AAAAA9999A format" });
  }

  const jobId = randomUUID();
  const panMasked = `XXXXX${pan.slice(-5)}`;

  await Job.create({ jobId, panMasked, phase: "CREATED", status: "RUNNING", startedAt: new Date() });

  res.set("X-Request-Id", requestId).json({ jobId });

  startRun(jobId, pan, requestId).catch(async (err) => {
    console.error(`[${requestId}] run ${jobId} crashed:`, err.message);
    await Job.findOneAndUpdate({ jobId }, { status: "FAILED", phase: "FAILED" });
  });
});

// GET /jobs — list all runs (projection excludes result so credentials never appear here)
router.get("/jobs", requireBearer, async (req, res) => {
  const { phase, status } = req.query;
  const filter = {};
  if (phase) filter.phase = phase;
  if (status) filter.status = status;

  const jobs = await Job.find(filter, {
    jobId: 1, panMasked: 1, phase: 1, status: 1,
    startedAt: 1, endedAt: 1, durationMs: 1, updatedAt: 1, createdAt: 1,
  }).sort({ updatedAt: -1 });

  res.json(jobs);
});

// GET /jobs/:jobId — single run detail; decrypt credentials before serving
router.get("/jobs/:jobId", requireBearer, async (req, res) => {
  const job = await Job.findOne({ jobId: req.params.jobId });
  if (!job) return res.status(404).json({ error: "Run not found" });

  const doc = job.toObject();
  if (doc.result?.userId) {
    try {
      doc.result = {
        userId: decrypt(doc.result.userId),
        password: decrypt(doc.result.password),
      };
    } catch {
      // If decryption fails (e.g. legacy data), omit rather than expose ciphertext
      delete doc.result;
    }
  }
  res.json(doc);
});

// POST /jobs/:jobId/result — bot calls this to securely persist credentials;
// credentials are encrypted at rest and never travel through the event log.
router.post("/jobs/:jobId/result", requireBearer, async (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) {
    return res.status(400).json({ error: "userId and password required" });
  }

  const job = await Job.findOne({ jobId: req.params.jobId });
  if (!job) return res.status(404).json({ error: "Run not found" });

  await Job.findOneAndUpdate(
    { jobId: req.params.jobId },
    { result: { userId: encrypt(userId), password: encrypt(password) } }
  );

  res.json({ ok: true });
});

// POST /jobs/:jobId/otp — supply OTP from the UI
router.post("/jobs/:jobId/otp", requireBearer, async (req, res) => {
  const { otp } = req.body;
  if (!otp || typeof otp !== "string") {
    return res.status(400).json({ error: "otp field required" });
  }

  const resolved = resolveOtp(req.params.jobId, otp.trim());
  if (!resolved) {
    return res.status(409).json({ error: "No run is waiting for an OTP right now" });
  }

  res.json({ ok: true });
});

// POST /jobs/:jobId/cancel — cancel a running or waiting-OTP job
router.post("/jobs/:jobId/cancel", requireBearer, async (req, res) => {
  const job = await Job.findOne({ jobId: req.params.jobId });
  if (!job) return res.status(404).json({ error: "Run not found" });
  if (!["RUNNING", "WAITING_OTP"].includes(job.status)) {
    return res.status(409).json({ error: "Run is not in a cancellable state" });
  }

  resolveOtp(req.params.jobId, "__cancel__");

  const endedAt = new Date();
  await Job.findOneAndUpdate(
    { jobId: req.params.jobId },
    { status: "CANCELLED", phase: "CANCELLED", endedAt, durationMs: endedAt - job.startedAt }
  );

  res.json({ ok: true });
});

export default router;
