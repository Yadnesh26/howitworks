// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'x-ray-machine',
  title: 'How an X-Ray Machine Works',
  summary:
    'No camera, no lens, no film in the modern ones. A wire boiled white-hot, electrons thrown across a vacuum at half the speed of light, and a spinning slab of tungsten that turns 99 per cent of it straight into heat — all to make the one per cent that casts a shadow through you.',
  accent: '#9db4ff',
  // one-line teardown for the library card
  spec: 'rotating tungsten anode · 3,000 rpm · 1% X-rays, 99% heat',
  // part names, so search finds this machine by what is inside it
  keywords:
    'x-ray tube cathode filament thermionic emission focusing cup anode bremsstrahlung rotating anode stator collimator lead shutters beryllium window anti-scatter grid scintillator flat panel detector radiograph',
  categories: ['medical'],
  youtubeUrl: 'https://www.youtube.com/shorts/CnGX6E45W_E',
};
