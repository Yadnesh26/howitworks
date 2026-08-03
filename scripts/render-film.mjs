// Render a long-form FILM: a documentary that spans multiple explainers.
//
//   node scripts/render-film.mjs <film-id> [--port 5199] [--fps 24]
//                                [--acts 0,1] [--no-captions] [--no-cards]
//                                [--out renders] [--keep-frames]
//
// WHY THIS EXISTS (and is not export-video.mjs). export-video.mjs renders ONE
// explainer, one shot per step, one fixed camera pose per shot. That shape is
// right for a 2-minute piece and wrong for an 8-minute one. A film needs:
//   * shots decoupled from steps  — several shots may sit on one step, the
//     camera moving and the voice developing, which is how you hold attention
//     past ~90 seconds;
//   * a moving camera            — a slow push-in during an explanation and a
//     pull-back on a scale reveal are the difference between "film" and
//     "narrated slideshow";
//   * many explainers in one cut — the story is the journey, and the journey
//     crosses hydro-power-plant -> transformer -> power-transmission;
//   * acts                       — a title card, a breath, and a fresh open
//     loop every ~90s is what actually rebuilds attention mid-video.
//
// Everything else (the virtualized clock, GPU flags, the verbatim caption rail,
// loudnorm) is deliberately the same machinery as export-video.mjs — that part
// is proven and there is no reason to fork it.
//
// Manifest: films/<film-id>/film.js  (see films/README.md for the shape)
// Output:   renders/film-<film-id>/
//   film-master.mp4     silent, no overlays — the reusable master
//   film-captioned.mp4  captions + act cards burned in
//   film-final.mp4      captioned + narration + sfx + music mixed
//   film-timeline.json  shot -> [start,end] seconds, per act
import { chromium } from 'playwright';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ffmpeg = require('ffmpeg-static');

// --- args ------------------------------------------------------------------
const args = process.argv.slice(2);
const filmId = args.find((a) => !a.startsWith('--'));
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
if (!filmId) {
  console.error('usage: node scripts/render-film.mjs <film-id> [--port 5199] [--fps 24] [--acts 0,1]');
  process.exit(1);
}
const port = opt('port', '5199');
const fps = Number(opt('fps', '24'));
const outRoot = resolve(opt('out', 'renders'), `film-${filmId}`);
const keepFrames = args.includes('--keep-frames');
const wantCaptions = !args.includes('--no-captions');
const wantCards = !args.includes('--no-cards');
// --mix-only reuses the existing film-captioned.mp4 and redoes ONLY the audio
// mix. Audio iteration (music gain, an sfx that steps on a word, a re-cut
// narration) is the most common reason to re-run this script, and paying a
// 12,000-frame re-render for it makes that iteration impractical.
const mixOnly = args.includes('--mix-only');
// --acts lets you render one act while iterating (a full 9-minute film at 24fps
// is ~13k frames; you do NOT want that turnaround on a script change).
const actFilter = opt('acts', null)?.split(',').map(Number) ?? null;

const viewport = { width: 1920, height: 1080 };

// --- manifest --------------------------------------------------------------
const filmPath = resolve(`films/${filmId}/film.js`);
if (!existsSync(filmPath)) {
  console.error(`${filmPath} not found — write the film manifest first (see films/README.md).`);
  process.exit(1);
}
const film = (await import(pathToFileURL(filmPath))).default;
const allActs = film.acts ?? [];
// --acts filters, but the ORIGINAL act index has to survive it: the narration
// files are named act-NN by original index, and so is the act card's number.
// Filtering to a bare array silently renders act 3 with act 1's voiceover.
const actEntries = allActs
  .map((act, index) => ({ act, index }))
  .filter((e) => !actFilter || actFilter.includes(e.index));
const acts = actEntries.map((e) => e.act);
const actNo = actEntries.map((e) => e.index); // render position -> original index
if (!acts.length) {
  console.error('film has no acts (or --acts filtered them all out)');
  process.exit(1);
}

// Flatten to a global shot list, remembering which act each shot came from.
// Global index is what the timeline and the sfx cues key off; the per-act index
// is what the narration timings key off (one ElevenLabs take per act).
const shots = [];
acts.forEach((act, ai) => {
  (act.shots ?? []).forEach((shot, si) => {
    // actIndex = position in this render; actNo = position in the whole film
    shots.push({ ...shot, actIndex: ai, actNo: actNo[ai], shotInAct: si, globalIndex: shots.length });
  });
});
console.log(`film "${filmId}": ${acts.length} acts, ${shots.length} shots`);

// --- camera-move sanity ----------------------------------------------------
// RANGES ARE NARROW ON PURPOSE. The step's own camera pose was already framed
// by whoever built the explainer; a move is seasoning on top of it, not a
// re-frame. Measured on the first cut of this film: push 0.72 ended with the
// subject half out of frame, and dolly 1.15 x push 1.35 shrank the model to an
// island in an empty frame. A move the viewer consciously NOTICES is already
// too big — the point is that the frame feels alive, not that the camera
// performs. Clamping here (not per-frame) so the warning prints once.
const PUSH_MIN = 0.85; // closest a push-in may end
const PUSH_MAX = 1.22; // furthest a pull-back may end
const DOLLY_MIN = 0.8;
const DOLLY_MAX = 1.35;
const ORBIT_MAX = 25; // degrees over one shot; beyond this it reads as a spin
function normalizeMoves() {
  const clamp = (v, lo, hi, what, i) => {
    if (v == null) return v;
    const c = Math.max(lo, Math.min(hi, v));
    if (c !== v) console.warn(`  shot ${i}: ${what} ${v} -> clamped to ${c} (beyond this the subject crops)`);
    return c;
  };
  for (const s of shots) {
    s.push = clamp(s.push, PUSH_MIN, PUSH_MAX, 'push', s.globalIndex);
    s.dolly = clamp(s.dolly, DOLLY_MIN, DOLLY_MAX, 'dolly', s.globalIndex);
    s.orbit = clamp(s.orbit, -ORBIT_MAX, ORBIT_MAX, 'orbit', s.globalIndex);
    // A dolly and a push compound (end distance = dolly x push). Both pulling
    // the same way is what produced the empty-frame shot.
    const endScale = (s.dolly ?? 1) * (s.push ?? 1);
    if (endScale > 1.4 || endScale < 0.78) {
      console.warn(`  shot ${s.globalIndex}: dolly x push = ${endScale.toFixed(2)} — they compound; expect a badly framed shot`);
    }
  }
}
normalizeMoves();

// --- pacing ----------------------------------------------------------------
// Same contract as export-video.mjs: the AUDIO is the clock wherever narration
// exists. Difference: narration is synthesized one take PER ACT (see
// make-film-narration.mjs), because a 9-minute single take is past what the
// TTS endpoint handles gracefully and because act boundaries are exactly where
// you want the performance to reset anyway.
const FLY_SECONDS = 1.6; // camera fly-to, captured as the first slice of a shot
const LEAD_IN = 1.2; // silent beat on the opening frame before the first word
const ACT_GAP = 1.6; // breath between acts — this is the act card's window
const TAIL_PAD = 4.5; // hold after the last word — the end card's window
const frameMs = 1000 / fps;

const audioDir = join(outRoot, 'audio');

// Per-act audio: act-NN.mp3 + act-NN-timings.json (keyed by shot-in-act).
const actAudio = acts.map((_, ai) => {
  const n = String(actNo[ai]).padStart(2, '0'); // original index — see actEntries
  const mp3 = join(audioDir, `act-${n}.mp3`);
  const timings = join(audioDir, `act-${n}-timings.json`);
  const words = join(audioDir, `act-${n}-words.json`);
  return existsSync(mp3) && existsSync(timings)
    ? { mp3, timings: JSON.parse(readFileSync(timings, 'utf8')), words: existsSync(words) ? JSON.parse(readFileSync(words, 'utf8')) : null }
    : null;
});
const anyAudio = actAudio.some(Boolean);
console.log(
  anyAudio
    ? `pacing: audio-master — ${actAudio.filter(Boolean).length}/${acts.length} acts have narration`
    : 'pacing: script seconds (no narration found — run make-film-narration.mjs first)',
);

// Lay the whole film out on the video timeline BEFORE rendering a frame, so the
// caption/card/mix passes all read from one authority instead of re-deriving it.
const plan = []; // per global shot: { start, end, contentStart }
const actPlan = []; // per act: { start, end, audioStart }
let cursor = LEAD_IN;

acts.forEach((act, ai) => {
  const aAudio = actAudio[ai];
  const actStart = cursor;
  const audioStart = cursor;
  const inAct = shots.filter((s) => s.actIndex === ai);

  inAct.forEach((shot, si) => {
    let dur;
    if (aAudio?.timings?.[si]) {
      const t = aAudio.timings[si];
      const next = aAudio.timings[si + 1];
      // hold this shot until the next line begins; the last line of the act
      // holds to its own end (the ACT_GAP after it is the breath)
      dur = (next ? next.start : t.end) - t.start;
      // the very first shot of an act must also cover the run-up from the act's
      // start to its first spoken word
      if (si === 0) dur += t.start;
    } else {
      dur = shot.seconds ?? 8;
    }
    // floor: every shot must at least fit its camera fly-to plus a beat of hold
    dur = Math.max(FLY_SECONDS + 0.5, dur);

    const start = cursor;
    const contentStart = aAudio?.timings?.[si] ? audioStart + aAudio.timings[si].start : start + (si === 0 ? 0 : FLY_SECONDS);
    plan[shot.globalIndex] = { start, contentStart, end: start + dur };
    cursor = start + dur;
  });

  // last act gets the long tail (end card); every other act gets a breath
  cursor += ai === acts.length - 1 ? TAIL_PAD : ACT_GAP;
  actPlan[ai] = { start: actStart, audioStart, end: cursor };
});
const filmDuration = cursor;
console.log(`planned runtime: ${(filmDuration / 60).toFixed(1)} min (${filmDuration.toFixed(1)}s)`);

// --- browser ---------------------------------------------------------------
const framesDir = join(outRoot, 'frames');
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });
mkdirSync(audioDir, { recursive: true });

// Real GPU in headless — without these WebGL falls back to SwiftShader (CPU)
// and a frame costs ~1s instead of ~0.1s. On a 13k-frame film that is the
// difference between 25 minutes and 3.5 hours.
const browser = mixOnly
  ? null
  : await chromium.launch({
      args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-webgl'],
    });

// The virtual clock. Identical to export-video.mjs: replace rAF + performance.now
// so frames are deterministic and perfectly smooth regardless of render cost.
const clockInit = () => {
  let now = 0;
  let cbs = [];
  let nextId = 1;
  const t0 = Date.now();
  performance.now = () => now;
  Date.now = () => t0 + now;
  window.requestAnimationFrame = (cb) => {
    const id = nextId++;
    cbs.push({ id, cb });
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    cbs = cbs.filter((e) => e.id !== id);
  };
  window.__vt = {
    advance(ms) {
      now += ms;
      const due = cbs;
      cbs = [];
      for (const e of due) e.cb(now);
    },
  };
};

// Consecutive shots on the same explainer share one page load — a "reel".
// Reloading between every shot would cost ~8s of boot each and, worse, restart
// the mechanism's loop from cold on every cut.
const reels = [];
for (const shot of shots) {
  const last = reels[reels.length - 1];
  if (last && last.explainer === shot.explainer) last.shots.push(shot);
  else reels.push({ explainer: shot.explainer, shots: [shot] });
}
console.log(`${reels.length} reels (page loads) across ${new Set(shots.map((s) => s.explainer)).size} explainers`);

async function openReel(explainer, firstDolly) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on('console', (m) => {
    if (m.type() === 'error') console.error(`[page error] ${m.text()}`);
  });
  page.on('pageerror', (e) => console.error(`[page exception] ${e.message}`));
  await page.addInitScript(clockInit);
  // must exist before boot: the player flies to step 0 immediately, and
  // re-activating the same step later is a no-op
  await page.addInitScript((v) => { window.__hiwCameraScale = v; }, firstDolly);
  await page.goto(`http://localhost:${port}/#/${explainer}`);
  // polling MUST be an interval, never Playwright's default 'raf' — the init
  // script replaced rAF with a queue that only drains on __vt.advance(), and
  // advance() cannot run until this wait resolves. With 'raf' this deadlocks.
  await page.waitForFunction(() => window.__hiw?.stepRuntimes?.length > 0, null, {
    timeout: 180000,
    polling: 500,
  });
  await page.waitForTimeout(2000); // real-time: HDRI + lazy chunk over the network
  await page.addStyleTag({
    content: `
      .player-hero, .steps, .rail, .back-link, .scroll-hint { display: none !important; }
      body { overflow: hidden; }
    `,
  });
  // Toggleable sheet for the in-scene CSS2D part labels. They are scene content
  // (not chrome), and on a WIDE establishing shot they genuinely help — they
  // annotate the journey. On a tight shot they crop against the frame edge and
  // read as leftover app UI. So: per-shot control, film-level default.
  await page.evaluate(() => {
    const s = document.createElement('style');
    s.id = 'film-callouts';
    document.head.appendChild(s);
  });
  return page;
}

// film.callouts: false hides them everywhere; a shot's own `callouts` wins.
const calloutsFor = (shot) => shot.callouts ?? film.callouts ?? true;
const setCallouts = (page, on) =>
  page.evaluate((hide) => {
    document.getElementById('film-callouts').textContent = hide
      ? '.callout { display: none !important; }'
      : '';
  }, !on);

// --- camera moves ----------------------------------------------------------
// The player owns the camera during a shot's fly-to (anime.js is tweening it).
// We take ownership only AFTER that window closes, so the two never write the
// same property at once (CLAUDE.md rule 5, applied to the camera).
//
// Moves are expressed relative to the pose the step flew to, which keeps a
// film manifest readable and keeps it correct if the explainer's step camera is
// later retuned:
//   dolly  static distance multiplier (1 = the step's own pose)
//   push   distance multiplier reached by the END of the shot (<1 pushes in)
//   orbit  degrees of azimuth travelled over the shot (parallax drift)
//   rise   vertical offset in world units reached by the end of the shot
// Ranges are clamped at load — see normalizeMoves.
const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

async function captureBase(page) {
  return page.evaluate(() => {
    const c = window.__hiw.stage.camera;
    const t = window.__hiw.stage.controls.target;
    return { p: [c.position.x, c.position.y, c.position.z], t: [t.x, t.y, t.z] };
  });
}

async function applyMove(page, base, shot, p) {
  const push = shot.push ?? 1; // already clamped at load (see normalizeMoves)
  const orbit = ((shot.orbit ?? 0) * Math.PI) / 180;
  const rise = shot.rise ?? 0;
  const e = easeInOut(p);
  const scale = 1 + (push - 1) * e;
  const ang = orbit * e;
  const dy = rise * e;
  await page.evaluate(
    ({ base, scale, ang, dy }) => {
      const c = window.__hiw.stage.camera;
      const [px, py, pz] = base.p;
      const [tx, ty, tz] = base.t;
      let vx = px - tx;
      const vy = py - ty;
      let vz = pz - tz;
      // rotate the offset about world Y, then scale it — orbit then dolly
      const cs = Math.cos(ang);
      const sn = Math.sin(ang);
      const rx = vx * cs - vz * sn;
      const rz = vx * sn + vz * cs;
      vx = rx;
      vz = rz;
      c.position.set(tx + vx * scale, ty + (vy + dy) * scale, tz + vz * scale);
      c.lookAt(tx, ty, tz);
    },
    { base, scale, ang, dy },
  );
}

// --- render ----------------------------------------------------------------
let frame = 0;
let timeline = [];
const t0 = Date.now();

if (mixOnly) {
  // Reconstruct the timeline from the plan rather than the frame loop. The plan
  // is derived from the manifest + narration timings, so it is identical to
  // what the render produced — provided the narration has not been regenerated
  // with different lengths since. Guard against exactly that.
  const prev = join(outRoot, 'film-timeline.json');
  if (!existsSync(prev)) {
    console.error('--mix-only needs a previous render (film-timeline.json missing)');
    process.exit(1);
  }
  const old = JSON.parse(readFileSync(prev, 'utf8'));
  if (Math.abs(old.duration - filmDuration) > 0.05) {
    console.error(
      `--mix-only refused: the plan is now ${filmDuration.toFixed(1)}s but the rendered video is ${old.duration.toFixed(1)}s.`,
    );
    console.error('The narration or shot list changed — the picture must be re-rendered. Drop --mix-only.');
    process.exit(1);
  }
  timeline = old.shots;
  frame = Math.round(filmDuration * fps);
  console.log(`mix-only: reusing the rendered picture (${(filmDuration / 60).toFixed(1)} min)`);
} else {
  console.log(`rendering ${viewport.width}x${viewport.height}@${fps} -> ${outRoot}`);
  for (const reel of reels) {
  const page = await openReel(reel.explainer, reel.shots[0].dolly ?? 1);
  const stepCount = await page.evaluate(() => window.__hiw.stepRuntimes.length);
  const advance = (ms) => page.evaluate((m) => window.__vt.advance(m), ms);

  // warm up so entry animations and the first loop settle before frame 0
  await page.evaluate((n) => window.__hiw.activate(n), reel.shots[0].step);
  for (let i = 0; i < fps * 2; i++) await advance(frameMs);

  for (const shot of reel.shots) {
    if (shot.step >= stepCount) {
      console.error(`shot ${shot.globalIndex} references ${shot.explainer} step ${shot.step}, which has only ${stepCount} steps`);
      await browser.close();
      process.exit(1);
    }
    const span = plan[shot.globalIndex];
    const totalFrames = Math.round((span.end - span.start) * fps);
    const flyFrames = Math.round(FLY_SECONDS * fps);

    await page.evaluate((v) => { window.__hiwCameraScale = v; }, shot.dolly ?? 1);
    await setCallouts(page, calloutsFor(shot));
    await page.evaluate((n) => window.__hiw.activate(n), shot.step);

    let base = null;
    for (let f = 0; f < totalFrames; f++) {
      // camera move owns the frame only after the player's fly-to has landed
      if (f === flyFrames) base = await captureBase(page);
      if (base && f > flyFrames) {
        const p = (f - flyFrames) / Math.max(1, totalFrames - flyFrames);
        await applyMove(page, base, shot, p);
      }
      await advance(frameMs);
      // JPEG q98 — ~3-4x faster to capture than PNG; the gradfun deband at
      // encode time mops up any residual banding in the dark gradients.
      await page.screenshot({
        path: join(framesDir, `${String(frame).padStart(6, '0')}.jpg`),
        quality: 98,
      });
      frame++;
    }

    timeline.push({
      shot: shot.globalIndex,
      act: shot.actNo,
      explainer: shot.explainer,
      step: shot.step,
      start: Number(span.start.toFixed(3)),
      contentStart: Number(span.contentStart.toFixed(3)),
      end: Number(span.end.toFixed(3)),
      narration: shot.narration ?? null,
      sfx: shot.sfx ?? null,
    });
    const pct = ((frame / (filmDuration * fps)) * 100).toFixed(0);
    console.log(
      `  shot ${shot.globalIndex + 1}/${shots.length} — act ${shot.actNo + 1}, ${shot.explainer} step ${shot.step + 1}, ${totalFrames}f (${pct}%, ${((Date.now() - t0) / 1000).toFixed(0)}s)`,
    );
  }

  // Hold the last frame of a reel across the act gap so the cut to the next
  // explainer lands on the act card, not on a jump.
  await page.close();
}

// The planned timeline includes act gaps and the tail; the frame loop only
// rendered shot spans. Pad the difference by repeating the final frame so the
// end card has picture under it.
const renderedSeconds = frame / fps;
if (filmDuration > renderedSeconds) {
  const padFrames = Math.round((filmDuration - renderedSeconds) * fps);
  const lastFrame = join(framesDir, `${String(frame - 1).padStart(6, '0')}.jpg`);
  const buf = readFileSync(lastFrame);
  for (let i = 0; i < padFrames; i++) {
    writeFileSync(join(framesDir, `${String(frame).padStart(6, '0')}.jpg`), buf);
    frame++;
  }
  console.log(`padded ${padFrames} frames (act gaps + tail)`);
}

  await browser.close();
  writeFileSync(join(outRoot, 'film-timeline.json'), JSON.stringify({ film: filmId, duration: filmDuration, acts: actPlan, shots: timeline }, null, 2));
} // end !mixOnly

// --- encode master ---------------------------------------------------------
const run = (fargs, label, cwd) => {
  const r = spawnSync(ffmpeg, ['-y', ...fargs], { stdio: ['ignore', 'ignore', 'pipe'], cwd });
  if (r.status !== 0) {
    console.error(`ffmpeg ${label} failed:\n${r.stderr.toString().slice(-2000)}`);
    process.exit(1);
  }
};
const master = join(outRoot, 'film-master.mp4');
if (!mixOnly) {
  run(
    [
      '-framerate', String(fps),
      '-i', join(framesDir, '%06d.jpg'),
      '-vf', 'gradfun=1.2:16',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      master,
    ],
    'encode',
  );
  console.log(`master: ${master} (${(frame / fps / 60).toFixed(1)} min)`);
}

// --- overlays: caption rail + title card + act cards + end card -------------
// One libass pass carries all of them. Each burn is a full re-encode, so they
// must never cost more than one pass between them.
const ts = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = (s % 60).toFixed(2).padStart(5, '0');
  return `${h}:${String(m).padStart(2, '0')}:${sec}`;
};
const esc = (t) => String(t).replace(/\n/g, '\\N');
const HILITE = '&H00FFFF&'; // ASS BGR — bright yellow pop on the active word

let cues = [];
if (wantCaptions) {
  // Verbatim rail, per act: group the act's spoken words into short phrase
  // groups timed to when they are ACTUALLY said, offset onto the act's audio
  // start. Same model as export-video.mjs (see the captions-overlay skill).
  acts.forEach((_, ai) => {
    const a = actAudio[ai];
    if (!a?.words) return;
    const off = actPlan[ai].audioStart;
    const groups = [];
    let grp = [];
    const flush = () => { if (grp.length) { groups.push(grp); grp = []; } };
    for (const w of a.words) {
      grp.push(w);
      const len = grp.reduce((n, x) => n + x.t.length + 1, -1);
      if (/[.?!]["')\]]?$/.test(w.t) || (/[,;:—]$/.test(w.t) && grp.length >= 2) || grp.length >= 7 || len >= 44) flush();
    }
    flush();
    groups.forEach((g, gi) => {
      const nextStart = gi + 1 < groups.length ? groups[gi + 1][0].s + off : Infinity;
      const groupEnd = Math.min(nextStart, g[g.length - 1].e + off + 1.0, filmDuration);
      g.forEach((w, i) => {
        const start = w.s + off;
        const nextWord = i + 1 < g.length ? g[i + 1].s + off : groupEnd;
        cues.push({
          start,
          end: Math.max(Math.min(nextWord, groupEnd), start + 0.15),
          text: g.map((x, j) => (j === i ? `{\\c${HILITE}}${esc(x.t)}{\\r}` : esc(x.t))).join(' '),
        });
      });
    });
  });
  console.log(`captions: verbatim rail — ${cues.length} word-synced cues`);
}

// NON-OVERLAPPING CUES — the caption-bounce fix. libass stacks simultaneous
// events vertically, so any overlap makes the rail jump a full line and back.
// Clamping each cue to end where the next begins removes the stacking without
// opening gaps.
cues.sort((a, b) => a.start - b.start || a.end - b.end);
for (let i = 0; i < cues.length - 1; i++) if (cues[i].end > cues[i + 1].start) cues[i].end = cues[i + 1].start;
cues = cues.filter((c) => c.end > c.start);

const lines = [];
const TITLE_SECONDS = 5;
const ACTCARD_SECONDS = 2.6;
const ENDCARD_SECONDS = 4.0;

if (wantCards) {
  // Opening title — the film's name, held over the first shot then cleared so
  // nothing competes with the mechanism or collides with the CSS2D callouts.
  const title = film.title ?? filmId.toUpperCase();
  lines.push(`Dialogue: 2,${ts(0)},${ts(TITLE_SECONDS)},Title,,0,0,0,,${esc(title)}`);
  if (film.subtitle) {
    lines.push(`Dialogue: 2,${ts(0.4)},${ts(TITLE_SECONDS)},Subtitle,,0,0,0,,${esc(film.subtitle)}`);
  }
  // Act cards — the structural beat that rebuilds attention. Act 0's card would
  // collide with the title, so it is skipped; every later act announces itself
  // during its gap, over the held last frame of the previous act.
  acts.forEach((act, ai) => {
    if (ai === 0 || !act.title) return;
    const start = Math.max(0, actPlan[ai].start - ACT_GAP + 0.2);
    lines.push(
      `Dialogue: 2,${ts(start)},${ts(start + ACTCARD_SECONDS)},ActCard,,0,0,0,,${esc(`${String(actNo[ai] + 1).padStart(2, '0')}  ${act.title.toUpperCase()}`)}`,
    );
  });
  // End card — scheduled after the last spoken caption so it never fights the
  // voice rail (they share the bottom anchor; overlap is a hard collision).
  const lastCueEnd = cues.length ? Math.max(...cues.map((c) => c.end)) : 0;
  const endStart = Math.max(filmDuration - ENDCARD_SECONDS, Math.min(lastCueEnd + 0.2, filmDuration - 1.5));
  if (endStart < filmDuration - 0.4) {
    lines.push(`Dialogue: 2,${ts(endStart)},${ts(filmDuration)},EndCard,,0,0,0,,${esc(film.endCard ?? 'Subscribe for the next one\nwhatDstuff')}`);
  }
}
for (const c of cues) lines.push(`Dialogue: 0,${ts(c.start)},${ts(c.end)},Cap,,0,0,0,,${c.text}`);

let captioned = master;
if (mixOnly) {
  // The burned picture is already on disk; re-burning it would cost a full
  // re-encode for no change. Fall back to the master if captions were never
  // burned in the original run.
  const prevCaptioned = join(outRoot, 'film-captioned.mp4');
  captioned = existsSync(prevCaptioned) ? prevCaptioned : master;
  console.log(`mix-only: reusing ${captioned}`);
} else if (lines.length) {
  const fontName = 'Arial Black';
  const fontSize = 54;
  const marginV = 64;
  // Title sits HIGH, not centered. A centered film title reads better in
  // isolation, but the 3D model occupies the middle of the frame and the CSS2D
  // part labels float around it — at 34% height the title landed straight on
  // top of "Dam" and "Powerhouse". Top-anchored clears both, in every scene.
  const TITLE_MARGIN_V = Math.round(viewport.height * 0.08);
  // CAPTION BASELINE STABILITY: bottom-anchored text grows upward, so a cue
  // that wraps to two lines starts a line higher and the rail visibly bounces.
  // Top-anchoring the block (alignment 8) pins the FIRST line and lets extra
  // lines extend downward; the reserve keeps a two-line cue in the same zone.
  const capLineHeight = Math.round(fontSize * 1.2);
  const capMarginV = Math.max(0, viewport.height - marginV - capLineHeight * 2);
  const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${viewport.width}
PlayResY: ${viewport.height}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,${fontName},${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H7F000000,-1,0,0,0,100,100,0,0,1,5,1,8,60,60,${capMarginV},1
Style: Title,${fontName},${Math.round(fontSize * 1.5)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H7F000000,-1,0,0,0,100,100,6,0,1,5,1,8,60,60,${TITLE_MARGIN_V},1
Style: Subtitle,${fontName},${Math.round(fontSize * 0.62)},&H00E8E8E8,&H00E8E8E8,&H00000000,&H7F000000,0,0,0,0,100,100,3,0,1,4,1,8,60,60,${TITLE_MARGIN_V + Math.round(fontSize * 2.0)},1
Style: ActCard,${fontName},${Math.round(fontSize * 1.05)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H7F000000,-1,0,0,0,100,100,8,0,1,5,1,4,60,60,0,1
Style: EndCard,${fontName},${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H7F000000,-1,0,0,0,100,100,0,0,1,5,1,2,60,60,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${lines.join('\n')}
`;
  writeFileSync(join(outRoot, 'film-captions.ass'), ass);
  captioned = join(outRoot, 'film-captioned.mp4');
  // cwd = outRoot so libass gets a plain relative filename (Windows
  // drive-letter paths break the subtitles filter's escaping)
  const r = spawnSync(
    ffmpeg,
    [
      '-y', '-i', 'film-master.mp4',
      '-vf', `subtitles=film-captions.ass:fontsdir='C\\:/Windows/Fonts'`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      'film-captioned.mp4',
    ],
    { cwd: outRoot, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  if (r.status !== 0) {
    console.error(`caption burn failed (master still usable):\n${r.stderr.toString().slice(-2000)}`);
    captioned = master;
  } else console.log(`captioned: ${captioned}`);
}

// --- audio mix: narration + sfx + ducked music bed --------------------------
// Narration is one input per act, delayed to that act's audioStart. SFX are
// point cues. Music, if present, is looped to length and SIDECHAINED to the
// narration bus so it drops under the voice and swells in the gaps — that
// ducking is most of what makes a long-form mix sound produced rather than
// "music track laid under a voice track".
const inputs = [];
const delays = [];
const kinds = []; // 'voice' | 'sfx'
acts.forEach((_, ai) => {
  const a = actAudio[ai];
  if (!a) return;
  inputs.push(a.mp3);
  delays.push(Math.round(actPlan[ai].audioStart * 1000));
  kinds.push('voice');
});
for (const t of timeline) {
  for (const cue of t.sfx ?? []) {
    const f = resolve('assets/sfx', `${cue.file}.mp3`);
    if (existsSync(f)) {
      inputs.push(f);
      delays.push(Math.round((t.contentStart + (cue.at ?? 0)) * 1000));
      kinds.push('sfx');
    } else console.warn(`  sfx missing: ${f} (run make-sfx.mjs ${filmId})`);
  }
}
const musicPath = film.music ? resolve('assets/music', `${film.music}.mp3`) : null;
const hasMusic = musicPath && existsSync(musicPath);
if (film.music && !hasMusic) console.warn(`music missing: ${musicPath} — mixing without a bed`);

if (inputs.length || hasMusic) {
  const final = join(outRoot, 'film-final.mp4');
  const fin = ['-i', captioned];
  for (const f of inputs) fin.push('-i', f);
  if (hasMusic) fin.push('-stream_loop', '-1', '-i', musicPath);

  // NORMALIZE EVERY INPUT TO 48k STEREO BEFORE amix. Without this, amix
  // negotiates a single common format across inputs and picks the narrowest —
  // measured on the first full render: mono TTS takes + stereo music bed came
  // out MONO at 96kHz, silently collapsing the bed's width. Upmixing after the
  // fact only yields dual-mono, so the conversion has to happen per input.
  const norm = 'aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo';
  const chains = inputs.map((_, i) => `[${i + 1}:a]${norm},adelay=${delays[i]}|${delays[i]}[a${i}]`);
  const voiceIdx = kinds.map((k, i) => (k === 'voice' ? i : -1)).filter((i) => i >= 0);
  const sfxIdx = kinds.map((k, i) => (k === 'sfx' ? i : -1)).filter((i) => i >= 0);

  let mix;
  if (hasMusic) {
    const musicIn = inputs.length + 1;
    const voiceBus = voiceIdx.length
      ? `${voiceIdx.map((i) => `[a${i}]`).join('')}amix=inputs=${voiceIdx.length}:normalize=0[voice];`
      : `anullsrc=r=48000:cl=stereo,atrim=0:${filmDuration.toFixed(2)}[voice];`;
    // asplit: one copy of the voice is the sidechain key, the other goes to the
    // final mix. Without the split the key consumes the voice and it vanishes.
    // apad ON THE SIDECHAIN KEY. sidechaincompress ends as soon as EITHER of
    // its inputs ends, and the key is the voice — which stops at the last
    // spoken word. Without this pad the ducked music is truncated there, so
    // the deliberate tail (the END CARD's window) plays in total silence, which
    // is precisely the "reads as a mistake" failure the bed exists to prevent.
    // Padding the key with silence keeps the compressor running to the end AND
    // leaves the music un-ducked over the card, so it swells for the outro.
    mix =
      `${chains.join(';')}${chains.length ? ';' : ''}${voiceBus}` +
      `[voice]asplit=2[vkey][vout];` +
      `[vkey]apad=whole_dur=${filmDuration.toFixed(2)}[vkeyp];` +
      `[${musicIn}:a]${norm},volume=${film.musicGain ?? 0.18},atrim=0:${filmDuration.toFixed(2)}[mraw];` +
      `[mraw][vkeyp]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=600[mduck];` +
      `[vout][mduck]${sfxIdx.map((i) => `[a${i}]`).join('')}amix=inputs=${2 + sfxIdx.length}:normalize=0[mixed];` +
      `[mixed]apad=whole_dur=${filmDuration.toFixed(2)},loudnorm=I=-14:TP=-1.5:LRA=11[out]`;
  } else {
    // apad for the same reason as the music path: the tail past the last word
    // is deliberate (the end card's window) and must carry audio, not stop.
    mix =
      `${chains.join(';')};${inputs.map((_, i) => `[a${i}]`).join('')}` +
      `amix=inputs=${inputs.length}:normalize=0[mixed];` +
      `[mixed]apad=whole_dur=${filmDuration.toFixed(2)},loudnorm=I=-14:TP=-1.5:LRA=11[out]`;
  }

  run(
    [
      ...fin,
      '-filter_complex', mix,
      '-map', '0:v', '-map', '[out]',
      // NOT -shortest: the tail past the last word is deliberate (it is the end
      // card's window), and -shortest would cut the picture back to the audio.
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      '-t', filmDuration.toFixed(3),
      final,
    ],
    'audio mix',
  );
  console.log(`final: ${final}${hasMusic ? ' (voice + sfx + ducked music)' : ''}`);
} else {
  console.log('audio: nothing to mix — run make-film-narration.mjs first');
}

if (!keepFrames) rmSync(framesDir, { recursive: true, force: true });
console.log('done');
