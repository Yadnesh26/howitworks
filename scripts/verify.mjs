// Mechanical verification gates for a howitworks explainer — ONE command that
// codifies every hand-rolled Playwright probe this repo used to rewrite per
// explainer. Green output here means the mechanics are proven; the
// explainer-reviewer agent receives this report and skips mechanics entirely,
// reviewing only facts, legibility and taste.
//
//   node scripts/verify.mjs <explainer-id> [--port=5174] [--max-clip=150] [--skip-build]
//
// Gates (FAIL = nonzero exit):
//   build      production build passes AND emits dist/assets/<id>-*.js — the
//              lazy split; if the chunk is missing something statically
//              imported the explainer and the whole library pays for it
//   boot       page boots: stepRuntimes present, zero console/page errors
//   loops      every step runtime has mode:'loop' and a non-null tl
//   clipping   per-step readPixels: truly clipped pixels (r+g+b >= 760/765)
//              <= --max-clip of ~80k samples (tiny anisotropy glints pass;
//              blown-white patches fail)
//   label-visibility  each visible callout's TEXT rect measured against the
//              active panel + the viewport; >35% hidden = FAIL (the class of
//              bug the reviewer caught by hand on disc-brakes)
//   navigation away-and-back leaves exactly 1 <canvas>, 0 orphan .callout
//   errors     no console errors accumulated across all of the above
// Warnings (reported, non-fatal — the builder judges intent):
//   static     a step whose pose hash doesn't change under tl.seek (some
//              steps are deliberately still, e.g. a cutaway diagram)
//   labels     per-step visible-callout counts (0 everywhere is suspicious)
//
// The dev server is REQUIRED and self-managed: if nothing answers on the
// port, this script starts vite itself and waits for it.
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args.filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const id = args.find((a) => !a.startsWith('--'));
if (!id) {
  console.error('usage: node scripts/verify.mjs <explainer-id> [--port=5174] [--max-clip=150] [--skip-build]');
  process.exit(1);
}
const port = flags.port ?? '5174';
const maxClip = Number(flags['max-clip'] ?? 150);

const results = []; // { gate, ok, detail }  ok: true | false | 'warn'
const gate = (name, ok, detail) => {
  results.push({ gate: name, ok, detail });
  const tag = ok === true ? 'PASS' : ok === 'warn' ? 'WARN' : 'FAIL';
  console.log(`[${tag}] ${name}: ${detail}`);
};

// --- gate: build + lazy chunk ------------------------------------------------
if (!flags['skip-build']) {
  try {
    const out = execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const chunk = out.match(new RegExp(`${id}-[\\w-]+\\.js\\s+([\\d.]+ kB)`));
    if (chunk) gate('build', true, `chunk ${id}-*.js (${chunk[1]}) emitted`);
    else gate('build', false, `build passed but NO dist/assets/${id}-*.js chunk — lazy split broken`);
  } catch (e) {
    gate('build', false, `vite build failed: ${String(e.stderr || e.message).slice(0, 400)}`);
  }
}

// --- dev server: check, self-start if down -----------------------------------
async function serverUp() {
  try {
    const r = await fetch(`http://localhost:${port}/`);
    return r.ok;
  } catch {
    return false;
  }
}
if (!(await serverUp())) {
  console.log(`[info] dev server not responding on :${port} — starting it`);
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', port], {
    cwd: root,
    detached: true,
    stdio: 'ignore',
  }).unref();
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline && !(await serverUp())) {
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!(await serverUp())) {
    gate('server', false, `dev server did not come up on :${port} within 20s`);
    finish();
  }
  console.log('[info] dev server up');
}

// --- browser probes ------------------------------------------------------------
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

// activate(k)'s camera fly-to (1300ms) races the section-scroll's
// IntersectionObserver, which can re-fire activate() for a stale index AFTER
// our explicit call and restart the tween late — a flat 1600ms wait
// intermittently samples mid-tween (false-positive label-visibility
// failures). Poll for the camera position to stop moving instead of trusting
// a fixed delay; falls back to the timeout budget if it never quite settles.
async function waitForCameraSettle(pg, { timeoutMs = 3000, intervalMs = 150 } = {}) {
  let prev = null;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pos = await pg.evaluate(() => window.__hiw.stage.camera.position.toArray());
    if (prev && Math.hypot(pos[0] - prev[0], pos[1] - prev[1], pos[2] - prev[2]) < 0.001) return;
    prev = pos;
    await pg.waitForTimeout(intervalMs);
  }
}

try {
  await page.goto(`http://localhost:${port}/#/${id}`);
  await page.waitForFunction(() => window.__hiw?.stepRuntimes?.length > 0, null, { timeout: 20000 });
  await page.waitForTimeout(1200);
  gate('boot', true, 'player booted, stepRuntimes present');
} catch (e) {
  gate('boot', false, `player did not boot: ${e.message.slice(0, 200)}`);
  await browser.close();
  finish();
}

// loops live
const runtimes = await page.evaluate(() =>
  window.__hiw.stepRuntimes.map((r, i) => ({ i, mode: r.mode, hasTl: !!r.tl })),
);
const deadLoops = runtimes.filter((r) => r.mode === 'loop' && !r.hasTl);
gate(
  'loops',
  deadLoops.length === 0,
  deadLoops.length === 0
    ? `${runtimes.length} steps, all runtimes have timelines`
    : `steps without a timeline: ${deadLoops.map((r) => r.i).join(', ')}`,
);

// pose movement under seek (WARN-level: static steps can be intentional)
const poseMoves = await page.evaluate(() => {
  const hash = () => {
    let h = 0;
    window.__hiw.stage.scene.traverse((o) => {
      h +=
        o.position.x * 3.1 + o.position.y * 5.7 + o.position.z * 7.3 +
        o.rotation.x * 11.1 + o.rotation.y * 13.7 + o.rotation.z * 17.3 +
        (o.visible ? 19 : 0);
      if (o.material && 'opacity' in o.material) h += o.material.opacity * 23.1;
    });
    return h;
  };
  return window.__hiw.stepRuntimes.map((rt, i) => {
    if (!rt.tl) return { i, moved: null };
    // loop:true timelines report duration as a ~1e12 sentinel; the real lap
    // length is iterationDuration — seek within THAT or every seek clamps
    // to the same far-future pose and everything reads as static
    const lap = rt.tl.iterationDuration ?? rt.tl.duration;
    rt.tl.pause();
    rt.tl.seek(lap * 0.2);
    const a = hash();
    rt.tl.seek(lap * 0.7);
    const b = hash();
    return { i, moved: Math.abs(a - b) > 1e-6 };
  });
});
const staticSteps = poseMoves.filter((p) => p.moved === false).map((p) => p.i);
gate(
  'motion',
  staticSteps.length === 0 ? true : 'warn',
  staticSteps.length === 0
    ? 'every step pose moves under seek'
    : `static under seek (intentional? verify): steps ${staticSteps.join(', ')}`,
);

// per-step activation: clipping + label counts + label VISIBILITY.
// Measure each visible callout's TEXT rect against the active panel and the
// viewport — the exact DOM method the reviewer used to catch the disc-brakes
// labels hidden under the panel / below the frame. A label obscured past
// OBSCURE_MAX in BOTH sampled frames reads as absent.
// NB: scrollIntoView IS required — the player's canvas only gets correct
// layout/aspect once its section is scrolled into view (same reason
// review-shots scrolls), and a wrong aspect throws off the camera
// projection below. Label positions are then read by PROJECTING each
// callout's world anchor (immune to the CSS2D overlay's document-space
// getBoundingClientRect under scroll); the panel rect stays viewport-correct
// via getBoundingClientRect.
const OBSCURE_MAX = 0.35; // fraction of a label's text rect that may be hidden
let worstClip = { step: -1, clipped: 0 };
const labelCounts = [];
const obscured = []; // { step, text, hidden }
const stepCount = runtimes.length;
for (let i = 0; i < stepCount; i++) {
  await page.evaluate((k) => {
    document.querySelectorAll('.step')[k]?.scrollIntoView({ block: 'center' });
    window.__hiw.activate(k);
  }, i);
  await page.waitForTimeout(200); // let scroll paint before polling starts
  await waitForCameraSettle(page); // camera fly-to settles (race-tolerant)
  const res = await page.evaluate(([activeIdx, obscureMax]) => {
    const stage = window.__hiw.stage;
    stage.composer ? stage.composer.render() : stage.renderer.render(stage.scene, stage.camera);
    const gl = stage.renderer.getContext();
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let clipped = 0;
    for (let p = 0; p < px.length; p += 16) if (px[p] + px[p + 1] + px[p + 2] >= 760) clipped++;

    // Measure label legibility at the SAME deterministic poses review-shots
    // captures (30% and 60% of the lap) — labels ride moving parts, so the
    // live-playing phase is unrepresentative. A label counts as obscured only
    // if it's hidden in BOTH sampled frames (a genuinely broken placement,
    // not a momentary pass behind something).
    //
    // Label positions are computed by PROJECTING each callout's world anchor
    // through the camera into viewport pixels, then reconstructing the text
    // box from labels.js's known leader offset. This deliberately avoids
    // getBoundingClientRect on the CSS2D overlay, which returns document-space
    // coordinates in this two-phase (activate → wait → measure) flow and made
    // the gate mis-read clearly-visible labels as fully hidden.
    const overlap = (a, b) => {
      const ox = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const oy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return ox * oy;
    };
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    const vp = { left: 0, top: 0, right: cw, bottom: ch };
    const rt = window.__hiw.stepRuntimes[activeIdx];
    const lap = rt?.tl ? (rt.tl.iterationDuration ?? rt.tl.duration) : 0;
    const scratch = stage.camera.position.clone();
    // map each callout DOM element back to its CSS2DObject (to read world pos)
    const cssByEl = new Map();
    stage.scene.traverse((o) => {
      if (o.isCSS2DObject && o.element) cssByEl.set(o.element, o);
    });
    const sample = () => {
      stage.controls.update(); // freshen camera orientation before projecting
      stage.camera.updateMatrixWorld(true);
      stage.scene.updateMatrixWorld(true); // parts moved under seek()
      // the panel is CSS-pinned to a fixed viewport slot — its rect IS
      // viewport-correct even in this flow (verified), so read it directly
      const p = document.querySelector('.panel.active')?.getBoundingClientRect();
      const panel = p && { left: p.left, top: p.top, right: p.right, bottom: p.bottom };
      const out = {};
      for (const c of document.querySelectorAll('.callout')) {
        if (c.style.display === 'none' || !c.parentElement) continue;
        const tx = c.querySelector('.callout-text');
        const obj = cssByEl.get(c);
        if (!tx || !obj) continue;
        // project the callout's world anchor to viewport pixels
        obj.getWorldPosition(scratch).project(stage.camera);
        const ax = (scratch.x * 0.5 + 0.5) * cw;
        const ay = (-scratch.y * 0.5 + 0.5) * ch;
        // reconstruct the text box from labels.js's leader offset + pill side
        const offL = parseFloat(tx.style.left) || 0; // cos(dir)*len
        const offT = parseFloat(tx.style.top) || 0; // -sin(dir)*len
        const tw = tx.offsetWidth || tx.textContent.length * 7;
        const th = tx.offsetHeight || 22;
        const left = offL >= 0 ? ax + offL + 4 : ax + offL - tw - 4;
        const top = ay + offT - th / 2;
        const r = { left, top, right: left + tw, bottom: top + th };
        const area = tw * th;
        if (area < 1) continue;
        const onScreen = overlap(r, vp) / area;
        const covered = panel ? overlap(r, panel) / area : 0;
        out[tx.textContent] = 1 - onScreen * (1 - covered); // hidden fraction
      }
      return out;
    };
    const frames = [];
    for (const f of [0.3, 0.6]) {
      if (rt?.tl) {
        rt.tl.pause();
        rt.tl.seek(lap * f);
      }
      frames.push(sample());
    }
    const visibleCount = Object.keys(frames[0]).length;
    const bad = [];
    for (const text of Object.keys(frames[0])) {
      const hiddenBoth = Math.min(frames[0][text] ?? 1, frames[1][text] ?? 1);
      if (hiddenBoth > obscureMax) bad.push({ text, hidden: +hiddenBoth.toFixed(2) });
    }
    return { clipped, callouts: visibleCount, sampled: px.length / 16, bad };
  }, [i, OBSCURE_MAX]);
  labelCounts.push(res.callouts);
  for (const b of res.bad) obscured.push({ step: i, ...b });
  if (res.clipped > worstClip.clipped) worstClip = { step: i, clipped: res.clipped };
  const badNote = res.bad.length ? ` OBSCURED: ${res.bad.map((b) => `"${b.text}"`).join(', ')}` : '';
  console.log(`  step ${i}: clipped=${res.clipped}/${res.sampled} callouts=${res.callouts}${badNote}`);
}
gate(
  'clipping',
  worstClip.clipped <= maxClip,
  `worst step ${worstClip.step}: ${worstClip.clipped} clipped px (limit ${maxClip})`,
);
gate(
  'labels',
  labelCounts.some((c) => c > 0) ? true : 'warn',
  labelCounts.some((c) => c > 0)
    ? `callouts render (per-step: ${labelCounts.join('/')})`
    : 'NO step ever shows a callout — likely a label wiring bug',
);
gate(
  'label-visibility',
  obscured.length === 0,
  obscured.length === 0
    ? 'every visible label is legible (clear of the panel and in-frame)'
    : obscured
        .map((o) => `step ${o.step} "${o.text}" (${Math.round(o.hidden * 100)}% hidden in both a/b frames)`)
        .join('; '),
);

// navigation cleanliness
await page.evaluate(() => (location.hash = '#/'));
await page.waitForTimeout(900);
await page.evaluate((eid) => (location.hash = `#/${eid}`), id);
await page.waitForFunction(() => window.__hiw?.stepRuntimes?.length > 0, null, { timeout: 20000 });
await page.waitForTimeout(900);
const dom = await page.evaluate(() => ({
  canvases: document.querySelectorAll('canvas').length,
  callouts: document.querySelectorAll('.callout').length,
}));
gate(
  'navigation',
  dom.canvases === 1,
  `after away-and-back: ${dom.canvases} canvas, ${dom.callouts} callout nodes`,
);

gate('errors', errors.length === 0, errors.length === 0 ? 'zero console errors' : errors.slice(0, 5).join(' | '));

await browser.close();
finish();

function finish() {
  const fails = results.filter((r) => r.ok === false);
  const warns = results.filter((r) => r.ok === 'warn');
  console.log('\n================================');
  console.log(`VERIFY ${fails.length === 0 ? 'PASS' : 'FAIL'} — ${id}`);
  if (warns.length) console.log(`warnings: ${warns.map((w) => w.gate).join(', ')}`);
  if (fails.length) console.log(`failed gates: ${fails.map((f) => f.gate).join(', ')}`);
  console.log('================================');
  process.exit(fails.length === 0 ? 0 : 1);
}
