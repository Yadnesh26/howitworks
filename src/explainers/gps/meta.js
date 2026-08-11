export default {
  id: 'gps',
  title: 'How GPS Works',
  summary:
    'Every satellite overhead just broadcasts its own position and the exact time it sent the signal. Your phone times how long that took, turns it into a distance, and does the same with three or four satellites at once — the spheres of possible positions overlap at exactly one point: you.',
  accent: '#5ad1ff',
  // one-line teardown for the library card
  spec: 'four satellites · time-of-flight · spheres that overlap at exactly you',
  // part names, so search finds this machine by what is inside it
  keywords: 'satellite trilateration atomic clock time of flight ephemeris constellation',
  categories: ['communications'],
};
