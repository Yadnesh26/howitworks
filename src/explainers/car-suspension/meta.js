// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'car-suspension',
  title: 'How Car Suspension Works',
  summary:
    'A spring that turns a pothole into a slow squeeze, a tube of oil that refuses to give the energy back, and a 22 mm bar that only wakes up when the two sides of the car disagree.',
  accent: '#e8a33d',
  // one-line teardown for the library card
  spec: 'MacPherson strut · 30 N/mm coil · twin-tube damper · 22 mm anti-roll bar',
  // part names, so search finds this machine by what is inside it
  keywords:
    'MacPherson strut coil spring shock absorber damper control arm ball joint knuckle anti-roll bar sway bar bump stop',
  categories: ['vehicles'],
  youtubeUrl: 'https://www.youtube.com/shorts/Ty_ofYymwSk',
};
