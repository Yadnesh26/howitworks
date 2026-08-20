// Editorial layer for video export (scripts/export-video.mjs).
// steps: 0 hero · 1 nucleus · 2 protons · 3 neutrons · 4 shells · 5 cloud
//        6 orbitals · 7 scale · 8 run
//
// SCRIPTING: one flowing voiceover, synthesized as a single ElevenLabs take;
// each shot's line is a cut point that hands off into the next. Captions are
// the verbatim voice rail, so the hook lives in shot 1's first sentence.
//
// STORY LENS: the site's own step 6 ("The rings are a lie") is the sharpest,
// most visually unique thing this model can show — nobody else's atom video
// can do a live ring-to-cloud dissolve. So the loop is built on that, not on
// the more generic "atoms are mostly empty space" fact (which still gets a
// beat, as the isolated stat, but isn't the spine).
//
// The loop: planted word-for-word in the hook ("were never really there") and
// closed in the button ("Never really there."), which also re-arms the hook
// when the short replays.
//
// No em/en dashes anywhere. Numbers spelled as spoken.
export default {
  hook: 'The rings you\'re picturing\nwere never really there.',

  platforms: {
    shorts: {
      title: 'The atom diagram you learned is wrong',
      hashtags: ['#atom', '#physics', '#chemistry', '#science', '#quantum'],
    },
  },

  // 9:16 — ~80s. Spine: hook (the ring lie) -> stakes -> spoken question ->
  // BUT/THEREFORE mechanism (strong force, shells) -> reveal (the cloud,
  // which pays off the hook) -> isolated stat (scale) -> so-what -> button
  // (closes the loop, sets up the replay).
  short: {
    shots: [
      {
        // Zone 1 — hook: the boldest true claim, word one, on the full atom
        step: 0,
        dolly: 1.6,
        narration:
          "The rings you're picturing around this atom? They were never really there.",
      },
      {
        // Zone 2 — stakes: name the real thing, second surprise
        step: 0,
        dolly: 1.6,
        narration:
          "This is carbon. Six protons, six neutrons, six electrons, and almost none of it is actually there.",
      },
      {
        // Zone 3 — spoken question, clean frame on the nucleus
        step: 1,
        dolly: 2.6,
        labels: [],
        narration:
          "So zoom into the one part that isn't empty. Six positive charges are crushed together in here. What's stopping them from blowing apart?",
      },
      {
        // Zone 4a — THEREFORE: the strong force answers the question
        step: 2,
        dolly: 2.6,
        labels: ['6 protons', 'Like charges repel'],
        narration:
          "A second force, one that only reaches as far as the next particle over, but beats electric repulsion by more than a hundred to one.",
      },
      {
        // Zone 4b — THEREFORE: the electrons outside can't sit anywhere either
        step: 4,
        dolly: 1.7,
        labels: ['First shell · 2', 'Second shell · 4 of 8'],
        narration:
          "Therefore six electrons balance that charge from outside, but they can't sit wherever they like. Two fill the first shell. Four fill the second.",
      },
      {
        // Zone 4c — the reveal: pays off the hook's loop
        step: 5,
        dolly: 1.9,
        labels: ['Where it probably is'],
        narration:
          "Freeze one for a photo and there's no ring at all. Just fog, thickest exactly where that ring was drawn.",
      },
      {
        // Zone 5 — the stat, isolated on its own beat
        step: 7,
        dolly: 1.8,
        narration:
          "Here's the number that actually gets me. Shrink that nucleus down to its real size and it's a twenty-five-thousandth of the atom's width. A marble at the center of a stadium.",
      },
      {
        // Zone 6 — so-what: the everyday consequence
        step: 8,
        dolly: 1.7,
        narration:
          "And that marble is almost the entire mass, which is why your hand never actually touches this table. Two electron clouds just refuse to overlap.",
      },
      {
        // Zone 7 — button: closes the loop, sets up the replay
        step: 8,
        dolly: 1.7,
        narration: 'Those rings? Never really there.',
      },
    ],
  },
};
