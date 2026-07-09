import * as THREE from 'three';
import { materials, disc, arrow, label } from '../../framework/parts.js';
import { coil, tubeAlong, beveledBox } from '../../framework/geometry.js';
import { callout } from '../../framework/labels.js';

// A core-type power transformer, product-shot staged on a charcoal plinth: a
// closed rectangular laminated-steel loop ("core") with two windings, a
// many-turn PRIMARY on the left leg and a few-turn, thick-wire SECONDARY on
// the right leg — a step-down transformer, the shape you'd find inside a
// wall adapter or distribution substation.
//
// Reference facts (validated against Wikipedia's Transformer article):
//  - A transformer has NO electrical connection between primary and
//    secondary — they are coupled only magnetically, through a shared
//    ferromagnetic core. Current in the primary winding produces a magnetic
//    flux in the core (Ampere's law); because the two coils share that same
//    core, the SAME flux threads the secondary winding.
//  - Faraday's law: only a CHANGING flux induces an EMF (voltage) in a
//    winding. A steady, unchanging flux (as DC would produce once settled)
//    induces nothing — this is why transformers only work on alternating
//    current. Switching DC on/off does briefly induce a pulse (the flux IS
//    changing during that transient), but a transformer cannot pass steady
//    DC power.
//  - Turns ratio sets the voltage ratio: Vs/Vp = Ns/Np. Fewer secondary
//    turns than primary (Ns < Np) steps voltage DOWN; more steps it up.
//    Power is conserved (ideal transformer, no losses), so current trades
//    off inversely: Vp*Ip = Vs*Is. Here Np=32, Ns=8 (a 4:1 step-down):
//    240V/0.5A in, 60V/2A out — same 120W, quarter the voltage, four times
//    the current, which is also why the secondary is wound with thicker
//    wire (it has to carry more current).
//  - Real cores are LAMINATED — built from many thin, individually
//    insulated steel sheets stacked together, rather than one solid billet.
//    A solid core is itself a lone conductor sitting in a changing field, so
//    it grows its own large circulating "eddy currents" that heat the core
//    and waste energy; laminating the core breaks those loops into many tiny
//    slivers, so far less current can circulate in each one and losses
//    drop sharply. (Grid transformers use the same idea at larger scale.)
//  - The grid tie-in: transmission lines lose power to resistive heating in
//    proportion to I^2, so utilities step voltage way UP for transmission
//    (lower current for the same power) and step it back DOWN in stages
//    near the point of use — the same turns-ratio trick shown here, just at
//    extreme ratios (tens of thousands of volts down to a wall socket).

const DISC_TOP = 0.12;
const LEAD_GAP = 0.3;

const CORE_W = 1.0;
const CORE_H = 1.6;
const LEG_T = 0.24;
const CORE_D = 0.44;
const LEG_X = CORE_W / 2 - LEG_T / 2; // 0.38 — leg centerline offset
const YOKE_Y = CORE_H / 2 - LEG_T / 2; // 0.68 — yoke centerline offset
const LEG_H = CORE_H - 2 * LEG_T; // legs span only the window height — yokes
// butt flush against their ends, so no piece overlaps another (overlapping
// slabs read as a dark AO seam where they cross).

const CENTER_Y = DISC_TOP + LEAD_GAP + CORE_H / 2;

const PRI_TURNS = 32;
const SEC_TURNS = 8;
const PRI_LEN = 0.95;
const SEC_LEN = 0.34;
const BOBBIN_R = 0.28;
const PRI_WIRE_R = 0.011;
const SEC_WIRE_R = 0.02;

const WIRE_COLOR = 0xc9853f; // enamelled copper
const WIRE_COLOR_SEC = 0xb5713a; // heavier-gauge copper, slightly darker/warmer
const CORE_COLOR = 0x494e57; // dark blue-grey silicon steel
const FIELD_COLOR = 0x8fc4ff;
const POS_COLOR = 0x6ea8ff; // current one direction
const NEG_COLOR = 0xffa860; // current the other direction (AC reverses)
const HEAT_COLOR = 0xff5a3c;
const COOL_COLOR = 0x9fd4ff;

// Fine horizontal seam lines standing in for stacked lamination sheets —
// composited once, reused (cloned per mesh so repeat can vary) as a
// roughnessMap. roughnessMap MULTIPLIES base roughness, so texels sit near
// mid-grey and the core material's base roughness is set high (see below).
function laminationMap() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8a8a8a';
  ctx.fillRect(0, 0, 32, 256);
  ctx.fillStyle = '#5c5c5c';
  for (let y = 0; y < 256; y += 7) ctx.fillRect(0, y, 32, 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function coreMaterial(repeatX, repeatY) {
  const map = laminationMap();
  map.repeat.set(repeatX, repeatY);
  return new THREE.MeshPhysicalMaterial({
    color: CORE_COLOR,
    metalness: 0.5,
    roughness: 0.85,
    roughnessMap: map,
    clearcoat: 0.18,
    clearcoatRoughness: 0.45,
    transparent: true,
    opacity: 1,
  });
}

function wireMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.3,
    metalness: 0.55,
    clearcoat: 0.55,
    clearcoatRoughness: 0.22,
  });
}

// Counter-clockwise rounded-rectangle point loop (XY plane, z=0), used as the
// magnetic path centerline running through the middle of every leg/yoke.
function roundedRectPoints(hw, hh, r, segsPerCorner = 10) {
  const corners = [
    { cx: hw - r, cy: hh - r, start: 0 },
    { cx: -(hw - r), cy: hh - r, start: 90 },
    { cx: -(hw - r), cy: -(hh - r), start: 180 },
    { cx: hw - r, cy: -(hh - r), start: 270 },
  ];
  const pts = [];
  for (const c of corners) {
    for (let i = 0; i <= segsPerCorner; i++) {
      const a = ((c.start + (i / segsPerCorner) * 90) * Math.PI) / 180;
      pts.push([c.cx + r * Math.cos(a), c.cy + r * Math.sin(a), 0]);
    }
  }
  return pts;
}

// Fixed-position "current" dots riding a wound coil's curve — necklace, not
// a chase — since AC current oscillates in place rather than flowing one
// direction, brightness + colour (not motion) carry the signal.
function buildCoilDots(curve, count, size) {
  const geo = new THREE.SphereGeometry(size, 10, 8);
  const dots = [];
  for (let i = 0; i < count; i++) {
    const t = Math.min(0.98, Math.max(0.02, i / (count - 1)));
    const mat = materials.glow(POS_COLOR, 1.2);
    mat.transparent = true;
    mat.opacity = 0;
    mat.depthWrite = false;
    const dot = new THREE.Mesh(geo, mat);
    dot.position.copy(curve.getPointAt(t));
    dots.push(dot);
  }
  return dots;
}

function applyCoilDots(dots, current, visible) {
  const mag = Math.min(1, Math.abs(current));
  const col = current >= 0 ? POS_COLOR : NEG_COLOR;
  dots.forEach((d) => {
    d.material.color.set(col);
    d.material.emissive.set(col);
    d.material.emissiveIntensity = 0.7 + mag * 1.3;
    d.material.opacity = visible ? mag * 0.95 : 0;
  });
}

// Orient a +Y-pointing mesh (arrow()'s cone) along an arbitrary direction.
function orientAlong(mesh, dir) {
  const up = new THREE.Vector3(0, 1, 0);
  mesh.quaternion.setFromUnitVectors(up, dir.clone().normalize());
}

export function buildTransformer({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // --- display plinth -----------------------------------------------------
  const baseDisc = disc(1.05, 0.14, materials.paintedMetal(0x24262b));
  baseDisc.position.y = 0.07;
  group.add(baseDisc);

  const leadMat = materials.chrome(0xd6dae0);
  const rig = new THREE.Group();
  rig.position.y = CENTER_Y;
  group.add(rig);

  // =======================================================================
  // CORE — closed laminated rectangular loop, four overlapping slabs (two
  // legs, full height; two yokes, full width) so the corners are solid with
  // no gap. Kept `transparent` so mechanism steps can "ghost" it to reveal
  // the flux running through the middle.
  // =======================================================================
  const coreGroup = new THREE.Group();
  rig.add(coreGroup);

  const legMatL = coreMaterial(2, 16);
  const legMatR = coreMaterial(2, 16);
  const yokeMatT = coreMaterial(10, 3);
  const yokeMatB = coreMaterial(10, 3);

  // Legs span only the window height and yokes the full width, meeting
  // flush at each corner — no piece overlaps another, so there's no double
  // geometry for ambient occlusion to pool into a dark seam.
  const legL = beveledBox(LEG_T, LEG_H, CORE_D, legMatL, 0.02);
  legL.position.set(-LEG_X, 0, 0);
  const legR = beveledBox(LEG_T, LEG_H, CORE_D, legMatR, 0.02);
  legR.position.set(LEG_X, 0, 0);
  const yokeT = beveledBox(CORE_W, LEG_T, CORE_D, yokeMatT, 0.02);
  yokeT.position.set(0, YOKE_Y, 0);
  const yokeB = beveledBox(CORE_W, LEG_T, CORE_D, yokeMatB, 0.02);
  yokeB.position.set(0, -YOKE_Y, 0);
  coreGroup.add(legL, legR, yokeT, yokeB);
  const coreMats = [legMatL, legMatR, yokeMatT, yokeMatB];

  // =======================================================================
  // WINDINGS — primary (many turns, thin wire) on the left leg, secondary
  // (few turns, thick wire) on the right — a 4:1 step-down.
  // =======================================================================
  const windingGroup = new THREE.Group();
  rig.add(windingGroup);

  const primary = coil(
    { turns: PRI_TURNS, radius: BOBBIN_R, length: PRI_LEN, wireRadius: PRI_WIRE_R, segmentsPerTurn: 14 },
    wireMaterial(WIRE_COLOR),
  );
  primary.mesh.position.x = -LEG_X;
  windingGroup.add(primary.mesh);

  const secondary = coil(
    { turns: SEC_TURNS, radius: BOBBIN_R, length: SEC_LEN, wireRadius: SEC_WIRE_R, segmentsPerTurn: 14 },
    wireMaterial(WIRE_COLOR_SEC),
  );
  secondary.mesh.position.x = LEG_X;
  windingGroup.add(secondary.mesh);

  function capEnds(pts, offsetX, wireR, mat) {
    const a = new THREE.Mesh(new THREE.SphereGeometry(wireR, 10, 8), mat);
    a.position.set(pts[0][0] + offsetX, pts[0][1], pts[0][2]);
    const b = new THREE.Mesh(new THREE.SphereGeometry(wireR, 10, 8), mat.clone());
    const last = pts[pts.length - 1];
    b.position.set(last[0] + offsetX, last[1], last[2]);
    windingGroup.add(a, b);
  }
  capEnds(primary.points, -LEG_X, PRI_WIRE_R, wireMaterial(WIRE_COLOR));
  capEnds(secondary.points, LEG_X, SEC_WIRE_R, wireMaterial(WIRE_COLOR_SEC));

  // leads: bow outward from the leg, down to the plinth
  const leadTipY = DISC_TOP - CENTER_Y;
  function legLeadPts(p0, offsetX, outSign) {
    const x0 = p0[0] + offsetX;
    const z0 = p0[2];
    return [
      [x0, p0[1], z0],
      [x0 + outSign * 0.3, (p0[1] + leadTipY) * 0.55, z0 * 0.6],
      [x0 + outSign * 0.42, leadTipY, z0 * 0.3],
    ];
  }
  const priLeadInPts = legLeadPts(primary.points[0], -LEG_X, -1);
  const priLeadOutPts = legLeadPts(primary.points[primary.points.length - 1], -LEG_X, -1);
  const secLeadInPts = legLeadPts(secondary.points[0], LEG_X, 1);
  const secLeadOutPts = legLeadPts(secondary.points[secondary.points.length - 1], LEG_X, 1);
  [priLeadInPts, priLeadOutPts, secLeadInPts, secLeadOutPts].forEach((pts) => {
    const mesh = tubeAlong(pts, 0.02, leadMat.clone(), { tubularSegments: 20 });
    windingGroup.add(mesh);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), leadMat.clone());
    tip.position.set(...pts[pts.length - 1]);
    windingGroup.add(tip);
  });

  const priDots = buildCoilDots(primary.curve, 24, 0.018);
  priDots.forEach((d) => {
    d.position.x += -LEG_X;
    windingGroup.add(d);
  });
  const secDots = buildCoilDots(secondary.curve, 10, 0.026);
  secDots.forEach((d) => {
    d.position.x += LEG_X;
    windingGroup.add(d);
  });

  // =======================================================================
  // FLUX — a slim glowing loop embedded along the core's magnetic
  // centerline, plus forward/reverse arrow pairs at each leg/yoke midpoint
  // so the AC reversal reads as a direction flip, not just a brightness dip.
  // =======================================================================
  const fluxGroup = new THREE.Group();
  rig.add(fluxGroup);

  const fluxMat = new THREE.MeshBasicMaterial({ color: FIELD_COLOR, transparent: true, opacity: 0, depthWrite: false });
  const fluxPts = roundedRectPoints(LEG_X, YOKE_Y, LEG_T * 0.62, 10);
  const fluxMesh = tubeAlong(fluxPts, 0.035, fluxMat, { tubularSegments: 120, radialSegments: 8, closed: true });
  fluxGroup.add(fluxMesh);

  const arrowSites = [
    { pos: [LEG_X, 0, 0], fwd: new THREE.Vector3(0, 1, 0) },
    { pos: [0, YOKE_Y, 0], fwd: new THREE.Vector3(-1, 0, 0) },
    { pos: [-LEG_X, 0, 0], fwd: new THREE.Vector3(0, -1, 0) },
    { pos: [0, -YOKE_Y, 0], fwd: new THREE.Vector3(1, 0, 0) },
  ];
  const fluxArrowsFwd = [];
  const fluxArrowsRev = [];
  for (const site of arrowSites) {
    const af = arrow(FIELD_COLOR, 0.1);
    af.position.set(...site.pos);
    orientAlong(af, site.fwd);
    af.material.transparent = true;
    af.material.opacity = 0;
    fluxGroup.add(af);
    fluxArrowsFwd.push(af);
    const ar = arrow(FIELD_COLOR, 0.1);
    ar.position.set(...site.pos);
    orientAlong(ar, site.fwd.clone().negate());
    ar.material.transparent = true;
    ar.material.opacity = 0;
    fluxGroup.add(ar);
    fluxArrowsRev.push(ar);
  }

  // =======================================================================
  // EDDY-CURRENT DEMO — embedded in the (fully exposed, unwound) top yoke:
  // a couple of large glowing loops standing in for uninterrupted eddy
  // currents in a hypothetically SOLID core (hot, wasteful) versus a stack
  // of small confined loops for the real laminated core (cool, contained).
  // =======================================================================
  const eddyGroup = new THREE.Group();
  eddyGroup.position.set(0, YOKE_Y, 0);
  rig.add(eddyGroup);

  const eddyBigMat = materials.glow(HEAT_COLOR, 0);
  eddyBigMat.transparent = true;
  eddyBigMat.opacity = 0;
  eddyBigMat.depthWrite = false;
  const eddyBig = [];
  for (const x of [-0.16, 0.16]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 8, 24), eddyBigMat.clone());
    t.rotation.y = Math.PI / 2;
    t.position.x = x;
    eddyGroup.add(t);
    eddyBig.push(t);
  }
  const eddySmallMat = materials.glow(COOL_COLOR, 0);
  eddySmallMat.transparent = true;
  eddySmallMat.opacity = 0;
  eddySmallMat.depthWrite = false;
  const eddySmall = [];
  for (let i = 0; i < 6; i++) {
    const x = -0.3 + (i / 5) * 0.6;
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 6, 16), eddySmallMat.clone());
    t.rotation.y = Math.PI / 2;
    t.scale.z = 0.4;
    t.position.x = x;
    eddyGroup.add(t);
    eddySmall.push(t);
  }
  const heatLight = new THREE.PointLight(HEAT_COLOR, 0, 1.4);
  eddyGroup.add(heatLight);

  // =======================================================================
  // labels
  // =======================================================================
  const formulaLabel = label('Vs / Vp = Ns / Np', { color: '#dff3ff', size: 0.13 });
  formulaLabel.position.set(0, YOKE_Y + 0.32, 0.15);
  formulaLabel.material.opacity = 0;
  rig.add(formulaLabel);

  const calloutGroups = {
    anatomy: [],
    primary: [],
    induce: [],
    ratio: [],
    ac: [],
    lamination: [],
    grid: [],
  };
  function tag(which, parent, text, pos, dir, len = 60) {
    const c = callout(text, { dir, len });
    c.position.set(...pos);
    c.visible = false;
    parent.add(c);
    calloutGroups[which].push(c);
    return c;
  }

  tag('anatomy', legL, 'Laminated iron core', [-LEG_T / 2, 0.35, CORE_D / 2], 60, 90);
  tag('anatomy', primary.mesh, 'Primary winding', [BOBBIN_R, 0.1, 0], 20, 90);
  tag('anatomy', secondary.mesh, 'Secondary winding', [BOBBIN_R, 0.1, 0], -20, 90);

  tag('primary', primary.mesh, 'AC current builds a changing flux', [BOBBIN_R, 0.15, 0], 30, 110);

  tag('induce', fluxMesh, 'Flux threads the shared core', [0, YOKE_Y * 0.6, 0.15], 60, 110);
  tag('induce', secondary.mesh, 'Induced voltage in the secondary', [BOBBIN_R, 0.05, 0], -25, 120);

  tag('ratio', primary.mesh, `Np = ${PRI_TURNS} turns`, [BOBBIN_R * 0.6, PRI_LEN * 0.3, BOBBIN_R * 0.6], 55, 90);
  tag('ratio', secondary.mesh, `Ns = ${SEC_TURNS} turns`, [BOBBIN_R * 0.6, SEC_LEN * 0.5, BOBBIN_R * 0.6], -55, 90);

  tag('ac', primary.mesh, 'Steady DC: no change, no induction', [BOBBIN_R, -0.1, 0], -40, 130);

  tag('lamination', eddyBig[0], 'Eddy currents in solid steel — wasted heat', [0.2, 0.1, 0.15], 40, 140);
  tag('lamination', eddySmall[0], 'Thin insulated sheets confine them', [-0.1, -0.15, 0.2], -50, 140);

  tag('grid', legR, 'Extreme ratios: up for the wires, down for your wall', [LEG_T / 2, -0.15, 0], -70, 100);

  // =======================================================================
  // pose / state
  // =======================================================================
  const state = {
    current: 0,
    fluxViz: 0,
    secondaryViz: 1,
    ghost: 0,
    showRatio: false,
    solidAmount: 0,
    eddyViz: 0,
  };

  function apply() {
    const c = state.current;
    const mag = Math.min(1, Math.abs(c));

    applyCoilDots(priDots, c, true);
    applyCoilDots(secDots, c, state.secondaryViz > 0.5);

    fluxMat.opacity = state.fluxViz * (0.08 + 0.7 * mag);
    const showFwd = state.fluxViz * Math.max(0, c) * 0.9;
    const showRev = state.fluxViz * Math.max(0, -c) * 0.9;
    fluxArrowsFwd.forEach((a) => (a.material.opacity = showFwd));
    fluxArrowsRev.forEach((a) => (a.material.opacity = showRev));

    coreMats.forEach((m) => {
      m.opacity = 1 - state.ghost * 0.45;
    });

    formulaLabel.material.opacity = state.showRatio ? 1 : 0;

    const solid = state.solidAmount;
    const ev = state.eddyViz;
    eddyBig.forEach((t) => {
      t.material.opacity = ev * solid * (0.5 + 0.5 * mag);
      t.material.emissiveIntensity = 0.4 + solid * mag * 3.5;
    });
    eddySmall.forEach((t) => {
      t.material.opacity = ev * (1 - solid) * (0.35 + 0.4 * mag);
      t.material.emissiveIntensity = 0.3 + (1 - solid) * mag * 1.2;
    });
    heatLight.intensity = ev * solid * mag * 3;
  }
  apply();

  return {
    group,
    setLabels(which, v = true) {
      for (const [name, list] of Object.entries(calloutGroups)) {
        const show = v && name === which;
        for (const c of list) c.visible = show;
      }
    },
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
  };
}
