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
    given: entry.given,
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
