// Editorial layer for video export (scripts/export-video.mjs).
//
// SHORT-FORM ONLY for this run — long-form script/narration/render/thumbnails
// are deliberately out of scope (see the run's scope limit). Written as ONE
// flowing voiceover: make-narration.mjs synthesizes the whole thing in a
// single ElevenLabs take and the exporter paces the picture to the audio, so
// each shot's line hands off into the next rather than reading as a stack of
// standalone facts. 8-beat arc: pattern interrupt -> curiosity hook -> spoken
// question -> reveal -> step-by-step (BUT/THEREFORE) -> isolated stat ->
// real-world consequence -> callback ending.
//
// LOOP: planted in shot 2 ("a speck of dust could end it") and closed word-
// for-word in the button (shot 8).
export default {
  hook: 'The head in your hard drive\nnever touches the disk.',

  // 9:16 — ~70s. One take, 8 shots.
  short: {
    shots: [
      {
        // Zone 1 — hook: the boldest true claim, word one; full sealed product
        step: 0,
        dolly: 1.7,
        caption: 'The head never touches the disk.',
        narration:
          'The head inside your hard drive never touches the disk. It reads and writes a spinning platter without ever making contact — and in there, a single speck of dust is a boulder.',
      },
      {
        // Zone 2+3 — stakes + planted loop, then the spoken question
        step: 0,
        dolly: 1.7,
        caption: 'So how does it never touch down?',
        narration:
          'That platter is spinning at over seven thousand RPM. So how does anything hover above it, that fast, and never touch down?',
      },
      {
        // Zone 4a — reveal: parked state, name the ramp
        step: 1,
        dolly: 1.5,
        caption: 'Powered off, the head parks on a ramp',
        narration:
          'Powered off, it doesn’t even try. The arm swings the head onto a plastic ramp, lifted clear of the platter, waiting.',
      },
      {
        // Zone 4b — BUT: power on, it flies
        step: 2,
        dolly: 1.5,
        caption: 'Power on, and it flies instead',
        narration:
          'But power it on, and the arm swings that head out over the spinning surface — and it doesn’t lower onto the disk. It flies.',
      },
      {
        // Zone 4c — THEREFORE: the air-bearing mechanism, macro cutaway
        step: 3,
        dolly: 1.05,
        caption: 'It rides on air it drags into being',
        narration:
          'The underside of the head is carved with microscopic rails that scoop up the air the spinning platter drags with it — and that cushion alone holds the head up.',
      },
      {
        // Zone 5 — the isolated stat, re-hook
        step: 3,
        dolly: 1.05,
        caption: '~3 nanometres — 1/25,000th a hair',
        narration:
          'And that gap is about three nanometres. One twenty-five-thousandth the width of a human hair.',
      },
      {
        // Zone 6+7 — so-what: the danger, closing toward the loop
        step: 5,
        dolly: 1.05,
        caption: 'A speck of dust is a boulder in there',
        narration:
          'At that scale a speck of dust isn’t a speck — it’s a boulder. Let one in, or knock the drive mid-spin, and the head slams into the platter, gouging the very data it was reading.',
      },
      {
        // Zone 8 — callback button, closes the loop
        step: 6,
        dolly: 1.7,
        caption: 'That boulder is why it stays sealed.',
        narration:
          'That’s why every drive is sealed shut, and why dropping one while it spins can destroy it in a fraction of a second — because in there, even a speck of dust is a boulder.',
      },
    ],
  },

  platforms: {
    shorts: {
      title: 'Why your hard drive can NEVER touch its own disk',
      hashtags: ['#harddrive', '#hdd', '#whatdstuff', '#engineering', '#tech', '#dataStorage'],
    },
    // youtube/long-form fields intentionally omitted — long-form is out of
    // scope for this run (short-only), per the pipeline invocation's scope
    // limit. Not an oversight: fill in when a long-form pass is requested.
  },
};
