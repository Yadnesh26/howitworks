// Editorial layer for video export (scripts/export-video.mjs).
// One flowing voiceover per format (single-take TTS + audio-master pacing);
// captions are the word-synced verbatim rail (--captions), not per-shot
// caption strings. 8-beat arc: pattern interrupt -> hook -> spoken question ->
// reveal -> step-by-step (suck/squeeze/bang/blow, connected) -> isolated
// insight (only one stroke makes power) -> real-world -> callback.
//
// steps: 0 anatomy (solid) · 1 intake · 2 compression · 3 power · 4 exhaust · 5 run
// Short lens: the engine only earns on one stroke of four — it spends the
// other three and lives off the flywheel. Loop: "the dead strokes" (planted
// shot 2, closed in the button).
export default {
  hook: 'Your engine is basically\nfreeloading 75% of the time.',

  // 9:16 — ~70s.
  short: {
    shots: [
      {
        // 1. hook
        step: 0,
        dolly: 1.85,
        narration:
          'Your engine is basically freeloading three quarters of the time. Out of every four strokes, only one pushes the car.',
      },
      {
        // 2. question + planted loop
        step: 0,
        dolly: 1.85,
        narration:
          'So what are the other three for? And what keeps it spinning through the dead strokes?',
      },
      {
        // 3. intake — spending begins
        step: 1,
        dolly: 1.4,
        narration:
          'Stroke one is a breath in. The piston drops like a pulled syringe and drags in a fine mist of fuel and air. That already costs energy.',
      },
      {
        // 4. compression — spends more, sets up the payoff
        step: 2,
        dolly: 1.4,
        narration:
          'Stroke two costs even more. Both valves seal, and the piston crushes that mist to a tenth of its volume. But the tighter the squeeze, the harder it hits back.',
      },
      {
        // 5. power — the one paying stroke
        step: 3,
        dolly: 1.4,
        narration:
          'Because at the top, the spark fires. The explosion hammers the piston down and spins the crank. This is the only stroke that makes power, and it carries the other three.',
      },
      {
        // 6. exhaust — back to spending
        step: 4,
        dolly: 1.4,
        narration:
          'Then it goes straight back to spending. The piston climbs and shoves the burnt gas out, clearing the cylinder for its next breath.',
      },
      {
        // 7. stat + button (closes the loop)
        step: 5,
        dolly: 1.85,
        narration:
          'At highway speed, that one paying stroke lands about twenty five times a second. A heavy flywheel banks each punch and carries the piston through the dead strokes. One explosion pays for everything.',
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
