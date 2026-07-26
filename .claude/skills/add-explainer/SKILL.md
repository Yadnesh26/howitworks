---
name: add-explainer
description: Add a new 3D explainer to the howitworks site (e.g. "how an AC works"). Use whenever the user asks to add/build/create an explainer, a "how X works" page, or a new entry in the library, and when reworking/polishing an existing one. Covers the research-first realism workflow (search the real mechanism, build, validate against the reference), the defineExplainer API, procedural model conventions, seamless-loop timeline rules, and the verification routine.
---

# Add a new explainer to howitworks

## Model Requirement (Cognitive Safeguard)
**CRITICAL:** Building a new explainer requires complex 3D spatial reasoning, heavy procedural code generation, and strict adherence to framework rules. Before starting this task, remind the user that they must use a heavyweight/frontier model (e.g. Gemini 3.1 Pro, Claude Sonnet 5, or Claude Opus 4.8). If the user attempts to run this on a fast/small model (like Haiku or Fable), warn them heavily that the spatial math will likely fail before proceeding.

## What an explainer is

One folder in `src/explainers/<kebab-id>/`, zero registration (the registry
globs it): `meta.js` (tiny eager library-card data — id MUST equal the folder
name), `index.js` (`defineExplainer({ ...meta, buildScene, steps })`, lazy
per-explainer Vite chunk), `model.js` (the procedural Three.js build; no GLB
assets, ever). `categories` is an array; the folder tree lives in
`src/categories.js`. The framework provides page layout, step activation,
camera fly-tos, rotate-only orbit, progress rail, CSS2D callouts, library grid.

Reference implementations: `table-fan/` (simplest), `v-twin-engine/`
(kinematics), `jet-engine/` (instanced blades, sector cutaways),
`manual-gearbox/` (meshed-gear math, choreographed demos), `fiber-optics/`
(macro-insert scale trick, flow dots), `mechanical-watch/` (layered
product-shot scene).

**Before building, read `references/conventions.md` in this skill folder** —
the craft rules (proportions-first, placement, cinematography, state
hygiene), the full model.js/index.js conventions and API, and the war-story
gotchas live there. This core file is the process; that file is the craft.

## Commands

- **Verify (the gate):** `node scripts/verify.mjs <id>` — self-starts the dev
  server if down, runs the production build, confirms the lazy chunk, then
  probes in headless Chromium: loops live, poses move, per-step clipping,
  callout rendering, navigation cleanliness, console errors. Must print
  `VERIFY PASS` before review.
- **Screenshots:** `node scripts/review-shots.mjs <id> [outDir] [port]
  [--steps=2,5] [--half] [--sheet]` — deterministic captures (each step's
  loop paused and seeked to 30%/60% of its lap, so identical a/b = truly
  frozen pose). While iterating use `--steps` (changed steps only) and
  `--half` (cheaper to read); full-res full set only for the final pass.
  `--sheet` stitches everything into one contact-sheet image.
- The IDE preview tab is compositor-throttled — never verify through it.

## Workflow

### Phase 1 — Blueprint (one round-trip, in chat)

Research the mechanism FIRST (WebSearch + WebFetch a canonical source; batch
independent searches in ONE message; do not hallucinate mechanisms). Then, in
the SAME message as the research summary, post the Blueprint as ~15 tight
bullet lines — in chat, not an artifact — covering:
1. mechanism facts with real numbers (counts, sizes, speeds, colors)
2. proportions/ratios + the main geometry constants
3. state scalars + seamless-loop math (whole cycles per lap, geared ratios)
4. materials + accent color
5. storyboard (step 1 = the complete SEALED product, wide) + camera moves +
   where `reveal` flips
6. callout labels, per set

- If the user's request already specifies these (proportions, materials,
  steps, labels — a written spec), their spec IS the blueprint: confirm any
  deltas in one line and proceed. Do not restate their spec back for approval.
- Otherwise STOP and wait for approval before Phase 2.

### Phase 2 — Build

`meta.js` → `model.js` → `index.js` (API and conventions in
`references/conventions.md`). Shared helpers exist — import, never
re-implement: `framework/motion.js` (`clamp01`/`smooth`/`win`/`profileTable`/
`TAU`), `framework/callouts.js` (`calloutSets`), `parts.studioPlinth()`.

Work discipline: apply any list of fixes as ONE batched edit → build →
capture cycle, never one-at-a-time; run build and capture in parallel when
independent; while iterating re-render only changed steps
(`--steps`, `--half`) and look only at those images.

**Pre-flight trap checklist — check every item BEFORE the first render; each
one has cost a full fix-and-re-review cycle in this repo:**
1. Contents inside glass ⇒ plain transparent material (opacity ~0.2,
   `depthWrite:false`), never `transmission` — the transmission pass only
   samples opaque geometry, so transparent contents behind it vanish.
2. Clearcoat renders at FULL strength regardless of opacity — set
   `.clearcoat = 0` while a shell is ghosted or it still reads solid.
3. Metal can't be ghosted — hide metal shells outright on reveal
   (`.visible = false`); only low-specular plastic fades, and a WHITE shell
   must fade to ~0.1 opacity, not 0.26 (high albedo veils dark internals).
4. Every step's `onEnter` must pin ALL scene state — reveal/layers/labels AND
   turntable spin / pose scalars. Anything unpinned inherits the previous
   step's random mid-lap phase and misframes the fixed camera.
5. No callout may land in the text panel's left ~38% of the viewport, and
   every anchor must sit ON its named part — verify in screenshots, never in
   your head.
6. One LOCAL tween-state object per step timeline — two timelines tweening
   the same property silently kill each other (anime.js composition).
7. Any material that can fade to 0 needs `depthWrite: false` or it punches
   holes through glass behind it.
8. Duplicate `const` names in the one big build function break the build —
   and the dev server shows a BLANK page with zero console output; only
   `vite build` surfaces the error.
9. Seamless-loop contract: every lap advances whole turns/cycles (check
   geared ratios too); the wrap pose must be identical.
10. Every part the copy names must be UNOCCLUDED from the camera of the step
    that names it — a part the viewer can't find reads as a bug.

### Phase 3 — Verify & review (HARD CAP: 2 reviewer cycles)

1. `node scripts/verify.mjs <id>` — all gates green (investigate WARNs). The
   `label-visibility` gate now fails the build on labels hidden under the
   panel or off-frame, so those never reach a reviewer — but still eyeball
   framing, since it can't judge a label anchored to the wrong part.
2. **Self-review your own screenshots** before spawning anyone, against:
   (a) every claim in the copy is visibly true in frame — if the copy says
   "almost straight", the animation must BE almost straight; (b) every named
   part findable and unoccluded; (c) label anchors on their parts; (d)
   silhouette/proportions match the reference image. Fixing what you find
   here is free; finding it in a review round costs a full cycle.
3. **Cycle 1:** spawn the `explainer-reviewer` agent ONCE with a LEAN prompt
   — the id, the pasted verify.mjs report (so it skips mechanics), and the
   list of accepted/disclosed simplifications. Do NOT restate the storyboard
   or the mechanism facts; it reads the code and fact-checks independently.
   Its job is fact-checking, legibility, and taste.
4. **Cycle 2:** apply its ENTIRE fix list batched → re-run verify.mjs →
   **prefer** continuing the SAME agent (SendMessage) with the fix summary +
   changed-step screenshots only; it verifies deltas — no re-fact-check, no
   full re-capture. If that channel is dead (SendMessage returns "no
   transcript" — observed after infra crashes), fall back to a fresh MINI
   spawn scoped to ONLY the fix list + changed-step images (not a full
   re-review), preserving the independent second look cheaply.
5. **Stop after cycle 2 regardless of verdict.** If it isn't SHIP, present
   the remaining findings to the user with a recommendation per item
   (cosmetic vs real) — the user decides. Post-cap fixes get verify.mjs
   only; a new review round happens ONLY if the user explicitly asks.
- Crash rule: a cycle killed by infra (API error, session limit) may be
  re-spawned once via SendMessage — the agent resumes from its own
  transcript (captures + judgements intact); that resume does not count as a
  new cycle. If the transcript is gone, use the mini-spawn fallback from
  step 4. A second crash in the same cycle → surface what you have and stop.

### Phase 4 — Polish (opt-in — ASK FIRST)

After SHIP (or the cap), stop and report done. Offer the `polish-explainer`
fidelity pass in one sentence and wait for an explicit yes before touching
it. A shipped explainer is a valid end state; it does not need premium
polish to be "done".
