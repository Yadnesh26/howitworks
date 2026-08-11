// Editorial layer for video export (scripts/export-video.mjs).
//
// SCRIPTING: one flowing voiceover, not a stack of standalone sentences.
// make-narration.mjs synthesizes it in a single ElevenLabs take and the
// exporter paces the picture to the audio, so each shot's line is only a cut
// point and hands off into the next. Captions are the verbatim voice rail,
// so the hook lives in shot 1's first spoken sentence, which it does.
//
// The loop: planted in shot 2 ("a shadow, not a photograph" / the 99% tease)
// and closed word-for-word in the button ("That's the shadow. Not a
// photograph."), which also re-arms the hook when the short replays. The
// 99%-never-leaves tease in shot 2 pays off with the actual number in shot 6
// (the isolated stat), a second small loop nested inside the main one.
//
// No em/en dashes anywhere — ElevenLabs renders them as dead air the speed
// knob can't compress. Numbers spelled the way they're spoken ("two thousand
// degrees", "ninety nine percent").
//
// DOLLY: the scene is a long beam line (tube head -> collimator -> wedge ->
// detector) — wider than it is tall, so the two hero shots (step 0) carry a
// heavy pull-back or portrait crops the ends off. Macro shots (cathode,
// anode) need much less; the shadow shot lands in between.
export default {
  hook: 'There’s no camera\nin this machine.',

  // No long-form script exists yet for this explainer, so the default end
  // card ("Full length version on YouTube") would be a false promise —
  // override it with the generic CTA other short-only exports use (see
  // wifi-router/video.js, the same situation).
  endCard: 'Share it.\nFollow for more.',

  platforms: {
    shorts: {
      title: 'There’s no camera in this machine',
      hashtags: ['#xray', '#physics', '#science', '#howitworks', '#engineering'],
    },
  },

  // 9:16 — ~80s at ~2.3 words/sec (~184 words). Spine: hook (no camera) ->
  // stakes + planted loop (shadow not a photograph / 99% never leaves) ->
  // spoken question -> reveal (sealed tube) -> mechanism beat (filament) ->
  // BUT/THEREFORE (anode eats the energy, spins to survive) -> isolated stat
  // (the actual 1%/99% split) -> so-what + button (closes the loop).
  short: {
    shots: [
      {
        // Zone 1 — hook: the boldest true claim, word one
        step: 0,
        dolly: 2.2,
        narration: 'There’s no camera in this machine. Not one lens, anywhere.',
      },
      {
        // Zone 2+3 — stakes, planted loop (shadow/photograph + the 99% tease), question
        step: 0,
        dolly: 2.2,
        narration:
          'Every picture it makes is a shadow, not a photograph, and ninety nine percent of what this machine produces never even leaves it. So how do you throw something through solid metal hard enough to cast a shadow?',
      },
      {
        // Zone 4a — reveal: the sealed insert
        step: 1,
        dolly: 1.5,
        narration:
          'It starts with a sealed glass tube, floating in a bath of oil, with a vacuum inside so nothing gets in the way.',
      },
      {
        // Zone 4b — mechanism beat: the filament
        step: 2,
        dolly: 1.4,
        narration:
          'A coil of tungsten wire sits at one end, heated to two thousand degrees, until electrons boil straight off it into that vacuum.',
      },
      {
        // Zone 4c — BUT/THEREFORE: the anode eats almost all of it, spins to survive
        step: 4,
        dolly: 1.5,
        narration:
          'But when they slam into the target on the other side, almost none of that energy becomes an X-ray. It becomes heat, so the target is a spinning disc, turning three thousand times a minute just to survive the hit.',
      },
      {
        // Zone 5 — the stat, isolated, pays off the 99% tease from zone 2
        step: 4,
        dolly: 1.6,
        narration:
          'Here’s the number that gets me. Only one percent of all that energy ever leaves as an X-ray. The other ninety nine percent is just heat.',
      },
      {
        // Zone 6+7 — so-what, then the button: closes the loop, re-arms the hook on replay.
        // Cleared to no labels on purpose: the step's default 'shadow' set is 4
        // pills, and in this portrait crop the vertical declutter pass pushed "The
        // shadow" pill down onto its own anchor dot. Targeting just that text
        // doesn't fix it either — 'The shadow' (and 'Aluminium step wedge' and
        // 'Flat-panel detector') each exist in TWO callout sets in model.js, and
        // export-video's labels-by-text match is global across the whole scene, so
        // it lit up both copies at once. Cleanest fix for the export: no labels on
        // the button beat, letting the shadow image itself carry the payoff.
        step: 6,
        dolly: 1.9,
        labels: [],
        narration:
          'What survives crosses the room, and whatever it hits stops a different amount of it, bone, tissue, metal. That’s the shadow. Not a photograph.',
      },
    ],
  },
};
