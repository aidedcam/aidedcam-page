import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arcFromR, arcFromIK, sampleArc, arcSweep, segmentLength, flatten, firstIntrusion,
  pointSegmentDistance } from '../../js/gcode/geom.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('G3 corner radius: centre inside the part (desktop-CAM rule: Z right, X up, G3 = CCW)', () => {
  // G3 X245.8 Z-21 R1 from X243.8 Z-20 (diameters) → radius coordinates.
  const a = arcFromR({ x: 121.9, z: -20 }, { x: 122.9, z: -21 }, 1, true);
  near(a.cz, -21); near(a.cx, 121.9); near(a.r, 1);
});

test('G2 of the same chord puts the centre on the other side', () => {
  const a = arcFromR({ x: 121.9, z: -20 }, { x: 122.9, z: -21 }, 1, false);
  near(a.cz, -20); near(a.cx, 122.9);
});

test('I/K centre is incremental from the start (I is a radius value)', () => {
  const a = arcFromIK({ x: 10, z: 0 }, 0, -2, true);
  near(a.cx, 10); near(a.cz, -2); near(a.r, 2);
});

test('arc sampling ends on both endpoints and the sweep is +90°', () => {
  const from = { x: 121.9, z: -20 }, to = { x: 122.9, z: -21 };
  const a = arcFromR(from, to, 1, true);
  const pts = sampleArc(from, to, a, 8);
  assert.equal(pts.length, 9);
  near(pts[0].x, from.x); near(pts[8].z, to.z);
  near(arcSweep(from, to, a), Math.PI / 2);
  near(segmentLength({ from, to, arc: a }), Math.PI / 2);
});

test('flatten keeps lines and chords arcs', () => {
  const from = { x: 121.9, z: -20 }, to = { x: 122.9, z: -21 };
  const flat = flatten([{ from: { x: 0, z: 0 }, to: { x: 5, z: 0 }, arc: null },
    { from, to, arc: arcFromR(from, to, 1, true) }], 4);
  assert.equal(flat.length, 1 + 4);
  assert.deepEqual(flat[0], { x1: 0, z1: 0, x2: 5, z2: 0 });
});

test('firstIntrusion: shoulder face, sloped crossing and skim fallback', () => {
  // Normalised frame: d = depth axis, c = cut axis (cuts run toward smaller c).
  const shoulder = [{ d1: 30, c1: -20, d2: 40, c2: -20 }];
  near(firstIntrusion(shoulder, 35, 2, -40), -20);
  const taper = [{ d1: 30, c1: -10, d2: 40, c2: -30 }];     // climbs from d30 at c-10 to d40 at c-30
  near(firstIntrusion(taper, 35, 2, -40), -20);             // crosses d35 half way
  near(firstIntrusion(shoulder, 45, 2, -40), -40);          // nothing above d45 → fallback
});

test('point to segment distance', () => {
  near(pointSegmentDistance({ x: 1, z: 5 }, { x: 0, z: 0 }, { x: 0, z: 10 }), 1);
  near(pointSegmentDistance({ x: 0, z: 12 }, { x: 0, z: 0 }, { x: 0, z: 10 }), 2);
});
