import { defineExplainer } from '../../framework/index.js';
import { TAU } from '../../framework/motion.js';
import meta from './meta.js';
import { buildCamera } from './model.js';

// Every step pins the FULL state on entry — reveal, labels, and every pose
// scalar including the turntable — so scrolling in either direction lands on
// the same scene and no fixed camera inherits a stray mid-lap phase.
const pin = (reveal, labelSet, over = {}) => ({ handles }) => {
  handles.setReveal(reveal);
  handles.setLabels(labelSet);
  handles.set({ spin: 0, iris: 0.55, cycle: 0, fast: 0, rays: 1, flow: 0, sense: 0, macro: 0, ...over });
};

// One lap = one complete exposure. `flow` advances whole laps so the photon
// stream wraps invisibly, and every scalar returns to its start pose.
const exposure = (duration, over = {}) => ({ tl, handles }) => {
  const s = { t: 0 };
  tl.add(s, {
    t: 1,
    duration,
    ease: 'linear',
    onUpdate: () => handles.set({ cycle: s.t, flow: (s.t * 3) % 1, ...over }),
  });
};

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildCamera({ scene });
  },

  steps: [
    {
      heading: 'The camera',
      body: 'A body, a lens, a button. Press it and you hear one sharp clack — and a moment of the world is kept. That clack is not the electronics: it is a mirror, two curtains and nine steel blades all moving in a choreography that finishes in about a tenth of a second. Everything interesting here happens in the dark, behind the glass.',
      hint: 'Drag to orbit · scroll to look inside.',
      camera: { position: [-4.6, 3.0, 5.0], target: [-0.35, 1.15, 0.15] },
      dofAperture: 0.00003,
      focus: ['Lens barrel', 'Shutter button'],
      onEnter: pin(0, 'exterior', { iris: 0.62 }),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 11000,
          ease: 'linear',
          // a gentle sway rather than a full turn: the callouts stay put long
          // enough to read, and the lap still returns to an identical pose
          onUpdate: () => handles.set({ spin: Math.sin(s.t * TAU) * 0.36, iris: 0.62 }),
        });
      },
    },
    {
      heading: '1 · The hole that meters the light',
      body: 'Look into the front of the lens and you can watch the machine breathe. Nine thin steel blades pivot on a ring, and the near-circular hole they leave between them is the aperture. Open it one full stop — f/8 to f/5.6 — and you have exactly doubled the light landing on the sensor. Close it to a pinhole and the same scene arrives a hundred times dimmer.',
      hint: 'Nine blades, nine arcs — that is why out-of-focus highlights go nine-sided.',
      camera: { position: [0, 1.18, 3.75], target: [-0.41, 1.06, 1.21] },
      dofAperture: 0.00012,
      focus: ['Aperture blades'],
      onEnter: pin(0, 'optics'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4400,
          ease: 'linear',
          onUpdate: () => handles.set({ iris: 0.5 - 0.5 * Math.cos(s.t * TAU) }),
        });
      },
    },
    {
      heading: '2 · You are looking through the lens',
      body: 'Now the shell turns to glass. Light coming down the barrel does not reach the sensor at all while you compose: a mirror parked at 45° throws all of it straight up onto a sheet of ground glass, the focusing screen. Above that sits a solid lump of glass, the pentaprism, which folds the image twice more — undoing the flip and the left-right swap — and posts it out of the eyepiece. Whatever the lens sees, your eye sees. Nothing is being simulated.',
      hint: 'Reflex: the whole camera is named after that mirror.',
      camera: { position: [4.6, 2.6, 2.6], target: [0, 1.25, 1.3] },
      dofAperture: 0.00004,
      focus: ['Reflex mirror', 'Pentaprism'],
      onEnter: pin(1, 'internal'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4200,
          ease: 'linear',
          onUpdate: () => handles.set({ cycle: 0, flow: s.t }),
        });
      },
    },
    {
      heading: '3 · The clack',
      body: 'Press the button and that comfortable arrangement is demolished. The mirror slaps up out of the light path and your viewfinder goes black — you never see the picture you are taking. The first curtain then drops to uncover the sensor, the second curtain follows to cover it again, both are wound back up, and the mirror falls home. Two of those noises, close enough together to hear as one: that is the clack.',
      hint: 'The blackout is not a fault — the mirror is standing between you and the shot.',
      camera: { position: [3.0, 1.95, 2.1], target: [0.05, 1.1, 0.05] },
      dofAperture: 0.00008,
      focus: ['Reflex mirror', 'First curtain', 'Second curtain'],
      onEnter: pin(1, 'shutter'),
      timeline: exposure(4600),
    },
    {
      heading: '4 · Above 1/250 the sensor is never fully open',
      body: 'The curtains cannot be hurried much past about 1/250 of a second — that is flash sync, the fastest speed at which the whole frame is briefly uncovered at once. To go faster the camera cheats: it launches the second curtain before the first has finished, so the two travel together as a narrow slit scanning down the frame. Every strip of the sensor still gets the same short exposure, but no two strips get it at the same instant. Fire a flash now and it lights only the strip the slit happened to be over — the rest of the frame comes back as a black band.',
      hint: 'A 1/8000 slit can be under a millimetre wide.',
      camera: { position: [1.5, 1.35, 2.4], target: [-0.35, 1.05, -0.15] },
      dofAperture: 0.0001,
      focus: ['First curtain', 'Second curtain'],
      onEnter: pin(1, 'shutter', { fast: 1, rays: 0 }),
      timeline: exposure(3600, { fast: 1, rays: 0 }),
    },
    {
      heading: '5 · Counting photons, colour-blind',
      body: 'Behind the curtains is a grid of millions of photodiodes — buckets that turn arriving photons into a countable charge. A bucket cannot tell red light from blue, so each one wears a tiny colour filter, laid out in the Bayer mosaic: half of them green, a quarter red, a quarter blue, because your eye leans hardest on green. Every photosite therefore records exactly one colour and guesses the other two from its neighbours. When the shutter shuts, a readout sweeps down the grid, empties every bucket, and the count becomes a photograph.',
      hint: 'Half the "resolution" of your camera is green.',
      camera: { position: [2.6, 1.8, 2.2], target: [-0.35, 1.1, -0.1] },
      dofAperture: 0.0002,
      focus: ['Photodiode wells', 'Bayer filter'],
      onEnter: pin(1, 'sensor', { cycle: 0.4, macro: 1 }),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5400,
          ease: 'linear',
          // shutter held open on purpose: this step lives inside the exposure
          onUpdate: () =>
            handles.set({ cycle: 0.4, macro: 1, sense: s.t, flow: (s.t * 3) % 1 }),
        });
      },
    },
    {
      heading: 'Run it',
      body: 'Shell closed, the whole chain again: the iris meters the light, the mirror hands the view to your eye and then gets out of the way, two curtains carve one slice of time out of everything the lens can see, and a few million colour-blind buckets count what falls in. Mirror, blades, curtains, silicon — one press, and it all finishes before your finger is off the button.',
      hint: 'Drag to orbit.',
      camera: { position: [-4.4, 2.9, 4.8], target: [-0.3, 1.1, 0.2] },
      dofAperture: 0.00003,
      freeOrbit: true,
      onEnter: pin(0, false),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5600,
          ease: 'linear',
          onUpdate: () =>
            handles.set({
              // a wide sway rather than a full turn: a full revolution parks
              // the finale on the back panel half the time, and every frame of
              // the last step should be a hero frame
              spin: Math.sin(s.t * TAU) * 0.34,
              cycle: s.t * 2, // exactly two complete exposures per lap
              iris: 0.5 - 0.5 * Math.cos(s.t * TAU),
            }),
        });
      },
    },
  ],
});
