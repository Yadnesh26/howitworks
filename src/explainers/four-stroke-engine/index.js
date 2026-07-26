import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildEngine } from './model.js';

// Every step runs the engine as a seamless loop while it is active — a full
// 720° cycle per lap, starting at the stroke the step teaches so that stroke
// happens right as the step lands. 720 is the model's true period, so the
// wrap is invisible. Each timeline owns its own local state object.
function cycleLoop(startDeg, duration = 2400) {
  return ({ tl, handles }) => {
    const s = { a: 0 };
    tl.add(s, {
      a: 720,
      duration,
      ease: 'linear',
      onUpdate: () => handles.setCycle(startDeg + s.a),
    });
  };
}

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildEngine({ scene });
  },

  steps: [
    {
      id: 'overview',
      heading: 'The anatomy',
      body: 'A single-cylinder engine as it really looks: a finned cylinder barrel bolted to a crankcase, capped by the head with the spark plug on top and the flywheel spinning out the side. Scroll and the castings lift away to show the mechanism working inside.',
      hint: 'Drag to orbit · scroll to open it up.',
      camera: { position: [4.4, 3.0, 6.4], target: [0, 1.85, 0] },
      onEnter: ({ handles }) => {
        handles.setReveal(0);
        handles.setLabels(true);
      },
      timeline: cycleLoop(0, 4800),
    },
    {
      id: 'intake',
      heading: '1 · Intake',
      body: 'The intake valve opens as the piston travels down, expanding the cylinder like a syringe. The pressure drop pulls a fresh mix of air and fuel (blue) in through the intake port.',
      camera: { position: [-2.4, 3.0, 3.8], target: [-0.1, 2.1, 0] },
      onEnter: ({ handles }) => {
        handles.setReveal(1);
        handles.setLabels(false);
      },
      timeline: cycleLoop(0),
    },
    {
      id: 'compression',
      heading: '2 · Compression',
      body: 'Both valves seal shut. The crank drives the piston back up, squeezing the mixture into a fraction of its volume. Compressing it makes the coming explosion far more violent — and the engine far more efficient.',
      camera: { position: [2.2, 2.8, 3.6], target: [0, 2.0, 0] },
      onEnter: ({ handles }) => {
        handles.setReveal(1);
        handles.setLabels(false);
      },
      timeline: cycleLoop(180),
    },
    {
      id: 'power',
      heading: '3 · Power',
      body: 'At the top of the stroke the spark plug fires. The mixture ignites and the burning gas (orange) expands hard, hammering the piston down. This is the only stroke that actually produces power — the crankshaft stores it as spin.',
      camera: { position: [2.8, 2.1, 4.0], target: [0, 1.9, 0] },
      onEnter: ({ handles }) => {
        handles.setReveal(1);
        handles.setLabels(false);
      },
      timeline: cycleLoop(360),
    },
    {
      id: 'exhaust',
      heading: '4 · Exhaust',
      body: 'The exhaust valve opens and the rising piston shoves the burnt gases (grey) out through the exhaust port. The cylinder is empty again — ready for the next gulp of fresh mixture.',
      camera: { position: [2.6, 3.2, 3.4], target: [0.3, 2.2, 0] },
      onEnter: ({ handles }) => {
        handles.setReveal(1);
        handles.setLabels(false);
      },
      timeline: cycleLoop(540),
    },
    {
      id: 'run',
      heading: 'Run it',
      body: 'All four strokes, over and over — hundreds of times a second in a real engine. Two full crank revolutions per power stroke, with the flywheel smoothing the gaps between bangs.',
      hint: 'Drag to orbit the running engine.',
      camera: { position: [4.4, 2.4, 5.6], target: [0, 1.5, 0] },
      freeOrbit: true,
      onEnter: ({ handles }) => {
        handles.setReveal(1);
        handles.setLabels(false);
      },
      timeline: cycleLoop(0, 2000),
    },
  ],
});
