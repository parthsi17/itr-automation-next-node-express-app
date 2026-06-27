import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    jobId:     { type: String, required: true, unique: true },
    panMasked: { type: String, required: true },
    phase:     { type: String, default: "CREATED" },
    status:    { type: String, default: "RUNNING" },
    startedAt: { type: Date, default: Date.now },
    endedAt:   { type: Date },
    durationMs:{ type: Number },
    result: {
      userId:   String,
      password: String,
    },
  },
  { timestamps: true }
);

// Admin list: sort by updatedAt, filter by phase/status
schema.index({ status: 1, updatedAt: -1 });
schema.index({ phase: 1, updatedAt: -1 });
// Fast single-job lookup
schema.index({ jobId: 1 }, { unique: true });

export default mongoose.model("Job", schema);
