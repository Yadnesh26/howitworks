import * as THREE from 'three';
import { materials, rod, disc, chargeQueue } from '../../framework/parts.js';
import { beveledBox, lathe, boltCircle } from '../../framework/geometry.js';
import { callout } from '../../framework/labels.js';
import { smudgeMap } from '../../framework/textures.js';

// An Indian countertop mixer grinder (Prestige-Endura-style base + 1.5 L
// blending jar), presented as a studio product shot on a charcoal plinth.
//
// FORM/PROPORTIONS from the reference photos (mixer/*.webp): the BASE is a
// squat, slightly tapered cylinder — as tall as it is wide, NOT a tall tube —
// with a chrome front band carrying the P·0·1·2·3 speed knob, a flared top
// collar that seats the jar, and a cross-shaped drive coupler poking up
// through the centre of the seat. Materials follow the spec (white body,
// orange accent, chrome trim), the reference gives the shape.
//
//   base height ≈ base diameter (squat) · jar ≈ 1.35 × base height, seated on
//   the collar · coupler a small hub on the axis · blade a 4-point steel star
//   at the very bottom of the jar · everything derived from ONE scale so the
//   silhouette matches a real mixer.
//
// MECHANISM (researched): a UNIVERSAL (series) motor — vertical armature +
// commutator + two carbon brushes, wrapped by a 2-pole stator whose field
// coils are in SERIES with the armature. Same current in both windings, so
// reversing AC reverses both together and torque never flips → runs on AC or
// DC. Two brushes 180° apart feed the commutator; every half armature turn a
// segment gap crosses each brush and the coil current reverses, keeping torque
// one-way. Speed is set by tapping the field coil: fewer field turns → weaker
// field → HIGHER speed (the series-motor quirk).
//
// SCALARS the pose is built from:
//   spin   — armature/blade/fan/commutator angle (rad). Blade is DIRECT drive
//            off the shaft via the coupler, so blade angle == spin.
//   jar    — 0 seated · 1 lifted clear (step 2 alignment reveal)
//   reveal — 0 body solid · 1 body ghosted + motor internals shown
//   speed  — knob index 0..4 (P,0,1,2,3): knob angle + which field tap glows
//   flow   — current/commutation phase (seamless per lap)
//   vortex — food-swirl phase inside the jar (seamless per lap)
//
// SEAMLESS LOOP: spin advances a whole EVEN number of turns per lap (the
// commutator switches every half-turn, so an even turn count lands the
// commutation pattern identically); flow/vortex advance whole cycles.

const TAU = Math.PI * 2;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smooth = (t) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

// --- one-scale layout -------------------------------------------------------
const BODY_R0 = 0.64; // base radius at the foot (widest)
const BODY_R1 = 0.5; // radius just under the collar
const BODY_Y0 = 0.05;
const BODY_Y1 = 1.16; // top of the tapered body
const COLLAR_R = 0.6;
const COLLAR_Y = 1.32; // top of the flared collar
const SEAT_Y = 1.22; // recessed jar-seat plane
const COUP_Y = 1.34; // drive-coupler top

const JAR_Y0 = 1.22; // jar base plane (on the seat)
const JAR_H = 1.5;
const JAR_R_TOP = 0.44;
const JAR_R_BOT = 0.3;
const BLADE_Y = 1.36;
const LID_Y = JAR_Y0 + JAR_H; // 2.72

// motor internals (vertical shaft, spins about +Y)
const SHAFT_BOT = 0.2;
const ARM_Y0 = 0.54;
const ARM_Y1 = 0.98;
const ARM_R = 0.22;
const COMM_Y0 = 0.34;
const COMM_Y1 = 0.5;
const COMM_R = 0.11;
const COMM_SEG = 16; // copper commutator segments
const STATOR_R = 0.36;
const POLE_GAP = 0.245; // pole-shoe inner radius (just clears the armature)
const FAN_Y = 0.2;
const BRUSH_R = COMM_R + 0.008; // brush contact radius
const JAR_LIFT = 1.05; // how far the jar rises when removed

export function buildMixer({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // --- materials ------------------------------------------------------------
  const bodyWhite = materials.paintedMetal(0xf2f0ec);
  bodyWhite.metalness = 0.0;
  bodyWhite.roughness = 0.5;
  bodyWhite.clearcoat = 0.6;
  bodyWhite.clearcoatRoughness = 0.35;
  bodyWhite.clearcoatRoughnessMap = smudgeMap();
  const bodyDark = materials.paintedMetal(0x1d1f24);
  bodyDark.clearcoatRoughness = 0.3;
  const chromeBand = materials.chrome(0xd7dce2);
  chromeBand.roughness = 0.14;
  const accentRing = new THREE.MeshPhysicalMaterial({
    color: 0xff6b35,
    metalness: 0.1,
    roughness: 0.35,
    clearcoat: 0.8,
  });
  const knobMat = materials.rubber(0x161719);
  const footMat = materials.rubber(0x121316);

  const steelLam = new THREE.MeshPhysicalMaterial({
    color: 0x9198a3,
    metalness: 0.8,
    roughness: 0.55,
  }); // laminated iron (stator/armature core) — kept light so it reads through
  //     the ghosted body
  const copper = new THREE.MeshPhysicalMaterial({
    color: 0xc06a33,
    metalness: 1,
    roughness: 0.45,
    emissive: 0xff6b35,
    emissiveIntensity: 0,
  });
  const copperComm = new THREE.MeshPhysicalMaterial({
    color: 0xc8863f,
    metalness: 1,
    roughness: 0.32,
    emissive: 0xff7a3d,
    emissiveIntensity: 0,
  });
  const micaDark = new THREE.MeshStandardMaterial({ color: 0x161414, roughness: 0.9 });
  const graphite = new THREE.MeshPhysicalMaterial({
    color: 0x201f22,
    metalness: 0.2,
    roughness: 0.85,
  });
  const shaftSteel = new THREE.MeshPhysicalMaterial({
    color: 0xb2b7bf,
    metalness: 0.95,
    roughness: 0.32,
    anisotropy: 0.7,
    anisotropyRotation: 0,
  });
  const bladeSteel = materials.chrome(0xe6eaf0);
  bladeSteel.roughness = 0.18;
  bladeSteel.anisotropy = 0.6;
  bladeSteel.anisotropyRotation = Math.PI / 2;
  const couplerWhite = new THREE.MeshPhysicalMaterial({
    color: 0xeceae4,
    metalness: 0,
    roughness: 0.55,
  });
  const couplerRubber = materials.rubber(0x2a2c30);
  const fanMat = new THREE.MeshPhysicalMaterial({
    color: 0x2b2e33,
    metalness: 0.1,
    roughness: 0.7,
  });
  const sealRubber = materials.rubber(0x3a2018);
  // Standard transparent glass, NOT MeshPhysical transmission: the transmission
  // pass only samples OPAQUE geometry, so transparent contents (the food-vortex
  // dots) would vanish behind a transmissive wall. depthWrite:false so it never
  // punches holes over the blade/food inside.
  const glassJar = new THREE.MeshPhysicalMaterial({
    color: 0xcfe0ee,
    metalness: 0,
    roughness: 0.08,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const plinthMat = materials.paintedMetal(0x1b1d21);
  plinthMat.clearcoat = 0.4;
  plinthMat.clearcoatRoughness = 0.34;
  plinthMat.clearcoatRoughnessMap = smudgeMap();
  plinthMat.roughness = 0.55;

  // --- plinth ---------------------------------------------------------------
  const plinth = beveledBox(3.0, 0.24, 3.0, plinthMat, 0.06);
  plinth.position.set(0, 0.12, 0);
  plinth.receiveShadow = true;
  group.add(plinth);

  // reveal groups
  const shellPlastic = []; // ghost to faint body on reveal
  const shellMetal = []; // hidden outright on reveal (chrome can't ghost)
  const internals = []; // motor parts — shown only when revealed

  // ======================================================================
  //  BODY (base / motor housing)
  // ======================================================================
  // squat tapered body via lathe profile (bottom → top), rounded shoulders
  const body = lathe(
    [
      [BODY_R0 - 0.02, BODY_Y0],
      [BODY_R0, BODY_Y0 + 0.04],
      [BODY_R0, BODY_Y0 + 0.06],
      [(BODY_R0 + BODY_R1) / 2 + 0.02, (BODY_Y0 + BODY_Y1) / 2],
      [BODY_R1, BODY_Y1 - 0.04],
      [BODY_R1 - 0.05, BODY_Y1],
    ],
    bodyWhite,
    64,
  );
  shellPlastic.push(body);

  // flared collar cap that seats the jar (dark plastic, like the reference)
  const collar = lathe(
    [
      [BODY_R1 - 0.05, BODY_Y1 - 0.005],
      [BODY_R1 + 0.02, BODY_Y1 + 0.02],
      [COLLAR_R, BODY_Y1 + 0.09],
      [COLLAR_R, COLLAR_Y - 0.03],
      [COLLAR_R - 0.05, COLLAR_Y],
      [0.36, COLLAR_Y], // inner lip of the seat well
      [0.34, SEAT_Y], // drop into the recessed seat
    ],
    bodyDark,
    64,
  );
  shellPlastic.push(collar);
  // seat floor (dark disc the jar sits on)
  const seatFloor = disc(0.36, 0.02, bodyDark, 48);
  seatFloor.position.y = SEAT_Y;
  shellPlastic.push(seatFloor);

  // chrome wraparound band on the lower front (reference), carrying the knob
  const bandGeo = new THREE.CylinderGeometry(BODY_R0 + 0.012, BODY_R0 + 0.03, 0.5, 64, 1, true, -0.7, 1.4);
  const band = new THREE.Mesh(bandGeo, chromeBand);
  band.position.y = 0.42;
  band.castShadow = true;
  shellMetal.push(band);
  // thin accent trim rings top & bottom of the band
  for (const ty of [0.17, 0.67]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(BODY_R0 + 0.02, 0.012, 8, 48), accentRing);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = ty;
    shellMetal.push(ring);
  }

  // seam groove at the chrome band / body-plastic join — a thin dark inset
  // torus that reads as a real part-meet edge under raking light
  const seamGroove = new THREE.Mesh(
    new THREE.TorusGeometry(BODY_R0 + 0.015, 0.007, 6, 64),
    new THREE.MeshPhysicalMaterial({ color: 0x0e0f11, metalness: 0.1, roughness: 0.9 }),
  );
  seamGroove.rotation.x = Math.PI / 2;
  seamGroove.position.y = 0.17;
  group.add(seamGroove);
  const seamGrooveTop = seamGroove.clone();
  seamGrooveTop.position.y = 0.67;
  group.add(seamGrooveTop);

  // feet
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.06, 20), footMat);
    foot.position.set(Math.cos(a) * (BODY_R0 - 0.12), BODY_Y0 - 0.02, Math.sin(a) * (BODY_R0 - 0.12));
    foot.castShadow = true;
    shellMetal.push(foot);
  }

  // air-intake louvres near the base (fan draws through these)
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    const sl = beveledBox(0.03, 0.12, 0.02, micaDark, 0.005);
    sl.position.set(Math.cos(a) * (BODY_R0 + 0.005), 0.3, Math.sin(a) * (BODY_R0 + 0.005));
    sl.lookAt(0, 0.3, 0);
    shellPlastic.push(sl);
  }

  // --- speed selector knob (front, on the band) — stays visible on reveal ---
  const knobGroup = new THREE.Group();
  // knob sits proud of the chrome band on the -Z... place it on +Z front? The
  // reference shows it front-centre; use +Z as the "front" the hero shot sees.
  const KNOB_DIR = new THREE.Vector3(0, 0, 1);
  const knobBase = new THREE.Vector3(0, 0.42, BODY_R0 + 0.02);
  // black dial dish
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.03, 40), bodyDark);
  dial.rotation.x = Math.PI / 2;
  dial.position.copy(knobBase);
  knobGroup.add(dial);
  // rotating knob
  const knobPivot = new THREE.Group();
  knobPivot.position.copy(knobBase).add(KNOB_DIR.clone().multiplyScalar(0.02));
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.07, 32), knobMat);
  knob.rotation.x = Math.PI / 2;
  knob.castShadow = true;
  knobPivot.add(knob);
  const pointer = beveledBox(0.02, 0.06, 0.04, accentRing, 0.006);
  pointer.position.set(0, 0.08, 0.03);
  knobPivot.add(pointer);
  knobGroup.add(knobPivot);
  group.add(knobGroup);

  // bolt-circle screws around the collar flange where the jar seats —
  // seen clearly in the coupler-reveal step, adds mechanical authenticity
  const collarScrews = boltCircle(6, 0.52, 0.022, shaftSteel, 0.014);
  collarScrews.rotation.x = -Math.PI / 2;
  collarScrews.position.y = SEAT_Y + 0.01;
  shellMetal.push(collarScrews);

  // add the body shell to the scene (arrays above are for the reveal toggle)
  for (const m of shellPlastic) group.add(m);
  for (const m of shellMetal) group.add(m);

  // ======================================================================
  //  UNIVERSAL MOTOR (internals)
  // ======================================================================
  const motor = new THREE.Group();
  group.add(motor);

  // shaft (vertical) + top/bottom bearings
  const shaft = rod(0.035, COUP_Y - SHAFT_BOT, shaftSteel, 20);
  shaft.position.y = SHAFT_BOT;
  internals.push(shaft);
  motor.add(shaft);
  for (const by of [COMM_Y0 - 0.05, ARM_Y1 + 0.06]) {
    const brg = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.022, 10, 24), shaftSteel);
    brg.rotation.x = Math.PI / 2;
    brg.position.y = by;
    internals.push(brg);
    motor.add(brg);
  }

  // rotor group (armature + commutator + fan + coupler) — spins about +Y
  const rotor = new THREE.Group();
  motor.add(rotor);

  // armature laminated core (slotted cylinder)
  const armCore = new THREE.Mesh(
    new THREE.CylinderGeometry(ARM_R, ARM_R, ARM_Y1 - ARM_Y0, 48, 1),
    steelLam,
  );
  armCore.position.y = (ARM_Y0 + ARM_Y1) / 2;
  armCore.castShadow = true;
  rotor.add(armCore);
  internals.push(armCore);
  // armature slots (dark grooves) + copper end-windings top & bottom
  const nSlots = 12;
  for (let i = 0; i < nSlots; i++) {
    const a = (i / nSlots) * TAU;
    const slot = beveledBox(0.03, ARM_Y1 - ARM_Y0 + 0.005, 0.05, micaDark, 0.004);
    slot.position.set(Math.cos(a) * ARM_R, (ARM_Y0 + ARM_Y1) / 2, Math.sin(a) * ARM_R);
    slot.lookAt(0, (ARM_Y0 + ARM_Y1) / 2, 0);
    rotor.add(slot);
    internals.push(slot);
  }
  // copper end-turn bundles (torus caps) — these carry the current colour
  const armWindings = [];
  for (const ey of [ARM_Y0 + 0.02, ARM_Y1 - 0.02]) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(ARM_R - 0.02, 0.05, 12, 40), copper);
    w.rotation.x = Math.PI / 2;
    w.position.y = ey;
    w.castShadow = true;
    rotor.add(w);
    internals.push(w);
    armWindings.push(w);
  }

  // commutator: ring of copper segments split by mica, on the shaft below core
  const commSegs = [];
  const commGroup = new THREE.Group();
  commGroup.position.y = (COMM_Y0 + COMM_Y1) / 2;
  for (let i = 0; i < COMM_SEG; i++) {
    const a = (i / COMM_SEG) * TAU;
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(COMM_R, COMM_R, COMM_Y1 - COMM_Y0, 4, 1, false, a + 0.02, TAU / COMM_SEG - 0.04),
      copperComm.clone(),
    );
    seg.castShadow = true;
    commGroup.add(seg);
    commSegs.push({ mesh: seg, a });
  }
  const commCore = new THREE.Mesh(
    new THREE.CylinderGeometry(COMM_R - 0.015, COMM_R - 0.015, COMM_Y1 - COMM_Y0 + 0.005, 24),
    micaDark,
  );
  commGroup.add(commCore);
  rotor.add(commGroup);
  internals.push(commGroup);

  // cooling fan at the bottom of the rotor
  const fanHub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 20), fanMat);
  fanHub.position.y = FAN_Y;
  rotor.add(fanHub);
  internals.push(fanHub);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    const bl = beveledBox(0.16, 0.1, 0.02, fanMat, 0.004);
    bl.position.set(Math.cos(a) * 0.14, FAN_Y, Math.sin(a) * 0.14);
    bl.lookAt(Math.cos(a) * 0.6, FAN_Y + 0.25, Math.sin(a) * 0.6); // pitched blades
    rotor.add(bl);
    internals.push(bl);
  }

  // drive coupler on top of the shaft (cross dog, engages the jar coupler)
  const bodyCoupler = new THREE.Group();
  bodyCoupler.position.y = COUP_Y;
  const coupHub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.06, 24), couplerWhite);
  bodyCoupler.add(coupHub);
  for (let i = 0; i < 2; i++) {
    const bar = beveledBox(i === 0 ? 0.22 : 0.05, 0.05, i === 0 ? 0.05 : 0.22, couplerRubber, 0.01);
    bar.position.y = 0.05;
    bodyCoupler.add(bar);
  }
  rotor.add(bodyCoupler);

  // --- stator: 2-pole laminated frame + field coils (SERIES windings) -------
  // C-shaped frame: outer ring with two inward pole shoes at ±X
  const statorFrame = new THREE.Group();
  statorFrame.position.y = (ARM_Y0 + ARM_Y1) / 2;
  const ringOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(STATOR_R + 0.05, STATOR_R + 0.05, ARM_Y1 - ARM_Y0 + 0.06, 6, 1, true),
    steelLam,
  );
  statorFrame.add(ringOuter);
  const fieldCoils = [];
  for (const sx of [-1, 1]) {
    // pole shoe reaching in toward the armature
    const shoe = beveledBox(STATOR_R - POLE_GAP + 0.05, ARM_Y1 - ARM_Y0 - 0.02, 0.34, steelLam, 0.01);
    shoe.position.set(sx * (POLE_GAP + (STATOR_R - POLE_GAP) / 2 - 0.02), 0, 0);
    statorFrame.add(shoe);
    // field coil wound around the pole (copper block bundles front & back)
    for (const sz of [-1, 1]) {
      const coil = new THREE.Mesh(
        new THREE.BoxGeometry(STATOR_R - POLE_GAP + 0.02, ARM_Y1 - ARM_Y0 - 0.04, 0.09),
        copper.clone(),
      );
      coil.position.set(sx * (POLE_GAP + (STATOR_R - POLE_GAP) / 2 - 0.02), 0, sz * 0.2);
      coil.castShadow = true;
      statorFrame.add(coil);
      fieldCoils.push(coil);
    }
  }
  motor.add(statorFrame);
  internals.push(ringOuter, ...statorFrame.children.filter((c) => c !== ringOuter));

  // --- carbon brushes: two, riding the commutator 180° apart (along Z) ------
  const brushes = [];
  const brushGlow = [];
  for (const sz of [-1, 1]) {
    const holder = new THREE.Group();
    holder.position.set(0, (COMM_Y0 + COMM_Y1) / 2, 0);
    // brush block pressing inward toward the commutator
    const block = beveledBox(0.05, 0.09, 0.08, graphite, 0.008);
    block.position.set(0, 0, sz * (BRUSH_R + 0.045));
    holder.add(block);
    // spring cap behind it
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 12), shaftSteel);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(0, 0, sz * (BRUSH_R + 0.11));
    holder.add(cap);
    // pigtail lead (colour carries current) toward the field coil
    const lead = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), copper.clone());
    lead.position.set(0, 0.05, sz * (BRUSH_R + 0.08));
    holder.add(lead);
    motor.add(holder);
    internals.push(block, cap, lead);
    brushes.push({ holder, z: sz, block });
    brushGlow.push(lead);
  }

  // ======================================================================
  //  JAR (glass) + BLADE ASSEMBLY  — lifts as one group
  // ======================================================================
  const jarGroup = new THREE.Group();
  group.add(jarGroup);

  // jar wall (tapered glass, open top)
  const jarWall = new THREE.Mesh(
    new THREE.CylinderGeometry(JAR_R_TOP, JAR_R_BOT, JAR_H, 64, 1, true),
    glassJar,
  );
  jarWall.position.y = JAR_Y0 + JAR_H / 2;
  jarGroup.add(jarWall);
  // jar base (opaque plastic collar housing the blade assembly)
  const jarBase = lathe(
    [
      [JAR_R_BOT + 0.02, JAR_Y0 - 0.14],
      [JAR_R_BOT + 0.06, JAR_Y0 - 0.13],
      [JAR_R_BOT + 0.06, JAR_Y0 + 0.02],
      [JAR_R_BOT, JAR_Y0 + 0.04],
    ],
    bodyDark,
    48,
  );
  jarGroup.add(jarBase);
  // rim + pour lip at the top of the glass
  const jarRim = new THREE.Mesh(new THREE.TorusGeometry(JAR_R_TOP, 0.02, 10, 64), bodyDark);
  jarRim.rotation.x = Math.PI / 2;
  jarRim.position.y = JAR_Y0 + JAR_H;
  jarGroup.add(jarRim);

  // C-handle on the side (+X)
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.26, 0.035, 12, 32, Math.PI * 1.1),
    bodyDark,
  );
  handle.position.set(JAR_R_TOP + 0.02, JAR_Y0 + JAR_H * 0.55, 0);
  handle.rotation.z = -Math.PI / 2 - 0.55;
  handle.castShadow = true;
  jarGroup.add(handle);

  // domed lid
  const lid = lathe(
    [
      [JAR_R_TOP + 0.02, LID_Y],
      [JAR_R_TOP + 0.02, LID_Y + 0.03],
      [JAR_R_TOP - 0.06, LID_Y + 0.07],
      [0.18, LID_Y + 0.12],
      [0.12, LID_Y + 0.16],
      [0.001, LID_Y + 0.17],
    ],
    bodyDark,
    48,
  );
  lid.castShadow = true;
  jarGroup.add(lid);

  // blade assembly at the bottom of the jar
  const bladeAsm = new THREE.Group();
  bladeAsm.position.y = BLADE_Y;
  // rubber seal ring under the blade
  const seal = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 10, 24), sealRubber);
  seal.rotation.x = Math.PI / 2;
  seal.position.y = -0.05;
  bladeAsm.add(seal);
  // 4-point steel star blade (two arms swept up, two down — real blade)
  const blade = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const arm = beveledBox(0.34, 0.016, 0.05, bladeSteel, 0.006);
    arm.position.set(0, 0, 0);
    arm.rotation.y = a;
    arm.rotation.x = i % 2 === 0 ? 0.28 : -0.28; // alternate up/down pitch
    arm.castShadow = true;
    blade.add(arm);
  }
  const bladeHub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.06, 20), bladeSteel);
  blade.add(bladeHub);
  const bladeNut = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 6), shaftSteel);
  bladeNut.position.y = 0.05;
  blade.add(bladeNut);
  bladeAsm.add(blade);
  jarGroup.add(bladeAsm);

  // jar drive coupler UNDER the base (mates with the body coupler)
  const jarCoupler = new THREE.Group();
  jarCoupler.position.y = JAR_Y0 - 0.13;
  const jcHub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.06, 24), couplerWhite);
  jarCoupler.add(jcHub);
  // slotted socket that receives the cross dog
  for (let i = 0; i < 2; i++) {
    const slot = beveledBox(i === 0 ? 0.24 : 0.06, 0.055, i === 0 ? 0.06 : 0.24, micaDark, 0.008);
    slot.position.y = -0.02;
    jarCoupler.add(slot);
  }
  jarGroup.add(jarCoupler);
  const bladeSpinGroup = blade; // blade + coupler spin together
  jarCoupler.add(new THREE.Object3D()); // (coupler spins via jarCoupler in pose)

  // --- food vortex (step 5): dots spiralling down into the blade ------------
  const vortex = new THREE.Group();
  jarGroup.add(vortex);
  const foodDots = [];
  const foodColors = [0xdca24a, 0xc27a3a, 0xe0c060, 0x9c6b2e];
  for (let i = 0; i < 26; i++) {
    const m = new THREE.MeshStandardMaterial({
      color: foodColors[i % foodColors.length],
      roughness: 0.85,
      transparent: true,
      opacity: 0,
    });
    m.depthWrite = false;
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.028 + (i % 3) * 0.008, 10, 8), m);
    vortex.add(d);
    foodDots.push({ mesh: d, seed: i / 26 });
  }

  // --- current-flow dots along the field→brush leads (steps 3,6) -----------
  // a short glowing queue riding each pigtail toward the commutator
  const flowCurves = brushes.map((b) => {
    const zc = b.z * (BRUSH_R + 0.08);
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(b.z * 0.28, (ARM_Y0 + ARM_Y1) / 2, b.z * 0.22),
      new THREE.Vector3(0, (COMM_Y0 + COMM_Y1) / 2 + 0.12, zc),
      new THREE.Vector3(0, (COMM_Y0 + COMM_Y1) / 2, zc * 0.75),
    ]);
  });
  const flowQueues = flowCurves.map((c) => chargeQueue(c, 4, 0xffb066, { size: 0.02, spacing: 0.22 }));
  flowQueues.forEach((q) => {
    motor.add(q.group);
    internals.push(q.group);
  });

  // ======================================================================
  //  CALLOUTS
  // ======================================================================
  const setsOf = { exterior: [], couple: [], motor: [], comm: [], vortex: [], speed: [] };
  function addCallout(set, parent, text, offset, dir, len) {
    const c = callout(text, { dir, len });
    c.position.set(...offset);
    parent.add(c);
    c.visible = false;
    setsOf[set].push(c);
  }
  addCallout('exterior', group, 'Jar — 1.5 L blending', [JAR_R_TOP, 2.2, 0.2], 25, 60);
  addCallout('exterior', group, 'Motor body', [BODY_R0, 0.7, 0.3], -30, 58);
  addCallout('exterior', group, 'Speed selector', [0.0, 0.42, BODY_R0 + 0.18], -80, 60);

  addCallout('couple', group, 'Drive coupler', [0.0, COUP_Y + 0.28, 0.05], 90, 56);
  addCallout('couple', group, 'Blade coupler', [0.0, JAR_Y0 - 0.13, 0.34], 10, 58);
  addCallout('couple', group, '4-point blade', [0.0, BLADE_Y + 0.3, 0.36], 60, 54);

  addCallout('motor', group, 'Universal motor', [STATOR_R + 0.1, (ARM_Y0 + ARM_Y1) / 2 + 0.2, 0.1], 40, 60);
  addCallout('motor', group, 'Armature', [ARM_R, (ARM_Y0 + ARM_Y1) / 2, 0.2], 50, 50);
  addCallout('motor', group, 'Field coil (series)', [-STATOR_R, (ARM_Y0 + ARM_Y1) / 2, 0.1], -140, 66);
  addCallout('motor', group, 'Cooling fan', [0.16, FAN_Y - 0.02, 0.16], -50, 56);

  addCallout('comm', group, 'Commutator', [COMM_R + 0.05, (COMM_Y0 + COMM_Y1) / 2 + 0.1, 0.1], 45, 56);
  addCallout('comm', group, 'Carbon brush', [0.0, (COMM_Y0 + COMM_Y1) / 2, BRUSH_R + 0.16], -70, 58);

  addCallout('vortex', group, '4-point blade', [0.0, BLADE_Y + 0.06, 0.2], 30, 52);
  addCallout('vortex', group, 'Vortex pulls food down', [0.2, JAR_Y0 + JAR_H * 0.5, 0.2], 40, 66);

  addCallout('speed', group, 'Speed selector', [0.0, 0.42, BODY_R0 + 0.2], -80, 60);
  addCallout('speed', group, 'Field taps', [-STATOR_R, (ARM_Y0 + ARM_Y1) / 2, 0.1], -140, 56);

  // ======================================================================
  //  POSE
  // ======================================================================
  const brushAngles = [0, Math.PI]; // fixed brush azimuths (along ±Z)
  let revealed = false;

  function applySpin(spin, jarSeated) {
    rotor.rotation.y = spin;
    // blade + jar coupler are DIRECT drive off the shaft when seated
    const bladeSpin = jarSeated ? spin : 0;
    bladeSpinGroup.rotation.y = bladeSpin;
    jarCoupler.rotation.y = bladeSpin;
  }

  function applyFlow(flow, on) {
    // commutation: each brush lights the segment currently under it; the
    // polarity (warm vs cool) flips every half armature turn.
    const spin = rotor.rotation.y;
    const half = Math.floor((spin / Math.PI) % 2 + 2) % 2; // 0/1 flips each half-turn
    commSegs.forEach(({ mesh, a }) => {
      const wa = a + spin;
      let lit = 0;
      let pol = 0;
      brushAngles.forEach((ba, bi) => {
        let d = Math.abs(((wa - ba + Math.PI) % TAU) - Math.PI);
        if (d < 0.32) {
          lit = Math.max(lit, 1 - d / 0.32);
          pol = bi;
        }
      });
      const active = on ? lit : 0;
      const flip = (pol + half) % 2;
      mesh.material.emissive.setHex(flip === 0 ? 0xff7a3d : 0x3d7bff);
      mesh.material.emissiveIntensity = active * 1.6;
    });
    // field coils + armature windings pulse to show series current
    const pulse = on ? 0.6 + 0.4 * Math.sin(flow * TAU) : 0;
    for (const c of fieldCoils) c.material.emissiveIntensity = pulse * 0.9;
    for (const w of armWindings) w.material.emissiveIntensity = pulse * 0.7;
    for (const l of brushGlow) l.material.emissiveIntensity = pulse * 1.2;
    // flow queues ride the leads inward
    flowQueues.forEach((q) => q.setFront(on ? (flow % 1) : 0, on));
  }

  function applyVortex(ph, on) {
    foodDots.forEach(({ mesh, seed }, i) => {
      if (!on) {
        mesh.material.opacity = 0;
        return;
      }
      // helix descending from the top of the jar to the blade, radius
      // shrinking as it falls; recirculates (seamless in ph)
      const t = (ph + seed) % 1;
      const yTop = JAR_Y0 + JAR_H * 0.9;
      const yBot = BLADE_Y + 0.03;
      const y = yTop + (yBot - yTop) * t;
      const rad = (JAR_R_BOT + (JAR_R_TOP - JAR_R_BOT) * (0.2 + 0.8 * (1 - t))) * (0.55 + 0.35 * (1 - t));
      const ang = seed * TAU + t * TAU * 3; // 3 whole turns down → seamless
      mesh.position.set(Math.cos(ang) * rad, y, Math.sin(ang) * rad);
      mesh.material.opacity = Math.min(1, t * 6) * (1 - smooth((t - 0.9) / 0.1)) * 0.95;
    });
  }

  const SPEED_ANGLES = [-1.05, -0.5, 0.1, 0.7, 1.25]; // P,0,1,2,3 knob rotation
  function applySpeed(idx) {
    const a = SPEED_ANGLES[Math.max(0, Math.min(4, Math.round(idx)))];
    knobPivot.rotation.z = -a;
    // highlight the field tap for this speed (higher speed → fewer turns lit)
    const frac = Math.max(0, Math.min(4, idx)) / 4;
    fieldCoils.forEach((c, i) => {
      c.material.emissive.setHex(0xff6b35);
    });
  }

  function setJar(t) {
    jarGroup.position.y = clamp01(t) * JAR_LIFT;
  }
  // slow turntable of the lifted jar (step 2) — whole turns per lap keep it
  // seamless and stop the a/b frozen-loop check from tripping on a static step
  function setJarSpin(a) {
    jarGroup.rotation.y = a;
  }
  function setLid(on) {
    lid.visible = on;
  }

  function setReveal(t) {
    const r = clamp01(t);
    revealed = r > 0.5;
    // plastic shell ghosts to a very faint body; chrome/metal skin lifts off.
    // A WHITE body needs to go much fainter than a dark one — high albedo veils
    // the dark motor even at low opacity — so fade almost to clear. CRUCIALLY,
    // kill the CLEARCOAT while revealed: a clearcoat's specular layer renders at
    // full strength regardless of opacity and would keep the body looking solid.
    const op = 1 - r * 0.9; // 1 → 0.1
    bodyWhite.clearcoat = r > 0.5 ? 0 : 0.6;
    bodyDark.clearcoat = r > 0.5 ? 0 : 0.3;
    for (const m of shellPlastic) {
      const mat = m.material;
      mat.transparent = r > 0.02;
      mat.opacity = op;
      mat.depthWrite = r < 0.4;
    }
    for (const m of shellMetal) m.visible = r < 0.5;
    for (const o of internals) o.visible = r > 0.5;
  }

  function setLabels(mode) {
    for (const [k, arr] of Object.entries(setsOf)) {
      for (const c of arr) c.visible = k === mode;
    }
  }

  // initial: complete, sealed, solid
  setReveal(0);
  setJar(0);
  applySpin(0, true);
  applyFlow(0, false);
  applyVortex(0, false);
  applySpeed(1);
  setLabels(false);

  return {
    group,
    setSpin: (spin, jarSeated = true) => applySpin(spin, jarSeated),
    setJar,
    setJarSpin,
    setLid,
    setReveal,
    setFlow: applyFlow,
    setVortex: applyVortex,
    setSpeed: applySpeed,
    setLabels,
    parts: { rotor, jarGroup, knobPivot, blade, motor },
  };
}
