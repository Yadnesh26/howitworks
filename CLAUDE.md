# howitworks

Interactive 3D "how X works" explainers. Scroll navigates between steps; each
step's mechanism runs as a seamless real-time loop. Three.js (rendering) +
anime.js v4 (timelines) + Vite. Fully procedural models — no external 3D
assets, ever.

## Commands (Windows — call node by absolute path; shell cwd drifts)

- Dev server (review-shots needs it running):
  `& "C:\Program Files\nodejs\node.exe" node_modules/vite/bin/vite.js --port 5174`
- Build — run from the repo root BEFORE calling any change done. The dev
  server masks duplicate-identifier errors (blank page, zero console output),
  and the chunk list is the lazy-split proof:
  `& "C:\Program Files\nodejs\node.exe" node_modules/vite/bin/vite.js build`
- Explainer verification (THE gate — self-starts the dev server, runs the
  build, probes loops/clipping/labels/label-visibility/navigation in headless
  Chromium): `node scripts/verify.mjs <explainer-id>` → must print
  `VERIFY PASS`. The `label-visibility` gate fails the build on any callout
  hidden under the text panel or off-frame (projected at the 30%/60% poses).
- Step screenshots — the only reliable way to SEE the app (the IDE preview
  tab is compositor-throttled; `preview_screenshot` always times out):
  `node scripts/review-shots.mjs <id> [outDir] [port] [--steps=2,5] [--half] [--no-sheet]`
  Captures are deterministic (loops seeked to 30%/60% per step); a full run
  emits `contact-sheet.png` by default (one image = whole-explainer review).
  Iterate with `--steps` + `--half`; full-res full set only for final passes.
- Video export / TTS narration: `scripts/export-video.mjs`,
  `scripts/make-narration.mjs` (per-explainer editorial lives in `video.js`).
- For checks verify.mjs doesn't cover, ad-hoc Playwright probes live under
  `scripts/` (module resolution); name them `*.tmp.mjs`, delete when done.

## Map

| Path | Role |
| --- | --- |
| src/main.js | hash router: `#/` library · `#/<category>` · `#/<id>` |
| src/categories.js | category tree; explainers list theirs in meta.js |
| src/framework/registry.js | auto-globs explainer folders; eager meta.js, lazy index.js |
| src/framework/player.js | step activation, camera fly-tos, panels, progress rail |
| src/framework/stage.js | renderer, camera, studio HDRI + lights, GTAO/bloom/DoF, shadow floor |
| src/framework/parts.js, geometry.js, textures.js, labels.js | shared procedural toolkit + CSS2D callouts |
| src/framework/motion.js, callouts.js | pose-math helpers (profileTable etc.) + callout-set registry — import, don't re-implement |
| src/explainers/\<id\>/ | meta.js (eager card) · index.js (steps) · model.js (3D) · video.js (export only) |
| scripts/ | Playwright/FFmpeg export + review tooling |

## Rules

1. **Use the skills.** New/reworked explainer → `add-explainer`; fidelity
   pass → `polish-explainer`; QA → `review-explainer` (run it via the
   `explainer-reviewer` agent in a fresh context); video → `export-content`.
   They encode every hard-won convention — don't freelance the workflow.
   **Hard brakes:** the reviewer loop caps at 2 cycles (then findings go to
   the user); `polish-explainer` and video export run ONLY on explicit
   user request — never auto-chained after a build.
2. **One folder per explainer, zero registration.** `id` === folder name; the
   registry globs it. Never static-import an explainer from shared code: if
   `vite build` stops emitting `dist/assets/<id>-*.js`, the lazy split broke
   and the whole library pays for it.
3. **meta.js stays tiny** (id/title/summary/accent/categories) — it is bundled
   eagerly for the library grid, for every explainer, on every visit.
4. **The framework is shared.** Never bend stage/player/parts to one
   explainer's needs — put special behavior in that explainer's model.js.
   Scene lighting lives in stage.js only.
5. **Loops are seamless and single-owner.** Every step timeline returns to an
   identical pose at wrap (whole turns/cycles per lap) and drives the model
   through ONE local state object; two timelines tweening the same property
   silently kill each other (anime.js tween composition).
6. **Verify with evidence, not vibes**, before reporting done:
   `node scripts/verify.mjs <id>` must print `VERIFY PASS` (it codifies all
   the mechanical gates), and the review-shots screenshots must have been
   LOOKED AT — framing, occlusion, proportion, and copy-vs-visual truth are
   judged by eyes, not scripts. Self-review against the screenshots BEFORE
   spawning the reviewer; a defect found there is free, one found in a review
   round costs a whole cycle.
7. **Controls stay rotate-only.** No zoom/pan — the wheel must scroll the
   page. Any new full-viewport overlay needs `pointer-events: none`.
8. **Material/reveal traps are the #1 time sink** — before the first render
   run the pre-flight checklist in the add-explainer skill (transmission glass
   hides transparent contents; clearcoat ignores opacity; metal can't be
   ghosted, hide it; every `onEnter` must pin ALL state incl. turntable spin;
   no callout in the panel's left ~38%). These are enforced where scriptable
   (verify.mjs) but most are yours to check.
9. **Headless tooling must `scrollIntoView` a step before rendering/projecting**
   — the player's canvas only gets correct layout/aspect once its section is
   scrolled in (both review-shots and verify.mjs do this). CSS2D callout DOM
   rects go document-space under scroll; project world anchors through the
   camera instead (see verify.mjs's label gate).
10. **Secrets:** `.env` holds TTS API keys — gitignored; never commit or print.
