import * as THREE from 'three';
import { materials, studioPlinth } from '../../framework/parts.js';
import { beveledBox, lathe, tubeAlong, coil, chainPath } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { smudgeMap } from '../../framework/textures.js';
import { clamp01, smooth, TAU } from '../../framework/motion.js';

// A modern flagship phone camera, presented at TWO deliberate scales:
//
//   PHONE SCALE  — the whole handset, back up, at true proportions. The sealed
//                  product (step 1) and the opened back (step 2).
//   MODULE SCALE — ONE camera module on its own, enlarged roughly five times,
//                  standing on the same plinth. Every mechanism step lives
//                  here, because a real module is 11 mm square and nothing
//                  inside it is legible at handset scale.
//
// The swap is snapped in each step's onEnter and covered by the camera flight,
// and the copy says out loud that the module has been enlarged.
//
// MECHANISM (researched):
//  - THREE CAMERAS. Ultrawide, main, and a telephoto lying on its side. Each
//    is a complete instrument: lens stack, actuator, sensor, flex cable.
//  - AUTOFOCUS is a VOICE-COIL MOTOR. The lens barrel sits in a carrier wound
//    with a copper coil, parked in the field of magnets fixed to the shield
//    can. Current through the coil produces a Lorentz force along the optical
//    axis (F = BIL) — the same force that drives a loudspeaker cone, hence the
//    name. Two leaf springs return it. Stroke is a few hundred microns.
//  - THE APERTURE DOES NOT MOVE on almost every phone: it is a fixed opaque
//    annulus moulded into the lens stack, typically around f/1.6. Exposure is
//    controlled by integration time and gain instead. The exceptions are real
//    but rare — Samsung's Galaxy S9 stepped between f/1.5 and f/2.4, and the
//    Xiaomi 14 Ultra fits a continuously variable six-blade iris running
//    f/1.63 to f/4.0.
//  - OIS corrects ROTATION, not translation: for a distant subject, sliding
//    the camera sideways does not move the image at all, but rotating it by an
//    angle t moves the image by f*t. A gyroscope samples that rotation at
//    roughly 1 kHz; coils in the base shove the whole AF block sideways on
//    four suspension wires by just enough to put the image back. Apple's
//    sensor-shift variant moves the sensor instead, up to ~5000 times a second.
//  - PERISCOPE TELEPHOTO. A prism cut at 45 degrees folds the light through a
//    right angle so the barrel can lie ALONG the phone instead of poking out of
//    it, which is the only way to get a long focal length into a flat body.
//  - SENSOR. Back-side-illuminated, stacked: a pixel die hybrid-bonded on top
//    of a logic die. Top down, each pixel is a microlens, a colour filter in a
//    Quad-Bayer mosaic (2x2 same-colour blocks, so four small pixels can be
//    binned into one big sensitive one), then the photodiode.
//
// PROPORTIONS. PMM is the ONE phone-scale constant (world units per real
// millimetre), derived from a 149.6 x 71.5 x 8.25 mm handset, so every phone
// dimension below is the real part at its real size and the ratios hold by
// construction. The module scale is authored separately and independently —
// mixing them would silently re-introduce the very illegibility the two-scale
// staging exists to solve.
//
// STATE the pose is built from (one scalar object, one pose function):
//   spin     presentation turntable angle (rad)
//   open     0 phone sealed / 1 back glass turned to glass, guts showing
//   macro    0 phone on stage / 1 the enlarged module on stage
//   which    0 the upright main module / 1 the folded periscope module
//   subj     0 subject at infinity / 1 subject close up
//   af       0 lens racked in / 1 lens racked out (sharp when af === subj)
//   iris     0 stopped down to f/4 / 1 wide open at f/1.63 (variable-iris only)
//   varia    0 the fixed moulded stop / 1 the rare six-blade iris
//   shake    -1..1 angular hand shake (rad = shake * SHAKE_MAX)
//   correct  0 stabiliser off / 1 stabiliser holding the image still
//   zoom     0..1 periscope zoom group travel
//   burst    0..1 the frame stack collapsing into one photograph
//   bare     0 whole module / 1 the sensor alone, actuator lifted off
//   explode  0..1 sensor layer separation
//   sense    0..1 sensor charge-then-readout phase
//   flow     0..1 photon phase along the folded path, whole laps per lap
//   rays     0/1 draw the light path
//   inset    0/1 the magnified colour-mosaic tile

// --- phone scale -------------------------------------------------------------
const PL = 4.4; // phone length — the ONE phone-scale constant
const PMM = PL / 149.6; // 0.02941 world units per real millimetre
const PW = 71.5 * PMM; // 2.103  phone width
const PT = 8.25 * PMM; // 0.2426 phone thickness
const PR = 11.5 * PMM; // 0.338  body corner radius

const ISL = 37 * PMM; // 1.088  camera island side
const ISL_H = 1.7 * PMM; // 0.050  island plateau above the back glass
const ISL_R = 11 * PMM; // 0.323  island corner radius
const ISL_Z = -PL / 2 + 30 * PMM; // island centre, 30 mm down from the top edge
const ISL_X = -PW / 2 + 24 * PMM; // ...and 24 mm in from the left edge

const RING_R = 7.25 * PMM; // 0.213  lens ring outer radius
const RING_H = 2.6 * PMM; // 0.076  ring protrusion above the island
const COVER_R = 4.3 * PMM; // 0.126  cover-glass radius
const LENS_OFF = 8.6 * PMM; // 0.253  lens spacing from the island centre

const BACK_Y = PT; // the back glass surface (phone lies face down)
const ISL_TOP = BACK_Y + ISL_H;

// --- module scale (authored independently — see the note above) --------------
const SUB_T = 0.1; // substrate thickness
const CAN_W = 1.66; // shield-can footprint
const CAN_TOP = 1.62; // top rim of the can
const SENSOR_Y = 0.28; // the photodiode plane
const SEN_W = 0.72; // sensor die width
const STOP_Y = 1.3; // the aperture stop plane
const BARREL_R = 0.4; // lens barrel outer radius
const AF_TRAVEL = 0.17; // voice-coil stroke (exaggerated — see step 3's hint)
const AP_WIDE = 0.168; // the fixed moulded stop's radius (f/1.6)
const SPRING_LO = 0.62;
const SPRING_HI = 1.36;
const SUBJ_Y = 2.5; // where the "subject" sits above the module
const SUBJ_NEAR = 0.85; // ...and how far it drops when it comes close
const SHAKE_MAX = 0.09; // peak hand-shake rotation (rad, ~5 degrees)

// Every module-scale camera sits at roughly 40 degrees of azimuth (+X/+Z), so
// the near half of each tube is omitted and the far half kept. CylinderGeometry
// measures theta from +Z toward +X, so the surviving half runs from 90 degrees
// past the camera to 270 past it.
const CUT_START = ((40 + 90) * Math.PI) / 180;
// RingGeometry lays out in XY and is then tipped into XZ, which costs it a
// quarter turn relative to the cylinder convention above.
const CUT_RING_START = CUT_START - Math.PI / 2;

// --- periscope module --------------------------------------------------------
const PER_AXIS = 0.46; // the folded optical axis height
const PER_FOLD = -0.92; // where the light turns the corner
const PER_SENSOR = 1.16; // the sensor stands at the far end

export function buildSmartphoneCamera({ scene }) {
  const root = new THREE.Group();
  scene.add(root);

  const PLINTH_H = 0.26;
  root.add(studioPlinth({ w: 5.1, h: PLINTH_H, d: 3.1 }));

  // Everything below is authored with y=0 at the plinth's top face.
  const rig = new THREE.Group();
  rig.position.y = PLINTH_H;
  root.add(rig);

  // --- materials -------------------------------------------------------------
  // The phone's outer skin gets its OWN instances so `open` ghosts exactly
  // these and nothing else.
  const backMat = new THREE.MeshPhysicalMaterial({
    color: 0x1b1f2b, // the deep blue-black a "midnight" glass back photographs as
    metalness: 0.15,
    // A glass back is glossy, but not a mirror: at clearcoat 0.9 / roughness
    // 0.18 the key light came back as a blown-white streak across the panel
    // (251 clipped px on the hero shot). A wider, softer highlight is also what
    // a real glass back photographs as under a softbox.
    roughness: 0.4,
    clearcoat: 0.22,
    clearcoatRoughness: 0.45,
    // A back panel that has never been held is a giveaway that the scene was
    // born in a computer — the smudges live in the COAT, like on real glass.
    clearcoatRoughnessMap: smudgeMap(),
  });
  // The presets read near-chrome on small curved parts, and a polished rim
  // right under the key light is the other half of the clipping on the wide
  // shots — raising roughness widens the highlight instead of clipping it.
  const frameMat = materials.anisoSteel(0x9aa2ac, 0);
  frameMat.roughness = 0.62;
  const ringMat = materials.aluminum(0x8b929c);
  ringMat.roughness = 0.62;
  const ghostable = [backMat];
  for (const m of ghostable) m.userData.coat = m.clearcoat ?? 0;

  // Real refractive glass for the three eyes on the back — nothing transparent
  // sits behind them, so the transmission pass has everything it needs, and the
  // blue-violet AR bloom is the single most recognisable thing about a phone
  // camera seen from outside.
  const coverMat = materials.opticalGlass({ thickness: 0.06, coating: 0.42 });

  // Map-free on purpose. The brushedSteel preset's roughness/normal maps tile
  // across a large flat shield wall as harsh horizontal banding, and at
  // metalness 1 / roughness 0.5 a wall this size reads as a white slab that
  // swallows the whole module. A real shield can is dull stamped nickel-steel.
  const canMat = new THREE.MeshPhysicalMaterial({
    color: 0x4b515b,
    metalness: 0.85,
    roughness: 0.62,
    side: THREE.DoubleSide, // a cutaway wall is seen from both faces
  });
  const barrelMat = materials.polymer(0x1d2027);
  barrelMat.side = THREE.DoubleSide; // the barrel is a real open tube
  const linerMat = new THREE.MeshStandardMaterial({ color: 0x080a0d, roughness: 0.95 });
  const pcbMat = new THREE.MeshPhysicalMaterial({
    color: 0x123024,
    metalness: 0.05,
    roughness: 0.72,
  });
  const flexMat = new THREE.MeshPhysicalMaterial({
    color: 0x6a4a1c, // polyimide flex is that unmistakable amber
    metalness: 0.1,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  // Rotation PI/2 puts the anisotropic stretch along the wire's length, which
  // is the direction a wound coil is actually drawn. Dimmer than the preset:
  // a bright coil wrapped around the middle of the module out-shouted the lens
  // stack in every macro frame.
  const copperMat = materials.anisoSteel(0xa1703a, Math.PI / 2);
  copperMat.roughness = 0.52;
  const magnetMat = new THREE.MeshPhysicalMaterial({
    color: 0x2a2d34,
    metalness: 0.9,
    roughness: 0.44,
  });
  const springMat = materials.brushedSteel(0xb9a37e); // phosphor bronze
  springMat.roughness = 0.4;
  // Deliberately duller than chrome: four polished wires standing the full
  // height of the module read as scaffolding poles and pull the eye off the
  // mechanism they are holding up.
  const wireMat = new THREE.MeshPhysicalMaterial({
    color: 0x8a9099,
    metalness: 1,
    roughness: 0.5,
  });
  const chipMat = new THREE.MeshPhysicalMaterial({
    color: 0x14161b,
    metalness: 0.2,
    roughness: 0.55,
  });
  const ceramicMat = new THREE.MeshPhysicalMaterial({
    color: 0x2a2622,
    metalness: 0.05,
    roughness: 0.62,
  });
  const logicMat = new THREE.MeshPhysicalMaterial({
    color: 0x3a3f4b, // the logic wafer under the pixel die reads as bare silicon
    metalness: 0.55,
    roughness: 0.38,
  });
  // Map-free: the aluminum preset's cast roughness/normal maps tile across a
  // slab this large as coarse glitter, and a battery pouch is a smooth
  // laminated foil, not a sandcasting.
  const battMat = new THREE.MeshPhysicalMaterial({
    color: 0x7c838f,
    metalness: 0.8,
    roughness: 0.55,
  });

  // The light path is drawn INSIDE these elements, so they are plain
  // transparent glass, never `transmission` — a transmission pass only samples
  // opaque geometry and every ray inside would vanish.
  const elemMat = new THREE.MeshPhysicalMaterial({
    color: 0xc3d8ff,
    metalness: 0,
    roughness: 0.05,
    // Six of these stack up the barrel, and alpha compounds — at 0.24 each the
    // stack turned into an opaque milky column.
    transparent: true,
    opacity: 0.17,
    side: THREE.FrontSide, // one alpha layer — DoubleSide stacks into a pale lump
    depthWrite: false,
  });
  const prismMat = new THREE.MeshPhysicalMaterial({
    color: 0xbcd6ff,
    metalness: 0,
    roughness: 0.05,
    transparent: true,
    // The prism is the whole point of the periscope step, and at 0.17 it was
    // barely there — but it still has to stay see-through, because the folded
    // beam is drawn INSIDE it.
    opacity: 0.3,
    side: THREE.FrontSide, // one alpha layer — DoubleSide stacks into a pale lump
    depthWrite: false,
  });
  const irFilterMat = new THREE.MeshPhysicalMaterial({
    color: 0x4fd6c0, // the green-cyan cast of a real IR-cut filter
    metalness: 0,
    roughness: 0.08,
    transparent: true,
    opacity: 0.2, // a tint over the sensor, not a green shelf across the module
    depthWrite: false,
  });
  const stopMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b0d11,
    metalness: 0.1,
    roughness: 0.88,
  });
  const bladeMat = new THREE.MeshPhysicalMaterial({
    // Darker than the lens elements it sits directly above. At the same pale
    // value the six blades read as six more pieces of glass and the diaphragm
    // vanished into the stack — but not near-black either, or the hole loses
    // its edge, which is the one thing the step exists to show.
    color: 0x454c57,
    metalness: 0.92,
    roughness: 0.34,
  });
  const beamMat = () =>
    new THREE.MeshBasicMaterial({
      color: 0xffe2ad,
      transparent: true,
      opacity: 0,
      depthWrite: false, // a faded beam must never punch holes in the glass behind it
    });
  // Accent, NOT the beam's amber. Where the image lands has to stay readable
  // even when it is pinned dead-centre on the cone's own apex — in warm tan it
  // merged into the beam exactly in the stabiliser-ON half, so the payoff read
  // as "the dot vanished" rather than "the dot locked on".
  const spotMat = new THREE.MeshBasicMaterial({
    color: 0x7f9cff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  // --- groups ----------------------------------------------------------------
  const phone = new THREE.Group(); // phone scale
  const phoneShell = new THREE.Group(); // ghosts on `open`
  const phoneTrim = new THREE.Group(); // metal — hidden outright on `open`
  const phoneOptics = new THREE.Group(); // the three cover glasses
  const phoneGuts = new THREE.Group(); // what the back glass hides
  phone.add(phoneShell, phoneTrim, phoneOptics, phoneGuts);
  const macroMain = new THREE.Group(); // module scale — the upright main camera
  const macroPeri = new THREE.Group(); // module scale — the folded telephoto
  rig.add(phone, macroMain, macroPeri);

  // NB: the six-blade iris gets a set of its own rather than sharing 'stop'.
  // CSS2DRenderer tests only a callout's OWN `visible` flag, never its
  // ancestors' — so a label parented to the hidden iris group would still be
  // painted over the fixed stop if the two shared a set.
  const labels = calloutSets([
    'exterior',
    'inside',
    'af',
    'stop',
    'iris',
    'ois',
    'peri',
    'sensor',
  ]);
  // Callouts hang off empty anchors (or off a moving part's own group) so an
  // offset never has to be un-rotated by hand.
  const anchor = (parent, x, y, z) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };

  // ===========================================================================
  //  PHONE SCALE
  // ===========================================================================

  const backGlass = roundedSlab(PW, PL, PT, PR, backMat);
  backGlass.receiveShadow = true;
  phoneShell.add(backGlass);

  // the polished mid-frame band around the rim
  {
    const band = roundedSlab(PW + 0.012, PL + 0.012, PT * 0.42, PR, frameMat);
    band.position.y = PT * 0.29;
    phoneTrim.add(band);
  }

  // camera island — the same glass block, raised, with a machined rim
  {
    const island = roundedSlab(ISL, ISL, ISL_H, ISL_R, backMat);
    island.position.set(ISL_X, BACK_Y, ISL_Z);
    phoneShell.add(island);
  }

  // The three eyes. Each is a machined ring, a dark bore, and a cover glass —
  // the bore is a REAL hole, never a disc, so the barrel below is genuinely
  // visible down it.
  // Leader directions all aim rightward or straight up. The text panel owns the
  // left ~38% of the viewport, and three lenses this close together fan their
  // labels into it the moment any of them points left.
  const LENSES = [
    { key: 'Ultrawide', dx: -LENS_OFF, dz: -LENS_OFF, r: 1.0, dir: 100, len: 66 },
    { key: 'Main camera', dx: -LENS_OFF, dz: LENS_OFF, r: 1.06, dir: -62, len: 74 },
    { key: 'Periscope telephoto', dx: LENS_OFF, dz: LENS_OFF, r: 1.0, dir: 16, len: 88 },
  ];
  const lensGlints = [];
  for (const L of LENSES) {
    const x = ISL_X + L.dx;
    const z = ISL_Z + L.dz;
    const rr = RING_R * L.r;

    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(rr, rr * 1.02, RING_H, 40, 1, true),
      ringMat,
    );
    ring.position.set(x, ISL_TOP + RING_H / 2, z);
    phoneTrim.add(ring);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.008, 8, 44), ringMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, ISL_TOP + RING_H, z);
    phoneTrim.add(rim);

    // the dark surround between the rim and the glass, with a genuine opening
    const surround = new THREE.Mesh(
      new THREE.RingGeometry(COVER_R * L.r, rr, 40),
      linerMat,
    );
    surround.rotation.x = -Math.PI / 2;
    surround.position.set(x, ISL_TOP + RING_H - 0.004, z);
    phoneShell.add(surround);
    const well = new THREE.Mesh(
      new THREE.CylinderGeometry(COVER_R * L.r, COVER_R * L.r, ISL_H + RING_H, 32, 1, true),
      linerMat,
    );
    well.position.set(x, ISL_TOP + RING_H - (ISL_H + RING_H) / 2, z);
    phoneShell.add(well);

    const cover = new THREE.Mesh(
      new THREE.CylinderGeometry(COVER_R * L.r, COVER_R * L.r, 0.014, 36),
      coverMat,
    );
    cover.position.set(x, ISL_TOP + RING_H - 0.014, z);
    phoneOptics.add(cover);

    // the faint ring of light down each bore, so the finale reads as a camera
    // that is actually looking at something
    const glintMat = new THREE.MeshBasicMaterial({
      color: 0x9fc0ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const glint = new THREE.Mesh(
      new THREE.CircleGeometry(COVER_R * L.r * 0.62, 28),
      glintMat,
    );
    glint.rotation.x = -Math.PI / 2;
    glint.position.set(x, ISL_TOP + RING_H - 0.05, z);
    phoneShell.add(glint);
    lensGlints.push(glintMat);

    labels.add('exterior', anchor(phoneShell, x, ISL_TOP + RING_H, z), L.key, [0, 0, 0], L.dir, L.len);
  }

  // flash and microphone, top-right of the island
  {
    const fx = ISL_X + LENS_OFF;
    const fz = ISL_Z - LENS_OFF;
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.008, 8, 28), ringMat);
    bezel.rotation.x = Math.PI / 2;
    bezel.position.set(fx, ISL_TOP + 0.004, fz);
    phoneTrim.add(bezel);
    const flash = new THREE.Mesh(
      new THREE.CylinderGeometry(0.056, 0.056, 0.01, 28),
      new THREE.MeshPhysicalMaterial({
        color: 0xd8cbb0,
        metalness: 0,
        roughness: 0.45,
        emissive: 0xffe4b0,
        emissiveIntensity: 0.05, // a dark flash: this one is not firing
      }),
    );
    flash.position.set(fx, ISL_TOP + 0.004, fz);
    phoneShell.add(flash);
    labels.add('exterior', anchor(phoneShell, fx, ISL_TOP + 0.02, fz), 'LED flash', [0, 0, 0], 58, 62);

    const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 14), linerMat);
    mic.position.set(fx + 0.02, ISL_TOP, fz + LENS_OFF * 1.05);
    phoneShell.add(mic);
  }

  // --- what the back glass hides ---------------------------------------------
  // Everything here is the real part at its real size: a main module 11 mm
  // square and 6 mm tall, a periscope 25 mm long lying on its side, a logic
  // board, and a battery filling the rest.
  {
    const modH = 6 * PMM;
    const modW = 11 * PMM;
    const gutY = BACK_Y - modH;

    // the three modules, sitting under their own lenses
    const miniModule = (x, z, w, h) => {
      const can = beveledBox(w, h, w, canMat, 0.006);
      can.position.set(x, BACK_Y - h / 2, z);
      phoneGuts.add(can);
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(w * 0.31, w * 0.31, h * 0.5, 20),
        barrelMat,
      );
      bar.position.set(x, BACK_Y - h * 0.25, z);
      phoneGuts.add(bar);
      return can;
    };
    miniModule(ISL_X - LENS_OFF, ISL_Z - LENS_OFF, modW * 0.86, modH * 0.72); // ultrawide
    const mainCan = miniModule(ISL_X - LENS_OFF, ISL_Z + LENS_OFF, modW, modH); // main
    labels.add(
      'inside',
      anchor(phoneGuts, ISL_X - LENS_OFF, BACK_Y - modH, ISL_Z + LENS_OFF),
      'Main camera module',
      [0, 0, 0],
      // Aims right. At 212 the leader pushed the pill up-left off an anchor
      // that already sits near frame centre, and the text box landed under the
      // panel — the projected ANCHOR stayed clear, which is why verify.mjs's
      // label gate passed it and only eyes caught it.
      6,
      96,
    );

    // the periscope lies ALONG the phone — 25 mm of barrel in an 8 mm body
    const perL = 25 * PMM;
    const perH = 7.4 * PMM;
    const perW = 10 * PMM;
    const perX = ISL_X + LENS_OFF;
    const perZ = ISL_Z + LENS_OFF;
    const perBody = beveledBox(perW, perH, perL, canMat, 0.006);
    perBody.position.set(perX, BACK_Y - perH / 2, perZ + perL / 2 - perW * 0.5);
    phoneGuts.add(perBody);
    labels.add(
      'inside',
      anchor(phoneGuts, perX, BACK_Y - perH, perZ + perL * 0.7),
      'Periscope module',
      [0, 0, 0],
      -22,
      86,
    );

    // logic board down the right-hand side, dressed with packages
    const board = beveledBox(PW * 0.34, 0.02, PL * 0.3, pcbMat, 0.006);
    board.position.set(PW * 0.24, gutY + 0.01, ISL_Z + PL * 0.2);
    phoneGuts.add(board);
    for (const [cx, cz, cw, cd] of [
      [0.1, -0.28, 0.24, 0.24],
      [-0.12, 0.12, 0.16, 0.2],
      [0.12, 0.3, 0.12, 0.12],
    ]) {
      const chip = beveledBox(cw, 0.03, cd, chipMat, 0.005);
      chip.position.set(PW * 0.24 + cx, gutY + 0.035, ISL_Z + PL * 0.2 + cz);
      phoneGuts.add(chip);
    }
    labels.add(
      'inside',
      anchor(phoneGuts, PW * 0.24, gutY + 0.05, ISL_Z + PL * 0.2 - 0.28),
      'Logic board',
      [0, 0, 0],
      28,
      70,
    );

    // the gyroscope that the stabiliser actually listens to
    const gyro = beveledBox(0.075, 0.028, 0.075, chipMat, 0.006);
    gyro.position.set(PW * 0.24 - 0.12, gutY + 0.034, ISL_Z + PL * 0.2 + 0.12);
    phoneGuts.add(gyro);
    labels.add(
      'inside',
      anchor(phoneGuts, PW * 0.24 - 0.12, gutY + 0.05, ISL_Z + PL * 0.2 + 0.12),
      'Gyroscope',
      [0, 0, 0],
      -46,
      64,
    );

    // battery — the thing everything else has to fit around
    const batt = roundedSlab(PW * 0.72, PL * 0.44, PT * 0.62, 0.06, battMat);
    batt.position.set(-PW * 0.08, PT * 0.1, PL * 0.2);
    phoneGuts.add(batt);
    labels.add(
      'inside',
      anchor(phoneGuts, -PW * 0.08, PT * 0.72, PL * 0.34),
      'Battery',
      [0, 0, 0],
      244,
      66,
    );
  }

  // --- the burst stack (the finale's computational beat) ----------------------
  // Five faint frames hanging above the island that slide together into one.
  const burstFrames = [];
  {
    const g = new THREE.Group();
    g.position.set(ISL_X + 0.1, ISL_TOP + 0.5, ISL_Z);
    phone.add(g);
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(0.78, 0.56),
        new THREE.MeshBasicMaterial({
          color: 0x9fc0ff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      m.rotation.x = -Math.PI / 2.6;
      g.add(m);
      burstFrames.push(m);
    }
  }

  // ===========================================================================
  //  MODULE SCALE — the upright main camera, enlarged
  // ===========================================================================

  // Everything that shakes hangs off `shakeRig`, so a hand tremor rotates the
  // whole module about its base and nothing else in the scene moves with it.
  const shakeRig = new THREE.Group();
  macroMain.add(shakeRig);

  // Everything stacked ABOVE the sensor — can, suspension, actuator, lens.
  // The sensor step lifts its own layers apart, and with the actuator still
  // standing over them the exploded stack drove straight up into the lens
  // barrel; `bare` takes the whole upper module off so the chip can be read on
  // its own.
  const upper = new THREE.Group();
  shakeRig.add(upper);

  // --- substrate + flex --------------------------------------------------------
  {
    const sub = beveledBox(2.0, SUB_T, 1.8, pcbMat, 0.012);
    sub.position.y = SUB_T / 2;
    sub.receiveShadow = true;
    shakeRig.add(sub);

    // the flex cable trailing off the back, with its board-to-board connector
    const tail = tubeAlong(
      [
        [0, SUB_T, -0.86],
        [0, SUB_T + 0.04, -1.2],
        [0.1, SUB_T + 0.02, -1.5],
      ],
      0.16,
      flexMat,
      { radialSegments: 4, tubularSegments: 24 },
    );
    tail.scale.y = 0.16; // a tube flattened into a ribbon reads as real flex
    shakeRig.add(tail);
    const conn = beveledBox(0.34, 0.07, 0.16, chipMat, 0.01);
    conn.position.set(0.1, SUB_T + 0.04, -1.5);
    shakeRig.add(conn);

    // The OIS gyro, on the module's own substrate. Deliberately on the +X /-Z
    // corner: at the step-5 camera that is the near-right of frame, and the
    // step's other two callouts sit left of it. Parked on the far corner it
    // projected clean off the left edge, under the text panel.
    const gy = beveledBox(0.2, 0.075, 0.2, chipMat, 0.01);
    gy.position.set(0.8, SUB_T + 0.037, -0.62);
    upper.add(gy);
    const gyDot = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.006, 12), linerMat);
    gyDot.position.set(0.74, SUB_T + 0.078, -0.68);
    upper.add(gyDot);
    labels.add('ois', anchor(shakeRig, 0.8, SUB_T + 0.09, -0.62), 'Gyroscope', [0, 0, 0], -34, 76);
  }

  // --- sensor stack ------------------------------------------------------------
  // Authored as separate layers so `explode` can lift them apart: microlenses,
  // colour filter, photodiodes, then the logic die hybrid-bonded underneath.
  const sensorStack = new THREE.Group();
  shakeRig.add(sensorStack);
  const quadTex = bayerTexture(16, 0.09, true);

  const logicDie = beveledBox(0.92, 0.07, 0.92, logicMat, 0.008);
  logicDie.position.y = SENSOR_Y - 0.13;
  sensorStack.add(logicDie);
  labels.add('sensor', anchor(logicDie, 0.4, 0, 0.2), 'Logic die', [0, 0, 0], -34, 76);

  const carrier = beveledBox(1.02, 0.05, 1.02, ceramicMat, 0.008);
  carrier.position.y = SENSOR_Y - 0.06;
  sensorStack.add(carrier);

  const photodiodes = new THREE.Mesh(
    new THREE.BoxGeometry(SEN_W, 0.035, SEN_W),
    new THREE.MeshStandardMaterial({ color: 0x161a24, roughness: 0.55, metalness: 0.2 }),
  );
  photodiodes.position.y = SENSOR_Y - 0.02;
  sensorStack.add(photodiodes);
  labels.add('sensor', anchor(photodiodes, 0.34, 0, -0.2), 'Photodiodes', [0, 0, 0], 22, 78);

  const colourFilter = new THREE.Mesh(
    new THREE.BoxGeometry(SEN_W, 0.012, SEN_W),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
      metalness: 0.05,
      map: quadTex,
      emissive: 0xffffff,
      emissiveMap: quadTex,
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 1,
      depthWrite: true,
    }),
  );
  colourFilter.position.y = SENSOR_Y;
  sensorStack.add(colourFilter);
  labels.add('sensor', anchor(colourFilter, 0.34, 0, 0.16), 'Quad-Bayer filter', [0, 0, 0], 30, 88);

  // microlens array — one instanced hemisphere per photosite
  const MICRO_N = 16;
  const microlenses = new THREE.InstancedMesh(
    new THREE.SphereGeometry(SEN_W / MICRO_N / 2, 8, 5, 0, TAU, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({
      color: 0xdce8ff,
      metalness: 0,
      roughness: 0.08,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
    MICRO_N * MICRO_N,
  );
  {
    const m = new THREE.Matrix4();
    const p = SEN_W / MICRO_N;
    for (let iy = 0; iy < MICRO_N; iy++) {
      for (let ix = 0; ix < MICRO_N; ix++) {
        m.makeTranslation(
          -SEN_W / 2 + (ix + 0.5) * p,
          0,
          -SEN_W / 2 + (iy + 0.5) * p,
        );
        microlenses.setMatrixAt(iy * MICRO_N + ix, m);
      }
    }
    microlenses.instanceMatrix.needsUpdate = true;
  }
  microlenses.position.y = SENSOR_Y + 0.012;
  sensorStack.add(microlenses);
  labels.add('sensor', anchor(microlenses, 0.3, 0.02, -0.3), 'Microlens array', [0, 0, 0], 66, 82);
  labels.add('af', anchor(sensorStack, 0.42, SENSOR_Y, 0.22), 'Image sensor', [0, 0, 0], -28, 84);

  // the rolling readout, alive only while the wells are being emptied
  const readoutBar = new THREE.Mesh(
    new THREE.BoxGeometry(SEN_W * 1.04, 0.006, 0.026),
    new THREE.MeshBasicMaterial({
      color: 0x7f9cff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  readoutBar.position.y = SENSOR_Y + 0.03;
  sensorStack.add(readoutBar);

  // the IR-cut filter that sits between the lens and the sensor on every module
  const irFilter = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.014, 0.86), irFilterMat);
  irFilter.position.y = 0.46;
  upper.add(irFilter);

  // --- shield can (cut away) --------------------------------------------------
  // A real can is a closed steel box, and modelled closed it is exactly that:
  // an opaque slab with the entire mechanism sealed behind it. So the two walls
  // that face the camera are simply not built — the standard cutaway, and the
  // only way the voice coil, the magnets and the springs are ever visible.
  // Every module-scale camera sits in the +X/+Z quadrant, so the surviving -X
  // and -Z walls read as the inside of the can behind the mechanism.
  {
    const wallH = CAN_TOP - SUB_T;
    for (const [sx, sz, w, d] of [
      [0, -CAN_W / 2, CAN_W, 0.03],
      [-CAN_W / 2, 0, 0.03, CAN_W],
    ]) {
      const wall = beveledBox(w, wallH, d, canMat, 0.008);
      wall.position.set(sx, SUB_T + wallH / 2, sz);
      wall.castShadow = true;
      upper.add(wall);
    }
    // The lid, cut to the same half as the walls. Left whole it was a solid
    // square sitting 0.3 above the aperture plane, and geometry says a point at
    // the aperture can only be seen through its bore from steeper than ~75
    // degrees — so the iris was occluded from every camera that was not
    // straight overhead, and straight overhead the lid filled the frame.
    const top = new THREE.Mesh(
      new THREE.RingGeometry(BARREL_R + 0.035, CAN_W / 2 + 0.01, 44, 1, CUT_RING_START, Math.PI),
      canMat,
    );
    top.rotation.x = -Math.PI / 2;
    top.position.y = CAN_TOP;
    upper.add(top);
  }

  // --- the OIS suspension: four wires and two base coils ----------------------
  // Four wires at the corners make a parallelogram linkage: swing them all
  // through the same angle and the block they carry TRANSLATES without tilting,
  // which is exactly what the real suspension does.
  const wirePivots = [];
  const WIRE_BASE = SUB_T + 0.06;
  const WIRE_LEN = SPRING_HI - WIRE_BASE;
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * (CAN_W / 2 - 0.1), WIRE_BASE, sz * (CAN_W / 2 - 0.1));
    upper.add(pivot);
    const wire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, WIRE_LEN, 10),
      wireMat,
    );
    wire.position.y = WIRE_LEN / 2;
    pivot.add(wire);
    wirePivots.push(pivot);
  }
  labels.add(
    'ois',
    anchor(shakeRig, CAN_W / 2 - 0.1, WIRE_BASE + WIRE_LEN * 0.62, CAN_W / 2 - 0.1),
    'Suspension wire',
    [0, 0, 0],
    26,
    86,
  );

  // the flat X and Y coils lying on the base that do the shoving
  for (const [ang, sz] of [
    [0, 0.62],
    [Math.PI / 2, 0.62],
  ]) {
    const pad = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.028, 6, 26), copperMat);
    pad.scale.set(1, 0.42, 1);
    pad.rotation.x = Math.PI / 2;
    pad.position.set(Math.cos(ang) * sz, SUB_T + 0.03, Math.sin(ang) * sz);
    upper.add(pad);
  }
  labels.add('ois', anchor(shakeRig, 0.62, SUB_T + 0.07, 0), 'OIS drive coil', [0, 0, 0], -50, 84);

  // --- the AF block: everything the voice coil moves --------------------------
  // `oisBlock` is shoved sideways by the stabiliser; `afBlock` rides inside it
  // and is lifted by the voice coil. Two nested groups, so the two motions
  // compose the way they physically do.
  const oisBlock = new THREE.Group();
  upper.add(oisBlock);
  const afBlock = new THREE.Group();
  oisBlock.add(afBlock);

  // four magnets, fixed to the can's corners — these do NOT move with the lens
  for (const [sx, sz] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    const mag = beveledBox(
      sx ? 0.14 : 0.5,
      0.44,
      sx ? 0.5 : 0.14,
      magnetMat,
      0.012,
    );
    mag.position.set(sx * (CAN_W / 2 - 0.1), 0.98, sz * (CAN_W / 2 - 0.1));
    oisBlock.add(mag);
  }
  labels.add('af', anchor(oisBlock, CAN_W / 2 - 0.1, 1.14, 0), 'Magnet', [0, 0, 0], -18, 78);

  // the carrier and its copper winding — the voice coil itself
  {
    // half-tube: the near side is cut away, or the carrier walls off its own
    // voice coil exactly the way the shield can walled off the module
    const carrierTube = new THREE.Mesh(
      new THREE.CylinderGeometry(
        BARREL_R + 0.05,
        BARREL_R + 0.05,
        0.62,
        36,
        1,
        true,
        CUT_START,
        Math.PI,
      ),
      barrelMat,
    );
    carrierTube.position.y = 0.99;
    afBlock.add(carrierTube);
    const winding = coil(
      {
        turns: 13,
        radius: BARREL_R + 0.075,
        length: 0.3,
        wireRadius: 0.019,
        segmentsPerTurn: 26,
      },
      copperMat,
    );
    winding.mesh.position.y = 0.99;
    afBlock.add(winding.mesh);
    labels.add('af', anchor(afBlock, BARREL_R + 0.09, 0.99, 0), 'Voice-coil winding', [0, 0, 0], 44, 96);
  }

  // --- the lens stack --------------------------------------------------------
  // Six moulded plastic aspheres. Real phone elements are wildly non-spherical
  // — the last one turns up at the edge like a gull's wing to flatten the field
  // — and getting that silhouette right is most of what makes the stack read as
  // a phone lens rather than a camera lens.
  {
    // Cut away like the carrier and the can — an intact barrel is an opaque
    // tube with the entire lens stack sealed inside it, which is the one thing
    // this step exists to show.
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(BARREL_R, BARREL_R, 0.82, 40, 1, true, CUT_START, Math.PI),
      barrelMat,
    );
    wall.position.y = 1.06;
    afBlock.add(wall);
    // the retaining rim, cut to match — a full annulus would hang across the
    // opening with nothing under it
    const face = new THREE.Mesh(
      new THREE.RingGeometry(0.3, BARREL_R, 40, 1, CUT_RING_START, Math.PI),
      barrelMat,
    );
    face.rotation.x = -Math.PI / 2;
    face.position.y = 1.47;
    afBlock.add(face);

    // [radius, top sag, bottom sag, y] — negative sag is a concave face
    const ELEMENTS = [
      [0.27, 0.075, -0.02, 1.4],
      [0.25, -0.03, 0.055, 1.21],
      [0.27, 0.05, -0.035, 1.06],
      [0.3, -0.04, 0.05, 0.92],
      [0.33, 0.045, -0.045, 0.79],
      [0.36, -0.05, 0.07, 0.66],
    ];
    for (const [r, st, sb, y] of ELEMENTS) {
      afBlock.add(asphere(r, st, sb, y, elemMat));
    }
    labels.add('af', anchor(afBlock, 0.2, 1.42, 0), 'Lens stack', [0, 0, 0], 118, 74);
    labels.add('stop', anchor(afBlock, 0.2, 1.44, 0), 'Front element', [0, 0, 0], 122, 76);
  }

  // --- the aperture ----------------------------------------------------------
  // The fixed stop: an opaque black annulus moulded between two elements. It is
  // the entire aperture mechanism on almost every phone ever made.
  const fixedStop = new THREE.Mesh(
    new THREE.RingGeometry(AP_WIDE, 0.33, 44),
    stopMat,
  );
  fixedStop.rotation.x = -Math.PI / 2;
  fixedStop.position.y = STOP_Y;
  afBlock.add(fixedStop);
  labels.add('stop', anchor(afBlock, 0.19, STOP_Y, 0), 'Aperture stop', [0, 0, 0], -52, 90);

  // The rare six-blade iris, for the handful of phones that fit one. Same
  // construction as a real diaphragm: each blade is a disc pivoting on a ring,
  // and the near-circular hole they leave between them is bounded by six arcs.
  const irisGroup = new THREE.Group();
  irisGroup.position.y = STOP_Y;
  afBlock.add(irisGroup);
  // Six blades, each a thin disc pivoting on a ring: swing them together and
  // the near-circular hole left between them is bounded by six arcs, which is
  // exactly what a curved-blade diaphragm looks like. The three radii are
  // solved so the hole runs 0.069 (f/4.0) to 0.159 (f/1.63) while no blade ever
  // reaches past 0.48 — the radius the masking plates below cover.
  // The three radii are solved together so that the hole runs 0.159 (f/1.63)
  // to 0.069 (f/4.0) AND no blade ever reaches past 0.399 — just inside the
  // barrel wall at 0.40. That second condition is what lets the blades be shown
  // with no masking plate at all: an earlier version needed plates above and
  // below to hide the overhang, and those plates then hid the blades from every
  // camera that was not looking straight down the bore.
  //   reach = |centre|max + RD,  hole = |centre| - RD
  //   |centre|² = RP² + L² + 2·RP·L·cos(psi)
  const bladePivots = [];
  const IRIS_RD = 0.12; // blade disc radius
  const IRIS_RP = 0.2; // pivot circle radius
  const IRIS_L = 0.079; // pivot -> blade centre
  const IRIS_PSI_OPEN = 0;
  const IRIS_PSI_SHUT = (110 * Math.PI) / 180;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(a) * IRIS_RP, i * 0.0018, Math.sin(a) * IRIS_RP);
    const blade = new THREE.Mesh(
      new THREE.CylinderGeometry(IRIS_RD, IRIS_RD, 0.004, 40),
      bladeMat,
    );
    blade.position.x = IRIS_L;
    pivot.add(blade);
    pivot.userData.base = a;
    irisGroup.add(pivot);
    bladePivots.push(pivot);
  }
  {
    // A thin dark ring OUTSIDE the blade ring, so the diaphragm reads as a
    // mounted unit and the hole has something dark behind its rim. It stops
    // short of the blades themselves, which stay visible from every angle.
    const seat = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.395, 40), stopMat);
    seat.rotation.x = -Math.PI / 2;
    seat.position.y = -0.014;
    irisGroup.add(seat);
  }
  labels.add('iris', anchor(irisGroup, 0.18, 0.02, 0), 'Six-blade iris', [0, 0, 0], -46, 92);

  // --- leaf springs ----------------------------------------------------------
  // The springs genuinely BEND: each arm is a tube with a flexed morph target,
  // its outer end anchored to the can and its inner end riding the carrier, so
  // the arms bow as the voice coil lifts the lens.
  const springArms = [];
  // NB: parented to oisBlock, not the can. The springs return the lens along
  // the optical axis, but they ride the stabiliser's moving frame — anchoring
  // their outer ends to the can instead would visibly tear them apart the
  // moment OIS shoved the block sideways.
  for (const [y, lift] of [
    [SPRING_LO, AF_TRAVEL],
    [SPRING_HI, AF_TRAVEL],
  ]) {
    const outer = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.016, 6, 40), springMat);
    outer.rotation.x = Math.PI / 2;
    outer.position.y = y;
    oisBlock.add(outer); // the fixed end, as far as the lens is concerned

    const inner = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.016, 6, 36), springMat);
    inner.rotation.x = Math.PI / 2;
    inner.position.y = y;
    afBlock.add(inner); // rides the lens

    for (let k = 0; k < 3; k++) {
      const a0 = (k / 3) * TAU;
      const arm = flexTube(
        armPoints(a0, y, 0),
        armPoints(a0, y, lift),
        0.014,
        springMat,
      );
      oisBlock.add(arm);
      springArms.push(arm);
    }
  }
  labels.add('af', anchor(oisBlock, 0.6, SPRING_HI, 0.2), 'Leaf spring', [0, 0, 0], 8, 80);

  // --- the light path --------------------------------------------------------
  // Real chief-ray geometry, not a decorative cone: rays run from a subject
  // point down to the aperture, then on to wherever the thin-lens construction
  // actually puts the image. That is what makes the autofocus step honest —
  // when the lens is in the wrong place, the rays visibly miss the chip.
  const RAY_N = 7;
  const rayUp = [];
  const rayDn = [];
  for (let i = 0; i < RAY_N; i++) {
    rayUp.push(unitRay(beamMat(), 0.011));
    rayDn.push(unitRay(beamMat(), 0.011));
  }
  const rayGroup = new THREE.Group();
  rayGroup.add(...rayUp, ...rayDn);
  shakeRig.add(rayGroup);

  const subjectDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0xffe2ad,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  macroMain.add(subjectDot); // NOT on shakeRig: the world does not shake

  // where the cone actually lands on the chip: a point when sharp, a disc when
  // not, and off-centre when the stabiliser is off
  const blurDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 32), spotMat);
  blurDisc.rotation.x = -Math.PI / 2;
  shakeRig.add(blurDisc);

  // ===========================================================================
  //  MODULE SCALE — the folded periscope telephoto
  // ===========================================================================
  let periBeams;
  let periPath;
  let periDots;
  let periZoomGroup;
  {
    const sub = beveledBox(2.9, SUB_T, 1.05, pcbMat, 0.012);
    sub.position.y = SUB_T / 2;
    sub.receiveShadow = true;
    macroPeri.add(sub);

    const H = 0.84;
    // housing walls, open on the +Z side so the whole fold is visible
    for (const [x, z, w, d] of [
      [0, -0.45, 2.7, 0.03],
      [-1.35, 0, 0.03, 0.9],
      [1.35, 0, 0.03, 0.9],
    ]) {
      const wall = beveledBox(w, H, d, canMat, 0.008);
      wall.position.set(x, SUB_T + H / 2, z);
      macroPeri.add(wall);
    }
    // the top plate, with a REAL rectangular window over the prism
    {
      const s = new THREE.Shape();
      s.moveTo(-1.35, -0.45);
      s.lineTo(1.35, -0.45);
      s.lineTo(1.35, 0.45);
      s.lineTo(-1.35, 0.45);
      s.closePath();
      const h = new THREE.Path();
      h.moveTo(PER_FOLD - 0.28, -0.3);
      h.lineTo(PER_FOLD - 0.28, 0.3);
      h.lineTo(PER_FOLD + 0.28, 0.3);
      h.lineTo(PER_FOLD + 0.28, -0.3);
      h.closePath();
      s.holes.push(h);
      const top = new THREE.Mesh(
        new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false }),
        canMat,
      );
      top.rotation.x = -Math.PI / 2;
      top.position.y = SUB_T + H;
      macroPeri.add(top);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.012, 0.58), elemMat);
      glass.position.set(PER_FOLD, SUB_T + H - 0.02, 0);
      macroPeri.add(glass);
      labels.add(
        'peri',
        anchor(macroPeri, PER_FOLD, SUB_T + H, 0.16),
        'Light window',
        [0, 0, 0],
        88,
        76,
      );
    }

    // The 45-degree prism. Light arrives travelling straight down and must
    // leave travelling along +X, so the reflecting face's normal has to bisect
    // those two directions — the hypotenuse runs from the top of the -X edge
    // down to the bottom of the +X edge. Tilt it the other way and the prism
    // throws the image into the floor.
    {
      const w = 0.3;
      const s = new THREE.Shape();
      s.moveTo(-w, w); // top, -X  — entrance face runs from here...
      s.lineTo(w, w); // top, +X  — ...to here
      s.lineTo(w, -w); // bottom, +X — exit face is the +X edge
      s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, {
        depth: 0.56,
        bevelEnabled: true,
        bevelThickness: 0.008,
        bevelSize: 0.008,
        bevelSegments: 1,
      });
      geo.translate(0, 0, -0.28);
      const prism = new THREE.Mesh(geo, prismMat);
      prism.position.set(PER_FOLD, PER_AXIS, 0);
      macroPeri.add(prism);

      // The hypotenuse is where the light actually turns, and a block of clear
      // glass gives the eye nothing to read that from. A mirrored face on the
      // 45° surface makes the fold legible — and it is honest: the reflecting
      // face of a real periscope prism carries a mirror coating.
      const mirror = new THREE.Mesh(
        // width spans the hypotenuse (2w root 2), height spans the extrusion
        new THREE.PlaneGeometry(w * 2 * Math.SQRT2 * 0.98, 0.54),
        new THREE.MeshPhysicalMaterial({
          color: 0xbfc9d8,
          metalness: 1,
          roughness: 0.24,
          side: THREE.DoubleSide,
        }),
      );
      // A plane's normal is its local +Z, so the basis is stated outright:
      // +Z onto the face normal (1,1,0), +X along the hypotenuse (1,-1,0), and
      // +Y falls out as -Z. Euler guesswork here silently aims the fold at the
      // floor and the beam stops matching the glass.
      const nrm = new THREE.Vector3(1, 1, 0).normalize();
      const along = new THREE.Vector3(1, -1, 0).normalize();
      const side = new THREE.Vector3().crossVectors(nrm, along);
      mirror.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(along, side, nrm),
      );
      mirror.position.set(PER_FOLD, PER_AXIS, 0);
      macroPeri.add(mirror);
      // The prism lives at the module's -X end, which is already the panel side
      // of frame — so its leader points up-and-RIGHT, back over the module,
      // rather than off the edge into the copy.
      labels.add('peri', anchor(macroPeri, PER_FOLD, PER_AXIS + 0.24, 0), '45° prism', [0, 0, 0], 44, 78);
    }

    // the folded barrel: four elements lying on their sides, two of which slide
    const periZoom = new THREE.Group();
    macroPeri.add(periZoom);
    for (const [x, r, st, sb, moving] of [
      [-0.42, 0.26, 0.05, -0.03, false],
      [-0.06, 0.24, -0.035, 0.05, true],
      [0.34, 0.26, 0.045, -0.03, true],
      [0.74, 0.28, -0.04, 0.06, false],
    ]) {
      const el = asphere(r, st, sb, 0, elemMat);
      el.rotation.z = -Math.PI / 2; // stand the element up on the horizontal axis
      el.position.set(x, PER_AXIS, 0);
      (moving ? periZoom : macroPeri).add(el);
    }
    labels.add('peri', anchor(periZoom, 0.14, PER_AXIS + 0.24, 0), 'Zoom group', [0, 0, 0], 74, 76);

    // the sensor standing on its edge at the far end, facing back down the barrel
    const perSensor = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.44, 0.56),
      new THREE.MeshStandardMaterial({
        color: 0x161a24,
        roughness: 0.5,
        metalness: 0.2,
        map: bayerTexture(14, 0.09, true),
        emissive: 0xffffff,
        emissiveMap: bayerTexture(14, 0.09, true),
        emissiveIntensity: 0.26,
      }),
    );
    perSensor.position.set(PER_SENSOR, PER_AXIS, 0);
    macroPeri.add(perSensor);
    const perBoard = beveledBox(0.05, 0.6, 0.72, linerMat, 0.008);
    perBoard.position.set(PER_SENSOR + 0.05, PER_AXIS, 0);
    macroPeri.add(perBoard);
    labels.add('peri', anchor(macroPeri, PER_SENSOR, PER_AXIS - 0.26, 0), 'Image sensor', [0, 0, 0], -34, 80);

    // the folded beam and the photons riding it
    const PER_NODES = [
      [PER_FOLD, SUB_T + H + 0.5, 0],
      [PER_FOLD, PER_AXIS, 0],
      [PER_SENSOR, PER_AXIS, 0],
    ];
    periBeams = new THREE.Group();
    macroPeri.add(periBeams);
    for (let i = 0; i < PER_NODES.length - 1; i++) {
      periBeams.add(beamSegment(PER_NODES[i], PER_NODES[i + 1], 0.05, beamMat()));
    }
    periPath = chainPath([
      [PER_NODES[0], PER_NODES[1]],
      [PER_NODES[1], PER_NODES[2]],
    ]);
    periDots = [];
    for (let i = 0; i < 12; i++) {
      const d = new THREE.Mesh(
        new THREE.SphereGeometry(0.024, 10, 8),
        new THREE.MeshBasicMaterial({
          color: 0xffe9bd,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      macroPeri.add(d);
      periDots.push(d);
    }
    periZoomGroup = periZoom;
  }

  // --- the magnified colour-mosaic tile ---------------------------------------
  // Real photosites are under a micron across, so the mosaic is invisible even
  // at module scale — this floats one 4x4 Quad-Bayer tile out beside the module
  // at a size you can actually read.
  const inset = new THREE.Group();
  inset.position.set(0.92, 0.64, 0.18);
  const insetPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.34),
    new THREE.MeshBasicMaterial({
      map: bayerTexture(4, 0.12, true),
      transparent: true,
      opacity: 0.92,
    }),
  );
  inset.add(insetPlate);
  const insetFrame = new THREE.Mesh(
    new THREE.TorusGeometry(0.241, 0.005, 6, 4),
    new THREE.MeshBasicMaterial({ color: 0x7f9cff, transparent: true, opacity: 0.55 }),
  );
  insetFrame.rotation.z = Math.PI / 4;
  inset.add(insetFrame);
  inset.visible = false;
  rig.add(inset);
  labels.add('sensor', anchor(inset, 0, 0.2, 0), 'One 2×2 colour block', [0, 0, 0], 44, 74);

  // ===========================================================================
  //  POSE
  // ===========================================================================
  const state = {
    spin: 0,
    open: 0,
    macro: 0,
    which: 0,
    subj: 0,
    af: 0,
    iris: 1,
    varia: 0,
    shake: 0,
    correct: 0,
    zoom: 0,
    burst: 0,
    bare: 0,
    explode: 0,
    sense: 0,
    flow: 0,
    rays: 1,
    inset: 0,
  };

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();

  function setPose() {
    rig.rotation.y = state.spin;

    // --- which scene is on stage ---------------------------------------------
    const onMacro = state.macro > 0.5;
    const onPeri = onMacro && state.which > 0.5;
    phone.visible = !onMacro;
    macroMain.visible = onMacro && !onPeri;
    macroPeri.visible = onPeri;
    inset.visible = state.inset > 0.5 && onMacro && !onPeri;

    // --- phone ---------------------------------------------------------------
    const glow = clamp01(state.burst);
    lensGlints.forEach((m, i) => {
      // the three eyes wake in sequence, so the finale reads as a camera that
      // is genuinely looking at something
      m.opacity = glow * 0.5 * (0.45 + 0.55 * Math.sin((state.flow + i / 3) * TAU) ** 2);
    });
    burstFrames.forEach((f, i) => {
      const k = i / (burstFrames.length - 1);
      const gather = smooth(state.burst); // 0 = five separate frames, 1 = one
      f.position.set((k - 0.5) * 0.5 * (1 - gather), k * 0.34 * (1 - gather), 0);
      f.material.opacity = state.burst * (0.06 + 0.2 * gather * (i === 0 ? 2.4 : 0.35));
    });

    // --- the hand tremor ------------------------------------------------------
    // A real tremor is angular, so the module ROTATES about its base. Rotation
    // is also the only thing that moves a distant subject's image at all —
    // sliding the phone sideways does nothing, which is exactly why the sensor
    // listening to your hands is a gyroscope.
    const theta = state.shake * SHAKE_MAX;
    shakeRig.rotation.z = theta;

    // --- autofocus ------------------------------------------------------------
    // `af` is where the voice coil has parked the lens; `subj` is where the
    // subject actually is. They agree only when the lens has caught up, and the
    // gap between them IS the blur.
    const lensY = 1.0 + state.af * AF_TRAVEL;
    afBlock.position.y = state.af * AF_TRAVEL;
    for (const arm of springArms) arm.morphTargetInfluences[0] = state.af;

    // the aperture: a fixed moulded hole, or the rare iris that really moves
    // the cone has to match the hole the blades actually leave, or the copy's
    // "watch what closing it does to the cone of light" is a lie on screen
    const apR = state.varia > 0.5
      ? 0.069 + (0.159 - 0.069) * clamp01(state.iris)
      : AP_WIDE;
    fixedStop.visible = state.varia < 0.5;
    irisGroup.visible = state.varia > 0.5;
    const psi = IRIS_PSI_SHUT + (IRIS_PSI_OPEN - IRIS_PSI_SHUT) * clamp01(state.iris);
    for (const p of bladePivots) p.rotation.y = -(p.userData.base + psi);

    // Where the subject sits in the module's own frame. It is fixed in the
    // WORLD, so as the module rocks it slides across the module's field of
    // view — which is the whole reason a photograph smears. shakeRig maps
    // local -> world by R(+theta), so the world point (0, Y) has to be carried
    // the other way, by R(-theta), to land in the rig's own coordinates.
    const subjWorldY = SUBJ_Y - state.subj * SUBJ_NEAR;
    const sx = subjWorldY * Math.sin(theta);
    const sy = subjWorldY * Math.cos(theta);
    subjectDot.position.set(0, subjWorldY, 0); // NOT on shakeRig — the world holds still

    // Thin-lens chief ray: it passes straight through the lens centre, so where
    // it crosses the sensor plane IS the image position. Shifting the lens
    // sideways therefore drags the image with it — the entire principle the
    // stabiliser runs on.
    const t = (SENSOR_Y - lensY) / (lensY - sy);
    const need = (t * sx) / (1 + t); // the shift that lands the image dead centre
    const lensX = need * clamp01(state.correct);
    oisBlock.position.x = lensX;
    const imageX = lensX + t * (lensX - sx);

    // the wires swing through the angle that carries the block exactly that far
    const swing = Math.asin(clamp01(Math.abs(lensX) / WIRE_LEN)) * Math.sign(lensX);
    for (const p of wirePivots) p.rotation.z = -swing;

    // Defocus: the cone comes to a point AF_TRAVEL*(af-subj) away from the chip.
    const defocus = (state.af - state.subj) * AF_TRAVEL;
    const imageY = SENSOR_Y + defocus;
    const blurR = Math.min(0.3, (apR * Math.abs(defocus)) / Math.max(0.12, STOP_Y - SENSOR_Y));

    // --- rays -----------------------------------------------------------------
    const showRays = state.rays > 0.5 && onMacro && !onPeri;
    vB.set(imageX, imageY, 0);
    for (let i = 0; i < RAY_N; i++) {
      const a = (i / RAY_N) * TAU;
      // the aperture ring rides the lens, so stopping down visibly thins the cone
      vA.set(lensX + Math.cos(a) * apR, STOP_Y + state.af * AF_TRAVEL, Math.sin(a) * apR);
      aimRay(rayUp[i], sx, sy, 0, vA.x, vA.y, vA.z);
      aimRay(rayDn[i], vA.x, vA.y, vA.z, vB.x, vB.y, vB.z);
      const o = showRays ? 0.5 : 0;
      rayUp[i].material.opacity = o * 0.55;
      rayDn[i].material.opacity = o;
    }
    subjectDot.material.opacity = showRays ? 0.85 : 0;

    blurDisc.visible = showRays;
    // Floor the landing spot at a radius that survives the wide OIS framing.
    // At 0.018 the sharp spot was a few pixels across, so the whole payoff of
    // the stabiliser step — the spot sliding off the chip's centre and then
    // pinning to it — was there in the maths but invisible on screen.
    blurDisc.scale.setScalar(Math.max(0.045, blurR));
    blurDisc.position.set(imageX, SENSOR_Y + 0.045, 0);
    // a tight point reads bright, a wide disc reads faint — the same amount of
    // light spread over more chip
    spotMat.opacity = showRays ? 0.85 * (0.05 / Math.max(0.05, blurR)) ** 0.6 : 0;

    // --- sensor stack ---------------------------------------------------------
    // The layers separate UPWARD off a logic die that stays put. Pushing the
    // die down instead drove it through the substrate, and the old upward
    // spacing drove the microlenses into the lens barrel.
    const e = clamp01(state.explode);
    upper.visible = state.bare < 0.5;
    microlenses.position.y = SENSOR_Y + 0.012 + e * 0.46;
    colourFilter.position.y = SENSOR_Y + e * 0.3;
    photodiodes.position.y = SENSOR_Y - 0.02 + e * 0.14;
    carrier.position.y = SENSOR_Y - 0.06 + e * 0.02;
    logicDie.position.y = SENSOR_Y - 0.13;

    const s = clamp01(state.sense);
    const charge = s < 0.7 ? s / 0.7 : 1 - (s - 0.7) / 0.3;
    const readT = clamp01((s - 0.7) / 0.3);
    colourFilter.material.emissiveIntensity = 0.2 + charge * 0.85;
    readoutBar.material.opacity = s > 0.7 ? 0.85 : 0;
    // rides the colour filter, so the sweep stays on the layer it is reading
    readoutBar.position.set(0, SENSOR_Y + 0.03 + e * 0.3, -SEN_W / 2 + SEN_W * readT);
    insetPlate.material.opacity = 0.35 + 0.6 * Math.max(charge, 0.3);

    // --- periscope ------------------------------------------------------------
    // Deliberately NOT gated on `onPeri`. Gating it meant the folded module
    // only moved while its own step happened to be the active one, so any probe
    // that seeks a timeline without first entering the step (verify.mjs's
    // motion gate does exactly that) read the whole step as frozen.
    periZoomGroup.position.x = -0.3 * smooth(state.zoom);
    const periOn = onPeri && state.rays > 0.5 ? 0.26 : 0;
    for (const m of periBeams.children) m.material.opacity = periOn;
    periDots.forEach((d, i) => {
      const u = (((state.flow + i / periDots.length) % 1) + 1) % 1;
      d.position.copy(periPath.getPointAt(u));
      d.material.opacity = periOn > 0 ? 0.4 + 0.6 * Math.sin(u * Math.PI) : 0;
    });
  }

  function setOpen(v) {
    state.open = v;
    const ghost = v > 0.01;
    for (const m of ghostable) {
      m.transparent = ghost;
      m.opacity = 1 - 0.87 * v;
      m.depthWrite = !ghost;
      // clearcoat renders at FULL strength regardless of opacity — a ghosted
      // panel still reads solid unless the coat goes off with it
      m.clearcoat = ghost ? 0 : m.userData.coat;
    }
    phoneShell.traverse((o) => {
      if (o.isMesh) o.castShadow = !ghost;
    });
    phoneTrim.visible = !ghost; // metal cannot be ghosted; hide it outright
    phoneOptics.visible = !ghost; // and refractive glass least of all
    phoneGuts.visible = ghost;
    setPose();
  }

  setOpen(0);
  setPose();

  return {
    group: rig,
    parts: {
      rig,
      phone,
      afBlock,
      oisBlock,
      iris: irisGroup,
      sensorStack,
      periscope: macroPeri,
    },
    setLabels: labels.setLabels,
    setOpen,
    set(partial) {
      Object.assign(state, partial);
      setPose();
    },
  };
}

// --- local geometry helpers ---------------------------------------------------

// A rounded rectangular slab standing on y=0 — a phone body, a camera island, a
// battery. RoundedBoxGeometry clamps its radius to half the SMALLEST dimension,
// which on a 0.24-thick phone would round the corners by 0.12 instead of 0.34,
// so the squircle has to come from an extruded Shape.
function roundedSlab(w, d, h, r, mat, bevel = 0.006) {
  const hw = w / 2;
  const hd = d / 2;
  const rr = Math.min(r, hw, hd);
  const s = new THREE.Shape();
  s.moveTo(-hw + rr, -hd);
  s.lineTo(hw - rr, -hd);
  s.absarc(hw - rr, -hd + rr, rr, -Math.PI / 2, 0, false);
  s.lineTo(hw, hd - rr);
  s.absarc(hw - rr, hd - rr, rr, 0, Math.PI / 2, false);
  s.lineTo(-hw + rr, hd);
  s.absarc(-hw + rr, hd - rr, rr, Math.PI / 2, Math.PI, false);
  s.lineTo(-hw, -hd + rr);
  s.absarc(-hw + rr, -hd + rr, rr, Math.PI, Math.PI * 1.5, false);
  const bt = Math.min(bevel, h / 3);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: h - bt * 2,
    bevelEnabled: true,
    bevelThickness: bt,
    bevelSize: bt,
    bevelSegments: 2,
    curveSegments: 14,
  });
  geo.rotateX(-Math.PI / 2); // shape plane XY -> XZ, extrusion +Z -> +Y
  geo.translate(0, bt, 0); // stand it on y=0
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

// A moulded plastic asphere: `sagTop`/`sagBot` are the two faces' bulges, and a
// NEGATIVE value dishes that face inward. Lathed about +Y, so the element sits
// on the vertical optical axis.
function asphere(radius, sagTop, sagBot, y, mat) {
  const N = 16;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const r = (radius * i) / N;
    const k = Math.sqrt(Math.max(0, 1 - (r / radius) ** 2));
    pts.push([r, sagTop * k]);
  }
  for (let i = N; i >= 0; i--) {
    const r = (radius * i) / N;
    const k = Math.sqrt(Math.max(0, 1 - (r / radius) ** 2));
    pts.push([r, -sagBot * k]);
  }
  const m = lathe(pts, mat, 44);
  m.castShadow = false;
  m.position.y = y;
  return m;
}

// One arm of a leaf spring: a shallow spiral from the outer ring in to the
// inner one, with the inner end raised by `lift`.
function armPoints(a0, y, lift) {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const r = 0.62 - 0.18 * t;
    const a = a0 + t * 1.45;
    pts.push([Math.cos(a) * r, y + lift * smooth(t), Math.sin(a) * r]);
  }
  return pts;
}

// Two tubes with identical topology, the second stored as morph target 0 — so a
// spring arm genuinely BENDS between the two poses instead of being rebuilt
// per frame.
function flexTube(ptsRest, ptsFlex, radius, mat, seg = 48) {
  const mk = (pts) =>
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(
        pts.map((p) => new THREE.Vector3(...p)),
        false,
        'catmullrom',
        0.4,
      ),
      seg,
      radius,
      7,
      false,
    );
  const geo = mk(ptsRest);
  const flex = mk(ptsFlex);
  const pos = flex.getAttribute('position').clone();
  pos.name = 'flex';
  geo.morphAttributes.position = [pos];
  geo.morphAttributes.normal = [flex.getAttribute('normal').clone()];
  flex.dispose();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.updateMorphTargets();
  mesh.morphTargetInfluences[0] = 0;
  return mesh;
}

// A unit-length ray along +Y with its origin at the BOTTOM, so aimRay() can
// place, aim and stretch it every frame without touching geometry.
function unitRay(mat, radius) {
  const geo = new THREE.CylinderGeometry(radius, radius, 1, 6, 1, true);
  geo.translate(0, 0.5, 0);
  return new THREE.Mesh(geo, mat);
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
function aimRay(mesh, ax, ay, az, bx, by, bz) {
  _a.set(ax, ay, az);
  _b.set(bx, by, bz);
  const len = _a.distanceTo(_b);
  mesh.position.copy(_a);
  mesh.scale.set(1, Math.max(1e-4, len), 1);
  mesh.quaternion.setFromUnitVectors(_up, _b.sub(_a).normalize());
}

// A fixed straight beam between two points (the periscope's folded path, whose
// geometry never changes).
function beamSegment(a, b, radius, mat) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, va.distanceTo(vb), 14, 1, true),
    mat,
  );
  m.position.copy(va).lerp(vb, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return m;
}

// The colour-filter mosaic, drawn as discrete wells with a gutter so the grid
// reads as individual photosites. `quad` groups them 2x2 into the Quad-Bayer
// pattern modern phone sensors use, which is what lets four small pixels be
// binned into one big sensitive one in low light.
function bayerTexture(cells, gutter, quad = false) {
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
      const bx = quad ? Math.floor(x / 2) : x;
      const by = quad ? Math.floor(y / 2) : y;
      const evenX = bx % 2 === 0;
      const evenY = by % 2 === 0;
      ctx.fillStyle = evenY
        ? evenX
          ? '#9c463c'
          : '#4b8a52'
        : evenX
          ? '#4b8a52'
          : '#3d5e96';
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
