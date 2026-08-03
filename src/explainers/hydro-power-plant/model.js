import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { materials, box, rod, arrow, label } from '../../framework/parts.js';
import { beveledBox, tubeAlong, bladeRing, coil, chainPath } from '../../framework/geometry.js';
import { callout } from '../../framework/labels.js';

// A concrete gravity-dam cutaway, product-shot staged: reservoir (stored
// head) -> dam wall with an exposed penstock riding its downstream face ->
// an open-front powerhouse exposing a Francis turbine and its generator ->
// step-up transformer and transmission lines -> tailrace, downstream.
//
// Energy chain (validated against Wikipedia's Hydroelectricity / Francis
// turbine articles): the reservoir stores water at height HEAD above the
// turbine — pure gravitational potential energy, P (max) = rho * g * Q * h.
// Water dropping down the penstock trades that height for speed and pressure
// (potential -> kinetic). It enters a Francis turbine's spiral casing (the
// volute), which distributes it evenly around the guide-vane ring; the guide
// vanes (adjustable "wicket gates") aim the flow onto the runner at the
// correct angle so it can hand over torque efficiently as it turns from
// radial to axial flow (kinetic -> rotational). Francis is the mid-head
// workhorse (~30-300+ m); Kaplan (adjustable propeller) suits low head/high
// flow rivers, Pelton (a jet striking spoon-shaped buckets) suits very high
// head. The runner's shaft — a single vertical shaft, the layout almost every
// Francis unit uses — carries the same rotation straight up into the
// generator: a rotor of alternating magnetic poles spinning inside a
// stationary ring of stator windings induces an alternating EMF in each
// winding as a pole sweeps past it (Faraday's law — the same electromagnetic
// induction the transformer/inductor explainers show, just driven
// mechanically instead of by another winding's current). A step-up
// transformer then raises that voltage before it leaves on transmission
// lines (I^2R transmission loss falls with the same turns-ratio trick used
// in the transformer explainer). Spent, low-energy water leaves the runner
// through the draft tube into the tailrace and rejoins the river.

const GAP = 1.7; // sector-cutaway opening (radians), centered on +Z (camera side)

// ---- world layout (X = flow direction, Y = up, Z = width/depth toward camera)
const BED_Y = 0.14;
const RES_SURFACE_Y = 2.0;
const DAM_UP_X = -0.9;
const DAM_CREST_Y = 2.3;
const DAM_TOE_X = 0.8;
const DAM_Z = 0.62; // dam half-width
const RES_Z = 0.82; // reservoir/tailrace half-width (banks wider than the dam)
const RES_X_FAR = -2.65;
const TAILRACE_X_FAR = 2.7;

const PH_X0 = 0.85;
const PH_X1 = 1.95;
const PH_ROOF_Y = 1.55;

const TURB_X = 1.05;
const RUNNER_Y = 0.5;
const CASING_R = 0.34;
const CASING_H = 0.3;
const GEN_Y = 1.1;
const GEN_R = 0.4;
const GEN_H = 0.56;

const HOT_N = 0xd23c2e;
const COOL_S = 0x2e6bd2;
const FIELD_BLUE = 0x8fc4ff;
const POS_COLOR = 0x6ea8ff;
const NEG_COLOR = 0xffa860;

// vertical-axis sector drum (variant of jet-engine's sectorCase: that helper
// rotates the axis to +X for a horizontal turbojet spool; a Francis unit's
// shaft is vertical, so this one keeps CylinderGeometry's native +Y axis).
function sectorDrum(rTop, rBottom, height, mat, side = THREE.FrontSide) {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, height, 48, 1, true, GAP / 2, Math.PI * 2 - GAP);
  mat.side = side;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

function waterMaterial(color, opacity) {
  return new THREE.MeshPhysicalMaterial({
    color,
    transparent: true,
    opacity,
    roughness: 0.15,
    metalness: 0,
    depthWrite: false,
  });
}

export function buildHydroPlant({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  const concrete = new THREE.MeshStandardMaterial({ color: 0xa1a4a8, roughness: 0.88, metalness: 0.03 });
  const concreteDark = new THREE.MeshStandardMaterial({ color: 0x7d8085, roughness: 0.9, metalness: 0.03 });
  const casingMat = materials.aluminum(0x8a9199);
  casingMat.roughness = 0.7;
  const linerMat = new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.92, metalness: 0.15 });
  // distinct blue-steel (real Francis runners are commonly anti-corrosion
  // coated this way) — deliberately NOT the same grey as vaneMat/casingMat,
  // so the spinning runner reads as a separate part instead of blending into
  // the fixed casing/vanes around it.
  const bladeMat = materials.brushedSteel(0x3f7ea6);
  bladeMat.roughness = 0.55;
  const vaneMat = materials.steel(0x6f7784);
  vaneMat.roughness = 0.6;
  const pipeMatIn = materials.paintedMetal(0x35505c); // pressurized incoming flow
  const pipeMatOut = materials.paintedMetal(0x747e84); // spent outgoing flow — lighter so it reads as a DIFFERENT pipe where the two pass close together near the turbine
  const wireColor = 0xc9853f;

  // =========================================================================
  // GROUND
  // =========================================================================
  const plinth = beveledBox(6.0, 0.16, 2.1, new THREE.MeshStandardMaterial({ color: 0x1f2226, roughness: 0.85 }), 0.03);
  plinth.position.set(0.1, 0.06, 0);
  group.add(plinth);

  // =========================================================================
  // RESERVOIR + DAM
  // =========================================================================
  const resW = DAM_UP_X - RES_X_FAR;
  const reservoir = box(resW, RES_SURFACE_Y - BED_Y, RES_Z * 2, waterMaterial(0x1f6f9c, 0.55));
  reservoir.position.set(RES_X_FAR + resW / 2, BED_Y + (RES_SURFACE_Y - BED_Y) / 2, 0);
  group.add(reservoir);
  const resSurface = box(resW, 0.03, RES_Z * 2, waterMaterial(0x8fd0e8, 0.85));
  resSurface.position.set(RES_X_FAR + resW / 2, RES_SURFACE_Y, 0);
  group.add(resSurface);

  // dam: gravity-dam trapezoid profile (XY), extruded along Z (its width)
  const damShape = new THREE.Shape();
  damShape.moveTo(DAM_UP_X, BED_Y);
  damShape.lineTo(DAM_UP_X, DAM_CREST_Y);
  damShape.lineTo(DAM_UP_X + 0.35, DAM_CREST_Y + 0.1);
  damShape.lineTo(DAM_TOE_X, BED_Y);
  damShape.closePath();
  const damGeo = new THREE.ExtrudeGeometry(damShape, { depth: DAM_Z * 2, bevelEnabled: false, curveSegments: 1 });
  damGeo.translate(0, 0, -DAM_Z);
  const dam = new THREE.Mesh(damGeo, concrete);
  dam.castShadow = true;
  dam.receiveShadow = true;
  group.add(dam);

  // intake tower poking above the surface (scale + realism cue)
  const tower = beveledBox(0.28, 0.55, 0.28, concreteDark, 0.02);
  tower.position.set(DAM_UP_X - 0.02, RES_SURFACE_Y + 0.28, 0);
  group.add(tower);

  // trash rack: vertical bars in front of the submerged intake mouth
  const rackGroup = new THREE.Group();
  const rackMat = materials.steel(0x9aa2ad);
  for (let i = -4; i <= 4; i++) {
    const bar = beveledBox(0.018, 0.46, 0.018, rackMat, 0.004);
    bar.position.set(DAM_UP_X - 0.03, 1.55, i * 0.055);
    rackGroup.add(bar);
  }
  const rackFrame = beveledBox(0.03, 0.5, 0.52, materials.darkMetal(0x2b3037), 0.01);
  rackFrame.position.set(DAM_UP_X - 0.04, 1.55, 0);
  rackGroup.add(rackFrame);
  group.add(rackGroup);

  // head indicator: a dashed vertical line from the reservoir surface down to
  // the tailwater level, near the upstream face — makes "head" concrete.
  const headGroup = new THREE.Group();
  const HEAD_X = DAM_UP_X - 0.42;
  const HEAD_BOT_Y = 0.34;
  const headMat = new THREE.MeshBasicMaterial({ color: FIELD_BLUE, transparent: true, opacity: 0, depthWrite: false });
  const headSegs = 9;
  for (let i = 0; i < headSegs; i++) {
    if (i % 2 === 1) continue; // dashed
    const y0 = HEAD_BOT_Y + ((RES_SURFACE_Y - HEAD_BOT_Y) * i) / headSegs;
    const y1 = HEAD_BOT_Y + ((RES_SURFACE_Y - HEAD_BOT_Y) * (i + 1)) / headSegs;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, y1 - y0, 6), headMat);
    seg.position.set(HEAD_X, (y0 + y1) / 2, 0);
    headGroup.add(seg);
  }
  const headArrowTop = arrow(FIELD_BLUE, 0.06);
  headArrowTop.position.set(HEAD_X, RES_SURFACE_Y - 0.03, 0);
  headArrowTop.rotation.x = Math.PI;
  headArrowTop.material.transparent = true;
  headArrowTop.material.opacity = 0;
  const headArrowBot = arrow(FIELD_BLUE, 0.06);
  headArrowBot.position.set(HEAD_X, HEAD_BOT_Y + 0.03, 0);
  headArrowBot.material.transparent = true;
  headArrowBot.material.opacity = 0;
  headGroup.add(headArrowTop, headArrowBot);
  const headLabel = label('head (h)', { color: '#dff3ff', size: 0.12 });
  headLabel.position.set(HEAD_X - 0.1, (RES_SURFACE_Y + HEAD_BOT_Y) / 2, 0);
  headLabel.material.opacity = 0;
  headGroup.add(headLabel);
  const powerLabel = label('P ≈ ρ·g·h·Q·η', { color: '#dff3ff', size: 0.12 });
  powerLabel.position.set(-1.7, 2.5, 0);
  powerLabel.material.opacity = 0;
  headGroup.add(powerLabel);
  group.add(headGroup);

  // =========================================================================
  // POWERHOUSE — open-front cutaway shell (back wall + roof + floor only)
  // =========================================================================
  const phMat = materials.paintedMetal(0xd7dadd);
  const phRoofMat = materials.paintedMetal(0x565e69);
  const floor = beveledBox(PH_X1 - PH_X0 + 0.1, 0.12, DAM_Z * 2, concreteDark, 0.02);
  floor.position.set((PH_X0 + PH_X1) / 2, BED_Y, 0);
  const backWall = beveledBox(PH_X1 - PH_X0, PH_ROOF_Y - BED_Y, 0.06, phMat, 0.02);
  backWall.position.set((PH_X0 + PH_X1) / 2, (PH_ROOF_Y + BED_Y) / 2, -DAM_Z + 0.03);
  const roof = beveledBox(PH_X1 - PH_X0 + 0.15, 0.1, DAM_Z * 2 + 0.1, phRoofMat, 0.02);
  roof.position.set((PH_X0 + PH_X1) / 2, PH_ROOF_Y, 0);
  group.add(floor, backWall, roof);
  // low end returns for a bit of architecture without blocking the view
  const endWallUp = beveledBox(0.06, 0.55, DAM_Z * 2, phMat, 0.02);
  endWallUp.position.set(PH_X0, BED_Y + 0.28, 0);
  group.add(endWallUp);

  // =========================================================================
  // WATER PATH — reservoir drift -> penstock -> turbine -> draft tube -> tailrace
  // =========================================================================
  const intakeMouth = [DAM_UP_X - 0.02, 1.55, 0];
  const turbInlet = [TURB_X, 0.42, 0.15];
  const runnerCenter = [TURB_X, RUNNER_Y - 0.05, 0];
  const draftExit = [PH_X1 - 0.05, 0.2, 0];

  const segments = [
    // 0 · reservoir drift toward the intake
    [[RES_X_FAR + 0.6, 1.85, 0], [-1.7, 1.75, 0], [-1.1, 1.6, 0], intakeMouth],
    // 1 · penstock: submerged through the dam, emerging exposed on the
    //     downstream face, down the slope to the turbine inlet
    [
      intakeMouth,
      [-0.3, 1.95, 0],
      [0.15, 1.68, 0.5],
      [0.4, 1.28, 0.74],
      [0.65, 0.72, 0.74],
      [0.88, 0.5, 0.55],
      turbInlet,
    ],
    // 2 · spiral casing -> guide vanes -> runner
    [turbInlet, runnerCenter],
    // 3 · draft tube: turns from vertical to horizontal, flares toward the tailrace
    [runnerCenter, [TURB_X + 0.15, 0.3, 0], [TURB_X + 0.5, 0.22, 0], draftExit],
    // 4 · tailrace, drifting away downstream
    [draftExit, [PH_X1 + 0.4, 0.2, 0], [TAILRACE_X_FAR - 0.6, 0.19, 0]],
  ];
  const chain = chainPath(segments);
  const b = chain.bounds;

  // segment 2 (casing entry -> runner) now gets a thin visible connector too
  // — leaving it pipe-less made the flow arrows disappear into open space
  // right where the path is hardest to follow (through the casing).
  const pipeRadii = [null, 0.09, 0.045, 0.11, null];
  const pipeMats = [null, pipeMatIn, pipeMatIn, pipeMatOut, null];
  chain.curves.forEach((curve, i) => {
    if (pipeRadii[i] == null) return;
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, pipeRadii[i], 14), pipeMats[i]);
    tube.castShadow = true;
    group.add(tube);
  });

  const calmRes = new THREE.Color(0x2f7fc4);
  const fastPen = new THREE.Color(0x5fc0ff);
  const turbWhite = new THREE.Color(0xd8f1ff);
  const calmTail = new THREE.Color(0x3a8fae);
  const tmpColor = new THREE.Color();
  function colorAt(t, out) {
    t = ((t % 1) + 1) % 1;
    if (t < b[0]) out.copy(calmRes);
    else if (t < b[1]) out.lerpColors(calmRes, fastPen, (t - b[0]) / (b[1] - b[0]));
    else if (t < b[2]) out.lerpColors(fastPen, turbWhite, (t - b[1]) / (b[2] - b[1]));
    else if (t < b[3]) out.lerpColors(turbWhite, calmTail, (t - b[2]) / (b[3] - b[2]));
    else out.copy(calmTail);
    return out;
  }

  const packets = new THREE.Group();
  const packetArrows = [];
  const UP = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3();
  for (let i = 0; i < 60; i++) {
    const a = arrow(0xffffff, 0.08);
    a.userData.seed = i / 60;
    packetArrows.push(a);
    packets.add(a);
  }
  group.add(packets);

  // =========================================================================
  // TURBINE — Francis unit: spiral casing, guide vanes (fixed), runner (spins)
  // =========================================================================
  const turbine = new THREE.Group();
  turbine.position.set(TURB_X, RUNNER_Y, 0);
  group.add(turbine);

  const casing = sectorDrum(CASING_R, CASING_R * 1.15, CASING_H, casingMat);
  turbine.add(casing);
  const casingLiner = sectorDrum(CASING_R - 0.02, CASING_R * 1.15 - 0.02, CASING_H - 0.01, linerMat, THREE.DoubleSide);
  turbine.add(casingLiner);

  const guideVanesRaw = bladeRing(
    { blades: 16, hubR: 0.1, span: 0.16, chord: 0.09, camber: 0.1, twist: 0.5, twistTip: 0.3, hubDepth: 0.05, hubMaterial: vaneMat },
    vaneMat,
  );
  guideVanesRaw.group.rotation.x = -Math.PI / 2; // reorient ring axis Z -> Y
  guideVanesRaw.group.position.y = 0.02;
  turbine.add(guideVanesRaw.group);

  // mounting struts: bolt the (fixed) guide-vane ring to the casing wall so
  // it visibly reads as anchored hardware, not a second free-spinning
  // propeller sitting next to the runner — real wicket-gate rings have an
  // analogous operating-ring/linkage visible from outside the casing. Placed
  // on the back half, clear of the front sector-cutaway (GAP, centered +Z).
  const strutMat = materials.steel(0x5f6770);
  const vaneOuterR = 0.1 + 0.16 + 0.01; // hubR + span, just past the blade tips
  const casingInnerR = CASING_R - 0.02; // matches casingLiner at this height
  for (const deg of [200, 260, 320]) {
    const th = (deg * Math.PI) / 180;
    const strut = tubeAlong(
      [
        [Math.cos(th) * vaneOuterR, 0.02, Math.sin(th) * vaneOuterR],
        [Math.cos(th) * casingInnerR, 0.02, Math.sin(th) * casingInnerR],
      ],
      0.012,
      strutMat,
      { tubularSegments: 4 },
    );
    turbine.add(strut);
  }

  const runnerSpin = new THREE.Group();
  turbine.add(runnerSpin);
  const runnerRaw = bladeRing(
    { blades: 13, hubR: 0.05, span: 0.17, chord: 0.14, chordTip: 0.08, camber: 0.22, twist: 1.1, twistTip: 0.15, hubDepth: 0.08, hubMaterial: bladeMat },
    bladeMat,
  );
  runnerRaw.group.rotation.x = -Math.PI / 2;
  runnerRaw.group.position.y = -0.08;
  runnerSpin.add(runnerRaw.group);

  // spin-accent marker: a small bright emissive pin at the blade tip radius.
  // The runner's own blades are near-symmetric under its own rotation (13
  // evenly-spaced blades), so per-frame motion is very hard to read against
  // the similarly-grey casing/vanes around it — this single asymmetric,
  // high-contrast marker sweeping in a circle makes the spin unmistakable
  // at a glance, independent of blade material/lighting.
  const spinMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 12, 10),
    materials.glow(0x7fe8ff, 2.2),
  );
  spinMarker.position.set(0.2, -0.08, 0);
  runnerSpin.add(spinMarker);

  // shaft: runner -> up through the casing -> up into the generator. Thin
  // cylindrical rod, safe anisotropy target (rotation PI/2 aligns the
  // brushed-grain stretch along CylinderGeometry's V/length axis — see
  // materials.anisoSteel).
  const shaft = rod(0.045, GEN_Y + GEN_H / 2 - (RUNNER_Y - 0.14), materials.anisoSteel(0x8b929c, Math.PI / 2));
  shaft.position.set(0, -0.14, 0);
  runnerSpin.add(shaft);

  // =========================================================================
  // GENERATOR — rotor (spinning poles) inside a stator (fixed windings);
  // electromagnetic induction, the same physics as the transformer/inductor.
  // =========================================================================
  const generator = new THREE.Group();
  generator.position.set(TURB_X, GEN_Y, 0);
  group.add(generator);

  const stator = sectorDrum(GEN_R, GEN_R, GEN_H, casingMat.clone());
  generator.add(stator);
  const statorLiner = sectorDrum(GEN_R - 0.02, GEN_R - 0.02, GEN_H - 0.01, linerMat, THREE.DoubleSide);
  generator.add(statorLiner);
  const capMat = materials.paintedMetal(0x565e69);
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(GEN_R + 0.02, GEN_R + 0.02, 0.05, 48), capMat);
  capTop.position.y = GEN_H / 2;
  generator.add(capTop);

  const STATOR_COILS = 6;
  const statorCoils = [];
  for (let i = 0; i < STATOR_COILS; i++) {
    const theta = (i / STATOR_COILS) * Math.PI * 2;
    const wound = coil(
      { turns: 5, radius: 0.07, length: GEN_H * 0.7, wireRadius: 0.014, segmentsPerTurn: 16 },
      materials.brushedSteel(wireColor),
    );
    wound.mesh.position.set(Math.cos(theta) * (GEN_R - 0.09), 0, Math.sin(theta) * (GEN_R - 0.09));
    generator.add(wound.mesh);
    // indicator sits ABOVE the coil (not nested between its wire loops,
    // where the previous version was easy to miss) and pulses in size, not
    // just color, so a viewer can see charge visibly "build up" as a pole
    // sweeps past rather than reading a static brightness change.
    const dotMat = materials.glow(POS_COLOR, 0);
    dotMat.transparent = true;
    dotMat.opacity = 0;
    dotMat.depthWrite = false;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 10), dotMat);
    dot.position.set(wound.mesh.position.x, GEN_H * 0.42, wound.mesh.position.z);
    generator.add(dot);
    // expanding halo ring around the dot — the "buildup" cue itself: grows
    // and brightens toward a pole's closest approach, collapses after.
    const ringMat = new THREE.MeshBasicMaterial({ color: POS_COLOR, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.007, 8, 24), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(dot.position);
    generator.add(ring);
    statorCoils.push({ theta, dot, ring });
  }

  const rotorSpin = new THREE.Group();
  generator.add(rotorSpin);
  const rotorCore = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, GEN_H * 0.75, 28), materials.brushedSteel(0x9aa2ad));
  rotorSpin.add(rotorCore);
  const poleGeo = new RoundedBoxGeometry(0.11, GEN_H * 0.65, 0.16, 2, 0.015);
  const poleN = new THREE.Mesh(poleGeo, materials.paintedMetal(HOT_N));
  poleN.position.set(0.22, 0, 0);
  const poleS = new THREE.Mesh(poleGeo, materials.paintedMetal(COOL_S));
  poleS.position.set(-0.22, 0, 0);
  rotorSpin.add(poleN, poleS);
  const genShaftTop = rod(0.045, 0.14, materials.anisoSteel(0x8b929c, Math.PI / 2));
  genShaftTop.position.y = GEN_H * 0.375;
  rotorSpin.add(genShaftTop);

  // =========================================================================
  // STEP-UP TRANSFORMER + TRANSMISSION LINES
  // =========================================================================
  const xfmr = new THREE.Group();
  xfmr.position.set(PH_X1 + 0.25, PH_ROOF_Y + 0.12, 0.25);
  group.add(xfmr);
  const tank = beveledBox(0.36, 0.28, 0.24, materials.paintedMetal(0x3d434b), 0.02);
  tank.position.y = 0.14;
  xfmr.add(tank);
  for (let i = -3; i <= 3; i++) {
    const fin = beveledBox(0.02, 0.24, 0.03, materials.aluminum(0x9aa2ad), 0.004);
    fin.position.set(0.2, 0.14, i * 0.035);
    xfmr.add(fin);
  }
  const bushings = [];
  for (const bx of [-0.1, 0.1]) {
    const bushing = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.22, 14), materials.chrome(0xdce6ee));
    bushing.position.set(bx, 0.29 + 0.11, -0.05);
    xfmr.add(bushing);
    bushings.push(bushing);
  }
  // wires: powerhouse roof -> transformer -> gantry posts -> off toward the grid
  const postMat = materials.darkMetal(0x2b3037);
  const postA = rod(0.02, 0.5, postMat);
  postA.position.set(PH_X1 + 0.75, PH_ROOF_Y + 0.12, 0.1);
  const postB = rod(0.02, 0.5, postMat.clone());
  postB.position.set(PH_X1 + 0.75, PH_ROOF_Y + 0.12, -0.15);
  group.add(postA, postB);

  const wireMat = materials.darkMetal(0x1c1e22);
  const wireIn = tubeAlong(
    [[PH_X1 - 0.1, PH_ROOF_Y + 0.02, 0.1], [PH_X1 + 0.15, PH_ROOF_Y + 0.35, 0.15], [bushings[0].position.x + xfmr.position.x, xfmr.position.y + 0.4, xfmr.position.z]],
    0.012,
    wireMat.clone(),
    { tubularSegments: 20 },
  );
  group.add(wireIn);
  const wireOutPts = [
    [bushings[1].position.x + xfmr.position.x, xfmr.position.y + 0.4, xfmr.position.z],
    [postA.position.x, postA.position.y + 0.5, postA.position.z],
  ];
  const wireOut = tubeAlong(wireOutPts, 0.012, wireMat.clone(), { tubularSegments: 12 });
  group.add(wireOut);
  const gridLineMat = new THREE.MeshBasicMaterial({ color: FIELD_BLUE, transparent: true, opacity: 0, depthWrite: false });
  const gridLinesGroup = new THREE.Group();
  for (const dz of [0.1, -0.15]) {
    const p0 = dz > 0 ? postA.position : postB.position;
    const line = tubeAlong(
      [[p0.x, p0.y + 0.48, p0.z], [p0.x + 0.5, p0.y + 0.3, p0.z], [TAILRACE_X_FAR + 0.1, p0.y - 0.1, p0.z]],
      0.008,
      gridLineMat.clone(),
      { tubularSegments: 20 },
    );
    gridLinesGroup.add(line);
  }
  group.add(gridLinesGroup);
  // pulse dots riding the outgoing grid line, to show power actually leaving
  const gridDots = [];
  const gridDotCurve = wireOut.userData.curve;
  for (let i = 0; i < 6; i++) {
    const m = materials.glow(FIELD_BLUE, 1.4);
    m.transparent = true;
    m.opacity = 0;
    m.depthWrite = false;
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), m);
    d.userData.seed = i / 6;
    gridDots.push(d);
    group.add(d);
  }

  // =========================================================================
  // CALLOUTS (grouped per step, matching transformer.js's pattern)
  // =========================================================================
  const calloutGroups = {
    anatomy: [], reservoir: [], penstock: [], turbine: [], generator: [], grid: [], tailrace: [],
  };
  function tag(which, parent, text, pos, dir, len = 60) {
    const c = callout(text, { dir, len });
    c.position.set(...pos);
    c.visible = false;
    parent.add(c);
    calloutGroups[which].push(c);
    return c;
  }
  tag('anatomy', group, 'Reservoir', [-1.8, 2.05, 0], 100, 60);
  tag('anatomy', group, 'Dam', [-0.2, 2.0, 0.3], 70, 60);
  tag('anatomy', group, 'Penstock', [0.5, 1.0, 0.5], -40, 70);
  tag('anatomy', group, 'Powerhouse', [1.4, 1.6, 0.4], 60, 60);
  tag('anatomy', group, 'Tailrace', [2.2, 0.5, 0.3], -50, 60);

  tag('reservoir', rackGroup, 'Trash rack & intake gate', [DAM_UP_X - 0.03, 1.85, 0.2], 55, 90);
  tag('reservoir', headGroup, 'Head: the height the water falls', [0, 0.6, 0], 100, 100);

  tag('penstock', group, 'Penstock — falling water speeds up', [0.4, 1.4, 0.74], 55, 100);

  tag('turbine', casing, 'Spiral casing', [0.05, -0.08, CASING_R * 1.05], 75, 64);
  tag('turbine', guideVanesRaw.group, 'Guide vanes — fixed, aim the flow', [0.2, 0, 0.2], -20, 100);
  // parented to the FIXED turbine/generator groups, not the spinning
  // runnerRaw.group/rotorSpin — a callout on a rotating parent sweeps
  // around with it every frame, sometimes pointing at the labeled part and
  // sometimes at empty space or the wrong part entirely.
  tag('turbine', turbine, 'Runner — a Francis turbine', [0.15, -0.13, 0.1], -60, 100);

  tag('generator', generator, 'Rotor — spinning magnetic poles', [0.24, 0.05, 0.1], 30, 100);
  tag('generator', statorCoils[0].dot, 'Stator — induced AC current', [0.1, 0.15, 0.1], -40, 110);

  tag('grid', tank, 'Step-up transformer', [0.05, 0.3, 0.15], 40, 100);
  tag('grid', postA, 'Transmission lines', [0.1, 0.4, 0], 60, 90);

  tag('tailrace', group, 'Tailrace — spent water rejoins the river', [2.1, 0.5, 0.5], -40, 100);

  // =========================================================================
  // pose / state
  // =========================================================================
  const state = { flow: 0, spin: 0, headViz: 0, gridOn: 0 };

  function apply() {
    // water packets — fade in near the reservoir source, fade out downstream
    // in the tailrace (an open flow, not a closed loop, styled like the jet
    // engine's airflow arrows).
    packetArrows.forEach((a) => {
      const t = (a.userData.seed + state.flow) % 1;
      a.position.copy(chain.getPointAt(t));
      tangent.copy(chain.getTangentAt(t));
      a.quaternion.setFromUnitVectors(UP, tangent);
      colorAt(t, tmpColor);
      a.material.color.copy(tmpColor);
      a.material.emissive.copy(tmpColor);
      const fadeIn = Math.min(1, t * 10);
      const fadeOut = Math.min(1, (1 - t) * 6);
      a.material.opacity = 0.95 * fadeIn * fadeOut;
      a.scale.setScalar(t > b[0] && t < b[3] ? 1.15 : 0.85); // bigger/faster-looking in the penstock+turbine
    });

    runnerSpin.rotation.y = state.spin;
    rotorSpin.rotation.y = state.spin;

    // induced current in each stator coil: brightest as a rotor pole sweeps
    // past it, sign flips with which pole (N vs S) is closest — an AC EMF.
    // The dot swells in SIZE (not just brightness) and the ring around it
    // expands/flares — together reading as charge visibly building up and
    // releasing, not just a color flicker.
    statorCoils.forEach(({ theta, dot, ring }) => {
      const rel = Math.cos(theta - state.spin);
      const mag = Math.abs(rel);
      const col = rel >= 0 ? POS_COLOR : NEG_COLOR;
      dot.material.color.set(col);
      dot.material.emissive.set(col);
      dot.material.emissiveIntensity = 0.6 + mag * 1.6;
      dot.material.opacity = 0.25 + mag * 0.7;
      dot.scale.setScalar(0.7 + mag * 1.1);
      ring.material.color.set(col);
      ring.scale.setScalar(0.75 + mag * 1.5);
      ring.material.opacity = mag ** 3 * 0.8;
    });

    headMat.opacity = state.headViz * 0.85;
    headArrowTop.material.opacity = state.headViz * 0.9;
    headArrowBot.material.opacity = state.headViz * 0.9;
    headLabel.material.opacity = state.headViz;
    powerLabel.material.opacity = state.headViz;

    gridLineMat.opacity = state.gridOn * 0.7;
    gridDots.forEach((d) => {
      const t = (d.userData.seed + state.flow * 2) % 1;
      d.position.copy(gridDotCurve.getPointAt(t)).add(wireOut.position);
      d.material.opacity = state.gridOn * Math.min(1, t * 6) * Math.min(1, (1 - t) * 6);
    });
  }
  apply();

  return {
    group,
    phases: { reservoirEnd: b[0], penstockEnd: b[1], turbineEnd: b[2], draftEnd: b[3] },
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setLabels(which, v = true) {
      for (const [name, list] of Object.entries(calloutGroups)) {
        const show = v && name === which;
        for (const c of list) c.visible = show;
      }
    },
  };
}
