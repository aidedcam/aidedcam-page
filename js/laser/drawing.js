// Laser DXF check: the SVG drawing of one file (spec §10). Model y points up, SVG y points down, so every
// y is negated. A counter-clockwise arc in the model then runs towards decreasing SVG angles: sweep-flag 0.
const NS = 'http://www.w3.org/2000/svg';
const f = v => (Math.round(v * 1000) / 1000).toString();
const rad = d => (d * Math.PI) / 180;

function arcEnds(s) {
  return {
    x0: s.cx + s.r * Math.cos(rad(s.a0)), y0: s.cy + s.r * Math.sin(rad(s.a0)),
    x1: s.cx + s.r * Math.cos(rad(s.a1)), y1: s.cy + s.r * Math.sin(rad(s.a1)),
  };
}

// Sweep of an arc in degrees, in (0, 360].
export function arcSweep(s) {
  let d = s.ccw ? s.a1 - s.a0 : s.a0 - s.a1;
  while (d <= 1e-9) d += 360;
  while (d > 360 + 1e-9) d -= 360;
  return d;
}

// Path data for one piece, starting with its own M.
export function segPath(s) {
  if (s.t === 'L') return `M${f(s.x1)} ${f(-s.y1)}L${f(s.x2)} ${f(-s.y2)}`;
  if (s.t === 'C') {
    return `M${f(s.cx + s.r)} ${f(-s.cy)}A${f(s.r)} ${f(s.r)} 0 1 1 ${f(s.cx - s.r)} ${f(-s.cy)}` +
      `A${f(s.r)} ${f(s.r)} 0 1 1 ${f(s.cx + s.r)} ${f(-s.cy)}`;
  }
  if (s.t === 'P') return 'M' + s.pts.map(p => `${f(p[0])} ${f(-p[1])}`).join('L');
  const e = arcEnds(s);
  const large = arcSweep(s) > 180 ? 1 : 0;
  return `M${f(e.x0)} ${f(-e.y0)}A${f(s.r)} ${f(s.r)} 0 ${large} ${s.ccw ? 0 : 1} ${f(e.x1)} ${f(-e.y1)}`;
}

export const contourPath = c => c.segs.map(segPath).join('');

// Bounds of everything drawn, in model coordinates (arcs by their extreme points).
export function boundsOf(result) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const add = (x, y) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
  for (const c of result.contours || []) {
    for (const s of c.segs) {
      if (s.t === 'L') { add(s.x1, s.y1); add(s.x2, s.y2); }
      else if (s.t === 'P') s.pts.forEach(p => add(p[0], p[1]));
      else if (s.t === 'C') { add(s.cx - s.r, s.cy - s.r); add(s.cx + s.r, s.cy + s.r); }
      else {
        const e = arcEnds(s); add(e.x0, e.y0); add(e.x1, e.y1);
        const from = s.ccw ? s.a0 : s.a1, sweep = arcSweep(s);
        for (let q = 0; q < 360; q += 90) {
          const d = (((q - from) % 360) + 360) % 360;
          if (d <= sweep) add(s.cx + s.r * Math.cos(rad(q)), s.cy + s.r * Math.sin(rad(q)));
        }
      }
    }
  }
  for (const t of result.texts || []) add(t.x, t.y);
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : { minX: 0, minY: 0, maxX: 100, maxY: 100 };
}

function el(name, attrs = {}, parent) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

// svg: the <svg> element. onHover(contour | null) reports the contour under the pointer.
export function createDrawing(svg, { onHover = () => {} } = {}) {
  let vb = { x: 0, y: -100, w: 100, h: 100 }, fitBox = vb, result = null;
  const layer = el('g', { class: 'lc-geo' }, svg);
  const marks = el('g', { class: 'lc-marks' }, svg);

  function apply() {
    svg.setAttribute('viewBox', `${f(vb.x)} ${f(vb.y)} ${f(vb.w)} ${f(vb.h)}`);
    const px = svg.clientWidth || 600;
    const k = Math.max(vb.w / px, vb.h / (svg.clientHeight || 400));
    marks.querySelectorAll('circle').forEach(c => c.setAttribute('r', f(5 * k)));
  }

  function fit() {
    if (!result) return;
    const b = boundsOf(result);
    const w = Math.max(b.maxX - b.minX, 1e-3), h = Math.max(b.maxY - b.minY, 1e-3), pad = Math.max(w, h) * 0.05;
    fitBox = { x: b.minX - pad, y: -b.maxY - pad, w: w + 2 * pad, h: h + 2 * pad };
    vb = { ...fitBox };
    apply();
  }

  function show(r) {
    result = r;
    layer.replaceChildren(); marks.replaceChildren();
    for (const c of r.contours || []) {
      const cls = `lc-c lc-${c.role}` + (c.role === 'cut' && !c.closed ? ' lc-open' : '');
      const p = el('path', { d: contourPath(c), class: cls, 'data-id': String(c.id) }, layer);
      p.addEventListener('pointerenter', () => onHover(c));
      p.addEventListener('pointerleave', () => onHover(null));
    }
    for (const t of r.texts || []) {
      const tx = el('text', { x: f(t.x), y: f(-t.y), 'font-size': f(t.h || 2.5), class: 'lc-text',
        transform: t.rot ? `rotate(${f(-t.rot)} ${f(t.x)} ${f(-t.y)})` : '' }, layer);
      tx.textContent = t.value;
    }
    for (const m of r.markers || []) el('circle', { cx: f(m.x), cy: f(-m.y), r: '1', class: `lc-m lc-m-${m.kind}` }, marks);
    fit();
  }

  // Wheel zooms about the pointer; dragging pans.
  svg.addEventListener('wheel', e => {
    if (!result) return;
    e.preventDefault();
    const r = svg.getBoundingClientRect();
    const k = e.deltaY > 0 ? 1.2 : 1 / 1.2;
    const mx = vb.x + ((e.clientX - r.left) / r.width) * vb.w, my = vb.y + ((e.clientY - r.top) / r.height) * vb.h;
    vb = { x: mx - (mx - vb.x) * k, y: my - (my - vb.y) * k, w: vb.w * k, h: vb.h * k };
    apply();
  }, { passive: false });
  let drag = null;
  svg.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, vb: { ...vb } }; });
  window.addEventListener('pointerup', () => { drag = null; });
  svg.addEventListener('pointermove', e => {
    if (!drag || !(e.buttons & 1)) return;
    const r = svg.getBoundingClientRect();
    vb = { ...drag.vb, x: drag.vb.x - ((e.clientX - drag.x) / r.width) * drag.vb.w, y: drag.vb.y - ((e.clientY - drag.y) / r.height) * drag.vb.h };
    apply();
  });

  return {
    show,
    fit,
    clear() { result = null; layer.replaceChildren(); marks.replaceChildren(); },
    zoomBy(k) { const cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2; vb = { x: cx - (vb.w * k) / 2, y: cy - (vb.h * k) / 2, w: vb.w * k, h: vb.h * k }; apply(); },
    highlight(id) { layer.querySelectorAll('.lc-c').forEach(p => p.classList.toggle('is-hi', p.getAttribute('data-id') === String(id))); },
  };
}
