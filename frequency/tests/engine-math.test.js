import { describe, it, expect } from "vitest";
import {
  mulberry32, freqAt, stepLockProgress, spawnStrangers, dist,
  LOCK_FILL_S, LOCK_DECAY_S,
} from "../src/engine/field-engine.js";

describe("mulberry32", () => {
  it("is deterministic for the same seed", () => {
    const a = mulberry32(42), b = mulberry32(42);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });
  it("produces values in [0, 1)", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("freqAt", () => {
  it("maps left edge to 88 FM and right edge to 108 FM", () => {
    expect(freqAt(0, 1000)).toBe(88);
    expect(freqAt(1000, 1000)).toBe(108);
    expect(freqAt(500, 1000)).toBeCloseTo(98);
  });
});

describe("stepLockProgress", () => {
  it("fills from 0 to 1 in LOCK_FILL_S seconds when near", () => {
    let p = 0;
    const dt = 1 / 60;
    let elapsed = 0;
    while (p < 1 && elapsed < 5) { p = stepLockProgress(p, true, dt); elapsed += dt; }
    expect(p).toBe(1);
    expect(elapsed).toBeGreaterThanOrEqual(LOCK_FILL_S - 0.05);
    expect(elapsed).toBeLessThanOrEqual(LOCK_FILL_S + 0.05);
  });
  it("decays back to 0 in LOCK_DECAY_S seconds when far", () => {
    let p = 1;
    const dt = 1 / 60;
    let elapsed = 0;
    while (p > 0 && elapsed < 5) { p = stepLockProgress(p, false, dt); elapsed += dt; }
    expect(p).toBe(0);
    expect(elapsed).toBeGreaterThanOrEqual(LOCK_DECAY_S - 0.05);
    expect(elapsed).toBeLessThanOrEqual(LOCK_DECAY_S + 0.05);
  });
  it("clamps to [0, 1]", () => {
    expect(stepLockProgress(0.99, true, 1)).toBe(1);
    expect(stepLockProgress(0.01, false, 1)).toBe(0);
  });
});

describe("spawnStrangers", () => {
  const W = 1280, H = 800;
  it("spawns the requested count with stable layout per seed", () => {
    const a = spawnStrangers(123, 7, W, H);
    const b = spawnStrangers(123, 7, W, H);
    expect(a).toHaveLength(7);
    expect(a.map((s) => [s.x, s.y])).toEqual(b.map((s) => [s.x, s.y]));
  });
  it("clamps count to [3, 14]", () => {
    expect(spawnStrangers(1, 1, W, H).length).toBe(3);
    expect(spawnStrangers(1, 99, W, H).length).toBe(14);
  });
  it("keeps strangers inside margins, apart from each other and the center start", () => {
    const out = spawnStrangers(7, 9, W, H);
    for (const s of out) {
      expect(s.bx).toBeGreaterThanOrEqual(90);
      expect(s.bx).toBeLessThanOrEqual(W - 90);
      expect(s.by).toBeGreaterThanOrEqual(90);
      expect(s.by).toBeLessThanOrEqual(H - 90);
      expect(dist(s.bx, s.by, W / 2, H / 2)).toBeGreaterThanOrEqual(120);
    }
    for (let i = 0; i < out.length; i++)
      for (let j = i + 1; j < out.length; j++)
        expect(dist(out[i].bx, out[i].by, out[j].bx, out[j].by)).toBeGreaterThanOrEqual(130);
  });
});
