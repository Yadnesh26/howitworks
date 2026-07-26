import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildCharger } from './model.js';

// Reveal story: the sealed phone-on-a-pad, then ghost both shells to expose
// the two flat coils across their gap, then the physics one beat at a time —
// AC current makes a field, the field induces current in the receiver, the
// receiver rectifies it to DC and charges the battery — then a free-orbit
// finale with everything live.
//
// Seamless loops: setPhase is a single 0-1 phase ridden by every flow (current
// dots around both coil spirals, energy dots around the flux loops) via
// getPointAt, which wraps mod 1 — frame 0 == frame 1 at any duration. The
// field's emissive "breathe" uses whole sine cycles per lap. Battery fill is
// pinned per step (no snap at the wrap); "charging" reads from the live flow
// and the fill's glow, not a resetting bar.

// Pin ALL scene state on entering a step (pre-flight #4): reveal, field on/off,
// labels, and the battery level — so scrolling either way lands consistent.
const view =
  (reveal, field, labelMode, charge = 0.55) =>
  ({ handles }) => {
    handles.setReveal(reveal);
    handles.showField(field);
    handles.setLabels(labelMode);
    handles.setCharge(charge);
  };

function phaseLoop(duration) {
  return ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL state — never share tween targets across steps
    tl.add(s, { t: 1, duration, ease: 'linear', onUpdate: () => handles.setPhase(s.t) });
  };
}

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildCharger({ scene });
  },

  steps: [
    {
      id: 'complete',
      heading: 'Power with nothing plugged in',
      body: 'Set the phone down and it starts charging — no cable, no port, no contacts touching anywhere. Everything that carries the power lives sealed inside two smooth plastic shells: a flat coil in the pad, a matching coil in the phone, and a few millimetres of air in between. The trick is that electricity can cross that gap as a magnetic field, and turn back into electricity on the far side.',
      hint: 'Drag to orbit · scroll to look inside.',
      camera: { position: [2.4, 1.7, 2.8], target: [0.2, 0.32, 0] },
      dofAperture: 0.00003,
      onEnter: view(0, false, 'exterior', 0.5),
      timeline: phaseLoop(5200),
    },
    {
      id: 'coils',
      heading: 'Two coils, one gap',
      body: 'Strip the shells away and the whole machine is almost nothing: two flat spiral coils of fine copper wire, wound like clock springs and parked face to face a few millimetres apart. Behind each one sits a dark ferrite disc that gathers the magnetic field and keeps it from leaking into the surrounding metal. The coils never touch — the gap is the point.',
      camera: { position: [1.75, 0.66, 2.25], target: [0.05, 0.31, 0] },
      dofAperture: 0.00012,
      focus: ['Transmitter coil', 'Receiver coil'],
      onEnter: view(1, false, 'coils', 0.5),
      timeline: phaseLoop(4600),
    },
    {
      id: 'field',
      heading: 'Alternating current, a moving field',
      body: 'The pad pushes alternating current through its coil — current that reverses direction more than a hundred thousand times a second. A moving current always drags a magnetic field along with it, so this coil becomes an electromagnet that flips north-south, north-south, at the same furious rate. The field loops up out of the coil, through its centre, and back around the outside.',
      hint: 'The teal loops are the magnetic field; amber is current.',
      camera: { position: [2.5, 1.05, 1.75], target: [0, 0.5, 0] },
      dofAperture: 0.00006,
      focus: ['Oscillating magnetic field'],
      onEnter: view(1, true, 'field', 0.5),
      timeline: phaseLoop(3600),
    },
    {
      id: 'induction',
      heading: 'A field that makes current',
      body: 'Here is the payoff, and it is a law of physics: a magnetic field that changes through a loop of wire pushes a current around that loop — Faraday’s law of induction. The receiver coil sits right in the path of the pad’s flipping field, so that field drives its own alternating current in the phone’s coil. Power has crossed the gap with nothing but magnetism in between.',
      camera: { position: [1.5, 0.78, 2.15], target: [0.0, 0.4, 0] },
      dofAperture: 0.0001,
      focus: ['Induced current'],
      onEnter: view(1, true, 'induction', 0.6),
      timeline: phaseLoop(3600),
    },
    {
      id: 'battery',
      heading: 'From wobbling AC to a full battery',
      body: 'The current arriving in the phone is alternating, but a battery can only take steady DC. So a small rectifier chip flips every backward half-wave forward and smooths the result into a clean, one-way current — which is what finally trickles into the battery. About three-quarters of the energy the pad draws ends up here; the rest is lost as gentle warmth in the coils.',
      hint: 'Watch the current arrive, straighten, and fill the cell.',
      camera: { position: [1.95, 1.05, 1.95], target: [0.68, 0.4, 0.08] },
      dofAperture: 0.00016,
      focus: ['Rectifier — AC to DC'],
      onEnter: view(1, true, 'battery', 0.82),
      timeline: phaseLoop(3400),
    },
    {
      id: 'run',
      heading: 'Run it',
      body: 'A coil that makes a field, a field that makes a current, a chip that tames it into charge — three simple steps repeating a hundred thousand times a second, quietly, through a gap of empty air. No plug to wear out, no port to corrode: just two coils that agree to share a magnetic field.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [2.5, 1.65, 2.7], target: [0.2, 0.35, 0] },
      freeOrbit: true,
      onEnter: view(1, true, false, 0.9),
      timeline: phaseLoop(3000),
    },
  ],
});
