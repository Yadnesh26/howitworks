import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// DOM callout label: anchor dot + curved hairline leader + text pill, rendered
// by the stage's CSS2DRenderer — crisp at any DPI, styled by site CSS.
//
// `dir` is the leader direction in screen degrees (0 = right, 90 = up),
// `len` its length in px. Attach to any Object3D — including moving parts;
// the label follows the part's world position.
//
// The base (dir, len) is stashed on the element so the per-frame declutter pass
// (label-layout.js) can reset to it before re-resolving overlaps — otherwise
// nudges would compound frame over frame.
export function callout(text, { dir = 45, len = 48, key } = {}) {
  const root = document.createElement('div');
  root.className = 'callout';
  root.style.pointerEvents = 'none';

  // SVG (not a straight rotated div) so the leader can bow into a gentle
  // curve — a ruler-straight line is the single biggest "programmer's demo"
  // tell against SOUL.md's product-shot bar. `overflow: visible` lets the
  // path draw outside the nominal 1x1 box.
  const line = document.createElementNS(SVG_NS, 'svg');
  line.setAttribute('class', 'callout-line');
  line.setAttribute('width', '1');
  line.setAttribute('height', '1');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('class', 'callout-line-path');
  line.appendChild(path);

  const tx = document.createElement('span');
  tx.className = 'callout-text';
  tx.textContent = text;

  root.append(line, tx);
  root.dataset.baseDir = String(dir);
  root.dataset.baseLen = String(len);
  root.dataset.key = key ?? text; // matched by step.focus to pulse the active part
  setLeader(root, dir, len);
  const obj = new CSS2DObject(root);
  // live readouts (#17): drive from the model's pose fn to show values that
  // update in real time (RPM, current stroke, pressure). Cheap — just text.
  obj.setText = (s) => {
    tx.textContent = s;
  };
  return obj;
}

// Point a callout's leader at (dir°, len px) from its anchor and hang the pill
// off the far end. Shared by callout() and the declutter pass so the geometry
// stays consistent.
export function setLeader(root, dir, len) {
  const path = root.querySelector('.callout-line-path');
  const tx = root.querySelector('.callout-text');
  const rad = (dir * Math.PI) / 180;
  const ex = Math.cos(rad) * len;
  const ey = -Math.sin(rad) * len;
  // Bow the midpoint off the straight chord, perpendicular to the leader —
  // reads as a hand-set engineering leader instead of a ruled line. The
  // perpendicular is derived from (ex,ey) itself (not from dir directly) so
  // the bow's handedness stays consistent under declutter's horizontal
  // mirroring, which flips ex but re-derives ey unchanged.
  if (len > 1) {
    const bow = Math.min(len * 0.22, 14);
    const nx = -ey / len;
    const ny = ex / len;
    const mx = ex * 0.5 + nx * bow;
    const my = ey * 0.5 + ny * bow;
    path.setAttribute('d', `M0,0 Q${mx.toFixed(1)},${my.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`);
  } else {
    path.setAttribute('d', `M0,0 L${ex.toFixed(1)},${ey.toFixed(1)}`);
  }
  tx.style.left = `${ex}px`;
  tx.style.top = `${ey}px`;
  tx.style.transform =
    Math.cos(rad) >= 0 ? 'translate(4px, -50%)' : 'translate(calc(-100% - 4px), -50%)';
}
