import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arcSweep, segPath, contourPath, boundsOf } from '../../js/laser/drawing.js';

// Model y points up, SVG y points down: every y is negated.
test('a line flips y', () => {
  assert.equal(segPath({ t: 'L', x1: 0, y1: 0, x2: 10, y2: 5 }), 'M0 0L10 -5');
});

test('a circle is two half arcs', () => {
  assert.equal(segPath({ t: 'C', cx: 0, cy: 0, r: 2 }), 'M2 0A2 2 0 1 1 -2 0A2 2 0 1 1 2 0');
});

// Where SVG puts an arc's centre from its end points and flags (SVG 1.1, F.6.5, circular arcs), so the
// tests check geometry rather than a string: a wrong flag moves the centre and draws the arc inside out.
function svgArcCentre(d) {
  const m = d.match(/^M(\S+) (\S+)A(\S+) \S+ 0 ([01]) ([01]) (\S+) (\S+)$/);
  const [x1, y1, r, large, sweep, x2, y2] = m.slice(1).map(Number);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const k = Math.sqrt(Math.max(0, (r * r - dx * dx - dy * dy) / (dx * dx + dy * dy)));
  const s = large === sweep ? -1 : 1;
  return [s * k * dy + (x1 + x2) / 2, -s * k * dx + (y1 + y2) / 2];
}

test('arcs keep their centre: y is flipped, so counter-clockwise draws with sweep 0; the long way sets large-arc', () => {
  const quarter = { t: 'A', cx: 3, cy: 4, r: 10, a0: 0, a1: 90 };
  assert.equal(segPath({ ...quarter, ccw: true }), 'M13 -4A10 10 0 0 0 3 -14');
  assert.equal(arcSweep({ ...quarter, ccw: true }), 90);
  assert.equal(segPath({ ...quarter, ccw: false }), 'M13 -4A10 10 0 1 1 3 -14');
  assert.equal(arcSweep({ ...quarter, ccw: false }), 270);
  assert.equal(arcSweep({ a0: 350, a1: 10, ccw: true }), 20);
  for (const ccw of [true, false]) {
    const [x, y] = svgArcCentre(segPath({ ...quarter, ccw }));
    assert.ok(Math.abs(x - 3) < 1e-9 && Math.abs(y + 4) < 1e-9, `ccw ${ccw}: centre ${x} ${y}`);
  }
});

test('bounds include the extreme points an arc passes through', () => {
  const b = boundsOf({ contours: [{ segs: [{ t: 'A', cx: 0, cy: 0, r: 10, a0: 0, a1: 180, ccw: true }] }] });
  assert.ok(Math.abs(b.minX + 10) < 1e-9 && Math.abs(b.maxX - 10) < 1e-9);
  assert.ok(Math.abs(b.minY) < 1e-9 && Math.abs(b.maxY - 10) < 1e-9);
  assert.deepEqual(boundsOf({ contours: [] }), { minX: 0, minY: 0, maxX: 100, maxY: 100 });
});

test('a contour joins its pieces', () => {
  const c = { segs: [{ t: 'L', x1: 0, y1: 0, x2: 1, y2: 0 }, { t: 'L', x1: 1, y1: 0, x2: 1, y2: 1 }] };
  assert.equal(contourPath(c), 'M0 0L1 0M1 0L1 -1');
});
