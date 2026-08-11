import * as THREE from 'three';
import { materials, rod, box, disc, studioPlinth, chargeQueue } from '../../framework/parts.js';
import { beveledBox, radialLoft, tubeAlong } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, win, TAU } from '../../framework/motion.js';

// A wired optical mouse: a sealed product shot whose shell ghosts away to the
// board, the two snap-action switches, the wheel's detent encoder, and the
// sensor — plus a hugely magnified cutaway of the one thing you can never see,
// the few millimetres of lit air between the sensor and your desk.
//
// MECHANISM (researched):
//  - A red LED (~630 nm) is aimed at the desk at a SHALLOW grazing angle, not
//    straight down. At that angle even a surface that looks smooth throws long
//    micro-shadows, which is what gives the sensor something to look at.
//  - A small lens images that lit patch onto a CMOS array that captures on the
//    order of 1,500 frames per second (classic optical-mouse figure; gaming
//    sensors run far higher).
//  - An onboard DSP cross-correlates each frame against the previous one. It
//    is not recognising the desk — it is measuring how far the speckle pattern
//    SHIFTED. That shift is the motion, reported as dx/dy over USB (up to
//    1000 Hz) at a typical 800-1600 CPI.
//  - Each button presses a snap-action microswitch (Omron D2FC class): ~0.5 mm
//    of travel, a bent metal leaf that buckles past its own centre and slaps
//    the contact shut. The tactile click and the electrical click are the same
//    event. Rated 10-20 million presses.
//  - The wheel turns a slotted encoder wheel between an emitter/detector pair
//    (two channels, deliberately out of phase — quadrature: which channel
//    leads gives direction, edge count gives distance), plus a sprung detent
//    star that gives the ~20 clicks per revolution you feel.
//
// PROPORTIONS: a mainstream desktop mouse is ~116 x 63 x 38 mm
// (L x W x H) -> 3.05 : 1.66 : 1. LEN/WID/HGT below hold that ratio by
// construction; every other constant is derived from them.
//
// GEOMETRY NOTE — the shell is ONE lofted solid, not a stack of blocks.
// radialLoft() stacks its cross-sections along +Y, but a mouse lies down, so
// the rings are authored in a local frame and the GEOMETRY (not the object) is
// rotated once, baking world orientation in:
//     rotateX(-PI/2):  local (x, y, z) -> world (x, z, -y)
// so a level's loft height (local y) becomes world -Z (length), and a ring
// point's height (local z) becomes world +Y (up). After a translate the model
// sits with: X = width, Y = height off the desk, Z = length, nose at -Z.
// Working in world coordinates everywhere else is worth this one rotation:
// every part position below is directly readable.
//
// STATE the pose is built from:
//   reveal      0 sealed shell / 1 shell + buttons ghosted to the mechanism
//   click       0..1 lap phase: left button presses, then right
//   scroll      wheel angle in radians (whole detents per lap)
//   strobe      0..1 lap phase for the LED / frame-capture blink
//   macro       0 hidden / 1 the magnified sensor cutaway is on stage
//   light       0..1 phase of the photons riding LED -> desk -> lens
//   data        0..1 front position of the dx/dy pulses, chip -> cable

const clamp = clamp01;

// --- body proportions -------------------------------------------------------
const LEN = 2.3; // Z, nose (-) to tail (+)
const WID = 1.25; // X
const HGT = LEN / 3.05; // Y — locks the real 3.05:1 length:height ratio
const HALF_W = WID / 2;
const PLINTH_TOP = 0.22;
// Cross-section superellipse. 2.5 rendered as a smooth loaf; a real mouse has a
// noticeably FLAT top rolling into near-vertical flanks, which is what 3.1 buys.
const SECT_EXP = 3.1;

// Silhouette, read off a mainstream mouse. t = 0 at the nose, 1 at the tail.
// Both tables run to near-zero at each end so the loft's caps close as rounded
// noses rather than flat cut faces.
const PROF_W = [
  [0.0, 0.05], [0.02, 0.26], [0.05, 0.42], [0.12, 0.64], [0.22, 0.80],
  [0.36, 0.93], [0.5, 0.99], [0.62, 1.0], [0.74, 0.97], [0.85, 0.9],
  [0.93, 0.76], [0.97, 0.55], [1.0, 0.08],
];
const PROF_H = [
  [0.0, 0.07], [0.02, 0.17], [0.05, 0.26], [0.12, 0.39], [0.22, 0.55],
  [0.36, 0.74], [0.5, 0.88], [0.62, 0.98], [0.68, 1.0], [0.78, 0.96],
  [0.86, 0.86], [0.93, 0.66], [0.97, 0.44], [1.0, 0.12],
];

// Catmull-Rom through the profile knots, NOT smoothstep between each pair.
// Smoothstep forces the slope to ZERO at every knot, so the lofted shell grew a
// faint terrace at each of the ~13 knots and read as horizontal banding /
// ridges down the whole body. Hermite with finite-difference tangents (scaled
// by the local span, since the knots are unevenly spaced) keeps the curve
// passing through the same silhouette points while staying smooth across them.
function sampleProfile(table, t) {
  const u = clamp(t);
  let i = 0;
  while (i < table.length - 2 && u > table[i + 1][0]) i++;
  const p0 = table[Math.max(0, i - 1)];
  const p1 = table[i];
  const p2 = table[i + 1];
  const p3 = table[Math.min(table.length - 1, i + 2)];
  const span = p2[0] - p1[0] || 1;
  const s = clamp((u - p1[0]) / span);
  const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0] || 1)) * span;
  const m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0] || 1)) * span;
  const s2 = s * s;
  const s3 = s2 * s;
  return Math.max(
    0, // the fast taper at the nose/tail can undershoot; a negative radius would invert the loft
    (2 * s3 - 3 * s2 + 1) * p1[1] +
      (s3 - 2 * s2 + s) * m1 +
      (-2 * s3 + 3 * s2) * p2[1] +
      (s3 - s2) * m2,
  );
}
const halfWidthAt = (t) => HALF_W * sampleProfile(PROF_W, t);
const heightAt = (t) => HGT * sampleProfile(PROF_H, t);
const zAt = (t) => -LEN / 2 + t * LEN; // world Z of a given t

// --- button + wheel-slot layout --------------------------------------------
const BTN_T0 = 0.09; // button front edge
const BTN_T1 = 0.46; // button hinge (rear edge)
const BTN_WRAP = (12 * Math.PI) / 180; // how far down the flank a button wraps
const WHEEL_T = 0.31;
const SLOT_T0 = 0.2;
const SLOT_T1 = 0.42;
// ONE centreline channel, measured in WIDTH not angle: a ~2 mm parting line
// between the buttons that opens out into the ~9 mm wheel slot. Angle-based
// widths looked right in the middle and wrong at both ends, because the body
// tapers — and the seam is the single feature that makes the shell read as a
// mouse rather than a smooth loaf.
const SEAM_HALF_X = 0.028;
const SEAM_DEPTH = 0.06;
const SLOT_HALF_X = 0.085;
const SLOT_DEPTH = 0.22;
const WHEEL_R = 0.135;
const WHEEL_W = 0.13;
const SWITCH_Z = -0.62;
const SWITCH_X = 0.26;
const PCB_Y = 0.09;
const PCB_TOP = PCB_Y + 0.011;
const SWITCH_H = 0.13; // body height; stem sits just above it

// Superellipse cross-section: x from the angle, y clamped at 0 so every ring
// shares ONE flat underside (a mouse sits on a plane, not on a curve).
function sectionXY(t, theta) {
  const hw = halfWidthAt(t);
  const h = heightAt(t);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const x = Math.sign(c) * Math.abs(c) ** (2 / SECT_EXP) * hw;
  const y = Math.max(0, Math.sign(s) * Math.abs(s) ** (2 / SECT_EXP) * h);
  return [x, y];
}
// Slot ramps in and out over a short run, so it reads as a milled channel
// with real end walls rather than a dent.
const slotAmountAt = (t) =>
  win(t, SLOT_T0, SLOT_T0 + 0.035) * (1 - win(t, SLOT_T1 - 0.035, SLOT_T1));
// how far along the buttons the hairline seam exists at all
const seamAmountAt = (t) =>
  win(t, BTN_T0 - 0.02, BTN_T0 + 0.02) * (1 - win(t, BTN_T1 - 0.02, BTN_T1 + 0.02));

const grooveHalfXAt = (t) =>
  SEAM_HALF_X + (SLOT_HALF_X - SEAM_HALF_X) * slotAmountAt(t);
const grooveDepthAt = (t) =>
  Math.max(SEAM_DEPTH * seamAmountAt(t), SLOT_DEPTH * slotAmountAt(t));

// Inverse of sectionXY's x term: the cross-section angle at which the surface
// reaches a given half-width. Lets the button edges track the groove walls
// exactly, at every t, however the body tapers.
function thetaAtX(t, x) {
  const r = Math.min(1, Math.max(0, x / halfWidthAt(t)));
  return Math.acos(r ** (SECT_EXP / 2));
}

// Ring sampling is deliberately NON-uniform. A 2 mm seam is far narrower than
// the gap between evenly-spaced samples near the top, so uniform rings stepped
// straight over the groove and it never appeared at all. Each ring instead
// places explicit points ON both groove walls and along its floor.
const RING_FLANK = 16; // per side: outer edge up to the groove wall
const RING_GROOVE = 4; // per side: across the groove floor
const RING_BOTTOM = 10; // across the flat underside
const RING_N = 2 * (RING_FLANK + 2 + RING_GROOVE) + RING_BOTTOM;

function ringPoints(t) {
  const depth = grooveDepthAt(t);
  const half = grooveHalfXAt(t);
  const floorY = Math.max(heightAt(t) - depth, 0.05);
  const thWall = thetaAtX(t, half); // angle where the surface reaches the wall
  const pts = [];
  const put = (theta) => {
    const [x, y] = sectionXY(t, theta);
    pts.push([x, Math.abs(x) <= half + 1e-6 ? Math.min(y, floorY) : y]);
  };
  // The ring is traced as a single continuous path, so a wall's two points must
  // be emitted in PATH order: descending into the groove on the right-hand
  // wall, climbing back out on the left. Emitting both walls top-then-bottom
  // folded the left wall back on itself and sealed the groove shut.
  const wall = (sign) => {
    const [x, y] = sectionXY(t, sign > 0 ? thWall : Math.PI - thWall);
    const top = [x, y]; // on the outer surface
    const bottom = [x, Math.min(y, floorY)]; // on the groove floor
    if (sign > 0) pts.push(top, bottom);
    else pts.push(bottom, top);
  };
  for (let i = 0; i < RING_FLANK; i++) put((thWall * i) / RING_FLANK);
  wall(1);
  for (let i = 1; i <= RING_GROOVE; i++) put(thWall + ((Math.PI / 2 - thWall) * i) / (RING_GROOVE + 1));
  for (let i = 0; i < RING_GROOVE; i++)
    put(Math.PI / 2 + ((Math.PI / 2 - thWall) * i) / (RING_GROOVE + 1));
  wall(-1);
  for (let i = 1; i <= RING_FLANK; i++) put(Math.PI - thWall + (thWall * i) / RING_FLANK);
  for (let i = 1; i <= RING_BOTTOM; i++) put(Math.PI + (Math.PI * i) / RING_BOTTOM);
  return pts;
}

// A point on the outer shell surface, optionally offset along the local
// surface normal — this is what lets the button panels HUG the body instead of
// sitting on it as flat plates (the tell that killed the first attempt).
function shellPoint(t, theta, offset = 0) {
  const hw = halfWidthAt(t);
  const h = heightAt(t);
  const [x, y] = sectionXY(t, theta);
  if (!offset) return new THREE.Vector3(x, y, zAt(t));
  // gradient of |x/hw|^e + |y/h|^e = 1 — the true in-section normal
  const e = SECT_EXP;
  let nx = (e / hw) * Math.abs(x / hw) ** (e - 1) * Math.sign(x || 1);
  let ny = (e / h) * Math.abs(y / h) ** (e - 1) * Math.sign(y || 1);
  const len = Math.hypot(nx, ny) || 1;
  nx /= len;
  ny /= len;
  return new THREE.Vector3(x + nx * offset, y + ny * offset, zAt(t));
}

// Closed slab following the shell surface over a (t, theta) rectangle — the
// mouse buttons. Outer face sits proud of the shell, inner face just inside
// it, and the four rims are stitched, so it is a real solid with a visible
// parting line rather than a decal.
function surfacePatch({ t0, t1, th0, th1, out = 0.01, inn = -0.006, nt = 22, nth = 14 }, material) {
  const pos = [];
  const uvs = [];
  const idx = [];
  const push = (v, u, w) => {
    pos.push(v.x, v.y, v.z);
    uvs.push(u, w);
  };
  // th0/th1 may be functions of t: the inner edge has to ride the groove wall,
  // whose angle changes as the body tapers, or the button drifts off the seam.
  const ang = (v, t) => (typeof v === 'function' ? v(t) : v);
  for (const off of [out, inn]) {
    for (let i = 0; i <= nt; i++) {
      const t = t0 + ((t1 - t0) * i) / nt;
      const a = ang(th0, t);
      const b = ang(th1, t);
      for (let j = 0; j <= nth; j++) {
        push(shellPoint(t, a + ((b - a) * j) / nth, off), i / nt, j / nth);
      }
    }
  }
  const row = nth + 1;
  const base = (nt + 1) * row;
  const O = (i, j) => i * row + j;
  const I = (i, j) => base + i * row + j;
  // WINDING: outer faces must wind so their normal points AWAY from the body.
  // The mirrored order (t-then-theta) sends it inward, which back-face-culls the
  // entire panel and leaves only the rim strips visible at the silhouette —
  // the buttons looked like they had simply not been built.
  for (let i = 0; i < nt; i++) {
    for (let j = 0; j < nth; j++) {
      idx.push(O(i, j), O(i + 1, j), O(i, j + 1));
      idx.push(O(i, j + 1), O(i + 1, j), O(i + 1, j + 1));
      idx.push(I(i, j), I(i, j + 1), I(i + 1, j));
      idx.push(I(i, j + 1), I(i + 1, j + 1), I(i + 1, j));
    }
  }
  for (let i = 0; i < nt; i++) {
    idx.push(O(i, 0), O(i + 1, 0), I(i, 0), I(i, 0), O(i + 1, 0), I(i + 1, 0));
    idx.push(O(i, nth), I(i, nth), O(i + 1, nth), O(i + 1, nth), I(i, nth), I(i + 1, nth));
  }
  for (let j = 0; j < nth; j++) {
    idx.push(O(0, j), I(0, j), O(0, j + 1), O(0, j + 1), I(0, j), I(0, j + 1));
    idx.push(O(nt, j), O(nt, j + 1), I(nt, j), I(nt, j), O(nt, j + 1), I(nt, j + 1));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

// Ridge strip wrapped around a cylinder's circumference — the wheel's rubber
// grip and the encoder's slots, legible while turning at zero triangle cost.
function ridgeTexture(count, bg, fg) {
  const w = 512;
  const h = 64;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  for (let i = 0; i < count; i++) ctx.fillRect((i / count) * w, 0, w / count / 2.2, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildMouse({ scene }) {
  const group = new THREE.Group();
  scene.add(group);
  group.add(studioPlinth({ w: 1.95, h: PLINTH_TOP, d: 3.05 }));

  // everything that IS the mouse, lifted so its flat underside is on the desk
  const body = new THREE.Group();
  body.position.y = PLINTH_TOP;
  group.add(body);

  // --- materials ------------------------------------------------------------
  // Shell + buttons are matte polymer, the one family that can honestly ghost:
  // low specular, and their clearcoat is zeroed on reveal (coat renders at full
  // strength regardless of opacity and would keep reading solid).
  const shellMat = materials.polymer(0x454b55);
  shellMat.transparent = true;
  const buttonMat = materials.polymer(0x373d47);
  buttonMat.transparent = true;
  buttonMat.side = THREE.DoubleSide;
  const ghostable = [shellMat, buttonMat];

  const wheelMat = materials.rubber(0x141518);
  wheelMat.map = ridgeTexture(34, '#2a2d33', '#767d8b');
  const pcbMat = new THREE.MeshPhysicalMaterial({ color: 0x11542f, metalness: 0.1, roughness: 0.55 });
  const chipMat = materials.polymer(0x0b0c0f);
  const switchBodyMat = materials.polymer(0xe6ebef);
  const switchStemMat = materials.polymer(0xd8433a);
  const leafMat = materials.brushedSteel(0x8b95a3);
  const encoderMat = new THREE.MeshPhysicalMaterial({
    color: 0x2c3038,
    metalness: 0.2,
    roughness: 0.6,
    map: ridgeTexture(24, '#20232a', '#5b6270'),
  });
  const steelMat = materials.brushedSteel(0xb9c1c9);
  // Two LED materials, not one shared instance: the in-body LED sits under the
  // board where bloom turns any real brightness into a blown white patch, while
  // the macro LED has to carry a whole shot. Same blink drives both.
  const ledMat = new THREE.MeshPhysicalMaterial({
    color: 0x300a08,
    emissive: 0xff2f22,
    emissiveIntensity: 0,
    metalness: 0,
    roughness: 0.4,
  });
  const bodyLedMat = ledMat.clone();
  // plain transparent, never transmission: glowing photon dots pass right
  // through this lens, and the transmission pass would erase them
  const lensMat = new THREE.MeshPhysicalMaterial({
    color: 0x9fb6cc,
    metalness: 0,
    roughness: 0.08,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const footMat = materials.polymer(0xf1f1ef);
  const cableMat = materials.rubber(0x0f1012);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xff4a33,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const spotMat = new THREE.MeshBasicMaterial({
    color: 0xff5a40,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  // --- shell ----------------------------------------------------------------
  const LEVELS = 64; // dense enough that the slot's end walls stay crisp
  const levels = [];
  for (let i = 0; i < LEVELS; i++) {
    const f = i / (LEVELS - 1);
    levels.push({ y: f * LEN, points: ringPoints(1 - f) }); // see GEOMETRY NOTE
  }
  const shell = radialLoft(levels, shellMat, { capBottom: true, capTop: true });
  shell.geometry.rotateX(-Math.PI / 2);
  shell.geometry.translate(0, 0, LEN / 2);
  shell.geometry.computeVertexNormals();
  body.add(shell);

  // --- buttons: patches that follow the shell, hinged at their rear edge -----
  const hingeZ = zAt(BTN_T1);
  const hingeY = heightAt(BTN_T1) * 0.55;
  const PRESS = -0.032; // rad -> ~1.5 mm at the button front (copy says ~0.5 mm at the stem)

  function makeButton(side) {
    // side +1 = right button (theta below pi/2), -1 = left (mirrored).
    // The inner edge is a FUNCTION of t so it sits exactly on the groove wall.
    const innerTh = (t) => {
      const w = thetaAtX(t, grooveHalfXAt(t));
      return side > 0 ? w : Math.PI - w;
    };
    const outerTh = side > 0 ? BTN_WRAP : Math.PI - BTN_WRAP;
    const mesh = surfacePatch({ t0: BTN_T0, t1: BTN_T1, th0: innerTh, th1: outerTh }, buttonMat);
    // re-origin at the hinge so rotation.x is a true pivot, not a lerp
    mesh.geometry.translate(0, -hingeY, -hingeZ);
    const pivot = new THREE.Group();
    pivot.position.set(0, hingeY, hingeZ);
    pivot.add(mesh);
    body.add(pivot);
    // Moulded boss reaching down from the button's underside to the switch
    // stem — the real part that carries your fingertip the last few
    // millimetres, and what stops the button hovering above its own switch.
    const bossTop = shellPoint(0.23, thetaAtX(0.23, SWITCH_X), -0.012).y;
    const bossBottom = PCB_TOP + SWITCH_H + 0.03;
    const boss = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.045, Math.max(0.04, bossTop - bossBottom), 14),
      buttonMat,
    );
    boss.position.set(side * SWITCH_X, (bossTop + bossBottom) / 2 - hingeY, SWITCH_Z - hingeZ);
    pivot.add(boss);
    return { pivot, mesh, boss };
  }
  const buttonL = makeButton(-1);
  const buttonR = makeButton(1);

  // --- board ----------------------------------------------------------------
  // Sized to stay INSIDE the shell everywhere: the body narrows fast toward
  // the nose, and an over-wide board pokes green slivers out through the skin.
  const pcb = beveledBox(0.78, 0.022, 1.5, pcbMat, 0.01);
  pcb.position.set(0, PCB_Y, 0.1);
  body.add(pcb);

  // camera-facing side of the board, so the DSP is never buried behind the wheel
  const chip = beveledBox(0.19, 0.05, 0.19, chipMat, 0.008);
  chip.position.set(0.14, PCB_TOP + 0.025, 0.26);
  body.add(chip);
  const crystal = box(0.07, 0.04, 0.12, steelMat);
  crystal.position.set(-0.16, PCB_TOP + 0.02, 0.33);
  body.add(crystal);

  // --- microswitches --------------------------------------------------------
  // Body, a red actuator stem, and the bent leaf spring that does the snapping.
  function makeSwitch(side) {
    const g = new THREE.Group();
    g.position.set(side * SWITCH_X, PCB_TOP, SWITCH_Z);
    body.add(g);
    const shellBox = beveledBox(0.17, SWITCH_H, 0.16, switchBodyMat, 0.012);
    shellBox.position.y = SWITCH_H / 2;
    g.add(shellBox);
    const stem = beveledBox(0.075, 0.035, 0.075, switchStemMat, 0.008);
    stem.position.y = SWITCH_H + 0.015;
    g.add(stem);
    // the leaf: a thin strip that buckles through centre — the click itself
    const leaf = box(0.11, 0.008, 0.055, leafMat);
    leaf.position.set(0, SWITCH_H - 0.002, -0.035);
    g.add(leaf);
    return { group: g, shellBox, stem, leaf };
  }
  const switchL = makeSwitch(-1);
  const switchR = makeSwitch(1);

  // --- scroll wheel, detent star and optical encoder -------------------------
  const wheelTopY = heightAt(WHEEL_T) + 0.085; // protrudes clearly above the slot lip
  const wheelPivot = new THREE.Group();
  wheelPivot.position.set(0, wheelTopY - WHEEL_R, zAt(WHEEL_T));
  body.add(wheelPivot);

  const wheelGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, WHEEL_W, 40);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheel = new THREE.Mesh(wheelGeo, wheelMat);
  wheel.castShadow = true;
  wheelPivot.add(wheel);
  // rubber tyre reads as a separate part from the hub, like the real thing
  const hubGeo = new THREE.CylinderGeometry(WHEEL_R * 0.55, WHEEL_R * 0.55, WHEEL_W + 0.02, 24);
  hubGeo.rotateZ(Math.PI / 2);
  wheelPivot.add(new THREE.Mesh(hubGeo, materials.polymer(0x5a616d)));

  const axle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.52, 12).rotateZ(Math.PI / 2),
    steelMat,
  );
  wheelPivot.add(axle);

  // slotted encoder wheel, outboard on the same axle
  const encoderGeo = new THREE.CylinderGeometry(WHEEL_R * 0.7, WHEEL_R * 0.7, 0.022, 32);
  encoderGeo.rotateZ(Math.PI / 2);
  const encoder = new THREE.Mesh(encoderGeo, encoderMat);
  encoder.position.x = 0.245;
  wheelPivot.add(encoder);

  // emitter / detector pair straddling the encoder's rim
  const optoY = -WHEEL_R * 0.72;
  const emitter = beveledBox(0.03, 0.055, 0.05, materials.polymer(0x1b1d22), 0.008);
  emitter.position.set(0.245, optoY, -0.075);
  wheelPivot.add(emitter);
  const detector = emitter.clone();
  detector.position.set(0.245, optoY, 0.075);
  wheelPivot.add(detector);

  // sprung detent arm riding the star — the ~20 clicks per turn you feel
  const detentArm = beveledBox(0.02, 0.11, 0.016, steelMat, 0.005);
  detentArm.position.set(-0.02, -WHEEL_R * 0.95, 0.0);
  detentArm.rotation.x = 0.5;
  wheelPivot.add(detentArm);

  // A non-rotating anchor at the wheel for callouts. Labels parented to the
  // wheel itself would orbit with it and swing behind the body mid-lap.
  const wheelAnchor = new THREE.Object3D();
  wheelAnchor.position.copy(wheelPivot.position);
  body.add(wheelAnchor);
  const encoderAnchor = new THREE.Object3D();
  encoderAnchor.position.set(0.245, wheelPivot.position.y - WHEEL_R * 0.4, wheelPivot.position.z);
  body.add(encoderAnchor);

  // --- sensor module, facing down through the shell floor --------------------
  const SENSOR_Z = 0.06;
  const sensorBody = beveledBox(0.24, 0.09, 0.24, chipMat, 0.01);
  sensorBody.position.set(0, PCB_Y - 0.06, SENSOR_Z);
  body.add(sensorBody);
  const sensorWindow = new THREE.Mesh(new THREE.CircleGeometry(0.075, 24), materials.polymer(0x08090b));
  sensorWindow.rotation.x = -Math.PI / 2;
  sensorWindow.position.set(0, 0.004, SENSOR_Z);
  body.add(sensorWindow);
  const sensorLens = new THREE.Mesh(new THREE.SphereGeometry(0.05, 18, 12), lensMat);
  sensorLens.scale.y = 0.45;
  sensorLens.position.set(0, 0.035, SENSOR_Z);
  body.add(sensorLens);
  const bodyLed = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), bodyLedMat);
  bodyLed.position.set(0, 0.05, SENSOR_Z - 0.17);
  body.add(bodyLed);

  // --- glide feet -----------------------------------------------------------
  for (const z of [-0.82, 0.86]) {
    const foot = beveledBox(0.3, 0.01, 0.16, footMat, 0.005);
    foot.position.set(0, 0.005, z);
    body.add(foot);
  }

  // --- cable ----------------------------------------------------------------
  // A short stub: with no computer prop to reach, a long lead just swings into
  // the near plane of every hero framing.
  const cable = tubeAlong(
    [
      [0, 0.115, -LEN / 2 + 0.02],
      [-0.05, 0.095, -LEN / 2 - 0.2],
      [-0.22, 0.05, -LEN / 2 - 0.44],
    ],
    0.027,
    cableMat,
  );
  body.add(cable);
  const strain = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.045, 0.12, 16).rotateX(Math.PI / 2),
    materials.polymer(0x1a1c20),
  );
  strain.position.set(0, 0.115, -LEN / 2 - 0.03);
  body.add(strain);

  // --- dx/dy pulses: chip -> cable ------------------------------------------
  const dataCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(chip.position.x, chip.position.y + 0.03, chip.position.z),
    new THREE.Vector3(-0.05, PCB_TOP + 0.04, -0.4),
    new THREE.Vector3(0, 0.13, -LEN / 2 + 0.02),
    new THREE.Vector3(0, 0.075, -LEN / 2 - 0.3),
  ]);
  const dataDots = chargeQueue(dataCurve, 6, 0xff7a5e, { size: 0.022, spacing: 0.13 });
  body.add(dataDots.group);

  // ==========================================================================
  // MACRO CUTAWAY — the sensor's few millimetres of lit air, hugely magnified.
  // The real gap is flush against the desk: there is no camera angle in the
  // world that shoots it, so it gets its own stage beside the product (the
  // same scale trick hard-disk-drive uses for its 3 nm flying height).
  // ==========================================================================
  const macro = new THREE.Group();
  macro.position.set(3.6, 0.62, 0);
  group.add(macro);

  const MDESK = 1.7;
  const MGAP = 0.42; // the exaggerated sensor-to-desk gap

  const macroDesk = beveledBox(MDESK, 0.12, 1.15, materials.polymer(0x24272d), 0.02);
  macroDesk.position.y = -0.06;
  macro.add(macroDesk);

  // Micro-texture: the actual point of the shallow angle. These bumps are what
  // throw the long shadows the sensor photographs, so they are real geometry.
  const bumpMat = materials.polymer(0x2f333a);
  const bumpGeo = new THREE.SphereGeometry(1, 8, 6);
  const bumps = new THREE.InstancedMesh(bumpGeo, bumpMat, 190);
  bumps.castShadow = true;
  const m4 = new THREE.Matrix4();
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 190; i++) {
    const s = 0.012 + rnd() * 0.03;
    m4.makeScale(s * (1 + rnd()), s * (0.5 + rnd() * 0.5), s * (1 + rnd()));
    m4.setPosition((rnd() - 0.5) * MDESK * 0.95, 0.002, (rnd() - 0.5) * 1.05);
    bumps.setMatrixAt(i, m4);
  }
  bumps.instanceMatrix.needsUpdate = true;
  macro.add(bumps);

  // the underside of the mouse, hanging above
  const macroShell = beveledBox(MDESK * 0.8, 0.22, 0.85, materials.polymer(0x454b55), 0.04);
  macroShell.position.y = MGAP + 0.11;
  macro.add(macroShell);

  // LED, aimed at the desk at a shallow grazing angle (~27 degrees)
  const GRAZE = (27 * Math.PI) / 180;
  const spotP = new THREE.Vector3(0.05, 0.012, 0);
  const ledP = new THREE.Vector3(spotP.x - Math.cos(GRAZE) * 0.62, MGAP * 0.72, 0);
  const macroLed = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), ledMat);
  macroLed.position.copy(ledP);
  macro.add(macroLed);

  // the grazing beam itself, as a flattened cone from LED to lit patch
  const beamLen = ledP.distanceTo(spotP);
  const beamGeo = new THREE.ConeGeometry(0.13, beamLen, 20, 1, true);
  beamGeo.translate(0, -beamLen / 2, 0);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.copy(ledP);
  beam.lookAt(spotP);
  beam.rotateX(-Math.PI / 2);
  beam.scale.z = 0.4; // a slot of light, not a searchlight
  macro.add(beam);

  const litSpot = new THREE.Mesh(new THREE.CircleGeometry(0.26, 28), spotMat);
  litSpot.rotation.x = -Math.PI / 2;
  litSpot.position.set(spotP.x, 0.028, 0);
  litSpot.scale.x = 1.5; // grazing light lands as a stretched ellipse
  macro.add(litSpot);

  // lens + CMOS array looking straight down at the lit patch
  const macroLens = new THREE.Mesh(new THREE.SphereGeometry(0.13, 22, 14), lensMat);
  macroLens.scale.y = 0.4;
  macroLens.position.set(spotP.x, MGAP - 0.02, 0);
  macro.add(macroLens);
  const cmos = beveledBox(0.34, 0.07, 0.3, chipMat, 0.01);
  cmos.position.set(spotP.x, MGAP + 0.1, 0);
  macro.add(cmos);
  const cmosFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.24),
    new THREE.MeshBasicMaterial({ color: 0x1b2740 }),
  );
  cmosFace.rotation.x = Math.PI / 2;
  cmosFace.position.set(spotP.x, MGAP + 0.064, 0);
  macro.add(cmosFace);

  // photons: down the grazing beam, then up into the lens
  const lightCurve = new THREE.CatmullRomCurve3([
    ledP.clone(),
    ledP.clone().lerp(spotP, 0.55),
    spotP.clone(),
    new THREE.Vector3(spotP.x, MGAP - 0.06, 0),
  ]);
  const photons = chargeQueue(lightCurve, 7, 0xff6a4a, { size: 0.026, spacing: 0.12 });
  macro.add(photons.group);

  const macroAnchor = new THREE.Object3D();
  macroAnchor.position.set(spotP.x, MGAP * 0.5, 0);
  macro.add(macroAnchor);

  // --- callouts -------------------------------------------------------------
  // Vertical-ish leaders on purpose: a pill hung sideways off an anchor that
  // projects near frame edge gets mirrored or clamped by the runtime declutter,
  // which is how labels end up half off-screen.
  const labels = calloutSets(['exterior', 'internal', 'click', 'scroll', 'sensor', 'signal']);
  labels.add('exterior', shell, 'Contoured shell', [HALF_W * 0.72, heightAt(0.55) * 0.55, zAt(0.55)], 90, 66);
  labels.add('exterior', wheelAnchor, 'Scroll wheel', [0, WHEEL_R, 0], 90, 54);
  labels.add('exterior', strain, 'USB cable', [0, 0.02, -0.06], 250, 60);

  labels.add('internal', pcb, 'One circuit board', [0.3, 0.02, -0.2], 90, 72);
  labels.add('internal', chip, 'Microcontroller + DSP', [0, 0.03, 0], 90, 60);
  labels.add('internal', switchR.shellBox, 'Microswitch', [0, 0.07, 0], 60, 60);
  labels.add('internal', encoderAnchor, 'Wheel encoder', [0, 0, 0], 270, 62);

  labels.add('click', switchR.stem, 'Snap-action microswitch', [0, 0.03, 0], 90, 66);
  // ON the right button near its hinge. NB the patch's geometry was re-origined
  // to the hinge, so this offset is measured FROM the hinge, not from the nose.
  labels.add('click', buttonR.mesh, 'Button pivots at the back', [0.3, 0.06, -0.34], 40, 70);

  labels.add('scroll', wheelAnchor, 'Rubber wheel', [0, WHEEL_R, 0], 90, 58);
  labels.add('scroll', encoderAnchor, 'Slotted encoder disc', [0, 0, 0], 20, 78);

  labels.add('sensor', macroLed, 'LED skims the desk', [0, 0.05, 0], 90, 62);
  labels.add('sensor', macroAnchor, 'Micro-shadows', [0.1, -MGAP * 0.34, 0], 300, 70);
  labels.add('sensor', cmos, 'CMOS array', [0, 0.05, 0], 90, 58);

  labels.add('signal', chip, 'Compares each frame', [0, 0.03, 0], 90, 62);
  labels.add('signal', strain, 'dx / dy out over USB', [0, 0.02, -0.06], 250, 62);

  // --- pose -----------------------------------------------------------------
  const state = { reveal: 0, click: 0, scroll: 0, strobe: 0, macro: 0, light: 0, data: 0 };

  function setPose() {
    const rev = clamp(state.reveal);
    const op = 1 - rev * 0.9;
    for (const m of ghostable) {
      m.opacity = op;
      m.clearcoat = 0.15 * (1 - rev); // coat is opacity-blind; zero it or it reads solid
      m.depthWrite = op > 0.95; // a faded shell must not punch holes in what's behind
    }

    const c = ((state.click % 1) + 1) % 1;
    const pL = win(c, 0.06, 0.12) * (1 - win(c, 0.2, 0.3));
    const pR = win(c, 0.5, 0.56) * (1 - win(c, 0.64, 0.74));
    buttonL.pivot.rotation.x = pL * PRESS;
    buttonR.pivot.rotation.x = pR * PRESS;
    // the leaf buckles a fraction AFTER the stem starts moving: travel first,
    // then the snap — that lag IS the click
    switchL.stem.position.y = SWITCH_H + 0.015 - pL * 0.018;
    switchR.stem.position.y = SWITCH_H + 0.015 - pR * 0.018;
    switchL.leaf.rotation.x = -pL * 0.5;
    switchR.leaf.rotation.x = -pR * 0.5;

    wheelPivot.rotation.x = state.scroll;

    const blink = 0.5 + 0.5 * Math.sin(state.strobe * TAU * 20);
    ledMat.emissiveIntensity = 0.6 + blink * 1.5;
    bodyLedMat.emissiveIntensity = 0.25 + blink * 0.5; // dim: it sits under the board, and bloom blows it out

    macro.visible = state.macro > 0.5;
    beamMat.opacity = state.macro > 0.5 ? 0.1 + blink * 0.14 : 0;
    spotMat.opacity = state.macro > 0.5 ? 0.22 + blink * 0.2 : 0;
    photons.setFront(clamp(state.light), state.macro > 0.5);

    dataDots.setFront(clamp(state.data));
  }
  setPose();

  return {
    group,
    parts: { group, body, shell, buttonL, buttonR, wheelPivot, macro, switchL, switchR },
    setLabels: labels.setLabels,
    set(partial) {
      Object.assign(state, partial);
      setPose();
    },
  };
}
