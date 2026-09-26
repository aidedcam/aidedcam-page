import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapGCode, isOneLineRough, detectControl } from '../../js/gcode/dialects.js';
import { withDefaults, DEFAULT_SETTINGS } from '../../js/gcode/settings.js';
import { parseLine, parseProgram } from '../../js/gcode/parse.js';

test('system A is unchanged', () => {
  assert.equal(mapGCode(71, 'A'), 71);
  assert.equal(mapGCode(90, 'A'), 90);
});

test('system B maps box cycles, feed modes and abs/inc', () => {
  assert.equal(mapGCode(77, 'B'), 90);
  assert.equal(mapGCode(78, 'B'), 92);
  assert.equal(mapGCode(79, 'B'), 94);
  assert.equal(mapGCode(94, 'B'), 98);
  assert.equal(mapGCode(95, 'B'), 99);
  assert.equal(mapGCode(92, 'B'), 50);
  assert.equal(mapGCode(90, 'B'), 'ABS');
  assert.equal(mapGCode(91, 'B'), 'INC');
  assert.equal(mapGCode(98, 'B'), 'RET');
  assert.equal(mapGCode(71, 'B'), 71);
});

test('system C also renumbers the repetitive cycles and inch/metric', () => {
  assert.equal(mapGCode(72, 'C'), 70);
  assert.equal(mapGCode(73, 'C'), 71);
  assert.equal(mapGCode(78, 'C'), 76);
  assert.equal(mapGCode(20, 'C'), 90);
  assert.equal(mapGCode(70, 'C'), 20);
  assert.equal(mapGCode(71, 'C'), 21);
});

test('one-line rough form has P, Q and D in one block', () => {
  assert.equal(isOneLineRough(parseLine('G71 P10 Q20 U0.4 W0.1 D1.5 F0.25', 1)), true);
  assert.equal(isOneLineRough(parseLine('G71 P10 Q20 U0.4 W0.1 F0.25', 1)), false);
});

test('auto control detection', () => {
  assert.equal(detectControl(parseProgram('G71 U1.5 R0.5\nG71 P10 Q20 U0.4 W0.1 F0.25')), 'fanuc');
  assert.equal(detectControl(parseProgram('G71 P10 Q20 U0.4 W0.1 D1.5 F0.25')), 'haas');
});

test('settings defaults and overrides', () => {
  assert.equal(DEFAULT_SETTINGS.rapidX, 20000);
  const s = withDefaults({ system: 'B' });
  assert.equal(s.system, 'B');
  assert.equal(s.xDiameter, true);
});
