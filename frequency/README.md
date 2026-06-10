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
npm install
npm run dev          # http://localhost:5173 — frontend only (messages use local fallback)
npx vercel dev       # http://localhost:3000 — frontend + /api functions together
```

## Test

```sh
npm test             # vitest — engine math, moderation, store, content (32 tests)
```

## Build & deploy (free)

```sh
npm run build        # static client in dist/, PWA precache included
npx vercel --prod    # deploy client + serverless functions to Vercel free tier
```

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

**Backend (Vercel serverless functions, `api/`)**
- `signals.js` — `GET /api/signals` (real + curated messages for a prompt, plus the
  nightly count); `POST /api/signals` (moderate + store a new message).
- `report.js` — `POST /api/report` (remove a flagged message).
- `_lib/moderation.js` — pure sanitize/moderate (links, contact info, shouting,
  hostility). `_lib/store.js` — Vercel Blob persistence with a curated fallback.

**Shared (`shared/prompts.js`)** — the four prompts and their messages, the single
source of truth imported by both the frontend and the backend seed store.

### Shared messages (Vercel Blob)

The backend persists real player messages to a **Vercel Blob** store when the
`BLOB_READ_WRITE_TOKEN` env var is present. Without it (local dev, or before the
store is linked) everything still works — reads serve curated seed messages and
writes are accepted but not stored. To enable real persistence, link the Blob store
to the project once (interactive):

```sh
npx vercel blob create-store frequency-signals --access public   # answer "link to frequency? y"
npx vercel env pull                                               # pulls the token for local dev
```

Mobile notes: touch input aims the light 48px above the finger; the lock releases
when the finger lifts; screens stay above the on-screen keyboard via `visualViewport`.
