---
name: export-content
description: Export a howitworks explainer as publishable video content — a 9:16 captioned short and a 16:9 narrated long-form video. Use when the user asks to export/render/make a video, short, reel, or YouTube version of an explainer. Covers writing the editorial layer (hooks, captions, narration in video.js), the deterministic render pipeline (export-video.mjs), TTS narration, and quality review of the output.
---

# Export an explainer as video content

Turns `src/explainers/<id>/` into publishable MP4s. The render is free and
repeatable — **the editorial layer (hook, captions, narration) is where views
are won or lost.** Spend your effort there.

## Pipeline overview

1. `src/explainers/<id>/video.js` — editorial layer (you write this)
2. `node scripts/make-narration.mjs <id> --format short|long --voice <id>` —
   ElevenLabs TTS (needs `ELEVENLABS_API_KEY` in `.env`; the script loads it
   itself). Falls back to free Edge TTS if the key is unset/fails.
3. `node scripts/export-video.mjs <id> --format short|long` — deterministic
   frame render + ffmpeg
4. Review the output frames, fix, re-render

Outputs land in `renders/<id>/`: `*-master.mp4` (silent, clean),
`*-captioned.mp4` (captions burned), `*-final.mp4` (audio mixed, only if
narration/sfx files exist), `*-timeline.json` (shot timings).

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

- **hook** (shorts, first 3s, top of frame): beat 1, under 12 words, `\n` for
  line breaks. This is separate from the shot captions.
- **short.shots**: ~70s (scale to module complexity — simpler ~50s, complex
  ~90s). **First shot shows the ENTIRE model** (establish, then zoom).
  Wide/horizontal models need per-shot `dolly` (2.0+) to fit portrait. One
  caption per shot, one line, concrete numbers. Shorts ARE narrated; the
  silent `short-captioned.mp4` variant stays for posting with trending audio.
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

## Captions are OFF by default

The user's standing preference is narration-only videos — burned one-liner
captions summarize rather than track the spoken words, so they read as out of
sync. `export-video.mjs` therefore skips the caption/hook burn unless you pass
`--captions`; `-final.mp4` is built straight from the clean master. Still write
`hook`/`caption` fields in video.js (they cost nothing and `--captions` re-
enables them for a silent trending-audio cut), but the default deliverable has
no burned text. NOTE: the in-scene 3D part-labels (CSS2D callouts on the parts)
are separate scene content and still render — hiding those is a different
change (add `.callout { display:none }` to the export's injected CSS).

## Step 3 — render

```
node scripts/export-video.mjs <id> --format short --fps 30
node scripts/export-video.mjs <id> --format long  --fps 30
```

Smoke-test new editorial at `--fps 10` first (renders ~3x faster) before
committing to a 30fps run.

## Step 4 — review before shipping (mandatory)

Extract spot-check frames from the captioned output and LOOK at them:

```
node -e "const f=require('ffmpeg-static');const{execFileSync}=require('child_process');execFileSync(f,['-y','-i','renders/<id>/short-captioned.mp4','-vf','fps=1/5,scale=540:-1','renders/<id>/check-%02d.jpg'])"
```

Check every frame for:
- **Framing**: subject fully in frame (portrait crops sides — fix with `dolly`)
- **Caption legibility**: readable at phone size, not covering the subject,
  hook not colliding with a caption
- **Motion**: mechanism visibly moving in every shot (compare consecutive
  frames if unsure — frozen loops have shipped before)
- **Long-form audio**: narration must not overrun its shot — if a segment
  feels rushed, lengthen `seconds` or cut words

Fix in video.js, re-render. Ship only what you would post.

## Facts that matter

- Firearm explainers (semi-auto-pistol): do NOT export for short-form
  platforms — age-restriction/demonetization risk. Long-form YouTube only,
  and flag it to the user first.
- `flyTo` in player.js honors `window.__hiw.cameraScale`; the export script
  drives it via `dolly`. `window.__hiw.activate(i)` is the deterministic step
  driver — keep both when refactoring the player.
- Captions burn via libass ASS subtitles with `fontsdir=C:/Windows/Fonts`;
  ffmpeg runs with cwd = renders dir to dodge Windows path escaping.
- Audio mix picks up `renders/<id>/audio/<format>-shot-NN.mp3` +
  `assets/sfx/*.mp3` cues; anything missing is skipped gracefully.
