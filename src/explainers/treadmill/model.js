import * as THREE from 'three';
import { materials, box, disc, rod, studioPlinth } from '../../framework/parts.js';
import { beveledBox, lathe, tubeAlong, boltCircle } from '../../framework/geometry.js';
import { clamp01, TAU } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// A folding home treadmill, staged product-shot style on a charcoal plinth.
//
// PROPORTIONS (mid-range 3 HP domestic machine; 1 m -> 1.35 u, and every
// dimension is written through mm() so it stays traceable to the real part):
//   rollers        66.7 mm dia         -> R = 0.045
//   roller centres 1571 mm             -> L = 2.121   (real 1400-1600)
//   deck board     1500 x 660 x 19 mm  -> 2.025 x 0.891 x 0.026
//   running belt    500 mm wide        -> 0.675, drawn ~2x its real 2 mm thick
//   deck height     200 mm             -> belt top plane at y = 0.27
//   console top    1400 mm             -> y = 1.89
//   overall        2050 x 840 mm       -> 2.78 x 1.134
//
// SEAMLESS LOOP — the machine hangs off ONE scalar, `spin` (front-roller angle
// in radians), and the geometry is chosen so a whole number of roller turns is
// also a whole belt loop:
//   L = 15*pi*R  =>  belt inner-surface loop  P = 2L + 2*pi*R = 32*pi*R
//   =>  P / (2*pi*R) = 16 exactly: ONE belt loop = SIXTEEN roller turns.
// Every step advances `spin` by a multiple of 16 turns, so the belt seam, the
// tread texture and both rollers land back on an identical pose. The pulleys
// are exactly 3:1 (0.048 / 0.016), so the motor, shaft and flywheel advance a
// whole 48 turns per 16 roller turns and close too.
//
// `reveal` (0-1) ghosts ONLY moulded polymer — the motor hood and the two side
// foot rails. Nothing metal is ghosted (it never reads as anything but solid),
// so there is nothing to hide outright either.

// --- scale ------------------------------------------------------------------
const U = 1.35; // model units per metre
const mm = (v) => (v / 1000) * U;

// --- belt / rollers ---------------------------------------------------------
const R = 0.045; // roller radius -> 66.7 mm dia
const L = 15 * Math.PI * R; // 2.1206 -> 1571 mm between roller centres
const P = 32 * Math.PI * R; // 4.5239 -> one belt loop = 16 roller turns
const XF = -L / 2; // front (drive) roller centre
const XR = L / 2; // rear (idler) roller centre
const AXIS_Y = 0.225;
const BELT_TOP = AXIS_Y + R; // 0.27 -> 200 mm running-surface height
const BT = 0.006; // belt thickness (~2x real, or it renders as a hairline)
const BELT_HW = mm(480) / 2; // leaves 41 mm of bare roller face each side
const ROLL_HL = 0.365; // roller half length
const CROWN = 0.0035; // drive-roller crown, exaggerated (real: 0.3-0.5 mm)
// barrel clearance under the belt's inner surface: at 0 the two are
// coincident and the steel z-fights straight through the wrap
const ROLL_GAP = 0.0012;
const TREAD_REPEAT = 240; // integer -> the tread texture closes on every lap
const SEAM_S0 = 3.517; // seam phase: puts it on the top run at 30% AND 60%

// --- deck -------------------------------------------------------------------
const DECK_L = mm(1500);
const DECK_HW = mm(660) / 2;
const DECK_T = mm(19);
const DECK_TOP = BELT_TOP - BT;
const DECK_BOT = DECK_TOP - DECK_T;
const SINK_MAX = 0.01; // deck settle under a footstrike (~2x real, legibility)

// --- frame ------------------------------------------------------------------
const RAIL_Z = 0.4275; // side-rail centre line
const RAIL_W = 0.095;
const RAIL_TOP = DECK_BOT - mm(25); // the elastomer cushions live in this gap
const RAIL_BOT = RAIL_TOP - mm(52);
const RAIL_X0 = -1.02; // the rails stop at the front roller; the motor pan is
const RAIL_X1 = 1.2; // forward of them, which is why the drive pulley can sit
const PULLEY_Z = -0.52; // outboard of the frame with nothing in its way
const PUCK_Z = 0.415;
const PIVOT_X = 1.16; // rear feet: the axis the whole frame tilts about
const LIFT_X = -1.3; // lift-jack attachment on the frame
const LIFT_Y = 0.2;
const GRADE_MAX = 0.14; // 0.255 m of jack travel — the top of the real
// 150-250 mm actuator range, and near the 15% ceiling home machines stop at
const THETA_MAX = Math.atan(GRADE_MAX);
const THREAD_TURNS = 17;
const SCREW_LEN = 0.35;
// jack travel per screw turn — equal to the modelled thread pitch, so the
// helix advances exactly as fast as the nut riding it
const SCREW_LEAD = SCREW_LEN / THREAD_TURNS;

// --- motor ------------------------------------------------------------------
const MOT_X = -1.245;
const MOT_Y = 0.175;
const MOT_Z = -0.15;
const MOT_R = mm(125) / 2;
const MOT_HL = mm(190) / 2;
const PR = 0.048; // roller pulley
const MR = 0.016; // motor pulley  -> exactly 3:1
const RATIO = PR / MR;

const ACCENT = 0xa8e05f;

// Belt centre line: arc length s (0..P) -> a point on the belt's INNER surface
// plus its outward normal. Four segments: top run (+x, the way the belt
// carries you backwards), rear wrap, bottom return run, front wrap. The inner
// surface is what touches the rollers, so its length is what the roller angle
// drives.
const S_A = L;
const S_B = L + Math.PI * R;
const S_C = 2 * L + Math.PI * R;
function beltPath(s, out) {
  if (s < S_A) {
    out.x = XF + s;
    out.y = AXIS_Y + R;
    out.nx = 0;
    out.ny = 1;
  } else if (s < S_B) {
    const p = (s - S_A) / R;
    out.x = XR + R * Math.sin(p);
    out.y = AXIS_Y + R * Math.cos(p);
    out.nx = Math.sin(p);
    out.ny = Math.cos(p);
  } else if (s < S_C) {
    const t = s - S_B;
    out.x = XR - t;
    out.y = AXIS_Y - R;
    out.nx = 0;
    out.ny = -1;
  } else {
    const p = (s - S_C) / R;
    out.x = XF - R * Math.sin(p);
    out.y = AXIS_Y - R * Math.cos(p);
    out.nx = -Math.sin(p);
    out.ny = -Math.cos(p);
  }
  return out;
}

// The closed belt as one solid band: four quad strips (outer face, both edges,
// inner face) around 240 stations, with u running the loop exactly once so a
// repeating tread texture wraps seamlessly and scrolls with the belt.
function beltGeometry() {
  const M = 240;
  const pos = [];
  const uv = [];
  const idx = [];
  const p = { x: 0, y: 0, nx: 0, ny: 0 };
  for (let i = 0; i <= M; i++) {
    beltPath((i / M) * P * 0.999999, p);
    const ox = p.x + p.nx * BT;
    const oy = p.y + p.ny * BT;
    const u = i / M;
    pos.push(ox, oy, -BELT_HW, ox, oy, BELT_HW, p.x, p.y, BELT_HW, p.x, p.y, -BELT_HW);
    uv.push(u, 0, u, 1, u, 1, u, 0);
  }
  for (let i = 0; i < M; i++) {
    const a = i * 4;
    const b = (i + 1) * 4;
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      idx.push(a + k, a + k2, b + k2, a + k, b + k2, b + k);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Fine transverse rib pattern. It varies along u only, so the belt's thin edge
// strips (which carry a constant v) sample one clean line rather than garbage.
function treadTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 8;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#b6b6b6';
  ctx.fillRect(0, 0, 128, 8);
  for (let i = 0; i < 128; i += 16) {
    ctx.fillStyle = '#767676';
    ctx.fillRect(i, 0, 5, 8);
    ctx.fillStyle = '#dcdcdc';
    ctx.fillRect(i + 5, 0, 2, 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(TREAD_REPEAT, 1);
  tex.anisotropy = 8;
  return tex;
}

// Soft radial bloom marking where the load lands on the belt.
function loadTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 63);
  g.addColorStop(0, 'rgba(168,224,95,0.92)');
  g.addColorStop(0.4, 'rgba(168,224,95,0.34)');
  g.addColorStop(1, 'rgba(168,224,95,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Console readout, redrawn only when a displayed value actually changes.
function displayTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 132;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const cell = (x, label, value) => {
    ctx.fillStyle = '#606b53';
    ctx.font = '500 19px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, 36);
    ctx.fillStyle = '#8fbf50';
    ctx.font = '700 52px "Segoe UI", sans-serif';
    ctx.fillText(value, x, 94);
  };
  const draw = (speed, grade) => {
    ctx.fillStyle = '#0a0c09';
    ctx.fillRect(0, 0, 512, 132);
    ctx.fillStyle = '#161911';
    ctx.fillRect(6, 6, 500, 120);
    cell(96, 'SPEED km/h', speed.toFixed(1));
    cell(256, 'INCLINE %', grade.toFixed(1));
    cell(416, 'TIME', '12:04');
    tex.needsUpdate = true;
  };
  draw(0, 0);
  return { tex, draw };
}

// Poly-V belt: the convex hull of the two pulleys (inner face sitting on the
// pulley radii, outer face one belt thickness further out), extruded across
// its width. The straight tangent runs fall out of the hull for free.
function vBeltShape(c1, r1, c2, r2, thick) {
  const d = Math.hypot(c2.x - c1.x, c2.y - c1.y);
  const phi = Math.atan2(c2.y - c1.y, c2.x - c1.x);
  const hull = (a, b) => {
    const al = Math.acos((a - b) / d);
    const s = new THREE.Shape();
    s.absarc(c1.x, c1.y, a, phi + al, phi + TAU - al, false);
    s.absarc(c2.x, c2.y, b, phi - al, phi + al, false);
    s.closePath();
    return s;
  };
  const outer = hull(r1 + thick, r2 + thick);
  outer.holes.push(new THREE.Path(hull(r1, r2).getPoints(96)));
  return outer;
}

function pathShape(points, close = true) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p[2] === 'spline') s.splineThru([new THREE.Vector2(p[0], p[1])]);
    else s.lineTo(p[0], p[1]);
  }
  if (close) s.closePath();
  return s;
}

export function buildTreadmill({ scene }) {
  const group = new THREE.Group();
  group.add(studioPlinth({ w: 3.4, h: 0.24, d: 1.62 }));

  // Machine origin sits on the plinth top; the x shift centres the whole
  // silhouette (hood nose, rear cap) on the plinth. The half turn matters: the
  // stage key light comes from +x/+z, so the machine is turned to put its
  // console face, motor bay and drive pulleys on the LIT side — unflipped,
  // every reveal step played out in the rim light's shadow.
  const machine = new THREE.Group();
  machine.position.set(-0.17, 0.24, 0);
  machine.rotation.y = Math.PI;
  group.add(machine);

  // The frame tilts about the rear feet, so everything bolted to it lives
  // under `frame`, which hangs off a pivot group parked on that contact line.
  const pivotGrp = new THREE.Group();
  pivotGrp.position.set(PIVOT_X, 0, 0);
  machine.add(pivotGrp);
  const frame = new THREE.Group();
  frame.position.set(-PIVOT_X, 0, 0);
  pivotGrp.add(frame);

  // --- materials ------------------------------------------------------------
  const alu = materials.aluminum(0xaeb6be);
  alu.roughness = 0.75;
  alu.normalScale.set(0.18, 0.18);
  const steelMat = materials.brushedSteel(0xc0c6ce);
  steelMat.roughness = 0.44;
  const darkMat = materials.darkMetal(0x30353c);
  const boltMat = materials.brushedSteel(0x9aa2ac);
  boltMat.roughness = 0.5;
  const hoodMat = materials.polymer(0x24282e);
  const ventMat = materials.polymer(0x101216);
  const footRailMat = materials.polymer(0x474e57);
  const shellMat = materials.polymer(0x1d2026);
  const puckMat = materials.rubber(0xa8492a);
  puckMat.roughness = 0.72;
  const gripMat = materials.rubber(0x101216);
  const motorMat = materials.paintedMetal(0x2a3038);
  // uprights/handrails are painted dark on real machines — and chrome poles
  // this size throw a blown specular streak straight down the frame
  const postMat = materials.paintedMetal(0x363c44);
  // the frame is powder-coated, not bare extrusion: a mirror-finish rail this
  // long throws a blown specular band straight down every macro shot
  const frameMat = materials.paintedMetal(0x3d434b);
  frameMat.clearcoat = 0.3;
  frameMat.clearcoatRoughness = 0.4;
  frameMat.roughness = 0.58;
  postMat.clearcoat = 0.5;
  postMat.roughness = 0.5;
  const pcbMat = new THREE.MeshPhysicalMaterial({
    color: 0x1b4a33,
    roughness: 0.55,
    metalness: 0.05,
  });
  const mdfMat = new THREE.MeshPhysicalMaterial({
    color: 0xbda57e,
    roughness: 0.82,
    metalness: 0,
  });
  // the running face: near-black phenolic under a satin wax film
  const waxMat = new THREE.MeshPhysicalMaterial({
    color: 0x1f242b,
    roughness: 0.2,
    metalness: 0,
    clearcoat: 0.55,
    clearcoatRoughness: 0.22,
  });
  const tread = treadTexture();
  const beltMat = new THREE.MeshPhysicalMaterial({
    color: 0x24272d,
    map: tread,
    bumpMap: tread,
    bumpScale: 0.004,
    roughness: 0.74,
    metalness: 0,
  });

  // materials that ghost on reveal, with their authored clearcoat remembered
  // (coat specular renders at full strength no matter the opacity)
  const ghostMats = [hoodMat, ventMat, footRailMat];
  for (const gm of ghostMats) gm.userData.coat = gm.clearcoat ?? 0;
  const ghostMeshes = [];

  const labels = calloutSets([
    'exterior',
    'drive',
    'motor',
    'deck',
    'cushion',
    'tracking',
    'incline',
  ]);

  // --- helpers --------------------------------------------------------------
  const discZ = (r, t, mat, seg = 40) => {
    const m = disc(r, t, mat, seg);
    m.geometry.rotateX(Math.PI / 2);
    return m;
  };
  const latheZ = (profile, mat, seg = 40) => {
    const m = lathe(profile, mat, seg);
    m.geometry.rotateX(Math.PI / 2);
    return m;
  };
  const at = (mesh, x, y, z) => {
    mesh.position.set(x, y, z);
    return mesh;
  };
  const anchor = (parent, x, y, z) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };

  // --- frame rails, cross members, motor pan --------------------------------
  const railH = RAIL_TOP - RAIL_BOT;
  const railY = (RAIL_TOP + RAIL_BOT) / 2;
  for (const sz of [-1, 1]) {
    const sideRail = beveledBox(RAIL_X1 - RAIL_X0, railH, RAIL_W, frameMat, 0.008);
    sideRail.receiveShadow = true;
    frame.add(at(sideRail, (RAIL_X0 + RAIL_X1) / 2, railY, sz * RAIL_Z));
  }
  frame.add(at(beveledBox(0.07, railH, RAIL_Z * 2 + RAIL_W, frameMat, 0.008), RAIL_X0 + 0.05, railY, 0));
  frame.add(at(beveledBox(0.07, railH, RAIL_Z * 2 + RAIL_W, frameMat, 0.008), PIVOT_X, railY, 0));
  // Two pans, not one: they close the hood footprint against a low camera but
  // leave a slot down the centre line for the incline jack to reach the floor.
  for (const sz of [-1, 1]) {
    frame.add(at(beveledBox(0.53, 0.03, 0.35, darkMat, 0.01), -1.28, 0.02, sz * 0.345));
  }

  // --- rear feet (the tilt axis) --------------------------------------------
  for (const sz of [-1, 1]) {
    const foot = beveledBox(0.11, RAIL_BOT + 0.01, 0.1, gripMat, 0.02);
    frame.add(at(foot, PIVOT_X, (RAIL_BOT + 0.01) / 2, sz * RAIL_Z));
  }

  // --- rollers --------------------------------------------------------------
  // Crowned: full R across the middle, tapering toward the ends, so the belt
  // always rides the high centre — and the barrel never grows out THROUGH the
  // belt loop, which is built on R exactly.
  function rollerMesh(crown) {
    const prof = [[0, -ROLL_HL], [(R - ROLL_GAP - crown) * 0.86, -ROLL_HL]];
    const N = 16;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const k = 2 * t - 1;
      prof.push([R - ROLL_GAP - crown * k * k, -ROLL_HL + 0.008 + t * (ROLL_HL * 2 - 0.016)]);
    }
    prof.push([(R - ROLL_GAP - crown) * 0.86, ROLL_HL], [0, ROLL_HL]);
    return latheZ(prof, steelMat, 44);
  }
  const frontRoller = rollerMesh(CROWN);
  const rearRoller = rollerMesh(0.0008);
  const frontMount = new THREE.Group();
  frontMount.position.set(XF, AXIS_Y, 0);
  frame.add(frontMount);
  frontMount.add(frontRoller);
  const rearMount = new THREE.Group();
  rearMount.position.set(XR, AXIS_Y, 0);
  frame.add(rearMount);
  rearMount.add(rearRoller);
  for (const mount of [frontMount, rearMount]) {
    for (const sz of [-1, 1]) {
      mount.add(at(discZ(0.012, 0.19, steelMat, 20), 0, 0, sz * (ROLL_HL + 0.06)));
      mount.add(at(beveledBox(0.075, 0.075, 0.05, darkMat, 0.008), 0, 0, sz * (ROLL_HL + 0.055)));
    }
  }

  // --- running belt + deck (these settle together under a footstrike) --------
  const deckSink = new THREE.Group();
  frame.add(deckSink);
  const belt = new THREE.Mesh(beltGeometry(), beltMat);
  belt.castShadow = true;
  belt.receiveShadow = true;
  deckSink.add(belt);
  // the welded seam — the one feature on an otherwise uniform loop, and the
  // reason you can see the belt travel at all
  const seam = box(0.015, 0.003, BELT_HW * 1.98, materials.rubber(0x424852));
  deckSink.add(seam);

  const boardT = DECK_T - mm(2);
  const board = beveledBox(DECK_L, boardT, DECK_HW * 2, mdfMat, 0.004);
  board.receiveShadow = true;
  deckSink.add(at(board, 0, DECK_BOT + boardT / 2, 0));
  const waxFace = beveledBox(DECK_L - 0.002, mm(2), DECK_HW * 2 - 0.002, waxMat, 0.0008);
  waxFace.receiveShadow = true;
  deckSink.add(at(waxFace, 0, DECK_TOP - mm(1), 0));

  // --- elastomer cushions ---------------------------------------------------
  const puckH = DECK_BOT - RAIL_TOP;
  const pucks = [];
  for (const px of [-0.86, -0.29, 0.29, 0.86]) {
    for (const sz of [-1, 1]) {
      const puck = rod(0.025, puckH, puckMat, 18);
      puck.position.set(px, RAIL_TOP, sz * PUCK_Z);
      frame.add(puck);
      pucks.push(puck);
      frame.add(at(disc(0.017, 0.006, boltMat, 16), px, RAIL_TOP - 0.004, sz * PUCK_Z));
    }
  }

  // --- drive: pulleys, poly-V belt, motor -----------------------------------
  function pulleyMesh(radius, mat) {
    const hw = 0.015;
    const prof = [[0, -hw], [radius * 0.55, -hw], [radius, -hw]];
    for (let i = 0; i < 6; i++) {
      const y0 = -hw + 0.002 + (i * (hw * 2 - 0.004)) / 6;
      prof.push([radius, y0], [radius - 0.0035, y0 + 0.0022], [radius, y0 + 0.0044]);
    }
    prof.push([radius, hw], [radius * 0.55, hw], [0, hw]);
    return latheZ(prof, mat, 36);
  }
  const pulleyHub = new THREE.Group();
  pulleyHub.position.set(0, 0, PULLEY_Z);
  frontMount.add(pulleyHub);
  pulleyHub.add(pulleyMesh(PR, darkMat));
  const magnet = box(0.014, 0.016, 0.012, materials.darkMetal(0x1b1d20));
  pulleyHub.add(at(magnet, 0, PR - 0.014, 0.022));

  const motor = new THREE.Group();
  motor.position.set(MOT_X, MOT_Y, MOT_Z);
  frame.add(motor);
  motor.add(
    latheZ(
      [
        [0, -MOT_HL],
        [MOT_R * 0.82, -MOT_HL],
        [MOT_R, -MOT_HL + 0.012],
        [MOT_R, MOT_HL - 0.012],
        [MOT_R * 0.82, MOT_HL],
        [0, MOT_HL],
      ],
      motorMat,
      40,
    ),
  );
  for (const sz of [-1, 1]) {
    motor.add(at(discZ(MOT_R * 0.86, 0.03, alu, 32), 0, 0, sz * (MOT_HL + 0.012)));
    const bolts = boltCircle(6, MOT_R * 0.62, 0.008, boltMat, 0.012);
    bolts.rotation.x = Math.PI / 2;
    motor.add(at(bolts, 0, 0, sz * (MOT_HL + 0.03)));
  }
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    const slot = box(0.006, 0.03, 0.05, materials.darkMetal(0x14161a));
    slot.position.set(Math.cos(a) * MOT_R * 0.99, Math.sin(a) * MOT_R * 0.99, -MOT_HL + 0.05);
    slot.rotation.z = a;
    motor.add(slot);
  }
  for (const sa of [0.5, 0.5 + Math.PI]) {
    const cap = disc(0.016, 0.02, alu, 14);
    cap.position.set(Math.cos(sa) * MOT_R, Math.sin(sa) * MOT_R, MOT_HL - 0.05);
    cap.rotation.z = sa - Math.PI / 2;
    motor.add(cap);
  }
  frame.add(at(beveledBox(0.17, 0.05, 0.3, alu, 0.008), MOT_X, 0.075, MOT_Z));

  const motorShaft = new THREE.Group();
  motor.add(motorShaft);
  motorShaft.add(at(discZ(0.011, 0.4, steelMat, 18), 0, 0, -0.18));
  const flywheel = latheZ(
    [
      [0.012, -0.011],
      [0.101, -0.011],
      [0.101, 0.011],
      [0.012, 0.011],
    ],
    materials.darkMetal(0x4a5058),
    40,
  );
  motorShaft.add(at(flywheel, 0, 0, -0.29));
  const flyHoles = boltCircle(6, 0.062, 0.016, materials.darkMetal(0x14171b), 0.026);
  flyHoles.rotation.x = Math.PI / 2;
  motorShaft.add(at(flyHoles, 0, 0, -0.29));
  motorShaft.add(at(pulleyMesh(MR, darkMat), 0, 0, PULLEY_Z - MOT_Z));

  const vBelt = new THREE.Mesh(
    new THREE.ExtrudeGeometry(
      vBeltShape({ x: XF, y: AXIS_Y }, PR, { x: MOT_X, y: MOT_Y }, MR, 0.008),
      { depth: 0.026, bevelEnabled: false, curveSegments: 44 },
    ),
    materials.rubber(0x191b1f),
  );
  vBelt.castShadow = true;
  frame.add(at(vBelt, 0, 0, PULLEY_Z - 0.013));

  // hall pickup, on a bracket just clear of the magnet's orbit
  const HALL_A = 2.6; // radians round the pulley, up and forward
  const hallX = XF + Math.cos(HALL_A) * 0.055;
  const hallY = AXIS_Y + Math.sin(HALL_A) * 0.055;
  frame.add(at(beveledBox(0.018, 0.09, 0.016, alu, 0.004), hallX - 0.012, hallY - 0.04, -0.482));
  frame.add(at(box(0.016, 0.02, 0.014, materials.polymer(0x101216)), hallX, hallY, -0.482));
  const hallLed = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 10), materials.glow(ACCENT, 1));
  frame.add(at(hallLed, hallX + 0.013, hallY, -0.482));

  // --- motor controller -----------------------------------------------------
  frame.add(at(box(0.24, 0.008, 0.32, pcbMat), -1.41, 0.085, 0.07));
  const heatsink = new THREE.Group();
  frame.add(at(heatsink, -1.41, 0.089, 0.16));
  for (let i = 0; i < 8; i++) {
    heatsink.add(at(box(0.2, 0.055, 0.006, alu), 0, 0.03, -0.035 + i * 0.01));
  }
  heatsink.add(at(box(0.2, 0.012, 0.08, alu), 0, 0.008, -0.005));
  for (const cx of [-0.09, -0.02, 0.05]) {
    frame.add(at(rod(0.019, 0.055, materials.polymer(0x2b3550), 16), -1.41 + cx, 0.089, -0.03));
  }
  for (const lx of [-0.1, -0.06]) {
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.005, 10, 8), materials.glow(ACCENT, 1.2));
    frame.add(at(led, -1.41 + lx, 0.093, 0.02));
  }

  // --- motor hood: a shell (top skin + two full side plates), so the drive
  // bay it covers is genuinely hollow and reads right once it ghosts ---------
  const hoodOuter = [
    [-1.545, 0.02],
    [-1.545, 0.13],
    [-1.45, 0.245, 'spline'],
    [-1.29, 0.305, 'spline'],
    [-1.12, 0.332, 'spline'],
    [-1.02, 0.336, 'spline'],
    [-1.02, 0.288],
    [-1.17, 0.288],
    [-1.17, 0.02],
  ];
  const hoodInner = [
    [-1.531, 0.034],
    [-1.531, 0.136],
    [-1.45, 0.231, 'spline'],
    [-1.29, 0.291, 'spline'],
    [-1.12, 0.318, 'spline'],
    [-1.034, 0.322, 'spline'],
    [-1.034, 0.302],
    [-1.156, 0.302],
    [-1.156, 0.034],
  ];
  const hoodShape = pathShape(hoodOuter);
  hoodShape.holes.push(new THREE.Path(pathShape(hoodInner).getPoints(60)));
  const hood = new THREE.Mesh(
    new THREE.ExtrudeGeometry(hoodShape, {
      depth: 1.106,
      bevelEnabled: false,
      curveSegments: 24,
    }),
    hoodMat,
  );
  hood.castShadow = true;
  frame.add(at(hood, 0, 0, -0.553));
  ghostMeshes.push(hood);
  const capShape = pathShape([
    [-1.545, 0.02],
    [-1.545, 0.13],
    [-1.45, 0.245, 'spline'],
    [-1.29, 0.305, 'spline'],
    [-1.12, 0.332, 'spline'],
    [-1.02, 0.336, 'spline'],
    [-1.02, 0.02],
  ]);
  for (const cz of [-0.567, 0.553]) {
    const cap = new THREE.Mesh(
      new THREE.ExtrudeGeometry(capShape, {
        depth: 0.014,
        bevelEnabled: false,
        curveSegments: 24,
      }),
      hoodMat,
    );
    cap.castShadow = true;
    frame.add(at(cap, 0, 0, cz));
    ghostMeshes.push(cap);
  }
  // moulded vent slots, following the hood's own slope
  for (const [vx, vy, vr] of [
    [-1.42, 0.2563, -0.359],
    [-1.37, 0.275, -0.359],
    [-1.32, 0.2938, -0.359],
    [-1.27, 0.3082, -0.158],
    [-1.22, 0.3162, -0.158],
  ]) {
    const vent = beveledBox(0.022, 0.016, 0.34, ventMat, 0.004);
    vent.rotation.z = vr;
    frame.add(at(vent, vx, vy - 0.004, 0.08));
    ghostMeshes.push(vent);
  }

  // --- side foot rails (ghost on reveal, exposing the deck edge + cushions) --
  for (const sz of [-1, 1]) {
    const fr = beveledBox(RAIL_X1 - RAIL_X0 + 0.02, 0.062, 0.175, footRailMat, 0.016);
    fr.receiveShadow = true;
    frame.add(at(fr, (RAIL_X0 + RAIL_X1) / 2, DECK_TOP + 0.031, sz * 0.4675));
    ghostMeshes.push(fr);
  }

  // --- rear end caps + the two tracking bolts -------------------------------
  for (const sz of [-1, 1]) {
    frame.add(at(beveledBox(0.16, 0.115, 0.19, shellMat, 0.022), 1.175, 0.245, sz * 0.4675));
  }
  const tensionBolts = [];
  for (const sz of [-1, 1]) {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.026, 6), boltMat);
    bolt.geometry.rotateZ(Math.PI / 2);
    frame.add(at(bolt, 1.262, 0.245, sz * 0.4675));
    tensionBolts.push(bolt);
  }

  // --- uprights, handrails, console -----------------------------------------
  for (const sz of [-1, 1]) {
    const up = rod(0.036, 1.291, postMat, 22);
    up.rotation.z = -0.2182;
    frame.add(at(up, -1.03, 0.24, sz * 0.5));
    frame.add(at(beveledBox(0.15, 0.12, 0.14, shellMat, 0.024), -1.02, 0.238, sz * 0.5));
    frame.add(
      tubeAlong(
        [
          [-0.857, 1.02, sz * 0.5],
          [-0.79, 1.002, sz * 0.492],
          [-0.45, 0.988, sz * 0.478],
          [0.0, 0.984, sz * 0.472],
          [0.17, 0.996, sz * 0.454],
        ],
        0.022,
        postMat,
        { tubularSegments: 40, radialSegments: 14 },
      ),
    );
    for (const [ex, ey, ez] of [
      [-0.857, 1.02, sz * 0.5],
      [0.17, 0.996, sz * 0.454],
    ]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), postMat);
      cap.castShadow = true;
      frame.add(at(cap, ex, ey, ez));
    }
    frame.add(
      tubeAlong(
        [
          [-0.72, 0.998, sz * 0.487],
          [-0.45, 0.988, sz * 0.478],
          [-0.15, 0.985, sz * 0.474],
        ],
        0.027,
        gripMat,
        { tubularSegments: 24, radialSegments: 14 },
      ),
    );
  }

  // cross brace between the uprights, just under the console
  const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 1.0, 18), postMat);
  brace.geometry.rotateX(Math.PI / 2);
  brace.castShadow = true;
  frame.add(at(brace, -0.79, 1.32, 0));
  const consoleGrp = new THREE.Group();
  consoleGrp.position.set(-0.79, 1.71, 0);
  consoleGrp.rotation.z = 0.34; // ~19 deg of back rake: the face looks up
  // and toward the runner, and the panel's lower edge lands on the upright tops
  frame.add(consoleGrp);
  const consoleBody = beveledBox(0.075, 0.4, 1.06, shellMat, 0.03);
  consoleBody.castShadow = true;
  consoleGrp.add(consoleBody);
  const display = displayTexture();
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.66, 0.17),
    new THREE.MeshStandardMaterial({
      color: 0x05060a,
      emissive: 0xffffff,
      emissiveMap: display.tex,
      emissiveIntensity: 0.7,
      roughness: 0.4,
    }),
  );
  screen.rotation.y = Math.PI / 2;
  consoleGrp.add(at(screen, 0.039, 0.09, 0));
  for (let r0 = 0; r0 < 2; r0++) {
    for (let c0 = 0; c0 < 5; c0++) {
      const btn = beveledBox(0.008, 0.038, 0.058, materials.polymer(0x2c3138), 0.004);
      consoleGrp.add(at(btn, 0.039, -0.045 - r0 * 0.055, -0.18 + c0 * 0.09));
    }
  }
  for (const sz of [-1, 1]) {
    const holder = lathe(
      [
        [0.058, 0],
        [0.058, 0.03],
        [0.05, 0.032],
        [0.05, 0.004],
        [0, 0.004],
      ],
      shellMat,
      24,
    );
    consoleGrp.add(at(holder, 0.02, -0.13, sz * 0.4));
  }
  const keyClip = beveledBox(0.014, 0.05, 0.032, materials.polymer(0xc2402e), 0.006);
  consoleGrp.add(at(keyClip, 0.045, 0.19, -0.26));
  frame.add(
    tubeAlong(
      [
        [-0.811, 1.9, -0.26],
        [-0.783, 1.83, -0.265],
        [-0.796, 1.76, -0.262],
        [-0.772, 1.7, -0.26],
      ],
      0.005,
      materials.polymer(0x1a1c20),
      { tubularSegments: 24, radialSegments: 8 },
    ),
  );

  // --- incline jack: lift motor, lead screw, nut, leg, transport wheels ------
  const liftGrp = new THREE.Group();
  liftGrp.position.set(LIFT_X, LIFT_Y, 0);
  frame.add(liftGrp);
  const liftMotor = beveledBox(0.12, 0.085, 0.09, motorMat, 0.016);
  liftGrp.add(at(liftMotor, -0.075, -0.02, 0));
  liftGrp.add(at(beveledBox(0.075, 0.075, 0.085, alu, 0.014), 0, -0.02, 0));
  const screwGrp = new THREE.Group();
  liftGrp.add(at(screwGrp, 0, -0.05, 0));
  screwGrp.add(at(rod(0.016, SCREW_LEN, steelMat, 16), 0, -SCREW_LEN, 0));
  const threadPts = [];
  for (let i = 0; i <= THREAD_TURNS * 12; i++) {
    const t = i / (THREAD_TURNS * 12);
    threadPts.push([
      Math.cos(t * TAU * THREAD_TURNS) * 0.0205,
      -SCREW_LEN + t * SCREW_LEN,
      Math.sin(t * TAU * THREAD_TURNS) * 0.0205,
    ]);
  }
  screwGrp.add(
    tubeAlong(threadPts, 0.0055, steelMat, {
      tubularSegments: THREAD_TURNS * 12,
      radialSegments: 7,
    }),
  );
  const nut = beveledBox(0.064, 0.05, 0.064, darkMat, 0.008);
  liftGrp.add(nut);
  const liftLeg = rod(0.021, 0.09, alu, 16);
  liftGrp.add(liftLeg);
  const liftFoot = beveledBox(0.1, 0.03, 0.3, darkMat, 0.008);
  liftGrp.add(liftFoot);
  const liftWheels = [];
  for (const sz of [-1, 1]) {
    const wheel = latheZ(
      [
        [0, -0.018],
        [0.02, -0.018],
        [0.03, -0.012],
        [0.03, 0.012],
        [0.02, 0.018],
        [0, 0.018],
      ],
      gripMat,
      22,
    );
    liftGrp.add(at(wheel, 0, 0, sz * 0.115));
    liftWheels.push(wheel);
  }

  // --- footstrike indicator (abstract: never stylized anatomy) --------------
  const strikeGrp = new THREE.Group();
  deckSink.add(at(strikeGrp, 0.29, 0, -0.3));
  const ringMat = new THREE.MeshBasicMaterial({
    map: loadTexture(),
    transparent: true,
    opacity: 0,
    depthWrite: false, // trap #7 — a faded overlay must not punch holes
  });
  const strikeRing = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), ringMat);
  strikeRing.rotation.x = -Math.PI / 2;
  strikeGrp.add(at(strikeRing, 0, BELT_TOP + 0.0025, 0));

  // --- callouts -------------------------------------------------------------
  labels.add('exterior', anchor(frame, -0.82, 1.88, 0.12), 'Console & display', [0, 0, 0], 40, 62);
  labels.add('exterior', anchor(frame, -0.55, 1.0, -0.47), 'Handrail', [0, 0, 0], 20, 56);
  labels.add('exterior', anchor(frame, 0.35, BELT_TOP, 0.0), 'Running belt', [0, 0, 0], -35, 66);
  labels.add('exterior', anchor(frame, 0.62, 0.3, -0.4675), 'Side foot rail', [0, 0, 0], -60, 62);
  labels.add('exterior', anchor(frame, -1.3, 0.24, -0.3), 'Motor hood', [0, 0, 0], 145, 60);
  labels.add('exterior', anchor(consoleGrp, 0.05, 0.19, -0.26), 'Safety key', [0, 0, 0], 110, 58);

  labels.add('drive', anchor(motor, 0, MOT_R, 0.02), 'DC drive motor', [0, 0, 0], 125, 64);
  labels.add('drive', anchor(frame, -1.17, 0.19, PULLEY_Z), 'Poly-V drive belt', [0, 0, 0], -130, 66);
  labels.add('drive', anchor(frontMount, 0, R, -0.2), 'Drive roller (front)', [0, 0, 0], 60, 62);
  labels.add('drive', anchor(rearMount, 0, R, -0.2), 'Idler roller (rear)', [0, 0, 0], 40, 58);
  labels.add('drive', anchor(frame, -1.41, 0.12, -0.05), 'Motor controller', [0, 0, 0], 155, 66);

  labels.add('motor', anchor(motor, 0, 0.1, -0.29), 'Flywheel', [0, 0, 0], 125, 58);
  labels.add(
    'motor',
    anchor(motor, 0, -MR - 0.012, PULLEY_Z - MOT_Z),
    'Motor pulley',
    [0, 0, 0],
    -115,
    62,
  );
  labels.add(
    'motor',
    anchor(frontMount, 0, -PR - 0.012, PULLEY_Z),
    'Roller pulley — 3:1',
    [0, 0, 0],
    -55,
    68,
  );
  const MAGNET_R = PR - 0.014; // the radius the magnet orbits at
  labels.add(
    'motor',
    anchor(
      frontMount,
      Math.cos(-0.54) * MAGNET_R,
      Math.sin(-0.54) * MAGNET_R,
      PULLEY_Z + 0.022,
    ),
    'Speed magnet',
    [0, 0, 0],
    -20,
    58,
  );
  labels.add('motor', anchor(frame, hallX, hallY + 0.02, -0.482), 'Hall pickup', [0, 0, 0], 75, 58);

  labels.add(
    'deck',
    anchor(frame, -0.1, DECK_BOT + 0.01, -DECK_HW),
    'Deck board — 19 mm',
    [0, 0, 0],
    -55,
    66,
  );
  labels.add(
    'deck',
    anchor(frame, 0.45, DECK_TOP, -(DECK_HW - 0.05)),
    'Waxed low-friction face',
    [0, 0, 0],
    35,
    72,
  );
  labels.add('deck', anchor(frame, 0.2, BELT_TOP, -0.2), 'Belt — 2-ply PVC', [0, 0, 0], 65, 62);

  labels.add('cushion', pucks[4], 'Elastomer cushion', [0, puckH / 2, 0], -50, 62);
  labels.add('cushion', anchor(deckSink, 0.29, DECK_BOT, -DECK_HW), 'Deck deflection', [0, 0, 0], 30, 62);
  labels.add('cushion', anchor(frame, 0.29, RAIL_TOP, -RAIL_Z), 'Frame rail', [0, 0, 0], -70, 56);

  labels.add('tracking', anchor(frontMount, 0, R, 0.18), 'Crowned drive roller', [0, 0, 0], 60, 72);
  labels.add('tracking', anchor(frontMount, 0, 0, 0.345), 'Bare roller face', [0, 0, 0], -30, 62);
  labels.add('tracking', anchor(deckSink, -0.55, BELT_TOP, BELT_HW), 'Belt edge', [0, 0, 0], 15, 58);

  labels.add('incline', liftMotor, 'Lift motor', [0, 0.05, 0], 150, 58);
  labels.add('incline', screwGrp, 'Lead screw', [0, -0.18, 0.03], -140, 62);
  labels.add('incline', anchor(frame, PIVOT_X, 0.03, -RAIL_Z), 'Rear pivot foot', [0, 0, 0], -35, 62);
  // the jack foot sits low and far right in the incline frame, so this leader
  // has to run back INTO frame — down-right walks the pill off the bottom edge
  labels.add('incline', liftFoot, 'Transport wheels', [0, -0.02, -0.12], 185, 72);

  // --- pose -----------------------------------------------------------------
  const state = { reveal: 0, spin: 0, incline: 0, strike: 0, drift: 0, skew: 0, speed: 5 };
  const seamP = { x: 0, y: 0, nx: 0, ny: 0 };
  let shownSpeed = -1;
  let shownGrade = -1;

  function apply() {
    const spin = state.spin;
    frontRoller.rotation.z = -spin;
    rearRoller.rotation.z = -spin;
    pulleyHub.rotation.z = -spin;
    motorShaft.rotation.z = -spin * RATIO;

    // belt: scroll the tread and ride the seam round the loop
    const s = (((spin * R) % P) + P) % P;
    tread.offset.x = -(s / P) * TREAD_REPEAT;
    beltPath((s + SEAM_S0) % P, seamP);
    seam.position.set(
      seamP.x + seamP.nx * (BT + 0.0009),
      seamP.y + seamP.ny * (BT + 0.0009),
      belt.position.z,
    );
    seam.rotation.z = Math.atan2(seamP.ny, seamP.nx) - Math.PI / 2;

    // hall pickup: one flash per magnet pass, sixteen per lap
    const phase = ((-spin % TAU) + TAU) % TAU;
    const near = Math.min(phase, TAU - phase);
    hallLed.material.emissiveIntensity = 0.15 + 1.4 * Math.exp(-(near * near) / 0.02);

    // footstrike: the deck settles onto the cushions, which squash and bulge
    const k = clamp01(state.strike);
    deckSink.position.y = -k * SINK_MAX;
    for (const puck of pucks) {
      puck.scale.set(1 + k * 0.09, 1 - (k * SINK_MAX) / puckH, 1 + k * 0.09);
    }
    ringMat.opacity = k * 0.9;
    strikeRing.scale.setScalar(0.72 + k * 0.34);

    // tracking: the bolts skew the rear roller, and the belt walks off centre
    // full drift puts the belt edge right at the end of the roller face,
    // which is exactly where a real belt starts to rub the frame
    belt.position.z = state.drift * 0.04;
    rearMount.rotation.y = state.skew * 0.05;
    tensionBolts[0].rotation.x = state.skew * 7;
    tensionBolts[1].rotation.x = -state.skew * 7;

    // incline: the frame tilts about the rear feet while the jack's nut drives
    // down the screw, pushing the leg into the floor
    const th = clamp01(state.incline) * THETA_MAX;
    pivotGrp.rotation.z = -th;
    const attachY = (PIVOT_X - LIFT_X) * Math.sin(th) + LIFT_Y * Math.cos(th);
    const H = attachY / Math.cos(th);
    const travel = H - LIFT_Y;
    nut.position.y = -(0.06 + travel);
    liftLeg.position.y = -H + 0.06;
    liftFoot.position.y = -H + 0.045;
    for (const w of liftWheels) w.position.y = -H + 0.03;
    screwGrp.rotation.y = (travel / SCREW_LEAD) * TAU;

    const sp = Math.round(state.speed * 10) / 10;
    const gr = Math.round(clamp01(state.incline) * GRADE_MAX * 1000) / 10;
    if (sp !== shownSpeed || gr !== shownGrade) {
      display.draw(sp, gr);
      shownSpeed = sp;
      shownGrade = gr;
    }
  }

  function setReveal(r) {
    const v = clamp01(r);
    for (const gm of ghostMats) {
      gm.opacity = 1 - v * 0.94;
      gm.transparent = v > 0.01;
      gm.depthWrite = v < 0.01;
      gm.clearcoat = v > 0.01 ? 0 : gm.userData.coat;
      gm.needsUpdate = true;
    }
    for (const gmesh of ghostMeshes) gmesh.castShadow = v < 0.02;
  }

  setReveal(0);
  apply();
  scene.add(group);

  return {
    group,
    state,
    parts: {
      frame,
      pivotGrp,
      frontRoller,
      rearRoller,
      belt,
      seam,
      motorShaft,
      flywheel,
      deckSink,
      pucks,
      hood,
      screwGrp,
      nut,
      consoleGrp,
    },
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
