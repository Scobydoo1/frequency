/* Frontend client for accounts + friends. Cookie-based sessions; every call
 * fails soft so the game stays playable when the backend is unreachable. */
const TIMEOUT_MS = 5000;
// Backend is a separate origin (Render) in production.
const API_BASE = import.meta.env.VITE_API_URL || "";

async function call(path, opts = {}) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      signal: ctrl.signal,
      ...opts,
    });
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

/** { user: {callsign}|null, available: boolean, googleEnabled: boolean } */
export async function me() {
  return (await call("/api/auth")) || { user: null, available: false, googleEnabled: false };
}

export async function register(callsign, password) {
  return (await call("/api/auth", {
    method: "POST",
    body: JSON.stringify({ action: "register", callsign, password }),
  })) || { ok: false, reason: "unreachable" };
}

export async function login(callsign, password) {
  return (await call("/api/auth", {
    method: "POST",
    body: JSON.stringify({ action: "login", callsign, password }),
  })) || { ok: false, reason: "unreachable" };
}

export async function logout() {
  return (await call("/api/auth", {
    method: "POST",
    body: JSON.stringify({ action: "logout" }),
  })) || { ok: true };
}

/* ---------- Google: alternate sign-in / account recovery -----------
 * The callsign stays the public identity; Google only resolves *which*
 * callsign you are. See server/routes/auth.js for the full flow. */

/** { ok, user } | { ok:true, needsCallsign:true, pendingToken } | { ok:false, reason } */
export async function loginWithGoogle(idToken) {
  return (await call("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  })) || { ok: false, reason: "unreachable" };
}

/** Finishes signup for a brand-new Google identity by picking a callsign. */
export async function completeGoogleSignup(pendingToken, callsign) {
  return (await call("/api/auth/google/complete", {
    method: "POST",
    body: JSON.stringify({ pendingToken, callsign }),
  })) || { ok: false, reason: "unreachable" };
}

/** Links Google to the signed-in callsign, enabling recovery later. */
export async function linkGoogle(idToken) {
  return (await call("/api/auth/google/link", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  })) || { ok: false, reason: "unreachable" };
}

/** Forgot your password? A verified Google identity sets a new one. */
export async function recoverWithGoogle(idToken, newPassword) {
  return (await call("/api/auth/recover", {
    method: "POST",
    body: JSON.stringify({ idToken, newPassword }),
  })) || { ok: false, reason: "unreachable" };
}

/* ---------- echoes: your broadcast history + who found it ---------- */

/** { echoes:[{id,promptId,text,ago,found,news}], news } — the signals you
 *  signed and how many strangers found each. news = unread finds. */
export async function getEchoes() {
  const r = await call("/api/signals/mine");
  return r && Array.isArray(r.echoes) ? r : { echoes: [], news: 0 };
}

/** Acknowledge every echo (clears the "new" badge). */
export async function markEchoesSeen() {
  return (await call("/api/signals/mine/seen", { method: "POST", body: "{}" })) || { ok: false };
}

/** { friends: [...], requests: [...] } */
export async function getFriends() {
  const r = await call("/api/friends");
  return r && Array.isArray(r.friends) ? r : { friends: [], requests: [] };
}

export async function friendAction(action, callsign) {
  return (await call("/api/friends", {
    method: "POST",
    body: JSON.stringify({ action, to: callsign, from: callsign, friend: callsign }),
  })) || { ok: false, reason: "unreachable" };
}

export function lastTunedLabel(lastTunedDay) {
  if (lastTunedDay == null) return "hasn't tuned in yet";
  const today = Math.floor(Date.now() / 86400000);
  const d = today - lastTunedDay;
  if (d <= 0) return "tuned in tonight";
  if (d === 1) return "tuned in last night";
  return `tuned in ${d} nights ago`;
}
