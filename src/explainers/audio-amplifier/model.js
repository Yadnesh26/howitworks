import * as THREE from 'three';
import { materials, disc, studioPlinth } from '../../framework/parts.js';
import { beveledBox, lathe, tubeAlong, coil, radialLoft, chainPath } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, smooth, TAU } from '../../framework/motion.js';

// The complete audio signal chain — moving-coil microphone, integrated
// amplifier, bookshelf speaker — staged left to right on one charcoal plinth so
// the signal reads in the direction people read. Everything is sealed in step 1;
// the mic and the speaker open as genuine section cuts (world clipping planes
// through their axes) and the amplifier's lid lifts off.
//
// MECHANISM (researched — Britannica "dynamic microphone"; Electronics Notes
// "Moving coil / dynamic microphone"; Shure SM58 datasheet; ElProcus and
// AllAboutCircuits on push-pull class-B/AB output stages; Analog Devices
// University lab 14 "Push-Pull Class B and Class AB Amplifiers"):
//
// MICROPHONE. A moving-coil (dynamic) capsule is a loudspeaker run backwards.
// A polyester diaphragm ~35 um thick carries a cylindrical coil of hair-fine
// copper glued to its back; the coil hangs in the annular gap between a centre
// pole piece and the outer yoke of a small permanent magnet. Sound is a
// pressure fluctuation, pressure pushes the diaphragm, the coil moves with it,
// and a conductor moving through a magnetic field develops a voltage across its
// ends (Faraday induction). An SM58 puts out 1.85 mV per pascal; ordinary
// close speech is a couple of pascals, so the whole signal leaving the
// microphone is a few THOUSANDTHS of a volt at microwatt power levels.
//
// PREAMP. The first stage inside the amplifier is a voltage amplifier: a
// transistor biased into its linear region so a small change at its base
// produces a proportionally larger change at its collector. Mic preamps run
// roughly 40-60 dB of gain (x100 to x1000), taking millivolts up to LINE LEVEL
// — order of one volt, the level the rest of the audio world assumes.
//
// POWER SUPPLY. The point everyone misses: an amplifier never enlarges the
// incoming signal. Energy is conserved; the extra energy comes from the mains.
// The transformer steps the wall voltage down, a rectifier turns it to DC and
// the reservoir capacitors smooth it into a stiff supply rail. The signal is
// only the control input deciding how much of that rail reaches the speaker.
//
// PUSH-PULL OUTPUT (class AB). The output stage is two complementary
// transistors across the supply. On the positive half-cycle the upper (NPN)
// device conducts and SOURCES current into the speaker; on the negative
// half-cycle the lower (PNP) device conducts and SINKS it. Each is idle for
// half of every cycle, which is why the stage is efficient. Class B — both
// biased fully off at rest — leaves a notch where the wave crosses zero
// (crossover distortion), because a transistor needs ~0.6 V on its base before
// it conducts at all. Class AB trickles a small quiescent bias through both
// devices so the handover is continuous. That small idle current is why the
// heatsink is warm even with nothing playing.
//
// SPEAKER. The mirror of the microphone, scaled up: current from the output
// stage runs through a voice coil sitting in a magnet gap, the resulting force
// drives a cone, the cone moves air. Tens of watts, against the microphone's
// microwatts. (The driver's own suspension/surround mechanics are the subject
// of the separate `loudspeaker` explainer and are deliberately not re-taught
// here — this one ends at the cone.)
//
// PROPORTIONS (world units, 1 unit = 100 mm; every constant derives from real
// hardware so the silhouette ratios hold by construction):
//   microphone   SM58: 162 mm long, 51 mm grille ball, 23 mm handle
//                -> 1.62 long, 0.255 ball radius, 0.115 handle radius
//   amplifier    compact integrated amp 200 x 78 x 180 mm -> 2.00 x 0.78 x 1.80
//   speaker      bookshelf cabinet 142 x 224 x 175 mm -> 1.42 x 2.24 x 1.75,
//                110 mm woofer + 25 mm dome tweeter + front-vented port
//   plinth       7.2 x 0.26 x 2.3
// So the amp is roughly a quarter the height of the speaker and the mic ball is
// a third of the amp's width — the real family resemblance.
//
// THE SIGNAL. One continuous arc-length path threads the whole chain: capsule
// coil -> down the mic body -> cable -> front input jack -> preamp -> driver
// stage -> output node between the two power transistors -> binding posts ->
// speaker cable -> voice coil. 240 instanced dots ride it as an oscilloscope
// trace whose ENVELOPE steps up at each gain stage and whose DOT SIZE steps up
// at the output stage (voltage vs current — the honest distinction). After the
// output stage each dot is tinted by polarity, matching whichever transistor
// produced that half of the wave. Amplitudes are compressed: the real jump from
// microphone to speaker level is more than a thousandfold and step 3 says so.
//
// SEAMLESS LOOPS. `phase` is measured in WAVE CYCLES and every step advances it
// by a whole number per lap, so the travelling wave, the diaphragm excursion,
// the cone excursion and both transistor glows (all derived from the same
// wave() function, one source of truth) return to an identical pose at the
// wrap. Sound-ring phases and the power-rail phase wrap mod 1; the turntable
// sway is a whole sine cycle.
//
// STATE — one object, one apply(). Every onEnter calls pin(), which resets
// EVERY scalar to its default before merging the step's values, so no step can
// inherit the previous step's mid-lap phase:
//   phase      travelling-wave phase, in cycles
//   sway       turntable angle (radians) — 0 on every macro step
//   signal     0..1 master visibility of the signal trace
//   rail       0..1 visibility of the steady power-rail current
//   railPhase  power-rail flow phase (mod 1)
//   wave       sound-ring emission phase (mod 1)
//   ringK      sound-ring scale multiplier (macro steps draw them smaller)
//   micWaves   incoming sound rings converging on the grille
//   spkWaves   outgoing sound rings leaving the cone
//   micCut     0 sealed .. 1 capsule sectioned on the mic axis
//   ampOpen    0 lid on .. 1 lid and near side wall removed
//   spkCut     0 sealed .. 1 cabinet and driver sectioned on the driver axis
//   power      mains LED on the faceplate

// ---------------------------------------------------------------------------
//  LAYOUT
// ---------------------------------------------------------------------------
const PLINTH_H = 0.26;

const MIC_X = -2.35;
const MIC_LEN = 1.62;
const BALL_R = 0.255;
const MIC_TILT_LEFT = THREE.MathUtils.degToRad(22); // leans toward the source
const MIC_TILT_FRONT = THREE.MathUtils.degToRad(12);

const AMP_X = -0.3;
const AMP_W = 2.0;
const AMP_H = 0.78;
const AMP_D = 1.8;

const SPK_X = 2.35;
const SPK_W = 1.42;
const SPK_H = 2.24;
const SPK_D = 1.75;
const WOOF_Y = 0.82; // driver axis height above the cabinet floor
const WOOF_R = 0.43; // 110 mm cone
const TWEET_Y = 1.78;
const PORT_Y = 0.3;

// signal-trace tuning
const N_DOTS = 340;
const CYCLES = 20; // wave cycles along the whole chain
const A_MIC = 0.03;
const A_LINE = 0.13;
const A_OUT = 0.11;
const DIA_EXC = 0.019; // drawn diaphragm excursion (microns in reality)
const CONE_EXC = 0.05;

const C_DIM = new THREE.Color(0x9ab4d0);
const C_LINE = new THREE.Color(0x8fd0ff);
const C_PUSH = new THREE.Color(0xffae63);
const C_PULL = new THREE.Color(0x63d6ff);
const C_RAIL = new THREE.Color(0xffd79a);

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = w / 2;
  const y = h / 2;
  s.moveTo(-x + r, -y);
  s.lineTo(x - r, -y);
  s.absarc(x - r, -y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x, y - r);
  s.absarc(x - r, y - r, r, 0, Math.PI / 2, false);
  s.lineTo(-x + r, y);
  s.absarc(-x + r, y - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-x, -y + r);
  s.absarc(-x + r, -y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

function circleHole(shape, cx, cy, r) {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, TAU, true);
  shape.holes.push(p);
}

// annulus revolved into a real ring (so a section cut reads as a ring, not a
// filled slab) — [inner, outer] radii between y0 and y1
function ringSolid(inner, outer, y0, y1, material, segments = 40) {
  const mesh = lathe(
    [
      [inner, y0],
      [outer, y0],
      [outer, y1],
      [inner, y1],
      [inner, y0],
    ],
    material,
    segments,
  );
  mesh.material.side = THREE.DoubleSide;
  return mesh;
}

// D-shaped TO-92 small-signal transistor body (flat front, domed top)
function to92Body(r, height, material) {
  const ring = (rr) => {
    const pts = [];
    const n = 22;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * 0.7 + (i / (n - 1)) * Math.PI * 1.4;
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    return pts;
  };
  return radialLoft(
    [
      { y: 0, points: ring(r) },
      { y: height * 0.8, points: ring(r) },
      { y: height * 0.95, points: ring(r * 0.82) },
      { y: height, points: ring(r * 0.3) },
    ],
    material,
    { capBottom: true, capTop: true },
  );
}

export function buildAudioChain({ scene, stage }) {
  const group = new THREE.Group();
  scene.add(group);
  if (stage?.renderer) stage.renderer.localClippingEnabled = true;

  // =========================================================================
  //  MATERIALS — one instance per assembly so the section-cut clipping planes
  //  never leak from the microphone onto the speaker (or vice versa).
  // =========================================================================
  const micBodyMat = materials.aluminum(0x8d939b);
  micBodyMat.roughness = 0.55;
  const micGrilleMat = materials.brushedSteel(0x9299a2);
  micGrilleMat.roughness = 0.5;
  const micFoamMat = materials.rubber(0x15181d);
  const micTrimMat = materials.polymer(0x1a1c20);
  const capsuleMat = materials.polymer(0x3a3f47);
  const micDiaMat = new THREE.MeshPhysicalMaterial({
    color: 0xd6dbe3,
    metalness: 0.1,
    roughness: 0.42,
    sheen: 0.4,
    sheenColor: new THREE.Color(0x9fb0c4),
    side: THREE.DoubleSide,
  });
  const micCoilMat = new THREE.MeshStandardMaterial({
    color: 0xc8813a,
    metalness: 0.85,
    roughness: 0.42,
    emissive: 0xc86a1e,
    emissiveIntensity: 0,
  });
  const micMagnetMat = new THREE.MeshPhysicalMaterial({
    color: 0x30343c,
    metalness: 0.2,
    roughness: 0.76,
  });
  const micPlateMat = new THREE.MeshPhysicalMaterial({
    color: 0xa2a9b2,
    metalness: 0.9,
    roughness: 0.5,
  });
  const micWireMat = materials.rubber(0x0e0f12);
  // Everything the section cut passes through renders DoubleSide, so the cut
  // face shows the part's interior instead of a hole into the background.
  for (const m of [
    micBodyMat,
    micGrilleMat,
    micTrimMat,
    capsuleMat,
    micCoilMat,
    micMagnetMat,
    micPlateMat,
    micWireMat,
  ]) {
    m.side = THREE.DoubleSide;
  }

  const chassisMat = materials.paintedMetal(0x33363d);
  chassisMat.clearcoat = 0.4;
  chassisMat.clearcoatRoughness = 0.34;
  chassisMat.roughness = 0.58;
  const faceMat = new THREE.MeshPhysicalMaterial({
    color: 0xb0b6be,
    metalness: 0.88,
    roughness: 0.44,
  });
  const knobMat = new THREE.MeshPhysicalMaterial({
    color: 0xc2c8d0,
    metalness: 0.75,
    roughness: 0.36,
  });
  const pcbMat = new THREE.MeshPhysicalMaterial({
    color: 0x1d4632,
    metalness: 0.05,
    roughness: 0.62,
  });
  const heatsinkMat = materials.aluminum(0x9ba2ab);
  heatsinkMat.roughness = 0.62;
  const capSleeveMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a2740,
    metalness: 0.15,
    roughness: 0.52,
  });
  const capTopMat = materials.brushedSteel(0x8d939a);
  capTopMat.roughness = 0.7;
  const copperMat = new THREE.MeshStandardMaterial({
    color: 0xc98338,
    metalness: 0.85,
    roughness: 0.4,
  });
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: 0x2a2c31,
    metalness: 0.3,
    roughness: 0.7,
  });
  const partMat = materials.polymer(0x191b1f);
  const resistorMat = new THREE.MeshPhysicalMaterial({
    color: 0xc0a678,
    metalness: 0.05,
    roughness: 0.6,
  });
  const leadMat = materials.brushedSteel(0xb9bec6);
  leadMat.roughness = 0.55;
  const pushMat = new THREE.MeshStandardMaterial({
    color: 0x17181c,
    metalness: 0.2,
    roughness: 0.58,
    emissive: 0xffae63,
    emissiveIntensity: 0,
  });
  const pullMat = new THREE.MeshStandardMaterial({
    color: 0x17181c,
    metalness: 0.2,
    roughness: 0.58,
    emissive: 0x63d6ff,
    emissiveIntensity: 0,
  });
  const preMat = new THREE.MeshStandardMaterial({
    color: 0x17181c,
    metalness: 0.2,
    roughness: 0.58,
    emissive: 0x8fd0ff,
    emissiveIntensity: 0,
  });
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0x8a6234,
    emissive: 0xd98a2e,
    emissiveIntensity: 0,
  });
  const redPostMat = materials.polymer(0x8e2620);
  const blackPostMat = materials.polymer(0x121316);

  const cabinetMat = materials.wood(0x5e4530);
  cabinetMat.roughness = 0.64;
  cabinetMat.clearcoat = 0.15;
  const baffleMat = new THREE.MeshPhysicalMaterial({
    color: 0x191b1e,
    metalness: 0.04,
    roughness: 0.58,
    clearcoat: 0.2,
    clearcoatRoughness: 0.5,
  });
  const linerMat = new THREE.MeshPhysicalMaterial({
    color: 0x121316,
    metalness: 0,
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  const coneMat = new THREE.MeshPhysicalMaterial({
    color: 0x484d55,
    metalness: 0,
    roughness: 0.92,
    sheen: 0.5,
    sheenColor: new THREE.Color(0x6b7076),
    side: THREE.DoubleSide,
  });
  const surroundMat = materials.rubber(0x131418);
  const spkBasketMat = materials.aluminum(0x686d75);
  spkBasketMat.roughness = 0.66;
  const spkPlateMat = new THREE.MeshPhysicalMaterial({
    color: 0x9198a1,
    metalness: 0.9,
    roughness: 0.52,
  });
  const spkMagnetMat = new THREE.MeshPhysicalMaterial({
    color: 0x1c1e23,
    metalness: 0.18,
    roughness: 0.78,
  });
  const spkCoilMat = new THREE.MeshStandardMaterial({
    color: 0xc8813a,
    metalness: 0.85,
    roughness: 0.42,
  });
  const cableMat = materials.rubber(0x0d0e11);
  const spkCableMat = materials.rubber(0x4c525c);
  for (const m of [
    cabinetMat,
    baffleMat,
    spkBasketMat,
    spkPlateMat,
    spkMagnetMat,
    spkCoilMat,
    surroundMat,
  ]) {
    m.side = THREE.DoubleSide;
  }

  // =========================================================================
  //  PLINTH
  // =========================================================================
  group.add(studioPlinth({ w: 7.2, h: PLINTH_H, d: 2.3, bevel: 0.07 }));

  // =========================================================================
  //  MICROPHONE
  // =========================================================================
  const micRoot = new THREE.Group();
  micRoot.position.set(MIC_X, PLINTH_H, 0);
  group.add(micRoot);

  // --- desk stand (never sectioned; it is scenery, not mechanism) -----------
  const standBase = disc(0.4, 0.05, chassisMat, 48);
  standBase.position.y = 0.025;
  const standCap = disc(0.3, 0.03, knobMat, 48);
  standCap.position.y = 0.058;
  micRoot.add(standBase, standCap);

  // --- the microphone itself, built along +Y from the butt ------------------
  const micGroup = new THREE.Group();
  micGroup.position.set(0, 0.56, 0);
  micGroup.rotation.set(MIC_TILT_FRONT, 0, MIC_TILT_LEFT);
  micRoot.add(micGroup);

  const handle = lathe(
    [
      [0.0, 0.0],
      [0.072, 0.006],
      [0.104, 0.028],
      [0.115, 0.1],
      [0.126, 0.4],
      [0.133, 0.8],
      [0.138, 0.98],
      [0.152, 1.04],
      [0.15, 1.1],
      [0.128, 1.12],
    ],
    micBodyMat,
    48,
  );
  micGroup.add(handle);

  // grip band + model ring, the two dark details every handheld mic carries
  const gripBand = ringSolid(0.128, 0.136, 0.46, 0.66, micTrimMat, 40);
  const collarRing = ringSolid(0.15, 0.158, 1.02, 1.06, micTrimMat, 40);
  micGroup.add(gripBand, collarRing);

  // XLR plug on the butt, where the cable goes in
  const plug = lathe(
    [
      [0.0, -0.26],
      [0.09, -0.26],
      [0.115, -0.23],
      [0.12, -0.05],
      [0.108, -0.02],
    ],
    micTrimMat,
    36,
  );
  micGroup.add(plug);

  // --- ball grille: real woven wire, meridians + latitudes ------------------
  const ballY = MIC_LEN - BALL_R;
  const grille = new THREE.Group();
  grille.position.y = ballY;
  micGroup.add(grille);
  for (let i = 0; i < 14; i++) {
    const wire = new THREE.Mesh(
      new THREE.TorusGeometry(BALL_R, 0.0075, 6, 56),
      micGrilleMat,
    );
    wire.rotation.y = (i * Math.PI) / 14;
    grille.add(wire);
  }
  for (const yy of [-0.17, -0.09, 0, 0.09, 0.17]) {
    const r = Math.sqrt(Math.max(0.0004, BALL_R * BALL_R - yy * yy));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0075, 6, 56), micGrilleMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = yy;
    grille.add(ring);
  }
  // Windscreen foam as a thin shell over only the TOP of the ball. A full
  // sphere — even hollow — is the one thing the section cut would ever show,
  // and it buries the capsule the step is about.
  const foamProfile = [];
  for (let i = 0; i <= 16; i++) {
    const a = 0.3 + (i / 16) * (Math.PI / 2 - 0.3);
    foamProfile.push([Math.cos(a) * 0.222, Math.sin(a) * 0.222]);
  }
  const foam = lathe(foamProfile, micFoamMat, 40);
  foam.material.side = THREE.DoubleSide;
  grille.add(foam);

  // --- capsule: the mechanism ----------------------------------------------
  const capsuleY = ballY - 0.05;
  const capsule = new THREE.Group();
  capsule.position.y = capsuleY;
  micGroup.add(capsule);

  const capsuleShell = ringSolid(0.172, 0.186, -0.14, 0.1, capsuleMat, 40);
  capsule.add(capsuleShell);

  const micBackPlate = lathe(
    [
      [0.0, -0.14],
      [0.186, -0.14],
      [0.186, -0.105],
      [0.0, -0.105],
    ],
    micPlateMat,
    40,
  );
  micBackPlate.material.side = THREE.DoubleSide;
  const micMagnet = ringSolid(0.116, 0.18, -0.105, -0.028, micMagnetMat, 40);
  const micTopPlate = ringSolid(0.116, 0.18, -0.028, 0.008, micPlateMat, 40);
  const micPole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.125, 28), micPlateMat);
  micPole.position.y = -0.068;
  capsule.add(micBackPlate, micMagnet, micTopPlate, micPole);

  // moving assembly: diaphragm + the coil glued to its underside
  const micMoving = new THREE.Group();
  capsule.add(micMoving);
  const diaphragm = lathe(
    [
      [0.0, 0.062],
      [0.058, 0.058],
      [0.11, 0.046],
      [0.15, 0.022],
      [0.168, 0.005],
      [0.176, 0.0],
    ],
    micDiaMat,
    48,
  );
  const micCoil = ringSolid(0.089, 0.104, -0.06, 0.006, micCoilMat, 36);
  const micFormer = ringSolid(0.086, 0.089, -0.06, 0.022, capsuleMat, 36);
  micMoving.add(diaphragm, micCoil, micFormer);

  // lead wires running down the handle to the plug
  for (const off of [-0.055, 0.055]) {
    const lead = tubeAlong(
      [
        [off * 0.6, capsuleY - 0.12, 0],
        [off, 0.85, 0.02],
        [off * 0.7, 0.35, -0.02],
        [off * 0.4, -0.04, 0],
      ],
      0.011,
      micWireMat,
      { tubularSegments: 40, radialSegments: 8 },
    );
    micGroup.add(lead);
  }

  // --- stand gooseneck + clip (built after the mic so it can reach it) -------
  micGroup.updateMatrixWorld(true);
  const clipLocalY = 0.42;
  const clipWorld = micGroup.localToWorld(new THREE.Vector3(0, clipLocalY, 0));
  const clipInRoot = micRoot.worldToLocal(clipWorld.clone());
  const gooseneck = tubeAlong(
    [
      [0, 0.07, 0],
      [0, clipInRoot.y * 0.34, -0.04],
      [clipInRoot.x * 0.5, clipInRoot.y * 0.68, clipInRoot.z * 0.4],
      [clipInRoot.x * 0.93, clipInRoot.y - 0.02, clipInRoot.z * 0.92],
    ],
    0.036,
    chassisMat,
    { tubularSegments: 48, radialSegments: 12 },
  );
  micRoot.add(gooseneck);
  const clipRing = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.032, 12, 40), micTrimMat);
  clipRing.rotation.x = Math.PI / 2;
  micGroup.add(clipRing);
  clipRing.position.y = clipLocalY;

  // --- incoming sound: rings converging on the grille ------------------------
  const micRings = new THREE.Group();
  micGroup.add(micRings);
  const micRingMeshes = [];
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.028, 10, 64),
      new THREE.MeshBasicMaterial({
        color: 0x8fd0ff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.userData.seed = i / 4;
    micRings.add(ring);
    micRingMeshes.push(ring);
  }

  // =========================================================================
  //  AMPLIFIER
  // =========================================================================
  const ampGroup = new THREE.Group();
  ampGroup.position.set(AMP_X, PLINTH_H, 0);
  group.add(ampGroup);

  const HX = AMP_W / 2;
  const HZ = AMP_D / 2;

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const foot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.062, 0.07, 0.04, 20),
        materials.rubber(0x121316),
      );
      foot.position.set(sx * 0.8, 0.02, sz * 0.7);
      ampGroup.add(foot);
    }
  }
  const ampFloor = beveledBox(AMP_W, 0.045, AMP_D, chassisMat, 0.015);
  ampFloor.position.y = 0.062;
  ampFloor.receiveShadow = true;
  ampGroup.add(ampFloor);

  // faceplate — always present, it is the amp's identity
  const faceplate = beveledBox(AMP_W + 0.03, 0.74, 0.05, faceMat, 0.018);
  faceplate.position.set(0, 0.42, HZ);
  ampGroup.add(faceplate);

  const volKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.15, 0.1, 40), knobMat);
  volKnob.rotation.x = Math.PI / 2;
  volKnob.position.set(0.66, 0.42, HZ + 0.075);
  const volMark = beveledBox(0.016, 0.07, 0.012, micTrimMat, 0.004);
  volMark.position.set(0.66, 0.53, HZ + 0.13);
  const srcKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.096, 0.08, 32), knobMat);
  srcKnob.rotation.x = Math.PI / 2;
  srcKnob.position.set(0.28, 0.42, HZ + 0.065);
  const powerSwitch = beveledBox(0.13, 0.09, 0.05, knobMat, 0.02);
  powerSwitch.position.set(-0.78, 0.28, HZ + 0.05);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 18, 14), ledMat);
  led.position.set(-0.78, 0.56, HZ + 0.035);
  ampGroup.add(volKnob, volMark, srcKnob, powerSwitch, led);

  // front XLR/combo input jack — a real recessed hole
  const jackShell = ringSolid(0.075, 0.108, 0, 0.055, micTrimMat, 32);
  jackShell.rotation.x = -Math.PI / 2;
  jackShell.position.set(-0.35, 0.42, HZ + 0.026);
  const jackWell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.1, 28, 1, true),
    micFoamMat,
  );
  jackWell.material.side = THREE.DoubleSide;
  jackWell.rotation.x = Math.PI / 2;
  jackWell.position.set(-0.35, 0.42, HZ - 0.02);
  ampGroup.add(jackShell, jackWell);
  const faceLiner = beveledBox(AMP_W - 0.09, 0.68, 0.02, partMat, 0.006);
  faceLiner.position.set(0, 0.42, HZ - 0.05);
  ampGroup.add(faceLiner);

  // --- lid: top + near side lift away on the internal steps ------------------
  const lidGroup = new THREE.Group();
  ampGroup.add(lidGroup);
  const topPanel = beveledBox(AMP_W, 0.035, AMP_D, chassisMat, 0.012);
  topPanel.position.set(0, AMP_H - 0.018, 0);
  const sideNear = beveledBox(0.035, 0.7, AMP_D, chassisMat, 0.012);
  sideNear.position.set(HX - 0.018, 0.41, 0);
  lidGroup.add(topPanel, sideNear);
  // vent slots in the lid
  for (let i = 0; i < 7; i++) {
    const slot = beveledBox(0.5, 0.012, 0.03, micFoamMat, 0.005);
    slot.position.set(0.28, AMP_H - 0.004, -0.5 + i * 0.1);
    lidGroup.add(slot);
  }

  const sideFar = beveledBox(0.035, 0.7, AMP_D, chassisMat, 0.012);
  sideFar.position.set(-HX + 0.018, 0.41, 0);
  const rearPanel = beveledBox(AMP_W - 0.06, 0.7, 0.035, chassisMat, 0.012);
  rearPanel.position.set(0, 0.41, -HZ + 0.018);
  ampGroup.add(sideFar, rearPanel);

  const mains = beveledBox(0.22, 0.17, 0.06, micTrimMat, 0.015);
  mains.position.set(-0.6, 0.26, -HZ + 0.02);
  ampGroup.add(mains);

  const postPlate = beveledBox(0.42, 0.2, 0.02, micTrimMat, 0.006);
  postPlate.position.set(0.66, 0.3, -HZ + 0.03);
  ampGroup.add(postPlate);
  const ampPosts = [];
  for (const [px, mat] of [
    [0.55, redPostMat],
    [0.77, blackPostMat],
  ]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.11, 20), mat);
    post.rotation.x = Math.PI / 2;
    post.position.set(px, 0.3, -HZ - 0.02);
    ampGroup.add(post);
    ampPosts.push(post);
  }

  // --- board and components -------------------------------------------------
  const pcb = beveledBox(1.8, 0.022, 1.54, pcbMat, 0.008);
  pcb.position.y = 0.096;
  ampGroup.add(pcb);

  // toroidal power transformer (left rear)
  const toroid = new THREE.Group();
  toroid.position.set(-0.55, 0.11, -0.42);
  ampGroup.add(toroid);
  const toroidCore = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.1, 20, 48), coreMat);
  toroidCore.rotation.x = Math.PI / 2;
  toroidCore.position.y = 0.11;
  toroid.add(toroidCore);
  const winding = coil(
    { toroidal: true, turns: 30, radius: 0.113, majorRadius: 0.25, wireRadius: 0.019, segmentsPerTurn: 12 },
    copperMat,
  );
  winding.mesh.position.y = 0.11;
  toroid.add(winding.mesh);
  const toroidClamp = disc(0.12, 0.03, spkPlateMat, 24);
  toroidClamp.position.y = 0.23;
  toroid.add(toroidClamp);

  // reservoir capacitors (left front)
  const capGroup = new THREE.Group();
  ampGroup.add(capGroup);
  for (const cz of [0.05, 0.38]) {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.32, 32), capSleeveMat);
    can.position.set(-0.7, 0.27, cz);
    can.castShadow = true;
    const top = disc(0.108, 0.02, capTopMat, 32);
    top.position.set(-0.7, 0.43, cz);
    const band = ringSolid(0.116, 0.12, 0.3, 0.4, micTrimMat, 28);
    band.position.set(-0.7, 0, cz);
    capGroup.add(can, top, band);
  }

  // small-signal stage: preamp transistor, coupling caps, resistors
  const preTransistor = to92Body(0.058, 0.115, preMat);
  preTransistor.position.set(-0.15, 0.107, 0.3);
  preTransistor.rotation.y = -0.5;
  ampGroup.add(preTransistor);
  for (const lx of [-0.03, 0, 0.03]) {
    const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 8), leadMat);
    lead.position.set(-0.15 + lx, 0.085, 0.3);
    ampGroup.add(lead);
  }
  const driverTransistor = to92Body(0.058, 0.115, partMat);
  driverTransistor.position.set(0.28, 0.107, 0.05);
  driverTransistor.rotation.y = 0.7;
  ampGroup.add(driverTransistor);

  for (const [cx, cz, ch] of [
    [0.02, 0.4, 0.16],
    [-0.02, 0.12, 0.13],
    [0.34, 0.3, 0.11],
  ]) {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, ch, 22), capSleeveMat);
    can.position.set(cx, 0.107 + ch / 2, cz);
    ampGroup.add(can);
  }
  for (const [rx, rz, rot] of [
    [-0.24, 0.34, 0.3],
    [0.1, 0.22, -0.4],
    [0.16, 0.4, 1.1],
    [0.44, 0.14, 0.2],
    [0.06, -0.06, -0.9],
    [0.42, 0.4, 0.6],
  ]) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.085, 14), resistorMat);
    body.rotation.z = Math.PI / 2;
    body.rotation.y = rot;
    body.position.set(rx, 0.13, rz);
    ampGroup.add(body);
    for (const bz of [-0.02, 0.004, 0.026]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0232, 0.0232, 0.008, 14), partMat);
      band.rotation.z = Math.PI / 2;
      band.rotation.y = rot;
      band.position.set(rx + Math.cos(rot) * bz, 0.13, rz - Math.sin(rot) * bz);
      ampGroup.add(band);
    }
  }

  // output stage: heatsink across the rear right, devices on its front face
  const heatsink = new THREE.Group();
  ampGroup.add(heatsink);
  const sinkPlate = beveledBox(0.82, 0.48, 0.05, heatsinkMat, 0.012);
  sinkPlate.position.set(0.52, 0.36, -0.52);
  heatsink.add(sinkPlate);
  for (let i = 0; i < 11; i++) {
    const fin = beveledBox(0.026, 0.46, 0.22, heatsinkMat, 0.006);
    fin.position.set(0.15 + i * 0.074, 0.36, -0.65);
    heatsink.add(fin);
  }

  const outputDevices = [];
  for (const [dx, mat] of [
    [0.32, pushMat],
    [0.72, pullMat],
  ]) {
    const dev = new THREE.Group();
    dev.position.set(dx, 0.36, -0.47);
    const body = beveledBox(0.21, 0.24, 0.038, mat, 0.01);
    const tab = beveledBox(0.21, 0.075, 0.026, spkPlateMat, 0.006);
    tab.position.y = 0.155;
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 12), leadMat);
    screw.rotation.x = Math.PI / 2;
    screw.position.set(0, 0.155, -0.02);
    dev.add(body, tab, screw);
    for (const lx of [-0.06, 0, 0.06]) {
      const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 8), leadMat);
      lead.position.set(lx, -0.19, 0);
      dev.add(lead);
    }
    ampGroup.add(dev);
    outputDevices.push(dev);
  }

  // =========================================================================
  //  SPEAKER
  // =========================================================================
  const spkGroup = new THREE.Group();
  spkGroup.position.set(SPK_X, PLINTH_H, 0);
  group.add(spkGroup);

  const SHX = SPK_W / 2;
  const SHZ = SPK_D / 2;
  const WALL = 0.06;

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.06, 0.03, 18),
        materials.rubber(0x121316),
      );
      pad.position.set(sx * 0.6, 0.015, sz * 0.78);
      spkGroup.add(pad);
    }
  }

  const cabTop = beveledBox(SPK_W, WALL, SPK_D, cabinetMat, 0.014);
  cabTop.position.y = SPK_H - WALL / 2 + 0.03;
  const cabBottom = beveledBox(SPK_W, WALL, SPK_D, cabinetMat, 0.014);
  cabBottom.position.y = 0.03 + WALL / 2;
  const cabLeft = beveledBox(WALL, SPK_H, SPK_D, cabinetMat, 0.014);
  cabLeft.position.set(-SHX + WALL / 2, SPK_H / 2 + 0.03, 0);
  const cabRight = beveledBox(WALL, SPK_H, SPK_D, cabinetMat, 0.014);
  cabRight.position.set(SHX - WALL / 2, SPK_H / 2 + 0.03, 0);
  const cabBack = beveledBox(SPK_W - 2 * WALL, SPK_H, WALL, cabinetMat, 0.014);
  cabBack.position.set(0, SPK_H / 2 + 0.03, -SHZ + WALL / 2);
  spkGroup.add(cabTop, cabBottom, cabLeft, cabRight, cabBack);

  // Interior lining — five panels, NOT a closed box: a front panel would hide
  // the motor the moment the cabinet is sectioned.
  const IW = SPK_W - 2 * WALL;
  const IH = SPK_H - 2 * WALL;
  const ID = SPK_D - 2 * WALL;
  const CY = SPK_H / 2 + 0.03;
  const linerPanels = [
    [IW, IH, 0.012, 0, CY, -SHZ + WALL + 0.008],
    [0.012, IH, ID, -SHX + WALL + 0.008, CY, 0],
    [0.012, IH, ID, SHX - WALL - 0.008, CY, 0],
    [IW, 0.012, ID, 0, CY + IH / 2 - 0.008, 0],
    [IW, 0.012, ID, 0, CY - IH / 2 + 0.008, 0],
  ];
  for (const [w, h, d, px, py, pz] of linerPanels) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), linerMat);
    panel.position.set(px, py, pz);
    spkGroup.add(panel);
  }

  // front baffle with REAL holes for the woofer, tweeter and port
  const baffleShape = roundedRectShape(SPK_W, SPK_H, 0.05);
  circleHole(baffleShape, 0, WOOF_Y - SPK_H / 2, WOOF_R + 0.03);
  circleHole(baffleShape, 0, TWEET_Y - SPK_H / 2, 0.135);
  circleHole(baffleShape, 0, PORT_Y - SPK_H / 2, 0.115);
  const baffle = new THREE.Mesh(
    new THREE.ExtrudeGeometry(baffleShape, {
      depth: WALL,
      bevelEnabled: false,
      curveSegments: 28,
    }),
    baffleMat,
  );
  baffle.geometry.translate(0, SPK_H / 2 + 0.03, SHZ - WALL);
  baffle.castShadow = true;
  spkGroup.add(baffle);

  // bass reflex port tube behind its hole
  const port = new THREE.Mesh(
    new THREE.CylinderGeometry(0.115, 0.115, 0.4, 28, 1, true),
    linerMat,
  );
  port.rotation.x = Math.PI / 2;
  port.position.set(0, PORT_Y, SHZ - 0.26);
  spkGroup.add(port);

  // tweeter
  const tweeterFace = ringSolid(0.086, 0.163, 0, 0.02, spkBasketMat, 40);
  tweeterFace.rotation.x = -Math.PI / 2;
  tweeterFace.position.set(0, TWEET_Y, SHZ - 0.01);
  const tweeterDome = new THREE.Mesh(new THREE.SphereGeometry(0.084, 28, 16), coneMat);
  tweeterDome.scale.z = 0.6;
  tweeterDome.position.set(0, TWEET_Y, SHZ - 0.03);
  const tweeterCan = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.14, 28), spkMagnetMat);
  tweeterCan.rotation.x = Math.PI / 2;
  tweeterCan.position.set(0, TWEET_Y, SHZ - 0.14);
  spkGroup.add(tweeterFace, tweeterDome, tweeterCan);

  // --- woofer: built along +Y then tipped so the axis points +Z -------------
  const woofer = new THREE.Group();
  woofer.rotation.x = Math.PI / 2;
  woofer.position.set(0, WOOF_Y, SHZ - WALL);
  spkGroup.add(woofer);

  // every driver dimension is a ratio of WOOF_R so the motor stays in
  // proportion if the cone size ever changes
  const WR = WOOF_R;
  const woofRim = new THREE.Mesh(new THREE.TorusGeometry(WR + 0.04, 0.036, 14, 56), spkBasketMat);
  woofRim.rotation.x = Math.PI / 2;
  woofer.add(woofRim);
  for (let i = 0; i < 4; i++) {
    const a = (i * TAU) / 4 + Math.PI / 4;
    const strut = beveledBox(0.065, WR * 1.0, 0.03, spkBasketMat, 0.01);
    strut.position.set(Math.cos(a) * WR * 0.62, -WR * 0.68, Math.sin(a) * WR * 0.62);
    strut.lookAt(Math.cos(a) * WR * 0.36, -WR * 1.24, Math.sin(a) * WR * 0.36);
    strut.rotateX(Math.PI / 2);
    woofer.add(strut);
  }

  const MAG_IN = WR * 0.35;
  const MAG_OUT = WR * 0.8;
  const woofTopPlate = ringSolid(MAG_IN, MAG_OUT, -WR * 1.44, -WR * 1.28, spkPlateMat, 44);
  const woofMagnet = ringSolid(MAG_IN, MAG_OUT, -WR * 1.8, -WR * 1.44, spkMagnetMat, 44);
  const woofBackPlate = lathe(
    [
      [0.0, -WR * 1.96],
      [MAG_OUT, -WR * 1.96],
      [MAG_OUT, -WR * 1.8],
      [0.0, -WR * 1.8],
    ],
    spkPlateMat,
    44,
  );
  woofBackPlate.material.side = THREE.DoubleSide;
  const woofPole = new THREE.Mesh(
    new THREE.CylinderGeometry(WR * 0.27, WR * 0.27, WR * 0.84, 32),
    spkPlateMat,
  );
  woofPole.position.y = -WR * 1.54;
  woofer.add(woofTopPlate, woofMagnet, woofBackPlate, woofPole);

  const woofMoving = new THREE.Group();
  woofer.add(woofMoving);
  const woofCone = lathe(
    [
      [WR * 0.29, -WR * 0.84],
      [WR * 0.5, -WR * 0.62],
      [WR * 0.72, -WR * 0.34],
      [WR * 0.93, -0.02],
    ],
    coneMat,
    56,
  );
  const woofDust = new THREE.Mesh(new THREE.SphereGeometry(WR * 0.296, 32, 18), coneMat);
  woofDust.scale.y = 0.52;
  woofDust.position.y = -WR * 0.84;
  const woofSurround = new THREE.Mesh(
    new THREE.TorusGeometry(WR * 0.984, WR * 0.076, 16, 56),
    surroundMat,
  );
  woofSurround.rotation.x = Math.PI / 2;
  woofSurround.position.y = -0.02;
  const woofFormer = ringSolid(WR * 0.29, WR * 0.304, -WR * 1.26, -WR * 0.8, micTrimMat, 36);
  const woofCoil = ringSolid(WR * 0.304, WR * 0.336, -WR * 1.24, -WR * 1.0, spkCoilMat, 36);
  woofMoving.add(woofCone, woofDust, woofSurround, woofFormer, woofCoil);

  // crossover board on the cabinet floor
  const xover = beveledBox(0.5, 0.02, 0.34, pcbMat, 0.006);
  xover.position.set(-0.2, 0.11, -0.55);
  const xoverCoil = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.032, 12, 28), copperMat);
  xoverCoil.rotation.x = Math.PI / 2;
  xoverCoil.position.set(-0.3, 0.15, -0.55);
  const xoverCap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 20), capSleeveMat);
  xoverCap.position.set(-0.08, 0.19, -0.55);
  spkGroup.add(xover, xoverCoil, xoverCap);

  // Input cup on the LEFT panel rather than the rear. Rear terminals are the
  // usual arrangement, but they bury the chain's most important handoff — the
  // powered signal crossing to the speaker — behind both boxes, where no front
  // camera can ever see it. Side cups are a real monitor arrangement and they
  // keep the run in frame. Still on the -x side, so the section cut leaves the
  // signal's entry point standing.
  const spkPostPlate = beveledBox(0.02, 0.2, 0.3, micTrimMat, 0.006);
  spkPostPlate.position.set(-SHX + 0.02, 0.26, 0.5);
  spkGroup.add(spkPostPlate);
  const spkPosts = [];
  for (const [pz, mat] of [
    [0.58, redPostMat],
    [0.42, blackPostMat],
  ]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.1, 20), mat);
    post.rotation.z = Math.PI / 2;
    post.position.set(-SHX - 0.02, 0.26, pz);
    spkGroup.add(post);
    spkPosts.push(post);
  }

  // outgoing sound rings
  const spkRings = new THREE.Group();
  spkGroup.add(spkRings);
  const spkRingMeshes = [];
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.022, 10, 64),
      new THREE.MeshBasicMaterial({
        color: 0x8fd0ff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.userData.seed = i / 4;
    spkRings.add(ring);
    spkRingMeshes.push(ring);
  }

  // =========================================================================
  //  CABLES + THE SIGNAL PATH
  // =========================================================================
  group.updateMatrixWorld(true);
  const toRoot = (obj, x, y, z) => group.worldToLocal(obj.localToWorld(new THREE.Vector3(x, y, z)));
  const A = (x, y, z) => toRoot(ampGroup, x, y, z).toArray();
  const S = (x, y, z) => toRoot(spkGroup, x, y, z).toArray();
  const Mp = (x, y, z) => toRoot(micGroup, x, y, z).toArray();

  const micCableStart = toRoot(micGroup, 0, -0.24, 0);
  const ampJack = toRoot(ampGroup, -0.35, 0.42, HZ + 0.02);
  const ampOutPost = toRoot(ampGroup, 0.66, 0.3, -HZ - 0.05);
  const spkPostIn = toRoot(spkGroup, -SHX - 0.07, 0.26, 0.5);

  const micCablePts = [
    micCableStart.toArray(),
    [micCableStart.x + 0.22, 0.4, micCableStart.z + 0.28],
    [-1.9, 0.29, 0.55],
    [-1.3, 0.29, 0.78],
    [-0.95, 0.42, 0.9],
    ampJack.toArray(),
  ];
  const micCable = tubeAlong(micCablePts, 0.032, cableMat, {
    tubularSegments: 90,
    radialSegments: 12,
  });
  group.add(micCable);

  const spkCablePts = [
    ampOutPost.toArray(),
    [0.66, 0.48, -0.5],
    [0.8, 0.44, 0.25],
    [0.92, 0.42, 0.85],
    [1.22, 0.44, 0.9],
    spkPostIn.toArray(),
  ];
  const spkCable = tubeAlong(spkCablePts, 0.044, spkCableMat, {
    tubularSegments: 80,
    radialSegments: 12,
  });
  group.add(spkCable);

  // Seven segments so the stage boundaries fall exactly on chainPath bounds:
  // 0 mic internal | 1 mic cable | 2 jack->preamp | 3 preamp->output node |
  // 4 output node->binding post | 5 speaker cable | 6 speaker internal
  const path = chainPath([
    [Mp(0, capsuleY - 0.05, 0), Mp(0.04, 1.0, 0.01), Mp(0.02, 0.5, -0.01), Mp(0, -0.2, 0)],
    micCablePts,
    [A(-0.35, 0.34, 0.72), A(-0.26, 0.28, 0.5), A(-0.15, 0.25, 0.3)],
    [A(-0.15, 0.25, 0.3), A(0.0, 0.36, 0.16), A(0.28, 0.42, 0.02), A(0.45, 0.45, -0.24), A(0.52, 0.45, -0.42)],
    [A(0.52, 0.45, -0.4), A(0.6, 0.4, -0.66), A(0.66, 0.34, -0.84)],
    spkCablePts,
    [S(-SHX + 0.03, 0.26, 0.5), S(-0.5, 0.42, 0.46), S(-0.3, 0.66, 0.4), S(-0.1, 0.8, 0.35), S(0, 0.82, 0.34)],
  ]);
  const S_PRE = path.bounds[2];
  const S_OUT = path.bounds[3];
  const S_CAB = path.bounds[5]; // the trace enters the cabinet here

  const ampAt = (s) => {
    if (s <= S_PRE) return A_MIC;
    if (s <= S_OUT) return A_MIC + (A_LINE - A_MIC) * smooth((s - S_PRE) / (0.26 * (S_OUT - S_PRE)));
    return A_LINE + (A_OUT - A_LINE) * smooth((s - S_OUT) / (0.2 * (1 - S_OUT)));
  };
  // dot SIZE is the current story (the output stage's real job), separate from
  // the envelope, which is the voltage story
  const sizeAt = (s) => {
    if (s <= S_PRE) return 0.55;
    if (s <= S_OUT) return 0.55 + 0.35 * smooth((s - S_PRE) / (0.26 * (S_OUT - S_PRE)));
    return 0.9 + 0.7 * smooth((s - S_OUT) / (0.2 * (1 - S_OUT)));
  };

  // Precompute the geometry of the trace once — only the sine moves per frame.
  const dotBase = [];
  const dotOff = [];
  const dotAmp = new Float32Array(N_DOTS);
  const dotSize = new Float32Array(N_DOTS);
  const dotPolar = new Float32Array(N_DOTS); // 0 = stage colour, 1 = polarity
  const dotStage = [];
  const AXIS_Z = new THREE.Vector3(0, 0, 1);
  const WORLD_UP = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < N_DOTS; i++) {
    const s = (i + 0.5) / N_DOTS;
    dotBase.push(path.getPointAt(s));
    const tan = path.getTangentAt(s);
    const off = WORLD_UP.clone().sub(tan.clone().multiplyScalar(tan.dot(WORLD_UP)));
    if (off.lengthSq() < 0.05) {
      // tangent is vertical (inside the mic body) — swing out sideways instead
      off.crossVectors(tan, AXIS_Z);
      if (off.lengthSq() < 1e-6) off.set(1, 0, 0);
    }
    off.normalize();
    dotOff.push(off);
    // Inside the cabinet the trace winds down to nothing: the current arrives
    // and is spent in the coil. Without this the full-size output trace reads
    // as marbles floating over the driver and buries the coil it feeds.
    const spent = smooth((s - S_CAB) / (1 - S_CAB));
    dotAmp[i] = ampAt(s) * (1 - 0.75 * spent);
    dotSize[i] = sizeAt(s) * (1 - 0.72 * spent);
    dotPolar[i] = clamp01((s - S_OUT) / (0.2 * (1 - S_OUT)));
    dotStage.push(s <= S_PRE ? C_DIM : C_LINE);
  }

  const dots = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.017, 10, 8),
    // NOT vertexColors: with USE_COLOR defined and no `color` geometry
    // attribute the shader multiplies vColor by zero and every dot renders
    // black. instanceColor drives the tint on its own.
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      toneMapped: false,
    }),
    N_DOTS,
  );
  dots.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N_DOTS * 3), 3);
  dots.frustumCulled = false;
  group.add(dots);

  // steady DC from the reservoir caps to the output devices — the contrast
  // that makes step 4 visibly true
  const railCurve = new THREE.CatmullRomCurve3(
    [
      toRoot(ampGroup, -0.55, 0.36, -0.42),
      toRoot(ampGroup, -0.72, 0.47, -0.06),
      toRoot(ampGroup, -0.6, 0.54, 0.3),
      toRoot(ampGroup, 0.1, 0.58, 0.24),
      toRoot(ampGroup, 0.45, 0.54, -0.18),
      toRoot(ampGroup, 0.52, 0.5, -0.42),
    ],
    false,
    'catmullrom',
    0.4,
  );
  const RAIL_LUT = 300;
  const railLut = [];
  for (let i = 0; i < RAIL_LUT; i++) railLut.push(railCurve.getPointAt(i / (RAIL_LUT - 1)));
  const N_RAIL = 40;
  const railDots = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.024, 10, 8),
    new THREE.MeshBasicMaterial({
      color: C_RAIL,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      toneMapped: false,
    }),
    N_RAIL,
  );
  railDots.frustumCulled = false;
  group.add(railDots);

  // =========================================================================
  //  SECTION CUTS
  // =========================================================================
  // Microphone: a plane containing the (tilted) mic axis, removing the half
  // nearest a front-right camera.
  const micAxis = micGroup
    .localToWorld(new THREE.Vector3(0, 1, 0))
    .sub(micGroup.localToWorld(new THREE.Vector3(0, 0, 0)))
    .normalize();
  const micNormal = new THREE.Vector3().crossVectors(micAxis, new THREE.Vector3(0, 1, 0)).normalize();
  if (micNormal.dot(new THREE.Vector3(0.45, 0, 0.89)) > 0) micNormal.negate();
  const micButtWorld = micGroup.localToWorld(new THREE.Vector3(0, 0, 0));
  const micPlane = new THREE.Plane(micNormal, -micNormal.dot(micButtWorld));

  // Speaker: vertical plane through the driver axis, removing the +x half.
  const spkPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), SPK_X);

  const micCutMeshes = [];
  micGroup.traverse((o) => {
    if (o.isMesh && o !== clipRing && !micRings.children.includes(o)) micCutMeshes.push(o);
  });
  const spkCutMeshes = [];
  spkGroup.traverse((o) => {
    if (o.isMesh && !spkRings.children.includes(o)) spkCutMeshes.push(o);
  });
  const setPlanes = (mesh, planes) => {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) m.clippingPlanes = planes;
  };

  // =========================================================================
  //  CALLOUTS
  // =========================================================================
  const labels = calloutSets(['chain', 'mic', 'pre', 'psu', 'power', 'spk']);

  // Offsets are in each parent's OWN frame: `grille` sits at the ball centre,
  // `capsule`'s children are measured from the capsule, `woofer`'s local +Y is
  // world +Z (the driver axis).
  labels.add('chain', grille, 'Microphone', [0.08, 0.14, 0.14], 62, 96);
  labels.add('chain', micCable, 'Mic cable', [-1.35, 0.29, 0.8], -58, 96);
  labels.add('chain', ampGroup, 'Amplifier', [0.15, 0.64, 0.92], 74, 92);
  labels.add('chain', spkGroup, 'Speaker', [0.5, 2.4, 0.95], 44, 92);
  labels.add('chain', spkCable, 'Speaker cable', [1.05, 0.43, 0.9], -74, 92);

  labels.add('mic', grille, 'Ball grille', [0.1, 0.18, 0.12], 76, 92);
  labels.add('mic', micMoving, 'Diaphragm', [0.1, 0.035, 0.03], 44, 104);
  labels.add('mic', micMoving, 'Voice coil', [0.09, -0.03, 0.0], -6, 116);
  labels.add('mic', micMagnet, 'Magnet', [0.15, -0.065, 0.0], -50, 104);

  labels.add('pre', ampGroup, 'Input jack', [-0.35, 0.42, HZ + 0.06], 112, 88);
  labels.add('pre', ampGroup, 'Preamp transistor', [-0.15, 0.24, 0.3], 54, 104);
  labels.add('pre', ampGroup, 'Coupling capacitor', [0.02, 0.3, 0.4], 12, 104);

  labels.add('psu', ampGroup, 'Power transformer', [-0.55, 0.36, -0.42], 116, 100);
  labels.add('psu', ampGroup, 'Reservoir capacitors', [-0.7, 0.46, 0.22], 68, 108);
  labels.add('psu', ampGroup, 'Supply rail', [0.1, 0.6, 0.24], 22, 96);

  labels.add('power', ampGroup, 'Push transistor (NPN)', [0.32, 0.52, -0.45], 124, 104);
  labels.add('power', ampGroup, 'Pull transistor (PNP)', [0.72, 0.2, -0.45], -48, 104);
  labels.add('power', ampGroup, 'Heatsink', [0.9, 0.55, -0.62], 26, 92);
  labels.add('power', ampGroup, 'Output node', [0.52, 0.45, -0.4], 58, 96);

  labels.add('spk', woofMoving, 'Cone', [0, -0.155, -0.3], 148, 88);
  labels.add('spk', woofCoil, 'Voice coil', [0, -0.53, -0.148], 34, 96);
  labels.add('spk', woofMagnet, 'Magnet', [0, -0.7, 0.3], -140, 92);

  // =========================================================================
  //  STATE
  // =========================================================================
  const DEFAULTS = {
    phase: 0,
    sway: 0,
    signal: 1,
    rail: 0,
    railPhase: 0,
    wave: 0,
    ringK: 1,
    micWaves: 0,
    spkWaves: 0,
    micCut: 0,
    ampOpen: 0,
    spkCut: 0,
    power: 1,
  };
  const st = { ...DEFAULTS };

  const mtx = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const vec = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const col = new THREE.Color();

  const wave = (s) => Math.sin(TAU * (CYCLES * s - st.phase));

  function apply() {
    group.rotation.y = st.sway;

    // --- reveal states ------------------------------------------------------
    lidGroup.visible = st.ampOpen < 0.5;
    const micPlanes = st.micCut > 0.5 ? [micPlane] : null;
    for (const m of micCutMeshes) setPlanes(m, micPlanes);
    const spkPlanes = st.spkCut > 0.5 ? [spkPlane] : null;
    for (const m of spkCutMeshes) setPlanes(m, spkPlanes);

    // --- one wave, every moving thing derived from it -----------------------
    micMoving.position.y = wave(0) * DIA_EXC;
    woofMoving.position.y = wave(1) * CONE_EXC;

    const wOut = wave(S_OUT);
    // class AB: a small quiescent current keeps BOTH devices just barely on,
    // so the handover has no notch in it. Kept low — bloom turns anything
    // above ~0.6 on a near-black package into a blown white square.
    pushMat.emissiveIntensity = 0.06 + Math.max(0, wOut) * 0.44;
    pullMat.emissiveIntensity = 0.06 + Math.max(0, -wOut) * 0.44;
    preMat.emissiveIntensity = 0.04 + Math.abs(wave(S_PRE)) * 0.28;
    micCoilMat.emissiveIntensity = Math.abs(wave(0)) * 0.22;
    ledMat.emissiveIntensity = st.power ? 0.22 : 0;

    // --- the signal trace ---------------------------------------------------
    quat.identity();
    for (let i = 0; i < N_DOTS; i++) {
      const s = (i + 0.5) / N_DOTS;
      const v = wave(s);
      const base = dotBase[i];
      const off = dotOff[i];
      const a = dotAmp[i] * v;
      vec.set(base.x + off.x * a, base.y + off.y * a, base.z + off.z * a);
      const k = dotSize[i] * (0.88 + 0.12 * Math.abs(v)) * st.signal;
      scl.set(k, k, k);
      mtx.compose(vec, quat, scl);
      dots.setMatrixAt(i, mtx);
      col.copy(dotStage[i]);
      if (dotPolar[i] > 0) col.lerp(v >= 0 ? C_PUSH : C_PULL, dotPolar[i]);
      dots.setColorAt(i, col);
    }
    dots.instanceMatrix.needsUpdate = true;
    dots.instanceColor.needsUpdate = true;

    for (let i = 0; i < N_RAIL; i++) {
      const t = (i / N_RAIL + st.railPhase) % 1;
      const p = railLut[Math.min(RAIL_LUT - 1, Math.floor(t * RAIL_LUT))];
      const k = st.rail;
      scl.set(k, k, k);
      mtx.compose(p, quat, scl);
      railDots.setMatrixAt(i, mtx);
    }
    railDots.instanceMatrix.needsUpdate = true;
    railDots.visible = st.rail > 0.01;

    // --- sound ---------------------------------------------------------------
    for (const ring of micRingMeshes) {
      const t = (st.wave + ring.userData.seed) % 1;
      const u = 1 - t; // 0 = far away, 1 = arriving at the grille
      const r = (0.3 + (1 - u) * 0.34) * st.ringK;
      ring.scale.setScalar(r);
      ring.position.y = ballY + BALL_R + 0.05 + (1 - u) * 0.72 * st.ringK;
      ring.material.opacity = st.micWaves ? 0.36 * Math.sin(Math.PI * u) : 0;
    }
    for (const ring of spkRingMeshes) {
      const t = (st.wave + ring.userData.seed) % 1;
      const r = (0.48 + t * 0.62) * st.ringK;
      ring.scale.setScalar(r);
      ring.position.set(0, WOOF_Y, SHZ + 0.08 + t * 1.15 * st.ringK);
      ring.material.opacity = st.spkWaves ? 0.26 * Math.sin(Math.PI * t) : 0;
    }
  }

  function set(o = {}) {
    Object.assign(st, o);
    apply();
  }
  function pin(o = {}) {
    Object.assign(st, DEFAULTS, o);
    apply();
  }

  pin({});

  return {
    group,
    state: st,
    set,
    pin,
    setLabels: labels.setLabels,
    parts: {
      micGroup,
      micMoving,
      diaphragm,
      micCoil,
      ampGroup,
      lidGroup,
      preTransistor,
      outputDevices,
      toroid,
      heatsink,
      spkGroup,
      woofer,
      woofMoving,
      dots,
      railDots,
    },
  };
}
