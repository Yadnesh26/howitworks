import * as THREE from 'three';
import { animate, createTimeline, stagger } from 'animejs';
import { createStage } from './stage.js';
import { scrubTimeline, loopTimeline } from './scroll.js';
import * as parts from './parts.js';

// Mounts an explainer into `container` and returns a destroy() handle.
//
// Layout: a fixed full-screen canvas sits behind everything; the page keeps
// its normal document scroll, with one tall <section> per step scrolling
// over the canvas. Each section owns a scroll-scrubbed anime.js timeline;
// crossing the middle of the viewport "activates" the step (camera fly-to,
// progress rail, panel highlight).
export function mountExplainer(def, container) {
  container.innerHTML = `
    <div class="player" style="--accent:${def.accent ?? '#6ea8ff'}">
      <div class="canvas-holder"></div>
      <a class="back-link" href="#">← library</a>
      <div class="rail"></div>
      <div class="scroll-hint">scroll<span>▾</span></div>
      <header class="player-hero">
        <p class="hero-kicker">how it works</p>
        <h1>${def.title}</h1>
        <p class="hero-summary">${def.summary ?? ''}</p>
      </header>
      <main class="steps"></main>
    </div>
  `;

  const stage = createStage(container.querySelector('.canvas-holder'), def.stageOptions);
  const handles = def.buildScene({
    scene: stage.scene,
    stage,
    THREE,
    parts,
  });

  window.__hiw = { stage, handles, stepRuntimes: null }; // console/debug access

  const stepsEl = container.querySelector('.steps');
  const railEl = container.querySelector('.rail');
  const cleanups = [];
  const stepRuntimes = [];

  def.steps.forEach((step, i) => {
    const section = document.createElement('section');
    section.className = 'step';
    section.dataset.index = i;
    section.innerHTML = `
      <div class="panel">
        <span class="panel-num">${String(i + 1).padStart(2, '0')} / ${String(def.steps.length).padStart(2, '0')}</span>
        <h2>${step.heading}</h2>
        <p>${step.body}</p>
        ${step.hint ? `<p class="panel-hint">${step.hint}</p>` : ''}
      </div>
    `;
    stepsEl.appendChild(section);

    const dot = document.createElement('button');
    dot.className = 'rail-dot';
    dot.title = step.heading;
    dot.addEventListener('click', () =>
      section.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    );
    railEl.appendChild(dot);

    // 'loop' is the default: each step's timeline runs continuously while
    // the step is active. 'scrub' remains available for scroll-driven steps.
    stepRuntimes.push({ section, dot, tl: null, mode: step.mode ?? 'loop' });
  });

  // Scroll-scrubbed timelines must be created only once the page has real
  // layout: anime's ScrollObserver resolves its scroll container from the
  // geometry it measures at creation, and a zero-sized viewport (background
  // tab, prerender) would leave every observer permanently broken.
  function wireTimelines() {
    stepRuntimes.forEach((rt, i) => {
      const step = def.steps[i];
      if (!step.timeline) return;
      rt.tl = rt.mode === 'loop' ? loopTimeline() : scrubTimeline(rt.section);
      step.timeline({ tl: rt.tl, handles, stage, animate, stagger });
      if (rt.mode === 'loop' && i === activeIndex) rt.tl.play();
    });
  }

  window.__hiw.stepRuntimes = stepRuntimes;
  window.__hiw.activate = (i) => activate(i); // deterministic driving for video export

  // --- step activation (camera, rail, panels, loop start/stop) -----------
  let activeIndex = -1;

  function flyTo({ position, target }) {
    // video export sets __hiwCameraScale > 1 for portrait renders: dolly the
    // camera out along the view axis so landscape-framed shots still fit.
    // A bare global (not on __hiw) so the export can set it via addInitScript,
    // before boot's first fly-to runs.
    const s = window.__hiwCameraScale ?? 1;
    const p = s === 1 ? position : position.map((v, k) => target[k] + (v - target[k]) * s);
    animate(stage.camera.position, {
      x: p[0], y: p[1], z: p[2],
      duration: 1300,
      ease: 'inOutQuad',
    });
    animate(stage.controls.target, {
      x: target[0], y: target[1], z: target[2],
      duration: 1300,
      ease: 'inOutQuad',
    });
  }

  function activate(i) {
    if (i === activeIndex) return;
    const prev = stepRuntimes[activeIndex];
    activeIndex = i;
    const step = def.steps[i];
    const rt = stepRuntimes[i];

    if (prev) {
      prev.section.querySelector('.panel').classList.remove('active');
      prev.dot.classList.remove('active');
      if (prev.mode === 'loop') prev.tl?.pause();
    }
    rt.section.querySelector('.panel').classList.add('active');
    rt.dot.classList.add('active');
    if (rt.mode === 'loop') rt.tl?.play();

    if (step.camera) flyTo(step.camera);
    step.onEnter?.({ handles, stage });

    animate(rt.section.querySelectorAll('.panel > *'), {
      opacity: [0, 1],
      translateY: [18, 0],
      duration: 550,
      ease: 'outExpo',
      delay: stagger(70),
    });
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) activate(Number(entry.target.dataset.index));
      }
    },
    { rootMargin: '-45% 0px -45% 0px' },
  );
  stepRuntimes.forEach((rt) => observer.observe(rt.section));
  cleanups.push(() => observer.disconnect());

  // --- boot: wire timelines now, or as soon as the container has layout ----
  let booted = false;
  let bootPoll = 0;
  function boot() {
    if (booted || !container.clientWidth || !container.clientHeight) return;
    booted = true;
    clearInterval(bootPoll);
    bootObserver.disconnect();
    wireTimelines();
    // Guarantee a running step from the very first frame. The scroll observer
    // only fires once a section crosses the viewport centre, so at the top of
    // the page (hero visible, no section centred) nothing would be active and
    // every loop would sit frozen. Start step 0 explicitly.
    if (activeIndex === -1) activate(0);
  }
  const bootObserver = new ResizeObserver(boot);
  bootObserver.observe(container);
  bootPoll = setInterval(boot, 300);
  boot();

  // --- entrance ------------------------------------------------------------
  window.scrollTo(0, 0);
  const intro = createTimeline({ defaults: { ease: 'outExpo' } });
  intro
    .add('.player-hero > *', {
      opacity: [0, 1],
      translateY: [30, 0],
      duration: 900,
      delay: stagger(120),
    })
    .add('.back-link, .rail, .scroll-hint', { opacity: [0, 1], duration: 700 }, 400);

  const hint = container.querySelector('.scroll-hint span');
  const hintAnim = animate(hint, {
    translateY: [0, 6],
    duration: 700,
    alternate: true,
    loop: true,
    ease: 'inOutQuad',
  });

  return {
    destroy() {
      clearInterval(bootPoll);
      bootObserver.disconnect();
      cleanups.forEach((fn) => fn());
      stepRuntimes.forEach((rt) => rt.tl?.cancel());
      intro.cancel();
      hintAnim.cancel();
      handles.dispose?.();
      stage.dispose();
      container.innerHTML = '';
    },
  };
}
