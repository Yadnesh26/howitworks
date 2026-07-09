import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildTransformer } from './model.js';

// Every step loops while active. Seamlessness rule: `current` is driven as
// sin(phase) with phase advancing a whole number of 2*pi per lap, so a lap
// always starts and ends at current=0 — identical pose, invisible wrap.

function tri(t) {
  return 1 - Math.abs(1 - 2 * t);
}

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildTransformer({ scene });
  },

  steps: [
    {
      id: 'anatomy',
      heading: '1 · The component',
      body: 'Two coils of copper wire, wound on opposite legs of a closed iron core — a many-turn primary on the left, a thick, few-turn secondary on the right. There is no wire connecting them at all. Everything a transformer does happens through the core between them.',
      hint: 'Drag to orbit.',
      camera: { position: [2.0, 1.85, 2.5], target: [0, 1.25, 0] },
      onEnter: ({ handles }) => {
        handles.set({ fluxViz: 0, ghost: 0, secondaryViz: 1, showRatio: false, solidAmount: 0, eddyViz: 0 });
        handles.setLabels('anatomy', true);
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6000,
          ease: 'linear',
          onUpdate: () => handles.set({ current: Math.sin(s.t * Math.PI * 2 * 3) }),
        });
      },
    },
    {
      id: 'primary',
      heading: '2 · Current makes a changing flux',
      body: 'Push alternating current through the primary and it builds a magnetic flux in the core — and because the current keeps reversing, that flux keeps rising, falling and reversing too. This changing flux is the entire point: it is what will reach across to the other winding.',
      camera: { position: [1.15, 1.65, 1.55], target: [-0.25, 1.25, 0] },
      onEnter: ({ handles }) => {
        handles.set({ fluxViz: 1, ghost: 0.6, secondaryViz: 0, showRatio: false, solidAmount: 0, eddyViz: 0 });
        handles.setLabels('primary', true);
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4200,
          ease: 'linear',
          onUpdate: () => handles.set({ current: Math.sin(s.t * Math.PI * 2 * 2) }),
        });
      },
    },
    {
      id: 'induce',
      heading: '3 · Flux induces the secondary',
      body: "That same flux threads the secondary winding too, since both coils share the one core. By Faraday's law, a changing flux through a coil induces a voltage in it — the secondary lights up in lockstep with the primary, with no wire ever crossing between them.",
      camera: { position: [1.9, 1.7, 2.15], target: [0, 1.25, 0] },
      onEnter: ({ handles }) => {
        handles.set({ fluxViz: 1, ghost: 0.6, secondaryViz: 1, showRatio: false, solidAmount: 0, eddyViz: 0 });
        handles.setLabels('induce', true);
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4400,
          ease: 'linear',
          onUpdate: () => handles.set({ current: Math.sin(s.t * Math.PI * 2 * 2) }),
        });
      },
    },
    {
      id: 'ratio',
      heading: '4 · The turns ratio sets the trade',
      body: 'Compare the windings: 32 turns on the primary, only 8 on the secondary — a 4:1 ratio. Vs/Vp = Ns/Np, so this steps 240V down to 60V. Power is conserved, so current trades the other way: 0.5A in becomes 2A out, which is exactly why the secondary is wound with thicker wire.',
      camera: { position: [1.55, 1.55, 1.85], target: [0, 1.15, 0] },
      onEnter: ({ handles }) => {
        handles.set({ fluxViz: 0.3, ghost: 0, secondaryViz: 1, showRatio: true, solidAmount: 0, eddyViz: 0 });
        handles.setLabels('ratio', true);
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5000,
          ease: 'linear',
          onUpdate: () => handles.set({ current: Math.sin(s.t * Math.PI * 2 * 2) }),
        });
      },
    },
    {
      id: 'ac-only',
      heading: '5 · Why only AC works',
      body: "Feed it steady DC instead and watch: the instant the current stops changing, the induced flash on the secondary dies out completely, even though current is still flowing hard through the primary. Only a CHANGING flux induces anything — switch back to AC and the secondary comes right back to life.",
      camera: { position: [1.2, 1.7, 1.6], target: [-0.1, 1.25, 0] },
      onEnter: ({ handles }) => {
        handles.set({ fluxViz: 1, ghost: 0.6, secondaryViz: 1, showRatio: false, solidAmount: 0, eddyViz: 0 });
        handles.setLabels('ac', true);
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6200,
          ease: 'linear',
          onUpdate: () => {
            const t = s.t;
            let current;
            if (t < 0.12) {
              current = (1 - Math.cos((t / 0.12) * Math.PI)) * 0.4; // ramp 0 -> 0.8
            } else if (t < 0.42) {
              current = 0.8; // steady DC — flux constant, nothing induced
            } else if (t < 0.5) {
              const u = (t - 0.42) / 0.08;
              current = 0.8 * (1 - (1 - Math.cos(u * Math.PI)) * 0.5); // ramp 0.8 -> 0
            } else {
              const u = (t - 0.5) / 0.5;
              current = Math.sin(u * Math.PI * 2 * 3); // 3 whole AC cycles, ends at 0
            }
            handles.set({ current });
          },
        });
      },
    },
    {
      id: 'lamination',
      heading: '6 · Why the core is laminated',
      body: 'The core itself sits in that changing field, so it would grow its own large circulating "eddy currents" if left solid — wasted current that only makes heat. Real cores are built from many thin, individually insulated steel sheets instead of one solid block, which confines those eddies to tiny slivers and cuts the loss sharply.',
      camera: { position: [0.55, 2.3, 1.05], target: [0, 1.9, 0] },
      onEnter: ({ handles }) => {
        handles.set({ fluxViz: 0.25, ghost: 0.85, secondaryViz: 1, showRatio: false, eddyViz: 1 });
        handles.setLabels('lamination', true);
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5200,
          ease: 'linear',
          onUpdate: () =>
            handles.set({
              current: Math.sin(s.t * Math.PI * 2 * 2),
              solidAmount: tri(s.t),
            }),
        });
      },
    },
    {
      id: 'grid',
      heading: '7 · The same trick runs the grid',
      body: 'Zoom out and this is the exact mechanism behind the power grid: step voltage way up after a plant (lower current, so transmission lines waste far less to resistive heating over hundreds of miles), then step it back down in stages until it reaches your wall — the same turns ratio, just far more extreme.',
      camera: { position: [2.3, 2.0, 2.9], target: [0, 1.25, 0] },
      onEnter: ({ handles }) => {
        handles.set({ fluxViz: 0.5, ghost: 0, secondaryViz: 1, showRatio: false, solidAmount: 0, eddyViz: 0 });
        handles.setLabels('grid', true);
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5000,
          ease: 'linear',
          onUpdate: () => handles.set({ current: Math.sin(s.t * Math.PI * 2 * 2) }),
        });
      },
    },
    {
      id: 'run',
      heading: '8 · Quietly stepping voltage',
      body: 'Reassembled, this same pair of coils is doing the same thing in every wall adapter, substation and utility pole transformer on the grid — trading voltage for current through nothing but a shared, changing magnetic field.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [2.1, 1.9, 2.6], target: [0, 1.25, 0.1] },
      freeOrbit: true,
      onEnter: ({ handles }) => {
        handles.set({ fluxViz: 0.6, ghost: 0, secondaryViz: 1, showRatio: false, solidAmount: 0, eddyViz: 0 });
        handles.setLabels('run', false);
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3000,
          ease: 'linear',
          onUpdate: () => handles.set({ current: Math.sin(s.t * Math.PI * 2 * 3) }),
        });
      },
    },
  ],
});
