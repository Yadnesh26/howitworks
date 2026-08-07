import * as THREE from 'three';
import { materials, disc, rod, studioPlinth } from '../../framework/parts.js';
import { beveledBox, lathe, tubeAlong, finStack, chainPath } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, TAU } from '../../framework/motion.js';

// A dual-band consumer Wi-Fi router, staged as a product shot: matte black
// clamshell, three external dipoles on the rear edge, five gigabit jacks, a
// row of status LEDs. Everything that matters is invisible in the real object
// — so the shell ghosts to expose the board, one antenna's radome ghosts to
// expose the copper inside it, and the radio itself is drawn as expanding
// rings and flowing packets.
//
// MECHANISM (researched):
//   TWO MACHINES IN ONE BOX. (1) A ROUTER/SWITCH: a gigabit switch chip fed by
//   five RJ45 jacks through their isolation magnetics, one of which is the WAN
//   port; the SoC does the routing and the NAT bookkeeping that lets a house
//   full of devices share one public address. (2) A RADIO: the SoC's baseband
//   hands a modulated signal to a shielded RF section per band (2.4 GHz and a
//   5 GHz mezzanine board carrying three Skyworks power amps), each amp
//   raising it to about 100 mW / +20 dBm, through a pi impedance-matching
//   network and a fine coax to the antenna.
//   THE ANTENNA is a tuned length of metal: at 2.4 GHz the wavelength is
//   ~12.5 cm, so the half-wave dipole inside the radome is ~6 cm — two ~3 cm
//   arms either side of the feed. A second, shorter pair (~3 cm total) shares
//   the same feed for the 5 GHz band, whose wavelength is only ~6 cm. Current
//   sloshing up and down those arms 2.4 billion times a second radiates a
//   DOUGHNUT: strong all round the horizon, with nulls straight off the tips.
//   The same antenna receives, down to about -90 dBm — one picowatt, a
//   hundred billion times weaker than it transmits.
//   THE AIR IS ONE SHARED WIRE. Wi-Fi is half duplex: CSMA/CA makes every
//   device listen first, wait an interframe space, add a random backoff, then
//   transmit — one at a time per channel, each transmission acknowledged. A
//   crowded network is not a weak signal, it is a queue.
//   MIMO sends several spatial streams on the same frequency down different
//   multipath routes; beamforming shifts the phase fed to each antenna so the
//   pattern leans toward one client instead of the whole horizon.
//   5 GHz carries more but diffracts less: ~6-10 dB more loss through a home's
//   walls than 2.4 GHz.
//   Sources: eeworldonline TP-Link Archer C7 teardown (QCA9558 SoC, QCA9880
//   5 GHz mezzanine, AR8327 switch, DDR2, Skyworks PAs, coax + pi network),
//   netspotapp CSMA/CA, Meraki 802.11ax technical guide, allaboutcircuits
//   Wi-Fi antenna fundamentals, ibwave 2.4/5 GHz attenuation.
//
// SCALARS the pose is built from:
//   setReveal(t)      0 sealed product / 1 shell ghosted, board exposed
//   setRadomeOpen(t)  0 antennas opaque / 1 radomes ghosted, copper exposed
//   setWaves(a)       amplitude of the 2.4 GHz ring trains
//   setWaves5(a)      amplitude of the 5 GHz ring trains (shorter reach)
//   setPattern(on)    the translucent doughnut around the featured antenna
//   setClients(on)    the three abstract client devices on the plinth
//   setAir(on)        CSMA/CA airtime: exactly one talker at a time
//   setStreams(on)    three spatial streams converging on one client
//   setBeam(t)        beamforming lobe leaning toward that client
//   setPhase(u)       master 0-1 loop phase — rides packets along the wired
//                     path and the coax, expands every ring, blinks the LEDs,
//                     and runs the airtime slots. Wraps mod 1.
//   setLabels(mode)   'exterior'|'board'|'chain'|'antenna'|'bands'|'air'|
//                     'mimo'|'wired'|false
//
// PROPORTIONS — 1 world unit = 100 mm, every constant derives from it.
//   body 243 x 160 x 32 mm · antennas 180 mm long, 12 mm across ·
//   RJ45 jacks 16 mm wide · board 226 x 144 mm.
//   Target ratios: width:depth 1.52 · height:width 0.13 (it is a slab, and
//   must read as one) · antenna:width 0.74.

const PLINTH_H = 0.24;

// --- body -------------------------------------------------------------------
const BODY_W = 2.43;
const BODY_D = 1.6;
const FOOT_H = 0.035;
const TRAY_H = 0.2;
const SHELL_H = 0.12;
const TRAY_Y = FOOT_H + TRAY_H / 2;
const SHELL_Y = FOOT_H + TRAY_H + SHELL_H / 2;
const TOP_Y = FOOT_H + TRAY_H + SHELL_H; // 0.355 — top face
const REAR_Z = -BODY_D / 2;
const FRONT_Z = BODY_D / 2;

// --- board ------------------------------------------------------------------
const BOARD_Y = FOOT_H + 0.055;
const BOARD_T = 0.03;
const BOARD_TOP = BOARD_Y + BOARD_T / 2;

// --- rear ports -------------------------------------------------------------
const JACK_X = [-0.86, -0.675, -0.49, -0.305, -0.12]; // WAN first, then 4 LAN
const JACK_Z = REAR_Z + 0.12;
const JACK_Y = BOARD_TOP + 0.075;
const DC_X = 0.62;
const BTN_X = [0.92, 1.05];

// --- antennas ---------------------------------------------------------------
const ANT_X = [-0.86, 0, 0.86];
const ANT_TILT = [0.34, 0, -0.34]; // splay about +Z: left leans left
const HINGE_Y = 0.285;
const HINGE_Z = REAR_Z + 0.02;
const REAR_PLATE_T = 0.05; // the perforated panel the ports actually open through
const ANT_R = 0.058;
const ANT_LEN = 1.78;
// Half a wavelength at 2.4 GHz is ~62 mm; at 5 GHz, ~30 mm. Both pairs of arms
// share one feed point, which is what makes the antenna dual-band.
const FEED_Y = 0.52;
const ARM_24 = 0.31; // one arm — two of them make the half-wave element
const ARM_5 = 0.15;
const FEATURED = 2; // the antenna the macro steps look at (+x side)

const WIRED = 0xffb347; // amber — packets on copper
const WAVE24 = 0x7aa2ff; // periwinkle — 2.4 GHz (accent)
const WAVE5 = 0xc58bff; // violet — 5 GHz
const LEDCOL = 0x9fe870;

export function buildRouter({ scene }) {
  const sceneGroup = new THREE.Group();
  scene.add(sceneGroup);
  sceneGroup.add(studioPlinth({ w: 4.4, h: PLINTH_H, d: 3.6 }));

  // Everything below is authored with y=0 at the plinth's top face.
  const rig = new THREE.Group();
  rig.position.y = PLINTH_H;
  sceneGroup.add(rig);

  // ==========================================================================
  //  MATERIALS
  // ==========================================================================
  // Every steel/aluminium preset below has a roughnessMap that MULTIPLIES base
  // roughness (map texels ~0.5), so bases are set near 1.0 on purpose — a 0.3
  // base renders near-chrome and clips to white on anything large.
  const trayMat = materials.polymer(0x191c21);
  const shellMat = materials.paintedMetal(0x22262c);
  shellMat.clearcoat = 0.55;
  shellMat.clearcoatRoughness = 0.3;
  const ventMat = materials.darkMetal(0x0e1013);
  ventMat.roughness = 0.92;
  const footMat = materials.rubber(0x121417);
  const radomeMat = materials.polymer(0x1b1e24);
  const collarMat = materials.brushedSteel(0xa9b1bb);
  collarMat.roughness = 1.0;

  const boardMat = materials.paintedMetal(0x0e3423);
  boardMat.roughness = 0.7;
  boardMat.clearcoat = 0.18;
  const canMat = materials.brushedSteel(0x8f959d);
  canMat.roughness = 1.0;
  const chipMat = materials.darkMetal(0x212429);
  chipMat.roughness = 0.78;
  const sinkMat = materials.aluminum(0x7b828c);
  sinkMat.roughness = 1.0;
  // The amplifier modules are the one part of the RF chain the copy quotes a
  // number for, so they get a light package that reads against the dark board
  // instead of the near-black plastic every other small chip wears.
  const paMat = materials.paintedMetal(0x6e747d);
  paMat.roughness = 0.62;
  paMat.clearcoat = 0.2;
  const jackMat = materials.brushedSteel(0x9aa1a9);
  jackMat.roughness = 1.0;
  const jackInnerMat = materials.rubber(0x0c0e11);
  const wanMat = materials.paintedMetal(0x2f6ad8);
  wanMat.roughness = 0.55;
  const coaxMat = materials.rubber(0x2c3037);
  // The copper element is THE subject of the macro step, and at that scale a
  // bare metal trace disappears against the dark board — a little emissive of
  // its own keeps it the brightest thing in frame.
  const copperMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0a355,
    emissive: 0x6b3c10,
    emissiveIntensity: 0.6,
    metalness: 0.85,
    roughness: 0.34,
  });
  // Deliberately near-black: this strip is only a carrier, and any real green
  // on it out-shouts the copper that the whole macro step is about.
  const fr4Mat = materials.paintedMetal(0x0c2a1d);
  fr4Mat.roughness = 0.86;
  fr4Mat.clearcoat = 0.04;
  const pinMat = new THREE.MeshStandardMaterial({
    color: 0x9aa0a8,
    metalness: 0.6,
    roughness: 0.82,
  });
  const capMat = materials.paintedMetal(0x1a1d22);
  const clientMat = materials.polymer(0x2a2f37);

  const ledMat = new THREE.MeshStandardMaterial({
    color: LEDCOL,
    emissive: LEDCOL,
    emissiveIntensity: 1.1,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x2b3340,
    emissive: WAVE24,
    emissiveIntensity: 0.25,
    roughness: 0.5,
  });
  const patternMat = new THREE.MeshStandardMaterial({
    color: WAVE24,
    emissive: WAVE24,
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const lobeMat = new THREE.MeshStandardMaterial({
    color: WAVE24,
    emissive: WAVE24,
    emissiveIntensity: 0.7,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const revealDim = []; // shells that ghost when you look inside
  const internals = []; // board + components — only shown revealed
  const cosmetic = []; // printed/plated exterior detail — hidden on reveal

  const rememberGhostOrig = (mat) => {
    if (!mat.userData.ghostOrig) {
      mat.userData.ghostOrig = { clearcoat: mat.clearcoat ?? 0, metalness: mat.metalness ?? 0 };
    }
  };

  // ==========================================================================
  //  OUTER SHELL — base tray, top clamshell, vents, feet, LED window
  // ==========================================================================
  // The clamshell stops short of the rear face; the rear PANEL is its own
  // plate with real holes punched through it, so every port is an opening a
  // plug could actually enter, never a plated slab stuck on a wall.
  const CASE_D = BODY_D - REAR_PLATE_T;
  const CASE_Z = REAR_PLATE_T / 2;

  const tray = beveledBox(BODY_W, TRAY_H, CASE_D, trayMat, 0.045);
  tray.position.set(0, TRAY_Y, CASE_Z);
  tray.receiveShadow = true;
  rig.add(tray);
  revealDim.push(tray);

  const topShell = beveledBox(BODY_W - 0.03, SHELL_H, CASE_D - 0.03, shellMat, 0.04);
  topShell.position.set(0, SHELL_Y, CASE_Z);
  topShell.receiveShadow = true;
  rig.add(topShell);
  revealDim.push(topShell);

  for (const fx of [-1, 1]) {
    for (const fz of [-1, 1]) {
      const foot = disc(0.085, FOOT_H, footMat, 20);
      foot.position.set(fx * (BODY_W / 2 - 0.2), FOOT_H / 2, fz * (BODY_D / 2 - 0.2));
      rig.add(foot);
      revealDim.push(foot);
    }
  }

  // ---- rear panel: one plate, seven real holes ------------------------------
  const plateShape = new THREE.Shape();
  plateShape.moveTo(-BODY_W / 2, FOOT_H);
  plateShape.lineTo(BODY_W / 2, FOOT_H);
  plateShape.lineTo(BODY_W / 2, TOP_Y);
  plateShape.lineTo(-BODY_W / 2, TOP_Y);
  plateShape.closePath();
  const rectHole = (cx, cy, w, h) => {
    const p = new THREE.Path();
    p.moveTo(cx - w / 2, cy - h / 2);
    p.lineTo(cx + w / 2, cy - h / 2);
    p.lineTo(cx + w / 2, cy + h / 2);
    p.lineTo(cx - w / 2, cy + h / 2);
    p.closePath();
    return p;
  };
  for (const jx of JACK_X) plateShape.holes.push(rectHole(jx, JACK_Y, 0.175, 0.152));
  plateShape.holes.push(rectHole(DC_X, BOARD_TOP + 0.06, 0.165, 0.132));
  for (const bx of BTN_X) {
    const p = new THREE.Path();
    p.absarc(bx, BOARD_TOP + 0.045, 0.045, 0, TAU, true);
    plateShape.holes.push(p);
  }
  const rearPlate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(plateShape, {
      depth: REAR_PLATE_T,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelSegments: 1,
      curveSegments: 12,
    }),
    trayMat,
  );
  rearPlate.position.z = REAR_Z;
  rearPlate.castShadow = true;
  rig.add(rearPlate);
  revealDim.push(rearPlate);

  // Cooling louvres across the rear half of the lid, and a matching grille in
  // the tray's flanks. A sealed box would be a lie: the SoC under that heat
  // sink runs warm enough to need convection through the case.
  for (let i = 0; i < 11; i++) {
    const slot = beveledBox(0.055, 0.012, 0.5, ventMat, 0.005);
    slot.position.set(-0.72 + i * 0.144, TOP_Y - 0.004, -0.34);
    rig.add(slot);
    cosmetic.push(slot);
  }
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const slot = beveledBox(0.012, 0.055, 0.12, ventMat, 0.004);
      slot.position.set(sx * (BODY_W / 2 - 0.002), 0.12, -0.42 + i * 0.16);
      rig.add(slot);
      cosmetic.push(slot);
    }
  }

  // Status LEDs: emitters on the board shine up through light pipes to five
  // pads on the lid — power, internet, 2.4 GHz, 5 GHz, LAN.
  const ledPads = [];
  const ledEmitters = [];
  for (let i = 0; i < 5; i++) {
    const x = -0.36 + i * 0.18;
    const pad = beveledBox(0.055, 0.008, 0.045, ledMat, 0.004);
    pad.position.set(x, TOP_Y + 0.001, 0.56);
    rig.add(pad);
    ledPads.push(pad);
    cosmetic.push(pad);

    const pipe = rod(0.013, 0.12, materials.glass(0xd8e6ff, 0.18), 10);
    pipe.position.set(x, BOARD_TOP, 0.56);
    rig.add(pipe);
    internals.push(pipe);
    const emit = beveledBox(0.05, 0.018, 0.04, ledMat.clone(), 0.004);
    emit.position.set(x, BOARD_TOP + 0.014, 0.56);
    rig.add(emit);
    internals.push(emit);
    ledEmitters.push(emit);
  }

  // ==========================================================================
  //  BOARD — SoC + heat sink, memory, both radios, switch, jacks, power
  // ==========================================================================
  const board = beveledBox(2.26, BOARD_T, 1.44, boardMat, 0.01);
  board.position.set(0, BOARD_Y, 0);
  rig.add(board);
  internals.push(board);

  const SOC = [-0.14, 0.12];
  const SW = [-0.5, -0.28];
  const CAN24 = [-0.74, 0.34];
  const MEZZ = [0.8, 0.3];

  // ---- SoC under its heat sink ---------------------------------------------
  const soc = beveledBox(0.34, 0.04, 0.34, chipMat, 0.008);
  soc.position.set(SOC[0], BOARD_TOP + 0.02, SOC[1]);
  rig.add(soc);
  internals.push(soc);
  const heatSink = finStack(
    { count: 6, size: 0.16, thickness: 0.018, gap: 0.024, shape: 'square' },
    sinkMat,
  );
  heatSink.position.set(SOC[0], BOARD_TOP + 0.04, SOC[1]);
  rig.add(heatSink);
  heatSink.traverse((o) => o.isMesh && internals.push(o));

  // ---- memory + flash -------------------------------------------------------
  // kept well clear of the 5 GHz mezzanine: with both crowded into the same
  // corner, the memory callout lands ambiguously between the two
  for (const dz of [-0.14, 0.14]) {
    const ram = beveledBox(0.24, 0.028, 0.13, chipMat, 0.005);
    ram.position.set(0.16, BOARD_TOP + 0.014, SOC[1] + dz);
    rig.add(ram);
    internals.push(ram);
  }
  const flash = beveledBox(0.13, 0.026, 0.1, chipMat, 0.005);
  flash.position.set(0.14, BOARD_TOP + 0.013, SOC[1] - 0.34);
  rig.add(flash);
  internals.push(flash);

  // ---- 2.4 GHz radio: shield can + its power amps ---------------------------
  // The can is not decoration — a few hundred milliwatts of switching noise
  // from the digital side would drown a picowatt receiver sitting next to it.
  const shieldCan = (w, h, d, pos) => {
    const can = beveledBox(w, h, d, canMat, 0.008);
    can.position.set(pos[0], pos[1], pos[2]);
    rig.add(can);
    internals.push(can);
    // dimpled lid — the vent holes every real can has, stamped in a grid
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) {
        const hole = disc(0.014, 0.004, ventMat, 10);
        hole.position.set(
          pos[0] - w * 0.3 + (i * w * 0.6) / 3,
          pos[1] + h / 2,
          pos[2] - d * 0.28 + (j * d * 0.56) / 2,
        );
        rig.add(hole);
        internals.push(hole);
      }
    }
    return can;
  };
  const can24 = shieldCan(0.5, 0.09, 0.42, [CAN24[0], BOARD_TOP + 0.045, CAN24[1]]);
  const pa24 = [];
  for (let i = 0; i < 3; i++) {
    const pa = beveledBox(0.115, 0.038, 0.115, paMat, 0.008);
    pa.position.set(CAN24[0] - 0.17 + i * 0.17, BOARD_TOP + 0.019, CAN24[1] + 0.32);
    rig.add(pa);
    internals.push(pa);
    pa24.push(pa);
    // the exposed ground pad every RF amp module sits on
    const pad = beveledBox(0.135, 0.006, 0.135, copperMat, 0.004);
    pad.position.set(pa.position.x, BOARD_TOP + 0.003, pa.position.z);
    rig.add(pad);
    internals.push(pad);
  }

  // ---- 5 GHz radio on its own mezzanine board -------------------------------
  const mezz = beveledBox(0.66, 0.022, 0.52, boardMat, 0.008);
  mezz.position.set(MEZZ[0], BOARD_TOP + 0.08, MEZZ[1]);
  rig.add(mezz);
  internals.push(mezz);
  for (const mx of [-0.27, 0.27]) {
    for (const mz of [-0.2, 0.2]) {
      const post = rod(0.018, 0.08, pinMat, 10);
      post.position.set(MEZZ[0] + mx, BOARD_TOP, MEZZ[1] + mz);
      rig.add(post);
      internals.push(post);
    }
  }
  const can5 = shieldCan(0.44, 0.08, 0.34, [MEZZ[0] - 0.05, BOARD_TOP + 0.13, MEZZ[1]]);
  const pa5 = [];
  for (let i = 0; i < 3; i++) {
    const pa = beveledBox(0.09, 0.03, 0.09, paMat, 0.006);
    pa.position.set(MEZZ[0] + 0.24, BOARD_TOP + 0.106, MEZZ[1] - 0.16 + i * 0.16);
    rig.add(pa);
    internals.push(pa);
    pa5.push(pa);
  }

  // ---- gigabit switch + the jacks it serves ---------------------------------
  const switchChip = beveledBox(0.3, 0.036, 0.3, chipMat, 0.006);
  switchChip.position.set(SW[0], BOARD_TOP + 0.018, SW[1]);
  rig.add(switchChip);
  internals.push(switchChip);

  // The jacks show through the rear panel's holes, so they stay visible sealed
  // OR open — only the magnetics behind them are internal.
  const jacks = [];
  JACK_X.forEach((jx, i) => {
    const body = beveledBox(0.16, 0.14, 0.22, jackMat, 0.008);
    body.position.set(jx, JACK_Y, JACK_Z);
    rig.add(body);
    jacks.push(body);
    const mouth = beveledBox(0.125, 0.1, 0.05, jackInnerMat, 0.004);
    mouth.position.set(jx, JACK_Y - 0.004, JACK_Z - 0.1);
    rig.add(mouth);
    // the little plastic tongue every RJ45 socket has, at the top of the bore
    const tongue = beveledBox(0.075, 0.03, 0.04, jackInnerMat, 0.004);
    tongue.position.set(jx, JACK_Y + 0.03, JACK_Z - 0.09);
    rig.add(tongue);
    if (i === 0) {
      // The WAN socket is marked twice, because only one mark is ever in view:
      // a painted flash on the rear skin while the case is sealed, and a
      // coloured band across the housing once the skin ghosts away. Step 8's
      // copy turns on "one socket faces the internet" — without the second
      // mark, that claim has nothing to point at in the very step that makes it.
      const surround = beveledBox(0.185, 0.025, 0.012, wanMat, 0.005);
      surround.position.set(jx, JACK_Y + 0.098, REAR_Z - 0.005);
      rig.add(surround);
      cosmetic.push(surround);

      const band = beveledBox(0.168, 0.022, 0.226, wanMat, 0.006);
      band.position.set(jx, JACK_Y + 0.062, JACK_Z);
      rig.add(band);
    }
    // isolation magnetics sit between every jack and the switch chip
    const mag = beveledBox(0.15, 0.05, 0.1, chipMat, 0.008);
    mag.position.set(jx, BOARD_TOP + 0.025, JACK_Z + 0.2);
    rig.add(mag);
    internals.push(mag);
  });

  // ---- power inlet, buttons, bulk capacitors --------------------------------
  const dcJack = beveledBox(0.15, 0.12, 0.18, chipMat, 0.012);
  dcJack.position.set(DC_X, BOARD_TOP + 0.06, JACK_Z);
  rig.add(dcJack);
  const dcBore = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.1, 16), jackInnerMat);
  dcBore.rotation.x = Math.PI / 2;
  dcBore.position.set(DC_X, BOARD_TOP + 0.06, JACK_Z - 0.09);
  rig.add(dcBore);
  const dcPin = rod(0.012, 0.06, pinMat, 10);
  dcPin.rotation.x = -Math.PI / 2;
  dcPin.position.set(DC_X, BOARD_TOP + 0.06, JACK_Z - 0.05);
  rig.add(dcPin);
  for (const bx of BTN_X) {
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.09, 14), pinMat);
    btn.rotation.x = Math.PI / 2;
    btn.position.set(bx, BOARD_TOP + 0.045, JACK_Z - 0.07);
    rig.add(btn);
  }
  for (const [cx, cz] of [
    [0.94, 0.0],
    [1.02, 0.24],
  ]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.14, 20), capMat);
    cap.position.set(cx, BOARD_TOP + 0.07, cz);
    rig.add(cap);
    internals.push(cap);
    const capTop = disc(0.056, 0.008, pinMat, 20);
    capTop.position.set(cx, BOARD_TOP + 0.141, cz);
    rig.add(capTop);
    internals.push(capTop);
  }
  for (let i = 0; i < 9; i++) {
    const smd = beveledBox(0.045, 0.02, 0.03, capMat, 0.004);
    smd.position.set(-0.1 + i * 0.1, BOARD_TOP + 0.01, -0.5);
    rig.add(smd);
    internals.push(smd);
  }

  // ==========================================================================
  //  ANTENNAS — radome, dual-band dipole strip, hinge, coax
  // ==========================================================================
  // Radome profile: a slim tube with a shoulder near the base and a domed tip.
  // No flat cut faces anywhere.
  const RADOME_PROFILE = [
    [0.0, 0.06],
    [0.072, 0.06],
    [0.072, 0.16],
    [ANT_R, 0.2],
    [ANT_R, ANT_LEN - 0.1],
    [ANT_R * 0.86, ANT_LEN - 0.03],
    [ANT_R * 0.5, ANT_LEN],
    [0.0, ANT_LEN + 0.02],
  ];

  const antennas = [];
  ANT_X.forEach((ax, i) => {
    const group = new THREE.Group();
    group.position.set(ax, HINGE_Y, HINGE_Z);
    group.rotation.z = ANT_TILT[i];
    group.rotation.x = -0.1; // a fraction back off vertical, as they ship
    rig.add(group);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.082, 0.09, 24), collarMat);
    collar.position.y = 0.02;
    group.add(collar);
    // knurling on the collar — the detail that says "you can unscrew this"
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * TAU;
      const rib = beveledBox(0.008, 0.06, 0.012, collarMat, 0.003);
      rib.position.set(Math.cos(a) * 0.079, 0.02, Math.sin(a) * 0.079);
      rib.rotation.y = -a;
      group.add(rib);
    }

    // Its own material instance: only the FEATURED antenna's radome ghosts.
    // Ghosting all three turned the wide shots into a forest of green sticks.
    const radome = lathe(RADOME_PROFILE, radomeMat.clone(), 32);
    group.add(radome);

    // ---- what is actually inside: one FR4 strip carrying two dipoles --------
    const inner = new THREE.Group();
    inner.visible = false;
    group.add(inner);
    const strip = beveledBox(0.058, 1.34, 0.008, fr4Mat, 0.003);
    strip.position.y = 0.2 + 1.34 / 2;
    inner.add(strip);

    // 2.4 GHz half-wave dipole: two 31 mm arms about the feed. The two bands
    // sit side by side on the strip, far enough apart to read as two elements
    // in the macro shot rather than one wide trace.
    const armGeo = new THREE.BoxGeometry(0.026, ARM_24 - 0.012, 0.009);
    for (const dir of [1, -1]) {
      const arm = new THREE.Mesh(armGeo, copperMat);
      arm.position.set(-0.013, FEED_Y + (dir * (ARM_24 + 0.012)) / 2, 0.008);
      inner.add(arm);
    }
    // 5 GHz pair, sharing the same feed — half the wavelength is half the
    // metal, so these arms are half as long
    const arm5Geo = new THREE.BoxGeometry(0.014, ARM_5 - 0.008, 0.008);
    for (const dir of [1, -1]) {
      const arm = new THREE.Mesh(arm5Geo, copperMat);
      arm.position.set(0.019, FEED_Y + (dir * (ARM_5 + 0.008)) / 2, 0.008);
      inner.add(arm);
    }
    const feed = new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 10), pinMat);
    feed.position.set(0.0, FEED_Y, 0.012);
    inner.add(feed);
    // the coax climbing the strip to that feed point
    const innerCoax = tubeAlong(
      [
        [0.0, 0.06, -0.01],
        [0.0, 0.26, -0.006],
        [0.0, FEED_Y - 0.06, 0.0],
        [0.0, FEED_Y, 0.008],
      ],
      0.012,
      coaxMat,
      { tubularSegments: 40, radialSegments: 8 },
    );
    inner.add(innerCoax);

    // ---- radiation: expanding rings perpendicular to the element -----------
    const waves = new THREE.Group();
    waves.position.y = FEED_Y + 0.02;
    group.add(waves);

    antennas.push({ group, radome, inner, waves, collar });
  });

  // The doughnut. Drawn on the featured antenna only — three of them at once
  // is a fog bank, and the macro step only ever looks at this one.
  const doughnut = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.26, 18, 56), patternMat);
  doughnut.rotation.x = Math.PI / 2;
  doughnut.position.y = FEED_Y + 0.02;
  antennas[FEATURED].group.add(doughnut);

  // ---- ring trains ----------------------------------------------------------
  const ringGeo = new THREE.TorusGeometry(1, 0.009, 8, 64);
  function ringSet(parent, { count, color, maxR }) {
    const rings = [];
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const m = new THREE.Mesh(ringGeo, mat);
      m.rotation.x = Math.PI / 2;
      parent.add(m);
      rings.push(m);
    }
    // THREE whole wave trains per lap: u wraps mod 1 and the envelope is zero
    // at both ends, so frame 0 and frame 1 are identical. Three and not two on
    // purpose — an even number of trains makes the whole scene repeat exactly
    // at half a lap, and a pose probe sampling two points half a lap apart
    // then reports a perfectly live loop as frozen.
    // The radius is recomputed even while hidden — it costs nothing, and it
    // keeps one always-moving part in the scene for that probe to hash.
    function update(phase, amount) {
      const on = amount > 0.01;
      rings.forEach((m, i) => {
        const u = (((phase * 3 + i / count) % 1) + 1) % 1;
        m.scale.setScalar(0.1 + u * maxR);
        m.visible = on;
        m.material.opacity = on ? amount * 0.34 * Math.sin(Math.PI * u) ** 1.3 : 0;
      });
    }
    update(0, 0);
    return { rings, update };
  }
  // Odd ring counts for the same reason as the odd dot counts: with an even
  // count, three trains per lap shift the set onto itself after half a lap.
  const waves24 = antennas.map((a) => ringSet(a.waves, { count: 5, color: WAVE24, maxR: 1.05 }));
  // 5 GHz: shorter wavelength, so the rings sit closer together, and less of it
  // survives the walls — a visibly shorter reach.
  const waves5 = antennas.map((a) => ringSet(a.waves, { count: 7, color: WAVE5, maxR: 0.62 }));

  // ==========================================================================
  //  SIGNAL PATH — WAN jack -> switch -> SoC -> radio -> PA -> coax -> feed
  // ==========================================================================
  // The wired half is drawn as a path through the board (traces are flat; the
  // packets riding just above them read as "through the board" without faking
  // copper geometry). The RF half IS real geometry: the coax you can see.
  const wirePath = chainPath(
    [
      [
        [JACK_X[0], BOARD_TOP + 0.05, JACK_Z - 0.1],
        [JACK_X[0], BOARD_TOP + 0.04, JACK_Z + 0.2],
        [SW[0], BOARD_TOP + 0.04, SW[1] - 0.05],
      ],
      [
        [SW[0], BOARD_TOP + 0.04, SW[1] - 0.05],
        [SW[0] + 0.1, BOARD_TOP + 0.04, SW[1] + 0.14],
        [SOC[0] - 0.06, BOARD_TOP + 0.04, SOC[1] - 0.1],
      ],
      [
        [SOC[0] - 0.06, BOARD_TOP + 0.04, SOC[1] - 0.1],
        [SOC[0] - 0.3, BOARD_TOP + 0.04, SOC[1] + 0.12],
        [CAN24[0] + 0.12, BOARD_TOP + 0.04, CAN24[1] - 0.02],
      ],
      [
        [CAN24[0] + 0.12, BOARD_TOP + 0.04, CAN24[1] - 0.02],
        [CAN24[0], BOARD_TOP + 0.04, CAN24[1] + 0.3],
        [CAN24[0], BOARD_TOP + 0.04, CAN24[1] + 0.44],
      ],
    ],
    { tension: 0.3 },
  );

  // Three coax runs from the front-end up to the three hinges, routed around
  // the board like the real thing rather than straight through it.
  const coaxCurves = [];
  ANT_X.forEach((ax, i) => {
    const startX = CAN24[0] - 0.17 + i * 0.17;
    const side = ax === 0 ? (i === 1 ? -1 : 1) : Math.sign(ax);
    const pts = [
      [startX, BOARD_TOP + 0.03, CAN24[1] + 0.44],
      [startX + side * 0.18, BOARD_TOP + 0.03, CAN24[1] + 0.5],
      [side * 1.06, BOARD_TOP + 0.05, 0.3 - i * 0.12],
      [side * 1.04, BOARD_TOP + 0.09, -0.36],
      [ax + side * 0.12, HINGE_Y - 0.12, HINGE_Z + 0.1],
      [ax, HINGE_Y - 0.02, HINGE_Z],
    ];
    const cable = tubeAlong(pts, 0.017, coaxMat, { tubularSegments: 90, radialSegments: 8 });
    rig.add(cable);
    internals.push(cable);
    coaxCurves.push(cable.userData.curve);
    // U.FL connector where it clips onto the board
    const ufl = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.03, 12), pinMat);
    ufl.position.set(startX, BOARD_TOP + 0.02, CAN24[1] + 0.44);
    rig.add(ufl);
    internals.push(ufl);
  });

  // ==========================================================================
  //  THE AIR — three abstract clients, their links, streams and the beam lobe
  // ==========================================================================
  // Deliberately abstract slabs: the mechanism needs something for the router
  // to take turns with, and anything more literal would read as a toy.
  const clientGroup = new THREE.Group();
  rig.add(clientGroup);

  function clientDevice({ pos, w, h, tilt, standH = 0, deck = 0 }) {
    const g = new THREE.Group();
    g.position.set(pos[0], 0, pos[1]);
    // face the router: default facing is +z, so swing it onto the vector back
    // toward the middle of the box
    g.rotation.y = Math.atan2(-pos[0], -(pos[1] + 0.5));
    clientGroup.add(g);

    // the screen leans back about its BOTTOM edge, like a real lid or stand
    const lid = new THREE.Group();
    lid.position.y = standH;
    lid.rotation.x = tilt;
    g.add(lid);
    const panel = beveledBox(w, h, 0.024, clientMat, 0.012);
    panel.position.y = h / 2;
    lid.add(panel);
    // its own material instance — airtime drives each screen separately, and a
    // shared material would light all three at once
    const screen = beveledBox(w - 0.06, h - 0.06, 0.008, screenMat.clone(), 0.006);
    screen.position.set(0, h / 2, 0.015);
    lid.add(screen);
    // A lit strip along the top edge, on the same material as the screen: the
    // devices face the router, so from most step cameras you are looking at
    // their BACKS and the screen alone would tell you nothing.
    const pip = beveledBox(w * 0.4, 0.012, 0.032, screen.material, 0.005);
    pip.position.set(0, h + 0.002, 0);
    lid.add(pip);

    if (deck > 0) {
      // a laptop: keyboard half lying flat in front of the lid
      const base = beveledBox(w, 0.026, deck, clientMat, 0.01);
      base.position.set(0, 0.013, deck / 2);
      g.add(base);
      const keys = beveledBox(w - 0.1, 0.006, deck - 0.1, materials.polymer(0x0e1013), 0.006);
      keys.position.set(0, 0.028, deck / 2);
      g.add(keys);
    } else if (standH > 0) {
      const stem = beveledBox(0.09, standH, 0.05, clientMat, 0.014);
      stem.position.y = standH / 2;
      g.add(stem);
      const foot = beveledBox(w * 0.45, 0.022, 0.18, clientMat, 0.009);
      foot.position.y = 0.011;
      g.add(foot);
    }
    // where the link arrives — the middle of the screen, in rig space
    g.userData.screenY = standH + Math.cos(tilt) * (h / 2);
    return { group: g, screen };
  }

  const clients = [
    // All three live in the RIGHT 62% of the frame: the text panel owns the
    // left, and a device parked under it is a talker the viewer never sees.
    clientDevice({ pos: [1.85, 0.55], w: 0.26, h: 0.5, tilt: -0.16, standH: 0.03 }), // phone
    clientDevice({ pos: [-0.15, 1.66], w: 0.58, h: 0.38, tilt: -0.3, deck: 0.4 }), // laptop
    clientDevice({ pos: [1.2, 1.32], w: 0.82, h: 0.47, tilt: -0.06, standH: 0.18 }), // TV
  ];

  // Link arcs from the radio to each client. The hub sits at the middle
  // antenna's element, which is where the copy says the signal leaves.
  const HUB = [0, HINGE_Y + FEED_Y, HINGE_Z + 0.02];
  const linkCurves = clients.map((c) => {
    const p = c.group.position;
    const sy = c.group.userData.screenY;
    const mid = [(HUB[0] + p.x) / 2, Math.max(HUB[1], sy) + 0.34, (HUB[2] + p.z) / 2];
    return new THREE.CatmullRomCurve3(
      [new THREE.Vector3(...HUB), new THREE.Vector3(...mid), new THREE.Vector3(p.x, sy, p.z)],
      false,
      'catmullrom',
      0.5,
    );
  });

  // Faint arcs standing in for the association each device holds with the
  // router. Only the one whose turn it is lights up — without them, a burst of
  // three dots in a wide frame is impossible to follow.
  const linkTubes = linkCurves.map((c) => {
    const mat = new THREE.MeshStandardMaterial({
      color: WAVE24,
      emissive: WAVE24,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const t = new THREE.Mesh(new THREE.TubeGeometry(c, 64, 0.009, 8, false), mat);
    t.visible = false;
    rig.add(t);
    return t;
  });

  // Spatial streams: one from each antenna to the same client, taking three
  // different paths through the room and arriving as three separate signals.
  const STREAM_TARGET = 0; // the phone
  const streamCurves = ANT_X.map((ax, i) => {
    const p = clients[STREAM_TARGET].group.position;
    const sy = clients[STREAM_TARGET].group.userData.screenY;
    const bow = (i - 1) * 0.45; // each stream takes a different way through the room
    return new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(ax, HINGE_Y + FEED_Y, HINGE_Z + 0.02),
        new THREE.Vector3((ax + p.x) / 2 + bow, HINGE_Y + FEED_Y + 0.55 - Math.abs(bow) * 0.35, 0.1),
        new THREE.Vector3(p.x, sy, p.z),
      ],
      false,
      'catmullrom',
      0.5,
    );
  });
  const streamTubes = streamCurves.map((c) => {
    const mat = new THREE.MeshStandardMaterial({
      color: WAVE24,
      emissive: WAVE24,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    const t = new THREE.Mesh(new THREE.TubeGeometry(c, 60, 0.012, 8, false), mat);
    rig.add(t);
    return t;
  });

  // Beamforming lobe: the doughnut squeezed into a teardrop aimed at one
  // client. Built along +Y, then swung onto the line to the target.
  const LOBE_LEN = 2.0;
  const lobeProfile = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    lobeProfile.push([Math.sin(Math.PI * t) * 0.26 * (1 - t * 0.35), t * LOBE_LEN]);
  }
  const lobe = lathe(lobeProfile, lobeMat, 28);
  lobe.position.set(...HUB);
  {
    // aimed at the client, but only two thirds of the way down: a lobe pointed
    // steeply at the floor reads as a blob hanging off the box rather than a
    // pattern leaning across the room
    const target = clients[STREAM_TARGET].group.position;
    const ty = clients[STREAM_TARGET].group.userData.screenY;
    const dir = new THREE.Vector3(
      target.x - HUB[0],
      (ty - HUB[1]) * 0.55,
      target.z - HUB[2],
    ).normalize();
    lobe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  }
  rig.add(lobe);

  // ==========================================================================
  //  FLOW DOTS
  // ==========================================================================
  function flowDots(curve, count, color, size, parent) {
    const dots = [];
    const geo = new THREE.SphereGeometry(size, 10, 8);
    for (let i = 0; i < count; i++) {
      const mat = materials.glow(color, 1.6);
      mat.transparent = true;
      mat.opacity = 0;
      mat.depthWrite = false;
      const d = new THREE.Mesh(geo, mat);
      parent.add(d);
      dots.push(d);
    }
    function update(phase, on, dir = 1, alpha = 0.95) {
      dots.forEach((d, i) => {
        if (!on) {
          d.material.opacity = 0;
          return;
        }
        const t = (((dir * phase + i / count) % 1) + 1) % 1;
        d.position.copy(curve.getPointAt(t));
        d.material.opacity = alpha;
      });
    }
    // A window along the curve rather than the whole of it: used for airtime,
    // where a burst has to start and finish inside one device's slot.
    function burst(head, on, dir = 1, alpha = 0.95, spread = 0.22) {
      dots.forEach((d, i) => {
        const t = head - (i / dots.length) * spread;
        if (!on || t <= 0 || t >= 1) {
          d.material.opacity = 0;
          return;
        }
        const u = dir > 0 ? t : 1 - t;
        d.position.copy(curve.getPointAt(clamp01(u)));
        d.material.opacity = alpha * Math.min(1, t * 12) * Math.min(1, (1 - t) * 12);
      });
    }
    update(0, false);
    return { dots, update, burst };
  }

  // Odd dot counts on purpose: with an even count the whole train maps onto
  // itself after half a lap, which reads as a dead loop to anything sampling
  // two poses half a lap apart.
  const wireFlow = flowDots(wirePath, 13, WIRED, 0.022, rig);
  const coaxFlow = coaxCurves.map((c) => flowDots(c, 9, WAVE24, 0.02, rig));
  const linkFlow = linkCurves.map((c) => flowDots(c, 7, WAVE24, 0.034, rig));
  const streamFlow = streamCurves.map((c) => flowDots(c, 5, WAVE24, 0.026, rig));

  // ==========================================================================
  //  CALLOUTS
  // ==========================================================================
  const labels = calloutSets([
    'exterior',
    'board',
    'chain',
    'antenna',
    'bands',
    'air',
    'mimo',
    'wired',
  ]);
  const antFeat = antennas[FEATURED].group;

  labels.add('exterior', rig, 'Three antennas', [0.86, HINGE_Y + 1.4, HINGE_Z], 30, 92);
  labels.add('exterior', rig, 'Status LEDs', [0.28, TOP_Y, 0.56], -20, 104);
  labels.add('exterior', rig, 'Cooling vents', [0.6, TOP_Y, -0.34], 55, 88);

  // FANNED on purpose. These five anchors sit inside one small patch of board,
  // so leaders of similar direction all resolve to the same strip of screen and
  // the declutter pass can only jam the pills into a touching column (it
  // guarantees 5px, which reads as overlapping). Spreading the base directions
  // AND the lengths gives each pill its own band of empty frame to land in.
  labels.add('board', rig, '2.4 GHz radio, shielded', [CAN24[0], BOARD_TOP + 0.09, CAN24[1] - 0.2], 78, 206);
  labels.add('board', rig, 'SoC under its heat sink', [SOC[0] + 0.16, BOARD_TOP + 0.2, SOC[1]], 34, 186);
  labels.add('board', rig, 'Gigabit switch', [SW[0] + 0.16, BOARD_TOP + 0.04, SW[1]], 1, 250);
  labels.add('board', rig, 'DDR memory', [0.16, BOARD_TOP + 0.03, SOC[1] + 0.14], -12, 172);
  labels.add('board', rig, '5 GHz board', [MEZZ[0] + 0.2, BOARD_TOP + 0.17, MEZZ[1] + 0.2], -46, 135);

  // Anchored on the parts themselves — a coax callout hand-placed near where
  // the cable "looks like" it runs landed on the 5 GHz can instead.
  labels.add('chain', pa24[1], 'Power amplifier — 100 mW', [0, 0.03, 0], -28, 116);
  labels.add('chain', rig, 'Shielded radio section', [CAN24[0] + 0.24, BOARD_TOP + 0.09, CAN24[1]], 62, 96);
  const coaxAnchor = coaxCurves[2].getPointAt(0.5);
  labels.add('chain', rig, 'Coax to the antenna', [coaxAnchor.x, coaxAnchor.y, coaxAnchor.z], 18, 104);

  // Leader direction decides which way the PILL grows, not just where it sits:
  // per labels.js, a dir with a negative cosine hangs the text off the leader's
  // LEFT end. The two pills carrying the numbers are the widest in the set, so
  // they must grow RIGHT — aimed left, their first words (the "6 cm", the
  // "5 GHz") slid under the text panel while the gate still scored them under
  // its 35%-hidden threshold.
  labels.add('antenna', antFeat, '6 cm of copper — half a wavelength', [-0.01, FEED_Y + ARM_24 * 0.62, 0.02], 72, 112);
  labels.add('antenna', antFeat, 'Feed point', [0.0, FEED_Y, 0.03], -166, 96);
  labels.add('antenna', antFeat, '5 GHz pair, half as long', [0.03, FEED_Y - ARM_5 * 0.8, 0.02], -46, 128);
  labels.add('antenna', antFeat, 'Radome — just a raincoat', [0.05, FEED_Y + 0.74, 0], 128, 96);

  labels.add('bands', antFeat, '2.4 GHz — 12 cm waves', [0.05, FEED_Y + 0.1, 0.02], 35, 108);
  labels.add('bands', antFeat, '5 GHz — 6 cm waves', [0.04, FEED_Y - 0.3, 0.02], -30, 104);
  labels.add('bands', antFeat, 'Nothing radiates off the tips', [0.0, ANT_LEN * 0.94, 0], 55, 100);

  labels.add('air', rig, 'One talker at a time', [0, HINGE_Y + FEED_Y + 0.5, HINGE_Z], 40, 104);
  labels.add('air', clients[0].group, 'Waiting its turn', [0.2, 0.5, 0], 30, 96);
  labels.add('air', clients[2].group, 'Backoff, then talk', [0.4, 0.6, 0], 45, 100);

  labels.add('mimo', rig, 'Three streams, one frequency', [0.6, HINGE_Y + FEED_Y + 0.4, -0.2], 25, 116);
  labels.add('mimo', clients[0].group, 'Arrives as three signals', [0.18, 0.42, 0], -30, 108);
  labels.add('mimo', rig, 'Beam leans toward the device', [1.0, 0.7, 0.35], 40, 112);

  // Fanned for the same reason as the board set — four anchors along one row of
  // sockets, so the leaders have to diverge or the pills stack flush.
  labels.add('wired', rig, 'WAN — the internet side', [JACK_X[0], BOARD_TOP + 0.16, JACK_Z - 0.1], 96, 176);
  // No 'Switch chip' here: step 8's copy never names it (step 2 does), and a
  // fourth pill in this frame had to sit right on top of the WAN socket — the
  // one thing this step exists to point at.
  labels.add('wired', rig, 'SoC keeps the NAT table', [SOC[0] + 0.18, BOARD_TOP + 0.06, SOC[1] - 0.16], 24, 172);
  labels.add('wired', rig, 'Isolation magnetics', [JACK_X[2], BOARD_TOP + 0.06, JACK_Z + 0.2], -62, 178);

  // ==========================================================================
  //  POSE
  // ==========================================================================
  let revealed = false;
  let radomeOpen = 0;
  let wave24Amt = 0;
  let wave5Amt = 0;
  let airOn = false;
  let streamsOn = false;
  let beamAmt = 0;

  function setReveal(t) {
    const r = clamp01(t);
    revealed = r > 0.4;
    const ghosted = r > 0.02;
    const op = 1 - r * 0.88;
    for (const m of revealDim) {
      const mat = m.material;
      rememberGhostOrig(mat);
      const o = mat.userData.ghostOrig;
      mat.transparent = ghosted;
      mat.opacity = op;
      mat.depthWrite = !ghosted;
      // clearcoat renders at full strength regardless of opacity — a ghosted
      // lid with its coat left on still reads as a solid black slab
      mat.clearcoat = ghosted ? 0 : o.clearcoat;
      mat.metalness = ghosted ? o.metalness * 0.15 : o.metalness;
    }
    for (const o of internals) o.visible = revealed;
    for (const o of cosmetic) o.visible = !revealed;
  }

  // Only the featured antenna opens: three ghosted radomes at once read as a
  // thicket rather than a cutaway, and no camera ever features the other two.
  function setRadomeOpen(t) {
    radomeOpen = clamp01(t);
    const ghosted = radomeOpen > 0.02;
    const a = antennas[FEATURED];
    const mat = a.radome.material;
    rememberGhostOrig(mat);
    const o = mat.userData.ghostOrig;
    mat.transparent = ghosted;
    mat.opacity = 1 - radomeOpen * 0.88;
    mat.depthWrite = !ghosted;
    mat.clearcoat = ghosted ? 0 : o.clearcoat;
    a.inner.visible = radomeOpen > 0.5;
  }

  function setWaves(a) {
    wave24Amt = clamp01(a);
  }
  function setWaves5(a) {
    wave5Amt = clamp01(a);
  }
  function setPattern(on) {
    doughnut.visible = !!on;
  }
  function setClients(on) {
    clientGroup.visible = !!on;
  }
  function setAir(on) {
    airOn = !!on;
    for (const t of linkTubes) t.visible = airOn;
  }
  function setStreams(on) {
    streamsOn = !!on;
    for (const t of streamTubes) t.visible = streamsOn;
  }
  function setBeam(t) {
    beamAmt = clamp01(t);
    lobe.visible = beamAmt > 0.01;
    lobe.scale.setScalar(0.35 + beamAmt * 0.65);
    lobeMat.opacity = beamAmt * 0.22;
  }

  // Airtime: four slots per lap — the router, then each client in turn — with
  // a silent backoff gap at every boundary. Nothing is transmitting at u=0 or
  // u=1, which is exactly what makes the lap wrap on itself.
  const SLOTS = 4;
  function airtime(p) {
    const k = Math.floor(p * SLOTS) % SLOTS;
    const local = p * SLOTS - Math.floor(p * SLOTS);
    const head = (local - 0.16) / 0.68; // 0..1 inside the slot, silent either side
    return { slot: k, head, live: head > 0 && head < 1 };
  }

  function setPhase(u) {
    const p = ((u % 1) + 1) % 1;
    const breathe = 0.5 + 0.5 * Math.sin(p * TAU * 3); // whole cycles per lap

    // wired + RF flow through the machine
    wireFlow.update(p, revealed, 1, 0.95);
    for (const f of coaxFlow) f.update(p, revealed, 1, 0.9);

    // radiated rings
    for (const w of waves24) w.update(p, wave24Amt);
    for (const w of waves5) w.update(p, wave5Amt);

    // airtime: exactly one link carries a burst at a time
    const air = airOn ? airtime(p) : null;
    clients.forEach((c, i) => {
      const talking = !!air && air.live && air.slot === i + 1;
      const listening = !!air && air.live && air.slot === 0;
      // the MIMO step points every stream at one device, so that device is the
      // one that has to be lit
      const targeted = streamsOn && i === STREAM_TARGET;
      c.screen.material.emissiveIntensity = airOn
        ? talking
          ? 1.6
          : listening
            ? 0.9
            : 0.35
        : targeted
          ? 1.3 + breathe * 0.4
          : 0.45 + breathe * 0.25;
    });
    linkFlow.forEach((f, i) => {
      const active = !!air && air.live && (air.slot === 0 ? i === 0 : air.slot === i + 1);
      if (!air) {
        f.update(0, false);
      } else if (air.slot === 0) {
        f.burst(air.head, i === 0, 1, 0.95, 0.3); // the router's own turn
      } else {
        f.burst(air.head, air.slot === i + 1, -1, 0.95, 0.3); // that client's turn
      }
      linkTubes[i].material.opacity = airOn ? (active ? 0.55 : 0.05) : 0;
    });

    // MIMO streams — three at once, deliberately in step with each other
    streamFlow.forEach((f) => f.update(p, streamsOn, 1, 0.95));
    for (const t of streamTubes) t.material.opacity = streamsOn ? 0.18 + breathe * 0.18 : 0;

    // LEDs: power steady, the rest blinking on whole cycles
    ledEmitters.forEach((m, i) => {
      const k = i === 0 ? 1 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin((p * TAU + i) * (i + 1)));
      m.material.emissiveIntensity = 0.5 + k * 1.1;
    });
    ledMat.emissiveIntensity = 0.9 + breathe * 0.5;
    ledMat.opacity = 0.86 + breathe * 0.14;

    if (beamAmt > 0.01) lobeMat.opacity = beamAmt * (0.16 + breathe * 0.1);
    patternMat.opacity = 0.1 + breathe * 0.07;
  }

  function setLabels(mode) {
    labels.setLabels(mode);
  }

  // initial: sealed product, radiating, nothing else drawn
  setReveal(0);
  setRadomeOpen(0);
  setWaves(0);
  setWaves5(0);
  setPattern(false);
  setClients(false);
  setAir(false);
  setStreams(false);
  setBeam(0);
  setPhase(0);
  setLabels(false);

  return {
    group: sceneGroup,
    setReveal,
    setRadomeOpen,
    setWaves,
    setWaves5,
    setPattern,
    setClients,
    setAir,
    setStreams,
    setBeam,
    setPhase,
    setLabels,
    parts: {
      // wave/packet come first because they are what actually MOVES — every
      // other handle here is a static landmark, and a probe that hashes only
      // those would report every step frozen
      wave: waves24[FEATURED].rings[0],
      packet: wireFlow.dots[0],
      topShell,
      board,
      antenna: antennas[FEATURED].group,
      inner: antennas[FEATURED].inner,
      doughnut,
      lobe,
      clientGroup,
      heatSink,
      can24,
      switchChip,
    },
  };
}
