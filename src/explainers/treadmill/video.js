// Editorial layer for video export (scripts/export-video.mjs).
//
// SCRIPTING: written as ONE flowing voiceover, not a stack of standalone
// sentences — make-narration.mjs synthesizes the whole short in a single
// ElevenLabs take and the exporter paces the picture to the audio, so the
// per-shot `narration` strings below are cut points, each written to hand
// off into the next. 8-beat arc: hook -> stakes+promise -> question ->
// BUT/THEREFORE mechanism -> isolated stat -> so-what -> callback button.
// The loop: "cheating" is planted in shot 1, closed word-for-word in the
// button (shot 8).
export default {
  hook: 'Your treadmill has been\nquietly cheating you.',

  // 9:16 — ~70s, 8 shots. step indices: 0 console, 1 inside, 2 motor,
  // 3 deck, 6 incline, 7 run.
  short: {
    shots: [
      {
        // Zone 1 — hook: boldest true claim, word one
        step: 0,
        dolly: 1.9,
        narration: 'Your treadmill has been quietly cheating you.',
      },
      {
        // Zone 2 — stakes stacked, loop planted ("one tap" pays off in the button)
        step: 0,
        dolly: 1.9,
        narration:
          'Every mile on this thing is a little easier than the same mile outside. And the fix takes one tap.',
      },
      {
        // Zone 3 — the spoken question
        step: 1,
        dolly: 1.9,
        narration:
          "So what's happening under this hood that makes running in place different from running for real?",
      },
      {
        // Zone 4a — reveal: one motor, the 3:1 reduction
        step: 2,
        dolly: 1.7,
        labels: ['DC drive motor', 'Roller pulley — 3:1'],
        narration:
          "Open it up, and it's almost insultingly simple. One motor spins a pulley three times faster than the roller it drives.",
      },
      {
        // Zone 4b — BUT: the belt is a friction trick, not the load-bearer
        step: 3,
        dolly: 1.75,
        labels: ['Waxed low-friction face'],
        narration:
          "That roller drags a belt over a board waxed slicker than ice, so the friction that would fry the motor is basically gone. But the belt isn't carrying your weight. The waxed board is.",
      },
      {
        // Zone 5 — the stat, isolated, with a re-hook pivot
        step: 7,
        dolly: 1.3,
        narration:
          "None of that changes the one thing a treadmill can't fake, though. Air. Sports scientists measured it directly: running indoors costs less energy than running the same pace outside.",
      },
      {
        // Zone 6 — so-what: the honest fix
        step: 6,
        dolly: 2.6,
        narration:
          'So every flat run in here is quietly a little too easy. The fix is one tap. Set the incline to one percent.',
      },
      {
        // Zone 7 — callback button, closes the loop
        step: 7,
        dolly: 1.3,
        narration: 'Tap one percent. Now it stops cheating for you.',
      },
    ],
  },

  platforms: {
    shorts: {
      title: 'Your treadmill is quietly cheating you',
      hashtags: ['#treadmill', '#howitworks', '#fitness', '#running', '#engineering'],
    },
  },
};
