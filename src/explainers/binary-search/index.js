import meta from './meta.js';
import { buildBinarySearch } from './model.js';
import { defineExplainer } from '../../framework/registry.js';

// Anatomy-first story (bare data structure, no shell to peel): overview,
// then the two bounds, then one probe per step tracing a real 16-element
// search for 84, found on the 4th probe (log2(16) = 4, the worst case for
// this size) — then a fast full-speed replay. Every step's local `pulse`
// (or the finale's `progress`) starts and ends its lap at midT = 0 / the
// step's entering bounds, so the wrap is invisible.

const AMBER = 0xffab40;

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildBinarySearch({ scene });
  },

  steps: [
    {
      id: 'overview',
      heading: '1 · A sorted haystack',
      body: 'Sixteen values, strictly ascending, sitting in a row. That single property — sorted — is the whole trick: because every value bigger than X sits to its right and every value smaller sits to its left, we never have to check them one by one.',
      hint: 'Drag to orbit.',
      camera: { position: [-0.8, 3.9, 7.9], target: [-0.8, 0.65, 0] },
      focus: ['Sorted array — ascending, no gaps to skip'],
      dofAperture: 0.00002,
      onEnter: ({ handles }) => handles.setLabels('overview'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 7000,
          ease: 'linear',
          onUpdate: () => {
            const pos = s.t * 16;
            const idx = Math.min(15, Math.floor(pos));
            const local = pos - idx;
            const midT = Math.max(0, 1 - Math.abs(1 - 2 * local)) * 0.55;
            handles.set({
              lo: 0,
              hi: 15,
              mid: idx,
              midT,
              midColor: AMBER,
              found: -1,
              foundT: 0,
              showTarget: true,
            });
          },
        });
      },
    },
    {
      id: 'bounds',
      heading: '2 · Low and high',
      body: 'Binary search tracks two bounds: lo starts at the first index, hi at the last. The target — if it exists in the array at all — is guaranteed to be somewhere between them. Every comparison that follows exists to move one of these two markers.',
      camera: { position: [1.96, 2.99, 7.68], target: [-0.8, 0.65, 0] },
      focus: [],
      dofAperture: 0.00003,
      onEnter: ({ handles }) => handles.setLabels('overview'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 7000,
          ease: 'linear',
          onUpdate: () => {
            const pos = s.t * 16;
            const idx = Math.min(15, Math.floor(pos));
            const local = pos - idx;
            const midT = Math.max(0, 1 - Math.abs(1 - 2 * local)) * 0.4;
            handles.set({
              lo: 0,
              hi: 15,
              mid: idx,
              midT,
              midColor: AMBER,
              found: -1,
              foundT: 0,
              showTarget: true,
            });
          },
        });
      },
    },
    {
      id: 'probe-1',
      heading: '3 · Probe 1 — check the middle',
      body: 'Jump straight to the midpoint, index 7, value 41. Comparing it to our target, 84: 41 is smaller, so the target — if present — must be to the right. Every value at index 7 and below, eight of the sixteen, is eliminated in this one comparison.',
      camera: { position: [-0.1, 1.9, 3.6], target: [-0.8, 0.75, 0] },
      focus: ['Midpoint probe — mid'],
      dofAperture: 0.00015,
      onEnter: ({ handles }) => handles.setLabels('pointers'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4200,
          ease: 'linear',
          onUpdate: () => handles.setProbe(0, s.t),
        });
      },
    },
    {
      id: 'probe-2',
      heading: '4 · Probe 2 — halve again',
      body: 'lo jumps straight to 8 — no need to re-check anything we just discarded. New midpoint: index 11, value 65. Still smaller than 84, so the left half of what remains is thrown away too. Two comparisons in, and we have already ruled out twelve of the sixteen values.',
      camera: { position: [1.3, 2.0, 3.4], target: [0.7, 0.75, 0] },
      focus: ['Midpoint probe — mid'],
      dofAperture: 0.00015,
      onEnter: ({ handles }) => handles.setLabels('pointers'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4200,
          ease: 'linear',
          onUpdate: () => handles.setProbe(1, s.t),
        });
      },
    },
    {
      id: 'probe-3',
      heading: '5 · Probe 3 — down to two',
      body: 'Midpoint 13, value 77 — still under 84. lo advances to 14. Only two tiles remain in play: index 14 and 15. Three comparisons have done the work that would have taken a plain left-to-right scan up to fourteen.',
      camera: { position: [2.0, 1.7, 2.8], target: [1.7, 0.75, 0] },
      focus: ['Midpoint probe — mid'],
      dofAperture: 0.0002,
      onEnter: ({ handles }) => handles.setLabels('pointers'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4000,
          ease: 'linear',
          onUpdate: () => handles.setProbe(2, s.t),
        });
      },
    },
    {
      id: 'found',
      heading: '6 · Probe 4 — found',
      body: 'Midpoint 14, value 84. A match. Sixteen values, four comparisons — exactly log2(16), the worst case this array size can ever demand. Scale the array up to a million entries and the worst case only grows to about twenty comparisons; a plain scan could need all million.',
      camera: { position: [2.5, 1.4, 2.1], target: [2.3, 0.8, 0] },
      focus: [],
      dofAperture: 0.0004,
      onEnter: ({ handles }) => handles.setLabels(false),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4200,
          ease: 'linear',
          onUpdate: () => handles.setProbe(3, s.t),
        });
      },
    },
    {
      id: 'run',
      heading: '7 · O(log n) — why it scales',
      body: 'Every extra comparison lets binary search discard HALF of whatever is left, not a fixed chunk — so the work needed grows logarithmically, not linearly, with the size of the data. At 4 billion sorted items (2^32), the worst case is still only 32 comparisons. This is the same idea behind `git bisect` hunting down which of thousands of commits broke a build.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [-0.8, 3.9, 8.14], target: [-0.8, 0.65, 0] },
      freeOrbit: true,
      focus: [],
      dofAperture: 0.00002,
      onEnter: ({ handles }) => handles.setLabels(false),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5200,
          ease: 'linear',
          onUpdate: () => handles.setTrace(s.t),
        });
      },
    },
  ],
});
