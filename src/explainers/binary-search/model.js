import * as THREE from 'three';
import { materials, rod, label, studioPlinth } from '../../framework/parts.js';
import { beveledBox } from '../../framework/geometry.js';
import { clamp01, smooth, win } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// Binary search over a sorted array — the "component" here is data, not a
// physical machine, so this follows the anatomy-first story shape (bare
// component, no shell to peel): a row of 16 numbered tiles on a rail, a
// sliding Low/High bracket pair, and a probe head that drops onto the
// midpoint each comparison.
//
// Reference facts:
//  - Precondition: the array MUST already be sorted — binary search has no
//    way to know which half to discard otherwise.
//  - Canonical loop: mid = lo + floor((hi-lo)/2); compare arr[mid] to the
//    target; equal -> found; less -> lo = mid+1; greater -> hi = mid-1.
//  - Worst case is ceil(log2(n)) comparisons: 16 items -> at most 4 probes,
//    1,000,000 -> at most 20, 4 billion (2^32) -> at most 32. A linear scan
//    of the same 16 items can take up to 16 comparisons.
//
// This build traces a real 16-element search: values below, target 84 at
// index 14, needing the maximum 4 probes (log2(16) = 4) so the O(log n)
// story lands on an exact, checkable number.

const VALUES = [3, 8, 14, 19, 23, 29, 34, 41, 47, 52, 58, 65, 71, 77, 84, 91];
const N = VALUES.length; // 16
const TARGET = 84;
const TARGET_IDX = 14;

const TILE_W = 0.34;
const TILE_H = 0.52;
const TILE_D = 0.08;
const GAP = 0.1;
const PITCH = TILE_W + GAP;
const SPAN = (N - 1) * PITCH + TILE_W;

const PLINTH_H = 0.22;
const RAIL_H = 0.06;
const RAIL_TOP_Y = PLINTH_H + RAIL_H;
const TILE_CENTER_Y = RAIL_TOP_Y + TILE_H / 2;
const TILE_TOP_Y = TILE_CENTER_Y + TILE_H / 2;
const PROBE_START_Y = TILE_TOP_Y + 1.35;

const ACCENT = 0x00e676; // match/found
const AMBER = 0xffab40; // comparison miss, "too low, discard left"
const DIM_COLOR = new THREE.Color(0x232830);

// The 4-probe trace of this exact search (lo/hi are INCLUSIVE bounds).
// lo0/hi0 = bounds entering the probe, lo1/hi1 = bounds leaving it.
const PROBES = [
  { lo0: 0, hi0: 15, mid: 7, lo1: 8, hi1: 15, found: false }, // 41 < 84
  { lo0: 8, hi0: 15, mid: 11, lo1: 12, hi1: 15, found: false }, // 65 < 84
  { lo0: 12, hi0: 15, mid: 13, lo1: 14, hi1: 15, found: false }, // 77 < 84
  { lo0: 14, hi0: 15, mid: 14, lo1: 14, hi1: 14, found: true }, // 84 == 84
];

const lerp = (a, b, t) => a + (b - a) * t;
const triangle = (x) => Math.max(0, 1 - Math.abs(1 - 2 * clamp01(x)));
const tileX = (i) => (i - (N - 1) / 2) * PITCH;

function rangeWeight(i, lo, hi) {
  if (i >= lo && i <= hi) return 1;
  const d = i < lo ? lo - i : i - hi;
  return Math.max(0, 1 - d);
}

function numberTexture(value) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 56px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), 64, 68);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildBinarySearch({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  group.add(studioPlinth({ w: SPAN + 1.3, h: PLINTH_H, d: 1.3, color: 0x14161a }));

  const railMat = materials.brushedSteel(0x9aa4b0);
  railMat.roughness = 0.6; // large flat surface — the preset's roughnessMap alone reads near-chrome
  railMat.anisotropy = 0.7;
  railMat.anisotropyRotation = Math.PI / 2; // grain runs along the rail's length
  const rail = beveledBox(SPAN + 0.5, RAIL_H, 0.42, railMat, 0.02);
  rail.position.y = PLINTH_H + RAIL_H / 2;
  group.add(rail);

  // --- tiles ------------------------------------------------------------
  const labels = calloutSets(['overview', 'pointers']);
  const tiles = [];
  for (let i = 0; i < N; i++) {
    const x = tileX(i);
    const bodyMat = materials.polymer(0x1b1f26);
    const body = beveledBox(TILE_W, TILE_H, TILE_D, bodyMat, 0.015);
    body.position.set(x, TILE_CENTER_Y, 0);
    group.add(body);

    const faceMat = new THREE.MeshStandardMaterial({
      map: numberTexture(VALUES[i]),
      transparent: true,
      depthWrite: false,
      color: 0xaab4c2,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.5,
      metalness: 0,
    });
    faceMat.emissiveMap = faceMat.map;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(TILE_W * 0.72, TILE_H * 0.62), faceMat);
    face.position.set(x, TILE_CENTER_Y, TILE_D / 2 + 0.003);
    group.add(face);

    tiles.push({ i, body, bodyMat, faceMat, baseY: TILE_CENTER_Y });
  }

  // Sorted-order chevrons between tiles — small ambient detail confirming
  // "ascending" without adding a 17th thing to label.
  for (let i = 0; i < N - 1; i++) {
    const chev = new THREE.Mesh(
      new THREE.ConeGeometry(0.02, 0.05, 3),
      materials.chrome(0x6b7480),
    );
    chev.rotation.z = -Math.PI / 2;
    chev.position.set((tileX(i) + tileX(i + 1)) / 2, TILE_CENTER_Y, 0);
    group.add(chev);
  }

  // --- lo/hi bracket markers ---------------------------------------------
  // Lo/Hi are shown as moving markers (narrated in copy) rather than pinned
  // callouts — by definition they sit at the array's extreme edges, exactly
  // where the text panel lives, so no on-screen anchor stays legible there.
  function buildMarker() {
    const g = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x0c1a12,
      emissive: ACCENT,
      emissiveIntensity: 0.55,
      metalness: 0.2,
      roughness: 0.3,
    });
    const post = rod(0.018, 0.34, mat);
    post.position.y = TILE_TOP_Y;
    const flag = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 4), mat);
    flag.rotation.x = Math.PI;
    flag.position.y = TILE_TOP_Y + 0.34 + 0.05;
    g.add(post, flag);
    return g;
  }
  const loMarker = buildMarker();
  const hiMarker = buildMarker();
  group.add(loMarker, hiMarker);

  // --- mid probe head ------------------------------------------------------
  const probeGroup = new THREE.Group();
  group.add(probeGroup);
  const probeMat = new THREE.MeshPhysicalMaterial({
    color: 0x101418,
    emissive: AMBER,
    emissiveIntensity: 0.6,
    metalness: 0.3,
    roughness: 0.25,
  });
  const probeHead = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), probeMat);
  probeGroup.add(probeHead);
  labels.add('pointers', probeGroup, 'Midpoint probe — mid', [0.16, 0, 0], 20, 40);

  const beamMat = new THREE.MeshBasicMaterial({
    color: AMBER,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 8), beamMat);
  group.add(beam);

  // --- found ring ------------------------------------------------------
  const ringMat = new THREE.MeshBasicMaterial({
    color: ACCENT,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const foundRing = new THREE.Mesh(new THREE.TorusGeometry(TILE_W * 0.62, 0.012, 10, 32), ringMat);
  foundRing.position.set(tileX(TARGET_IDX), TILE_CENTER_Y, TILE_D / 2 + 0.05);
  group.add(foundRing);

  // --- target readout ------------------------------------------------------
  const targetLabel = label(`Target: ${TARGET}`, { color: '#00e676', size: 0.22 });
  targetLabel.position.set(0, PROBE_START_Y * 0.62, 0);
  group.add(targetLabel);
  labels.add('overview', targetLabel, 'The value we are looking for', [0, 0.14, 0], 70, 50);
  labels.add(
    'overview',
    tiles[14].body,
    'Sorted array — ascending, no gaps to skip',
    [0, 0.32, 0],
    175,
    55,
  );

  // --- pose --------------------------------------------------------------
  const state = {
    lo: 0,
    hi: N - 1,
    mid: -1,
    midT: 0,
    midColor: AMBER,
    found: -1,
    foundT: 0,
    showTarget: true,
  };

  function apply() {
    loMarker.position.x = tileX(state.lo);
    hiMarker.position.x = tileX(state.hi);
    // .visible, not just opacity: a Sprite's quad still writes depth (and
    // gets read by the post-process AO pass) at opacity 0, leaving a ghost
    // dark rectangle right where the "hidden" text used to be.
    targetLabel.visible = state.showTarget;

    const midVisible = state.midT > 0.01 && state.mid >= 0;
    probeGroup.visible = midVisible;
    beam.visible = midVisible;
    if (midVisible) {
      const mx = tileX(state.mid);
      const dropY = lerp(PROBE_START_Y, TILE_TOP_Y + 0.03, smooth(state.midT));
      probeGroup.position.set(mx, dropY, 0);
      probeMat.emissive.setHex(state.midColor);
      probeMat.emissiveIntensity = 0.35 + 0.6 * state.midT;

      const beamLen = Math.max(0.001, dropY - TILE_TOP_Y);
      beam.position.set(mx, TILE_TOP_Y + beamLen / 2, 0);
      beam.scale.y = beamLen;
      beamMat.color.setHex(state.midColor);
      beamMat.opacity = 0.35 * state.midT;
    }

    tiles.forEach((t) => {
      const w = rangeWeight(t.i, state.lo, state.hi);
      t.body.position.y = t.baseY - 0.05 * (1 - w);
      t.bodyMat.emissive.setHex(ACCENT);
      t.bodyMat.emissiveIntensity = 0.1 * w;
      t.bodyMat.color.copy(w > 0.5 ? new THREE.Color(0x1b1f26) : DIM_COLOR);

      let faceEmissive = 0;
      let faceColor = ACCENT;
      if (t.i === state.mid && state.midT > 0.01) {
        faceEmissive = state.midT * 0.9;
        faceColor = state.midColor;
      }
      if (t.i === state.found) {
        faceEmissive = Math.max(faceEmissive, 0.35 + 0.55 * state.foundT);
        faceColor = ACCENT;
      }
      t.faceMat.emissive.setHex(faceColor);
      t.faceMat.emissiveIntensity = faceEmissive;
      t.faceMat.opacity = 0.35 + 0.65 * w;
    });

    foundRing.material.opacity = state.foundT * 0.9;
  }
  apply();

  // Drive lo/hi/mid/found from the shared PROBES trace, `pulse` a 0->1->0
  // triangle so every step's loop starts and ends on the SAME pose (bounds
  // as they were entering the probe) — the narrowing is only ever shown as
  // a transient "watch it happen" pulse, never a hard cut at the wrap.
  function setProbe(idx, pulse) {
    const p = PROBES[idx];
    Object.assign(state, {
      lo: lerp(p.lo0, p.lo1, pulse),
      hi: lerp(p.hi0, p.hi1, pulse),
      mid: p.mid,
      midT: pulse,
      midColor: p.found ? ACCENT : AMBER,
      found: p.found && pulse > 0.5 ? p.mid : -1,
      foundT: p.found ? clamp01((pulse - 0.3) / 0.7) : 0,
      // Hidden through probes 1-3: the readout sits mid-array and the camera
      // pans right chasing the probe, so it would either collide with the
      // "Midpoint probe" callout or drift off-frame. Only the final probe
      // (the found step) restores it, right where the story needs it.
      showTarget: p.found,
    });
    apply();
  }

  // Full replay for the finale: progress 0..0.8 runs the 4 probes forward in
  // sequence (state persists probe-to-probe, matching the PROBES chain
  // exactly), 0.8..1 is a fast rewind back to the untouched array — landing
  // progress=1 on the identical pose as progress=0, so the loop is seamless.
  function setTrace(progress) {
    if (progress <= 0.8) {
      const seg = clamp01(progress / 0.8) * PROBES.length;
      const idx = Math.min(PROBES.length - 1, Math.floor(seg));
      const local = seg - idx;
      const p = PROBES[idx];
      const t = smooth(local);
      Object.assign(state, {
        lo: lerp(p.lo0, p.lo1, t),
        hi: lerp(p.hi0, p.hi1, t),
        mid: p.mid,
        midT: triangle(local),
        midColor: p.found ? ACCENT : AMBER,
        found: p.found && local > 0.5 ? p.mid : -1,
        foundT: p.found ? clamp01((local - 0.3) / 0.7) : 0,
        showTarget: true,
      });
    } else {
      const t = smooth(win(progress, 0.8, 1));
      const last = PROBES[PROBES.length - 1];
      const first = PROBES[0];
      Object.assign(state, {
        lo: lerp(last.lo1, first.lo0, t),
        hi: lerp(last.hi1, first.hi0, t),
        mid: last.mid,
        midT: (1 - t) * 0.6,
        midColor: ACCENT,
        found: t < 0.3 ? last.mid : -1,
        foundT: Math.max(0, 1 - t * 3),
        showTarget: true,
      });
    }
    apply();
  }

  return {
    group,
    parts: { loMarker, hiMarker, probeGroup, tiles: tiles.map((t) => t.body), foundRing },
    setLabels: labels.setLabels,
    setProbe,
    setTrace,
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
  };
}
