# FREQUENCY — Architecture

*A game about being found.* Async-multiplayer PWA: drift a light through the
dark, lock onto a stranger's signal, read the one line they left on tonight's
prompt, leave your own — signed or anonymous — for whoever comes next.

- **Live:** https://frequency-drab.vercel.app
- **Repo:** https://github.com/Scobydoo1/frequency
- **Origin:** designed in Claude Design (claude.ai/design), handed off as an
  HTML prototype, implemented as a production app.

## System overview

Three independent deployments: static PWA on **Vercel**, API on **Render**,
database on **Neon** (Postgres). Frontend and API are different sites, so the
session cookie is `SameSite=None; Secure` and the API allows the frontend's
origin via CORS.

```
┌────────────────────────────  browser (PWA)  ───────────────────────────┐
│                                                                        │
│  App.jsx ── screens: intro → tuning → locked → give → constellation    │
│    │  │  │                                                             │
│    │  │  └─ journal.js ──── localStorage (your encounters, your name)  │
│    │  └──── sound.js ────── WebAudio: nightly lofi record (CC0),       │
│    │                        warm air, rain, crackle, static→carrier    │
│    └─────── field-engine.js  canvas: starfield, proximity lock,        │
│    │                         waveform, constellation                   │
│    └─────── api.js / auth.js ── fetch + timeout + local fallback,      │
│                  │               "continue with Google" via GSI        │
│  content.js ─ prompts, nightly prompt/track rotation (date-seeded)     │
│  service worker ─ precache app shell, runtime-cache audio              │
└──────────────────┼─────────────────────────────────────────────────────┘
                   │ HTTPS, cross-site (VITE_API_URL), credentials: include
┌──────────────────▼──────────────  Render  ─────────────────────────────┐
│  server/index.js  Express app, CORS(FRONTEND_ORIGIN), cookie sessions  │
│  routes/signals.js  GET random signals + tuned-tonight count per       │
│                     prompt; POST moderated message (identity is       │
│                     server-resolved from the session)                  │
│  routes/auth.js     GET me · POST register/login/logout (callsign +   │
│                     scrypt) · POST google, google/complete,            │
│                     google/link, recover (Google as alt sign-in/       │
│                     recovery — see "Identity" below)                   │
│  routes/friends.js  GET friends+requests · POST request/accept/        │
│                     decline/remove                                     │
│  routes/report.js   POST flag a signal by id (removes it)              │
│  routes/health.js   GET { ok, persisted } → "broadcast: live | echo"   │
│        │                                                               │
│  lib/moderation.js  pure: sanitize, moderate(text), moderateName       │
│  lib/auth.js        pure: scrypt, HMAC tokens, callsign validation     │
│  lib/google.js      verifies a Google ID token (google-auth-library)  │
│  lib/store.js       Postgres-backed persistence + curated fallback    │
│        │                                                               │
└────────┼─────────────────────────────────────────────────────────────┘
         │ DATABASE_URL (?sslmode=require)
┌────────▼──────────────────────────  Neon  ──────────────────────────────┐
│  users(callsign pk, password_salt/hash, google_sub, google_email,      │
│        last_signal_*, last_tuned_day)                                  │
│  signals(id pk, prompt_id, text, name, ts)                             │
│  prompt_counters(prompt_id pk, submissions)                            │
│  friend_requests(to_callsign, from_callsign)                           │
│  friendships(owner_callsign, friend_callsign)   -- mirrored rows       │
└──────────────────────────────────────────────────────────────────────────┘
```

## Module responsibilities

| Module | Owns | Depends on |
|---|---|---|
| `src/engine/field-engine.js` | Canvas rendering + lock mechanic (pure imperative; no React/network) | — |
| `src/sound.js` | The whole soundscape; nightly record selection | `content.js` |
| `src/content.js` | Prompts, palettes, nightly prompt + track rotation | `shared/prompts.js` |
| `src/api.js` | Signals/health network I/O; 4s timeouts; local fallback payloads | `content.js` |
| `src/auth.js` | Accounts/friends network I/O, incl. the Google flows | — |
| `src/journal.js` | localStorage journal of encounters; sky-map star positions | — |
| `src/App.jsx` | Screen state machine; wires everything | all of the above |
| `server/lib/moderation.js` | Pure text/name moderation (unit-tested) | — |
| `server/lib/google.js` | Verifies a Google ID token server-side | `google-auth-library` |
| `server/lib/store.js` | Persistence adapter over Postgres (Neon) | `seeds.js`, `moderation.js`, `db.js` |
| `server/routes/*.js` | Thin Express handlers | `lib/*` |

## Nightly rotation

The prompt, the lofi record, **and the ambient weather** (rain / wind /
crickets / fireside) are each chosen by hashing the day number
(`floor(epoch / 86400000)`) with different offsets, so everyone on Earth
shares the same frequency for ~24h, then it rotates. The prompt also colors
the whole field — each of the four prompts wears one of the original design's
palettes (Ember Dusk, Cosmic Indigo, Noir Signal, Deep Teal). Tracks (all CC0, license verified on opengameart.org;
MP3 required because iOS can't decode OGG):

1. "Chill lofi inspired" — omfgdude (seamless loop edit: qubodup) — MP3 + OGG
2. "Since 2 A.M." — TAD — MP3
3. "happy lofi day" — Tarush Singhal — MP3

## Degradation modes (always playable)

| Condition | Behavior |
|---|---|
| `DATABASE_URL` not set | API serves curated seeds; `persisted:false`; intro shows "broadcast: echo"; accounts unavailable |
| `GOOGLE_CLIENT_ID` not set | "continue with Google" button stays hidden; callsign/password still works |
| API unreachable / offline | `api.js` local fallback (same payload shape); PWA serves cached shell + audio |
| WebAudio unavailable / muted | Silent game, all mechanics intact |
| OGG unsupported (iOS) | MP3 with loop-seam trim |

## Hosting

| Service | Plan | Used for |
|---|---|---|
| Vercel Hosting | Hobby (free) | Static PWA build (`frequency/`, `vercel.json`) |
| Render Web Service | Free | `server/` Express API (`render.yaml`, rootDir `frequency/server`) |
| Neon | Free | Postgres — accounts, signals, friendships |
| GitHub + Actions | Free | Repo + CI (vitest + build on push) |
| OpenGameArt CC0 music | Public domain | Nightly records |

## Runbook

```sh
# frontend
cd frequency
npm install
npm run dev                       # http://localhost:5173, proxies /api → :8787
npm test                          # frontend unit tests (content, engine math)
npm run build                     # production build + PWA precache
npx vercel deploy --prod --yes    # deploy (Vercel project root = frequency/)

# backend
cd frequency/server
npm install
cp .env.example .env              # fill in DATABASE_URL, SESSION_SECRET, ...
npm run migrate                   # create tables on Neon
npm run dev                       # http://localhost:8787
npm test                          # auth, moderation, store unit tests
```

**First deploy, in order:**
1. Create a Neon project, copy its connection string into `DATABASE_URL`.
2. Deploy `server/` to Render (Blueprint from `render.yaml`, or a manual Web
   Service with root dir `frequency/server`). Set `DATABASE_URL`,
   `SESSION_SECRET` (any long random string), and `FRONTEND_ORIGIN` (your
   Vercel URL) in its environment. The start command runs migrations, then
   the server — safe to redeploy.
3. Deploy `frequency/` to Vercel. Set `VITE_API_URL` to the Render URL.
4. *(Optional)* Create a Google OAuth client (Google Cloud Console →
   Credentials → OAuth client ID → Web application), add both the Vercel and
   Render origins under "Authorized JavaScript origins", then set
   `GOOGLE_CLIENT_ID` on Render and `VITE_GOOGLE_CLIENT_ID` (same value) on
   Vercel. The button only appears once both are set.

**Service worker note:** after a deploy, an already-open client serves the
previous shell until its next load.

## Identity & privacy invariants (v6)

- Message identity is **server-resolved**: the client sends only a boolean
  (`showName`); the name attached is always the session's callsign, so
  impersonation is impossible.
- Anonymous posts stay anonymous **everywhere**: they update a friend-visible
  "last tuned" only, never the friend-visible last signal.
- The **callsign is the only public identity**. Google sign-in is an
  *alternate* way to reach a callsign account, not a replacement for it:
  - First-time Google sign-in still requires picking a callsign
    (`POST /api/auth/google` → `needsCallsign` → `POST /api/auth/google/complete`).
  - A Google email is stored (`users.google_email`) only to resolve sign-in
    and password recovery; **no API response ever returns it**.
  - `POST /api/auth/google/link` and `POST /api/auth/recover` let an existing
    callsign account add Google as a recovery path after the fact.
- Callsign-only accounts (no Google linked) still have no recovery — by
  design, same as before.

## Known trade-off: per-prompt write contention

Each prompt's recent messages live in one `signals` table, ordered by `ts`;
two writes in the same instant just both insert (no more last-writer-wins
race like the old single-blob-per-prompt model). The dedupe-by-text check and
the `MAX_PER_PROMPT` trim are best-effort and accept the tiny race window
between them — acceptable at current scale, same trade-off documented before.

## Mobile (Capacitor)

The PWA is already installable from a browser. To ship to the App Store /
Play Store without rewriting anything, wrap it with
[Capacitor](https://capacitorjs.com/) (already in `package.json`):

```sh
cd frequency
npm run build
npm run cap:add:android   # or cap:add:ios (needs Xcode, macOS only)
npm run cap:sync          # rebuild + copy dist/ into the native project
npm run cap:open:android  # or cap:open:ios — opens Android Studio / Xcode
```

`capacitor.config.json` points `webDir` at `dist/`, so the native shell loads
the same build Vercel serves. Push notifications, native share, etc. are
future work — out of scope for the initial wrap.

## Future work (documented, deliberately out of scope)

Per-IP rate limiting, admin moderation view, message archive of past nights,
realtime presence, a settings screen for linking/unlinking Google. The
moderation honeypot + report flow cover abuse at current scale. See
`docs/commercialization.md` for monetization options under consideration.
