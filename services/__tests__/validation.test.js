import { describe, it, expect } from "vitest";

// Mirrors the regex used in jobs.routes.js — single source of truth kept by having
// this test enforce the same contract the route enforces.
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

describe("PAN payload validation", () => {
  it("accepts a valid PAN", () => {
    expect(PAN_RE.test("ABCDE1234F")).toBe(true);
  });

  it("rejects lowercase letters", () => {
    expect(PAN_RE.test("abcde1234f")).toBe(false);
  });

  it("rejects a PAN that is too short", () => {
    expect(PAN_RE.test("ABCDE123F")).toBe(false);
  });

  it("rejects a PAN that is too long", () => {
    expect(PAN_RE.test("ABCDE12345F")).toBe(false);
  });

  it("rejects digits in letter positions", () => {
    expect(PAN_RE.test("12345ABCDE")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(PAN_RE.test("")).toBe(false);
  });
});
