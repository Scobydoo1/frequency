# FREQUENCY — Setup guide

A step-by-step walkthrough to get FREQUENCY running, both **locally** and
**deployed** (database on Neon, backend on Render, frontend on Vercel). No prior
deployment experience assumed. All three services have free tiers — you don't
need a paid plan for any of this.

The app is built to **degrade gracefully**: it runs even before you finish these
steps. With nothing configured it still plays using local fallback messages;
each piece you add (database → accounts, Google client → Google sign-in) lights
up the next feature.

> **Heads-up on the order.** Do the database first, then the backend, then the
> frontend. Each step produces a value (a URL or a connection string) that the
> next step needs.

---

## Part 0 — What you'll end up with

| Piece | Service | Free? | Gives you |
|---|---|---|---|
| Database | [Neon](https://neon.tech) (Postgres) | Yes | Stored accounts, messages, friendships |
| Backend API | [Render](https://render.com) (Express) | Yes | The server at `frequency/server/` |
| Frontend | [Vercel](https://vercel.com) (static PWA) | Yes | The website people visit |
| Google sign-in | [Google Cloud](https://console.cloud.google.com) | Yes | *(optional)* "Continue with Google" |

You'll collect four secrets along the way. Keep them in a note as you go:

1. `DATABASE_URL` — from Neon
2. `SESSION_SECRET` — you generate this yourself
3. The **Render URL** — e.g. `https://frequency-api.onrender.com`
4. The **Vercel URL** — e.g. `https://frequency.vercel.app`

---

## Part 1 — Run it locally first (optional but recommended)

Getting it working on your own machine first makes the deploy steps make sense.

### 1a. Start the backend

```sh
cd frequency/server
npm install
cp .env.example .env      # create your local env file
npm run dev               # → http://localhost:8787
```

At this point the API runs in **degraded mode** (no database yet). That's fine —
open `http://localhost:8787/api/health` in a browser, you should see
`{"ok":true,"persisted":false}`. `persisted:false` just means "not saving to a
database yet."

### 1b. Start the frontend (in a second terminal)

```sh
cd frequency
npm install
npm run dev               # → http://localhost:5173
```

Open `http://localhost:5173`. The game works. Messages use built-in fallback
content, and accounts won't persist until you add a database (next part). The
frontend automatically forwards `/api/...` calls to the backend on port 8787 —
no extra config needed locally.

### 1c. Run the tests (optional sanity check)

```sh
cd frequency && npm test          # frontend tests
cd frequency/server && npm test   # backend tests
```

---

## Part 2 — Database (Neon)

1. Go to **https://neon.tech** and sign up (you can use your GitHub account).
2. Click **Create project**. Give it a name like `frequency`. Pick the region
   closest to you. Leave the Postgres version at the default.
3. After it's created, Neon shows a **connection string**. Click **Copy**. It
   looks like this:
   ```
   postgresql://your_user:your_password@ep-something-123.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
   - Make sure it ends with `?sslmode=require` (Neon includes this by default).
   - **This is your `DATABASE_URL`.** Save it in your note.

> The database tables are created automatically. You don't run any SQL by hand —
> the backend runs its migrations on startup (see `frequency/server/migrate.js`
> and `frequency/server/migrations/`).

### Want to test the database locally?

Paste the connection string into `frequency/server/.env`:

```sh
DATABASE_URL=postgresql://...your Neon string...
SESSION_SECRET=anything-long-and-random-for-local
```

Then create the tables and restart:

```sh
cd frequency/server
npm run migrate     # creates the tables on Neon
npm run dev
```

Now `http://localhost:8787/api/health` returns `{"ok":true,"persisted":true}` —
`persisted:true` means accounts and messages are being saved for real.

---

## Part 3 — Backend (Render)

This deploys the `frequency/server/` Express API.

### 3a. Generate your session secret

This signs login cookies. Generate a random one (run this anywhere Node is
installed, including locally):

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the long hex string it prints. **This is your `SESSION_SECRET`.** Save it.

### 3b. Create the Render service

1. Go to **https://render.com** and sign up (GitHub login is easiest).
2. Render can read the `render.yaml` already in this repo (a "Blueprint"), which
   pre-fills most settings. The easiest path:
   - Click **New +** → **Blueprint**.
   - Connect your GitHub and pick the `frequency` repository.
   - Render reads `render.yaml` and proposes a web service named `frequency-api`.
   - **If you don't use the Blueprint**, instead choose **New +** →
     **Web Service**, pick the repo, and set these manually:
     - **Root Directory:** `frequency/server`
     - **Build Command:** `npm install`
     - **Start Command:** `npm start`
     - **Health Check Path:** `/api/health`
3. Before (or right after) the first deploy, open the service's **Environment**
   tab and add these variables:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | your Neon connection string from Part 2 |
   | `SESSION_SECRET` | the hex string from step 3a |
   | `FRONTEND_ORIGIN` | *(fill in after Part 4 — your Vercel URL)* |
   | `GOOGLE_CLIENT_ID` | *(optional — see Part 5)* |

4. Deploy. The start command runs database migrations first, then boots the
   server. When it's live, Render gives you a URL like
   `https://frequency-api.onrender.com`. **This is your Render URL.** Save it.
5. Visit `https://your-render-url/api/health` — you should see
   `{"ok":true,"persisted":true}`.

> **Free-tier note:** Render's free web services "sleep" after ~15 minutes of no
> traffic and take ~30–60 seconds to wake on the next request. That's normal for
> the free plan. The frontend's loading/fallback behavior handles this — the game
> stays playable while the API wakes up.

> You'll come back and set `FRONTEND_ORIGIN` after Part 4, since you don't have
> the Vercel URL yet. Render redeploys safely whenever you change an env var.

---

## Part 4 — Frontend (Vercel)

This deploys the static PWA in `frequency/`.

1. Go to **https://vercel.com** and sign up (GitHub login).
2. Click **Add New… → Project**, then **Import** the `frequency` repository.
3. **Set the Root Directory to `frequency`.** This is the most important
   setting — click "Edit" next to Root Directory and choose the `frequency`
   folder. Vercel auto-detects Vite for the framework, build command
   (`npm run build`), and output directory (`dist`); the repo's `vercel.json`
   confirms these.
4. Open **Settings → Environment Variables** and add:

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | your Render URL from Part 3, e.g. `https://frequency-api.onrender.com` |
   | `VITE_GOOGLE_CLIENT_ID` | *(optional — see Part 5)* |

   > These are build-time variables. If you add or change them later, you must
   > **redeploy** for them to take effect (Deployments → ⋯ → Redeploy).
5. Deploy. Vercel gives you a URL like `https://frequency.vercel.app`.
   **This is your Vercel URL.** Save it.

### 4a. Connect the two sides (important!)

Now close the loop so the backend trusts the frontend:

1. Go back to **Render → your service → Environment**.
2. Set `FRONTEND_ORIGIN` to your Vercel URL (no trailing slash), e.g.
   `https://frequency.vercel.app`.
   - If you have several domains (e.g. a custom domain too), separate them with
     commas: `https://frequency.vercel.app,https://yourdomain.com`.
3. Save — Render redeploys automatically.

Without this step, the browser will block the frontend from talking to the API
(a CORS error), and logins won't stick. After it's set, open your Vercel URL and
try creating a callsign account — it should persist now.

---

## Part 5 — Google sign-in (optional)

You can skip this entirely; callsign + password works without it, and the
"Continue with Google" button simply stays hidden until both variables below
are set. Add it whenever you're ready.

1. Go to **https://console.cloud.google.com** → create a project (or pick one).
2. **APIs & Services → OAuth consent screen** → configure it (External, add an
   app name and your email). You can keep it in "Testing" mode while developing.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - **Application type:** Web application.
   - **Authorized JavaScript origins:** add **both**
     - your Vercel URL (`https://frequency.vercel.app`)
     - your Render URL (`https://frequency-api.onrender.com`)
     - and `http://localhost:5173` if you want it to work locally too.
   - Create. Google shows a **Client ID** (looks like
     `1234567890-abc...apps.googleusercontent.com`).
4. Put that **same** Client ID in two places:
   - **Render** env var `GOOGLE_CLIENT_ID`
   - **Vercel** env var `VITE_GOOGLE_CLIENT_ID`
5. Redeploy the frontend (so Vercel picks up the new build-time variable). The
   "Continue with Google" button now appears.

> **How Google works here:** Google is an *alternate* way into a callsign
> account, never a replacement. A first-time Google user still picks a callsign
> to finish signing up, and your email is only used behind the scenes for
> sign-in/recovery — it's never shown publicly or returned by the API. The
> callsign stays your only public identity.

---

## Quick reference — all the variables

**Backend (Render) — `frequency/server`:**

| Variable | Required? | Where it comes from |
|---|---|---|
| `DATABASE_URL` | for accounts/persistence | Neon (Part 2) |
| `SESSION_SECRET` | yes (for logins) | you generate (Part 3a) |
| `FRONTEND_ORIGIN` | yes (for cross-site login) | your Vercel URL (Part 4a) |
| `GOOGLE_CLIENT_ID` | only for Google sign-in | Google Cloud (Part 5) |
| `PORT` | no (Render sets it) | — |

**Frontend (Vercel) — `frequency`:**

| Variable | Required? | Where it comes from |
|---|---|---|
| `VITE_API_URL` | yes (in production) | your Render URL (Part 3) |
| `VITE_GOOGLE_CLIENT_ID` | only for Google sign-in | same Client ID as above (Part 5) |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `/api/health` shows `persisted:false` on Render | `DATABASE_URL` not set or wrong | Re-check the Neon string in Render's env vars; redeploy |
| Login seems to work but doesn't "stick" / CORS errors in browser console | `FRONTEND_ORIGIN` on Render doesn't match your Vercel URL | Set it exactly, no trailing slash (Part 4a) |
| Frontend can't reach the API at all | `VITE_API_URL` missing/wrong on Vercel | Set it to the Render URL and **redeploy** |
| First request after idle is very slow | Render free tier woke from sleep | Normal; ~30–60s once, then fast |
| "Continue with Google" button missing | Google client id not set on **both** sides | Set `GOOGLE_CLIENT_ID` (Render) and `VITE_GOOGLE_CLIENT_ID` (Vercel), redeploy frontend |
| Google sign-in fails with origin error | Your domain isn't in "Authorized JavaScript origins" | Add the exact Vercel/Render/localhost URLs in Google Cloud (Part 5) |
| Changed a `VITE_...` var but nothing changed | Vite bakes them in at build time | Redeploy the Vercel project |

---

## Where things live in the repo

- `frequency/` — the frontend (Vite + React PWA), deploys to Vercel
- `frequency/server/` — the backend (Express API), deploys to Render
- `frequency/server/migrations/` — database schema (auto-applied on startup)
- `render.yaml` — Render Blueprint (backend deploy config)
- `frequency/vercel.json` — Vercel build config (frontend)
- `ARCHITECTURE.md` — how it all fits together + design invariants
- `docs/commercialization.md` — monetization options (report only, nothing built)

For the architecture and the "why" behind these choices, see
[`ARCHITECTURE.md`](ARCHITECTURE.md). For mobile (App Store / Play Store via
Capacitor), see the [Mobile section](ARCHITECTURE.md#mobile-capacitor) there.
