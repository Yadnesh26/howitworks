// Article content for the prerendered page — see docs/seo-plan.md §C1 and
// .claude/skills/write-article/SKILL.md. This explainer's own step copy is
// already extremely rich numerically (field frequency, coil geometry, bus
// voltage, skin depth, efficiency figures) — parts/numbers below mostly
// synthesize that existing copy. The magnetostriction/noise, pacemaker
// safety, and glass/electronics failure content in faq/failureModes IS new
// research, sourced from appliance-physics and cardiac-device-safety
// references, not from this explainer's own text.
export default {
  directAnswer: {
    question: 'How does an induction cooktop work?',
    answer:
      'An induction cooktop uses a flat coil under the glass to generate a magnetic field that flips back and forth 25,000 times a second. Glass and aluminium don’t respond to it, but the iron in a steel pan base does — the changing field drives loops of current directly inside the metal, and the metal’s own resistance turns that current into heat. The cooktop itself never gets hot; the pan heats itself.',
  },

  parts: [
    { name: 'Litz-wire coil', body: 'A flat spiral about 180 mm across, 22 turns, wound from hundreds of hair-thin varnished strands twisted into one bundle — so the coil carrying that current doesn’t heat itself the same way the pan does.' },
    { name: 'Ferrite bars', body: 'Six bars sitting under the coil like spokes, there to aim the magnetic field upward into the pan instead of letting it leak sideways into the electronics.' },
    { name: 'Rectifier and IGBTs', body: 'Turn ordinary 50 Hz wall current into a steady 325-volt DC bus, then switch that supply on and off roughly 25,000 times a second — deliberately above human hearing.' },
    { name: 'Glass-ceramic surface', body: 'Neither magnetic nor conductive, so the field passes straight through it as if it weren’t there at all — the surface is a spectator, not a participant.' },
    { name: 'Eddy currents', body: 'Loops of current the changing magnetic field drives directly inside the pan’s steel base. It isn’t heat arriving from outside — it’s the pan generating its own current and losing it to resistance as heat.' },
    { name: 'Load-sensing transformer', body: 'Clipped around the coil feed, constantly watching the current it draws. An unloaded coil pulls a different current than a loaded one, which is how the zone knows to cut power almost instantly when a pan is lifted.' },
  ],

  numbers: [
    { label: 'Magnetic field frequency', value: '~25 kHz', note: 'well above the top of human hearing, on purpose' },
    { label: 'Coil size', value: '~180 mm, 22 turns', note: 'flat, wound like a clock spring' },
    { label: 'DC bus voltage', value: '325 V', note: 'the smoothed, rectified supply the IGBTs switch' },
    { label: 'Heat depth in the pan base', value: '~0.1 mm', note: 'a skin thinner than a sheet of paper — almost all the heat forms right at the surface' },
    { label: 'Wall-to-food efficiency', value: '~85%', note: 'against roughly 70% for radiant electric and 40% for gas' },
    { label: 'Ferrite bars under the coil', value: '6', note: 'shape the field upward instead of letting it leak into the electronics' },
  ],

  faq: [
    {
      q: 'Why does my induction cooktop buzz or hum?',
      a: 'Magnetostriction — the iron atoms in your pan’s base physically expand and contract with every cycle of the magnetic field, and at 25 kHz that tiny mechanical vibration produces an audible 40 to 200 Hz hum. It’s the same physical effect that makes power transformers hum, it’s completely normal, and it’s usually louder with thinner pans or multi-layer stainless, since the layers vibrate against each other.',
    },
    {
      q: 'Is induction cooking safe if you have a pacemaker?',
      a: 'A 2023 multicenter study tested 127 cardiac devices across 8 manufacturers under real induction conditions and found zero episodes of interference at 30 cm or more from the cooktop — modern devices are over 99% immune at normal cooking distance. The standard advice is still to keep a roughly 30 cm gap and avoid leaning directly over an active zone, but the real-world risk for a modern, correctly certified device is very low.',
    },
    {
      q: 'Why won’t an induction cooktop heat an aluminium or copper pan?',
      a: 'Because neither metal is magnetic. The field can still pass through them, but without iron to resist the current it drives, almost none of that energy turns into heat — which is exactly why a fridge magnet sticking to the base is the honest test for whether cookware will actually work.',
    },
    {
      q: 'Is induction actually more efficient than gas?',
      a: 'By a wide margin — roughly 85% of the energy that leaves the wall ends up in the food, against about 70% for a radiant electric ring and around 40% for a gas burner, most of which is simply lost heating the surrounding air instead of the pan.',
    },
    {
      q: 'Why does the field need to flip so much faster than ordinary wall current?',
      a: 'Wall current alternates only 50 times a second — far too slow to drive useful eddy currents in a pan base. Pushing the frequency up to around 25 kHz makes the induced currents strong enough to actually cook with, and pushing it specifically above the range of human hearing is what keeps the cooktop silent instead of shrieking at you the whole time it runs.',
    },
  ],

  failureModes: [
    {
      q: 'What actually cracks an induction cooktop’s glass?',
      a: 'Usually one of three things: dragging a rough-bottomed pan across the surface until a scratch eventually becomes a crack, dropping something hard or heavy onto it, or air trapped under a hot lid expanding as the cooktop cools and stressing the glass from below. Once the ceramic glass cracks, it can’t be repaired — the whole surface has to be replaced.',
    },
    {
      q: 'What usually fails in the electronics?',
      a: 'Burnout of the high-voltage IGBT switches on the driver board is the single most common electronic failure — it shows up as a dead zone, an error code, or the cooktop simply refusing to recognize any pan at all. Failed capacitors and moisture damage to the board are the other frequent culprits.',
    },
    {
      q: 'Why might a zone refuse to turn on even with the right pan on it?',
      a: 'Sometimes it’s not the pan at all — the load-sensing transformer or its detection circuitry can fail on its own, and a failed sensor reads exactly like "no pan present" even with correct, magnetic cookware sitting right on the zone. That’s a hardware fault, not a cookware problem, and no amount of pan-swapping fixes it.',
    },
  ],
};
