import { describe, it, expect } from "vitest";
import { seededInt, agoFor, PROMPTS } from "../src/content.js";

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
