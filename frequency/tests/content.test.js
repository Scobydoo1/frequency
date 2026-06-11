import { describe, it, expect } from "vitest";
import { seededInt, agoFor, PROMPTS, nightlyPrompt, nightlyTrack, TRACKS } from "../src/content.js";

describe("seededInt", () => {
  it("always stays within [lo, hi] (Math.imul sign regression)", () => {
    for (let seed = 0; seed < 20000; seed++) {
      const v = seededInt(seed, 120, 1800);
      expect(v).toBeGreaterThanOrEqual(120);
      expect(v).toBeLessThanOrEqual(1800);
    }
  });
  it("is deterministic", () => {
    expect(seededInt(42, 0, 100)).toBe(seededInt(42, 0, 100));
  });
});

describe("content", () => {
  it("has 4 prompts with 10 messages each, all within the 90-char composer limit", () => {
    expect(PROMPTS).toHaveLength(4);
    for (const p of PROMPTS) {
      expect(p.messages).toHaveLength(10);
      for (const m of p.messages) expect(m.length).toBeLessThanOrEqual(90);
    }
  });
  it("agoFor returns a phrase", () => {
    expect(typeof agoFor(0, 1)).toBe("string");
  });
});

describe("nightlyPrompt", () => {
  it("is stable within a day and is one of the prompts", () => {
    const d = new Date("2026-06-10T20:00:00Z");
    const a = nightlyPrompt(d);
    const b = nightlyPrompt(new Date("2026-06-10T23:30:00Z"));
    expect(a.id).toBe(b.id);
    expect(PROMPTS.map((p) => p.id)).toContain(a.id);
  });
  it("rotates across days", () => {
    const ids = new Set();
    for (let i = 0; i < 30; i++) ids.add(nightlyPrompt(new Date(Date.UTC(2026, 5, 1 + i))).id);
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe("nightlyTrack", () => {
  it("is stable within a day and is a real track with an mp3", () => {
    const a = nightlyTrack(new Date("2026-06-11T10:00:00Z"));
    const b = nightlyTrack(new Date("2026-06-11T22:00:00Z"));
    expect(a.slug).toBe(b.slug);
    expect(TRACKS.map((t) => t.slug)).toContain(a.slug);
    for (const t of TRACKS) expect(t.mp3).toMatch(/\.mp3$/);
  });
  it("rotates across days", () => {
    const ids = new Set();
    for (let i = 0; i < 30; i++) ids.add(nightlyTrack(new Date(Date.UTC(2026, 5, 1 + i))).slug);
    expect(ids.size).toBeGreaterThan(1);
  });
});
