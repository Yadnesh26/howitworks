// Editorial layer for video export (scripts/export-video.mjs).
//
// SCRIPTING: one flowing voiceover, synthesized as a single ElevenLabs take —
// per-shot `narration` strings are just the cut points; each hands off into
// the next. 8-beat arc: pattern interrupt -> stakes/planted loop -> spoken
// question -> reveal -> BUT/THEREFORE mechanism beats -> isolated stat ->
// so-what -> callback button. Loop: "twenty five kilos" planted in shot 2's
// question, closed word-for-word in the shot 7 button.
export default {
  hook: 'There’s a block of concrete\nbolted inside your washing machine.',

  // 9:16 — ~75s. One take, 7 shots.
  short: {
    shots: [
      {
        // Zone 1+2 — hook + stakes, on the sealed hero (full model, matches
        // the "add-explainer" storyboard convention of opening on the whole
        // finished object)
        step: 0,
        dolly: 2.0,
        narration:
          'There’s a block of concrete bolted inside your washing machine. It’s there because for a few seconds every cycle, this thing is trying to fly apart.',
      },
      {
        // Zone 3+4a — the spoken question plants the loop ("twenty five
        // kilos"), then the reveal cuts to the cutaway
        step: 1,
        dolly: 1.7,
        labels: ['Outer tub — holds the water', 'Perforated inner drum'],
        narration:
          'So what needs twenty-five kilos of dead weight, just to keep it still? Pop the cabinet off, and it’s a drum inside a drum. Only the inner one ever turns.',
      },
      {
        // Zone 4b — BUT: the tumble speed limit
        step: 3,
        dolly: 1.6,
        labels: ['Lifter paddle', '~50 rpm — gravity still wins'],
        narration:
          'But that drum can’t just spin fast. Past about sixty rpm, the wall throws the load outward harder than gravity pulls it down, so nothing falls anymore. That’s why wash tumbling stays a lazy fifty.',
      },
      {
        // Zone 4c — the second surprise: no belt
        step: 4,
        dolly: 1.7,
        labels: ['Rotor — 36 magnets', 'Stator — wound coils'],
        narration:
          'There’s no belt driving it, either. The drum shaft bolts straight onto a ring of thirty-six magnets that chase coils without ever touching them.',
      },
      {
        // Zone 5 — the isolated stat, re-hooked
        step: 5,
        dolly: 1.6,
        labels: ["Perforations — the water's only exit", '1400 rpm ≈ 500 g at the drum wall'],
        narration:
          'But here’s the part that gets me. Once the tub drains, that same drum ramps up to fourteen hundred rpm. At the wall, that’s roughly five hundred times gravity.',
      },
      {
        // Zone 6 — so-what, back on the cutaway to show what is fighting it
        step: 1,
        dolly: 1.7,
        labels: ['Counterweight — 25 kg', 'Suspension spring', 'Friction damper'],
        narration:
          'That’s the force the springs, the dampers, and that block of concrete are fighting, every single time you press start.',
      },
      {
        // Zone 7 — button: callback, closes the "twenty-five kilos" loop
        step: 6,
        dolly: 2.0,
        narration: 'Twenty-five kilos, just to hold still.',
      },
    ],
  },
};
