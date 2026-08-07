// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'wifi-router',
  title: 'How a Wi-Fi Router Works',
  summary:
    'Three sticks of plastic on a black box, each hiding six centimetres of copper — half a wavelength. It shouts with a tenth of a watt, listens for whispers a hundred billion times fainter, and lets exactly one device in the house talk at a time.',
  accent: '#7aa2ff',
  // one-line teardown for the library card
  spec: '6 cm dipoles · 0.1 W out · exactly one device talking at a time',
  // part names, so search finds this machine by what is inside it
  keywords: 'antenna dipole 2.4ghz 5ghz csma channel ssid access point',
  categories: ['communications', 'home'],
};
