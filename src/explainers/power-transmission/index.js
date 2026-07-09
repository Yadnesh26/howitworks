import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildPowerTransmission } from './model.js';

// Every step loops while active: `phase` sweeps 0->1 once per lap and every
// flow-dot group's speed multiplier is a whole number, so a dot always
// returns to an identical position at the wrap — seamless regardless of how
// fast or slow that segment's current looks.
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
    return buildPowerTransmission({ scene });
  },

  steps: [
    {
      id: 'overview',
      heading: '1 · The whole journey',
      body: "Electricity almost never travels straight from a power plant to your house — it takes a long relay of voltage changes. A step-up transformer raises it for the trip, tall towers carry it for miles, a substation and a chain of poles step it back down, and a small transformer near your house brings it to the 120/240 V an outlet actually uses.",
      hint: 'Drag to orbit.',
      camera: { position: [0.9, 3.7, 13.6], target: [0.9, 1.3, 0] },
      onEnter: ({ handles }) => {
        handles.set({ lossAmount: 0 });
        handles.setLabels('overview', true);
      },
      timeline: run({ duration: 8000 }),
    },
    {
      id: 'loss',
      heading: '2 · Why voltage has to go up first',
      body: "A wire has resistance, so any current flowing through it wastes power as heat: P_loss = I²R — and that loss scales with the SQUARE of current. Since delivered power is P = V × I, the only way to cut current without cutting power is to raise voltage. Compare the two wires: sent at plant voltage, the same power needs far more current and wastes far more heat (left, glowing hot); stepped up first, it's fewer, faster charges at low current — this is the entire reason the step-up transformer exists.",
      camera: { position: [-3.5, 1.7, 4.3], target: [-3.9, 1.0, 0.15] },
      onEnter: ({ handles }) => {
        handles.set({ lossAmount: 1 });
        handles.setLabels('loss', true);
      },
      timeline: run({ duration: 5000 }),
    },
    {
      id: 'towers',
      heading: '3 · Transmission towers',
      body: 'Stepped up to a transmission voltage — real lines run anywhere from 115,000 to 765,000 volts — the current heads out on tall lattice steel towers. Insulator strings hang the live conductor below the grounded steel so it never touches it, and the wire itself sags in a gentle catenary between towers, exactly like real overhead cable — it is never pulled dead straight.',
      camera: { position: [0.7, 2.0, 3.4], target: [0.0, 1.6, 0] },
      onEnter: ({ handles }) => {
        handles.set({ lossAmount: 0 });
        handles.setLabels('towers', true);
      },
      timeline: run({ duration: 4000 }),
    },
    {
      id: 'substation',
      heading: '4 · The substation steps it back down',
      body: 'Near the load, a substation reverses the trick: the incoming high-voltage line feeds the many-turn side of another transformer, and a few-turn, thick-wire winding hands off a much lower "distribution" voltage — commonly a few kilovolts up to around 35 kV — to the lines that will actually run through neighborhoods.',
      camera: { position: [4.4, 1.7, 2.6], target: [3.4, 0.9, 0] },
      onEnter: ({ handles }) => {
        handles.set({ lossAmount: 0 });
        handles.setLabels('substation', true);
      },
      timeline: run({ duration: 4200 }),
    },
    {
      id: 'poles',
      heading: '5 · Distribution poles',
      body: 'From the substation, medium-voltage distribution lines run on shorter wooden poles down streets and alleys — the wires you actually see overhead in most neighborhoods. Shorter poles, shorter insulators, tighter sag: everything here is scaled down from the transmission towers because the voltage is so much lower.',
      camera: { position: [5.9, 1.6, 2.4], target: [5.1, 1.0, 0] },
      onEnter: ({ handles }) => {
        handles.set({ lossAmount: 0 });
        handles.setLabels('poles', true);
      },
      timeline: run({ duration: 4000 }),
    },
    {
      id: 'house',
      heading: '6 · Into your house',
      body: 'One last transformer — small enough to hang on a single pole — steps distribution voltage down to 120/240 V. A service drop carries that final hop to a weatherhead on the roof, down through the meter that tallies what you use, and into the breaker panel that fans it out, circuit by circuit, to every outlet in the house.',
      camera: { position: [7.6, 1.3, 1.9], target: [6.9, 0.6, 0.4] },
      onEnter: ({ handles }) => {
        handles.set({ lossAmount: 0 });
        handles.setLabels('house', true);
      },
      timeline: run({ duration: 4200 }),
    },
    {
      id: 'run',
      heading: '7 · One continuous relay',
      body: 'Generator, step-up transformer, towers, substation, poles, one final transformer, meter, panel — every stage is the same idea, a turns ratio trading voltage for current, run in reverse gears until the power is safe and steady in your wall. The whole relay runs continuously, invisibly, every second of every day.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [0.9, 3.5, 12.6], target: [0.9, 1.3, 0] },
      freeOrbit: true,
      onEnter: ({ handles }) => {
        handles.set({ lossAmount: 0 });
        handles.setLabels(null, false);
      },
      timeline: run({ duration: 3200 }),
    },
  ],
});
