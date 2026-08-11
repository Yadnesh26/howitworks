import * as THREE from 'three';
import { materials, rod, studioPlinth } from '../../framework/parts.js';
import { beveledBox, lathe, coil, boltCircle } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, TAU } from '../../framework/motion.js';

// A diagnostic radiography suite, presented as a studio product shot: the tube
// head on its column, the collimator, an aluminium step wedge standing in the
// beam, and the upright flat-panel detector it casts a shadow onto. Reveal
// story: sealed machine -> ghost the head to expose the insert floating in oil
// -> cathode -> the accelerating gap -> the spinning anode -> collimation ->
// the shadow forming on the panel -> a sealed, running finale.
//
// SCALE: 1 world unit = 50 cm, and every constant below is derived from it.
//   tube housing   36 cm long x 40 cm across   -> 0.72 x 0.40
//   anode disc     90 mm dia, 7 mm thick       -> 0.180 dia, 0.018 thick
//   collimator     20 cm cube                  -> 0.40 cube
//   detector       43 cm square active area    -> 0.86 square
//   SID (focal spot -> detector face) 1.60 u = 80 cm. The real table SID is
//   1 m; compressed ~20% so the head reads large enough in frame. This and the
//   cathode assembly below are the ONLY two deliberate scale breaks.
// The cathode (focusing cup + filament) is drawn ~2x oversize: a real cup is
// ~10 mm across, which at this scale is 4 mm of screen — invisible even in the
// macro shot. Everything else holds true ratio.
//
// MECHANISM (researched — rotating-anode diagnostic tube):
// a helical TUNGSTEN FILAMENT (0.22-0.3 mm wire) is heated to ~2000 C and
// boils electrons off its surface (thermionic emission); the tube current, mA,
// is simply how many. A molybdenum FOCUSING CUP holds a negative charge that
// keeps that cloud from spreading, squeezing it into a rectangle a millimetre
// or two across. 40-120 kV across the tube then accelerates the electrons
// through a VACUUM (1e-5 to 1e-9 torr inside a borosilicate envelope) to over
// half the speed of light, and they slam into a bevelled TUNGSTEN-RHENIUM
// ANODE. About 1% of that energy leaves as X-rays — bremsstrahlung (electrons
// braking in the nuclear field) plus characteristic lines; the other 99% is
// heat. That is why the anode is a DISC that SPINS at 3,000-10,000 rpm on a
// molybdenum stem: it smears the load from a ~4 mm2 focal spot over a ~1200 mm2
// focal track. It is turned by an induction motor whose copper ROTOR is inside
// the vacuum and whose STATOR windings sit OUTSIDE the glass — a motor with no
// wires crossing the seal. The bevel (<=17 deg, typically 12-16) is the LINE
// FOCUS principle: a broad electron footprint, viewed from below, foreshortens
// into a tiny apparent point, which is what makes the shadow sharp.
// The insert floats in MINERAL OIL (insulation + cooling) inside a steel
// housing LINED WITH LEAD; every X-ray heading the wrong way is absorbed
// there, leaving only the ones through the BERYLLIUM WINDOW. Below it the
// COLLIMATOR's two pairs of lead shutters crop that cone to a rectangle, and a
// 45-degree MIRROR folds a lamp's light along the same path so the operator
// can see where the invisible beam will land.
// At the far end, contrast comes from PHOTOELECTRIC ABSORPTION, which scales
// roughly with the CUBE of atomic number: calcium (Z=20) in bone swallows
// photons that the hydrogen/carbon/oxygen of soft tissue lets through. An
// ANTI-SCATTER GRID of lead strips (40-70 per cm) throws away photons arriving
// off-axis, then a CsI SCINTILLATOR turns the survivors into visible light and
// an amorphous-silicon PHOTODIODE/TFT ARRAY reads that out pixel by pixel.
// The picture is a shadow, not a photograph.
// Sources: clinicalgate.com/the-x-ray-tube, vareximaging.com (rotating anode),
// sprawls.org/ppmi2/XRAYPRO, radiopaedia.org/articles/flat-panel-detector.

// --- staging -----------------------------------------------------------------
const PLINTH_H = 0.26;

// --- the beam line (everything else hangs off these four numbers) -------------
const BEAM_Y = 1.3; // height of the central ray
const FOCAL_X = -0.85; // where the X-rays are actually born
const PANEL_FACE_X = 0.75; // front face of the detector
const SID = PANEL_FACE_X - FOCAL_X; // 1.60 — source-to-image distance

// --- tube head ---------------------------------------------------------------
const TRACK_R = 0.072; // focal-track radius on the anode disc
const AXIS_X = FOCAL_X - TRACK_R; // the tube's (vertical) rotation axis
const HOUS_R = 0.2;
const HOUS_L = 0.72;
const PORT_R = 0.055;
const GAP_DEG = 60; // angular slot in the shell that the port plate fills
const PLATE_X = HOUS_R * Math.cos((GAP_DEG * Math.PI) / 360); // 0.173

const ENV_R = 0.125; // glass envelope bulb radius
const DISC_R = 0.09;
const DISC_T = 0.018;
const BEVEL = (16 * Math.PI) / 180; // anode target angle
const CATH_Y = 0.185; // filament height above the focal spot — the kV gap

// --- collimator --------------------------------------------------------------
const COL_W = 0.4;
const COL_X0 = AXIS_X + HOUS_R;
const COL_CX = COL_X0 + COL_W / 2;
const BLADE_X = COL_CX; // shutter plane
const APERTURE_MAX = 0.088; // half-field at the shutter plane = full open

// --- detector + subject ------------------------------------------------------
const PANEL_S = 0.86; // active area (43 cm square)
const PANEL_T = 0.12;
const PANEL_CX = PANEL_FACE_X + PANEL_T / 2;
const WEDGE_X = 0.16; // the step wedge stands mid-gap, downstream face here
const WEDGE_N = 5;
// The staircase climbs in Y, not across Z. A wedge stepping sideways vanishes
// into foreshortening from any camera looking along the beam; stepping upward
// it reads as a ladder from every angle the storyboard uses — and the shadow
// it throws is then a stack of horizontal bands.
const WEDGE_STEP = 0.07; // height of one step
const WEDGE_HALF_Y = (WEDGE_N * WEDGE_STEP) / 2;
const WEDGE_HALF_Z = 0.15; // half width across the beam
// aluminium thicknesses, and the fraction of photons each step lets through
const WEDGE_T = [0.014, 0.031, 0.048, 0.065, 0.082];
const WEDGE_PASS = [0.86, 0.66, 0.47, 0.3, 0.16];

const ELECTRON_COLOR = 0xffb02e; // amber — charge, as everywhere else in the library
const XRAY_COLOR = 0xc6d4ff; // pale blue-white — the invisible beam's stand-in

// Fine grid for the TFT readout layer — a pixel array reads as an array only
// if you can see the pixels, and 200 thin bars would be 200 draw calls.
function pixelGridTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#141b22';
  x.fillRect(0, 0, S, S);
  x.strokeStyle = 'rgba(120,190,210,0.32)';
  x.lineWidth = 1;
  for (let i = 0; i <= 40; i++) {
    const p = (i / 40) * S + 0.5;
    x.beginPath();
    x.moveTo(p, 0);
    x.lineTo(p, S);
    x.moveTo(0, p);
    x.lineTo(S, p);
    x.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// The radiograph itself: the collimated field is nearly black (fully exposed),
// the step wedge's five steps ladder up toward white as each one swallows more
// of the beam, and the un-irradiated border stays pale. That IS a radiograph —
// bright means "something absorbed it here".
function radiographTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#20252e'; // outside the collimated field — never exposed
  x.fillRect(0, 0, S, S);
  const m = S * 0.045;
  x.fillStyle = '#05070b'; // inside the field — full exposure, so black
  x.fillRect(m, m, S - m * 2, S - m * 2);

  // magnification from the wedge plane onto the panel
  const mag = SID / (WEDGE_X - FOCAL_X);
  const imgW = PANEL_S * 0.93; // the image plane's world width
  const bandW = ((WEDGE_HALF_Z * 2 * mag) / imgW) * S;
  const bandH = ((WEDGE_STEP * mag) / imgW) * S;
  const greys = [96, 140, 178, 210, 238]; // index 0 = thinnest step
  const x0 = S / 2 - bandW / 2;
  for (let i = 0; i < WEDGE_N; i++) {
    const g = greys[i];
    x.fillStyle = `rgb(${g},${g + 4},${g + 10})`;
    // i = 0 is the bottom (thinnest) step, so it lands lowest in the image
    x.fillRect(x0, S / 2 + bandH * (WEDGE_N / 2 - 1 - i), bandW + 1, bandH + 1);
  }
  // real detectors do not resolve a perfect edge — soften the whole thing
  x.filter = 'blur(2px)';
  x.drawImage(c, 0, 0);
  x.filter = 'none';

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Apex-at-origin square pyramid opening along +X, unit half-extents at x=1 —
// scale it into whatever field the shutters are currently passing.
function pyramidGeometry() {
  const corners = [
    [1, -1, -1],
    [1, -1, 1],
    [1, 1, 1],
    [1, 1, -1],
  ];
  const pos = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    pos.push(0, 0, 0, a[0], a[1], a[2], b[0], b[1], b[2]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export function buildXrayMachine({ scene }) {
  const sceneGroup = new THREE.Group();
  scene.add(sceneGroup);

  // --- materials --------------------------------------------------------------
  const shellMat = materials.paintedMetal(0x545a63);
  shellMat.clearcoat = 0.55;
  shellMat.clearcoatRoughness = 0.28;
  const plateMat = materials.paintedMetal(0x474c54);
  plateMat.clearcoat = 0.5;
  // lead lining: matte, dark, BackSide — we only ever see the FAR inner wall,
  // which gives the insert a dark backdrop instead of a concave metal mirror
  const linerMat = new THREE.MeshPhysicalMaterial({
    color: 0x16181c,
    metalness: 0,
    roughness: 0.95,
    side: THREE.BackSide,
  });
  const leadMat = materials.darkMetal(0x3b3f47);
  leadMat.roughness = 0.62;
  // plain transparent glass, NOT opticalGlass: this envelope has glowing
  // transparent CONTENTS (the electron stream), which a transmission pass
  // would simply not sample
  const glassMat = materials.glass(0xc2d8ff, 0.09);
  // FrontSide, not the preset's DoubleSide: in the macro shots the near and far
  // walls stacked into an opaque milky sheet you could not see the cathode
  // through. Culling the back wall halves it and still reads as glass.
  glassMat.side = THREE.FrontSide;
  // the oil is drawn as a thin sleeve rather than a solid fill — a full
  // translucent volume fogs the insert it is supposed to be protecting.
  // Tuning history worth keeping: 0.14 on DoubleSide read as an orange wall
  // standing in front of the tube; 0.055 overcorrected until its own callout
  // pointed at nothing visible. BackSide (far wall only) at 0.11 is the
  // window where it reads as a warm bath without hiding the insert.
  const oilMat = new THREE.MeshPhysicalMaterial({
    color: 0xdcb478,
    metalness: 0,
    roughness: 0.25,
    transparent: true,
    opacity: 0.11,
    depthWrite: false,
    side: THREE.BackSide,
  });
  const tungstenMat = materials.brushedSteel(0x8d939b);
  // 0.55 threw a blown-white specular ellipse across the whole disc
  tungstenMat.roughness = 0.72;
  const trackMat = materials.darkMetal(0x4d443a); // heat-darkened focal track
  trackMat.roughness = 0.78;
  const molyMat = materials.darkMetal(0x70767e);
  const copperMat = new THREE.MeshPhysicalMaterial({
    color: 0xc9814a,
    metalness: 1,
    roughness: 0.34,
  });
  const coreMat = materials.darkMetal(0x33363c);
  coreMat.roughness = 0.72;
  const cupMat = materials.darkMetal(0x8b9099);
  cupMat.roughness = 0.42;
  const filamentMat = materials.glow(0xfff0d0, 2.0);
  const mirrorMat = new THREE.MeshPhysicalMaterial({
    color: 0xdfe6ee,
    metalness: 1,
    roughness: 0.07,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const lampMat = materials.glow(0xfff2cc, 1.3);
  const bodyPolymer = materials.polymer(0x24272d);
  const railMat = materials.paintedMetal(0x2c3037);
  railMat.clearcoat = 0.5;
  const aluMat = materials.aluminum(0xb5bcc4);
  const acrylicMat = new THREE.MeshPhysicalMaterial({
    color: 0xcfe0f0,
    metalness: 0,
    roughness: 0.22,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const scintMat = new THREE.MeshPhysicalMaterial({
    color: 0xe6e0cd,
    metalness: 0,
    roughness: 0.62,
    emissive: 0x2a2a20,
    emissiveIntensity: 0.5,
  });
  const tftMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: pixelGridTexture(),
    metalness: 0.2,
    roughness: 0.55,
  });
  const beamMat = new THREE.MeshBasicMaterial({
    color: XRAY_COLOR,
    transparent: true,
    opacity: 0.07,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const photonMat = () => {
    const m = materials.glow(XRAY_COLOR, 1.7);
    m.transparent = true;
    m.opacity = 0;
    m.depthWrite = false;
    return m;
  };
  const electronMat = () => {
    const m = materials.glow(ELECTRON_COLOR, 1.8);
    m.transparent = true;
    m.opacity = 0;
    m.depthWrite = false;
    return m;
  };

  const revealDim = []; // tube-head skin — ghosts on reveal
  const internals = []; // insert, shutters, mirror — only shown revealed
  const panelDim = []; // detector skin — ghosts on setPanelCut
  const panelIn = []; // grid / scintillator / TFT — only shown cut

  const rememberGhostOrig = (mat) => {
    if (!mat.userData.ghostOrig) {
      mat.userData.ghostOrig = { clearcoat: mat.clearcoat ?? 0, metalness: mat.metalness ?? 0 };
    }
  };

  // --- plinth -------------------------------------------------------------------
  sceneGroup.add(studioPlinth({ w: 3.3, h: PLINTH_H, d: 1.5 }));

  // ============================================================================
  //  COLUMN — the floor stand that carries the tube head
  // ============================================================================
  const colBase = beveledBox(0.34, 0.06, 0.46, railMat, 0.02);
  colBase.position.set(-1.45, PLINTH_H + 0.03, 0);
  colBase.receiveShadow = true;
  sceneGroup.add(colBase);

  const column = beveledBox(0.16, 1.6, 0.22, railMat, 0.025);
  column.position.set(-1.45, PLINTH_H + 0.06 + 0.8, 0);
  sceneGroup.add(column);
  // rail detail: a machined slot down the front face
  const colSlot = beveledBox(0.03, 1.4, 0.06, leadMat, 0.01);
  colSlot.position.set(-1.37, PLINTH_H + 0.06 + 0.78, 0);
  sceneGroup.add(colSlot);

  const arm = beveledBox(0.3, 0.1, 0.14, railMat, 0.02);
  arm.position.set(-1.25, BEAM_Y + 0.17, 0);
  sceneGroup.add(arm);
  const trunnion = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.1, 20).rotateZ(Math.PI / 2),
    railMat,
  );
  trunnion.position.set(-1.11, BEAM_Y + 0.17, 0);
  sceneGroup.add(trunnion);

  // ============================================================================
  //  TUBE HEAD — lead-lined housing, port plate, HV receptacles
  // ============================================================================
  const headGroup = new THREE.Group();
  headGroup.position.set(AXIS_X, BEAM_Y, 0);
  sceneGroup.add(headGroup);

  // the shell is a partial cylinder: the 60-degree slot facing +X (theta = 90
  // in three's convention, where x = r*sin(theta)) is filled by a flat port
  // plate carrying a REAL hole — a solid wall with a painted-on window would
  // be a lie the beam passes straight through
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(
      HOUS_R,
      HOUS_R,
      HOUS_L,
      56,
      1,
      true,
      ((90 + GAP_DEG / 2) * Math.PI) / 180,
      ((360 - GAP_DEG) * Math.PI) / 180,
    ),
    shellMat,
  );
  shell.castShadow = true;
  headGroup.add(shell);
  revealDim.push(shell);

  const liner = new THREE.Mesh(
    new THREE.CylinderGeometry(
      HOUS_R - 0.014,
      HOUS_R - 0.014,
      HOUS_L - 0.01,
      48,
      1,
      true,
      ((90 + GAP_DEG / 2) * Math.PI) / 180,
      ((360 - GAP_DEG) * Math.PI) / 180,
    ),
    linerMat,
  );
  headGroup.add(liner);

  {
    // port plate: a rectangle with a real circular hole, extruded and stood up
    // in the shell's slot
    const halfZ = HOUS_R * Math.sin((GAP_DEG * Math.PI) / 360);
    const shape = new THREE.Shape();
    shape.moveTo(-halfZ, -HOUS_L / 2);
    shape.lineTo(halfZ, -HOUS_L / 2);
    shape.lineTo(halfZ, HOUS_L / 2);
    shape.lineTo(-halfZ, HOUS_L / 2);
    shape.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, PORT_R, 0, TAU, true);
    shape.holes.push(hole);
    const portPlate = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.016,
        bevelEnabled: true,
        bevelThickness: 0.004,
        bevelSize: 0.004,
        bevelSegments: 1,
      }),
      plateMat,
    );
    portPlate.rotation.y = Math.PI / 2; // extrusion now points along +X
    portPlate.position.set(PLATE_X, 0, 0);
    portPlate.castShadow = true;
    headGroup.add(portPlate);
    revealDim.push(portPlate);

    // the beryllium window itself — a thin disc sealing the port. A raised
    // collar around it does the real work of reading as a WINDOW: the disc
    // alone is paper-thin and shows as a 5px sliver from any camera that is
    // not square onto the port.
    // deliberately NOT in revealDim: the port hardware stays solid while the
    // housing ghosts, so the window still reads as a window in the cutaway
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(PORT_R + 0.02, PORT_R + 0.026, 0.032, 30).rotateZ(Math.PI / 2),
      plateMat,
    );
    collar.position.set(PLATE_X + 0.018, 0, 0);
    collar.castShadow = true;
    headGroup.add(collar);

    const window_ = new THREE.Mesh(
      new THREE.CylinderGeometry(PORT_R, PORT_R, 0.012, 28).rotateZ(Math.PI / 2),
      new THREE.MeshPhysicalMaterial({
        color: 0xc7d2bd,
        metalness: 0.85,
        roughness: 0.3,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      }),
    );
    window_.position.set(PLATE_X + 0.014, 0, 0);
    headGroup.add(window_);
  }

  const domeGeo = new THREE.SphereGeometry(HOUS_R, 40, 14, 0, TAU, 0, Math.PI / 2);
  const capTop = new THREE.Mesh(domeGeo, shellMat);
  capTop.scale.y = 0.38;
  capTop.position.y = HOUS_L / 2;
  capTop.castShadow = true;
  headGroup.add(capTop);
  revealDim.push(capTop);
  const capBottom = new THREE.Mesh(domeGeo, shellMat);
  capBottom.scale.y = -0.38;
  capBottom.position.y = -HOUS_L / 2;
  capBottom.castShadow = true;
  headGroup.add(capBottom);
  revealDim.push(capBottom);

  const capBolts = boltCircle(10, 0.15, 0.014, materials.brushedSteel(0xa8aeb6), 0.02);
  capBolts.position.y = HOUS_L / 2 + 0.03;
  headGroup.add(capBolts);
  capBolts.children.forEach((b) => revealDim.push(b));

  // two high-tension cable receptacles on the back — one per end of the tube
  for (const sy of [0.24, -0.24]) {
    const boss = new THREE.Mesh(
      new THREE.CylinderGeometry(0.058, 0.062, 0.12, 20).rotateZ(Math.PI / 2),
      shellMat,
    );
    boss.position.set(-HOUS_R - 0.04, sy, 0);
    boss.castShadow = true;
    headGroup.add(boss);
    revealDim.push(boss);
    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.036, 0.1, 16).rotateZ(Math.PI / 2),
      materials.rubber(0x15171a),
    );
    cable.position.set(-HOUS_R - 0.13, sy, 0);
    headGroup.add(cable);
    revealDim.push(cable);
  }

  // oil sleeve — the insulating bath, read as a film against the liner
  const oilSleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(HOUS_R - 0.03, HOUS_R - 0.03, HOUS_L - 0.06, 40, 1, true),
    oilMat,
  );
  headGroup.add(oilSleeve);
  internals.push(oilSleeve);

  // ============================================================================
  //  THE INSERT — glass envelope, anode assembly, cathode assembly
  //  Local Y is the tube axis: cathode up top, anode at the bottom, so the
  //  electrons literally fall onto the target and the X-rays leave sideways.
  // ============================================================================
  const tubeGroup = new THREE.Group();
  headGroup.add(tubeGroup);

  const envelope = lathe(
    [
      [0.0, -0.34],
      [0.03, -0.34],
      [0.03, -0.3],
      [0.06, -0.28],
      [0.06, -0.12],
      [ENV_R, -0.05],
      [ENV_R, 0.18],
      [0.07, 0.25],
      [0.04, 0.29],
      [0.04, 0.34],
      [0.0, 0.34],
    ],
    glassMat,
    48,
  );
  tubeGroup.add(envelope);
  internals.push(envelope);

  // --- anode ------------------------------------------------------------------
  const anodeGroup = new THREE.Group(); // spins about the tube axis
  tubeGroup.add(anodeGroup);
  internals.push(anodeGroup);

  const bevelDrop = (DISC_R - 0.055) * Math.tan(BEVEL);
  const anodeDisc = lathe(
    [
      [0.0, -DISC_T],
      [DISC_R, -DISC_T],
      [DISC_R, -bevelDrop / 2],
      [0.055, bevelDrop / 2],
      [0.0, bevelDrop / 2],
    ],
    tungstenMat,
    56,
  );
  anodeGroup.add(anodeDisc);

  // the focal track: the ring the electrons actually land on, discoloured by
  // a working life of 2,500-degree hammering
  const focalTrack = lathe(
    [
      [0.058, bevelDrop / 2 - (0.058 - 0.055) * Math.tan(BEVEL) + 0.0006],
      [0.086, bevelDrop / 2 - (0.086 - 0.055) * Math.tan(BEVEL) + 0.0006],
    ],
    trackMat,
    56,
  );
  focalTrack.material.side = THREE.DoubleSide;
  anodeGroup.add(focalTrack);

  const stem = rod(0.014, 0.1, molyMat, 14);
  stem.rotation.z = Math.PI; // hangs downward from the disc
  stem.position.y = -DISC_T;
  anodeGroup.add(stem);

  const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 26), copperMat);
  rotor.position.y = -0.185;
  anodeGroup.add(rotor);
  for (let i = 0; i < 3; i++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.0455, 0.004, 8, 26), coreMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = -0.13 - i * 0.055;
    anodeGroup.add(band);
  }
  const bearing = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.06, 16), molyMat);
  bearing.position.y = -0.285;
  anodeGroup.add(bearing);

  // stator: laminated core + windings, OUTSIDE the glass. Deliberately not a
  // child of anodeGroup — it never turns; it just makes the rotor turn.
  // sits LOW on the rotor: covering its whole length would hide the very part
  // the copy names, and a callout pointing at a part you cannot see is a bug
  const statorGroup = new THREE.Group();
  statorGroup.position.y = -0.235;
  tubeGroup.add(statorGroup);
  internals.push(statorGroup);
  // core INSIDE, windings OUTSIDE it: wound the other way round the copper
  // would be hidden inside its own core and the callout would point at a
  // featureless dark tube
  const statorCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.072, 0.13, 32, 1, true),
    coreMat,
  );
  statorGroup.add(statorCore);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const winding = coil(
      { turns: 5, radius: 0.02, length: 0.11, wireRadius: 0.0055, segmentsPerTurn: 12 },
      copperMat,
    ).mesh;
    winding.position.set(Math.cos(a) * 0.094, 0, Math.sin(a) * 0.094);
    statorGroup.add(winding);
  }

  // --- cathode ----------------------------------------------------------------
  // Drawn ~2x oversize (see header). Sits directly above the focal track, so
  // the electron path is a short vertical drop onto the bevel.
  const cathodeGroup = new THREE.Group();
  cathodeGroup.position.set(TRACK_R, CATH_Y, 0);
  tubeGroup.add(cathodeGroup);
  internals.push(cathodeGroup);

  const cup = lathe(
    [
      [0.0, 0.04],
      [0.03, 0.04],
      [0.03, 0.0],
      [0.021, 0.0],
      [0.021, 0.024],
      [0.0, 0.024],
    ],
    cupMat,
    32,
  );
  cup.material.side = THREE.DoubleSide;
  cathodeGroup.add(cup);

  // The coil sits AT the cup's mouth, not up inside it: recessed, the cup's own
  // rim hid the one part this step is about from every camera above the beam.
  const filament = coil(
    { turns: 7, radius: 0.0105, length: 0.032, wireRadius: 0.003, segmentsPerTurn: 14 },
    filamentMat,
  ).mesh;
  filament.rotation.x = Math.PI / 2; // coil axis across the beam, as it really lies
  filament.position.y = -0.006;
  cathodeGroup.add(filament);

  const cathodeStem = rod(0.011, 0.11, cupMat, 12);
  cathodeStem.position.y = 0.04;
  cathodeGroup.add(cathodeStem);
  for (const sz of [-0.014, 0.014]) {
    const lead = rod(0.0035, 0.1, molyMat, 8);
    lead.position.set(0, 0.038, sz);
    cathodeGroup.add(lead);
  }

  // --- the electron stream ------------------------------------------------------
  const electronGroup = new THREE.Group();
  tubeGroup.add(electronGroup);
  internals.push(electronGroup);
  const N_ELECTRON = 18;
  const electronGeo = new THREE.SphereGeometry(0.0055, 8, 6);
  const electrons = [];
  for (let i = 0; i < N_ELECTRON; i++) {
    const d = new THREE.Mesh(electronGeo, electronMat());
    d.userData.spread = ((i % 6) / 5 - 0.5) * 0.03;
    electronGroup.add(d);
    electrons.push(d);
  }

  // ============================================================================
  //  COLLIMATOR — body, two pairs of lead shutters, light-field mirror + lamp
  // ============================================================================
  const collimator = new THREE.Group();
  collimator.position.set(COL_CX, BEAM_Y, 0);
  sceneGroup.add(collimator);

  const colBody = beveledBox(COL_W, 0.4, 0.4, shellMat, 0.02);
  colBody.castShadow = true;
  collimator.add(colBody);
  revealDim.push(colBody);
  const colCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 0.06, 24).rotateZ(Math.PI / 2),
    plateMat,
  );
  colCollar.position.x = -COL_W / 2 - 0.02;
  collimator.add(colCollar);
  revealDim.push(colCollar);
  // exit face: a real square aperture, not a painted one
  for (const [sy, sz] of [
    [0.165, 0],
    [-0.165, 0],
    [0, 0.165],
    [0, -0.165],
  ]) {
    const lip = beveledBox(0.03, sy ? 0.07 : 0.4, sz ? 0.07 : 0.4, plateMat, 0.008);
    lip.position.set(COL_W / 2 + 0.012, sy, sz);
    collimator.add(lip);
    revealDim.push(lip);
  }

  const shutters = [];
  for (const [axis, sign] of [
    ['z', 1],
    ['z', -1],
    ['y', 1],
    ['y', -1],
  ]) {
    const blade =
      axis === 'z'
        ? beveledBox(0.11, 0.3, 0.16, leadMat, 0.006)
        : beveledBox(0.11, 0.16, 0.3, leadMat, 0.006);
    blade.userData.axis = axis;
    blade.userData.sign = sign;
    blade.position.x = BLADE_X - COL_CX;
    collimator.add(blade);
    internals.push(blade);
    shutters.push(blade);
  }

  const mirror = beveledBox(0.22, 0.006, 0.22, mirrorMat, 0.003);
  mirror.rotation.z = -Math.PI / 4; // folds the lamp's light along the beam
  mirror.position.set(-0.1, 0, 0);
  collimator.add(mirror);
  internals.push(mirror);

  const lampBox = beveledBox(0.08, 0.06, 0.09, coreMat, 0.01);
  lampBox.position.set(-0.1, 0.155, 0);
  collimator.add(lampBox);
  internals.push(lampBox);
  const lampLens = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 10), lampMat);
  lampLens.position.set(-0.1, 0.12, 0);
  collimator.add(lampLens);
  internals.push(lampLens);

  // ============================================================================
  //  LEAKED RADIATION — the ~99% of the emitted X-rays that do NOT leave through
  //  the port, stopped dead by the lead lining. Step 6 only.
  // ============================================================================
  const leakGroup = new THREE.Group();
  leakGroup.position.set(TRACK_R, 0, 0); // the focal spot, in head-local space
  headGroup.add(leakGroup);
  internals.push(leakGroup);
  const leakMat = new THREE.MeshBasicMaterial({
    color: XRAY_COLOR,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    const plane = i % 2 === 0;
    const dir = new THREE.Vector3(
      Math.cos(a) * 0.55,
      Math.sin(a),
      plane ? Math.sin(a) * 0.7 : 0,
    ).normalize();
    if (dir.x > 0.75) continue; // that one leaves through the port — it is the beam
    const len = 0.14;
    const ray = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.007, len, 6), leakMat);
    ray.position.copy(dir.clone().multiplyScalar(0.035 + len / 2));
    ray.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    leakGroup.add(ray);
  }

  // ============================================================================
  //  THE BEAM — a square pyramid from the focal spot, plus photons riding it
  // ============================================================================
  const beamGroup = new THREE.Group();
  sceneGroup.add(beamGroup);
  const beamCone = new THREE.Mesh(pyramidGeometry(), beamMat);
  beamCone.position.set(FOCAL_X, BEAM_Y, 0);
  beamGroup.add(beamCone);

  const N_PHOTON = 42;
  const photonGeo = new THREE.SphereGeometry(0.0085, 8, 6);
  const photons = [];
  for (let i = 0; i < N_PHOTON; i++) {
    const d = new THREE.Mesh(photonGeo, photonMat());
    // a fixed, evenly-scattered direction per photon (deterministic — the same
    // pattern every lap, so the loop is genuinely seamless)
    const g = i * 0.6180339887;
    d.userData.fy = ((g * 3) % 1) * 2 - 1;
    d.userData.fz = ((g * 7) % 1) * 2 - 1;
    d.userData.roll = (g * 11) % 1; // decides whether the wedge eats this one
    beamGroup.add(d);
    photons.push(d);
  }

  // ============================================================================
  //  STEP WEDGE — the subject: five thicknesses of aluminium on an acrylic stand
  // ============================================================================
  const wedgeGroup = new THREE.Group();
  wedgeGroup.position.set(0, BEAM_Y, 0);
  sceneGroup.add(wedgeGroup);
  for (let i = 0; i < WEDGE_N; i++) {
    const t = WEDGE_T[i];
    const step = beveledBox(t, WEDGE_STEP - 0.002, WEDGE_HALF_Z * 2, aluMat, 0.004);
    step.position.set(WEDGE_X - t / 2, -WEDGE_HALF_Y + (i + 0.5) * WEDGE_STEP, 0);
    step.castShadow = true;
    wedgeGroup.add(step);
  }
  const postH = BEAM_Y - WEDGE_HALF_Y - PLINTH_H;
  for (const sz of [-1, 1]) {
    const post = beveledBox(0.026, postH, 0.026, acrylicMat, 0.005);
    post.position.set(WEDGE_X - 0.05, -WEDGE_HALF_Y - postH / 2, sz * (WEDGE_HALF_Z + 0.03));
    wedgeGroup.add(post);
  }
  const cradle = beveledBox(0.1, 0.012, WEDGE_HALF_Z * 2 + 0.08, acrylicMat, 0.004);
  cradle.position.set(WEDGE_X - 0.05, -WEDGE_HALF_Y - 0.007, 0);
  wedgeGroup.add(cradle);
  const wedgeFoot = beveledBox(0.2, 0.026, 0.4, railMat, 0.01);
  wedgeFoot.position.set(WEDGE_X - 0.05, PLINTH_H - BEAM_Y + 0.013, 0);
  wedgeGroup.add(wedgeFoot);

  // ============================================================================
  //  DETECTOR — upright flat panel: cover, anti-scatter grid, CsI, TFT array
  // ============================================================================
  const detBase = beveledBox(0.3, 0.06, 0.46, railMat, 0.02);
  detBase.position.set(1.05, PLINTH_H + 0.03, 0);
  sceneGroup.add(detBase);
  const detRail = beveledBox(0.14, 1.5, 0.2, railMat, 0.025);
  detRail.position.set(1.05, PLINTH_H + 0.06 + 0.75, 0);
  sceneGroup.add(detRail);
  const detBracket = beveledBox(0.2, 0.16, 0.18, railMat, 0.02);
  detBracket.position.set(0.94, BEAM_Y, 0);
  sceneGroup.add(detBracket);

  const panelGroup = new THREE.Group();
  panelGroup.position.set(PANEL_CX, BEAM_Y, 0);
  sceneGroup.add(panelGroup);

  const panelShell = beveledBox(PANEL_T, PANEL_S + 0.08, PANEL_S + 0.08, bodyPolymer, 0.018);
  panelShell.castShadow = true;
  panelGroup.add(panelShell);
  panelDim.push(panelShell);
  const panelCover = beveledBox(0.014, PANEL_S, PANEL_S, materials.polymer(0x33373d), 0.006);
  panelCover.position.x = -PANEL_T / 2 + 0.008;
  panelGroup.add(panelCover);
  panelDim.push(panelCover);

  // anti-scatter grid: lead strips on edge, aimed at the focal spot
  const gridGroup = new THREE.Group();
  gridGroup.position.x = -0.03;
  panelGroup.add(gridGroup);
  panelIn.push(gridGroup);
  const N_STRIP = 34;
  for (let i = 0; i < N_STRIP; i++) {
    const z = (i / (N_STRIP - 1) - 0.5) * PANEL_S;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.018, PANEL_S, 0.0035), leadMat);
    strip.position.set(0, 0, z);
    strip.rotation.y = -Math.atan2(z, SID); // focused grid: each strip points home
    gridGroup.add(strip);
  }

  const scintillator = beveledBox(0.012, PANEL_S - 0.04, PANEL_S - 0.04, scintMat, 0.004);
  scintillator.position.x = -0.006;
  panelGroup.add(scintillator);
  panelIn.push(scintillator);

  const tftArray = beveledBox(0.01, PANEL_S - 0.04, PANEL_S - 0.04, tftMat, 0.004);
  tftArray.position.x = 0.014;
  panelGroup.add(tftArray);
  panelIn.push(tftArray);

  for (const sy of [-1, 1]) {
    const board = beveledBox(0.02, 0.07, PANEL_S - 0.06, materials.darkMetal(0x1f3a33), 0.005);
    board.position.set(0.038, sy * (PANEL_S / 2 - 0.02), 0);
    panelGroup.add(board);
    panelIn.push(board);
  }

  // the radiograph itself — a self-lit plate just proud of the panel face
  const imageMat = new THREE.MeshBasicMaterial({
    map: radiographTexture(),
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const imagePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(PANEL_S * 0.93, PANEL_S * 0.93),
    imageMat,
  );
  imagePlane.rotation.y = -Math.PI / 2; // faces back up the beam
  imagePlane.position.x = -PANEL_T / 2 - 0.006;
  panelGroup.add(imagePlane);

  // ============================================================================
  //  CALLOUTS
  // ============================================================================
  const labels = calloutSets([
    'exterior',
    'head',
    'cathode',
    'anode',
    'beam',
    'shadow',
    'detector',
  ]);

  labels.add('exterior', sceneGroup, 'Tube head', [AXIS_X + 0.06, BEAM_Y + 0.33, 0.12], 100, 74);
  labels.add('exterior', sceneGroup, 'Collimator', [COL_CX + 0.1, BEAM_Y - 0.2, 0.19], -62, 84);
  labels.add(
    'exterior',
    sceneGroup,
    'Aluminium step wedge',
    [WEDGE_X, BEAM_Y + WEDGE_HALF_Y - 0.02, 0.06],
    80,
    96,
  );
  labels.add(
    'exterior',
    sceneGroup,
    'Flat-panel detector',
    [PANEL_FACE_X, BEAM_Y + 0.34, 0.2],
    55,
    86,
  );

  labels.add('head', sceneGroup, 'Lead-lined housing', [AXIS_X - 0.1, BEAM_Y + 0.35, 0.1], 105, 82);
  labels.add(
    'head',
    sceneGroup,
    'Glass envelope — vacuum inside',
    [AXIS_X + 0.1, BEAM_Y + 0.2, 0.06],
    50,
    92,
  );
  labels.add('head', sceneGroup, 'Insulating oil', [AXIS_X + 0.16, BEAM_Y - 0.26, 0.06], -48, 92);
  labels.add(
    'head',
    sceneGroup,
    'Beryllium window',
    [AXIS_X + HOUS_R + 0.01, BEAM_Y - 0.03, 0.02],
    -25, 104,
  );

  labels.add('cathode', cathodeGroup, 'Tungsten filament · 2,000 °C', [0, -0.006, 0.022], 55, 108);
  labels.add('cathode', cathodeGroup, 'Focusing cup', [0.028, 0.02, 0], -55, 94);
  labels.add('cathode', tubeGroup, 'Electrons boil off', [TRACK_R, CATH_Y * 0.55, 0.02], 20, 108);

  labels.add(
    'anode',
    tubeGroup,
    'Tungsten-rhenium disc · 90 mm',
    [0.0, bevelDrop / 2 + 0.005, -0.05],
    75,
    104,
  );
  labels.add('anode', tubeGroup, 'Focal track', [TRACK_R, 0.004, 0.03], 18, 108);
  // near rim, on the camera's side — the far rim is behind the disc it names
  labels.add('anode', tubeGroup, '16° bevel', [-0.03, -0.002, DISC_R - 0.014], 118, 70);
  labels.add('anode', tubeGroup, 'Rotor — inside the vacuum', [0.0, -0.14, 0.048], -35, 104);
  labels.add('anode', tubeGroup, 'Stator — outside the glass', [0.1, -0.245, 0.03], -18, 112);

  labels.add('beam', collimator, 'Lead shutters', [0, 0.17, 0.06], 92, 82);
  labels.add('beam', collimator, 'Light-field mirror', [-0.1, -0.06, 0.08], -80, 96);
  labels.add(
    'beam',
    sceneGroup,
    'Lead soaks up all the rest',
    [AXIS_X + 0.02, BEAM_Y + 0.2, 0.1],
    58,
    96,
  );

  labels.add(
    'shadow',
    sceneGroup,
    'Aluminium step wedge',
    [WEDGE_X - 0.02, BEAM_Y - 0.08, 0.06],
    -50,
    96,
  );
  // ON the thickest step — anchored at the bottom of the ladder this label
  // pointed at the THINNEST one and contradicted its own text
  labels.add(
    'shadow',
    sceneGroup,
    'Thick steps stop more',
    [WEDGE_X - 0.04, BEAM_Y + WEDGE_HALF_Y - 0.035, 0.05],
    45,
    100,
  );
  labels.add('shadow', sceneGroup, 'The shadow', [PANEL_FACE_X, BEAM_Y + 0.14, -0.2], 58, 96);
  labels.add(
    'shadow',
    sceneGroup,
    'Flat-panel detector',
    [PANEL_FACE_X, BEAM_Y + 0.36, 0.24],
    38,
    88,
  );

  labels.add('detector', sceneGroup, 'Anti-scatter grid', [PANEL_FACE_X, BEAM_Y + 0.3, 0.24], 62, 92);
  labels.add(
    'detector',
    sceneGroup,
    'CsI scintillator → light',
    [PANEL_FACE_X + 0.02, BEAM_Y - 0.02, 0.3],
    18,
    100,
  );
  labels.add(
    'detector',
    sceneGroup,
    'TFT photodiode array',
    [PANEL_FACE_X + 0.06, BEAM_Y - 0.3, 0.26],
    -40,
    100,
  );
  labels.add('detector', sceneGroup, 'The shadow', [PANEL_FACE_X, BEAM_Y + 0.05, -0.16], 62, 96);

  // ============================================================================
  //  POSE — one phase scalar, plus the pinned state each step sets on entry
  // ============================================================================
  let revealed = false;
  let beamOn = 0;
  let shutterOpen = 1;
  let leakOn = false;

  function applyShutters() {
    const half = 0.014 + shutterOpen * (APERTURE_MAX - 0.014);
    for (const b of shutters) {
      // blades are 0.16 thick across the crop axis — park each one so its
      // INNER edge sits exactly on the aperture
      const off = b.userData.sign * (half + 0.08);
      if (b.userData.axis === 'z') b.position.z = off;
      else b.position.y = off;
    }
    // the emitted field, scaled onto the panel plane
    const halfField = (half / (BLADE_X - FOCAL_X)) * SID;
    beamCone.scale.set(SID, halfField, halfField);
  }

  function setReveal(t) {
    const r = clamp01(t);
    revealed = r > 0.4;
    const op = 1 - r * 0.88;
    const ghosted = r > 0.02;
    for (const m of revealDim) {
      const mat = m.material;
      rememberGhostOrig(mat);
      const o = mat.userData.ghostOrig;
      mat.transparent = ghosted;
      mat.opacity = op;
      mat.depthWrite = r < 0.4;
      // clearcoat renders at full strength no matter the opacity — a ghosted
      // shell with its coat left on still reads as solid
      mat.clearcoat = ghosted ? 0 : o.clearcoat;
      mat.metalness = ghosted ? o.metalness * 0.15 : o.metalness;
    }
    for (const o of internals) o.visible = revealed;
    leakGroup.visible = revealed && leakOn;
  }

  function setPanelCut(t) {
    const r = clamp01(t);
    const op = 1 - r * 0.9;
    const ghosted = r > 0.02;
    for (const m of panelDim) {
      const mat = m.material;
      rememberGhostOrig(mat);
      const o = mat.userData.ghostOrig;
      mat.transparent = ghosted;
      mat.opacity = op;
      mat.depthWrite = r < 0.4;
      mat.clearcoat = ghosted ? 0 : o.clearcoat;
    }
    for (const o of panelIn) o.visible = r > 0.4;
  }

  function setShutter(open) {
    shutterOpen = clamp01(open);
    applyShutters();
  }

  function setBeam(intensity) {
    beamOn = clamp01(intensity);
    beamMat.opacity = 0.11 * beamOn;
    beamCone.visible = beamOn > 0.01;
    leakMat.opacity = 0.32 * beamOn;
  }

  function setLeak(on) {
    leakOn = !!on;
    leakGroup.visible = revealed && leakOn;
  }

  function setImage(t) {
    imageMat.opacity = clamp01(t) * 0.95;
  }

  function setPhase(u) {
    const p = ((u % 1) + 1) % 1;
    // 6 whole turns per lap — the wrap pose is identical. A real anode does
    // 3,000 rpm; shown slowed, or it would just be a blur.
    anodeGroup.rotation.y = p * TAU * 6;

    // filament brightness breathes on whole cycles per lap
    const breathe = 0.5 + 0.5 * Math.sin(p * TAU * 2);
    filamentMat.emissiveIntensity = 1.5 + breathe * 0.9;

    // --- electrons: cathode -> focal track, converging as they fall ----------
    const eVisible = revealed && beamOn > 0.05;
    electrons.forEach((d, i) => {
      const t = ((p * 5 + i / N_ELECTRON) % 1 + 1) % 1;
      const conv = 1 - t;
      d.position.set(
        TRACK_R + d.userData.spread * conv * 0.6,
        CATH_Y * (1 - t) + 0.004,
        d.userData.spread * conv,
      );
      d.material.opacity = eVisible ? Math.min(1, t * 6) * (1 - t * 0.15) * beamOn : 0;
    });

    // --- photons: focal spot -> panel, with the wedge eating its share -------
    const half = 0.014 + shutterOpen * (APERTURE_MAX - 0.014);
    const halfField = (half / (BLADE_X - FOCAL_X)) * SID;
    const tWedge = (WEDGE_X - FOCAL_X) / SID;
    photons.forEach((d, i) => {
      const t = ((p * 3 + i / N_PHOTON) % 1 + 1) % 1;
      const y = BEAM_Y + d.userData.fy * halfField * t;
      const z = d.userData.fz * halfField * t;
      d.position.set(FOCAL_X + t * SID, y, z);
      let alive = beamOn;
      if (t > tWedge) {
        // where would this photon have crossed the wedge, and through which
        // step? Thicker steps kill a bigger fraction — the roll is fixed per
        // photon, so the same ones die every lap and the loop stays seamless.
        const wy = BEAM_Y + d.userData.fy * halfField * tWedge;
        const wz = d.userData.fz * halfField * tWedge;
        if (Math.abs(wy - BEAM_Y) < WEDGE_HALF_Y && Math.abs(wz) < WEDGE_HALF_Z) {
          const k = Math.min(
            WEDGE_N - 1,
            Math.max(0, Math.floor((wy - BEAM_Y + WEDGE_HALF_Y) / WEDGE_STEP)),
          );
          if (d.userData.roll > WEDGE_PASS[k]) alive = 0;
        }
      }
      d.material.opacity = alive * Math.min(1, t * 10) * (1 - t * 0.1);
    });
  }

  function setLabels(mode) {
    labels.setLabels(mode);
  }

  // initial state: sealed, running, beam live
  setReveal(0);
  setPanelCut(0);
  setShutter(1);
  setBeam(1);
  setLeak(false);
  setImage(0);
  setPhase(0);
  setLabels(false);

  return {
    group: sceneGroup,
    setReveal,
    setPanelCut,
    setShutter,
    setBeam,
    setLeak,
    setImage,
    setPhase,
    setLabels,
    parts: {
      headGroup,
      tubeGroup,
      anodeGroup,
      cathodeGroup,
      statorGroup,
      collimator,
      panelGroup,
      wedgeGroup,
      beamGroup,
      electronGroup,
    },
  };
}
