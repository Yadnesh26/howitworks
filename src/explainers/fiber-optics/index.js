import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildFiber } from './model.js';

// Zoom-in / reveal story: the complete coiled patch cable, plugging in
// (ferrule alignment), cutting the jacket open, the total-internal-reflection
// macro, single-mode vs multi-mode side by side, light-to-data at the
// transceivers, then the full link running at speed.
//
// Seamless loops: `bounce` and `pulse` are 0-1 phases ridden via
// chainPath()/getPointAt(), which wraps mod 1 by construction — no turn-count
// bookkeeping needed. `spin` (the presentation turntable) advances a whole
// number of turns per lap.

// Depth of field is handled by the framework: stageOptions.dof opts in, and
// the player reads each step's `dofAperture` (focus = that step's own
// camera-to-target distance). Macro steps get a visible shallow-DOF pull;
// wide hero/finale shots stay near-zero so the whole cable is sharp.

// Pin the full layer/label state on entering a step so scrolling either way
// lands on a consistent scene. Also resets spin to 0 — steps 1 and 7 are the
// only ones with a turntable, but they ALSO call view() first; their own
// spinLoop timeline immediately re-drives spin from s.t=0 anyway, so this is
// a no-op there and a fix everywhere else (a step's fixed macro camera used
// to inherit whatever spin angle step 1's turntable happened to leave behind
// when scrolled past mid-lap, framing the wrong side of the model).
const view =
  (reveal, mode, connect, labels) =>
  ({ handles }) => {
    handles.setSpin(0);
    handles.setReveal(reveal);
    handles.setMode(mode);
    handles.setConnect(connect);
    handles.setLabels(labels);
    handles.setBounce(0, false);
  };

function spinLoop(turns, duration) {
  return ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL state — never share tween targets across steps
    tl.add(s, { t: 1, duration, ease: 'linear', onUpdate: () => handles.setSpin(s.t * turns * Math.PI * 2) });
  };
}

function pulseLoop(duration, { spin = 0 } = {}) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () => {
        handles.setPulse(s.t, true);
        if (spin) handles.setSpin(s.t * spin * Math.PI * 2);
      },
    });
  };
}

function bounceLoop(duration) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, { t: 1, duration, ease: 'linear', onUpdate: () => handles.setBounce(s.t, true) });
  };
}

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildFiber({ scene });
  },

  steps: [
    {
      id: 'complete',
      heading: 'A thread of glass carrying light',
      body: 'This coiled yellow cable looks like any other wire, but nothing electrical happens inside it. Instead a laser at one end blinks a beam of light down a glass thread thinner than a human hair, and a sensor at the other end reads it back — millions of times a second. This single cable is what actually carries most of the internet between continents.',
      hint: 'Drag to orbit · scroll to look closer.',
      camera: { position: [2.6, 2.1, 2.9], target: [0, 1.0, 0] },
      onEnter: view(0, 0, 1, 'exterior'),
      dofAperture: 0.00003,
      timeline: spinLoop(1, 7000),
    },
    {
      id: 'connect',
      heading: 'Where the precision actually is',
      body: 'Push the connector home and it clicks — but the plastic housing is not what matters. Inside sits a 1.25 millimetre ceramic ferrule holding the bare glass fibre dead-centre. Mate two connectors and it is those two ferrules, and the two fibre cores inside them, that must line up to a fraction of a hair\'s width. Miss it, even slightly, and light spills into the gap instead of crossing it.',
      hint: 'Watch the ferrule seat home.',
      camera: { position: [1.5, 1.85, 1.55], target: [0.95, 1.5, 0.6] },
      onEnter: view(0, 0, 0, 'connect'),
      dofAperture: 0.00028,
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3600,
          ease: 'linear',
          onUpdate: () => handles.setConnect((Math.sin(s.t * Math.PI * 2 - Math.PI / 2) + 1) / 2),
        });
      },
    },
    {
      id: 'cutaway',
      heading: 'What is actually inside',
      body: 'Strip back the yellow outer jacket and there are three more layers before you reach anything that carries light: a soft coloured buffer coating, then the cladding — glass in its own right — and only at the very centre, the core. The core and cladding are really one continuous piece of glass, drawn together from a single rod; the difference that matters is invisible; a slightly different refractive index between the two.',
      camera: { position: [1.1, 2.15, 0.75], target: [0.35, 1.85, -0.1] },
      onEnter: view(1, 0, 1, 'cutaway'),
      dofAperture: 0.00024,
      timeline: spinLoop(0, 5200),
    },
    {
      id: 'tir',
      heading: 'Total internal reflection',
      body: 'Light hitting the boundary between two clear materials usually just bends and carries on through. But hit it at a shallow enough angle and something else happens: refraction fails completely, and every last bit of light bounces straight back in. That is total internal reflection — no mirror, no coating, just glass meeting glass at the right angle. Skim a beam down the core at a shallow, grazing angle and it ricochets down the fibre for kilometres, losing almost nothing.',
      hint: 'Watch the ray bounce off the cladding boundary, never leaking out.',
      camera: { position: [0.75, 1.98, 0.55], target: [0.3, 1.85, -0.08] },
      onEnter: view(1, 0, 1, 'tir'),
      dofAperture: 0.00032,
      timeline: bounceLoop(3400),
    },
    {
      id: 'compare',
      heading: 'One path, or many',
      body: 'Make the core wide enough and light can zigzag down it at several different angles at once — each one a valid "mode". That is multi-mode fibre: cheap and easy to work with, but those different paths cover slightly different distances, so a sharp pulse smears out over distance. Shrink the core down to a true single-mode thread and only one path fits at all — light travels in an almost dead-straight line, arriving as crisp as it left. That is the fibre that carries a signal across an ocean.',
      hint: 'Same cladding size, radically different core.',
      camera: { position: [2.3, 2.55, 1.55], target: [0.5, 1.72, 0.1] },
      onEnter: view(1, 1, 1, 'compare'),
      dofAperture: 0.00016,
      timeline: bounceLoop(3800),
    },
    {
      id: 'data',
      heading: 'Turning light into data',
      body: 'At each end of the link sits a small transceiver: a laser diode facing one fibre, a photodiode facing the other. The laser blinks on and off — sometimes over a billion times a second — writing a pattern of ones and zeros straight into pulses of light. At the far end the photodiode reads that same pattern back out as electrical pulses. Both directions run at once, each on its own strand, so the link talks and listens simultaneously.',
      camera: { position: [1.35, 1.75, 1.05], target: [0.95, 1.58, 0.6] },
      onEnter: view(0, 0, 1, 'data'),
      dofAperture: 0.00026,
      timeline: pulseLoop(3200),
    },
    {
      id: 'run',
      heading: 'Run it',
      body: 'Laser blinking, photodiode reading, light ricocheting down the core by total internal reflection the entire way — a continuous stream of bits crossing however many kilometres of glass separate the two ends. It travels at roughly two-thirds the speed of light in a vacuum, close to 200,000 kilometres a second: fast enough to cross an ocean and back while you are still reading this sentence.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [2.7, 2.2, 3.0], target: [0, 1.05, 0] },
      freeOrbit: true,
      onEnter: view(0, 0, 1, false),
      dofAperture: 0.00003,
      timeline: pulseLoop(2600, { spin: 1 }),
    },
  ],
  stageOptions: { dof: true },
});
