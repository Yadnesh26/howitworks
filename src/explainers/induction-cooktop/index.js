import { defineExplainer } from '../../framework/index.js';
import { win } from '../../framework/motion.js';
import meta from './meta.js';
import { buildCooktop } from './model.js';

// Reveal story: the sealed hob with a pan on it, then the glass ghosts and the
// pan lifts away to expose the flat litz coil, then the power board that makes
// 25 kHz out of 50 Hz, then the field, then a sectioned pan showing the eddy
// currents that do the actual cooking, then the pan lifted live so load
// sensing cuts the zone — and a free-orbit finale with everything sealed and
// running again.
//
// Seamless loops: setPhase is a single 0-1 phase ridden by every flow (current
// along the power path and the coil spiral, energy around the flux loops,
// eddy currents around the rings in the pan base) via getPointAt, which wraps
// mod 1 — frame 0 == frame 1 at any duration. The fan turns 9 whole turns per
// lap and every emissive breathes on whole sine cycles. The pan lift in step 6
// is a smoothstep window that starts and ends at exactly 0.

// Pin ALL scene state on entering a step (pre-flight #4): reveal, cutaway,
// field, heat, pan height, zone power and labels — so scrolling either way
// lands on the same frame.
const view =
  ({
    reveal = 1,
    pan = true,
    display = false,
    cut = 0,
    field = false,
    heat = 0,
    lift = 0,
    power = 1,
    labels = false,
  }) =>
  ({ handles }) => {
    handles.setReveal(reveal);
    handles.setPanShown(pan);
    handles.setDisplayShown(display);
    handles.setPanCut(cut);
    handles.showField(field);
    handles.setHeat(heat);
    handles.setLift(lift);
    handles.setPower(power);
    handles.setLabels(labels);
  };

function phaseLoop(duration) {
  return ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL state — never share tween targets across steps
    tl.add(s, { t: 1, duration, ease: 'linear', onUpdate: () => handles.setPhase(s.t) });
  };
}

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildCooktop({ scene });
  },

  steps: [
    {
      id: 'complete',
      heading: 'Nothing in here gets hot',
      body: 'A slab of black glass, a pan, and no flame and no glowing ring anywhere. Set water on it and it boils faster than a kettle — but slide the pan aside mid-boil and the glass is only warm where the pan was sitting, and cold two centimetres away. That is the whole story of this machine: it never heats up. It makes the pan heat itself.',
      hint: 'Drag to orbit · scroll to look inside.',
      camera: { position: [3.13, 2.46, 4.45], target: [-0.35, 0.7, 0.3] },
      dofAperture: 0.00003,
      // heat 0 on purpose: the copy promises "no glowing ring anywhere", and a
      // real pan base at cooking temperature does not glow either
      onEnter: view({ reveal: 0, display: true, heat: 0, labels: 'exterior' }),
      timeline: phaseLoop(6000),
    },
    {
      id: 'coil',
      heading: 'One flat coil of wire',
      body: 'Take the pan off, take the glass away, and there is no heating element to find. What sits under the cooking zone is a spiral of wire wound flat like a clock spring — about 180 millimetres across, twenty-two turns. It is litz wire: hundreds of hair-thin strands, each separately varnished, twisted into one bundle so the wire does not cook itself. Six ferrite bars point outward underneath like spokes, aiming the magnetic field upward instead of letting it leak into the electronics.',
      camera: { position: [1.45, 2.85, 3.24], target: [-0.59, 0.62, -0.05] },
      dofAperture: 0.00012,
      focus: ['Litz-wire coil — 22 turns', 'Ferrite bars'],
      onEnter: view({ reveal: 1, pan: false, labels: 'coil' }),
      timeline: phaseLoop(5000),
    },
    {
      id: 'power',
      heading: 'Fifty hertz in, twenty-five thousand out',
      body: 'Wall current alternates fifty times a second — far too slow to be useful here. It arrives through a filter of chokes and capacitors whose only job is to keep the noise this board makes from escaping back into your house wiring. Then a bridge rectifier folds the wave one way and a fat capacitor smooths it into a steady 325 volts, and a pair of IGBTs switch that supply on and off about twenty-five thousand times a second, with a resonant capacitor ringing alongside the coil. Deliberately above the top of your hearing — the alternative is a cooktop that screams.',
      camera: { position: [1.05, 2.45, 4.5], target: [-0.69, 0.48, 1.22] },
      dofAperture: 0.00022,
      focus: ['IGBT half-bridge', 'Bridge rectifier'],
      onEnter: view({ reveal: 1, pan: false, labels: 'power' }),
      timeline: phaseLoop(3600),
    },
    {
      id: 'field',
      heading: 'A field that flips 25,000 times a second',
      body: 'Current going round a coil always drags a magnetic field along with it, and this current reverses direction twenty-five thousand times a second — so the field flips north-south just as fast. The worktop does not get a vote. Glass-ceramic is not magnetic and does not conduct, so the field passes straight through it as if it were not there, up into the steel disc in the bottom of the pan.',
      hint: 'Cyan is the magnetic field; amber is current.',
      camera: { position: [2.42, 2.28, 3.5], target: [-0.55, 0.78, 0.1] },
      dofAperture: 0.00008,
      focus: ['Oscillating field · 25 kHz', 'Glass is invisible to magnetism'],
      onEnter: view({ reveal: 1, field: true, heat: 0.25, labels: 'field' }),
      timeline: phaseLoop(3600),
    },
    {
      id: 'eddy',
      heading: 'The pan is the element',
      body: 'A magnetic field that changes through a piece of metal drives loops of current inside it: eddy currents. The steel resists them, and that resistance is heat. Because iron pulls the field in so tightly, almost all of it happens in the outer tenth of a millimetre of the base — a skin thinner than a sheet of paper, made red-hot from within. Cut the base open and you find why good pans are layered: the heat is born in the magnetic steel underneath, and a slab of aluminium above it spreads that heat sideways before it reaches your food.',
      hint: 'Sectioned so you can see into the base.',
      camera: { position: [1.31, 2.79, 2.38], target: [-0.61, 0.78, 0.09] },
      dofAperture: 0.00018,
      focus: ['Eddy currents', 'Heat in the outer 0.1 mm'],
      onEnter: view({ reveal: 1, cut: 1, field: true, heat: 1, labels: 'heat' }),
      timeline: phaseLoop(3200),
    },
    {
      id: 'detect',
      heading: 'Why it has to be iron',
      body: 'Lift the pan and the field has nothing left to push against. A small transformer clipped around the coil feed is watching the current the whole time, and an unloaded coil draws a different current — so the zone stops delivering power almost at once, which is also why a spoon or a stray fork never heats up. Aluminium and copper pans fail the same test for a different reason: not magnetic, and too good at conducting to turn those currents into much heat. The honest test for induction cookware is a fridge magnet.',
      camera: { position: [2.25, 2.95, 3.9], target: [-0.67, 1.12, 0.1] },
      dofAperture: 0.00008,
      focus: ['No pan — no load', 'Load sensing cuts the power'],
      onEnter: view({ reveal: 1, display: true, field: true, heat: 0.9, labels: 'detect' }),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5400,
          ease: 'linear',
          onUpdate: () => {
            handles.setPhase(s.t);
            // starts and ends at exactly 0 — the lap wraps on itself
            const lift = 0.7 * (win(s.t, 0.16, 0.36) - win(s.t, 0.64, 0.84));
            handles.setLift(lift);
            handles.setPower(1 - Math.min(1, lift / 0.09));
          },
        });
      },
    },
    {
      id: 'run',
      heading: 'Run it',
      body: 'Rectify, chop, oscillate, induce. Mains current becomes a 25 kHz magnetic field, the field becomes current in the steel, and the steel becomes the burner. Around 85 per cent of what leaves the wall ends up in the food — against roughly 70 for a radiant electric ring and 40 for gas. Everything else in the kitchen stays exactly as cold as it was.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [3.73, 2.51, 3.45], target: [-0.19, 0.7, 0.38] },
      freeOrbit: true,
      onEnter: view({ reveal: 0, display: true, heat: 0.55 }),
      timeline: phaseLoop(3200),
    },
  ],
});
