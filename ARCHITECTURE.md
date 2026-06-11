# FREQUENCY — Architecture

*A game about being found.* Async-multiplayer PWA: drift a light through the
dark, lock onto a stranger's signal, read the one line they left on tonight's
prompt, leave your own — signed or anonymous — for whoever comes next.

- **Live:** https://frequency-drab.vercel.app
- **Repo:** https://github.com/Scobydoo1/frequency
- **Origin:** designed in Claude Design (claude.ai/design), handed off as an
  HTML prototype, implemented as a production app.

## System overview

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
│    └─────── api.js ──────── fetch + timeout + local fallback           │
│                  │                                                     │
│  content.js ─ prompts, nightly prompt/track rotation (date-seeded)     │
│  service worker ─ precache app shell, runtime-cache audio              │
└──────────────────┼─────────────────────────────────────────────────────┘
                   │ HTTPS (same origin)
┌──────────────────▼──────────────  Vercel  ─────────────────────────────┐
│  /api/signals  GET  random signals + tuned-tonight count per prompt    │
│                POST moderated message; identity server-resolved from   │
│                     the session (showName → callsign, else anonymous)  │
│  /api/auth     GET me · POST register/login/logout (callsign accounts, │
│                     scrypt hashes, HMAC cookie sessions, no email)     │
│  /api/friends  GET friends+requests · POST request/accept/decline/rm   │
│  /api/report   POST flag a signal by id (removes it)                   │
│  /api/health   GET  { ok, persisted } → "broadcast: live | echo"       │
│        │                                                               │
│  _lib/moderation.js  pure: sanitize, moderate(text), moderateName      │
│  _lib/auth.js        pure: scrypt, HMAC tokens, callsign validation    │
│  _lib/store.js       adapter: Vercel Blob (token or OIDC store id)     │
│  _lib/seeds.js       curated seed messages (fallback + topping-up)     │
│        │                                                               │
│  Vercel Blob store "frequency-signals"                                 │
│    signals/<promptId>.json   → { messages:[{id,text,name,ts}], subs }  │
│    users/<callsign>.json     → account + presence (owner-written only) │
│    freqreq/<to>/<from>.json  → friend request (unique path, no races)  │
│    friendsof/<a>/<b>.json    → friendship edge + mirror                │
└────────────────────────────────────────────────────────────────────────┘
```

## Module responsibilities

| Module | Owns | Depends on |
|---|---|---|
| `src/engine/field-engine.js` | Canvas rendering + lock mechanic (pure imperative; no React/network) | — |
| `src/sound.js` | The whole soundscape; nightly record selection | `content.js` |
| `src/content.js` | Prompts, palettes, nightly prompt + track rotation | `shared/prompts.js` |
| `src/api.js` | All network I/O; 4s timeouts; local fallback payloads | `content.js` |
| `src/journal.js` | localStorage journal of encounters; sky-map star positions | — |
| `src/App.jsx` | Screen state machine; wires everything | all of the above |
| `api/_lib/moderation.js` | Pure text/name moderation (unit-tested) | — |
| `api/_lib/store.js` | Persistence adapter over Vercel Blob | `seeds.js`, `moderation.js` |
| `api/*.js` | Thin HTTP handlers | `_lib/*` |

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
| Blob store not connected | API serves curated seeds; `persisted:false`; intro shows "broadcast: echo" |
| API unreachable / offline | `api.js` local fallback (same payload shape); PWA serves cached shell + audio |
| WebAudio unavailable / muted | Silent game, all mechanics intact |
| OGG unsupported (iOS) | MP3 with loop-seam trim |

## Free-tier service inventory

| Service | Plan | Used for |
|---|---|---|
| Vercel Hosting + Functions | Hobby (free) | Static PWA + 3 serverless endpoints |
| Vercel Blob | Free 1GB | Message persistence |
| GitHub + Actions | Free | Repo + CI (vitest + build on push) |
| OpenGameArt CC0 music | Public domain | Nightly records |

## Runbook

```sh
cd frequency
npm run dev            # local dev (API functions need `vercel dev` instead)
npm test               # 40 unit tests
npm run build          # production build + PWA precache
npx vercel deploy --prod --yes   # deploy (run from frequency/)
```

- **Connect the database** (one-time): Vercel dashboard → Storage →
  `frequency-signals` → Connect Project → `frequency` (all environments).
  Next deploy flips `/api/health` to `persisted:true` ("broadcast: live").
- **Service worker note:** after a deploy, an already-open client serves the
  previous shell until its next load.

## Identity & privacy invariants (v5)

- Message identity is **server-resolved**: the client sends only a boolean
  (`showName`); the name attached is always the session's callsign, so
  impersonation is impossible.
- Anonymous posts stay anonymous **everywhere**: they update a friend-visible
  "last tuned" only, never the friend-visible last signal.
- Accounts hold no email or PII — a callsign and a scrypt password hash.
  There is no recovery flow by design.

## Known trade-off: last-writer-wins per prompt

Each prompt's messages live in one JSON blob, so two writes in the same few
seconds can race (Blob list/fetch is eventually consistent); the loser's
update is dropped. Fine at current scale — a lost message costs one player a
"persisted" note, a lost report retries on the next flag. If traffic grows,
move to one-blob-per-message or a real database (the `store.js` adapter is
the only file that changes).

## Future work (documented, deliberately out of scope)

Per-IP rate limiting, admin moderation view, message archive of past nights,
realtime presence. The moderation honeypot + report flow cover abuse at
current scale.
