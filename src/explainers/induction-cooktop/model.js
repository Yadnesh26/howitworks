import * as THREE from 'three';
import { materials, disc, rod, studioPlinth } from '../../framework/parts.js';
// `coil` aliased: this file already owns a const named `coil` (the litz spiral),
// and a duplicate identifier blanks the dev server with no console output.
import { beveledBox, tubeAlong, finStack, coil as helix } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, TAU } from '../../framework/motion.js';

// A portable single-zone induction hob with a clad steel frying pan on it,
// staged as a product shot. The whole mechanism is invisible in the real
// object — there is no element, no flame, nothing that glows — so the reveal
// ghosts the glass-ceramic top and the shell to expose the flat litz coil,
// the ferrite bars and the power board, and the physics is drawn as flow.
//
// MECHANISM (researched):
//   mains 50/60 Hz -> bridge rectifier -> ~325 V DC bus (filter capacitor) ->
//   IGBT half-bridge + resonant capacitor chopping it back to AC at 20-50 kHz
//   (we quote ~25 kHz, deliberately above hearing). That current runs through
//   a flat spiral "pancake" coil of LITZ wire (hundreds of individually
//   varnished strands, so the wire doesn't cook itself via skin effect),
//   ~180 mm across, ~22 turns, with radial ferrite bars underneath aiming the
//   flux upward. Glass-ceramic is non-magnetic and non-conducting, so the
//   field passes through the worktop untouched and into the ferromagnetic
//   base of the pan. There it drives EDDY CURRENTS — closed loops of current
//   concentric with the coil — and the steel's own resistance turns them into
//   heat. Iron's high permeability makes the skin depth tiny, so essentially
//   all of it lands in the outer ~0.1 mm of the pan base; magnetic HYSTERESIS
//   (re-magnetising the iron 25,000 times a second) adds more. The pan IS the
//   element: the glass only gets warm by conduction back down from it.
//   Lift the pan and the coil's load vanishes — load sensing sees it within
//   about a second and shuts the zone off. ~85% of wall energy reaches the
//   food, vs ~70% radiant electric and ~40% gas.
//   Sources: explainthatstuff.com/induction-cooktops.html,
//   electronicdesign.com (coil/pan characteristics), Infineon AN2014-01
//   reverse-conducting IGBT app note, allaboutcircuits teardown.
//
// SCALARS the pose is built from:
//   setReveal(t)  — 0 sealed appliance / 1 glass + shell ghosted, coil,
//                   ferrite, thermistor, fan and power board exposed.
//                   Clearcoat is zeroed while ghosted (coat specular is
//                   opacity-independent), metal shells drop their metalness.
//   setPanCut(t)  — 0 whole pan / 1 a 140-degree wedge removed, so the base
//                   cross-section, the eddy-current rings and the hot skin
//                   read from outside. A real cutaway, not a ghost: metal
//                   never ghosts convincingly.
//   setPhase(u)   — master 0-1 loop phase. Rides current dots along the power
//                   path and the coil spiral, energy dots around the flux
//                   loops, eddy dots around the rings in the pan base, spins
//                   the cooling fan whole turns, and breathes every emissive
//                   on whole sine cycles. Everything wraps mod 1.
//   setHeat(t)    — 0-1 heat in the pan base (base-plate emissive + hot-skin
//                   lamina + eddy brightness).
//   setLift(u)    — pan lifted clear of the glass (purely geometric; also used
//                   to park the pan overhead for the internal steps).
//   setPower(t)   — 1 zone energised / 0 load sensing has cut it: collapses
//                   the field, stops every flow, kills the heat and drops the
//                   readout to "----". Step 6 drives lift and power together
//                   off the same phase, which is what a real hob does.
//   showField(on) — flux loops + their dots.
//   setLabels(mode) — 'exterior' | 'coil' | 'power' | 'field' | 'heat' |
//                   'detect' | false
//
// PROPORTIONS — 1 world unit = 110 mm, every constant below derives from it.
//   hob 340 x 385 x 60 mm · zone ring 264 mm · coil 180 mm o.d. / 40 mm i.d.
//   pan base 220 mm, 5 mm thick, wall 92 mm tall, handle 165 mm.
//   Target ratios: pan base : hob width = 0.65 · coil : pan base = 0.82 ·
//   hob height : hob width = 0.16 (it is a slab, and should read as one).

const PLINTH_H = 0.24;

// --- hob body ---------------------------------------------------------------
const BODY_W = 3.1;
const BODY_D = 3.5;
const BODY_H = 0.43;
const FOOT_H = 0.045;
const GLASS_T = 0.06;
const GLASS_Y = FOOT_H + BODY_H + GLASS_T / 2; // 0.505
const TOP_Y = FOOT_H + BODY_H + GLASS_T; // 0.535 — top face of the glass
const CAVITY_TOP = FOOT_H + BODY_H; // 0.475 — underside of the glass

// --- cooking zone -----------------------------------------------------------
const ZONE_Z = -0.42; // zone sits toward the back, controls at the front
const ZONE_RING_R = 1.26; // printed ring, 277 mm — wider than the pan so it reads
const COIL_RIN = 0.18;
const COIL_ROUT = 0.82;
const COIL_TURNS = 22;
const WIRE_R = 0.013;
const COIL_Y = 0.375;
const FERRITE_Y = 0.318;

// --- pan (local y = 0 at the underside of its base) -------------------------
const PAN_Y = TOP_Y + 0.004;
const PLATE_R = 0.95; // bonded magnetic stainless disc
const PLATE_T = 0.016;
// A skillet, not a bowl: wide flat base, low wall, only a slight flare.
// 216 mm flat base · 243 mm across the rim · 37 mm wall · 4.8 mm base —
// wall:diameter 0.15, which is what stops it reading as a mixing bowl.
const PAN_PROFILE = [
  [0.0, 0.0],
  [0.98, 0.0],
  [1.02, 0.022],
  [1.035, 0.06],
  [1.07, 0.29],
  [1.1, 0.325],
  [1.105, 0.335],
  [1.075, 0.341],
  [1.05, 0.327],
  [1.04, 0.29],
  [1.005, 0.06],
  [0.98, 0.048],
  [0.9, 0.044],
  [0.0, 0.044],
];
// Cut-face polygon = the pan profile with the bonded plate added below, so the
// sectioned view shows the real sandwich: plate, base, wall.
// (slice(1): PAN_PROFILE's leading [0,0] would send the outline back to the
// axis mid-way and make the polygon self-intersect)
const CUT_POLY = [
  [0.0, -PLATE_T],
  [PLATE_R, -PLATE_T],
  [PLATE_R, 0.0],
  ...PAN_PROFILE.slice(1),
];
// Lathe phi: 0 = +z, growing toward +x — so world azimuth = 90° - phi.
// The 90° wedge we remove is centred on phi 40° (world azimuth 50°), which is
// exactly where the cutaway step's camera stands; the handle sits 20° clear of
// the kept edge so it never floats detached.
const CUT_PHI_START = THREE.MathUtils.degToRad(85);
const CUT_PHI_LEN = THREE.MathUtils.degToRad(270);
const HANDLE_PHI = THREE.MathUtils.degToRad(105);

// --- power board ------------------------------------------------------------
// The power board sits BEHIND the control area, not under it: at z=1.05 it
// projected straight through the touch-electrode board in step 3's view.
const BOARD_Z = 0.88;
const BOARD_Y = 0.13;

const CURRENT = 0xffb347; // amber — electric current
const EDDYCOL = 0xffe9a8; // pale gold — induced current, against the gold coil
const FIELDCOL = 0x3fd8e8; // cyan — magnetic field (accent)
const HEATCOL = 0xff5a1e; // orange — heat in the steel

export function buildCooktop({ scene }) {
  const sceneGroup = new THREE.Group();
  scene.add(sceneGroup);
  sceneGroup.add(studioPlinth({ w: 4.0, h: PLINTH_H, d: 4.1 }));

  // Everything below is authored with y=0 at the plinth's top face.
  const rig = new THREE.Group();
  rig.position.y = PLINTH_H;
  sceneGroup.add(rig);

  // ============================================================================
  //  MATERIALS
  // ============================================================================
  const shellMat = materials.paintedMetal(0x2a2e34);
  shellMat.clearcoat = 0.55;
  shellMat.clearcoatRoughness = 0.28;
  // NOTE on every steel/aluminium preset below: their roughnessMap MULTIPLIES
  // base roughness (map texels ~0.5), so a base of 0.6 renders near 0.3 and
  // clips to white on big curved surfaces. Bases here are set ~1.0 on purpose.
  const trimMat = materials.brushedSteel(0xaeb6c0);
  trimMat.roughness = 1.0;
  const footMat = materials.rubber(0x17191d);
  // Glass-ceramic is glossy, but at mirror roughness the key light's specular
  // clips to a white blob on the worktop — this is as sharp as it can go.
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a0c10,
    metalness: 0.04,
    roughness: 0.5,
    clearcoat: 0.3,
    clearcoatRoughness: 0.3,
  });
  const printMat = new THREE.MeshStandardMaterial({
    color: 0x767c85,
    roughness: 0.85,
    metalness: 0.05,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });

  const panMat = materials.brushedSteel(0x9aa1a9);
  panMat.roughness = 1.0; // a pan's concave interior is a mirror at preset roughness
  const plateMat = materials.steel(0x8d939c);
  plateMat.roughness = 0.66;
  const coreMat = materials.aluminum(0xd6cfc2); // warmer + lighter than the
  coreMat.roughness = 1.0; // stainless around it, so the layers read apart
  const cutFaceMat = new THREE.MeshStandardMaterial({
    color: 0x7d848d,
    roughness: 0.85,
    metalness: 0.55,
    side: THREE.DoubleSide,
  });
  // stainless, like the pan — a black handle vanished against the backdrop and
  // read as a stray cable
  const handleMat = materials.brushedSteel(0xa8aeb6);
  handleMat.roughness = 1.0;

  const litzMat = new THREE.MeshPhysicalMaterial({
    color: 0xd0a052, // varnished copper bundle, not bare copper
    metalness: 0.85,
    roughness: 0.42,
  });
  const ferriteMat = materials.darkMetal(0x4b5158); // dark, but not so dark it
  ferriteMat.roughness = 0.8; // disappears into the unlit cavity
  const micaMat = materials.polymer(0x4a4034);
  const boardMat = materials.paintedMetal(0x17402c);
  boardMat.roughness = 0.62;
  boardMat.clearcoat = 0.2;
  const heatsinkMat = materials.aluminum(0xa4acb6);
  heatsinkMat.roughness = 1.0; // stacked fins clip to white at preset roughness
  const canMat = materials.paintedMetal(0x15171b);
  const filmCapMat = materials.paintedMetal(0x2c4fa6);
  const chipMat = materials.darkMetal(0x24272c);
  const pinMat = materials.chrome(0xcfd4da);
  // chrome spade tabs out in the open under the coil clipped to white — these
  // sit where the field step's low camera can see them, so keep them dull
  const terminalMat = new THREE.MeshStandardMaterial({
    color: 0xa8aeb6,
    metalness: 0.6,
    roughness: 0.8,
  });
  const cordMat = materials.rubber(0x131518);

  const fieldTubeMat = new THREE.MeshStandardMaterial({
    color: FIELDCOL,
    emissive: FIELDCOL,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const hotMat = new THREE.MeshStandardMaterial({
    color: HEATCOL,
    emissive: HEATCOL,
    emissiveIntensity: 1.6,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  // Brighter and whiter than the amber used on the wires: the eddy rings sit
  // directly in front of the gold litz coil and were being swallowed by it.
  const eddyMat = new THREE.MeshStandardMaterial({
    color: EDDYCOL,
    emissive: EDDYCOL,
    emissiveIntensity: 1.2,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const segOnMat = materials.glow(0xff6a2e, 1.2);
  const segOffMat = new THREE.MeshStandardMaterial({
    color: 0x2a1a12,
    roughness: 0.7,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });

  const revealDim = []; // shells that ghost on reveal
  const internals = []; // coil / ferrite / board / fan — only shown revealed
  const cosmetic = []; // printed graphics + small chrome — hidden on reveal

  const rememberGhostOrig = (mat) => {
    if (!mat.userData.ghostOrig) {
      mat.userData.ghostOrig = { clearcoat: mat.clearcoat ?? 0, metalness: mat.metalness ?? 0 };
    }
  };

  // ============================================================================
  //  OUTER SHELL — body, glass-ceramic top, feet, printed graphics
  // ============================================================================
  const body = beveledBox(BODY_W, BODY_H, BODY_D, shellMat, 0.05);
  body.position.y = FOOT_H + BODY_H / 2;
  body.receiveShadow = true;
  rig.add(body);
  revealDim.push(body);

  // stainless band around the bottom edge — the one bright line on a black slab
  const band = beveledBox(BODY_W + 0.012, 0.055, BODY_D + 0.012, trimMat, 0.02);
  band.position.y = FOOT_H + 0.03;
  rig.add(band);
  cosmetic.push(band); // brushed metal never ghosts convincingly — hide it instead

  const glass = beveledBox(BODY_W - 0.08, GLASS_T, BODY_D - 0.08, glassMat, 0.012);
  glass.position.y = GLASS_Y;
  glass.receiveShadow = true;
  rig.add(glass);
  revealDim.push(glass);

  for (const fx of [-1, 1]) {
    for (const fz of [-1, 1]) {
      const foot = disc(0.1, FOOT_H, footMat, 20);
      foot.position.set(fx * (BODY_W / 2 - 0.22), FOOT_H / 2, fz * (BODY_D / 2 - 0.24));
      rig.add(foot);
      revealDim.push(foot);
    }
  }

  // Cooling louvres: intake on the left flank beside the blower, exhaust on the
  // right. A sealed box with a fan inside it would be a lie — this hob moves
  // ~15 m³/h of air over the IGBT heatsink, and you can hear it.
  const ventMat = materials.darkMetal(0x14161a);
  ventMat.roughness = 0.9;
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const slot = beveledBox(0.03, 0.05, 0.3, ventMat, 0.008);
      slot.position.set(sx * (BODY_W / 2 - 0.004), 0.155, -0.95 + i * 0.24);
      rig.add(slot);
      cosmetic.push(slot);
    }
  }

  // printed zone ring + four alignment ticks, screened onto the glass
  const zoneRing = new THREE.Mesh(new THREE.TorusGeometry(ZONE_RING_R, 0.012, 10, 96), printMat);
  zoneRing.rotation.x = Math.PI / 2;
  zoneRing.position.set(0, TOP_Y + 0.002, ZONE_Z);
  rig.add(zoneRing);
  cosmetic.push(zoneRing);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.006, 0.03), printMat);
    tick.position.set(
      Math.cos(a) * (ZONE_RING_R + 0.1),
      TOP_Y + 0.002,
      ZONE_Z + Math.sin(a) * (ZONE_RING_R + 0.1),
    );
    tick.rotation.y = -a;
    rig.add(tick);
    cosmetic.push(tick);
  }

  // ---- control panel: 4-digit power readout + touch slider ------------------
  // Segment layout in the glass plane: local +x is the digit's reading
  // direction, local -z is "up" — so it reads right-way-up to someone standing
  // at the front of the hob (+z), like every real appliance.
  const DIGIT_W = 0.12;
  const DIGIT_H = 0.22;
  const DISPLAY_Z = 1.05;
  const segH = new THREE.BoxGeometry(DIGIT_W * 0.78, 0.008, 0.022);
  const segV = new THREE.BoxGeometry(0.022, 0.008, DIGIT_H * 0.42);
  const SEG_POS = {
    a: [0, -DIGIT_H / 2, segH],
    g: [0, 0, segH],
    d: [0, DIGIT_H / 2, segH],
    f: [-DIGIT_W / 2, -DIGIT_H / 4, segV],
    b: [DIGIT_W / 2, -DIGIT_H / 4, segV],
    e: [-DIGIT_W / 2, DIGIT_H / 4, segV],
    c: [DIGIT_W / 2, DIGIT_H / 4, segV],
  };
  const GLYPHS = {
    0: 'abcdef',
    1: 'bc',
    2: 'abged',
    3: 'abgcd',
    4: 'fgbc',
    5: 'afgcd',
    6: 'afgecd',
    7: 'abc',
    8: 'abcdefg',
    9: 'abcdfg',
    '-': 'g',
  };
  // The readout is printed on the glass, so it gets its own toggle rather than
  // riding `cosmetic`: the load-sensing step needs it while the top is ghosted,
  // but the internal steps must not leave orange segments floating in mid-air.
  const displayGroup = new THREE.Group();
  rig.add(displayGroup);
  const digits = [];
  for (let i = 0; i < 4; i++) {
    const dg = { segs: {} };
    for (const [name, [sx, sz, geo]] of Object.entries(SEG_POS)) {
      const m = new THREE.Mesh(geo, segOffMat);
      m.position.set(-0.225 + i * 0.15 + sx, TOP_Y + 0.004, DISPLAY_Z + sz);
      displayGroup.add(m);
      dg.segs[name] = m;
    }
    digits.push(dg);
  }

  const sliderTrack = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.005, 0.05), printMat);
  sliderTrack.position.set(0, TOP_Y + 0.002, DISPLAY_Z + 0.42);
  rig.add(sliderTrack);
  cosmetic.push(sliderTrack);
  for (let i = 0; i < 9; i++) {
    const tick = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.005, 12), printMat);
    tick.position.set(-0.44 + i * 0.11, TOP_Y + 0.003, DISPLAY_Z + 0.42);
    rig.add(tick);
    cosmetic.push(tick);
  }
  const pwrIcon = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.009, 8, 28), printMat);
  pwrIcon.rotation.x = Math.PI / 2;
  pwrIcon.position.set(-0.78, TOP_Y + 0.003, DISPLAY_Z + 0.42);
  rig.add(pwrIcon);
  cosmetic.push(pwrIcon);

  // mains cord leaving the back — the detail that says "appliance", not "prop"
  const cord = tubeAlong(
    [
      [-0.95, 0.2, -BODY_D / 2 + 0.02],
      [-0.98, 0.19, -BODY_D / 2 - 0.35],
      [-1.15, 0.09, -BODY_D / 2 - 0.72],
      [-1.55, 0.05, -BODY_D / 2 - 0.95],
    ],
    0.038,
    cordMat,
    { tubularSegments: 60, radialSegments: 10 },
  );
  rig.add(cord);
  const grommet = disc(0.07, 0.12, footMat, 18);
  grommet.rotation.x = Math.PI / 2;
  grommet.position.set(-0.95, 0.2, -BODY_D / 2 + 0.01);
  rig.add(grommet);
  revealDim.push(grommet);

  // ============================================================================
  //  THE COIL — flat litz spiral, ferrite bars, mica spider, thermistor
  // ============================================================================
  const zone = new THREE.Group();
  zone.position.set(0, 0, ZONE_Z);
  rig.add(zone);

  const spiralPts = [];
  const N = 24 * COIL_TURNS;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = t * COIL_TURNS * TAU;
    const r = COIL_ROUT + (COIL_RIN - COIL_ROUT) * t; // fed at the rim, winds inward
    spiralPts.push([Math.cos(a) * r, COIL_Y, Math.sin(a) * r]);
  }
  const coil = tubeAlong(spiralPts, WIRE_R, litzMat, {
    tubularSegments: 1400,
    radialSegments: 8,
  });
  zone.add(coil);
  internals.push(coil);

  // return lead: the inner end of the spiral has to get back out somehow
  const returnLead = tubeAlong(
    [
      [Math.cos(COIL_TURNS * TAU) * COIL_RIN, COIL_Y, 0],
      [0.1, COIL_Y - 0.05, 0.12],
      [0.55, COIL_Y - 0.06, 0.5],
      [0.86, COIL_Y - 0.06, 0.85],
    ],
    WIRE_R * 0.9,
    litzMat,
    { tubularSegments: 60, radialSegments: 8 },
  );
  zone.add(returnLead);
  internals.push(returnLead);

  // Six ferrite bars pointing outward like spokes, under the coil — run them
  // past the coil's rim so they are visible from above instead of buried.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const bar = beveledBox(0.95, 0.055, 0.12, ferriteMat, 0.014);
    bar.position.set(Math.cos(a) * 0.62, FERRITE_Y, Math.sin(a) * 0.62);
    bar.rotation.y = -a;
    zone.add(bar);
    internals.push(bar);
  }
  // mica spider the coil is wound onto
  const spider = new THREE.Mesh(
    new THREE.RingGeometry(COIL_RIN - 0.03, COIL_ROUT + 0.04, 64),
    micaMat,
  );
  spider.rotation.x = Math.PI / 2;
  spider.position.y = COIL_Y - 0.028;
  zone.add(spider);
  internals.push(spider);

  // The support plate the whole assembly is built on: ferrite bars keyed into
  // it, coil former on top, aluminium underside doubling as the shield that
  // stops stray flux reaching the board below.
  const supportPlate = disc(1.12, 0.014, materials.polymer(0x24272c), 72);
  supportPlate.position.y = 0.29;
  zone.add(supportPlate);
  internals.push(supportPlate);
  // map-free on purpose: the aluminum preset's roughnessMap halves the base
  // roughness, and a big flat disc seen edge-on from the field step's low
  // camera then throws a clipped specular streak
  const shieldFoil = disc(
    1.06,
    0.008,
    new THREE.MeshStandardMaterial({ color: 0x8d949c, metalness: 0.55, roughness: 0.85 }),
    72,
  );
  shieldFoil.position.y = 0.278;
  zone.add(shieldFoil);
  internals.push(shieldFoil);
  // three pillars carrying the assembly off the chassis floor
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + Math.PI / 6;
    const post = rod(0.05, 0.24, materials.polymer(0x2a2e34));
    post.position.set(Math.cos(a) * 1.02, FOOT_H, Math.sin(a) * 1.02);
    zone.add(post);
    internals.push(post);
  }

  // Spade terminals where the two coil ends leave the assembly
  for (const [tx, tz] of [
    [COIL_ROUT + 0.06, 0.02],
    [0.84, 0.82],
  ]) {
    const tab = beveledBox(0.09, 0.02, 0.05, terminalMat, 0.006);
    tab.position.set(tx, COIL_Y - 0.04, tz);
    zone.add(tab);
    internals.push(tab);
  }

  // thermistor pressed up against the underside of the glass at the centre
  const thermistor = new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 14), chipMat);
  thermistor.position.y = CAVITY_TOP - 0.045;
  zone.add(thermistor);
  internals.push(thermistor);
  for (let i = 0; i <= 40; i++) {
    // spring holding it up — a stack of thin rings reads as a coil spring
    if (i % 4) continue;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 20), pinMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = COIL_Y - 0.02 + (i / 40) * 0.09;
    zone.add(ring);
    internals.push(ring);
  }

  // ============================================================================
  //  POWER BOARD — rectifier, filter cap, IGBT half-bridge, resonant cap
  // ============================================================================
  const board = beveledBox(2.6, 0.03, 0.9, boardMat, 0.012);
  board.position.set(-0.05, BOARD_Y, BOARD_Z);
  rig.add(board);
  internals.push(board);

  const EMI_X = -1.14; // mains filter, first stage on the board
  const RECT_X = -0.72;
  const CAP_X = -0.24;
  const IGBT_X = 0.4;
  const RESCAP_X = 0.92;

  // ---- mains filter: common-mode choke + X-capacitors + fuse ---------------
  // Chopping 3 kW at 25 kHz throws switching noise straight back at the wall;
  // every hob sold has to filter it out before the rectifier.
  const chokeCore = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.042, 12, 32), ferriteMat);
  chokeCore.rotation.x = Math.PI / 2;
  chokeCore.position.set(EMI_X, BOARD_Y + 0.07, BOARD_Z - 0.06);
  rig.add(chokeCore);
  internals.push(chokeCore);
  for (const ph of [0.35, Math.PI + 0.35]) {
    const winding = helix(
      {
        turns: 9,
        radius: 0.052,
        toroidal: true,
        majorRadius: 0.11,
        majorSpan: Math.PI * 0.78,
        phase: ph,
        segmentsPerTurn: 16,
      },
      litzMat,
    );
    winding.mesh.rotation.x = Math.PI / 2;
    winding.mesh.position.set(EMI_X, BOARD_Y + 0.07, BOARD_Z - 0.06);
    rig.add(winding.mesh);
    internals.push(winding.mesh);
  }
  for (const dx of [-0.2, 0.2]) {
    const xCap = beveledBox(0.16, 0.16, 0.06, filmCapMat, 0.015);
    xCap.position.set(EMI_X + dx, BOARD_Y + 0.09, BOARD_Z + 0.24);
    rig.add(xCap);
    internals.push(xCap);
  }
  const fuseBody = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.19, 16), micaMat);
  fuseBody.rotation.z = Math.PI / 2;
  fuseBody.position.set(EMI_X, BOARD_Y + 0.06, BOARD_Z + 0.4);
  rig.add(fuseBody);
  internals.push(fuseBody);
  for (const dx of [-0.1, 0.1]) {
    const clip = beveledBox(0.035, 0.06, 0.06, pinMat, 0.008);
    clip.position.set(EMI_X + dx, BOARD_Y + 0.05, BOARD_Z + 0.4);
    rig.add(clip);
    internals.push(clip);
  }

  const rectifier = beveledBox(0.2, 0.16, 0.2, chipMat, 0.02);
  rectifier.position.set(RECT_X, BOARD_Y + 0.09, BOARD_Z - 0.02);
  rig.add(rectifier);
  internals.push(rectifier);
  for (let i = 0; i < 4; i++) {
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.06, 0.018), pinMat);
    pin.position.set(RECT_X - 0.06 + i * 0.04, BOARD_Y + 0.02, BOARD_Z + 0.13);
    rig.add(pin);
    internals.push(pin);
  }

  const filterCap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.3, 28), canMat);
  filterCap.position.set(CAP_X, BOARD_Y + 0.16, BOARD_Z);
  rig.add(filterCap);
  internals.push(filterCap);
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.012, 28), pinMat);
  capTop.position.set(CAP_X, BOARD_Y + 0.312, BOARD_Z);
  rig.add(capTop);
  internals.push(capTop);

  const heatsink = finStack(
    { count: 6, size: 0.15, thickness: 0.022, gap: 0.028, shape: 'square' },
    heatsinkMat,
  );
  heatsink.position.set(IGBT_X, BOARD_Y + 0.03, BOARD_Z);
  rig.add(heatsink);
  heatsink.traverse((o) => o.isMesh && internals.push(o));
  // two IGBTs bolted to the front face of the heatsink — the half-bridge
  for (const dx of [-0.075, 0.075]) {
    const pack = beveledBox(0.11, 0.16, 0.04, chipMat, 0.008);
    pack.position.set(IGBT_X + dx, BOARD_Y + 0.13, BOARD_Z + 0.17);
    rig.add(pack);
    internals.push(pack);
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.09, 0.014), pinMat);
      leg.position.set(IGBT_X + dx - 0.03 + i * 0.03, BOARD_Y + 0.03, BOARD_Z + 0.17);
      rig.add(leg);
      internals.push(leg);
    }
  }

  const resCap = beveledBox(0.34, 0.24, 0.12, filmCapMat, 0.02);
  resCap.position.set(RESCAP_X, BOARD_Y + 0.13, BOARD_Z - 0.05);
  rig.add(resCap);
  internals.push(resCap);

  // second thermistor, clamped to the heatsink — the one under the glass
  // watches the pan, this one watches the IGBTs
  const ntcBead = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), chipMat);
  ntcBead.position.set(IGBT_X - 0.185, BOARD_Y + 0.15, BOARD_Z);
  rig.add(ntcBead);
  internals.push(ntcBead);
  for (const dz of [-0.03, 0.03]) {
    const ntcLeg = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.13, 0.012), pinMat);
    ntcLeg.position.set(IGBT_X - 0.185, BOARD_Y + 0.08, BOARD_Z + dz);
    rig.add(ntcLeg);
    internals.push(ntcLeg);
  }

  const mcu = beveledBox(0.22, 0.035, 0.22, chipMat, 0.006);
  mcu.position.set(0.05, BOARD_Y + 0.03, BOARD_Z + 0.3);
  rig.add(mcu);
  internals.push(mcu);
  for (let i = 0; i < 7; i++) {
    const smd = beveledBox(0.05, 0.025, 0.03, canMat, 0.005);
    smd.position.set(-0.55 + i * 0.16, BOARD_Y + 0.028, BOARD_Z + 0.36);
    rig.add(smd);
    internals.push(smd);
  }

  // ---- capacitive touch electrodes ------------------------------------------
  // Why there are no buttons: copper pads pressed against the underside of the
  // glass sense the change in capacitance when a finger lands above them. The
  // glass is the insulator that makes the sensor work, not an obstacle to it.
  // Kept visually subordinate — no step's copy names it, so it must read as
  // more circuitry, not as five mystery gold coins floating over the board.
  // matte, not paintedMetal: a near-black glossy slab this size mirrors the key
  // light into a clipped white blob (bisected with a readPixels probe)
  const touchBoard = beveledBox(
    1.0,
    0.014,
    0.18,
    new THREE.MeshStandardMaterial({ color: 0x151a20, roughness: 0.88, metalness: 0.1 }),
    0.006,
  );
  touchBoard.position.set(0, CAVITY_TOP - 0.032, DISPLAY_Z + 0.42);
  rig.add(touchBoard);
  internals.push(touchBoard);
  const padMat = materials.paintedMetal(0x6b5430);
  padMat.roughness = 0.8;
  for (let i = 0; i < 5; i++) {
    const pad = disc(0.032, 0.005, padMat, 18);
    pad.position.set(-0.4 + i * 0.2, CAVITY_TOP - 0.022, DISPLAY_Z + 0.42);
    rig.add(pad);
    internals.push(pad);
  }
  const ribbon = tubeAlong(
    [
      [-0.5, CAVITY_TOP - 0.04, DISPLAY_Z + 0.42],
      [-0.62, 0.32, DISPLAY_Z + 0.36],
      [-0.4, 0.2, DISPLAY_Z + 0.3],
      [0.02, BOARD_Y + 0.06, DISPLAY_Z + 0.3],
    ],
    0.022,
    materials.polymer(0x9a7a3a),
    { tubularSegments: 60, radialSegments: 8 },
  );
  rig.add(ribbon);
  internals.push(ribbon);

  // ---- cooling fan ----------------------------------------------------------
  const FAN_X = -1.02;
  const FAN_Z = 0.05; // clear of the board's back edge now that it moved back
  const fanHousing = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.055, 12, 40), chipMat);
  fanHousing.rotation.x = Math.PI / 2;
  fanHousing.position.set(FAN_X, 0.26, FAN_Z);
  rig.add(fanHousing);
  internals.push(fanHousing);
  const fanRotor = new THREE.Group();
  fanRotor.position.set(FAN_X, 0.26, FAN_Z);
  rig.add(fanRotor);
  const fanHub = disc(0.09, 0.14, chipMat, 20);
  fanRotor.add(fanHub);
  internals.push(fanHub);
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * TAU;
    const blade = beveledBox(0.2, 0.12, 0.022, materials.polymer(0x2a2e34), 0.008);
    blade.position.set(Math.cos(a) * 0.19, 0, Math.sin(a) * 0.19);
    blade.rotation.y = -a + 0.5;
    fanRotor.add(blade);
    internals.push(blade);
  }

  // ---- the power path: inlet -> board -> coil, one continuous wire ----------
  const powerPath = tubeAlong(
    [
      [-0.95, 0.19, -BODY_D / 2 + 0.02],
      [-1.28, 0.11, -1.1],
      [-1.32, 0.1, 0.0],
      [-1.28, 0.11, 0.72],
      [EMI_X, BOARD_Y + 0.05, BOARD_Z + 0.34],
      [EMI_X + 0.1, BOARD_Y + 0.05, BOARD_Z - 0.04],
      [RECT_X, BOARD_Y + 0.05, BOARD_Z - 0.02],
      [CAP_X, BOARD_Y + 0.05, BOARD_Z],
      [IGBT_X, BOARD_Y + 0.05, BOARD_Z],
      [RESCAP_X, BOARD_Y + 0.05, BOARD_Z - 0.05],
      [1.16, 0.14, 0.55],
      [1.0, 0.2, 0.05],
      [0.86, 0.31, ZONE_Z + 0.85],
      [COIL_ROUT, COIL_Y, ZONE_Z],
    ],
    0.026,
    litzMat,
    { tubularSegments: 240, radialSegments: 8, tension: 0.4 },
  );
  rig.add(powerPath);
  internals.push(powerPath);

  // Current-sense transformer: the coil feed threads through a small toroid,
  // and the controller reads what comes out of it. This is the part that
  // actually detects "no pan" — an unloaded coil draws a different current.
  // Threaded onto the curve itself so it can never drift off the wire.
  const senseAt = 0.84;
  const sensePos = powerPath.userData.curve.getPointAt(senseAt);
  const senseTan = powerPath.userData.curve.getTangentAt(senseAt);
  const senseTx = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.03, 12, 28), ferriteMat);
  senseTx.position.copy(sensePos);
  senseTx.lookAt(sensePos.clone().add(senseTan)); // torus axis is +Z
  rig.add(senseTx);
  internals.push(senseTx);
  const senseWind = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.038, 10, 24), litzMat);
  senseWind.position.copy(sensePos);
  senseWind.quaternion.copy(senseTx.quaternion);
  senseWind.scale.set(1, 1, 0.55);
  rig.add(senseWind);
  internals.push(senseWind);

  // ============================================================================
  //  THE PAN — whole and sectioned, plus the eddy currents inside its base
  // ============================================================================
  const panGroup = new THREE.Group();
  panGroup.position.set(0, PAN_Y, ZONE_Z);
  rig.add(panGroup);

  const latheOf = (phiStart, phiLen) =>
    new THREE.LatheGeometry(
      PAN_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)),
      96,
      phiStart,
      phiLen,
    );

  const panWhole = new THREE.Mesh(latheOf(0, TAU), panMat);
  panWhole.castShadow = true;
  panWhole.receiveShadow = true;
  panGroup.add(panWhole);
  const plateWhole = new THREE.Mesh(
    new THREE.CylinderGeometry(PLATE_R, PLATE_R, PLATE_T, 96),
    plateMat,
  );
  plateWhole.position.y = -PLATE_T / 2;
  plateWhole.castShadow = true;
  panGroup.add(plateWhole);

  const panSector = new THREE.Mesh(latheOf(CUT_PHI_START, CUT_PHI_LEN), panMat);
  panSector.castShadow = true;
  panGroup.add(panSector);
  const plateSector = new THREE.Mesh(
    new THREE.CylinderGeometry(PLATE_R, PLATE_R, PLATE_T, 96, 1, false, CUT_PHI_START, CUT_PHI_LEN),
    plateMat,
  );
  plateSector.position.y = -PLATE_T / 2;
  panGroup.add(plateSector);

  const cutShape = new THREE.Shape();
  CUT_POLY.forEach(([r, y], i) => (i ? cutShape.lineTo(r, y) : cutShape.moveTo(r, y)));
  cutShape.closePath();
  const cutGeo = new THREE.ShapeGeometry(cutShape);
  const cutFaces = [CUT_PHI_START, CUT_PHI_START + CUT_PHI_LEN].map((phi) => {
    const f = new THREE.Mesh(cutGeo, cutFaceMat);
    f.rotation.y = phi - Math.PI / 2;
    panGroup.add(f);
    return f;
  });
  const sectioned = [panSector, plateSector, ...cutFaces];

  // handle: bracket riveted to the wall, then a phenolic stick
  const hx = Math.sin(HANDLE_PHI);
  const hz = Math.cos(HANDLE_PHI);
  const handle = tubeAlong(
    [
      [hx * 1.04, 0.26, hz * 1.04],
      [hx * 1.26, 0.34, hz * 1.26],
      [hx * 1.6, 0.36, hz * 1.6],
      [hx * 1.85, 0.345, hz * 1.85],
      [hx * 1.94, 0.335, hz * 1.94],
    ],
    0.052,
    handleMat,
    { tubularSegments: 90, radialSegments: 14, tension: 0.4 },
  );
  panGroup.add(handle);
  // tubeAlong leaves a flat cut at each end — cap it (no flat cut faces)
  const handleCap = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 12), handleMat);
  handleCap.position.set(hx * 1.94, 0.335, hz * 1.94);
  panGroup.add(handleCap);
  const bracket = beveledBox(0.2, 0.14, 0.06, panMat, 0.02);
  bracket.position.set(hx * 1.06, 0.2, hz * 1.06);
  bracket.rotation.y = HANDLE_PHI;
  panGroup.add(bracket);
  for (const dy of [-0.04, 0.04]) {
    const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), pinMat);
    rivet.position.set(hx * 1.12, 0.2 + dy, hz * 1.12);
    panGroup.add(rivet);
  }
  const hangHole = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.011, 8, 18), pinMat);
  hangHole.rotation.y = HANDLE_PHI + Math.PI / 2;
  hangHole.position.set(hx * 1.9, 0.335, hz * 1.9);
  panGroup.add(hangHole);

  // ---- eddy currents: closed loops concentric with the coil, living inside
  // the outer skin of the base (y just above the bonded plate)
  const eddyGroup = new THREE.Group();
  panGroup.add(eddyGroup);
  const eddyCurves = [];
  for (const r of [0.26, 0.46, 0.66]) {
    const pts = [];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU;
      pts.push([Math.cos(a) * r, 0.008, Math.sin(a) * r]);
    }
    const ring = tubeAlong(pts, 0.016, eddyMat, {
      closed: true,
      tubularSegments: 160,
      radialSegments: 6,
      tension: 0.5,
    });
    eddyGroup.add(ring);
    eddyCurves.push(ring.userData.curve);
  }
  // The hot skin. A glowing rim line at the base edge reads from anywhere
  // ("the bottom is what's hot"); on the two cut faces, a thin sliver at the
  // very underside of the base is literally the outer tenth of a millimetre.
  // r just OUTSIDE the pan's base edge: tucked under the overhanging lip it was
  // invisible from every step camera, which left the sealed finale with no cue
  const hotRim = new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.024, 10, 72), hotMat);
  hotRim.rotation.x = Math.PI / 2;
  hotRim.position.y = -PLATE_T / 2;
  panGroup.add(hotRim);
  const skinGeo = new THREE.BoxGeometry(0.98, 0.013, 0.008);
  skinGeo.translate(0.49, 0, 0);
  const skinSlivers = [CUT_PHI_START, CUT_PHI_START + CUT_PHI_LEN].map((phi) => {
    const s = new THREE.Mesh(skinGeo, hotMat);
    s.rotation.y = phi - Math.PI / 2;
    s.position.y = 0.006;
    panGroup.add(s);
    return s;
  });

  // The clad sandwich, drawn on both cut faces: magnetic stainless underneath
  // (where the heat is made), an aluminium core above it (which spreads that
  // heat sideways so the base cooks evenly), stainless on the cooking side.
  // Steel alone would leave you with a ring-shaped hot spot over the coil.
  const coreGeo = new THREE.BoxGeometry(0.95, 0.021, 0.009);
  coreGeo.translate(0.475, 0, 0);
  const coreBands = [CUT_PHI_START, CUT_PHI_START + CUT_PHI_LEN].map((phi) => {
    const b = new THREE.Mesh(coreGeo, coreMat);
    b.rotation.y = phi - Math.PI / 2;
    b.position.y = 0.0225;
    panGroup.add(b);
    return b;
  });

  // ============================================================================
  //  MAGNETIC FIELD — flux loops from the coil, up through the glass, into the
  //  pan base, spreading and returning outside the coil
  // ============================================================================
  const fieldGroup = new THREE.Group();
  fieldGroup.position.set(0, 0, ZONE_Z);
  rig.add(fieldGroup);
  const loopCurves = [];
  const LOOPS = 8;
  // Stop the flux just UNDER the pan's underside (PAN_Y): routing it through
  // the base sent spline overshoot up into the bowl, which read as scratches.
  const RH = [
    [0.15, 0.3],
    [0.15, 0.52],
    [0.58, 0.522],
    [0.95, 0.508],
    [1.28, 0.4],
    [1.32, 0.29],
    [1.05, 0.235],
    [0.55, 0.23],
  ];
  for (let k = 0; k < LOOPS; k++) {
    const th = (k / LOOPS) * TAU;
    const dx = Math.cos(th);
    const dz = Math.sin(th);
    const pts = RH.map(([r, y]) => [dx * r, y, dz * r]);
    const tube = tubeAlong(pts, 0.012, fieldTubeMat, {
      closed: true,
      tubularSegments: 150,
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
    function update(phase, on, dir = 1, alpha = 0.95) {
      dots.forEach((d, i) => {
        if (!on) {
          d.material.opacity = 0;
          return;
        }
        const t = (((dir * phase + i / count) % 1) + 1) % 1;
        d.position.copy(curve.getPointAt(t));
        d.material.opacity = alpha;
      });
    }
    return { dots, update };
  }

  const coilFlow = flowDots(coil.userData.curve, 26, CURRENT, 0.026, zone);
  const busFlow = flowDots(powerPath.userData.curve, 20, CURRENT, 0.03, rig);
  const fieldFlows = loopCurves.map((c) => flowDots(c, 4, FIELDCOL, 0.028, fieldGroup));
  const eddyFlows = eddyCurves.map((c) => flowDots(c, 7, EDDYCOL, 0.032, eddyGroup));

  // ============================================================================
  //  CALLOUTS
  // ============================================================================
  const labels = calloutSets(['exterior', 'coil', 'power', 'field', 'heat', 'detect']);
  labels.add('exterior', rig, 'Glass-ceramic top', [1.2, TOP_Y, 1.5], 40, 96);
  labels.add('exterior', rig, 'Cooking zone', [0.89, TOP_Y, ZONE_Z + 0.89], 15, 104);
  labels.add('exterior', rig, 'Power display', [0.25, TOP_Y, DISPLAY_Z], -25, 118);
  labels.add('exterior', panGroup, 'Steel pan base', [0.95, 0.01, 0.42], -35, 96);

  labels.add('coil', zone, 'Litz-wire coil — 22 turns', [0.62, COIL_Y, 0.55], 45, 104);
  labels.add('coil', zone, 'Ferrite bars', [1.02, FERRITE_Y, -0.1], -30, 92);
  labels.add('coil', zone, 'Thermistor', [0.06, CAVITY_TOP - 0.045, 0.05], 80, 96);
  labels.add('coil', rig, 'Cooling fan', [FAN_X + 0.28, 0.28, FAN_Z], 30, 120);

  labels.add('power', rig, 'Mains filter', [EMI_X, BOARD_Y + 0.12, BOARD_Z - 0.06], 62, 128);
  labels.add('power', rig, 'Bridge rectifier', [RECT_X, BOARD_Y + 0.17, BOARD_Z], 55, 118);
  labels.add('power', rig, 'Filter capacitor', [CAP_X, BOARD_Y + 0.33, BOARD_Z], 80, 72);
  labels.add('power', rig, 'IGBT half-bridge', [IGBT_X, BOARD_Y + 0.24, BOARD_Z + 0.19], 45, 88);
  labels.add('power', rig, 'Resonant capacitor', [RESCAP_X, BOARD_Y + 0.26, BOARD_Z - 0.05], 20, 96);

  labels.add('field', zone, 'Oscillating field · 25 kHz', [0.72, 0.62, 0.3], 42, 100);
  labels.add('field', zone, 'Glass is invisible to magnetism', [0.86, TOP_Y, -0.5], -18, 118);
  labels.add('field', zone, 'Litz-wire coil', [0.5, COIL_Y, 0.62], -48, 92);

  labels.add('heat', panGroup, 'Eddy currents', [0.3, 0.012, 0.35], 80, 110);
  labels.add('heat', panGroup, 'Heat in the outer 0.1 mm', [0.7, 0.006, 0.06], -20, 120);
  labels.add('heat', panGroup, 'Magnetic base plate', [0.48, -PLATE_T, 0.82], -70, 100);
  labels.add('heat', panGroup, 'Aluminium core', [0.52, 0.0225, 0.44], 118, 96);

  labels.add('detect', panGroup, 'No pan — no load', [0.75, 0.3, 0.5], 40, 96);
  labels.add('detect', rig, 'Load sensing cuts the power', [0.3, TOP_Y, DISPLAY_Z - 0.1], 75, 88);
  labels.add('detect', rig, 'Current sensor', [sensePos.x, sensePos.y, sensePos.z], -35, 104);

  // ============================================================================
  //  POSE
  // ============================================================================
  let revealed = false;
  let fieldOn = false;
  let heatAmt = 0;
  let powerAmt = 1;
  let cutAmt = 0;

  function setDigits(text) {
    for (let i = 0; i < 4; i++) {
      const on = GLYPHS[text[i]] ?? '';
      for (const [name, mesh] of Object.entries(digits[i].segs)) {
        mesh.material = on.includes(name) ? segOnMat : segOffMat;
      }
    }
  }

  // Heat, field and readout all hang off whether the zone is energised — one
  // function owns them so no two callers fight over the same emissive.
  function applyPower() {
    const on = clamp01(powerAmt);
    const h = clamp01(heatAmt) * on;
    plateMat.emissive.setHex(HEATCOL);
    plateMat.emissiveIntensity = h * 1.15;
    cutFaceMat.emissive.setHex(HEATCOL);
    cutFaceMat.emissiveIntensity = h * 0.55;
    hotMat.opacity = h * 0.8;
    eddyMat.opacity = (0.25 + h * 0.5) * on;
    fieldGroup.visible = revealed && fieldOn && on > 0.02;
    setDigits(on > 0.5 ? '1800' : '----');
  }

  function setReveal(t) {
    const r = clamp01(t);
    revealed = r > 0.4;
    const ghosted = r > 0.02;
    const op = 1 - r * 0.9; // 1 -> 0.1
    for (const m of revealDim) {
      const mat = m.material;
      rememberGhostOrig(mat);
      const o = mat.userData.ghostOrig;
      mat.transparent = ghosted;
      mat.opacity = op;
      mat.depthWrite = !ghosted;
      mat.clearcoat = ghosted ? 0 : o.clearcoat;
      mat.metalness = ghosted ? o.metalness * 0.15 : o.metalness;
    }
    for (const o of internals) o.visible = revealed;
    for (const o of cosmetic) o.visible = !revealed;
    applyPower();
  }

  function setPanCut(t) {
    cutAmt = clamp01(t);
    const cut = cutAmt > 0.5;
    panWhole.visible = !cut;
    plateWhole.visible = !cut;
    for (const m of sectioned) m.visible = cut;
    eddyGroup.visible = cut;
    for (const s of skinSlivers) s.visible = cut;
    for (const b of coreBands) b.visible = cut;
    applyPower();
  }

  // "take the pan off" — the internal steps show the zone with nothing on it
  function setPanShown(on) {
    panGroup.visible = on;
  }

  function setDisplayShown(on) {
    displayGroup.visible = on;
  }

  function showField(on) {
    fieldOn = on;
    applyPower();
  }

  function setHeat(t) {
    heatAmt = clamp01(t);
    applyPower();
  }

  // purely geometric — the pan lifted clear of the glass
  function setLift(u) {
    panGroup.position.y = PAN_Y + Math.max(0, u);
  }

  // 1 = zone energised, 0 = load sensing has cut it
  function setPower(t) {
    powerAmt = clamp01(t);
    applyPower();
  }

  function setPhase(u) {
    const p = ((u % 1) + 1) % 1;
    const live = revealed && powerAmt > 0.02;
    const a = 0.95 * powerAmt;
    coilFlow.update(p, live, 1, a);
    busFlow.update(p, live, 1, a);
    for (const f of fieldFlows) f.update(p, fieldGroup.visible, 1, a);
    // induced current opposes the driving current — hence dir -1
    for (const f of eddyFlows) f.update(p, eddyGroup.visible && live, -1, a);
    fanRotor.rotation.y = p * TAU * 9; // 9 whole turns per lap

    const breathe = 0.5 + 0.5 * Math.sin(p * TAU * 2); // whole cycles per lap
    fieldTubeMat.emissiveIntensity = 0.45 + breathe * 0.9;
    fieldTubeMat.opacity = (0.32 + breathe * 0.34) * powerAmt;
    eddyMat.emissiveIntensity = 0.9 + breathe * 0.8;
    hotMat.emissiveIntensity = 1.2 + breathe * 0.6;
    segOnMat.emissiveIntensity = 1.5 + breathe * 0.35;
  }

  function setLabels(mode) {
    labels.setLabels(mode);
  }

  // initial: sealed appliance, cooking, no field drawn
  setReveal(0);
  setPanCut(0);
  setPanShown(true);
  setDisplayShown(true);
  showField(false);
  setHeat(0.65);
  setLift(0);
  setPower(1);
  setPhase(0);
  setLabels(false);

  return {
    group: sceneGroup,
    setReveal,
    setPanCut,
    setPanShown,
    setDisplayShown,
    setHeat,
    setLift,
    setPower,
    setPhase,
    showField,
    setLabels,
    parts: { body, glass, panGroup, coil, fanRotor, fieldGroup, board, eddyGroup },
  };
}
