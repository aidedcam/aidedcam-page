import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMill, MILL_MAX_LINES } from '../../js/mill/analyze.js';
import { movesOfLine } from '../../js/mill/moves.js';

test('bounds cover every move; cutBounds only the cutting moves', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z50\nZ2\nG1 Z-5 F100\nX40 Y20\nG0 Z50');
  assert.deepEqual(r.bounds, { min: [0, 0, -5], max: [40, 20, 50] });
  assert.deepEqual(r.cutBounds, { min: [0, 0, -5], max: [40, 20, 2] });
});

test('the line index lists each line\'s moves in execution order', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z10\nG98 G81 X10 Y0 Z-5 R2 F100\nX20');
  assert.deepEqual(movesOfLine(r.lineIndex, 2), [0, 1, 2, 3]);
  assert.deepEqual(movesOfLine(r.lineIndex, 3), [4, 5, 6, 7]);
  assert.deepEqual(movesOfLine(r.lineIndex, 1), []);
});

test('rows partition the moves: contiguous, in order, covering all of them', () => {
  const r = analyzeMill('G0 X0 Y0 Z0\nG1 X5 F100\nT1 M6\nG1 X10\nT2 M6\nG1 X20\nG1 X30');
  const rows = r.timing.rows;
  assert.equal(rows[0].moveStart, 0);
  for (let i = 1; i < rows.length; i++) assert.equal(rows[i].moveStart, rows[i - 1].moveEnd);
  assert.equal(rows[rows.length - 1].moveEnd, r.moves.count);
});

test('too large: over the line cap nothing is analysed', () => {
  const r = analyzeMill('\n'.repeat(MILL_MAX_LINES));
  assert.equal(r.tooLarge, true);
  assert.equal(r.moves.count, 0);
});

test('control: Haas-only codes mark the program as Haas, otherwise Fanuc', () => {
  assert.equal(analyzeMill('G154 P1 G0 X0 Y0 Z0').control, 'haas');
  assert.equal(analyzeMill('G54 G0 X0 Y0 Z0').control, 'fanuc');
});

test('empty and comment-only programs give an empty, valid result', () => {
  for (const src of ['', '%\n(ONLY A COMMENT)\n%']) {
    const r = analyzeMill(src);
    assert.equal(r.moves.count, 0);
    assert.equal(r.bounds, null);
    assert.deepEqual(r.timing, { rows: [], total: 0, incomplete: false });
  }
});

test('progress is reported every 50,000 executed lines', () => {
  const calls = [];
  analyzeMill('G0 X0 Y0 Z0\n'.repeat(120000), {}, { onProgress: (done, total) => calls.push([done, total]) });
  assert.deepEqual(calls.map(c => c[0]), [50000, 100000]);
});

test('past maxMoves the drawing stops, while the time and the checks still cover the whole program', () => {
  const prog = ['G90 G54 G0 X0 Y0 Z5 S1000 M3', 'G1 Z0 F600', ...Array.from({ length: 20 }, (_, i) => `X${i + 1}`), 'G0 Z50', 'M30'].join('\n');
  const full = analyzeMill(prog), capped = analyzeMill(prog, { maxMoves: 5 });
  assert.equal(full.movesCapped, false);
  assert.equal(capped.movesCapped, true);
  assert.equal(capped.moves.count, 5);
  assert.ok(full.moves.count > 5);
  assert.deepEqual(capped.warnings, full.warnings);
  assert.equal(capped.timing.incomplete, false);
  assert.ok(Math.abs(capped.timing.total - full.timing.total) < 1e-9);
});

test('a text over the character cap is reported too large, with its line count', async () => {
  const { MILL_MAX_CHARS } = await import('../../js/mill/analyze.js');
  const n = Math.ceil((MILL_MAX_CHARS + 1) / 6);
  const r = analyzeMill('G1 X1\n'.repeat(n));
  assert.equal(r.tooLarge, true);
  assert.equal(r.lines, n + 1);
});

test('tilted-plane codes are flagged, and G68-family axis words are data, not a move', () => {
  const r = analyzeMill('G90 G54 G0 X10 Y10 Z50 S1000 M3\nG68.2 X0 Y0 Z0 I0 J45 K0\nG53.1\nG1 Z0 F500\nG69\nM30');
  assert.deepEqual(r.warnings.filter(w => w.id === 'unsupported').map(w => w.params.code), ['G68.2', 'G53.1']);
  assert.equal(r.moves.count, 1);                         // only the G1: no rapid to the G68.2 origin
});

test('Haas G83 with I/J/K: pecks of I, J smaller each time down to K; K is not a repeat, Q not needed', async () => {
  const { K_CFEED } = await import('../../js/mill/moves.js');
  const r = analyzeMill('G90 G54 G0 X0 Y0 Z10 S1000 M3\nG98 G83 X10 Y10 Z-10 R2 I5 J1 K3 F100\nG80\nM30');
  assert.deepEqual(r.warnings, []);
  assert.equal(r.cycles, 1);
  assert.equal(Array.from(r.moves.kind).filter(k => k === K_CFEED).length, 3);
  assert.equal(r.timing.incomplete, false);
});
