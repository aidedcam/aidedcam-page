// Coverage pre-check: the drawing (spec §6). A small Canvas 2D view of its own, because the DWG quantities view
// (js/dwg/view.js) has no hook for fills by role or numbered vertices: mapped outlines are filled and stroked
// in their role's colour, everything else is faint context, the building outline (the coverage union) is drawn
// strong with its vertices numbered, and highlighted outlines stand out. Pan with a drag, zoom with the wheel,
// a pinch or the buttons. Coordinates are kept relative to the drawing's lower-left corner, so survey
// coordinates stay precise.
import { inside } from './levels.js?v=20260930';

export const ROLE_COLORS = {
  plot: '#8a2c0d', cover: '#1d4ed8', level: '#17170f', mezz: '#7e22ce', semiopen: '#0e7490', balcony: '#b45309',
  stairCommon: '#be123c', stairUnit: '#c026d3', void: '#57534e', pilotis: '#4d7c0f', bsmtMain: '#92400e', exclOther: '#475569', green: '#15803d',
};
const HI = '#c2410c';
const PICK_PX = 5;

export function createDrawing(canvas, { onHover = () => {}, onPick = () => {} } = {}) {
  const ctx = canvas.getContext('2d');
  let items = [], roles = [], rings = [], X0 = 0, Y0 = 0, bw = 1, bh = 1;
  let building = [], labels = [], hl = new Set();
  // The paths, built once per show(): the faint context in one path, each mapped outline's own (biggest first,
  // so small spaces sit on top), and the building outline. A redraw (pan, zoom, highlight) only strokes them.
  let contextPath = null, paths = [], order = [], buildingPath = null;
  let w = 1, h = 1, dpr = 1, k = 1, cx = 0, cy = 0, fitted = false, frame = 0;
  let drag = null, pinch = null, userMoved = false;     // a pan or zoom by the visitor: a resize keeps it
  const touches = new Map();

  const css = n => getComputedStyle(canvas).getPropertyValue(n).trim();
  const toModel = (sx, sy) => ({ x: (sx - w / 2) / k + cx, y: (h / 2 - sy) / k + cy });     // relative metres
  const local = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    if ((!fitted || !userMoved) && items.length) fit(); else draw();
  }

  function fit() {
    fitted = true; userMoved = false;
    k = bw > 0 || bh > 0 ? 0.9 * Math.min(bw > 0 ? w / bw : Infinity, bh > 0 ? h / bh : Infinity) : 10;
    if (!Number.isFinite(k) || k <= 0) k = 10;
    cx = bw / 2; cy = bh / 2;
    draw();
  }

  function pathOf(p, out = new Path2D()) {
    for (const pl of p) {
      if (pl.length < 4) continue;
      out.moveTo(pl[0] - X0, pl[1] - Y0);
      for (let i = 2; i + 1 < pl.length; i += 2) out.lineTo(pl[i] - X0, pl[i + 1] - Y0);
    }
    return out;
  }

  function draw() {
    frame = 0;
    const bg = getComputedStyle(canvas).backgroundColor || '#fff';
    const faint = css('--faint') || '#b9b8ae';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!items.length) return;
    ctx.setTransform(dpr * k, 0, 0, -dpr * k, dpr * (w / 2 - cx * k), dpr * (h / 2 + cy * k));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const any = hl.size > 0;
    // Context first, then mapped outlines by role.
    ctx.globalAlpha = any ? 0.3 : 0.7;
    ctx.strokeStyle = faint; ctx.lineWidth = 0.8 / k; ctx.stroke(contextPath);
    for (const i of order) {
      const it = items[i], role = roles[i], color = ROLE_COLORS[role.role] || '#17170f';
      const p = paths[i], on = hl.has(it.id), dim = any && !on;
      if (role.closed) { ctx.globalAlpha = dim ? 0.04 : on ? 0.3 : 0.12; ctx.fillStyle = on ? HI : color; ctx.fill(p, 'evenodd'); }
      ctx.globalAlpha = dim ? 0.25 : 1;
      ctx.strokeStyle = on ? HI : color;
      ctx.lineWidth = (on ? 2.6 : role.closed ? 1.2 : 1.6) / k;
      ctx.setLineDash(role.closed ? [] : [6 / k, 4 / k]);
      ctx.stroke(p);
      ctx.setLineDash([]);
    }
    // The building outline and its numbered vertices.
    ctx.globalAlpha = 1;
    if (buildingPath) {
      ctx.strokeStyle = css('--ink') || '#17170f';
      ctx.lineWidth = 2.2 / k;
      ctx.stroke(buildingPath);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    for (const l of labels) {
      const sx = (l.x - X0 - cx) * k + w / 2, sy = h / 2 - (l.y - Y0 - cy) * k;
      if (sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20) continue;
      const r = String(l.n).length > 1 ? 9 : 7.5;
      ctx.fillStyle = l.plot ? ROLE_COLORS.plot : css('--ink') || '#17170f';
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(String(l.n), sx, sy + 0.5);
    }
  }
  // Paths are relative to X0, Y0: rebuilt whenever the items, the roles or that corner change.
  function buildPaths() {
    contextPath = new Path2D(); paths = []; order = [];
    items.forEach((it, i) => { if (!it.path || !it.path.length) return; if (roles[i]) { paths[i] = pathOf(it.path); order.push(i); } else pathOf(it.path, contextPath); });
    order.sort((a, b) => (items[b].area || 0) - (items[a].area || 0));
    buildingPath = building.length ? pathOf(building) : null;
  }
  const request = () => { if (!frame) frame = requestAnimationFrame(draw); };

  function zoomAt(sx, sy, f) {
    const m = toModel(sx, sy);
    k = Math.min(1e7, Math.max(1e-6, k * f));
    userMoved = true;
    cx = m.x - (sx - w / 2) / k; cy = m.y - (h / 2 - sy) / k;
    request();
  }

  // The outline under a point: the smallest mapped closed outline containing it, else a mapped open one near it.
  function pickAt(sx, sy) {
    const m = toModel(sx, sy), p = [m.x + X0, m.y + Y0];
    let best = -1, bestArea = Infinity;
    items.forEach((it, i) => {
      const r = roles[i];
      if (!r || !r.closed || !rings[i]) return;
      if (inside(p, rings[i]) && it.area < bestArea) { best = i; bestArea = it.area; }
    });
    if (best >= 0) return best;
    const tol = PICK_PX / k;
    items.forEach((it, i) => {
      if (best >= 0 || !roles[i] || roles[i].closed) return;
      for (const pl of it.path || []) for (let j = 2; j + 1 < pl.length; j += 2) {
        const ax = pl[j - 2], ay = pl[j - 1], bx = pl[j], by = pl[j + 1];
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
        const t = l2 > 0 ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2)) : 0;
        if (Math.hypot(p[0] - ax - t * dx, p[1] - ay - t * dy) <= tol) { best = i; return; }
      }
    });
    return best;
  }

  function onDown(e) {
    if (!items.length) return;
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
    if (!drag) { if (e.pointerType !== 'touch') { const i = pickAt(p.x, p.y); onHover(i, e.clientX, e.clientY); } return; }
    if (!drag.moved && Math.hypot(p.x - drag.x, p.y - drag.y) < 4) return;
    drag.moved = true; userMoved = true;
    cx = drag.cx - (p.x - drag.x) / k; cy = drag.cy + (p.y - drag.y) / k;
    request();
  }
  function onUp(e) {
    touches.delete(e.pointerId);
    if (pinch) { if (touches.size < 2) pinch = null; return; }
    const d = drag; drag = null;
    if (d && !d.moved) { const p = local(e); onPick(pickAt(p.x, p.y)); }
  }
  function onWheel(e) {
    if (!items.length) return;
    e.preventDefault();
    const p = local(e);
    zoomAt(p.x, p.y, Math.exp(-(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY) * 0.0015));
  }
  const onLeave = () => onHover(-1, 0, 0);
  const onCancel = e => { touches.delete(e.pointerId); drag = null; pinch = null; };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize', resize);

  return {
    // result: the engine's; roleOf(item) → { role, closed } or null; opts.building: the union's paths;
    // opts.labels: [{ x, y, n, plot }]. keepView keeps the current pan and zoom (a remap, not a new file).
    show(result, roleOf, opts = {}, keepView = false) {
      items = (result && result.items) || [];
      roles = items.map(roleOf);
      rings = items.map((it, i) => (roles[i] && roles[i].closed ? ringFromPath(it.path) : null));
      const b = (result && result.bbox) || { x0: 0, y0: 0, x1: 1, y1: 1 };
      if (!keepView || !fitted) { X0 = b.x0; Y0 = b.y0; bw = Math.max(0, b.x1 - b.x0); bh = Math.max(0, b.y1 - b.y0); fitted = false; }
      building = opts.building || []; labels = opts.labels || [];
      buildPaths();
      resize();
    },
    setHighlight(ids) { hl = new Set(ids || []); draw(); },
    clear() { items = []; roles = []; rings = []; building = []; labels = []; hl = new Set(); fitted = false; buildPaths(); draw(); },
    fit, zoomBy(f) { zoomAt(w / 2, h / 2, f); }, restyle: draw,
    // For the browser check: what is highlighted, and where a drawing point is on screen (CSS px in the canvas).
    get highlighted() { return [...hl]; },
    screenOf(x, y) { return { x: (x - X0 - cx) * k + w / 2, y: h / 2 - (y - Y0 - cy) * k }; },
  };
}

function ringFromPath(path) {
  const p = (path && path[0]) || [];
  const ring = [];
  for (let i = 0; i + 1 < p.length; i += 2) ring.push([p[i], p[i + 1]]);
  return ring;
}
