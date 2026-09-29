// DWG quantities: the Canvas 2D drawing of one file (spec §5 The drawing). Items are drawn from the engine's
// tessellated paths, grouped into one Path2D per colour so a frame is a handful of stroke calls even at
// 50,000 items. Pan and zoom first move a cached bitmap of the last full frame, then redraw when the hand
// stops. Paths are stored relative to the drawing's lower-left corner, so survey coordinates stay precise.
import { createIndex, pick } from './selection.js?v=20260930';

const PICK_PX = 4;            // pick tolerance in CSS pixels
const DRAG_PX = 4;            // a press that moves further than this is a box or a pan, not a click
const IDLE_MS = 120;          // full redraw after the last pan or zoom step

// sRGB relative luminance and contrast ratio, to keep layer colours visible on the canvas background.
function rgbOf(s) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(s).trim());
  if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const r = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i.exec(String(s));
  return r ? [+r[1], +r[2], +r[3]] : [255, 255, 255];
}
function lum([r, g, b]) {
  const c = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

// A layer colour too close to the background is replaced: a grey or white one (CAD's colour 7, "white on a
// black screen") by the ink itself, a coloured one (yellow on white) by a darker shade of its own hue.
export function visibleColor(color, bg, ink) {
  const c = rgbOf(color), b = rgbOf(bg), k = rgbOf(ink);
  if (contrast(c, b) >= 2) return hex(c);
  if (Math.max(...c) - Math.min(...c) < 24) return hex(k);
  for (let t = 0.2; t <= 1.0001; t += 0.1) {
    const m = c.map((v, i) => v + (k[i] - v) * t);
    if (contrast(m, b) >= 2.5) return hex(m);
  }
  return hex(k);
}

export function createView(canvas, { onHover = () => {}, onPick = () => {}, onBox = () => {} } = {}) {
  const ctx = canvas.getContext('2d');
  const base = document.createElement('canvas');           // the last full frame, for pan and zoom
  const bctx = base.getContext('2d');
  let result = null, items = [], index = null, paths = [], colorOf = [];
  let groups = [], hlGroups = null, selStroke = null, selFill = null;
  let X0 = 0, Y0 = 0, bw = 1, bh = 1;                        // drawing origin and size (m)
  let w = 1, h = 1, dpr = 1;                                 // canvas size in CSS px
  let k = 1, cx = 0, cy = 0;                                 // view: scale (px per m), centre (relative m)
  let baseView = null, fitted = false, idleTimer = 0, frame = 0;
  let press = null, box = null, spaceDown = false, hoverIdx = -1;
  const touches = new Map();
  let pinch = null;

  const css = name => getComputedStyle(canvas).getPropertyValue(name).trim();
  const colors = () => ({
    bg: getComputedStyle(canvas).backgroundColor || '#ffffff',
    ink: css('--ink') || '#17170f',
    hi: css('--gv-hi') || '#c2410c',
    accent: css('--accent') || '#0d7a3e',
  });

  // ---- coordinates ----
  const toModel = (sx, sy) => ({ x: (sx - w / 2) / k + cx + X0, y: (h / 2 - sy) / k + cy + Y0 });
  const local = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  // ---- building the paths ----
  function itemPath(it) {
    const p = new Path2D();
    for (const pl of it.path || []) {
      if (pl.length < 4) continue;
      p.moveTo(pl[0] - X0, pl[1] - Y0);
      for (let i = 2; i + 1 < pl.length; i += 2) p.lineTo(pl[i] - X0, pl[i + 1] - Y0);
    }
    return p;
  }

  function groupBy(indices) {
    const map = new Map();
    for (const i of indices) {
      const c = colorOf[i];
      let g = map.get(c);
      if (!g) map.set(c, g = { color: c, stroke: new Path2D(), fill: null });
      g.stroke.addPath(paths[i]);
      if (items[i].kind === 'hatch' && !items[i].bad) { if (!g.fill) g.fill = new Path2D(); g.fill.addPath(paths[i]); }
    }
    return [...map.values()];
  }

  function build() {
    const { bg, ink } = colors();
    const byLayer = new Map((result.layers || []).map(l => [l.name, visibleColor(l.color || ink, bg, ink)]));
    paths = items.map(itemPath);
    colorOf = items.map(it => byLayer.get(it.layer) || ink);
    groups = groupBy(items.map((_, i) => i));
  }

  // ---- drawing ----
  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; base.width = W; base.height = H; }
    if (result && !fitted) fit(); else full();
  }

  function paintGroups(c, list, width, alpha) {
    c.globalAlpha = alpha;
    for (const g of list) {
      if (g.fill) { c.globalAlpha = alpha * 0.14; c.fillStyle = g.color; c.fill(g.fill, 'evenodd'); c.globalAlpha = alpha; }
      c.strokeStyle = g.color;
      c.lineWidth = width / k;
      c.stroke(g.stroke);
    }
    c.globalAlpha = 1;
  }

  // Everything, at the current view, into the base bitmap; then onto the screen.
  function full() {
    clearTimeout(idleTimer);
    const { bg, hi } = colors();
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.fillStyle = bg;
    bctx.fillRect(0, 0, base.width, base.height);
    if (result) {
      bctx.setTransform(dpr * k, 0, 0, -dpr * k, dpr * (w / 2 - cx * k), dpr * (h / 2 + cy * k));
      bctx.lineJoin = 'round'; bctx.lineCap = 'round';
      if (hlGroups) { paintGroups(bctx, groups, 1, 0.18); paintGroups(bctx, hlGroups, 2, 1); }
      else paintGroups(bctx, groups, 1, 1);
      if (selStroke) {
        if (selFill) { bctx.globalAlpha = 0.22; bctx.fillStyle = hi; bctx.fill(selFill, 'evenodd'); bctx.globalAlpha = 1; }
        bctx.strokeStyle = hi; bctx.lineWidth = 2.5 / k; bctx.stroke(selStroke);
      }
    }
    baseView = { k, cx, cy };
    compose();
  }

  // The base bitmap moved to the current view, plus the selection box.
  function compose() {
    frame = 0;
    const { bg, hi, accent } = colors();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (baseView) {
      const s = k / baseView.k;
      const tx = (w / 2) * (1 - s) + (baseView.cx - cx) * k, ty = (h / 2) * (1 - s) - (baseView.cy - cy) * k;
      ctx.setTransform(s, 0, 0, s, tx * dpr, ty * dpr);
      ctx.drawImage(base, 0, 0);
    }
    if (box) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const crossing = box.x1 < box.x0;
      ctx.setLineDash(crossing ? [6, 4] : []);
      ctx.strokeStyle = crossing ? accent : hi;
      ctx.fillStyle = crossing ? 'rgba(13, 122, 62, 0.08)' : 'rgba(194, 65, 12, 0.08)';
      const x = Math.min(box.x0, box.x1), y = Math.min(box.y0, box.y1), bw_ = Math.abs(box.x1 - box.x0), bh_ = Math.abs(box.y1 - box.y0);
      ctx.fillRect(x, y, bw_, bh_);
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, bw_, bh_);
      ctx.setLineDash([]);
    }
  }

  const requestCompose = () => { if (!frame) frame = requestAnimationFrame(compose); };
  // A pan or zoom step: move the bitmap now, redraw everything once the hand stops.
  function moved() { requestCompose(); clearTimeout(idleTimer); idleTimer = setTimeout(full, IDLE_MS); }

  function fit() {
    if (!result) { full(); return; }
    fitted = true;
    const sw = bw > 0 ? bw : 0, sh = bh > 0 ? bh : 0;
    k = sw || sh ? 0.92 * Math.min(sw ? w / sw : Infinity, sh ? h / sh : Infinity) : 100;
    cx = bw / 2; cy = bh / 2;
    full();
  }

  function zoomAt(sx, sy, factor) {
    const m = toModel(sx, sy);
    k = Math.min(1e7, Math.max(1e-6, k * factor));
    cx = m.x - X0 - (sx - w / 2) / k;
    cy = m.y - Y0 - (h / 2 - sy) / k;
    moved();
  }

  // ---- input ----
  function hover(e) {
    if (!result || !index) return;
    const p = local(e), m = toModel(p.x, p.y);
    const i = pick(index, items, m.x, m.y, PICK_PX / k);
    if (i !== hoverIdx || i >= 0) { hoverIdx = i; onHover(i, e.clientX, e.clientY); }
  }

  function onPointerDown(e) {
    if (!result) return;
    canvas.setPointerCapture(e.pointerId);
    const p = local(e);
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, p);
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        press = null;
        return;
      }
    }
    const pan = e.button === 1 || (e.button === 0 && spaceDown) || e.pointerType === 'touch';
    press = { x: p.x, y: p.y, pan, moved: false, shift: e.shiftKey, cx, cy };
    if (e.button === 1) e.preventDefault();
  }

  function onPointerMove(e) {
    const p = local(e);
    if (pinch && touches.has(e.pointerId)) {
      touches.set(e.pointerId, p);
      const [a, b] = [...touches.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      zoomAt(mx, my, (pinch.k * d) / pinch.d / k);
      cx -= (mx - pinch.mx) / k; cy += (my - pinch.my) / k;
      pinch.mx = mx; pinch.my = my;
      return;
    }
    if (!press) { if (e.pointerType !== 'touch') hover(e); return; }
    if (!press.moved && Math.hypot(p.x - press.x, p.y - press.y) < DRAG_PX) return;
    press.moved = true;
    if (press.pan) {
      cx = press.cx - (p.x - press.x) / k;
      cy = press.cy + (p.y - press.y) / k;
      moved();
    } else {
      box = { x0: press.x, y0: press.y, x1: p.x, y1: p.y };
      requestCompose();
    }
  }

  function onPointerUp(e) {
    touches.delete(e.pointerId);
    if (pinch) { if (touches.size < 2) pinch = null; return; }
    const pr = press;
    press = null;
    if (!pr || !result) return;
    const p = local(e);
    if (!pr.moved) {
      if (pr.pan && e.pointerType !== 'touch') return;
      const m = toModel(p.x, p.y);
      onPick(pick(index, items, m.x, m.y, PICK_PX / k), pr.shift || e.shiftKey);
      return;
    }
    if (box) {
      const a = toModel(box.x0, box.y0), b = toModel(box.x1, box.y1);
      const mode = box.x1 >= box.x0 ? 'window' : 'crossing';
      box = null;
      requestCompose();
      onBox(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y), mode, pr.shift || e.shiftKey);
    }
  }

  function onWheel(e) {
    if (!result) return;
    e.preventDefault();
    const p = local(e);
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(p.x, p.y, Math.exp(-dy * 0.0015));
  }

  const onLeave = () => { if (!press && hoverIdx !== -1) { hoverIdx = -1; onHover(-1, 0, 0); } };
  const onKey = e => { if (e.code === 'Space' && e.target === document.body) { spaceDown = e.type === 'keydown'; if (spaceDown) e.preventDefault(); } };
  const onCancel = e => { touches.delete(e.pointerId); press = null; pinch = null; box = null; requestCompose(); };
  const onAuxclick = e => { if (e.button === 1) e.preventDefault(); };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('auxclick', onAuxclick);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const onDpr = () => resize();
  window.addEventListener('resize', onDpr);

  return {
    show(r) {
      result = r;
      items = (r && r.items) || [];
      const b = (r && r.bbox) || { x0: 0, y0: 0, x1: 1, y1: 1 };
      X0 = b.x0; Y0 = b.y0; bw = Math.max(0, b.x1 - b.x0); bh = Math.max(0, b.y1 - b.y0);
      index = createIndex(items);
      hlGroups = null; selStroke = null; selFill = null; hoverIdx = -1;
      build();
      resize();
      fit();
    },
    clear() { result = null; items = []; index = null; groups = []; hlGroups = null; selStroke = selFill = null; baseView = null; full(); },
    // Highlighted items drawn strong, the rest faded; null shows all normally.
    setHighlight(indices) {
      hlGroups = indices && indices.length ? groupBy(indices) : null;
      full();
    },
    setSelection(indices) {
      selStroke = selFill = null;
      if (indices && indices.length) {
        selStroke = new Path2D();
        for (const i of indices) {
          selStroke.addPath(paths[i]);
          if (items[i].kind === 'hatch' && !items[i].bad) { if (!selFill) selFill = new Path2D(); selFill.addPath(paths[i]); }
        }
      }
      full();
    },
    fit,
    zoomBy(f) { zoomAt(w / 2, h / 2, f); },
    // Colours come from CSS: rebuild them after a theme change.
    restyle() { if (result) { build(); full(); } },
    get index() { return index; },
    destroy() {
      ro.disconnect();
      clearTimeout(idleTimer);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel, { passive: false });
      canvas.removeEventListener('auxclick', onAuxclick);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('resize', onDpr);
    },
  };
}
