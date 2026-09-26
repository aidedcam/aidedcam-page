import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseProgram } from '../../js/gcode/parse.js';
import { interpret } from '../../js/gcode/interpret.js';

const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('G70 re-traces P…Q from A with the profile feed, then rapids back to A', () => {
  const run = interpret(parseProgram(fixture('g71-od.nc')));
  const g70 = run.segments.filter(s => s.cycle && s.cycle.code === 70);
  assert.equal(g70.length, 6);
  assert.equal(g70[0].kind, 'rapid');
  assert.deepEqual(g70[0].to, { x: 30, z: 2 });
  assert.equal(g70[1].kind, 'feed');
  assert.equal(g70[1].feed.f, 0.1);
  assert.equal(g70[1].line, 13);                       // the profile line, for hover linking
  assert.deepEqual(g70[5].from, { x: 50, z: -40 });
  assert.deepEqual(g70[5].to, { x: 50, z: 2 });
});

test('whole fixture: G71 (41) + G70 (6) + final G0 (1) = 48 segments', () => {
  const run = interpret(parseProgram(fixture('g71-od.nc')));
  assert.equal(run.segments.length, 48);
  assert.deepEqual(run.segments[47].to, { x: 75, z: 100 });
});
