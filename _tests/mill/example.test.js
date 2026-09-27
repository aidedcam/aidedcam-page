import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMill } from '../../js/mill/analyze.js';
import { MILL_EXAMPLE } from '../../js/mill/example.js';

test('the example program is clean: four tools, labelled rows, holes counted, no warnings', () => {
  const r = analyzeMill(MILL_EXAMPLE);
  assert.deepEqual(r.warnings, []);
  assert.deepEqual(r.timing.rows.map(x => [x.tool, x.label, x.cycles]), [
    ['T1', 'FACE MILL D50', 0],
    ['T2', 'END MILL D10 - POCKET AND CONTOUR', 0],
    ['T3', 'DRILL D8.5', 4],
    ['T4', 'TAP M10X1.5', 2],
  ]);
  assert.equal(r.timing.incomplete, false);
  assert.ok(r.timing.total > 60 && r.timing.total < 600, `total ${r.timing.total}`);
  assert.deepEqual(r.cutBounds.min.map(v => Math.round(v)), [-30, -10, -25]);
  assert.equal(r.units, 'mm');
  assert.deepEqual(r.workOffsets, ['G54', 'G55']);
});

test('the example stays synthetic: no client names in it', () => {
  assert.match(MILL_EXAMPLE, /SYNTHETIC PART/);
});
