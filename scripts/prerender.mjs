// Post-build static-shell generator — runs after `vite build`.
//
//   node scripts/prerender.mjs
//
// Turns the single dist/index.html the SPA build produces into one real
// static document per explainer and per category: dist/<id>/index.html with
// a genuine <title>, meta description, canonical, OG tags, and every step
// heading/body as literal text in the markup — so a crawler that never runs
// JavaScript still sees the whole page, and one that does gets the exact
// same content the client-side mount produces a moment later. Also emits
// dist/sitemap.xml (with inline <image:image> entries for the plates).
//
// Step heading/body/hint text is read by regex straight off each
// explainer's index.js SOURCE FILE, never by importing it. Importing would
// pull in framework/registry.js's import.meta.glob, which is a Vite-only
// construct that throws under plain Node — and CLAUDE.md rule 2 warns that
// statically importing an explainer from shared code kills the per-explainer
// lazy chunk split. Reading source text as a string touches nothing Vite
// has to bundle, so the split this script's own output depends on (each
// explainer's real page still boots its own lazy chunk) can't regress.
//
// meta.js and categories.js ARE safe to import directly: both are plain
// data modules with no Vite-only syntax.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SITE = 'https://www.whatdstuff.com';
const DIST = resolve('dist');
const EXPLAINERS_DIR = resolve('src/explainers');

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/index.html not found — run `vite build` before prerender.mjs');
  process.exit(1);
}

const shellHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
// Pull the built <script>/<link> tags (hashed asset URLs) straight out of
// the shell Vite just produced, so every prerendered page boots the exact
// same bundle without this script having to know the hash itself.
const headAssets = [...shellHtml.matchAll(/<(?:script|link)[^>]*>(?:<\/script>)?/g)]
  .map((m) => m[0])
  .filter((tag) => tag.includes('/assets/'))
  .join('\n    ');
if (!headAssets) throw new Error('no /assets/ script or link tags found in dist/index.html');

const esc = (s = '') =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function lastmod(relPath) {
  try {
    const out = execSync(`git log -1 --format=%cI -- "${relPath}"`, { encoding: 'utf8' }).trim();
    if (out) return out;
  } catch {
    /* not tracked yet, or not a git checkout — fall through */
  }
  return new Date().toISOString();
}

function metaDescription(meta) {
  let d = (meta.summary ?? '').trim();
  if (meta.spec && `${d} — ${meta.spec}`.length <= 160) d = `${d} — ${meta.spec}`;
  return d.length > 160 ? `${d.slice(0, 157).trimEnd()}…` : d;
}

// --- step copy, read from source text, never imported ---------------------
// One step object per `heading:` match; any `body:`/`hint:` string that
// follows before the next `heading:` belongs to that step — true for every
// explainer today because the defineExplainer API always writes heading
// first (see README's authoring example). A step written any other way
// still fails loudly below rather than silently shipping wrong copy.
function readSteps(id) {
  const src = readFileSync(join(EXPLAINERS_DIR, id, 'index.js'), 'utf8');
  const re = /\b(heading|body|hint)\s*:\s*(['"`])((?:\\.|(?!\2)[\s\S])*)\2/g;
  const steps = [];
  let cur = null;
  for (const m of src.matchAll(re)) {
    const [, key, , raw] = m;
    if (raw.includes('${')) {
      throw new Error(
        `${id}/index.js: step ${key} uses template interpolation ("\${…}") — ` +
          `prerender.mjs reads step text statically and can't resolve it. ` +
          `Rewrite as a plain string, or teach readSteps() about this case.`,
      );
    }
    const text = raw
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\`/g, '`')
      .replace(/\\n/g, ' ')
      .trim();
    if (key === 'heading') {
      cur = { heading: text, body: '', hint: '' };
      steps.push(cur);
      continue;
    }
    if (cur) cur[key] = text;
  }
  if (!steps.length) throw new Error(`${id}/index.js: no steps found — readSteps() regex may be stale`);
  return steps;
}

// --- registry, read without importing anything Vite-only ------------------
const explainerIds = readdirSync(EXPLAINERS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(EXPLAINERS_DIR, d.name, 'meta.js')))
  .map((d) => d.name)
  .sort();

const metas = [];
for (const id of explainerIds) {
  const mod = await import(pathToFileURL(join(EXPLAINERS_DIR, id, 'meta.js')).href);
  metas.push(mod.default);
}
metas.sort((a, b) => a.title.localeCompare(b.title));

const { categories, itemsIn } = await import(pathToFileURL(resolve('src/categories.js')).href);

// --- page shell -------------------------------------------------------------
function page({ title, description, canonical, ogType = 'article', body }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:site_name" content="whatDstuff" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta name="twitter:card" content="summary" />
    ${headAssets}
  </head>
  <body>
    <div id="app">${body}</div>
  </body>
</html>
`;
}

function explainerBody(meta) {
  const categoryId = meta.categories?.[0];
  const category = categoryId ? categories[categoryId] : null;
  const breadcrumb = `
    <nav aria-label="Breadcrumb">
      <a href="/">whatDstuff</a>
      ${category ? ` › <a href="/${categoryId}">${esc(category.title)}</a>` : ''}
      › <span>${esc(meta.title)}</span>
    </nav>`;

  const steps = readSteps(meta.id);
  // Index badge stays a separate element from the heading text — some step
  // headings already carry their own number ("1 · Suck"), and concatenating
  // a second one ("02 · 1 · Suck") double-counts. Mirrors the live player's
  // own markup (framework/player.js: .panel-num sits beside <h2>, never
  // inside it), so the prerendered and hydrated DOM read the same way.
  const stepsHtml = steps
    .map(
      (s, i) => `
      <section>
        <p><span>Step ${String(i + 1).padStart(2, '0')} of ${String(steps.length).padStart(2, '0')}</span></p>
        <h2>${esc(s.heading)}</h2>
        <p>${esc(s.body)}</p>
      </section>`,
    )
    .join('');

  return `
    <article>
      ${breadcrumb}
      <header>
        <h1>${esc(meta.title)}</h1>
        <p>${esc(meta.summary ?? '')}</p>
        <img src="/plates/${meta.id}.jpg" alt="${esc(meta.title)} — interactive 3D cutaway" width="720" height="450" loading="eager" />
      </header>
      ${stepsHtml}
    </article>`;
}

function categoryBody(catId) {
  const cat = categories[catId];
  const items = itemsIn(catId, metas);
  const list = items
    .map((e) => `<li><a href="/${e.id}">${esc(e.title)}</a> — ${esc(e.summary ?? '')}</li>`)
    .join('');
  return `
    <article>
      <nav aria-label="Breadcrumb"><a href="/">whatDstuff</a> › <span>${esc(cat.title)}</span></nav>
      <header>
        <h1>${esc(cat.title)}</h1>
        <p>${esc(cat.blurb ?? '')}</p>
      </header>
      <ul>${list}</ul>
    </article>`;
}

// --- write explainer pages --------------------------------------------------
mkdirSync(DIST, { recursive: true });
const sitemapUrls = [];

for (const meta of metas) {
  const canonical = `${SITE}/${meta.id}`;
  const title = `${meta.title} — Interactive 3D | whatDstuff`;
  const outDir = join(DIST, meta.id);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'index.html'),
    page({
      title,
      description: metaDescription(meta),
      canonical,
      body: explainerBody(meta),
    }),
  );
  const plateRel = `public/plates/${meta.id}.jpg`;
  sitemapUrls.push({
    loc: canonical,
    lastmod: lastmod(`src/explainers/${meta.id}`),
    image: existsSync(resolve(plateRel)) ? `${SITE}/plates/${meta.id}.jpg` : null,
  });
}

// --- write category pages ---------------------------------------------------
for (const [catId, cat] of Object.entries(categories)) {
  const outDir = join(DIST, catId);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'index.html'),
    page({
      title: `${cat.title} — whatDstuff`,
      description: cat.blurb ?? `${cat.title} — interactive 3D explainers.`,
      canonical: `${SITE}/${catId}`,
      ogType: 'website',
      body: categoryBody(catId),
    }),
  );
  sitemapUrls.push({ loc: `${SITE}/${catId}`, lastmod: lastmod('src/categories.js'), image: null });
}

// home page's own lastmod, from the source shell rather than the built one
sitemapUrls.unshift({ loc: `${SITE}/`, lastmod: lastmod('index.html'), image: null });

// --- sitemap.xml, with inline image entries for the plates ------------------
const IMAGE_NS = 'http://www.google.com/schemas/sitemap-image/1.1';
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="${IMAGE_NS}">
${sitemapUrls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>${
      u.image ? `\n    <image:image><image:loc>${u.image}</image:loc></image:image>` : ''
    }
  </url>`,
  )
  .join('\n')}
</urlset>
`;
writeFileSync(join(DIST, 'sitemap.xml'), sitemapXml);

console.log(`prerendered ${metas.length} explainer pages + ${Object.keys(categories).length} category pages`);
console.log(`wrote dist/sitemap.xml (${sitemapUrls.length} urls)`);
