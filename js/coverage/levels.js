// Coverage pre-check: which level each space belongs to (spec §5.2). Pure geometry on the engine's outlines.
//   - A space belongs to the level outline that contains its centroid; if two of the same level do, the smaller
//     one wins. If outlines of two different levels do (plans drawn stacked), the space is ambiguous.
//   - A balcony belongs to the level outline nearest to it, if that distance is at most 0.50 m; equally near
//     (within a micrometre) to two different levels, it is ambiguous.
//   - A space that fits no level, or is ambiguous, is reported and left out of every figure; it never goes to a
//     guessed level.

export const BALCONY_REACH = 0.5;             // metres
const TIE = 1e-6;                             // metres: two levels this close to a balcony are equally near

// The outline's ring: the engine's drawn path (metres), closed, as [[x, y], …] without the repeated last point.
export function ringOf(item) {
  const p = (item.path && item.path[0]) || [];
  const ring = [];
  for (let i = 0; i + 1 < p.length; i += 2) ring.push([p[i], p[i + 1]]);
  if (ring.length > 1) {
    const [a, b] = [ring[0], ring[ring.length - 1]];
    if (Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9) ring.pop();
  }
  return ring;
}

// Area centroid of a ring (shoelace), relative to its first point so survey coordinates keep their digits.
export function centroid(ring) {
  if (!ring.length) return [0, 0];
  const [ox, oy] = ring[0];
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[(i + 1) % ring.length];
    const ax = x0 - ox, ay = y0 - oy, bx = x1 - ox, by = y1 - oy;
    const c = ax * by - bx * ay;
    a += c; cx += (ax + bx) * c; cy += (ay + by) * c;
  }
  if (Math.abs(a) < 1e-12) {                                   // degenerate: the mean of the points
    let sx = 0, sy = 0;
    for (const [x, y] of ring) { sx += x; sy += y; }
    return [sx / ring.length, sy / ring.length];
  }
  return [ox + cx / (3 * a), oy + cy / (3 * a)];
}

// Even-odd point in ring.
export function inside([px, py], ring) {
  let s = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) s = !s;
  }
  return s;
}

function segDist([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function segsCross(a, b, c, d) {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

// The smallest distance between two rings: 0 when they overlap or cross.
export function ringDistance(a, b) {
  if (!a.length || !b.length) return Infinity;
  if (inside(a[0], b) || inside(b[0], a)) return 0;
  let best = Infinity;
  for (let i = 0; i < a.length; i++) {
    const a0 = a[i], a1 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const b0 = b[j], b1 = b[(j + 1) % b.length];
      if (segsCross(a0, a1, b0, b1)) return 0;
      best = Math.min(best, segDist(a0, b0, b1), segDist(a1, b0, b1), segDist(b0, a0, a1), segDist(b1, a0, a1));
    }
  }
  return best;
}

// levels: [{ id, level, area, ring }]; spaces: [{ id, role, area, ring }].
// Returns spaces with { level } set, or { level: null, why: 'outside' | 'far' | 'ambiguous' }.
export function assign(levels, spaces) {
  return spaces.map(s => {
    if (s.role === 'balcony') {
      let best = null;
      const near = [];
      for (const l of levels) {
        const d = ringDistance(s.ring, l.ring);
        if (d > BALCONY_REACH + 1e-9) continue;
        near.push({ d, l });
        if (!best || d < best.d - 1e-9 || (Math.abs(d - best.d) <= 1e-9 && l.area < best.l.area)) best = { d, l };
      }
      if (!best) return { ...s, level: null, why: 'far' };
      if (near.some(n => n.l.level !== best.l.level && n.d <= best.d + TIE)) return { ...s, level: null, why: 'ambiguous' };
      return { ...s, level: best.l.level, levelId: best.l.id, distance: best.d };
    }
    const c = centroid(s.ring);
    const hits = levels.filter(l => inside(c, l.ring));
    if (!hits.length) return { ...s, level: null, why: 'outside' };
    if (hits.some(l => l.level !== hits[0].level)) return { ...s, level: null, why: 'ambiguous' };
    const best = hits.reduce((a, l) => (l.area < a.area ? l : a));
    return { ...s, level: best.level, levelId: best.id };
  });
}
