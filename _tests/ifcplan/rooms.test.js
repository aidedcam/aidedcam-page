import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shoelace, roomArea, labelPoint, labelLines, outlineOf, inside } from '../../js/ifcplan/rooms.js';

const L = [0, 0, 10, 0, 10, 2, 2, 2, 2, 10, 0, 10];                // an L, 2 m wide arms: 36 m²

test('shoelace area, whichever way the outline runs', () => {
  assert.equal(shoelace([0, 0, 4, 0, 4, 3, 0, 3]), 12);
  assert.equal(shoelace([0, 0, 0, 3, 4, 3, 4, 0]), 12);
  assert.equal(shoelace(L), 36);
  assert.equal(shoelace([]), 0);
});

test('the area: Qto_SpaceBaseQuantities first (net, then gross), else the outline, at 2 decimals on the label', () => {
  assert.deepEqual(roomArea({ net: 43.61, gross: 44 }, L), { areaM2: 43.61, areaFrom: 'qto' });
  assert.deepEqual(roomArea({ gross: 44 }, L), { areaM2: 44, areaFrom: 'qto' });
  assert.deepEqual(roomArea({}, L), { areaM2: 36, areaFrom: 'outline' });
  assert.deepEqual(roomArea({ net: 0 }, L), { areaM2: 36, areaFrom: 'outline' }, 'a zero quantity is not an area');
  assert.deepEqual(roomArea({}, []), { areaM2: null, areaFrom: null });
  assert.deepEqual(labelLines({ name: 'Σαλόνι', longName: '', areaM2: 24.5 }), ['Σαλόνι', '24.50 m²']);
});

test('the label point lies inside the outline, also in an L-shape whose centroid is outside it', () => {
  const [x, y] = labelPoint(L);
  assert.ok(inside(x, y, L), `${x}, ${y}`);
  assert.ok(!inside(3.3, 3.3, L), 'the centroid region is outside the L');
  assert.ok(Math.min(x, y) > 1 && Math.max(x, y) < 1.3, 'in the corner of the L, over 1 m from every edge');
  const [cx, cy] = labelPoint([0, 0, 4, 0, 4, 3, 0, 3]);
  assert.ok(Math.abs(cx - 2) < 0.02 && Math.abs(cy - 1.5) < 0.02, `${cx}, ${cy}`);
});

test('Name, then LongName when both are present and differ; the area line last', () => {
  assert.deepEqual(labelLines({ name: '1.01', longName: 'Υπνοδωμάτιο', areaM2: 36.1 }), ['1.01', 'Υπνοδωμάτιο', '36.10 m²']);
  assert.deepEqual(labelLines({ name: 'Κουζίνα', longName: 'Κουζίνα', areaM2: 27.74 }), ['Κουζίνα', '27.74 m²']);
  assert.deepEqual(labelLines({ name: '', longName: 'Hall', areaM2: null }), ['Hall']);
  assert.deepEqual(labelLines({ name: ' A\r\nB ', longName: null, areaM2: 1.005 }), ['A B', '1.00 m²'], 'one line each, trimmed');
});

test('the outline is the largest closed loop of the room cut', () => {
  const loops = [{ pts: [0, 0, 1, 0, 1, 1, 0, 1], closed: true }, { pts: L, closed: true }, { pts: [0, 0, 50, 0, 50, 50], closed: false }];
  assert.deepEqual(outlineOf(loops), L);
  assert.deepEqual(outlineOf([{ pts: [0, 0, 5, 5], closed: false }]), []);
});

test('an outline area less the room\'s own holes (a column, a shaft) inside it; the quantity set wins as before', () => {
  const room = [0, 0, 10, 0, 10, 5, 0, 5], hole = [2, 2, 3, 2, 3, 3, 2, 3];
  const loops = [{ pts: room, closed: true }, { pts: hole, closed: true }, { pts: [20, 20, 21, 20, 21, 21, 20, 21], closed: true }, { pts: [4, 1, 5, 1, 5, 2], closed: false }];
  assert.deepEqual(outlineOf(loops), room);
  assert.deepEqual(roomArea({}, room, loops), { areaM2: 49, areaFrom: 'outline' });
  assert.deepEqual(labelLines({ name: 'A', areaM2: roomArea({}, room, loops).areaM2 }), ['A', '49.00 m²']);
  assert.deepEqual(roomArea({}, room), { areaM2: 50, areaFrom: 'outline' }, 'no loops: the outline alone');
  assert.deepEqual(roomArea({ net: 50 }, room, loops), { areaM2: 50, areaFrom: 'qto' });
});

test('non-finite quantities are no area; the shoelace is exact far from the origin', () => {
  assert.deepEqual(roomArea({ net: Infinity, gross: NaN }, [0, 0, 4, 0, 4, 3, 0, 3]), { areaM2: 12, areaFrom: 'outline' });
  assert.deepEqual(labelLines({ name: 'A', areaM2: Infinity }), ['A']);
  assert.deepEqual(labelLines({ name: 'A', areaM2: NaN }), ['A']);
  const far = [1000000.5, 4000000.25, 1000013, 4000000.25, 1000013, 4000004.5, 1000000.5, 4000004.5];
  assert.ok(Math.abs(shoelace(far) - 12.5 * 4.25) <= 1e-9, String(shoelace(far)));
  const hole = [1000002, 4000001, 1000003, 4000001, 1000003, 4000002, 1000002, 4000002];
  assert.ok(Math.abs(roomArea({}, far, [{ pts: far, closed: true }, { pts: hole, closed: true }]).areaM2 - 52.125) <= 1e-9);
});
