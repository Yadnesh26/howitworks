import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildAirConditioner } from './model.js';

// Every step runs the cycle as a loop while active: the refrigerant advances
// exactly one full lap per timeline lap and the fan a whole number of turns
// (multiples of 5 turns keep the ×1.6-geared blower roller seamless too), so
// the wrap is invisible. The camera provides each step's focus.
// (handles.phases still exposes the chain's segment fractions — kept for a
// future P-h diagram overlay.)
function cycleRun({ hotAir = 0, coldAir = 0, duration = 10000 }) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () =>
        handles.set({
          flow: s.t,
          spin: s.t * Math.PI * 10,
          hotAir,
          coldAir,
        }),
    });
  };
}

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildAirConditioner({ scene });
  },

  steps: [
    {
      id: 'overview',
      heading: 'The anatomy',
      body: 'A split air conditioner is two boxes joined by two pipes. On the wall inside: the indoor unit — a coil and a long roller blower. On the ground outside: the outdoor unit — the compressor, a coil wrapped in fins, and a big fan. One sealed charge of refrigerant shuttles between them, changing from gas to liquid and back, ferrying heat from the room to the outside air.',
      hint: 'Drag to orbit · scroll to follow the refrigerant.',
      camera: { position: [3.4, 2.2, 5.6], target: [0.3, 1.6, -0.3] },
      onEnter: ({ handles }) => handles.setLabels(true),
      timeline: cycleRun({ duration: 16000 }),
    },
    {
      id: 'compressor',
      heading: '1 · The compressor',
      body: 'Inside the outdoor unit sits the heart of the machine: a black hermetic dome that squeezes cool low-pressure vapour into scorching high-pressure vapour. Compression concentrates the heat the refrigerant picked up indoors — it leaves the dome hotter than the summer air outside, which is exactly what it needs to be to give that heat away.',
      camera: { position: [2.7, 1.1, 2.0], target: [0.85, 0.7, -0.7] },
      onEnter: ({ handles }) => handles.setLabels(false),
      timeline: cycleRun({}),
    },
    {
      id: 'condenser',
      heading: '2 · The condenser',
      body: 'The hot vapour snakes back and forth through the condenser coil — the finned wall of the outdoor unit — while the fan drags outside air through it. Hotter than that air, the refrigerant pours its heat out (the warm gust off every outdoor unit) and condenses into a warm high-pressure liquid. A small filter drier then strains out moisture and grit before the next stage.',
      camera: { position: [0.4, 1.4, 3.4], target: [0, 0.95, -0.5] },
      onEnter: ({ handles }) => handles.setLabels(false),
      timeline: cycleRun({ hotAir: 1 }),
    },
    {
      id: 'capillary',
      heading: '3 · The capillary tube',
      body: 'The warm liquid now fights its way through metres of hair-thin copper wound into a tight coil. Squeezing through costs it nearly all its pressure — and a fluid that suddenly loses pressure gets dramatically cold. Part of it flashes to vapour, chilling the whole stream far below room temperature before it heads up the wall.',
      camera: { position: [3.0, 0.9, 1.5], target: [1.5, 0.6, -0.55] },
      onEnter: ({ handles }) => handles.setLabels(false),
      timeline: cycleRun({ hotAir: 1, duration: 12000 }),
    },
    {
      id: 'evaporator',
      heading: '4 · The evaporator',
      body: 'Up in the indoor unit, the icy refrigerant weaves through the evaporator coil while the long cross-flow blower pulls room air across the fins. Being colder than the room, it soaks up heat and boils back into a gas — and the air, robbed of that heat, washes out of the louver cold. The gas rides the fat insulated pipe back down to the compressor, and the lap begins again.',
      camera: { position: [1.0, 3.0, 3.6], target: [0.45, 2.4, 0] },
      onEnter: ({ handles }) => handles.setLabels(false),
      timeline: cycleRun({ hotAir: 1, coldAir: 1 }),
    },
    {
      id: 'run',
      heading: 'The cycle runs',
      body: 'Compress, condense, choke, evaporate — the same refrigerant lapping between the two units, hundreds of times a minute. Each lap hauls another load of heat from the room to the outside air. Keep the loop turning and the room keeps cooling; that is all an air conditioner ever does.',
      hint: 'Drag to orbit the running system.',
      camera: { position: [4.2, 2.6, 5.8], target: [0.3, 1.6, -0.3] },
      freeOrbit: true,
      onEnter: ({ handles }) => handles.setLabels(false),
      timeline: cycleRun({ hotAir: 1, coldAir: 1, duration: 9200 }),
    },
  ],
});
