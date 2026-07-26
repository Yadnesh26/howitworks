import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildGearbox } from './model.js';

// Zoom-in / reveal story: the sealed box first, then the lid comes off and we
// walk the power path, the constant-mesh trick, the synchro handshake, the
// shift linkage and reverse — then the case closes and we run all five gears.
//
// Seamlessness: every loop advances the LAYSHAFT a whole number of turns
// (model.js header explains why that is sufficient); the piecewise demos
// (setShift / setReverse / setGears) guarantee it internally via their
// integrated speed tables.

// Pin the full layer/label/path state on entering a step, so scrolling either
// way always lands on a consistent scene.
const view = (caseOn, labels, path = false) => ({ handles }) => {
  handles.setCase(caseOn);
  handles.setLabels(labels);
  handles.setPath(path);
};

// Steady-state loop in one gear: `turns` whole layshaft turns per lap.
function runLoop(gearName, turns, duration) {
  return ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL state — never share tween targets across steps
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () => handles.setRun(gearName, s.t * turns),
    });
  };
}

// One-scalar choreography loops defined in the model (shift/reverse/finale).
function demoLoop(handleName, duration) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () => handles[handleName](s.t),
    });
  };
}

const steps = [
  {
    id: 'complete',
    heading: 'The box between engine and wheels',
    body: 'An engine is only happy spinning fast — a few thousand turns a minute — but your wheels need anything from a crawl to a cruise, and pulling away takes far more twist than an engine makes on its own. This aluminium box solves both problems with nothing but gears: five ratios forward, one reverse, chosen by hand. From the outside only three things move: the input shaft spun by the clutch, the lever in your palm, and the output flange turning the driveshaft.',
    hint: 'Drag to orbit · scroll to open it up.',
    camera: { position: [3.1, 2.7, 3.7], target: [0.1, 1.25, 0] },
    onEnter: view(true, 'exterior'),
    timeline: runLoop('1', 7, 8000),
  },
  {
    id: 'inside',
    heading: 'Three shafts do everything',
    body: 'Lift the case away and the whole machine is three shafts. The input shaft brings power from the clutch to one head gear. That drives the layshaft below — a rigid cluster of gears machined as a single piece. Each cluster gear meshes with a partner riding on the mainshaft above. Right now the box is in neutral: the engine spins the cluster and every gear on it, yet the mainshaft between them stands perfectly still. Nothing is locked together — that is the whole trick.',
    hint: 'Drag to orbit.',
    camera: { position: [2.9, 2.3, 3.3], target: [0.35, 1.25, 0] },
    onEnter: view(false, 'internal'),
    timeline: runLoop('N', 4, 7000),
  },
  {
    id: 'torque',
    heading: 'Trading speed for force',
    body: 'Pick first gear. A 15-tooth pinion on the cluster drives a 35-tooth gear on the mainshaft; count the whole path — 20 teeth into 30, then 15 into 35 — and the engine turns exactly 3.5 times for every single turn of the output. A gearbox never creates power: it trades speed for torque, and in first that trade multiplies the engine’s twist three-and-a-half times — enough to get a tonne and a half rolling from rest.',
    camera: { position: [0.8, 1.9, 3.9], target: [0.3, 1.3, 0] },
    onEnter: view(false, false, true),
    timeline: runLoop('1', 5, 5000),
  },
  {
    id: 'mesh',
    heading: 'Always meshed, never grinding',
    body: 'Every forward pair stays permanently engaged — hence “constant mesh”. The secret is that the big gears are not fixed to the mainshaft at all: each freewheels on needle rollers, spun constantly by the cluster at its own ratio’s speed. Look closely — neighbouring gears turn at visibly different rates around the same still shaft. Beside each one sits a small ring of stubby dog teeth: the only handle the shaft will ever grab.',
    camera: { position: [1.7, 2.15, 2.5], target: [0.3, 1.5, 0] },
    onEnter: view(false, 'mesh'),
    timeline: runLoop('N', 3, 6000),
  },
  {
    id: 'synchro',
    heading: 'The synchromesh handshake',
    body: 'To engage a gear, a collar splined to the mainshaft — the sleeve — slides toward it. It cannot simply slam in: gear and shaft are spinning at different speeds. So it first presses a brass blocker ring onto a steel cone on the gear. Friction on that shallow taper drags the gear — and the whole cluster behind it — to the shaft’s exact speed, and only when the speeds match will the ring’s chamfered teeth let the sleeve slip home over the dog teeth. Match, block, engage: a tenth of a second, entirely by feel.',
    hint: 'Watch the cluster below slow down as the ring bites.',
    camera: { position: [1.45, 2.05, 2.05], target: [0.28, 1.45, 0] },
    onEnter: view(false, 'synchro'),
    timeline: demoLoop('setShift', 9000),
  },
  {
    id: 'shift',
    heading: 'What the lever actually moves',
    body: 'Your hand never touches a gear. The lever rocks one of three rails running along the top of the box; each rail carries a fork riding in a groove on one sleeve. Push, and the fork slides its sleeve out of first, through neutral, and into the synchro’s handshake with second. Watch the whole chain at once: fork forward, ring flaring hot as it drags the cluster to half speed, sleeve home — while the mainshaft coasts on, steady, carrying the car.',
    camera: { position: [2.1, 2.7, 2.6], target: [0.15, 1.55, 0] },
    onEnter: view(false, 'internal'),
    timeline: demoLoop('setShift', 6500),
  },
  {
    id: 'reverse',
    heading: 'Backwards is a special case',
    body: 'There is no synchro for reverse — which is why it only goes in at a standstill. A third gear, the idler, slides bodily along its own shaft until it bridges the cluster and a gear fixed to the mainshaft. One extra gear in the chain flips the direction of rotation: idler in, and the output turns backwards at a stump-pulling 3.2 : 1. These three are the only straight-cut spur gears in the box — simple and strong, and the reason reverse whines while the helical forward gears run quiet.',
    camera: { position: [2.7, 2.1, 2.3], target: [0.75, 1.2, 0.3] },
    onEnter: view(false, 'internal'),
    timeline: demoLoop('setReverse', 7000),
  },
  {
    id: 'run',
    heading: 'Up through the box',
    body: 'Case closed, clutch out, away: first, second, third, fourth, fifth. Every snick of the lever is a fork sliding a sleeve, a brass ring matching speeds, dog teeth locking a new pair into the drive. The output flange gains speed with each change while the engine stays in its happy band — five mechanical trades between fuel and road, all chosen by your left hand.',
    hint: 'In fourth the sleeve locks input straight to output — 1 : 1, no gears working at all. Drag to orbit.',
    camera: { position: [3.3, 2.5, 3.5], target: [0.15, 1.3, 0] },
    freeOrbit: true,
    onEnter: view(true, false),
    timeline: demoLoop('setGears', 9000),
  },
];

// Inject dynamic Depth of Field focus into each step
steps.forEach(step => {
  const originalOnEnter = step.onEnter;
  step.onEnter = (ctx) => {
    originalOnEnter?.(ctx);
    if (ctx.stage && ctx.stage.bokehPass && step.camera) {
      const dx = step.camera.position[0] - step.camera.target[0];
      const dy = step.camera.position[1] - step.camera.target[1];
      const dz = step.camera.position[2] - step.camera.target[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      // Determine aperture based on distance (macro shots get strong DOF)
      const aperture = dist < 3.2 ? 0.0002 : (dist < 4.0 ? 0.0001 : 0.00001);
      
      ctx.stage.bokehPass.uniforms.focus.value = dist;
      ctx.stage.bokehPass.uniforms.aperture.value = aperture;
      ctx.stage.bokehPass.uniforms.maxblur.value = 0.006;
    }
  };
});

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },
  buildScene({ scene }) {
    return buildGearbox({ scene });
  },
  steps,
});
