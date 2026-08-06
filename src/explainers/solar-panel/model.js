import * as THREE from 'three';
import { materials, rod, box, disc, studioPlinth } from '../../framework/parts.js';
import { beveledBox, tubeAlong } from '../../framework/geometry.js';
import { chainPath } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';

// Reference facts (Electrical4U "Solar Cell", Clean Energy Reviews "Solar PV
// cell construction" + "Solar panel construction", astronoo.com "Journey of
// a Photon"):
//  - Sun: core fuses hydrogen -> helium at ~15,000,000 C. That energy random
//    -walks roughly 100,000 years out through the sun's bulk, then crosses
//    ~150 million km of space in ~8 minutes as light.
//  - Cell: a thick p-type (boron-doped) silicon wafer with a wafer-thin
//    (~0.5 micron) n-type (phosphorus-doped) layer diffused on top -> the
//    p-n junction sits just under the surface. Anti-reflective silicon
//    -nitride coating (blue-black, <5% reflectance). Silver front metal
//    fingers + busbars collect current; a full-area aluminum rear contact
//    forms the back-surface field.
//  - Physics: a photon with energy above silicon's ~1.1 eV bandgap frees an
//    electron-hole pair; the junction's built-in field sweeps the electron
//    to the front contact and the hole to the back.
//  - Module: 156mm cells, a 6x10 = 60-cell grid wired in series (busbar
//    ribbons), each cell ~0.5-0.6V open-circuit -> ~36V DC per module.
//    Layers front to back: tempered glass (3.2mm) / EVA / cell / EVA /
//    white backsheet (~4.5mm laminate) recessed in a deeper (~40mm real)
//    anodized-aluminum frame. Rear junction box: one bypass diode per
//    ~20-cell string (3 here), two DC output leads.
//
// Proportions: portrait module W:H = 1.6:2.6 (~1:1.625), matching a real
// 992x1650mm 60-cell panel. Simplification (disclosed): the two string
// -boundary taps are not separately routed to the junction box; only the
// two string ends are, with the box shown carrying 3 diodes conceptually.

// ---- geometry constants ---------------------------------------------------
const PANEL_W = 1.6;
const PANEL_H = 2.6;
const FRAME_BORDER = 0.06;
const FRAME_DEPTH = 0.09;

const GLASS_T = 0.02;
const EVA_T = 0.006;
const CELL_T = 0.006;
const BACK_T = 0.008;
const LAMINATE_T = GLASS_T + EVA_T * 2 + CELL_T + BACK_T;
const STACK_GAP = (FRAME_DEPTH - LAMINATE_T) / 2;

const BACK_Z = STACK_GAP + BACK_T / 2;
const EVA_B_Z = STACK_GAP + BACK_T + EVA_T / 2;
const CELL_Z = STACK_GAP + BACK_T + EVA_T + CELL_T / 2;
const EVA_T_Z = STACK_GAP + BACK_T + EVA_T + CELL_T + EVA_T / 2;
const GLASS_Z = STACK_GAP + BACK_T + EVA_T + CELL_T + EVA_T + GLASS_T / 2;

const COLS = 6;
const ROWS = 10;
const MARGIN = 0.05;
const ACTIVE_W = PANEL_W - MARGIN * 2;
const ACTIVE_H = PANEL_H - MARGIN * 2;
const PITCH_X = ACTIVE_W / COLS;
const PITCH_Y = ACTIVE_H / ROWS;
const CELL_SIZE = PITCH_X * 0.92;

const TILT = -0.47; // ~27 degrees, typical rooftop rack angle

const GLASS_COLOR = 0xdde6ea; // near-neutral: real AR-coated solar glass is almost untinted
const CELL_COLOR = 0x071224; // deep blue-black; the warm key light desaturates a lighter navy toward gray-tan
const N_LAYER_COLOR = 0x8fd3ff;
const METAL_COLOR = 0xd8dde3;
const BACKSHEET_COLOR = 0x1b1d21; // matte black backsheet (common on premium modules) — reads as a real product surface, not a flat gray slab
const EVA_COLOR = 0xfaf0c8;
const ELECTRON_COLOR = 0x8fd3ff;
const PHOTON_COLOR = 0xffdf94;
const SUN_COLOR = 0xffb347;

function cellTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#071224';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#c9d4de';
  ctx.lineWidth = 1;
  for (let i = 1; i < 10; i++) {
    const y = (i / 10) * 128;
    ctx.beginPath();
    ctx.moveTo(6, y);
    ctx.lineTo(122, y);
    ctx.stroke();
  }
  ctx.lineWidth = 3;
  for (const x of [28, 64, 100]) {
    ctx.beginPath();
    ctx.moveTo(x, 4);
    ctx.lineTo(x, 124);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildFlowDots(count, color, size = 0.02) {
  const geo = new THREE.SphereGeometry(size, 10, 8);
  const dots = [];
  for (let i = 0; i < count; i++) {
    const mat = materials.glow(color, 0.35);
    mat.transparent = true;
    mat.opacity = 0;
    mat.depthWrite = false;
    const dot = new THREE.Mesh(geo, mat);
    dot.userData.seed = i / count;
    dots.push(dot);
  }
  return dots;
}

export function buildSolarPanel({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // --- display plinth + mount -------------------------------------------
  const PLINTH_H = 0.26;
  const plinth = studioPlinth({ w: 2.2, h: PLINTH_H, d: 1.6 });
  group.add(plinth);

  const mount = new THREE.Group();
  mount.position.y = PLINTH_H;
  group.add(mount);

  const strutMat = materials.paintedMetal(0x24262b);
  for (const sx of [-0.62, 0.62]) {
    const strut = rod(0.035, 0.9, strutMat, 12);
    strut.position.set(sx, 0, -0.05);
    strut.rotation.x = TILT * 0.55;
    mount.add(strut);
  }

  const panelTilt = new THREE.Group();
  panelTilt.position.y = 0.14;
  panelTilt.rotation.x = TILT;
  mount.add(panelTilt);

  const panel = new THREE.Group();
  panel.position.set(0, PANEL_H / 2, 0); // hinge at the bottom edge
  panelTilt.add(panel);

  // world-space front normal, computed once (tilt is static)
  const frontNormal = new THREE.Vector3(0, 0, 1)
    .applyQuaternion(panelTilt.getWorldQuaternion(new THREE.Quaternion()))
    .normalize();
  // panel's world-space center, used to aim the sun along the direction the
  // glass actually faces — a tilted rack points at the sky it's racked
  // toward, not at an arbitrary corner of the scene
  const panelCenter = panel.localToWorld(new THREE.Vector3(0, 0, 0.03));

  // --- frame (static anchor, never explodes) ------------------------------
  const frameGroup = new THREE.Group();
  panel.add(frameGroup);
  const frameMat = materials.aluminum(0xc7ccd2);
  frameMat.roughness = 0.88; // default 0.42 reads near-chrome; clips at grazing angles from several step cameras
  const railTop = beveledBox(PANEL_W + FRAME_BORDER * 2, FRAME_BORDER, FRAME_DEPTH, frameMat, 0.01);
  railTop.position.set(0, PANEL_H / 2 + FRAME_BORDER / 2, FRAME_DEPTH / 2);
  const railBot = beveledBox(PANEL_W + FRAME_BORDER * 2, FRAME_BORDER, FRAME_DEPTH, frameMat, 0.01);
  railBot.position.set(0, -PANEL_H / 2 - FRAME_BORDER / 2, FRAME_DEPTH / 2);
  const railL = beveledBox(FRAME_BORDER, PANEL_H, FRAME_DEPTH, frameMat.clone(), 0.01);
  railL.position.set(-(PANEL_W / 2 + FRAME_BORDER / 2), 0, FRAME_DEPTH / 2);
  const railR = beveledBox(FRAME_BORDER, PANEL_H, FRAME_DEPTH, frameMat.clone(), 0.01);
  railR.position.set(PANEL_W / 2 + FRAME_BORDER / 2, 0, FRAME_DEPTH / 2);
  frameGroup.add(railTop, railBot, railL, railR);

  // --- layer stack (each its own group so `reveal` can explode it) -------
  const backLayer = new THREE.Group();
  backLayer.position.z = BACK_Z;
  const backMesh = box(PANEL_W, PANEL_H, BACK_T, materials.polymer(BACKSHEET_COLOR));
  backMesh.material.roughness = 0.55; // some sheen so it reads as manufactured polymer, not flat cardboard
  backMesh.material.clearcoat = 0.2; // black absorbs enough that this stays safely under the clip threshold
  backMesh.material.clearcoatRoughness = 0.4;
  backLayer.add(backMesh);
  panel.add(backLayer);

  const evaBLayer = new THREE.Group();
  evaBLayer.position.z = EVA_B_Z;
  const evaBMat = materials.glass(EVA_COLOR, 0.05);
  evaBMat.roughness = 0.5;
  evaBMat.specularIntensity = 0.05; // inner laminate layer — default specularIntensity (1) stacked with the glass above to wash the panel out white
  evaBMat.envMapIntensity = 0.2;
  evaBMat.side = THREE.FrontSide; // DoubleSide on a thin box double-renders front+back transparent surfaces, compounding brightness
  evaBLayer.add(box(PANEL_W * 0.97, PANEL_H * 0.97, EVA_T, evaBMat));
  panel.add(evaBLayer);

  const cellLayer = new THREE.Group();
  cellLayer.position.z = CELL_Z;
  panel.add(cellLayer);

  const evaTLayer = new THREE.Group();
  evaTLayer.position.z = EVA_T_Z;
  const evaTMat = materials.glass(EVA_COLOR, 0.05);
  evaTMat.roughness = 0.5;
  evaTMat.specularIntensity = 0.05; // inner laminate layer — default specularIntensity (1) stacked with the glass above to wash the panel out white
  evaTMat.envMapIntensity = 0.2;
  evaTMat.side = THREE.FrontSide;
  evaTLayer.add(box(PANEL_W * 0.97, PANEL_H * 0.97, EVA_T, evaTMat));
  panel.add(evaTLayer);

  const glassLayer = new THREE.Group();
  glassLayer.position.z = GLASS_Z;
  const glassMat = materials.glass(GLASS_COLOR, 0.045);
  glassMat.roughness = 0.32; // softened: default 0.12 clipped as a hotspot on this large flat pane
  // real anti-reflective coating keeps reflectance under 5% — the untamed
  // dielectric specular was reading as a broad white sheen that washed the
  // dark cells out to near-white; this is the actual fix for that.
  glassMat.specularIntensity = 0.07;
  glassMat.envMapIntensity = 0.2;
  glassMat.side = THREE.FrontSide;
  const glassMesh = box(PANEL_W, PANEL_H, GLASS_T, glassMat);
  glassLayer.add(glassMesh);
  panel.add(glassLayer);

  // --- cell grid: 60 identical cells, instanced -----------------------------
  const cellTex = cellTexture();
  const cellMat = new THREE.MeshPhysicalMaterial({
    color: CELL_COLOR,
    map: cellTex,
    roughness: 0.4,
    metalness: 0.05,
    clearcoat: 0,
  });
  const cellGeoSrc = beveledBox(CELL_SIZE, CELL_SIZE, CELL_T, cellMat, 0.004);
  const cellInst = new THREE.InstancedMesh(cellGeoSrc.geometry, cellMat, COLS * ROWS);
  cellInst.castShadow = true;
  const cellCenters = [];
  const m4 = new THREE.Matrix4();
  for (let c = 0; c < COLS; c++) {
    cellCenters[c] = [];
    for (let r = 0; r < ROWS; r++) {
      const x = -ACTIVE_W / 2 + PITCH_X * (c + 0.5);
      const y = MARGIN + PITCH_Y * (r + 0.5);
      cellCenters[c][r] = { x, y };
      m4.makeTranslation(x, y - PANEL_H / 2, 0);
      cellInst.setMatrixAt(c * ROWS + r, m4);
    }
  }
  cellInst.instanceMatrix.needsUpdate = true;
  cellLayer.add(cellInst);

  // series-wired snake order (boustrophedon by column) — both string ends
  // land near the bottom edge, matching a real junction box's position.
  const order = [];
  for (let c = 0; c < COLS; c++) {
    if (c % 2 === 0) for (let r = 0; r < ROWS; r++) order.push({ c, r });
    else for (let r = ROWS - 1; r >= 0; r--) order.push({ c, r });
  }
  const cellPoint = (c, r) => {
    const p = cellCenters[c][r];
    return [p.x, p.y - PANEL_H / 2, CELL_T / 2 + 0.006];
  };

  const ribbonMat = materials.aluminum(0xd6dae0); // chrome (roughness 0.09) was clipping at grazing angles across 59 ribbons
  const ribbonGroup = new THREE.Group();
  cellLayer.add(ribbonGroup);
  for (let i = 0; i < order.length - 1; i++) {
    const a = order[i];
    const b = order[i + 1];
    const pa = cellPoint(a.c, a.r);
    const pb = cellPoint(b.c, b.r);
    const dx = pb[0] - pa[0];
    const dy = pb[1] - pa[1];
    const len = Math.hypot(dx, dy);
    const ribbon = beveledBox(len, 0.02, 0.006, ribbonMat, 0.003);
    ribbon.position.set((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, pa[2]);
    if (Math.abs(dy) > Math.abs(dx)) ribbon.rotation.z = Math.PI / 2;
    ribbonGroup.add(ribbon);
  }

  // --- junction box on the back, with 3 bypass diodes + 2 output leads ---
  const jbGroup = new THREE.Group();
  jbGroup.position.set(0, -PANEL_H / 2 + PANEL_H * 0.14, -0.05);
  panel.add(jbGroup);
  const jbMat = materials.polymer(0x18181b);
  const jbBody = beveledBox(0.44, 0.22, 0.09, jbMat, 0.015);
  jbGroup.add(jbBody);
  // Diodes mounted as visibly separate exterior components (simplified: real
  // junction boxes seal these inside — a clear cover would either occlude
  // them via glass-Fresnel reflection at this back-facing angle or need
  // exact alignment to read through, both fragile; a plainly protruding
  // component reads correctly from any camera angle). Painted-metal body
  // (low metalness) keeps its own albedo lit without needing a specular hit;
  // the cathode band is emissive so it's never at the mercy of lighting.
  // NB local +Z here points toward the panel's FRONT (same as the glass),
  // not toward this rear-viewing camera — the box's camera-facing surface is
  // its -Z face (matches jbGroup itself sitting at panel z=-0.05, "behind"),
  // so parts meant to protrude toward the camera need NEGATIVE z.
  const diodeMat = materials.paintedMetal(0xb8bec6);
  diodeMat.clearcoat = 0; // default 1 + clearcoatRoughness 0.14 = a tight clipping hotspot on this small curved rod
  diodeMat.roughness = 0.6;
  const bandMat = materials.glow(0xfff3d6, 0.8);
  for (let i = -1; i <= 1; i++) {
    const diode = rod(0.032, 0.1, diodeMat, 12);
    diode.rotation.z = Math.PI / 2;
    diode.position.set(i * 0.11 + 0.05, 0, -0.07);
    jbGroup.add(diode);
    const band = rod(0.035, 0.016, bandMat, 12);
    band.rotation.z = Math.PI / 2;
    band.position.set(i * 0.11 + 0.02, 0, -0.07);
    jbGroup.add(band);
  }
  // curved cables (not compound-rotated straight rods) so the two clearly
  // diverge in world space from any camera azimuth, not just ones that
  // happen to catch a subtle rotational splay
  const leadMat = materials.rubber(0x1c1e22);
  const leadNeg = tubeAlong(
    [
      [-0.1, -0.11, 0],
      [-0.16, -0.24, -0.05],
      [-0.22, -0.34, -0.08],
    ],
    0.014,
    leadMat,
  );
  const leadPos = tubeAlong(
    [
      [0.1, -0.11, 0],
      [0.16, -0.24, -0.05],
      [0.22, -0.34, -0.08],
    ],
    0.014,
    leadMat.clone(),
  );
  jbGroup.add(leadNeg, leadPos);

  // full series-current path: JB lead -> 60 cells -> JB lead. electronDots
  // live under `cellLayer` (offset from `panel` by CELL_Z along z), so every
  // point here is expressed in cellLayer-local space, not panel-local.
  const jbLocalZ = jbGroup.position.z - CELL_Z;
  const jbNegWorld = [0.1, jbGroup.position.y - 0.34, jbLocalZ];
  const jbPosWorld = [-0.1, jbGroup.position.y - 0.34, jbLocalZ];
  const startPt = cellPoint(order[0].c, order[0].r);
  const endPt = cellPoint(order[order.length - 1].c, order[order.length - 1].r);
  const chainSegs = [];
  chainSegs.push([jbNegWorld, [startPt[0], startPt[1], -CELL_Z], startPt]);
  for (let i = 0; i < order.length - 1; i++) {
    chainSegs.push([cellPoint(order[i].c, order[i].r), cellPoint(order[i + 1].c, order[i + 1].r)]);
  }
  chainSegs.push([endPt, [endPt[0], endPt[1], -CELL_Z], jbPosWorld]);
  const currentChain = chainPath(chainSegs);

  const electronDots = buildFlowDots(48, ELECTRON_COLOR, 0.02);
  electronDots.forEach((d) => cellLayer.add(d));

  // --- payoff bulb: a small demo lamp on the plinth, wired to the module's
  // output — lit only in the finale, making "this generates real current"
  // concrete instead of just asserted in the copy.
  const bulbGroup = new THREE.Group();
  bulbGroup.position.set(0.95, PLINTH_H, 0.35);
  group.add(bulbGroup);
  const bulbBase = disc(0.09, 0.03, materials.paintedMetal(0x24262b), 24);
  bulbBase.position.y = 0.015;
  bulbGroup.add(bulbBase);
  const bulbStand = rod(0.014, 0.34, materials.darkMetal(0x3a3f47), 12);
  bulbStand.position.y = 0.03;
  bulbGroup.add(bulbStand);
  const bulbSocket = rod(0.03, 0.05, materials.darkMetal(0x2a2d33), 12);
  bulbSocket.position.y = 0.03 + 0.34;
  bulbGroup.add(bulbSocket);
  const bulbMat = materials.glow(0xffdca0, 0.15);
  const bulbGlass = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 16), bulbMat);
  bulbGlass.position.y = bulbSocket.position.y + 0.08;
  bulbGroup.add(bulbGlass);
  const bulbLight = new THREE.PointLight(0xffdca0, 0, 1.4);
  bulbLight.position.copy(bulbGlass.position);
  bulbGroup.add(bulbLight);

  // wire draping from the module's output down to the lamp base — world
  // -space points (this whole assembly is a sibling of `panel`, not a child)
  const jbWorld = new THREE.Vector3();
  jbGroup.getWorldPosition(jbWorld);
  const bulbWire = tubeAlong(
    [
      [jbWorld.x, jbWorld.y - 0.05, jbWorld.z],
      [0.55, PLINTH_H + 0.08, 0.05],
      [0.95, PLINTH_H + 0.02, 0.35],
    ],
    0.012,
    materials.rubber(0x1c1e22),
  );
  group.add(bulbWire);

  // --- hero cell: pulled out for the macro junction step -----------------
  const heroGroup = new THREE.Group();
  heroGroup.position.set(PANEL_W / 2 + 0.55, PANEL_H * 0.52 - PANEL_H / 2, 0.3);
  panel.add(heroGroup);
  const heroP = beveledBox(0.42, 0.42, 0.09, new THREE.MeshPhysicalMaterial({ color: CELL_COLOR, roughness: 0.35, metalness: 0.05 }), 0.01);
  heroGroup.add(heroP);
  const heroN = beveledBox(0.4, 0.4, 0.012, new THREE.MeshPhysicalMaterial({ color: N_LAYER_COLOR, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.85 }), 0.006);
  heroN.position.z = 0.045 + 0.006;
  heroGroup.add(heroN);
  const heroContact = beveledBox(0.44, 0.44, 0.01, materials.aluminum(0xb9c0c8), 0.006);
  heroContact.position.z = -0.045 - 0.005;
  heroGroup.add(heroContact);
  const heroFinger = box(0.4, 0.012, 0.006, materials.aluminum(METAL_COLOR));
  heroFinger.position.z = 0.045 + 0.013;
  heroGroup.add(heroFinger);
  heroGroup.scale.setScalar(0.001);

  const heroJunctionMarker = new THREE.Object3D();
  heroJunctionMarker.position.set(0, 0, 0.045);
  heroGroup.add(heroJunctionMarker);
  const heroExitMarker = new THREE.Object3D();
  heroExitMarker.position.set(0.2, 0.2, 0.06);
  heroGroup.add(heroExitMarker);
  const heroChain = chainPath([[[0, 0, 0.045], [0.2, 0.2, 0.06]]]);
  const heroDots = buildFlowDots(6, ELECTRON_COLOR, 0.018);
  heroDots.forEach((d) => heroGroup.add(d));

  // --- sun + photon journey -----------------------------------------------
  // Positioned out along the panel's own front-normal (the direction the
  // glass actually faces) plus a side offset for framing — the rack is
  // tilted TOWARD the sun, not just decorated with one floating nearby.
  const sunGroup = new THREE.Group();
  sunGroup.position.copy(panelCenter).addScaledVector(frontNormal, 5.2).add(new THREE.Vector3(2.3, 1.0, 0));
  group.add(sunGroup);
  const sunCore = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 18), materials.glow(SUN_COLOR, 2.4));
  const sunCorona1 = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 20, 16),
    new THREE.MeshBasicMaterial({ color: SUN_COLOR, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  const sunCorona2 = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 20, 16),
    new THREE.MeshBasicMaterial({ color: SUN_COLOR, transparent: true, opacity: 0.1, depthWrite: false }),
  );
  sunGroup.add(sunCore, sunCorona1, sunCorona2);

  // impact markers scattered across the glass face — real children of the
  // cell layer so their world position tracks the (static) tilt correctly
  const impactMarkers = [];
  const rand = (seed) => {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < 18; i++) {
    const mk = new THREE.Object3D();
    const c = Math.floor(rand(i * 3.1) * COLS);
    const r = Math.floor(rand(i * 7.7) * ROWS);
    const p = cellPoint(c, r);
    mk.position.set(p[0], p[1], p[2] + 0.01);
    cellLayer.add(mk);
    impactMarkers.push(mk);
  }

  const sunRayDots = buildFlowDots(18, PHOTON_COLOR, 0.024);
  sunRayDots.forEach((d) => group.add(d));
  const localRainDots = buildFlowDots(20, PHOTON_COLOR, 0.016);
  localRainDots.forEach((d) => group.add(d));

  const sunWorldPos = new THREE.Vector3();
  const markerWorldPos = new THREE.Vector3();
  const dropStart = new THREE.Vector3();

  // --- callouts ------------------------------------------------------------
  const labels = calloutSets(['exterior', 'sun', 'stack', 'cell', 'wiring', 'output', 'payoff']);
  labels.add('exterior', frameGroup, 'Anodized aluminum frame', [PANEL_W / 2 + 0.1, PANEL_H * 0.3, 0.05], -20, 80);
  labels.add('exterior', glassLayer, 'Tempered glass (3.2mm)', [0.2, PANEL_H * 0.7, 0.02], 55, 90);
  labels.add('exterior', jbGroup, 'Junction box', [0.15, -0.05, 0.05], -50, 80);
  labels.add('exterior', mount, 'Mounting rack, ~27° tilt', [0.9, -0.3, 0], -80, 90);

  labels.add('sun', sunGroup, 'Core fusion: ~15,000,000°C', [-0.1, 0.3, 0], 150, 90);
  labels.add('sun', sunGroup, '~8 min across 150M km', [0.15, -0.4, 0], -55, 90);
  labels.add('sun', impactMarkers[3], 'Only photons ≥1.1eV get absorbed', [0.1, 0.1, 0], 60, 130);

  labels.add('stack', glassLayer, 'Front glass', [0.25, 0.3, 0.01], 45, 70);
  labels.add('stack', evaTLayer, 'EVA encapsulant', [0.25, 0.05, 0.005], 30, 70);
  labels.add('stack', cellLayer, 'Silicon cell layer', [0.25, -0.2, 0], 0, 90);
  labels.add('stack', evaBLayer, 'EVA encapsulant', [0.25, -0.45, 0.005], -30, 70);
  labels.add('stack', backLayer, 'Black backsheet', [0.25, -0.7, 0.004], -50, 80);

  labels.add('cell', heroN, 'n-type layer (~0.5µm)', [0.15, 0.15, 0], 45, 100);
  labels.add('cell', heroP, 'p-type silicon base', [0.15, -0.15, 0], -45, 100);
  labels.add('cell', heroContact, 'Aluminum rear contact', [0.15, -0.1, 0], -70, 100);
  labels.add('cell', heroFinger, 'Front metal finger', [0.15, 0.05, 0], 60, 90);

  labels.add('wiring', ribbonGroup, 'Busbar ribbon', [0.3, 0.1, 0.03], 30, 80);
  labels.add('wiring', cellLayer, '60 cells wired in series', [0.3, 0.85, 0], 65, 90);
  labels.add('wiring', jbGroup, '~36V DC per module', [0.3, 0.3, 0], 45, 100);

  labels.add('output', jbGroup, '3 bypass diodes, one per string', [0.28, 0.02, 0.05], 25, 120);
  labels.add('output', jbGroup, 'DC output leads', [0.15, -0.25, 0], -60, 90);

  labels.add('payoff', bulbGlass, 'Real DC output — lights this bulb', [0, 0.08, 0], 95, 90);

  // --- pose / state ----------------------------------------------------------
  const state = {
    reveal: 0,
    photonPhase: 0,
    electronPhase: 0,
    heroPop: 0,
    sunVisible: 0,
    lightOn: 0,
    bulbOn: 0,
  };

  const LAYER_OFFSET = {
    back: -0.16,
    evaB: -0.055,
    evaT: 0.055,
    glass: 0.16,
  };

  function apply() {
    const t = state.reveal;
    backLayer.position.z = BACK_Z + LAYER_OFFSET.back * t;
    evaBLayer.position.z = EVA_B_Z + LAYER_OFFSET.evaB * t;
    evaTLayer.position.z = EVA_T_Z + LAYER_OFFSET.evaT * t;
    glassLayer.position.z = GLASS_Z + LAYER_OFFSET.glass * t;

    const pop = state.heroPop;
    heroGroup.scale.setScalar(THREE.MathUtils.lerp(0.001, 1, pop));

    sunGroup.visible = state.sunVisible > 0.01;
    const sunOpacity = state.sunVisible;
    sunCorona1.material.opacity = 0.22 * sunOpacity;
    sunCorona2.material.opacity = 0.1 * sunOpacity;
    sunCore.material.emissiveIntensity = 2.4 * sunOpacity;

    sunGroup.getWorldPosition(sunWorldPos);
    sunRayDots.forEach((dot, i) => {
      const mk = impactMarkers[i % impactMarkers.length];
      mk.getWorldPosition(markerWorldPos);
      const tt = (dot.userData.seed + state.photonPhase) % 1;
      dot.position.lerpVectors(sunWorldPos, markerWorldPos, tt);
      const fade = Math.sin(Math.PI * tt);
      dot.material.opacity = state.sunVisible * state.lightOn * fade * 0.9;
    });

    localRainDots.forEach((dot, i) => {
      const mk = impactMarkers[(i + 5) % impactMarkers.length];
      mk.getWorldPosition(markerWorldPos);
      dropStart.copy(markerWorldPos).addScaledVector(frontNormal, 0.5);
      const tt = (dot.userData.seed + state.photonPhase) % 1;
      dot.position.lerpVectors(dropStart, markerWorldPos, tt);
      const fade = Math.min(1, tt * 6) * Math.min(1, (1 - tt) * 4);
      dot.material.opacity = (1 - state.sunVisible) * state.lightOn * fade * 0.85;
    });

    electronDots.forEach((dot) => {
      const tt = (dot.userData.seed + state.electronPhase) % 1;
      const p = currentChain.getPointAt(tt);
      dot.position.copy(p);
      dot.material.opacity = 0.85;
    });

    heroDots.forEach((dot) => {
      const tt = (dot.userData.seed + state.electronPhase) % 1;
      const p = heroChain.getPointAt(tt);
      dot.position.copy(p);
      dot.material.opacity = pop > 0.5 ? 0.9 : 0;
    });

    const bulbShown = state.bulbOn > 0.01;
    bulbGroup.visible = bulbShown;
    bulbWire.visible = bulbShown;
    bulbMat.emissiveIntensity = 0.15 + state.bulbOn * 3.2;
    bulbLight.intensity = state.bulbOn * 1.6;
  }
  apply();

  return {
    group,
    parts: {
      panel,
      panelTilt,
      frameGroup,
      glassLayer,
      evaTLayer,
      evaBLayer,
      cellLayer,
      backLayer,
      jbGroup,
      heroGroup,
      sunGroup,
      bulbGroup,
    },
    setLabels: labels.setLabels,
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
  };
}
