import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseProgram } from '../../js/gcode/parse.js';
import { interpret } from '../../js/gcode/interpret.js';

const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('G73: three shifted copies of the profile, returning to A between passes', () => {
  const run = interpret(parseProgram(fixture('g73.nc')));
  const segs = run.segments.filter(s => s.cycle && s.cycle.code === 73);
  assert.equal(segs.length, 18);
  assert.equal(segs.filter(s => s.kind === 'pass').length, 12);
  near(segs[0].to.x, 40.2); near(segs[0].to.z, 2.1);
  near(segs[6].to.x, 35.2);
  near(segs[16].to.x, 50.2); near(segs[16].to.z, -39.9);
  assert.deepEqual(segs[17].to, { x: 50, z: 2 });
  assert.equal(run.cycles[0].type, 'I');
});

test('G73 second line with no first line ever: the pass count is unknown, so cycle-form', () => {
  const run = interpret(parseProgram('G99 G97 S500\nG0 X100 Z2\nG73 P10 Q20 U0.4 W0.1 F0.25\nN10 G0 X60\nG1 Z-20\nN20 X100'));
  assert.ok(run.events.some(e => e.type === 'cycle-form'));
  assert.equal(run.segments.filter(s => s.cycle).length, 0);
});

test('a second G73 reuses the stored first line', () => {
  const text = fixture('g73.nc').replace('M30', 'G0 X100 Z2\nG73 P10 Q20 U0.4 W0.1 F0.25\nM30');
  const run = interpret(parseProgram(text));
  assert.equal(run.segments.filter(s => s.cycle && s.cycle.line === 15 && s.kind === 'pass').length, 12);
});
