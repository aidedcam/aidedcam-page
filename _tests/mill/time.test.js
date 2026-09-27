import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rapidSeconds, feedRate, feedSeconds, summarizeRows } from '../../js/mill/time.js';
import { MILL_DEFAULTS } from '../../js/mill/settings.js';

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test('rapid: the slowest axis decides, each at its own rate', () => {
  near(rapidSeconds(300, 150, 30, MILL_DEFAULTS), 0.6);
  near(rapidSeconds(0, 0, -100, { ...MILL_DEFAULTS, rapidZ: 12000 }), 0.5);
});

test('feed rate: G94 is F; G95 is F × S; unknown without F, or in G95 without S', () => {
  assert.equal(feedRate({ feedMode: 'min', f: 500 }), 500);
  assert.equal(feedRate({ feedMode: 'rev', f: 0.2, s: 1000 }), 200);
  assert.equal(feedRate({ feedMode: 'min', f: null }), null);
  assert.equal(feedRate({ feedMode: 'min', f: 0 }), null);
  assert.equal(feedRate({ feedMode: 'rev', f: 0.2, s: null }), null);
  near(feedSeconds(100, 500), 12);
  assert.ok(Number.isNaN(feedSeconds(100, null)));
});

test('rows: correction applies to every part; incomplete rows stay out of the total', () => {
  const row = (tool, cut, incomplete) => ({ tool, label: '', firstLine: 1, moveStart: 0, moveEnd: 0, holes: 0, cutLength: 0,
    cutSeconds: cut, rapidSeconds: 2, dwellSeconds: 1, changeSeconds: 5, incomplete });
  const t = summarizeRows([row('T1', 10, false), row('T2', 20, true)], { correctionPct: 10 });
  near(t.rows[0].totalSeconds, (10 + 2 + 1 + 5) * 1.1);
  near(t.total, (10 + 2 + 1 + 5) * 1.1);
  assert.equal(t.incomplete, true);
  assert.equal(t.rows[1].incomplete, true);
});
