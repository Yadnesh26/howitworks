import * as THREE from 'three';
import { materials, disc, chargeQueue } from '../../framework/parts.js';
import { beveledBox, tubeAlong } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, smooth, TAU } from '../../framework/motion.js';

// A Qi-style inductive wireless charger: a smartphone resting on a round pad,
// presented as a studio product shot. The whole point is invisible physics —
// so the "reveal" ghosts both plastic shells to expose the two flat spiral
// coils facing each other across a tiny air gap, and the field/current are
// drawn as glowing flow.
//
// MECHANISM (researched — Qi inductive power transfer, WPC standard):
// two flat spiral "pancake" coils of litz wire (~20mm inner / ~44mm outer,
// ~10 turns) sit a few millimetres apart. The transmitter coil in the PAD is
// driven with alternating current at ~110-205 kHz; that oscillating current
// makes an oscillating magnetic field. The field threads up through the
// centre of the RECEIVER coil in the phone and, by Faraday's law of
// induction, drives an alternating current in it — power crosses the gap with
// nothing touching. The receiver rectifies that AC to DC (a full-bridge
// rectifier) and charges the battery. A ferrite sheet behind each coil
// channels the flux and stops it inducing wasteful eddy currents in the
// nearby metal. Coupling (hence efficiency, ~75%) falls off fast with
// misalignment, which is why Qi2/MagSafe add a ring of alignment magnets.
// Sources: allaboutcircuits.com, en.wikipedia.org/wiki/Qi_(standard),
// we-online SMD coil characterization PDF.
//
// SCALARS the pose is built from:
//   setReveal(t) — 0 sealed (phone on pad) / 1 both shells ghosted, coils +
//     ferrite + battery + rectifier exposed. Clearcoat is zeroed while ghosted
//     (coat specular is opacity-independent — the mixer-grinder lesson).
//   setPhase(u) — master 0-1 loop phase. Rides current dots continuously
//     around BOTH coil spirals and energy dots around the flux loops (each
//     wraps mod 1 → seamless at any duration), and breathes the field's
//     emissive intensity (the AC "oscillation", far too fast to show literally
//     at 100+ kHz, stylized as a steady pulse).
//   setCharge(t) — 0-1 battery fill bar.
//   showField(on) — flux loops + flow dots visible (revealed steps only; the
//     bare-coils reveal step keeps them off so the two coils read cleanly).
//   setLabels(mode) — 'exterior' | 'coils' | 'field' | 'induction' |
//     'battery' | false

// --- layout (world units; scene sits on the y=0 shadow floor) ---------------
const PAD_R = 1.15;
const PAD_H = 0.26;
const TX_Y = 0.2; // transmitter coil, inside the pad near its top
const RX_Y = 0.38; // receiver coil, inside the phone near its back
const FIELD_CY = (TX_Y + RX_Y) / 2; // 0.2675 — flux-loop centre height
const COIL_RIN = 0.32;
const COIL_ROUT = 0.85;
const COIL_TURNS = 7;
const WIRE_R = 0.026;

const PHONE_X = 0.2;
const PHONE_Y = 0.38;
const PHONE_L = 2.8; // along x
const PHONE_T = 0.16; // thickness (y)
const PHONE_W = 1.4; // along z

const BAT_X = 0.9;
const BAT_L = 0.92;
const BAT_H = 0.1;
const BAT_W = 0.58;
const RECT_X = 0.45; // rectifier chip: between the coil centre and the battery
const RECT_Z = 0.32; // toward the camera (+z), clear of the battery's width

const CURRENT = 0xffb347; // amber — electric current
const FIELDCOL = 0x2ee6c0; // teal — magnetic field (accent)

export function buildCharger({ scene }) {
  const sceneGroup = new THREE.Group();
  scene.add(sceneGroup);

  // --- materials --------------------------------------------------------------
  const padShell = materials.paintedMetal(0x33383f);
  padShell.clearcoat = 0.7;
  padShell.clearcoatRoughness = 0.22;
  const padRim = materials.paintedMetal(0x23272c);
  const phoneShell = materials.paintedMetal(0x1c1f24);
  phoneShell.clearcoat = 0.8;
  phoneShell.clearcoatRoughness = 0.16;
  const screenGlass = new THREE.MeshPhysicalMaterial({
    color: 0x05070a,
    metalness: 0.1,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  const copper = new THREE.MeshPhysicalMaterial({
    color: 0xc9814a,
    metalness: 1,
    roughness: 0.32,
  });
  const ferriteMat = materials.darkMetal(0x33373d);
  ferriteMat.roughness = 0.68;
  const batteryCase = materials.darkMetal(0x3b414a);
  const batteryFill = materials.glow(0x46e05a, 0.9);
  const rectMat = materials.darkMetal(0x353b44); // light enough to read as a distinct chip on the dark board
  const pinMat = materials.chrome(0xcfd4da);
  const fieldTubeMat = new THREE.MeshStandardMaterial({
    color: FIELDCOL,
    emissive: FIELDCOL,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const screenGlow = new THREE.MeshStandardMaterial({
    color: FIELDCOL,
    emissive: FIELDCOL,
    emissiveIntensity: 1.4,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });

  const revealDim = []; // shells that ghost on reveal
  const internals = []; // coils/ferrite/battery/rectifier — shown only revealed

  const rememberGhostOrig = (mat) => {
    if (!mat.userData.ghostOrig) {
      mat.userData.ghostOrig = { clearcoat: mat.clearcoat ?? 0, metalness: mat.metalness ?? 0 };
    }
  };

  // ============================================================================
  //  OUTER SHELLS — the charging pad + the phone (both ghost on reveal)
  // ============================================================================
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(PAD_R, PAD_R + 0.02, PAD_H, 64), padShell);
  pad.position.y = PAD_H / 2;
  pad.castShadow = true;
  pad.receiveShadow = true;
  sceneGroup.add(pad);
  revealDim.push(pad);
  // a slim rubber-feel rim ring around the top edge (a real pad's grippy lip)
  const rim = new THREE.Mesh(new THREE.TorusGeometry(PAD_R - 0.03, 0.03, 16, 64), padRim);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = PAD_H;
  sceneGroup.add(rim);
  revealDim.push(rim);

  // phone: a rounded slab lying flat on the pad, overhanging in +x
  const phone = beveledBox(PHONE_L, PHONE_T, PHONE_W, phoneShell, 0.05);
  phone.position.set(PHONE_X, PHONE_Y, 0);
  phone.castShadow = true;
  phone.receiveShadow = true;
  sceneGroup.add(phone);
  revealDim.push(phone);
  // screen: dark glass inset on the phone's top face
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(PHONE_L - 0.16, PHONE_W - 0.16), screenGlass);
  screen.rotation.x = -Math.PI / 2;
  screen.position.set(PHONE_X, PHONE_Y + PHONE_T / 2 + 0.002, 0);
  sceneGroup.add(screen);
  revealDim.push(screen);
  // charge indicator: a small glowing ring on the screen, over the coil centre
  const chargeRing = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 12, 40), screenGlow);
  chargeRing.rotation.x = -Math.PI / 2;
  chargeRing.position.set(0, PHONE_Y + PHONE_T / 2 + 0.004, 0);
  sceneGroup.add(chargeRing);
  revealDim.push(chargeRing);

  // ============================================================================
  //  FLAT SPIRAL COILS — transmitter (pad) + receiver (phone)
  // ============================================================================
  function spiralPoints(y) {
    const pts = [];
    const N = 150;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const a = t * COIL_TURNS * TAU;
      const r = COIL_RIN + (COIL_ROUT - COIL_RIN) * t;
      pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
    return pts;
  }
  function buildCoil(y) {
    const mesh = tubeAlong(spiralPoints(y), WIRE_R, copper, {
      tubularSegments: 320,
      radialSegments: 10,
    });
    mesh.castShadow = true;
    sceneGroup.add(mesh);
    internals.push(mesh);
    return mesh;
  }
  const txCoil = buildCoil(TX_Y);
  const rxCoil = buildCoil(RX_Y);

  // ferrite shields: a flat dark disc behind each coil (below TX, above RX).
  // Kept slightly SMALLER than the coil so the copper coil's outer rim always
  // pokes out past the disc and reads from the camera (an over-large ferrite
  // hid the receiver coil entirely from above).
  const FERRITE_R = COIL_ROUT - 0.05;
  const txFerrite = disc(FERRITE_R, 0.028, ferriteMat, 56);
  txFerrite.position.y = TX_Y - 0.055;
  sceneGroup.add(txFerrite);
  internals.push(txFerrite);
  const rxFerrite = disc(FERRITE_R, 0.028, ferriteMat, 56);
  rxFerrite.position.y = RX_Y + 0.055;
  sceneGroup.add(rxFerrite);
  internals.push(rxFerrite);

  // ============================================================================
  //  RECEIVER ELECTRONICS — rectifier chip + battery (inside the phone)
  // ============================================================================
  const rect = beveledBox(0.34, 0.08, 0.4, rectMat, 0.015);
  rect.position.set(RECT_X, RX_Y + 0.03, RECT_Z);
  sceneGroup.add(rect);
  internals.push(rect);
  // small teal index mark so the chip reads as an IC, not a blank block
  const rectMark = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.005, 0.05), screenGlow.clone());
  rectMark.material.opacity = 0.9;
  rectMark.position.set(RECT_X - 0.1, RX_Y + 0.071, RECT_Z - 0.13);
  sceneGroup.add(rectMark);
  internals.push(rectMark);
  // a few chrome pins along the chip's long sides
  for (let i = 0; i < 4; i++) {
    const z = RECT_Z - 0.13 + i * 0.087;
    for (const sx of [-1, 1]) {
      const pin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.03), pinMat);
      pin.position.set(RECT_X + sx * 0.16, RX_Y + 0.005, z);
      sceneGroup.add(pin);
      internals.push(pin);
    }
  }

  const batCase = beveledBox(BAT_L, BAT_H, BAT_W, batteryCase, 0.02);
  batCase.position.set(BAT_X, PHONE_Y, 0);
  sceneGroup.add(batCase);
  internals.push(batCase);
  // charge gauge: a glowing green bar recessed into the case's TOP face (an
  // opaque case would hide a fill INSIDE it), growing from the -x end
  const fillLen = BAT_L - 0.12;
  const fillGeo = new THREE.BoxGeometry(fillLen, 0.03, BAT_W - 0.16);
  fillGeo.translate(fillLen / 2, 0, 0);
  const batFill = new THREE.Mesh(fillGeo, batteryFill);
  const fillX0 = BAT_X - fillLen / 2;
  batFill.position.set(fillX0, PHONE_Y + BAT_H / 2 - 0.008, 0);
  sceneGroup.add(batFill);
  internals.push(batFill);
  // battery terminal nub
  const term = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 16), pinMat);
  term.rotation.z = Math.PI / 2;
  term.position.set(BAT_X + BAT_L / 2 + 0.02, PHONE_Y, 0);
  sceneGroup.add(term);
  internals.push(term);

  // ============================================================================
  //  MAGNETIC FIELD — azimuthal flux loops threading up through both coils
  // ============================================================================
  // Each loop lives in a vertical plane through the axis at azimuth theta: it
  // runs UP the inside (radius rIn, through both coil centres = the coupled
  // flux, TX->RX) then arcs OUT and back DOWN outside the coils (radius rOut)
  // to close — the classic dipole-field silhouette. 8 of them make the
  // "iron-filings" shell. Energy dots ride each loop so the inner up-stroke
  // reads as power crossing the gap.
  const fieldGroup = new THREE.Group();
  sceneGroup.add(fieldGroup);
  const LOOPS = 8;
  const H = 0.5;
  const R_IN = 0.1;
  const R_OUT = 1.3;
  const loopCurves = [];
  for (let k = 0; k < LOOPS; k++) {
    const th = (k / LOOPS) * TAU;
    const dx = Math.cos(th);
    const dz = Math.sin(th);
    const rh = [
      [R_IN, -H], // bottom inner (below TX)
      [R_IN, H], // top inner (above RX) — inner stroke goes UP: TX -> RX
      [R_OUT * 0.7, H * 1.15],
      [R_OUT, H * 0.35],
      [R_OUT, -H * 0.35],
      [R_OUT * 0.7, -H * 1.15],
    ];
    const pts = rh.map(([r, h]) => [dx * r, FIELD_CY + h, dz * r]);
    const tube = tubeAlong(pts, 0.012, fieldTubeMat, {
      closed: true,
      tubularSegments: 130,
      radialSegments: 8,
      tension: 0.5,
    });
    fieldGroup.add(tube);
    loopCurves.push(tube.userData.curve);
  }

  // --- flow dots (continuous, wrap mod 1) ------------------------------------
  function flowDots(curve, count, color, size, parent) {
    const dots = [];
    const geo = new THREE.SphereGeometry(size, 10, 8);
    for (let i = 0; i < count; i++) {
      const mat = materials.glow(color, 1.8);
      mat.transparent = true;
      mat.opacity = 0;
      mat.depthWrite = false;
      const d = new THREE.Mesh(geo, mat);
      parent.add(d);
      dots.push(d);
    }
    function update(phase, on, dir = 1) {
      dots.forEach((d, i) => {
        if (!on) {
          d.material.opacity = 0;
          return;
        }
        const t = (((dir * phase + i / count) % 1) + 1) % 1;
        d.position.copy(curve.getPointAt(t));
        d.material.opacity = 0.95;
      });
    }
    return { dots, update };
  }

  const txFlow = flowDots(txCoil.userData.curve, 22, CURRENT, 0.03, fieldGroup);
  const rxFlow = flowDots(rxCoil.userData.curve, 22, CURRENT, 0.03, fieldGroup);
  const fieldFlows = loopCurves.map((c) => flowDots(c, 4, FIELDCOL, 0.028, fieldGroup));

  // ============================================================================
  //  CALLOUTS
  // ============================================================================
  const labels = calloutSets(['exterior', 'coils', 'field', 'induction', 'battery']);
  labels.add('exterior', sceneGroup, 'Charging pad', [0.55, 0.13, 0.78], 40, 80);
  labels.add('exterior', sceneGroup, 'Smartphone', [1.35, PHONE_Y + 0.09, 0.35], 55, 74);
  labels.add('exterior', sceneGroup, 'Charge indicator', [0.0, PHONE_Y + 0.13, 0], 90, 70);

  labels.add('coils', sceneGroup, 'Transmitter coil', [0.45, TX_Y, 0.8], -35, 100);
  labels.add('coils', sceneGroup, 'Receiver coil', [0.45, RX_Y, 0.8], 35, 100);
  labels.add('coils', sceneGroup, 'Ferrite shield', [0.9, TX_Y - 0.05, 0.15], -30, 92);
  labels.add('coils', sceneGroup, 'Air gap (a few mm)', [-0.02, FIELD_CY, 0.92], 6, 150);

  labels.add('field', sceneGroup, 'AC current', [0.45, TX_Y, 0.8], -34, 96);
  labels.add('field', sceneGroup, 'Oscillating magnetic field', [0.55, FIELD_CY + 0.5, 0.2], 42, 90);

  labels.add('induction', sceneGroup, 'Induced current', [0.4, RX_Y, 0.82], 42, 96);
  labels.add('induction', sceneGroup, 'Receiver coil', [0.2, RX_Y, 0.84], 60, 120);

  labels.add('battery', sceneGroup, 'Rectifier — AC to DC', [RECT_X, RX_Y + 0.08, RECT_Z + 0.06], 55, 90);
  labels.add('battery', sceneGroup, 'Battery', [BAT_X, PHONE_Y + 0.07, 0.22], 82, 74);

  // ============================================================================
  //  POSE
  // ============================================================================
  let revealed = false;
  let fieldOn = false;

  function setReveal(t) {
    const r = clamp01(t);
    revealed = r > 0.4;
    const op = 1 - r * 0.9; // 1 -> 0.1
    const ghosted = r > 0.02;
    for (const m of revealDim) {
      const mat = m.material;
      rememberGhostOrig(mat);
      const o = mat.userData.ghostOrig;
      mat.transparent = ghosted || mat === screenGlow || mat === screenGlass;
      if (m !== chargeRing) mat.opacity = op;
      mat.depthWrite = r < 0.4;
      mat.clearcoat = ghosted ? 0 : o.clearcoat;
      mat.metalness = ghosted ? o.metalness * 0.15 : o.metalness;
    }
    // the charge ring belongs to the sealed product shot — fade it out entirely
    chargeRing.material.opacity = (1 - r) * 0.9;
    for (const o of internals) o.visible = revealed;
    fieldGroup.visible = revealed && fieldOn;
  }

  function showField(on) {
    fieldOn = on;
    fieldGroup.visible = revealed && on;
  }

  function setPhase(u) {
    const p = ((u % 1) + 1) % 1;
    // current spirals inward on the TX coil, outward on the RX (opposite sense
    // reads as "driven" vs "induced"); both wrap seamlessly
    txFlow.update(p, fieldGroup.visible, 1);
    rxFlow.update(p, fieldGroup.visible, -1);
    for (const f of fieldFlows) f.update(p, fieldGroup.visible, 1);
    // field "breathes" — the AC oscillation, stylized (real Qi is 100+ kHz)
    const breathe = 0.5 + 0.5 * Math.sin(p * TAU * 2);
    fieldTubeMat.emissiveIntensity = 0.45 + breathe * 0.9;
    fieldTubeMat.opacity = 0.35 + breathe * 0.35;
    // charge indicator on the sealed phone pulses gently
    screenGlow.emissiveIntensity = 1.0 + breathe * 0.9;
    // the battery fill glows as charge trickles in (reads as "charging"
    // without a bar that would snap at the loop wrap)
    batteryFill.emissiveIntensity = 0.55 + breathe * 0.7;
  }

  function setCharge(t) {
    batFill.scale.x = 0.03 + clamp01(t) * 0.97;
  }

  function setLabels(mode) {
    labels.setLabels(mode);
  }

  // initial: sealed, idle, half-charged
  setReveal(0);
  showField(false);
  setPhase(0);
  setCharge(0.55);
  setLabels(false);

  return {
    group: sceneGroup,
    setReveal,
    setPhase,
    setCharge,
    showField,
    setLabels,
    parts: { pad, phone, txCoil, rxCoil, fieldGroup, batFill },
  };
}
