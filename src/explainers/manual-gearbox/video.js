// Editorial layer for video export
export default {
  hook: 'What actually happens inside a manual gearbox?',

  short: {
    shots: [
      {
        step: 0,
        seconds: 5,
        caption: 'Ever wonder what happens when you shift gears?',
        narration: 'Ever wonder what happens when you shift a manual transmission?',
        dolly: 1.2,
      },
      {
        step: 1,
        seconds: 6,
        caption: 'Inside, three shafts do all the work',
        narration: 'Inside the box, the engine constantly spins a lower cluster of gears on a layshaft.',
      },
      {
        step: 3,
        seconds: 6,
        caption: 'Gears are constantly meshed, but freewheeling',
        narration: 'Every forward gear is permanently meshed with a partner on the mainshaft, but they just freewheel.',
      },
      {
        step: 4,
        seconds: 7,
        caption: 'A brass synchro ring matches the speed',
        narration: 'To engage a gear, a brass synchro ring uses friction to drag the gear to the exact speed of the shaft.',
      },
      {
        step: 5,
        seconds: 6,
        caption: 'The sleeve locks it all together smoothly',
        narration: 'Once speeds match, a metal sleeve locks them together. Perfectly smooth, no grinding.',
      },
      {
        step: 7,
        seconds: 6,
        caption: 'Five mechanical trades, chosen by your hand',
        narration: 'First, second, third, fourth, fifth. Five mechanical trades, all chosen by your hand.',
        dolly: 1.2,
      },
    ],
  },

  long: {
    shots: [
      {
        step: 0,
        seconds: 9,
        narration: 'Your engine spins at thousands of RPM, but your wheels need a crawl to a cruise. A manual gearbox solves this with nothing but gears.',
      },
      {
        step: 1,
        seconds: 9,
        narration: 'Inside, it’s just three shafts. Power comes in, and drives the lower layshaft, which constantly spins all its meshing partners on the mainshaft above.',
      },
      {
        step: 2,
        seconds: 9,
        narration: 'In first gear, a small gear drives a big one. It trades engine speed for three times the torque, easily getting a heavy car moving from a standstill.',
      },
      {
        step: 3,
        seconds: 9,
        narration: 'Every forward gear is constantly meshed and constantly spinning. The secret? The big gears aren’t actually attached to the shaft yet. They just freewheel on needle rollers.',
      },
      {
        step: 4,
        seconds: 10,
        narration: 'To engage, a brass synchro ring acts like a tiny brake pad. It drags the spinning gear to the exact same speed as the shaft.',
      },
      {
        step: 5,
        seconds: 9,
        narration: 'Only when the speeds perfectly match can the sleeve slide over the dog teeth, locking the gear to the mainshaft. A tenth of a second, entirely by feel.',
      },
      {
        step: 6,
        seconds: 9,
        narration: 'Reverse uses a straight-cut idler gear to bridge the gap and flip the rotation backwards. Because it\'s straight-cut, it\'s the only gear in the box that whines.',
      },
      {
        step: 7,
        seconds: 9,
        narration: 'Case closed, clutch out. First, second, third, fourth, fifth. Five precise mechanical trades between fuel and road.',
      },
    ],
  },
};
