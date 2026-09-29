// DWG quantities: picking in the drawing and the totals of a selection (spec §5 Selection). Everything
// works on the engine's items[] in drawing coordinates (m), so a selection never calls the engine.
// Pure: no DOM. A uniform grid over the items' bounding boxes keeps hit-tests fast on large drawings.
import { cmpName } from './tables.js?v=20260930';

const CURVES = new Set(['line', 'arc', 'circle', 'polyline', 'spline', 'ellipse']);
const MAX_CELLS_PER_ITEM = 4096;          // bigger items (a site boundary, a big hatch) are always candidates

function pathBox(path) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const pl of path || []) for (let i = 0; i + 1 < pl.length; i += 2) {
    const x = pl[i], y = pl[i + 1];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x0 <= x1 ? [x0, y0, x1, y1] : null;
}

// The grid. cellSize defaults to 1/64 of the drawing's larger side.
export function createIndex(items, cellSize) {
  const boxes = items.map(it => pathBox(it.path));
  let X0 = Infinity, Y0 = Infinity, X1 = -Infinity, Y1 = -Infinity;
  for (const b of boxes) if (b) { X0 = Math.min(X0, b[0]); Y0 = Math.min(Y0, b[1]); X1 = Math.max(X1, b[2]); Y1 = Math.max(Y1, b[3]); }
  if (!(X0 <= X1)) { X0 = Y0 = 0; X1 = Y1 = 1; }
  let cell = cellSize > 0 ? cellSize : Math.max(X1 - X0, Y1 - Y0) / 64;
  if (!(cell > 0)) cell = 1;
  const nx = Math.max(1, Math.floor((X1 - X0) / cell) + 1), ny = Math.max(1, Math.floor((Y1 - Y0) / cell) + 1);
  const cells = new Map(), big = [];
  const cx = x => Math.min(nx - 1, Math.max(0, Math.floor((x - X0) / cell)));
  const cy = y => Math.min(ny - 1, Math.max(0, Math.floor((y - Y0) / cell)));
  boxes.forEach((b, i) => {
    if (!b) return;
    const i0 = cx(b[0]), i1 = cx(b[2]), j0 = cy(b[1]), j1 = cy(b[3]);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > MAX_CELLS_PER_ITEM) { big.push(i); return; }
    for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) {
      const key = j * nx + k;
      const list = cells.get(key);
      if (list) list.push(i); else cells.set(key, [i]);
    }
  });
  const stamp = new Int32Array(items.length);
  let q = 0;
  return {
    // Candidate items whose box may touch the rectangle (deduplicated).
    query(x0, y0, x1, y1) {
      if (x0 > x1) [x0, x1] = [x1, x0];
      if (y0 > y1) [y0, y1] = [y1, y0];
      q++;
      const out = [];
      for (const i of big) { stamp[i] = q; out.push(i); }
      if (x1 < X0 || y1 < Y0 || x0 > X1 || y0 > Y1) return out;
      const i0 = cx(x0), i1 = cx(x1), j0 = cy(y0), j1 = cy(y1);
      for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) {
        const list = cells.get(j * nx + k);
        if (list) for (const i of list) if (stamp[i] !== q) { stamp[i] = q; out.push(i); }
      }
      return out;
    },
    bboxOf(i) { return boxes[i]; },
  };
}

function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = ax + t * dx - px, ey = ay + t * dy - py;
  return ex * ex + ey * ey;
}

function minDist2(path, x, y) {
  let d = Infinity;
  for (const pl of path) {
    if (pl.length === 2) d = Math.min(d, (pl[0] - x) ** 2 + (pl[1] - y) ** 2);
    for (let i = 0; i + 3 < pl.length; i += 2) d = Math.min(d, segDist2(x, y, pl[i], pl[i + 1], pl[i + 2], pl[i + 3]));
  }
  return d;
}

// Even-odd over all loops of the path, so a hatch's islands are holes.
function insidePath(path, x, y) {
  let inside = false;
  for (const pl of path) {
    const n = pl.length;
    for (let i = 0, j = n - 2; i + 1 < n; j = i, i += 2) {
      const xi = pl[i], yi = pl[i + 1], xj = pl[j], yj = pl[j + 1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

// Items that can be clicked inside: hatches and closed curves with a trusted area.
const isFilled = it => it.kind === 'hatch' ? !it.bad : CURVES.has(it.kind) && it.area > 0 && !it.bad;

// The item under a click: the nearest edge within tol; failing that, the smallest filled item around the point.
export function pick(index, items, x, y, tol) {
  let best = -1, bestD = tol * tol, inner = -1, innerArea = Infinity;
  // Ties go to the lower index, so the answer doesn't depend on the grid's candidate order.
  for (const i of index.query(x - tol, y - tol, x + tol, y + tol)) {
    const it = items[i];
    const d = minDist2(it.path || [], x, y);
    if (d < bestD || (d === bestD && (best < 0 || i < best))) { best = i; bestD = d; continue; }
    if (d <= tol * tol || !isFilled(it)) continue;
    if ((it.area < innerArea || (it.area === innerArea && i < inner)) && insidePath(it.path, x, y)) { inner = i; innerArea = it.area; }
  }
  return best >= 0 ? best : inner;
}

// Does segment a–b touch the rectangle? (Liang–Barsky clip.)
function segHitsBox(ax, ay, bx, by, x0, y0, x1, y1) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay;
  const edges = [[-dx, ax - x0], [dx, x1 - ax], [-dy, ay - y0], [dy, y1 - ay]];
  for (const [p, q] of edges) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return true;
}

function pathHitsBox(path, x0, y0, x1, y1) {
  for (const pl of path) {
    if (pl.length === 2 && pl[0] >= x0 && pl[0] <= x1 && pl[1] >= y0 && pl[1] <= y1) return true;
    for (let i = 0; i + 3 < pl.length; i += 2) if (segHitsBox(pl[i], pl[i + 1], pl[i + 2], pl[i + 3], x0, y0, x1, y1)) return true;
  }
  return false;
}

// Window: items entirely inside the box. Crossing: items the box touches, or a filled item the box sits in.
export function selectBox(index, items, x0, y0, x1, y1, mode) {
  if (x0 > x1) [x0, x1] = [x1, x0];
  if (y0 > y1) [y0, y1] = [y1, y0];
  const out = [];
  for (const i of index.query(x0, y0, x1, y1)) {
    const b = index.bboxOf(i);
    if (!b) continue;
    if (mode === 'window') {
      if (b[0] >= x0 && b[2] <= x1 && b[1] >= y0 && b[3] <= y1) out.push(i);
      continue;
    }
    if (b[2] < x0 || b[0] > x1 || b[3] < y0 || b[1] > y1) continue;
    const it = items[i];
    if (pathHitsBox(it.path || [], x0, y0, x1, y1) || (isFilled(it) && insidePath(it.path, (x0 + x1) / 2, (y0 + y1) / 2))) out.push(i);
  }
  return out.sort((a, b) => a - b);
}

// What the Selection panel shows: per layer, the lengths and areas; per block name, the count.
export function selectionTotals(items, indices) {
  const layers = new Map(), blocks = new Map();
  for (const i of indices) {
    const it = items[i];
    if (it.kind === 'insert') {
      const name = it.block || '?';
      blocks.set(name, (blocks.get(name) || 0) + (it.copies || 1));
      continue;
    }
    let l = layers.get(it.layer);
    if (!l) layers.set(it.layer, l = { name: it.layer, len: 0, area: 0, hatchArea: 0, bad: 0 });
    if (it.bad) { l.bad++; if (CURVES.has(it.kind)) l.len += it.len || 0; continue; }
    if (it.kind === 'hatch') l.hatchArea += it.area || 0;
    else if (CURVES.has(it.kind)) { l.len += it.len || 0; if (it.area > 0) l.area += it.area; }
  }
  return {
    layers: [...layers.values()].sort((a, b) => cmpName(a.name, b.name)),
    blocks: [...blocks.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => cmpName(a.name, b.name)),
    items: indices.length,
  };
}

// The Copy button: tab-separated, no digit grouping, and the decimal separator the visitor's spreadsheet
// expects (',' for a Greek or Italian Excel, which would read '85.600' as 85600), so it pastes as numbers.
export function selectionTsv(totals, t, dec = '.') {
  const f = v => v.toFixed(3).replace('.', dec);
  const lines = [[t('dq.col.layer'), t('dq.col.len'), t('dq.col.area'), t('dq.col.hatchArea')].join('\t')];
  let len = 0, area = 0, hatch = 0;
  for (const l of totals.layers) {
    lines.push([l.name, f(l.len), f(l.area), f(l.hatchArea)].join('\t'));
    len += l.len; area += l.area; hatch += l.hatchArea;
  }
  if (totals.layers.length) lines.push([t('dq.total'), f(len), f(area), f(hatch)].join('\t'));
  if (totals.blocks.length) {
    lines.push('', [t('dq.col.block'), t('dq.col.count')].join('\t'));
    for (const b of totals.blocks) lines.push([b.name, String(b.count)].join('\t'));
  }
  return lines.join('\n') + '\n';
}
