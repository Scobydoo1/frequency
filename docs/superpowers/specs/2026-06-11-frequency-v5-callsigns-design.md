# FREQUENCY v5 — Callsigns: accounts, identity choice, friends

Date: 2026-06-11. Extends v3 (backend/persistence) and v4 (atmosphere).

## Goal

FREQUENCY is a social connection game. v5 adds the social layer: optional
accounts ("callsigns"), a per-message choice to show or hide your identity,
and friendships formed from real encounters — all on the existing free stack
(Vercel Functions + Blob), no new services, no email/PII.

## Decisions (confirmed with user)

- **Auth**: built-in callsign + password. scrypt-hashed in Blob, HMAC-signed
  HttpOnly cookie session (30d), `SESSION_SECRET` env var. No recovery flow.
- **Identity**: message names come only from accounts. Signed-in players get a
  per-message toggle (show callsign / stay a stranger; preference persisted
  locally). Guests always post anonymously. The v4 free-text signature field
  is removed.
- **Friends v1**: request from a reveal that carries a callsign; inbox with
  accept/decline; friends list shows each friend's latest signal and
  last-tuned night. No DMs, no field highlighting (future).

## Data model (Blob; race-safe by construction)

| Path | Contents | Writers |
|---|---|---|
| `users/{callsign}.json` | `{ callsign, salt, hash, createdAt, lastSignal: {text, promptId, t} \| null, lastTunedDay }` | owner only (register, own posts) |
| `freqreq/{to}/{from}.json` | `{ from, to, t }` | requester creates; recipient deletes on accept/decline |
| `friendsof/{a}/{b}.json` (+ mirror `friendsof/{b}/{a}.json`) | `{ friend, t }` | recipient on accept; either side on remove |

Unique blob paths per relationship ⇒ no last-writer-wins races (unlike the
per-prompt message blobs, which keep their documented trade-off).

## Auth mechanics

- Callsign: `^[a-z0-9_-]{3,16}$` (lowercased), passes `moderateName`
  blocklist, reserved list (`admin`, `frequency`, `stranger`, `anonymous`,
  `system`, `mod`). Password: 6–72 chars.
- Hash: `crypto.scryptSync(password, salt, 32)`, 16-byte random salt,
  `timingSafeEqual` compare.
- Session token: `base64url(payload).base64url(hmacSHA256(payload, SECRET))`,
  payload `{ c: callsign, exp }`. Cookie `freq_session`: HttpOnly, Secure,
  SameSite=Lax, Max-Age 30d. Logout clears it.
- `SESSION_SECRET`: 64-hex random, added to Vercel env (prod/preview/dev) via
  CLI; local dev uses `.env.local` (gitignored). If unset, auth endpoints
  return `{ ok:false, reason:"accounts unavailable" }` and the UI hides
  account features.

## API

- `api/auth.js` — `GET` → `{ user: {callsign} | null }` (from cookie).
  `POST {action:"register"|"login"|"logout", callsign?, password?}`.
  Register: validate, fail if user blob exists, create, set cookie.
- `api/friends.js` — auth required.
  `GET` → `{ friends:[{callsign, lastSignal, lastTunedDay}], requests:[{from, t}] }`.
  `POST {action:"request", to}` (must not be self/already-friend; target must
  exist), `{action:"accept"|"decline", from}`, `{action:"remove", friend}`.
- `api/signals.js` POST — body gains `showName: boolean`; server resolves the
  name from the session cookie when `showName` (client text is never trusted).
  On any authenticated post it updates the poster's `lastSignal`/`lastTunedDay`.
- `api/health.js` — unchanged.

## Frontend

- `src/auth.js` — client: `me()`, `register()`, `login()`, `logout()`,
  `getFriends()`, `friendAction()`. 4s timeouts, null-safe fallbacks.
- App state: `user` (null = guest). Loaded once on mount alongside health.
- **Login screen** (`screen === "operator"`): kicker `OPERATOR REGISTRATION`,
  claim/sign-in toggle, callsign + password inputs (mono style), inline error
  line, ghost back. Reached from intro.
- **Intro**: `sign in · claim a callsign` ↔ `{callsign} · sign out`, plus
  `your frequencies` (friends panel) when signed in. Hidden in echo mode.
- **Give screen**: toggle row replaces the name input —
  `broadcast as {callsign}` / `stay a stranger` (persisted in localStorage);
  guests see fineprint: `claim a callsign to sign your signals`.
- **Reveal**: if `reveal.name` && signed in && not self && not already friend:
  ghost button `keep this frequency — add {name}` → request → confirmation
  text. Errors (already requested, etc.) show inline.
- **Friends panel**: overlay like the journal. Requests first (accept /
  decline), then friends: callsign, latest signal quote (or "no signal yet"),
  last tuned (`tonight` / `n nights ago`). Empty state copy.
- **Journal**: `givenName` now records the callsign when shown.

## Moderation & abuse

- Callsign validation reuses the moderation blocklist.
- Friend requests: one outstanding request per pair (unique path), target
  must exist, self-requests rejected. Removal is unilateral.
- Impersonation impossible by construction (server-side name resolution).

## Testing

- Unit: callsign validation (valid/reserved/profane/length), scrypt
  hash+verify roundtrip, token sign/verify/expiry/tamper, friend-path helpers.
- Live E2E after deploy: register two throwaway accounts, signed + anonymous
  posts (name appears only when toggled), request → accept → both lists,
  decline, remove; cleanup via `vercel blob del`.

## Out of scope (future)

DMs, friend lights in the field, password recovery, account deletion UI,
per-IP rate limiting.
