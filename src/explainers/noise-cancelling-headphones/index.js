import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildHeadphones } from './model.js';

// Every step loops while active. Seamlessness rule: setPhase wraps mod 1
// (waves, diaphragm, mic pulses all resolve to an identical pose at 0/1);
// setSpin advances whole turns; setReveal is pinned per step, not animated
// mid-loop (the ghosting is a state cut between steps, not a scrubbed reveal).

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildHeadphones({ scene });
  },

  stageOptions: { dof: true },

  steps: [
    {
      id: 'overview',
      heading: '1 · Two microphones, one trick',
      body: 'These look like ordinary over-ear headphones. But each earcup is quietly listening in two directions at once — one microphone facing out, one facing in — and using what it hears to erase the noise around you before it ever reaches your eardrum.',
      hint: 'Drag to orbit · scroll to dig in.',
      camera: { position: [1.7, 1.55, 3.75], target: [0.05, 0.95, 0] },
      dofAperture: 0.00002,
      onEnter: ({ handles }) => {
        handles.setReveal(0);
        handles.setBlocked(false);
        handles.setWaveMode('off');
        handles.setMicIntro(false, false);
        handles.setLabels('exterior');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 7000,
          ease: 'linear',
          onUpdate: () => {
            handles.setSpin(s.t * 360);
            handles.setPhase(s.t);
          },
        });
      },
    },
    {
      id: 'reveal',
      heading: '2 · What is hiding under the shell',
      body: 'Pull the outer shell away and the trick is right there: a driver to make sound, a small board to run the math, and two microphones — one on the outside of the cup, one on the inside, each doing a different job.',
      camera: { position: [1.55, 1.35, 2.2], target: [0.75, 0.98, 0.05] },
      dofAperture: 0.0001,
      onEnter: ({ handles }) => {
        handles.setSpin(0);
        handles.setReveal(1);
        handles.setBlocked(false);
        handles.setWaveMode('off');
        handles.setMicIntro(false, false);
        handles.setLabels(false);
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4000,
          ease: 'linear',
          onUpdate: () => handles.setPhase(s.t),
        });
      },
    },
    {
      id: 'driver',
      heading: '3 · The part that makes every sound',
      body: 'A magnet sits behind a coil of copper wire attached to a thin diaphragm. Send it an electrical signal and the coil pushes and pulls against the magnet’s field, and the diaphragm shivers back and forth thousands of times a second. This one driver plays your music AND the anti-noise — mixed together, at the same time.',
      camera: { position: [1.7, 1.15, 0.85], target: [0.88, 0.95, 0.0] },
      dofAperture: 0.00018,
      onEnter: ({ handles }) => {
        handles.setSpin(0);
        handles.setReveal(1);
        handles.setBlocked(false);
        handles.setWaveMode('off');
        handles.setMicIntro(false, false);
        handles.setLabels('driver');
      },
      focus: ['Diaphragm', 'Voice coil', 'Magnet'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 2600,
          ease: 'linear',
          onUpdate: () => handles.setPhase(s.t),
        });
      },
    },
    {
      id: 'feedforward',
      heading: '4 · Listening before the noise arrives',
      body: 'The outward-facing microphone catches ambient sound — an engine drone, the hum of a plane cabin — an instant before it reaches your ear. That head start matters: it gives the processor just enough time to build a response before the real sound gets there.',
      camera: { position: [2.0, 1.4, 1.2], target: [1.13, 1.15, 0.06] },
      dofAperture: 0.00012,
      onEnter: ({ handles }) => {
        handles.setSpin(0);
        handles.setReveal(1);
        handles.setBlocked(false);
        handles.setWaveMode('noise');
        handles.setMicIntro(true, false);
        handles.setLabels('feedforward');
      },
      focus: ['Feedforward mic — outward-facing', 'Incoming ambient noise'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3200,
          ease: 'linear',
          onUpdate: () => handles.setPhase(s.t),
        });
      },
    },
    {
      id: 'antinoise',
      heading: '5 · A wave built to erase a wave',
      body: 'The processor flips that captured noise upside down — inverted, peak for trough — and the driver plays it back as “anti-noise.” Where the two waves meet, they add up to nothing: this is destructive interference, the same physics that makes noise-cancelling headphones look like magic.',
      camera: { position: [1.55, 1.15, 1.0], target: [0.65, 0.93, 0.0] },
      dofAperture: 0.00015,
      onEnter: ({ handles }) => {
        handles.setSpin(0);
        handles.setReveal(1);
        handles.setBlocked(false);
        handles.setWaveMode('full');
        handles.setMicIntro(true, false);
        handles.setLabels('antinoise');
      },
      focus: ['Anti-noise — inverted wave', 'Destructive interference'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3000,
          ease: 'linear',
          onUpdate: () => handles.setPhase(s.t),
        });
      },
    },
    {
      id: 'feedback',
      heading: '6 · Double-checking the result',
      body: 'A second microphone, facing inward toward your eardrum, listens to what actually got through. If the seal shifts or the cancellation is not quite perfect, this inward mic catches the leftover noise and the processor corrects the anti-noise signal on the fly, continuously.',
      camera: { position: [1.65, 1.3, 1.0], target: [0.86, 1.06, 0.06] },
      dofAperture: 0.00015,
      onEnter: ({ handles }) => {
        handles.setSpin(0);
        handles.setReveal(1);
        handles.setBlocked(false);
        handles.setWaveMode('full');
        handles.setMicIntro(true, true);
        handles.setLabels('feedback');
      },
      focus: ['Feedback mic — inward-facing', 'Residual noise correction'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3000,
          ease: 'linear',
          onUpdate: () => handles.setPhase(s.t),
        });
      },
    },
    {
      id: 'passive',
      heading: '7 · Why it cannot cancel a voice',
      body: 'This whole trick only works on slow, steady waves — engine drone, HVAC hum, the low rumble of a cabin. Fast, changing sounds like speech move too quickly for the processor to track and invert in time. Those get stopped the old-fashioned way: the foam cushion physically sealing against your head, like an earplug.',
      camera: { position: [1.9, 1.35, 1.3], target: [0.78, 0.98, 0.06] },
      dofAperture: 0.00013,
      onEnter: ({ handles }) => {
        handles.setSpin(0);
        handles.setReveal(1);
        handles.setBlocked(true);
        handles.setWaveMode('full');
        handles.setMicIntro(true, true);
        handles.setLabels('passive');
      },
      focus: ['Foam seal blocks the highs', 'Electronics cancel the lows'],
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3400,
          ease: 'linear',
          onUpdate: () => handles.setPhase(s.t),
        });
      },
    },
    {
      id: 'finale',
      heading: '8 · Silence, engineered',
      body: 'The shell closes back up and every trick disappears from view — two microphones, one driver, and a wave shaped to erase another wave, working continuously, tens of thousands of times a second, so the world gets quieter the moment you put them on.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [1.85, 1.65, 3.9], target: [0, 0.98, 0] },
      freeOrbit: true,
      dofAperture: 0.00002,
      onEnter: ({ handles }) => {
        handles.setReveal(0);
        handles.setBlocked(false);
        handles.setWaveMode('off');
        handles.setMicIntro(false, false);
        handles.setLabels(false);
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4000,
          ease: 'linear',
          onUpdate: () => {
            handles.setSpin(s.t * 360);
            handles.setPhase(s.t);
          },
        });
      },
    },
  ],
});
