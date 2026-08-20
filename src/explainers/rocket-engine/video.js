// Editorial layer for video export (scripts/export-video.mjs). Short-form
// only for now — no long-form exists, so the end card below does NOT point
// at YouTube (see the override at the bottom).
//
// steps: 0 complete · 1 feed · 2 turbopump · 3 gasgenerator · 4 injector ·
// 5 chamber · 6 nozzle · 7 gimbal · 8 run
//
// SCRIPTING: one flowing voiceover, not standalone sentences — make-narration.mjs
// synthesizes the whole short in a single ElevenLabs take and the exporter paces
// the picture to the audio. 8-beat arc: pattern interrupt -> stakes + planted loop
// -> spoken question -> mechanism (turbopump -> gas generator -> injector, BUT/
// THEREFORE) -> isolated stat -> so-what -> callback button. The loop is "this
// whole machine is a pump wearing a rocket's costume," planted in shot 2 and
// closed in the button (shot 7).
export default {
  hook: 'Almost none of this rocket engine\nis about burning fuel.',

  short: {
    dolly: 2.0,
    shots: [
      {
        // Zone 1 — hook: boldest true claim, word one, full model
        step: 0,
        dolly: 2.3,
        seconds: 4,
        narration: 'Almost none of this rocket engine is about burning fuel.',
      },
      {
        // Zone 2 — stakes + planted loop
        step: 0,
        dolly: 2.3,
        seconds: 13,
        narration:
          'The fire is the easy part. The real fight is forcing three hundred kilos of liquid a second into a chamber already near a hundred atmospheres. This whole machine is basically a pump wearing a rocket’s costume.',
      },
      {
        // Zone 3+4a — spoken question, then reveal: the turbopump
        step: 2,
        dolly: 1.5,
        seconds: 9,
        labels: ['One shaft · 36,000 rpm'],
        narration:
          'So what’s strong enough to push liquid in that hard, forever? This. Three wheels on one shaft, spinning at thirty six thousand rpm.',
      },
      {
        // Zone 4b — BUT: what spins the shaft
        step: 3,
        dolly: 1.6,
        seconds: 9,
        labels: ['Gas generator', 'Turbine'],
        narration:
          'But something has to spin that shaft this fast. Bolted to its side is a second, smaller rocket engine, whose only job is turning the pump.',
      },
      {
        // Zone 4c — THEREFORE: the propellants finally meet
        step: 4,
        dolly: 1.45,
        seconds: 9,
        labels: ['Pintle post'],
        narration:
          'Downstream, the two propellants finally meet: two sheets of liquid colliding at ninety degrees, shattering into a mist that burns in thousandths of a second.',
      },
      {
        // Zone 5 — the stat, isolated, with a re-hook
        step: 2,
        dolly: 1.5,
        seconds: 10,
        narration:
          'Here’s the part that gets me. That pump alone puts out ten thousand horsepower, more than a train locomotive, from something you could carry under one arm.',
      },
      {
        // Zone 6+7 — so-what, then the callback button (closes the loop)
        step: 8,
        dolly: 2.1,
        seconds: 12,
        narration:
          'Because it’s just one moving part, you can throttle it down, shut it off, and light it again. That’s the only reason landing a rocket booster works. It’s not a rocket. It’s a pump wearing a rocket’s costume.',
      },
    ],
  },

  // No long-form yet — override the format-aware default ("Full length
  // version / on YouTube"), which would point at content that doesn't exist.
  endCard: 'Share it. whatDstuff',

  platforms: {
    shorts: {
      title: 'The rocket engine part nobody talks about',
      hashtags: ['rocketengine', 'spacex', 'engineering', 'whatdstuff', 'space'],
    },
  },
};
