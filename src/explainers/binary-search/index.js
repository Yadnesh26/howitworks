import meta from './meta.js';
import { buildMachine } from './model.js';
import { defineExplainer } from '../../framework/registry.js';

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildMachine({ scene });
  },

  steps: [
    {
      id: 'the-array',
      heading: 'The Search Space',
      body: 'Binary search finds a target value within a sorted array. Here we have 15 elements, and we are looking for the value **42**.',
      camera: {
        position: [0, 4, 6],
        target: [0, 0, 0],
      },
      onEnter(ctx) {
        ctx.handles.setPhase(0);
        ctx.handles.setLabels(false);
        if (ctx.stage?.bokehPass && ctx.step.camera) {
          ctx.stage.bokehPass.uniforms.focus.value = 6;
          ctx.stage.bokehPass.uniforms.aperture.value = 0.00005;
        }
      },
    },
    {
      id: 'bounds',
      heading: 'Setting the Bounds',
      body: 'First, we place a Left bracket (L) at the start and a Right bracket (R) at the end. The target must be between these bounds.',
      camera: {
        position: [-2, 3, 5],
        target: [0, 0, 0],
      },
      onEnter(ctx) {
        ctx.handles.setPhase(0);
        ctx.handles.setLabels(true);
        if (ctx.stage?.bokehPass && ctx.step.camera) {
          ctx.stage.bokehPass.uniforms.focus.value = 5.3;
          ctx.stage.bokehPass.uniforms.aperture.value = 0.00005;
        }
      },
    },
    {
      id: 'midpoint',
      heading: 'Probing the Midpoint',
      body: 'We drop our scanner exactly in the middle. The value here is 27. Since 27 is less than 42, we know the target MUST be in the right half.',
      camera: {
        position: [0, 1.5, 3],
        target: [0, 0.3, 0],
      },
      onEnter(ctx) {
        ctx.handles.setPhase(0.05);
        ctx.handles.setLabels(true);
        if (ctx.stage?.bokehPass && ctx.step.camera) {
          ctx.stage.bokehPass.uniforms.focus.value = 3.3;
          ctx.stage.bokehPass.uniforms.aperture.value = 0.0003;
        }
      },
    },
    {
      id: 'halving-1',
      heading: 'Discarding the Left Half',
      body: 'We slide the Left bracket past the midpoint to index 8. We just eliminated half the array in a single step.',
      camera: {
        position: [2, 2.5, 4],
        target: [1, 0, 0],
      },
      onEnter(ctx) {
        ctx.handles.setPhase(0.20);
        ctx.handles.setLabels(true);
        if (ctx.stage?.bokehPass && ctx.step.camera) {
          ctx.stage.bokehPass.uniforms.focus.value = 4.7;
          ctx.stage.bokehPass.uniforms.aperture.value = 0.0001;
        }
      },
    },
    {
      id: 'halving-2',
      heading: 'Narrowing In',
      body: 'Probe the new midpoint (48). Too high! Slide the Right bracket down. Probe again (35). Too low! Slide the Left bracket up.',
      camera: {
        position: [2, 3, 5],
        target: [1.5, 0, 0],
      },
      onEnter(ctx) {
        ctx.handles.setPhase(0.40);
        ctx.handles.setLabels(true);
        if (ctx.stage?.bokehPass && ctx.step.camera) {
          ctx.stage.bokehPass.uniforms.focus.value = 5.0;
          ctx.stage.bokehPass.uniforms.aperture.value = 0.0001;
        }
      },
    },
    {
      id: 'found',
      heading: 'Target Locked',
      body: 'The bounds converge on a single tile. The midpoint drops down and confirms: we found 42 in just 4 steps instead of 11!',
      camera: {
        position: [1.5, 1.2, 2.5],
        target: [1.5, 0.3, 0],
      },
      onEnter(ctx) {
        ctx.handles.setPhase(0.65);
        ctx.handles.setLabels(true);
        if (ctx.stage?.bokehPass && ctx.step.camera) {
          ctx.stage.bokehPass.uniforms.focus.value = 2.7;
          ctx.stage.bokehPass.uniforms.aperture.value = 0.0004;
        }
      },
    },
    {
      id: 'loop',
      heading: 'O(log n) Efficiency',
      body: 'Even if we had 4 billion tiles, binary search would find the target in at most 32 steps. It scales logarithmically.',
      camera: {
        position: [3, 4, 6],
        target: [0, 0, 0],
        freeOrbit: true,
      },
      timeline: {
        duration: 8000,
        loop: true,
        update({ progress, handles }) {
          handles.setPhase(progress);
        },
      },
      onEnter(ctx) {
        ctx.handles.setLabels(true);
        if (ctx.stage?.bokehPass && ctx.step.camera) {
          ctx.stage.bokehPass.uniforms.focus.value = 6.7;
          ctx.stage.bokehPass.uniforms.aperture.value = 0.00005;
        }
      },
    },
  ],
});
