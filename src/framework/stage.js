import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Studio light rig baked into the environment map: one big overhead softbox
// plus two long strip lights. Long strips are what give machined metal those
// stretched, contoured highlights — the default RoomEnvironment only makes
// blobby ones.
function buildStudioEnv() {
  const env = new THREE.Scene();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(20, 16, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.055, 0.06, 0.072), side: THREE.BackSide }),
  );
  env.add(dome);
  const panel = (w, h, intensity, [r, g, b], pos) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(r * intensity, g * intensity, b * intensity) }),
    );
    m.position.set(...pos);
    m.lookAt(0, 1, 0);
    env.add(m);
  };
  panel(6, 3, 14, [1, 0.98, 0.94], [3, 7, 3]); // overhead key softbox, near-white
  panel(11, 1.1, 6.5, [0.75, 0.85, 1], [-7, 3.5, -2]); // long cool strip, camera-left
  panel(7, 0.8, 3.5, [1, 0.82, 0.66], [6, 2.5, -4.5]); // warm rim strip, right-back
  panel(8, 8, 0.7, [1, 1, 1], [0, -4, 0]); // floor bounce
  return env;
}

// Studio-backdrop gradient used as scene.background instead of flat black: a
// near-black frame with a soft charcoal glow behind the model, so DARK models
// (black engine castings, blued gun steel, dark plastics) separate from the
// background instead of blending into it — the flat 0x0b0c10 swallowed them.
// A plain 2D texture set as scene.background renders as a fixed screen-space
// backdrop (it does NOT track the camera or add reflections — scene.environment
// still owns lighting), exactly like a photographer's seamless sweep. Same
// CanvasTexture trick as the contact shadow below.
function makeBackdrop() {
  const S = 1024; // higher res so stretching to a 1080p+ frame magnifies less
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#090a0e'; // near-black base (keeps the cinematic frame)
  ctx.fillRect(0, 0, S, S);
  // broad, gentle glow biased right-of-centre and a touch high — where the
  // model sits (the text panel owns the left third and covers the darker side)
  const g = ctx.createRadialGradient(560, 448, 48, 592, 500, 816);
  g.addColorStop(0.0, '#2e313b'); // charcoal lift, faintly cool to match the rig
  g.addColorStop(0.45, '#1a1c24');
  g.addColorStop(1.0, '#090a0e'); // fades back to the base at the edges
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // NOTE: intentionally NO per-pixel dither here. The WebGL site renders this
  // smoothly; the concentric banding only appeared in EXPORTED VIDEO, born in
  // the JPEG-frame + 8-bit-H.264 compression — so it's fixed in the export
  // pipeline (PNG frames + a deband pass), not by graining up the live scene.
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false; // a full-frame backdrop never needs mips
  tex.minFilter = THREE.LinearFilter;
  return tex;
}
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { declutterCallouts } from './label-layout.js';

// Reusable 3D stage: renderer + camera + lights + soft-shadow floor.
// Every explainer gets one; the player owns its lifecycle.
export function createStage(container, options = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoft is deprecated in r185+
  container.appendChild(renderer.domElement);

  // DOM label overlay (crisp CSS2D callouts) — sits over the canvas but
  // never intercepts pointer events, so orbit-drag and scroll still work
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(container.clientWidth, container.clientHeight);
  Object.assign(labelRenderer.domElement.style, {
    position: 'absolute',
    inset: '0',
    overflow: 'hidden',
    pointerEvents: 'none',
  });
  container.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  scene.background = makeBackdrop();
  scene.fog = new THREE.Fog(0x0a0b0f, 16, 36); // matches the backdrop's dark edge

  // Synthetic rig applies instantly so the first frame is never unlit; the
  // real photographed studio HDRI (Poly Haven, CC0) replaces it as soon as it
  // decodes — captured light gradients make metal/glass read far more real
  // than the four flat panels above can.
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envTexture = pmrem.fromScene(buildStudioEnv(), 0.04).texture;
  scene.environment = envTexture;
  let disposed = false;
  new HDRLoader().load(
    `${import.meta.env.BASE_URL}env/studio_small_08_1k.hdr`,
    (hdr) => {
      const hdrEnv = pmrem.fromEquirectangular(hdr).texture;
      hdr.dispose();
      if (disposed) {
        hdrEnv.dispose();
        return;
      }
      envTexture.dispose();
      envTexture = hdrEnv;
      scene.environment = hdrEnv;
      // the photographed studio is much hotter than the synthetic rig it
      // replaces — scale it down so the key light keeps shaping the shadows
      scene.environmentIntensity = 0.55;
    },
    undefined,
    (err) => console.warn('[stage] HDRI unavailable, keeping synthetic env:', err),
  );

  const camera = new THREE.PerspectiveCamera(
    42,
    container.clientWidth / container.clientHeight,
    0.1,
    100,
  );
  camera.position.set(4, 2.2, 6);

  // Rotate-only orbit, live on EVERY step: drag anywhere to swing around the
  // model; the next step's fly-to reframes it. Zoom/pan stay off — the wheel
  // must keep scrolling the page.
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.2, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.maxPolarAngle = Math.PI * 0.55;

  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(5, 7, 4);
  key.castShadow = true;
  key.shadow.radius = 6; // soft penumbra (PCFSoft)
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -5;
  key.shadow.bias = -0.0004;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x8fb7ff, 0.7);
  rim.position.set(-6, 4, -5);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.28));

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.ShadowMaterial({ opacity: 0.32 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // soft radial contact shadow under the model — grounds it beyond what the
  // shadow map alone can do
  const contactCanvas = document.createElement('canvas');
  contactCanvas.width = contactCanvas.height = 256;
  {
    const ctx = contactCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(0.55, 'rgba(0,0,0,0.22)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(contactCanvas),
      transparent: true,
      depthWrite: false,
    }),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.002;
  scene.add(contact);

  // --- post-processing: AO grounds the parts, bloom lets emissives glow ----
  // Any failure falls back to the plain renderer so an odd GPU never blanks
  // the page.
  let composer = null;
  let gtao = null;
  let bokehPass = null;
  try {
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    composer.addPass(new RenderPass(scene, camera));
    gtao = new GTAOPass(scene, camera, container.clientWidth, container.clientHeight);
    gtao.blendIntensity = 0.85;
    composer.addPass(gtao);
    
    if (options.dof) {
      bokehPass = new BokehPass(scene, camera, {
        focus: 1.0,
        aperture: 0.0002,
        maxblur: 0.006,
        width: container.clientWidth,
        height: container.clientHeight
      });
      composer.addPass(bokehPass);
    }
    
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      0.16, // strength: a whisper, not a haze
      0.45,
      2.2, // threshold: HDR metal reflections exceed 1.0 — only true
      //      hot emissives (sparks, flames) should pass
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composer.setSize(container.clientWidth, container.clientHeight);
  } catch (err) {
    console.warn('[stage] post-processing unavailable, direct render:', err);
    composer = null;
  }

  const tickHandlers = new Set();
  const clock = new THREE.Clock();

  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return; // never propagate a zero-size layout
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer?.setSize(w, h);
    labelRenderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);
  // window 'resize' misses container-only layout changes (and mounts that
  // happen before the tab has a viewport) — observe the element itself too
  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(container);

  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    for (const fn of tickHandlers) fn(dt);
    controls.update();
    if (composer) composer.render();
    else renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    // after the CSS2D pass has positioned every pill, nudge overlapping ones
    // apart so labels never collide (see label-layout.js)
    declutterCallouts(scene);
  });

  return {
    renderer,
    scene,
    camera,
    controls,
    composer,
    labelRenderer,
    bokehPass,
    onTick(fn) {
      tickHandlers.add(fn);
      return () => tickHandlers.delete(fn);
    },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      window.removeEventListener('resize', onResize);
      resizeObserver.disconnect();
      controls.dispose();
      composer?.dispose();
      envTexture.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labelRenderer.domElement.remove();
    },
  };
}
