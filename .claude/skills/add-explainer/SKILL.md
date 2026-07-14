---
name: add-explainer
description: Add a new 3D explainer to the howitworks site (e.g. "how an AC works"). Use whenever the user asks to add/build/create an explainer, a "how X works" page, or a new entry in the library, and when reworking/polishing an existing one. Covers the research-first realism workflow (search the real mechanism, build, validate against the reference), the defineExplainer API, procedural model conventions, seamless-loop timeline rules, and the verification routine.
---

# Add a new explainer to howitworks

An explainer = one folder in `src/explainers/<kebab-id>/` with THREE files —
no registration step, the registry globs the folder automatically:

- `meta.js` — tiny, eagerly bundled library-card data: `export default
  { id, title, summary, accent, categories: ['vehicles'] }`. `id` must equal
  the folder name (the lazy-loader keys chunks by folder). This is ALL the
  home page ever loads, which is what lets the library scale to 1000s.
- `index.js` — `export default defineExplainer({ ...meta, buildScene, steps })`
  (import meta and spread it; never duplicate title/summary here). Lazy-loaded
  as its own Vite chunk when someone opens the explainer.
- `model.js` — the procedural Three.js build.

Hierarchy: `categories` is an array — an explainer can sit in several folders
(the AC is a car system AND a home appliance). The folder tree lives in
`src/categories.js` (title/blurb/accent per category, optional `parent` for
nesting, e.g. car under vehicles); add new categories there. Routes:
`#/<cat>` is a category page, `#/<cat>/<id>` or plain `#/<id>` opens the
explainer (ids are globally unique; the router only reads the last segment).

The framework (`src/framework/`) provides everything else: page layout, step
activation, camera direction, drag-to-orbit, progress rail, CSS2D callout
labels, library card grid + search.

Reference implementations: `table-fan/` (simplest), `v-twin-engine/` (kinematics,
moving-part callouts, exhaust smoke), `jet-engine/` (instanced bladeRing stages,
sector-cutaway casings, dark liners), `air-conditioner/` (chainPath fluid loop,
split units), `mechanical-watch/` (layered product-shot scene, setDress layer
toggle, geometry morph targets, reference-validated mechanism).

## The bar: impress people

These pages live or die on "whoa". Aim for maximum realism with zero
restrictions on model complexity — fully procedural (no GLB assets, that's the
one hard rule), but as many parts, greebles, and correct mechanism details as
it takes. Two principles from experience:

- **Present like a product shot, not a diagram.** Neutral studio staging:
  the machine itself, plus at most an abstract display prop (charcoal capsule
  stand, plinth). NEVER stylized human anatomy (arm/hand/wrist) — a cartoon
  body part next to a realistic machine makes the whole scene read as a toy.
  Tried three times on the watch; user killed it each round.
- **Open on the COMPLETE, SOLID product — never a skeleton.** Step 1 must be
  the finished object as you'd actually see it: opaque outer shell, no guts
  showing. THEN, as the user scrolls, make the shell go transparent / ghost
  to x-ray (or lift a "dress" layer) and reveal the mechanism inside. Starting
  already-exploded or already-cut-away (an opaque slide sitting next to a
  translucent frame with the springs on show) reads as a wireframe/skeleton
  and kills the "whoa, it's a real thing" hook — the user has rejected this
  explicitly. Build the outer skin on its own material(s), expose a
  `setReveal(t)` handle, pin `reveal` in every step's `onEnter` (0 = solid,
  1 = revealed), and re-solidify near the end (the "run it" finale can
  fire/spin the complete object again), mirroring the watch's re-dress.
  **METAL CAN'T BE GHOSTED** — transparent metal still reads as a solid surface
  (specular/env reflections dominate) and buries the mechanism. So on reveal,
  HIDE metal shell parts outright (`.visible=false` — lift the lid off), and
  only fade LOW-SPECULAR polymer/plastic to a faint (~0.26) translucent body
  for context. And any real opening (muzzle, port, nozzle, intake) must be an
  ACTUAL hole — extrude the front face as a plate with a circular `Path` hole,
  never a solid disc the moving part would pass through.
- **Real mechanisms, real numbers.** If you are not POSITIVE how the mechanism
  works or looks, research it on the internet BEFORE building (WebSearch +
  WebFetch a canonical source — e.g. ciechanow.ski has definitive interactive
  references for watch/gears/sound). Get the canonical facts: tooth counts
  (Swiss lever escape wheel = 15), part proportions (hairspring ≈ half the
  balance diameter), colors (mainspring grey, HAIRspring blued), motion (a
  mainspring's coils migrate arbor→wall as it unwinds). Viewers who know the
  machine will notice.

- **Proportions are the single most important thing — get them right BEFORE
  any detail.** A model with perfect materials, greebles and lighting still
  reads as a cheap toy if the big dimensions are wrong; proportions are the
  first thing a viewer (and the user) judges. Before building, pull a reference
  image and read off the major RATIOS (overall length:height, and each big
  part's size relative to the others — e.g. a pistol slide ≈ 1.35 × total
  height, grip ≈ 0.6 × slide length, bore a slim fraction of slide width).
  Derive EVERY constant in model.js from ONE consistent scale so those ratios
  hold by construction, and add a short comment block stating the target ratios
  (see semi-auto-pistol). After the first render, compare the silhouette to the
  reference and fix proportion mismatches before touching anything else — a
  stretched or mis-scaled part is the defect the user notices first and the one
  they are most frustrated to find late. (A pistol shipped with a slide ~1.8×
  too long, reading as an SMG; the watch first rendered dinner-plate-sized.)
- **Placement is second only to proportions ("proportions, then placement").**
  Right-sized parts in the wrong place still fail: a part is worthless if it is
  buried behind another part from the step's camera. After proportions, verify
  every named part is actually UNOCCLUDED and legible from the camera that
  features it — position it in the open, not tucked behind a neighbour. (The
  pistol trigger was correctly modelled but sat at the same depth as the grip,
  which hid it from every front angle; moving it forward into the open trigger
  guard fixed it.) A part the copy names but the viewer can't find reads as a
  bug, not a subtlety.
- **State hygiene: one thing, one place, one time.** Anything that represents a
  consumable or moving state — a chambered round that later ejects, a spark, a
  flame front, a packet of fluid — must be shown ONLY during its phase and
  hidden otherwise. Never leave a stale copy behind: if a round becomes the
  ejected case, the chambered case must disappear the instant ejection starts,
  or the viewer sees two brass in the bore at once. Drive these visibilities
  from the same scalar as the motion (`mesh.visible = revealed && phaseWindow`).

The premium-fidelity upgrade ladder (anisotropy, transmission glass,
imperfection maps, depth of field) lives in the separate **polish-explainer**
skill — new models should use whatever presets it has already promoted to
VALIDATED, but don't run its CANDIDATE experiments while building something
new; build first, polish as its own pass.

## Cinematography & mechanical motion (per-step direction)

The machine loops on its own — the only "edit" the viewer ever experiences is
the camera fly-to between steps. Direct those like a product film:

- **Give every fly-to a shot type, never an arbitrary reframe.** Compose
  consecutive step cameras as deliberate moves: a *hero arc* (orbit 30–60°
  around the model between overview steps), a *macro push-in* (keep the
  target, bring the position much closer, for one mechanism), a *tracking
  move* (slide the target along the machine's axis to follow a flow/power
  path). Two consecutive cameras that differ only trivially read as a glitch,
  not a move.
- **Frame off-centre (rule of thirds).** Put the step's point of interest on
  a thirds intersection, not dead centre. The text panel owns the left ~38%
  of the viewport — compose for the remaining right side, and verify framing
  in review-shots screenshots, never in your head.
- **Mass in the motion.** Continuous rotation stays `linear` (the seamless-
  loop contract), but anything that starts, stops or engages carries inertia.
  Shape it INSIDE the pose function / speed profile (cosine spin-up/down for
  shafts, smoothstep travel for sliding parts) — not by switching anime.js
  easings, since each loop is one linear tween.
- **Anticipation → action → settle.** Before a discrete mechanical event (a
  hammer falls, a sleeve engages, an idler slams home), pull back a fraction
  first; after the event, settle with a tiny damped overshoot (1–2 % of
  travel, ≤ 2 oscillations — machined parts don't wobble). Stagger secondary
  parts a few percent of the lap behind the primary so nothing starts or
  stops on the exact same frame.
- **True pivots.** Parent every hinged/rotating part at its physical pivot
  and pose it by rotation so paths are real arcs. Never lerp a position
  between two poses of something that physically swings.

Lighting and DoF are NOT per-explainer knobs: the stage owns the studio rig
(HDRI env + key/rim lights + GTAO/bloom, `options.dof` for BokehPass). If a
shot needs more, that's a polish-explainer pass — never scene lights in
model.js (tiny emissive/point accents inside the model excepted, see gotchas).

## Interaction model (changed 2026-07: loops, not scroll-scrub)

- **Every step's timeline runs as a seamless LOOP while that step is active**
  (player default `mode: 'loop'`; plays on activation, pauses on leave).
  Scrolling navigates between steps (camera fly-to + panel swap); it does not
  scrub the mechanism.
- **Drag-to-orbit works on every step** (rotate-only controls, always enabled;
  the next step's fly-to reframes). Zoom stays disabled — wheel must scroll.
- The overlay stack has `pointer-events: none` with opt-ins on `.panel`,
  `.back-link`, `.rail-dot`, `.canvas-holder` — don't add new full-screen
  overlay elements without `pointer-events: none` or they will eat the drag.

## Workflow

1. **Research the mechanism** (skip only if you could sketch it from memory
   with real numbers): how it works, what it actually looks like, the
   canonical counts/ratios/colors. One WebSearch + one WebFetch of an
   authoritative source is usually enough.
2. **Design the story**: 4–9 steps — don't cap it, cover what the machine
   needs. Two proven shapes:
   - *Anatomy-first*: step 1 "The anatomy" (overview, callout labels on, slow
     loop), then one mechanism per step, last step `freeOrbit: true` fast.
   - *Zoom-in / reveal* (watch, pistol): step 1 the finished product SOLID
     from outside, then a "look inside" step ghosts the shell (`setReveal(1)`)
     / peels a layer, then go mechanism by mechanism, re-solidify near the end,
     finish freeOrbit. Every step's `onEnter` must PIN the full reveal/layer/
     label state (helper `view(reveal, labels)`) so scrolling backwards is
     consistent. THIS IS THE PREFERRED SHAPE for anything with a real outer
     shell (engines, guns, appliances, watches) — see the "open on the
     complete, solid product" principle above. Pure anatomy-first (open
     already-cut-away) is only for things that have no meaningful "skin" (a
     bare circuit component, an exposed gear train).
   In all steps the CAMERA provides the focus; the machine just keeps running.
3. **Write `meta.js`** (id = folder name, categories from `src/categories.js`
   — add a new category there if none fits), then **build `model.js`**:
   procedural Three.js. Export `build<Thing>({ scene })` returning handles.
4. **Write `index.js`**: `defineExplainer({ ...meta, buildScene, steps })`.
   No main.js edit — the folder is auto-discovered.
5. **Verify** (see bottom), then **validate against the reference**: recheck
   the built model against the step-1 research (tooth counts, proportions,
   motion direction, what moves vs what's fixed) and fix mismatches. If the
   mechanism facts changed (e.g. a tooth count), re-derive the seamless-loop
   length so every ratio is still a whole number per lap.
6. **Independent review, then the user.** Spawn the `explainer-reviewer`
   agent (it follows the review-explainer skill: headless-browser screenshots
   of every step via `node scripts/review-shots.mjs <id> <outDir>`, its own
   fact-check, SHIP/FIX/ESCALATE verdict). Fix its FIX list, re-verify,
   re-review until SHIP. Only then hand the contact-sheet folder to the user
   — their eyes are the final taste gate, but they should be sampling, not
   debugging. Expect occasional proportion/composition notes even after a
   SHIP; fix and re-run the loop.

## model.js conventions

- Toolkit imports:
  `import { materials, rod, box, disc, arrow } from '../../framework/parts.js';`
  `import { beveledBox, lathe, finStack, tubeAlong, boltCircle, bladeRing, gear, chainPath } from '../../framework/geometry.js';`
  `import { callout } from '../../framework/labels.js';`
- **Materials**: use the v2 physical presets — `aluminum`, `brushedSteel`,
  `chrome`, `paintedMetal`, `rubber`, `grimyAluminum` (bases/sumps),
  `heatBluedSteel('u'|'v')` (exhausts: 'u' for TubeGeometry, 'v' for cylinders).
  CAUTION: `roughnessMap` MULTIPLIES base roughness (map texels ≈ 0.5) — the
  presets' defaults are near-chrome on large/curved surfaces; override
  `.roughness` upward (blades 0.85, casings 0.7) or they mirror the softbox.
- **Never leave a concave metal interior visible** (DoubleSide casing seen from
  inside = curved mirror = blowout). Solid casings are FrontSide + a dark rough
  liner mesh inside (see jet-engine).
- **Geometry**: bevel everything (`beveledBox`); pipes bend (`tubeAlong`);
  blade stages are `bladeRing` (instanced airfoils, one draw call); fluid
  circuits are `chainPath` (packets ride `getPointAt/getTangentAt`, segment
  `bounds` drive phase colors). Greeble with `boltCircle`/`finStack`/flanges.
- **Labels are CSS2D callouts**: create with `callout(text, {dir, len})`,
  `visible = false`, collect in an array, expose
  `setLabels(v) { for (const c of callouts) c.visible = v; }`. Callouts can be
  parented to MOVING parts — the dot rides the part.
- Scale: model ~2–3 units tall, standing on y=0 (shadow floor + contact shadow).
- Return handles = **one pose function driven by a scalar** (`setCycle(deg)` or
  `set({spin, flow, ...})`). ALL part positions derive from it, so any timeline
  value always yields a consistent pose. Call once at build time.
- **Layered scenes** (zoom-in stories): build always-visible frame (casing,
  stand), a "dress" group (outer skin the steps peel away), and the mechanism.
  Expose `setDress(v)` toggling the dress group; snap it in `onEnter` (the
  camera flight covers the pop).
- **Shape-state animation = geometry morph targets**, not per-frame rebuilds:
  build two same-vertex-count geometries (e.g. `TubeGeometry` from two coil
  distributions — mainspring wound/unwound), set
  `geoA.morphAttributes.position = [geoB.getAttribute('position')]`, drive
  `mesh.morphTargetInfluences[0]` from the pose function (full cosine cycle
  per lap stays seamless).
- **No flat cut faces**: anything that "ends" (rollers, stumps, pipes) ends in
  a capsule/dome/rounded cap. A visible flat disc where a solid was truncated
  is an instant CG tell.
- Point lights inside closed geometry need FAR lower intensity than in the
  open (physical falloff at point-blank range clips) — start ~3, not ~30.

## index.js — defineExplainer

```js
// meta.js — the ONLY part the library index bundles eagerly
export default {
  id: 'my-thing',            // must match the folder name
  title: 'How a Thing Works',
  summary: '…library card text…',
  accent: '#8fd3ff',         // panel/rail/card/callout-dot accent
  categories: ['home'],      // every folder it belongs to (src/categories.js)
};

// index.js
import meta from './meta.js';
export default defineExplainer({
  ...meta,
  buildScene: ({ scene }) => buildThing({ scene }),
  steps: [ /* see below */ ],
});
```

Step shape — timelines are real-time seamless loops:

```js
{
  heading: '1 · Mechanism name',
  body: '2–4 sentences. Concrete physics, everyday analogies.',
  hint: 'optional accent line',
  camera: { position: [x,y,z], target: [x,y,z] },  // fly-to on step enter
  onEnter: ({ handles }) => handles.setLabels(false),
  timeline: ({ tl, handles }) => {
    const s = { t: 0 };                            // LOCAL state — gotcha #1
    tl.add(s, { t: 1, duration: 3000, ease: 'linear',
      onUpdate: () => handles.setCycle(s.t * 1440) });
  },
  // last step: freeOrbit: true + a faster duration
}
```

**Seamlessness rule**: one timeline lap must return the model to an identical
pose — angles advance WHOLE cycles (multiple of the model's true period, e.g.
720° for a four-stroke, 1440° for a V-twin's firing pattern), spins whole
turns (×2π), flow phases whole laps (integer). Check geared ratios too (AC:
spin multiples of 5 turns keep the ×1.6 roller seamless). Overview steps run
slow (5–8s/lap), mechanism steps ~2.5–4s, run steps fastest.

## Critical gotchas (each cost real debugging time)

1. **Never tween the same object property from two timelines.** anime.js tween
   composition cancels the earlier tween and the animation silently dies.
   Every step's `timeline()` must create its OWN local state object.
2. **Don't enable zoom or pan** — controls are rotate-only so the wheel keeps
   scrolling the page.
3. **Transparent overlays**: any material that can fade to 0 opacity needs
   `depthWrite: false`, or it punches invisible holes through glass behind it.
4. Camera targets: model center of interest is usually y ≈ 1.2–2.2. Keep
   `position` 3–6 units out; detail steps go closer, overview/run steps wide.
5. `mode: 'scrub'` still exists (scroll-driven ScrollObserver timelines) but is
   no longer the default; only use it if a step explicitly needs scroll-scrub.
6. **Metal glare streaks are direct-light specular, not env reflection** —
   `envMapIntensity` does NOTHING to them. Raising `.roughness` spreads the
   highlight over more pixels but un-clips it (that's the fix: no pixel should
   hit pure white; a wider soft highlight is correct for brushed metal).
   Diagnose by hiding meshes one at a time and re-scanning `gl.readPixels`.
7. **Local-variable name collisions in one big build function**: watch out for
   generic names (`roller` broke the build — balance roller table vs display
   roller). Rolldown reports "Identifier X has already been declared" — the
   dev server shows a BLANK page with zero console errors, so run the build to
   surface it.

## Verify (before telling the user it's done)

Dev server: preview config `dev` (port 5174; launch.json set up — node.exe
absolute path, vite). The preview tab is compositor-throttled: loops report
`paused: true` and `preview_screenshot` ALWAYS times out (30s, don't retry) —
verify through state and `gl.readPixels`, not screenshots. For actual images
use `node scripts/review-shots.mjs <id> <outDir>` — headless Chromium renders
normally and captures two shots per step (identical a/b pairs = frozen loop). If `window.innerHeight` is 0,
`preview_resize` to explicit W×H (the `desktop` preset can still yield 0),
then `location.reload()` (player boot is deferred until the container has
layout).

1. Home page shows the new card; click navigates; zero console errors.
2. Every step runtime: `window.__hiw.stepRuntimes[i]` has `mode: 'loop'` and a
   non-null `tl`. Sanity-check poses by seeking: `rt.tl.seek(ms)` at two
   different times must move the mechanism (probe part positions via
   `window.__hiw.handles`).
3. Callouts: `handles.setLabels(true)`, then
   `stage.labelRenderer.render(stage.scene, stage.camera)` — all `.callout`
   elements display and toggle off again.
4. Brightness: render via `stage.composer.render()`, `gl.readPixels` patches
   at each step's camera pose. Count TRULY clipped pixels (r+g+b ≥ 760 of
   765) — those must be ~zero; v>700 alone just means bright silver and is
   fine. Bisect by hiding meshes if there's clipping.
5. Layer toggles: if the model has `setDress`-style handles, toggle and count
   visible meshes — the delta must equal the layer's mesh count both ways.
6. Navigate away and back — exactly one `<canvas>`, zero orphan `.callout`s.
7. Build must pass: `& "C:\Program Files\nodejs\node.exe" node_modules/vite/bin/vite.js build`
   (from the repo ROOT — the shell cwd drifts). Run it even when the dev page
   works — it catches errors the dev server masks (see gotcha 7). The output
   must list a `dist/assets/<your-id>-*.js` chunk (a few KB–tens of KB): that's
   the lazy split working. If your explainer's code landed in the big shared
   `index-*.js` chunk instead, something statically imported it — fix that,
   or the whole library pays for it.
