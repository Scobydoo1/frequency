/* Friendships — formed from real encounters.
 * GET  /api/friends → { friends:[{callsign,lastSignal,lastTunedDay}], requests:[{from,t}] }
 * POST /api/friends { action: "request"|"accept"|"decline"|"remove", to?|from?|friend? }
 * All routes require a session cookie. */
import { Router } from "express";
import { sessionFromReq, validateCallsign } from "../lib/auth.js";
import {
  getSocial, sendFriendRequest, acceptFriendRequest,
  declineFriendRequest, removeFriend,
} from "../lib/store.js";

const router = Router();

router.use((req, res, next) => {
  const me = sessionFromReq(req, process.env.SESSION_SECRET);
  if (!me) return res.status(401).json({ ok: false, reason: "sign in first" });
  req.me = me;
  next();
});

router.get("/", async (req, res) => {
  res.json(await getSocial(req.me));
});

router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    const other = validateCallsign(body.to || body.from || body.friend || "");
    if (!other.ok) return res.json({ ok: false, reason: "bad callsign" });

    switch (body.action) {
      case "request": return res.json(await sendFriendRequest(req.me, other.callsign));
      case "accept":  return res.json(await acceptFriendRequest(req.me, other.callsign));
      case "decline": return res.json(await declineFriendRequest(req.me, other.callsign));
      case "remove":  return res.json(await removeFriend(req.me, other.callsign));
      default: return res.json({ ok: false, reason: "unknown action" });
    }
  } catch {
    res.json({ ok: false, reason: "unavailable" });
  }
});

export default router;
