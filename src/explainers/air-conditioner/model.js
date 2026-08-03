import * as THREE from 'three';
import { materials, box, arrow } from '../../framework/parts.js';
import { beveledBox, bladeRing, chainPath } from '../../framework/geometry.js';
import { callout } from '../../framework/labels.js';

// A split-system air conditioner, staged like the classic cutaway diagram:
// indoor wall unit on top (evaporator + cross-flow blower), outdoor unit
// below (compressor + condenser coil + axial fan), connected by the line set.
//
// The refrigerant rides ONE chained path — discharge → condenser serpentine →
// filter drier → capillary tube → liquid line → evaporator serpentine →
// suction line — and every phase boundary comes from the chain's real
// arc-length fractions (handles.phases), so the scroll steps stay exact even
// if the plumbing is re-routed.

const hotGas = new THREE.Color(0xff5a2e);
const warmLiq = new THREE.Color(0xd0392a);
const cold = new THREE.Color(0x3fa0ff);
const coolGas = new THREE.Color(0x8fe3ff);

export function buildAirConditioner({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // the indoor casing is moulded plastic, not painted metal — paintedMetal's
  // full clearcoat reads as wet/cheap on an appliance shell (polish-explainer
  // rung 2); the outdoor cabinet is real sheet steel, so it keeps paintedMetal.
  const white = materials.polymer(0xe8ecef);
  const lightGray = materials.paintedMetal(0xcfd5da);
  // anisoSteel: drawn-tube brushing grain runs along the pipe's length;
  // TubeGeometry's V axis runs along the length, so rotation=PI/2 aligns the
  // highlight stretch with the grain (validated visually, see parts.js).
  const copper = materials.anisoSteel(0xc07a3c, Math.PI / 2);
  const alumFin = materials.aluminum(0xaeb9c4);
  alumFin.roughness = 0.75; // fin packs are matte — no softbox streaks
  const dark = materials.darkMetal(0x2b3037);

  // --- ground + base ----------------------------------------------------------
  const base = beveledBox(4.6, 0.16, 3.4, materials.grimyAluminum(0x2e333b), 0.035);
  base.position.set(0, 0.08, -0.35);
  group.add(base);

  // =============================== OUTDOOR UNIT ===============================
  // Sits WELL BEHIND the indoor unit (z ≈ -0.9) — the other side of the wall,
  // like a real install; the line set travels back to reach it. Coil faces
  // the room side (+Z), fan exhausts away (-Z). Right side left open
  // (cutaway) so the compressor stays visible.
  const ODZ = -0.9; // outdoor unit z center
  const pan = beveledBox(2.0, 0.1, 0.78, materials.grimyAluminum(0x565e69), 0.03);
  pan.position.set(0.2, 0.27, ODZ);
  const topCover = beveledBox(2.0, 0.08, 0.78, lightGray, 0.03);
  topCover.position.set(0.2, 1.42, ODZ);
  const leftPanel = beveledBox(0.06, 1.12, 0.75, lightGray, 0.02);
  leftPanel.position.set(-0.77, 0.85, ODZ);
  group.add(pan, topCover, leftPanel);

  // exhaust face on the FAR side (-Z): panel strips framing the fan opening —
  // the unit blows its hot air away from the room
  const frontRight = beveledBox(0.85, 1.08, 0.05, lightGray, 0.02);
  frontRight.position.set(0.775, 0.86, ODZ - 0.355);
  const frontTop = beveledBox(1.16, 0.14, 0.05, lightGray, 0.02);
  frontTop.position.set(-0.22, 1.33, ODZ - 0.355);
  const frontBottom = beveledBox(1.16, 0.28, 0.05, lightGray, 0.02);
  frontBottom.position.set(-0.22, 0.46, ODZ - 0.355);
  group.add(frontRight, frontTop, frontBottom);

  // axial fan behind a wire grille, exhausting -Z
  const fan = bladeRing(
    { blades: 5, hubR: 0.07, span: 0.32, chord: 0.2, chordTip: 0.24, camber: 0.12, twist: 0.9, twistTip: 0.45, hubDepth: 0.08 },
    materials.paintedMetal(0x3a424c),
  );
  fan.group.rotation.y = Math.PI;
  fan.group.position.set(-0.1, 0.9, ODZ - 0.24);
  group.add(fan.group);
  const grille = new THREE.Group();
  for (const r of [0.14, 0.26, 0.38]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 8, 40), materials.steel(0xb9c0c8));
    grille.add(ring);
  }
  for (let i = 0; i < 8; i++) {
    const spoke = box(0.012, 0.8, 0.012, materials.steel(0xb9c0c8));
    spoke.rotation.z = (i * Math.PI) / 8;
    grille.add(spoke);
  }
  grille.position.set(-0.1, 0.9, ODZ - 0.395);
  group.add(grille);

  // compressor: black hermetic dome on rubber feet, right bay
  const CZ = ODZ + 0.28; // room-facing coil plane of the outdoor unit
  const compressor = new THREE.Group();
  compressor.position.set(0.85, 0.32, ODZ);
  const compBody = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.5, 28), materials.paintedMetal(0x23282f));
  compBody.castShadow = true;
  compBody.position.y = 0.3;
  const compDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    materials.paintedMetal(0x23282f),
  );
  compDome.position.y = 0.55;
  compressor.add(compBody, compDome);
  for (const [fx, fz] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.06, 10), materials.rubber());
    foot.position.set(fx, 0.02, fz);
    compressor.add(foot);
  }
  const terminalBox = beveledBox(0.1, 0.09, 0.06, dark, 0.01);
  terminalBox.position.set(0.17, 0.35, 0.1);
  compressor.add(terminalBox);
  group.add(compressor);

  // service valves on the room-facing side, where the line set lands
  for (const vy of [0.42, 0.56]) {
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.09, 10), materials.brushedSteel(0xcaa14a));
    valve.rotation.z = Math.PI / 2;
    valve.position.set(1.22, vy, CZ);
    group.add(valve);
  }

  // condenser: fin pack forming the face toward the viewer — the unit points
  // AWAY from the room (fan exhausts -Z), opposite to the indoor unit, so
  // hot and cold air visibly leave in opposite directions
  const condFins = new THREE.Group();
  for (let i = 0; i < 40; i++) {
    const fin = box(0.02, 0.62, 0.14, alumFin);
    fin.position.set(-0.62 + (i / 39) * 1.1, 0.94, CZ);
    condFins.add(fin);
  }
  group.add(condFins);

  // ================================ INDOOR UNIT ================================
  // wall patch behind it, casing open at the front so coil + blower read.
  // Distinct warm matte paint tone (not paintedMetal's glossy near-white) —
  // the wall and the indoor unit's white casing were nearly the same color
  // and merged into one mass; a darker, warmer, flat-matte wall now reads as
  // a separate surface behind the appliance instead of blending into it.
  const wallPatch = beveledBox(
    2.6, 1.2, 0.06,
    new THREE.MeshPhysicalMaterial({ color: 0xc9c2b3, roughness: 0.92, metalness: 0 }),
    0.02,
  );
  wallPatch.position.set(0.45, 2.45, -0.33);
  group.add(wallPatch);

  const iuTop = beveledBox(2.0, 0.07, 0.44, white, 0.03);
  iuTop.position.set(0.45, 2.72, -0.03);
  const iuBack = beveledBox(2.0, 0.56, 0.04, white, 0.01);
  iuBack.position.set(0.45, 2.44, -0.27);
  const iuFront = beveledBox(2.0, 0.3, 0.05, white, 0.02);
  iuFront.position.set(0.45, 2.6, 0.16);
  group.add(iuTop, iuBack, iuFront);
  for (const ex of [-0.53, 1.43]) {
    const cap = beveledBox(0.04, 0.56, 0.42, materials.glass(0xdce6f0, 0.25), 0.015);
    cap.position.set(ex, 2.44, -0.03);
    group.add(cap);
  }
  // louver flap, angled open, and the intake strip on top
  const louver = beveledBox(1.9, 0.02, 0.14, white, 0.005);
  louver.rotation.x = 0.6;
  louver.position.set(0.45, 2.14, 0.13);
  const intake = beveledBox(1.8, 0.015, 0.3, dark, 0.006);
  intake.position.set(0.45, 2.69, -0.03);
  group.add(louver, intake);

  // evaporator: slanted fin slab (fins tilted to follow the tube passes)
  const evapFins = new THREE.Group();
  for (let i = 0; i < 40; i++) {
    const fin = box(0.02, 0.42, 0.17, alumFin);
    fin.rotation.x = -0.52;
    fin.position.set(-0.35 + (i / 39) * 1.55, 2.45, 0.012);
    evapFins.add(fin);
  }
  group.add(evapFins);

  // cross-flow blower: long roller of angled slats under the coil
  const roller = new THREE.Group();
  roller.position.set(0.45, 2.28, 0.02);
  for (let i = 0; i < 20; i++) {
    const holder = new THREE.Group();
    holder.rotation.x = (i * 2 * Math.PI) / 20;
    const slat = box(1.6, 0.045, 0.012, materials.steel(0x8b929c));
    slat.position.y = 0.085;
    slat.rotation.x = 0.55;
    holder.add(slat);
    roller.add(holder);
  }
  for (const ex of [-0.82, 0.82]) {
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 20).rotateZ(Math.PI / 2), dark);
    hub.position.x = ex;
    roller.add(hub);
  }
  group.add(roller);

  // ========================== REFRIGERANT CIRCUIT =============================
  const capC = [1.55, 0.62, CZ]; // capillary helix center (room-facing side)
  const capPts = [[1.32, 0.36, CZ - 0.1], [1.46, 0.38, CZ - 0.16]];
  for (let k = 0; k <= 16; k++) {
    const a = (k / 16) * Math.PI * 8;
    capPts.push([capC[0] + 0.09 * Math.cos(a), 0.42 + (k / 16) * 0.4, capC[2] + 0.09 * Math.sin(a)]);
  }
  const segments = [
    // 0 · compressor discharge → condenser inlet
    [[0.85, 0.92, ODZ], [0.75, 1.1, ODZ + 0.16], [0.55, 1.18, CZ]],
    // 1 · condenser serpentine on the room-facing face (4 passes, U-bends past
    //     the fin pack; narrower than the unit so the compressor bay stays clear)
    [
      [0.55, 1.18, CZ], [-0.55, 1.18, CZ], [-0.7, 1.1, CZ], [-0.55, 1.02, CZ],
      [0.55, 1.02, CZ], [0.7, 0.94, CZ], [0.55, 0.86, CZ], [-0.55, 0.86, CZ],
      [-0.7, 0.78, CZ], [-0.55, 0.7, CZ], [0.55, 0.7, CZ],
    ],
    // 2 · out of the coil, across to the filter drier
    [[0.55, 0.7, CZ], [1.05, 0.62, CZ], [1.32, 0.55, CZ], [1.32, 0.36, CZ - 0.1]],
    // 3 · capillary tube: four hair-thin coils
    capPts,
    // 4 · liquid line: forward off the outdoor unit, then up the wall to the
    //     indoor unit (bridges the z gap between the two units)
    [[capC[0] + 0.09, 0.82, capC[2]], [1.66, 1.2, CZ + 0.3], [1.66, 1.9, -0.1], [1.55, 2.22, 0.05], [1.28, 2.3, 0.1]],
    // 5 · evaporator serpentine (4 passes along the slanted slab)
    [
      [1.28, 2.3, 0.1], [-0.42, 2.3, 0.1], [-0.56, 2.35, 0.07], [-0.42, 2.4, 0.045],
      [1.28, 2.4, 0.045], [1.42, 2.45, 0.017], [1.28, 2.5, -0.01], [-0.42, 2.5, -0.01],
      [-0.56, 2.55, -0.042], [-0.42, 2.6, -0.075], [1.28, 2.6, -0.075],
    ],
    // 6 · fat insulated suction line back down and behind to the compressor
    [[1.28, 2.6, -0.075], [1.7, 2.4, -0.1], [1.82, 1.6, ODZ + 0.5], [1.5, 0.95, CZ], [1.1, 0.9, ODZ], [0.85, 0.92, ODZ]],
  ];
  const chain = chainPath(segments);
  const b = chain.bounds;

  // tubes per segment — radii tell the story (capillary is hair-thin)
  const radii = [0.032, 0.028, 0.024, 0.012, 0.02, 0.028, 0.032];
  chain.curves.forEach((curve, i) => {
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, i === 3 ? 160 : 64, radii[i], 12), copper);
    tube.castShadow = true;
    group.add(tube);
  });
  // foam insulation sleeve over the suction line's wall run
  const sleeveCurve = new THREE.CatmullRomCurve3(
    [[1.7, 2.4, -0.1], [1.82, 1.6, ODZ + 0.5], [1.5, 0.95, CZ]].map((p) => new THREE.Vector3(...p)),
    false, 'catmullrom', 0.25,
  );
  const sleeve = new THREE.Mesh(new THREE.TubeGeometry(sleeveCurve, 40, 0.055, 12), materials.rubber(0x22262c));
  group.add(sleeve);

  // filter drier body on the liquid line
  const drier = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.24, 16), materials.brushedSteel());
  drier.castShadow = true;
  drier.position.set(1.32, 0.47, CZ - 0.1);
  group.add(drier);

  // refrigerant packets riding the chain
  const packets = new THREE.Group();
  packets.userData.arrows = [];
  const UP = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 44; i++) {
    const a = arrow(0xffffff, 0.11);
    a.userData.seed = i / 44;
    a.material.opacity = 0.95;
    packets.userData.arrows.push(a);
    packets.add(a);
  }
  group.add(packets);

  // phase colour along the chain, from the REAL segment boundaries
  const tmp = new THREE.Color();
  function colorAt(t, out) {
    t = ((t % 1) + 1) % 1;
    if (t < b[0]) out.copy(hotGas);
    else if (t < b[1]) out.lerpColors(hotGas, warmLiq, (t - b[0]) / (b[1] - b[0]));
    else if (t < b[2]) out.copy(warmLiq);
    else if (t < b[3]) out.lerpColors(warmLiq, cold, (t - b[2]) / (b[3] - b[2]));
    else if (t < b[4]) out.copy(cold);
    else if (t < b[5]) out.lerpColors(cold, coolGas, (t - b[4]) / (b[5] - b[4]));
    else out.copy(coolGas);
    return out;
  }

  // --- air ---------------------------------------------------------------------
  const hotAirG = new THREE.Group();
  hotAirG.userData.arrows = [];
  for (let i = 0; i < 12; i++) {
    const a = arrow(0xff8848, 0.15);
    a.rotation.x = -Math.PI / 2; // out of the fan, away from the room (-Z)
    a.userData.seed = i / 12;
    a.userData.ang = (i / 12) * Math.PI * 2;
    a.material.opacity = 0;
    hotAirG.userData.arrows.push(a);
    hotAirG.add(a);
  }
  group.add(hotAirG);
  const coldAirG = new THREE.Group();
  coldAirG.userData.arrows = [];
  for (let i = 0; i < 10; i++) {
    const a = arrow(0x66c6ff, 0.15);
    a.rotation.x = 2.55; // down and forward out of the louver
    a.userData.seed = i / 10;
    a.userData.lane = -0.3 + (i % 5) * 0.38;
    a.material.opacity = 0;
    coldAirG.userData.arrows.push(a);
    coldAirG.add(a);
  }
  group.add(coldAirG);

  // --- callout labels -----------------------------------------------------------
  const callouts = [];
  const addCallout = (text, pos, dir, len) => {
    const c = callout(text, { dir, len });
    c.position.set(...pos);
    c.visible = false;
    group.add(c);
    callouts.push(c);
  };
  addCallout('Indoor unit', [-0.5, 2.74, 0], 135, 56);
  addCallout('Evaporator coil', [-0.48, 2.5, 0.05], 20, 70);
  addCallout('Cross-flow blower', [1.28, 2.26, 0.1], -25, 62);
  addCallout('Outdoor unit', [-0.78, 1.4, ODZ + 0.4], 65, 62);
  addCallout('Fan', [-0.45, 1.26, ODZ - 0.35], 105, 46);
  addCallout('Condenser coil', [-0.6, 0.72, CZ + 0.05], -20, 66);
  addCallout('Compressor', [0.85, 0.4, ODZ + 0.2], -55, 62);
  addCallout('Filter drier', [1.35, 0.34, CZ - 0.05], -15, 58);
  addCallout('Capillary tube', [1.66, 0.85, CZ + 0.05], 20, 58);

  // --- state / pose --------------------------------------------------------------
  const state = { flow: 0, spin: 0, hotAir: 0, coldAir: 0 };
  const tangent = new THREE.Vector3();

  function apply() {
    fan.group.rotation.z = -state.spin;
    roller.rotation.x = state.spin * 1.6;
    const pump = 1 + Math.sin(state.flow * Math.PI * 2 * 6) * 0.03;
    compressor.scale.set(1, pump, 1);

    packets.userData.arrows.forEach((a) => {
      const t = (a.userData.seed + state.flow) % 1;
      a.position.copy(chain.getPointAt(t));
      tangent.copy(chain.getTangentAt(t));
      a.quaternion.setFromUnitVectors(UP, tangent);
      colorAt(t, tmp);
      a.material.color.copy(tmp);
      a.material.emissive.copy(tmp);
    });

    hotAirG.userData.arrows.forEach((a) => {
      const t = (state.flow * 0.9 + a.userData.seed) % 1;
      const r = 0.16 + 0.22 * ((a.userData.ang * 7) % 1);
      a.position.set(
        -0.1 + Math.cos(a.userData.ang) * r,
        0.9 + Math.sin(a.userData.ang) * r,
        ODZ - 0.4 - t * 1.3,
      );
      a.material.opacity = state.hotAir * 0.9 * Math.sin(Math.PI * t);
    });
    coldAirG.userData.arrows.forEach((a) => {
      const t = (state.flow * 0.9 + a.userData.seed) % 1;
      a.position.set(a.userData.lane + 0.45, 2.08 - t * 1.05, 0.28 + t * 0.7);
      a.material.opacity = state.coldAir * 0.9 * Math.sin(Math.PI * t);
    });
  }
  apply();

  return {
    group,
    state,
    // segment-boundary fractions, for the step timelines
    phases: {
      discharge: b[0],
      condenserEnd: b[1],
      drierEnd: b[2],
      capTubeEnd: b[3],
      liquidEnd: b[4],
      evapEnd: b[5],
    },
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setLabels(visible) {
      for (const c of callouts) c.visible = visible;
    },
  };
}
