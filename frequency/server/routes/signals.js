/* GET  /api/signals?prompt=<id>&n=7  → { messages:[{id,text,name,ago,ageDays,real}], count }
 * POST /api/signals  { prompt, text, showName? }  → { ok, id, persisted, name } | { ok:false, reason }
 *   Identity is server-resolved: showName=true attaches the session's callsign.
 *   Guests (no session) always post anonymously — impersonation is impossible.
 * POST /api/signals/found { prompt, id } → { ok }  a reveal happened; echo it
 *   back to the author (self-finds don't count, seeds are ignored).
 * GET  /api/signals/mine → { echoes:[{id,promptId,text,ago,found,news}], news }
 * POST /api/signals/mine/seen → { ok }  both require a session cookie. */
import { Router } from "express";
import {
  getSignals, addSignal, touchUser,
  recordFound, getEchoes, markEchoesSeen,
} from "../lib/store.js";
import { moderate } from "../lib/moderation.js";
import { sessionFromReq } from "../lib/auth.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const prompt = req.query.prompt || "letgo";
    const n = parseInt(req.query.n || "7", 10) || 7;
    res.json(await getSignals(prompt, n));
  } catch {
    res.json({ messages: [], count: 0, error: "unavailable" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    const verdict = moderate(body.text);
    if (!verdict.ok) return res.json({ ok: false, reason: verdict.reason });
    const callsign = sessionFromReq(req, process.env.SESSION_SECRET);
    const name = body.showName && callsign ? callsign : null;
    const { id, persisted } = await addSignal(body.prompt, verdict.text, name);
    if (callsign) {
      // anonymous posts stay anonymous everywhere: friends see your last
      // *signed* signal only; presence (last tuned) updates either way
      await touchUser(callsign, name ? { text: verdict.text, promptId: body.prompt, t: Date.now() } : null);
    }
    res.json({ ok: true, id, persisted, text: verdict.text, name });
  } catch {
    res.json({ ok: false, reason: "unavailable" });
  }
});

router.post("/found", async (req, res) => {
  try {
    const { prompt, id } = req.body || {};
    if (typeof id !== "string" || !id || id.startsWith("seed-"))
      return res.json({ ok: false });
    const finder = sessionFromReq(req, process.env.SESSION_SECRET);
    res.json(await recordFound(prompt, id, finder));
  } catch {
    res.json({ ok: false });
  }
});

router.get("/mine", async (req, res) => {
  const me = sessionFromReq(req, process.env.SESSION_SECRET);
  if (!me) return res.status(401).json({ ok: false, reason: "sign in first" });
  res.json(await getEchoes(me));
});

router.post("/mine/seen", async (req, res) => {
  const me = sessionFromReq(req, process.env.SESSION_SECRET);
  if (!me) return res.status(401).json({ ok: false, reason: "sign in first" });
  res.json(await markEchoesSeen(me));
});

export default router;
