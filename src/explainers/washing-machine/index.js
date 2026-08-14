import { defineExplainer } from '../../framework/index.js';
import { TAU } from '../../framework/motion.js';
import meta from './meta.js';
import { buildWashingMachine } from './model.js';

// Reveal story: the sealed white machine, then the cabinet ghosts to show the
// drum-inside-a-tub hanging on its suspension, then it fills and heats itself,
// then the tumble that does the actual washing, then the belt-less motor on the
// back, then the drain and the 1400 rpm spin — and finally the cabinet closes
// again and the whole cycle runs.
//
// Seamless loops: every step drives ONE linear 0-1 phase. `drumAngle` always
// advances a WHOLE number of turns per lap, and everything geared to it is an
// integer multiple: the rotor is 1:1 (direct drive), the stator field is x18,
// the garments' carry-and-fall cycle is 1 per drum turn, the out-of-balance
// excursion rides cos/sin of the drum angle, and the spray droplets run 2 whole
// cycles. The pump impeller and the water slosh likewise close whole cycles.

// Every scalar the model owns, so each step can pin ALL of them (pre-flight #4)
// and scrolling either direction lands on an identical scene.
const DEFAULTS = {
  reveal: 0,
  drumAngle: 0,
  tumbleMix: 0,
  fill: 0,
  heat: 0,
  drawer: 0,
  pumpSpin: 0,
  flow: 0,
  dye: 0,
  drainVis: 0,
  sprayVis: 0,
  shake: 0,
  motorOpen: 0,
};

const view =
  ({ labels = false, ...rest }) =>
  ({ handles }) => {
    handles.set({ ...DEFAULTS, ...rest });
    handles.setLabels(labels);
  };

// One linear phase per lap; `turns`/`pumpTurns` are whole numbers, and `extra`
// derives any additional scalar from the same phase.
function run({ duration, turns = 1, pumpTurns = 0, extra = null }) {
  return ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL state — never share tween targets across steps
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () =>
        handles.set({
          drumAngle: s.t * turns * TAU,
          flow: s.t,
          pumpSpin: s.t * pumpTurns * TAU,
          ...(extra ? extra(s.t) : null),
        }),
    });
  };
}

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildWashingMachine({ scene });
  },

  steps: [
    {
      id: 'sealed',
      heading: 'The one machine you shut and walk away from',
      body: 'A washing machine asks for a door slam and a dial, and then tells you nothing for two hours. Behind the glass a drum turns over. Behind the drum sits everything else — a water valve, a heater, a pump, a motor, and a slab of concrete — and none of it is visible from the outside. The white box is doing chemistry, plumbing and 500 g of centrifuge, all under a lid you cannot open while it runs.',
      hint: 'Drag to orbit · scroll to look inside.',
      camera: { position: [-2.55, 2.35, 3.55], target: [-0.45, 1.35, -0.1] },
      dofAperture: 0.00004,
      onEnter: view({ labels: 'exterior' }),
      timeline: run({ duration: 6400, turns: 1 }),
    },
    {
      id: 'cutaway',
      heading: 'Two drums, and only one of them turns',
      body: 'Take the cabinet off and the machine is a drum inside a drum. The outer tub is a sealed plastic bucket that holds the water and never moves. The perforated stainless drum inside it is the only part that spins. And the whole assembly is hanging, not bolted: two springs carry it from the top corners, two friction dampers push back from the base, and about 25 kg of concrete is bolted on to give it the mass to fight its own vibration.',
      camera: { position: [3.15, 2.15, 2.35], target: [-0.35, 1.3, -0.05] },
      dofAperture: 0.00008,
      focus: ['Outer tub — holds the water'],
      onEnter: view({ reveal: 1, labels: 'internal' }),
      timeline: run({ duration: 5400, turns: 1 }),
    },
    {
      id: 'water',
      heading: 'It fills through the soap, then heats its own water',
      body: 'A solenoid valve at the back opens, and mains water takes the long way in: up over the top, down through the detergent drawer, washing the powder along with it into the tub. What collects in the sump is cold, so a sheathed 2 kW element down there boils it up to the programme temperature. The machine never sees the water level — a thin hose traps a column of air under the tub, rising water squeezes it, and a pressure sensor reads that squeeze as centimetres.',
      hint: 'A front loader needs only about 50 litres — the clothes are wetted, not floated.',
      camera: { position: [-2.55, 2.35, 2.6], target: [-0.55, 1.45, -0.05] },
      dofAperture: 0.0001,
      focus: ['Detergent drawer', 'Heating element (~2 kW)'],
      onEnter: view({ reveal: 1, labels: 'water', drawer: 1, dye: 1, heat: 1, fill: 0.72 }),
      timeline: run({
        duration: 5000,
        turns: 1,
        extra: (t) => ({ fill: 0.72 + 0.18 * Math.sin(t * TAU) }),
      }),
    },
    {
      id: 'tumble',
      heading: 'Lift, drop, repeat',
      body: 'Three ridges run down the inside of the drum. They catch the load, carry it up the wall, and hand it to gravity: the clothes fall back through the water and slap into the bottom, flexing the weave so detergent floods in and out of every fibre. That only works slowly. Past about 60 rpm the wall is pulling the load outward harder than gravity pulls it down, nothing falls, and the machine is just turning a heavy tube — so wash tumbling sits near 50.',
      camera: { position: [1.45, 1.9, 3.05], target: [-0.35, 1.4, 0.15] },
      dofAperture: 0.00013,
      focus: ['Lifter paddle'],
      onEnter: view({ reveal: 1, labels: 'tumble', fill: 0.55, heat: 0.4 }),
      timeline: run({ duration: 4400, turns: 3 }),
    },
    {
      id: 'motor',
      heading: 'The motor is the back of the drum',
      body: 'Older machines drive the drum with a belt and a big pulley. This one has neither. The drum shaft passes through a bearing in the tub wall and bolts straight to the rotor — a steel pot carrying 36 permanent magnets, cut away here so you can see what it sits over: a stator of wound copper coils. The controller energises those coils in a rotating pattern and the magnets chase it, so the drum turns at exactly the speed the electronics ask for. One motor, no gearing — which is how the same machine holds a lazy 50 rpm tumble and a 1400 rpm spin.',
      hint: "The rotor's steel pot is cut away here — that ring of magnets is what turns.",
      // Orbit round to the rear quarter and push in: screen-right is -Z from
      // here, so the motor lands right of frame centre with room for its
      // leaders, and the tub no longer stands between camera and stator.
      camera: { position: [2.75, 1.75, -1.35], target: [0.1, 1.4, -0.35] },
      dofAperture: 0.00011,
      focus: ['Rotor — 36 magnets'],
      onEnter: view({ reveal: 1, labels: 'motor', motorOpen: 1, fill: 0.45, tumbleMix: 0.4 }),
      timeline: run({ duration: 3800, turns: 2 }),
    },
    {
      id: 'spin',
      heading: 'Spin: five hundred times gravity',
      body: 'The pump empties the tub first — nothing accelerates with a bath still in it. Then the drum ramps up, and at 1400 rpm the wall is throwing your clothes outward at roughly 500 times gravity. Water has nowhere to go but through the perforations, down the outer tub and back to the pump. Nothing is wrung or squeezed; the water is simply flung off the fabric. An out-of-balance load at that speed would walk the machine across the floor, which is what the concrete, the springs and the dampers are quietly absorbing.',
      camera: { position: [2.85, 1.4, 2.85], target: [-0.35, 1.15, -0.05] },
      dofAperture: 0.0001,
      focus: ["Perforations — the water's only exit"],
      onEnter: view({
        reveal: 1,
        labels: 'spin',
        tumbleMix: 1,
        drainVis: 1,
        sprayVis: 1,
        shake: 1,
      }),
      timeline: run({ duration: 3200, turns: 12, pumpTurns: 24 }),
    },
    {
      id: 'run',
      heading: 'Run it',
      body: 'Fill through the soap, heat it in the sump, tumble at 50 so gravity can do the scrubbing, drain, then throw the water off at 1400. Two drums, one belt-less motor, and a block of concrete holding the whole thing still while it happens.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [2.95, 2.2, 3.15], target: [-0.35, 1.3, -0.05] },
      dofAperture: 0.00005,
      freeOrbit: true,
      onEnter: view({ fill: 0.55, heat: 0.5 }),
      timeline: run({ duration: 3600, turns: 4 }),
    },
  ],
});
