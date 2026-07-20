import * as THREE from 'three';
import { materials, disc, rod, studioPlinth } from '../../framework/parts.js';
import { beveledBox } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, smooth, win, TAU } from '../../framework/motion.js';

// A countertop microwave oven, presented as a studio product shot. Reveal
// story: sealed running oven -> ghost the body to expose the cavity,
// turntable, magnetron and waveguide -> mechanism beat by beat -> water
// molecules flipping in the field -> run.
//
// PROPORTIONS: real countertop body ratio ~48:28:40 cm (W:H:D) -> world units
// BODY_W 2.6 / BODY_H 1.5 / BODY_D 2.2 (same ~1.73:1:1.47 ratio). Door on the
// +Z face, hinged at -X, ~72% of the front width; a control-panel strip
// fills the remaining ~28%.
//
// MECHANISM (researched — cavity magnetron + standing-wave heating):
// a magnetron is a vacuum tube: a heated CATHODE rod sits at the axis of a
// ring of 12 copper ANODE VANES (the gaps between vanes are resonant
// cavities); two horizontal ring MAGNETS sandwich the vane block, crossing
// an axial magnetic field with the cathode-to-anode electric field. Electrons
// boiled off the cathode are forced into curved, looping paths by that
// crossed field — a rotating "spoke" pattern of electron bunches sweeps past
// the cavities and excites them into oscillation at 2.45 GHz. An ANTENNA
// loop taps that oscillation off into a WAVEGUIDE duct, which feeds it into
// the oven cavity (a small STIRRER fan at the feed point scatters it
// further). Inside the metal cavity the waves reflect off every wall and
// build a 3-D STANDING WAVE — fixed nodes (cold) and antinodes (hot) about
// 6 cm apart (half the 12.2 cm wavelength) — which is exactly why a
// TURNTABLE exists: it drags food through both, averaging the exposure.
// The door's window looks like plain glass but is backed by a metal MESH
// whose holes are far smaller than 12.2 cm — a Faraday cage that blocks the
// microwaves while visible light (a million times shorter wavelength) sails
// straight through. Heating itself is dielectric: the oscillating electric
// field grabs POLAR WATER MOLECULES and flips their orientation back and
// forth 2.45 billion times a second; that forced rotation fights molecular
// friction, and the friction is the heat. It penetrates a few centimetres in
// from the surface — ordinary conduction carries it deeper, not a literal
// "inside-out" cook.
// Sources: scienceabc.com/innovation/how-does-a-microwave-oven-work,
// eeeguide.com/cavity-magnetron-working, explainthatstuff.com/microwaveovens.

const BODY_W = 2.6;
const BODY_H = 1.5;
const BODY_D = 2.2;
const PLINTH_H = 0.24;
const BODY_Y0 = PLINTH_H; // body sits on the plinth top
const BODY_CY = BODY_Y0 + BODY_H / 2;

const DOOR_W = BODY_W * 0.72;
const DOOR_H = BODY_H * 0.82;
const DOOR_X0 = -BODY_W / 2 + 0.035; // hinge-side inset
const PANEL_X0 = DOOR_X0 + DOOR_W + 0.06; // control panel strip, remaining width

const CAV_FLOOR_Y = BODY_Y0 + 0.16; // interior floor height (inside the ghosted shell)
const TURN_R = 0.78;

// magnetron (vertical axis) — back-right, up near the body's top. -0.55
// (not -0.34) leaves room for the vane block + antenna + waveguide duct
// above it to stay inside the sealed body — the duct poked through the roof
// at -0.34 before this was checked against BODY_H.
const MAG_X = 0.78;
const MAG_Y = BODY_Y0 + BODY_H - 0.55;
const MAG_Z = -0.55;
const CATH_R = 0.035;
const ANODE_OUT_R = 0.24;
const ANODE_H = 0.18;
const VANES = 12;

const FIELD_COLOR = 0xffb02e; // amber — standing wave (matches accent)
const ELECTRON_COLOR = 0x9d7bff; // violet — electron spokes

export function buildMicrowave({ scene }) {
  const sceneGroup = new THREE.Group();
  scene.add(sceneGroup);

  // --- materials --------------------------------------------------------------
  const bodyPlastic = materials.paintedMetal(0xe8e5dc);
  bodyPlastic.clearcoat = 0.65;
  bodyPlastic.clearcoatRoughness = 0.25;
  const panelPlastic = materials.paintedMetal(0x24262b);
  panelPlastic.clearcoat = 0.5;
  // See-through window glass: real microwave door glass is transparent (the
  // Faraday MESH bars in front do the shielding). Ghost via opacity, not
  // transmission — transmission glass hides the transparent cavity contents
  // behind it, and clearcoat ignores opacity so it's kept low here.
  const doorGlass = new THREE.MeshPhysicalMaterial({
    color: 0x9fb2c2,
    metalness: 0,
    roughness: 0.18,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    clearcoat: 0.4,
    clearcoatRoughness: 0.15,
    side: THREE.DoubleSide,
  });
  const meshBarMat = materials.darkMetal(0x35383e);
  const handleMat = materials.chrome(0xcfd3d9);
  const displayMat = materials.glow(0xff9a3d, 1.1);
  const buttonMat = materials.darkMetal(0x3a3d43);
  const copper = new THREE.MeshPhysicalMaterial({ color: 0xc9814a, metalness: 1, roughness: 0.3 });
  const ferriteMat = materials.darkMetal(0x2a2c30);
  ferriteMat.roughness = 0.7;
  // pale white-hot, deliberately distinct from the copper vanes it sits
  // among — a same-hue glow was found to blend invisibly into them
  const cathodeMat = materials.glow(0xfff2d9, 2.2);
  const glassTurntable = new THREE.MeshPhysicalMaterial({
    color: 0xcfe0f0,
    metalness: 0,
    roughness: 0.4, // 0.1 threw a blown-out direct-light glare streak across the disc
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const hubMat = materials.darkMetal(0x44484f);
  const bowlMat = new THREE.MeshPhysicalMaterial({ color: 0xf2efe6, roughness: 0.5, metalness: 0 });
  const foodMat = new THREE.MeshPhysicalMaterial({ color: 0xd9973e, roughness: 0.6, metalness: 0 });
  const fieldDotMat = () => {
    const m = materials.glow(FIELD_COLOR, 1.4);
    m.transparent = true;
    m.depthWrite = false;
    return m;
  };
  const electronMat = () => {
    const m = materials.glow(ELECTRON_COLOR, 1.8);
    m.transparent = true;
    m.depthWrite = false;
    return m;
  };
  const oxygenMat = new THREE.MeshPhysicalMaterial({
    color: 0xff5a4d,
    emissive: 0xff5a4d,
    emissiveIntensity: 0.4,
    roughness: 0.4,
  });
  const hydrogenMat = new THREE.MeshPhysicalMaterial({ color: 0xf0f0f0, roughness: 0.4 });
  const bondMat = materials.darkMetal(0x9aa0a8);

  const revealDim = []; // outer shell — ghosts on reveal
  const internals = []; // cavity/magnetron/waveguide — shown only revealed

  const rememberGhostOrig = (mat) => {
    if (!mat.userData.ghostOrig) {
      mat.userData.ghostOrig = { clearcoat: mat.clearcoat ?? 0, metalness: mat.metalness ?? 0 };
    }
  };

  // --- plinth -------------------------------------------------------------------
  const plinth = studioPlinth({ w: BODY_W + 0.7, h: PLINTH_H, d: BODY_D + 0.6 });
  sceneGroup.add(plinth);

  // ============================================================================
  //  OUTER SHELL — body, door + window + mesh, control panel, handle, vent
  // ============================================================================
  const body = beveledBox(BODY_W, BODY_H, BODY_D, bodyPlastic, 0.045);
  body.position.set(0, BODY_CY, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  sceneGroup.add(body);
  revealDim.push(body);

  // door: frame + inset glass window + Faraday mesh bars, mounted flush on +Z
  const doorGroup = new THREE.Group();
  doorGroup.position.set(DOOR_X0 + DOOR_W / 2, BODY_CY, BODY_D / 2 + 0.02);
  sceneGroup.add(doorGroup);
  const doorFrame = beveledBox(DOOR_W, DOOR_H, 0.04, bodyPlastic, 0.03);
  doorGroup.add(doorFrame);
  revealDim.push(doorFrame);
  const windowW = DOOR_W - 0.16;
  const windowH = DOOR_H - 0.16;
  const window_ = new THREE.Mesh(new THREE.PlaneGeometry(windowW, windowH), doorGlass);
  window_.position.z = 0.021;
  doorGroup.add(window_);
  revealDim.push(window_);
  // Faraday mesh: a real physical detail, not a decal — a grid of thin dark
  // bars laid directly over the glass. Holes far smaller than 12.2cm block
  // microwaves; visible light (far shorter wavelength) passes through anyway.
  const BAR_T = 0.012;
  for (let i = 0; i <= 9; i++) {
    const x = -windowW / 2 + (i / 9) * windowW;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(BAR_T, windowH, 0.008), meshBarMat);
    bar.position.set(x, 0, 0.03);
    doorGroup.add(bar);
    revealDim.push(bar);
  }
  for (let i = 0; i <= 6; i++) {
    const y = -windowH / 2 + (i / 6) * windowH;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(windowW, BAR_T, 0.008), meshBarMat);
    bar.position.set(0, y, 0.03);
    doorGroup.add(bar);
    revealDim.push(bar);
  }
  // handle: vertical chrome bar on the door's outer (right) edge
  const handle = rod(0.014, DOOR_H * 0.7, handleMat, 12);
  handle.rotation.x = -Math.PI / 2;
  handle.position.set(DOOR_W / 2 - 0.03, -DOOR_H * 0.35, 0.05);
  doorGroup.add(handle);
  revealDim.push(handle);

  // control panel: dark strip to the right of the door
  const panelW = BODY_W / 2 - PANEL_X0;
  const panelCX = PANEL_X0 + panelW / 2;
  const panel = beveledBox(panelW, DOOR_H, 0.03, panelPlastic, 0.015);
  panel.position.set(panelCX, BODY_CY, BODY_D / 2 + 0.016);
  sceneGroup.add(panel);
  revealDim.push(panel);
  const display = new THREE.Mesh(new THREE.PlaneGeometry(panelW - 0.1, 0.16), displayMat);
  display.position.set(panelCX, BODY_CY + DOOR_H * 0.32, BODY_D / 2 + 0.032);
  sceneGroup.add(display);
  revealDim.push(display);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16), buttonMat);
      btn.rotation.x = Math.PI / 2;
      btn.position.set(
        panelCX - panelW * 0.22 + c * panelW * 0.44,
        BODY_CY + 0.05 - r * 0.16,
        BODY_D / 2 + 0.026,
      );
      sceneGroup.add(btn);
      revealDim.push(btn);
    }
  }

  // vent grille: cosmetic dark bars on the top-back (static, non-functional
  // opening — a decal grille is fine here, nothing ever passes through it)
  for (let i = 0; i < 8; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(BODY_W * 0.32, 0.01, 0.018), meshBarMat);
    bar.position.set(-BODY_W * 0.28, BODY_Y0 + BODY_H - 0.04, -BODY_D / 2 + 0.15 + i * 0.08);
    sceneGroup.add(bar);
    revealDim.push(bar);
  }

  // ============================================================================
  //  TURNTABLE — glass disc + hub + a simple bowl of food, rotates as a unit
  // ============================================================================
  const turntableGroup = new THREE.Group();
  turntableGroup.position.set(0, CAV_FLOOR_Y, 0);
  sceneGroup.add(turntableGroup);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.05, 16), hubMat);
  hub.position.y = 0.025;
  turntableGroup.add(hub);
  internals.push(hub);
  const turntable = disc(TURN_R, 0.02, glassTurntable, 56);
  turntable.position.y = 0.06;
  turntableGroup.add(turntable);
  internals.push(turntable);

  // food: a simple ceramic bowl with a rounded mound of food inside
  const bowlGroup = new THREE.Group();
  bowlGroup.position.set(-0.15, 0.075, 0.1);
  turntableGroup.add(bowlGroup);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.14, 28, 1, true), bowlMat);
  bowlGroup.add(bowl);
  internals.push(bowl);
  const bowlBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.01, 28), bowlMat);
  bowlBase.position.y = -0.07;
  bowlGroup.add(bowlBase);
  internals.push(bowlBase);
  const foodMound = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14, 0, TAU, 0, Math.PI / 2), foodMat);
  foodMound.scale.set(1, 0.6, 1);
  foodMound.position.y = 0.02;
  bowlGroup.add(foodMound);
  internals.push(foodMound);

  // ============================================================================
  //  MAGNETRON — cathode + 12 anode vanes + tube wall + 2 ring magnets + antenna
  // ============================================================================
  const magnetronGroup = new THREE.Group();
  magnetronGroup.position.set(MAG_X, MAG_Y, MAG_Z);
  sceneGroup.add(magnetronGroup);
  internals.push(magnetronGroup);

  const cathode = rod(CATH_R, ANODE_H * 1.1, cathodeMat, 14);
  cathode.position.y = -ANODE_H * 0.55;
  magnetronGroup.add(cathode);

  const vaneMeshes = [];
  for (let i = 0; i < VANES; i++) {
    const a = (i / VANES) * TAU;
    const vane = beveledBox(ANODE_OUT_R - CATH_R - 0.02, ANODE_H, 0.018, copper, 0.004);
    vane.position.set(Math.cos(a) * ((ANODE_OUT_R + CATH_R) / 2), 0, Math.sin(a) * ((ANODE_OUT_R + CATH_R) / 2));
    vane.rotation.y = -a;
    magnetronGroup.add(vane);
    vaneMeshes.push(vane);
  }
  const anodeTube = new THREE.Mesh(
    new THREE.CylinderGeometry(ANODE_OUT_R, ANODE_OUT_R, ANODE_H, 32, 1, true),
    copper,
  );
  magnetronGroup.add(anodeTube);

  const magnetTop = new THREE.Mesh(new THREE.TorusGeometry(ANODE_OUT_R + 0.05, 0.045, 14, 32), ferriteMat);
  magnetTop.rotation.x = Math.PI / 2;
  magnetTop.position.y = ANODE_H / 2 + 0.05;
  magnetronGroup.add(magnetTop);
  const magnetBottom = magnetTop.clone();
  magnetBottom.position.y = -ANODE_H / 2 - 0.05;
  magnetronGroup.add(magnetBottom);

  // antenna: short copper stub rising from the top of the anode ring
  const antenna = rod(0.015, 0.14, copper, 10);
  antenna.position.set(0, ANODE_H / 2 + 0.11, 0);
  magnetronGroup.add(antenna);

  // rotating electron "spokes" — the real, documented rotating-bunch pattern
  // that sweeps past the cavities and drives their oscillation
  const SPOKES = 4;
  const spokeGroup = new THREE.Group();
  magnetronGroup.add(spokeGroup);
  const spokeMeshes = [];
  for (let i = 0; i < SPOKES; i++) {
    const a = (i / SPOKES) * TAU;
    const spoke = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, (ANODE_OUT_R - CATH_R) * 0.55, 4, 8), electronMat());
    spoke.rotation.z = Math.PI / 2;
    spoke.position.set(Math.cos(a) * (CATH_R + ANODE_OUT_R) * 0.42, 0, Math.sin(a) * (CATH_R + ANODE_OUT_R) * 0.42);
    spoke.rotation.y = -a;
    spokeGroup.add(spoke);
    spokeMeshes.push(spoke);
  }

  // ============================================================================
  //  WAVEGUIDE — vertical duct from the magnetron up to the cavity ceiling,
  //  with a small stirrer fan at the feed point
  // ============================================================================
  const waveguideTop = MAG_Y + ANODE_H / 2 + 0.35;
  const waveguide = beveledBox(0.16, waveguideTop - (MAG_Y + ANODE_H / 2 + 0.11), 0.16, copper, 0.01);
  waveguide.position.set(MAG_X, (waveguideTop + MAG_Y + ANODE_H / 2 + 0.11) / 2, MAG_Z);
  sceneGroup.add(waveguide);
  internals.push(waveguide);

  const stirrerGroup = new THREE.Group();
  stirrerGroup.position.set(MAG_X, waveguideTop - 0.02, MAG_Z);
  sceneGroup.add(stirrerGroup);
  internals.push(stirrerGroup);
  const stirrerShaft = rod(0.012, 0.06, hubMat, 8);
  stirrerShaft.position.y = -0.03;
  stirrerGroup.add(stirrerShaft);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const blade = beveledBox(0.09, 0.012, 0.03, hubMat, 0.003);
    blade.position.set(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05);
    blade.rotation.y = a;
    stirrerGroup.add(blade);
  }

  // ============================================================================
  //  STANDING WAVE FIELD — a horizontal grid of amber nodes inside the cavity;
  //  each dot's fixed amplitude is a stylized |sin|*|sin| nodal pattern, its
  //  brightness then breathes with the shared phase (real oscillation is
  //  2.45 GHz — far too fast to show literally, so this is a stand-in pulse).
  // ============================================================================
  const fieldGroup = new THREE.Group();
  fieldGroup.position.set(0, CAV_FLOOR_Y + 0.32, 0);
  sceneGroup.add(fieldGroup);
  const GRID_N = 5;
  const GRID_SPAN = 1.5;
  const fieldDots = [];
  for (let i = 0; i < GRID_N; i++) {
    for (let j = 0; j < GRID_N; j++) {
      const x = (i / (GRID_N - 1) - 0.5) * GRID_SPAN;
      const z = (j / (GRID_N - 1) - 0.5) * GRID_SPAN;
      if (Math.abs(x) > BODY_W / 2 - 0.15 || Math.abs(z) > BODY_D / 2 - 0.15) continue;
      const amp = Math.abs(Math.sin((x / GRID_SPAN + 0.5) * Math.PI * 2.5)) *
        Math.abs(Math.sin((z / GRID_SPAN + 0.5) * Math.PI * 2.5));
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), fieldDotMat());
      dot.position.set(x, 0, z);
      dot.userData.amp = 0.15 + amp * 0.85;
      fieldGroup.add(dot);
      fieldDots.push(dot);
    }
  }

  // ============================================================================
  //  WATER-MOLECULE MACRO — a small cluster of polar dipoles above the food,
  //  rocking back and forth in sync with the field (the dielectric-heating
  //  beat). Rides the turntable so it stays over the food as it rotates.
  // ============================================================================
  // NOT parented to the rotating turntable — like fiber-optics' macro insert,
  // this is a fixed-position stylized close-up, not literally embedded in the
  // orbiting food (a rotating parent would drift in and out of a static
  // camera's frame over the loop).
  const moleculeGroup = new THREE.Group();
  moleculeGroup.position.set(-0.15, CAV_FLOOR_Y + 0.32, 0.35);
  sceneGroup.add(moleculeGroup);
  const molecules = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    const r = 0.12 + (i % 3) * 0.05;
    const m = new THREE.Group();
    m.position.set(Math.cos(a) * r, (i % 3) * 0.05, Math.sin(a) * r);
    m.rotation.y = a;
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), oxygenMat);
    m.add(o);
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), hydrogenMat);
      h.position.set(s * 0.022, 0.018, 0);
      m.add(h);
      const bond = rod(0.003, 0.024, bondMat, 6);
      bond.position.set(s * 0.011, 0, 0);
      bond.rotation.z = s * 0.9;
      m.add(bond);
    }
    moleculeGroup.add(m);
    molecules.push(m);
  }
  moleculeGroup.visible = false;

  // ============================================================================
  //  CALLOUTS
  // ============================================================================
  const labels = calloutSets(['exterior', 'cutaway', 'magnetron', 'waveguide', 'waves', 'heating']);
  labels.add('exterior', sceneGroup, 'Door — glass + metal mesh', [DOOR_X0 + DOOR_W * 0.8, BODY_CY + DOOR_H * 0.35, BODY_D / 2], 70, 90);
  labels.add('exterior', sceneGroup, 'Control panel', [panelCX, BODY_CY + DOOR_H * 0.3, BODY_D / 2], 70, 68);
  labels.add('exterior', sceneGroup, 'Handle', [DOOR_X0 + DOOR_W - 0.03, BODY_CY - DOOR_H * 0.1, BODY_D / 2 + 0.05], -30, 74);

  labels.add('cutaway', sceneGroup, 'Turntable', [-0.6, CAV_FLOOR_Y + 0.05, 0.5], -40, 84);
  labels.add('cutaway', sceneGroup, 'Magnetron', [MAG_X, MAG_Y, MAG_Z - 0.3], 55, 88);
  labels.add('cutaway', sceneGroup, 'Waveguide', [MAG_X + 0.02, waveguideTop - 0.15, MAG_Z], 90, 70);

  labels.add('magnetron', magnetronGroup, 'Cathode (heated filament)', [0, -ANODE_H * 0.4, 0.05], -50, 90);
  labels.add('magnetron', magnetronGroup, 'Anode cavities (12)', [ANODE_OUT_R, 0.05, 0], 45, 90);
  labels.add('magnetron', magnetronGroup, 'Ring magnets', [0.05, ANODE_H / 2 + 0.05, ANODE_OUT_R + 0.02], 70, 76);
  labels.add('magnetron', magnetronGroup, 'Antenna', [0, ANODE_H / 2 + 0.16, 0.03], 30, 66);

  labels.add('waveguide', sceneGroup, 'Waveguide', [MAG_X - 0.08, waveguideTop - 0.18, MAG_Z - 0.06], 145, 130);
  labels.add('waveguide', sceneGroup, 'Stirrer fan', [MAG_X + 0.09, waveguideTop - 0.02, MAG_Z + 0.02], -75, 150);
  labels.add('waveguide', sceneGroup, 'Antenna feeds in from below', [MAG_X - 0.05, MAG_Y + ANODE_H / 2 + 0.1, MAG_Z], -50, 110);

  labels.add('waves', sceneGroup, 'Standing wave — antinodes (hot)', [0.6, CAV_FLOOR_Y + 0.4, 0.55], 60, 120);
  labels.add('waves', sceneGroup, 'Turntable evens out the pattern', [0.15, CAV_FLOOR_Y + 0.02, 0.7], -48, 130);

  labels.add('heating', sceneGroup, 'Polar water molecules', [-0.15, CAV_FLOOR_Y + 0.32, 0.35], 60, 100);
  labels.add('heating', sceneGroup, 'Flip ~2.45 billion times/sec', [-0.15, CAV_FLOOR_Y + 0.05, -0.15], -40, 130);

  // ============================================================================
  //  POSE
  // ============================================================================
  let revealed = false;
  let fieldOn = false;
  let heatingOn = false;

  function setReveal(t) {
    const r = clamp01(t);
    revealed = r > 0.4;
    const op = 1 - r * 0.9; // 1 -> 0.1
    const ghosted = r > 0.02;
    for (const m of revealDim) {
      const mat = m.material;
      rememberGhostOrig(mat);
      const o = mat.userData.ghostOrig;
      const isGlow = mat === displayMat;
      mat.transparent = ghosted || isGlow;
      if (!isGlow) mat.opacity = op;
      mat.depthWrite = r < 0.4;
      mat.clearcoat = ghosted ? 0 : o.clearcoat;
      mat.metalness = ghosted ? o.metalness * 0.15 : o.metalness;
    }
    for (const o of internals) o.visible = revealed;
    fieldGroup.visible = revealed && fieldOn;
    moleculeGroup.visible = revealed && heatingOn;
  }

  function showField(on) {
    fieldOn = on;
    fieldGroup.visible = revealed && on;
  }
  function showHeating(on) {
    heatingOn = on;
    moleculeGroup.visible = revealed && on;
  }

  function setPhase(u) {
    const p = ((u % 1) + 1) % 1;
    // turntable: exactly one whole turn per lap — seamless
    turntableGroup.rotation.y = p * TAU;
    // electron spokes: whole multiple of turns per lap (independent, faster)
    spokeGroup.rotation.y = p * TAU * 6;
    // stirrer fan: whole multiple of turns per lap
    stirrerGroup.rotation.y = p * TAU * 8;
    // standing wave breathe: whole cycles per lap, stylized 2.45GHz pulse
    const breathe = 0.5 + 0.5 * Math.sin(p * TAU * 3);
    for (const d of fieldDots) {
      d.material.opacity = clamp01(d.userData.amp * (0.3 + breathe * 0.7));
      d.material.emissiveIntensity = 0.8 + breathe * 1.2;
    }
    // cathode glow flickers gently with the same rhythm
    cathodeMat.emissiveIntensity = 1.1 + breathe * 0.5;
    // water molecules rock back and forth (not a full spin) in the field
    const rock = Math.sin(p * TAU * 3) * 0.55;
    for (const m of molecules) m.rotation.x = rock;
  }

  function setLabels(mode) {
    labels.setLabels(mode);
  }

  // initial: sealed, running, idle
  setReveal(0);
  showField(false);
  showHeating(false);
  setPhase(0);
  setLabels(false);

  return {
    group: sceneGroup,
    setReveal,
    setPhase,
    showField,
    showHeating,
    setLabels,
    parts: { body, doorGroup, turntableGroup, magnetronGroup, spokeGroup, fieldGroup, moleculeGroup },
  };
}
