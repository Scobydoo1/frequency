import { describe, it, expect } from "vitest";
import { moderate, sanitize, signalId, MAX_LEN } from "../api/_lib/moderation.js";

describe("sanitize", () => {
  it("collapses whitespace and trims", () => {
    expect(sanitize("  hello   world  ")).toBe("hello world");
  });
  it("flattens newlines and tabs to a single line", () => {
    expect(sanitize("line1\nline2\tend")).toBe("line1 line2 end");
  });
  it("truncates to MAX_LEN", () => {
    expect(sanitize("x".repeat(200)).length).toBe(MAX_LEN);
  });
  it("handles non-strings", () => {
    expect(sanitize(null)).toBe("");
    expect(sanitize(42)).toBe("");
  });
});

describe("moderate", () => {
  it("accepts a quiet honest line", () => {
    const r = moderate("I still miss you, even now.");
    expect(r.ok).toBe(true);
    expect(r.text).toBe("I still miss you, even now.");
  });
  it("rejects too-short input", () => {
    expect(moderate("a").ok).toBe(false);
  });
  it("blocks links, emails, phones, handles", () => {
    expect(moderate("see www.evil.com").ok).toBe(false);
    expect(moderate("visit https://x.io now").ok).toBe(false);
    expect(moderate("mail me at a@b.com").ok).toBe(false);
    expect(moderate("call 555-123-4567 please").ok).toBe(false);
    expect(moderate("find me @coolhandle").ok).toBe(false);
  });
  it("blocks shouting and spam", () => {
    expect(moderate("I AM SHOUTING HERE").ok).toBe(false);
    expect(moderate("aaaaaaaaa").ok).toBe(false);
  });
  it("blocks hostility", () => {
    expect(moderate("just kys honestly").ok).toBe(false);
  });
  it("allows normal capitalized words and punctuation", () => {
    expect(moderate("I loved Paris in the spring.").ok).toBe(true);
  });
});

describe("signalId", () => {
  it("is stable for the same text+ts and short", () => {
    const a = signalId("hello", 1000);
    expect(a).toBe(signalId("hello", 1000));
    expect(a.length).toBeLessThanOrEqual(8);
  });
  it("differs across text", () => {
    expect(signalId("a", 1)).not.toBe(signalId("b", 1));
  });
});
