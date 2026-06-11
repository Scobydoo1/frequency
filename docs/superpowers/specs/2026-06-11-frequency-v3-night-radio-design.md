# FREQUENCY v3 — Night Radio: rotating lofi station, named signals, production architecture

Date: 2026-06-11. Extends the v1 game spec (2026-06-10) and the v2 backend work.

## Goal

Make FREQUENCY a complete, running online product: a nightly-rotating lofi
station, database-backed player messages with optional identity, visible
system health, CI, documented architecture — deployed on Vercel free tier,
repo on GitHub (Scobydoo1/frequency).

## Decisions (confirmed with user)

- Database: **Vercel Blob** (store `frequency-signals`, already created). The
  user performs the one dashboard click to connect store ↔ project; until then
  the API gracefully serves curated seeds (`persisted:false`).
- Anonymity: leaving a name is **optional per message** — empty name = "a stranger".
- More lofi = a small **nightly rotating playlist** of verified-CC0 tracks, not
  simultaneous layers.

## Components

| Unit | Purpose | Interface |
|---|---|---|
| `src/sound.js` (Radio) | ASMR mix: music bed, warm air, rain, crackle, tuning static, chime | `start()`, `tune(p, near)`, `silenceStatic()`, `chime()`, `toggleMute()`; nightly track chosen internally via `trackForDate(date)` |
| `src/content.js` | Prompts, nightly prompt, palettes, **nightly track table** | `nightlyPrompt(date)`, `nightlyTrack(date)` (exported for tests) |
| `src/api.js` | Client for serverless API; short timeouts; null on failure | `fetchSignals(promptId)`, `postSignal({promptId, text, name})`, `reportSignal(id)`, `health()` |
| `src/App.jsx` | Screens; optional name field on give screen; broadcast status on intro | — |
| `api/signals.js` | GET random signals + count for a prompt; POST new moderated signal | JSON; includes `persisted` flag |
| `api/report.js` | Flag a signal by id | JSON |
| `api/health.js` | `{ ok, persisted }` for status display + ops | JSON |
| `api/_lib/moderation.js` | Length/URL/control-char/profanity checks for text **and name** | `checkMessage(text)`, `checkName(name)` |
| `api/_lib/store.js` | Blob-backed persistence adapter; inert without `BLOB_READ_WRITE_TOKEN` | `saveSignal`, `listSignals`, `reportSignal`, `isPersisted()` |

## Data model (Blob)

- `signals/{promptId}/{timestampMs}-{rand}.json` →
  `{ "text": string ≤90, "name": string ≤24 | null, "t": epochMs }`
- Report moves the blob to `reported/{promptId}/...` (delete + put).

## Behavior

- **Nightly track**: `nightlyTrack(date)` hashes the local date (same scheme as
  `nightlyPrompt`) into a track table `[{slug, title, artist, mp3, ogg?}]`.
  All tracks CC0 from OpenGameArt with license verified on their pages; every
  track must have an MP3 (iOS); OGG used where available. Files live in
  `public/audio/`, runtime-cached (CacheFirst, maxEntries raised to 8).
- **Name field**: under the message textarea — mono, ghost, placeholder
  "sign it (optional) — or stay a stranger", maxLength 24, single line. Sent
  as `name` (trimmed; empty → null). Attribution everywhere becomes
  `— {name}, {ago}` or `— a stranger, {ago}`. Journal stores the name of the
  stranger met and whether *you* signed.
- **Broadcast status**: intro fineprint line `broadcast: live` (health
  `persisted:true`) or `broadcast: echo` (false/unreachable). Mono, dim, no
  layout shift.
- **Moderation**: name passes the same profanity/URL/control-char filters as
  text; rejected name → 400 with reason; client falls back to anonymous rather
  than blocking the send? **No** — explicit: rejected name returns an error and
  the UI shows the API's message under the counter; the player can clear the
  name and resend.

## CI

`.github/workflows/ci.yml`: on push/PR — Node 22, `npm ci`, `npm test`,
`npm run build` (working dir `frequency/`).

## Docs

`ARCHITECTURE.md` at repo root: module map, request/data flow (tune → lock →
reveal → give → constellation), storage layout, free-tier service inventory,
degradation modes table, deploy runbook.

## Testing

- Unit: `nightlyTrack` stability/rotation; `checkName` (valid, profane, URL,
  control chars, length, empty→null); store record shape.
- E2E (local, vercel dev or preview + functions unavailable fallback): full
  play loop with a signed message and an anonymous one; broadcast status
  renders; sound starts with the nightly track URL.
- Live: after user connects the store and we redeploy — POST a signal, GET it
  back (`persisted:true`), then report it.

## Out of scope

- Accounts/auth, scrolling message feed, realtime presence, admin UI,
  per-IP rate limiting (documented as future work; moderation + honeypot stay).
