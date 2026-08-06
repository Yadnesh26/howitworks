import * as THREE from 'three';
import { materials, studioPlinth } from '../../framework/parts.js';
import { beveledBox, lathe, boltCircle, chainPath } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { castNormalMap, smudgeMap } from '../../framework/textures.js';
import { clamp01, win, TAU } from '../../framework/motion.js';

// A full-frame DSLR, presented as a sealed product that opens up to the two
// machines living inside it: an optical periscope that lets you look straight
// down the taking lens, and a shutter/sensor pair that steals one slice of
// time out of it.
//
// MECHANISM (researched):
//  - COMPOSING: light through the lens hits a mirror set at 45°, which throws
//    it up onto a ground focusing screen. A pentaprism above the screen
//    reflects the image twice more (roof face -> roof face -> exit face),
//    undoing both the vertical flip and the lateral reversal, and sends it out
//    of the eyepiece. You are literally looking through the taking lens.
//  - APERTURE: an iris of 9 overlapping blades pivoting on a ring. One full
//    stop (f/8 -> f/5.6) doubles the light reaching the sensor.
//  - EXPOSING: the mirror slaps up (blacking out the viewfinder), the FIRST
//    curtain travels to uncover the sensor, the SECOND curtain follows to
//    cover it again, both recock, the mirror drops.
//  - THE SLIT: past the flash-sync speed (~1/250 s) the second curtain
//    launches before the first has finished, so the sensor is never fully
//    open — it is scanned by a travelling slit. That is exactly why a flash
//    fired past sync speed leaves a black band across the frame.
//  - SENSOR: a grid of photodiodes counting photons. A photodiode is colour
//    blind, so a Bayer mosaic (50% green, 25% red, 25% blue) filters each
//    well; demosaicing interpolates the two missing colours per pixel.
//
// PROPORTIONS: a full-frame body is 150.7 x 116.4 x 75.9 mm (W x H x D), so
// W:H:D = 1 : 0.772 : 0.504. BW is the ONE scale constant and MM converts real
// millimetres into world units, so every dimension below is the real part at
// its real size and the ratios hold by construction. The depth is split the
// way a real body splits it: a 55 mm slab from the back panel to the lens
// mount, with the hand grip bulging the remaining 21 mm forward. Two more
// numbers matter optically and are exact: a 36 x 24 mm sensor, and the 44 mm
// flange distance from the mount to the sensor plane.
//
// STATE the pose is built from (one scalar object, one pose function):
//   spin    presentation turntable angle (rad)
//   reveal  0 sealed product / 1 shell turned to glass
//   iris    0 stopped down to a pinhole / 1 wide open
//   cycle   0..1, ONE complete exposure (mirror, both curtains, recock)
//   fast    0 below flash sync (sensor fully open) / 1 above it (slit)
//   flow    0..1 photon phase along the light paths, whole laps per lap
//   sense   0..1 sensor fill-then-readout phase (the sensor step only)
//   macro   0/1 the magnified Bayer-mosaic inset

const BW = 2.7; // body width — the ONE scale constant
const MM = BW / 150.7; // world units per real millimetre

const BH = 92.4 * MM; // 1.656  main body height (the hump sits on top)
const BD = 55 * MM; // 0.985  back panel -> lens mount
const HUMP = 24 * MM; // 0.430  pentaprism hump above the top plate
const AXIS_Y = 47 * MM; // 0.842  optical axis, a little above body centre
const FRONT = BD / 2; // 0.493  the lens mount plane
const GRIP_F = FRONT + 20.9 * MM; // 0.867  how far the grip bulges forward
const FLANGE = 44 * MM; // 0.788  mount -> sensor (the real EF flange distance)
const SENSOR_Z = FRONT - FLANGE; // -0.296
const SW = 36 * MM; // 0.645  full-frame sensor width
const SH = 24 * MM; // 0.430  full-frame sensor height

const LENS_R = 37 * MM; // 0.663  barrel radius
const LENS_L = 72 * MM; // 1.290  barrel length
const LENS_TIP = FRONT + LENS_L; // 1.783

// Mirror: to bend light arriving from the lens (travelling -Z) upward, the
// reflecting face must point up AND forward — so the plate's high edge is at
// the REAR of the mirror box and its low edge sits just behind the lens mount.
// It hinges on that high rear edge and swings up to lie flat, pointing forward,
// under the focusing screen. (Tilt it the other way and the mirror throws the
// image at the floor.)
const HINGE_Y = AXIS_Y + SH / 2 + 0.03; // 1.087
const HINGE_Z = 0;
const MIRROR_L = 0.65; // slope length — covers the whole frame at 45°
const FOLD_Z = HINGE_Z + (HINGE_Y - AXIS_Y); // 0.245, where the axis meets the mirror

const SCREEN_Y = 1.135; // ground-glass focusing screen
const PRISM_Y = 1.16; // pentaprism entrance face
const PRISM_H = 0.72;
const PRISM_Z = 0.06; // prism centre in depth
const EYE_Y = 1.42; // eyepiece height on the back plate

// Iris: 9 blades, each a thin disc of radius IRIS_RD pivoting on a ring of
// radius IRIS_RP. Rotating a blade swings its centre nearer or further from
// the optical axis, and the hole left between the nine discs is bounded by
// nine circular arcs — which is exactly what a curved-blade iris looks like.
// The two angles are solved so the hole radius runs 0.022 (a pinhole) to 0.180
// (wide open — an 8:1 diameter range, three full stops) while no blade ever
// reaches past the barrel's inner wall. A fixed baffle sits IN FRONT of the
// blades and masks everything outside IRIS_RB, so the parts of each disc that
// swing wide never show.
const IRIS_Z = FRONT + 0.72;
const IRIS_RD = 0.2; // blade disc radius
const IRIS_RP = 0.28; // pivot circle radius
const IRIS_L = 0.13; // pivot -> blade centre
const IRIS_RB = 0.36; // baffle opening
const IRIS_PSI_OPEN = (47.6 * Math.PI) / 180;
const IRIS_PSI_SHUT = (129.2 * Math.PI) / 180;

// Shutter: two curtains of four slats each, travelling vertically in front of
// the sensor, behind an opaque frame that masks the stacked slats.
const FRAME_Z = SENSOR_Z + 0.078;
const C1_Z = SENSOR_Z + 0.058;
const C2_Z = SENSOR_Z + 0.038;
const SLAT_H = (SH / 4) * 1.3;

export function buildCamera({ scene }) {
  const root = new THREE.Group();
  scene.add(root);

  const PLINTH_H = 0.26;
  root.add(studioPlinth({ w: 3.7, h: PLINTH_H, d: 3.0 }));

  // Everything below is authored with y=0 at the plinth's top face.
  const rig = new THREE.Group();
  rig.position.y = PLINTH_H;
  root.add(rig);

  // --- materials -------------------------------------------------------------
  // The shell gets its OWN material instances so setReveal ghosts exactly these
  // and nothing else.
  const bodyMat = materials.polymer(0x191b1f);
  const gripMat = materials.rubber(0x111317);
  gripMat.normalMap = castNormalMap(); // the stipple that stops a grip reading as a slab
  gripMat.normalScale = new THREE.Vector2(0.5, 0.5);
  // A touch lighter than the body so the lens separates from it, and NOT
  // matted flat: at roughness ~0.9 a dark barrel loses every highlight and
  // disappears into the backdrop entirely.
  const barrelMat = materials.polymer(0x22262c);
  barrelMat.roughness = 0.68;
  barrelMat.side = THREE.DoubleSide; // the barrel is a real tube, open at the front
  const ringMat = materials.rubber(0x15171b);
  ringMat.side = THREE.DoubleSide; // the grip ribs are open bands, not discs
  const lcdMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b0d12,
    metalness: 0.1,
    roughness: 0.18,
    clearcoat: 0.8,
    clearcoatRoughness: 0.22,
    // Thumb smudges live in the COAT, not the base — same as on a real screen,
    // and a rear LCD that has never been touched is a giveaway that the scene
    // was born in a computer.
    clearcoatRoughnessMap: smudgeMap(),
  });
  const ghostable = [bodyMat, gripMat, barrelMat, ringMat, lcdMat];
  for (const m of ghostable) m.userData.coat = m.clearcoat ?? 0;

  // Rotation 0: on the bezel/mount cylinders U wraps the circumference, which
  // is the direction a lens ring is actually brushed.
  const trimMat = materials.anisoSteel(0xb4bbc3, 0);
  trimMat.roughness = 0.44; // the preset reads near-chrome on small curved parts
  const dialMat = materials.aluminum(0x8d939b);
  dialMat.roughness = 0.56;

  // The elements bend what is behind them for real. NOTE the transmission
  // backbuffer excludes transmissive objects, so the middle/rear elements do
  // not show through the front one — which is fine here, since what step 2
  // needs to see through the front element is the (opaque) iris.
  const glassMat = materials.opticalGlass({ thickness: 0.16 });

  const bladeMat = new THREE.MeshPhysicalMaterial({
    // Satin steel, not near-black. Once the front element became real
    // refractive glass the whole lens interior went dark, and dark blades
    // around a dark opening left the aperture with no edge at all — the one
    // thing this step exists to show. The copy calls them steel blades; this is
    // what steel blades photograph as.
    color: 0x79818d,
    metalness: 0.8,
    roughness: 0.42, // satin, not mirror — a mirror finish here clips at macro range
  });
  const linerMat = new THREE.MeshStandardMaterial({ color: 0x0a0b0e, roughness: 0.95 });
  const seamMat = new THREE.MeshPhysicalMaterial({ color: 0x0d0f13, metalness: 0.3, roughness: 0.7 });
  const ceramicMat = new THREE.MeshPhysicalMaterial({
    color: 0x2a2622, // the tan ceramic carrier a sensor die is actually bonded to
    metalness: 0.05,
    roughness: 0.62,
  });
  // The light path lives INSIDE the prism, so it is plain transparent glass,
  // never `transmission` — a transmission pass only samples opaque geometry and
  // the beam inside would vanish.
  const prismMat = new THREE.MeshPhysicalMaterial({
    color: 0xbcd6ff,
    metalness: 0,
    roughness: 0.06,
    transparent: true,
    opacity: 0.13,
    side: THREE.FrontSide, // one alpha layer — DoubleSide stacked into a white lump
    depthWrite: false,
  });
  const mirrorMat = new THREE.MeshPhysicalMaterial({
    color: 0xd2d8df,
    metalness: 1,
    roughness: 0.26, // a true 0.05 mirror throws the softbox straight down the lens
  });
  const screenMat = new THREE.MeshPhysicalMaterial({
    color: 0xdfe8f4,
    metalness: 0,
    roughness: 0.92,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const curtainMat = new THREE.MeshPhysicalMaterial({
    color: 0x555d6a, // metal-bladed shutters really do photograph this grey
    metalness: 0.6,
    roughness: 0.42,
  });
  const beamMat = () =>
    new THREE.MeshBasicMaterial({
      color: 0xffca87,
      transparent: true,
      opacity: 0,
      depthWrite: false, // a faded beam must never punch holes in the glass behind it
    });

  // --- groups ----------------------------------------------------------------
  const shell = new THREE.Group(); // ghosts on reveal
  const detail = new THREE.Group(); // cosmetic dress — hidden outright on reveal
  const trim = new THREE.Group(); // metal — hidden outright on reveal
  const optics = new THREE.Group(); // lens glass + iris (seen down the barrel)
  const guts = new THREE.Group(); // mirror box, prism, shutter, sensor
  const beams = new THREE.Group(); // the light path itself
  rig.add(shell, detail, trim, optics, guts, beams);

  const labels = calloutSets(['exterior', 'optics', 'internal', 'shutter', 'sensor']);
  // Callouts hang off empty anchors in rig space (or off a moving part's own
  // group) so a label's offset never has to be un-rotated by hand.
  const anchor = (parent, x, y, z) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };

  // --- body shell ------------------------------------------------------------
  const body = beveledBox(BW, BH, BD, bodyMat, 0.09);
  body.position.set(0, BH / 2, 0);
  body.receiveShadow = true;
  shell.add(body);

  // pentaprism hump: a front-view trapezoid extruded through the body depth
  {
    const s = new THREE.Shape();
    const pts = [
      [-0.52, BH - 0.1],
      [0.52, BH - 0.1],
      [0.44, BH + 0.19],
      [0.28, BH + HUMP],
      [-0.28, BH + HUMP],
      [-0.44, BH + 0.19],
    ];
    pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: 0.9,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    });
    geo.translate(0, 0, -0.42);
    const hump = new THREE.Mesh(geo, bodyMat);
    hump.castShadow = true;
    shell.add(hump);
    labels.add('exterior', anchor(shell, 0.12, BH + HUMP, 0.04), 'Pentaprism hump', [0, 0, 0], 70, 66);
  }

  // hand grip — bulging forward on the left of the body as you face the lens,
  // with the top plate carried out over it
  {
    const gripD = 0.52; // bulges forward of the mount plane, tucked into the slab
    const grip = beveledBox(0.5, 1.42, gripD, gripMat, 0.16);
    grip.position.set(-1.06, 0.82, GRIP_F - gripD / 2);
    shell.add(grip);
    const shoulder = beveledBox(0.62, 0.2, 0.62, bodyMat, 0.06);
    shoulder.position.set(-1.03, BH - 0.09, 0.42);
    shell.add(shoulder);
    labels.add('exterior', anchor(shell, -1.3, 0.7, GRIP_F - 0.1), 'Hand grip', [0, 0, 0], 208, 56);
  }

  // back plate: LCD in its bezel, button column, multi-controller, eyepiece cup
  {
    const bezel = beveledBox(1.54, 0.98, 0.02, linerMat, 0.014);
    bezel.position.set(0.12, 0.78, -BD / 2 - 0.006);
    shell.add(bezel);
    const lcd = beveledBox(1.42, 0.86, 0.03, lcdMat, 0.012);
    lcd.position.set(0.12, 0.78, -BD / 2 - 0.02);
    shell.add(lcd);

    // The finale turns the whole body, so the BACK has to hold up as a frame
    // too — a bare panel reads as an unfinished side of the model.
    const btnGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 20);
    for (const by of [0.44, 0.68, 0.92, 1.16]) {
      const b = new THREE.Mesh(btnGeo, dialMat);
      b.rotation.x = Math.PI / 2;
      b.position.set(1.08, by, -BD / 2 - 0.02);
      detail.add(b);
    }
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 28), dialMat);
    pad.rotation.x = Math.PI / 2;
    pad.position.set(-1.0, 0.86, -BD / 2 - 0.02);
    detail.add(pad);
    const nub = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), dialMat);
    nub.position.set(-1.0, 0.86, -BD / 2 - 0.05);
    detail.add(nub);
    const thumbRest = beveledBox(0.28, 0.46, 0.07, gripMat, 0.03);
    thumbRest.position.set(-1.21, 1.06, -BD / 2 - 0.03);
    shell.add(thumbRest);

    const cup = beveledBox(0.46, 0.32, 0.16, gripMat, 0.05);
    cup.position.set(0, EYE_Y, -BD / 2 - 0.07);
    shell.add(cup);
    const eyeGlass = beveledBox(0.3, 0.18, 0.02, linerMat, 0.01);
    eyeGlass.position.set(0, EYE_Y, -BD / 2 - 0.14);
    shell.add(eyeGlass);
    labels.add('internal', anchor(shell, 0, EYE_Y + 0.16, -BD / 2 - 0.12), 'Eyepiece', [0, 0, 0], 104, 74);

    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 28), dialMat);
    thumb.rotation.x = Math.PI / 2;
    thumb.position.set(-1.05, 1.3, -BD / 2 - 0.02);
    trim.add(thumb);
  }

  // top-plate furniture
  {
    const modeDial = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.1, 32), dialMat);
    modeDial.position.set(0.92, BH + 0.03, -0.08);
    modeDial.castShadow = true;
    trim.add(modeDial);
    const knurl = boltCircle(22, 0.245, 0.014, dialMat, 0.1);
    knurl.position.copy(modeDial.position);
    trim.add(knurl);

    const shutterBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.05, 26), dialMat);
    shutterBtn.position.set(-1.03, BH + 0.02, 0.5);
    trim.add(shutterBtn);
    labels.add('exterior', anchor(shell, -1.03, BH + 0.08, 0.5), 'Shutter button', [0, 0, 0], 118, 62);

    const frontDial = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 26), dialMat);
    frontDial.rotation.z = Math.PI / 2;
    frontDial.position.set(-1.03, BH - 0.1, 0.68);
    trim.add(frontDial);

    // hot shoe: a floor and two rails, on top of the hump
    const shoe = new THREE.Group();
    shoe.add(beveledBox(0.3, 0.02, 0.32, trimMat, 0.006));
    for (const sx of [-0.15, 0.15]) {
      const rail = beveledBox(0.04, 0.05, 0.32, trimMat, 0.01);
      rail.position.set(sx, 0.03, 0);
      shoe.add(rail);
    }
    shoe.position.set(0, BH + HUMP + 0.01, 0.0);
    trim.add(shoe);
  }

  // --- lens ------------------------------------------------------------------
  // The barrel is a REAL tube — outer wall, inner wall, and an annular front
  // face with a genuine hole in it, so light goes in through an opening rather
  // than through a disc. (Built from explicit cylinders rather than one lathed
  // profile: a lathe of the same closed profile rendered as nothing at all,
  // which left the lens elements floating in mid-air with no barrel around
  // them.)
  {
    const barrel = new THREE.Group();
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(LENS_R, LENS_R, LENS_L, 56, 1, true),
      barrelMat,
    );
    wall.castShadow = true;
    barrel.add(wall);
    const bore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, LENS_L - 0.02, 56, 1, true), // straight: the iris swings to r=0.58
      barrelMat,
    );
    barrel.add(bore);
    const face = new THREE.Mesh(new THREE.RingGeometry(0.6, LENS_R, 56), barrelMat);
    face.rotation.x = -Math.PI / 2; // the annulus caps the tube's +Y end
    face.position.y = LENS_L / 2;
    barrel.add(face);
    barrel.rotation.x = Math.PI / 2; // cylinder axis +Y -> the optical axis +Z
    barrel.position.set(0, AXIS_Y, FRONT + LENS_L / 2);
    shell.add(barrel);
    labels.add('exterior', anchor(shell, 0, AXIS_Y + LENS_R, FRONT + 1.1), 'Lens barrel', [0, 0, 0], 46, 66);

    // Grip bands are OPEN rings, never solid discs — a stack of discs would
    // wall off the barrel and you could not see the iris down it at all.
    const ribGeo = new THREE.CylinderGeometry(LENS_R + 0.022, LENS_R + 0.022, 0.024, 44, 1, true);
    const ribBand = (start, count) => {
      for (let i = 0; i < count; i++) {
        const rib = new THREE.Mesh(ribGeo, ringMat);
        rib.rotation.x = Math.PI / 2;
        rib.position.set(0, AXIS_Y, FRONT + start + i * 0.036);
        detail.add(rib);
      }
    };
    ribBand(0.24, 7);
    ribBand(0.72, 9);
    labels.add('exterior', anchor(shell, 0, AXIS_Y + LENS_R + 0.06, FRONT + 0.42), 'Focus ring', [0, 0, 0], 126, 62);

    const bezel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.668, 0.668, 0.05, 56, 1, true),
      trimMat,
    );
    bezel.rotation.x = Math.PI / 2;
    bezel.position.set(0, AXIS_Y, LENS_TIP - 0.025);
    trim.add(bezel);

    const mount = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 12, 48), trimMat);
    mount.position.set(0, AXIS_Y, FRONT + 0.01);
    trim.add(mount);

    // bayonet: three arc tabs behind the flange plus the four flange screws.
    // boltCircle lays its ring in XZ with the bolt axis +Y, so the group is
    // tipped a quarter turn to stand the ring up on the optical axis.
    for (let i = 0; i < 3; i++) {
      const tab = new THREE.Mesh(
        new THREE.TorusGeometry(0.465, 0.026, 6, 14, Math.PI / 3.4),
        trimMat,
      );
      tab.rotation.z = (i * TAU) / 3;
      tab.position.set(0, AXIS_Y, FRONT + 0.06);
      trim.add(tab);
    }
    const flangeScrews = boltCircle(4, 0.56, 0.026, trimMat, 0.02);
    flangeScrews.rotation.x = -Math.PI / 2;
    flangeScrews.position.set(0, AXIS_Y, FRONT + 0.03);
    trim.add(flangeScrews);

    // machined seams where the barrel sections meet, and the retaining ring
    // that actually holds the front element in
    for (const sz of [0.19, 1.06]) {
      const seam = new THREE.Mesh(new THREE.TorusGeometry(LENS_R, 0.009, 6, 64), seamMat);
      seam.position.set(0, AXIS_Y, FRONT + sz);
      detail.add(seam);
    }
    const retainer = new THREE.Mesh(new THREE.TorusGeometry(0.586, 0.013, 8, 64), seamMat);
    retainer.position.set(0, AXIS_Y, LENS_TIP - 0.1);
    detail.add(retainer);
    const index = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.02, 16),
      materials.glow(0xff5a3c, 0.6),
    );
    index.rotation.x = Math.PI / 2;
    index.position.set(0, AXIS_Y + 0.56, FRONT + 0.02);
    trim.add(index);
  }

  // lens elements — biconvex glass on the optical axis
  const lensElement = (radius, sag, z) => {
    const N = 14;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const r = (radius * i) / N;
      pts.push([r, sag * Math.sqrt(Math.max(0, 1 - (r / radius) ** 2))]);
    }
    for (let i = N; i >= 0; i--) {
      const r = (radius * i) / N;
      pts.push([r, -sag * Math.sqrt(Math.max(0, 1 - (r / radius) ** 2))]);
    }
    const m = lathe(pts, glassMat, 48);
    m.castShadow = false;
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, AXIS_Y, z);
    return m;
  };
  optics.add(
    lensElement(0.58, 0.11, LENS_TIP - 0.15),
    lensElement(0.46, 0.08, FRONT + 0.46),
    lensElement(0.34, 0.06, FRONT + 0.13),
  );
  labels.add('optics', anchor(optics, 0.24, AXIS_Y + 0.5, LENS_TIP - 0.12), 'Front element', [0, 0, 0], 132, 56);

  // --- iris ------------------------------------------------------------------
  const irisGroup = new THREE.Group();
  irisGroup.position.set(0, AXIS_Y, IRIS_Z);
  optics.add(irisGroup);
  const bladePivots = [];
  const BLADES = 9;
  for (let i = 0; i < BLADES; i++) {
    const a = (i / BLADES) * TAU;
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(a) * IRIS_RP, Math.sin(a) * IRIS_RP, i * 0.0022);
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(IRIS_RD, IRIS_RD, 0.005, 44), bladeMat);
    blade.rotation.x = Math.PI / 2;
    blade.position.x = IRIS_L;
    pivot.add(blade);
    pivot.userData.base = a;
    irisGroup.add(pivot);
    bladePivots.push(pivot);
  }
  {
    // The baffle sits in FRONT of the blades, so the part of each disc that
    // swings out past IRIS_RB is masked and never shows.
    const s = new THREE.Shape();
    s.absarc(0, 0, 0.6, 0, TAU, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, IRIS_RB, 0, TAU, true);
    s.holes.push(hole);
    const baffle = new THREE.Mesh(
      new THREE.ExtrudeGeometry(s, { depth: 0.016, bevelEnabled: false, curveSegments: 44 }),
      linerMat,
    );
    baffle.position.z = 0.03;
    irisGroup.add(baffle);
  }
  labels.add('optics', anchor(optics, 0.2, AXIS_Y - 0.22, IRIS_Z), 'Aperture blades', [0, 0, 0], -40, 66);

  // --- mirror box ------------------------------------------------------------
  const mirrorHinge = new THREE.Group();
  mirrorHinge.position.set(0, HINGE_Y, HINGE_Z);
  guts.add(mirrorHinge);
  {
    // authored lying flat FORWARD of the hinge, so rotation.x = 0 is MIRROR UP
    const carrier = beveledBox(0.76, 0.03, MIRROR_L + 0.06, linerMat, 0.01);
    carrier.position.set(0, -0.022, MIRROR_L / 2);
    mirrorHinge.add(carrier);
    const plate = beveledBox(0.7, 0.014, MIRROR_L, mirrorMat, 0.006);
    plate.position.z = MIRROR_L / 2;
    mirrorHinge.add(plate);
    // rides the mirror, so the label swings up with it. Two sets name it, and a
    // callout can only belong to one set, so it gets one in each.
    labels.add('internal', anchor(mirrorHinge, 0, 0.03, 0.24), 'Reflex mirror', [0, 0, 0], 132, 62);
    labels.add('shutter', anchor(mirrorHinge, 0, 0.03, 0.24), 'Reflex mirror', [0, 0, 0], 38, 58);
  }

  const screen = beveledBox(0.66, 0.014, 0.46, screenMat, 0.005);
  screen.position.set(0, SCREEN_Y, FOLD_Z);
  guts.add(screen);
  {
    // the frame the ground glass drops into — a bare plate reads as a floating
    // sheet at the step-3 camera distance
    const sh = new THREE.Shape();
    sh.moveTo(-0.37, -0.27);
    sh.lineTo(0.37, -0.27);
    sh.lineTo(0.37, 0.27);
    sh.lineTo(-0.37, 0.27);
    sh.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-0.32, -0.22);
    hole.lineTo(-0.32, 0.22);
    hole.lineTo(0.32, 0.22);
    hole.lineTo(0.32, -0.22);
    hole.closePath();
    sh.holes.push(hole);
    const bezel = new THREE.Mesh(
      new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 }),
      linerMat,
    );
    bezel.rotation.x = Math.PI / 2;
    bezel.position.set(0, SCREEN_Y + 0.012, FOLD_Z);
    guts.add(bezel);
  }
  labels.add('internal', anchor(guts, 0, SCREEN_Y + 0.02, FOLD_Z + 0.22), 'Focusing screen', [0, 0, 0], 146, 58);

  // --- pentaprism ------------------------------------------------------------
  // Side profile: flat entrance face at the bottom, vertical exit face at the
  // back, two roof faces on top. Light enters upward, folds twice, exits
  // backwards into the eyepiece.
  {
    const s = new THREE.Shape();
    const P = [
      [0.39, 0], // front-bottom
      [-0.39, 0], // rear-bottom
      [-0.39, 0.4], // rear-top — this edge is the exit face
      [-0.06, PRISM_H], // apex
      [0.39, 0.4], // front-top
    ];
    P.forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)));
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: 0.72,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 1,
    });
    // profile authored in (z, y); rotate so the extrusion depth becomes width
    geo.rotateY(-Math.PI / 2);
    const prism = new THREE.Mesh(geo, prismMat);
    prism.position.set(0.36, PRISM_Y, PRISM_Z);
    guts.add(prism);
    labels.add('internal', anchor(guts, 0.04, PRISM_Y + 0.52, PRISM_Z), 'Pentaprism', [0, 0, 0], 100, 64);
  }
  const pz = (z) => PRISM_Z + z; // prism-local depth -> world
  const py = (y) => PRISM_Y + y; // prism-local height -> world

  // --- shutter + sensor ------------------------------------------------------
  {
    const s = new THREE.Shape();
    s.moveTo(-0.47, -0.48);
    s.lineTo(0.47, -0.48);
    s.lineTo(0.47, 0.48);
    s.lineTo(-0.47, 0.48);
    s.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-SW / 2, -SH / 2);
    hole.lineTo(-SW / 2, SH / 2);
    hole.lineTo(SW / 2, SH / 2);
    hole.lineTo(SW / 2, -SH / 2);
    hole.closePath();
    s.holes.push(hole);
    const frame = new THREE.Mesh(
      new THREE.ExtrudeGeometry(s, { depth: 0.014, bevelEnabled: false }),
      new THREE.MeshPhysicalMaterial({ color: 0x2f343d, metalness: 0.8, roughness: 0.44 }),
    );
    frame.position.set(0, AXIS_Y, FRAME_Z);
    guts.add(frame);
    const screws = boltCircle(4, 0.42, 0.024, linerMat, 0.016);
    screws.rotation.x = -Math.PI / 2;
    screws.rotation.y = Math.PI / 4; // corners of the frame plate, not its edges
    screws.position.set(0, AXIS_Y, FRAME_Z + 0.02);
    guts.add(screws);
  }

  const SLATS = 4;
  const coverY = (i) => AXIS_Y + SH / 2 - (i + 0.5) * (SH / 4);
  const belowY = (i) => AXIS_Y - SH / 2 - 0.075 - i * 0.022;
  const aboveY = (i) => AXIS_Y + SH / 2 + 0.075 + i * 0.022;
  const makeCurtain = (z) => {
    const g = new THREE.Group();
    for (let i = 0; i < SLATS; i++) {
      const slat = beveledBox(0.7, SLAT_H, 0.006, curtainMat, 0.003);
      slat.position.set(0, 0, z + i * 0.004);
      g.add(slat);
    }
    guts.add(g);
    return g;
  };
  const curtain1 = makeCurtain(C1_Z);
  const curtain2 = makeCurtain(C2_Z);
  // slat 0 is the first curtain's trailing edge (the one uncovering the frame);
  // slat 3 is the second curtain's leading edge (the one covering it again)
  labels.add('shutter', anchor(curtain1.children[0], 0.34, 0.05, 0), 'First curtain', [0, 0, 0], -20, 66);
  labels.add('shutter', anchor(curtain2.children[3], 0.34, -0.05, 0), 'Second curtain', [0, 0, 0], 24, 66);

  const bayerTex = bayerTexture(24, 0.1);
  const sensorPlate = new THREE.Mesh(
    new THREE.BoxGeometry(SW, SH, 0.02),
    new THREE.MeshStandardMaterial({
      color: 0x11141c,
      roughness: 0.6,
      metalness: 0.1,
      map: bayerTex,
      emissive: 0xffffff,
      emissiveMap: bayerTex,
      emissiveIntensity: 0.22,
    }),
  );
  sensorPlate.position.set(0, AXIS_Y, SENSOR_Z);
  guts.add(sensorPlate);
  // the die sits on a ceramic carrier, which sits on the sensor board
  const carrier = beveledBox(SW + 0.09, SH + 0.09, 0.028, ceramicMat, 0.008);
  carrier.position.set(0, AXIS_Y, SENSOR_Z - 0.018);
  guts.add(carrier);
  const sensorBoard = beveledBox(0.94, 0.7, 0.03, linerMat, 0.01);
  sensorBoard.position.set(0, AXIS_Y, SENSOR_Z - 0.045);
  guts.add(sensorBoard);
  labels.add('shutter', anchor(guts, 0.34, AXIS_Y - 0.24, SENSOR_Z), 'Image sensor', [0, 0, 0], -32, 70);
  labels.add('sensor', anchor(guts, 0.1, AXIS_Y - 0.26, SENSOR_Z + 0.02), 'Photodiode wells', [0, 0, 0], -80, 58);

  // rolling readout bar — only alive while the wells are being emptied
  const readoutBar = new THREE.Mesh(
    new THREE.BoxGeometry(SW * 1.02, 0.016, 0.004),
    new THREE.MeshBasicMaterial({
      color: 0xffb45e,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  readoutBar.position.set(0, AXIS_Y, SENSOR_Z + 0.016);
  guts.add(readoutBar);

  // Magnified Bayer inset: real photosites are a few microns across, so the
  // mosaic is invisible at product-shot scale — this floats one 4x4 tile out
  // beside the body at a size you can actually read.
  const inset = new THREE.Group();
  inset.position.set(1.45, 1.5, 0.1);
  const insetPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.32),
    new THREE.MeshBasicMaterial({ map: bayerTexture(4, 0.14), transparent: true, opacity: 0.9 }),
  );
  inset.add(insetPlate);
  const insetFrame = new THREE.Mesh(
    new THREE.TorusGeometry(0.228, 0.004, 6, 4),
    new THREE.MeshBasicMaterial({ color: 0xffb45e, transparent: true, opacity: 0.5 }),
  );
  insetFrame.rotation.z = Math.PI / 4;
  inset.add(insetFrame);
  inset.visible = false;
  rig.add(inset);
  labels.add('sensor', anchor(inset, 0, 0.2, 0), 'Bayer filter', [0, 0, 0], 152, 50);

  // --- the light path --------------------------------------------------------
  const VIEW_NODES = [
    [0, AXIS_Y, LENS_TIP],
    [0, AXIS_Y, FOLD_Z], // 45° fold at the mirror
    [0, py(0), FOLD_Z], // up through the focusing screen into the prism
    [0, py(0.546), FOLD_Z], // first roof face
    [0, py(0.526), pz(-0.26)], // second roof face
    [0, py(0.26), pz(-0.39)], // exit face
    [0, EYE_Y, -BD / 2 - 0.18], // out of the eyepiece
  ];
  const SHOT_NODES = [
    [0, AXIS_Y, LENS_TIP],
    [0, AXIS_Y, SENSOR_Z],
  ];
  const BEAM_R = 0.06; // one radius the whole way — a stepped beam reads as a glitch

  const beamSeg = (a, b) => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(BEAM_R, BEAM_R, va.distanceTo(vb), 14, 1, true),
      beamMat(),
    );
    m.position.copy(va).lerp(vb, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    return m;
  };
  const viewBeams = new THREE.Group();
  const shotBeams = new THREE.Group();
  beams.add(viewBeams, shotBeams);
  for (let i = 0; i < VIEW_NODES.length - 1; i++) {
    viewBeams.add(beamSeg(VIEW_NODES[i], VIEW_NODES[i + 1]));
  }
  shotBeams.add(beamSeg(SHOT_NODES[0], SHOT_NODES[1]));

  const legs = (nodes) => nodes.slice(0, -1).map((n, i) => [n, nodes[i + 1]]);
  const viewPath = chainPath(legs(VIEW_NODES));
  const shotPath = chainPath(legs(SHOT_NODES));

  const photonGeo = new THREE.SphereGeometry(0.021, 10, 8);
  const makeDots = (n) => {
    const dots = [];
    for (let i = 0; i < n; i++) {
      const d = new THREE.Mesh(
        photonGeo,
        new THREE.MeshBasicMaterial({
          color: 0xffe9bd,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      beams.add(d);
      dots.push(d);
    }
    return dots;
  };
  const viewDots = makeDots(18);
  const shotDots = makeDots(9);

  // --- pose ------------------------------------------------------------------
  const state = {
    spin: 0,
    reveal: 0,
    iris: 0.55,
    cycle: 0,
    fast: 0,
    rays: 1,
    flow: 0,
    sense: 0,
    macro: 0,
  };

  function setPose() {
    rig.rotation.y = state.spin;

    // iris: all nine blades swing together; the hole they leave is bounded by
    // nine circular arcs
    const psi = IRIS_PSI_SHUT + (IRIS_PSI_OPEN - IRIS_PSI_SHUT) * clamp01(state.iris);
    for (const p of bladePivots) p.rotation.z = p.userData.base + psi;

    // --- one exposure --------------------------------------------------------
    const u = ((state.cycle % 1) + 1) % 1;
    const f = state.fast;
    const mUp = win(u, 0.08 - 0.06 * f, 0.2 - 0.1 * f) - win(u, 0.85 + 0.04 * f, 0.96 + 0.02 * f);
    const bump = (at, w) => Math.exp(-(((u - at) / w) ** 2));
    // a fraction of preload before it flies, then ~1° of rebound as it slams
    // into the up-stop — both dead within a few percent of the lap
    // gated off above sync: that timing puts mirror-up almost on the wrap, and
    // a Gaussian centred there would leave the lap start and end at different
    // poses — a visible seam
    const anticipate = 0.014 * (1 - f) * bump(0.05, 0.02);
    const rebound = 0.018 * bump(0.215 - 0.1 * f, 0.028);
    mirrorHinge.rotation.x = (Math.PI / 4) * (1 - mUp) + rebound + anticipate;

    // above flash sync the second curtain launches before the first has
    // finished, so the pair crosses the frame as a slit
    const travel = 0.1 + 0.44 * f; // how long a curtain takes to cross the frame
    const c1start = 0.24 - 0.1 * f;
    const c2start = 0.46 - 0.24 * f; // above sync the second curtain launches early
    const recock = win(u, 0.72 + 0.08 * f, 0.84 + 0.04 * f);
    const open1 = win(u, c1start, c1start + travel) - recock;
    const close2 = win(u, c2start, c2start + travel) - recock;
    // machined parts do not wobble — one small damped kick as each curtain
    // hits its brake, applied to the SLATS only so the exposure fraction below
    // stays monotonic
    const settle1 = 0.011 * bump(c1start + travel + 0.015, 0.016);
    const settle2 = 0.011 * bump(c2start + travel + 0.015, 0.016);
    for (let i = 0; i < SLATS; i++) {
      curtain1.children[i].position.y = coverY(i) + (belowY(i) - coverY(i)) * open1 + settle1;
      curtain2.children[i].position.y = aboveY(i) + (coverY(i) - aboveY(i)) * close2 + settle2;
    }
    const expo = clamp01(open1 - close2); // how much of the frame is actually open

    // --- sensor: wells fill, then the readout sweeps them empty ---------------
    const s = clamp01(state.sense);
    const charge = s < 0.7 ? s / 0.7 : 1 - (s - 0.7) / 0.3;
    const readT = clamp01((s - 0.7) / 0.3);
    sensorPlate.material.emissiveIntensity = 0.22 + Math.max(expo * 0.9, charge * 0.9);
    readoutBar.material.opacity = s > 0.7 ? 0.8 : 0;
    readoutBar.position.y = AXIS_Y + SH / 2 - SH * readT;
    insetPlate.material.opacity = 0.3 + 0.65 * Math.max(charge, 0.25);

    // --- beams ---------------------------------------------------------------
    const revealed = state.reveal > 0.5 && state.rays > 0.5;
    const viewOn = revealed ? 1 - mUp : 0;
    const shotOn = revealed ? expo : 0;
    for (const m of viewBeams.children) m.material.opacity = viewOn * 0.24;
    for (const m of shotBeams.children) m.material.opacity = shotOn * 0.24;

    const ride = (dots, path, on) => {
      dots.forEach((d, i) => {
        const t = (((state.flow + i / dots.length) % 1) + 1) % 1;
        d.position.copy(path.getPointAt(t));
        d.material.opacity = on * (0.45 + 0.55 * Math.sin(t * Math.PI));
      });
    };
    ride(viewDots, viewPath, viewOn);
    ride(shotDots, shotPath, shotOn);

    inset.visible = state.macro > 0.5;
  }

  function setReveal(t) {
    state.reveal = t;
    const ghost = t > 0.01;
    for (const m of ghostable) {
      m.transparent = ghost;
      m.opacity = 1 - 0.86 * t;
      m.depthWrite = !ghost;
      // clearcoat renders at FULL strength regardless of opacity — a ghosted
      // shell still reads solid unless the coat goes off with it
      m.clearcoat = ghost ? 0 : m.userData.coat;
    }
    shell.traverse((o) => {
      if (o.isMesh) o.castShadow = !ghost;
    });
    trim.visible = !ghost; // metal cannot be ghosted; hide it outright
    detail.visible = !ghost; // ghosted grip ribs read as pale corrugated tubes
    optics.visible = !ghost;
    guts.visible = ghost;
    beams.visible = ghost;
    setPose();
  }

  setReveal(0);

  return {
    group: rig,
    parts: { rig, mirror: mirrorHinge, curtain1, curtain2, iris: irisGroup, sensor: sensorPlate },
    setLabels: labels.setLabels,
    setReveal,
    setCycle: (c) => {
      state.cycle = c;
      setPose();
    },
    set(partial) {
      Object.assign(state, partial);
      setPose();
    },
  };
}

// RGGB colour-filter mosaic — 50% green, 25% red, 25% blue — drawn as discrete
// wells with a gutter so the grid reads as individual photosites.
function bayerTexture(cells, gutter) {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, S, S);
  const p = S / cells;
  const g = p * gutter;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const evenX = x % 2 === 0;
      const evenY = y % 2 === 0;
      ctx.fillStyle = evenY ? (evenX ? '#9c463c' : '#4b8a52') : evenX ? '#4b8a52' : '#3d5e96';
      ctx.fillRect(x * p + g, y * p + g, p - 2 * g, p - 2 * g);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}
