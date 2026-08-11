import * as THREE from 'three';
import { materials, rod, studioPlinth } from '../../framework/parts.js';
import { beveledBox, lathe, tubeAlong } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { stippleNormalMap } from '../../framework/textures.js';
import { clamp01, smooth, win, TAU } from '../../framework/motion.js';

// A projected-capacitive (PCAP) touch panel in phone format, presented as a
// studio product shot: a sealed glass slab that lifts apart layer by layer,
// then runs its mechanism at macro scale.
//
// MECHANISM (researched — Riverdi "Capacitive touch panel construction",
// Analog Devices "Projected-capacitive touch from the controller point of
// view", Future Electronics PCAP technology paper, Microchip mutual-capacitance
// measurement docs, MDPI Sensors 18(11):3637 on mutual-cap TSP controllers):
//
// STACK, top to bottom: chemically strengthened COVER GLASS (0.55-1.1mm;
// 0.7mm typical on a phone) / optically clear adhesive (~50um) / two
// dielectrically separated ITO SENSOR LAYERS / OCA / DISPLAY. Indium tin oxide
// is 50-100nm thick at 100-300 ohms/square: conductive AND transparent, so the
// sensor is genuinely invisible in the finished product.
//
// PATTERN: both layers are etched into interlocking DIAMONDS (squares rotated
// 45 degrees) chained into lines — one layer's chains run across as DRIVE (TX)
// rows, the other's run down as SENSE (RX) columns, the column necks jumping
// the row necks on insulated bridges. Pitch is ~5mm. Each row/column crossing
// is a NODE.
//
// MEASUREMENT: the controller pulses one drive row at a time and samples every
// sense column simultaneously through charge amplifiers + delta-sigma ADCs.
// Charge fringes off the drive electrode, arcs up through the cover glass and
// lands on the sense electrode: a mutual capacitance of a few picofarads,
// rock steady. A finger is a soft conductor tied to a body carrying ~100pF to
// ground; parked over a node it intercepts the fringing field and shunts it
// away, so the coupling DROPS — by a few hundred femtofarads. Signal DOWN, not
// up. That inversion is the surprise this explainer is built around.
//
// FROM NUMBERS TO A COORDINATE: a full frame of every node takes ~8ms, so the
// sheet is re-read ~120 times a second. A fingertip flattens to a ~9mm contact
// patch — wider than the 5mm pitch — so several nodes dip at once and a
// weighted centroid over those values resolves position to a fraction of a
// millimetre, far finer than the grid itself. A dry glove simply moves the
// conductor further away and the coupling change vanishes.
//
// NO ANATOMY (house rule): the toucher is a GROUNDED TEST TIP — the standard
// conductive-tip probe on a ground lead used to validate touch panels.
// Electrically it is a fingertip: a ~9mm soft conductor referenced to ground.
//
// PROPORTIONS (world units, 1 unit = 50mm). Phone-format panel 147 x 71 x
// 7.8mm -> 2.94 x 1.42 x 0.156 units, corner radius 12mm -> 0.24. Electrode
// pitch 5mm -> 0.10, giving 28 sense columns x 13 drive rows = 364 nodes over
// a 140 x 60mm active area. Layer THICKNESSES are the one honest exaggeration:
// the ITO films are drawn ~100x thick (they are 100nm in reality) and the
// exploded gaps are theatrical, so the sandwich can be seen at all. Step 2's
// copy says so out loud.
//
// STATE — one object, one apply(). Every step's onEnter calls pin() which
// resets EVERY scalar to its default before merging the step's values, so a
// step can never inherit the previous step's mid-lap phase:
//   spin      turntable angle (radians)
//   open      0 sealed .. 1 fully exploded stack
//   ghost     0 solid product (sensor hidden, screen at full brightness)
//             .. 1 sensor layers visible, display dimmed under them
//   press     grounded test tip: 0 parked high .. 1 touching the glass
//   probeOn   tip visible at all
//   glove     dry fabric slid over the tip: 0 bare .. 1 covered. It multiplies
//             the touch signal to nothing INSIDE apply(), so "a glove kills it"
//             is a property of the model, not of one step's timeline
//   touch     touch strength feeding the capacitance map (independent of the
//             tip's visibility, so step 7 can show the map with the tip gone)
//   tx, tz    touch centre in panel coordinates
//   flow      charge-packet phase along the field arcs (mod 1)
//   arcs      field-arc visibility
//   scanning  1 = drive rows fire one at a time and the map builds behind the
//             sweep; 0 = every node reads at once
//   scanPhase sweep position (mod 1)
//   centroid  interpolated-centre marker visibility
//   ui        display content phase (mod 1)
//   ripple    tap ripple on the display (0..1)

// --- layout (world units; the panel rests on the plinth at y = PLINTH_H) ----
const PLINTH_H = 0.24;
const PANEL_L = 2.94; // 147mm, long axis along X
const PANEL_W = 1.42; // 71mm, short axis along Z
const CORNER = 0.24; // 12mm corner radius
const RIM_T = 0.024; // aluminium midframe wall

const P = 0.1; // 5mm electrode pitch
const NCOL = 28; // sense columns (spaced along X)
const NROW = 13; // drive rows (spaced along Z)
const AX0 = -((NCOL - 1) * P) / 2; // -1.35
const AZ0 = -((NROW - 1) * P) / 2; // -0.60
const DIAG = 0.0965; // diamond diagonal (5mm pitch less the etch gap)
// The drawn thickness of an electrode. The film is 100nm in reality; anything
// thicker than this reads as a stack of ceramic floor tiles at macro range.
const T_ETCH = 0.0025;

// layer bases (local to the panel body, whose bottom is y = 0)
const Y_BACK = 0.0;
const T_BACK = 0.03;
const Y_PCB = 0.032;
const Y_DISP = 0.072;
const T_DISP = 0.018;
const Y_OCA2 = 0.096;
const T_OCA = 0.008;
const Y_TX = 0.108;
const T_ITO = 0.006;
const Y_DIEL = 0.116;
const Y_RX = 0.124;
const Y_OCA1 = 0.132;
const Y_GLASS = 0.142;
const T_GLASS = 0.014;
const BODY_T = Y_GLASS + T_GLASS; // 0.156

// exploded lift per layer
const L_GLASS = 0.66;
const L_OCA1 = 0.54;
const L_RX = 0.44;
const L_DIEL = 0.36;
const L_TX = 0.28;
const L_OCA2 = 0.19;
const L_DISP = 0.09;

// the node the macro steps live on: drive row 6, sense column 17
const FJ = 17;
const FK = 6;
const FOCUS_X = AX0 + FJ * P; // 0.35
const FOCUS_Z = AZ0 + FK * P; // 0.00
const GLASS_TOP = PLINTH_H + Y_GLASS + T_GLASS; // world y of the touch surface

const ACCENT = 0x7de3ff;
const BASE_PF = 3.1; // node coupling with nothing near it
const DROP_PF = 0.38; // how much a touch steals (380 fF)

const DEFAULTS = {
  spin: 0,
  open: 0,
  ghost: 0,
  press: 0,
  probeOn: 0,
  glove: 0,
  touch: 0,
  tx: FOCUS_X,
  tz: FOCUS_Z,
  flow: 0,
  arcs: 0,
  scanning: 0,
  scanPhase: 0,
  centroid: 0,
  ripple: 0,
};

// rounded-rectangle outline centred on the origin, in the shape's XY plane
function roundRect(path, w, h, r) {
  const x = -w / 2;
  const y = -h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  path.moveTo(x + rr, y);
  path.lineTo(x + w - rr, y);
  path.absarc(x + w - rr, y + rr, rr, -Math.PI / 2, 0, false);
  path.lineTo(x + w, y + h - rr);
  path.absarc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2, false);
  path.lineTo(x + rr, y + h);
  path.absarc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI, false);
  path.lineTo(x, y + rr);
  path.absarc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5, false);
  return path;
}

// A flat rounded-rect slab lying in the XZ plane, bottom face at y = 0.
// Extruded shapes carry ad-hoc UVs, so only map-free materials go on these.
// `shadow` is opt-out: the interior films are sub-millimetre sheets whose
// shadows nobody can see, and each one is a whole extra shadow-map pass.
function slab(w, d, thickness, r, material, bevel = 0.003, shadow = true) {
  const shape = roundRect(new THREE.Shape(), w, d, r);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  return mesh;
}

// The display's UI, drawn once onto a canvas. The tap target sits directly
// over the macro node so the finale's touch lands on something real.
function uiTexture() {
  const cv = document.createElement('canvas');
  cv.width = 1024;
  cv.height = 496;
  const c = cv.getContext('2d');
  // A real screen is the brightest thing in the room. The first pass painted
  // this in near-blacks and the hero shot rendered as a blank slab.
  const g = c.createLinearGradient(0, 0, cv.width, cv.height);
  g.addColorStop(0, '#1b3f63');
  g.addColorStop(0.55, '#122b46');
  g.addColorStop(1, '#0d1c2e');
  c.fillStyle = g;
  c.fillRect(0, 0, cv.width, cv.height);

  const rr = (x, y, w, h, r) => {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  };

  // status bar
  c.fillStyle = '#dbe8f4';
  c.font = '600 24px "Segoe UI", sans-serif';
  c.fillText('9:41', 44, 48);
  for (let i = 0; i < 4; i++) {
    c.fillStyle = i < 3 ? '#dbe8f4' : '#6d8095';
    rr(cv.width - 152 + i * 18, 26, 10, 22, 3);
    c.fill();
  }

  // a big media card
  const card = c.createLinearGradient(44, 80, 400, 330);
  card.addColorStop(0, '#2f7f9c');
  card.addColorStop(1, '#1d3f66');
  c.fillStyle = card;
  rr(44, 78, 336, 252, 24);
  c.fill();
  c.fillStyle = '#c9f3ff';
  rr(72, 106, 108, 10, 5);
  c.fill();
  c.fillStyle = '#8fb4cc';
  for (let i = 0; i < 3; i++) {
    rr(72, 254 + i * 22, 244 - i * 62, 10, 5);
    c.fill();
  }

  // a row of tiles
  for (let i = 0; i < 3; i++) {
    c.fillStyle = ['#25455f', '#2b3a5c', '#213b52'][i];
    rr(44 + i * 116, 356, 100, 100, 22);
    c.fill();
    c.fillStyle = ['#63e6d3', '#c9aeff', '#ffc487'][i];
    rr(76 + i * 116, 388, 38, 38, 11);
    c.fill();
  }

  // text column beside the tap target
  c.fillStyle = '#7d9ab4';
  for (let i = 0; i < 5; i++) {
    rr(440, 112 + i * 36, 300 - (i % 2) * 92, 13, 6);
    c.fill();
  }

  // THE tap target — centred on the macro node (u 0.622, v 0.5)
  const bx = 0.622 * cv.width;
  const by = 0.5 * cv.height;
  c.fillStyle = '#2c6f88';
  c.beginPath();
  c.arc(bx, by, 64, 0, TAU);
  c.fill();
  c.strokeStyle = '#a8ecff';
  c.lineWidth = 5;
  c.beginPath();
  c.arc(bx, by, 64, 0, TAU);
  c.stroke();
  c.fillStyle = '#e4faff';
  c.font = '600 28px "Segoe UI", sans-serif';
  c.textAlign = 'center';
  c.fillText('TAP', bx, by + 10);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function buildTouchscreen({ scene }) {
  const group = new THREE.Group();
  scene.add(group);
  group.add(studioPlinth({ w: 3.5, h: PLINTH_H, d: 1.95 }));

  // everything that turns on the turntable
  const hero = new THREE.Group();
  hero.position.y = PLINTH_H;
  group.add(hero);

  // ==========================================================================
  //  MATERIALS
  // ==========================================================================
  // extruded slabs have ad-hoc UVs — every material here is deliberately
  // map-free so nothing samples garbage texels
  const rimMat = new THREE.MeshPhysicalMaterial({
    color: 0xb2b9c2,
    metalness: 1,
    roughness: 0.4,
  });
  const rimLinerMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.92 });
  const backMat = new THREE.MeshPhysicalMaterial({
    color: 0x101318,
    metalness: 0.1,
    roughness: 0.36,
    clearcoat: 0.5,
    clearcoatRoughness: 0.3,
  });
  // NOT opticalGlass: real transmission renders the emissive display behind it
  // as a milky frosted slab and blew a clipped highlight across the hero shot.
  // A phone's cover glass is meant to disappear — what you are supposed to see
  // is the screen underneath it, so plain transparent glass is the honest
  // material here (and skips a whole extra render pass).
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xcfe2f2,
    metalness: 0,
    // 0.06 put a blown-white specular streak on the glass in every macro shot
    roughness: 0.15,
    transparent: true,
    opacity: 0.11,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  const ocaMat = new THREE.MeshPhysicalMaterial({
    color: 0xffefd8,
    metalness: 0,
    roughness: 0.22,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
  });
  const dielMat = new THREE.MeshPhysicalMaterial({
    color: 0xa8c6ff,
    metalness: 0,
    roughness: 0.18,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  // ITO is invisible in reality; tinted here so the grid can be watched at all
  // (step 3's copy says so). Per-instance colour drives the drive-row sweep,
  // so these must stay on the diffuse path — no per-instance emissive exists.
  // Deliberately OPAQUE: ~1300 instances across two full-panel layers is the
  // scene's biggest raster bill, and transparent blending over that area
  // doubled frame time on the software renderer for no visual gain.
  const itoTxMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.52,
    metalness: 0,
  });
  const itoRxMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.52,
    metalness: 0,
  });
  const dispBodyMat = materials.polymer(0x0c0e12);
  const screenTex = uiTexture();
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0xffffff,
    emissiveMap: screenTex,
    emissiveIntensity: 1,
    roughness: 0.35,
    metalness: 0,
  });
  const pcbMat = new THREE.MeshStandardMaterial({ color: 0x1e3a2c, roughness: 0.62, metalness: 0.1 });
  const icMat = materials.polymer(0x15171b);
  const flexMat = new THREE.MeshStandardMaterial({
    color: 0xb07a2a,
    roughness: 0.55,
    metalness: 0.2,
    side: THREE.DoubleSide,
  });
  const goldMat = new THREE.MeshPhysicalMaterial({ color: 0xe6c887, metalness: 1, roughness: 0.3 });
  // conductive rubber: dark, but not so dark it becomes a silhouette blob
  const tipMat = new THREE.MeshPhysicalMaterial({ color: 0x41464e, metalness: 0.2, roughness: 0.78 });
  // roughness well above the preset default — at 0.3 the barrel blew out to a
  // pure-white streak in every macro shot, which is a clipped-highlight failure
  const barrelMat = materials.brushedSteel(0x7f8791);
  barrelMat.roughness = 0.64;
  const leadMat = materials.rubber(0x0b0c0e);

  const arcMat = () =>
    new THREE.MeshBasicMaterial({
      color: 0x9df0ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
  const stolenArcMat = () =>
    new THREE.MeshBasicMaterial({
      color: 0xffa03c,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

  // ==========================================================================
  //  BODY — midframe, back, inner liner
  // ==========================================================================
  const rimShape = roundRect(new THREE.Shape(), PANEL_L, PANEL_W, CORNER);
  rimShape.holes.push(
    roundRect(new THREE.Path(), PANEL_L - RIM_T * 2, PANEL_W - RIM_T * 2, CORNER - RIM_T),
  );
  const rimGeo = new THREE.ExtrudeGeometry(rimShape, {
    depth: Y_GLASS,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
    curveSegments: 12,
  });
  rimGeo.rotateX(-Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.castShadow = true;
  rim.receiveShadow = true;
  hero.add(rim);

  // dark liner just inside the rim: a bare metal inner wall would read as a
  // curved mirror once the stack is open
  const linerShape = roundRect(new THREE.Shape(), PANEL_L - RIM_T * 2, PANEL_W - RIM_T * 2, CORNER - RIM_T);
  linerShape.holes.push(
    roundRect(new THREE.Path(), PANEL_L - RIM_T * 2 - 0.012, PANEL_W - RIM_T * 2 - 0.012, CORNER - RIM_T),
  );
  const linerGeo = new THREE.ExtrudeGeometry(linerShape, {
    depth: Y_GLASS - 0.002,
    bevelEnabled: false,
    curveSegments: 12,
  });
  linerGeo.rotateX(-Math.PI / 2);
  hero.add(new THREE.Mesh(linerGeo, rimLinerMat));

  const backPlate = slab(PANEL_L - 0.01, PANEL_W - 0.01, T_BACK, CORNER - 0.005, backMat, 0.004);
  backPlate.position.y = Y_BACK;
  hero.add(backPlate);

  // side buttons — small product tells that keep the silhouette from reading
  // as a featureless brick
  for (const bz of [0.1, -0.16]) {
    const btn = beveledBox(0.012, 0.03, Math.abs(bz) < 0.12 ? 0.16 : 0.26, rimMat, 0.005);
    btn.position.set(PANEL_L / 2 - 0.002, Y_GLASS * 0.55, bz);
    hero.add(btn);
  }

  // ==========================================================================
  //  TOUCH CONTROLLER — PCB + IC + flex tail, sitting on the tub floor
  // ==========================================================================
  const ctrl = new THREE.Group();
  ctrl.position.y = Y_PCB;
  hero.add(ctrl);

  // Everything here lives against the +X rim, well clear of the macro node at
  // x = 0.35 — the first build put the flex tab straight through the middle of
  // the close-up.
  const CX = 0.98;
  const pcb = beveledBox(0.62, 0.014, 0.5, pcbMat, 0.006);
  pcb.position.set(CX, 0.007, -0.02);
  ctrl.add(pcb);

  const ic = beveledBox(0.26, 0.026, 0.26, icMat, 0.006);
  ic.position.set(CX, 0.027, -0.02);
  ctrl.add(ic);
  const icLid = beveledBox(0.19, 0.004, 0.19, materials.darkMetal(0x30343a), 0.002);
  icLid.position.set(CX, 0.042, -0.02);
  ctrl.add(icLid);
  for (let i = 0; i < 12; i++) {
    const pad = beveledBox(0.012, 0.004, 0.03, goldMat, 0.001);
    pad.position.set(CX - 0.13 + (i % 6) * 0.052, 0.016, -0.02 + (i < 6 ? -0.15 : 0.15));
    ctrl.add(pad);
  }
  for (const [px, pz] of [
    [CX - 0.24, 0.18],
    [CX - 0.21, 0.18],
    [CX + 0.22, -0.19],
    [CX + 0.25, -0.19],
  ]) {
    const cap = beveledBox(0.022, 0.018, 0.036, materials.darkMetal(0x2b2f35), 0.004);
    cap.position.set(px, 0.016, pz);
    ctrl.add(cap);
  }

  // flex tail: out of the PCB toward the rim, up its inside face, then back in
  // as a bond tab at the height the sensor films sit at when the stack is shut
  const flexRun = beveledBox(0.22, 0.006, 0.22, flexMat, 0.002);
  flexRun.position.set(1.35, 0.012, -0.02);
  ctrl.add(flexRun);
  const flexRise = beveledBox(0.006, 0.075, 0.22, flexMat, 0.002);
  flexRise.position.set(1.44, 0.05, -0.02);
  ctrl.add(flexRise);
  const flexTab = beveledBox(0.22, 0.006, 0.22, flexMat, 0.002);
  flexTab.position.set(1.32, Y_TX - Y_PCB + 0.002, -0.02);
  ctrl.add(flexTab);
  // two dozen small parts living inside a closed body — none of them can cast
  // a shadow anything sees, and each one is another shadow-map draw
  ctrl.traverse((o) => {
    o.castShadow = false;
    o.receiveShadow = false;
  });

  // ==========================================================================
  //  LAYERS — each in its own lift group
  // ==========================================================================
  function layer(baseY, lift) {
    const g = new THREE.Group();
    g.position.y = baseY;
    g.userData.baseY = baseY;
    g.userData.lift = lift;
    hero.add(g);
    return g;
  }

  const dispGroup = layer(Y_DISP, L_DISP);
  const dispBody = slab(PANEL_L - 0.075, PANEL_W - 0.075, T_DISP, CORNER - 0.038, dispBodyMat, 0.003, false);
  dispGroup.add(dispBody);
  const screenW = PANEL_L - 0.09;
  const screenD = PANEL_W - 0.09;
  const screenGeo = new THREE.PlaneGeometry(screenW, screenD);
  screenGeo.rotateX(-Math.PI / 2);
  const screen = new THREE.Mesh(screenGeo, screenMat);
  // 0.001 above the panel body z-fought with it and the screen rendered as a
  // dead grey slab in the hero shot
  screen.position.y = T_DISP + 0.005;
  dispGroup.add(screen);

  // tap feedback: a filled disc + an expanding ring, both riding the display
  const tapGlowMat = new THREE.MeshBasicMaterial({
    color: ACCENT,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const tapGeo = new THREE.CircleGeometry(0.075, 28);
  tapGeo.rotateX(-Math.PI / 2);
  const tapGlow = new THREE.Mesh(tapGeo, tapGlowMat);
  // ABOVE the screen plane (which sits at T_DISP + 0.005) — under it, the tap
  // response was drawn but hidden inside the panel
  tapGlow.position.set(FOCUS_X, T_DISP + 0.007, FOCUS_Z);
  dispGroup.add(tapGlow);
  const ringGeo = new THREE.RingGeometry(0.85, 1, 40);
  ringGeo.rotateX(-Math.PI / 2);
  const rippleMat = new THREE.MeshBasicMaterial({
    color: ACCENT,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const ripple = new THREE.Mesh(ringGeo, rippleMat);
  ripple.position.set(FOCUS_X, T_DISP + 0.008, FOCUS_Z);
  dispGroup.add(ripple);

  const oca2Group = layer(Y_OCA2, L_OCA2);
  const oca2Slab = slab(PANEL_L - 0.06, PANEL_W - 0.06, T_OCA, CORNER - 0.03, ocaMat, 0.002, false);
  oca2Group.add(oca2Slab);

  const txGroup = layer(Y_TX, L_TX);
  const dielGroup = layer(Y_DIEL, L_DIEL);
  const dielSlab = slab(PANEL_L - 0.06, PANEL_W - 0.06, T_ITO, CORNER - 0.03, dielMat, 0.002, false);
  dielGroup.add(dielSlab);
  const rxGroup = layer(Y_RX, L_RX);
  const oca1Group = layer(Y_OCA1, L_OCA1);
  const oca1Slab = slab(PANEL_L - 0.06, PANEL_W - 0.06, T_OCA, CORNER - 0.03, ocaMat, 0.002, false);
  oca1Group.add(oca1Slab);

  const glassGroup = layer(Y_GLASS, L_GLASS);
  const coverGlass = slab(PANEL_L, PANEL_W, T_GLASS, CORNER, glassMat, 0.004, false);
  coverGlass.renderOrder = 8;
  glassGroup.add(coverGlass);

  const layers = [dispGroup, oca2Group, txGroup, dielGroup, rxGroup, oca1Group, glassGroup];

  // --- the ITO pattern ------------------------------------------------------
  // Diamonds are squares rotated 45 degrees; a drive row is a chain of them
  // running along X, a sense column a chain running along Z, and the two
  // chains interleave on a checkerboard so every crossing has a row diamond
  // and a column diamond sitting edge to edge.
  const dGeo = new THREE.BoxGeometry(DIAG / Math.SQRT2, T_ETCH, DIAG / Math.SQRT2);
  dGeo.rotateY(Math.PI / 4);
  const neckX = new THREE.BoxGeometry(0.018, T_ETCH * 0.8, 0.014);
  const neckZ = new THREE.BoxGeometry(0.014, T_ETCH * 0.8, 0.018);

  const m4 = new THREE.Matrix4();
  const txDiamonds = new THREE.InstancedMesh(dGeo, itoTxMat, NCOL * NROW);
  txDiamonds.renderOrder = 2;
  const txNecks = new THREE.InstancedMesh(neckX, itoTxMat, (NCOL - 1) * NROW);
  txNecks.renderOrder = 2;
  let di = 0;
  let ni = 0;
  for (let k = 0; k < NROW; k++) {
    for (let j = 0; j < NCOL; j++) {
      m4.makeTranslation(AX0 + j * P, T_ETCH / 2, AZ0 + k * P);
      txDiamonds.setMatrixAt(di++, m4);
      if (j < NCOL - 1) {
        m4.makeTranslation(AX0 + (j + 0.5) * P, T_ETCH / 2, AZ0 + k * P);
        txNecks.setMatrixAt(ni++, m4);
      }
    }
  }
  txDiamonds.instanceMatrix.needsUpdate = true;
  txNecks.instanceMatrix.needsUpdate = true;
  txGroup.add(txDiamonds, txNecks);

  const RXC = NCOL - 1; // sense columns sit between the drive diamonds
  const RXR = NROW - 1;
  const rxDiamonds = new THREE.InstancedMesh(dGeo, itoRxMat, RXC * RXR);
  rxDiamonds.renderOrder = 3;
  const rxNecks = new THREE.InstancedMesh(neckZ, itoRxMat, RXC * (RXR - 1));
  rxNecks.renderOrder = 3;
  di = 0;
  ni = 0;
  for (let j = 0; j < RXC; j++) {
    for (let k = 0; k < RXR; k++) {
      m4.makeTranslation(AX0 + (j + 0.5) * P, T_ETCH / 2, AZ0 + (k + 0.5) * P);
      rxDiamonds.setMatrixAt(di++, m4);
      if (k < RXR - 1) {
        m4.makeTranslation(AX0 + (j + 0.5) * P, T_ETCH / 2, AZ0 + (k + 1) * P);
        rxNecks.setMatrixAt(ni++, m4);
      }
    }
  }
  rxDiamonds.instanceMatrix.needsUpdate = true;
  rxNecks.instanceMatrix.needsUpdate = true;
  rxGroup.add(rxDiamonds, rxNecks);

  const _col = new THREE.Color();
  // Two hues so a drive row and a sense column can be told apart at a glance,
  // but kept dark and desaturated — at full saturation the panel read as a
  // candy-coloured tiled floor rather than a conductive film.
  const TX_BASE = new THREE.Color(0x1d4a56);
  const TX_HOT = new THREE.Color(0x86dcef);
  const RX_BASE = new THREE.Color(0x363258);
  const RX_HOT = new THREE.Color(0x8b81c4);
  for (let i = 0; i < txNecks.count; i++) txNecks.setColorAt(i, TX_BASE);
  txNecks.instanceColor.needsUpdate = true;
  for (let i = 0; i < rxNecks.count; i++) rxNecks.setColorAt(i, RX_BASE);
  rxNecks.instanceColor.needsUpdate = true;

  // --- the capacitance map --------------------------------------------------
  // One additive disc per node: black reads as nothing at all, so the map only
  // exists where capacitance actually went missing.
  const nodeMatl = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const nodeGeo = new THREE.CircleGeometry(0.046, 10);
  nodeGeo.rotateX(-Math.PI / 2);
  const nodeMesh = new THREE.InstancedMesh(nodeGeo, nodeMatl, NCOL * NROW);
  nodeMesh.renderOrder = 6;
  nodeMesh.frustumCulled = false;
  rxGroup.add(nodeMesh);

  // interpolated-centre marker: crosshair + ring, sitting on the glass surface
  const markGroup = new THREE.Group();
  markGroup.position.y = Y_GLASS + T_GLASS + 0.008;
  hero.add(markGroup);
  const markMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
  });
  const markRingGeo = new THREE.RingGeometry(0.054, 0.062, 40);
  markRingGeo.rotateX(-Math.PI / 2);
  markGroup.add(new THREE.Mesh(markRingGeo, markMat));
  for (const rot of [0, Math.PI / 2]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.002, 0.005), markMat);
    bar.rotation.y = rot;
    markGroup.add(bar);
  }
  markGroup.renderOrder = 9;

  // ==========================================================================
  //  THE FIELD — fringing arcs over a 3x3 patch around the macro node
  // ==========================================================================
  const fieldGroup = new THREE.Group();
  fieldGroup.position.y = Y_TX;
  hero.add(fieldGroup);

  const ARCS_PER = 4;
  const bundles = [];
  const tipContact = new THREE.Vector3(FOCUS_X, Y_GLASS + T_GLASS + 0.006 - Y_TX, FOCUS_Z);
  const dDir = new THREE.Vector3(1, 0, 1).normalize();
  const dPerp = new THREE.Vector3(1, 0, -1).normalize();

  for (let dj = -1; dj <= 1; dj++) {
    for (let dk = -1; dk <= 1; dk++) {
      const cx = FOCUS_X + dj * P;
      const cz = FOCUS_Z + dk * P;
      const rxc = new THREE.Vector3(cx + P / 2, Y_RX - Y_TX + T_ETCH / 2, cz + P / 2);
      const dist = Math.hypot(cx - FOCUS_X, cz - FOCUS_Z);
      const weight = Math.exp(-(dist * dist) / (2 * 0.088 * 0.088));
      const normalMat = arcMat();
      const stolenMat = stolenArcMat();
      const curves = [];
      const stolenCurves = [];
      const stolenMeshes = [];
      for (let a = 0; a < ARCS_PER; a++) {
        const off = (a / (ARCS_PER - 1) - 0.5) * 0.085;
        // Launch from the FAR edge of the drive diamond and land on the far
        // edge of the sense diamond: field lines leave the whole electrode, and
        // the extra span is what makes these read as arcs instead of hairpins.
        const start = new THREE.Vector3(cx, T_ETCH / 2, cz)
          .addScaledVector(dDir, -0.03)
          .addScaledVector(dPerp, off);
        const end = rxc.clone().addScaledVector(dDir, 0.03).addScaledVector(dPerp, off);
        // A quadratic Bezier only reaches HALF its control-point offset, so
        // this is 2x the height wanted: the arc's crown lands just proud of the
        // cover glass, which is exactly why a conductor resting ON the glass
        // can reach the field at all.
        const lift = 0.082 - Math.abs(off) * 0.36;
        const apex = start
          .clone()
          .add(end)
          .multiplyScalar(0.5)
          .add(new THREE.Vector3(0, lift, 0));
        const curve = new THREE.QuadraticBezierCurve3(start, apex, end);
        curves.push(curve);
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.005, 6, false), normalMat);
        fieldGroup.add(tube);

        // stolen path: the same charge leaves the drive electrode and lands on
        // the grounded tip instead of ever reaching the sense electrode. It
        // terminates on the FLANK of the tip, not underneath it — ending at the
        // contact point buried every diverted arc under the opaque dome.
        const away = new THREE.Vector3(cx - FOCUS_X, 0, cz - FOCUS_Z);
        if (away.lengthSq() < 1e-9) away.copy(dDir);
        away.normalize();
        const sEnd = new THREE.Vector3(FOCUS_X, 0, FOCUS_Z)
          .addScaledVector(away, 0.08)
          .addScaledVector(dPerp, off * 0.6);
        sEnd.y = Y_GLASS + T_GLASS - Y_TX + 0.032;
        const sApex = start
          .clone()
          .add(sEnd)
          .multiplyScalar(0.5)
          .add(new THREE.Vector3(0, 0.052, 0));
        const sCurve = new THREE.QuadraticBezierCurve3(start, sApex, sEnd);
        stolenCurves.push(sCurve);
        const sTube = new THREE.Mesh(
          new THREE.TubeGeometry(sCurve, 18, 0.005, 6, false),
          stolenMat,
        );
        sTube.visible = false;
        stolenMeshes.push(sTube);
        fieldGroup.add(sTube);
      }
      bundles.push({ normalMat, stolenMat, curves, stolenCurves, stolenMeshes, weight });
    }
  }

  // charge packets riding the arcs — 3 per bundle, position lerped between the
  // normal and stolen curve so they visibly change destination
  const DOTS_PER = 3;
  const dotGeo = new THREE.SphereGeometry(0.0075, 10, 8);
  const dotMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const dots = new THREE.InstancedMesh(dotGeo, dotMat, bundles.length * DOTS_PER);
  dots.renderOrder = 7;
  fieldGroup.add(dots);
  const DOT_COLD = new THREE.Color(0x6fd8f0);
  const DOT_HOT = new THREE.Color(0xffb267);
  fieldGroup.visible = false;

  // ==========================================================================
  //  GROUNDED TEST TIP
  // ==========================================================================
  const probe = new THREE.Group();
  probe.position.set(FOCUS_X, GLASS_TOP - PLINTH_H, FOCUS_Z);
  probe.rotation.set(-0.2, 0, -0.3);
  hero.add(probe);

  // A machined conductive tip, not an egg: domed contact face flaring to a
  // 9mm barrel — the size of the contact patch a fingertip flattens to.
  const tip = lathe(
    [
      [0, 0],
      [0.034, 0.005],
      [0.06, 0.016],
      [0.079, 0.033],
      [0.09, 0.056],
      [0.09, 0.08],
      [0.074, 0.094],
      [0.064, 0.098],
    ],
    tipMat,
    36,
  );
  tip.castShadow = true;
  probe.add(tip);
  const ferrule = rod(0.063, 0.05, materials.brushedSteel(0x9aa2ac), 18);
  ferrule.position.y = 0.094;
  ferrule.castShadow = false;
  probe.add(ferrule);
  const barrel = rod(0.052, 0.86, barrelMat, 18);
  barrel.position.y = 0.138;
  probe.add(barrel);
  const knurl = rod(0.058, 0.14, materials.darkMetal(0x2b2f36), 18);
  knurl.position.y = 0.42;
  knurl.castShadow = false;
  probe.add(knurl);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 10), barrelMat);
  cap.position.y = 0.992;
  cap.scale.y = 0.7;
  probe.add(cap);

  // Routed steeply UP and back out of frame. An earlier version trailed down
  // to the plinth, and on the finale's turntable lap it swept right across the
  // panel like a dropped cable.
  const lead = tubeAlong(
    [
      [0, 0.96, 0],
      [-0.05, 1.2, -0.16],
      [-0.16, 1.56, -0.42],
      [-0.33, 1.96, -0.72],
      [-0.5, 2.36, -1.02],
    ],
    0.026,
    leadMat,
    { tubularSegments: 40, radialSegments: 8 },
  );
  lead.castShadow = false;
  probe.add(lead);
  const leadCurve = lead.userData.curve;

  const DRAIN_N = 7;
  const drainMat = new THREE.MeshBasicMaterial({
    color: 0xffb267,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const drain = new THREE.InstancedMesh(new THREE.SphereGeometry(0.016, 10, 8), drainMat, DRAIN_N);
  drain.renderOrder = 7;
  probe.add(drain);

  // A dry glove: the finale's whole point is that this millimetre of fabric
  // holds the conductor off the fringing field, so it has to be a real object
  // that really slides over the tip — asserting it in copy is not enough.
  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x4a525f,
    roughness: 0.97,
    metalness: 0,
    normalMap: stippleNormalMap(),
  });
  gloveMat.normalScale = new THREE.Vector2(0.6, 0.6);
  const glove = lathe(
    [
      [0, 0],
      [0.048, 0.007],
      [0.082, 0.022],
      [0.106, 0.046],
      [0.118, 0.074],
      [0.118, 0.104],
      [0.103, 0.126],
      [0.094, 0.2],
      [0.09, 0.33],
    ],
    gloveMat,
    36,
  );
  glove.castShadow = true;
  glove.visible = false;
  probe.add(glove);

  probe.visible = false;

  // ==========================================================================
  //  STATE + apply()
  // ==========================================================================
  const S = { ...DEFAULTS };
  const _m = new THREE.Matrix4();
  const _v = new THREE.Vector3();
  const _drainHot = new THREE.Color(0xffb267);
  let capLabel = null;
  let lastCap = '';

  function apply() {
    hero.rotation.y = S.spin;

    // --- layer explosion ---------------------------------------------------
    const o = smooth(clamp01(S.open));
    for (const g of layers) g.position.y = g.userData.baseY + g.userData.lift * o;
    fieldGroup.position.y = Y_TX + L_TX * o;
    markGroup.position.y = Y_GLASS + T_GLASS + 0.008 + L_GLASS * o;

    // --- solid product vs see-through ---------------------------------------
    const gh = clamp01(S.ghost);
    const open = gh > 0.5;
    txGroup.visible = open;
    rxGroup.visible = open;
    // The adhesive and dielectric films exist to be counted in the exploded
    // stack; closed, they are three near-invisible full-panel transparent
    // layers the macro shots pay full raster price for. Toggle the MESHES, not
    // their groups — the groups carry those layers' callouts, and hiding a
    // group takes its label with it.
    const films = open && o > 0.004;
    dielSlab.visible = films;
    oca1Slab.visible = films;
    oca2Slab.visible = films;
    ctrl.visible = open;
    screenMat.emissiveIntensity = open ? 0.24 : 1.35;

    // --- the capacitance map -------------------------------------------------
    // A dry glove does not weaken the signal, it erases it: the conductor is
    // held clear of the fringing field and the node reads its baseline.
    const gl = clamp01(S.glove);
    const effTouch = clamp01(S.touch) * (1 - gl);
    const sig = 0.072;
    const scanRow = S.scanning > 0.5 ? clamp01(S.scanPhase) * NROW : NROW;
    const activeRow = Math.min(NROW - 1, Math.floor(scanRow));
    let wSum = 0;
    let wx = 0;
    let wz = 0;
    let i = 0;
    for (let k = 0; k < NROW; k++) {
      const rowRead = S.scanning > 0.5 ? k <= scanRow : true;
      for (let j = 0; j < NCOL; j++) {
        const nx = AX0 + j * P;
        const nz = AZ0 + k * P;
        const d2 = (nx - S.tx) * (nx - S.tx) + (nz - S.tz) * (nz - S.tz);
        const v = rowRead ? effTouch * Math.exp(-d2 / (2 * sig * sig)) : 0;
        // white-hot core falling off through cyan — at the first pass's
        // brightness the blob read as a smudge rather than a signal
        _col.setRGB(0.6 * v * v * v, 0.95 * v * v, 1.1 * v);
        nodeMesh.setColorAt(i, _col);
        // a cold node is scaled to nothing rather than drawn black: 350-odd
        // full-size additive discs cost real raster time and show nothing
        const ns = v > 0.004 ? Math.min(1, 0.45 + v * 0.55) : 0;
        _m.makeScale(ns, ns, ns);
        _m.setPosition(nx, T_ETCH + 0.005, nz);
        nodeMesh.setMatrixAt(i, _m);
        // drive rows: the row being pulsed right now lights up
        const hot = S.scanning > 0.5 && k === activeRow ? 1 : 0;
        _col.copy(TX_BASE).lerp(TX_HOT, hot);
        txDiamonds.setColorAt(i, _col);
        wSum += v;
        wx += v * nx;
        wz += v * nz;
        i++;
      }
    }
    nodeMesh.instanceColor.needsUpdate = true;
    nodeMesh.instanceMatrix.needsUpdate = true;
    txDiamonds.instanceColor.needsUpdate = true;
    // every sense column is sampled at once, so they all shimmer together
    const rxHot = S.scanning > 0.5 ? 0.35 + 0.35 * Math.sin(clamp01(S.scanPhase) * TAU * NROW) : 0;
    _col.copy(RX_BASE).lerp(RX_HOT, rxHot);
    for (let n = 0; n < rxDiamonds.count; n++) rxDiamonds.setColorAt(n, _col);
    rxDiamonds.instanceColor.needsUpdate = true;

    // --- interpolated centre --------------------------------------------------
    const showMark = clamp01(S.centroid);
    markMat.opacity = showMark * 0.85;
    markGroup.visible = showMark > 0.01;
    if (wSum > 1e-4) markGroup.position.set(wx / wSum, markGroup.position.y, wz / wSum);

    // --- the grounded tip -----------------------------------------------------
    const on = S.probeOn > 0.5;
    probe.visible = on;
    const press = clamp01(S.press);
    probe.position.y = GLASS_TOP - PLINTH_H + 0.3 * (1 - press);
    // the glove slides down the probe axis onto the tip
    glove.visible = on && gl > 0.01;
    glove.position.y = 0.34 * (1 - smooth(gl));
    // the field only diverts once the tip is within a hair of the glass
    const steal = smooth(clamp01((press - 0.62) / 0.38));

    // --- field arcs + charge packets -------------------------------------------
    // The drive line is PULSED, not held — the field builds and collapses with
    // every burst. Three whole pulses per flow lap keeps the wrap seamless.
    const pulse = 0.62 + 0.38 * Math.cos(S.flow * TAU * 3);
    const av = clamp01(S.arcs) * pulse;
    fieldGroup.visible = av > 0.01;
    if (av > 0.01) {
      let idx = 0;
      for (const b of bundles) {
        // Neighbouring crossings fade back hard: 9 bundles at equal strength
        // read as a thicket of white pins rather than one legible crossing.
        const vis = 0.16 + 0.84 * b.weight;
        const bs = steal * b.weight;
        b.normalMat.opacity = av * vis * (1 - bs * 0.92);
        b.stolenMat.opacity = av * vis * bs;
        const showStolen = b.stolenMat.opacity > 0.01;
        for (const sm of b.stolenMeshes) sm.visible = showStolen;
        for (let a = 0; a < DOTS_PER; a++) {
          const t = (S.flow + a / DOTS_PER) % 1;
          const pn = b.curves[1].getPoint(t);
          const ps = b.stolenCurves[1].getPoint(t);
          _v.copy(pn).lerp(ps, bs);
          _m.makeTranslation(_v.x, _v.y, _v.z);
          dots.setMatrixAt(idx, _m);
          _col.copy(DOT_COLD).lerp(DOT_HOT, bs);
          _col.multiplyScalar(av);
          dots.setColorAt(idx, _col);
          idx++;
        }
      }
      dots.instanceMatrix.needsUpdate = true;
      dots.instanceColor.needsUpdate = true;
    }

    // charge draining down the ground lead — the half of the story a hand
    // would otherwise hide: the field has somewhere to go
    for (let n = 0; n < DRAIN_N; n++) {
      const t = clamp01((S.flow * 1.4 + n / DRAIN_N) % 1);
      const pt = leadCurve.getPointAt(t);
      _m.makeTranslation(pt.x, pt.y, pt.z);
      drain.setMatrixAt(n, _m);
      _col.setScalar(0).lerp(_drainHot, av * steal * (1 - t * 0.5));
      drain.setColorAt(n, _col);
    }
    drain.instanceMatrix.needsUpdate = true;
    drain.instanceColor.needsUpdate = true;

    // --- display ---------------------------------------------------------------
    tapGlowMat.opacity = (open ? 0 : 1) * effTouch * 0.72;
    const rp = clamp01(S.ripple);
    rippleMat.opacity = rp > 0.001 ? (1 - rp) * 0.7 * (1 - gl) : 0;
    const rs = 0.06 + rp * 0.34;
    ripple.scale.set(rs, 1, rs);

    // live readout, but only written when the digits actually change — a
    // textContent write every frame forces a full document relayout under the
    // callout declutter pass
    if (capLabel) {
      const txt = `Coupling ${(BASE_PF - DROP_PF * steal).toFixed(2)} pF`;
      if (txt !== lastCap) {
        lastCap = txt;
        capLabel.setText(txt);
      }
    }
  }

  function pin(o = {}) {
    Object.assign(S, DEFAULTS, o);
    apply();
  }
  function set(o = {}) {
    Object.assign(S, o);
    apply();
  }

  // ONE seamless lap: sealed -> lifted apart -> held -> back together.
  function setReveal(u) {
    const uu = clamp01(u);
    let open;
    if (uu < 0.3) open = smooth(win(uu, 0, 0.3));
    else if (uu < 0.7) open = 1;
    else open = 1 - smooth(win(uu, 0.7, 1));
    set({ open, spin: Math.sin(uu * TAU) * 0.1 });
  }

  // ONE seamless lap for the finale: the bare tip taps and the screen answers,
  // a dry glove slides on, the SAME tap happens again and nothing registers,
  // then the glove comes off. u=0 and u=1 are identical — parked and bare.
  function setFinale(u) {
    const uu = clamp01(u);
    const tap = (a, b) =>
      uu >= a && uu <= b ? 0.5 - 0.5 * Math.cos(((uu - a) / (b - a)) * TAU) : 0;
    // timed so the two review poses land ON the beats: 30% = bare tip down and
    // the screen answering, 60% = gloved tip down and nothing happening
    const press = tap(0.08, 0.4) + tap(0.51, 0.81);
    const glove = win(uu, 0.42, 0.49) * (1 - win(uu, 0.88, 0.96));
    set({
      press,
      glove,
      touch: press * press,
      // the ripple only runs out when charge actually moved
      ripple: win(uu, 0.24, 0.5),
      spin: uu * TAU,
    });
  }

  // ==========================================================================
  //  CALLOUTS
  // ==========================================================================
  const labels = calloutSets(['exterior', 'stack', 'grid', 'node', 'touch', 'scan', 'centroid']);

  labels.add('exterior', glassGroup, 'Cover glass', [0.55, T_GLASS, 0.52], 55, 92);
  labels.add('exterior', dispGroup, 'Display', [0.05, T_DISP, -0.3], 105, 70);
  labels.add('exterior', hero, 'Aluminium midframe', [1.3, Y_GLASS * 0.5, 0.6], -40, 96);

  labels.add('stack', glassGroup, 'Cover glass — 0.6 mm', [0.75, T_GLASS, 0.3], 45, 96);
  labels.add('stack', oca1Group, 'Optically clear adhesive', [1.05, T_OCA, 0.1], 20, 92);
  labels.add('stack', rxGroup, 'Sense layer — columns', [0.5, T_ITO, 0.45], 35, 92);
  labels.add('stack', dielGroup, 'Dielectric', [1.15, T_ITO, -0.1], 12, 78);
  labels.add('stack', txGroup, 'Drive layer — rows', [0.5, T_ITO, 0.45], -35, 92);
  labels.add('stack', dispGroup, 'Display panel', [0.9, T_DISP, 0.4], -30, 88);
  labels.add('stack', ctrl, 'Touch controller', [0.98, 0.05, -0.02], -65, 92);

  labels.add('grid', txGroup, 'Drive row', [0.62, T_ITO, AZ0 + 4 * P], -35, 88);
  labels.add('grid', rxGroup, 'Sense column', [0.35, T_ITO, 0.35], 40, 90);
  labels.add('grid', rxGroup, 'ITO diamond — 5 mm pitch', [0.05, T_ITO, -0.15], 80, 96);

  labels.add('node', txGroup, 'Drive electrode', [FOCUS_X - 0.02, T_ITO, FOCUS_Z - 0.04], -60, 86);
  labels.add('node', rxGroup, 'Sense electrode', [FOCUS_X + 0.05, T_ITO, FOCUS_Z + 0.05], 20, 88);
  labels.add('node', fieldGroup, 'Fringing field', [FOCUS_X + 0.02, 0.07, FOCUS_Z + 0.02], 70, 78);

  labels.add('touch', probe, 'Grounded test tip', [0.02, 0.16, 0], 35, 92);
  labels.add('touch', fieldGroup, 'Field diverted to ground', [FOCUS_X - 0.04, 0.05, FOCUS_Z - 0.04], -55, 100);
  capLabel = labels.add('touch', txGroup, 'Coupling 3.10 pF', [FOCUS_X + 0.12, T_ITO, FOCUS_Z + 0.1], 15, 90);

  labels.add('scan', txGroup, 'Active drive row', [-0.6, T_ITO, AZ0 + 6 * P], -30, 92);
  labels.add('scan', rxGroup, 'All columns sampled at once', [0.1, T_ITO, 0.5], 55, 104);
  labels.add('scan', ctrl, 'Touch controller', [0.98, 0.05, -0.02], -60, 88);

  labels.add('centroid', rxGroup, 'Nodes that dipped', [FOCUS_X - 0.06, T_ITO, FOCUS_Z + 0.14], -35, 96);
  labels.add('centroid', markGroup, 'Interpolated centre', [0, 0, 0], 40, 96);

  // ==========================================================================
  pin({});

  return {
    group,
    set,
    pin,
    setReveal,
    setFinale,
    setLabels: labels.setLabels,
    parts: {
      hero,
      glassGroup,
      txGroup,
      rxGroup,
      dispGroup,
      probe,
      glove,
      fieldGroup,
      markGroup,
      ctrl,
    },
  };
}
