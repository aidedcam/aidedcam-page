// Pure drawing scene: layers, SVG path strings, bounds, hover index. SVG user space: x = Z, y = −X
// (X up on screen), so paths need no transform. Spec §2 (drawing), §8 (colours live in tools.css).
import { sampleArc, pointSegmentDistance } from './geom.js';
import { CYCLE_FAILURES } from './machine.js';

export function layerOf(seg) {
  if (seg.kind === 'dwell') return null;
  if (seg.kind === 'rapid') return 'rapid';
  if (seg.cycle && seg.cycle.code !== 70) return 'pass';
  return 'feed';
}

export function pointsOf(seg, n = 24) {
  return seg.arc ? sampleArc(seg.from, seg.to, seg.arc, n) : [seg.from, seg.to];
}

const fmt = v => String(Math.round(v * 1000) / 1000 || 0);

export function toPathD(polys) {
  let d = '', last = null;
  for (const pts of polys) {
    if (!pts || !pts.length) continue;
    const joined = last && Math.abs(last.x - pts[0].x) < 1e-9 && Math.abs(last.z - pts[0].z) < 1e-9;
    for (let i = 0; i < pts.length; i++) {
      if (i === 0 && joined) continue;
      d += `${i === 0 ? 'M' : 'L'}${fmt(pts[i].z)} ${fmt(-pts[i].x)}`;
    }
    last = pts[pts.length - 1];
  }
  return d;
}

export function buildScene(result, opts = {}) {
  const n = opts.arcSegments || 24;
  const layers = { profile: [], rapid: [], feed: [], pass: [] };
  let minZ = Infinity, maxZ = -Infinity, minX = 0, maxX = -Infinity;
  const grow = p => { minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); };
  let fz0 = Infinity, fz1 = -Infinity, fx0 = 0, fx1 = -Infinity;
  const growFit = p => { fz0 = Math.min(fz0, p.z); fz1 = Math.max(fz1, p.z); fx0 = Math.min(fx0, p.x); fx1 = Math.max(fx1, p.x); };
  const polylines = new Array(result.segments.length).fill(null);
  result.segments.forEach((seg, i) => {
    const layer = layerOf(seg);
    if (!layer) return;
    const pts = pointsOf(seg, n);
    pts.forEach(grow);
    if (layer !== 'rapid') pts.forEach(growFit);
    polylines[i] = pts;
    layers[layer].push(pts);
  });
  for (const c of result.cycles) {
    if (![71, 72, 73].includes(c.code) || !c.body) continue;
    for (const s of c.body) { const pts = pointsOf(s, n); pts.forEach(grow); pts.forEach(growFit); layers.profile.push(pts); }
  }
  // Error markers (spec §5.2): one per unsupported or failed cycle block whose position is known.
  const markers = [], markedLines = new Set();
  for (const e of result.events) {
    if (!CYCLE_FAILURES.has(e.type) || !e.at || markedLines.has(e.line)) continue;
    markedLines.add(e.line);
    markers.push({ x: e.at.x, z: e.at.z, line: e.line, id: e.type });
    grow(e.at); growFit(e.at);
  }
  const empty = !Number.isFinite(maxZ);
  const bounds = empty ? { minZ: -10, maxZ: 10, minX: 0, maxX: 10 } : { minZ, maxZ, minX, maxX };
  // Fit frames the cutting moves: tool-change rapids to a far home position would shrink the part.
  const fitBounds = Number.isFinite(fz1) ? { minZ: fz0, maxZ: fz1, minX: fx0, maxX: fx1 } : bounds;
  const paths = {};
  for (const k of Object.keys(layers)) paths[k] = toPathD(layers[k]);
  const starts = result.cycles
    .filter(c => c.start && c.start.x !== null && c.start.z !== null)
    .map(c => ({ x: c.start.x, z: c.start.z, code: c.code, line: c.line }));
  const labels = [], seenLabel = new Set();
  for (const c of result.cycles) {
    if (!c.body || !c.body.length || !c.pBlock || !c.qBlock) continue;
    const ends = [[c.pBlock, c.body[0].from], [c.qBlock, c.body[c.body.length - 1].to]];
    for (const [b, p] of ends) {
      if (b.n === null) continue;
      const key = `${b.n}@${p.x},${p.z}`;
      if (seenLabel.has(key)) continue;
      seenLabel.add(key);
      labels.push({ x: p.x, z: p.z, text: `N${b.n}` });
    }
  }
  return { bounds, fitBounds, paths, polylines, starts, labels, markers, empty };
}

export function viewBoxFor(b, margin = 0.06) {
  const w = Math.max(b.maxZ - b.minZ, 1), h = Math.max(b.maxX - b.minX, 1);
  return { x: b.minZ - margin * w, y: -b.maxX - margin * h, w: w * (1 + 2 * margin), h: h * (1 + 2 * margin) };
}

export function buildIndex(polylines, bounds, cells = 64) {
  const size = Math.max(bounds.maxZ - bounds.minZ, bounds.maxX - bounds.minX, 1e-6) / cells;
  const grid = new Map();
  const key = (cz, cx) => `${cz},${cx}`;
  polylines.forEach((pts, i) => {
    if (!pts) return;
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], b = pts[k];
      const z0 = Math.floor((Math.min(a.z, b.z) - bounds.minZ) / size), z1 = Math.floor((Math.max(a.z, b.z) - bounds.minZ) / size);
      const x0 = Math.floor((Math.min(a.x, b.x) - bounds.minX) / size), x1 = Math.floor((Math.max(a.x, b.x) - bounds.minX) / size);
      for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
        const kk = key(cz, cx);
        let arr = grid.get(kk);
        if (!arr) grid.set(kk, (arr = []));
        if (arr[arr.length - 1] !== i) arr.push(i);
      }
    }
  });
  return { size, grid, bounds, key };
}

export function nearestSegment(index, polylines, p, tol) {
  const { size, grid, bounds, key } = index;
  const r = Math.max(1, Math.ceil(tol / size));
  const cz0 = Math.floor((p.z - bounds.minZ) / size), cx0 = Math.floor((p.x - bounds.minX) / size);
  let best = null, bestD = tol;
  for (let cz = cz0 - r; cz <= cz0 + r; cz++) for (let cx = cx0 - r; cx <= cx0 + r; cx++) {
    const arr = grid.get(key(cz, cx));
    if (!arr) continue;
    for (const i of arr) {
      const pts = polylines[i];
      for (let k = 1; k < pts.length; k++) {
        const d = pointSegmentDistance(p, pts[k - 1], pts[k]);
        if (d <= bestD) { bestD = d; best = i; }
      }
    }
  }
  return best;
}

export function segmentsByLine(segments) {
  const m = new Map();
  segments.forEach((s, i) => { if (s.line === null) return; if (!m.has(s.line)) m.set(s.line, []); m.get(s.line).push(i); });
  return m;
}
