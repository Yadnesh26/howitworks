// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'wireless-charging',
  title: 'How Wireless Charging Works',
  summary:
    'No plug, no port — just two flat coils a few millimetres apart. How an oscillating magnetic field carries power across an air gap and into your phone, and why the two coils never actually touch.',
  accent: '#2ee6c0',
  // one-line teardown for the library card
  spec: 'two flat coils · an oscillating field across an air gap',
  // part names, so search finds this machine by what is inside it
  keywords: 'qi inductive coupling resonance transmitter receiver coil air gap',
  categories: ['electronics'],
};
