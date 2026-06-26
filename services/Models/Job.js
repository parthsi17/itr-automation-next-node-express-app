import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    jobId: String,
    panMasked: String,
    phase: String,
    status: String,
    result: {
      userId: String,
      password: String,
    },
  },
  {
    timestamps: true,
  }
);

schema.index({ phase: 1, updatedAt: -1 });

export default mongoose.model("Job", schema);
