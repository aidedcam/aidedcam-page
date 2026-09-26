import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProgram } from '../../js/gcode/parse.js';
import { withDefaults } from '../../js/gcode/settings.js';
import { newContext } from '../../js/gcode/machine.js';
import { interpret, labelTools } from '../../js/gcode/interpret.js';
import { runCycle } from '../../js/gcode/cycles/index.js';

test('tool label: the last comment before the T call, dashes trimmed', () => {
  const blocks = parseProgram('(-----OD ROUGHING-----)\nG50 S2500\nG96 S300 M4\nT3W303\n(START POSITION)');
  const run = interpret(blocks);
  assert.deepEqual(run.tools, [{ tool: 'T3W303', label: 'OD ROUGHING', firstLine: 4 }]);
});

test('tool label falls back to the first comment after the call', () => {
  const blocks = parseProgram('T0101\n(FACE ROUGH)\nG0 X10 Z2');
  assert.equal(labelTools(blocks, [{ tool: 'T0101', line: 1, index: 0 }])[0].label, 'FACE ROUGH');
});

const labels = text => interpret(parseProgram(text)).tools.map(t => [t.tool, t.label]);

test('tool label: a program name on the O line never labels a tool', () => {
  assert.deepEqual(labels('%\nO0001 (PART NAME)\nG21\nT0101\n(OD ROUGH)'), [['T0101', 'OD ROUGH']]);
  assert.deepEqual(labels('O0001 (PART)\nT0101\nG0 X10 Z2'), [['T0101', '']]);
});

test("tool label: the T line's own comment comes first", () => {
  assert.deepEqual(labels('(SECTION BANNER)\nG96 S200\nT0101 (OD FINISH)\n(NOTE)'), [['T0101', 'OD FINISH']]);
});

test('tool label: never taken across another T call', () => {
  const text = '(OD ROUGH)\nT0101\nG0 X50 Z2\nG0 X100 Z100 T0100\nT0202\n(OD FINISH)\nG0 X40 Z2\nT0303 (GROOVE)';
  assert.deepEqual(labels(text), [['T0101', 'OD ROUGH'], ['T0202', 'OD FINISH'], ['T0303', 'GROOVE']]);
  assert.deepEqual(labels('T0101\nG0 X10 Z2\nT0202 (FINISH)'), [['T0101', ''], ['T0202', 'FINISH']]);
});

test('M30 stops interpretation', () => {
  const run = interpret(parseProgram('G0 X10 Z0\nG1 Z-5 F0.1\nM30\nG1 Z-50'));
  assert.equal(run.segments.length, 1);
});

test('macro and expression lines become skipped events', () => {
  const run = interpret(parseProgram('#500 = 0\nG1 X[#1]'));
  assert.deepEqual(run.events.map(e => [e.type, e.reason]), [['skipped', 'macro'], ['skipped', 'expression']]);
});

test('units and control are reported', () => {
  const run = interpret(parseProgram('G20\nG0 X1 Z1'));
  assert.equal(run.units, 'inch');
  assert.equal(run.control, 'fanuc');
});

test('a cycle code without a handler is reported', () => {
  const ctx = newContext(parseProgram('G99'), withDefaults());
  ctx.block = ctx.blocks[0];
  runCycle(ctx, 99, ctx.blocks[0]);
  assert.equal(ctx.events[0].type, 'cycle-unsupported');
});
