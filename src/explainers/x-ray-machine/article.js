// Article content for the prerendered page — see docs/seo-plan.md §C1 and
// .claude/skills/write-article/SKILL.md. This explainer's own step copy
// already carries most of the numbers (accelerating voltage, filament
// temperature, anode RPM, the 1%/99% split) — parts/numbers below mostly
// synthesize that existing, already-accurate copy rather than introduce new
// facts. The dose comparison, tube-failure mechanics, and lead-apron
// findings ARE new research, sourced from radiology-safety and x-ray-tube
// engineering references, not from this explainer's own text.
export default {
  directAnswer: {
    question: 'How does an X-ray machine work?',
    answer:
      'An X-ray machine boils electrons off a white-hot tungsten wire, hurls them across a vacuum at over half the speed of light into a spinning tungsten target, and lets the one percent of the impact that becomes radiation cast a shadow through whatever stands in its path. The image is a shadow, not a photograph.',
  },

  parts: [
    { name: 'Cathode (filament)', body: 'A coil of tungsten wire about as thick as a human hair, heated to roughly 2,000 °C until electrons simply evaporate off it into the surrounding vacuum.' },
    { name: 'Focusing cup', body: 'A negatively charged cup around the filament that squeezes the cloud of freed electrons into a tight stream instead of letting it drift apart.' },
    { name: 'Anode', body: 'The spinning tungsten target the electrons slam into. It turns at 3,000+ RPM specifically so the impact point keeps changing — a stationary target would melt.' },
    { name: 'Stator', body: 'The motor coils sealed outside the glass tube that spin the anode by induction, with no wire ever crossing the vacuum to reach it.' },
    { name: 'Collimator', body: 'Two pairs of lead blades that crop the X-ray cone down to exactly the rectangle being imaged — every photon outside that rectangle is dose spent for nothing.' },
    { name: 'Beryllium window', body: 'The one point in the lead-lined housing thin and light enough for X-rays to actually pass through, letting the beam out where it is wanted.' },
    { name: 'Anti-scatter grid', body: 'A grid of lead strips standing on edge, aimed back at the tube, that catches photons arriving at the wrong angle — scattered light that would otherwise just fog the image.' },
    { name: 'Scintillator', body: 'A layer of caesium iodide behind the grid that flashes visible light every time it absorbs an X-ray, handing the signal off to a silicon photodiode array underneath.' },
  ],

  numbers: [
    { label: 'Accelerating voltage', value: 'up to 120,000 V', note: 'the kilovolt drop electrons cross to reach the target' },
    { label: 'Electron speed at impact', value: 'over 50% of light speed', note: 'reached in a gap smaller than a coin' },
    { label: 'Filament temperature', value: '~2,000 °C', note: 'white-hot — hot enough to boil electrons directly off the metal' },
    { label: 'Anode rotation speed', value: '3,000+ RPM', note: 'spreads the heat around a ring instead of melting a single point' },
    { label: 'Energy → X-ray conversion', value: '~1%', note: 'the other ~99% becomes heat, which is why the anode has to spin at all' },
    { label: 'Typical exposure duration', value: 'hundredths of a second', note: 'the machine spends nearly all its life idling and cooling' },
    { label: 'Dose, one chest X-ray', value: '~0.1 mSv', note: 'about 10 days of ordinary background radiation' },
  ],

  faq: [
    {
      q: 'Is it safe to get an X-ray?',
      a: 'A single chest X-ray delivers around 0.1 millisievert — about ten days’ worth of the background radiation everyone absorbs anyway just from cosmic rays and the ground underfoot. It’s not zero, which is why exposures are only ordered when there’s a real medical reason, but the dose itself is small next to what a body handles from the environment every year regardless.',
    },
    {
      q: 'Does the lead apron protect your whole body?',
      a: 'No — the apron most rooms use is sleeveless and stops above the knees, leaving the arms, shoulders and head uncovered. It’s become enough of a coverage myth that the American Association of Physicists in Medicine no longer even recommends shielding reproductive organs during most imaging: the dose reduction is marginal, and studies have found the shields themselves misplaced roughly half the time, sometimes covering the very bone that was supposed to be imaged.',
    },
    {
      q: 'Why do bones show up so clearly but soft tissue barely does?',
      a: 'Because how much a material absorbs climbs roughly with the cube of its atomic number. Calcium is atom-for-atom far heavier than the hydrogen, carbon and oxygen that make up most soft tissue, so bone swallows photons that everything around it lets straight through — that contrast is the entire image.',
    },
    {
      q: 'Why does the target spin instead of just sitting still?',
      a: 'Because ninety-nine percent of the electron beam’s energy becomes heat, not X-rays, landing on a patch of metal smaller than a fingertip. A stationary target would melt in seconds; spinning it at 3,000+ RPM drags cold metal continuously under the beam and spreads that heat around a whole ring instead.',
    },
    {
      q: 'Can X-rays pass through anything?',
      a: 'No — that’s exactly why the tube housing is lined with lead and why the room itself is often shielded. Dense, high-atomic-number materials like lead absorb X-rays almost completely, which is the same property that makes bone visible against soft tissue, just taken to an extreme.',
    },
  ],

  failureModes: [
    {
      q: 'What actually breaks inside an X-ray tube?',
      a: 'Mostly thermal fatigue. Every exposure heats the tungsten target and lets it cool again, and that repeated cycling eventually opens micro-cracks in the target surface and the stem behind it. Rotor bearing wear compounds it — an imbalanced disc vibrates, and vibration accelerates exactly the stem-cracking that thermal cycling already causes.',
    },
    {
      q: 'Why do older X-ray tubes start arcing?',
      a: 'Over years of operation, a thin film of vaporized tungsten gradually deposits on the inside of the glass envelope. Once that film gets thick enough, it forms a conductive path across the insulator, and the tube starts arcing internally — a slow-motion failure that a tube can accumulate toward for years before it becomes noticeable.',
    },
    {
      q: 'Can a protective shield make an exposure worse?',
      a: 'Occasionally, yes. When a shield is placed even slightly wrong, it can obscure the exact anatomy the X-ray was ordered to check — and a study found that happening in roughly half of pelvic exposures. The result isn’t a safer image, it’s a repeat exposure, which is part of why shielding guidance has shifted away from routinely using it at all.',
    },
  ],
};
