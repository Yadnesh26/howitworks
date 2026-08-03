import * as THREE from 'three';
import { materials, rod, box, disc, studioPlinth } from '../../framework/parts.js';
import { beveledBox, lathe, chainPath } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { callout } from '../../framework/labels.js';
import { TAU } from '../../framework/motion.js';

// "How GPS works" — staged as a museum orrery: a studio globe on a stand,
// ringed by the real GPS constellation geometry, with a close-up "hero"
// cluster of satellites used to teach trilateration against a receiver pin
// on the globe's surface.
//
// Reference facts (GPS.gov Space Segment, FAA GNSS "How It Works",
// ciechanow.ski/gps, MathWorks "GPS and How It Works" — cross-checked):
//  - 6 orbital planes, 60° apart, each carrying satellites in medium Earth
//    orbit (MEO) at ~20,200 km altitude — orbit RADIUS from Earth's center
//    is ~26,560 km, about 4.17x Earth's own 6,371 km radius. The baseline
//    constellation is 24 satellites (4/plane); 31+ fly today.
//  - Each plane is inclined 55° to the equator. Orbital period is 11h58m —
//    half a sidereal day, so every satellite laps Earth exactly twice a day.
//  - Every satellite continuously broadcasts on L1 (1575.42 MHz): a unique
//    PRN spreading code (so all satellites can share one frequency, CDMA)
//    plus a navigation message carrying its own precise orbital position
//    (ephemeris) and the exact time it sent the signal.
//  - A receiver measures the signal's travel time and multiplies by the
//    speed of light: pseudorange = c x (receive time - send time). That
//    range is a SPHERE of equally-possible positions centered on the
//    satellite (the receiver doesn't yet know direction, only distance).
//  - Three spheres intersect at (essentially) one point — but the
//    receiver's own clock is a cheap quartz oscillator with an unknown
//    offset shared by every range measurement, which blurs that
//    intersection. A 4th satellite supplies a 4th equation, letting the
//    receiver solve x, y, z AND its own clock bias simultaneously — this is
//    why a GPS fix needs a minimum of 4 satellites, not 3.
//  - Satellite clocks are atomic (cesium/rubidium), stable to nanoseconds:
//    1 microsecond of timing error is ~300 m of position error (c x 1us).
//    Because they sit in weaker gravity and move at orbital speed, general
//    and special relativity together make them gain about 38 microseconds
//    per day relative to a ground clock if left uncorrected — engineers
//    offset the onboard clock rate before launch to cancel it out.

// ---------------------------------------------------------------------------
// world constants
// ---------------------------------------------------------------------------
const GLOBE_R = 0.7;
const ORBIT_R = 2.9; // ~4.14x GLOBE_R, matching the real ~4.17x ratio
const INCLINATION = THREE.MathUtils.degToRad(55);
const PLANES = 6;
const SATS_PER_PLANE = 4;
const PLINTH_H = 0.22;
const Y_CENTER = 2.9; // globe center height above the floor
const GLOBE_CENTER = new THREE.Vector3(0, Y_CENTER, 0);

const ACCENT = 0x5ad1ff;
const WARM = 0xffb066;

// ---------------------------------------------------------------------------
// procedural Earth colour map — stylised ocean + landmass blobs + cloud
// streaks on a 2:1 equirectangular canvas. Not real geography; a recognisable
// "blue marble" read is all the mechanism needs.
// ---------------------------------------------------------------------------
function buildEarthTexture() {
  const w = 1024;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const ocean = ctx.createLinearGradient(0, 0, 0, h);
  ocean.addColorStop(0, '#0f4f7a');
  ocean.addColorStop(0.5, '#0b3d63');
  ocean.addColorStop(1, '#0a2f4d');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, w, h);

  function blob(cx, cy, r, tone) {
    ctx.fillStyle = tone;
    ctx.beginPath();
    const pts = 10;
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * TAU;
      const rr = r * (0.72 + Math.sin(a * 3 + cx) * 0.14 + Math.cos(a * 5 + cy) * 0.1);
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr * 0.62;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  const land = ['#2f6b3a', '#3c7a3f', '#6f7a3e', '#8a7a4a'];
  const seeds = [
    [150, 150, 95], [130, 300, 70], [260, 340, 55],
    [520, 130, 110], [560, 260, 60], [500, 330, 50],
    [760, 150, 100], [820, 300, 65], [900, 200, 45],
    [660, 400, 70],
  ];
  seeds.forEach(([x, y, r], i) => blob(x, y, r, land[i % land.length]));

  // faint cloud streaks
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = '#ffffff';
  for (let i = 0; i < 60; i++) {
    const y = Math.random() * h;
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.beginPath();
    const x0 = Math.random() * w;
    ctx.moveTo(x0, y);
    ctx.bezierCurveTo(x0 + 60, y + 10, x0 + 120, y - 10, x0 + 200, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildGlobe() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ map: buildEarthTexture(), roughness: 0.75, metalness: 0 });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R, 48, 32), mat);
  sphere.castShadow = true;
  sphere.receiveShadow = true;
  g.add(sphere);

  const atmoMat = new THREE.MeshBasicMaterial({
    color: 0x8fd3ff, transparent: true, opacity: 0.1, side: THREE.BackSide, depthWrite: false,
  });
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R * 1.035, 32, 24), atmoMat);
  g.add(atmo);

  return { group: g, sphere };
}

// Tapered display column, local +Y from y=0 up to `len`, wide decorative
// foot at the base and a narrow neck that plugs into the globe's south pole.
function buildStand(len) {
  const mat = materials.chrome(0xc7cdd6);
  mat.roughness = 0.28;
  const profile = [
    [0.15, 0], [0.15, 0.03], [0.055, 0.07],
    [0.045, len - 0.22], [0.085, len - 0.16], [0.05, len - 0.02], [0.05, len],
  ];
  return lathe(profile, mat, 28);
}

// ---------------------------------------------------------------------------
// mini satellite — the cheap constellation-swarm marker (24 of these orbit
// the globe continuously). Built along local +Z = zenith / away from Earth.
// ---------------------------------------------------------------------------
function buildMiniSat() {
  const g = new THREE.Group();
  const busMat = materials.paintedMetal(0xc9a24a);
  const bus = beveledBox(0.05, 0.05, 0.06, busMat, 0.008);
  g.add(bus);
  const panelMat = materials.paintedMetal(0x0c1830);
  panelMat.roughness = 0.4;
  [-1, 1].forEach((s) => {
    const panel = box(0.11, 0.045, 0.006, panelMat);
    panel.position.set(s * 0.085, 0, 0);
    g.add(panel);
  });
  return g;
}

// ---------------------------------------------------------------------------
// hero satellite — a detailed close-up model. Local +Z = zenith (away from
// Earth), local -Z = nadir (the face that must point at Earth); solar wings
// extend along local +-X.
// ---------------------------------------------------------------------------
function buildSatellite() {
  const g = new THREE.Group();

  const busMat = materials.paintedMetal(0xc9a24a); // gold MLI-foil bus
  busMat.roughness = 0.35;
  const bus = beveledBox(0.16, 0.16, 0.2, busMat, 0.018);
  g.add(bus);

  // nadir phased-array antenna (7-element hex pattern) on the -Z face
  const antennaBack = disc(0.09, 0.014, materials.paintedMetal(0x2a2d33), 24);
  antennaBack.rotation.x = Math.PI / 2;
  antennaBack.position.set(0, 0, -0.11);
  g.add(antennaBack);
  const elMat = materials.aluminum(0xd8dde3);
  const elems = [[0, 0]];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    elems.push([Math.cos(a) * 0.055, Math.sin(a) * 0.055]);
  }
  elems.forEach(([ex, ey]) => {
    const el = disc(0.018, 0.02, elMat, 12);
    el.rotation.x = Math.PI / 2;
    el.position.set(ex, ey, -0.125);
    g.add(el);
  });
  const antTipLocal = [0, 0, -0.13];

  // S-band whip antenna on the +Z (zenith) face
  const whip = rod(0.008, 0.12, materials.chrome(0xd0d5db), 8);
  whip.rotation.x = -Math.PI / 2;
  whip.position.set(0, 0, 0.1);
  g.add(whip);

  // solar wings: a short boom + two panels each side, thin cell-grid strips.
  // Each side is a pivot group rotating about the boom's local X axis — real
  // GPS satellites slowly yaw their arrays to keep facing the sun.
  const boomMat = materials.aluminum(0xb9c0c8);
  const panelMat = materials.paintedMetal(0x0c1830);
  panelMat.roughness = 0.38;
  const gridMat = materials.paintedMetal(0x1c3a5e);
  const pivots = [];
  [-1, 1].forEach((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.08, 0, 0);
    g.add(pivot);
    pivots.push(pivot);
    const boom = box(0.05, 0.02, 0.02, boomMat);
    boom.position.set(s * 0.03, 0, 0);
    pivot.add(boom);
    const panel = beveledBox(0.34, 0.14, 0.012, panelMat, 0.006);
    panel.position.set(s * 0.23, 0, 0);
    pivot.add(panel);
    for (let i = 0; i < 4; i++) {
      const strip = box(0.34, 0.012, 0.014, gridMat);
      strip.position.set(s * 0.23, -0.045 + i * 0.03, 0.001);
      pivot.add(strip);
    }
  });

  return {
    group: g,
    antTipLocal,
    setPanelAngle(rad) {
      pivots.forEach((p) => { p.rotation.x = rad; });
    },
  };
}

// A translucent+wireframe spherical CAP (a patch of a much bigger sphere),
// unit radius so callers just scale the mesh — cheap way to redraw a
// "sphere of possible positions" at any range without rebuilding geometry.
// Cap opens toward local +Y; orient the returned group's quaternion to aim
// +Y at the receiver.
function buildRangeCap(color) {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(1, 40, 20, 0, TAU, 0, THREE.MathUtils.degToRad(9));
  const fillMat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false,
  });
  const fill = new THREE.Mesh(geo, fillMat);
  g.add(fill);
  const wireMat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.28, wireframe: true, depthWrite: false,
  });
  const wire = new THREE.Mesh(geo, wireMat);
  g.add(wire);
  return { group: g, fillMat, wireMat };
}

// Simple flat clock face: rim, 12 tick marks, one sweeping hand. The face
// disc lies in the local XY plane (normal along +Z — that's the direction
// callers should aim at the camera); everything else sits just in front of
// it at a small +Z offset so it actually reads as a dial face-on.
function buildClockFace(color) {
  const g = new THREE.Group();
  const face = disc(0.09, 0.012, materials.paintedMetal(0x14161a), 32);
  face.rotation.x = Math.PI / 2;
  g.add(face);
  const rim = disc(0.095, 0.016, materials.chrome(0xc7cdd6), 32);
  rim.rotation.x = Math.PI / 2;
  rim.position.z = -0.001;
  g.add(rim);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const tick = box(0.006, 0.016, 0.002, materials.glow(color, 0.8));
    tick.position.set(Math.cos(a) * 0.078, Math.sin(a) * 0.078, 0.008);
    tick.rotation.z = a - Math.PI / 2;
    g.add(tick);
  }
  const hand = rod(0.006, 0.065, materials.glow(color, 1.4), 8);
  hand.position.z = 0.009;
  g.add(hand);
  return { group: g, setAngle: (rad) => { hand.rotation.z = -rad; } };
}

function buildReceiver() {
  const g = new THREE.Group();
  const pin = rod(0.014, 0.09, materials.aluminum(0xb9c0c8), 10);
  g.add(pin);
  const device = beveledBox(0.05, 0.09, 0.014, materials.paintedMetal(0x1a1c20), 0.006);
  device.position.y = 0.115;
  g.add(device);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 10), materials.glow(ACCENT, 1.8));
  dot.position.y = 0.16;
  g.add(dot);
  return { group: g, dot };
}

// ===========================================================================
export function buildGps({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  const plinth = studioPlinth({ w: 1.7, h: PLINTH_H, d: 1.7 });
  group.add(plinth);

  const standLen = (Y_CENTER - GLOBE_R) - PLINTH_H;
  const stand = buildStand(standLen);
  stand.position.set(0, PLINTH_H, 0);
  group.add(stand);

  const globe = buildGlobe();
  globe.group.position.copy(GLOBE_CENTER);
  group.add(globe.group);

  // -- orbital planes / swarm -------------------------------------------------
  const planes = [];
  for (let p = 0; p < PLANES; p++) {
    const planeGroup = new THREE.Group();
    planeGroup.rotation.order = 'YXZ';
    planeGroup.rotation.y = (p / PLANES) * TAU + p * 0.12;
    planeGroup.rotation.x = INCLINATION;
    planeGroup.position.copy(GLOBE_CENTER);
    group.add(planeGroup);

    const ringMat = new THREE.MeshBasicMaterial({
      color: ACCENT, transparent: true, opacity: 0.22, depthWrite: false,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(ORBIT_R, 0.008, 6, 96), ringMat);
    ring.rotation.x = Math.PI / 2;
    planeGroup.add(ring);

    const sats = [];
    for (let s = 0; s < SATS_PER_PLANE; s++) {
      const mini = buildMiniSat();
      planeGroup.add(mini);
      sats.push({ mesh: mini, baseAngle: (s / SATS_PER_PLANE) * TAU + p * 0.35 });
    }
    planes.push({ group: planeGroup, sats });
  }

  // -- receiver on the globe surface ------------------------------------------
  const R_DIR = new THREE.Vector3(0.28, 0.55, 0.8).normalize();
  const receiver = buildReceiver();
  const rPos = GLOBE_CENTER.clone().addScaledVector(R_DIR, GLOBE_R);
  receiver.group.position.copy(rPos);
  const upQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), R_DIR);
  receiver.group.quaternion.copy(upQ);
  group.add(receiver.group);

  // Live coordinate readout — the actual payoff: turns the abstract "spheres
  // intersect" math into the number the receiver hands back to a person.
  // Jitters (an uncertain, still-searching fix) until a 4th satellite locks
  // it, matching the same beat as the clockfix step's bias wobble.
  const coordReadout = callout('', { dir: -90, len: 90 });
  coordReadout.position.set(0, -0.05, 0);
  coordReadout.visible = false;
  receiver.group.add(coordReadout);
  const R_WORLD = rPos.clone().addScaledVector(R_DIR, 0.16);

  // -- hero satellites (fixed, in the receiver's local sky) -------------------
  const up = R_DIR.clone();
  const arbitrary = Math.abs(up.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const e1 = new THREE.Vector3().crossVectors(up, arbitrary).normalize();
  const e2 = new THREE.Vector3().crossVectors(up, e1).normalize();
  const cone = THREE.MathUtils.degToRad(38);
  const azimuths = [20, 100, 190, 300].map(THREE.MathUtils.degToRad);

  const heroes = azimuths.map((az) => {
    const dir = up.clone().multiplyScalar(Math.cos(cone))
      .addScaledVector(e1, Math.sin(cone) * Math.cos(az))
      .addScaledVector(e2, Math.sin(cone) * Math.sin(az))
      .normalize();
    const pos = GLOBE_CENTER.clone().addScaledVector(dir, ORBIT_R);
    const sat = buildSatellite();
    sat.group.position.copy(pos);
    sat.group.lookAt(GLOBE_CENTER);
    group.add(sat.group);
    const trueDist = pos.distanceTo(R_WORLD);
    return { sat, pos, trueDist };
  });

  // -- range caps, one per hero satellite --------------------------------------
  const caps = heroes.map((h, i) => {
    const cap = buildRangeCap(i < 3 ? ACCENT : WARM);
    const dir = new THREE.Vector3().subVectors(R_WORLD, h.pos).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    cap.group.position.copy(h.pos);
    cap.group.quaternion.copy(q);
    group.add(cap.group);
    return cap;
  });

  // -- nav-message beam: hero sat 1 -> receiver --------------------------------
  const beamChain = chainPath([[
    [heroes[0].pos.x, heroes[0].pos.y, heroes[0].pos.z],
    [R_WORLD.x, R_WORLD.y, R_WORLD.z],
  ]]);
  const beamDots = [];
  const beamGroup = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), materials.glow(ACCENT, 1.6));
    m.material.transparent = true;
    m.material.depthWrite = false;
    m.userData.seed = i / 5;
    beamGroup.add(m);
    beamDots.push(m);
  }
  group.add(beamGroup);

  // -- clock faces --------------------------------------------------------------
  // These are diagrammatic props (no real satellite has a visible dial), so
  // they're oriented to face the step-7 camera dead-on rather than any
  // physical surface normal — must stay in sync with that step's camera
  // position in index.js (the "7 · Clocks..." step).
  const STEP7_CAM = new THREE.Vector3(1.368, 4.304, 4.885);
  function faceCamera(mesh, pos) {
    const dir = new THREE.Vector3().subVectors(STEP7_CAM, pos).normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  }

  const satClock = buildClockFace(WARM);
  const satClockPos = heroes[0].pos.clone().addScaledVector(
    new THREE.Vector3().subVectors(heroes[0].pos, GLOBE_CENTER).normalize(), 0.24,
  );
  satClock.group.position.copy(satClockPos);
  faceCamera(satClock.group, satClockPos);
  group.add(satClock.group);

  const groundClockPos = R_WORLD.clone().addScaledVector(R_DIR, 0.22);
  const groundClock = buildClockFace(ACCENT);
  groundClock.group.position.copy(groundClockPos);
  faceCamera(groundClock.group, groundClockPos);
  group.add(groundClock.group);

  // ==========================================================================
  // CALLOUTS
  // ==========================================================================
  const labels = calloutSets(['overview', 'satellite', 'signal', 'pseudorange', 'trilaterate', 'clockfix', 'relativity']);
  labels.add('overview', globe.group, 'Earth', [0, GLOBE_R + 0.05, 0], 90, 60);
  labels.add('overview', planes[0].group, 'Orbital plane (6, tilted 55°)', [ORBIT_R * 0.6, 0.35, 0], 60, 100);
  labels.add('overview', planes[1].group, 'GPS satellite', [ORBIT_R, 0, 0], 30, 90);
  labels.add('overview', receiver.group, 'Receiver (your phone)', [0, 0.2, 0], -40, 100);

  labels.add('satellite', heroes[0].sat.group, 'Solar panels', [0.31, 0, 0], 60, 110);
  labels.add('satellite', heroes[0].sat.group, 'L-band antenna array (nadir)', heroes[0].sat.antTipLocal, -50, 130);
  labels.add('satellite', heroes[0].sat.group, 'Atomic clock (cesium/rubidium) inside', [0, 0.1, 0.06], 60, 140);

  labels.add('signal', heroes[0].sat.group, 'PRN code', heroes[0].sat.antTipLocal, 40, 100);
  labels.add('signal', heroes[0].sat.group, 'Ephemeris + transmit timestamp', [0, -0.1, -0.11], -40, 150);

  labels.add('pseudorange', receiver.group, 'Range = c × travel time', [0, 0.4, 0], 60, 130);
  labels.add('pseudorange', receiver.group, 'Receiver', [0, 0.2, 0], -40, 80);

  labels.add('trilaterate', receiver.group, 'Sphere of possible positions', [0, 0.4, 0], 50, 140);
  labels.add('trilaterate', receiver.group, 'Fix narrows to one point', [0, 0.2, 0], -50, 130);

  labels.add('clockfix', receiver.group, 'Unknown clock bias blurs the fix', [0, 0.2, 0], -40, 150);
  labels.add('clockfix', heroes[3].sat.group, '4th satellite solves it', [0, 0.15, 0], 50, 130);

  labels.add('relativity', satClock.group, 'Satellite clock (runs fast)', [0, 0.12, 0], 60, 130);
  labels.add('relativity', groundClock.group, 'Ground clock', [0, 0.12, 0], 170, 90);

  // ==========================================================================
  // pose / state
  // ==========================================================================
  const state = {
    phase: 0,
    swarmOn: 1,
    heroOn: [0, 0, 0, 0],
    capOn: [0, 0, 0, 0],
    navOn: 0,
    biasAmt: 0,
    clockAmt: 0,
    fixOn: 0,
    fixLocked: 0,
  };

  function apply() {
    const panelAngle = Math.sin(state.phase * TAU) * 0.12;
    heroes.forEach((h) => h.sat.setPanelAngle(panelAngle));

    coordReadout.visible = state.fixOn > 0.01;
    if (state.fixOn > 0.01) {
      if (state.fixLocked > 0.5) {
        coordReadout.setText('FIX — 40.7128° N · 74.0060° W');
      } else {
        const amt = 0.02 + state.biasAmt * 0.06;
        const jLat = 40.7128 + Math.sin(state.phase * TAU * 23) * amt;
        const jLon = 74.006 + Math.sin(state.phase * TAU * 31 + 1.7) * amt;
        coordReadout.setText(`≈ ${jLat.toFixed(4)}° N · ${jLon.toFixed(4)}° W`);
      }
    }

    planes.forEach((pl) => {
      pl.sats.forEach((s) => {
        const a = s.baseAngle + state.phase * TAU;
        s.mesh.position.set(Math.cos(a) * ORBIT_R, 0, Math.sin(a) * ORBIT_R);
      });
      pl.group.visible = state.swarmOn > 0.01;
    });

    heroes.forEach((h, i) => {
      h.sat.group.visible = state.heroOn[i] > 0.01;
    });

    const fourthOn = state.capOn[3] > 0.01;
    caps.forEach((cap, i) => {
      const on = state.capOn[i];
      cap.group.visible = on > 0.01;
      const bias = i < 3 && !fourthOn ? state.biasAmt * (i === 0 ? 1 : i === 1 ? -0.7 : 0.85) : 0;
      const radius = heroes[i].trueDist + bias;
      cap.group.scale.setScalar(radius);
      cap.fillMat.opacity = 0.1 * on;
      cap.wireMat.opacity = 0.28 * on;
    });

    beamDots.forEach((m) => {
      const u = (m.userData.seed + state.phase) % 1;
      m.position.copy(beamChain.getPointAt(u));
      const fade = Math.min(1, u * 8) * Math.min(1, (1 - u) * 8);
      m.material.opacity = fade * state.navOn;
    });

    satClock.setAngle(state.phase * TAU * 2);
    groundClock.setAngle(state.phase * TAU);
    satClock.group.visible = state.clockAmt > 0.01;
    groundClock.group.visible = state.clockAmt > 0.01;
  }
  apply();

  return {
    group,
    set(partial) { Object.assign(state, partial); apply(); },
    setLabels: labels.setLabels,
  };
}
