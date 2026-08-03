import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildMechanicalWatch } from './model.js';

// The story zooms in one layer at a time: dial → open case → each mechanism
// → back out to the dial and the whole watch. Every step runs
// the movement as a seamless loop while active; the whole mechanism is driven
// by one `beat` scalar, and a 60-beat lap closes perfectly (escape wheel —
// 15 teeth, the canonical Swiss lever count — 4 revs, balance 30 periods,
// seconds hand 1 rev, train wheels whole revs).
// Steps differ in loop SPEED, CAMERA, and which layers are dressed/labelled.
// Each step owns its own local state object (never share one across timelines).
function run(duration) {
  return ({ tl, handles }) => {
    const s = { beat: 0 };
    tl.add(s, {
      beat: 60,
      duration,
      ease: 'linear',
      onUpdate: () => handles.setBeat(s.beat),
    });
  };
}

// every step pins its own dress/label state so scrolling in either
// direction always lands in a consistent view
const view = (dress, labels) => ({ handles }) => {
  handles.setDress(dress);
  handles.setLabels(labels);
};

export default defineExplainer({
  ...meta,
  // DOF [rung 4]: only the escapement/balance steps get a dofAperture below —
  // camera-to-target distance there is ~1.5-1.8 (true macro); every other
  // step is medium/wide and stays at the sharp default.
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildMechanicalWatch({ scene });
  },

  steps: [
    {
      id: 'face',
      heading: '1 · The face',
      body: 'One of the smallest machines most people will ever own, and from the outside the job looks simple: three hands, twelve marks, one knob. The hour and minute hands creep too slowly to see, but watch the seconds hand — it doesn\'t jump once a second like a quartz watch. It sweeps, in a stream of tiny steps, because it is wired straight to a mechanical heartbeat underneath. The knob at the side is the crown: twist it and you are literally winding the machine\'s fuel tank. Scroll down and we\'ll take it apart, one layer at a time.',
      hint: 'Drag to orbit · scroll to zoom in.',
      camera: { position: [0.8, 2.1, 3.2], target: [0, 1.35, 0] },
      onEnter: view(true, false),
      timeline: run(10000),
    },
    {
      id: 'anatomy',
      heading: '2 · Inside the case',
      body: 'Lift off the dial and hands, and here is the machine itself. It\'s a chain of parts, each handing power to the next: a wound mainspring in the barrel pushes a train of gears; the last gear, the escape wheel, is held in check by the pallet fork; and the fork is governed by the swinging balance wheel. Follow the chain with us — power first, timekeeping last.',
      hint: 'Drag to orbit the open movement.',
      camera: { position: [0.15, 1.65, 3.75], target: [0, 1.45, 0] },
      onEnter: view(false, true),
      timeline: run(12000),
    },
    {
      id: 'mainspring',
      heading: '3 · The mainspring',
      body: 'Winding the crown coils a flat ribbon of spring steel tighter and tighter inside the barrel. That is the watch\'s entire fuel tank — a few turns of the crown store enough energy to run it for a day or two. As the spring slowly unwinds, it turns the barrel, and the barrel\'s teeth push the first wheel of the train.',
      camera: { position: [-1.0, 2.0, 1.9], target: [-0.33, 1.75, 0] },
      onEnter: view(false, false),
      timeline: run(14000),
    },
    {
      id: 'gears',
      heading: '4 · The gear train',
      body: 'The barrel turns slowly with great force; the train trades that force for speed. Each wheel drives a tiny pinion on the next, spinning it faster and faster — barrel to centre wheel to third to fourth. By the fourth wheel the ratio is set so it turns exactly once per minute, which is why the seconds hand rides on it.',
      camera: { position: [0.8, 1.45, 1.9], target: [0.24, 1.3, 0] },
      onEnter: view(false, false),
      timeline: run(9000),
    },
    {
      id: 'escapement',
      heading: '5 · The escapement',
      body: 'If nothing stopped it, the spring would unwind in seconds. The pallet fork is the gatekeeper: its two ruby jewels catch the escape wheel\'s teeth, holding the whole train frozen. Only when the balance nudges the fork does one tooth slip past — tick — before the other jewel locks the very next tooth. The train advances one tooth at a time, and every unlock is a beat.',
      camera: { position: [-0.4, 1.2, 1.45], target: [-0.07, 1.09, 0] },
      dofAperture: 0.00012,
      onEnter: view(false, false),
      timeline: run(7000),
    },
    {
      id: 'balance',
      heading: '6 · The balance wheel',
      body: 'This is the heartbeat. The balance wheel swings back and forth on a fine spiral hairspring — wind it one way, the spring pulls it back, exactly like a pendulum but immune to gravity. It beats at a fixed rate, typically eight times a second. Each swing, its jewel kicks the pallet fork to release one tooth, and in return the escapement gives the balance a tiny push to keep it swinging. The balance decides the speed; everything else obeys.',
      camera: { position: [-1.05, 1.45, 1.7], target: [-0.41, 1.25, 0.05] },
      dofAperture: 0.00012,
      onEnter: view(false, false),
      timeline: run(7000),
    },
    {
      id: 'hands',
      heading: '7 · Back to the hands',
      body: 'Put the dial back on and the whole chain hides behind three moving pointers. The fourth wheel turns once a minute, so the seconds hand simply rides its axle. A small side train of reduction gears — the motion works — slows that same rotation down 60× for the minute hand and 720× for the hour hand. Every sweep of the seconds hand you see is the balance wheel\'s beat, delivered to the surface.',
      camera: { position: [0.35, 1.8, 2.5], target: [0, 1.5, 0.15] },
      onEnter: view(true, false),
      timeline: run(8000),
    },
    {
      id: 'run',
      heading: 'The whole watch',
      body: 'Spring to barrel to train to escape wheel to fork to balance — and the balance metering it all back into a steady tick that ripples up to the hands. Wind it once and this conversation between a spring and a swinging wheel repeats hundreds of thousands of times a day, keeping time to within seconds, on a machine small enough to forget you\'re wearing.',
      hint: 'Drag to orbit the running watch.',
      camera: { position: [1.4, 2.3, 4.2], target: [0, 1.35, -0.4] },
      freeOrbit: true,
      onEnter: view(true, false),
      timeline: run(8000),
    },
  ],
});
