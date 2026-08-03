import * as THREE from 'three';
import { materials, rod, disc, arrow } from '../../framework/parts.js';
import { beveledBox, finStack, coil, lathe, gear, boltCircle } from '../../framework/geometry.js';
import { callout } from '../../framework/labels.js';

// Slider-crank geometry (all lengths in scene units)
const CRANK_Y = 0.85; // crankshaft center height
const R = 0.34; // crank radius
const L = 0.95; // connecting rod length (big-end centre → small-end centre)
const PISTON_R = 0.36;
const PISTON_H = 0.4;
const BORE_R = 0.4;
const HEAD_Y = 2.5; // bottom face of the cylinder head / top of the bore
const VALVE_LIFT = 0.15;
const CANT = (16 * Math.PI) / 180; // valves cant outward → pent-roof chamber

const clamp01 = (t) => Math.min(1, Math.max(0, t));
const deg = (d) => (d * Math.PI) / 180;

// piston wrist-pin height for crank angle θ (radians)
function pistonY(theta) {
  const s = R * Math.sin(theta);
  return CRANK_Y + R * Math.cos(theta) + Math.sqrt(L * L - s * s);
}

// half-sine valve lift inside a [start, end] crank-cycle window (degrees, 0–720)
function lift(cycle, start, end) {
  if (cycle < start || cycle > end) return 0;
  return VALVE_LIFT * Math.sin(Math.PI * ((cycle - start) / (end - start)));
}

// Valve timing windows (deg of the 720° cycle) and their peak-lift instants.
const INTAKE = [0, 195];
const EXHAUST = [525, 720];
const INTAKE_PEAK = (INTAKE[0] + INTAKE[1]) / 2;
const EXHAUST_PEAK = (EXHAUST[0] + EXHAUST[1]) / 2;

export function buildEngine({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // The reveal is a LAYER control: at reveal 0 the engine is a complete, solid
  // block — closed crankcase, finned barrel, cylinder head, cam covers. As
  // reveal → 1 the metal shell is LIFTED OFF (transparent metal still reads as
  // solid) and the running valvetrain + crank mechanism inside is exposed.
  const shellMeshes = []; // opaque outer castings — hidden while revealed
  const internalMeshes = []; // mechanism — shown while revealed

  // Two-material story, like a real air-cooled single: bare cast/machined
  // aluminum for the crankcase, fins and head, set off against dark
  // gloss-painted covers and a black barrel core (metalness:1 crushes to
  // black wherever the studio dome behind camera is dark — the paintedMetal
  // preset's lower metalness + clearcoat keeps dark parts readable instead
  // of vanishing into the backdrop, exactly the trap the all-silver pass
  // fell into).
  const castAlum = (color, { metalness = 0.82, roughness = 0.5 } = {}) => {
    const m = materials.aluminum(color);
    m.metalness = metalness;
    m.roughness = roughness;
    m.envMapIntensity = 1.25;
    return m;
  };
  const grimeAlum = (color, { metalness = 0.78 } = {}) => {
    const m = materials.grimyAluminum(color);
    m.metalness = metalness;
    m.envMapIntensity = 1.2;
    return m;
  };
  const glossPaint = (color) => {
    const m = materials.paintedMetal(color);
    m.clearcoat = 0.6;
    m.clearcoatRoughness = 0.2;
    return m;
  };
  // rough-cast lower end — a shade darker/duller than the finished head, and
  // textured with the grime map so it reads as the coarser casting it is
  const casing = grimeAlum(0x8a919b);
  const steel = materials.brushedSteel(0x9aa2ad);
  const springMat = materials.brushedSteel(0x8a9198);

  // --- base + closed crankcase (the solid shell round the crank) -----------
  const base = beveledBox(1.9, 0.18, 1.6, grimeAlum(0x6b7480), 0.03);
  base.position.y = 0.09;
  group.add(base); // the plinth stays through the reveal

  const crankcase = beveledBox(1.4, 1.42, 1.5, casing, 0.04);
  crankcase.position.set(0, 0.9, 0);
  crankcase.castShadow = true;
  shellMeshes.push(crankcase);
  group.add(crankcase);

  // --- finned cylinder barrel (shell) --------------------------------------
  // barrel core painted gloss-black (classic air-cooled cylinder treatment)
  // — the bright aluminum fin rings around it read as the machined edges
  // catching the light, exactly like the real thing photographs.
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.54, 0.95, 40),
    glossPaint(0x24272c),
  );
  barrel.position.y = 2.02;
  barrel.castShadow = true;
  shellMeshes.push(barrel);
  group.add(barrel);

  // shape:'round' — a solid flat disc, not shape:'ring' (a thin TORUS: a
  // 0.035-radius wire loop out at 0.62 that barely reads against the barrel
  // and all but disappears from some angles). Real air-cooled fins are
  // stamped/cast plates, not wire rings — the disc gives them actual mass.
  const fins = finStack(
    { count: 6, size: 0.62, thickness: 0.05, gap: 0.085, shape: 'round' },
    castAlum(0xb2b9c1, { metalness: 0.85, roughness: 0.36 }),
  );
  fins.position.y = 1.68;
  shellMeshes.push(fins);
  group.add(fins);

  // --- cylinder head + cam covers (shell) ----------------------------------
  // the head is bright, finely-machined bare aluminum — the brightest metal
  // on the engine, so the eye reads it as the "finished" casting.
  const head = beveledBox(
    1.6, 0.72, 1.0,
    castAlum(0x9ba2ad, { metalness: 0.88, roughness: 0.34 }),
    0.03,
  );
  head.position.y = HEAD_Y + 0.42;
  head.castShadow = true;
  shellMeshes.push(head);
  group.add(head);

  // cam covers painted gloss-black, same family as the barrel — the
  // aluminum head/fins bracket them on both sides so the dark covers read as
  // a deliberate accent rather than blending into the backdrop.
  for (const sx of [-0.5, 0.5]) {
    const camCover = beveledBox(0.46, 0.26, 0.9, glossPaint(0x24272c), 0.05);
    camCover.position.set(sx, HEAD_Y + 0.86, 0);
    camCover.castShadow = true;
    shellMeshes.push(camCover);
    group.add(camCover);
  }

  // spark-plug body pokes out the top of the head — an exterior tell. Real
  // plug bodies are zinc-plated steel, not painted, so it should read as a
  // small bright hex-nut accent rather than another dark shape.
  const plugBody = rod(0.06, 0.34, materials.brushedSteel(0xc7ccd2));
  plugBody.position.set(0, HEAD_Y + 1.02, 0);
  shellMeshes.push(plugBody);
  group.add(plugBody);

  // head + cam-cover fasteners — this is where the anatomy camera actually
  // gets close, so it's where the detail budget is spent (rung-1 rule: don't
  // greeble what no step sees). Hex heads, not boltCircle: the head/covers
  // are rectangular boxes, not discs, so bolts land in a perimeter GRID.
  function hexBolt(r, h, material) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 6), material);
    m.castShadow = true;
    return m;
  }
  const headTopY = HEAD_Y + 0.78; // head center + half its 0.72 height
  for (const bx of [-0.68, 0, 0.68]) {
    for (const bz of [-0.38, 0.38]) {
      const b = hexBolt(0.032, 0.05, steel);
      b.position.set(bx, headTopY + 0.025, bz);
      shellMeshes.push(b);
      group.add(b);
    }
  }
  for (const sx of [-0.5, 0.5]) {
    const coverTopY = HEAD_Y + 0.86 + 0.13; // cover center + half its 0.26 height
    for (const bz of [-0.36, 0.36]) {
      const b = hexBolt(0.024, 0.038, steel);
      b.position.set(sx, coverTopY + 0.019, bz);
      shellMeshes.push(b);
      group.add(b);
    }
  }

  // --- section walls (internal): the casting seen in CROSS-SECTION behind the
  // mechanism, shown only on reveal. Without them the parts float in a void
  // once the metal shell is hidden; with them the piston sits in a bore, the
  // crank in a case, the valves in a head — exactly like a cutaway diagram.
  const interior = materials.paintedMetal(0x1b1e22);
  interior.side = THREE.DoubleSide;
  interior.roughness = 1.0;
  interior.metalness = 0.2; // matte casting interior — must not mirror the softbox
  const caseWall = beveledBox(1.34, 1.4, 0.34, interior, 0.03);
  caseWall.position.set(0, 0.9, -0.5);
  const headWall = beveledBox(1.5, 0.82, 0.32, interior, 0.03);
  headWall.position.set(0, HEAD_Y + 0.34, -0.42);
  const boreWall = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.46, 0.95, 32, 1, true, Math.PI / 2, Math.PI),
    interior,
  );
  boreWall.position.y = 2.02;
  group.add(caseWall, headWall, boreWall);
  internalMeshes.push(caseWall, headWall, boreWall);

  // --- crankshaft with counterweights (internal) ---------------------------
  const crank = new THREE.Group();
  crank.position.y = CRANK_Y;
  // Each web = hub disc on the axis + a heavier disc offset OPPOSITE the pin —
  // that offset lump is the counterweight balancing the piston + rod.
  for (const z of [-0.17, 0.17]) {
    const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.09, 28);
    hubGeo.rotateX(Math.PI / 2);
    const hub = new THREE.Mesh(hubGeo, steel);
    hub.castShadow = true;
    hub.position.z = z;
    const cwGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.085, 40);
    cwGeo.rotateX(Math.PI / 2);
    const cw = new THREE.Mesh(cwGeo, steel);
    cw.castShadow = true;
    cw.position.set(0, -0.16, z); // mass hangs opposite the +Y crank pin
    crank.add(hub, cw);
    internalMeshes.push(hub, cw);
  }
  const pinGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.3, 20);
  pinGeo.rotateX(Math.PI / 2);
  const crankPin = new THREE.Mesh(pinGeo, steel);
  crankPin.castShadow = true;
  crankPin.position.y = R;
  crank.add(crankPin);
  internalMeshes.push(crankPin);
  const mainGeo = new THREE.CylinderGeometry(0.11, 0.11, 1.6, 20);
  mainGeo.rotateX(Math.PI / 2);
  // TRIED anisoSteel here (turned-shaft grain along the length) and
  // REVERTED, 2026-08-01 — not because of clipping risk (repeat verify.mjs
  // runs hit 100-135 clipped px with AND without it, confirming that spike
  // is the pre-existing spark-timing sampling race, unrelated to this
  // material), but because the shaft is mostly hidden behind the
  // flywheel/crankcase at every step camera, so the visual payoff was too
  // small to justify a non-standard material on a part nobody can see well.
  const mainShaft = new THREE.Mesh(mainGeo, steel);
  mainShaft.castShadow = true;
  crank.add(mainShaft);
  internalMeshes.push(mainShaft);
  group.add(crank);

  // flywheel pokes out the side of the crankcase — spins in both views, so it
  // needs to read as bright machined steel rather than a dark disc. A pure
  // metalness:1 brushedSteel disc facing camera acts like a small mirror: it
  // mostly reflects the dark studio dome BEHIND the camera and shows only a
  // thin bright streak from the strip light — same as castAlum's fix above,
  // metalness pulled back off 1.0 gives it a visible diffuse floor.
  // a shade darker/duller than the bare-aluminum shell — steel and aluminum
  // should not read as the same material.
  const flywheelMat = materials.brushedSteel(0x999fa8);
  flywheelMat.metalness = 0.78;
  flywheelMat.roughness = 0.5;
  flywheelMat.envMapIntensity = 1.2;

  // A real flywheel is rim-weighted (mass pushed to the outer edge is what
  // stores the momentum — that's the whole POINT of it), not a flat disc, and
  // it carries a starter ring gear around the rim. lathe()'s profile is
  // [radius, y] revolved around Y, so this is authored in a local Y-up frame
  // (Y = the axial/thickness direction) and rotated to the crank's Z spin
  // axis once at the end, same as the old flat disc did.
  const FW_RIM_R = 0.56;
  const FW_RIM_T = 0.13; // thick outer rim — where the stored momentum lives
  const FW_WEB_R = 0.4;
  const FW_WEB_T = 0.055; // thin web between rim and hub — real flywheels are cored out here
  const FW_HUB_R = 0.11;
  const FW_HUB_T = 0.09;
  const flywheelBody = lathe(
    [
      [0, 0],
      [FW_RIM_R, 0],
      [FW_RIM_R, FW_RIM_T],
      [FW_WEB_R, FW_RIM_T],
      [FW_WEB_R, FW_WEB_T],
      [FW_HUB_R, FW_WEB_T],
      [FW_HUB_R, FW_HUB_T],
      [0, FW_HUB_T],
    ],
    flywheelMat,
  );

  // starter ring gear, shrink-fit around the rim — gear()'s teeth extrude
  // along its own Z, so it needs the same X-rotation as the flywheel to
  // stand it up on the shared Y axis before the whole assembly turns to Z.
  const ringGear = gear(
    { teeth: 60, radius: FW_RIM_R + 0.02, thickness: FW_RIM_T * 0.75, holeR: FW_RIM_R - 0.01 },
    materials.steel(0x7d838d),
  );
  ringGear.rotation.x = Math.PI / 2;
  ringGear.position.y = FW_RIM_T * 0.42;

  // bolt circle mounting the flywheel to the crank web. boltCircle() already
  // places bolts in the XZ plane with their axis along Y — the SAME native
  // frame lathe() uses — so, unlike the gear ring above, this needs no
  // corrective rotation; adding one (as a copy-paste from the gear fix)
  // scattered the bolts onto the wrong plane, stranding half of them outside
  // the hub's actual thickness range and reading as pieces floating in air.
  const flyBolts = boltCircle(6, FW_HUB_R + 0.09, 0.026, steel, 0.03);
  flyBolts.position.y = FW_HUB_T;

  const flywheel = new THREE.Group();
  flywheel.add(flywheelBody, ringGear, flyBolts);
  flywheel.rotation.x = Math.PI / 2;
  flywheel.position.z = 0.9;
  crank.add(flywheel);

  // --- connecting rod: shaft + small end + split big-end cap (internal) -----
  const conRod = new THREE.Group();
  const rodMat = materials.brushedSteel(0xb4bcc8);
  const bigEnd = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.055, 14, 28), rodMat);
  bigEnd.castShadow = true; // bearing ring around the crank pin
  const beam = beveledBox(0.11, L - 0.24, 0.14, rodMat, 0.02);
  beam.position.y = L / 2;
  beam.castShadow = true;
  const smallEnd = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.035, 12, 24), rodMat);
  smallEnd.position.y = L;
  smallEnd.castShadow = true;
  conRod.add(bigEnd, beam, smallEnd);
  internalMeshes.push(bigEnd, beam, smallEnd);
  // two cap bolts across the big-end split
  for (const bx of [-0.13, 0.13]) {
    const boltGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.34, 10);
    const bolt = new THREE.Mesh(boltGeo, steel);
    bolt.position.set(bx, -0.05, 0);
    conRod.add(bolt);
    internalMeshes.push(bolt);
  }
  group.add(conRod);

  // --- piston with rings (internal) ----------------------------------------
  const piston = new THREE.Group();
  // metalness pulled back a touch off the brushedSteel preset's default 1.0 —
  // same reasoning as the shell materials above, and it matters here more
  // than anywhere else: the crown sits a hair below the spark plug, and a
  // pure-mirror metal facing straight up into that point light's ignition
  // flash turns into a razor-thin, fully-clipped hotspot instead of a bright
  // but readable highlight.
  const crownMat = materials.brushedSteel(0xccd3dd);
  crownMat.metalness = 0.88;
  crownMat.roughness = 0.4;
  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(PISTON_R, PISTON_R, PISTON_H, 32),
    crownMat,
  );
  crown.castShadow = true;
  crown.position.y = 0.08;
  piston.add(crown);
  internalMeshes.push(crown);
  for (const ry of [0.2, 0.25, 0.3]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(PISTON_R + 0.002, 0.013, 8, 40), steel);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = ry;
    piston.add(ring);
    internalMeshes.push(ring);
  }
  const wristPinGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 14);
  wristPinGeo.rotateX(Math.PI / 2);
  const wristPin = new THREE.Mesh(wristPinGeo, steel);
  piston.add(wristPin);
  internalMeshes.push(wristPin);
  group.add(piston);

  // --- glass cylinder liner (internal context) -----------------------------
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(BORE_R, BORE_R, 1.05, 40, 1, true),
    materials.glass(0xaac6e8, 0.14),
  );
  tube.position.y = HEAD_Y - 0.525;
  group.add(tube);
  internalMeshes.push(tube);

  // --- canted poppet valves + springs (internal) ---------------------------
  // sign −1 = intake (left bank), +1 = exhaust (right bank). Each valve tilts
  // outward by CANT so the two seats form the pent-roof combustion chamber.
  function makeValve(sign, faceColor) {
    const asm = new THREE.Group();
    asm.position.set(0.16 * sign, HEAD_Y - 0.02, 0);
    asm.rotation.z = -sign * CANT;

    const valve = new THREE.Group(); // the part that lifts
    const headMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.08, 0.1, 28),
      materials.steel(faceColor),
    );
    headMesh.castShadow = true; // tulip valve head, face down into the chamber
    const stem = rod(0.026, 0.44, materials.steel());
    stem.position.y = 0.24;
    const retainer = disc(0.062, 0.03, steel);
    retainer.position.y = 0.42;
    valve.add(headMesh, stem, retainer);
    asm.add(valve);
    internalMeshes.push(headMesh, stem, retainer);

    // valve spring: bottom seats on the head deck (fixed), top on the retainer
    // (rides the valve) → it visibly COMPRESSES as the valve opens.
    const SPR = 0.24;
    const { mesh: spring } = coil(
      { turns: 6, radius: 0.052, length: SPR, wireRadius: 0.012, segmentsPerTurn: 20 },
      springMat,
    );
    const springGrp = new THREE.Group();
    springGrp.add(spring);
    asm.add(springGrp);
    internalMeshes.push(spring);

    function setLift(l) {
      valve.position.y = -l; // poppet opens downward, along its own axis
      const f = (SPR - l) / SPR;
      springGrp.scale.y = f;
      springGrp.position.y = 0.18 + (SPR / 2) * f; // bottom pinned at y≈0.18
    }
    setLift(0);
    group.add(asm);
    return { setLift };
  }
  const intakeValve = makeValve(-1, 0x7fc4ff);
  const exhaustValve = makeValve(+1, 0xffab7a);

  // --- overhead camshafts (internal) ---------------------------------------
  // One cam lobe per valve, riding just above the stem tip. The camshaft turns
  // at HALF crank speed — one lobe pass per two crank revolutions — which is
  // the whole reason a four-stroke fires every OTHER revolution.
  function makeCam(sign) {
    const grp = new THREE.Group();
    grp.position.set(0.28 * sign, HEAD_Y + 0.46, 0);
    const shaftGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.86, 16);
    shaftGeo.rotateX(Math.PI / 2);
    const shaft = new THREE.Mesh(shaftGeo, steel);
    grp.add(shaft);
    internalMeshes.push(shaft);
    // egg-shaped lobe: base circle with a pointed nose along +Y
    const lobe = new THREE.Shape();
    lobe.absarc(0, 0, 0.07, deg(130), deg(410), false);
    lobe.lineTo(0, 0.135); // nose tip
    // a real cam lobe is ground/polished, not a raw CNC-cut extrusion — a
    // small bevel on the extrude edge is what stops it reading as a paper
    // cutout under raking light.
    const lobeGeo = new THREE.ExtrudeGeometry(lobe, {
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.008,
      bevelSegments: 2,
    });
    lobeGeo.translate(0, 0, -0.05);
    const lobeMesh = new THREE.Mesh(lobeGeo, materials.brushedSteel(0xc2c9d3));
    lobeMesh.castShadow = true;
    grp.add(lobeMesh);
    internalMeshes.push(lobeMesh);
    group.add(grp);
    return { setAngle: (a) => (grp.rotation.z = a) };
  }
  const intakeCam = makeCam(-1);
  const exhaustCam = makeCam(+1);

  // --- spark tip + light (internal) ----------------------------------------
  const plugTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 12, 12),
    materials.glow(0xffc266, 0),
  );
  plugTip.material.transparent = true;
  plugTip.material.opacity = 0;
  plugTip.position.set(0, HEAD_Y + 0.02, 0);
  group.add(plugTip);
  internalMeshes.push(plugTip);
  const plugNose = rod(0.03, 0.34, materials.steel(0xe8e2d2));
  plugNose.position.set(0, HEAD_Y + 0.24, 0);
  group.add(plugNose);
  internalMeshes.push(plugNose);

  const sparkLight = new THREE.PointLight(0xffb45e, 0, 4);
  sparkLight.position.set(0, HEAD_Y + 0.05, 0);
  group.add(sparkLight);

  // --- intake/exhaust runners + flow arrows (internal) ---------------------
  // short runners feeding the back of each valve head, angled into the head.
  const intakePort = rod(0.1, 0.5, materials.glass(0x9fc8ff, 0.3));
  intakePort.position.set(-0.36, HEAD_Y + 0.28, 0);
  intakePort.rotation.z = deg(52);
  const exhaustPort = rod(0.1, 0.5, materials.glass(0xd9b39a, 0.3));
  exhaustPort.position.set(0.36, HEAD_Y + 0.28, 0);
  exhaustPort.rotation.z = deg(-52);
  group.add(intakePort, exhaustPort);
  internalMeshes.push(intakePort, exhaustPort);

  function makeFlow(color, angleRad) {
    const flow = new THREE.Group();
    flow.userData.arrows = [];
    for (let i = 0; i < 3; i++) {
      const a = arrow(color, 0.12);
      a.rotation.z = angleRad; // cone points +Y; rotate to follow the flow path
      flow.userData.arrows.push(a);
      flow.add(a);
      internalMeshes.push(a);
    }
    group.add(flow);
    return flow;
  }
  const intakeFlow = makeFlow(0x5ec1ff, deg(-147)); // down-right into the chamber
  const exhaustFlow = makeFlow(0xb9b1a6, deg(-34)); // up-right out the exhaust

  // --- charge (gas volume between piston crown and head) -------------------
  const chargeGeo = new THREE.CylinderGeometry(BORE_R * 0.9, BORE_R * 0.9, 1, 32);
  chargeGeo.translate(0, 0.5, 0);
  const charge = new THREE.Mesh(
    chargeGeo,
    new THREE.MeshBasicMaterial({
      color: 0x5ec1ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  group.add(charge);
  internalMeshes.push(charge);

  // --- callout labels -------------------------------------------------------
  const exteriorCallouts = [];
  const internalCallouts = [];
  const addCallout = (bucket, parent, text, pos, dir, len) => {
    const c = callout(text, { dir, len });
    c.position.set(...pos);
    c.visible = false;
    parent.add(c);
    bucket.push(c);
  };
  addCallout(exteriorCallouts, group, 'Cam cover', [0.5, HEAD_Y + 1.0, 0], 45, 56);
  addCallout(exteriorCallouts, group, 'Cylinder head', [0.82, HEAD_Y + 0.42, 0], 20, 58);
  addCallout(exteriorCallouts, group, 'Cooling fins', [0.66, 1.9, 0], 15, 60);
  addCallout(exteriorCallouts, group, 'Crankcase', [0.72, 0.9, 0], -25, 62);
  addCallout(exteriorCallouts, group, 'Flywheel', [0, 0.85, 1.0], -60, 56);
  addCallout(exteriorCallouts, group, 'Spark plug', [0, HEAD_Y + 1.2, 0], 90, 40);

  addCallout(internalCallouts, group, 'Camshaft', [-0.46, HEAD_Y + 0.62, 0], 135, 56);
  addCallout(internalCallouts, group, 'Intake valve', [-0.28, HEAD_Y + 0.18, 0], 150, 58);
  addCallout(internalCallouts, group, 'Exhaust valve', [0.28, HEAD_Y + 0.18, 0], 30, 58);
  addCallout(internalCallouts, piston, 'Piston', [PISTON_R, 0.1, 0], 25, 54);
  addCallout(internalCallouts, conRod, 'Connecting rod', [-0.1, L * 0.5, 0], 150, 60);
  addCallout(internalCallouts, crank, 'Crankshaft', [0, -0.16, 0.32], -35, 60);

  // live readout (#17): names the stroke happening RIGHT NOW + the crank angle,
  // updated every frame from setCycle. The sole label on the mechanism/run
  // steps (the static callouts are off there), so it reads as a clean HUD.
  const strokeReadout = callout('—', { dir: 18, len: 96, key: 'stroke-readout' });
  strokeReadout.position.set(0.2, HEAD_Y - 0.12, 0);
  strokeReadout.visible = false;
  group.add(strokeReadout);
  const STROKES = ['INTAKE', 'COMPRESSION', 'POWER', 'EXHAUST'];

  const chargeColors = {
    intake: new THREE.Color(0x5ec1ff),
    compressed: new THREE.Color(0x9fe0ff),
    burn: new THREE.Color(0xff8a3d),
    exhaust: new THREE.Color(0x8d939c),
  };

  let revealed = false;
  let labelsOn = false;

  function refreshLabels() {
    for (const c of exteriorCallouts) c.visible = labelsOn && !revealed;
    for (const c of internalCallouts) c.visible = labelsOn && revealed;
  }

  // 0 = solid finished engine, 1 = shell lifted off, mechanism exposed.
  function setReveal(t) {
    revealed = clamp01(t) > 0.5;
    for (const o of shellMeshes) o.visible = !revealed;
    for (const o of internalMeshes) o.visible = revealed;
    if (!revealed) charge.material.opacity = 0;
    strokeReadout.visible = revealed;
    refreshLabels();
  }

  // Positions every moving part for a crank-cycle angle (0–720°).
  function setCycle(cycleDeg) {
    const cycle = ((cycleDeg % 720) + 720) % 720;
    const theta = deg(cycle); // crank spins continuously

    // live readout: which of the four strokes is happening + the crank angle
    if (revealed) strokeReadout.setText(`${STROKES[Math.floor(cycle / 180)]} · ${Math.round(cycle)}°`);

    crank.rotation.z = -theta;

    const pinYNow = pistonY(theta);
    piston.position.y = pinYNow;

    const px = R * Math.sin(theta);
    const py = CRANK_Y + R * Math.cos(theta);
    conRod.position.set(px, py, 0);
    conRod.rotation.z = Math.asin((R * Math.sin(theta)) / L);

    const intakeLift = lift(cycle, INTAKE[0], INTAKE[1]);
    const exhaustLift = lift(cycle, EXHAUST[0], EXHAUST[1]);
    intakeValve.setLift(intakeLift);
    exhaustValve.setLift(exhaustLift);

    // camshafts turn at HALF crank speed; the lobe nose points straight down at
    // the valve exactly at peak lift. Over one 720° lap the cam turns 360° →
    // seamless.
    intakeCam.setAngle(Math.PI - deg((cycle - INTAKE_PEAK) * 0.5));
    exhaustCam.setAngle(Math.PI - deg((cycle - EXHAUST_PEAK) * 0.5));

    // charge volume between piston crown and head
    const top = pinYNow + 0.28;
    charge.position.y = top;
    charge.scale.y = Math.max(HEAD_Y - top, 0.02);

    const mat = charge.material;
    let opacity;
    if (cycle < 180) {
      mat.color.copy(chargeColors.intake);
      opacity = 0.5 * clamp01(cycle / 60);
    } else if (cycle < 345) {
      mat.color.lerpColors(chargeColors.intake, chargeColors.compressed, (cycle - 180) / 165);
      opacity = 0.5 + 0.25 * ((cycle - 180) / 165);
    } else if (cycle < 540) {
      mat.color.copy(chargeColors.burn);
      opacity = 0.85 - 0.4 * clamp01((cycle - 375) / 165);
    } else {
      mat.color.lerpColors(chargeColors.burn, chargeColors.exhaust, clamp01((cycle - 540) / 60));
      opacity = 0.5 * (1 - clamp01((cycle - 560) / 160));
    }

    // spark + fireball from just before TDC through early expansion. Intensity
    // capped at 20, not the ~60 it was: the plug sits a hair above the piston
    // crown, and at that near-zero distance a physically-correct inverse-
    // square point light blows any nearby metal (and the co-located glow
    // sphere itself) into a fully clipped white disc rather than a bright
    // specular highlight — dialed back to where the flash still reads as
    // dramatic without crushing the piston.
    const spark = cycle > 345 && cycle < 430 ? Math.sin(Math.PI * ((cycle - 345) / 85)) : 0;
    sparkLight.intensity = revealed ? spark * 20 : 0;
    plugTip.material.opacity = revealed ? spark : 0;
    plugTip.scale.setScalar(0.6 + spark * 2.2);
    if (spark > 0.2) {
      mat.color.lerpColors(chargeColors.burn, new THREE.Color(0xffe6b0), spark);
      opacity = Math.max(opacity, 0.6 + spark * 0.35);
    }
    mat.opacity = revealed ? opacity : 0;

    // flow arrows ride the runner → valve path while the valve is open
    const flowT = (cycle * 2.2) % 100;
    intakeFlow.userData.arrows.forEach((a, i) => {
      const t = ((flowT + i * 33) % 100) / 100; // runner (t0) → chamber (t1)
      a.position.set(-0.5 + 0.34 * t, HEAD_Y + 0.4 - 0.52 * t, 0);
      a.material.opacity = revealed && intakeLift > 0.01 ? 0.9 * Math.sin(Math.PI * t) : 0;
    });
    exhaustFlow.userData.arrows.forEach((a, i) => {
      const t = ((flowT + i * 33) % 100) / 100; // chamber (t0) → runner out (t1)
      a.position.set(0.16 + 0.34 * t, HEAD_Y - 0.1 + 0.5 * t, 0);
      a.material.opacity = revealed && exhaustLift > 0.01 ? 0.9 * Math.sin(Math.PI * t) : 0;
    });
  }

  setReveal(0);
  setCycle(0);

  return {
    group,
    setCycle,
    setReveal,
    setLabels(visible) {
      labelsOn = visible;
      refreshLabels();
    },
  };
}
