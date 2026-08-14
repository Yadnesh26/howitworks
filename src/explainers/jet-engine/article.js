// Article content for the prerendered page — see docs/seo-plan.md §C1 and
// .claude/skills/write-article/SKILL.md. Every number below is sourced from
// public jet-engine performance data (compressor/turbine research, N1/N2
// spool ranges, FAA bird-ingestion certification standards, A320 relight
// envelope), not from this explainer's own step copy — jet-engine's steps
// carry zero digit-bearing numbers, so this is genuinely new research, not
// a transcription of index.js.
export default {
  directAnswer: {
    question: 'How does a jet engine actually work?',
    answer:
      'A jet engine sucks in air, squeezes it up to seventy times atmospheric pressure, burns fuel in it continuously, and blasts the expanding gas out the back — with some of that exhaust spinning a turbine that powers the whole cycle. It never pauses for a single explosion; all four steps run at once, non-stop.',
  },

  parts: [
    {
      name: 'Fan',
      body: 'The huge forward blade assembly you see just past the intake. In a modern turbofan it moves far more air than the engine’s core ever touches — that bypass air is where most of the thrust actually comes from.',
    },
    {
      name: 'Compressor',
      body: 'Row after row of spinning blades, each stage packing the incoming air into a smaller space than the last. By the final stage it has been squeezed to a fraction of its original volume, and it is already hot before a drop of fuel arrives.',
    },
    {
      name: 'Combustor',
      body: 'The chamber (or ring of cans in older designs) where fuel sprays into the compressed air and burns — continuously, not in pulses like a car engine’s cylinders.',
    },
    {
      name: 'Turbine',
      body: 'Sits right behind the combustor and gets hit by gas hot enough to melt it outright; it survives only because cooling air is bled through tiny passages inside each blade. It drives the compressor and fan through a shared shaft — the whole reason the engine can run itself once started.',
    },
    {
      name: 'Nozzle',
      body: 'The narrowing exit at the back. Squeezing the same mass of gas through a smaller opening accelerates it — that acceleration, not the heat itself, is what generates thrust.',
    },
    {
      name: 'Bypass duct',
      body: 'The wide gap between the core and the outer cowling that most of the fan’s air flows through, skipping combustion entirely. It is why a modern turbofan is quieter and far more fuel-efficient than the pure jets of the 1950s.',
    },
  ],

  numbers: [
    { label: 'Core rotor speed (N2)', value: '10,000+ RPM', note: 'sustained continuously in cruise, not a brief peak' },
    { label: 'Fan speed (N1)', value: '~2,500–4,500 RPM', note: 'far slower than the core — the fan and low-pressure compressor share one shaft' },
    { label: 'Overall pressure ratio', value: 'up to 70:1', note: 'air leaving the compressor can reach 70 times atmospheric pressure' },
    { label: 'Turbine inlet temperature', value: 'up to ~1,700 °C', note: 'hotter than the melting point of the turbine blades — survivable only with internal air cooling' },
    { label: 'Bypass ratio', value: 'up to 12.5:1', note: 'modern engines route up to twelve times more air around the core than through it' },
  ],

  faq: [
    {
      q: 'Does a jet engine push against the air behind the plane?',
      a: 'No — that’s the most common misconception about thrust. The engine doesn’t push off anything; it accelerates a mass of air and throws it backward, and Newton’s third law does the rest. It’s the same principle a rocket uses in the vacuum of space, where there is no air to push against at all.',
    },
    {
      q: 'Why does most of the thrust come from the fan, not the fiery part?',
      a: 'Because in a modern turbofan, most of the air the fan pulls in never goes near the combustor — it’s routed around the core through the bypass duct. That cooler bypass air, simply accelerated by the fan, produces most of the engine’s thrust and nearly all of its fuel efficiency.',
    },
    {
      q: 'Why does the engine take several seconds to respond when you push the throttle?',
      a: 'The fan and compressor are heavy, and spinning that much mass up takes real time — plus the engine’s control system deliberately meters fuel in slowly at low power, because dumping in too much too fast can overheat the turbine or stall the compressor before it’s spinning fast enough to keep up.',
    },
    {
      q: 'Why doesn’t a jet engine explode like a car engine’s cylinders?',
      a: 'A piston engine resets after every single combustion pulse — intake, compress, bang, exhaust, repeat. A jet engine’s four steps happen continuously and simultaneously in different sections of the same tunnel: air is always being sucked in at the front at the same moment fuel is burning in the middle and exhaust is blasting out the back. There’s no pulse to reset.',
    },
    {
      q: 'Why are modern jet engines so much quieter than older ones?',
      a: 'Mostly the bypass ratio. Older, low-bypass engines pushed nearly all their air through the hot, screaming core; today’s high-bypass engines — some routing twelve times more air around the core than through it — get most of their thrust from a large, relatively slow-moving fan instead. Slower-moving air makes far less noise than a fast, hot exhaust jet — the same physics that makes a big propeller quieter than a small, fast one.',
    },
  ],

  failureModes: [
    {
      q: 'What is a compressor stall?',
      a: 'It’s when the angle of air hitting the compressor blades gets too steep for them to handle smoothly — usually triggered by a rapid throttle change, ingested debris, or worn blades — and the airflow separates or even reverses. Pilots hear it as a loud bang or series of bangs and feel it as vibration; it’s a leading cause of emergency engine shutdowns if not corrected immediately by pulling the throttle back.',
    },
    {
      q: 'What actually happens when a bird gets sucked in?',
      a: 'Regulators don’t require an engine to shrug off a bird strike undamaged — they require it to fail safely. Certification testing fires real birds into a running engine at full speed: for small birds, the engine has to keep producing declining thrust for twenty minutes afterward; for a large bird, it only has to shut down safely, not keep running. The fan blades are designed to contain the damage, not prevent it.',
    },
    {
      q: 'Can the flame inside just go out?',
      a: 'Yes — a flameout. It can be triggered by severe turbulence, heavy rain or hail ingestion, fuel problems, or flying too high on too little air. The engine keeps spinning from airflow alone (called windmilling) but produces no thrust, and it isn’t always relightable everywhere: an Airbus A320 can cruise above 39,000 feet, but its certified relight envelope only reaches 30,000 feet — above that, a restart has to wait until the aircraft descends.',
    },
  ],
};
