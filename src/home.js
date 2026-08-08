import { getMetas } from './framework/index.js';
import { categories, childrenOf, itemsIn, topLevel } from './categories.js';
import { mountHeroMachine } from './home-hero.js';

// The library. Two modes:
//   mountHome(app)          — full library: hero mechanism + every category
//   mountHome(app, catId)   — one category: its child folders and explainers
//
// The product is a real-time 3D library, so the storefront shows the machines:
// every card carries a plate rendered from that explainer's own opening step
// (see scripts/make-plates.mjs), and the hero runs a live gear train.

// --- social dock ----------------------------------------------------------
// Logo-only links; the name only surfaces on hover, and each carries its own
// brand colour so the hover state matches the platform without the resting
// state turning into a colour circus.
const SOCIALS = [
  {
    id: 'youtube',
    label: 'YouTube',
    href: 'https://www.youtube.com/@WhatDStuff/shorts',
    brand: '#ff0033',
    path: 'M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    href: 'https://www.instagram.com/whatdstuff/',
    brand: '#e1306c',
    path: 'M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.13 1.38A5.9 5.9 0 0 0 .63 4.14c-.3.76-.5 1.64-.56 2.91C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.72 1.46 1.38 2.13a5.9 5.9 0 0 0 2.13 1.38c.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.9 5.9 0 0 0 2.13-1.38 5.9 5.9 0 0 0 1.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.9 5.9 0 0 0-1.38-2.13A5.9 5.9 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0z M12 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8z M18.41 4.15a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    href: 'https://www.facebook.com/whatdstuff/reels/',
    brand: '#1877f2',
    path: 'M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07z',
  },
];

const esc = (s = '') =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Titles read "How a Jet Engine Works" for SEO; the card wants the noun.
// Also handles "What Is a Black Hole?" — subjects that aren't machines get
// that framing instead, and the card still wants the bare noun.
const shortTitle = (t) =>
  t
    .replace(/^(?:How|What)\s+(?:is\s+|are\s+)?(?:a\s+|an\s+|the\s+)?/i, '')
    .replace(/\s*works?$/i, '')
    .replace(/\?$/, '');

function socialDock() {
  return SOCIALS.map(
    (s) =>
      `<a class="social-ic" href="${s.href}" target="_blank" rel="noopener noreferrer"
          aria-label="${s.label}" style="--brand:${s.brand}">
         <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${s.path}" /></svg>
       </a>`,
  ).join('');
}

// --- cards ----------------------------------------------------------------
// A machined plate: the render on top, a label strip milled into the bottom
// carrying the stamped index number, the name and the one-line teardown.
function card(e, n) {
  return `
    <a class="ex-card" href="#/${e.id}">
      <img class="ex-shot" src="/plates/${e.id}.jpg" alt="" loading="lazy" decoding="async"
           width="720" height="450" />
      <span class="ex-plate">
        <span class="ex-no">${String(n).padStart(2, '0')}</span>
        <span class="ex-name">${esc(shortTitle(e.title))}</span>
        <span class="ex-go" aria-hidden="true">&#8599;</span>
        <span class="ex-spec">${esc(e.spec ?? e.summary ?? '')}</span>
      </span>
    </a>`;
}

function folderCard(c, count) {
  return `
    <a class="ex-card ex-folder" href="#/${c.id}" style="--dye:${c.accent ?? '#93a7b3'}">
      <span class="ex-plate">
        <span class="ex-name">${esc(c.title)}</span>
        <span class="ex-go" aria-hidden="true">&#8599;</span>
        <span class="ex-spec">${esc(c.blurb ?? '')} — ${count} machine${count === 1 ? '' : 's'}</span>
      </span>
    </a>`;
}

// --- credits: the gear pair -----------------------------------------------
// Two meshed gears, one name engraved under each. The metaphor carries the
// credit, so there is no "made by" anywhere — scroll drives them in opposite
// directions and neither can turn without the other.
const CREATORS = [
  { name: 'Yadnesh', href: 'https://github.com/Yadnesh26', tint: '#a8b2bb' },
  { name: 'Swapnil', href: 'https://github.com/swapnilskumbhar', tint: '#c4a44f' },
];

// Tooth COUNT is what makes this read as a gear rather than a spiked ball:
// tooth height is set by the module (2·R_PITCH / TEETH), so few teeth means
// long spikes. 18 teeth on this radius gives short, stocky teeth in a proper
// ring, which is what the eye expects from a gear.
const TEETH = 18;
const MODULE = 4.889; // 2 · R_PITCH / TEETH
const R_PITCH = 44;
const R_TIP = R_PITCH + MODULE; // addendum = 1 module
const R_ROOT = R_PITCH - MODULE * 1.25; // dedendum = 1.25 module
const R_RIM = 33; // rim band, where the web starts
const R_WEB = 22; // lightening-hole ring
const R_HUB = 12.5;
const R_BORE = 7;
const CY = 54;
const VB_W = R_PITCH * 4;
const CX_A = R_PITCH;
const CX_B = R_PITCH * 3;
const VB_PAD = 6;

// full circle as two arcs — a counter-subpath the evenodd fill punches out
const ring = (cx, cy, r) =>
  ` M ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} Z`;

// One tooth = root → rising flank → tip land → falling flank → root, then an
// arc along the root circle to the next tooth. Half-tooth `phase` is what lets
// the second gear's teeth fall into the first one's gaps.
function gearPath(cx, cy, phase = 0) {
  const step = (Math.PI * 2) / TEETH;
  const pt = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  let d = '';
  let first = '';
  for (let i = 0; i < TEETH; i++) {
    const c = phase + i * step;
    const start = pt(R_ROOT, c - step * 0.27);
    if (i === 0) {
      first = start;
      d += `M ${start}`;
    } else {
      d += ` A ${R_ROOT} ${R_ROOT} 0 0 1 ${start}`;
    }
    d += ` L ${pt(R_PITCH, c - step * 0.215)} L ${pt(R_TIP, c - step * 0.15)}`;
    d += ` L ${pt(R_TIP, c + step * 0.15)} L ${pt(R_PITCH, c + step * 0.215)}`;
    d += ` L ${pt(R_ROOT, c + step * 0.27)}`;
  }
  d += ` A ${R_ROOT} ${R_ROOT} 0 0 1 ${first} Z`;
  d += ring(cx, cy, R_BORE);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 5;
    d += ring(cx + Math.cos(a) * R_WEB, cy + Math.sin(a) * R_WEB, 5.2);
  }
  return d;
}

function gearPair() {
  // Highlight biased to the top-left with fx/fy rather than by moving the
  // gradient's centre: the falloff then still reaches zero exactly at the
  // circle's edge, so there is no hard rim where the fill cuts off.
  const sheen = (k, cx) => `
    <radialGradient id="gearSheen${k}" gradientUnits="userSpaceOnUse"
                    cx="${cx}" cy="${CY}" r="${R_ROOT}" fx="${cx - 15}" fy="${CY - 15}">
      <stop offset="0" stop-color="#fff" stop-opacity="0.18" />
      <stop offset="0.6" stop-color="#fff" stop-opacity="0.05" />
      <stop offset="1" stop-color="#fff" stop-opacity="0" />
    </radialGradient>`;

  // Only the toothed body rotates. The sheen sits OUTSIDE that group and stays
  // put, so the highlight holds still while the part turns under it — which is
  // how you read rotation on a real machined face.
  const gear = (p, k, cx, phase) => `
    <a href="${p.href}" target="_blank" rel="noopener noreferrer"
       data-gear="${k}" tabindex="-1" aria-hidden="true">
      <g class="gear gear-${k}" style="--tint:${p.tint}">
        <g class="gear-spin" transform="rotate(0 ${cx} ${CY})">
          <path class="gear-body" fill-rule="evenodd" d="${gearPath(cx, CY, phase)}" />
          <circle class="gear-rim" cx="${cx}" cy="${CY}" r="${R_RIM}" />
          <circle class="gear-hub" cx="${cx}" cy="${CY}" r="${R_HUB}" />
        </g>
        <circle class="gear-sheen" cx="${cx}" cy="${CY}" r="${R_ROOT}" fill="url(#gearSheen${k})" />
      </g>
    </a>`;

  const name = (c, k) => `
    <a class="gear-name" data-gear="${k}" style="--tint:${c.tint}"
       href="${c.href}" target="_blank" rel="noopener noreferrer">${c.name}</a>`;

  return `
    <div class="gearbox">
      <svg class="gear-svg" viewBox="${-VB_PAD} ${-VB_PAD} ${VB_W + VB_PAD * 2} ${108 + VB_PAD * 2}"
           aria-hidden="true" focusable="false">
        <defs>${sheen('a', CX_A)}${sheen('b', CX_B)}</defs>
        ${gear(CREATORS[0], 'a', CX_A, 0)}
        ${gear(CREATORS[1], 'b', CX_B, Math.PI / TEETH)}
      </svg>
      <div class="gear-names">${name(CREATORS[0], 'a')}${name(CREATORS[1], 'b')}</div>
      <p class="gear-caption">two curious minds</p>
    </div>`;
}

// --- procedural surfaces --------------------------------------------------
// Ports of textures.js brushedMap() / castMap(): the UI wears the same grain
// the 3D parts do, generated rather than shipped as image assets.
//
// Drawn one scanline at a time rather than as scattered strokes: random
// placement clumps, and a clumped tile shows its own repeat as blocks.
//
// The value RANDOM-WALKS down the tile instead of being redrawn per row. Given
// independent values, neighbouring rows land far apart and each 1px line reads
// as a hard rule — which on something as short as a card label strip looks like
// broken scanlines rather than metal. Drifting keeps adjacent rows close, so
// the grain groups into the long soft streaks a brushing wheel actually leaves.
function brushedDataURL() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  let v = 205; // luminance, drifting
  let a = 0.1; // alpha, drifting
  for (let y = 0; y < S; y++) {
    v = Math.max(170, Math.min(250, v + (Math.random() - 0.5) * 16));
    a = Math.max(0.04, Math.min(0.16, a + (Math.random() - 0.5) * 0.05));
    x.strokeStyle = `rgba(${Math.round(v)},${Math.round(v)},${Math.round(v)},${a})`;
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(0, y + 0.5);
    x.lineTo(S, y + 0.5);
    x.stroke();
  }
  return c.toDataURL();
}

// Per-pixel film grain. Its one job is dithering the hero scrim's near-black
// gradient, which is where 8-bit banding shows — so it is scoped to the hero.
function grainDataURL() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const img = x.createImageData(S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 256);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c.toDataURL();
}

let texturesReady = false;
function ensureTextures() {
  if (texturesReady) return;
  const root = document.documentElement.style;
  root.setProperty('--tex-brushed', `url(${brushedDataURL()})`);
  root.setProperty('--tex-grain', `url(${grainDataURL()})`);
  texturesReady = true;
}

// --------------------------------------------------------------------------
export function mountHome(container, catId = null) {
  ensureTextures();
  const metas = getMetas();
  const cat = catId ? categories[catId] : null;
  let plateNo = 0; // stamped in display order, so each rack reads 01, 02, 03…

  // Sections. A machine can belong to several categories but is listed once,
  // under the first that claims it — same rule the category pages use.
  let sectionsHtml = '';
  if (cat) {
    const kids = childrenOf(catId).map((c) => folderCard(c, itemsIn(c.id, metas).length));
    const items = itemsIn(catId, metas).map((m) => card(m, ++plateNo));
    sectionsHtml = `<div class="ex-grid">${[...kids, ...items].join('')}</div>`;
  } else {
    const claimed = new Set();
    sectionsHtml = topLevel()
      .map((c) => {
        const items = itemsIn(c.id, metas).filter((m) => !claimed.has(m.id));
        items.forEach((m) => claimed.add(m.id));
        if (!items.length) return '';
        return `
          <section class="ex-cat" style="--dye:${c.accent ?? '#93a7b3'}">
            <div class="ex-cat-head">
              <h3><a href="#/${c.id}">${esc(c.title)}</a></h3>
              <span class="mono">${String(items.length).padStart(2, '0')}</span>
              <p>${esc(c.blurb ?? '')}</p>
            </div>
            <div class="ex-grid">${items.map((m) => card(m, ++plateNo)).join('')}</div>
          </section>`;
      })
      .join('');
    const loose = metas.filter((m) => !claimed.has(m.id));
    if (loose.length) {
      sectionsHtml += `
        <section class="ex-cat">
          <div class="ex-cat-head">
            <h3><a>More machines</a></h3>
            <span class="mono">${String(loose.length).padStart(2, '0')}</span>
          </div>
          <div class="ex-grid">${loose.map((m) => card(m, ++plateNo)).join('')}</div>
        </section>`;
    }
  }

  const heroHtml = cat
    ? `<header class="cat-hero">
         <a class="cat-back" href="#/">&#8592; the machines</a>
         <h1>${esc(cat.title)}</h1>
         <p class="hero-deck">${esc(cat.blurb ?? '')}</p>
       </header>`
    : `<section class="home-hero">
         <canvas id="hero-machine" aria-label="A live gear train you can drag to spin"></canvas>
         <span class="hero-grain" aria-hidden="true"></span>
         <div class="hero-copy">
           <p class="mono hero-eyebrow">Interactive 3D teardowns</p>
           <h1>
             <span class="ln"><i>Snoop</i></span>
             <span class="ln"><i>through</i></span>
             <span class="ln"><i><em>your stuff.</em></i></span>
           </h1>
           <p class="hero-deck">
             Real machines, taken apart a step at a time and left running. Pause
             anywhere, look inside, and see what every part is doing.
           </p>
           <div class="hero-actions">
             <a class="hero-cta" href="#machines">See all<span aria-hidden="true">&#8599;</span></a>
           </div>
         </div>
         <p class="mono scroll-cue"><i></i>Scroll</p>
         <p class="mono hero-hint" id="hero-hint">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
           Drag to spin
         </p>
       </section>
       <section class="promises">
         <div>
           <b>Scroll it apart</b>
           <p>Every machine opens one step at a time as you scroll, from its outer shell to its deepest part.</p>
         </div>
         <div>
           <b>Watch it run</b>
           <p>Each step is a live mechanism, not a video — it keeps running while you look, and a drag turns it.</p>
         </div>
         <div>
           <b>Built from the real thing</b>
           <p>Every part is modelled against the actual mechanism, piece by piece. Nothing is downloaded or faked.</p>
         </div>
       </section>`;

  container.innerHTML = `
    <div class="home">
      <header class="masthead">
        <a class="wordmark" href="#/">what<b>D</b>stuff</a>
        <nav>
          <button class="search-trigger" id="open-finder" aria-label="Search the machines">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.4" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" />
            </svg>
            <span>Find a machine</span>
            <kbd>&#8984;K</kbd>
          </button>
          <a class="mono hide-sm" href="#machines">Machines</a>
          ${socialDock()}
        </nav>
      </header>

      ${heroHtml}

      <main class="machines" id="machines">
        <div class="machines-head">
          <h2>${cat ? 'In this category' : 'The Machines'}</h2>
          <p class="mono" id="ex-count"></p>
        </div>
        ${sectionsHtml}
      </main>

      <footer class="home-foot">
        <div class="foot-top">
          <p class="mono">whatDstuff<br />Procedural 3D · no imported assets · ever</p>
          <nav class="foot-links mono">
            <a href="#machines">Machines</a>
            ${SOCIALS.map((s) => `<a href="${s.href}" target="_blank" rel="noopener noreferrer">${s.label}</a>`).join('')}
          </nav>
        </div>
        ${gearPair()}
      </footer>
    </div>

    <div class="finder-scrim" id="finder-scrim"></div>
    <div class="finder" id="finder" role="dialog" aria-modal="true" aria-label="Find a machine">
      <div class="finder-bar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" />
        </svg>
        <input id="finder-q" type="text" autocomplete="off" spellcheck="false"
               placeholder="Search machines and the parts inside them" />
        <button id="close-finder" type="button">ESC</button>
      </div>
      <div class="finder-body" id="finder-body"></div>
    </div>
  `;

  const q = (sel) => container.querySelector(sel);
  const count = q('#ex-count');
  const shown = container.querySelectorAll('.ex-card:not(.ex-folder)').length;
  count.textContent = `${shown} machine${shown === 1 ? '' : 's'}`;

  // --- the hero mechanism -------------------------------------------------
  let machine = null;
  const canvas = q('#hero-machine');
  if (canvas) {
    machine = mountHeroMachine(canvas);
    // the hint has done its job the moment someone drags — retire it
    const hint = q('#hero-hint');
    canvas.addEventListener(
      'train-dragged',
      () => {
        hint.style.transition = 'opacity .5s, transform .5s';
        hint.style.opacity = '0';
        hint.style.transform = 'translateY(6px)';
      },
      { once: true },
    );
  }

  // --- the finder ---------------------------------------------------------
  // At library scale, browsing gives out and search becomes the front door, so
  // it indexes each machine's PARTS as well as its title and says which it
  // matched on.
  const scrim = q('#finder-scrim');
  const finder = q('#finder');
  const input = q('#finder-q');
  const body = q('#finder-body');
  const catTitle = (m) =>
    categories[(m.categories ?? [])[0]]?.title ?? 'More machines';
  let hits = [];
  let sel = 0;

  const mark = (text, needle) => {
    const i = text.toLowerCase().indexOf(needle);
    if (i < 0) return esc(text);
    return (
      esc(text.slice(0, i)) +
      '<mark>' +
      esc(text.slice(i, i + needle.length)) +
      '</mark>' +
      esc(text.slice(i + needle.length))
    );
  };

  const hitHTML = (m, why) => `
    <div class="hit" data-id="${m.id}">
      <b>${esc(shortTitle(m.title))}</b>
      <span class="hit-tag">${esc(catTitle(m))}</span>
      <span class="hit-why">${why}</span>
    </div>`;

  function search(raw) {
    const needle = raw.trim().toLowerCase();
    if (!needle) {
      hits = metas.slice(0, 6);
      body.innerHTML =
        '<p class="finder-group">Start here</p>' +
        hits.map((m) => hitHTML(m, esc(m.spec ?? ''))).join('');
      sel = 0;
      paint();
      return;
    }

    const byName = metas.filter((m) => m.title.toLowerCase().includes(needle));
    const inside = metas.filter(
      (m) =>
        !byName.includes(m) &&
        `${m.spec ?? ''} ${m.keywords ?? ''} ${m.summary ?? ''}`.toLowerCase().includes(needle),
    );
    hits = [...byName, ...inside];

    let html = '';
    if (byName.length) {
      html +=
        '<p class="finder-group">Machines</p>' +
        byName.map((m) => hitHTML(m, esc(m.spec ?? ''))).join('');
    }
    if (inside.length) {
      // say WHERE the term was found — that is what makes it an encyclopedia
      html +=
        '<p class="finder-group">Found inside</p>' +
        inside
          .map((m) => {
            const src = `${m.spec ?? ''} · ${m.keywords ?? ''}`;
            const i = src.toLowerCase().indexOf(needle);
            const from = Math.max(0, i - 34);
            const frag = (from ? '…' : '') + src.slice(from, i + needle.length + 40) + '…';
            return hitHTML(m, mark(frag, needle));
          })
          .join('');
    }
    if (!hits.length) html = requisitionHTML(raw.trim());
    body.innerHTML = html;
    sel = 0;
    paint();
  }

  // A miss is not an error — it is the highest-intent moment in the product.
  // The visitor has just told us exactly what to build next.
  function requisitionHTML(raw) {
    const words = raw.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const near = metas
      .map((m) => {
        const hay = `${m.title} ${m.spec ?? ''} ${m.keywords ?? ''}`.toLowerCase();
        return { m, score: words.reduce((s, w) => s + (hay.includes(w.slice(0, 5)) ? 1 : 0), 0) };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => x.m);
    const fallback = near.length ? near : metas.slice(0, 3);

    return `
      <div class="req">
        <div class="req-plate">
          <span class="mono">Not opened — yet</span><span class="req-no">REQ &middot; NEW</span>
        </div>
        <h4>Nobody has taken <q>${esc(raw)}</q> apart here.</h4>
        <p>
          Tell us and it goes on the bench. What people ask for is what gets built
          next — we would rather build the machine you actually wanted than guess.
        </p>
        <form class="req-form" id="req-form">
          <input type="email" required placeholder="you@example.com" aria-label="Your email" />
          <button type="submit">Put it on the bench</button>
        </form>
        <div class="req-near">
          <p class="finder-group">Closest matches</p>
          ${fallback.map((m) => hitHTML(m, esc(m.spec ?? ''))).join('')}
        </div>
      </div>`;
  }

  function paint() {
    const els = body.querySelectorAll('.hit');
    els.forEach((el, i) => el.setAttribute('data-sel', i === sel ? '1' : '0'));
    els[sel]?.scrollIntoView({ block: 'nearest' });
  }

  function openFinder() {
    scrim.dataset.open = '1';
    finder.dataset.open = '1';
    document.body.style.overflow = 'hidden';
    input.value = '';
    search('');
    setTimeout(() => input.focus(), 40);
  }
  function closeFinder() {
    scrim.dataset.open = '0';
    finder.dataset.open = '0';
    document.body.style.overflow = '';
  }

  q('#open-finder').addEventListener('click', openFinder);
  q('#close-finder').addEventListener('click', closeFinder);
  scrim.addEventListener('click', closeFinder);
  input.addEventListener('input', () => search(input.value));
  body.addEventListener('click', (e) => {
    const hit = e.target.closest('.hit');
    if (hit) {
      location.hash = `#/${hit.dataset.id}`;
      closeFinder();
    }
  });
  body.addEventListener('submit', (e) => {
    if (e.target.id !== 'req-form') return;
    e.preventDefault();
    // no backend yet — this is where the demand log and the email provider wire
    // in (see docs/audience-capture-plan.md)
    e.target.outerHTML = `<div class="req-done">Logged. You will get
      <q>${esc(input.value.trim())}</q> the day it ships — and nothing else.</div>`;
  });

  const onKey = (e) => {
    const open = finder.dataset.open === '1';
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) ||
        (e.key === '/' && !open && e.target === document.body)) {
      e.preventDefault();
      openFinder();
      return;
    }
    if (!open) return;
    if (e.key === 'Escape') closeFinder();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      sel = Math.min(sel + 1, hits.length - 1);
      paint();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      sel = Math.max(sel - 1, 0);
      paint();
    }
    if (e.key === 'Enter' && hits[sel]) {
      location.hash = `#/${hits[sel].id}`;
      closeFinder();
    }
  };
  document.addEventListener('keydown', onKey);

  // masthead docks once the hero is behind you
  const mast = q('.masthead');
  const firstSection = q('.home-hero') ?? q('.cat-hero');
  const mastWatch = new IntersectionObserver(
    ([e]) => mast.classList.toggle('docked', !e.isIntersecting),
    { threshold: 0, rootMargin: '-60px 0px 0px 0px' },
  );
  if (firstSection) mastWatch.observe(firstSection);

  // --- the gear pair ------------------------------------------------------
  // Scroll distance turns gear A, and gear B takes the same angle negated —
  // equal tooth counts, so that IS the gear ratio, and the teeth stay meshed
  // for free. A slow idle creep keeps it alive before the first scroll.
  const box = q('.gearbox');
  const gearA = box.querySelector('.gear-a .gear-spin');
  const gearB = box.querySelector('.gear-b .gear-spin');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let gearRaf = 0;
  if (!reduceMotion) {
    let angle = 0;
    let lastY = window.scrollY;
    let lastT = performance.now();
    const step = (t) => {
      const dt = Math.min(64, t - lastT); // clamp: a backgrounded tab must not
      lastT = t; //                           bank up a huge jump on return
      const y = window.scrollY;
      angle += (y - lastY) * 0.5 + ((box.dataset.drive ? 96 : 12) * dt) / 1000;
      lastY = y;
      gearA.setAttribute('transform', `rotate(${angle.toFixed(2)} ${CX_A} ${CY})`);
      gearB.setAttribute('transform', `rotate(${(-angle).toFixed(2)} ${CX_B} ${CY})`);
      gearRaf = requestAnimationFrame(step);
    };
    gearRaf = requestAnimationFrame(step);
  }
  // Hovering EITHER the gear or its name drives the pair and lights that part —
  // pointing at a gear and having nothing happen is what makes it feel dead.
  box.querySelectorAll('[data-gear]').forEach((el) => {
    el.addEventListener('mouseenter', () => {
      box.dataset.drive = el.dataset.gear;
    });
    el.addEventListener('mouseleave', () => {
      delete box.dataset.drive;
    });
    el.addEventListener('focus', () => {
      box.dataset.drive = el.dataset.gear;
    });
    el.addEventListener('blur', () => {
      delete box.dataset.drive;
    });
  });

  return {
    destroy() {
      machine?.destroy();
      cancelAnimationFrame(gearRaf);
      mastWatch.disconnect();
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      container.innerHTML = '';
    },
  };
}
