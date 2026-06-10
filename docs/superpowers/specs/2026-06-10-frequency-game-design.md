# FREQUENCY — Implementation Spec

Date: 2026-06-10
Source: Claude Design handoff bundle (`design_extract/game/`), primary file `FREQUENCY.html` + `field-engine.js` + `app.jsx`.

## Goal

Implement the FREQUENCY game design as a production web app that runs on desktop web and mobile (as an installable PWA), testable locally, deployed entirely on free services (Vercel free tier).

## Decisions (confirmed with user)

- **Prototype-faithful**: built-in curated stranger messages, no backend, no accounts. The "tuned tonight" count stays seeded-random as designed.
- **Mobile delivery**: PWA only (installable, fullscreen, offline). No app-store packaging.
- **Hosting**: Vercel free tier, static deploy.

## What is in scope

The game `FREQUENCY.html` and its imports. The `Moonshot Poster.html` / `Moonshot Worksheet.html` files are print artifacts from the design session — out of scope.

## Architecture

Single Vite + React project at `frequency/`:

| Unit | Purpose | Interface |
|---|---|---|
| `src/engine/field-engine.js` | Imperative canvas renderer + lock mechanic. No React knowledge. | `new FrequencyField(canvas)`, `setConfig`, `startTuning(seed)`, `confirmLock`, `enterConstellation`, `reset`, `destroy`; callbacks `onFreq`, `onProgress`, `onLock`. Pure-math helpers exported for tests. |
| `src/content.js` | The 4 prompt packs (10 messages each), palettes, seeded helpers. | Named exports, no side effects. |
| `src/App.jsx` | Screen state machine (intro → tuning → locked → give → constellation), drives engine. | Renders into `#root`. |
| `src/styles.css` | Design CSS verbatim + mobile viewport fixes. | — |
| `vite.config.js` | React plugin + `vite-plugin-pwa` (manifest + precache service worker). | — |

## Fidelity requirements (must match design exactly)

- Palette `#0d0b1f` / `#05040d` bg, `#f4b860` you, `#9fc6ff` them, `#dff1ff` thread; Spectral serif + IBM Plex Mono (self-hosted via @fontsource).
- Lock: radius 78px, fill 1.25s, decay 0.9s; ring progress arc; thread jitter→clean.
- FM HUD: 88–108 mapped to pointer x; statuses searching / signal detected / locking.
- Waveform strip noise→clean with lock progress.
- Give screen: 90-char single-line composer, Enter submits, skip option.
- Constellation: 130-star web, your amber star + met blue star, camera zoom-out to 0.62.
- All copy verbatim from `app.jsx`.
- Defaults baked in: 7 strangers, motion 1, Cosmic Indigo, random prompt per round (tweaks panel removed — design-tool affordance, not game UX).

## Mobile adaptations (new, required to actually play on touch)

- Touch input: offset lock target ~40px above the finger (pointerType `touch` only) so the player's light isn't hidden under the fingertip.
- `100dvh` viewport, `overscroll-behavior: none`, no pull-to-refresh, `touch-action: none` on canvas (already in design).
- Give screen stays visible above the on-screen keyboard (visualViewport-aware padding).
- PWA: manifest (standalone, theme `#0d0b1f`, icons from the design's two-lights thumbnail motif), service worker precaching all assets → offline play.

## Testing

- Vitest unit tests for pure engine math: mulberry32 determinism, frequency mapping at canvas edges, lock progress fill/decay rates, stranger spawn constraints (count, spacing, margins).
- Manual/automated browser verification of the full play loop locally (desktop viewport + 380px mobile viewport): intro → tune → lock → reveal → give → constellation → tune again.

## Deployment

- `npm run build` → static `dist/`.
- Vercel CLI deploy (free tier). One-time interactive `vercel login` by the user; everything else automated.
- Success: public HTTPS URL serving the game; Lighthouse PWA-installable; plays end-to-end on a phone.

## Out of scope (explicit)

- Real shared messages / backend / moderation.
- App store packaging (Capacitor).
- Poster/worksheet artifacts.
