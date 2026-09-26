// Plane geometry in the lathe X–Z plane. Z is horizontal (right), X is vertical (up), X is a radius.
// Arc direction rule verified on production lathe programs (our internal gcode-reviewer-plan.md):
// G3 = CCW, G2 = CW when viewed with Z right and X up.
export const EPS = 1e-9;

// Centre from the R word. r < 0 selects the long (> 180°) arc, as on Fanuc.
export function arcFromR(from, to, r, ccw) {
  const dz = to.z - from.z, dx = to.x - from.x;
  const d = Math.hypot(dz, dx);
  if (d < EPS || !Number.isFinite(r) || r === 0) return null;
  const R = Math.abs(r);
  const h2 = R * R - (d / 2) * (d / 2);
  const h = h2 > 0 ? Math.sqrt(h2) : 0;            // R shorter than half the chord: use the midpoint
  const mz = (from.z + to.z) / 2, mx = (from.x + to.x) / 2;
  const nz = -dx / d, nx = dz / d;                  // left normal of the chord, in (z, x) components
  let side = ccw ? 1 : -1;                          // a CCW arc turns left: centre on the left
  if (r < 0) side = -side;
  return { cz: mz + side * h * nz, cx: mx + side * h * nx, r: Math.max(R, d / 2), ccw };
}

// Centre from I/K: incremental from the start point; on lathes I is always a radius value.
export function arcFromIK(from, i, k, ccw) {
  const cx = from.x + i, cz = from.z + k;
  return { cx, cz, r: Math.hypot(from.x - cx, from.z - cz), ccw };
}

// Signed sweep in radians: positive for CCW, negative for CW. Equal endpoints = full circle.
export function arcSweep(from, to, arc) {
  const a0 = Math.atan2(from.x - arc.cx, from.z - arc.cz);
  const a1 = Math.atan2(to.x - arc.cx, to.z - arc.cz);
  let s = a1 - a0;
  if (arc.ccw) { while (s <= 0) s += 2 * Math.PI; if (s > 2 * Math.PI) s -= 2 * Math.PI; }
  else { while (s >= 0) s -= 2 * Math.PI; if (s < -2 * Math.PI) s += 2 * Math.PI; }
  return s;
}

export function sampleArc(from, to, arc, n) {
  const a0 = Math.atan2(from.x - arc.cx, from.z - arc.cz);
  const sweep = arcSweep(from, to, arc);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    if (i === 0) { pts.push({ x: from.x, z: from.z }); continue; }
    if (i === n) { pts.push({ x: to.x, z: to.z }); continue; }
    const a = a0 + sweep * (i / n);
    pts.push({ x: arc.cx + arc.r * Math.sin(a), z: arc.cz + arc.r * Math.cos(a) });
  }
  return pts;
}

export function segmentLength(seg) {
  if (seg.arc) return Math.abs(arcSweep(seg.from, seg.to, seg.arc)) * seg.arc.r;
  return Math.hypot(seg.to.x - seg.from.x, seg.to.z - seg.from.z);
}

export function flatten(body, n = 48) {
  const out = [];
  for (const s of body) {
    if (s.arc) {
      const pts = sampleArc(s.from, s.to, s.arc, n);
      for (let i = 1; i < pts.length; i++) out.push({ x1: pts[i - 1].x, z1: pts[i - 1].z, x2: pts[i].x, z2: pts[i].z });
    } else {
      out.push({ x1: s.from.x, z1: s.from.z, x2: s.to.x, z2: s.to.z });
    }
  }
  return out;
}

// Port of our desktop G71PassPlanner.FindFirstIntrusionZ in a normalised frame:
// d = depth axis, c = cut axis. Walking from the entry toward smaller c, returns the c where the
// contour FIRST rises above `target` in d; `fallbackC` when nothing in [fallbackC, startC] intrudes.
// Tangent contact (d == target within 0.001) is not an intrusion.
export function firstIntrusion(segs, target, startC, fallbackC) {
  const dEps = 0.001, cTol = 0.001;
  let best = -Infinity;
  for (const s of segs) {
    let hiC, hiD, loC, loD;
    if (s.c1 >= s.c2) { hiC = s.c1; hiD = s.d1; loC = s.c2; loD = s.d2; }
    else { hiC = s.c2; hiD = s.d2; loC = s.c1; loD = s.d1; }
    const hiIn = hiD > target + dEps, loIn = loD > target + dEps;
    if (!hiIn && !loIn) continue;
    const cross = (hiIn || hiC - loC <= cTol) ? hiC : hiC + (target - hiD) / (loD - hiD) * (loC - hiC);
    if (cross > startC + cTol) continue;
    if (cross > best) best = cross;
  }
  return best > fallbackC ? best : fallbackC;
}

export function pointSegmentDistance(p, a, b) {
  const vz = b.z - a.z, vx = b.x - a.x;
  const len2 = vz * vz + vx * vx;
  let t = len2 > 0 ? ((p.z - a.z) * vz + (p.x - a.x) * vx) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.z - (a.z + t * vz), p.x - (a.x + t * vx));
}
