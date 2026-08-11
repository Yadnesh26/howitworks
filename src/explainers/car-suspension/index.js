import { defineExplainer } from '../../framework/index.js';
import { TAU, smooth } from '../../framework/motion.js';
import meta from './meta.js';
import { buildSuspension } from './model.js';

// Zoom-in / reveal story: the complete axle riding a moving road, the near
// wheel off to expose the MacPherson linkage, the spring, the pogo problem a
// spring alone can't solve, the sectioned damper that solves it, the anti-roll
// bar that only works when the two sides disagree, then everything back
// together on a rough road.
//
// Every step drives model.js's ONE pose function, setRig(roadL, roadR, bodyY,
// roll), from a signal that returns to an identical pose at wrap: whole sine
// cycles per lap, and the single-impulse "pogo" step rides an envelope whose
// value AND slope are zero at both ends.

// Pin the full reveal/section/label/flow state on entering a step so scrolling
// either way lands on a consistent scene (pre-flight #4).
const view =
  (reveal, cut, labelMode) =>
  ({ handles }) => {
    handles.setReveal(reveal);
    handles.setCut(cut);
    handles.setLabels(labelMode);
    handles.setFlow(0);
    handles.setRig(0, 0, 0, 0);
  };

// One linear lap; `signal(t)` returns the rig state for lap fraction t.
function rigLoop(duration, signal) {
  return ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL state — never share tween targets across steps
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () => {
        const r = signal(s.t);
        handles.setRig(r.l ?? 0, r.r ?? 0, r.y ?? 0, r.roll ?? 0);
        handles.setFlow(r.flow ?? 0);
      },
    });
  };
}

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildSuspension({ scene });
  },

  steps: [
    {
      id: 'complete',
      heading: 'The car is barely touching the road',
      body: 'Four patches of rubber, each about the size of your hand, are everything that connects a tonne and a half of car to the ground — and the ground is never flat. Below the springs, the wheels are being thrown up and down by every ridge and seam they cross. Above them, the body is trying to keep travelling in a straight, level line. Watch the road move under each tire, then watch how little of it arrives at the body.',
      hint: 'Drag to orbit · scroll to take the near wheel off.',
      camera: { position: [3.15, 2.08, 3.35], target: [-0.45, 1.05, 0] },
      focus: ['Coil spring', 'Tire'],
      onEnter: view(0, 0, 'exterior'),
      timeline: rigLoop(7200, (t) => {
        const u = TAU * t;
        return {
          l: 0.05 * Math.sin(u),
          r: 0.05 * Math.sin(u + 2.3),
          y: 0.014 * Math.sin(u - 0.7),
          roll: 0.006 * Math.sin(u + 1.1),
        };
      }),
    },
    {
      id: 'linkage',
      heading: 'One arm, one strut, no upper wishbone',
      body: 'The wheel is held by surprisingly little. A single lower control arm swings on two rubber bushings and catches the bottom of the steering knuckle at one ball joint. The top is held by the strut itself — a tube that is both spring and shock absorber, bolted rigidly to the knuckle and hinged into the body at a single mount up in the turret. That is the entire MacPherson layout, and skipping the upper arm is why it is under almost every front wheel on the road: the space it saves is where the engine goes.',
      hint: 'Everything below the spring — hub, brake, arm, tire — is roughly 40 kg of unsprung mass. Keeping it light is half the engineering.',
      camera: { position: [2.35, 1.72, 2.55], target: [0.72, 0.98, 0.02] },
      dofAperture: 0.00009,
      focus: ['Lower control arm', 'Ball joint'],
      onEnter: view(1, 0, 'linkage'),
      timeline: rigLoop(6200, (t) => ({ r: 0.115 * Math.sin(TAU * t) })),
    },
    {
      id: 'spring',
      heading: 'The spring buys you distance',
      body: 'A spring does not absorb a bump — it converts one. A sharp, violent shove at the tire becomes a slow squeeze spread across 80 mm of travel instead of arriving all at once. This coil takes about 30 newtons to compress each millimetre, and it is already squatting some 110 mm under the weight of its corner of the car. Because the wheel sits further out along the arm than the spring does, the car feels a slightly softer rate than the coil’s own — nearer 24 newtons a millimetre. Hung on four of those, the body bobs a little under one and a half times a second, about 1.4 hertz, close to the rhythm of an unhurried walking stride. That is a large part of why a car feels right rather than nauseating.',
      camera: { position: [2.35, 1.98, 1.86], target: [1.06, 1.72, 0.0] },
      dofAperture: 0.00019,
      focus: ['Coil spring · 30 N/mm'],
      onEnter: view(1, 0, 'spring'),
      timeline: rigLoop(5400, (t) => ({ r: 0.135 * Math.sin(TAU * t) })),
    },
    {
      id: 'pogo',
      heading: 'A spring on its own is a pogo stick',
      body: 'Here is the trouble with springs: they give everything back. Energy pushed into the coil comes straight out again, so a car riding on springs alone never settles after a bump — it keeps trading height for speed, bounce after bounce. And every time the body rises, the tire goes light. A light tire cannot steer and cannot brake. Something has to eat that energy on the way through, and it cannot be the spring.',
      hint: 'Damper switched off — this is the spring working alone.',
      camera: { position: [2.3, 1.02, 3.95], target: [-0.28, 1.06, 0] },
      onEnter: view(0, 0, false),
      timeline: rigLoop(6600, (t) => {
        // one bump, then a lightly-damped bounce. The envelope's value AND
        // slope are zero at both ends, so the lap wraps without a kink.
        const bump = 0.09 * Math.exp(-Math.pow((t - 0.12) / 0.045, 2));
        const env =
          smooth(t / 0.12) * (1 - smooth((t - 0.8) / 0.2)) * Math.exp(-2.4 * Math.max(0, t - 0.12));
        return {
          l: bump,
          r: bump,
          y: 0.085 * env * Math.sin(TAU * 5 * (t - 0.12)),
        };
      }),
    },
    {
      id: 'damper',
      heading: 'Nothing in there but oil and small holes',
      body: 'Unbolt the spring, section the strut, and this is the whole shock absorber: a cylinder of oil with a valved piston in it. Every hole in that piston is a doorway the oil must squeeze through, and forcing oil through a small hole takes a force that climbs with SPEED, not distance. Ease over a dip and the damper barely resists; slam a sharp ridge and the same holes push back with 800 to 1500 newtons. Rebound is deliberately the harder direction — two to three times the compression force — because on the way back up the spring is no longer helping. All of that force is your bounce leaving as warm oil, which is why a hard-worked damper is genuinely too hot to hold.',
      hint: 'Compression drives oil up through the piston and pushes the rod’s own volume out through the base valve into the reserve tube. Rebound runs it all backwards.',
      camera: { position: [1.6, 1.42, 1.02], target: [1.14, 1.31, 0.0] },
      dofAperture: 0.0004,
      focus: ['Piston + valves', 'Base valve'],
      onEnter: view(1, 1, 'damper'),
      // 3 cycles per lap, not 2: an even count makes the pose at 0.2 and 0.7
      // of a lap identical, which reads to verify.mjs as a dead timeline
      timeline: rigLoop(5400, (t) => ({
        r: 0.1 * Math.sin(TAU * 3 * t),
        flow: Math.cos(TAU * 3 * t),
      })),
    },
    {
      id: 'arb',
      heading: 'The bar that only wakes up when the two sides disagree',
      body: 'A 22 mm bar of spring steel runs across the car in two bushings, with a short link down to each control arm. Drive over something that lifts both wheels together and the bar simply rotates in its bushings — it contributes nothing. Lean the car into a corner, though, where one side compresses while the other extends, and the bar has no choice but to TWIST. Now it fights: hauling the loaded side up, pressing the light side down, holding the body flat without stiffening the ride over ordinary bumps. Its strength runs with the fourth power of its diameter, so going from 22 mm to 26 mm makes it nearly twice as stiff.',
      hint: 'Watch the near drop link. In the corner it is dragged one way while the far side goes the other, and the bar is wound up between them. Over a bump that lifts both wheels together, nothing winds up — the bar just rolls in its bushings.',
      camera: { position: [2.9, 1.8, 3.6], target: [-0.12, 1.0, 0.25] },
      focus: ['Anti-roll bar · 22 mm'],
      onEnter: view(0, 0, 'arb'),
      timeline: rigLoop(8400, (t) => {
        if (t < 0.5) {
          const x = t / 0.5; // a corner, in and out
          return { roll: 0.105 * Math.sin(TAU * x) * Math.sin(Math.PI * x) ** 2 };
        }
        const x = (t - 0.5) / 0.5; // both wheels lifted together
        const both = 0.2 * Math.sin(TAU * x) * Math.sin(Math.PI * x) ** 2;
        return { l: both, r: both };
      }),
    },
    {
      id: 'run',
      heading: 'Run it',
      body: 'Wheel back on, road roughened, everything working at once: the springs carrying the weight, the dampers turning what is left of each bump into heat, the arms and ball joints holding the wheels where the steering put them, and the bar refusing to let the body lean. This happens several times a second, for a decade, in the dark, under a car nobody ever looks beneath — and the entire point of it is that you feel almost none of it.',
      hint: 'Drag to orbit while it works.',
      camera: { position: [3.05, 2.2, 3.85], target: [-0.32, 1.08, 0] },
      freeOrbit: true,
      onEnter: view(0, 0, false),
      timeline: rigLoop(3800, (t) => {
        const u = TAU * t;
        return {
          l: 0.045 * Math.sin(2 * u) + 0.026 * Math.sin(3 * u + 1.2),
          r: 0.045 * Math.sin(2 * u + 2.1) + 0.026 * Math.sin(3 * u + 4.0),
          y: 0.012 * Math.sin(2 * u - 0.5),
          roll: 0.01 * Math.sin(2 * u + 0.9),
        };
      }),
    },
  ],
});
