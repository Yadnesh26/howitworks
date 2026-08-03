// Editorial layer for video export (scripts/export-video.mjs). Hook is shot
// 1's spoken line verbatim — the burned caption rail IS the on-screen hook,
// there's no separate title card. Narration is spoken prose, not step body
// copy; captions are the verbatim ElevenLabs word-alignment rail, not
// hand-written summaries.
//
// steps: 0 overview (constellation) · 1 satellite anatomy · 2 signal (PRN +
//        ephemeris) · 3 pseudorange (one sphere) · 4 trilaterate (3 spheres)
//        5 clockfix (bias wobble -> 4th satellite locks it) · 6 relativity
//        (twin clocks) · 7 run (finale, locked coordinate)
export default {
  hook: 'Your phone has never sent a single signal to space.\nNot one, ever.',
  endCard: 'Share it.\nFollow for more.',

  // 9:16, narrated + verbatim caption rail
  short: {
    shots: [
      {
        // hook (0-3s)
        step: 0,
        seconds: 4,
        narration: 'Your phone has never sent a single signal to space. Not one, ever.',
      },
      {
        // stakes + promise — plants the loop
        step: 0,
        seconds: 4,
        narration: 'And yet right now it knows exactly where you’re standing, to within a few meters.',
      },
      {
        // spoken question
        step: 1,
        seconds: 3,
        narration: 'So how does total silence turn into an exact coordinate?',
      },
      {
        // mechanism beat 1
        step: 2,
        seconds: 6,
        labels: ['PRN code', 'Ephemeris + transmit timestamp'],
        narration: 'Twenty-four satellites, twenty thousand kilometers up, just repeat the same two things forever — their own position, and the exact time they said it.',
      },
      {
        // mechanism beat 2 (BUT)
        step: 3,
        seconds: 6,
        labels: ['Range = c × travel time'],
        narration: 'Your phone times how long that took to arrive and multiplies by the speed of light. But one satellite alone only gives you a sphere — you could be anywhere on it.',
      },
      {
        // mechanism beat 3 (THEREFORE) — wide 3-satellite shot crops in
        // portrait at the default dolly; pull back further
        step: 4,
        seconds: 6,
        dolly: 1.9,
        labels: ['Sphere of possible positions', 'Fix narrows to one point'],
        narration: 'Therefore it listens for two more. Where all three spheres overlap… that’s roughly you.',
      },
      {
        // re-hook mid-way — same portrait-crop issue (4-satellite spread)
        step: 5,
        seconds: 7,
        dolly: 2.1,
        labels: ['Unknown clock bias blurs the fix', '4th satellite solves it'],
        narration: 'But your phone’s clock is cheap, and slightly wrong — so it actually needs a fourth satellite just to cancel out its own mistake.',
      },
      {
        // the stat, isolated
        step: 5,
        seconds: 4,
        dolly: 2.1,
        narration: 'One microsecond of that error is three hundred meters of being wrong.',
      },
      {
        // so-what
        step: 7,
        seconds: 5,
        narration: 'Watch that number lock in — a fresh, exact fix, solved about once a second.',
      },
      {
        // button — closes the hook’s loop
        step: 7,
        seconds: 4,
        narration: 'Still not one signal sent to space. Just listening.',
      },
    ],
  },

  // 16:9, full story, narrated
  long: {
    shots: [
      {
        step: 0,
        seconds: 12,
        narration: 'This is the GPS constellation, modeled to scale — twenty-four satellites, six tilted orbits, twenty thousand kilometers up, circling twice a day. And here’s the strange part: none of them ever hear back from your phone. Every fix is pure listening.',
      },
      {
        step: 1,
        seconds: 12,
        labels: ['Solar panels', 'L-band antenna array (nadir)', 'Atomic clock (cesium/rubidium) inside'],
        narration: 'Zoom into one satellite. About the size of a delivery van, solar wings tracking the sun, a dish aimed straight down at Earth. Inside sits an atomic clock, accurate to billionths of a second — because that precision is the entire trick.',
      },
      {
        step: 2,
        seconds: 9,
        labels: ['PRN code', 'Ephemeris + transmit timestamp'],
        narration: 'Every satellite repeats the same broadcast, forever: which satellite this is, its own precise orbital position, and the exact instant it sent the signal. That’s the whole message. Everything else is arithmetic.',
      },
      {
        step: 3,
        seconds: 11,
        labels: ['Range = c × travel time'],
        narration: 'Your receiver times how long that took to arrive, multiplies by the speed of light, and gets a distance. But a distance alone isn’t a location — every point that far from the satellite is still possible. It’s a sphere, not a point.',
      },
      {
        step: 4,
        seconds: 10,
        labels: ['Sphere of possible positions', 'Fix narrows to one point'],
        narration: 'Add a second satellite and its sphere slices the first into a circle. Add a third, and that circle collapses to two points — one absurd, one sensible. In principle, three should be enough.',
      },
      {
        step: 5,
        seconds: 16,
        labels: ['Unknown clock bias blurs the fix', '4th satellite solves it'],
        narration: 'But there’s a catch: satellites carry atomic clocks, your phone carries a cheap one, off by an unknown amount — and that error shifts every distance the same way, blurring the fix. A fourth satellite adds a fourth equation, solving position and clock error at once. Watch the readout wobble, then lock, the instant that fourth satellite joins.',
      },
      {
        step: 6,
        seconds: 12,
        labels: ['Satellite clock (runs fast)', 'Ground clock'],
        narration: 'That precision has to survive relativity too. Orbiting fast in weaker gravity speeds the clock up by about thirty-eight microseconds a day — and one microsecond of drift is already three hundred meters of error. Engineers detune every clock before launch to cancel it out.',
      },
      {
        step: 7,
        seconds: 11,
        narration: 'Do that about once a second, for every receiver on the planet, all day — and you get an exact coordinate for free, without ever sending one signal back to space. Just satellites endlessly talking, and a phone that only listens.',
      },
    ],
  },
};
