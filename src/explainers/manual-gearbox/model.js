import * as THREE from 'three';
import { materials, rod } from '../../framework/parts.js';
import { beveledBox, lathe, gear, boltCircle, chainPath } from '../../framework/geometry.js';
import { callout } from '../../framework/labels.js';
import { smudgeMap } from '../../framework/textures.js';

// A longitudinal 5-speed constant-mesh gearbox (classic RWD, Tremec-T5-ish),
// presented as a studio product shot on a charcoal plinth.
//
// PROPORTIONS FIRST (real box: ~600 mm long, barrel ~ø260 mm, bellhousing
// face ~1.4× the barrel, output flange ~ø120 mm):
//   case ≈ 1.27 × longer than tall · bell face ≈ 1.4 × barrel width ·
//   gear cluster spans ≈ 80 % of the case · biggest gear (1st driven, 35 T)
//   ≈ 2.3 × the smallest (14 T reverse pinion).
//
// REAL NUMBERS. Every meshing pair shares one module (0.012 world-units of
// pitch radius per tooth) so all forward pairs sum to 50 teeth and share one
// centre distance — exactly like a real box. Tooth counts → ratios:
//   input 20:30 (×1.5) · 1st 15:35 (3.50:1) · 2nd 22:28 (1.91:1)
//   3rd 25:25 (1.50:1) · 4th direct (1.00:1) · 5th 32:18 (0.84:1, overdrive)
//   reverse 14 → 16 idler → 30 (3.21:1, backwards, straight-cut spur).
//
// SEAMLESS LOOPS: gears carry no unique marks, so a pose repeats whenever
// each gear advances a WHOLE number of teeth — which happens automatically
// whenever the layshaft advances whole turns (every lay gear is fixed to the
// cluster; each driven gear then advances exactly its partner's tooth count).
// So every timeline lap advances the layshaft an integer number of turns.
// Parts locked to the MAINSHAFT (hubs, sleeves, flange) are rotationally
// symmetric / fine-splined by design, so the mainshaft may land anywhere.
//
// MESH PHASING: for gears A (driving, N_A teeth) and B (N_B) with B at local
// angle alpha as seen from A, B's angle is  -theta_A·N_A/N_B + C  with
// C = alpha·(1 + N_A/N_B) + PI·(1 - 1/N_B):  tooth meets gap along the line
// of centres for ANY theta_A. All gears sit in identical holders
// (rotation.y = PI/2 → spin about local +Z == world +X), so one derivation
// serves every pair, including the reverse idler chain.

const TAU = Math.PI * 2;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smooth = (t) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
const win = (u, a, b) => smooth((u - a) / (b - a));

// --- layout ---------------------------------------------------------------
const MODULE_R = 0.012; // pitch radius per tooth
const TOOTH_D = 0.05; // radial tooth depth of the working gears
const LAY_Y = 0.95;
const MAIN_Y = 1.55;
const GEAR_T = 0.11;

// x positions of the constant-mesh pairs (front/bellhousing at -X)
const PAIRS = {
  in: { x: -0.85, Nl: 30, Nm: 20 }, // cluster head gear ↔ input gear
  g3: { x: -0.3, Nl: 25, Nm: 25 },
  g2: { x: 0.0, Nl: 22, Nm: 28 },
  g1: { x: 0.56, Nl: 15, Nm: 35 },
  g5: { x: 0.92, Nl: 32, Nm: 18 },
};
const REV = { x: 0.74, Nlay: 14, Nidler: 16, Nmain: 30 };

// --- shift rails ------------------------------------------------------------
// Above the tallest gear crown, not level with it: the rails sit in the top
// cover in a real box, and at 1.92 these ran straight through 1st (crown
// 1.995), 2nd (1.911) and the reverse gear (1.935). Anything that raises a
// tooth count or MODULE_R has to re-check this — crown = MAIN_Y + Nm*MODULE_R
// + TOOTH_D/2. Module scope because the reverse arm pivots on the 5-R rail.
const MAX_CROWN =
  MAIN_Y + Math.max(...Object.values(PAIRS).map((p) => p.Nm), REV.Nmain) * MODULE_R + TOOTH_D / 2;
const RAIL_R = 0.018;
const RAIL_Y = MAX_CROWN + RAIL_R + 0.027; // 2.04 — clears the crown by 0.027
const RAIL_Z = { s12: 0.13, s34: 0, s5: -0.13 };

const HUBS = { h34: -0.58, h12: 0.28, h5: 1.14 };
const THROW = 0.13; // sleeve travel from neutral to fully engaged
const DOG_TEETH = 24;
const DOG_R = 0.16;

const CASE_X0 = -1.05;
const CASE_X1 = 1.12;
const CASE_Y0 = 0.42;
// Roof set by what has to fit UNDER it, not by a target silhouette: the 35-tooth
// 1st driven gear crowns at MAIN_Y + 35*MODULE_R + TOOTH_D/2 = 1.995, the shift
// rails have to clear that crown (see RAIL_Y), and the roof has to clear the
// rails. Ignoring that chain is how the rails ended up running THROUGH 1st, 2nd
// and the reverse gear.
const CASE_Y1 = 2.13;
const FLANGE_X = 1.62;

// lay→main angle factor per forward gear (driven angle = -lay·R + C)
const R_FWD = { g1: 15 / 35, g2: 22 / 28, g3: 25 / 25, g5: 32 / 18 };

// --- per-gear identity ------------------------------------------------------
// Every wheel in a real box is the same steel, and that is exactly why the
// picture was unreadable: five ratios rendering as one silver caterpillar.
// Each constant-mesh PAIR (cluster pinion + its mainshaft partner) now shares
// one desaturated accent steel, so a gear keeps its identity even when it is
// not the pair carrying drive. The input pair stays neutral — it drives in
// every gear — and so does 4th, which is direct and has no pair of its own.
// Kept close to the base steel on purpose: at full saturation the box read as
// moulded plastic, which is a worse lie than the one this fixes. These are
// roughly a quarter-saturated, so they read as tinted metal and still separate
// at a glance. No warm gold in the set on purpose: the power-path highlight is
// a warm glow, and a gold gear at rest was confusable with a lit one.
const GEAR_TINT = {
  g1: 0xc79a8e, // 1st — copper rose
  g2: 0x9bc0a4, // 2nd — sage
  g3: 0x8fa9cc, // 3rd — steel blue
  g5: 0xb09ac9, // 5th — muted violet
  rev: 0x6fadb0, // reverse — cyan, darker than the rest: it was too close to
  //                 2nd's sage to pick the idler out of the train at a glance,
  //                 and reverse being the odd one out is the point of the step
};

// mainshaft turns per layshaft turn, per gear. 4th bypasses the cluster
// entirely: the sleeve locks the mainshaft to the INPUT shaft, so it runs at
// the input pair's ratio. Overall engine:output = (Nl/Nm of input) / this.
const MAIN_FACTOR = {
  1: R_FWD.g1,
  2: R_FWD.g2,
  3: R_FWD.g3,
  4: PAIRS.in.Nl / PAIRS.in.Nm,
  5: R_FWD.g5,
};

// live-readout copy per gear (the ratio table has always existed in this file
// and never once reached the screen)
// Kept short on purpose — this is one pill on one line, and the longest string
// here sets how far the readout can sit from the frame's right edge.
const GEAR_INFO = {
  1: ['1st', '15 : 35 teeth', '3.50 : 1'],
  2: ['2nd', '22 : 28 teeth', '1.91 : 1'],
  3: ['3rd', '25 : 25 teeth', '1.50 : 1'],
  4: ['4th', 'direct drive', '1.00 : 1'],
  5: ['5th', '32 : 18 — overdrive', '0.84 : 1'],
};

// --- the shift gate ---------------------------------------------------------
// [rail select, throw] per gear: select -1 = the 1-2 rail, 0 = 3-4, +1 = 5th;
// throw is which side of neutral that rail's sleeve sits.
const GATE = { 1: [-1, 1], 2: [-1, -1], 3: [0, 1], 4: [0, -1], 5: [1, 1] };

// gate pose partway (m in 0..1) through a change from gear `from` to gear `to`:
// the throw comes out to neutral, the selector crosses to the new rail while it
// is there, and the throw goes back in. thr passes through zero exactly as sel
// crosses, so no sleeve is ever part-engaged on a rail the lever has left.
function gateAt(from, to, m) {
  const [s0, t0] = GATE[from];
  const [s1, t1] = GATE[to];
  const thr = m < 0.5 ? t0 * (1 - m * 2) : t1 * (m * 2 - 1);
  return [s0 + (s1 - s0) * smooth((m - 0.25) / 0.5), thr];
}

// how much of `thr` a given rail's sleeve takes, by how close the selector is
const railWeight = (sel, at) => Math.max(0, 1 - Math.abs(sel - at));

// shortest equivalent of an angle difference, so a crossfade between two mesh
// poses takes the short way round instead of spinning up to a full extra turn
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const meshC = (alpha, NA, NB) => alpha * (1 + NA / NB) + Math.PI * (1 - 1 / NB);

// reverse idler centre, solved from the two mesh distances
const dLI = (REV.Nlay + REV.Nidler) * MODULE_R;
const dIM = (REV.Nidler + REV.Nmain) * MODULE_R;
const CD = MAIN_Y - LAY_Y;
const IDLER_DY = (dLI * dLI + CD * CD - dIM * dIM) / (2 * CD);
const IDLER_Y = LAY_Y + IDLER_DY;
const IDLER_Z = Math.sqrt(dLI * dLI - IDLER_DY * IDLER_DY);

// local mesh angle of a neighbour: gears spin about world +X; in holder-local
// coordinates (rotation.y = PI/2), local X = world -Z and local Y = world +Y.
const localAngle = (dy, dz) => Math.atan2(dy, -dz);
const A_UP = localAngle(1, 0); // partner straight above (all forward pairs)
const A_LI = localAngle(IDLER_DY, IDLER_Z); // idler as seen from the lay pinion
const A_IM = localAngle(MAIN_Y - IDLER_Y, -IDLER_Z); // rev gear as seen from idler

const C_FWD = {};
for (const k of ['g1', 'g2', 'g3', 'g5']) {
  C_FWD[k] = meshC(A_UP, PAIRS[k].Nl, PAIRS[k].Nm);
}
const C_IN = meshC(A_UP, PAIRS.in.Nl, PAIRS.in.Nm);
const C_LI = meshC(A_LI, REV.Nlay, REV.Nidler);
const C_IM = meshC(A_IM, REV.Nidler, REV.Nmain);
// reverse chain collapsed: revMain = +lay·(14/30) + K_REV. The + sign is the
// whole point — the extra idler flips the output direction.
const K_REV = -C_LI * (REV.Nidler / REV.Nmain) + C_IM;

const fwdTheta = (k, lay) => -lay * (PAIRS[k].Nl / PAIRS[k].Nm) + C_FWD[k];
const inputTheta = (lay) => -lay * (PAIRS.in.Nl / PAIRS.in.Nm) + C_IN;
const idlerTheta = (lay) => -lay * (REV.Nlay / REV.Nidler) + C_LI;
const revMainTheta = (lay) => lay * (REV.Nlay / REV.Nmain) + K_REV;

// helical twist: a constant CIRCUMFERENTIAL shift across the face width, so
// mating flanks stay parallel at the contact line (shift/pitchR = twist
// angle). Cluster gears are one hand, everything they drive the other; the
// reverse trio stays straight-cut — that's why reverse whines.
const HELIX_SHIFT = 0.05;

// numerically integrated speed profile → layshaft angle, scaled so one lap
// advances EXACTLY `laps` whole turns (the seamlessness contract above).
function profileTable(rateFn, laps, N = 1024) {
  const cum = new Float64Array(N + 1);
  let acc = 0;
  for (let i = 0; i < N; i++) {
    acc += ((rateFn(i / N) + rateFn((i + 1) / N)) / 2) * (1 / N);
    cum[i + 1] = acc;
  }
  const k = (laps * TAU) / acc;
  const at = (u) => {
    const x = clamp01(u) * N;
    const i = Math.min(N - 1, Math.floor(x));
    return (cum[i] + (cum[i + 1] - cum[i]) * (x - i)) * k;
  };
  return { at, k };
}

export function buildGearbox({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // --- materials ----------------------------------------------------------
  // The extruded gear geometry has ad-hoc UVs, so these stay MAP-FREE with
  // moderate roughness — the brushed presets' roughness maps sample garbage
  // texels on extrusions and turn every flat tooth face into a mirror.
  const caseAlu = materials.aluminum(0xb4bac1);
  caseAlu.roughness = 0.85;
  caseAlu.normalScale.set(0.09, 0.09); // cast dimples read as froth at case scale
  const caseAlu2 = materials.aluminum(0xa9afb7);
  caseAlu2.roughness = 0.75;
  caseAlu2.normalScale.set(0.09, 0.09);
  const gearSteel = new THREE.MeshPhysicalMaterial({
    color: 0xb6bbc3,
    metalness: 0.85,
    roughness: 0.62,
  });
  // one accent steel per constant-mesh pair (see GEAR_TINT). Same metalness
  // and roughness as the base gear steel — only the tint of the reflection
  // changes, so a tinted gear still reads as a machined part, not a toy.
  const tintSteel = (hex) => {
    const m = gearSteel.clone();
    m.color.setHex(hex);
    return m;
  };
  const gearTint = {
    g1: tintSteel(GEAR_TINT.g1),
    g2: tintSteel(GEAR_TINT.g2),
    g3: tintSteel(GEAR_TINT.g3),
    g5: tintSteel(GEAR_TINT.g5),
    rev: tintSteel(GEAR_TINT.rev),
  };
  const shaftSteel = new THREE.MeshPhysicalMaterial({
    color: 0xaeb3bb,
    metalness: 0.9,
    roughness: 0.52,
    anisotropy: 0.7,
    anisotropyRotation: 0,
  });
  const hubSteel = new THREE.MeshPhysicalMaterial({
    color: 0x3d434c,
    metalness: 0.9,
    roughness: 0.48,
    anisotropy: 0.7,
    anisotropyRotation: 0,
  });
  const sleeveSteel = new THREE.MeshPhysicalMaterial({
    color: 0x99a1ad,
    metalness: 0.9,
    roughness: 0.48,
  });
  const brassBase = new THREE.MeshPhysicalMaterial({
    color: 0xc9a15a,
    metalness: 1,
    roughness: 0.42,
  });
  const railSteel = new THREE.MeshPhysicalMaterial({
    color: 0xc2c7ce,
    metalness: 1,
    roughness: 0.32,
  });
  // The output flange's domed retaining nut is a near-spherical mirror against
  // the black background — at roughness ≤0.52 its softbox reflection exceeds
  // the bloom threshold and flares into a white halo on every wide shot. A
  // dedicated, rougher steel spreads that highlight below threshold.
  const flangeSteel = new THREE.MeshPhysicalMaterial({
    color: 0x9ea3ab,
    metalness: 0.85,
    roughness: 0.72,
  });
  const darkIron = materials.darkMetal(0x2a2e34);
  const forkIron = materials.darkMetal(0x474d56);
  // softened clearcoat: the default painted preset's coat streak was the one
  // clipped-white patch in the whole scene (verified via gl.readPixels bisect)
  const plinthMat = materials.paintedMetal(0x1b1d21);
  plinthMat.clearcoat = 0.45;
  plinthMat.clearcoatRoughness = 0.32;
  plinthMat.clearcoatRoughnessMap = smudgeMap();
  plinthMat.roughness = 0.55;
  const knobRubber = materials.rubber(0x121316);
  const linerDark = new THREE.MeshStandardMaterial({
    color: 0x14161a,
    metalness: 0.3,
    roughness: 0.95,
    side: THREE.DoubleSide,
  });

  // --- plinth (always visible) ----------------------------------------------
  const plinth = beveledBox(3.7, 0.26, 1.9, plinthMat, 0.06);
  plinth.position.set(0.15, 0.13, 0);
  plinth.receiveShadow = true;
  group.add(plinth);

  // --- helical gear helper ----------------------------------------------------
  function twistGeo(geo, totalTwist) {
    if (!totalTwist) return;
    const pos = geo.getAttribute('position');
    let zMin = Infinity;
    let zMax = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      if (z < zMin) zMin = z;
      if (z > zMax) zMax = z;
    }
    for (let i = 0; i < pos.count; i++) {
      const a = totalTwist * ((pos.getZ(i) - zMin) / (zMax - zMin) - 0.5);
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setXY(i, x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  // gear in a holder oriented so spinning = mesh.rotation.z about world +X.
  // hand: +1 cluster helix, -1 driven helix, 0 straight-cut. pitchR defaults
  // to the module (meshing gears) but can be overridden (splines, dog rings).
  function axGear(
    { teeth, thickness = GEAR_T, hand = 0, holeR = 0.05, depth = TOOTH_D, pitchR },
    mat,
  ) {
    const pr = pitchR ?? teeth * MODULE_R;
    // OWN material per gear: the power-path highlight tints only the pair that
    // is actually driving, and a shared material instance would light the whole
    // box at once. Cheap here — these are already separate meshes.
    const mesh = gear({ teeth, radius: pr + depth / 2, toothDepth: depth, thickness, holeR }, mat.clone());
    if (hand) twistGeo(mesh.geometry, hand * (HELIX_SHIFT / pr));
    const holder = new THREE.Group();
    holder.rotation.y = Math.PI / 2;
    holder.add(mesh);
    return { holder, mesh, pitchR: pr };
  }

  const caseMeshes = []; // hidden on reveal (metal can't be ghosted)

  // --- casing -------------------------------------------------------------------
  {
    const barrel = beveledBox(CASE_X1 - CASE_X0, CASE_Y1 - CASE_Y0, 1.12, caseAlu, 0.18);
    barrel.position.set((CASE_X0 + CASE_X1) / 2, (CASE_Y0 + CASE_Y1) / 2, 0);
    caseMeshes.push(barrel);

    // reverse-idler bulge on the +Z flank
    const bulge = beveledBox(0.66, 0.62, 0.3, caseAlu, 0.1);
    bulge.position.set(0.88, 1.1, 0.47);
    caseMeshes.push(bulge);

    // cast ribs: top, both flanks
    for (let i = 0; i < 4; i++) {
      const rib = beveledBox(1.86, 0.05, 0.045, caseAlu2, 0.012);
      rib.position.set(0.03, CASE_Y1 + 0.01, -0.36 + i * 0.24);
      caseMeshes.push(rib);
    }
    for (let i = 0; i < 3; i++) {
      const ribL = beveledBox(1.86, 0.045, 0.05, caseAlu2, 0.012);
      ribL.position.set(0.03, 0.9 + i * 0.34, -0.56);
      caseMeshes.push(ribL);
      const ribR = beveledBox(0.9, 0.045, 0.05, caseAlu2, 0.012);
      ribR.position.set(-0.55, 0.9 + i * 0.34, 0.56);
      caseMeshes.push(ribR);
    }

    // mounting feet onto the plinth
    for (const fx of [-0.75, 0.8]) {
      const foot = beveledBox(0.34, 0.2, 1.0, caseAlu2, 0.04);
      foot.position.set(fx, 0.36, 0);
      caseMeshes.push(foot);
    }

    // bellhousing: adapter plate + open-mouthed bell (a real bell bolts to
    // the engine and is OPEN at the front — the clutch splines show through)
    const plate = beveledBox(0.12, 1.56, 1.28, caseAlu2, 0.05);
    plate.position.set(CASE_X0 - 0.06, 1.26, 0);
    caseMeshes.push(plate);
    const bell = lathe(
      [
        [0.6, 0],
        [0.66, 0.1],
        [0.72, 0.2],
        [0.82, 0.23],
        [0.82, 0.3],
        [0.3, 0.3],
      ],
      caseAlu,
      48,
    );
    bell.rotation.z = Math.PI / 2; // +Y → -X
    bell.position.set(CASE_X0 - 0.12, MAIN_Y, 0);
    caseMeshes.push(bell);
    const bellLiner = lathe(
      [
        [0.56, 0.01],
        [0.64, 0.19],
        [0.78, 0.22],
        [0.78, 0.28],
      ],
      linerDark,
      48,
    );
    bellLiner.rotation.z = Math.PI / 2;
    bellLiner.position.set(CASE_X0 - 0.125, MAIN_Y, 0);
    caseMeshes.push(bellLiner);
    const bellBolts = boltCircle(8, 0.74, 0.032, darkIron, 0.045);
    bellBolts.rotation.z = -Math.PI / 2; // ring faces -X
    bellBolts.position.set(CASE_X0 - 0.41, MAIN_Y, 0);
    caseMeshes.push(bellBolts);

    // tailhousing cone — WIDE at the case, tapering to the output bush
    const tail = lathe(
      [
        [0.46, 0],
        [0.44, 0.1],
        [0.3, 0.26],
        [0.2, 0.4],
        [0.17, 0.5],
      ],
      caseAlu,
      40,
    );
    tail.rotation.z = -Math.PI / 2; // +Y → +X
    tail.position.set(CASE_X1, MAIN_Y, 0);
    caseMeshes.push(tail);
    const tailBolts = boltCircle(6, 0.4, 0.028, darkIron, 0.045);
    tailBolts.rotation.z = Math.PI / 2;
    tailBolts.position.set(CASE_X1 + 0.03, MAIN_Y, 0);
    caseMeshes.push(tailBolts);

    // shift tower
    const tower = beveledBox(0.32, 0.18, 0.24, caseAlu2, 0.04);
    tower.position.set(0.5, CASE_Y1 + 0.08, 0);
    caseMeshes.push(tower);
    const towerBolts = boltCircle(4, 0.11, 0.02, darkIron, 0.03);
    towerBolts.position.set(0.5, CASE_Y1 + 0.18, 0);
    caseMeshes.push(towerBolts);

    // side cover with bolts on the -Z flank
    const cover = beveledBox(0.64, 0.46, 0.05, caseAlu2, 0.03);
    cover.position.set(-0.35, 1.26, -0.56);
    caseMeshes.push(cover);
    const coverBolts = boltCircle(6, 0.24, 0.022, darkIron, 0.04);
    coverBolts.rotation.x = -Math.PI / 2; // bolts point -Z, proud of the cover
    coverBolts.position.set(-0.35, 1.26, -0.585);
    caseMeshes.push(coverBolts);

    // drain + filler plugs
    const drain = rod(0.045, 0.06, darkIron, 6);
    drain.rotation.x = Math.PI;
    drain.position.set(0.1, CASE_Y0 + 0.01, 0.2);
    caseMeshes.push(drain);
    const filler = rod(0.045, 0.06, darkIron, 6);
    filler.rotation.x = -Math.PI / 2;
    filler.position.set(0.32, 1.45, 0.55);
    caseMeshes.push(filler);

    for (const m of caseMeshes) group.add(m);
  }

  // lever pivots on the tower — animated in the finale run-through
  const leverPivot = new THREE.Group();
  leverPivot.position.set(0.5, CASE_Y1 + 0.16, 0);
  const leverRod = rod(0.026, 0.48, railSteel, 12);
  leverPivot.add(leverRod);
  const leverBoot = lathe(
    [
      [0.085, 0],
      [0.065, 0.05],
      [0.042, 0.1],
    ],
    knobRubber,
    20,
  );
  leverPivot.add(leverBoot);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 16), knobRubber);
  knob.castShadow = true;
  knob.position.y = 0.48;
  leverPivot.add(knob);
  group.add(leverPivot);
  caseMeshes.push(leverPivot);

  // --- input assembly: clutch splines + stub + input gear + 4th dog ------------
  const inputAsm = new THREE.Group();
  inputAsm.position.set(0, MAIN_Y, 0);
  group.add(inputAsm);
  {
    const stub = rod(0.062, 0.62, shaftSteel, 24);
    stub.rotation.z = Math.PI / 2; // +Y → -X: spans -0.72 … -1.34
    stub.position.x = -0.72;
    inputAsm.add(stub);
    const spline = axGear(
      { teeth: 14, thickness: 0.26, holeR: 0, depth: 0.022, pitchR: 0.072 },
      shaftSteel,
    );
    spline.holder.position.x = -1.2;
    inputAsm.add(spline.holder);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), shaftSteel);
    tip.castShadow = true;
    tip.position.x = -1.34;
    inputAsm.add(tip);
  }
  const inputGear = axGear({ teeth: PAIRS.in.Nm, hand: -1 }, gearSteel);
  inputGear.holder.position.x = PAIRS.in.x;
  inputAsm.add(inputGear.holder);
  {
    // 4th-gear dog ring + friction cone (direct drive lives on the input gear)
    const dog = axGear(
      { teeth: DOG_TEETH, thickness: 0.045, holeR: 0.1, depth: 0.022, pitchR: DOG_R },
      sleeveSteel,
    );
    dog.holder.position.x = PAIRS.in.x + GEAR_T / 2 + 0.035;
    inputAsm.add(dog.holder);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.128, 0.05, 28), gearSteel);
    cone.rotation.z = -Math.PI / 2;
    cone.position.x = PAIRS.in.x + GEAR_T / 2 + 0.075;
    cone.castShadow = true;
    inputAsm.add(cone);
  }

  // --- mainshaft assembly: shaft + hubs + reverse gear + flange (locked) --------
  const mainAsm = new THREE.Group();
  mainAsm.position.set(0, MAIN_Y, 0);
  group.add(mainAsm);
  {
    const shaft = rod(0.055, FLANGE_X + 0.75, shaftSteel, 24);
    shaft.rotation.z = -Math.PI / 2; // +Y → +X: spans -0.75 … 1.62
    shaft.position.x = -0.75;
    mainAsm.add(shaft);
    // plain round output flange — rotationally symmetric ON PURPOSE (see the
    // seamlessness note): domed retaining nut, no bolt pattern.
    const flange = lathe(
      [
        [0.075, 0],
        [0.155, 0.015],
        [0.16, 0.04],
        [0.155, 0.075],
        [0.1, 0.09],
        [0.07, 0.1],
        [0.07, 0.13],
        [0.055, 0.155],
        [0.001, 0.17],
      ],
      flangeSteel,
      48,
    );
    flange.rotation.z = -Math.PI / 2;
    flange.position.x = FLANGE_X - 0.03;
    mainAsm.add(flange);
  }
  // reverse driven gear — straight-cut, FIXED to the mainshaft
  const revMain = axGear({ teeth: REV.Nmain, thickness: 0.09 }, gearTint.rev);
  revMain.holder.position.x = REV.x;
  mainAsm.add(revMain.holder);

  // --- layshaft cluster: one rigid forging ----------------------------------------
  const clusterAsm = new THREE.Group();
  clusterAsm.position.set(0, LAY_Y, 0);
  group.add(clusterAsm);
  {
    const shaft = rod(0.062, 2.06, shaftSteel, 24);
    shaft.rotation.z = -Math.PI / 2;
    shaft.position.x = -1.02;
    clusterAsm.add(shaft);
  }
  const layGears = {};
  for (const k of ['in', 'g3', 'g2', 'g1', 'g5']) {
    const lg = axGear({ teeth: PAIRS[k].Nl, hand: 1 }, gearTint[k] ?? gearSteel);
    lg.holder.position.x = PAIRS[k].x;
    clusterAsm.add(lg.holder);
    layGears[k] = lg; // kept so the power path can light the driving gear
  }
  const layRev = axGear({ teeth: REV.Nlay, thickness: 0.1 }, gearTint.rev); // spur
  layRev.holder.position.x = REV.x;
  clusterAsm.add(layRev.holder);
  // connecting drums make the cluster read as one forging
  for (const [x0, x1] of [
    [-0.79, -0.36],
    [-0.24, -0.06],
    [0.06, 0.5],
    [0.62, 0.68],
    [0.8, 0.86],
  ]) {
    const drum = rod(0.1, x1 - x0, shaftSteel, 20);
    drum.rotation.z = -Math.PI / 2;
    drum.position.x = x0;
    clusterAsm.add(drum);
  }

  // --- freewheeling speed gears on the mainshaft -----------------------------------
  // Each spins at its own constant-mesh speed regardless of the shaft — that
  // IS constant mesh. Dog ring + friction cone face the synchro hub beside it.
  const speedGears = {};
  function speedGear(key, dogSide /* -1: dog faces -X, +1: faces +X */) {
    const p = PAIRS[key];
    const holder = new THREE.Group();
    holder.rotation.y = Math.PI / 2;
    holder.position.set(p.x, MAIN_Y, 0);
    const spinner = new THREE.Group();
    holder.add(spinner);
    const pr = p.Nm * MODULE_R;
    const g = gear(
      { teeth: p.Nm, radius: pr + TOOTH_D / 2, toothDepth: TOOTH_D, thickness: GEAR_T, holeR: 0.058 },
      (gearTint[key] ?? gearSteel).clone(), // own material — see axGear
    );
    twistGeo(g.geometry, -HELIX_SHIFT / pr);
    spinner.add(g);
    // hub bosses both sides (no flat cut faces); local +Z == world +X
    for (const s of [-1, 1]) {
      const boss = rod(0.085, 0.05, shaftSteel, 20);
      boss.rotation.x = Math.PI / 2; // +Y → +Z (local)
      boss.position.z = s === 1 ? GEAR_T / 2 : -GEAR_T / 2 - 0.05;
      spinner.add(boss);
    }
    // dog ring + brass-contact friction cone on the synchro side
    const dog = gear(
      { teeth: DOG_TEETH, radius: DOG_R + 0.011, toothDepth: 0.022, thickness: 0.045, holeR: 0.1 },
      sleeveSteel,
    );
    dog.position.z = dogSide * (GEAR_T / 2 + 0.035);
    spinner.add(dog);
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(dogSide > 0 ? 0.1 : 0.128, dogSide > 0 ? 0.128 : 0.1, 0.05, 28),
      gearSteel,
    );
    cone.rotation.x = Math.PI / 2;
    cone.position.z = dogSide * (GEAR_T / 2 + 0.075);
    cone.castShadow = true;
    spinner.add(cone);
    group.add(holder);
    speedGears[key] = { holder, spinner, mesh: g, dogX: p.x + dogSide * (GEAR_T / 2 + 0.055) };
  }
  speedGear('g3', -1); // 3-4 hub sits in front of 3rd
  speedGear('g2', 1); //  1-2 hub sits behind 2nd
  speedGear('g1', -1); // …and in front of 1st
  speedGear('g5', 1); //  5th hub sits behind 5th, into the tailhousing

  // --- synchro assemblies -------------------------------------------------------
  // fine-splined hub fixed to the shaft + sliding sleeve + brass blocker rings
  const sleeves = {};
  const blockerRings = [];
  function synchro(key, hubX, sides) {
    const hub = axGear(
      { teeth: 36, thickness: 0.09, holeR: 0.06, depth: 0.018, pitchR: 0.155 },
      hubSteel,
    );
    hub.holder.position.x = hubX;
    mainAsm.add(hub.holder);

    const sleeve = lathe(
      [
        [0.19, 0],
        [0.265, 0.008],
        [0.265, 0.052],
        [0.232, 0.062],
        [0.232, 0.098],
        [0.265, 0.108],
        [0.265, 0.152],
        [0.19, 0.16],
      ],
      sleeveSteel,
      40,
    );
    sleeve.rotation.z = -Math.PI / 2; // axis → +X
    sleeve.position.x = -0.08; // centre the 0.16-wide collar
    const sleeveGrp = new THREE.Group();
    sleeveGrp.add(sleeve);
    sleeveGrp.position.set(hubX, 0, 0);
    mainAsm.add(sleeveGrp);
    sleeves[key] = { grp: sleeveGrp, homeX: hubX };

    for (const s of sides) {
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(s > 0 ? 0.118 : 0.15, s > 0 ? 0.15 : 0.118, 0.05, 32, 1, true),
        brassBase.clone(),
      );
      ring.rotation.z = -Math.PI / 2;
      ring.castShadow = true;
      const holder = new THREE.Group();
      holder.add(ring);
      holder.position.set(hubX + s * 0.085, 0, 0);
      mainAsm.add(holder);
      blockerRings.push({ holder, ring, key: `${key}${s}`, side: s, homeX: hubX + s * 0.085 });
    }
  }
  synchro('s34', HUBS.h34, [-1, 1]); // -1: 4th (input gear) · +1: 3rd
  synchro('s12', HUBS.h12, [-1, 1]); // -1: 2nd · +1: 1st
  synchro('s5', HUBS.h5, [-1]); // -1: 5th

  // --- reverse idler, carried on an arm that pivots on the 5-R rail ------------------
  // This CANNOT disengage by sliding along X, which is what it used to try.
  // The idler's axis is pinned (14+16)*MODULE_R = 0.36 from the layshaft by its
  // own tooth counts, while the cluster's 5th pinion has a 0.419 outer radius,
  // so clearing 5th on the way past would need
  //     (14+Ni)*MODULE_R > Ni*MODULE_R + TOOTH_D/2 + 0.419  =>  0.168 > 0.444
  // which is false for EVERY idler tooth count — the Ni terms cancel. Sliding
  // rearward ploughed straight through the 5th pinion, and the gaps either side
  // of the reverse pinion (0.044) are narrower than the idler, so there is
  // nowhere on that axis to park either.
  //
  // So it swings. The whole arm/shaft/gear linkage rotates on the 5-R rail that
  // actuates it, lifting the idler radially out of mesh without moving it in X
  // at all — the pivoting-idler arrangement, as real as the sliding one and the
  // only one this layout can actually hold.
  const PIVOT_Y = RAIL_Y;
  const PIVOT_Z = RAIL_Z.s5;
  const IDLER_SWING = -0.3; // rad: parks 0.668 from the layshaft (needs >0.430)
  //                           and 0.647 from the mainshaft (needs >0.622)
  const idlerGrp = new THREE.Group();
  idlerGrp.position.set(0, PIVOT_Y, PIVOT_Z);
  group.add(idlerGrp);
  // everything under idlerGrp is placed RELATIVE TO THE PIVOT so it can rotate
  const idlerLocal = [REV.x, IDLER_Y - PIVOT_Y, IDLER_Z - PIVOT_Z];
  const idler = axGear({ teeth: REV.Nidler, thickness: 0.09, holeR: 0.045 }, gearTint.rev); // spur
  idler.holder.position.set(...idlerLocal);
  idlerGrp.add(idler.holder);
  {
    // the stub shaft swings with the idler it carries, and is now short: at its
    // old length it reached x = 0.87 and fouled the 5th pinion's 0.849 face on
    // its own, quite apart from where the gear went.
    const shaftHolder = new THREE.Group();
    shaftHolder.position.set(0, idlerLocal[1], idlerLocal[2]);
    const s = rod(0.04, 0.28, shaftSteel, 16);
    s.rotation.z = -Math.PI / 2;
    s.position.x = 0.66;
    shaftHolder.add(s);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), shaftSteel);
    cap.castShadow = true;
    cap.position.x = 0.79;
    shaftHolder.add(cap);
    idlerGrp.add(shaftHolder);
  }

  // --- bearings (context once the case is off) ---------------------------------------
  for (const [x, y, r] of [
    [-1.0, MAIN_Y, 0.14],
    [1.1, MAIN_Y, 0.13],
    [-1.0, LAY_Y, 0.115],
    [1.02, LAY_Y, 0.115],
  ]) {
    const brg = rod(r, 0.07, railSteel, 28);
    brg.rotation.z = -Math.PI / 2;
    brg.position.set(x - 0.035, y, 0);
    group.add(brg);
  }

  // --- shift rails + forks --------------------------------------------------------------
  const railZ = RAIL_Z;
  for (const k of ['s12', 's34', 's5']) {
    const rail = rod(RAIL_R, 2.0, railSteel, 12);
    rail.rotation.z = -Math.PI / 2;
    rail.position.set(-0.9, RAIL_Y, railZ[k]);
    group.add(rail);
  }
  const forks = {};
  function fork(key) {
    const g = new THREE.Group();
    // C-shaped shoe riding the sleeve groove, opening downward
    const shoe = new THREE.Mesh(
      new THREE.TorusGeometry(0.248, 0.018, 10, 28, Math.PI * 1.3),
      forkIron,
    );
    shoe.rotation.y = Math.PI / 2; // torus plane → YZ (axis +X)
    shoe.rotation.x = -Math.PI * 0.15; // rotate the gap to the bottom
    shoe.castShadow = true;
    g.add(shoe);
    // spans from just inside the shoe up to the rail — derived, not a constant,
    // so raising RAIL_Y doesn't leave the fork floating short of its rail
    const armLen = RAIL_Y - MAIN_Y - 0.12;
    const arm = rod(0.024, armLen, forkIron, 10);
    arm.position.set(0, 0.12 + armLen / 2, railZ[key] * 0.45);
    arm.rotation.x = railZ[key] > 0 ? -0.16 : railZ[key] < 0 ? 0.16 : 0;
    g.add(arm);
    const boss = rod(0.04, 0.1, forkIron, 14);
    boss.rotation.z = -Math.PI / 2;
    boss.position.set(-0.05, RAIL_Y - MAIN_Y, railZ[key]);
    g.add(boss);
    g.position.set(sleeves[key].homeX, MAIN_Y, 0);
    group.add(g);
    forks[key] = { grp: g, homeX: sleeves[key].homeX };
  }
  fork('s34');
  fork('s12');
  fork('s5');
  // reverse lever arm: bent tube from the 5-R rail down to the idler groove.
  // Drawn pivot-relative and parented to idlerGrp, so the swing carries arm,
  // shaft and gear as one rigid linkage and the top stays seated on its rail.
  {
    // routed BEHIND the gear train (rear of the box) so it never cuts across
    // the synchro close-ups
    const P = (x, y, z) => new THREE.Vector3(x, y - PIVOT_Y, z - PIVOT_Z);
    const curve = new THREE.CatmullRomCurve3(
      [
        P(0.78, RAIL_Y, railZ.s5),
        P(0.9, RAIL_Y - 0.16, 0.12),
        P(0.82, IDLER_Y + 0.34, IDLER_Z - 0.05),
        P(0.74, IDLER_Y + 0.19, IDLER_Z),
      ],
      false,
      'catmullrom',
      0.4,
    );
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, 0.02, 10), forkIron);
    tube.castShadow = true;
    idlerGrp.add(tube);
    const shoe = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.016, 8, 24, Math.PI * 1.2), forkIron);
    shoe.rotation.y = Math.PI / 2;
    shoe.rotation.x = -Math.PI * 0.1;
    shoe.position.set(...idlerLocal);
    idlerGrp.add(shoe);
  }

  // --- power-path chevrons (1st-gear route, torque step) --------------------------------
  // The route ducks OVER the rear gears rather than through them.
  const pathGrp = new THREE.Group();
  group.add(pathGrp);
  const route1 = chainPath([
    [
      [-1.5, MAIN_Y, 0.24],
      [-0.98, MAIN_Y, 0.24],
    ],
    [
      [-0.98, MAIN_Y, 0.24],
      [-0.98, LAY_Y, 0.24],
    ],
    [
      [-0.98, LAY_Y, 0.24],
      [0.68, LAY_Y, 0.24],
    ],
    [
      [0.68, LAY_Y, 0.24],
      [0.68, MAIN_Y, 0.24],
    ],
    [
      [0.68, MAIN_Y, 0.24],
      [0.8, 1.84, 0.31],
      [1.32, 1.84, 0.31],
      [1.6, MAIN_Y + 0.06, 0.16],
      [1.78, MAIN_Y, 0.1],
    ],
  ]);
  const chevrons = [];
  for (let i = 0; i < 9; i++) {
    const mat = materials.glow(0xffc46b, 1.5);
    mat.transparent = true;
    mat.opacity = 0;
    mat.depthWrite = false;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.085, 12), mat);
    pathGrp.add(cone);
    chevrons.push(cone);
  }
  let pathOn = false;
  const upVec = new THREE.Vector3(0, 1, 0);
  function marchPath(t) {
    chevrons.forEach((c, i) => {
      const u = (((t + i / chevrons.length) % 1) + 1) % 1;
      c.position.copy(route1.getPointAt(u));
      c.quaternion.setFromUnitVectors(upVec, route1.getTangentAt(u).normalize());
      // fade in/out at the route's open ends so the wrap never pops
      const edge = Math.min(1, u / 0.08, (1 - u) / 0.08);
      c.material.opacity = pathOn ? 0.8 * edge : 0;
    });
  }
  marchPath(0);

  // --- callouts ----------------------------------------------------------------------
  const setsOf = {
    exterior: [],
    internal: [],
    mesh: [],
    synchro: [],
    torque: [],
    rails: [],
    ratios: [],
    drive: [],
  };
  function addCallout(set, parent, text, offset, dir, len) {
    const c = callout(text, { dir, len });
    c.position.set(...offset);
    parent.add(c);
    c.visible = false;
    setsOf[set].push(c);
  }
  addCallout('exterior', caseMeshes[0], 'Cast-aluminium case', [0.1, 0.55, 0.35], 90, 54);
  addCallout('exterior', knob, 'Shift lever', [0, 0.06, 0], 30, 60);
  addCallout('exterior', group, 'Bellhousing — bolts to the engine', [-1.3, 0.95, 0.3], 0, 90);
  addCallout('exterior', group, 'Input shaft — from the clutch', [-1.26, 1.6, 0.07], 15, 95);
  addCallout('exterior', group, 'Output flange — to the driveshaft', [1.62, 1.44, 0.1], 200, 60);

  addCallout('internal', group, 'Input gear', [PAIRS.in.x, 1.86, 0.1], 45, 90);
  addCallout('internal', group, 'Layshaft — one rigid cluster', [-0.1, 0.56, 0.3], -60, 64);
  addCallout('internal', group, 'Mainshaft', [1.34, 1.68, 0.05], 55, 50);
  addCallout('internal', group, '1st gear pair — 15 : 35 teeth', [0.56, 2.06, 0.1], 75, 56);
  addCallout('internal', group, 'Synchro sleeve (1st-2nd)', [HUBS.h12, 1.3, 0.28], -35, 66);
  // attached to idlerGrp (not the static 'group') so the leader tracks the idler
  // through its swing — a fixed world anchor pointed at empty space the moment
  // the gear moved away. Pivot-relative, like everything else under idlerGrp.
  addCallout('internal', idlerGrp, 'Reverse idler', [idlerLocal[0], idlerLocal[1] + 0.2, idlerLocal[2]], 15, 58);
  // led sideways rather than straight up: the rails moved 0.12 higher and a
  // near-vertical leader ran off the top of the tight 'reverse' framing
  addCallout('internal', group, 'Shift rails & forks', [-0.4, 2.08, 0.05], 20, 60);
  addCallout('internal', group, 'Output flange', [1.62, 1.44, 0.1], -20, 20);

  // 'torque' step: the ratio IS the lesson, so name both gears of the working
  // pair with their tooth counts. This step previously ran with labels OFF —
  // the one step about counting teeth showed no teeth counts at all.
  addCallout('torque', group, '15-tooth pinion — cluster', [PAIRS.g1.x, LAY_Y - 0.24, 0.26], -62, 78);
  addCallout('torque', group, '35-tooth gear — mainshaft', [PAIRS.g1.x, MAIN_Y + 0.42, 0.1], 68, 80);
  // short copy + a downward leader: anchored high and right this ran off the
  // frame edge (the visibility gate passed it at 34% hidden — eyes caught it)
  addCallout('torque', group, '3.5 in · 1 out', [1.24, 1.34, 0.06], -34, 66);

  // 'rails' step looks DOWN on the box, where the crowded 'internal' set is
  // mostly edge-on and unreadable. Sparse set anchored on what that vantage
  // actually shows: the rails, the fork, and the sleeve it drags.
  addCallout('rails', group, 'Shift rails', [-0.4, 2.08, 0.05], 75, 90);
  addCallout('rails', group, 'Fork — rides the sleeve groove', [HUBS.h12, 2.0, 0.22], 18, 96);
  addCallout('rails', group, 'Sleeve — splined to the mainshaft', [HUBS.h12, 1.5, 0.34], -42, 92);

  // 'mesh' step (constant-mesh concept) gets its OWN sparse pair — the full
  // 'synchro' set below is tuned for step 5's tight macro and crowds/peeks
  // behind the panel on this step's wider frame.
  addCallout('mesh', group, 'Gears freewheel on the shaft', [-0.02, 1.98, 0.12], 105, 62);
  addCallout('mesh', group, 'Dog teeth — the shaft’s only grip', [speedGears.g1.dogX, 1.7, 0.12], 35, 62);

  addCallout('synchro', group, 'Sleeve — splined to the shaft', [HUBS.h12, 1.83, 0.05], 80, 90);
  addCallout('synchro', group, 'Brass blocker ring', [HUBS.h12 - 0.085, 1.44, 0.15], -45, 70);
  addCallout('synchro', group, 'Dog teeth', [speedGears.g1.dogX, 1.74, 0.08], 40, 54);
  addCallout('synchro', group, '2nd gear — freewheeling', [0.0, 1.95, 0.08], 135, 62);
  addCallout('synchro', group, 'Friction cone', [speedGears.g2.dogX + 0.04, 1.42, 0.14], -20, 90);

  // 'ratios' — the gear set laid out as a set. The pairs carry accent tints
  // (GEAR_TINT) so these three anchors can stay sparse: what changes across the
  // lap is which pair lights up and what the readout says.
  // same anchor/leader the 'internal' set proves legible at a comparable
  // vantage — led up and left from under the cluster, clear of the panel.
  addCallout('ratios', group, 'Cluster — one steady speed', [-0.1, 0.56, 0.3], -60, 64);

  // Gear wheels numbered like a workshop diagram, so "which wheel is 3rd?" has
  // an answer that doesn't depend on remembering a colour. Each tag is pinned to
  // its own wheel's rim on the +Z side, which also stacks them by gear size.
  // 4th tags the INPUT gear, because that is where its dog ring lives — 4th
  // engages no pair of its own, which is why its tag sits somewhere surprising.
  for (const [text, x, teeth] of [
    ['1st', PAIRS.g1.x, PAIRS.g1.Nm],
    ['2nd', PAIRS.g2.x, PAIRS.g2.Nm],
    ['3rd', PAIRS.g3.x, PAIRS.g3.Nm],
    ['5th', PAIRS.g5.x, PAIRS.g5.Nm],
    ['4th · direct', PAIRS.in.x, PAIRS.in.Nm],
    ['R', REV.x, REV.Nmain],
  ]) {
    addCallout('ratios', group, text, [x, MAIN_Y, teeth * MODULE_R + TOOTH_D / 2], 55, 34);
  }

  // The live gear readout, shared by the ratios walk and the finale. Two
  // objects rather than one in both sets: setLabels drives visibility per set,
  // so an object listed twice would have whichever set iterates last win.
  const readouts = ['ratios', 'drive'].map((set) => {
    const c = callout('—', { dir: 22, len: 82 });
    // anchored left of the box's centre: the pill grows rightward and the
    // longest gear string ran off the frame edge from further over
    c.position.set(-0.1, 2.3, 0);
    group.add(c);
    c.visible = false;
    setsOf[set].push(c);
    return c;
  });
  function setReadout(g) {
    const [name, teeth, ratio] = GEAR_INFO[g];
    for (const c of readouts) c.setText(`${name}  ·  ${teeth}  ·  ${ratio}`);
  }

  // --- pose -------------------------------------------------------------------------
  // Everything derives from (layshaft angle, mainshaft angle, sleeve throws,
  // idler engagement). Speed gears ALWAYS follow the layshaft — they are never
  // disconnected; that is the constant-mesh fact the explainer hangs on.
  const state = { s12: 0, s34: 0, s5: 0, idler: 0, ringGlow: 0, ringKey: null };

  // --- power path: dim what ISN'T working ---------------------------------------------
  // "Which gears are carrying the drive RIGHT NOW?" was unanswerable from the
  // picture: every gear was the same steel, so a 15-tooth pinion driving a
  // 35-tooth wheel read as two identical discs and the whole speed-for-torque
  // trade was invisible.
  //
  // This used to add an orange emissive glow to the working pair, which was the
  // wrong way round twice over. It blew out that pair's accent tint — a lit sage
  // 2nd came out the same cream as a resting gold 3rd — and it made "working"
  // mean "emitting light", which no gear has ever done. Now the working pair is
  // left ALONE at its true colour and everything at rest sinks toward black.
  // Same thing a lighting cameraman would do, and it survives any tint palette.
  const DIM = new THREE.Color(0x14171c);
  const DIM_DEPTH = 0.74; // how far a resting gear travels toward DIM
  const dimmable = [
    inputGear.mesh,
    layGears.in.mesh,
    layGears.g1.mesh,
    layGears.g2.mesh,
    layGears.g3.mesh,
    layGears.g5.mesh,
    layRev.mesh,
    idler.mesh,
    revMain.mesh,
    speedGears.g1.mesh,
    speedGears.g2.mesh,
    speedGears.g3.mesh,
    speedGears.g5.mesh,
  ].map((mesh) => ({ mesh, base: mesh.material.color.clone() }));

  // '1'|'2'|'3'|'5' forward pair · '4' direct · 'R' reverse · null/'N' nothing
  // engaged. `fade` eases the dimming off and back on through a gear change so
  // the drive hands over instead of snapping — at a lap boundary a snap is a
  // visible pop in an otherwise identical pose.
  function setPowerHighlight(gearName, fade = 1) {
    const engaged = !!gearName && gearName !== 'N';
    const live = new Set();
    if (engaged && gearName !== '4') {
      // the constant-mesh input pair carries drive in every gear but 4th
      live.add(inputGear.mesh);
      live.add(layGears.in.mesh);
      if (gearName === 'R') {
        live.add(layRev.mesh);
        live.add(idler.mesh);
        live.add(revMain.mesh);
      } else {
        const k = { 1: 'g1', 2: 'g2', 3: 'g3', 5: 'g5' }[gearName];
        if (k) {
          live.add(layGears[k].mesh);
          live.add(speedGears[k].mesh);
        }
      }
    }
    // 4th leaves `live` empty deliberately: it is direct drive, so the whole
    // gear set goes dark while the shaft threading through it stays lit. That
    // picture IS the lesson, and it is the one thing no other gear looks like.
    const depth = engaged ? clamp01(fade) * DIM_DEPTH : 0;
    for (const { mesh, base } of dimmable) {
      mesh.material.color.copy(base).lerp(DIM, live.has(mesh) ? 0 : depth);
    }
  }

  function applyGears(lay) {
    clusterAsm.rotation.x = lay;
    for (const k of ['g1', 'g2', 'g3', 'g5']) speedGears[k].spinner.rotation.z = fwdTheta(k, lay);
    // out of mesh the idler freezes on a tooth-identical pose (C_LI)
    idler.mesh.rotation.z = state.idler > 0.02 ? idlerTheta(lay) : C_LI;
  }
  function applySleeves() {
    for (const k of ['s12', 's34', 's5']) {
      const x = sleeves[k].homeX + state[k] * THROW;
      sleeves[k].grp.position.x = x;
      forks[k].grp.position.x = x;
    }
    idlerGrp.rotation.x = (1 - state.idler) * IDLER_SWING;
    for (const r of blockerRings) {
      const press = state.ringKey === r.key ? state.ringGlow : 0;
      r.holder.position.x = r.homeX + r.side * press * 0.02;
      r.ring.material.emissive.setHex(0xff7733);
      r.ring.material.emissiveIntensity = press * 0.55;
    }
  }

  // -- run steadily in one gear. layTurns must advance WHOLE turns per lap ------------
  function setRun(gearName, layTurns) {
    const lay = layTurns * TAU;
    state.s12 = gearName === '1' ? 1 : gearName === '2' ? -1 : 0;
    state.s34 = gearName === '3' ? 1 : gearName === '4' ? -1 : 0;
    state.s5 = gearName === '5' ? -1 : 0;
    state.idler = 0;
    state.ringGlow = 0;
    applyGears(lay);
    inputAsm.rotation.x = inputTheta(lay);
    mainAsm.rotation.x =
      gearName === '4'
        ? inputTheta(lay)
        : gearName === 'N'
          ? 0
          : fwdTheta({ 1: 'g1', 2: 'g2', 3: 'g3', 5: 'g5' }[gearName], lay);
    applySleeves();
    setPowerHighlight(gearName);
    if (pathOn) marchPath(layTurns * 0.35);
  }

  const setNeutral = (layTurns) => setRun('N', layTurns);

  // -- the synchromesh handshake: one lap = 1st → synchro → 2nd → back to 1st ---------
  // The mainshaft coasts at a perfectly constant speed the whole lap (the car
  // rolls on); it is the CLUSTER that changes speed — dragged down to ~55 % by
  // the brass ring for the upshift, blipped back up for the return.
  const SHIFT_LAPS = 6;
  const R2R1 = R_FWD.g1 / R_FWD.g2; // cluster speed in 2nd vs 1st ≈ 0.545
  const shiftRate = (u) =>
    u < 0.3 ? 1
    : u < 0.5 ? 1 + (R2R1 - 1) * smooth((u - 0.3) / 0.2)
    : u < 0.84 ? R2R1
    : u < 0.94 ? R2R1 + (1 - R2R1) * smooth((u - 0.84) / 0.1)
    : 1;
  const shiftLay = profileTable(shiftRate, SHIFT_LAPS);
  const shiftMainRate = -R_FWD.g1 * shiftLay.k; // constant — the car coasts

  function setShift(u) {
    u = ((u % 1) + 1) % 1;
    const lay = shiftLay.at(u);
    state.s12 =
      u < 0.14 ? 1
      : u < 0.22 ? 1 - win(u, 0.14, 0.22)
      : u < 0.3 ? -0.6 * win(u, 0.22, 0.3)
      : u < 0.5 ? -0.6
      : u < 0.56 ? -0.6 - 0.4 * win(u, 0.5, 0.56)
      : u < 0.78 ? -1
      : u < 0.84 ? -1 + win(u, 0.78, 0.84)
      : u < 0.94 ? 0
      : win(u, 0.94, 1.0);
    state.s34 = 0;
    state.s5 = 0;
    state.idler = 0;
    // brass ring pressed on the 2nd-gear side through the drag window
    state.ringKey = 's12-1';
    state.ringGlow = win(u, 0.28, 0.36) * (1 - win(u, 0.52, 0.6));
    applyGears(lay);
    inputAsm.rotation.x = inputTheta(lay);
    mainAsm.rotation.x = C_FWD.g1 + shiftMainRate * u;
    applySleeves();
    // the glow follows the handshake: 1st drops out, nothing drives through the
    // blocker-ring window, 2nd picks it up — the shift made visible
    setPowerHighlight(state.s12 > 0.6 ? '1' : state.s12 < -0.6 ? '2' : null);
  }

  // -- reverse: box stops, idler slides in, everything runs backwards ------------------
  const REVERSE_LAPS = 3;
  const revRate = (u) =>
    u < 0.2 ? 0 : u < 0.3 ? smooth((u - 0.2) / 0.1) : u < 0.7 ? 1 : u < 0.8 ? 1 - smooth((u - 0.7) / 0.1) : 0;
  const revLay = profileTable(revRate, REVERSE_LAPS);

  function setReverse(u) {
    u = ((u % 1) + 1) % 1;
    const lay = revLay.at(u);
    state.idler = win(u, 0.06, 0.18) * (1 - win(u, 0.86, 0.96));
    state.s12 = 0;
    state.s34 = 0;
    state.s5 = 0;
    state.ringGlow = 0;
    applyGears(lay);
    inputAsm.rotation.x = inputTheta(lay);
    mainAsm.rotation.x = revMainTheta(lay);
    applySleeves();
    setPowerHighlight(state.idler > 0.5 ? 'R' : null);
  }

  // -- walking up through the gears ----------------------------------------------------
  // Shared by the ratios walk and the finale; they differ only in how fast the
  // cluster turns and how the camera and copy frame it.
  //
  // The mainshaft is POSED from the engaged gear's exact mesh angle rather than
  // integrated separately, which buys two things the old finale did not have.
  // Its rate is then identically the engaged speed gear's rate, so a locked
  // sleeve never creeps against its dog ring (invisible under a closed case,
  // glaring once the case comes off). And because the pose is a function of the
  // layshaft angle, not an accumulation, the wrap is exact — no drift to chase.
  //
  // Through a change the sleeve is out and the shaft is genuinely free, so the
  // pose crossfades between the two gears' mesh angles (the short way round).
  //
  // SEAMLESSNESS: `laps` must be a multiple of 18. Whole layshaft turns settle
  // the cluster and every speed gear (each advances a whole number of teeth),
  // but two things ride other shafts: the input assembly turns lay x 3/2, so
  // laps must be even, and at the wrap the box is in 5th, where the mainshaft
  // turns lay x 16/9, so laps must divide by 9. Even and /9 => /18.
  const FWD_KEY = { 1: 'g1', 2: 'g2', 3: 'g3', 5: 'g5' };
  const mainThetaFor = (g, lay) => (g === 4 ? inputTheta(lay) : fwdTheta(FWD_KEY[g], lay));
  // which blocker ring each gear engages through — `${rail}${side}`, matching
  // the keys synchro() pushes (s12: -1 is 2nd / +1 is 1st · s34: -1 is 4th /
  // +1 is 3rd · s5: -1 is 5th)
  const RING_KEY = { 1: 's121', 2: 's12-1', 3: 's341', 4: 's34-1', 5: 's5-1' };

  function gearWalk({ laps, shiftFrac, layRate }) {
    const span = 1 / 5;
    const gearAtU = (u) => Math.min(5, 1 + Math.floor(u / span));
    const lay = profileTable(layRate, laps);
    return (u) => {
      u = ((u % 1) + 1) % 1;
      const g = gearAtU(u);
      const lu = (u - (g - 1) * span) / span;
      const shifting = lu < shiftFrac;
      const prev = g === 1 ? 5 : g - 1; // the lap wraps 5th -> 1st
      const m = shifting ? lu / shiftFrac : 1;
      const [sel, thr] = shifting ? gateAt(prev, g, m) : GATE[g];
      const a = lay.at(u);

      state.idler = 0;
      // the brass ring bites in the back half of the change, as the sleeve comes
      // out of neutral and closes on the new gear — the same handshake step 5
      // shows in macro, here at speed, once per shift
      state.ringKey = RING_KEY[g];
      state.ringGlow = shifting ? win(m, 0.45, 0.62) * (1 - win(m, 0.78, 0.95)) : 0;
      state.s12 = thr * railWeight(sel, -1);
      state.s34 = thr * railWeight(sel, 0);
      state.s5 = -thr * railWeight(sel, 1); // 5th engages on the -X side
      applyGears(a);
      inputAsm.rotation.x = inputTheta(a);
      const now = mainThetaFor(g, a);
      if (shifting) {
        const was = mainThetaFor(prev, a);
        mainAsm.rotation.x = was + wrapPi(now - was) * smooth(m);
      } else {
        mainAsm.rotation.x = now;
      }
      applySleeves();
      leverPivot.rotation.z = -thr * 0.28;
      leverPivot.rotation.x = sel * 0.2;
      // Drive hands over mid-change: the old pair fades out, nothing carries
      // load across the middle, the new pair fades in. Snapping it off instead
      // left the lap boundary with an identical pose but a visible lighting
      // pop, since the lap both ends and begins holding 5th.
      const half = shifting ? Math.abs(m * 2 - 1) : 1;
      const carrying = shifting && m < 0.5 ? prev : g;
      setPowerHighlight(String(carrying), half);
      setReadout(carrying);
    };
  }

  // -- the five ratios, one at a time --------------------------------------------------
  // A bench demo, and the copy says so: the cluster is held at ONE steady speed
  // and the box walked 1-2-3-4-5, so the only thing that changes across the lap
  // is how fast the mainshaft comes out the far end. That side-by-side is the
  // comparison this explainer never made — it taught the mechanism five times
  // and the gear set not once.
  const setRatios = gearWalk({ laps: 18, shiftFrac: 0.26, layRate: () => 1 });

  // -- finale: drive it ----------------------------------------------------------------
  // Same kinematics, opposite story: this is the car accelerating. Road speed
  // climbs smoothly the whole way, so the ENGINE is what steps — revs dipping at
  // every change as the clutch comes in, then building again. That divergence,
  // engine falling while the output keeps rising, is the reason for having five.
  const RUN_TAIL = 0.14; // the run brakes back to its opening speed for the wrap
  const runOut = (u) => {
    const a = 0.34;
    const b = 0.98;
    if (u < 1 - RUN_TAIL) return a + (b - a) * (u / (1 - RUN_TAIL));
    return b - (b - a) * smooth((u - (1 - RUN_TAIL)) / RUN_TAIL);
  };
  const RUN_SHIFT = 0.22;
  const setGears = gearWalk({
    laps: 18,
    shiftFrac: RUN_SHIFT,
    layRate: (u) => {
      const g = Math.min(5, 1 + Math.floor(u * 5));
      const lu = (u * 5) % 1;
      const revs = runOut(u) / MAIN_FACTOR[g];
      if (lu >= RUN_SHIFT) return revs;
      // clutch in: the engine is dragged from the old gear's revs to the new
      const from = runOut(u) / MAIN_FACTOR[g === 1 ? 5 : g - 1];
      return from + (revs - from) * smooth(lu / RUN_SHIFT);
    },
  });

  // -- layer + label switches ------------------------------------------------------------
  function setCase(v) {
    for (const m of caseMeshes) m.visible = v;
    if (!v) for (const c of setsOf.exterior) c.visible = false;
  }
  function setLabels(mode) {
    for (const [k, arr] of Object.entries(setsOf)) {
      for (const c of arr) c.visible = k === mode;
    }
  }
  function setPath(on) {
    pathOn = !!on;
    if (!on) for (const c of chevrons) c.material.opacity = 0;
  }

  setRun('1', 0);
  setCase(true);
  setLabels(false);

  return {
    group,
    setRun,
    setNeutral,
    setShift,
    setReverse,
    setRatios,
    setGears,
    setCase,
    setLabels,
    setPath,
    // exposed for verification probes
    parts: { clusterAsm, mainAsm, inputAsm, sleeves, idlerGrp, leverPivot },
  };
}
