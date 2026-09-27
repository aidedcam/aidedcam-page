import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arcPath } from '../../js/mill/arcs.js';
import { MILL_DEFAULTS } from '../../js/mill/settings.js';

const S = MILL_DEFAULTS;
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);
const last = arc => arc.points[arc.points.length - 1];

test('G17 G3 quarter circle from I/J: length, radius and an exact end point', () => {
  const arc = arcPath({ x: 10, y: 0, z: 0 }, { x: 0, y: 10, z: 0 }, { plane: 17, ccw: true, centre: { ca: 0, cb: 0 } }, S);
  assert.equal(arc.error, null);
  near(arc.length, 10 * Math.PI / 2, 1e-9);
  assert.deepEqual(last(arc), { x: 0, y: 10, z: 0 });
  for (const p of arc.points) near(Math.hypot(p.x, p.y), 10, 1e-9);
  const mid = arc.points[Math.floor(arc.points.length / 2)];
  assert.ok(mid.x > 0 && mid.y > 0, 'a counter-clockwise quarter from +X to +Y stays in the first quadrant');
});

test('G17 G2 with R: a clockwise half circle from left to right goes over the top', () => {
  const arc = arcPath({ x: 50, y: 10, z: 5 }, { x: 70, y: 10, z: 5 }, { plane: 17, ccw: false, r: 10 }, S);
  assert.equal(arc.error, null);
  near(arc.length, 10 * Math.PI, 1e-9);
  near(Math.max(...arc.points.map(p => p.y)), 20, 0.01);
});

test('a negative R asks for the major arc', () => {
  const arc = arcPath({ x: 10, y: 0, z: 0 }, { x: 0, y: 10, z: 0 }, { plane: 17, ccw: true, r: -10 }, S);
  near(arc.length, 10 * 3 * Math.PI / 2, 1e-9);
  // Centre (10, 10): the 270° way round passes (20, 10) and (10, 20).
  near(Math.max(...arc.points.map(p => p.x)), 20, 0.01);
  near(Math.max(...arc.points.map(p => p.y)), 20, 0.01);
});

test('full circle from I/J with no end change; helical Z interpolates along the sweep', () => {
  const flat = arcPath({ x: 10, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { plane: 17, ccw: true, centre: { ca: 0, cb: 0 } }, S);
  near(flat.length, 2 * Math.PI * 10, 1e-9);
  const helix = arcPath({ x: 10, y: 0, z: 0 }, { x: 10, y: 0, z: -1 }, { plane: 17, ccw: true, centre: { ca: 0, cb: 0 } }, S);
  near(helix.length, Math.hypot(2 * Math.PI * 10, 1), 1e-9);
  assert.deepEqual(last(helix), { x: 10, y: 0, z: -1 });
  const half = helix.points[Math.floor(helix.points.length / 2) - 1];
  near(half.z, -0.5, 0.02);
});

test('G18 G2 runs clockwise as seen from +Y: X10 Z0 → X0 Z10 is a quarter through X7.07 Z7.07', () => {
  const arc = arcPath({ x: 10, y: 0, z: 0 }, { x: 0, y: 0, z: 10 }, { plane: 18, ccw: false, centre: { ca: 0, cb: 0 } }, S);
  assert.equal(arc.error, null);
  near(arc.length, 10 * Math.PI / 2, 1e-9);
  const mid = arc.points.find(p => Math.abs(p.x - p.z) < 0.2);
  assert.ok(mid && mid.x > 7 && mid.z > 7 && mid.y === 0);
});

test('G19 plane: Y and Z move, X is the helical axis', () => {
  const arc = arcPath({ x: 0, y: 10, z: 0 }, { x: 2, y: 0, z: 10 }, { plane: 19, ccw: true, centre: { ca: 0, cb: 0 } }, S);
  assert.equal(arc.error, null);
  near(arc.length, Math.hypot(10 * Math.PI / 2, 2), 1e-9);
  assert.deepEqual(last(arc), { x: 2, y: 0, z: 10 });
});

test('radius errors: R shorter than half the chord, and an end point off the I/J radius', () => {
  const small = arcPath({ x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }, { plane: 17, ccw: true, r: 5 }, S);
  assert.equal(small.error, 'radius');
  assert.deepEqual(small.points, [{ x: 20, y: 0, z: 0 }]);
  const off = arcPath({ x: 10, y: 0, z: 0 }, { x: 0, y: 10.5, z: 0 }, { plane: 17, ccw: true, centre: { ca: 0, cb: 0 } }, S);
  assert.equal(off.error, 'radius');
  assert.deepEqual(last(off), { x: 0, y: 10.5, z: 0 });
});

test('chord count follows the chord error and is capped', () => {
  const r10 = arcPath({ x: 10, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { plane: 17, ccw: true, centre: { ca: 0, cb: 0 } }, S);
  assert.equal(r10.points.length, Math.ceil(2 * Math.PI / (2 * Math.acos(1 - 0.01 / 10))));
  const r500 = arcPath({ x: 500, y: 0, z: 0 }, { x: 500, y: 0, z: 0 }, { plane: 17, ccw: true, centre: { ca: 0, cb: 0 } }, S);
  assert.equal(r500.points.length, 256);
});
