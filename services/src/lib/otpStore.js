// Stores pending OTP resolvers keyed by jobId.
// The bot calls waitForOtp(jobId) which returns a Promise.
// The API route calls resolveOtp(jobId, otp) to unblock the bot.
const pending = new Map();

export function waitForOtp(jobId, timeoutMs = 5 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(jobId);
      reject(new Error("OTP timeout — no OTP received within the allowed window"));
    }, timeoutMs);

    pending.set(jobId, (otp) => {
      clearTimeout(timer);
      pending.delete(jobId);
      resolve(otp);
    });
  });
}

export function resolveOtp(jobId, otp) {
  const resolver = pending.get(jobId);
  if (!resolver) return false;
  resolver(otp);
  return true;
}

export function hasPendingOtp(jobId) {
  return pending.has(jobId);
}
