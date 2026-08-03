import * as THREE from 'three';
import { materials, rod, disc, studioPlinth } from '../../framework/parts.js';
import { beveledBox, tubeAlong } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, TAU } from '../../framework/motion.js';

// A pair of over-ear ANC headphones resting on a display stand — studio
// product shot. The right earcup is the "hero": its outer shell ghosts away
// on reveal to expose the driver, the two ANC microphones, and a small PCB.
//
// MECHANISM (researched — SoundGuys ANC-types guide, Audio-Technica
// feedforward/feedback explainer, Headphonesty driver-types guide):
// A FEEDFORWARD mic sits on the earcup's OUTER shell, facing away from the
// ear — it catches ambient noise before it reaches the ear, the DSP inverts
// it 180 degrees, and the driver plays that "anti-noise" a fraction ahead of
// the real sound arriving. A FEEDBACK mic sits on the INNER shell, facing the
// eardrum — it continuously monitors what actually leaks through and
// fine-tunes the anti-noise in a tighter, faster local loop (it corrects for
// imperfect fit, at the cost of reacting to noise already almost at the ear).
// HYBRID ANC = both combined, standard on premium headphones. Cancellation is
// literal destructive interference: inverted + original waveform sum to
// near-silence where they meet. The SAME dynamic driver (magnet + copper
// voice coil + diaphragm) plays the music AND the anti-noise, summed. ANC
// only works well on LOW, slow-changing sound (engine drone, HVAC hum,
// roughly 20Hz-1kHz) — long wavelengths tolerate the mic-to-driver timing
// error. High frequencies (voices, clinks) change too fast for the DSP loop,
// so those are stopped the old way: the foam ear-cushion physically sealing
// against the head, like an earplug (passive isolation).
// Sources: soundguys.com/noise-canceling-anc-explained-28344,
// audio-technica.com (feedforward/feedback), headphonesty.com driver guide.
//
// PROPORTIONS (world units, 1 unit ~ 100mm):
//   earcup: 95mm oval puck (radius 0.475, taller than wide), 36mm thick.
//   headband span (cup-to-cup): 190mm. 40mm dynamic driver (diaphragm
//   radius 0.2) with a copper voice-coil torus + magnet cylinder behind it.
//   Ear-cushion torus rings the inner rim of every cup.
//
// STATE the pose is built from:
//   setReveal(t) — 0 sealed (both earcup shells solid) / 1 the hero (right)
//     earcup's outer shell ghosts away, exposing the driver, both ANC mics,
//     and a small PCB. Clearcoat is zeroed while ghosted (coat specular is
//     opacity-independent — the mixer-grinder lesson).
//   setPhase(u) — master 0-1 loop (wraps seamlessly): diaphragm micro-
//     vibration; an incoming ambient-noise wave (orange dots, outside-in)
//     and an anti-noise wave (cyan dots, driver-out) both converge on a
//     "meeting point" near the ear and flash-cancel there; the feedforward
//     mic pulses right as a new noise wave spawns, the feedback mic pulses
//     just after the meeting (checking the residual).
//   setBlocked(on) — adds a second, shorter noise-wave stream that stops
//     dead at the cushion (absorbed) instead of reaching the meeting point —
//     the "passive isolation stops the highs" step.
//   setLabels(mode) — 'exterior' | 'driver' | 'feedforward' | 'antinoise' |
//     'feedback' | 'passive' | false

// --- layout (world units; scene sits on the y=0 shadow floor) --------------
const PLINTH_H = 0.22;
const STAND_H = 1.5; // pole height from plinth top to where the headband rests
const HALF_SPAN = 0.95; // earcup center to center = 190mm
const EARCUP_R = 0.475; // 95mm
const EARCUP_T = 0.36; // 36mm thick
const SLIDER_X = HALF_SPAN * 0.86;
const SLIDER_TOP_Y = 0.46;
const ARC_APEX_Y = SLIDER_TOP_Y + 0.34;

const NOISE_COLOR = 0xff6a45; // warm — ambient noise
const ANTI_COLOR = 0x33ccff; // cyan (accent) — anti-noise / DSP

// Lathe profile for a rounded oval "puck" earcup: axis starts along Y
// (radius vs depth), reoriented to X after construction, then squeezed
// taller-than-wide for a more headphone-like oval silhouette.
function earcupGeometry(R, depth, segments = 40) {
  const d2 = depth / 2;
  const pts = [
    new THREE.Vector2(0.0, -d2 + 0.015),
    new THREE.Vector2(R * 0.55, -d2),
    new THREE.Vector2(R * 0.92, -d2 + depth * 0.06),
    new THREE.Vector2(R, 0),
    new THREE.Vector2(R * 0.92, d2 - depth * 0.06),
    new THREE.Vector2(R * 0.55, d2),
    new THREE.Vector2(0.0, d2 - 0.015),
  ];
  const geo = new THREE.LatheGeometry(pts, segments);
  geo.rotateZ(Math.PI / 2); // axis Y -> X
  geo.scale(1, 1.08, 1); // slightly taller than wide
  return geo;
}

export function buildHeadphones({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  const plinth = studioPlinth({ w: 2.7, h: PLINTH_H, d: 1.5 });
  group.add(plinth);

  // --- materials ---------------------------------------------------------------
  const standMat = materials.paintedMetal(0x16181c);
  // paintedMetal's default clearcoat (1.0, roughness 0.14) is a sharp mirror
  // coat — fine on large curved panels but a thin cylindrical pole catches it
  // as a hard specular streak the full length of the rod. Soften to match
  // studioPlinth()'s already-verified numbers.
  standMat.clearcoat = 0.45;
  standMat.clearcoatRoughness = 0.32;
  const sliderMat = materials.brushedSteel(0xb7bcc3);
  sliderMat.roughness = 0.55; // brushedSteel's default reads near-chrome up close; widen the highlight
  const shellMat = materials.polymer(0x1d1f24);
  const headbandPadMat = materials.polymer(0x232529);
  const cushionMat = materials.rubber(0x141416);
  const diaphragmMat = new THREE.MeshStandardMaterial({ color: 0x2a2d32, roughness: 0.85, metalness: 0.05 });
  const coilMat = new THREE.MeshPhysicalMaterial({ color: 0xc9814a, metalness: 1, roughness: 0.6 });
  const magnetMat = materials.darkMetal(0x2c2f34);
  const pcbMat = new THREE.MeshStandardMaterial({ color: 0x17321c, roughness: 0.7, metalness: 0.08 });
  const ffMicMat = new THREE.MeshStandardMaterial({
    color: 0x0c0d0f,
    emissive: NOISE_COLOR,
    emissiveIntensity: 0.2,
    roughness: 0.55,
    metalness: 0.3,
  });
  const fbMicMat = new THREE.MeshStandardMaterial({
    color: 0x0c0d0f,
    emissive: ANTI_COLOR,
    emissiveIntensity: 0.2,
    roughness: 0.55,
    metalness: 0.3,
  });

  // everything that turns on the stand (not the plinth) — gives the sealed
  // overview/finale bookend steps a showroom turntable loop since nothing
  // else animates while the shell is sealed.
  const spinGroup = new THREE.Group();
  group.add(spinGroup);

  // --- stand ---------------------------------------------------------------------
  const pole = rod(0.045, STAND_H, standMat);
  pole.position.y = PLINTH_H;
  spinGroup.add(pole);
  const foot = disc(0.42, 0.03, standMat, 48);
  foot.position.y = PLINTH_H + 0.015;
  spinGroup.add(foot);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 16, 0, TAU, 0, Math.PI / 2), standMat);
  cap.position.y = PLINTH_H + STAND_H;
  spinGroup.add(cap);

  // --- headphone assembly ---------------------------------------------------------
  const hpGroup = new THREE.Group();
  hpGroup.position.y = PLINTH_H + STAND_H - ARC_APEX_Y;
  spinGroup.add(hpGroup);

  // headband: outer metal arc + a shorter padded cushion strip underneath
  const archPts = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = -SLIDER_X + t * (2 * SLIDER_X);
    const y = SLIDER_TOP_Y + Math.sin(t * Math.PI) * (ARC_APEX_Y - SLIDER_TOP_Y);
    archPts.push([x, y, 0]);
  }
  const headbandOuter = tubeAlong(archPts, 0.028, sliderMat, { tubularSegments: 100, radialSegments: 14 });
  hpGroup.add(headbandOuter);
  const padPts = archPts.slice(2, -2).map(([x, y, z]) => [x, y - 0.055, z]);
  const headbandPad = tubeAlong(padPts, 0.024, headbandPadMat, { tubularSegments: 80, radialSegments: 12 });
  hpGroup.add(headbandPad);

  // slider rods + yoke pivots (yoke gets its own rougher material — a small
  // curved chrome ball concentrates a hot specular highlight at macro camera
  // distance far more than the slim rod does)
  const yokeMat = materials.brushedSteel(0xb7bcc3);
  yokeMat.roughness = 0.7;
  for (const side of [-1, 1]) {
    const sx = side * SLIDER_X;
    const sliderRod = tubeAlong(
      [
        [sx, SLIDER_TOP_Y, 0],
        [side * HALF_SPAN, 0.12, 0],
      ],
      0.02,
      sliderMat,
      { tubularSegments: 20, radialSegments: 10 },
    );
    hpGroup.add(sliderRod);
    const yoke = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 12), yokeMat);
    yoke.position.set(side * HALF_SPAN, 0.12, 0);
    hpGroup.add(yoke);
  }

  // ============================================================================
  //  EARCUPS
  // ============================================================================
  const earcupGeo = earcupGeometry(EARCUP_R, EARCUP_T);
  const cushionGeo = new THREE.TorusGeometry(EARCUP_R * 0.82, 0.045, 14, 40);

  function buildEarcup(centerX, isHero) {
    const innerSign = centerX > 0 ? -1 : 1; // direction from cup center toward the ear-facing face
    const g = new THREE.Group();
    g.position.set(centerX, 0, 0);
    hpGroup.add(g);

    const shellMatInst = isHero ? materials.polymer(0x1d1f24) : shellMat;
    const shell = new THREE.Mesh(earcupGeo, shellMatInst);
    shell.castShadow = true;
    shell.receiveShadow = true;
    g.add(shell);

    const cushion = new THREE.Mesh(cushionGeo, cushionMat);
    cushion.rotation.y = Math.PI / 2;
    cushion.position.x = innerSign * (EARCUP_T / 2 - 0.015);
    g.add(cushion);

    const mod = { group: g, shell, shellOrigClearcoat: shellMatInst.clearcoat, centerX, innerSign, isHero };

    if (isHero) {
      const driverX = innerSign * (EARCUP_T / 2 - 0.11);

      const magnet = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.05, 24), magnetMat);
      magnet.rotation.z = Math.PI / 2;
      magnet.position.x = driverX - innerSign * 0.05;
      magnet.visible = false;
      g.add(magnet);

      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 10, 32), coilMat);
      coil.rotation.y = Math.PI / 2;
      coil.position.x = driverX - innerSign * 0.015;
      coil.visible = false;
      g.add(coil);

      const diaphragmGeo = new THREE.SphereGeometry(0.2, 28, 16, 0, TAU, 0, Math.PI * 0.5);
      const diaphragm = new THREE.Mesh(diaphragmGeo, diaphragmMat);
      diaphragm.rotation.z = innerSign > 0 ? -Math.PI / 2 : Math.PI / 2;
      const diaphragmBaseX = driverX + innerSign * 0.02;
      diaphragm.position.x = diaphragmBaseX;
      diaphragm.visible = false;
      g.add(diaphragm);

      const ffMic = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.008, 12), ffMicMat);
      ffMic.rotation.z = Math.PI / 2;
      ffMic.position.set(-innerSign * (EARCUP_T / 2 + 0.002), EARCUP_R * 0.55, EARCUP_R * 0.2);
      ffMic.visible = false;
      g.add(ffMic);

      const fbMic = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.008, 12), fbMicMat);
      fbMic.rotation.z = Math.PI / 2;
      fbMic.position.set(driverX + innerSign * 0.02, 0.16, 0.06);
      fbMic.visible = false;
      g.add(fbMic);

      const pcb = beveledBox(0.15, 0.1, 0.02, pcbMat, 0.004);
      pcb.rotation.y = Math.PI / 2;
      pcb.position.set(0, -0.2, 0.06);
      pcb.visible = false;
      g.add(pcb);

      Object.assign(mod, {
        driverX,
        diaphragmBaseX,
        magnet,
        coil,
        diaphragm,
        ffMic,
        fbMic,
        pcb,
        internals: [magnet, coil, diaphragm, ffMic, fbMic, pcb],
      });
    }

    return mod;
  }

  const leftCup = buildEarcup(-HALF_SPAN, false);
  const heroCup = buildEarcup(HALF_SPAN, true);

  // ============================================================================
  //  WAVE VISUALIZATION — noise in, anti-noise out, they meet and cancel
  // ============================================================================
  const OUTER_FAR_X = -heroCup.innerSign * 0.3;
  const CUSHION_X = heroCup.innerSign * (EARCUP_T / 2 - 0.01);
  const MEETING_X = heroCup.innerSign * (EARCUP_T / 2 + 0.12);

  function makeWaveDots(count, color, size) {
    const dots = [];
    const geo = new THREE.SphereGeometry(size, 10, 8);
    for (let i = 0; i < count; i++) {
      const mat = materials.glow(color, 0.8);
      mat.transparent = true;
      mat.opacity = 0;
      mat.depthWrite = false;
      const d = new THREE.Mesh(geo, mat);
      heroCup.group.add(d);
      dots.push(d);
    }
    function update(phase, fromX, toX, yz, on) {
      dots.forEach((d, i) => {
        if (!on) {
          d.material.opacity = 0;
          return;
        }
        const t = (((phase + i / count) % 1) + 1) % 1;
        d.position.set(fromX + (toX - fromX) * t, yz[0], yz[1]);
        d.material.opacity = 0.9 * Math.sin(Math.PI * t);
      });
    }
    return { update };
  }

  const noiseWave = makeWaveDots(4, NOISE_COLOR, 0.015);
  const antiWave = makeWaveDots(3, ANTI_COLOR, 0.014);
  const blockedWave = makeWaveDots(3, NOISE_COLOR, 0.014);

  const cancelFlash = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), materials.glow(0xdff6ff, 0.9));
  cancelFlash.material.transparent = true;
  cancelFlash.material.opacity = 0;
  cancelFlash.material.depthWrite = false;
  cancelFlash.position.set(MEETING_X, 0, 0);
  heroCup.group.add(cancelFlash);

  // ============================================================================
  //  CALLOUTS
  // ============================================================================
  const labels = calloutSets(['exterior', 'driver', 'feedforward', 'antinoise', 'feedback', 'passive']);

  labels.add('exterior', hpGroup, 'Earcup', [HALF_SPAN + EARCUP_R * 0.15, -0.15, EARCUP_R * 0.15], -15, 118);
  labels.add('exterior', hpGroup, 'Headband slider', [SLIDER_X * 0.85, SLIDER_TOP_Y * 0.7, 0.02], -55, 90);

  labels.add('driver', heroCup.group, 'Diaphragm', [heroCup.diaphragmBaseX, 0.12, 0.08], 35, 85);
  labels.add('driver', heroCup.group, 'Voice coil', [heroCup.driverX, -0.13, 0.09], -35, 85);
  labels.add('driver', heroCup.group, 'Magnet', [heroCup.driverX - heroCup.innerSign * 0.05, 0, -0.1], 160, 90);

  labels.add('feedforward', heroCup.group, 'Feedforward mic — outward-facing', heroCup.ffMic.position.toArray(), 45, 110);
  labels.add('feedforward', heroCup.group, 'Incoming ambient noise', [OUTER_FAR_X * 0.55, 0.05, 0], -30, 90);

  labels.add('antinoise', heroCup.group, 'Anti-noise — inverted wave', [heroCup.driverX * 0.4, -0.14, 0], -40, 100);
  labels.add('antinoise', heroCup.group, 'Destructive interference', [MEETING_X, 0.1, 0.05], 40, 100);

  labels.add('feedback', heroCup.group, 'Feedback mic — inward-facing', heroCup.fbMic.position.toArray(), -55, 100);
  labels.add('feedback', heroCup.group, 'Residual noise correction', [MEETING_X, -0.08, -0.06], -30, 100);

  labels.add('passive', heroCup.group, 'Ear cushion — passive seal', [CUSHION_X, EARCUP_R * 0.55, EARCUP_R * 0.4], 40, 100);
  labels.add('passive', heroCup.group, 'Foam seal blocks the highs', [CUSHION_X, EARCUP_R * 0.2, EARCUP_R * 0.55], -30, 100);
  labels.add('passive', heroCup.group, 'Electronics cancel the lows', [MEETING_X, -0.1, 0.06], -35, 100);

  // ============================================================================
  //  POSE
  // ============================================================================
  let currentReveal = 0;
  let blockedOn = false;
  let waveMode = 'off'; // 'off' | 'noise' | 'full' — builds up with the story

  function setSpin(deg) {
    spinGroup.rotation.y = THREE.MathUtils.degToRad(deg);
  }

  function setWaveMode(mode) {
    waveMode = mode;
  }

  function setReveal(t) {
    const r = clamp01(t);
    currentReveal = r;
    const ghosted = r > 0.02;
    const mat = heroCup.shell.material;
    mat.transparent = ghosted;
    mat.opacity = 1 - r * 0.92;
    mat.depthWrite = r < 0.4;
    mat.clearcoat = ghosted ? 0 : heroCup.shellOrigClearcoat;
    const shown = r > 0.5;
    for (const o of heroCup.internals) o.visible = shown;
  }

  function setBlocked(on) {
    blockedOn = on;
  }

  let ffIntro = false;
  let fbIntro = false;
  function setMicIntro(ff, fb) {
    ffIntro = ff;
    fbIntro = fb;
  }

  function setPhase(u) {
    const p = ((u % 1) + 1) % 1;
    const revealed = currentReveal > 0.5;

    heroCup.diaphragm.position.x = heroCup.diaphragmBaseX + Math.sin(p * TAU * 6) * 0.006;

    // baseline glow + pulse only once a mic has actually been introduced —
    // otherwise it reads as an unexplained out-of-focus colored blob in the
    // driver/reveal steps, well before the step that names it (reviewer,
    // cycle 1: confirmed via live scene probe that the mics — not the wave
    // dots — were the stray glow source).
    const ffPulse = ffIntro ? Math.max(0, 1 - Math.min(Math.abs(p - 0), Math.abs(p - 1)) / 0.12) : 0;
    ffMicMat.emissiveIntensity = ffIntro ? 0.2 + 1.8 * ffPulse : 0;
    const fbPulse = fbIntro ? Math.max(0, 1 - Math.abs(p - 0.1) / 0.12) : 0;
    fbMicMat.emissiveIntensity = fbIntro ? 0.2 + 1.8 * fbPulse : 0;

    const showNoise = revealed && (waveMode === 'noise' || waveMode === 'full');
    const showFull = revealed && waveMode === 'full';
    noiseWave.update(p, OUTER_FAR_X, MEETING_X, [0, 0], showNoise);
    antiWave.update(p, heroCup.driverX, MEETING_X, [0, 0], showFull);
    blockedWave.update(p, OUTER_FAR_X, CUSHION_X, [0.1, 0.04], showFull && blockedOn);

    const flashT = Math.min(Math.abs(p - 0), Math.abs(p - 1));
    cancelFlash.material.opacity = showFull ? Math.max(0, 1 - flashT / 0.08) * 0.85 : 0;
  }

  // ============================================================================
  //  INITIAL STATE
  // ============================================================================
  setReveal(0);
  setWaveMode('off');
  setMicIntro(false, false);
  setPhase(0);
  setBlocked(false);
  setSpin(0);
  labels.setLabels(false);

  return {
    group,
    setReveal,
    setPhase,
    setBlocked,
    setWaveMode,
    setMicIntro,
    setSpin,
    setLabels: labels.setLabels,
    parts: { group, hpGroup, heroGroup: heroCup.group, leftGroup: leftCup.group },
  };
}
