import * as THREE from 'three';
import { materials, rod, studioPlinth } from '../../framework/parts.js';
import { beveledBox, lathe, tubeAlong, coil, boltCircle } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, TAU } from '../../framework/motion.js';

// A complete MacPherson-strut FRONT AXLE — two corners, subframe, strut towers
// and body structure (the sprung mass), an anti-roll bar, and two road pads the
// wheels stand on, all on a studio plinth. The near (+X) corner opens up: its
// wheel lifts off, and its strut sections open to show the twin-tube damper.
//
// PROPORTIONS (real numbers, ONE scale). Reference: a compact hatchback front
// axle on 205/55 R16 rubber — tire OD 632 mm, track 1520 mm, 16" rim. Scale
// S = 1.962 units/m from TIRE_R = 0.62. Everything below is derived from it:
//   half track 0.760 m → 1.49      wheel centre 0.316 m → y 0.92 over the pads
//   lower arm 0.360 m → 0.706      strut top mount 0.60 m above hub → y 2.10
//   coil mean ø 120 mm → R 0.118   spring wire ø 13.5 mm → R 0.0135, 8 turns
//   reserve tube ø 45 mm → R 0.044 working cylinder ø 32 mm → R 0.031
//   piston rod ø 22 mm → R 0.022   anti-roll bar ø 22 mm → R 0.0216
//   wheel travel ±80 mm → ±0.157   strut inclination 10.5° from vertical
//
// MECHANISM (researched). MacPherson: ONE lower control arm (two inboard
// bushings → outer ball joint) locates the bottom; the strut tube is RIGID
// with the steering knuckle and its top mount carries the load into the body,
// so there is no upper arm. The coil (~30 N/mm, ~110 mm of static squat under
// ~350 kg per corner) gives, once the arm's motion ratio softens it to ~24
// N/mm at the wheel, a ride frequency near 1.4 Hz. Inside the strut is a
// twin-tube damper: a piston on the rod meters oil through its valves inside
// the working cylinder, and the BASE VALVE at the bottom passes the volume the
// rod displaces out into the reserve tube. Rebound damping is 2–3× compression
// (the spring already resists compression); ~800–1500 N at 0.5 m/s, all of it
// leaving as heat. The 22 mm anti-roll bar is a torsion spring in two bushings:
// equal travel on both sides just rotates it (it does nothing), opposite travel
// twists it — stiffness goes as diameter⁴.
//
// KINEMATICS (exact, closed form, planar in XY). The knuckle + strut tube is
// ONE rigid body, so given the arm angle θ the knuckle rotation φ follows from
// requiring the strut axis to still pass through the fixed top mount:
//   B(θ) = P + L·(cosθ, sinθ);  v = T − B;  |kK + s·a| = |v|  (quadratic in s)
//   φ = ∠v − ∠(kK + s·a);  wheel centre C = B + R(φ)·kC;  damper stroke = s₀ − s
// Real camber change and real track scrub fall out of it. The tire always
// stands on its road pad, so ONE pose call — setRig(roadL, roadR, bodyY, roll)
// — solves each corner's travel from the road and the body's own motion.
//
// DISCLOSED SIMPLIFICATIONS: body roll is driven to ~4–4.5° (a hard corner)
// for legibility; the drop link is re-spanned between its two ends each frame
// rather than solved as a rigid constraint (<1% length error); the road pads
// are a shaker-rig abstraction of the road, so the wheels do not rotate.
//
// SCALARS:
//   setRig(roadL, roadR, bodyY, roll) — THE pose function. Road-pad heights
//     (world Δy), body heave (Δy) and body roll (radians, +ve leans the car
//     onto its −X side). Everything else — arm angle, camber, damper stroke, spring
//     length, bar twist, drop links, pad columns — derives from it.
//   setReveal(t) — 0: both wheels on. 1: the near (+X) wheel, tire and its
//     road pad are HIDDEN outright (metal can't be ghosted) to expose the
//     corner; the far wheel stays on the road for context.
//   setCut(t) — 0: sealed strut. 1: spring/perches/boot off and the front half
//     of both damper tubes removed — a real section, not a ghost.
//   setFlow(v) — oil-flow arrows: v > 0 compression, v < 0 rebound, |v| sets
//     opacity. Driven from the step's own road derivative so it survives seek.
//   setLabels(mode) — 'exterior' | 'linkage' | 'spring' | 'damper' | 'arb'.

// --- layout (canonical +X corner; the −X corner mirrors every x and every
//     Z-rotation through `sgn`) ------------------------------------------------
const TIRE_R = 0.62;
const TIRE_W = 0.32;
const RIM_R = 0.42;
const GROUND = 0.3; // road-pad top at ride height
const PLINTH_H = 0.09; // low base slab — the pads need room to stroke down

const PX = 0.72; // lower-arm inboard pivot (on the subframe)
const PY = 0.69;
const B0X = 1.42; // outer ball joint at ride height
const B0Y = 0.6;
const C0X = 1.49; // wheel centre
const C0Y = GROUND + TIRE_R; // 0.92
const K0X = 1.36; // strut-tube mount on the knuckle
const K0Y = 1.02;
const TX = 1.16; // strut top mount (on the body)
const TY = 2.1;

const ARM_L = Math.hypot(B0X - PX, B0Y - PY);
const TH0 = Math.atan2(B0Y - PY, B0X - PX);
const KCX = C0X - B0X; // ball joint → wheel centre, in the knuckle frame
const KCY = C0Y - B0Y;
const KKX = K0X - B0X; // ball joint → strut mount, in the knuckle frame
const KKY = K0Y - B0Y;
const S_LEN = Math.hypot(TX - K0X, TY - K0Y); // strut mount → top mount at rest
const AX = (TX - K0X) / S_LEN; // strut axis, unit, in the knuckle frame
const AY = (TY - K0Y) / S_LEN;
const KDOTA = KKX * AX + KKY * AY;
const KK2 = KKX * KKX + KKY * KKY;
const STRUT_TILT = Math.asin(-AX); // rotation.z that aims local +Y along a

// strut-frame axial stations (origin at the knuckle mount, +Y up the axis)
const TUBE_BOT = -0.06;
const TUBE_TOP = 0.66;
const RES_R = 0.044; // reserve (outer) tube
const CYL_R = 0.031; // working cylinder
const ROD_R = 0.022;
const ROD_LEN = 0.82; // top mount → piston face
const CYL_BOT = 0.1; // working-cylinder foot — reserve tube continues below it
const CYL_TOP = 0.66;
const PERCH_Y = 0.44;
const SPRING_R = 0.118;
const WIRE_R = 0.0135;
const SPRING_L0 = S_LEN - 0.1 - (PERCH_Y + 0.02);

const HALF_TRACK = C0X;
const ROLL_PIVOT = 0.52; // roll centre: 0.22 over the road ≈ 110 mm, MacPherson-typical

// anti-roll bar
const BAR_R = 0.0216;
const BAR_Y = 0.42;
const BAR_Z = 0.44; // AHEAD of the subframe — behind it, the beams hid it
const BAR_HALF = 0.62; // centre section runs x ∈ [−0.62, 0.62]
const BAR_ARM = 0.3; // lever: bar axis → arm tip, swept back in −Z
const TAB_F = 0.385; // drop-link tab, distance out along the control arm
const TAB_Z = 0.14;
const TAB_Y0 = PY + TAB_F * Math.sin(TH0);
const LINK_LEN = TAB_Y0 - BAR_Y;

const UP = new THREE.Vector3(0, 1, 0);

// --- suspension kinematics ----------------------------------------------------
// One arm angle in, the whole corner out. See the header for the derivation.
function poseAt(theta) {
  const bx = PX + ARM_L * Math.cos(theta);
  const by = PY + ARM_L * Math.sin(theta);
  const vx = TX - bx;
  const vy = TY - by;
  const s = -KDOTA + Math.sqrt(Math.max(1e-6, KDOTA * KDOTA - KK2 + vx * vx + vy * vy));
  const wx = KKX + s * AX;
  const wy = KKY + s * AY;
  const phi = Math.atan2(vy, vx) - Math.atan2(wy, wx);
  const cp = Math.cos(phi);
  const sp = Math.sin(phi);
  return {
    theta,
    phi,
    s,
    bx,
    by,
    cx: bx + KCX * cp - KCY * sp,
    cy: by + KCX * sp + KCY * cp,
  };
}

// Wheel-centre height → arm angle, by inverting a monotonic sampled table.
const TABLE_N = 240;
const TABLE_LO = TH0 - 0.34;
const TABLE_HI = TH0 + 0.34;
const TABLE = [];
for (let i = 0; i <= TABLE_N; i++) {
  TABLE.push(poseAt(TABLE_LO + ((TABLE_HI - TABLE_LO) * i) / TABLE_N).cy);
}
function thetaForHeight(cy) {
  if (cy <= TABLE[0]) return TABLE_LO;
  if (cy >= TABLE[TABLE_N]) return TABLE_HI;
  let lo = 0;
  let hi = TABLE_N;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (TABLE[mid] <= cy) lo = mid;
    else hi = mid;
  }
  const f = (cy - TABLE[lo]) / (TABLE[hi] - TABLE[lo] || 1);
  return TABLE_LO + ((TABLE_HI - TABLE_LO) * (lo + f)) / TABLE_N;
}

export function buildSuspension({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // --- materials -------------------------------------------------------------
  const castAlu = materials.aluminum(0xb4bac2);
  castAlu.roughness = 0.62;
  const knuckleAlu = materials.grimyAluminum(0x9ea4ac);
  const darkCast = materials.darkMetal(0x33373d);
  const strutPaint = materials.paintedMetal(0x1d2024);
  strutPaint.clearcoat = 0.5;
  strutPaint.roughness = 0.5;
  const springSteel = materials.brushedSteel(0xb6bcc4);
  springSteel.roughness = 0.5;
  const chromeRod = materials.chrome(0xccd2d9);
  // the exposed piston rod is the one blown-white surface in the macro step's
  // readPixels scan — roughness widens the specular streak instead of clipping
  chromeRod.roughness = 0.38;
  const bushRubber = materials.rubber(0x121416);
  const tireRubber = materials.rubber(0x17181b);
  const wheelAlu = materials.aluminum(0xcfd4da);
  wheelAlu.roughness = 0.56;
  const bodyPaint = materials.paintedMetal(0x2b3037);
  const sheetSteel = materials.brushedSteel(0x8d949d);
  sheetSteel.roughness = 0.62;
  const barSteel = materials.paintedMetal(0x24272b);
  const rotorIron = materials.brushedSteel(0xa8adb4);
  rotorIron.roughness = 0.6;
  const cylSteel = materials.brushedSteel(0x9aa1aa);
  const subframeCast = materials.grimyAluminum(0x7d838b);
  const shimChrome = materials.chrome(0xd6dbe1);
  const markPaint = materials.paintedMetal(0xe8a33d);
  const caliperPaint = materials.paintedMetal(0x7d2b2b);
  const linkSteel = materials.brushedSteel(0xb7bec6);
  const padColumnSteel = materials.brushedSteel(0xa9b0b8);
  const padTop = materials.rubber(0x0f1113);
  const dullBore = new THREE.MeshStandardMaterial({
    color: 0x15171a,
    roughness: 0.92,
    metalness: 0.2,
    side: THREE.BackSide,
  });
  const stopPoly = new THREE.MeshPhysicalMaterial({
    color: 0xd8d2c4,
    roughness: 0.72,
    metalness: 0,
  });
  // damper oil: PLAIN transparent, never transmission — it has contents (the
  // piston) and a transmission pass would swallow them (pre-flight #1)
  const oilMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0932c,
    roughness: 0.15,
    metalness: 0,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const flowMat = new THREE.MeshStandardMaterial({
    color: 0xffc46b,
    emissive: 0xffa22c,
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  // --- plinth ----------------------------------------------------------------
  const plinth = studioPlinth({ w: 4.5, h: PLINTH_H, d: 2.15, bevel: 0.03 });
  group.add(plinth);

  // ==========================================================================
  //  BODY — the sprung mass. Rolls about ROLL_PIVOT, heaves in Y. Every
  //  suspension pickup point (arm pivots, top mounts, bar bushings) lives in
  //  here, so suspension travel is body-relative by construction.
  // ==========================================================================
  const bodyRoll = new THREE.Group();
  bodyRoll.position.set(0, ROLL_PIVOT, 0);
  group.add(bodyRoll);
  const bodyInner = new THREE.Group(); // children authored in ride-height coords
  bodyInner.position.set(0, -ROLL_PIVOT, 0);
  bodyRoll.add(bodyInner);

  // subframe: two lateral beams + centre plate + arm-pivot brackets
  for (const bz of [-0.3, 0.3]) {
    const beam = beveledBox(1.66, 0.1, 0.11, subframeCast, 0.02);
    beam.position.set(0, PY, bz);
    bodyInner.add(beam);
  }
  const subPlate = beveledBox(0.86, 0.06, 0.5, subframeCast, 0.02);
  subPlate.position.set(0, PY - 0.02, 0);
  bodyInner.add(subPlate);
  for (const sx of [-1, 1]) {
    for (const bz of [-0.26, 0.26]) {
      const bracket = beveledBox(0.1, 0.16, 0.09, subframeCast, 0.02);
      bracket.position.set(sx * PX, PY, bz);
      bodyInner.add(bracket);
    }
  }

  // Sprung mass, deliberately spare: ONE pressed cross-member joining two flat
  // strut turrets, with a vertical rail down each side to the subframe. A
  // first render with domed towers, gussets and a bay floor read as a
  // workbench and swallowed the springs whole.
  const crossMember = beveledBox(2.84, 0.17, 0.42, bodyPaint, 0.04);
  crossMember.position.set(0, TY + 0.08, -0.02);
  bodyInner.add(crossMember);
  for (const sx of [-1, 1]) {
    const turretTop = beveledBox(0.46, 0.05, 0.46, bodyPaint, 0.02);
    turretTop.position.set(sx * TX, TY + 0.015, 0);
    bodyInner.add(turretTop);
    const turretSkirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.235, 0.15, 28, 1, true),
      bodyPaint,
    );
    turretSkirt.position.set(sx * TX, TY - 0.085, 0);
    bodyInner.add(turretSkirt);
    const rail = beveledBox(0.12, 1.3, 0.15, bodyPaint, 0.03);
    rail.position.set(sx * 0.8, PY + 0.68, -0.22);
    bodyInner.add(rail);
  }

  // ==========================================================================
  //  ANTI-ROLL BAR — centre section in two bushings, an arm at each end
  //  sweeping back to a drop link. Both ends rotate about the SAME world +X
  //  axis, so equal travel = equal angle = no twist, straight out of geometry.
  // ==========================================================================
  const barCentre = new THREE.Mesh(
    new THREE.CylinderGeometry(BAR_R, BAR_R, BAR_HALF * 2, 20),
    barSteel,
  );
  barCentre.rotation.z = Math.PI / 2;
  barCentre.position.set(0, BAR_Y, BAR_Z);
  barCentre.castShadow = true;
  bodyInner.add(barCentre);
  // twist marks: a real bar's torsion is invisible on a plain cylinder, so a
  // row of collars carries the angle gradient between the two ends
  const twistMarks = [];
  for (let i = 0; i < 7; i++) {
    const f = i / 6;
    const collar = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, BAR_R * 5.4, BAR_R * 1.2),
      markPaint,
    );
    collar.position.set(-BAR_HALF + f * BAR_HALF * 2, BAR_Y, BAR_Z);
    collar.userData.f = f;
    bodyInner.add(collar);
    twistMarks.push(collar);
  }
  for (const sx of [-1, 1]) {
    const bushing = new THREE.Mesh(new THREE.TorusGeometry(BAR_R + 0.014, 0.02, 10, 20), bushRubber);
    bushing.rotation.y = Math.PI / 2;
    bushing.position.set(sx * 0.5, BAR_Y, BAR_Z);
    bodyInner.add(bushing);
    const clamp = beveledBox(0.05, 0.1, 0.1, castAlu, 0.015);
    clamp.position.set(sx * 0.5, BAR_Y + 0.06, BAR_Z);
    bodyInner.add(clamp);
    const strap = beveledBox(0.05, 0.26, 0.06, castAlu, 0.015);
    strap.position.set(sx * 0.5, BAR_Y + 0.18, BAR_Z - 0.06);
    strap.rotation.x = 0.4;
    bodyInner.add(strap);
  }

  // --- per-corner build -------------------------------------------------------
  function buildCorner(sgn) {
    const corner = {};

    // lower control arm: pivots about Z at the subframe, ball joint at +X·L
    const arm = new THREE.Group();
    arm.position.set(sgn * PX, PY, 0);
    bodyInner.add(arm);
    for (const bz of [-0.26, 0.26]) {
      const legLen = Math.hypot(ARM_L, bz);
      const leg = beveledBox(legLen, 0.062, 0.09, castAlu, 0.02);
      leg.position.set((sgn * ARM_L) / 2, 0, bz / 2);
      leg.rotation.y = -sgn * Math.atan2(-bz, ARM_L);
      arm.add(leg);
      const bushSleeve = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.1, 16),
        bushRubber,
      );
      bushSleeve.rotation.x = Math.PI / 2;
      bushSleeve.position.set(0, 0, bz);
      arm.add(bushSleeve);
    }
    const armBoss = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.09, 20), castAlu);
    armBoss.position.set(sgn * ARM_L, 0, 0);
    arm.add(armBoss);
    const linkTab = beveledBox(0.07, 0.05, 0.06, castAlu, 0.012);
    linkTab.position.set(sgn * TAB_F, 0.0, TAB_Z);
    arm.add(linkTab);

    // knuckle + strut tube: ONE rigid body, hinged at the ball joint
    const knuckle = new THREE.Group();
    bodyInner.add(knuckle);
    const ballStud = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 12), chromeRod);
    knuckle.add(ballStud);
    const upright = beveledBox(0.12, 0.5, 0.15, knuckleAlu, 0.025);
    upright.position.set(sgn * -0.005, 0.23, 0);
    knuckle.add(upright);
    const hubBoss = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.17, 24), knuckleAlu);
    hubBoss.rotation.z = -sgn * Math.PI * 0.5;
    hubBoss.position.set(sgn * (KCX - 0.05), KCY, 0);
    knuckle.add(hubBoss);
    const steerArm = beveledBox(0.09, 0.07, 0.24, knuckleAlu, 0.018);
    steerArm.position.set(sgn * 0.01, 0.12, -0.17);
    knuckle.add(steerArm);
    const tieRodEnd = new THREE.Mesh(new THREE.SphereGeometry(0.032, 14, 10), chromeRod);
    tieRodEnd.position.set(sgn * 0.01, 0.15, -0.28);
    knuckle.add(tieRodEnd);

    // brake disc + a token caliper — there IS a brake in here
    const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.294, 0.294, 0.028, 48), rotorIron);
    rotor.rotation.z = Math.PI / 2;
    rotor.position.set(sgn * (KCX + 0.03), KCY, 0);
    rotor.castShadow = true;
    knuckle.add(rotor);
    const rotorHat = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 24), rotorIron);
    rotorHat.rotation.z = Math.PI / 2;
    rotorHat.position.set(sgn * (KCX + 0.07), KCY, 0);
    knuckle.add(rotorHat);
    const caliper = beveledBox(0.14, 0.2, 0.18, caliperPaint, 0.03);
    caliper.position.set(sgn * (KCX + 0.02), KCY + 0.26, -0.1);
    knuckle.add(caliper);

    // strut frame: local +Y runs up the strut axis, origin at the knuckle mount
    const strut = new THREE.Group();
    strut.position.set(sgn * KKX, KKY, 0);
    strut.rotation.z = sgn * STRUT_TILT;
    knuckle.add(strut);

    const cutOnly = []; // visible only when sectioned
    const sealedOnly = [rotor, rotorHat, caliper]; // hidden when sectioned

    // reserve (outer) tube — front half removed on the section
    function tubeHalf(radius, height, front, mat) {
      const geo = new THREE.CylinderGeometry(
        radius,
        radius,
        height,
        32,
        1,
        true,
        front ? -Math.PI / 2 : Math.PI / 2,
        Math.PI,
      );
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      return mesh;
    }
    const tubeH = TUBE_TOP - TUBE_BOT;
    const tubeMidY = (TUBE_TOP + TUBE_BOT) / 2;
    const resFront = tubeHalf(RES_R, tubeH, true, strutPaint);
    resFront.position.y = tubeMidY;
    strut.add(resFront);
    sealedOnly.push(resFront);
    const resBack = tubeHalf(RES_R, tubeH, false, strutPaint);
    resBack.position.y = tubeMidY;
    strut.add(resBack);
    const resLiner = tubeHalf(RES_R - 0.004, tubeH, false, dullBore);
    resLiner.position.y = tubeMidY;
    strut.add(resLiner);
    const tubeCap = new THREE.Mesh(new THREE.CylinderGeometry(RES_R, RES_R * 0.9, 0.05, 24), strutPaint);
    tubeCap.position.y = TUBE_BOT - 0.02;
    strut.add(tubeCap);
    const tubeCollar = new THREE.Mesh(new THREE.CylinderGeometry(RES_R + 0.008, RES_R + 0.008, 0.05, 24), strutPaint);
    tubeCollar.position.y = TUBE_TOP - 0.02;
    strut.add(tubeCollar);
    // knuckle clamp — where the tube bolts to the upright
    const clampBlock = beveledBox(0.1, 0.16, 0.11, knuckleAlu, 0.02);
    clampBlock.position.set(sgn * -0.07, 0.0, 0);
    strut.add(clampBlock);

    // cut-face walls: the wall thickness you'd actually see on a section
    for (const cx of [-1, 1]) {
      for (const [rOut, rIn] of [
        [RES_R, RES_R - 0.004],
        [CYL_R, CYL_R - 0.004],
      ]) {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(rOut - rIn, rOut === RES_R ? tubeH : CYL_TOP - CYL_BOT, 0.005),
          cylSteel,
        );
        wall.position.set(
          cx * (rOut - (rOut - rIn) / 2),
          rOut === RES_R ? tubeMidY : (CYL_TOP + CYL_BOT) / 2,
          0.0,
        );
        strut.add(wall);
        cutOnly.push(wall);
      }
    }

    // working cylinder inside it
    const cylH = CYL_TOP - CYL_BOT;
    const cylMidY = (CYL_TOP + CYL_BOT) / 2;
    const cylFront = tubeHalf(CYL_R, cylH, true, cylSteel);
    cylFront.position.y = cylMidY;
    strut.add(cylFront);
    sealedOnly.push(cylFront);
    const cylBack = tubeHalf(CYL_R, cylH, false, cylSteel);
    cylBack.position.y = cylMidY;
    strut.add(cylBack);
    const cylLiner = tubeHalf(CYL_R - 0.004, cylH, false, dullBore);
    cylLiner.position.y = cylMidY;
    strut.add(cylLiner);

    // oil: back halves only, so the section plane genuinely cuts the fluid.
    // The working cylinder holds a solid column; the reserve holds an ANNULUS
    // (a solid slug there would read as oil floating inside the cylinder).
    const oilColumn = new THREE.Mesh(
      new THREE.CylinderGeometry(CYL_R - 0.005, CYL_R - 0.005, cylH - 0.05, 24, 1, false, Math.PI / 2, Math.PI),
      oilMat,
    );
    oilColumn.position.y = cylMidY + 0.01;
    strut.add(oilColumn);
    const oilReserve = new THREE.Mesh(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(CYL_R + 0.001, 0.0),
          new THREE.Vector2(RES_R - 0.006, 0.0),
          new THREE.Vector2(RES_R - 0.006, 0.46),
          new THREE.Vector2(CYL_R + 0.001, 0.46),
          new THREE.Vector2(CYL_R + 0.001, 0.0),
        ],
        20,
        Math.PI / 2,
        Math.PI,
      ),
      oilMat,
    );
    strut.add(oilReserve); // ~60% full — gas space above it

    // base valve at the foot of the working cylinder
    function valveDisc(radius, holeR, holes, thickness, mat) {
      const shape = new THREE.Shape();
      shape.absarc(0, 0, radius, 0, TAU, false);
      const ringR = radius * 0.6;
      for (let i = 0; i < holes; i++) {
        const a = (i / holes) * TAU;
        const hole = new THREE.Path();
        hole.absarc(Math.cos(a) * ringR, Math.sin(a) * ringR, holeR, 0, TAU, true);
        shape.holes.push(hole);
      }
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: thickness,
        bevelEnabled: true,
        bevelThickness: 0.002,
        bevelSize: 0.002,
        bevelSegments: 1,
        curveSegments: 20,
      });
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      return mesh;
    }
    const baseValve = valveDisc(CYL_R - 0.002, 0.005, 6, 0.024, materials.brushedSteel(0xb0b6bd));
    baseValve.position.y = CYL_BOT + 0.004;
    strut.add(baseValve);
    const baseSeat = new THREE.Mesh(new THREE.CylinderGeometry(CYL_R, CYL_R, 0.014, 24), darkCast);
    baseSeat.position.y = CYL_BOT - 0.005;
    strut.add(baseSeat);

    // piston rod + piston + valve shims (rigid: one group, y = s − ROD_LEN)
    const piston = new THREE.Group();
    strut.add(piston);
    const pistonBody = valveDisc(CYL_R - 0.003, 0.0045, 6, 0.032, materials.brushedSteel(0xc2c8ce));
    piston.add(pistonBody);
    const shimTop = new THREE.Mesh(new THREE.CylinderGeometry(CYL_R - 0.009, CYL_R - 0.009, 0.005, 20), shimChrome);
    shimTop.position.y = 0.037;
    piston.add(shimTop);
    const shimBot = new THREE.Mesh(new THREE.CylinderGeometry(CYL_R - 0.009, CYL_R - 0.009, 0.005, 20), shimChrome);
    shimBot.position.y = -0.005;
    piston.add(shimBot);
    const pistonRing = new THREE.Mesh(new THREE.TorusGeometry(CYL_R - 0.003, 0.003, 8, 24), bushRubber);
    pistonRing.rotation.x = Math.PI / 2;
    pistonRing.position.y = 0.016;
    piston.add(pistonRing);

    const pistonRod = rod(ROD_R, ROD_LEN, chromeRod, 20);
    strut.add(pistonRod);

    // rod guide / seal where the rod leaves the tube
    const rodSeal = new THREE.Mesh(new THREE.CylinderGeometry(CYL_R + 0.004, CYL_R + 0.004, 0.04, 24), darkCast);
    rodSeal.position.y = 0.645;
    strut.add(rodSeal);

    // top mount, upper seat, bump stop, boot — everything at the rod's top
    const topMount = new THREE.Group();
    strut.add(topMount);
    const mountPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.035, 28), sheetSteel);
    mountPlate.position.y = 0.03;
    topMount.add(mountPlate);
    const mountRubber = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.05, 24), bushRubber);
    mountRubber.position.y = -0.005;
    topMount.add(mountRubber);
    const mountBolts = boltCircle(3, 0.09, 0.014, chromeRod, 0.03);
    mountBolts.position.y = 0.055;
    topMount.add(mountBolts);
    const upperSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.115, 0.024, 28), sheetSteel);
    upperSeat.position.y = -0.06;
    topMount.add(upperSeat);
    sealedOnly.push(upperSeat);

    const bumpStop = new THREE.Group();
    strut.add(bumpStop);
    const stopCone = lathe(
      [
        [0.032, 0],
        [0.042, 0.02],
        [0.03, 0.045],
        [0.042, 0.07],
        [0.03, 0.095],
        [0.04, 0.115],
        [0.026, 0.13],
      ],
      stopPoly,
      24,
    );
    bumpStop.add(stopCone);
    sealedOnly.push(bumpStop);

    const perch = lathe(
      [
        [0.05, 0],
        [0.135, 0.02],
        [0.14, 0.05],
        [0.13, 0.052],
        [0.05, 0.026],
      ],
      sheetSteel,
      28,
    );
    perch.position.y = PERCH_Y;
    strut.add(perch);
    sealedOnly.push(perch);

    const spring = coil(
      {
        turns: 8,
        radius: SPRING_R,
        length: SPRING_L0,
        wireRadius: WIRE_R,
        segmentsPerTurn: 20,
      },
      springSteel,
    ).mesh;
    strut.add(spring);
    sealedOnly.push(spring);

    // oil-flow arrows: one set for compression, one for rebound
    function flowCone(scale, y, radial, dir) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.009 * scale, 0.028 * scale, 10), flowMat.clone());
      cone.position.set(radial, y, 0.0);
      cone.rotation.z = dir > 0 ? 0 : Math.PI;
      return cone;
    }
    const compArrows = new THREE.Group();
    const rebArrows = new THREE.Group();
    strut.add(compArrows, rebArrows);
    cutOnly.push(compArrows, rebArrows);
    // compression: oil up through the piston, rod volume out the base valve
    for (const rx of [-0.017, 0.017]) {
      compArrows.add(flowCone(1, 0.0, rx, 1));
      rebArrows.add(flowCone(1, 0.0, rx, -1));
    }
    for (const rx of [-0.038, 0.038]) {
      compArrows.add(flowCone(0.85, 0.22, rx, 1));
      rebArrows.add(flowCone(0.85, 0.22, rx, -1));
    }
    const compPistonArrows = compArrows.children.slice(0, 2);
    const rebPistonArrows = rebArrows.children.slice(0, 2);

    // ------------------------------------------------------------------
    //  WHEEL — hub, rim, five spokes, tire. Hidden outright on reveal.
    // ------------------------------------------------------------------
    const wheel = new THREE.Group();
    wheel.position.set(sgn * KCX, KCY, 0);
    knuckle.add(wheel);
    const wheelMetal = [];
    const rimShell = new THREE.Mesh(new THREE.CylinderGeometry(RIM_R, RIM_R, TIRE_W, 40, 1, true), wheelAlu);
    rimShell.rotation.z = Math.PI / 2;
    rimShell.castShadow = true;
    wheel.add(rimShell);
    const rimLiner = new THREE.Mesh(
      new THREE.CylinderGeometry(RIM_R - 0.006, RIM_R - 0.006, TIRE_W, 40, 1, true),
      dullBore,
    );
    rimLiner.rotation.z = Math.PI / 2;
    wheel.add(rimLiner);
    wheelMetal.push(rimShell, rimLiner);
    // face: five tapered spokes lying flush, hub disc, five lug recesses
    const face = new THREE.Group();
    face.rotation.y = sgn * Math.PI * 0.5; // local XY becomes the wheel face
    face.position.set(sgn * 0.165, 0, 0);
    wheel.add(face);
    const spokeShape = new THREE.Shape();
    spokeShape.moveTo(-0.045, 0.07);
    spokeShape.lineTo(0.045, 0.07);
    spokeShape.lineTo(0.085, 0.4);
    spokeShape.lineTo(-0.085, 0.4);
    spokeShape.closePath();
    const spokeGeo = new THREE.ExtrudeGeometry(spokeShape, {
      depth: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.007,
      bevelSegments: 2,
    });
    for (let i = 0; i < 5; i++) {
      const spoke = new THREE.Mesh(spokeGeo, wheelAlu);
      spoke.rotation.z = (i / 5) * TAU;
      spoke.castShadow = true;
      face.add(spoke);
      wheelMetal.push(spoke);
    }
    const lipShape = new THREE.Shape();
    lipShape.absarc(0, 0, RIM_R + 0.01, 0, TAU, false);
    const lipHole = new THREE.Path();
    lipHole.absarc(0, 0, RIM_R - 0.05, 0, TAU, true);
    lipShape.holes.push(lipHole);
    const rimLip = new THREE.Mesh(
      new THREE.ExtrudeGeometry(lipShape, {
        depth: 0.035,
        bevelEnabled: true,
        bevelThickness: 0.007,
        bevelSize: 0.006,
        bevelSegments: 1,
        curveSegments: 40,
      }),
      wheelAlu,
    );
    rimLip.castShadow = true;
    face.add(rimLip);
    wheelMetal.push(rimLip);
    const hubDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 28), wheelAlu);
    hubDisc.rotation.set(Math.PI / 2, 0, 0);
    hubDisc.position.z = 0.025;
    face.add(hubDisc);
    wheelMetal.push(hubDisc);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.3;
      const lugNut = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.022, 6), chromeRod);
      lugNut.rotation.set(Math.PI / 2, 0, 0);
      lugNut.position.set(Math.cos(a) * 0.085, Math.sin(a) * 0.085, 0.055);
      face.add(lugNut);
      wheelMetal.push(lugNut);
    }
    // tire
    const tireWall = new THREE.Mesh(new THREE.TorusGeometry(TIRE_R - 0.17, 0.17, 18, 48), tireRubber);
    tireWall.rotation.y = Math.PI / 2;
    tireWall.castShadow = true;
    wheel.add(tireWall);
    const tread = new THREE.Mesh(
      new THREE.CylinderGeometry(TIRE_R, TIRE_R, TIRE_W - 0.02, 56, 1, true),
      tireRubber,
    );
    tread.rotation.z = Math.PI / 2;
    tread.castShadow = true;
    wheel.add(tread);
    const tireParts = [tireWall, tread];

    // ------------------------------------------------------------------
    //  ROAD PAD — the ground under this wheel, on its own actuator column
    // ------------------------------------------------------------------
    const pad = new THREE.Group();
    group.add(pad);
    // the pad's ORIGIN is the road surface — the tire stands exactly on it
    const padPlate = beveledBox(0.62, 0.04, 0.7, darkCast, 0.012);
    padPlate.position.y = -0.038;
    padPlate.receiveShadow = true;
    pad.add(padPlate);
    const padSurface = beveledBox(0.56, 0.018, 0.64, padTop, 0.008);
    padSurface.position.y = -0.009;
    padSurface.receiveShadow = true;
    pad.add(padSurface);
    const padColumn = rod(0.08, 1, padColumnSteel, 20);
    pad.add(padColumn);
    pad.position.set(sgn * HALF_TRACK, GROUND, 0);

    // ------------------------------------------------------------------
    //  ANTI-ROLL BAR END for this side (rotates about world +X)
    // ------------------------------------------------------------------
    const barEnd = new THREE.Group();
    barEnd.position.set(sgn * BAR_HALF, BAR_Y, BAR_Z);
    bodyInner.add(barEnd);
    const barArm = tubeAlong(
      [
        [0, 0, 0],
        [sgn * 0.2, 0.0, -0.06],
        [sgn * 0.4, 0.0, -0.2],
        [sgn * 0.48, 0.0, -BAR_ARM],
      ],
      BAR_R,
      barSteel,
      { tubularSegments: 30, radialSegments: 12 },
    );
    barEnd.add(barArm);
    const barEye = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.011, 8, 18), barSteel);
    barEye.rotation.y = Math.PI / 2;
    barEye.position.set(sgn * 0.48, 0, -BAR_ARM);
    barEnd.add(barEye);

    const dropLink = rod(0.014, 1, linkSteel, 12);
    bodyInner.add(dropLink);
    const linkBallLo = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), darkCast);
    const linkBallHi = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), darkCast);
    bodyInner.add(linkBallLo, linkBallHi);

    Object.assign(corner, {
      sgn,
      arm,
      knuckle,
      strut,
      piston,
      pistonRod,
      topMount,
      bumpStop,
      spring,
      wheel,
      wheelMetal,
      tireParts,
      pad,
      padColumn,
      barEnd,
      dropLink,
      linkBallLo,
      linkBallHi,
      cutOnly,
      sealedOnly,
      compArrows,
      rebArrows,
      compPistonArrows,
      rebPistonArrows,
      state: { s: S_LEN, theta: TH0, psi: 0 },
    });
    return corner;
  }

  const near = buildCorner(1); // +X — the corner that opens up
  const far = buildCorner(-1);
  const corners = [near, far];

  // ==========================================================================
  //  POSE
  // ==========================================================================
  const rollCos = { c: 1, s: 0 };
  function toWorldY(x, y, bodyY) {
    return ROLL_PIVOT + bodyY + x * rollCos.s + (y - ROLL_PIVOT) * rollCos.c;
  }

  function applyCorner(corner, pose) {
    const { sgn } = corner;
    corner.arm.rotation.z = sgn * pose.theta;
    corner.knuckle.position.set(sgn * pose.bx, pose.by, 0);
    corner.knuckle.rotation.z = sgn * pose.phi;

    const s = pose.s;
    corner.piston.position.y = s - ROD_LEN;
    corner.pistonRod.position.y = s - ROD_LEN;
    corner.topMount.position.y = s;
    corner.bumpStop.position.y = s - 0.28;
    const springLen = s - 0.1 - (PERCH_Y + 0.02);
    corner.spring.position.y = (PERCH_Y + 0.02 + (s - 0.1)) / 2;
    corner.spring.scale.y = springLen / SPRING_L0;
    corner.state.s = s;
    corner.state.theta = pose.theta;
  }

  function applyBar(corner, pose) {
    const { sgn } = corner;
    const tabY = PY + TAB_F * Math.sin(pose.theta);
    const psi = Math.asin(clampSin((tabY - TAB_Y0) / BAR_ARM));
    corner.barEnd.rotation.x = psi;
    corner.state.psi = psi;
    // drop link: re-spanned between the bar-arm eye and the control-arm tab
    const tipX = sgn * (BAR_HALF + 0.48);
    const tipY = BAR_Y + BAR_ARM * Math.sin(psi);
    const tipZ = BAR_Z - BAR_ARM * Math.cos(psi);
    const tabX = sgn * (PX + TAB_F * Math.cos(pose.theta));
    const from = new THREE.Vector3(tipX, tipY, tipZ);
    const to = new THREE.Vector3(tabX, tabY, TAB_Z);
    const dir = to.clone().sub(from);
    const len = dir.length();
    corner.dropLink.position.copy(from);
    corner.dropLink.scale.set(1, len, 1);
    corner.dropLink.quaternion.setFromUnitVectors(UP, dir.normalize());
    corner.linkBallLo.position.copy(from);
    corner.linkBallHi.position.copy(to);
  }

  function clampSin(v) {
    return Math.min(0.98, Math.max(-0.98, v));
  }

  // THE pose function. Road-pad heights + body heave/roll in; every part out.
  function setRig(roadL = 0, roadR = 0, bodyY = 0, roll = 0) {
    rollCos.c = Math.cos(roll);
    rollCos.s = Math.sin(roll);
    bodyRoll.position.y = ROLL_PIVOT + bodyY;
    bodyRoll.rotation.z = roll;

    for (const corner of corners) {
      const road = corner.sgn > 0 ? roadR : roadL;
      const target = GROUND + road + TIRE_R;
      // solve the body-relative travel that stands this tire on its pad
      let cy = C0Y;
      let pose = poseAt(TH0);
      for (let i = 0; i < 4; i++) {
        pose = poseAt(thetaForHeight(cy));
        const err = target - toWorldY(corner.sgn * pose.cx, pose.cy, bodyY);
        if (Math.abs(err) < 2e-5) break;
        cy += err;
      }
      applyCorner(corner, pose);
      applyBar(corner, pose);
      // the pad rides its actuator column up out of the plinth
      corner.pad.position.y = GROUND + road;
      const columnLen = Math.max(0.02, GROUND + road - PLINTH_H);
      corner.padColumn.scale.y = columnLen;
      corner.padColumn.position.y = -columnLen;
    }

    // bar twist marks: the angle gradient between the two ends
    const psiL = far.state.psi;
    const psiR = near.state.psi;
    for (const mark of twistMarks) mark.rotation.x = psiL + (psiR - psiL) * mark.userData.f;
  }

  function setReveal(t) {
    const off = clamp01(t) > 0.5;
    // the whole near wheel comes off — metal can't be ghosted (pre-flight #3),
    // and the far wheel stays on the road so the axle keeps its ground truth
    for (const mesh of near.wheelMetal) mesh.visible = !off;
    for (const mesh of near.tireParts) mesh.visible = !off;
    near.pad.visible = !off;
  }

  function setCut(t) {
    const open = clamp01(t) > 0.5;
    for (const corner of corners) {
      for (const mesh of corner.sealedOnly) mesh.visible = !open;
      for (const mesh of corner.cutOnly) mesh.visible = open;
    }
  }

  function setFlow(v) {
    const mag = Math.min(1, Math.abs(v));
    for (const corner of corners) {
      for (const cone of corner.compArrows.children) {
        cone.material.opacity = v > 0 ? mag * 0.95 : 0;
      }
      for (const cone of corner.rebArrows.children) {
        cone.material.opacity = v < 0 ? mag * 0.95 : 0;
      }
      // the piston arrows ride the piston; the outer pair sit in the reserve
      for (const cone of corner.compPistonArrows) cone.position.y = corner.state.s - ROD_LEN + 0.05;
      for (const cone of corner.rebPistonArrows) cone.position.y = corner.state.s - ROD_LEN - 0.03;
    }
  }

  // ==========================================================================
  //  CALLOUTS — every anchor sits on the NEAR (+X) corner, which the cameras
  //  frame right of the text panel; leaders aim right so the pills stay clear
  //  of the panel's left 38%.
  // ==========================================================================
  const labels = calloutSets(['exterior', 'linkage', 'spring', 'damper', 'arb']);
  labels.add('exterior', near.wheel, 'Tire', [0.0, -0.52, 0.34], 24, 74);
  labels.add('exterior', near.strut, 'Coil spring', [0, 0.72, SPRING_R], 28, 62);
  labels.add('exterior', near.topMount, 'Strut top mount', [0, 0.04, 0.11], 40, 70);
  labels.add('exterior', bodyInner, 'Anti-roll bar', [0.34, BAR_Y, BAR_Z], -20, 70);
  labels.add('exterior', bodyInner, 'Subframe', [0.44, PY + 0.06, 0.3], 22, 58);

  labels.add('linkage', near.arm, 'Lower control arm', [ARM_L * 0.55, -0.03, 0.16], -28, 66);
  labels.add('linkage', near.knuckle, 'Ball joint', [0.02, 0.02, 0.1], -55, 74);
  labels.add('linkage', near.knuckle, 'Steering knuckle + hub', [0.04, 0.3, 0.14], 25, 68);
  labels.add('linkage', near.topMount, 'Top mount', [0, 0.04, 0.1], 35, 82);
  labels.add('linkage', near.arm, 'Rubber bushings', [0.03, 0, 0.28], 60, 62);

  labels.add('spring', near.strut, 'Coil spring · 30 N/mm', [0, 0.74, SPRING_R], 26, 78);
  labels.add('spring', near.topMount, 'Upper seat', [0, -0.06, 0.12], 45, 58);
  labels.add('spring', near.strut, 'Lower perch', [0, PERCH_Y + 0.03, 0.12], -34, 62);
  labels.add('spring', near.bumpStop, 'Bump stop', [0, 0.07, 0.04], 55, 70);

  labels.add('damper', near.strut, 'Piston rod', [0, 0.62, ROD_R], 42, 62);
  labels.add('damper', near.strut, 'Reserve tube', [RES_R, 0.56, -0.01], 2, 62);
  labels.add('damper', near.strut, 'Working cylinder', [CYL_R, 0.46, 0], 24, 66);
  labels.add('damper', near.piston, 'Piston + valves', [0.024, 0.015, 0.018], -16, 66);
  labels.add('damper', near.strut, 'Base valve', [CYL_R * 0.55, CYL_BOT + 0.012, 0.02], 4, 78);

  labels.add('arb', bodyInner, 'Anti-roll bar · 22 mm', [0.22, BAR_Y, BAR_Z], 24, 86);
  labels.add('arb', near.linkBallHi, 'Drop link', [0, -0.08, 0.03], 34, 58);
  labels.add('arb', bodyInner, 'Bar bushing', [0.5, BAR_Y - 0.03, BAR_Z], -38, 62);

  // initial state: complete, sealed, sitting at ride height
  setRig(0, 0, 0, 0);
  setReveal(0);
  setCut(0);
  setFlow(0);
  labels.setLabels(false);

  return {
    group,
    setRig,
    setReveal,
    setCut,
    setFlow,
    setLabels: labels.setLabels,
    parts: {
      body: bodyRoll,
      nearArm: near.arm,
      nearKnuckle: near.knuckle,
      nearStrut: near.strut,
      nearPiston: near.piston,
      nearWheel: near.wheel,
      nearPad: near.pad,
      barNear: near.barEnd,
      barFar: far.barEnd,
      nearDropLink: near.dropLink,
    },
  };
}
