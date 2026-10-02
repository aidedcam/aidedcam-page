import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanSettings, kindOf, isMacClutter, skippedView, sortSet, piecesBucket, parsePositive, parseRateInput, SETTINGS_KEY, NC1_MAX, IFC_MAX_BYTES, SORTS, RATE_KEYS } from '../../js/steel/state.js';

test('the limits and keys of spec §6–§7', () => {
  assert.equal(SETTINGS_KEY, 'aidedcam-steel-settings');
  assert.equal(NC1_MAX, 2000);
  assert.equal(IFC_MAX_BYTES, 150 * 1024 * 1024);
  assert.deepEqual(SORTS, ['kg', 'length', 'mark']);
  assert.deepEqual(RATE_KEYS, ['galv', 'zinc', 'paint', 'steel', 'minimum']);
});

test('settings: the defaults, what was stored, and nothing that is not a setting', () => {
  const d = cleanSettings(null);
  assert.deepEqual(d, {
    bath: { length: 12.6, width: 1.3, depth: 1.8 },
    rates: { galv: null, zinc: null, paint: null, steel: null, minimum: null, perGrade: false, steelGrade: { S235: null, S275: null, S355: null, other: null }, vat: true },
    sort: 'kg',
  });
  const s = cleanSettings({ bath: { length: 7, width: -1, depth: 'x' }, rates: { galv: 0.45, zinc: -2, paint: 12, perGrade: true, steelGrade: { S355: 1.2, S999: 3 }, vat: false, other: 5 }, sort: 'colour', extra: 1 });
  assert.deepEqual(s.bath, { length: 7, width: 1.3, depth: 1.8 });
  assert.deepEqual(s.rates, { galv: 0.45, zinc: null, paint: 12, steel: null, minimum: null, perGrade: true, steelGrade: { S235: null, S275: null, S355: 1.2, other: null }, vat: false });
  assert.equal(s.sort, 'kg');
  assert.ok(!('extra' in s));
});

test('numbers as typed', () => {
  assert.equal(parsePositive('12,6'), 12.6);
  assert.equal(parsePositive('0'), undefined);
  assert.equal(parsePositive(''), undefined);
  assert.equal(parseRateInput(''), null);
  assert.equal(parseRateInput('0'), 0);
  assert.equal(parseRateInput('x'), undefined);
});

test('Mac clutter: __MACOSX/ paths and ._-prefixed basenames are filtered', () => {
  assert.ok(isMacClutter('__MACOSX/a/._A1.nc1'));
  assert.ok(isMacClutter('/__MACOSX/a/x.nc1'));
  assert.ok(isMacClutter('.__B.nc1'));
  assert.ok(isMacClutter('._C.nc1'));
  assert.ok(!isMacClutter('A1.nc1'));
  assert.ok(!isMacClutter('path/to/A1.nc1'));
  assert.ok(!isMacClutter('path/to/B.nc1'));
});

test('which files a set holds: NC1 (.nc1, .nc, any case), ZIP, one IFC read alone, the rest skipped', () => {
  assert.deepEqual(['a.nc1', 'B.NC1', 'c.nc', 'd.NC', 'e.zip', 'f.IFC', 'g.dxf', 'nc1', 'h.nc1.bak'].map(kindOf), ['nc1', 'nc1', 'nc1', 'nc1', 'zip', 'ifc', 'other', 'other', 'other']);
  const s = sortSet([{ name: 'a.nc1' }, { name: 'b.zip' }, { name: 'c.pdf' }]);
  assert.deepEqual([s.ifc, s.nc1.map(f => f.name), s.zips.map(f => f.name), s.skipped], [null, ['a.nc1'], ['b.zip'], [{ name: 'c.pdf', reason: 'notnc1' }]]);
  const i = sortSet([{ name: 'a.nc1' }, { name: 'm.ifc' }, { name: 'n.ifc' }]);
  assert.equal(i.ifc.name, 'm.ifc');
  assert.deepEqual(i.skipped, [{ name: 'a.nc1', reason: 'ifcalone' }, { name: 'n.ifc', reason: 'ifcalone' }]);
});

test('the GA bucket of a piece count (spec §8)', () => {
  assert.deepEqual([1, 10, 11, 100, 101, 1000, 1001].map(piecesBucket), ['1-10', '1-10', '11-100', '11-100', '101-1000', '101-1000', 'over-1000']);
});

test('the skipped-list view model: hidden when null or empty, items with reason keys and line numbers', () => {
  assert.deepEqual(skippedView(null), { hidden: true, items: [] });
  assert.deepEqual(skippedView({ skipped: [] }), { hidden: true, items: [] });
  assert.deepEqual(skippedView({ skipped: [{ name: 'x.zip', reason: 'notzip' }] }),
    { hidden: false, items: [{ name: 'x.zip', reasonKey: 'st.skip.notzip', line: undefined }] });
  assert.deepEqual(skippedView({ skipped: [{ name: 'a.nc1', reason: 'read' }, { name: 'b.nc1', reason: 'nonc1', line: 42 }] }),
    { hidden: false, items: [{ name: 'a.nc1', reasonKey: 'st.skip.read', line: undefined }, { name: 'b.nc1', reasonKey: 'st.skip.nonc1', line: 42 }] });
});
