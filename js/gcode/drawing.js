// DOM drawing: mounts a render.js scene into an <svg> with wheel zoom, drag pan, fit, 1:1 aspect,
// X+ up/down, layer toggles, hover and highlight. Only this file and ui.js touch the DOM.
import { buildScene, viewBoxFor, buildIndex, nearestSegment, toPathD } from './render.js';

const NS = 'http://www.w3.org/2000/svg';
const LAYERS = ['profile', 'rapid', 'pass', 'feed'];            // paint order: profile underneath

function el(name, attrs = {}) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

export function createDrawing(svg, { onHover, onPick, checkText, unitFactor, fmtNumber } = {}) {
  let scene = null, index = null, vb = null, flip = false, drag = null, lastResult = null;
  const pointers = new Map();                                   // pointerId -> {x, y}: pinch tracking (item 3)
  let pinch = null;                                              // {d0, vb0} while two pointers are down
  const root = el('g', { class: 'gv-root' });
  const axis = el('path', { class: 'gv-path gv-axis', 'vector-effect': 'non-scaling-stroke' });
  root.appendChild(axis);
  const paths = {};
  for (const k of LAYERS) {
    paths[k] = el('path', { class: `gv-path gv-${k}`, 'vector-effect': 'non-scaling-stroke' });
    root.appendChild(paths[k]);
  }
  const hi = el('path', { class: 'gv-path gv-hi', 'vector-effect': 'non-scaling-stroke' });
  const starts = el('g', { class: 'gv-starts' });
  const markersG = el('g', { class: 'gv-markers' });               // error markers (item 5): above the other layers
  root.append(hi, starts, markersG);
  const labelsG = el('g', { class: 'gv-labels' });
  const ticksG = el('g', { class: 'gv-ticks' });                  // axis ticks (item 4): outside root, like labelsG
  svg.replaceChildren(root, labelsG, ticksG);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  // A "nice" step (1-2-5 * 10^n) giving about `count` ticks over `range` (item 4).
  function niceStep(range, count = 5) {
    const raw = range / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
    return step * mag;
  }
  const fmtTick = v => { const r = Math.round(v * 100) / 100; return Object.is(r, -0) ? '0' : String(r); };

  function worldPerPixel() {
    const r = svg.getBoundingClientRect();
    return vb ? Math.max(vb.w / Math.max(1, r.width), vb.h / Math.max(1, r.height)) : 1;
  }

  function apply() {
    if (!vb) return;
    const y = flip ? -(vb.y + vb.h) : vb.y;                       // flipped content: y' = -y
    svg.setAttribute('viewBox', `${vb.x} ${y} ${vb.w} ${vb.h}`);
    if (flip) root.setAttribute('transform', 'scale(1,-1)'); else root.removeAttribute('transform');
    const r = 4 * worldPerPixel();
    starts.querySelectorAll('circle').forEach(c => c.setAttribute('r', String(r)));
    const mh = 5 * worldPerPixel();                                // marker cross half-size: inside root, no flip math needed
    markersG.querySelectorAll('path').forEach(p => {
      const x = Number(p.dataset.x), z = Number(p.dataset.z), y = -x;
      p.setAttribute('d', `M${z - mh} ${y - mh}L${z + mh} ${y + mh}M${z - mh} ${y + mh}L${z + mh} ${y - mh}`);
    });
    const fs = 11 * worldPerPixel();                               // labels sit outside root: place by hand
    labelsG.querySelectorAll('text').forEach(tx => {
      const x = Number(tx.dataset.x), z = Number(tx.dataset.z);
      tx.setAttribute('x', String(z + fs * 0.4));
      tx.setAttribute('y', String((flip ? x : -x) - fs * 0.4));
      tx.setAttribute('font-size', String(fs));
    });
    renderTicks();
  }

  // Z ticks on the centreline, ⌀ ticks on the current left edge (item 4, R4). Rebuilt every apply()
  // call so they track zoom, pan and (via relabel()) language; outside root like labelsG so tick
  // text is never mirrored. The step is chosen, and the label formatted, in the program's display
  // units (R4): mm as-is, inch programs divide by 25.4. Each loop is capped at 50 iterations
  // regardless of its arithmetic end condition (R3), so a degenerate step can never hang the tab.
  const MAX_TICKS = 50;
  function renderTicks() {
    if (!vb) { ticksG.replaceChildren(); return; }
    const wpp = worldPerPixel();
    const tickLen = 4 * wpp, fs = 10 * wpp;
    const factor = (unitFactor && unitFactor()) || 1;             // mm per display unit
    // A tiny negative float that rounds to zero must not print as "-0.00" (Intl.NumberFormat does).
    const fmt = v => {
      const s = fmtNumber ? fmtNumber(v, 2) : fmtTick(v);
      return /^-[0.,\s]+$/.test(s) ? s.slice(1) : s;
    };
    const zStep = niceStep(vb.w / factor) * factor;               // world (mm) spacing, nice in display units
    const xStep = (niceStep((2 * vb.h) / factor) * factor) / 2;   // ⌀ step is nice; x (radius) step is half of it
    const x0 = -(vb.y + vb.h), x1 = -vb.y;
    const frag = document.createDocumentFragment();
    let n = 0;
    for (let z = Math.ceil(vb.x / zStep) * zStep; z <= vb.x + vb.w + 1e-9 && n < MAX_TICKS; z += zStep, n++) {
      frag.appendChild(el('line', { class: 'gv-tick', 'vector-effect': 'non-scaling-stroke', x1: z, y1: -tickLen, x2: z, y2: tickLen }));
      const label = el('text', { class: 'gv-tick-label', x: z, y: tickLen * 1.4 + fs, 'font-size': fs, 'text-anchor': 'middle' });
      label.textContent = fmt(z / factor);
      frag.appendChild(label);
    }
    n = 0;
    for (let x = Math.ceil(x0 / xStep) * xStep; x <= x1 + 1e-9 && n < MAX_TICKS; x += xStep, n++) {
      const y = flip ? x : -x;
      frag.appendChild(el('line', { class: 'gv-tick', 'vector-effect': 'non-scaling-stroke', x1: vb.x, y1: y, x2: vb.x + tickLen, y2: y }));
      const label = el('text', { class: 'gv-tick-label', x: vb.x + tickLen * 1.6, y: y - fs * 0.3, 'font-size': fs, 'text-anchor': 'start' });
      label.textContent = '⌀' + fmt((2 * x) / factor);
      frag.appendChild(label);
    }
    ticksG.replaceChildren(frag);
  }

  function toWorld(clientX, clientY) {
    const m = root.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { z: p.x, x: -p.y };                                   // path space is y = -x
  }

  // R8: hovering or tapping an error marker forces its own line, instead of whatever segment
  // happens to be nearest (which, for a marker at a cycle's start point with no segment of its
  // own, e.g. pq-not-found, can be a different line's approach move).
  function markerLineAt(e) {
    const g = e.target && e.target.closest && e.target.closest('.gv-marker');
    return g && g.dataset.line != null ? Number(g.dataset.line) : null;
  }

  // fit=true (the default) resets the view to the new program; pass false to keep the current pan
  // and zoom, e.g. after an edit or a settings change (item 9).
  function update(result, { fit: shouldFit = true } = {}) {
    lastResult = result;                                          // for relabel() (R6): marker titles on gv:lang
    scene = buildScene(result);
    index = buildIndex(scene.polylines, scene.bounds, 64);
    for (const k of LAYERS) paths[k].setAttribute('d', scene.paths[k]);
    const b = scene.bounds;
    axis.setAttribute('d', `M${b.minZ} 0L${b.maxZ} 0`);
    // Loop-based, not a spread: a long profile can have as many starts/labels as it has cycles,
    // and a spread argument list overflows the stack well before that (item 20).
    const startsFrag = document.createDocumentFragment();
    for (const s of scene.starts) startsFrag.appendChild(el('circle', { class: 'gv-start', cx: s.z, cy: -s.x, r: 1 }));
    starts.replaceChildren(startsFrag);
    const labelsFrag = document.createDocumentFragment();
    for (const l of scene.labels) {
      const tx = el('text', { class: 'gv-label' });
      tx.textContent = l.text; tx.dataset.x = String(l.x); tx.dataset.z = String(l.z);
      labelsFrag.appendChild(tx);
    }
    labelsG.replaceChildren(labelsFrag);
    // Error markers (item 5, spec §5.2): one cross per unsupported/failed cycle block. The <title>
    // names the check, using the matching warning's own params (e.g. the code in cycle-unsupported).
    const markersFrag = document.createDocumentFragment();
    for (const m of scene.markers) {
      const g = el('g', { class: 'gv-marker' });
      g.dataset.line = String(m.line);                             // R8: hovering/tapping forces this line, not the nearest segment's
      const w = result.warnings.find(w => w.line === m.line && w.id === m.id);
      if (checkText) { const title = el('title', {}); title.textContent = checkText(m.id, w ? w.params : {}); g.appendChild(title); }
      const p = el('path', {});
      p.dataset.x = String(m.x); p.dataset.z = String(m.z);
      g.appendChild(p);
      markersFrag.appendChild(g);
    }
    markersG.replaceChildren(markersFrag);
    hi.setAttribute('d', '');
    if (shouldFit || !vb) fit(); else apply();
  }

  // Re-render language/locale-dependent text without touching geometry, pan or zoom (R6): marker
  // titles and (via apply()'s call to renderTicks()) the tick labels' units and decimal separator.
  function relabel() {
    if (scene && lastResult && checkText) {
      const groups = markersG.querySelectorAll('.gv-marker');
      scene.markers.forEach((m, i) => {
        const g = groups[i];
        if (!g) return;
        let title = g.querySelector('title');
        if (!title) { title = el('title', {}); g.insertBefore(title, g.firstChild); }
        const w = lastResult.warnings.find(w => w.line === m.line && w.id === m.id);
        title.textContent = checkText(m.id, w ? w.params : {});
      });
    }
    apply();
  }

  // Analysis failed: leave no stale drawing on screen (item 1).
  function clear() {
    lastResult = null;
    scene = null; index = null; vb = null;
    for (const k of LAYERS) paths[k].removeAttribute('d');
    axis.removeAttribute('d');
    starts.replaceChildren();
    labelsG.replaceChildren();
    ticksG.replaceChildren();
    markersG.replaceChildren();
    hi.setAttribute('d', '');
    svg.removeAttribute('viewBox');
  }

  function fit() { if (scene) { vb = viewBoxFor(scene.fitBounds, 0.06); apply(); } }
  function setAspect(oneToOne) { svg.setAttribute('preserveAspectRatio', oneToOne ? 'xMidYMid meet' : 'none'); apply(); }
  function setFlip(down) { flip = !!down; apply(); }
  function setLayerVisible(layer, on) { if (paths[layer]) paths[layer].style.display = on ? '' : 'none'; }
  function highlight(segIndexes) {
    if (!scene) return;
    hi.setAttribute('d', toPathD(segIndexes.map(i => scene.polylines[i]).filter(Boolean)));
  }

  const MIN_VB_W = 1e-3, MAX_VB_W = 1e6;                        // R3: clamp so no zoom path can hang a tick loop
  // Zoom about a world point by `factor` (>1 zooms out), used by wheel, pinch and the +/- controls.
  // The resulting view width is clamped to [MIN_VB_W, MAX_VB_W]; the effective factor used for both
  // axes is recomputed from the clamped width, so h stays proportional and the zoom stays centred
  // on worldPoint even once clamped.
  function zoomAbout(factor, base, worldPoint) {
    const rawW = base.w * factor;
    const clampedW = Math.min(MAX_VB_W, Math.max(MIN_VB_W, rawW));
    const f = clampedW / base.w;
    const py = -worldPoint.x;
    return { x: worldPoint.z - (worldPoint.z - base.x) * f, y: py - (py - base.y) * f,
      w: base.w * f, h: base.h * f };
  }
  // +/- buttons and keyboard: zoom about the current view centre (item 3).
  function zoomBy(factor) {
    if (!vb) return;
    const centre = { z: vb.x + vb.w / 2, x: -(vb.y + vb.h / 2) };
    vb = zoomAbout(factor, vb, centre);
    apply();
  }

  svg.addEventListener('wheel', e => {
    if (!vb) return;
    e.preventDefault();
    const p = toWorld(e.clientX, e.clientY);
    if (!p) return;
    const s = Math.pow(1.0015, e.deltaY);                         // > 1 zooms out
    vb = zoomAbout(s, vb, p);
    apply();
  }, { passive: false });

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  svg.addEventListener('pointerdown', e => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { svg.setPointerCapture(e.pointerId); } catch (err) { /* no active pointer for this id */ }
    if (pointers.size === 2 && vb) {
      const [a, b] = [...pointers.values()];
      pinch = { d0: dist(a, b), vb0: { ...vb } };
      drag = null;
    } else if (pointers.size === 1 && vb) {
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, vb: { ...vb }, k: worldPerPixel(), moved: false };
    }
  });
  svg.addEventListener('pointermove', e => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // Two-pointer pinch (item 3): zoom by the distance ratio, about the pinch midpoint.
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d1 = dist(a, b);
      if (d1 > 0 && pinch.d0 > 0) {
        const mid = midpoint(a, b);
        const p = toWorld(mid.x, mid.y);
        if (p) { vb = zoomAbout(pinch.d0 / d1, pinch.vb0, p); apply(); }
      }
      return;
    }
    if (drag && drag.id === e.pointerId) {
      const dx = (e.clientX - drag.sx) * drag.k, dy = (e.clientY - drag.sy) * drag.k;
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) drag.moved = true;   // spec: under 4px is a tap/click
      if (drag.moved) { vb = { ...drag.vb, x: drag.vb.x - dx, y: drag.vb.y - (flip ? -dy : dy) }; apply(); return; }
    }
    if (!scene || !onHover) return;
    const p = toWorld(e.clientX, e.clientY);
    if (!p) return;
    onHover(nearestSegment(index, scene.polylines, p, 6 * worldPerPixel()), p, markerLineAt(e));
  });
  // Drop the pointer without treating it as a tap (R2): a gesture the browser cancels (e.g. a
  // scroll takeover) must never pin or unpin a line using the cancel event's coordinates.
  const dropPointer = e => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (drag && drag.id === e.pointerId) drag = null;
  };
  const end = e => {
    const wasDrag = drag && drag.id === e.pointerId && !drag.moved;
    dropPointer(e);
    // A pointerup with under 4px of movement is a click or tap: select like a hover (item 3),
    // which also feeds the click-to-pin behaviour in ui.js (item 11).
    if (wasDrag && vb && scene && onPick) {
      const p = toWorld(e.clientX, e.clientY);
      if (p) onPick(nearestSegment(index, scene.polylines, p, 6 * worldPerPixel()), p, markerLineAt(e));
    }
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', dropPointer);
  svg.addEventListener('pointerleave', () => { if (!drag && onHover) onHover(null, null); });
  svg.addEventListener('keydown', e => {
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(1 / 1.25); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomBy(1.25); }
  });
  window.addEventListener('resize', apply);

  return { update, fit, setAspect, setFlip, setLayerVisible, highlight, clear, zoomBy, relabel };
}
