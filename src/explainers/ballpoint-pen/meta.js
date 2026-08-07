// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'ballpoint-pen',
  title: 'How a Ballpoint Pen Works',
  summary:
    'A bistable rotating cam, a tungsten-carbide ball smaller than a grain of rice, and a film of ink thinner than a hair — how one click locks a pen open, and one roll of a ball writes a line.',
  accent: '#2e6bef',
  // one-line teardown for the library card
  spec: 'bistable cam · tungsten-carbide ball · capillary ink film',
  // part names, so search finds this machine by what is inside it
  keywords: 'cam clicker tungsten carbide ball socket ink viscosity spring',
  categories: ['precision'],
};
