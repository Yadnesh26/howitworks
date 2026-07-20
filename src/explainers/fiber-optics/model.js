import * as THREE from 'three';
import { materials, rod, chargeQueue } from '../../framework/parts.js';
import { beveledBox, chainPath } from '../../framework/geometry.js';
import { callout } from '../../framework/labels.js';

// A fiber-optic patch link: a coiled yellow single-mode duplex cable running
// between two small transceiver modules, presented as a studio product shot.
//
// PROPORTIONS: real fiber proportions are absurd to render directly (a 9 µm
// core inside a 2 mm jacket is a 1:222 ratio — literally invisible at cable
// scale). So this model uses TWO scenes at two different scales, exactly like
// a camera macro push-in would:
//   Scene A — the real product: a coiled duplex patch cable (each lobe's
//     jacket radius maps to a real ~2 mm OD) with LC connectors at both ends.
//   Scene B — a deliberately oversized "macro insert": a stand-in fiber
//     cross-section revealed only for the cutaway/TIR/mode-comparison steps.
//     The core:cladding RATIO stays true (cladding is a real, standardized
//     125 µm for BOTH fiber types; core is 9 µm single-mode / 50 µm
//     multi-mode — so core:cladding = 0.072 : 1 single-mode, 0.4 : 1 multi-
//     mode), only the absolute size is exaggerated for legibility.
//
// MECHANISM (researched): light guided by total internal reflection (TIR) —
// a core with slightly HIGHER refractive index than its cladding; light
// hitting that boundary at a shallow enough angle reflects entirely back
// in, no mirror needed. Single-mode's core is thin enough that only one
// near-axial path fits (reads as a straight ray); multi-mode's fatter core
// admits many paths ("modes") bouncing at different angles, which arrive
// slightly out of step over distance (modal dispersion). A laser diode
// (VCSEL ~850nm multimode / DFB ~1310-1550nm single-mode) blinks bits as
// light pulses; a photodiode at the far end converts them back to
// electricity. An LC connector's 1.25mm ceramic ferrule does the real work of
// alignment — core-to-core, not the plastic housing.
//
// SCALARS the pose is built from:
//   spin    — slow presentation turntable of the whole assembly (rad)
//   reveal  — 0 sealed cable / 1 cutaway + macro insert focus
//   mode    — 0 macro insert shows multi-mode only / 1 single-mode insert
//             also revealed alongside it, for the comparison
//   connect — 0 connector unplugged (small gap) / 1 mated flush
//   bounce  — 0-1 sweep of a light ray down the macro insert's core (TIR)
//   pulse   — 0-1 phase of the repeating light-pulse "bit train" down the
//             real cable and through the transceiver modules
//
// SEAMLESS LOOPS: `bounce` and `pulse` are plain 0→1 phases ridden via
// chainPath()/getPointAt(), which wraps mod 1 by construction — frame 0 and
// frame 1 are identical, so any loop duration is seamless with no turn-count
// bookkeeping needed. `spin` advances a whole number of turns per lap.

const TAU = Math.PI * 2;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smooth = (t) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

// --- one-scale layout: Scene A (real product) ------------------------------
const PLINTH_TOP = 0.22;
const COIL_Y = PLINTH_TOP + 0.07;
const COIL_TURNS = 2.25;
const COIL_R0 = 0.26;
const COIL_R1 = 0.72;
const DUP_OFFSET = 0.055; // half-gap between the duplex pair's two lobes
const JACKET_R = 0.045; // ~2mm OD equivalent, one lobe

const PORT_POS = new THREE.Vector3(-1.3, PLINTH_TOP + 0.02, -0.5);
const STAND_BASE = new THREE.Vector3(0.95, PLINTH_TOP, 0.55);
const STAND_TOP_Y = 1.55;

const CONN_LEN = 0.24;
const CONN_W = 0.08;
const FERRULE_R = 0.013; // 1.25mm ferrule : 8mm connector width, real ratio
const FERRULE_LEN = 0.05;
const CONNECT_GAP = 0.075; // how far the plug backs out when unplugged

// --- one-scale layout: Scene B (macro fiber-cross-section insert) ---------
// cladding is a real, STANDARDIZED 125 µm for both fiber families — so both
// inserts share the same cladding/buffer/jacket radii; only the core differs.
const INS_JACKET_R = 0.28;
const INS_BUFFER_R = 0.22;
const INS_CLAD_R = 0.18;
const INS_CORE_R_MM = INS_CLAD_R * (50 / 125); // 0.072 — multi-mode core
const INS_CORE_R_SM = INS_CLAD_R * (9 / 125); // 0.013 — single-mode core
const INS_LEN = 1.3;
const INS_STRIP = 0.55; // fraction of length left jacketed (far end)

const PRIMARY_INSERT_POS = new THREE.Vector3(0.05, 1.85, -0.1); // single-mode, steps 3-4
const COMPARE_INSERT_POS = new THREE.Vector3(0.85, 1.6, 0.2); // multi-mode, step 5 only

export function buildFiber({ scene }) {
  const sceneGroup = new THREE.Group();
  scene.add(sceneGroup);
  const group = new THREE.Group(); // rotates for the presentation turntable
  sceneGroup.add(group);

  // --- materials -------------------------------------------------------------
  const jacketYellow = materials.rubber(0xf0c93a);
  jacketYellow.roughness = 0.55;
  jacketYellow.metalness = 0;
  const jacketAqua = materials.rubber(0x4fd8c9);
  jacketAqua.roughness = 0.55;
  jacketAqua.metalness = 0;
  const moduleMetal = materials.darkMetal(0x2b2e33);
  const connHousing = materials.chrome(0xced3d9);
  connHousing.roughness = 0.4;
  const latchAccent = new THREE.MeshPhysicalMaterial({
    color: 0x38e1ff,
    metalness: 0.1,
    roughness: 0.35,
    emissive: 0x38e1ff,
    emissiveIntensity: 0.4,
  });
  const ferruleMat = new THREE.MeshPhysicalMaterial({
    color: 0xe8e6de,
    metalness: 0,
    roughness: 0.5,
  });
  const laserGlow = new THREE.MeshPhysicalMaterial({
    color: 0xff3b30,
    emissive: 0xff3b30,
    emissiveIntensity: 0,
    metalness: 0,
    roughness: 0.4,
  });
  const photoGlow = new THREE.MeshPhysicalMaterial({
    color: 0x38e1ff,
    emissive: 0x38e1ff,
    emissiveIntensity: 0,
    metalness: 0,
    roughness: 0.4,
  });
  const bufferAmber = new THREE.MeshPhysicalMaterial({
    color: 0xd9b06a,
    metalness: 0,
    roughness: 0.6,
    transparent: true,
    opacity: 0.85,
  });
  // Simple flat-transparent "glass" (NOT MeshPhysical transmission): the
  // transmission pass only samples opaque geometry, so the glowing core
  // riding inside would vanish behind a truly transmissive cladding.
  const claddingGlass = new THREE.MeshPhysicalMaterial({
    color: 0xdfeef5,
    metalness: 0,
    roughness: 0.1,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  // Kept DIM on purpose: the core is glass, not a light bulb. A bright, fully
  // saturated core swallows the travelling ray riding inside it — the ray
  // must be the ONE bright thing so its bounce off the core/cladding
  // boundary actually reads. This is the "metal can't be ghosted" lesson
  // applied to a glowing core: contrast, not brightness, sells the reveal.
  const coreGlowMat = (color) =>
    new THREE.MeshPhysicalMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.22,
      metalness: 0,
      roughness: 0.25,
      transparent: true,
      opacity: 0.55,
    });
  const plinthMat = materials.paintedMetal(0x1b1d21);
  plinthMat.clearcoat = 0.4;
  plinthMat.clearcoatRoughness = 0.34;
  plinthMat.roughness = 0.55;

  // --- plinth ------------------------------------------------------------------
  const plinth = beveledBox(3.2, 0.22, 2.6, plinthMat, 0.06);
  plinth.position.set(0, 0.11, 0);
  plinth.receiveShadow = true;
  group.add(plinth);

  const revealDim = []; // Scene A meshes that dim (not hide) while revealed
  const macroMeshes = []; // Scene B — hidden unless revealed

  // ============================================================================
  //  SCENE A — the real, sealed product: coiled duplex cable + two modules
  // ============================================================================

  // spiral coil centreline, then rise out to the port (start) and the stand
  // (end). CatmullRomCurve3 (used inside tubeAlong-style builders below)
  // smooths the transitions, so a straightforward point list is enough.
  const coilPts = [];
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const angle = t * COIL_TURNS * TAU;
    const radius = COIL_R0 + (COIL_R1 - COIL_R0) * t;
    coilPts.push({
      p: new THREE.Vector3(Math.cos(angle) * radius, COIL_Y, Math.sin(angle) * radius),
      // radial direction — the natural duplex-separation axis for a loosely
      // wound spiral (perpendicular-enough to the local tangent)
      off: new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)),
    });
  }
  const lastOff = coilPts[coilPts.length - 1].off.clone();
  const firstOff = coilPts[0].off.clone();

  // lead-in from the port to the spiral's inner (first) point, and lead-out
  // from the spiral's outer (last) point up to the connector stand — reusing
  // each end's own radial offset direction (frozen) for the straight runs.
  const leadIn = [
    PORT_POS.clone(),
    PORT_POS.clone().lerp(coilPts[0].p, 0.5).add(new THREE.Vector3(0, 0.05, 0)),
  ];
  const leadOut = [
    coilPts[coilPts.length - 1].p.clone().lerp(STAND_BASE, 0.4),
    new THREE.Vector3(STAND_BASE.x, STAND_TOP_Y - 0.35, STAND_BASE.z),
    new THREE.Vector3(STAND_BASE.x, STAND_TOP_Y - 0.08, STAND_BASE.z + 0.02),
  ];

  const spinePts = [...leadIn, ...coilPts.map((c) => c.p), ...leadOut];
  const offsets = [
    firstOff,
    firstOff,
    ...coilPts.map((c) => c.off),
    lastOff,
    lastOff,
    lastOff,
  ];

  function offsetLobe(sign) {
    return spinePts.map((p, i) => p.clone().add(offsets[i].clone().multiplyScalar(sign * DUP_OFFSET)));
  }
  function buildLobe(points, material) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.3);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, JACKET_R, 12, false), material);
    mesh.castShadow = true;
    mesh.userData.curve = curve;
    return mesh;
  }
  const lobeTx = buildLobe(offsetLobe(1), jacketYellow);
  const lobeRx = buildLobe(offsetLobe(-1), jacketYellow);
  group.add(lobeTx, lobeRx);
  revealDim.push(lobeTx, lobeRx);

  // --- transceiver modules (port end + stand end) -----------------------------
  // Each is a small block housing a laser diode (transmit) and a photodiode
  // (receive) — a real link needs both at each end, since the duplex pair
  // carries independent signals in each direction at once.
  function buildModule(pos, faceDir) {
    const g = new THREE.Group();
    g.position.copy(pos);
    g.lookAt(pos.clone().add(faceDir));
    const body = beveledBox(0.34, 0.24, 0.22, moduleMetal, 0.02);
    g.add(body);
    const laser = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16), laserGlow);
    laser.rotation.x = Math.PI / 2;
    laser.position.set(-DUP_OFFSET, 0.02, 0.12);
    g.add(laser);
    const photo = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16), photoGlow);
    photo.rotation.x = Math.PI / 2;
    photo.position.set(DUP_OFFSET, 0.02, 0.12);
    g.add(photo);
    group.add(g);
    revealDim.push(body);
    return { group: g, laser, photo };
  }
  const portModule = buildModule(PORT_POS, new THREE.Vector3(1, 0, 0.3));
  const standModule = buildModule(
    new THREE.Vector3(STAND_BASE.x, STAND_TOP_Y, STAND_BASE.z),
    new THREE.Vector3(0.3, 0, 1),
  );
  // stand pedestal rising from the plinth to the module
  const pedestal = rod(0.05, STAND_TOP_Y - PLINTH_TOP - 0.12, moduleMetal, 16);
  pedestal.position.set(STAND_BASE.x, PLINTH_TOP, STAND_BASE.z);
  group.add(pedestal);
  revealDim.push(pedestal);

  // --- LC connectors at both ends: fixed boot + sliding plug/ferrule ----------
  // The boot (strain relief) stays fixed to the cable end; the rigid plug
  // shell + ferrule slides a small amount along its axis for the
  // unplugged↔mated animation (a simplified stand-in for real insertion).
  function buildConnector(atModule, axisSign) {
    const plugGrp = new THREE.Group();
    const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 16), moduleMetal);
    boot.rotation.x = Math.PI / 2;
    boot.position.z = -0.05 * axisSign;
    plugGrp.add(boot);
    const housing = beveledBox(CONN_LEN, CONN_W, CONN_W, connHousing, 0.012);
    housing.rotation.y = Math.PI / 2;
    plugGrp.add(housing);
    const latch = beveledBox(CONN_LEN * 0.5, 0.02, 0.03, latchAccent, 0.006);
    latch.position.set(0, CONN_W / 2 + 0.012, 0);
    plugGrp.add(latch);
    const ferrule = new THREE.Mesh(
      new THREE.CylinderGeometry(FERRULE_R, FERRULE_R, FERRULE_LEN, 20),
      ferruleMat,
    );
    ferrule.rotation.x = Math.PI / 2;
    ferrule.position.z = (CONN_LEN / 2 + FERRULE_LEN / 2) * axisSign;
    plugGrp.add(ferrule);
    atModule.group.add(plugGrp);
    plugGrp.position.z = 0.16 * axisSign;
    revealDim.push(housing, latch);
    return { plugGrp, axisSign };
  }
  // both connectors mount on each module's own forward (+Z) face — the
  // stand's was previously -1, putting it on the BACK of the module, out of
  // view of every camera that looks at its diode-lit front face
  const connPort = buildConnector(portModule, 1);
  const connStand = buildConnector(standModule, 1);

  function applyConnect(t) {
    const back = (1 - clamp01(t)) * CONNECT_GAP;
    connPort.plugGrp.position.z = 0.16 * connPort.axisSign + back * connPort.axisSign;
    connStand.plugGrp.position.z = 0.16 * connStand.axisSign + back * connStand.axisSign;
  }

  // ============================================================================
  //  SCENE B — macro fiber-cross-section inserts (hidden unless revealed)
  // ============================================================================
  // Sector-cutaway convention (same technique as jet-engine's casings): a
  // relying-on-transparency cutaway fails here because the buffer layer's own
  // near-side wall is nearly opaque and hides the cladding/core BEHIND it —
  // the classic "metal can't be ghosted" trap, applied to a coated fibre.
  // Instead the EXPOSED (near) span of buffer and cladding is a solid cylinder
  // with a wedge angularly cut out (openEnded so it joins its neighbours with
  // no stray cap), opening toward +Z after the axis rotation, so the camera
  // looking into the open wedge sees the true layered structure directly —
  // no transparency required. The FAR (still-jacketed) span stays a plain
  // full-circumference tube per layer, hidden under the opaque jacket anyway.
  const GAP = 1.7; // ~97°, matches the jet-engine casing convention
  function sectorLayer(r, len, xCenter, mat) {
    const geo = new THREE.CylinderGeometry(r, r, len, 40, 1, true, GAP / 2, Math.PI * 2 - GAP);
    geo.rotateZ(-Math.PI / 2); // axis → local +X, gap opens toward +Z
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.x = xCenter;
    mesh.castShadow = true;
    return mesh;
  }
  function fullLayer(r, len, xCenter, mat, openEnded = true) {
    const geo = new THREE.CylinderGeometry(r, r, len, 40, 1, openEnded);
    geo.rotateZ(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.x = xCenter;
    mesh.castShadow = true;
    return mesh;
  }

  function buildInsert(coreR, jacketMat, glowColor) {
    const g = new THREE.Group();
    const nearLen = INS_LEN * (1 - INS_STRIP);
    const farLen = INS_LEN * INS_STRIP;
    const nearX = nearLen / 2;
    const farX = nearLen + farLen / 2;

    // far (jacketed) segment — solid, sealed, opaque
    const jacket = fullLayer(INS_JACKET_R, farLen, farX, jacketMat, true);
    g.add(jacket);
    // rounded cap at the true (far, still-sealed) tip — "no flat cut faces"
    const jacketCap = new THREE.Mesh(
      new THREE.SphereGeometry(INS_JACKET_R, 24, 12, 0, TAU, 0, Math.PI / 2),
      jacketMat,
    );
    jacketCap.rotation.z = -Math.PI / 2;
    jacketCap.position.x = INS_LEN;
    g.add(jacketCap);

    // buffer + cladding: full (hidden) under the jacket, wedge-cut where exposed
    const bufferFar = fullLayer(INS_BUFFER_R, farLen, farX, bufferAmber);
    const bufferNear = sectorLayer(INS_BUFFER_R, nearLen, nearX, bufferAmber);
    g.add(bufferFar, bufferNear);
    const claddingFar = fullLayer(INS_CLAD_R, farLen, farX, claddingGlass);
    const claddingNear = sectorLayer(INS_CLAD_R, nearLen, nearX, claddingGlass);
    g.add(claddingFar, claddingNear);

    // core: one continuous glowing rod, full circumference the whole way —
    // it is the smallest, innermost layer and the whole point of the reveal.
    // Its near tip is a genuine flat cleaved/polished face (real fibre ends
    // ARE flat-polished — this is accurate, not a truncation tell).
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(coreR, coreR, INS_LEN, 16),
      coreGlowMat(glowColor),
    );
    core.rotation.z = -Math.PI / 2;
    core.position.x = INS_LEN / 2;
    g.add(core);

    return { group: g, jacket, buffer: bufferNear, cladding: claddingNear, core, coreR };
  }
  // PRIMARY insert (steps 3-4, cutaway + TIR): single-mode, YELLOW jacket —
  // matches the hero cable ("strip back the yellow jacket") for continuity.
  // Reviewer caught this: the cutaway previously opened a TEAL multi-mode
  // insert right after copy said "strip back the yellow jacket," a jacket-
  // colour/mode mismatch against step 1's own "yellow marks single-mode"
  // label. Multi-mode is now introduced fresh, correctly labeled, only in
  // the step 5 comparison.
  const primaryInsert = buildInsert(INS_CORE_R_SM, jacketYellow, 0xff3b30);
  primaryInsert.group.position.copy(PRIMARY_INSERT_POS);
  primaryInsert.group.rotation.y = 0.25;
  group.add(primaryInsert.group);
  macroMeshes.push(primaryInsert.group);
  // Single-mode's core is razor-thin (0.013 world units) — a dim core the
  // way a fat multi-mode core stays dim would be imperceptible at that
  // radius. Brightening it is correct, not inconsistent: a thin bright
  // hairline IS the visual point ("light travels in an almost dead-straight
  // line"), whereas a fat core stays dim so the bouncing ray riding inside it
  // (the moving highlight) still reads against it.
  primaryInsert.core.material.emissiveIntensity = 1.6;
  primaryInsert.core.material.opacity = 0.95;

  // COMPARE insert (step 5 only): multi-mode, AQUA jacket (OM3/OM4
  // convention) — introduced fresh, beside the single-mode one, for the
  // "one path vs many" contrast. Stays at the default dim core treatment
  // (see coreGlowMat) since its fat core needs the dimming for the bouncing
  // ray to read against it.
  const compareInsert = buildInsert(INS_CORE_R_MM, jacketAqua, 0xff3b30);
  compareInsert.group.position.copy(COMPARE_INSERT_POS);
  compareInsert.group.rotation.y = -0.15;
  group.add(compareInsert.group);
  macroMeshes.push(compareInsert.group);

  // --- TIR ray paths: chainPath() gives a single 0-1 parameter across a
  // zigzag polyline for free (getPointAt/getTangentAt), reused directly for
  // both the static "light path" line and the moving highlight (chargeQueue
  // rides anything with getPointAt). The compare (multi-mode) insert bounces
  // visibly at its TRUE core-radius amplitude (3 full bounces across the
  // visible segment — compressed for legibility; a real fiber reflects
  // thousands of times per metre). The primary (single-mode) insert's TRUE
  // core is too thin for any visible bounce at all — that IS the physics
  // (single-mode reads as essentially straight) — so its ray amplitude is a
  // DELIBERATE, disclosed exaggeration purely so the step-4 TIR teaching
  // beat has something to show; step 5 then contrasts it against the
  // compare insert's much wider, true-scale bounce.
  function zigzagSegments(insert, bounces, amplitude, localZ) {
    const x0 = INS_LEN * 0.06;
    const x1 = INS_LEN * (INS_STRIP - 0.04);
    const steps = bounces * 2;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps;
      const y = i % 2 === 0 ? amplitude : -amplitude;
      pts.push(new THREE.Vector3(x, y, localZ));
    }
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i].toArray(), pts[i + 1].toArray()]);
    return segs;
  }
  const primaryZigzag = chainPath(zigzagSegments(primaryInsert, 2, 0.05, 0));
  const compareZigzag = chainPath(zigzagSegments(compareInsert, 3, 0.13, 0));
  // Reviewer round 2: the step-4 TIR teaching beat needs a CLEARLY visible
  // single-mode bounce (hence primaryZigzag's exaggerated 0.05 amplitude,
  // unchanged from before), but reusing that same wide zigzag in step 5's
  // comparison made single-mode look almost as bouncy as multi-mode — that
  // directly contradicted the copy ("almost dead-straight" vs "zigzags at
  // several angles"). So step 5 gets its OWN, near-flat ray on the same
  // insert (never shown at the same time — gated by `mode` in applyBounce
  // below), while multi-mode's ray is pushed out toward the cladding wall
  // for a dramatic, unambiguous contrast.
  const primaryZigzagFlat = chainPath(zigzagSegments(primaryInsert, 1, 0.014, 0));

  function rayVisual(insertGroup, zigzag, color) {
    // faint static path line so the full zigzag shape reads at a glance
    const pts = [];
    for (let i = 0; i <= 40; i++) pts.push(zigzag.getPointAt(i / 40));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.15);
    const lineMat = new THREE.MeshPhysicalMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.3,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const line = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.012, 8, false), lineMat);
    insertGroup.add(line);
    // moving highlight riding the same parameter — brighter than the static
    // line so the "live" bounce still pops against it
    const queue = chargeQueue(zigzag, 3, color, { size: 0.03, spacing: 0.09 });
    for (const dot of queue.dots) dot.material.emissiveIntensity = 2.2;
    insertGroup.add(queue.group);
    return { line, queue };
  }
  const primaryRay = rayVisual(primaryInsert.group, primaryZigzag, 0xff5a3d);
  const compareRay = rayVisual(compareInsert.group, compareZigzag, 0xff5a3d);
  const primaryFlatRay = rayVisual(primaryInsert.group, primaryZigzagFlat, 0xff5a3d);

  // ============================================================================
  //  CALLOUTS
  // ============================================================================
  const setsOf = { exterior: [], connect: [], cutaway: [], tir: [], compare: [], data: [] };
  function addCallout(set, parent, text, offset, dir, len) {
    const c = callout(text, { dir, len });
    c.position.set(...offset);
    parent.add(c);
    c.visible = false;
    setsOf[set].push(c);
  }
  addCallout('exterior', group, 'Jacket — yellow marks single-mode', [0.3, COIL_Y + 0.35, 0.4], 35, 60);
  addCallout('exterior', standModule.group, 'LC connector', [0, 0.28, 0.05], 60, 54);
  addCallout('exterior', portModule.group, 'Transceiver module', [0.1, 0.25, 0], -60, 60);

  addCallout('connect', standModule.group, '1.25 mm ceramic ferrule', [0, 0.02, 0.3], 20, 62);
  addCallout('connect', standModule.group, 'LC connector', [0, 0.2, 0.1], 70, 54);

  addCallout('cutaway', primaryInsert.group, 'Jacket', [INS_LEN * 0.8, INS_JACKET_R + 0.04, 0], 60, 54);
  addCallout('cutaway', primaryInsert.group, 'Buffer coating', [INS_LEN * 0.35, INS_BUFFER_R + 0.03, 0], 40, 60);
  addCallout('cutaway', primaryInsert.group, 'Cladding — 125 µm', [INS_LEN * 0.2, INS_CLAD_R + 0.02, 0], -20, 66);
  addCallout('cutaway', primaryInsert.group, 'Core — 9 µm (single-mode)', [INS_LEN * 0.1, INS_CORE_R_SM, 0], -70, 58);

  addCallout('tir', primaryInsert.group, 'Total internal reflection', [INS_LEN * 0.4, 0.05, 0], 45, 66);

  addCallout('compare', primaryInsert.group, 'Core — 9 µm (single-mode)', [INS_LEN * 0.15, INS_CORE_R_SM, 0], -60, 60);
  addCallout('compare', compareInsert.group, 'Core — 50 µm (multi-mode)', [INS_LEN * 0.15, INS_CORE_R_MM, 0], 60, 62);

  // attached to the STAND module — it's the one the step 6 camera actually
  // frames close; the far port module's labels would land behind the panel
  addCallout('data', standModule.group, 'Laser diode (VCSEL / DFB)', [-DUP_OFFSET, 0.1, 0.12], -60, 60);
  addCallout('data', standModule.group, 'Photodiode receiver', [DUP_OFFSET, 0.1, 0.12], 60, 58);

  // ============================================================================
  //  POSE
  // ============================================================================
  const BIT_PATTERN = [1, 0, 1, 1, 0, 1, 0, 0];
  const PULSE_DOTS = 24; // 3 repeats of the 8-bit pattern riding the loop
  const pulseDotsTx = [];
  const pulseDotsRx = [];
  function buildPulseDots(arr, color) {
    for (let i = 0; i < PULSE_DOTS; i++) {
      const mat = materials.glow(color, 1.5);
      mat.transparent = true;
      mat.opacity = 0;
      mat.depthWrite = false;
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), mat);
      group.add(dot);
      arr.push(dot);
    }
  }
  buildPulseDots(pulseDotsTx, 0xff5a3d);
  buildPulseDots(pulseDotsRx, 0x38e1ff);

  function applyPulse(phase, on) {
    const curveTx = lobeTx.userData.curve;
    const curveRx = lobeRx.userData.curve;
    pulseDotsTx.forEach((dot, i) => {
      const bit = BIT_PATTERN[i % BIT_PATTERN.length];
      if (!on || !bit) {
        dot.material.opacity = 0;
        return;
      }
      const t = ((phase + i / PULSE_DOTS) % 1 + 1) % 1;
      dot.position.copy(curveTx.getPointAt(t));
      dot.material.opacity = 0.95;
    });
    pulseDotsRx.forEach((dot, i) => {
      const bit = BIT_PATTERN[(i + 3) % BIT_PATTERN.length];
      if (!on || !bit) {
        dot.material.opacity = 0;
        return;
      }
      // travels the OPPOSITE direction — full duplex, both ways at once
      const t = ((1 - phase + i / PULSE_DOTS) % 1 + 1) % 1;
      dot.position.copy(curveRx.getPointAt(t));
      dot.material.opacity = 0.95;
    });
    const glow = on ? 0.5 + 0.5 * Math.sin(phase * TAU * 4) : 0;
    portModule.laser.material.emissiveIntensity = glow * 2.2;
    standModule.laser.material.emissiveIntensity = glow * 2.2 * 0.7;
    portModule.photo.material.emissiveIntensity = glow * 1.8 * 0.7;
    standModule.photo.material.emissiveIntensity = glow * 1.8;
  }

  let comparing = false; // true while step 5's mode is active
  function applyBounce(t, on) {
    const teachOn = on && !comparing;
    const flatOn = on && comparing;
    primaryRay.queue.setFront(teachOn ? clamp01(t) : 0, teachOn);
    primaryFlatRay.queue.setFront(flatOn ? clamp01(t) : 0, flatOn);
    compareRay.queue.setFront(on ? clamp01(t) : 0, on);
    primaryRay.line.material.opacity = teachOn ? 0.35 : 0;
    primaryFlatRay.line.material.opacity = flatOn ? 0.35 : 0;
    compareRay.line.material.opacity = on ? 0.35 : 0;
  }

  let revealed = false;
  function setReveal(t) {
    const r = clamp01(t);
    revealed = r > 0.5;
    const op = 1 - r * 0.72; // 1 → 0.28
    for (const m of revealDim) {
      const mat = m.material;
      mat.transparent = r > 0.02;
      mat.opacity = op;
      mat.depthWrite = r < 0.4;
    }
    for (const m of macroMeshes) m.visible = r > 0.4;
    if (!revealed) {
      applyBounce(0, false);
    }
  }

  function setMode(t) {
    const m = clamp01(t);
    comparing = m > 0.4;
    compareInsert.group.visible = revealed && comparing;
  }

  function setLabels(mode) {
    for (const [k, arr] of Object.entries(setsOf)) {
      for (const c of arr) c.visible = k === mode;
    }
  }

  function setSpin(a) {
    group.rotation.y = a;
  }

  // initial: complete, sealed, connected
  setReveal(0);
  setMode(0);
  applyConnect(1);
  applyPulse(0, false);
  applyBounce(0, false);
  setLabels(false);

  return {
    group: sceneGroup,
    setSpin,
    setReveal,
    setMode,
    setConnect: applyConnect,
    setBounce: applyBounce,
    setPulse: applyPulse,
    setLabels,
    parts: { lobeTx, lobeRx, primaryInsert, compareInsert, connPort, connStand },
  };
}
