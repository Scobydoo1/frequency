# FREQUENCY — Commercialization options (research + recommendation)

**Status: report only.** Nothing below is implemented. This compares FREQUENCY
against apps with similar mechanics (anonymous/ephemeral social, one-shared-thing-
per-day) and proposes monetization options that don't break the app's existing
invariants — see `ARCHITECTURE.md` → "Identity & privacy invariants." Pick what
you want built; nothing here ships until you say go.

## What FREQUENCY actually is, mechanically

- One shared prompt per ~24h, for everyone on Earth (date-seeded, no account
  needed to see it).
- One lock mechanic per visit — you drift until you find *a* stranger's message,
  read it, leave your own.
- Identity is optional and server-resolved (can't impersonate), anonymous posts
  stay anonymous everywhere, no email ever shown.
- Always playable degraded (no DB, no network, muted) — there's no paywall on
  the core loop today, and no ads.

That combination — single daily shared object + low-friction anonymous
read/write + strong sensory theming (sound, color, motion) — is closest to
**NGL**, **Wavelength (the party game)**, **Yik Yak**, **BeReal**, and **Locket**,
each discussed below.

## Comparable apps

### NGL — anonymous Q&A on Instagram stories
- **Loop:** friends send anonymous messages/questions to your story link.
- **Monetization:** subscription (~$10/week) for "Pro" — sold as revealing
  *hints* about who sent an anonymous message.
- **Outcome:** the hints were found to be largely fabricated/unhelpful. FTC
  action (2024) over deceptive practices and minors' data; $5M settlement,
  required to overhaul the feature.
- **Lesson for FREQUENCY:** this is the cautionary tale, not a model to copy.
  FREQUENCY's anonymity is a *real* invariant (server-resolved identity,
  anonymous posts never attributable). Any future feature that implies "pay to
  find out who sent this" would both violate that invariant and repeat NGL's
  exact regulatory mistake. **Hard no.**

### Wavelength — party guessing game
- **Loop:** a shared "spectrum" prompt each round; players guess where a clue
  falls on it. Conceptually close to FREQUENCY's "everyone gets the same
  prompt tonight."
- **Monetization:** one-time purchase + paid expansion card packs (physical
  board game) / one-time unlock on app stores. No subscription, no ads — the
  product is the content (more prompt packs).
- **Lesson:** a content-pack model maps cleanly onto FREQUENCY's prompt system
  (`shared/prompts.js`) — selling *themed prompt sets* (vs. selling access to
  the core loop) is a proven, low-friction model for this exact genre.

### BeReal — one photo a day, with friends
- **Loop:** a single daily notification, a few-minute window, one authentic
  photo, shown to your friends only.
- **Monetization:** free for years (grew on FOMO/virality alone); added
  **BeReal+** (multiple posts/day, extra features) once retention was proven;
  added ads only in 2024, after reaching massive scale, and absorbed real
  backlash for it.
- **Lesson:** don't rush ads. BeReal's order of operations — prove the loop,
  *then* sell a "do more of the thing" subscription, treat ads as a last
  resort — is the right sequencing for FREQUENCY too. The nightly-rotation
  mechanic is the product; protect it before monetizing around it.

### Locket — photo widget for couples/close friends
- **Loop:** photos sent straight to a home-screen widget.
- **Monetization:** **Locket Gold** subscription — unlimited recipients,
  video, priority. The *free* tier is fully functional (one widget, limited
  recipients); paid tier removes friction/limits, doesn't gate the concept.
- **Lesson:** "freemium by limit, not by feature" — free users get the whole
  experience, paying users get more of it (more slots, more capacity, more
  cosmetics). Maps well onto FREQUENCY's journal/constellation, which is
  currently unlimited-but-local-only.

### Yik Yak — anonymous local bulletin board
- **Loop:** fully anonymous, location-based, no accounts at all.
- **Monetization:** never found one; ran on ad-network revenue at small scale,
  shut down in 2017 under moderation/harassment costs, relaunched in 2021,
  shut down again in 2023.
- **Lesson:** anonymous social products live or die on moderation cost, not
  monetization cleverness. FREQUENCY's `lib/moderation.js` + report flow are
  already the right shape for its current scale; any monetization plan should
  assume moderation cost scales with growth and shouldn't be deprioritized to
  fund feature work.

### Wordle / NYT Games — the "one shared daily thing" pattern
- **Loop:** literally identical shape to FREQUENCY's nightly rotation — one
  puzzle, shared by everyone, resets every 24h, no pressure to play more than
  once.
- **Monetization:** bundled into **NYT subscription**; archive/stats/extra
  puzzles are the upsell, the daily puzzle itself stays free forever.
- **Lesson:** the daily ritual itself must stay free and unlimited — that's
  what makes people show up tomorrow. Monetize the *periphery* (archive,
  stats, extra content), never the ritual.

## What this rules out for FREQUENCY

- **Pay to reveal who sent a message** — directly contradicts the
  server-resolved-anonymity invariant; this is the NGL mistake.
- **Gating the nightly prompt or the lock mechanic itself** — kills the
  Wordle-style daily-ritual habit loop that makes people return.
- **Ads inside the experience** (banner/interstitial over the starfield/audio)
  — the whole product is a sensory, intimate, after-dark moment; an ad here
  costs more in churn than it earns. Revisit only at BeReal-scale, if ever.
- **Anything that requires more PII than today** — email is already
  write-only (sign-in/recovery, never returned by any API); don't add fields
  that don't serve gameplay.

## Recommended options (in priority order)

These are all **additive**: the free experience — nightly prompt, one lock,
read/leave a message, anonymous or named — stays exactly as it is today, free,
forever. Paying unlocks *more of the periphery*, never *the thing itself*.

### 1. "Frequency+" cosmetic subscription (recommended first)
A subscription (or one-time unlock) for non-mechanical extras:
- Alternate color palettes / waveform styles beyond the four prompt-linked ones.
- Additional ambient soundscapes / lofi tracks in rotation.
- A custom accent color for your own constellation view.
- Early access (by a day) to the next night's prompt theme — cosmetic
  curiosity, not advantage, since the lock mechanic is unaffected.

Why this fits: doesn't touch identity, anonymity, or the moderation surface;
purely visual/audio layer on top of `field-engine.js`/`sound.js`; matches
Locket Gold's "everything free, more capacity/flair for paying users" shape.

### 2. Prompt packs (one-time purchase)
Themed prompt sets beyond the original four (e.g. a "winter" or "reunion"
pack), each with its own palette — a direct extension of the existing
`shared/prompts.js` data model. Sold once, not subscribed.

Why this fits: mirrors Wavelength's expansion-pack model exactly; the core
loop (one prompt/night) is unchanged, you're just widening the pool the
nightly hash can draw from; zero risk to the privacy invariants.

### 3. Journal sync (functional, opt-in)
Today the journal (`journal.js`) is localStorage-only — lose your phone, lose
your constellation. A paid tier could sync the journal to the account already
being built for Google-linked recovery, across devices. Free users keep
unlimited local-only history; paying users get cross-device sync/backup.

Why this fits: "freemium by limit (device-bound vs. synced), not by feature,"
same shape as Locket Gold; reuses the account system already shipped for
Google auth rather than adding new infrastructure.

### 4. One-time "patronage" support (lowest effort, lowest revenue)
A simple "support the signal" one-time payment (Stripe Payment Link, no new
backend) with no functional reward beyond a thank-you — the NYT Games /
itch.io tip-jar model, for users who just want the nightly ritual to keep
existing. Cheapest to ship, smallest revenue, zero product risk.

### Deliberately not recommended right now
- **In-experience ads** — revisit only if the user base reaches a scale where
  it's worth the immersion cost (BeReal didn't add them until then).
- **Pay-to-reveal-sender** — never, regardless of scale (NGL/FTC precedent).
- **Limiting the free nightly loop** (e.g. "1 lock/day unless you pay") — this
  is the single most replicated pattern across all of NGL/BeReal/Locket's free
  tiers and the one place they all agree: don't touch the core ritual.

## Suggested sequencing

1. Ship the architecture migration + Google auth (this round) and get real
   usage data — none of the above is worth building before there's a returning
   user base to monetize.
2. If/when there's retention worth monetizing, build **#1 (cosmetics)** and
   **#2 (prompt packs)** first — lowest risk, most on-brand, no new PII or
   moderation surface.
3. Only build **#3 (journal sync)** once the account system has been live and
   stable for a while (it's the first feature that stores more than a session).
4. Treat **#4** as a five-minute add whenever convenient — it's independent of
   everything else.

Nothing in this document should be implemented without your explicit go-ahead
on which option(s) to build.
