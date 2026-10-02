// Steel take-off: one NC1 piece as slabs for the 3D view (spec §3). Pure, and Node-tested: view3d.js only turns each
// slab into a three.js extrusion. A slab is a flat outline with holes, in its own (u, v) plane, extruded along w by
// its depth, placed by its frame { o, u, v, w } in the piece's axes: x along the length, y across the width, z up,
// all in mm. A profile is its faces (web, flanges, legs, walls) each as a slab with that face's outline (its AK
// contour, else a rectangle whose ends follow the header's cut angles), its IK contours and its BO holes; a plate is
// one slab; a tube, a bar or a special profile is its section extruded along the length.
import { ringPolygon } from './plate.js?v=20261104';
import { plateDims } from './section.js?v=20261104';

const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1], NY = [0, -1, 0];
const STEP = Math.PI / 12;

// A circle as a flat polygon, counter-clockwise.
export function circle(cx, cy, r, n = 24) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; out.push(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
  return out;
}

// A rectangle 0..L × 0..w whose two ends lean by the cut angles (degrees from square): each end moves by
// tan(angle) × w across the face, kept inside 0..L.
export function cutRect(L, w, start = 0, end = 0) {
  const s = Math.max(-L / 2, Math.min(L / 2, Math.tan(start * Math.PI / 180) * w));
  const e = Math.max(-L / 2, Math.min(L / 2, Math.tan(end * Math.PI / 180) * w));
  return [Math.max(0, s), 0, L - Math.max(0, e), 0, L - Math.max(0, -e), w, Math.max(0, -s), w];
}

// The faces of each profile code: [face letters, frame, outline width, thickness] (frames in mm from the header).
function faces(p) {
  const { h, b } = p, tw = p.tw || p.tf, tf = p.tf || p.tw;
  switch (p.code) {
    case 'I': return [[['v', 'h'], { o: [0, b / 2 + tw / 2, 0], u: X, v: Z, w: NY }, h, tw, 'web'],
      [['o'], { o: [0, 0, h - tf], u: X, v: Y, w: Z }, b, tf, 'flange'], [['u'], { o: [0, 0, 0], u: X, v: Y, w: Z }, b, tf, 'flange']];
    case 'U': case 'C': return [[['v', 'h'], { o: [0, tw, 0], u: X, v: Z, w: NY }, h, tw, 'web'],
      [['o'], { o: [0, 0, h - tf], u: X, v: Y, w: Z }, b, tf, 'flange'], [['u'], { o: [0, 0, 0], u: X, v: Y, w: Z }, b, tf, 'flange']];
    case 'T': return [[['v', 'h'], { o: [0, b / 2 + tw / 2, 0], u: X, v: Z, w: NY }, h, tw, 'web'],
      [['o', 'u'], { o: [0, 0, h - tf], u: X, v: Y, w: Z }, b, tf, 'flange']];
    case 'L': return [[['v', 'h'], { o: [0, tw, 0], u: X, v: Z, w: NY }, h, tw, 'web'],
      [['o', 'u'], { o: [0, 0, 0], u: X, v: Y, w: Z }, b > 0 ? b : h, tw, 'flange']];
    case 'M': return [[['v'], { o: [0, tw, 0], u: X, v: Z, w: NY }, h, tw, 'web'], [['h'], { o: [0, b, 0], u: X, v: Z, w: NY }, h, tw, 'web'],
      [['o'], { o: [0, 0, h - tw], u: X, v: Y, w: Z }, b, tw, 'flange'], [['u'], { o: [0, 0, 0], u: X, v: Y, w: Z }, b, tw, 'flange']];
    default: return [];
  }
}

const holePolygon = hole => (hole.slot
  ? ringPolygon([{ x: hole.x, y: hole.y - hole.d / 2, r: 0 }, { x: hole.x + hole.slot.l, y: hole.y - hole.d / 2, r: hole.d / 2 },
    { x: hole.x + hole.slot.l, y: hole.y + hole.d / 2, r: 0 }, { x: hole.x, y: hole.y + hole.d / 2, r: hole.d / 2 }], STEP)
  : circle(hole.x, hole.y, hole.d / 2));

// Sutherland-Hodgman clip against a half-plane: v >= vBound (if isGreaterThan) or v <= vBound.
function clipAgainstHalfPlane(polygon, vBound, isGreaterThan) {
  const result = [];
  for (let i = 0; i < polygon.length; i += 2) {
    const x1 = polygon[i], y1 = polygon[i + 1];
    const x2 = polygon[(i + 2) % polygon.length], y2 = polygon[(i + 3) % polygon.length];
    const v1In = isGreaterThan ? y1 >= vBound : y1 <= vBound;
    const v2In = isGreaterThan ? y2 >= vBound : y2 <= vBound;
    if (v2In) {
      if (!v1In) {
        const t = (vBound - y1) / (y2 - y1);
        result.push(x1 + t * (x2 - x1), vBound);
      }
      result.push(x2, y2);
    } else if (v1In) {
      const t = (vBound - y1) / (y2 - y1);
      result.push(x1 + t * (x2 - x1), vBound);
    }
  }
  // Deduplicate consecutive points.
  const deduped = [];
  for (let i = 0; i < result.length; i += 2) {
    if (deduped.length === 0 || deduped[deduped.length - 2] !== result[i] || deduped[deduped.length - 1] !== result[i + 1]) {
      deduped.push(result[i], result[i + 1]);
    }
  }
  if (deduped.length > 2 && deduped[0] === deduped[deduped.length - 2] && deduped[1] === deduped[deduped.length - 1]) deduped.length -= 2;
  return deduped;
}

// Clip a polygon outline against a horizontal band vMin ≤ v ≤ vMax.
function clipOutlineToVRange(polygon, vMin, vMax) {
  let poly = clipAgainstHalfPlane(polygon, vMin, true);
  if (poly.length < 6) return [];
  poly = clipAgainstHalfPlane(poly, vMax, false);
  return poly.length < 6 ? [] : poly;
}

// The slabs of a parsed NC1 piece: [{ outline: [x, y, …], holes: [[x, y, …]], depth, frame, part }], part being
// 'web', 'flange', 'plate' or 'body' (for the colours). Returns [] when the header has no usable dimensions.
export function pieceSlabs(p) {
  const L = p.length;
  if (!(L > 0)) return [];
  const contours = face => p.contours.filter(c => c.face === face || (face === 'v' && !c.face));
  if (p.code === 'B') {
    const { t, w } = plateDims(p);
    if (!(t > 0)) return [];
    const ak = contours('v').filter(c => c.kind === 'AK');
    const outer = ak.length ? ringPolygon(ak.reduce((a, c) => (c.pts.length > a.pts.length ? c : a)).pts, STEP) : [0, 0, L, 0, L, w, 0, w];
    const holes = [...contours('v').filter(c => c.kind === 'IK').map(c => ringPolygon(c.pts, STEP)), ...p.holes.map(holePolygon)];
    return [{ outline: outer, holes, depth: t, frame: { o: [0, 0, 0], u: X, v: Y, w: Z }, part: 'plate' }];
  }
  if (p.code === 'RO' || p.code === 'RU') {
    const D = p.h, t = p.tw || p.tf;
    if (!(D > 0)) return [];
    const holes = p.code === 'RO' && t > 0 && 2 * t < D ? [circle(D / 2, D / 2, D / 2 - t, 32)] : [];
    return [{ outline: circle(D / 2, D / 2, D / 2, 32), holes, depth: L, frame: { o: [0, 0, 0], u: Y, v: Z, w: X }, part: 'body' }];
  }
  const list = faces(p);
  if (!list.length || !list.every(([, , w, t]) => w > 0 && t > 0)) {
    // A special profile (or one without its dimensions): its box, h × b.
    return p.h > 0 && p.b > 0 ? [{ outline: [0, 0, p.b, 0, p.b, p.h, 0, p.h], holes: [], depth: L, frame: { o: [0, 0, 0], u: Y, v: Z, w: X }, part: 'body' }] : [];
  }
  const { h, b } = p, tw = p.tw || p.tf, tf = p.tf || p.tw;
  return list.map(([letters, frame, w, t, part]) => {
    const own = p.contours.filter(c => letters.includes(c.face));
    const ak = own.filter(c => c.kind === 'AK');
    const web = part === 'web';
    let outline = ak.length ? ringPolygon(ak.reduce((a, c) => (c.pts.length > a.pts.length ? c : a)).pts, STEP)
      : cutRect(L, w, web ? p.webStart : p.flangeStart, web ? p.webEnd : p.flangeEnd);

    // Determine clear range for web to avoid overlap with flanges
    let clearRange = null;
    if (web) {
      switch (p.code) {
        case 'I': case 'U': case 'C': if (tf > 0) clearRange = [tf, h - tf]; break;
        case 'L': clearRange = [tw, h]; break;
        case 'T': if (tf > 0) clearRange = [0, h - tf]; break;
        case 'M': if (tw > 0) clearRange = [tw, h - tw]; break;
      }
    }
    // Clip outline to clear range with Sutherland-Hodgman to preserve sloped cuts.
    if (clearRange) {
      const [vMin, vMax] = clearRange;
      outline = clipOutlineToVRange(outline, vMin, vMax);
      if (outline.length === 0) return null; // Slab omitted if clipping empties the outline.
    }

    let holes = [...own.filter(c => c.kind === 'IK').map(c => ringPolygon(c.pts, STEP)), ...p.holes.filter(hl => letters.includes(hl.face)).map(holePolygon)];

    // Filter holes for web: keep only those whose centre lies in the clear range.
    if (clearRange) {
      const [vMin, vMax] = clearRange;
      holes = holes.filter(hole => {
        const n = hole.length / 2;
        const cy = hole.reduce((sum, v, i) => i % 2 === 1 ? sum + v : sum, 0) / n;
        return cy >= vMin && cy <= vMax;
      });
    }
    return { outline, holes, depth: t, frame, part };
  }).filter(x => x !== null);
}

// The slabs' box in the piece's axes: { min: [x, y, z], max: [x, y, z] } (for the camera).
export function slabsBox(slabs) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const s of slabs) {
    const { o, u, v, w } = s.frame;
    for (let i = 0; i < s.outline.length; i += 2) {
      for (const d of [0, s.depth]) {
        for (let c = 0; c < 3; c++) {
          const x = o[c] + u[c] * s.outline[i] + v[c] * s.outline[i + 1] + w[c] * d;
          if (x < min[c]) min[c] = x;
          if (x > max[c]) max[c] = x;
        }
      }
    }
  }
  return min[0] <= max[0] ? { min, max } : { min: [0, 0, 0], max: [0, 0, 0] };
}
