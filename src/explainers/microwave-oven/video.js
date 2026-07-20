// Editorial layer for video export (scripts/export-video.mjs).
//
// SCRIPTING: written as ONE flowing voiceover per format, not a stack of
// standalone sentences. make-narration.mjs synthesizes the whole thing in a
// single ElevenLabs take (with-timestamps) and the exporter paces the picture
// to the audio, so lines connect the way a real narrator connects them — the
// per-shot `narration` strings below are just the cut points, and each one is
// written to hand off into the next (a trailing thought the following line
// finishes). Kept on an 8-beat arc: pattern interrupt -> curiosity hook ->
// spoken question -> reveal -> step-by-step (with connective tissue) ->
// isolated mind-blowing stat -> real-world connection -> callback ending.
//
// LENGTH: short ~70s (mid-complexity module), long ~2min. Portrait shots carry
// a per-shot `dolly` pull-back so the wide box doesn't crop.
export default {
  hook: 'There’s a lightning storm\ninside this box.',

  // 9:16 — ~70s. One take, 7 shots. Beat 6 (the stat) gets its own shot.
  short: {
    shots: [
      {
        // 1. pattern interrupt + 2. curiosity hook
        step: 0,
        dolly: 2.1,
        caption: 'No flame. Nothing touches it.',
        narration:
          'There’s no flame in here. No hot coil, nothing that even touches your food — and yet, close the door, and it cooks in seconds.',
      },
      {
        // 3. spoken question
        step: 0,
        dolly: 2.1,
        caption: 'So what’s actually doing the cooking?',
        narration: 'So if nothing’s touching it, what on earth is doing the cooking?',
      },
      {
        // 4. reveal
        step: 2,
        dolly: 1.45,
        caption: 'This tube spins electrons in circles',
        narration:
          'This. It’s a vacuum tube called a magnetron, and it does something genuinely wild — it takes electrons and whips them around in circles.',
      },
      {
        // 5. step-by-step (compressed) — hands off into the wave
        step: 2,
        dolly: 1.45,
        caption: '…and that spits out a radio wave',
        narration:
          'Magnets bend their path, they ring twelve little cavities like tuning forks, and out comes a radio wave — the same kind that carries Wi-Fi, just far more powerful.',
      },
      {
        // 5b. the wave in the box
        step: 4,
        dolly: 1.7,
        caption: 'It bounces into fixed hot and cold spots',
        narration:
          'That wave floods the metal box and bounces off every wall, piling up into fixed hot spots and cold spots — which is exactly why the plate spins, to drag your food through all of them.',
      },
      {
        // 6. mind-blowing stat — isolated on its own beat
        step: 5,
        dolly: 1.6,
        caption: '2.5 BILLION flips per second',
        narration:
          'And here’s the part that gets me. Your food is mostly water, and this wave grabs every water molecule and flips it back and forth two and a half billion times a second.',
      },
      {
        // 7. real-world connection + 8. callback ending
        step: 6,
        dolly: 2.1,
        caption: 'That friction IS the heat.',
        narration:
          'All that frantic flipping is friction, and friction is heat — the food heats itself from the inside. No flame. Just a storm of invisible waves, and water that can’t sit still.',
      },
    ],
  },

  // 16:9 — ~2min. The full mechanism, room to breathe. Same arc, developed.
  long: {
    shots: [
      {
        // 1 + 2 pattern interrupt + curiosity hook
        step: 0,
        narration:
          'This is one of the strangest machines in your house. There’s no flame inside it, no glowing element, nothing that ever touches your food. And yet it can boil a mug of water in under two minutes.',
      },
      {
        // 3 spoken question + into the reveal
        step: 1,
        narration:
          'So how does it cook with nothing touching anything? Strip the shell away, and there are really only three parts: a turntable, a short metal duct, and this — a fist-sized tube hidden up in the roof that does all the real work.',
      },
      {
        // 4 reveal — the magnetron
        step: 2,
        narration:
          'It’s called a magnetron, and inside it is something close to controlled chaos. A wire in the middle gets so hot it boils electrons off into empty space — and then two magnets take over.',
      },
      {
        // 5 step: electrons -> wave, connective handoff
        step: 2,
        narration:
          'Instead of letting those electrons fly straight to the copper, the magnets bend them into looping, circling paths. As they sweep past twelve little carved-out cavities, they ring them like tuning forks — and that ringing is a radio wave, oscillating almost two and a half billion times a second.',
      },
      {
        // 5b step: waveguide feed
        step: 3,
        narration:
          'An antenna catches that wave and funnels it up a metal duct — the waveguide — that carries it down into the cooking box. A little spinning fan scatters it around as it arrives, so it isn’t all aimed at one spot.',
      },
      {
        // 5c step: standing wave, why the plate spins
        step: 4,
        narration:
          'And now the wave is trapped. Sealed in a metal box, it can’t escape — it just bounces off every wall and interferes with itself, piling up into a fixed pattern of hot spots and cold spots. Leave food still, and it cooks in stripes. That’s the entire reason the plate turns — to walk every bite through the hot spots in turn.',
      },
      {
        // 6 mind-blowing moment — the actual heating, isolated
        step: 5,
        narration:
          'But here’s the beautiful part. The wave doesn’t heat the food directly at all. Water molecules are lopsided — positive on one end, negative on the other — so they twist to line up with the wave. And because the wave flips two and a half billion times a second, so do they. That furious wobbling is friction, and friction is warmth. The water heats itself.',
      },
      {
        // 7 real-world + 8 callback ending
        step: 6,
        narration:
          'That’s also why it reheats unevenly, and why dry things barely warm at all — no water, no wobble. A tube that spins electrons into a wave, a box that traps it, and water that can’t hold still. No flame, no contact — just physics, quietly cooking your dinner.',
      },
    ],
  },
};
