// Editorial layer for video export (scripts/export-video.mjs).
// steps: 0 sealed module · 1 sun/photon journey · 2 exploded layer stack
//        3 one cell (junction) · 4 series wiring · 5 junction box/output
//        6 re-solidified finale, bulb payoff
export default {
  hook: 'The light hitting this panel\nis older than the pyramids.',

  // 9:16 — single-take narration + word-synced caption rail.
  // 7-beat arc: hook (ancient photon) -> stakes/question (crosses space,
  // hits glass) -> mechanism (layers -> junction -> series wiring) ->
  // isolated stat (36V) -> so-what + button, closes the "ancient light" loop.
  short: {
    shots: [
      {
        // 1. hook
        step: 1,
        dolly: 1.85, // wide two-subject (sun + panel) composition
        narration:
          'The light hitting this panel is older than the pyramids. It spent a hundred thousand years trapped inside the sun before it escaped.',
      },
      {
        // 2. stakes + question, plants the loop
        step: 1,
        dolly: 1.85,
        narration:
          'Once it breaks free, it crosses ninety three million miles in eight minutes flat, and slams into a sheet of near black glass. So how does silent glass turn that into electricity?',
      },
      {
        // 3. mechanism — layer stack
        step: 2,
        narration:
          "Crack it open and it's basically a sandwich: glass on top, sixty wafer thin silicon cells, sealed in plastic. But the real trick hides inside each cell.",
      },
      {
        // 4. mechanism — the junction, the core reveal
        step: 3,
        narration:
          'Every cell is two layers of silicon glued together. One has electrons to spare, one is missing them. That mismatch bakes an electric field into the material. So the instant a photon knocks one loose, the field shoves it straight to the surface.',
      },
      {
        // 5. mechanism — series wiring, leads into the stat
        step: 4,
        dolly: 2.0, // wide grid shot with a right-side label — needs room in portrait
        narration:
          'One cell alone barely makes half a volt. So silver ribbons wire all sixty in series, stacking those tiny voltages together.',
      },
      {
        // 6. isolated stat
        step: 5,
        narration:
          "By the time current reaches the edge of the panel, it's carrying about thirty six volts. Thirty six volts, made from nothing but light hitting silicon.",
      },
      {
        // 7. so-what + button, closes the "ancient light" loop
        step: 6,
        dolly: 1.5,
        narration:
          'That’s real current, enough to power an actual device off pure sunlight. It runs without fuel and without a single moving part. Ancient sunlight, now lighting a bulb.',
      },
    ],
  },

  // 16:9, full story, narrated
  long: {
    shots: [
      {
        step: 0,
        seconds: 10,
        narration:
          'A solar module is silicon doing one specific trick: turning photons into a flow of electrons, with nothing that moves and nothing that burns. Sixty individual cells, laminated glass to backsheet, framed in aluminum, racked at whatever angle puts them square to the sun.',
      },
      {
        step: 1,
        seconds: 10,
        narration:
          "That sunlight starts as fusion, hydrogen crushed into helium at around fifteen million degrees in the sun's core. The energy from that reaction takes roughly a hundred thousand years just to random walk its way out through the sun's own bulk. Once it escapes as light, it crosses ninety three million miles of space in about eight minutes. Only photons energetic enough to clear silicon's band gap can do anything once they land.",
      },
      {
        step: 2,
        seconds: 10,
        narration:
          "Crack the laminate open and it's five layers: tempered glass on top, a black polymer backsheet on the bottom, and the cells sandwiched between two sheets of EVA plastic, heat fused into one waterproof sheet a little over four millimeters thick, inside a much deeper aluminum frame.",
      },
      {
        step: 3,
        seconds: 10,
        narration:
          'Each cell is a thick base of p type silicon with a wafer thin n type layer diffused onto its face, one side running short on electrons and the other carrying a surplus. That mismatch creates a built in electric field right at the junction between them. When a photon frees an electron there, that field sweeps it toward the front contact and pushes the hole it left behind the other way. That separation, not the photon itself, is the electricity.',
      },
      {
        step: 4,
        seconds: 10,
        narration:
          "One cell alone only makes about half a volt, so the module wires all sixty in series, silver ribbons soldering the front contact of each cell to the back of the next. Stack sixty half volts end to end and the string reaches around thirty six volts of direct current by the edge of the panel.",
      },
      {
        step: 5,
        seconds: 10,
        narration:
          "That string actually splits into three groups of twenty cells, each one guarded by its own bypass diode in a small junction box on the back. Shade or damage one section and current routes around it through the diode instead of stalling the whole module. Two leads carry the finished DC current out to whatever it's wired to.",
      },
      {
        step: 6,
        seconds: 9,
        narration:
          'Wire that output straight into a bulb and it lights, powered by nothing but a slab of silicon and eight minute old starlight.',
      },
    ],
  },
};
