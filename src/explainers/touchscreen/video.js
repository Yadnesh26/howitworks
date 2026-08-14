export default {
  hook: 'A touchscreen has absolutely no moving parts.',

  short: {
    dolly: 1.6,
    shots: [
      { step: 0, seconds: 5, dolly: 1.6,
        narration: 'There is not a single switch moving inside your phone screen.' },
      { step: 1, seconds: 5,
        narration: 'It is just a solid sheet of glass over a sandwich of invisible films.' },
      { step: 2, seconds: 5, labels: ['Drive row', 'Sense column'],
        narration: 'Those films are etched into a microscopic grid of conductive rows and columns.' },
      { step: 3, seconds: 7, labels: ['Fringing field', 'Drive electrode', 'Sense electrode'],
        narration: 'Every crossing acts as a tiny capacitor, constantly pulsing a small electric arc through the glass.' },
      { step: 4, seconds: 8, labels: ['Field diverted to ground', 'Coupling 3.10 pF'],
        narration: 'Your body conducts electricity, so parking your bare finger on the glass intercepts those arcs and drains them away.' },
      { step: 5, seconds: 5, labels: ['Active drive row', 'All columns sampled at once'],
        narration: 'The controller scans the entire grid 120 times a second, looking for exactly that missing charge.' },
      { step: 6, seconds: 6, labels: ['Interpolated centre'],
        narration: 'By weighing the dips across several nodes, it resolves a coarse blur into a precise coordinate.' },
      { step: 7, seconds: 6,
        narration: 'But a dry glove holds your finger just far enough off the field that the screen hears nothing at all.' }
    ]
  }
};
