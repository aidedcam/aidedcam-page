// DWG quantities: the .xlsx download (spec §5 Output). A minimal SpreadsheetML writer on the laser tool's
// stored ZIP: inline strings, numbers stored as numbers with a number format, a bold header row, column
// widths and a frozen header. Pure: sheets in, bytes out.
import { zipStore } from '../laser/zip.js?v=20260930';
import { summary, layerRows, layerTotals, blockRows, blockTotals } from './tables.js?v=20260930';
import { INFO_WARNINGS } from './state.js?v=20260930';

// Style ids in styles.xml: plain text, bold, then per format plain/bold.
const FMT = { text: 0, int: 2, m: 3, m2: 3 };
const BOLD = { text: 1, int: 4, m: 5, m2: 5 };

const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
export const esc = s => String(s).replace(INVALID_XML, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function colName(i) {
  let s = '';
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

// Excel's rules: at most 31 characters, none of []:*?/\, no leading or trailing apostrophe, unique
// without regard to case.
export function sheetNames(names) {
  const seen = new Set();
  return names.map(raw => {
    let base = String(raw).replace(INVALID_XML, '').replace(/[[\]:*?/\\]/g, '_').replace(/^'+|'+$/g, '').trim() || 'Sheet';
    base = base.slice(0, 31).trim().replace(/^'+|'+$/g, '').trim();
    let out = base, k = 1;
    while (seen.has(out.toLowerCase())) {
      const suffix = ` (${++k})`;
      out = (base.slice(0, 31 - suffix.length).trimEnd() + suffix).replace(/^'+|'+$/g, '').trim() || 'Sheet';
    }
    seen.add(out.toLowerCase());
    return out;
  });
}

// A cell: null/undefined/'' is empty; a number uses the column's format; { v, fmt } sets its own format.
function cellXml(ref, cell, fmt, bold) {
  if (cell && typeof cell === 'object') { fmt = cell.fmt || fmt; cell = cell.v; }
  if (cell === null || cell === undefined || cell === '') return '';
  const s = (bold ? BOLD : FMT)[fmt] ?? (bold ? 1 : 0);
  if (typeof cell === 'number' && Number.isFinite(cell)) return `<c r="${ref}" s="${s}"><v>${cell}</v></c>`;
  return `<c r="${ref}" t="inlineStr" s="${bold ? 1 : 0}"><is><t xml:space="preserve">${esc(cell)}</t></is></c>`;
}

// A row is an array of cells, or { cells, bold } for titles and in-sheet headers.
function sheetXml(sheet) {
  const cols = sheet.columns || [];
  const rows = [];
  let freeze = 0;
  if (sheet.note) rows.push({ cells: [sheet.note], bold: true });
  if (cols.some(c => c.header != null)) { rows.push({ cells: cols.map(c => c.header ?? ''), bold: true }); freeze = rows.length; }
  for (const r of sheet.rows || []) rows.push(Array.isArray(r) ? { cells: r, bold: false } : r);
  if (sheet.totals) rows.push({ cells: sheet.totals, bold: true });
  const body = rows.map((r, ri) => {
    const cells = r.cells.map((c, ci) => cellXml(colName(ci) + (ri + 1), c, (cols[ci] && cols[ci].fmt) || 'text', r.bold)).join('');
    return `<row r="${ri + 1}">${cells}</row>`;
  }).join('');
  const pane = freeze
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${freeze}" topLeftCell="A${freeze + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const widths = cols.length
    ? '<cols>' + cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 12}" customWidth="1"/>`).join('') + '</cols>'
    : '';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + pane + widths + `<sheetData>${body}</sheetData></worksheet>`;
}

const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
  + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  + '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.000"/></numFmts>'
  + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
  + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
  + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="6">'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
  + '<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  + '<xf numFmtId="1" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>'
  + '<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>'
  + '</cellXfs>'
  + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
  + '</styleSheet>';

// sheets: [{ name, columns: [{ header, width, fmt }], rows, totals?, note? }] → the .xlsx bytes.
export function writeXlsx(sheets) {
  const enc = new TextEncoder();
  const names = sheetNames(sheets.map(s => s.name));
  const n = sheets.length;
  const files = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
      + '</Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
      + '</Relationships>'],
    ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
      + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + '<sheets>' + names.map((nm, i) => `<sheet name="${esc(nm)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets>'
      + '</workbook>'],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
      + `<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
      + '</Relationships>'],
    ['xl/styles.xml', STYLES],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)]),
  ];
  return zipStore(files.map(([name, text]) => ({ name, bytes: enc.encode(text) })));
}

const stem = name => { const d = String(name).lastIndexOf('.'); return d > 0 ? String(name).slice(0, d) : String(name); };

// "<file> <label>", with the file part cut so the whole name fits Excel's 31 characters.
function fileSheet(name, label) {
  const room = Math.max(1, 31 - 1 - label.length);
  return `${stem(name).slice(0, room).trim()} ${label}`;
}

const LAYER_COLS = t => [
  { header: t('dq.col.layer'), width: 28, fmt: 'text' },
  { header: t('dq.col.len'), width: 14, fmt: 'm' },
  { header: t('dq.col.count'), width: 10, fmt: 'int' },
  { header: t('dq.col.area'), width: 14, fmt: 'm2' },
  { header: t('dq.col.count'), width: 10, fmt: 'int' },
  { header: t('dq.col.hatchArea'), width: 16, fmt: 'm2' },
  { header: t('dq.col.count'), width: 10, fmt: 'int' },
  { header: t('dq.col.state'), width: 24, fmt: 'text' },
];

function stateNote(r, t) {
  const s = [];
  if (r.off) s.push(t('dq.badge.off'));
  if (r.frozen) s.push(t('dq.badge.frozen'));
  if (r.bad) s.push(t('dq.badge.bad', { n: r.bad }));
  return s.join(', ');
}

const layerRow = (r, t) => [r.name, r.len, r.lenCount, r.area, r.areaCount, r.hatchArea, r.hatchCount, stateNote(r, t)];
const layerTotalRow = (rows, t) => { const s = layerTotals(rows); return [t('dq.total'), s.len, s.lenCount, s.area, s.areaCount, s.hatchArea, s.hatchCount, '']; };

const BLOCK_COLS = t => [
  { header: t('dq.col.block'), width: 28, fmt: 'text' },
  { header: t('dq.col.layer'), width: 24, fmt: 'text' },
  { header: t('dq.col.count'), width: 10, fmt: 'int' },
  { header: t('dq.col.nested'), width: 14, fmt: 'int' },
];

// A file's provenance on its Layers sheet: the units line as the page shows it, then the warnings that need
// attention (info warnings left out), joined with ' · '. Parameters as the page writes them, inch as 'in'.
const unitName = u => (u === 'inch' ? 'in' : u);
function fileNote(result, t) {
  const parts = [];
  const file = result.file;
  if (file) parts.push(t('dq.units.line', { units: unitName(file.used), source: t('dq.units.src.' + file.unitsSource) }));
  for (const w of result.warnings || []) {
    if (INFO_WARNINGS.has(w.id)) continue;
    const params = Object.fromEntries(Object.entries(w.params || {}).map(([k, v]) => [k, typeof v === 'number' ? v : unitName(String(v ?? ''))]));
    parts.push(t('dq.warn.' + w.id, params));
  }
  return parts.length ? parts.join(' · ') : undefined;
}

// The workbook for a batch (spec §5): a Summary sheet, then Layers, Blocks and Schedules per read file.
export function workbookFor(files, t) {
  const sum = summary(files);
  const int = v => ({ v, fmt: 'int' });
  const blockTableRows = rows => rows.map(b => [b.name, b.layer, int(b.count), int(b.nested)]);
  const blockTotal = rows => { const s = blockTotals(rows); return { cells: [t('dq.total'), '', int(s.count), int(s.nested)], bold: true }; };

  // Summary: the layer table under the frozen header, then the block table with its own header.
  const summaryRows = sum.layers.map(r => layerRow(r, t));
  summaryRows.push({ cells: layerTotalRow(sum.layers, t), bold: true }, []);
  summaryRows.push({ cells: [t('dq.col.block'), t('dq.col.layer'), t('dq.col.count'), t('dq.col.nested')], bold: true });
  summaryRows.push(...blockTableRows(sum.blocks), blockTotal(sum.blocks));
  const sheets = [{
    name: t('dq.sheet.summary'),
    note: sum.partial ? t('dq.xlsx.partial', { files: sum.missing.join(', ') }) : undefined,
    columns: LAYER_COLS(t),
    rows: summaryRows,
  }];

  for (const f of files) {
    if (!f.result || f.result.type !== 'result') continue;
    const layers = layerRows(f.result), blocks = blockRows(f.result);
    sheets.push({
      name: fileSheet(f.name, t('dq.sheet.layers')), note: fileNote(f.result, t),
      columns: LAYER_COLS(t), rows: layers.map(r => layerRow(r, t)), totals: layerTotalRow(layers, t),
    });
    const bt = blockTotals(blocks);
    sheets.push({ name: fileSheet(f.name, t('dq.sheet.blocks')), columns: BLOCK_COLS(t), rows: blockTableRows(blocks), totals: [t('dq.total'), '', bt.count, bt.nested] });
    const sched = f.result.schedules || [];
    const width = Math.max(1, ...sched.map(s => s.tags.length + 1));
    const rows = [];
    if (!sched.length) rows.push([t('dq.schedules.none')]);
    sched.forEach((s, i) => {
      if (i) rows.push([]);
      rows.push({ cells: [s.block], bold: true });
      rows.push({ cells: [...s.tags, t('dq.col.count')], bold: true });
      for (const r of s.rows) rows.push([...r.values, int(r.count)]);
    });
    sheets.push({
      name: fileSheet(f.name, t('dq.sheet.schedules')),
      columns: Array.from({ length: width }, () => ({ header: null, width: 16, fmt: 'text' })),
      rows,
    });
  }
  return sheets;
}

// The download's file name.
export function xlsxName(files) {
  if (files.length === 1) {
    const s = stem(files[0].name).replace(/[^\p{L}\p{N}._ -]+/gu, '_').trim() || 'drawing';
    return `quantities-${s}.xlsx`;
  }
  return `quantities-${files.length}-files.xlsx`;
}
