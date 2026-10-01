import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chain, simplify, polylineSet, forEachPolyline, WELD } from '../../js/ifcplan/chain.js';
import { cutMesh } from '../../js/ifcplan/cut.js';
import { box } from './mesh.mjs';

const round = a => [...a].map(v => +v.toFixed(6));
const shoelace = p => { let s = 0; for (let i = 0; i < p.length; i += 2) { const j = (i + 2) % p.length; s += p[i] * p[j + 1] - p[j] * p[i + 1]; } return Math.abs(s) / 2; };

test('a box cut joins into one closed loop of its four corners', () => {
  const segs = [];
  cutMesh(box(2, 1, 0, 6, 1.25, 3).P, box(2, 1, 0, 6, 1.25, 3).ix, [1.1], (k, ...s) => segs.push(...s));
  const out = chain(segs);
  assert.equal(out.length, 1);
  assert.equal(out[0].closed, true);
  assert.equal(out[0].pts.length, 8, 'four corners, the split sides merged');
  assert.ok(Math.abs(shoelace(out[0].pts) - 1) < 1e-9);
});

test('collinear runs merge, in any order and direction', () => {
  const out = chain([3, 0, 4, 0, 1, 0, 0, 0, 2, 0, 3, 0, 2, 0, 1, 0, 4, 0, 5, 0]);
  assert.equal(out.length, 1);
  assert.equal(out[0].closed, false);
  assert.deepEqual(round(out[0].pts).sort((a, b) => a - b), [0, 0, 0, 5]);
  assert.deepEqual(round(simplify([0, 0, 1, 0, 2, 0.000005, 3, 0, 3, 2], false)), [0, 0, 3, 0, 3, 2], 'within 0.01 mm of the line');
  assert.deepEqual(round(simplify([0, 0, 1, 0, 2, 0.0001, 3, 0], false)), [0, 0, 1, 0, 2, 0.0001, 3, 0], '0.1 mm off the line is a corner');
  assert.deepEqual(round(simplify([0, 0, 2, 0, 1, 0], false)), [0, 0, 2, 0, 1, 0], 'a run that turns back is kept');
});

test('the 0.5 mm tolerance: gaps up to it are closed, wider ones are not', () => {
  assert.equal(WELD, 5e-4);
  const square = gap => [0, 0, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 0, gap];
  assert.deepEqual(chain(square(0.0004)).map(p => [p.closed, p.pts.length]), [[true, 8]]);
  assert.deepEqual(chain(square(0.0006)).map(p => [p.closed, p.pts.length]), [[false, 10]]);
});

test('open chains stay open; junctions end them; doubled segments are drawn once', () => {
  assert.deepEqual(chain([0, 0, 1, 0, 1, 0, 1, 1]).map(p => [p.closed, round(p.pts)]), [[false, [0, 0, 1, 0, 1, 1]]]);
  const t = chain([0, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 1]);
  assert.equal(t.length, 3, 'a T: three pieces from the junction');
  assert.ok(t.every(p => !p.closed && p.pts.length === 4));
  const eight = chain([0, 0, 1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 0, 0, -1, 0, -1, 0, -1, -1, -1, -1, 0, 0]);
  assert.deepEqual(eight.map(p => p.closed), [true, true], 'two loops through one point');
  assert.deepEqual(chain([0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 1]).map(p => p.pts.length), [6]);
  assert.deepEqual(chain([0, 0, 0.0001, 0]), [], 'a segment shorter than the tolerance welds into a point');
});

test('georeferenced coordinates (6,591 km north) weld and close as small ones do', () => {
  const x = 538450.123456, y = 6591584.654321, d = 0.0002;               // ends 0.2 mm apart
  const out = chain([x, y, x + 3, y, x + 3 + d, y, x + 3, y + 0.25, x + 3, y + 0.25, x, y + 0.25, x, y + 0.25 + d, x, y]);
  assert.deepEqual(out.map(p => [p.closed, p.pts.length]), [[true, 8]]);
  assert.ok(Math.abs(out[0].pts[0] - x) < 1e-3 && Math.abs(out[0].pts[1] - y) < 1e-3);
});

test('a segment overlapped by its own halves is one open line, not a closed loop', () => {
  const out = chain([0, 0, 2, 0, 0, 0, 1, 0, 1, 0, 2, 0]);
  assert.equal(out.length, 1);
  assert.equal(out[0].closed, false);
  const xs = [];
  for (let i = 0; i < out[0].pts.length; i += 2) xs.push(out[0].pts[i]);
  assert.equal(Math.min(...xs), 0);
  assert.equal(Math.max(...xs), 2);
});

test('a polyline set packs into typed arrays and reads back', () => {
  const set = polylineSet();
  set.add([0, 0, 1, 0, 1, 1], true);
  set.add([5, 5, 6, 6], false);
  const packed = set.pack();
  assert.ok(packed.xy instanceof Float64Array && packed.ends instanceof Uint32Array && packed.closed instanceof Uint8Array);
  assert.deepEqual([...packed.ends], [3, 5]);
  const back = [];
  forEachPolyline(packed, (pts, closed, i) => back.push([i, closed, [...pts]]));
  assert.deepEqual(back, [[0, true, [0, 0, 1, 0, 1, 1]], [1, false, [5, 5, 6, 6]]]);
  assert.equal(set.count, 2);
});
