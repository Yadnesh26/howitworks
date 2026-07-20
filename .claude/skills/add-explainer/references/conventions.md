# add-explainer reference — craft, conventions & API

Loaded on demand from SKILL.md. The workflow/process lives in SKILL.md; this
file is the craft knowledge and the full API conventions.

## The bar: impress people

These pages live or die on "whoa". Aim for maximum realism with zero
restrictions on model complexity — fully procedural (no GLB assets, that's the
one hard rule), but as many parts, greebles, and correct mechanism details as
it takes.

- **Present like a product shot, not a diagram.** Neutral studio staging:
  the machine itself, plus at most an abstract display prop (charcoal plinth —
  use `parts.studioPlinth()`). NEVER stylized human anatomy (arm/hand/wrist) —
  a cartoon body part next to a realistic machine makes the whole scene read
  as a toy. Tried three times on the watch; user killed it each round.
- **Open on the COMPLETE, SOLID product — never a skeleton.** Step 1 must be
  the finished object as you'd actually see it: opaque outer shell, no guts
  showing. THEN, as the user scrolls, ghost/lift the shell to reveal the
  mechanism. Starting already-exploded or already-cut-away reads as a
  wireframe/skeleton and kills the "whoa, it's a real thing" hook — the user
  has rejected this explicitly. Build the outer skin on its own material(s),
  expose a `setReveal(t)` handle, pin `reveal` in every step's `onEnter`
  (0 = solid, 1 = revealed), and re-solidify near the end (the "run it"
  finale spins the complete object again). Any real opening (muzzle, port,
  nozzle, intake) must be an ACTUAL hole — a face plate with a circular
  `Path` hole, never a solid disc a moving part would pass through.
- **Real mechanisms, real numbers.** If you are not POSITIVE how the
  mechanism works or looks, research it BEFORE building (WebSearch +
  WebFetch a canonical source — e.g. ciechanow.ski for watch/gears/sound).
  Get the canonical facts: tooth counts (Swiss lever escape wheel = 15),
  part proportions, colors, motion direction. Viewers who know the machine
  will notice.
- **Proportions are the single most important thing — get them right BEFORE
  any detail.** Pull a reference image and read off the major RATIOS
  (overall length:height, each big part relative to the others). Derive
  EVERY constant in model.js from ONE consistent scale so the ratios hold by
  construction, and state the target ratios in a comment block. After the
  first render, compare the silhouette to the reference and fix proportion
  mismatches before touching anything else. (A pistol shipped with a slide
  ~1.8× too long, reading as an SMG; the watch first rendered
  dinner-plate-sized.)
- **Placement is second only to proportions.** Right-sized parts in the
  wrong place still fail: after proportions, verify every named part is
  UNOCCLUDED and legible from the camera that features it. (The pistol
  trigger was correctly modelled but hidden at grip depth from every front
  angle; moving it into the open trigger guard fixed it.)
- **State hygiene: one thing, one place, one time.** Anything that represents
  a consumable or moving state (a chambered round that later ejects, a spark,
  a fluid packet) is shown ONLY during its phase and hidden otherwise —
  drive visibility from the same scalar as the motion
  (`mesh.visible = revealed && phaseWindow`). Never leave a stale copy behind.

The premium-fidelity ladder (anisotropy, transmission glass, imperfection
maps, DOF experiments) lives in the polish-explainer skill — new models use
its already-VALIDATED presets but never run its CANDIDATE experiments while
building; build first, polish as its own (user-requested) pass.

## Cinematography & mechanical motion

The machine loops on its own — the only "edit" the viewer experiences is the
camera fly-to between steps. Direct those like a product film:

- **Give every fly-to a shot type.** Hero arc (orbit 30–60° between overview
  steps), macro push-in (same target, much closer), tracking move (target
  slides along the machine's axis following a flow). Two consecutive cameras
  that differ only trivially read as a glitch.
- **Frame off-centre (rule of thirds).** The text panel owns the left ~38%
  of the viewport — compose for the right side, verify in review-shots.
- **Mass in the motion.** Continuous rotation stays `linear` (the loop
  contract); anything that starts/stops/engages carries inertia, shaped
  INSIDE the pose function or speed profile (`motion.profileTable`, cosine
  spin-ups, smoothstep travel) — not via anime easings, since each loop is
  one linear tween.
- **Anticipation → action → settle.** Pull back a fraction before a discrete
  event; settle with a tiny damped overshoot (1–2% of travel, ≤2
  oscillations — machined parts don't wobble). Stagger secondary parts a few
  percent behind the primary.
- **True pivots.** Parent every hinged part at its physical pivot and pose by
  rotation — never lerp positions of something that physically swings.
- **Motion per sentence + point at the subject.** Every step's copy/narration
  must have a VISIBLE referent: the part it names should be moving AND
  highlighted. Set `focus: ['<label key>']` on the step — the framework pulses
  those callouts (accent glow) so the viewer never hunts for the part being
  explained (`setFocusCallouts`, wired in the player; keys are `callout({key})`
  or the label text). For a part whose material has its own emissive, opt into
  `parts`-level glow with `pulseEmissive(stage, mesh, {accent})` from
  `framework/highlight.js` (bloom turns it into a real glow) — skip it on
  shared/ghost materials or the highlight bleeds across the frame.

Lighting and DOF are NOT per-explainer knobs: the stage owns the studio rig
(HDRI + key/rim + GTAO/bloom). DOF: set `stageOptions: { dof: true }` on
defineExplainer and a per-step `dofAperture` (the player focuses at each
step's camera-to-target distance automatically; ~0.00002 = sharp wide,
~0.0003 = macro pull). Never add scene lights in model.js (tiny emissive
accents inside the model excepted — point lights inside closed geometry need
FAR lower intensity than in the open; start ~3, not ~30).

## Interaction model

- Every step's timeline runs as a seamless LOOP while active (player default
  `mode: 'loop'`). Scrolling navigates between steps; it does not scrub.
- Drag-to-orbit works on every step (rotate-only; zoom/pan stay OFF — the
  wheel must scroll the page).
- The overlay stack is `pointer-events: none` with opt-ins on `.panel`,
  `.back-link`, `.rail-dot`, `.canvas-holder` — any new full-viewport overlay
  needs `pointer-events: none` or it eats the drag.
- `mode: 'scrub'` still exists (scroll-driven timelines) but is no longer the
  default; only use when a step explicitly needs scroll-scrub.

## Story shapes

4–9 steps — cover what the machine needs. Two proven shapes:
- *Zoom-in / reveal* (PREFERRED for anything with a real outer shell —
  engines, guns, appliances, watches): step 1 the finished product SOLID,
  then a "look inside" step (`setReveal(1)` / peel a layer), then mechanism
  by mechanism, re-solidify near the end, finish `freeOrbit: true` fast.
- *Anatomy-first* (only for things with no meaningful skin — a bare circuit
  component, an exposed gear train): step 1 overview with callouts on, then
  one mechanism per step, fast freeOrbit finale.
In all steps the CAMERA provides the focus; the machine just keeps running.

## model.js conventions

- Toolkit imports:
  `import { materials, rod, box, disc, arrow, studioPlinth, chargeQueue } from '../../framework/parts.js';`
  `import { beveledBox, lathe, finStack, tubeAlong, boltCircle, bladeRing, gear, chainPath } from '../../framework/geometry.js';`
  `import { clamp01, smooth, win, profileTable, TAU } from '../../framework/motion.js';`
  `import { calloutSets } from '../../framework/callouts.js';`
- **Materials**: v2 physical presets — `aluminum`, `brushedSteel`, `chrome`,
  `paintedMetal`, `rubber`, `grimyAluminum`, `heatBluedSteel('u'|'v')`.
  CAUTION: `roughnessMap` MULTIPLIES base roughness (map texels ≈ 0.5) — the
  presets read near-chrome on large/curved surfaces; override `.roughness`
  upward (blades 0.85, casings 0.7). Extruded geometry (gears) has ad-hoc
  UVs — use map-free materials there or the maps sample garbage texels.
- **Never leave a concave metal interior visible** (DoubleSide casing seen
  from inside = curved mirror = blowout). Solid casings are FrontSide + a
  dark rough liner inside (see jet-engine).
- **Geometry**: bevel everything (`beveledBox`); pipes bend (`tubeAlong`);
  blade stages are `bladeRing` (instanced); fluid circuits are `chainPath`
  (packets ride `getPointAt`). Greeble with `boltCircle`/`finStack`/flanges.
- **Labels**: `calloutSets(['exterior', 'internal', …])` from
  framework/callouts.js — `add(set, parent, text, offset, dir, len)`, expose
  its `setLabels` in the handles. Label-vs-label OVERLAPS are auto-resolved at
  runtime (`label-layout.js` nudges colliding pills apart and re-aims their
  leaders every frame) — author the `dir`/`len` for a sensible base position and
  don't hand-tune to dodge neighbours; just keep anchors ON their parts and off
  the panel's left ~38% (still enforced by verify.mjs's label-visibility gate).
- Scale: model ~2–3 units tall, standing on y=0 (shadow floor + contact
  shadow); `studioPlinth()` under it.
- Return handles = **one pose function driven by a scalar** (`setCycle(deg)`
  or `set({spin, flow})`). ALL part positions derive from it. Call once at
  build time.
- **Layered scenes**: always-visible frame + "dress" group (outer skin) +
  mechanism; expose `setDress`/`setReveal`, snap in `onEnter` (the camera
  flight covers the pop).
- **Shape-state animation = geometry morph targets**, not per-frame rebuilds
  (two same-vertex-count geometries, drive `morphTargetInfluences[0]` from
  the pose function).
- **No flat cut faces**: anything that "ends" gets a dome/capsule/rounded cap.
- Expose a `parts` object in the handles with the key movable groups — the
  verify script and reviewers probe poses through it.

## index.js — defineExplainer

```js
// meta.js — the ONLY part the library index bundles eagerly
export default {
  id: 'my-thing',            // must match the folder name
  title: 'How a Thing Works',
  summary: '…library card text…',
  accent: '#8fd3ff',
  categories: ['home'],
};

// index.js
import meta from './meta.js';
export default defineExplainer({
  ...meta,
  buildScene: ({ scene }) => buildThing({ scene }),
  stageOptions: { dof: true },   // optional — enables per-step dofAperture
  steps: [
    {
      heading: '1 · Mechanism name',
      body: '2–4 sentences. Concrete physics, everyday analogies.',
      hint: 'optional accent line',
      camera: { position: [x, y, z], target: [x, y, z] },
      dofAperture: 0.0002,       // optional, macro steps only
      onEnter: ({ handles }) => handles.setLabels(false), // PIN all state
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };      // LOCAL state — gotcha #6
        tl.add(s, { t: 1, duration: 3000, ease: 'linear',
          onUpdate: () => handles.setCycle(s.t * 1440) });
      },
      // last step: freeOrbit: true + a faster duration
    },
  ],
});
```

**Seamlessness rule**: one lap returns the model to an identical pose —
angles advance WHOLE cycles (720° four-stroke, 1440° V-twin pattern), spins
whole turns, flow phases whole laps. Check geared ratios (a ×1.6 roller
needs spin in multiples of 5 turns). Gears with no unique marks repeat every
tooth pitch — whole layshaft turns advance every meshed gear an integer
tooth count (see manual-gearbox's header for the full derivation). Overview
steps run slow (5–8s/lap), mechanism steps ~2.5–4s, run steps fastest.

## War stories (why the pre-flight checklist exists)

- anime.js tween composition: two timelines tweening one property — the
  second silently cancels the first; the animation dies with no error.
- `roller` name collision broke a build: dev server showed a BLANK page with
  zero console output; only `vite build` reported "Identifier X has already
  been declared".
- Metal glare streaks are direct-light specular, not env reflection —
  `envMapIntensity` does nothing; raising `.roughness` is the fix (a wider,
  softer highlight is correct for brushed metal). Diagnose by hiding meshes
  one at a time and re-scanning readPixels (verify.mjs prints per-step
  clipped counts).
- The mixer-grinder's white body stayed visually solid at 0.26 AND at 0.1
  opacity until its clearcoat was zeroed on reveal — coat specular is
  opacity-independent.
- The fiber-optics connector was modelled correctly but mounted on the
  module's BACK face — invisible from every step camera that featured it;
  and the same step inherited a random turntable angle because `onEnter`
  didn't pin spin. Both are checklist items now.
- The gearbox plinth's default clearcoat was the single clipped-white patch
  in a full-scene readPixels bisect — `studioPlinth()` ships the softened
  numbers.

## Manual verification fallback

`scripts/verify.mjs` automates the gates. If it can't run, the manual
equivalents (all via headless Chromium or the dev console — the IDE preview
tab is compositor-throttled; loops report `paused: true` and screenshots
time out there):
1. Home page shows the card; click navigates; zero console errors.
2. `window.__hiw.stepRuntimes[i]` all have `mode: 'loop'` + non-null `tl`;
   `rt.tl.seek()` at two times must move the mechanism.
3. `handles.setLabels(...)` per set + `stage.labelRenderer.render(...)` —
   callouts appear and toggle off.
4. `stage.composer.render()` + `gl.readPixels` per step camera: truly
   clipped pixels (r+g+b ≥ 760/765) ≈ zero; v>700 alone is just bright
   silver and fine.
5. Layer toggles: visible-mesh count delta must equal the layer's mesh count
   both ways.
6. Navigate away and back: exactly one `<canvas>`, zero orphan `.callout`s.
7. `vite build` from the repo root passes AND emits
   `dist/assets/<id>-*.js` — if the code landed in the shared `index-*.js`
   chunk, something statically imported the explainer.
