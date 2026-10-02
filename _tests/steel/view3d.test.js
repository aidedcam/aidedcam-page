import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitIndex, partsBox, gradeColor, PRESETS, GRADE_COLORS, HIGHLIGHT } from '../../js/steel/view3d.js';

// Two members of three triangles' worth of indices: eid 7 (S355) and eid 9 (S275).
const mesh = {
  position: Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0, 5, 5, 5, 6, 5, 5, 5, 6, 7]),
  index: Uint32Array.from([0, 1, 2, 3, 4, 5]),
  parts: Int32Array.from([7, 0, 3, 9, 3, 3]),
};
const grade = e => ({ 7: 'S355', 9: 'S275' })[e];

test('the members split by grade, the highlighted ones apart', () => {
  const a = splitIndex(mesh, grade, new Set());
  assert.deepEqual(a.grades.map(([g, ix]) => [g, [...ix]]), [['S355', [0, 1, 2]], ['S275', [3, 4, 5]]]);
  assert.equal(a.highlight.length, 0);
  const b = splitIndex(mesh, grade, new Set([9]));
  assert.deepEqual(b.grades.map(([g, ix]) => [g, [...ix]]), [['S355', [0, 1, 2]]]);
  assert.deepEqual([...b.highlight], [3, 4, 5]);
  assert.deepEqual(splitIndex(mesh, () => undefined, new Set()).grades.map(([g]) => g), ['other']);
});

test('the box of the highlighted members; colours per grade', () => {
  assert.deepEqual(partsBox(mesh, new Set([9])), { min: [5, 5, 5], max: [6, 6, 7] });
  assert.equal(partsBox(mesh, new Set([42])), null);
  assert.equal(gradeColor('S355'), GRADE_COLORS.S355);
  assert.equal(gradeColor('A992'), GRADE_COLORS.other);
  assert.ok(!Object.values(GRADE_COLORS).includes(HIGHLIGHT));
  assert.deepEqual(Object.keys(PRESETS), ['top', 'front', 'side', 'iso']);
});
