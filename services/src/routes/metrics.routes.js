import express from "express";
import Job from "../../Models/Job.js";

const router = express.Router();

router.get("/metrics", async (_req, res) => {
  const [total, successes, failures, durations] = await Promise.all([
    Job.countDocuments(),
    Job.countDocuments({ status: "SUCCESS" }),
    Job.countDocuments({ status: "FAILED" }),
    Job.find({ durationMs: { $exists: true } }, { durationMs: 1, _id: 0 })
      .sort({ durationMs: 1 })
      .lean(),
  ]);

  const durationValues = durations.map((d) => d.durationMs);
  const p50 = percentile(durationValues, 50);
  const p99 = percentile(durationValues, 99);

  res.json({
    total,
    successes,
    failures,
    successRate: total > 0 ? Math.round((successes / total) * 100) : 0,
    p50Ms: p50,
    p99Ms: p99,
  });
});

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export default router;
