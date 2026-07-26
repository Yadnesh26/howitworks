// Editorial layer for video export — mixer-grinder
export default {
  hook: 'It spins at 20,000 RPM.\nWhat\'s stopping it from destroying itself?',

  short: {
    shots: [
      {
        step: 0,
        seconds: 5,
        caption: 'This motor runs faster than a Formula 1 engine',
        dolly: 2.0,
      },
      {
        step: 1,
        seconds: 5,
        caption: 'The jar couples directly to the motor shaft',
        dolly: 1.6,
      },
      {
        step: 2,
        seconds: 6,
        caption: 'A universal motor that runs on any current',
        dolly: 1.8,
      },
      {
        step: 3,
        seconds: 6,
        caption: 'Carbon brushes switch direction 600 times a second',
        dolly: 1.5,
      },
      {
        step: 4,
        seconds: 6,
        caption: 'The blade pulls food DOWN into the cutting zone',
        dolly: 1.6,
      },
      {
        step: 6,
        seconds: 6,
        caption: 'Zero gears. Zero belts. Pure motor, pure blade.',
        dolly: 2.0,
      },
    ],
  },

  long: {
    shots: [
      {
        step: 0,
        seconds: 9,
        narration:
          'This is a machine most people have in their kitchen, but almost nobody understands. It\'s not just a blender. Inside this plastic shell is a motor that spins faster than most aircraft turbines.',
      },
      {
        step: 1,
        seconds: 9,
        narration:
          'Lift the jar off and you see the coupler — the only point where the motor\'s energy enters the jar. It\'s deceptively simple: two interlocking lugs that engage the moment the jar is twisted on.',
      },
      {
        step: 2,
        seconds: 10,
        narration:
          'Inside the housing is a universal motor. The name says it all — it runs on alternating current or direct current. The armature spins inside field coils, and together they create the magnetic pull that drives the shaft.',
      },
      {
        step: 3,
        seconds: 10,
        narration:
          'This is the commutator — a spinning cylinder of copper segments. As it turns, two carbon brushes press against it and constantly switch which coil gets power. That switching is what keeps the torque going in one direction at twenty thousand RPM.',
      },
      {
        step: 4,
        seconds: 9,
        narration:
          'Inside the jar, the blade doesn\'t just chop. Its four angled tips create a vortex that pulls food downward from above, forcing it back into the cutting zone over and over. That\'s why you get smooth paste, not chunky slices.',
      },
      {
        step: 5,
        seconds: 8,
        narration:
          'The speed selector doesn\'t add more power — it taps different points on the field winding, changing the effective voltage the coil sees. Lower voltage, lower RPM. Higher voltage, full scream.',
      },
      {
        step: 6,
        seconds: 8,
        narration:
          'One motor. One blade. No gears, no belts, no transmission. The same machine that\'s been on kitchen counters since the 1950s, and it\'s still the fastest way to turn whole spices into fine powder.',
      },
    ],
  },
};
