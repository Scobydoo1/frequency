import { describe, it, expect } from "vitest";
import {
  validateCallsign, validatePassword, hashPassword, verifyPassword,
  signToken, verifyToken,
} from "../api/_lib/auth.js";

describe("validateCallsign", () => {
  it("accepts and normalizes good callsigns", () => {
    expect(validateCallsign("Night_Owl")).toEqual({ ok: true, callsign: "night_owl" });
    expect(validateCallsign("  thanh-91 ")).toEqual({ ok: true, callsign: "thanh-91" });
  });
  it("rejects bad lengths and characters", () => {
    expect(validateCallsign("ab").ok).toBe(false);
    expect(validateCallsign("a".repeat(17)).ok).toBe(false);
    expect(validateCallsign("has space").ok).toBe(false);
    expect(validateCallsign("émile").ok).toBe(false);
    expect(validateCallsign(null).ok).toBe(false);
  });
  it("rejects reserved and hostile callsigns", () => {
    expect(validateCallsign("admin").ok).toBe(false);
    expect(validateCallsign("stranger").ok).toBe(false);
    expect(validateCallsign("fuckboy99").ok).toBe(false);
  });
});

describe("validatePassword", () => {
  it("enforces 6–72 chars", () => {
    expect(validatePassword("short").ok).toBe(false);
    expect(validatePassword("longenough").ok).toBe(true);
    expect(validatePassword("x".repeat(73)).ok).toBe(false);
    expect(validatePassword(null).ok).toBe(false);
  });
});

describe("password hashing", () => {
  it("verifies the right password and rejects the wrong one", () => {
    const { salt, hash } = hashPassword("correct horse");
    expect(verifyPassword("correct horse", salt, hash)).toBe(true);
    expect(verifyPassword("wrong horse", salt, hash)).toBe(false);
  });
  it("salts differ between calls", () => {
    expect(hashPassword("a").salt).not.toBe(hashPassword("a").salt);
  });
});

describe("session tokens", () => {
  const SECRET = "test-secret";
  it("round-trips a callsign", () => {
    const t = signToken("night_owl", SECRET);
    expect(verifyToken(t, SECRET)).toBe("night_owl");
  });
  it("rejects tampering and wrong secrets", () => {
    const t = signToken("night_owl", SECRET);
    expect(verifyToken(t + "x", SECRET)).toBe(null);
    expect(verifyToken(t, "other-secret")).toBe(null);
    const [payload] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ c: "admin", exp: Date.now() + 1e6 })).toString("base64url");
    expect(verifyToken(`${forged}.${t.split(".")[1]}`, SECRET)).toBe(null);
    expect(verifyToken(payload, SECRET)).toBe(null);
    expect(verifyToken("", SECRET)).toBe(null);
  });
  it("expires", () => {
    const t = signToken("night_owl", SECRET, 1000, 0); // issued at epoch, 1s ttl
    expect(verifyToken(t, SECRET, 2000)).toBe(null);
    expect(verifyToken(t, SECRET, 500)).toBe("night_owl");
  });
});
