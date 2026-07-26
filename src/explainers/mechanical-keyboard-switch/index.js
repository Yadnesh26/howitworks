import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildMechanicalKeyboardSwitch } from './model.js';

// The story uses the zoom-in / reveal shape:
//   Step 1: Complete solid product (keycap + housing)
//   Step 2: Anatomy — remove keycap, ghost housing, callouts
//   Step 3: Actuation — loop the press cycle, contacts glow
//   Step 4: Click mechanism — zoom into the click jacket
//   Step 5: Contact reset — slow release loop
//   Step 6: Free orbit, full run
//
// Every step has its own local state object (gotcha #1 — never share across timelines).
// One lap of press (0→1→0) = one complete keystroke cycle, seamless loop.

// Helper: pin reveal + keycap + label state so backward scrolling is consistent
const view = (reveal, keycap, labels) =>
  ({ handles }) => {
    handles.setReveal(reveal);
    handles.setKeycap(keycap);
    handles.setLabels(labels);
  };

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildMechanicalKeyboardSwitch({ scene });
  },

  steps: [
    {
      id: 'product',
      heading: '1 · The key',
      body: 'Press any key on a mechanical keyboard and you feel something no membrane keyboard can match — a crisp, deliberate click and a spring-loaded snap back. Under every key sits a self-contained electromechanical switch about the size of a sugar cube. From the outside it looks simple: a plastic cap on a stem. Scroll down and we\'ll take it apart layer by layer.',
      hint: 'Drag to orbit · scroll to continue.',
      camera: { position: [0.4, 1.8, 2.8], target: [0, 0.85, 0] },
      onEnter: view(0, true, false),
      timeline({ tl, handles }) {
        const s = { p: 0 };
        tl.add(s, {
          p: 1,
          duration: 8000,
          ease: 'linear',
          onUpdate: () => {
            // subtle breathing press — just a tiny hint of life
            const wave = 0.5 - 0.5 * Math.cos(s.p * Math.PI * 2);
            handles.setPress(wave * 0.06);
          },
        });
      },
    },
    {
      id: 'anatomy',
      heading: '2 · Inside the housing',
      body: 'Ghost the shell and three things appear: a coiled steel spring that pushes the stem back up, a sliding plastic stem that carries the keycap on a cross-shaped pole, and a pair of thin metal leaf springs at the bottom whose tips are the actual electrical contacts. That\'s the whole circuit — nothing electronic, just physics.',
      hint: 'Drag to orbit the open switch.',
      camera: { position: [0.55, 1.4, 2.2], target: [0, 0.55, 0] },
      onEnter: view(1, false, true),
      timeline({ tl, handles }) {
        const s = { p: 0 };
        tl.add(s, {
          p: 1,
          duration: 9000,
          ease: 'linear',
          onUpdate: () => {
            const wave = 0.5 - 0.5 * Math.cos(s.p * Math.PI * 2);
            handles.setPress(wave * 0.08);
          },
        });
      },
    },
    {
      id: 'actuation',
      heading: '3 · The actuation point',
      body: 'Press the key and the stem slides down, compressing the spring. At exactly 2 mm of travel — about halfway — the stem\'s shoulder nudges the movable contact leaf and bends it across to touch the fixed leaf. The circuit closes. That instant is the actuation point: the computer sees the keystroke before you reach the bottom of the stroke. You can lift your finger immediately after the click and the press still registers.',
      hint: 'Watch the gold contacts glow as the circuit closes.',
      camera: { position: [-0.6, 0.8, 2.0], target: [0, 0.22, 0] },
      onEnter: view(1, false, false),
      timeline({ tl, handles }) {
        const s = { p: 0 };
        tl.add(s, {
          p: 1,
          duration: 4000,
          ease: 'linear',
          onUpdate: () => {
            // slow press down, fast release — models natural keystroke timing
            const t = s.p;
            let press;
            if (t < 0.45) {
              // press down smoothly to 85%
              press = (t / 0.45) * 0.85;
            } else if (t < 0.6) {
              // hold at bottom briefly
              press = 0.85;
            } else {
              // quick release
              press = 0.85 * (1 - (t - 0.6) / 0.4);
            }
            handles.setPress(press);
          },
        });
      },
    },
    {
      id: 'click',
      heading: '4 · The click mechanism',
      body: 'This is a Cherry MX Blue — the clicky variant. Alongside the stem rides a small separate piece called the click jacket. As the stem descends, the jacket is dragged along. When the stem\'s cam leg passes a threshold, the jacket suddenly snaps downward under spring tension — that snap is the audible click and the sharp tactile jolt. On a linear switch there is no jacket; on a tactile switch the stem leg itself has a bump but makes no sound.',
      hint: 'Watch the click jacket snap at actuation.',
      camera: { position: [0.9, 0.92, 1.55], target: [0.12, 0.42, 0] },
      onEnter: view(1, false, false),
      timeline({ tl, handles }) {
        const s = { p: 0 };
        tl.add(s, {
          p: 1,
          duration: 5000,
          ease: 'linear',
          onUpdate: () => {
            const t = s.p;
            // slower, more deliberate press to make the snap visible
            let press;
            if (t < 0.5) {
              press = (t / 0.5) * 0.7;
            } else if (t < 0.65) {
              press = 0.7 + ((t - 0.5) / 0.15) * 0.2;
            } else {
              press = 0.9 * (1 - (t - 0.65) / 0.35);
            }
            handles.setPress(Math.max(0, press));
          },
        });
      },
    },
    {
      id: 'reset',
      heading: '5 · Reset and debounce',
      body: 'Release the key and the compressed spring pushes the stem back up. The movable contact leaf springs back to its resting gap — the circuit opens, but the keyboard\'s controller waits a few milliseconds before accepting another press. That pause is called debounce: metal contacts don\'t make or break cleanly in one instant; they bounce and chatter, so software filters out the noise. Without it, one physical press could register as dozens.',
      hint: 'Watch the spring push the stem back up.',
      camera: { position: [-0.4, 1.0, 2.1], target: [0, 0.45, 0] },
      onEnter: view(1, false, false),
      timeline({ tl, handles }) {
        const s = { p: 0 };
        tl.add(s, {
          p: 1,
          duration: 5000,
          ease: 'linear',
          onUpdate: () => {
            const t = s.p;
            // hold pressed, then slow release with a micro-bounce
            let press;
            if (t < 0.2) {
              press = 0.85;
            } else if (t < 0.55) {
              const rel = (t - 0.2) / 0.35;
              press = 0.85 * (1 - rel);
            } else if (t < 0.65) {
              // chatter bounce
              press = 0.04 * Math.abs(Math.sin((t - 0.55) * Math.PI * 6 / 0.1));
            } else {
              press = 0;
            }
            handles.setPress(Math.max(0, press));
          },
        });
      },
    },
    {
      id: 'run',
      heading: 'The complete switch',
      body: 'Spring, stem, click jacket, contacts — four parts, zero electronics. Every keystroke is a loop: spring pushes up, finger pushes down, jacket snaps, contacts close, circuit fires, spring resets. A well-built mechanical switch is rated for 50–100 million keystrokes, which at 60 words per minute would take a decade of non-stop typing to exhaust.',
      hint: 'Drag to orbit the running switch.',
      camera: { position: [0.9, 1.6, 3.0], target: [0, 0.6, 0] },
      freeOrbit: true,
      onEnter: view(1, false, false),
      timeline({ tl, handles }) {
        const s = { p: 0 };
        tl.add(s, {
          p: 1,
          duration: 3500,
          ease: 'linear',
          onUpdate: () => {
            const wave = 0.5 - 0.5 * Math.cos(s.p * Math.PI * 2);
            handles.setPress(wave * 0.92);
          },
        });
      },
    },
  ],
});
