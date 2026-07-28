---
name: export-content
description: Export a howitworks explainer as publishable video content — a 9:16 short and a 16:9 narrated long-form video. Use when the user asks to export/render/make a video, short, reel, or YouTube version of an explainer. Covers writing the editorial layer (hooks, narration in video.js), the deterministic render pipeline (export-video.mjs), TTS narration, and quality review of the output.
---

# Export an explainer as video content

Turns `src/explainers/<id>/` into publishable MP4s. The render is free and
repeatable — **the editorial layer (hook, narration) is where views
are won or lost.** Spend your effort there.

## Step 0 — before touching the pipeline (every invocation)

1. **Ask which format(s).** Never assume. Ask the user — short, long, or
   both — before generating narration or rendering. "Export content for X"
   is not "export both by default"; get an explicit answer (AskUserQuestion
   is fine for this).
2. **Check the editorial is current, not just present.** A `video.js` that
   already exists is not the same as one that reflects the latest
   conventions. Before reusing it, check it against the live checklist in
   `video-scripting`'s SKILL.md (hook = shot 1's first spoken sentence, ABT
   connective tissue not "and then," one planted loop closed in the button,
   the stat isolated on its own shot, no per-shot `caption` one-liners now
   that the verbatim rail exists) and against this file's current shape
   (single-take narration, `seconds` as a floor, no title-card `hook` burn).
   If it predates those conventions — check `git log -- src/explainers/<id>/
   video.js` against the date the skills last changed, or just read it and
   judge — rewrite it through `video-scripting` first. Do not render a stale
   script just because a file happens to be sitting there.

## Pipeline overview

1. `src/explainers/<id>/video.js` — editorial layer (you write this)
2. `node scripts/make-narration.mjs <id> --format short|long --voice <id>` —
   ElevenLabs TTS (needs `ELEVENLABS_API_KEY` in `.env`; the script loads it
   itself). Falls back to free Edge TTS if the key is unset/fails.
3. `node scripts/export-video.mjs <id> --format short|long --captions` —
   deterministic frame render + ffmpeg. **`--captions` is opt-in and you almost
   always want it** — it is also what burns the title card and end card.
4. Review the output frames, fix, re-render
5. `node scripts/make-thumbnails.mjs <id>` — 16:9 cover plates (long-form)
6. `node scripts/make-postkit.mjs <id>` — assembles `renders/<id>/POST.md`

Outputs land in `renders/<id>/`: `*-master.mp4` (silent, clean),
`*-final.mp4` (audio mixed, only if narration/sfx files exist),
`*-timeline.json` (shot timings).

**Seamless audio (audio-master pacing).** `make-narration.mjs` synthesizes a
format's ENTIRE narration in ONE ElevenLabs call (the `/with-timestamps`
endpoint), writing one continuous take `<format>-full.mp3` plus per-shot
`<format>-timings.json`. `export-video.mjs` then makes the AUDIO the clock:
each shot is held for exactly its narration span, the camera fly-to overlaps
the shot's opening words (no silent camera-move gap), and the single track
plays straight through. This is why the voiceover sounds like one performance
instead of stitched clips — do NOT go back to per-shot synthesis (it resets
intonation every clip and reintroduces the gaps). If no timings file exists
(Edge fallback), the exporter transparently uses the older per-shot path.

The render needs a dev server: start the `video-export` launch config
(port 5199) or pass `--port`. The page clock is virtualized (rAF +
performance.now stubs), so frames are deterministic and smooth no matter how
slow the machine is. Headless Chromium launches with GPU flags
(`--enable-gpu --use-angle=d3d11`) — without them WebGL falls back to
SwiftShader (CPU) and frames cost ~1s instead of ~0.1-0.2s. Default 24fps.
Different explainers can render in parallel (independent browser instances).

## Step 1 — write video.js

**Structure the script with the `video-scripting` skill first.** It owns the
editorial craft — the hook, the retention spine, the ABT connective tissue, the
plant-and-close loop, the isolated stat, and the punchy button — and hands back
a finished, read-aloud-tested script. Then write that script into `video.js` in
the shape below.

Copy the shape from `src/explainers/microwave-oven/video.js` (the reference for
the current single-take + 8-beat approach). `seconds` per shot is now just a
FLOOR — the audio drives the real pacing — so don't fuss over it; write the
script and let the narration set the length.

**Write the narration as ONE flowing voiceover, not standalone sentences.**
Because the whole script is synthesized as a single take, each shot's line
should hand off into the next (a trailing thought the next line finishes:
"…and that's when the real trick happens." → "The trick is…"). Standalone
one-fact-per-shot lines are what made earlier exports feel disconnected.

**Structure both formats on this 8-beat arc** (adapt, don't follow rigidly):
1. *Pattern interrupt* (0–3s) — a claim that sounds wrong until explained
   ("There's a lightning storm inside this box"), NOT the topic.
2. *Curiosity hook* — stack a second surprising fact.
3. *Question* — ask it out loud, a real spoken question.
4. *Reveal* — cut to the mechanism, name it.
5. *Step-by-step* — the mechanism beats, each connecting to the next.
6. *Key insight / mind-blowing moment* — the single most surprising stat,
   given its OWN shot and a beat of space (don't bury it in the steps).
7. *Real-world connection* — why it matters / a everyday consequence.
8. *Powerful ending* — callback to beat 1, short and quotable.

- **hook**: beat 1, under 12 words, `\n` for line breaks. There is no title
  card anymore — the real hook is shot 1's first spoken sentence, which the
  verbatim caption rail (see below) surfaces on screen automatically. The
  `hook` field only still burns as a standalone card on the legacy
  no-`words.json` caption path; keep it in sync with shot 1's opening line
  regardless.
- **short.shots**: ~70s (scale to module complexity — simpler ~50s, complex
  ~90s). **First shot shows the ENTIRE model** (establish, then zoom).
  Wide/horizontal models need per-shot `dolly` (2.0+) to fit portrait. Shorts
  ARE narrated.
- **long.shots**: ~2min (scale to complexity), usually every step. `narration`
  is spoken prose — contractions, short sentences, second person, ~2.3 words/
  sec. Never paste the step body copy; it's written for reading, not listening.
- Optional per shot: `dolly` (portrait pull-back, default 1.35 — raise if the
  subject crops), `sfx: [{ file, at }]` referencing `assets/sfx/<file>.mp3`.
- Consecutive shots may reuse the same `step` (e.g. beats 1–3 all on the hero)
  — the camera simply holds while the voiceover develops.

## Step 2 — narration (both formats, single take)

```
node scripts/make-narration.mjs <id> --format short --voice <voiceId>
node scripts/make-narration.mjs <id> --format long  --voice <voiceId>
```

The key is loaded from `.env` automatically. Each call is ONE ElevenLabs
request that synthesizes the whole format's script and writes
`renders/<id>/audio/<format>-full.mp3` + `<format>-timings.json` (see the
seamless-audio note above). `--voice` sets the channel voice; without it a
neutral default is used. If the key is missing/invalid it falls back to free
Edge TTS as per-shot files, and the export still works (just less seamless).
Re-run this whenever the script changes, then re-run the export to re-mix.

## Captions — off by default, ask if it's not obvious

The standing default is narration-only, clean footage — don't burn captions
unless the user asked for them (or the platform/context makes it obvious,
e.g. "make me a TikTok"). When they're wanted, pass `--captions`; follow the
`captions-overlay` doctrine (rail-first, verbatim, embed scarce — see that
skill for the full model):

```
node scripts/export-video.mjs <id> --format short --fps 30 --captions
node scripts/export-video.mjs <id> --format long  --fps 30 --captions
```

`export-video.mjs` prefers the VERBATIM RAIL: if `make-narration.mjs` wrote
`renders/<id>/audio/<format>-words.json` (the ElevenLabs word-level
alignment — it does whenever the ElevenLabs path was used, not the Edge TTS
fallback), the burned captions are word-synced to the actual narration, with
an active-word highlight, grouped into short lower-third phrases. No
per-shot `caption` fields needed — don't add them to video.js, they're the
legacy fallback path for when no words.json exists. This produces
`<format>-captioned.mp4` in addition to the silent master and the final mix.

## Step 3 — render

```
node scripts/export-video.mjs <id> --format short --fps 30 [--captions]
node scripts/export-video.mjs <id> --format long  --fps 30 [--captions]
```

Smoke-test new editorial at `--fps 10` first (renders ~3x faster) before
committing to a 30fps run.

**Overlays ride the caption pass.** Captions, the title card and the end card
are burned in ONE libass pass (each burn is a full re-encode, so they must not
cost extra passes). Consequence: no `--captions`, no overlays at all.

- **Title card** — the explainer name, top-center, first 5 seconds, then it
  clears so nothing competes with the mechanism and it cannot collide with the
  CSS2D callouts floating mid-frame. The name is derived from `meta.js`
  ("How a Refrigerator Works" → "REFRIGERATOR"); set `titleCard` in video.js
  only when that derivation is wrong. Disable with `--no-title`.
- **End card** — the closing share/funnel beat over the tail. It is scheduled
  AFTER the last spoken caption wherever the tail allows, so it never fights
  the voice rail. Override the copy with `endCard` (`\n` splits lines);
  disable with `--no-endcard`.
- **Loudness** — the final mix is normalized to ~-14 LUFS (`loudnorm`). Do not
  remove this: an un-normalized export sounds thin next to the normalized feed
  around it, which reads as amateur before a word is understood.
- **`platforms`** — optional `{ youtube: {title, description, tags}, shorts:
  {title, hashtags} }`, consumed by `make-postkit.mjs`. Author it with the
  script, not at posting time.

## Step 4 — review before shipping (mandatory)

Extract spot-check frames from the final output and LOOK at them:

```
node -e "const f=require('ffmpeg-static');const{execFileSync}=require('child_process');execFileSync(f,['-y','-i','renders/<id>/short-final.mp4','-vf','fps=1/5,scale=540:-1','renders/<id>/check-%02d.jpg'])"
```

Check every frame for:
- **Framing**: subject fully in frame (portrait crops sides — fix with `dolly`)
- **Motion**: mechanism visibly moving in every shot (compare consecutive
  frames if unsure — frozen loops have shipped before)
- **Long-form audio**: narration must not overrun its shot — if a segment
  feels rushed, lengthen `seconds` or cut words
- **If `--captions` was used**: legible at phone size, not covering the
  subject, word-sync actually tracks the voice (spot-check a few frames
  against the audio)

Fix in video.js, re-render. Ship only what you would post.

## Facts that matter

- Firearm explainers (semi-auto-pistol): do NOT export for short-form
  platforms — age-restriction/demonetization risk. Long-form YouTube only,
  and flag it to the user first.
- `flyTo` in player.js honors `window.__hiw.cameraScale`; the export script
  drives it via `dolly`. `window.__hiw.activate(i)` is the deterministic step
  driver — keep both when refactoring the player.
- The in-scene 3D part-labels (CSS2D callouts) are scene content and still
  render in the export — to hide them, add `.callout { display:none }` to the
  export's injected CSS.
- Audio mix picks up `renders/<id>/audio/<format>-shot-NN.mp3` +
  `assets/sfx/*.mp3` cues; anything missing is skipped gracefully.
- Captions burn via libass ASS subtitles with `fontsdir=C:/Windows/Fonts`;
  ffmpeg runs with cwd = renders dir to dodge Windows path escaping. Burn
  failure falls back to the uncaptioned master rather than failing the run.
