import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "../src/lib/encrypt.js";

describe("AES-256-GCM credential encryption", () => {
  it("round-trips plaintext correctly", () => {
    const ct = encrypt("ABCDE1234F");
    expect(decrypt(ct)).toBe("ABCDE1234F");
  });

  it("produces a different ciphertext on every call (random IV)", () => {
    const a = encrypt("same-secret");
    const b = encrypt("same-secret");
    expect(a).not.toBe(b);
    // Both must still decrypt to the same value
    expect(decrypt(a)).toBe("same-secret");
    expect(decrypt(b)).toBe("same-secret");
  });

  it("throws when the ciphertext is tampered (GCM auth tag check)", () => {
    const ct = encrypt("sensitive");
    const [iv, tag, body] = ct.split(":");
    const tampered = [iv, tag, "deadbeef" + body.slice(8)].join(":");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("round-trips a generated password with special characters", () => {
    const pwd = "P@ssw0rd#9xZ";
    expect(decrypt(encrypt(pwd))).toBe(pwd);
  });
});
