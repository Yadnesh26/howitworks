// Render an explainer to video by driving a virtualized clock frame-by-frame.
//
//   node scripts/export-video.mjs <explainer-id> [--format short|long] [--port 5199]
//                                 [--fps 30] [--out renders] [--keep-frames]
//
// How it works: every animation in the app (anime.js engine, three's
// setAnimationLoop, camera fly-tos) is driven by requestAnimationFrame +
// performance.now. We stub both in the page with a manual clock, advance it
// exactly 1000/fps ms per captured frame, and screenshot each frame — the
// result is deterministic and perfectly smooth regardless of render cost.
//
// The shot list comes from src/explainers/<id>/video.js (editorial layer:
// which steps, how long, captions, narration). Falls back to "every step,
// 8s each" when video.js doesn't exist yet.
//
// Output (renders/<id>/):
//   <format>-master.mp4    silent, no captions — the reusable master
//   <format>-captioned.mp4 captions burned in (skipped if no captions)
//   <format>-final.mp4     captioned + narration/sfx mixed (skipped if no audio)
//   <format>-timeline.json shot → [start,end] seconds, for audio/caption sync
import { chromium } from 'playwright';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ffmpeg = require('ffmpeg-static');

// --- args --------------------------------------------------------------
const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
if (!id) {
  console.error('usage: node scripts/export-video.mjs <explainer-id> [--format short|long] [--port 5199] [--fps 30]');
  process.exit(1);
}
const format = opt('format', 'long'); // short = 9:16 vertical, long = 16:9
const port = opt('port', '5199');
const fps = Number(opt('fps', '24')); // 24 = cinematic and 20% fewer frames
const outRoot = resolve(opt('out', 'renders'), id);
const keepFrames = args.includes('--keep-frames');

const viewport =
  format === 'short'
    ? { width: 1080, height: 1920 }
    : { width: 1920, height: 1080 };

// --- editorial layer (video.js) -----------------------------------------
const videoJsPath = resolve(`src/explainers/${id}/video.js`);
let editorial = null;
if (existsSync(videoJsPath)) {
  editorial = (await import(pathToFileURL(videoJsPath))).default;
  console.log(`editorial: ${videoJsPath}`);
} else {
  console.log('editorial: none (video.js missing) — rendering every step, 8s each');
}

// --- launch page with virtual clock --------------------------------------
const framesDir = join(outRoot, `${format}-frames`);
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

// Real GPU in headless: without these flags Chromium renders WebGL on
// SwiftShader (CPU) and frames cost ~1s each; with the GPU they're ~5-10x faster.
const browser = await chromium.launch({
  args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
page.on('console', (m) => {
  if (m.type() === 'error') console.error(`[page error] ${m.text()}`);
});

// Must be installed before any page script runs: replace the clock the whole
// app animates on. Real timers (setTimeout/Interval) stay real — they only
// gate boot/loading, not animation.
await page.addInitScript(() => {
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
    now: () => now,
  };
});

// The first shot's dolly must exist BEFORE the player boots: boot flies to
// the first step immediately, and re-activating the same step is a no-op.
const baseDolly = format === 'short' ? Number(editorial?.short?.dolly ?? 1.35) : 1;
const firstDolly = editorial?.[format]?.shots?.[0]?.dolly ?? baseDolly;
await page.addInitScript((v) => { window.__hiwCameraScale = v; }, firstDolly);

await page.goto(`http://localhost:${port}/#/${id}`);
// generous: a cold vite server compiles three.js + the explainer chunk on first
// hit, and the heaviest scenes (semi-auto-pistol) can take a while to build +
// warm the D3D11 GPU path under headless
await page.waitForFunction(() => window.__hiw?.stepRuntimes?.length > 0, null, { timeout: 180000 });
// real-time wait: HDRI env map + lazy chunks arrive over the network
await page.waitForTimeout(2000);

// video mode: pure 3D — hide every piece of page chrome (CSS2D part labels
// live inside .canvas-holder and stay visible; they're content, not chrome)
await page.addStyleTag({
  content: `
    .player-hero, .steps, .rail, .back-link, .scroll-hint { display: none !important; }
    body { overflow: hidden; }
  `,
});

const stepCount = await page.evaluate(() => window.__hiw.stepRuntimes.length);

// resolve the shot list
const shots =
  editorial?.[format]?.shots ??
  Array.from({ length: stepCount }, (_, i) => ({ step: i, seconds: 8 }));
for (const s of shots) {
  if (s.step >= stepCount) {
    console.error(`shot references step ${s.step}, but ${id} has only ${stepCount} steps`);
    process.exit(1);
  }
}

// --- pacing ----------------------------------------------------------------
// The AUDIO is the clock. Two modes:
//   audio-master (preferred): make-narration.mjs wrote one continuous take
//     (<format>-full.mp3) + per-shot timings (<format>-timings.json). Each
//     shot is held for exactly its narration span; the camera fly-to overlaps
//     the shot's opening words instead of sitting in silence; the single track
//     plays straight through. Result: no inter-line gaps — one performance.
//   legacy per-shot: no timings file — extend each shot to fit its own clip
//     plus a breath (the old behavior, kept for back-compat / Edge fallback).
const FLY_SECONDS = 1.6; // camera fly-to, captured as the first slice of a shot
const LEAD_IN = 0.6; // silent beat over the hero before the voiceover starts
const TAIL_PAD = 1.0; // hold after the final word
const frameMs = 1000 / fps;

const audioDir = join(outRoot, 'audio');
const timingsPath = join(audioDir, `${format}-timings.json`);
const fullAudioPath = join(audioDir, `${format}-full.mp3`);
const continuous = existsSync(timingsPath) && existsSync(fullAudioPath);

const audioSeconds = (file) => {
  const r = spawnSync(ffmpeg, ['-i', file, '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(r.stderr ?? '');
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
};

let narr = null; // audio-time { start, end } per shot index
const shotDurations = []; // seconds each shot is on screen
let audioDelay = 0; // when the continuous track starts on the video timeline

if (continuous) {
  narr = JSON.parse(readFileSync(timingsPath, 'utf8'));
  audioDelay = LEAD_IN;
  const lastIdx = shots.length - 1;
  for (let i = 0; i < shots.length; i++) {
    const startV = i === 0 ? 0 : LEAD_IN + (narr[i]?.start ?? narr[i - 1]?.end ?? 0);
    const endV =
      i === lastIdx
        ? LEAD_IN + (narr[i]?.end ?? 0) + TAIL_PAD
        : LEAD_IN + (narr[i + 1]?.start ?? narr[i]?.end ?? 0);
    // floor so a very short beat still fits its fly-to + a moment of hold
    shotDurations[i] = Math.max(FLY_SECONDS + 0.4, endV - startV);
  }
  const total = LEAD_IN + Math.max(...Object.values(narr).map((t) => t.end)) + TAIL_PAD;
  console.log(`pacing: audio-master single-take — ${shots.length} shots, ~${total.toFixed(1)}s`);
} else {
  for (const [si, shot] of shots.entries()) {
    let base = shot.seconds ?? 8;
    const seg = join(audioDir, `${format}-shot-${String(si).padStart(2, '0')}.mp3`);
    if (existsSync(seg)) {
      const need = audioSeconds(seg) + 0.8;
      if (need > base) {
        console.log(`  shot ${si}: extended ${base}s -> ${need.toFixed(1)}s to fit narration`);
        base = need;
      }
    }
    shotDurations[si] = base;
  }
}

const advance = (ms) => page.evaluate((m) => window.__vt.advance(m), ms);

// portrait crops the sides of landscape-framed shots — dolly out to compensate
// (per-shot override: { dolly: 1.5 } in video.js; first shot's is set pre-boot)
const setDolly = (d) => page.evaluate((v) => { window.__hiwCameraScale = v; }, d);

// warm up: run the virtual clock ~2s so entry animations and the first loop
// settle before frame 0
await page.evaluate((n) => window.__hiw.activate(n), shots[0]?.step ?? 0);
for (let i = 0; i < fps * 2; i++) await advance(frameMs);

console.log(`${id} [${format}] ${viewport.width}x${viewport.height}@${fps} — ${shots.length} shots -> ${outRoot}`);

let frame = 0;
let clock = 0; // seconds on the output timeline
const timeline = [];
const t0 = Date.now();

for (const [si, shot] of shots.entries()) {
  const isFirst = si === 0;
  await setDolly(shot.dolly ?? baseDolly);
  await page.evaluate((n) => window.__hiw.activate(n), shot.step);

  // One continuous span per shot. The fly-to (triggered by activate above)
  // plays during the FIRST ~FLY_SECONDS of it — captured as part of the shot,
  // never added on top — so lines butt up against each other with no silent
  // camera-move gap between them.
  const totalFrames = Math.round(shotDurations[si] * fps);
  const start = clock;

  for (let f = 0; f < totalFrames; f++) {
    await advance(frameMs);
    // JPEG q98 (near-lossless) — ~3-4x faster to capture than PNG. At q98 the
    // dark-gradient posterizing is negligible, and the encode-time `gradfun`
    // deband (below) mops up any residual banding, so gradients stay smooth
    // without paying PNG's capture cost.
    await page.screenshot({
      path: join(framesDir, `${String(frame).padStart(5, '0')}.jpg`),
      quality: 98,
    });
    frame++;
    clock += 1 / fps;
  }

  // when this shot's spoken line / caption begins on the video timeline
  const contentStart = continuous
    ? isFirst
      ? audioDelay
      : start
    : start + (isFirst ? 0 : FLY_SECONDS);

  timeline.push({
    shot: si,
    step: shot.step,
    start: Number(start.toFixed(3)),
    contentStart: Number(contentStart.toFixed(3)),
    end: Number(clock.toFixed(3)),
    caption: shot.caption ?? null,
    narration: shot.narration ?? null,
    sfx: shot.sfx ?? null,
  });
  console.log(`  shot ${si + 1}/${shots.length} (step ${shot.step + 1}) — ${frame} frames, ${((Date.now() - t0) / 1000).toFixed(0)}s elapsed`);
}

await browser.close();
writeFileSync(join(outRoot, `${format}-timeline.json`), JSON.stringify(timeline, null, 2));

// --- encode master --------------------------------------------------------
const master = join(outRoot, `${format}-master.mp4`);
const run = (fargs, label) => {
  const r = spawnSync(ffmpeg, ['-y', ...fargs], { stdio: ['ignore', 'ignore', 'pipe'] });
  if (r.status !== 0) {
    console.error(`ffmpeg ${label} failed:\n${r.stderr.toString().slice(-2000)}`);
    process.exit(1);
  }
};
run(
  [
    '-framerate', String(fps),
    '-i', join(framesDir, '%05d.jpg'),
    // gradfun debands smooth gradients by dithering them just before encode —
    // targets the near-flat backdrop, not the whole frame, so no "sandy" grain.
    // crf 16 (from 18) preserves that dither through x264's 8-bit quantization.
    '-vf', 'gradfun=1.2:16',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    master,
  ],
  'encode',
);
console.log(`master: ${master} (${(frame / fps).toFixed(1)}s)`);

// --- captions --------------------------------------------------------------
// ASS burned via libass: auto-wraps, real outline, positioned per format.
// Hook (editorial.hook) overlays the first 3s on shorts.
// Captions are OPT-IN (--captions). Default is a clean, narration-only video:
// burned one-liner captions summarize rather than track the spoken words, so
// they read as out of sync against the voiceover. The hook overlay burns in
// the same pass, so it's opt-in too. (Silent -captioned.mp4 for trending-audio
// posting is still produced when --captions is passed.)
const wantCaptions = args.includes('--captions');
const hasCaptions =
  wantCaptions && (timeline.some((t) => t.caption) || (format === 'short' && editorial?.hook));
let captioned = master;
if (hasCaptions) {
  const short = format === 'short';
  const fontSize = short ? 72 : 54;
  const marginV = short ? Math.round(viewport.height * 0.16) : 60;
  const ts = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = (s % 60).toFixed(2).padStart(5, '0');
    return `${h}:${String(m).padStart(2, '0')}:${sec}`;
  };
  const esc = (t) => t.replace(/\n/g, '\\N');
  const lines = [];
  // shorts: hook on top-third for the first 3 seconds
  if (short && editorial?.hook) {
    lines.push(`Dialogue: 1,${ts(0)},${ts(3)},Hook,,0,0,0,,${esc(editorial.hook)}`);
  }
  for (const t of timeline) {
    if (!t.caption) continue;
    lines.push(`Dialogue: 0,${ts(t.contentStart)},${ts(t.end)},Cap,,0,0,0,,${esc(t.caption)}`);
  }
  const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${viewport.width}
PlayResY: ${viewport.height}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H7F000000,-1,0,0,0,100,100,0,0,1,4,1,2,80,80,${marginV},1
Style: Hook,Arial,${Math.round(fontSize * 1.2)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H7F000000,-1,0,0,0,100,100,0,0,1,5,1,8,80,80,${Math.round(viewport.height * 0.14)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${lines.join('\n')}
`;
  const assName = `${format}-captions.ass`;
  writeFileSync(join(outRoot, assName), ass);
  captioned = join(outRoot, `${format}-captioned.mp4`);
  // run with cwd = outRoot so the subtitles filter gets a plain relative
  // filename (Windows drive-letter paths break libass filter escaping)
  const r = spawnSync(
    ffmpeg,
    [
      '-y', '-i', `${format}-master.mp4`,
      '-vf', `subtitles=${assName}:fontsdir='C\\:/Windows/Fonts'`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      `${format}-captioned.mp4`,
    ],
    { cwd: outRoot, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  if (r.status !== 0) {
    console.error(`caption burn failed (master still usable):\n${r.stderr.toString().slice(-2000)}`);
    captioned = master;
  } else {
    console.log(`captioned: ${captioned}`);
  }
}

// --- audio mix --------------------------------------------------------------
// audio-master mode: one continuous take (<format>-full.mp3) dropped once at
// LEAD_IN — the whole voiceover is a single input, so it plays exactly as it
// was performed. legacy mode: per-shot files (<format>-shot-NN.mp3) delayed to
// each shot's contentStart. sfx cues (assets/sfx/<name>.mp3) layer on either.
// Everything optional — missing files skipped, silent video still ships.
const inputs = [];
const delays = [];
if (continuous) {
  inputs.push(fullAudioPath);
  delays.push(Math.round(audioDelay * 1000));
}
for (const [si, t] of timeline.entries()) {
  if (!continuous) {
    const seg = join(audioDir, `${format}-shot-${String(si).padStart(2, '0')}.mp3`);
    if (existsSync(seg)) {
      inputs.push(seg);
      delays.push(Math.round(t.contentStart * 1000));
    }
  }
  for (const cue of t.sfx ?? []) {
    const f = resolve('assets/sfx', `${cue.file}.mp3`);
    if (existsSync(f)) {
      inputs.push(f);
      delays.push(Math.round((t.contentStart + (cue.at ?? 0)) * 1000));
    }
  }
}
if (inputs.length) {
  const final = join(outRoot, `${format}-final.mp4`);
  const fin = ['-i', captioned];
  for (const f of inputs) fin.push('-i', f);
  const chains = inputs.map(
    (_, i) => `[${i + 1}:a]adelay=${delays[i]}|${delays[i]}[a${i}]`,
  );
  const mix = `${chains.join(';')};${inputs.map((_, i) => `[a${i}]`).join('')}amix=inputs=${inputs.length}:normalize=0[out]`;
  run(
    [
      ...fin,
      '-filter_complex', mix,
      '-map', '0:v', '-map', '[out]',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest',
      final,
    ],
    'audio mix',
  );
  console.log(`final (with audio): ${final}`);
} else {
  console.log('audio: no narration/sfx files found — skipped (run make-narration.mjs first for voiced output)');
}

if (!keepFrames) rmSync(framesDir, { recursive: true, force: true });
console.log('done');
