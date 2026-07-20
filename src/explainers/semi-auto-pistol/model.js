import * as THREE from 'three';
import { materials, rod, box, disc } from '../../framework/parts.js';
import { beveledBox, lathe, tubeAlong, coil } from '../../framework/geometry.js';
import { callout } from '../../framework/labels.js';
import { stippleNormalMap } from '../../framework/textures.js';

// A striker-fired, short-recoil semi-automatic pistol (Glock/Browning-style
// tilting-barrel lockup), presented on a display pedestal.
//
// PROPORTIONS FIRST. A pistol reads as a pistol only if the big ratios are
// right: overall length ≈ 1.35 × overall height, the grip ≈ 0.6 × the slide
// length, the barrel/bore a slim fraction of the slide's width. Everything
// below is laid out from ONE consistent scale so the silhouette matches a real
// compact pistol — get this wrong and no amount of greebling saves it.
//
// TWO scalars drive it:
//
//  * `reveal` (0-1) is the LAYER control. At 0 the pistol is a complete, solid
//    object — one continuous steel slide on a polymer frame, a chunky raked
//    grip, a trigger guard: a real gun, nothing showing inside. As reveal → 1
//    the outer shell fades to a translucent x-ray and the internal-only parts
//    (barrel, striker, springs, magazine, chambered round) switch on.
//
//  * `cyc` (0-100, one lap = one full shot-and-reload) is the MOTION control.
//      0–8 pull · 8 break · 8–9.5 strike · 9.5–16 down the bore · 16 muzzle
//      exit · 17–45 slide/barrel recoil+unlock · 34–55 eject · 45–52 dwell ·
//      52–76 return+chamber+lock · 76–92 battery+reset · 92–100 idle.
//
// A third scalar, `race`, drives the "how fast is that, really" lane
// comparison — six reference speeds over the same real distance/time.

const TAU = Math.PI * 2;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smoothstep = (t) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
const win = (cyc, a, b) => (cyc <= a ? 0 : cyc >= b ? 1 : smoothstep((cyc - a) / (b - a)));
const pulse = (cyc, a, b) => (cyc <= a || cyc >= b ? 0 : Math.sin(Math.PI * ((cyc - a) / (b - a))));

// --- layout (world units; bore runs along +X, muzzle at +X end) -----------
const MUZZLE_X = 1.0;
const BARREL_LEN = 0.7;
const CHAMBER_X = MUZZLE_X - BARREL_LEN; // 0.30 — rear face of the chamber
const CHAMBER_GLASS_LEN = 0.16;
const BORE_Y = 0.92;
const BARREL_R = 0.044; // slim — a real bore is a fraction of the slide's width
const CHAMBER_R = 0.056;

const REC_TRAVEL = 0.2;
const LOCK_TRAVEL = 0.07;
const TILT_MAX = 0.17;

// slide (slide-local X; slide.position.y = BORE_Y). Sized so length ≈ 1.35 ×
// total height, the compact-pistol ratio; deep enough below the bore to house
// the recoil spring under the barrel.
const SLIDE_X0 = -0.15;
const SLIDE_X1 = 1.07; // length 1.22
const SLIDE_TOP = 0.1;
const SLIDE_BOT = -0.13;
const SLIDE_HW = 0.1;

const PEDESTAL_TOP = 0.12;
const GRIP_RAKE = 0.31; // ≈ 18°, a real pistol grip rake

const CASE_LEN = 0.28;
const CASE_R = 0.052;
const BULLET_LEN = 0.19;
const BULLET_R = 0.038;
const TWIST_SCENE = 0.32;

const RANGE_FADE_X = MUZZLE_X + 4.6;

const RACE = [
  { name: 'Cheetah, sprinting', v: 29, color: 0xd9a35c },
  { name: 'Formula 1 car, top speed', v: 97, color: 0xe0393e },
  { name: 'Airliner, cruise', v: 260, color: 0x8fd3ff },
  { name: 'Speed of sound', v: 343, color: 0xe8ecf2 },
  { name: 'This pistol’s bullet', v: 375, color: 0xd4b483 },
  { name: 'A rifle bullet', v: 900, color: 0xff6a3d },
];
const RACE_SCALE = 6.0 / 900;
const RACE_START_X = MUZZLE_X + 1.1;
const RACE_Z = 1.55;

export function buildPistol({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // --- materials --------------------------------------------------------
  // The reveal removes the shell in two ways. The metal SLIDE is HIDDEN
  // outright on reveal (transparent metal never actually looks see-through —
  // its specular reflections read as a solid surface and obscure the
  // mechanism, so we lift the lid off instead). The POLYMER frame/grip GHOSTS
  // to a faint translucent body (polymer has little specular, so low opacity
  // reads correctly) to keep spatial context around the mechanism.
  // Slide: a real Glock slide is a matte black nitride finish, not bright
  // stainless — a dark gunmetal at higher roughness reads far more like the
  // reference and sits richer against the gradient backdrop, while staying
  // light enough to keep its edges dimensional (pure black would flatten).
  const steelSkin = materials.brushedSteel(0x585d65);
  steelSkin.roughness = 0.52;
  const darkSkin = materials.darkMetal(0x141619);
  // Frame: matte moulded polymer (see the shared preset) — the old glossy
  // clearcoat read as cheap wet plastic and fought the x-ray ghost.
  const polymerSkin = materials.polymer(0x23262c);
  const gripPanel = materials.rubber(0x0c0d10);
  const stippleTex = stippleNormalMap();
  stippleTex.repeat.set(5, 9);
  gripPanel.normalMap = stippleTex;
  gripPanel.normalScale = new THREE.Vector2(0.85, 0.85);
  gripPanel.roughness = 0.92;
  const ghostMats = [polymerSkin, gripPanel, darkSkin]; // frame/grip fade to a faint body

  const chrome = materials.chrome(0xd6dbe1);
  // Used for the striker, springs and guide rod — internal STEEL parts, which
  // are satin/polished, not a mirror. A higher roughness both reads truer and
  // kills the blown-white specular the close-up + DOF bokeh otherwise clips.
  chrome.roughness = 0.34;
  const brass = materials.brushedSteel(0xc9a15a);
  const copper = materials.aluminum(0xb5793f);
  const steelDark = materials.steel(0x5c6169);
  const darkMetal = materials.darkMetal(0x1c1e22);
  const triggerMat = materials.steel(0x3a4048); // legible grey so the trigger reads, not black-on-black
  const glow = (color, intensity = 1.6) => {
    const m = materials.glow(color, intensity);
    m.transparent = true;
    m.opacity = 0;
    m.depthWrite = false;
    return m;
  };

  const internalMeshes = []; // only exist inside the gun; on while revealed
  const slideShellMeshes = []; // the metal slide "lid"; HIDDEN while revealed

  // --- pedestal -----------------------------------------------------------
  const pedestal = lathe(
    [
      [0.0, 0.0],
      [0.58, 0.0],
      [0.58, 0.03],
      [0.46, 0.09],
      [0.42, PEDESTAL_TOP],
      [0.0, PEDESTAL_TOP],
    ],
    materials.plastic(0x17181c),
  );
  pedestal.position.set(0.2, 0, 0);
  group.add(pedestal);

  // --- cartridge factory ---------------------------------------------------
  function makeCase(material) {
    const m = lathe(
      [
        [0.0, 0.0],
        [CASE_R * 0.94, 0.0],
        [CASE_R, 0.015],
        [CASE_R, CASE_LEN * 0.92],
        [CASE_R * 0.9, CASE_LEN],
      ],
      material,
    );
    m.rotation.z = -Math.PI / 2;
    return m;
  }
  function makeBullet(material) {
    const m = lathe(
      [
        [0.0, 0.0],
        [BULLET_R, 0.0],
        [BULLET_R, BULLET_LEN * 0.32],
        [BULLET_R * 0.82, BULLET_LEN * 0.62],
        [BULLET_R * 0.5, BULLET_LEN * 0.85],
        [BULLET_R * 0.16, BULLET_LEN * 0.97],
        [0.0, BULLET_LEN],
      ],
      material,
    );
    m.rotation.z = -Math.PI / 2;
    const band = new THREE.Mesh(new THREE.TorusGeometry(BULLET_R * 1.01, 0.005, 6, 20), darkMetal);
    band.rotation.y = Math.PI / 2;
    band.position.x = BULLET_LEN * 0.1;
    m.add(band);
    m.userData.band = band;
    return m;
  }

  // --- barrel (pivots at the chamber for the tilt-unlock) — INTERNAL --------
  const barrelPivot = new THREE.Group();
  barrelPivot.position.set(CHAMBER_X, BORE_Y, 0);
  group.add(barrelPivot);
  internalMeshes.push(barrelPivot);

  const chamberGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(CHAMBER_R, CHAMBER_R, CHAMBER_GLASS_LEN, 24, 1, true),
    materials.glass(0xffb347, 0.16),
  );
  chamberGlass.rotation.z = Math.PI / 2;
  chamberGlass.position.x = CHAMBER_GLASS_LEN / 2 + 0.01;
  chamberGlass.castShadow = false;
  barrelPivot.add(chamberGlass);

  const BORE_GLASS_LEN = BARREL_LEN - 0.12;
  const boreGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(BARREL_R, BARREL_R, BORE_GLASS_LEN - CHAMBER_GLASS_LEN, 24, 1, true),
    materials.glass(0xaac6e8, 0.13),
  );
  boreGlass.rotation.z = Math.PI / 2;
  boreGlass.position.x = (CHAMBER_GLASS_LEN + BORE_GLASS_LEN) / 2;
  boreGlass.castShadow = false;
  barrelPivot.add(boreGlass);

  const grooveMat = materials.darkMetal(0x1a1c21);
  for (let g = 0; g < 6; g++) {
    const phase = (g / 6) * TAU;
    const steps = 26;
    const pts = [];
    for (let s = 0; s <= steps; s++) {
      const x = CHAMBER_GLASS_LEN + (s / steps) * (BORE_GLASS_LEN - CHAMBER_GLASS_LEN);
      const ang = (x / TWIST_SCENE) * TAU + phase;
      pts.push([x, Math.cos(ang) * BARREL_R * 0.94, Math.sin(ang) * BARREL_R * 0.94]);
    }
    const groove = tubeAlong(pts, 0.003, grooveMat, { tubularSegments: steps, radialSegments: 6 });
    groove.castShadow = false;
    barrelPivot.add(groove);
  }

  const barrelSteel = lathe(
    [
      [0.0, 0.0],
      [BARREL_R, 0.0],
      [BARREL_R, BARREL_LEN - BORE_GLASS_LEN - 0.04],
      [BARREL_R * 0.7, BARREL_LEN - BORE_GLASS_LEN - 0.008],
      [BARREL_R * 0.58, BARREL_LEN - BORE_GLASS_LEN],
    ],
    steelDark,
  );
  barrelSteel.rotation.z = -Math.PI / 2;
  barrelSteel.position.x = BORE_GLASS_LEN;
  barrelPivot.add(barrelSteel);

  const lockLug = beveledBox(0.12, 0.035, 0.09, steelDark, 0.01);
  lockLug.position.set(0.04, CHAMBER_R + 0.018, 0);
  barrelPivot.add(lockLug);

  // --- recoil spring + guide rod, in the CLEAR SPACE under the barrel and
  // ABOVE the frame rail, so the x-ray actually shows it (was buried inside
  // the frame before). — INTERNAL
  const SPRING_Y = BORE_Y - BARREL_R - 0.05; // 0.826 — barrel bottom is 0.876, slide bottom 0.79
  const guideRod = rod(0.014, BARREL_LEN * 0.72, chrome);
  guideRod.rotation.z = -Math.PI / 2;
  guideRod.position.set(CHAMBER_X - 0.02, SPRING_Y, 0);
  group.add(guideRod);
  internalMeshes.push(guideRod);
  const recoilSpring = coil(
    { turns: 15, radius: 0.026, length: BARREL_LEN * 0.66, wireRadius: 0.006 },
    chrome,
  ).mesh;
  recoilSpring.rotation.z = Math.PI / 2;
  recoilSpring.position.set(CHAMBER_X + 0.02, SPRING_Y, 0);
  group.add(recoilSpring);
  internalMeshes.push(recoilSpring);

  // --- chambered round — INTERNAL ------------------------------------------
  const chamberedCase = makeCase(brass);
  chamberedCase.position.set(CHAMBER_X + 0.01, BORE_Y, 0);
  group.add(chamberedCase);
  internalMeshes.push(chamberedCase);
  const primerDisc = disc(0.017, 0.006, materials.steel(0xb9c0c8));
  primerDisc.rotation.x = Math.PI / 2;
  primerDisc.position.set(CHAMBER_X - 0.003, BORE_Y, 0);
  group.add(primerDisc);
  internalMeshes.push(primerDisc);

  const bullet = makeBullet(copper);
  const BULLET_CHAMBER_X = CHAMBER_X + CASE_LEN * 0.9;
  bullet.position.set(BULLET_CHAMBER_X, BORE_Y, 0);
  group.add(bullet);

  // --- ejected case (separate instance, hidden until fired) ---------------
  const ejectedCase = makeCase(brass);
  ejectedCase.position.copy(chamberedCase.position);
  const ejMat = new THREE.MeshPhysicalMaterial({
    color: 0xc9a15a, metalness: 1, roughness: 0.3, transparent: true, opacity: 0,
  });
  ejectedCase.traverse((o) => { if (o.isMesh) o.material = ejMat; });
  group.add(ejectedCase);

  // --- muzzle flash + primer flash -----------------------------------------
  const muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 12), glow(0xffdca0, 3));
  muzzleFlash.position.set(MUZZLE_X + 0.06, BORE_Y, 0);
  group.add(muzzleFlash);
  const muzzleLight = new THREE.PointLight(0xffdca0, 0, 2);
  muzzleLight.position.copy(muzzleFlash.position);
  group.add(muzzleLight);

  const primerGlow = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), glow(0xffb45e, 3));
  primerGlow.position.set(CHAMBER_X, BORE_Y, 0);
  group.add(primerGlow);
  const primerLight = new THREE.PointLight(0xffb45e, 0, 1);
  primerLight.position.copy(primerGlow.position);
  group.add(primerLight);

  // ================= EXTERIOR SHELL =======================================
  const slide = new THREE.Group();
  slide.position.set(0, BORE_Y, 0);
  group.add(slide);

  const SLIDE_CY = (SLIDE_TOP + SLIDE_BOT) / 2;
  const addSlideShell = (mesh) => {
    slide.add(mesh);
    slideShellMeshes.push(mesh);
    return mesh;
  };

  // The slide body stops SHORT of the muzzle so the front is an open bezel
  // (below) with a real bore hole — not a solid box face the bullet would
  // have to pass through.
  const BEZEL_DEPTH = 0.18;
  const BEZEL_X0 = SLIDE_X1 - BEZEL_DEPTH; // 0.89
  const bodyLen = BEZEL_X0 - SLIDE_X0;
  // Glock slide cross-section: flat bottom, vertical sides, and the signature
  // 45deg chamfers on the top corners meeting a flat top — extruded along the
  // bore. (A plain box read as a brick; the chamfered top is THE slide tell.)
  const SLIDE_CHAMFER = 0.038;
  const slideSect = new THREE.Shape();
  slideSect.moveTo(-SLIDE_HW, SLIDE_BOT);
  slideSect.lineTo(SLIDE_HW, SLIDE_BOT);
  slideSect.lineTo(SLIDE_HW, SLIDE_TOP - SLIDE_CHAMFER);
  slideSect.lineTo(SLIDE_HW - SLIDE_CHAMFER, SLIDE_TOP);
  slideSect.lineTo(-(SLIDE_HW - SLIDE_CHAMFER), SLIDE_TOP);
  slideSect.lineTo(-SLIDE_HW, SLIDE_TOP - SLIDE_CHAMFER);
  slideSect.closePath();
  const slideBodyGeo = new THREE.ExtrudeGeometry(slideSect, {
    depth: bodyLen,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.006,
    bevelSegments: 1,
    curveSegments: 1,
  });
  slideBodyGeo.rotateY(Math.PI / 2); // extrude axis +Z → +X (bore)
  const slideBody = new THREE.Mesh(slideBodyGeo, steelSkin);
  slideBody.castShadow = true;
  slideBody.position.set(SLIDE_X0 + 0.006, 0, 0);
  addSlideShell(slideBody);

  // MUZZLE bezel: the slide's front face as an EXTRUDED plate WITH A CIRCULAR
  // HOLE bored through it, so the bore is genuinely hollow and the bullet
  // exits through empty space.
  const bezelShape = new THREE.Shape();
  bezelShape.moveTo(-SLIDE_HW, SLIDE_BOT);
  bezelShape.lineTo(SLIDE_HW, SLIDE_BOT);
  bezelShape.lineTo(SLIDE_HW, SLIDE_TOP);
  bezelShape.lineTo(-SLIDE_HW, SLIDE_TOP);
  bezelShape.closePath();
  const holePath = new THREE.Path();
  holePath.absarc(0, 0, BARREL_R + 0.016, 0, TAU, true);
  bezelShape.holes.push(holePath);
  const bezelGeo = new THREE.ExtrudeGeometry(bezelShape, {
    depth: BEZEL_DEPTH,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.008,
    bevelSegments: 1,
  });
  bezelGeo.rotateY(Math.PI / 2); // extrude Z → +X
  const boreBezel = new THREE.Mesh(bezelGeo, steelSkin);
  boreBezel.castShadow = true;
  boreBezel.position.set(BEZEL_X0, 0, 0);
  addSlideShell(boreBezel);
  // a short dark bore liner behind the hole so it reads black, not see-through
  const boreLiner = new THREE.Mesh(
    new THREE.CylinderGeometry(BARREL_R + 0.014, BARREL_R + 0.014, BEZEL_DEPTH, 20, 1, true).rotateZ(
      Math.PI / 2,
    ),
    materials.darkMetal(0x050506),
  );
  boreLiner.material.side = THREE.BackSide;
  boreLiner.position.set(BEZEL_X0 + BEZEL_DEPTH / 2, 0, 0);
  addSlideShell(boreLiner);

  // ejection port — a dark recess sunk into the top-right over the chamber
  const port = beveledBox(0.26, 0.06, 0.11, darkSkin, 0.008);
  port.position.set(CHAMBER_X + 0.06, SLIDE_TOP - 0.03, 0.03);
  addSlideShell(port);

  // sights — a post front sight (base + blade + a white-dot insert) and a
  // two-eared rear sight with a real U-notch gap between the ears, matching
  // the reference photos (not a single anonymous block).
  const sightDot = materials.glow(0xf2f4f8, 0.5);
  const FRONT_SIGHT_X = SLIDE_X1 - 0.13;
  const frontSightBase = beveledBox(0.03, 0.014, 0.032, darkSkin, 0.004);
  frontSightBase.position.set(FRONT_SIGHT_X, SLIDE_TOP + 0.007, 0);
  addSlideShell(frontSightBase);
  const frontSight = beveledBox(0.016, 0.038, 0.018, darkSkin, 0.004);
  frontSight.position.set(FRONT_SIGHT_X, SLIDE_TOP + 0.007 + 0.007 + 0.019, 0);
  addSlideShell(frontSight);
  const frontDot = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 10, 8), sightDot);
  frontDot.position.set(FRONT_SIGHT_X - 0.01, SLIDE_TOP + 0.007 + 0.007 + 0.026, 0);
  addSlideShell(frontDot);

  const REAR_SIGHT_X = SLIDE_X0 + 0.13;
  const rearSightBase = beveledBox(0.05, 0.028, SLIDE_HW * 1.86, darkSkin, 0.006);
  rearSightBase.position.set(REAR_SIGHT_X, SLIDE_TOP + 0.008, 0);
  addSlideShell(rearSightBase);
  const rearSight = beveledBox(0.024, 0.05, 0.026, darkSkin, 0.005); // left ear (also the "Sights" callout anchor)
  rearSight.position.set(REAR_SIGHT_X, SLIDE_TOP + 0.026, SLIDE_HW * 0.62);
  addSlideShell(rearSight);
  const rearEarR = rearSight.clone();
  rearEarR.position.z = -SLIDE_HW * 0.62;
  addSlideShell(rearEarR);
  for (const z of [SLIDE_HW * 0.62 - 0.014, -SLIDE_HW * 0.62 + 0.014]) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.005, 10, 8), sightDot);
    dot.position.set(REAR_SIGHT_X - 0.008, SLIDE_TOP + 0.028, z);
    addSlideShell(dot);
  }

  // rear cocking serrations
  for (let i = 0; i < 6; i++) {
    const gx = SLIDE_X0 + 0.09 + i * 0.032;
    for (const z of [SLIDE_HW + 0.002, -(SLIDE_HW + 0.002)]) {
      const groove = box(0.012, 0.17, 0.012, darkSkin);
      groove.position.set(gx, SLIDE_CY, z);
      addSlideShell(groove);
    }
  }
  // front cocking serrations (Gen4/Gen5-style), ahead of the ejection port —
  // stop well short of the bezel so they read as a separate grip zone.
  for (let i = 0; i < 5; i++) {
    const gx = BEZEL_X0 - 0.07 - i * 0.026;
    for (const z of [SLIDE_HW + 0.002, -(SLIDE_HW + 0.002)]) {
      const groove = box(0.01, 0.15, 0.01, darkSkin);
      groove.position.set(gx, SLIDE_CY, z);
      addSlideShell(groove);
    }
  }

  const extractor = beveledBox(0.055, 0.028, 0.02, darkSkin, 0.005);
  extractor.position.set(CHAMBER_X + 0.06, SLIDE_TOP - 0.04, SLIDE_HW - 0.005);
  addSlideShell(extractor);

  // striker + firing pin — chrome (not shell), occluded while solid
  const STRIKER_LEN = 0.22;
  const striker = new THREE.Group();
  const strikerBody = rod(0.024, STRIKER_LEN, chrome);
  strikerBody.rotation.z = -Math.PI / 2;
  striker.add(strikerBody);
  const strikerShoulder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.05, 16).rotateZ(Math.PI / 2),
    chrome,
  );
  strikerShoulder.position.x = 0.03;
  striker.add(strikerShoulder);
  const pinTip = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.04, 14).rotateZ(-Math.PI / 2), chrome);
  pinTip.position.x = STRIKER_LEN + 0.02;
  striker.add(pinTip);
  slide.add(striker);
  const strikerSpring = coil({ turns: 9, radius: 0.024, length: 0.12, wireRadius: 0.005 }, chrome)
    .mesh;
  strikerSpring.rotation.z = Math.PI / 2;
  strikerSpring.position.x = 0.03;
  striker.add(strikerSpring);
  const STRIKER_BASE_FWD = CHAMBER_X - 0.05 - STRIKER_LEN;
  const STRIKER_BASE_COCKED = STRIKER_BASE_FWD - 0.13;

  // --- frame (tinted polymer) : dust cover, trigger-guard shelf and grip
  // built as ONE continuous extruded silhouette (same technique as the slide
  // body above) — a real Glock frame is a single moulded piece, and building
  // it from separate disconnected boxes was the single biggest "broken" tell
  // (the grip read as a floating slab with a gap at the trigger). The whole
  // outline — including the grip's backward rake — is traced directly in
  // world (X=bore, Y=up) coordinates; the trigger guard hangs off it as a
  // separate tube loop (real guns' guard is a thin bail, not part of the
  // load-bearing silhouette).
  const FRAME_TOP = BORE_Y + SLIDE_BOT; // 0.79 — slide sits on this
  const FRAME_HW = 0.092; // frame slightly narrower than the slide, which overhangs it
  const DUST_X1 = 0.85; // dust-cover tip, just short of the muzzle bezel
  const FRAME_BELLY_Y = FRAME_TOP - 0.19; // 0.60 — flat underside of the dust cover
  const BELLY_BACK_X = 0.1; // where the belly meets the top of the front strap

  // rake direction: unit vector "down the grip" and its perpendicular
  // ("outward/forward", front-strap side) — every raked point below is this
  // constant plus a length along one or both of these, so the front strap,
  // backstrap and beavertail all stay parallel/consistent by construction.
  const RAKE_DOWN = [Math.sin(GRIP_RAKE), -Math.cos(GRIP_RAKE)];
  const RAKE_OUT = [Math.cos(GRIP_RAKE), Math.sin(GRIP_RAKE)];
  const along = (base, dir, len) => [base[0] + dir[0] * len, base[1] + dir[1] * len];

  const FS0 = [BELLY_BACK_X, FRAME_BELLY_Y]; // top of the front strap
  const FRONT_STRAP_LEN = 0.4;
  const FS1 = along(FS0, RAKE_DOWN, FRONT_STRAP_LEN); // grip bottom-front corner
  const GRIP_DEPTH = 0.3; // front-strap-to-backstrap distance
  const GBB = along(FS1, RAKE_OUT, -GRIP_DEPTH); // grip bottom-back corner
  const BACKSTRAP_LEN = 0.44;
  const BST = along(GBB, RAKE_DOWN, -BACKSTRAP_LEN); // top of the backstrap
  const BTF = [BST[0] + 0.05, BST[1] + 0.1]; // beavertail flare, tucks under the slide's rear
  const REAR_TOP = [-0.17, FRAME_TOP];
  const DCBF = [DUST_X1, FRAME_BELLY_Y]; // dust-cover bottom-front
  const DCTF = [DUST_X1, FRAME_TOP]; // dust-cover top-front

  // finger grooves: 2-3 shallow scallops dented into the front strap, not a
  // flat plank — a real Glock frame carves these directly into the silhouette.
  const GROOVE_DEPTH = 0.014;
  function frontStrapPoint(t) {
    const hump = Math.pow(Math.sin(t * 3 * Math.PI), 2);
    return [
      FS1[0] + (FS0[0] - FS1[0]) * t - RAKE_OUT[0] * hump * GROOVE_DEPTH,
      FS1[1] + (FS0[1] - FS1[1]) * t - RAKE_OUT[1] * hump * GROOVE_DEPTH,
    ];
  }

  const frameShape = new THREE.Shape();
  frameShape.moveTo(GBB[0], GBB[1]);
  frameShape.lineTo(FS1[0], FS1[1]);
  for (let i = 1; i <= 10; i++) frameShape.lineTo(...frontStrapPoint(i / 10));
  frameShape.lineTo(DCBF[0], DCBF[1]);
  frameShape.lineTo(DCTF[0], DCTF[1]);
  frameShape.lineTo(REAR_TOP[0], REAR_TOP[1]);
  frameShape.lineTo(BTF[0], BTF[1]);
  frameShape.lineTo(BST[0], BST[1]);
  frameShape.closePath();
  const frameBodyGeo = new THREE.ExtrudeGeometry(frameShape, {
    depth: FRAME_HW * 2,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.009,
    bevelSegments: 2,
    curveSegments: 1,
  });
  frameBodyGeo.translate(0, 0, -FRAME_HW);
  const frameBody = new THREE.Mesh(frameBodyGeo, polymerSkin);
  frameBody.castShadow = true;
  group.add(frameBody);

  // accessory rail: three short cross-ribs on the underside of the dust cover
  for (let i = 0; i < 3; i++) {
    const rib = beveledBox(0.03, 0.022, FRAME_HW * 2 + 0.006, darkSkin, 0.004);
    rib.position.set(DUST_X1 - 0.12 - i * 0.11, FRAME_BELLY_Y - 0.011, 0);
    group.add(rib);
  }
  // slide-stop lever (left side, above the trigger) + takedown lever below it
  const slideStop = beveledBox(0.18, 0.03, 0.016, darkSkin, 0.006);
  slideStop.position.set(0.16, FRAME_TOP - 0.055, -(FRAME_HW + 0.008));
  group.add(slideStop);
  const takedown = beveledBox(0.05, 0.038, 0.014, darkSkin, 0.006);
  takedown.position.set(0.235, FRAME_TOP - 0.1, -(FRAME_HW + 0.006));
  group.add(takedown);
  // magazine-release button, on the frame just behind the trigger guard
  const magRelease = beveledBox(0.042, 0.042, 0.018, darkSkin, 0.008);
  magRelease.position.set(0.06, 0.58, FRAME_HW + 0.003);
  group.add(magRelease);

  // --- trigger guard : a rounded loop traced with a tube, hanging off the
  // belly (front) and the front strap (rear) --------------------------------
  const GUARD_TOP_REAR = along(FS0, RAKE_DOWN, FRONT_STRAP_LEN * 0.15); // attaches ON the front strap
  const guardPts = [
    [0.34, FRAME_BELLY_Y, 0], // top-front, attaches ON the belly
    [0.32, 0.44, 0],
    [0.2, 0.395, 0],
    [0.02, 0.395, 0],
    [-0.07, 0.44, 0],
    [GUARD_TOP_REAR[0], GUARD_TOP_REAR[1], 0],
  ];
  const guard = tubeAlong(guardPts, 0.028, polymerSkin, { tubularSegments: 56 });
  group.add(guard);

  // --- trigger blade (exterior) : sits in the OPEN centre of the guard -----
  const TRIG_PIVOT = new THREE.Vector3(0.19, 0.5, 0);
  const triggerPivot = new THREE.Group();
  triggerPivot.position.copy(TRIG_PIVOT);
  group.add(triggerPivot);
  const triggerBlade = beveledBox(0.034, 0.14, 0.058, triggerMat, 0.012);
  triggerBlade.position.set(0.004, -0.08, 0);
  triggerBlade.rotation.z = -0.13; // a real trigger bows forward
  triggerPivot.add(triggerBlade);
  // trigger-safety tab down the middle (the Glock tell)
  const trigTab = beveledBox(0.012, 0.09, 0.018, chrome, 0.004);
  trigTab.position.set(0.011, -0.07, 0.031);
  triggerPivot.add(trigTab);

  // trigger bar : runs REARWARD and up from the trigger to the striker/sear
  const barPivot = new THREE.Group();
  barPivot.position.set(0.19, 0.52, 0);
  group.add(barPivot);
  internalMeshes.push(barPivot);
  const triggerBar = tubeAlong(
    [
      [0, 0, 0],
      [0.02, 0.05, 0],
      [0.05, 0.11, 0],
    ],
    0.01,
    darkMetal,
  );
  barPivot.add(triggerBar);

  // --- grip skin : stippled texture panels + magazine internals, raked to
  // match the frame body's baked-in silhouette ------------------------------
  const GRIP_DEPTH_HALF = GRIP_DEPTH / 2;
  const GRIP_TOP = new THREE.Vector3(
    FS0[0] - RAKE_OUT[0] * GRIP_DEPTH_HALF,
    FS0[1] - RAKE_OUT[1] * GRIP_DEPTH_HALF,
    0,
  ); // grip centreline, at the mouth of the mag well
  const gripPivot = new THREE.Group();
  gripPivot.position.copy(GRIP_TOP);
  gripPivot.rotation.z = GRIP_RAKE;
  group.add(gripPivot);
  const GRIP_H = (FRONT_STRAP_LEN + BACKSTRAP_LEN) / 2 - 0.02;
  for (const z of [1, -1]) {
    const panel = beveledBox(GRIP_DEPTH - 0.05, GRIP_H - 0.1, 0.012, gripPanel, 0.008);
    panel.position.set(0.01, -GRIP_H / 2, z * (FRAME_HW + 0.006));
    gripPivot.add(panel);
  }
  const gripFrontPanel = beveledBox(0.016, GRIP_H - 0.16, FRAME_HW * 2 - 0.03, gripPanel, 0.006);
  gripFrontPanel.position.set(GRIP_DEPTH_HALF - 0.006, -GRIP_H / 2 + 0.02, 0);
  gripPivot.add(gripFrontPanel);
  const gripBackPanel = beveledBox(0.016, GRIP_H - 0.16, FRAME_HW * 2 - 0.03, gripPanel, 0.006);
  gripBackPanel.position.set(-GRIP_DEPTH_HALF + 0.006, -GRIP_H / 2 - 0.01, 0);
  gripPivot.add(gripBackPanel);
  const floorplate = beveledBox(GRIP_DEPTH + 0.01, 0.045, FRAME_HW * 2 + 0.025, darkSkin, 0.012);
  floorplate.position.y = -GRIP_H + 0.025;
  gripPivot.add(floorplate);

  // --- magazine (INTERNAL) : horizontal rounds stacked down the grip,
  // bigger and centred so they read clearly through the ghosted grip --------
  const MAG_SCALE = 0.6;
  const magCaseLen = CASE_LEN * MAG_SCALE;
  const MAG_COUNT = 5;
  const MAG_PITCH = 0.088;
  const MAG_TOP_Y = -0.11;
  const magBrass = materials.brushedSteel(0xd8b064); // brighter so it pops
  for (let i = 0; i < MAG_COUNT; i++) {
    const c = makeCase(magBrass);
    const b = makeBullet(copper);
    c.scale.setScalar(MAG_SCALE);
    b.scale.setScalar(MAG_SCALE);
    const baseX = -0.08 + (i % 2 === 0 ? 0 : 0.016);
    const y = MAG_TOP_Y - i * MAG_PITCH;
    c.position.set(baseX, y, 0);
    b.position.set(baseX + magCaseLen * 0.9, y, 0);
    gripPivot.add(c, b);
    internalMeshes.push(c, b);
  }
  const follower = box(0.16, 0.02, 0.11, darkMetal);
  follower.position.set(-0.02, MAG_TOP_Y - MAG_COUNT * MAG_PITCH, 0);
  gripPivot.add(follower);
  internalMeshes.push(follower);
  const magSpring = coil(
    { turns: 10, radius: 0.026, length: GRIP_H - 0.62, wireRadius: 0.005 },
    chrome,
  ).mesh;
  magSpring.position.y = -GRIP_H + 0.28;
  gripPivot.add(magSpring);
  internalMeshes.push(magSpring);

  // --- downrange rail for the fired bullet ---------------------------------
  const rail = beveledBox(RANGE_FADE_X - MUZZLE_X + 0.4, 0.02, 0.06, materials.darkMetal(0x121317), 0.008);
  rail.position.set((MUZZLE_X + RANGE_FADE_X) / 2, 0.01, 0);
  group.add(rail);
  const backstop = beveledBox(0.05, 0.5, 0.5, materials.darkMetal(0x1a1c21), 0.02);
  backstop.position.set(RANGE_FADE_X + 0.15, 0.35, 0);
  group.add(backstop);

  // --- speed-comparison track ----------------------------------------------
  const raceGroup = new THREE.Group();
  raceGroup.position.set(0, 0, RACE_Z);
  group.add(raceGroup);
  const raceBase = beveledBox(6.4, 0.015, 1.5, materials.darkMetal(0x121317), 0.01);
  raceBase.position.set(RACE_START_X + 3.0, 0.008, 0);
  raceGroup.add(raceBase);

  const raceCallouts = [];
  const raceTokens = RACE.map((r, i) => {
    const laneZ = -0.6 + i * 0.24;
    let mesh;
    if (r.name === 'Speed of sound') {
      mesh = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 8, 20), glow(r.color, 2.2));
      mesh.rotation.y = Math.PI / 2;
    } else {
      mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.05, 4, 10), glow(r.color, 2.2));
      mesh.rotation.z = Math.PI / 2;
    }
    mesh.material.opacity = 0.9;
    mesh.position.set(RACE_START_X, 0.045, laneZ);
    raceGroup.add(mesh);
    const label = callout(`${r.name} · ${r.v} m/s`, { dir: 55, len: 34 });
    label.visible = false;
    mesh.add(label);
    raceCallouts.push(label);
    return { mesh, v: r.v, laneZ };
  });

  // --- callout labels : two sets ------------------------------------------
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
  addCallout(exteriorCallouts, slideBody, 'Slide', [0.2, 0.1, 0], 115, 60);
  addCallout(exteriorCallouts, rearSight, 'Sights', [0, 0.05, 0], 75, 44);
  addCallout(exteriorCallouts, triggerBlade, 'Trigger', [-0.02, -0.05, 0.05], -35, 52);
  addCallout(exteriorCallouts, frameBody, 'Frame (polymer)', [0.45, 0.72, 0.08], -55, 58);
  addCallout(exteriorCallouts, gripPivot, 'Grip / magazine well', [0.02, -0.2, 0.13], -80, 60);
  addCallout(exteriorCallouts, boreBezel, 'Muzzle', [0.02, -0.02, 0], 15, 50);

  addCallout(internalCallouts, striker, 'Striker + firing pin', [0.06, 0.06, 0], 78, 72);
  addCallout(internalCallouts, barrelSteel, 'Barrel + rifling', [-0.12, 0.07, 0], 130, 58);
  addCallout(internalCallouts, chamberedCase, 'Chambered cartridge', [0.02, 0.06, 0.05], 55, 52);
  addCallout(internalCallouts, barPivot, 'Trigger bar', [0.08, 0.02, 0], -100, 58);
  addCallout(internalCallouts, recoilSpring, 'Recoil spring', [0.12, -0.06, 0], -120, 56);
  addCallout(internalCallouts, gripPivot, 'Magazine', [0.12, -0.3, 0], 25, 64);

  // live readout (#17): chamber pressure — near-zero at rest, spiking to
  // ~35,000 PSI for the couple of milliseconds the powder burns behind the
  // bullet. Shown whenever the mechanism is revealed (independent of the label
  // sets), so the pressure spike reads on every internal step.
  const psiReadout = callout('Chamber — 0 PSI', { dir: 60, len: 100, key: 'psi-readout' });
  psiReadout.position.set(CHAMBER_X + 0.05, BORE_Y + 0.15, 0);
  psiReadout.visible = false;
  group.add(psiReadout);

  // --- pose ------------------------------------------------------------------
  const mod100 = (c) => ((c % 100) + 100) % 100;
  let revealed = false;

  function setCycle(cycRaw) {
    const cyc = mod100(cycRaw);

    const triggerT = win(cyc, 0, 8) - win(cyc, 80, 92);
    triggerPivot.rotation.x = triggerT * 0.42;
    barPivot.rotation.x = -triggerT * 0.1;

    const preTravel = win(cyc, 1, 8) * 0.05;
    const strikeT = win(cyc, 8, 9.3);
    const recockT = win(cyc, 20, 46);
    let strikerBaseX;
    if (cyc < 8) strikerBaseX = STRIKER_BASE_COCKED + preTravel;
    else if (cyc < 20)
      strikerBaseX =
        STRIKER_BASE_COCKED + preTravel + strikeT * (STRIKER_BASE_FWD - (STRIKER_BASE_COCKED + preTravel));
    else strikerBaseX = STRIKER_BASE_FWD + recockT * (STRIKER_BASE_COCKED - STRIKER_BASE_FWD);
    striker.position.x = strikerBaseX;

    const ignite = pulse(cyc, 8, 11);
    primerGlow.material.opacity = ignite;
    primerGlow.scale.setScalar(0.5 + ignite * 1.2);
    primerLight.intensity = ignite * 2;

    // live chamber-pressure readout: a bell spike while the powder burns and
    // the bullet is still in the bore (cyc 8–16.5), rounded to a gauge-like value
    if (psiReadout.visible) {
      const fireP = cyc >= 8 && cyc < 16.5 ? Math.sin((Math.PI * (cyc - 8)) / 8.5) : 0;
      psiReadout.setText(`Chamber — ${(Math.round((fireP * 35000) / 500) * 500).toLocaleString()} PSI`);
    }

    const slideBack =
      cyc < 17 ? 0 : cyc < 45 ? win(cyc, 17, 45) * REC_TRAVEL
      : cyc < 52 ? REC_TRAVEL
      : cyc < 76 ? REC_TRAVEL * (1 - win(cyc, 52, 76))
      : 0;
    slide.position.x = -slideBack;

    const barrelBack = Math.min(slideBack, LOCK_TRAVEL);
    barrelPivot.position.x = CHAMBER_X - barrelBack;
    const tiltFrac = clamp01((slideBack - LOCK_TRAVEL) / (REC_TRAVEL - LOCK_TRAVEL));
    barrelPivot.rotation.z = -tiltFrac * TILT_MAX;

    const accel = win(cyc, 8.6, 16);
    let bulletX;
    if (cyc < 8.6) bulletX = BULLET_CHAMBER_X;
    else if (cyc < 16) bulletX = BULLET_CHAMBER_X + accel * (MUZZLE_X - BULLET_CHAMBER_X);
    else {
      const flightT = win(cyc, 16, 92);
      bulletX = MUZZLE_X + flightT * (RANGE_FADE_X - MUZZLE_X);
    }
    bullet.position.x = bulletX;
    bullet.position.y = BORE_Y - (cyc > 16 ? Math.pow(win(cyc, 16, 92), 1.6) * 0.28 : 0);
    const traveled = Math.max(0, bulletX - BULLET_CHAMBER_X);
    bullet.rotation.x = (traveled / TWIST_SCENE) * TAU;
    const bulletMat = bullet.material;
    bulletMat.transparent = true;
    bulletMat.opacity = 1 - win(cyc, 88, 93);
    bulletMat.depthWrite = bulletMat.opacity > 0.9;
    bullet.userData.band.visible = bulletMat.opacity > 0.05;

    const muzzle = pulse(cyc, 15.4, 18.5);
    muzzleFlash.material.opacity = muzzle;
    muzzleFlash.scale.setScalar(0.4 + muzzle * 1.4);
    muzzleLight.intensity = muzzle * 4;

    // ejection only shown while REVEALED — never floating over a solid gun
    if (!revealed) {
      ejMat.opacity = 0;
    } else if (cyc >= 20 && cyc < 34) {
      ejectedCase.position.set(CHAMBER_X + 0.01 - slideBack, BORE_Y, 0);
      ejectedCase.rotation.set(0, 0, 0);
      ejMat.opacity = 1;
    } else if (cyc >= 34 && cyc < 58) {
      const t = win(cyc, 34, 55);
      ejectedCase.position.set(
        CHAMBER_X + 0.01 - LOCK_TRAVEL + t * 0.5,
        BORE_Y + Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.45,
        t * 0.85,
      );
      ejectedCase.rotation.set(t * 9, t * 4, t * 7);
      ejMat.opacity = Math.max(0, 1 - win(cyc, 48, 58));
    } else {
      ejMat.opacity = 0;
      ejectedCase.rotation.set(0, 0, 0);
    }

    // the chambered round is only in the chamber when loaded — once fired it
    // becomes the ejectedCase and must NOT linger as a second brass in the bore
    const loaded = cyc < 20 || cyc > 76;
    chamberedCase.visible = revealed && loaded;
    primerDisc.visible = revealed && loaded;

    const strip = win(cyc, 58, 70) - win(cyc, 76, 90);
    follower.position.y = MAG_TOP_Y - MAG_COUNT * MAG_PITCH + strip * 0.06;
  }

  function setReveal(t) {
    const r = clamp01(t);
    revealed = r > 0.5;
    const show = r > 0.5;
    // The metal SLIDE is a lid — lifted off entirely when revealed (a ghosted
    // metal slide still reads as solid and buries the mechanism).
    for (const o of slideShellMeshes) o.visible = !show;
    // The polymer frame/grip GHOSTS to a faint body so the mechanism keeps its
    // spatial context (polymer's low specular actually reads as translucent).
    // Kept quite transparent so the magazine reads clearly through the grip.
    const op = 1 - r * 0.83; // 1 → 0.17
    for (const m of ghostMats) {
      m.transparent = r > 0.02;
      m.opacity = op;
      m.depthWrite = r < 0.35;
    }
    for (const o of internalMeshes) o.visible = show;
    if (!show) {
      ejMat.opacity = 0;
      psiReadout.visible = false; // no readout on the solid pistol
    }
  }

  // the PSI readout is only meaningful on the firing steps (the chamber-pressure
  // spike) — steps opt in via showPsi so it doesn't clutter the others
  function showPsi(on) {
    psiReadout.visible = !!on && revealed;
  }

  function setRace(t) {
    const tt = clamp01(t);
    raceTokens.forEach(({ mesh, v }) => {
      const dist = v * RACE_SCALE * tt;
      mesh.position.x = RACE_START_X + Math.min(dist, 6.3);
      mesh.material.opacity = tt < 0.02 ? 0 : 0.95;
      if (mesh.geometry.type === 'TorusGeometry') mesh.rotation.x += 0.02;
    });
    raceCallouts.forEach((c) => (c.visible = tt > 0.15 && tt < 0.98));
  }

  setReveal(0);
  setCycle(94);
  setRace(0);

  return {
    group,
    setCycle,
    setReveal,
    setRace,
    showPsi,
    setLabels(mode) {
      const ext = mode === 'exterior' || mode === true;
      const int = mode === 'internal';
      for (const c of exteriorCallouts) c.visible = ext;
      for (const c of internalCallouts) c.visible = int;
    },
  };
}
