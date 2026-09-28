import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MATERIALS, DEFAULT_SPEEDS, speedAt, weightKg, fileNumbers, orderTotals, statusOf, formatDuration,
} from '../../js/laser/pricing.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

test('speedAt interpolates between rows and clamps outside the table', () => {
  const rows = [[3, 6000, 0.5], [1, 20000, 0.1]];                      // unsorted on purpose
  const mid = speedAt(rows, 2);
  close(mid.cut, 13000); close(mid.pierce, 0.3); assert.equal(mid.clamped, false);
  assert.deepEqual(speedAt(rows, 1), { cut: 20000, pierce: 0.1, clamped: false });
  assert.deepEqual(speedAt(rows, 0.5), { cut: 20000, pierce: 0.1, clamped: true });
  assert.deepEqual(speedAt(rows, 3), { cut: 6000, pierce: 0.5, clamped: false });
  assert.deepEqual(speedAt(rows, 25), { cut: 6000, pierce: 0.5, clamped: true });
  assert.deepEqual(speedAt([], 2), { cut: 0, pierce: 0, clamped: true });
});

test('weight is area × thickness × density', () => {
  close(weightKg(1e6, 1, 7.85), 7.85);                                 // 1 m² of 1 mm steel
  close(weightKg(4000, 2, MATERIALS.aluminium), 0.0216);
});

test('one file: parts plus open paths, cutting and marking time, open paths make it incomplete', () => {
  const result = {
    parts: [{ area: 4000, cutLength: 300, pierces: 3 }, { area: 1000, cutLength: 100, pierces: 1 }],
    extras: { openCutLength: 50, openPierces: 1, markLength: 60, markStarts: 1 },
  };
  const n = fileNumbers(result, { material: 'steel', thickness: 2 }, { steel: [[2, 6000, 0.5]] }, 1200);
  assert.equal(n.parts, 2);
  assert.equal(n.area, 5000);
  close(n.weight, 5000 * 2 * 7.85 / 1e6);
  assert.equal(n.cutLength, 450);
  assert.equal(n.pierces, 5);
  assert.equal(n.markLength, 60);
  close(n.seconds, 4.5 + 2.5 + 3);                                     // 450 mm at 6000, 5 × 0.5 s, 60 mm at 1200
  assert.equal(n.clamped, false);
  assert.equal(n.incomplete, true);
  const clean = fileNumbers({ parts: result.parts }, { material: 'steel', thickness: 2 }, { steel: [[2, 6000, 0.5]] }, 1200);
  assert.equal(clean.incomplete, false);
  close(clean.seconds, 4 + 2);
});

test('a file with an error check is incomplete', () => {
  const parts = [{ area: 4000, cutLength: 300, pierces: 3 }];
  const job = { material: 'steel', thickness: 2 };
  const withError = fileNumbers({ type: 'result', parts, checks: [{ id: 'block-empty', severity: 'error' }] }, job);
  assert.equal(withError.incomplete, true);
  const without = fileNumbers({ type: 'result', parts, checks: [] }, job);
  assert.equal(without.incomplete, false);
});

test('order totals multiply by quantity; a failed file turns the totals into "at least"', () => {
  const a = { parts: 1, area: 100, weight: 1, cutLength: 10, pierces: 2, seconds: 5, incomplete: false };
  const b = { parts: 2, area: 50, weight: 0.5, cutLength: 20, pierces: 1, seconds: 3, incomplete: false };
  const t = orderTotals([{ numbers: a, qty: 10 }, { numbers: b, qty: 2 }]);
  assert.deepEqual(t, { cutLength: 140, pierces: 22, area: 1100, weight: 11, seconds: 56, parts: 14, incomplete: false });
  assert.equal(orderTotals([{ numbers: a, qty: 1 }, { numbers: null, qty: 3 }]).incomplete, true);
  assert.equal(orderTotals([{ numbers: { ...a, incomplete: true }, qty: 1 }]).incomplete, true);
  assert.equal(orderTotals([{ numbers: { ...a, seconds: NaN }, qty: 1 }]).incomplete, true);
  assert.equal(orderTotals([{ numbers: a, qty: 0 }]).cutLength, 0);
});

test('status: error beats warning beats a repair', () => {
  const r = checks => ({ type: 'result', checks });
  assert.equal(statusOf(null), 'error');
  assert.equal(statusOf({ type: 'error' }), 'error');
  assert.equal(statusOf(r([])), 'ok');
  assert.equal(statusOf(r([{ id: 'text-kept', severity: 'info' }])), 'ok');
  assert.equal(statusOf(r([{ id: 'gaps-closed', severity: 'info' }])), 'warn');
  assert.equal(statusOf(r([{ id: 'branch', severity: 'warn' }])), 'warn');
  assert.equal(statusOf(r([{ id: 'branch', severity: 'warn' }, { id: 'open-path', severity: 'error' }])), 'error');
});

test('every material has a density and at least five speed rows', () => {
  for (const m of Object.keys(MATERIALS)) {
    assert.ok(DEFAULT_SPEEDS[m] && DEFAULT_SPEEDS[m].length >= 5, m);
    for (const [t, cut, pierce] of DEFAULT_SPEEDS[m]) assert.ok(t > 0 && cut > 0 && pierce > 0, `${m} ${t}`);
  }
});

test('durations read as m:ss or h:mm:ss', () => {
  assert.equal(formatDuration(59.4), '0:59');
  assert.equal(formatDuration(3725), '1:02:05');
  assert.equal(formatDuration(NaN), '–');
});
