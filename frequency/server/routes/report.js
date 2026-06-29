/* POST /api/report  { prompt, id }  → { ok }
 * Removes a reported stranger message. No-op (still ok) when storage isn't
 * wired or the id is a curated seed. */
import { Router } from "express";
import { removeSignal } from "../lib/store.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    if (typeof body.id === "string" && body.id.startsWith("seed-"))
      return res.json({ ok: true, removed: false });
    const { removed } = await removeSignal(body.prompt, body.id);
    res.json({ ok: true, removed });
  } catch {
    res.json({ ok: true, removed: false });
  }
});

export default router;
