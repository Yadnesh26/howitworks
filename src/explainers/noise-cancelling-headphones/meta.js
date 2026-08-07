// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'noise-cancelling-headphones',
  title: 'How Noise-Cancelling Headphones Work',
  summary:
    'Two microphones, one driver, and a wave built to cancel another wave out. How feedforward and feedback ANC catch noise before and after it reaches your ear — and why it can silence a jet engine but not your coworker’s voice.',
  accent: '#33ccff',
  // one-line teardown for the library card
  spec: 'feedforward + feedback mics · one driver · an inverted wave',
  // part names, so search finds this machine by what is inside it
  keywords: 'anc feedforward feedback microphone destructive interference phase driver',
  categories: ['electronics'],
};
