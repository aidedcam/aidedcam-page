import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { buildModel, evaluate } from '../../js/coverage/rules.js';
import { autoMap, layerList } from '../../js/coverage/mapping.js';
import { summaryRows, scheduleRows, coordTables, summaryTsv, scheduleTsv, coordsTsv, plain, xlsxName, markText, articleText, workbookFor } from '../../js/coverage/tables.js';
import { item, rect, result, unionOf } from './helpers.mjs';
import { OUTLINES, OPEN, TERMS, inSurvey } from './example-geometry.mjs';

// The tool's strings, as the page's t() would read them.
const window = {};
vm.runInNewContext(readFileSync(new URL('../../js/coverage/i18n-coverage.js', import.meta.url), 'utf8'), { window });
const tr = l => (key, p = {}) => String(window.CP_I18N[l][key] ?? key).replace(/\{(\w+)\}/g, (_, k) => p[k] ?? '');

function example() {
  const r = result([...OUTLINES.map(o => item(o.layer, inSurvey(o.verts))), ...OPEN.map(o => item(o.layer, inSurvey(o.verts), { closed: false }))]);
  const model = buildModel(r, autoMap(r.layers.map(l => l.name)).map);
  return evaluate(model, TERMS, unionOf(150, [model.cover[0].verts]));
}

test('the clipboard number: fixed decimals, the language separator, never grouped', () => {
  assert.equal(plain('.')(1380, 2), '1380.00');
  assert.equal(plain(',')(1380, 2), '1380,00');
  assert.equal(plain(',')(4495025.5, 2), '4495025,50');
  assert.equal(plain('.')(null, 2), '');
});

test('the summary as TSV, in English and in Greek', () => {
  const ev = example();
  const en = summaryTsv(summaryRows(ev, tr('en'), plain('.')), tr('en'));
  const lines = en.split('\r\n');
  assert.deepEqual(lines[0].split('\t'), ['Figure', 'Article', 'Permitted', 'Proposed', 'Check', 'Note']);
  assert.ok(lines.includes('Coverage (κάλυψη)\tCode 207 (ΝΟΚ 12)\t300.00 m² (60%)\t150.00 m² (30.00%)\t✓\t'), en);
  assert.ok(en.includes('\t2000.00 m³ (σ.ο. 4.00)\t1380.00 m³ (σ.ο. 2.76)\t✓\t'));
  const el = summaryTsv(summaryRows(ev, tr('el'), plain(',')), tr('el'));
  assert.ok(el.includes('Δόμηση συνολικά\tΚώδ. 206 (ΝΟΚ 11)\t400,00 m² (ΣΔ 0,80)\t310,00 m² (ΣΔ 0,62)\t✓\t'), el);
  assert.ok(el.includes('\t80,00 m²\t90,00 m²\t✗\tπλεόνασμα 10,00 m² μετρά στη δόμηση'));
  assert.ok(!/\d\.\d{3},/.test(el), 'no grouped thousands');
});

test('the schedule: each level, its spaces with the cap lines, its δόμηση; then the totals', () => {
  const ev = example();
  const rows = scheduleRows(ev, tr('en'), plain('.'));
  const ground = rows.slice(rows.findIndex(r => r.label === 'Ground floor'), rows.findIndex(r => r.label === 'δόμηση: Ground floor') + 1);
  assert.deepEqual(ground.map(r => [r.kind, r.areaText, r.excludedText, r.countsText]), [
    ['head', '', '', ''], ['gross', '150.00', '', ''], ['space', '20.00', '20.00', ''], ['space', '20.00', '20.00', ''], ['cap', '', '', ''], ['domisi', '', '', '110.00'],
  ]);
  assert.equal(ground[4].label, 'cap 40 m²');
  const tail = rows.slice(-3).map(r => [r.label, r.countsText]);
  assert.deepEqual(tail, [['Semi-open + balconies (cap 0.40 × permitted δόμηση = 160.00 m²)', ''], ['Semi-open and balcony overflow', '10.00'], ['δόμηση (built floor area), total', '310.00']]);
  const tsv = scheduleTsv(rows, tr('el'));
  assert.ok(tsv.startsWith('Επιφάνεια\tΕμβαδόν (m²)\tΕκτός ΣΔ (m²)\tΕντός ΣΔ (m²)\tΣημείωση\r\n'));
});

test('the coordinate tables, numbered, with parts and arcs, as TSV', () => {
  const ev = example();
  const co = coordTables(ev, tr('en'), plain(','));
  assert.deepEqual(co.plot.map(r => [r.n, r.xText, r.yText]), [[1, '410000,00', '4495000,00'], [2, '410020,00', '4495000,00'], [3, '410020,00', '4495025,00'], [4, '410000,00', '4495025,00']]);
  const tsv = coordsTsv(co.plot, tr('el'));
  assert.equal(tsv.split('\r\n')[1], '1\t410000,00\t4495000,00\t');
  const two = { ...ev, coords: { ...ev.coords, building: [{ part: 0, rows: [{ n: 1, x: 0, y: 0, arc: true }] }, { part: 1, rows: [{ n: 2, x: 5, y: 0, arc: false }] }] } };
  const b = coordTables(two, tr('en'), plain('.')).building;
  assert.deepEqual(b.map(r => (r.head ? r.label : `${r.n} ${r.note}`)), ['Part 1', '1 (arc to the next)', 'Part 2', '2 ']);
});

test('marks, article chips and the download name', () => {
  assert.equal(markText(true), '✓'); assert.equal(markText(false), '✗'); assert.equal(markText(null), '');
  assert.equal(articleText('planting', tr('el')), 'Κώδ. 212 §2α (ΝΟΚ 17 §2α)');
  assert.equal(xlsxName('κάτοψη Α/1.dwg'), 'coverage-κάτοψη Α_1.xlsx');
  assert.equal(xlsxName('example-permit.dxf'), 'coverage-example-permit.xlsx');
});

test('without ΣΔ and Σ.Κ. the rows say what to type, with no mark', () => {
  const r = result(OUTLINES.map(o => item(o.layer, inSurvey(o.verts))));
  const model = buildModel(r, autoMap(r.layers.map(l => l.name)).map);
  const rows = summaryRows(evaluate(model, {}, unionOf(150)), tr('en'), plain('.'));
  const get = k => rows.find(x => x.key === k);
  assert.equal(get('coverage').permitted.text, 'type Σ.Κ.');
  assert.equal(get('total').permitted.text, 'type ΣΔ');
  assert.equal(get('semi').permitted.text, 'type ΣΔ');
  assert.equal(get('semi').note, 'without ΣΔ the caps can’t be checked and nothing is added'.replace('’', "'"));
  for (const k of ['coverage', 'total', 'semi', 'volume', 'planting', 'height']) assert.equal(get(k).mark, null, k);
});

test('the workbook’s approximate-coordinates note: only when the union failed or is pending, not without coverage', () => {
  const t = tr('en');
  const approx = (outlines, union) => {
    const r = result(outlines.map(([layer, verts]) => item(layer, verts)));
    const map = autoMap(r.layers.map(l => l.name)).map;
    const model = buildModel(r, map);
    const ev = evaluate(model, {}, union === undefined ? unionOf(model.cover.reduce((a, o) => a + o.area, 0), model.cover.map(o => o.verts)) : union);
    const coords = workbookFor({ ev, layers: layerList(r).used, map, file: { units: 'm' }, t, n: plain('.') })[2];
    return [ev.coverage.state, coords.rows.some(row => (Array.isArray(row) ? row : row.cells)[0] === t('cp.coords.approx'))];
  };
  const plot = ['AC_PLOT', rect(0, 0, 20, 25)], cover = ['AC_COVER', rect(0, 10, 10, 15)];
  assert.deepEqual(approx([plot]), ['none', false]);
  assert.deepEqual(approx([plot, cover]), ['ok', false]);
  assert.deepEqual(approx([plot, cover], null), ['pending', true]);
  assert.deepEqual(approx([plot, cover], { ...unionOf(0), error: 'check' }), ['failed', true]);
});
