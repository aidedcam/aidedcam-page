import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cutMesh, MIN_SEGMENT } from '../../js/ifcplan/cut.js';
import { box, tri, segmentsOf } from './mesh.mjs';

const len = s => Math.hypot(s[3] - s[1], s[4] - s[2]);
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('a box cut through its middle gives its rectangle: one segment per side triangle', () => {
  const segs = segmentsOf(cutMesh, box(2, 1, 0, 6, 1.25, 3), [1.1]);
  assert.equal(segs.length, 8);
  assert.ok(near(segs.reduce((a, s) => a + len(s), 0), 2 * (4 + 0.25)), 'the perimeter');
  for (const [, x0, y0, x1, y1] of segs) {
    for (const [x, y] of [[x0, y0], [x1, y1]]) {
      const onEdge = near(x, 2) || near(x, 6) || near(y, 1) || near(y, 1.25);
      assert.ok(onEdge && x >= 2 - 1e-9 && x <= 6 + 1e-9 && y >= 1 - 1e-9 && y <= 1.25 + 1e-9, `${x}, ${y}`);
    }
  }
});

test('a vertex exactly on the plane: a segment from it when the triangle crosses, nothing when it only touches', () => {
  assert.deepEqual(segmentsOf(cutMesh, tri([0, 0, 1], [2, 0, 0], [4, 0, 2]), [1]).map(s => s.map(v => +v.toFixed(9))), [[0, 3, 0, 0, 0]]);
  assert.deepEqual(segmentsOf(cutMesh, tri([0, 0, 1], [2, 0, 2], [4, 1, 3]), [1]), [], 'the rest above');
  assert.deepEqual(segmentsOf(cutMesh, tri([0, 0, 1], [2, 0, 0], [4, 1, -1]), [1]), [], 'the rest below');
});

test('a triangle lying in the plane gives nothing; the plan looks just above the cut', () => {
  assert.deepEqual(segmentsOf(cutMesh, tri([0, 0, 1.1], [3, 0, 1.1], [0, 3, 1.1]), [1.1]), []);
  assert.deepEqual(segmentsOf(cutMesh, box(0, 0, 0.8, 5, 4, 1.1), [1.1]), [], 'a slab whose top is at the cut draws nothing');
  const under = segmentsOf(cutMesh, box(0, 0, 1.1, 5, 4, 1.4), [1.1]);
  assert.ok(near(under.reduce((a, s) => a + len(s), 0), 18), 'a slab whose underside is at the cut draws its outline');
});

test('several planes in one pass, each segment tagged with its plane', () => {
  const segs = segmentsOf(cutMesh, box(0, 0, 0, 1, 1, 6), [1.1, 4.1, 7.1, -1]);
  assert.deepEqual([0, 1, 2, 3].map(k => segs.filter(s => s[0] === k).length), [8, 8, 0, 0]);
  assert.equal(cutMesh(new Float64Array(0), new Uint32Array(0), [1], () => assert.fail('no triangles')), 0);
});

test('segments shorter than 0.1 mm are dropped', () => {
  assert.equal(MIN_SEGMENT, 1e-4);
  assert.deepEqual(segmentsOf(cutMesh, tri([0, 0, 0], [0.00009, 0, 0], [0, 0, 2]), [1]), []);
  assert.equal(segmentsOf(cutMesh, tri([0, 0, 0], [0.00022, 0, 0], [0, 0, 2]), [1]).length, 1);
});

test('a non-finite vertex gives no segment: every segment kept has finite ends and is at least 0.1 mm long', () => {
  const m = box(0, 0, 0, 4, 1, 3);
  m.P[0] = NaN;                              // vertex 0: x
  m.P[14] = NaN;                             // vertex 4: z
  m.P[18] = Infinity;                        // vertex 6: x
  const segs = segmentsOf(cutMesh, m, [1.1]);
  assert.ok(segs.length > 0, 'the triangles without a bad vertex still cut');
  for (const s of segs) {
    assert.ok(s.slice(1).every(Number.isFinite), JSON.stringify(s));
    assert.ok(len(s) >= MIN_SEGMENT);
  }
});
