import { defineExplainer } from '../../framework/index.js';
import { TAU, win } from '../../framework/motion.js';
import meta from './meta.js';
import { buildSmartphoneCamera } from './model.js';

// Every step pins the FULL state on entry — which scene is on stage, the
// labels, and every pose scalar including the turntable — so scrolling in
// either direction lands on the same frame and no fixed camera ever inherits a
// stray mid-lap phase from the step before it.
const pin = (labelSet, over = {}) => ({ handles }) => {
  handles.setOpen(over.open ?? 0);
  handles.setLabels(labelSet);
  handles.set({
    spin: 0,
    macro: 0,
    which: 0,
    subj: 0,
    af: 0,
    iris: 1,
    varia: 0,
    shake: 0,
    correct: 0,
    zoom: 0,
    burst: 0,
    bare: 0,
    explode: 0,
    sense: 0,
    flow: 0,
    rays: 0,
    inset: 0,
    ...over,
  });
};

// A gentle sway rather than a full turn: a full revolution parks half the lap
// on the phone's blank lower half, and the callouts stay put long enough to
// read. The lap still returns to an identical pose.
const sway = (duration, amp, over = {}) => ({ tl, handles }) => {
  const s = { t: 0 };
  tl.add(s, {
    t: 1,
    duration,
    ease: 'linear',
    onUpdate: () => handles.set({ spin: Math.sin(s.t * TAU) * amp, ...over }),
  });
};

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildSmartphoneCamera({ scene });
  },

  steps: [
    {
      heading: 'The bump on the back',
      body: 'Three glass eyes and a flash, standing proud of a slab of glass. There is no shutter in there, no mirror, no film, nothing you could point at from the outside and call a moving part. And yet behind each of those circles sits a motor that repositions the lens hundreds of times a second, a suspension holding it on four wires thinner than a hair, and a chip that counts light one particle at a time. The bump is not styling. It is the only place the optics will fit.',
      hint: 'Drag to orbit · scroll to lift the back off.',
      camera: { position: [4.35, 3.75, 3.4], target: [0.05, 0.15, -0.6] },
      dofAperture: 0.00003,
      focus: ['Main camera', 'Periscope telephoto'],
      onEnter: pin('exterior'),
      timeline: sway(11000, 0.32),
    },
    {
      heading: '1 · Three cameras, not one',
      body: 'Lift the back glass and the idea of "the camera" falls apart. There are three, and each is a complete instrument with its own lens, its own motor and its own sensor: an ultrawide that takes in the whole room, a main camera that does most of the work, and a telephoto lying flat on its side because it is too long to stand up. The main module alone is about eleven millimetres square and six tall — in a body only eight millimetres thick. Something has to give, and what gives is the back.',
      hint: 'The battery is the other thing everything must fit around.',
      camera: { position: [2.7, 4.3, 2.3], target: [-0.15, 0.12, -0.4] },
      dofAperture: 0.00004,
      focus: ['Main camera module', 'Periscope module'],
      onEnter: pin('inside', { open: 1 }),
      timeline: sway(12000, 0.22),
    },
    {
      heading: '2 · The lens flies',
      body: 'Here is one module on its own, enlarged. Focusing means moving glass, and there is no room in a phone for gears, so the lens stack sits in a carrier wrapped in a coil of copper and parked between four magnets. Push current through the coil and the magnets shove it along the optical axis — the same force that drives a loudspeaker cone, which is exactly why it is called a voice-coil motor. Two bronze leaf springs pull it back. Watch the cone of light: when the lens is in the wrong place it comes to a point above the chip and the chip only sees a disc. The motor hunts until the point lands on the silicon.',
      hint: 'The real stroke is a few hundred microns — exaggerated here, or you would never see it.',
      camera: { position: [2.6, 1.9, 3.2], target: [0, 1.2, 0] },
      dofAperture: 0.00009,
      focus: ['Voice-coil winding', 'Lens stack', 'Magnet'],
      onEnter: pin('af', { macro: 1, rays: 1 }),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5400,
          ease: 'linear',
          onUpdate: () => {
            // The subject walks in and back out; the lens chases it a beat
            // behind, which is what makes the blur appear and then close up.
            // Both are the same periodic function, so the lap wraps clean.
            const subj = 0.5 - 0.5 * Math.cos(s.t * TAU);
            const af = 0.5 - 0.5 * Math.cos((s.t - 0.085) * TAU);
            handles.set({ subj, af });
          },
        });
      },
    },
    {
      heading: '3 · The hole that never moves',
      body: 'Every proper camera has an iris — a ring of blades that opens and closes to meter the light. Your phone almost certainly does not. Look inside the stack and the aperture is a black washer moulded between two elements: one fixed hole, usually around f/1.6, which is very wide and stays that way forever. So a phone meters light the only two ways left to it. It holds the exposure open for longer, and it turns up the gain. Everything you know as "night mode" starts from the fact that this hole cannot be made any bigger.',
      hint: 'A wide hole is also why phone photos throw the background out of focus so readily.',
      camera: { position: [1.75, 3.0, 2.1], target: [-0.05, 1.0, 0] },
      dofAperture: 0.00012,
      focus: ['Aperture stop'],
      onEnter: pin('stop', { macro: 1, rays: 1 }),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5000,
          ease: 'linear',
          // the hole is deliberately still — what moves is the exposure: charge
          // pooling in the wells, then the readout sweeping them empty
          onUpdate: () => handles.set({ sense: s.t }),
        });
      },
    },
    {
      heading: '4 · Six blades, on almost no phone',
      body: 'A handful of phones do fit a real diaphragm. Samsung shipped one on the Galaxy S9 that flipped between two settings, f/1.5 and f/2.4. The Xiaomi 14 Ultra goes further: six blades that close continuously from f/1.63 all the way to f/4.0, in a barrel narrower than your fingernail. Watch what closing it does to the cone of light. Less gets in — but what does get in arrives from a narrower angle, so more of the scene lands sharp at once. That trade is the whole reason irises exist, and the reason phones are odd for going without.',
      hint: 'Six plain blades leave a six-sided hole — Xiaomi notches theirs to land on twelve, for rounder highlights.',
      camera: { position: [1.6, 2.95, 1.9], target: [-0.05, 1.16, 0.02] },
      dofAperture: 0.00016,
      focus: ['Six-blade iris'],
      onEnter: pin('iris', { macro: 1, rays: 1, varia: 1 }),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4600,
          ease: 'linear',
          onUpdate: () => handles.set({ iris: 0.5 + 0.5 * Math.cos(s.t * TAU) }),
        });
      },
    },
    {
      heading: '5 · Your hands are shaking',
      body: 'Hold your breath and hold still, and your hands still swing through a fraction of a degree several times a second. That is what smears a photograph — and note that it is rotation, not sliding. Move the phone bodily sideways and a distant subject does not shift on the sensor at all; tip it by an angle and the image walks straight across the chip. So the sensor that listens to your hands is a gyroscope, sampled about a thousand times a second, and coils in the base shove the entire lens assembly sideways on its four suspension wires by exactly enough to put the image back where it was. Apple moves the sensor instead, and can correct around five thousand times a second.',
      hint: 'Half a lap with the stabiliser off, half with it on — watch the spot on the chip.',
      camera: { position: [2.9, 1.6, 3.05], target: [0, 0.95, 0] },
      dofAperture: 0.00008,
      focus: ['Gyroscope', 'Suspension wire', 'OIS drive coil'],
      onEnter: pin('ois', { macro: 1, rays: 1 }),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6400,
          ease: 'linear',
          onUpdate: () => {
            // whole cycles per lap, so the tremor wraps invisibly
            const shake =
              Math.sin(s.t * TAU * 2) * 0.78 + Math.sin(s.t * TAU * 3) * 0.34;
            // off for the first half, on for the second, and back to off by the
            // wrap so the lap starts and ends in the same state
            const correct = win(s.t, 0.46, 0.53) - win(s.t, 0.94, 0.995);
            handles.set({ shake, correct });
          },
        });
      },
    },
    {
      heading: '6 · The camera lying on its side',
      body: 'A long lens needs length, and a phone has none to spare — so the telephoto stops pointing out of the back and starts pointing along the body. Light drops in through a window, hits a block of glass cut at exactly 45°, and turns a right angle. From there the barrel can run the length of the phone, with a group of elements sliding back and forth to change the magnification, and the sensor standing on its edge at the far end. It is the same trick a submarine periscope plays, which is what everyone ended up calling it.',
      hint: 'Twenty-five millimetres of optics, folded into an eight-millimetre body.',
      camera: { position: [1.05, 1.75, 3.4], target: [-0.35, 0.48, 0] },
      dofAperture: 0.00007,
      focus: ['45° prism', 'Zoom group'],
      onEnter: pin('peri', { macro: 1, which: 1, rays: 1 }),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5200,
          ease: 'linear',
          onUpdate: () =>
            handles.set({
              zoom: 0.5 - 0.5 * Math.cos(s.t * TAU),
              flow: (s.t * 2) % 1, // whole laps per lap — the stream wraps invisibly
            }),
        });
      },
    },
    {
      heading: '7 · Counting light, colour-blind',
      body: 'At the bottom of every one of these sits a grid of photodiodes: buckets that turn arriving photons into a countable charge. A bucket cannot tell red light from blue, so each wears a colour filter, and above that a microlens funnels light into it that would otherwise have hit the dead space between wells. Phone sensors group the filter into 2×2 blocks of one colour — the Quad-Bayer layout — so that in bright light each tiny well is read on its own, and in the dark all four are added together into one big, far more sensitive pixel. Underneath, bonded face to face, is a second slab of silicon that does nothing but read the first one out.',
      hint: 'Half the wells on the chip are green, because your eye leans hardest on green.',
      camera: { position: [1.4, 1.15, 1.65], target: [0.06, 0.44, 0] },
      dofAperture: 0.00022,
      focus: ['Quad-Bayer filter', 'Microlens array', 'Logic die'],
      onEnter: pin('sensor', { macro: 1, bare: 1, explode: 1, inset: 1 }),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6000,
          ease: 'linear',
          onUpdate: () => handles.set({ bare: 1, explode: 1, sense: s.t }),
        });
      },
    },
    {
      heading: 'Run it',
      body: 'Shell closed, the whole chain again: a coil flies the lens until the light comes to a point on the chip, a fixed hole lets in all it can, a gyroscope holds the picture still against your hands, and a folded barrel reaches out past what the body should allow. Then the last piece, the one with no moving parts at all — the phone never keeps a single frame. It grabs a burst, and stacks them into the one photograph you actually asked for.',
      hint: 'Drag to orbit.',
      camera: { position: [3.7, 3.4, 3.2], target: [-0.2, 0.22, -0.45] },
      dofAperture: 0.00003,
      freeOrbit: true,
      onEnter: pin(false),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6200,
          ease: 'linear',
          onUpdate: () =>
            handles.set({
              spin: Math.sin(s.t * TAU) * 0.3,
              burst: 0.5 - 0.5 * Math.cos(s.t * TAU),
              flow: (s.t * 2) % 1,
            }),
        });
      },
    },
  ],
});
