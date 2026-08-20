// Editorial layer for video export (scripts/export-video.mjs).
//
// SCRIPTING: written as ONE flowing voiceover, not a stack of standalone
// sentences — make-narration.mjs synthesizes it as a single ElevenLabs take
// and the exporter paces the picture to the audio. 8-beat arc: pattern
// interrupt -> curiosity hook -> spoken question -> reveal -> step-by-step
// (connective tissue) -> isolated mind-blowing stat -> real-world connection
// -> callback ending. "no switch / nothing moved" is the loop, planted in
// shot 1 and closed in the button (shot 7).
//
// NO-HAND note: the model shows a grounded conductive test tip, never a
// finger (house rule — no stylised anatomy). Narration says "your touch" /
// "a finger" only as the real-world referent the tip stands in for, never as
// a claim that the visual shows a hand — matches the interactive copy's own
// "electrically, your fingertip" framing.
export default {
  hook: 'There’s no switch\nanywhere in this glass.',

  // 9:16 — ~70s, 7 shots.
  short: {
    dolly: 1.6,
    shots: [
      {
        // Zone 1 — pattern interrupt. Whole sealed product, slow turn.
        step: 0,
        dolly: 1.6,
        // Export-only: scales how fast the scene's OWN clock advances this
        // shot (turntable spin etc) without touching the live site's step
        // timeline. 0.4 keeps the hero establishing shot calm — a slow,
        // stable turn instead of a brisk spin — while still technically
        // moving (a frozen loop reads as a bug, not a still).
        speed: 0.4,
        narration:
          'There’s no switch anywhere in this glass. No button collapses, nothing wears out.',
      },
      {
        // Zone 2+3 — curiosity hook (plants "nothing moved") + spoken question
        step: 0,
        dolly: 1.6,
        speed: 0.4,
        narration:
          'Nothing under this screen has ever moved — and it still knows exactly where you tapped, down to a fraction of a millimetre. So how does solid glass feel a touch?',
      },
      {
        // Zone 4a — reveal: the invisible grid, name it
        step: 2,
        dolly: 1.4,
        labels: ['Drive row', 'Sense column'],
        narration:
          'Peel back the glass and there’s a grid hiding underneath — thousands of hair-thin electrodes, etched into diamonds five millimetres apart. You’ve been looking through it the whole time.',
      },
      {
        // Zone 4b — BUT connective: the mechanism, in numbers
        step: 3,
        dolly: 1.2,
        labels: ['Fringing field', 'Drive electrode', 'Sense electrode'],
        narration:
          'Every crossing in that grid is its own tiny capacitor — one wire constantly arcing a whisper of charge to its neighbor, about three picofarads, rock steady, all day.',
      },
      {
        // Zone 4c — THEREFORE: the twist. Signal goes DOWN, not up.
        step: 4,
        dolly: 1.25,
        labels: ['Field diverted to ground', 'Coupling 3.10 pF'],
        narration:
          'But rest a finger on the glass and that arc doesn’t grow — it drains away. Your touch doesn’t add a signal. It steals one.',
      },
      {
        // Zone 5 — isolated stat, its own beat
        step: 5,
        dolly: 1.5,
        labels: ['Active drive row', 'All columns sampled at once'],
        narration:
          'Here’s the part that gets me: the controller checks all 364 of those crossings, a hundred and twenty times every single second, hunting for exactly that dip.',
      },
      {
        // Zone 6+7 — real-world so-what + callback button (closes the loop)
        step: 7,
        dolly: 1.6,
        narration:
          'That’s also why a dry glove kills it stone dead — no conductor, no missing charge, no touch. Nothing on this screen has ever moved. It just felt something go missing.',
      },
    ],
  },
};
