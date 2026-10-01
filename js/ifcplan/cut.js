// IFC floor plans: a triangle mesh cut by horizontal planes (spec §5). Pure: no DOM, no web-ifc.
// The plan looks just above its plane: a vertex on the plane counts as below it. So a triangle lying in the plane
// gives nothing, a slab whose top is at the cut draws nothing, and one whose underside is at the cut draws its
// outline. Every mesh is cut by every plane in one pass.

export const MIN_SEGMENT = 1e-4;           // m: shorter segments are dropped (0.1 mm)
const ON_PLANE = 1e-7;                     // m: a vertex this close above the plane is on it
const pts = new Float64Array(4);

// The point where edge p–q crosses the plane, written at pts[m], pts[m + 1]: from the vertex below (or on the plane)
// towards the one above. dp, dq: heights above the plane; up: whether p is the one above.
function cross(P, p, q, dp, dq, up, m) {
  const lo = up ? q : p, hi = up ? p : q, dl = up ? dq : dp, dh = up ? dp : dq;
  const r = Math.min(1, Math.max(0, -dl / (dh - dl)));
  pts[m] = P[lo] + r * (P[hi] - P[lo]);
  pts[m + 1] = P[lo + 1] + r * (P[hi + 1] - P[lo + 1]);
  return m + 2;
}

// P: [x, y, z, …] in metres, IFC Z-up; ix: triangle indices into P/3; planes: the cut heights (m), in any order.
// Calls onSegment(k, x0, y0, x1, y1) for each segment of plane k; returns how many it gave.
export function cutMesh(P, ix, planes, onSegment) {
  let zmin = Infinity, zmax = -Infinity;
  for (let i = 2; i < P.length; i += 3) { const z = P[i]; if (z < zmin) zmin = z; if (z > zmax) zmax = z; }
  let n = 0;
  for (let k = 0; k < planes.length; k++) {
    const c = planes[k];
    if (!(zmin <= c + ON_PLANE && zmax > c + ON_PLANE)) continue;    // nothing of the mesh is just above the plane
    for (let t = 0; t + 2 < ix.length; t += 3) {
      const a = 3 * ix[t], b = 3 * ix[t + 1], d = 3 * ix[t + 2];
      const da = P[a + 2] - c, db = P[b + 2] - c, dd = P[d + 2] - c;
      const ua = da > ON_PLANE, ub = db > ON_PLANE, ud = dd > ON_PLANE;
      if (ua === ub && ub === ud) continue;                            // all above, or all below or on the plane
      let m = 0;
      if (ua !== ub) m = cross(P, a, b, da, db, ua, m);
      if (ub !== ud) m = cross(P, b, d, db, dd, ub, m);
      if (ud !== ua) cross(P, d, a, dd, da, ud, m);
      // Too short, or from a vertex web-ifc gave as NaN or Infinity: dropped.
      if (!(Math.hypot(pts[2] - pts[0], pts[3] - pts[1]) >= MIN_SEGMENT)) continue;
      if (!(Number.isFinite(pts[0]) && Number.isFinite(pts[1]) && Number.isFinite(pts[2]) && Number.isFinite(pts[3]))) continue;
      onSegment(k, pts[0], pts[1], pts[2], pts[3]);
      n++;
    }
  }
  return n;
}
