// Editorial layer for video export (scripts/export-video.mjs).
// One flowing voiceover per format (single-take TTS + audio-master pacing);
// captions OFF by default (hook/caption fields kept for an optional --captions
// cut). 8-beat arc: pattern interrupt -> hook -> spoken question -> reveal ->
// step-by-step (suck/squeeze/bang/blow, connected) -> isolated insight (only
// one stroke makes power) -> real-world -> callback.
//
// steps: 0 anatomy (solid) · 1 intake · 2 compression · 3 power · 4 exhaust · 5 run
export default {
  hook: 'Your car runs on\nthousands of tiny explosions.',

  // 9:16 — ~70s.
  short: {
    shots: [
      {
        // 1. pattern interrupt
        step: 0,
        dolly: 1.85,
        caption: 'It runs on controlled explosions',
        narration:
          'Your car doesn’t really run on fuel — it runs on thousands of tiny, controlled explosions, every single minute.',
      },
      {
        // 2. hook + 3. question
        step: 0,
        dolly: 1.85,
        caption: 'One piston. Four simple moves.',
        narration:
          'And it pulls them off with just one piston, sliding up and down, and four simple strokes. So how does a puff of fuel actually become motion?',
      },
      {
        // 5. suck
        step: 1,
        dolly: 1.4,
        caption: 'Intake — it inhales fuel and air',
        narration:
          'First, it inhales. The piston drops like a syringe, a valve swings open, and it sucks in a fine mist of fuel and air.',
      },
      {
        // squeeze
        step: 2,
        dolly: 1.4,
        caption: 'Compression — squeezed tight',
        narration:
          'Then both valves slam shut, and the piston squeezes that mist into a tiny, tense space — because the tighter you pack it, the harder it hits back.',
      },
      {
        // bang + insight seed
        step: 3,
        dolly: 1.4,
        caption: 'Power — the spark, the bang',
        narration:
          'Now, the spark. The mixture detonates and blasts the piston down — and this, right here, is the only one of the four strokes that actually makes power.',
      },
      {
        // blow
        step: 4,
        dolly: 1.4,
        caption: 'Exhaust — the burnt gas is pushed out',
        narration:
          'The piston rises again and shoves the burnt gas out the back, leaving the cylinder empty and ready to do it all over again.',
      },
      {
        // 6. isolated insight + 8. callback
        step: 5,
        dolly: 1.85,
        caption: 'Only 1 of 4 strokes makes power',
        narration:
          'Suck, squeeze, bang, blow. But since only one stroke makes power, a heavy flywheel coasts through the other three — turning a rhythm of explosions into smooth, endless spin.',
      },
    ],
  },

  // 16:9 — ~2min.
  long: {
    shots: [
      {
        // 1 + reveal
        step: 0,
        narration:
          'This is a single-cylinder engine — the same basic idea running under the hood of almost every car, just simplified down to one. A piston slides up and down inside the cylinder. A connecting rod links it to the crankshaft, which turns that up-and-down motion into spinning. And two valves in the head let the engine breathe in and out. From these few parts, four simple strokes turn a drop of fuel into motion.',
      },
      {
        // 5 suck
        step: 1,
        narration:
          'It all starts by inhaling. The piston travels down the cylinder, and at the same moment, the intake valve swings open. Just like pulling back a syringe, that growing empty space lowers the pressure and draws in a fresh mist of air and fuel — shown here in blue — through the open port.',
      },
      {
        // squeeze
        step: 2,
        narration:
          'Next comes the squeeze. Both valves seal completely shut, trapping the mixture, and the piston drives back up, cramming it into a fraction of its original size — often eight or ten times smaller. And this compression is the secret to power: the tighter you pack the mixture, the more violently it burns.',
      },
      {
        // bang + insight
        step: 3,
        narration:
          'At the very top of that squeeze, the spark plug fires. The compressed mixture ignites all at once and expands with tremendous force, hammering the piston back down. This — and only this — is the stroke that actually produces power. Everything else is just setup. The crankshaft catches that shove and banks it as spin.',
      },
      {
        // blow
        step: 4,
        narration:
          'Finally, the engine breathes out. The exhaust valve opens, and the rising piston sweeps the spent, burnt gas out through the port, shown in grey. The cylinder is scavenged clean and ready to inhale again. Intake, compression, power, exhaust — or, as mechanics say it, suck, squeeze, bang, blow.',
      },
      {
        // 6 isolated insight + 8 callback
        step: 5,
        narration:
          'And it simply never stops. But here’s the catch: the engine only fires once for every two full turns of the crank, so three of every four strokes actually consume energy instead of making it. That’s why every engine has a heavy flywheel — it stores the punch from each explosion and coasts the piston through the three dead strokes, smoothing a stutter of tiny bangs into steady, usable power. In a real car, this whole cycle repeats about fifty times a second.',
      },
    ],
  },
};
