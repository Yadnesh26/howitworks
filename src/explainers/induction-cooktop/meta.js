// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'induction-cooktop',
  title: 'How an Induction Cooktop Works',
  summary:
    'A flat coil of wire under black glass, a magnetic field flipping 25,000 times a second, and a pan that turns itself into the heating element — while the worktop it sits on stays cold.',
  accent: '#3fd8e8',
  // one-line teardown for the library card
  spec: '25 kHz field · the pan becomes the element · glass stays cold',
  // part names, so search finds this machine by what is inside it
  keywords: 'induction coil eddy current ferromagnetic hob igbt',
  categories: ['home'],
  youtubeUrl: 'https://www.youtube.com/shorts/2Ndn5gLHhcI',
};
