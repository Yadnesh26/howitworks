import * as THREE from 'three';
import { materials, rod } from '../../framework/parts.js';
import { lathe, finStack, tubeAlong, coil } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, smooth, win, TAU } from '../../framework/motion.js';

// A standard retractable ballpoint pen (145 mm x 10 mm real), floating at a
// natural product-shot tilt — no stand or plinth, just the pen.
//
// PROPORTIONS (user spec, 145mm x 10mm real): scale = 2.6 world units /
// 145mm = 0.01793 units/mm. Built along LOCAL +X (tip at x=0, cap at
// x=PEN_LEN), then the whole assembly is tilted for the camera.
//   tip cone 19mm -> TIP_LEN 0.34 · grip 35mm -> GRIP_LEN 0.62 ·
//   cap/click housing 22mm -> CAP_LEN 0.40 · barrel fills the remainder.
//   barrel dia 10mm -> BARREL_R 0.09 · grip slightly wider (user spec) ->
//   GRIP_R 0.10 · exposed ball ~1mm dia (user spec 0.7-1.0mm) -> BALL_R
//   0.013 (visually exaggerated ~2x from the true 0.009-unit equivalent —
//   an invisible sub-mm ball is pointless to model; disclosed here, not
//   silently fudged) · aperture bore slightly larger than the ball, 0.024.
//
// MECHANISM (researched — click-pen knock mechanism + ball-tip transfer):
// a bistable 8-point rotating cam. Press the button: the plunger pushes the
// cam down past 8 fixed stop teeth; a spring then pushes the cam back up,
// rotating it 45 degrees and re-engaging the stops in the OTHER of two
// possible lock depths — one holds the refill retracted, the other holds it
// extended. One press+release = 90 degrees of cam rotation; two full clicks
// (retract then extend) sweep 180 degrees, which is also documented to be
// exactly how far the real mechanism rotates the refill each time the pen
// is clicked (it evens out tip wear). The OUTER tip cone is a FIXED part of
// the steel/plastic shell; only the INNER refill (ball + ink tube + spring)
// slides through its aperture. At the tip, a free-spinning tungsten-carbide
// ball sits in a conical socket bathed in viscous ink; paper friction spins
// the ball, and capillary action wicks a thin ink film onto it each turn.
//
// SCALARS:
//   setCycle(u) — the canonical click lap (u 0-1): idle-extended -> press ->
//     retract -> idle-retracted -> press -> extend -> idle-extended (=u=0).
//     Cam angle sweeps a flat 180 deg/lap — seamless twice over: the pose
//     truly repeats (extended, at rest) AND the cam mesh's own 8-fold
//     symmetry (45 deg period) makes 180 deg indistinguishable from 0 deg
//     even if it didn't, exactly like the gearbox's symmetric flange trick.
//   setWrite(t) — independent ball-spin + growing/shrinking ink-stroke demo
//     for the tip macro step (own loop, disc-brakes' setCruise pattern).
//   setReveal(t) — 0 sealed pen / 1 barrel+grip+cap ghosted, internals shown.
//     The steel tip shroud, chrome clip and button are NOT part of this —
//     small parts at the opposite end from the cam mechanism, never in the
//     way, so they simply stay visible throughout (nothing to hide).
//   setLabels(mode) — 'exterior' | 'internal' | 'cam' | 'ink' | 'tip' | 'grip' | false

const SCALE = 2.6 / 145; // world units per real mm
const PEN_LEN = 2.6;
const TIP_LEN = 0.34;
const GRIP_LEN = 0.62;
const CAP_LEN = 0.4;
const BARREL_X0 = TIP_LEN + GRIP_LEN;
const BARREL_X1 = PEN_LEN - CAP_LEN;

const APERTURE_R = 0.024;
const GRIP_R = 0.1;
const BARREL_R = 0.09;
const CAP_R = 0.09;
const BALL_R = 0.013; // exaggerated ~2x, see header
const REFILL_R = 0.05;
const THROW = 0.13; // extend<->retract travel

const BUTTON_THROW = 0.024;
const CAM_X = PEN_LEN - 0.22; // cam/stop-ring position inside the cap
const CAM_R_OUT = 0.072;
const CAM_R_IN = 0.048;
const CAM_TEETH = 8;

export function buildPen({ scene }) {
  const sceneGroup = new THREE.Group();
  scene.add(sceneGroup);

  // --- materials --------------------------------------------------------------
  // lightened from a near-black 0x17181c/0x2a2d33 — against the studio's
  // black backdrop those read as an invisible silhouette in every wide shot
  const bodyPlastic = materials.paintedMetal(0x2e3138);
  bodyPlastic.clearcoat = 0.7;
  bodyPlastic.clearcoatRoughness = 0.2;
  const gripRubber = materials.rubber(0x3c4048);
  const tipSteel = materials.chrome(0xd7dce2);
  tipSteel.roughness = 0.16;
  const ballMat = materials.chrome(0xeef1f4);
  ballMat.roughness = 0.08;
  const clipMat = materials.chrome(0xd7dce2);
  clipMat.roughness = 0.2;
  const buttonMat = materials.paintedMetal(0x2e6bef);
  buttonMat.clearcoat = 0.8;
  const camMetal = materials.darkMetal(0x4a4f57);
  const stopMetal = materials.darkMetal(0x34383e);
  const springSteel = materials.steel(0xb9bec6);
  const inkTubeClear = new THREE.MeshPhysicalMaterial({
    color: 0xd6dee8,
    metalness: 0,
    roughness: 0.32, // higher than a glass 0.15 — sharp coat highlights blew past the clip gate
    transparent: true,
    opacity: 0.22, // clear enough that the blue ink column reads through it
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  // brighter than a true near-black ink so the reservoir actually reads as
  // "ink" through the translucent tube + ghosted barrel; slight emissive lift
  const inkFluid = new THREE.MeshPhysicalMaterial({
    color: 0x1e3fa6,
    metalness: 0,
    roughness: 0.3,
    emissive: 0x0a1740,
    emissiveIntensity: 0.6,
  });
  const paperMat = new THREE.MeshStandardMaterial({
    color: 0xf2f0e8,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  const inkDotMat = new THREE.MeshStandardMaterial({ color: 0x14245e, roughness: 0.4 });

  // pen assembly, tilted for a natural product-shot angle: local +X runs tip(0) -> cap(PEN_LEN)
  const TILT = 0.16; // ~9 degrees off horizontal
  const pen = new THREE.Group();
  pen.position.set(-1.15, 0.42, 0);
  pen.rotation.z = -TILT;
  sceneGroup.add(pen);

  const revealDim = []; // barrel/grip/cap plastic — ghost on reveal
  const internals = []; // cam, spring, ink tube, refill rear — shown only revealed

  // Stash each shell material's original coat/metalness so setReveal can zero
  // them while ghosted and restore them when sealed. Clearcoat renders at FULL
  // strength regardless of opacity (trap #2) — leaving it on made the ghosted
  // barrel/cap read as a solid glossy shell and hid the entire mechanism.
  const rememberGhostOrig = (mat) => {
    if (!mat.userData.ghostOrig) {
      mat.userData.ghostOrig = { clearcoat: mat.clearcoat ?? 0, metalness: mat.metalness ?? 0 };
    }
  };

  // helper: build a Y-axis lathe profile, then reorient so +Y -> local +X,
  // with y=0 landing at world-x = xOffset (tip-ward end of the profile)
  function axLathe(profile, mat, xOffset, segments = 40) {
    const mesh = lathe(profile, mat, segments);
    mesh.rotation.z = -Math.PI / 2; // +Y -> +X
    mesh.position.x = xOffset;
    return mesh;
  }

  // ============================================================================
  //  OUTER SHELL — tip cone (fixed, metal), grip, barrel, cap housing
  // ============================================================================
  // Tip: LatheGeometry is an open surface of revolution — ending the profile
  // at r=APERTURE_R (not r=0) leaves a genuine open bore at the apex, exactly
  // the "real hole, never a solid disc" rule. The ball pokes through it.
  const tip = axLathe(
    [
      [APERTURE_R, 0],
      [0.045, 0.05],
      [0.07, 0.16],
      [GRIP_R - 0.006, 0.29],
      [GRIP_R, TIP_LEN],
    ],
    tipSteel,
    0,
  );
  pen.add(tip);

  const grip = rod(GRIP_R, GRIP_LEN, gripRubber, 32);
  grip.rotation.z = -Math.PI / 2; // +Y -> +X (rotation.z=+PI/2 maps +Y to -X, not +X)
  grip.position.x = TIP_LEN;
  pen.add(grip);
  revealDim.push(grip);
  // shallow grip grooves (user spec: "shallow horizontal grooves for texture")
  const grooves = finStack(
    { count: 10, size: GRIP_R + 0.004, thickness: 0.012, gap: 0.045, shape: 'ring' },
    gripRubber,
  );
  grooves.rotation.z = -Math.PI / 2;
  grooves.position.x = TIP_LEN + 0.05;
  pen.add(grooves);
  // finStack() returns a GROUP (one mesh per fin), not a single mesh —
  // setReveal needs each child's own .material, not the group's (undefined)
  revealDim.push(...grooves.children);

  // small shoulder cone smoothing grip(0.10) -> barrel(0.09), no bare step
  const shoulder = axLathe(
    [
      [GRIP_R, 0],
      [BARREL_R, 0.05],
    ],
    bodyPlastic,
    BARREL_X0 - 0.05,
  );
  pen.add(shoulder);
  revealDim.push(shoulder);

  const barrel = rod(BARREL_R, BARREL_X1 - BARREL_X0, bodyPlastic, 32);
  barrel.rotation.z = -Math.PI / 2;
  barrel.position.x = BARREL_X0;
  pen.add(barrel);
  revealDim.push(barrel);

  // cap housing: rounded, with a recessed button cavity + clip mount
  const capHousing = axLathe(
    [
      [BARREL_R, 0],
      [CAP_R + 0.006, 0.03],
      [CAP_R + 0.006, CAP_LEN - 0.1],
      [0.05, CAP_LEN - 0.02],
      [0.038, CAP_LEN],
    ],
    bodyPlastic,
    BARREL_X1,
  );
  pen.add(capHousing);
  revealDim.push(capHousing);

  // clip: thin curved chrome strip, integrated into the cap, slight outward
  // bend near the barrel end for pocket-fabric clearance (user spec)
  const clipCurve = tubeAlong(
    [
      [BARREL_X1 + CAP_LEN - 0.05, 0.045, 0],
      [BARREL_X1 + 0.32, 0.11, 0],
      [BARREL_X1 - 0.02, 0.1, 0],
      [BARREL_X1 - 0.08, 0.075, 0],
    ],
    0.013,
    clipMat,
  );
  pen.add(clipCurve);

  // ============================================================================
  //  CLICK MECHANISM — 8-point star cam + fixed stop ring + button + spring
  // ============================================================================
  function starShape(rOuter, rInner, points) {
    const shape = new THREE.Shape();
    const n = points * 2;
    for (let i = 0; i < n; i++) {
      const r = i % 2 === 0 ? rOuter : rInner;
      const a = (i / n) * TAU;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
  }
  function starMesh(rOuter, rInner, points, thickness, holeR, mat) {
    const shape = starShape(rOuter, rInner, points);
    if (holeR > 0) {
      const hole = new THREE.Path();
      hole.absarc(0, 0, holeR, 0, TAU, true);
      shape.holes.push(hole);
    }
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelSegments: 1,
      curveSegments: 8,
    });
    geo.translate(0, 0, -thickness / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
  }

  // fixed stop ring (does not rotate)
  const stopRing = starMesh(CAM_R_OUT + 0.014, CAM_R_IN + 0.01, CAM_TEETH, 0.05, REFILL_R + 0.01, stopMetal);
  stopRing.rotation.y = Math.PI / 2; // local +Z -> world +X (axle)
  stopRing.position.x = CAM_X + 0.05;
  pen.add(stopRing);
  internals.push(stopRing);

  // rotating star cam
  const camGroup = new THREE.Group();
  camGroup.position.set(CAM_X, 0, 0);
  pen.add(camGroup);
  const cam = starMesh(CAM_R_OUT, CAM_R_IN, CAM_TEETH, 0.045, REFILL_R + 0.008, camMetal);
  cam.rotation.y = Math.PI / 2;
  camGroup.add(cam);
  internals.push(camGroup);

  // button: small dome sliding in the cap's recess, driven by the plunger
  const buttonGroup = new THREE.Group();
  buttonGroup.position.set(PEN_LEN + 0.005, 0, 0);
  pen.add(buttonGroup);
  const button = axLathe(
    [
      [0.037, 0],
      [0.06, 0.02],
      [0.065, 0.055],
      [0.05, 0.09],
      [0.001, 0.1],
    ],
    buttonMat,
    0,
  );
  buttonGroup.add(button);

  // plunger rod linking button to cam
  const plunger = rod(0.02, CAP_LEN - 0.06, stopMetal, 12);
  plunger.rotation.z = -Math.PI / 2;
  plunger.position.x = BARREL_X1 + 0.03;
  pen.add(plunger);
  internals.push(plunger);

  // spring: coil() around the refill's rear section, between the cam and a
  // fixed internal ridge near the grip end
  const springAsm = coil(
    { turns: 10, radius: REFILL_R + 0.012, length: CAM_X - (BARREL_X0 + 0.15), wireRadius: 0.006 },
    springSteel,
  );
  springAsm.mesh.rotation.z = -Math.PI / 2; // +Y -> +X
  springAsm.mesh.position.x = (BARREL_X0 + 0.15 + CAM_X) / 2;
  pen.add(springAsm.mesh);
  internals.push(springAsm.mesh);

  // ============================================================================
  //  REFILL — slides axially: ball+cone tip, ink tube (visible ink), rear stub
  // ============================================================================
  const refill = new THREE.Group();
  pen.add(refill);

  const refillTip = axLathe(
    [
      [BALL_R * 0.6, 0],
      [0.014, 0.04],
      [0.03, 0.12],
      [REFILL_R, 0.28],
    ],
    tipSteel,
    0,
  );
  refill.add(refillTip);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 20, 16), ballMat);
  ball.position.x = 0.005;
  refill.add(ball);

  const tubeLen = CAM_X - 0.34;
  const inkTubeOuter = rod(REFILL_R, tubeLen, inkTubeClear, 20);
  inkTubeOuter.rotation.z = -Math.PI / 2;
  inkTubeOuter.position.x = 0.3;
  refill.add(inkTubeOuter);
  const inkFluidMesh = rod(REFILL_R - 0.01, tubeLen - 0.06, inkFluid, 20);
  inkFluidMesh.rotation.z = -Math.PI / 2;
  inkFluidMesh.position.x = 0.33;
  refill.add(inkFluidMesh);
  internals.push(inkTubeOuter, inkFluidMesh);

  const refillRear = rod(REFILL_R - 0.006, 0.1, stopMetal, 16);
  refillRear.rotation.z = -Math.PI / 2;
  refillRear.position.x = CAM_X - 0.02;
  refill.add(refillRear);
  internals.push(refillRear);

  // ============================================================================
  //  WRITING DEMO — small paper card + a growing ink stroke of tiny dots
  // ============================================================================
  // The card is WORLD-space (its own group, not parented to the tilted pen)
  // and turned to face the raised tip-step camera — the old version faced -X
  // and was single-sided, so it (and the whole ink line) was backface-culled
  // and invisible. Hidden except in the tip step (showPaper), or a white card
  // would float by the tip in every wide shot.
  const writeGroup = new THREE.Group();
  writeGroup.position.set(-1.12, 0.29, 0.16);
  writeGroup.rotation.x = -0.72; // lean the card back toward the camera
  writeGroup.rotation.z = 0.12;
  writeGroup.visible = false;
  sceneGroup.add(writeGroup);

  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.3), paperMat);
  paper.receiveShadow = true;
  writeGroup.add(paper);

  const STROKE_PTS = 32;
  const strokeDots = [];
  for (let i = 0; i < STROKE_PTS; i++) {
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.006, 10), inkDotMat.clone());
    dot.material.transparent = true;
    dot.material.opacity = 0;
    dot.material.depthWrite = false;
    const t = i / (STROKE_PTS - 1);
    dot.position.set(0.05 - t * 0.28, 0.04 - Math.sin(t * Math.PI * 2.4) * 0.03, 0.003);
    writeGroup.add(dot);
    strokeDots.push(dot);
  }

  // ============================================================================
  //  CALLOUTS
  // ============================================================================
  const labels = calloutSets(['exterior', 'internal', 'cam', 'ink', 'tip', 'grip']);
  // dir = screen degrees (0=right, 90=up); anchors on the LEFT half of a wide
  // frame lead rightward to clear the text panel (left ~38% of the viewport).
  labels.add('exterior', pen, 'Barrel', [BARREL_X0 + 0.5, BARREL_R + 0.02, 0], 62, 66);
  labels.add('exterior', pen, 'Grip', [TIP_LEN + 0.52, GRIP_R + 0.03, 0], 72, 88);
  labels.add('exterior', pen, 'Steel tip', [0.1, APERTURE_R + 0.05, 0.03], -14, 235);
  labels.add('exterior', pen, 'Clip', [BARREL_X1 + 0.2, 0.13, 0], 62, 62);
  labels.add('exterior', pen, 'Click button', [PEN_LEN + 0.02, 0.11, 0], 58, 72);

  // reveal step — the three sub-machines, anchored on the RIGHT half so they
  // clear the panel; the refill's own sliding gets its dedicated ink step
  labels.add('internal', pen, '8-point cam', [CAM_X, 0.14, 0.05], 58, 80);
  labels.add('internal', pen, 'Return spring', [1.745, 0.12, 0], 92, 66);
  labels.add('internal', pen, 'Ink tube', [1.35, 0.11, 0], 90, 78);

  // cam macro (down-axis oblique on the cap) — reads the star + press
  labels.add('cam', pen, 'Rotating cam', [CAM_X - 0.02, 0.12, 0.05], 65, 66);
  labels.add('cam', pen, 'Fixed stop teeth', [CAM_X + 0.07, 0.12, -0.05], 20, 78);
  labels.add('cam', pen, 'Plunger', [BARREL_X1 + 0.16, 0.07, 0], 120, 58);
  labels.add('cam', pen, 'Click button', [PEN_LEN + 0.02, 0.11, 0], 62, 70);

  // ink macro — mid-body tube; both anchors on the RIGHT half, leading up
  labels.add('ink', pen, 'Ink reservoir', [1.55, 0.1, 0], 88, 76);
  labels.add('ink', pen, 'Refill slides to extend/retract', [0.95, 0.09, 0.03], 40, 120);

  labels.add('tip', pen, 'Tungsten-carbide ball', [0.02, 0.05, 0.02], 40, 90);
  labels.add('tip', pen, 'Conical socket', [0.16, 0.09, 0], 90, 62);
  labels.add('tip', pen, 'Ink film on paper', [0.02, -0.11, 0.12], -35, 90);

  // grip macro — the clip lives at the far cap end (covered in the exterior
  // step); this step is the grip, so both labels sit ON the grip
  labels.add('grip', pen, 'TPE rubber grip', [TIP_LEN + 0.4, GRIP_R + 0.03, 0], 60, 90);
  labels.add('grip', pen, 'Shallow grip grooves', [TIP_LEN + 0.14, GRIP_R + 0.02, 0.04], 15, 150);

  // ============================================================================
  //  POSE
  // ============================================================================
  // click windows, fractions of one lap (mirrors disc-brakes' W_* pattern)
  const W = {
    press1: [0.0, 0.08],
    retract: [0.08, 0.28],
    release1: [0.28, 0.38],
    press2: [0.5, 0.58],
    extend: [0.58, 0.78],
    release2: [0.78, 0.88],
  };

  function setCycle(uRaw) {
    const u = ((uRaw % 1) + 1) % 1;
    // cam: flat 180 deg/lap — seamless both physically (idle pose repeats)
    // and geometrically (8-fold symmetry every 45 deg)
    camGroup.rotation.x = u * Math.PI;

    // button: down during press+hold windows, up otherwise
    const bp =
      win(u, W.press1[0], W.press1[1]) -
      win(u, W.release1[0], W.release1[1]) +
      win(u, W.press2[0], W.press2[1]) -
      win(u, W.release2[0], W.release2[1]);
    const press = clamp01(bp); // 0 at rest (u=0/1) -> seamless
    buttonGroup.position.x = PEN_LEN + 0.005 - BUTTON_THROW * press;
    plunger.position.x = BARREL_X1 + 0.03 - BUTTON_THROW * press; // plunger follows the button
    // cam gets shoved toward the tip on press, spring returns it — the visible
    // axial "clunk" of the click, on top of the 45-deg-per-press rotation
    camGroup.position.x = CAM_X - BUTTON_THROW * 0.75 * press;

    // refill: 0 (extended) -> THROW (retracted) -> 0 (extended)
    const retractedFrac = win(u, W.retract[0], W.retract[1]) * (1 - win(u, W.extend[0], W.extend[1]));
    const x = THROW * retractedFrac;
    refill.position.x = x;

    // stroke/ball spin idle while not actively demoing writing (see setWrite)
  }

  function setReveal(t) {
    const r = clamp01(t);
    const op = 1 - r * 0.9; // 1 -> 0.10 (low enough that dark internals read through)
    const ghosted = r > 0.02;
    for (const m of revealDim) {
      const mat = m.material;
      rememberGhostOrig(mat);
      const o = mat.userData.ghostOrig;
      mat.transparent = ghosted;
      mat.opacity = op;
      mat.depthWrite = r < 0.4;
      // kill the coat + most of the metalness while ghosted — a glossy metallic
      // shell stays opaque-looking at any opacity (trap #2/#3); restore sealed
      mat.clearcoat = ghosted ? 0 : o.clearcoat;
      mat.metalness = ghosted ? o.metalness * 0.15 : o.metalness;
    }
    for (const o of internals) o.visible = r > 0.4;
  }

  function setWrite(t) {
    // triangle wave: draws the stroke then erases it — never leaves a stale
    // half-drawn line hanging between loop laps (state hygiene)
    const tri = t < 0.5 ? smooth(t / 0.5) : smooth(1 - (t - 0.5) / 0.5);
    strokeDots.forEach((d, i) => {
      const frac = i / (strokeDots.length - 1);
      d.material.opacity = frac <= tri ? 0.85 : 0;
    });
    ball.rotation.z = t * TAU * 6; // rolling spin, whole turns per lap upstream
  }

  function setLabels(mode) {
    labels.setLabels(mode);
  }

  // the writing card shows only in the tip step (see index.js) — otherwise a
  // white plane would float beside the tip in every wide shot
  function showPaper(v) {
    writeGroup.visible = v;
  }

  // initial: complete, sealed, extended, idle
  setReveal(0);
  setCycle(0.95);
  setWrite(0);
  setLabels(false);
  showPaper(false);

  return {
    group: sceneGroup,
    setCycle,
    setWrite,
    setReveal,
    setLabels,
    showPaper,
    parts: { pen, camGroup, buttonGroup, refill, ball, strokeDots },
  };
}
