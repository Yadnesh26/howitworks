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
- Step screenshots — the only reliable way to SEE the app (the IDE preview
  tab is compositor-throttled; `preview_screenshot` always times out):
  `node scripts/review-shots.mjs <explainer-id> [outDir]`
- Video export / TTS narration: `scripts/export-video.mjs`,
  `scripts/make-narration.mjs` (per-explainer editorial lives in `video.js`).
- Ad-hoc Playwright probes must live under `scripts/` (module resolution);
  name them `*.tmp.mjs` and delete them when done.

## Map

| Path | Role |
| --- | --- |
| src/main.js | hash router: `#/` library · `#/<category>` · `#/<id>` |
| src/categories.js | category tree; explainers list theirs in meta.js |
| src/framework/registry.js | auto-globs explainer folders; eager meta.js, lazy index.js |
| src/framework/player.js | step activation, camera fly-tos, panels, progress rail |
| src/framework/stage.js | renderer, camera, studio HDRI + lights, GTAO/bloom/DoF, shadow floor |
| src/framework/parts.js, geometry.js, textures.js, labels.js | shared procedural toolkit + CSS2D callouts |
| src/explainers/\<id\>/ | meta.js (eager card) · index.js (steps) · model.js (3D) · video.js (export only) |
| scripts/ | Playwright/FFmpeg export + review tooling |

## Rules

1. **Use the skills.** New/reworked explainer → `add-explainer`; fidelity
   pass → `polish-explainer`; QA → `review-explainer` (run it via the
   `explainer-reviewer` agent in a fresh context); video → `export-content`.
   They encode every hard-won convention — don't freelance the workflow.
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
6. **Verify with evidence, not vibes**, before reporting done: build passes;
   every `window.__hiw.stepRuntimes[i]` is a live loop whose pose moves under
   `tl.seek()`; callout sets toggle on and off; `gl.readPixels` shows ~zero
   truly-clipped pixels (r+g+b ≥ 760); navigating away and back leaves exactly
   one `<canvas>` and no orphan `.callout`s; review-shots a/b pairs differ
   (frozen-loop check) and the screenshots themselves have been LOOKED AT.
7. **Controls stay rotate-only.** No zoom/pan — the wheel must scroll the
   page. Any new full-viewport overlay needs `pointer-events: none`.
8. **Secrets:** `.env` holds TTS API keys — gitignored; never commit or print.
