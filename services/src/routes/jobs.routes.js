import express from "express";
import { randomUUID } from "crypto";

import Job from "../../Models/Job.js";
import startRun from "../../../automation/bot.js";

const router = express.Router();

router.post("/jobs", async (req, res) => {
  const { pan } = req.body;

  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
    return res.status(400).json({ error: "Invalid PAN" });
  }

  const jobId = randomUUID();

  await Job.create({
    jobId,
    panMasked: `XXXXX${pan.slice(-4)}`,
    phase: "CREATED",
    status: "RUNNING",
  });

  res.json({ jobId });

  startRun(jobId, pan).catch(async (error) => {
    console.error("Automation run failed:", error);
    await Job.findOneAndUpdate({ jobId }, { status: "FAILED", phase: "FAILED" });
  });
});

router.get("/jobs", async (req, res) => {
  const jobs = await Job.find().sort({ updatedAt: -1 });
  res.json(jobs);
});

router.get("/jobs/:jobId", async (req, res) => {
  const job = await Job.findOne({ jobId: req.params.jobId });
  if (!job) {
    return res.status(404).json({ error: "Run not found" });
  }
  res.json(job);
});

export default router;
