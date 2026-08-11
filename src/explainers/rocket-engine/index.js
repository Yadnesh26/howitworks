import { defineExplainer } from '../../framework/index.js';
import { TAU } from '../../framework/motion.js';
import meta from './meta.js';
import { buildRocketEngine } from './model.js';

// Reveal story: a sealed engine already running -> the pressure problem that
// dictates the entire layout -> the turbopump doing the lifting -> the small
// rocket engine that spins it -> the pintle where the propellants finally meet
// -> the chamber and the choked throat -> the bell, and the fuel climbing its
// walls the wrong way -> steering -> a sealed, running finale.
//
// CAMERA RULE for this scene: every pose sits on the +Z side and behind the
// engine (-X), so world +X reads screen-right and the machine always flows
// left-to-right: turbopump, chamber, throat, bell, plume. Each step then
// targets a point to the LEFT of its subject, pushing that subject into the
// right two-thirds and clear of the text panel.
//
// SEAMLESS LOOPS: `spin` advances whole turns, `flow` a whole number of packet
// cycles, and `gimbal` whole sine cycles — so frame 0 and frame 1 are the same
// pose in every step. Nothing here is eased by anime; inertia is shaped inside
// the pose maths inside `running` so the single linear tween per lap stays
// intact.

// Pin ALL scene state on entering a step (pre-flight #4): the cutaway, the
// burn, the plume, the flow packets and the labels — so scrolling in either
// direction lands on an identical frame, and no step inherits the previous
// one's mid-lap phase.
// `mount` drops the test stand, gimbal bearing and actuators — they sit inches
// from the injector and the turbopump, so on the deep-macro steps they are
// foreground clutter no camera angle can dodge.
const view =
  ({ cut = 0, burn = 1, thrust = 1, dots = 1, gimbal = 0, mount = 1, labels = false }) =>
  ({ handles }) => {
    handles.set({ cut, burn, thrust, dots, gimbal, mount, spin: 0, flow: 0 });
    handles.setLabels(labels);
  };

// One lap: `turns` whole shaft revolutions and `cycles` whole packet traversals.
// `sway` adds a gimbal wobble of whole sine cycles (0 = dead still).
//
// PACING: an early pass ran 6-16 turns and 3-6 packet cycles per lap, which read
// as a strobing blur — the impellers stopped being trackable and the propellant
// packets shot down the plumbing too fast to follow. Everything now sits at ONE
// packet traversal per lap over 5.5-9 s, and 5-7 shaft turns, so a single dot can
// be watched from the inlet all the way to the injector.
//
// Every count is ODD on purpose. verify.mjs's motion gate samples each loop at
// 0.2 and 0.7 of a lap — exactly half a lap apart — so an even number of turns
// or cycles hashes IDENTICALLY at both samples and the step gets reported static
// even though the loop is perfectly alive. Odd counts are still whole cycles, so
// seamlessness is untouched.
function running({ turns, cycles, duration = 3000, sway = 0, swayCycles = 1 }) {
  return ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL state — never share a tween target across steps
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () =>
        handles.set({
          spin: s.t * TAU * turns,
          flow: s.t * cycles,
          gimbal: sway ? Math.sin(s.t * TAU * swayCycles) * sway : 0,
        }),
    });
  };
}

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true, space: true },

  buildScene({ scene }) {
    return buildRocketEngine({ scene });
  },

  steps: [
    {
      id: 'complete',
      heading: 'Almost none of this is the fire',
      body: 'The burning happens in the ribbed silver drum in the middle. Everything else — the pump bolted above it, the little can tucked in behind, the pipe that runs the whole length of the bell and back — exists to get three hundred kilos of liquid a second into that drum. And the drum is already at ninety-seven atmospheres. That is the actual problem a rocket engine solves: not how to burn kerosene, which is easy, but how to keep shoving more of it into a space that is already the most violently pressurised place for a hundred miles.',
      hint: 'Drag to orbit · scroll to open it up. Gas-generator cycle, LOX and kerosene, 845 kN at sea level.',
      camera: { position: [-1.35, 2.12, 3.95], target: [-0.52, 1.33, 0] },
      dofAperture: 0.00003,
      onEnter: view({ cut: 0, burn: 1, thrust: 1, dots: 0, labels: 'exterior' }),
      timeline: running({ turns: 5, cycles: 1, duration: 9000, sway: 0.012 }),
    },
    {
      id: 'feed',
      heading: 'The tanks are at three bar. The chamber is at ninety-seven.',
      body: 'Liquid does not flow uphill, and pressure is the hill. You could build the tanks strong enough to push propellant in by themselves, and small rockets do exactly that — but tanks that hold ninety-seven bar are tanks with thick heavy walls, and the whole reason a rocket exists is to not carry heavy things. So the tanks stay thin and floppy at three bar, and a pump does the lifting instead: it takes propellant in at three bar and hands it over at about a hundred and fifty. Follow the amber line, though. The fuel does not go to the chamber. It goes all the way down the nozzle first.',
      hint: 'Blue is liquid oxygen, amber is kerosene.',
      camera: { position: [-2.5, 2.4, 2.45], target: [-1.32, 1.62, 0] },
      dofAperture: 0.00012,
      focus: ['LOX inlet', 'Fuel inlet', '150 bar out'],
      onEnter: view({ cut: 0, burn: 1, thrust: 1, dots: 1, labels: 'feed' }),
      timeline: running({ turns: 5, cycles: 1, duration: 8000 }),
    },
    {
      id: 'turbopump',
      heading: 'One shaft, thirty-six thousand rpm',
      body: 'Take the housing off and the pump is three wheels on a single shaft. Two of them are impellers — one for oxygen, one for kerosene — spinning fast enough that the liquid is flung outward and arrives at the rim with nowhere to go but out the discharge pipe at a hundred and fifty bar. Pumping is really just that: throw the liquid, then make it stop. The shaft turns at thirty-six thousand rpm, six hundred times a second, and the pump draws around ten thousand horsepower — more than a mainline locomotive — out of a package you could carry under one arm. Which raises the obvious question: what is turning it?',
      hint: 'The third wheel, at the far end, is the turbine. That is the answer.',
      camera: { position: [-1.86, 2.16, 1.86], target: [-1.2, 1.74, 0] },
      dofAperture: 0.00028,
      focus: ['Fuel impeller', 'LOX impeller', 'One shaft · 36,000 rpm'],
      onEnter: view({ cut: 1, burn: 1, thrust: 1, dots: 1, mount: 0, labels: 'pump' }),
      timeline: running({ turns: 5, cycles: 1, duration: 6000 }),
    },
    {
      id: 'gasgenerator',
      heading: 'It is spun by a second, smaller rocket engine',
      body: 'The can hanging underneath is a gas generator, and it is a complete little rocket engine in its own right — its own injector, its own combustion, burning about two per cent of everything the pump moves. What it is not is efficient, deliberately. It runs heavily fuel-rich, so there is far more kerosene than oxygen and the flame comes out sooty and merely warm — around six hundred degrees instead of the three thousand next door. A stoichiometric flame would shred the turbine blades in seconds. That warm gas spins the turbine, the turbine spins the pumps, and the pumps feed the gas generator: the engine bootstraps itself. Then the spent gas is simply thrown away down the side of the bell, which is why this cycle is called open, and why it gives up a few per cent of performance for a great deal of simplicity.',
      // Low hero angle, looking slightly UP at the gas generator from in front
      // of the stand — which also puts the pedestal behind the lens instead of
      // filling the left third of the frame.
      camera: { position: [-1.55, 0.96, 1.78], target: [-1.3, 1.11, 0] },
      dofAperture: 0.00016,
      focus: ['Gas generator', 'Turbine', 'Turbine exhaust'],
      onEnter: view({ cut: 1, burn: 1, thrust: 1, dots: 1, mount: 0, labels: 'gg' }),
      timeline: running({ turns: 5, cycles: 1, duration: 7000 }),
    },
    {
      id: 'injector',
      heading: 'Two sheets of liquid, hitting at right angles',
      body: 'Both propellants finally meet at the pintle — the chrome post sticking out of the injector face. Kerosene comes up the middle of the post and leaves through a ring of slots as a flat sheet flying straight outward. Oxygen comes down the gap around the post and leaves as a hollow tube of liquid flying forward. The two sheets collide at ninety degrees, and that collision is the entire atomiser: it shatters both into a mist fine enough to burn in the couple of thousandths of a second it has before it reaches the throat. What makes this design special is that it is one moving part instead of six hundred drilled holes — so you can turn it down to forty per cent thrust, shut it off, and light it again. That is what makes landing a booster possible.',
      hint: 'Shown throttled part-way back, which is the only reason you can see into the chamber at all. Apollo’s Lunar Module descent engine used a pintle too, for exactly this reason.',
      // Nearly perpendicular to the axis, and downstream of all the plumbing:
      // any camera parked back at the dome sits INSIDE the feed ducts, which
      // then fill the foreground as out-of-focus blobs. The small -X component
      // keeps +X reading screen-right.
      // Framed LOW and tight on purpose: the turbopump's belly sits 0.19 above
      // the centreline and the gas generator hangs off the far end, so the only
      // clean pocket around the pintle is a frame that crops both. Held
      // near-perpendicular to the axis so the fuel sheet is seen almost edge-on,
      // which is what makes it read as a sheet rather than a cone.
      camera: { position: [-0.76, 1.44, 0.8], target: [-0.78, 1.28, 0] },
      dofAperture: 0.00026,
      focus: ['Pintle post', 'Fuel — radial sheet', 'LOX — annular sheet'],
      onEnter: view({ cut: 1, burn: 0.32, thrust: 0.3, dots: 1, mount: 0, labels: 'inj' }),
      timeline: running({ turns: 5, cycles: 1, duration: 5500 }),
    },
    {
      id: 'chamber',
      heading: 'Then it squeezes through a hole',
      body: 'Inside the chamber the gas is at ninety-seven bar and about three thousand three hundred degrees — comfortably hot enough to boil steel, which melts at fifteen hundred and boils around two thousand nine hundred. It is also going almost nowhere: the chamber is wide, so the gas mills around. Then the wall closes in to that narrow waist, and at exactly the narrowest point the gas hits Mach 1 — never more, never less. That is not a coincidence, it is a law: a converging duct cannot push a gas past the speed of sound. And once the throat is at Mach 1 the flow is choked, which means the chamber can no longer be influenced by anything downstream of it. The engine stops caring whether it is at sea level or in vacuum. Everything from here on happens in a place the chamber cannot hear.',
      camera: { position: [-1.55, 1.78, 1.95], target: [-0.78, 1.33, 0] },
      dofAperture: 0.00022,
      focus: ['97 bar · 3,300 °C', 'Throat · Mach 1', 'Coolant channels'],
      onEnter: view({ cut: 1, burn: 1, thrust: 1, dots: 1, mount: 0, labels: 'cham' }),
      timeline: running({ turns: 5, cycles: 1, duration: 6000 }),
    },
    {
      id: 'nozzle',
      heading: 'Past the throat, wider means faster',
      body: 'Below the waist the bell flares out, and here the rule inverts: a supersonic gas speeds up as its duct widens. It trades pressure and heat for sheer velocity, and by the lip — sixteen times the throat area — it is doing about Mach three and a half and roughly two thousand nine hundred metres a second. That flare is not styling; it is most of the thrust. Now look at the amber packets on the wall, running the wrong way. That is the kerosene, and it has not been burned yet — it is pumped through channels milled into the wall from the far end of the bell forward to the injector before it is allowed anywhere near the flame. The propellant is the coolant. The heat it steals from the wall is not lost either; it goes into the chamber with the fuel. That is why this bell is thin metal and not ceramic, and why a rocket engine can run three thousand degrees against a wall you could machine on a lathe.',
      hint: 'The second line of packets, tracking along underneath the bell, is the turbine’s spent exhaust heading overboard — it is dumped into the skirt and films the last stretch of wall on its way out.',
      camera: { position: [-1.05, 1.98, 2.7], target: [-0.18, 1.26, 0] },
      dofAperture: 0.00009,
      focus: ['Fuel climbs up', 'Gas expands down', 'Area ratio 16 : 1'],
      onEnter: view({ cut: 1, burn: 1, thrust: 1, dots: 1, mount: 0, labels: 'noz' }),
      timeline: running({ turns: 5, cycles: 1, duration: 8000 }),
    },
    {
      id: 'gimbal',
      heading: 'Steering means moving the whole engine',
      body: 'A rocket has no air to push against, so there are no rudders and nothing to bank into. The only force that exists is the one coming out of the nozzle, which means the only way to steer is to point that force somewhere other than straight through the centre of mass. So the entire engine — pump, gas generator, plumbing, the lot — hangs on a single ball joint, and two hydraulic actuators shove it around by about five degrees. Five degrees is plenty. The engine is metres behind the centre of mass, so a small angle down there is a large torque up here, and a booster balancing on its own exhaust is really just this joint making tiny corrections, several times a second, all the way down.',
      hint: 'The bell is sealed up again — this is the engine as it actually flies.',
      // panned 0.38 left of the obvious framing (camera and target together, so
      // the angle is unchanged) — at the centred framing the gimbal hardware this
      // step is ABOUT sat behind the text panel
      camera: { position: [-2.16, 1.72, 3.3], target: [-0.88, 1.24, 0] },
      dofAperture: 0.00005,
      focus: ['Pitch actuator', 'Yaw actuator', '± 5° of steering'],
      onEnter: view({ cut: 0, burn: 1, thrust: 1, dots: 0, labels: 'gim' }),
      timeline: running({ turns: 5, cycles: 1, duration: 7000, sway: 0.087, swayCycles: 1 }),
    },
    {
      id: 'run',
      heading: 'Run it',
      body: 'All of it at once. A can of sooty fire spins a turbine, the turbine drives two impellers to a hundred and fifty bar, the kerosene takes the long way through the walls of the bell to keep them from melting, two sheets of liquid collide on a chrome post, and a column of gas leaves the lip at nearly three kilometres a second. The engine feeds itself the whole time — every part of that chain is powered by the chain. And it will hold that going for something over two and a half minutes, which is all it needs: by then it is out of the thick air and most of the way to orbital speed.',
      hint: 'Drag to orbit while it burns.',
      // flatter and closer than the opening hero shot: less plinth deck in frame,
      // and the engine fills more of it for the finale
      camera: { position: [-1.05, 1.72, 3.7], target: [-0.45, 1.32, 0] },
      freeOrbit: true,
      dofAperture: 0.00002,
      onEnter: view({ cut: 0, burn: 1, thrust: 1, dots: 0, labels: false }),
      timeline: running({ turns: 7, cycles: 1, duration: 5000, sway: 0.03, swayCycles: 1 }),
    },
  ],
});
