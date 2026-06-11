/* Frontend client for accounts + friends. Cookie-based sessions; every call
 * fails soft so the game stays playable when the backend is unreachable. */
const TIMEOUT_MS = 5000;

async function call(url, opts = {}) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
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

/** { user: {callsign}|null, available: boolean } */
export async function me() {
  return (await call("/api/auth")) || { user: null, available: false };
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
