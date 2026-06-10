/* Signal store — persists strangers' messages per prompt.
 *
 * Backed by Vercel Blob when BLOB_READ_WRITE_TOKEN is present (production with a
 * linked Blob store). When it isn't — local dev without env, or before the store
 * is wired — every function degrades gracefully: reads return the curated seed
 * messages, writes are accepted but not persisted. The app is always playable.
 */
import { SEEDS } from "./seeds.js";
import { signalId } from "./moderation.js";

const PREFIX = "signals/";
const MAX_PER_PROMPT = 500; // keep the newest N real messages per prompt
const VALID = new Set(Object.keys(SEEDS));

const hasBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

// date-seeded baseline so the "tuned tonight" count feels alive and is stable
// within a night, then real submissions add on top.
function baselineCount(promptId) {
  const day = Math.floor(Date.now() / 86400000);
  let a = ((day * 2654435761) ^ hashStr(promptId)) >>> 0;
  a ^= a >>> 15; a = Math.imul(a, 0x85ebca6b); a ^= a >>> 13; a = a >>> 0;
  return 900 + (a % 1700); // 900–2599
}
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

async function blob() {
  // imported lazily so the bundle works even if the dep is absent locally
  return import("@vercel/blob");
}

async function readRaw(promptId) {
  if (!hasBlob()) return { messages: [], submissions: 0 };
  try {
    const { list } = await blob();
    const { blobs } = await list({ prefix: PREFIX + promptId });
    if (!blobs.length) return { messages: [], submissions: 0 };
    const res = await fetch(blobs[0].url, { cache: "no-store" });
    if (!res.ok) return { messages: [], submissions: 0 };
    const data = await res.json();
    return { messages: data.messages || [], submissions: data.submissions || 0 };
  } catch {
    return { messages: [], submissions: 0 };
  }
}

async function writeRaw(promptId, data) {
  const { put } = await blob();
  await put(PREFIX + promptId + ".json", JSON.stringify(data), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

function relAgo(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 90) return "moments ago";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? "an hour ago" : `${h} hours ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

/** Pick up to n messages for a prompt, blending real ones first, then seeds. */
export async function getSignals(promptId, n = 7) {
  if (!VALID.has(promptId)) promptId = [...VALID][0];
  const { messages, submissions } = await readRaw(promptId);

  const real = messages
    .slice(-60)
    .map((mm) => ({ id: mm.id, text: mm.text, ago: relAgo(mm.ts), real: true }));
  // shuffle real, then top up from seeds (which are timeless)
  shuffle(real);

  const seeds = SEEDS[promptId].map((text, i) => ({
    id: "seed-" + i, text, ago: seedAgo(i, promptId), real: false,
  }));
  shuffle(seeds);

  const picked = [...real, ...seeds].slice(0, Math.max(3, Math.min(14, n)));
  return { messages: picked, count: baselineCount(promptId) + submissions };
}

/** Persist a moderated message. Returns { id, persisted }. */
export async function addSignal(promptId, text) {
  if (!VALID.has(promptId)) promptId = [...VALID][0];
  const ts = Date.now();
  const id = signalId(text, ts);
  if (!hasBlob()) return { id, persisted: false };

  const data = await readRaw(promptId);
  // dedupe identical text from the recent window
  if (!data.messages.some((m) => m.text === text)) {
    data.messages.push({ id, text, ts });
    if (data.messages.length > MAX_PER_PROMPT)
      data.messages = data.messages.slice(-MAX_PER_PROMPT);
  }
  data.submissions = (data.submissions || 0) + 1;
  try { await writeRaw(promptId, data); return { id, persisted: true }; }
  catch { return { id, persisted: false }; }
}

/** Remove a reported message by id. Returns { removed }. */
export async function removeSignal(promptId, id) {
  if (!hasBlob() || !VALID.has(promptId)) return { removed: false };
  const data = await readRaw(promptId);
  const before = data.messages.length;
  data.messages = data.messages.filter((m) => m.id !== id);
  if (data.messages.length === before) return { removed: false };
  try { await writeRaw(promptId, data); return { removed: true }; }
  catch { return { removed: false }; }
}

// deterministic-ish variety for seed timestamps
function seedAgo(i, promptId) {
  const opts = ["4 minutes ago", "26 minutes ago", "an hour ago", "2 hours ago", "5 hours ago", "last night", "yesterday", "3 days ago"];
  return opts[(hashStr(promptId) + i * 7) % opts.length];
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
