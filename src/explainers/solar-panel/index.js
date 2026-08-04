import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildSolarPanel } from './model.js';

// Every step loops while active. `reveal`/`sunVisible`/`heroPop`/`lightOn`/
// `bulbOn` are discrete per-step poses pinned in onEnter; `photonPhase`/
// `electronPhase` are the only continuously-tweened scalars (modulo-1, so
// any whole-cycle delta per lap is seamless by construction).

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildSolarPanel({ scene });
  },

  stageOptions: { dof: true },

  steps: [
    {
      id: 'overview',
      heading: '1 · A sealed module',
      body: "Sixty silicon cells, laminated glass to backsheet, framed in anodized aluminum and racked at the angle your roof gets the most sun. From the outside it's inert — nothing here spins or burns. Everything that happens, happens to electrons.",
      hint: 'Drag to orbit · scroll to see how.',
      camera: { position: [3.5, 2.1, 5.1], target: [0, 1.55, 0.3] },
      onEnter: ({ handles }) => {
        handles.setLabels('exterior');
        handles.set({ reveal: 0, sunVisible: 0, heroPop: 0, lightOn: 0, bulbOn: 0 });
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 7000,
          ease: 'linear',
          onUpdate: () => handles.set({ photonPhase: s.t, electronPhase: s.t }),
        });
      },
    },
    {
      id: 'sun',
      heading: '2 · Where the light comes from',
      body: "The rack tilts the module to face the sun straight on. In its core, hydrogen fuses into helium at about 15,000,000°C. That energy takes roughly 100,000 years just to random-walk out through the sun's own bulk — then, once it leaves the surface as light, only about 8 minutes to cross 150 million km of space. Only photons energetic enough to clear silicon's 1.1eV bandgap can do anything once they land.",
      camera: { position: [6.2, 4.6, 9.8], target: [1.1, 3.1, 1.6] },
      onEnter: ({ handles }) => {
        handles.setLabels('sun');
        handles.set({ reveal: 0, sunVisible: 1, heroPop: 0, lightOn: 1, bulbOn: 0 });
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 8000,
          ease: 'linear',
          onUpdate: () => handles.set({ photonPhase: s.t, electronPhase: s.t }),
        });
      },
    },
    {
      id: 'stack',
      heading: '3 · Five layers, pulled apart',
      body: "Glass on top, a black polymer backsheet on the bottom, and the cells themselves sandwiched between two sheets of EVA plastic that get heated until they fuse everything into one waterproof laminate — about 4.5mm thick, sitting inside a much deeper aluminum frame.",
      camera: { position: [2.8, 1.9, 0.5], target: [0, 1.5, -0.35] },
      dofAperture: 0.00018,
      onEnter: ({ handles }) => {
        handles.setLabels('stack');
        handles.set({ reveal: 1, sunVisible: 0, heroPop: 0, lightOn: 1, bulbOn: 0 });
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6000,
          ease: 'linear',
          onUpdate: () => handles.set({ photonPhase: s.t, electronPhase: s.t }),
        });
      },
    },
    {
      id: 'cell',
      heading: '4 · One cell, up close',
      body: 'A thick base of p-type silicon carries a wafer-thin n-type skin diffused onto its face — the junction between them. When a photon frees an electron there, the junction\'s own built-in electric field sweeps that electron toward the front contact and pushes its paired hole the other way. That separation IS the electricity.',
      camera: { position: [2.3, 1.85, -0.6], target: [1.35, 1.74, -0.34] },
      dofAperture: 0.00032,
      onEnter: ({ handles }) => {
        handles.setLabels('cell');
        handles.set({ reveal: 1, sunVisible: 0, heroPop: 1, lightOn: 1, bulbOn: 0 });
      },
      focus: ['n-type layer (~0.5µm)', 'p-type silicon base'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5000,
          ease: 'linear',
          onUpdate: () => handles.set({ photonPhase: s.t, electronPhase: s.t }),
        });
      },
    },
    {
      id: 'wiring',
      heading: '5 · Sixty cells, one string',
      body: 'Each cell only makes about half a volt. Silver ribbons solder the front of every cell to the back of the next, wiring all sixty in series so their voltages stack — roughly 36V DC by the time current reaches the edge of the module.',
      camera: { position: [3.3, 2.0, 4.7], target: [0, 1.6, 0.3] },
      onEnter: ({ handles }) => {
        handles.setLabels('wiring');
        handles.set({ reveal: 1, sunVisible: 0, heroPop: 0, lightOn: 1, bulbOn: 0 });
      },
      focus: ['60 cells wired in series', '~36V DC per module'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6500,
          ease: 'linear',
          onUpdate: () => handles.set({ photonPhase: s.t, electronPhase: s.t }),
        });
      },
    },
    {
      id: 'output',
      heading: '6 · Off to the wiring',
      body: 'The string is split into three 20-cell groups, each guarded by its own bypass diode — if one section is shaded, current routes around it instead of stalling the whole module. Two DC leads carry the current out of the junction box, on to an inverter.',
      camera: { position: [1.75, 1.0, -2.15], target: [-0.25, 0.72, -0.22] },
      onEnter: ({ handles }) => {
        handles.setLabels('output');
        handles.set({ reveal: 0, sunVisible: 0, heroPop: 0, lightOn: 1, bulbOn: 0 });
      },
      focus: ['3 bypass diodes, one per string', 'DC output leads'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5500,
          ease: 'linear',
          onUpdate: () => handles.set({ photonPhase: s.t, electronPhase: s.t }),
        });
      },
    },
    {
      id: 'run',
      heading: '7 · Sunlight in, current out',
      body: "Sealed back up and facing the sky, the whole module runs on nothing but this: photons landing, electrons freed, a junction sorting them into a current. No moving parts, no fuel — just silicon doing what silicon does in the light, enough to light this bulb.",
      camera: { position: [-2.7, 1.9, 4.6], target: [0.35, 1.15, 0.25] },
      freeOrbit: true,
      onEnter: ({ handles }) => {
        handles.setLabels('payoff');
        handles.set({ reveal: 0, sunVisible: 1, heroPop: 0, lightOn: 1, bulbOn: 1 });
      },
      focus: ['Real DC output — lights this bulb'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4200,
          ease: 'linear',
          onUpdate: () => handles.set({ photonPhase: s.t, electronPhase: s.t }),
        });
      },
    },
  ],
});
