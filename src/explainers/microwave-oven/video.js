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

  // 9:16 — ~70s. One take, 7 shots, built on the video-scripting spine:
  // hook → stakes+promise → question → BUT/THEREFORE mechanism → isolated stat
  // → so-what → callback button. "caged lightning" + "inside out" is the loop,
  // planted in shots 1-2 and closed in the button (shot 7).
  short: {
    shots: [
      {
        // Zone 1 — hook: boldest true claim, word one; matches the full-model shot
        step: 0,
        dolly: 2.1,
        caption: 'Nothing in here touches your food.',
        narration:
          'Nothing in this box ever touches your food. No flame, no coil, no contact — yet it’ll boil a cup of water in about ninety seconds.',
      },
      {
        // Zone 2+3 — stakes + planted loop, then the spoken question
        step: 0,
        dolly: 2.1,
        caption: 'So how — without touching anything?',
        narration:
          'Whatever’s doing it is basically caged lightning — and it cooks your food from the inside out. So how, without touching anything?',
      },
      {
        // Zone 4a — reveal: name the part, define the jargon on first use
        step: 2,
        dolly: 1.45,
        caption: 'It starts with a tube: the magnetron',
        narration:
          'It starts with this tube — a magnetron. A wire inside gets so hot it boils electrons off into empty space.',
      },
      {
        // Zone 4b — BUT connective + universal analogy → the radio wave
        step: 2,
        dolly: 1.45,
        caption: 'Magnets ring it like a wine glass',
        narration:
          'But they don’t fly straight — two magnets bend them into loops. As they sweep past twelve little cavities, they set them ringing like a wet finger on a wine glass. That ringing is a radio wave — the same band as your Wi-Fi, thousands of times stronger.',
      },
      {
        // Zone 4c — THEREFORE: trapped wave → hot/cold spots → why the plate spins
        step: 4,
        dolly: 1.7,
        caption: 'It piles into hot and cold spots',
        narration:
          'The wave floods the metal box and can’t escape, so it piles up — some spots turn blazing hot, others stay cold. That’s the whole reason the plate spins.',
      },
      {
        // Zone 5 — the stat, isolated on its own beat with a re-hook
        step: 5,
        dolly: 1.6,
        caption: '2.5 BILLION flips per second',
        narration:
          'But here’s the part that gets me. Your food is mostly water — and this wave flips every water molecule back and forth two and a half billion times a second.',
      },
      {
        // Zone 6+7 — so-what, then the callback button (closes the loop)
        step: 6,
        dolly: 2.1,
        caption: 'The food cooks itself, from the inside out.',
        narration:
          'All that flipping is friction, and friction is heat — so the food cooks itself, from the inside out. It’s why dry food barely warms: no water, no wobble. No flame, no touch — just caged lightning, and water that can’t sit still.',
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
