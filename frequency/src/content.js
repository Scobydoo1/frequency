/* FREQUENCY — content helpers. Prompts/palette come from the shared module
 * so the backend seed store stays in lockstep. */
import { PROMPTS, PALETTE } from "../shared/prompts.js";

export { PROMPTS, PALETTE };

export const STRANGER_COUNT = 7;
export const MOTION = 1;

export function fmtCount(n) { return n.toLocaleString("en-US"); }

export function seededInt(seed, lo, hi) {
  let a = (seed * 2654435761) >>> 0;
  a ^= a >>> 15; a = Math.imul(a, 0x85ebca6b); a ^= a >>> 13;
  a = a >>> 0; // Math.imul is signed; keep the modulo in [0, hi-lo]
  return lo + (a % (hi - lo + 1));
}

export function agoFor(i, seed) {
  const opts = ["4 minutes ago", "26 minutes ago", "an hour ago", "2 hours ago", "5 hours ago", "last night", "yesterday", "3 days ago"];
  return opts[seededInt(seed + i * 7, 0, opts.length - 1)];
}

/* The whole world tunes to the same prompt each night: pick by the day number
 * so it's stable for everyone for ~24h, then rotates. */
export function nightlyPrompt(now = new Date()) {
  const day = Math.floor(now.getTime() / 86400000);
  return PROMPTS[seededInt(day + 1, 0, PROMPTS.length - 1)];
}
