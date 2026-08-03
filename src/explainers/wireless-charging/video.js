// Editorial layer for video export (scripts/export-video.mjs).
// Hooks and captions win views; narration is spoken prose, not the step body.
//
// steps: 0 phone on pad · 1 two coils + gap · 2 AC current -> field ·
//        3 field induces current · 4 rectify -> battery · 5 run
//
// The scene is wide (pad + overhanging phone), so portrait shots carry a
// per-shot `dolly` pull-back to keep the whole charger in frame.
export default {
  // Hook is the SPOKEN opening line (verbatim caption rail = the on-screen
  // hook now — no separate title card). Keep this in sync with short.shots[0]'s
  // opening sentence.
  hook: 'Set your phone down —\nand it just starts charging.',

  // 9:16, one flowing single-take voiceover, verbatim word-synced captions.
  // Planted loop: "a gap of pure air" (shot 2) closed word-for-word in the
  // button (shot 6).
  short: {
    shots: [
      {
        step: 0,
        seconds: 5,
        dolly: 2.2,
        narration:
          'Set your phone down, and it just starts charging — no wire, no port, nothing even touching it. So how does the power actually get in?',
      },
      {
        step: 1,
        seconds: 6,
        dolly: 2.2,
        narration:
          'Strip the shell off, and there’s barely anything here: two flat coils facing each other, separated by a gap of pure air. That gap is the whole trick — nothing ever bridges it.',
      },
      {
        step: 2,
        seconds: 7,
        dolly: 1.6,
        narration:
          'But watch the first coil. The pad drives it with current that flips direction a hundred thousand times a second — and a flipping current always drags a magnetic field along with it.',
      },
      {
        step: 3,
        seconds: 7,
        dolly: 1.6,
        narration:
          'Therefore that field reaches straight across the gap into the second coil. And by the same law that runs a generator, a changing field pushes current into any loop in its path.',
      },
      {
        step: 4,
        seconds: 7,
        dolly: 1.7,
        narration:
          'That current is still wobbling back and forth, so a tiny chip straightens it into steady DC before it reaches the battery. About three-quarters of the power the pad puts out actually makes it in.',
      },
      {
        step: 5,
        seconds: 5,
        dolly: 2.2,
        narration:
          'No port to wear out, no wire to fray — just power, crossing a gap of pure air.',
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
