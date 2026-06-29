# FREQUENCY — what YOU must do by hand to earn money

This is the **manual checklist** — the things only you can do (they need your
identity, your bank account, your legal agreements). I can write the *code* for
any monetization option, but I can't open accounts, accept payout terms, or
enter your bank details. This doc separates the two so you know exactly what's
yours to do.

> First decide *which* option you want from
> [`commercialization.md`](commercialization.md). Don't set up everything — pick
> one to start. The recommended first step there is a cosmetic upgrade
> (**Frequency+**) and/or **prompt packs**, because they don't touch privacy or
> moderation. This doc lists the manual setup for each option.

## Legend

- 🧑 **You, by hand** — account signup, bank/tax info, store agreements, pricing.
- 🤖 **Code (ask me)** — I build it once your accounts exist and you give me the
  *public* IDs (never secret keys in chat — those go in env vars, like we did
  for the database).

---

## Step 0 — Things you need before any money moves (🧑)

These are required no matter which option you choose:

1. **A bank account / debit card** you can receive payouts to.
2. **Tax info** — payment providers ask for it (e.g. a tax ID, or just personal
   details for a sole proprietor). Stripe/Apple/Google all collect this.
3. **The app already deployed and live** (finish `SETUP.md` first — you can't sell
   anything until people can use it).
4. **A simple Privacy Policy and Terms page.** You already have strong privacy
   invariants; you just need them written on a page. Required by app stores and
   by Stripe/Google for paid products. (🤖 I can draft these as static pages.)

---

## Option A — "Frequency+" cosmetic upgrade (recommended first)

Sell extra palettes / soundscapes / a custom accent color. Lowest risk.

**On the web (via Stripe) — simplest path:**

1. 🧑 Create a **Stripe account** at https://stripe.com → activate it (this is
   where the bank + tax info goes).
2. 🧑 In the Stripe Dashboard, create a **Product** ("Frequency+") and a
   **Price** (one-time, e.g. $3, or a subscription, e.g. $2/mo).
3. 🧑 Easiest: create a **Payment Link** for that price (Stripe Dashboard →
   Payment Links). This gives you a URL you can put a button to — **zero backend
   code** needed to start collecting money.
4. 🤖 To actually *unlock* the cosmetics after payment (not just take the money),
   ask me to: add the cosmetic options behind a flag, and verify purchases via a
   Stripe webhook on the Render backend. You'll give me the **publishable key**
   (public) and set the **secret key** + **webhook secret** as env vars on Render
   yourself (same pattern as `DATABASE_URL`).

**On mobile (Apple/Google), if you ship the app to stores:**

- 🧑 You **must** use the stores' in-app purchase systems for digital goods
  (Apple and Google require it and take ~15–30%). That means:
  - 🧑 An **Apple Developer account** ($99/year) and/or **Google Play Developer
    account** ($25 once).
  - 🧑 Create the in-app product in App Store Connect / Play Console, set price,
    accept the paid-apps agreement, enter banking + tax.
- 🤖 I wire the Capacitor in-app-purchase plugin to those product IDs.

---

## Option B — Prompt packs (one-time purchases)

Sell themed prompt sets. Same money plumbing as Option A:

1. 🧑 Stripe product/price (web) **or** store in-app products (mobile), as above.
2. 🤖 I add the new prompt packs to the content model and gate them behind the
   purchase. You give me the product IDs.

> This is the most "on-brand" upsell and reuses everything from Option A's setup.

---

## Option C — Journal sync (subscription, functional)

Cross-device backup of the constellation/journal.

1. 🧑 Stripe subscription product + price (recurring).
2. 🧑 Confirm your Neon plan has room (the free tier is fine to start; you'd
   upgrade Neon's paid plan only if storage grows — that's a 🧑 billing decision).
3. 🤖 I build the sync (it reuses the account system already shipped) and the
   subscription check.

---

## Option D — "Support the signal" tip jar (fastest, smallest)

A one-time thank-you payment, no reward.

1. 🧑 Stripe **Payment Link** (one-time). Done — paste it behind a button.
2. 🤖 (Optional) I add a small "support" button in the UI linking to it. No
   backend, no unlock logic, nothing to verify.

This is the only option you can turn on **today** with just a Stripe link and a
button — consider it while you decide on the bigger ones.

---

## Option E — Ads (NOT recommended yet)

Listed only for completeness. From the comparison: ads cost more in churn than
they earn at small scale for an intimate, after-dark app. If you ever do:

1. 🧑 Create a **Google AdMob** account, add your app, create ad units.
2. 🧑 Complete the AdMob payment/tax setup.
3. 🤖 I'd integrate the AdMob Capacitor plugin (mobile only).

> Revisit only at real scale. Don't start here.

---

## What I will never ask you for in chat

Per how we've worked so far: **secret keys, API tokens, bank details, and
passwords never go in chat or in the repo.** They go into environment variables
on Render/Vercel (private), exactly like `DATABASE_URL` and `SESSION_SECRET`.
The only things you'd paste to me are **public** IDs (Stripe *publishable* key,
product IDs, AdMob app/unit IDs) — safe to share and meant to ship in the
frontend.

---

## Suggested order

1. 🧑 Finish `SETUP.md` so the app is live and accounts work.
2. 🧑 Open a **Stripe** account (covers web Options A–D).
3. 🧑 Decide: start with **Option D** (tip jar, 5 minutes) and/or **Option A/B**
   (cosmetics / prompt packs).
4. 🤖 Tell me which one, hand me the public IDs, and I'll build the unlock flow
   and the UI.
5. 🧑 Only if/when you go to app stores: open the **Apple/Google developer
   accounts** and create in-app products; then 🤖 I wire mobile purchases.

When you're ready, tell me the option and I'll implement it — that part is code,
and it's mine to do.
