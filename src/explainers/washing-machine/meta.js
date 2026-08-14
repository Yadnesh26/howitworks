// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'washing-machine',
  title: 'How a Washing Machine Works',
  summary:
    'Two drums, a concrete block and a motor with no belt — how a front loader lifts your clothes, drops them, and then spins them at 500 times gravity.',
  accent: '#4fc3e8',
  // one-line teardown for the library card
  spec: 'direct-drive BLDC · 1400 rpm · ~500 g',
  // part names, so search finds this machine by what is inside it
  keywords:
    'front loader washer drum outer tub lifter paddle detergent drawer heating element drain pump spin cycle counterweight suspension spring damper direct drive rotor stator bellows',
  categories: ['home'],
};
