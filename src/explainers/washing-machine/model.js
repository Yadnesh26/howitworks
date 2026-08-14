import * as THREE from 'three';
import { materials, rod, disc, studioPlinth } from '../../framework/parts.js';
import { beveledBox, tubeAlong, coil, boltCircle } from '../../framework/geometry.js';
import { clamp01, smooth, win, TAU } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// A modern front-loading washing machine — a sealed white product shot whose
// cabinet ghosts away to expose the tub-inside-a-tub, the concrete ballast it
// hangs from, and the direct-drive motor bolted to its back.
//
// PROPORTIONS (a real 600 x 850 x 600 mm European front loader => 1 : 1.42 : 1):
//   CAB_W 1.5 : CAB_H 2.12 : CAB_D 1.5  =  1 : 1.41 : 1.
//   Drum diameter / cabinet width = 1.15 / 1.5 = 0.77 (real ~490/600 = 0.82).
//   Drum axis at 55% of cabinet height, matching a door centred ~480 mm up an
//   850 mm machine. One model unit = 0.426 m at this scale.
//
// MECHANISM (researched): only the perforated stainless INNER drum turns; it
// hangs inside a sealed plastic OUTER tub that holds the water. Three lifter
// paddles carry clothes up the wall and gravity drops them, flexing detergent
// solution through the weave — so wash speed must stay BELOW the point where
// centrifugal force beats gravity (~60 rpm at this 245 mm drum radius); wash
// tumbling runs ~50 rpm. Water enters through a solenoid valve, is flushed
// through the detergent drawer into the tub, and a ~2 kW sheathed element in
// the sump heats it. An air-trap hose feeds a pressure sensor that reads the
// level. A centrifugal pump drains it, and the drum then ramps to ~1400 rpm —
// about 500 g at the drum wall — throwing water out through the perforations
// into the outer tub. The whole tub assembly floats on two springs and two
// friction dampers with ~25 kg of concrete counterweight bolted to it, which
// is the only reason the machine does not walk across the floor. Modern
// machines drive the drum with an outer-rotor BLDC motor bolted straight to
// the tub back — no belt, no pulley.
//
// STATE SCALARS (one pose fn, `set({...})`):
//   reveal     0 sealed cabinet -> 1 cabinet ghosted, tub translucent
//   drumAngle  drum rotation (rad) — whole turns per lap
//   tumbleMix  0 clothes tumble and fall -> 1 clothes pinned to the wall
//   fill       0 empty -> 1 wash water level (morph target)
//   heat       heating-element emissive ramp
//   drawer     detergent-drawer slide
//   pumpSpin   drain impeller angle (rad)
//   flow       phase clock for every dot trail — whole cycles per lap
//   dye/drainVis/sprayVis   0..1 visibility of the three flow trails
//   shake      0 -> 1 out-of-balance tub excursion (rides drumAngle)
//   motorOpen  0 -> 1 cuts the rotor's steel pot away to expose the stator

// --- one-scale layout --------------------------------------------------------
const PLINTH_H = 0.26;
const CAB_W = 1.5;
const CAB_H = 2.12;
const CAB_D = 1.5;
const CAB_Y0 = PLINTH_H;
const CAB_Y1 = CAB_Y0 + CAB_H; // 2.38
const HALF_W = CAB_W / 2;
const FRONT_Z = CAB_D / 2;
const BACK_Z = -CAB_D / 2;

const AXIS_Y = 1.43; // drum axis height
const TUB_Z = 0.055; // drum/tub centre along the depth axis
const TILT = 0.07; // ~4 deg nose-up, like every real front loader

const DRUM_R = 0.575;
const DRUM_LEN = 0.87;
const TUB_R = 0.645; // outer tub, inner radius
const TUB_OUT = 0.672;
const TUB_LEN = 0.98;
const MOUTH_R = 0.42; // drum front opening
const DOOR_HOLE_R = 0.44;
const BEZEL_R = 0.5;
const STRIP_Y0 = 2.06; // control strip / drawer band on the front panel

const CARRY_R = DRUM_R - 0.135; // radius the tumbling clothes ride at
const ANG_PICKUP = -1.95; // clothes are scooped up here (bottom left)
const ANG_RELEASE = 0.92; // and let go here, past the horizontal
const CARRY_END = 0.58; // fraction of each garment cycle spent on the wall

const MOTOR_Z = -TUB_LEN / 2 - 0.15;

// tub-local -> world (the tub group is tilted about X and shifted in Y/Z)
const TUB_ORIGIN = new THREE.Vector3(0, AXIS_Y, TUB_Z);
const TUB_QUAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-TILT, 0, 0));
const toWorld = (x, y, z) =>
  new THREE.Vector3(x, y, z).applyQuaternion(TUB_QUAT).add(TUB_ORIGIN);
const w3 = (x, y, z) => toWorld(x, y, z).toArray();

// Deterministic jitter for the garments — same bundle every render, so the
// review screenshots are comparable run to run.
let seedN = 12345;
const rnd = () => {
  seedN = (seedN * 16807) % 2147483647;
  return seedN / 2147483647;
};

// Drum perforation mask: staggered dots used as an alphaMap with alphaTest, so
// the holes are REAL cutouts in the depth buffer (you see the far wall through
// them) rather than a printed-on texture.
function perforationMap() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#000000';
  const cols = 5;
  const rows = 5;
  const sx = 128 / cols;
  const sy = 128 / rows;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = ((i + (j % 2 ? 0.5 : 0)) * sx + sx * 0.5) % 128;
      const y = j * sy + sy * 0.5;
      ctx.beginPath();
      ctx.arc(x, y, sx * 0.19, 0, TAU);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(26, 7);
  tex.anisotropy = 8;
  return tex;
}

// Circular segment of the tub cross-section filled to `level` (0..1 of the
// inner DIAMETER), as a Shape with a FIXED point count so two levels can be
// morph targets of one another (shape-state animation rule).
function waterShape(level) {
  const R = TUB_R;
  const s = Math.max(-0.995, Math.min(0.995, (-R + 2 * R * level) / R));
  const a = Math.asin(s);
  const start = Math.PI - a; // left end of the surface chord
  const end = TAU + a; // right end, having swept through the bottom
  const N = 72;
  const M = 10;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const ang = start + (end - start) * (i / N);
    pts.push(new THREE.Vector2(Math.cos(ang) * R, Math.sin(ang) * R));
  }
  const p0 = pts[pts.length - 1];
  const p1 = pts[0];
  for (let i = 1; i < M; i++) {
    const t = i / M;
    pts.push(new THREE.Vector2(p0.x + (p1.x - p0.x) * t, p0.y + (p1.y - p0.y) * t));
  }
  const shape = new THREE.Shape();
  shape.setFromPoints(pts);
  return shape;
}

export function buildWashingMachine({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // --- materials -------------------------------------------------------------
  // Roughness note: the v2 presets MULTIPLY their roughnessMap (~0.5 texels)
  // into the base value, so everything large and curved here is pushed well up
  // — a 1.15-unit drum at the preset 0.3 reads as a mirror under the studio key.
  const bodyMat = materials.paintedMetal(0xeff1f2); // white enamel cabinet
  bodyMat.roughness = 0.5;
  bodyMat.clearcoat = 0.55;
  bodyMat.clearcoatRoughness = 0.28;
  const trimMat = materials.polymer(0x2a2e33); // stays opaque (base frame etc.)
  const panelTrimMat = materials.polymer(0x2a2e33); // ghosts with the cabinet
  const bezelMat = materials.polymer(0x33383e);
  const chromeMat = materials.chrome(0xc9ced4);
  chromeMat.roughness = 0.22;
  const glassMat = materials.glass(0xcfe0f0, 0.18);
  const bellowsMat = materials.rubber(0x1b1d20);
  const tubMat = materials.polymer(0x2f343a);
  tubMat.side = THREE.DoubleSide;
  const drumMat = materials.brushedSteel(0xc9cfd6);
  // Maps OFF on the drum wall: the brushed roughness/normal grain smeared into
  // wide diagonal glare bands across a 1.15-unit curved wall at the tumble
  // framing. A flat satin stainless reads correctly and lets the perforations
  // carry all the surface interest.
  drumMat.roughnessMap = null;
  drumMat.normalMap = null;
  drumMat.roughness = 0.52;
  drumMat.side = THREE.DoubleSide;
  drumMat.alphaMap = perforationMap();
  drumMat.alphaTest = 0.45;
  const drumSolidMat = materials.brushedSteel(0xc4cad1);
  drumSolidMat.roughnessMap = null;
  drumSolidMat.normalMap = null;
  drumSolidMat.roughness = 0.5;
  drumSolidMat.side = THREE.DoubleSide;
  const lifterMat = materials.polymer(0xb9bfc4);
  const concreteMat = new THREE.MeshPhysicalMaterial({
    color: 0xa8a49a,
    metalness: 0,
    roughness: 0.96,
  });
  const springMat = materials.brushedSteel(0xb7bdc4);
  springMat.roughness = 0.62;
  const damperMat = materials.polymer(0x3c4148);
  const copperMat = materials.aluminum(0xc98c52);
  copperMat.roughness = 0.75;
  const rotorMat = materials.aluminum(0xa9afb7);
  rotorMat.roughness = 0.62;
  rotorMat.side = THREE.DoubleSide;
  const magnetMat = materials.rubber(0x25272b);
  const steelMat = materials.aluminum(0xb3b9c0);
  steelMat.roughness = 0.7;
  const hoseMat = materials.rubber(0x24272b);
  const heaterMat = materials.aluminum(0xc6cbd0);
  heaterMat.roughness = 0.8;
  heaterMat.emissive = new THREE.Color(0xff5a1e);
  heaterMat.emissiveIntensity = 0;
  const displayMat = materials.glow(0x4fc3e8, 0.8);

  const shellMats = []; // cabinet — ghosts on reveal
  const shellHide = []; // cabinet metal bits — hidden outright (metal can't ghost)
  const tubMats = []; // outer tub — goes translucent on reveal

  // --- plinth ----------------------------------------------------------------
  group.add(studioPlinth({ w: 3.0, d: 2.4 }));

  // ============================================================================
  //  CABINET — the sealed product. Every panel here ghosts on reveal; the base
  //  frame stays opaque so the machine never looks like it is floating.
  // ============================================================================
  const cabinet = new THREE.Group();
  group.add(cabinet);

  const baseFrame = beveledBox(CAB_W, 0.1, CAB_D, trimMat, 0.02);
  baseFrame.position.set(0, CAB_Y0 + 0.05, 0);
  baseFrame.receiveShadow = true;
  cabinet.add(baseFrame);

  const topPanel = beveledBox(CAB_W, 0.04, CAB_D, bodyMat, 0.012);
  topPanel.position.set(0, CAB_Y1 - 0.02, 0);
  cabinet.add(topPanel);
  shellMats.push(topPanel);

  for (const sx of [-1, 1]) {
    const side = beveledBox(0.032, CAB_H - 0.12, CAB_D - 0.02, bodyMat, 0.01);
    side.position.set(sx * (HALF_W - 0.016), CAB_Y0 + 0.1 + (CAB_H - 0.12) / 2, 0);
    cabinet.add(side);
    shellMats.push(side);
  }

  const backPanel = beveledBox(CAB_W - 0.07, CAB_H - 0.12, 0.03, bodyMat, 0.01);
  backPanel.position.set(0, CAB_Y0 + 0.1 + (CAB_H - 0.12) / 2, BACK_Z + 0.015);
  cabinet.add(backPanel);
  shellMats.push(backPanel);

  // Front panel — one extruded plate with a REAL circular hole for the door
  // (pre-flight: an opening a part passes through is never a solid disc).
  const fp = new THREE.Shape();
  const fw = CAB_W - 0.032;
  const fh = CAB_H - 0.12;
  const fy0 = CAB_Y0 + 0.1;
  const rr = 0.03;
  fp.moveTo(-fw / 2 + rr, fy0);
  fp.lineTo(fw / 2 - rr, fy0);
  fp.absarc(fw / 2 - rr, fy0 + rr, rr, -Math.PI / 2, 0, false);
  fp.lineTo(fw / 2, fy0 + fh - rr);
  fp.absarc(fw / 2 - rr, fy0 + fh - rr, rr, 0, Math.PI / 2, false);
  fp.lineTo(-fw / 2 + rr, fy0 + fh);
  fp.absarc(-fw / 2 + rr, fy0 + fh - rr, rr, Math.PI / 2, Math.PI, false);
  fp.lineTo(-fw / 2, fy0 + rr);
  fp.absarc(-fw / 2 + rr, fy0 + rr, rr, Math.PI, Math.PI * 1.5, false);
  const doorHole = new THREE.Path();
  doorHole.absarc(0, AXIS_Y, DOOR_HOLE_R, 0, TAU, true);
  fp.holes.push(doorHole);
  const frontPanel = new THREE.Mesh(
    new THREE.ExtrudeGeometry(fp, { depth: 0.03, bevelEnabled: false, curveSegments: 48 }),
    bodyMat,
  );
  frontPanel.position.z = FRONT_Z - 0.03;
  frontPanel.castShadow = true;
  cabinet.add(frontPanel);
  shellMats.push(frontPanel);

  // control strip on the right of the band, dial + display + buttons
  const strip = beveledBox(0.8, 0.26, 0.03, panelTrimMat, 0.008);
  strip.position.set(0.32, STRIP_Y0 + 0.13, FRONT_Z - 0.002);
  cabinet.add(strip);
  shellMats.push(strip);

  const dialMat = materials.polymer(0x14161a);
  const dial = disc(0.085, 0.035, dialMat, 32);
  dial.rotation.x = Math.PI / 2;
  dial.position.set(0.52, 2.19, FRONT_Z + 0.018);
  cabinet.add(dial);
  shellMats.push(dial);
  const dialMark = beveledBox(0.012, 0.05, 0.012, chromeMat, 0.004);
  dialMark.position.set(0.52, 2.24, FRONT_Z + 0.03);
  cabinet.add(dialMark);
  shellHide.push(dialMark);

  const display = beveledBox(0.28, 0.07, 0.012, displayMat, 0.004);
  display.position.set(0.19, 2.24, FRONT_Z + 0.012);
  cabinet.add(display);
  shellMats.push(display);

  const buttonMat = materials.polymer(0x14161a);
  for (let i = 0; i < 4; i++) {
    const b = beveledBox(0.05, 0.05, 0.016, buttonMat, 0.006);
    b.position.set(0.06 + i * 0.09, 2.13, FRONT_Z + 0.014);
    cabinet.add(b);
    shellMats.push(b);
  }

  // detergent drawer — housing behind the band, drawer slides forward
  const drawerHousing = beveledBox(0.56, 0.24, 0.36, panelTrimMat, 0.01);
  drawerHousing.position.set(-0.38, 2.19, FRONT_Z - 0.19);
  cabinet.add(drawerHousing);
  shellMats.push(drawerHousing);

  const drawerGroup = new THREE.Group();
  drawerGroup.position.set(-0.38, 2.19, FRONT_Z + 0.002);
  cabinet.add(drawerGroup);
  const drawerFaceMat = materials.polymer(0x3a4046);
  const drawerFace = beveledBox(0.54, 0.24, 0.03, drawerFaceMat, 0.008);
  drawerGroup.add(drawerFace);
  shellMats.push(drawerFace);
  const handleMat = materials.polymer(0x14161a);
  const drawerHandle = beveledBox(0.2, 0.028, 0.03, handleMat, 0.008);
  drawerHandle.position.set(0, 0, 0.028);
  drawerGroup.add(drawerHandle);
  shellMats.push(drawerHandle);
  // the tray behind the face: three compartments, only readable once it slides
  const tray = new THREE.Group();
  tray.position.z = -0.17;
  drawerGroup.add(tray);
  const trayMat = materials.polymer(0xd8dde1);
  const trayFloor = beveledBox(0.5, 0.02, 0.3, trayMat, 0.006);
  trayFloor.position.y = -0.09;
  tray.add(trayFloor);
  for (let i = 0; i < 4; i++) {
    const divider = beveledBox(0.012, 0.12, 0.3, trayMat, 0.004);
    divider.position.set(-0.25 + i * 0.1667, -0.03, 0);
    tray.add(divider);
  }
  const softener = beveledBox(0.14, 0.05, 0.26, materials.glass(0x66d0f0, 0.55), 0.01);
  softener.position.set(0.17, -0.055, 0);
  tray.add(softener);
  const powder = beveledBox(0.14, 0.05, 0.26, materials.polymer(0xe9ecef), 0.01);
  powder.position.set(-0.0833, -0.055, 0);
  tray.add(powder);

  // door: bezel ring, chrome trim, glass bowl, latch
  const doorGroup = new THREE.Group();
  doorGroup.position.set(0, AXIS_Y, FRONT_Z - 0.01);
  cabinet.add(doorGroup);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(BEZEL_R - 0.05, 0.055, 16, 64), bezelMat);
  bezel.castShadow = true;
  doorGroup.add(bezel);
  shellMats.push(bezel);
  const chromeRing = new THREE.Mesh(new THREE.TorusGeometry(BEZEL_R - 0.05, 0.014, 12, 64), chromeMat);
  chromeRing.position.z = 0.045;
  doorGroup.add(chromeRing);
  shellHide.push(chromeRing);
  const bowlGeo = new THREE.SphereGeometry(0.62, 40, 20, 0, TAU, 0, 0.63);
  bowlGeo.translate(0, -0.62 * Math.cos(0.63), 0); // rim to the origin
  bowlGeo.scale(1, 0.9, 1);
  const glassBowl = new THREE.Mesh(bowlGeo, glassMat);
  glassBowl.rotation.x = -Math.PI / 2; // dome bulges back into the drum
  doorGroup.add(glassBowl);
  const latchMat = materials.polymer(0x14161a);
  const latch = beveledBox(0.05, 0.09, 0.06, latchMat, 0.012);
  latch.position.set(BEZEL_R - 0.04, 0, -0.03);
  doorGroup.add(latch);
  shellMats.push(latch);
  const interlock = beveledBox(0.11, 0.13, 0.09, trimMat, 0.012);
  interlock.position.set(DOOR_HOLE_R + 0.11, AXIS_Y, FRONT_Z - 0.09);
  cabinet.add(interlock);

  // filter trap / kick plate at the bottom of the front
  const kickPlate = beveledBox(CAB_W - 0.08, 0.2, 0.03, panelTrimMat, 0.008);
  kickPlate.position.set(0, CAB_Y0 + 0.22, FRONT_Z - 0.004);
  cabinet.add(kickPlate);
  shellMats.push(kickPlate);
  const trapMat = materials.polymer(0x3a4046);
  const trapCap = disc(0.075, 0.03, trapMat, 28);
  trapCap.rotation.x = Math.PI / 2;
  trapCap.position.set(0.44, CAB_Y0 + 0.22, FRONT_Z + 0.012);
  cabinet.add(trapCap);
  shellMats.push(trapCap);

  // ============================================================================
  //  TUB ASSEMBLY — everything that floats: outer tub, drum, clothes, water,
  //  heater, counterweights, motor. Shake moves this whole group.
  // ============================================================================
  const tubGroup = new THREE.Group();
  tubGroup.position.copy(TUB_ORIGIN);
  tubGroup.rotation.x = -TILT;
  group.add(tubGroup);

  const tubWall = new THREE.Mesh(
    new THREE.CylinderGeometry(TUB_OUT, TUB_OUT, TUB_LEN, 56, 1, true),
    tubMat,
  );
  tubWall.rotation.x = Math.PI / 2;
  tubWall.castShadow = true;
  tubGroup.add(tubWall);
  tubMats.push(tubWall);

  const tubBack = new THREE.Mesh(new THREE.CylinderGeometry(TUB_OUT, TUB_OUT * 0.9, 0.05, 56), tubMat);
  tubBack.rotation.x = Math.PI / 2; // wide end forward, tapering to the rear
  tubBack.position.z = -TUB_LEN / 2 - 0.02;
  tubGroup.add(tubBack);
  tubMats.push(tubBack);

  // tub front: a ring closing down to the door mouth
  const tubFront = new THREE.Mesh(
    new THREE.CylinderGeometry(DOOR_HOLE_R + 0.02, TUB_OUT, 0.1, 56, 1, true),
    tubMat,
  );
  tubFront.rotation.x = Math.PI / 2; // narrow end toward the door
  tubFront.position.z = TUB_LEN / 2 + 0.05;
  tubGroup.add(tubFront);
  tubMats.push(tubFront);

  // ribbed stiffeners, the giveaway that the tub is moulded plastic
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const rib = beveledBox(0.02, 0.035, TUB_LEN * 0.86, tubMat, 0.006);
    rib.position.set(Math.cos(a) * (TUB_OUT + 0.012), Math.sin(a) * (TUB_OUT + 0.012), 0);
    rib.rotation.z = a;
    tubGroup.add(rib);
    tubMats.push(rib);
  }

  // bellows / door boot — the rubber seal from the tub mouth to the front panel
  const bellows = new THREE.Mesh(
    new THREE.CylinderGeometry(DOOR_HOLE_R + 0.02, DOOR_HOLE_R + 0.05, 0.16, 48, 1, true),
    bellowsMat,
  );
  bellows.rotation.x = Math.PI / 2; // narrow end at the front panel
  bellows.position.z = TUB_LEN / 2 + 0.11;
  bellows.material.side = THREE.DoubleSide;
  tubGroup.add(bellows);
  const bellowsFold = new THREE.Mesh(
    new THREE.TorusGeometry(DOOR_HOLE_R + 0.05, 0.032, 12, 48),
    bellowsMat,
  );
  bellowsFold.position.z = TUB_LEN / 2 + 0.06;
  tubGroup.add(bellowsFold);

  // ============================================================================
  //  INNER DRUM — the only part that turns
  // ============================================================================
  const drum = new THREE.Group();
  tubGroup.add(drum);

  const drumWall = new THREE.Mesh(
    new THREE.CylinderGeometry(DRUM_R, DRUM_R, DRUM_LEN, 72, 1, true),
    drumMat,
  );
  drumWall.rotation.x = Math.PI / 2;
  drumWall.castShadow = true;
  drum.add(drumWall);

  const drumBack = new THREE.Mesh(
    new THREE.CylinderGeometry(DRUM_R, DRUM_R * 0.98, 0.03, 64),
    drumSolidMat,
  );
  drumBack.rotation.x = Math.PI / 2;
  drumBack.position.z = -DRUM_LEN / 2 - 0.015;
  drum.add(drumBack);

  // front lip: the drum mouth is narrower than the drum itself
  const drumLip = new THREE.Mesh(
    new THREE.CylinderGeometry(MOUTH_R, DRUM_R, 0.09, 64, 1, true),
    drumSolidMat,
  );
  drumLip.rotation.x = Math.PI / 2; // narrow end forward
  drumLip.position.z = DRUM_LEN / 2 + 0.045;
  drum.add(drumLip);
  const lipRoll = new THREE.Mesh(new THREE.TorusGeometry(MOUTH_R, 0.018, 10, 56), drumSolidMat);
  lipRoll.position.z = DRUM_LEN / 2 + 0.09;
  drum.add(lipRoll);

  // three lifter paddles — the entire wash action depends on these
  const lifterShape = new THREE.Shape();
  lifterShape.moveTo(-0.085, 0);
  lifterShape.lineTo(0.085, 0);
  lifterShape.lineTo(0.03, -0.13);
  lifterShape.lineTo(-0.03, -0.13);
  lifterShape.closePath();
  const lifterGeo = new THREE.ExtrudeGeometry(lifterShape, {
    depth: DRUM_LEN * 0.9,
    bevelEnabled: true,
    bevelSize: 0.008,
    bevelThickness: 0.008,
    bevelSegments: 2,
  });
  lifterGeo.translate(0, 0, -DRUM_LEN * 0.45);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const lifter = new THREE.Mesh(lifterGeo, lifterMat);
    lifter.castShadow = true;
    lifter.position.set(Math.cos(a) * DRUM_R, Math.sin(a) * DRUM_R, 0);
    lifter.rotation.z = a - Math.PI / 2;
    drum.add(lifter);
  }

  // ============================================================================
  //  SHAFT, SPIDER, DIRECT-DRIVE MOTOR (rear of the tub)
  // ============================================================================
  const spider = new THREE.Group();
  spider.position.z = -DRUM_LEN / 2 - 0.05;
  drum.add(spider);
  const spiderHub = disc(0.11, 0.07, steelMat, 24);
  spiderHub.rotation.x = Math.PI / 2;
  spider.add(spiderHub);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.5;
    const arm = beveledBox(0.075, DRUM_R * 0.86, 0.05, steelMat, 0.012);
    arm.position.set(Math.cos(a) * DRUM_R * 0.45, Math.sin(a) * DRUM_R * 0.45, 0);
    arm.rotation.z = a - Math.PI / 2;
    spider.add(arm);
  }

  const bearingHouse = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.19, 0.1, 32),
    materials.polymer(0x3a4046),
  );
  bearingHouse.rotation.x = Math.PI / 2;
  bearingHouse.position.z = -TUB_LEN / 2 - 0.14;
  tubGroup.add(bearingHouse);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.38, 24), steelMat);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = -TUB_LEN / 2 - 0.06;
  tubGroup.add(shaft);

  // stator: wound teeth facing OUTWARD (this is an outer-rotor motor)
  const statorGroup = new THREE.Group();
  statorGroup.position.z = MOTOR_Z;
  tubGroup.add(statorGroup);
  const statorCore = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.085, 48), steelMat);
  statorCore.rotation.x = Math.PI / 2;
  statorGroup.add(statorCore);
  const coilMats = [];
  const COILS = 27;
  for (let i = 0; i < COILS; i++) {
    const a = (i / COILS) * TAU;
    const mat = copperMat.clone();
    mat.emissive = new THREE.Color(0xffb066);
    mat.emissiveIntensity = 0;
    coilMats.push(mat);
    const c = beveledBox(0.05, 0.058, 0.1, mat, 0.012);
    c.position.set(Math.cos(a) * 0.265, Math.sin(a) * 0.265, 0);
    c.rotation.z = a;
    statorGroup.add(c);
  }
  const statorBolts = boltCircle(6, 0.19, 0.018, steelMat, 0.03);
  statorBolts.rotation.x = Math.PI / 2;
  statorBolts.position.z = -0.05;
  statorGroup.add(statorBolts);

  // rotor: a steel pot carrying the permanent magnets, bolted to the shaft.
  // rotorMount only TRANSLATES (exploded view) — rotorSpin does the turning, so
  // the motor callouts can hang off the mount and stay put while it runs.
  const rotorMount = new THREE.Group();
  rotorMount.position.z = MOTOR_Z;
  tubGroup.add(rotorMount);
  const rotorSpin = new THREE.Group();
  rotorMount.add(rotorSpin);
  const rotorBack = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.03, 48), rotorMat);
  rotorBack.rotation.x = Math.PI / 2;
  rotorBack.position.z = -0.075;
  rotorSpin.add(rotorBack);
  const rotorRim = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.14, 48, 1, true), rotorMat);
  rotorRim.rotation.x = Math.PI / 2;
  rotorSpin.add(rotorRim);
  const MAGNETS = 36;
  for (let i = 0; i < MAGNETS; i++) {
    const a = (i / MAGNETS) * TAU;
    const m = beveledBox(0.05, 0.022, 0.1, magnetMat, 0.005);
    m.position.set(Math.cos(a) * 0.325, Math.sin(a) * 0.325, 0);
    m.rotation.z = a;
    rotorSpin.add(m);
  }
  const rotorHub = disc(0.08, 0.07, steelMat, 20);
  rotorHub.rotation.x = Math.PI / 2;
  rotorHub.position.z = -0.06;
  rotorSpin.add(rotorHub);
  // the steel pot: hidden (not slid back) for the motor step. A real motor sits
  // hard against the back panel, so sliding it far enough to read pushed it
  // straight through the cabinet — cutting the shell away instead leaves the
  // magnet ring exactly where it belongs, around the coils.
  const rotorShell = [rotorBack, rotorRim, rotorHub];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const sp = beveledBox(0.05, 0.26, 0.02, rotorMat, 0.006);
    sp.position.set(Math.cos(a) * 0.17, Math.sin(a) * 0.17, -0.075);
    sp.rotation.z = a - Math.PI / 2;
    rotorSpin.add(sp);
    rotorShell.push(sp);
  }

  // ============================================================================
  //  COUNTERWEIGHTS — ~25 kg of concrete, the reason it stays put
  // ============================================================================
  const cwTop = beveledBox(0.92, 0.2, 0.36, concreteMat, 0.02);
  cwTop.position.set(0, TUB_OUT + 0.09, 0.1);
  tubGroup.add(cwTop);
  const cwFront = beveledBox(0.95, 0.22, 0.16, concreteMat, 0.02);
  cwFront.position.set(0, -TUB_OUT + 0.14, TUB_LEN / 2 + 0.06);
  tubGroup.add(cwFront);
  for (const sx of [-1, 1]) {
    const bolt = rod(0.02, 0.14, steelMat, 12);
    bolt.position.set(sx * 0.32, TUB_OUT - 0.02, 0.1);
    tubGroup.add(bolt);
  }

  // ============================================================================
  //  HEATER + SUMP + PRESSURE TAP
  // ============================================================================
  const heater = tubeAlong(
    [
      [0.128, -0.6, 0.42],
      [0.128, -0.6, 0.1],
      [0.128, -0.6, -0.26],
      [0.07, -0.612, -0.34],
      [-0.07, -0.612, -0.34],
      [-0.128, -0.6, -0.26],
      [-0.128, -0.6, 0.1],
      [-0.128, -0.6, 0.42],
    ],
    0.024,
    heaterMat,
    { tubularSegments: 90, radialSegments: 12, tension: 0.4 },
  );
  tubGroup.add(heater);
  const heaterFlange = beveledBox(0.2, 0.09, 0.03, steelMat, 0.008);
  heaterFlange.position.set(0, -0.6, 0.45);
  tubGroup.add(heaterFlange);

  const sump = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.12, 24), tubMat);
  sump.position.set(0.16, -TUB_OUT - 0.04, 0.3);
  sump.rotation.z = 0.25;
  tubGroup.add(sump);
  tubMats.push(sump);

  const airTrap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 20), tubMat);
  airTrap.position.set(-0.3, -TUB_OUT - 0.02, 0.24);
  tubGroup.add(airTrap);
  tubMats.push(airTrap);

  // ============================================================================
  //  CLOTHES — six soft blobs that ride the lifters up and fall
  // ============================================================================
  const garmentColors = [0xe6e8ea, 0x5b86c4, 0x2f4570, 0xc2543f, 0xd8c9a3, 0x6f7580, 0xb8c4cc, 0x8a5f6e];
  const garments = [];
  const gv = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    const geo = new THREE.IcosahedronGeometry(0.105, 3);
    const pos = geo.attributes.position;
    // Two octaves: the low one gives each bundle its own lumpy silhouette, the
    // higher one the soft creases that make it read as folded cloth. Per-vertex
    // random displacement made ice crystals; one octave alone made balloons.
    const [p1, p2, p3] = [rnd() * TAU, rnd() * TAU, rnd() * TAU];
    for (let v = 0; v < pos.count; v++) {
      gv.fromBufferAttribute(pos, v);
      const n = gv.clone().normalize();
      const bump =
        1 +
        0.15 * Math.sin(n.x * 3.1 + p1) +
        0.11 * Math.sin(n.y * 2.6 + p2) +
        0.09 * Math.sin(n.z * 3.7 + p3) +
        0.08 * Math.sin(n.x * 6.7 + n.y * 5.3 + p1 * 2) +
        0.06 * Math.sin(n.y * 7.9 + n.z * 6.1 + p2 * 2);
      pos.setXYZ(v, gv.x * bump, gv.y * bump * 0.72, gv.z * bump * 1.18);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshPhysicalMaterial({
      color: garmentColors[i],
      metalness: 0,
      roughness: 0.95,
      sheen: 0.4,
      sheenRoughness: 0.8,
    });
    const g = new THREE.Mesh(geo, mat);
    g.castShadow = true;
    g.scale.setScalar(0.85 + rnd() * 0.45);
    tubGroup.add(g);
    garments.push({ mesh: g, seed: i / 8, z: -0.3 + (i % 4) * 0.2 + (rnd() - 0.5) * 0.1 });
  }

  // ============================================================================
  //  WATER — a circular segment of the tub cross-section, level morphed
  // ============================================================================
  const extrudeOpts = { depth: TUB_LEN * 0.96, bevelEnabled: false, curveSegments: 1 };
  const waterGeo = new THREE.ExtrudeGeometry(waterShape(0.02), extrudeOpts);
  waterGeo.translate(0, 0, -TUB_LEN * 0.48);
  const waterHigh = new THREE.ExtrudeGeometry(waterShape(0.34), extrudeOpts);
  waterHigh.translate(0, 0, -TUB_LEN * 0.48);
  waterGeo.morphAttributes.position = [
    new THREE.Float32BufferAttribute(waterHigh.attributes.position.array.slice(), 3),
  ];
  waterHigh.dispose();
  // plain transparent water — NEVER transmission glass: this sits INSIDE the
  // ghosted tub, and the transmission pass would drop everything behind it
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x49b6e8,
    metalness: 0,
    roughness: 0.18,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  tubGroup.add(water);

  // ============================================================================
  //  PLUMBING (fixed to the cabinet, not to the floating tub)
  // ============================================================================
  const valveMat = materials.polymer(0x35393f);
  const inletValve = beveledBox(0.16, 0.12, 0.14, valveMat, 0.014);
  inletValve.position.set(0.42, 2.2, BACK_Z + 0.11);
  cabinet.add(inletValve);
  const inletCoil = coil({ turns: 7, radius: 0.045, length: 0.09, wireRadius: 0.008 }, copperMat);
  inletCoil.mesh.rotation.z = Math.PI / 2;
  inletCoil.mesh.position.set(0.42, 2.2, BACK_Z + 0.11);
  cabinet.add(inletCoil.mesh);
  const inletPipe = rod(0.03, 0.12, steelMat, 14);
  inletPipe.rotation.x = -Math.PI / 2;
  inletPipe.position.set(0.42, 2.2, BACK_Z + 0.05);
  cabinet.add(inletPipe);

  const inletHose = tubeAlong(
    [
      [0.42, 2.2, BACK_Z + 0.18],
      [0.32, 2.3, -0.35],
      [-0.1, 2.32, -0.05],
      [-0.38, 2.3, 0.22],
      [-0.38, 2.26, FRONT_Z - 0.34],
    ],
    0.028,
    hoseMat,
    { tubularSegments: 70, radialSegments: 12 },
  );
  group.add(inletHose);

  const dispenseHose = tubeAlong(
    [
      [-0.38, 2.06, FRONT_Z - 0.26],
      [-0.36, 1.95, 0.42],
      [-0.3, 1.86, 0.3],
      w3(-0.26, 0.6, 0.26),
    ],
    0.032,
    hoseMat,
    { tubularSegments: 60, radialSegments: 12 },
  );
  group.add(dispenseHose);

  const pressureHose = tubeAlong(
    [
      w3(-0.3, -TUB_OUT - 0.06, 0.24),
      [-0.5, 0.95, 0.2],
      [-0.6, 1.5, -0.1],
      [-0.58, 2.02, -0.26],
    ],
    0.016,
    hoseMat,
    { tubularSegments: 60, radialSegments: 10 },
  );
  group.add(pressureHose);
  const pressureSwitch = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.05, 24),
    materials.polymer(0x3a4046),
  );
  pressureSwitch.rotation.z = Math.PI / 2;
  pressureSwitch.position.set(-0.58, 2.08, -0.26);
  cabinet.add(pressureSwitch);

  // drain pump: volute housing with a visible impeller behind a clear cap
  const pumpGroup = new THREE.Group();
  pumpGroup.position.set(0.44, 0.52, 0.34);
  group.add(pumpGroup);
  const pumpMotor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 0.16, 28),
    materials.polymer(0x2b3036),
  );
  pumpMotor.rotation.z = Math.PI / 2;
  pumpMotor.position.x = -0.13;
  pumpGroup.add(pumpMotor);
  const voluteMat = materials.polymer(0x3f454c);
  voluteMat.side = THREE.DoubleSide;
  const volute = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 32, 1, true), voluteMat);
  volute.rotation.z = Math.PI / 2;
  pumpGroup.add(volute);
  const impeller = new THREE.Group();
  pumpGroup.add(impeller);
  const impHub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 16), steelMat);
  impHub.rotation.z = Math.PI / 2;
  impeller.add(impHub);
  const vaneMat = materials.polymer(0xb9bfc4);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const vane = beveledBox(0.05, 0.09, 0.02, vaneMat, 0.005);
    vane.position.set(0, Math.cos(a) * 0.065, Math.sin(a) * 0.065);
    vane.rotation.x = -a + 0.5;
    impeller.add(vane);
  }
  const pumpCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.012, 32),
    materials.glass(0xbcd4e4, 0.22),
  );
  pumpCap.rotation.z = Math.PI / 2;
  pumpCap.position.x = 0.045;
  pumpGroup.add(pumpCap);

  const sumpHose = tubeAlong(
    [
      w3(0.16, -TUB_OUT - 0.1, 0.3),
      [0.26, 0.62, 0.42],
      [0.4, 0.53, 0.4],
      [0.44, 0.52, 0.36],
    ],
    0.045,
    hoseMat,
    { tubularSegments: 50, radialSegments: 12 },
  );
  group.add(sumpHose);

  const drainHose = tubeAlong(
    [
      [0.5, 0.56, 0.3],
      [0.63, 0.8, 0.1],
      [0.66, 1.6, -0.2],
      [0.6, 2.0, -0.45],
      [0.5, 1.85, BACK_Z - 0.04],
    ],
    0.038,
    hoseMat,
    { tubularSegments: 70, radialSegments: 12 },
  );
  group.add(drainHose);

  // ============================================================================
  //  SUSPENSION — two springs above, two friction dampers below. Both are
  //  re-aimed every frame so they track the tub as it shakes.
  // ============================================================================
  const suspension = [];
  for (const sx of [-1, 1]) {
    const anchor = new THREE.Vector3(sx * 0.64, 2.29, TUB_Z + 0.12);
    const spring = coil({ turns: 11, radius: 0.05, length: 1, wireRadius: 0.013 }, springMat);
    spring.mesh.geometry.translate(0, 0.5, 0); // origin at the anchored end
    group.add(spring.mesh);
    const hook = rod(0.012, 0.09, springMat, 10);
    hook.rotation.x = Math.PI;
    hook.position.copy(anchor);
    group.add(hook);
    suspension.push({ mesh: spring.mesh, anchor, local: new THREE.Vector3(sx * 0.58, 0.34, 0.12) });
  }

  const dampers = [];
  for (const sx of [-1, 1]) {
    const base = new THREE.Vector3(sx * 0.54, 0.42, TUB_Z - 0.06);
    const local = new THREE.Vector3(sx * 0.34, -0.58, -0.06);
    const outer = rod(0.035, 1, damperMat, 16);
    group.add(outer);
    const inner = rod(0.018, 1, steelMat, 12);
    group.add(inner);
    const foot = beveledBox(0.09, 0.05, 0.09, trimMat, 0.012);
    foot.position.copy(base);
    group.add(foot);
    dampers.push({ outer, inner, base, local });
  }

  // ============================================================================
  //  FLOW DOTS — one phase clock, four trails
  // ============================================================================
  function dotTrail(curve, count, color, size, parent = group) {
    const geo = new THREE.SphereGeometry(size, 10, 8);
    const g = new THREE.Group();
    const dots = [];
    for (let i = 0; i < count; i++) {
      const mat = materials.glow(color, 1.3);
      mat.transparent = true;
      mat.opacity = 0;
      mat.depthWrite = false;
      const d = new THREE.Mesh(geo, mat);
      g.add(d);
      dots.push(d);
    }
    parent.add(g);
    function place(phase, vis) {
      dots.forEach((d, i) => {
        const t = (phase + i / count) % 1;
        d.position.copy(curve.getPointAt(t));
        d.material.opacity = vis * clamp01(win(t, 0, 0.08) * (1 - win(t, 0.9, 1))) * 0.95;
      });
    }
    place(0, 0);
    return { group: g, place };
  }

  const inletDots = dotTrail(inletHose.userData.curve, 10, 0x9fdcff, 0.034);
  const dyeDots = dotTrail(dispenseHose.userData.curve, 8, 0x4fc3e8, 0.04);
  const drainDots = dotTrail(sumpHose.userData.curve, 7, 0x6fb6dd, 0.038);
  const drainOutDots = dotTrail(drainHose.userData.curve, 10, 0x6fb6dd, 0.034);

  // spin-cycle droplets: flung off the LOAD, through the perforations, out to
  // the tub wall. Stretched along the radial axis so each reads as a thrown
  // streak — round dots at this size just looked like dust.
  const sprayGeo = new THREE.SphereGeometry(0.022, 10, 8);
  const spray = [];
  for (let i = 0; i < 30; i++) {
    const mat = materials.glow(0xd6f0ff, 1.5);
    mat.transparent = true;
    mat.opacity = 0;
    mat.depthWrite = false;
    const d = new THREE.Mesh(sprayGeo, mat);
    tubGroup.add(d);
    spray.push({ mesh: d, seed: i / 30, z: -0.38 + rnd() * 0.76 });
  }

  // ============================================================================
  //  CALLOUTS
  // ============================================================================
  const labels = calloutSets(['exterior', 'internal', 'water', 'tumble', 'motor', 'spin']);

  // Leader authoring rule (learned the hard way): label-layout.js FLIPS any
  // pill that would overflow the frame to the other side of its anchor — and
  // on these framings the other side is under the text panel. So every label
  // below is authored to sit comfortably inside the 1280px frame on the side
  // it is written for, with short enough text that it never trips the flip.
  labels.add('exterior', cabinet, 'Door glass + rubber boot', [0.24, AXIS_Y + 0.22, FRONT_Z + 0.02], 150, 70);
  labels.add('exterior', cabinet, 'Detergent drawer', [-0.16, 2.24, FRONT_Z + 0.03], 150, 60);
  labels.add('exterior', cabinet, 'Door interlock', [DOOR_HOLE_R + 0.13, AXIS_Y, FRONT_Z - 0.02], 190, 40);
  labels.add('exterior', cabinet, 'Drain filter trap', [0.44, CAB_Y0 + 0.22, FRONT_Z + 0.03], 200, 50);

  labels.add('internal', tubGroup, 'Outer tub — holds the water', [0.4, 0.54, -0.3], 25, 60);
  labels.add('internal', tubGroup, 'Perforated inner drum', [0.34, 0.46, 0.32], -30, 70);
  labels.add('internal', tubGroup, 'Counterweight — 25 kg', [0.3, TUB_OUT + 0.19, 0.1], 55, 60);
  labels.add('internal', group, 'Suspension spring', [0.64, 2.05, TUB_Z + 0.12], 45, 80);
  labels.add('internal', group, 'Friction damper', [0.5, 0.62, TUB_Z - 0.06], -45, 68);
  // NB: no motor callout in this set — from this step's front-quarter camera
  // the motor is behind the tub, and a leader pointing at an occluded part
  // reads as a bug. It gets its own step.

  labels.add('water', cabinet, 'Inlet solenoid valve', [0.42, 2.2, BACK_Z + 0.11], 150, 78);
  labels.add('water', cabinet, 'Detergent drawer', [-0.16, 2.3, FRONT_Z - 0.02], 60, 90);
  labels.add('water', tubGroup, 'Heating element (~2 kW)', [0.13, -0.6, 0.2], -55, 84);
  labels.add('water', group, 'Pressure sensor — water level', [-0.58, 2.08, -0.26], 15, 70);

  // rides the drum, so the dot stays ON a paddle while it turns
  labels.add('tumble', drum, 'Lifter paddle', [DRUM_R - 0.07, 0, 0.3], 55, 70);
  labels.add('tumble', tubGroup, '~50 rpm — gravity still wins', [0.42, -0.3, 0.1], -30, 45);

  labels.add('motor', rotorMount, 'Rotor — 36 magnets', [0.33, 0.12, 0], 60, 90);
  labels.add('motor', tubGroup, 'Stator — wound coils', [0.27, -0.14, MOTOR_Z], 30, 70);
  // no shaft callout: with the rotor pot cut away the shaft is behind the
  // stator from this camera, and the heading already carries "no belt"

  labels.add('spin', tubGroup, "Perforations — the water's only exit", [0.4, 0.41, 0.1], -18, 54);
  labels.add('spin', group, 'Drain pump', [0.5, 0.52, 0.34], -55, 62);
  labels.add('spin', tubGroup, '1400 rpm ≈ 500 g at the drum wall', [0.5, -0.36, 0.42], -30, 98);

  // ============================================================================
  //  POSE
  // ============================================================================
  const state = {
    reveal: 0,
    drumAngle: 0,
    tumbleMix: 0,
    fill: 0,
    heat: 0,
    drawer: 0,
    pumpSpin: 0,
    flow: 0,
    dye: 0,
    drainVis: 0,
    sprayVis: 0,
    shake: 0,
    motorOpen: 0,
  };

  // remember each ghosting material's authored clearcoat so reveal can zero it
  // and restore it (coat renders at full strength regardless of opacity)
  for (const list of [shellMats, tubMats]) {
    for (const m of list) {
      const mat = m.material;
      if ('clearcoat' in mat && mat.userData.coat === undefined) mat.userData.coat = mat.clearcoat;
    }
  }

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vDir = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion();
  const heaterCold = new THREE.Color(0xc6cbd0);
  const heaterHot = new THREE.Color(0xff7a3c);

  // aim a +Y unit-length mesh from a to b, scaling it to the gap
  function aim(mesh, a, b, lengthScale = 1) {
    vDir.subVectors(b, a);
    const len = vDir.length();
    mesh.position.copy(a);
    quat.setFromUnitVectors(UP, vDir.normalize());
    mesh.quaternion.copy(quat);
    mesh.scale.set(1, len * lengthScale, 1);
  }

  function placeGarments() {
    const turns = state.drumAngle / TAU;
    const mix = clamp01(state.tumbleMix);
    garments.forEach((g) => {
      // pinned-to-the-wall pose (spin cycle)
      const pinAng = state.drumAngle + g.seed * TAU;
      const pinR = DRUM_R - 0.1;
      const px = Math.cos(pinAng) * pinR;
      const py = Math.sin(pinAng) * pinR;

      // tumble pose: carried up the wall, then thrown across the drum
      const p = (turns + g.seed) % 1;
      let tx;
      let ty;
      if (p < CARRY_END) {
        const u = smooth(p / CARRY_END) * 0.25 + (p / CARRY_END) * 0.75;
        const ang = ANG_PICKUP + (ANG_RELEASE - ANG_PICKUP) * u;
        tx = Math.cos(ang) * CARRY_R;
        ty = Math.sin(ang) * CARRY_R;
      } else {
        const u = (p - CARRY_END) / (1 - CARRY_END);
        const rx = Math.cos(ANG_RELEASE) * CARRY_R;
        const ry = Math.sin(ANG_RELEASE) * CARRY_R;
        const cx = rx - Math.sin(ANG_RELEASE) * 0.34; // launched along the tangent
        const cy = ry + Math.cos(ANG_RELEASE) * 0.34;
        const ex = Math.cos(ANG_PICKUP) * CARRY_R;
        const ey = Math.sin(ANG_PICKUP) * CARRY_R;
        const k = 1 - u;
        tx = k * k * rx + 2 * k * u * cx + u * u * ex;
        ty = k * k * ry + 2 * k * u * cy + u * u * ey;
      }

      g.mesh.position.set(tx + (px - tx) * mix, ty + (py - ty) * mix, g.z);
      // 1:1 with the drum, so the tumble ends every lap on the same pose
      g.mesh.rotation.z = state.drumAngle + g.seed * TAU;
      g.mesh.rotation.x = g.seed * 2.1;
    });
  }

  function placeSpray() {
    const vis = clamp01(state.sprayVis);
    spray.forEach((s) => {
      const t = (state.flow * 2 + s.seed) % 1;
      const ang = state.drumAngle + s.seed * TAU;
      const travel = smooth(t);
      const r = CARRY_R + (TUB_R - CARRY_R) * travel;
      s.mesh.position.set(Math.cos(ang) * r, Math.sin(ang) * r, s.z);
      s.mesh.rotation.z = ang; // long axis points radially outward
      s.mesh.scale.set(1 + 2.4 * travel, 0.85, 0.85);
      s.mesh.material.opacity = vis * clamp01(win(t, 0, 0.1) * (1 - win(t, 0.72, 1)));
    });
  }

  function apply() {
    const r = clamp01(state.reveal);

    drum.rotation.z = state.drumAngle;
    rotorSpin.rotation.z = state.drumAngle; // direct drive: 1:1, no ratio
    impeller.rotation.x = state.pumpSpin;

    // out-of-balance excursion rides the drum angle, so it loops seamlessly
    const ex = state.shake * 0.016;
    tubGroup.position.set(
      TUB_ORIGIN.x + Math.cos(state.drumAngle) * ex,
      TUB_ORIGIN.y + Math.sin(state.drumAngle) * ex,
      TUB_ORIGIN.z,
    );

    // suspension follows the tub
    for (const s of suspension) {
      vA.copy(s.anchor);
      vB.copy(s.local).applyQuaternion(TUB_QUAT).add(tubGroup.position);
      aim(s.mesh, vA, vB);
    }
    for (const d of dampers) {
      vA.copy(d.base);
      vB.copy(d.local).applyQuaternion(TUB_QUAT).add(tubGroup.position);
      aim(d.outer, vA, vB, 0.62);
      aim(d.inner, vA, vB);
    }

    // water level + slosh
    const f = clamp01(state.fill);
    water.morphTargetInfluences[0] = f;
    waterMat.opacity = f * 0.58;
    water.rotation.z = Math.sin(state.flow * TAU) * 0.1 * f;

    const h = clamp01(state.heat);
    heaterMat.emissiveIntensity = h * 2.2;
    heaterMat.color.copy(heaterCold).lerp(heaterHot, h * 0.6);

    drawerGroup.position.z = FRONT_Z + 0.002 + clamp01(state.drawer) * 0.3;

    // stator field: a travelling wave locked to an INTEGER multiple of the drum
    // angle, so the pattern wraps exactly with the loop
    const fieldPhase = state.drumAngle * 18;
    const lit = clamp01(state.motorOpen) * 0.9 + 0.1;
    coilMats.forEach((m, i) => {
      const a = (i / COILS) * TAU;
      const s = Math.max(0, Math.cos(a * 4 - fieldPhase));
      m.emissiveIntensity = s * s * 1.6 * lit;
    });
    for (const m of rotorShell) m.visible = state.motorOpen < 0.5;

    inletDots.place(state.flow, clamp01(state.dye));
    dyeDots.place((state.flow * 1.3) % 1, clamp01(state.dye));
    drainDots.place(state.flow, clamp01(state.drainVis));
    drainOutDots.place((state.flow * 1.2) % 1, clamp01(state.drainVis));
    placeGarments();
    placeSpray();

    for (const m of shellMats) {
      const mat = m.material;
      mat.transparent = r > 0.02;
      mat.opacity = 1 - r * 0.9;
      mat.depthWrite = r < 0.4;
      if ('clearcoat' in mat) mat.clearcoat = r > 0.5 ? 0 : mat.userData.coat;
    }
    for (const m of shellHide) m.visible = r < 0.5; // metal never ghosts cleanly
    glassMat.opacity = 0.18 * (1 - r);
    for (const m of tubMats) {
      const mat = m.material;
      mat.transparent = r > 0.02;
      mat.opacity = 1 - r * 0.84;
      mat.depthWrite = r < 0.4;
      if ('clearcoat' in mat) mat.clearcoat = r > 0.5 ? 0 : mat.userData.coat;
    }
  }
  apply();

  return {
    group,
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setLabels: labels.setLabels,
    parts: {
      drum,
      rotorSpin,
      rotorMount,
      tubGroup,
      impeller,
      drawerGroup,
      water,
      garment: garments[0].mesh,
    },
  };
}
