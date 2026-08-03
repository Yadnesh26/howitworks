import { defineExplainer } from '../../framework/index.js';
import { clamp01 } from '../../framework/motion.js';
import meta from './meta.js';
import { buildGps } from './model.js';

// Every step loops while active: `phase` sweeps 0->1 once per lap, driving
// the solar-panel tracking wobble (and, where visible, orbit motion / beam
// dots / clock hands) — all seamless since every derived motion is either a
// whole-turn multiple of the lap or a sin() of a whole-turn multiple.
function run({ duration }) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () => handles.set({ phase: s.t }),
    });
  };
}

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildGps({ scene });
  },

  steps: [
    {
      id: 'overview',
      heading: '1 · One receiver, a sky full of satellites',
      body: 'At least 24 satellites orbit Earth in six tilted planes, roughly 20,200 km up — about 4x Earth\'s own radius — circling twice a day. Every one of them is constantly broadcasting its own position and the time. Your phone never talks back; it just has to listen.',
      hint: 'Drag to orbit the constellation.',
      camera: { position: [5.0, 4.6, 10.5], target: [0.3, 3.0, 0.3] },
      onEnter: ({ handles }) => {
        handles.set({
          swarmOn: 1, heroOn: [0, 0, 0, 0], capOn: [0, 0, 0, 0], navOn: 0, biasAmt: 0, clockAmt: 0, fixOn: 0, fixLocked: 0,
        });
        handles.setLabels('overview');
      },
      timeline: run({ duration: 7000 }),
    },
    {
      id: 'satellite',
      heading: '2 · Inside one satellite',
      body: 'Each satellite is a bus roughly the size of a delivery van, powered by solar wings that slowly rotate to keep facing the sun. It broadcasts continuously on L1 (1575.42 MHz) — the frequency almost every phone listens on — through an antenna array aimed straight down at Earth (nadir), driven by an onboard atomic clock accurate to nanoseconds.',
      camera: { position: [0.46, 3.88, 3.78], target: [-0.84, 3.63, 2.68] },
      onEnter: ({ handles }) => {
        handles.set({
          swarmOn: 0, heroOn: [1, 0, 0, 0], capOn: [0, 0, 0, 0], navOn: 0, biasAmt: 0, clockAmt: 0, fixOn: 0, fixLocked: 0,
        });
        handles.setLabels('satellite');
      },
      timeline: run({ duration: 4000 }),
    },
    {
      id: 'signal',
      heading: '3 · The message: "I am here, and it is now"',
      body: 'Every satellite repeats the same simple broadcast: a unique code identifying which satellite this is (so all of them can share one frequency at once), its own precise orbital position — its ephemeris — and the exact instant it sent the signal. Nothing more is needed; everything else is arithmetic.',
      camera: { position: [1.5, 4.08, 4.66], target: [-0.84, 3.63, 2.68] },
      onEnter: ({ handles }) => {
        handles.set({
          swarmOn: 0, heroOn: [1, 0, 0, 0], capOn: [0, 0, 0, 0], navOn: 1, biasAmt: 0, clockAmt: 0, fixOn: 0, fixLocked: 0,
        });
        handles.setLabels('signal');
      },
      timeline: run({ duration: 4000 }),
    },
    {
      id: 'pseudorange',
      heading: '4 · Timing the signal = measuring a distance',
      body: 'Radio waves travel at the speed of light — about 300,000 km per second — so the receiver just measures how long the signal took to arrive and multiplies by c. That gives a distance, but not yet a direction: every point exactly that far from the satellite forms a sphere, and the receiver could be anywhere on its surface.',
      camera: { position: [1.6, 4.3, 3.0], target: [0.1, 3.5, 1.0] },
      onEnter: ({ handles }) => {
        handles.set({
          swarmOn: 0, heroOn: [1, 0, 0, 0], capOn: [1, 0, 0, 0], navOn: 0, biasAmt: 0, clockAmt: 0, fixOn: 0, fixLocked: 0,
        });
        handles.setLabels('pseudorange');
      },
      timeline: run({ duration: 3500 }),
    },
    {
      id: 'trilaterate',
      heading: '5 · Three spheres, one point',
      body: 'Add a second satellite and its sphere intersects the first in a circle. Add a third and that circle collapses to just two points — one of them absurd (out in space, or inside the Earth), leaving one sensible fix. In principle, three ranges are almost enough — watch the readout on the receiver below: it already has a rough coordinate, just not a trustworthy one yet.',
      camera: { position: [4.85, 6.26, 7.97], target: [0.2, 3.56, 2.07] },
      onEnter: ({ handles }) => {
        handles.set({
          swarmOn: 0, heroOn: [1, 1, 1, 0], capOn: [1, 1, 1, 0], navOn: 0, biasAmt: 0, clockAmt: 0, fixOn: 1, fixLocked: 0,
        });
        handles.setLabels('trilaterate');
      },
      timeline: run({ duration: 4000 }),
    },
    {
      id: 'clockfix',
      heading: '6 · Why it actually takes four',
      body: 'The satellites carry atomic clocks; your receiver doesn\'t — its cheap quartz clock is off by some unknown amount, and that same error shifts every range by the same distance, blurring the fix. Watch the coordinate readout wobble as that error bites, then snap steady the instant a fourth satellite joins: that\'s the receiver solving for its position AND its own clock error at once. That\'s why a GPS fix needs a minimum of four satellites in view.',
      camera: { position: [5.23, 6.68, 8.8], target: [-0.02, 3.8, 2.05] },
      onEnter: ({ handles }) => {
        handles.set({
          swarmOn: 0, heroOn: [1, 1, 1, 1], capOn: [1, 1, 1, 0], navOn: 0, biasAmt: 0, clockAmt: 0, fixOn: 1, fixLocked: 0,
        });
        handles.setLabels('clockfix');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5000,
          ease: 'linear',
          onUpdate: () => {
            const t = s.t;
            const bt = clamp01(t / 0.4);
            const biasAmt = Math.sin(Math.PI * bt) * 0.5;
            const fadeIn = clamp01((t - 0.42) / 0.16);
            const fadeOut = clamp01((t - 0.85) / 0.15);
            const cap4 = clamp01(fadeIn - fadeOut);
            handles.set({
              phase: t, biasAmt, capOn: [1, 1, 1, cap4], fixLocked: cap4 > 0.5 ? 1 : 0,
            });
          },
        });
      },
    },
    {
      id: 'relativity',
      heading: '7 · Clocks that must agree — even with relativity',
      body: 'A one-microsecond timing error is about 300 meters of position error, so the satellite\'s atomic clock has to be almost perfectly precise. But orbiting fast, in weaker gravity, actually speeds an atomic clock up — by about 38 microseconds a day if left uncorrected, which would blow the fix by kilometers within hours. Engineers detune every satellite clock before launch to cancel it out exactly. (Wildly exaggerated here for visibility — 38 millionths of a second a day is invisible to the eye.)',
      // must stay in sync with STEP7_CAM in model.js (the clock props face this point)
      camera: { position: [1.368, 4.304, 4.885], target: [-0.84, 3.63, 2.68] },
      onEnter: ({ handles }) => {
        handles.set({
          swarmOn: 0, heroOn: [1, 0, 0, 0], capOn: [0, 0, 0, 0], navOn: 0, biasAmt: 0, clockAmt: 1, fixOn: 0, fixLocked: 0,
        });
        handles.setLabels('relativity');
      },
      timeline: run({ duration: 4000 }),
    },
    {
      id: 'run',
      heading: '8 · Running continuously, worldwide',
      body: 'This whole exchange — broadcast, listen, time, trilaterate — repeats about once a second, for every GPS receiver on Earth, all day, using nothing but radio waves and arithmetic. No signal ever goes back up to the satellites; they just keep talking. The payoff sits steady on the receiver below: an exact coordinate, handed to your phone for free.',
      hint: 'Drag to orbit the running constellation.',
      camera: { position: [-5.0, 4.6, 10.5], target: [0.3, 3.0, 0.3] },
      freeOrbit: true,
      onEnter: ({ handles }) => {
        handles.set({
          swarmOn: 1, heroOn: [0, 0, 0, 0], capOn: [0, 0, 0, 0], navOn: 0, biasAmt: 0, clockAmt: 0, fixOn: 1, fixLocked: 1,
        });
        handles.setLabels(null);
      },
      timeline: run({ duration: 3200 }),
    },
  ],
});
