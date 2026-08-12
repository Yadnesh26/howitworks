import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildAudioChain } from './model.js';

// Every step loops while active. Seamlessness: `phase` counts WAVE CYCLES and
// each lap advances it by a whole number, so the travelling trace, both
// diaphragms and both transistor glows — all derived from the same wave()
// function — land on an identical pose at the wrap. The counts are ODD and not
// multiples of 5 (7, 9): an even count makes each half-lap an exact repeat, and
// 5/lap puts every probe and review pose exactly on a sine zero, so the whole
// scene reads as frozen to verify.mjs and to the reviewer's screenshots. `wave` (sound rings) and
// `railPhase` (supply current) wrap mod 1; `sway` runs one whole sine cycle.
//
// Every onEnter calls handles.pin(), which resets EVERY scalar to its default
// before merging the step's values, so no step inherits the previous step's
// mid-lap phase or turntable angle.

export default defineExplainer({
  ...meta,

  buildScene({ scene, stage }) {
    return buildAudioChain({ scene, stage });
  },

  stageOptions: { dof: true },

  steps: [
    {
      id: 'chain',
      heading: 'Three machines, one wave',
      body: 'A voice goes in at one end and comes out the other loud enough to fill a room, and nothing in between has any idea what a voice is. The microphone turns moving air into a current so faint it could not light anything. The amplifier does not enlarge that current — it uses it to steer power drawn from the wall. The speaker turns the result back into moving air.',
      hint: 'Drag to orbit · scroll to follow the signal.',
      camera: { position: [2.6, 3.1, 8.9], target: [-1.55, 0.95, 0.05] },
      dofAperture: 0.00003,
      onEnter: ({ handles }) => {
        handles.pin({ micWaves: 1, spkWaves: 1 });
        handles.setLabels('chain');
      },
      focus: ['Microphone', 'Speaker cable', 'Amplifier', 'Speaker'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 7000,
          ease: 'linear',
          onUpdate: () =>
            handles.set({
              phase: s.t * 7,
              wave: (s.t * 3) % 1,
              sway: Math.sin(s.t * Math.PI * 2) * 0.055,
            }),
        });
      },
    },
    {
      id: 'capsule',
      heading: 'A microphone is a speaker running backwards',
      body: 'Inside the ball is a capsule barely a centimetre across. A polyester film about half the thickness of a hair carries a coil of hair-fine copper glued to its back, and that coil hangs in the narrow gap of a small permanent magnet. Sound is nothing but air pressure rising and falling, and pressure pushes the film. The coil goes with it — and a conductor moved through a magnetic field develops a voltage across its ends. Close speech gets you a few thousandths of a volt. That is the entire signal.',
      camera: { position: [-2.09, 2.61, 1.72], target: [-3.2, 2.01, 0.43] },
      dofAperture: 0.00034,
      onEnter: ({ handles }) => {
        // no incoming rings here: at this angle the camera looks almost
        // edge-on to the mic axis, so they project as bare diagonal lines. The
        // arriving sound is established in step 1; the diaphragm carries it here.
        handles.pin({ micCut: 1 });
        handles.setLabels('mic');
      },
      focus: ['Diaphragm', 'Voice coil', 'Magnet'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3600,
          ease: 'linear',
          onUpdate: () => handles.set({ phase: s.t * 7, wave: (s.t * 3) % 1 }),
        });
      },
    },
    {
      id: 'preamp',
      heading: 'First, make it bigger',
      body: 'Two thousandths of a volt will not move anything, so the first thing inside the amplifier is a preamp, and its entire job is voltage. One transistor, biased so that a tiny wiggle at its input produces a much larger copy of the same wiggle at its output. Forty to sixty decibels of gain — a hundred to a thousand times — takes the microphone up to line level, around a volt, which is what the rest of the audio world assumes it will be handed.',
      hint: 'The trace is drawn compressed: the real step up is far bigger than it looks.',
      camera: { position: [0.6, 2.73, 2.16], target: [-1.04, 0.5, 0.63] },
      dofAperture: 0.00018,
      onEnter: ({ handles }) => {
        handles.pin({ ampOpen: 1 });
        handles.setLabels('pre');
      },
      focus: ['Input jack', 'Preamp transistor'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3200,
          ease: 'linear',
          onUpdate: () => handles.set({ phase: s.t * 7 }),
        });
      },
    },
    {
      id: 'supply',
      heading: 'Where the loudness actually comes from',
      body: 'Here is the part that catches people out: an amplifier never makes your signal bigger. It cannot — the energy has to come from somewhere. What it really does is sit between the wall socket and the speaker like a tap, and let the incoming waveform decide how far to open. The transformer steps the mains down, and these two capacitors hold it as a stiff reservoir of current, ready. The signal is only the hand on the tap.',
      camera: { position: [1.07, 2.37, 2.32], target: [-1.36, 0.62, 0.36] },
      dofAperture: 0.00014,
      onEnter: ({ handles }) => {
        handles.pin({ ampOpen: 1, rail: 1 });
        handles.setLabels('psu');
      },
      focus: ['Power transformer', 'Reservoir capacitors', 'Supply rail'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4000,
          ease: 'linear',
          onUpdate: () => handles.set({ phase: s.t * 7, railPhase: s.t }),
        });
      },
    },
    {
      id: 'pushpull',
      heading: 'Two transistors, taking turns',
      body: 'The output stage is a pair of transistors across that supply, and they split the waveform between them. Swing positive and the upper one opens and pushes current out to the speaker; swing negative and the lower one opens and pulls it back. Each is asleep for half of every cycle, which is exactly why the stage runs cool enough to fit in a box this size. Left fully off between turns, neither would wake until its input passed six-tenths of a volt, and every time the wave crossed zero it would reach the speaker with a notch cut out of it. So both are held just barely conducting through the handover — a trickle of idle current that costs a little heat and buys a clean crossing.',
      camera: { position: [-1.4, 2.0, 2.3], target: [-0.45, 0.62, -0.86] },
      dofAperture: 0.00024,
      onEnter: ({ handles }) => {
        handles.pin({ ampOpen: 1, rail: 1 });
        handles.setLabels('power');
      },
      focus: ['Push transistor (NPN)', 'Pull transistor (PNP)', 'Output node'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3000,
          ease: 'linear',
          onUpdate: () => handles.set({ phase: s.t * 7, railPhase: s.t }),
        });
      },
    },
    {
      id: 'driver',
      heading: 'The same trick, run the other way',
      body: 'The speaker is the capsule mirrored and scaled up: the same three parts — coil, magnet, diaphragm — but now the current arrives first and the air moves last. Current through a coil sitting in a magnet gap produces a force, the force drives the cone, and the cone shoves on the room. What started this chain was a few millionths of a watt coming off a film you could see through. What lands here is tens of watts.',
      camera: { position: [4.29, 1.82, 1.69], target: [2.14, 1.08, 1.27] },
      dofAperture: 0.00009,
      onEnter: ({ handles }) => {
        handles.pin({ spkCut: 1, spkWaves: 1, ringK: 0.4 });
        handles.setLabels('spk');
      },
      focus: ['Voice coil', 'Cone', 'Magnet'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3400,
          ease: 'linear',
          onUpdate: () => handles.set({ phase: s.t * 7, wave: (s.t * 3) % 1 }),
        });
      },
    },
    {
      id: 'run',
      heading: 'A copy, built out of wall power',
      body: 'Close it all up and the whole chain is three magnets and a fistful of transistors. The wave leaving the speaker is not the one that arrived at the microphone — that one is long gone, spent moving a film a fraction of a hair. This is a fresh wave, cut from mains electricity and shaped to match. Everything in between exists to make the copy close enough that your ear cannot tell.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [1.5, 1.8, 9.2], target: [-1.8, 0.92, 0.12] },
      freeOrbit: true,
      dofAperture: 0.00003,
      onEnter: ({ handles }) => {
        handles.pin({ micWaves: 1, spkWaves: 1 });
        handles.setLabels(false);
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5200,
          ease: 'linear',
          onUpdate: () =>
            handles.set({
              phase: s.t * 9,
              wave: (s.t * 3) % 1,
              sway: Math.sin(s.t * Math.PI * 2) * 0.05,
            }),
        });
      },
    },
  ],
});
