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
accounts, friends and echoes (who found the signals you signed) require the
server + `DATABASE_URL`.

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

---

## How to find and add a free song (step by step)

The game rotates through a list of tracks each night, and players can pick one
from the **record selector** (top-left). Here's how to add your own — using only
music you're legally allowed to ship (important, because this app is meant to
earn money).

### Step 1 — find a track you can use commercially

Use a site that offers **CC0 / public-domain** or **royalty-free for commercial
use** music. Good free sources:

| Site | Link | Notes |
|---|---|---|
| Pixabay Music | https://pixabay.com/music/ | Free for commercial use, **no attribution** required. Easiest. |
| OpenGameArt (CC0) | https://opengameart.org/ | Filter "Art License → CC0". The current tracks came from here. |
| Free Music Archive | https://freemusicarchive.org/ | Filter to **CC0**; some tracks are CC-BY (need credit). |
| ccMixter | http://dig.ccmixter.org/ | Pick the "for commercial use" section. |

**Rules to stay safe (you're monetizing):**
- ✅ Use only tracks marked **CC0 / public domain** or **royalty-free for
  commercial use**.
- ⚠️ **CC-BY** is OK *only if you keep the credit* (this app already shows an
  "artist" line, so that's easy).
- ❌ Never use YouTube/Spotify rips, "free to listen" tracks, or anything marked
  **non-commercial**.

Search for something like *"lofi"*, *"ambient"*, *"chillhop"*, or *"calm"* to
match the mood. Download the **MP3**.

### Step 2 — put the file in the project

Copy your downloaded file into this folder:

```
frequency/public/audio/
```

For example: `frequency/public/audio/my-track.mp3`. Keep it reasonably small
(the current ones are ~2.5–4 MB) since it ships with the app.

> Tip: an **MP3 is required** (iPhones can't play OGG). If you also have an OGG
> version of the *same* track, add it too — Chrome/Android will prefer it.

### Step 3 — add one line to the track list

Open `frequency/src/content.js`, find the `TRACKS` array, and add an entry:

```js
{
  slug: "my-track",                 // any unique id (used to remember the choice)
  title: "My Track Title",          // shown in the selector + credits
  artist: "Artist Name",            // shown in the credits (give credit even for CC0)
  mp3: "/audio/my-track.mp3",       // required — note the path starts with /audio (no "public")
  ogg: "/audio/my-track.ogg",       // optional — delete this line if you only have an mp3
},
```

That's the only code change. The track now appears in the selector **and** the
nightly rotation automatically.

### Step 4 — test it, then deploy

```sh
cd frequency
npm run dev      # open http://localhost:5173 → pick your track in the top-left selector
npm run build    # make sure it builds; the track gets cached for offline play
```

Then commit + push, and Vercel redeploys the frontend. (Full guide:
[`../docs/adding-music.md`](../docs/adding-music.md).)

> Want Claude to add a track for you? Either commit the audio file to
> `frequency/public/audio/` yourself, or paste a **direct download link** to a
> CC0/royalty-free track — Claude will wire it in.

---

## Environment variables — Vercel & Render (and Google login)

Your app has three places that need configuration: **Vercel** (the website),
**Render** (the API server), and the Google login. Here's every variable, what
it's for, and exactly where to find its value. (For the full first-deploy order,
see [`../SETUP.md`](../SETUP.md).)

### A) Render — the backend API

Open **Render dashboard → your `frequency-api` service → Environment**, and add:

| Variable | Example value | Where to find it |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require` | **Neon dashboard** → your project → **Connection string** (click "Copy"). |
| `SESSION_SECRET` | a long random string | Generate it yourself: run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste the output. |
| `FRONTEND_ORIGIN` | `https://frequency-drab.vercel.app` | Your **Vercel** site URL (Vercel dashboard → your project → top of the page). No trailing slash. Multiple? separate with commas. |
| `GOOGLE_CLIENT_ID` | `1234-abc.apps.googleusercontent.com` | Google Cloud Console (see section C). Leave blank to keep Google sign-in off. |

After saving, Render redeploys, runs the database migration, and starts. Check
`https://YOUR-RENDER-URL/api/health` → it should show `{"ok":true,"persisted":true}`.

### B) Vercel — the frontend website

Open **Vercel dashboard → your project → Settings → Environment Variables**, add:

| Variable | Example value | Where to find it |
|---|---|---|
| `VITE_API_URL` | `https://frequency-api.onrender.com` | Your **Render** service URL (Render dashboard → your service → top of the page). |
| `VITE_GOOGLE_CLIENT_ID` | `1234-abc.apps.googleusercontent.com` | The **same** Google client id as Render's `GOOGLE_CLIENT_ID` (section C). |

> ⚠️ These are baked in at build time. After adding/changing them, you must
> **redeploy** (Vercel → Deployments → ⋯ → Redeploy) for them to take effect.

### C) Google login — getting the Client ID (Google service: Identity)

The app uses **Google Identity Services** so people can sign in with Google
(it's an *alternate* way into a callsign account — no email is ever shown). To
turn it on:

1. Go to **https://console.cloud.google.com** and create a project (or pick one).
2. **APIs & Services → OAuth consent screen**:
   - User type: **External**, then fill in app name, your support email, and a
     developer contact email. You can stay in **Testing** mode while developing.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Under **Authorized JavaScript origins**, add each of:
     - your Vercel URL — `https://frequency-drab.vercel.app`
     - your Render URL — `https://frequency-api.onrender.com`
     - `http://localhost:5173` (so it works in local dev too)
   - Click **Create**. Google shows your **Client ID**
     (`...apps.googleusercontent.com`).
4. Put that **same Client ID** in two places:
   - **Render** → `GOOGLE_CLIENT_ID`
   - **Vercel** → `VITE_GOOGLE_CLIENT_ID`
5. **Redeploy the Vercel site.** The "Continue with Google" button now appears.

> You only need the **Client ID** (it's public, safe to share). You do **not**
> need the client *secret* for this app — sign-in is verified with the ID token,
> not a secret.

### Other Google services you can add later (optional)

If you want to lean further into Google's stack as the app grows:

- **Google AdMob** — ads in the mobile app (only worth it at real scale; setup
  steps are in [`../docs/monetization-setup.md`](../docs/monetization-setup.md)).
- **Google Analytics / Firebase** — usage stats. Drop the GA "Measurement ID"
  (`G-XXXX`) into the site if you want; ask Claude to wire it in.
- **Google Play** — for shipping the Android build (see the Capacitor section in
  `ARCHITECTURE.md`); needs a Play Developer account.

These aren't wired up yet — tell Claude which one you want and provide the public
ID, and it'll add it.

---

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
  A **record selector** (top-left) lets you keep the nightly rotation or pin a
  specific track; the choice is persisted and the record swaps live.
  Adding more free music is two steps — see [`../docs/adding-music.md`](../docs/adding-music.md).
- `journal.js` — localStorage record of your encounters (never leaves the device).
- `content.js` — frontend helpers incl. the date-seeded nightly prompt.

**Backend (Express on Render, `server/`)**
- `routes/signals.js` — `GET /api/signals` (real + curated messages for a prompt,
  plus the nightly count); `POST /api/signals` (moderate + store a new message,
  identity server-resolved from the session); `POST /api/signals/found` (a reveal
  happened — echo it back to the author); `GET /api/signals/mine` +
  `POST /api/signals/mine/seen` (the signed-in player's broadcast history and
  its unread-finds badge, the **your echoes** panel).
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
