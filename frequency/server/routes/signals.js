/* GET  /api/signals?prompt=<id>&n=7  → { messages:[{id,text,name,ago,ageDays,real}], count }
 * POST /api/signals  { prompt, text, showName? }  → { ok, id, persisted, name } | { ok:false, reason }
 *   Identity is server-resolved: showName=true attaches the session's callsign.
 *   Guests (no session) always post anonymously — impersonation is impossible. */
import { Router } from "express";
import { getSignals, addSignal, touchUser } from "../lib/store.js";
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

export default router;
