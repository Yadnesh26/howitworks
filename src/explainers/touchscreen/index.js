import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildTouchscreen } from './model.js';

// Every step loops while active. Seamlessness: spin advances whole turns (or
// runs a full sine cycle back to zero), the scan sweep covers exactly one full
// frame of drive rows per lap, the charge-packet phase wraps mod 1, and the
// tip's press is a single cosine tap that starts and ends parked. setReveal is
// one lap that opens and closes the stack, so u=0 and u=1 are identical.
//
// Every onEnter calls handles.pin(...), which resets EVERY state scalar to its
// default before merging the step's values — no step can inherit the previous
// step's mid-lap phase.

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildTouchscreen({ scene });
  },

  stageOptions: { dof: true },

  steps: [
    {
      id: 'overview',
      heading: '1 · A machine with nothing moving in it',
      body: 'No switch closes here. No contact wipes, no dome collapses, nothing wears out — this whole machine is a sheet of glass over a sandwich of films. Everything it knows about your finger, it works out from an electrical measurement so small it is easier to state in millionths of a millionth of a farad.',
      hint: 'Drag to orbit · scroll to dig in.',
      camera: { position: [2.89, 2.28, 4.31], target: [-0.52, 0.3, 0.46] },
      dofAperture: 0.00005,
      onEnter: ({ handles }) => {
        handles.pin({ ghost: 0 });
        handles.setLabels('exterior');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 7000,
          ease: 'linear',
          onUpdate: () => handles.set({ spin: s.t * Math.PI * 2 }),
        });
      },
    },
    {
      id: 'stack',
      heading: '2 · Seven layers, and most of them are films',
      body: 'Lift it apart and there is barely anything there: chemically strengthened cover glass about 0.6 mm thick, a film of optically clear adhesive, then two sensor layers separated by a whisper of dielectric, more adhesive, and the display underneath. The sensor films are drawn far thicker here than they really are — the conductive layer itself is around a hundred nanometres, roughly a thousandth of a hair.',
      hint: 'Thicknesses exaggerated so the sandwich can be seen at all.',
      camera: { position: [2.72, 2.55, 3.69], target: [-0.4, 0.66, 0.4] },
      dofAperture: 0.00007,
      onEnter: ({ handles }) => {
        handles.pin({ ghost: 1 });
        handles.setLabels('stack');
      },
      focus: ['Cover glass — 0.6 mm', 'Sense layer — columns', 'Drive layer — rows'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 8000,
          ease: 'linear',
          onUpdate: () => handles.setReveal(s.t),
        });
      },
    },
    {
      id: 'grid',
      heading: '3 · The grid you have been looking through',
      body: 'Both sensor layers are etched into interlocking diamonds of indium tin oxide — an oxide that conducts electricity and passes light, which is why you have never once noticed it. One layer chains its diamonds across into thirteen drive rows; the other chains them the other way into twenty-eight sense columns. That is 364 crossings, five millimetres apart. Tinted here; invisible in the real thing.',
      camera: { position: [1.85, 1.62, 2.0], target: [0.2, 0.66, 0.04] },
      dofAperture: 0.00016,
      onEnter: ({ handles }) => {
        handles.pin({ ghost: 1, open: 1 });
        handles.setLabels('grid');
      },
      focus: ['Drive row', 'Sense column'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6500,
          ease: 'linear',
          onUpdate: () => handles.set({ spin: Math.sin(s.t * Math.PI * 2) * 0.075 }),
        });
      },
    },
    {
      id: 'node',
      heading: '4 · Every crossing is a tiny capacitor',
      body: 'Close the stack and push in on one crossing. The controller pulses the drive electrode; charge fringes off it, arcs up through the cover glass and lands on the sense electrode alongside. That coupling is the entire measurement — about three picofarads, and left alone it is rock steady, all day, at every one of the 364 crossings.',
      camera: { position: [0.76, 0.6, 0.66], target: [0.33, 0.4, 0.0] },
      dofAperture: 0.00042,
      onEnter: ({ handles }) => {
        handles.pin({ ghost: 1, arcs: 1 });
        handles.setLabels('node');
      },
      focus: ['Fringing field', 'Drive electrode', 'Sense electrode'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3200,
          ease: 'linear',
          onUpdate: () => handles.set({ flow: s.t }),
        });
      },
    },
    {
      id: 'touch',
      heading: '5 · A touch makes the signal go down',
      body: 'This is the part almost everyone has backwards. A fingertip is a soft conductor wired to a body that carries roughly a hundred picofarads to ground, so parking it over the crossing does not add anything — it intercepts the arcs that were heading for the sense electrode and drains them away. The coupling falls by a few hundred femtofarads. That missing charge is the touch.',
      hint: 'No hand: this is the grounded test tip labs probe panels with — electrically, your fingertip.',
      camera: { position: [0.02, 0.71, 0.88], target: [0.33, 0.41, -0.02] },
      dofAperture: 0.00034,
      onEnter: ({ handles }) => {
        handles.pin({ ghost: 1, arcs: 1, probeOn: 1 });
        handles.setLabels('touch');
      },
      focus: ['Grounded test tip', 'Field diverted to ground', 'Coupling 3.10 pF'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4200,
          ease: 'linear',
          onUpdate: () => {
            // one cosine tap per lap: parked -> pressed -> parked, identical
            // at the wrap. Touch strength follows the press so the map only
            // dips while the tip is actually down.
            const press = 0.5 - 0.5 * Math.cos(s.t * Math.PI * 2);
            handles.set({ flow: (s.t * 2) % 1, press, touch: press * press });
          },
        });
      },
    },
    {
      id: 'scan',
      heading: '6 · The whole sheet, 120 times a second',
      body: 'The controller cannot listen everywhere at once, so it drives one row at a time and samples every column simultaneously — one row, twenty-eight readings, next row. All thirteen rows take about eight milliseconds, then it starts over. What comes out is not a coordinate. It is a small picture of how much capacitance each crossing just lost.',
      camera: { position: [2.63, 2.36, 3.31], target: [-0.12, 0.4, 0.34] },
      dofAperture: 0.00009,
      onEnter: ({ handles }) => {
        handles.pin({ ghost: 1, scanning: 1, touch: 1 });
        handles.setLabels('scan');
      },
      focus: ['Active drive row', 'All columns sampled at once', 'Touch controller'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3400,
          ease: 'linear',
          // exactly one full frame of drive rows per lap
          onUpdate: () => handles.set({ scanPhase: s.t }),
        });
      },
    },
    {
      id: 'centroid',
      heading: '7 · A blur becomes a coordinate',
      body: 'Take the tip away and this is all the controller ever has. A fingertip flattens to a contact patch around nine millimetres across — wider than the five millimetre grid — so several crossings dip together, by different amounts. Weight their positions by how much each one dropped and the answer lands far finer than the mesh it came from: a coarse grid of 364 nodes resolving a touch to a fraction of a millimetre.',
      camera: { position: [0.98, 1.18, 1.08], target: [0.33, 0.41, -0.01] },
      dofAperture: 0.00022,
      onEnter: ({ handles }) => {
        handles.pin({ ghost: 1, touch: 1, centroid: 1 });
        handles.setLabels('centroid');
      },
      focus: ['Nodes that dipped', 'Interpolated centre'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5200,
          ease: 'linear',
          onUpdate: () => {
            // the touch drifts across two nodes and back — the marker tracks it
            // continuously, not in 5mm jumps
            const d = Math.sin(s.t * Math.PI * 2);
            handles.set({ tx: 0.35 + d * 0.11, tz: 0.0 + d * 0.045 });
          },
        });
      },
    },
    {
      id: 'finale',
      heading: '8 · Why a glove kills it stone dead',
      body: 'Glass back on, screen live. The bare tip lands and the screen answers at once — nothing pushed, nothing clicked, just a few hundred femtofarads quietly going missing from one corner of a grid you cannot see. Then the same tap goes in through a dry glove, and a millimetre of fabric holding the conductor off the field is the whole difference. The sheet still scans, the controller still listens, and it hears nothing at all.',
      hint: 'Same tap twice — bare, then gloved.',
      camera: { position: [2.99, 2.22, 4.41], target: [-0.52, 0.3, 0.47] },
      freeOrbit: true,
      dofAperture: 0.00005,
      onEnter: ({ handles }) => {
        handles.pin({ ghost: 0, probeOn: 1 });
        handles.setLabels(false);
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 7600,
          ease: 'linear',
          onUpdate: () => handles.setFinale(s.t),
        });
      },
    },
  ],
});
