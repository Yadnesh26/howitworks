import * as THREE from 'three';
import { materials, rod, disc, studioPlinth } from '../../framework/parts.js';
import { beveledBox, gear, bladeRing } from '../../framework/geometry.js';
import { clamp01, win, TAU } from '../../framework/motion.js';
import { callout } from '../../framework/labels.js';

// A cylindrical tower air purifier (Levoit/Coway-style) — a sealed product
// shot that peels its side wall to show a 360°-inlet filter cartridge and a
// centrifugal blower at the top.
//
// PROPORTIONS (real towers, e.g. Levoit Core series): height:diameter ~=
// 1.7:1. CAB_H:CAB_R*2 = 1.9:1.1 = 1.73:1, holds that ratio at model scale.
//
// MECHANISM (researched): air is pulled radially inward 360° through — in
// order — a pre-filter mesh (catches hair/large debris), a pleated HEPA H13
// layer (99.97% capture at 0.3 micron via interception/impaction/diffusion),
// and an activated-carbon layer (adsorbs odors/VOCs) wrapped around a hollow
// central core. A centrifugal blower above the cartridge draws that filtered
// air up through the core and flings it out through the top grille. A laser
// PM2.5 sensor feeds an auto mode that scales fan speed to measured
// pollution, shown live on a color-coded LED ring (blue/green/yellow/red).
//
// STATE SCALARS (one pose fn):
//   reveal   - 0 sealed shell -> 1 side wall ghosted, cartridge/fan shown
//   flow     - dust/odor/clean-air dot phase, whole cycles per lap
//   fanSpin  - centrifugal blower angle (rad), whole turns per lap
//   aqi      - 0 (clean) .. 1 (polluted): LED ring color + fan urgency

const clamp01v = clamp01;

// --- one-scale layout --------------------------------------------------------
const CAB_R = 0.55;
const CAB_H = 1.9;
const CAB_Y0 = 0.26; // plinth top
const CAB_Y1 = CAB_Y0 + CAB_H;
const BASE_H = 0.2;
const TOP_H = 0.34;
const SIDE_Y0 = CAB_Y0 + BASE_H;
const SIDE_Y1 = CAB_Y1 - TOP_H;

const CART_Y0 = SIDE_Y0 + 0.06;
const CART_Y1 = SIDE_Y1 - 0.06;
const CART_H = CART_Y1 - CART_Y0;
const CART_MIDY = (CART_Y0 + CART_Y1) / 2;

const MESH_R = 0.46; // pre-filter sock, outermost
const HEPA_TIP_R = 0.44;
const HEPA_ROOT_R = 0.34;
const CARBON_R = 0.31; // fits just inside the HEPA ring's bore
const CORE_R = 0.16; // hollow center — the rising clean-air path

const FAN_Y = SIDE_Y1 + 0.12;
const FAN_R = 0.34;

export function buildPurifier({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // --- materials ----------------------------------------------------------
  const shellMat = materials.polymer(0xeef1f0);
  const capMat = materials.polymer(0x23262a);
  const meshMat = new THREE.MeshPhysicalMaterial({
    color: 0xc4cac8,
    metalness: 0,
    roughness: 0.6,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const hepaMat = materials.paintedMetal(0xf2f0e6);
  // paintedMetal's default metalness (0.25) picked up a cool chrome-like
  // sheen from the studio HDRI at the steep top-down cutaway angle, reading
  // as turbine blades instead of pleated filter paper (reviewer-caught) —
  // HEPA media is paper/polypropylene, not metal, so it should barely be
  // metallic at all
  hepaMat.metalness = 0.04;
  hepaMat.roughness = 0.8;
  hepaMat.clearcoat = 0.1;
  hepaMat.side = THREE.DoubleSide;
  const carbonMat = materials.rubber(0x1a1917);
  carbonMat.roughness = 0.85;
  carbonMat.side = THREE.DoubleSide;
  const coreTubeMat = materials.aluminum(0xd0d5d6);
  const fanMat = materials.brushedSteel(0xc9cfce);
  fanMat.roughness = 0.7;
  // the two cartridge-cutaway steps look almost straight down at this flat
  // grille — a near-mirror viewing angle that turned brushed-steel's grain
  // highlight into a blown streak (reviewer-caught: clipping gate failed)
  const grilleMat = materials.brushedSteel(0xb6bcbb);
  grilleMat.roughness = 0.88;
  const sensorMat = materials.paintedMetal(0x2c3430);
  const ledGlow = materials.glow(0x5fd88a, 1.4);
  const buttonMat = materials.rubber(0x2a2d2b);

  // --- plinth ---------------------------------------------------------------
  const plinth = studioPlinth({ w: 2.6, d: 2.0 });
  group.add(plinth);

  const shellFront = []; // ghosts on reveal (side wall only)
  const internals = []; // hidden until revealed

  // ============================================================================
  //  SHELL: base cap + side wall (ghosts) + top cap/grille — always-visible
  //  caps sandwich the one part that peels away, per the reveal convention.
  // ============================================================================
  const baseCap = new THREE.Mesh(
    new THREE.CylinderGeometry(CAB_R, CAB_R * 0.97, BASE_H, 48),
    capMat,
  );
  baseCap.position.y = CAB_Y0 + BASE_H / 2;
  group.add(baseCap);

  const sideWall = new THREE.Mesh(
    new THREE.CylinderGeometry(CAB_R, CAB_R, SIDE_Y1 - SIDE_Y0, 48, 1, true),
    shellMat,
  );
  sideWall.position.y = (SIDE_Y0 + SIDE_Y1) / 2;
  shellFront.push(sideWall);
  group.add(sideWall);

  // fine 360 deg intake slots cut into the side wall's own material tone —
  // decorative ribs (always visible even ghosted, they're part of the shell)
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * TAU;
    const slot = beveledBox(0.012, (SIDE_Y1 - SIDE_Y0) * 0.7, 0.006, capMat, 0.003);
    slot.position.set(Math.cos(a) * (CAB_R + 0.002), (SIDE_Y0 + SIDE_Y1) / 2, Math.sin(a) * (CAB_R + 0.002));
    slot.rotation.y = -a;
    group.add(slot);
  }

  // top cap with real exit-grille slot holes (an actual opening, per the
  // pre-flight rule — a solid disc a moving part would pass through is wrong)
  const grilleShape = new THREE.Shape();
  grilleShape.absarc(0, 0, CAB_R * 0.97, 0, TAU, false);
  const grilleSlots = 24;
  for (let i = 0; i < grilleSlots; i++) {
    const a = (i / grilleSlots) * TAU;
    const rMid = CAB_R * 0.62;
    const w = 0.05;
    const len = CAB_R * 0.52;
    const hole = new THREE.Path();
    const nx = Math.cos(a);
    const nz = Math.sin(a);
    const tx = -Math.sin(a);
    const tz = Math.cos(a);
    const cx = nx * rMid;
    const cz = nz * rMid;
    hole.moveTo(cx + tx * len * 0.5, cz + tz * len * 0.5);
    hole.lineTo(cx - tx * len * 0.5, cz - tz * len * 0.5);
    hole.lineTo(cx - tx * len * 0.5 + nx * w, cz - tz * len * 0.5 + nz * w);
    hole.lineTo(cx + tx * len * 0.5 + nx * w, cz + tz * len * 0.5 + nz * w);
    hole.closePath();
    grilleShape.holes.push(hole);
  }
  const grille = new THREE.Mesh(
    new THREE.ExtrudeGeometry(grilleShape, { depth: 0.03, bevelEnabled: false, curveSegments: 24 }),
    grilleMat,
  );
  grille.rotation.x = -Math.PI / 2;
  grille.position.y = CAB_Y1 - 0.03;
  group.add(grille);

  // its own material instance (not the shared capMat) — this wall ghosts
  // together with the side wall, and must not drag the always-opaque base
  // cap's material down with it
  const topRimMat = materials.polymer(0x23262a);
  const topRim = new THREE.Mesh(new THREE.CylinderGeometry(CAB_R, CAB_R * 0.97, TOP_H - 0.03, 48, 1, true), topRimMat);
  topRim.position.y = SIDE_Y1 + (TOP_H - 0.03) / 2;
  shellFront.push(topRim);
  group.add(topRim);

  // LED air-quality ring — sits at the side-wall / top-cap seam
  const ledRing = new THREE.Mesh(new THREE.TorusGeometry(CAB_R - 0.01, 0.02, 10, 56), ledGlow.clone());
  ledRing.rotation.x = Math.PI / 2;
  ledRing.position.y = SIDE_Y1 + 0.015;
  group.add(ledRing);

  // control button, front of the base cap
  const button = disc(0.05, 0.012, buttonMat, 24);
  button.rotation.x = Math.PI / 2;
  button.position.set(0, CAB_Y0 + BASE_H * 0.55, CAB_R * 0.9);
  group.add(button);

  // ============================================================================
  //  FILTER CARTRIDGE (concentric layers, revealed only)
  // ============================================================================
  const cartGroup = new THREE.Group();
  group.add(cartGroup);

  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(MESH_R, MESH_R, CART_H, 40, 1, true), meshMat);
  mesh.position.y = CART_MIDY;
  cartGroup.add(mesh);
  internals.push(mesh);

  // pleated HEPA media — reuse the gear() tooth profile (a high tooth-count
  // zigzag between root/tip radii reads as pleated filter media) extruded
  // along its "thickness" axis, then stood upright.
  const pleats = gear(
    { teeth: 40, radius: HEPA_TIP_R, thickness: CART_H, toothDepth: HEPA_TIP_R - HEPA_ROOT_R, holeR: HEPA_ROOT_R * 0.94 },
    hepaMat,
  );
  pleats.rotation.x = -Math.PI / 2;
  pleats.position.y = CART_MIDY;
  cartGroup.add(pleats);
  internals.push(pleats);

  // activated-carbon layer — a hollow tube (annulus) around the central core
  const carbonShape = new THREE.Shape();
  carbonShape.absarc(0, 0, CARBON_R, 0, TAU, false);
  const coreHole = new THREE.Path();
  coreHole.absarc(0, 0, CORE_R, 0, TAU, true);
  carbonShape.holes.push(coreHole);
  const carbon = new THREE.Mesh(
    new THREE.ExtrudeGeometry(carbonShape, { depth: CART_H, bevelEnabled: false, curveSegments: 36 }),
    carbonMat,
  );
  carbon.geometry.translate(0, 0, -CART_H / 2);
  carbon.rotation.x = -Math.PI / 2;
  carbon.position.y = CART_MIDY;
  cartGroup.add(carbon);
  internals.push(carbon);

  // hollow core liner — a thin bright tube, the "rising clean air" path
  const coreTube = new THREE.Mesh(new THREE.CylinderGeometry(CORE_R * 0.94, CORE_R * 0.94, CART_H, 28, 1, true), coreTubeMat);
  coreTube.position.y = CART_MIDY;
  coreTube.material.side = THREE.DoubleSide;
  cartGroup.add(coreTube);
  internals.push(coreTube);

  // top/bottom cartridge caps — THREE separate concentric rings (not one
  // uniform disc) so looking down into the cartridge from above genuinely
  // shows the layer stack: mesh -> HEPA -> carbon -> hollow core, like a
  // real cutaway, rather than a single flat color hiding them all.
  function capRing(outerR, innerR, y, mat) {
    const r = new THREE.Mesh(new THREE.RingGeometry(innerR, outerR, 40), mat);
    r.rotation.x = -Math.PI / 2;
    r.position.y = y;
    cartGroup.add(r);
    internals.push(r);
  }
  for (const ry of [CART_Y0, CART_Y1]) {
    capRing(MESH_R, HEPA_TIP_R, ry, meshMat);
    capRing(HEPA_TIP_R, CARBON_R, ry, hepaMat);
    capRing(CARBON_R, CORE_R * 0.94, ry, carbonMat);
  }

  // PM2.5 laser particle sensor — small module low on the inside wall
  const sensorGroup = new THREE.Group();
  sensorGroup.position.set(0, CART_Y0 + 0.05, CAB_R - 0.14);
  const sensorBody = beveledBox(0.09, 0.07, 0.06, sensorMat, 0.01);
  sensorGroup.add(sensorBody);
  const sensorLens = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 10), materials.glow(0xff5a3c, 0.9));
  sensorLens.position.set(0, 0, 0.032);
  sensorGroup.add(sensorLens);
  group.add(sensorGroup);
  internals.push(sensorGroup);

  // ============================================================================
  //  CENTRIFUGAL BLOWER (top chamber)
  // ============================================================================
  const fan = bladeRing(
    { blades: 11, hubR: 0.06, span: FAN_R - 0.06, chord: 0.09, chordTip: 0.11, camber: 0.14, twist: 0.5, twistTip: 0.5, hubDepth: 0.05 },
    fanMat,
  );
  fan.group.rotation.x = -Math.PI / 2;
  fan.group.position.y = FAN_Y;
  group.add(fan.group);
  internals.push(fan.group);

  // ============================================================================
  //  FLOW VISUALIZATION — debris/dust/odor caught radially, clean air rises
  //  and exits. All share the phase clock `flow`; only visible once revealed.
  // ============================================================================
  function makeDots(count, color, size) {
    const geo = new THREE.SphereGeometry(size, 10, 8);
    const g = new THREE.Group();
    const dots = [];
    for (let i = 0; i < count; i++) {
      const mat = materials.glow(color, 1.1);
      mat.transparent = true;
      mat.depthWrite = false;
      const dot = new THREE.Mesh(geo, mat);
      g.add(dot);
      dots.push({ mesh: dot, seed: i / count });
    }
    group.add(g);
    internals.push(g);
    return dots;
  }
  const debrisDots = makeDots(16, 0xb08a5a, 0.02); // large debris, caught at the mesh
  const dustDots = makeDots(16, 0xaeb4b2, 0.014); // fine dust, caught at the HEPA pleats
  const odorDots = makeDots(10, 0xd8d24a, 0.016); // odor/VOC molecules, absorbed by carbon
  const cleanDots = makeDots(14, 0x8fe3c2, 0.016); // filtered air, rising and exiting

  const lerp = (a, b, t) => a + (b - a) * t;

  function placeRadial(dots, outerR, innerR, yBase, yJitter) {
    dots.forEach(({ mesh, seed }, i) => {
      const t = (globalFlow + seed) % 1;
      const angle = seed * TAU * 3.1 + i; // spread azimuths, deterministic
      const travel = win(t, 0, 0.4);
      const r = lerp(outerR, innerR, travel);
      const y = yBase + ((i % 5) / 5) * yJitter;
      mesh.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
      const fadeIn = win(t, 0, 0.08);
      const fadeOut = 1 - win(t, 0.42, 0.5);
      mesh.material.opacity = clamp01v(fadeIn * fadeOut) * 0.9;
    });
  }

  let globalFlow = 0;

  function placeClean() {
    cleanDots.forEach(({ mesh, seed }, i) => {
      const t = (globalFlow * 1.4 + seed) % 1;
      const angle = seed * TAU * 2.3 + i * 0.7 + fanAngleRef.a * 0.15;
      if (t < 0.55) {
        const rise = win(t, 0, 0.55);
        const y = lerp(CART_Y0 + 0.05, FAN_Y, rise);
        const r = CORE_R * 0.55;
        mesh.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
        mesh.material.opacity = clamp01v(win(t, 0, 0.1)) * 0.95;
      } else {
        const out = win(t, 0.55, 1);
        const r = lerp(CORE_R * 0.6, CAB_R * 1.25, out);
        const y = lerp(FAN_Y, CAB_Y1 + 0.28, out);
        mesh.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
        mesh.material.opacity = clamp01v(1 - win(t, 0.75, 1)) * 0.95;
      }
    });
  }
  const fanAngleRef = { a: 0 };

  // ============================================================================
  //  CALLOUTS
  // ============================================================================
  const setsOf = { exterior: [], filter: [], carbon: [], fan: [], sensor: [] };
  function addCallout(set, parent, text, offset, dir, len) {
    const c = callout(text, { dir, len });
    c.position.set(...offset);
    parent.add(c);
    c.visible = false;
    setsOf[set].push(c);
  }
  addCallout('exterior', group, 'Air inlet — 360° intake', [CAB_R, (SIDE_Y0 + SIDE_Y1) / 2, 0], -30, 66);
  addCallout('exterior', group, 'Clean-air outlet', [0, CAB_Y1, CAB_R * 0.5], 55, 62);
  addCallout('exterior', group, 'LED air-quality ring', [CAB_R * 0.75, SIDE_Y1 + 0.02, CAB_R * 0.75], 45, 66);
  addCallout('exterior', group, 'Control button', [0, CAB_Y0 + BASE_H * 0.55, CAB_R], -60, 56);

  addCallout('filter', group, 'Pre-filter mesh — traps hair & debris', [MESH_R, CART_Y0 + CART_H * 0.55, 0], 150, 90);
  addCallout('filter', group, 'HEPA H13 — 99.97% at 0.3 micron', [HEPA_TIP_R * 0.4, CART_Y1, HEPA_TIP_R * 0.4], 55, 88);

  addCallout('carbon', group, 'Activated carbon — adsorbs odors & VOCs', [CARBON_R * 0.5, CART_Y1, CARBON_R * 0.5], 40, 92);
  addCallout('carbon', group, 'Hollow core — clean air rises here', [CORE_R * 0.5, CART_Y1, CORE_R * 0.5], -70, 76);

  addCallout('fan', group, 'Centrifugal blower', [FAN_R * 0.7, FAN_Y, FAN_R * 0.7], 45, 70);

  addCallout('sensor', group, 'Laser particle sensor (PM2.5)', [0, CART_Y0 + 0.05, CAB_R - 0.14], -50, 84);
  addCallout('sensor', group, 'LED air-quality ring', [CAB_R * 0.75, SIDE_Y1 + 0.02, CAB_R * 0.75], 45, 66);

  // ============================================================================
  //  POSE
  // ============================================================================
  const state = { reveal: 0, flow: 0, fanSpin: 0, aqi: 0.15 };
  const ledStops = [
    { at: 0, color: new THREE.Color(0x4fb0ff) }, // clean — blue
    { at: 0.33, color: new THREE.Color(0x5fd88a) }, // good — green
    { at: 0.66, color: new THREE.Color(0xe8c94a) }, // moderate — yellow
    { at: 1, color: new THREE.Color(0xe8523c) }, // poor — red
  ];
  const ledTmp = new THREE.Color();
  function ledColorAt(aqi) {
    const a = clamp01v(aqi);
    for (let i = 0; i < ledStops.length - 1; i++) {
      const s0 = ledStops[i];
      const s1 = ledStops[i + 1];
      if (a <= s1.at) return ledTmp.copy(s0.color).lerp(s1.color, (a - s0.at) / (s1.at - s0.at));
    }
    return ledTmp.copy(ledStops[ledStops.length - 1].color);
  }

  function apply() {
    globalFlow = state.flow;
    fanAngleRef.a = state.fanSpin;
    fan.group.rotation.z = -state.fanSpin;

    const c = ledColorAt(state.aqi);
    ledRing.material.color.copy(c);
    ledRing.material.emissive.copy(c);
    ledRing.material.emissiveIntensity = 1.2 + 0.2 * Math.sin(state.flow * TAU * 4);

    placeRadial(debrisDots, CAB_R - 0.06, MESH_R, CART_Y0 + 0.05, CART_H - 0.1);
    placeRadial(dustDots, MESH_R, HEPA_ROOT_R + 0.01, CART_Y0 + 0.08, CART_H - 0.16);
    placeRadial(odorDots, HEPA_ROOT_R, CARBON_R + 0.01, CART_Y0 + 0.1, CART_H - 0.2);
    placeClean();

    const r = clamp01v(state.reveal);
    for (const m of shellFront) {
      const mat = m.material;
      mat.transparent = r > 0.02;
      mat.opacity = 1 - r * 0.9;
      mat.depthWrite = r < 0.4;
      mat.clearcoat = r > 0.5 ? 0 : 0.15;
    }
    for (const o of internals) o.visible = r > 0.5;
  }
  apply();

  function setLabels(mode) {
    for (const [k, arr] of Object.entries(setsOf)) {
      for (const cc of arr) cc.visible = k === mode;
    }
  }

  return {
    group,
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setLabels,
    parts: { fan: fan.group, cartGroup, ledRing },
  };
}
