/* Callsign auth: scrypt password hashing, HMAC cookie sessions, validation.
 * Pure node:crypto — no dependencies, unit-tested in tests/auth.test.js.
 * No email, no recovery: a callsign is a radio identity, not an inbox. */
import crypto from "node:crypto";

export const CALLSIGN_RE = /^[a-z0-9_-]{3,16}$/;
export const RESERVED = new Set([
  "admin", "administrator", "mod", "moderator", "system",
  "frequency", "stranger", "anonymous", "operator", "radio",
]);

// the same hostility list moderation uses for messages
const BLOCK_WORDS = [
  "fuck", "shit", "bitch", "cunt", "nigger", "faggot", "retard", "kys",
];

/** { ok:true, callsign } (normalized lowercase) or { ok:false, reason }. */
export function validateCallsign(raw) {
  if (typeof raw !== "string") return { ok: false, reason: "callsign required" };
  const callsign = raw.trim().toLowerCase();
  if (!CALLSIGN_RE.test(callsign))
    return { ok: false, reason: "3–16 chars: a-z, 0-9, _ or -" };
  if (RESERVED.has(callsign)) return { ok: false, reason: "that callsign is reserved" };
  if (BLOCK_WORDS.some((w) => callsign.includes(w)))
    return { ok: false, reason: "pick a kinder callsign" };
  return { ok: true, callsign };
}

export function validatePassword(raw) {
  if (typeof raw !== "string" || raw.length < 6)
    return { ok: false, reason: "password needs at least 6 characters" };
  if (raw.length > 72) return { ok: false, reason: "password too long" };
  return { ok: true };
}

/* ---------- password hashing ---------- */

export function hashPassword(password, saltHex = null) {
  const salt = saltHex ? Buffer.from(saltHex, "hex") : crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 32);
  return { salt: salt.toString("hex"), hash: hash.toString("hex") };
}

export function verifyPassword(password, saltHex, hashHex) {
  try {
    const got = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), 32);
    return crypto.timingSafeEqual(got, Buffer.from(hashHex, "hex"));
  } catch {
    return false;
  }
}

/* ---------- session tokens (HMAC, base64url) ---------- */

const b64u = (buf) => Buffer.from(buf).toString("base64url");

export function signToken(callsign, secret, ttlMs = 30 * 86400000, now = Date.now()) {
  const payload = b64u(JSON.stringify({ c: callsign, exp: now + ttlMs }));
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/** Returns the callsign, or null if invalid/expired/tampered. */
export function verifyToken(token, secret, now = Date.now()) {
  try {
    const [payload, sig] = String(token).split(".");
    if (!payload || !sig) return null;
    const want = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
    const a = Buffer.from(sig), b = Buffer.from(want);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.c !== "string" || typeof data.exp !== "number") return null;
    if (now > data.exp) return null;
    return data.c;
  } catch {
    return null;
  }
}

/* ---------- request/response plumbing ---------- */

export const COOKIE = "freq_session";

export function sessionFromReq(req, secret) {
  if (!secret) return null;
  const raw = req.headers?.cookie || "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? verifyToken(decodeURIComponent(m[1]), secret) : null;
}

export function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 86400}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}
