import * as THREE from 'three';
import { materials, rod, box, disc } from '../../framework/parts.js';
import { beveledBox, lathe, tubeAlong } from '../../framework/geometry.js';
import { callout } from '../../framework/labels.js';

// A Cherry MX-style mechanical keyboard switch, product-shot staged upright.
//
// PROPORTIONS (Cherry MX spec, scaled to world units):
//   Housing: 15.6 × 15.6 × 11.9 mm → 0.78 × 0.78 × 0.595 world
//   Total height with keycap: ~2.1 world units, standing on y=0
//   Stem travel: 4 mm → 0.20 world units
//   Actuation point: ~2 mm → 0.10 world units from top of travel
//   PCB mount pins at bottom
//
// TWO scalars drive the model:
//   `press`  (0–1): stem travel — 0 = fully up, 1 = bottomed out
//   `reveal` (0–1): housing transparency — 0 = solid opaque, 1 = x-ray view
//
// Story shape (zoom-in reveal):
//   Step 1: Full keycap + solid housing  → solid product shot
//   Step 2: Remove keycap, ghost housing → anatomy callouts
//   Step 3: Spring compression + actuation → contacts close at 0.5 press
//   Step 4: Click mechanism detail → click jacket snaps
//   Step 5: Contact & reset
//   Step 6: Free orbit, full run

const TAU = Math.PI * 2;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const lerp = (a, b, t) => a + (b - a) * clamp01(t);

// ─── scale constants (world units) ──────────────────────────────────────────
const HW = 0.39;        // housing half-width (square footprint)
const HTOTAL = 0.595;   // housing height (bottom to top rim)
const BASE_Y = 0.0;     // housing bottom sits at y=0

const STEM_TRAVEL = 0.20;         // 4 mm total travel
const ACTUATION_FRAC = 0.50;      // contacts close at 50% travel (2 mm)
const CLICK_FRAC = 0.48;          // click jacket snaps at 48% (slightly before actuation)

// spring geometry
const SPRING_R = 0.08;
const SPRING_TURNS = 8;
const SPRING_WIRE = 0.012;
const SPRING_BOTTOM_Y = BASE_Y + 0.06;  // rests on bottom of housing
const SPRING_TOP_Y = BASE_Y + HTOTAL * 0.65; // top at rest
const SPRING_FREE_LEN = SPRING_TOP_Y - SPRING_BOTTOM_Y;
const SPRING_COMP_LEN = SPRING_FREE_LEN * 0.45; // compressed height

// stem geometry
const STEM_CROSS_W = 0.09;  // cruciform cross-arm width
const STEM_CROSS_H = 0.18;  // cruciform cross-arm height (the + slot)
const STEM_BODY_R = 0.14;   // cylindrical stem body radius
const STEM_REST_Y = BASE_Y + HTOTAL * 0.52; // stem bottom at rest
const STEM_TOP_Y = BASE_Y + HTOTAL + 0.04;  // stem pole above housing

// keycap
const KEYCAP_W = 0.72;
const KEYCAP_H = 0.28;
const KEYCAP_Y = STEM_TOP_Y + 0.01; // keycap sits on stem top

// contact leaf
const LEAF_Y = BASE_Y + 0.08;
const CONTACT_GAP = 0.032;  // gap between leaves at rest

// ─── materials ───────────────────────────────────────────────────────────────
function housingSolidMat() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x1a1c22,
    roughness: 0.55,
    metalness: 0.05,
  });
}

function housingGhostMat() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x7ec8e3,
    roughness: 0.3,
    metalness: 0.0,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function stemMat() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x1c6fa6,   // Cherry MX Blue: the iconic blue stem
    roughness: 0.52,
    metalness: 0.04,
  });
}

function clickJacketMat() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x2285c4,
    roughness: 0.48,
    metalness: 0.04,
  });
}

function springMat() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xd4d0b8,
    roughness: 0.45,
    metalness: 0.85,
  });
}

function contactMat(active = false) {
  return new THREE.MeshPhysicalMaterial({
    color: active ? 0xffe066 : 0xd4a843,
    metalness: 0.95,
    roughness: 0.28,
    emissive: active ? 0xffd700 : 0x000000,
    emissiveIntensity: active ? 0.6 : 0,
  });
}

function pcbMat() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x1a5c2e,
    roughness: 0.85,
    metalness: 0.05,
  });
}

function keycapMat() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xdde0e8,
    roughness: 0.62,
    metalness: 0.0,
  });
}

// ─── helical spring mesh ────────────────────────────────────────────────────
function makeSpring(bottomY, topY, radius, turns, wire, mat) {
  const pts = [];
  const segs = turns * 24;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const angle = t * turns * TAU;
    const y = bottomY + t * (topY - bottomY);
    pts.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, segs * 2, wire, 8, false);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

// ─── keycap (sculpted DSA-profile) ─────────────────────────────────────────
function makeKeycap(mat) {
  // DSA profile: slight dish on top, uniform height on all sides
  const profile = [
    [0.0,  0.0],   // center bottom of top surface
    [0.28, 0.0],
    [0.34, -0.03],
    [0.36, -0.16], // side wall
    [0.36, -0.28], // bottom rim
    [0.32, -0.30],
    [0.0,  -0.30],
  ];
  // Build as an extruded square with beveled corners via lathe + box
  const g = new THREE.Group();

  // body
  const body = beveledBox(KEYCAP_W, KEYCAP_H, KEYCAP_W, mat, 0.04);
  body.position.y = KEYCAP_H / 2;
  g.add(body);

  // top-face concave dish (subtle indent, painted slightly darker)
  const dishMat = new THREE.MeshPhysicalMaterial({
    color: 0xc8cdd6,
    roughness: 0.72,
    metalness: 0.0,
  });
  const dish = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.003, 32),
    dishMat,
  );
  dish.position.y = KEYCAP_H + 0.001;
  g.add(dish);

  return g;
}

// ─── housing shell (top + bottom, cross-section-able) ──────────────────────
function makeHousing(solidMat, ghostMat) {
  const g = new THREE.Group();

  // top housing — taller portion holding the stem
  const topH = HTOTAL * 0.62;
  const topHousing = beveledBox(HW * 2, topH, HW * 2, solidMat, 0.025);
  topHousing.position.y = BASE_Y + HTOTAL - topH / 2;
  g.add(topHousing);

  // bottom housing — squatter base with PCB pins
  const botH = HTOTAL * 0.38;
  const botHousing = beveledBox(HW * 2, botH, HW * 2, solidMat, 0.025);
  botHousing.position.y = BASE_Y + botH / 2;
  g.add(botHousing);

  // stem opening on top face (the cruciform hole)
  // Represented by a slightly smaller cross on top surface, slightly inset
  const slotMat = new THREE.MeshPhysicalMaterial({ color: 0x0a0b0d, roughness: 0.9 });
  const slotH = beveledBox(STEM_CROSS_W, 0.025, STEM_CROSS_H, slotMat, 0.005);
  slotH.position.y = BASE_Y + HTOTAL + 0.001;
  g.add(slotH);
  const slotV = beveledBox(STEM_CROSS_H, 0.025, STEM_CROSS_W, slotMat, 0.005);
  slotV.position.y = BASE_Y + HTOTAL + 0.001;
  g.add(slotV);

  // ghost shell overlay (always invisible unless setReveal() > 0)
  const ghostTop = beveledBox(HW * 2 + 0.004, topH + 0.004, HW * 2 + 0.004, ghostMat, 0.027);
  ghostTop.position.y = BASE_Y + HTOTAL - topH / 2;
  ghostTop.visible = false;
  g.add(ghostTop);

  const ghostBot = beveledBox(HW * 2 + 0.004, botH + 0.004, HW * 2 + 0.004, ghostMat, 0.027);
  ghostBot.position.y = BASE_Y + botH / 2;
  ghostBot.visible = false;
  g.add(ghostBot);

  return {
    group: g,
    solidParts: [topHousing, botHousing],
    ghostParts: [ghostTop, ghostBot],
  };
}

// ─── stem + click jacket assembly ──────────────────────────────────────────
function makeStem(group) {
  const stemGroup = new THREE.Group();

  // cruciform cross piece (the + shape that interfaces with keycap)
  const crossH = beveledBox(STEM_CROSS_W, STEM_CROSS_H, STEM_CROSS_H, stemMat(), 0.008);
  stemGroup.add(crossH);
  const crossV = beveledBox(STEM_CROSS_H, STEM_CROSS_H, STEM_CROSS_W, stemMat(), 0.008);
  stemGroup.add(crossV);

  // body cylinder below the cross
  const body = rod(STEM_BODY_R, 0.28, stemMat(), 24);
  body.position.y = -0.28;
  stemGroup.add(body);

  // cam leg (the tactile/click bump on one side of the stem)
  // On a clicky switch: a separate click jacket rides around this leg
  const legMat = stemMat();
  const legW = 0.04;
  const legH = 0.22;
  const leg = beveledBox(legW, legH, legW, legMat, 0.006);
  leg.position.set(STEM_BODY_R - 0.005, -legH / 2 - 0.01, 0);
  stemGroup.add(leg);

  // ── click jacket (separate piece that creates the click) ──
  const jacket = new THREE.Group();

  // jacket body: a small U-shaped slider that rides the leg
  const jackBody = beveledBox(0.07, 0.18, 0.06, clickJacketMat(), 0.006);
  jackBody.position.set(STEM_BODY_R + 0.01, -0.04, 0);
  jacket.add(jackBody);

  // jacket snap arm
  const snapArm = beveledBox(0.05, 0.06, 0.025, clickJacketMat(), 0.004);
  snapArm.position.set(STEM_BODY_R + 0.005, -0.13, 0);
  jacket.add(snapArm);

  stemGroup.add(jacket);

  // set initial position (at rest = top position)
  stemGroup.position.y = STEM_REST_Y;

  group.add(stemGroup);
  return { stemGroup, jacket };
}

// ─── contact leaves ─────────────────────────────────────────────────────────
function makeContacts(group) {
  const leftMat = contactMat(false);
  const rightMat = contactMat(false);

  // stationary contact (left)
  const leftLeaf = tubeAlong(
    [
      [-HW + 0.04,  LEAF_Y + 0.15,  0.0],
      [-HW + 0.04,  LEAF_Y + 0.04,  0.0],
      [-CONTACT_GAP - 0.01, LEAF_Y,  0.0],
    ],
    0.012,
    leftMat,
    { radialSegments: 10 },
  );
  group.add(leftLeaf);

  // movable contact (right) — bends inward when stem pushes it
  const rightLeafGroup = new THREE.Group();
  const rightLeaf = tubeAlong(
    [
      [HW - 0.04,  LEAF_Y + 0.15,  0.0],
      [HW - 0.04,  LEAF_Y + 0.04,  0.0],
      [CONTACT_GAP + 0.01,  LEAF_Y,  0.0],
    ],
    0.012,
    rightMat,
    { radialSegments: 10 },
  );
  rightLeafGroup.add(rightLeaf);
  group.add(rightLeafGroup);

  // contact tip glow dots (shown when circuit closed)
  const dotGeoL = new THREE.SphereGeometry(0.018, 10, 8);
  const dotGeoR = new THREE.SphereGeometry(0.018, 10, 8);
  const dotMatL = new THREE.MeshStandardMaterial({
    color: 0xffe066, emissive: 0xffd700, emissiveIntensity: 0,
    transparent: true, opacity: 0, depthWrite: false,
  });
  const dotMatR = new THREE.MeshStandardMaterial({
    color: 0xffe066, emissive: 0xffd700, emissiveIntensity: 0,
    transparent: true, opacity: 0, depthWrite: false,
  });
  const dotL = new THREE.Mesh(dotGeoL, dotMatL);
  dotL.position.set(-CONTACT_GAP - 0.01, LEAF_Y, 0);
  group.add(dotL);
  const dotR = new THREE.Mesh(dotGeoR, dotMatR);
  dotR.position.set(CONTACT_GAP + 0.01, LEAF_Y, 0);
  group.add(dotR);

  return {
    rightLeafGroup,
    leftMat,
    rightMat,
    dotMatL,
    dotMatR,
    dotL,
    dotR,
  };
}

// ─── PCB board beneath the switch ───────────────────────────────────────────
function makePCB(group) {
  const pcb = beveledBox(0.96, 0.06, 0.96, pcbMat(), 0.01);
  pcb.position.y = -0.03;
  group.add(pcb);

  // mount pins
  const pinMat = materials.brushedSteel();
  for (const [ox, oz] of [[-0.24, 0], [0.24, 0]]) {
    const pin = rod(0.018, 0.06, pinMat, 8);
    pin.position.set(ox, -0.055, oz);
    group.add(pin);
  }

  // solder bump pads at pin bases
  for (const [ox, oz] of [[-0.24, -0.045], [0.24, -0.045]]) {
    const pad = disc(0.032, 0.008, materials.brushedSteel(0xd4a843));
    pad.rotation.x = Math.PI / 2;
    pad.position.set(ox, -0.06, oz);
    group.add(pad);
  }
}

// ─── display plinth ──────────────────────────────────────────────────────────
function makePlinth(group) {
  const plinthMat = materials.paintedMetal(0x18191d);
  const base = disc(0.58, 0.06, plinthMat);
  base.position.y = -0.08;
  group.add(base);
  const stem = beveledBox(0.38, 0.18, 0.38, plinthMat, 0.02);
  stem.position.y = -0.12;
  group.add(stem);
}

// ─── callout labels ───────────────────────────────────────────────────────────
function makeCallouts(stemGroup, springGroup, contactGroup) {
  const allCallouts = [];

  const cKeycap = callout('Keycap', { dir: 30, len: 52 });
  cKeycap.position.set(0.3, 0.18, 0);
  stemGroup.add(cKeycap);
  allCallouts.push(cKeycap);

  const cStem = callout('Stem', { dir: 150, len: 52 });
  cStem.position.set(-0.22, -0.06, 0);
  stemGroup.add(cStem);
  allCallouts.push(cStem);

  const cJacket = callout('Click jacket', { dir: 20, len: 60 });
  cJacket.position.set(0.18, -0.12, 0);
  stemGroup.add(cJacket);
  allCallouts.push(cJacket);

  const cSpring = callout('Spring', { dir: 210, len: 52 });
  cSpring.position.set(0, 0.1, 0);
  springGroup.add(cSpring);
  allCallouts.push(cSpring);

  const cContact = callout('Metal contacts', { dir: 340, len: 60 });
  cContact.position.set(0.04, 0, 0);
  contactGroup.add(cContact);
  allCallouts.push(cContact);

  for (const c of allCallouts) c.visible = false;

  return {
    allCallouts,
    setLabels(v) {
      for (const c of allCallouts) c.visible = v;
    },
  };
}

// ─── main builder ─────────────────────────────────────────────────────────────
export function buildMechanicalKeyboardSwitch({ scene }) {
  const root = new THREE.Group();
  scene.add(root);

  makePlinth(root);
  makePCB(root);

  // housing
  const solidMat = housingSolidMat();
  const ghostMat = housingGhostMat();
  const housingResult = makeHousing(solidMat, ghostMat);
  root.add(housingResult.group);

  // spring group (so we can attach callout)
  const springGroup = new THREE.Group();
  root.add(springGroup);

  // spring mesh at rest
  const springMesh = makeSpring(
    SPRING_BOTTOM_Y,
    SPRING_TOP_Y,
    SPRING_R,
    SPRING_TURNS,
    SPRING_WIRE,
    springMat(),
  );
  springGroup.add(springMesh);

  // compressed spring mesh (hidden, swapped in during press)
  const springCompMesh = makeSpring(
    SPRING_BOTTOM_Y,
    SPRING_BOTTOM_Y + SPRING_COMP_LEN,
    SPRING_R * 1.08,
    SPRING_TURNS,
    SPRING_WIRE,
    springMat(),
  );
  springCompMesh.visible = false;
  springGroup.add(springCompMesh);

  // contacts group
  const contactGroup = new THREE.Group();
  root.add(contactGroup);
  const contacts = makeContacts(contactGroup);

  // stem group
  const stemAndJacket = makeStem(root);
  const { stemGroup, jacket } = stemAndJacket;

  // keycap (separate group so it can be hidden)
  const keycapGroup = new THREE.Group();
  const keycap = makeKeycap(keycapMat());
  keycap.position.y = KEYCAP_Y;
  keycapGroup.add(keycap);
  root.add(keycapGroup);

  // callouts
  const calloutLabels = makeCallouts(stemGroup, springGroup, contactGroup);

  // ── state handles ──────────────────────────────────────────────────────────

  let _press = 0;
  let _reveal = 0;

  function setReveal(r) {
    _reveal = clamp01(r);
    // solid shell parts: visible when reveal < 0.5
    for (const m of housingResult.solidParts) {
      m.visible = _reveal < 0.5;
    }
    // ghost overlays: visible when reveal > 0
    for (const m of housingResult.ghostParts) {
      m.visible = _reveal > 0.01;
      m.material.opacity = lerp(0, 0.18, _reveal);
    }
  }

  function setKeycap(visible) {
    keycapGroup.visible = visible;
  }

  function setPress(p) {
    _press = clamp01(p);

    // stem travels downward
    const travel = _press * STEM_TRAVEL;
    stemGroup.position.y = STEM_REST_Y - travel;

    // spring: swap between rest and compressed visuals
    const compFrac = _press;
    springMesh.visible = compFrac < 0.15;
    springCompMesh.visible = compFrac >= 0.15;

    // right leaf bends inward past actuation point
    const leafBend = clamp01((_press - ACTUATION_FRAC) / 0.1);
    contacts.rightLeafGroup.position.x = -leafBend * CONTACT_GAP * 1.8;

    // contact glow when circuit is closed (press > actuation)
    const closed = _press >= ACTUATION_FRAC;
    const glow = clamp01((_press - ACTUATION_FRAC) / 0.05);
    contacts.dotMatL.opacity = glow * 0.9;
    contacts.dotMatL.emissiveIntensity = glow * 1.5;
    contacts.dotMatR.opacity = glow * 0.9;
    contacts.dotMatR.emissiveIntensity = glow * 1.5;

    // click jacket snaps at CLICK_FRAC
    const snap = clamp01((_press - CLICK_FRAC) / 0.04);
    jacket.position.y = -snap * 0.04;
  }

  function setLabels(v) {
    calloutLabels.setLabels(v);
  }

  // initialise
  setPress(0);
  setReveal(0);
  setKeycap(true);

  return {
    setPress,
    setReveal,
    setKeycap,
    setLabels,
  };
}
