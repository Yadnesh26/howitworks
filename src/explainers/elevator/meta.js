// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'elevator',
  title: 'How an Elevator Works',
  summary:
    'A car, a counterweight, and a grooved wheel that grips rather than winds — plus the wedge that catches you if every rope lets go.',
  accent: '#8fb4e0',
  // one-line teardown for the library card
  spec: 'traction sheave · counterweight · governor safeties',
  // part names, so search finds this machine by what is inside it
  keywords:
    'lift hoistway shaft traction sheave counterweight guide rail governor safety gear buffer landing door interlock machine room less gearless',
  categories: ['infrastructure'],
};
