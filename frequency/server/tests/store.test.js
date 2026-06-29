import { describe, it, expect, beforeEach } from "vitest";
import { getSignals, addSignal } from "../lib/store.js";

// no DATABASE_URL in test env → curated fallback path
describe("store (no-db fallback)", () => {
  beforeEach(() => { delete process.env.DATABASE_URL; });

  it("returns curated messages and a stable nightly count", async () => {
    const a = await getSignals("letgo", 7);
    expect(a.messages.length).toBe(7);
    expect(a.count).toBeGreaterThan(0);
    const b = await getSignals("letgo", 7);
    expect(b.count).toBe(a.count); // stable within the night
  });

  it("clamps n into [3, 14]", async () => {
    expect((await getSignals("letgo", 1)).messages.length).toBe(3);
    expect((await getSignals("letgo", 99)).messages.length).toBe(10); // only 10 seeds exist
  });

  it("falls back to a valid prompt for unknown ids", async () => {
    const r = await getSignals("does-not-exist", 5);
    expect(r.messages.length).toBe(5);
  });

  it("accepts a submission but reports it was not persisted", async () => {
    const r = await addSignal("letgo", "a new true thing");
    expect(r.persisted).toBe(false);
    expect(typeof r.id).toBe("string");
  });

  it("gives each prompt its own count", async () => {
    const a = await getSignals("letgo", 3);
    const b = await getSignals("threeam", 3);
    expect(a.count).not.toBe(b.count);
  });
});

describe("ageDays on signals", () => {
  it("seeds carry bounded ageDays for the decay mechanic", async () => {
    const { getSignals } = await import("../lib/store.js");
    const { messages } = await getSignals("letgo", 14);
    for (const m of messages) {
      expect(typeof m.ageDays).toBe("number");
      expect(m.ageDays).toBeGreaterThanOrEqual(0);
      expect(m.ageDays).toBeLessThanOrEqual(7);
    }
  });
});
