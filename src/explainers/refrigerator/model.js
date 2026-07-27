import * as THREE from 'three';
import { materials, box, arrow } from '../../framework/parts.js';
import { beveledBox, bladeRing, chainPath } from '../../framework/geometry.js';
import { callout } from '../../framework/labels.js';

// A household top-freezer refrigerator, staged product-shot style.
//
// PROPORTIONS (from a typical 1.70 m top-freezer unit; scale 1 m = 1.53 u):
//   height 1.70 m -> 2.60 u   width 0.60 m -> 0.92 u   depth 0.68 m -> 1.04 u
//   W/H = 0.354, D/H = 0.40; freezer door ~ 27% of the door stack.
// The cabinet stands on y = 0; the front face is +Z, the machinery lives on
// the back (-Z): wire-and-tube condenser grid, hermetic compressor in the
// bottom recess, capillary tube, and (inside, behind the freezer's back
// liner) the finned evaporator with its little circulation fan.
//
// `reveal` (0-1): at 0 a complete solid fridge — doors shut, painted shell.
// As reveal -> 1 the doors and outer skin are HIDDEN (painted metal never
// reads as see-through) and the white plastic liner + shelves fade to a
// faint translucent body, exposing the refrigerant loop and the evaporator.

const H = 2.6;
const W = 0.92;
const D = 1.04;
const ZF = D / 2; // front plane
const ZB = -D / 2; // back plane
const ZC = ZB - 0.08; // condenser grid plane, standing off the back
const BASE_Y = 0.14; // cabinet bottom (legs below)
const DIV_Y = BASE_Y + (H - BASE_Y) * 0.72; // freezer/fridge divider

const hotGas = new THREE.Color(0xff5a2e);
const warmLiq = new THREE.Color(0xd0392a);
const cold = new THREE.Color(0x3fa0ff);
const coolGas = new THREE.Color(0x8fe3ff);

export function buildRefrigerator({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  const shellMat = materials.paintedMetal(0xe9edf0);
  const doorMat = materials.paintedMetal(0xe9edf0);
  const linerMat = materials.plastic(0xf2f5f7);
  const shelfMat = materials.plastic(0xdfe6ea);
  const dark = materials.darkMetal(0x2b3037);
  const copper = materials.brushedSteel(0xc07a3c);
  const alumFin = materials.aluminum(0xaeb9c4);
  alumFin.roughness = 0.78;

  const shellMeshes = []; // hidden on reveal (painted-metal lid)
  const linerMeshes = []; // faded to faint translucent on reveal
  const linerMats = new Set();

  const addShell = (m) => {
    m.castShadow = true;
    shellMeshes.push(m);
    group.add(m);
    return m;
  };
  const addLiner = (m) => {
    linerMeshes.push(m);
    linerMats.add(m.material);
    group.add(m);
    return m;
  };

  // --- legs + machine-bay floor -------------------------------------------------
  for (const [lx, lz] of [[-0.36, ZF - 0.14], [0.36, ZF - 0.14], [-0.36, ZB + 0.14], [0.36, ZB + 0.14]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, BASE_Y, 12), materials.rubber());
    leg.position.set(lx, BASE_Y / 2, lz);
    group.add(leg);
  }
  const belly = beveledBox(W - 0.04, 0.07, D - 0.06, materials.grimyAluminum(0x565e69), 0.02);
  belly.position.set(0, BASE_Y + 0.035, 0);
  group.add(belly);

  // --- outer shell (hidden on reveal) --------------------------------------------
  const sideL = beveledBox(0.05, H - BASE_Y, D, shellMat, 0.02);
  sideL.position.set(-(W / 2 - 0.025), BASE_Y + (H - BASE_Y) / 2, 0);
  const sideR = sideL.clone();
  sideR.position.x = W / 2 - 0.025;
  const top = beveledBox(W, 0.06, D, shellMat, 0.02);
  top.position.set(0, H - 0.03, 0);
  addShell(sideL);
  addShell(sideR);
  addShell(top);

  // back panel: thin dark board covering the upper back; the bottom recess
  // (machine bay) stays open so the compressor is always in view. Always
  // visible — the condenser hangs on it.
  const backBoard = box(W - 0.06, H - 0.72, 0.03, materials.paintedMetal(0x565b62));
  backBoard.position.set(0, 0.66 + (H - 0.72) / 2, ZB + 0.015);
  backBoard.castShadow = true;
  group.add(backBoard);

  // --- doors (freezer above, fresh-food below) ------------------------------------
  const DOOR_T = 0.09;
  const gap = 0.02;
  const frzDoorH = (H - BASE_Y) * 0.27;
  const frzDoor = beveledBox(W, frzDoorH - gap, DOOR_T, doorMat, 0.03);
  frzDoor.position.set(0, H - frzDoorH / 2, ZF + DOOR_T / 2);
  const mainDoorH = H - BASE_Y - frzDoorH;
  const mainDoor = beveledBox(W, mainDoorH - gap, DOOR_T, doorMat, 0.03);
  mainDoor.position.set(0, BASE_Y + mainDoorH / 2, ZF + DOOR_T / 2);
  addShell(frzDoor);
  addShell(mainDoor);
  // handles: vertical bars on the left edge of each door
  for (const [hy, hh] of [[H - frzDoorH / 2, frzDoorH * 0.55], [BASE_Y + mainDoorH * 0.72, mainDoorH * 0.42]]) {
    const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, hh, 6, 12), materials.brushedSteel());
    bar.position.set(-(W / 2 - 0.09), hy, ZF + DOOR_T + 0.045);
    addShell(bar);
    for (const dy of [-hh / 2, hh / 2]) {
      const standoff = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 8).rotateX(Math.PI / 2), materials.brushedSteel());
      standoff.position.set(-(W / 2 - 0.09), hy + dy, ZF + DOOR_T + 0.02);
      addShell(standoff);
    }
  }
  // hinges on the right edge
  for (const hy of [H - 0.03, DIV_Y, BASE_Y + 0.03]) {
    const hinge = beveledBox(0.09, 0.03, 0.1, materials.darkMetal(0x4a5058), 0.008);
    hinge.position.set(W / 2 - 0.05, hy, ZF + 0.03);
    addShell(hinge);
  }

  // --- inner liner (fades on reveal) ----------------------------------------------
  const LT = 0.045; // liner wall thickness
  const linL = box(LT, H - BASE_Y - 0.1, D - 0.2, linerMat);
  linL.position.set(-(W / 2 - 0.05 - LT / 2), BASE_Y + (H - BASE_Y) / 2, -0.02);
  const linR = linL.clone();
  linR.position.x = W / 2 - 0.05 - LT / 2;
  const linTop = box(W - 0.1, LT, D - 0.2, linerMat);
  linTop.position.set(0, H - 0.06 - LT / 2, -0.02);
  const linBot = linTop.clone();
  linBot.position.y = BASE_Y + 0.07;
  const linBack = box(W - 0.1, H - BASE_Y - 0.1, LT, linerMat.clone());
  linBack.position.set(0, BASE_Y + (H - BASE_Y) / 2, ZB + 0.1);
  const divider = box(W - 0.1, 0.07, D - 0.2, linerMat);
  divider.position.set(0, DIV_Y, -0.02);
  addLiner(linL);
  addLiner(linR);
  addLiner(linTop);
  addLiner(linBot);
  addLiner(linBack);
  addLiner(divider);

  // shelves + crisper in the fresh-food compartment
  for (const sy of [BASE_Y + 0.62, BASE_Y + 1.02, BASE_Y + 1.42]) {
    const shelf = box(W - 0.16, 0.018, D - 0.3, shelfMat);
    shelf.position.set(0, sy, -0.04);
    addLiner(shelf);
  }
  const crisper = beveledBox(W - 0.2, 0.3, D - 0.34, materials.plastic(0xcfd9de), 0.02);
  crisper.position.set(0, BASE_Y + 0.26, -0.05);
  addLiner(crisper);
  linerMats.add(crisper.material);

  // ============================ MACHINERY (always visible) =========================
  // compressor: black hermetic dome on rubber feet, in the bottom rear recess
  const compressor = new THREE.Group();
  compressor.position.set(0.2, BASE_Y + 0.04, ZB + 0.16);
  const compBody = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.3, 28), materials.paintedMetal(0x23282f));
  compBody.castShadow = true;
  compBody.position.y = 0.17;
  const compDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.155, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    materials.paintedMetal(0x23282f),
  );
  compDome.position.y = 0.32;
  compressor.add(compBody, compDome);
  for (const [fx, fz] of [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]]) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.05, 10), materials.rubber());
    foot.position.set(fx, 0.025, fz);
    compressor.add(foot);
  }
  const relayBox = beveledBox(0.09, 0.08, 0.05, dark, 0.01);
  relayBox.position.set(0.14, 0.2, 0.09);
  compressor.add(relayBox);
  group.add(compressor);

  const compTop = new THREE.Vector3(0.2, BASE_Y + 0.5, ZB + 0.16);

  // condenser: wire-and-tube grid standing off the back panel
  const CX = 0.36; // serpentine half-width
  const passYs = [];
  for (let i = 0; i < 9; i++) passYs.push(0.78 + i * 0.19); // 0.78 .. 2.30
  // discharge riser goes UP the right side; the serpentine then flows DOWN
  // (liquid drains toward the drier at the bottom) — top pass first.
  const condPts = [];
  for (let i = passYs.length - 1; i >= 0; i--) {
    const y = passYs[i];
    const leftToRight = (passYs.length - 1 - i) % 2 === 1;
    const xa = leftToRight ? -CX : CX;
    const xb = -xa;
    condPts.push([xa, y, ZC], [xb * 0.9, y, ZC], [xb, y - 0.095, ZC]);
  }
  condPts.pop(); // last U-bend replaced by the exit run
  const condEnd = condPts[condPts.length - 1];

  // vertical wire fins over the serpentine (classic wire-tube condenser)
  const wires = new THREE.Group();
  for (let i = 0; i < 22; i++) {
    const wx = -CX + (i / 21) * 2 * CX;
    const wire = box(0.012, passYs[8] - passYs[0] + 0.14, 0.012, materials.steel(0x555b63));
    wire.position.set(wx, (passYs[0] + passYs[8]) / 2, ZC - 0.028);
    wires.add(wire);
  }
  group.add(wires);

  // filter drier: small vertical cylinder at bottom right of the grid
  const drierPos = new THREE.Vector3(0.4, 0.52, ZC + 0.02);
  const drierMat = materials.brushedSteel(0x99a1a9);
  drierMat.roughness = 0.82; // matte — a clipped specular blob shipped here once
  const drier = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.16, 6, 16), drierMat);
  drier.castShadow = true;
  drier.position.copy(drierPos);
  group.add(drier);

  // --- evaporator: fin pack behind the freezer's back liner, with a fan ----------
  const EZ = ZB + 0.055; // between liner back wall and back board
  const EY0 = DIV_Y + 0.18;
  const EY1 = EY0 + 0.23;
  const evapFins = new THREE.Group();
  for (let i = 0; i < 30; i++) {
    const fin = box(0.014, EY1 - EY0 + 0.1, 0.075, alumFin);
    fin.position.set(-0.3 + (i / 29) * 0.6, (EY0 + EY1) / 2, EZ);
    evapFins.add(fin);
  }
  group.add(evapFins);
  const fan = bladeRing(
    { blades: 5, hubR: 0.035, span: 0.11, chord: 0.09, chordTip: 0.1, camber: 0.1, twist: 0.85, twistTip: 0.4, hubDepth: 0.05 },
    materials.plastic(0x39424c),
  );
  fan.group.position.set(0, (EY0 + EY1) / 2, EZ + 0.1);
  group.add(fan.group);
  const shroud = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.016, 10, 36), dark);
  shroud.position.copy(fan.group.position);
  group.add(shroud);

  // ============================ REFRIGERANT CIRCUIT ================================
  // capillary helix: tucked in the machine bay beside the compressor, safely
  // inside the cabinet footprint (half-width 0.46)
  const capC = [0.36, 0, ZB - 0.04];
  const capPts = [[drierPos.x, drierPos.y - 0.12, drierPos.z], [capC[0], 0.48, capC[2]]];
  for (let k = 0; k <= 20; k++) {
    const a = (k / 20) * Math.PI * 10;
    capPts.push([capC[0] + 0.07 * Math.cos(a), 0.48 - (k / 20) * 0.26, capC[2] + 0.07 * Math.sin(a)]);
  }
  const capEnd = capPts[capPts.length - 1];
  const dy = (EY1 - EY0) / 4; // evaporator pass spacing (5 passes fill the fins)

  const segments = [
    // 0 · compressor discharge -> up the right side of the back to the top pass
    [
      [compTop.x, compTop.y, compTop.z],
      [0.36, 0.68, ZC + 0.02],
      [0.42, 1.5, ZC],
      [0.42, passYs[8], ZC],
      [CX, passYs[8], ZC],
    ],
    // 1 · condenser serpentine, top -> bottom (liquid drains downward)
    condPts,
    // 2 · bottom pass exit -> filter drier
    [condEnd, [drierPos.x, condEnd[1] - 0.04, ZC], [drierPos.x, drierPos.y + 0.12, drierPos.z]],
    // 3 · capillary tube: hair-thin helix
    capPts,
    // 4 · liquid line: across the bay, then up the LEFT side to the evaporator
    [
      capEnd,
      [-0.2, 0.3, ZB - 0.04],
      [-0.4, 0.5, ZB - 0.03],
      [-0.42, 1.6, ZB - 0.03],
      [-0.36, EY0 - 0.06, EZ],
      [-0.3, EY0, EZ],
    ],
    // 5 · evaporator serpentine: 5 passes up the fin pack, exiting right
    [
      [-0.3, EY0, EZ], [0.3, EY0, EZ], [0.37, EY0 + dy / 2, EZ], [0.3, EY0 + dy, EZ],
      [-0.3, EY0 + dy, EZ], [-0.37, EY0 + 1.5 * dy, EZ], [-0.3, EY0 + 2 * dy, EZ],
      [0.3, EY0 + 2 * dy, EZ], [0.37, EY0 + 2.5 * dy, EZ], [0.3, EY0 + 3 * dy, EZ],
      [-0.3, EY0 + 3 * dy, EZ], [-0.37, EY0 + 3.5 * dy, EZ], [-0.3, EY1, EZ],
      [0.3, EY1, EZ],
    ],
    // 6 · fat suction line: out of the freezer, down the back to the compressor
    [
      [0.3, EY1, EZ],
      [0.42, EY1 - 0.12, ZB - 0.02],
      [0.42, 1.2, ZB - 0.02],
      [0.38, 0.66, ZB + 0.02],
      [compTop.x, compTop.y, compTop.z],
    ],
  ];
  const chain = chainPath(segments);
  const b = chain.bounds;

  const radii = [0.028, 0.024, 0.02, 0.009, 0.016, 0.024, 0.03];
  chain.curves.forEach((curve, i) => {
    const mat = i === 1 ? materials.paintedMetal(0x3a3f46) : copper; // back grid is painted black
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, i === 3 ? 180 : 80, radii[i], 12), mat);
    tube.castShadow = true;
    group.add(tube);
  });

  // refrigerant packets riding the chain
  // Seamless-loop contract: the markers advance a WHOLE NUMBER of inter-arrow
  // gaps per lap, so at wrap each one lands exactly where its neighbour began
  // and the set maps onto itself. That decouples marker speed from the timeline
  // duration — the fan and compressor keep their own pace while the refrigerant
  // reads calmly. Advancing the whole loop (46/46) per lap was far too fast to
  // follow, and the cones were too fat to see the tubing behind them.
  const N_PACKETS = 46;
  const PACKET_ADVANCE = 18 / N_PACKETS;
  const packets = new THREE.Group();
  packets.userData.arrows = [];
  const UP = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < N_PACKETS; i++) {
    const a = arrow(0xffffff, 0.055);
    a.userData.seed = i / N_PACKETS;
    a.material.opacity = 0.95;
    packets.userData.arrows.push(a);
    packets.add(a);
  }
  group.add(packets);

  const tmpC = new THREE.Color();
  function colorAt(t, out) {
    t = ((t % 1) + 1) % 1;
    if (t < b[0]) out.copy(hotGas);
    else if (t < b[1]) out.lerpColors(hotGas, warmLiq, (t - b[0]) / (b[1] - b[0]));
    else if (t < b[2]) out.copy(warmLiq);
    else if (t < b[3]) out.lerpColors(warmLiq, cold, (t - b[2]) / (b[3] - b[2]));
    else if (t < b[4]) out.copy(cold);
    else if (t < b[5]) out.lerpColors(cold, coolGas, (t - b[4]) / (b[5] - b[4]));
    else out.copy(coolGas);
    return out;
  }

  // --- air -------------------------------------------------------------------------
  // heat shimmering up off the back grid (condenser step)
  const heatG = new THREE.Group();
  heatG.userData.arrows = [];
  const N_HEAT = 12;
  const HEAT_ADVANCE = 4 / N_HEAT; // whole gaps per lap — see PACKET_ADVANCE
  for (let i = 0; i < N_HEAT; i++) {
    const a = arrow(0xff8848, 0.075);
    a.userData.seed = i / N_HEAT;
    a.userData.lane = -CX + (i % 6) * (2 * CX / 5);
    a.material.opacity = 0;
    heatG.userData.arrows.push(a);
    heatG.add(a);
  }
  group.add(heatG);
  // cold air circulating down through the cabinet (evaporator step, revealed)
  const coldG = new THREE.Group();
  coldG.userData.arrows = [];
  const N_COLD = 10;
  const COLD_ADVANCE = 3 / N_COLD; // whole gaps per lap — see PACKET_ADVANCE
  for (let i = 0; i < N_COLD; i++) {
    const a = arrow(0x66c6ff, 0.075);
    a.rotation.x = Math.PI; // falling
    a.userData.seed = i / N_COLD;
    a.userData.lane = -0.28 + (i % 5) * 0.14;
    a.material.opacity = 0;
    coldG.userData.arrows.push(a);
    coldG.add(a);
  }
  group.add(coldG);

  // --- callouts ---------------------------------------------------------------------
  const callouts = [];
  const addCallout = (text, pos, dir, len) => {
    const c = callout(text, { dir, len });
    c.position.set(...pos);
    c.visible = false;
    group.add(c);
    callouts.push(c);
  };
  addCallout('Freezer', [-0.3, H - 0.32, 0.1], 150, 56);
  addCallout('Fresh-food compartment', [0.1, BASE_Y + 1.1, 0.1], -30, 66);
  addCallout('Evaporator coil + fan', [0.32, EY1, EZ], 25, 64);
  addCallout('Condenser coils', [-0.2, 1.75, ZC], -140, 60);
  addCallout('Compressor', [0.2, BASE_Y + 0.1, ZB + 0.2], -35, 60);
  addCallout('Filter drier', [drierPos.x + 0.04, drierPos.y, drierPos.z], 15, 52);
  addCallout('Capillary tube', [capC[0] + 0.09, 0.36, capC[2]], -15, 56);

  // --- state / pose ------------------------------------------------------------------
  const state = { flow: 0, spin: 0, heatOut: 0, coldAir: 0 };
  const tangent = new THREE.Vector3();

  function apply() {
    fan.group.rotation.z = -state.spin;
    const pump = 1 + Math.sin(state.flow * Math.PI * 2 * 6) * 0.025;
    compressor.scale.set(1, pump, 1);

    packets.userData.arrows.forEach((a) => {
      const t = (a.userData.seed + state.flow * PACKET_ADVANCE) % 1;
      a.position.copy(chain.getPointAt(t));
      tangent.copy(chain.getTangentAt(t));
      a.quaternion.setFromUnitVectors(UP, tangent);
      colorAt(t, tmpC);
      a.material.color.copy(tmpC);
      a.material.emissive.copy(tmpC);
    });

    heatG.userData.arrows.forEach((a) => {
      const t = (state.flow * HEAT_ADVANCE + a.userData.seed) % 1;
      a.position.set(a.userData.lane, 1.0 + t * 1.9, ZC - 0.16 - t * 0.25);
      a.material.opacity = state.heatOut * 0.85 * Math.sin(Math.PI * t);
    });
    coldG.userData.arrows.forEach((a) => {
      const t = (state.flow * COLD_ADVANCE + a.userData.seed) % 1;
      a.position.set(a.userData.lane, (H - 0.5) - t * (H - 0.9), 0.12);
      a.material.opacity = state.coldAir * 0.85 * Math.sin(Math.PI * t);
    });
  }
  apply();

  // --- reveal -----------------------------------------------------------------------
  function setReveal(t) {
    const r = Math.min(1, Math.max(0, t));
    const solid = r < 0.5;
    for (const m of shellMeshes) m.visible = solid;
    packets.visible = !solid; // glowing flow markers are diagram-ware, not product
    heatG.visible = !solid;
    coldG.visible = !solid;
    for (const mat of linerMats) {
      mat.opacity = 1 - r * 0.74; // -> 0.26 at full reveal
      mat.depthWrite = r < 0.5;
    }
  }
  // transparent from the start so toggling opacity never needs a recompile
  for (const mat of linerMats) mat.transparent = true;
  setReveal(0);

  return {
    group,
    state,
    phases: {
      discharge: b[0],
      condenserEnd: b[1],
      drierEnd: b[2],
      capTubeEnd: b[3],
      liquidEnd: b[4],
      evapEnd: b[5],
    },
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setReveal,
    setLabels(visible) {
      for (const c of callouts) c.visible = visible;
    },
  };
}
