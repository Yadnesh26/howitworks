import * as THREE from 'three';
import { materials, rod, box, disc, arrow } from '../../framework/parts.js';
import { beveledBox, tubeAlong, lathe, finStack, boltCircle } from '../../framework/geometry.js';
import { callout } from '../../framework/labels.js';

// Reverse Osmosis Water Purifier (Under-sink 4-stage system)
// Premium Quality Polish Pass
// 
// Upgrades:
// - Physical transmissive glass for filter bowls
// - Lathe-profiled housings and ribbed caps
// - Finned pump motor with spinning cooling fan
// - Spun sediment cartridge via stacked rings
// - Animated capsule-shaped flow packets

const TAU = Math.PI * 2;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const lerp = (a, b, t) => a + (b - a) * clamp01(t);

// --- Layout & Dimensions ---
const FILTER_R = 0.22;
const FILTER_H = 1.2;
const FILTER_Y = 0.7; 
const SEDIMENT_X = -0.7;
const CARBON_X = -0.1;
const PUMP_X = 0.6;
const RO_Y = 1.6;
const RO_LEN = 1.9;
const RO_R = 0.18;

// --- Materials ---
const bracketMat = materials.paintedMetal(0xe8ecf0);
const whiteHousingMat = materials.paintedMetal(0xf4f6f8);
const filterCapMat = materials.paintedMetal(0xd0d5db);
const tubeMat = materials.paintedMetal(0xffffff);
const pumpBodyMat = materials.paintedMetal(0x1a1c22);
const pumpHeadMat = materials.castMetal ? materials.castMetal() : materials.aluminum(); // fallback
const carbonBlockMat = materials.rubber(0x222222);
carbonBlockMat.roughness = 0.95;

// Real refractive glass (transmission)
const transmissiveGlassMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  transmission: 1, // Full transmission
  roughness: 0.08,
  thickness: 0.04, // Thick plastic
  ior: 1.5,        // Acrylic/polycarbonate IOR
  transparent: false,
  side: THREE.DoubleSide,
});

const ghostGlassMat = materials.glass(0xffffff, 0.25); // for the ghost shell

// Flow materials
const waterMatDirty = materials.glow(0x8a7050, 1.5);
const waterMatClear = materials.glow(0x9bd4e4, 1.2);
const waterMatPure = materials.glow(0x40a0ff, 1.8);
const waterMatWaste = materials.glow(0x605040, 1.5);

// Ensure glows are visible through glass
[waterMatDirty, waterMatClear, waterMatPure, waterMatWaste].forEach(mat => {
  mat.transparent = true; 
  mat.depthWrite = false;
});

// --- Helper: Detail Lathe Housing ---
function makeDetailedFilterHousing(x, y, radius, height, innerMesh) {
  const group = new THREE.Group();
  group.position.set(x, y, 0);

  // Rounded bowl (lathe profile)
  // Starts with a rounded bottom, goes straight up, then a thicker threaded rim
  const bowlProfile = [
    [0.01, -height * 0.5],
    [radius * 0.4, -height * 0.5],
    [radius * 0.7, -height * 0.46],
    [radius * 0.85, -height * 0.4],
    [radius * 0.85, height * 0.35],
    [radius * 0.9, height * 0.35], // threaded rim step
    [radius * 0.9, height * 0.42],
  ];
  const bowl = lathe(bowlProfile, transmissiveGlassMat, 48);
  group.add(bowl);

  // Ribbed cap (lathe profile with boltCircle indentations or just ribs)
  const capProfile = [
    [radius * 0.92, height * 0.41],
    [radius * 1.05, height * 0.41],
    [radius * 1.05, height * 0.55],
    [radius * 0.6, height * 0.55],
    [radius * 0.6, height * 0.58], // top pressure relief button area
    [0.01, height * 0.58],
  ];
  const cap = lathe(capProfile, filterCapMat, 48);
  
  // Add vertical ribs to the cap for grip
  const ribCount = 24;
  for (let i = 0; i < ribCount; i++) {
    const angle = (i * TAU) / ribCount;
    const rib = beveledBox(0.04, height * 0.14, 0.04, filterCapMat, 0.01);
    rib.position.set(Math.cos(angle) * (radius * 1.03), height * 0.48, Math.sin(angle) * (radius * 1.03));
    rib.rotation.y = -angle;
    cap.add(rib);
  }
  group.add(cap);

  // Inner filter cartridge
  if (innerMesh) {
    innerMesh.position.y = -height * 0.04;
    group.add(innerMesh);
  }

  return group;
}

// --- Tubing and Flow Packets Helper ---
// Uses elongated capsules instead of spheres to look like a pressurized stream
function makePlumbing(points, packetMat, packetCount = 10, radius = 0.015) {
  const group = new THREE.Group();
  
  const tube = tubeAlong(points, radius, tubeMat, { tubularSegments: 80 });
  group.add(tube);
  
  const curve = tube.userData.curve;
  const packets = [];
  
  // Capsule geometry for flow
  const packetGeo = new THREE.CylinderGeometry(radius * 1.4, radius * 1.4, 0.1, 8);
  packetGeo.rotateX(Math.PI / 2); // align with tangent
  
  for (let i = 0; i < packetCount; i++) {
    const packet = new THREE.Mesh(packetGeo, packetMat);
    group.add(packet);
    packets.push(packet);
  }

  return {
    group,
    update: (flow) => {
      packets.forEach((packet, i) => {
        const t = (flow + i / packetCount) % 1.0;
        const p = curve.getPointAt(t);
        
        // Fix for getTangentAt occasionally throwing if curve is short/edge case
        // We can just use lookAt on a nearby point
        const t2 = Math.min(1.0, t + 0.005);
        const p2 = curve.getPointAt(t2);
        
        packet.position.copy(p);
        if (p.distanceTo(p2) > 0.001) {
          packet.lookAt(p2);
        }
      });
    }
  };
}

export function buildWaterPurifier({ scene }) {
  const root = new THREE.Group();
  scene.add(root);

  // --- 1. Bracket ---
  const bracket = beveledBox(2.2, 1.8, 0.05, bracketMat, 0.02);
  bracket.position.set(-0.05, 1.0, -0.25);
  root.add(bracket);
  
  // Fasteners on bracket
  const bolts1 = boltCircle({ radius: 0.1, count: 4 }, materials.chrome());
  bolts1.position.set(SEDIMENT_X, 1.4, -0.22);
  root.add(bolts1);
  
  const bolts2 = boltCircle({ radius: 0.1, count: 4 }, materials.chrome());
  bolts2.position.set(CARBON_X, 1.4, -0.22);
  root.add(bolts2);

  const bolts3 = boltCircle({ radius: 0.12, count: 4 }, materials.chrome());
  bolts3.position.set(PUMP_X, 1.2, -0.22);
  root.add(bolts3);

  // --- 2. Sediment Filter ---
  // Realistic spun filter look: a stack of tightly packed thin rings
  const sedimentInner = finStack({
    count: 40, size: FILTER_R * 0.55, thickness: (FILTER_H * 0.8) / 45, gap: (FILTER_H * 0.8) / 400, shape: 'round'
  }, materials.paintedMetal(0xfafafa));
  // Shift finStack so its center is 0 (finStack builds from y=0 upwards)
  sedimentInner.position.y -= (FILTER_H * 0.8) / 2;
  
  const sedimentHousing = makeDetailedFilterHousing(SEDIMENT_X, FILTER_Y, FILTER_R, FILTER_H, sedimentInner);
  root.add(sedimentHousing);

  // --- 3. Carbon Filter ---
  // Solid black cylinder, but with a ribbed cap/mesh look (simple texture approximation)
  const carbonInner = rod(FILTER_R * 0.55, FILTER_H * 0.8, carbonBlockMat, 32);
  const carbonHousing = makeDetailedFilterHousing(CARBON_X, FILTER_Y, FILTER_R, FILTER_H, carbonInner);
  root.add(carbonHousing);

  // --- 4. Booster Pump ---
  const pumpGroup = new THREE.Group();
  pumpGroup.position.set(PUMP_X, FILTER_Y - 0.1, 0);
  
  // Motor body (finned for cooling)
  const motor = finStack({
    count: 14, size: 0.18, thickness: 0.02, gap: 0.02, shape: 'round'
  }, pumpBodyMat);
  motor.rotation.x = Math.PI / 2; // Axis along Z
  motor.position.set(0, 0, -0.25);
  pumpGroup.add(motor);
  
  // Spinning fan at the back of the motor
  const fanGroup = new THREE.Group();
  fanGroup.position.set(0, 0, -0.3);
  for(let i=0; i<3; i++) {
    const blade = beveledBox(0.3, 0.04, 0.02, materials.paintedMetal(0x111111), 0.01);
    blade.rotation.z = i * Math.PI / 3;
    fanGroup.add(blade);
  }
  const fanCover = lathe([[0.19, -0.05], [0.19, 0.05], [0.05, 0.05]], pumpBodyMat, 24);
  fanCover.rotation.x = Math.PI / 2;
  fanCover.position.z = -0.3;
  pumpGroup.add(fanCover);
  pumpGroup.add(fanGroup);
  
  // Pump head (aluminum)
  const phead = lathe([
    [0.01, 0], [0.18, 0], [0.2, 0.05], [0.2, 0.15], [0.16, 0.25], [0.01, 0.25]
  ], pumpHeadMat, 32);
  phead.rotation.x = Math.PI / 2;
  phead.position.set(0, 0, 0.1);
  pumpGroup.add(phead);
  
  // Pressure Gauge on top of pump head
  const gauge = disc(0.08, 0.04, materials.paintedMetal(0xeeeeee), 32);
  gauge.rotation.x = Math.PI / 2;
  gauge.rotation.y = Math.PI / 2;
  gauge.position.set(0, 0.15, 0.25);
  const gaugeFace = disc(0.065, 0.042, materials.paintedMetal(0xffffff), 32);
  gaugeFace.rotation.x = Math.PI / 2;
  gaugeFace.rotation.y = Math.PI / 2;
  gaugeFace.position.set(0, 0.15, 0.25);
  const gaugeNeedle = beveledBox(0.04, 0.005, 0.005, materials.paintedMetal(0xcc2222), 0.002);
  gaugeNeedle.rotation.y = Math.PI / 4;
  gaugeNeedle.position.set(0.02, 0.15, 0.25);
  pumpGroup.add(gauge);
  pumpGroup.add(gaugeFace);
  pumpGroup.add(gaugeNeedle);
  
  root.add(pumpGroup);

  // --- 5. RO Membrane Housing ---
  const roGroup = new THREE.Group();
  roGroup.position.set(-0.1, RO_Y, 0);

  const roHousingSolid = rod(RO_R, RO_LEN, whiteHousingMat, 32);
  roHousingSolid.rotation.z = Math.PI / 2;
  roGroup.add(roHousingSolid);

  const roHousingGhost = rod(RO_R + 0.002, RO_LEN, ghostGlassMat, 32);
  roHousingGhost.rotation.z = Math.PI / 2;
  roHousingGhost.visible = false;
  roGroup.add(roHousingGhost);

  // Caps with ribs
  const makeROCap = (xPos) => {
    const c = lathe([[0.01, 0], [RO_R * 1.1, 0], [RO_R * 1.1, 0.15], [RO_R * 0.2, 0.15]], filterCapMat, 32);
    c.rotation.z = Math.PI / 2;
    if (xPos < 0) {
      c.position.set(xPos + 0.15, 0, 0); // left cap
      c.rotation.z = -Math.PI / 2;
    } else {
      c.position.set(xPos - 0.15, 0, 0); // right cap
    }
    return c;
  };
  roGroup.add(makeROCap(-RO_LEN / 2));
  roGroup.add(makeROCap(RO_LEN / 2));

  // Inner spiral wound membrane (multiple concentric rings to look layered)
  const membraneInner = new THREE.Group();
  membraneInner.rotation.z = Math.PI / 2;
  for(let i=0; i<6; i++) {
    const r = (RO_R * 0.75) * (1 - i*0.12);
    const layerMat = materials.paintedMetal(0xe4e8cc);
    // make inner layers slightly darker
    layerMat.color.lerp(new THREE.Color(0xb4b89c), i/5);
    const layer = rod(r, RO_LEN * 0.85, layerMat, 32);
    membraneInner.add(layer);
  }
  roGroup.add(membraneInner);
  
  const roCenterTube = rod(RO_R * 0.15, RO_LEN * 0.96, tubeMat, 16);
  roCenterTube.rotation.z = Math.PI / 2;
  roGroup.add(roCenterTube);

  root.add(roGroup);

  // --- 6. Plumbing & Flow Paths ---
  const flowSystems = [];

  const p1 = makePlumbing(
    [
      [SEDIMENT_X - 0.3, FILTER_Y + 0.65, 0.2],
      [SEDIMENT_X - 0.15, FILTER_Y + 0.65, 0.2],
      [SEDIMENT_X - 0.15, FILTER_Y - 0.7, 0.2],
      [SEDIMENT_X, FILTER_Y - 0.7, 0.2],
      [SEDIMENT_X, FILTER_Y - 0.5, 0.0],
    ],
    waterMatDirty, 15
  );
  flowSystems.push(p1);

  const p2 = makePlumbing(
    [
      [SEDIMENT_X, FILTER_Y + 0.58, 0],
      [SEDIMENT_X, FILTER_Y + 0.7, 0.2],
      [CARBON_X, FILTER_Y + 0.7, 0.2],
      [CARBON_X, FILTER_Y + 0.58, 0],
    ],
    waterMatClear, 10
  );
  flowSystems.push(p2);

  const p3 = makePlumbing(
    [
      [CARBON_X, FILTER_Y - 0.58, 0],
      [CARBON_X, FILTER_Y - 0.7, 0.2],
      [PUMP_X - 0.1, FILTER_Y - 0.7, 0.2],
      [PUMP_X - 0.1, FILTER_Y - 0.1, 0.4],
    ],
    waterMatClear, 15
  );
  flowSystems.push(p3);

  const p4 = makePlumbing(
    [
      [PUMP_X + 0.1, FILTER_Y - 0.1, 0.4],
      [PUMP_X + 0.15, FILTER_Y - 0.1, 0.3],
      [PUMP_X + 0.15, RO_Y, 0.2],
      [0.85, RO_Y, 0],
    ],
    waterMatClear, 18
  );
  flowSystems.push(p4);

  const p5 = makePlumbing(
    [
      [-1.05, RO_Y, 0],
      [-1.3, RO_Y, 0],
      [-1.3, RO_Y - 0.4, 0.2],
      [-1.5, RO_Y - 0.4, 0.2],
    ],
    waterMatPure, 12
  );
  flowSystems.push(p5);

  const p6 = makePlumbing(
    [
      [-1.05, RO_Y - 0.15, 0.1],
      [-1.15, RO_Y - 0.15, 0.1],
      [-1.15, RO_Y + 0.3, -0.1],
      [-1.4, RO_Y + 0.3, -0.1],
    ],
    waterMatWaste, 10
  );
  flowSystems.push(p6);

  flowSystems.forEach(sys => root.add(sys.group));

  // --- Callouts ---
  const allCallouts = [];

  const cSediment = callout('Sediment Filter', { dir: 200, len: 60 });
  cSediment.position.set(SEDIMENT_X - 0.22, FILTER_Y, 0);
  root.add(cSediment);
  allCallouts.push(cSediment);

  const cCarbon = callout('Carbon Filter', { dir: 300, len: 50 });
  cCarbon.position.set(CARBON_X + 0.1, FILTER_Y - 0.3, 0);
  root.add(cCarbon);
  allCallouts.push(cCarbon);

  const cPump = callout('Booster Pump', { dir: 20, len: 60 });
  cPump.position.set(PUMP_X, FILTER_Y + 0.1, 0);
  root.add(cPump);
  allCallouts.push(cPump);

  const cRO = callout('RO Membrane', { dir: 60, len: 50 });
  cRO.position.set(0, RO_Y + 0.1, 0);
  root.add(cRO);
  allCallouts.push(cRO);

  const cPure = callout('Pure Water', { dir: 140, len: 50 });
  cPure.position.set(-1.3, RO_Y, 0);
  root.add(cPure);
  allCallouts.push(cPure);

  const cWaste = callout('Waste Water', { dir: 90, len: 40 });
  cWaste.position.set(-1.15, RO_Y + 0.2, 0);
  root.add(cWaste);
  allCallouts.push(cWaste);

  for (const c of allCallouts) c.visible = false;

  // --- State Handles ---
  let _reveal = 0;

  function setReveal(r) {
    _reveal = clamp01(r);
    roHousingSolid.visible = _reveal < 0.5;
    roHousingGhost.visible = _reveal > 0.01;
    roHousingGhost.material.opacity = lerp(0, 0.25, _reveal);
  }

  function setFlow(t) {
    flowSystems.forEach(sys => sys.update(t));
    
    // Spin the pump fan rapidly based on flow
    fanGroup.rotation.z = t * TAU * 15;
    
    // Jitter the pump gauge needle slightly to show pressure
    gaugeNeedle.rotation.y = Math.PI / 4 + Math.sin(t * TAU * 20) * 0.05;
  }

  function setLabels(v) {
    allCallouts.forEach(c => (c.visible = v));
  }

  setReveal(0);
  setFlow(0);
  setLabels(false);

  return {
    setReveal,
    setFlow,
    setLabels,
  };
}
