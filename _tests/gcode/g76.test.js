import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProgram } from '../../js/gcode/parse.js';
import { interpret } from '../../js/gcode/interpret.js';
import { g76Depths } from '../../js/gcode/cycles/g76.js';

const round = v => +v.toFixed(6);

test('G76 depth schedule: √n law, minimum depth, allowance, finishing passes', () => {
  const d = g76Depths({ height: 1.3, firstDepth: 0.4, minDepth: 0.1, finishAllow: 0.05, finishPasses: 2 });
  assert.deepEqual(d.map(round), [0.4, 0.565685, 0.69282, 0.8, 0.9, 1, 1.1, 1.2, 1.25, 1.3, 1.3]);
});

test('G76 program: 11 thread passes at the expected radii', () => {
  const run = interpret(parseProgram('G97 S800 G99\nT0707\nG0 X25 Z5\nG76 P020060 Q100 R0.05\nG76 X17.4 Z-20 P1300 Q400 F2'));
  const segs = run.segments.filter(s => s.cycle && s.cycle.code === 76);
  assert.equal(segs.length, 44);
  const threads = segs.filter(s => s.kind === 'thread');
  assert.deepEqual(threads.map(s => round(s.to.x)), [9.6, 9.434315, 9.30718, 9.2, 9.1, 9, 8.9, 8.8, 8.75, 8.7, 8.7]);
  assert.ok(threads.every(s => s.feed.f === 2 && s.to.z === -20));
  assert.deepEqual(segs[43].to, { x: 12.5, z: 5 });
});

test('G76 second start without its own first line reuses the stored first line', () => {
  const run = interpret(parseProgram('G97 S800 G99\nT0707\nG0 X25 Z5\nG76 P020060 Q100 R0.05\nG76 X17.4 Z-20 P1300 Q400 F2\n' +
    'G0 X25 Z6\nG76 X17.4 Z-20 P1300 Q400 F2'));
  const threads = run.segments.filter(s => s.kind === 'thread' && s.cycle.line === 7);
  assert.deepEqual(threads.map(s => round(s.to.x)), [9.6, 9.434315, 9.30718, 9.2, 9.1, 9, 8.9, 8.8, 8.75, 8.7, 8.7]);
  assert.ok(!run.events.some(e => e.type === 'cycle-form'));
});

test('G76 second line with no first line ever: drawn with default finishing, not refused', () => {
  const run = interpret(parseProgram('G97 S800 G99\nG0 X25 Z5\nG76 X17.4 Z-20 P1300 Q400 F2'));
  const threads = run.segments.filter(s => s.kind === 'thread');
  assert.equal(threads.length, 12);
  assert.equal(round(threads[threads.length - 1].to.x), 8.7);
  assert.ok(!run.events.some(e => e.type === 'cycle-form'));
});

test('G76 infeed is drawn radial: every pass enters at the start Z (flank direction unverified, g76.md)', () => {
  const run = interpret(parseProgram('G97 S800 G99\nT0707\nG0 X25 Z5\nG76 P020060 Q100 R0.05\nG76 X17.4 Z-20 P1300 Q400 F2'));
  const threads = run.segments.filter(s => s.kind === 'thread');
  assert.ok(threads.every(s => s.from.z === 5), threads.map(s => s.from.z).join(' '));
});
