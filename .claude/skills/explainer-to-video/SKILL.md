---
name: explainer-to-video
description: Run the complete howitworks pipeline end to end — build the explainer if it doesn't exist, verify it, review it, script it, narrate it, and render both the 9:16 short and the 16:9 long-form video. Use when the user says "run <topic>", asks for the full/end-to-end pipeline, or wants an explainer taken all the way to finished MP4s in one go. Orchestrates add-explainer → verify → review-explainer → video-scripting → export-content; it does not replace them.
---

# Explainer → video, end to end

One command's worth of intent — "run the fridge" — becomes finished MP4s in
`renders/<id>/`. This skill is the **conductor**. Every stage's craft already
lives in another skill; this file owns only the ORDER, the GATES, and the
FAILURE POLICY. Never inline another skill's rules here — read that skill and
follow it.

## How this runs

The user says **"run <topic>"**. The coordinator spawns ONE `explainer-pipeline`
agent (Sonnet, medium thinking effort) which owns the whole run start to finish.
The coordinator does not do the work itself and does not micro-manage the agent.

**This skill is a standing, explicit authorization for video export.** CLAUDE.md
rule 1 brakes video export to explicit user request only — invoking this pipeline
IS that request, for this run, for this explainer. That carve-out does not extend
to `polish-explainer`, which still requires its own separate ask.

## Autonomy: zero stops

The user has chosen a fully autonomous pipeline. **This overrides the Phase 1
approval stop in `add-explainer`.** Do not post a Blueprint and wait; research
the mechanism, write the Blueprint into your own reasoning as the build spec,
and proceed straight into Phase 2.

Everything else in `add-explainer` still binds — especially the research-first
rule (never invent a mechanism) and the pre-flight material/reveal trap
checklist, which is the repo's #1 time sink.

The only things that stop the run are the **hard failures** listed below.

## Stages

Run in order. A stage may not start until the previous one's gate is green.

| # | Stage | Skill / command | Gate |
| --- | --- | --- | --- |
| 0 | Preflight | this file | all checks pass |
| 1 | Build (if missing) | `add-explainer` | files exist, `vite build` clean |
| 2 | Verify | `node scripts/verify.mjs <id>` | prints `VERIFY PASS` |
| 3 | Self-review | `scripts/review-shots.mjs` | you have LOOKED at every step |
| 4 | Independent review | `explainer-reviewer` agent | verdict SHIP |
| 5 | Script | `video-scripting` | pre-flight checklist passes |
| 6 | Narrate | `make-narration.mjs` × 2 formats | `<format>-timings.json` written |
| 7 | Render | `export-video.mjs` × 2 formats | both `*-final.mp4` exist |
| 8 | Frame check | ffmpeg spot-frames | you have LOOKED at them |

### Stage 0 — Preflight

Cheap checks that prevent an expensive run from dying at stage 7:

- `.env` exists and contains `ELEVENLABS_API_KEY`. If missing, the run still
  proceeds (Edge TTS fallback) but you MUST say so in the final report — the
  voiceover will be per-shot and noticeably less seamless.
- `node_modules/ffmpeg-static/ffmpeg.exe` exists. If not, `npm install` first.
- Nothing is already listening on 5199 from a dead previous run.
- Note whether `src/explainers/<id>/` exists — that decides if stage 1 runs.

Never print or echo the contents of `.env` (CLAUDE.md rule 10).

### Stage 1 — Build, only if the explainer is missing

Follow `add-explainer` completely, minus its approval stop (see Autonomy).
If the explainer already exists, skip to stage 2 — do NOT rebuild or "improve"
it. An existing explainer is treated as correct; the user asked for a video,
not a rework.

### Stage 2 — Verify

```
node scripts/verify.mjs <id>
```

Flags use `=` (`--port=5174`, `--skip-build`). Must print `VERIFY PASS`.
A FAIL is a hard failure only after you've tried to fix it — see Failure policy.

### Stage 3 — Self-review before spending a review cycle

Capture and actually look. A defect you catch here is free; the same defect
caught in stage 4 costs a whole cycle.

```
node scripts/review-shots.mjs <id> --half
```

### Stage 4 — Independent review

Spawn the `explainer-reviewer` agent in a FRESH context. Attach the stage 2
VERIFY PASS report so it skips mechanics and spends its budget on facts,
legibility, proportion and taste.

**Capped at 2 cycles** (CLAUDE.md rule 1). Apply its blocking findings as ONE
batched edit, re-verify, and continue it via SendMessage with a fix summary —
it verifies deltas only. Non-blocking taste notes do NOT earn a second cycle;
carry them to the final report instead.

If it still isn't SHIP after cycle 2: **stop and report.** Do not render a video
of an explainer that failed review — a bad model is permanent in the export.

### Stage 5 — Script

Follow `video-scripting`, then write the result into
`src/explainers/<id>/video.js` in the shape `export-content` specifies. Both
formats. Run that skill's 7-point pre-flight before moving on — especially
reading shot 1's first sentence alone, and killing every "and then".

### Stage 6 — Narrate

```
node scripts/make-narration.mjs <id> --format short --voice <voiceId>
node scripts/make-narration.mjs <id> --format long  --voice <voiceId>
```

Confirm `renders/<id>/audio/<format>-timings.json` exists for each. If it's
absent, ElevenLabs did not run and you silently fell back to Edge TTS — say so
in the report rather than passing it off as the good path.

### Stage 7 — Render

Smoke-test new editorial at `--fps 10` before committing to the full run.
Note these flags are **space-separated**, unlike verify.mjs:

```
node scripts/export-video.mjs <id> --format short --fps 30
node scripts/export-video.mjs <id> --format long  --fps 30
```

The `video-export` launch config (port 5199) must be up. Formats may render in
parallel only in separate browser instances; simplest is sequential.

### Stage 8 — Frame check, mandatory

Extract spot frames from each final MP4 and LOOK at them. Framing (portrait
crops the sides — fix with `dolly`), visible motion in every shot (frozen loops
have shipped from this repo before), and narration not overrunning its shot.
Fix in `video.js`, re-render the affected format.

## Failure policy

- **Retry twice, then stop.** Any stage that fails gets at most two fix
  attempts. Then stop and report — do not thrash.
- **Never skip a gate to keep moving.** A red gate is the pipeline working.
- **Never fake a pass.** If `VERIFY PASS` didn't print, it didn't pass.
- Firearm explainers (e.g. `semi-auto-pistol`): render **long only**. Do not
  produce a short — age-restriction and demonetization risk. Flag it in the
  report.

## Final report

Report to the user, not just to the transcript:

1. Paths to both MP4s, with file sizes and durations.
2. Whether the explainer was newly built or already existed.
3. The reviewer's verdict and any non-blocking findings carried forward.
4. Whether real ElevenLabs narration or the Edge fallback was used.
5. Anything you retried, and anything you left undone.

Do not report success on a run where a gate was skipped. Say which one, and why.
