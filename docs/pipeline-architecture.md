# whatdstuff Pipeline — Technical Architecture

## 0. Correcting the frame

There is no code-generation *engine* that calls an LLM API at runtime to
produce Three.js/anime.js code, no CV-based "vision re-analysis of rendered
frames" that rewrites scripts, and no autonomous retry loop on WebGL runtime
errors. What actually exists:

| Assumption sometimes made about this system | Reality in this codebase |
|---|---|
| Claude generates Three.js/anime.js code via API calls at build time | Claude Code (an interactive CLI agent) edits files directly in an IDE-like session, per `.claude/skills/add-explainer/SKILL.md`. No `POST /messages` call "generates a scene" — a human-approved chat turn does, then the agent writes `model.js`/`index.js` with `Write`/`Edit` tools. |
| Automated feedback loop detects WebGL runtime errors and re-prompts for fixes | `scripts/verify.mjs` mechanically detects console/page errors, blank renders, clipping, occluded labels, broken touch gestures — but there's no autonomous retry; the same agent session reads the report and edits code by hand, then reruns. The only quasi-autonomous loop is the `explainer-reviewer` sub-agent cycle, hard-capped at **2 iterations**, after which unresolved findings go to the human. |
| A "vision/re-analysis phase" inspects rendered frames to rewrite the script | Does not exist. `video.js` narration is hand-written (by the agent, per the `video-scripting` skill) *before* rendering. What actually reconciles picture and audio is a deterministic pacing algorithm in `export-video.mjs`: **audio duration is the master clock**, and shot durations on screen are stretched/compressed to match ElevenLabs' returned word-timing — not a vision model reading frames. |
| Puppeteer | The whole toolchain uses **Playwright** (`chromium` from the `playwright` npm package), not Puppeteer. |

---

## 1. High-Level Architecture & Data Flow

### 1.1 Tech stack / environment

| Layer | Library | Version (`package.json`) | Role |
|---|---|---|---|
| Renderer | `three` | `^0.185.1` | WebGL2 scene graph, PMREM/HDR env lighting, post-processing |
| Timeline/tween | `animejs` | `^4.5.0` (v4 API: `animate`, `createTimeline`, `stagger`, `onScroll`) | Per-step loop/scrub timelines, camera fly-tos, entrance stagger |
| Bundler/dev server | `vite` | `^8.1.3` | Per-explainer code-splitting via `import.meta.glob`, dev server, production build |
| Headless automation | `playwright` | `^1.61.1` | verify gates, screenshot capture, deterministic frame-by-frame video capture |
| Video encode | `ffmpeg-static` | `^5.3.0` | frame→MP4 encode, ASS caption burn-in, audio mux/loudnorm |
| TTS (primary) | ElevenLabs REST API (`/v1/text-to-speech/{voice}/with-timestamps`) | — | single-take narration + char-level alignment |
| TTS (fallback) | `msedge-tts` | `^2.0.7` | offline/no-API-key narration, no word alignment |

There is **no server/backend** in this data flow — everything is static-hosted
Vite output plus Node.js CLI scripts run locally/CI for verification and
export. Claude Code itself is the orchestrator of *which script runs when*;
it is not part of the runtime the end user's browser executes.

### 1.2 End-to-end trace: "add an explainer for X" → shipped short video

This is a human-in-the-loop sequence inside one Claude Code session, not an
API pipeline:

```
1. User: "add an explainer for induction cooktops"
      ↓
2. Claude Code invokes Skill(add-explainer)
      → loads SKILL.md + references/conventions.md into context
      ↓
3. Phase 1 — Blueprint (chat only, no files written yet)
      → WebSearch/WebFetch the real mechanism (litz coil turns, IGBT
        switching freq, eddy-current skin depth, etc.)
      → posts ~15 bullet "Blueprint" in chat: proportions, materials,
        loop math, storyboard, callout labels
      → STOPS, waits for human approval
      ↓
4. Phase 2 — Build (file writes)
      Write  src/explainers/induction-cooktop/meta.js   (id/title/summary/accent)
      Write  src/explainers/induction-cooktop/model.js  (procedural THREE geometry
                                                           + handles.set*() API)
      Write  src/explainers/induction-cooktop/index.js  (defineExplainer({ steps }))
      ↓
5. Phase 3 — Verify (mechanical, scripted)
      Bash: node scripts/verify.mjs induction-cooktop
        → spawns `vite build`, greps stdout for
          `dist/assets/induction-cooktop-*.js` (proves lazy split)
        → spawns/attaches to `vite --port 5174`
        → Playwright chromium.launch() → page.goto('#/induction-cooktop')
        → per-step: readPixels() clip test, CSS2D label-projection
          visibility test, pose-hash-under-seek motion test
        → second Playwright context at 390×844 with CDP
          Input.dispatchTouchEvent to test scroll-vs-orbit axis split
        → prints "VERIFY PASS" or a gate-by-gate FAIL report (plain
          stdout, not a structured payload)
      ↓
6. Self-review: Bash: node scripts/review-shots.mjs induction-cooktop
      → Playwright captures PNGs per step at 30%/60% of each loop's lap
      → Read tool loads contact-sheet.png; the agent visually judges
        framing/occlusion/proportion against the Blueprint claims
      ↓
7. Agent(explainer-reviewer) — cycle 1 (hard cap 2)
      → fresh-context sub-agent: independently fact-checks the mechanism
        against WebFetch'd references, reviews the same screenshots
      → returns SHIP / FIX / ESCALATE + a findings list
      ↓
8. If FIX: batch-apply findings → re-verify → SendMessage to the SAME
   reviewer agent with only the diff + changed-step screenshots (cycle 2)
      ↓
9. On SHIP (or cap reached, surfaced to user) — explainer is DONE.
   Nothing further happens automatically (Rule 1's "hard brake"):
   video export requires an explicit, separate user request.
      ↓
10. User: "make the short for induction cooktop" (or `/explainer-to-video`)
      ↓
11. Skill(video-scripting) → hand-writes src/explainers/induction-cooktop/video.js
      { short: { shots: [ {step, dolly, labels, narration}, ... ] } }
      ↓
12. Bash: node scripts/make-narration.mjs induction-cooktop --format short
      → POST https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps
        body: { text, model_id: 'eleven_multilingual_v2', voice_settings }
        response: { audio_base64, alignment: { characters,
                    character_start_times_seconds, character_end_times_seconds } }
      → writes renders/induction-cooktop/audio/short-full.mp3
                renders/induction-cooktop/audio/short-timings.json  (per-shot {start,end})
                renders/induction-cooktop/audio/short-words.json    (per-word {t,s,e})
      ↓
13. Bash: node scripts/export-video.mjs induction-cooktop --format short --captions
      → Playwright chromium.launch({ args:['--enable-gpu','--use-angle=d3d11',...] })
      → page.addInitScript() stubs performance.now/Date.now/rAF with a manual
        clock (window.__vt.advance(ms))
      → for each shot: window.__hiw.activate(step); loop advance+screenshot
        at exactly 1000/fps ms per frame → JPEG q98 frames on disk
      → ffmpeg: frames → short-master.mp4 (libx264 crf16, gradfun deband)
      → build .ass subtitle file from short-words.json (word-synced rail,
        karaoke highlight) → libass burn → short-captioned.mp4
      → ffmpeg amix (narration + sfx, adelay per cue) + loudnorm →
        short-final.mp4
      ↓
14. Output: renders/induction-cooktop/short-final.mp4 (1080×1920, ready to post)
```

No JSON "payload" is passed between Claude and the render tools in the sense
of an API contract — the only structured intermediate artifacts are plain
files on disk: `*-timeline.json`, `*-timings.json`, `*-words.json`, `*.ass`.
These are the entire "IPC layer" of the pipeline.

---

## 2. LLM Prompting & Code Generation

There is no code-generation *engine* — this section is really: what
instructions constrain the coding agent, and how is correctness checked?

### 2.1 Constraints (not "system prompts" — checked-in skill files)

`.claude/skills/add-explainer/SKILL.md` + `references/conventions.md` are
Markdown files loaded into the agent's context via the `Skill` tool. They
encode hard constraints as prose the agent follows, e.g.:

- API shape is fixed: `defineExplainer({ id, title, buildScene, steps })` —
  `buildScene({scene, stage, THREE, parts})` returns `handles`; each
  `steps[i]` has `{ heading, body, camera:{position,target}, onEnter,
  timeline, focus }`.
- **Ten pre-flight traps** enumerated verbatim (transmission-glass hiding
  transparent contents, clearcoat ignoring opacity, metal-can't-ghost,
  duplicate `const` silently blanking the dev server, etc.) — the agent is
  told to check these *before* first render, because each has previously
  cost a full review cycle.
- **Seamless-loop contract**: every step's `timeline` must return to
  bit-identical pose at wrap (whole turns/cycles per lap) and drive state
  through exactly one local object (`const s = {t:0}`), because two anime.js
  tweens targeting the same property silently cancel each other (tween
  composition).
- A **Model Requirement cognitive safeguard** is written directly into the
  skill: it tells whichever model is running to warn the user if invoked on
  a small/fast model, because the spatial-reasoning load (3D geometry,
  kinematics) is understood to exceed weaker models' reliability.

This is prompt engineering in the sense of "written instructions that shape
agent behavior," but it's **static, checked-in, and human-edited** — not a
runtime template interpolated per-request into an API call.

### 2.2 "Extraction and injection" of generated code

There is no extraction/sanitization step because there's no
generation-then-injection boundary — the agent's `Write`/`Edit` tool calls
place source files directly into `src/explainers/<id>/`. Vite's dev server
and `import.meta.glob`-based registry (`src/framework/registry.js`) pick the
folder up automatically:

```js
const metaModules = import.meta.glob('../explainers/*/meta.js', { eager: true });
const loaders      = import.meta.glob('../explainers/*/index.js'); // lazy
```

The only "injection boundary" that matters architecturally is Vite's
**code-splitting contract**: dropping a folder in `src/explainers/` must
produce its own `dist/assets/<id>-*.js` chunk. `verify.mjs`'s `build` gate
regexes the `vite build` stdout for that exact chunk name — this is the one
automated, syntactic check on "did the generated code integrate correctly,"
and it exists specifically because a duplicate top-level `const` name across
explainer files has historically broken the split silently (dev server shows
a blank page with zero console output; only `vite build` surfaces it).

### 2.3 Error detection ("self-correction loop")

Real, but manual-in-the-loop, not autonomous:

- **Syntax/duplicate-identifier errors**: only surfaced by `vite build` (the
  dev server masks them as a blank page). `verify.mjs` always runs a real
  build first for this reason.
- **Runtime errors**: `verify.mjs` attaches `page.on('console', ...)`
  (filtering `type()==='error'`) and `page.on('pageerror', ...)` and
  accumulates them into an `errors` gate — nonzero exit if any fired during
  the entire probe sequence.
- **Blank/black screen**: not detected by pixel-emptiness per se; the
  `clipping` gate (`readPixels` histogram of blown-white pixels) and
  `label-visibility` gate would both trivially pass/fail in ways that make a
  black screen obvious in review, but there's no explicit "is the canvas
  all-black" assertion — that class of bug is caught by the human/agent
  looking at `review-shots.mjs` output, not a script.
- **Feedback loop**: the *build session* reads `verify.mjs`'s FAIL lines in
  its own context and edits code — this is ordinary agentic tool use
  (Bash → Read output → Edit → Bash again), not a separate re-prompting
  mechanism. The one place an LLM re-evaluates another LLM's work is the
  `explainer-reviewer` sub-agent, deliberately spawned in a **fresh
  context** (so it can't rationalize the builder's own mistakes), capped at
  2 cycles by explicit repo policy in `CLAUDE.md`.

---

## 3. Scene Construction & Directing

### 3.1 Model synthesis

100% procedural — `CLAUDE.md` Rule 2 and the skill both state "no
GLTF/external 3D assets, ever." `model.js` builds geometry from
`THREE.*Geometry` primitives plus a shared toolkit (`src/framework/parts.js`,
`geometry.js`, `textures.js`) — e.g. `parts.studioPlinth()` for a shared
base. No instancing/shader system is generically imposed; explainers use
`THREE.InstancedMesh` ad hoc where it matters (the skill references
`jet-engine/` for "instanced blades, sector cutaways").

Each `model.js` exposes a **handles object** — a small imperative API the
step timelines drive (from `induction-cooktop`): `setReveal`, `setPanShown`,
`setPanCut`, `showField`, `setHeat`, `setLift`, `setPower`, `setLabels`,
`setPhase`. This is the seam between "scene" and "director": `model.js` owns
*what a state value visually means*; `index.js` owns *when it changes*.

### 3.2 Camera control ("video.js")

Two entirely different things share the name "camera direction" here — don't
conflate them:

**(a) Interactive-site camera** (`player.js`): each step declares a
hand-authored pose `{ position:[x,y,z], target:[x,y,z] }` in world units. On
step activation, `flyTo()` tweens both vectors with `animate()` over 1300ms,
`ease:'inOutQuad'`. No path-planning algorithm — poses are manually composed
by the agent against a reference aspect ratio (`REF_ASPECT = 1.6`,
`FOV_REF = 42°`). A separate deterministic correction (`fovForAspect` +
`frameForViewport`'s dolly/lift math) re-derives a portrait-safe pose from
the authored desktop one using pure trig (`Math.tan`/`Math.atan`) — this is
the closest thing to a "camera algorithm" in the codebase, and it exists
solely to compensate for narrow mobile aspect ratios, not for cinematography.

**(b) Video-export editorial layer** (`src/explainers/<id>/video.js`): a
*hand-written* per-shot manifest, not an algorithm:
```js
{ step: 4, dolly: 1.35, labels: ['Eddy currents'],
  narration: 'It lands in the steel base of your pan...' }
```
`dolly` is a manual scalar multiplier (`window.__hiwCameraScale`) that pushes
the existing step camera outward along its view axis for portrait framing —
again authored by a human/agent per shot, not computed from scene bounds.

### 3.3 Animation orchestration (anime.js v4 ↔ Three.js binding)

Two binding patterns, both convention rather than framework-enforced:

1. **Direct property tweening** — anime.js targets Three.js object properties
   as plain JS object fields (`animate(stage.camera.position,
   {x,y,z,duration,ease})`, `animate(stage.controls.target, {...})`) since
   `Vector3` fields are writable numbers anime.js can tween in place.
2. **Scalar-state + onUpdate** — the dominant pattern for mechanism motion: a
   **local** `{t: 0}` object is tweened `0→1` linearly, and `onUpdate` calls
   a single `handles.set*` (or a composite pose function) each tick:
```js
tl.add(s, { t: 1, duration, ease: 'linear', onUpdate: () => handles.setPhase(s.t) });
```
`framework/motion.js`'s `profileTable(rateFn, laps)` numerically integrates a
non-constant angular-rate function into a lookup table scaled so exactly
`laps` whole turns complete per loop — this is the one nontrivial "math"
component, used when a mechanism's speed varies across its cycle (e.g.
reciprocating parts) but must still land on an identical pose at wrap for the
loop to be seamless.

Timelines come in two modes selected per step (`step.mode ?? 'loop'`):
- `loop` — `createTimeline({loop:true, autoplay:false})`, started/stopped by
  `player.js` on step activate/deactivate.
- `scrub` — `createTimeline({autoplay: onScroll({target, enter:'center top',
  leave:'center bottom', sync:true})})`, i.e. anime.js's own scroll-observer
  drives progress directly; no manual scroll-delta math.

---

## 4. Interactive Web Experience Layer

### 4.1 Scroll architecture

The canvas is `position:fixed; inset:0`, sitting *behind* the normal document
flow. Each step is a tall `<section class="step">`; the page scrolls
normally. Two independent scroll-consumers exist and don't fight:

- **Step activation**: an `IntersectionObserver` with `rootMargin:'-45% 0px
  -45% 0px'` fires `activate(i)` when a section crosses the *middle* of the
  viewport — not proportional scrubbing, a **discrete state machine** (only
  one step is "active" at a time).
- **Per-step animation progress**: independently, if `step.mode==='scrub'`,
  anime.js's built-in `onScroll()` observer binds timeline progress directly
  to that section's scroll position (native, not reimplemented) —
  `sync:true` makes it track continuously rather than tweening toward a
  target.

Default mode is `loop`, i.e. most explainers do **not** scrub animation to
scroll position at all — scrolling only selects *which* step's independent,
self-looping timeline is playing. This is a deliberate product decision
(Rule 5): mechanisms should read as always-running machines, not
slider-driven puppets.

### 4.2 DOM/WebGL sync

- **Text panels**: plain DOM (`.panel` per `<section>`), fully decoupled
  from the render loop — CSS handles layout, `IntersectionObserver` handles
  active-state class toggling, anime.js does a `stagger()`'d fade-in on
  activation.
- **3D callouts**: `THREE.CSS2DObject` (three/addons `CSS2DRenderer`),
  attached as children of arbitrary `Object3D`s in the scene graph —
  `labels.js`'s `callout(text, {dir, len})` builds a DOM pill + leader line,
  wraps it in a `CSS2DObject`, and it's parented like any mesh.
  `CSS2DRenderer.render(scene, camera)` runs every frame **after** the main
  WebGL pass inside the same `renderer.setAnimationLoop` callback,
  re-projecting each label's DOM position from its 3D world position via the
  camera matrix every tick. A post-pass (`declutterCallouts`) nudges
  overlapping labels apart per-frame without touching their authored base
  `dir`/`len` (stashed on the DOM node's dataset).
- **Critical constraint** (documented in Rule 9 and reproduced in
  `verify.mjs`'s comments): CSS2D DOM rects are only valid in *document*
  space; under a scripted scroll (as headless tooling does),
  `getBoundingClientRect()` reads stale/wrong positions. Both `verify.mjs`
  and `review-shots.mjs` work around this by requiring `scrollIntoView()`
  before any measurement, and `verify.mjs`'s label-visibility gate
  specifically **reprojects each callout's world anchor through the camera
  matrix** (`obj.getWorldPosition().project(camera)`) rather than trusting
  the DOM rect, reconstructing the expected text-box position from
  `labels.js`'s known leader-offset math.

---

## 5. Headless Rendering & Frame Extraction

### 5.1 Environment

```js
chromium.launch({
  args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-webgl'],
});
page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
```
- `viewport` is exactly the target output resolution: `{1080,1920}` for
  `short`, `{1920,1080}` for `long` — no separate render-then-scale step.
- `--use-angle=d3d11` forces real GPU rendering under Windows headless
  Chromium; the script's own comment quantifies the cost of skipping this:
  SwiftShader (CPU) software rendering makes each frame ~5-10x slower.
- `deviceScaleFactor: 1` — no supersampling; output pixels are captured 1:1.
- Verification (`verify.mjs`) and screenshot tooling (`review-shots.mjs`) use
  plain `chromium.launch()` with no special GPU flags — they don't need
  render-farm throughput, just correctness.

### 5.2 Frame determinism — the virtual clock

This is the single most load-bearing trick in the whole pipeline. Before any
page script runs (`page.addInitScript`), the exporter replaces the browser's
time primitives:

```js
performance.now = () => now;
Date.now = () => t0 + now;
window.requestAnimationFrame = (cb) => { cbs.push({id, cb}); return id; };
window.cancelAnimationFrame = (id) => { cbs = cbs.filter(e => e.id !== id); };
window.__vt = { advance(ms) { now += ms; const due = cbs; cbs = []; for (const e of due) e.cb(now); } };
```
Three.js's `renderer.setAnimationLoop` and anime.js's internal engine both
schedule via `requestAnimationFrame` and read elapsed time via
`performance.now()`/`Date.now()` — with both stubbed, **nothing animates
except when the script explicitly calls `window.__vt.advance(1000/fps)`**.
Real timers (`setTimeout`/`setInterval`) are left untouched — they only gate
one-time async boot work (asset loads), not per-frame animation. This turns
wall-clock-dependent real-time animation into a fully deterministic,
steppable simulation: the render is byte-reproducible and **decoupled from
actual render cost** — a scene that takes 400ms/frame to rasterize still
produces "the same" 24fps output as one that takes 10ms, because the clock
only moves when told to.

### 5.3 Extraction mechanics

Per advanced frame: `await page.screenshot({ path, quality: 98 })` — direct
**JPEG-to-disk** capture via Playwright's own screenshot API (not
WebCodecs, not raw canvas pixel streaming, not base64 buffers held in
memory). JPEG q98 is chosen explicitly over PNG for capture speed (comment:
"~3-4x faster to capture... dark-gradient posterizing is negligible, and the
encode-time `gradfun` deband mops up any residual banding"). Frames are
named `%05d.jpg` sequentially and later globbed by ffmpeg's image2 demuxer
(`-framerate {fps} -i frames/%05d.jpg`).

### 5.4 Performance

No formal benchmark is recorded in the repo, but the code's own reasoning
gives a concrete multiplier: GPU (`d3d11` ANGLE) vs. software (SwiftShader)
rendering differs "~5-10x" per the script's comment justifying the launch
flags — i.e., real GPU rendering is treated as mandatory for practical
export times on anything but the simplest scenes. `fps` defaults to 24
specifically to cut frame count ~20% versus 30fps "cinematic" framing, per
the script's own comment — a deliberate cost/quality tradeoff, not a
technical ceiling.

---

## 6. Audio & Narration Pipeline

There is no "two-pass, vision-driven re-alignment" step. What exists is a
**script-first, audio-is-the-clock** architecture:

### 6.1 Script authoring (pass 1 — human/agent, pre-render)

`video.js` is written by Claude Code under the `video-scripting` skill
*before* any TTS or render call — a `shots[]` array where each entry carries
`{step, dolly, labels, narration}`. Per repo convention (seen verbatim in
`induction-cooktop/video.js`'s header comment), narration is authored as
**one continuous voiceover**, not per-shot standalone lines — the per-shot
`narration` strings are just the cut points of a single flowing script,
because the whole thing gets synthesized in one TTS call (§6.2).

### 6.2 Synthesis

Single call per format to ElevenLabs' timestamped endpoint:
```
POST https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps?output_format=mp3_44100_128
body: {
  text: <all shot narration lines joined with a single space>,
  model_id: 'eleven_multilingual_v2',
  voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0,
                     use_speaker_boost: true, speed: 0.9 }
}
```
- Voice ID resolution precedence: `--voice` CLI flag → `VOICE_ID` env var
  (the channel's fixed voice) → hardcoded `pNInz6obpgDQGcFmaJgB` ("Adam")
  default.
- Response includes `alignment.character_start_times_seconds` /
  `character_end_times_seconds` per character — this is what makes
  everything downstream possible. The script reconstructs **word-level**
  timing by walking the char array and splitting on whitespace
  (`wordsFromAlignment`).
- Per-shot `{start, end}` timing is derived by mapping each shot's known
  character span in the concatenated script back into that alignment array.

**Two audio-side corrections happen before anything is written to disk:**
1. **Pause normalization** (text-level, pre-synthesis): spaced em/en-dashes
   and ellipses are rewritten to commas, because ElevenLabs renders those
   punctuation marks as long fixed-duration silences the `speed` parameter
   can't compress (measured in-repo: 2% length variance across `speed`
   0.7→1.0 with 4 em-dashes present, vs. 27% on clean prose).
2. **Pause trimming** (audio-level, post-synthesis): any inter-word gap
   exceeding `--max-pause` (default 0.3s) is physically cut out of the MP3
   via `ffmpeg atrim`+`concat` down to `--target-pause` (default 0.15s),
   with every subsequent word/shot timestamp shifted backward by the exact
   amount removed — a real edit to the waveform, not a script or speed
   change, because ElevenLabs' own delivery pauses aren't otherwise
   controllable.

Fallback: no `ELEVENLABS_API_KEY` (or the timestamped call throwing) →
per-shot Microsoft Edge neural TTS (`msedge-tts`), no alignment data, no
pause trimming — `export-video.mjs` falls back to extending each shot's
on-screen duration to fit that shot's own clip length plus a fixed breath,
rather than deriving pacing from word timing.

### 6.3 Sync mechanism ("visual-first re-alignment," corrected)

The actual re-alignment runs the *opposite direction* from a
vision-analyzes-frames model: **the rendered picture is stretched to fit the
already-synthesized audio**, not the script rewritten from rendered frames.
In `export-video.mjs`:
```js
shotDurations[i] = Math.max(FLY_SECONDS + 0.4, endV - startV);
```
where `endV`/`startV` come straight from `short-timings.json`. Each shot is
held on screen for exactly the span its narration occupies in the single
continuous take, with the 1.6s camera fly-to (`FLY_SECONDS`) captured as the
*opening slice* of that same span rather than an added silent beat — so cuts
land on word boundaries with no dead air. A fixed `LEAD_IN` (0.6s, silent
hero beat) and `TAIL_PAD` (4.0s, reserved for the end-card CTA) bookend the
whole thing.

---

## 7. Final Assembly & Encoding

### 7.1 Master encode
```
ffmpeg -y -framerate {fps} -i frames/%05d.jpg \
  -vf gradfun=1.2:16 \
  -c:v libx264 -preset slow -crf 16 \
  -pix_fmt yuv420p -movflags +faststart \
  {format}-master.mp4
```
`gradfun` debands the near-flat studio backdrop gradient (dithers it just
before encode, specifically because 8-bit H.264 reintroduces banding that
the live WebGL scene never shows) — `crf 16` (unusually high-quality for a
"draft" step) is chosen specifically to *preserve* that dither through
quantization rather than let it get crushed back into banding.

### 7.2 Caption burn (opt-in via `--captions`)
Captions are an ASS (`SubStation Alpha`) file, burned via `-vf
subtitles=...:fontsdir=...` and libass, re-encoded at `crf 18`. Two cue
sources, in priority order:
- **Verbatim word rail** (preferred, needs `*-words.json`): words are
  grouped into 1–4-word (`short`) or up to 7-word (`long`) phrase chunks
  under a measured character cap (18 chars short / 44 long — empirically
  verified via headless `canvas.measureText` at the real render font, not
  guessed), each word getting its own `Dialogue` cue so the *currently
  spoken* word pops in `&H00FFFF&` (ASS BGR yellow) while the rest of the
  phrase stays visible.
- **Legacy per-shot summary** (fallback, Edge TTS path with no alignment):
  one `Dialogue` line per shot from `video.js`'s `caption` field.

A hard **non-overlap pass** sorts all cues and clamps `cue[i].end =
min(cue[i].end, cue[i+1].start)` — the repo's own comments (dated
2026-07-28) trace a "captions visibly bouncing" defect to libass's
collision-avoidance stacking firing on sub-frame timing overlaps between
consecutive cues, which this pass eliminates structurally rather than by
tuning durations.

Style block excerpt (ASS v4+):
```
Style: Cap,Arial Black,84,&H00FFFFFF,&H00FFFFFF,&H00000000,&H7F000000,-1,0,0,0,100,100,0,0,1,5,1,8,60,60,{capMarginV},1
```
Alignment `8` (top-anchored) is deliberately used instead of the
conventional bottom-anchor `2`, specifically so a cue's *first line* stays
pinned regardless of word-wrap — bottom-anchored text grows upward as wrap
count changes, which was the actual mechanism behind captions "jumping."

### 7.3 Audio mix
```
ffmpeg -i {captioned}.mp4 -i {full-narration}.mp3 [-i {sfx}.mp3 ...] \
  -filter_complex "
    [1:a]adelay={ms}|{ms}[a0]; ...
    [a0][a1]...amix=inputs=N:normalize=0[mixed];
    [mixed]loudnorm=I=-14:TP=-1.5:LRA=11[out]" \
  -map 0:v -map "[out]" \
  -c:v copy -c:a aac -b:a 192k -t {videoDuration} \
  {format}-final.mp4
```
- `adelay` places each input (single continuous narration track, plus any
  per-cue sfx from `assets/sfx/`) at its exact video-timeline offset in
  milliseconds.
- `amix ... normalize=0` preserves authored relative levels between
  narration and sfx; a *separate* `loudnorm` pass afterward brings the
  finished mix to `-14 LUFS` integrated / `-1.5dBTP` true-peak / `11 LU`
  range — the streaming-platform loudness target — explicitly because
  skipping this made exports read as quieter/"amateur" next to
  platform-normalized neighbors.
- `-t {videoDuration}` bounds output length by the *rendered video*, not
  `-shortest` (which would truncate to the shorter audio and clip the
  end-card CTA that plays after narration ends).

### 7.4 Output packaging by format

| | `short` | `long` |
|---|---|---|
| Resolution | 1080×1920 (9:16) | 1920×1080 (16:9) |
| Camera | authored desktop poses + `dolly` pull-back per shot to avoid crop | authored poses, `dolly` usually 1 |
| Captions | word-synced karaoke rail, 84px, alignment 8 top-anchored near bottom | word-synced rail, 58px, same anchoring |
| End card | 2-line, points to YouTube (short's job is to feed the long-form) | 1-line "Share it." (long-form IS the terminal artifact) |
| Title card | none (hook lives in shot 1's first spoken words) unless legacy fallback | none by default |

There's no separate "web format" output beyond these two `--format` values —
the interactive site itself (the primary "web format") is the live
Vite/Three.js app, not an exported video at all; §7 only applies to the
offline MP4 pipeline.
