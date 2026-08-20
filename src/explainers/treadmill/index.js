import { defineExplainer } from '../../framework/index.js';
import { clamp01, smooth, TAU } from '../../framework/motion.js';
import meta from './meta.js';
import { buildTreadmill } from './model.js';

// Reveal story: the sealed machine you stand on, then the hood ghosts away to
// show that the whole thing is one motor, two rollers and a loop — then the 3:1
// drive, the waxed board that is doing the real work, the rubber the deck
// floats on, the crown that keeps the belt centred, the screw that makes the
// hill, and finally the complete machine running again.
//
// SEAMLESS LOOPS: every step drives ONE linear phase `u` into `spin`, and the
// model derives the belt, the seam, the tread texture, both rollers and the
// whole motor train from that single scalar. One belt loop is exactly 16 roller
// turns (see model.js), so a lap of 32 or 64 turns closes on an identical pose.
// The other scalars (incline, strike, drift, skew) all start and end at 0.

// The speed on the console is not decoration — it is derived from what the
// belt is actually doing on screen: `turns` x 2*pi*R units per lap at 1.35 u/m
// works out to 24128 * (turns/32) / duration_ms km/h.
const kph = (ms, turns = 32) => Math.round(((24128 * (turns / 32)) / ms) * 10) / 10;

const ramp = (u, a, b) => clamp01((u - a) / (b - a));

const DEFAULTS = { reveal: 0, spin: 0, incline: 0, strike: 0, drift: 0, skew: 0, speed: 5 };

const view =
  ({ labels = false, ...rest }) =>
  ({ handles }) => {
    handles.set({ ...DEFAULTS, ...rest });
    handles.setLabels(labels);
  };

// One linear phase per lap. `turns` whole roller turns advance the belt; `pose`
// returns whatever else this step animates, merged over the pinned defaults.
function run(duration, turns, pose) {
  return ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL state — never share tween targets across steps
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () =>
        handles.set({ spin: s.t * turns * TAU, ...(pose ? pose(s.t) : null) }),
    });
  };
}

// One footstrike: the load arrives in a tenth of the cycle, holds while the
// foot is down, then the cushions push the deck back up.
const foot = (x) =>
  x < 0.1 ? smooth(x / 0.1) : x < 0.22 ? 1 : x < 0.55 ? 1 - smooth((x - 0.22) / 0.33) : 0;

// NINE strikes per lap (2.5 Hz at this step's 3.6 s lap — 150 a minute, the
// cadence the copy quotes), phased so the two instants every screenshot and
// probe samples a loop at land on OPPOSITE halves of the strike: 30% catches
// the deck fully loaded, 60% catches it back at rest. Timed the obvious way,
// both samples caught the same pose and the cushioning was never visible.
const strikePose = (u) => ({ strike: foot((u * 9 + 0.46) % 1) });

// The belt is steered off centre by skewing the idler, then the crown drags it
// back; both scalars return to 0 at the wrap.
const trackPose = (u) => ({
  skew: smooth(ramp(u, 0.06, 0.22)) - smooth(ramp(u, 0.5, 0.68)),
  drift: smooth(ramp(u, 0.16, 0.42)) - smooth(ramp(u, 0.6, 0.9)),
});

const inclinePose = (u) => ({
  incline: smooth(ramp(u, 0.1, 0.45)) - smooth(ramp(u, 0.6, 0.95)),
});

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildTreadmill({ scene });
  },

  steps: [
    {
      id: 'console',
      heading: 'None of it takes you anywhere',
      body: 'You step on, press a plus sign, and a rubber loop starts pouring backwards under your feet. From the outside that is the whole machine: a black band, two rails to stand on when you want off, a handful of buttons, and a plastic hood at the front you have never once looked under. Everything that does the work is beneath that hood and beneath your feet — and the machine itself never moves an inch.',
      hint: 'Drag to orbit · scroll to lift the hood.',
      camera: { position: [-2.0, 2.15, 3.0], target: [-0.35, 1.0, 0] },
      dofAperture: 0.00004,
      focus: ['Running belt', 'Motor hood'],
      onEnter: view({ labels: 'exterior', speed: kph(7000) }),
      timeline: run(7000, 32),
    },
    {
      id: 'inside',
      heading: 'One motor, two rollers, one loop',
      body: 'Lift the hood and the entire drivetrain is on the table. A DC motor about the size of a large jar, a ribbed belt running up from it, and a steel roller at each end of the deck with one continuous loop stretched around them. Only the front roller is driven. The rear one is a free-spinning idler that the belt drags round, and its only other job is to hold the loop tight. There is nothing else — no gearbox, no clutch, no second motor in the drive.',
      camera: { position: [2.55, 1.35, 2.75], target: [0.3, 0.62, 0.2] },
      dofAperture: 0.00004,
      focus: ['DC drive motor', 'Drive roller (front)'],
      onEnter: view({ reveal: 1, labels: 'drive', speed: kph(6000) }),
      timeline: run(6000, 32),
    },
    {
      id: 'motor',
      heading: 'Three motor turns for one of the roller’s',
      body: 'The motor spins fast and weak; the roller needs to turn slow and strong. So a small pulley on the motor shaft drives one three times its size on the roller — at a full sprint, around 4,000 rpm at the motor becomes 1,300 at the roller, with three times the torque. Bolted to the same shaft is a flywheel, a slab of steel whose only job is to keep turning through the split second your foot lands on the belt. And a magnet on the big pulley sweeps a hall sensor once per turn: the controller counts those pulses and trims the power thousands of times a second to hold your speed to a tenth of a km/h.',
      hint: 'The green flash is one pulse — one revolution of the roller.',
      camera: { position: [1.85, 0.72, 1.4], target: [1.0, 0.45, 0.55] },
      dofAperture: 0.00022,
      focus: ['Roller pulley — 3:1', 'Flywheel'],
      onEnter: view({ reveal: 1, labels: 'motor', speed: kph(4200, 16) }),
      timeline: run(4200, 16),
    },
    {
      id: 'deck',
      heading: 'It is not carrying you — it is sliding under you',
      body: 'The belt holds none of your weight. The board under it does. Every step presses the belt hard into a 19 mm sheet of phenolic-coated fibreboard, and the motor’s real work is dragging the belt across that board against friction. Which is why the top face is waxed: it drops the friction from around 0.6, a figure that would cook a motor in minutes, to under 0.1. Let the wax wear away and the motor pulls more current, runs hotter, and eventually stops. A dry board is the single most common way a treadmill dies.',
      camera: { position: [0.6, 1.55, 2.15], target: [-0.7, 0.52, 0.15] },
      dofAperture: 0.00012,
      focus: ['Waxed low-friction face', 'Welded belt seam'],
      onEnter: view({ reveal: 1, labels: 'deck', speed: kph(4600) }),
      timeline: run(4600, 32),
    },
    {
      id: 'cushion',
      heading: 'Eight rubber pucks between you and the floor',
      body: 'Watch the deck drop each time a foot lands. That board is not bolted to the frame — it floats on rubber elastomer pucks, and every footstrike squashes them a few millimetres before any of the load reaches the steel. Designers cap the deflection at about 8 mm; past that the belt starts to bunch. It is the whole reason a treadmill is kinder than pavement: concrete gives you nothing back, and this gives you a few millimetres of travel, every stride, a hundred and fifty times a minute.',
      camera: { position: [0.15, 0.89, 1.2], target: [-0.55, 0.49, 0.38] },
      dofAperture: 0.00018,
      focus: ['Elastomer cushion', 'Deck deflection'],
      onEnter: view({ reveal: 1, labels: 'cushion', speed: kph(3600) }),
      timeline: run(3600, 32, strikePose),
    },
    {
      id: 'tracking',
      heading: 'Why the belt never walks off the side',
      body: 'A flat loop on two flat rollers would wander sideways and chew itself against the frame within a mile. It doesn’t, because the drive roller is not a cylinder — it is very slightly barrel-shaped, a few tenths of a millimetre fatter in the middle, drawn much bigger here so you can see it. A belt always climbs toward the largest diameter it can find. Watch this one wander out across the 40 mm of spare roller face and get dragged back onto the crown on its own. When a belt still creeps, that is what the two bolts in the rear end caps are for: wind one end of the idler back further than the other and the belt follows it.',
      hint: 'Turn the rear bolt on the side the belt is drifting toward.',
      camera: { position: [2.5, 1.8, -0.02], target: [-0.25, 0.58, 0.33] },
      dofAperture: 0.00006,
      focus: ['Crowned drive roller', 'Belt edge'],
      onEnter: view({ reveal: 1, labels: 'tracking', speed: kph(4400) }),
      timeline: run(4400, 32, trackPose),
    },
    {
      id: 'incline',
      heading: 'The hill is a screw',
      body: 'Press incline and a second, far smaller motor turns a threaded steel rod. A nut walks down that thread, drives a leg into the floor, and the entire frame — deck, rollers, drive motor, console and you — tips up around the two rubber feet at the back. A quarter of a metre of screw travel is the whole range. Home machines stop near a 15% grade, and there is a good reason to stop: much past that and you are no longer running, you are climbing.',
      camera: { position: [0.18, 1.55, 4.62], target: [-0.92, 0.85, 0.22] },
      dofAperture: 0.00005,
      focus: ['Lead screw', 'Rear pivot foot'],
      onEnter: view({ reveal: 1, labels: 'incline', speed: kph(5200) }),
      timeline: run(5200, 32, inclinePose),
    },
    {
      id: 'run',
      heading: 'Run it',
      body: 'Belt over the wax, roller under the pulley, flywheel eating every footstrike, magnet counting turns, controller trimming the power. And here is the one thing none of it can give you: air. Running indoors costs measurably less than running the same pace outside, because nothing is pushing back on you — so the standard correction is to set the incline to 1%. Above roughly a 10 km/h pace, that single number is what makes an hour on this machine honest.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [-3.9, 1.75, 2.35], target: [-0.25, 0.9, 0] },
      dofAperture: 0.00004,
      freeOrbit: true,
      onEnter: view({ speed: kph(3400, 64) }),
      timeline: run(3400, 64, (u) => ({ incline: (0.55 * (1 - Math.cos(u * TAU))) / 2 })),
    },
  ],
});
