import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMoves, pushMove, finishMoves, buildLineIndex, movesOfLine, K_FEED, K_RAPID } from '../../js/mill/moves.js';

const P = (x, y, z) => ({ x, y, z });

test('the buffer grows past its capacity and keeps every field', () => {
  const m = createMoves(2);
  for (let i = 0; i < 5; i++) pushMove(m, P(i, 0, 0), P(i + 1, 0, 0), i % 2 ? K_RAPID : K_FEED, 10 + i, 1, 0, i * 0.5);
  assert.equal(m.count, 5);
  assert.ok(m.cap >= 5);
  const f = finishMoves(m);
  assert.equal(f.pos.length, 30);
  assert.deepEqual(Array.from(f.pos.slice(24, 30)), [4, 0, 0, 5, 0, 0]);
  assert.deepEqual(Array.from(f.kind), [K_FEED, K_RAPID, K_FEED, K_RAPID, K_FEED]);
  assert.deepEqual(Array.from(f.line), [10, 11, 12, 13, 14]);
  assert.deepEqual(Array.from(f.seconds), [0, 0.5, 1, 1.5, 2]);
});

test('finishMoves returns exact-length copies with their own buffers (safe to transfer)', () => {
  const m = createMoves(8);
  pushMove(m, P(0, 0, 0), P(1, 1, 1), K_FEED, 1, 0, 0, NaN);
  const f = finishMoves(m);
  assert.equal(f.pos.buffer.byteLength, 6 * 4);
  assert.notEqual(f.pos.buffer, m.pos.buffer);
  assert.ok(Number.isNaN(f.seconds[0]));                  // "not timeable" survives as NaN
});

test('the line index maps a line to all its moves, even when they are not adjacent', () => {
  const m = createMoves();
  const lines = [3, 5, 3, 7, 3];
  lines.forEach((l, i) => pushMove(m, P(i, 0, 0), P(i + 1, 0, 0), K_FEED, l, 0, 0, 1));
  const idx = buildLineIndex(finishMoves(m), 8);
  assert.deepEqual(movesOfLine(idx, 3), [0, 2, 4]);
  assert.deepEqual(movesOfLine(idx, 5), [1]);
  assert.deepEqual(movesOfLine(idx, 4), []);
  assert.deepEqual(movesOfLine(idx, 99), []);
});
