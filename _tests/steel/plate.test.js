import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arcOf, ringArea, ringLength, ringPolygon, polygonArea, polygonBox, holeArea, plateFigures } from '../../js/steel/plate.js';

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} vs ${b}`);
const rect = (w, h) => [{ x: 0, y: 0, r: 0 }, { x: w, y: 0, r: 0 }, { x: w, y: h, r: 0 }, { x: 0, y: h, r: 0 }];
// The end plate of the example: 200 × 400, corners of radius 20, drawn anticlockwise (r > 0: the centre left).
const rounded = [{ x: 20, y: 0, r: 0 }, { x: 180, y: 0, r: 20 }, { x: 200, y: 20, r: 0 }, { x: 200, y: 380, r: 20 }, { x: 180, y: 400, r: 0 },
  { x: 20, y: 400, r: 20 }, { x: 0, y: 380, r: 0 }, { x: 0, y: 20, r: 20 }];

test('an arc: its centre left of the way for r > 0, right for r < 0; a chord longer than 2r is straight', () => {
  const a = arcOf({ x: 180, y: 0 }, { x: 200, y: 20 }, 20);
  near(a.cx, 180); near(a.cy, 20); near(a.sweep, Math.PI / 2);
  const b = arcOf({ x: 180, y: 0 }, { x: 200, y: 20 }, -20);
  near(b.cx, 200); near(b.cy, 0); near(b.sweep, -Math.PI / 2);
  assert.equal(arcOf({ x: 0, y: 0 }, { x: 100, y: 0 }, 10), null);
  assert.equal(arcOf({ x: 0, y: 0 }, { x: 100, y: 0 }, 0), null);
});

test('rings: shoelace plus segments, exact; rounded corners take (4 − π) r² off a rectangle', () => {
  near(ringArea(rect(300, 300)), 90000);
  near(-ringArea([...rect(300, 300)].reverse()), 90000);
  near(ringArea(rounded), 80000 - (4 - Math.PI) * 400);
  near(ringLength(rounded), 2 * (160 + 360) + 2 * Math.PI * 20);
});

test('a circle of two half arcs (as Tekla writes round plates and holes): area, length, and its box from the arcs', () => {
  // A disc of Ø233.7 from (0,0) to (0,233.7): it lies on both sides of x = 0, as its holes at negative x show.
  const disc = [{ x: 0, y: 0, r: 116.85 }, { x: 0, y: 233.7, r: 116.85 }];
  near(ringArea(disc), Math.PI * 116.85 ** 2);
  near(ringLength(disc), 2 * Math.PI * 116.85);
  const box = polygonBox(ringPolygon(disc));
  near(box.x0, -116.85, 1e-3); near(box.x1, 116.85, 1e-3); near(box.y1 - box.y0, 233.7, 1e-6);
  near(-ringArea([{ x: 130, y: 150, r: -20 }, { x: 170, y: 150, r: -20 }]), Math.PI * 400, 1e-9);
});

test('the polygon puts points on the arcs: its area comes within 1 % of the exact one', () => {
  const poly = ringPolygon(rounded);
  assert.ok(poly.length / 2 > 8 + 4 * 6, `${poly.length / 2} points`);
  near(polygonArea(poly), ringArea(rounded), 1e-3);
});

test('holes: round, slotted, and a blind hole by its depth', () => {
  near(holeArea({ d: 22, depth: 0 }, 15), Math.PI * 121);
  near(holeArea({ d: 22, depth: 0, slot: { l: 30 } }, 15), Math.PI * 121 + 660);
  near(holeArea({ d: 22, depth: 5 }, 15), Math.PI * 121 / 3);
  near(holeArea({ d: 22, depth: 20 }, 15), Math.PI * 121, 1e-9);
});

test('a plate: outer ring less inner rings and holes; kg at 7,850 kg/m³; m² both faces and the edges (bores too)', () => {
  const base = plateFigures({ outer: rect(300, 300), inner: [[{ x: 130, y: 150, r: -20 }, { x: 170, y: 150, r: -20 }]], holes: [50, 250].flatMap(x => [{ d: 26, depth: 0 }, { d: 26, depth: 0 }]), t: 20 });
  const net = 90000 - Math.PI * 400 - 4 * Math.PI * 169;
  near(base.area, net);
  near(base.kg, net * 20 * 7.85e-6);
  near(base.edge, 1200 + 2 * Math.PI * 20 + 4 * Math.PI * 26);
  near(base.m2, (2 * net + base.edge * 20) * 1e-6);
  near(base.kg, 13.5992, 1e-4);
  assert.ok(Math.abs(base.check / base.kg - 1) < 0.002, 'the polygon check agrees');
  assert.deepEqual(base.box, { x0: 0, y0: 0, x1: 300, y1: 300 });
  const end = plateFigures({ outer: rounded, holes: Array(6).fill({ d: 22, depth: 0 }), t: 15 });
  near(end.kg, 9.1109, 1e-4);
});
