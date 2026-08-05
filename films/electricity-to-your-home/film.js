// THE 0.02 SECONDS — how electricity reaches your home.
//
// The reference film for the long-form format. Seven acts, ~8.5 minutes, drawn
// from three existing explainers. Read films/README.md for the manifest shape
// and .claude/skills/film-scripting/SKILL.md for why it is built this way.
//
// SPINE: "A lake becomes a light in a kitchen 400 km away, in two hundredths of
// a second. How?" — told FORWARD, source to socket.
//
// The structural risk of a chronological telling is that act 1 is just "here is
// a dam", which is not a hook. So act 1 stands at the source and names the
// DESTINATION and the clock: the 0.02 seconds is promised in the first thirty
// seconds and not fully answered until act 7. Act 3 pays part of it (the field
// travels, not the electrons); act 7 pays the rest (nothing is stored, so the
// whole grid moves when you do).
//
// CAMERA NOTE: every move here is deliberately small (push 0.88-0.92 to move
// in, 1.10-1.15 to pull back). The first cut used 0.72 and 1.35 and both shots
// were unusable — see the range clamp in scripts/render-film.mjs.
export default {
  id: 'electricity-to-your-home',
  title: 'THE 0.02 SECONDS',
  subtitle: 'How electricity reaches your home',
  endCard: 'The grid is the largest machine ever built.\nwhatDstuff',

  // Music bed: `node scripts/make-music.mjs electricity-to-your-home`.
  // A PAD, not a track — no drums, no melody, nothing that resolves. The mixer
  // loops it and ducks it under the voice, so 2 minutes covers 8.
  music: 'grid-bed',
  musicGain: 0.16,
  musicSeconds: 120,
  musicPrompt:
    'slow ambient documentary underscore, sparse sustained synth pads, low pulse, no drums, no melody, neutral and unresolved',

  // In-scene part labels OFF by default — on a tight shot they crop against the
  // frame edge and read as leftover app UI. Individual WIDE shots turn them
  // back on with `callouts: true`, where they genuinely annotate the journey.
  callouts: false,

  // Every cue generated once by `node scripts/make-sfx.mjs electricity-to-your-home`.
  // Keep prompts concrete and dry — reverb baked into a cue cannot be removed,
  // and a dry cue sits under narration far better than a wet one.
  sfxLibrary: {
    'switch-click': { prompt: 'a single crisp domestic light switch clicking on, close microphone, dry, no reverb', seconds: 1.5, influence: 0.7 },
    'transformer-hum': { prompt: 'a deep steady electrical transformer hum at 100 hertz, continuous, industrial, no music', seconds: 12, influence: 0.6 },
    'water-rush': { prompt: 'heavy water rushing through a large steel pipe under pressure, deep and continuous', seconds: 8, influence: 0.5 },
    'turbine-spin': { prompt: 'a massive metal turbine spinning up to speed, rising mechanical whine, industrial', seconds: 6, influence: 0.6 },
    'breaker-slam': { prompt: 'a huge high voltage circuit breaker slamming closed, single heavy metallic clunk, dry', seconds: 2, influence: 0.75 },
    'line-wind': { prompt: 'wind moving across high voltage transmission lines in open country, faint electrical crackle', seconds: 10, influence: 0.45 },
    'sub-bass-hit': { prompt: 'a deep cinematic sub bass impact, single hit, clean, no reverb tail', seconds: 2, influence: 0.6 },
  },

  acts: [
    // ---------------------------------------------------------------- act 1
    // Stand at the source, name the destination, start the clock.
    {
      id: 'the-lake',
      title: 'The Lake',
      voiceSettings: { stability: 0.4, style: 0.22 },
      shots: [
        {
          explainer: 'hydro-power-plant',
          step: 0,
          seconds: 12,
          dolly: 1.08,
          orbit: -16,
          callouts: true, // establishing the plant's anatomy
          narration:
            'Somewhere in a valley there is a lake, and a wall built to stop it. Nothing here is electricity yet. There is no charge stored in that water, no reserve of power sitting behind the concrete waiting to be released.',
        },
        {
          explainer: 'hydro-power-plant',
          step: 1,
          seconds: 12,
          // The reservoir step's own camera is already tight on the head
          // measurement; pushing in further filled the frame with flat blue.
          // Pull back instead so the wall holding it is in shot.
          dolly: 1.15,
          push: 1.08,
          narration:
            'There is only height. Every tonne of water up here is energy that has not been spent, held in place by gravity and a wall. And in about two hundredths of a second, some of it is going to be a light switching on in a kitchen four hundred kilometres away.',
        },
        {
          explainer: 'hydro-power-plant',
          step: 0,
          seconds: 11,
          push: 1.1,
          callouts: true,
          sfx: [{ file: 'sub-bass-hit', at: 0.3 }],
          narration:
            'Two hundredths of a second. That is the part that should bother you, because almost nothing in the chain between here and that kitchen stores anything at all. So let us follow it, all the way down.',
        },
      ],
    },

    // ---------------------------------------------------------------- act 2
    {
      id: 'into-motion',
      title: 'Into Motion',
      shots: [
        {
          explainer: 'hydro-power-plant',
          step: 2,
          seconds: 11,
          push: 0.88,
          sfx: [{ file: 'water-rush', at: 0.5 }],
          narration:
            'Open the gate, and the wall stops being a wall. Water drops into the penstock, a steel pipe running straight down the hillside, and gravity spends all of that stored height in a matter of seconds.',
        },
        {
          explainer: 'hydro-power-plant',
          step: 2,
          seconds: 10,
          dolly: 0.95,
          orbit: 14,
          narration:
            'By the bottom it is not drifting any more. Water that was sitting perfectly still on a flat lake arrives moving fast enough to bend steel, and every bit of that speed is aimed at one place.',
        },
        {
          explainer: 'hydro-power-plant',
          step: 3,
          seconds: 12,
          push: 0.88,
          sfx: [{ file: 'turbine-spin', at: 0.4 }],
          narration:
            'The turbine. Curved blades catch the jet, take its push, and turn it into rotation. And that is the entire job of a power plant. It is the same job whether you dammed a river, burned coal, or split an atom. Everything past this point is identical.',
        },
      ],
    },

    // ---------------------------------------------------------------- act 3
    // The belief-correction act — the highest-retention beat in the film, and
    // the first partial answer to the clock started in act 1.
    {
      id: 'motion-into-current',
      title: 'Motion Into Current',
      voiceSettings: { stability: 0.42, style: 0.15 },
      shots: [
        {
          explainer: 'hydro-power-plant',
          step: 4,
          seconds: 12,
          push: 0.89,
          narration:
            'The shaft carries that rotation into the generator, and here is where most people quietly hold a wrong picture. It is easy to imagine electricity being manufactured here, and then shipped down the wire to you, like water through a pipe.',
        },
        {
          explainer: 'transformer',
          step: 4,
          seconds: 12,
          dolly: 0.95,
          orbit: 20,
          narration:
            'It is not. The electrons in the wire to your house barely move at all. They jitter back and forth, fifty times a second, and go essentially nowhere. On a good day, one of them drifts a few metres in an hour.',
        },
        {
          explainer: 'transformer',
          step: 1,
          seconds: 13,
          push: 0.88,
          narration:
            'What travels is the push. Spinning a magnet past a coil sets up a wave in the electric and magnetic field around the wire, and that wave moves at close to the speed of light. The copper does not really carry the energy. It steers it.',
        },
        {
          explainer: 'hydro-power-plant',
          step: 4,
          seconds: 11,
          dolly: 1.05,
          orbit: -12,
          narration:
            'Which is your first answer. The reason the light comes on almost the instant you ask for it is that nothing physically has to make the journey. The push does, and the push is a field.',
        },
      ],
    },

    // ---------------------------------------------------------------- act 4
    // The central trick. The act people come away quoting.
    {
      id: 'the-volt-trick',
      title: 'The Volt Trick',
      voiceSettings: { stability: 0.45, style: 0.2 },
      shots: [
        {
          explainer: 'power-transmission',
          step: 1,
          seconds: 12,
          push: 0.89,
          callouts: true, // the two-wire loss comparison is a labelled diagram
          narration:
            'But there is a problem waiting just outside the plant. That kitchen is four hundred kilometres away, and a wire that long fights back. Every metre of it has resistance, and resistance quietly turns the power you are trying to deliver into heat nobody asked for.',
        },
        {
          explainer: 'power-transmission',
          step: 1,
          seconds: 13,
          dolly: 0.9,
          orbit: 16,
          callouts: true,
          narration:
            'And it is not a gentle loss. It does not scale with the current, it scales with the current squared. Double the current, and you waste four times as much. Ten times the current, and you waste a hundred times as much.',
        },
        {
          explainer: 'transformer',
          step: 3,
          seconds: 13,
          push: 0.88,
          sfx: [{ file: 'transformer-hum', at: 0.6 }],
          narration:
            'So the grid cheats, and it cheats using the most important device almost nobody thinks about. Power is voltage times current. Which means if you multiply the voltage by a thousand, you can divide the current by a thousand, and deliver exactly the same power.',
        },
        {
          explainer: 'transformer',
          step: 2,
          seconds: 12,
          push: 0.9,
          narration:
            'A transformer does that with no moving parts at all. Two coils wound on one iron core. Changing current in the first makes a changing magnetic field in the core, that changing field induces a voltage in the second, and the ratio of turns between them sets the trade.',
        },
        {
          explainer: 'power-transmission',
          step: 1,
          seconds: 12,
          orbit: -14,
          callouts: true,
          narration:
            'And because the loss went as the square, cutting the current by a thousand cuts the wasted heat by a million. That single move is the reason a national grid is possible at all. Without it, every power plant would have to sit inside the city it served.',
        },
      ],
    },

    // ---------------------------------------------------------------- act 5
    {
      id: 'the-long-haul',
      title: 'The Long Haul',
      shots: [
        {
          explainer: 'power-transmission',
          step: 2,
          seconds: 12,
          dolly: 1.15,
          push: 0.9,
          sfx: [{ file: 'line-wind', at: 0.4 }],
          narration:
            'So it leaves the plant at four hundred thousand volts. That is a violent number. It is enough to start breaking down the air around the conductor itself, which is why big lines hiss and crackle in the rain.',
        },
        {
          explainer: 'power-transmission',
          step: 2,
          seconds: 12,
          dolly: 0.95,
          push: 0.9,
          narration:
            'Which changes what the towers are actually for. They are not really holding the wire up. They are holding it away. Those long strings of glass discs are insulators, buying enough distance that four hundred thousand volts cannot find a path down the steel into the ground.',
        },
        {
          explainer: 'power-transmission',
          step: 2,
          seconds: 11,
          dolly: 1.2,
          orbit: 22,
          callouts: true, // wide on the catenary span
          narration:
            'And the wire is never pulled tight. It hangs in a deliberate curve, because on a hot afternoon that aluminium expands and sags lower, and that slack is the only thing stopping it snapping on a freezing night.',
        },
      ],
    },

    // ---------------------------------------------------------------- act 6
    {
      id: 'the-ladder-down',
      title: 'The Ladder Down',
      shots: [
        {
          explainer: 'power-transmission',
          step: 3,
          seconds: 12,
          push: 0.89,
          sfx: [{ file: 'breaker-slam', at: 0.9 }],
          narration:
            'Then it has to come back down, and it comes down in stages, because nothing takes four hundred thousand volts to the two hundred and forty in your wall in one jump. The first stop is a substation.',
        },
        {
          explainer: 'power-transmission',
          step: 3,
          seconds: 12,
          dolly: 0.95,
          orbit: 18,
          callouts: true,
          narration:
            'Four hundred thousand becomes a hundred and thirty two thousand. A substation is mostly transformers and switchgear, and the switchgear is there so that a fault twenty kilometres away can be cut loose before it becomes a fault here.',
        },
        {
          explainer: 'power-transmission',
          step: 4,
          seconds: 11,
          push: 0.9,
          narration:
            'A hundred and thirty two thousand becomes eleven thousand, and that is what runs along your street, carried on the poles you have walked underneath your whole life without once looking up.',
        },
        {
          explainer: 'power-transmission',
          step: 5,
          seconds: 12,
          push: 0.89,
          sfx: [{ file: 'transformer-hum', at: 0.3 }],
          narration:
            'And the last step happens in that grey drum on the pole outside. Eleven thousand volts in, two hundred and forty out. That hum you hear standing under it on a quiet night is the iron core physically flexing, a hundred times every second.',
        },
      ],
    },

    // ---------------------------------------------------------------- act 7
    // Payoff. Close the clock started in act 1, land the human line, get out.
    {
      id: 'your-switch',
      title: 'Your Switch',
      voiceSettings: { stability: 0.4, style: 0.28 },
      shots: [
        {
          explainer: 'power-transmission',
          step: 5,
          seconds: 12,
          push: 0.9,
          sfx: [{ file: 'switch-click', at: 0.5 }],
          narration:
            'Which brings us to your hand on the switch, and to the number from the beginning. Because there is almost no storage anywhere in that entire chain, the grid cannot build up a reserve and hand it out later.',
        },
        {
          explainer: 'power-transmission',
          step: 6,
          seconds: 13,
          dolly: 1.1,
          push: 1.1,
          callouts: true,
          narration:
            'Everything being consumed right now is being generated right now. Your kettle, every kettle, every hospital and factory and streetlight, matched by turbines physically turning at this exact moment. And there is a scoreboard for whether it is keeping up.',
        },
        {
          explainer: 'power-transmission',
          step: 6,
          seconds: 13,
          dolly: 1.05,
          orbit: -20,
          callouts: true,
          sfx: [{ file: 'sub-bass-hit', at: 0.4 }],
          narration:
            'The frequency. Fifty hertz. When demand runs ahead of supply, every generator on the network is dragged fractionally slower, and that number dips. When supply runs ahead, it climbs. Control rooms watch it every second, and open a valve a little further to hold it steady.',
        },
        {
          explainer: 'power-transmission',
          step: 0,
          seconds: 13,
          dolly: 1.08,
          push: 1.12,
          callouts: true, // close on the whole journey, labelled
          sfx: [{ file: 'switch-click', at: 0.7 }],
          narration:
            'So it never was waiting in the wall for you. Every time you flip that switch, a lake four hundred kilometres away falls a fraction faster, and the largest machine ever built quietly rebalances itself around you. Two hundredths of a second. Every single time.',
        },
      ],
    },
  ],
};
