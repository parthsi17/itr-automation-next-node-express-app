import { describe, it, expect } from "vitest";
import { waitForOtp, resolveOtp, hasPendingOtp } from "../src/lib/otpStore.js";

describe("OTP store — state machine pause / resume", () => {
  it("unblocks the waiting bot when the operator supplies an OTP", async () => {
    const promise = waitForOtp("job-resolve");
    expect(hasPendingOtp("job-resolve")).toBe(true);

    resolveOtp("job-resolve", "654321");

    await expect(promise).resolves.toBe("654321");
    expect(hasPendingOtp("job-resolve")).toBe(false);
  });

  it("propagates the cancel sentinel so the state machine can transition to CANCELLED", async () => {
    const promise = waitForOtp("job-cancel");
    resolveOtp("job-cancel", "__cancel__");
    await expect(promise).resolves.toBe("__cancel__");
  });

  it("returns false when no run is waiting (prevents spurious UI resolves)", () => {
    expect(resolveOtp("job-nonexistent", "000000")).toBe(false);
  });

  it("times out after the configured window and rejects the promise", async () => {
    const promise = waitForOtp("job-timeout", 50); // 50 ms timeout for test speed
    await expect(promise).rejects.toThrow("OTP timeout");
  });
});
