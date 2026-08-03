// Editorial layer for video export (scripts/export-video.mjs).
//
// SCRIPTING: written as ONE flowing voiceover, not standalone sentences —
// make-narration.mjs synthesizes it as a single ElevenLabs take and the
// exporter paces the picture to the audio. 8-beat arc: pattern interrupt ->
// curiosity hook -> spoken question -> BUT/THEREFORE mechanism -> isolated
// stat -> so-what -> callback button. Loop: "backward" (against nature),
// planted in shots 1-2, closed in the button (shot 8).
//
// LENGTH: short ~75-80s. `dolly` pulls the camera back per shot so the
// (fairly wide, exposed-hardware) scene doesn't crop in portrait.
export default {
  hook: 'Water, flowing backward —\nagainst nature itself.',

  // 9:16 — ~75-80s. One take, 8 shots.
  short: {
    shots: [
      {
        // Zone 1 — hook: the boldest true claim, word one; full-model establish.
        // Labels cleared — a clean cinematic hook, not six text pills at once.
        step: 0,
        dolly: 1.4,
        labels: [],
        narration:
          'Right now, under sinks everywhere, water is flowing backward — the wrong way, against nature itself.',
      },
      {
        // Zone 2+3 — stakes (plant the loop) then the spoken question
        step: 0,
        dolly: 1.4,
        labels: [],
        narration:
          "Normally, water rushes toward salt. But this system reverses it — rejecting up to ninety-nine percent of everything dissolved in it that you can't even see. So how do you force water backward, through a wall you could never find the holes in?",
      },
      {
        // Zone 4a — reveal: the cleanup stage, named plainly
        step: 1,
        dolly: 1.5,
        labels: ['Sediment pre-filter — 5 micron', 'Carbon pre-filter — chlorine & VOCs'],
        narration:
          'First, two simple filters catch the sand and strip out the chlorine — just cleanup, before the real trick starts.',
      },
      {
        // Zone 4b — BUT: the pump, the number that matters
        step: 2,
        dolly: 2.0,
        // NOT 'Booster pump' here — that exact text also exists as a separate
        // callout in the overview set, and the export's label targeting
        // matches by text across the WHOLE scene (not scoped to a set), so
        // requesting it renders two overlapping copies (confirmed in the
        // fps10 smoke test). The gauge label is unique; framing carries the pump.
        labels: ['Pressure gauge — ~70 psi'],
        narration:
          "But tap pressure alone can't force water the wrong way. A booster pump slams it past seventy psi — hard enough to beat nature's own pull.",
      },
      {
        // Zone 4c — THEREFORE: the membrane, the split
        step: 3,
        dolly: 1.9,
        labels: ['RO membrane — spiral-wound', 'Permeate — pure water', 'Concentrate / reject'],
        narration:
          'Therefore, that pressurized water hits a membrane wound tight as a jelly roll — pores just one ten-thousandth of a micron wide. Water squeezes through. Salt, metal, everything else stays behind, and gets flushed straight down the drain.',
      },
      {
        // Zone 5 — the stat, isolated, a beat of space. Labels cleared —
        // nothing should compete with the number on screen.
        step: 3,
        dolly: 1.9,
        labels: [],
        narration: "Up to ninety-nine percent of everything ever dissolved in that water. Gone.",
      },
      {
        // Zone 6 — so-what: the everyday payoff. No `labels` override here —
        // 'Storage tank' text is duplicated in the overview set (same
        // cross-scene text-match hazard as 'Booster pump' above), so this
        // relies on the step's own onEnter (pin('tank')), which is scoped
        // correctly per-set and shows all three tank labels safely.
        step: 4,
        dolly: 2.3,
        narration:
          'What survives collects in a tank, waiting for the tap — cleaner, for pennies, than anything bottled.',
      },
      {
        // Zone 7 — callback button, closes the "backward" loop
        step: 5,
        dolly: 1.8,
        narration: 'Backward water. The cleanest way forward.',
      },
    ],
  },
};
