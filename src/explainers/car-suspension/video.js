// Editorial layer for video export.
//
// Story lens: the spring is the obvious answer and it is the WRONG one. The
// short opens by taking the spring away as the hero, plants "a few small
// holes" in the mechanism beat, and closes the loop on those exact words.
// Three consecutive shots sit on the damper section with a tightening dolly
// (1.8 → 1.55) so the payoff reads as three cuts pushing in, not one held shot.
// The dolly floor is set by the 9:16 crop: these step cameras compose the
// subject right-of-centre for the site's text panel, which portrait cuts off.
export default {
  hook: "Your car's springs don't smooth out the road.",

  short: {
    shots: [
      {
        step: 0,
        seconds: 7,
        labels: ['Coil spring'],
        narration:
          "Your car's springs don't smooth out the road. On their own, they'd make it worse.",
        dolly: 1.6,
      },
      {
        step: 2,
        seconds: 8,
        labels: ['Coil spring · 30 N/mm'],
        narration:
          "A spring's real job is turning one sharp jolt into a slow squeeze, spread across eighty millimetres of travel.",
        dolly: 1.25,
      },
      {
        step: 3,
        seconds: 10,
        narration:
          'But a spring gives back every joule you put into it. So on springs alone, one pothole has you bouncing down the street.',
        dolly: 1.95,
      },
      {
        step: 4,
        seconds: 8,
        labels: ['Piston + valves'],
        narration:
          'So what eats the bounce? Oil. A piston sealed in a tube of it, with a few small holes.',
        dolly: 1.8,
      },
      {
        step: 4,
        seconds: 8,
        narration:
          "Here's the part that gets me. Oil hates being rushed. Ease over a dip and the piston barely resists.",
        dolly: 1.65,
      },
      {
        step: 4,
        seconds: 9,
        narration:
          'Hit a sharp ridge, and those same little holes shove back with fifteen hundred newtons. Your bounce leaves as warm oil.',
        dolly: 1.55,
      },
      {
        step: 5,
        seconds: 12,
        labels: ['Anti-roll bar · 22 mm'],
        narration:
          'That handles bumps. But a corner throws the car sideways, so there is a second spring waiting for that. A bar that only wakes up when the two sides disagree.',
        dolly: 1.5,
      },
      {
        step: 6,
        seconds: 8,
        narration:
          'Every ridge you never felt got turned into a little heat in a tube by your wheel. Just oil, and a few small holes.',
        dolly: 1.55,
      },
    ],
  },
};
