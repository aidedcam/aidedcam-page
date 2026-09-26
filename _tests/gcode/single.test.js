import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boxMoves } from '../../js/gcode/cycles/single.js';

const A = { x: 26, z: 2 };

test('G90 turning box: rapid in, cut, cut out, rapid back', () => {
  const m = boxMoves(90, A, { x: 23, z: -30 }, 0);
  assert.deepEqual(m.map(s => s.kind), ['rapid', 'feed', 'feed', 'rapid']);
  assert.deepEqual(m.map(s => s.to), [{ x: 23, z: 2 }, { x: 23, z: -30 }, { x: 26, z: -30 }, { x: 26, z: 2 }]);
});

test('G90 taper: R shifts the X at the start of the cut', () => {
  const m = boxMoves(90, A, { x: 23, z: -30 }, -1);
  assert.deepEqual(m[0].to, { x: 22, z: 2 });
  assert.deepEqual(m[1].to, { x: 23, z: -30 });
});

test('G92 threading box: the Z move is a thread, the X-out move is a rapid', () => {
  const m = boxMoves(92, { x: 12.5, z: 5 }, { x: 9.6, z: -20 }, 0);
  assert.deepEqual(m.map(s => s.kind), ['rapid', 'thread', 'rapid', 'rapid']);
});

test('G94 facing box: rapid Z in, cut X, cut Z out, rapid X back', () => {
  const m = boxMoves(94, A, { x: 10, z: -1 }, 0);
  assert.deepEqual(m.map(s => s.kind), ['rapid', 'feed', 'feed', 'rapid']);
  assert.deepEqual(m.map(s => s.to), [{ x: 26, z: -1 }, { x: 10, z: -1 }, { x: 10, z: 2 }, { x: 26, z: 2 }]);
});

test('unknown code gives no moves', () => {
  assert.deepEqual(boxMoves(91, A, { x: 1, z: 1 }, 0), []);
});
