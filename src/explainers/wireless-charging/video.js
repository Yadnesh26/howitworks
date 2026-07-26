// Editorial layer for video export (scripts/export-video.mjs).
// Hooks and captions win views; narration is spoken prose, not the step body.
//
// steps: 0 phone on pad · 1 two coils + gap · 2 AC current -> field ·
//        3 field induces current · 4 rectify -> battery · 5 run
//
// The scene is wide (pad + overhanging phone), so portrait shots carry a
// per-shot `dolly` pull-back to keep the whole charger in frame.
export default {
  hook: 'No plug. Nothing even touches.\nSo how does the power get in?',

  // 9:16, narrated + captions. (short-captioned.mp4 stays silent — post that
  // variant with a trending sound instead whenever preferred.)
  short: {
    shots: [
      {
        step: 0,
        seconds: 4,
        dolly: 2.2,
        caption: 'Set it down — it just charges',
        narration: 'Set your phone on the pad and it just charges. No cable, no port, nothing even touches.',
      },
      {
        step: 1,
        seconds: 5,
        dolly: 1.8,
        caption: 'Inside: two flat coils that never touch',
        narration: 'Inside, it’s almost nothing — two flat copper coils, parked a few millimetres apart. They never touch.',
      },
      {
        step: 2,
        seconds: 6,
        dolly: 1.6,
        caption: 'AC current makes a magnetic field',
        narration: 'The pad pushes alternating current through its coil, and that dragging current wraps it in a magnetic field.',
      },
      {
        step: 3,
        seconds: 6,
        dolly: 1.6,
        caption: 'That field makes current on the far side',
        narration: 'A changing field pushes current around any loop it passes through — so the power reappears in the phone’s coil.',
      },
      {
        step: 4,
        seconds: 5,
        dolly: 1.7,
        caption: 'Straightened to DC — the battery fills',
        narration: 'A tiny chip straightens that current into steady DC, and it trickles into the battery.',
      },
      {
        step: 5,
        seconds: 5,
        dolly: 2.2,
        caption: 'Power across a gap of empty air',
        narration: 'A field, a current, a gap of empty air. That’s wireless charging.',
      },
    ],
  },

  // 16:9, full story, narrated
  long: {
    shots: [
      {
        step: 0,
        seconds: 9,
        narration:
          'Set your phone on the pad, and it just starts charging. No cable, no port, nothing even touches. So how does the power get across that gap? The answer is hiding under two smooth plastic shells.',
      },
      {
        step: 1,
        seconds: 9,
        narration:
          'Strip the shells away and the whole machine is almost nothing — two flat copper coils, wound like clock springs, parked a few millimetres apart. Behind each sits a ferrite disc. The coils never touch. The gap is the point.',
      },
      {
        step: 2,
        seconds: 8,
        narration:
          'The pad pushes alternating current through its coil — current that reverses more than a hundred thousand times a second. And a moving current always drags a magnetic field along with it.',
      },
      {
        step: 3,
        seconds: 9,
        narration:
          'Here’s the trick, and it’s a law of physics. A changing magnetic field pushes current around any loop of wire it passes through. The phone’s coil sits right in the field, so the power simply reappears on the far side.',
      },
      {
        step: 4,
        seconds: 9,
        narration:
          'That current arrives wobbling back and forth, but a battery needs steady one-way DC. A small rectifier chip straightens it out, and clean current trickles into the cell. About three-quarters of the energy makes the trip.',
      },
      {
        step: 5,
        seconds: 8,
        narration:
          'A coil that makes a field, a field that makes a current, a chip that tames it into charge. Three simple steps, a hundred thousand times a second, across a gap of empty air.',
      },
    ],
  },
};
