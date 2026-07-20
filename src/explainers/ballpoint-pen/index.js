import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildPen } from './model.js';

// Zoom-in / reveal story: the complete sealed pen clicking on its stand,
// ghost the body to expose the bistable cam mechanism, macro on the cam
// itself, the ink reservoir/capillary feed, the ball-tip writing demo, a
// quick grip/clip materials beat, then everything back together at speed.
//
// Seamless loops: setCycle's cam sweeps a flat 180 deg/lap (seamless twice
// over — the idle-extended pose truly repeats, and the cam's own 8-fold
// symmetry makes 180 deg indistinguishable from 0 deg regardless). setWrite
// is an independent 0-1-0 triangle wave — draws the stroke, then erases it,
// never leaving a stale line hanging between laps.

// Pin the full layer/label state on entering a step so scrolling either way
// lands on a consistent scene (pre-flight #4). Resets the writing demo too —
// its dots must not linger visible in unrelated steps.
const view =
  (reveal, labelMode) =>
  ({ handles }) => {
    handles.setReveal(reveal);
    handles.setLabels(labelMode);
    handles.setWrite(0);
    handles.showPaper(false);
  };

// tip step only: same as view(0,'tip') but reveals the writing card
const tipView = ({ handles }) => {
  handles.setReveal(0);
  handles.setLabels('tip');
  handles.setWrite(0);
  handles.showPaper(true);
};

function cycleLoop(duration) {
  return ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL state — never share tween targets across steps
    tl.add(s, { t: 1, duration, ease: 'linear', onUpdate: () => handles.setCycle(s.t) });
  };
}

function writeLoop(duration) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () => {
        handles.setCycle(0.95); // hold idle-extended — the pen isn't clicking here
        handles.setWrite(s.t);
      },
    });
  };
}

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildPen({ scene });
  },

  steps: [
    {
      id: 'complete',
      heading: 'A click, and it is ready',
      body: 'Every ballpoint pen is really three machines wearing one plastic shell: a bistable mechanical latch, a gravity-and-capillary ink pump, and a tiny rolling bearing at the tip. Watch the point through the little hole in the cone — one click and it snaps out, ready to write; click again and it vanishes back inside, safely capped, no lid to lose.',
      hint: 'Drag to orbit · scroll to look inside.',
      camera: { position: [0.22, 0.9, 3.35], target: [0.13, 0.19, 0] },
      onEnter: view(0, 'exterior'),
      timeline: cycleLoop(4200),
    },
    {
      id: 'reveal',
      heading: 'Three machines, one shell',
      body: 'Strip the barrel away and the whole system is laid bare: a star-shaped cam at the top, a coil spring beneath it, and a long transparent tube of ink running almost the entire length of the pen down to the ball. Nothing here is complicated — every part is doing exactly one simple mechanical job, in sequence, every time you click.',
      camera: { position: [0.35, 0.72, 2.8], target: [0.12, 0.16, 0] },
      onEnter: view(1, 'internal'),
      timeline: cycleLoop(4200),
    },
    {
      id: 'cam',
      heading: 'A latch with two stable states',
      body: 'Press the button and a plunger shoves the star-shaped cam down, clear of eight fixed teeth — the cam is free to rotate 45 degrees before the teeth stop it again. Release, and a spring pushes it back up, rotating another 45 degrees into whichever slot is now underneath: one slot holds the refill locked out and writing, the other holds it locked safely inside. Two clicks, 90 degrees each, and the whole refill has quietly rotated 180 degrees in the process — which is no accident: it evens out wear on the tip so it never scratches on one side only.',
      hint: 'Count the clicks: press-release, press-release.',
      camera: { position: [2.15, 0.38, 0.85], target: [1.2, 0.06, 0] },
      onEnter: view(1, 'cam'),
      timeline: cycleLoop(3600),
    },
    {
      id: 'ink',
      heading: 'A reservoir with no pump',
      body: 'There is no pump anywhere in a ballpoint pen — the ink simply sits in a sealed tube, thick and honey-slow, waiting at the top of a narrow capillary gap around the ball. Gravity and surface tension are enough to keep that gap topped up on their own; the ink is deliberately viscous so it clings to the ball instead of flooding out and blotting the page the moment you uncap it.',
      camera: { position: [0.12, 0.5, 1.55], target: [0.08, 0.2, 0] },
      onEnter: view(1, 'ink'),
      timeline: cycleLoop(3400),
    },
    {
      id: 'tip',
      heading: 'A ball bearing that writes',
      body: 'The point itself is a tiny sphere of tungsten carbide, one of the hardest materials made, sitting loose in a socket barely bigger than it is. It is not driven by anything — dragging it across paper is what spins it, and every fraction of a turn carries a wafer-thin film of ink out of the reservoir and presses it onto the fibres. No moving parts, no batteries: friction alone runs the whole exchange.',
      hint: 'Watch the ball turn as the line grows.',
      camera: { position: [-0.95, 0.6, 0.9], target: [-1.12, 0.38, 0] },
      onEnter: tipView,
      timeline: writeLoop(3200),
    },
    {
      id: 'grip',
      heading: 'Small details, deliberately',
      body: 'The soft TPE rubber grip sits exactly where a hand naturally lands, moulded slightly wider than the barrel so the fingers settle without pinching. Its shallow ribs are there purely for friction, not looks — a few tenths of a millimetre of texture that stop a sweaty hand from sliding on an otherwise glassy plastic body.',
      camera: { position: [-0.12, 0.72, 2.15], target: [-0.35, 0.28, 0] },
      onEnter: view(0, 'grip'),
      timeline: cycleLoop(3800),
    },
    {
      id: 'run',
      heading: 'Run it',
      body: 'Click it open, write until the page fills, click it shut — a latch, a reservoir, and a rolling ball, repeated a few thousand times before the ink ever runs dry. Nothing electronic, nothing that needs charging: just geometry and viscosity, doing the same trick since 1945.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [0.25, 1.05, 3.4], target: [0.13, 0.2, 0] },
      freeOrbit: true,
      onEnter: view(0, false),
      timeline: cycleLoop(3400),
    },
  ],
});
