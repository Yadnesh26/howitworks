// steps: 0 anatomy · 1 one pin two rods · 2 four strokes two cylinders
//        3 offbeat heartbeat · 4 the 90° secret · 5 run
export default {
  hook: 'One pin.\nTwo pistons breaking the rules.',

  short: {
    dolly: 1.7,
    shots: [
      { step: 0, seconds: 4, dolly: 1.8,
        narration: 'This engine breaks a rule every other engine follows — it makes two pistons share the exact same pin.' },
      { step: 0, seconds: 4,
        narration: 'And that shortcut is exactly why it never fires evenly — every beat comes out lopsided.' },
      { step: 1, seconds: 4,
        narration: 'So why would anyone build an engine that beats itself out of rhythm, on purpose?' },
      { step: 1, seconds: 5,
        narration: 'Meet the V-twin: two air-cooled cylinders splayed ninety degrees apart, both connecting rods clamped onto one shared crankpin down in the case.' },
      { step: 2, seconds: 5,
        narration: 'Each cylinder still runs its own four strokes, but they can never fire together — so they trade that single pin back and forth.' },
      { step: 3, seconds: 6,
        narration: 'Therefore the bangs land unevenly: fire, then fire again just two-seventy degrees later, then a long four-fifty-degree wait before it repeats.' },
      { step: 4, seconds: 6,
        narration: 'But that same imbalance turns out to be the fix — angle the V to exactly ninety degrees, and each piston’s leftover kick cancels the other’s, so one crank counterweight balances both pistons, no extra shaft needed.' },
      { step: 5, seconds: 4,
        narration: 'That uneven beat is a V-twin’s signature.' },
    ],
  },

  long: {
    shots: [
      { step: 0, seconds: 9,
        narration: 'This engine breaks a rule almost every other engine follows. It’s a V-twin: two cylinders splayed into a V, both feeding one crankshaft — and both connecting rods about to grab the exact same pin. That single choice is the reason it never sounds like anything else.' },
      { step: 1, seconds: 10,
        narration: 'Here’s why that pin matters. As the crank spins, it drags both rods around one shared circle — but the cylinders sit ninety degrees apart, so each piston reads that circle differently. When cylinder A is at the very top of its stroke, cylinder B is only halfway up its own.' },
      { step: 2, seconds: 9,
        narration: 'Therefore each cylinder still runs the full four-stroke cycle — intake, compression, power, exhaust — but they can never fire at the same time. They’re forced to trade that single pin back and forth, one bang, then the other, over and over.' },
      { step: 3, seconds: 10,
        narration: 'And that trade is uneven on purpose. Count the sparks: bang, then bang again just two-seventy degrees later — then a long four-fifty-degree wait before the pair repeats. That 270/450 rhythm is the exact idle beat a V-twin is known for.' },
      { step: 4, seconds: 10,
        narration: 'But that same imbalance is also the fix. Angle the V to exactly ninety degrees, and each piston’s leftover shake cancels the other’s — so a single crank counterweight balances both pistons. No balance shaft needed, just geometry doing the work.' },
      { step: 5, seconds: 9,
        narration: 'Put it together and you get hundreds of these lopsided pulses every minute, smoothed by the flywheel into one unmistakable idle — the signature sound of a V-twin.' },
    ],
  },
};
