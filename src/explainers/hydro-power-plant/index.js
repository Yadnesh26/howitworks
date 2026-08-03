import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildHydroPlant } from './model.js';

// Every step runs the plant as a seamless loop while active: the water phase
// advances exactly one full lap (fading in near the reservoir, fading out
// downstream in the tailrace — an open flow, not a closed circuit) and the
// turbine/generator shaft turns a whole number of turns per lap, so the wrap
// is invisible. The camera supplies each step's focus; the plant just runs.
// Water packets always cover the WHOLE path once per `duration` (their
// position is a 0-1 fraction of the full chain), so `duration` is the only
// knob for flow speed. turns/duration together set the shaft's RPM — the
// defaults below are scaled 1.5x together (turns 6->9, duration ditto per
// step) so the flow reads noticeably slower while the runner/rotor keep
// spinning at exactly the same rate as before.
function cycleRun({ headViz = 0, gridOn = 0, turns = 9, duration = 7500 }) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () =>
        handles.set({
          flow: s.t,
          spin: s.t * Math.PI * 2 * turns,
          headViz,
          gridOn,
        }),
    });
  };
}

export default defineExplainer({
  ...meta,

  // DOF [rung 4]: only the turbine/generator macro steps get a dofAperture
  // below — a conservative 0.00012 (not the full 0.00016 ladder rung), since
  // both steps have moderately close cameras onto reflective metal (casing,
  // rotor poles). Unset steps default to near-zero aperture (sharp).
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildHydroPlant({ scene });
  },

  steps: [
    {
      id: 'overview',
      heading: 'The anatomy',
      body: 'A hydroelectric plant is a very simple machine at heart: a dam holds back a reservoir, a pipe called the penstock lets water fall from it, and at the bottom that falling water spins a turbine wired to a generator. Everything else — the transformer, the transmission lines — exists just to get the electricity that makes out to the grid.',
      hint: 'Drag to orbit · scroll to follow the water downhill.',
      camera: { position: [5.6, 3.2, 6.1], target: [0.3, 1.2, 0] },
      onEnter: ({ handles }) => handles.setLabels('anatomy'),
      timeline: cycleRun({ duration: 12000 }),
    },
    {
      id: 'reservoir',
      heading: '1 · The reservoir',
      body: "The reservoir is stored energy — pure gravitational potential energy, sitting there as long as the dam holds it back. What matters is the HEAD: the height the water surface sits above the turbine downstream. Double the head and you double the pressure driving the turbine; a trash rack and intake gate keep debris out before the water is allowed to fall.",
      camera: { position: [-1.7, 2.35, 2.5], target: [-1.15, 1.5, 0] },
      onEnter: ({ handles }) => handles.setLabels('reservoir'),
      timeline: cycleRun({ headViz: 1, duration: 9000 }),
    },
    {
      id: 'penstock',
      heading: '2 · The penstock',
      body: "Released, the water drops through the penstock — and trades that height for speed and pressure (potential energy becoming kinetic energy). The taller the dam, the faster the water is moving by the time it reaches the bottom, which is exactly why head matters so much to how much power a plant can produce.",
      camera: { position: [0.85, 2.0, 2.5], target: [0.15, 1.25, 0.35] },
      onEnter: ({ handles }) => handles.setLabels('penstock'),
      timeline: cycleRun({ duration: 6300 }),
    },
    {
      id: 'turbine',
      heading: '3 · The turbine',
      body: 'At the bottom, the flow enters a Francis turbine — the mid-head workhorse of hydropower. A spiral casing spreads the water evenly around the runner; a ring of guide vanes, bolted in place and never moving, aims it at the right angle; and just below them, the runner — the only part that actually spins — turns that racing water into torque on a shaft, as the flow bends from radial to axial. (Very low-head rivers use a propeller-like Kaplan turbine instead; very high-head sites use a Pelton wheel, struck by a free jet.)',
      camera: { position: [1.84, 0.67, 1.63], target: [1.05, 0.3, 0.05] },
      dofAperture: 0.00012,
      onEnter: ({ handles }) => handles.setLabels('turbine'),
      timeline: cycleRun({ duration: 4800 }),
    },
    {
      id: 'generator',
      heading: '4 · The generator',
      body: "The same shaft carries that spin straight up into the generator, where a rotor of magnetic poles turns inside a ring of fixed stator windings. As each pole sweeps past a winding, the changing field induces a voltage in it — Faraday's law, the same electromagnetic induction the transformer and inductor use, just driven by a spinning shaft instead of another coil's current. The result is alternating current, one pulse per pole per turn.",
      camera: { position: [2.05, 1.75, 1.9], target: [1.05, 1.1, 0] },
      dofAperture: 0.00012,
      onEnter: ({ handles }) => handles.setLabels('generator'),
      timeline: cycleRun({ duration: 4800 }),
    },
    {
      id: 'grid',
      heading: '5 · Step-up & the grid',
      body: "That current is still at generator voltage — too low to travel far without huge resistive losses. A step-up transformer raises it dramatically before it heads out on transmission lines, trading current for voltage the same way any transformer does, so the wires can carry the same power at a fraction of the current. From here it's a story of substations and towers all the way to a wall socket.",
      camera: { position: [3.7, 2.5, 3.3], target: [2.0, 1.55, 0.05] },
      onEnter: ({ handles }) => handles.setLabels('grid'),
      timeline: cycleRun({ gridOn: 1, duration: 5100 }),
    },
    {
      id: 'tailrace',
      heading: '6 · The tailrace',
      body: 'Its energy spent, the water leaves the runner through the draft tube — which gently slows it back down to recover any last usable pressure — and rejoins the river downstream as the tailrace. Nothing is consumed in this whole chain, only converted: height became speed, speed became spin, spin became current.',
      camera: { position: [3.1, 1.35, 2.6], target: [1.95, 0.45, 0] },
      onEnter: ({ handles }) => handles.setLabels('tailrace'),
      timeline: cycleRun({ gridOn: 1, duration: 5700 }),
    },
    {
      id: 'run',
      heading: 'The plant runs',
      body: 'Head, penstock, turbine, generator, transformer, tailrace — one continuous energy chain, from a reservoir sitting still to electrons moving down a wire. Every hydro plant on Earth, from a village micro-turbine to Three Gorges, is this same handful of ideas at a different scale.',
      hint: 'Drag to orbit the running plant.',
      camera: { position: [5.9, 3.0, 6.3], target: [0.3, 1.2, 0] },
      freeOrbit: true,
      onEnter: ({ handles }) => handles.setLabels(null),
      timeline: cycleRun({ gridOn: 1, duration: 6900, turns: 12 }),
    },
  ],
});
