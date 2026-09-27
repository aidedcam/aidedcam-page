import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMill } from '../../js/mill/analyze.js';
import { indexPrograms, indexSequenceNumbers } from '../../js/mill/subprograms.js';

const lastX = r => r.moves.pos[(r.moves.count - 1) * 6 + 3];
const ids = r => r.warnings.map(w => w.id);
const SUB = ['O1000', 'G91 G1 X10 F100', 'G90', 'M99'];

test('indexes: O lines (and ":" program numbers), N numbers for M97', () => {
  assert.deepEqual([...indexPrograms(['%', 'O0001', 'G0 X0', ':2000', 'o3000 (SUB)'])], [[1, 1], [2000, 3], [3000, 4]]);
  assert.deepEqual([...indexSequenceNumbers(['N10 G0 X0', '/N20 X1', 'G1 X2'])], [[10, 0], [20, 1]]);
});

test('M98 P1000 L2 runs the subprogram twice; its line owns both moves', () => {
  const r = analyzeMill(['O0001', 'G90 G0 X0 Y0 Z0 S1000 M3', 'M98 P1000 L2', 'M30', ...SUB].join('\n'));
  assert.equal(r.moves.count, 2);
  assert.equal(lastX(r), 20);
  assert.equal(r.lineIndex.offsets[7] - r.lineIndex.offsets[6], 2);
  assert.deepEqual(ids(r), []);
});

test('the older M98 P<repeat><oooo> form', () => {
  const r = analyzeMill(['G90 G0 X0 Y0 Z0', 'M98 P21000', 'M30', ...SUB].join('\n'));
  assert.equal(lastX(r), 20);
});

test('Haas M97 jumps to a sequence number and returns at M99', () => {
  const r = analyzeMill(['G90 G0 X0 Y0 Z0', 'M97 P100', 'M30', 'N100 G91 G1 X5 F100', 'G90', 'M99'].join('\n'));
  assert.equal(r.moves.count, 1);
  assert.equal(lastX(r), 5);
  assert.equal(r.control, 'haas');
});

test('a call to a subprogram that is not in the file is reported and skipped', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z0 S1000 M3\nM98 P2000\nG1 X10 F100\nM30');
  assert.deepEqual(r.warnings.map(w => [w.id, w.params.p]), [['sub-missing', 2000]]);
  assert.equal(lastX(r), 10);
});

test('recursion stops at nesting depth 4 with sub-loop', () => {
  const r = analyzeMill(['G90 G0 X0 Y0 Z0', 'M98 P1000', 'M30', 'O1000', 'M98 P1000', 'M99'].join('\n'));
  assert.ok(ids(r).includes('sub-loop'));
});

test('M99 in the main program ends it with an info note', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z0 S1000 M3\nG1 X10 F100\nM99\nG1 X20');
  assert.deepEqual(ids(r), ['main-m99']);
  assert.equal(lastX(r), 10);
});

test('a finite repeat past the executed-line budget stops with sub-loop, and the time becomes incomplete', () => {
  const r = analyzeMill(['G90 G0 X0 Y0 Z0 S1000 M3', 'M98 P1000 L300000', 'M30', ...SUB].join('\n'));
  assert.ok(ids(r).includes('sub-loop'));
  assert.equal(r.timing.incomplete, true);
});

test('stats count the subprogram calls entered; nesting past 4 makes the time incomplete', () => {
  const ok = analyzeMill(['G90 G0 X0 Y0 Z0 S1000 M3', 'M98 P1000 L2', 'M98 P1000', 'M30', ...SUB].join('\n'));
  assert.equal(ok.stats.subprogramCalls, 2);
  assert.equal(ok.timing.incomplete, false);
  const missing = analyzeMill('G90 G0 X0 Y0 Z0 S1000 M3\nM98 P2000\nG1 X10 F100\nM30');
  assert.equal(missing.stats.subprogramCalls, 0);
  assert.equal(missing.timing.incomplete, false);
  const deep = analyzeMill(['G90 G0 X0 Y0 Z0 S1000 M3', 'M98 P1000', 'M30', 'O1000', 'M98 P1000', 'M99'].join('\n'));
  assert.equal(deep.stats.subprogramCalls, 4);
  assert.equal(deep.timing.incomplete, true);
});

test('a five-digit P calls that O number when the file has it (Haas); a missing one is reported as written', () => {
  const haas = analyzeMill(['G90 G0 X0 Y0 Z0 S1000 M3', 'M98 P12345', 'M30', 'O12345', 'G91 G1 X10 F100', 'G90', 'M99'].join('\n'));
  assert.deepEqual(ids(haas), []);
  assert.equal(lastX(haas), 10);
  const missing = analyzeMill('G90 G0 X0 Y0 Z0 S1000 M3\nM98 P12345\nM30');
  assert.deepEqual(missing.warnings.map(w => [w.id, w.params.p]), [['sub-missing', 12345]]);
});
