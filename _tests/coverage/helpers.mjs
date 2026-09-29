// Hand-made engine items for the coverage tests: what the engine returns for closed polylines drawn on a
// layer (id, layer, kind, area, bad, path, verts), from vertices in metres. Areas are the shoelace of the
// straight-edged outlines used here, so every expected number in the tests is worked by hand.
import { rect } from './dxf-writer.mjs';
export { rect };

let next = 0x100;
export function item(layer, verts, { id, bad = false, closed = true } = {}) {
  const pts = verts.map(v => [v[0], v[1]]);
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; a += x0 * y1 - x1 * y0; }
  const path = [];
  for (const [x, y] of pts) path.push(x, y);
  if (closed) path.push(pts[0][0], pts[0][1]);
  return {
    id: id || (next++).toString(16).toUpperCase(), layer, kind: 'polyline', len: 0,
    area: closed && !bad ? Math.abs(a) / 2 : 0, bad, block: null, copies: 1, path: [path],
    verts: closed ? verts.flatMap(v => [v[0], v[1], v[2] || 0]) : undefined,
  };
}

export const result = items => ({ type: 'result', layers: [...new Set(items.map(i => i.layer))].map(name => ({ name, color: '#ffffff' })), items, bbox: { x0: 0, y0: 0, x1: 1, y1: 1 }, file: { units: 'm', unitsSource: 'file', used: 'm' }, warnings: [] });

// The union of axis-parallel rectangles by the answer the engine gives for them (tests of the rules only).
export const unionOf = (area, verts = []) => ({ type: 'union', area, parts: verts.length, paths: [], verts, bad: [], error: null });
