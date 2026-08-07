// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'lithium-ion-battery',
  title: 'How a Lithium-Ion Battery Works',
  summary:
    'Nothing inside is burned or used up — it is a shuttle. Lithium ions cross back and forth between two layered electrodes, and the cell ages fastest exactly where most phones sit overnight: parked at 100%.',
  accent: '#ffe066',
  // one-line teardown for the library card
  spec: 'an ion shuttle between layered electrodes — ages fastest at 100%',
  // part names, so search finds this machine by what is inside it
  keywords: 'anode cathode electrolyte separator intercalation charge cycle degradation 18650',
  categories: ['electronics', 'power'],
};
