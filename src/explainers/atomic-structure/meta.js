// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'atomic-structure',
  // Not "How an Atom Works": an atom is not a machine with a mechanism you
  // could operate, and the library's usual how-it-works framing reads as a
  // category error on it — same call as black-hole's "What Is a Black Hole?".
  // "Atomic structure" is also the exact form people search, and both
  // shortTitle() and the export's compactTitle() leave it alone, so the card
  // and the video title card already read right.
  title: 'Atomic Structure',
  summary:
    'Six protons, six neutrons and six electrons — and almost nothing else. The nucleus holds all the mass in a twenty-five-thousandth of the width, and the electrons are not orbiting it so much as smeared around it.',
  accent: '#5ec8ff',
  // one-line teardown for the library card
  spec: 'the nucleus is 1/25,000 of the width — the rest is electron',
  // part names, so search finds this machine by what is inside it
  keywords:
    'atom atomic structure proton neutron electron nucleus electron shell orbital electron cloud carbon strong nuclear force valence quantum',
  categories: ['matter'],
};
