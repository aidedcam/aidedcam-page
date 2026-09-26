import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProgram } from '../../js/gcode/parse.js';
import { withDefaults } from '../../js/gcode/settings.js';
import { newContext } from '../../js/gcode/machine.js';
import { readProfile, findBlockByN } from '../../js/gcode/profile.js';

const PROGRAM = [
  'G71 P10 Q20 U0.4 W0.1 F0.25',   // index 0: the cycle line
  'N10 G0 G42 X60',                // 1: P block (Type I, X only)
  'G1 Z-20 F0.1',                  // 2
  'X80',                           // 3
  'Z-40',                          // 4
  'N20 G40 X100',                  // 5: Q block
  'T0202',                         // 6
].join('\n');

function ctxAt(text, index, pos) {
  const ctx = newContext(parseProgram(text), withDefaults());
  ctx.index = index; ctx.state.pos = pos; ctx.state.s = 200;
  return ctx;
}

test('P…Q replayed from the start point; P move kept apart from the body', () => {
  const ctx = ctxAt(PROGRAM, 0, { x: 50, z: 2 });
  const p = readProfile(ctx, 10, 20);
  assert.equal(p.pIndex, 1); assert.equal(p.qIndex, 5);
  assert.equal(p.first.length, 1);
  assert.deepEqual(p.first[0].to, { x: 30, z: 2 });
  assert.deepEqual(p.pEnd, { x: 30, z: 2 });
  assert.equal(p.body.length, 4);
  assert.deepEqual(p.body.map(s => s.to), [{ x: 30, z: -20 }, { x: 40, z: -20 }, { x: 40, z: -40 }, { x: 50, z: -40 }]);
  assert.equal(p.body[0].feed.f, 0.1);
  assert.equal(p.endState.tnrc, 40);
});

test('the sandbox leaves the main context untouched', () => {
  const ctx = ctxAt(PROGRAM, 0, { x: 50, z: 2 });
  readProfile(ctx, 10, 20);
  assert.deepEqual(ctx.state.pos, { x: 50, z: 2 });
  assert.equal(ctx.state.f, null);
  assert.equal(ctx.segments.length, 0);
  assert.equal(ctx.toolChanges.length, 0);
});

test('P/Q not found returns null', () => {
  const ctx = ctxAt(PROGRAM, 0, { x: 50, z: 2 });
  assert.equal(readProfile(ctx, 10, 99), null);
  assert.equal(readProfile(ctx, 77, 20), null);
});

test('a profile earlier in the program is found (G70 case)', () => {
  const blocks = parseProgram('N10 G0 X60\nN20 G1 Z-5 F0.1\nG70 P10 Q20');
  assert.equal(findBlockByN(blocks, 10, 3), 0);
});
