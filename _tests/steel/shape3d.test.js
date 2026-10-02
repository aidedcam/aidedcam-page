import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pieceSlabs, slabsBox, cutRect, circle } from '../../js/steel/shape3d.js';
import { polygonArea } from '../../js/steel/plate.js';
import { exampleRows } from './example-rows.mjs';

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const byMark = Object.fromEntries(exampleRows().map(r => [r.mark, r.nc]));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

test('an I section: web and two flanges, each extruded by its own thickness, in right-handed frames', () => {
  const s = pieceSlabs(byMark.C1);
  assert.deepEqual(s.map(x => [x.part, x.depth]), [['web', 6.5], ['flange', 10], ['flange', 10]]);
  for (const x of s) assert.deepEqual(cross(x.frame.u, x.frame.v), x.frame.w);
  assert.deepEqual(s[1].holes.length, 4, 'the four holes of face o in the top flange');
  assert.deepEqual(slabsBox(s), { min: [0, 0, 0], max: [4000, 200, 190] });
  assert.deepEqual(s[0].frame.o, [0, 103.25, 0], 'the web on the centre line');

  // Web slab v-extent clipped to clear height between flanges
  const c1 = byMark.C1;
  const vValues = s[0].outline.filter((_, i) => i % 2 === 1);
  near(Math.min(...vValues), c1.tf);
  near(Math.max(...vValues), c1.h - c1.tf);

  // Hole position: take first hole on top flange (face o), map through slab frame
  const topFlange = s[1];
  assert.equal(topFlange.holes.length, 4);
  const hole = topFlange.holes[0];
  const hx = hole.reduce((sum, v, i) => i % 2 === 0 ? sum + v : sum, 0) / (hole.length / 2);
  const hy = hole.reduce((sum, v, i) => i % 2 === 1 ? sum + v : sum, 0) / (hole.length / 2);
  const { o, u, v } = topFlange.frame;
  const px = o[0] + u[0] * hx + v[0] * hy;
  const py = o[1] + u[1] * hx + v[1] * hy;
  const pz = o[2] + u[2] * hx + v[2] * hy;
  near(px, c1.holes[0].x, 0.01);
  near(py, c1.holes[0].y, 0.01);
  near(pz, c1.h - c1.tf, 0.01);
});

test('header cut angles lean the ends of a face without a contour; a contour wins', () => {
  assert.deepEqual(cutRect(1000, 100, 0, 0), [0, 0, 1000, 0, 1000, 100, 0, 100]);
  const r = cutRect(1000, 100, 0, 45);
  near(r[2], 1000 - 100); near(r[4], 1000);
  const web = pieceSlabs(byMark.R1)[0];
  const R1 = byMark.R1, { h, tf } = R1;
  const full = cutRect(R1.length, h, R1.webStart, R1.webEnd);
  // the slanted end edge runs from (full[2], 0) to (full[4], h)
  const xAt = v => full[2] + (full[4] - full[2]) * v / h;
  const has = (x, v) => web.outline.some((_, i) => i % 2 === 0 && Math.abs(web.outline[i] - x) < 0.01 && Math.abs(web.outline[i + 1] - v) < 0.01);
  assert.ok(has(xAt(tf), tf), 'x at the lower flange face');
  assert.ok(has(xAt(h - tf), h - tf), 'x at the upper flange face');
  const e = Math.tan(5.7 * Math.PI / 180) * h;
  near(xAt(tf), R1.length - e + e * tf / h, 1e-6);
  near(xAt(tf), 4996.12, 0.01);
  near(xAt(h - tf), 5023.93, 0.01);
  assert.equal(web.holes.length, 8);
  assert.equal(pieceSlabs(byMark.R1)[1].outline[2], 5025, 'the flanges have no cut');
});

test('a plate: one slab from its AK contour (arcs as points) with its IK contours and holes as openings', () => {
  const [hp] = pieceSlabs(byMark.HP1);
  assert.deepEqual([hp.part, hp.depth, hp.holes.length], ['plate', 15, 6]);
  near(polygonArea(hp.outline), 80000 - (4 - Math.PI) * 400, 15);
  const [bp] = pieceSlabs(byMark.BP1);
  assert.equal(bp.holes.length, 5, 'the grout hole (an inner contour of two arcs) and four bolt holes');
  near(Math.abs(polygonArea(bp.holes[0])), Math.PI * 400, 15);
});

test('a hollow section: four walls; an angle: two legs; a tube or bar: its section along the length', () => {
  const pu = pieceSlabs(byMark.PU1);
  assert.deepEqual(pu.map(x => x.part), ['web', 'web', 'flange', 'flange']);
  assert.deepEqual(slabsBox(pu), { min: [0, 0, 0], max: [13500, 50, 100] });
  assert.equal(pu[3].holes.length, 4, 'the holes of face u in the bottom wall');
  const cl = pieceSlabs(byMark.CL1);
  assert.deepEqual(cl.map(x => [x.part, x.depth, x.holes.length]), [['web', 8, 2], ['flange', 8, 0]]);
  const tube = pieceSlabs({ ...byMark.C1, code: 'RO', h: 114.3, b: 114.3, tw: 5, tf: 5, holes: [], contours: [] });
  assert.deepEqual([tube.length, tube[0].depth, tube[0].holes.length, tube[0].frame.w], [1, 4000, 1, [1, 0, 0]]);
  const bar = pieceSlabs({ ...byMark.C1, code: 'RU', h: 40, holes: [], contours: [] });
  assert.equal(bar[0].holes.length, 0);
});

test('a special profile is its box; a piece without a length or dimensions has no slabs', () => {
  const so = pieceSlabs({ ...byMark.C1, code: 'SO', h: 175, b: 81, holes: [], contours: [] });
  assert.deepEqual([so.length, so[0].part, so[0].outline], [1, 'body', [0, 0, 81, 0, 81, 175, 0, 175]]);
  assert.deepEqual(pieceSlabs({ ...byMark.C1, length: 0 }), []);
  assert.deepEqual(pieceSlabs({ ...byMark.C1, code: 'SO', h: 0, b: 0 }), []);
  assert.equal(circle(0, 0, 1, 8).length, 16);
});

test('a sloped web cut keeps its slant where the web is clipped between the flanges', () => {
  const c1 = byMark.C1;
  const { h, tf } = c1;
  const p = { ...c1, webStart: 45 };
  const full = cutRect(p.length, h, 45, p.webEnd);
  // the slanted start edge runs from (full[0], 0) to (full[6], h); interpolate x at a given v
  const xAt = v => full[0] + (full[6] - full[0]) * v / h;
  const web = pieceSlabs(p)[0].outline;
  const has = (x, v) => web.some((_, i) => i % 2 === 0 && Math.abs(web[i] - x) < 0.01 && Math.abs(web[i + 1] - v) < 0.01);
  near(xAt(tf), h - tf, 0.01);
  near(xAt(h - tf), tf, 0.01);
  assert.ok(has(xAt(tf), tf), 'x at the lower flange face');
  assert.ok(has(xAt(h - tf), h - tf), 'x at the upper flange face');
});
