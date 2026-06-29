/* Callsign auth: scrypt password hashing, HMAC cookie sessions, validation.
 * Pure node:crypto — no dependencies, unit-tested in tests/auth.test.js.
 * Google is an alternate sign-in / recovery path (see lib/google.js) — the
 * callsign stays the only public identity; no email is ever returned by an API. */
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

/* ---------- generic HMAC signed tokens (sessions + short-lived state) ---------- */

const b64u = (buf) => Buffer.from(buf).toString("base64url");

export function signPayload(payload, secret) {
  const data = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

/** Returns the parsed payload, or null if invalid/expired/tampered. */
export function verifyPayload(token, secret, now = Date.now()) {
  try {
    const [data, sig] = String(token).split(".");
    if (!data || !sig) return null;
    const want = crypto.createHmac("sha256", secret).update(data).digest("base64url");
    const a = Buffer.from(sig), b = Buffer.from(want);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(data, "base64url").toString());
    if (typeof payload.exp === "number" && now > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function signToken(callsign, secret, ttlMs = 30 * 86400000, now = Date.now()) {
  return signPayload({ c: callsign, exp: now + ttlMs }, secret);
}

/** Returns the callsign, or null if invalid/expired/tampered. */
export function verifyToken(token, secret, now = Date.now()) {
  const data = verifyPayload(token, secret, now);
  return data && typeof data.c === "string" ? data.c : null;
}

/** Short-lived (5 min) signed state for "verified Google identity, pick a
 *  callsign to finish signup" — carries no password, only sub + email. */
export function signPendingGoogle(sub, email, secret, ttlMs = 5 * 60000) {
  return signPayload({ sub, email: email || null, exp: Date.now() + ttlMs }, secret);
}

export function verifyPendingGoogle(token, secret) {
  const data = verifyPayload(token, secret);
  return data && typeof data.sub === "string" ? data : null;
}

/* ---------- request/response plumbing ---------- */

export const COOKIE = "freq_session";

export function sessionFromReq(req, secret) {
  if (!secret) return null;
  const raw = req.headers?.cookie || "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? verifyToken(decodeURIComponent(m[1]), secret) : null;
}

/* Cross-site by design (frontend on Vercel, API on Render) → SameSite=None.
 * Requires Secure, which is always true since both hosts are HTTPS. */
export function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${30 * 86400}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`);
}
