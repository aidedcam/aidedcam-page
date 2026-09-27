import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMill } from '../../js/mill/analyze.js';

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);
const end = (r, i) => Array.from(r.moves.pos.slice(i * 6 + 3, i * 6 + 6));
const start = (r, i) => Array.from(r.moves.pos.slice(i * 6, i * 6 + 3));

test('nothing is drawn until X, Y and Z are all known', () => {
  const r = analyzeMill('G90 G0 X10 Y10\nZ5\nG1 Z0 F100');
  assert.equal(r.moves.count, 1);
  assert.deepEqual(start(r, 0), [10, 10, 5]);
  assert.deepEqual(end(r, 0), [10, 10, 0]);
});

test('G91 moves are incremental from the current position', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z10\nG91 G1 X10 F100\nX10');
  assert.equal(r.moves.count, 2);
  assert.deepEqual(end(r, 1), [20, 0, 10]);
});

test('G20 converts lengths and feed to mm; the result is marked inch', () => {
  const r = analyzeMill('G20 G90 G0 X0 Y0 Z1\nG1 X1 F10');
  assert.equal(r.units, 'inch');
  near(end(r, 0)[0], 25.4, 1e-4);
  near(r.moves.seconds[0], 6, 1e-4);                    // 25.4 mm at 254 mm/min
});

test('numbers without a decimal point follow the integer-unit setting', () => {
  const src = 'G90 G0 X0 Y0 Z0\nG1 X1000 F100';
  assert.equal(end(analyzeMill(src), 0)[0], 1000);
  assert.equal(end(analyzeMill(src, { integerUnit: 'um' }), 0)[0], 1);
  assert.equal(end(analyzeMill('G90 G0 X0 Y0 Z0\nG1 X1000. F100', { integerUnit: 'um' }), 0)[0], 1000);
});

test('G52 shifts the local origin; G92 redefines the current position', () => {
  const g52 = analyzeMill('G52 X100\nG90 G0 X0 Y0 Z0\nG1 X10 F100');
  assert.deepEqual(start(g52, 0), [100, 0, 0]);
  assert.deepEqual(end(g52, 0), [110, 0, 0]);
  const g92 = analyzeMill('G90 G0 X10 Y0 Z0\nG92 X0\nG1 X5 F100');
  assert.deepEqual(start(g92, 0), [10, 0, 0]);
  assert.deepEqual(end(g92, 0), [15, 0, 0]);
});

test('G28 makes the commanded axes unknown; a new work offset makes the position unknown', () => {
  const home = analyzeMill('G90 G0 X0 Y0 Z10\nG1 Z0 F100\nG91 G28 Z0\nG90 G0 X50');
  assert.equal(home.moves.count, 1);
  const wofs = analyzeMill('G90 G54 G0 X0 Y0 Z10\nG1 Z0 F100\nG55 G0 X0 Y0\nZ10\nG1 Z0');
  assert.equal(wofs.moves.count, 2);
  assert.deepEqual(Array.from(wofs.moves.wofs), [0, 1]);
  assert.deepEqual(wofs.workOffsets, ['G54', 'G55']);
});

test('rapid time: the slowest axis decides', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z0\nX300 Y150 Z30');
  near(r.moves.seconds[0], 0.6, 1e-6);                  // 300 mm at 30,000 mm/min
});

test('feed time in G94 and G95; G95 without S is not timeable', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z0\nG94 G1 X100 F500\nG95 G1 X200 F0.2 S1000');
  near(r.moves.seconds[0], 12, 1e-4);
  near(r.moves.seconds[1], 30, 1e-4);
  const noS = analyzeMill('G90 G0 X0 Y0 Z0\nG95 G1 X100 F0.2');
  assert.equal(noS.timing.rows[0].incomplete, true);
  assert.equal(noS.warnings.some(w => w.id === 'no-feed'), false);
});

test('G4 dwell counts in the row: P without a decimal point in ms, X in seconds', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z0\nG4 P1500\nG4 X0.5');
  near(r.timing.rows[0].dwellSeconds, 2, 1e-9);
});

test('rows per M6 with the lathe label rule, contiguous move ranges and tool-change time', () => {
  const src = ['%', 'O0001 (PART)', '(ROUGH)', 'T1 M6', 'G0 X0 Y0 Z0 S1000 M3', 'G1 X10 F100',
    'T2 M6 (FINISH)', 'G1 X20', 'T3 M6', '(DRILL)', 'G1 X30', 'M30'].join('\n');
  const r = analyzeMill(src);
  const rows = r.timing.rows;
  assert.deepEqual(rows.map(x => [x.tool, x.label, x.firstLine]), [['T1', 'ROUGH', 4], ['T2', 'FINISH', 7], ['T3', 'DRILL', 9]]);
  assert.deepEqual(rows.map(x => [x.moveStart, x.moveEnd]), [[0, 1], [1, 2], [2, 3]]);
  near(rows[0].changeSeconds, 5, 1e-9);
  near(rows[0].totalSeconds, 6 + 5, 1e-4);               // 10 mm at F100, plus the M6
  near(r.timing.total, 3 * 11, 1e-3);
});

test('correction % applies to every timed part of a row', () => {
  const r = analyzeMill('T1 M6\nG0 X0 Y0 Z0\nG1 X10 F100', { correctionPct: 10 });
  near(r.timing.rows[0].totalSeconds, (6 + 5) * 1.1, 1e-4);
});

test('a comment on the O line never labels a tool', () => {
  const r = analyzeMill('O0001 (PART NAME)\nG21\nT1 M6\nG0 X0 Y0 Z0\nG1 X10 F100\n(OD ROUGH)');
  assert.equal(r.timing.rows[0].label, 'OD ROUGH');
});

test('arcs arrive as chords sharing the arc time; the line index maps the arc line to all of them', () => {
  const r = analyzeMill('G90 G0 X10 Y0 Z0\nG3 X10 Y0 I-10 J0 F600');
  const chords = r.moves.count;
  assert.ok(chords > 20);
  const total = Array.from(r.moves.seconds).reduce((a, b) => a + b, 0);
  near(total, 60 * (2 * Math.PI * 10) / 600, 1e-3);
  assert.equal(r.lineIndex.offsets[3] - r.lineIndex.offsets[2], chords);
});

// ---- Review Focus (plan): inputs real programs send that the spec does not spell out ----

test('next-tool preselect: "T1 M6" then "T2" at once, "M6" later — rows and H follow the loaded tool', () => {
  const src = ['T1 M6', 'T2', 'G0 X0 Y0 S1000 M3', 'G43 Z50 H1', 'G1 Z0 F100', 'X10', 'M6', 'G0 X0 Y0 S1000 M3', 'G43 Z50 H2', 'G1 Z0 F100'].join('\n');
  const r = analyzeMill(src);
  assert.deepEqual(r.timing.rows.map(x => x.tool), ['T1', 'T2']);
  assert.equal(r.warnings.some(w => w.id === 'h-mismatch'), false);
});

test('rotary words that never move (A0. in a safe-start line) are not flagged; a real A move is', () => {
  const parked = analyzeMill('G0 G90 G54 X0 Y0 A0. S1000 M3\nG43 Z50 H1\nG1 Z0 F100\nX10\nG0 A0.');
  assert.deepEqual(parked.warnings.map(w => w.id), []);
  assert.equal(parked.timing.rows[0].incomplete, false);
  const moved = analyzeMill('G0 X0 Y0 Z0 A0 S1000 M3\nG1 X10 F100\nG0 A90.');
  assert.deepEqual(moved.warnings.map(w => [w.id, w.params.code]), [['unsupported', 'A']]);
  assert.equal(moved.timing.rows[0].incomplete, true);
});

test('messy formatting reads the same as tidy code: lowercase, glued words, tabs, ; comments, CRLF', () => {
  const tidy = analyzeMill('G90 G0 X0 Y0 Z5 S1000 M3\nG1 Z-1 F200\nX50 Y20\nG0 Z5');
  const messy = analyzeMill('g90g0x0y0z5s1000m3 ; start\r\n\tg1z-1.f200\r\nx50.  y20.\r\ng0 z5 (up)');
  assert.deepEqual(Array.from(messy.moves.pos), Array.from(tidy.moves.pos));
  assert.deepEqual(messy.warnings, tidy.warnings);
});

test('garbage input (a binary file read as text) gives an empty result, never a throw', () => {
  let junk = '';
  for (let i = 0; i < 20000; i++) junk += String.fromCharCode((i * 7919) % 256);
  const r = analyzeMill(junk);
  assert.equal(typeof r.moves.count, 'number');
  assert.equal(r.tooLarge, false);
});
