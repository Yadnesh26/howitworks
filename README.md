# whatdstuff

Interactive 3D explainers where **scroll drives the machine**. Built with
[Three.js](https://threejs.org) (rendering) and [anime.js v4](https://animejs.com)
(scroll-synced animation).

## Run

```sh
npm install
npm run dev      # http://localhost:5174
npm run build    # static site in dist/
```

## Author your own explainer

An explainer is one folder in `src/explainers/`. Copy `table-fan/` as a
template — it's the simplest one.

**1. Build a model** (`model.js`): plain Three.js. Use the shared toolkit in
`src/framework/parts.js` (`materials`, `rod`, `box`, `disc`, `arrow`, `label`)
so it matches the family look. Return "handles" — functions the steps will
call to pose your machine, e.g. `setCycle(angle)`.

**2. Define the story** (`index.js`):

```js
import { defineExplainer } from '../../framework/index.js';
import { buildThing } from './model.js';

export default defineExplainer({
  id: 'my-thing',                 // becomes the URL: /my-thing
  title: 'How a Thing Works',
  summary: 'Shown on the library card.',
  accent: '#8fd3ff',
  buildScene: ({ scene }) => buildThing({ scene }),
  steps: [
    {
      heading: 'Step title',
      body: 'Step text…',
      camera: { position: [x, y, z], target: [x, y, z] }, // fly-to on enter
      timeline: ({ tl, handles }) => {
        // this timeline's progress == scroll progress through the step
        tl.add(stateObj, { value: [0, 1], duration: 1000, onUpdate: ... });
      },
      // optional:
      // mode: 'loop'      → timeline plays continuously while step is active
      // freeOrbit: true   → user can drag to orbit
      // onEnter({handles, stage}) → toggle labels etc.
      // hint: 'small accent line under the body text'
    },
  ],
});
```

**3. Register it** — add one import in `src/main.js`:

```js
import './explainers/my-thing/index.js';
```

That's it: the framework gives you the page, scroll sync, camera direction,
progress rail and library card for free.

## How the framework works

| Module | Role |
| --- | --- |
| `framework/stage.js` | Renderer, camera, lights, environment, shadow floor, render loop |
| `framework/player.js` | Page layout, step activation (camera fly-tos, panels, rail), lifecycle |
| `framework/scroll.js` | anime.js `onScroll` scroll-scrubbed timelines |
| `framework/parts.js` | Shared materials + primitive helpers for model authors |
| `framework/registry.js` | `defineExplainer()` catalog that powers the homepage |
