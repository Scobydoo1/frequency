# FREQUENCY

*A game about being found.* Drift a small light through the dark until your signal
meets a stranger's — read the one line they left on tonight's prompt, then leave
your own for whoever comes next.

Implemented from a Claude Design handoff bundle. Web + mobile (installable PWA),
no backend, fully static.

**Live:** https://frequency-drab.vercel.app

## Run locally

```sh
npm install
npm run dev          # http://localhost:5173  (add --host to test from your phone)
```

## Test

```sh
npm test             # vitest — engine math + content
```

## Build & deploy (free)

```sh
npm run build        # static output in dist/, PWA precache included
npx vercel --prod    # deploy to Vercel free tier
```

## Structure

- `src/engine/field-engine.js` — imperative canvas engine: starfield, proximity-lock
  mechanic (78px radius, 1.25s fill / 0.9s decay), waveform, constellation. Pure math
  helpers are exported for tests.
- `src/App.jsx` — React screen flow: intro → tuning → locked → give → constellation.
- `src/content.js` — the four nightly prompts and their stranger messages.
- `scripts/gen-icons.mjs` — regenerates PWA icons from the two-lights motif (`npm run icons`).

Mobile notes: touch input aims the light 48px above the finger so it stays visible;
the lock releases when the finger lifts; screens stay above the on-screen keyboard
via `visualViewport`.
