import * as THREE from 'three';
import { materials, box } from '../../framework/parts.js';
import { smudgeMap } from '../../framework/textures.js';
import { callout } from '../../framework/labels.js';

const TILE_W = 0.4;
const TILE_H = 0.6;
const TILE_D = 0.1;
const GAP = 0.1;
const PITCH = TILE_W + GAP;
const NUM_TILES = 15;
const VALUES = [2, 4, 7, 10, 14, 19, 23, 27, 31, 35, 42, 48, 53, 59, 61];
const TARGET_VAL = 42;
const TARGET_IDX = 10;

const RAIL_Y = 1.0;

function createNumberTexture(num, glow = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = glow ? '#ffffff' : '#445566';
  ctx.font = 'bold 80px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (glow) {
    ctx.shadowColor = '#00e676';
    ctx.shadowBlur = 15;
  }
  ctx.fillText(num.toString(), 64, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildMachine({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // Materials
  const railMat = materials.chrome(0x8899aa);
  railMat.anisotropy = 0.8;
  railMat.anisotropyRotation = Math.PI / 2; // Horizontal grain
  const bracketMat = materials.rubber(0x1a1c20);
  
  const glassBase = new THREE.MeshPhysicalMaterial({
    color: 0x11151c,
    transmission: 0.9,
    roughness: 0.15,
    thickness: 0.1,
    ior: 1.5,
    transparent: false,
    clearcoat: 1.0,
    clearcoatRoughnessMap: smudgeMap(),
  });

  const glassDim = glassBase.clone();
  glassDim.color.setHex(0x05070a);
  glassDim.transmission = 0.4;

  const glassGlow = glassBase.clone();
  glassGlow.color.setHex(0x224433);
  glassGlow.emissive.setHex(0x00e676);
  glassGlow.emissiveIntensity = 0.3;

  // Plinth (Track)
  const trackMat = materials.paintedMetal(0x0a0c10);
  const track = box(NUM_TILES * PITCH + 0.4, 0.1, 0.6, trackMat);
  track.position.y = -0.05;
  track.receiveShadow = true;
  group.add(track);

  // Array of tiles
  const tiles = [];
  const numbers = [];
  for (let i = 0; i < NUM_TILES; i++) {
    const x = (i - (NUM_TILES - 1) / 2) * PITCH;
    
    // Tile glass
    const tile = box(TILE_W, TILE_H, TILE_D, glassBase);
    tile.position.set(x, TILE_H / 2, 0);
    group.add(tile);
    tiles.push(tile);

    // Number plane inside glass
    const numGeo = new THREE.PlaneGeometry(TILE_W * 0.8, TILE_H * 0.8);
    const numMat = new THREE.MeshBasicMaterial({
      map: createNumberTexture(VALUES[i]),
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const numPlane = new THREE.Mesh(numGeo, numMat);
    numPlane.position.set(x, TILE_H / 2, 0);
    group.add(numPlane);
    numbers.push({ plane: numPlane, mat: numMat, val: VALUES[i] });
  }

  // Gantry Rail
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, NUM_TILES * PITCH + 0.6, 32), railMat);
  rail.rotation.z = Math.PI / 2;
  rail.position.set(0, RAIL_Y, 0);
  rail.castShadow = true;
  group.add(rail);

  // Support posts
  for (const sign of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, RAIL_Y, 32), railMat);
    post.position.set(sign * (NUM_TILES * PITCH + 0.4) / 2, RAIL_Y / 2, 0);
    post.castShadow = true;
    group.add(post);
  }

  // Brackets
  function makeBracket(colorHex) {
    const b = new THREE.Group();
    const body = box(0.2, 0.15, 0.2, bracketMat);
    body.position.y = RAIL_Y;
    body.castShadow = true;
    b.add(body);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.22), new THREE.MeshBasicMaterial({ color: colorHex }));
    led.position.y = RAIL_Y + 0.08;
    b.add(led);
    return b;
  }

  const leftBracket = makeBracket(0xff3333);
  group.add(leftBracket);
  const rightBracket = makeBracket(0xff3333);
  group.add(rightBracket);

  const midBracket = makeBracket(0x00e676);
  // Mid probe (drops down)
  const probeStem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, RAIL_Y - TILE_H, 16), railMat);
  probeStem.position.y = (RAIL_Y + TILE_H) / 2;
  midBracket.add(probeStem);
  
  const scannerHead = box(TILE_W * 1.1, 0.05, TILE_D * 1.5, bracketMat);
  scannerHead.position.y = TILE_H + 0.05;
  midBracket.add(scannerHead);
  
  group.add(midBracket);

  // Labels
  const labels = {
    left: callout('Left Bound (L)'),
    right: callout('Right Bound (R)'),
    mid: callout('Midpoint (M)'),
    target: callout(`Target: ${TARGET_VAL}`),
  };
  labels.left.position.set(0, RAIL_Y + 0.2, 0);
  labels.right.position.set(0, RAIL_Y + 0.2, 0);
  labels.mid.position.set(0, TILE_H + 0.2, 0);
  labels.target.position.set(0, RAIL_Y + 0.5, 0);
  leftBracket.add(labels.left);
  rightBracket.add(labels.right);
  midBracket.add(labels.mid);
  group.add(labels.target); // Fixed target HUD

  // Helpers for animation math
  const getX = (idx) => (idx - (NUM_TILES - 1) / 2) * PITCH;
  
  // States to animate through
  // L, R, Mid, Drop (0=up, 1=down)
  const states = [
    { t: 0.00, L: 0, R: 14, M: 7, drop: 0 },
    { t: 0.05, L: 0, R: 14, M: 7, drop: 1 }, // Check 27 (too low)
    { t: 0.15, L: 0, R: 14, M: 7, drop: 0 }, 
    
    { t: 0.20, L: 8, R: 14, M: 11, drop: 0 },
    { t: 0.25, L: 8, R: 14, M: 11, drop: 1 }, // Check 48 (too high)
    { t: 0.35, L: 8, R: 14, M: 11, drop: 0 },
    
    { t: 0.40, L: 8, R: 10, M: 9, drop: 0 },
    { t: 0.45, L: 8, R: 10, M: 9, drop: 1 }, // Check 35 (too low)
    { t: 0.55, L: 8, R: 10, M: 9, drop: 0 },
    
    { t: 0.60, L: 10, R: 10, M: 10, drop: 0 },
    { t: 0.65, L: 10, R: 10, M: 10, drop: 1 }, // Check 42 (FOUND!)
    { t: 0.85, L: 10, R: 10, M: 10, drop: 1 }, // Hold on found
    
    { t: 0.90, L: 10, R: 10, M: 10, drop: 0 }, // Retract
    { t: 1.00, L: 0, R: 14, M: 7, drop: 0 }, // Reset
  ];

  function interpolate(t, prop) {
    if (t <= states[0].t) return states[0][prop];
    if (t >= states[states.length - 1].t) return states[states.length - 1][prop];
    for (let i = 0; i < states.length - 1; i++) {
      const s0 = states[i];
      const s1 = states[i + 1];
      if (t >= s0.t && t <= s1.t) {
        // smoothstep interpolation for mechanical feel
        let frac = (t - s0.t) / (s1.t - s0.t);
        frac = frac * frac * (3 - 2 * frac);
        return s0[prop] + (s1[prop] - s0[prop]) * frac;
      }
    }
    return 0;
  }

  const api = {
    setPhase(t) {
      const curL = interpolate(t, 'L');
      const curR = interpolate(t, 'R');
      const curM = interpolate(t, 'M');
      const curDrop = interpolate(t, 'drop');
      
      leftBracket.position.x = getX(curL);
      rightBracket.position.x = getX(curR);
      midBracket.position.x = getX(curM);
      
      // Drop motion: base height is RAIL_Y + 0.05, drops down to TILE_H + 0.05
      const dropDist = RAIL_Y - TILE_H - 0.1;
      probeStem.position.y = (RAIL_Y + TILE_H) / 2 - curDrop * (dropDist / 2);
      scannerHead.position.y = RAIL_Y - 0.05 - curDrop * dropDist;
      
      // Dim tiles outside current bounds
      for (let i = 0; i < NUM_TILES; i++) {
        // We use Math.round(curL) to decide solid bounds for dimming so it snaps
        const inBounds = i >= Math.round(curL) && i <= Math.round(curR);
        const isFound = t >= 0.65 && t <= 0.85 && i === TARGET_IDX;
        
        tiles[i].material = isFound ? glassGlow : (inBounds ? glassBase : glassDim);
        
        // Ensure text texture gets created for glow if found, though creating new textures every frame is bad!
        // We should cache the glow texture.
        if (isFound && !numbers[i].glowTex) {
          numbers[i].glowTex = createNumberTexture(VALUES[i], true);
        }
        if (!isFound && !numbers[i].baseTex) {
          numbers[i].baseTex = createNumberTexture(VALUES[i], false);
        }
        numbers[i].mat.map = isFound ? numbers[i].glowTex : numbers[i].baseTex;
        numbers[i].mat.needsUpdate = true;
      }
    },
    setLabels(show) {
      labels.left.visible = show;
      labels.right.visible = show;
      labels.mid.visible = show;
      labels.target.visible = show;
    }
  };

  return { group, ...api };
}
