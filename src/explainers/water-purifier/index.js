import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildPurifier } from './model.js';

// Anatomy-first story (not zoom-in/reveal): a real under-sink RO install has
// no outer skin to hide behind, so every stage is visible from frame one.
// Step 1 is the full labeled overview; each following step walks one system
// (pre-filters -> booster pump -> membrane -> tank/drain -> post-filter/tap)
// before a fast free-orbit finale.
//
// Seamless loops: `flow`/`permeate` advance a WHOLE number of cycles per lap
// (dot position is `(phase + i/count) % 1`); `pumpSpin` advances whole turns;
// `tankLevel`/`gauge` use a raised-cosine breathe (0.5 - 0.5*cos(u*TAU)) that
// starts and ends at the same value by construction, so they loop cleanly
// without needing a modulo.

const TAU = Math.PI * 2;

const pin =
  (labels, { tankLevel = 0, glass = false } = {}) =>
  ({ handles }) => {
    handles.set({ flow: 0, permeate: 0, pumpSpin: 0, gauge: 0, tankLevel });
    handles.setLabels(labels);
    handles.setGlass(glass);
  };

const breathe = (u) => 0.5 - 0.5 * Math.cos(u * TAU);

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildPurifier({ scene });
  },

  steps: [
    {
      id: 'overview',
      heading: '1 · A real under-sink RO system',
      body: 'Unlike a sealed appliance, an under-sink RO system has no cabinet to hide behind — it is a wall-mounted rack of cartridges, a small booster pump, a membrane housing, and a separate pressure tank on the cabinet floor, all plumbed together and feeding a dedicated faucet up on the counter.',
      hint: 'Drag to orbit · scroll to walk through each stage.',
      camera: { position: [4.3, 2.55, 5.1], target: [0.25, 1.15, 0.05] },
      dofAperture: 0.00003,
      onEnter: pin('overview'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, { t: 1, duration: 6000, ease: 'linear', onUpdate: () => handles.set({ flow: s.t }) });
      },
    },
    {
      id: 'prefilters',
      heading: '2 · Sediment and carbon strip the big stuff',
      body: 'Raw feed water first passes a 5-micron sediment cartridge — a pleated barrier that physically traps sand, rust and dirt. Next, a block of activated carbon adsorbs chlorine and the organic compounds that carry taste and odour. Neither stage touches dissolved salts; they just protect the membrane downstream from anything that would clog or degrade it.',
      hint: 'Watch the water clear as it passes each cartridge.',
      camera: { position: [0.85, 1.4, 1.45], target: [-0.42, 1.05, -0.1] },
      dofAperture: 0.00012,
      onEnter: pin('prefilter'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, { t: 1, duration: 3200, ease: 'linear', onUpdate: () => handles.set({ flow: s.t }) });
      },
    },
    {
      id: 'pump',
      heading: '3 · The booster pump builds pressure',
      body: 'Tap pressure alone cannot push water through a membrane fine enough to stop dissolved salts — osmosis would pull water the wrong way. A small booster pump lifts the feed to roughly 60–80 psi, comfortably past the osmotic pressure of the dissolved solids, which is what actually forces water through the membrane against its natural gradient.',
      camera: { position: [0.4, 1.0, 0.95], target: [-0.1, 0.85, -0.12] },
      dofAperture: 0.00015,
      onEnter: pin('pump'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 2800,
          ease: 'linear',
          onUpdate: () =>
            handles.set({
              flow: s.t,
              pumpSpin: s.t * TAU * 6,
              gauge: 0.72 + 0.05 * Math.sin(s.t * TAU * 5),
            }),
        });
      },
    },
    {
      id: 'membrane',
      heading: '4 · Reverse osmosis at the membrane',
      body: 'Inside the housing, a sheet of semi-permeable membrane is wound in a spiral around a perforated central tube. Its pores are only about 0.0001 micron wide — small enough to pass water molecules but reject up to 99% of the dissolved solids, heavy metals and salts riding along with them. Pressurised feed runs the length of the spiral: a fraction slips through the membrane wall as permeate and spirals inward to the central tube, while the rest — now carrying the rejected minerals — keeps travelling as concentrate.',
      hint: 'Blue dots slip through the membrane; the rest keep going as concentrate.',
      camera: { position: [0.35, 0.68, 1.15], target: [-0.15, 0.42, -0.12] },
      dofAperture: 0.00025,
      onEnter: pin('membrane'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3400,
          ease: 'linear',
          onUpdate: () =>
            handles.set({
              flow: s.t,
              permeate: s.t,
              pumpSpin: s.t * TAU * 7,
              gauge: 0.72 + 0.05 * Math.sin(s.t * TAU * 5),
            }),
        });
      },
    },
    {
      id: 'tank',
      heading: '5 · Storage tank, and where the waste goes',
      body: 'Permeate collects in a pressurised storage tank until an auto shut-off valve senses it is full and closes, stopping flow through the membrane — a linked pressure switch then cuts power to the pump. Concentrate never stops at the tank at all — it runs straight out through a saddle valve clamped onto the drain line, carrying away everything the membrane rejected. Older systems waste roughly four litres for every litre purified; efficient modern pumps get that down closer to one or two.',
      camera: { position: [2.32, 1.25, 1.6], target: [1.15, 0.85, 0.12] },
      dofAperture: 0.00015,
      onEnter: pin('tank'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4200,
          ease: 'linear',
          onUpdate: () =>
            handles.set({
              flow: s.t,
              permeate: s.t,
              pumpSpin: s.t * TAU * 8,
              gauge: 0.72 + 0.05 * Math.sin(s.t * TAU * 5),
              tankLevel: 0.15 + 0.78 * breathe(s.t),
            }),
        });
      },
    },
    {
      id: 'post-filter',
      heading: '6 · One last polish, then the tap',
      body: 'Drawn from the tank, water passes a short inline carbon polishing filter tucked under the counter — a last pass to catch any taste picked up from sitting in storage — before it reaches the dedicated faucet. What comes out is water stripped of sediment, chlorine, and up to 99% of everything that was ever dissolved in it.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [0.95, 2.4, 1.85], target: [-0.1, 2.15, 0.45] },
      dofAperture: 0.00012,
      freeOrbit: true,
      onEnter: pin('post', { tankLevel: 0.55, glass: true }),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 2600,
          ease: 'linear',
          onUpdate: () =>
            handles.set({
              flow: s.t * 1.4,
              permeate: s.t * 1.4,
              pumpSpin: s.t * TAU * 5,
              gauge: 0.7 + 0.05 * Math.sin(s.t * TAU * 5),
            }),
        });
      },
    },
  ],
});
