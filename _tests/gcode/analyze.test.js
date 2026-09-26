import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, MAX_LINES } from '../../js/gcode/analyze.js';
import { EXAMPLE_PROGRAM } from '../../js/gcode/example.js';

test('the example program: three labelled tools, times, no warnings', () => {
  const r = analyze(EXAMPLE_PROGRAM);
  assert.equal(r.tooLarge, false);
  assert.deepEqual(r.tools.map(t => t.label), ['OD ROUGHING', 'OD FINISHING', 'THREAD M24X2']);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.timing.rows.length, 3);
  assert.ok(r.timing.rows.every(row => !row.incomplete && row.totalSeconds > 0));
  assert.ok(r.segments.some(s => s.cycle && s.cycle.code === 71));
  assert.ok(r.segments.some(s => s.cycle && s.cycle.code === 70));
  assert.ok(r.segments.some(s => s.cycle && s.cycle.code === 76 && s.kind === 'thread'));
});

test('too many lines: refused with a flag, not a hang', () => {
  const r = analyze('\n'.repeat(MAX_LINES + 1));
  assert.equal(r.tooLarge, true);
  assert.equal(r.segments.length, 0);
});

test('a long arc-fitted G71 profile (1,500 arcs) analyses without a stack overflow', () => {
  const arcs = Array.from({ length: 1500 }, (_, i) => `G2 X60 Z${(-(i + 1) * 0.1).toFixed(1)} R0.1`);
  const text = ['G21 G99', 'G50 S3000', 'G96 S200 M3', 'T0101', 'G0 X100 Z2', 'G71 U2 R0.5',
    'G71 P10 Q20 U0.4 W0.1 F0.25', 'N10 G0 X60', 'G1 Z0 F0.1', ...arcs, 'N20 G1 X100', 'M30'].join('\n');
  const r = analyze(text);
  assert.ok(r.segments.some(s => s.cycle && s.cycle.code === 71 && s.kind === 'pass'));
});

test('a milling program is flagged', () => {
  const r = analyze('G17 G90\nG0 X10 Y10 Z5');
  assert.ok(r.warnings.some(w => w.id === 'milling'));
});
