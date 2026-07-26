import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildDiscBrake } from './model.js';

// Zoom-in / reveal story: the complete rolling wheel, wheel off to expose the
// corner, the Pascal pressure chain, the floating-caliper clamp, friction →
// heat, the vented rotor's cooling pump, then everything back together at
// speed. Every mechanism step loops model.js's canonical braking lap
// (setCycle: cruise → clamp → decel+heat → release → spin-up), which uses
// motion.profileTable so each lap advances whole wheel turns by construction.

// Pin the full layer/label/air state on entering a step so scrolling either
// way lands on a consistent scene (pre-flight #4).
const view =
  (reveal, labelMode, air = false) =>
  ({ handles }) => {
    handles.setReveal(reveal);
    handles.setLabels(labelMode);
    handles.setAir(air);
  };

function cycleLoop(duration) {
  return ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL state — never share tween targets across steps
    tl.add(s, { t: 1, duration, ease: 'linear', onUpdate: () => handles.setCycle(s.t) });
  };
}

function cruiseLoop(turns, duration) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () => handles.setCruise(s.t * turns),
    });
  };
}

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildDiscBrake({ scene });
  },

  steps: [
    {
      id: 'complete',
      heading: 'Stopping a tonne and a half',
      body: 'A car travelling at highway speeds carries enough kinetic energy to launch itself straight into the air. The only mechanism capable of bleeding off that energy is hiding behind each wheel. Watch this wheel spin, then brake hard: something inside is clamping down on a spinning metal disc with the weight of a small car. Let\'s pull the wheel off and look inside.',
      hint: 'Drag to orbit · scroll to open it up.',
      camera: { position: [3.2, 2.3, 3.4], target: [0, 1.42, 0] },
      onEnter: view(0, 'exterior'),
      timeline: cycleLoop(7000),
    },
    {
      id: 'corner',
      heading: 'The whole machine at once',
      body: 'With the wheel removed, the mechanism is revealed: a heavy cast-iron disc—the rotor—bolted directly to the hub so it spins with the tire, and a red clamp—the caliper—straddling its edge like a hand ready to catch a spinning plate. A thin steel line feeds fluid to the caliper from the pedal and master cylinder. That is the entire system: pedal, fluid, clamp, and disc. Everything else is just detail.',
      camera: { position: [2.5, 2.4, 2.8], target: [-0.1, 1.4, 0] },
      onEnter: view(1, 'corner'),
      timeline: cycleLoop(6500),
    },
    {
      id: 'pascal',
      heading: 'A lever made of liquid',
      body: 'Brake fluid cannot be compressed. Push it at one end, and that exact pressure appears everywhere instantly. This is Pascal\'s principle, and it turns the hydraulic line into a powerful liquid lever. Your foot operates a small piston in the master cylinder (roughly 22 mm across), while the caliper\'s piston is much wider at 57 mm. The same pressure applied over a larger area generates vastly more force. Combined with the pedal\'s 4:1 mechanical advantage, roughly 27 times the force of your foot arrives at the pads. Press with 20 kg, and the pads clamp down with over half a tonne.',
      hint: 'Follow the pressure pulse up the line as the pedal goes down.',
      camera: { position: [0.1, 1.35, 4.0], target: [-1.05, 0.95, 0.55] },
      onEnter: view(1, 'pascal'),
      timeline: cycleLoop(6000),
    },
    {
      id: 'clamp',
      heading: 'One piston, two pads',
      body: 'Look through the caliper\'s inspection window. Surprisingly, only one side has a piston, which shoves the inner pad against the disc. However, the caliper body isn\'t bolted rigidly; it floats on two polished steel guide pins. The instant the inner pad touches the rotor, the reaction force slides the entire caliper body in the opposite direction, pulling the outer pad firmly against the disc as well. Thanks to this clever design, a single piston pinches the disc evenly from both sides. (The sliding movement is exaggerated here ten-fold for visibility—the actual clearance is thinner than a sheet of paper.)',
      camera: { position: [-1.5, 2.75, 1.4], target: [-0.05, 2.0, 0.38] },
      onEnter: view(1, 'clamp'),
      timeline: cycleLoop(5200),
    },
    {
      id: 'heat',
      heading: 'Where the motion goes',
      body: 'Brakes don\'t destroy energy—they transform it. Every stop converts the car\'s kinetic energy into heat at two thin pads of friction material, and the physics are brutal. A single hard stop from highway speeds dumps around half a megajoule of heat into the discs, spiking their temperature by hundreds of degrees in seconds. Watch the friction ring flush with heat as the pads bite down, then fade as the disc sheds it into the surrounding air. That is your speed, literally radiating away as warmth.',
      camera: { position: [1.9, 1.7, 2.6], target: [0.15, 1.42, 0.1] },
      onEnter: view(1, false),
      timeline: cycleLoop(4800),
    },
    {
      id: 'cooling',
      heading: 'A fan built into the disc',
      body: 'Shedding that massive heat quickly is the name of the game, so the rotor is designed as its own centrifugal cooling fan. It consists of two friction plates held apart by dozens of radial vanes. As the disc spins, the vanes fling the hot air outward, drawing fresh, cool air in through the centre "hat" to replace it. The faster you drive, the harder this built-in air pump works. This is why a hollow, vented disc will consistently out-brake a solid one, lap after punishing lap.',
      hint: 'Blue arrows: in at the hat, out at the rim.',
      camera: { position: [1.5, 2.3, 1.5], target: [0.15, 1.75, 0.25] },
      onEnter: view(1, 'cooling', true),
      timeline: cruiseLoop(4, 4200),
    },
    {
      id: 'run',
      heading: 'Run it',
      body: 'Wheel back on. Pedal, fluid, piston, pads, disc, heat, and air. This entire chain reaction fires flawlessly every time the driver\'s foot comes down, dozens of times on a simple drive to the shops, lasting for years. It delivers the power to bring a car from two hundred kilometres an hour to a dead stop on demand—all from a brilliantly robust machine with just one moving part you will never even see move.',
      hint: 'Drag to orbit while it brakes.',
      camera: { position: [3.4, 2.4, 3.5], target: [0, 1.42, 0] },
      freeOrbit: true,
      onEnter: view(0, false),
      timeline: cycleLoop(3800),
    },
  ],
});
