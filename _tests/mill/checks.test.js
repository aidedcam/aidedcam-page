import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMill } from '../../js/mill/analyze.js';
import { MILL_SEVERITY, WARN_CAP } from '../../js/mill/checks.js';

const ids = src => analyzeMill(src).warnings.map(w => w.id);

// Every check fires on its bad program and stays silent on the good one (spec §10.3).
const CASES = {
  'no-g43': ['T1 M6\nG0 X0 Y0 S1000 M3\nZ50\nG1 Z0 F100', 'T1 M6\nG0 X0 Y0 S1000 M3\nG43 Z50 H1\nG1 Z0 F100'],
  'h-mismatch': ['T1 M6\nG43 Z50 H2', 'T1 M6\nG43 Z50 H1'],
  'spindle-off': ['T1 M6\nG0 X0 Y0\nG43 Z5 H1\nG1 Z0 F100', 'T1 M6\nG0 X0 Y0 S1000 M3\nG43 Z5 H1\nG1 Z0 F100'],
  'no-feed': ['G0 X0 Y0 Z0 S1000 M3\nG1 X10', 'G0 X0 Y0 Z0 S1000 M3\nG1 X10 F100'],
  'comp-no-d': ['G0 X0 Y0 Z0\nG41 G1 X10 F100', 'G0 X0 Y0 Z0\nG41 D1 G1 X10 F100'],
  'comp-left-on': ['G0 X0 Y0 Z0 S1000 M3\nG41 D1 G1 X10 F100\nM30', 'G0 X0 Y0 Z0 S1000 M3\nG41 D1 G1 X10 F100\nG40 G1 X20\nM30'],
  'rapid-into-material': ['G0 X0 Y0 Z5 S1000 M3\nG1 Z-5 F100\nG0 Z-8', 'G0 X0 Y0 Z5 S1000 M3\nG1 Z-5 F100\nG0 Z5'],
  'arc-radius': ['G0 X10 Y0 Z0 S1000 M3\nG3 X0 Y10.5 I-10 J0 F100', 'G0 X10 Y0 Z0 S1000 M3\nG3 X0 Y10 I-10 J0 F100'],
  'cycle-no-r': ['G0 X0 Y0 Z10 S1000 M3\nG81 X10 Y0 Z-5 F100', 'G0 X0 Y0 Z10 S1000 M3\nG81 X10 Y0 Z-5 R2 F100'],
  'peck-no-q': ['G0 X0 Y0 Z10 S1000 M3\nG83 X10 Y0 Z-5 R2 F100', 'G0 X0 Y0 Z10 S1000 M3\nG83 X10 Y0 Z-5 R2 Q2 F100'],
  'cycle-no-start': ['S1000 M3\nG81 X10 Y0 Z-5 R2 F100', 'G0 X0 Y0 Z10 S1000 M3\nG81 X10 Y0 Z-5 R2 F100'],
  'sub-missing': ['M98 P2000', 'M98 P2000\nM30\nO2000\nM99'],
  'sub-loop': ['M98 P1000\nM30\nO1000\nM98 P1000\nM99', 'M98 P1000\nM30\nO1000\nM99'],
  'main-m99': ['G0 X0 Y0 Z0\nM99', 'G0 X0 Y0 Z0\nM30'],
  'unsupported': ['G0 X0 Y0 Z0\nG68 X0 Y0 R45', 'G0 X0 Y0 Z0\nG69'],
  'approximated': ['G0 X0 Y0 Z10 S1000 M3\nG76 X10 Y0 Z-5 R2 Q0.1 F100', 'G0 X0 Y0 Z10 S1000 M3\nG86 X10 Y0 Z-5 R2 F100'],
  'skipped': ['#100 = 5', '(COMMENT)'],
  'lathe-program': ['G18 G96 S200\nG0 X50 Z2\nG1 Z-10 F0.2', 'G17 G0 X0 Y0 Z0'],
};

test('every check id has a case (and every case is a real id)', () => {
  assert.deepEqual(Object.keys(CASES).sort(), Object.keys(MILL_SEVERITY).sort());
});

for (const [id, [bad, good]] of Object.entries(CASES)) {
  test(`${id}: fires on the bad program, silent on the good one`, () => {
    assert.ok(ids(bad).includes(id), `${id} did not fire: ${ids(bad)}`);
    assert.ok(!ids(good).includes(id), `${id} fired on the good program`);
  });
}

test('warnings are capped per id, with one "more" entry carrying the rest', () => {
  // The first A value only sets the reference, so WARN_CAP + 51 lines give WARN_CAP + 50 changes.
  const src = ['G0 X0 Y0 Z0', ...Array.from({ length: WARN_CAP + 51 }, (_, i) => `G0 A${i}`)].join('\n');
  const ws = analyzeMill(src).warnings;
  assert.equal(ws.filter(w => w.id === 'unsupported').length, WARN_CAP);
  const more = ws.filter(w => w.id === 'more');
  assert.deepEqual(more.map(w => w.params), [{ count: 50, of: 'unsupported' }]);
  assert.equal(more[0].severity, 'info');
});

test('severities follow spec §6', () => {
  assert.equal(MILL_SEVERITY['no-feed'], 'error');
  assert.equal(MILL_SEVERITY['h-mismatch'], 'info');
  assert.equal(MILL_SEVERITY['rapid-into-material'], 'warn');
  assert.equal(MILL_SEVERITY['arc-radius'], 'error');
});
