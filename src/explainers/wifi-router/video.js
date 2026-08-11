// Editorial layer for video export (scripts/export-video.mjs).
//
// SCRIPTING: written as ONE flowing voiceover, not a stack of standalone
// sentences. make-narration.mjs synthesizes the whole thing in a single
// ElevenLabs take (with-timestamps) and the exporter paces the picture to the
// audio, so the per-shot `narration` strings below are only the cut points —
// each is written to hand off into the next.
//
// CAPTIONS are the verbatim voice rail (short-words.json), so every spoken word
// is also the on-screen word. There is no title card, so the hook lives in
// shot 1's first spoken sentence.
//
// PACKAGING: the lens is the queue, not the radio. "How Wi-Fi works" is not an
// idea; "everyone in your house is standing in one line" is. The physics beats
// exist to explain WHY the line has to exist, and the payoff is the thing the
// viewer already feels every day in a packed café.
//
// The loop: "one invisible wire" is planted in shot 2 and closed word-for-word
// in the button (shot 11), which also sets up the hook on replay.
//
// ACCURACY: the hook says one talker at a time and then immediately qualifies
// it as "one per channel" — a dual-band router really does run two of these
// queues at once, and the punchier unqualified version would be wrong.
//
// No em/en dashes in any narration line — ElevenLabs renders them as dead air
// the speed knob can't compress.
//
// LENGTH: short ~87s at ~2.3 words/sec (200 words). Portrait shots carry a
// per-shot `dolly` pull-back so the wide slab and the tall antennas both fit,
// and `labels` so only the callout being talked about is on screen.
export default {
  // Legacy-only (burns as a card only if words.json is missing). Kept in sync
  // with shot 1's opening line.
  hook: 'Only one device\ncan talk at a time.',

  // The short-format default end card points at a full-length YouTube version,
  // and there isn't one. A share prompt that lands on the video's own payoff
  // (it was never the router's fault) is the honest close.
  endCard: 'Share it with whoever\nblames the router.',

  // 9:16 — one take, 11 shots on the retention spine: hook → stakes+loop →
  // question → BUT/THEREFORE mechanism → isolated stat → so-what → button.
  short: {
    shots: [
      {
        // Zone 1 — hook: boldest true claim, word one, over the sealed product
        step: 0,
        dolly: 1.4,
        labels: [],
        narration:
          'Only one device in your house can talk over Wi-Fi at a time. Not one each, one per channel for the whole house.',
      },
      {
        // Zone 2 — stakes + the planted loop ("one invisible wire")
        step: 0,
        dolly: 1.4,
        labels: ['Three antennas'],
        narration:
          'Your phone, your TV, your laptop, they all take turns on one invisible wire. That queue is what you feel as slow Wi-Fi.',
      },
      {
        // Zone 3 — the mystery, said out loud, over the opened board
        step: 1,
        dolly: 1.55,
        labels: [],
        narration: "So what's inside the box that runs the queue?",
      },
      {
        // Zone 4a — the answer is absurdly small: a cut length of metal
        step: 3,
        dolly: 1.75,
        labels: ['6 cm of copper — half a wavelength'],
        narration:
          'Inside each stick is six centimetres of copper, cut to exactly half the length of the wave it makes.',
      },
      {
        // Zone 4b — what that copper actually does
        step: 3,
        dolly: 1.75,
        labels: ['Feed point'],
        narration:
          'Current sloshes up and down it 2.4 billion times a second, and the field it drags along peels off into the room.',
      },
      {
        // Zone 4c — BUT connective: the shape of the radiation is the twist
        step: 4,
        dolly: 1.5,
        labels: ['Nothing radiates off the tips'],
        narration:
          "But it doesn't spray everywhere. It throws a doughnut, flat all around the horizon, with a dead spot straight off each tip.",
      },
      {
        // Zone 4d — THEREFORE: everyone hears everyone, so there has to be a
        // queue. This is the beat the whole script is built to reach.
        step: 5,
        dolly: 1.8,
        labels: ['One talker at a time'],
        narration:
          'So every device inside that doughnut hears every other one. Each has to listen first, then wait a random moment so two never start together.',
      },
      {
        // Zone 5 — the stat, isolated on its own beat, with a re-hook. It also
        // earns its place on the spine: an ear this good is WHY it hears
        // everyone else and has to queue.
        step: 0,
        dolly: 1.4,
        labels: [],
        narration:
          "Here's the part that gets me. Your router shouts with a tenth of a watt, and hears replies a hundred billion times fainter.",
      },
      {
        // Zone 6a — the everyday payoff the hook promised
        step: 5,
        dolly: 1.8,
        labels: ['Waiting its turn'],
        narration:
          "So when the café Wi-Fi crawls, the signal is usually fine. You're just further back in the queue.",
      },
      {
        // Zone 6b — and why routers sprouted extra sticks
        step: 6,
        dolly: 1.7,
        labels: ['Three streams, one frequency'],
        narration:
          'Extra antennas are the fix. Three streams at once, so everyone gets their turn sooner.',
      },
      {
        // Zone 7 — button: closes the loop, 8 words, sets up the hook on replay
        step: 8,
        dolly: 1.6,
        labels: [],
        narration: 'The air is one wire. Wait your turn.',
      },
    ],
  },
};
