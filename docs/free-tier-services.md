# Free-tier services you can try ($0 to start)

A catalog of services with a **free tier** for each part of FREQUENCY — what you
already use, plus free alternatives and add-ons you can try without paying.
Limits are approximate (they change); always check the provider's current page.

> ⚠️ **One important caveat up front:** **Vercel's free "Hobby" plan is for
> non-commercial / personal use.** The moment the app makes money, Vercel's terms
> say you need a paid plan (**Pro, ~$20/mo**) — *or* host the frontend on a free
> tier that allows commercial use (Cloudflare Pages or Netlify, below). Worth
> deciding early since you're monetizing.

---

## What you're already using

| Purpose | Service | Free tier | Watch out for |
|---|---|---|---|
| Frontend hosting | **Vercel** (Hobby) | Generous bandwidth, auto CI/CD from GitHub | **Non-commercial only** — see caveat above |
| Backend API | **Render** (Free web service) | 750 instance-hours/mo, auto-deploy from GitHub | **Sleeps after ~15 min idle** (~30–60s cold start); no custom domains on free |
| Database | **Neon** (Free Postgres) | ~0.5 GB storage, autosuspends when idle | Storage cap; scales to zero (first query after idle is slower) |
| Google sign-in | **Google Identity** | Free | Just need the public OAuth Client ID |

---

## Frontend hosting (free alternatives that allow commercial use)

If you'd rather not pay Vercel once you monetize:

| Service | Free tier | Notes |
|---|---|---|
| **Cloudflare Pages** | Unlimited sites, unlimited bandwidth, 500 builds/mo | Commercial use allowed; great free tier; deploys Vite easily |
| **Netlify** | 100 GB bandwidth/mo, 300 build-min/mo | Commercial use allowed on free tier |
| **GitHub Pages** | Static hosting | Works for the static build, but no env-var injection at build time the same way — Cloudflare/Netlify fit better here |

All three deploy the same `npm run build` → `dist/` output you already produce.

## Backend API (free alternatives to Render)

| Service | Free tier | Notes |
|---|---|---|
| **Render** (current) | 750 hrs/mo, sleeps when idle | Easiest; the repo's `render.yaml` is built for it |
| **Fly.io** | Small always-on VMs in free allowance | Doesn't sleep like Render; a bit more setup |
| **Railway** | Trial credit, then usage-based | Good DX; not truly unlimited-free |
| **Cloudflare Workers** | 100k requests/day | Would need rewriting the Express app to Workers — bigger change |

> **Tip to avoid Render's cold starts (free):** a free uptime pinger
> (**cron-job.org**, **UptimeRobot** free, or **Better Stack** free) hitting
> `/api/health` every ~10 min keeps the service awake. Pinging 24/7 ≈ 720 hrs/mo,
> just under Render's 750-hr free limit, so it stays free.

## Database (free alternatives to Neon)

| Service | Free tier | Notes |
|---|---|---|
| **Neon** (current) | ~0.5 GB Postgres, autosuspend | Serverless Postgres; the app is built for it |
| **Supabase** | 500 MB Postgres + auth + storage | Also gives you auth/storage if you want them later; pauses after 1 week idle on free |
| **Aiven for PostgreSQL** | Limited free plan | Standard Postgres |

The app speaks plain Postgres, so any of these work by swapping `DATABASE_URL`.

---

## Add-ons you can try free

### Music (free, commercial-safe)
- **Pixabay Music** — free for commercial use, no attribution. Easiest.
- **OpenGameArt (CC0)** — public-domain game music.
- **Free Music Archive (CC0 filter)** / **ccMixter** — CC0 / commercial-OK tracks.
- (Full how-to in the README → "How to find and add a free song.")

### Payments / monetization (free to start — they take a % per sale, not a monthly fee)
- **Stripe** — no monthly fee; ~2.9% + 30¢ per transaction. Best for web.
- **Apple / Google in-app purchases** — required for digital goods in mobile
  apps; ~15–30% cut. (See `docs/monetization-setup.md`.)

### Analytics (free tiers)
- **Google Analytics 4** — free; drop in a `G-XXXX` Measurement ID.
- **Cloudflare Web Analytics** — free, privacy-friendly, no cookie banner needed.
- **Plausible** (self-host) / **Umami** (self-host on free DB) — privacy-first.

### Error & uptime monitoring (free tiers)
- **Sentry** — free tier for error tracking (frontend + backend).
- **UptimeRobot / Better Stack** — free uptime checks (doubles as the Render
  keep-awake pinger above).

### Email (only if you add notifications later — free tiers)
- **Resend** — ~3,000 emails/mo free.
- **Brevo** — ~300 emails/day free.
- (Not needed today — the app deliberately has no email.)

### Mobile (free to build; stores cost once)
- **Capacitor** — free, already scaffolded (wraps the PWA).
- **Google Play** — one-time **$25** developer account.
- **Apple App Store** — **$99/year** developer account.

---

## Suggested "all-free" setup to try

If your only goal right now is to try everything at $0:

1. **Frontend:** Cloudflare Pages (commercial-OK and free) — or stay on Vercel
   Hobby while it's not yet earning money.
2. **Backend:** Render free + a free UptimeRobot ping to dodge cold starts.
3. **Database:** Neon free (already set up).
4. **Auth:** Google sign-in (free).
5. **Music:** Pixabay/CC0 tracks (free).
6. **When you add money:** Stripe (no monthly fee) and, if you go mobile, the
   one-time/yearly store accounts.

Tell me which of these you want to actually set up or switch to, and I'll wire
the code/config for it.
