import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProgram } from '../../js/gcode/parse.js';
import { interpret } from '../../js/gcode/interpret.js';

const cyc = (run, code) => run.segments.filter(s => s.cycle && s.cycle.code === code);

test('G74 peck drilling along Z with chip-break retracts', () => {
  const run = interpret(parseProgram('G97 S800 G99\nT0505\nG0 X0 Z2\nG74 R1\nG74 Z-20 Q5000 F0.1'));
  const segs = cyc(run, 74);
  assert.deepEqual(segs.map(s => s.to.z), [-3, -2, -8, -7, -13, -12, -18, -17, -20, 2]);
  assert.deepEqual(segs.map(s => s.kind), ['feed', 'rapid', 'feed', 'rapid', 'feed', 'rapid', 'feed', 'rapid', 'feed', 'rapid']);
});

test('G75 grooving: pecks along X, columns stepped in Z, back to A', () => {
  const run = interpret(parseProgram('G97 S600 G99\nT0606\nG0 X52 Z-10\nG75 R0.5\nG75 X40 Z-14 P2000 Q3000 F0.05'));
  const segs = cyc(run, 75);
  assert.equal(segs.length, 21);
  assert.deepEqual(segs.slice(0, 6).map(s => s.to.x), [24, 24.5, 22, 22.5, 20, 26]);
  assert.deepEqual(segs[6].to, { x: 26, z: -13 });
  assert.deepEqual(segs[20].to, { x: 26, z: -10 });
});

test('a decimal point in P/Q is reported', () => {
  const run = interpret(parseProgram('G97 S600 G99\nG0 X52 Z-10\nG75 R0.5\nG75 X40 Z-14 P2. Q3. F0.05'));
  assert.ok(run.events.some(e => e.type === 'pq-decimal'));
});

const zs = (run, line) => run.segments.filter(s => s.cycle && s.cycle.line === line).map(s => +s.to.z.toFixed(6));

test('a second G74 without its own first line reuses the stored R and pecks', () => {
  const run = interpret(parseProgram('G97 S800 G99\nT0505\nG0 X0 Z2\nG74 R1.\nG74 Z-20. Q5000 F0.1\nG0 Z-18.\nG74 Z-40. Q5000 F0.1'));
  assert.deepEqual(zs(run, 7), [-23, -22, -28, -27, -33, -32, -38, -37, -40, -18]);
});

test('a G74 that never had a first line pecks with the default retract', () => {
  const run = interpret(parseProgram('G97 S800 G99\nG0 X0 Z2\nG74 Z-20. Q5000 F0.1'));
  assert.deepEqual(zs(run, 3), [-3, -2.5, -8, -7.5, -13, -12.5, -18, -17.5, -20, 2]);
  assert.ok(!run.events.some(e => e.type === 'cycle-form'));
});

test('G74 one-line form (Z K, mm) pecks, even with a stored first line', () => {
  const run = interpret(parseProgram('G97 S800 G99\nG0 X0 Z2\nG74 R1.\nG74 Z-20. K4. F0.1'));
  assert.deepEqual(zs(run, 4), [-2, -1.5, -6, -5.5, -10, -9.5, -14, -13.5, -18, -17.5, -20, 2]);
});

test('G75 one-line form (X Z I K) draws the same grooves as the two-line example', () => {
  const two = interpret(parseProgram('G97 S600 G99\nG0 X52 Z-10\nG75 R0.5\nG75 X40 Z-14 P2000 Q3000 F0.05'));
  const one = interpret(parseProgram('G97 S600 G99\nG0 X52 Z-10\nG75 X40. Z-14. I2. K3. F0.05'));
  const moves = run => run.segments.filter(s => s.cycle).map(s => [s.kind, +s.to.x.toFixed(6), +s.to.z.toFixed(6)]);
  assert.equal(moves(one).length, 21);
  assert.deepEqual(moves(one), moves(two));
});
