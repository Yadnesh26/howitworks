import * as THREE from 'three';
import { materials, rod, disc, label } from '../../framework/parts.js';
import { beveledBox, windableRibbon } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';

// A cylindrical 18650 lithium-ion cell, product-shot staged on a charcoal
// stand — plus a "roll" view (the real wound jelly-roll construction) and an
// enlarged "schematic" slab pair used to visualize the invisible chemistry:
// ion shuttling, ageing (SEI growth, high-voltage cathode stress), lithium
// plating / dendrite growth, and the 20-80% charge-window payoff.
//
// Reference facts (validated against Wikipedia's Lithium-ion battery article,
// NOVONIX/large-battery.com/eepower.com degradation writeups, and standard
// 18650 teardown references — see the pipeline's research notes):
//  - 18650 = 18mm diameter x 65mm height (the name IS the size); a can body
//    that is the NEGATIVE terminal, a raised "button" cap that is the
//    POSITIVE terminal, separated by an insulating gasket ring.
//  - Inside: an aluminum-foil cathode current collector coated with a
//    layered lithium metal oxide (LCO/NMC-type), a copper-foil anode current
//    collector coated with graphite, and a porous polymer separator soaked
//    in liquid electrolyte — all wound together into a "jelly roll".
//  - Charging: Li+ ions are pulled out of the cathode's layered lattice,
//    cross the electrolyte and the porous (ion-permeable) separator, and
//    intercalate BETWEEN the graphite anode's stacked layers. Electrons
//    cannot cross the separator, so they take the external circuit — that
//    electron flow IS the charging current. Discharge runs the whole thing
//    in reverse: ions and electrons both flow anode -> cathode, the
//    electrons this time doing work in the external device. Nothing is
//    burned or consumed — it is a reversible shuttle between two lattices.
//  - Full charge sits at ~4.2 V, nominal ~3.7 V (roughly 50% SOC), discharge
//    cutoff ~3.0 V.
//  - Ageing has (at least) three real mechanisms, all worse near full
//    charge and heat: the solid-electrolyte-interphase (SEI) film on the
//    anode thickens irreversibly, consuming active lithium and raising
//    resistance; the cathode lattice undergoes structural stress and
//    accelerated electrolyte oxidation above roughly 4.1 V (~80% SOC); and
//    fast charging or charging cold pushes lithium to plate as metal on the
//    anode surface instead of intercalating cleanly, which can grow into
//    dendrites that eventually pierce the separator and short the cell.
//  - Net result: cycling between roughly 20% and 80% state of charge keeps
//    the cell mostly out of the high-stress top of the voltage range, and
//    can roughly TRIPLE cycle life (~500 cycles for a 0-100% habit vs.
//    1500+ for a 20-80% habit).

const CELL_R = 0.33; // -> diameter 0.66. Real 18650 ratio 18mm:65mm = 0.277.
const DISC_TOP = 0.07 + 0.07; // stand top surface (matches capacitor/transistor's round base-disc convention)

// --- can body lathe profile (bottom pole -> straight wall -> shoulder) -----
const CAN_BODY_BOTTOM = DISC_TOP + 0.04; // where the full-radius wall begins
const CAN_BODY_H = 2.05;
const CAN_BODY_TOP = CAN_BODY_BOTTOM + CAN_BODY_H;
const SHOULDER_H = 0.1;
const CAN_TOP_SHOULDER_Y = CAN_BODY_TOP + SHOULDER_H;
const GASKET_R = CELL_R * 0.68;
const GASKET_H = 0.035;
const CAP_BOTTOM_Y = CAN_TOP_SHOULDER_Y + GASKET_H;
const CAP_R = GASKET_R * 0.94;
const CAP_BASE_H = 0.02;
const CAP_DOME_H = 0.14;
const CELL_TOP_Y = CAP_BOTTOM_Y + CAP_BASE_H + CAP_DOME_H;
const CENTER_Y = (DISC_TOP + CELL_TOP_Y) / 2;
// Achieved ratio: (2*CELL_R) / (CELL_TOP_Y - DISC_TOP) = 0.66 / 2.385 = 0.277 — matches 18:65.

const CATHODE_COLOR = 0xd98c4a; // layered lithium metal oxide — warm amber
const ANODE_COLOR = 0x33363c; // graphite — dark, near-black grey
const SEPARATOR_COLOR = 0xe9e4d6; // porous polymer membrane — pale cream
const ELECTROLYTE_COLOR = 0x6ea8ff;
const ION_COLOR = 0x62ffb0; // Li+ — bright green-cyan, reads distinct from electrons
const ELECTRON_COLOR = 0xffe066; // matches the explainer's accent
const SEI_COLOR = 0x93a6bd;
const DENDRITE_COLOR = 0xd7dee6;
const STRESS_COLOR = 0xff5a3c;

function wrapT(x) {
  return ((x % 1) + 1) % 1;
}

function sleeveTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 620;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#15161a';
  ctx.fillRect(0, 0, 512, 620);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#eceef2';
  ctx.font = '700 64px sans-serif';
  ctx.fillText('18650', 256, 210);
  ctx.font = '700 40px sans-serif';
  ctx.fillStyle = '#d7dae0';
  ctx.fillText('3.7 V  •  2600 mAh', 256, 270);
  ctx.font = '400 26px sans-serif';
  ctx.fillStyle = '#8a8e97';
  ctx.fillText('LITHIUM-ION  •  RECHARGEABLE', 256, 312);
  // simple polarity diagram near the bottom
  ctx.font = '700 46px sans-serif';
  ctx.fillStyle = '#9aa2ad';
  ctx.fillText('+', 190, 470);
  ctx.fillText('–', 322, 470);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function iconTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1b1d21';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#ffe066';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(70, 16);
  ctx.lineTo(38, 68);
  ctx.lineTo(60, 68);
  ctx.lineTo(52, 112);
  ctx.lineTo(92, 56);
  ctx.lineTo(68, 56);
  ctx.closePath();
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildLithiumIonBattery({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // --- display stand ------------------------------------------------------
  // paintedMetal's default clearcoat (1.0) is a known clipping trap at the
  // right grazing angle (see studioPlinth's softened numbers) — softened
  // the same way here since this explainer's payoff-step camera sits lower
  // than the other steps and catches it.
  const standMat = materials.paintedMetal(0x24262b);
  standMat.clearcoat = 0.45;
  standMat.clearcoatRoughness = 0.32;
  standMat.roughness = 0.55;
  const baseDisc = disc(0.85, 0.14, standMat);
  baseDisc.position.y = 0.07;
  group.add(baseDisc);

  const labels = calloutSets(['exterior', 'roll', 'charge', 'discharge', 'ageing', 'dendrite', 'payoff']);

  // =========================================================================
  // SHELL — the complete, solid cell (view: 'assembled')
  // =========================================================================
  const shell = new THREE.Group();
  group.add(shell);

  const canMat = materials.brushedSteel(0xb7bcc3);
  // brushedSteel's roughnessMap MULTIPLIES the base value (texels ~0.5) — on
  // a large curved casing like this can, the preset default reads near-chrome
  // unless overridden upward (see conventions.md's caution on this preset).
  canMat.roughness = 0.62;
  const canProfile = [
    [0, DISC_TOP],
    [CELL_R * 0.9, DISC_TOP + 0.02],
    [CELL_R, CAN_BODY_BOTTOM],
    [CELL_R, CAN_BODY_TOP],
    [CELL_R * 0.88, CAN_BODY_TOP + SHOULDER_H * 0.5],
    [GASKET_R, CAN_TOP_SHOULDER_Y],
  ];
  const canBody = new THREE.Mesh(
    new THREE.LatheGeometry(canProfile.map(([r, y]) => new THREE.Vector2(r, y)), 48),
    canMat,
  );
  canBody.castShadow = true;
  shell.add(canBody);

  const gasketMat = materials.polymer(0xd9d2bc);
  const gasket = disc(GASKET_R, GASKET_H, gasketMat, 40);
  gasket.position.y = CAN_TOP_SHOULDER_Y + GASKET_H / 2;
  shell.add(gasket);

  const capMat = materials.chrome(0xd6dae0);
  const capProfile = [
    [CAP_R, CAP_BOTTOM_Y],
    [CAP_R, CAP_BOTTOM_Y + CAP_BASE_H],
    [CAP_R * 0.65, CAP_BOTTOM_Y + CAP_BASE_H + 0.03],
    [0, CELL_TOP_Y],
  ];
  const capMesh = new THREE.Mesh(
    new THREE.LatheGeometry(capProfile.map(([r, y]) => new THREE.Vector2(r, y)), 40),
    capMat,
  );
  capMesh.castShadow = true;
  shell.add(capMesh);

  // insulating printed sleeve — leaves bare steel margins top/bottom, exactly
  // how a real wrapped 18650 looks
  const sleeveTopMargin = 0.07;
  const sleeveBottomMargin = 0.09;
  const sleeveH = CAN_BODY_H - sleeveTopMargin - sleeveBottomMargin;
  const sleeveMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: sleeveTexture(),
    roughness: 0.55,
    metalness: 0,
    clearcoat: 0.2,
    clearcoatRoughness: 0.5,
  });
  const sleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(CELL_R + 0.004, CELL_R + 0.004, sleeveH, 48, 1, true),
    sleeveMat,
  );
  sleeve.position.y = CAN_BODY_BOTTOM + sleeveBottomMargin + sleeveH / 2;
  shell.add(sleeve);

  // status ring near the button top — a subtle "charge level" glow, echoed
  // properly by the gauge in the payoff step
  const statusMat = new THREE.MeshStandardMaterial({
    color: ELECTRON_COLOR,
    emissive: ELECTRON_COLOR,
    emissiveIntensity: 0,
    roughness: 0.4,
  });
  const statusRing = new THREE.Mesh(new THREE.TorusGeometry(GASKET_R * 0.8, 0.01, 10, 32), statusMat);
  statusRing.rotation.x = Math.PI / 2;
  statusRing.position.y = CAN_TOP_SHOULDER_Y + 0.001;
  shell.add(statusRing);

  labels.add('exterior', canBody, 'Steel can — the NEGATIVE terminal', [CELL_R, CAN_BODY_TOP - CAN_BODY_BOTTOM - 0.2, 0], 35, 96);
  labels.add('exterior', sleeve, 'Printed rating sleeve', [CELL_R, -0.15, CELL_R * 0.9], -55, 90);
  labels.add('exterior', gasket, 'Insulating gasket', [GASKET_R, 0.02, 0], -20, 95);
  labels.add('exterior', capMesh, 'Button top — the POSITIVE terminal', [0.06, 0.05, 0], 65, 96);

  // =========================================================================
  // ROLL — the real internal construction, wound into a "jelly roll"
  // =========================================================================
  const roll = new THREE.Group();
  roll.position.y = CENTER_Y;
  group.add(roll);

  const alCollectorMat = new THREE.MeshPhysicalMaterial({ color: 0xaeb3ba, metalness: 0.85, roughness: 0.5 });
  const cuCollectorMat = new THREE.MeshPhysicalMaterial({ color: 0xc57f52, metalness: 0.85, roughness: 0.45 });
  const cathodeFoilMat = new THREE.MeshPhysicalMaterial({ color: CATHODE_COLOR, metalness: 0.15, roughness: 0.6 });
  const anodeFoilMat = new THREE.MeshPhysicalMaterial({ color: ANODE_COLOR, metalness: 0.05, roughness: 0.7 });
  const separatorMat = new THREE.MeshPhysicalMaterial({ color: SEPARATOR_COLOR, metalness: 0, roughness: 0.9 });

  const ribbonWidth = CAN_BODY_H * 0.6;
  const ribbonOpts = { length: 5.2, width: ribbonWidth, turns: 3.6, pitch: 0.1, lengthSegments: 150 };
  const anodeRibbon = windableRibbon({ ...ribbonOpts, radiusStart: 0.05 }, anodeFoilMat);
  const sepRibbon1 = windableRibbon({ ...ribbonOpts, radiusStart: 0.065 }, separatorMat);
  const cathodeRibbon = windableRibbon({ ...ribbonOpts, radiusStart: 0.08 }, cathodeFoilMat);
  const sepRibbon2 = windableRibbon({ ...ribbonOpts, radiusStart: 0.095 }, separatorMat.clone());
  const ribbons = [anodeRibbon, sepRibbon1, cathodeRibbon, sepRibbon2];
  ribbons.forEach((r, i) => {
    r.position.y = (i - 1.5) * 0.05;
    roll.add(r);
  });

  const mandrel = rod(0.045, ribbonWidth, materials.darkMetal(0x1c1e22));
  mandrel.position.y = -ribbonWidth / 2;
  roll.add(mandrel);

  labels.add('roll', cathodeRibbon, 'Cathode foil — layered lithium oxide (+)', [0.4, ribbonWidth * 0.16, 0], 45, 120);
  labels.add('roll', anodeRibbon, 'Anode foil — copper + graphite (–)', [0.4, -ribbonWidth * 0.2, 0], -45, 120);
  labels.add('roll', sepRibbon1, 'Separator, soaked in electrolyte', [0.4, 0, 0], 20, 115);

  // =========================================================================
  // SCHEMATIC — enlarged cathode | electrolyte+separator | anode slabs,
  // used to teach ion shuttling, ageing, and the 20-80% payoff.
  // Layout is symmetric about x=0: cathode on the left, anode on the right.
  // =========================================================================
  const schematic = new THREE.Group();
  schematic.position.set(0, CENTER_Y, 0);
  group.add(schematic);

  const CATH_W = 0.55;
  const ANODE_W = 0.55;
  const GAP = 0.34;
  const SLAB_H = 0.56;
  const SLAB_D = 0.5;
  const cathodeCx = -(GAP / 2 + CATH_W / 2);
  const anodeCx = GAP / 2 + ANODE_W / 2;
  const cathodeFaceX = -(GAP / 2);
  const anodeFaceX = GAP / 2;

  const schCathodeMat = new THREE.MeshPhysicalMaterial({ color: CATHODE_COLOR, roughness: 0.5, metalness: 0.1, emissive: new THREE.Color(STRESS_COLOR), emissiveIntensity: 0 });
  const schAnodeMat = new THREE.MeshPhysicalMaterial({ color: ANODE_COLOR, roughness: 0.6, metalness: 0.05, emissive: new THREE.Color(ION_COLOR), emissiveIntensity: 0 });

  // layered plates — literally stacked, not one solid block, so the copy's
  // "layered lattice" claim is visibly true
  const cathodeLayers = [];
  const CATH_N = 5;
  const cathPlateH = (SLAB_H * 0.85) / CATH_N;
  const cathGap = (SLAB_H * 0.15) / (CATH_N - 1);
  for (let i = 0; i < CATH_N; i++) {
    const plate = beveledBox(CATH_W, cathPlateH, SLAB_D, schCathodeMat, 0.01);
    plate.position.set(cathodeCx, -SLAB_H / 2 + cathPlateH / 2 + i * (cathPlateH + cathGap), 0);
    schematic.add(plate);
    cathodeLayers.push(plate);
  }
  const anodeLayers = [];
  const ANODE_N = 7;
  const anodePlateH = (SLAB_H * 0.85) / ANODE_N;
  const anodeGap = (SLAB_H * 0.15) / (ANODE_N - 1);
  for (let i = 0; i < ANODE_N; i++) {
    const plate = beveledBox(ANODE_W, anodePlateH, SLAB_D, schAnodeMat, 0.008);
    plate.position.set(anodeCx, -SLAB_H / 2 + anodePlateH / 2 + i * (anodePlateH + anodeGap), 0);
    schematic.add(plate);
    anodeLayers.push(plate);
  }

  // current collectors on the outer face of each electrode
  const cathCollector = beveledBox(0.03, SLAB_H, SLAB_D, alCollectorMat, 0.006);
  cathCollector.position.set(cathodeCx - CATH_W / 2 - 0.02, 0, 0);
  const anodeCollector = beveledBox(0.03, SLAB_H, SLAB_D, cuCollectorMat, 0.006);
  anodeCollector.position.set(anodeCx + ANODE_W / 2 + 0.02, 0, 0);
  schematic.add(cathCollector, anodeCollector);

  // electrolyte fills the gap; the separator is the thin higher-opacity
  // membrane inset in the middle (plain transparent material per the
  // material/reveal pre-flight checklist — never `transmission` behind glass)
  const electrolyteMat = new THREE.MeshPhysicalMaterial({
    color: ELECTROLYTE_COLOR, transparent: true, opacity: 0.14, roughness: 0.2, metalness: 0, side: THREE.DoubleSide, depthWrite: false,
  });
  const electrolyte = beveledBox(GAP, SLAB_H * 0.94, SLAB_D * 0.94, electrolyteMat, 0.01);
  schematic.add(electrolyte);
  const separatorMatSch = new THREE.MeshPhysicalMaterial({
    color: SEPARATOR_COLOR, transparent: true, opacity: 0.55, roughness: 0.85, metalness: 0, side: THREE.DoubleSide, depthWrite: false,
  });
  const separator = beveledBox(0.05, SLAB_H * 0.98, SLAB_D * 0.98, separatorMatSch, 0.006);
  schematic.add(separator);

  // SEI film hugging the anode's gap-facing surface — grows outward
  const seiMat = new THREE.MeshPhysicalMaterial({
    color: SEI_COLOR, transparent: true, opacity: 0.25, roughness: 0.4, metalness: 0, side: THREE.DoubleSide, depthWrite: false,
  });
  const seiFilm = beveledBox(0.01, SLAB_H * 0.9, SLAB_D * 0.9, seiMat, 0.004);
  seiFilm.position.set(anodeFaceX - 0.005, 0, 0);
  schematic.add(seiFilm);

  // dendrite spikes — metallic lithium plating instead of clean
  // intercalation, growing from the anode surface toward the separator.
  // Geometry is pre-translated so its BASE sits at the local origin (not its
  // center) — scaling then grows the tip outward from a fixed attachment
  // point instead of stretching symmetrically through the anode surface.
  const dendriteMaxLen = GAP / 2 - 0.025 - 0.02; // stop short of the separator face
  // Radius bumped from 0.014 (reviewer: nearly the same size as the anode's
  // own inter-layer gap, so the spikes read as thin cracks squeezed into the
  // seams rather than protruding into the gap) up to a clearly-visible size.
  const dendriteGeo = new THREE.ConeGeometry(0.032, dendriteMaxLen, 8);
  dendriteGeo.translate(0, dendriteMaxLen / 2, 0); // base -> y=0, apex -> y=dendriteMaxLen
  // DENDRITE_COLOR alone was nearly the same pale tone as the separator —
  // invisible in screenshots. A warm "hazard" emissive (driven by
  // state.dendrite below) both fixes contrast and reads as danger.
  const dendriteMat = new THREE.MeshPhysicalMaterial({
    color: DENDRITE_COLOR, metalness: 0.9, roughness: 0.2, emissive: new THREE.Color(0xff6a3c), emissiveIntensity: 0,
  });
  const dendrites = [];
  const dendriteSeeds = [
    [-0.16, 0.14], [0.05, -0.1], [0.18, 0.05], [-0.05, -0.19], [0.1, 0.19], [-0.18, -0.02],
  ];
  for (const [dy, dz] of dendriteSeeds) {
    const spike = new THREE.Mesh(dendriteGeo, dendriteMat);
    spike.rotation.z = Math.PI / 2; // local +Y (base->apex) rotates to world -X: apex grows toward the separator/cathode
    spike.position.set(anodeFaceX, dy, dz * (SLAB_D * 0.9));
    spike.scale.y = 0.001;
    schematic.add(spike);
    dendrites.push(spike);
  }

  // external circuit: a wire loop from the cathode collector up and over to
  // the anode collector, through a small charger/device plaque at the apex
  const apex = new THREE.Vector3(0, SLAB_H / 2 + 0.62, 0);
  const wireCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(cathCollector.position.x, SLAB_H / 2 + 0.04, 0),
    new THREE.Vector3(cathCollector.position.x * 0.5, SLAB_H / 2 + 0.4, 0),
    apex,
    new THREE.Vector3(anodeCollector.position.x * 0.5, SLAB_H / 2 + 0.4, 0),
    new THREE.Vector3(anodeCollector.position.x, SLAB_H / 2 + 0.04, 0),
  ]);
  const wireMat = materials.darkMetal(0x2a2d33);
  const wireMesh = new THREE.Mesh(new THREE.TubeGeometry(wireCurve, 40, 0.014, 8, false), wireMat);
  schematic.add(wireMesh);

  const plaqueMat = new THREE.MeshPhysicalMaterial({ map: iconTexture(), roughness: 0.5, metalness: 0, emissive: new THREE.Color(ELECTRON_COLOR), emissiveIntensity: 0 });
  const plaque = beveledBox(0.16, 0.16, 0.02, plaqueMat, 0.015);
  plaque.position.copy(apex);
  schematic.add(plaque);
  const plaqueLight = new THREE.PointLight(ELECTRON_COLOR, 0, 1.4);
  plaqueLight.position.copy(apex);
  schematic.add(plaqueLight);

  // ion (Li+) dots crossing the gap, and electron dots riding the external
  // wire — both driven by the SAME shuttle/dir scalars so they always agree
  // on direction (charge: cathode -> anode; discharge: anode -> cathode)
  function makeDots(count, color, size) {
    const geo = new THREE.SphereGeometry(size, 10, 8);
    const dots = [];
    for (let i = 0; i < count; i++) {
      const mat = materials.glow(color, 1.5);
      mat.transparent = true;
      mat.opacity = 0;
      mat.depthWrite = false;
      const dot = new THREE.Mesh(geo, mat);
      dot.userData.seed = i / count;
      schematic.add(dot);
      dots.push(dot);
    }
    return dots;
  }
  const ionDots = makeDots(10, ION_COLOR, 0.02);
  const ionLanes = [-0.16, -0.08, 0, 0.08, 0.16]; // z-offsets so ions don't overlap in one line
  const electronDots = makeDots(8, ELECTRON_COLOR, 0.017);

  // voltage/SOC gauge + cycle-life bars for the payoff step
  const payoffGroup = new THREE.Group();
  payoffGroup.position.set(0, -SLAB_H / 2 - 0.55, 0);
  schematic.add(payoffGroup);

  function arcMat(color) {
    return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.32, roughness: 0.55 });
  }
  // Gauge angle convention matches Torus's own (0 = local +X, CCW positive).
  // A 270-degree dial opening at the bottom, 0-20% amber / 20-80% green /
  // 80-100% red, needle angle driven by state.soc across the same sweep.
  const GAUGE_R = 0.36;
  const GAUGE_START = -Math.PI * 1.25;
  const GAUGE_SWEEP = Math.PI * 1.5;
  const arcLow = new THREE.Mesh(new THREE.TorusGeometry(GAUGE_R, 0.018, 8, 24, GAUGE_SWEEP * 0.2), arcMat(0xffab5e));
  arcLow.rotation.z = GAUGE_START;
  const arcMid = new THREE.Mesh(new THREE.TorusGeometry(GAUGE_R, 0.022, 8, 48, GAUGE_SWEEP * 0.6), arcMat(0x62d98f));
  arcMid.rotation.z = GAUGE_START + GAUGE_SWEEP * 0.2;
  const arcHigh = new THREE.Mesh(new THREE.TorusGeometry(GAUGE_R, 0.018, 8, 24, GAUGE_SWEEP * 0.2), arcMat(STRESS_COLOR));
  arcHigh.rotation.z = GAUGE_START + GAUGE_SWEEP * 0.8;
  [arcLow, arcMid, arcHigh].forEach((a) => payoffGroup.add(a));
  // chrome's default roughness (0.09) blows out on a prop this exposed to
  // the key light — dulled here the same way canMat was above
  const needleMat = materials.chrome(0xeceef2);
  needleMat.roughness = 0.4;
  const needle = beveledBox(0.02, GAUGE_R * 0.86, 0.02, needleMat, 0.006);
  needle.geometry.translate(0, GAUGE_R * 0.43, 0); // pivot at the base, tip reaches toward the rim
  payoffGroup.add(needle);
  const needleHubMat = materials.chrome(0xd6dae0);
  needleHubMat.roughness = 0.4;
  const needleHub = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), needleHubMat);
  payoffGroup.add(needleHub);
  // needle rests pointing local +Y (angle Math.PI/2 in Torus convention) —
  // offset so rotation.z = 0 would visually align with the gauge's own zero.
  function needleAngle(soc) {
    return GAUGE_START + soc * GAUGE_SWEEP - Math.PI / 2;
  }

  // Bars carry a full-scale base height (BAR_MAX_H); apply() scales/repositions
  // them so they visibly grow from a y=0 baseline rather than from a sliver.
  const BAR_MAX_H = 0.42;
  function barMat(color) {
    // paintedMetal's default clearcoat (1.0) clips on small exposed props —
    // studioPlinth's softened numbers, same fix as there
    const m = materials.paintedMetal(color);
    m.clearcoat = 0.45;
    m.clearcoatRoughness = 0.32;
    m.roughness = 0.55;
    return m;
  }
  const bar500 = beveledBox(0.16, BAR_MAX_H, 0.16, barMat(0xff8a5e), 0.02);
  const bar1500 = beveledBox(0.16, BAR_MAX_H, 0.16, barMat(0x62d98f), 0.02);
  bar500.position.set(0.52, 0, 0);
  bar1500.position.set(0.78, 0, 0);
  payoffGroup.add(bar500, bar1500);
  // Fixed BELOW the bars' baseline (not scaled with bar height, and not
  // above like the first pass) — reviewer found the "above the bar" position
  // landed directly under the CSS2D callout panels floating over the gauge/
  // bars, making the sprite text illegible in both sampled frames.
  const bar500Label = label('0-100%: ~500 cycles', { color: '#ffab8a', size: 0.06 });
  bar500Label.position.set(0.52, -0.09, 0.14);
  const bar1500Label = label('20-80%: ~1500+ cycles', { color: '#8ff0b5', size: 0.06 });
  bar1500Label.position.set(0.78, -0.09, -0.14);
  bar500Label.material.opacity = 0;
  bar1500Label.material.opacity = 0;
  payoffGroup.add(bar500Label, bar1500Label);

  labels.add('charge', wireMesh, 'External circuit — the charging current', [0, 0.1, 0], 60, 130);
  labels.add('charge', separator, 'Separator: lets ions through, blocks electrons', [0.1, -SLAB_H * 0.3, 0.15], -50, 130);
  labels.add('charge', anodeLayers[ANODE_N - 1], 'Ions intercalate into graphite', [0.15, 0.05, 0], 55, 110);

  labels.add('discharge', wireMesh, 'External circuit — powers your phone', [0, 0.1, 0], 60, 120);
  labels.add('discharge', cathodeLayers[CATH_N - 1], 'Ions return to the cathode lattice', [-0.15, 0.05, 0], -55, 120);

  labels.add('ageing', seiFilm, 'SEI film — thickens, eats capacity', [0.05, SLAB_H * 0.3, 0.15], 40, 110);
  labels.add('ageing', cathodeLayers[0], 'Above ~4.1V (~80% SOC): cathode stress', [-0.1, -SLAB_H * 0.35, 0], -60, 140);

  labels.add('dendrite', dendrites[2], 'Lithium plating — fast/cold charging', [0.05, 0.1, 0.05], 40, 130);
  labels.add('dendrite', separator, 'A dendrite that reaches this far shorts the cell', [0.08, SLAB_H * 0.3, 0.1], 55, 150);

  labels.add('payoff', arcMid, 'The 20-80% window: far less stress per cycle', [0, 0.18, 0], 70, 140);
  labels.add('payoff', bar1500, 'Roughly 3x the cycle life', [0.1, 0.05, 0.1], 40, 110);

  // =========================================================================
  // pose / state
  // =========================================================================
  const state = {
    view: 'assembled',
    statusCharge: 0,
    unroll: 0,
    shuttle: 0, // 0..1 ion/electron travel phase this lap
    dir: 1, // +1 = cathode -> anode (charging), -1 = anode -> cathode (discharging)
    soc: 0.5, // state of charge 0..1
    sei: 0,
    dendrite: 0,
    payoffT: 0,
  };

  const cathodeRich = new THREE.Color(CATHODE_COLOR);
  const cathodeLean = new THREE.Color(CATHODE_COLOR).lerp(new THREE.Color(0x8a6a4a), 0.55);
  const anodeLean = new THREE.Color(ANODE_COLOR);
  // Kept subtle on purpose: graphite must still read as dark graphite even
  // at high SOC — a strong lerp toward the bright ion color (as originally
  // written, 0.35) washed the whole anode out to solid mint-green in
  // screenshots, contradicting the copy's "graphite" description.
  const anodeRich = new THREE.Color(ANODE_COLOR).lerp(new THREE.Color(ION_COLOR), 0.12);

  function apply() {
    shell.visible = state.view === 'assembled';
    roll.visible = state.view === 'roll';
    schematic.visible = state.view === 'schematic';

    statusMat.emissiveIntensity = 0.1 + 0.7 * state.statusCharge;

    ribbons.forEach((r) => {
      r.morphTargetInfluences[0] = state.unroll;
    });

    // electrode color communicates lithium content: cathode is "rich" at low
    // SOC (full of lithium) and pales as it charges; anode is the mirror.
    schCathodeMat.color.copy(cathodeRich).lerp(cathodeLean, state.soc);
    schAnodeMat.color.copy(anodeLean).lerp(anodeRich, state.soc);
    const stress = THREE.MathUtils.smoothstep(state.soc, 0.78, 0.98);
    schCathodeMat.emissiveIntensity = stress * 0.9;

    seiMat.opacity = 0.15 + state.sei * 0.55;
    seiFilm.scale.x = 1 + state.sei * 4;

    dendrites.forEach((spike) => {
      spike.scale.y = Math.max(0.001, state.dendrite * 0.85);
    });
    dendriteMat.emissiveIntensity = state.dendrite * 1.4;

    // ion dots: cross the gap from source electrode to destination electrode
    ionDots.forEach((dot, i) => {
      const t = wrapT(dot.userData.seed + state.shuttle);
      const fromX = state.dir > 0 ? cathodeFaceX : anodeFaceX;
      const toX = state.dir > 0 ? anodeFaceX : cathodeFaceX;
      dot.position.set(THREE.MathUtils.lerp(fromX, toX, t), 0, ionLanes[i % ionLanes.length]);
      const fade = Math.min(t * 6, 1) * Math.min((1 - t) * 6, 1);
      dot.material.opacity = fade * 0.95;
    });

    // electron dots: ride the external wire, same direction agreement
    electronDots.forEach((dot) => {
      const t = wrapT(dot.userData.seed + state.shuttle);
      const curveT = state.dir > 0 ? t : 1 - t;
      dot.position.copy(wireCurve.getPointAt(curveT));
      const fade = Math.min(t * 6, 1) * Math.min((1 - t) * 6, 1);
      dot.material.opacity = fade * 0.95;
    });
    const flowing = state.view === 'schematic' ? 1 : 0;
    plaqueMat.emissiveIntensity = flowing * 1.6;
    plaqueLight.intensity = flowing * 0.9;

    // payoff gauge + bars — grow from a fixed y=0 baseline (position offsets
    // by half the SCALED height so the bottom edge never moves). The whole
    // group is otherwise ALWAYS part of the schematic and was leaking into
    // every other schematic step (charge/discharge/ageing/dendrite) as
    // unlabeled orange/green pads — gate its visibility on payoffT itself.
    const reveal = state.payoffT;
    payoffGroup.visible = reveal > 0.02;
    needle.rotation.z = needleAngle(state.soc);
    bar500.scale.y = Math.max(0.05, reveal * (500 / 1500));
    bar1500.scale.y = Math.max(0.05, reveal);
    bar500.position.y = (BAR_MAX_H / 2) * bar500.scale.y;
    bar1500.position.y = (BAR_MAX_H / 2) * bar1500.scale.y;
    bar500Label.material.opacity = reveal;
    bar1500Label.material.opacity = reveal;
  }
  apply();

  return {
    group,
    parts: { shell, roll, schematic, needle, dendrites, seiFilm },
    setLabels(which, v = true) {
      labels.setLabels(v ? which : false);
    },
    setView(v) {
      state.view = v;
      apply();
    },
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
  };
}
