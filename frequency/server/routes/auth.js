/* Callsign accounts, with Google as an alternate sign-in / recovery path.
 *
 * GET  /api/auth → { user: { callsign } | null, available, googleEnabled }
 * POST /api/auth { action: "register"|"login"|"logout", callsign?, password? }
 *
 * POST /api/auth/google           { idToken } → logs in if the Google account
 *   is already linked, else { ok:true, needsCallsign:true, pendingToken }
 * POST /api/auth/google/complete  { pendingToken, callsign } → creates the
 *   account (no password) and logs in
 * POST /api/auth/google/link      { idToken } → links Google to the signed-in
 *   callsign, for later password recovery (requires a session)
 * POST /api/auth/recover          { idToken, newPassword } → verified Google
 *   identity sets a fresh password on its linked callsign and logs in
 *
 * The callsign is always the public identity. A Google email is stored only
 * to resolve sign-in/recovery and is never returned by any API response. */
import { Router } from "express";
import {
  validateCallsign, validatePassword, hashPassword, verifyPassword,
  signToken, sessionFromReq, setSessionCookie, clearSessionCookie,
  signPendingGoogle, verifyPendingGoogle,
} from "../lib/auth.js";
import {
  accountsAvailable, getUser, createUser, getUserByGoogleSub,
  createUserWithGoogle, linkGoogleToUser, setPassword,
} from "../lib/store.js";
import { verifyGoogleIdToken } from "../lib/google.js";

const router = Router();

router.get("/", (req, res) => {
  const secret = process.env.SESSION_SECRET;
  const callsign = secret ? sessionFromReq(req, secret) : null;
  res.json({
    user: callsign ? { callsign } : null,
    available: !!secret && accountsAvailable(),
    googleEnabled: !!process.env.GOOGLE_CLIENT_ID,
  });
});

router.post("/", async (req, res) => {
  const secret = process.env.SESSION_SECRET;
  try {
    const body = req.body || {};

    if (body.action === "logout") {
      clearSessionCookie(res);
      return res.json({ ok: true });
    }

    if (!secret || !accountsAvailable())
      return res.json({ ok: false, reason: "accounts unavailable" });

    const cs = validateCallsign(body.callsign);
    if (!cs.ok) return res.json(cs);
    const pw = validatePassword(body.password);
    if (!pw.ok) return res.json(pw);

    if (body.action === "register") {
      const { salt, hash } = hashPassword(body.password);
      const made = await createUser(cs.callsign, salt, hash);
      if (!made.ok) return res.json(made);
      setSessionCookie(res, signToken(cs.callsign, secret));
      return res.json({ ok: true, user: { callsign: cs.callsign } });
    }

    if (body.action === "login") {
      const u = await getUser(cs.callsign);
      if (!u || !u.hash || !verifyPassword(body.password, u.salt, u.hash))
        return res.json({ ok: false, reason: "wrong callsign or password" });
      setSessionCookie(res, signToken(cs.callsign, secret));
      return res.json({ ok: true, user: { callsign: cs.callsign } });
    }

    return res.json({ ok: false, reason: "unknown action" });
  } catch {
    return res.json({ ok: false, reason: "unavailable" });
  }
});

router.post("/google", async (req, res) => {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !accountsAvailable())
    return res.json({ ok: false, reason: "accounts unavailable" });

  const verdict = await verifyGoogleIdToken(req.body?.idToken);
  if (!verdict.ok) return res.json(verdict);

  const existing = await getUserByGoogleSub(verdict.sub);
  if (existing) {
    setSessionCookie(res, signToken(existing.callsign, secret));
    return res.json({ ok: true, user: { callsign: existing.callsign } });
  }

  const pendingToken = signPendingGoogle(verdict.sub, verdict.email, secret);
  return res.json({ ok: true, needsCallsign: true, pendingToken });
});

router.post("/google/complete", async (req, res) => {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !accountsAvailable())
    return res.json({ ok: false, reason: "accounts unavailable" });

  const pending = verifyPendingGoogle(req.body?.pendingToken, secret);
  if (!pending) return res.json({ ok: false, reason: "that Google sign-in expired, try again" });

  const cs = validateCallsign(req.body?.callsign);
  if (!cs.ok) return res.json(cs);

  const made = await createUserWithGoogle(cs.callsign, pending.sub, pending.email);
  if (!made.ok) return res.json(made);
  setSessionCookie(res, signToken(cs.callsign, secret));
  return res.json({ ok: true, user: { callsign: cs.callsign } });
});

router.post("/google/link", async (req, res) => {
  const secret = process.env.SESSION_SECRET;
  const me = secret ? sessionFromReq(req, secret) : null;
  if (!me) return res.status(401).json({ ok: false, reason: "sign in first" });

  const verdict = await verifyGoogleIdToken(req.body?.idToken);
  if (!verdict.ok) return res.json(verdict);

  return res.json(await linkGoogleToUser(me, verdict.sub, verdict.email));
});

router.post("/recover", async (req, res) => {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !accountsAvailable())
    return res.json({ ok: false, reason: "accounts unavailable" });

  const verdict = await verifyGoogleIdToken(req.body?.idToken);
  if (!verdict.ok) return res.json(verdict);

  const pw = validatePassword(req.body?.newPassword);
  if (!pw.ok) return res.json(pw);

  const existing = await getUserByGoogleSub(verdict.sub);
  if (!existing) return res.json({ ok: false, reason: "no callsign is linked to that Google account" });

  const { salt, hash } = hashPassword(req.body.newPassword);
  await setPassword(existing.callsign, salt, hash);
  setSessionCookie(res, signToken(existing.callsign, secret));
  return res.json({ ok: true, user: { callsign: existing.callsign } });
});

export default router;
