// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'treadmill',
  title: 'How a Treadmill Works',
  summary:
    'One motor, two rollers and a waxed board — how a machine that never moves an inch carries you 10 km, and why the belt stays dead centre.',
  accent: '#a8e05f',
  // one-line teardown for the library card
  spec: '3 HP DC motor · 3:1 poly-V drive · waxed deck',
  // part names, so search finds this machine by what is inside it
  keywords:
    'running belt walking belt drive roller idler roller deck board phenolic MDF wax PTFE elastomer cushion poly-V belt flywheel motor controller PWM hall sensor speed sensor incline lift motor lead screw actuator belt tracking crowned roller tension bolt safety key',
  categories: ['home'],
};
