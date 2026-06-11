/* Frontend API client. Talks to /api/signals + /api/report, with a hard timeout
 * and a graceful local fallback so the game is fully playable even when the
 * backend is unreachable (offline, or static-only hosting). */
import { PROMPTS, agoFor, fmtCount, seededInt } from "./content.js";

const TIMEOUT_MS = 4000;

async function withTimeout(promise, ms) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try { return await promise(ctrl.signal); }
  finally { clearTimeout(id); }
}

/* Local fallback mirrors the server's curated payload shape. */
function localSignals(prompt, n) {
  const seed = Math.floor(Math.random() * 1e6) + 1;
  const pool = [...prompt.messages];
  const out = [];
  let s = seed;
  while (pool.length && out.length < Math.max(3, Math.min(14, n))) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const text = pool.splice(s % pool.length, 1)[0];
    out.push({
      id: "seed-local", text, name: null,
      ago: agoFor(out.length, seed),
      ageDays: seededInt(seed + out.length * 13, 0, 300) / 100, // 0–3 days
      real: false,
    });
  }
  return {
    messages: out,
    count: 900 + seededInt(prompt.id.length + seed, 120, 1800),
    offline: true,
  };
}

export async function fetchSignals(prompt, n = 7) {
  try {
    const data = await withTimeout(
      (signal) => fetch(`/api/signals?prompt=${encodeURIComponent(prompt.id)}&n=${n}`, { signal })
        .then((r) => (r.ok ? r.json() : Promise.reject())),
      TIMEOUT_MS
    );
    if (data && Array.isArray(data.messages) && data.messages.length) return data;
    return localSignals(prompt, n);
  } catch {
    return localSignals(prompt, n);
  }
}

export async function submitSignal(prompt, text, name = null) {
  try {
    return await withTimeout(
      (signal) => fetch("/api/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.id, text, name }),
        signal,
      }).then((r) => r.json()),
      TIMEOUT_MS
    );
  } catch {
    return { ok: true, persisted: false, text, name, offline: true };
  }
}

/** { ok, persisted } — lets the UI show "broadcast: live" vs "echo". */
export async function fetchHealth() {
  try {
    return await withTimeout(
      (signal) => fetch("/api/health", { signal }).then((r) => r.json()),
      TIMEOUT_MS
    );
  } catch {
    return { ok: false, persisted: false };
  }
}

export async function reportSignal(prompt, id) {
  try {
    await withTimeout(
      (signal) => fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.id, id }),
        signal,
      }),
      TIMEOUT_MS
    );
    return true;
  } catch {
    return false;
  }
}

export { fmtCount };
