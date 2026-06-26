import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    jobId: String,
    seq: Number,
    phase: String,
    level: String,
    message: String,
    result: {
      userId: String,
      password: String,
    },
  },
  {
    timestamps: true,
  }
);

eventSchema.index({ jobId: 1, seq: 1 });

export default mongoose.model("Event", eventSchema);
