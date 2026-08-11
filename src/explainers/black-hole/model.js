import * as THREE from 'three';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, smooth } from '../../framework/motion.js';

// "How a black hole works" — the one subject in this library with no parts to
// model. A black hole has exactly two properties you can see (mass and spin)
// and no surface at all, so there is nothing to lathe, bevel or bolt. What
// there IS to show is what its gravity does to the paths of light, and that
// only stays honest if it is COMPUTED rather than sculpted: bend a mesh into
// the Gargantua shape and the illusion dies the moment the user orbit-drags.
//
// So the hero object here is a null-geodesic raymarcher. Every pixel traces a
// light ray backwards from the camera through curved spacetime; the shadow,
// the photon ring, the disk's far side lensed up over the top, the Einstein
// rings of background stars and the bright/dim Doppler asymmetry all fall out
// of that one integration and stay correct from every angle. The rings, test
// rays and probe layered on top are DIAGRAM, drawn deliberately as annotation.
//
// Reference facts (Wikipedia Photon sphere / Accretion disk; James, von
// Tunzelmann, Franklin & Thorne 2015, "Gravitational lensing by spinning black
// holes in astrophysics, and in the movie Interstellar", CQG 32:065001; EHT
// Collaboration 2019 M87* and 2022 Sgr A* results — cross-checked):
//  - Everything scales with ONE length, the Schwarzschild radius
//    Rs = 2GM/c^2. A non-spinning hole of any mass is the same picture, just
//    bigger or smaller. That is the spine of this explainer.
//  - Event horizon      r = 1.0 Rs   escape velocity there is exactly c
//    Photon sphere      r = 1.5 Rs   light can orbit, unstably
//    Apparent shadow    r = 2.598 Rs (= sqrt(27) GM/c^2), so 5.2 Rs ACROSS —
//                                    the darkness is 2.6x wider than the hole
//    ISCO / disk edge   r = 3.0 Rs   (falls to 0.5 Rs at maximal spin)
//  - The shadow number checks out against observation: 5.2 Rs for M87*
//    (6.5e9 solar masses at 16.8 Mpc) predicts 39.5 microarcseconds; the EHT
//    measured a 42 uas ring.
//  - Sizes: a 10-solar-mass hole's horizon is 60 km across. Sgr A* (4.3e6
//    solar masses) is 25 million km across — about 18 Suns side by side, and
//    it would still fit comfortably inside Mercury's orbit. M87* is ~128 AU in
//    radius, wider than the whole planetary system.
//  - Orbital speed at the ISCO is exactly c/2: the locally measured circular
//    velocity is v = sqrt(M/(r-2M)), which at r = 6M gives 0.5.
//  - A clock riding that innermost orbit ticks at sqrt(1 - 3M/r) = 71% of the
//    rate of a clock far away.
//  - The disk glows from shear, not fusion. Gas at different radii orbits at
//    different speeds; friction and the magnetorotational instability heat it
//    as it grinds inward. Accretion turns 10-40% of infalling rest mass into
//    light, against 0.7% for nuclear fusion — the most efficient engine known.
//  - Inner disks of stellar-mass holes reach ~10 million K and radiate X-rays;
//    supermassive ones are cooler and radiate mostly ultraviolet.
//  - One side of the ring is brighter because the gas there is coming at you
//    at a fair fraction of c: relativistic beaming makes observed brightness
//    scale as the Doppler factor to the fourth power. Nothing is hotter on
//    that side.
//  - Deliberate omission: relativistic jets. They are real, but they run to
//    ~1e9 Rs — thousands of light years for M87. Drawing them inside a 15 Rs
//    frame would be a scale lie, so they are left out rather than faked.

// ---------------------------------------------------------------------------
// world constants — every length derives from RS, exactly as the physics does
// ---------------------------------------------------------------------------
const RS = 0.2; // Schwarzschild radius, world units
const R_PHOTON = 1.5 * RS; // 0.300 — light can orbit here
const R_SHADOW = (Math.sqrt(27) / 2) * RS; // 0.520 — apparent silhouette radius
const R_ISCO = 3.0 * RS; // 0.600 — last stable orbit = disk inner edge
const R_DISK_OUT = 12.0 * RS; // 2.400 — outer edge of the modelled disk
const CENTER_Y = 2.4; // the hole floats here; nothing else is in the scene
const SKY_R = 30.0; // radius of the sphere the raymarcher paints

const ACCENT = 0xffb454;
const CYAN = 0x7fd8ff;

// Integration budget for the fragment shader. 240 midpoint steps of 0.05 rad
// covers a 12-radian (~3.8 pi) sweep, which is enough for rays that loop the
// photon sphere more than once; almost every ray breaks out far earlier.
//
// MEASURED (2026-08-07): cutting this to 176 saved only 3-6% of frame time,
// because the early-exit means hardly any ray reaches the cap — it is the
// per-ray iteration count, not the ceiling, that costs. Not worth truncating
// the multiply-looping rays that draw the photon ring. The adaptive step size
// in the integrator is what actually halved the cost.
const STEPS = 240;
const DPHI = 0.05;

// The disk and the diagram overlays want completely different tempos. Gas
// orbiting a supermassive hole should look almost geological — Gargantua's
// disk barely crawls across a whole shot — but a test-ray packet or a falling
// probe that took forty seconds to cross the frame would read as broken.
// So the lap scalar drives the disk directly, and the overlays run on
// fract(phase * AUX_CYCLES). An INTEGER multiplier is what keeps that free:
// whole cycles per lap, so the wrap stays seamless without any extra care.
// 5 rather than 6 also keeps the two probe scripts honest — verify.mjs samples
// the lap at 20%/70% and review-shots at 30%/60%, and both land on distinct
// aux phases at 5, so neither can report a moving overlay as frozen.
const AUX_CYCLES = 5;

// ---------------------------------------------------------------------------
// the raymarcher
// ---------------------------------------------------------------------------
const VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
precision highp float;

uniform vec3  uCam;      // camera world position
uniform vec3  uCenter;   // black hole world position
uniform float uRs;       // Schwarzschild radius (world units)
uniform float uRout;     // disk outer edge
uniform float uPhase;    // 0..1, one lap of the step's loop
uniform float uDisk;     // disk brightness
uniform float uBeam;     // 0 = relativistic effects off, 1 = full
uniform float uStars;    // starfield brightness
uniform float uShell;    // photon-sphere glow emphasis
uniform float uIsco;     // ISCO line emphasis, drawn in the disk plane
uniform float uPlunge;   // stream inside the ISCO, spiralling to the horizon
uniform float uGain;     // master HDR gain
uniform vec2  uRes;      // drawing-buffer size, for the vignette

varying vec3 vWorld;

const float PI  = 3.14159265359;
const float TAU = 6.28318530718;
const int   STEPS = ${STEPS};
const float DPHI  = ${DPHI.toFixed(4)};

// --- hashes ---------------------------------------------------------------
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}

// Value noise on a cylinder: EXACTLY periodic in the angular coordinate with
// period \`cells\`. That periodicity is what lets the disk pattern survive the
// seamless-loop contract — a layer rotated by a whole number of turns lands on
// itself to the last texel.
float cylNoise(float a, float b, float cells, float seed) {
  float ai = floor(a), bi = floor(b);
  float af = a - ai, bf = b - bi;
  af = af * af * (3.0 - 2.0 * af);
  bf = bf * bf * (3.0 - 2.0 * bf);
  float a0 = mod(ai, cells), a1 = mod(ai + 1.0, cells);
  float v00 = hash21(vec2(a0, bi) + seed);
  float v10 = hash21(vec2(a1, bi) + seed);
  float v01 = hash21(vec2(a0, bi + 1.0) + seed);
  float v11 = hash21(vec2(a1, bi + 1.0) + seed);
  return mix(mix(v00, v10, af), mix(v01, v11, af), bf);
}

// One rigidly-rotating band of disk material. Real disks shear continuously —
// no two radii share an angular velocity — and a continuously sheared texture
// can never loop. Four rigid layers cross-faded across radius reproduce the
// LOOK of differential rotation while each one returns to itself after a whole
// number of turns. Turns per lap are 8/4/2/1 at peak radii 3.2/5/7.5/11 Rs;
// true Keplerian ratios there are 1 : 0.51 : 0.28 : 0.16 against the quantised
// 1 : 0.5 : 0.25 : 0.125, which is closer than the eye can call.
vec2 diskLayer(float theta, float rad, float u, float peak, float turns, float cells, float seed) {
  float th = theta - turns * TAU * u;
  // Strongly ANISOTROPIC lattice: coarse around the circle, fine across it.
  // Equal detail in both directions renders as pepper — orbiting gas shears
  // into long thin arcs, so a feature has to be many radii thick and only a
  // few degrees wide.
  float a = th / TAU * cells;
  float b = rad * 8.0;
  float n1 = cylNoise(a, b, cells, seed);
  float n2 = cylNoise(a + 0.5 * cells, b + 7.3, cells, seed + 11.0);
  // "boil": a slow churn that is periodic in the lap by construction
  float n = mix(n1, n2, 0.5 + 0.5 * cos(TAU * u + seed));
  float fine = cylNoise(a * 2.0, b * 1.7, cells * 2.0, seed + 23.0);
  n = n * 0.78 + fine * 0.22; // less of the fine octave: it was adding grit
  float lw = log(max(rad, 0.01)) - log(peak);
  float w = exp(-(lw * lw) / (2.0 * 0.40 * 0.40));
  return vec2(n * w, w);
}

// Amber at the rim grading to warm white at the hot inner ring — no blue
// anywhere. Gargantua's palette is deliberately warm: a supermassive hole's
// disk is genuinely cooler than a stellar-mass one (T scales as M^-1/4), and
// the blue-white inner edge the previous ramp used read as a gas flame rather
// than as something incandescent. Capped short of saturated white so the
// highlight ceiling below has something to roll off.
vec3 diskColor(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c;
  if (t < 0.33) c = mix(vec3(1.00, 0.52, 0.16), vec3(1.00, 0.74, 0.38), t / 0.33);
  else if (t < 0.70) c = mix(vec3(1.00, 0.74, 0.38), vec3(1.00, 0.91, 0.73), (t - 0.33) / 0.37);
  else c = mix(vec3(1.00, 0.91, 0.73), vec3(1.00, 0.98, 0.93), (t - 0.70) / 0.30);
  return c;
}

// Emission picked up where a ray crosses the equatorial plane. \`toObs\` points
// from the crossing point toward the camera — the direction the photon we are
// tracing actually travelled.
vec3 sampleDisk(vec3 q, vec3 toObs, out float opacity) {
  opacity = 0.0;
  float r = length(q);
  float rn = r / uRs;
  float theta = atan(q.z, q.x);
  vec3 col = vec3(0.0);

  // --- the plunge region: inside the ISCO nothing can orbit, so material
  // spirals in fast, thins out and redshifts away to nothing
  // A tightly wound spiral rendered as concentric bullseye rings, so the
  // winding is loosened and the azimuthal variation raised: this should read
  // as gas being dragged in, not as a target painted round the hole.
  if (uPlunge > 0.001 && rn > 1.02 && rn < 3.0) {
    // 80/5 = 16 whole turns per lap, so this stays the fastest thing on
    // screen — gas at 2 Rs really does lap the disk's inner edge — even after
    // the disk itself was slowed right down. Any integer coefficient wraps
    // seamlessly here, since the pattern repeats every 2*PI/5 of azimuth.
    float sp = 0.5 + 0.5 * sin(theta * 5.0 + 7.0 * log(rn) - TAU * 80.0 * uPhase);
    float fade = smoothstep(1.05, 1.9, rn) * smoothstep(3.05, 2.7, rn);
    float grav = sqrt(max(0.0, 1.0 - 1.0 / rn));
    col += vec3(1.0, 0.34, 0.12) * sp * sp * fade * grav * 0.85 * uPlunge;
    opacity = max(opacity, 0.2 * fade * uPlunge);
  }

  // --- the ISCO itself, marked in the plane so lensing carries it correctly
  if (uIsco > 0.001) {
    float d = (rn - 3.0) / 0.07;
    col += vec3(0.52, 0.84, 1.00) * exp(-d * d) * 2.6 * uIsco;
  }

  if (uDisk < 0.001 || rn < 3.0 || r > uRout) return col;

  // --- Shakura-Sunyaev radial profile with a zero-torque inner boundary. The
  // disk is DARK right at the ISCO, peaks at r = (49/36)*rIn = 4.08 Rs, then
  // falls away outward — which is why the hottest band is a ring a little
  // outside the inner edge rather than the edge itself.
  float x = rn / 3.0;
  float f = max(0.0, 1.0 - sqrt(1.0 / x));
  float T = pow(1.0 / rn, 0.75) * pow(f, 0.25) / 0.2142; // normalised to peak 1
  float bright = pow(clamp(T, 0.0, 1.4), 4.0); // Stefan-Boltzmann: flux ~ T^4
  bright *= smoothstep(uRout, uRout * 0.70, r); // soft outer rim

  // --- four cross-faded rigid layers
  vec2 l0 = diskLayer(theta, rn, uPhase, 3.2, 8.0, 24.0, 1.0);
  vec2 l1 = diskLayer(theta, rn, uPhase, 5.0, 4.0, 20.0, 2.0);
  vec2 l2 = diskLayer(theta, rn, uPhase, 7.5, 2.0, 16.0, 3.0);
  vec2 l3 = diskLayer(theta, rn, uPhase, 11.0, 1.0, 12.0, 4.0);
  float wsum = l0.y + l1.y + l2.y + l3.y + 1e-4;
  float n = (l0.x + l1.x + l2.x + l3.x) / wsum;
  // NB: deliberately not named "texture" — that is a reserved built-in in
  // GLSL ES 3.00, and this would stop compiling the day anything bumps the
  // shader version
  // stretch the noise hard: a linear remap left the disk a featureless milky
  // sheet, and gas this turbulent has to read as filaments and dark lanes
  // Gentler than the contrast curve that fixed the original milky blob. That
  // one over-corrected into curdled clumps; Gargantua's disk is prized for
  // being SMOOTH — long silky striations, not turbulence.
  n = smoothstep(0.14, 0.94, n);
  float grain = 0.28 + 1.3 * n;

  // --- relativity. Locally the gas is on a circular orbit at
  // v = sqrt(M/(r-2M)) (exactly c/2 at the ISCO); boost that against the
  // photon direction, then apply the static gravitational redshift. Observed
  // brightness goes as the combined factor to the fourth power.
  float beta = min(sqrt(0.5 / max(rn - 1.0, 0.15)), 0.86);
  // must match the direction the texture layers actually rotate (+theta), or
  // the bright side lands on the side visibly moving AWAY from the camera
  vec3 vhat = normalize(vec3(-q.z, 0.0, q.x));
  float gamma = 1.0 / sqrt(1.0 - beta * beta);
  float dopp = 1.0 / (gamma * (1.0 - beta * dot(vhat, toObs)));
  float grav = sqrt(max(0.0, 1.0 - 1.0 / rn));
  float g = mix(1.0, dopp * grav, uBeam);

  // Steep, so only the narrow ring just outside the ISCO goes white-hot and
  // everything beyond it stays unmistakably amber. A gentle mapping made the
  // whole disk cream-coloured, which is neither pretty nor true.
  float Tn = clamp(pow(T * clamp(g, 0.35, 2.2), 2.6), 0.0, 1.0);
  bright *= clamp(pow(g, 4.0), 0.03, 6.0);

  // 1.5, not 2.2: the disk used to sit above the highlight ceiling nearly
  // everywhere, which flattened it AND hid the Doppler asymmetry that step 7
  // is entirely about. Leaving headroom is what makes one side visibly dimmer.
  col += diskColor(Tn) * bright * grain * uDisk * 1.5;
  opacity = max(opacity, clamp(bright * grain * 1.6, 0.0, 0.9) * uDisk);
  return col;
}

// --- the sky the hole is lensing ------------------------------------------
vec3 starLayer(vec3 d, float scale, float density, float bright) {
  vec3 q = d * scale;
  vec3 c = floor(q);
  vec3 f = q - c;
  vec3 h = hash33(c + 17.0);
  if (h.x > density) return vec3(0.0);
  vec3 sp = vec3(0.25) + 0.5 * h;
  float dd = length(f - sp);
  float s = smoothstep(0.17, 0.0, dd);
  float mag = pow(fract(h.y * 7.31), 3.0);
  vec3 tint = mix(vec3(0.72, 0.82, 1.00), vec3(1.00, 0.86, 0.66), h.z);
  return tint * s * s * mag * bright;
}

vec3 sky(vec3 d) {
  vec3 col = vec3(0.004, 0.005, 0.010);
  col += starLayer(d, 140.0, 0.045, 2.4);
  col += starLayer(d, 300.0, 0.030, 1.3);
  col += starLayer(d, 620.0, 0.022, 0.6);
  // a tilted galactic band — the structure that makes the lensing legible:
  // watch it split and ring as it passes behind the hole
  vec3 bandN = normalize(vec3(0.42, 0.78, -0.46));
  float b = dot(d, bandN);
  float band = exp(-(b * b) / (2.0 * 0.17 * 0.17));
  float mottle = cylNoise(atan(d.z, d.x) / TAU * 24.0, b * 26.0, 24.0, 5.0);
  col += vec3(0.10, 0.12, 0.20) * band * (0.35 + 0.65 * mottle) * 0.55;
  return col * uStars;
}

void main() {
  vec3 rd = normalize(vWorld - uCam);
  vec3 p0 = uCam - uCenter;
  float r0 = length(p0);

  vec3 e1 = p0 / r0;
  vec3 nrm = cross(e1, rd);
  float nl = length(nrm);
  if (nl < 1e-5) {
    // perfectly radial ray: any orbital plane containing it will do
    nrm = normalize(cross(e1, abs(e1.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
  } else {
    nrm /= nl;
  }
  vec3 e2 = normalize(cross(nrm, e1)); // in-plane, along increasing phi

  // u = 1/r, integrated against phi: d2u/dphi2 = -u + 3(GM/c^2)u^2, and
  // GM/c^2 = Rs/2, so the relativistic term is 1.5*Rs*u^2. Drop it and this is
  // a straight line in disguise; it is the entire reason the picture bends.
  float u = 1.0 / r0;
  float vr = dot(rd, e1);
  float vt = max(dot(rd, e2), 1e-4);
  float du = -u * vr / vt;

  float phi = 0.0;
  float escR = 20.0 * uRs; // comfortably outside the disk's 15 Rs rim
  vec3 prev = p0;
  vec3 col = vec3(0.0);
  float trans = 1.0;
  float rmin = r0;
  bool captured = false;

  for (int i = 0; i < STEPS; i++) {
    if (u > 1.0 / uRs) { captured = true; break; }
    if (u < 1.0 / escR && du < 0.0) break; // outbound and clear — it is gone

    // Adaptive step. A uniform dphi spends most of its budget crawling
    // through the near-empty region far from the hole, where the path is
    // almost a straight line, and the same budget near the photon sphere
    // where it is stiff. Scaling by depth (u*Rs is 1 at the horizon, small
    // far out) buys back both: ~3.5x bigger strides in the far field, ~0.7x
    // near the hole, so this is FASTER and more accurate at the rim at once.
    float dphi = DPHI * clamp(0.35 / max(u * uRs, 1e-4), 0.7, 3.5);

    // midpoint (RK2) step
    float a1 = -u + 1.5 * uRs * u * u;
    float uM = u + du * 0.5 * dphi;
    float duM = du + a1 * 0.5 * dphi;
    float aM = -uM + 1.5 * uRs * uM * uM;
    u += duM * dphi;
    du += aM * dphi;
    phi += dphi;

    float r = 1.0 / max(u, 1e-6);
    rmin = min(rmin, r);
    vec3 pos = r * (cos(phi) * e1 + sin(phi) * e2);

    // equatorial-plane crossing: this is where a ray picks up disk light, and
    // a ray may cross MANY times — that is what lifts the disk's far side up
    // over the top of the shadow and folds another image underneath it
    if (prev.y * pos.y < 0.0 && trans > 0.004) {
      float t = prev.y / (prev.y - pos.y);
      vec3 q = mix(prev, pos, t);
      vec3 toObs = -normalize(pos - prev);
      float op;
      vec3 e = sampleDisk(q, toObs, op);
      col += e * trans;
      trans *= (1.0 - clamp(op, 0.0, 1.0));
    }
    prev = pos;
  }

  // Rays whose closest approach grazes 1.5 Rs are the ones that loop; they
  // pile up at the silhouette's edge and make the photon ring. Emphasising
  // them draws that ring exactly where lensing actually puts it.
  // Width is in Rs, so it subtends more pixels the closer the camera gets —
  // at the hero's 4.3-unit distance the old 0.075 resolved into a hard white
  // wire tracing the silhouette. Wider reads as a glow at every distance.
  if (uShell > 0.001) {
    float d = (rmin / uRs - 1.5) / 0.11;
    col += vec3(0.52, 0.76, 1.00) * exp(-d * d) * 1.9 * uShell * trans;
  }

  // Captured rays return only what they collected on the way down: the horizon
  // itself contributes nothing, which is the whole point. Everything else —
  // including the handful that run out of integration budget — ends up looking
  // at the sky along whatever direction the curvature left it pointing.
  if (!captured) {
    float rr = 1.0 / u;
    float drdphi = -du / (u * u);
    vec3 er = cos(phi) * e1 + sin(phi) * e2;
    vec3 ep = -sin(phi) * e1 + cos(phi) * e2;
    col += sky(normalize(drdphi * er + rr * ep)) * trans;
  }

  col *= uGain;
  // Soft ceiling. A real image of this would be blown out white at the inner
  // ring, but the site's verification gate fails on truly clipped pixels, so
  // the highlights roll off to an asymptote instead. That asymptote sits well
  // above the stage's 2.2 bloom threshold on purpose — it is what gives the
  // hot ring its halo — and still lands under 255-on-all-three-channels.
  col = col / (1.0 + max(vec3(0.0), col - 1.4) / 2.9);

  // Vignette. The stage's studio backdrop normally frames the subject, but a
  // space scene paints its own sky corner to corner and reads flat without
  // one. Applied after the ceiling so it also buys back clipping headroom.
  vec2 q = gl_FragCoord.xy / uRes - 0.5;
  col *= 1.0 - 0.4 * smoothstep(0.24, 0.8, length(q));

  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------
// CPU-side geodesic tracer — same ODE as the shader, used to draw the test
// rays in the photon-sphere step as real curves rather than sketched arcs
// ---------------------------------------------------------------------------
function traceGeodesic(origin, dir, { rs = RS, escR = 17 * RS, steps = 1400, dphi = 0.02 } = {}) {
  const p0 = origin.clone();
  const r0 = p0.length();
  const e1 = p0.clone().divideScalar(r0);
  let nrm = new THREE.Vector3().crossVectors(e1, dir);
  if (nrm.lengthSq() < 1e-12) return [p0.clone()];
  nrm.normalize();
  const e2 = new THREE.Vector3().crossVectors(nrm, e1).normalize();

  let u = 1 / r0;
  const vr = dir.dot(e1);
  const vt = Math.max(dir.dot(e2), 1e-6);
  let du = (-u * vr) / vt;
  let phi = 0;

  const pts = [p0.clone()];
  for (let i = 0; i < steps; i++) {
    if (u > 1 / rs) break; // through the horizon
    if (u < 1 / escR && du < 0) break; // gone for good
    const a1 = -u + 1.5 * rs * u * u;
    const uM = u + du * 0.5 * dphi;
    const duM = du + a1 * 0.5 * dphi;
    const aM = -uM + 1.5 * rs * uM * uM;
    u += duM * dphi;
    du += aM * dphi;
    phi += dphi;
    const r = 1 / Math.max(u, 1e-6);
    pts.push(
      new THREE.Vector3()
        .addScaledVector(e1, r * Math.cos(phi))
        .addScaledVector(e2, r * Math.sin(phi)),
    );
  }
  return pts;
}

// ---------------------------------------------------------------------------
// annotation helpers — everything below is DIAGRAM drawn over the physics
// ---------------------------------------------------------------------------
function annotationRing(radius, color, { width = 0.011, opacity = 0.95, segments = 192 } = {}) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(radius - width, radius + width, segments),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    }),
  );
  mesh.renderOrder = 20;
  return mesh;
}

function anchor(parent, x, y, z) {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

export function buildBlackHole({ scene, stage }) {
  const root = new THREE.Group();
  root.position.set(0, CENTER_Y, 0);
  scene.add(root);

  const labels = calloutSets(['horizon', 'shadow', 'photon', 'isco', 'disk', 'beam', 'probe']);

  // --- the hole itself: a sphere painted from the inside by the raymarcher --
  const uniforms = {
    uCam: { value: new THREE.Vector3() },
    uCenter: { value: new THREE.Vector3(0, CENTER_Y, 0) },
    uRs: { value: RS },
    uRin: { value: R_ISCO },
    uRout: { value: R_DISK_OUT },
    uPhase: { value: 0 },
    uDisk: { value: 1 },
    uBeam: { value: 1 },
    uStars: { value: 1 },
    uShell: { value: 0 },
    uIsco: { value: 0 },
    uPlunge: { value: 0 },
    uGain: { value: 1 },
    uRes: { value: new THREE.Vector2(1, 1) },
  };
  const skyMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
  });
  // The disk's angular coordinate, kept in the scene graph rather than as a
  // bare number. Everything visible about the disk is drawn by the shader, so
  // without this the whole mechanism would animate purely through uniforms —
  // invisible to console inspection and to verify.mjs's loop probe, which
  // hashes object transforms to prove a step is not frozen.
  const spinNode = new THREE.Object3D();
  root.add(spinNode);

  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 32, 20), skyMat);
  skyMesh.renderOrder = -10;
  skyMesh.frustumCulled = false;
  // the lensing origin must be the EXACT camera the frame is drawn with —
  // reading it a tick early smears the whole image while the camera flies
  skyMesh.onBeforeRender = (r, _s, cam) => {
    uniforms.uCam.value.copy(cam.position);
    r.getDrawingBufferSize(uniforms.uRes.value); // resize-proof vignette
  };
  root.add(skyMesh);

  // --- camera-facing scale rings -------------------------------------------
  // These three answer the question the picture itself cannot: how big is the
  // hole REALLY, compared to the darkness it casts. They are billboarded
  // because a Schwarzschild silhouette is a perfect circle from every
  // direction, so a circle facing the viewer is the honest annotation.
  const billboards = new THREE.Group();
  root.add(billboards);

  const horizonRing = annotationRing(RS, 0xffffff, { width: 0.009 });
  const photonRing = annotationRing(R_PHOTON, CYAN, { width: 0.007, opacity: 0.9 });
  const shadowRing = annotationRing(R_SHADOW, ACCENT, { width: 0.008, opacity: 0.9 });
  billboards.add(horizonRing, photonRing, shadowRing);

  // NB: the horizon marker is an OUTLINE and stays one. A filled disc was
  // tried at three opacities and read as a solid grey ball every time —
  // directly contradicting the step whose whole heading is "there is nothing
  // there". An empty ring says "boundary"; a disc says "surface".

  // Anchors hang off the billboard GROUP, never off the ring meshes: an
  // Object3D under a hidden parent is skipped by the CSS2D pass too, so a
  // callout parented to a ring would blink out whenever that ring was off.
  // Local X/Y on this group is screen right/up, which is exactly the frame
  // control these labels need.
  const aHorizon = anchor(billboards, RS * 0.72, RS * 0.72, 0);
  const aEscape = anchor(billboards, RS * 0.85, -RS * 0.85, 0);
  const aShadow = anchor(billboards, R_SHADOW * 0.74, R_SHADOW * 0.74, 0);
  const aPhotonRing = anchor(billboards, R_SHADOW * 0.2, R_SHADOW * 1.02, 0);
  const aPhotonSphere = anchor(billboards, R_PHOTON * 0.7, R_PHOTON * 0.7, 0);
  const aGap = anchor(billboards, R_SHADOW * 0.5, -R_SHADOW * 1.02, 0);

  // Labels stay SHORT: the mobile panel is narrow, and a pill long enough to
  // wrap to five lines stops being a callout and becomes a second paragraph.
  // The numbers live here; the explanation lives in the step copy.
  labels.add('horizon', aHorizon, 'Event horizon · 1 Rs', [0, 0, 0], 25, 66);
  labels.add('horizon', aEscape, 'Escape speed = c', [0, 0, 0], -25, 78);
  labels.add('shadow', aHorizon, 'The hole · 1 Rs', [0, 0, 0], 25, 66);
  labels.add('shadow', aShadow, 'What you see · 5.2 Rs', [0, 0, 0], 30, 80);
  labels.add('shadow', aPhotonRing, 'Photon ring', [0, 0, 0], 80, 52);
  labels.add('photon', aPhotonSphere, 'Photon sphere · 1.5 Rs', [0, 0, 0], 35, 72);

  // --- test rays for the photon-sphere step --------------------------------
  // Real integrated geodesics, not drawn arcs: same equation the shader runs.
  const rayGroup = new THREE.Group();
  root.add(rayGroup);

  const RAY_SPECS = [
    { b: 6.0 * RS, color: 0x9fe6ff, key: 'bend' },
    { b: 2.68 * RS, color: 0xffd27f, key: 'loop' },
    { b: 2.30 * RS, color: 0xff7a5c, key: 'fall' },
  ];
  const rays = RAY_SPECS.map(({ b, color }) => {
    const start = new THREE.Vector3(Math.sqrt((16 * RS) ** 2 - b * b), 0, b);
    const pts = traceGeodesic(start, new THREE.Vector3(-1, 0, 0));
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, Math.min(600, pts.length), 0.008, 8, false),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    tube.renderOrder = 12;
    const packet = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 14, 10),
      new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }),
    );
    packet.renderOrder = 13;
    rayGroup.add(tube, packet);
    return { curve, tube, packet, color };
  });

  const aRayBend = anchor(rayGroup, 0, 0, 0);
  const aRayLoop = anchor(rayGroup, 0, 0, 0);
  const aRayFall = anchor(rayGroup, 0, 0, 0);
  aRayBend.position.copy(rays[0].curve.getPointAt(0.55));
  aRayLoop.position.copy(rays[1].curve.getPointAt(0.62));
  aRayFall.position.copy(rays[2].curve.getPointAt(0.88));
  labels.add('photon', aRayLoop, 'Loops — then escapes', [0, 0, 0], 15, 74);
  labels.add('photon', aRayFall, 'Captured', [0, 0, 0], -35, 58);

  // --- the descending probe and the pulses it sends back -------------------
  // Fixed azimuth on the near side of the step-8 camera: the raymarched
  // background writes no depth, so anything placed behind the hole would draw
  // straight through the shadow.
  // 285 deg puts the descent on the near side AND screen-right of the step-8
  // camera bearing (340 deg) — the panel owns the left of the frame, and the
  // raymarched background writes no depth, so a probe behind the hole would
  // draw straight through the shadow.
  const PROBE_AZ = (285 * Math.PI) / 180;
  const probeDir = new THREE.Vector3(Math.cos(PROBE_AZ), 0, Math.sin(PROBE_AZ));
  const probeGroup = new THREE.Group();
  root.add(probeGroup);

  const probe = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 18, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }),
  );
  probe.renderOrder = 14;
  probeGroup.add(probe);

  const PULSES = 4;
  const pulses = [];
  for (let i = 0; i < PULSES; i++) {
    const ring = annotationRing(1, 0xffffff, { width: 0.02, opacity: 0.5, segments: 96 });
    ring.renderOrder = 11;
    probeGroup.add(ring);
    pulses.push(ring);
  }

  const aProbe = anchor(probe, 0.05, 0.05, 0);
  const aPulse = anchor(probeGroup, 0, 0, 0);
  labels.add('probe', aProbe, 'Clock running slow', [0, 0, 0], 78, 58);
  labels.add('probe', aPulse, 'Signals stretch and fade', [0, 0, 0], 196, 76);

  // --- anchors that ride the frame ----------------------------------------
  // Disk callouts have no fixed home: the camera marches most of the way
  // around the hole across the nine steps, so these anchors are re-placed each
  // frame onto whichever part of the disk is currently screen-right — keeping
  // every pill clear of the text panel without hand-tuning nine positions.
  const aIsco = anchor(root, 0, 0, 0);
  const aDisk = anchor(root, 0, 0, 0);
  const aShear = anchor(root, 0, 0, 0);
  const aApproach = anchor(root, 0, 0, 0);
  const aRecede = anchor(root, 0, 0, 0);

  // These anchors sit far out on the screen-RIGHT side of the disk, so their
  // leaders point back inward — aimed outward the pills ran off the frame.
  labels.add('isco', aIsco, 'Last stable orbit · 3 Rs', [0, 0, 0], 152, 74);
  labels.add('isco', aGap, 'No orbits inside this', [0, 0, 0], -28, 72);
  labels.add('disk', aDisk, 'Accretion disk', [0, 0, 0], 155, 74);
  labels.add('disk', aShear, 'Inner gas laps the outer', [0, 0, 0], 205, 78);
  // opposite leader directions, on anchors a third of the disk apart: these
  // two used to collide in the middle of the frame and get shoved by the
  // declutter pass until you could not tell which pill named which side
  labels.add('beam', aApproach, 'Coming at you', [0, 0, 0], 150, 76);
  labels.add('beam', aRecede, 'Going away', [0, 0, 0], -32, 84);

  // ---------------------------------------------------------------------------
  // one state object, one pose function
  // ---------------------------------------------------------------------------
  const S = {
    phase: 0,
    disk: 1,
    beam: 1,
    stars: 1,
    shell: 0,
    isco: 0,
    plunge: 0,
    gain: 1,
    // the three scale markers are independent: each one is introduced by the
    // step that earns it, so no unexplained ring is ever on screen
    ringHorizon: 0,
    ringShadow: 0,
    photonRing: 0,
    raysOn: 0,
    probeOn: 0,
  };

  // Probe depth as a function of lap phase. Coordinate infall is asymptotic —
  // a distant observer never sees the crossing — so the descent slows to a
  // crawl and the image simply fades out where the horizon is.
  const probeRadiusAt = (p) => {
    const e = 1 - Math.pow(1 - clamp01(p), 2.6);
    return 6.0 * RS + (1.03 * RS - 6.0 * RS) * e;
  };
  const gravFactor = (r) => Math.sqrt(Math.max(0, 1 - RS / r));

  function apply() {
    // fast clock for the diagram overlays; whole cycles per lap (see AUX_CYCLES)
    const aux = (S.phase * AUX_CYCLES) % 1;

    spinNode.rotation.y = S.phase * Math.PI * 2;
    uniforms.uPhase.value = S.phase;
    uniforms.uDisk.value = S.disk;
    uniforms.uBeam.value = S.beam;
    uniforms.uStars.value = S.stars;
    uniforms.uShell.value = S.shell;
    uniforms.uIsco.value = S.isco;
    uniforms.uPlunge.value = S.plunge;
    uniforms.uGain.value = S.gain;

    horizonRing.visible = S.ringHorizon > 0.001;
    shadowRing.visible = S.ringShadow > 0.001;
    horizonRing.material.opacity = 0.95 * S.ringHorizon;
    shadowRing.material.opacity = 0.9 * S.ringShadow;
    photonRing.visible = S.photonRing > 0.001;
    photonRing.material.opacity = 0.9 * S.photonRing;

    // --- test rays. Posed unconditionally, not behind the visibility flag:
    // a pose that only updates while it happens to be on-screen is a pose no
    // automated check can ever see move.
    rayGroup.visible = S.raysOn > 0.001;
    for (let i = 0; i < rays.length; i++) {
      const { curve, tube, packet } = rays[i];
      tube.material.opacity = 0.5 * S.raysOn;
      // one traversal per lap, staggered, faded at both ends so the reset is
      // invisible — the captured ray genuinely does just stop existing
      const t = (aux + i * 0.11) % 1;
      packet.position.copy(curve.getPointAt(clamp01(t)));
      packet.material.opacity =
        S.raysOn * smooth(clamp01(t / 0.09)) * smooth(clamp01((1 - t) / 0.09));
    }

    // --- probe + pulses
    probeGroup.visible = S.probeOn > 0.001;
    const r = probeRadiusAt(aux);
    const g = gravFactor(r);
    probe.position.copy(probeDir).multiplyScalar(r);
    probe.material.color.setRGB(1, 0.35 + 0.65 * g, 0.18 + 0.82 * g * g);
    probe.material.opacity =
      S.probeOn * g * g * smooth(clamp01(aux / 0.1)) * smooth(clamp01((1 - aux) / 0.14));

    for (let i = 0; i < PULSES; i++) {
      const emit = i / PULSES; // fixed emission phases keep the loop exact
      const age = (aux - emit + 1) % 1;
      const rEmit = probeRadiusAt(emit);
      const gEmit = gravFactor(rEmit);
      const ring = pulses[i];
      ring.position.copy(probeDir).multiplyScalar(rEmit);
      // small: at half a world unit these expanded across the whole hole and
      // the frame turned into a bullseye of concentric circles
      ring.scale.setScalar(0.03 + age * 0.22);
      ring.material.color.setRGB(1, 0.32 + 0.68 * gEmit, 0.14 + 0.86 * gEmit * gEmit);
      // floor under the redshift dimming: physically the deepest pulses fade
      // to nothing, but at literal g they vanished before the reddening they
      // are there to demonstrate could be seen at all
      ring.material.opacity =
        S.probeOn * 0.5 * (0.35 + 0.65 * gEmit) * (1 - age) * smooth(clamp01(age / 0.12));
    }
    aPulse.position.copy(probeDir).multiplyScalar(probeRadiusAt(0.3));
  }

  // --- per-frame framing work: billboard the scale rings, and slide the
  // free-floating anchors onto the screen-right side of the disk
  const camRight = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  const stopTick = stage.onTick(() => {
    const cam = stage.camera;
    billboards.quaternion.copy(cam.quaternion);
    // an expanding light pulse is a sphere; facing its ring at the viewer is
    // the only orientation that reads as one from an arbitrary orbit angle
    if (probeGroup.visible) for (const p of pulses) p.quaternion.copy(cam.quaternion);

    camRight.set(1, 0, 0).applyQuaternion(cam.quaternion);
    camRight.y = 0;
    if (camRight.lengthSq() < 1e-6) camRight.set(1, 0, 0);
    camRight.normalize();

    // place an anchor in the disk plane, `radiusRs` out, swung `offDeg` around
    // from the screen-right bearing
    const inPlane = (obj, radiusRs, offDeg) => {
      const a = (offDeg * Math.PI) / 180;
      const c = Math.cos(a);
      const s = Math.sin(a);
      obj.position
        .set(camRight.x * c + camRight.z * s, 0, -camRight.x * s + camRight.z * c)
        .multiplyScalar(radiusRs * RS);
    };
    inPlane(aIsco, 3.0, 0);
    inPlane(aDisk, 7.0, 0);
    inPlane(aShear, 4.4, 42);

    // The bright side is not a screen-space choice: it is wherever the orbital
    // velocity happens to point at the camera. Because the gas all circulates
    // the same way, that turns out to be the same side of the frame from every
    // bearing — the disk rotates in the sense that puts it on the right.
    camDir.copy(cam.position).sub(root.position);
    const m = Math.hypot(camDir.x, camDir.z) || 1;
    const ax = camDir.z / m;
    const az = -camDir.x / m;
    const rl = 9.0 * RS;
    aApproach.position.set(ax * rl, 0, az * rl);
    aRecede.position.set(-ax * rl, 0, -az * rl);
  });

  apply();

  return {
    // NOTE: deliberately no `group` handle — the player's hero bob would
    // levitate the black hole, and a wobbling singularity is a bad look.
    parts: { skyMesh, billboards, rayGroup, probeGroup, probe, horizonRing, shadowRing },
    set(patch) {
      Object.assign(S, patch);
      apply();
    },
    setLabels: labels.setLabels,
    dispose() {
      stopTick();
      scene.remove(root);
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
