// Editorial layer for video export (scripts/export-video.mjs).
//
// SCRIPTING: one flowing voiceover, synthesized as a single ElevenLabs take —
// each shot's line hands off into the next. Built on the video-scripting
// spine: hook -> stakes+promise -> spoken question -> BUT/THEREFORE mechanism
// -> isolated stat -> so-what -> callback button.
//
// REWORK (v2): the first cut leaned on only 4 distinct camera setups across 6
// shots (two step-repeats back to back) and read static; it also skipped the
// module pop-out entirely. This version hits 6 distinct steps across 9 shots
// — including the physical "you can just pull it off" reveal (step 2) and its
// bare-back anatomy (step 3), which is the single most eye-catching thing this
// model does and belongs on screen, not just described. TWO loops now plant
// in shots 1-2 ("75% dark" / "color doesn't exist") and close together in one
// button line ("most of what you're seeing isn't really there") — the
// dark-pixel loop also gets an explicit mid-video re-hook (shot 5: "That's how
// it stays that dark") so the opening claim doesn't go cold for 40+ seconds.
export default {
  hook: 'Seventy-five percent of this screen\nis dark, right now.',

  // 9:16 — ~90s. One take, 9 shots across 6 distinct camera setups.
  short: {
    shots: [
      {
        // Zone 1+2 — hook (concrete stat) + stakes (2nd loop planted). Full
        // model, matches the "first shot shows the entire model" rule.
        step: 0,
        dolly: 1.8,
        narration:
          "Seventy-five percent of this screen is dark, right now. And every color you're looking at? It doesn't actually exist.",
      },
      {
        // Zone 3 — the spoken question, macro push for visual variety
        step: 1,
        dolly: 1.5,
        narration: 'So what is really going on in here?',
      },
      {
        // Zone 4a — reveal: the physical pop-out (the money shot)
        step: 2,
        dolly: 1.6,
        narration:
          'Turns out, you can just pull a piece of it clean off. This entire wall is built from hundreds of these individual panels, held on by magnets — not a single cable in sight.',
      },
      {
        // Zone 4b — BUT connective: bare back, no cable mess
        step: 3,
        dolly: 1.4,
        narration:
          "But flip it around, and there's no mess of wires waiting for you either — just a chip, and contacts that meet the frame.",
      },
      {
        // Zone 4c — THEREFORE + re-hook: closes back on the opening stat
        step: 4,
        dolly: 1.4,
        narration:
          "That's how it stays that dark, by the way: a chip scans it row by row, flashing sections on and instantly off, thousands of times a second.",
      },
      {
        // Zone 4d — BUT connective: dark solved, now the color loop
        step: 5,
        dolly: 1.4,
        narration:
          'But that only solves the dark part — what about the color? Each pixel is really three separate lights: red, green, blue, each flickering at its own speed. Mix light like paint, fast enough, and your eye invents a color that was never actually there.',
      },
      {
        // Zone 5 — isolated stat, held on the same shot (a beat of space)
        step: 5,
        dolly: 1.4,
        narration:
          'Fast enough meaning: some of these chips refresh close to four thousand times every second.',
      },
      {
        // Zone 6 — so-what: real-world scale
        step: 7,
        dolly: 1.8,
        narration:
          "So the same trick works whether it's a screen the size of a building, or the one in your pocket.",
      },
      {
        // Zone 7 — callback button, closes BOTH loops in one line
        step: 7,
        dolly: 1.8,
        narration:
          "Which means, next time you look at a screen — remember, most of what you're seeing isn't really there.",
      },
    ],
  },
};
