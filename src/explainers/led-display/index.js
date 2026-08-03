import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildLedDisplay } from './model.js';

// Every step loops while active. Seamlessness rule: setContent/setScan/setPWM
// all wrap mod 1; setReveal is a single lap that starts and ends seated,
// front-facing, and lit — identical poses at the wrap.

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildLedDisplay({ scene });
  },

  stageOptions: { dof: true },

  steps: [
    {
      id: 'overview',
      heading: '1 · A wall of tiny lights',
      body: 'This is a modular LED video wall — four cabinets, each packed with a grid of pixel modules. There is no backlight and no LCD layer: every pixel is its own tiny light source, so the image looks bright and punchy from any angle.',
      hint: 'Drag to orbit · scroll to dig in.',
      camera: { position: [3.0, 2.35, 4.4], target: [0.2, 1.85, 0] },
      dofAperture: 0.00006,
      onEnter: ({ handles }) => {
        handles.setHeroPose(0, 0);
        handles.setLabels('exterior');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 7000,
          ease: 'linear',
          onUpdate: () => handles.setContent(s.t),
        });
      },
    },
    {
      id: 'pixels',
      heading: '2 · Seams you can barely see',
      body: 'Push in close and the picture dissolves into its parts: a dense grid of individual pixels, each one a self-contained red/green/blue package about ten millimetres across. Modules butt up edge-to-edge — the join between them is a hairline, not a border.',
      camera: { position: [1.55, 1.62, 2.05], target: [0.83, 1.02, 0.05] },
      dofAperture: 0.00035,
      onEnter: ({ handles }) => {
        handles.setHeroPose(0, 0);
        handles.setLabels('pixels');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5000,
          ease: 'linear',
          onUpdate: () => handles.setContent(s.t * 0.6),
        });
      },
    },
    {
      id: 'reveal',
      heading: '3 · Front-serviceable',
      body: 'Modular cabinets like this one are built to be repaired from the front. A module is held on with blind-mate contacts, not a cable — pull it straight off and it disconnects cleanly, exposing the cabinet frame and the electronics normally hidden behind it.',
      hint: 'Watch one module release and re-seat.',
      camera: { position: [2.15, 2.85, 2.75], target: [0.55, 2.35, 0.5] },
      dofAperture: 0.00012,
      onEnter: ({ handles }) => {
        handles.setContent(0.4, false);
        handles.setLabels('reveal');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6000,
          ease: 'linear',
          onUpdate: () => handles.setReveal(s.t),
        });
      },
    },
    {
      id: 'anatomy',
      heading: '4 · What is behind a pixel',
      body: 'Flip the module around and the front face turns out to be the simple side. The back carries the driver ICs that switch every LED, a handful of filter capacitors, and the blind-mate connector — no ribbon cable, no cage of wires, just contacts that meet the cabinet frame.',
      camera: { position: [1.25, 2.68, 2.15], target: [0.55, 2.36, 0.63] },
      dofAperture: 0.00015,
      onEnter: ({ handles }) => {
        handles.setContent(0.4, false);
        handles.setHeroPose(1, 180);
        handles.setHeroBlank();
        handles.setLabels('anatomy');
      },
      focus: ['Driver IC', 'Capacitor', 'Blind-mate connector', 'PCB'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5000,
          ease: 'linear',
          onUpdate: () => {
            const turn = 180 + Math.sin(s.t * Math.PI * 2) * 6;
            handles.setHeroPose(1, turn);
          },
        });
      },
    },
    {
      id: 'scan',
      heading: '5 · Rows scanned in turn',
      body: 'The driver ICs cannot light all 256 pixels in a module at once — they scan it a few rows at a time, cycling through every group thousands of times a second while data for the next row shifts in behind them. It happens far faster than your eye can follow.',
      camera: { position: [1.1, 2.52, 1.35], target: [0.5, 2.35, 0.63] },
      dofAperture: 0.0002,
      onEnter: ({ handles }) => {
        handles.setContent(0.4, false);
        handles.setHeroPose(1, 0);
        handles.setLabels('scan');
      },
      focus: ['Active row group', 'Data shifting in'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3000,
          ease: 'linear',
          onUpdate: () => handles.setScan(s.t),
        });
      },
    },
    {
      id: 'color',
      heading: '6 · Three colors, every shade',
      body: 'Each pixel only ever makes red, green, or blue light — there is no fourth color. Every shade you see is the driver rapidly varying how long each of the three dies stays on; too close together and too fast to separate, so your eye blends them into one mixed color.',
      camera: { position: [0.76, 2.42, 1.14], target: [0.5, 2.35, 0.63] },
      dofAperture: 0.00007,
      onEnter: ({ handles }) => {
        handles.setContent(0.4, false);
        handles.setHeroPose(1, 0);
        handles.setLabels('color');
      },
      focus: ['Red · green · blue dies'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4000,
          ease: 'linear',
          onUpdate: () => handles.setPWM(s.t),
        });
      },
    },
    {
      id: 'data',
      heading: '7 · Feeding the wall',
      body: 'Behind every cabinet sits a receiving card that takes in a stream of frame data and power, then distributes it to each module in turn. Cabinets daisy-chain from one to the next, all the way back to a video processor slicing the source picture into per-cabinet pieces — around sixty times a second.',
      camera: { position: [2.15, 1.95, 1.15], target: [0.5, 2.35, -0.05] },
      dofAperture: 0.0001,
      onEnter: ({ handles }) => {
        handles.setContent(0.4, false);
        handles.setHeroPose(1, 180);
        handles.setHeroBlank();
        handles.setLabels('data');
      },
      focus: ['Receiving card', 'Data cable — daisy-chained', 'Power supply'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5000,
          ease: 'linear',
          onUpdate: () => handles.setHeroPose(1, 180 + Math.sin(s.t * Math.PI * 2) * 4),
        });
      },
    },
    {
      id: 'finale',
      heading: '8 · One seamless picture',
      body: 'The module is back on its contacts and rejoining the scan. Step back and every trick disappears — thousands of individually switched dies, scanned row by row, PWM-dimmed thousands of times a second, reading as one smooth, seamless picture.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [3.3, 2.6, 4.7], target: [0.2, 1.85, 0] },
      freeOrbit: true,
      dofAperture: 0.00006,
      onEnter: ({ handles }) => {
        handles.setHeroPose(0, 0);
        handles.setLabels(false);
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4000,
          ease: 'linear',
          onUpdate: () => handles.setContent(s.t),
        });
      },
    },
  ],
});
