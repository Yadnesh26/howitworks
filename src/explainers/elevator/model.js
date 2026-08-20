import * as THREE from 'three';
import { materials, box, studioPlinth } from '../../framework/parts.js';
import { beveledBox, tubeAlong, boltCircle, lathe } from '../../framework/geometry.js';
import { clamp01, smooth } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// A three-landing slice of a machine-room-less (MRL) traction elevator, staged
// product-shot style on a plinth: lobby wall in front, hoistway behind it,
// gearless machine on a beam at the top, counterweight down the right-hand side.
//
// PROPORTIONS (from a 1000 kg / 13-person MRL passenger lift; 1 m -> 0.46 u):
//   car      1.60 x 1.44 x 2.26 m -> 0.74 x 0.66 x 0.58 u  (W x D x H)
//   hoistway 2.30 x 1.92 m        -> 1.20 x 0.88 u interior
//     -> hoistway/car = 1.62 wide, 1.33 deep (real 1.44 / 1.33) — the width
//        runs slightly generous so the counterweight and both rail lines stay
//        readable instead of collapsing into one silhouette.
//   clear door opening 1.00 m     -> 0.46 u  (0.62 of car width; real ~0.69)
//   counterweight 0.24 x 0.91 m   -> 0.11 x 0.42 u — thin in width, wide in
//        depth, which is why it fits beside the car at all.
//   traction sheave 0.65 m dia    -> 0.30 u    deflector 0.43 m -> 0.20 u
//   floor-to-floor 1.43 m         -> 0.66 u — the ONE ratio deliberately
//        compressed, because three landings have to fit a single product shot.
//        Everything else holds against the car.
//
// The whole mechanism is driven by ONE scalar, `carT` (0 = car parked at the
// bottom landing, 1 = parked at the top). Counterweight height, both sheave
// angles, the governor sheaves, the two rope runs and the travelling cable's
// sag are all derived from it, so nothing can drift out of sync with anything
// else — which is also the seamless-loop guarantee: a lap that returns carT to
// its starting value returns every part to the same pose.
//
// `reveal` (0-1) fades ONLY the concrete: lobby wall, hoistway walls, ceiling.
// Nothing is hidden outright, so 0.5 is a legitimate half-ghost pose (the
// finale) rather than a broken in-between. The storey slabs stand outside the
// hoistway and never occlude it, so they stay solid throughout.

// --- hoistway shell ---------------------------------------------------------
const SHAFT_HW = 0.6; // interior half-width (x)
const SHAFT_HD = 0.44; // interior half-depth (z)
const WALL_T = 0.055;
const H_TOP = 2.8; // ceiling underside
const FRONT_Z = SHAFT_HD; // lobby wall inner face
const LOBBY_X0 = -0.9;
const LOBBY_X1 = 0.72;

// --- landings ---------------------------------------------------------------
const LEVELS = [0.28, 0.94, 1.6];
const TRAVEL = LEVELS[2] - LEVELS[0]; // 1.32
const DOOR_W = 0.46; // clear opening
const DOOR_H = 0.46;
const PANEL_W = 0.24; // two panels, meeting edges overlapping slightly
const DOOR_SLIDE = 0.235;

// --- car --------------------------------------------------------------------
const CAR_W = 0.74;
const CAR_D = 0.66;
const CAR_H = 0.58;
const CAR_X = -0.13;
const CAR_Z = -0.02;
const CAR_SKIN = 0.028;
const HITCH_H = 0.05;

// --- counterweight ----------------------------------------------------------
const CW_W = 0.11;
const CW_D = 0.42;
const CW_H = 0.62;
const CW_X = 0.42;
const CW_Z = -0.02;
const CW_BOT = 0.12; // its lowest point — reached when the car is at the top
const CW_HITCH_H = 0.04;

// --- machine ----------------------------------------------------------------
const R1 = 0.15; // traction sheave
const SHEAVE_X = CAR_X + R1; // car ropes have to drop dead plumb over the car…
const SHEAVE_Y = 2.5;
const R2 = 0.1; // deflector — R1/R2 = 3/2, which the slip loop in index.js needs
const DEF_X = CW_X - R2; // …and dead plumb over the counterweight
const DEF_Y = 2.4;
const MACHINE_Z = CAR_Z; // rope plane sits over the car's centre of gravity

// --- ropes ------------------------------------------------------------------
const N_ROPES = 5;
const ROPE_PITCH = 0.03;
const ROPE_R = 0.008;

// --- guide rails ------------------------------------------------------------
// Car rails stop just above the car's highest guide shoe rather than running to
// the ceiling — which is both what real rails do and the only reason the
// deflector sheave can share their x without fouling them.
const CAR_RAIL_X = [-0.555, 0.285];
const RAIL_Z = CAR_Z;
const CAR_RAIL_TOP = 2.26;
const CW_RAIL_Z = [-0.26, 0.24];
const CW_RAIL_TOP = 2.14;

// --- governor ---------------------------------------------------------------
// Rides alongside the car's right-hand rail, offset in depth so it clears the
// rail's flange — and lands right next to the safety gear it has to trip.
const GOV_X = CAR_RAIL_X[1];
const GOV_Z = 0.145;
const GOV_R = 0.055;
// Slung well below the machine on purpose: at 2.30 the governor wheel landed
// almost on top of the deflector sheave in screen space, and its callout read
// as though it were pointing at the traction machine.
const GOV_TOP_Y = 2.12;
const GOV_PIT_Y = 0.18;

const PLINTH_H = 0.26;

// Upper external tangent between two circles: the angle (measured from each
// centre) at which one taut rope can leave the first and land on the second
// while resting on top of both. Derived rather than eyeballed, so nudging a
// sheave never leaves the rope hanging in mid-air.
function upperTangentAngle(x1, y1, r1, x2, y2, r2) {
  const ux = x2 - x1;
  const uy = y2 - y1;
  const d = Math.hypot(ux, uy);
  return Math.atan2(uy, ux) + Math.acos((r1 - r2) / d);
}
const TANGENT_A = upperTangentAngle(SHEAVE_X, SHEAVE_Y, R1, DEF_X, DEF_Y, R2);

export function buildElevator({ scene }) {
  const group = new THREE.Group();
  group.position.y = PLINTH_H;
  scene.add(group);

  const plinth = studioPlinth({ w: 2.15, h: PLINTH_H, d: 1.95 });
  plinth.position.x = -0.09;
  plinth.position.z = 0.2;
  scene.add(plinth);

  // --- materials ------------------------------------------------------------
  const concrete = materials.polymer(0x8d9298);
  const concreteDark = materials.polymer(0x767c83);
  const wallMats = [concrete, concreteDark];
  for (const m of wallMats) m.transparent = true; // opacity-only toggle, no recompile

  // Roughness runs high across every large steel face here. These are big flat
  // panels under a studio key light, and the presets' default 0.3 turns them
  // into softbox mirrors — a wider, softer highlight is both correct for
  // brushed stainless and the only thing that keeps the clipping gate green.
  const steel = materials.brushedSteel(0xbcc2ca);
  steel.roughness = 0.62;
  const doorMat = materials.brushedSteel(0xc0c6ce);
  doorMat.roughness = 0.58;
  const darkSteel = materials.paintedMetal(0x3b4149);
  const railMat = materials.brushedSteel(0xa8b0ba);
  railMat.roughness = 0.58;
  const machineMat = materials.paintedMetal(0x2f3b41);
  const ropeMat = materials.brushedSteel(0x8f959d);
  ropeMat.roughness = 0.64;
  const cwMat = materials.paintedMetal(0x22262b);
  const slabMat = materials.polymer(0x5c6268);
  const safetyOrange = materials.paintedMetal(0xd8843c);
  const cabInner = materials.polymer(0x3c424a);

  // ==========================================================================
  // BUILDING SHELL — the only thing `reveal` touches
  // ==========================================================================
  // Lobby wall, with a REAL hole per landing: a solid panel the doors slid
  // across would read as a decal, and the open panels have to go somewhere.
  const lobbyShape = new THREE.Shape();
  lobbyShape.moveTo(LOBBY_X0, 0);
  lobbyShape.lineTo(LOBBY_X1, 0);
  lobbyShape.lineTo(LOBBY_X1, H_TOP);
  lobbyShape.lineTo(LOBBY_X0, H_TOP);
  lobbyShape.closePath();
  for (const ly of LEVELS) {
    const hole = new THREE.Path();
    hole.moveTo(CAR_X - DOOR_W / 2, ly + 0.015);
    hole.lineTo(CAR_X + DOOR_W / 2, ly + 0.015);
    hole.lineTo(CAR_X + DOOR_W / 2, ly + 0.015 + DOOR_H);
    hole.lineTo(CAR_X - DOOR_W / 2, ly + 0.015 + DOOR_H);
    hole.closePath();
    lobbyShape.holes.push(hole);
  }
  const lobbyWall = new THREE.Mesh(
    new THREE.ExtrudeGeometry(lobbyShape, { depth: WALL_T, bevelEnabled: false }),
    concrete,
  );
  lobbyWall.position.z = FRONT_Z;
  lobbyWall.castShadow = true;
  lobbyWall.receiveShadow = true;
  group.add(lobbyWall);

  const backWall = box(SHAFT_HW * 2 + WALL_T * 2, H_TOP, WALL_T, concreteDark);
  backWall.position.set(0, H_TOP / 2, -SHAFT_HD - WALL_T / 2);
  group.add(backWall);
  for (const sx of [-1, 1]) {
    const side = box(WALL_T, H_TOP, SHAFT_HD * 2 + WALL_T, concreteDark);
    side.position.set(sx * (SHAFT_HW + WALL_T / 2), H_TOP / 2, -WALL_T / 2);
    group.add(side);
  }
  const ceiling = box(SHAFT_HW * 2, WALL_T, SHAFT_HD * 2, concrete);
  ceiling.position.set(0, H_TOP + WALL_T / 2, 0);
  group.add(ceiling);
  const pitFloor = box(SHAFT_HW * 2, 0.05, SHAFT_HD * 2, concreteDark);
  pitFloor.position.set(0, -0.025, 0);
  pitFloor.receiveShadow = true;
  group.add(pitFloor);

  // Storey slabs stand OUTSIDE the hoistway, so they never occlude it and can
  // stay solid at every reveal value. Kept SHALLOW on purpose: at 0.4 deep they
  // read as grey diving boards and, from any raised camera, their top faces
  // covered the car doorway behind them.
  for (const ly of LEVELS) {
    const slab = beveledBox(LOBBY_X1 - LOBBY_X0, 0.035, 0.17, slabMat, 0.008);
    slab.position.set((LOBBY_X0 + LOBBY_X1) / 2, ly - 0.018, FRONT_Z + WALL_T + 0.085);
    slab.receiveShadow = true;
    group.add(slab);
  }

  // ==========================================================================
  // LANDINGS — sills, frames, doors, indicators
  // ==========================================================================
  const landings = [];
  LEVELS.forEach((ly, i) => {
    const g = new THREE.Group();
    g.position.y = ly + 0.015;
    group.add(g);

    const sill = box(DOOR_W + 0.06, 0.02, 0.09, steel);
    sill.position.set(CAR_X, -0.008, FRONT_Z + 0.02);
    g.add(sill);
    for (const sx of [-1, 1]) {
      const jamb = box(0.035, DOOR_H + 0.04, 0.05, steel);
      jamb.position.set(CAR_X + sx * (DOOR_W / 2 + 0.017), DOOR_H / 2, FRONT_Z + 0.028);
      g.add(jamb);
    }
    const header = box(DOOR_W + 0.07, 0.035, 0.05, steel);
    header.position.set(CAR_X, DOOR_H + 0.018, FRONT_Z + 0.028);
    g.add(header);

    // Panels live BEHIND the wall, so opening genuinely buries them in the pocket.
    const panels = [];
    for (const sx of [-1, 1]) {
      const p = beveledBox(PANEL_W, DOOR_H, 0.018, steel, 0.004);
      p.position.set(CAR_X + sx * (PANEL_W / 2 - 0.005), DOOR_H / 2, FRONT_Z - 0.012);
      g.add(p);
      panels.push(p);
      // roller pair on the panel's shaft side — what the car's clutch grabs
      for (const ry of [DOOR_H * 0.5 - 0.05, DOOR_H * 0.5 - 0.13]) {
        const roller = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, 0.022, 0.014, 14).rotateZ(Math.PI / 2),
          materials.rubber(0x24272c),
        );
        roller.position.set(sx * (PANEL_W / 2 - 0.045), ry, -0.024);
        p.add(roller);
      }
    }
    // interlock latch hook above the meeting edge — brass, so it reads apart
    // from the grey ironmongery around it
    const latch = box(0.07, 0.032, 0.02, materials.brushedSteel(0xd8c46a));
    latch.position.set(CAR_X - 0.03, DOOR_H - 0.035, FRONT_Z - 0.034);
    g.add(latch);

    // floor indicator + call button on the lobby face
    const indicator = box(0.15, 0.032, 0.012, materials.glow(0xffb454, 0.9));
    indicator.position.set(CAR_X, DOOR_H + 0.07, FRONT_Z + WALL_T + 0.006);
    g.add(indicator);
    const btnPlate = beveledBox(0.05, 0.1, 0.014, darkSteel, 0.006);
    btnPlate.position.set(CAR_X + DOOR_W / 2 + 0.075, 0.3, FRONT_Z + WALL_T + 0.007);
    g.add(btnPlate);
    const btn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.013, 0.01, 14).rotateX(Math.PI / 2),
      materials.glow(0x6fe0a8, 0.7),
    );
    btn.position.set(CAR_X + DOOR_W / 2 + 0.075, 0.322, FRONT_Z + WALL_T + 0.016);
    g.add(btn);

    landings.push({ g, panels, indicator, btn, y: ly });
  });

  // ==========================================================================
  // GUIDE RAILS — T-section. `web` is the XZ direction the web sticks out in;
  // the flange lies flat across it, against whatever the rail bolts back to.
  // ==========================================================================
  function guideRail({ x, z, top, web }) {
    const g = new THREE.Group();
    const alongZ = Math.abs(web[1]) > 0.5;
    const flange = alongZ ? box(0.075, top, 0.024, railMat) : box(0.024, top, 0.075, railMat);
    flange.position.y = top / 2;
    g.add(flange);
    const webMesh = alongZ ? box(0.03, top, 0.075, railMat) : box(0.075, top, 0.03, railMat);
    webMesh.position.set(web[0] * 0.048, top / 2, web[1] * 0.048);
    g.add(webMesh);
    for (const by of [0.2, 0.86, 1.52, 2.1]) {
      if (by > top - 0.08) continue;
      const clip = box(alongZ ? 0.12 : 0.03, 0.05, alongZ ? 0.03 : 0.12, darkSteel);
      clip.position.set(-web[0] * 0.026, by, -web[1] * 0.026);
      g.add(clip);
    }
    g.position.set(x, 0, z);
    group.add(g);
    return g;
  }
  guideRail({ x: CAR_RAIL_X[0], z: RAIL_Z, top: CAR_RAIL_TOP, web: [1, 0] });
  guideRail({ x: CAR_RAIL_X[1], z: RAIL_Z, top: CAR_RAIL_TOP, web: [-1, 0] });
  guideRail({ x: CW_X, z: CW_RAIL_Z[0], top: CW_RAIL_TOP, web: [0, 1] });
  guideRail({ x: CW_X, z: CW_RAIL_Z[1], top: CW_RAIL_TOP, web: [0, -1] });

  // ==========================================================================
  // MACHINE — beam, gearless motor, traction sheave, brake, deflector
  // ==========================================================================
  const machineBeam = beveledBox(SHAFT_HW * 2 - 0.04, 0.09, 0.11, darkSteel, 0.012);
  machineBeam.position.set(0, H_TOP - 0.12, MACHINE_Z - 0.34);
  group.add(machineBeam);
  const beamStub = beveledBox(0.16, 0.26, 0.1, darkSteel, 0.012);
  beamStub.position.set(SHEAVE_X, SHEAVE_Y + 0.13, MACHINE_Z - 0.32);
  group.add(beamStub);

  // Gearless permanent-magnet motor: a wide, shallow disc directly behind the
  // sheave. Its HOUSING is static — only the shaft, sheave and brake disc turn.
  const motor = new THREE.Group();
  motor.position.set(SHEAVE_X, SHEAVE_Y, MACHINE_Z - 0.26);
  const motorBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.19, 0.16, 40).rotateX(Math.PI / 2),
    machineMat,
  );
  motor.add(motorBody);
  const motorRim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.014, 10, 44), machineMat);
  motorRim.position.z = 0.08;
  motor.add(motorRim);
  const motorBolts = boltCircle(10, 0.15, 0.013, darkSteel, 0.02);
  motorBolts.rotation.x = Math.PI / 2;
  motorBolts.position.z = 0.085;
  motor.add(motorBolts);
  const junctionBox = beveledBox(0.1, 0.08, 0.06, darkSteel, 0.008);
  junctionBox.position.set(0.14, -0.15, -0.03);
  motor.add(junctionBox);
  group.add(motor);

  // Brake disc, deliberately LARGER than the sheave so the caliper stays in
  // view from the front instead of hiding behind the rope grooves.
  const brakeGroup = new THREE.Group();
  brakeGroup.position.set(SHEAVE_X, SHEAVE_Y, MACHINE_Z - 0.12);
  const brakeMat = materials.brushedSteel(0x9aa1a9);
  brakeMat.roughness = 0.58;
  const brakeDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.016, 44).rotateX(Math.PI / 2),
    brakeMat,
  );
  brakeGroup.add(brakeDisc);
  const brakeVent = boltCircle(8, 0.15, 0.022, materials.paintedMetal(0x4a5058), 0.02);
  brakeVent.rotation.x = Math.PI / 2;
  brakeGroup.add(brakeVent);
  group.add(brakeGroup);

  const caliper = new THREE.Group();
  caliper.position.set(SHEAVE_X - 0.185, SHEAVE_Y - 0.135, MACHINE_Z - 0.12);
  caliper.add(beveledBox(0.075, 0.075, 0.1, darkSteel, 0.01));
  for (const cz of [-0.034, 0.034]) {
    const pad = box(0.05, 0.05, 0.014, materials.rubber(0x2a2c30));
    pad.position.z = cz;
    caliper.add(pad);
  }
  const calArm = box(0.028, 0.13, 0.028, darkSteel);
  calArm.position.set(0.02, 0.09, -0.05);
  caliper.add(calArm);
  group.add(caliper);

  // A lathed rim with real V-grooves at the rope pitch. `axis` picks the spin
  // axis: 'z' for the hoisting sheaves, 'x' for the governor wheels.
  function sheaveMesh(radius, halfWidth, grooved, axis = 'z') {
    const profile = [[0, -halfWidth]];
    if (grooved) {
      profile.push([radius, -halfWidth]);
      for (let i = 0; i < N_ROPES; i++) {
        const gz = -((N_ROPES - 1) / 2) * ROPE_PITCH + i * ROPE_PITCH;
        profile.push([radius, gz - 0.011], [radius - 0.014, gz], [radius, gz + 0.011]);
      }
      profile.push([radius, halfWidth]);
    } else {
      profile.push([radius, -halfWidth], [radius - 0.012, 0], [radius, halfWidth]);
    }
    profile.push([0, halfWidth]);
    const wheelMat = materials.brushedSteel(0xb6bdc6);
    wheelMat.roughness = 0.5;
    const m = lathe(profile, wheelMat, 56);
    // lathe spins about +Y; rotate the whole wheel onto the axis we want
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    else m.rotation.z = Math.PI / 2;
    return m;
  }

  const sheave = new THREE.Group();
  sheave.position.set(SHEAVE_X, SHEAVE_Y, MACHINE_Z);
  sheave.add(sheaveMesh(R1, 0.08, true));
  const sheaveHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.21, 20).rotateX(Math.PI / 2),
    darkSteel,
  );
  sheave.add(sheaveHub);
  for (let i = 0; i < 3; i++) {
    const spoke = box(0.026, R1 * 1.7, 0.05, materials.brushedSteel(0xa9b0b8));
    spoke.rotation.z = (i * Math.PI) / 3;
    sheave.add(spoke);
  }
  group.add(sheave);

  const deflector = new THREE.Group();
  deflector.position.set(DEF_X, DEF_Y, MACHINE_Z);
  deflector.add(sheaveMesh(R2, 0.075, true));
  const defHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.033, 0.033, 0.18, 18).rotateX(Math.PI / 2),
    darkSteel,
  );
  deflector.add(defHub);
  const defMark = box(0.015, R2 * 1.3, 0.055, safetyOrange);
  deflector.add(defMark);
  group.add(deflector);
  const defBracket = beveledBox(0.055, 0.34, 0.09, darkSteel, 0.01);
  defBracket.position.set(DEF_X + 0.15, DEF_Y + 0.14, MACHINE_Z - 0.08);
  group.add(defBracket);

  // ==========================================================================
  // CAR
  // ==========================================================================
  const car = new THREE.Group();
  group.add(car);

  const cabFrontShape = new THREE.Shape();
  cabFrontShape.moveTo(-CAR_W / 2, 0);
  cabFrontShape.lineTo(CAR_W / 2, 0);
  cabFrontShape.lineTo(CAR_W / 2, CAR_H);
  cabFrontShape.lineTo(-CAR_W / 2, CAR_H);
  cabFrontShape.closePath();
  const cabHole = new THREE.Path();
  cabHole.moveTo(-DOOR_W / 2, 0.015);
  cabHole.lineTo(DOOR_W / 2, 0.015);
  cabHole.lineTo(DOOR_W / 2, 0.015 + DOOR_H);
  cabHole.lineTo(-DOOR_W / 2, 0.015 + DOOR_H);
  cabHole.closePath();
  cabFrontShape.holes.push(cabHole);
  const carFrontSkin = new THREE.Mesh(
    new THREE.ExtrudeGeometry(cabFrontShape, { depth: CAR_SKIN, bevelEnabled: false }),
    steel,
  );
  carFrontSkin.position.set(CAR_X, 0, CAR_Z + CAR_D / 2 - CAR_SKIN);
  carFrontSkin.castShadow = true;
  car.add(carFrontSkin);

  for (const sx of [-1, 1]) {
    const wall = box(CAR_SKIN, CAR_H, CAR_D, steel);
    wall.position.set(CAR_X + sx * (CAR_W / 2 - CAR_SKIN / 2), CAR_H / 2, CAR_Z);
    wall.castShadow = true;
    car.add(wall);
  }
  const carBack = box(CAR_W, CAR_H, CAR_SKIN, steel);
  carBack.position.set(CAR_X, CAR_H / 2, CAR_Z - CAR_D / 2 + CAR_SKIN / 2);
  car.add(carBack);
  const roofMat = materials.brushedSteel(0x9ba3ac);
  roofMat.roughness = 0.6;
  const carRoof = box(CAR_W, 0.03, CAR_D, roofMat);
  carRoof.position.set(CAR_X, CAR_H - 0.015, CAR_Z);
  carRoof.castShadow = true;
  car.add(carRoof);
  const carUnder = box(CAR_W, 0.045, CAR_D, darkSteel);
  carUnder.position.set(CAR_X, 0.022, CAR_Z);
  car.add(carUnder);
  // toe guard — the apron that hangs below the car sill
  const apron = box(DOOR_W + 0.08, 0.16, 0.014, roofMat);
  apron.position.set(CAR_X, -0.06, CAR_Z + CAR_D / 2 - 0.01);
  car.add(apron);

  // cab interior — visible through the doorway once the doors open
  const cabFloor = box(CAR_W - 0.07, 0.012, CAR_D - 0.07, materials.polymer(0x2a2e34));
  cabFloor.position.set(CAR_X, 0.05, CAR_Z);
  car.add(cabFloor);
  const cabRear = box(CAR_W - 0.07, CAR_H - 0.09, 0.012, cabInner);
  cabRear.position.set(CAR_X, CAR_H / 2, CAR_Z - CAR_D / 2 + 0.04);
  car.add(cabRear);
  const cabLight = box(CAR_W - 0.2, 0.012, CAR_D - 0.24, materials.glow(0xfff0d6, 0.45));
  cabLight.position.set(CAR_X, CAR_H - 0.045, CAR_Z);
  car.add(cabLight);
  const handrail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.009, CAR_W - 0.17, 10).rotateZ(Math.PI / 2),
    doorMat,
  );
  handrail.position.set(CAR_X, CAR_H * 0.52, CAR_Z - CAR_D / 2 + 0.075);
  car.add(handrail);
  const carPanel = beveledBox(0.05, 0.17, 0.012, darkSteel, 0.005);
  carPanel.position.set(CAR_X + CAR_W / 2 - 0.09, CAR_H * 0.55, CAR_Z + CAR_D / 2 - 0.06);
  car.add(carPanel);

  // car doors, just inside the front skin so opening tucks them into the returns
  const carDoors = [];
  for (const sx of [-1, 1]) {
    const p = beveledBox(PANEL_W, DOOR_H, 0.016, doorMat, 0.004);
    p.position.set(
      CAR_X + sx * (PANEL_W / 2 - 0.005),
      0.015 + DOOR_H / 2,
      CAR_Z + CAR_D / 2 - CAR_SKIN - 0.013,
    );
    car.add(p);
    carDoors.push(p);
  }
  const opTrack = box(CAR_W - 0.06, 0.022, 0.03, darkSteel);
  opTrack.position.set(CAR_X, 0.015 + DOOR_H + 0.035, CAR_Z + CAR_D / 2 - CAR_SKIN - 0.02);
  car.add(opTrack);
  const opMotor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, 0.05, 16).rotateZ(Math.PI / 2),
    machineMat,
  );
  opMotor.position.set(CAR_X - CAR_W / 2 + 0.09, 0.015 + DOOR_H + 0.08, CAR_Z + CAR_D / 2 - 0.07);
  car.add(opMotor);

  // Door clutch: the two vanes on the leading car panel that close onto the
  // landing rollers. Parented to that panel, so it travels with it.
  const clutch = new THREE.Group();
  clutch.position.set(PANEL_W / 2 - 0.045, 0, 0.024);
  for (const vx of [-0.018, 0.018]) {
    const vane = box(0.014, DOOR_H * 0.68, 0.058, safetyOrange);
    vane.position.set(vx, 0.01, 0.024);
    clutch.add(vane);
  }
  carDoors[0].add(clutch);

  // hitch beam + rope sockets on the roof
  const hitch = beveledBox(0.2, HITCH_H, 0.22, darkSteel, 0.008);
  hitch.position.set(CAR_X, CAR_H + HITCH_H / 2, CAR_Z);
  car.add(hitch);
  for (let i = 0; i < N_ROPES; i++) {
    const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.05, 10), steel);
    socket.position.set(CAR_X, CAR_H + HITCH_H + 0.02, CAR_Z + (i - (N_ROPES - 1) / 2) * ROPE_PITCH);
    car.add(socket);
  }

  // roller guide shoes: three rollers per rail, top and bottom
  for (const rx of CAR_RAIL_X) {
    const inward = rx < CAR_X ? 1 : -1;
    for (const sy of [CAR_H - 0.05, 0.075]) {
      const arm = new THREE.Group();
      arm.position.set(rx, sy, RAIL_Z);
      arm.add(box(0.05, 0.05, 0.055, darkSteel));
      // one roller on the rail's end face, two pinching its sides
      const face = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.015, 14).rotateX(Math.PI / 2),
        materials.rubber(0x2b2f35),
      );
      face.position.set(inward * 0.062, 0, 0);
      arm.add(face);
      for (const oz of [-0.042, 0.042]) {
        const side = new THREE.Mesh(
          new THREE.CylinderGeometry(0.016, 0.016, 0.015, 14),
          materials.rubber(0x2b2f35),
        );
        side.position.set(inward * 0.04, 0, oz);
        side.rotation.x = Math.PI / 2;
        side.rotation.z = Math.PI / 2;
        arm.add(side);
      }
      car.add(arm);
    }
  }

  // Safety gear: a wedge in a tapered gib at the base of each car rail, lifted
  // by a rod the governor yanks.
  const wedges = [];
  for (const rx of CAR_RAIL_X) {
    const inward = rx < CAR_X ? 1 : -1;
    const gib = new THREE.Group();
    gib.position.set(rx, 0.055, RAIL_Z);
    gib.add(beveledBox(0.07, 0.09, 0.08, darkSteel, 0.008));
    car.add(gib);
    const wedge = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.032, 0.075, 4), safetyOrange);
    wedge.position.set(rx + inward * 0.055, 0.045, RAIL_Z + 0.04);
    car.add(wedge);
    wedges.push({ wedge, inward, baseY: 0.045, baseX: rx + inward * 0.055 });
  }
  const liftRod = box(0.013, 0.17, 0.013, safetyOrange);
  liftRod.position.set(CAR_RAIL_X[1], 0.145, RAIL_Z);
  car.add(liftRod);
  const safetyArm = box(0.014, 0.014, Math.abs(GOV_Z - RAIL_Z - 0.055) + 0.02, safetyOrange);
  safetyArm.position.set(GOV_X, 0.225, (RAIL_Z + GOV_Z - 0.055) / 2);
  car.add(safetyArm);
  const govClamp = beveledBox(0.045, 0.05, 0.045, darkSteel, 0.006);
  govClamp.position.set(GOV_X, 0.225, GOV_Z - GOV_R);
  car.add(govClamp);

  // ==========================================================================
  // COUNTERWEIGHT
  // ==========================================================================
  const counterweight = new THREE.Group();
  group.add(counterweight);
  const cwFrameMat = materials.brushedSteel(0x8f969e);
  for (const sz of [-1, 1]) {
    const stile = box(CW_W, CW_H, 0.026, cwFrameMat);
    stile.position.set(CW_X, CW_H / 2, CW_Z + sz * (CW_D / 2 - 0.013));
    stile.castShadow = true;
    counterweight.add(stile);
  }
  const cwTop = box(CW_W, 0.035, CW_D, cwFrameMat);
  cwTop.position.set(CW_X, CW_H - 0.018, CW_Z);
  counterweight.add(cwTop);
  const cwBase = box(CW_W, 0.035, CW_D, cwFrameMat);
  cwBase.position.set(CW_X, 0.018, CW_Z);
  counterweight.add(cwBase);
  // filler slabs — the actual mass, stacked and countable
  for (let i = 0; i < 9; i++) {
    const fill = beveledBox(CW_W - 0.016, 0.054, CW_D - 0.05, cwMat, 0.006);
    fill.position.set(CW_X, 0.062 + i * 0.06, CW_Z);
    fill.castShadow = true;
    counterweight.add(fill);
  }
  const cwHitch = beveledBox(0.09, CW_HITCH_H, 0.2, darkSteel, 0.006);
  cwHitch.position.set(CW_X, CW_H + CW_HITCH_H / 2, CW_Z);
  counterweight.add(cwHitch);
  for (const rz of CW_RAIL_Z) {
    for (const sy of [CW_H - 0.045, 0.055]) {
      const shoe = box(0.05, 0.045, 0.05, darkSteel);
      shoe.position.set(CW_X, sy, rz);
      counterweight.add(shoe);
    }
  }

  // ==========================================================================
  // ROPES — a static wrap over both sheaves, plus two scalable vertical drops
  // ==========================================================================
  const ropeGroup = new THREE.Group();
  group.add(ropeGroup);
  const ax = SHEAVE_X + R1 * Math.cos(TANGENT_A);
  const ay = SHEAVE_Y + R1 * Math.sin(TANGENT_A);
  const bx = DEF_X + R2 * Math.cos(TANGENT_A);
  const by = DEF_Y + R2 * Math.sin(TANGENT_A);
  for (let i = 0; i < N_ROPES; i++) {
    const rz = MACHINE_Z + (i - (N_ROPES - 1) / 2) * ROPE_PITCH;
    const pts = [];
    for (let k = 0; k <= 18; k++) {
      const a = Math.PI + (TANGENT_A - Math.PI) * (k / 18);
      pts.push([SHEAVE_X + R1 * Math.cos(a), SHEAVE_Y + R1 * Math.sin(a), rz]);
    }
    // two samples along the straight span stop the spline bowing off the
    // tangent line between the sheaves
    pts.push(
      [ax + (bx - ax) / 3, ay + (by - ay) / 3, rz],
      [ax + ((bx - ax) * 2) / 3, ay + ((by - ay) * 2) / 3, rz],
    );
    for (let k = 0; k <= 12; k++) {
      const a = TANGENT_A * (1 - k / 12);
      pts.push([DEF_X + R2 * Math.cos(a), DEF_Y + R2 * Math.sin(a), rz]);
    }
    ropeGroup.add(tubeAlong(pts, ROPE_R, ropeMat, { tubularSegments: 120, radialSegments: 8 }));
  }

  // Unit-length cylinders hung from a fixed top point; `scale.y` sets the run.
  // Scaling beats rebuilding geometry every frame, and the two runs always sum
  // to the same length — which is exactly the physical constraint.
  function hangingRope(topX, topY, z) {
    const geo = new THREE.CylinderGeometry(ROPE_R, ROPE_R, 1, 8);
    geo.translate(0, -0.5, 0); // origin at the TOP end
    const m = new THREE.Mesh(geo, ropeMat);
    m.position.set(topX, topY, z);
    ropeGroup.add(m);
    return m;
  }
  const carRopes = [];
  const cwRopes = [];
  for (let i = 0; i < N_ROPES; i++) {
    const rz = MACHINE_Z + (i - (N_ROPES - 1) / 2) * ROPE_PITCH;
    carRopes.push(hangingRope(CAR_X, SHEAVE_Y, rz));
    cwRopes.push(hangingRope(CW_X, DEF_Y, rz));
  }

  // ==========================================================================
  // GOVERNOR — wheel in the headroom, tension sheave in the pit, closed loop
  // ==========================================================================
  const govTop = new THREE.Group();
  govTop.position.set(GOV_X, GOV_TOP_Y, GOV_Z);
  govTop.add(sheaveMesh(GOV_R, 0.026, false, 'x'));
  const govMark = box(0.045, GOV_R * 1.5, 0.013, safetyOrange);
  govMark.rotation.z = Math.PI / 2;
  govTop.add(govMark);
  // flyweight arms — they swing out when the rope runs too fast
  const flyweights = [];
  for (const sz of [-1, 1]) {
    const arm = new THREE.Group();
    const link = box(0.011, 0.07, 0.011, darkSteel);
    link.position.y = 0.035;
    arm.add(link);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.018, 14, 10), materials.brushedSteel(0xb2b8c0));
    ball.position.y = 0.073;
    arm.add(ball);
    arm.position.set(0, 0, sz * 0.018);
    arm.rotation.x = -sz * 0.12;
    govTop.add(arm);
    flyweights.push({ arm, sign: -sz });
  }
  group.add(govTop);
  const govBracket = beveledBox(0.05, 0.15, 0.07, darkSteel, 0.008);
  govBracket.position.set(GOV_X, GOV_TOP_Y + 0.13, GOV_Z);
  group.add(govBracket);

  const govPit = new THREE.Group();
  govPit.position.set(GOV_X, GOV_PIT_Y, GOV_Z);
  govPit.add(sheaveMesh(GOV_R, 0.026, false, 'x'));
  const govPitMark = box(0.04, GOV_R * 1.5, 0.012, safetyOrange);
  govPitMark.rotation.z = Math.PI / 2;
  govPit.add(govPitMark);
  group.add(govPit);
  const tensionArm = box(0.028, 0.17, 0.028, darkSteel);
  tensionArm.position.set(GOV_X, GOV_PIT_Y - 0.06, GOV_Z + 0.09);
  group.add(tensionArm);

  // the closed loop: two vertical runs + a half-wrap at each end
  const govRopeMat = materials.brushedSteel(0x9aa1a9);
  govRopeMat.roughness = 0.68;
  for (const sz of [-1, 1]) {
    const runMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.005, GOV_TOP_Y - GOV_PIT_Y, 8),
      govRopeMat,
    );
    runMesh.position.set(GOV_X, (GOV_TOP_Y + GOV_PIT_Y) / 2, GOV_Z + sz * GOV_R);
    group.add(runMesh);
  }
  for (const [cy, dir] of [
    [GOV_TOP_Y, 1],
    [GOV_PIT_Y, -1],
  ]) {
    const arcPts = [];
    for (let k = 0; k <= 14; k++) {
      const a = Math.PI * (k / 14);
      arcPts.push([GOV_X, cy + dir * GOV_R * Math.sin(a), GOV_Z + GOV_R * Math.cos(a)]);
    }
    group.add(tubeAlong(arcPts, 0.005, govRopeMat, { tubularSegments: 40, radialSegments: 6 }));
  }

  // ==========================================================================
  // PIT — buffers under both travel paths
  // ==========================================================================
  function buffer(x, z, height, coilR) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const base = beveledBox(coilR * 2.6, 0.03, coilR * 2.6, darkSteel, 0.006);
    base.position.y = 0.015;
    g.add(base);
    const coilPts = [];
    for (let k = 0; k <= 72; k++) {
      const a = (k / 72) * Math.PI * 2 * 4.5;
      coilPts.push([coilR * Math.cos(a), 0.03 + (k / 72) * (height - 0.05), coilR * Math.sin(a)]);
    }
    g.add(tubeAlong(coilPts, 0.012, safetyOrange, { tubularSegments: 150, radialSegments: 7 }));
    const cap = beveledBox(coilR * 2.1, 0.02, coilR * 2.1, safetyOrange, 0.005);
    cap.position.y = height;
    g.add(cap);
    group.add(g);
    return g;
  }
  buffer(CAR_X, CAR_Z, 0.18, 0.055);
  buffer(CW_X, CW_Z, 0.09, 0.038);

  // ==========================================================================
  // TRAVELLING CABLE — power, buttons, phone and video, hanging in a loop that
  // reshapes as the car moves. Posed as a chain of short links read off an
  // analytic curve, so no geometry is ever rebuilt.
  // ==========================================================================
  // Hung in the gap between the car's right flank and the counterweight rather
  // than off the left wall: from any camera on the +x side (which is every
  // camera here, because the text panel owns the left of the frame) a cable on
  // the far side sits squarely behind the car and its callout points at
  // nothing.
  const CABLE_N = 22;
  const CABLE_Z = -0.3;
  const cableAnchor = new THREE.Vector3(0.32, 1.05, -0.4);
  const cableLinks = [];
  const cableMat = materials.rubber(0x30343a);
  for (let i = 0; i < CABLE_N; i++) {
    const link = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.055, 4, 8), cableMat);
    cableLinks.push(link);
    group.add(link);
  }
  const cableWallBox = beveledBox(0.05, 0.085, 0.05, darkSteel, 0.006);
  cableWallBox.position.set(cableAnchor.x, cableAnchor.y + 0.06, cableAnchor.z - 0.03);
  group.add(cableWallBox);

  // ==========================================================================
  // CALLOUTS
  // ==========================================================================
  const labels = calloutSets(['exterior', 'shaft', 'machine', 'balance', 'rails', 'safety', 'doors']);
  const bottomLanding = landings[0];
  const midLanding = landings[1];
  const topLanding = landings[2];

  labels.add('exterior', bottomLanding.g, 'Landing doors', [CAR_X + 0.12, DOOR_H * 0.5, FRONT_Z + 0.06], 20, 78);
  labels.add('exterior', bottomLanding.g, 'Floor indicator', [CAR_X + 0.06, DOOR_H + 0.07, FRONT_Z + WALL_T], 55, 70);
  labels.add('exterior', bottomLanding.g, 'Call button', [CAR_X + DOOR_W / 2 + 0.075, 0.322, FRONT_Z + WALL_T], -25, 66);
  labels.add('exterior', bottomLanding.g, 'Sill — the gap you step over', [CAR_X + 0.1, -0.008, FRONT_Z + 0.06], -45, 84);

  labels.add('shaft', car, 'Elevator car', [CAR_X + CAR_W / 2, CAR_H * 0.62, CAR_Z + 0.1], 25, 74);
  labels.add('shaft', counterweight, 'Counterweight', [CW_X, CW_H * 0.55, CW_Z + CW_D / 2], 25, 68);
  labels.add('shaft', group, 'Hoisting ropes', [CW_X, DEF_Y - 0.42, MACHINE_Z], 12, 74);
  labels.add('shaft', group, 'Traction machine', [SHEAVE_X + 0.02, SHEAVE_Y + R1, MACHINE_Z], 75, 72);
  labels.add('shaft', group, 'Travelling cable', [0.29, 0.76, -0.34], 18, 80);

  labels.add('machine', group, 'Traction sheave', [SHEAVE_X, SHEAVE_Y + R1, MACHINE_Z], 100, 64);
  labels.add('machine', group, 'Gearless motor', [SHEAVE_X + 0.17, SHEAVE_Y - 0.04, MACHINE_Z - 0.26], 8, 80);
  labels.add('machine', group, 'Brake disc + caliper', [SHEAVE_X - 0.185, SHEAVE_Y - 0.17, MACHINE_Z - 0.12], -60, 76);
  labels.add('machine', group, 'Deflector sheave', [DEF_X + 0.04, DEF_Y + R2, MACHINE_Z], 40, 66);

  labels.add('balance', counterweight, 'Steel filler slabs', [CW_X, CW_H * 0.42, CW_Z + CW_D / 2], 15, 76);
  labels.add('balance', counterweight, 'Counterweight frame', [CW_X, CW_H * 0.9, CW_Z + CW_D / 2], 45, 66);
  labels.add('balance', group, 'Counterweight rails', [CW_X, 1.32, CW_RAIL_Z[1]], 20, 74);
  labels.add('balance', car, 'Car — the lighter end', [CAR_X + CAR_W / 2, CAR_H * 0.7, CAR_Z + 0.1], 30, 86);

  labels.add('rails', group, 'Guide rail (T-section)', [CAR_RAIL_X[1], 1.8, RAIL_Z], 25, 78);
  labels.add('rails', car, 'Roller guide shoe', [CAR_RAIL_X[1], CAR_H - 0.05, RAIL_Z + 0.05], 35, 72);
  labels.add('rails', group, 'Rail bracket', [CAR_RAIL_X[1], 1.52, RAIL_Z], -30, 68);
  labels.add('rails', car, 'Travelling cable', [CAR_X + CAR_W / 2 + 0.02, 0.04, CABLE_Z], -30, 84);

  labels.add('safety', group, 'Overspeed governor', [GOV_X, GOV_TOP_Y, GOV_Z + GOV_R], 20, 78);
  labels.add('safety', group, 'Governor rope', [GOV_X, 1.15, GOV_Z + GOV_R], 12, 72);
  labels.add('safety', car, 'Safety wedge', [CAR_RAIL_X[1] - 0.052, 0.045, RAIL_Z + 0.036], -20, 78);
  labels.add('safety', group, 'Buffer', [CAR_X, 0.18, CAR_Z], -55, 82);
  labels.add('safety', group, 'Tension sheave', [GOV_X, GOV_PIT_Y, GOV_Z + GOV_R], 25, 70);

  labels.add('doors', carDoors[0], 'Car door clutch', [PANEL_W / 2 - 0.045, 0.02, 0.05], 30, 78);
  labels.add('doors', topLanding.g, 'Landing door rollers', [CAR_X - 0.14, DOOR_H * 0.5 - 0.05, FRONT_Z - 0.035], 15, 84);
  labels.add('doors', midLanding.g, 'Locked — no car here', [CAR_X + 0.08, DOOR_H * 0.5, FRONT_Z], -25, 84);
  labels.add('doors', topLanding.g, 'Interlock latch', [CAR_X - 0.02, DOOR_H - 0.03, FRONT_Z - 0.032], 55, 70);

  // ==========================================================================
  // STATE + POSE
  // ==========================================================================
  const state = { reveal: 0, carT: 0, door: 0, safety: 0, slip: 0 };

  const cableA = new THREE.Vector3();
  const cableB = new THREE.Vector3();
  const cableC = new THREE.Vector3();
  const cableP = new THREE.Vector3();
  const cablePrev = new THREE.Vector3();
  const cableUp = new THREE.Vector3(0, 1, 0);
  const cableDir = new THREE.Vector3();
  const bezier = (t, a, b, c, out) => {
    const m = 1 - t;
    return out.set(
      m * m * a.x + 2 * m * t * c.x + t * t * b.x,
      m * m * a.y + 2 * m * t * c.y + t * t * b.y,
      m * m * a.z + 2 * m * t * c.z + t * t * b.z,
    );
  };

  function apply() {
    const t = clamp01(state.carT);
    const carY = LEVELS[0] + t * TRAVEL;
    const cwY = CW_BOT + (1 - t) * TRAVEL;
    car.position.y = carY;
    counterweight.position.y = cwY;

    // Every wheel is SLAVED to the rope, not animated alongside it: rope travel
    // divided by radius is the only angle any of them can be at. `slip` is the
    // one exception — the machine turning while the ropes take the car nowhere,
    // which is exactly what happens once the safeties have it pinned.
    const ropeTravel = t * TRAVEL;
    sheave.rotation.z = -ropeTravel / R1 + state.slip;
    deflector.rotation.z = -ropeTravel / R2 + (state.slip * R1) / R2;
    brakeGroup.rotation.z = sheave.rotation.z;
    // the governor rope is clamped to the car, so it can never slip
    govTop.rotation.x = ropeTravel / GOV_R;
    govPit.rotation.x = govTop.rotation.x;

    const carRun = SHEAVE_Y - (carY + CAR_H + HITCH_H);
    const cwRun = DEF_Y - (cwY + CW_H + CW_HITCH_H);
    for (const r of carRopes) r.scale.y = Math.max(0.01, carRun);
    for (const r of cwRopes) r.scale.y = Math.max(0.01, cwRun);

    // Doors: only the landing the car is level with can open. The middle
    // landing therefore never opens — there is nothing there to unlock it,
    // which is the entire point of the interlock.
    const atTop = smooth((t - 0.4) / 0.2);
    const slide = clamp01(state.door) * DOOR_SLIDE;
    carDoors[0].position.x = CAR_X - (PANEL_W / 2 - 0.005) - slide;
    carDoors[1].position.x = CAR_X + (PANEL_W / 2 - 0.005) + slide;
    landings.forEach((lg, i) => {
      const share = i === 0 ? 1 - atTop : i === 2 ? atTop : 0;
      const s = slide * share;
      lg.panels[0].position.x = CAR_X - (PANEL_W / 2 - 0.005) - s;
      lg.panels[1].position.x = CAR_X + (PANEL_W / 2 - 0.005) + s;
      // indicator lights the landing the car is actually at
      const near = 1 - clamp01(Math.abs(carY - lg.y) / 0.33);
      const hot = near > 0.5;
      lg.indicator.material.emissiveIntensity = 0.15 + near * 0.95;
      lg.indicator.material.color.setHex(hot ? 0xffc46b : 0x46403a);
      lg.indicator.material.emissive.setHex(hot ? 0xffb454 : 0x2a2622);
      lg.btn.material.emissiveIntensity = 0.3 + (1 - near) * 0.5;
    });

    // Safety gear: the wedge climbs its tapered gib and pinches the rail.
    const sf = clamp01(state.safety);
    for (const w of wedges) {
      w.wedge.position.y = w.baseY + sf * 0.03;
      w.wedge.position.x = w.baseX - w.inward * sf * 0.016;
    }
    liftRod.position.y = 0.145 + sf * 0.028;
    safetyArm.position.y = 0.225 + sf * 0.028;
    govClamp.position.y = 0.225 + sf * 0.028;
    for (const f of flyweights) f.arm.rotation.x = f.sign * (0.12 + sf * 0.6);

    // Travelling cable: a quadratic loop from the wall box to the car's
    // underside, its lowest point dropping as the two ends converge — so the
    // slack it has to store stays roughly constant.
    cableA.copy(cableAnchor);
    cableB.set(CAR_X + CAR_W / 2 + 0.02, carY + 0.02, CABLE_Z);
    const sag = 0.6 - 0.32 * clamp01(Math.abs(cableA.y - cableB.y) / 1.1);
    cableC.set(
      (cableA.x + cableB.x) / 2 + 0.05,
      Math.min(cableA.y, cableB.y) - sag,
      (cableA.z + cableB.z) / 2,
    );
    for (let i = 0; i < CABLE_N; i++) {
      bezier((i + 0.5) / CABLE_N, cableA, cableB, cableC, cableP);
      bezier(Math.max(0, i - 0.2) / CABLE_N, cableA, cableB, cableC, cablePrev);
      cableLinks[i].position.copy(cableP);
      cableDir.copy(cableP).sub(cablePrev);
      if (cableDir.lengthSq() > 1e-9) {
        cableLinks[i].quaternion.setFromUnitVectors(cableUp, cableDir.normalize());
      }
    }
  }

  function setReveal(r) {
    const v = clamp01(r);
    for (const mat of wallMats) {
      mat.opacity = 1 - v * 0.93; // -> 0.07: light concrete still veils a dark shaft at 0.26
      mat.clearcoat = v > 0.02 ? 0 : 0.15; // coat specular ignores opacity entirely
      mat.depthWrite = v < 0.02;
    }
    lobbyWall.castShadow = v < 0.02;
  }

  setReveal(0);
  apply();

  return {
    group,
    state,
    levels: LEVELS,
    parts: { car, counterweight, sheave, deflector, govTop, carDoors, landings, wedges },
    set(partial) {
      Object.assign(state, partial);
      if ('reveal' in partial) setReveal(state.reveal);
      apply();
    },
    setReveal(r) {
      state.reveal = r;
      setReveal(r);
    },
    setLabels: labels.setLabels,
  };
}
