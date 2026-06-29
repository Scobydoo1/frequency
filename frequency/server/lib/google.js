/* Verifies a Google Identity Services ID token server-side.
 * Google is an *alternate* sign-in / password-recovery path here, not the
 * account model: callsigns stay the only public identity (see auth.js). */
import { OAuth2Client } from "google-auth-library";

let client = null;

/** { ok:true, sub, email } or { ok:false, reason }. */
export async function verifyGoogleIdToken(idToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return { ok: false, reason: "Google sign-in not configured" };
  if (typeof idToken !== "string" || !idToken) return { ok: false, reason: "missing token" };
  client ||= new OAuth2Client(clientId);
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub) return { ok: false, reason: "invalid token" };
    return { ok: true, sub: payload.sub, email: payload.email || null };
  } catch {
    return { ok: false, reason: "invalid or expired token" };
  }
}
