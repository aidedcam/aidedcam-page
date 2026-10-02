// Steel take-off: plates from their NC1 contours (spec §3, §4). A ring is a closed list of { x, y, r } in mm, where r
// is the arc from this point to the next: its centre left of the way for r > 0, right for r < 0, a straight edge for
// 0 (or a radius too small for the chord). The area is exact (shoelace plus circular segments); the polygon puts
// points on the arcs, as the 3D view draws them, and gives the plate's check figure. Pure.
export const DENSITY = 7850;                       // kg/m³, every grade (spec §4)
const KG_PER_MM3 = DENSITY * 1e-9;

// The arc from p to q with radius r: { cx, cy, a0, sweep, radius } (sweep > 0 counter-clockwise), or null for a
// straight edge. Minor arcs only; a chord of exactly 2|r| is a half circle.
export function arcOf(p, q, r) {
  if (!r) return null;
  const dx = q.x - p.x, dy = q.y - p.y, c = Math.hypot(dx, dy), R = Math.abs(r);
  if (!c || c > 2 * R * (1 + 1e-9)) return null;
  const half = Math.asin(Math.min(1, c / (2 * R)));
  const toCentre = Math.sqrt(Math.max(0, R * R - c * c / 4));
  const s = r > 0 ? 1 : -1;                        // centre left (+) or right (−) of p → q
  const cx = (p.x + q.x) / 2 - s * dy / c * toCentre, cy = (p.y + q.y) / 2 + s * dx / c * toCentre;
  return { cx, cy, a0: Math.atan2(p.y - cy, p.x - cx), sweep: s * 2 * half, radius: R };
}

// Signed area (counter-clockwise positive) and length of a ring.
export function ringArea(ring) {
  let a = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const p = ring[i], q = ring[(i + 1) % n];
    a += (p.x * q.y - q.x * p.y) / 2;
    const arc = arcOf(p, q, p.r);
    if (arc) {
      const th = Math.abs(arc.sweep);
      a += Math.sign(p.r) * arc.radius * arc.radius / 2 * (th - Math.sin(th));   // the segment bulges right of p → q for r > 0
    }
  }
  return a;
}
export function ringLength(ring) {
  let l = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const p = ring[i], q = ring[(i + 1) % n], arc = arcOf(p, q, p.r);
    l += arc ? arc.radius * Math.abs(arc.sweep) : Math.hypot(q.x - p.x, q.y - p.y);
  }
  return l;
}

// The ring as a flat polygon [x0, y0, x1, y1, …] (not repeating the first point), arcs cut into steps of at most
// `step` radians.
export function ringPolygon(ring, step = Math.PI / 16) {
  const out = [];
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const p = ring[i], q = ring[(i + 1) % n];
    out.push(p.x, p.y);
    const arc = arcOf(p, q, p.r);
    if (!arc) continue;
    const k = Math.max(2, Math.ceil(Math.abs(arc.sweep) / step));
    for (let j = 1; j < k; j++) {
      const a = arc.a0 + arc.sweep * j / k;
      out.push(arc.cx + arc.radius * Math.cos(a), arc.cy + arc.radius * Math.sin(a));
    }
  }
  return out;
}
export function polygonArea(xy) {
  let a = 0;
  const n = xy.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += xy[2 * i] * xy[2 * j + 1] - xy[2 * j] * xy[2 * i + 1];
  }
  return a / 2;
}
export function polygonBox(xy) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < xy.length; i += 2) {
    x0 = Math.min(x0, xy[i]); x1 = Math.max(x1, xy[i]);
    y0 = Math.min(y0, xy[i + 1]); y1 = Math.max(y1, xy[i + 1]);
  }
  return x0 <= x1 ? { x0, y0, x1, y1 } : { x0: 0, y0: 0, x1: 0, y1: 0 };
}

// A hole's area and bore length in its face: a round hole, or a slot (the hole drawn out by l). A hole shallower
// than the face counts for its depth only.
export function holeArea(h, t) {
  const a = Math.PI * h.d * h.d / 4 + (h.slot ? h.slot.l * h.d : 0);
  return h.depth > 0 && h.depth < t ? a * h.depth / t : a;
}
export const holeEdge = h => Math.PI * h.d + (h.slot ? 2 * h.slot.l : 0);

// A plate: outer ring, inner rings, holes ({ d, depth, slot }) and thickness t (mm). Returns the net face area
// (mm²), the edge length (mm, outer + inner + bores), kg, m² (both faces + edges × t, spec §4) and the outline's
// box. check: the same from the polygons (the 3D build's figure), in kg.
export function plateFigures({ outer, inner = [], holes = [], t }) {
  const net = Math.abs(ringArea(outer)) - inner.reduce((a, r) => a + Math.abs(ringArea(r)), 0) - holes.reduce((a, h) => a + holeArea(h, t), 0);
  const edge = ringLength(outer) + inner.reduce((a, r) => a + ringLength(r), 0) + holes.reduce((a, h) => a + holeEdge(h), 0);
  const poly = ringPolygon(outer);
  const polyNet = Math.abs(polygonArea(poly)) - inner.reduce((a, r) => a + Math.abs(polygonArea(ringPolygon(r))), 0) - holes.reduce((a, h) => a + holeArea(h, t), 0);
  return { area: net, edge, kg: net * t * KG_PER_MM3, m2: (2 * net + edge * t) * 1e-6, check: polyNet * t * KG_PER_MM3, box: polygonBox(poly) };
}
