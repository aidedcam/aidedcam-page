import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseProgram } from '../../js/gcode/parse.js';
import { interpret } from '../../js/gcode/interpret.js';
import { withDefaults } from '../../js/gcode/settings.js';
import { segmentSeconds, computeTimes, formatDuration } from '../../js/gcode/time.js';

const S = withDefaults();
const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const seg = (from, to, feed, spindle, kind = 'feed') => ({ kind, from, to, arc: null, feed, spindle, cycle: null, tool: 'T1' });

test('G98 feed per minute', () => {
  near(segmentSeconds(seg({ x: 10, z: 0 }, { x: 10, z: -10 }, { mode: 'min', f: 100 }, { mode: 'rpm', s: 500 }), S), 6);
});

test('G99 feed per rev at fixed rpm', () => {
  near(segmentSeconds(seg({ x: 10, z: 0 }, { x: 10, z: -10 }, { mode: 'rev', f: 0.2 }, { mode: 'rpm', s: 1000 }), S), 3);
});

test('G96 radial move above the clamp radius (closed form)', () => {
  near(segmentSeconds(seg({ x: 50, z: 0 }, { x: 30, z: 0 }, { mode: 'rev', f: 0.2 }, { mode: 'css', s: 200, max: 3000 }), S), 7.539822);
});

test('G96 facing to the centre crosses the G50 clamp', () => {
  near(segmentSeconds(seg({ x: 20, z: 0 }, { x: 0, z: 0 }, { mode: 'rev', f: 0.2 }, { mode: 'css', s: 200, max: 3000 }), S), 2.415472);
});

test('G96 to centre without G50 stays finite', () => {
  const t = segmentSeconds(seg({ x: 20, z: 0 }, { x: 0, z: 0 }, { mode: 'rev', f: 0.2 }, { mode: 'css', s: 200, max: null }), S);
  assert.ok(Number.isFinite(t));
  near(t, 1.884956);
});

test('rapid: the slower axis decides', () => {
  near(segmentSeconds(seg({ x: 0, z: 0 }, { x: 25, z: 100 }, { mode: 'rev', f: null }, { mode: 'rpm', s: null }, 'rapid'), S), 0.3);
});

test('thread: lead per rev, even under G98', () => {
  // 25 mm at 1.5 mm lead and 800 rpm: 25 / 1200 min = 1.25 s
  near(segmentSeconds(seg({ x: 9.6, z: 5 }, { x: 9.6, z: -20 }, { mode: 'min', f: 1.5 }, { mode: 'rpm', s: 800 }, 'thread'), S), 1.25);
});

test('missing feed gives null', () => {
  assert.equal(segmentSeconds(seg({ x: 10, z: 0 }, { x: 10, z: -10 }, { mode: 'rev', f: null }, { mode: 'rpm', s: 500 }), S), null);
});

test('per-tool summary of the G71/G70 fixture, with tool change and correction', () => {
  const text = readFileSync(new URL('./fixtures/g71-od.nc', import.meta.url), 'utf8');
  const base = computeTimes(interpret(parseProgram(text)), S);
  assert.equal(base.rows.length, 1);
  const r = base.rows[0];
  assert.equal(r.tool, 'T0101');
  assert.equal(r.cycles, 2);
  assert.equal(r.passes, 10);
  assert.equal(r.changeSeconds, 3);
  assert.equal(r.incomplete, false);
  near(r.totalSeconds, r.cutSeconds + r.rapidSeconds + r.changeSeconds + r.dwellSeconds, 1e-9);
  const corrected = computeTimes(interpret(parseProgram(text)), withDefaults({ correctionPct: 10 }));
  near(corrected.total, base.total * 1.1, 1e-6);
});

const timesOf = text => computeTimes(interpret(parseProgram(text)), S);
const OK_TOOL = 'G21 G99\nG97 S1000 M3\nT0101\nG0 X50 Z2\nG1 Z-20 F0.2\nG0 X100 Z100\n';

test('an unsupported cycle marks only its own tool row incomplete', () => {
  const t = timesOf(OK_TOOL + 'T0505\nG0 X0 Z5\nG83 Z-30. Q5000 R-3. F0.1\nG80\nG0 X100 Z100');
  assert.deepEqual(t.rows.map(r => [r.tool, r.incomplete]), [['T0101', false], ['T0505', true]]);
  assert.equal(t.incomplete, true);
});

test('failed cycles (P/Q not found, missing words, unknown start) mark the row incomplete', () => {
  const programs = {
    'pq-not-found': 'G0 X100 Z2\nG71 U2 R0.5\nG71 P10 Q99 U0.4 W0.1 F0.25\nN10 G0 X60\nG1 Z-20',
    'cycle-form': 'G0 X100 Z2\nG71 P10 Q20 U0.4 W0.1 F0.25\nN10 G0 X60\nG1 Z-20\nN20 X100',
    'cycle-no-start': 'G28 U0 W0\nG74 R1.\nG74 Z-20. Q5000 F0.1',
  };
  for (const [id, body] of Object.entries(programs)) {
    const t = timesOf(OK_TOOL + 'T0202\n' + body);
    assert.deepEqual(t.rows.map(r => [r.tool, r.incomplete]), [['T0101', false], ['T0202', true]], id);
  }
});

test('offset-cancel T calls add no rows and no tool-change time', () => {
  const t = timesOf('G21 G99\nG97 S1000 M3\nT0101\nG0 X50 Z2\nG1 Z-20 F0.2\nG0 X100 Z100 T0100\n' +
    'T0202\nG0 X40 Z2\nG1 Z-10 F0.2\nG0 X100 Z100 T0200\nM30');
  assert.deepEqual(t.rows.map(r => [r.tool, r.changeSeconds]), [['T0101', 3], ['T0202', 3]]);
});

test('box cycles: each G90/G92/G94 block, modal repeats included, counts one pass', () => {
  const t = timesOf('G21 G99\nG97 S1000 M3\nT0101\nG0 X52 Z2\nG90 X46 Z-30 F0.2\nX42\nX38\nG0 X100 Z100\n' +
    'T0202\nG0 X52 Z2\nG94 X20 Z-1 F0.2\nZ-2\nG0 X100 Z100\n' +
    'T0303\nG0 X30 Z5\nG92 X23 Z-20 F1.5\nX22.5\nX22.2\nG0 X100 Z100');
  assert.deepEqual(t.rows.map(r => [r.tool, r.passes]), [['T0101', 3], ['T0202', 2], ['T0303', 3]]);
});

test('duration format', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(75), '1:15');
  assert.equal(formatDuration(3725), '1:02:05');
  assert.equal(formatDuration(null), '–');
});
