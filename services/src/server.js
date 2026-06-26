import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { connectDB } from "./lib/db.js";
import jobsRoutes from "./routes/jobs.routes.js";
import eventRoutes from "./routes/events.routes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: resolve(__dirname, "../../.env") });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(jobsRoutes);
app.use(eventRoutes);

app.get("/", (req, res) => res.send("Backend running"));

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
