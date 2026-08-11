// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'rocket-engine',
  title: 'How a Rocket Engine Works',
  summary:
    'Burning the fuel is the easy part. The hard part is shoving three hundred kilos of propellant a second into a chamber already at ninety-seven atmospheres — which is why most of this engine is a pump, driven by a second, smaller rocket engine bolted to its side.',
  accent: '#ff6a3d',
  // one-line teardown for the library card
  spec: 'gas-generator cycle · 36,000 rpm turbopump · 97 bar · 16 : 1 bell',
  // part names, so search finds this machine by what is inside it
  keywords:
    'rocket engine liquid propellant turbopump impeller turbine gas generator preburner pintle injector combustion chamber throat bell nozzle expansion ratio regenerative cooling film cooling gimbal thrust vector LOX RP-1 kerolox specific impulse Merlin',
  categories: ['space'],
};
