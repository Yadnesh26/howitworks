// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'black-hole',
  // Not "How a Black Hole Works": a black hole is not a machine with a
  // mechanism you could operate, and the library's usual how-it-works framing
  // reads as a category error on it. It is also how people actually search for
  // this one. shortTitle() and the export's compactTitle() both strip this
  // form too, so the card still reads "Black Hole".
  title: 'What Is a Black Hole?',
  summary:
    'The dark circle is not the hole — it is 2.6 times wider than the hole, because the hole bends the paths of the light behind it. Everything you can see of a black hole is the last thing that got away.',
  accent: '#ffb454',
  // one-line teardown for the library card
  spec: 'the shadow is 2.6× the horizon — light bent around the back',
  // part names, so search finds this machine by what is inside it
  keywords: 'event horizon photon sphere accretion disk singularity gravitational lensing schwarzschild',
  categories: ['space'],
  youtubeUrl: 'https://www.youtube.com/shorts/lm5daAJ-E8E',
};
