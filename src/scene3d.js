import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const NORD = {
  bg:    0x2E3440,
  surf1: 0x5E81AC,
  surf2: 0xBF616A,
  path:  0xEBCB8B,
  point: 0xA3BE8C,
};

export const PRESETS_3D = {
  circles: {
    label: 'Circles — x²+y²=4, xy=1',
    F:   ([x, y]) => [x * x + y * y - 4, x * y - 1],
    J:   ([x, y]) => [[2 * x, 2 * y], [y, x]],
    p0:  [1.5, 0.5],
    domain: 2.8,
  },
  nonlinear: {
    label: 'Nonlinear — x²−y=1, x+y²=1',
    F:   ([x, y]) => [x * x - y - 1, x + y * y - 1],
    J:   ([x, y]) => [[2 * x, -1], [1, 2 * y]],
    p0:  [0.8, 0.3],
    domain: 2.0,
  },
  mixed: {
    label: 'Mixed — sin(x)+y=0.5, x−cos(y)=0',
    F:   ([x, y]) => [Math.sin(x) + y - 0.5, x - Math.cos(y)],
    J:   ([x, y]) => [[Math.cos(x), 1], [1, Math.sin(y)]],
    p0:  [0.5, 0.2],
    domain: 2.5,
  },
};

let renderer3 = null;
let scene3    = null;
let camera3   = null;
let controls3 = null;
let rafId3    = null;
let pathObjs  = [];
let surf1Obj  = null;
let surf2Obj  = null;

export let history3d = [];
export let preset3d  = PRESETS_3D.circles;
export let p0_3d     = [1.5, 0.5];

// ── Public API ────────────────────────────────────────────────────────────────

export function init3D(canvasEl) {
  if (renderer3) { _resize(canvasEl); return; }

  renderer3 = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  renderer3.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  scene3 = new THREE.Scene();
  scene3.background = new THREE.Color(NORD.bg);
  scene3.fog = new THREE.FogExp2(NORD.bg, 0.05);

  camera3 = new THREE.PerspectiveCamera(50, 1, 0.01, 50);
  camera3.position.set(6, 5, 6);
  camera3.lookAt(0, 0, 0);

  controls3 = new OrbitControls(camera3, canvasEl);
  controls3.enableDamping = true;
  controls3.dampingFactor = 0.06;
  controls3.minDistance = 2;
  controls3.maxDistance = 18;

  scene3.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(6, 10, 4);
  scene3.add(sun);

  scene3.add(new THREE.GridHelper(8, 32, 0x4C566A, 0x3B4252));
  scene3.add(new THREE.AxesHelper(3.5));

  _buildSurfaces();
  _rebuildPath();
  _resize(canvasEl);

  (function loop() {
    rafId3 = requestAnimationFrame(loop);
    controls3.update();
    renderer3.render(scene3, camera3);
  })();
}

export function loadPreset3D(key, x0, y0) {
  preset3d = PRESETS_3D[key];
  p0_3d = [x0, y0];
  history3d = [];
  _buildSurfaces();
  _rebuildPath();
}

export function setP0_3D(x0, y0) {
  p0_3d = [x0, y0];
  if (history3d.length === 0) _rebuildPath();
}

/**
 * @returns {{ ok: boolean, data?: object, err?: string }}
 */
export function step3D() {
  const [x, y] = _current3D();
  const F = preset3d.F([x, y]);
  const J = preset3d.J([x, y]);
  const [[a, b], [c, d]] = J;
  const det = a * d - b * c;

  if (Math.abs(det) < 1e-10) return { ok: false, err: 'singular' };

  // Newton step: Δx = -J⁻¹ F  (Cramer's rule for 2×2)
  const dx = -(d * F[0] - b * F[1]) / det;
  const dy = -(-c * F[0] + a * F[1]) / det;
  const x1 = x + dx;
  const y1 = y + dy;

  if (!isFinite(x1) || !isFinite(y1) || Math.abs(x1) > 50 || Math.abs(y1) > 50) {
    return { ok: false, err: 'diverge' };
  }

  const F1 = preset3d.F([x1, y1]);
  history3d.push({ x: x1, y: y1, F: F1, J, det });
  _rebuildPath();
  return { ok: true, data: { x: x1, y: y1, F: F1, J, det, n: history3d.length } };
}

export function undo3D() {
  if (history3d.length === 0) return null;
  history3d.pop();
  _rebuildPath();
  if (history3d.length === 0) return null;
  const h = history3d[history3d.length - 1];
  return { x: h.x, y: h.y, F: h.F, J: h.J, det: h.det, n: history3d.length };
}

export function reset3D(key, x0, y0) {
  if (key) preset3d = PRESETS_3D[key];
  p0_3d = [x0, y0];
  history3d = [];
  _buildSurfaces();
  _rebuildPath();
}

export function resize3D(canvasEl) {
  if (!renderer3) return;
  _resize(canvasEl);
}

export function getCamDist() {
  if (!camera3 || !controls3) return 10;
  return camera3.position.distanceTo(controls3.target);
}

export function setCamDist(dist) {
  if (!camera3 || !controls3) return;
  const tgt = controls3.target;
  const dir = camera3.position.clone().sub(tgt).normalize();
  camera3.position.copy(tgt.clone().addScaledVector(dir, dist));
  controls3.update();
}

export function onControlsChange(cb) {
  controls3?.addEventListener('change', cb);
}

// ── Internal ──────────────────────────────────────────────────────────────────

function _current3D() {
  if (history3d.length === 0) return p0_3d;
  const h = history3d[history3d.length - 1];
  return [h.x, h.y];
}

function _buildSurfaces() {
  [surf1Obj, surf2Obj].forEach(m => {
    if (!m) return;
    scene3.remove(m);
    m.geometry.dispose();
    m.material.dispose();
  });
  surf1Obj = _makeSurface(([x, y]) => preset3d.F([x, y])[0], preset3d.domain, NORD.surf1, 0.52);
  surf2Obj = _makeSurface(([x, y]) => preset3d.F([x, y])[1], preset3d.domain, NORD.surf2, 0.52);
  scene3.add(surf1Obj);
  scene3.add(surf2Obj);
}

function _makeSurface(fn, domain, color, opacity) {
  const N = 50;
  const verts = [];
  const idxs  = [];
  const cap   = domain * 1.6;

  for (let i = 0; i <= N; i++) {
    const mx = -domain + (2 * domain * i) / N;
    for (let j = 0; j <= N; j++) {
      const my = -domain + (2 * domain * j) / N;
      const mz = fn([mx, my]);
      // Three.js Y-up: world(x,y) → scene(x, f(x,y), y)
      verts.push(mx, Math.max(-cap, Math.min(cap, mz)), my);
    }
  }

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const a  = i * (N + 1) + j;
      const b  = a + 1;
      const c  = a + (N + 1);
      const dd = c + 1;
      idxs.push(a, c, b, b, c, dd);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geom.setIndex(idxs);
  geom.computeVertexNormals();

  return new THREE.Mesh(geom, new THREE.MeshLambertMaterial({
    color, transparent: true, opacity,
    side: THREE.DoubleSide, depthWrite: false,
  }));
}

function _rebuildPath() {
  for (const obj of pathObjs) {
    scene3.remove(obj);
    obj.geometry?.dispose();
    obj.material?.dispose();
  }
  pathObjs = [];

  const pts = [new THREE.Vector3(p0_3d[0], 0, p0_3d[1])];
  for (const h of history3d) pts.push(new THREE.Vector3(h.x, 0, h.y));

  if (pts.length >= 2) {
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: NORD.path }));
    scene3.add(line);
    pathObjs.push(line);
  }

  for (let i = 0; i < pts.length; i++) {
    const isCur = i === pts.length - 1;
    const sph = new THREE.Mesh(
      new THREE.SphereGeometry(isCur ? 0.10 : 0.05, 16, 16),
      new THREE.MeshLambertMaterial({ color: isCur ? NORD.point : NORD.path }),
    );
    sph.position.copy(pts[i]);
    scene3.add(sph);
    pathObjs.push(sph);
  }
}

function _resize(canvasEl) {
  const el = canvasEl ?? renderer3.domElement;
  const w  = el.clientWidth  || 1;
  const h  = el.clientHeight || 1;
  renderer3.setSize(w, h, false);
  camera3.aspect = w / h;
  camera3.updateProjectionMatrix();
}
