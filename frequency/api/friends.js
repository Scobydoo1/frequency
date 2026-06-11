/* Friendships — formed from real encounters.
 * GET  /api/friends → { friends:[{callsign,lastSignal,lastTunedDay}], requests:[{from,t}] }
 * POST /api/friends { action: "request"|"accept"|"decline"|"remove", to?|from?|friend? }
 * All routes require a session cookie. */
import { sessionFromReq, validateCallsign } from "./_lib/auth.js";
import {
  getSocial, sendFriendRequest, acceptFriendRequest,
  declineFriendRequest, removeFriend,
} from "./_lib/store.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const me = sessionFromReq(req, process.env.SESSION_SECRET);
  if (!me) return res.status(401).json({ ok: false, reason: "sign in first" });

  try {
    if (req.method === "GET") {
      return res.status(200).json(await getSocial(me));
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "method not allowed" });
    }

    const body = await readBody(req);
    const other = validateCallsign(body.to || body.from || body.friend || "");
    if (!other.ok) return res.status(200).json({ ok: false, reason: "bad callsign" });

    switch (body.action) {
      case "request": return res.status(200).json(await sendFriendRequest(me, other.callsign));
      case "accept":  return res.status(200).json(await acceptFriendRequest(me, other.callsign));
      case "decline": return res.status(200).json(await declineFriendRequest(me, other.callsign));
      case "remove":  return res.status(200).json(await removeFriend(me, other.callsign));
      default: return res.status(200).json({ ok: false, reason: "unknown action" });
    }
  } catch {
    return res.status(200).json({ ok: false, reason: "unavailable" });
  }
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
