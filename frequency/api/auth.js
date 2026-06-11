/* Callsign accounts.
 * GET  /api/auth → { user: { callsign } | null, available: boolean }
 * POST /api/auth { action: "register"|"login"|"logout", callsign?, password? }
 *   → { ok, user? } | { ok:false, reason }
 * No email, no recovery. Sessions are HMAC cookies (30 days). */
import {
  validateCallsign, validatePassword, hashPassword, verifyPassword,
  signToken, sessionFromReq, setSessionCookie, clearSessionCookie,
} from "./_lib/auth.js";
import { accountsAvailable, getUser, createUser } from "./_lib/store.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const secret = process.env.SESSION_SECRET;

  try {
    if (req.method === "GET") {
      const callsign = secret ? sessionFromReq(req, secret) : null;
      return res.status(200).json({
        user: callsign ? { callsign } : null,
        available: !!secret && accountsAvailable(),
      });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "method not allowed" });
    }

    const body = await readBody(req);

    if (body.action === "logout") {
      clearSessionCookie(res);
      return res.status(200).json({ ok: true });
    }

    if (!secret || !accountsAvailable())
      return res.status(200).json({ ok: false, reason: "accounts unavailable" });

    const cs = validateCallsign(body.callsign);
    if (!cs.ok) return res.status(200).json(cs);
    const pw = validatePassword(body.password);
    if (!pw.ok) return res.status(200).json(pw);

    if (body.action === "register") {
      const { salt, hash } = hashPassword(body.password);
      const made = await createUser(cs.callsign, salt, hash);
      if (!made.ok) return res.status(200).json(made);
      setSessionCookie(res, signToken(cs.callsign, secret));
      return res.status(200).json({ ok: true, user: { callsign: cs.callsign } });
    }

    if (body.action === "login") {
      const u = await getUser(cs.callsign);
      if (!u || !verifyPassword(body.password, u.salt, u.hash))
        return res.status(200).json({ ok: false, reason: "wrong callsign or password" });
      setSessionCookie(res, signToken(cs.callsign, secret));
      return res.status(200).json({ ok: true, user: { callsign: cs.callsign } });
    }

    return res.status(200).json({ ok: false, reason: "unknown action" });
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
