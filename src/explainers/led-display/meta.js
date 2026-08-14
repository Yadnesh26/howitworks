// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'led-display',
  title: 'How an LED Display Works',
  summary:
    'A wall of thousands of tiny lights that never seem to blink — how driver chips scan the rows, flicker each red/green/blue die faster than you can see, and blend three fixed colors into every shade on screen.',
  accent: '#ff5fd8',
  // one-line teardown for the library card
  spec: 'row scanning · RGB dies · switched faster than the eye resolves',
  // part names, so search finds this machine by what is inside it
  keywords: 'led die rgb subpixel pwm multiplexing driver ic matrix panel',
  categories: ['electronics'],
  youtubeUrl: 'https://www.youtube.com/shorts/qYq0PHYwd7o',
};
