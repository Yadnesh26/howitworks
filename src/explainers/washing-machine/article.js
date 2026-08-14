// Article content for the prerendered page — see docs/seo-plan.md §C1 and
// .claude/skills/write-article/SKILL.md. This explainer's own step copy
// already carries most of the numbers (spin RPM, g-force, counterweight
// mass, heater power) — parts/numbers below mostly synthesize that existing
// copy. The water-usage comparison, mold/gasket, imbalance-detection, and
// pump-failure content in faq/failureModes IS new research, sourced from
// appliance-efficiency and repair references, not from this explainer's
// own text.
export default {
  directAnswer: {
    question: 'How does a washing machine work?',
    answer:
      'A front-loading washing machine fills the sump with just enough water to wet the load, heats it with an internal element, tumbles the clothes gently by lifting and dropping them through the water, then drains and spins the drum at up to 1,400 RPM to fling the remaining water off by force alone. Nothing squeezes the fabric — the water is simply thrown outward, at roughly 500 times the pull of gravity.',
  },

  parts: [
    { name: 'Outer tub', body: 'The sealed plastic bucket that holds the water. It never moves — it just contains whatever the inner drum is doing.' },
    { name: 'Inner drum', body: 'The perforated stainless drum inside the tub, and the only part that actually spins. Its perforations are the only way water can leave during a spin.' },
    { name: 'Lifter paddle', body: 'Ridges running down the inside of the drum that catch the load, carry it up the wall, and let gravity drop it back through the water — that lift-and-drop is the entire washing action.' },
    { name: 'Heating element', body: 'A sheathed element, roughly 2 kW, sitting in the sump. The machine fills with cold mains water and heats it itself rather than relying on a hot supply.' },
    { name: 'Drain pump', body: 'Empties the tub before the spin cycle starts, and again at the very end — spinning up a drum with a bath still in it would waste most of the motor’s effort fighting water instead of flinging it.' },
    { name: 'Counterweight and suspension', body: 'Roughly 25 kg of concrete bolted to the frame, hung on springs with friction dampers pushing back from the base — together they absorb the shake of a fast-spinning, occasionally uneven load instead of letting it walk the machine across the floor.' },
    { name: 'Direct-drive motor', body: 'A rotor carrying dozens of permanent magnets bolts straight onto the drum shaft — no belt, no pulley. A stator of wound copper coils chases the magnets electronically, which is how the same motor holds both a lazy 50 RPM tumble and a 1,400 RPM spin.' },
    { name: 'Door bellows', body: 'The flexible rubber seal that keeps water inside a front-loader while still letting the door open. Its folds are also exactly where mold tends to grow if the machine is closed up wet between washes.' },
  ],

  numbers: [
    { label: 'Spin speed', value: 'up to 1,400 RPM', note: 'reached only after the tub has fully drained' },
    { label: 'Force at the drum wall (spin)', value: '~500 × gravity', note: 'why water is flung off fabric instead of needing to be wrung out' },
    { label: 'Counterweight mass', value: '~25 kg', note: 'concrete, bolted to the frame specifically to resist vibration' },
    { label: 'Heating element power', value: '~2 kW', note: 'heats cold mains water in the sump rather than relying on a hot feed' },
    { label: 'Water used per wash', value: '~50 L', note: 'clothes are wetted, not floated — a fraction of what a full-submersion machine needs' },
    { label: 'Wash tumble speed', value: '~50 RPM', note: 'deliberately kept below the point where the load stops falling at all' },
    { label: 'Rotor magnet count', value: '36', note: 'the ring of permanent magnets the stator coils chase to turn the drum' },
  ],

  faq: [
    {
      q: 'Why do front loaders use so much less water than top loaders?',
      a: 'A front loader tumbles clothes through a shallow pool using gravity, rather than fully submerging them — typically 10 to 15 gallons a load against 30 to 40 for a conventional top loader. It cleans by lifting and dropping the load through the water repeatedly, not by floating it, so it never needs to fill the drum.',
    },
    {
      q: 'Why does my washing machine smell musty?',
      a: 'The same tight rubber door seal that stops a front loader leaking also traps moisture against detergent and fabric-softener residue — exactly the damp, organic film mold needs. Leaving the door open between washes and wiping the gasket down after use are the two habits that matter most.',
    },
    {
      q: 'How does the machine know when a load is out of balance?',
      a: 'Most modern direct-drive machines don’t need a separate sensor for it — the motor controller watches its own current and speed as the drum turns, and an uneven load makes that pattern uneven too. Detecting that, the machine will often pause to redistribute the load before ramping the spin back up, rather than letting an imbalance grow at speed.',
    },
    {
      q: 'Why does the drum only tumble at about 50 RPM instead of running fast the whole cycle?',
      a: 'Past roughly 60 RPM, the drum wall is pulling the load outward harder than gravity pulls it down — nothing falls anymore, and the machine is just spinning a heavy tube with no scrubbing action at all. Wash tumbling stays well under that threshold on purpose.',
    },
    {
      q: 'Is a washing machine really spinning clothes at 500 times gravity?',
      a: 'At the drum wall during a 1,400 RPM spin, yes — that’s the outward force anything loose has to resist to stay attached. Water can’t resist it, which is exactly the point: it’s flung straight through the drum’s perforations instead of needing to be wrung out.',
    },
  ],

  failureModes: [
    {
      q: 'Why won’t my washing machine drain?',
      a: 'Almost always a blocked drain pump filter or impeller — coins, zipper tabs, or small stones that made it through a pocket and got caught. Signs include water pooling at the bottom of the drum, slow drainage during the cycle, and a humming noise as the pump struggles against the obstruction.',
    },
    {
      q: 'What does a grinding or screeching noise during spin usually mean?',
      a: 'Worn bearings, most often. A steady grinding or humming during draining points to the pump; a high-pitched screech or whine more often points to worn motor or pump bearings; a rattle specifically during draining usually means debris trapped in the pump impeller rather than bearing wear.',
    },
    {
      q: 'What stops an out-of-balance load from shaking the machine apart?',
      a: 'Several layers at once: the counterweight and suspension absorb ordinary imbalance by design, but if the controller detects an imbalance it can’t safely spin through, it stops the ramp-up entirely rather than letting the shake build — which is why a badly unbalanced load sometimes ends a cycle without ever reaching full spin speed.',
    },
  ],
};
