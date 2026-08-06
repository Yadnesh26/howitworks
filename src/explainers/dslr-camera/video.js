// Editorial layer for video export (scripts/export-video.mjs).
// steps: 0 sealed camera · 1 the iris · 2 mirror + pentaprism light path
//        3 the clack (mirror + curtains) · 4 the travelling slit
//        5 sensor + Bayer mosaic · 6 re-solidified finale
//
// STORY LENS: not "how a camera works" but "you have never seen a photo you
// were taking." The viewfinder blackout is the loop; the travelling slit is
// the payoff; the flash black-band is the everyday consequence that proves it.
// The Bayer/sensor step is deliberately left out of the short — one spine,
// told properly, beats four facts crammed in.
export default {
  hook: 'You have never seen\na photo you were taking.',

  // 9:16 — single-take narration + word-synced caption rail. ~75s.
  // Arc: hook (you shoot blind) -> stakes/question (what happens in the dark)
  // -> mechanism (iris -> mirror/prism -> curtains) -> re-hook (the slit)
  // -> isolated stat (under a millimetre) -> so-what (the flash band)
  // -> button, closing the "blind" loop.
  short: {
    dolly: 1.7, // portrait crops the sides of these landscape-framed cameras
    shots: [
      {
        // 1. hook — the boldest true sentence, word one
        step: 0,
        dolly: 1.95,
        narration:
          'You have never seen a photo you were taking. Not the actual instant.',
      },
      {
        // 2. stakes + the loop this whole script closes
        step: 0,
        dolly: 1.95,
        narration:
          "Press the button and a mirror slams out of the way. The viewfinder goes black, and you're shooting blind. So what happens in that dark?",
      },
      {
        // 3. mechanism — the iris
        step: 1,
        dolly: 1.55,
        labels: ['Aperture blades'],
        narration:
          "Nine steel blades meter the light. Open them one notch and you've doubled it.",
      },
      {
        // 4. mechanism — the reveal that reframes the whole thing
        step: 2,
        dolly: 2.4, // long horizontal light path, the worst case in portrait
        // NO labels override here on purpose: the export matches callouts by
        // TEXT, and 'Reflex mirror' exists in both the internal and shutter
        // sets, so naming it forces BOTH copies visible at once. This step's
        // own onEnter already shows exactly the internal set.
        narration:
          "But while you're framing, that light never reaches the sensor. A mirror at forty five degrees throws it up through a lump of glass and out to your eye. You're looking through the lens itself.",
      },
      {
        // 5. mechanism — the curtains
        step: 3,
        dolly: 2.1,
        labels: ['First curtain', 'Second curtain'],
        narration:
          'So the mirror swings clear, and two curtains chase each other across the sensor. One uncovers it, one covers it back up.',
      },
      {
        // 6. re-hook — the counterintuitive beat
        step: 4,
        // The slit IS the payoff, so it wins the frame: pulled in tighter and
        // every callout off (an empty array is an explicit "hide all"), rather
        // than dollying out far enough to fit labels and shrinking the one
        // thing this beat exists to show.
        dolly: 1.8,
        labels: [],
        narration:
          "Here's the part that gets me. Past a two hundred and fiftieth of a second, they can't cross fast enough. The second one starts before the first has finished.",
      },
      {
        // 7. the stat, isolated
        step: 4,
        // The slit IS the payoff, so it wins the frame: pulled in tighter and
        // every callout off (an empty array is an explicit "hide all"), rather
        // than dollying out far enough to fit labels and shrinking the one
        // thing this beat exists to show.
        dolly: 1.8,
        labels: [],
        narration:
          'Your sensor is never fully open. A moving slit scans it instead. At one eight thousandth of a second, that slit is under a millimetre wide.',
      },
      {
        // 8. so-what + button, closes the "shooting blind" loop
        step: 6,
        dolly: 1.9,
        narration:
          "It's why a flash fired too fast leaves a black band across your shot: you photographed the curtain. Every photo you own was taken blind.",
      },
    ],
  },
};
