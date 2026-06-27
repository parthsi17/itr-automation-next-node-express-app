import axios from "axios";
import dotenv from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const EVENT_URL = process.env.EVENT_URL;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

if (!EVENT_URL) throw new Error("EVENT_URL is not defined in .env");
if (!WEBHOOK_SECRET) throw new Error("WEBHOOK_SECRET is not defined in .env");

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 200;

// Mask credentials before they cross the wire — never log PAN/OTP/password
function sanitise(event) {
  const safe = { ...event };
  delete safe.requestId; // internal only, not part of the event shape
  if (safe.result) {
    safe.result = {
      userId: safe.result.userId ? "***" : undefined,
      password: safe.result.password ? "***" : undefined,
    };
  }
  return safe;
}

export async function emit(event) {
  const payload = sanitise(event);
  const requestId = event.requestId ?? event.jobId;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await axios.post(EVENT_URL, payload, {
        headers: {
          Authorization: `Bearer ${WEBHOOK_SECRET}`,
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
        },
        timeout: 5_000,
      });
      return;
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        // Log but never throw — a lost event must not crash the run
        console.error(`[webhookClient] event emit failed after ${MAX_RETRIES} retries:`, err.message);
        return;
      }
      await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
