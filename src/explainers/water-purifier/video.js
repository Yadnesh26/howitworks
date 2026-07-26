// Editorial layer for video export
export default {
  hook: 'How does dirty tap water become pure?\nThe secret is high pressure.',

  short: {
    shots: [
      {
        step: 0,
        seconds: 5,
        caption: 'How does an RO water purifier actually work?',
        narration: 'How does a reverse osmosis system strip everything out of your tap water? It’s a four-stage gauntlet.',
        dolly: 1.5,
      },
      {
        step: 1,
        seconds: 5,
        caption: 'First, pre-filters trap dirt and absorb chlorine',
        narration: 'First, pre-filters trap the physical dirt and absorb the chlorine that would destroy the delicate parts later.',
      },
      {
        step: 2,
        seconds: 5,
        caption: 'A booster pump cranks the pressure to 80 PSI',
        narration: 'Then, this booster pump takes that clear water and cranks the pressure up to eighty PSI.',
      },
      {
        step: 3,
        seconds: 6,
        caption: 'This pressure forces water through a microscopic membrane',
        narration: 'That immense pressure forces the water into the heart of the system: a microscopic spiral-wound membrane.',
      },
      {
        step: 4,
        seconds: 6,
        caption: 'Pure water makes it through, waste is flushed away',
        narration: 'The pores are so small only pure water molecules squeeze through. Everything else is flushed away as waste.',
      },
      {
        step: 5,
        seconds: 5,
        caption: 'For every gallon you drink, three go down the drain',
        narration: 'And it wastes a lot. For every gallon of pure water you drink, three gallons go down the drain to keep the membrane clean.',
        dolly: 1.5,
      },
    ],
  },

  long: {
    shots: [
      {
        step: 0,
        seconds: 10,
        narration:
          'Tap water isn’t as clean as it looks. But under millions of kitchen sinks, a reverse osmosis system takes that questionable water and strips it down to pure H2O molecules. Let’s follow the flow.',
      },
      {
        step: 1,
        seconds: 9,
        narration:
          'Before water reaches the sensitive membrane, it has to be pre-cleaned. The sediment filter traps physical dirt and sand, while the carbon block absorbs chlorine. Notice how the brown water turns clear.',
      },
      {
        step: 2,
        seconds: 9,
        narration:
          'In natural osmosis, water flows toward the dirty side to balance it out. To reverse that, we need immense pressure. This booster pump pressurizes the clear water to over eighty PSI.',
      },
      {
        step: 3,
        seconds: 10,
        narration:
          'This is the heart of the system. High-pressure water enters a spiral-wound semi-permeable membrane. The pores are just large enough for a water molecule, but too small for heavy metals, bacteria, and viruses.',
      },
      {
        step: 4,
        seconds: 10,
        narration:
          'Because the membrane blocks contaminants, the water left on the outside gets increasingly dirty. If it stayed there, it would instantly clog the pores. So the flow splits: pure water goes to your tank, and dirty water goes down the drain.',
      },
      {
        step: 5,
        seconds: 9,
        narration:
          'It takes about three gallons of wasted water to produce one gallon of pure water. It’s a harsh ratio, but it’s the only way to continuously produce water as pure as a mountain spring.',
      },
    ],
  },
};
