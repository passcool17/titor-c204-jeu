import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getGPUTier } from './vendor/detect-gpu.esm.js';
import {
  VERSION, LINKS, SOURCES, INTRO_QUOTE, MISSION, CARDS,
  cardIdFor, TAG_LABEL, TAG_HINT,
} from './data.js';

const $ = (id) => document.getElementById(id);
const prefersReduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const showFps = /(?:\?|&)fps=1(?:&|$)/.test(location.search) || /(?:\?|&)fps=1(?:&|$)/.test(location.href);
const isTest = /(?:\?|&)t=1(?:&|$)/.test(location.search);

let gpu = { tier: 2, type: 'unknown', gpu: '?', fps: 0, isMobile: true };
let renderer, scene, camera, clock;
let pmrem = null;
let c204 = { root: null, mixer: null, clips: {}, nodes: new Map(), boxes: new Map() };
let car = { root: null, mixer: null, clips: {}, wheels: [] };
let ibm = { root: null, nodes: new Map() };
let env = { road: null, roadTex: null, rings: null, stars: null, ground: null };
let mode = 'loading';
let score = 0, lives = 3, level = 1, ibmGot = false;
let animScale = 1;
let lastCalls = 0, lastTris = 0, fpsSmooth = 0, jsMs = 0, fpsFrames = 0, fpsT = 0;
let pixelRatioCap = 2;

const orbit = { az: 0.85, pol: 1.15, dist: 7, target: new THREE.Vector3(0, 0.7, 0), minD: 1.4, maxD: 16 };
const input = { x: 0, y: 0, x2: 0, y2: 0, action: false, _prevAction: false };
let pointerDragging = false, pointerMoved = 0, lastPtr = { x: 0, y: 0, id: -1 };
const keys = new Set();

const AudioSys = {
  ctx: null, muted: false, unlocked: false,
  unlock() {
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.unlocked = true;
    } catch (_) { /* autoplay policy */ }
  },
  beep(freq = 440, dur = 0.08, type = 'square', gain = 0.07) {
    if (!this.unlocked || this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  chord(ok) {
    if (ok) { this.beep(523, 0.09, 'square', 0.06); this.beep(784, 0.12, 'square', 0.05); }
    else { this.beep(180, 0.18, 'sawtooth', 0.07); }
  },
};

function setLoad(p, text) {
  const bar = $('loadBar');
  if (bar) bar.style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + '%';
  if (text) $('loading').querySelector('.load-sub').textContent = text;
}

async function detectGpu() {
  try {
    const info = await getGPUTier({ benchmarksURL: './detect-gpu-benchmarks' });
    gpu = {
      tier: info.tier ?? 1,
      type: info.type ?? 'unknown',
      gpu: info.gpu ?? '?',
      fps: info.fps ?? 0,
      isMobile: !!info.isMobile,
    };
  } catch (err) {
    console.warn('detect-gpu:', err);
    gpu = { tier: 1, type: 'fallback', gpu: '?', fps: 0, isMobile: true };
  }
}

function makeRenderer() {
  const canvas = $('c');
  const low = gpu.tier <= 1;
  pixelRatioCap = low ? 1 : 2;
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !low,
    alpha: false,
    powerPreference: 'high-performance',
    stencil: false,
    depth: true,
  });
  renderer.setClearColor(0x07090c, 1);
  renderer.setPixelRatio(Math.min(pixelRatioCap, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = false;
  renderer.info.autoReset = true;
}

function makeScene() {
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x07090c, 18, 70);
  camera = new THREE.PerspectiveCamera(50, 1, 0.08, 200);
  clock = new THREE.Clock();

  const hemi = new THREE.HemisphereLight(0xb8c8dc, 0x1a1612, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2dc, 1.15);
  sun.position.set(4, 8, 3);
  sun.castShadow = false;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x7fa8c8, 0.35);
  fill.position.set(-5, 3, -4);
  fill.castShadow = false;
  scene.add(fill);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshLambertMaterial({ color: 0x141820 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = false;
  scene.add(ground);
  env.ground = ground;

  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#1a1e24'; g.fillRect(0, 0, 64, 256);
  g.fillStyle = '#cfc6a6';
  for (let y = 0; y < 256; y += 32) g.fillRect(30, y, 4, 16);
  g.fillStyle = '#8a7a4a';
  g.fillRect(2, 0, 3, 256); g.fillRect(59, 0, 3, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 24);
  tex.anisotropy = 1;
  tex.colorSpace = THREE.SRGBColorSpace;
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 120),
    new THREE.MeshLambertMaterial({ map: tex }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.005;
  scene.add(road);
  env.road = road;
  env.roadTex = tex;

  const starGeo = new THREE.BufferGeometry();
  const n = gpu.tier <= 1 ? 200 : 400;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 120;
    pos[i * 3 + 1] = 8 + Math.random() * 40;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 120;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xc8d4e4, size: 0.08, sizeAttenuation: true }));
  scene.add(stars);
  env.stars = stars;

  const ringGeo = new THREE.TorusGeometry(3.4, 0.055, 8, 48);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x3d8aaa, transparent: false });
  const count = 16;
  const rings = new THREE.InstancedMesh(ringGeo, ringMat, count);
  rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rings.visible = false;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion(); // torus is already in XY, axis = Z: we drive through along Z
  const s = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < count; i++) {
    m.compose(new THREE.Vector3(0, 1.05, -4 - i * 5.5), q, s);
    rings.setMatrixAt(i, m);
  }
  rings.instanceMatrix.needsUpdate = true;
  scene.add(rings);
  env.rings = rings;
  env.ringCount = count;
  env.ringOffset = 0;
}

function makeLoader() {
  const draco = new DRACOLoader().setDecoderPath('./vendor/draco/gltf/');
  const ktx2 = new KTX2Loader().setTranscoderPath('./vendor/basis/').detectSupport(renderer);
  return new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
}

/** Strip transmission everywhere (never a second glass pass).
 *  Corvette body glass: simple alpha so the cabin unit is visible.
 *  C204 port glass stays opaque and tinted. */
function prepareMaterials(root, { carGlass = false } = {}) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = false;
    o.receiveShadow = false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      if ('transmission' in m && m.transmission) m.transmission = 0;
      const matName = (m.name || '').toLowerCase();
      const objName = (o.name || '').toLowerCase();
      const isCorvetteGlass = matName === 'corvette_glass'
        || /windshield_glass|door_window/.test(objName);
      const isPortGlass = /port/.test(matName) || (/glass/.test(matName) && !isCorvetteGlass)
        || (/port/.test(objName) && /glass/.test(objName));
      if (carGlass && isCorvetteGlass) {
        m.transparent = true;
        m.opacity = 0.35;
        m.depthWrite = false;
        m.alphaTest = 0;
        m.side = THREE.DoubleSide;
        if (m.color) m.color.set(0xa8c0cc);
        m.metalness = 0.12;
        m.roughness = 0.08;
        o.renderOrder = 1;
      } else if (isPortGlass || ((m.transparent || m.opacity < 1) && !isCorvetteGlass)) {
        m.transparent = false;
        m.opacity = 1;
        m.depthWrite = true;
        m.alphaTest = 0;
        if (/glass|port/.test(matName) || /glass|port/.test(objName)) {
          if (m.color) m.color.set(0x1a2830);
          m.metalness = Math.min(0.4, m.metalness || 0);
          m.roughness = Math.max(0.25, m.roughness || 0.4);
        }
      }
      if (m.envMapIntensity == null) m.envMapIntensity = 0.4;
    }
  });
}

function mergeNamed(root, testFn) {
  const meshes = [];
  root.traverse((o) => { if (o.isMesh && testFn(o.name)) meshes.push(o); });
  if (meshes.length < 2) return 0;
  const parent = meshes[0].parent;
  const geos = [];
  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    const g = mesh.geometry.clone();
    const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
    const rel = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
    g.applyMatrix4(rel);
    geos.push(g);
  }
  let merged;
  try { merged = mergeGeometries(geos, false); }
  catch (_) { geos.forEach((g) => g.dispose()); return 0; }
  if (!merged) { geos.forEach((g) => g.dispose()); return 0; }
  const mat = meshes[0].material;
  const out = new THREE.Mesh(merged, mat);
  out.name = meshes[0].name + '_merged';
  out.castShadow = false;
  parent.add(out);
  for (const mesh of meshes) mesh.visible = false;
  geos.forEach((g) => g.dispose());
  return meshes.length - 1;
}

/** Merge every visible descendant mesh of `root` by material. Originals are hidden, names kept. */
function mergeByMaterial(root, namePrefix = 'merged') {
  const groups = new Map();
  root.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry) return;
    const key = o.material;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  });
  let saved = 0;
  groups.forEach((meshes, mat) => {
    if (meshes.length < 2) return;
    const geos = [];
    for (const mesh of meshes) {
      mesh.updateWorldMatrix(true, false);
      const g = mesh.geometry.clone();
      const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld));
      geos.push(g);
    }
    let merged;
    try { merged = mergeGeometries(geos, false); }
    catch (_) { geos.forEach((g) => g.dispose()); return; }
    if (!merged) { geos.forEach((g) => g.dispose()); return; }
    const out = new THREE.Mesh(merged, mat);
    out.name = namePrefix + '_' + (mat.name || 'mat');
    out.castShadow = false;
    root.add(out);
    for (const mesh of meshes) mesh.visible = false;
    geos.forEach((g) => g.dispose());
    saved += meshes.length - 1;
  });
  return saved;
}

function indexNodes(obj, map) {
  obj.traverse((o) => {
    if (o.name) map.set(o.name, o);
  });
}

function playClip(holder, name, loop = THREE.LoopOnce, timeScale = 1) {
  if (!holder.mixer || !holder.clips[name]) return null;
  holder.mixer.stopAllAction();
  const a = holder.mixer.clipAction(holder.clips[name]);
  a.reset();
  a.setLoop(loop, loop === THREE.LoopRepeat ? Infinity : 1);
  a.clampWhenFinished = loop === THREE.LoopOnce;
  a.timeScale = timeScale * (animScale || 1);
  a.play();
  return a;
}

function loadGltf(loader, url) {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, (ev) => {
      if (ev.total) setLoad(0.1 + 0.4 * (ev.loaded / ev.total));
    }, reject);
  });
}

async function loadModels() {
  const loader = makeLoader();
  setLoad(0.1, 'Chargement de l’unité C204…');
  const gUnit = await loadGltf(loader, './assets/c204-v2.glb');
  setLoad(0.55, 'Chargement de la Corvette…');
  const gCar = await loadGltf(loader, './assets/corvette-v2.glb');
  setLoad(0.78, 'Chargement de l’IBM 5100…');
  const gIbm = await loadGltf(loader, './assets/ibm5100.glb');
  setLoad(0.88, 'Préparation de la scène…');

  c204.root = gUnit.scene;
  c204.root.name = 'c204_standalone';
  prepareMaterials(c204.root);
  mergeNamed(c204.root, (n) => /^emergency_controls_led_/.test(n));
  c204.mixer = new THREE.AnimationMixer(c204.root);
  for (const clip of gUnit.animations) c204.clips[clip.name] = clip;
  indexNodes(c204.root, c204.nodes);
  c204.root.visible = false;
  scene.add(c204.root);

  car.root = gCar.scene;
  car.root.name = 'corvette_root_scene';
  prepareMaterials(car.root, { carGlass: true });
  car.mixer = new THREE.AnimationMixer(car.root);
  for (const clip of gCar.animations) car.clips[clip.name] = clip;
  car.root.traverse((o) => {
    if (o.isMesh && /^wheel/i.test(o.name)) car.wheels.push(o);
    // also parent groups named wheel_FL etc.
    if (!o.isMesh && /^wheel[_-]?[FRL]{2}$/i.test(o.name)) car.wheels.push(o);
  });
  if (car.wheels.length === 0) {
    car.root.traverse((o) => {
      if (/wheel/i.test(o.name) && o.children.length === 0 && o.isMesh) car.wheels.push(o);
    });
  }
  // Prefer rotating named wheel groups
  const wheelGroups = [];
  car.root.traverse((o) => {
    if (o.name && /^wheel_(FL|FR|RL|RR|fl|fr|rl|rr)$/i.test(o.name)) wheelGroups.push(o);
  });
  if (wheelGroups.length) car.wheels = wheelGroups;
  // The Corvette already embeds a full C204 (many meshes). Merge that unit
  // so drive/jump/menu stay under 100 draw calls. The standalone C204 is used for the vue éclatée.
  const embedded = car.root.getObjectByName('c204_root') || car.root.getObjectByName('c204_unit');
  if (embedded) { car.root.updateWorldMatrix(true, true); mergeByMaterial(embedded, 'c204_embedded'); }
  car.root.visible = true;
  scene.add(car.root);

  // Roadster: hide the closed soft top so the C204 unit in the cabin is visible
  // (menu, drive, jump). The top_down clip is not used because playClip()
  // stops all other car actions (wheels_spin, jump).
  const softTop = car.root.getObjectByName('soft_top');
  if (softTop) softTop.visible = false;

  // Warm fill in the open cabin so the unit is readable at night (no shadow).
  const cabinLight = new THREE.PointLight(0xffe8c8, 4.5, 5.5, 1.2);
  cabinLight.name = 'cabin_fill';
  // In front of the unit, lighting the ID / DANGER plates (front face).
  cabinLight.position.set(0.15, 0.95, -0.35);
  cabinLight.castShadow = false;
  car.root.add(cabinLight);

  playClip(c204, 'idle', THREE.LoopRepeat);
  if (car.clips.idle) playClip(car, 'idle', THREE.LoopRepeat);

  // IBM 5100: static, no clips. Root ibm_5100, meshes may sit on quantized children.
  // Front +Z, origin bottom center, Y-up, 0.4465 × 0.2038 × 0.6123 m. Screen emissive 1.2.
  ibm.root = gIbm.scene.getObjectByName('ibm_5100') || gIbm.scene;
  ibm.root.traverse((o) => {
    if (o.name) ibm.nodes.set(o.name, o);
    if (!o.isMesh) return;
    o.castShadow = false;
    o.receiveShadow = false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (m && 'transmission' in m && m.transmission) m.transmission = 0;
    }
  });
  seatIbm();
  setIbmVisible(false);
}

/** Sit the IBM on the passenger-seat cushion, parented to the car (follows drive / jump).
 *  setFromObject on the whole seat includes the backrest (~0.88 m); the cushion top
 *  (front half of the mesh) is ≈ 0.445 m. Front +Z (Rendu) faces the windshield. */
function seatIbm() {
  if (!ibm.root || !car.root) return;
  if (ibm.root.parent !== car.root) car.root.add(ibm.root);
  const seat = car.root.getObjectByName('seat_r') || car.root.getObjectByName('seat_l');
  const x = seat ? seat.position.x : -0.36;
  const z = seat ? seat.position.z - 0.04 : -0.22;
  ibm.root.position.set(x, 0.445, z);
  ibm.root.rotation.set(0, 0, 0);
  ibm.root.scale.set(1, 1, 1);
}

function setIbmVisible(on) {
  if (ibm.root) ibm.root.visible = !!on;
}

function applyOrbit() {
  const { az, pol, dist, target } = orbit;
  const sp = Math.sin(pol), cp = Math.cos(pol);
  camera.position.set(
    target.x + dist * sp * Math.sin(az),
    target.y + dist * cp,
    target.z + dist * sp * Math.cos(az),
  );
  camera.lookAt(target);
}

function setMode(next) {
  mode = next;
  const drive = next === 'drive';
  const jump = next === 'jump';
  const mini = next === 'minigame';
  const expl = next === 'explode';
  const menu = next === 'menu';
  const showCar = drive || jump || menu;
  const showUnit = mini || expl;
  if (car.root) car.root.visible = showCar;
  if (c204.root) c204.root.visible = showUnit;
  if (env.ground) env.ground.visible = showCar || menu;
  if (env.road) env.road.visible = drive || jump || menu;
  if (env.rings) env.rings.visible = jump;
  if (env.stars) env.stars.visible = true;

  $('menu').classList.toggle('hidden', next !== 'menu');
  $('briefing').classList.toggle('hidden', next !== 'briefing');
  $('hudStats').classList.toggle('hidden', !(drive || jump || mini));
  $('driveHint').classList.toggle('hidden', next !== 'drive');
  $('touch').classList.toggle('hidden', !(drive || jump || (mini && currentMini && currentMini.joys)));
  $('bJump').classList.toggle('hidden', next !== 'drive');
  $('joyL').classList.toggle('hidden', !(drive || jump || (mini && currentMini && currentMini.joys)));
  $('joyR').classList.toggle('hidden', !(mini && currentMini && currentMini.dualJoy));
  $('mini').classList.toggle('hidden', next !== 'minigame');
  $('jumpHud').classList.toggle('hidden', next !== 'jump');
  $('bar').classList.toggle('hidden', next !== 'explode');
  $('bBarMenu').classList.toggle('hidden', next !== 'explode');

  if (expl) {
    orbit.dist = 2.4; orbit.az = 0.7; orbit.pol = 1.15;
    orbit.target.set(0, 0.18, 0.05);
    orbit.minD = 0.8; orbit.maxD = 6;
    if (c204.root) { c204.root.position.set(0, 0, 0); c204.root.rotation.set(0, 0, 0); }
    playClip(c204, 'explode', THREE.LoopOnce, prefersReduce ? 8 : (animScale > 1 ? animScale : 1));
  } else if (mini) {
    orbit.dist = 2.15; orbit.az = 0.72; orbit.pol = 1.05;
    orbit.target.set(0, 0.20, 0.04);
    orbit.minD = 0.9; orbit.maxD = 4;
    // Open the unit (explode pose, fast) so the deck and singularities are visible.
    if (c204.clips.explode) {
      const a = playClip(c204, 'explode', THREE.LoopOnce, 8);
      if (a) a.time = a.getClip().duration;
    }
  } else if (menu) {
    const land = window.innerWidth > window.innerHeight && window.innerHeight <= 500;
    orbit.dist = land ? 5.2 : 5.4;
    orbit.az = 0.9; orbit.pol = 0.78;
    orbit.target.set(land ? 1.25 : 0, 0.4, 0);
    orbit.minD = 3; orbit.maxD = 16;
    if (car.root) { car.root.position.set(0, 0, 0); car.root.rotation.set(0, 0.55, 0); }
  } else if (drive) {
    if (car.root) { car.root.position.set(0, 0, 0); car.root.rotation.set(0, 0, 0); }
    if (car.clips.wheels_spin) playClip(car, 'wheels_spin', THREE.LoopRepeat);
  } else if (jump) {
    if (car.root) { car.root.position.set(0, 0, 0); car.root.rotation.set(0, 0, 0); }
    if (car.clips.jump) playClip(car, 'jump', THREE.LoopRepeat);
  }
  refreshHud();
}

function refreshHud() {
  $('hudScore').textContent = String(Math.floor(score));
  $('hudLives').textContent = lives > 0 ? '●'.repeat(lives) + '○'.repeat(Math.max(0, 3 - lives)) : '○○○';
  const dest = missionDest();
  $('hudLevel').textContent = dest.label;
  $('ttlSub').textContent = dest.sub;
}

function missionDest() {
  if (level <= 1) return { from: 2036, to: 1975, label: '2036 → 1975', sub: 'Aller chercher l’IBM 5100' };
  if (level === 2) return { from: 1975, to: 2036, label: '1975 → 2036', sub: ibmGot ? 'Retour avec l’IBM 5100' : 'Retour en 2036' };
  return { from: 2036, to: 2036 + level, label: 'Saut ' + level, sub: MISSION.continueFlavor };
}

/* ---------------- input ---------------- */
function bindInput() {
  const canvas = $('c');
  const onDown = (e) => {
    AudioSys.unlock();
    if (e.target.closest && e.target.closest('button, a, input, .panel, .sheet, #miniStage, #touch, #bar, #top')) return;
    pointerDragging = true;
    pointerMoved = 0;
    lastPtr.x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    lastPtr.y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    lastPtr.id = e.pointerId ?? 0;
  };
  const onMove = (e) => {
    if (!pointerDragging) return;
    const x = e.clientX, y = e.clientY;
    const dx = x - lastPtr.x, dy = y - lastPtr.y;
    lastPtr.x = x; lastPtr.y = y;
    pointerMoved += Math.abs(dx) + Math.abs(dy);
    if (mode === 'menu' || mode === 'explode' || mode === 'minigame') {
      orbit.az -= dx * 0.007;
      orbit.pol = Math.max(0.25, Math.min(Math.PI - 0.25, orbit.pol - dy * 0.005));
    }
  };
  const onUp = (e) => {
    if (!pointerDragging) return;
    pointerDragging = false;
    if (pointerMoved < 10 && mode === 'explode') pickAt(e.clientX, e.clientY);
  };
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    orbit.dist = Math.max(orbit.minD, Math.min(orbit.maxD, orbit.dist * (1 + e.deltaY * 0.0015)));
  }, { passive: false });

  let pinch0 = 0;
  canvas.addEventListener('touchstart', (e) => {
    AudioSys.unlock();
    if (e.touches.length === 2) {
      const a = e.touches[0], b = e.touches[1];
      pinch0 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinch0) {
      const a = e.touches[0], b = e.touches[1];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      orbit.dist = Math.max(orbit.minD, Math.min(orbit.maxD, orbit.dist * (pinch0 / d)));
      pinch0 = d;
    }
  }, { passive: true });

  bindJoy($('joyL'), 'main');
  bindJoy($('joyR'), 'alt');

  window.addEventListener('keydown', (e) => {
    AudioSys.unlock();
    keys.add(e.code);
    if (e.code === 'Space' || e.code === 'Enter') {
      if (e.repeat) return;
      if (e.code === 'Space') e.preventDefault();
      onAction();
    }
    if (e.code === 'Escape') onEscape();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));

  $('bMute').addEventListener('click', () => {
    AudioSys.unlock();
    AudioSys.muted = !AudioSys.muted;
    $('bMute').textContent = AudioSys.muted ? '🔇' : '🔊';
    $('bMute').setAttribute('aria-pressed', AudioSys.muted ? 'true' : 'false');
  });
  $('bFull').addEventListener('click', toggleFull);
  $('bMission').addEventListener('click', () => openBriefing());
  $('bExplode').addEventListener('click', () => openExploded());
  $('bSources').addEventListener('click', () => openSources());
  $('bLinks').addEventListener('click', () => openLinks());
  $('bBriefGo').addEventListener('click', () => startDrive());
  $('bJump').addEventListener('click', () => startSequence());
  $('bMiniAct').addEventListener('click', () => onAction());
  $('bBarMenu').addEventListener('click', () => goMenu());
  $('bBarExplode').addEventListener('click', () => openExploded());
  $('bBarSrc').addEventListener('click', () => openSources());
  $('bResGo').addEventListener('click', () => onResultGo());
  $('bResMenu').addEventListener('click', () => { hideResult(); goMenu(); });
  document.querySelectorAll('[data-close]').forEach((b) => {
    b.addEventListener('click', () => closePanel(b.getAttribute('data-close')));
  });
}

function bindJoy(el, which) {
  if (!el) return;
  let active = false, pid = -1;
  const knob = el.querySelector('i');
  const apply = (cx, cy) => {
    const r = el.getBoundingClientRect();
    const x = (cx - (r.left + r.width / 2)) / (r.width / 2);
    const y = (cy - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(x, y) || 1;
    const nx = x / Math.max(1, l), ny = y / Math.max(1, l);
    if (which === 'main') { input.x = nx; input.y = -ny; }
    else { input.x2 = nx; input.y2 = -ny; }
    knob.style.transform = `translate(${nx * 28}px, ${ny * 28}px)`;
  };
  const clear = () => {
    active = false;
    if (which === 'main') { input.x = 0; input.y = 0; }
    else { input.x2 = 0; input.y2 = 0; }
    knob.style.transform = '';
  };
  el.addEventListener('pointerdown', (e) => {
    AudioSys.unlock();
    active = true; pid = e.pointerId;
    el.setPointerCapture(e.pointerId);
    apply(e.clientX, e.clientY);
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => { if (active && e.pointerId === pid) apply(e.clientX, e.clientY); });
  el.addEventListener('pointerup', (e) => { if (e.pointerId === pid) clear(); });
  el.addEventListener('pointercancel', clear);
}

function pollKeysAndPad() {
  let kx = 0, ky = 0, kx2 = 0, ky2 = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) kx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) kx += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) ky += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) ky -= 1;
  if (keys.has('KeyJ')) kx2 -= 1;
  if (keys.has('KeyL')) kx2 += 1;
  if (keys.has('KeyI')) ky2 += 1;
  if (keys.has('KeyK')) ky2 -= 1;
  try {
    const pads = navigator.getGamepads?.() || [];
    for (const p of pads) {
      if (!p) continue;
      if (Math.abs(p.axes[0]) > 0.15) kx += p.axes[0];
      if (Math.abs(p.axes[1]) > 0.15) ky -= p.axes[1];
      if (Math.abs(p.axes[2]) > 0.15) kx2 += p.axes[2];
      if (Math.abs(p.axes[3]) > 0.15) ky2 -= p.axes[3];
      if (p.buttons[0]?.pressed && !input._pad0) { input._pad0 = true; onAction(); }
      if (!p.buttons[0]?.pressed) input._pad0 = false;
    }
  } catch (_) { /* no gamepad */ }
  // Don't override active joystick
  const joyUsed = Math.abs(input.x) + Math.abs(input.y) > 0.02;
  const joy2 = Math.abs(input.x2) + Math.abs(input.y2) > 0.02;
  if (!joyUsed && (kx || ky)) {
    const l = Math.hypot(kx, ky) || 1;
    input.x = kx / l; input.y = ky / l;
    input._fromKey = true;
  } else if (input._fromKey && !kx && !ky) {
    input.x = 0; input.y = 0; input._fromKey = false;
  }
  if (!joy2 && (kx2 || ky2)) {
    const l = Math.hypot(kx2, ky2) || 1;
    input.x2 = kx2 / l; input.y2 = ky2 / l;
    input._fromKey2 = true;
  } else if (input._fromKey2 && !kx2 && !ky2) {
    input.x2 = 0; input.y2 = 0; input._fromKey2 = false;
  }
}

function toggleFull() {
  const el = document.documentElement;
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
  }
}

function onResize() {
  const vv = window.visualViewport;
  const w = Math.max(1, Math.round(vv?.width || window.innerWidth));
  const h = Math.max(1, Math.round(vv?.height || window.innerHeight));
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(pixelRatioCap, window.devicePixelRatio || 1));
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  $('c').style.width = w + 'px';
  $('c').style.height = h + 'px';
}

function onEscape() {
  if (!$('sheet').classList.contains('hidden')) { closePanel('sheet'); return; }
  if (!$('sources').classList.contains('hidden')) { closePanel('sources'); return; }
  if (!$('links').classList.contains('hidden')) { closePanel('links'); return; }
  if (!$('briefing').classList.contains('hidden')) { closePanel('briefing'); return; }
  if (!$('result').classList.contains('hidden')) return;
  if (mode === 'explode') goMenu();
}

function closePanel(id) {
  const el = $(id);
  if (el) el.classList.add('hidden');
  if (id === 'briefing' && mode === 'briefing') goMenu();
  if (id === 'sources' || id === 'links') {
    if (mode === 'menu') $('menu').classList.remove('hidden');
  }
  if (id === 'sheet') clearHighlight();
}


/* ---------------- UI panels ---------------- */
function fillSources() {
  const q = $('srcQuote');
  q.innerHTML = '';
  const p = document.createElement('p');
  p.textContent = INTRO_QUOTE.fr_intro;
  const t = document.createElement('p');
  t.textContent = '« ' + INTRO_QUOTE.en + ' »';
  const c = document.createElement('cite');
  const src = SOURCES.find((s) => s.id === INTRO_QUOTE.source);
  const a = document.createElement('a');
  a.href = src.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
  a.textContent = src.title;
  c.append(document.createTextNode('Source : '), a, document.createTextNode(' — ' + INTRO_QUOTE.tagNote));
  q.append(p, t, c);

  const list = $('srcList');
  list.innerHTML = '';
  for (const s of SOURCES) {
    const art = document.createElement('article');
    art.className = 'src-item';
    const h = document.createElement('h3');
    const link = document.createElement('a');
    link.href = s.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.textContent = s.title;
    h.append(link);
    const note = document.createElement('p');
    note.textContent = s.note;
    art.append(h, note);
    list.append(art);
  }
}

function fillLinks() {
  const list = $('lnkList');
  list.innerHTML = '';
  for (const l of LINKS) {
    const art = document.createElement('article');
    art.className = 'lnk-item';
    const h = document.createElement('h3');
    const a = document.createElement('a');
    a.href = l.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.textContent = l.title;
    h.append(a);
    const n = document.createElement('p');
    n.textContent = l.note;
    art.append(h, n);
    list.append(art);
  }
}

function fillBriefing() {
  const box = $('brBody');
  box.innerHTML = '';
  for (const t of MISSION.briefing) {
    const p = document.createElement('p');
    p.textContent = t;
    box.append(p);
  }
}

function openSources() {
  $('menu').classList.add('hidden');
  $('sources').classList.remove('hidden');
  $('sources').querySelector('.close')?.focus();
}

function openLinks() {
  $('menu').classList.add('hidden');
  $('links').classList.remove('hidden');
}

function openBriefing() {
  AudioSys.unlock();
  // Every new run started from the menu must reset lives / score / level.
  // (Game-over "Menu" then "Commencer" used to keep 0 lives.)
  resetRun();
  setMode('briefing');
  $('menu').classList.add('hidden');
  $('briefing').classList.remove('hidden');
}

function openExploded() {
  AudioSys.unlock();
  hideResult();
  $('menu').classList.add('hidden');
  $('sources').classList.add('hidden');
  $('briefing').classList.add('hidden');
  setMode('explode');
  $('hint')?.classList?.remove('hidden');
}

function goMenu() {
  hideResult();
  closePanel('sheet');
  closePanel('sources');
  closePanel('links');
  closePanel('briefing');
  if (currentMini) { currentMini.destroy(); currentMini = null; }
  if (jumpState) jumpState = null;
  setMode('menu');
}

function startDrive() {
  if (lives <= 0) resetRun();
  $('briefing').classList.add('hidden');
  setMode('drive');
  AudioSys.beep(392, 0.1, 'square', 0.05);
}

/* ---------------- picking / cards ---------------- */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let highlighted = [];

function clearHighlight() {
  for (const { mat, em, col } of highlighted) {
    if (mat.emissive) mat.emissive.setHex(em);
    if (mat.emissiveIntensity != null) mat.emissiveIntensity = col;
  }
  highlighted = [];
}

function highlightNode(node) {
  clearHighlight();
  node.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      highlighted.push({
        mat: m,
        em: m.emissive ? m.emissive.getHex() : 0,
        col: m.emissiveIntensity ?? 0,
      });
      if (m.emissive) m.emissive.set(0x3a6a4a);
      m.emissiveIntensity = Math.max(m.emissiveIntensity || 0, 0.55);
    }
  });
}

function pickAt(cx, cy) {
  const rect = $('c').getBoundingClientRect();
  ndc.x = ((cx - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((cy - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const roots = [];
  if (c204.root && c204.root.visible) roots.push(c204.root);
  const hits = raycaster.intersectObjects(roots, true);
  if (!hits.length) return;
  let obj = hits[0].object;
  let id = null, nodeName = null;
  while (obj) {
    id = cardIdFor(obj.name);
    if (id) { nodeName = obj.name; break; }
    obj = obj.parent;
  }
  if (id) openCard(id, nodeName, obj);
}

function openCard(idOrName, nodeName, node) {
  let id = CARDS[idOrName] ? idOrName : cardIdFor(idOrName);
  if (!id || !CARDS[id]) return false;
  const card = CARDS[id];
  if (node) highlightNode(node);
  else if (c204.root) {
    let found = null;
    c204.root.traverse((o) => {
      if (!found && cardIdFor(o.name) === id && o.isMesh) found = o;
    });
    if (found) highlightNode(found);
  }
  const tag = $('shTag');
  tag.textContent = TAG_LABEL[card.tag];
  tag.className = 'tag ' + card.tag;
  tag.title = TAG_HINT[card.tag];
  $('shRef').textContent = card.ref || '';
  $('shTitle').textContent = card.title;
  $('shEn').textContent = card.en || '';
  $('shBody').textContent = card.body || '';
  $('shFact').textContent = card.fact || '';
  const ul = $('shSrc');
  ul.innerHTML = '';
  for (const sid of (card.sources || [])) {
    const s = SOURCES.find((x) => x.id === sid);
    if (!s) continue;
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = s.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.textContent = s.title;
    li.append(a);
    ul.append(li);
  }
  $('sheet').classList.remove('hidden');
  AudioSys.beep(660, 0.05, 'square', 0.04);
  return true;
}

/* ---------------- minigames ---------------- */
let currentMini = null;
let miniIndex = 0;
let jumpState = null;
let sequenceActive = false;

const MINI_META = [
  { id: 'inject', title: 'Injection d’électrons', help: 'Touche le bouton quand le curseur est dans la zone verte.', btn: 'Injecter', joys: false },
  { id: 'sing', title: 'Stabiliser les deux singularités', help: 'Deux joysticks (ou WASD et IJKL) : garde chaque point dans le cercle.', btn: 'OK', joys: true, dualJoy: true },
  { id: 'vgl', title: 'Verrouillage de gravité variable', help: 'Verrouille quand l’aiguille est dans la bande verte.', btn: 'Verrouiller', joys: false },
  { id: 'clocks', title: 'Synchroniser les horloges au césium', help: 'Ajuste l’horloge 2 pour qu’elle égale l’horloge 1, puis valide.', btn: 'Synchroniser', joys: false },
];

function difficulty() {
  const L = Math.max(1, level);
  return {
    hits: 4 + Math.min(4, L),
    zone: Math.max(0.08, 0.18 - L * 0.02),
    speed: 0.55 + L * 0.12,
    hold: 2.2 + L * 0.25,
    drift: 0.55 + L * 0.18,
    padSize: Math.max(0.14, 0.26 - L * 0.025),
    locks: 2 + (L > 2 ? 1 : 0),
    band: Math.max(0.06, 0.16 - L * 0.02),
    needle: 1.1 + L * 0.25,
    clockTol: Math.max(2, 12 - L * 2),
    jumpDur: 8 + L * 2.5,
    jumpDrift: 0.55 + L * 0.2,
  };
}

function startSequence() {
  AudioSys.unlock();
  sequenceActive = true;
  miniIndex = 0;
  $('driveHint').classList.add('hidden');
  startMinigame(0);
}

function startMinigame(i) {
  miniIndex = i;
  if (currentMini) currentMini.destroy();
  const d = difficulty();
  const meta = MINI_META[i];
  if (i === 0) currentMini = new InjectGame(d, meta);
  else if (i === 1) currentMini = new SingGame(d, meta);
  else if (i === 2) currentMini = new VglGame(d, meta);
  else currentMini = new ClockGame(d, meta);
  $('miniStep').textContent = 'Étape ' + (i + 1) + ' / 4';
  $('miniTitle').textContent = meta.title;
  $('miniHelp').textContent = meta.help;
  $('bMiniAct').textContent = meta.btn;
  $('bMiniAct').classList.toggle('hidden', meta.joys && i === 1);
  currentMini.start();
  setMode('minigame');
  // setMode resets joys based on currentMini — call after assignment, already done. Re-apply touch visibility:
  $('touch').classList.toggle('hidden', !meta.joys);
  $('joyL').classList.toggle('hidden', !meta.joys);
  $('joyR').classList.toggle('hidden', !meta.dualJoy);
  $('bJump').classList.add('hidden');
  AudioSys.beep(440 + i * 80, 0.1, 'square', 0.05);
}

function onMinigameDone(won) {
  if (won) {
    score += 400 + level * 50;
    AudioSys.chord(true);
    flash(false);
    if (miniIndex < 3) {
      startMinigame(miniIndex + 1);
    } else {
      if (currentMini) { currentMini.destroy(); currentMini = null; }
      startJump();
    }
  } else {
    AudioSys.chord(false);
    flash(true);
    loseLife('Séquence interrompue');
  }
  refreshHud();
}

function loseLife(why) {
  lives -= 1;
  refreshHud();
  if (lives <= 0) {
    showResult('Mission échouée', why + '. Plus de vies. Tu peux recommencer depuis le menu.', 'Recommencer', () => {
      resetRun();
      openBriefing();
    });
    return;
  }
  showResult('Échec de l’étape', why + '. Il te reste ' + lives + ' vie' + (lives > 1 ? 's' : '') + '.', 'Réessayer', () => {
    hideResult();
    if (mode === 'jump' || jumpState) startJump();
    else startMinigame(miniIndex);
  });
}

function InjectGame(d, meta) {
  this.joys = false;
  this.done = false;
  this.pos = 0;
  this.dir = 1;
  this.need = d.hits;
  this.ok = 0;
  this.miss = 0;
  this.zone = d.zone;
  this.speed = d.speed;
  this.zoneAt = 0.5;
  this.el = null;
}
InjectGame.prototype.start = function () {
  this.zoneAt = 0.35 + Math.random() * 0.3;
  const st = $('miniStage');
  st.innerHTML = '';
  const track = document.createElement('div');
  track.className = 'track';
  const zone = document.createElement('div');
  zone.className = 'zone';
  zone.style.left = ((this.zoneAt - this.zone) * 100) + '%';
  zone.style.width = (this.zone * 2 * 100) + '%';
  const cur = document.createElement('div');
  cur.className = 'cursor';
  const hits = document.createElement('div');
  hits.className = 'hits';
  for (let i = 0; i < this.need; i++) hits.append(document.createElement('i'));
  track.append(zone, cur);
  st.append(track, hits);
  this.el = { cur, hits, zone, track };
};
InjectGame.prototype.update = function (dt) {
  this.pos += this.dir * this.speed * dt;
  if (this.pos > 1) { this.pos = 1; this.dir = -1; }
  if (this.pos < 0) { this.pos = 0; this.dir = 1; }
  if (this.el) this.el.cur.style.left = (this.pos * 100) + '%';
};
InjectGame.prototype.onAction = function () {
  if (this.done) return;
  const hit = Math.abs(this.pos - this.zoneAt) <= this.zone;
  if (hit) {
    this.ok++;
    score += 80;
    AudioSys.beep(720, 0.07, 'square', 0.06);
    this.zoneAt = 0.2 + Math.random() * 0.6;
    if (this.el) {
      this.el.zone.style.left = ((this.zoneAt - this.zone) * 100) + '%';
      this.el.hits.children[this.ok - 1]?.classList.add('on');
    }
    if (this.ok >= this.need) { this.done = true; onMinigameDone(true); }
  } else {
    this.miss++;
    AudioSys.beep(200, 0.1, 'sawtooth', 0.06);
    if (this.miss >= 3) { this.done = true; onMinigameDone(false); }
  }
};
InjectGame.prototype.succeed = function () { this.done = true; onMinigameDone(true); };
InjectGame.prototype.destroy = function () { $('miniStage').innerHTML = ''; };

function SingGame(d, meta) {
  this.joys = true;
  this.dualJoy = true;
  this.done = false;
  this.hold = 0;
  this.need = d.hold;
  this.drift = d.drift;
  this.size = d.padSize;
  this.p1 = { x: (Math.random() - 0.5) * 0.6, y: (Math.random() - 0.5) * 0.6 };
  this.p2 = { x: (Math.random() - 0.5) * 0.6, y: (Math.random() - 0.5) * 0.6 };
  this.v1 = { x: 0, y: 0 }; this.v2 = { x: 0, y: 0 };
  this.el = null;
}
SingGame.prototype.start = function () {
  const st = $('miniStage');
  st.innerHTML = '';
  const pads = document.createElement('div');
  pads.className = 'pads';
  pads.innerHTML = '<div class="pad" id="pad1"><label>Principale</label><div class="center"></div><div class="dot" id="dot1"></div></div>'
    + '<div class="pad" id="pad2"><label>Pilotage</label><div class="center"></div><div class="dot" id="dot2"></div></div>';
  const bar = document.createElement('div');
  bar.className = 'stab';
  bar.innerHTML = '<label>Maintien</label><i><em id="holdBar"></em></i>';
  st.append(pads, bar);
  this.el = { d1: $('dot1'), d2: $('dot2'), p1: $('pad1'), p2: $('pad2'), bar: $('holdBar') };
  this.place();
};
SingGame.prototype.place = function () {
  const toPct = (v) => ((v + 1) / 2) * 100;
  if (!this.el) return;
  this.el.d1.style.left = toPct(this.p1.x) + '%';
  this.el.d1.style.top = toPct(-this.p1.y) + '%';
  this.el.d2.style.left = toPct(this.p2.x) + '%';
  this.el.d2.style.top = toPct(-this.p2.y) + '%';
};
SingGame.prototype.update = function (dt) {
  const d = this.drift;
  this.v1.x += (Math.random() - 0.5) * d * dt * 4;
  this.v1.y += (Math.random() - 0.5) * d * dt * 4;
  this.v2.x += (Math.random() - 0.5) * d * dt * 4;
  this.v2.y += (Math.random() - 0.5) * d * dt * 4;
  this.v1.x += input.x * 3.2 * dt; this.v1.y += input.y * 3.2 * dt;
  this.v2.x += input.x2 * 3.2 * dt; this.v2.y += input.y2 * 3.2 * dt;
  this.v1.x *= 0.96; this.v1.y *= 0.96; this.v2.x *= 0.96; this.v2.y *= 0.96;
  this.p1.x = Math.max(-1, Math.min(1, this.p1.x + this.v1.x * dt * 2.2));
  this.p1.y = Math.max(-1, Math.min(1, this.p1.y + this.v1.y * dt * 2.2));
  this.p2.x = Math.max(-1, Math.min(1, this.p2.x + this.v2.x * dt * 2.2));
  this.p2.y = Math.max(-1, Math.min(1, this.p2.y + this.v2.y * dt * 2.2));
  const ok1 = Math.hypot(this.p1.x, this.p1.y) < this.size * 2.2;
  const ok2 = Math.hypot(this.p2.x, this.p2.y) < this.size * 2.2;
  this.el?.p1.classList.toggle('ok', ok1);
  this.el?.p2.classList.toggle('ok', ok2);
  if (ok1 && ok2) this.hold += dt;
  else this.hold = Math.max(0, this.hold - dt * 0.6);
  if (this.el?.bar) this.el.bar.style.transform = 'scaleX(' + Math.min(1, this.hold / this.need) + ')';
  this.place();
  if (this.hold >= this.need && !this.done) { this.done = true; onMinigameDone(true); }
};
SingGame.prototype.onAction = function () {};
SingGame.prototype.succeed = function () { this.done = true; onMinigameDone(true); };
SingGame.prototype.destroy = function () { $('miniStage').innerHTML = ''; };

function VglGame(d, meta) {
  this.joys = false;
  this.done = false;
  this.pos = 0.5;
  this.t = 0;
  this.need = d.locks;
  this.ok = 0;
  this.miss = 0;
  this.band = d.band;
  this.speed = d.needle;
  this.center = 0.5;
  this.el = null;
}
VglGame.prototype.start = function () {
  this.center = 0.4 + Math.random() * 0.2;
  const st = $('miniStage');
  st.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'needle-box';
  const band = document.createElement('div');
  band.className = 'band';
  band.style.left = ((this.center - this.band) * 100) + '%';
  band.style.width = (this.band * 2 * 100) + '%';
  const needle = document.createElement('div');
  needle.className = 'needle';
  const hits = document.createElement('div');
  hits.className = 'hits';
  for (let i = 0; i < this.need; i++) hits.append(document.createElement('i'));
  box.append(band, needle);
  st.append(box, hits);
  this.el = { needle, band, hits };
};
VglGame.prototype.update = function (dt) {
  this.t += dt * this.speed;
  this.pos = 0.5 + Math.sin(this.t * 1.7) * 0.38 + Math.sin(this.t * 4.3) * 0.1;
  this.pos = Math.max(0, Math.min(1, this.pos));
  if (this.el) this.el.needle.style.left = (this.pos * 100) + '%';
};
VglGame.prototype.onAction = function () {
  if (this.done) return;
  const hit = Math.abs(this.pos - this.center) <= this.band;
  if (hit) {
    this.ok++;
    score += 100;
    AudioSys.beep(880, 0.08, 'square', 0.06);
    this.el?.hits.children[this.ok - 1]?.classList.add('on');
    this.center = 0.28 + Math.random() * 0.44;
    if (this.el) {
      this.el.band.style.left = ((this.center - this.band) * 100) + '%';
    }
    if (this.ok >= this.need) { this.done = true; onMinigameDone(true); }
  } else {
    this.miss++;
    AudioSys.beep(160, 0.12, 'sawtooth', 0.06);
    if (this.miss >= 3) { this.done = true; onMinigameDone(false); }
  }
};
VglGame.prototype.succeed = function () { this.done = true; onMinigameDone(true); };
VglGame.prototype.destroy = function () { $('miniStage').innerHTML = ''; };

function ClockGame(d, meta) {
  this.joys = false;
  this.done = false;
  this.tol = d.clockTol;
  this.target = 100 + Math.floor(Math.random() * 800);
  this.value = (this.target + 200 + Math.floor(Math.random() * 400)) % 1000;
  this.el = null;
}
ClockGame.prototype.start = function () {
  const st = $('miniStage');
  st.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'clock-sync';
  wrap.innerHTML = '<p style="margin:0 0 6px;font-size:.8rem;color:var(--muted)">La seconde du SI est définie par 9 192 631 770 périodes du césium 133 — fait métrologique, indépendant du récit. Ici, tu alignes deux compteurs de la simulation.</p>'
    + '<div class="clock-row"><span>Horloge 1 (référence)</span><strong id="clkA"></strong></div>'
    + '<div class="clock-row"><span>Horloge 2</span><strong id="clkB"></strong>'
    + '<span><button type="button" id="clkM" aria-label="Diminuer">−</button>'
    + '<button type="button" id="clkP" aria-label="Augmenter">+</button></span></div>'
    + '<input type="range" id="clkR" min="0" max="999" aria-label="Réglage de l’horloge 2">';
  st.append(wrap);
  this.el = { a: $('clkA'), b: $('clkB'), r: $('clkR') };
  const step = Math.max(1, Math.round(this.tol / 2));
  $('clkM').addEventListener('click', () => this.adj(-step));
  $('clkP').addEventListener('click', () => this.adj(step));
  $('clkR').addEventListener('input', () => { this.value = +$('clkR').value; this.draw(); });
  this.draw();
};
ClockGame.prototype.draw = function () {
  const fmt = (n) => String(n).padStart(3, '0');
  if (this.el) {
    this.el.a.textContent = fmt(this.target);
    this.el.b.textContent = fmt(this.value);
    this.el.r.value = this.value;
  }
};
ClockGame.prototype.adj = function (d) {
  this.value = Math.max(0, Math.min(999, this.value + d));
  this.draw();
  AudioSys.beep(500, 0.03, 'square', 0.03);
};
ClockGame.prototype.update = function () {};
ClockGame.prototype.onAction = function () {
  if (this.done) return;
  if (Math.abs(this.value - this.target) <= this.tol) {
    this.done = true;
    score += 200;
    onMinigameDone(true);
  } else {
    AudioSys.beep(180, 0.12, 'sawtooth', 0.06);
  }
};
ClockGame.prototype.succeed = function () { this.value = this.target; this.draw(); this.done = true; onMinigameDone(true); };
ClockGame.prototype.destroy = function () { $('miniStage').innerHTML = ''; };

function onAction() {
  AudioSys.unlock();
  if (mode === 'drive') startSequence();
  else if (mode === 'minigame' && currentMini) currentMini.onAction();
}

/* ---------------- jump ---------------- */
function startJump() {
  const d = difficulty();
  jumpState = {
    t: 0, dur: d.jumpDur, stab: 1, drift: 0, vy: 0,
    nextEvt: 0.8, dir: 0, strength: d.jumpDrift, done: false,
  };
  if (currentMini) { currentMini.destroy(); currentMini = null; }
  $('mini').classList.add('hidden');
  setMode('jump');
  $('touch').classList.remove('hidden');
  $('joyL').classList.remove('hidden');
  $('joyR').classList.add('hidden');
  $('bJump').classList.add('hidden');
  $('jumpHint').textContent = 'Contre la dérive avec le joystick.';
  AudioSys.beep(240, 0.2, 'sine', 0.06);
}

function updateJump(dt) {
  const j = jumpState;
  if (!j || j.done) return;
  j.t += dt;
  j.nextEvt -= dt;
  if (j.nextEvt <= 0) {
    j.dir = Math.random() < 0.5 ? -1 : 1;
    j.vy += j.dir * j.strength * (0.7 + Math.random() * 0.6);
    j.nextEvt = 0.7 + Math.random() * 1.1;
    $('jumpHint').textContent = j.dir < 0 ? 'Dérive à gauche — pousse à droite' : 'Dérive à droite — pousse à gauche';
    AudioSys.beep(300, 0.05, 'square', 0.04);
  }
  j.vy += -input.x * 2.4 * dt * 4;
  j.vy *= 0.98;
  j.drift += j.vy * dt;
  j.drift *= 0.995;
  const abs = Math.abs(j.drift);
  if (abs > 0.15) j.stab -= (abs - 0.15) * dt * 0.85;
  else j.stab = Math.min(1, j.stab + dt * 0.08);
  if (j.stab < 0) j.stab = 0;
  $('stabBar').style.transform = 'scaleX(' + j.stab.toFixed(3) + ')';
  $('stabBar').style.background = j.stab < 0.3 ? 'var(--bad)' : j.stab < 0.6 ? 'var(--amber)' : 'var(--good)';

  // tunnel motion
  if (env.rings) {
    env.ringOffset += dt * 18;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    const n = env.ringCount;
    const span = n * 5.5;
    for (let i = 0; i < n; i++) {
      let z = -4 - ((i * 5.5 + env.ringOffset) % span);
      p.set(j.drift * 0.6, 1.05, z);
      const sc = 1 + Math.sin(j.t * 5 + i) * 0.05;
      s.set(sc, sc, sc);
      m.compose(p, q, s);
      env.rings.setMatrixAt(i, m);
    }
    env.rings.instanceMatrix.needsUpdate = true;
  }
  if (car.root) {
    car.root.position.x = j.drift * 0.8;
    car.root.rotation.z = -j.drift * 0.15;
    car.root.rotation.y = -j.drift * 0.05;
  }
  camera.position.set(j.drift * 0.45, 1.85, 6.8);
  camera.lookAt(j.drift * 0.7, 0.85, -8);
  camera.rotation.z += Math.sin(j.t * 9) * (1 - j.stab) * 0.015;

  if (j.stab <= 0) {
    j.done = true;
    loseLife('Le champ s’est effondré pendant le saut');
    return;
  }
  if (j.t >= j.dur) {
    j.done = true;
    const bonus = Math.round(j.stab * 500) + Math.round(200 * level);
    score += bonus;
    onJumpSuccess(bonus);
  }
}

function onJumpSuccess(bonus) {
  AudioSys.chord(true);
  flash(false);
  refreshHud();
  if (level === 1) {
    ibmGot = true;
    setIbmVisible(true);
    showResult(
      '1975 — IBM 5100 à bord',
      'Premier saut réussi. Dans le récit de Titor, c’est ici qu’il récupère l’IBM 5100. L’ordinateur est maintenant sur le siège passager (modèle 3D, crédit dans Sources). Bonus de stabilité : ' + bonus + '.',
      'Lancer le retour vers 2036',
      () => { level = 2; hideResult(); startDrive(); refreshHud(); },
    );
  } else if (level === 2) {
    showResult(
      '2036 — mission accomplie',
      'Retour effectué avec l’IBM 5100. Score : ' + Math.floor(score) + '. Tu peux enchaîner des sauts plus difficiles, ou revenir au menu. Rappel : le récit de Titor n’a jamais été authentifié.',
      'Sauts plus difficiles',
      () => { level = 3; hideResult(); startDrive(); refreshHud(); },
    );
  } else {
    showResult(
      'Saut ' + level + ' réussi',
      'Champ tenu. Score : ' + Math.floor(score) + '. Bonus : ' + bonus + '.',
      'Saut suivant',
      () => { level += 1; hideResult(); startDrive(); refreshHud(); },
    );
  }
}

let resultCb = null;
function showResult(title, body, goLabel, cb) {
  resultCb = cb;
  $('resTitle').textContent = title;
  $('resBody').textContent = body;
  $('resScore').textContent = 'Score : ' + Math.floor(score);
  $('bResGo').textContent = goLabel;
  $('result').classList.remove('hidden');
  $('bResGo').focus();
}
function hideResult() { $('result').classList.add('hidden'); }
function onResultGo() { const cb = resultCb; resultCb = null; hideResult(); if (cb) cb(); }

function resetRun() {
  score = 0; lives = 3; level = 1; ibmGot = false;
  setIbmVisible(false);
  if (currentMini) { currentMini.destroy(); currentMini = null; }
  jumpState = null;
  sequenceActive = false;
  refreshHud();
}

function flash(bad) {
  const f = $('flash');
  f.classList.toggle('bad', !!bad);
  f.classList.add('on');
  setTimeout(() => f.classList.remove('on'), 160);
}

/* ---------------- drive / animate ---------------- */
const drive = { x: 0, z: 0, speed: 10 };

function updateDrive(dt) {
  drive.speed = 9 + input.y * 6;
  drive.x += input.x * drive.speed * dt * 0.45;
  drive.x = Math.max(-2.2, Math.min(2.2, drive.x));
  drive.z -= drive.speed * dt;
  if (env.roadTex) env.roadTex.offset.y -= drive.speed * dt * 0.04;
  if (car.root) {
    car.root.position.set(drive.x, 0, 0);
    car.root.rotation.y = Math.PI; // face camera? let's face -Z travel, camera behind
    car.root.rotation.y = 0;
    car.root.rotation.z = -input.x * 0.08;
  }
  for (const w of car.wheels) w.rotation.x -= drive.speed * dt * 1.6;
  // Elevated front 3/4, looking down into the open cabin at the unit plates.
  camera.position.set(drive.x + 2.7, 3.35, 2.85);
  camera.lookAt(drive.x, 0.5, -0.7);
}

function updateMenu(dt) {
  if (!prefersReduce) orbit.az += dt * 0.12;
  if (car.root) car.root.rotation.y = 0.35;
  const land = window.innerWidth > window.innerHeight && window.innerHeight <= 500;
  orbit.target.set(land ? 1.25 : 0, 0.4, 0);
  if (land && orbit.dist > 6) orbit.dist = 5.6;
  applyOrbit();
}

function updateExplode(dt) {
  applyOrbit();
}

function updateMini(dt) {
  applyOrbit();
  if (currentMini) currentMini.update(dt);
  // pulse cores
  const t = clock.elapsedTime;
  c204.nodes.forEach((n, name) => {
    if (/singularity_.*_core/.test(name) && n.isMesh && n.material) {
      const m = n.material;
      if (m.emissiveIntensity != null) m.emissiveIntensity = 0.6 + Math.sin(t * 6) * 0.4;
    }
    if (/singularity_.*_rotor/.test(name)) {
      n.rotation.y += dt * (name.includes('steering') ? -2.4 : 2.4);
    }
  });
}

function loop() {
  const t0 = performance.now();
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  pollKeysAndPad();
  if (c204.mixer) c204.mixer.update(dt * (animScale || 1));
  if (car.mixer) car.mixer.update(dt * (animScale || 1));

  if (mode === 'menu' || mode === 'briefing') updateMenu(dt);
  else if (mode === 'drive') updateDrive(dt);
  else if (mode === 'minigame') updateMini(dt);
  else if (mode === 'jump') updateJump(dt);
  else if (mode === 'explode') updateExplode(dt);
  else applyOrbit();

  renderer.render(scene, camera);
  lastCalls = renderer.info.render.calls;
  lastTris = renderer.info.render.triangles;
  jsMs = performance.now() - t0;
  fpsFrames++;
  fpsT += dt;
  if (fpsT >= 0.5) {
    fpsSmooth = fpsFrames / fpsT;
    fpsFrames = 0; fpsT = 0;
    if (showFps) drawFps();
  }
}

function drawFps() {
  const el = $('fps');
  el.classList.remove('hidden');
  el.textContent = [
    'fps  ' + fpsSmooth.toFixed(1),
    'calls ' + lastCalls,
    'tris  ' + lastTris,
    'js    ' + jsMs.toFixed(1) + ' ms',
    'tier  ' + gpu.tier + ' (' + gpu.type + ')',
    'gpu   ' + (gpu.gpu || '?'),
    'pr    ' + renderer.getPixelRatio().toFixed(2),
    'mode  ' + mode,
  ].join('\n');
}

function installHook() {
  window.__game = {
    get ready() { return mode !== 'loading'; },
    version: VERSION,
    get mode() { return mode; },
    get score() { return score; },
    get lives() { return lives; },
    get level() { return level; },
    get ibmGot() { return ibmGot; },
    get gpu() { return { ...gpu }; },
    get render() {
      const i = renderer.info;
      return {
        calls: lastCalls,
        triangles: lastTris,
        fps: +fpsSmooth.toFixed(1),
        js: +jsMs.toFixed(2),
        geometries: i.memory.geometries,
        textures: i.memory.textures,
        heapMB: (performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : 0),
      };
    },
    get renderer() { return renderer; },
    get scene() { return scene; },
    get camera() { return camera; },
    hasTransmission: false,
    source: 'glb',
    get car() { return car.root; },
    get unit() { return c204.root; },
    get ibm() { return ibm.root; },
    get ibmVisible() { return !!(ibm.root && ibm.root.visible); },
    get ibmNodes() { return [...ibm.nodes.keys()]; },
    setIbmVisible,
    get nodes() { return [...c204.nodes.keys()]; },
    get clips() { return { c204: Object.keys(c204.clips), car: Object.keys(car.clips) }; },
    get cardIds() { return Object.keys(CARDS); },
    get miniIndex() { return miniIndex; },
    FRAME: { w: 412, h: 915 },
    sizes() { return { w: renderer.domElement.width, h: renderer.domElement.height }; },
    set animMs(v) { animScale = v ? 80 / Math.max(1, v) : 1; if (animScale < 1) animScale = 1; },
    startMission(opts = {}) {
      resetRun();
      if (opts.skipBrief || opts.skipDrive) { startDrive(); if (opts.skipDrive) startSequence(); }
      else openBriefing();
    },
    startDrive, startSequence,
    startMinigame: (i) => startMinigame(i ?? 0),
    completeMinigame() { if (currentMini) currentMini.succeed(); },
    completeJump() {
      if (!jumpState) startJump();
      if (jumpState) { jumpState.t = jumpState.dur; jumpState.stab = Math.max(jumpState.stab, 0.8); }
    },
    failCurrent() {
      if (currentMini && !currentMini.done) { currentMini.done = true; onMinigameDone(false); }
      else if (jumpState && !jumpState.done) { jumpState.stab = 0; }
    },
    openExploded, openCard: (n) => openCard(n), closeCard: () => closePanel('sheet'),
    openSources, openLinks, openMenu: goMenu,
    setOrbit(o) {
      if (o.az != null) orbit.az = o.az;
      if (o.pol != null) orbit.pol = o.pol;
      if (o.dist != null) orbit.dist = o.dist;
      if (o.target) orbit.target.set(o.target[0], o.target[1], o.target[2]);
      if (o.minD != null) orbit.minD = o.minD;
      if (o.maxD != null) orbit.maxD = o.maxD;
    },
    hideUI(on) {
      const ids = ['top','fps','bar','driveHint','touch','menu','briefing','mini','jumpHud','sheet','loading','result','sources','links','flash'];
      for (const id of ids) { const el = document.getElementById(id); if (el) el.classList.toggle('hidden', !!on); }
    },
    setMode(m) {
      const map = { view: 'drive', assemble: 'minigame', explode: 'explode', drive: 'drive', jump: 'jump', minigame: 'minigame', menu: 'menu' };
      const n = map[m] || m;
      if (n === 'minigame') startMinigame(0);
      else if (n === 'jump') startJump();
      else if (n === 'drive') startDrive();
      else if (n === 'explode') openExploded();
      else if (n === 'menu') goMenu();
      else setMode(n);
    },
    goMenu, resetRun,
    playAll() {
      // test helper: run whole first jump via hooks, called step by step from tests
      resetRun();
      startDrive();
      startSequence();
    },
  };
}

async function boot() {
  installHook();
  window.__c204 = window.__game;
  fillSources();
  fillLinks();
  fillBriefing();
  bindInput();
  setLoad(0.02, 'Détection du GPU…');
  await detectGpu();
  makeRenderer();
  makeScene();
  onResize();
  window.addEventListener('resize', onResize);
  window.visualViewport?.addEventListener('resize', onResize);
  try {
    await loadModels();
  } catch (err) {
    console.error(err);
    setLoad(1, 'Erreur de chargement : ' + (err.message || err));
    return;
  }
  setLoad(1, 'Prêt.');
  $('loading').classList.add('hidden');
  setMode('menu');
  clock.start();
  loop();
  if (!isTest && 'serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js?v=' + VERSION, { updateViaCache: 'none' });
    } catch (e) { console.warn('SW:', e); }
  }
}

boot().catch((e) => {
  console.error(e);
  setLoad(1, 'Erreur : ' + (e && e.message ? e.message : e));
});
