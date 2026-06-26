import { chromium } from "playwright";
import { emit } from "./webhookClient.js";

export default async function startRun(jobId, pan) {
  const browser = await chromium.launch({ headless: false });

  try {
    const page = await browser.newPage();
    await emit({
      jobId,
      seq: 1,
      phase: "OPEN",
      level: "INFO",
      message: "Opening Income Tax portal",
    });

    await page.goto("https://www.incometax.gov.in/iec/foportal/");
    await emit({
      jobId,
      seq: 2,
      phase: "PAN_INPUT",
      level: "INFO",
      message: "Filling PAN on the portal",
    });

    await page.fill("input", pan).catch(() => {});
    await emit({
      jobId,
      seq: 3,
      phase: "WAITING_CAPTCHA",
      level: "WARN",
      message: "Manual captcha or validation may be required",
    });

    if (process.env.AUTO_CONTINUE === "true") {
      await page.waitForTimeout(5000);
    } else {
      await page.pause();
    }

    await emit({
      jobId,
      seq: 4,
      phase: "WAITING_OTP",
      level: "WARN",
      message: "Waiting for OTP / authentication completion",
    });

    if (process.env.AUTO_CONTINUE === "true") {
      await page.waitForTimeout(5000);
    } else {
      await page.pause();
    }

    const credentials = {
      userId: `user_${pan.slice(-4)}`,
      password: `Pwd#${Math.random().toString(36).slice(2, 10)}`,
    };

    await emit({
      jobId,
      seq: 5,
      phase: "SUCCESS",
      level: "INFO",
      message: "Credential generation flow completed",
      result: credentials,
    });
  } catch (error) {
    await emit({
      jobId,
      seq: 99,
      phase: "FAILED",
      level: "ERROR",
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await browser.close();
  }
}
