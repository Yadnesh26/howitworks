import { defineExplainer } from '../../framework/index.js';
import { win } from '../../framework/motion.js';
import meta from './meta.js';
import { buildLithiumIonBattery } from './model.js';

// Every step loops while active. Seamlessness rule: every scalar in the
// model's local state (soc, shuttle, sei, dendrite, payoffT...) starts and
// ends its lap at the same value, or completes a whole number of cycles.

// Rise-then-quick-fall shape: 0 at t=0 and t=1, peaks at 1 around
// (1 - fallFrac). Used for anything that should read as "building up" across
// most of the lap but must still wrap seamlessly.
function ramp(t, fallFrac = 0.15) {
  const riseEnd = 1 - fallFrac;
  return t < riseEnd ? win(t, 0, riseEnd) : 1 - win(t, riseEnd, 1);
}
// Trapezoid: 0 -> 1 -> hold -> 0, seamless at both ends. Used for anything
// that should visibly grow, be READ, then recede before the wrap.
function trapezoid(t, riseEnd = 0.15, fallStart = 0.85) {
  return Math.min(win(t, 0, riseEnd), 1 - win(t, fallStart, 1));
}

const PIN = { shuttle: 0, dir: 1, soc: 0.5, sei: 0, dendrite: 0, payoffT: 0, unroll: 0, statusCharge: 0 };

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildLithiumIonBattery({ scene });
  },

  steps: [
    {
      id: 'anatomy',
      heading: '1 · The cell',
      body: 'This is a rechargeable lithium-ion cell in the classic 18650 format — 18mm across, 65mm tall, the same size cell behind laptops, power banks and most EVs. It is not a fuel tank: nothing inside gets burned or used up. It is a container for two electrodes and a shuttle of lithium ions that crosses between them, back and forth, thousands of times.',
      hint: 'Drag to orbit · scroll to look inside.',
      camera: { position: [2.0, 2.15, 3.05], target: [0, 1.35, 0] },
      dofAperture: 0.00003,
      focus: ['Button top — the POSITIVE terminal'],
      onEnter: ({ handles }) => {
        handles.set(PIN);
        handles.setView('assembled');
        handles.setLabels('exterior');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6500,
          ease: 'linear',
          onUpdate: () => handles.set({ statusCharge: 0.15 + 0.15 * (1 + Math.sin(s.t * Math.PI * 2)) }),
        });
      },
    },
    {
      id: 'roll',
      heading: '2 · Inside: the jelly roll',
      body: "Peel the steel can away and it is one long sandwich, wound tight: an aluminum foil coated with a layered lithium metal oxide (the cathode), a copper foil coated with graphite (the anode), and a porous separator between them, the whole thing soaked in liquid electrolyte. Winding it packs an enormous amount of electrode surface into a can you can close your hand around.",
      camera: { position: [1.55, 1.7, 1.95], target: [0, 1.33, 0] },
      dofAperture: 0.00005,
      focus: ['Porous separator, soaked in electrolyte'],
      onEnter: ({ handles }) => {
        handles.set(PIN);
        handles.setView('roll');
        handles.setLabels('roll');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4600,
          ease: 'linear',
          onUpdate: () => handles.set({ unroll: (0.12 * (1 + Math.sin(s.t * Math.PI * 2))) / 2 }),
        });
      },
    },
    {
      id: 'charge',
      heading: '3 · Charging: ions leave the cathode',
      body: "Plug in a charger and it pulls lithium ions out of the cathode's layered lattice. They cross the electrolyte, slip through the separator's pores, and wedge themselves between the graphite anode's stacked layers — intercalation. Electrons cannot make that crossing, so they take the only other path: out through the wire, around the external circuit, back in at the anode. That electron flow through the wire IS the charging current.",
      camera: { position: [1.55, 2.05, 2.75], target: [0, 1.55, 0] },
      dofAperture: 0.00007,
      focus: ['External circuit — the charging current'],
      onEnter: ({ handles }) => {
        handles.set({ ...PIN, dir: 1 });
        handles.setView('schematic');
        handles.setLabels('charge');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4000,
          ease: 'linear',
          onUpdate: () => handles.set({ shuttle: s.t * 3, dir: 1, soc: 0.25 + 0.6 * ramp(s.t) }),
        });
      },
    },
    {
      id: 'discharge',
      heading: '4 · Discharge: the same shuttle, reversed',
      body: "Unplug it and use the phone, and the whole thing runs backward: ions leave the graphite layers and drift back to the cathode, while electrons flow anode to cathode through the external circuit again — only now that circuit is your phone, and those electrons ARE the power. Nothing was consumed on the trip either way. A lithium-ion cell does not get 'used up' like fuel; it moves the same ions across the same gap, again and again.",
      camera: { position: [1.55, 2.05, 2.75], target: [0, 1.55, 0.05] },
      dofAperture: 0.00007,
      focus: ['External circuit — powers your phone'],
      onEnter: ({ handles }) => {
        handles.set({ ...PIN, dir: -1, soc: 0.85 });
        handles.setView('schematic');
        handles.setLabels('discharge');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4000,
          ease: 'linear',
          onUpdate: () => handles.set({ shuttle: s.t * 3, dir: -1, soc: 0.85 - 0.6 * ramp(s.t) }),
        });
      },
    },
    {
      id: 'ageing',
      heading: '5 · Ageing: the price of staying full',
      body: "Every trip across that gap leaves a little residue. On the anode, a film called the SEI layer forms and keeps thickening, quietly eating capacity and raising resistance. On the cathode, staying above roughly 4.1 volts — about 80% state of charge — puts the lattice under real structural stress and speeds up electrolyte breakdown. Neither is dramatic in one charge. Parked at 100% for hours, every day, they add up.",
      camera: { position: [1.0, 1.75, 1.65], target: [0.15, 1.4, 0] },
      dofAperture: 0.00018,
      focus: ['SEI film — thickens, eats capacity'],
      onEnter: ({ handles }) => {
        handles.set({ ...PIN, dir: 1, soc: 0.9 });
        handles.setView('schematic');
        handles.setLabels('ageing');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4600,
          ease: 'linear',
          onUpdate: () =>
            handles.set({
              shuttle: s.t * 1,
              dir: 1,
              soc: 0.915 + 0.065 * Math.sin(s.t * Math.PI * 4),
              sei: trapezoid(s.t, 0.15, 0.8),
            }),
        });
      },
    },
    {
      id: 'dendrite',
      heading: '6 · Fast, cold charging: plating instead of intercalation',
      body: "Charge too fast, or charge a cold cell, and lithium ions arrive at the anode faster than they can slot cleanly between the graphite layers. Some plate out as metallic lithium on the surface instead — a reaction that does not reverse. Enough of it grows into microscopic dendrites reaching back across the gap, and a dendrite that reaches the cathode side punches through the separator and shorts the cell. That is the mechanism behind the battery-fire stories.",
      camera: { position: [0.35, 1.55, 1.4], target: [0.1, 1.35, 0] },
      dofAperture: 0.00018,
      focus: ['Lithium plating — fast/cold charging'],
      onEnter: ({ handles }) => {
        handles.set({ ...PIN, dir: 1, soc: 0.85, sei: 0 });
        handles.setView('schematic');
        handles.setLabels('dendrite');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4200,
          ease: 'linear',
          onUpdate: () =>
            handles.set({
              shuttle: s.t * 1,
              dir: 1,
              sei: 0,
              dendrite: trapezoid(s.t, 0.15, 0.75),
            }),
        });
      },
    },
    {
      id: 'payoff',
      heading: '7 · Why 20-80% roughly triples the cycles',
      body: "Cycle a cell between about 20% and 80% and it barely visits the high-stress top of its voltage range — no long stretches above ~4.1V, and no deep dips near empty either. Do that instead of habitually charging to 100% and it can take a cell from around 500 full cycles to 1500 or more before it noticeably fades: roughly three times the working life, out of the same physical cell.",
      camera: { position: [2.05, 1.55, 3.5], target: [0.1, 1.0, 0] },
      dofAperture: 0.00005,
      focus: ['The 20-80% window: far less stress per cycle'],
      onEnter: ({ handles }) => {
        handles.set({ ...PIN, dir: 1, sei: 0, dendrite: 0 });
        handles.setView('schematic');
        handles.setLabels('payoff');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5200,
          ease: 'linear',
          onUpdate: () =>
            handles.set({
              // whole lap count (reviewer flagged 1.5 as fragile — visually
              // seamless today only because the dot counts divide evenly)
              shuttle: s.t * 2,
              dir: 1,
              soc: 0.5 + 0.3 * Math.sin(s.t * Math.PI * 4),
              payoffT: trapezoid(s.t, 0.12, 0.88),
            }),
        });
      },
    },
    {
      id: 'run',
      heading: '8 · Doing its job, quietly',
      body: "Reassembled, this is the same cell sitting behind the glass of your phone or laptop right now — never burning anything, just shuttling the same lithium ions back and forth, one intercalation at a time. The ions do not wear out. The lattice they are parked in does — and where you park it, how full, how hot, how fast, is up to you.",
      hint: 'Drag to orbit while it runs.',
      camera: { position: [2.0, 1.75, 2.35], target: [0, 1.3, 0.1] },
      freeOrbit: true,
      dofAperture: 0.00003,
      onEnter: ({ handles }) => {
        handles.set(PIN);
        handles.setView('assembled');
        handles.setLabels(false);
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3000,
          ease: 'linear',
          onUpdate: () => handles.set({ statusCharge: 0.5 + 0.5 * Math.sin(s.t * Math.PI * 2 * 3) }),
        });
      },
    },
  ],
});
