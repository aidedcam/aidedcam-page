import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPacker, packMesh } from '../../js/ifcplan/mesh3d.js';

// A box from (x0, y0, z0) to (x1, y1, z1): 8 vertices, 12 triangles, as gather() gives them (Float64, Z up, metres).
function box(x0, y0, z0, x1, y1, z1) {
  const P = new Float64Array(24);
  for (let i = 0; i < 8; i++) P.set([i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0], 3 * i);
  const ix = Uint32Array.from([0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5]);
  return { P, ix };
}
const wall = (name, b, storey = 0) => ({ layer: 'IFC_WALL', type: 'IfcWall', name, storey, ...box(...b) });

test('per layer: positions relative to the origin, indices offset per element, and each vertex names its element', () => {
  const { body, transfer } = packMesh([
    wall('W1', [10, 20, 0, 14, 20.2, 3]),
    { layer: 'IFC_DOOR', type: 'IfcDoor', name: 'D', storey: 0, ...box(11, 20, 0, 12, 20.2, 2.1) },
    wall('W2', [10, 23, 0, 14, 23.2, 3], 1),
  ], { origin: [10, 20, 0] });
  const m = body.mesh3d;
  assert.deepEqual(m.origin, [10, 20, 0]);
  assert.deepEqual(Object.keys(m.layers), ['IFC_WALL', 'IFC_DOOR']);
  assert.deepEqual(m.elements, [
    { type: 'IfcWall', layer: 'IFC_WALL', name: 'W1', storey: 0 },
    { type: 'IfcDoor', layer: 'IFC_DOOR', name: 'D', storey: 0 },
    { type: 'IfcWall', layer: 'IFC_WALL', name: 'W2', storey: 1 },
  ]);
  assert.equal(m.triangles, 36);
  const w = m.layers.IFC_WALL;
  assert.ok(w.position instanceof Float32Array && w.index instanceof Uint32Array && w.element instanceof Uint32Array);
  assert.deepEqual([w.position.length, w.index.length, w.element.length], [48, 72, 16], 'vertices are not shared between elements');
  assert.deepEqual([...w.position.subarray(0, 6)], [0, 0, 0, 4, 0, 0]);
  assert.deepEqual([...w.position.subarray(24, 27)].map(v => +v.toFixed(5)), [0, 3, 0], 'the second wall, relative');
  assert.deepEqual([...w.index.subarray(36, 39)], [8, 10, 9], 'the second wall indexes its own vertices');
  assert.deepEqual([...w.element], [0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2]);
  assert.deepEqual([...m.layers.IFC_DOOR.element], [1, 1, 1, 1, 1, 1, 1, 1]);
  assert.equal(transfer.length, 6);
  for (const L of Object.values(m.layers)) for (const a of [L.position, L.index, L.element]) assert.ok(transfer.includes(a.buffer));
});

test('a georeferenced model keeps its 1 mm edges exact: Float32 relative to the origin, not absolute', () => {
  const x = 512345.678, y = 4123456.789, z = 104.25;
  const { body } = packMesh([wall('cube', [x, y, z, x + 0.001, y + 0.001, z + 0.001])], { origin: [x, y, z] });
  const p = body.mesh3d.layers.IFC_WALL.position;
  for (let i = 0; i < 8; i++) {
    for (const [k, bit] of [[0, 1], [1, 2], [2, 4]]) {
      const want = i & bit ? 0.001 : 0;
      assert.ok(Math.abs(p[3 * i + k] - want) < 1e-9, `vertex ${i} axis ${k}: ${p[3 * i + k]}`);
    }
  }
  assert.equal(Math.fround(y + 0.001), Math.fround(y), 'absolute Float32 would collapse the edge');
});

test('the cap: over maxTriangles nothing is packed, every triangle is still counted, and the answer is "large"', () => {
  const p = createPacker({ origin: [0, 0, 0], maxTriangles: 20 });
  p.add(wall('a', [0, 0, 0, 1, 1, 1]));
  assert.equal(p.over, false);
  p.add(wall('b', [2, 0, 0, 3, 1, 1]));
  assert.equal(p.over, true, '24 triangles > 20');
  p.add(wall('c', [4, 0, 0, 5, 1, 1]));
  assert.equal(p.triangles, 36);
  assert.deepEqual(p.finish(), { body: { mesh3d: null, triangles: 36, reason: 'large' }, transfer: [] });
  const at = createPacker({ origin: [0, 0, 0], maxTriangles: 24 });
  at.add(wall('a', [0, 0, 0, 1, 1, 1])); at.add(wall('b', [2, 0, 0, 3, 1, 1]));
  assert.equal(at.finish().body.mesh3d.triangles, 24, 'exactly at the cap is drawn');
});

test('rooms go on IFC_SPACE; an element outside any storey keeps storey -1', () => {
  const { body } = packMesh([
    { layer: 'IFC_SPACE', type: 'IfcSpace', name: 'Σαλόνι', storey: 0, ...box(0, 0, 0, 5, 4, 2.7) },
    { layer: 'IFC_OTHER', type: 'IfcBuildingElementProxy', name: '', storey: -1, ...box(0, 0, 0, 1, 1, 1) },
  ], { origin: [0, 0, 0] });
  assert.deepEqual(Object.keys(body.mesh3d.layers), ['IFC_SPACE', 'IFC_OTHER']);
  assert.deepEqual(body.mesh3d.elements.map(e => [e.type, e.layer, e.name, e.storey]), [['IfcSpace', 'IFC_SPACE', 'Σαλόνι', 0], ['IfcBuildingElementProxy', 'IFC_OTHER', '', -1]]);
});

test('a vertex web-ifc gives as NaN drops its triangles and sits at the origin, so the view stays finite', () => {
  const b = wall('w', [1, 1, 1, 2, 2, 2]);
  b.P[0] = NaN;                                                  // vertex 0: in 3 of the 12 triangles
  const { body } = packMesh([b], { origin: [0, 0, 0] });
  const L = body.mesh3d.layers.IFC_WALL;
  assert.ok(L.position.every(Number.isFinite));
  assert.deepEqual([...L.position.subarray(0, 3)], [0, 0, 0]);
  assert.equal(L.index.length, 27, '9 of 12 triangles kept');
  assert.ok(!L.index.includes(0));
  assert.equal(body.mesh3d.triangles, 12, 'the count is what web-ifc gave');
});
