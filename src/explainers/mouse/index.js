import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildMouse } from './model.js';

// Zoom-in / reveal: the sealed product, the shell ghosted to the mechanism,
// a macro on the switch that snaps, the wheel's encoder, the magnified
// sensor cutaway (the payoff — it never touches the desk), the frame-diff
// that becomes your cursor, then sealed and running again.

const view =
  (partial, labelMode = false) =>
  ({ handles }) => {
    handles.set(partial);
    handles.setLabels(labelMode);
  };

// Every step's onEnter pins the FULL state — anything left unset inherits the
// previous step's mid-lap phase and misframes a fixed camera.
const REST = { reveal: 0, click: 0, scroll: 0, strobe: 0, macro: 0, light: 0, data: 0 };

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildMouse({ scene });
  },

  stageOptions: { dof: true },

  steps: [
    {
      id: 'complete',
      heading: '1 · The shape your hand already knows',
      body: 'Under one moulded shell: two buttons, a wheel, and — facing down at the desk — a camera. Not a metaphor for a camera. An actual one, photographing the surface underneath at a rate no eye could follow, and never once touching it.',
      hint: 'Drag to orbit · scroll to open it up.',
      camera: { position: [3.15, 2.05, -2.75], target: [-0.05, 0.44, 0.12] },
      onEnter: view({ ...REST }, 'exterior'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5200,
          ease: 'linear',
          onUpdate: () => handles.set({ strobe: s.t }),
        });
      },
    },
    {
      id: 'open',
      heading: '2 · Four jobs, one board',
      body: 'Ghost the shell and almost all of it is a single circuit board. A microswitch sits under each button, an encoder rides the wheel\'s axle, and the sensor hangs off the underside looking at the desk. One microcontroller reads all four and speaks for them.',
      hint: 'The shell is faded, not removed — everything sits where it really does.',
      camera: { position: [2.7, 1.8, -2.3], target: [0.0, 0.36, -0.12] },
      onEnter: view({ ...REST, reveal: 1 }, 'internal'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5200,
          ease: 'linear',
          onUpdate: () => handles.set({ strobe: s.t }),
        });
      },
    },
    {
      id: 'click',
      heading: '3 · The click is a spring giving up',
      body: 'Press a button and it pivots on its back edge, driving a stem down about half a millimetre. Inside, a bent metal leaf is held just short of collapsing — until that last fraction of travel pushes it past its own centre and it buckles, slapping the contact shut. The sound you hear and the signal the computer gets are the same event.',
      hint: 'Left button, then right. Watch the leaf let go a beat after the stem starts moving.',
      camera: { position: [1.85, 1.2, -1.95], target: [0.14, 0.33, -0.6] },
      dofAperture: 0.00026,
      focus: ['Snap-action microswitch'],
      onEnter: view({ ...REST, reveal: 1 }, 'click'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3400,
          ease: 'linear',
          onUpdate: () => handles.set({ click: s.t }),
        });
      },
    },
    {
      id: 'scroll',
      heading: '4 · Twenty clicks to a turn',
      body: 'The wheel turns a disc cut with slots, spinning it through a beam of light. Two detectors sit slightly apart, so their signals rise and fall out of step — whichever one leads tells the mouse which way you turned. Counting slot edges tells it how far. A sprung arm dropping into notches supplies the clicks your finger feels.',
      hint: 'The ridged disc outboard of the wheel is the encoder; the light passes through its slots.',
      camera: { position: [2.0, 1.45, -1.55], target: [0.05, 0.48, -0.45] },
      dofAperture: 0.00024,
      focus: ['Slotted encoder disc'],
      onEnter: view({ ...REST, reveal: 1 }, 'scroll'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          // 3 whole turns per lap — the wheel wraps on an identical pose
          duration: 2800,
          ease: 'linear',
          onUpdate: () => handles.set({ scroll: s.t * Math.PI * 6 }),
        });
      },
    },
    {
      id: 'sensor',
      heading: '5 · Why the light comes in sideways',
      body: 'Here is the gap under the sensor, magnified enormously. The LED does not shine straight down — it skims across the desk almost flat. At that angle every speck and fibre throws a long shadow, so a surface that looks perfectly smooth turns into a landscape of light and dark. A lens gathers that patch and lands it on a CMOS array: about 1,500 photographs every second.',
      hint: 'Real gap: a couple of millimetres. Watch the light go out flat, hit the texture, and come back up into the lens.',
      camera: { position: [5.15, 1.85, 2.5], target: [3.38, 0.66, 0] },
      dofAperture: 0.00019,
      focus: ['LED skims the desk'],
      onEnter: view({ ...REST, macro: 1 }, 'sensor'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3800,
          ease: 'linear',
          onUpdate: () => handles.set({ strobe: s.t, light: (s.t * 2) % 1 }),
        });
      },
    },
    {
      id: 'signal',
      heading: '6 · It never knows where it is',
      body: 'The chip does not recognise your desk, and it has no idea where the mouse sits. It only lines each photo up against the one before and measures how far the speckle pattern slid. That shift — a few thousandths of an inch, fifteen hundred times a second — is the whole signal. It leaves as a stream of "moved this much, this way", up to a thousand times a second.',
      hint: 'Pulses leaving the chip and heading out the cable are those dx / dy reports.',
      camera: { position: [2.5, 1.6, -2.05], target: [0.0, 0.3, -0.28] },
      dofAperture: 0.00022,
      focus: ['Compares each frame'],
      onEnter: view({ ...REST, reveal: 1 }, 'signal'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3200,
          ease: 'linear',
          onUpdate: () => handles.set({ strobe: s.t, data: (s.t * 3) % 1 }),
        });
      },
    },
    {
      id: 'run',
      heading: '7 · A camera you drive with your palm',
      body: 'Sealed up, it goes back to looking like a lump of plastic. Underneath, a red light is still skimming your desk, a chip is still comparing photographs faster than you can blink, and a tiny spring is still waiting to give up the moment you decide to click.',
      hint: 'Drag to orbit.',
      camera: { position: [3.15, 2.05, -2.75], target: [-0.05, 0.44, 0.12] },
      freeOrbit: true,
      onEnter: view({ ...REST }),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3000,
          ease: 'linear',
          onUpdate: () => handles.set({ strobe: s.t }),
        });
      },
    },
  ],
});
