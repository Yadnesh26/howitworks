// steps: 0 anatomy · 1 suck · 2 squeeze · 3 bang · 4 blow · 5 run
export default {
  hook: 'A hurricane, set on fire —\naimed backwards.',

  short: {
    dolly: 2.2,
    shots: [
      { step: 0, seconds: 4, dolly: 2.4,
        narration: 'This engine is basically a hurricane set on fire and aimed backwards.' },
      { step: 0, seconds: 5,
        narration: 'A car engine resets after every single explosion. This one never stops.' },
      { step: 0, seconds: 4,
        narration: 'So how does a spinning metal tube turn into hundreds of tons of thrust?' },
      { step: 1, seconds: 6,
        narration: 'Every jet runs the same four-step cycle. Suck squeeze bang blow. It starts with the huge front fan sucking in a torrent of air.' },
      { step: 2, seconds: 6,
        narration: 'That air gets squeezed next. Row after row of spinning blades force it into a fraction of its size. It’s already scorching hot before a single drop of fuel arrives.' },
      { step: 3, seconds: 6,
        narration: 'Then it bangs. Fuel sprays into that compressed air and ignites continuously rather than one explosion at a time. That keeps the whole core spinning past ten thousand RPM.' },
      { step: 4, seconds: 6,
        narration: 'That exhaust doesn’t just blow out the back. On its way out it spins a turbine that drives the very fan sucking air in up front. The engine feeds itself.' },
      { step: 5, seconds: 4,
        narration: 'One continuous roar. Suck squeeze bang blow.' },
    ],
  },

  long: {
    shots: [
      { step: 0, seconds: 9,
        narration: 'This engine is basically a hurricane set on fire and aimed backwards. It runs on the same four steps as the engine in your car. The difference is it does all four at once, continuously, instead of one at a time.' },
      { step: 1, seconds: 9,
        narration: 'Suck. The huge fan at the front pulls in an enormous torrent of air, more than any piston could ever gulp down. Most of it gets shoved straight back for thrust. The rest heads into the core for the real work.' },
      { step: 2, seconds: 10,
        narration: 'Squeeze. That core air is forced through stage after stage of spinning blades. Each stage packs it into a tighter space until it’s crushed to a fraction of its original size. By now it’s already scorching hot, and not a drop of fuel has touched it yet.' },
      { step: 3, seconds: 9,
        narration: 'Bang. Fuel sprays into that dense superheated air and ignites. It doesn’t explode in pulses like a piston engine. It burns as one continuous controlled blowtorch that spins the whole core past ten thousand RPM.' },
      { step: 4, seconds: 10,
        narration: 'Blow. The story isn’t over yet. On its way out, that racing exhaust spins a turbine, and that turbine drives the very fan and compressor up front. The engine feeds itself. Whatever’s left roars out the nozzle and shoves the plane forward.' },
      { step: 5, seconds: 9,
        narration: 'Suck squeeze bang blow, all four happening at once, thousands of times a minute. A continuous river of fire that can carry hundreds of tons into the sky.' },
    ],
  },
};
