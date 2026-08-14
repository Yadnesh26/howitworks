// Editorial layer for video export (scripts/export-video.mjs).
//
// SCRIPTING: written as ONE flowing voiceover, not standalone sentences.
// make-narration.mjs synthesizes the whole short in a single ElevenLabs take
// and the exporter paces the picture to the audio — each shot's line hands
// off into the next. 8-beat arc: pattern interrupt -> curiosity hook ->
// spoken question -> reveal -> step-by-step (BUT/THEREFORE) -> isolated
// stat -> so-what -> callback button.
//
// LOOP: planted in shot 2 ("it has no idea where it is") and closed with the
// same words in the button (shot 8).
//
// steps: 0 complete (hero) · 1 open (board reveal) · 2 click (microswitch) ·
//        3 scroll (encoder) · 4 sensor (LED macro) · 5 signal (frame diff) ·
//        6 run (finale)
export default {
  hook: 'There’s a camera in your mouse\nthat’s never touched your desk.',

  // 9:16 — ~65s. One take, 8 shots, on the video-scripting spine.
  short: {
    shots: [
      {
        // Zone 1 — hook: boldest true claim, word one; the whole mouse, wide
        step: 0,
        dolly: 1.6,
        narration:
          'There’s a camera inside your mouse, and it’s never once touched your desk.',
      },
      {
        // Zone 2 — stakes + the planted loop ("no idea where it is")
        step: 0,
        dolly: 1.6,
        narration:
          'It fires about fifteen hundred photos a second. But it has no idea where it is on your desk.',
      },
      {
        // Zone 3+4a — the spoken question, into the reveal (four jobs, one board)
        step: 1,
        dolly: 1.5,
        labels: ['Microswitch', 'Wheel encoder'],
        narration:
          'So how does a camera with no sense of location steer your cursor exactly where you want it? Open it up, and one board does four jobs: a switch under each button, a wheel encoder, and a sensor staring straight down.',
      },
      {
        // Zone 4b — BUT: the light doesn't look straight down
        step: 4,
        dolly: 1.7,
        labels: ['LED skims the desk'],
        narration:
          'But that sensor doesn’t look straight down at all. Its light skims the desk almost flat, so every speck and fibre throws a long shadow.',
      },
      {
        // Zone 4c — THEREFORE: texture becomes a pattern a lens can catch
        step: 4,
        dolly: 1.7,
        labels: ['Micro-shadows'],
        narration:
          'That turns a desk that looks perfectly smooth into a landscape of light and dark — and a lens drops that landscape onto a chip built to watch it change.',
      },
      {
        // Zone 5 — the stat, isolated, with a re-hook
        step: 5,
        dolly: 1.5,
        labels: ['Compares each frame'],
        narration:
          'Here’s the part that gets me. That chip never recognizes your desk. It just lines each photo up against the last one and measures how far the pattern slid — fifteen hundred times a second.',
      },
      {
        // Zone 6 — so-what: the click is the same kind of event, isolated
        step: 2,
        dolly: 1.7,
        labels: ['Snap-action microswitch'],
        narration:
          'That same board catches your click, too — a bent metal spring held just short of collapsing, waiting for one last flicker of travel to let go.',
      },
      {
        // Zone 7 — the callback button, closes the loop
        step: 6,
        dolly: 1.6,
        narration: 'It still never knows where it is. Only what just changed.',
      },
    ],
  },
};
