import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env") });

import { connectDB, closeDB } from "./lib/db.js";
import jobsRoutes from "./routes/jobs.routes.js";
import eventsRoutes from "./routes/events.routes.js";
import metricsRoutes from "./routes/metrics.routes.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health check — exempt from auth
app.get("/health", (_req, res) => res.json({ ok: true }));

app.use(jobsRoutes);
app.use(eventsRoutes);
app.use(metricsRoutes);

// Global error handler — isolates one run's error from the process
app.use((err, _req, res, _next) => {
  console.error(JSON.stringify({ level: "ERROR", msg: err.message }));
  res.status(500).json({ error: "Internal server error" });
});

async function start() {
  await connectDB();
  const server = app.listen(PORT, () => {
    console.log(JSON.stringify({ level: "INFO", msg: `Server listening on port ${PORT}` }));
  });

  async function shutdown(signal) {
    console.log(JSON.stringify({ level: "INFO", msg: `${signal} — shutting down gracefully` }));
    server.close(async () => {
      await closeDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((err) => {
  console.error(JSON.stringify({ level: "ERROR", msg: err.message }));
  process.exit(1);
});
