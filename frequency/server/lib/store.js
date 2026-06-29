/* Signal store — persists strangers' messages, accounts and friendships.
 *
 * Backed by Postgres (Neon) via DATABASE_URL. When it isn't set — local dev
 * without env — every function degrades gracefully: reads return the curated
 * seed messages, writes are accepted but not persisted. The app is always
 * playable, same invariant as the old Vercel Blob adapter this replaces. */
import { getPool } from "../db.js";
import { SEEDS } from "./seeds.js";
import { signalId } from "./moderation.js";

const MAX_PER_PROMPT = 500; // keep the newest N real messages per prompt
const VALID = new Set(Object.keys(SEEDS));

const hasDb = () => !!process.env.DATABASE_URL;

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

/** True only if the DB is actually reachable. */
export async function isPersisted() {
  if (!hasDb()) return false;
  try {
    await getPool().query("select 1");
    return true;
  } catch {
    return false;
  }
}

/** Pick up to n messages for a prompt, blending real ones first, then seeds. */
export async function getSignals(promptId, n = 7) {
  if (!VALID.has(promptId)) promptId = [...VALID][0];

  let real = [];
  let submissions = 0;
  if (hasDb()) {
    try {
      const pool = getPool();
      const [rows, counter] = await Promise.all([
        pool.query(
          "select id, text, name, ts from signals where prompt_id = $1 order by ts desc limit 60",
          [promptId]
        ),
        pool.query("select submissions from prompt_counters where prompt_id = $1", [promptId]),
      ]);
      submissions = counter.rows[0]?.submissions || 0;
      real = rows.rows.map((mm) => ({
        id: mm.id, text: mm.text, name: mm.name || null,
        ago: relAgo(Number(mm.ts)),
        ageDays: Math.max(0, (Date.now() - Number(mm.ts)) / 86400000),
        real: true,
      }));
    } catch { /* fall through to seeds-only */ }
  }
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
  if (!hasDb()) return { id, persisted: false };

  try {
    const pool = getPool();
    const dup = await pool.query(
      "select 1 from signals where prompt_id = $1 and text = $2 limit 1",
      [promptId, text]
    );
    if (!dup.rows.length) {
      await pool.query(
        "insert into signals (id, prompt_id, text, name, ts) values ($1,$2,$3,$4,$5)",
        [id, promptId, text, name || null, ts]
      );
      // trim to the newest MAX_PER_PROMPT for this prompt
      await pool.query(
        `delete from signals where prompt_id = $1 and id not in (
           select id from signals where prompt_id = $1 order by ts desc limit $2
         )`,
        [promptId, MAX_PER_PROMPT]
      );
    }
    await pool.query(
      `insert into prompt_counters (prompt_id, submissions) values ($1, 1)
       on conflict (prompt_id) do update set submissions = prompt_counters.submissions + 1`,
      [promptId]
    );
    return { id, persisted: true };
  } catch {
    return { id, persisted: false };
  }
}

/** Remove a reported message by id. Returns { removed }. */
export async function removeSignal(promptId, id) {
  if (!hasDb() || !VALID.has(promptId)) return { removed: false };
  try {
    const res = await getPool().query(
      "delete from signals where prompt_id = $1 and id = $2",
      [promptId, id]
    );
    return { removed: res.rowCount > 0 };
  } catch {
    return { removed: false };
  }
}

/* ---------------- users & friendships (v5 social layer) ---------------- */

export const accountsAvailable = () => hasDb();

function toUser(row) {
  if (!row) return null;
  return {
    callsign: row.callsign,
    salt: row.password_salt,
    hash: row.password_hash,
    googleSub: row.google_sub,
    lastSignal: row.last_signal_text
      ? { text: row.last_signal_text, promptId: row.last_signal_prompt, t: Number(row.last_signal_at) }
      : null,
    lastTunedDay: row.last_tuned_day,
  };
}

export async function getUser(callsign) {
  if (!hasDb()) return null;
  const res = await getPool().query("select * from users where callsign = $1", [callsign]);
  return toUser(res.rows[0]);
}

export async function getUserByGoogleSub(sub) {
  if (!hasDb()) return null;
  const res = await getPool().query("select * from users where google_sub = $1", [sub]);
  return toUser(res.rows[0]);
}

/** Create if absent. Returns { ok } | { ok:false, reason }. */
export async function createUser(callsign, salt, hash) {
  if (!hasDb()) return { ok: false, reason: "accounts unavailable" };
  if (await getUser(callsign)) return { ok: false, reason: "that callsign is taken" };
  await getPool().query(
    "insert into users (callsign, password_salt, password_hash) values ($1,$2,$3)",
    [callsign, salt, hash]
  );
  return { ok: true };
}

/** Create a new account from a verified Google identity (no password). */
export async function createUserWithGoogle(callsign, sub, email) {
  if (!hasDb()) return { ok: false, reason: "accounts unavailable" };
  if (await getUser(callsign)) return { ok: false, reason: "that callsign is taken" };
  if (await getUserByGoogleSub(sub)) return { ok: false, reason: "that Google account is already linked" };
  await getPool().query(
    "insert into users (callsign, google_sub, google_email) values ($1,$2,$3)",
    [callsign, sub, email || null]
  );
  return { ok: true };
}

/** Link a verified Google identity to the currently-signed-in callsign. */
export async function linkGoogleToUser(callsign, sub, email) {
  if (!hasDb()) return { ok: false, reason: "accounts unavailable" };
  const existing = await getUserByGoogleSub(sub);
  if (existing && existing.callsign !== callsign)
    return { ok: false, reason: "that Google account is already linked to another callsign" };
  await getPool().query(
    "update users set google_sub = $2, google_email = $3 where callsign = $1",
    [callsign, sub, email || null]
  );
  return { ok: true };
}

/** Used by the Google-recovery flow to set a fresh password. */
export async function setPassword(callsign, salt, hash) {
  if (!hasDb()) return { ok: false, reason: "accounts unavailable" };
  await getPool().query(
    "update users set password_salt = $2, password_hash = $3 where callsign = $1",
    [callsign, salt, hash]
  );
  return { ok: true };
}

/** Owner-only update of presence info after a post. Best-effort. */
export async function touchUser(callsign, lastSignal) {
  if (!hasDb()) return;
  try {
    const day = Math.floor(Date.now() / 86400000);
    if (lastSignal) {
      await getPool().query(
        `update users set last_tuned_day = $2,
           last_signal_text = $3, last_signal_prompt = $4, last_signal_at = $5
         where callsign = $1`,
        [callsign, day, lastSignal.text, lastSignal.promptId, lastSignal.t]
      );
    } else {
      await getPool().query("update users set last_tuned_day = $2 where callsign = $1", [callsign, day]);
    }
  } catch { /* presence is best-effort */ }
}

export async function sendFriendRequest(from, to) {
  if (!hasDb()) return { ok: false, reason: "unavailable" };
  if (from === to) return { ok: false, reason: "that's your own signal" };
  const pool = getPool();
  if (!(await getUser(to))) return { ok: false, reason: "no such callsign" };
  const already = await pool.query(
    "select 1 from friendships where owner_callsign = $1 and friend_callsign = $2",
    [from, to]
  );
  if (already.rows.length) return { ok: false, reason: "already friends" };
  const sentToMe = await pool.query(
    "select 1 from friend_requests where to_callsign = $1 and from_callsign = $2",
    [to, from]
  );
  if (sentToMe.rows.length) return { ok: false, reason: "request already sent" };
  // if they already asked *you*, accept instead of double-requesting
  const theyAskedMe = await pool.query(
    "select 1 from friend_requests where to_callsign = $1 and from_callsign = $2",
    [from, to]
  );
  if (theyAskedMe.rows.length) return acceptFriendRequest(from, to);
  await pool.query(
    "insert into friend_requests (to_callsign, from_callsign) values ($1,$2) on conflict do nothing",
    [to, from]
  );
  return { ok: true, sent: true };
}

export async function acceptFriendRequest(me, from) {
  if (!hasDb()) return { ok: false, reason: "unavailable" };
  const pool = getPool();
  await pool.query(
    `insert into friendships (owner_callsign, friend_callsign) values ($1,$2), ($2,$1)
     on conflict do nothing`,
    [me, from]
  );
  await pool.query(
    "delete from friend_requests where to_callsign = $1 and from_callsign = $2",
    [me, from]
  );
  return { ok: true, accepted: true };
}

export async function declineFriendRequest(me, from) {
  if (!hasDb()) return { ok: false, reason: "unavailable" };
  await getPool().query(
    "delete from friend_requests where to_callsign = $1 and from_callsign = $2",
    [me, from]
  );
  return { ok: true };
}

export async function removeFriend(me, friend) {
  if (!hasDb()) return { ok: false, reason: "unavailable" };
  await getPool().query(
    `delete from friendships where (owner_callsign = $1 and friend_callsign = $2)
        or (owner_callsign = $2 and friend_callsign = $1)`,
    [me, friend]
  );
  return { ok: true };
}

/** Friends with presence, plus the pending request inbox. */
export async function getSocial(me) {
  if (!hasDb()) return { friends: [], requests: [] };
  try {
    const pool = getPool();
    const [fr, rq] = await Promise.all([
      pool.query(
        `select u.callsign, u.last_signal_text, u.last_signal_prompt, u.last_signal_at, u.last_tuned_day
         from friendships f join users u on u.callsign = f.friend_callsign
         where f.owner_callsign = $1`,
        [me]
      ),
      pool.query(
        "select from_callsign, created_at from friend_requests where to_callsign = $1",
        [me]
      ),
    ]);
    const friends = fr.rows.map((u) => ({
      callsign: u.callsign,
      lastSignal: u.last_signal_text
        ? { text: u.last_signal_text, promptId: u.last_signal_prompt, t: Number(u.last_signal_at) }
        : null,
      lastTunedDay: u.last_tuned_day,
    }));
    const requests = rq.rows.map((r) => ({ from: r.from_callsign, t: r.created_at.getTime() }));
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
