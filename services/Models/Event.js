import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    jobId:   { type: String, required: true },
    seq:     { type: Number, required: true },
    phase:   { type: String, required: true },
    level:   { type: String, enum: ["INFO", "WARN", "ERROR"], default: "INFO" },
    message: { type: String, required: true },
    // Only present on SUCCESS events; credentials stored encrypted by the app layer
    result: {
      userId:   String,
      password: String,
    },
  },
  { timestamps: true }
);

// Primary replay query: find all events for a job ordered by seq
eventSchema.index({ jobId: 1, seq: 1 }, { unique: true });

export default mongoose.model("Event", eventSchema);
