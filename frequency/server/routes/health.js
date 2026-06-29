/* GET /api/health → { ok: true, persisted: boolean }
 * persisted=true means Postgres is connected AND reachable (probed), so real
 * messages survive. The intro renders this as "broadcast: live" vs "echo". */
import { Router } from "express";
import { isPersisted } from "../lib/store.js";

const router = Router();

router.get("/", async (req, res) => {
  res.json({ ok: true, persisted: await isPersisted() });
});

export default router;
