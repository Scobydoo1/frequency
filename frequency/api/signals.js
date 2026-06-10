/* GET  /api/signals?prompt=<id>&n=7  → { messages:[{id,text,ago,real}], count }
 * POST /api/signals  { prompt, text }  → { ok, id, persisted } | { ok:false, reason }
 *
 * Vercel serverless function (Node runtime). Persists to Vercel Blob when wired,
 * otherwise serves curated seeds — always returns a playable payload.
 */
import { getSignals, addSignal } from "./_lib/store.js";
import { moderate } from "./_lib/moderation.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const url = new URL(req.url, "http://x");
      const prompt = url.searchParams.get("prompt") || "letgo";
      const n = parseInt(url.searchParams.get("n") || "7", 10) || 7;
      const data = await getSignals(prompt, n);
      return res.status(200).json(data);
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const prompt = body.prompt;
      const verdict = moderate(body.text);
      if (!verdict.ok) return res.status(200).json({ ok: false, reason: verdict.reason });
      const { id, persisted } = await addSignal(prompt, verdict.text);
      return res.status(200).json({ ok: true, id, persisted, text: verdict.text });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method not allowed" });
  } catch (err) {
    return res.status(200).json({ messages: [], count: 0, error: "unavailable" });
  }
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
