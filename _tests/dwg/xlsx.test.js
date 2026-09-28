import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeXlsx, workbookFor, xlsxName, sheetNames, esc } from '../../js/dwg/xlsx.js';

// Reads the stored (uncompressed) entries back through their local headers.
function unzip(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), dec = new TextDecoder();
  const out = {};
  let p = 0;
  while (v.getUint32(p, true) === 0x04034b50) {
    assert.equal(v.getUint16(p + 8, true), 0, 'stored');
    const size = v.getUint32(p + 18, true), nameLen = v.getUint16(p + 26, true), extra = v.getUint16(p + 28, true);
    const name = dec.decode(bytes.subarray(p + 30, p + 30 + nameLen));
    const at = p + 30 + nameLen + extra;
    out[name] = dec.decode(bytes.subarray(at, at + size));
    p = at + size;
  }
  return out;
}

const sheetNamesOf = files => [...files['xl/workbook.xml'].matchAll(/<sheet name="([^"]*)"/g)].map(m => m[1]);

test('the package has its parts, and each sheet is declared, related and present', () => {
  const x = unzip(writeXlsx([
    { name: 'One', columns: [{ header: 'A', width: 10, fmt: 'text' }], rows: [['x']] },
    { name: 'Two', columns: [{ header: 'B', fmt: 'int' }], rows: [[1]] },
  ]));
  for (const p of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) assert.ok(p in x, p);
  assert.ok(x['[Content_Types].xml'].includes('PartName="/xl/worksheets/sheet2.xml"'));
  assert.ok(x['xl/_rels/workbook.xml.rels'].includes('Target="worksheets/sheet2.xml"'));
  assert.ok(x['xl/_rels/workbook.xml.rels'].includes('Target="styles.xml"'));
  assert.deepEqual(sheetNamesOf(x), ['One', 'Two']);
  for (const f of Object.values(x)) assert.ok(f.startsWith('<?xml'), 'every part is XML');
});

test('numbers are numbers with their format; text is inline; the header is bold and frozen', () => {
  const x = unzip(writeXlsx([{
    name: 'S',
    columns: [{ header: 'Στρώση', width: 20, fmt: 'text' }, { header: 'Μήκος (m)', fmt: 'm' }, { header: 'Πλήθος', fmt: 'int' }],
    rows: [['ΣΩΛΗΝΑΣ', 12.3456, 4], ['X', { v: 7, fmt: 'int' }, null]],
    totals: ['Σύνολο', 19.3456, 4],
  }]));
  const s = x['xl/worksheets/sheet1.xml'];
  assert.ok(s.includes('<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">Στρώση</t></is></c>'), 'bold Greek header');
  assert.ok(s.includes('<c r="B2" s="3"><v>12.3456</v></c>'), 'metres: number format 164');
  assert.ok(s.includes('<c r="C2" s="2"><v>4</v></c>'), 'integer: format 1');
  assert.ok(s.includes('<c r="B3" s="2"><v>7</v></c>'), 'a cell can set its own format');
  assert.ok(!s.includes('r="C3"'), 'an empty cell is left out');
  assert.ok(s.includes('<c r="B4" s="5"><v>19.3456</v></c>'), 'bold totals keep the format');
  assert.ok(s.includes('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'));
  assert.ok(s.includes('<col min="1" max="1" width="20" customWidth="1"/>'));
  assert.ok(!/<v>[^<]*[^0-9.eE+-][^<]*<\/v>/.test(s), 'every <v> holds a number');
  const st = x['xl/styles.xml'];
  assert.ok(st.includes('<numFmt numFmtId="164" formatCode="#,##0.000"/>'));
  assert.ok(st.includes('<fonts count="2">') && st.includes('<b/>'));
  assert.equal((st.match(/<xf numFmtId/g) || []).length, 7, '1 style xf + 6 cell xfs');
});

test('text is escaped and characters XML forbids are dropped', () => {
  const x = unzip(writeXlsx([{ name: 'a<b>&c', columns: [{ header: 'h' }], rows: [['<A & B> "q"\u0001￾ ok']] }]));
  assert.ok(x['xl/worksheets/sheet1.xml'].includes('&lt;A &amp; B&gt; &quot;q&quot; ok'));
  assert.deepEqual(sheetNamesOf(x), ['a&lt;b&gt;&amp;c']);
  assert.equal(esc('\uD800x'), 'x', 'a lone surrogate is dropped');
});

test('sheet names: 31 characters, no forbidden characters, unique without case', () => {
  const long = 'Α'.repeat(40);
  const names = sheetNames(['Layers', 'layers', 'LAYERS', long, long, 'a/b:c*d?e[f]\\g', "'quoted'", '']);
  assert.equal(names[0], 'Layers');
  assert.equal(names[1], 'layers (2)');
  assert.equal(names[2], 'LAYERS (3)');
  assert.equal(names[3], 'Α'.repeat(31));
  assert.equal(names[4], 'Α'.repeat(27) + ' (2)');
  assert.equal(names[5], 'a_b_c_d_e_f__g');
  assert.equal(names[6], 'quoted');
  assert.equal(names[7], 'Sheet');
  for (const n of names) assert.ok(n.length <= 31, n);
  assert.equal(new Set(names.map(n => n.toLowerCase())).size, names.length);
});

test('sheet names never end in an apostrophe after the 31-character cut', () => {
  const cutPointApostrophe = sheetNames(['A'.repeat(30) + "'" + 'B'.repeat(20)]);
  assert.equal(cutPointApostrophe.length, 1);
  assert.ok(cutPointApostrophe[0].length <= 31, cutPointApostrophe[0]);
  assert.ok(cutPointApostrophe[0].length > 0, 'name is non-empty');
  assert.ok(!cutPointApostrophe[0].endsWith("'"), `name should not end in apostrophe: ${cutPointApostrophe[0]}`);
  assert.ok(!cutPointApostrophe[0].startsWith("'"), `name should not start in apostrophe: ${cutPointApostrophe[0]}`);
  const onlyApostrophes = sheetNames(["'''", "'''''''''"]);
  for (const n of onlyApostrophes) {
    assert.ok(n.length > 0, 'fallback name is non-empty');
    assert.ok(n.length <= 31, n);
    assert.ok(!n.endsWith("'") && !n.startsWith("'"), `no apostrophes at edges: ${n}`);
  }
});

const L = (name, o = {}) => ({ name, color: '#ffffff', off: false, frozen: false, len: 0, lenCount: 0, area: 0, areaCount: 0, hatchArea: 0, hatchCount: 0, bad: 0, ...o });
const t = (k, p = {}) => k + (Object.keys(p).length ? JSON.stringify(p) : '');

function batch() {
  const a = { name: 'ισόγειο-ύδρευση-και-αποχέτευση.dwg', result: {
    type: 'result',
    layers: [L('ΣΩΛΗΝΕΣ', { len: 42.5, lenCount: 7 }), L('ROOMS', { area: 31.2, areaCount: 3, hatchArea: 30, hatchCount: 2, off: true, bad: 1 })],
    blocks: [{ name: 'WC', layer: '0', count: 2, nested: 0 }],
    schedules: [{ block: 'WINDOW', tags: ['TYPE', 'W', 'H'], rows: [{ values: ['W1', '120', '140'], count: 8 }, { values: ['W2', '80', '140'], count: 2 }] }],
    items: [], notMeasured: {},
  } };
  const b = { name: 'broken.dxf', result: { type: 'error', reason: 'read' } };
  const c = { name: 'first-floor.dxf', result: { type: 'result', layers: [L('ΣΩΛΗΝΕΣ', { len: 7.5, lenCount: 1 })], blocks: [], schedules: [], items: [], notMeasured: {} } };
  return [a, b, c];
}

test('the batch workbook: Summary first, then three sheets per read file, a failed file noted', () => {
  const sheets = workbookFor(batch(), t);
  assert.deepEqual(sheets.map(s => s.name), [
    'dq.sheet.summary',
    'ισόγειο-ύδρευση dq.sheet.layers', 'ισόγειο-ύδρευση dq.sheet.blocks', 'ισόγειο-ύδρε dq.sheet.schedules',
    'first-floor dq.sheet.layers', 'first-floor dq.sheet.blocks', 'first-floor dq.sheet.schedules',
  ]);
  for (const s of sheets) assert.ok(s.name.length <= 31, s.name);
  const sum = sheets[0];
  assert.equal(sum.note, 'dq.xlsx.partial{"files":"broken.dxf"}');
  const pipes = sum.rows.find(r => Array.isArray(r) && r[0] === 'ΣΩΛΗΝΕΣ');
  assert.equal(pipes[1], 50, 'lengths add across files');
  assert.equal(pipes[2], 8);
  const rooms = sum.rows.find(r => Array.isArray(r) && r[0] === 'ROOMS');
  assert.equal(rooms[7], 'dq.badge.off, dq.badge.bad{"n":1}');
  const total = sum.rows.find(r => r.bold && r.cells[0] === 'dq.total');
  assert.deepEqual(total.cells, ['dq.total', 50, 8, 31.2, 3, 30, 2, '']);
  const sched = sheets[3];
  assert.deepEqual(sched.rows[0], { cells: ['WINDOW'], bold: true });
  assert.deepEqual(sched.rows[1], { cells: ['TYPE', 'W', 'H', 'dq.col.count'], bold: true });
  assert.deepEqual(sched.rows[2], ['W1', '120', '140', { v: 8, fmt: 'int' }]);
  assert.deepEqual(sheets[6].rows, [['dq.schedules.none']]);
});

test('the batch workbook writes and reads back with the partial note on row 1 and the header frozen under it', () => {
  const x = unzip(writeXlsx(workbookFor(batch(), t)));
  assert.equal(sheetNamesOf(x).length, 7);
  const s1 = x['xl/worksheets/sheet1.xml'];
  assert.ok(s1.includes('<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">dq.xlsx.partial{&quot;files&quot;:&quot;broken.dxf&quot;}</t></is></c>'));
  assert.ok(s1.includes('<pane ySplit="2" topLeftCell="A3"'));
  assert.ok(s1.includes('<t xml:space="preserve">ΣΩΛΗΝΕΣ</t>'));
});

test('each file\'s Layers sheet states its units and the warnings that need attention', () => {
  const f = { name: 'plan.dwg', result: {
    type: 'result', file: { name: 'plan.dwg', units: 'none', unitsSource: 'assumed', used: 'mm' },
    layers: [L('ROOMS', { area: 12, areaCount: 1, bad: 1 })], blocks: [], schedules: [], items: [], notMeasured: {},
    warnings: [{ id: 'units-assumed', params: {} }, { id: 'bad-area', params: { count: '1' } }, { id: 'not-measured', params: { count: '4' } }],
  } };
  const sheets = workbookFor([f], t);
  const layers = sheets.find(s => s.name === 'plan dq.sheet.layers');
  const units = 'dq.units.line{"units":"mm","source":"dq.units.src.assumed"}';
  assert.equal(layers.note, `${units} · dq.warn.units-assumed · dq.warn.bad-area{"count":"1"}`, 'info warnings are left out');
  const s = unzip(writeXlsx(sheets))['xl/worksheets/sheet2.xml'];
  const row1 = s.match(/<row r="1">(.*?)<\/row>/)[1];
  assert.ok(row1.includes(esc(units)), 'the units line is on row 1');
  assert.ok(row1.includes(esc('dq.warn.bad-area{"count":"1"}')), 'so is the bad-area warning');
  assert.ok(s.includes('<pane ySplit="2" topLeftCell="A3"'), 'the header is frozen under the note');
});

test('the file name', () => {
  assert.equal(xlsxName([{ name: 'Κάτοψη ισογείου.dwg' }]), 'quantities-Κάτοψη ισογείου.xlsx');
  assert.equal(xlsxName([{ name: 'a:b*c.dxf' }]), 'quantities-a_b_c.xlsx');
  assert.equal(xlsxName([{ name: 'a.dwg' }, { name: 'b.dwg' }, { name: 'c.dwg' }]), 'quantities-3-files.xlsx');
});
