// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'touchscreen',
  title: 'How a Touchscreen Works',
  summary:
    'A sheet of glass with no moving parts that knows exactly where you touched it — how an invisible grid of diamonds measures a capacitance a millionth of a millionth of a farad wide, and why your finger makes the signal go down.',
  accent: '#7de3ff',
  // one-line teardown for the library card
  spec: 'ITO diamond grid · mutual capacitance · 364 nodes read 120× a second',
  // part names, so search finds this machine by what is inside it
  keywords:
    'capacitive touch screen ito indium tin oxide drive sense electrode diamond mutual capacitance controller multitouch digitizer cover glass phone display',
  categories: ['electronics'],
};
