import * as THREE from 'three';
import { materials, rod, box, disc } from '../../framework/parts.js';
import { beveledBox, lathe, tubeAlong, coil } from '../../framework/geometry.js';
import { callout } from '../../framework/labels.js';

// A gas-operated, long-stroke-piston, rotating-bolt rifle (AK-47 / AKM). The
// whole point — and what makes it the OPPOSITE of the short-recoil pistol — is
// the gas system: propellant gas tapped near the muzzle drives a piston that
// is RIGIDLY bolted to the bolt carrier all the way back, and a cam track in
// that carrier ROTATES the bolt ~35° to unlock it. Everything below is laid
// out from ONE scale so the iconic silhouette (curved mag, wood furniture, gas
// tube over the barrel) is right by construction.
//
// SCALE: 1 unit = 220 mm. Overall length 880 mm → 4.0 u; barrel 415 mm → 1.9 u.
//
// TWO scalars drive it:
//  * `reveal` (0-1): 0 = the complete solid rifle; 1 = x-ray (steel receiver /
//    top cover / barrel / gas tube / mag body HIDDEN, wood furniture GHOSTED,
//    internals switched on).
//  * `cyc` (0-100, one lap = one full auto cycle): 0-6 trigger · 6-8 hammer
//    strike · 8 ignite · 8-16 bullet down the bore · ~13.5 bullet passes the
//    gas port → gas taps · 14-45 piston+carrier driven back (bolt cam-rotates
//    35° UNLOCK ~20-27, then extract) · 30-42 eject · 45-52 rear dwell ·
//    52-82 spring returns carrier, strip+chamber · 80-86 bolt cam-rotate LOCK
//    · 86-100 idle. At 600 rpm the whole lap is ~0.1 s.

const TAU = Math.PI * 2;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smoothstep = (t) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
const win = (cyc, a, b) => (cyc <= a ? 0 : cyc >= b ? 1 : smoothstep((cyc - a) / (b - a)));
const pulse = (cyc, a, b) => (cyc <= a || cyc >= b ? 0 : Math.sin(Math.PI * ((cyc - a) / (b - a))));

// --- layout (world units; bore runs along +X, muzzle at +X end) -----------
const BORE_Y = 1.25;
const MUZZLE_X = 2.0;
const BARREL_LEN = 1.9;
const CHAMBER_X = MUZZLE_X - BARREL_LEN; // 0.10 — rear face of the chamber
const BARREL_R = 0.05;
const BORE_R = 0.03;

const GAS_BLOCK_X = 1.25; // gas port / block, forward of the front sight base
const FRONT_SIGHT_X = 1.8;
const GAS_Y = BORE_Y + 0.15; // gas tube runs parallel, above the barrel
const GAS_R = 0.045;

const RECEIVER_X0 = -0.32; // rear of receiver (stock tang)
const RECEIVER_X1 = 0.44; // front of receiver (barrel enters)
const RECEIVER_TOP = BORE_Y + 0.12;
const RECEIVER_BOT = BORE_Y - 0.17;
const RECEIVER_HW = 0.1;

const CARRIER_TRAVEL = 0.72; // long-stroke: a big rearward sweep
const CAM_FREE = 0.1; // carrier free travel before the cam starts turning the bolt
const CAM_SPAN = 0.16; // carrier distance over which the bolt rotates the full 35°
const BOLT_UNLOCK = (35 * Math.PI) / 180;

const CASE_LEN = 0.17; // 7.62x39 case (bottlenecked)
const CASE_R = 0.052;
const NECK_R = 0.036;
const BULLET_LEN = 0.12;
const BULLET_R = 0.035;
const TWIST = 0.42; // scene twist pitch for the rifling helix (visual)

const RANGE_FADE_X = MUZZLE_X + 5.0;

export function buildAk({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // --- materials --------------------------------------------------------
  // Blued/black-oxide steel reads BLACK against the dark backdrop and the rifle
  // dissolves into floating wood — so the "black" steel is a dark gunmetal that
  // still catches the key/rim light and holds the silhouette together.
  // AK steel. IMPORTANT: a high-metalness material (darkMetal = 0.85) has
  // almost no diffuse response and relies on ENV reflection, which is dim in
  // this dark studio — so dark blued steel renders near-black and the rifle
  // dissolves into floating wood. Dropping metalness to ~0.55 lets the key
  // light actually light it, reading as lit gunmetal (parkerized AK steel is
  // fairly matte anyway).
  const mkSteel = (color, rough = 0.5) =>
    new THREE.MeshPhysicalMaterial({ color, metalness: 0.55, roughness: rough });
  const blued = mkSteel(0x5e636d, 0.5); // receiver, barrel, gas tube
  const bluedLight = mkSteel(0x6f747e, 0.48); // lifted for edges/detail
  const wood = materials.wood(0xc98a54); // the iconic warm AK furniture
  const magSteel = mkSteel(0x565b64, 0.52); // steel curved magazine

  // satin steel internals — NOT mirror chrome (the polish-pass learning: a
  // near-mirror blows out the close-ups and reads fake). ~0.36 roughness reads
  // as real polished-then-worn gun steel and never clips.
  const steelSatin = materials.brushedSteel(0x9198a1);
  steelSatin.roughness = 0.36;
  const steelMid = materials.brushedSteel(0x767c85);
  steelMid.roughness = 0.42;
  const brass = materials.brushedSteel(0xc9a15a);
  brass.roughness = 0.34;
  const copper = materials.aluminum(0xb5793f);
  copper.roughness = 0.4;
  const primerMat = materials.steel(0xb9c0c8);
  const darkInner = materials.darkMetal(0x0a0b0d);

  const glow = (color, intensity = 2.0) => {
    const m = materials.glow(color, intensity);
    m.transparent = true;
    m.opacity = 0;
    m.depthWrite = false;
    return m;
  };

  const internalMeshes = []; // exist only inside; on while revealed
  const shellMeshes = []; // steel outer shell; HIDDEN while revealed
  // these ADD to the scene AND track for reveal-toggling — re-adding a mesh
  // that's already a child of `group` is a no-op, so callers may also group.add
  // explicitly (for sub-grouped parts) without harm.
  const addShell = (m) => (group.add(m), shellMeshes.push(m), m);
  const addInternal = (m) => (group.add(m), internalMeshes.push(m), m);

  // --- cartridge factory (7.62x39 — bottlenecked case + spitzer bullet) ----
  function makeCase(material) {
    const m = lathe(
      [
        [0, 0],
        [CASE_R * 0.9, 0],
        [CASE_R, 0.012],
        [CASE_R, CASE_LEN * 0.62],
        [NECK_R, CASE_LEN * 0.78], // shoulder
        [NECK_R, CASE_LEN],
      ],
      material,
    );
    m.rotation.z = -Math.PI / 2;
    return m;
  }
  function makeBullet(material) {
    const m = lathe(
      [
        [0, 0],
        [BULLET_R, 0],
        [BULLET_R, BULLET_LEN * 0.42],
        [BULLET_R * 0.82, BULLET_LEN * 0.66],
        [BULLET_R * 0.5, BULLET_LEN * 0.86],
        [BULLET_R * 0.14, BULLET_LEN * 0.98],
        [0, BULLET_LEN],
      ],
      material,
    );
    m.rotation.z = -Math.PI / 2;
    return m;
  }
  // a loaded round = case + seated bullet, as one group pointing +X
  function makeRound(scale = 1) {
    const g = new THREE.Group();
    const c = makeCase(brass);
    g.add(c);
    const b = makeBullet(copper);
    b.position.x = CASE_LEN * 0.82;
    g.add(b);
    g.scale.setScalar(scale);
    return g;
  }

  // ================= BARREL (internal glass bore + rifling) ================
  const boreGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(BORE_R, BORE_R, BARREL_LEN, 24, 1, true).rotateZ(Math.PI / 2),
    materials.glass(0xaac6e8, 0.12),
  );
  boreGlass.position.set(CHAMBER_X + BARREL_LEN / 2, BORE_Y, 0);
  boreGlass.castShadow = false;
  addInternal(boreGlass);

  // 4 right-hand rifling grooves as helical tubes
  const grooveMat = materials.darkMetal(0x14161a);
  for (let g = 0; g < 4; g++) {
    const phase = (g / 4) * TAU;
    const steps = 40;
    const pts = [];
    for (let s = 0; s <= steps; s++) {
      const x = CHAMBER_X + 0.14 + (s / steps) * (BARREL_LEN - 0.16);
      const ang = (x / TWIST) * TAU + phase;
      pts.push([x, BORE_Y + Math.cos(ang) * BORE_R * 0.92, Math.sin(ang) * BORE_R * 0.92]);
    }
    const groove = tubeAlong(pts, 0.004, grooveMat, { tubularSegments: steps, radialSegments: 5 });
    groove.castShadow = false;
    addInternal(groove);
  }

  // chamber + chambered round (internal)
  const chamberRound = makeRound(1);
  chamberRound.position.set(CHAMBER_X + 0.02, BORE_Y, 0);
  group.add(chamberRound);
  addInternal(chamberRound);
  const primerDisc = disc(0.02, 0.006, primerMat);
  primerDisc.rotation.x = Math.PI / 2;
  primerDisc.position.set(CHAMBER_X - 0.004, BORE_Y, 0);
  group.add(primerDisc);
  addInternal(primerDisc);

  // the flying bullet (its own instance; the chambered round's bullet hides at
  // ignition and this one carries downrange)
  const flyBullet = makeBullet(copper);
  const BULLET_START_X = CHAMBER_X + 0.02 + CASE_LEN * 0.82;
  flyBullet.position.set(BULLET_START_X, BORE_Y, 0);
  group.add(flyBullet);

  // spent case (ejects). Separate instance so the chambered round can vanish.
  const spentCase = makeCase(brass);
  const spentMat = new THREE.MeshPhysicalMaterial({
    color: 0xc9a15a, metalness: 1, roughness: 0.34, transparent: true, opacity: 0,
  });
  spentCase.traverse((o) => { if (o.isMesh) o.material = spentMat; });
  group.add(spentCase);

  // --- barrel exterior (steel shell) --------------------------------------
  const barrelSteel = new THREE.Mesh(
    new THREE.CylinderGeometry(BARREL_R, BARREL_R, BARREL_LEN, 22).rotateZ(Math.PI / 2),
    blued,
  );
  barrelSteel.position.set(CHAMBER_X + BARREL_LEN / 2, BORE_Y, 0);
  barrelSteel.castShadow = true;
  addShell(barrelSteel);
  // muzzle end cap with a real bore hole (a plate the bullet exits through)
  const muzzleShape = new THREE.Shape();
  muzzleShape.absarc(0, 0, BARREL_R + 0.008, 0, TAU, false);
  muzzleShape.holes.push(new THREE.Path().absarc(0, 0, BORE_R + 0.006, 0, TAU, true));
  const muzzleGeo = new THREE.ExtrudeGeometry(muzzleShape, {
    depth: 0.05, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 1,
  }).rotateY(Math.PI / 2);
  const muzzleCap = new THREE.Mesh(muzzleGeo, blued);
  muzzleCap.position.set(MUZZLE_X - 0.05, BORE_Y, 0);
  addShell(muzzleCap);
  const boreLiner = new THREE.Mesh(
    new THREE.CylinderGeometry(BORE_R + 0.005, BORE_R + 0.005, 0.1, 18, 1, true).rotateZ(Math.PI / 2),
    darkInner,
  );
  boreLiner.material.side = THREE.BackSide;
  boreLiner.position.set(MUZZLE_X - 0.06, BORE_Y, 0);
  addShell(boreLiner);

  // --- gas block + front sight (steel shell) ------------------------------
  const gasBlock = beveledBox(0.13, 0.22, 0.13, blued, 0.012);
  gasBlock.position.set(GAS_BLOCK_X, BORE_Y + 0.07, 0);
  addShell(gasBlock);
  // gas port riser linking barrel to gas tube
  const portRiser = beveledBox(0.06, 0.14, 0.07, bluedLight, 0.008);
  portRiser.position.set(GAS_BLOCK_X, (BORE_Y + GAS_Y) / 2 + 0.03, 0);
  addShell(portRiser);
  // front sight block + hooded post
  const fsBlock = beveledBox(0.1, 0.14, 0.12, blued, 0.01);
  fsBlock.position.set(FRONT_SIGHT_X, BORE_Y + 0.06, 0);
  addShell(fsBlock);
  const fsEars = beveledBox(0.09, 0.13, 0.11, bluedLight, 0.008);
  fsEars.position.set(FRONT_SIGHT_X, BORE_Y + 0.16, 0);
  addShell(fsEars);
  const fsPost = rod(0.008, 0.1, steelMid);
  fsPost.position.set(FRONT_SIGHT_X, BORE_Y + 0.11, 0);
  addShell(fsPost);

  // --- gas tube (steel shell) + upper handguard wood ----------------------
  const gasTubeLen = GAS_BLOCK_X - RECEIVER_X1 + 0.1;
  const gasTube = new THREE.Mesh(
    new THREE.CylinderGeometry(GAS_R, GAS_R, gasTubeLen, 18).rotateZ(Math.PI / 2),
    blued,
  );
  gasTube.position.set((GAS_BLOCK_X + RECEIVER_X1) / 2 - 0.03, GAS_Y, 0);
  addShell(gasTube);

  // internal gas cylinder cavity (visible on reveal — the piston rides here)
  const gasBore = new THREE.Mesh(
    new THREE.CylinderGeometry(GAS_R * 0.7, GAS_R * 0.7, gasTubeLen, 16, 1, true).rotateZ(Math.PI / 2),
    materials.glass(0xffcaa0, 0.1),
  );
  gasBore.position.copy(gasTube.position);
  gasBore.castShadow = false;
  addInternal(gasBore);

  // --- gas glow: the tapped propellant surging up the tube. Intensities are
  // kept BELOW the bloom threshold (2.2) so they read as a contained amber jet
  // driving the piston, not a blown-white sun. The tube jet is the star; the
  // port puff is a small accent.
  const gasGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(GAS_R * 0.62, GAS_R * 0.62, 0.34, 14).rotateZ(Math.PI / 2),
    glow(0xff9d3c, 1.9),
  );
  gasGlow.position.set(GAS_BLOCK_X - 0.2, GAS_Y, 0);
  group.add(gasGlow);
  const gasPortGlow = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), glow(0xffb257, 2.0));
  gasPortGlow.position.set(GAS_BLOCK_X, (BORE_Y + GAS_Y) / 2 + 0.03, 0);
  group.add(gasPortGlow);

  // upper + lower wood handguards (over the gas tube / barrel between the
  // receiver and the gas block) — GHOST on reveal
  const hgMidX = (GAS_BLOCK_X + RECEIVER_X1) / 2 - 0.06;
  const hgLen = GAS_BLOCK_X - RECEIVER_X1 - 0.06;
  const upperHG = beveledBox(hgLen, 0.12, 0.2, wood, 0.03);
  upperHG.position.set(hgMidX, GAS_Y + 0.02, 0);
  group.add(upperHG);
  const lowerHG = beveledBox(hgLen + 0.06, 0.16, 0.22, wood, 0.035);
  lowerHG.position.set(hgMidX, BORE_Y - 0.09, 0);
  group.add(lowerHG);
  // lower handguard has a palm swell / finger relief cut — a thin ring groove
  const hgRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 8, 24), bluedLight);
  hgRing.rotation.y = Math.PI / 2;
  hgRing.position.set(RECEIVER_X1 + 0.02, BORE_Y - 0.09, 0);
  group.add(hgRing);

  // rear sight block on the barrel just ahead of the receiver
  const rearSight = beveledBox(0.12, 0.09, 0.16, blued, 0.01);
  rearSight.position.set(RECEIVER_X1 + 0.06, BORE_Y + 0.07, 0);
  addShell(rearSight);

  // ================= RECEIVER (steel shell) ===============================
  const RCX = (RECEIVER_X0 + RECEIVER_X1) / 2;
  const RCLEN = RECEIVER_X1 - RECEIVER_X0;
  // side walls
  for (const z of [1, -1]) {
    const wall = beveledBox(RCLEN, RECEIVER_TOP - RECEIVER_BOT, 0.02, blued, 0.008);
    wall.position.set(RCX, (RECEIVER_TOP + RECEIVER_BOT) / 2, z * RECEIVER_HW);
    addShell(wall);
  }
  // bottom bridge — the continuous lower edge from the magwell back to the
  // grip (without it the mag + grip read as detached lumps under a floating box)
  const recBottom = beveledBox(RCLEN + 0.06, 0.05, RECEIVER_HW * 2, blued, 0.01);
  recBottom.position.set(RCX - 0.02, RECEIVER_BOT - 0.02, 0);
  addShell(recBottom);
  // magwell housing — the lip the curved magazine plugs into, tying the mag to
  // the receiver as one body
  const magwell = beveledBox(0.34, 0.15, RECEIVER_HW * 2 + 0.02, blued, 0.012);
  magwell.position.set(0.24, RECEIVER_BOT - 0.09, 0);
  addShell(magwell);
  // top cover (dished stamped cover — the lid you'd pop off; HIDDEN on reveal)
  const topCover = beveledBox(RCLEN + 0.16, 0.05, RECEIVER_HW * 2 + 0.02, bluedLight, 0.02);
  topCover.position.set(RCX + 0.02, RECEIVER_TOP + 0.02, 0);
  addShell(topCover);
  // cover ribs (the AK's stamped reinforcing ridges)
  for (const z of [0.05, -0.05]) {
    const rib = beveledBox(RCLEN, 0.02, 0.02, blued, 0.006);
    rib.position.set(RCX + 0.02, RECEIVER_TOP + 0.045, z);
    addShell(rib);
  }
  // ejection port (dark recess, right side over the chamber)
  const ejPort = beveledBox(0.3, 0.11, 0.03, darkInner, 0.008);
  ejPort.position.set(0.1, BORE_Y + 0.06, RECEIVER_HW);
  addShell(ejPort);
  // selector lever (the big right-side lever — the AK tell)
  const selector = beveledBox(0.42, 0.045, 0.02, bluedLight, 0.01);
  selector.position.set(0.14, BORE_Y + 0.02, RECEIVER_HW + 0.02);
  selector.rotation.z = -0.32;
  addShell(selector);

  // ================= BOLT CARRIER GROUP (internal) ========================
  // The carrier + gas piston are ONE rigid group (they translate together).
  const carrierGroup = new THREE.Group();
  group.add(carrierGroup);
  addInternal(carrierGroup);
  const carrierBody = beveledBox(0.42, 0.11, 0.12, steelSatin, 0.014);
  carrierBody.position.set(0.12, BORE_Y + 0.09, 0);
  carrierGroup.add(carrierBody);
  // the cam track raceway on the carrier underside (a dark curved slot hint)
  const camSlot = beveledBox(0.2, 0.03, 0.05, darkInner, 0.006);
  camSlot.position.set(0.06, BORE_Y + 0.045, 0.045);
  camSlot.rotation.z = 0.14;
  carrierGroup.add(camSlot);
  // gas piston rod, forward from the carrier into the gas block
  const pistonRod = rod(0.02, GAS_BLOCK_X - 0.28, steelMid);
  pistonRod.rotation.z = -Math.PI / 2;
  pistonRod.position.set(0.28, GAS_Y, 0);
  carrierGroup.add(pistonRod);
  // piston head (wider — the bit gas actually pushes)
  const pistonHead = new THREE.Mesh(
    new THREE.CylinderGeometry(GAS_R * 0.66, GAS_R * 0.66, 0.1, 16).rotateZ(Math.PI / 2),
    steelSatin,
  );
  pistonHead.position.set(GAS_BLOCK_X - 0.22, GAS_Y, 0);
  carrierGroup.add(pistonHead);
  // a few piston rings
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(GAS_R * 0.66, 0.006, 8, 18), steelMid);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(GAS_BLOCK_X - 0.26 + i * 0.03, GAS_Y, 0);
    carrierGroup.add(ring);
  }

  // ================= BOLT (internal) — rotates to lock/unlock ==============
  // Its own group so it can roll about the bore axis AND slide back.
  const boltGroup = new THREE.Group();
  group.add(boltGroup);
  addInternal(boltGroup);
  const boltBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.2, 20).rotateZ(Math.PI / 2),
    steelSatin,
  );
  boltBody.position.set(0.02, BORE_Y, 0);
  boltGroup.add(boltBody);
  // two locking lugs at the bolt head
  for (const s of [1, -1]) {
    const lug = beveledBox(0.05, 0.03, 0.055, steelMid, 0.006);
    lug.position.set(0.12, BORE_Y + s * 0.05, 0);
    boltGroup.add(lug);
  }
  // cam pin standing up into the carrier's cam track
  const camPin = rod(0.014, 0.11, steelMid);
  camPin.position.set(0.05, BORE_Y + 0.02, 0);
  boltGroup.add(camPin);
  // firing pin (drives forward at the strike; small travel within the bolt)
  const firingPin = rod(0.01, 0.16, steelSatin);
  firingPin.rotation.z = -Math.PI / 2;
  firingPin.position.set(-0.08, BORE_Y, 0);
  boltGroup.add(firingPin);

  // recoil spring behind the carrier, running back into the receiver/stock
  const recoilSpring = coil(
    { turns: 16, radius: 0.05, length: 0.5, wireRadius: 0.007 },
    steelSatin,
  ).mesh;
  recoilSpring.rotation.z = Math.PI / 2;
  group.add(recoilSpring);
  addInternal(recoilSpring);

  // muzzle + primer flash
  const muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 12), glow(0xffcaa0, 2.6));
  muzzleFlash.position.set(MUZZLE_X + 0.09, BORE_Y, 0);
  group.add(muzzleFlash);
  const muzzleLight = new THREE.PointLight(0xffdca0, 0, 2.5);
  muzzleLight.position.copy(muzzleFlash.position);
  group.add(muzzleLight);
  const primerGlow = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), glow(0xffb45e, 2.2));
  primerGlow.position.set(CHAMBER_X, BORE_Y, 0);
  group.add(primerGlow);

  // ================= FIRE CONTROL (hammer + trigger) ======================
  // hammer pivots at the rear of the receiver bottom, swings up to the firing pin
  const hammerPivot = new THREE.Group();
  hammerPivot.position.set(-0.16, RECEIVER_BOT + 0.02, 0);
  group.add(hammerPivot);
  addInternal(hammerPivot);
  const hammerArm = beveledBox(0.045, 0.18, 0.05, steelMid, 0.01);
  hammerArm.position.set(0, 0.09, 0);
  hammerPivot.add(hammerArm);
  const hammerHead = beveledBox(0.09, 0.06, 0.06, steelSatin, 0.014);
  hammerHead.position.set(0.01, 0.18, 0);
  hammerPivot.add(hammerHead);

  // trigger blade in the guard, exterior
  const triggerPivot = new THREE.Group();
  triggerPivot.position.set(-0.02, RECEIVER_BOT - 0.02, 0);
  group.add(triggerPivot);
  const triggerBlade = beveledBox(0.03, 0.12, 0.05, steelMid, 0.01);
  triggerBlade.position.set(0.0, -0.06, 0);
  triggerBlade.rotation.z = -0.1;
  triggerPivot.add(triggerBlade);
  // trigger guard (steel bail)
  const guard = tubeAlong(
    [
      [0.12, RECEIVER_BOT - 0.02, 0],
      [0.12, RECEIVER_BOT - 0.14, 0],
      [-0.02, RECEIVER_BOT - 0.17, 0],
      [-0.14, RECEIVER_BOT - 0.14, 0],
      [-0.16, RECEIVER_BOT - 0.03, 0],
    ],
    0.016,
    blued,
    { tubularSegments: 40 },
  );
  addShell(guard);

  // ================= WOOD FURNITURE (ghost on reveal) =====================
  // pistol grip — raked back, below the receiver behind the trigger
  const gripPivot = new THREE.Group();
  gripPivot.position.set(-0.24, RECEIVER_BOT + 0.02, 0);
  gripPivot.rotation.z = 0.36;
  group.add(gripPivot);
  const grip = beveledBox(0.13, 0.42, 0.14, wood, 0.03);
  grip.position.set(0.0, -0.2, 0);
  gripPivot.add(grip);
  const gripCap = beveledBox(0.12, 0.04, 0.13, bluedLight, 0.014);
  gripCap.position.set(0.02, -0.41, 0);
  gripPivot.add(gripCap);

  // buttstock — ONE continuous piece (the classic AKM fixed stock), extruded
  // from a side silhouette so it flows from the receiver tang to the buttplate
  // instead of reading as two floating slabs.
  const stockPivot = new THREE.Group();
  stockPivot.position.set(RECEIVER_X0 + 0.03, BORE_Y - 0.02, 0);
  stockPivot.rotation.z = 0.06;
  group.add(stockPivot);
  const stockShape = new THREE.Shape();
  const sp = [
    [0.03, 0.12], [-1.28, 0.15], [-1.36, 0.06], [-1.34, -0.18],
    [-0.98, -0.15], [-0.52, -0.185], [-0.14, -0.08], [0.03, 0.0],
  ];
  stockShape.moveTo(sp[0][0], sp[0][1]);
  for (let i = 1; i < sp.length; i++) stockShape.lineTo(sp[i][0], sp[i][1]);
  stockShape.closePath();
  const stockGeo = new THREE.ExtrudeGeometry(stockShape, {
    depth: 0.15, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.02, bevelSegments: 2, curveSegments: 1,
  });
  stockGeo.translate(0, 0, -0.075);
  const stock = new THREE.Mesh(stockGeo, wood);
  stock.castShadow = true;
  stockPivot.add(stock);
  const buttPad = beveledBox(0.05, 0.3, 0.16, darkInner, 0.02);
  buttPad.position.set(-1.37, -0.05, 0);
  stockPivot.add(buttPad);
  // (all furniture shares the `wood` material, so setReveal ghosts them
  // together by fading that one material — no per-mesh list needed)

  // ================= CURVED MAGAZINE ======================================
  // the iconic banana: centreline is an arc that curves FORWARD (+X) as it
  // drops. Built once here; both the steel body and the stacked rounds ride
  // the same arc so they can't disagree.
  const MAG_TOP = new THREE.Vector3(0.24, RECEIVER_BOT - 0.02, 0);
  const MAG_LEN = 0.92;
  const MAG_BEND = 0.42; // total radians the mag curves over its length
  const MAG_SEGS = 22;
  const magCenter = [];
  const magTangent = [];
  {
    let p = MAG_TOP.clone();
    let ang = -Math.PI / 2; // start pointing straight down
    const ds = MAG_LEN / MAG_SEGS;
    for (let i = 0; i <= MAG_SEGS; i++) {
      magCenter.push(p.clone());
      const t = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0);
      magTangent.push(t.clone());
      p = p.clone().add(t.clone().multiplyScalar(ds));
      ang += MAG_BEND / MAG_SEGS; // curve toward +X
    }
  }
  const MAG_HALF = 0.075; // half depth (front-back)
  const MAG_WIDTH = 0.15; // Z (double-stack width)
  // build the banana side silhouette: down the front edge, up the back edge
  const magShape = new THREE.Shape();
  const frontPts = [];
  const backPts = [];
  for (let i = 0; i <= MAG_SEGS; i++) {
    const c = magCenter[i];
    const t = magTangent[i];
    const n = new THREE.Vector3(-t.y, t.x, 0).multiplyScalar(MAG_HALF); // left normal
    frontPts.push([c.x + n.x, c.y + n.y]);
    backPts.push([c.x - n.x, c.y - n.y]);
  }
  magShape.moveTo(frontPts[0][0], frontPts[0][1]);
  for (let i = 1; i < frontPts.length; i++) magShape.lineTo(frontPts[i][0], frontPts[i][1]);
  for (let i = backPts.length - 1; i >= 0; i--) magShape.lineTo(backPts[i][0], backPts[i][1]);
  magShape.closePath();
  const magGeo = new THREE.ExtrudeGeometry(magShape, {
    depth: MAG_WIDTH, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 1,
  });
  magGeo.translate(0, 0, -MAG_WIDTH / 2);
  const magBody = new THREE.Mesh(magGeo, magSteel);
  magBody.castShadow = true;
  addShell(magBody); // steel body: HIDDEN on reveal so the stack reads
  // mag ribs (stamped)
  for (let i = 1; i < 4; i++) {
    const c = magCenter[Math.round((i / 4) * MAG_SEGS)];
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.076, 0.006, 6, 8, Math.PI), magSteel);
    rib.position.set(c.x, c.y, 0);
    rib.rotation.x = Math.PI / 2;
    addShell(rib);
  }

  // stacked rounds (internal) — riding the same arc, double-column stagger
  const MAG_ROUNDS = 8;
  const magRounds = [];
  for (let i = 0; i < MAG_ROUNDS; i++) {
    const f = 0.05 + (i / MAG_ROUNDS) * 0.92;
    const idx = Math.min(MAG_SEGS, Math.round(f * MAG_SEGS));
    const c = magCenter[idx];
    const t = magTangent[idx];
    const r = makeRound(0.9);
    // round points +X but tilts to follow the local down-curve
    const tilt = Math.atan2(t.y, t.x) + Math.PI / 2;
    r.rotation.z = tilt * 0.6;
    r.position.set(c.x - 0.02, c.y, (i % 2 === 0 ? 1 : -1) * 0.028);
    group.add(r);
    addInternal(r);
    magRounds.push(r);
  }
  const follower = box(0.14, 0.02, MAG_WIDTH - 0.02, bluedLight);
  const fEnd = magCenter[MAG_SEGS];
  follower.position.set(fEnd.x, fEnd.y + 0.05, 0);
  group.add(follower);
  addInternal(follower);

  // ================= CALLOUTS =============================================
  const exteriorCallouts = [];
  const internalCallouts = [];
  const addCallout = (bucket, parent, text, pos, dir, len) => {
    const c = callout(text, { dir, len });
    c.position.set(...pos);
    c.visible = false;
    parent.add(c);
    bucket.push(c);
    return c;
  };
  addCallout(exteriorCallouts, barrelSteel, 'Barrel', [0.2, 0.06, 0], 95, 54);
  addCallout(exteriorCallouts, gasTube, 'Gas tube', [-0.1, 0.06, 0], 110, 52);
  addCallout(exteriorCallouts, fsEars, 'Front sight', [0, 0.08, 0], 70, 46);
  addCallout(exteriorCallouts, topCover, 'Receiver', [0.0, 0.05, 0], 100, 56);
  addCallout(exteriorCallouts, lowerHG, 'Wooden handguard', [0.0, -0.1, 0.12], -70, 60);
  addCallout(exteriorCallouts, grip, 'Pistol grip', [0.0, -0.16, 0.1], -60, 52);
  addCallout(exteriorCallouts, stock, 'Buttstock', [-0.5, 0.16, 0], 45, 64);
  addCallout(exteriorCallouts, magBody, 'Magazine', [0.0, -0.3, 0.1], -50, 60);
  addCallout(exteriorCallouts, selector, 'Selector lever', [0.1, 0.04, 0.04], 40, 56);

  addCallout(internalCallouts, chamberRound, 'Chamber + cartridge', [0.04, 0.07, 0.05], 60, 54);
  addCallout(internalCallouts, pistonHead, 'Gas piston', [0.0, 0.08, 0], 80, 54);
  addCallout(internalCallouts, carrierBody, 'Bolt carrier', [0.0, 0.07, 0], 95, 56);
  addCallout(internalCallouts, boltBody, 'Rotating bolt', [0.02, -0.08, 0], -80, 54);
  addCallout(internalCallouts, recoilSpring, 'Recoil spring', [0.0, 0.08, 0], 100, 54);
  addCallout(internalCallouts, hammerHead, 'Hammer', [0.0, 0.06, 0], -70, 50);
  addCallout(internalCallouts, follower, 'Magazine stack', [0.0, -0.14, 0], -50, 56);

  // live readouts (#17): muzzle velocity (bore step) + bolt angle (unlock step)
  const velReadout = callout('0 m/s', { dir: 40, len: 90, key: 'vel' });
  velReadout.position.set(MUZZLE_X - 0.5, BORE_Y + 0.3, 0);
  velReadout.visible = false;
  group.add(velReadout);
  const boltReadout = callout('Bolt — 0° locked', { dir: 70, len: 96, key: 'bolt' });
  boltReadout.position.set(0.08, BORE_Y + 0.34, 0);
  boltReadout.visible = false;
  group.add(boltReadout);

  // --- pose ----------------------------------------------------------------
  const mod100 = (c) => ((c % 100) + 100) % 100;
  let revealed = false;

  // cam: carrier rearward distance → bolt roll angle (0 locked … 35° unlocked)
  function boltRollFor(carrierBack) {
    if (carrierBack <= CAM_FREE) return 0;
    if (carrierBack >= CAM_FREE + CAM_SPAN) return BOLT_UNLOCK;
    return BOLT_UNLOCK * smoothstep((carrierBack - CAM_FREE) / CAM_SPAN);
  }

  function setCycle(cycRaw) {
    const cyc = mod100(cycRaw);

    // trigger + hammer
    const triggerT = win(cyc, 0, 6) - win(cyc, 84, 92);
    triggerPivot.rotation.z = -0.1 - triggerT * 0.4;
    // hammer: cocked (back) at rest, snaps forward to strike at 6-8, re-cocked
    // by the returning carrier ~30-46, held cocked after.
    let hammerRot;
    if (cyc < 6) hammerRot = -0.9; // cocked back
    else if (cyc < 8) hammerRot = -0.9 + win(cyc, 6, 8) * 0.9; // strike (up to 0)
    else if (cyc < 30) hammerRot = 0.0; // forward (fired)
    else if (cyc < 46) hammerRot = -0.9 * win(cyc, 30, 46); // re-cocked
    else hammerRot = -0.9;
    hammerPivot.rotation.z = hammerRot;

    // ignition
    const ignite = pulse(cyc, 7, 10);
    primerGlow.material.opacity = ignite;
    primerGlow.scale.setScalar(0.5 + ignite * 0.8);

    // firing pin small forward jab at the strike
    firingPin.position.x = -0.08 + pulse(cyc, 6.5, 9) * 0.05;

    // bullet down the bore, then downrange
    const accel = win(cyc, 8, 16);
    let bulletX;
    if (cyc < 8) bulletX = BULLET_START_X;
    else if (cyc < 16) bulletX = BULLET_START_X + accel * (MUZZLE_X - BULLET_START_X);
    else bulletX = MUZZLE_X + win(cyc, 16, 92) * (RANGE_FADE_X - MUZZLE_X);
    flyBullet.position.x = bulletX;
    flyBullet.position.y = BORE_Y - (cyc > 16 ? Math.pow(win(cyc, 16, 92), 1.7) * 0.5 : 0);
    const travelled = Math.max(0, bulletX - BULLET_START_X);
    flyBullet.rotation.x = (travelled / TWIST) * TAU;
    // the flying bullet only exists once fired; chambered round carries its own
    flyBullet.visible = cyc >= 8 && cyc < 93;
    if (flyBullet.material) {
      flyBullet.material.transparent = true;
      flyBullet.material.opacity = 1 - win(cyc, 88, 93);
      flyBullet.material.depthWrite = flyBullet.material.opacity > 0.9;
    }

    // muzzle flash as the bullet exits
    const muzzle = pulse(cyc, 15, 18.5);
    muzzleFlash.material.opacity = muzzle;
    muzzleFlash.scale.setScalar(0.35 + muzzle * 0.7);
    muzzleLight.intensity = muzzle * 4.5;

    // --- the gas system: tap fires only AFTER the bullet passes the port ----
    const carrierBack =
      cyc < 14 ? 0
      : cyc < 45 ? win(cyc, 14, 45) * CARRIER_TRAVEL
      : cyc < 52 ? CARRIER_TRAVEL
      : cyc < 82 ? CARRIER_TRAVEL * (1 - win(cyc, 52, 82))
      : 0;
    carrierGroup.position.x = -carrierBack;

    // gas glow: surges as the bullet clears the port (13.5) and drives the
    // piston back; fades once the carrier is moving on its own (~30)
    const gasOn = pulse(cyc, 13.5, 31);
    gasGlow.material.opacity = gasOn * 0.95;
    gasGlow.scale.set(1, 0.7 + gasOn * 0.5, 0.7 + gasOn * 0.5);
    gasGlow.position.x = GAS_BLOCK_X - 0.2 - carrierBack * 0.5; // pushes back with the piston
    gasPortGlow.material.opacity = pulse(cyc, 13, 22);
    gasPortGlow.scale.setScalar(0.5 + pulse(cyc, 13, 22) * 0.5);

    // --- bolt: cam-roll to unlock, then travel back with the carrier --------
    const roll = boltRollFor(carrierBack);
    boltGroup.rotation.x = roll;
    // bolt only translates once unlocked (after the cam span); before that it
    // stays locked to the barrel while the carrier free-travels.
    const boltBack = Math.max(0, carrierBack - (CAM_FREE + CAM_SPAN));
    boltGroup.position.x = -boltBack;

    // recoil spring compresses behind the (moving) carrier
    const springLen = 0.5 - carrierBack * 0.5;
    recoilSpring.scale.x = Math.max(0.3, springLen / 0.5);
    recoilSpring.position.set(RECEIVER_X0 + 0.05 - carrierBack * 0.5, BORE_Y + 0.06, 0);

    // --- extraction + ejection ----------------------------------------------
    // the chambered round is present when loaded; once fired it becomes the
    // spent case (extracted by the bolt, flicked out the port).
    const loaded = cyc < 8 || cyc > 80;
    chamberRound.visible = revealed && loaded;
    primerDisc.visible = revealed && loaded;

    if (!revealed) {
      spentMat.opacity = 0;
    } else if (cyc >= 8 && cyc < 30) {
      // gripped on the bolt face, riding back with the bolt
      spentCase.position.set(CHAMBER_X + 0.02 - boltBack, BORE_Y, 0);
      spentCase.rotation.set(0, 0, 0);
      spentMat.opacity = cyc < 12 ? 0 : 1; // appears once ignition clears
    } else if (cyc >= 30 && cyc < 52) {
      const t = win(cyc, 30, 48);
      spentCase.position.set(
        CHAMBER_X + 0.02 - CARRIER_TRAVEL + t * 0.4,
        BORE_Y + Math.sin(Math.PI * Math.min(1, t * 1.1)) * 0.6,
        t * 0.7,
      );
      spentCase.rotation.set(t * 10, t * 5, t * 8);
      spentMat.opacity = Math.max(0, 1 - win(cyc, 44, 52));
    } else {
      spentMat.opacity = 0;
    }

    // --- magazine feed: follower + stack rise as a round is stripped --------
    const strip = win(cyc, 58, 74) - win(cyc, 80, 92);
    magRounds.forEach((r, i) => {
      r.position.y = r.userData.baseY ?? (r.userData.baseY = r.position.y);
      r.position.y = r.userData.baseY + strip * 0.05;
    });
    follower.position.y = (follower.userData.baseY ?? (follower.userData.baseY = follower.position.y)) + strip * 0.05;

    // --- live readouts ------------------------------------------------------
    if (velReadout.visible) {
      const v = cyc < 8 ? 0 : cyc < 16 ? Math.round(accel * 715) : 715;
      velReadout.setText(`${v.toLocaleString()} m/s`);
    }
    if (boltReadout.visible) {
      const deg = Math.round((roll * 180) / Math.PI);
      boltReadout.setText(deg < 3 ? 'Bolt — 0° locked' : deg >= 34 ? 'Bolt — 35° unlocked' : `Bolt — ${deg}° turning`);
    }
  }

  function setReveal(t) {
    const r = clamp01(t);
    revealed = r > 0.5;
    const show = r > 0.5;
    for (const o of shellMeshes) o.visible = !show;
    const op = 1 - r * 0.8; // 1 → 0.2 — only the low-specular wood ghosts; the
    // steel receiver/cover/barrel/mag body are HIDDEN via shellMeshes instead
    // (ghosted metal reads solid).
    wood.transparent = r > 0.02;
    wood.opacity = op;
    wood.depthWrite = r < 0.35;
    wood.clearcoat = show ? 0 : 0.25; // coat is opacity-independent — kill it while ghosted
    for (const o of internalMeshes) o.visible = show;
    if (!show) {
      spentMat.opacity = 0;
      velReadout.visible = false;
      boltReadout.visible = false;
      gasGlow.material.opacity = 0;
      gasPortGlow.material.opacity = 0;
    }
  }

  function showVel(on) {
    velReadout.visible = !!on && revealed;
  }
  function showBolt(on) {
    boltReadout.visible = !!on && revealed;
  }

  setReveal(0);
  setCycle(96);

  return {
    group,
    setCycle,
    setReveal,
    showVel,
    showBolt,
    parts: { carrierGroup, boltGroup, hammerPivot, flyBullet },
    setLabels(mode) {
      const ext = mode === 'exterior' || mode === true;
      const int = mode === 'internal';
      for (const c of exteriorCallouts) c.visible = ext;
      for (const c of internalCallouts) c.visible = int;
    },
  };
}
