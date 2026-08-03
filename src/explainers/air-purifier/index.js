import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildPurifier } from './model.js';

// Zoom-in / reveal story: sealed tower, then ghost the side wall to show the
// concentric filter cartridge (pre-filter -> HEPA -> carbon -> hollow core)
// and the centrifugal blower above it, then the sensor/auto-mode feedback
// loop, then re-solidify for a fast finale.
//
// Seamless loops: `flow` advances a WHOLE number of cycles per lap (every
// dot's phase is `(flow + seed) % 1`); `fanSpin` advances whole turns; `aqi`
// uses a raised-cosine breathe (0.5 - 0.5*cos(u*TAU)) so it starts and ends
// each lap at the same value without needing a modulo.

const TAU = Math.PI * 2;

const pin =
  (reveal, labels, { aqi = 0.15 } = {}) =>
  ({ handles }) => {
    handles.set({ reveal, flow: 0, fanSpin: 0, aqi });
    handles.setLabels(labels);
  };

const breathe = (u) => 0.5 - 0.5 * Math.cos(u * TAU);

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildPurifier({ scene });
  },

  steps: [
    {
      id: 'sealed',
      heading: '1 · A sealed tower',
      body: 'From the outside, an air purifier is just a quiet cylinder: a ring of intake slots running all the way around, a grille on top, and a status ring that glows a color for the air quality it senses. Every stage of the actual filtering happens hidden inside.',
      hint: 'Drag to orbit · scroll to look inside.',
      camera: { position: [2.5, 1.85, 2.9], target: [0, 1.15, 0.15] },
      dofAperture: 0.00003,
      onEnter: pin(0, 'exterior'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, { t: 1, duration: 5500, ease: 'linear', onUpdate: () => handles.set({ flow: s.t }) });
      },
    },
    {
      id: 'reveal',
      heading: '2 · Behind the wall',
      body: 'Lift the side wall away and it is really just one cartridge and one fan: a cylinder of filter media wrapped around a hollow core, with a small blower sitting above it to pull air up and out.',
      // raised well above the cartridge and angled down — the fan sits behind
      // the always-opaque top grille's silhouette from a low viewpoint even
      // though the collar around it correctly ghosts (reviewer-caught: the
      // step's own "a small blower sitting above it" claim wasn't visible in
      // its own frame). Looking down past the grille's edge is what step 5
      // does successfully; this reuses that logic at a wider, establishing scale.
      camera: { position: [1.5, 2.35, 1.85], target: [0, 1.7, 0.05] },
      dofAperture: 0.00006,
      onEnter: pin(1, false),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, { t: 1, duration: 5000, ease: 'linear', onUpdate: () => handles.set({ flow: s.t }) });
      },
    },
    {
      id: 'filter',
      heading: '3 · Pre-filter and HEPA strip the big stuff',
      body: 'Air is pulled in radially from all 360° around the tower. A fine mesh sock catches hair, fibers and large dust first — cheap insurance that protects the real work happening just behind it. That layer is a pleated HEPA H13 filter, folded like an accordion to pack far more surface area into the same cylinder: it captures 99.97% of particles down to 0.3 micron, the hardest size to trap, by physically intercepting and colliding with them in its dense fiber mesh.',
      hint: 'Looking down into the cartridge — debris stops at each layer.',
      camera: { position: [0.5, 2.45, 0.62], target: [0.08, 1.73, 0.05] },
      dofAperture: 0.00012,
      onEnter: pin(1, 'filter'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3400,
          ease: 'linear',
          onUpdate: () => handles.set({ flow: s.t, fanSpin: s.t * TAU * 3 }),
        });
      },
    },
    {
      id: 'carbon',
      heading: '4 · Activated carbon pulls out the smell',
      body: 'HEPA media is superb at catching solid particles, but it does nothing for gases. Just behind it, a layer of activated carbon — a material so porous a single gram can have the surface area of a tennis court — adsorbs odor and VOC molecules straight out of the air, leaving them stuck to its surface instead of drifting into the room.',
      camera: { position: [0.28, 2.15, 0.32], target: [0, 1.74, 0] },
      dofAperture: 0.00015,
      onEnter: pin(1, 'carbon'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3000,
          ease: 'linear',
          onUpdate: () => handles.set({ flow: s.t, fanSpin: s.t * TAU * 3 }),
        });
      },
    },
    {
      id: 'fan',
      heading: '5 · The blower pulls it all through',
      body: 'None of this happens on its own — a centrifugal blower above the cartridge is what drags air up through every one of those layers, then flings it sideways and out through the top grille. It is the one part of the system that never stops moving.',
      camera: { position: [0.85, 2.18, 0.98], target: [0, 1.94, 0] },
      dofAperture: 0.00012,
      onEnter: pin(1, 'fan'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 2400,
          ease: 'linear',
          onUpdate: () => handles.set({ flow: s.t * 1.3, fanSpin: s.t * TAU * 6 }),
        });
      },
    },
    {
      id: 'sensor',
      heading: '6 · A sensor drives the whole response',
      body: 'A laser particle sensor near the base constantly samples the incoming air, counting how much it scatters light to estimate PM2.5 pollution in real time. Auto mode uses that reading to speed the fan up when the air is dirty and let it idle quiet when it is clean — and the ring on top reports the same number back to you, in color: blue and green for clean air, climbing to yellow and red as it gets worse.',
      hint: 'Watch the ring and the fan respond together.',
      camera: { position: [1.75, 1.6, 1.95], target: [0, 1.1, 0.1] },
      dofAperture: 0.00012,
      onEnter: pin(1, 'sensor'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4600,
          ease: 'linear',
          onUpdate: () => {
            const aqi = breathe(s.t);
            handles.set({ flow: s.t, fanSpin: s.t * TAU * (3 + aqi * 6), aqi });
          },
        });
      },
    },
    {
      id: 'run',
      heading: '7 · Five layers, one continuous pull',
      body: 'Mesh, HEPA, carbon, a blower, and a sensor watching all of it — sealed back up, it goes back to being a quiet cylinder in the corner of a room, quietly doing all of that on every breath of air that passes through.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [2.4, 1.7, 2.8], target: [0, 1.05, 0.15] },
      dofAperture: 0.00003,
      freeOrbit: true,
      onEnter: pin(0, false),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 2600,
          ease: 'linear',
          onUpdate: () => handles.set({ flow: s.t * 2, fanSpin: s.t * TAU * 4 }),
        });
      },
    },
  ],
});
