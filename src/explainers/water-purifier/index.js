import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildWaterPurifier } from './model.js';

// The story follows the water's path through the 4 stages:
//   Step 1: The full system (solid)
//   Step 2: Pre-filters (Sediment & Carbon)
//   Step 3: Booster Pump
//   Step 4: RO Membrane (ghost reveal of the inner spiral)
//   Step 5: Pure vs Waste split
//   Step 6: Free orbit
//
// A single timeline runs the water flow seamlessly. One lap is 0→1.

function run(duration) {
  return ({ tl, handles }) => {
    const s = { flow: 0 };
    tl.add(s, {
      flow: 1,
      duration,
      ease: 'linear',
      onUpdate: () => handles.setFlow(s.flow),
    });
  };
}

const view = (reveal, labels) => ({ handles }) => {
  handles.setReveal(reveal);
  handles.setLabels(labels);
};

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildWaterPurifier({ scene });
  },

  steps: [
    {
      id: 'system',
      heading: '1 · The complete system',
      body: 'Most tap water isn\'t as clean as it looks. A reverse osmosis (RO) system takes standard tap water and strips it down to pure H₂O molecules. It\'s not just one filter, but a gauntlet of four distinct stages: physical pre-filters, chemical absorbers, a high-pressure pump, and a microscopic membrane. Watch the water flow through the tubes — the brown dots represent raw, unfiltered tap water entering the system.',
      hint: 'Drag to orbit · scroll to continue.',
      camera: { position: [1.2, 2.5, 5.0], target: [-0.1, 1.2, 0] },
      onEnter: view(0, true),
      timeline: run(6000),
    },
    {
      id: 'prefilters',
      heading: '2 · The pre-filters',
      body: 'Before water reaches the sensitive RO membrane, it must be pre-cleaned. First, the sediment filter (left, white) traps physical dirt, sand, and rust. Next, the carbon block (right, black) absorbs chlorine and chemicals that would dissolve the delicate membrane later on. Notice how the brown raw water turns clear as it passes these first two stages — but dissolved invisible solids remain.',
      camera: { position: [-0.6, 0.7, 2.5], target: [-0.4, 0.7, 0] },
      onEnter: view(0, false),
      timeline: run(4000),
    },
    {
      id: 'pump',
      heading: '3 · The booster pump',
      body: 'In natural osmosis, water flows toward the dirty side to balance it out. To reverse that, we need immense pressure. The booster pump takes the clear (but still mineral-heavy) water from the carbon filter and pressurizes it to over 80 PSI. Without this pump, the system would merely trickle, or fail to push water through the membrane at all.',
      camera: { position: [0.9, 0.7, 2.0], target: [0.6, 0.6, 0] },
      onEnter: view(0, false),
      timeline: run(4000),
    },
    {
      id: 'membrane',
      heading: '4 · The RO membrane',
      body: 'This is the heart of the system. The high-pressure water enters a spiral-wound semi-permeable membrane. Its pores are about 0.0001 microns wide — just large enough for a water molecule to squeeze through, but too small for heavy metals, salts, bacteria, and viruses. Only the pure water makes it to the center collection tube.',
      hint: 'The housing is ghosted to reveal the spiral membrane.',
      camera: { position: [0.4, 1.8, 2.0], target: [0, 1.6, 0] },
      onEnter: view(1, false),
      timeline: run(4000),
    },
    {
      id: 'split',
      heading: '5 · Pure and waste',
      body: 'Because the membrane blocks contaminants, the water left on the outside gets increasingly dirty. If it stayed there, it would instantly clog the pores. So an RO system splits the flow: pure blue water (permeate) goes to your drinking tank, while a continuous stream of concentrated dirty water (waste) is flushed down the drain to keep the membrane clean. For every gallon you drink, a typical system flushes three down the drain.',
      camera: { position: [-1.4, 1.8, 1.5], target: [-1.2, 1.6, 0] },
      onEnter: view(1, false),
      timeline: run(4000),
    },
    {
      id: 'run',
      heading: 'The continuous cycle',
      body: 'Raw water in, sediment caught, chlorine absorbed, pressure boosted, solids stripped, and pure water separated from waste. This quiet, continuous cycle hums under millions of kitchen sinks, turning questionable tap water into something as pure as a mountain spring.',
      hint: 'Drag to orbit the running system.',
      camera: { position: [-1.5, 2.5, 4.0], target: [-0.1, 1.2, 0] },
      freeOrbit: true,
      onEnter: view(0, false),
      timeline: run(5000),
    },
  ],
});
