// IFC floor plans: the preview of one storey's plan (spec §6). A Canvas 2D view: each layer in its colour (the ACI
// hue of spec §4, darkened where it would vanish on the page's light background), rooms faintly filled with their
// labels, pan with a drag, zoom with the wheel, a pinch or the buttons, and a tooltip naming the layer under the
// pointer. Every storey is fitted to the whole model, so switching storeys keeps them aligned. Coordinates are kept
// relative to the model's lower-left corner, so georeferenced coordinates stay precise. Layers the legend hides
// (setHidden) are neither drawn nor picked; hiding IFC_SPACE hides the room labels too.
import { LAYERS } from './layers.js?v=20261103';
import { forEachPolyline } from './chain.js?v=20261103';
import { labelLines } from './rooms.js?v=20261103';

export const LAYER_COLORS = {
  IFC_WALL: '#17170f', IFC_DOOR: '#0e7490', IFC_WINDOW: '#1d4ed8', IFC_COLUMN: '#b91c1c', IFC_BEAM: '#6b7280',
  IFC_SLAB: '#9ca3af', IFC_STAIR: '#15803d', IFC_RAILING: '#c2410c', IFC_CURTAINWALL: '#0369a1', IFC_FURNITURE: '#a16207',
  IFC_MEP: '#a21caf', IFC_OTHER: '#57534e', IFC_SPACE: '#a16207', IFC_SPACE_TEXT: '#a16207',
};
// Drawn bottom to top: rooms and slabs under everything, walls on top.
const ORDER = ['IFC_SPACE', 'IFC_SLAB', 'IFC_OTHER', 'IFC_FURNITURE', 'IFC_MEP', 'IFC_BEAM', 'IFC_CURTAINWALL', 'IFC_RAILING', 'IFC_STAIR', 'IFC_WINDOW', 'IFC_DOOR', 'IFC_COLUMN', 'IFC_WALL'];
const PICK_PX = 6;

export function createDrawing(canvas, { onHover = () => {} } = {}) {
  const ctx = canvas.getContext('2d');
  let storey = null, X0 = 0, Y0 = 0, bw = 1, bh = 1;
  let paths = new Map();                     // layer → Path2D, relative to (X0, Y0)
  let w = 1, h = 1, dpr = 1, k = 1, cx = 0, cy = 0, fitted = false, frame = 0;
  let drag = null, pinch = null, userMoved = false;
  let hover = null, hoverFrame = 0;          // the latest pointer position to pick at, one pick per frame
  let hidden = new Set();                    // layers the legend switched off
  const touches = new Map();

  const toModel = (sx, sy) => ({ x: (sx - w / 2) / k + cx, y: (h / 2 - sy) / k + cy });
  const local = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;         // hidden (the 3D tab): keep the last bitmap and view, print shows the plan
    dpr = window.devicePixelRatio || 1;
    w = r.width; h = r.height;
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    if ((!fitted || !userMoved) && storey) fit(); else draw();
  }

  function fit() {
    fitted = true; userMoved = false;
    k = 0.92 * Math.min(bw > 0 ? w / bw : Infinity, bh > 0 ? h / bh : Infinity);
    if (!Number.isFinite(k) || k <= 0) k = 10;
    cx = bw / 2; cy = bh / 2;
    draw();
  }

  function build() {
    paths = new Map();
    if (!storey) return;
    for (const name of ORDER) {
      const set = storey.layers[name];
      if (!set || !set.ends.length) continue;
      const p = new Path2D();
      forEachPolyline(set, (pts, closed) => {
        if (pts.length < 4) return;
        p.moveTo(pts[0] - X0, pts[1] - Y0);
        for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i] - X0, pts[i + 1] - Y0);
        if (closed) p.closePath();
      });
      paths.set(name, p);
    }
  }

  function draw() {
    frame = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = getComputedStyle(canvas).backgroundColor || '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!storey) return;
    ctx.setTransform(dpr * k, 0, 0, -dpr * k, dpr * (w / 2 - cx * k), dpr * (h / 2 + cy * k));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [name, p] of paths) {
      if (hidden.has(name)) continue;
      if (name === 'IFC_SPACE') { ctx.globalAlpha = 0.08; ctx.fillStyle = LAYER_COLORS[name]; ctx.fill(p, 'evenodd'); }
      ctx.globalAlpha = name === 'IFC_SPACE' || name === 'IFC_SLAB' ? 0.6 : 1;
      ctx.strokeStyle = LAYER_COLORS[name];
      ctx.lineWidth = (name === 'IFC_WALL' ? 1.4 : 1) / k;
      ctx.stroke(p);
    }
    ctx.globalAlpha = 1;
    // Room labels at 0.20 m of the model, as in the DXF, when they are big enough to read.
    const px = Math.min(14, 0.2 * k);
    if (px < 6 || hidden.has('IFC_SPACE')) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `500 ${px}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = LAYER_COLORS.IFC_SPACE_TEXT;
    for (const r of storey.rooms) {
      if (!r.at) continue;
      const lines = labelLines(r);
      const sx = (r.at[0] - X0 - cx) * k + w / 2, sy = h / 2 - (r.at[1] - Y0 - cy) * k;
      lines.forEach((t, i) => ctx.fillText(t, sx, sy + (i - (lines.length - 1) / 2) * px * 1.3));
    }
  }
  const request = () => { if (!frame) frame = requestAnimationFrame(draw); };

  function zoomAt(sx, sy, f) {
    const m = toModel(sx, sy);
    k = Math.min(1e7, Math.max(1e-6, k * f));
    userMoved = true;
    cx = m.x - (sx - w / 2) / k; cy = m.y - (h / 2 - sy) / k;
    request();
  }

  // The layer of the line nearest the pointer, within a few pixels; the topmost layer wins a tie.
  function layerAt(sx, sy) {
    if (!storey) return null;
    const m = toModel(sx, sy), x = m.x + X0, y = m.y + Y0, tol = PICK_PX / k;
    let best = null, bestD = tol;
    for (const name of ORDER) {
      const set = storey.layers[name];
      if (!set || hidden.has(name)) continue;
      forEachPolyline(set, (pts, closed) => {
        const n = pts.length / 2;
        for (let i = closed ? 0 : 1; i < n; i++) {
          const j = i === 0 ? n - 1 : i - 1;
          const ax = pts[2 * j], ay = pts[2 * j + 1], dx = pts[2 * i] - ax, dy = pts[2 * i + 1] - ay;
          if (Math.abs(x - ax) > bestD + Math.abs(dx) || Math.abs(y - ay) > bestD + Math.abs(dy)) continue;
          const l2 = dx * dx + dy * dy;
          const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
          const d = Math.hypot(x - ax - t * dx, y - ay - t * dy);
          if (d <= bestD) { bestD = d; best = name; }
        }
      });
    }
    return best;
  }

  // Hover picking walks every polyline: done at most once per animation frame, at the latest pointer position.
  function pick() {
    hoverFrame = 0;
    const q = hover;
    hover = null;
    if (q) onHover(layerAt(q.x, q.y), q.clientX, q.clientY);
  }
  function hoverAt(p, e) {
    hover = { x: p.x, y: p.y, clientX: e.clientX, clientY: e.clientY };
    if (!hoverFrame) hoverFrame = requestAnimationFrame(pick);
  }
  function stopHover() {
    if (hoverFrame) cancelAnimationFrame(hoverFrame);
    hoverFrame = 0; hover = null;
  }

  function onDown(e) {
    if (!storey) return;
    canvas.setPointerCapture(e.pointerId);
    const p = local(e);
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, p);
      if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k }; drag = null; return; }
    }
    drag = { x: p.x, y: p.y, cx, cy, moved: false };
  }
  function onMove(e) {
    const p = local(e);
    if (pinch && touches.has(e.pointerId)) {
      touches.set(e.pointerId, p);
      const [a, b] = [...touches.values()];
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (pinch.k * (Math.hypot(a.x - b.x, a.y - b.y) || 1)) / pinch.d / k);
      return;
    }
    if (!drag) { if (e.pointerType !== 'touch') hoverAt(p, e); return; }
    if (!drag.moved && Math.hypot(p.x - drag.x, p.y - drag.y) < 4) return;
    drag.moved = true; userMoved = true;
    cx = drag.cx - (p.x - drag.x) / k; cy = drag.cy + (p.y - drag.y) / k;
    request();
  }
  function onUp(e) {
    touches.delete(e.pointerId);
    if (pinch) { if (touches.size < 2) pinch = null; return; }
    drag = null;
  }
  function onWheel(e) {
    if (!storey) return;
    e.preventDefault();
    const p = local(e);
    zoomAt(p.x, p.y, Math.exp(-(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY) * 0.0015));
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', e => { touches.delete(e.pointerId); drag = null; pinch = null; });
  canvas.addEventListener('pointerleave', () => { stopHover(); onHover(null, 0, 0); });
  canvas.addEventListener('wheel', onWheel, { passive: false });
  new ResizeObserver(resize).observe(canvas);

  return {
    // storey: one storey of the worker's answer; bbox: the whole model's, so every storey lines up. keepView keeps
    // the pan and zoom (another storey of the same file).
    show(next, bbox, keepView = false) {
      storey = next;
      if (!keepView || !fitted) {
        X0 = bbox.x0; Y0 = bbox.y0; bw = Math.max(0, bbox.x1 - bbox.x0); bh = Math.max(0, bbox.y1 - bbox.y0); fitted = false;
      }
      build();
      resize();
    },
    clear() { storey = null; paths = new Map(); fitted = false; draw(); },
    fit, zoomBy(f) { zoomAt(w / 2, h / 2, f); },
    // The layers the legend switched off; redrawn at once.
    setHidden(set) { hidden = new Set(set); draw(); },
    // The layers of this storey's plan, hidden or not, in drawing order (for the legend and the browser check).
    get layers() { return [...paths.keys()]; },
    // For the browser check: where a model point is on screen (CSS px in the canvas), and the layer under it.
    screenOf(x, y) { return { x: (x - X0 - cx) * k + w / 2, y: h / 2 - (y - Y0 - cy) * k }; },
    layerAt,
  };
}

// The legend's order: spec §4's.
export const LEGEND_ORDER = LAYERS.map(l => l.name).filter(n => n !== 'IFC_SPACE_TEXT');
