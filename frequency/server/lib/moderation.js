/* Moderation + sanitation for stranger signals.
 * Pure functions, no I/O — unit-tested in tests/moderation.test.js.
 * The bar is deliberately gentle: FREQUENCY is about quiet honesty, not policing
 * tone. We block only what would break the spell: empty/spam, contact-info,
 * shouting, links, and a small set of slurs/hostility.
 */

export const MAX_LEN = 90;
export const MIN_LEN = 2;

// crude but effective: links, emails, phone numbers, @handles
const URL_RE = /(https?:\/\/|www\.|\b[a-z0-9.-]+\.(com|net|org|io|co|app|xyz|gg|me)\b)/i;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;
const HANDLE_RE = /(^|\s)@[a-z0-9_]{3,}/i;
// control characters (newlines, tabs, DEL, etc.) — constructor form keeps the
// source pure ASCII so it survives tooling that mangles literal control bytes
const CONTROL_RE = new RegExp("[\\x00-\\x1F\\x7F]+", "g");

// a minimal hostility list — substring match, case-insensitive
const BLOCK_WORDS = [
  "fuck", "shit", "bitch", "cunt", "nigger", "faggot", "retard",
  "kill yourself", "kys", "die in a",
];

export function sanitize(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .replace(CONTROL_RE, " ") // single line, no control chars
    .replace(/\s+/g, " ")     // collapse runs of whitespace
    .trim()
    .slice(0, MAX_LEN);
}

/** Returns { ok: true, text } or { ok: false, reason }. */
export function moderate(raw) {
  const text = sanitize(raw);

  if (text.length < MIN_LEN) return { ok: false, reason: "too short" };

  if (URL_RE.test(text) || EMAIL_RE.test(text) || PHONE_RE.test(text) || HANDLE_RE.test(text))
    return { ok: false, reason: "no contact info or links" };

  const lower = text.toLowerCase();
  if (BLOCK_WORDS.some((w) => lower.includes(w)))
    return { ok: false, reason: "let's keep it kind" };

  // SHOUTING / spam: mostly caps or a single char repeated
  const letters = text.replace(/[^a-z]/gi, "");
  if (letters.length >= 8 && letters === letters.toUpperCase())
    return { ok: false, reason: "no shouting" };
  if (/(.)\1{5,}/.test(text)) return { ok: false, reason: "looks like spam" };

  return { ok: true, text };
}

export const NAME_MAX = 24;

/** Optional signature. Empty is fine (anonymous). Returns
 *  { ok: true, name: string|null } or { ok: false, reason }. */
export function moderateName(raw) {
  if (raw == null || raw === "") return { ok: true, name: null };
  const name = sanitize(raw).slice(0, NAME_MAX);
  if (!name) return { ok: true, name: null };

  if (URL_RE.test(name) || EMAIL_RE.test(name) || PHONE_RE.test(name) || HANDLE_RE.test(name))
    return { ok: false, reason: "names can't carry contact info" };

  const lower = name.toLowerCase();
  if (BLOCK_WORDS.some((w) => lower.includes(w)))
    return { ok: false, reason: "let's keep names kind" };

  return { ok: true, name };
}

/** Stable short id from text + time, for reporting/dedupe. */
export function signalId(text, ts) {
  let h = 2166136261 >>> 0;
  const s = `${text}|${ts}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
