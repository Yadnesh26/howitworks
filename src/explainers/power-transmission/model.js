import * as THREE from 'three';
import { materials, rod, box, disc, label, chargeQueue } from '../../framework/parts.js';
import { beveledBox, lathe, tubeAlong, coil, chainPath } from '../../framework/geometry.js';
import { callout } from '../../framework/labels.js';

// The capstone of the power series: the journey electricity takes from a
// generator to a wall socket, staged as one continuous "product shot"
// landscape running along +X — plant -> step-up transformer -> transmission
// pylons -> substation -> distribution poles -> pole transformer -> house.
//
// Reference facts (validated against Wikipedia's "Electric power
// transmission" and "Electric power distribution" articles):
//  - A generator produces power at a moderate "generation voltage" (real
//    plants: roughly 11-25 kV). That's far too low to send any distance:
//    a wire has real resistance R, so driving current I through it wastes
//    P_loss = I^2 * R as heat, and for a fixed amount of power P = V * I,
//    the only way to cut current (and so cut loss, which scales with the
//    SQUARE of current) without cutting delivered power is to raise voltage.
//  - So a STEP-UP transformer at the plant raises generation voltage to a
//    transmission voltage — typically 115-765 kV for real high-voltage
//    lines — before the power ever leaves the site. Same power, far less
//    current, far less I^2R loss over the hundreds of miles that follow.
//  - Those high-voltage lines run on tall lattice steel PYLONS (towers),
//    strung with bare conductors that sag in a catenary between towers and
//    hang from insulator strings so the energized wire never touches the
//    grounded steel.
//  - At the load end, a SUBSTATION steps that transmission voltage back
//    DOWN to a "distribution voltage" (commonly a few kV up to ~35 kV).
//  - From the substation, medium-voltage DISTRIBUTION lines run along
//    shorter wooden or composite POLES through neighborhoods.
//  - A pole-mounted (or pad-mounted) DISTRIBUTION TRANSFORMER near a
//    cluster of houses steps that distribution voltage down one final time
//    to utilization voltage — 120/240 V split-phase in North America.
//  - A SERVICE DROP wire runs from that transformer to the house, through
//    the METER (which tallies energy used) and into the breaker PANEL,
//    which fans it out to circuits and outlets.
//  - Every one of those transformer steps is the SAME turns-ratio trick the
//    transformer explainer shows, just repeated at wildly different scales:
//    step voltage up once, hard, for the long haul; step it back down in a
//    few stages as it nears the point of use.

// ---------------------------------------------------------------------------
// world layout — one long corridor along +X, ground at y = 0
// ---------------------------------------------------------------------------
const PLANT_X = -5.6;
const STEPUP_X = -3.9;
const PYLON_XS = [-2.0, 0.0, 2.0];
const SUBSTATION_X = 3.4;
const POLE_XS = [4.6, 5.6];
const HOUSE_X = 6.6;

const GROUND_LEFT = PLANT_X - 0.9;
const GROUND_RIGHT = HOUSE_X + 0.9;
const GROUND_W = GROUND_RIGHT - GROUND_LEFT;
const GROUND_CX = (GROUND_LEFT + GROUND_RIGHT) / 2;

const CURR_COLOR = 0x6ec8ff; // grid current, mid voltage — the family accent
const CURR_COLOR_HV = 0xd3f0ff; // sparse/fast high-voltage sparks — brighter, cooler
const CURR_COLOR_LV = 0xffe7b0; // dense/slow household current — warm, "arrived home"
const HEAT_COLOR = 0xff5233;
const FIELD_COLOR = 0x8fc4ff;

function tri(t) {
  return 1 - Math.abs(1 - 2 * t);
}

// A short lead / bus material shared everywhere current-carrying bare metal
// shows up.
function wireMaterial() {
  return new THREE.MeshPhysicalMaterial({ color: 0x1b1d21, metalness: 0.75, roughness: 0.42 });
}

function insulatorMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x7d715e,
    roughness: 0.28,
    clearcoat: 1,
    clearcoatRoughness: 0.2,
  });
}

function woodMaterial() {
  return new THREE.MeshPhysicalMaterial({ color: 0x5b4230, roughness: 0.85, metalness: 0 });
}

// Sagged midpoint between two support points — real conductors droop in a
// catenary, never run dead-straight between towers.
function sag(a, b, drop) {
  return [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - drop, (a[2] + b[2]) / 2];
}

// One "corridor" of current: N parallel phase wires, each a chain of sagged
// spans through a sequence of support points, plus a flow-dot group riding
// each phase. This is a CONTINUOUS one-way flow (current genuinely moving
// plant -> house), so dots wrap with a plain modulo rather than
// framework's chargeQueue() (which is built for a front that sweeps 0->1
// then drains back to 0 — perfect for a charge arriving/leaving a lead, not
// for depicting an ongoing flow). chargeQueue is used below for exactly that
// arrive-then-drain case: the hypothetical "sent at low voltage" wire.
// `speedMul` MUST be a whole number — a dot's parametric position
// is (seed + phase*speedMul) % 1, so one lap (phase 0->1) advances it by an
// integer number of laps around its own curve and returns to an identical
// pose, keeping the loop seamless regardless of how fast it looks.
function buildCorridor(phaseSupports, { radius = 0.014, count = 6, color = CURR_COLOR, size = 0.026, speedMul = 2, sagDrop = 0.16, dim = false } = {}) {
  const group = new THREE.Group();
  const wireMat = wireMaterial();
  const chains = [];
  phaseSupports.forEach((supports) => {
    const segments = [];
    for (let i = 0; i < supports.length - 1; i++) {
      const a = supports[i];
      const b = supports[i + 1];
      segments.push([a, sag(a, b, sagDrop), b]);
    }
    const chain = chainPath(segments);
    chain.curves.forEach((curve) => {
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, radius, 10), wireMat);
      tube.castShadow = true;
      group.add(tube);
    });
    chains.push(chain);
  });

  const dots = [];
  chains.forEach((chain) => {
    for (let i = 0; i < count; i++) {
      const mat = materials.glow(color, dim ? 0.9 : 1.5);
      mat.transparent = true;
      mat.opacity = 0;
      mat.depthWrite = false;
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 8), mat);
      mesh.userData.seed = i / count;
      mesh.userData.chain = chain;
      group.add(mesh);
      dots.push(mesh);
    }
  });

  function update(phase, amount = 1) {
    dots.forEach((mesh) => {
      const t = (mesh.userData.seed + phase * speedMul) % 1;
      mesh.position.copy(mesh.userData.chain.getPointAt(t));
      const fadeIn = Math.min(1, t * 10);
      const fadeOut = Math.min(1, (1 - t) * 10);
      mesh.material.opacity = fadeIn * fadeOut * amount;
    });
  }

  return { group, chains, update };
}

// ---------------------------------------------------------------------------
// The generation nod — a compact, stylized stand-in (the full plants have
// their own explainers). A drum building + a tapered stack + a warm window
// band, just enough to read as "power plant" without competing for attention.
// ---------------------------------------------------------------------------
function buildPlantNod(mat) {
  const g = new THREE.Group();
  const body = beveledBox(1.3, 1.15, 1.05, mat, 0.05);
  body.position.y = 0.575;
  g.add(body);
  const windowMat = materials.glow(0xffcf8f, 1.1);
  const windowBand = box(1.16, 0.1, 0.02, windowMat);
  windowBand.position.set(0, 0.78, 0.535);
  g.add(windowBand);
  const stack = lathe(
    [[0.001, 0], [0.15, 0.04], [0.14, 1.15], [0.1, 1.32], [0.001, 1.38]],
    materials.paintedMetal(0x8f9298),
  );
  stack.position.set(-0.35, 1.15, -0.25);
  g.add(stack);
  const outPoint = [0.65, 0.82, 0.3];
  return { group: g, outPoint };
}

// ---------------------------------------------------------------------------
// A station transformer — used both for the STEP-UP unit at the plant and
// the STEP-DOWN unit at the substation. A sealed tank with cooling fins, a
// glass inspection window revealing a small winding pair (turns ratio
// visibly inverted between the two uses), and porcelain bushings on each
// side sized to the voltage they carry (taller bushing = more insulation
// needed = higher voltage, a real design cue).
// ---------------------------------------------------------------------------
function buildStationTransformer({ lowTurns, highTurns, lowBushingH, highBushingH, scale = 1 }) {
  const g = new THREE.Group();
  const tankMat = materials.paintedMetal(0x3d434b);
  const finMat = materials.aluminum(0x9aa2ad);
  const pad = beveledBox(0.62 * scale, 0.08, 0.5 * scale, materials.paintedMetal(0x24262b), 0.02);
  pad.position.y = 0.04;
  g.add(pad);
  const tank = beveledBox(0.44 * scale, 0.42 * scale, 0.32 * scale, tankMat, 0.02);
  tank.position.y = 0.08 + 0.21 * scale;
  g.add(tank);
  for (let i = -3; i <= 3; i++) {
    const fin = box(0.018 * scale, 0.3 * scale, 0.03 * scale, finMat);
    fin.position.set(0.24 * scale, tank.position.y, i * 0.045 * scale);
    g.add(fin);
  }
  // inspection window + mini windings — thick-wire/few-turns on the LOW
  // side, thin-wire/many-turns on the HIGH side (or the mirror, for a
  // step-down unit) — the same turns-ratio idea as the transformer explainer.
  const glassMat = materials.glass(0xbfe3ff, 0.22);
  const glassPane = box(0.02, 0.24 * scale, 0.2 * scale, glassMat);
  glassPane.position.set(-0.22 * scale, tank.position.y, 0);
  g.add(glassPane);
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x2c2f34, roughness: 0.7, metalness: 0.4 });
  const core = box(0.03 * scale, 0.26 * scale, 0.04 * scale, coreMat);
  core.position.set(-0.24 * scale, tank.position.y, 0);
  g.add(core);
  const lowCoil = coil(
    { turns: lowTurns, radius: 0.045 * scale, length: 0.18 * scale, wireRadius: 0.009 * scale, segmentsPerTurn: 14 },
    materials.brushedSteel(0xc9853f),
  );
  lowCoil.mesh.position.set(-0.255 * scale, tank.position.y, -0.055 * scale);
  g.add(lowCoil.mesh);
  const highCoil = coil(
    { turns: highTurns, radius: 0.045 * scale, length: 0.18 * scale, wireRadius: 0.0045 * scale, segmentsPerTurn: 14 },
    materials.brushedSteel(0xb5713a),
  );
  highCoil.mesh.position.set(-0.255 * scale, tank.position.y, 0.055 * scale);
  g.add(highCoil.mesh);

  const insMat = insulatorMaterial();
  function bushingStack(x, z, h, r0) {
    const stack = new THREE.Group();
    stack.position.set(x, tank.position.y + 0.21 * scale, z);
    const segs = Math.max(3, Math.round(h / (0.05 * scale)));
    for (let i = 0; i < segs; i++) {
      const ring = disc(r0 * (1 - i * 0.01), 0.03 * scale, insMat, 14);
      ring.position.y = i * (h / segs) + 0.02 * scale;
      stack.add(ring);
    }
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r0 * 0.9, 10, 8), materials.chrome(0xd6dae0));
    cap.position.y = h + 0.02 * scale;
    stack.add(cap);
    g.add(stack);
    return [x, stack.position.y + h + 0.02 * scale, z];
  }
  const lowPoints = [-0.09, 0.09].map((z) => bushingStack(-0.14 * scale, z * scale, lowBushingH * scale, 0.028 * scale));
  const highPoints = [-0.1, 0, 0.1].map((z) => bushingStack(0.16 * scale, z * scale, highBushingH * scale, 0.026 * scale));

  return { group: g, lowPoints, highPoints, tank, glassPane };
}

// ---------------------------------------------------------------------------
// A lattice transmission tower: four legs tapering from a wide base to a
// narrow waist then a slender mast, horizontal bracing rings + diagonal
// cross-bracing per panel, a cross-arm at the top carrying three insulator
// strings (one per phase). Attach points are where the sagging wire actually
// clamps — the BOTTOM of each hanging insulator string.
// ---------------------------------------------------------------------------
function buildLatticeTower(mat) {
  const g = new THREE.Group();
  const H = { base: 0.42, waistY: 1.7, waistHalf: 0.1, topY: 2.5, armY: 2.38, insLen: 0.2 };
  const legR = 0.026;

  const corners = [
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];
  corners.forEach(([sx, sz]) => {
    const pts = [
      [sx * H.base, 0, sz * H.base],
      [sx * H.waistHalf, H.waistY, sz * H.waistHalf],
      [sx * H.waistHalf, H.topY, sz * H.waistHalf],
    ];
    g.add(tubeAlong(pts, legR, mat, { tubularSegments: 16 }));
  });

  const panels = 6;
  for (let i = 0; i <= panels; i++) {
    const t = i / panels;
    const y = t * H.waistY;
    const half = H.base + (H.waistHalf - H.base) * t;
    const ring = [
      [half, y, half], [-half, y, half], [-half, y, -half], [half, y, -half], [half, y, half],
    ];
    for (let k = 0; k < 4; k++) {
      g.add(tubeAlong([ring[k], ring[k + 1]], legR * 0.55, mat, { tubularSegments: 2 }));
    }
    if (i > 0) {
      const tPrev = (i - 1) / panels;
      const yPrev = tPrev * H.waistY;
      const halfPrev = H.base + (H.waistHalf - H.base) * tPrev;
      const a = [
        [halfPrev, yPrev, halfPrev], [-halfPrev, yPrev, halfPrev], [-halfPrev, yPrev, -halfPrev], [halfPrev, yPrev, -halfPrev],
      ];
      const b = [
        [half, y, half], [-half, y, half], [-half, y, -half], [half, y, -half],
      ];
      for (let k = 0; k < 4; k++) {
        const k2 = (k + 1) % 4;
        g.add(tubeAlong([a[k], b[k2]], legR * 0.45, mat, { tubularSegments: 2 }));
        g.add(tubeAlong([a[k2], b[k]], legR * 0.45, mat, { tubularSegments: 2 }));
      }
    }
  }

  const arm = beveledBox(0.08, 0.06, 1.1, mat, 0.015);
  arm.position.set(0, H.armY, 0);
  g.add(arm);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), mat);
  cap.position.set(0, H.topY + 0.02, 0);
  g.add(cap);

  const insMat = insulatorMaterial();
  const attachPoints = [];
  [-0.48, 0, 0.48].forEach((z) => {
    const string = rod(0.016, H.insLen, insMat, 10);
    string.position.set(0, H.armY - H.insLen, z);
    g.add(string);
    for (let r = 0; r < 4; r++) {
      const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.008, 6, 12), insMat);
      ridge.rotation.x = Math.PI / 2;
      ridge.position.set(0, H.armY - H.insLen * 0.9 + r * (H.insLen * 0.75) / 4, z);
      g.add(ridge);
    }
    attachPoints.push([0, H.armY - H.insLen, z]);
  });

  return { group: g, attachPoints, topY: H.topY };
}

// ---------------------------------------------------------------------------
// A shorter wooden distribution pole: a single pole, one cross-arm, three
// pin insulators standing upright on top of it (the wire rests in a groove
// on top of a pin insulator — no hanging string needed at this voltage).
// ---------------------------------------------------------------------------
function buildDistPole(mat) {
  const g = new THREE.Group();
  const H = 1.35;
  const armY = H - 0.1;
  g.add(rod(0.038, H, mat, 12));
  const arm = beveledBox(0.05, 0.045, 0.58, mat, 0.01);
  arm.position.set(0, armY, 0);
  g.add(arm);
  const insMat = insulatorMaterial();
  const attachPoints = [];
  [-0.24, 0, 0.24].forEach((z) => {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.028, 0.05, 12), insMat);
    pin.position.set(0, armY + 0.025 + 0.045, z);
    g.add(pin);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), insMat);
    dome.position.set(0, armY + 0.05 + 0.045, z);
    g.add(dome);
    attachPoints.push([0, armY + 0.05 + 0.045 + 0.02, z]);
  });
  return { group: g, attachPoints, armY, height: H };
}

// A pole-mounted distribution transformer — the small grey "can" everyone
// has seen hanging on a utility pole. Mounted on a bracket off the pole
// shaft, HV bushing on top (jumper up to the crossarm), LV spade bushings
// lower on the same face (service-drop wires leave from there).
function buildPoleTransformer(mat) {
  const g = new THREE.Group();
  const can = lathe([[0.001, 0], [0.1, 0.02], [0.12, 0.34], [0.1, 0.4], [0.001, 0.44]], mat);
  g.add(can);
  const insMat = insulatorMaterial();
  const hv = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 0.13, 10), insMat);
  hv.position.set(0, 0.44 + 0.065, 0.04);
  g.add(hv);
  const hvPoint = [0, 0.44 + 0.13, 0.04];
  const lvPoints = [];
  [-0.05, 0.05].forEach((z) => {
    const lv = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.022, 0.075, 10), insMat);
    lv.position.set(0.11, 0.24, z);
    lv.rotation.z = -Math.PI / 2;
    g.add(lv);
    lvPoints.push([0.11 + 0.075, 0.24, z]);
  });
  return { group: g, hvPoint, lvPoints };
}

// ---------------------------------------------------------------------------
// The house — clean, abstract-elegant product form: gabled body, a
// weatherhead mast where the service drop lands, a meter with a glass dial,
// and a breaker panel below it.
// ---------------------------------------------------------------------------
function buildHouse() {
  const g = new THREE.Group();
  const bodyMat = materials.paintedMetal(0xdcd6c9);
  const roofMat = materials.paintedMetal(0x3a3f47);
  const body = beveledBox(1.3, 0.85, 1.0, bodyMat, 0.03);
  body.position.y = 0.425;
  g.add(body);

  const roofShape = new THREE.Shape();
  roofShape.moveTo(-0.72, 0);
  roofShape.lineTo(0, 0.45);
  roofShape.lineTo(0.72, 0);
  roofShape.lineTo(0.72, -0.02);
  roofShape.lineTo(-0.72, -0.02);
  roofShape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 1.08, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1, curveSegments: 1 });
  roofGeo.translate(0, 0, -0.54);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.castShadow = true;
  roof.position.y = 0.85;
  g.add(roof);

  // weatherhead mast, on the gable-end wall facing the pole
  const mast = rod(0.014, 0.28, materials.chrome(0xc9ced4), 10);
  mast.position.set(0.6, 1.0, 0.15);
  mast.rotation.z = -0.12;
  g.add(mast);
  const weatherheadPoint = [0.62, 1.27, 0.15];

  // service conduit down the wall to the meter
  const conduitPts = [[0.66, 1.0, 0.15], [0.66, 0.6, 0.42], [0.66, 0.42, 0.5]];
  g.add(tubeAlong(conduitPts, 0.012, materials.chrome(0xc9ced4), { tubularSegments: 16 }));

  // meter: small glass-fronted dial box
  const meterBody = beveledBox(0.16, 0.2, 0.06, materials.paintedMetal(0x4a4f57), 0.015);
  meterBody.position.set(0.66, 0.42, 0.53);
  g.add(meterBody);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 24), materials.glass(0xbfe3ff, 0.35));
  dial.rotation.x = Math.PI / 2;
  dial.position.set(0.66, 0.44, 0.565);
  g.add(dial);
  const meterPoint = [0.66, 0.42, 0.56];

  // breaker panel: a small box with a column of tiny breaker toggles
  const panelBody = beveledBox(0.18, 0.26, 0.05, materials.paintedMetal(0x3a3f47), 0.015);
  panelBody.position.set(0.66, 0.16, 0.53);
  g.add(panelBody);
  const breakerColors = [0xd23c2e, 0x2e8f4e, 0x2e8f4e, 0x2e8f4e, 0x2e8f4e];
  breakerColors.forEach((c, i) => {
    const b = box(0.09, 0.028, 0.012, materials.paintedMetal(c));
    b.position.set(0.66, 0.24 - i * 0.038, 0.565);
    g.add(b);
  });

  return { group: g, weatherheadPoint, meterPoint };
}

// ---------------------------------------------------------------------------
export function buildPowerTransmission({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // GROUND — one long, neutral studio plinth the whole journey stands on.
  const ground = beveledBox(GROUND_W, 0.16, 2.3, new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.88 }), 0.03);
  ground.position.set(GROUND_CX, -0.08, 0);
  group.add(ground);
  const groundAccent = box(GROUND_W - 0.1, 0.005, 0.02, materials.glow(0x2c3440, 0.4));
  groundAccent.position.set(GROUND_CX, 0.003, 0);
  group.add(groundAccent);

  // --- PLANT ---------------------------------------------------------------
  const plant = buildPlantNod(materials.paintedMetal(0x454b54));
  plant.group.position.set(PLANT_X, 0, 0);
  group.add(plant.group);
  const plantOut = [PLANT_X + plant.outPoint[0], plant.outPoint[1], plant.outPoint[2]];

  // --- STEP-UP TRANSFORMER ---------------------------------------------------
  // Low turns / thick wire on the plant side (low voltage, high current);
  // MANY turns / thin wire on the transmission side (high voltage, low
  // current) — this unit steps voltage UP.
  const stepUp = buildStationTransformer({ lowTurns: 7, highTurns: 30, lowBushingH: 0.16, highBushingH: 0.32, scale: 1 });
  stepUp.group.position.set(STEPUP_X, 0, 0);
  group.add(stepUp.group);
  const stepUpLowWorld = stepUp.lowPoints.map((p) => [p[0] + STEPUP_X, p[1], p[2]]);
  const stepUpHighWorld = stepUp.highPoints.map((p) => [p[0] + STEPUP_X, p[1], p[2]]);

  // lead from plant to the step-up's low-voltage bushings
  const genLead = buildCorridor(
    stepUpLowWorld.map((p) => [plantOut, [p[0] - 0.4, p[1] + 0.15, p[2]], p]),
    { radius: 0.014, count: 10, color: CURR_COLOR, size: 0.03, speedMul: 2, sagDrop: 0.05 },
  );
  group.add(genLead.group);

  // --- TRANSMISSION PYLONS ---------------------------------------------------
  const towerMat = materials.brushedSteel(0xaab1ba);
  towerMat.roughness = 0.55;
  const towers = PYLON_XS.map((x) => {
    const t = buildLatticeTower(towerMat);
    t.group.position.set(x, 0, 0);
    group.add(t.group);
    return { ...t, x };
  });

  const towerAttachWorld = towers.map((t) => t.attachPoints.map((p) => [p[0] + t.x, p[1], p[2]]));

  // --- SUBSTATION -------------------------------------------------------------
  // Many turns / thin wire on the transmission (incoming, high-voltage) side;
  // FEW turns / thick wire on the distribution (outgoing) side — mirrors the
  // step-up unit, stepping voltage back DOWN.
  const stepDown = buildStationTransformer({ lowTurns: 8, highTurns: 26, lowBushingH: 0.16, highBushingH: 0.28, scale: 1.05 });
  // flip so its "high" (many-turn) side faces the incoming transmission line
  stepDown.group.rotation.y = Math.PI;
  stepDown.group.position.set(SUBSTATION_X, 0, 0);
  group.add(stepDown.group);
  const subHighWorld = stepDown.highPoints.map((p) => [-p[0] + SUBSTATION_X, p[1], p[2]]);
  const subLowWorld = stepDown.lowPoints.map((p) => [-p[0] + SUBSTATION_X, p[1], p[2]]);

  // tall incoming support posts (transmission voltage arrives here before
  // dropping into the transformer's high side)
  const gantryMat = materials.darkMetal(0x2b3037);
  const gantryInMat = insulatorMaterial();
  function gantryPost(x, z, h) {
    const post = rod(0.03, h, gantryMat, 10);
    post.position.set(x, 0, z);
    group.add(post);
    const insul = rod(0.02, 0.14, gantryInMat, 10);
    insul.position.set(x, h, z);
    group.add(insul);
    return [x, h + 0.14, z];
  }
  const gantryInWorld = [-0.34, 0, 0.34].map((z) => gantryPost(SUBSTATION_X - 0.5, z, 1.1));
  const gantryOutWorld = [-0.28, 0, 0.28].map((z) => gantryPost(SUBSTATION_X + 0.55, z, 0.6));

  // --- TRANSMISSION corridor: step-up -> tower 0 -> tower 1 -> tower 2 -> gantry-in
  const transmissionSupports = [0, 1, 2].map((phase) =>
    [stepUpHighWorld[phase], ...towerAttachWorld.map((pts) => pts[phase]), gantryInWorld[phase]],
  );
  const transmission = buildCorridor(transmissionSupports, {
    radius: 0.016,
    count: 4,
    color: CURR_COLOR_HV,
    size: 0.022,
    speedMul: 5,
    sagDrop: 0.22,
  });
  group.add(transmission.group);

  // short jumper leads: gantry-in posts -> transformer high-side bushings
  const subInLead = buildCorridor(
    gantryInWorld.map((p, i) => [p, subHighWorld[i]]),
    { radius: 0.014, count: 4, color: CURR_COLOR_HV, size: 0.022, speedMul: 5, sagDrop: 0.05 },
  );
  group.add(subInLead.group);

  // --- DISTRIBUTION POLES -----------------------------------------------------
  const poleMat = woodMaterial();
  const poles = POLE_XS.map((x) => {
    const p = buildDistPole(poleMat);
    p.group.position.set(x, 0, 0);
    group.add(p.group);
    return { ...p, x };
  });
  const poleAttachWorld = poles.map((p) => p.attachPoints.map((pt) => [pt[0] + p.x, pt[1], pt[2]]));

  const distXfmr = buildPoleTransformer(materials.paintedMetal(0x565e69));
  const lastPole = poles[poles.length - 1];
  distXfmr.group.position.set(lastPole.x + 0.1, 0, -0.35);
  distXfmr.group.rotation.y = Math.PI / 2;
  group.add(distXfmr.group);
  // rotation.y = PI/2 maps local (x,y,z) -> world (ox + z, y, oz - x)
  function rotY90(local, ox, oz) {
    return [ox + local[2], local[1], oz - local[0]];
  }
  const distHvWorld = rotY90(distXfmr.hvPoint, lastPole.x + 0.1, -0.35);
  const distLvWorld = distXfmr.lvPoints.map((p) => rotY90(p, lastPole.x + 0.1, -0.35));

  // --- DISTRIBUTION corridor: gantry-out -> pole 0 -> pole 1 -> dist xfmr hv
  const distributionSupports = [0, 1, 2].map((phase) =>
    [gantryOutWorld[phase], ...poleAttachWorld.map((pts) => pts[phase]), phase === 1 ? distHvWorld : poleAttachWorld[poleAttachWorld.length - 1][phase]],
  );
  const distribution = buildCorridor(distributionSupports, {
    radius: 0.013,
    count: 7,
    color: CURR_COLOR,
    size: 0.026,
    speedMul: 3,
    sagDrop: 0.1,
  });
  group.add(distribution.group);

  // --- HOUSE + SERVICE DROP ----------------------------------------------------
  const house = buildHouse();
  house.group.position.set(HOUSE_X, 0, 0);
  group.add(house.group);
  const weatherheadWorld = [house.weatherheadPoint[0] + HOUSE_X, house.weatherheadPoint[1], house.weatherheadPoint[2]];
  const meterWorld = [house.meterPoint[0] + HOUSE_X, house.meterPoint[1], house.meterPoint[2]];

  const serviceDrop = buildCorridor(
    distLvWorld.map((p) => [p, weatherheadWorld]),
    { radius: 0.012, count: 14, color: CURR_COLOR_LV, size: 0.03, speedMul: 1, sagDrop: 0.12 },
  );
  group.add(serviceDrop.group);
  const serviceIn = buildCorridor([[weatherheadWorld, meterWorld]], {
    radius: 0.012,
    count: 8,
    color: CURR_COLOR_LV,
    size: 0.028,
    speedMul: 1,
    sagDrop: 0.02,
  });
  group.add(serviceIn.group);

  // ===========================================================================
  // THE LOSS DEMO — a short hypothetical wire near the step-up transformer:
  // what current would have to look like carrying the SAME power at LOW
  // (generation) voltage instead of stepping up — dense, slow, glowing hot.
  // ===========================================================================
  const lossGroup = new THREE.Group();
  group.add(lossGroup);
  const lossPts = [[STEPUP_X - 0.75, 1.25, 0.42], [STEPUP_X - 0.15, 1.12, 0.42], [STEPUP_X + 0.55, 1.25, 0.42]];
  const lossWireMat = new THREE.MeshPhysicalMaterial({ color: 0x6b2c20, metalness: 0.6, roughness: 0.45, transparent: true, opacity: 0 });
  const lossWire = tubeAlong(lossPts, 0.02, lossWireMat, { tubularSegments: 30 });
  lossGroup.add(lossWire);
  // chargeQueue is the right tool here: this wire is a hypothetical, not a
  // real continuous flow — a triangle-wave front (0->1->0 per lap) reads as
  // charge queuing densely into the wire, at low voltage/high current, then
  // draining back out, which is exactly the "arriving then draining" shape
  // the helper was built for.
  const lossCharge = chargeQueue(lossWire.userData.curve, 10, HEAT_COLOR, { size: 0.032, spacing: 0.07 });
  lossGroup.add(lossCharge.group);
  const lossHeatLight = new THREE.PointLight(HEAT_COLOR, 0, 1.2);
  lossHeatLight.position.set(STEPUP_X - 0.15, 1.15, 0.42);
  lossGroup.add(lossHeatLight);
  const lossLabelP = label('P = V × I', { color: '#dff3ff', size: 0.1 });
  lossLabelP.position.set(STEPUP_X - 0.15, 1.75, 0.42);
  lossLabelP.material.opacity = 0;
  lossGroup.add(lossLabelP);
  const lossLabelHeat = label('P_loss = I² × R', { color: '#ffb199', size: 0.1 });
  lossLabelHeat.position.set(STEPUP_X - 0.15, 1.55, 0.42);
  lossLabelHeat.material.opacity = 0;
  lossGroup.add(lossLabelHeat);

  // ===========================================================================
  // CALLOUTS
  // ===========================================================================
  const calloutGroups = { overview: [], loss: [], towers: [], substation: [], poles: [], house: [] };
  function tag(which, parent, text, pos, dir, len = 70) {
    const c = callout(text, { dir, len });
    c.position.set(...pos);
    c.visible = false;
    parent.add(c);
    calloutGroups[which].push(c);
    return c;
  }

  tag('overview', plant.group, 'Power plant', [0.2, 1.3, 0.4], 90, 60);
  tag('overview', stepUp.group, 'Step-up transformer', [0, 0.95, 0.2], 70, 70);
  tag('overview', towers[1].group, 'Transmission towers', [0, 2.6, 0], 90, 70);
  tag('overview', stepDown.group, 'Substation', [0, 0.95, -0.2], 100, 70);
  tag('overview', poles[0].group, 'Distribution poles', [0, 1.5, 0], 100, 70);
  tag('overview', house.group, 'Your house', [0.2, 1.0, 0.4], 60, 60);

  tag('loss', stepUp.group, 'Step-up transformer', [0, 1.0, 0.2], 60, 70);
  tag('loss', lossGroup, 'If sent at plant voltage: same power, far more current, far more heat', [0, 0.15, 0], -40, 150);
  tag('loss', stepUp.group, 'Fewer, faster charges — high voltage, low current', [0.2, 0.55, 0.1], 40, 130);

  tag('towers', towers[1].group, 'Lattice steel tower', [0.42, 1.2, 0.42], 55, 80);
  tag('towers', towers[1].group, 'Insulator string keeps live wire off grounded steel', [0, 2.35, 0.4], -40, 110);
  tag('towers', towers[1].group, 'Conductor sags in a catenary between towers', [0.6, 2.2, 0], 20, 120);

  tag('substation', stepDown.group, 'Step-down transformer', [0, 0.9, -0.2], -60, 80);
  tag('substation', stepDown.group, 'High voltage arrives here', [-0.5, 1.0, 0.34], 120, 90);
  tag('substation', stepDown.group, 'Distribution voltage leaves here', [0.5, 0.6, -0.1], -30, 100);

  tag('poles', poles[0].group, 'Wooden distribution pole', [0.1, 1.0, 0.2], 60, 80);
  tag('poles', distXfmr.group, 'Pole-mounted distribution transformer', [0, 0.2, 0.1], -50, 120);

  tag('house', house.group, 'Weatherhead — service drop lands here', [0.55, 1.1, 0.2], 90, 90);
  tag('house', house.group, 'Meter', [0.72, 0.42, 0.6], 30, 60);
  tag('house', house.group, 'Breaker panel', [0.72, 0.16, 0.6], -30, 70);

  // ===========================================================================
  // pose / state
  // ===========================================================================
  const state = { phase: 0, lossAmount: 0 };

  function apply() {
    const ph = state.phase;
    genLead.update(ph, 1);
    transmission.update(ph, 1);
    subInLead.update(ph, 1);
    distribution.update(ph, 1);
    serviceDrop.update(ph, 1);
    serviceIn.update(ph, 1);

    const la = state.lossAmount;
    lossWireMat.opacity = la * 0.9;
    lossCharge.setFront(tri(ph), la > 0.02);
    lossHeatLight.intensity = la * 2.2 * tri(ph);
    lossLabelP.material.opacity = la;
    lossLabelHeat.material.opacity = la;
  }
  apply();

  return {
    group,
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
