import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildAk } from './model.js';

// One lap of `cyc` (0-100) is one complete auto cycle: trigger, ignition,
// bullet down the bore, the gas tap, the carrier's rearward sweep with the
// bolt cam-rotating to unlock, extract/eject, and the spring-driven reload.
// Every step loops the whole mechanism — the camera provides the focus.
function shotLoop(duration = 3400) {
  return ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL state — never share tween targets across steps
    tl.add(s, { t: 1, duration, ease: 'linear', onUpdate: () => handles.setCycle(s.t * 100) });
  };
}

// Pin ALL scene state on entering a step (pre-flight #4): reveal, labels, and
// both live readouts — so scrolling either way lands on a consistent scene.
const view = (reveal, labels, { vel = false, bolt = false } = {}) => ({ handles }) => {
  handles.setReveal(reveal);
  handles.setLabels(labels);
  handles.showVel(vel);
  handles.showBolt(bolt);
};

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildAk({ scene });
  },

  steps: [
    {
      id: 'complete',
      heading: 'The rifle',
      body: 'This is the AK-47 — the most-produced firearm in history, and the shape half the world recognises on sight: a stamped-steel receiver, warm wood furniture, a gas tube riding over the barrel, and that unmistakable curved magazine. Nothing about it looks complicated, and that is exactly the point. Let us open it up.',
      hint: 'Drag to orbit · scroll to look inside.',
      camera: { position: [0.75, 2.05, 4.2], target: [0.15, 1.05, 0] },
      dofAperture: 0.00003,
      onEnter: view(0, 'exterior'),
      timeline: shotLoop(6600),
    },
    {
      id: 'inside',
      heading: 'Inside the AK',
      body: 'The shell turns to glass. Behind the barrel sits the bolt carrier, with a long gas piston bolted to its front and the rotating bolt tucked inside it. A big recoil spring runs back into the stock, a hammer waits under the bolt, and the curved magazine is a spring-loaded stack of cartridges. Two machines share this receiver: an ignition system, and a gas-driven self-reloading action.',
      hint: 'Drag to orbit · scroll for the mechanism.',
      camera: { position: [1.6, 2.1, 4.0], target: [-0.5, 1.12, 0] },
      dofAperture: 0.00005,
      onEnter: view(1, 'internal'),
      timeline: shotLoop(6600),
    },
    {
      id: 'trigger',
      heading: '1 · Trigger and hammer',
      body: 'Pulling the trigger releases a spring-loaded hammer. It snaps up and strikes the firing pin in the tail of the bolt, driving its point into the primer — a dab of shock-sensitive compound in the base of the cartridge. That is the only job the trigger has. Everything after this happens on its own, powered entirely by the burning powder.',
      camera: { position: [-0.35, 1.55, 2.1], target: [-0.12, 1.05, 0] },
      dofAperture: 0.00016,
      focus: ['Hammer'],
      onEnter: view(1, false),
      timeline: shotLoop(3600),
    },
    {
      id: 'bore',
      heading: '2 · Ignition and down the bore',
      body: 'The primer flashes and lights the powder charge. It is not an explosion so much as an extremely fast, contained fire, and the pressure has one way out: forward, against the base of the bullet. Four right-hand rifling grooves bite into the bullet and spin it as it accelerates, leaving the muzzle at about 715 metres per second — twice the speed of sound.',
      hint: 'The spin is what keeps the bullet flying nose-first.',
      camera: { position: [1.45, 1.75, 2.7], target: [1.0, 1.22, 0] },
      dofAperture: 0.0001,
      onEnter: view(1, false, { vel: true }),
      timeline: shotLoop(3200),
    },
    {
      id: 'gas',
      heading: '3 · Tapping the gas',
      body: 'Here is what makes an AK an AK. Just before the bullet reaches the muzzle it passes a small port drilled into the top of the barrel, and a jet of high-pressure gas is bled off through it — but only after the bullet has gone by. That gas slams into a long piston bolted to the bolt carrier and throws the whole assembly violently backward. The rifle powers its own reload with a pinch of its own exhaust.',
      hint: 'Gas taps the piston only once the bullet clears the port.',
      camera: { position: [1.25, 1.9, 3.3], target: [0.95, 1.3, 0] },
      dofAperture: 0.0001,
      onEnter: view(1, false),
      timeline: shotLoop(3400),
    },
    {
      id: 'unlock',
      heading: '4 · Twisting the bolt open',
      body: 'The bolt is locked to the barrel by two lugs, so the carrier cannot just drag it back. Instead, a cam track machined into the carrier catches a pin on the bolt and rotates the bolt about 35 degrees, twisting its lugs out of their recesses. Now unlocked, the bolt rides back with the carrier, its extractor dragging the spent case out of the chamber until it is flicked clear through the ejection port.',
      camera: { position: [0.55, 2.05, 2.4], target: [0.05, 1.28, 0] },
      dofAperture: 0.00014,
      focus: ['Rotating bolt'],
      onEnter: view(1, false, { bolt: true }),
      timeline: shotLoop(3600),
    },
    {
      id: 'reload',
      heading: '5 · Reloading itself',
      body: 'The compressed recoil spring now drives the carrier forward again. On the way it strips the top cartridge off the magazine, pushes it into the chamber, and the cam track twists the bolt back the other way to lock it home. The rifle is ready to fire again — and with the trigger held down, this whole loop repeats about ten times every second, roughly 600 rounds a minute.',
      hint: 'One full cycle — extract, eject, feed, chamber, lock.',
      camera: { position: [1.4, 1.8, 3.8], target: [-0.4, 1.02, 0] },
      dofAperture: 0.00007,
      focus: ['Magazine stack'],
      onEnter: view(1, 'internal'),
      timeline: shotLoop(3400),
    },
    {
      id: 'run',
      heading: 'Run it',
      body: 'Shell closed, the whole rifle again: hammer, primer, powder, spinning bullet, a tap of gas, a bolt that twists open, extraction, ejection, feed, and lock — a chain of mechanical events that finishes and resets before you can react, over and over, off a single gas port. Simple, loose, and almost impossible to stop.',
      hint: 'Drag to orbit.',
      camera: { position: [2.3, 2.4, 4.4], target: [-0.15, 1.0, 0] },
      freeOrbit: true,
      dofAperture: 0.00003,
      onEnter: view(0, false),
      timeline: shotLoop(2800),
    },
  ],
});
