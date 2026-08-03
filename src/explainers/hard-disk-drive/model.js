import * as THREE from 'three';
import { materials, rod, box, disc, studioPlinth, chargeQueue } from '../../framework/parts.js';
import { beveledBox, lathe } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, smooth, win, TAU } from '../../framework/motion.js';

// A 3.5" desktop hard disk drive, presented as a sealed product shot that
// opens up to its mechanism, then a hugely exaggerated macro cutaway of the
// head/platter air gap (the whole point of the video), then a head-crash beat.
//
// MECHANISM (researched):
//  - Spindle motor spins a stack of aluminum/glass platters (7200 RPM class
//    desktop drives) with a hard magnetic thin-film coating.
//  - A voice-coil actuator (E-block) pivots an arm; at its tip a suspension
//    (flexure) carries the SLIDER — a small ceramic (AlTiC) block whose
//    underside (the Air Bearing Surface, ABS) is etched with rails/channels.
//    The spinning platter drags a boundary layer of air under those rails,
//    which self-generates enough aerodynamic lift to fly the slider a few
//    NANOMETRES above the surface — it never touches in normal operation.
//  - The read element (GMR/TMR magnetoresistive sensor) and write element
//    (thin-film inductive coil) sit at the trailing edge of the slider, the
//    closest point to the disk.
//  - Concentric tracks are subdivided into sectors; thin embedded SERVO
//    wedges (radial spokes) written at the factory tell the actuator exactly
//    which track/sector the head is over, closing a feedback loop that keeps
//    the head centred on a track a few hundred nanometres wide.
//  - At rest, the head is NOT resting on the platter (older drives used
//    contact-start-stop landing zones; modern drives use a RAMP just beyond
//    the outer edge) — the arm swings the head off the platter entirely and
//    parks it on a plastic ramp before spin-down.
//  - Fly height is a real physical parameter now down near 1-3 nm active
//    magnetic spacing in modern drives — roughly 1/25,000th the width of a
//    human hair. A single smoke or dust particle (several MICRONS across) is
//    a boulder at that scale: if one gets between slider and platter, or a
//    shock momentarily collapses the air film, the head strikes the spinning
//    surface — a HEAD CRASH — gouging the magnetic coating and scattering
//    debris that wrecks neighbouring tracks. This is why drives are
//    hermetically sealed (or, in air drives, filtered-breather sealed) and
//    why a drop while spinning is often fatal, while a drop while powered
//    off (heads parked on the ramp) usually is not.
//
// PROPORTIONS: real 3.5" drive casing is 101.6 x 146.99 x 26.1 mm
// (W x D x H) -> W:D:H = 1 : 1.447 : 0.257. Every case dimension below is
// derived from CASE_W so that ratio holds by construction.
//
// SCALE TRICK (like fiber-optics): the 3nm air gap is unrenderable at case
// scale (a 1:1 model would need sub-atomic precision), so a second, hugely
// exaggerated MACRO group floats beside the drive showing the slider/platter
// interface at "cutaway" scale, used only by the macro/danger steps.
//
// STATE the pose is built from (one scalar object, one pose function):
//   turntable — slow whole-turn presentation spin of the whole product
//   reveal    — 0 sealed shell / 1 cover lifted clear
//   spin      — platter/spindle rotation angle (rad), whole turns per lap
//   spunUp    — 0 platters at rest / 1 platters up to speed (drives spin bob)
//   seek      — 0..1 actuator arm sweep from parked-on-ramp to innermost track
//   fly       — 0 head resting lifted on the ramp / 1 head flying low over
//               the platter (drives both the real arm AND the macro slider)
//   macro     — shows the exaggerated air-gap cutaway group
//   crash     — 0..1 phase: a dust mote drifts in, contacts, sparks, clears

const clamp = clamp01;

// --- real-drive proportions -------------------------------------------------
const CASE_W = 1.62; // X
const CASE_D = CASE_W * 1.447; // Z
const CASE_H = CASE_W * 0.257; // Y
const WALL = 0.045;
const PLINTH_TOP = 0.26;

// A real 3.5" drive's platter is 95mm across in a 101.6mm-wide case — it very
// nearly fills the chassis. Undersizing it makes the drive read as a tray with
// a coaster in it.
const PLATTER_R = CASE_W * 0.465;
const PLATTER_T = 0.018;
const PLATTER_GAP = 0.05;
const PLATTER_COUNT = 3;
const HUB_R = PLATTER_R * 0.22;
const SPINDLE_CY = PLINTH_TOP + CASE_H * 0.5; // spindle centre height inside case
const STACK_H = (PLATTER_COUNT - 1) * PLATTER_GAP;

// ACTUATOR GEOMETRY — solved, not eyeballed. The arm is a rigid link of length
// REACH pivoting at PIVOT; the head's distance from the spindle axis is
//   r(t) = |PIVOT + REACH * (sin t, cos t)|
// so the two angles below are derived from the two radii we actually want:
//   - parked: r = PARK_R, just OUTSIDE the platter OD (head sits on the ramp)
//   - inner:  r = |PIVOT| - REACH, the innermost track (arm aimed at the hub)
// Getting this wrong is what threw the head outside the case: an arm built
// pointing away from the spindle can only ever swing further out.
const PIVOT = new THREE.Vector3(0.64, 0, -0.88); // E-block pivot, rear-right corner
const REACH = 0.82; // pivot -> read/write element, INCLUDING the suspension
const SUSPENSION_REACH = 0.22; // of that, the flexure + slider overhang
const ARM_LEN = REACH - SUSPENSION_REACH; // the aluminium arm body itself
const PARK_R = PLATTER_R + 0.067; // ramp sits this far past the platter edge

const PIVOT_D = Math.hypot(PIVOT.x, PIVOT.z);
// angle at which the arm points straight at the spindle axis -> innermost track
const ARM_INNER_ANGLE = Math.atan2(-PIVOT.x, -PIVOT.z);
// law of cosines: how far off that aim the arm must swing to reach PARK_R
const PARK_SWING = Math.acos(
  Math.min(1, (PIVOT_D * PIVOT_D + REACH * REACH - PARK_R * PARK_R) / (2 * PIVOT_D * REACH)),
);
const ARM_PARK_ANGLE = ARM_INNER_ANGLE - PARK_SWING; // swung out over the ramp
const RAMP_LIFT = 0.085; // head sits this much above platter-top plane when parked

// world (x,z) of the head at a given arm angle — used to plant the ramp
function headXZ(angle) {
  return [PIVOT.x + REACH * Math.sin(angle), PIVOT.z + REACH * Math.cos(angle)];
}

// --- macro cutaway constants (world-fixed, NOT parented to the drive) -----
// Sits well clear of the drive below — at macro framing the camera is nearly
// level, so anything only slightly above the chassis creeps into frame.
const MACRO_POS = new THREE.Vector3(1.95, 3.0, 0.05);
const MACRO_SLAB = { w: 1.5, d: 1.0, h: 0.26 };
const COATING_H = 0.022; // the magnetic thin film, drawn as its own layer
const SLIDER = { w: 0.46, d: 0.66, h: 0.19 };
const RAIL_H = 0.045; // ABS rails standing proud of the slider body
// The "3 nm" gap, exaggerated to a legible sliver. This must stay clearly
// larger than RAIL_H is tall or the rails read as the gap instead.
const MACRO_GAP = 0.105;
const SLIDER_PITCH = 0.055; // real sliders fly nose-up; leading edge rides higher

export function buildHardDiskDrive({ scene }) {
  const sceneGroup = new THREE.Group();
  scene.add(sceneGroup);
  const group = new THREE.Group(); // presentation turntable
  sceneGroup.add(group);

  // --- materials -------------------------------------------------------------
  const caseMetal = materials.aluminum(0x9aa4ad);
  caseMetal.roughness = 0.68;
  const coverMetal = materials.brushedSteel(0xaeb6bd);
  coverMetal.roughness = 0.55;
  const connectorPlastic = materials.polymer(0x17181b);
  const stickerMat = new THREE.MeshPhysicalMaterial({ color: 0xe9ecf1, metalness: 0, roughness: 0.7 });
  const platterMat = new THREE.MeshPhysicalMaterial({
    color: 0x2b3038,
    metalness: 0.7,
    roughness: 0.48,
  });
  const trackTex = trackTexture();
  const platterTopMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: trackTex,
    metalness: 0.6,
    roughness: 0.5,
  });
  const hubMetal = materials.aluminum(0xc6ccd2);
  const armMetal = materials.aluminum(0xc4cad0);
  const suspensionSteel = materials.brushedSteel(0xc9cfd6);
  // AlTiC (alumina/titanium-carbide) — a dark grey structural ceramic, not the
  // cream it was: at macro scale a bright slab swallows the whole frame and
  // out-competes the gap, which is the only thing the shot is about.
  const sliderCeramic = new THREE.MeshPhysicalMaterial({ color: 0x7e838c, metalness: 0.1, roughness: 0.45 });
  const gmrMat = new THREE.MeshPhysicalMaterial({
    color: 0xff5b3d,
    emissive: 0xff5b3d,
    emissiveIntensity: 0.9,
    metalness: 0,
    roughness: 0.4,
  });
  const rampMat = materials.polymer(0x2a2d33);
  const accentGlow = new THREE.MeshPhysicalMaterial({
    color: 0x7fd4ff,
    emissive: 0x7fd4ff,
    emissiveIntensity: 1.2,
    metalness: 0,
    roughness: 0.3,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const dustMat = new THREE.MeshPhysicalMaterial({ color: 0x8a7a63, metalness: 0, roughness: 0.9 });
  const sparkMat = new THREE.MeshPhysicalMaterial({
    color: 0xffb238,
    emissive: 0xffb238,
    emissiveIntensity: 1.6,
    metalness: 0,
    roughness: 0.3,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  // --- plinth ------------------------------------------------------------
  group.add(studioPlinth({ w: 3.1, h: PLINTH_TOP, d: 2.1 }));

  // --- drive group ---------------------------------------------------------
  const driveGroup = new THREE.Group();
  driveGroup.position.y = PLINTH_TOP;
  group.add(driveGroup);

  const caseBase = beveledBox(CASE_W, CASE_H * 0.62, CASE_D, caseMetal, 0.02);
  caseBase.position.set(0, CASE_H * 0.31, 0);
  driveGroup.add(caseBase);

  // rear connector block (SATA + power) — small, dark, on the -Z edge
  const connBlock = box(CASE_W * 0.42, CASE_H * 0.5, 0.1, connectorPlastic);
  connBlock.position.set(-CASE_W * 0.22, CASE_H * 0.28, -CASE_D * 0.5 - 0.05);
  driveGroup.add(connBlock);
  const pinsGeo = new THREE.BoxGeometry(CASE_W * 0.34, CASE_H * 0.02, 0.02);
  for (let i = 0; i < 2; i++) {
    const pins = new THREE.Mesh(pinsGeo, materials.chrome(0xcfd4da));
    pins.position.set(-CASE_W * 0.22, CASE_H * (0.18 + i * 0.22), -CASE_D * 0.5 - 0.1);
    driveGroup.add(pins);
  }

  // top label sticker
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(CASE_W * 0.62, CASE_D * 0.34), stickerMat);
  sticker.rotation.x = -Math.PI / 2;
  sticker.position.set(0.02, CASE_H * 0.62 + 0.001, CASE_D * 0.05);
  driveGroup.add(sticker);

  // inner mechanism group (hidden inside the case when reveal=0, exposed as
  // the cover lifts away — always built, never faded, so no ghosting traps)
  const mechGroup = new THREE.Group();
  mechGroup.position.y = CASE_H * 0.62;
  driveGroup.add(mechGroup);

  // spindle + platter stack
  const spindleGroup = new THREE.Group();
  spindleGroup.position.set(0, SPINDLE_CY - CASE_H * 0.62 - PLINTH_TOP + PLINTH_TOP, 0);
  // (kept in mechGroup local space, so offset relative to mechGroup's base)
  spindleGroup.position.y = CASE_H * 0.02;
  mechGroup.add(spindleGroup);

  const hub = rod(HUB_R, STACK_H + PLATTER_T * 2 + 0.02, hubMetal, 28);
  hub.position.y = -0.01;
  spindleGroup.add(hub);

  const platters = [];
  for (let i = 0; i < PLATTER_COUNT; i++) {
    const p = disc(PLATTER_R, PLATTER_T, platterMat, 64);
    p.position.y = i * PLATTER_GAP;
    spindleGroup.add(p);
    const topDeco = new THREE.Mesh(new THREE.CircleGeometry(PLATTER_R * 0.985, 64), platterTopMat);
    topDeco.rotation.x = -Math.PI / 2;
    topDeco.position.y = i * PLATTER_GAP + PLATTER_T / 2 + 0.0006;
    spindleGroup.add(topDeco);
    platters.push(p);
  }
  const PLATTER_TOP_Y = spindleGroup.position.y + (PLATTER_COUNT - 1) * PLATTER_GAP + PLATTER_T / 2;

  // actuator (E-block): pivot post + arm + suspension + slider
  const actuatorGroup = new THREE.Group();
  actuatorGroup.position.copy(PIVOT);
  actuatorGroup.position.y = PLATTER_TOP_Y + 0.02;
  mechGroup.add(actuatorGroup);

  const pivotPost = rod(0.06, 0.14, armMetal, 20);
  pivotPost.position.y = -0.02;
  actuatorGroup.add(pivotPost);

  const armPivotAngleGroup = new THREE.Group(); // yaw about the pivot, drives `seek`
  actuatorGroup.add(armPivotAngleGroup);

  // The arm extends along LOCAL +Z so that rotation.y = t maps its tip to
  // (sin t, cos t) — the same convention headXZ() solves the angles in.
  const armBody = beveledBox(0.09, 0.035, ARM_LEN, armMetal, 0.01);
  armBody.position.set(0, 0, ARM_LEN / 2);
  armPivotAngleGroup.add(armBody);
  // counterweight / voice-coil end, behind the pivot
  const voiceCoil = beveledBox(0.2, 0.05, 0.16, armMetal, 0.012);
  voiceCoil.position.set(0, 0, -0.11);
  armPivotAngleGroup.add(voiceCoil);

  const armLiftGroup = new THREE.Group(); // vertical lift, drives `fly`
  armLiftGroup.position.z = ARM_LEN;
  armPivotAngleGroup.add(armLiftGroup);

  const suspension = beveledBox(0.05, 0.012, SUSPENSION_REACH * 0.85, suspensionSteel, 0.004);
  suspension.position.set(0, -0.015, SUSPENSION_REACH * 0.42);
  armLiftGroup.add(suspension);

  const slider = beveledBox(0.07, 0.02, 0.1, sliderCeramic, 0.004);
  slider.position.set(0, -0.03, SUSPENSION_REACH);
  armLiftGroup.add(slider);
  const gmrDot = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), gmrMat);
  gmrDot.position.set(0, -0.04, SUSPENSION_REACH + 0.045);
  armLiftGroup.add(gmrDot);

  // ramp (fixed, just beyond the platter OD, in the arm's parked direction)
  const ramp = lathe(
    [
      [0.02, 0],
      [0.05, 0.02],
      [0.05, RAMP_LIFT + 0.01],
    ],
    rampMat,
    10,
  );
  ramp.scale.set(1, 1, 2.4);
  ramp.rotation.z = Math.PI / 2;
  const [rampX, rampZ] = headXZ(ARM_PARK_ANGLE);
  ramp.position.set(rampX, PLATTER_TOP_Y - CASE_H * 0.02 + 0.02, rampZ);
  mechGroup.add(ramp);

  // rim walls — a real chassis is a hollow TRAY, not a solid slab: without
  // these, lifting the cover leaves the mechanism looking like loose parts
  // resting on a table instead of sitting inside an open case cavity. Kept
  // LOW on purpose: the arm assembly flies well above the platter top, and a
  // wall as tall as the closed lid would occlude it from any angled camera.
  const WALL_H = CASE_H * 0.16;
  const WALL_Y = CASE_H * 0.62 + WALL_H / 2;
  const wallFB = new THREE.Mesh(new THREE.BoxGeometry(CASE_W, WALL_H, WALL), caseMetal);
  [-1, 1].forEach((s) => {
    const w = wallFB.clone();
    w.position.set(0, WALL_Y, (s * (CASE_D - WALL)) / 2);
    driveGroup.add(w);
  });
  const wallLR = new THREE.Mesh(new THREE.BoxGeometry(WALL, WALL_H, CASE_D), caseMetal);
  [-1, 1].forEach((s) => {
    const w = wallLR.clone();
    w.position.set((s * (CASE_W - WALL)) / 2, WALL_Y, 0);
    driveGroup.add(w);
  });

  // top cover — lifts straight up and back on reveal (metal can't ghost, so it
  // physically leaves frame instead)
  const COVER_H = CASE_H * 0.34;
  const COVER_CLOSED_Y = CASE_H * 0.62 + WALL_H + COVER_H / 2;
  const coverTop = beveledBox(CASE_W - WALL, COVER_H, CASE_D - WALL, coverMetal, 0.02);
  coverTop.position.set(0, COVER_CLOSED_Y, 0);
  driveGroup.add(coverTop);

  // --- macro air-gap cutaway (world-fixed, huge relative scale) -------------
  const macroGroup = new THREE.Group();
  macroGroup.position.copy(MACRO_POS);
  sceneGroup.add(macroGroup);

  // Read this group SIDE-ON: the whole point is a legible sliver of empty
  // space between two solids. Everything below is arranged so that gap is the
  // brightest, emptiest, most obvious thing in frame.
  //
  //        [====== slider ======]   <- nose-up pitch
  //          ||   ||   ||           <- ABS rails standing proud
  //        ~~~~~~~~~~~~~~~~~~~~~    <- MACRO_GAP: air, glowing
  //   =========================     <- magnetic coating
  //   #########################     <- platter substrate

  const macroPlatter = beveledBox(MACRO_SLAB.w, MACRO_SLAB.h, MACRO_SLAB.d, platterMat, 0.02);
  macroPlatter.position.y = -MACRO_SLAB.h / 2 - COATING_H;
  macroGroup.add(macroPlatter);

  // the magnetic thin film, as its own visible layer — without it the slab is
  // just "a table" and the coating the head gouges has no referent
  const coatingMat = new THREE.MeshPhysicalMaterial({
    color: 0x5c6f86,
    metalness: 0.85,
    roughness: 0.32,
  });
  const macroCoating = box(MACRO_SLAB.w, COATING_H, MACRO_SLAB.d, coatingMat);
  macroCoating.position.y = -COATING_H / 2;
  macroGroup.add(macroCoating);

  const macroTop = new THREE.Mesh(
    new THREE.PlaneGeometry(MACRO_SLAB.w * 0.995, MACRO_SLAB.d * 0.995),
    platterTopMat,
  );
  macroTop.rotation.x = -Math.PI / 2;
  macroTop.position.y = 0.0012;
  macroGroup.add(macroTop);

  // --- the slider, FLYING (its underside never reaches y=0) ----------------
  const macroSliderGroup = new THREE.Group();
  macroSliderGroup.position.y = MACRO_GAP;
  macroGroup.add(macroSliderGroup);

  // body sits above its rails; local y=0 is the rail contact plane
  const macroSlider = beveledBox(SLIDER.w, SLIDER.h, SLIDER.d, sliderCeramic, 0.012);
  macroSlider.position.y = RAIL_H + SLIDER.h / 2;
  macroSliderGroup.add(macroSlider);

  // leading-edge taper (real sliders are lapped back at the inflow edge) —
  // it is what lets air wedge in and pressurise underneath
  const taper = beveledBox(SLIDER.w, RAIL_H * 1.4, SLIDER.d * 0.16, sliderCeramic, 0.006);
  taper.position.set(0, RAIL_H * 1.1, -SLIDER.d * 0.42);
  taper.rotation.x = -0.34;
  macroSliderGroup.add(taper);

  // ABS rails — two outer rails + a centre pad, standing proud of the body so
  // they are visible inside the gap rather than buried in the slider
  const railMeshes = [];
  [-1, 1].forEach((s) => {
    const rail = box(SLIDER.w * 0.2, RAIL_H, SLIDER.d * 0.86, sliderCeramic);
    rail.position.set(s * SLIDER.w * 0.32, RAIL_H / 2, 0);
    macroSliderGroup.add(rail);
    railMeshes.push(rail);
  });
  const centrePad = box(SLIDER.w * 0.22, RAIL_H * 0.8, SLIDER.d * 0.3, sliderCeramic);
  centrePad.position.set(0, RAIL_H * 0.4, SLIDER.d * 0.26);
  macroSliderGroup.add(centrePad);
  railMeshes.push(centrePad);

  // read/write element at the TRAILING edge — the closest point to the disk,
  // which is the whole reason fly height is quoted at the trailing edge
  const macroGmr = new THREE.Mesh(new THREE.BoxGeometry(SLIDER.w * 0.3, RAIL_H * 0.75, 0.045), gmrMat);
  macroGmr.position.set(0, RAIL_H * 0.37, SLIDER.d * 0.47);
  macroSliderGroup.add(macroGmr);

  // --- the gap itself: a glowing slab of AIR filling the void --------------
  // A solid (not a plane) so it reads as a measurable height from any angle;
  // it is the label anchor and the brightest thing in the shot.
  const gapVolume = new THREE.Mesh(new THREE.BoxGeometry(SLIDER.w * 0.92, 1, SLIDER.d * 0.98), accentGlow);
  macroGroup.add(gapVolume);

  // dimension marker: a bright post at the trailing edge spanning exactly the
  // gap, so the viewer has something to read the height OFF of
  const dimMat = new THREE.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.95 });
  const dimPost = new THREE.Mesh(new THREE.BoxGeometry(0.012, 1, 0.012), dimMat);
  dimPost.position.z = SLIDER.d * 0.62;
  dimPost.position.x = SLIDER.w * 0.42;
  macroGroup.add(dimPost);
  const dimCaps = [0, 1].map((i) => {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.01, 0.012), dimMat);
    cap.position.set(SLIDER.w * 0.42, 0, SLIDER.d * 0.62);
    macroGroup.add(cap);
    return cap;
  });

  // airflow dots dragged THROUGH the gap by the platter, leading -> trailing
  const flowCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, MACRO_GAP * 0.45, -SLIDER.d * 1.25),
    new THREE.Vector3(0, MACRO_GAP * 0.5, -SLIDER.d * 0.45),
    new THREE.Vector3(0, MACRO_GAP * 0.42, SLIDER.d * 0.45),
    new THREE.Vector3(0, MACRO_GAP * 0.5, SLIDER.d * 1.25),
  ]);
  const airflow = chargeQueue(flowCurve, 7, 0x7fd4ff, { size: 0.014, spacing: 0.13 });
  airflow.dots.forEach((d) => {
    d.material.emissiveIntensity = 1.1;
  });
  macroGroup.add(airflow.group);
  // a second lane, offset sideways, so the flow reads as a sheet not a wire
  const airflow2 = chargeQueue(flowCurve, 7, 0x7fd4ff, { size: 0.011, spacing: 0.13 });
  airflow2.group.position.x = -SLIDER.w * 0.5;
  airflow2.dots.forEach((d) => {
    d.material.emissiveIntensity = 0.8;
  });
  macroGroup.add(airflow2.group);

  // dust mote — deliberately TALLER than the gap: that is the entire point
  const dustMote = new THREE.Mesh(new THREE.SphereGeometry(MACRO_GAP * 0.95, 14, 12), dustMat);
  dustMote.visible = false;
  macroGroup.add(dustMote);

  // Deliberately small: an impact flash at the contact point, not a fireball.
  // Anything larger occludes the very collapse it is meant to punctuate.
  const sparkFlash = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 12), sparkMat);
  sparkFlash.position.set(0, 0.014, SLIDER.d * 0.45);
  macroGroup.add(sparkFlash);

  // the gouge the crash leaves in the coating — grows along the track
  const gougeMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a1c20,
    metalness: 0.2,
    roughness: 0.95,
    transparent: true,
    opacity: 0,
  });
  const gouge = new THREE.Mesh(new THREE.PlaneGeometry(SLIDER.w * 0.7, MACRO_SLAB.d), gougeMat);
  gouge.rotation.x = -Math.PI / 2;
  gouge.position.y = 0.003;
  macroGroup.add(gouge);

  // --- labels ----------------------------------------------------------------
  const labels = calloutSets(['exterior', 'internal', 'flight', 'macro', 'seek', 'crash']);
  labels.add('exterior', connBlock, 'SATA + power connector', [0, 0.05, -0.04], 200, 42);
  labels.add('exterior', caseBase, 'Sealed casing', [0.3, 0.12, 0.5], 40, 46);
  labels.add('internal', hub, 'Spindle motor', [0, 0.14, 0], 100, 48);
  labels.add('internal', platters[PLATTER_COUNT - 1], 'Platter stack', [0.3, 0.02, 0.2], 40, 52);
  labels.add('internal', ramp, 'Landing ramp — head parked here', [0, 0.06, 0], 260, 60);
  labels.add(
    'flight',
    mechGroup,
    '7200 RPM class spin',
    [spindleGroup.position.x + PLATTER_R * 0.55, spindleGroup.position.y + 0.15, spindleGroup.position.z],
    35,
    52,
  );
  labels.add('flight', armLiftGroup, 'Head now flying, not resting', [0, 0.05, 0.05], 30, 40);
  // Fanned to four distinct bearings — at macro framing these all crowd the
  // same patch of screen otherwise (the airflow gets no callout on purpose;
  // the step's hint line already names the blue dots).
  // Leaders kept SHORT: the 9:16 export crops the sides of this 16:9 framing,
  // and a long leader walks the label text straight off the portrait edge —
  // which is how the "3 nanometres" stat, the whole point of the video, got
  // truncated. Short leaders keep the text over the object in both aspects.
  labels.add('macro', gapVolume, 'THIS gap — about 3 nanometres', [SLIDER.w * 0.55, 0, 0], 8, 44);
  labels.add('macro', macroSlider, 'Slider — the head\'s ceramic body', [0, SLIDER.h * 0.5, 0], 62, 50);
  labels.add('macro', railMeshes[1], 'Air Bearing Surface rails', [0.06, 0, -0.14], 288, 62);
  labels.add('macro', macroGmr, 'Read / write element', [0, 0, 0.05], 336, 48);
  labels.add('seek', armLiftGroup, 'Voice-coil actuator swings the head', [0, 0.05, 0], 90, 46);
  labels.add(
    'seek',
    platters[PLATTER_COUNT - 1],
    'Concentric tracks + servo wedges',
    [PLATTER_R * 0.45, 0.01, PLATTER_R * 0.5],
    20,
    56,
  );
  labels.add('crash', dustMote, 'A dust particle is a boulder here', [0.1, 0, 0], 40, 60);
  labels.add('crash', sparkFlash, 'Head crash — gouges the coating', [0.15, 0.05, 0], 30, 58);

  // --- pose function -----------------------------------------------------
  const state = {
    turntable: 0,
    reveal: 0,
    spin: 0,
    spunUp: 0,
    seek: 0,
    fly: 0,
    macro: 0,
    crash: 0,
  };

  function setPose() {
    group.rotation.y = state.turntable;

    const rev = clamp(state.reveal);
    coverTop.position.y = COVER_CLOSED_Y + rev * 0.85;
    coverTop.visible = rev < 0.999 ? true : false; // fully lifted clear of frame

    spindleGroup.rotation.y = state.spin;

    const seekAngle = ARM_PARK_ANGLE + (ARM_INNER_ANGLE - ARM_PARK_ANGLE) * clamp(state.seek);
    armPivotAngleGroup.rotation.y = seekAngle;

    const flyT = clamp(state.fly);
    armLiftGroup.position.y = (1 - flyT) * RAMP_LIFT;

    macroGroup.visible = state.macro > 0.001;

    const cr = clamp(state.crash);
    // the air film collapses on impact and re-pressurises afterwards; at cr=1
    // every term below is back to its cr=0 value, so the loop wraps seamlessly
    const collapse = win(cr, 0.4, 0.52) * (1 - win(cr, 0.62, 0.88));
    const gapH = Math.max(0.005, MACRO_GAP * (1 - collapse));

    macroSliderGroup.position.y = gapH;
    macroSliderGroup.rotation.x = -SLIDER_PITCH * (1 - collapse);

    // the glowing volume of air, the dimension post and the flow lanes all
    // scale off the SAME gap height — they can never disagree
    gapVolume.scale.y = gapH;
    gapVolume.position.y = gapH / 2;
    accentGlow.opacity = 0.3 * (1 - collapse);
    dimPost.scale.y = gapH;
    dimPost.position.y = gapH / 2;
    dimCaps[0].position.y = 0.004;
    dimCaps[1].position.y = gapH;
    dimMat.opacity = 0.95 * (1 - collapse);
    const flowScale = gapH / MACRO_GAP;
    airflow.group.scale.y = flowScale;
    airflow2.group.scale.y = flowScale;

    // dust mote rides in on the airflow from upstream and wedges into the gap
    dustMote.visible = cr > 0.03 && cr < 0.72;
    const drift = win(cr, 0.02, 0.5);
    dustMote.position.set(0, MACRO_GAP * 0.5, -SLIDER.d * 1.5 + drift * SLIDER.d * 1.95);
    dustMote.scale.setScalar(1 - win(cr, 0.52, 0.7) * 0.85);

    const impact = win(cr, 0.46, 0.55) * (1 - win(cr, 0.6, 0.8));
    sparkMat.opacity = impact * 0.6;
    sparkFlash.scale.setScalar(0.35 + impact * 0.85);
    gougeMat.opacity = win(cr, 0.5, 0.62) * 0.85 * (1 - win(cr, 0.9, 1));

    // the crash jolts the real arm off its flying height for an instant too
    armLiftGroup.position.y += impact * 0.05;
  }
  setPose();

  return {
    parts: {
      group,
      driveGroup,
      spindleGroup,
      actuatorGroup,
      armPivotAngleGroup,
      armLiftGroup,
      macroGroup,
      coverTop,
    },
    setLabels: labels.setLabels,
    setTurntable: (rad) => {
      state.turntable = rad;
      setPose();
    },
    setReveal: (v) => {
      state.reveal = v;
      setPose();
    },
    setSpin: (rad) => {
      state.spin = rad;
      setPose();
    },
    setSeek: (v) => {
      state.seek = v;
      setPose();
    },
    setFly: (v) => {
      state.fly = v;
      setPose();
    },
    setMacro: (v) => {
      state.macro = v;
      setPose();
    },
    setAirflow: (t) => airflow.setFront(t, state.macro > 0.001),
    setCrash: (v) => {
      state.crash = v;
      setPose();
    },
    set(partial) {
      Object.assign(state, partial);
      setPose();
    },
  };
}

// Concentric-track + radial-servo-sector platter surface texture, canvas
// generated — a real HDD's tracks are magnetic, not visually etched, but this
// is the standard way to make "there are thousands of tracks and servo
// wedges" legible at product-shot scale.
function trackTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3a3f47';
  ctx.fillRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;
  ctx.strokeStyle = 'rgba(150,170,190,0.28)';
  ctx.lineWidth = 1;
  for (let r = size * 0.08; r < size * 0.49; r += size * 0.012) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(127,212,255,0.5)';
  ctx.lineWidth = 2;
  const sectors = 24;
  for (let i = 0; i < sectors; i++) {
    const a = (i / sectors) * TAU;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * size * 0.08, cy + Math.sin(a) * size * 0.08);
    ctx.lineTo(cx + Math.cos(a) * size * 0.49, cy + Math.sin(a) * size * 0.49);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
