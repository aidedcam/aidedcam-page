// IFC floor plans: cut segments joined into polylines (spec §5). Pure: no DOM, no web-ifc.
// The worker chains each element's segments on its own, so every wall comes out as its own closed loops.

export const WELD = 5e-4;                  // m: segment ends closer than this are the same point (0.5 mm)
export const COLLINEAR = 1e-5;             // m: a vertex this close to the line through its neighbours is dropped

// segs: [x0, y0, x1, y1, …] in metres. Returns [{ pts: [x, y, …], closed }]: a closed loop lists each corner once.
// Ends are welded within tol; a doubled segment is drawn once; a junction of three or more ends the pieces there.
export function chain(segs, tol = WELD) {
  // Ends are found through a grid of tol-sized cells around the first point (numeric keys: a clash of two cells
  // only costs a distance test).
  const nodes = [], cells = new Map();
  const ox = segs[0], oy = segs[1];
  const nodeOf = (x, y) => {
    const cx = Math.floor((x - ox) / tol), cy = Math.floor((y - oy) / tol);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const list = cells.get((cx + i) * 1048576 + (cy + j));
        if (!list) continue;
        for (const n of list) if (Math.hypot(nodes[n].x - x, nodes[n].y - y) <= tol) return n;
      }
    }
    const n = nodes.length;
    nodes.push({ x, y, edges: [] });
    const key = cx * 1048576 + cy;
    const list = cells.get(key);
    if (list) list.push(n); else cells.set(key, [n]);
    return n;
  };
  const edges = [], seen = new Set();
  for (let i = 0; i + 3 < segs.length; i += 4) {
    const a = nodeOf(segs[i], segs[i + 1]), b = nodeOf(segs[i + 2], segs[i + 3]);
    if (a === b) continue;
    const key = a < b ? a * 4294967296 + b : b * 4294967296 + a;
    if (seen.has(key)) continue;
    seen.add(key);
    const e = edges.length;
    edges.push({ a, b, used: false });
    nodes[a].edges.push(e);
    nodes[b].edges.push(e);
  }
  const out = [];
  const walk = (start, e0) => {
    const ids = [start];
    let at = start, e = e0;
    for (;;) {
      edges[e].used = true;
      at = edges[e].a === at ? edges[e].b : edges[e].a;
      if (at === start) break;
      ids.push(at);
      if (nodes[at].edges.length !== 2) break;
      e = nodes[at].edges.find(x => !edges[x].used);
      if (e === undefined) break;
    }
    let closed = at === start;
    const pts = [];
    for (const n of ids) pts.push(nodes[n].x, nodes[n].y);
    const s = simplify(pts, closed);
    // Overlapping collinear segments (a long one and its halves) close a loop with no area: draw it open.
    if (closed && (s.length < 6 || Math.abs(area(s)) < tol * tol)) closed = false;
    out.push({ pts: s, closed });
  };
  // Open pieces first: from every end and junction. Whatever is left is made of closed loops.
  for (let n = 0; n < nodes.length; n++) {
    if (nodes[n].edges.length === 2) continue;
    for (const e of nodes[n].edges) if (!edges[e].used) walk(n, e);
  }
  for (let n = 0; n < nodes.length; n++) {
    for (const e of nodes[n].edges) if (!edges[e].used) walk(n, e);
  }
  return out;
}

// Signed shoelace area of a closed ring [x, y, …], relative to its first point.
function area(p) {
  let a = 0;
  for (let i = 2; i + 3 < p.length; i += 2) a += (p[i] - p[0]) * (p[i + 3] - p[1]) - (p[i + 2] - p[0]) * (p[i + 1] - p[1]);
  return a / 2;
}

// Is b on the line a–c (within eps) and between them?
function straight(ax, ay, bx, by, cx, cy, eps) {
  const dx = cx - ax, dy = cy - ay, l = Math.hypot(dx, dy);
  if (l === 0) return false;
  if (Math.abs(dx * (by - ay) - dy * (bx - ax)) / l > eps) return false;
  return (bx - ax) * (cx - bx) + (by - ay) * (cy - by) > 0;
}

// Drops the vertices of a straight run (pts: [x, y, …]). A closed polyline's first vertex is checked too.
export function simplify(pts, closed, eps = COLLINEAR) {
  const n = pts.length / 2;
  if (n < 3) return pts.slice();
  const src = closed ? [...pts, pts[0], pts[1]] : pts;
  const m = src.length / 2;
  const out = [src[0], src[1]];
  for (let i = 1; i < m - 1; i++) {
    const k = out.length - 2;
    if (straight(out[k], out[k + 1], src[2 * i], src[2 * i + 1], src[2 * i + 2], src[2 * i + 3], eps)) continue;
    out.push(src[2 * i], src[2 * i + 1]);
  }
  if (!closed) { out.push(src[2 * m - 2], src[2 * m - 1]); return out; }
  const k = out.length;
  if (k >= 6 && straight(out[k - 2], out[k - 1], out[0], out[1], out[2], out[3], eps)) out.splice(0, 2);
  return out;
}

// Polylines gathered for one layer of one storey, packed for the worker's answer:
// { xy: Float64Array, ends: Uint32Array (each polyline's end, in points), closed: Uint8Array }.
export function polylineSet() {
  const xy = [], ends = [], closed = [];
  return {
    add(pts, isClosed) { for (let i = 0; i < pts.length; i++) xy.push(pts[i]); ends.push(xy.length / 2); closed.push(isClosed ? 1 : 0); },
    get count() { return ends.length; },
    pack() { return { xy: Float64Array.from(xy), ends: Uint32Array.from(ends), closed: Uint8Array.from(closed) }; },
  };
}

// Calls fn(pts, closed, i) for each polyline of a packed set; pts is a view [x, y, …] into set.xy.
export function forEachPolyline(set, fn) {
  let start = 0;
  for (let i = 0; i < set.ends.length; i++) {
    const end = set.ends[i];
    fn(set.xy.subarray(2 * start, 2 * end), set.closed[i] === 1, i);
    start = end;
  }
}
