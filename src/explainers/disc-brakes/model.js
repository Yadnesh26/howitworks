import * as THREE from 'three';
import { materials, rod, disc, studioPlinth, chargeQueue } from '../../framework/parts.js';
import { beveledBox, lathe, tubeAlong, boltCircle } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, smooth, win, profileTable, TAU } from '../../framework/motion.js';

// A single front-corner disc-brake assembly (floating single-piston caliper,
// vented rotor) on a display stand, with the wheel+tire as the removable
// "skin", plus a small brake-pedal + master-cylinder unit on the plinth
// feeding the caliper through a brake line — the Pascal's-principle story.
//
// PROPORTIONS (real numbers): rotor 300 mm ø × 28 mm in a ~640 mm-OD tire →
// rotor ø ≈ 0.47 × tire OD; rotor thickness ≈ 0.093 × its ø; caliper piston
// ø ≈ 0.19 × rotor ø; pads sweep ≈ 60° arcs. Scene scale: TIRE_R = 1.32 →
// ROTOR_R = 0.62, ROTOR_T = 0.058, PISTON_R = 0.115. 40 radial vanes between
// the rotor's two friction plates (a centrifugal air pump), 5-lug hat.
//
// MECHANISM (researched): pedal lever ~4:1 → master cylinder (~22 mm bore) →
// incompressible fluid → caliper piston (~57 mm bore). Pressure is equal
// everywhere (Pascal), so force multiplies ≈ (57/22)² × 4 ≈ 27× foot-to-pad.
// FLOATING caliper: the single piston pushes only the INNER pad; the body
// slides inboard on two guide pins so its outboard fingers drag the OUTER
// pad in — one piston clamps both sides. Braking converts kinetic energy to
// heat in the friction ring (hundreds of °C); the vanes pump air hat→rim.
//
// DISCLOSED EXAGGERATION: real pad clearance is ~0.1–0.5 mm — invisible.
// The model uses GAP = 0.022 and body slide S = 0.045 world units (~10×) so
// the floating action reads on screen.
//
// SCALARS:
//   setCycle(u) — THE canonical braking lap (u 0→1): cruise → pedal +
//     pressure dots → clamp → decel + heat rise → release → spin-up + cool.
//     Wheel spin comes from motion.profileTable → WHOLE turns per lap by
//     construction (5-lug hat and 40-vane symmetry both need integer turns).
//   setCruise(turns) — plain rolling, no braking (cooling step).
//   setReveal(t) — 0: wheel+tire on. 1: metal wheel HIDDEN outright (metal
//     can't be ghosted), tire ghosted to a faint rubber shell for context.
//   setAir(v) — cooling-airflow arrows on/off.
//   setLabels(mode) — 'exterior' | 'internal' | 'clamp' | 'cooling' | false.

// --- layout ------------------------------------------------------------------
const AXLE_Y = 1.42; // wheel axis height, axis along X (outboard = +X)
const TIRE_R = 1.32;
const ROTOR_R = 0.62;
const ROTOR_T = 0.058;
const PLATE_T = 0.02; // each friction plate; vanes fill the gap between
const VANES = 40;
const HAT_R = 0.3;
const PISTON_R = 0.115;
const CAL_A = 0.6; // caliper azimuth from top, toward +Z (camera side)
const GAP = 0.022; // pad running clearance (exaggerated, see header)
const SLIDE = 0.045; // caliper-body float travel (exaggerated)
const PAD_ARC = Math.PI / 3; // 60°
const PAD_R_IN = 0.38;
const PAD_R_OUT = 0.6;

// braking-lap choreography windows (fractions of one setCycle lap)
const W_PEDAL = [0.3, 0.4]; // pedal + pressure apply
const W_CLAMP = [0.36, 0.44]; // pads close
const W_DECEL = [0.4, 0.62]; // wheel slows, heat rises
const W_RELEASE = [0.62, 0.72]; // pedal off, pads open
const CYCLE_TURNS = 6; // whole wheel turns per lap (profileTable contract)

export function buildDiscBrake({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // --- materials --------------------------------------------------------------
  const ironRotor = materials.brushedSteel(0xb7bcc3);
  ironRotor.roughness = 0.55;
  const ironDark = materials.darkMetal(0x3a3f47);
  const calRed = materials.paintedMetal(0xb3232a);
  const chromePart = materials.chrome(0xd6dbe1);
  chromePart.roughness = 0.2;
  const alloy = materials.aluminum(0xc0c6cd);
  alloy.roughness = 0.55;
  const tireRubber = materials.rubber(0x17181b);
  const padFriction = new THREE.MeshPhysicalMaterial({
    color: 0x2e2a26,
    metalness: 0.1,
    roughness: 0.9,
  });
  const backingSteel = materials.steel(0x6f7681);
  const hubGrimy = materials.grimyAluminum(0x9aa0a8);
  const standMat = materials.darkMetal(0x24272c);
  const sealRubber = materials.rubber(0x101113);
  const lineSteel = materials.darkMetal(0x30343a);
  // heat glow overlays on the friction ring — transparent + depthWrite:false
  // (pre-flight #7) so a cooled-to-0 ring never punches holes
  const heatMat = () =>
    new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  const airMat = new THREE.MeshStandardMaterial({
    color: 0x8fd3ff,
    emissive: 0x8fd3ff,
    emissiveIntensity: 1.2,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  // --- plinth + stand -----------------------------------------------------------
  const plinth = studioPlinth({ w: 4.4, d: 2.7 });
  plinth.position.x = -0.2;
  group.add(plinth);

  const column = beveledBox(0.24, AXLE_Y - 0.26, 0.24, standMat, 0.03);
  column.position.set(-0.95, 0.26 + (AXLE_Y - 0.26) / 2, 0);
  group.add(column);
  const axleArm = rod(0.07, 0.9, standMat, 16);
  axleArm.rotation.z = -Math.PI / 2; // +Y → +X
  axleArm.position.set(-0.95, AXLE_Y, 0);
  group.add(axleArm);

  // --- hub (inboard, grimy) -------------------------------------------------------
  const hub = rod(0.16, 0.34, hubGrimy, 24);
  hub.rotation.z = -Math.PI / 2;
  hub.position.set(-0.34, AXLE_Y, 0);
  group.add(hub);

  // ============================================================================
  //  ROTOR (spins with the wheel) — two plates + 40 vanes + hat + lugs
  // ============================================================================
  const rotor = new THREE.Group();
  rotor.position.set(0, AXLE_Y, 0);
  group.add(rotor);
  for (const sx of [-1, 1]) {
    const plate = disc(ROTOR_R, PLATE_T, ironRotor, 64);
    plate.rotation.z = Math.PI / 2; // disc axis +Y → +X
    plate.position.x = sx * (ROTOR_T / 2 - PLATE_T / 2);
    rotor.add(plate);
  }
  // vanes: radial fins between the plates (the centrifugal pump)
  const vaneGeo = new THREE.BoxGeometry(ROTOR_T - 2 * PLATE_T, 0.035, ROTOR_R - HAT_R - 0.04);
  for (let i = 0; i < VANES; i++) {
    const a = (i / VANES) * TAU;
    const v = new THREE.Mesh(vaneGeo, ironDark);
    const rMid = (HAT_R + ROTOR_R) / 2;
    v.position.set(0, Math.cos(a) * rMid, Math.sin(a) * rMid);
    v.rotation.x = -a; // fin runs radially
    rotor.add(v);
  }
  // heat-glow rings on both friction faces — restricted to the actual
  // pad-swept band; deep red at modest opacity so it reads as hot iron, not
  // pink paint (self-review finding: a wide bright additive ring washed the
  // whole disc face salmon)
  const heatRings = [];
  for (const sx of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.6, 64), heatMat());
    ring.material.color.setHex(0xff2200);
    ring.rotation.y = Math.PI / 2; // face along X
    ring.position.x = sx * (ROTOR_T / 2 + 0.002);
    rotor.add(ring);
    heatRings.push(ring);
  }
  // hat: from plate inner radius out to the wheel-mount face (outboard)
  const hat = lathe(
    [
      [HAT_R, 0],
      [HAT_R - 0.02, 0.05],
      [0.26, 0.09],
      [0.26, 0.11],
      [0.05, 0.11],
    ],
    ironRotor,
    48,
  );
  hat.rotation.z = -Math.PI / 2; // +Y → +X
  hat.position.x = ROTOR_T / 2 - 0.005;
  rotor.add(hat);
  const lugs = boltCircle(5, 0.17, 0.032, chromePart, 0.07);
  lugs.rotation.z = -Math.PI / 2;
  lugs.position.x = ROTOR_T / 2 + 0.11;
  rotor.add(lugs);
  const hubCap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), chromePart);
  hubCap.position.set(ROTOR_T / 2 + 0.12, 0, 0);
  rotor.add(hubCap);

  // ============================================================================
  //  WHEEL + TIRE (the removable skin)
  // ============================================================================
  const wheel = new THREE.Group();
  wheel.position.set(0.16, AXLE_Y, 0);
  group.add(wheel);
  const wheelMetal = []; // hidden outright on reveal
  // rim barrel: FrontSide shell + dark BackSide liner (no concave-mirror)
  const rimShell = new THREE.Mesh(
    new THREE.CylinderGeometry(1.02, 1.02, 0.44, 48, 1, true),
    alloy,
  );
  rimShell.rotation.z = Math.PI / 2;
  rimShell.castShadow = true;
  wheel.add(rimShell);
  const rimLiner = new THREE.Mesh(
    new THREE.CylinderGeometry(1.015, 1.015, 0.44, 48, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.9, side: THREE.BackSide }),
  );
  rimLiner.rotation.z = Math.PI / 2;
  wheel.add(rimLiner);
  wheelMetal.push(rimShell, rimLiner);
  // Wheel FACE, reference-matched: six flat TAPERED spokes (narrow at the
  // hub, wide at the rim) lying flush in one face plane, a flat hub disc
  // with five lug recesses (matches the rotor's 5-lug hat) and a small
  // bright bore, and a flat rim lip — machined-alloy look, no chrome dome.
  // Everything is built in a holder whose local XY is the wheel face
  // (rotation.y = PI/2 → local +Z is the axle, world +X).
  const faceX = 0.2;
  const faceHolder = new THREE.Group();
  faceHolder.rotation.y = Math.PI / 2;
  faceHolder.position.x = faceX;
  wheel.add(faceHolder);
  const faceAlloy = materials.aluminum(0xd0d5da);
  faceAlloy.roughness = 0.58; // machined but calm — 0.42 threw glitter off the spoke bevels
  const spokeShape = new THREE.Shape();
  spokeShape.moveTo(-0.07, 0.16);
  spokeShape.lineTo(0.07, 0.16);
  spokeShape.lineTo(0.155, 0.98);
  spokeShape.lineTo(-0.155, 0.98);
  spokeShape.closePath();
  const spokeGeo = new THREE.ExtrudeGeometry(spokeShape, {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.012,
    bevelSegments: 2,
  });
  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(spokeGeo, faceAlloy);
    spoke.rotation.z = (i / 6) * TAU;
    spoke.castShadow = true;
    faceHolder.add(spoke);
    wheelMetal.push(spoke);
  }
  // rim lip: flat annulus flush with the face
  const lipShape = new THREE.Shape();
  lipShape.absarc(0, 0, 1.03, 0, TAU, false);
  const lipHole = new THREE.Path();
  lipHole.absarc(0, 0, 0.93, 0, TAU, true);
  lipShape.holes.push(lipHole);
  const lip = new THREE.Mesh(
    new THREE.ExtrudeGeometry(lipShape, {
      depth: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.01,
      bevelSegments: 1,
      curveSegments: 48,
    }),
    faceAlloy,
  );
  lip.castShadow = true;
  faceHolder.add(lip);
  wheelMetal.push(lip);
  // hub disc + five lug recesses + small bright bore
  const hubDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.08, 32), faceAlloy);
  hubDisc.rotation.z = Math.PI / 2; // axis → local Z? built in world-x terms below
  hubDisc.rotation.set(Math.PI / 2, 0, 0); // cylinder +Y → local +Z (axle)
  hubDisc.position.z = 0.04;
  hubDisc.castShadow = true;
  faceHolder.add(hubDisc);
  wheelMetal.push(hubDisc);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.3;
    const recess = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.02, 16),
      materials.darkMetal(0x22252a),
    );
    recess.rotation.set(Math.PI / 2, 0, 0);
    recess.position.set(Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0.085);
    faceHolder.add(recess);
    wheelMetal.push(recess);
  }
  const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.025, 20), chromePart);
  bore.rotation.set(Math.PI / 2, 0, 0);
  bore.position.z = 0.085;
  faceHolder.add(bore);
  wheelMetal.push(bore);
  // tire: torus sidewalls + flat tread band (ghosts on reveal — low-specular
  // rubber, so a faint shell reads correctly; pre-flight #3)
  const tireTorus = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.26, 20, 64), tireRubber);
  tireTorus.rotation.y = Math.PI / 2;
  tireTorus.castShadow = true;
  wheel.add(tireTorus);
  const tread = new THREE.Mesh(new THREE.CylinderGeometry(TIRE_R, TIRE_R, 0.38, 64, 1, true), tireRubber);
  tread.rotation.z = Math.PI / 2;
  tread.castShadow = true;
  wheel.add(tread);
  const tireParts = [tireTorus, tread];

  // ============================================================================
  //  FLOATING CALIPER (fixed azimuth CAL_A; body slides on guide pins)
  // ============================================================================
  // calAssembly local frame: +X = axle (outboard), +Y = radially out through
  // the caliper, achieved by rotating the whole group about X by CAL_A.
  const calAssembly = new THREE.Group();
  calAssembly.position.set(0, AXLE_Y, 0);
  calAssembly.rotation.x = CAL_A;
  group.add(calAssembly);

  // bracket (fixed): carrier plate inboard + two ears with guide pins
  const carrier = beveledBox(0.1, 0.16, 0.62, ironDark, 0.02);
  carrier.position.set(-0.24, 0.5, 0);
  calAssembly.add(carrier);
  const guidePins = [];
  for (const sz of [-1, 1]) {
    const ear = beveledBox(0.08, 0.1, 0.1, ironDark, 0.015);
    ear.position.set(-0.16, 0.52, sz * 0.36);
    calAssembly.add(ear);
    const pin = rod(0.022, 0.34, chromePart, 12);
    pin.rotation.z = -Math.PI / 2; // +Y → +X
    pin.position.set(-0.16, 0.52, sz * 0.36);
    calAssembly.add(pin);
    guidePins.push(pin);
  }

  // sliding body: inboard housing (piston bore) + bridge with an inspection
  // window (real calipers have one — and it lets the clamp step SEE the
  // piston/pads; pre-flight #10) + outboard fingers
  const body = new THREE.Group();
  calAssembly.add(body);
  const housing = beveledBox(0.2, 0.3, 0.56, calRed, 0.04);
  housing.position.set(-0.17, 0.48, 0);
  body.add(housing);
  // bridge: two rails over the rotor leaving a central window
  for (const sz of [-1, 1]) {
    const rail = beveledBox(0.4, 0.12, 0.16, calRed, 0.03);
    rail.position.set(0.03, 0.6, sz * 0.21);
    body.add(rail);
  }
  const bridgeBack = beveledBox(0.4, 0.12, 0.14, calRed, 0.03);
  bridgeBack.position.set(0.03, 0.6, -0.34);
  body.add(bridgeBack);
  const bridgeFront = beveledBox(0.4, 0.12, 0.14, calRed, 0.03);
  bridgeFront.position.set(0.03, 0.6, 0.34);
  body.add(bridgeFront);
  // outboard fingers (press the outer pad by reaction)
  for (const sz of [-1, 0, 1]) {
    const finger = beveledBox(0.06, 0.24, 0.12, calRed, 0.02);
    finger.position.set(0.185, 0.5, sz * 0.2);
    body.add(finger);
  }
  // body ears riding the guide pins
  for (const sz of [-1, 1]) {
    const bodyEar = beveledBox(0.12, 0.09, 0.09, calRed, 0.02);
    bodyEar.position.set(-0.05, 0.52, sz * 0.36);
    body.add(bodyEar);
  }
  // piston (chrome, slides in the bore) + rubber seal at the bore mouth
  const piston = new THREE.Mesh(
    new THREE.CylinderGeometry(PISTON_R, PISTON_R, 0.1, 28),
    chromePart,
  );
  piston.rotation.z = Math.PI / 2; // axis along X
  piston.castShadow = true;
  body.add(piston);
  const seal = new THREE.Mesh(new THREE.TorusGeometry(PISTON_R + 0.008, 0.012, 10, 28), sealRubber);
  seal.rotation.y = Math.PI / 2;
  seal.position.set(-0.062, 0.48, 0);
  body.add(seal);
  // fluid inlet + bleed nipple greeble
  const inlet = rod(0.028, 0.1, lineSteel, 10);
  inlet.position.set(-0.27, 0.55, 0.05);
  inlet.rotation.x = -0.4;
  body.add(inlet);

  // --- pads: ring-sector slabs (steel backing + friction block) ----------------
  // built in a holder whose local Z is the world axle X (rotation.y = PI/2),
  // sector centred at local angle PI/2 == the caliper's radial direction
  function ringSector(rIn, rOut, arc, depth, mat) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, rOut, Math.PI / 2 - arc / 2, Math.PI / 2 + arc / 2, false);
    shape.absarc(0, 0, rIn, Math.PI / 2 + arc / 2, Math.PI / 2 - arc / 2, true);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelSegments: 1,
      curveSegments: 24,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
  }
  function buildPad(facingSign) {
    // friction block faces the rotor (facingSign = direction pad presses)
    const holder = new THREE.Group();
    holder.rotation.y = Math.PI / 2; // local +Z → world +X
    const backing = ringSector(PAD_R_IN, PAD_R_OUT, PAD_ARC, 0.02, backingSteel);
    const friction = ringSector(PAD_R_IN + 0.01, PAD_R_OUT - 0.01, PAD_ARC - 0.06, 0.03, padFriction);
    if (facingSign > 0) {
      // presses toward +X: friction in front of backing (local +Z stack)
      backing.position.z = 0;
      friction.position.z = 0.02;
    } else {
      friction.position.z = -0.03;
      backing.position.z = -0.0;
      backing.position.z = 0;
      friction.position.z = -0.03;
    }
    holder.add(backing, friction);
    calAssembly.add(holder);
    return holder;
  }
  const innerPad = buildPad(1); // inboard pad, pushed +X onto the rotor
  const outerPad = buildPad(-1); // outboard pad, dragged -X by the body — but
  // it must slide WITH the body, so parent it there instead
  calAssembly.remove(outerPad);
  body.add(outerPad);

  // ============================================================================
  //  PEDAL + MASTER CYLINDER + BRAKE LINE (the Pascal chain)
  // ============================================================================
  // front-left corner of the plinth (+Z side) so the Pascal step's camera can
  // frame it clear of the text panel (self-review: rear placement hid it)
  const pedalUnit = new THREE.Group();
  pedalUnit.position.set(-1.6, 0.26, 0.78);
  group.add(pedalUnit);
  const pedalBase = beveledBox(0.34, 0.05, 0.3, standMat, 0.015);
  pedalBase.position.y = 0.025;
  pedalUnit.add(pedalBase);
  const pedalPivot = new THREE.Group();
  pedalPivot.position.set(0.05, 0.06, 0);
  pedalUnit.add(pedalPivot);
  const pedalArm = beveledBox(0.05, 0.42, 0.09, backingSteel, 0.012);
  pedalArm.position.set(0, 0.21, 0);
  pedalPivot.add(pedalArm);
  const pedalFoot = beveledBox(0.16, 0.05, 0.22, sealRubber, 0.012);
  pedalFoot.position.set(0, 0.42, 0);
  pedalPivot.add(pedalFoot);
  // master cylinder + reservoir
  const mc = rod(0.07, 0.36, alloy, 20);
  mc.rotation.z = -Math.PI / 2; // +Y → +X
  mc.position.set(0.1, 0.14, 0);
  pedalUnit.add(mc);
  const reservoir = rod(0.055, 0.1, new THREE.MeshPhysicalMaterial({
    color: 0xf4f1e8,
    roughness: 0.5,
    metalness: 0,
    transparent: true,
    opacity: 0.85,
  }), 16);
  reservoir.position.set(0.3, 0.2, 0);
  pedalUnit.add(reservoir);
  const pushrod = rod(0.02, 0.12, chromePart, 10);
  pushrod.rotation.z = -Math.PI / 2;
  pushrod.position.set(-0.02, 0.14, 0);
  pedalUnit.add(pushrod);

  // brake line: MC outlet → up and over → caliper inlet (world coords)
  const inletWorld = new THREE.Vector3(-0.3, AXLE_Y + 0.55 * Math.cos(CAL_A), 0.55 * Math.sin(CAL_A));
  const line = tubeAlong(
    [
      [-1.14, 0.4, 0.78],
      [-0.98, 0.58, 0.74],
      [-0.92, 1.1, 0.55],
      [-0.62, 1.72, 0.38],
      [-0.42, 1.92, 0.32],
      [inletWorld.x, inletWorld.y + 0.05, inletWorld.z + 0.03],
    ],
    0.018,
    lineSteel,
  );
  group.add(line);
  // pressure dots riding the line while the pedal is pressed
  const fluid = chargeQueue(line.userData.curve, 6, 0xff5346, { size: 0.03, spacing: 0.1 });
  group.add(fluid.group);

  // ============================================================================
  //  COOLING AIRFLOW ARROWS (world frame — air moves radially, rotor spins)
  // ============================================================================
  const airArrows = [];
  const airGroup = new THREE.Group();
  airGroup.position.set(0, AXLE_Y, 0);
  group.add(airGroup);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.11, 10), airMat.clone());
    const rr = ROTOR_R + 0.12;
    cone.position.set(0, Math.cos(a) * rr, Math.sin(a) * rr);
    cone.rotation.x = -a; // cone +Y points radially out
    airGroup.add(cone);
    airArrows.push({ mesh: cone, a, out: true });
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.6;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 10), airMat.clone());
    const rr = HAT_R - 0.06;
    cone.position.set(-ROTOR_T, Math.cos(a) * rr, Math.sin(a) * rr);
    cone.rotation.x = -a + Math.PI; // pointing inward
    airGroup.add(cone);
    airArrows.push({ mesh: cone, a, out: false });
  }

  // ============================================================================
  //  CALLOUTS
  // ============================================================================
  // 'corner' (step 2, frames the brake corner) and 'pascal' (step 3, frames
  // the pedal/line) are SEPARATE sets — one shared set left step 2's camera
  // with pedal labels pointing off-frame (self-review finding)
  const labels = calloutSets(['exterior', 'corner', 'pascal', 'clamp', 'cooling']);
  labels.add('exterior', group, 'Tire', [0.3, AXLE_Y + TIRE_R - 0.12, 0.5], 40, 60);
  labels.add('exterior', group, 'Alloy wheel', [0.28, AXLE_Y + 0.62, 0.62], -25, 62);
  labels.add('exterior', group, 'Brake caliper — behind the spokes', [-0.05, AXLE_Y + 0.62, 0.46], 70, 70);

  labels.add('corner', group, 'Vented rotor (disc)', [0.05, AXLE_Y - 0.35, 0.58], -40, 62);
  labels.add('corner', group, 'Floating caliper', [-0.1, AXLE_Y + 0.78, 0.38], 55, 58);
  labels.add('corner', group, 'Hub — 5 lugs', [ROTOR_T / 2 + 0.14, AXLE_Y + 0.14, 0.12], 15, 54);
  // dir points the text RIGHT (dir with cos<0 extends text left, under the
  // step panel — reviewer measured this label 100% panel-hidden at dir 150)
  labels.add('corner', group, 'Brake line', [-0.7, 1.62, 0.45], 40, 64);

  labels.add('pascal', group, 'Brake line — fluid under pressure', [-0.85, 1.5, 0.48], 40, 66);
  labels.add('pascal', group, 'Master cylinder — small piston', [-1.42, 0.45, 0.82], -35, 70);
  labels.add('pascal', group, 'Brake pedal — 4:1 lever', [-1.52, 0.74, 0.86], 75, 88);
  labels.add('pascal', calAssembly, 'Caliper piston — wide bore', [-0.2, 0.4, 0.05], -60, 66);

  // anchors sit ON the named meshes (piston barrel y=0.48, pin axis y=0.52 —
  // reviewer projected the old anchors ~50px off onto the housing)
  labels.add('clamp', calAssembly, 'Piston — pushes the inner pad', [-0.1, 0.48, 0.05], -35, 72);
  labels.add('clamp', calAssembly, 'Guide pins — the body floats', [-0.16, 0.52, 0.38], 30, 66);
  labels.add('clamp', calAssembly, 'Inner pad', [0.0, 0.44, -0.28], -15, 64);
  labels.add('clamp', body, 'Outer pad — dragged by the body', [0.14, 0.44, 0.24], -20, 68);

  labels.add('cooling', group, '40 radial vanes — a centrifugal pump', [0.0, AXLE_Y + 0.47, 0.32], 45, 74);
  // both re-aimed rightward/on-screen: at dir 160 "…at the hat" clipped 44%
  // under the panel, and the rim label's old low anchor put its text entirely
  // below the 800px viewport (reviewer-measured)
  labels.add('cooling', group, 'Air in at the hat…', [-ROTOR_T - 0.05, AXLE_Y + 0.2, 0.1], 25, 70);
  labels.add('cooling', group, '…flung out at the rim', [0.0, AXLE_Y - 0.45, 0.44], -15, 66);

  // ============================================================================
  //  POSE
  // ============================================================================
  // wheel-speed profile over one braking lap: cruise → decel → grip → spin-up.
  // profileTable scales it so the lap advances EXACTLY CYCLE_TURNS whole turns.
  const spinProfile = profileTable(
    (u) =>
      u < W_DECEL[0] ? 1
      : u < W_DECEL[1] ? 1 - 0.82 * smooth((u - W_DECEL[0]) / (W_DECEL[1] - W_DECEL[0]))
      : u < W_RELEASE[1] ? 0.18
      : 0.18 + 0.82 * smooth((u - W_RELEASE[1]) / (1 - W_RELEASE[1])),
    CYCLE_TURNS,
  );

  function applySpin(angle) {
    rotor.rotation.x = -angle;
    wheel.rotation.x = -angle;
  }
  function applyBrake(b) {
    const t = clamp01(b);
    // pedal + master cylinder pushrod
    pedalPivot.rotation.z = t * 0.28;
    pushrod.position.x = -0.02 + t * 0.03;
    // floating action: body slides INBOARD (-X) while the piston extends
    // outboard, so both pads meet the rotor together
    body.position.x = -SLIDE * t;
    piston.position.set(-0.115 + (GAP + SLIDE) * t, 0.48, 0);
    innerPad.position.x = -(ROTOR_T / 2 + 0.05) - GAP * (1 - t) + 0.0;
    outerPad.position.x = ROTOR_T / 2 + 0.05 + GAP * (1 - t) + SLIDE * t;
  }
  function applyHeat(h) {
    const t = clamp01(h);
    for (const r of heatRings) r.material.opacity = t * 0.34;
  }
  function applyFluid(front, on) {
    fluid.setFront(on ? front : 0, on);
  }

  function setCycle(u) {
    u = ((u % 1) + 1) % 1;
    applySpin(spinProfile.at(u));
    const brake = win(u, W_CLAMP[0], W_CLAMP[1]) * (1 - win(u, W_RELEASE[0], W_RELEASE[1]));
    applyBrake(brake);
    // heat: charges during the decel window, decays after
    const heat = win(u, W_DECEL[0] + 0.02, W_DECEL[1]) * (1 - win(u, W_RELEASE[1], 0.98));
    applyHeat(heat);
    // fluid pressure front sweeps up the line as the pedal goes down
    const front = win(u, W_PEDAL[0], W_PEDAL[1]) * (1 - win(u, W_RELEASE[0], W_RELEASE[1]));
    applyFluid(front, brake > 0.01 || front > 0.01);
  }

  function setCruise(turns) {
    applySpin(turns * TAU);
    applyBrake(0);
    applyHeat(0);
    applyFluid(0, false);
  }

  function setReveal(t) {
    const revealed = clamp01(t) > 0.5;
    // the WHOLE wheel comes off, tire included — a ghosted near-black tire
    // over the black studio background read as a giant solid occluder, not
    // context (self-review finding); the hub/stand carry the spatial context
    for (const m of wheelMetal) m.visible = !revealed;
    for (const tp of tireParts) tp.visible = !revealed;
  }

  function setAir(v) {
    for (const { mesh } of airArrows) mesh.material.opacity = v ? 0.85 : 0;
  }

  // initial state: complete, sealed, rolling
  setReveal(0);
  setAir(false);
  setCycle(0.05);
  labels.setLabels(false);

  return {
    group,
    setCycle,
    setCruise,
    setReveal,
    setAir,
    setLabels: labels.setLabels,
    parts: { rotor, wheel, body, piston, innerPad, outerPad, pedalPivot, calAssembly },
  };
}
