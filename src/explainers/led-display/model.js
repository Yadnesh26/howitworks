import * as THREE from 'three';
import { materials, rod, box, studioPlinth } from '../../framework/parts.js';
import { beveledBox } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, smooth, win, TAU } from '../../framework/motion.js';

// A modular LED video wall on a ground-support stand — presented as a studio
// product shot. Front-serviceable: one module pulls straight off its
// blind-mate mount and turns around to show the electronics normally hidden
// behind it.
//
// MECHANISM (researched — DOIT Vision driver-IC guide, Planar scan-ratio
// article, PCBSync module/pitch guide):
// A wall is built from CABINETS, each holding a grid of MODULES, each module
// a PCB carrying a grid of SMD RGB LED packages (3 dies per pixel) plus
// constant-current driver ICs (16-channel shift-register class, e.g.
// MBI5124). Driver ICs shift serial pixel data in, latch it, then row-select
// transistors light one ROW-GROUP at a time (scan ratio — e.g. 1/4 scan =
// 4 of 16 rows driven together) cycling thousands of times a second; too
// fast to see, so persistence of vision reads it as a steady full image.
// Brightness per die is PWM: the die is switched fully on/off in tiny
// slices, and the on:off ratio (duty cycle) sets perceived brightness
// (8-16 bit, up to ~3840 Hz refresh on premium ICs). Color is additive
// mixing of the 3 fixed-hue dies at proportional PWM intensity — at normal
// viewing distance the eye can't resolve them as separate dots. Fine-pitch
// modules mount to the cabinet frame magnetically / via blind-mate
// connectors so a technician can pop one off the FRONT for service. A
// receiving card on the cabinet's backplate feeds each module's driver ICs;
// cabinets daisy-chain from a sending card / video processor upstream.
// Sources: doitvision.com/led-screen-driver-ics, planar.com (scan ratio),
// pcbsync.com/led-display-module-pcb.
//
// PROPORTIONS (world units, 1 unit ~ 480mm):
//   module 160x160x35mm real -> 0.333 x 0.333 x 0.085 units (16x16 px @
//   P10 = 10mm pitch); cabinet 480x480x80mm -> 1.0 x 1.0 x 0.17 units (3x3
//   modules = 48x48 px); wall = 2x2 cabinets, 96x96 px, ~960mm square.
//
// STATE the pose is built from:
//   setContent(u, includeHero) — loops a moving rainbow "content" pattern
//     across every module's pixel grid (mod 1, seamless); includeHero=false
//     lets scan/PWM steps own the hero module's dies instead.
//   setReveal(u) — ONE lap: hero module slides off its mount, turns to show
//     its back, holds, turns back, and re-seats — fully seamless (u=0 and
//     u=1 are identical: seated, front-facing). Dims the hero module's dies
//     while detached (no data feed) and reveals the cabinet cavity behind it.
//   setHeroPose(pop, turnDeg) — raw pin for steps that hold the module
//     statically detached (anatomy / scan / PWM / data-path steps).
//   setScan(phase) — hero module only: cycles which row-group is "on" +
//     a marching data-in dot along the top edge (mod 1, seamless).
//   setPWM(phase) — hero module only: sweeps every pixel through a duty-cycle
//     color sequence that starts and ends on the same color (seamless),
//     demonstrating additive R/G/B mixing.
//   setLabels(mode) — 'exterior' | 'pixels' | 'reveal' | 'anatomy' | 'scan' |
//     'color' | 'data' | false

// --- layout (world units; scene sits on the y=0 shadow floor) --------------
const PLINTH_H = 0.22;
const CAB = 1.0; // cabinet width/height (480mm)
const CAB_D = 0.17; // cabinet depth (80mm)
const MODS = 3; // modules per cabinet edge (3x3)
const MOD = CAB / MODS; // module width/height (~0.333, 160mm)
const MOD_D = 0.085; // module depth (35mm)
const PX = 16; // pixels per module edge (16x16 @ P10 = 10mm pitch)
const PXP = MOD / PX; // pixel pitch (~0.0208)
const CABS_X = 2;
const CABS_Y = 2;
const WALL_W = CAB * CABS_X;
const WALL_H = CAB * CABS_Y;
const WALL_BOTTOM = 0.85; // wall's bottom edge height off the floor
const WALL_FRONT_Z = CAB_D / 2;
const FRAME_T = 0.045;
const DIE_FLOOR = 0.035; // unlit-die floor brightness (reads as dark package, not a void)
const POP_DIST = 0.55; // how far the hero module slides out when detached

const HERO_CAB = { cx: 1, cy: 1 }; // top-right cabinet
const HERO_MOD = { mx: 1, my: 1 }; // its center module

function rainbow(t) {
  const tt = ((t % 1) + 1) % 1;
  return [
    0.5 + 0.5 * Math.sin(TAU * tt),
    0.5 + 0.5 * Math.sin(TAU * (tt + 1 / 3)),
    0.5 + 0.5 * Math.sin(TAU * (tt + 2 / 3)),
  ];
}
function contentColor(wx, wy, u) {
  return rainbow((wx * 0.55 + wy * 0.34) * 0.4 + u);
}
function chan(v) {
  return DIE_FLOOR + clamp01(v) * (1 - DIE_FLOOR);
}

export function buildLedDisplay({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  const plinth = studioPlinth({ w: 3.1, h: PLINTH_H, d: 1.7 });
  group.add(plinth);

  // --- materials --------------------------------------------------------------
  const frameMat = materials.paintedMetal(0x101115);
  frameMat.roughness = 0.6;
  const pcbMat = new THREE.MeshStandardMaterial({ color: 0x2b3326, roughness: 0.62, metalness: 0.15 });
  const trimMat = materials.brushedSteel(0x9aa2ab);
  // legs/braces are slender cylinders in the periphery of every shot (never
  // frame-filling at macro distance) — the safe anisotropy case per the
  // air-conditioner tubing precedent. rotation=PI/2 rotates the brushing
  // grain off the cylinder's default U-wrap onto V (along the rod's length).
  const legMat = materials.anisoSteel(0x8a919b, Math.PI / 2);
  const footMat = materials.paintedMetal(0x1b1d21);
  const icMat = materials.polymer(0x17181c);
  const capMat = materials.darkMetal(0x2c2f34);
  const pinMat = new THREE.MeshPhysicalMaterial({ color: 0xe8c988, metalness: 1, roughness: 0.28 });
  const connHousingMat = materials.polymer(0x565d66);
  const cardMat = new THREE.MeshStandardMaterial({ color: 0x2a8a4f, roughness: 0.55, metalness: 0.15 });
  const portMat = materials.darkMetal(0x1a1c1f);
  const cableMat = materials.rubber(0x0b0c0e);
  const statusGlow = materials.glow(0x4dffa0, 1.4);
  const dataGlow = materials.glow(0xffe27a, 1.8);
  const dieMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  // flat PLANES, not boxes — a box's own side walls are what caught screen-
  // space AO into a radiating moiré fan on the wide shots (confirmed: near-
  // zero-gap boxes killed it, planes remove the cause outright since there's
  // no side wall for AO to shade). That freed the fill factor back up for a
  // pixel big and distinct enough to actually read as "a pixel" up close.
  const dieGeo = new THREE.CircleGeometry(PXP * 0.27, 10);
  // regular (non-hero) modules render one BLENDED quad per pixel instead of 3
  // separate dies — from normal viewing distance the 3 dies are unresolvable
  // anyway (that IS the mechanism), but rendering them as 3 discrete instanced
  // planes aliases into visual static at wide/wall-scale shots. The hero
  // module keeps the true 3-die geometry for the macro color-mixing steps.
  // CIRCLE not square: square edges align with the screenshot's raster grid
  // at this tiling frequency and beat into moiré on the wide shots; a round
  // lens (also closer to how a real diffused LED package actually looks)
  // breaks that alignment while keeping the same visible pixel size.
  const pixelGeo = new THREE.CircleGeometry(PXP * 0.45, 10);

  // --- stand -------------------------------------------------------------------
  for (const lx of [-WALL_W / 2 + 0.16, WALL_W / 2 - 0.16]) {
    const leg = rod(0.036, WALL_BOTTOM - PLINTH_H + 0.06, legMat);
    leg.position.set(lx, PLINTH_H, 0);
    group.add(leg);
    const foot = beveledBox(0.16, 0.03, 0.55, footMat, 0.012);
    foot.position.set(lx, PLINTH_H + 0.015, 0);
    group.add(foot);
    const brace = rod(0.022, 0.64, legMat, 12);
    brace.position.set(lx, PLINTH_H, -0.2);
    brace.rotation.x = -0.42;
    group.add(brace);
  }

  // --- outer frame ---------------------------------------------------------------
  const fTop = beveledBox(WALL_W + FRAME_T * 2, FRAME_T, CAB_D + 0.03, frameMat, 0.012);
  fTop.position.set(0, WALL_BOTTOM + WALL_H + FRAME_T / 2, 0);
  const fBottom = beveledBox(WALL_W + FRAME_T * 2, FRAME_T, CAB_D + 0.03, frameMat, 0.012);
  fBottom.position.set(0, WALL_BOTTOM - FRAME_T / 2, 0);
  const fLeft = beveledBox(FRAME_T, WALL_H, CAB_D + 0.03, frameMat, 0.012);
  fLeft.position.set(-WALL_W / 2 - FRAME_T / 2, WALL_BOTTOM + WALL_H / 2, 0);
  const fRight = beveledBox(FRAME_T, WALL_H, CAB_D + 0.03, frameMat, 0.012);
  fRight.position.set(WALL_W / 2 + FRAME_T / 2, WALL_BOTTOM + WALL_H / 2, 0);
  group.add(fTop, fBottom, fLeft, fRight);

  // ============================================================================
  //  MODULES — a PCB + a 16x16 grid of pixels, each pixel 3 fixed-hue dies
  // ============================================================================
  const allModules = [];
  let heroMod = null;

  function buildModule(originX, originY, isHero) {
    const g = new THREE.Group();
    g.position.set(originX, originY, WALL_FRONT_Z);
    group.add(g);

    const board = beveledBox(MOD * 0.985, MOD * 0.985, MOD_D, pcbMat, 0.006);
    board.position.z = -MOD_D / 2;
    g.add(board);

    // hero gets BOTH a triad mesh (3 dies/pixel, for the macro color-mixing
    // steps) and a blended mesh (1 quad/pixel, so it matches its 35 siblings
    // when seated and doesn't read as a mismatched patch in the wide shots);
    // setHeroPose toggles which one is visible. Regular modules only need
    // the blended mesh.
    const dieMesh = isHero ? new THREE.InstancedMesh(dieGeo, dieMat, PX * PX * 3) : null;
    const pixelMesh = new THREE.InstancedMesh(pixelGeo, dieMat, PX * PX);
    for (const mesh of [dieMesh, pixelMesh]) {
      if (!mesh) continue;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    }
    const m4 = new THREE.Matrix4();
    let idx = 0;
    let pidx = 0;
    for (let row = 0; row < PX; row++) {
      for (let col = 0; col < PX; col++) {
        const lx = -MOD / 2 + (col + 0.5) * PXP;
        const ly = -MOD / 2 + (row + 0.5) * PXP;
        if (isHero) {
          for (let k = 0; k < 3; k++) {
            const ox = (k - 1) * PXP * 0.36;
            m4.makeTranslation(lx + ox, ly, 0.009);
            dieMesh.setMatrixAt(idx, m4);
            idx++;
          }
        }
        m4.makeTranslation(lx, ly, 0.007);
        pixelMesh.setMatrixAt(pidx, m4);
        pidx++;
      }
    }
    pixelMesh.instanceMatrix.needsUpdate = true;
    g.add(pixelMesh);
    if (isHero) {
      dieMesh.instanceMatrix.needsUpdate = true;
      dieMesh.visible = false;
      g.add(dieMesh);
    }

    const mod = { group: g, dieMesh, pixelMesh, originX, originY, isHero };

    if (isHero) {
      // a light metal rim just behind the board: invisible from the front
      // (the board occludes it), but becomes the outlining silhouette once
      // the module turns 180 to show its back — otherwise the near-black
      // board blends straight into the void when it's floating detached.
      const trimBack = beveledBox(MOD * 1.04, MOD * 1.04, 0.012, trimMat, 0.008);
      trimBack.position.z = -MOD_D - 0.002;
      g.add(trimBack);

      const icGroup = new THREE.Group();
      icGroup.position.z = -MOD_D - 0.011;
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          const ic = beveledBox(0.05, 0.03, 0.014, icMat, 0.004);
          ic.position.set((c - 1) * 0.09, (r - 0.5) * 0.06, 0);
          icGroup.add(ic);
        }
      }
      g.add(icGroup);

      const capsGroup = new THREE.Group();
      for (const [cx2, cy2] of [
        [-0.12, 0.1],
        [-0.06, 0.1],
        [0.1, -0.11],
        [0.14, -0.11],
      ]) {
        const cap = rod(0.012, 0.032, capMat, 12);
        cap.rotation.x = Math.PI / 2;
        cap.position.set(cx2, cy2, -MOD_D - 0.032);
        capsGroup.add(cap);
      }
      g.add(capsGroup);

      // a light housing shroud behind the pins — the gold pins alone read as
      // a few nearly-invisible dots against the near-black board; a lighter
      // plastic block gives the connector a silhouette so it reads as ONE
      // labeled part, with the pins themselves sitting proud on its face.
      const connGroup = new THREE.Group();
      connGroup.position.z = -MOD_D - 0.008;
      const connHousing = beveledBox(0.11, 0.065, 0.012, connHousingMat, 0.006);
      connHousing.position.z = -0.004;
      connGroup.add(connHousing);
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 4; c++) {
          const pin = beveledBox(0.017, 0.017, 0.016, pinMat, 0.003);
          pin.position.set(-0.0285 + c * 0.019, (r - 0.5) * 0.028, 0.008);
          connGroup.add(pin);
        }
      }
      g.add(connGroup);

      const status = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), statusGlow);
      status.position.set(0.1, 0.11, -MOD_D - 0.006);
      g.add(status);

      const dataDot = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), dataGlow);
      dataDot.visible = false;
      g.add(dataDot);

      mod.icGroup = icGroup;
      mod.capsGroup = capsGroup;
      mod.connGroup = connGroup;
      mod.dataDot = dataDot;
    }

    return mod;
  }

  for (let cx = 0; cx < CABS_X; cx++) {
    for (let cy = 0; cy < CABS_Y; cy++) {
      const cabX0 = -WALL_W / 2 + cx * CAB;
      const cabY0 = WALL_BOTTOM + cy * CAB;
      for (let mx = 0; mx < MODS; mx++) {
        for (let my = 0; my < MODS; my++) {
          const isHero = cx === HERO_CAB.cx && cy === HERO_CAB.cy && mx === HERO_MOD.mx && my === HERO_MOD.my;
          const originX = cabX0 + mx * MOD + MOD / 2;
          const originY = cabY0 + my * MOD + MOD / 2;
          const mod = buildModule(originX, originY, isHero);
          allModules.push(mod);
          if (isHero) heroMod = mod;
        }
      }
    }
  }

  // ============================================================================
  //  CABINET CAVITY — receiving card + PSU behind the hero module's slot
  // ============================================================================
  const heroCabX = -WALL_W / 2 + HERO_CAB.cx * CAB + CAB / 2;
  const heroCabY = WALL_BOTTOM + HERO_CAB.cy * CAB + CAB / 2;
  const internalsGroup = new THREE.Group();
  internalsGroup.position.set(heroCabX, heroCabY, WALL_FRONT_Z - CAB_D + 0.02);
  group.add(internalsGroup);

  const backplate = beveledBox(CAB * 0.92, CAB * 0.92, 0.012, pcbMat, 0.006);
  backplate.position.z = -0.02;
  internalsGroup.add(backplate);

  // both parts sized/positioned to stay well inside the module-sized opening
  // the hero module leaves behind (+-MOD/2 = +-0.167) — the cavity is only
  // as wide as the ONE missing module, not the whole cabinet, so anything
  // further out is clipped by the neighboring (still-seated) modules.
  const card = beveledBox(0.2, 0.13, 0.022, cardMat, 0.006);
  card.position.set(0, -0.06, 0.025);
  internalsGroup.add(card);
  const port1 = beveledBox(0.045, 0.028, 0.018, portMat, 0.004);
  port1.position.set(-0.06, -0.03, 0.038);
  internalsGroup.add(port1);
  const port2 = beveledBox(0.045, 0.028, 0.018, portMat, 0.004);
  port2.position.set(0.06, -0.03, 0.038);
  internalsGroup.add(port2);
  const cardLed = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), statusGlow);
  cardLed.position.set(0, 0.005, 0.038);
  internalsGroup.add(cardLed);

  const psu = beveledBox(0.13, 0.11, 0.075, trimMat, 0.01);
  psu.position.set(-0.1, 0.09, 0.045);
  internalsGroup.add(psu);

  const cable1 = rod(0.012, 0.14, cableMat, 10);
  cable1.rotation.z = Math.PI / 2;
  cable1.position.set(-0.03, -0.06, 0.025);
  internalsGroup.add(cable1);
  const cable2 = rod(0.01, 0.1, cableMat, 10);
  cable2.rotation.x = Math.PI / 2;
  cable2.position.set(-0.1, 0.09, 0);
  internalsGroup.add(cable2);

  internalsGroup.visible = false;

  // ============================================================================
  //  PIXEL / DIE COLOR HELPERS
  // ============================================================================
  const _c = new THREE.Color();
  function setDie(mesh, idx, value, channel) {
    const v = chan(value);
    _c.r = channel === 0 ? v : 0;
    _c.g = channel === 1 ? v : 0;
    _c.b = channel === 2 ? v : 0;
    mesh.setColorAt(idx, _c);
  }

  function applyContentForModule(mod, u) {
    let i = 0;
    for (let row = 0; row < PX; row++) {
      for (let col = 0; col < PX; col++) {
        const wx = mod.originX - MOD / 2 + (col + 0.5) * PXP;
        const wy = mod.originY - MOD / 2 + (row + 0.5) * PXP;
        const [r, g, b] = contentColor(wx, wy, u);
        if (mod.isHero) {
          setDie(mod.dieMesh, i * 3 + 0, r, 0);
          setDie(mod.dieMesh, i * 3 + 1, g, 1);
          setDie(mod.dieMesh, i * 3 + 2, b, 2);
        }
        _c.setRGB(chan(r), chan(g), chan(b));
        mod.pixelMesh.setColorAt(i, _c);
        i++;
      }
    }
    mod.pixelMesh.instanceColor.needsUpdate = true;
    if (mod.isHero) mod.dieMesh.instanceColor.needsUpdate = true;
  }

  function blankModule(mod) {
    const dm = mod.dieMesh;
    for (let idx = 0; idx < dm.count; idx++) setDie(dm, idx, 0, idx % 3);
    dm.instanceColor.needsUpdate = true;
  }

  function setContent(u, includeHero = true) {
    for (const m of allModules) {
      if (m.isHero && !includeHero) continue;
      applyContentForModule(m, u);
    }
  }

  // ============================================================================
  //  HERO MODULE POSE — detach / turn / re-seat
  // ============================================================================
  function setHeroPose(pop, turnDeg) {
    heroMod.group.position.set(heroMod.originX, heroMod.originY, WALL_FRONT_Z + pop * POP_DIST);
    heroMod.group.rotation.y = THREE.MathUtils.degToRad(turnDeg);
    internalsGroup.visible = pop > 0.04;
    // seated: the blended mesh so it matches its 35 siblings exactly; once
    // detached, the true triad so the macro steps can show individual dies
    const detached = pop > 0.04;
    heroMod.dieMesh.visible = detached;
    heroMod.pixelMesh.visible = !detached;
  }

  // One seamless lap: slide off -> turn to show the back -> hold -> turn back
  // -> slide home. u=0 and u=1 are identical (seated, front-facing, lit).
  function setReveal(u) {
    const uu = clamp01(u);
    let pop;
    let turn;
    if (uu < 0.14) {
      pop = smooth(win(uu, 0, 0.14));
      turn = 0;
    } else if (uu < 0.3) {
      pop = 1;
      turn = 180 * smooth(win(uu, 0.14, 0.3));
    } else if (uu < 0.72) {
      pop = 1;
      turn = 180;
    } else if (uu < 0.88) {
      pop = 1;
      turn = 180 * (1 - smooth(win(uu, 0.72, 0.88)));
    } else {
      pop = 1 - smooth(win(uu, 0.88, 1.0));
      turn = 0;
    }
    setHeroPose(pop, turn);
    if (pop > 0.04) blankModule(heroMod);
    else applyContentForModule(heroMod, u);
  }

  // ============================================================================
  //  SCANNING — row-group multiplex + marching data-in dot
  // ============================================================================
  function setScan(phase) {
    const p = ((phase % 1) + 1) % 1;
    const groupCount = 4;
    const gp = p * groupCount;
    const activeGroup = Math.floor(gp) % groupCount;
    const within = gp - Math.floor(gp);
    const flash = 0.55 + 0.45 * Math.sin(within * Math.PI);
    // crisp on/off (not the muted content pattern) — the point here is which
    // rows are driven RIGHT NOW, and a busy color pattern buries that signal
    const dm = heroMod.dieMesh;
    let i = 0;
    for (let row = 0; row < PX; row++) {
      const active = row % groupCount === activeGroup;
      const k = active ? flash : 0;
      for (let col = 0; col < PX; col++) {
        setDie(dm, i * 3 + 0, k, 0);
        setDie(dm, i * 3 + 1, k, 1);
        setDie(dm, i * 3 + 2, k, 2);
        i++;
      }
    }
    dm.instanceColor.needsUpdate = true;

    const dotU = (gp * 3) % 1;
    heroMod.dataDot.visible = true;
    heroMod.dataDot.position.set(-MOD / 2 + dotU * MOD, MOD / 2 + 0.02, 0.012);
  }

  // ============================================================================
  //  PWM + COLOR MIXING — sweep every die through a duty-cycle palette
  // ============================================================================
  const PWM_STOPS = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 1],
    [1, 0.35, 0],
    [1, 0, 0], // returns to start — seamless
  ];
  function setPWM(phase) {
    const p = ((phase % 1) + 1) % 1;
    const dm = heroMod.dieMesh;
    let i = 0;
    for (let row = 0; row < PX; row++) {
      for (let col = 0; col < PX; col++) {
        const off = (row + col) * 0.01;
        const t = (((p + off) % 1) + 1) % 1 * (PWM_STOPS.length - 1);
        const i0 = Math.floor(t);
        const tt = t - i0;
        const c0 = PWM_STOPS[i0];
        const c1 = PWM_STOPS[Math.min(i0 + 1, PWM_STOPS.length - 1)];
        const r = c0[0] + (c1[0] - c0[0]) * tt;
        const g = c0[1] + (c1[1] - c0[1]) * tt;
        const b = c0[2] + (c1[2] - c0[2]) * tt;
        setDie(dm, i * 3 + 0, r, 0);
        setDie(dm, i * 3 + 1, g, 1);
        setDie(dm, i * 3 + 2, b, 2);
        i++;
      }
    }
    dm.instanceColor.needsUpdate = true;
    heroMod.dataDot.visible = false;
  }

  // ============================================================================
  //  CALLOUTS
  // ============================================================================
  const labels = calloutSets(['exterior', 'pixels', 'reveal', 'anatomy', 'scan', 'color', 'data']);

  labels.add('exterior', group, 'LED cabinet — 480×480mm', [0.7, WALL_BOTTOM + 1.55, WALL_FRONT_Z + 0.06], 35, 100);
  labels.add('exterior', group, 'Bezel-less seam', [0.0, WALL_BOTTOM + WALL_H, WALL_FRONT_Z + 0.02], 70, 80);
  labels.add('exterior', group, 'Ground-support stand', [WALL_W / 2 - 0.16, 0.45, 0.22], -55, 80);

  const cornerX = WALL_W / 2 - MOD / 2;
  const cornerY = WALL_BOTTOM + MOD / 2;
  labels.add('pixels', group, 'RGB pixel', [cornerX + 0.02, cornerY + 0.13, WALL_FRONT_Z + 0.03], 55, 90);
  labels.add('pixels', group, 'Module seam', [cornerX - MOD * 0.4, cornerY - 0.02, WALL_FRONT_Z + 0.03], -25, 80);

  labels.add('reveal', group, 'Blind-mate module', [heroMod.originX + 0.05, heroMod.originY + 0.15, WALL_FRONT_Z + 0.3], 40, 100);
  labels.add('reveal', internalsGroup, 'Cabinet cavity', [0, 0.16, 0.06], 60, 90);

  labels.add('anatomy', heroMod.group, 'Driver IC', [0.09, 0.09, -MOD_D - 0.014], -25, 85);
  labels.add('anatomy', heroMod.group, 'Capacitor', [-0.13, 0.11, -MOD_D - 0.03], 30, 70);
  labels.add('anatomy', heroMod.group, 'Blind-mate connector', [0, -0.02, -MOD_D - 0.008], -65, 95);
  labels.add('anatomy', heroMod.group, 'PCB', [0.15, -0.14, -MOD_D / 2], 15, 70);

  labels.add('scan', heroMod.group, 'Active row group', [0.13, 0.02, 0.02], 35, 95);
  labels.add('scan', heroMod.group, 'Data shifting in', [0.02, MOD / 2 + 0.03, 0.02], 65, 80);

  labels.add('color', heroMod.group, 'Red · green · blue dies', [0.02, -0.02, 0.03], -40, 100);

  labels.add('data', internalsGroup, 'Receiving card', [0.06, -0.02, 0.045], 45, 90);
  labels.add('data', internalsGroup, 'Data cable — daisy-chained', [-0.03, -0.09, 0.03], -70, 90);
  labels.add('data', internalsGroup, 'Power supply', [-0.1, 0.13, 0.06], 25, 75);

  // ============================================================================
  //  INITIAL STATE
  // ============================================================================
  setHeroPose(0, 0);
  setContent(0, true);
  labels.setLabels(false);

  function setHeroBlank() {
    blankModule(heroMod);
  }

  return {
    group,
    setContent,
    setReveal,
    setHeroPose,
    setHeroBlank,
    setScan,
    setPWM,
    setLabels: labels.setLabels,
    parts: { group, heroGroup: heroMod.group, internalsGroup, frameTop: fTop },
  };
}
