import * as THREE from 'three';
import { materials } from '../../framework/parts.js';
import { tubeAlong, boltCircle, bladeRing, chainPath } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, smooth, TAU } from '../../framework/motion.js';

// A kerolox gas-generator-cycle rocket engine on a horizontal test-stand mount,
// presented as a studio product shot. Axis along +X: gimbal bearing and
// turbopump at -X, nozzle exit and plume at +X. Reveal story: the sealed
// running engine -> the feed problem -> the turbopump -> the gas generator that
// spins it -> the pintle injector -> the chamber and throat -> the bell and its
// coolant channels -> the gimbal -> a sealed, running finale.
//
// SCALE: 1 world unit = 1.10 m. Reference engine is Merlin-1D-class (SpaceX
// Falcon 9 first stage): 0.92 m nozzle exit, ~2.9 m tall, 845 kN sea-level
// thrust, chamber pressure 97 bar, single-shaft dual-impeller turbopump at
// 36,000 rpm / ~7,500 kW, throttleable to 40% on a pintle injector.
//   nozzle exit  0.92 m dia   -> EXIT_R   0.420
//   throat       0.23 m dia   -> THROAT_R 0.105   (EXIT_R/THROAT_R)^2 = 16 : 1
//   chamber      0.39 m dia   -> CHAM_R   0.178   contraction ratio 2.9 : 1
// The nozzle contour is a real quadratic-Bezier bell: 33 deg initial expansion
// half-angle at the throat easing to 10 deg at the lip, which is the standard
// ~80%-length bell every large engine uses. Everything else is derived from
// those four numbers so the silhouette holds true ratio. The ONE deliberate
// scale break is the pintle assembly, drawn ~1.6x oversize — a real pintle tip
// is ~40 mm across, which is 4 px of screen even in the macro shot.
//
// MECHANISM (researched — gas-generator cycle, LOX/RP-1):
// The tanks sit at ~3 bar; the chamber runs at ~97 bar. Nothing flows uphill on
// its own, so a TURBOPUMP does the lifting: ONE shaft carrying a TURBINE wheel
// and TWO centrifugal IMPELLERS (one per propellant), which raise the pressure
// to ~150 bar. What spins it is the cycle's defining trick — a GAS GENERATOR,
// a small rocket engine burning ~2% of the propellant deliberately FUEL-RICH so
// its exhaust is soot-cool (~900 K) instead of the 3,300 K the main chamber
// runs, because a stoichiometric flame would strip the turbine blades. That
// warm gas drives the turbine and is then dumped OVERBOARD, which is why this
// cycle is simple, light, and a few per cent less efficient than staged
// combustion: the turbine exhaust never does any expansion work. Here it is
// dumped into the nozzle wall, where it FILM-COOLS the skirt on its way out.
// Main flow reaches the chamber through a PINTLE INJECTOR: fuel leaves a
// centre post as a flat radial sheet and slams at right angles into an annular
// LOX sheet sleeving it, which atomises both. One moving element instead of
// hundreds of drilled orifices is what makes deep throttling and restart easy.
// Combustion at 97 bar and ~3,300 C then accelerates down a converging duct to
// exactly Mach 1 at the THROAT — the flow CHOKES there, which is what fixes the
// mass flow and decouples the chamber from the outside air. Past the throat the
// gas is supersonic, and a supersonic gas SPEEDS UP as the duct widens, so the
// diverging bell trades pressure for velocity: ~Mach 3.5 and ~2,900 m/s at the
// lip (the area-Mach relation at eps=16, gamma~1.2, gives M~3.6). The bell survives 3,300 C with no exotic ceramics because of
// REGENERATIVE COOLING: the fuel is routed through milled channels in the
// chamber and nozzle wall BEFORE it is burned, entering at a manifold near the
// exit and flowing forward to the injector, so the propellant is also the
// coolant and the heat it absorbs goes back into the chamber. Steering is the
// whole engine pivoting on a GIMBAL bearing, +/-5 deg, pushed by two hydraulic
// actuators braced against the thrust structure.
// Sources: en.wikipedia.org/wiki/Gas-generator_cycle,
// thespacetechie.com/gas-generator-cycle, en.wikipedia.org/wiki/SpaceX_Merlin,
// ntrs.nasa.gov 19770009165 (Liquid Rocket Engine Nozzles),
// heroicrelics.org/info/f-1/f-1-thrust-chamber.html.

// --- staging -----------------------------------------------------------------
// The engine FLOATS: no plinth, no stand (stageOptions.space drops the shadow
// floor and the contact shadow to match), so this is purely where the centreline
// sits in frame.
const AXIS_Y = 1.35;

// --- the thrust chamber (everything else hangs off these numbers) ------------
const THROAT_R = 0.105;
const EXIT_R = 0.42;
const CHAM_R = 0.178;
const WALL = 0.026; // liner + coolant channels + outer jacket

const X_PIVOT = -1.34; // gimbal bearing centre — the engine rotates about this
const X_DOME0 = -1.0; // back face of the injector dome
const X_FACE = -0.74; // injector face: where the propellants meet
const X_CHAM1 = -0.27; // end of the cylindrical chamber, start of the throat cone
const X_THROAT = -0.1;
const X_COOLANT = 0.4; // coolant inlet manifold — fuel enters the jacket here
const X_TEX = 0.5; // turbine-exhaust manifold — films the skirt below this
const X_EXIT = 0.85;
const X_JACKET_END = 0.44; // channel-wall jacket ends, smooth skirt begins

// Bell contour control point: the intersection of the 33-deg throat tangent and
// the 10-deg lip tangent, which is what makes a quadratic Bezier hit both end
// angles exactly. Solved once, hard-coded so the profile can't drift.
const BELL_CX = 0.2125;
const BELL_CR = 0.3078;

const CHANNELS = 60; // milled coolant channels around the jacket

// --- cutaway ------------------------------------------------------------------
// Angular slot removed from every shell on reveal, measured from +Z (the camera
// side) toward +Y. Centred at 25 deg so an elevated camera on the +Z side looks
// straight down into the opening; every external pipe is routed OUTSIDE this
// wedge so nothing floats in the hole.
const GAP_C = (25 * Math.PI) / 180;
const GAP_HALF = (52 * Math.PI) / 180;

// --- turbopump ----------------------------------------------------------------
const PUMP_Y = AXIS_Y + 0.36;
const X_TURBINE = -1.26;
const X_FUEL_IMP = -1.05;
const X_LOX_IMP = -0.82;

// --- gas generator ------------------------------------------------------------
// Tucked directly under the TURBINE rather than under the injector dome. Two
// reasons: the hot-gas duct becomes the short direct run it is on a real engine,
// and 0.14 further upstream is exactly what clears it out of the pintle macro,
// where it was the largest object in frame.
const GG = new THREE.Vector3(-1.28, 1.06, 0.14);

const LOX_COLOR = 0x7fd4ff; // pale blue — cryogenic oxidiser
const FUEL_COLOR = 0xe8a95c; // warm amber — kerosene
// Browner and duller than FUEL_COLOR, but nowhere near true soot: read against a
// deliberately black refractory liner, 0xb4552e vanished into it completely,
// while 0xd98a5a was indistinguishable from the amber kerosene packets flowing
// the other way along the same bell.
const DRIVE_COLOR = 0xc08a60;
const HOT_COLOR = 0xff8a3d; // main-chamber gas

// Bell radius at x, and the whole inner contour as a [[x, r], ...] profile.
function bellR(x) {
  // invert the Bezier's x(t) by bisection, then evaluate r(t)
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const t = (lo + hi) / 2;
    const bx = (1 - t) * (1 - t) * X_THROAT + 2 * (1 - t) * t * BELL_CX + t * t * X_EXIT;
    if (bx < x) lo = t;
    else hi = t;
  }
  const t = (lo + hi) / 2;
  return (1 - t) * (1 - t) * THROAT_R + 2 * (1 - t) * t * BELL_CR + t * t * EXIT_R;
}

// The gas-side contour, injector face -> exit lip, densely sampled where it
// curves. Returned as [[x, r], ...] with x strictly increasing.
function innerContour() {
  const pts = [[X_FACE, CHAM_R]];
  // cylindrical chamber
  for (let i = 1; i <= 6; i++) pts.push([X_FACE + ((X_CHAM1 - X_FACE) * i) / 6, CHAM_R]);
  // converging cone, filleted at both ends so there is no crease at the shoulder
  for (let i = 1; i <= 10; i++) {
    const u = i / 10;
    pts.push([X_CHAM1 + (X_THROAT - X_CHAM1) * u, CHAM_R + (THROAT_R - CHAM_R) * smooth(u)]);
  }
  // diverging bell — sampled on the Bezier parameter, which naturally clusters
  // samples in the sharply-turning throat region
  for (let i = 1; i <= 34; i++) {
    const t = i / 34;
    const x = (1 - t) * (1 - t) * X_THROAT + 2 * (1 - t) * t * BELL_CX + t * t * X_EXIT;
    const r = (1 - t) * (1 - t) * THROAT_R + 2 * (1 - t) * t * BELL_CR + t * t * EXIT_R;
    pts.push([x, r]);
  }
  return pts;
}

// Radius of the inner contour at any x (linear between samples) — used to route
// pipes and flow paths that must hug the shell.
function contourR(profile, x) {
  if (x <= profile[0][0]) return profile[0][1];
  const last = profile[profile.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < profile.length; i++) {
    if (profile[i][0] >= x) {
      const [x0, r0] = profile[i - 1];
      const [x1, r1] = profile[i];
      return r0 + ((r1 - r0) * (x - x0)) / (x1 - x0);
    }
  }
  return last[1];
}

// Slice a profile to an x range, keeping the exact end points.
function sliceProfile(profile, x0, x1) {
  const out = [[x0, contourR(profile, x0)]];
  for (const [x, r] of profile) if (x > x0 && x < x1) out.push([x, r]);
  out.push([x1, contourR(profile, x1)]);
  return out;
}

const offsetProfile = (profile, d) => profile.map(([x, r]) => [x, r + d]);

// A point on a shell at (x, theta): theta is measured from +Z toward +Y, so
// theta 0 faces the camera and theta 90 is straight up.
const onShell = (x, r, th) => [x, AXIS_Y + Math.sin(th) * r, Math.cos(th) * r];

// THE workhorse primitive: a surface of revolution about the X axis with the two
// extras a rocket bell needs — a circumferential RIPPLE (60 milled coolant
// channels as one mesh instead of 60) and an angular GAP (the model-kit
// cutaway). `inward` flips the winding for a gas-side wall, which must be
// visible from inside the bell (through the open exit) and invisible from
// outside, so the sealed engine never shows its own guts.
function shellSurface(
  profile,
  { thetaStart = 0, thetaLen = TAU, seg = 96, channels = 0, ampAt = null, inward = false },
  material,
) {
  const rows = profile.length;
  const cols = seg + 1;
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i < rows; i++) {
    const [x, r0] = profile[i];
    for (let j = 0; j < cols; j++) {
      const th = thetaStart + (j / seg) * thetaLen;
      const amp = channels && ampAt ? ampAt(r0) * (0.5 + 0.5 * Math.cos(channels * th)) : 0;
      const r = r0 + amp;
      pos.push(x, Math.sin(th) * r, Math.cos(th) * r);
      uv.push(j / seg, i / (rows - 1));
    }
  }
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      if (inward) idx.push(a, b, c, b, d, c);
      else idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.position.y = AXIS_Y;
  return mesh;
}

// Flat annulus joining two profiles at a fixed theta — the machined face left
// behind where the cutaway wedge was removed. Without these the cut shell reads
// as paper-thin foil instead of a 26 mm wall full of coolant channels.
function cutFace(innerP, outerP, th, material) {
  const n = innerP.length;
  const pos = [];
  const uv = [];
  const idx = [];
  const s = Math.sin(th);
  const c = Math.cos(th);
  for (let i = 0; i < n; i++) {
    const x = innerP[i][0];
    const ri = innerP[i][1];
    const ro = contourR(outerP, x);
    pos.push(x, s * ri, c * ri, x, s * ro, c * ro);
    uv.push(0, i / (n - 1), 1, i / (n - 1));
  }
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = AXIS_Y;
  mesh.castShadow = true;
  return mesh;
}

// Ring band around the shell — flanges, manifolds, joints. Built through
// shellSurface rather than a CylinderGeometry so its angular gap lines up with
// the cutaway automatically (CylinderGeometry's thetaStart is measured in its
// own rotated frame, which is how bands end up mysteriously half a wedge out).
function bandAt(x, r, len, material, arc = {}) {
  return shellSurface(
    [
      [x - len / 2, r],
      [x + len / 2, r],
    ],
    arc,
    material,
  );
}

// Flat annulus facing along X — the nozzle's exit lip, and any other place two
// radii meet at one station. Same trick: two profile rows at the same x.
function annulusAt(x, r0, r1, material, arc = {}) {
  return shellSurface(
    [
      [x, r0],
      [x, r1],
    ],
    arc,
    material,
  );
}

// Vertical gradient used for the glowing gas column: v=0 is the injector end
// (near-white at 3,300 C), v=1 the exit lip (deep orange, half transparent).
// Peak channel sum stays under the clipping gate's 760 threshold on purpose.
function gasGradient() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const x = c.getContext('2d');
  // Ramps UP over the first tenth rather than starting at full brightness: the
  // flame front takes a few millimetres to establish, and a column that is
  // already peak-white at the injector face reads as a cream plastic plug
  // filling the chamber in any macro shot.
  const g = x.createLinearGradient(0, 256, 0, 0); // canvas bottom = v 0
  g.addColorStop(0.0, 'rgba(255,214,160,0.5)');
  g.addColorStop(0.12, 'rgba(255,222,172,0.76)');
  g.addColorStop(0.35, 'rgba(255,190,120,0.62)');
  g.addColorStop(0.65, 'rgba(255,150,74,0.42)');
  g.addColorStop(0.85, 'rgba(246,120,52,0.24)');
  g.addColorStop(1.0, 'rgba(232,98,40,0.12)');
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// The plume's alpha along its length. Without this the cone is a hard-edged
// tube that ends in mid-air — the single worst tell in the first render pass.
// v=0 is the exit lip, v=1 the far tip (CylinderGeometry's +Y end, which the
// -90 deg Z rotation aims downstream).
function plumeGradient() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 256, 0, 0); // canvas bottom = v 0
  g.addColorStop(0.0, 'rgba(255,206,158,0.95)');
  g.addColorStop(0.18, 'rgba(255,176,116,0.8)');
  g.addColorStop(0.5, 'rgba(255,146,86,0.42)');
  g.addColorStop(0.78, 'rgba(240,116,60,0.16)');
  g.addColorStop(1.0, 'rgba(210,90,45,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Lift a path clear of the pipe (or wall) whose flow it represents, so the
// packets ride its visible OUTER surface. Packets drawn down a pipe's true
// centreline sit inside opaque metal and never render at all — which silently
// falsified every "follow the amber line" claim in the copy. Offsets radially
// away from the engine axis; points already ON the axis are left alone.
// For a pipe that runs RADIALLY (the two vertical tank inlets), "away from the
// axis" points along the pipe rather than out through its wall, so liftOffAxis
// leaves the packets inside it. Those runs get a plain shove toward the camera.
function nudgeZ(pts, d) {
  return pts.map(([x, y, z]) => [x, y, z + d]);
}

function liftOffAxis(pts, d) {
  return pts.map(([x, y, z]) => {
    const dy = y - AXIS_Y;
    const len = Math.hypot(dy, z);
    if (len < 1e-6) return [x, y, z];
    return [x, AXIS_Y + dy + (dy / len) * d, z + (z / len) * d];
  });
}

// A queue of glowing packets riding a path — propellant in the plumbing. Shares
// ONE material per stream (opacity is per-material, so the end-of-path fade
// rides per-dot SCALE instead, which is per-object and free).
function flowStream(path, { count = 12, color = 0xffffff, size = 0.017 }) {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const geo = new THREE.SphereGeometry(1, 8, 6);
  const group = new THREE.Group();
  const dots = [];
  for (let i = 0; i < count; i++) {
    const dot = new THREE.Mesh(geo, mat);
    group.add(dot);
    dots.push(dot);
  }
  function set(phase) {
    for (let i = 0; i < count; i++) {
      const t = (((phase + i / count) % 1) + 1) % 1;
      dots[i].position.copy(path.getPointAt(t));
      const fade = Math.min(1, t * 9, (1 - t) * 9);
      dots[i].scale.setScalar(fade > 0.03 ? size * (0.5 + 0.5 * fade) : 0);
    }
  }
  set(0);
  return { group, set, material: mat };
}

export function buildRocketEngine({ scene }) {
  const sceneGroup = new THREE.Group();
  scene.add(sceneGroup);

  // gimbalPivot sits AT the bearing so a plain rotation steers the engine;
  // `engine` cancels that offset so every part below can use absolute
  // world-space constants instead of pivot-relative ones.
  const gimbalPivot = new THREE.Group();
  gimbalPivot.position.set(X_PIVOT, AXIS_Y, 0);
  sceneGroup.add(gimbalPivot);
  const engine = new THREE.Group();
  engine.position.set(-X_PIVOT, -AXIS_Y, 0);
  gimbalPivot.add(engine);

  // --- materials --------------------------------------------------------------
  const jacketMat = materials.anisoSteel(0xc3cad3, Math.PI / 2);
  jacketMat.roughness = 0.62; // roughnessMap MULTIPLIES: a big curved bell at
  jacketMat.anisotropy = 0.55; // the 0.3 preset mirrors the softbox
  const skirtMat = materials.heatBluedSteel('v');
  skirtMat.roughness = 0.5;
  const domeMat = materials.aluminum(0xb2b9c2);
  domeMat.roughness = 0.66;
  const pumpMat = materials.aluminum(0xa9b0ba);
  pumpMat.roughness = 0.6;
  const ductMat = materials.brushedSteel(0x9aa2ac);
  ductMat.roughness = 0.62;
  const loxDuctMat = materials.brushedSteel(0xb6c4d0);
  loxDuctMat.roughness = 0.55;
  const fuelDuctMat = materials.brushedSteel(0xa8977f);
  fuelDuctMat.roughness = 0.6;
  const hotDuctMat = materials.heatBluedSteel('u');
  hotDuctMat.roughness = 0.44;
  const boltMat = materials.brushedSteel(0x848c96);
  boltMat.roughness = 0.55;
  const standMat = materials.grimyAluminum(0x2f343c);
  // Polished, NOT chrome. materials.chrome() is roughness 0.09 — a true mirror,
  // and at macro range a mirrored pintle/shaft reflects the studio softbox
  // straight into the lens and blows the clipping gate. brushedSteel at 0.5
  // (x its roughnessMap ~ 0.25 effective) still reads as machined and bright.
  const polishedMat = () => {
    const m = materials.brushedSteel(0xc9d2db);
    m.roughness = 0.5;
    return m;
  };
  const cutFaceMat = materials.brushedSteel(0x7f8792);
  cutFaceMat.roughness = 0.72;
  cutFaceMat.side = THREE.DoubleSide;
  // gas-side wall: sooty refractory, never a mirror (a bright concave liner
  // inside a bell blows out from every angle that can see down it)
  const linerMat = new THREE.MeshStandardMaterial({
    color: 0x2a2521,
    roughness: 0.93,
    metalness: 0.18,
    side: THREE.FrontSide,
  });

  const sealedShells = []; // visible when the engine is closed up
  const cutShells = []; // the sector-cut twins
  const internals = []; // only ever seen through the cutaway

  // --- staging: the engine FLOATS ---------------------------------------------
  // No plinth and no test stand, by request. `stageOptions.space` also drops the
  // shadow floor and the contact shadow, so nothing is left implying a ground
  // the engine is standing on. What survives is the vehicle INTERFACE, not
  // scaffolding: the gimbal bearing and one thrust ring, which is genuinely part
  // of how the engine attaches to a rocket and is what the gimbal actuators push
  // against. Without it the actuators would shove off thin air.
  //
  // Everything in that interface lives in one group so the deep-macro steps can
  // drop it: the actuators sit inches from the injector and the bearing inches
  // from the turbopump, and at macro framing they are foreground clutter no
  // camera angle can dodge.
  // NB: `mount` is at the origin with no rotation, so the actuator aiming maths
  // below still works in plain sceneGroup-local coordinates.
  const mount = new THREE.Group();
  sceneGroup.add(mount);

  const THRUST_RING_X = -1.62;
  const THRUST_RING_R = 0.3;
  const thrustRing = bandAt(THRUST_RING_X, THRUST_RING_R, 0.09, standMat);
  mount.add(thrustRing);
  const ringLip = new THREE.Mesh(
    new THREE.TorusGeometry(THRUST_RING_R, 0.018, 10, 44),
    materials.brushedSteel(0x8b939d),
  );
  ringLip.rotation.y = Math.PI / 2;
  ringLip.position.set(THRUST_RING_X + 0.045, AXIS_Y, 0);
  mount.add(ringLip);

  // --- gimbal bearing ---------------------------------------------------------
  // Outer race is bolted to the stand; the ball and everything downstream swing.
  const race = bandAt(X_PIVOT - 0.06, 0.105, 0.1, materials.brushedSteel(0x8b939d));
  mount.add(race);
  const raceRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.108, 0.022, 12, 40),
    materials.brushedSteel(0x939ba5),
  );
  raceRing.rotation.y = Math.PI / 2;
  raceRing.position.set(X_PIVOT - 0.01, AXIS_Y, 0);
  mount.add(raceRing);
  const boltRing = boltCircle(10, 0.108, 0.014, boltMat, 0.026);
  boltRing.rotation.z = Math.PI / 2;
  boltRing.position.set(X_PIVOT - 0.1, AXIS_Y, 0);
  mount.add(boltRing);

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.072, 24, 18),
    polishedMat(),
  );
  ball.castShadow = true;
  ball.position.set(X_PIVOT, AXIS_Y, 0);
  engine.add(ball); // gimbals with the engine, but hidden alongside the mount —
  // a lone chrome sphere with its bearing race switched off reads as a stray orb

  // --- inner contour + the two shell variants ---------------------------------
  const inner = innerContour();
  const outer = offsetProfile(inner, WALL);
  const jacketInner = sliceProfile(inner, X_FACE, X_JACKET_END);
  const jacketOuter = offsetProfile(jacketInner, WALL);
  const skirtInner = sliceProfile(inner, X_JACKET_END, X_EXIT);
  const skirtOuter = offsetProfile(skirtInner, WALL);
  // channel bulge grows with radius: 60 channels around a wider station means
  // wider, prouder channels, exactly as a milled channel wall looks
  const channelAmp = (r) => 0.006 + 0.009 * (r / EXIT_R);

  function buildChamber(cut) {
    const g = new THREE.Group();
    const t0 = cut ? GAP_C + GAP_HALF : 0;
    const tl = cut ? TAU - 2 * GAP_HALF : TAU;
    const arc = { thetaStart: t0, thetaLen: tl };

    g.add(
      shellSurface(
        jacketOuter,
        { ...arc, seg: 240, channels: CHANNELS, ampAt: channelAmp },
        jacketMat,
      ),
    );
    g.add(shellSurface(skirtOuter, { ...arc, seg: 120 }, skirtMat));
    g.add(shellSurface(inner, { ...arc, seg: 120, inward: true }, linerMat));

    // exit lip: a real annulus joining inner to outer, so the nozzle is an
    // actual hole rather than a shell with a paper edge
    g.add(annulusAt(X_EXIT, EXIT_R, EXIT_R + WALL, cutFaceMat, { ...arc, seg: 120 }));

    if (cut) {
      g.add(cutFace(inner, outer, GAP_C + GAP_HALF, cutFaceMat));
      g.add(cutFace(inner, outer, GAP_C - GAP_HALF, cutFaceMat));
    }

    // joint bands: injector flange, coolant inlet manifold, turbine-exhaust
    // manifold. These are the real hardware at those stations, and they hide
    // the material change from channel wall to smooth skirt.
    const bands = [
      [X_FACE + 0.012, CHAM_R + WALL + 0.028, 0.05, domeMat],
      [X_COOLANT, contourR(outer, X_COOLANT) + 0.022, 0.055, ductMat],
      [X_TEX, contourR(outer, X_TEX) + 0.018, 0.045, hotDuctMat],
    ];
    for (const [bx, br, bl, bm] of bands) g.add(bandAt(bx, br, bl, bm, { ...arc, seg: 120 }));

    // injector-flange bolts, only around the arc that still exists
    const bolts = 18;
    for (let i = 0; i <= bolts; i++) {
      const th = t0 + (i / bolts) * tl;
      if (tl < TAU && (i === 0 || i === bolts)) continue;
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.03, 6), boltMat);
      const br = CHAM_R + WALL + 0.045;
      bolt.position.set(X_FACE + 0.012, AXIS_Y + Math.sin(th) * br, Math.cos(th) * br);
      bolt.rotation.x = Math.PI / 2 - th;
      g.add(bolt);
    }
    return g;
  }

  const chamberSealed = buildChamber(false);
  const chamberCut = buildChamber(true);
  engine.add(chamberSealed, chamberCut);
  sealedShells.push(chamberSealed);
  cutShells.push(chamberCut);

  // --- injector dome ----------------------------------------------------------
  const domeOuter = [
    [X_DOME0, 0.078],
    [X_DOME0 + 0.022, 0.118],
    [X_DOME0 + 0.05, 0.158],
    [X_DOME0 + 0.09, 0.185],
    [X_DOME0 + 0.15, 0.199],
    [X_FACE, CHAM_R + WALL],
  ];
  const domeInner = domeOuter.map(([x, r]) => [x, Math.max(0.03, r - 0.024)]);

  function buildDome(cut) {
    const g = new THREE.Group();
    const t0 = cut ? GAP_C + GAP_HALF : 0;
    const tl = cut ? TAU - 2 * GAP_HALF : TAU;
    const arc = { thetaStart: t0, thetaLen: tl, seg: 96 };
    g.add(shellSurface(domeOuter, arc, domeMat));
    if (cut) {
      g.add(shellSurface(domeInner, { ...arc, inward: true }, linerMat));
      g.add(cutFace(domeInner, domeOuter, GAP_C + GAP_HALF, cutFaceMat));
      g.add(cutFace(domeInner, domeOuter, GAP_C - GAP_HALF, cutFaceMat));
    }
    return g;
  }
  const domeSealed = buildDome(false);
  const domeCut = buildDome(true);
  engine.add(domeSealed, domeCut);
  sealedShells.push(domeSealed);
  cutShells.push(domeCut);

  // gimbal thrust cone: dome back face -> the bearing ball
  const thrustCone = shellSurface(
    [
      [X_PIVOT + 0.06, 0.072],
      [X_PIVOT + 0.14, 0.084],
      [X_DOME0 - 0.02, 0.086],
      [X_DOME0, 0.082],
    ],
    { seg: 48 },
    materials.brushedSteel(0x8e969f),
  );
  engine.add(thrustCone);

  // --- injector: the pintle ---------------------------------------------------
  const injFace = new THREE.Mesh(
    new THREE.CylinderGeometry(CHAM_R, CHAM_R, 0.022, 64),
    materials.brushedSteel(0x9ba3ad),
  );
  injFace.rotation.z = Math.PI / 2;
  injFace.position.set(X_FACE + 0.011, AXIS_Y, 0);
  engine.add(injFace);
  internals.push(injFace);

  // DELIBERATE SCALE BREAK: the pintle assembly is drawn ~1.6x oversize. At
  // true scale the post is 75 mm, which is 20 px even in the macro shot — the
  // one part of this engine the story turns on, invisible.
  const POST_R = 0.052;
  const pintleSleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.088, 0.088, 0.078, 32, 1, true),
    materials.brushedSteel(0xa6aeb8),
  );
  pintleSleeve.rotation.z = Math.PI / 2;
  pintleSleeve.position.set(X_FACE + 0.039, AXIS_Y, 0);
  engine.add(pintleSleeve);
  internals.push(pintleSleeve);

  const pintlePost = new THREE.Mesh(
    new THREE.CylinderGeometry(POST_R, POST_R, 0.13, 28),
    polishedMat(),
  );
  pintlePost.rotation.z = Math.PI / 2;
  pintlePost.position.set(X_FACE + 0.065, AXIS_Y, 0);
  engine.add(pintlePost);
  internals.push(pintlePost);
  const pintleTip = new THREE.Mesh(
    new THREE.SphereGeometry(POST_R, 20, 14),
    polishedMat(),
  );
  pintleTip.scale.x = 0.7;
  pintleTip.position.set(X_FACE + 0.13, AXIS_Y, 0);
  engine.add(pintleTip);
  internals.push(pintleTip);
  // the radial slots the fuel sheet leaves through
  for (let i = 0; i < 16; i++) {
    const th = (i / 16) * TAU;
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.024, 0.012), linerMat);
    slot.position.set(X_FACE + 0.115, AXIS_Y + Math.sin(th) * POST_R, Math.cos(th) * POST_R);
    slot.rotation.x = -th;
    engine.add(slot);
    internals.push(slot);
  }

  // fuel leaves as a flat radial sheet; LOX sleeves it as an annular sheet.
  // They collide at right angles — that collision IS the atomiser.
  // NormalBlending, not additive. These are thin DoubleSide shells and every
  // camera that shows a radial sheet sees it near edge-on, where additive piles
  // dozens of fragments on the same pixels and the rim renders as a lens-flare
  // streak clean across the frame.
  const sprayMat = new THREE.MeshBasicMaterial({
    color: 0xffd9a0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  // A shallow CONE, not a flat ring. Physically the sheet leaves almost purely
  // radial, but a zero-thickness disc seen near edge-on renders as a bright
  // horizontal streak that reads as lens flare; 20 mm of downstream flare gives
  // it a surface to catch light on, so it reads as a sheet from any angle.
  const fuelSheet = new THREE.Mesh(
    // rotation.z = +90 deg sends the cylinder's TOP to -X, so the big radius
    // must be the BOTTOM for the flare to open downstream
    new THREE.CylinderGeometry(POST_R + 0.004, 0.15, 0.022, 48, 1, true),
    sprayMat,
  );
  fuelSheet.rotation.z = Math.PI / 2;
  fuelSheet.position.set(X_FACE + 0.126, AXIS_Y, 0);
  engine.add(fuelSheet);
  internals.push(fuelSheet);
  const loxSheetMat = new THREE.MeshBasicMaterial({
    color: 0xbfe4ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const loxSheet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.082, 0.074, 0.1, 40, 1, true),
    loxSheetMat,
  );
  loxSheet.rotation.z = Math.PI / 2;
  loxSheet.position.set(X_FACE + 0.06, AXIS_Y, 0);
  engine.add(loxSheet);
  internals.push(loxSheet);

  // --- the gas column: chamber -> throat -> bell ------------------------------
  const gasMat = new THREE.MeshBasicMaterial({
    map: gasGradient(),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  // starts just downstream of the pintle tip — the gas does not exist until the
  // two sheets have collided
  const gasProfile = sliceProfile(inner, X_FACE + 0.17, X_EXIT).map(([x, r]) => [x, r * 0.93]);
  const gasColumn = shellSurface(gasProfile, { seg: 96 }, gasMat);
  gasColumn.castShadow = false;
  engine.add(gasColumn);

  // Deliberately feeble, and parked well downstream of the injector hardware.
  // Measured: at 2.6 this ONE light was the whole clipping failure (175 clipped
  // px with it on, 22 with it off) — it sits inches from polished metal and
  // inverse-square does the rest. The gas column is what should read as glow;
  // this only has to spill a little colour onto the chamber wall.
  const chamberLight = new THREE.PointLight(0xff9a52, 0, 1.4, 2);
  chamberLight.position.set(X_FACE + 0.34, AXIS_Y, 0);
  engine.add(chamberLight);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 18, 14),
    new THREE.MeshBasicMaterial({
      color: 0xffe6bc,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  core.scale.set(1.6, 1, 1);
  core.position.set(X_FACE + 0.23, AXIS_Y, 0);
  engine.add(core);

  // --- turbopump --------------------------------------------------------------
  const pumpProfile = [
    [-1.34, 0.05],
    [-1.32, 0.108],
    [-1.3, 0.128],
    [-1.19, 0.132],
    [-1.16, 0.118],
    [-1.13, 0.128],
    [-1.12, 0.148],
    [-0.98, 0.152],
    [-0.96, 0.132],
    [-0.93, 0.142],
    [-0.92, 0.162],
    [-0.74, 0.166],
    [-0.72, 0.14],
    [-0.7, 0.108],
    [-0.68, 0.062],
  ];
  const pumpInnerProfile = pumpProfile.map(([x, r]) => [x, Math.max(0.028, r - 0.02)]);

  function buildPump(cut) {
    const g = new THREE.Group();
    const t0 = cut ? GAP_C + GAP_HALF : 0;
    const tl = cut ? TAU - 2 * GAP_HALF : TAU;
    const arc = { thetaStart: t0, thetaLen: tl, seg: 96 };
    g.add(shellSurface(pumpProfile, arc, pumpMat));
    if (cut) {
      g.add(shellSurface(pumpInnerProfile, { ...arc, inward: true }, linerMat));
      g.add(cutFace(pumpInnerProfile, pumpProfile, GAP_C + GAP_HALF, cutFaceMat));
      g.add(cutFace(pumpInnerProfile, pumpProfile, GAP_C - GAP_HALF, cutFaceMat));
    }
    g.position.y = PUMP_Y - AXIS_Y;
    return g;
  }
  const pumpSealed = buildPump(false);
  const pumpCut = buildPump(true);
  engine.add(pumpSealed, pumpCut);
  sealedShells.push(pumpSealed);
  cutShells.push(pumpCut);

  // rotor: ONE shaft, one turbine wheel, two impellers. All of it turns
  // together — that is the whole point of a single-shaft turbopump.
  const rotor = new THREE.Group();
  rotor.position.set(0, PUMP_Y, 0);
  engine.add(rotor);
  internals.push(rotor);

  const shaftGeo = new THREE.CylinderGeometry(0.021, 0.021, 0.66, 20);
  shaftGeo.rotateZ(Math.PI / 2);
  const shaft = new THREE.Mesh(shaftGeo, polishedMat());
  shaft.position.x = -1.0;
  rotor.add(shaft);

  // roughnessMap MULTIPLIES (map texels ~0.5), so 0.96 lands near 0.48 —
  // matte. The preset default read as chrome and a ring of curved chrome plates
  // always finds an angle that mirrors the studio softbox into the lens.
  const turbBladeMat = materials.brushedSteel(0x9c7a5e);
  turbBladeMat.roughness = 0.96;
  const turbine = bladeRing(
    {
      blades: 42,
      hubR: 0.042,
      span: 0.062,
      chord: 0.036,
      camber: 0.09,
      twist: -0.85,
      twistTip: -0.4,
      hubDepth: 0.03,
      hubMaterial: materials.brushedSteel(0x8d7358),
    },
    turbBladeMat,
  );
  turbine.group.rotation.y = Math.PI / 2;
  turbine.group.position.x = X_TURBINE;
  rotor.add(turbine.group);

  const impBladeMat = materials.brushedSteel(0xb4bdc8);
  impBladeMat.roughness = 0.95;
  for (const [ix, tipR, blades] of [
    [X_FUEL_IMP, 0.118, 9],
    [X_LOX_IMP, 0.13, 9],
  ]) {
    // Low twist on purpose: a centrifugal impeller is a disc carrying curved
    // RADIAL vanes, and the heavily-twisted first attempt read as a pinwheel
    // fan. The camber is what makes them backward-curved.
    const imp = bladeRing(
      {
        blades,
        hubR: 0.03,
        span: tipR - 0.03,
        chord: 0.062,
        chordTip: 0.042,
        camber: 0.3,
        twist: 0.26,
        twistTip: 0.1,
        hubDepth: 0.03,
        hubMaterial: materials.brushedSteel(0xa4adb8),
      },
      impBladeMat,
    );
    imp.group.rotation.y = Math.PI / 2;
    imp.group.position.x = ix;
    rotor.add(imp.group);
    // back plate — a real impeller is a bladed disc, not a bare ring of vanes
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(tipR, tipR, 0.012, 40),
      materials.brushedSteel(0xa4adb8),
    );
    plate.rotation.z = Math.PI / 2;
    plate.position.x = ix + 0.034;
    rotor.add(plate);
  }

  // turbine inlet manifold — the scroll that wraps the drive gas onto the blades
  const turbScroll = new THREE.Mesh(
    new THREE.TorusGeometry(0.116, 0.03, 12, 40),
    hotDuctMat,
  );
  turbScroll.rotation.y = Math.PI / 2;
  turbScroll.position.set(X_TURBINE - 0.05, PUMP_Y, 0);
  engine.add(turbScroll);

  // --- gas generator ----------------------------------------------------------
  const ggBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.052, 0.15, 28),
    materials.aluminum(0xa2a9b3),
  );
  ggBody.rotation.z = Math.PI / 2;
  ggBody.position.copy(GG);
  ggBody.castShadow = true;
  engine.add(ggBody);
  const ggCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 20, 14),
    materials.aluminum(0xa2a9b3),
  );
  ggCap.scale.x = 0.6;
  ggCap.position.set(GG.x - 0.075, GG.y, GG.z);
  engine.add(ggCap);
  const ggFlame = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0xff9c4a,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  ggFlame.scale.set(1.5, 1, 1);
  ggFlame.position.copy(GG);
  engine.add(ggFlame);
  internals.push(ggFlame);

  // --- external plumbing ------------------------------------------------------
  // Every run is routed OUTSIDE the cutaway wedge so nothing hangs in the hole.
  const loxInlet = tubeAlong(
    [
      [-0.52, 2.24, 0],
      [-0.55, 2.0, 0],
      [-0.62, 1.83, 0],
      [-0.7, 1.74, 0],
    ],
    0.052,
    loxDuctMat,
    { tubularSegments: 40 },
  );
  engine.add(loxInlet);

  const fuelInlet = tubeAlong(
    [
      [-1.36, 2.24, -0.06],
      [-1.24, 2.0, -0.05],
      [-1.12, 1.83, -0.02],
      [-1.05, 1.75, 0],
    ],
    0.046,
    fuelDuctMat,
    { tubularSegments: 40 },
  );
  engine.add(fuelInlet);

  const loxMain = tubeAlong(
    [
      [-0.8, 1.6, 0.07],
      [-0.86, 1.53, 0.07],
      [-0.93, 1.45, 0.04],
      [-0.97, 1.38, 0],
    ],
    0.044,
    loxDuctMat,
    { tubularSegments: 30 },
  );
  engine.add(loxMain);

  // fuel downcomer: pump discharge all the way to the coolant manifold near the
  // exit, because the fuel cools the wall BEFORE it is burned
  const downPts = [
    [-1.03, 1.58, -0.12],
    [-0.86, 1.5, -0.15],
    [-0.5, 1.45, -0.18],
    [-0.15, 1.44, -0.2],
    [0.15, 1.48, -0.26],
    [X_COOLANT, 1.52, -0.3],
  ];
  const downcomer = tubeAlong(downPts, 0.038, fuelDuctMat, { tubularSegments: 70 });
  engine.add(downcomer);

  // gas-generator feed taps
  const ggFeedPts = [
    [-1.05, 1.55, -0.09],
    [-1.18, 1.36, -0.03],
    [-1.26, 1.2, 0.06],
    [GG.x + 0.01, GG.y + 0.06, GG.z - 0.01],
  ];
  const ggFeed = tubeAlong(ggFeedPts, 0.019, fuelDuctMat, { tubularSegments: 40 });
  engine.add(ggFeed);
  const ggLox = tubeAlong(
    [
      [-0.95, 1.42, 0.06],
      [-1.1, 1.28, 0.13],
      [-1.22, 1.16, 0.17],
      [GG.x + 0.04, GG.y + 0.05, GG.z + 0.04],
    ],
    0.017,
    loxDuctMat,
    { tubularSegments: 40 },
  );
  engine.add(ggLox);

  // hot-gas duct: gas generator up to the turbine scroll. Swung OUTBOARD to
  // x -1.52 on the way up: routed close in, it climbed straight across the
  // turbine's face and hid the one wheel step 3 ends by pointing at.
  const hotPts = [
    [GG.x - 0.02, GG.y + 0.03, GG.z + 0.02],
    [-1.38, 1.14, 0.2],
    [-1.46, 1.34, 0.17],
    [-1.47, 1.55, 0.1],
    [-1.42, 1.66, 0.05],
    [-1.38, PUMP_Y - 0.02, 0.02],
  ];
  const hotDuct = tubeAlong(hotPts, 0.031, hotDuctMat, { tubularSegments: 50 });
  engine.add(hotDuct);

  // turbine exhaust duct: down the -X face, along the underside, into the
  // film-cooling manifold. This gas is spent — dumping it overboard is exactly
  // what makes a gas-generator cycle simple and slightly inefficient.
  // Its low point stays on the camera side around x -1.3 (that stretch IS the
  // subject of step 4), then the long run swings just BEHIND the lower
  // centreline. Held at theta -77 the whole way, it passed inches under the
  // injector and turned into a fat dark cylinder across the pintle macro.
  const texPts = [
    [X_TURBINE - 0.06, PUMP_Y - 0.07, -0.07],
    [-1.4, 1.5, -0.11],
    [-1.44, 1.26, -0.06],
    [-1.36, 1.12, 0.02],
    [-1.14, 1.08, 0.04],
    [-0.9, 1.1, -0.02],
    [-0.5, 1.11, -0.05],
    [-0.1, 1.11, -0.06],
    [0.18, 1.03, -0.05],
    [0.4, 0.97, -0.03],
    [X_TEX, 0.94, -0.02],
  ];
  const texDuct = tubeAlong(texPts, 0.036, hotDuctMat, { tubularSegments: 90 });
  engine.add(texDuct);

  // igniter line (TEA-TEB, the hypergolic slug that lights a kerolox engine)
  const igniter = tubeAlong(
    [
      [-1.2, 1.5, 0.1],
      [-1.06, 1.46, 0.14],
      [-0.95, 1.42, 0.11],
      [-0.9, 1.4, 0.06],
    ],
    0.012,
    materials.brushedSteel(0x6f7783),
    { tubularSegments: 24 },
  );
  engine.add(igniter);

  // pressure-transducer bosses on the chamber — small, but their absence is
  // what makes a CG engine look like a toy
  for (const [bx, bth] of [
    [X_FACE + 0.09, -1.15],
    [X_FACE + 0.24, 2.5],
    [X_THROAT - 0.06, -1.35],
  ]) {
    const br = contourR(outer, bx);
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.036, 12), boltMat);
    const [px, py, pz] = onShell(bx, br, bth);
    boss.position.set(px, py, pz);
    boss.rotation.x = Math.PI / 2 - bth;
    engine.add(boss);
  }

  // --- gimbal actuators -------------------------------------------------------
  // Bodies are braced against the THRUST RING (they must not swing with the engine);
  // each one tracks its lug on the dome every frame and its rod extends.
  // Both run BELOW the centreline with their lugs on the dome's lower half.
  // Two earlier placements failed: at +Z and level with the injector they laid a
  // fat dark bar across the pintle shot, and swinging one up to PUMP_Y put it
  // straight through the turbopump. Low keeps them out of every macro subject
  // (the pump is above the axis, the pintle is on it) while staying visible in
  // the wide gimbal shot, which is the one step that needs them.
  // anchors sit ON the thrust ring at -72 and -145 deg; lugs on the dome's lower
  // half. Both runs stay below the centreline: above it they crossed the
  // turbopump, and on the +Z side they laid a dark bar across the pintle macro.
  const actAnchor = (thetaDeg) => {
    const t = (thetaDeg * Math.PI) / 180;
    return new THREE.Vector3(
      THRUST_RING_X,
      AXIS_Y + Math.sin(t) * THRUST_RING_R,
      Math.cos(t) * THRUST_RING_R,
    );
  };
  const ACT = [
    { anchor: actAnchor(-72), lug: new THREE.Vector3(-1.02, 1.16, 0.06) },
    { anchor: actAnchor(-145), lug: new THREE.Vector3(-1.02, 1.2, -0.13) },
  ];
  const Z_AXIS = new THREE.Vector3(0, 0, 1);
  const actuators = ACT.map(({ anchor, lug }) => {
    const g = new THREE.Group();
    g.position.copy(anchor);
    mount.add(g);
    const bodyLen = 0.42;
    const bodyGeo = new THREE.CylinderGeometry(0.038, 0.042, bodyLen, 20);
    bodyGeo.rotateX(Math.PI / 2);
    bodyGeo.translate(0, 0, bodyLen / 2);
    const body = new THREE.Mesh(bodyGeo, materials.aluminum(0x8f97a1));
    body.castShadow = true;
    g.add(body);
    const rodGeo = new THREE.CylinderGeometry(0.019, 0.019, 1, 14);
    rodGeo.rotateX(Math.PI / 2);
    rodGeo.translate(0, 0, 0.5);
    const stem = new THREE.Mesh(rodGeo, polishedMat());
    stem.position.z = bodyLen;
    g.add(stem);
    // rod-end bearing at the anchor. NOT named `mount` — that shadowed the
    // outer mount group and threw a TDZ ReferenceError on the `mount.add(g)`
    // four lines up, which the dev server reports as a blank page.
    const rodEnd = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 14, 10),
      materials.brushedSteel(0x8b939d),
    );
    g.add(rodEnd);
    // the lug the rod pushes on, carried by the engine
    const lugMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, 0.05),
      materials.brushedSteel(0x939ba5),
    );
    lugMesh.position.copy(lug);
    engine.add(lugMesh);
    return { group: g, stem, bodyLen, anchor, lug };
  });

  // --- plume ------------------------------------------------------------------
  const plume = new THREE.Group();
  engine.add(plume);
  const PLUME_L = 1.05;
  const plumeMat = new THREE.MeshBasicMaterial({
    map: plumeGradient(),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  // barely flaring: a sea-level plume leaves the lip almost parallel, and a
  // visibly cone-shaped one reads as a party hat glued to the nozzle
  const plumeGeo = new THREE.CylinderGeometry(EXIT_R * 1.02, EXIT_R * 0.95, PLUME_L, 40, 1, true);
  plumeGeo.rotateZ(-Math.PI / 2);
  plumeGeo.translate(PLUME_L / 2, 0, 0);
  const plumeCone = new THREE.Mesh(plumeGeo, plumeMat);
  plumeCone.position.set(X_EXIT, AXIS_Y, 0);
  plume.add(plumeCone);

  // mach diamonds — the standing shock train a sea-level bell always shows.
  // Kept to the first half, where the plume gradient is still bright enough to
  // hold them; further out they float in nothing.
  const diamondMat = new THREE.MeshBasicMaterial({
    color: 0xffd9a4,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const diamonds = [];
  [0.14, 0.34, 0.5, 0.63].forEach((dx, i) => {
    const s = 1 - i * 0.19;
    // narrow lenses, not spheres: at 0.5 x EXIT_R these rendered as big pale
    // bubbles floating in the plume instead of a shock train
    const d = new THREE.Mesh(new THREE.SphereGeometry(EXIT_R * 0.34 * s, 18, 12), diamondMat);
    d.scale.set(0.22, 1, 1);
    d.position.set(X_EXIT + dx, AXIS_Y, 0);
    plume.add(d);
    diamonds.push(d);
  });

  // --- flow streams -----------------------------------------------------------
  // Each stream is one arc-length-parameterised chain, so a single 0-1 phase
  // advancing whole cycles per lap keeps every packet seamless at the wrap.
  const loxPath = chainPath([
    nudgeZ(
      [
        [-0.52, 2.26, 0],
        [-0.56, 1.98, 0],
        [-0.64, 1.81, 0],
        [-0.72, 1.74, 0],
      ],
      0.056,
    ),
    liftOffAxis(
      [
        [-0.72, PUMP_Y, 0],
        [-0.8, PUMP_Y, 0.03],
        [-0.82, 1.6, 0.07],
      ],
      0.05,
    ),
    liftOffAxis(
      [
        [-0.82, 1.6, 0.07],
        [-0.88, 1.51, 0.07],
        [-0.95, 1.43, 0.03],
        [-0.98, 1.37, 0],
      ],
      0.048,
    ),
    [
      [-0.98, 1.37, 0],
      [-0.92, AXIS_Y, 0.02],
      [-0.82, AXIS_Y + 0.05, 0],
      [X_FACE + 0.02, AXIS_Y + 0.055, 0],
      [X_FACE + 0.075, AXIS_Y + 0.03, 0],
    ],
  ]);
  const loxFlow = flowStream(loxPath, { count: 15, color: LOX_COLOR, size: 0.019 });
  engine.add(loxFlow.group);

  // fuel: inlet -> pump -> ALL the way down the outside -> forward through the
  // wall -> injector. The long way round is the point of regenerative cooling.
  // Rides just OUTSIDE the jacket rather than at mid-wall. The channels really
  // are buried in the wall, but buried packets are invisible packets, and step 7
  // is built entirely on being able to watch the fuel climb the bell.
  const jacketRun = [];
  for (let i = 0; i <= 22; i++) {
    const x = X_COOLANT + ((X_FACE + 0.02 - X_COOLANT) * i) / 22;
    const r = contourR(inner, x) + WALL + 0.018;
    jacketRun.push(onShell(x, r, 1.95)); // ~112 deg: over the top, not round the back
  }
  const fuelPath = chainPath([
    nudgeZ(
      [
        [-1.36, 2.26, -0.06],
        [-1.25, 2.0, -0.05],
        [-1.13, 1.84, -0.02],
        [-1.05, 1.76, 0],
      ],
      0.05,
    ),
    liftOffAxis(
      [
        [-1.05, PUMP_Y, 0],
        [-1.05, 1.62, -0.07],
        [-1.03, 1.58, -0.12],
      ],
      0.048,
    ),
    liftOffAxis(downPts, 0.042),
    jacketRun,
    [
      jacketRun[jacketRun.length - 1],
      [X_FACE - 0.04, AXIS_Y + 0.12, -0.06],
      [X_FACE - 0.06, AXIS_Y, 0],
      [X_FACE + 0.05, AXIS_Y, 0],
      [X_FACE + 0.115, AXIS_Y, 0],
    ],
  ]);
  const fuelFlow = flowStream(fuelPath, { count: 26, color: FUEL_COLOR, size: 0.019 });
  engine.add(fuelFlow.group);

  // the drive circuit: a tap of propellant -> gas generator -> turbine -> down
  // the exhaust duct -> a cool film on the skirt -> out
  const drivePath = chainPath([
    liftOffAxis(ggFeedPts, 0.023),
    liftOffAxis(hotPts, 0.035),
    [
      [-1.38, PUMP_Y - 0.02, 0.02],
      [X_TURBINE, PUMP_Y, 0],
      [X_TURBINE - 0.05, PUMP_Y - 0.06, -0.05],
    ],
    liftOffAxis(texPts, 0.04),
    // the cool film, laid along the FAR inner wall (theta ~200 deg): on the near
    // wall it would be hidden behind the very metal the cutaway leaves standing
    [
      onShell(X_TEX + 0.02, contourR(inner, X_TEX + 0.02) * 0.97, 3.49),
      onShell(0.66, contourR(inner, 0.66) * 0.97, 3.49),
      onShell(X_EXIT, EXIT_R * 0.97, 3.49),
    ],
  ]);
  const driveFlow = flowStream(drivePath, { count: 24, color: DRIVE_COLOR, size: 0.019 });
  engine.add(driveFlow.group);

  // main-chamber gas, riding half-radius so it reads inside the cutaway, then
  // out into the plume
  const hotRun = [];
  for (let i = 0; i <= 26; i++) {
    const x = X_FACE + 0.12 + ((X_EXIT - X_FACE - 0.12) * i) / 26;
    hotRun.push(onShell(x, contourR(inner, x) * 0.52, GAP_C));
  }
  const hotPath = chainPath([
    hotRun,
    [
      hotRun[hotRun.length - 1],
      onShell(1.25, EXIT_R * 0.55, GAP_C),
      onShell(1.85, EXIT_R * 0.6, GAP_C),
      onShell(2.3, EXIT_R * 0.66, GAP_C),
    ],
  ]);
  const hotFlow = flowStream(hotPath, { count: 20, color: 0xffc27a, size: 0.02 });
  engine.add(hotFlow.group);

  // --- callouts ---------------------------------------------------------------
  // Anchors sit ON their part; leaders aim right/up-right because every step
  // composes the engine into the right two-thirds, clear of the text panel.
  const labels = calloutSets(['exterior', 'feed', 'pump', 'gg', 'inj', 'cham', 'noz', 'gim']);
  const anchor = (set, text, pos, dir, len) => {
    const holder = new THREE.Object3D();
    holder.position.set(...pos);
    engine.add(holder);
    return labels.add(set, holder, text, [0, 0, 0], dir, len);
  };

  anchor('exterior', 'Gimbal bearing', [X_PIVOT, AXIS_Y - 0.08, 0.06], -40, 132);
  anchor('exterior', 'Turbopump', [-1.05, PUMP_Y + 0.14, 0.06], 28, 78);
  anchor('exterior', 'Gas generator', [GG.x, GG.y - 0.05, GG.z + 0.04], -20, 100);
  anchor('exterior', 'Combustion chamber', [X_FACE + 0.2, AXIS_Y + 0.19, 0.06], 74, 62);
  anchor('exterior', 'Nozzle bell', [0.18, AXIS_Y + 0.27, 0.1], 56, 72);
  anchor('exterior', 'Exit · 0.92 m', [X_EXIT, AXIS_Y - EXIT_R - 0.02, 0.1], -34, 68);

  anchor('feed', 'LOX inlet', [-0.56, 2.02, 0.05], 26, 60);
  anchor('feed', 'Fuel inlet', [-1.26, 2.0, -0.04], 120, 54);
  anchor('feed', '150 bar out', [-0.86, 1.53, 0.09], -20, 72);
  anchor('feed', 'Down to the nozzle first', [-0.4, 1.45, -0.19], -120, 78);

  anchor('pump', 'Turbine', [X_TURBINE, PUMP_Y + 0.11, 0.04], 126, 52);
  anchor('pump', 'Fuel impeller', [X_FUEL_IMP, PUMP_Y + 0.08, 0.09], 88, 60);
  anchor('pump', 'LOX impeller', [X_LOX_IMP, PUMP_Y + 0.07, 0.1], 40, 64);
  anchor('pump', 'One shaft · 36,000 rpm', [-1.0, PUMP_Y - 0.05, 0.05], -42, 76);

  anchor('gg', 'Gas generator', [GG.x, GG.y - 0.04, GG.z + 0.05], -98, 70);
  anchor('gg', 'Hot-gas duct', [-1.49, 1.34, 0.16], 40, 80);
  anchor('gg', 'Turbine', [X_TURBINE, PUMP_Y - 0.1, 0.04], 150, 58);
  // on the duct's low point, which is the stretch step 4's camera actually
  // frames — the old anchor sat out at the skirt manifold, 1.8 units off-frame
  anchor('gg', 'Turbine exhaust', [-1.2, 1.06, 0.05], -60, 76);

  anchor('inj', 'Pintle post', [X_FACE + 0.075, AXIS_Y + 0.05, 0.04], 106, 56);
  anchor('inj', 'Fuel — radial sheet', [X_FACE + 0.13, AXIS_Y + 0.15, 0.04], 44, 70);
  anchor('inj', 'LOX — annular sheet', [X_FACE + 0.05, AXIS_Y - 0.085, 0.05], -56, 70);
  anchor('inj', 'Injector face', [X_FACE + 0.012, AXIS_Y + 0.15, 0.08], 132, 54);

  anchor('cham', '97 bar · 3,300 °C', [X_FACE + 0.24, AXIS_Y + 0.16, 0.07], 70, 74);
  anchor('cham', 'Throat · Mach 1', [X_THROAT, AXIS_Y - THROAT_R - 0.03, 0.05], -78, 62);
  // on the LOWER wall: the cutaway removes the upper-front wedge, so the channel
  // wall the copy names is only actually visible along the bottom cut edge.
  // Pushed downstream and aimed shallow so it stops colliding with the throat.
  anchor('cham', 'Coolant channels', [X_THROAT + 0.28, AXIS_Y - 0.26, 0.1], -26, 78);

  anchor('noz', 'Fuel climbs up', [0.1, 1.595, -0.099], 128, 64);
  anchor('noz', 'Gas expands down', [0.26, AXIS_Y + 0.12, 0.12], 46, 72);
  anchor('noz', 'Area ratio 16 : 1', [X_EXIT - 0.03, AXIS_Y + EXIT_R + 0.02, 0.08], 62, 60);
  anchor('noz', 'Mach ~3.5 at the lip', [X_EXIT, AXIS_Y - EXIT_R - 0.03, 0.1], -36, 66);

  anchor('gim', 'Gimbal bearing', [X_PIVOT + 0.02, AXIS_Y + 0.09, 0.06], 68, 86);
  anchor('gim', 'Pitch actuator', [-1.34, 1.02, 0.08], -74, 76);
  anchor('gim', 'Yaw actuator', [-1.34, 1.1, -0.22], -34, 92);
  anchor('gim', '± 5° of steering', [0.42, AXIS_Y - 0.3, 0.12], -42, 68);

  // --- pose -------------------------------------------------------------------
  const state = { cut: 0, spin: 0, flow: 0, burn: 0, thrust: 0, gimbal: 0, dots: 0, mount: 1 };
  const PIVOT = new THREE.Vector3(X_PIVOT, AXIS_Y, 0);
  const lugWorld = new THREE.Vector3();
  const actDir = new THREE.Vector3();
  const euler = new THREE.Euler();

  function apply() {
    // cutaway is BINARY: metal cannot be ghosted (a half-transparent aluminium
    // casing still reads solid), so the sealed and cut twins swap outright and
    // the camera flight covers the pop
    const open = state.cut > 0.5;
    for (const m of sealedShells) m.visible = !open;
    for (const m of cutShells) m.visible = open;
    for (const m of internals) m.visible = open;
    const mounted = state.mount > 0.5;
    mount.visible = mounted;
    ball.visible = mounted;

    rotor.rotation.x = -state.spin;

    // gimbal: pitch in the XY plane, a little yaw a quarter-cycle behind, so the
    // bell traces a cone rather than swinging in one plane like a pendulum
    const pitch = state.gimbal;
    const yaw = state.gimbal * 0.45;
    gimbalPivot.rotation.set(0, yaw, pitch);

    // actuators live on the stand, so they must chase their lugs by hand
    euler.set(0, yaw, pitch);
    for (const a of actuators) {
      lugWorld.copy(a.lug).sub(PIVOT).applyEuler(euler).add(PIVOT);
      actDir.copy(lugWorld).sub(a.anchor);
      const dist = actDir.length();
      a.group.quaternion.setFromUnitVectors(Z_AXIS, actDir.normalize());
      a.stem.scale.z = Math.max(0.05, dist - a.bodyLen);
    }

    // Combustion. `flow` advances a WHOLE number of cycles per lap, so any
    // sine of (flow * TAU * integer) lands back on its starting value at the
    // wrap — that is the whole seamlessness contract for the flicker.
    const flicker = 1 + Math.sin(state.flow * TAU * 6) * 0.05;
    const b = clamp01(state.burn);
    gasMat.opacity = b * 0.92 * flicker;
    gasColumn.visible = b > 0.01;
    chamberLight.intensity = b * 0.85;
    core.material.opacity = b * 0.3 * flicker;
    sprayMat.opacity = b > 0.01 ? 0.14 + 0.28 * b : 0;
    loxSheetMat.opacity = b > 0.01 ? 0.12 + 0.22 * b : 0;
    ggFlame.material.opacity = b * 0.34 * (1 + Math.sin(state.flow * TAU * 11) * 0.12);

    // Plume opacities are deliberately low: the cone is DoubleSide and the
    // diamonds are additive on top of it, so a ray can cross four bright
    // surfaces. At 0.5 each that stack clips to white and fails the gate.
    const th = clamp01(state.thrust);
    plume.visible = th > 0.01;
    plumeMat.opacity = th * 0.62 * flicker; // the gradient does most of the work
    plumeCone.scale.set(th * flicker, 1, 1);
    diamondMat.opacity = th * 0.2;
    diamonds.forEach((d, i) => {
      d.visible = th > 0.35;
      d.position.x = X_EXIT + (0.14 + i * 0.17) * th;
    });

    const showDots = state.dots > 0.5;
    loxFlow.group.visible = showDots;
    fuelFlow.group.visible = showDots;
    driveFlow.group.visible = showDots;
    hotFlow.group.visible = showDots && b > 0.01;
    if (showDots) {
      loxFlow.set(state.flow);
      fuelFlow.set(state.flow);
      driveFlow.set(state.flow);
      hotFlow.set(state.flow * 3); // gas is the fastest thing in here — and 3,
    } //                              not 2.5, or the wrap stops being seamless
  }

  function set(partial) {
    Object.assign(state, partial);
    apply();
  }

  set({ cut: 0, spin: 0, flow: 0, burn: 0, thrust: 0, gimbal: 0, dots: 0, mount: 1 });
  labels.setLabels(false);

  return {
    group: sceneGroup,
    state,
    set,
    setLabels: labels.setLabels,
    // probed by verify.mjs and reviewers
    parts: { engine, gimbalPivot, rotor, turbine: turbine.group, plume, gasColumn },
  };
}
