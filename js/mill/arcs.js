// G2/G3 in the G17/G18/G19 planes, from I/J/K or R, with helical motion on the third axis (spec §4).
// Pure. Coordinates are {x, y, z} in mm.
//
// Each plane is named by its two in-plane axes (a, b), chosen so that a × b points along the plane
// normal: G17 (x, y) → z, G18 (z, x) → y, G19 (y, z) → x. G3 is then counter-clockwise in (a, b)
// as seen from the positive normal, as Fanuc and Haas define it, and G2 is clockwise.
export const PLANES = {
  17: { a: 'x', b: 'y', l: 'z', ia: 'I', ib: 'J' },
  18: { a: 'z', b: 'x', l: 'y', ia: 'K', ib: 'I' },
  19: { a: 'y', b: 'z', l: 'x', ia: 'J', ib: 'K' },
};

const TAU = Math.PI * 2;

// Positive sweep in (0, 2π], or 2π when start and end coincide (a full circle).
function ccwSweep(t0, t1, full) {
  let d = t1 - t0;
  while (d <= 1e-12) d += TAU;
  while (d > TAU) d -= TAU;
  return full ? TAU : d;
}

// centre: { ca, cb } in the plane, or null to use r. Returns
// { points: [{x,y,z}, ...] ending exactly at `to`, length, radius, error: null | 'radius' }.
// On 'radius' the arc is still drawn, with its radius blended from the start to the end radius, so
// the path stays continuous and ends where the program says.
export function arcPath(from, to, { plane = 17, ccw, centre = null, r = null }, s) {
  const P = PLANES[plane];
  const fa = from[P.a], fb = from[P.b], ta = to[P.a], tb = to[P.b];
  let ca, cb, error = null;
  const same = Math.hypot(ta - fa, tb - fb) < 1e-9;

  if (centre) {
    ca = centre.ca; cb = centre.cb;
  } else {
    const R = Math.abs(r);
    const ma = (fa + ta) / 2, mb = (fb + tb) / 2;
    const ua = ta - fa, ub = tb - fb;
    const d = Math.hypot(ua, ub);
    if (same || !(R > 0) || d > 2 * R + s.arcTolerance) {
      return { points: [{ ...to }], length: Math.hypot(ta - fa, tb - fb, to[P.l] - from[P.l]), radius: R, error: 'radius' };
    }
    const h = Math.sqrt(Math.max(0, R * R - (d / 2) * (d / 2)));
    // Left of the chord for a counter-clockwise minor arc (R > 0), right for a clockwise one;
    // a negative R asks for the major arc, which flips the side.
    const side = (ccw ? 1 : -1) * (r > 0 ? 1 : -1);
    ca = ma + side * (-ub / d) * h;
    cb = mb + side * (ua / d) * h;
  }

  const r0 = Math.hypot(fa - ca, fb - cb);
  const r1 = Math.hypot(ta - ca, tb - cb);
  if (Math.abs(r0 - r1) > s.arcTolerance) error = 'radius';
  const t0 = Math.atan2(fb - cb, fa - ca);
  const t1 = Math.atan2(tb - cb, ta - ca);
  const full = centre !== null && same;
  const sweep = ccw ? ccwSweep(t0, t1, full) : -ccwSweep(t1, t0, full);

  const rMax = Math.max(r0, r1, 1e-9);
  const step = 2 * Math.acos(Math.max(-1, 1 - s.chordError / rMax));
  const n = Math.min(s.maxChords, Math.max(1, Math.ceil(Math.abs(sweep) / step)));
  const dl = to[P.l] - from[P.l];
  const points = [];
  for (let i = 1; i <= n; i++) {
    if (i === n) { points.push({ ...to }); break; }
    const f = i / n, t = t0 + sweep * f, rr = r0 + (r1 - r0) * f;
    const p = { x: 0, y: 0, z: 0 };
    p[P.a] = ca + rr * Math.cos(t);
    p[P.b] = cb + rr * Math.sin(t);
    p[P.l] = from[P.l] + dl * f;
    points.push(p);
  }
  const arcLen = ((r0 + r1) / 2) * Math.abs(sweep);
  return { points, length: Math.hypot(arcLen, dl), radius: r0, error };
}
