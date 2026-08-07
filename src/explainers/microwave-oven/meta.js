// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'microwave-oven',
  title: 'How a Microwave Oven Works',
  summary:
    'A vacuum tube that spins electrons in circles, a metal box that bounces the result into a standing wave, and water molecules flipped two and a half billion times a second — the physics inside every kitchen counter.',
  accent: '#ffb02e',
  // one-line teardown for the library card
  spec: 'magnetron · 2.45 GHz standing wave · dipoles flipped 2.5 billion×/s',
  // part names, so search finds this machine by what is inside it
  keywords: 'magnetron waveguide cavity standing wave dielectric heating turntable',
  categories: ['home'],
};
