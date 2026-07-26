// Editorial layer for video export (scripts/export-video.mjs).
//
// SCRIPTING: written as ONE flowing voiceover per format, not a stack of
// standalone sentences. make-narration.mjs synthesizes the whole thing in a
// single ElevenLabs take (with-timestamps) and the exporter paces the picture
// to the audio. 8-beat arc: pattern interrupt -> stakes+question -> BUT/
// THEREFORE mechanism -> isolated stat -> callback button.
//
// ANGLE (the brief): every gear in the box is already spinning, all the time
// — shifting doesn't move a gear, it catches one up to speed and locks it on.
// Loop: planted in shot 1 ("already spinning — before you ever touch the
// lever"), closed word-for-word in the button ("catching up to one that was
// already spinning").
// Stat: in first gear the box triples the engine's twisting force (3.5:1).
//
// steps: 0 complete (exterior) · 1 inside (neutral, 3 shafts) · 2 torque
//        (first gear ratio) · 3 mesh (constant mesh, freewheeling) ·
//        4 synchro (brass ring) · 5 shift (fork + sleeve) · 6 reverse (idler)
//        · 7 run (all five gears)
export default {
  hook: 'Every gear in here is\nalready spinning.',

  // 9:16 — ~70s. 7 shots on the retention spine.
  // A gearbox is the widest model in the library (case ~1.35x longer than
  // tall), so portrait crops it hard: at the 1.35 default the case ran past
  // BOTH frame edges and the callouts were sliced off at the left. Pull back.
  short: {
    dolly: 2.0,
    shots: [
      {
        // 1. pattern interrupt — the counterintuitive claim, word one
        step: 0,
        seconds: 6,
        dolly: 2.2, // whole-box shot — the widest framing needs the most pull-back
        caption: 'Every gear is already spinning.',
        narration:
          'Every gear inside this box is already spinning — before you ever touch the lever.',
      },
      {
        // 2+3. stakes + the spoken question
        step: 1,
        seconds: 12,
        caption: "So what does the lever actually do?",
        narration:
          "Right now, in neutral, the engine is spinning every single gear at once — and the car doesn't move an inch. So what does the lever actually do?",
      },
      {
        // 4. reveal — constant mesh, freewheeling
        step: 3,
        seconds: 11,
        caption: 'Every gear is meshed, but freewheeling',
        narration:
          "Here's the secret: every gear is permanently meshed with its partner, but none of them are bolted to the shaft. They just freewheel, spinning free.",
      },
      {
        // 5. isolated stat
        step: 2,
        seconds: 9,
        caption: 'First gear triples the engine’s twist',
        narration:
          'In first gear alone, this box triples your engine’s twisting force — enough to launch a two-ton car from a dead stop.',
      },
      {
        // 6. BUT — synchro engages the freewheeling gear
        step: 4,
        seconds: 13,
        caption: 'A brass ring drags it up to speed',
        narration:
          "But freewheeling means nothing's connected yet. To lock one in, a brass ring clamps on like a tiny brake pad and drags the spinning gear to the shaft's exact speed.",
      },
      {
        // 7. THEREFORE — the sleeve locks it
        step: 5,
        seconds: 10,
        caption: 'Match, then the sleeve locks it solid',
        narration:
          'Only when the speeds match does a steel sleeve slide over and lock it solid — a tenth of a second, done entirely by feel.',
      },
      {
        // 8. button — closes the opening loop
        step: 7,
        seconds: 10,
        dolly: 2.2, // whole-box shot — the widest framing needs the most pull-back
        caption: 'You’re just catching up to a spinning gear.',
        narration:
          "So next time you shift, you're not grabbing a gear. You're catching up to one that was already spinning, this whole time.",
      },
    ],
  },

  // 16:9 — ~2:45. Every step, developed, same loop planted and closed.
  long: {
    shots: [
      {
        step: 0,
        seconds: 12,
        narration:
          "Every gear inside this gearbox is already spinning, all the time — long before you ever touch the lever. That sounds impossible. Let's open it up and watch it happen.",
      },
      {
        step: 1,
        seconds: 20,
        narration:
          "Inside, it's just three shafts. The engine constantly turns a lower layshaft, and every gear on it spins a partner gear on the mainshaft above. Right now we're in neutral — the engine is turning every gear in the box, and the car doesn't move an inch.",
      },
      {
        step: 2,
        seconds: 24,
        narration:
          'Watch first gear. A small pinion drives a much bigger gear, and through the whole chain, the engine turns three and a half times for every one turn of the wheels. A gearbox never creates power — it trades speed for torque, and that trade is what gets a two-ton car rolling from a dead stop.',
      },
      {
        step: 3,
        seconds: 24,
        narration:
          "But here's what doesn't add up: every one of those big gears is spinning constantly, in every gear, all the time. So how does only one ever drive the car? Because none of them are actually attached to the mainshaft — each one just freewheels on needle rollers, spinning at its own gear's speed while the shaft stays free.",
      },
      {
        step: 4,
        seconds: 20,
        narration:
          "To lock one in, you can't just slam two different speeds together — that grinds the teeth to dust. So a brass ring goes first. It presses onto a steel cone like a tiny brake pad, and friction drags the freewheeling gear up to the shaft's exact speed.",
      },
      {
        step: 5,
        seconds: 19,
        narration:
          'Only once the speeds match will a steel sleeve slide forward over a ring of dog teeth, locking that gear solid to the mainshaft. Match, block, engage — the whole handshake takes about a tenth of a second, and a driver feels for it, not counts it.',
      },
      {
        step: 6,
        seconds: 24,
        narration:
          "Reverse skips all of that. There's no synchro for it, which is why you can only select it stopped — instead, a straight-cut idler gear slides in to bridge the gap and flip the rotation backwards. It's the only gear in the box without helical teeth, and exactly why reverse is the one gear that whines.",
      },
      {
        step: 7,
        seconds: 22,
        narration:
          'Case closed, clutch out: first, second, third, fourth, fifth. Every shift is the same trick — a fork nudges a sleeve, a brass ring catches a spinning gear up to speed, and the shaft locks on. You were never grabbing a gear. You were catching up to one that was already spinning.',
      },
    ],
  },

  platforms: {
    youtube: {
      title: 'Manual Gearbox, Explained: Every Gear Is Already Spinning (3D Cutaway)',
      description:
        "Inside a manual transmission, every forward gear is spinning all the time — even the ones you haven't selected. This 3D cutaway walks through exactly how a stick-shift gearbox works: the layshaft and mainshaft, why first gear triples your engine's twisting force, how constant-mesh gears freewheel until they're needed, how a brass synchro ring matches speeds before the sleeve locks a gear on, why reverse is the one gear that whines, and what your hand is actually doing every time you shift.\n\nTimestamps and chapters follow the mechanism step by step, ending with a full run through all five gears.\n\n#howitworks #manualtransmission #engineering",
      tags: [
        'manual gearbox',
        'manual transmission',
        'how transmissions work',
        'synchromesh',
        'constant mesh gearbox',
        'stick shift',
        'how a car works',
        'car mechanics explained',
        'engineering explained',
        '3D animation',
      ],
    },
    shorts: {
      title: 'Every gear in here is ALREADY spinning 😮',
      hashtags: ['#howitworks', '#manualgearbox', '#stickshift', '#cars', '#engineering', '#shorts'],
    },
  },
};
