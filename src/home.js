import { createTimeline, stagger } from 'animejs';
import { getMetas } from './framework/index.js';
import { categories, childrenOf, itemsIn, topLevel } from './categories.js';

// Library card grid. Two modes:
//   mountHome(app)          — full library: search + one section per top-level
//                             category (+ an "everything else" section)
//   mountHome(app, catId)   — one category: breadcrumb + child-category
//                             folder cards + that category's explainers
function card(e) {
  return `
    <a class="ex-card" href="#/${e.id}" style="--accent:${e.accent ?? '#6ea8ff'}"
       data-search="${`${e.title} ${e.summary ?? ''}`.toLowerCase().replace(/"/g, '')}">
      <span class="ex-kicker">how it works</span>
      <h2>${e.title.replace(/^How (a |an |the )?/i, '').replace(/ works$/i, '')}</h2>
      <p>${e.summary ?? ''}</p>
      <span class="ex-steps">interactive 3D · scroll-driven</span>
    </a>`;
}

function folderCard(c, count) {
  return `
    <a class="ex-card ex-folder" href="#/${c.id}" style="--accent:${c.accent ?? '#6ea8ff'}"
       data-search="${`${c.title} ${c.blurb ?? ''}`.toLowerCase().replace(/"/g, '')}">
      <span class="ex-kicker">category</span>
      <h2>${c.title}</h2>
      <p>${c.blurb ?? ''}</p>
      <span class="ex-steps">${count} explainer${count === 1 ? '' : 's'}</span>
    </a>`;
}

export function mountHome(container, catId = null) {
  const metas = getMetas();
  const cat = catId ? categories[catId] : null;

  let sectionsHtml;
  if (cat) {
    const kids = childrenOf(catId).map((c) => folderCard(c, itemsIn(c.id, metas).length));
    const items = itemsIn(catId, metas).map(card);
    sectionsHtml = `<main class="home-grid">${[...kids, ...items].join('')}</main>`;
  } else {
    const cats = topLevel();
    const claimed = new Set();
    sectionsHtml = cats
      .map((c) => {
        const items = itemsIn(c.id, metas);
        items.forEach((m) => claimed.add(m.id));
        if (!items.length) return '';
        return `
          <section class="home-section">
            <h3 class="home-section-head">
              <a href="#/${c.id}" style="--accent:${c.accent ?? '#6ea8ff'}">${c.title}</a>
              <span>${items.length}</span>
            </h3>
            <div class="home-grid">${items.map(card).join('')}</div>
          </section>`;
      })
      .join('');
    const loose = metas.filter((m) => !claimed.has(m.id));
    if (loose.length) {
      sectionsHtml += `
        <section class="home-section">
          <h3 class="home-section-head"><a>More machines</a><span>${loose.length}</span></h3>
          <div class="home-grid">${loose.map(card).join('')}</div>
        </section>`;
    }
  }

  container.innerHTML = `
    <div class="home">
      <header class="home-hero${cat ? ' home-hero-cat' : ''}">
        ${
          cat
            ? `<a class="back-link" href="#/">← library</a>
               <h1 id="home-title">${cat.title
                 .split('')
                 .map((c) => `<span class="ch">${c === ' ' ? '&nbsp;' : c}</span>`)
                 .join('')}</h1>
               <p class="home-tag">${cat.blurb ?? ''}</p>`
            : `<h1 id="home-title">${'whatDstuff'
                 .split('')
                 .map((c) => `<span class="ch">${c}</span>`)
                 .join('')}</h1>
               <p class="home-tag">interactive 3D explainers — scroll a machine apart, watch it breathe</p>`
        }
        <input class="home-search" type="search" placeholder="search the machines…" aria-label="Search explainers" />
      </header>
      ${sectionsHtml}
      <footer class="home-foot">
        built with three.js + anime.js — add your own explainer in <code>src/explainers/</code>
      </footer>
    </div>
  `;

  // search filters cards (and hides emptied sections) via the eager metadata
  // baked into data-search — no explainer chunks load until a card is opened
  const search = container.querySelector('.home-search');
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    for (const el of container.querySelectorAll('.ex-card')) {
      el.style.display = !q || el.dataset.search.includes(q) ? '' : 'none';
    }
    for (const sec of container.querySelectorAll('.home-section')) {
      const any = [...sec.querySelectorAll('.ex-card')].some((el) => el.style.display !== 'none');
      sec.style.display = any ? '' : 'none';
    }
  });

  const tl = createTimeline({ defaults: { ease: 'outExpo' } });
  tl.add('#home-title .ch', {
    opacity: [0, 1],
    translateY: [40, 0],
    rotate: [8, 0],
    duration: 800,
    delay: stagger(45),
  })
    .add('.home-tag', { opacity: [0, 1], translateY: [16, 0], duration: 700 }, 350)
    .add(
      '.ex-card',
      { opacity: [0, 1], translateY: [40, 0], duration: 700, delay: stagger(80) },
      500,
    )
    .add('.home-foot', { opacity: [0, 0.7], duration: 600 }, 900);

  // Cursor-follow 3D tilt. The `.tilt` class carries a short transform
  // transition, so the card eases toward the pointer (a "magnetic" trail)
  // and glides back to rest on leave. Skipped when the user prefers reduced
  // motion — a plain lift is enough there.
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MAX_TILT = 6; // degrees
  container.querySelectorAll('.ex-card').forEach((el) => {
    if (reduceMotion) return;
    el.addEventListener('mouseenter', () => el.classList.add('tilt'));
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5; // -0.5 … 0.5
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform =
        `perspective(900px) rotateX(${(-py * MAX_TILT).toFixed(2)}deg) ` +
        `rotateY(${(px * MAX_TILT).toFixed(2)}deg) translateY(-4px) scale(1.015)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
    });
  });

  return {
    destroy() {
      tl.cancel();
      container.innerHTML = '';
    },
  };
}
