import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centroid, inside, ringDistance, ringOf, assign, BALCONY_REACH } from '../../js/coverage/levels.js';
import { rect } from './helpers.mjs';

test('centroid: of a rectangle, of an L, and at survey coordinates', () => {
  assert.deepEqual(centroid(rect(0, 0, 4, 2)), [2, 1]);
  // An L of two rectangles: 4 × 1 (centroid 2, 0.5) and 1 × 3 above its left end (0.5, 2.5): areas 4 and 3.
  const c = centroid([[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4]]);
  assert.ok(Math.abs(c[0] - (4 * 2 + 3 * 0.5) / 7) < 1e-12 && Math.abs(c[1] - (4 * 0.5 + 3 * 2.5) / 7) < 1e-12, String(c));
  const s = centroid(rect(410000, 4495000, 10, 15));
  assert.ok(Math.abs(s[0] - 410005) < 1e-9 && Math.abs(s[1] - 4495007.5) < 1e-9, String(s));
});

test('distance between outlines: touching is 0, a gap is its width, overlapping or inside is 0', () => {
  assert.equal(ringDistance(rect(0, 0, 10, 10), rect(0, -3, 5, 3)), 0);
  assert.ok(Math.abs(ringDistance(rect(0, 0, 10, 10), rect(0, -3.5, 5, 3)) - 0.5) < 1e-12);
  assert.equal(ringDistance(rect(0, 0, 10, 10), rect(8, 8, 5, 5)), 0);
  assert.equal(ringDistance(rect(0, 0, 10, 10), rect(2, 2, 1, 1)), 0);
  assert.equal(BALCONY_REACH, 0.5);
});

test('the ring of an engine path drops the repeated closing point', () => {
  const ring = ringOf({ path: [[0, 0, 1, 0, 1, 1, 0, 0]] });
  assert.deepEqual(ring, [[0, 0], [1, 0], [1, 1]]);
  assert.equal(inside([0.9, 0.5], ring), true);
});

test('assignment goes by the centroid, even when an L-shaped space has it outside itself', () => {
  const levels = [{ id: 'L', level: '00', area: 100, ring: rect(0, 0, 10, 10) }];
  const L = [[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4]];
  assert.equal(assign(levels, [{ id: 's', role: 'semiopen', area: 7, ring: L }])[0].level, '00');
  const out = assign(levels, [{ id: 's', role: 'void', area: 4, ring: rect(20, 0, 2, 2) }])[0];
  assert.deepEqual([out.level, out.why], [null, 'outside']);
});

test('a balcony equally near two outlines of one level goes to the smaller; of two levels, to neither', () => {
  const two = (a, b) => [{ id: 'A', level: a, area: 200, ring: rect(0, 0, 10, 20) }, { id: 'B', level: b, area: 100, ring: rect(12, 0, 10, 10) }];
  const b = { id: 'b', role: 'balcony', area: 2, ring: rect(10, 0, 2, 1) };                 // touches both
  const same = assign(two('01', '01'), [b])[0];
  assert.deepEqual([same.level, same.levelId], ['01', 'B']);
  const amb = assign(two('01', '02'), [b])[0];
  assert.deepEqual([amb.level, amb.why], [null, 'ambiguous']);
  // Nearer to one level (0 against 0.10 m): that level.
  const near = assign(two('01', '02'), [{ ...b, ring: rect(10, 0, 1.9, 1) }])[0];
  assert.deepEqual([near.level, near.why], ['01', undefined]);
});

test('a space inside outlines of two levels (stacked plans) goes to neither; inside two of one level, to the smaller', () => {
  const s = { id: 's', role: 'stairCommon', area: 35, ring: rect(1, 1, 5, 7) };
  const stacked = ['00', '01', '02'].map(lv => ({ id: lv, level: lv, area: 150, ring: rect(0, 0, 10, 15) }));
  const out = assign(stacked, [s])[0];
  assert.deepEqual([out.level, out.why], [null, 'ambiguous']);
  const one = [{ id: 'big', level: '00', area: 150, ring: rect(0, 0, 10, 15) }, { id: 'small', level: '00', area: 80, ring: rect(0, 0, 8, 10) }];
  const a = assign(one, [s])[0];
  assert.deepEqual([a.level, a.levelId, a.why], ['00', 'small', undefined]);
});
