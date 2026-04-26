// Newton Method Visualizer — main.js
import {
  init3D, step3D, undo3D, reset3D, loadPreset3D,
  setP0_3D, resize3D, PRESETS_3D,
  getCamDist, setCamDist, onControlsChange,
} from './scene3d.js';

/** @type {HTMLCanvasElement} */
const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');

// ── DOM refs ──────────────────────────────────────────────────────────────────
const fnSelect       = document.getElementById('fn-select');
const x0Slider       = document.getElementById('x0-slider');
const x0Display      = document.getElementById('x0-display');
const btnNext        = document.getElementById('btn-next');
const btnAuto        = document.getElementById('btn-auto');
const btnUndo        = document.getElementById('btn-undo');
const btnReset       = document.getElementById('btn-reset');
const residualBar    = document.getElementById('residual-bar');
const residualValue  = document.getElementById('residual-value');
const iterTbody      = document.getElementById('iter-tbody');
const statusLine     = document.getElementById('status-line');
const divergeBanner  = document.getElementById('diverge-banner');
const openMathBtn    = document.getElementById('open-math');
const closeMathBtn   = document.getElementById('close-math');
const langToggle     = document.getElementById('language-toggle');
const mathModal      = document.getElementById('math-modal');
const mathContent    = document.getElementById('math-content');
const zoomSlider     = document.getElementById('zoom-slider');
const zoomLabel      = document.getElementById('zoom-label');
const btnZoomIn      = document.getElementById('btn-zoom-in');
const btnZoomOut     = document.getElementById('btn-zoom-out');

// ── 3D DOM refs ───────────────────────────────────────────────────────────────
const btnMode        = document.getElementById('btn-mode');
const canvas3d       = document.getElementById('canvas-3d');
const zoomHud        = document.getElementById('zoom-hud');
const panel2dContent = document.getElementById('panel-2d-content');
const panel3dContent = document.getElementById('panel-3d-content');
const fnSelect3d     = document.getElementById('fn-select-3d');
const x03dSlider     = document.getElementById('x0-3d-slider');
const y03dSlider     = document.getElementById('y0-3d-slider');
const x03dDisplay    = document.getElementById('x0-3d-display');
const y03dDisplay    = document.getElementById('y0-3d-display');
const btnNext3d      = document.getElementById('btn-next-3d');
const btnAuto3d      = document.getElementById('btn-auto-3d');
const btnUndo3d      = document.getElementById('btn-undo-3d');
const btnReset3d     = document.getElementById('btn-reset-3d');
const j00El          = document.getElementById('j00');
const j01El          = document.getElementById('j01');
const j10El          = document.getElementById('j10');
const j11El          = document.getElementById('j11');
const jacobianDet    = document.getElementById('jacobian-det');
const residualBar3d  = document.getElementById('residual-bar-3d');
const residualVal3d  = document.getElementById('residual-value-3d');
const iterTbody3d    = document.getElementById('iter-tbody-3d');

// ── Nord palette ──────────────────────────────────────────────────────────────
const C = {
  bg:      '#2E3440',
  panel:   '#3B4252',
  border:  '#4C566A',
  axis:    '#4C566A',
  curve:   '#5E81AC',
  tangent: '#88C0D0',
  proj:    '#81A1C1',
  dot:     '#EBCB8B',
  dotFill: '#D08770',
  text:    '#D8DEE9',
  dim:     '#4C566A',
  warn:    '#BF616A',
  ok:      '#A3BE8C',
  quad:    '#EBCB8B',
};

// ── Function presets ───────────────────────────────────────────────────────────
const PRESETS = {
  sqrt2: {
    label: 'f(x) = x² − 2',
    f:  (x) => x * x - 2,
    df: (x) => 2 * x,
    x0: 2,
    view: { cx: 1.5, cy: 0, scale: 80 },
  },
  cubic: {
    label: 'f(x) = x³ − x − 2',
    f:  (x) => x ** 3 - x - 2,
    df: (x) => 3 * x ** 2 - 1,
    x0: 1.5,
    view: { cx: 1.5, cy: 0, scale: 70 },
  },
  trig: {
    label: 'f(x) = cos(x) − x',
    f:  (x) => Math.cos(x) - x,
    df: (x) => -Math.sin(x) - 1,
    x0: 0.5,
    view: { cx: 0.7, cy: 0, scale: 100 },
  },
  oscillate: {
    label: 'f(x) = sin(10x) · x',
    f:  (x) => Math.sin(10 * x) * x,
    df: (x) => Math.sin(10 * x) + 10 * x * Math.cos(10 * x),
    x0: 0.8,
    view: { cx: 0, cy: 0, scale: 120 },
  },
  flat: {
    label: 'f(x) = x³ − 3x + 2',
    f:  (x) => x ** 3 - 3 * x + 2,
    df: (x) => 3 * x ** 2 - 3,
    x0: 0.5,
    view: { cx: 0, cy: 0, scale: 80 },
  },
};

// ── State ─────────────────────────────────────────────────────────────────────
let appMode = '2d'; // '2d' | '3d'
let autoTimer3d = null;

/** @type {{cx:number,cy:number,scale:number}} */
let view = { cx: 1.5, cy: 0, scale: 80 };

let preset     = PRESETS.sqrt2;
let history    = [];   // [{x, fx, dx}]
let animPhase  = 0;    // 0=idle 1=drawing-tangent 2=drawing-proj
let autoTimer  = null;
let modalLang  = 'en';
let showTangent = false;
let showProj    = false;

// ── Coordinate helpers ─────────────────────────────────────────────────────────
/** World → canvas pixel */
function wx(x) { return canvas.width  / 2 + (x - view.cx) * view.scale; }
function wy(y) { return canvas.height / 2 - (y - view.cy) * view.scale; }
/** Canvas pixel → world */
function pw(px) { return (px - canvas.width  / 2) / view.scale + view.cx; }

// ── Resize ────────────────────────────────────────────────────────────────────
function resize() {
  const container = canvas.parentElement;
  canvas.width  = container.clientWidth;
  canvas.height = container.clientHeight;
  if (appMode === '2d') draw();
  else resize3D(canvas3d);
}
window.addEventListener('resize', resize);

// ── Drawing ───────────────────────────────────────────────────────────────────
function draw() {
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  drawGrid();
  drawAxes();
  drawCurve();

  const cur = history[history.length - 1];
  const prev = history[history.length - 2];

  if (cur) {
    if (showTangent || showProj) drawTangent(cur);
    if (showProj && history.length >= 2 && prev) drawProjection(prev, cur);
    drawIterPoints();
    drawCurrentDot(cur.x);
  } else {
    // initial state — show x0
    const x0 = parseFloat(x0Slider.value);
    drawCurrentDot(x0);
  }
}

function drawGrid() {
  const step = niceStep(80 / view.scale);
  const xMin = pw(0);
  const xMax = pw(canvas.width);

  ctx.strokeStyle = C.border;
  ctx.lineWidth   = 0.5;
  ctx.setLineDash([]);

  for (let x = Math.ceil(xMin / step) * step; x <= xMax; x += step) {
    const px = wx(x);
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, canvas.height);
    ctx.globalAlpha = 0.25;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function niceStep(approx) {
  const mag = Math.pow(10, Math.floor(Math.log10(approx)));
  const norm = approx / mag;
  if (norm < 1.5) return mag;
  if (norm < 3.5) return 2 * mag;
  if (norm < 7.5) return 5 * mag;
  return 10 * mag;
}

function drawAxes() {
  const W = canvas.width;
  const H = canvas.height;
  const ox = wx(0);
  const oy = wy(0);

  ctx.strokeStyle = C.axis;
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([]);

  // x-axis
  ctx.beginPath();
  ctx.moveTo(0, oy);
  ctx.lineTo(W, oy);
  ctx.stroke();

  // y-axis
  ctx.beginPath();
  ctx.moveTo(ox, 0);
  ctx.lineTo(ox, H);
  ctx.stroke();

  // tick labels
  ctx.fillStyle  = C.text;
  ctx.font       = '11px monospace';
  ctx.textAlign  = 'center';
  const step = niceStep(80 / view.scale);
  const xMin = pw(0);
  const xMax = pw(W);
  for (let x = Math.ceil(xMin / step) * step; x <= xMax; x += step) {
    if (Math.abs(x) < step * 0.01) continue;
    const px = wx(x);
    ctx.fillText(fmt(x), px, Math.min(Math.max(oy + 16, 16), H - 6));
  }
}

function fmt(v) {
  if (Math.abs(v) >= 100) return v.toFixed(0);
  if (Math.abs(v) >= 10)  return v.toFixed(1);
  return v.toFixed(2);
}

function drawCurve() {
  const W = canvas.width;
  const steps = Math.ceil(W / 2);

  ctx.beginPath();
  ctx.strokeStyle = C.curve;
  ctx.lineWidth   = 2;
  ctx.setLineDash([]);

  let started = false;
  for (let i = 0; i <= steps; i++) {
    const x = pw(i * (W / steps));
    const y = preset.f(x);
    const py = wy(y);

    if (Math.abs(py) > canvas.height * 4) { started = false; continue; }

    if (!started) { ctx.moveTo(wx(x), py); started = true; }
    else ctx.lineTo(wx(x), py);
  }
  ctx.stroke();
}

function drawTangent(point) {
  const { x } = point;
  const dfx = preset.df(x);

  // guard: near-zero derivative
  if (Math.abs(dfx) < 1e-10) {
    setStatus('⚠ Zero derivative — tangent is horizontal, cannot continue.', 'warn');
    return;
  }

  // x-intercept of tangent: x1 = x - f(x)/f'(x)
  const fx  = preset.f(x);
  const x1  = x - fx / dfx;

  // draw tangent line across visible canvas
  const xMin = pw(0);
  const xMax = pw(canvas.width);

  const margin = (xMax - xMin) * 2;
  const lx0 = xMin - margin;
  const lx1 = xMax + margin;
  const ly0 = fx + dfx * (lx0 - x);
  const ly1 = fx + dfx * (lx1 - x);

  ctx.save();
  ctx.strokeStyle = C.tangent;
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(wx(lx0), wy(ly0));
  ctx.lineTo(wx(lx1), wy(ly1));
  ctx.stroke();
  ctx.restore();

  // mark x1 on x-axis
  ctx.save();
  ctx.fillStyle = C.tangent;
  ctx.beginPath();
  ctx.arc(wx(x1), wy(0), 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawProjection(prev, cur) {
  // vertical line from (cur.x, 0) up to (cur.x, f(cur.x))
  const x = cur.x;
  const fy = preset.f(x);

  ctx.save();
  ctx.strokeStyle = C.proj;
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.moveTo(wx(x), wy(0));
  ctx.lineTo(wx(x), wy(fy));
  ctx.stroke();
  ctx.restore();

  // dot on curve at new point
  ctx.save();
  ctx.fillStyle = C.proj;
  ctx.beginPath();
  ctx.arc(wx(x), wy(fy), 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawIterPoints() {
  // draw small dots for previous iteration points on the curve
  history.forEach((pt, i) => {
    if (i === history.length - 1) return;
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.15 * (i / history.length);
    ctx.fillStyle = C.dot;
    ctx.beginPath();
    ctx.arc(wx(pt.x), wy(preset.f(pt.x)), 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawCurrentDot(x) {
  const fx = preset.f(x);
  const px = wx(x);
  const py = wy(fx);

  // crosshair glow
  ctx.save();
  ctx.strokeStyle = C.dotFill;
  ctx.lineWidth   = 1;
  ctx.globalAlpha = 0.45;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(px - 12, py);
  ctx.lineTo(px + 12, py);
  ctx.moveTo(px, py - 12);
  ctx.lineTo(px, py + 12);
  ctx.stroke();
  ctx.restore();

  // main dot
  ctx.save();
  ctx.fillStyle   = C.dot;
  ctx.strokeStyle = C.dotFill;
  ctx.lineWidth   = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(px, py, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ── Newton iteration ───────────────────────────────────────────────────────────
function currentX() {
  if (history.length === 0) return parseFloat(x0Slider.value);
  return history[history.length - 1].x;
}

function stepNewton() {
  const x   = currentX();
  const fx  = preset.f(x);
  const dfx = preset.df(x);

  if (Math.abs(dfx) < 1e-10) {
    setStatus('⚠ f\'(x) ≈ 0 — zero derivative, cannot step.', 'warn');
    stopAuto();
    return false;
  }

  const dx = -fx / dfx;
  const x1 = x + dx;

  const isOutOfBounds = Math.abs(x1) > 1e6;
  if (isOutOfBounds) {
    divergeBanner.classList.add('visible');
    setStatus('⚠ Divergence detected.', 'warn');
    stopAuto();
    return false;
  }

  divergeBanner.classList.remove('visible');

  const prevDx = history.length >= 2
    ? history[history.length - 1].x - history[history.length - 2].x
    : null;

  history.push({ x: x1, fx: preset.f(x1), dx });

  updateResidual(Math.abs(preset.f(x1)));
  appendTableRow(history.length - 1, x1, preset.f(x1), dx, prevDx);
  updateStatus(x1, preset.f(x1));

  // smooth pan/zoom toward new point
  panTo(x1, preset.f(x1));

  return true;
}

// ── Two-phase animation ────────────────────────────────────────────────────────
function triggerNextStep() {
  if (animPhase !== 0) return;

  animPhase   = 1;
  showTangent = true;
  showProj    = false;
  draw();

  setTimeout(() => {
    // phase 2: do the actual Newton step, then draw projection
    const ok = stepNewton();
    if (ok) {
      showTangent = true;
      showProj    = true;
      draw();

      setTimeout(() => {
        showTangent = false;
        showProj    = false;
        animPhase   = 0;
        draw();
      }, 600);
    } else {
      showTangent = false;
      showProj    = false;
      animPhase   = 0;
      draw();
    }
  }, 500);
}

// ── Auto-play ─────────────────────────────────────────────────────────────────
function startAuto() {
  if (autoTimer) return;
  btnAuto.textContent = '⏸ Pause';
  autoTimer = setInterval(() => {
    if (animPhase !== 0) return;
    triggerNextStep();
  }, 1100);
}

function stopAuto() {
  if (!autoTimer) return;
  clearInterval(autoTimer);
  autoTimer = null;
  btnAuto.textContent = '▶ Auto';
}

// ── UI helpers ─────────────────────────────────────────────────────────────────
function setStatus(msg, cls = '') {
  statusLine.textContent = msg;
  statusLine.className   = cls;
}

function updateStatus(x, fx) {
  if (Math.abs(fx) < 1e-6) {
    setStatus(`Converged ✓  x ≈ ${x.toPrecision(8)}`, 'ok');
    stopAuto();
  } else {
    setStatus(`x${history.length} = ${x.toPrecision(6)}   |f(x)| = ${Math.abs(fx).toExponential(3)}`);
  }
}

function updateResidual(absFx) {
  const MAX_LOG = 3;
  const logVal  = Math.log10(Math.max(absFx, 1e-12));
  const pct     = Math.max(0, Math.min(1, (-logVal) / (MAX_LOG + 12)));
  residualBar.style.width = `${pct * 100}%`;
  residualValue.textContent = `|f(xₙ)| = ${absFx.toExponential(4)}`;
  residualBar.classList.toggle('converged', absFx < 1e-6);
}

/**
 * @param {number} n
 * @param {number} x
 * @param {number} fx
 * @param {number} dx
 * @param {number|null} prevDx
 */
function appendTableRow(n, x, fx, dx, prevDx) {
  const row = document.createElement('tr');
  // detect quadratic convergence: |dx| < 0.1 * prevDx²
  const isQuad = prevDx !== null && Math.abs(dx) < 0.5 * prevDx ** 2 && Math.abs(prevDx) > 1e-8;
  if (isQuad) row.className = 'quadratic';

  row.innerHTML = `
    <td>${n}</td>
    <td>${x.toPrecision(7)}</td>
    <td>${fx.toExponential(3)}</td>
    <td>${dx.toExponential(3)}</td>
  `;
  iterTbody.prepend(row);
}

function resetAll() {
  history     = [];
  showTangent = false;
  showProj    = false;
  animPhase   = 0;
  stopAuto();
  iterTbody.innerHTML = '';
  residualBar.style.width = '0%';
  residualValue.textContent = '—';
  divergeBanner.classList.remove('visible');
  setStatus('Ready');
  view = { ...preset.view };
  syncZoomHud();
  draw();
}

function loadPreset(key) {
  preset = PRESETS[key];
  x0Slider.value = preset.x0;
  x0Display.textContent = preset.x0.toFixed(2);
  resetAll();
}

// ── Smooth pan toward convergence point ────────────────────────────────────────
function panTo(x, y) {
  const targetCx = x * 0.6 + view.cx * 0.4;
  const targetCy = y * 0.3 + view.cy * 0.7;

  const absFx = Math.abs(preset.f(x));
  // zoom in slightly when residual is small
  const targetScale = absFx < 0.1
    ? Math.min(view.scale * 1.08, 800)
    : view.scale;

  view.cx    = targetCx;
  view.cy    = targetCy;
  view.scale = targetScale;
  syncZoomHud();
}

// ── Drag & Pan ─────────────────────────────────────────────────────────────────
// dragMode: 'x0' = dragging initial point, 'pan' = panning the view, null = idle
let dragMode  = null;
let dragStart = { px: 0, py: 0, cx: 0, cy: 0 };

/** Returns true if the canvas-pixel (ex, ey) is within 18px of the current dot. */
function hitTestDot(ex, ey) {
  if (history.length > 0) return false;
  const x0  = parseFloat(x0Slider.value);
  const dpx = ex - wx(x0);
  const dpy = ey - wy(preset.f(x0));
  return Math.hypot(dpx, dpy) < 18;
}

canvas.style.cursor = 'grab';

canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  const rect = canvas.getBoundingClientRect();
  const ex   = e.clientX - rect.left;
  const ey   = e.clientY - rect.top;

  if (hitTestDot(ex, ey)) {
    dragMode = 'x0';
    canvas.style.cursor = 'ew-resize';
  } else {
    dragMode  = 'pan';
    dragStart = { px: e.clientX, py: e.clientY, cx: view.cx, cy: view.cy };
    canvas.style.cursor = 'grabbing';
  }
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const ex   = e.clientX - rect.left;
  const ey   = e.clientY - rect.top;

  if (!dragMode) {
    canvas.style.cursor = hitTestDot(ex, ey) ? 'ew-resize' : 'grab';
    return;
  }

  if (dragMode === 'x0') {
    const x       = pw(ex);
    const clamped = Math.min(5, Math.max(-5, x));
    x0Slider.value            = clamped;
    x0Display.textContent     = clamped.toFixed(2);

    // live tangent preview without mutating real history
    showTangent = true;
    history = [{ x: clamped, fx: preset.f(clamped), dx: 0 }];
    draw();
    history     = [];
    showTangent = false;
  }

  if (dragMode === 'pan') {
    const ddx = (e.clientX - dragStart.px) / view.scale;
    const ddy = (e.clientY - dragStart.py) / view.scale;
    view.cx   = dragStart.cx - ddx;
    view.cy   = dragStart.cy + ddy;
    draw();
  }
});

canvas.addEventListener('mouseup',    () => { dragMode = null; canvas.style.cursor = 'grab'; });
canvas.addEventListener('mouseleave', () => { dragMode = null; canvas.style.cursor = 'grab'; });

// Pinch / scroll to zoom, anchored at the mouse cursor position
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect   = canvas.getBoundingClientRect();
  const ex     = e.clientX - rect.left;
  const ey     = e.clientY - rect.top;
  // world coordinates under cursor before zoom
  const mx     = pw(ex);
  const my     = (canvas.height / 2 - ey) / view.scale + view.cy;
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  view.scale   = Math.min(Math.max(view.scale * factor, 10), 4000);
  // shift origin so the point under cursor stays fixed
  view.cx      = mx - (ex - canvas.width  / 2) / view.scale;
  view.cy      = my - (canvas.height / 2 - ey) / view.scale;
  syncZoomHud();
  draw();
}, { passive: false });

// ── Zoom HUD ──────────────────────────────────────────────────────────────────
// ── Zoom HUD — 2D ─────────────────────────────────────────────────────────────
const SCALE_MIN = 10;
const SCALE_MAX = 4000;

function scaleToSlider(s) {
  return Math.round(1 + 99 * Math.log(s / SCALE_MIN) / Math.log(SCALE_MAX / SCALE_MIN));
}

function sliderToScale(v) {
  return SCALE_MIN * Math.pow(SCALE_MAX / SCALE_MIN, (v - 1) / 99);
}

function syncZoomHud() {
  zoomSlider.value = scaleToSlider(view.scale);
  zoomLabel.textContent = `${(view.scale / 80).toFixed(1)}×`;
}

// ── Zoom HUD — 3D ─────────────────────────────────────────────────────────────
const DIST_MIN     = 2;
const DIST_MAX     = 18;
const DIST_DEFAULT = Math.sqrt(6 * 6 + 5 * 5 + 6 * 6); // initial camera position length ≈ 9.85

function distToSlider(d) {
  return Math.round(1 + 99 * Math.log(d / DIST_MIN) / Math.log(DIST_MAX / DIST_MIN));
}

function sliderToDist(v) {
  return DIST_MIN * Math.pow(DIST_MAX / DIST_MIN, (v - 1) / 99);
}

function syncZoomHud3d() {
  const d = getCamDist();
  zoomSlider.value = distToSlider(Math.min(Math.max(d, DIST_MIN), DIST_MAX));
  zoomLabel.textContent = `${(DIST_DEFAULT / d).toFixed(1)}×`;
}

// ── Zoom HUD — unified event handlers ─────────────────────────────────────────
zoomSlider.addEventListener('input', () => {
  const v = parseInt(zoomSlider.value, 10);
  if (appMode === '2d') {
    const center = { x: view.cx, y: view.cy };
    view.scale = sliderToScale(v);
    view.cx = center.x;
    view.cy = center.y;
    zoomLabel.textContent = `${(view.scale / 80).toFixed(1)}×`;
    draw();
  } else {
    const d = sliderToDist(v);
    setCamDist(d);
    zoomLabel.textContent = `${(DIST_DEFAULT / d).toFixed(1)}×`;
  }
});

function zoomStep(factor) {
  if (appMode === '2d') {
    const cx = view.cx;
    const cy = view.cy;
    view.scale = Math.min(Math.max(view.scale * factor, SCALE_MIN), SCALE_MAX);
    view.cx = cx;
    view.cy = cy;
    syncZoomHud();
    draw();
  } else {
    const newDist = Math.min(Math.max(getCamDist() / factor, DIST_MIN), DIST_MAX);
    setCamDist(newDist);
    syncZoomHud3d();
  }
}

btnZoomIn.addEventListener('click',  () => zoomStep(1.25));
btnZoomOut.addEventListener('click', () => zoomStep(1 / 1.25));

// ── Event wiring ───────────────────────────────────────────────────────────────
fnSelect.addEventListener('change', (e) => loadPreset(e.target.value));

x0Slider.addEventListener('input', (e) => {
  x0Display.textContent = parseFloat(e.target.value).toFixed(2);
  if (history.length === 0) draw();
});

btnNext.addEventListener('click', triggerNextStep);

btnAuto.addEventListener('click', () => {
  if (autoTimer) stopAuto();
  else startAuto();
});

btnUndo.addEventListener('click', () => {
  if (history.length === 0) return;
  history.pop();
  iterTbody.querySelector('tr')?.remove();

  const cur = history[history.length - 1];
  if (cur) {
    updateResidual(Math.abs(cur.fx));
    updateStatus(cur.x, cur.fx);
  } else {
    residualBar.style.width = '0%';
    residualValue.textContent = '—';
    setStatus('Ready');
  }
  divergeBanner.classList.remove('visible');
  showTangent = false;
  showProj    = false;
  draw();
});

btnReset.addEventListener('click', resetAll);

// ── Math modal ─────────────────────────────────────────────────────────────────
const MODAL_COPY_2D = {
  en: `
    <p>Newton's method finds a root of $f(x) = 0$ by linearising the function at each iterate.</p>
    <p>Given $x_n$, draw the tangent to the curve at $(x_n,\\, f(x_n))$:</p>
    <p>$$y - f(x_n) = f'(x_n)(x - x_n)$$</p>
    <p>Set $y = 0$ and solve for the next iterate:</p>
    <p>$$x_{n+1} = x_n - \\frac{f(x_n)}{f'(x_n)}$$</p>
    <p>Under good conditions the error satisfies $|e_{n+1}| \\leq C|e_n|^2$, giving <strong>quadratic convergence</strong>. Rows highlighted in the table show steps where $|\\Delta x|$ roughly squares itself.</p>
    <p>Pathological cases include a near-zero derivative ($f'(x_n) \\approx 0$) where the tangent is almost horizontal, and oscillating functions where iteration cycles without converging.</p>
    <pre><code class="language-js">// Core update rule
const dx = -f(x) / df(x);
x = x + dx;</code></pre>
  `,
  zhTW: `
    <p>牛頓法透過在每個迭代點將函數<strong>線性化</strong>，來尋找 $f(x) = 0$ 的根。</p>
    <p>給定 $x_n$，在曲線上的點 $(x_n,\\, f(x_n))$ 畫切線：</p>
    <p>$$y - f(x_n) = f'(x_n)(x - x_n)$$</p>
    <p>令 $y = 0$，解出下一個迭代點：</p>
    <p>$$x_{n+1} = x_n - \\frac{f(x_n)}{f'(x_n)}$$</p>
    <p>在良好條件下，誤差滿足 $|e_{n+1}| \\leq C|e_n|^2$，即<strong>二階收斂</strong>。表格中高亮的行代表 $|\\Delta x|$ 近似自乘縮小的步驟，這就是牛頓法比梯度下降快的原因。</p>
    <p>常見失效情形：導數接近零（$f'(x_n) \\approx 0$）時切線接近水平；或函數震盪導致迭代在幾個點間來回循環而不收斂。</p>
    <pre><code class="language-js">// 核心更新規則
const dx = -f(x) / df(x);
x = x + dx;</code></pre>
  `,
};

const MODAL_COPY_3D = {
  en: `
    <p>In 3D mode we solve a <strong>nonlinear system</strong> $\mathbf{F}(\mathbf{x}) = \mathbf{0}$ where $\mathbf{x} = (x,y)^T$ and $\mathbf{F}: \mathbb{R}^2 \to \mathbb{R}^2$.</p>
    <p>The two coloured surfaces show $z = f_1(x,y)$ and $z = f_2(x,y)$. A solution lives where <em>both</em> surfaces simultaneously touch the $z=0$ plane.</p>
    <p>The Newton update replaces the scalar derivative with the <strong>Jacobian matrix</strong>:</p>
    <p>$$J(\mathbf{x}_n) = \begin{bmatrix} \partial f_1/\partial x & \partial f_1/\partial y \\ \partial f_2/\partial x & \partial f_2/\partial y \end{bmatrix}$$</p>
    <p>Each step solves the linear system $J(\mathbf{x}_n)\,\Delta\mathbf{x} = -\mathbf{F}(\mathbf{x}_n)$ and updates:</p>
    <p>$$\mathbf{x}_{n+1} = \mathbf{x}_n + \Delta\mathbf{x}$$</p>
    <p>For a $2\times2$ system the solution uses <strong>Cramer's rule</strong> with $\det J = ad - bc$:</p>
    <p>$$\Delta x = \frac{-(d\,f_1 - b\,f_2)}{\det J}, \quad \Delta y = \frac{-(-c\,f_1 + a\,f_2)}{\det J}$$</p>
    <p>Quadratic convergence still holds: $\|\mathbf{e}_{n+1}\| \leq C\|\mathbf{e}_n\|^2$ when $J$ is non-singular near the root.</p>
    <pre><code class="language-js">// 2×2 Newton step (Cramer's rule)
const [[a,b],[c,d]] = J([x,y]);
const det = a*d - b*c;
const dx  = -(d*F[0] - b*F[1]) / det;
const dy  = -(-c*F[0] + a*F[1]) / det;</code></pre>
  `,
  zhTW: `
    <p>3D 模式下，我們求解一個<strong>非線性方程組</strong> $\mathbf{F}(\mathbf{x}) = \mathbf{0}$，其中 $\mathbf{x} = (x,y)^T$，$\mathbf{F}: \mathbb{R}^2 \to \mathbb{R}^2$。</p>
    <p>兩個彩色曲面分別顯示 $z = f_1(x,y)$ 與 $z = f_2(x,y)$。解即為兩曲面<em>同時</em>與 $z=0$ 平面相交之點。</p>
    <p>牛頓法將純量導數推廣為<strong>Jacobian 矩陣</strong>：</p>
    <p>$$J(\mathbf{x}_n) = \begin{bmatrix} \partial f_1/\partial x & \partial f_1/\partial y \\ \partial f_2/\partial x & \partial f_2/\partial y \end{bmatrix}$$</p>
    <p>每步求解線性系統 $J(\mathbf{x}_n)\,\Delta\mathbf{x} = -\mathbf{F}(\mathbf{x}_n)$，再更新：</p>
    <p>$$\mathbf{x}_{n+1} = \mathbf{x}_n + \Delta\mathbf{x}$$</p>
    <p>對 $2\times2$ 系統，可直接用 Cramer 法則，行列式 $\det J = ad - bc$：</p>
    <p>$$\Delta x = \frac{-(d\,f_1 - b\,f_2)}{\det J}, \quad \Delta y = \frac{-(-c\,f_1 + a\,f_2)}{\det J}$$</p>
    <p>當 $J$ 在根附近非奇異時，仍保有二階收斂：$\|\mathbf{e}_{n+1}\| \leq C\|\mathbf{e}_n\|^2$。</p>
    <pre><code class="language-js">// 2×2 牛頓步（Cramer 法則）
const [[a,b],[c,d]] = J([x,y]);
const det = a*d - b*c;
const dx  = -(d*F[0] - b*F[1]) / det;
const dy  = -(-c*F[0] + a*F[1]) / det;</code></pre>
  `,
};

function renderModal() {
  const copy = appMode === '3d' ? MODAL_COPY_3D : MODAL_COPY_2D;
  mathContent.innerHTML = copy[modalLang];
  if (window.renderMathInElement) {
    window.renderMathInElement(mathContent, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
      ],
    });
  }
  if (window.Prism) window.Prism.highlightAllUnder(mathContent);
}

openMathBtn.addEventListener('click', () => {
  renderModal();
  mathModal.hidden = false;
});

closeMathBtn.addEventListener('click', () => { mathModal.hidden = true; });

langToggle.addEventListener('click', () => {
  modalLang = modalLang === 'en' ? 'zhTW' : 'en';
  renderModal();
});

mathModal.addEventListener('click', (e) => {
  if (e.target === mathModal) mathModal.hidden = true;
});

// ── Keyboard shortcuts ─────────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (mathModal && !mathModal.hidden) {
    if (e.key === 'Escape') mathModal.hidden = true;
    return;
  }
  if (appMode === '2d') {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); triggerNextStep(); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); btnUndo.click(); }
    if (e.key === 'r' || e.key === 'R') resetAll();
    if (e.key === 'a' || e.key === 'A') btnAuto.click();
  }
});

// ── 3D UI helpers ─────────────────────────────────────────────────────────────
function updateJacobian(J, det) {
  if (!J) {
    j00El.textContent = j01El.textContent = j10El.textContent = j11El.textContent = '—';
    jacobianDet.textContent = 'det J = —';
    return;
  }
  j00El.textContent = J[0][0].toFixed(4);
  j01El.textContent = J[0][1].toFixed(4);
  j10El.textContent = J[1][0].toFixed(4);
  j11El.textContent = J[1][1].toFixed(4);
  jacobianDet.textContent = `det J = ${det.toFixed(4)}`;
}

function updateResidual3d(F) {
  const norm = Math.hypot(F[0], F[1]);
  const MAX_LOG = 3;
  const logVal  = Math.log10(Math.max(norm, 1e-12));
  const pct     = Math.max(0, Math.min(1, (-logVal) / (MAX_LOG + 12)));
  residualBar3d.style.width = `${pct * 100}%`;
  residualVal3d.textContent = `|F| = ${norm.toExponential(4)}`;
  residualBar3d.classList.toggle('converged', norm < 1e-8);
}

function appendTableRow3d(n, x, y, F) {
  const norm = Math.hypot(F[0], F[1]);
  const row  = document.createElement('tr');
  row.innerHTML = `<td>${n}</td><td>${x.toPrecision(6)}</td><td>${y.toPrecision(6)}</td><td>${norm.toExponential(3)}</td>`;
  iterTbody3d.prepend(row);
}

function setStatus3d(msg, cls = '') {
  statusLine.textContent = msg;
  statusLine.className   = cls;
}

function resetPanel3d() {
  iterTbody3d.innerHTML = '';
  residualBar3d.style.width = '0%';
  residualVal3d.textContent = '—';
  updateJacobian(null, 0);
  setStatus3d('Ready');
}

// ── 3D step / auto ────────────────────────────────────────────────────────────
function triggerNext3D() {
  const result = step3D();
  if (!result.ok) {
    if (result.err === 'singular') setStatus3d('⚠ Jacobian singular — cannot step.', 'warn');
    if (result.err === 'diverge')  setStatus3d('⚠ Divergence detected.', 'warn');
    stopAuto3D();
    return;
  }
  const { x, y, F, J, det, n } = result.data;
  updateJacobian(J, det);
  updateResidual3d(F);
  appendTableRow3d(n, x, y, F);
  const norm = Math.hypot(F[0], F[1]);
  if (norm < 1e-8) {
    setStatus3d(`Converged ✓  (${x.toPrecision(6)}, ${y.toPrecision(6)})`, 'ok');
    stopAuto3D();
  } else {
    setStatus3d(`x${n} = (${x.toPrecision(5)}, ${y.toPrecision(5)})   |F| = ${norm.toExponential(3)}`);
  }
}

function startAuto3D() {
  if (autoTimer3d) return;
  btnAuto3d.textContent = '⏸ Pause';
  autoTimer3d = setInterval(triggerNext3D, 1000);
}

function stopAuto3D() {
  if (!autoTimer3d) return;
  clearInterval(autoTimer3d);
  autoTimer3d = null;
  btnAuto3d.textContent = '▶ Auto';
}

// ── Mode switch ───────────────────────────────────────────────────────────────
function switchMode(mode) {
  appMode = mode;
  const is3d = mode === '3d';

  // canvas visibility
  canvas.style.display   = is3d ? 'none' : 'block';
  canvas3d.style.display = is3d ? 'block' : 'none';

  // panel content
  panel2dContent.hidden = is3d;
  panel3dContent.hidden = !is3d;

  // header button label
  btnMode.textContent = is3d ? '2D' : '3D';
  btnMode.setAttribute('aria-label', is3d ? 'Switch to 2D mode' : 'Switch to 3D mode');

  if (is3d) {
    stopAuto();
    // Slight delay so canvas-3d has proper dimensions after becoming visible
    requestAnimationFrame(() => {
      init3D(canvas3d);
      loadPreset3D(
        fnSelect3d.value,
        parseFloat(x03dSlider.value),
        parseFloat(y03dSlider.value),
      );
      resetPanel3d();
      onControlsChange(syncZoomHud3d);
      syncZoomHud3d();
    });
  } else {
    stopAuto3D();
    resize();
    syncZoomHud();
    draw();
  }
}

btnMode.addEventListener('click', () => switchMode(appMode === '2d' ? '3d' : '2d'));

// ── 3D control wiring ─────────────────────────────────────────────────────────
fnSelect3d.addEventListener('change', () => {
  const preset = PRESETS_3D[fnSelect3d.value];
  x03dSlider.value = preset.p0[0];
  y03dSlider.value = preset.p0[1];
  x03dDisplay.textContent = preset.p0[0].toFixed(2);
  y03dDisplay.textContent = preset.p0[1].toFixed(2);
  reset3D(fnSelect3d.value, preset.p0[0], preset.p0[1]);
  resetPanel3d();
});

x03dSlider.addEventListener('input', () => {
  const v = parseFloat(x03dSlider.value);
  x03dDisplay.textContent = v.toFixed(2);
  setP0_3D(v, parseFloat(y03dSlider.value));
});

y03dSlider.addEventListener('input', () => {
  const v = parseFloat(y03dSlider.value);
  y03dDisplay.textContent = v.toFixed(2);
  setP0_3D(parseFloat(x03dSlider.value), v);
});

btnNext3d.addEventListener('click', triggerNext3D);

btnAuto3d.addEventListener('click', () => {
  if (autoTimer3d) stopAuto3D();
  else startAuto3D();
});

btnUndo3d.addEventListener('click', () => {
  stopAuto3D();
  const result = undo3D();
  iterTbody3d.querySelector('tr')?.remove();
  if (result) {
    updateJacobian(result.J, result.det);
    updateResidual3d(result.F);
    setStatus3d(`x${result.n} = (${result.x.toPrecision(5)}, ${result.y.toPrecision(5)})`);
  } else {
    resetPanel3d();
  }
});

btnReset3d.addEventListener('click', () => {
  stopAuto3D();
  reset3D(fnSelect3d.value, parseFloat(x03dSlider.value), parseFloat(y03dSlider.value));
  resetPanel3d();
});

// ── Boot ──────────────────────────────────────────────────────────────────────
resize();
loadPreset('sqrt2');
syncZoomHud();
