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

- **Anisotropy** — brushed metal's stretched highlight [VALIDATED,
  2026-07-28, air-conditioner copper refrigerant tubing]: `materials.anisoSteel(color, rotation)`
  now exists in `parts.js` (`anisotropy: 0.7` over the `brushedSteel` base).
  Requires UVs (lathe/cylinder/tube geometry all have them). `rotation` must
  match the geometry's UV layout — on `TubeGeometry` (drawn pipe/tube: U
  wraps the circumference, V runs along the length) the real brushing grain
  runs along the length, so pass `Math.PI/2` to rotate off the default
  U-alignment onto V; on a flat/lathe surface where U already runs the
  brushing direction, pass `0`. Always eyeball a close-up screenshot before
  trusting a rotation — perpendicular-to-grain stretch looks wrong instantly.
  Costs a small amount of specular energy (watch the clipped-pixel scan —
  measured +9 to +34 clipped px on air-conditioner's close-up steps, still
  far under the 150px limit). FAILURE (2026-07-30, wireless-charging litz
  coils): applying it to the transmitter/receiver flat spiral coils blew the
  budget to 800-3950 clipped px on the coil/induction/battery close-ups — a
  large flat spiral filling much of a macro frame concentrates the stretched
  highlight far more than a slim tubing run does. Reverted to plain
  `MeshPhysicalMaterial` copper. Don't reapply anisotropy to large
  frame-filling coil/spiral geometry at macro camera distance without
  re-verifying the clipped-pixel scan per step. FAILURE (2026-07-30,
  mechanical-watch case band): same failure mode on a curved LatheGeometry
  ring rather than a flat spiral — the case band's inner bevel fills most of
  the frame on the escapement/balance macro steps, and `anisoSteel` there
  blew clipped px to 2171/3594. Confirms the pattern is about frame coverage
  at macro distance, not the specific geometry type (tube vs spiral vs lathe
  ring) — anything curved-and-large in a macro shot is high risk. Reverted to
  plain `brushedSteel`.
  NON-FAILURE (2026-08-05, dslr-camera lens bezel/mount/bayonet trim): applied
  `anisoSteel(color, 0)` to the whole trim group — including the front bezel
  ring, which rims the frame on the aperture macro step — and clipped px did
  not move at all (10 worst, unchanged, limit 150). Rotation 0 is right for a
  bezel: on those cylinders U wraps the circumference, which is the direction a
  lens ring is actually brushed. Refines the rule: the risk is a large curved
  surface whose BRIGHT FACE fills a macro frame (case band, flat spiral), not
  merely a ring that is on-screen at macro distance — a slim ring seen edge-on
  is safe. Still re-run the scan; it is cheap.
- **Clearcoat** [VALIDATED]: already in `materials.paintedMetal` (clearcoat 1,
  clearcoatRoughness 0.14). Use for painted housings, glossy plastic, lacquer.
- **Matte polymer** [VALIDATED — semi-auto-pistol (2026-07-18)]:
  `materials.polymer(color)` (roughness 0.74, clearcoat 0.15). Use for moulded
  polymer/tool/appliance bodies — `paintedMetal`'s glossy coat reads as cheap
  wet plastic on these, and a high clearcoat also renders at full strength
  while a shell is ghosted (fights the x-ray reveal). Low coat ghosts cleanly.
- **Fingerprint smudges on gloss** [VALIDATED — mechanical-watch (2026-07-30),
  crystal]: `textures.js` already had `smudgeMap()` (dark base, faint lighter
  ellipse clusters) — apply as `clearcoatRoughnessMap` with a modest
  `clearcoat` (0.5) and `clearcoatRoughness` (0.25) on top of a transmissive
  base (smudges live in the *coat*, not the base — this is exactly how real
  fingerprints on a watch crystal behave). Nudged the clip gate up slightly
  (added specular energy per the roughnessMap caution below) but stayed
  within budget across repeat runs. CONFIRMED again (2026-08-05, dslr-camera
  rear LCD) on a NON-transmissive base: same `clearcoatRoughnessMap:
  smudgeMap()` over `clearcoat: 0.8`, with `clearcoatRoughness` raised
  0.08 -> 0.22 so the map has something to modulate. Zero change in clipped px.
  A rear screen that has never been thumbed is one of the loudest
  born-in-a-computer tells on any consumer product.
- **Real refractive glass** [VALIDATED — mechanical-watch (2026-07-30),
  domed crystal]: replace the fake opacity-glass preset with `transmission: 1,
  roughness: 0.04, thickness: 0.08` (thin shells like a watch crystal; thicker
  for solid glass), `ior: 1.52, transparent: false`. No `alpha:true` conflict
  in practice — the dial/hands/batons behind the crystal all rendered through
  it correctly, no black or page-background leak. The dome even picks up a
  soft studio-softbox reflection that reads as authentic product-photography
  gloss rather than a bug. CAUTION still open: frame-cost couldn't be reliably
  measured in this session's headless environment (repeat A/B timings
  flip-flopped both directions run to run, swamped by environment noise, even
  after killing duplicate dev-server processes) — verify.mjs passed cleanly
  across multiple runs, which is the real functional gate, but if you have
  access to a real (non-headless, real-GPU) browser, a quick frame-cost sanity
  check is still worth doing before shipping this on a lower-end target.
  CONFIRMED (2026-08-05, dslr-camera lens elements): same numbers with
  `thickness: 0.16` and `ior: 1.62` (optical crown glass, not window glass)
  turned a flat grey disc into a lens front that reads as real glass — the
  single biggest visual return in that model's whole pass. Now available as
  `materials.opticalGlass({color, thickness, ior, coating})` in `parts.js`.
  Clipped px went 1 -> 10 (limit 150); frame cost stayed under budget because
  the elements are HIDDEN on the x-ray steps, so transmission only doubles the
  draw calls (93 -> 224) on the three sealed-product steps.
  THIRD CAUTION discovered: the transmission backbuffer excludes transmissive
  objects, so two stacked do not render through each other — three lens
  elements in a row show only the front one. Fine (often better) when what you
  need to see behind the glass is opaque; fatal if it isn't.
  FOLLOW-ON TRAP, cost a user-reported regression: real glass DARKENS the whole
  cavity behind it. Anything inside that was legible against the old fake-glass
  veil can end up the same near-black as its background — here the aperture
  blades and the hole between them both went black and the iris lost its edge
  entirely. After switching a part to transmissive glass, re-check the contrast
  of everything BEHIND it and re-light/re-tone those parts (blackened blades ->
  satin steel at 0x79818d/metalness 0.8/roughness 0.42 fixed it, and reads
  truer to "steel blades" anyway).
  - Other `transparent: true` objects BEHIND transmissive glass may not
    render through it. Check every step camera that looks through the glass.
  - `dispersion` (rainbow edges) only reads on thick glass; skip for thin
    crystals.
- **Iridescence** [VALIDATED — mechanical-watch (2026-07-30), same crystal;
  again on dslr-camera lens elements (2026-08-05) at `iridescence: 0.28`, where
  a camera's multi-coating sits — a lens coating is genuinely louder than a
  watch crystal's, and 0.28 still reads as a coating, not a soap bubble]:
  the blue-purple anti-reflective-coating sheen on real watch crystals /
  camera lenses: `iridescence: 0.15,
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
  rather than ship a mediocre blur. CONFIRMED again (mechanical-watch,
  2026-07-30, escapement/balance macro steps): used a more conservative
  0.00012 aperture (not the full 0.00016) specifically because this scene
  already had a known bright-plate hotspot behind the gear train (see the
  mainplate note in the failure-mode memory) — clipped px on both DOF steps
  landed near 0-60 across repeat runs, comfortably under budget. Matting the
  bright metal FIRST (before enabling DOF) is what made this safe; enabling
  DOF on a scene with an unresolved specular hotspot would very likely have
  reproduced the pistol gotcha.
- **Grain + vignette** [CANDIDATE]: tiny ShaderPass before OutputPass —
  grain amplitude ~0.02, vignette darkening ~0.25 at corners. Cheap, makes
  frames feel filmed; same opt-in route as DOF.
- **Per-step light dressing** [CANDIDATE]: expose a
  `setLightMood({keyIntensity, rimColor})`-style stage handle so a "hot"
  step (combustion, compressor) can warm the rim light. Snap it in onEnter
  like setDress; never tween stage lights from step timelines (gotcha #1 in
  add-explainer applies).

### Rung 5 — Motion & camera craft [CANDIDATE]

Classical-animation principles adapted to machinery. Apply per-step, one change
at a time, same verify block — and every one must still wrap seamlessly (whole
cycles per lap; the settle/anticipation happens *within* the loop, not at its
edges).

- **Mechanical easing (inertia)**: heavy parts take time to start and stop —
  eased spin-up (`easeInQuad`-ish) and settle (`easeOutCubic`) around a linear
  cruise; gears/belts cruise linear. A part snapping into place gets a
  micro-settle (`easeOutElastic` at very low elasticity — a metal *lock*, not a
  cartoon boing) instead of an instant stop.
- **Anticipation & follow-through** [VALIDATED, 2026-08-05, dslr-camera mirror
  + shutter curtains]: before a strike/release (hammer, sear, valve), pull back
  a fraction first — it cues the energy release. After a halt, let secondary
  parts (springs, linkages) settle a few frames later — stagger the timeline so
  not everything stops on the same frame. Implement both as narrow Gaussian
  bumps on the lap parameter, added INSIDE the pose function
  (`0.014 * Math.exp(-(((u - at) / w) ** 2))`) — not as anime easings, since
  the loop is one linear tween. TRAP: a Gaussian centred near u=0 (or u=1) has
  a non-zero tail at the OTHER end of the lap, so the wrap pose stops matching
  and the loop seams. Keep every bump's centre at least ~3 widths inside the
  lap, or gate it off in the timing variant that pushes its event to the edge.
  verify.mjs CANNOT catch this — it only samples 20% vs 70% — so diff the pose
  at u=0 against u=1-epsilon yourself. Apply a curtain/shutter settle to the
  moving SLATS only, never to the scalar that also drives an exposure or flow
  fraction, or the derived quantity flickers.
- **Camera moves with intent**: push in by dollying the camera, never by
  animating FOV; track parallel to a flow being explained (fluid path, sliding
  piston) so the viewer reads the spatial route; put the point of interest on a
  thirds intersection rather than dead center. Every move must have a narrative
  reason — orbit to reveal form, push in to isolate detail.

## Frame-cost budget (measure, don't guess)

The preview tab is compositor-throttled — FPS counters and rAF timing are
meaningless there. Measure explicit render cost instead, which works fine:

```js
// preview_eval, after preview_resize to 1280×800 + reload
(() => { const s = window.__hiw.stage; const t0 = performance.now();
  for (let i = 0; i < 30; i++) s.composer.render();
  return (performance.now() - t0) / 30; })()
```

Warm EVERY step before timing anything (activate each, render ~10 frames).
Shader compilation happens on a material's first render, so whichever step you
measure first otherwise eats the whole compile and reads 5-10x high — on
dslr-camera an unwarmed first step reported 34-84 ms and a warmed one 5 ms,
same code. Timings still swing run to run in headless/SwiftShader (see the
transmission note above); draw calls and triangle counts are deterministic and
are the numbers to trust when timings disagree.

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
