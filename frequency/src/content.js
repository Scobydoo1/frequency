/* FREQUENCY — content helpers. Prompts/palette come from the shared module
 * so the backend seed store stays in lockstep. */
import { PROMPTS, PALETTE, PROMPT_PALETTES, paletteFor } from "../shared/prompts.js";

export { PROMPTS, PALETTE, PROMPT_PALETTES, paletteFor };

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

/* Tonight's station: one lofi record per night, same for everyone.
 * All tracks CC0 / public domain from opengameart.org (licenses verified on
 * each track page). MP3 required (iOS can't decode OGG); OGG used where the
 * artist provided a seamless loop edit. */
export const TRACKS = [
  {
    slug: "chill-lofi",
    title: "Chill lofi inspired",
    artist: "omfgdude (loop edit: qubodup)",
    mp3: "/audio/lofi-loop.mp3",
    ogg: "/audio/lofi-loop.ogg",
  },
  {
    slug: "since-2am",
    title: "Since 2 A.M.",
    artist: "TAD",
    mp3: "/audio/since-2am.mp3",
  },
  {
    slug: "rhodes-day",
    title: "happy lofi day",
    artist: "Tarush Singhal",
    mp3: "/audio/rhodes-day.mp3",
  },
];

export function nightlyTrack(now = new Date()) {
  const day = Math.floor(now.getTime() / 86400000);
  // offset the seed so the track and prompt rotations don't stay in sync
  return TRACKS[seededInt(day + 7, 0, TRACKS.length - 1)];
}

/** Look up a track by its slug, or null. Used by the manual track picker:
 *  a null/missing pick means "let it rotate nightly" (nightlyTrack). */
export function trackBySlug(slug) {
  return TRACKS.find((t) => t.slug === slug) || null;
}

/* Tonight's weather: which ambient texture plays under the record.
 * Rotates nightly like the prompt and the track, each on its own offset. */
export const AMBIENCES = ["rain", "wind", "crickets", "fire"];

export function nightlyAmbience(now = new Date()) {
  const day = Math.floor(now.getTime() / 86400000);
  return AMBIENCES[seededInt(day + 3, 0, AMBIENCES.length - 1)];
}
