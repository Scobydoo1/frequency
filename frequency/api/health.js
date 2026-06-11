/* GET /api/health → { ok: true, persisted: boolean }
 * persisted=true means the Blob store is connected AND reachable (probed),
 * so real messages survive. The intro renders this as
 * "broadcast: live" vs "broadcast: echo". */
import { isPersisted } from "./_lib/store.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: true, persisted: await isPersisted() });
}
