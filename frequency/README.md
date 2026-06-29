# FREQUENCY

*A game about being found.* Drift a small light through the dark until your signal
meets a stranger's — read the one line they left on tonight's prompt, then leave
your own for whoever comes next.

Implemented from a Claude Design handoff bundle. Web + mobile (installable PWA),
with a real shared-message backend, synthesized radio sound, a nightly prompt the
whole world shares, and a private journal of your encounters.

**Live:** https://frequency-drab.vercel.app

## Run locally

```sh
# backend (separate terminal)
cd server && npm install && cp .env.example .env && npm run dev   # http://localhost:8787

# frontend
npm install
npm run dev           # http://localhost:5173 — proxies /api to the server above
```

Messages still work with no backend running at all (local fallback payloads);
accounts/friends require the server + `DATABASE_URL`.

## Test

```sh
npm test                 # frontend: engine math, content
(cd server && npm test)  # backend: auth, moderation, store
```

## Build & deploy (free tiers)

Frontend on **Vercel**, API on **Render**, database on **Neon** — see
[`../ARCHITECTURE.md`](../ARCHITECTURE.md#runbook) for the full first-deploy
checklist and required env vars.

```sh
npm run build         # static client in dist/, PWA precache included
npx vercel --prod     # deploy the static client (Vercel project root: frequency/)
```

## Mobile app

Already an installable PWA. To ship to app stores via Capacitor, see
[`../ARCHITECTURE.md`](../ARCHITECTURE.md#mobile-capacitor).

## Architecture

**Frontend (Vite + React, `src/`)**
- `engine/field-engine.js` — imperative canvas engine: starfield, proximity-lock
  mechanic (78px radius, 1.25s fill / 0.9s decay), waveform, constellation.
- `App.jsx` — screen flow: intro → tuning → locked → give → constellation.
- `api.js` — backend client with timeouts and an offline fallback so the game is
  always playable.
- `sound.js` — the radio: a lofi music bed through a warm lowpass (ducks while a
  lock charges) over a synthesized drone + static that cleans into a carrier tone
  as you lock on, plus a soft lock chime. Mute is persisted.
  Music: "Chill lofi inspired" by omfgdude, seamless loop edit by qubodup —
  CC0 / public domain, from [OpenGameArt](https://opengameart.org/content/chill-lofi-inspired-loop-edit).
  OGG for Chrome/Android, MP3 fallback for iOS; cached at runtime for offline play.
- `journal.js` — localStorage record of your encounters (never leaves the device).
- `content.js` — frontend helpers incl. the date-seeded nightly prompt.

**Backend (Express on Render, `server/`)**
- `routes/signals.js` — `GET /api/signals` (real + curated messages for a prompt,
  plus the nightly count); `POST /api/signals` (moderate + store a new message,
  identity server-resolved from the session).
- `routes/report.js` — `POST /api/report` (remove a flagged message).
- `routes/auth.js` — register/login/logout (callsign + password) plus the Google
  sign-in/recovery flow.
- `routes/friends.js` — friend requests and friendships.
- `lib/moderation.js` — pure sanitize/moderate (links, contact info, shouting,
  hostility). `lib/store.js` — Postgres (Neon) persistence with a curated fallback.
- `lib/google.js` — verifies a Google ID token server-side.

**Shared (`shared/prompts.js`)** — the four prompts and their messages, the single
source of truth imported by both the frontend and the backend seed store.

### Shared messages (Postgres / Neon)

The backend persists real player messages and accounts to a **Postgres** database
(hosted free on [Neon](https://neon.tech)) when `DATABASE_URL` is present. Without
it (local dev, or before the database is provisioned) everything still works —
reads serve curated seed messages, writes are accepted but not stored, and
accounts/friends are unavailable. See
[`../ARCHITECTURE.md`](../ARCHITECTURE.md#runbook) for setup.

Mobile notes: touch input aims the light 48px above the finger; the lock releases
when the finger lifts; screens stay above the on-screen keyboard via `visualViewport`.
