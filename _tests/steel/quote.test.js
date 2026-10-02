import { test } from 'node:test';
import assert from 'node:assert/strict';
import { takeoff, costs, sortTakeoff, profileKey, parseRate, gradeBucket, VAT_RATE, GRADES, kg1, m2, cents } from '../../js/steel/quote.js';
import { BATH_DEFAULT } from '../../js/steel/bath.js';

// Rows as piece.js makes them (only the fields the quote reads).
const row = o => ({ mark: 'X', profile: 'HEA200', code: 'I', grade: 'S355', qty: 1, lengthMm: 4000, unitKg: 169.2, unitM2: 4.544, warn: [], excluded: false, box: [4000, 190, 200], ...o });
const rows = () => [
  row({ mark: 'C1', qty: 2 }),
  row({ mark: 'C2', profile: 'HEA 200', qty: 1, lengthMm: 3000, unitKg: 126.9, unitM2: 3.408, box: [3000, 190, 200] }),
  row({ mark: 'R1', profile: 'IPE300', qty: 2, lengthMm: 5025, unitKg: 212.055, unitM2: 5.829, box: [5025, 300, 150] }),
  row({ mark: 'PU1', profile: 'RHS100*50*4', code: 'M', grade: 'S275', qty: 2, lengthMm: 13500, unitKg: 118.53, unitM2: 3.915, box: [13500, 100, 50] }),
  row({ mark: 'BP1', profile: 'PL20*300', code: 'B', grade: 'S275', thickness: 20, qty: 2, lengthMm: 300, unitKg: 13.599, unitM2: 0.2063, box: [300, 300, 20] }),
  row({ mark: 'HP1', profile: 'PL20*250', code: 'B', grade: 'S275', thickness: 20, qty: 1, lengthMm: 250, unitKg: 9.0, unitM2: 0.15, box: [250, 250, 20] }),
  row({ mark: 'Z1', profile: 'ZS175', code: 'SO', grade: 'A992', qty: 3, lengthMm: 1133, unitKg: null, unitM2: null, warn: ['noweight', 'noarea'], excluded: true, box: [1133, 175, 81] }),
  row({ mark: 'G1', profile: 'BIG', code: 'SO', grade: 'S450', qty: 1, lengthMm: 6000, unitKg: 900, unitM2: null, warn: ['noarea', 'check'], box: [6000, 1900, 1000] }),
];

test('groups: by profile (spaces, case and * ignored; plates by thickness) and grade', () => {
  assert.equal(profileKey(row({ profile: 'hea 200' })), 'HEA200');
  assert.equal(profileKey(row({ profile: 'RHS100*50*4' })), 'RHS100X50X4');
  assert.equal(profileKey(row({ code: 'B', thickness: 15, profile: 'PL15*200' })), 'PL 15');
  assert.equal(profileKey(row({ code: 'B', thickness: 12.5 })), 'PL 12.5');
  const t = takeoff(rows(), BATH_DEFAULT);
  assert.deepEqual(t.groups.map(g => [g.profile, g.grade, g.count, g.rows.length]), [
    ['BIG', 'S450', 1, 1], ['HEA200', 'S355', 3, 2], ['IPE300', 'S355', 2, 1], ['RHS100*50*4', 'S275', 2, 1], ['PL 20', 'S275', 3, 2], ['ZS175', 'A992', 3, 1]]);
  const hea = t.groups[1];
  assert.equal(+hea.kg.toFixed(3), 465.3);
  assert.equal(+hea.lengthM.toFixed(3), 11);
  assert.equal(+hea.m2.toFixed(3), 12.496);
});

test('totals: pieces, kg, m² of the rows in the totals; longest and heaviest; ⚠ and ✗ bath counts in pieces', () => {
  const t = takeoff(rows(), BATH_DEFAULT);
  const T = t.totals;
  assert.equal(T.marks, 8);
  assert.equal(T.pieces, 14, 'every piece, also those left out');
  assert.equal(+T.kg.toFixed(3), +(2 * 169.2 + 126.9 + 2 * 212.055 + 2 * 118.53 + 2 * 13.599 + 9 + 900).toFixed(3));
  assert.equal(+T.m2.toFixed(4), +(2 * 4.544 + 3.408 + 2 * 5.829 + 2 * 3.915 + 2 * 0.2063 + 0.15).toFixed(4));
  assert.deepEqual([T.excluded, T.noArea, T.checks, T.double, T.no], [1, 1, 1, 2, 1]);
  assert.equal(t.longest.mark, 'PU1');
  assert.equal(t.heaviest.mark, 'G1');
  assert.equal(t.rows.find(r => r.mark === 'PU1').bath, 'double');
  assert.equal(t.rows.find(r => r.mark === 'G1').bath, 'no');
  assert.equal(+t.kgByGrade.S355.toFixed(3), 889.41);
  assert.equal(+t.kgByGrade.S275.toFixed(3), 273.258);
  assert.equal(+t.kgByGrade.other.toFixed(3), 900, 'S450 and the rest');
  assert.equal(t.kgByGrade.S235, 0);
});

test('sorting: by kg (heaviest first), by length (longest first), by mark (profile, then mark in natural order)', () => {
  const t = takeoff(rows(), BATH_DEFAULT, 'length');
  assert.deepEqual(t.groups.map(g => g.profile), ['RHS100*50*4', 'HEA200', 'IPE300', 'BIG', 'PL 20', 'ZS175'], 'a group left out of the totals has no length');
  sortTakeoff(t.groups, 'mark');
  assert.deepEqual(t.groups.map(g => g.profile), ['BIG', 'HEA200', 'IPE300', 'PL 20', 'RHS100*50*4', 'ZS175']);
  assert.deepEqual(t.groups[3].rows.map(r => r.mark), ['BP1', 'HP1']);
  const marks = takeoff([row({ mark: 'A10' }), row({ mark: 'A9' }), row({ mark: 'a2' })], BATH_DEFAULT, 'mark');
  assert.deepEqual(marks.groups[0].rows.map(r => r.mark), ['a2', 'A9', 'A10']);
  sortTakeoff(t.groups, 'kg');
  assert.deepEqual(t.groups[1].rows.map(r => r.mark), ['C1', 'C2']);
});

test('rates as typed: comma or point, empty is null, anything else is not a rate', () => {
  assert.equal(parseRate('0,45'), 0.45);
  assert.equal(parseRate(' 1 200.5 '), 1200.5);
  assert.equal(parseRate(''), null);
  assert.equal(parseRate('abc'), undefined);
  assert.equal(parseRate('-1'), undefined);
  assert.deepEqual(GRADES, ['S235', 'S275', 'S355', 'other']);
  assert.equal(gradeBucket('S450'), 'other');
});

test('costs: one line per rate filled in, each its shown quantity × rate to the cent; empty rates leave no line', () => {
  const t = takeoff(rows(), BATH_DEFAULT);
  const kg = kg1(t.totals.kg), area = m2(t.totals.m2);
  const c = costs(t, { galv: 0.45, zinc: 0.05, paint: null, steel: 1.1, perGrade: false, minimum: null, vat: true });
  assert.deepEqual(c.lines.map(l => [l.id, l.qty, l.unit, l.rate]), [['galv', kg, 'kg', 0.45], ['zinc', kg, 'kg', 0.05], ['steel', kg, 'kg', 1.1]]);
  assert.equal(c.lines[0].amount, cents(kg * 0.45));
  assert.equal(c.subtotal, cents(c.lines[0].amount + c.lines[1].amount + c.lines[2].amount));
  assert.equal(VAT_RATE, 0.24);
  assert.equal(c.vat, Math.round(c.subtotal * 0.24 * 100) / 100);
  assert.equal(c.total, Math.round((c.subtotal + c.vat) * 100) / 100);
  const p = costs(t, { galv: null, zinc: null, paint: 12, steel: null, perGrade: false, minimum: null, vat: false });
  assert.deepEqual(p.lines.map(l => [l.id, l.qty, l.unit]), [['paint', area, 'm2']]);
  assert.deepEqual([p.vat, p.vatOn, p.total], [0, false, p.subtotal]);
  const none = costs(t, { galv: null, zinc: null, paint: null, steel: null, perGrade: false, minimum: 500, vat: true });
  assert.deepEqual([none.lines.length, none.subtotal, none.minApplies, none.total], [0, 0, false, 0], 'no rate: no minimum either');
});

test('the minimum charge replaces a smaller subtotal; VAT on the charged amount', () => {
  const t = takeoff([row({ qty: 1 })], BATH_DEFAULT);
  const c = costs(t, { galv: 0.5, zinc: null, paint: null, steel: null, perGrade: false, minimum: 150, vat: true });
  assert.equal(c.subtotal, 84.6);
  assert.deepEqual([c.minApplies, c.minimum, c.net, c.vat, c.total], [true, 150, 150, 36, 186]);
  const above = costs(t, { galv: 0.5, zinc: null, paint: null, steel: null, perGrade: false, minimum: 50, vat: true });
  assert.deepEqual([above.minApplies, above.net], [false, 84.6]);
});

test('the steel material per grade: one line per grade with kg and a rate', () => {
  const t = takeoff(rows(), BATH_DEFAULT);
  const c = costs(t, { galv: null, zinc: null, paint: null, steel: 9, perGrade: true, steelGrade: { S235: 0.9, S275: 1.0, S355: 1.2, other: null }, minimum: null, vat: false });
  assert.deepEqual(c.lines.map(l => [l.id, l.qty, l.rate]), [['steel.S275', kg1(t.kgByGrade.S275), 1.0], ['steel.S355', kg1(t.kgByGrade.S355), 1.2], ['steel.other', kg1(t.kgByGrade.other), null]], 'S235 has no kg; other has kg and no rate: kept, unpriced');
  assert.equal(c.total, cents(kg1(t.kgByGrade.S275) * 1.0 + kg1(t.kgByGrade.S355) * 1.2));
  assert.equal(c.unpricedKg, kg1(t.kgByGrade.other));
});

// ---- final review: decimal rounding, unpriced grades ----
import { round } from '../../js/steel/quote.js';

test('money rounding is decimal: half-cent products land on the right cent', () => {
  assert.equal(cents(10.6 * 0.375), 3.98);
  assert.equal(cents(5 * 0.995), 4.98);
  assert.equal(cents(16.2 * 1.125), 18.23);
  assert.equal(kg1(0.25), 0.3);
  assert.equal(m2(1.005), 1.01);
  assert.equal(cents(-2.675), -2.68);
  assert.equal(round(1e-7, 2), 0);
  assert.ok(Number.isNaN(round(NaN, 2)));
});

test('rounding, generated: a 1-decimal quantity times a 3-decimal rate equals exact integer arithmetic (half up)', () => {
  let n = 0;
  for (let q = 1; q <= 2000; q += 7) {
    for (let r = 1; r <= 3000; r += 13) {
      // q tenths × r thousandths = q·r ten-thousandths; round half up to cents: (q·r + 50) div 100
      const exact = Math.floor((q * r + 50) / 100) / 100;
      assert.equal(cents((q / 10) * (r / 1000)), exact, `${q / 10} × ${r / 1000}`);
      n++;
    }
  }
  assert.ok(n > 40000);
});

test('per-grade pricing: a grade with kg and no rate stays as an unpriced line, outside the subtotal', () => {
  const t = takeoff([row({ mark: 'A', grade: 'S275', unitKg: 1000, qty: 1 }), row({ mark: 'B', grade: 'S450', unitKg: 500, qty: 1 })], BATH_DEFAULT);
  const c = costs(t, { perGrade: true, steelGrade: { S235: 1.1, S275: 1.1, S355: 1.1, other: null }, vat: false });
  assert.deepEqual(c.lines.map(l => [l.id, l.qty, l.rate, l.amount, !!l.unpriced]), [['steel.S275', 1000, 1.1, 1100, false], ['steel.other', 500, null, null, true]]);
  assert.equal(c.unpricedKg, 500);
  assert.equal(c.subtotal, 1100);
  assert.equal(c.total, 1100);
  const ok = costs(t, { perGrade: true, steelGrade: { S275: 1.1, other: 1 } });
  assert.equal(ok.unpricedKg, 0);
  // only unpriced lines: the minimum charge does not apply to an empty quote
  const only = costs(t, { perGrade: true, steelGrade: {}, minimum: 100 });
  assert.equal(only.minApplies, false);
  assert.equal(only.unpricedKg, 1500);
});
