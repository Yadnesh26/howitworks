import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildSpeaker } from './model.js';

// Every step loops while active. Seamlessness rule: the coil's drive phase
// advances a WHOLE number of 2π cycles per lap and the wave phase a whole
// number of laps, so each loop wrap lands on an identical pose.

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildSpeaker({ scene });
  },

  steps: [
    {
      id: 'anatomy',
      heading: 'The anatomy',
      body: 'A speaker driver is a simple electric motor that runs in a straight line. A stiff paper cone hangs in a metal basket; behind it a heavy magnet, and dropped into the magnet a lightweight coil of copper wire. Feed the coil the wiggling current from an amplifier and the cone punches the air — that pressure wave is the sound.',
      hint: 'Drag to orbit · scroll to dig in.',
      camera: { position: [3.0, 2.1, 4.4], target: [0, 1.4, 0] },
      onEnter: ({ handles }) => {
        handles.setCut(false);
        handles.setLabels(true);
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6000,
          ease: 'linear',
          onUpdate: () =>
            handles.set({ drive: s.t * Math.PI * 4, wave: (s.t * 2) % 1, on: true }),
        });
      },
    },
    {
      id: 'coil',
      heading: 'The voice coil',
      body: "The amplifier sends an alternating current through the coil, an exact copy of the sound waveform. Current one way makes the coil an electromagnet with its north pole up; reverse the current and it flips. Thousands of times a second, the coil's own magnetic field swings back and forth.",
      camera: { position: [2.6, 1.7, 1.5], target: [0, 1.4, -0.05] },
      onEnter: ({ handles }) => {
        handles.setCut(true);
        handles.setLabels(true);
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 2600,
          ease: 'linear',
          onUpdate: () =>
            handles.set({ drive: s.t * Math.PI * 6, wave: (s.t * 3) % 1, on: true }),
        });
      },
    },
    {
      id: 'motor',
      heading: 'Magnet vs. coil',
      body: 'The coil sits in a narrow gap where the permanent magnet packs a strong, steady field. Any wire carrying current through a magnetic field feels a force — current one way drives the coil straight up out of the gap, current the other way drives it straight back in. The magnet is heavy and fixed; the featherweight coil is what actually moves.',
      camera: { position: [3.0, 1.6, 1.7], target: [0, 1.35, -0.2] },
      onEnter: ({ handles }) => {
        handles.setCut(true);
        handles.setLabels(true);
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3000,
          ease: 'linear',
          onUpdate: () =>
            handles.set({ drive: s.t * Math.PI * 4, wave: (s.t * 2) % 1, on: true }),
        });
      },
    },
    {
      id: 'cone',
      heading: 'The cone moves air',
      body: 'The coil is glued to the cone, so every push and pull travels straight to the paper. Driven out, the cone shoves a puff of air forward and squeezes a high-pressure zone; pulled back, it leaves a low-pressure one behind. That chain of pressure highs and lows racing outward is exactly what your ear hears as sound.',
      camera: { position: [0.6, 1.9, 4.4], target: [0, 1.5, 0.4] },
      onEnter: ({ handles }) => {
        handles.setCut(false);
        handles.setLabels(false);
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3200,
          ease: 'linear',
          onUpdate: () =>
            handles.set({ drive: s.t * Math.PI * 4, wave: (s.t * 4) % 1, on: true }),
        });
      },
    },
    {
      id: 'suspension',
      heading: 'The suspension keeps it honest',
      body: 'Two springs hold everything in line. The rubber surround seals the cone rim to the basket; the corrugated cloth spider does the same down at the coil. Together they let the cone travel freely in and out but stop it wobbling sideways — so the coil never scrapes the gap and always returns to dead centre.',
      camera: { position: [2.8, 1.9, 2.7], target: [0, 1.55, 0.2] },
      onEnter: ({ handles }) => {
        handles.setCut(true);
        handles.setLabels(true);
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3400,
          ease: 'linear',
          onUpdate: () =>
            handles.set({ drive: s.t * Math.PI * 4, wave: (s.t * 2) % 1, on: true }),
        });
      },
    },
    {
      id: 'run',
      heading: 'Music, made of air',
      body: 'Real music is a blur of frequencies, so the current — and the cone — never settle into a single tone. Bass notes swing the cone in big slow strokes, treble in tiny fast flutters, all at once. From a wiggle of electricity to a wave you can feel: that is a loudspeaker.',
      hint: 'Drag to orbit while it plays.',
      camera: { position: [3.4, 2.2, 4.6], target: [0, 1.4, 0.2] },
      freeOrbit: true,
      onEnter: ({ handles }) => {
        handles.setCut(false);
        handles.setLabels(false);
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5000,
          ease: 'linear',
          onUpdate: () =>
            handles.set({ drive: s.t * Math.PI * 8, wave: (s.t * 6) % 1, on: true }),
        });
      },
    },
  ],
});
