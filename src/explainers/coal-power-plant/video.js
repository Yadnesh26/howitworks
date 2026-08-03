// Editorial layer for video export (scripts/export-video.mjs).
// steps: 0 anatomy · 1 coal to heat · 2 boiler · 3 turbine · 4 generator
//        5 condenser · 6 step-up & grid · 7 the plant runs
export default {
  hook: 'Burning coal has never generated\na single volt of electricity.',

  // 9:16 — ~70-80s, single-take narration + word-synced caption rail.
  // 8-beat arc: hook (coal ≠ electricity) -> stakes/question -> mechanism
  // (crush -> boil -> expand -> induce) -> reveal closes the loop -> button.
  short: {
    shots: [
      {
        // 1. hook + 2. stakes
        step: 0,
        dolly: 2.2, // plant is a wide composition — pull way back in portrait
        narration:
          'Burning coal has never generated a single volt of electricity. Not directly — all that fire only makes heat.',
      },
      {
        // 3. question, plants the loop
        step: 0,
        dolly: 2.2,
        narration:
          'So how does a lump of black rock end up lighting your house? The trick is turning that heat into spin, and it starts with the coal itself.',
      },
      {
        // 4. mechanism — coal to heat
        step: 1,
        narration:
          'Crushed into a powder finer than flour, it burns almost the instant it’s blown into the furnace.',
      },
      {
        // mechanism — boiler + isolated stat
        step: 2,
        narration:
          'That fire wraps around a maze of water tubes. It drives the steam inside to five hundred forty degrees, at a hundred sixty times atmospheric pressure — hot and violent enough to punch through solid steel.',
      },
      {
        // mechanism — turbine, re-hook with "but"
        step: 3,
        narration:
          'But steam that hot doesn’t spin anything sitting still. It blasts through a turbine — and watch the blades grow with every stage. Losing pressure makes the steam expand, so each stage needs more room to catch it.',
      },
      {
        // mechanism — generator, the reveal
        step: 4,
        narration:
          'That spinning shaft sweeps magnets past rings of copper wire — and that sweep alone is what creates the electricity.',
      },
      {
        // 6. so-what + 7. button, closes the loop
        step: 7,
        dolly: 2.2,
        narration:
          'Every coal plant on Earth runs on that same trick. It was never about the coal — it’s about the spin.',
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
          'A coal plant is a heat engine. Burn coal to boil water, let the steam spin a turbine, and let the turbine spin a generator. Everything else you see here exists to make that one conversion — heat into spin — as efficient as possible.',
      },
      {
        step: 1,
        seconds: 9,
        narration:
          'It starts in the pulverizer, where coal is crushed as fine as flour. Blown into the furnace, it burns almost instantly — the only energy input the whole plant gets.',
      },
      {
        step: 2,
        seconds: 10,
        narration:
          'The furnace walls are lined with water tubes. Radiant heat boils the water inside them, and a superheater then drives that steam to around five hundred forty degrees Celsius — far past boiling, because hotter steam carries more usable energy per kilogram.',
      },
      {
        step: 3,
        seconds: 10,
        narration:
          'The steam blasts through three turbine stages on one shaft — high, intermediate, and low pressure. Watch the blades lengthen along the shaft: as pressure drops, the same steam takes up far more room, so the blades have to grow to catch it.',
      },
      {
        step: 4,
        seconds: 9,
        narration:
          'The same shaft runs straight into the generator, where magnetic poles sweep past fixed copper windings. Every sweep induces a voltage — Faraday’s law, the same trick a hydro plant uses, just driven by steam instead of falling water.',
      },
      {
        step: 5,
        seconds: 10,
        narration:
          'Spent steam is condensed back into water, shrinking about a thousand times in volume — and that collapse is what keeps pulling fresh steam through the turbine. The waste heat leaves through the cooling tower as a plume of plain water vapor. Not smoke.',
      },
      {
        step: 6,
        seconds: 9,
        narration:
          'Electricity leaves the generator at too low a voltage to travel far. A step-up transformer trades current for voltage, so the transmission lines can carry the same power with a fraction of the loss.',
      },
      {
        step: 7,
        seconds: 9,
        narration:
          'Coal, boiler, turbine, generator, condenser, tower, transformer. One continuous energy chain, chemical to electrical, with the same water reused endlessly in between. Every coal plant on Earth is this same cycle at a different scale.',
      },
    ],
  },
};
