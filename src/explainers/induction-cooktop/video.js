// Editorial layer for video export (scripts/export-video.mjs).
//
// SCRIPTING: written as ONE flowing voiceover, not a stack of standalone
// sentences. make-narration.mjs synthesizes the whole thing in a single
// ElevenLabs take (with-timestamps) and the exporter paces the picture to the
// audio, so the per-shot `narration` strings below are only the cut points —
// each is written to hand off into the next.
//
// CAPTIONS are the verbatim voice rail (short-words.json), so every spoken word
// is also the on-screen word. There is no per-shot `caption` one-liner (that's
// the legacy fallback for when no words.json exists) and no title card, so the
// hook has to live in shot 1's first spoken sentence, which it does.
//
// The loop: "the pan is cooking itself" is planted in shot 2 and closed
// word-for-word in the button (shot 9), which also sets up the hook on replay.
// No em/en dashes in any narration line — ElevenLabs renders them as dead air
// the speed knob can't compress.
//
// LENGTH: short ~85s at ~2.3 words/sec (190 words). Portrait shots carry a
// per-shot `dolly` pull-back so the wide slab doesn't crop, and `labels` so
// only the callout being talked about is on screen.
export default {
  // Legacy-only (burns as a card only if words.json is missing). Kept in sync
  // with shot 1's opening line.
  hook: 'This cooktop\nnever gets hot.',

  // 9:16 — one take, 9 shots on the retention spine: hook → stakes+loop →
  // question → BUT/THEREFORE mechanism → isolated stat → so-what → button.
  short: {
    shots: [
      {
        // Zone 1 — hook: boldest true claim, word one, over the sealed product
        step: 0,
        dolly: 1.5,
        labels: [],
        narration:
          'This cooktop never gets hot. Boil water on it, slide the pan aside, and the glass underneath is barely warm.',
      },
      {
        // Zone 2+3 — stakes, the planted loop, then the spoken question
        step: 0,
        dolly: 1.5,
        labels: [],
        narration:
          "So whatever's cooking your dinner, it isn't the cooktop. The pan is cooking itself. What's under that glass?",
      },
      {
        // Zone 4a — the reveal, and how little there is to it
        step: 1,
        dolly: 1.5,
        labels: ['Litz-wire coil — 22 turns'],
        narration:
          "One flat coil of wire, wound like a clock spring. That's the entire heater, and nothing in it glows or burns.",
      },
      {
        // Zone 4b — THEREFORE: mains is too slow, so the board speeds it up
        step: 2,
        dolly: 1.35,
        labels: ['IGBT half-bridge'],
        narration:
          'Wall current alternates fifty times a second, which is far too slow, so this board chops it up to about twenty-five thousand.',
      },
      {
        // Zone 4c — BUT connective: the worktop simply does not participate
        step: 3,
        dolly: 1.5,
        labels: ['Glass is invisible to magnetism'],
        narration:
          "Current going round a coil always drags a magnetic field with it. But glass ceramic isn't magnetic, so that field passes straight through the worktop as if it weren't there.",
      },
      {
        // Zone 4d — where the heat is actually made
        step: 4,
        dolly: 1.35,
        labels: ['Eddy currents'],
        narration:
          'It lands in the steel base of your pan, where a changing field drives loops of current. The steel resists them, and that resistance is heat.',
      },
      {
        // Zone 5 — the stat, isolated on its own beat with a re-hook
        step: 4,
        dolly: 1.35,
        labels: ['Heat in the outer 0.1 mm'],
        narration:
          "Here's the part that gets me. Almost all of that happens in the outer tenth of a millimetre of the base, a skin thinner than a sheet of paper.",
      },
      {
        // Zone 6 — so-what: the two rules every induction owner runs into
        step: 5,
        dolly: 1.6,
        labels: ['No pan — no load'],
        narration:
          'Which is why aluminium pans do nothing, and why lifting the pan shuts the zone off in about a second.',
      },
      {
        // Zone 7 — button: closes the loop, 8 words, sets up the hook on replay
        step: 6,
        dolly: 1.5,
        labels: [],
        narration: 'The pan cooks itself. The glass just watches.',
      },
    ],
  },
};
