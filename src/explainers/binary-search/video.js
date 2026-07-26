// Editorial layer for video export (scripts/export-video.mjs).
// One flowing voiceover per format (single-take TTS + audio-master pacing);
// captions OFF by default (hook/caption fields kept for an optional --captions
// cut). 8-beat arc: pattern interrupt -> curiosity hook -> spoken question ->
// reveal -> step-by-step (connected) -> isolated insight (log2(16)=4, scales
// to ~20 at 1M / 32 at 4B) -> real-world (git bisect) -> callback ending.
//
// steps: 0 overview · 1 bounds · 2 probe-1 · 3 probe-2 · 4 probe-3 · 5 found · 6 run
// The model is a wide horizontal rail (16-tile array) — portrait shots carry
// a heavier dolly pull-back than a boxy product so the full row still fits.
export default {
  hook: 'Finding 1 number in a million\ntakes 20 guesses. Not a million.',

  // 9:16 — ~70s.
  short: {
    shots: [
      {
        // 1. pattern interrupt
        step: 0,
        dolly: 2.3,
        caption: '1 in a million — 20 guesses',
        narration:
          'Give me a sorted list of a million numbers, and I can find any one of them in twenty guesses. Not a million — twenty.',
      },
      {
        // 2. curiosity hook + 3. spoken question
        step: 0,
        dolly: 2.3,
        caption: 'So how do you skip 999,980 of them?',
        narration: 'So how do you skip past nearly a million numbers you never even look at?',
      },
      {
        // 4. reveal
        step: 2,
        dolly: 1.6,
        caption: 'Check the middle. That’s the whole trick.',
        narration:
          'You check the exact middle. One comparison — and you’ve just proven which half the number can’t possibly be hiding in.',
      },
      {
        // 5. step-by-step (compressed)
        step: 4,
        dolly: 1.6,
        caption: 'Throw away half. Every single time.',
        narration:
          'Throw that half away, check the new middle, throw half of THAT away — sixteen numbers become eight, then four, then two.',
      },
      {
        // 6. mind-blowing stat — isolated on its own beat
        step: 5,
        dolly: 1.5,
        caption: '16 numbers, found in 4 steps',
        narration:
          'Sixteen numbers, found in exactly four steps — because four is log-base-two of sixteen. Double the list, and it only costs one more step.',
      },
      {
        // 7. real-world connection
        step: 6,
        dolly: 2.3,
        caption: 'The same trick runs `git bisect`',
        narration:
          'This exact trick is what git bisect uses to hunt down which commit broke your build — and why a dictionary never needed a million pages flipped.',
      },
      {
        // 8. callback ending
        step: 6,
        dolly: 2.3,
        caption: '20 guesses. Not a million.',
        narration:
          'Halve it, halve it again, and a search that should take forever takes twenty guesses instead of a million.',
      },
    ],
  },

  // 16:9 — ~2min.
  long: {
    shots: [
      {
        // 1 + 2 pattern interrupt + hook
        step: 0,
        narration:
          'Here’s a party trick disguised as computer science: hand me a sorted list of a million numbers, and I’ll find any single one of them in twenty guesses. Not a thousand, not a hundred — twenty. This is binary search, sixteen numbers here laid out in order, and that ordering is the entire secret.',
      },
      {
        // 3 spoken question, into bounds
        step: 1,
        narration:
          'Before the first guess, it sets two bookmarks: lo at the very first number, hi at the very last. Whatever we’re hunting for — if it’s in this list at all — has to be sitting somewhere between them. Every move from here on is just nudging one of these two markers closer to the other.',
      },
      {
        // 4 reveal — the first comparison
        step: 2,
        narration:
          'So here’s the first guess, and it’s never a wild one — it’s always the exact middle. Index seven, the number forty-one. Compare it to our target, eighty-four: forty-one is smaller, which means eighty-four, if it’s here, has to be to the right. And just like that, eight numbers — half the entire list — are eliminated. Not scanned, not skipped one by one. Erased in a single comparison.',
      },
      {
        // 5 step-by-step, connective
        step: 3,
        narration:
          'lo jumps straight to eight — there’s no reason to ever look at what was just thrown away. New middle: index eleven, sixty-five. Still smaller than eighty-four, so the left half of what’s left goes too. Two comparisons in, and twelve of the sixteen numbers are already gone.',
      },
      {
        // 5b step-by-step, down to two
        step: 4,
        narration:
          'Middle again: index thirteen, seventy-seven — still under eighty-four. lo climbs to fourteen. Only two numbers remain in play. Three comparisons have done more work than a plain left-to-right scan could manage in fourteen.',
      },
      {
        // 6 isolated mind-blowing stat
        step: 5,
        narration:
          'One more guess. Index fourteen: eighty-four. A match, on the fourth comparison. And that number four isn’t a coincidence — it’s log base two of sixteen, the mathematical ceiling on how many guesses this size of list can ever demand. Here’s the part that should sound impossible: double the list to a million entries, and the worst case only climbs to about twenty comparisons. Double it again to four billion, and it’s thirty-two. Every extra guess doesn’t add capacity — it doubles it.',
      },
      {
        // 7 real-world + 8 callback
        step: 6,
        narration:
          'This exact halving trick runs constantly outside of textbooks. Programmers use git bisect to hunt down which of thousands of commits broke a build, by testing the middle one and throwing away half the history each time. It’s why looking up a word doesn’t require reading the whole dictionary. Halve it, halve it again, and a search that should take forever takes twenty guesses instead of a million.',
      },
    ],
  },
};
