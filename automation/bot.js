import { chromium } from "playwright";
import { emit } from "./webhookClient.js";
import { waitForOtp } from "../services/src/lib/otpStore.js";

// ---------------------------------------------------------------------------
// State machine states
// ---------------------------------------------------------------------------
const S = {
  OPENING_PORTAL:   "OPENING_PORTAL",
  ENTERING_PAN:     "ENTERING_PAN",
  SOLVING_CAPTCHA:  "SOLVING_CAPTCHA",
  WAITING_OTP:      "WAITING_OTP",
  ENTERING_OTP:     "ENTERING_OTP",
  SETTING_PASSWORD: "SETTING_PASSWORD",
  SUCCESS:          "SUCCESS",
  FAILED:           "FAILED",
  CANCELLED:        "CANCELLED",
};

const PORTAL_URL = "https://www.incometax.gov.in/iec/foportal/";
const MAX_CAPTCHA_RETRIES = 3;

// ---------------------------------------------------------------------------
// Sequence counter (per-run, reset on each startRun call)
// ---------------------------------------------------------------------------
let _seq = 0;
function nextSeq() { return ++_seq; }

async function step(jobId, phase, level, message, requestId, extra = {}) {
  await emit({ jobId, seq: nextSeq(), phase, level, message, requestId, ...extra });
}

function maskPan(pan) {
  return `XXXXX${pan.slice(-5)}`;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
export default async function startRun(jobId, pan, requestId = "") {
  _seq = 0;
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await runMachine(jobId, pan, page, requestId);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// State machine loop
// ---------------------------------------------------------------------------
async function runMachine(jobId, pan, page, requestId) {
  let state = S.OPENING_PORTAL;
  // Shared context passed between states
  const ctx = { otpAttempts: 0 };

  while (true) {
    switch (state) {
      case S.OPENING_PORTAL:   state = await openPortal(jobId, pan, page, requestId, ctx); break;
      case S.ENTERING_PAN:     state = await enterPan(jobId, pan, page, requestId, ctx); break;
      case S.SOLVING_CAPTCHA:  state = await solveCaptcha(jobId, pan, page, requestId, ctx); break;
      case S.WAITING_OTP:      state = await waitOtp(jobId, pan, page, requestId, ctx); break;
      case S.ENTERING_OTP:     state = await enterOtp(jobId, pan, page, requestId, ctx); break;
      case S.SETTING_PASSWORD: state = await setPassword(jobId, pan, page, requestId, ctx); break;
      case S.SUCCESS:
      case S.FAILED:
      case S.CANCELLED:
        return;
      default:
        await step(jobId, S.FAILED, "ERROR", `Unexpected state: ${state}`, requestId);
        return;
    }
  }
}

// ---------------------------------------------------------------------------
// State handlers
// ---------------------------------------------------------------------------
async function openPortal(jobId, _pan, page, requestId) {
  await step(jobId, S.OPENING_PORTAL, "INFO", "Opening Income Tax e-filing portal", requestId);
  try {
    await page.goto(PORTAL_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    return S.ENTERING_PAN;
  } catch (err) {
    await step(jobId, S.FAILED, "ERROR", `Portal unreachable: ${err.message}`, requestId);
    return S.FAILED;
  }
}

async function enterPan(jobId, pan, page, requestId) {
  await step(jobId, S.ENTERING_PAN, "INFO", `Entering PAN ${maskPan(pan)}`, requestId);
  try {
    // Click "Register" to start credential generation flow
    const register = page.locator("a:has-text('Register'), button:has-text('Register')").first();
    if (await register.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await register.click();
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    }

    const panInput = page
      .locator("input[name='userId'], input[placeholder*='PAN'], input[id*='pan'], input[id*='Pan']")
      .first();
    await panInput.waitFor({ state: "visible", timeout: 10_000 });
    await panInput.fill(pan);

    return S.SOLVING_CAPTCHA;
  } catch (err) {
    await step(jobId, S.FAILED, "ERROR", `PAN entry failed: ${err.message}`, requestId);
    return S.FAILED;
  }
}

async function solveCaptcha(jobId, _pan, page, requestId, ctx) {
  ctx.captchaAttempt = (ctx.captchaAttempt ?? 0) + 1;
  if (ctx.captchaAttempt > MAX_CAPTCHA_RETRIES) {
    await step(jobId, S.FAILED, "ERROR", "Exceeded max CAPTCHA retries", requestId);
    return S.FAILED;
  }

  await step(
    jobId, S.SOLVING_CAPTCHA, "WARN",
    `CAPTCHA gate — attempt ${ctx.captchaAttempt}/${MAX_CAPTCHA_RETRIES} (human solve required in browser)`,
    requestId
  );

  try {
    const captchaInput = page.locator("input[name='captcha'], input[id*='captcha']").first();
    if (await captchaInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Pause the Playwright Inspector for the human to fill the CAPTCHA
      await page.pause();
    }

    const continueBtn = page
      .locator("button:has-text('Continue'), button:has-text('Submit'), input[type='submit']")
      .first();
    if (await continueBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await continueBtn.click();
    }

    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    // If the portal echoes a CAPTCHA error, retry
    const errEl = page.locator(".error, .alert-danger, [class*='error']").first();
    const errTxt = await errEl.textContent({ timeout: 3_000 }).catch(() => "");
    if (/captcha/i.test(errTxt)) {
      await step(jobId, S.SOLVING_CAPTCHA, "WARN", `CAPTCHA incorrect, retrying`, requestId);
      return S.SOLVING_CAPTCHA;
    }

    return S.WAITING_OTP;
  } catch (err) {
    await step(jobId, S.FAILED, "ERROR", `CAPTCHA handling error: ${err.message}`, requestId);
    return S.FAILED;
  }
}

async function waitOtp(jobId, _pan, _page, requestId, ctx) {
  await step(
    jobId, S.WAITING_OTP, "WARN",
    "OTP dispatched to registered mobile/email — waiting for operator to supply OTP via dashboard",
    requestId
  );
  try {
    const otp = await waitForOtp(jobId);
    if (otp === "__cancel__") {
      await step(jobId, S.CANCELLED, "WARN", "Run cancelled by operator", requestId);
      return S.CANCELLED;
    }
    ctx.otp = otp;
    return S.ENTERING_OTP;
  } catch (err) {
    await step(jobId, S.FAILED, "ERROR", `OTP wait error: ${err.message}`, requestId);
    return S.FAILED;
  }
}

async function enterOtp(jobId, _pan, page, requestId, ctx) {
  ctx.otpAttempts = (ctx.otpAttempts ?? 0) + 1;
  await step(jobId, S.ENTERING_OTP, "INFO", `Entering OTP (attempt ${ctx.otpAttempts})`, requestId);
  try {
    const otpInput = page
      .locator("input[name='otp'], input[id*='otp'], input[placeholder*='OTP']")
      .first();
    await otpInput.waitFor({ state: "visible", timeout: 10_000 });
    await otpInput.fill(ctx.otp);

    const verifyBtn = page.locator("button:has-text('Verify'), button:has-text('Submit')").first();
    await verifyBtn.click();
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    const errTxt = await page.locator(".error, .alert-danger").first().textContent({ timeout: 3_000 }).catch(() => "");
    if (/otp|invalid|incorrect/i.test(errTxt)) {
      if (ctx.otpAttempts >= MAX_OTP_ATTEMPTS) {
        await step(jobId, S.FAILED, "ERROR", `Wrong OTP × ${MAX_OTP_ATTEMPTS} — run failed`, requestId);
        return S.FAILED;
      }
      await step(jobId, S.WAITING_OTP, "WARN", "OTP rejected — please supply the correct OTP", requestId);
      return S.WAITING_OTP;
    }

    return S.SETTING_PASSWORD;
  } catch (err) {
    await step(jobId, S.FAILED, "ERROR", `OTP entry failed: ${err.message}`, requestId);
    return S.FAILED;
  }
}

async function setPassword(jobId, pan, page, requestId) {
  await step(jobId, S.SETTING_PASSWORD, "INFO", "Setting new password on portal", requestId);
  try {
    const password = generatePassword();

    const pwdInput = page
      .locator("input[name='password'], input[type='password']")
      .first();
    await pwdInput.waitFor({ state: "visible", timeout: 10_000 });
    await pwdInput.fill(password);

    const confirmInput = page.locator("input[name='confirmPassword'], input[id*='confirm']").first();
    if (await confirmInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmInput.fill(password);
    }

    const submitBtn = page
      .locator("button[type='submit'], button:has-text('Submit'), button:has-text('Set Password')")
      .first();
    await submitBtn.click();
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    // PAN is the User ID on the IT portal
    const userId = pan.toUpperCase();

    await step(jobId, S.SUCCESS, "INFO", "Credential generation successful", requestId, {
      result: { userId, password },
    });
    return S.SUCCESS;
  } catch (err) {
    await step(jobId, S.FAILED, "ERROR", `Password setup failed: ${err.message}`, requestId);
    return S.FAILED;
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
const MAX_OTP_ATTEMPTS = 3;

function generatePassword() {
  const upper   = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower   = "abcdefghjkmnpqrstuvwxyz";
  const digits  = "23456789";
  const special = "@#$!";
  const pool    = upper + lower + digits + special;
  const base = [
    upper[rand(upper.length)],
    lower[rand(lower.length)],
    digits[rand(digits.length)],
    special[rand(special.length)],
  ];
  for (let i = 0; i < 8; i++) base.push(pool[rand(pool.length)]);
  return base.sort(() => Math.random() - 0.5).join("");
}

function rand(n) { return Math.floor(Math.random() * n); }
