/* Constellation journal — a private local record of the encounters you've had.
 * Stored in localStorage; never leaves the device. */
const KEY = "frequency.journal.v1";
const MAX = 50;

export function loadJournal() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; }
  catch { return []; }
}

export function addEncounter(entry) {
  const list = loadJournal();
  list.unshift({
    promptLabel: entry.promptLabel,
    received: entry.received,
    receivedName: entry.receivedName || null,
    given: entry.given,
    givenName: entry.givenName || null,
    freq: entry.freq || null, // the FM reading at the moment of lock
    ts: Date.now(),
  });
  const trimmed = list.slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(trimmed)); } catch { /* quota — ignore */ }
  return trimmed;
}

export function clearJournal() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  return [];
}

export function formatWhen(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Deterministic star position for an entry on the sky map (0..1 coords). */
export function starPosition(entry, i) {
  let h = (entry.ts || i + 1) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = h >>> 0;
  const x = 0.08 + (h % 1000) / 1000 * 0.84;
  h = Math.imul(h ^ (h >>> 11), 0xc2b2ae35) >>> 0;
  const y = 0.12 + (h % 1000) / 1000 * 0.72;
  return { x, y };
}
