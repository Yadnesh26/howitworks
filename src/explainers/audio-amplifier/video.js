// Editorial layer for video export (scripts/export-video.mjs).
//
// SCRIPTING: written as ONE flowing voiceover, not standalone sentences.
// make-narration.mjs synthesizes the whole short in a single ElevenLabs take
// and the exporter paces the picture to the audio — each shot's line hands
// off into the next. 8-beat arc: pattern interrupt -> curiosity hook ->
// spoken question -> reveal -> step-by-step (BUT/THEREFORE) -> isolated
// stat -> so-what -> callback button.
//
// LOOP: planted in shot 2 ("built out of wall power") and closed with the
// same words in the button (shot 10). The scene is unusually WIDE (three
// separate units laid out on one plinth), so the establishing shots (0, run)
// carry an aggressive dolly pull-back.
//
// DOLLY: the site's own portrait auto-correction (frameForViewport in
// player.js) is DISABLED during export (isExportRender() bails out early) —
// export gets zero automatic recentering and relies entirely on the `dolly`
// below. Every camera pose in index.js was composed for the desktop layout,
// where the text panel owns the left ~38% and the subject sits rule-of-thirds
// right; in portrait there is no panel, so that same off-center aim pushes
// the subject toward the right frame edge and crops it unless dolly pulls
// back enough to compensate. Values here were tuned against actual rendered
// frames (renders/audio-amplifier/rev-*.jpg), not guessed — the capsule and
// output-stage macro shots needed much more pull-back than the interior
// preamp/supply shots, which were already well framed near the default.
//
// steps: 0 chain (hero, all 3 units) · 1 capsule (mic section cut) ·
//        2 preamp · 3 supply (transformer + caps) · 4 pushpull (output
//        transistors) · 5 driver (speaker section cut) · 6 run (finale)
export default {
  hook: 'Your voice never gets\nlouder in here.',

  // 9:16 — ~80s. One take, 10 shots, on the video-scripting spine.
  short: {
    shots: [
      {
        // Zone 1 — hook: boldest true claim, word one; the whole chain, wide
        step: 0,
        dolly: 2.5,
        narration:
          'Your voice never gets louder in here. Not once, the whole way through.',
      },
      {
        // Zone 2 — stakes + the planted loop ("built out of wall power")
        step: 0,
        dolly: 2.5,
        narration:
          "What leaves that speaker isn't your voice turned up. It's a brand new wave, built out of wall power.",
      },
      {
        // Zone 3 — the spoken question, into the reveal
        step: 1,
        dolly: 2.2,
        labels: ['Diaphragm', 'Voice coil', 'Magnet'],
        narration: 'So what happens in between? It starts with the microphone.',
      },
      {
        // Zone 4a — reveal: name the parts, the signal is born tiny
        step: 1,
        dolly: 2.2,
        labels: ['Diaphragm', 'Voice coil', 'Magnet'],
        narration:
          "Sound pushes a film thinner than a hair, and a coil swings inside a magnet. That whisper is the whole signal, about two thousandths of a volt.",
      },
      {
        // Zone 4b — THEREFORE: too weak, so it gets boosted
        step: 2,
        dolly: 1.4,
        labels: ['Preamp transistor'],
        narration: 'So a transistor grabs that whisper and blows it up a hundred times over.',
      },
      {
        // Zone 4c — BUT: the boost isn't free energy, it's borrowed
        step: 3,
        dolly: 1.4,
        labels: ['Power transformer', 'Reservoir capacitors'],
        narration:
          "But that transistor isn't making energy. It's borrowing it. A transformer and two capacitors hold a reserve of current, straight from the wall.",
      },
      {
        // Zone 4d — re-hook: how the reserve actually gets released
        step: 4,
        dolly: 1.9,
        labels: ['Push transistor (NPN)', 'Pull transistor (PNP)'],
        narration:
          "Here's the part that gets me. Two transistors take turns opening a valve to that power, one pushing and one pulling, and the handoff is too fast to ever hear.",
      },
      {
        // Zone 5 — the stat, isolated, with a beat of space
        step: 4,
        dolly: 1.9,
        narration:
          'That valve now controls tens of watts, a jump of more than a thousand times the microphone\'s signal.',
      },
      {
        // Zone 6 — so-what: the payoff, driven by everything before it
        step: 5,
        dolly: 2.1,
        labels: ['Cone', 'Voice coil', 'Magnet'],
        narration:
          'All of it lands on a coil in the speaker, pushing a cone back and forth, rebuilding your voice out of raw electricity. It never got louder.',
      },
      {
        // Zone 7 — the callback button, closes the loop, wide again
        step: 6,
        dolly: 2.3,
        narration: 'Just a copy, built out of wall power.',
      },
    ],
  },
};
