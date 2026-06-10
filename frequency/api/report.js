/* POST /api/report  { prompt, id }  → { ok }
 * Removes a reported stranger message. No-op (still ok) when storage isn't wired
 * or the id is a curated seed. */
import { removeSignal } from "./_lib/store.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }
  try {
    const body = await readBody(req);
    if (typeof body.id === "string" && body.id.startsWith("seed-"))
      return res.status(200).json({ ok: true, removed: false });
    const { removed } = await removeSignal(body.prompt, body.id);
    return res.status(200).json({ ok: true, removed });
  } catch {
    return res.status(200).json({ ok: true, removed: false });
  }
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
