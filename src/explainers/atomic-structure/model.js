import * as THREE from 'three';
import { calloutSets } from '../../framework/callouts.js';
import { smooth, TAU } from '../../framework/motion.js';

// "How an atom works" — carbon-12, the second subject in this library with no
// parts to machine. Everything here is either a real particle or a real
// probability distribution; nothing is sculpted for looks.
//
// Reference facts (Wikipedia Atom / Atomic nucleus / Atomic orbital; NIST CODATA
// 2022 values; IUPAC atomic radii — cross-checked):
//  - Carbon-12 is 98.9% of all natural carbon: 6 protons, 6 neutrons,
//    6 electrons. The proton count alone is what makes it carbon; change it and
//    it is a different element, change only the neutrons and it is an isotope.
//  - Proton and neutron are almost the same size (charge radius ~0.84 fm) and
//    almost the same mass — the neutron is 0.14% heavier. Both are ~1836x the
//    mass of an electron, which is a point particle with no measured size.
//  - Nuclear radius follows R = 1.2 * A^(1/3) fm, so carbon-12 is 2.75 fm in
//    radius: about 2.9 nucleon-radii across. That ratio IS the packing this
//    model uses — twelve spheres on the vertices of an icosahedron, each
//    touching its neighbours, circumradius 1.902r, envelope 2.902r.
//  - The atom is 70 pm in radius (covalent) against the nucleus's 2.75 fm:
//    the nucleus is ~1/25,000 of the width and ~1/1.6e13 of the volume, yet
//    carries 99.97% of the mass (6mp + 6mn against 6me, CODATA). Everything
//    else is electron.
//  - Shells fill 2n^2: n=1 holds 2, n=2 holds 8. Carbon puts 2 in the first
//    and 4 in the second, leaving four half-filled slots — which is the entire
//    reason carbon bonds to four things at once and organic chemistry exists.
//  - Electrons do not travel on rails. The 1s radial probability peaks at
//    a0/Z_eff and the 2p at ~4a0/Z_eff, and BETWEEN those peaks the electron is
//    simply somewhere with a probability. The point clouds here are sampled
//    from the real hydrogen-like radial densities, r^2*e^(-2r/a) for 1s,
//    r^2*(2-r/a)^2*e^(-r/a) for 2s and r^4*e^(-r/a)*cos^2(theta) for each 2p
//    lobe, each scaled so its peak lands on this model's shell radius.
//  - Carbon's 2p electrons occupy two of the three p orbitals singly (Hund's
//    rule), leaving the third empty — drawn dim here rather than omitted.
//
// TWO DISCLOSED DISTORTIONS, both unavoidable and both called out in the copy:
//  1. The nucleus is drawn ~1000x too big for the shells. At true scale it is
//     4e-5 of the atom's radius — a sub-pixel speck at any framing that shows
//     the electrons. Step 8 shrinks it toward the truth and says so.
//  2. Shell spacing is compressed. The real 1s peak sits at ~1/8 of the 2p
//     peak; drawn that way the inner shell disappears inside the oversized
//     nucleus, so the ratio here is 2.3.

// ---------------------------------------------------------------------------
// world constants — every nuclear length derives from the nucleon radius,
// exactly as R = 1.2 * A^(1/3) does
// ---------------------------------------------------------------------------
const R_NUCLEON = 0.082;
const ICO_CIRCUM = Math.sqrt(1 + ((1 + Math.sqrt(5)) / 2) ** 2); // 1.9021
const R_CLUSTER = ICO_CIRCUM * R_NUCLEON; // vertices sit here; neighbours touch
const R_ENVELOPE = R_CLUSTER + R_NUCLEON; // 2.902 * r, the real C-12 ratio

const R_K = 0.52; // n=1 shell
const R_L = 1.20; // n=2 shell
const CENTER_Y = 2.05;

const ACCENT = 0x5ec8ff;
const CLOUD_INNER = 0x8fe4ff;
const CLOUD_OUTER = 0x5aa8ff;

// Integer cycles per lap, so every wrap lands on an identical pose.
const JIGGLE_CYCLES = 3; // nucleon thermal shuffle
const BIND_CYCLES = 4; // strong-force pulse / cluster breathe
const REPEL_CYCLES = 2; // proton "try to fly apart" bumps

// ---------------------------------------------------------------------------
// deterministic sampling — the cloud must be byte-identical on every load or
// the review screenshots stop being comparable
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Inverse-CDF sampler for a radial probability density on [0, rMax]. Built
// once per distribution; sampling is then a binary search.
function radialSampler(pdf, rMax, N = 600) {
  const cdf = new Float64Array(N + 1);
  let acc = 0;
  for (let i = 0; i < N; i++) {
    const r0 = (i / N) * rMax;
    const r1 = ((i + 1) / N) * rMax;
    acc += ((pdf(r0) + pdf(r1)) / 2) * (rMax / N);
    cdf[i + 1] = acc;
  }
  for (let i = 0; i <= N; i++) cdf[i] /= acc || 1;
  return (u) => {
    let lo = 1;
    let hi = N;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (cdf[m] < u) lo = m + 1;
      else hi = m;
    }
    const span = Math.max(cdf[lo] - cdf[lo - 1], 1e-12);
    return ((lo - 1 + (u - cdf[lo - 1]) / span) / N) * rMax;
  };
}

// Soft round sprite — square points read as pixel dirt at any size.
function dotTexture() {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Half-profile of a 2p boundary surface, for LatheGeometry. `cFrac` is the
// contour level as a fraction of the peak density — a quarter gives the
// elongated teardrop pair chemistry draws, rather than the two tangent spheres
// the cruder r = R|cos(theta)| shorthand produces.
function lobeProfile(a, cFrac = 0.25, N = 110) {
  const f = (r) => r * r * Math.exp(-r / a);
  const fmax = f(2 * a); // the density peaks at r = 2a
  const c = cFrac * fmax;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * Math.PI;
    const c2 = Math.cos(th) ** 2;
    let r = 0;
    const target = c2 > 1e-6 ? c / c2 : Infinity;
    if (target < fmax) {
      // the OUTER root, on f's decreasing branch beyond the peak
      let lo = 2 * a;
      let hi = 30 * a;
      for (let k = 0; k < 44; k++) {
        const mid = (lo + hi) / 2;
        if (f(mid) > target) lo = mid;
        else hi = mid;
      }
      r = (lo + hi) / 2;
    }
    // Lathe needs x >= 0, and an exactly-zero radius makes a degenerate ring
    pts.push(new THREE.Vector2(Math.max(r * Math.sin(th), 1e-4), r * Math.cos(th)));
  }
  return pts;
}

function pointCloud(count, sampleInto, color, size, map) {
  const pos = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    sampleInto(v);
    pos[i * 3] = v.x;
    pos[i * 3 + 1] = v.y;
    pos[i * 3 + 2] = v.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color,
    size,
    map,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.visible = false;
  return pts;
}

// A tapered comet tail behind an orbiting electron: a tube swept along a
// circular arc, its vertex colours ramping to black at the tail. Under
// additive blending black contributes nothing, so the fade needs no per-vertex
// alpha channel. `sign` mirrors the arc for counter-rotating shells.
function trailArc(radius, arcRad, tubeR, color, sign) {
  const SEG = 42;
  const RAD = 6;
  const pts = [];
  for (let i = 0; i <= SEG; i++) {
    const a = -arcRad * (1 - i / SEG) * sign;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, -Math.sin(a) * radius));
  }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), SEG, tubeR, RAD, false);
  const base = new THREE.Color(color);
  const col = new Float32Array((SEG + 1) * (RAD + 1) * 3);
  for (let i = 0; i <= SEG; i++) {
    const k = (i / SEG) ** 2.2; // 0 at the tail, 1 at the electron
    for (let j = 0; j <= RAD; j++) {
      const o = (i * (RAD + 1) + j) * 3;
      col[o] = base.r * k;
      col[o + 1] = base.g * k;
      col[o + 2] = base.b * k;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Mesh(geo, mat);
}

// ---------------------------------------------------------------------------
// the backdrop. `space: true` strips the studio sweep and the shadow floor —
// correct, since an atom has no ground — but leaves the subject floating on
// the flat page colour without this. Flat pure black (2026-08-19, confirmed
// against a gradient pass): this scene's only light sources are small
// emissive particles, so any lifted patch behind them reads as a lit room
// rather than depth. On the cloud-heavy steps the electron point-sprites
// supply all the texture a gradient would otherwise be doing; on the early
// steps flat black gives the cleanest separation from the model.
// ---------------------------------------------------------------------------
const SKY_VERT = /* glsl */ `
void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const SKY_FRAG = /* glsl */ `
precision mediump float;
void main() {
  gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}
`;

const ICO_SITES = (() => {
  const phi = (1 + Math.sqrt(5)) / 2;
  const out = [];
  // Three mutually orthogonal golden rectangles. Taking the two DIAGONAL
  // corners of each as protons interleaves 6 and 6 perfectly — there is no
  // angle this can be viewed from that shows an all-red or all-grey face.
  for (let ax = 0; ax < 3; ax++) {
    for (const s1 of [1, -1]) {
      for (const s2 of [1, -1]) {
        const v = [0, 0, 0];
        v[(ax + 1) % 3] = s1;
        v[(ax + 2) % 3] = s2 * phi;
        out.push({ raw: new THREE.Vector3(...v), proton: s1 * s2 > 0 });
      }
    }
  }
  return out;
})();

export function buildAtom({ scene, stage }) {
  const disposables = [];
  const track = (x) => {
    disposables.push(x);
    return x;
  };

  // --- backdrop (in the scene, NOT under root: the player's hero bob moves
  // root, and a sky that bobs with the subject is a sky that is not a sky) ---
  const skyUniforms = { uRes: { value: new THREE.Vector2(1, 1) } };
  const skyMat = track(
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
      fog: false,
    }),
  );
  const sky = new THREE.Mesh(track(new THREE.SphereGeometry(40, 16, 10)), skyMat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  sky.onBeforeRender = (r) => r.getDrawingBufferSize(skyUniforms.uRes.value);
  scene.add(sky);

  const root = new THREE.Group();
  root.position.set(0, CENTER_Y, 0);
  scene.add(root);

  // Turntable lives on its own group so `root` stays axis-aligned — the label
  // anchors below are placed in root-local coordinates from world positions.
  const atom = new THREE.Group();
  root.add(atom);

  const labels = calloutSets([
    'nucleus',
    'protons',
    'neutrons',
    'shells',
    'cloud',
    'orbitals',
    'scale',
  ]);

  // -------------------------------------------------------------------------
  // the nucleus: twelve nucleons on the vertices of an icosahedron
  // -------------------------------------------------------------------------
  const nucleus = new THREE.Group();
  atom.add(nucleus);

  const nucleonGeo = track(new THREE.SphereGeometry(R_NUCLEON, 30, 22));
  const protonMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xd63a2c,
      metalness: 0.05,
      roughness: 0.33,
      clearcoat: 0.55,
      clearcoatRoughness: 0.26,
      emissive: 0x5a1006,
      emissiveIntensity: 0.5,
    }),
  );
  const neutronMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x8592a0,
      metalness: 0.08,
      roughness: 0.52,
      clearcoat: 0.3,
      clearcoatRoughness: 0.44,
      emissive: 0x11171d,
      emissiveIntensity: 0.5,
    }),
  );

  const scaleToWorld = R_CLUSTER / ICO_CIRCUM;
  const nucleons = ICO_SITES.map(({ raw, proton }, i) => {
    const home = raw.clone().multiplyScalar(scaleToWorld);
    const mesh = new THREE.Mesh(nucleonGeo, proton ? protonMat : neutronMat);
    mesh.castShadow = true;
    nucleus.add(mesh);
    // a fixed per-nucleon jiggle axis and phase — deterministic, so the two
    // review captures of a step are comparable
    const jx = Math.sin(i * 2.399);
    const jy = Math.cos(i * 1.717);
    const jz = Math.sin(i * 3.061 + 1.1);
    const axis = new THREE.Vector3(jx, jy, jz).normalize();
    return { mesh, home, proton, axis, phase: (i * 0.618) % 1, pos: new THREE.Vector3() };
  });
  const protons = nucleons.filter((n) => n.proton);
  const neutrons = nucleons.filter((n) => !n.proton);

  // --- the strong force, drawn as the bonds between touching nucleons -------
  // Posed from the live nucleon positions every frame, so they stretch when the
  // protons try to push apart and snap back when the force wins.
  const linkGeo = track(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true));
  const linkMat = track(
    new THREE.MeshBasicMaterial({
      color: 0x7fd0ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const links = [];
  for (let i = 0; i < ICO_SITES.length; i++) {
    for (let j = i + 1; j < ICO_SITES.length; j++) {
      // raw icosahedron edge length is exactly 2 for this construction
      if (ICO_SITES[i].raw.distanceToSquared(ICO_SITES[j].raw) > 4.5) continue;
      const mesh = new THREE.Mesh(linkGeo, linkMat);
      mesh.visible = false;
      nucleus.add(mesh);
      links.push({ mesh, a: i, b: j });
    }
  }

  // -------------------------------------------------------------------------
  // electron shells. Three rings at large mutual angles: the K shell's pair,
  // and the L shell's four split across two counter-rotating planes so the
  // outer shell reads as a three-dimensional distribution rather than a hoop.
  // Turns per lap are whole numbers, and inner beats outer, as it does really.
  // -------------------------------------------------------------------------
  const SHELL_SPECS = [
    { radius: R_K, axis: [0.22, 1, 0.12], turns: 5, offsets: [0, 0.5] },
    { radius: R_L, axis: [1, 0.3, 0.18], turns: 3, offsets: [0, 0.5] },
    { radius: R_L, axis: [-0.34, 0.28, 1], turns: -3, offsets: [0.25, 0.75] },
  ];

  const ringMat = track(
    new THREE.MeshBasicMaterial({
      color: 0x2f6f96,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const electronGeo = track(new THREE.SphereGeometry(0.042, 20, 14));
  const UP = new THREE.Vector3(0, 1, 0);

  const shells = SHELL_SPECS.map(({ radius, axis, turns, offsets }) => {
    const group = new THREE.Group();
    const n = new THREE.Vector3(...axis).normalize();
    group.quaternion.setFromUnitVectors(UP, n);
    atom.add(group);

    const ring = new THREE.Mesh(track(new THREE.TorusGeometry(radius, 0.005, 6, 180)), ringMat);
    ring.rotation.x = Math.PI / 2; // torus is authored in XY; the orbit is XZ
    group.add(ring);

    const sign = Math.sign(turns) || 1;
    const electrons = offsets.map((off) => {
      const pivot = new THREE.Group();
      group.add(pivot);
      const mat = track(
        new THREE.MeshStandardMaterial({
          color: 0xbfeeff,
          emissive: ACCENT,
          emissiveIntensity: 2.1,
          roughness: 0.3,
          metalness: 0,
          transparent: true,
          opacity: 1,
          depthWrite: true,
        }),
      );
      const mesh = new THREE.Mesh(electronGeo, mat);
      mesh.position.set(radius, 0, 0);
      pivot.add(mesh);
      const trail = trailArc(radius, 1.15, 0.016, ACCENT, sign);
      pivot.add(trail);
      return { pivot, mesh, trail, off };
    });

    return { group, ring, electrons, radius, turns, normal: n };
  });
  const allElectrons = shells.flatMap((s) => s.electrons.map((e) => e.mesh));

  // -------------------------------------------------------------------------
  // the probability clouds — sampled from the real hydrogen-like densities
  // -------------------------------------------------------------------------
  const rnd = mulberry32(0x0c0c0c);
  const dots = track(dotTexture());

  const a1s = R_K; // r^2 e^(-2r/a) peaks at exactly a
  const a2s = R_L / 5.24; // outer lobe of r^2 (2 - r/a)^2 e^(-r/a)
  const a2p = R_L / 4; // r^4 e^(-r/a) peaks at 4a

  const s1s = radialSampler((r) => r * r * Math.exp((-2 * r) / a1s), 1.9);
  const s2s = radialSampler((r) => r * r * (2 - r / a2s) ** 2 * Math.exp(-r / a2s), 2.4);
  // truncated at 2.2 rather than run out to the tail: the far samples land one
  // per few hundred pixels and read as a starfield, not as a probability fog
  const s2p = radialSampler((r) => r ** 4 * Math.exp(-r / a2p), 2.2);

  const sphericalInto = (sampler) => (v) => {
    const r = sampler(rnd());
    const c = 2 * rnd() - 1;
    const s = Math.sqrt(Math.max(0, 1 - c * c));
    const p = TAU * rnd();
    v.set(r * s * Math.cos(p), r * c, r * s * Math.sin(p));
  };

  // Carbon's n=2 shell is 2s^2 2p^2, so the round "outer shell" cloud is an
  // even mix of the two shapes — which is also why it has a faint inner
  // shoulder where the 2s radial node sits.
  const fill2s = sphericalInto(s2s);
  const fill2p = sphericalInto(s2p);
  const fillL = (v) => (rnd() < 0.5 ? fill2s(v) : fill2p(v));

  const cloud1s = pointCloud(5200, sphericalInto(s1s), CLOUD_INNER, 0.038, dots);
  const cloudL = pointCloud(13000, fillL, CLOUD_OUTER, 0.050, dots);
  atom.add(cloud1s, cloudL);
  track(cloud1s.geometry);
  track(cloud1s.material);
  track(cloudL.geometry);
  track(cloudL.material);

  // The 2s orbital gets a boundary surface too, for the same reason as the p
  // lobes — as a point cloud at any density that read the shape it needed to,
  // it also filled a 600px disc and buried the dumbbells behind it. A soft
  // shell says "round, and this big" and still lets the lobes through.
  const shell2s = new THREE.Mesh(
    track(new THREE.SphereGeometry(1.45, 48, 32)),
    track(
      new THREE.MeshBasicMaterial({
        color: 0xa4d4ff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  shell2s.visible = false;
  atom.add(shell2s);

  // Carbon's two 2p electrons sit in two of the three p orbitals (Hund's rule);
  // the third stays empty and is drawn dim rather than left out. The empty one
  // is deliberately the VERTICAL lobe: its callout then holds still under the
  // turntable instead of sweeping behind the text panel.
  //
  // Drawn as SURFACES, not point clouds. Two p orbitals at right angles sum to
  // a donut — cos^2 is broad enough that three of them as overlapping fogs come
  // out very nearly spherical, which is mathematically true and visually
  // useless. A boundary surface is what chemistry actually draws, and it is
  // derived rather than sculpted: solve r^2 e^(-r/a) cos^2(theta) = c for r at
  // every polar angle and lathe the answer. The result is the familiar pair of
  // pinched teardrops, pinching to nothing at the nucleus because cos^2 does.
  const lobeGeo = track(new THREE.LatheGeometry(lobeProfile(a2p), 72));
  const lobes = [0, 1, 2].map((ax) => {
    const filled = ax !== 1;
    const mat = track(
      new THREE.MeshBasicMaterial({
        color: filled ? 0x4fd6ff : 0x6d8aa4,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const mesh = new THREE.Mesh(lobeGeo, mat);
    if (ax === 0) mesh.rotation.z = -Math.PI / 2; // lathe axis Y -> X
    else if (ax === 2) mesh.rotation.x = Math.PI / 2; // -> Z
    mesh.visible = false;
    atom.add(mesh);
    return { pts: mesh, filled };
  });

  // -------------------------------------------------------------------------
  // callout anchors
  // -------------------------------------------------------------------------
  // `frame` copies the camera's orientation, so its local +X is screen-right
  // and +Y screen-up: anchors placed in it stay clear of the text panel from
  // every bearing, without nine hand-tuned positions.
  const frame = new THREE.Object3D();
  root.add(frame);
  const anchor = (parent, x = 0, y = 0, z = 0) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };

  // world-tracking anchors: re-aimed each frame at whichever real particle is
  // furthest screen-right, so the pill always names a part you can actually see
  const aProton = anchor(root);
  const aRepel = anchor(root);
  const aNeutron = anchor(root);
  const aGlue = anchor(root);
  // on-ring anchors: the exact screen-rightmost point of each orbit circle, so
  // electrons pass straight through the label they are named by
  const aShellK = anchor(root);
  const aShellL = anchor(root);
  const aElectron = anchor(root);

  const aStrong = anchor(root); // rides a real bond, aimed each frame
  const aCloud = anchor(frame, 1.15, 0.86, 0);
  const aCount = anchor(frame, 0.42, -0.98, 0);
  const aLobe = anchor(frame, 1.5, 0.62, 0);
  const aEmpty = anchor(atom, 0, 1.55, 0); // the vertical, unoccupied 2p lobe
  const aRound = anchor(frame, 0.34, -0.72, 0);
  const aSpeck = anchor(frame, 0.2, 0.22, 0);
  const aEmpty2 = anchor(frame, 0.98, -0.46, 0);

  // Three labels live at once on the nucleus step, all on the same small
  // cluster: the anchors are biased into an upper / middle / lower band (see
  // updateAnchors) and the leaders fan the same way, so they never stack up.
  labels.add('nucleus', aProton, 'Proton · +1', [0, 0, 0], 18, 76);
  labels.add('nucleus', aStrong, 'Strong force binds them', [0, 0, 0], 84, 92);
  labels.add('nucleus', aNeutron, 'Neutron · no charge', [0, 0, 0], -42, 84);

  labels.add('protons', aProton, '6 protons', [0, 0, 0], 28, 66);
  labels.add('protons', aRepel, 'Like charges repel', [0, 0, 0], -40, 76);

  labels.add('neutrons', aNeutron, '6 neutrons', [0, 0, 0], -36, 70);
  labels.add('neutrons', aGlue, 'Mass, no repulsion', [0, 0, 0], 34, 76);

  labels.add('shells', aShellK, 'First shell · 2', [0, 0, 0], 100, 60);
  labels.add('shells', aShellL, 'Second shell · 4 of 8', [0, 0, 0], 200, 80);
  labels.add('shells', aElectron, 'Electron · −1', [0, 0, 0], 150, 70);

  // Leaders on the far-right anchors are authored pointing LEFT rather than
  // left to the runtime declutter to mirror. The declutter's last pass before
  // a headless capture can land while the camera is still flying, so a pill
  // that only fits after mirroring gets measured on its authored (overflowing)
  // side. Author the side that actually fits and the question never arises.
  labels.add('cloud', aCloud, 'Where it probably is', [0, 0, 0], 142, 78);
  labels.add('cloud', aCount, 'Still 6 electrons', [0, 0, 0], -32, 76);

  labels.add('orbitals', aLobe, '2p orbital · occupied', [0, 0, 0], 155, 78);
  labels.add('orbitals', aRound, '2s orbital · round', [0, 0, 0], -36, 78);
  labels.add('orbitals', aEmpty, 'This 2p sits empty', [0, 0, 0], 62, 76);

  labels.add('scale', aSpeck, 'True nucleus, near enough', [0, 0, 0], 40, 82);
  labels.add('scale', aEmpty2, 'The rest is electron', [0, 0, 0], 206, 74);

  // -------------------------------------------------------------------------
  // one state object, one pose function
  // -------------------------------------------------------------------------
  const S = {
    phase: 0,
    spinTurns: 1, // turntable turns per lap (whole numbers only)
    nucleusOn: 1,
    ringsOn: 1, // orbit rings + electrons + trails
    bind: 0, // strong-force links, and the breathing that reveals them
    repel: 0, // protons bump outward and get hauled back
    protonGlow: 0,
    neutronGlow: 0,
    cloud1s: 0,
    cloudL: 0, // the round summed n=2 shell
    cloud2s: 0, // the 2s sphere, shown alongside the p lobes
    lobes: 0,
    shrink: 0, // nucleus toward its true relative size
  };

  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();

  function apply() {
    const p = S.phase;
    atom.rotation.y = p * TAU * S.spinTurns;

    // --- nucleons -----------------------------------------------------------
    // The cluster drifts apart and gets hauled back four times a lap. That is
    // not decoration: at rest the nucleons touch, so the bonds between them are
    // buried and the strong force has nothing on screen. The gap is what makes
    // it visible — and a nucleus really does breathe like this.
    const bindPulse = S.bind * (0.5 - 0.5 * Math.cos(TAU * BIND_CYCLES * p));
    const breathe = 1 + 0.19 * bindPulse;
    const bumpRaw = Math.max(
      0,
      1 - Math.abs((((p * REPEL_CYCLES) % 1) + 1) % 1 - 0.5) / 0.3,
    );
    const bump = S.repel * smooth(bumpRaw);
    const jig = TAU * JIGGLE_CYCLES * p;

    nucleus.visible = S.nucleusOn > 0.001;
    // one whole extra turn of the cluster per lap, on top of the turntable: the
    // orbital step holds the turntable still to keep the lobe cross square to
    // camera, and a nucleus that froze with it would look switched off
    nucleus.rotation.y = p * TAU;
    const shrinkK = S.shrink * (0.5 - 0.5 * Math.cos(TAU * p));
    nucleus.scale.setScalar(1 - shrinkK * 0.955);

    for (const n of nucleons) {
      n.pos
        .copy(n.home)
        .multiplyScalar(breathe + (n.proton ? bump * 0.55 : 0))
        .addScaledVector(n.axis, 0.011 * Math.sin(jig + TAU * n.phase));
      n.mesh.position.copy(n.pos);
    }
    protonMat.emissiveIntensity = 0.5 + 1.5 * S.protonGlow;
    neutronMat.emissiveIntensity = 0.5 + 0.9 * S.neutronGlow;

    // --- strong-force links -------------------------------------------------
    // brightest at full stretch, so the flare reads as the force catching them
    linkMat.opacity = 0.16 * S.bind + 0.8 * bindPulse;
    const linksOn = S.bind > 0.001;
    for (const l of links) {
      l.mesh.visible = linksOn;
      if (!linksOn) continue;
      const a = nucleons[l.a].pos;
      const b = nucleons[l.b].pos;
      tmpA.addVectors(a, b).multiplyScalar(0.5);
      tmpB.subVectors(b, a);
      const len = tmpB.length() || 1e-4;
      l.mesh.position.copy(tmpA);
      l.mesh.quaternion.copy(tmpQ.setFromUnitVectors(UP, tmpB.divideScalar(len)));
      l.mesh.scale.set(0.0038, len, 0.0038);
    }

    // --- electrons ----------------------------------------------------------
    const ringsVisible = S.ringsOn > 0.001;
    ringMat.opacity = 0.55 * S.ringsOn;
    for (const sh of shells) {
      sh.group.visible = ringsVisible;
      for (const e of sh.electrons) {
        e.pivot.rotation.y = TAU * (p * sh.turns + e.off);
        e.mesh.material.opacity = S.ringsOn;
        e.mesh.material.emissiveIntensity = 2.1 * S.ringsOn;
        e.trail.material.opacity = 0.85 * S.ringsOn;
      }
    }

    // --- clouds -------------------------------------------------------------
    const fade = (pts, k, peak) => {
      pts.visible = k > 0.001;
      pts.material.opacity = peak * k;
    };
    fade(cloud1s, S.cloud1s, 0.85);
    fade(cloudL, S.cloudL, 0.62);
    fade(shell2s, S.cloud2s, 0.055);
    for (const l of lobes) fade(l.pts, S.lobes, l.filled ? 0.26 : 0.1);

    updateAnchors();
  }

  // --- per-frame framing work ----------------------------------------------
  const camRight = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  const seek = new THREE.Vector3();
  const world = new THREE.Vector3();
  const ndc = new THREE.Vector3();
  const ringU = new THREE.Vector3();
  const ringV = new THREE.Vector3();

  // Point the anchor at whichever member of `list` projects furthest right —
  // so the pill always names a particle the viewer can actually see, and never
  // drifts under the text panel. `yBias` tips the choice up or down the frame:
  // the proton and neutron labels are on at the same time, and without it both
  // pick nearly the same spot on the cluster and collide.
  const pickPos = new THREE.Vector3();
  function aimAtRightmost(target, list, { x = 1, y = 0, toward = 0 } = {}) {
    let found = false;
    let bestScore = -Infinity;
    for (const m of list) {
      m.getWorldPosition(world);
      ndc.copy(world).project(stage.camera);
      if (ndc.z > 1) continue;
      const score = x * ndc.x + y * ndc.y;
      if (score > bestScore) {
        bestScore = score;
        pickPos.copy(world);
        found = true;
      }
    }
    if (!found) return;
    lift(pickPos, toward);
    target.position.copy(root.worldToLocal(pickPos));
  }

  // Slide a world anchor a fraction of the way toward the camera. Free of
  // charge: a point moved along the ray it already sits on projects to exactly
  // the same pixel, so the dot stays on its particle — but the framework's
  // occlusion pass stops fading the pill to 32% for being buried behind
  // whatever is in front of it, which reads as a bug rather than as depth.
  // Halfway is comfortably clear of anything in this scene.
  function lift(v, toward) {
    if (toward) v.lerp(stage.camera.position, toward);
  }

  // The extreme point of an orbit circle in a chosen SCREEN direction, solved
  // rather than searched: max over t of dot(seek, R(cos t * u + sin t * v)) is
  // at atan2(seek.v, seek.u). `dirDeg` is that direction (0 = screen right,
  // 90 = up) — three ring labels are on at once in the shell step, and taken
  // all at "rightmost" they land in one horizontal row on top of each other.
  function aimAtRingEdge(target, shell, dirDeg = 0, toward = 0.5) {
    const rad = (dirDeg * Math.PI) / 180;
    seek.copy(camRight).multiplyScalar(Math.cos(rad)).addScaledVector(camUp, Math.sin(rad));
    ringU.set(1, 0, 0).applyQuaternion(shell.group.getWorldQuaternion(tmpQ));
    ringV.set(0, 0, -1).applyQuaternion(tmpQ);
    const t = Math.atan2(seek.dot(ringV), seek.dot(ringU));
    world
      .copy(shell.group.getWorldPosition(tmpA))
      .addScaledVector(ringU, Math.cos(t) * shell.radius)
      .addScaledVector(ringV, Math.sin(t) * shell.radius);
    lift(world, toward);
    target.position.copy(root.worldToLocal(world));
  }

  const protonMeshes = protons.map((n) => n.mesh);
  const neutronMeshes = neutrons.map((n) => n.mesh);
  const linkMeshes = links.map((l) => l.mesh);

  // Called from apply() as well as from the tick, deliberately: the
  // verification and screenshot tools pause the timeline, seek it and measure
  // in ONE synchronous block, so no animation frame runs in between. An anchor
  // that only re-aimed on tick would be measured at the previous pose.
  function updateAnchors() {
    const cam = stage.camera;
    frame.quaternion.copy(cam.quaternion);
    root.updateMatrixWorld(true);
    camRight.set(1, 0, 0).applyQuaternion(cam.quaternion);
    camUp.set(0, 1, 0).applyQuaternion(cam.quaternion);
    // three separate bands of the frame — mid-right, top, lower-right — so the
    // nucleus step's three simultaneous pills never stack on each other
    aimAtRightmost(aProton, protonMeshes, { y: 0.2, toward: 0.5 });
    aimAtRightmost(aRepel, protonMeshes, { y: -1, toward: 0.5 });
    aimAtRightmost(aStrong, linkMeshes, { x: 0.35, y: 1, toward: 0.5 });
    aimAtRightmost(aNeutron, neutronMeshes, { y: -1, toward: 0.5 });
    aimAtRightmost(aGlue, neutronMeshes, { y: 0.9, toward: 0.5 });
    aimAtRingEdge(aShellK, shells[0], 90);
    aimAtRingEdge(aShellL, shells[1], -20);
    aimAtRingEdge(aElectron, shells[2], 25);
  }

  const stopTick = stage.onTick(updateAnchors);

  apply();

  return {
    group: root,
    parts: { atom, nucleus, shells, cloud1s, cloudL, shell2s, lobes, electrons: allElectrons },
    set(patch) {
      Object.assign(S, patch);
      apply();
    },
    setLabels: labels.setLabels,
    dispose() {
      stopTick();
      scene.remove(root);
      scene.remove(sky);
      for (const d of disposables) d.dispose?.();
      root.traverse((o) => {
        o.geometry?.dispose?.();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
        }
      });
    },
  };
}
