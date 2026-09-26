import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseProgram } from '../../js/gcode/parse.js';
import { interpret } from '../../js/gcode/interpret.js';

const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const cycleSegs = (run, code) => run.segments.filter(s => s.cycle && s.cycle.code === code);

test('G71 OD: 10 passes, ends from the desktop planner intrusion search', () => {
  const run = interpret(parseProgram(fixture('g71-od.nc')));
  const passes = cycleSegs(run, 71).filter(s => s.kind === 'pass');
  assert.deepEqual(passes.map(p => +p.from.x.toFixed(6)), [48, 46, 44, 42, 40, 38, 36, 34, 32, 30.2]);
  assert.deepEqual(passes.map(p => +p.to.z.toFixed(6)), [-39.9, -39.9, -39.9, -39.9, -19.9, -19.9, -19.9, -19.9, -19.9, -19.9]);
  assert.ok(passes.every(p => p.feed.f === 0.25));
});

test('G71 OD: chained motion, 45° retract, one return to A', () => {
  const run = interpret(parseProgram(fixture('g71-od.nc')));
  const segs = cycleSegs(run, 71);
  assert.equal(segs.length, 41);
  assert.equal(segs[0].kind, 'rapid');
  assert.deepEqual(segs[0].from, { x: 50, z: 2 });
  assert.deepEqual(segs[0].to, { x: 48, z: 2 });
  assert.equal(segs[2].kind, 'retract');
  near(segs[2].to.x, 48.353553); near(segs[2].to.z, -39.546447);
  assert.deepEqual(segs[40].to, { x: 50, z: 2 });
});

test('G71: the profile blocks are skipped, not executed as normal moves', () => {
  const run = interpret(parseProgram(fixture('g71-od.nc')));
  const profileLines = new Set([12, 13, 14, 15, 16]);
  assert.equal(run.segments.filter(s => !s.cycle && profileLines.has(s.line)).length, 0);
});

test('G71 record: Type I profile, allowances, frame', () => {
  const run = interpret(parseProgram(fixture('g71-od.nc')));
  const rec = run.cycles.find(c => c.code === 71);
  assert.equal(rec.type, 'I');
  near(rec.allowX, 0.2); near(rec.allowZ, 0.1);
  assert.equal(rec.frame.sx, 1); assert.equal(rec.frame.sz, 1);
});

test('G71 ID: mirrored frame, retract toward the centre', () => {
  const run = interpret(parseProgram(fixture('g71-id.nc')));
  const segs = cycleSegs(run, 71);
  const passes = segs.filter(s => s.kind === 'pass');
  assert.deepEqual(passes.map(p => +p.from.x.toFixed(6)), [11, 12, 13, 14, 15, 16, 17, 18, 19, 19.8]);
  near(passes[0].to.z, -19.9);
  near(passes[4].to.z, -9.9);
  near(passes[9].to.z, -9.9);
  near(segs[2].to.x, 10.646447);
});

test('G72 facing: passes step in Z and cut along X', () => {
  const run = interpret(parseProgram(fixture('g72-face.nc')));
  const passes = cycleSegs(run, 72).filter(s => s.kind === 'pass');
  assert.deepEqual(passes.map(p => +p.from.z.toFixed(6)), [0, -2, -4, -4.9]);
  assert.ok(passes.every(p => p.from.x === 51 && Math.abs(p.to.x - 30.2) < 1e-9));
  const segs = cycleSegs(run, 72);
  assert.deepEqual(segs[segs.length - 1].to, { x: 51, z: 2 });
  assert.equal(run.cycles[0].type, 'I');
});

test('one-line form: D is the depth, the retract comes from settings', () => {
  const text = 'G99 G97 S500\nT0101\nG0 X100 Z2\nG71 P10 Q20 U0.4 W0.1 D2 F0.25\nN10 G0 X60\nG1 Z-20\nX80\nZ-40\nN20 X100';
  const run = interpret(parseProgram(text));
  assert.equal(run.control, 'haas');
  assert.equal(cycleSegs(run, 71).filter(s => s.kind === 'pass').length, 10);
});

test('P/Q not found: reported, nothing drawn, no crash', () => {
  const run = interpret(parseProgram('G99 G97 S500\nG0 X100 Z2\nG71 U2 R0.5\nG71 P10 Q99 U0.4 W0.1 F0.25\nN10 G0 X60\nG1 Z-20'));
  assert.ok(run.events.some(e => e.type === 'pq-not-found'));
  assert.equal(cycleSegs(run, 71).length, 0);
});

const PROFILE = 'N10 G0 X60\nG1 Z-20\nX80\nZ-40\nN20 X100\n';
const passesOf = (run, line) => run.segments.filter(s => s.kind === 'pass' && s.cycle.line === line);

test('a second G71 reuses the stored first line; a first line that omits R keeps the stored R', () => {
  const text = 'G99 G97 S500\nT0101\nG0 X100 Z2\nG71 U2 R0.5\nG71 P10 Q20 U0.4 W0.1 F0.25\n' + PROFILE +
    'G0 X100 Z2\nG71 P10 Q20 U0.4 W0.1 F0.25\nG71 U5\nG71 P10 Q20 U0.4 W0.1 F0.25';
  const run = interpret(parseProgram(text));
  assert.equal(passesOf(run, 5).length, 10);
  assert.equal(passesOf(run, 12).length, 10);
  const third = passesOf(run, 14);
  assert.deepEqual(third.map(p => +p.from.x.toFixed(6)), [45, 40, 35, 30.2]);
  const retract = run.segments.find(s => s.kind === 'retract' && s.cycle.line === 14);
  near(retract.to.x - retract.from.x, 0.5 * Math.SQRT1_2);
  assert.ok(!run.events.some(e => e.type === 'cycle-form'));
});

test('the form comes from the block: P Q D is one-line even after a stored first line', () => {
  const text = 'G99 G97 S500\nG0 X100 Z2\nG71 U3 R0.5\nG71 P10 Q20 U0.4 W0.1 D2 F0.25\n' + PROFILE;
  assert.equal(cycleSegs(interpret(parseProgram(text)), 71).filter(s => s.kind === 'pass').length, 10);
});

test('G71 second line with no first line ever: cycle-form, nothing drawn', () => {
  const run = interpret(parseProgram('G99 G97 S500\nG0 X100 Z2\nG71 P10 Q20 U0.4 W0.1 F0.25\n' + PROFILE));
  assert.ok(run.events.some(e => e.type === 'cycle-form'));
  assert.equal(cycleSegs(run, 71).length, 0);
});
