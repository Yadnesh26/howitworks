// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'disc-brakes',
  title: 'How Disc Brakes Work',
  summary:
    'Your foot, a column of fluid, and a 27× force multiplier ending in two pads squeezing a spinning iron disc — how a car turns motion into heat, on demand, hundreds of times a day.',
  accent: '#ff5346',
  // one-line teardown for the library card
  spec: 'hydraulic 27× multiplier · 2 pads · cast-iron rotor',
  // part names, so search finds this machine by what is inside it
  keywords: 'caliper rotor brake pad master cylinder hydraulic fluid piston',
  categories: ['vehicles'],
};
