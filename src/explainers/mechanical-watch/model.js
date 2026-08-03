import * as THREE from 'three';
import { materials, rod, box } from '../../framework/parts.js';
import { beveledBox, gear } from '../../framework/geometry.js';
import { callout } from '../../framework/labels.js';
import { smudgeMap } from '../../framework/textures.js';

// A complete wristwatch, standing on its closed bracelet loop like a product
// shot. The scene has three layers:
//   bracelet + case — always visible, the frame
//   dress (dial, hands, crystal) — visible from the front; setDress(false)
//     lifts it away so the steps can zoom into the movement
//   movement — the full going train, caseback-style (mainplate facing +Z,
//     every wheel about Z), scaled down to fit inside the case
//
// ONE scalar drives it all: `beat`. The balance swings sin(π·beat) so it
// crosses centre exactly at every integer beat — the instant the escapement
// unlocks, delivers its impulse, and re-locks. The escape wheel steps one
// tooth per beat; the train wheels turn smoothly at whole-number revs per
// loop. Loop = 60 beats → escape (15 teeth) does 4 revs, balance 30 periods,
// seconds hand exactly 1 rev: everything closes seamlessly.

const CY = 1.45; // watch centre height
const MOVE_SCALE = 0.64; // movement local units → world (fits case inner r)
const WRIST_Z = -1.3; // bracelet-loop centre depth behind the watch
const PLATE_Z = -0.14; // mainplate sits behind the wheels (movement-local)
const ESC_TEETH = 15; // canonical Swiss lever count
const BEATS = 60; // loop length: escape 4 revs, balance 30 periods — seamless
const BAL_AMP = 4.1; // balance swing amplitude (rad, ≈235° each way)
const PAL_AMP = 0.26; // pallet-fork rock (rad)

const TAU = Math.PI * 2;
const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// Layout: movement-local (x,y) offsets from the movement centre. Positions
// chosen so each neighbour in the train is pitch-tangent (centre distance
// ≈ pitchR_A + pitchR_B), so the teeth visibly interlock.
const L = {
  barrel: { x: -0.5, y: 0.46, r: 0.5 },
  centre: { x: 0.23, y: 0.13, r: 0.34 },
  third: { x: 0.61, y: -0.3, r: 0.26 },
  fourth: { x: 0.23, y: -0.51, r: 0.2 },
  escape: { x: -0.1, y: -0.55, r: 0.17 },
  balance: { x: -0.62, y: -0.3, r: 0.44 },
  palletPivot: { x: -0.34, y: -0.42 },
};

// Escape wheel with club/hook teeth: a steep locking face and a slanted
// impulse face, all leaning in the direction of rotation. gear() only makes
// symmetric teeth, so this one is bespoke.
function escapeWheel(teeth, radius, thickness, material) {
  const tipR = radius;
  const rootR = radius * 0.72;
  const hubR = radius * 0.34;
  const step = TAU / teeth;
  const shape = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const p = [
      [rootR, a], // valley
      [rootR + (tipR - rootR) * 0.35, a + step * 0.12], // root of leading edge
      [tipR, a + step * 0.42], // slanted impulse face up to the tip
      [tipR, a + step * 0.5], // short flat club top
      [rootR, a + step * 0.56], // steep locking face straight back down
    ];
    p.forEach(([r, ang], k) => {
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r;
      if (i === 0 && k === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
  }
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, hubR, 0, TAU, true);
  shape.holes.push(hole);
  // lighten with crescent cutouts
  for (let i = 0; i < 4; i++) {
    const a = (i * TAU) / 4 + step;
    const c = new THREE.Path();
    c.absarc(Math.cos(a) * rootR * 0.6, Math.sin(a) * rootR * 0.6, rootR * 0.22, 0, TAU, true);
    shape.holes.push(c);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.15,
    bevelSize: 0.006,
    bevelSegments: 1,
    curveSegments: 8,
  });
  geo.translate(0, 0, -thickness / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

// Flat Archimedean spiral as a thin tube — mainspring and hairspring.
// `bias` skews where the coils bunch: >1 packs them toward the arbor (wound
// tight), <1 packs them toward the rim (unwound, pressing the barrel wall).
function spiralGeo(turns, r0, r1, tubeR, bias = 1) {
  const pts = [];
  const steps = turns * 40;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * TAU;
    const r = r0 + (r1 - r0) * Math.pow(t, bias);
    pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), steps, tubeR, 6);
}
function spiral(turns, r0, r1, tubeR, material, z = 0) {
  const mesh = new THREE.Mesh(spiralGeo(turns, r0, r1, tubeR), material);
  mesh.position.z = z;
  mesh.castShadow = true;
  return mesh;
}

export function buildMechanicalWatch({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  const brass = materials.brushedSteel(0xcaa24a);
  brass.roughness = 0.62;
  const goldWheel = materials.brushedSteel(0xd8b45a);
  goldWheel.roughness = 0.62;
  const steel = materials.brushedSteel(0xd0d5db); // wheels/escape — NOT chrome
  steel.roughness = 0.5;
  // pinions are tiny and highly curved; near-chrome they mirror the softbox
  // into blinding bloom, so keep them matte
  const pinionMat = materials.brushedSteel(0xb7bdc5);
  pinionMat.roughness = 0.6;
  const blued = materials.paintedMetal(0x2f5db0); // blued-steel look
  const ruby = materials.glow(0xc41430, 0.22);
  ruby.transparent = true;
  ruby.opacity = 0.92;
  // the mainplate is a large FLAT disc filling the whole background behind
  // the gear train, visible through every gap between wheels — a flat metal
  // surface at 0.6 (effective ~0.3 after the castMap roughness texture
  // multiplies it) throws a single coherent mirror-bright reflection of the
  // key light across a wide area (isolated via material-visibility toggling
  // on the escapement macro step: hiding it alone dropped clipped px from
  // 254 to 6). A curved part spreads a hotspot as you scan across it; a flat
  // one doesn't, so it needs to run matter than curved parts at this scale.
  const plateMetal = materials.aluminum(0x9098a2);
  plateMetal.roughness = 0.95;
  // a FLAT disc reflects coherently across its whole surface — unlike a
  // curved part, no amount of scanning across it disperses the hotspot, so
  // the cast-texture bump needs MORE perturbation than default (not less) to
  // break that coherence into scattered glints instead of one mirror patch.
  plateMetal.normalScale.set(0.6, 0.6);
  // anisoSteel tried here [rung 2a, reverted]: the case band fills most of
  // the frame at the escapement/balance macro steps, exactly the "large
  // frame-filling geometry at macro distance" failure mode documented for
  // wireless-charging's coils — blew clipped px to 2171/3594 (limit 150).
  // Back to plain brushedSteel; see polish-explainer skill's anisotropy note.
  const caseSteel = materials.brushedSteel(0xc9ced6);
  caseSteel.roughness = 0.65;
  const linkSteel = materials.brushedSteel(0xbfc5cd);
  linkSteel.roughness = 0.7;
  const linerMat = materials.rubber(0x14161a); // dark case interior — no mirror
  const dialMat = materials.paintedMetal(0xf1ece0);
  const handMat = materials.paintedMetal(0x24334f); // near-black blued hands
  const accentMat = materials.paintedMetal(0xc7912e);

  // ==========================================================================
  // MOVEMENT — full going train, built in local units, scaled into the case
  // ==========================================================================
  const movement = new THREE.Group();
  movement.position.set(0, CY, 0);
  movement.scale.setScalar(MOVE_SCALE);
  group.add(movement);

  const C = (lx, ly) => [lx, ly, 0];

  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 0.12, 64).rotateX(Math.PI / 2),
    plateMetal,
  );
  plate.position.set(0, 0, PLATE_Z);
  plate.receiveShadow = true;
  movement.add(plate);
  // jewel bearings (ruby dots) sunk into the plate at each pivot
  for (const k of ['barrel', 'centre', 'third', 'fourth', 'escape', 'balance', 'palletPivot']) {
    const j = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12).rotateX(Math.PI / 2), ruby);
    j.position.set(L[k].x, L[k].y, PLATE_Z + 0.08);
    movement.add(j);
  }

  // --- barrel (mainspring housing) ------------------------------------------
  const barrel = new THREE.Group();
  barrel.position.set(...C(L.barrel.x, L.barrel.y));
  const barrelDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(L.barrel.r * 0.82, L.barrel.r * 0.82, 0.14, 48).rotateX(Math.PI / 2),
    materials.glass(0xcfe0ff, 0.14),
  );
  barrel.add(barrelDrum);
  // mainspring: grey spring steel (blued is the HAIRspring), morphing between
  // wound (coils packed around the arbor) and unwound (coils pressed against
  // the barrel wall) — reference: ciechanow.ski/mechanical-watch
  const springSteel = materials.paintedMetal(0x6a7280);
  const msWound = spiralGeo(4.5, 0.07, L.barrel.r * 0.74, 0.016, 2.2);
  const msUnwound = spiralGeo(4.5, 0.07, L.barrel.r * 0.74, 0.016, 0.45);
  msWound.morphAttributes.position = [msUnwound.getAttribute('position')];
  const mainspring = new THREE.Mesh(msWound, springSteel);
  mainspring.castShadow = true;
  barrel.add(mainspring);
  const barrelArbor = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 12).rotateX(Math.PI / 2), steel);
  barrel.add(barrelArbor);
  const barrelGear = gear({ teeth: 48, radius: L.barrel.r, thickness: 0.05, holeR: 0.07, cutouts: 0 }, brass);
  barrelGear.position.z = -0.06;
  barrel.add(barrelGear);
  movement.add(barrel);

  // --- train wheels (wheel + pinion stub) -----------------------------------
  function trainWheel(spec, teeth, material) {
    const g = new THREE.Group();
    g.position.set(...C(spec.x, spec.y));
    const wheel = gear({ teeth, radius: spec.r, thickness: 0.04, holeR: spec.r * 0.16, cutouts: 5 }, material);
    const pinion = gear({ teeth: 8, radius: spec.r * 0.3, thickness: 0.07, holeR: spec.r * 0.08 }, pinionMat);
    pinion.position.z = 0.05;
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 10).rotateX(Math.PI / 2), steel);
    g.add(wheel, pinion, staff);
    movement.add(g);
    return g;
  }
  const centre = trainWheel(L.centre, 30, goldWheel);
  const third = trainWheel(L.third, 24, goldWheel);
  const fourth = trainWheel(L.fourth, 18, goldWheel);

  // --- escape wheel ---------------------------------------------------------
  const escape = new THREE.Group();
  escape.position.set(...C(L.escape.x, L.escape.y));
  const escWheel = escapeWheel(ESC_TEETH, L.escape.r, 0.035, steel);
  const escPinion = gear({ teeth: 7, radius: L.escape.r * 0.3, thickness: 0.06, holeR: 0.02 }, steel);
  escPinion.position.z = 0.05;
  escape.add(escWheel, escPinion);
  movement.add(escape);

  // --- pallet fork ----------------------------------------------------------
  // Pivots near the escape wheel; two arms carry ruby pallet jewels that
  // alternately lock the escape teeth, and a slotted fork end receives the
  // balance's impulse jewel.
  // Built along local +X (short arm, toward the escape wheel) and -X (long
  // arm, toward the balance); the whole lever is then rotated by palletBase so
  // +X aims at the escape wheel, with the beat-to-beat rock added on top.
  const palletBase = Math.atan2(L.escape.y - L.palletPivot.y, L.escape.x - L.palletPivot.x);
  const pallet = new THREE.Group();
  pallet.position.set(...C(L.palletPivot.x, L.palletPivot.y));
  pallet.position.z = 0.05;
  const pivotJewel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 12).rotateX(Math.PI / 2), ruby);
  // short arm + two pallet stones that straddle the escape teeth near the rim
  const armE = box(0.17, 0.05, 0.03, steel);
  armE.geometry.translate(0.085, 0, 0);
  const entryJewel = box(0.045, 0.075, 0.05, ruby);
  entryJewel.position.set(0.11, 0.055, 0);
  entryJewel.rotation.z = 0.5;
  const exitJewel = box(0.045, 0.075, 0.05, ruby);
  exitJewel.position.set(0.16, -0.04, 0);
  exitJewel.rotation.z = -0.5;
  // long arm to the fork end + horns/slot that receive the balance jewel
  const armF = box(0.3, 0.045, 0.03, steel);
  armF.geometry.translate(-0.15, 0, 0);
  const forkTip = new THREE.Group();
  forkTip.position.x = -0.3;
  for (const hy of [-0.055, 0.055]) {
    const horn = box(0.04, 0.05, 0.03, steel);
    horn.position.set(0, hy, 0);
    forkTip.add(horn);
  }
  pallet.add(pivotJewel, armE, entryJewel, exitJewel, armF, forkTip);
  movement.add(pallet);

  // --- balance wheel + hairspring + roller ----------------------------------
  const balance = new THREE.Group();
  balance.position.set(...C(L.balance.x, L.balance.y));
  balance.position.z = 0.12; // sits proud, over the train
  const rimGeo = new THREE.TorusGeometry(L.balance.r, 0.035, 12, 60);
  const rim = new THREE.Mesh(rimGeo, goldWheel);
  rim.castShadow = true;
  balance.add(rim);
  // two-arm balance (one full-diameter spoke) — real balances have 2–3 arms
  const spoke = box(0.055, L.balance.r * 2, 0.03, goldWheel);
  balance.add(spoke);
  // timing screws around the rim
  for (let i = 0; i < 8; i++) {
    const a = (i * TAU) / 8;
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.09, 8).rotateX(Math.PI / 2), steel);
    screw.position.set(Math.cos(a) * L.balance.r, Math.sin(a) * L.balance.r, 0);
    balance.add(screw);
  }
  const staffHub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 12).rotateX(Math.PI / 2), steel);
  balance.add(staffHub);
  // roller table under the balance, carrying the impulse jewel
  const roller = new THREE.Group();
  roller.position.z = -0.1;
  // orient so that at rest (balance angle 0, the impulse instant) the jewel
  // points from the balance staff toward the pallet-fork slot
  roller.rotation.z = Math.atan2(L.palletPivot.y - L.balance.y, L.palletPivot.x - L.balance.x) + Math.PI / 2;
  const rollerDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 20).rotateX(Math.PI / 2), steel);
  const impulseJewel = box(0.04, 0.04, 0.1, ruby);
  impulseJewel.position.set(0, -0.14, 0); // reaches toward the fork slot
  roller.add(rollerDisc, impulseJewel);
  balance.add(roller);
  movement.add(balance);
  // hairspring behind the balance, fixed group (breathes via scale) —
  // blued steel, ~half the balance diameter, many fine coils
  const hairspring = spiral(8, 0.04, L.balance.r * 0.52, 0.007, blued, 0);
  const hairGroup = new THREE.Group();
  hairGroup.position.set(...C(L.balance.x, L.balance.y));
  hairGroup.position.z = -0.02;
  hairGroup.add(hairspring);
  movement.add(hairGroup);

  // --- crown + stem (winding) — pokes out through the 3-o'clock case wall ---
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 12).rotateZ(Math.PI / 2), steel);
  stem.position.set(1.62, 0.1, 0);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.16, 24).rotateZ(Math.PI / 2), brass);
  crown.position.set(2.0, 0.1, 0);
  // knurling
  for (let i = 0; i < 16; i++) {
    const a = (i * TAU) / 16;
    const ridge = box(0.02, 0.02, 0.17, brass);
    ridge.position.set(2.0, 0.1 + Math.cos(a) * 0.16, Math.sin(a) * 0.16);
    ridge.rotation.x = a;
    movement.add(ridge);
  }
  movement.add(stem, crown);

  // --- callouts (movement anatomy — shown with the dress lifted off) --------
  const callouts = [];
  const addC = (text, lx, ly, dir, len) => {
    const c = callout(text, { dir, len });
    c.position.set(...C(lx, ly));
    c.position.z = 0.2;
    c.visible = false;
    movement.add(c);
    callouts.push(c);
  };
  // barrel/pallet fork/balance sit on the movement's left, where the anatomy
  // step's panel lives — their leaders point right (away from the panel)
  // rather than outward from the cluster, or the label-visibility gate fails
  addC('Mainspring barrel', L.barrel.x, L.barrel.y + 0.1, 30, 60);
  addC('Centre wheel', L.centre.x, L.centre.y, 60, 52);
  addC('Third wheel', L.third.x + 0.1, L.third.y, 20, 50);
  addC('Fourth wheel', L.fourth.x + 0.05, L.fourth.y - 0.1, -35, 54);
  addC('Escape wheel', L.escape.x, L.escape.y - 0.1, -110, 52);
  addC('Pallet fork', L.palletPivot.x - 0.05, L.palletPivot.y + 0.15, 20, 54);
  addC('Balance wheel', L.balance.x, L.balance.y - 0.15, -30, 56);
  addC('Crown', 2.0, 0.1, 0, 46);

  // ==========================================================================
  // CASE — band, dark liner, caseback, lugs (always visible)
  // ==========================================================================
  const watchCase = new THREE.Group();
  watchCase.position.set(0, CY, 0);
  group.add(watchCase);

  // case band: closed lathe ring, axis rotated onto +Z. The concave inner
  // wall is metal, so a dark rough liner hides it (mirror-blowout rule).
  const profile = [
    [0.86, -0.5],
    [1.0, -0.42],
    [1.03, -0.06],
    [0.98, 0.14],
    [0.85, 0.26],
    [0.78, 0.26],
    [0.8, -0.48],
    [0.86, -0.5],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const bandGeo = new THREE.LatheGeometry(profile, 72);
  bandGeo.rotateX(Math.PI / 2);
  const band = new THREE.Mesh(bandGeo, caseSteel);
  band.castShadow = true;
  watchCase.add(band);
  const liner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.79, 0.79, 0.66, 48, 1, true).rotateX(Math.PI / 2),
    linerMat,
  );
  liner.material.side = THREE.BackSide;
  liner.position.z = -0.1;
  watchCase.add(liner);
  const caseback = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 0.06, 48).rotateX(Math.PI / 2),
    caseSteel,
  );
  caseback.position.z = -0.47;
  watchCase.add(caseback);
  // lugs bridge the case to the bracelet at 12 and 6
  for (const sy of [1, -1]) {
    const lug = beveledBox(0.44, 0.24, 0.3, caseSteel, 0.05);
    lug.position.set(0, sy * 1.02, -0.26);
    watchCase.add(lug);
  }

  // ==========================================================================
  // DRESS — dial, hands, crystal. setDress(false) hides it to reveal the
  // movement; the case stays as the frame.
  // ==========================================================================
  const dress = new THREE.Group();
  dress.position.set(0, CY, 0);
  group.add(dress);

  const dial = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.8, 0.03, 64).rotateX(Math.PI / 2),
    dialMat,
  );
  dial.position.z = 0.2;
  dress.add(dial);
  // baton indices, doubled at 12
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12;
    const n = i === 0 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const baton = beveledBox(0.035, 0.12, 0.02, accentMat, 0.008);
      const off = n === 2 ? (k - 0.5) * 0.05 : 0;
      baton.position.set(
        Math.sin(a) * 0.64 + Math.cos(a) * off,
        Math.cos(a) * 0.64 - Math.sin(a) * off,
        0.225,
      );
      baton.rotation.z = -a;
      dress.add(baton);
    }
  }
  // hands: hour + minute frozen at ten-past-ten, seconds sweeps with the beat
  function hand(w, len, mat, z) {
    const m = beveledBox(w, len, 0.014, mat, 0.006);
    m.geometry.translate(0, len * 0.38, 0);
    m.position.z = z;
    dress.add(m);
    return m;
  }
  const hourHand = hand(0.055, 0.4, handMat, 0.245);
  hourHand.rotation.z = ((-(10 + 9 / 60) / 12) * TAU) % TAU;
  const minuteHand = hand(0.04, 0.6, handMat, 0.262);
  minuteHand.rotation.z = (-9 / 60) * TAU;
  const secondsHand = hand(0.016, 0.68, accentMat, 0.28);
  const centerCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.1, 16).rotateX(Math.PI / 2),
    accentMat,
  );
  centerCap.position.z = 0.25;
  dress.add(centerCap);
  // domed crystal — real transmissive glass [rung 2b, CANDIDATE]: thin-shell
  // transmission (thickness 0.08, ior 1.52) instead of the fake opacity
  // preset, plus a faint iridescent AR-coating sheen real watch crystals have.
  const crystalGeo = new THREE.SphereGeometry(0.8, 48, 24, 0, TAU, 0, Math.PI / 2);
  crystalGeo.rotateX(Math.PI / 2);
  crystalGeo.scale(1, 1, 0.35);
  const crystalMat = new THREE.MeshPhysicalMaterial({
    color: 0xdfeaff,
    metalness: 0,
    roughness: 0.04,
    transmission: 1,
    thickness: 0.08,
    ior: 1.52,
    transparent: false,
    iridescence: 0.15,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [100, 400],
    // fingerprint smudges [rung 3]: live in the COAT, not the base, so the
    // clean glass stays clean and only the touched patches haze faintly
    clearcoat: 0.5,
    clearcoatRoughness: 0.25,
    clearcoatRoughnessMap: smudgeMap(),
  });
  const crystal = new THREE.Mesh(crystalGeo, crystalMat);
  crystal.position.z = 0.26;
  dress.add(crystal);

  // ==========================================================================
  // DISPLAY ROLLER — a matte charcoal capsule through the bracelet, like a
  // jeweller's watch stand. Neutral on purpose: no arm/hand (user decision —
  // a stylized body part reads as a toy next to the realistic watch).
  // Capsule, not cylinder: no flat cut faces to catch the eye.
  // ==========================================================================
  const stand = new THREE.Mesh(
    new THREE.CapsuleGeometry(1.05, 3.0, 8, 36).rotateZ(Math.PI / 2),
    materials.rubber(0x2b3038),
  );
  stand.scale.z = 0.76;
  stand.position.set(0, CY, WRIST_Z);
  stand.castShadow = true;
  stand.receiveShadow = true;
  group.add(stand);

  // ==========================================================================
  // BRACELET — chain of beveled links closing the loop around the roller
  // ==========================================================================
  const A = 1.3; // ellipse half-height (y)
  const B = 1.0; // ellipse half-depth (z)
  const LINKS = 20;
  const phi0 = THREE.MathUtils.degToRad(62);
  const phi1 = THREE.MathUtils.degToRad(298);
  for (let i = 0; i < LINKS; i++) {
    const phi = phi0 + ((phi1 - phi0) * i) / (LINKS - 1);
    const link = beveledBox(0.5, 0.26, 0.1, linkSteel, 0.03);
    link.position.set(0, CY + A * Math.sin(phi), WRIST_Z + B * Math.cos(phi));
    link.rotation.x = Math.atan2(-B * Math.sin(phi), A * Math.cos(phi));
    group.add(link);
  }
  // transition links: bridge each lug down the steep drop from the raised
  // case to where the wrist ellipse takes over, so the strap reads from the
  // front instead of vanishing behind the case
  for (const s of [1, -1]) {
    for (const t of [0.3, 0.65]) {
      const link = beveledBox(0.5, 0.26, 0.1, linkSteel, 0.03);
      link.position.set(0, CY + s * (1.09 + 0.06 * t), -0.42 - 0.4 * t);
      link.rotation.x = -s * (1.45 - 0.48 * t);
      group.add(link);
    }
  }

  // --- pose -----------------------------------------------------------------
  const state = { beat: 0 };
  const hairBaseScale = hairspring.scale.x;

  function apply() {
    const beat = state.beat;
    const n = Math.floor(beat);
    const f = beat - n;
    const ease = smoothstep(0.0, 0.16, f); // fast unlock+impulse just after each integer beat
    const escIndex = n + ease;

    // escapement (the seamless, visually dominant motion)
    balance.rotation.z = BAL_AMP * Math.sin(Math.PI * beat);
    escape.rotation.z = escIndex * (TAU / ESC_TEETH);
    const from = n % 2 === 0 ? 1 : -1;
    pallet.rotation.z = palletBase + PAL_AMP * (from - 2 * from * ease);
    // hairspring breathes with the balance and turns a little with it
    hairGroup.rotation.z = balance.rotation.z * 0.16;
    const br = 1 + 0.05 * Math.cos(Math.PI * beat);
    hairspring.scale.set(hairBaseScale * br, hairBaseScale * br, 1);

    // train wheels — whole revs per 60-beat loop, so all seamless
    const rev = beat / BEATS;
    barrel.rotation.z = rev * TAU; // 1
    centre.rotation.z = -rev * TAU; // 1
    third.rotation.z = rev * TAU * 1; // 1
    fourth.rotation.z = -rev * 2 * TAU; // 2 (the seconds arbor)
    // seconds hand sweeps exactly one turn per lap (clockwise seen from +Z)
    secondsHand.rotation.z = -rev * TAU;
    // mainspring visibly unwinds (coils migrate to the barrel wall) over the
    // first half of the lap and rewinds over the second — a full cosine
    // cycle per lap keeps the loop seamless
    mainspring.morphTargetInfluences[0] = 0.5 - 0.5 * Math.cos(TAU * rev);
  }
  apply();

  return {
    group,
    state,
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setBeat(beat) {
      state.beat = beat;
      apply();
    },
    setLabels(v) {
      for (const c of callouts) c.visible = v;
    },
    // dial + hands + crystal on (the watch you'd wear) or lifted away (the
    // movement exposed inside the case). Steps snap this on entry.
    setDress(v) {
      dress.visible = v;
    },
  };
}
