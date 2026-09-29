import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { writeXlsx } from '../../js/dwg/xlsx.js';
import { buildModel, evaluate } from '../../js/coverage/rules.js';
import { autoMap, layerList } from '../../js/coverage/mapping.js';
import { workbookFor } from '../../js/coverage/tables.js';
import { item, result, unionOf } from './helpers.mjs';
import { OUTLINES, OPEN, TERMS, inSurvey } from './example-geometry.mjs';

const window = {};
vm.runInNewContext(readFileSync(new URL('../../js/coverage/i18n-coverage.js', import.meta.url), 'utf8'), { window });
const tr = l => (key, p = {}) => String(window.CP_I18N[l][key] ?? key).replace(/\{(\w+)\}/g, (_, k) => p[k] ?? '');
const fmt = l => (v, d) => new Intl.NumberFormat(l === 'en' ? 'en-US' : l === 'el' ? 'el-GR' : 'it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

// The stored ZIP read back through its local headers.
function unzip(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), dec = new TextDecoder();
  const out = {};
  for (let p = 0; v.getUint32(p, true) === 0x04034b50;) {
    const size = v.getUint32(p + 18, true), nl = v.getUint16(p + 26, true), ex = v.getUint16(p + 28, true);
    out[dec.decode(bytes.subarray(p + 30, p + 30 + nl))] = dec.decode(bytes.subarray(p + 30 + nl + ex, p + 30 + nl + ex + size));
    p += 30 + nl + ex + size;
  }
  return out;
}

function workbook(l) {
  const r = result([...OUTLINES.map(o => item(o.layer, inSurvey(o.verts))), ...OPEN.map(o => item(o.layer, inSurvey(o.verts), { closed: false }))]);
  const map = autoMap(r.layers.map(x => x.name)).map;
  const model = buildModel(r, map);
  const ev = evaluate(model, TERMS, unionOf(150, [model.cover[0].verts]));
  return unzip(writeXlsx(workbookFor({ ev, layers: layerList(r).used, map, file: { units: 'm' }, t: tr(l), n: fmt(l) })));
}
const sheetNames = x => [...x['xl/workbook.xml'].matchAll(/<sheet name="([^"]*)"/g)].map(m => m[1]);

test('four sheets, named in the page language within Excel’s 31 characters', () => {
  assert.deepEqual(sheetNames(workbook('el')), ['Σύνοψη', 'Αναλυτικός πίνακας', 'Συντεταγμένες', 'Αντιστοίχιση']);
  assert.deepEqual(sheetNames(workbook('en')), ['Summary', 'Schedule', 'Coordinates', 'Mapping']);
  assert.deepEqual(sheetNames(workbook('it')), ['Riepilogo', 'Prospetto', 'Coordinate', 'Assegnazione']);
  for (const l of ['el', 'en', 'it']) for (const n of sheetNames(workbook(l))) assert.ok(n.length <= 31 && !/[[\]:*?/\\]/.test(n) && !/^'|'$/.test(n), n);
});

test('the summary sheet: both blocks with numbers as numbers, the inputs, the rules date and the disclaimer, in Greek', () => {
  const s = workbook('el')['xl/worksheets/sheet1.xml'];
  assert.ok(s.includes('Ενδεικτικός προέλεγχος — όχι επίσημος υπολογισμός.'), 'disclaimer');
  assert.ok(s.includes('>Ελέγχονται από την Υ.ΔΟΜ<') && s.includes('>Στην υπεύθυνη δήλωσή σας<'), 'the two blocks');
  assert.ok(s.includes('>Μέγεθος<') && s.includes('>Επιτρεπόμενο<') && s.includes('>Πραγματοποιούμενο<'), 'headings');
  for (const v of ['500', '300', '150', '310', '400', '1380', '2000']) assert.ok(s.includes(`<v>${v}</v>`), `number ${v}`);
  assert.ok(s.includes('>Κώδ. 207 (ΝΟΚ 12)<'), 'article');
  assert.ok(s.includes('Κανόνες: Ν.5306/2026 (08.06.2026)'), 'rules date');
  assert.ok(s.includes('>Ύψος ορόφου: Ισόγειο (m)<') && s.includes('<v>3.2</v>'), 'storey height input');
  assert.ok(s.includes('Μονάδες σχεδίου: m'), 'units');
});

test('the schedule, coordinate and mapping sheets', () => {
  const x = workbook('en');
  const sch = x['xl/worksheets/sheet2.xml'];
  assert.ok(sch.includes('>Ground floor<') && sch.includes('<v>110</v>') && sch.includes('>cap 40 m²<'));
  assert.ok(sch.includes('Mezzanines count in δόμηση since Ν.5197/2025'));
  const co = x['xl/worksheets/sheet3.xml'];
  assert.ok(co.includes('<v>410000</v>') && co.includes('<v>4495025</v>') && co.includes('>Building vertices (coverage outline)<'));
  const mp = x['xl/worksheets/sheet4.xml'];
  assert.ok(mp.includes('>AC_LVL_00<') && mp.includes('>Level outline<') && mp.includes('>Ground floor<'));
  assert.ok(mp.includes('Open outline on layer AC_GREEN: not measured.'), 'warnings');
  assert.ok(mp.includes('Volume uses floor-to-floor storey heights'), 'the storey-height assumption');
});
