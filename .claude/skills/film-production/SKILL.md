---
name: film-production
description: Render a long-form film to a finished MP4 — the manifest, sfx generation, per-act narration, the render pipeline, and the mandatory review pass. Use when asked to render/export/build a film or documentary, when iterating on a film's cut, or when a film render fails or looks wrong. Different from export-content, which owns the per-explainer short and 2-minute video.
---

# Producing a film

Turns `films/<id>/film.js` into `renders/film-<id>/film-final.mp4`. The render
is deterministic and repeatable; **the script and the sound are where the film
is won or lost.** Spend effort there.

Read `films/README.md` for the manifest reference. This skill owns the *order
of operations* and the failure modes.

## Order of operations

```bash
# 1. sfx + music — cheap, do them first so the mix is never blocked on them
node scripts/make-sfx.mjs <film-id>
node scripts/make-music.mjs <film-id>

# 2. narration — one ElevenLabs take per act
node scripts/make-film-narration.mjs <film-id>

# 3. smoke render ONE act, low fps, before committing to the full run
node scripts/render-film.mjs <film-id> --acts 0 --fps 8

# 4. look at frames, fix, repeat step 3

# 5. full render
node scripts/render-film.mjs <film-id> --fps 24
```

Needs the dev server on port 5199 (`video-export` launch config). Check it is
up before a long run — a failed page load 40 minutes in is the most expensive
mistake available here.

## Iterate cheap

A 9-minute film at 24 fps is ~13,000 frames. Never iterate at full settings.

| flag | use |
| --- | --- |
| `--acts 2` | render one act |
| `--acts 0,6` | render the two acts that carry the film |
| `--fps 8` | ~3x faster; enough to judge framing and motion |
| `--no-captions` | skip the second encode pass while judging camera |
| `--keep-frames` | inspect individual frames without re-rendering |

Re-run narration only when the script changed — it costs credits and it is
the slowest non-render step.

## The mandatory review pass

**Never report a film done without looking at it.** The scripts prove
mechanics; framing, motion and copy-vs-visual truth are judged with eyes.

```bash
node -e "const f=require('ffmpeg-static');const{execFileSync}=require('child_process');execFileSync(f,['-y','-i','renders/film-<id>/film-final.mp4','-vf','fps=1/15,scale=760:-1','renders/film-<id>/check-%03d.jpg'])"
```

Then **read those frames** and check:

- **Framing** — subject fully in frame at the END of every move. Push-ins crop;
  this is the single most common defect.
- **Motion** — the mechanism is visibly moving in every shot. Compare
  consecutive frames if unsure; frozen loops have shipped before.
- **Callouts** — no label cropped against a frame edge, none floating over
  empty space. Tight shots should have `callouts: false`.
- **Cuts** — a cut between explainers should not land mid-camera-move.
- **Cards** — act cards readable, not colliding with a caption; end card has a
  readable window, not a flash.
- **Captions** — the rail is not bouncing (that means overlapping cues) and the
  words match what is spoken.

Then listen to the mix — see the `sound-design` skill's checklist.

## Failure modes

**Blank frames / page never boots.** The dev server is not on 5199, or the
explainer's chunk failed to build. Run `vite build` from the repo root; the dev
server masks duplicate-identifier errors as a blank page with no console output.

**`shot N references <explainer> step M, which has only K steps`.** Someone
edited the explainer. Step indices are 0-based positions, not ids — re-check
every film that uses an explainer after touching it.

**Deadlock at "waiting for stepRuntimes".** Any `waitForFunction` added to
`render-film.mjs` MUST pass `polling: 500`. The virtual clock replaces `rAF`
with a queue that only drains on `__vt.advance()`, and Playwright's default
`raf` polling therefore checks exactly once and hangs until timeout.

**Camera move clamped warnings.** The manifest asked for a move outside the
safe range. Do not raise the clamp — re-frame using the explainer's own step
camera if a genuinely different angle is needed.

**Audio missing from `film-final.mp4`.** `make-film-narration.mjs` writes
`act-NN.mp3` + `act-NN-timings.json`; without BOTH, the renderer falls back to
script `seconds` and mixes nothing. Check `renders/film-<id>/audio/`.

**Narration overruns / drags.** `seconds` is only a floor — the audio is the
clock. Fix the words, not the number.

## Outputs

```
renders/film-<id>/
  film-master.mp4      silent, no overlays — the reusable master
  film-captioned.mp4   captions + title/act/end cards burned in
  film-final.mp4       captioned + voice + sfx + ducked music   ← ship this
  film-timeline.json   per-act and per-shot timings
  film-captions.ass    the burned subtitle track
```

## Rules that bind

- The film pipeline never modifies `src/framework/*` or an explainer. If a
  shot needs something the explainer does not do, that is a change to the
  explainer, made deliberately and re-verified with
  `node scripts/verify.mjs <explainer-id>` — not a hack in the renderer.
- Rendering a film does NOT authorize `polish-explainer`. That needs its own
  explicit user request.
- Never print or commit `.env`.
