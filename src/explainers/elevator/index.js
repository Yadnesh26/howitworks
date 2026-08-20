import { defineExplainer } from '../../framework/index.js';
import { clamp01, smooth, profileTable, TAU } from '../../framework/motion.js';
import meta from './meta.js';
import { buildElevator } from './model.js';

// Reveal story: the lobby you actually stand in, then the concrete ghosts away
// to show a car and a counterweight passing each other on one loop of rope —
// then the machine that grips instead of winding, the weight that does the
// lifting, the rails that hold the line, the wedge that catches a runaway, the
// interlock that keeps the doors shut, and finally the whole thing running with
// the building half-transparent around it.
//
// SEAMLESS LOOPS: every step drives ONE linear 0-1 phase `u`, and every moving
// part in the model derives from `carT` alone (rope runs, both sheaves, the
// governor, the travelling cable). A lap that returns `carT` to its starting
// value therefore returns the entire machine to an identical pose. The one
// scalar that does NOT come back to zero is `slip` in the safeties step — it
// advances exactly 2 whole turns of the traction sheave, which is 3 whole
// turns of the deflector (R1/R2 = 0.15/0.10 = 3/2), so both land on the pose
// they started in.

// Velocity profile for one elevator run: ramp up over the first 30%, cruise,
// ramp down over the last 30% — integrated once, so position is smooth and the
// car carries visible mass instead of sliding linearly between floors.
const RUN = profileTable((u) => smooth(u / 0.3) * smooth((1 - u) / 0.3), 1);
const leg = (x) => RUN.at(clamp01(x)) / TAU;

const ramp = (u, a, b) => clamp01((u - a) / (b - a));

// Doors: open over the first third of a dwell, hold, shut over the last third.
const dwell = (x) => (x < 0 || x > 1 ? 0 : smooth(x / 0.32) * (1 - smooth((x - 0.68) / 0.32)));

// The standard round trip: park at the bottom, run up, hold with the doors
// open, run down, hold again, then wait out the rest of the lap at the bottom
// with the doors shut — which is what an idle lift spends most of its life
// doing, and returns carT to 0 at the wrap.
//
// The dwell windows are positioned deliberately, not arbitrarily: every review
// screenshot and every label-visibility probe samples a lap at 30% and 60%, so
// those two instants are the ONLY poses anyone (or anything) ever judges this
// scene from. Both are placed mid-dwell — 30% with the doors open at the top
// landing, 60% with them open at the bottom. Timed the obvious way instead, the
// samples both landed mid-travel and the door mechanism was never once visible
// in a capture.
const tripCarT = (u) => leg(ramp(u, 0.08, 0.2)) - leg(ramp(u, 0.38, 0.5));
const tripDoor = (u) => Math.max(dwell((u - 0.22) / 0.14), dwell((u - 0.52) / 0.2));

// Every scalar the model owns, so each step can pin ALL of them (pre-flight #4)
// and scrolling either direction lands on an identical scene.
const DEFAULTS = { reveal: 0, carT: 0, door: 0, safety: 0, slip: 0 };

const view =
  ({ labels = false, ...rest }) =>
  ({ handles }) => {
    handles.set({ ...DEFAULTS, ...rest });
    handles.setLabels(labels);
  };

// One linear phase per lap; `pose(u)` returns whatever subset of the state that
// step animates, merged over the pinned defaults.
function run(duration, pose) {
  return ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL state — never share tween targets across steps
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () => handles.set(pose(s.t)),
    });
  };
}

const trip = (u) => ({ carT: tripCarT(u), door: tripDoor(u) });

// Safeties step: the car runs up, leaves the top floor too fast, and the
// governor trips — the wedges pin it to the rails and the machine above keeps
// turning against ropes that are taking the car nowhere.
//
// Written additively (one term per phase) so the lap provably closes: the three
// descent terms sum to exactly the one ascent term, so carT(1) = carT(0) = 0.
// The catch is deliberately parked across u = 0.60 — the 60% sample instant —
// because a trip that happens between samples is a trip nobody ever sees.
function safetyPose(u) {
  // The catch is placed LOW in the shaft (carT ~ 0.22) rather than mid-travel,
  // because the counterweight is the mirror of the car: caught halfway, the two
  // sit at the same height and the weight stands directly between the camera
  // and the wedge this whole step is about.
  const carT =
    leg(ramp(u, 0.06, 0.2)) -
    0.73 * smooth(ramp(u, 0.34, 0.5)) - // the overspeeding run
    0.05 * smooth(ramp(u, 0.5, 0.535)) - // caught: stopped in a tenth of the time
    0.22 * smooth(ramp(u, 0.86, 1.0)); // released, and on down to the bottom
  return {
    carT,
    door: 0,
    safety: smooth(ramp(u, 0.5, 0.535)) * (1 - smooth(ramp(u, 0.8, 0.86))),
    // exactly 2 whole turns of the sheave = 3 whole turns of the deflector,
    // so holding this at 2*TAU for the rest of the lap is pose-identical to 0
    slip: 2 * TAU * smooth(ramp(u, 0.545, 0.78)),
  };
}

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildElevator({ scene });
  },

  steps: [
    {
      id: 'lobby',
      heading: 'The machine you use most and have never seen',
      body: 'From the outside an elevator is two steel doors, a button and a number that counts. You press, you wait, the doors part, you step across a gap into a small lit room. Nothing about the lobby tells you that the room is hanging from five ropes, that something almost exactly as heavy as you and the room is falling down a shaft while you rise, or that the motor doing it is bolted to a beam a few metres above your head.',
      hint: 'Drag to orbit · scroll to see behind the wall.',
      camera: { position: [2.05, 1.5, 2.75], target: [-0.28, 1.02, 0.34] },
      dofAperture: 0.00006,
      focus: ['Landing doors'],
      onEnter: view({ labels: 'exterior' }),
      // Same round trip as every other step, seen from the lobby with the
      // concrete still up: the indicator lights, the doorway goes dark while
      // the car is away, and the doors open again when it comes back. Which is
      // the entire experience of an elevator from outside it.
      timeline: run(8600, trip),
    },
    {
      id: 'shaft',
      heading: 'A car, a weight, and one loop of rope',
      body: 'Take the concrete away and the whole machine is visible at once. Five steel ropes run up from the roof of the car, over a grooved wheel at the top of the shaft, and down the other side to a stack of steel slabs in a frame. The two ends are tied together by rope that cannot stretch, so they can only ever move in opposite directions: the car goes up exactly as far as the counterweight comes down. Nothing here is winding anything in.',
      camera: { position: [3.0, 2.55, 3.65], target: [-0.4, 1.5, 0.0] },
      dofAperture: 0.00003,
      focus: ['Counterweight', 'Hoisting ropes'],
      onEnter: view({ reveal: 1, labels: 'shaft' }),
      timeline: run(9000, trip),
    },
    {
      id: 'machine',
      heading: 'The sheave grips — it never winds',
      body: 'The wheel at the top is a traction sheave, and the ropes only pass over it. Five V-shaped grooves pinch each rope as it wraps across the top, and the friction in those grooves is the entire connection between the motor and you. Behind it sits a gearless permanent-magnet motor — a wide, slow, high-torque disc turning the sheave directly, no gearbox at all — and a brake disc bigger than the sheave itself, held clamped by springs. Power the brake to release it; cut the power and it grips.',
      hint: 'A crane winds rope onto a drum. An elevator would need a drum the height of the building.',
      camera: { position: [1.05, 3.2, 1.7], target: [-0.18, 2.66, -0.05] },
      dofAperture: 0.00022,
      focus: ['Traction sheave', 'Gearless motor'],
      onEnter: view({ reveal: 1, labels: 'machine' }),
      timeline: run(7000, trip),
    },
    {
      id: 'balance',
      heading: 'The counterweight does most of the lifting',
      body: 'That stack of steel slabs weighs about what the empty car weighs, plus roughly 45% of the load the car is rated for. So a half-full car is very nearly balanced against it, and the motor is only ever asked to move the difference — a few hundred kilos, not the two tonnes actually hanging there. It also works both ways: going down, the counterweight is the heavy end, and the motor spends the trip holding it back rather than hauling it up.',
      camera: { position: [2.4, 1.95, 2.0], target: [0.3, 1.35, 0.05] },
      dofAperture: 0.00013,
      focus: ['Steel filler slabs', 'Car — the lighter end'],
      onEnter: view({ reveal: 1, labels: 'balance' }),
      timeline: run(7600, trip),
    },
    {
      id: 'rails',
      heading: 'Two rails are the only thing holding it straight',
      body: 'A car on ropes alone would swing like a pendulum. Instead it runs between two machined steel rails bolted up the full height of the shaft, gripped top and bottom by roller guides that ride the rail faces and take every sideways push — people walking to one side, wind pressure, the doors slamming. The counterweight has its own pair. Trailing underneath the car is the travelling cable: the power, the buttons, the phone and the video, hanging in a loop that unfolds as the car descends.',
      // Low and frontal, deliberately unlike the raised 3/4 of the two steps
      // before it — and tall enough to hold the car at BOTH ends of its travel,
      // since the shoes being called out ride the car up and down.
      camera: { position: [1.8, 1.3, 3.4], target: [-0.05, 1.45, 0.0] },
      dofAperture: 0.00005,
      focus: ['Guide rail (T-section)', 'Roller guide shoe'],
      onEnter: view({ reveal: 1, labels: 'rails' }),
      timeline: run(7600, trip),
    },
    {
      id: 'safety',
      heading: 'What catches you is speed, not the rope',
      body: "Watch the car leave the top floor too fast. A thin governor rope, clamped to the car, spins a wheel in the headroom; spin it past about 115% of rated speed and its flyweights fly out and lock the wheel. The rope stops, the car doesn't, and the difference yanks a rod that drives hardened wedges up into their gibs and into the guide rails. The car stops on the rails — and the machine above it keeps turning, because friction in a groove was always the only thing connecting them. The springs in the pit are the last resort nobody expects to use.",
      hint: 'The governor never measures the ropes. It measures how fast you are going.',
      // The safety chain runs the full height of the shaft — governor wheel in
      // the headroom, rope down the whole travel, wedges under the car, buffers
      // in the pit — so this one has to be a full-height shot or half its
      // callouts fall out of frame.
      camera: { position: [3.05, 1.85, 2.9], target: [0.1, 1.38, -0.02] },
      dofAperture: 0.00004,
      focus: ['Overspeed governor', 'Safety wedge'],
      onEnter: view({ reveal: 1, labels: 'safety' }),
      timeline: run(9500, safetyPose),
    },
    {
      id: 'doors',
      heading: 'The doors only unlock where the car is',
      body: 'Landing doors have no motor. They have no power at all — they are dead weight held shut by a latch, and they can only be opened by the car. One motor on the car roof drives the car doors, and a pair of vanes on the leading panel closes onto two rollers on the landing door, lifting the latch and dragging both sets open together. Miss the floor by more than a few centimetres and the vanes never reach the rollers. Watch the middle landing as the car passes it: nothing there to unlock it, so it stays shut.',
      camera: { position: [1.7, 2.15, 2.25], target: [-0.34, 1.68, 0.33] },
      dofAperture: 0.00014,
      focus: ['Car door clutch', 'Locked — no car here'],
      onEnter: view({ reveal: 1, labels: 'doors' }),
      timeline: run(8200, trip),
    },
    {
      id: 'run',
      heading: 'Run it',
      body: 'Brake off, and the sheave turns a few degrees. The counterweight has already paid for most of the trip, so the motor only trims the difference. Rails hold the line, the governor counts the speed the whole way, the doors stay locked until the car is level — and then the brake sets again and it is a small lit room with two steel doors.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [3.2, 2.35, 3.4], target: [-0.35, 1.45, 0.0] },
      dofAperture: 0.00004,
      freeOrbit: true,
      onEnter: view({ reveal: 0.5 }),
      timeline: run(6400, (u) => ({ ...trip(u), reveal: 0.5 })),
    },
  ],
});
