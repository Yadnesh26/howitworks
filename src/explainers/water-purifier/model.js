import * as THREE from 'three';
import { materials, rod, disc, studioPlinth } from '../../framework/parts.js';
import { beveledBox, lathe, tubeAlong, chainPath, coil } from '../../framework/geometry.js';
import { callout } from '../../framework/labels.js';

// An exposed under-sink 4-stage RO system — a real under-sink install has no
// outer skin to hide behind, so every stage is visible from the first frame
// (anatomy-first storyboard, not zoom-in/reveal): a wall-mount bracket
// carries the sediment + carbon cartridges, the booster pump and the
// membrane housing; a dome-top pressure tank stands on the cabinet floor;
// a countertop faucet sits up top with a short inline post-filter feeding it;
// saddle valves tap the cold supply and the drain line.
//
// PROPORTIONS (researched): sediment/carbon housings ~2.5in dia x 10-12in
// (H:D ~ 4:1); 1812/2012 membrane housing ~2.8in x 12.5in (H:D ~4.5:1); a
// 3.2-gal pressure tank ~9-10in dia x 15-16in incl. dome (H:D ~1.6:1). Every
// constant below derives from one radius/height pair per part so those
// ratios hold at model scale.
//
// MECHANISM: sediment (5 micron) -> carbon (chlorine/VOC adsorption) ->
// booster pump lifts feed to ~60-80 psi, past the osmotic pressure of the
// dissolved salts -> spiral-wound membrane (wound around a perforated
// permeate tube, ~0.0001 micron pores) rejects 95-99% of TDS: permeate to
// the storage tank, concentrate to the drain saddle valve (legacy waste
// ratio ~4:1, modern ~1-2:1) -> auto shut-off valve stops the pump at
// tank-full -> inline post-filter polishes before the countertop faucet.
//
// STATE SCALARS (one pose fn):
//   flow      - main chain phase (feed -> prefilters -> pump -> membrane
//               concentrate -> drain), whole cycles per lap
//   permeate  - permeate branch phase (membrane -> tank -> post-filter ->
//               faucet), whole cycles per lap
//   pumpSpin  - booster pump fan angle (rad), whole turns per lap
//   gauge     - 0..1, pressure indicator glow
//   tankLevel - 0..1, storage tank fill height (raised-cosine breathe in the
//               step timeline so it starts/ends each lap at the same value)

const TAU = Math.PI * 2;
const clamp01 = (t) => Math.min(1, Math.max(0, t));

// --- one-scale layout --------------------------------------------------------
const PLINTH_Y = 0.26;

// wall-mount bracket (the rail the cartridges/pump clamp to)
const BRACKET_X = -0.35;
const BRACKET_Z = -0.32;
const BRACKET_Y0 = 0.5;
const BRACKET_Y1 = 1.85;
const BRACKET_W = 1.05;

// sediment + carbon cartridges (hang off the bracket, clear housings)
const CART_R = 0.135;
const CART_H = 0.92;
const CART_Y0 = 0.62;
const SED_X = -0.74;
const CARB_X = -0.36;
const CART_Z = BRACKET_Z + 0.18;

// membrane housing (horizontal, low on the bracket)
const MEMB_R = 0.115;
const MEMB_LEN = 0.95;
const MEMB_X0 = -0.86;
const MEMB_Y = 0.42;
const MEMB_Z = BRACKET_Z + 0.2;

// booster pump (between the cartridges and the membrane inlet)
const PUMP_X = -0.02;
const PUMP_Y = 0.82;
const PUMP_Z = CART_Z;

// storage pressure tank (freestanding on the cabinet floor)
const TANK_R = 0.32;
// pulled well clear of the bracket/pump/membrane cluster — at 0.68 the tank's
// own bulk (plus the pipe running to it) intruded into the pump and membrane
// close-ups from several camera angles (raycast-confirmed overlap)
const TANK_X = 1.15;
const TANK_Z = 0.12;
const TANK_Y0 = PLINTH_Y;
const TANK_H = 1.05;

// countertop + faucet + inline post-filter (up top)
const COUNTER_Y = 2.28;
const COUNTER_X = -0.3;
const COUNTER_Z = CART_Z + 0.4;
const POST_R = 0.075;
const POST_LEN = 0.34;
const POST_X = 0.05;
const POST_Y = COUNTER_Y - 0.26;
const POST_Z = COUNTER_Z + 0.32;

// drain + inlet saddle-valve stubs
const DRAIN_X = 1.6;
const INLET_X = -1.15;

export function buildPurifier({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // --- materials --------------------------------------------------------------
  // a big FLAT panel in brushed steel reads as a softbox mirror across most
  // of the frame (reviewer-caught: washes contrast in the pump/prefilter
  // close-ups) — a matte painted mounting board scatters the key light
  // instead of catching it as one broad highlight
  const bracketMat = materials.paintedMetal(0x565c64);
  bracketMat.metalness = 0.35;
  bracketMat.roughness = 0.8;
  bracketMat.clearcoat = 0.1;
  // darker than the plumbing tubes — reads as structural hardware (clamps,
  // standoffs, valve bodies) distinct from the "active" fluid-path steel
  const clampMat = materials.brushedSteel(0x9aa0a6);
  clampMat.roughness = 0.55;
  const capMat = materials.polymer(0xf0f1ec);
  // roughness 0.1 on a curved shell filling most of the frame at macro
  // distance (the pump step) acted as a curved mirror and washed the whole
  // background out — reviewer-caught via pixel comparison. 0.4 keeps the
  // smooth-plastic look without the mirror-grade specular
  const housingGlass = new THREE.MeshPhysicalMaterial({
    color: 0xdce8ec,
    metalness: 0,
    roughness: 0.4,
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const sedimentCore = materials.paintedMetal(0xf5f4ee);
  sedimentCore.roughness = 0.7;
  sedimentCore.clearcoat = 0;
  const carbonCore = materials.rubber(0x1c1a18);
  carbonCore.roughness = 0.95;
  const postCore = materials.rubber(0x1c1a18);
  postCore.roughness = 0.9;
  const pumpBodyMat = materials.paintedMetal(0x2b3e46);
  pumpBodyMat.clearcoat = 0.35;
  pumpBodyMat.clearcoatRoughness = 0.3;
  const pumpFanMat = materials.brushedSteel(0xcdd2d8);
  pumpFanMat.roughness = 0.5;
  const tubeMat = materials.brushedSteel(0xd6dadf);
  tubeMat.roughness = 0.55;
  const permeateTubeMat = materials.aluminum(0xd8dde2);
  permeateTubeMat.roughness = 0.65; // a thin rod at macro distance else reads as a hot specular streak
  // a distinct teal-blue (echoing the explainer's own accent) instead of the
  // near-white every other housing/cap already uses — the membrane spiral
  // was disappearing into the housing behind it
  const membCoilMat = materials.paintedMetal(0x3f8fa0);
  membCoilMat.clearcoat = 0.3; // full clearcoat on a wound wire = a string of clipped highlights
  membCoilMat.clearcoatRoughness = 0.35;
  membCoilMat.roughness = 0.55;
  const gaugeFaceMat = materials.glow(0xff5a3c, 0);
  gaugeFaceMat.color.setHex(0x1a1917);
  const tankSteel = materials.paintedMetal(0x3f6f8c);
  tankSteel.clearcoat = 0.35;
  tankSteel.clearcoatRoughness = 0.3;
  const valveBodyMat = materials.brushedSteel(0xa8aeb4);
  valveBodyMat.roughness = 0.5;
  const valveLightMat = materials.glow(0x2fe07a, 1.4);
  // cooler stone-grey, not the same near-white as the cartridge caps sitting
  // right next to it in the finale shot
  const counterMat = materials.paintedMetal(0xc4c8ca);
  counterMat.clearcoat = 0.25;
  counterMat.clearcoatRoughness = 0.32;
  const faucetMat = materials.chrome(0xd8dde3);
  const stubMat = materials.rubber(0x24262a);

  // --- plinth ------------------------------------------------------------------
  const plinth = studioPlinth({ w: 3.7, d: 1.95 });
  group.add(plinth);

  // backdrop wall, well behind everything — without it, close macro cameras
  // (the pump step especially) sight past the bracket's edges into the open
  // studio HDRI, which DOF then blurs into a huge soft white wash that no
  // foreground material fix can touch (reviewer-caught via pixel comparison
  // showing zero change under every foreground material tweak)
  // darker than a mid-grey — now that the tank no longer partially masks it
  // (moved further away to fix a geometry overlap), this panel is fully
  // exposed to several close cameras and a lighter tone clipped under direct
  // light even at high roughness (diffuse brightness scales with albedo,
  // not roughness)
  const backdrop = beveledBox(2.7, 2.5, 0.06, new THREE.MeshPhysicalMaterial({
    color: 0x424547,
    roughness: 0.92,
    metalness: 0,
  }), 0.02);
  backdrop.position.set(-0.05, 1.5, BRACKET_Z - 0.12);
  group.add(backdrop);

  // ============================================================================
  //  WALL-MOUNT BRACKET
  // ============================================================================
  const bracket = beveledBox(BRACKET_W, BRACKET_Y1 - BRACKET_Y0, 0.045, bracketMat, 0.015);
  bracket.position.set(BRACKET_X, (BRACKET_Y0 + BRACKET_Y1) / 2, BRACKET_Z);
  group.add(bracket);
  for (const by of [BRACKET_Y0 + 0.1, BRACKET_Y1 - 0.1]) {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.05, 12), clampMat);
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(BRACKET_X - BRACKET_W / 2 + 0.08, by, BRACKET_Z - 0.03);
    group.add(bolt);
    const bolt2 = bolt.clone();
    bolt2.position.x = BRACKET_X + BRACKET_W / 2 - 0.08;
    group.add(bolt2);
  }

  function hoseClamp(x, y, z, r) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.012, 0.012, 8, 28), clampMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, y, z);
    group.add(ring);
  }

  // ============================================================================
  //  SEDIMENT + CARBON CARTRIDGES (clear sump housings, ribbed white caps)
  // ============================================================================
  // color-coded ID band, just below the cap — real cartridges use exactly
  // this convention (blue = sediment, black = carbon, etc.) and it solves
  // the "every housing looks the same pale grey" problem at a glance
  function bandMat(color) {
    return new THREE.MeshPhysicalMaterial({ color, metalness: 0.05, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.3 });
  }

  function makeCartridge(x, z, coreMat, coreRatio = 0.6, bandColor = 0x2f7fc4) {
    const g = new THREE.Group();
    g.position.set(x, CART_Y0, z);
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(CART_R, CART_R * 0.92, CART_H * 0.82, 28), housingGlass);
    housing.position.y = CART_H * 0.41;
    g.add(housing);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(CART_R * 1.01, CART_R * 1.01, CART_H * 0.09, 28), bandMat(bandColor));
    band.position.y = CART_H * 0.72;
    g.add(band);
    const cap = lathe(
      [
        [CART_R * 0.9, CART_H * 0.8],
        [CART_R * 1.08, CART_H * 0.83],
        [CART_R * 1.08, CART_H * 0.96],
        [CART_R * 0.7, CART_H],
        [0.015, CART_H],
      ],
      capMat,
      28,
    );
    g.add(cap);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const rib = beveledBox(0.018, CART_H * 0.13, 0.018, capMat, 0.004);
      rib.position.set(Math.cos(a) * CART_R * 1.06, CART_H * 0.89, Math.sin(a) * CART_R * 1.06);
      rib.rotation.y = -a;
      g.add(rib);
    }
    const bottomCap = new THREE.Mesh(new THREE.CylinderGeometry(CART_R * 0.9, CART_R * 0.75, 0.04, 28), capMat);
    bottomCap.position.y = -0.015;
    g.add(bottomCap);
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(CART_R * coreRatio, CART_R * coreRatio, CART_H * 0.62, 24),
      coreMat,
    );
    core.position.y = CART_H * 0.4;
    g.add(core);
    group.add(g);
    hoseClamp(x, CART_Y0 + CART_H * 0.85, BRACKET_Z + 0.02, 0.05);
    return { group: g, top: [x, CART_Y0 + CART_H + 0.01, z], bottom: [x, CART_Y0 - 0.02, z] };
  }

  const sediment = makeCartridge(SED_X, CART_Z, sedimentCore, 0.6, 0x2f7fc4);
  const carbon = makeCartridge(CARB_X, CART_Z, carbonCore, 0.56, 0x1c1e22);

  // ============================================================================
  //  BOOSTER PUMP (body + spinning cooling fan on the end)
  // ============================================================================
  const pumpGroup = new THREE.Group();
  pumpGroup.position.set(PUMP_X, PUMP_Y, PUMP_Z);
  const pumpBody = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.24, 24), pumpBodyMat);
  pumpBody.rotation.z = Math.PI / 2;
  pumpGroup.add(pumpBody);
  const pumpHead = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.09, 20), tubeMat);
  pumpHead.rotation.z = Math.PI / 2;
  pumpHead.position.x = -0.16;
  pumpGroup.add(pumpHead);
  const fanHub = new THREE.Group();
  fanHub.position.x = 0.14;
  const fanCore = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.03, 14), pumpFanMat);
  fanCore.rotation.z = Math.PI / 2;
  fanHub.add(fanCore);
  for (let i = 0; i < 5; i++) {
    const blade = beveledBox(0.018, 0.08, 0.045, pumpFanMat, 0.004);
    const holder = new THREE.Group();
    holder.rotation.x = (i / 5) * TAU;
    blade.position.y = 0.055;
    holder.add(blade);
    fanHub.add(holder);
  }
  pumpGroup.add(fanHub);
  group.add(pumpGroup);
  // bracket standoff behind the pump
  const pumpStandoff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 12), clampMat);
  pumpStandoff.rotation.x = Math.PI / 2;
  pumpStandoff.position.set(PUMP_X, PUMP_Y, BRACKET_Z + 0.05);
  group.add(pumpStandoff);

  // pressure gauge — a bold glowing indicator disc, not a thin analog needle
  // (a hairline needle read as an indistinct grey blob at macro DOF distance
  // and got dropped for exactly this reason on the previous pass)
  const gaugeGroup = new THREE.Group();
  gaugeGroup.position.set(PUMP_X + 0.16, PUMP_Y + 0.13, PUMP_Z + 0.05);
  const gaugeFace = disc(0.062, 0.014, gaugeFaceMat, 24);
  gaugeFace.rotation.x = Math.PI / 2;
  gaugeGroup.add(gaugeFace);
  const gaugeRim = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.011, 8, 26), clampMat);
  gaugeRim.rotation.x = Math.PI / 2;
  gaugeGroup.add(gaugeRim);
  group.add(gaugeGroup);

  // ============================================================================
  //  MEMBRANE HOUSING (transparent shell + spiral coil + central permeate tube)
  // ============================================================================
  const membGroup = new THREE.Group();
  membGroup.position.set(MEMB_X0 + MEMB_LEN / 2, MEMB_Y, MEMB_Z);
  const membShell = new THREE.Mesh(
    new THREE.CylinderGeometry(MEMB_R, MEMB_R, MEMB_LEN, 32, 1, false).rotateZ(Math.PI / 2),
    housingGlass,
  );
  membGroup.add(membShell);
  for (const ex of [-MEMB_LEN / 2, MEMB_LEN / 2]) {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(MEMB_R * 1.08, MEMB_R * 1.08, 0.04, 32).rotateZ(Math.PI / 2),
      capMat,
    );
    cap.position.x = ex;
    membGroup.add(cap);
  }
  const permeateTube = rod(0.017, MEMB_LEN * 0.94, permeateTubeMat, 16);
  permeateTube.rotation.z = -Math.PI / 2;
  permeateTube.position.x = -MEMB_LEN * 0.47;
  membGroup.add(permeateTube);
  const membCoil = coil(
    { turns: 10, radius: MEMB_R * 0.72, length: MEMB_LEN * 0.9, wireRadius: 0.011, segmentsPerTurn: 20 },
    membCoilMat,
  );
  membCoil.mesh.rotation.z = Math.PI / 2;
  membGroup.add(membCoil.mesh);
  group.add(membGroup);
  hoseClamp(MEMB_X0 + MEMB_LEN * 0.2, MEMB_Y, BRACKET_Z + 0.04, MEMB_R);
  hoseClamp(MEMB_X0 + MEMB_LEN * 0.8, MEMB_Y, BRACKET_Z + 0.04, MEMB_R);
  const membInX = MEMB_X0;
  const membOutX = MEMB_X0 + MEMB_LEN;
  const membMidWorld = [MEMB_X0 + MEMB_LEN * 0.55, MEMB_Y, MEMB_Z];

  // ============================================================================
  //  STORAGE TANK (dome-top pressure tank, freestanding on the cabinet floor)
  // ============================================================================
  const tankGroup = new THREE.Group();
  tankGroup.position.set(TANK_X, 0, TANK_Z);
  const tankBody = lathe(
    [
      [0.01, TANK_Y0],
      [TANK_R * 0.7, TANK_Y0 + 0.02],
      [TANK_R, TANK_Y0 + 0.14],
      [TANK_R, TANK_Y0 + TANK_H * 0.72],
      [TANK_R * 0.82, TANK_Y0 + TANK_H * 0.92],
      [TANK_R * 0.3, TANK_Y0 + TANK_H],
      [0.02, TANK_Y0 + TANK_H * 1.04],
    ],
    housingGlass,
    40,
  );
  tankGroup.add(tankBody);
  const tankBand = new THREE.Mesh(new THREE.TorusGeometry(TANK_R + 0.006, 0.02, 10, 40), tankSteel);
  tankBand.rotation.x = Math.PI / 2;
  tankBand.position.y = TANK_Y0 + TANK_H * 0.35;
  tankGroup.add(tankBand);
  const tankValveStem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.08, 16), valveBodyMat);
  tankValveStem.position.y = TANK_Y0 + TANK_H * 1.06;
  tankGroup.add(tankValveStem);
  // deeper, less neon than the payoff glass at the faucet — storage water
  // reads as "held", the dispensed glass reads as "fresh"
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b6e94,
    emissive: 0x073e52,
    emissiveIntensity: 0.28,
    metalness: 0,
    roughness: 0.2,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
  });
  const waterFill = new THREE.Mesh(new THREE.CylinderGeometry(TANK_R * 0.88, TANK_R * 0.9, 1, 28), waterMat);
  waterFill.position.y = TANK_Y0 + 0.1;
  waterFill.scale.y = 0.0001;
  tankGroup.add(waterFill);
  group.add(tankGroup);

  // auto shut-off valve on the tank's outlet line
  const valveGroup = new THREE.Group();
  valveGroup.position.set(TANK_X, TANK_Y0 + 0.1, TANK_Z);
  const valveBody = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 16), valveBodyMat);
  valveBody.rotation.z = Math.PI / 2;
  valveGroup.add(valveBody);
  const valveLight = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), valveLightMat.clone());
  valveLight.position.set(0, 0.05, 0.03);
  valveGroup.add(valveLight);
  group.add(valveGroup);

  // ============================================================================
  //  DRAIN + INLET SADDLE-VALVE STUBS (floor-standing supply/waste lines)
  // ============================================================================
  const drainStub = rod(0.045, 0.32, tubeMat, 20);
  drainStub.position.set(DRAIN_X, PLINTH_Y, 0.1);
  group.add(drainStub);
  const drainSaddle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.09, 20), valveBodyMat);
  drainSaddle.position.set(DRAIN_X, PLINTH_Y + 0.24, 0.1);
  group.add(drainSaddle);

  const inletStub = rod(0.035, 0.28, tubeMat, 20);
  inletStub.position.set(INLET_X, PLINTH_Y, -0.05);
  group.add(inletStub);
  const inletSaddle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 20), valveBodyMat);
  inletSaddle.position.set(INLET_X, PLINTH_Y + 0.2, -0.05);
  group.add(inletSaddle);

  // ============================================================================
  //  COUNTERTOP + FAUCET + INLINE POST-FILTER
  // ============================================================================
  const counter = beveledBox(1.25, 0.07, 0.8, counterMat, 0.02);
  counter.position.set(COUNTER_X, COUNTER_Y, COUNTER_Z);
  group.add(counter);
  const counterEdge = beveledBox(1.25, 0.02, 0.8, materials.brushedSteel(0xb9c0c8), 0.008);
  counterEdge.position.set(COUNTER_X, COUNTER_Y - 0.045, COUNTER_Z);
  group.add(counterEdge);

  // support post grounding the counter to the cabinet floor — an unsupported
  // slab floating above the bracket read as a toy-tell (reviewer-caught)
  const supportPost = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, COUNTER_Y - 0.06 - PLINTH_Y, 16), bracketMat);
  supportPost.position.set(COUNTER_X - 0.45, PLINTH_Y + (COUNTER_Y - 0.06 - PLINTH_Y) / 2, COUNTER_Z - 0.3);
  group.add(supportPost);
  const supportFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 20), bracketMat);
  supportFoot.position.set(COUNTER_X - 0.45, PLINTH_Y + 0.01, COUNTER_Z - 0.3);
  group.add(supportFoot);

  const faucetBase = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.06, 20), faucetMat);
  faucetBase.position.set(COUNTER_X, COUNTER_Y + 0.06, COUNTER_Z + COUNTER_Z * 0 + 0.2);
  group.add(faucetBase);
  const faucetPts = [
    [COUNTER_X, COUNTER_Y + 0.08, COUNTER_Z + 0.2],
    [COUNTER_X, COUNTER_Y + 0.24, COUNTER_Z + 0.2],
    [COUNTER_X + 0.02, COUNTER_Y + 0.32, COUNTER_Z + 0.32],
    [COUNTER_X + 0.02, COUNTER_Y + 0.26, COUNTER_Z + 0.42],
  ];
  const faucet = tubeAlong(faucetPts, 0.024, faucetMat, { tubularSegments: 40, radialSegments: 16 });
  group.add(faucet);
  const faucetTip = faucetPts[faucetPts.length - 1];
  const faucetHandle = rod(0.014, 0.1, faucetMat, 12);
  faucetHandle.rotation.z = Math.PI / 2 - 0.3;
  faucetHandle.position.set(COUNTER_X + 0.06, COUNTER_Y + 0.12, COUNTER_Z + 0.05);
  group.add(faucetHandle);

  // a plain glass tumbler on the counter, catching the stream — a prop, not a hand
  const tumbler = lathe(
    [[0.001, 0], [0.075, 0], [0.082, 0.015], [0.082, 0.16], [0.078, 0.17]],
    housingGlass,
    28,
  );
  tumbler.position.set(faucetTip[0], COUNTER_Y + 0.035, faucetTip[2] + 0.05);
  group.add(tumbler);
  const glassWaterMat = new THREE.MeshPhysicalMaterial({
    color: 0x3ec2ef,
    metalness: 0,
    roughness: 0.3,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  const glassWater = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 24), glassWaterMat);
  glassWater.position.set(faucetTip[0], COUNTER_Y + 0.08, faucetTip[2] + 0.05);
  glassWater.visible = false;
  group.add(glassWater);

  // inline post-filter, tucked just under the counter feeding the faucet
  const postGroup = new THREE.Group();
  postGroup.position.set(POST_X, POST_Y, POST_Z);
  const postHousing = new THREE.Mesh(
    new THREE.CylinderGeometry(POST_R, POST_R, POST_LEN, 24, 1, false).rotateZ(Math.PI / 2),
    housingGlass,
  );
  postGroup.add(postHousing);
  for (const ex of [-POST_LEN / 2, POST_LEN / 2]) {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(POST_R * 1.08, POST_R * 1.08, 0.025, 20).rotateZ(Math.PI / 2),
      capMat,
    );
    cap.position.x = ex;
    postGroup.add(cap);
  }
  const postCoreMesh = new THREE.Mesh(new THREE.CylinderGeometry(POST_R * 0.6, POST_R * 0.6, POST_LEN * 0.85, 18).rotateZ(Math.PI / 2), postCore);
  postGroup.add(postCoreMesh);
  // teal ID band ties the final polishing stage to the explainer's own accent
  const postBand = new THREE.Mesh(
    new THREE.CylinderGeometry(POST_R * 1.03, POST_R * 1.03, POST_LEN * 0.14, 20).rotateZ(Math.PI / 2),
    bandMat(0x2fb8c4),
  );
  postGroup.add(postBand);
  group.add(postGroup);
  const postInX = POST_X - POST_LEN / 2;
  const postOutX = POST_X + POST_LEN / 2;

  // ============================================================================
  //  PLUMBING (opaque steel tubes) between the fixed points
  // ============================================================================
  function pipe(points, r = 0.02) {
    const t = tubeAlong(points, r, tubeMat, { tubularSegments: 32, radialSegments: 12 });
    group.add(t);
    return t;
  }
  pipe([[INLET_X, PLINTH_Y + 0.24, -0.05], [SED_X, CART_Y0 - 0.15, -0.1], sediment.bottom]);
  pipe([sediment.top, [SED_X, CART_Y0 + CART_H + 0.1, CART_Z], [CARB_X, CART_Y0 + CART_H + 0.1, CART_Z], carbon.top]);
  pipe([
    carbon.bottom,
    [CARB_X, PUMP_Y - 0.06, PUMP_Z + 0.08],
    [PUMP_X - 0.18, PUMP_Y - 0.06, PUMP_Z],
    [PUMP_X - 0.16, PUMP_Y, PUMP_Z],
  ]);
  pipe([[PUMP_X + 0.12, PUMP_Y, PUMP_Z], [PUMP_X + 0.02, MEMB_Y + 0.28, MEMB_Z], [membInX, MEMB_Y, MEMB_Z]], 0.022);
  pipe([[membOutX, MEMB_Y, MEMB_Z], [membOutX + 0.1, MEMB_Y - 0.05, MEMB_Z], [DRAIN_X, PLINTH_Y + 0.24, 0.1]]);
  // permeate branch: membrane midpoint -> tank -> post-filter -> faucet
  pipe([membMidWorld, [membMidWorld[0], TANK_Y0 + 0.4, TANK_Z + 0.2], [TANK_X, TANK_Y0 + 0.15, TANK_Z]], 0.016);
  // approaches the inlet END-CAP from above/behind rather than crossing the
  // housing's visible curved face — reviewer-caught: the old diagonal route
  // read as cutting straight across the post-filter in the finale shot
  pipe(
    [
      [TANK_X, TANK_Y0 + 0.05, TANK_Z],
      [TANK_X, POST_Y + 0.22, TANK_Z + 0.1],
      [postInX, POST_Y + 0.1, POST_Z - 0.05],
      [postInX, POST_Y, POST_Z],
    ],
    0.016,
  );
  pipe([[postOutX, POST_Y, POST_Z], [postOutX + 0.05, COUNTER_Y + 0.1, POST_Z + 0.05], [COUNTER_X, COUNTER_Y + 0.08, COUNTER_Z + 0.2]], 0.016);

  // ============================================================================
  //  FLOW: two chained circuits riding the fixed plumbing geometry
  // ============================================================================
  const feedColor = new THREE.Color(0xa88a5a);
  const carbonColor = new THREE.Color(0x9fc4d0);
  const concColor = new THREE.Color(0xb08a5a);
  const permColor = new THREE.Color(0x53d1ff);

  const mainSegments = [
    [[INLET_X, PLINTH_Y + 0.24, -0.05], [SED_X, CART_Y0 - 0.15, -0.1], sediment.bottom],
    [sediment.bottom, [SED_X, CART_Y0 + CART_H * 0.5, CART_Z], sediment.top],
    [sediment.top, [SED_X, CART_Y0 + CART_H + 0.1, CART_Z], [CARB_X, CART_Y0 + CART_H + 0.1, CART_Z], carbon.top],
    [carbon.top, [CARB_X, CART_Y0 + CART_H * 0.5, CART_Z], carbon.bottom],
    [
      carbon.bottom,
      [CARB_X, PUMP_Y - 0.06, PUMP_Z + 0.08],
      [PUMP_X - 0.18, PUMP_Y - 0.06, PUMP_Z],
      [PUMP_X - 0.16, PUMP_Y, PUMP_Z],
    ],
    [[PUMP_X + 0.12, PUMP_Y, PUMP_Z], [PUMP_X + 0.02, MEMB_Y + 0.28, MEMB_Z], [membInX, MEMB_Y, MEMB_Z]],
    [[membInX, MEMB_Y, MEMB_Z], [membOutX, MEMB_Y, MEMB_Z]],
    [[membOutX, MEMB_Y, MEMB_Z], [membOutX + 0.1, MEMB_Y - 0.05, MEMB_Z], [DRAIN_X, PLINTH_Y + 0.24, 0.1]],
  ];
  const mainChain = chainPath(mainSegments);
  const mb = mainChain.bounds;
  function mainColorAt(t, out) {
    t = ((t % 1) + 1) % 1;
    if (t < mb[2]) out.lerpColors(feedColor, carbonColor, t / mb[2]);
    else if (t < mb[5]) out.copy(carbonColor);
    else if (t < mb[6]) out.lerpColors(carbonColor, permColor, (t - mb[5]) / (mb[6] - mb[5]));
    else out.lerpColors(permColor, concColor, (t - mb[6]) / (1 - mb[6]));
    return out;
  }
  const membraneStart = mb[5];
  const membraneEnd = mb[6];

  const permSegments = [
    [membMidWorld, [membMidWorld[0], TANK_Y0 + 0.4, TANK_Z + 0.2], [TANK_X, TANK_Y0 + 0.15, TANK_Z]],
    [
      [TANK_X, TANK_Y0 + 0.15, TANK_Z],
      [TANK_X, TANK_Y0 + 0.05, TANK_Z],
      [TANK_X, POST_Y + 0.22, TANK_Z + 0.1],
      [postInX, POST_Y + 0.1, POST_Z - 0.05],
      [postInX, POST_Y, POST_Z],
    ],
    [[postInX, POST_Y, POST_Z], [POST_X, POST_Y, POST_Z], [postOutX, POST_Y, POST_Z]],
    [[postOutX, POST_Y, POST_Z], [postOutX + 0.05, COUNTER_Y + 0.1, POST_Z + 0.05], [COUNTER_X, COUNTER_Y + 0.08, COUNTER_Z + 0.2]],
  ];
  const permChain = chainPath(permSegments);

  function makeDotStream(count, color, size = 0.02) {
    const geo = new THREE.SphereGeometry(size, 10, 8);
    const g = new THREE.Group();
    const dots = [];
    for (let i = 0; i < count; i++) {
      const mat = materials.glow(color, 1.1);
      mat.transparent = true;
      mat.depthWrite = false;
      const dot = new THREE.Mesh(geo, mat);
      g.add(dot);
      dots.push(dot);
    }
    group.add(g);
    return dots;
  }
  const mainDots = makeDotStream(26, 0xffffff, 0.02);
  const permDots = makeDotStream(10, 0x53d1ff, 0.018);
  const tmpColor = new THREE.Color();

  // ============================================================================
  //  CALLOUTS
  // ============================================================================
  const setsOf = { overview: [], prefilter: [], pump: [], membrane: [], tank: [], post: [] };
  function addCallout(set, parent, text, offset, dir, len) {
    const c = callout(text, { dir, len });
    c.position.set(...offset);
    parent.add(c);
    c.visible = false;
    setsOf[set].push(c);
  }
  addCallout(
    'overview',
    group,
    'Sediment + carbon pre-filters',
    [(SED_X + CARB_X) / 2, CART_Y0 + CART_H * 0.6, CART_Z],
    60,
    70,
  );
  addCallout('overview', group, 'Booster pump', [PUMP_X, PUMP_Y - 0.1, PUMP_Z], -70, 58);
  addCallout('overview', group, 'RO membrane', [MEMB_X0 + MEMB_LEN * 0.65, MEMB_Y, MEMB_Z], -50, 70);
  addCallout('overview', group, 'Storage tank', [TANK_X, TANK_Y0 + TANK_H * 0.55, TANK_Z], 45, 60);
  addCallout('overview', group, 'Drain saddle valve', [DRAIN_X, PLINTH_Y + 0.24, 0.1], 40, 62);
  addCallout('overview', group, 'Countertop faucet', [COUNTER_X, COUNTER_Y + 0.2, COUNTER_Z + 0.3], 60, 62);

  addCallout('prefilter', group, 'Sediment pre-filter — 5 micron', [SED_X, CART_Y0 + CART_H * 0.62, CART_Z], -35, 84);
  addCallout('prefilter', group, 'Carbon pre-filter — chlorine & VOCs', [CARB_X, CART_Y0 + CART_H * 0.62, CART_Z], -20, 84);

  addCallout('pump', group, 'Booster pump', [PUMP_X, PUMP_Y - 0.12, PUMP_Z], -70, 60);
  addCallout('pump', group, 'Pressure gauge — ~70 psi', [PUMP_X + 0.16, PUMP_Y + 0.13, PUMP_Z + 0.05], 55, 68);

  addCallout('membrane', group, 'RO membrane — spiral-wound', [MEMB_X0 + MEMB_LEN * 0.62, MEMB_Y + 0.16, MEMB_Z], 55, 88);
  addCallout('membrane', group, 'Permeate — pure water', [membMidWorld[0], membMidWorld[1] - 0.15, membMidWorld[2]], -60, 64);
  addCallout('membrane', group, 'Concentrate / reject', [membOutX, MEMB_Y, MEMB_Z], -20, 66);

  addCallout('tank', group, 'Storage tank', [TANK_X, TANK_Y0 + TANK_H * 0.6, TANK_Z], 40, 60);
  addCallout('tank', group, 'Auto shut-off valve', [TANK_X, TANK_Y0 + 0.1, TANK_Z], -70, 62);
  addCallout('tank', group, 'Reject → drain saddle valve', [DRAIN_X, PLINTH_Y + 0.24, 0.1], -30, 78);

  addCallout('post', group, 'Inline post-filter', [POST_X, POST_Y + 0.09, POST_Z], -30, 66);
  addCallout('post', group, 'Countertop faucet', [COUNTER_X, COUNTER_Y + 0.22, COUNTER_Z + 0.32], 60, 60);

  // ============================================================================
  //  POSE
  // ============================================================================
  const state = { flow: 0, permeate: 0, pumpSpin: 0, gauge: 0, tankLevel: 0 };

  function apply() {
    fanHub.rotation.x = state.pumpSpin;
    gaugeFaceMat.emissiveIntensity = clamp01(state.gauge) * 0.95;

    waterFill.scale.y = Math.max(0.0001, clamp01(state.tankLevel) * TANK_H * 0.82);
    waterFill.position.y = TANK_Y0 + 0.1 + waterFill.scale.y / 2;

    const shutoff = clamp01((state.tankLevel - 0.82) / 0.13);
    valveLight.material.color.setHex(shutoff > 0.5 ? 0xff4a3c : 0x2fe07a);
    valveLight.material.emissive.setHex(shutoff > 0.5 ? 0xff4a3c : 0x2fe07a);
    const permGate = 1 - shutoff;

    mainDots.forEach((dot, i) => {
      const t = (state.flow + i / mainDots.length) % 1;
      dot.position.copy(mainChain.getPointAt(t));
      mainColorAt(t, tmpColor);
      dot.material.color.copy(tmpColor);
      dot.material.emissive.copy(tmpColor);
      const survives = t < membraneStart + (membraneEnd - membraneStart) * 0.55 || i % 2 === 0;
      dot.material.opacity = survives ? 0.95 : 0.25;
    });
    permDots.forEach((dot, i) => {
      const t = (state.permeate + i / permDots.length) % 1;
      dot.position.copy(permChain.getPointAt(t));
      dot.material.opacity = permGate * 0.9;
    });
  }
  apply();

  function setLabels(mode) {
    for (const [k, arr] of Object.entries(setsOf)) {
      for (const c of arr) c.visible = k === mode;
    }
  }

  return {
    group,
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setLabels,
    setGlass(on) {
      glassWater.visible = on;
    },
    parts: { pumpGroup, tankGroup, membGroup, fanHub },
  };
}
