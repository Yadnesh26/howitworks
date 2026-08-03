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
//        · 7 ratios (the five speeds, named) · 8 run (driven through all five)
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
        labels: [], // no part named yet — let the claim breathe, no clutter
        narration:
          'Every gear inside this box is already spinning — before you ever touch the lever.',
      },
      {
        // 2+3. stakes + the spoken question
        step: 1,
        seconds: 12,
        labels: [], // rhetorical "the lever" — no specific modeled part discussed yet
        narration:
          "Right now, in neutral, the engine is spinning every single gear at once — and the car doesn't move an inch. So what does the lever actually do?",
      },
      {
        // 4. reveal — constant mesh, freewheeling
        step: 3,
        seconds: 11,
        labels: ['Gears freewheel on the shaft'],
        narration:
          "Here's the secret: every gear is permanently meshed with its partner, but none of them are bolted to the shaft. They just freewheel, spinning free.",
      },
      {
        // 5. isolated stat
        step: 2,
        seconds: 9,
        labels: ['3.5 in · 1 out'],
        narration:
          'In first gear alone, this box triples your engine’s twisting force — enough to launch a two-ton car from a dead stop.',
      },
      {
        // 6. BUT — synchro engages the freewheeling gear
        step: 4,
        seconds: 13,
        labels: ['Brass blocker ring', 'Friction cone'],
        narration:
          "But freewheeling means nothing's connected yet. To lock one in, a brass ring clamps on like a tiny brake pad and drags the spinning gear to the shaft's exact speed.",
      },
      {
        // 7. THEREFORE — the sleeve locks it
        step: 5,
        seconds: 10,
        labels: ['Sleeve — splined to the mainshaft'],
        narration:
          'Only when the speeds match does a steel sleeve slide over and lock it solid — a tenth of a second, done entirely by feel.',
      },
      {
        // 7b. real-world connection — the SET, not just the one gear. Lands the
        // step's own surprise: fourth engages nothing at all.
        step: 7,
        seconds: 12,
        // the ratios step is framed broadside across a 2.6-wide gear train — the
        // most portrait-hostile shot in the explainer. 2.6 fitted it but left the
        // mechanism tiny; 1.9 cropped the output flange and pushed the ratio
        // readout pill into the right edge. 2.2 leaves a margin both sides.
        dolly: 2.2,
        labels: ['1st', '5th', '4th · direct'],
        narration:
          "And there are five of those trades sitting in here. First to drag you off the line, fifth spinning the output faster than the engine itself — and fourth, which quietly locks straight through and uses no gears at all.",
      },
      {
        // 8. button — closes the opening loop
        step: 8,
        seconds: 10,
        dolly: 2.2, // whole-box shot — the widest framing needs the most pull-back
        narration:
          "So next time you shift, you're not grabbing a gear. You're catching up to one that was already spinning, this whole time.",
      },
    ],
  },

  // 16:9 — ~2:45. Every step, developed, same loop planted and closed.
  long: {
    shots: [
      // INTRO — 4-part hook (context/contrarian, common belief, contrarian
      // reinforcement + proof/plan), held on step 0's whole-box establishing view
      {
        step: 0,
        seconds: 8,
        labels: [], // bold claim, no part named yet
        narration:
          'Every gear inside this manual gearbox is already spinning — all the time, long before you ever touch the lever.',
      },
      {
        step: 0,
        seconds: 8,
        labels: ['Shift lever'], // "shifting" is the subject of this beat
        narration:
          "You'd think shifting reaches in and grabs one of them — first, then second, then third, one gear at a time.",
      },
      {
        // still case-on — the contrarian claim doesn't need the reveal yet
        step: 0,
        seconds: 7,
        labels: [],
        narration:
          "It doesn't. Every one of them is already turning, whether it's selected or not —",
      },
      {
        // THE case-off transition (step 1's onEnter fires setCase(false)) is
        // pinned to start exactly on "let's open the case" — not late, not on
        // the next body shot. Camera fly-to overlaps these opening words.
        step: 1,
        seconds: 12,
        labels: [],
        narration:
          "so let's open the case and watch it happen: first gear multiplying the engine's force, the reason the rest keep spinning uselessly, the part that fixes that, and all five ratios turning together at the end.",
      },
      {
        step: 1,
        seconds: 20,
        labels: ['Layshaft — one rigid cluster', 'Mainshaft'],
        narration:
          "Inside, it's just three shafts. The engine constantly turns a lower layshaft, and every gear on it spins a partner gear on the mainshaft above. Right now, in neutral, the engine is turning every single one of those gears — and the car doesn't move an inch.",
      },
      {
        step: 2,
        seconds: 22,
        labels: ['15-tooth pinion — cluster', '35-tooth gear — mainshaft', '3.5 in · 1 out'],
        narration:
          "Therefore, watch what happens the instant first gear locks on. A small pinion drives a much bigger gear, and through that one pair, the engine turns three and a half times for every single turn of the wheels. A gearbox never creates power — it trades speed for torque, and that trade alone is what gets a two-ton car rolling from a dead stop.",
      },
      {
        step: 3,
        seconds: 22,
        labels: ['Gears freewheel on the shaft'],
        narration:
          "But here's what doesn't add up: every one of those bigger gears is spinning constantly, in every gear, all the time — not just first. So how does only one of them ever actually drive the car? Because none of them are bolted to the mainshaft at all. Each one just freewheels on needle rollers, spinning at its own speed while the shaft underneath stays completely free.",
      },
      {
        step: 4,
        seconds: 18,
        labels: ['Brass blocker ring', 'Friction cone', '2nd gear — freewheeling'],
        narration:
          "Therefore, to lock one of those freewheeling gears in, you can't just slam two different speeds together — that grinds the teeth to dust in an instant. So a brass ring goes first: it presses onto a steel cone like a tiny brake pad, and friction alone drags that spinning gear up to the shaft's exact speed.",
      },
      {
        step: 5,
        seconds: 18,
        labels: ['Sleeve — splined to the mainshaft'],
        narration:
          "Only once those two speeds actually match will a steel sleeve slide forward over a ring of dog teeth and lock that gear solid to the mainshaft. Match, block, engage — the whole handshake takes about a tenth of a second, and a driver feels for it, they don't count it.",
      },
      {
        step: 6,
        seconds: 22,
        labels: ['Reverse idler'],
        narration:
          "But reverse skips every part of that. There's no synchro for it at all, which is exactly why you can only select it while stopped — instead, a straight-cut idler gear swings down on a pivoting arm and bridges the gap, flipping the rotation backwards. It's the one gear in the whole box without helical teeth, and that's exactly why reverse is the one gear that whines.",
      },
      {
        step: 7,
        seconds: 28,
        labels: ['Cluster — one steady speed', '1st', '2nd', '3rd', '4th · direct', '5th'],
        narration:
          "So here's the whole set, with the layshaft held at one steady speed throughout. First is fifteen teeth driving thirty-five — the biggest reduction in the box. Second and third close that gap, until third lands at twenty-five into twenty-five, a dead-even turn. Fourth drives no gears at all — the sleeve just locks the input shaft straight through to the output. And fifth flips the ratio backwards, thirty-two teeth driving eighteen, so the output actually spins faster than the engine. That one's overdrive, and it's why fifth is for cruising, not climbing.",
      },
      {
        step: 8,
        seconds: 20,
        narration:
          'So clutch out, and away: first, second, third, fourth, fifth. Every single shift is the same trick — a fork nudges a sleeve, a brass ring catches a spinning gear up to speed, and the shaft locks on. You were never grabbing a gear. You were catching up to one that was already spinning.',
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
