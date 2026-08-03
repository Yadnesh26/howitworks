import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildHardDiskDrive } from './model.js';

// Zoom-in / reveal story: the complete sealed drive, cover off to show the
// parked mechanism at rest, spin-up into flight, a hugely exaggerated macro
// cutaway of the ~3nm air gap (the whole point of the video), a seek across
// the tracks, a head-crash danger beat, then reassembled and running.

const view =
  (partial, labelMode = false) =>
  ({ handles }) => {
    handles.set(partial);
    handles.setLabels(labelMode);
  };

// PLATTER spin only. The product itself never rotates on its own — orbiting
// the drive is the viewer's job (drag), and an auto-turntable both fights that
// input and makes every exported video look like a showroom plinth.
function spinLoop(turns, duration) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () => handles.setSpin(s.t * turns * Math.PI * 2),
    });
  };
}

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildHardDiskDrive({ scene });
  },

  steps: [
    {
      id: 'complete',
      heading: '1 · A sealed metal box',
      body: 'This is the box you were told never to drop. Inside, a stack of spinning platters holds every photo and file as microscopic magnetic patterns, read by a head that never touches them. That last part sounds impossible — a head that reads a spinning disk without ever making contact — but it is exactly how every hard drive on Earth works. Let\'s open the case.',
      hint: 'Nothing is moving yet — the drive is powered off. Drag to orbit it; scroll to take the lid off.',
      camera: { position: [2.6, 1.9, 2.9], target: [0, 0.55, 0] },
      onEnter: view({ turntable: 0, reveal: 0, spin: 0, seek: 0, fly: 0, macro: 0, crash: 0 }, 'exterior'),
      timeline: spinLoop(0, 7000),
    },
    {
      id: 'open',
      heading: '2 · Parked, not resting',
      body: 'With the cover off: a stack of platters on a spindle motor, and a pivoting arm — the actuator — tipped with the read/write head. Right now the drive is off, and the head sits lifted on a plastic ramp just past the platter\'s edge, never touching the surface. That parked position exists because what happens when this thing spins up is far too delicate to risk resting on.',
      hint: 'Still frozen: the platters are stationary and the arm is swung off to the side, resting on the ramp.',
      camera: { position: [2.2, 1.75, 2.4], target: [0, 0.5, 0.05] },
      onEnter: view({ turntable: 0, reveal: 1, spin: 0, seek: 0, fly: 0, macro: 0, crash: 0 }, 'internal'),
      timeline: spinLoop(0, 6000),
    },
    {
      id: 'flight',
      heading: '3 · Flying, not touching',
      body: 'Power on: the spindle motor spins the platters up to 7200 RPM or more — at the platter\'s edge, that is highway speed sliding past a few nanometres away. The arm swings the head off the ramp and out over the spinning surface. It does not lower onto the disk. It flies, riding a cushion of air its own shape drags into existence, held there by aerodynamics alone.',
      hint: 'The platters are now turning; the arm has swung off the ramp and its tip sits out over the disk surface.',
      camera: { position: [2.05, 1.7, 2.2], target: [0.05, 0.5, 0] },
      onEnter: view({ turntable: 0, reveal: 1, seek: 0.42, fly: 1, macro: 0, crash: 0 }, 'flight'),
      timeline: spinLoop(3.5, 3400),
    },
    {
      id: 'macro',
      heading: '4 · Closer than a jet to the ground',
      body: 'Zoomed in a million times over: the slider\'s underside is etched with microscopic rails — the Air Bearing Surface — that scoop up the boundary layer of air the spinning platter drags along with it. That air cushions the slider at a fly height of roughly 3 nanometres: about 1/25,000th the width of a human hair. Relatively, that is closer than a jet flying at an altimeter-measured hair\'s width above the runway. The read/write element rides right at the trailing edge, the closest point of all.',
      hint: 'Side-on, hugely magnified. The bright band under the slider IS the gap — the blue dots are air being dragged through it by the platter below.',
      camera: { position: [4.15, 3.55, 1.75], target: [1.95, 3.02, 0.05] },
      dofAperture: 0.00018,
      onEnter: view({ turntable: 0, reveal: 1, fly: 1, seek: 0.42, macro: 1, crash: 0 }, 'macro'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4200,
          ease: 'linear',
          onUpdate: () => {
            handles.setSpin(s.t * 2 * Math.PI * 2);
            handles.setAirflow(s.t % 1);
          },
        });
      },
    },
    {
      id: 'seek',
      heading: '5 · Finding the right track',
      body: 'A platter surface is organised into thousands of concentric tracks, each sliced into sectors, with thin embedded servo signals written between them at the factory. The head reads those servo wedges thousands of times a second, and a voice-coil actuator — the same principle as a loudspeaker — swings the arm in or out with sub-micron precision to lock onto the exact track a file lives on before it starts reading.',
      hint: 'Watch the arm sweep in and back out: that is the head crossing thousands of tracks to land on one.',
      camera: { position: [2.05, 1.7, 2.2], target: [0.05, 0.5, 0] },
      onEnter: view({ turntable: 0, reveal: 1, fly: 1, macro: 0, crash: 0 }, 'seek'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4600,
          ease: 'linear',
          onUpdate: () => {
            handles.setSpin(s.t * 3 * Math.PI * 2);
            handles.setSeek(1 - Math.abs(1 - 2 * s.t));
          },
        });
      },
    },
    {
      id: 'crash',
      heading: '6 · Why the box stays sealed',
      body: 'That 3-nanometre gap has no margin for error. A single dust or smoke particle — just microns wide — is a boulder at this scale. If one gets between the slider and the platter, or a hard knock collapses the air film for an instant, the head strikes the spinning surface: a head crash. It gouges the magnetic coating and scatters debris across neighbouring tracks. That is why every drive is hermetically sealed, and why dropping one while it is spinning can destroy it in a fraction of a second.',
      hint: 'Same magnified view: a dust particle rides in on the airflow, is too tall to fit, and the gap slams shut on it.',
      camera: { position: [4.15, 3.55, 1.75], target: [1.95, 3.02, 0.05] },
      dofAperture: 0.00018,
      onEnter: view({ turntable: 0, reveal: 1, fly: 1, seek: 0.42, macro: 1 }, 'crash'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5200,
          ease: 'linear',
          onUpdate: () => {
            handles.setSpin(s.t * 2.5 * Math.PI * 2);
            handles.setCrash(s.t);
          },
        });
      },
    },
    {
      id: 'run',
      heading: '7 · Sealed back up, spinning for years',
      body: 'Cover back on. Inside, a head the size of a grain of rice flies nanometres above a platter spinning faster than a jet engine\'s core, finding any one of millions of tracks in milliseconds, for years on end, without ever touching down — until the day it is dropped mid-spin, and that boulder-sized speck of dust finally meets the ground.',
      hint: 'Sealed again — all of that is still happening, just where you can\'t see it. Drag to orbit.',
      camera: { position: [2.6, 1.9, 2.9], target: [0, 0.55, 0] },
      freeOrbit: true,
      onEnter: view({ turntable: 0, reveal: 0, seek: 0.42, fly: 1, macro: 0, crash: 0 }),
      timeline: spinLoop(2, 3600),
    },
  ],
});
