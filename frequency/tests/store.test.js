import { describe, it, expect, beforeEach } from "vitest";
import { getSignals, addSignal } from "../api/_lib/store.js";

// no BLOB_READ_WRITE_TOKEN in test env → curated fallback path
describe("store (no-blob fallback)", () => {
  beforeEach(() => { delete process.env.BLOB_READ_WRITE_TOKEN; });

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
