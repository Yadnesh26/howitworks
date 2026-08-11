// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'hard-disk-drive',
  title: 'How a Hard Disk Drive Works',
  summary:
    'A read/write head flies 3 nanometres above a platter spinning at 7200 RPM — never touching, riding a cushion of its own making — which is exactly why dropping one is fatal.',
  accent: '#7fd4ff',
  // one-line teardown for the library card
  spec: 'platter at 7200 rpm · head flying 3 nm off the surface',
  // part names, so search finds this machine by what is inside it
  keywords: 'platter read write head actuator arm voice coil spindle sector track',
  categories: ['electronics', 'precision'],
};
