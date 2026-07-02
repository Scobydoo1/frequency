# FREQUENCY — Gumroad listing kit (selling the source code)

Everything you need to publish the source-code product on
[Gumroad](https://gumroad.com): paste-ready listing copy, pricing suggestions,
a buyer license template, and the exact steps to package the zip. Where a
section is paste-ready, it's marked **→ paste this**.

> This doc is for selling the **source code as a product**. For monetizing the
> running game itself (cosmetics, prompt packs), see
> [`commercialization.md`](commercialization.md) and
> [`monetization-setup.md`](monetization-setup.md).

---

## 1. Product name & tagline

**Name (→ paste this):**

> FREQUENCY — a multiplayer ambient game (full source code)

**Tagline / subtitle options (pick one → paste this):**

> A game about being found. React + Express + Postgres, deploys free.

> Anonymous strangers, one nightly prompt, real shared messages. Full stack, yours.

---

## 2. Short summary (Gumroad "summary" field, → paste this)

> The complete source code for FREQUENCY, a beautiful multiplayer ambient
> game: drift through the dark, find a stranger tuned to tonight's prompt,
> read the one line they left, and leave your own. Vite + React PWA frontend,
> Express + Postgres backend, synthesized radio audio, accounts, friends, and
> echo notifications. Deploys end-to-end on free tiers (Vercel + Render +
> Neon) in ~15 minutes with the included step-by-step guide.

---

## 3. Full product description (→ paste this into the description editor)

**What you're buying**

The complete, production-deployed source code for FREQUENCY — a multiplayer
ambient web game with a real shared-message backend. Not a template: a
finished, playable product with a live reference deployment.

**The game**

Every night the whole world shares one prompt ("the one you let go", "what
you've never said out loud"…). Players drift a small light through a starfield,
lock onto a stranger's signal, read the one line that stranger left, and leave
their own for whoever comes next — or skip the search and broadcast
immediately. Everything is wrapped in a lo-fi radio: synthesized static that
cleans into a carrier tone as you lock on, a nightly CC0 record, a tone dial.

**Features**

- Real shared messages with server-side moderation (links, contact info,
  hostility filtering) and player reporting
- Accounts: callsigns + passwords (scrypt), optional Google sign-in/recovery —
  email is never public, the callsign is the only identity
- Friends ("your frequencies"): keep a stranger you found, see when they last
  tuned in
- **Echoes**: when a stranger finds a signal you signed, you get a
  notification badge and a history panel of every message you've left and how
  many people found it
- A private local journal ("your constellation") of every encounter
- Installable PWA with offline play; Capacitor config included for App
  Store / Play Store builds
- Graceful degradation everywhere: the game is fully playable with zero
  backend — each env var you add lights up the next feature

**Tech stack**

- Frontend: Vite + React 18, canvas engine, Web Audio (all sound synthesized
  except the CC0 music), `vite-plugin-pwa`
- Backend: Node 20+ / Express, Postgres via `pg`, SQL migrations that
  auto-apply on deploy
- Zero paid dependencies. Deploys on the free tiers of Vercel (frontend),
  Render (API, blueprint included) and Neon (Postgres)

**What's included**

- Full frontend + backend source with tests (Vitest, both sides) and CI
  workflow
- `BUYER-SETUP.md`: 15-minute deploy checklist + complete environment
  variable reference (there are only 7, and just 4 are required)
- `SETUP.md`: a no-experience-assumed walkthrough of Neon → Render → Vercel →
  Google OAuth
- `ARCHITECTURE.md`: how it all fits together, design invariants, mobile
  (Capacitor) guide
- Deployment config: `render.yaml` blueprint (auto-generates the session
  secret), `vercel.json`
- Docs for adding music legally (CC0 sourcing guide) and monetization ideas

**Requirements**

- Node.js 20.12+ locally
- Free accounts on Vercel, Render, and Neon to deploy (no credit card
  required); optional Google Cloud project for Google sign-in

**License**

Personal/commercial license included: use it, modify it, deploy it, build a
business on it. Resale or redistribution of the source itself isn't allowed
(see LICENSE.txt in the download).

---

## 4. Pricing

Single-file source products like this typically list at **$29–$99** on
Gumroad. Suggested structure:

| Tier | Price | Contents |
|---|---|---|
| Source code | $49 | The zip: full source + guides |
| Source + 30-min setup call | $99 | Same zip + a call where you help them deploy |

Enable **"Pay what you want"** with a $49 minimum if you want to capture
generous buyers. Start higher rather than lower — you can always discount
with a Gumroad code, but raising a price on early buyers is awkward.

---

## 5. Cover image & screenshots

Gumroad's cover is 1280×720. Strong candidates, in order:

1. The intro screen (title + "tune in") — it's the brand
2. The tuning starfield with the prompt banner ("what you've never said out loud")
3. A locked reveal with a stranger's message
4. The constellation/finale screen with the nightly count
5. The "your echoes" panel (shows the social loop)

Take them from your live deployment in a 1280×720 browser window
(F12 → device toolbar → responsive → 1280×720, then screenshot). Dark,
atmospheric screenshots sell this product — avoid cropping out the starfield.

---

## 6. LICENSE.txt to include in the zip (→ paste this into a new file)

> FREQUENCY Source Code License
>
> Copyright (c) [YEAR] [YOUR NAME]
>
> Upon purchase, the buyer is granted a non-exclusive, perpetual license to:
> - use, modify, and build upon this source code for personal or commercial
>   projects, including deploying it as a live product and charging users;
> - deploy unlimited instances for themselves or a single client per license.
>
> The buyer may NOT:
> - resell, redistribute, sublicense, or publicly publish the source code
>   (modified or not) as a source-code product, template, or starter kit;
> - claim original authorship of the unmodified work.
>
> The included music tracks are CC0/public domain (see frequency/README.md
> for attribution links) and are not restricted by this license.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

(This is a starting template, not legal advice — have it reviewed if the
product takes off.)

---

## 7. Packaging the zip (what buyers download)

From a clean checkout, so no local junk gets in:

```sh
git clone https://github.com/YOUR-USER/frequency freq-release
cd freq-release
rm -rf .git                      # buyers get code, not your git history
# add LICENSE.txt from section 6 here
zip -r frequency-source-v1.0.zip . -x "*/node_modules/*" -x "*/dist/*"
```

Sanity checklist before uploading:

- [ ] `LICENSE.txt` present (section 6)
- [ ] No `.env` files inside (only `.env.example` — verify: `unzip -l frequency-source-v1.0.zip | grep .env`)
- [ ] No `node_modules/`, `dist/`, or `.git/`
- [ ] `BUYER-SETUP.md` at the root — it's the first thing buyers should open
- [ ] Version the filename (`-v1.0`) so you can ship updates as new files

---

## 8. Publishing steps on Gumroad

1. gumroad.com → **New product** → type **Digital product**.
2. Name + price from sections 1 & 4.
3. Upload the zip from section 7 as the product file.
4. Paste section 2 into the summary and section 3 into the description.
5. Upload the cover + 3–4 screenshots from section 5.
6. Add a **product URL** slug like `frequency-source`.
7. Settings worth enabling:
   - **Generate license keys** (deters casual resharing)
   - **Quantity limit** — leave off; digital goods don't need scarcity
   - A **receipt message** pointing buyers at `BUYER-SETUP.md` first
8. Publish, buy it once yourself with the 100% discount code trick
   (create a `TEST100` discount) to verify the download works, then share
   the link.

**Receipt message suggestion (→ paste this):**

> Thanks for buying FREQUENCY! Unzip and open BUYER-SETUP.md first — it gets
> you from zip to a live deployment on free hosting in about 15 minutes. The
> live demo, full docs, and architecture notes are all inside. Questions?
> Reply to this email.
