// IFC floor plans: room labels (spec §5). Pure: no DOM, no web-ifc. Outlines are [x, y, …] in metres.

// The area of a closed outline, whichever way it runs. Relative to its first point, so georeferenced coordinates
// (millions of metres) keep their precision.
export function shoelace(pts) {
  let s = 0;
  const n = pts.length, x0 = pts[0], y0 = pts[1];
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n;
    s += (pts[i] - x0) * (pts[j + 1] - y0) - (pts[j] - x0) * (pts[i + 1] - y0);
  }
  return Math.abs(s) / 2;
}

// Is (x, y) inside the outline (even-odd)?
export function inside(x, y, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// The room's own holes: the closed loops of its cut ([{ pts, closed }]) with every vertex inside the outline, such as
// a column or a shaft. The outline itself is never one: its topmost vertex is not inside it.
export function holesOf(polylines, outline) {
  const out = [];
  for (const p of polylines || []) {
    if (!p.closed || p.pts.length < 6) continue;
    let all = true;
    for (let i = 0; all && i < p.pts.length; i += 2) all = inside(p.pts[i], p.pts[i + 1], outline);
    if (all) out.push(p.pts);
  }
  return out;
}

// The room's area in m²: Qto_SpaceBaseQuantities' NetFloorArea, else its GrossFloorArea (both already in m²), else
// the outline's shoelace area less the holes among the room cut's loops. qto: { net?, gross? }.
export function roomArea(qto, outline, loops = []) {
  for (const v of [qto && qto.net, qto && qto.gross]) if (Number.isFinite(v) && v > 0) return { areaM2: v, areaFrom: 'qto' };
  if (outline && outline.length >= 6) {
    let a = shoelace(outline);
    for (const h of holesOf(loops, outline)) a -= shoelace(h);
    return { areaM2: a, areaFrom: 'outline' };
  }
  return { areaM2: null, areaFrom: null };
}

// The largest closed loop of a room's cut ([{ pts, closed }]), or [] when the cut closed none.
export function outlineOf(polylines) {
  let best = [], area = 0;
  for (const p of polylines) {
    if (!p.closed || p.pts.length < 6) continue;
    const a = shoelace(p.pts);
    if (a > area) { area = a; best = p.pts; }
  }
  return Array.from(best);
}

const oneLine = s => String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();

// The label's lines: Name, then LongName when both are present and differ (Revit puts the number in Name and the
// name in LongName), then the area, e.g. "24.50 m²".
export function labelLines({ name, longName, areaM2 }) {
  const lines = [];
  const a = oneLine(name), b = oneLine(longName);
  if (a) lines.push(a);
  if (b && b !== a) lines.push(b);
  if (Number.isFinite(areaM2)) lines.push(`${areaM2.toFixed(2)} m²`);
  return lines;
}

// Signed distance from (x, y) to the outline: positive inside.
function distance(x, y, pts) {
  let d = Infinity;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const ax = pts[j], ay = pts[j + 1], bx = pts[i], by = pts[i + 1];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
    d = Math.min(d, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return inside(x, y, pts) ? d : -d;
}

// A point well inside the outline, for the label: the pole of inaccessibility, found by refining square cells
// (the polylabel method) to within `precision` metres.
export function labelPoint(pts, precision = 0.01) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]);
    y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]);
  }
  const size = Math.min(x1 - x0, y1 - y0);
  if (!(size > 0)) return [(x0 + x1) / 2 || 0, (y0 + y1) / 2 || 0];
  const cell = (x, y, h) => { const d = distance(x, y, pts); return { x, y, h, d, max: d + h * Math.SQRT2 }; };
  // A max-heap on each cell's best possible distance.
  const heap = [];
  const push = c => {
    heap.push(c);
    for (let i = heap.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (heap[p].max >= heap[i].max) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l].max > heap[m].max) m = l;
        if (r < heap.length && heap[r].max > heap[m].max) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  for (let x = x0; x < x1; x += size) for (let y = y0; y < y1; y += size) push(cell(x + size / 2, y + size / 2, size / 2));
  let best = cell((x0 + x1) / 2, (y0 + y1) / 2, 0);
  while (heap.length) {
    const c = pop();
    if (c.d > best.d) best = c;
    if (c.max - best.d <= precision) break;              // no cell left can do better
    const h = c.h / 2;
    push(cell(c.x - h, c.y - h, h)); push(cell(c.x + h, c.y - h, h)); push(cell(c.x - h, c.y + h, h)); push(cell(c.x + h, c.y + h, h));
  }
  return [best.x, best.y];
}
