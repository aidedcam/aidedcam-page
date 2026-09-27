import { test } from 'node:test';
import assert from 'node:assert/strict';
import { holeMoves } from '../../js/mill/cycles.js';

// Compact form of the move list: 'R' = cycle rapid, 'F' = cycle feed, then the Z; 'D' = dwell seconds.
const seq = moves => moves.map(m => (m.kind === 'dwell' ? `D${m.seconds}` : `${m.kind === 'crapid' ? 'R' : 'F'}${m.to.z}`));
const base = { from: { x: 10, y: 10, z: 2 }, x: 10, y: 10, initZ: 50, r: 2, z: -10, q: null, p: null, retLevel: 98, clearance: 0.5 };

test('G81 from a new position: XY at the current level, down to R, feed, rapid back to the initial level', () => {
  const moves = holeMoves(81, { ...base, from: { x: 0, y: 0, z: 50 } });
  assert.deepEqual(moves[0], { kind: 'crapid', to: { x: 10, y: 10, z: 50 } });
  assert.deepEqual(seq(moves), ['R50', 'R2', 'F-10', 'R50']);
});

test('G99 returns to R instead of the initial level', () => {
  assert.deepEqual(seq(holeMoves(81, { ...base, retLevel: 99 })), ['F-10', 'R2']);
});

test('G82 dwells at the bottom', () => {
  assert.deepEqual(seq(holeMoves(82, { ...base, p: 0.5 })), ['F-10', 'D0.5', 'R50']);
});

test('G83 pecks: full retract to R, back down to d above the last depth, feed on', () => {
  assert.deepEqual(seq(holeMoves(83, { ...base, q: 5 })),
    ['F-3', 'R2', 'R-2.5', 'F-8', 'R2', 'R-7.5', 'F-10', 'R50']);
});

test('G73 pecks: retract d only (chip break)', () => {
  assert.deepEqual(seq(holeMoves(73, { ...base, q: 5 })), ['F-3', 'R-2.5', 'F-8', 'R-7.5', 'F-10', 'R50']);
});

test('a peck cycle without Q drills in one feed (the caller reports peck-no-q)', () => {
  assert.deepEqual(seq(holeMoves(83, { ...base, q: null })), ['F-10', 'R50']);
});

test('G84 and G74 tap in and out at feed, then G98 rapids to the initial level', () => {
  assert.deepEqual(seq(holeMoves(84, base)), ['F-10', 'F2', 'R50']);
  assert.deepEqual(seq(holeMoves(74, { ...base, retLevel: 99, p: 0.2 })), ['F-10', 'D0.2', 'F2']);
});

test('G85 feeds out; G89 dwells and feeds out; G86 rapids out', () => {
  assert.deepEqual(seq(holeMoves(85, base)), ['F-10', 'F2', 'R50']);
  assert.deepEqual(seq(holeMoves(89, { ...base, p: 1 })), ['F-10', 'D1', 'F2', 'R50']);
  assert.deepEqual(seq(holeMoves(86, base)), ['F-10', 'R50']);
});

test('G76, G87 and G88 are approximated as feed in, rapid out (G88 and G76 keep the dwell)', () => {
  assert.deepEqual(seq(holeMoves(76, { ...base, p: 0.3 })), ['F-10', 'D0.3', 'R50']);
  assert.deepEqual(seq(holeMoves(87, base)), ['F-10', 'R50']);
  assert.deepEqual(seq(holeMoves(88, { ...base, p: 1 })), ['F-10', 'D1', 'R50']);
});

test('a peck cycle with Z at or above R degrades like G81: one feed to Z, then the return level', () => {
  assert.deepEqual(seq(holeMoves(83, { ...base, z: 5, q: 1 })), ['F5', 'R50']);
  assert.deepEqual(seq(holeMoves(73, { ...base, z: 2, q: 1 })), ['F2', 'R50']);
});

test('Haas I/J/K peck: the first peck I, each next one J smaller, never below K', () => {
  assert.deepEqual(seq(holeMoves(83, { ...base, q: 5, qStep: 1, qMin: 3 })),
    ['F-3', 'R2', 'R-2.5', 'F-7', 'R2', 'R-6.5', 'F-10', 'R50']);
});
