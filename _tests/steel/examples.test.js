import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseNc1 } from '../../js/steel/nc1.js';
import { takeoff, kg1, m2 } from '../../js/steel/quote.js';
import { BATH_DEFAULT } from '../../js/steel/bath.js';
import { exampleRows } from './example-rows.mjs';

const DIR = new URL('../../js/steel/examples/portal/', import.meta.url);

test('the generator is deterministic: --check finds the committed example byte-identical', () => {
  const out = execFileSync(process.execPath, ['_tests/steel/make-example.mjs', '--check'], { encoding: 'utf8' });
  assert.equal(out.trim(), 'same 8 files');
});

test('the NC1 set: six marks in index.json, Tekla-style text (CRLF, ASCII), every file one piece', () => {
  const index = JSON.parse(readFileSync(new URL('index.json', DIR), 'utf8'));
  assert.deepEqual(index.files, ['C1.nc1', 'R1.nc1', 'PU1.nc1', 'CL1.nc1', 'BP1.nc1', 'HP1.nc1']);
  for (const f of index.files) {
    const text = readFileSync(new URL(f, DIR), 'latin1');
    assert.ok(text.startsWith('ST\r\n** AidedCAM example portal frame\r\n') && text.endsWith('EN\r\n'), f);
    assert.ok(!/[^\r\n\x20-\x7e]/.test(text), `${f}: ASCII only`);
    assert.equal(parseNc1(text).ok, true, f);
  }
});

test('the pinned take-off: per mark kg, m² and bath mark; 16 pieces, 1,069.0 kg, 29.89 m²', () => {
  const rows = exampleRows();
  assert.deepEqual(rows.map(r => [r.mark, r.profile, r.grade, r.qty, r.kgFrom, +r.unitKg.toFixed(3), +r.unitM2.toFixed(4), r.warn.join()]), [
    ['C1', 'HEA200', 'S355', 2, 'header', 169.2, 4.544, ''],
    ['R1', 'IPE300', 'S355', 2, 'header', 212.055, 5.829, ''],
    ['PU1', 'RHS100*50*4', 'S275', 2, 'header', 118.53, 3.915, ''],
    ['CL1', 'L80*8', 'S275', 4, 'header', 1.445, 0.0466, ''],
    ['BP1', 'PL20*300', 'S275', 2, 'contour', 13.599, 0.2063, ''],
    ['HP1', 'PL15*200', 'S275', 4, 'contour', 9.111, 0.1785, ''],
  ]);
  const t = takeoff(rows, BATH_DEFAULT);
  assert.deepEqual([t.totals.pieces, kg1(t.totals.kg), m2(t.totals.m2), t.totals.double, t.totals.no, t.totals.checks], [16, 1069, 29.89, 2, 0, 0]);
  assert.deepEqual(rows.map(r => r.bath), ['fits', 'fits', 'double', 'fits', 'fits', 'fits']);
  assert.deepEqual(t.groups.map(g => `${g.profile} ${g.grade}`), ['IPE300 S355', 'HEA200 S355', 'RHS100*50*4 S275', 'PL 15 S275', 'PL 20 S275', 'L80*8 S275']);
  assert.equal(t.longest.mark, 'PU1');
  assert.equal(t.heaviest.mark, 'R1');
});

test('the IFC example is IFC4 text in plain ASCII with unique GlobalIds', () => {
  const text = readFileSync(new URL('../portal.ifc', DIR), 'latin1');
  assert.ok(text.startsWith('ISO-10303-21;\nHEADER;\n') && text.includes("FILE_SCHEMA(('IFC4'));") && text.endsWith('END-ISO-10303-21;\n'));
  assert.ok(!/[^\x0a\x20-\x7e]/.test(text));
  const ids = [...text.matchAll(/^#\d+=IFC\w+\('([0-9A-Za-z_$]{22})'/gm)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  assert.ok(ids.every(g => g.startsWith('2AidedCAMsteelEx')));
  for (const k of ['IFCISHAPEPROFILEDEF', 'IFCRECTANGLEHOLLOWPROFILEDEF', 'IFCLSHAPEPROFILEDEF', 'IFCARBITRARYPROFILEDEFWITHVOIDS', 'IFCINDEXEDPOLYCURVE', 'IFCARCINDEX', 'IFCELEMENTASSEMBLY', "'Tekla Common'", "'Tekla Assembly'"]) assert.ok(text.includes(k), k);
});

test('.gitattributes keeps the example byte-exact', () => {
  assert.ok(readFileSync(new URL('../../.gitattributes', import.meta.url), 'utf8').includes('js/steel/examples/** binary'));
});
