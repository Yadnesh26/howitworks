import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildMicrowave } from './model.js';

// Reveal story: the sealed running oven, then ghost the body to expose the
// whole system, then the magnetron, the waveguide/feed, the standing wave
// pattern the turntable exists to average out, and finally the water
// molecules actually doing the heating — then a free-orbit finale.
//
// Seamless loops: setPhase is a single 0-1 phase. The turntable advances
// exactly one whole turn per lap; the electron-spoke rotation and stirrer fan
// each advance a whole MULTIPLE of turns per lap (6 and 8) so they too return
// to an identical pose at the wrap; the standing-wave breathe and the water
// molecule rock both run whole sine cycles per lap. Nothing here needs
// fractional-turn bookkeeping — every motion is either a clean whole-turn
// spin or a whole-cycle oscillation.

// Pin ALL scene state on entering a step (pre-flight #4): reveal, field,
// heating overlay, and labels — so scrolling either way lands consistent.
const view =
  (reveal, field, heating, labelMode) =>
  ({ handles }) => {
    handles.setReveal(reveal);
    handles.showField(field);
    handles.showHeating(heating);
    handles.setLabels(labelMode);
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
    return buildMicrowave({ scene });
  },

  steps: [
    {
      id: 'complete',
      heading: 'A sealed box that cooks with radio waves',
      body: 'Close the door and the whole machine disappears behind smooth plastic and a glass window. Nothing on the outside explains how it works — there is no flame, no glowing element, nothing touching the food at all. Everything that actually does the cooking is a vacuum tube the size of a fist, hidden inside the roof of the box.',
      hint: 'Drag to orbit · scroll to look inside.',
      camera: { position: [2.7, 1.8, 3.1], target: [0, 0.99, 0.05] },
      dofAperture: 0.00003,
      onEnter: view(0, false, false, 'exterior'),
      timeline: phaseLoop(5400),
    },
    {
      id: 'cutaway',
      heading: 'Three parts, one job each',
      body: 'Strip the shell away and it is just three things: a turntable that carries the food, a magnetron tucked in the roof that manufactures the microwaves, and a short metal duct — the waveguide — that pipes them down into the cavity. Everything else is empty space and reflective metal walls.',
      camera: { position: [2.6, 2.0, 2.0], target: [0.3, 1.05, -0.15] },
      dofAperture: 0.00012,
      focus: ['Magnetron'],
      onEnter: view(1, false, false, 'cutaway'),
      timeline: phaseLoop(4600),
    },
    {
      id: 'magnetron',
      heading: 'A vacuum tube that spins electrons in circles',
      body: 'At the centre sits a heated cathode, glowing enough to boil electrons off its surface. Two ring magnets sandwich a block of copper cut with twelve resonant cavities, and their magnetic field forces those electrons into curved, looping paths instead of a straight line to the copper. A rotating bunch of electrons — a "spoke" — sweeps past the cavities and rings them like tuning forks, all locked to exactly 2.45 billion cycles a second.',
      hint: 'Violet is the electron spoke; it rotates the cavities into resonance.',
      camera: { position: [1.7, 2.05, -0.05], target: [0.78, 1.19, -0.55] },
      dofAperture: 0.00014,
      focus: ['Cathode (heated filament)'], // the copy leads with the cathode
      onEnter: view(1, false, false, 'magnetron'),
      timeline: phaseLoop(3800),
    },
    {
      id: 'waveguide',
      heading: 'Piping the wave into the box',
      body: 'An antenna loop taps the oscillation straight off the cavities and feeds it up into a short metal duct — the waveguide — which carries it down into the cooking cavity. A small stirrer fan spins at the feed point, scattering the wave further before it ever reaches the turntable below.',
      camera: { position: [1.55, 1.85, -1.25], target: [0.78, 1.48, -0.55] },
      dofAperture: 0.00013,
      focus: ['Waveguide'],
      onEnter: view(1, false, false, 'waveguide'),
      timeline: phaseLoop(3600),
    },
    {
      id: 'waves',
      heading: 'Why the plate has to spin',
      body: 'Inside a sealed metal box, microwaves cannot just travel outward and disappear — they bounce off every wall and pile up into a fixed pattern of peaks and troughs, a standing wave. Sit food at a trough and it barely warms; sit it at a peak and it scorches. A turntable is the low-tech fix: it drags every part of the food through both, again and again, until the average comes out even.',
      camera: { position: [2.0, 2.3, 1.6], target: [0, 0.75, 0.1] },
      dofAperture: 0.00012,
      focus: ['Standing wave — antinodes (hot)'],
      onEnter: view(1, true, false, 'waves'),
      timeline: phaseLoop(4200),
    },
    {
      id: 'heating',
      heading: 'The actual heat: molecules forced to flip',
      body: 'Water is a polar molecule — slightly positive on one end, slightly negative on the other — so it twists to follow an electric field. The microwave field reverses 2.45 billion times a second, and every water molecule in the food tries to flip in step with it. That forced, frantic rotation is friction at the molecular scale, and friction is heat. It builds fastest near the surface; the centre catches up only by ordinary conduction.',
      hint: 'Watch the molecules rock in time with the field.',
      camera: { position: [0.35, 1.15, 1.35], target: [-0.15, 0.78, 0.35] },
      dofAperture: 0.00018,
      focus: ['Polar water molecules'],
      onEnter: view(1, true, true, 'heating'),
      timeline: phaseLoop(3400),
    },
    {
      id: 'run',
      heading: 'Run it',
      body: 'A tube that turns heat into spinning electrons, electrons that ring twelve tiny cavities into a radio wave, a box that bounces that wave into a standing pattern, and a turntable that just keeps things moving through it. No flame, nothing touching the food — just water molecules forced to dance.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [2.6, 1.9, 3.0], target: [0, 1.0, 0] },
      freeOrbit: true,
      onEnter: view(1, true, true, false),
      timeline: phaseLoop(3000),
    },
  ],
});
