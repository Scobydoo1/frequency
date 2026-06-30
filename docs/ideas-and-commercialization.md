# FREQUENCY — feature ideas & how each one could make money

This file is just the **ideas** — brainstormed features and the commercialization
angle for each, nothing else. (Setup steps live in `SETUP.md`; the manual
by-hand checklist lives in `docs/monetization-setup.md`; the competitor
research behind these conclusions lives in `docs/commercialization.md`.)

**One rule every idea below follows:** the free nightly loop — tonight's
prompt, one lock, read/leave a message, anonymous or named — never changes,
never gets gated, never costs anything. Every idea adds something *next to*
that loop, never *in front of* it.

---

## 1. Cosmetic customization ("Frequency+")

**Idea:** let players reskin the experience without changing how it plays —
alternate color palettes beyond the four prompt-linked ones, different
waveform/lock-ring styles, a custom accent color for your own constellation
view, alternate lock-in chimes.

**Commercialize:** one-time unlock or small monthly subscription. Purely
visual/audio layer — touches nothing about identity, moderation, or the lock
mechanic, so it's the lowest-risk thing to sell first.

## 2. More soundscapes

**Idea:** today there are 3 lofi tracks and 4 ambient textures (rain, wind,
crickets, fire) in nightly rotation. Add more of both — a rainy-city ambience,
a vinyl-crackle-only mode, a wordless-vocal lofi pack — selectable the same
way the existing record selector works.

**Commercialize:** bundle as part of the same Frequency+ unlock, or sell as a
standalone "sound pack." Zero new infrastructure — it's more entries in the
same `TRACKS`/`AMBIENCES` arrays, just gated for non-payers.

## 3. Themed prompt packs

**Idea:** beyond the original four prompts, sell themed sets — a "winter"
pack, a "reunion" pack, a "first love" pack, a "letting go" pack — each with
its own palette, slotted into the same nightly-rotation hash.

**Commercialize:** one-time purchase per pack, not a subscription. Directly
extends `shared/prompts.js`; the core loop (one prompt a night) is unchanged,
you're just widening the pool it draws from.

## 4. Cross-device journal sync

**Idea:** the journal (your private record of encounters) is local-only today
— lose your phone, lose your constellation. Add an opt-in account-backed sync
so it follows you across devices.

**Commercialize:** subscription. Free stays unlimited-but-device-bound; paying
unlocks backup/sync, not more *content*. Reuses the account system already
built for Google sign-in — no new infrastructure.

## 5. Yearly / monthly "constellation recap"

**Idea:** a Spotify-Wrapped-style recap of your year on the frequency — how
many nights you tuned in, which prompts hit hardest, a visual replay of your
constellation. Shareable as an image.

**Commercialize:** free teaser (a few stats), full recap behind Frequency+ or
journal sync. Doubles as organic marketing if the shareable image looks good
— people repost it, it has zero acquisition cost.

## 6. Printed keepsake

**Idea:** let a player turn one saved message, or their constellation map,
into a real printed object — a postcard, a small print — mailed to them.

**Commercialize:** one-time purchase, print-on-demand (no inventory). Highest
emotional-value, lowest-volume idea on this list — a "treat yourself" buy, not
a core revenue driver, but cheap to bolt on (a fulfillment API + Stripe
checkout, no new backend logic).

## 7. Tune-together / paired frequency

**Idea:** two people who already know each other (friends list already
exists) opt into a shared private frequency — same nightly prompt, but their
messages can only reach each other. A quieter, intimate variant of the public
loop.

**Commercialize:** subscription per pair, or bundled into Frequency+. Reuses
the existing friends system; the privacy/anonymity invariants stay intact
since this is opt-in and between two consenting accounts, not a new public
surface.

## 8. Community-submitted prompts

**Idea:** let players submit prompt ideas; a curated batch gets reviewed and
added to a rotating "community pack."

**Commercialize:** doesn't sell on its own — it's a content pipeline that
*feeds* idea #3 (prompt packs) for free, keeping the catalog growing without
ongoing writing cost. Indirect monetization: cheaper content supply for a
thing you already sell.

## 9. "Support the signal" tip jar

**Idea:** no new feature at all — just a quiet, optional one-time payment
button for people who want the nightly ritual to keep existing, no reward
attached.

**Commercialize:** one-time Stripe payment, no backend logic, no unlock to
build. The fastest thing on this list to ship; independent of every other
idea.

---

## What's deliberately not on this list

- **Pay to find out who sent a message** — breaks the server-resolved
  anonymity invariant; this is the mistake NGL made (see
  `docs/commercialization.md`).
- **Limiting the nightly prompt or the lock mechanic** (e.g. "1 lock/day
  unless you pay") — kills the daily-ritual habit loop that brings people
  back; every comparable app (Wordle, BeReal, Locket) agrees on this one.
- **Ads inside the experience** — the product is an intimate, after-dark,
  sensory moment; an ad costs more in churn than it earns until there's real
  scale.

## Suggested build order

1. **#9 (tip jar)** — five minutes, ship today, learn nothing breaks.
2. **#1 + #2 (cosmetics/sound)** and **#3 (prompt packs)** — lowest risk,
   most on-brand, no new PII or moderation surface.
3. **#4 (journal sync)** once the account system has run stably for a while.
4. **#5, #7, #8** as growth/retention plays once there's a real returning
   user base to design them around.
5. **#6 (printed keepsake)** whenever — it's independent of everything else.

Nothing here is built until you pick one.
