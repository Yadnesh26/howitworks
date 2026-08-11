import { defineExplainer } from '../../framework/index.js';
import { smooth, TAU } from '../../framework/motion.js';
import meta from './meta.js';
import { buildBlackHole } from './model.js';

// Camera bearings, not raw vectors. The subject is perfectly round from every
// direction, so the only shot variety available is azimuth, elevation and
// distance — and those have to be deliberate or nine steps look like one.
// Azimuth marches ~40 deg per step (a continuous hero arc all the way round),
// elevation swings 9 -> 50 -> 7 so the disk opens up for the geometry steps
// and flattens to edge-on for the ones about lensing and beaming.
const CENTER = [0, 2.4, 0];

// `drop` raises the aim point, which slides the subject DOWN the frame. Only
// the hero needs it: the landing screen's title and summary sit straight on
// the canvas with no panel behind them, unlike every step's copy, so anything
// bright crossing that band makes the pitch unreadable.
function shot(azDeg, elDeg, dist, push = 0.16, drop = 0) {
  const a = (azDeg * Math.PI) / 180;
  const e = (elDeg * Math.PI) / 180;
  const d = [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)];
  const position = [
    CENTER[0] + dist * d[0],
    CENTER[1] + dist * d[1],
    CENTER[2] + dist * d[2],
  ];
  // Aim left of the hole so the hole itself sits right of frame centre — the
  // text panel owns the left ~38% of the viewport. Camera-right in world is
  // normalize(cross(worldUp, eye-target)) = (dz, 0, -dx).
  const rx = d[2];
  const rz = -d[0];
  const rl = Math.hypot(rx, rz) || 1;
  const k = (push * dist) / rl;
  return { position, target: [CENTER[0] - k * rx, CENTER[1] + drop, CENTER[2] - k * rz] };
}

// Default step timeline: one scalar sweeping 0->1 per lap.
//
// These laps are 30-44s, several times longer than anything else in the
// library, and that is deliberate rather than sloppy. The usual 3-8s
// convention is for machines that genuinely spin fast; gas orbiting a
// supermassive black hole is the opposite, and at the old tempo the disk
// streamed past like smoke in a wind tunnel instead of drifting. The diagram
// overlays keep their own faster clock (AUX_CYCLES in model.js), so nothing
// that needs to read as MOVING got slowed down with it. Every motion in the
// model is either a whole number of turns of that scalar or a fade that is
// zero at both ends, so the wrap is invisible.
function run({ duration }) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () => handles.set({ phase: s.t }),
    });
  };
}

// Every onEnter pins the COMPLETE state — anything left unpinned inherits
// whatever the previous step's loop happened to be doing.
const state = (over) => ({
  phase: 0,
  disk: 1,
  beam: 1,
  stars: 1,
  // A low baseline rather than 0: the razor-thin bright rim hugging the
  // silhouette is the most recognisable thing about this image, and it was
  // only switched on for the two steps that discuss it. Steps 3 and 4 still
  // push it harder when it is the subject.
  shell: 0.3,
  isco: 0,
  plunge: 0,
  gain: 1,
  ringHorizon: 0,
  ringShadow: 0,
  photonRing: 0,
  raysOn: 0,
  probeOn: 0,
  ...over,
});

export default defineExplainer({
  ...meta,

  // No `dof`: BokehPass keys its blur off the depth buffer, and the
  // raymarched sky writes no depth — every star would come out defocused.
  stageOptions: { space: true },

  buildScene({ scene, stage }) {
    return buildBlackHole({ scene, stage });
  },

  steps: [
    {
      id: 'hero',
      heading: '1 · A picture of the thing you cannot see',
      body: 'A black hole emits nothing. Everything in this image is light from somewhere else — gas orbiting outside it, stars far behind it — arriving by paths that gravity bent on the way to you. The disk appears to arc over the top because you are seeing its far side, lifted into view over a hole that should be hiding it. Nothing here is small: scaled to the black hole at the centre of our own galaxy, the glowing ring in front of you would be about as wide as Earth\'s orbit around the Sun.',
      hint: 'Drag to orbit. Nothing here was sculpted — each pixel is a light ray traced through curved spacetime.',
      // The one shot that breaks the framing convention, deliberately. Every
      // other step sits the subject right of centre so the panel owns the left
      // third — but composed that way this one read as a small bright object
      // parked in a corner, which is the exact opposite of the only thing
      // everyone already knows about black holes. So: close enough that the
      // disk runs off BOTH edges, and only lightly offset, so it fills the
      // frame and is plainly too big to fit in it. Nothing is labelled here,
      // which is what makes letting it run behind the panel safe.
      camera: shot(25, 8, 4.3, 0.2, 0.52),
      onEnter: ({ handles }) => {
        // less rim enhancement than the 0.3 baseline: this close, the disk's
        // own multiply-lensed images already draw the ring unaided
        handles.set(state({ shell: 0.14 }));
        handles.setLabels(false);
      },
      timeline: run({ duration: 44000 }),
    },
    {
      id: 'horizon',
      heading: '2 · There is nothing there',
      body: 'The event horizon is not a surface. Nothing is built there, nothing is stored there — it is simply the distance at which the escape speed reaches the speed of light, so anything closer is already committed. Its size depends on mass alone: a 10-solar-mass hole is 60 km across, the one at the centre of our galaxy is 25 million km across — about 18 Suns side by side — and it would still fit comfortably inside Mercury\'s orbit.',
      camera: shot(65, 14, 3.4),
      focus: ['Event horizon · 1 Rs'],
      onEnter: ({ handles }) => {
        handles.set(state({ disk: 0.2, ringHorizon: 1 }));
        handles.setLabels('horizon');
      },
      timeline: run({ duration: 40000 }),
    },
    {
      id: 'shadow',
      heading: '3 · The dark circle is not the hole',
      body: 'The hole is the small white ring. The darkness around it is 2.6 times wider, because rays that would have missed the hole are still bent hard enough to fall in — so a whole region of sky goes dark behind it. That silhouette has a radius of exactly √27 GM/c² — 2.6 Rs, so 5.2 Rs across — for every non-spinning black hole in the universe. When the Event Horizon Telescope measured M87*, that ratio predicted 39.5 microarcseconds; they photographed 42.',
      camera: shot(105, 6, 3.5),
      focus: ['What you see · 5.2 Rs'],
      onEnter: ({ handles }) => {
        handles.set(state({ disk: 0.55, ringHorizon: 1, ringShadow: 1, shell: 0.5 }));
        handles.setLabels('shadow');
      },
      timeline: run({ duration: 40000 }),
    },
    {
      id: 'photon',
      heading: '4 · Where light can go into orbit',
      body: 'At 1.5 horizon-radii there is a distance where light circles the hole. Watch the three rays: the outer one is bent and carries on, the middle one whips more than three-quarters of the way around before escaping in a completely new direction, and the inner one never comes back. The bright rim of the shadow is made of rays that took that middle path — light that looped the hole and then came to you.',
      camera: shot(150, 50, 5.0),
      focus: ['Photon sphere · 1.5 Rs', 'Loops — then escapes'],
      onEnter: ({ handles }) => {
        handles.set(state({ disk: 0.12, stars: 0.75, photonRing: 1, shell: 0.85, raysOn: 1 }));
        handles.setLabels('photon');
      },
      timeline: run({ duration: 36000 }),
    },
    {
      id: 'isco',
      heading: '5 · The last orbit that holds',
      body: 'Further out, gravity behaves the way it does around a star: circle at the right speed and you stay. Closer in, that stops being true. At three horizon-radii you reach the innermost stable circular orbit — moving at exactly half the speed of light — and inside it no circular orbit survives at all. That is why the disk has such a sharp inner edge. It has not been swept clean; gas simply cannot hold an orbit any closer, so whatever crosses that line is already falling.',
      camera: shot(200, 34, 6.0),
      focus: ['Last stable orbit · 3 Rs'],
      onEnter: ({ handles }) => {
        handles.set(state({ disk: 1, isco: 1, plunge: 0.5, ringShadow: 0.45 }));
        handles.setLabels('isco');
      },
      timeline: run({ duration: 34000 }),
    },
    {
      id: 'disk',
      heading: '6 · Why the gas glows',
      body: 'Nothing is burning. Gas closer in has to orbit faster, so neighbouring rings grind past each other, and friction plus tangled magnetic fields turn that shear into heat — the inner disk of a stellar-mass hole reaches ten million degrees and radiates X-rays. As a way of turning matter into light it is unmatched: accretion releases 10 to 40 percent of an object\'s rest mass, against 0.7 percent for the nuclear fusion running the Sun.',
      camera: shot(250, 42, 7.0),
      focus: ['Accretion disk', 'Inner gas laps the outer'],
      onEnter: ({ handles }) => {
        handles.set(state({ disk: 1, plunge: 0.4 }));
        handles.setLabels('disk');
      },
      timeline: run({ duration: 30000 }),
    },
    {
      id: 'beaming',
      heading: '7 · One side is brighter — and it is not hotter',
      body: 'The gas on one side is coming at you at a fair fraction of light speed, and that alone concentrates and blue-shifts its light; the other side is receding and dims. Observed brightness scales as the Doppler factor to the fourth power, so a modest speed difference becomes a dramatic one. The relativistic effects switch off and back on through this loop — the disk itself never changes.',
      hint: 'This lopsidedness is real — it is how the Event Horizon Telescope reads which way M87* spins. Interstellar left it out on purpose: the physics said one side should be blindingly bright and the other nearly invisible, and the film judged that a disk that uneven would read to an audience as a mistake.',
      camera: shot(300, 7, 7.5),
      focus: ['Coming at you', 'Going away'],
      onEnter: ({ handles }) => {
        handles.set(state({ disk: 1, beam: 1 }));
        handles.setLabels('beam');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 30000,
          ease: 'linear',
          onUpdate: () => {
            // Relativity stays ON for most of the lap — that is the truthful
            // picture — and dips out briefly mid-loop as the demonstration. A
            // symmetric 1->0->1 sweep spent half the loop showing the FALSE
            // image, which is also what every captured review frame landed on.
            // Zero at both ends of the window, so the wrap stays seamless.
            // THREE dips per lap, not one: the lap is now 30s, and a single
            // mid-loop dip is easy to scroll straight past. An integer number
            // of dips keeps the wrap seamless.
            const d = (s.t * 3) % 1;
            const k = Math.max(0, 1 - Math.abs(d - 0.5) / 0.13);
            handles.set({ phase: s.t, beam: 1 - 0.94 * smooth(k) });
          },
        });
      },
    },
    {
      id: 'time',
      heading: '8 · Falling in takes forever to watch',
      body: 'Send a probe down and you will never see it arrive. Clocks run slower deeper in the field — one riding the innermost stable orbit ticks at 71% of yours — and as the probe approaches the horizon its signals arrive further and further apart, each one stretched redder than the last, until it fades out still hanging above the edge. From the probe\'s own point of view, nothing unusual happens and it crosses in finite time.',
      camera: shot(340, 20, 3.4),
      focus: ['Clock running slow', 'Signals stretch and fade'],
      onEnter: ({ handles }) => {
        handles.set(state({ disk: 0.45, stars: 0.9, ringHorizon: 1, probeOn: 1 }));
        handles.setLabels('probe');
      },
      timeline: run({ duration: 36000 }),
    },
    {
      id: 'run',
      heading: '9 · Mass, and nothing else',
      body: 'Every feature here came from one number. Set the mass and the horizon, the photon sphere, the shadow and the last stable orbit all follow — a black hole a billion times heavier looks exactly like this one, just bigger. And it does not reach out: swap the Sun for a black hole of the same mass and Earth would keep to its orbit, on time, in the dark.',
      hint: 'Drag to orbit — the whole picture stays correct from any angle, because it is recomputed for every ray.',
      camera: shot(380, 11, 8.5),
      freeOrbit: true,
      onEnter: ({ handles }) => {
        handles.set(state({ disk: 1, shell: 0.25 }));
        handles.setLabels(false);
      },
      timeline: run({ duration: 34000 }),
    },
  ],
});
