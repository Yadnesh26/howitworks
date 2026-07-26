---
name: polish-explainer
description: Raise an existing howitworks explainer to premium product-shot fidelity — physical material upgrades (anisotropy, real transmission glass, clearcoat smudges, sheen, iridescence), filleted/greebled geometry detail, imperfection maps, and per-step cinematography (depth of field). Use when the user asks to polish, add realism/detail, upgrade graphics quality, or run a "fidelity pass" on an explainer that already works. Techniques are marked VALIDATED (proven in this codebase) or CANDIDATE (untested here — verify, then promote).
---

# Fidelity pass: premium product-shot quality

Prerequisite: the explainer already works (built via the add-explainer skill,
loops seamless, verification green). This skill makes it *look expensive*.

## The target — and what NOT to chase

The bar is **Apple-product-page real-time 3D**: clean, deliberate, premium.
It is explicitly NOT Branch-Education-style clutter realism (photoreal PCBs,
every wire modeled) — that look needs offline path tracing and artist-months
per model, and a half-reached version of it reads as cheap. Clean-premium is
reachable in this stack and is more legible for education anyway.

Two standing rules inherited from add-explainer still bind: **fully
procedural** (no GLB), and **consistency across the library beats peak
fidelity on one model** — every material/technique that survives a fidelity
pass must be folded back into `src/framework/parts.js` / `textures.js` as a
preset, never left inlined in one explainer's model.js.

## Discipline for executing this skill

This skill may be executed by a smaller/faster model. These rules are not
optional:

1. **One technique at a time.** Apply a single rung of the ladder below, run
   the verify block, then move on. Never batch three material changes and
   verify once — when clipping or perf regresses you won't know which change
   did it.
2. **VALIDATED vs CANDIDATE.** VALIDATED techniques are proven in this
   codebase with the exact numbers given. CANDIDATE techniques are researched
   but never run here — treat their numbers as starting points, verify
   skeptically, and when one succeeds, edit THIS file: mark it VALIDATED with
   a dated note and any corrected numbers. If one fails, revert it fully,
   record the failure here, and report — do NOT improvise a workaround
   silently.
3. **Never regress the base guarantees**: seamless loops, drag-to-orbit,
   scroll navigation, ~zero truly-clipped pixels, the per-explainer lazy
   chunk. The verify block re-checks all of them.
4. **Taste decisions belong to the user's screenshots.** If a change is
   verifiably correct but you cannot judge whether it looks *better*, ship it
   to the dev server and ask for a screenshot round rather than guessing.

## The upgrade ladder (ordered by visual return)

Work top to bottom; stop where the user's appetite stops.

### Rung 1 — Fillets and micro-detail [VALIDATED pattern]

Nothing real has a sharp edge; bevels catching light are the single biggest
"real vs CG" tell.

- Sweep model.js for raw `BoxGeometry`/sharp lathe profiles → `beveledBox`,
  rounded lathe profiles (insert small arc segments at corners).
- "No flat cut faces" (add-explainer rule) applies with more force here:
  domes, capsules, torus rims on everything that ends.
- Detail seasoning where the camera goes close: `boltCircle` screws, seam
  grooves (thin dark torus/tube inset at part joins), vents (`finStack`),
  chamfered counterbores around fasteners. Budget: the closest-approach
  camera step decides where detail is spent; don't greeble what no step sees.
- Engraved text (casebacks, rating plates) [CANDIDATE]: canvas texture with
  text → use as `bumpMap` (bumpScale negative for engraving) plus slightly
  darker `map` tint on the same canvas. Keep it subtle; verify legibility at
  the actual step camera distance, not zoomed.

### Rung 2 — Physical material features (three r185 supports all of these)

- **Anisotropy** — brushed metal's stretched highlight [CANDIDATE]:
  `mat.anisotropy = 0.7`, `mat.anisotropyRotation = 0 or Math.PI/2`.
  Requires UVs (lathe/cylinder geometry has them). Try both rotations and
  keep the one where the highlight stretches ALONG the brushing grain
  (perpendicular-to-grain stretch looks wrong instantly). Apply to
  `brushedSteel` surfaces first — watch case band is the testbed. After
  validation, add a `materials.anisoSteel(color, rotation)` preset.
- **Clearcoat** [VALIDATED]: already in `materials.paintedMetal` (clearcoat 1,
  clearcoatRoughness 0.14). Use for painted housings, glossy plastic, lacquer.
- **Matte polymer** [VALIDATED — semi-auto-pistol (2026-07-18)]:
  `materials.polymer(color)` (roughness 0.74, clearcoat 0.15). Use for moulded
  polymer/tool/appliance bodies — `paintedMetal`'s glossy coat reads as cheap
  wet plastic on these, and a high clearcoat also renders at full strength
  while a shell is ghosted (fights the x-ray reveal). Low coat ghosts cleanly.
- **Fingerprint smudges on gloss** [CANDIDATE]: procedural smudge canvas →
  `clearcoatRoughnessMap` (smudges live in the *coat*, not the base — this is
  exactly how real fingerprints on a watch crystal behave). Faint: texels
  0.1–0.35 over base clearcoatRoughness.
- **Real refractive glass** [CANDIDATE — big one]: replace the fake
  opacity-glass preset with `transmission: 1, roughness: 0.04,
  thickness: 0.08 (thin shells like a watch crystal; thicker for solid
  glass), ior: 1.52, transparent: false`. CAUTIONS:
  - One transmissive material triggers an extra full scene render into the
    transmission buffer — measure frame cost (verify block) before and after.
  - Our renderer runs `alpha: true`; if the glass shows the page background
    or black instead of the scene behind it, the transmission buffer is
    fighting the alpha context — revert to the fake glass preset and record
    the failure here.
  - Other `transparent: true` objects BEHIND transmissive glass may not
    render through it. Check every step camera that looks through the glass.
  - `dispersion` (rainbow edges) only reads on thick glass; skip for thin
    crystals.
- **Iridescence** [CANDIDATE]: the blue-purple anti-reflective-coating sheen
  on real watch crystals / camera lenses: `iridescence: 0.15,
  iridescenceIOR: 1.3, iridescenceThicknessRange: [100, 400]` on the glass
  material. Subtle is the point — at 1.0 it's a soap bubble.
- **Sheen** [CANDIDATE]: fabric/velvet (display cushions, seat cloth):
  `sheen: 1, sheenRoughness: 0.4, sheenColor` slightly lighter than base.
- CAUTION (inherited, still applies): `roughnessMap` MULTIPLIES base
  roughness; anisotropy and clearcoat both add specular energy — after ANY
  material change, re-run the clipped-pixel scan.

### Rung 3 — Imperfection maps [CANDIDATE pattern]

Surfaces that have never been touched are the tell that a scene was born in
a computer. Extend `src/framework/textures.js` (all canvas-procedural, match
the existing `brushedMap`/`grimeMap` style):

- **Dust**: sparse pale speckles composited INTO the roughness canvas of
  up-facing surfaces (three.js takes one roughnessMap — compose layers on
  one canvas rather than stacking maps).
- **Smudges/fingerprints**: soft ellipse clusters — clearcoatRoughnessMap on
  coated parts (see rung 2), roughness canvas elsewhere.
- **Located wear**: `grimeMap`'s directional-pooling idea generalizes — wear
  belongs where hands/heat/oil actually go (crown of a watch, handle edges,
  around fasteners). Uniform noise reads as dirt; located wear reads as use.
- Keep it at 10–20% visibility. If a screenshot round says "looks dirty",
  halve it.

### Rung 4 — Per-step cinematography

- **Depth of field** [VALIDATED — microwave-oven, semi-auto-pistol
  (2026-07-18)]: `BokehPass` from
  `three/addons/postprocessing/BokehPass.js`, inserted AFTER GTAOPass and
  BEFORE UnrealBloomPass in `createStage`'s composer chain. Already wired:
  opt in with `stageOptions: { dof: true }` on defineExplainer, and set
  per-step `dofAperture` (player focuses at the step's camera→target distance;
  default 0.00002 keeps unset steps sharp). Working aperture ladder: macro
  close-ups 0.00016; medium 0.0001; overview/wide/deep-scene steps
  0.00001–0.00003 (near-sharp). GOTCHA (pistol): BokehPass runs BEFORE bloom,
  so it concentrates bright specular/glints into clipping bokeh discs — an
  overview step full of chrome springs went from 65→235 clipped px at only
  0.00006 aperture, and lowering aperture alone did NOT clear it. The fix that
  worked: keep overview steps near-zero aperture AND matte the bright metal
  (mirror-chrome internals → roughness ~0.34 satin steel reads truer anyway).
  Re-run the clipped-pixel scan at EVERY step after enabling DOF. HONEST
  WARNING: BokehPass is a simple shader and can look smeary rather than
  filmic — if a screenshot round doesn't clearly win, drop DOF entirely
  rather than ship a mediocre blur.
- **Grain + vignette** [CANDIDATE]: tiny ShaderPass before OutputPass —
  grain amplitude ~0.02, vignette darkening ~0.25 at corners. Cheap, makes
  frames feel filmed; same opt-in route as DOF.
- **Per-step light dressing** [CANDIDATE]: expose a
  `setLightMood({keyIntensity, rimColor})`-style stage handle so a "hot"
  step (combustion, compressor) can warm the rim light. Snap it in onEnter
  like setDress; never tween stage lights from step timelines (gotcha #1 in
  add-explainer applies).

## Frame-cost budget (measure, don't guess)

The preview tab is compositor-throttled — FPS counters and rAF timing are
meaningless there. Measure explicit render cost instead, which works fine:

```js
// preview_eval, after preview_resize to 1280×800 + reload
(() => { const s = window.__hiw.stage; const t0 = performance.now();
  for (let i = 0; i < 30; i++) s.composer.render();
  return (performance.now() - t0) / 30; })()
```

Budget: **≤ 10 ms average** (leaves headroom for animation + labels at 60fps
on mid-range GPUs). Measure BEFORE starting the ladder to get the model's
baseline, and after each rung. Transmission and DOF are the two expensive
rungs; if either blows the budget, it goes, regardless of how it looks.
Also check `renderer.info.render.calls` hasn't ballooned — heavy greebling
should ride instancing (`bladeRing`-style / InstancedMesh), not hundreds of
new meshes.

## Verify (after EVERY rung)

Same infrastructure as add-explainer's verify (state-based; screenshots time
out; user's eyes are the aesthetic gate):

1. Frame cost within budget (above); draw calls sane.
2. Clipped-pixel scan at every step camera (r+g+b ≥ 760/765 ≈ zero) —
   anisotropy/clearcoat/transmission all move specular energy around.
3. Loops still seamless (seek lap start vs lap end — poses identical),
   layer toggles still exact, labels still render.
4. If glass went transmissive: at each step that looks through it, confirm
   scene-behind-glass is visible (not black, not page background) via a
   readPixels patch through the glass region.
5. Build from repo root passes; the explainer's own chunk still exists (new
   framework imports must not statically drag explainer code into the
   shared chunk).
6. Ship to dev server → user screenshot round for the aesthetic verdict.

## Rollout order

First testbed: **mechanical-watch** (anisotropic case band, transmissive +
iridescent crystal, fingerprint clearcoat smudges, filleted lugs, DOF on the
macro escapement/balance steps). It has the most reflective close-up
geometry — if a technique survives the watch, it's safe everywhere. Then
fold survivors into `parts.js`/`textures.js` presets and sweep the other
explainers cheapest-first (table-fan → AC → engines). Update the preset docs
in add-explainer's model.js conventions when presets change.
