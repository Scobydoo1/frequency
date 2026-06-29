# Adding more free music

The soundtrack is a list of tracks the game rotates through nightly and lets
players pick from the **record selector** (top-left). Adding one is two steps:
drop an audio file in, add one catalog entry. No other code changes.

## Where things live

- **Audio files:** `frequency/public/audio/` (shipped as-is; cached for offline play)
- **Catalog:** the `TRACKS` array in `frequency/src/content.js`

## Step 1 — get a track you're allowed to ship

Because FREQUENCY is intended to earn money, only use music you can legally use
**commercially**. Safe sources:

- **CC0 / public domain** — e.g. [OpenGameArt (CC0 filter)](https://opengameart.org/),
  [Free Music Archive (CC0)](https://freemusicarchive.org/). No attribution
  legally required (but the app credits artists anyway — nice to do).
- **Royalty-free with a commercial license you own** — e.g. a track you bought
  a license for, or your own music.

⚠️ Do **not** use random YouTube/Spotify rips, "free to listen" tracks, or
anything marked non-commercial. For a paid app that's a real legal risk.

**Format:** an **MP3** is required (iOS can't decode OGG). Optionally also
provide an **OGG** — Chrome/Android will prefer it, and if it's a seamless loop
the music won't click at the loop point. Keep files reasonably small (the
current ones are ~2.5–4 MB); they're committed to the repo.

## Step 2 — drop the file in

Put the file(s) here (the filename becomes the path you reference next):

```
frequency/public/audio/my-track.mp3
frequency/public/audio/my-track.ogg   # optional
```

## Step 3 — add one catalog entry

In `frequency/src/content.js`, add an object to the `TRACKS` array:

```js
{
  slug: "my-track",                 // unique id; also the saved selection key
  title: "My Track Title",          // shown in the selector + credits
  artist: "Artist Name",            // shown in the credits line
  mp3: "/audio/my-track.mp3",       // required (note: path is /audio/..., no "public")
  ogg: "/audio/my-track.ogg",       // optional — omit if you only have an mp3
},
```

That's it. The new track automatically:

- appears in the **record selector** dropdown,
- joins the **nightly rotation** (the date-seeded "tonight's record"),
- gets cached for offline play by the service worker.

## Step 4 — verify

```sh
cd frequency
npm run dev      # open http://localhost:5173, pick the track in the selector
npm run build    # confirm it builds and is precached
```

If a track's file is missing or the path is wrong, the game doesn't crash — the
synthesized radio keeps playing and that option is simply silent. So always
confirm playback after adding one.

## Note for the AI assistant

If you want me (Claude) to wire in a track, either commit the audio file to
`frequency/public/audio/` yourself first, or give me a **direct download URL on
a host the environment can reach** (the sandbox blocks many sites, including
OpenGameArt). I'll only add tracks with a clear free-for-commercial-use license
— I won't assert a license I can't verify.
