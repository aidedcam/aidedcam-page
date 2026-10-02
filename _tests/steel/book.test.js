import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workbook, xlsxName, rowNotes } from '../../js/steel/book.js';
import { writeXlsx } from '../../js/dwg/xlsx.js';
import { readZip } from '../../js/steel/unzip.js';
import { takeoff, costs } from '../../js/steel/quote.js';
import { cleanSettings } from '../../js/steel/state.js';

// A translator that shows the key and its parameters, so the sheets can be read without the strings file.
const t = (key, p = {}) => key + (Object.keys(p).length ? JSON.stringify(p) : '');
const row = o => ({ mark: 'X', drawing: 'D1', profile: 'HEA200', code: 'I', grade: 'S355', gradeText: 'S355J2', qty: 1, lengthMm: 4000, unitKg: 169.2, unitM2: 4.544,
  checkKg: 168.9, kgFrom: 'header', warn: [], excluded: false, box: [4000, 190, 200], file: 'X.nc1', ...o });
function model(rates = {}) {
  const settings = cleanSettings({ rates: { galv: 0.45, minimum: 1000, ...rates } });
  const take = takeoff([row({ mark: 'C1', qty: 2 }), row({ mark: 'PU1', profile: 'RHS100*50*4', code: 'M', grade: 'S275', gradeText: 'S275JR', qty: 2, lengthMm: 13500, unitKg: 118.53, unitM2: 3.915, box: [13500, 100, 50], file: 'PU1.nc1' }),
    row({ mark: 'Z1', profile: 'ZS175', code: 'SO', grade: 'A992', gradeText: 'A992', unitKg: null, unitM2: null, kgFrom: null, warn: ['noweight', 'noarea'], excluded: true, checkKg: null })], settings.bath);
  return { take, cost: costs(take, settings.rates), settings, source: 'portal' };
}
// The sheets back through our own reader: name → rows of [cell text].
async function sheets(bytes) {
  const z = await readZip(bytes);
  assert.equal(z.ok, true);
  const files = Object.fromEntries(z.files.map(f => [f.name, new TextDecoder().decode(f.bytes)]));
  const names = [...files['xl/workbook.xml'].matchAll(/<sheet name="([^"]*)"/g)].map(m => m[1]);
  return Object.fromEntries(names.map((n, i) => [n, [...files[`xl/worksheets/sheet${i + 1}.xml`].matchAll(/<row r="\d+">(.*?)<\/row>/g)].map(r =>
    [...r[1].matchAll(/<c r="([A-Z]+)\d+"[^>]*>(?:<v>([^<]*)<\/v>|<is><t[^>]*>([^<]*)<\/t><\/is>)<\/c>/g)].map(c => `${c[1]}:${(c[2] ?? c[3]).replace(/&quot;/g, '"').replace(/&amp;/g, '&')}`))]));
}

test('four sheets in the visitor\'s language: pieces, groups, costs, settings', async () => {
  const s = await sheets(writeXlsx(workbook(model(), t)));
  assert.deepEqual(Object.keys(s), ['st.sheet.pieces', 'st.sheet.groups', 'st.sheet.costs', 'st.sheet.settings']);
});

test('the pieces sheet: one row per mark, kg and m² each and in total as numbers, the left-out row without totals', async () => {
  const s = (await sheets(writeXlsx(workbook(model(), t))))['st.sheet.pieces'];
  assert.deepEqual(s[0].slice(0, 4), ['A:st.col.mark', 'B:st.col.drawing', 'C:st.col.profile', 'D:st.col.grade']);
  assert.deepEqual(s[1], ['A:C1', 'B:D1', 'C:HEA200', 'D:S355J2', 'E:2', 'F:4000', 'G:169.2', 'H:338.4', 'I:4.54', 'J:9.09', 'K:st.from.header', 'L:✓', 'N:X.nc1']);
  assert.deepEqual(s[2].slice(0, 13), ['A:PU1', 'B:D1', 'C:RHS100*50*4', 'D:S275JR', 'E:2', 'F:13500', 'G:118.5', 'H:237.1', 'I:3.92', 'J:7.83', 'K:st.from.header', 'L:⚠', 'M:st.bath.double']);
  assert.deepEqual(s[3].slice(0, 6), ['A:Z1', 'B:D1', 'C:ZS175', 'D:A992', 'E:1', 'F:4000']);
  assert.ok(s[3].includes('M:st.warn.noweight · st.warn.noarea'));
  assert.ok(!s[3].some(c => /^[GHIJ]:/.test(c)), 'no figures for a piece without a weight');
});

test('the groups sheet with its totals; the costs sheet adds up, with the minimum charge and VAT', async () => {
  const s = await sheets(writeXlsx(workbook(model(), t)));
  assert.deepEqual(s['st.sheet.groups'].slice(1), [
    ['A:HEA200', 'B:S355', 'C:2', 'D:8', 'E:338.4', 'F:9.09'],
    ['A:RHS100*50*4', 'B:S275', 'C:2', 'D:27', 'E:237.1', 'F:7.83'],
    ['A:ZS175', 'B:A992', 'C:1', 'D:0', 'E:0', 'F:0'],
    ['A:st.total', 'C:5', 'D:35', 'E:575.5', 'F:16.92'],
  ]);
  assert.deepEqual(s['st.sheet.costs'].slice(1), [
    ['A:st.cost.galv', 'B:575.5', 'C:kg', 'D:0.45', 'E:258.98'],
    ['A:st.cost.subtotal', 'E:258.98'],
    ['A:st.cost.minimum{"min":"1000.00"}', 'E:1000'],
    ['A:st.cost.vat', 'E:240'],
    ['A:st.cost.total', 'E:1240'],
  ]);
});

test('the settings sheet: the bath, every rate (empty ones blank), VAT, the source and the notes', async () => {
  const s = (await sheets(writeXlsx(workbook(model({ perGrade: true, steelGrade: { S355: 1.2 } }), t))))['st.sheet.settings'];
  assert.deepEqual(s.slice(1, 4), [['A:st.set.bath.length', 'B:12.6', 'C:m'], ['A:st.set.bath.width', 'B:1.3', 'C:m'], ['A:st.set.bath.depth', 'B:1.8', 'C:m']]);
  assert.deepEqual(s[4], ['A:st.set.galv', 'B:0.45', 'C:€/kg']);
  assert.deepEqual(s[5], ['A:st.set.zinc', 'C:€/kg']);
  assert.ok(s.some(r => r[0] === 'A:st.set.steel.S355' && r[1] === 'B:1.2'));
  assert.ok(s.some(r => r[0] === 'A:st.set.vat' && r[1] === 'B:st.yes'));
  assert.ok(s.some(r => r[0] === 'A:st.xlsx.source' && r[1] === 'B:portal'));
  assert.ok(s.some(r => r[0] === 'A:st.bath.note'));
});

test('a row\'s notes; the download name', () => {
  assert.equal(rowNotes({ warn: ['check'], checkKg: 180.04, bath: 'fits' }, t), 'st.warn.check.xlsx{"kg":"180.0"}');
  assert.equal(rowNotes({ warn: ['geometry'], bath: 'no' }, t), 'st.warn.geometry · st.bath.no');
  assert.equal(xlsxName('portal.ifc', 1), 'steel-takeoff-portal.xlsx');
  assert.equal(xlsxName('Έργο 12/a.zip', 1), 'steel-takeoff-a.xlsx');
  assert.equal(xlsxName('', 37), 'steel-takeoff-37-files.xlsx');
});

test('final review: {kg} and {min} follow the page formatter; an unpriced grade is a line without rate and amount, and a note', async () => {
  const comma = (v, d) => v.toFixed(d).replace('.', ',');
  assert.equal(rowNotes({ warn: ['check'], checkKg: 1081.84, bath: 'fits' }, t, comma), 'st.warn.check.xlsx{"kg":"1081,8"}');
  const s = await sheets(writeXlsx(workbook(model(), t, comma)));
  assert.ok(s['st.sheet.costs'].some(r => r[0] === 'A:st.cost.minimum{"min":"1000,00"}'));
  const m = model({ perGrade: true, steelGrade: { S355: 1.2 }, galv: null, minimum: null });   // the S275 kg have no rate
  const rows = (await sheets(writeXlsx(workbook(m, t, comma))))['st.sheet.costs'];
  assert.ok(rows.some(r => r[0] === 'A:st.cost.steel.S275' && r.length === 3), 'qty and unit only: no rate, no amount');
  assert.ok(rows.some(r => r[0].startsWith('A:st.cost.unpriced{"kg":"')), 'the note');
  assert.equal(m.cost.unpricedKg > 0, true);
  const plain = (await sheets(writeXlsx(workbook(model(), t))))['st.sheet.costs'];
  assert.ok(!plain.some(r => r[0].startsWith('A:st.cost.unpriced')), 'no note when all is priced');
});
