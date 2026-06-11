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

/* Two auth styles: classic read-write token, or the newer store connection
 * (BLOB_STORE_ID injected by Vercel + VERCEL_OIDC_TOKEN provided to functions
 * at runtime; @vercel/blob ≥2 picks both up automatically). */
const hasBlob = () =>
  !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

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

/** True only if the store is actually reachable (probes with a 1-item list). */
export async function isPersisted() {
  if (!hasBlob()) return false;
  try {
    const { list } = await blob();
    await list({ prefix: PREFIX, limit: 1 });
    return true;
  } catch {
    return false;
  }
}

/** Pick up to n messages for a prompt, blending real ones first, then seeds. */
export async function getSignals(promptId, n = 7) {
  if (!VALID.has(promptId)) promptId = [...VALID][0];
  const { messages, submissions } = await readRaw(promptId);

  const real = messages
    .slice(-60)
    .map((mm) => ({
      id: mm.id, text: mm.text, name: mm.name || null,
      ago: relAgo(mm.ts),
      ageDays: Math.max(0, (Date.now() - mm.ts) / 86400000),
      real: true,
    }));
  // shuffle real, then top up from seeds (which are timeless)
  shuffle(real);

  const seeds = SEEDS[promptId].map((text, i) => ({
    id: "seed-" + i, text, name: null,
    ago: seedAgo(i, promptId), ageDays: seedAgeDays(i, promptId), real: false,
  }));
  shuffle(seeds);

  const picked = [...real, ...seeds].slice(0, Math.max(3, Math.min(14, n)));
  return { messages: picked, count: baselineCount(promptId) + submissions };
}

/** Persist a moderated message (name optional, null = anonymous).
 *  Returns { id, persisted }. */
export async function addSignal(promptId, text, name = null) {
  if (!VALID.has(promptId)) promptId = [...VALID][0];
  const ts = Date.now();
  const id = signalId(text, ts);
  if (!hasBlob()) return { id, persisted: false };

  const data = await readRaw(promptId);
  // dedupe identical text from the recent window
  if (!data.messages.some((m) => m.text === text)) {
    data.messages.push({ id, text, name: name || null, ts });
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

/* ---------------- users & friendships (v5 social layer) ----------------
 * Race-safe by construction: every relationship lives at a unique blob path,
 * and a user's blob is written only by its owner. */

const USER_PREFIX = "users/";
const REQ_PREFIX = "freqreq/";    // freqreq/{to}/{from}.json
const FRIEND_PREFIX = "friendsof/"; // friendsof/{me}/{friend}.json (+ mirror)

async function readJsonAt(pathname) {
  try {
    const { list } = await blob();
    const { blobs } = await list({ prefix: pathname, limit: 1 });
    const hit = blobs.find((b) => b.pathname === pathname);
    if (!hit) return null;
    const res = await fetch(hit.url, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function writeJsonAt(pathname, data) {
  const { put } = await blob();
  await put(pathname, JSON.stringify(data), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

async function deleteAt(pathname) {
  try {
    const { del, list } = await blob();
    const { blobs } = await list({ prefix: pathname, limit: 1 });
    const hit = blobs.find((b) => b.pathname === pathname);
    if (hit) await del(hit.url);
    return !!hit;
  } catch {
    return false;
  }
}

export const accountsAvailable = () => hasBlob();

export async function getUser(callsign) {
  if (!hasBlob()) return null;
  return readJsonAt(USER_PREFIX + callsign + ".json");
}

/** Create if absent. Returns { ok } | { ok:false, reason }. */
export async function createUser(callsign, salt, hash) {
  if (!hasBlob()) return { ok: false, reason: "accounts unavailable" };
  if (await getUser(callsign)) return { ok: false, reason: "that callsign is taken" };
  await writeJsonAt(USER_PREFIX + callsign + ".json", {
    callsign, salt, hash,
    createdAt: Date.now(),
    lastSignal: null,
    lastTunedDay: null,
  });
  return { ok: true };
}

/** Owner-only update of presence info after a post. Best-effort. */
export async function touchUser(callsign, lastSignal) {
  try {
    const u = await getUser(callsign);
    if (!u) return;
    u.lastTunedDay = Math.floor(Date.now() / 86400000);
    if (lastSignal) u.lastSignal = lastSignal;
    await writeJsonAt(USER_PREFIX + callsign + ".json", u);
  } catch { /* presence is best-effort */ }
}

export async function sendFriendRequest(from, to) {
  if (!hasBlob()) return { ok: false, reason: "unavailable" };
  if (from === to) return { ok: false, reason: "that's your own signal" };
  if (!(await getUser(to))) return { ok: false, reason: "no such callsign" };
  if (await readJsonAt(`${FRIEND_PREFIX}${from}/${to}.json`))
    return { ok: false, reason: "already friends" };
  if (await readJsonAt(`${REQ_PREFIX}${to}/${from}.json`))
    return { ok: false, reason: "request already sent" };
  // if they already asked *you*, accept instead of double-requesting
  if (await readJsonAt(`${REQ_PREFIX}${from}/${to}.json`))
    return acceptFriendRequest(from, to);
  await writeJsonAt(`${REQ_PREFIX}${to}/${from}.json`, { from, to, t: Date.now() });
  return { ok: true, sent: true };
}

export async function acceptFriendRequest(me, from) {
  if (!hasBlob()) return { ok: false, reason: "unavailable" };
  const t = Date.now();
  await writeJsonAt(`${FRIEND_PREFIX}${me}/${from}.json`, { friend: from, t });
  await writeJsonAt(`${FRIEND_PREFIX}${from}/${me}.json`, { friend: me, t });
  await deleteAt(`${REQ_PREFIX}${me}/${from}.json`);
  return { ok: true, accepted: true };
}

export async function declineFriendRequest(me, from) {
  if (!hasBlob()) return { ok: false, reason: "unavailable" };
  await deleteAt(`${REQ_PREFIX}${me}/${from}.json`);
  return { ok: true };
}

export async function removeFriend(me, friend) {
  if (!hasBlob()) return { ok: false, reason: "unavailable" };
  await deleteAt(`${FRIEND_PREFIX}${me}/${friend}.json`);
  await deleteAt(`${FRIEND_PREFIX}${friend}/${me}.json`);
  return { ok: true };
}

/** Friends with presence, plus the pending request inbox. */
export async function getSocial(me) {
  if (!hasBlob()) return { friends: [], requests: [] };
  try {
    const { list } = await blob();
    const [fr, rq] = await Promise.all([
      list({ prefix: `${FRIEND_PREFIX}${me}/` }),
      list({ prefix: `${REQ_PREFIX}${me}/` }),
    ]);
    const names = fr.blobs.map((b) =>
      b.pathname.slice(`${FRIEND_PREFIX}${me}/`.length).replace(/\.json$/, ""));
    const friends = await Promise.all(names.map(async (n) => {
      const u = await getUser(n);
      return {
        callsign: n,
        lastSignal: u?.lastSignal || null,
        lastTunedDay: u?.lastTunedDay ?? null,
      };
    }));
    const requests = (await Promise.all(rq.blobs.map(async (b) => {
      const res = await fetch(b.url, { cache: "no-store" });
      return res.ok ? await res.json() : null;
    }))).filter(Boolean).map((r) => ({ from: r.from, t: r.t }));
    return { friends, requests };
  } catch {
    return { friends: [], requests: [] };
  }
}

// deterministic-ish variety for seed timestamps; AGE_DAYS mirrors AGO_OPTS
const AGO_OPTS = ["4 minutes ago", "26 minutes ago", "an hour ago", "2 hours ago", "5 hours ago", "last night", "yesterday", "3 days ago"];
const AGE_DAYS = [0.003, 0.018, 0.042, 0.083, 0.21, 0.6, 1, 3];
function seedAgo(i, promptId) {
  return AGO_OPTS[(hashStr(promptId) + i * 7) % AGO_OPTS.length];
}
function seedAgeDays(i, promptId) {
  return AGE_DAYS[(hashStr(promptId) + i * 7) % AGE_DAYS.length];
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
