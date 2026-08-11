// Generate the library's cover plates — one clean render per explainer, used
// by the home page grid.
//
//   node scripts/make-plates.mjs [--port=5174] [--only=jet-engine,gps] [--step=1]
//
// The home page is a storefront for a real-time 3D library, so the cards show
// the actual machines rather than type. These are captured the same
// deterministic way review-shots.mjs and make-thumbnails.mjs capture anything:
// activate the step, wait for the camera fly-to to settle, then pause the loop
// and seek it to a fixed lap fraction. Same command, same pixels.
//
// Output: public/plates/<id>.jpg (referenced as /plates/<id>.jpg, lazy-loaded)
// Re-run after adding an explainer, or after any visual change to an existing
// one — the plate is the only part of the library that goes stale on its own.
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (name, dflt) =>
  (args.find((a) => a.startsWith(`--${name}=`)) ?? '').split('=')[1] ?? dflt;

const PORT = flag('port', '5174');
const ONLY = flag('only', '');
const STEP = Number(flag('step', '1')) - 1; // hero step: the finished product shot
const FRAC = Number(flag('frac', '0.45'));
const OUT = 'public/plates';

mkdirSync(OUT, { recursive: true });

const ids = readdirSync('src/explainers', { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join('src/explainers', d.name, 'meta.js')))
  .map((d) => d.name)
  .filter((id) => !ONLY || ONLY.split(',').includes(id));

if (!ids.length) {
  console.error('no explainers matched');
  process.exit(1);
}

const browser = await chromium.launch({
  args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-webgl'],
});

// same settle poll as review-shots: activate()'s fly-to races the section
// IntersectionObserver, so wait for the camera to actually stop moving
async function waitForCameraSettle(pg, { timeoutMs = 4000, intervalMs = 140 } = {}) {
  let prev = null;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pos = await pg.evaluate(() => window.__hiw.stage.camera.position.toArray());
    if (prev && Math.hypot(pos[0] - prev[0], pos[1] - prev[1], pos[2] - prev[2]) < 0.001) return;
    prev = pos;
    await pg.waitForTimeout(intervalMs);
  }
}

const failed = [];
for (const id of ids) {
  // A fresh page per explainer: replaying a pause+seek()ed looped timeline
  // wedges the anime engine (see review-shots.mjs), so these pages are
  // single-use by design.
  const page = await browser.newPage({
    viewport: { width: 480, height: 300 },
    deviceScaleFactor: 1.5,
  });
  try {
    await page.goto(`http://localhost:${PORT}/#/${id}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__hiw?.stepRuntimes?.length > 0, null, {
      timeout: 60000,
    });
    await page.waitForTimeout(1600); // studio env map + lazy chunk

    // clean plate: no page chrome, no CSS2D callouts
    await page.addStyleTag({
      content: `.player-hero,.steps,.rail,.back-link,.scroll-hint,.callout{display:none!important}
                body{overflow:hidden}`,
    });

    const ok = await page.evaluate((k) => {
      const step = document.querySelectorAll('.step')[k];
      if (!step) return false;
      step.scrollIntoView({ block: 'center' }); // rule 9: layout before render
      window.__hiw.activate(k);
      return true;
    }, STEP);
    if (!ok) throw new Error(`step ${STEP + 1} out of range`);

    await page.waitForTimeout(200);
    await waitForCameraSettle(page);

    await page.evaluate(
      ([k, f]) => {
        const rt = window.__hiw.stepRuntimes[k];
        if (rt?.tl) {
          // loop:true timelines report a ~1e12 duration sentinel;
          // iterationDuration is the real lap
          const lap = rt.tl.iterationDuration ?? rt.tl.duration;
          rt.tl.pause();
          rt.tl.seek(lap * f);
        }
      },
      [STEP, FRAC],
    );
    await page.waitForTimeout(160);

    await page.screenshot({ path: join(OUT, `${id}.jpg`), quality: 62, type: 'jpeg' });
    console.log(`ok   ${id}`);
  } catch (e) {
    failed.push(id);
    console.error(`FAIL ${id}: ${e.message.split('\n')[0]}`);
  }
  await page.close();
}

await browser.close();
console.log(
  `\n${ids.length - failed.length}/${ids.length} plates in ${OUT}` +
    (failed.length ? ` — failed: ${failed.join(', ')}` : ''),
);
if (failed.length) process.exit(1);
