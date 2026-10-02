import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout has CRLF
const page = read('../../steel-takeoff.html'), ui = read('../../js/steel/ui.js'), css = read('../../css/tools.css');
function toolStrings() {
  const window = {};
  vm.runInNewContext(read('../../js/steel/i18n-steel.js'), { window });
  return window.ST_I18N;
}

test('every element the controller looks up is on the page, once', () => {
  const ids = new Set([...ui.matchAll(/\$\('([A-Za-z0-9_]+)'\)/g)].map(m => m[1]));
  for (const k of ['length', 'width', 'depth']) ids.add(`stBath_${k}`);
  for (const k of ['galv', 'zinc', 'paint', 'steel', 'minimum']) ids.add(`stRate_${k}`);
  for (const g of ['S235', 'S275', 'S355', 'other']) ids.add(`stGrade_${g}`);
  assert.ok(ids.size >= 40, `${ids.size} ids`);
  for (const id of ids) assert.equal(page.split(`id="${id}"`).length - 1, 1, id);
});

test('the inputs of spec §6.2: files (NC1, ZIP, IFC, several), a folder, the example and its IFC twin', () => {
  assert.ok(page.includes('<input type="file" id="stFiles" multiple accept=".nc1,.nc,.NC1,.NC,.zip,.ifc" class="gv-visually-hidden" />'));
  assert.ok(page.includes('<input type="file" id="stFolder" webkitdirectory multiple class="gv-visually-hidden" />'));
  assert.ok(page.includes('id="stExample" data-i18n="st.example"') && page.includes('id="stExampleIfc" data-i18n="st.example.ifc"'));
  assert.ok(/webkitGetAsEntry[\s\S]*readEntries/.test(ui), 'a dropped folder is walked');
  assert.ok(!/\.bytes\s*(\|\||\?)/.test(ui) && ui.includes('f.data || new Uint8Array(await f.arrayBuffer())'), 'a File is read with arrayBuffer(): Chrome 154 has Blob.prototype.bytes');
});

test('the order of spec §6: summary, settings, table, 3D, costs, outputs, then the CTA and survey', () => {
  const at = s => { const i = page.indexOf(s); assert.ok(i > 0, s); return i; };
  const order = ['id="stSummary"', 'id="stSettings"', 'id="stTable"', 'id="stView"', 'id="stCosts"', 'id="stXlsx"', 'id="stPrint"', 'id="stCta"', 'id="stSurvey"'].map(at);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.deepEqual([...page.matchAll(/data-preset="(\w+)"/g)].map(m => m[1]), ['top', 'front', 'side', 'iso']);
  assert.ok(page.includes('id="st3dModel" aria-pressed="false" data-i18n="st.3d.model" hidden'), 'whole model: for an IFC only');
  assert.deepEqual([...page.matchAll(/data-answer="(\w+)"/g)].map(m => m[1]), ['tekla', 'hand', 'other']);
});

test('GA (spec §8): the events and their parameters, never names or figures', () => {
  const events = [...ui.matchAll(/ga\('([a-z0-9_]+)', (\{[^}]*\})/g)].map(m => `${m[1]} ${m[2].replace(/\s+/g, ' ')}`);
  assert.deepEqual(events.sort(), [
    "steel_cta_click { where: 'page' }",
    'steel_error { reason }',
    'steel_error { reason: \'nonc1\' }',
    'steel_example {}',
    'steel_example {}',
    "steel_loaded { kind: 'ifc', pieces: piecesBucket(m.rows.reduce((a, r) => a + r.qty, 0)) }",
    "steel_loaded { kind: s.zips.length ? 'zip' : 'nc1', pieces: piecesBucket(pieces) }",
    'steel_print {}',
    'steel_survey { answer: b.dataset.answer }',
    'steel_view3d { result }',
    'steel_xlsx {}',
  ].sort());
});

test('the bridge waits 120 s; the IFC check runs as its own pass after the rows are shown', () => {
  assert.ok(ui.includes('const TIMEOUT_MS = 120000;'));
  const read1 = ui.indexOf("engine.process(file.name, bytes, {})"), render1 = ui.indexOf('render();', read1), check = ui.indexOf("{ check: true }");
  assert.ok(read1 > 0 && render1 > read1 && check > render1, 'rows rendered before the check is asked for');
});

test('the CSS: steel rules scoped .st-*, the 375 px table scrolling in its box, the print sheet without the 3D view and controls', () => {
  const from = css.indexOf('/* ---- steel-takeoff.html'), steel = css.slice(from, css.indexOf('/* ---- ', from + 10));
  assert.ok(steel.length > 1000);
  for (const m of steel.matchAll(/^([^@\s}][^{]*)\{/gm)) assert.ok(/\.st-|#st[A-Z0-9]/.test(m[1]), `unscoped: ${m[1]}`);
  assert.ok(page.includes('<div class="gv-table-wrap">\n          <table class="gv-table st-table" id="stTable">'), 'the table scrolls inside its own box');
  const print = steel.slice(steel.indexOf('@media print'));
  for (const s of ['.st-settings', '.st-view', '.st-outputs', '.st-piece']) assert.ok(print.includes(s), s);
  assert.ok(page.includes('<div class="gv-print-head">'), 'the printed sheet keeps a title');
});

test('the page carries the Greek strings inline, as the page starts in Greek', () => {
  const s = toolStrings();
  let n = 0;
  for (const m of page.matchAll(/data-i18n="(st\.[^"]+)"[^>]*>([^<]*)</g)) { n++; assert.equal(m[2], s.el[m[1]], m[1]); }
  for (const m of page.matchAll(/data-i18n-aria="(st\.[^"]+)" aria-label="([^"]*)"/g)) { n++; assert.equal(m[2], s.el[m[1]], m[1]); }
  assert.ok(n >= 70, `${n} inline strings`);
});

test('every st.* key on the page and in the controller has a string', () => {
  const s = toolStrings();
  let used = 0;
  for (const src of [page, ui]) for (const m of src.matchAll(/['"`](st\.[A-Za-z0-9.]+[A-Za-z0-9])['"`]/g)) { used++; assert.ok(m[1] in s.en, `${m[1]} has no string`); }
  assert.ok(used >= 100, `${used} keys found`);
});

test('skip reasons are shown even when nothing loads: #stSkipped is outside #stPanel', () => {
  const stSkippedIdx = page.indexOf('id="stSkipped"');
  const stPanelStart = page.indexOf('<section class="st-panel" id="stPanel"');
  const stPanelEnd = page.indexOf('</section>', stPanelStart);
  assert.ok(stSkippedIdx > 0 && stPanelStart > 0, '#stSkipped and #stPanel exist');
  assert.ok(stSkippedIdx < stPanelStart, '#stSkipped comes before #stPanel (not nested inside it)');
  assert.ok(stSkippedIdx < page.indexOf('id="stPanel"'), '#stSkipped is outside the panel section');
});

test('final review: the wording, the unpriced note, the 375 px cost rule, the summary units', () => {
  const css2 = css.slice(css.indexOf('/* ---- steel-takeoff.html'));
  assert.ok(/@media \(max-width: 480px\)[^}]*\}?[\s\S]*\.st-costs tbody th \{ white-space: normal/.test(css2), 'cost labels wrap on phones');
  assert.ok(page.includes('id="stUnpriced"'));
  assert.ok(!/απέναντι/.test(page + ui), 'no «απέναντι»');
  assert.ok(page.includes('Ελέγξτε τα με τα κατασκευαστικά σχέδια'));
  assert.ok(ui.includes("t('st.sum.marks.v', { n: T.excluded })") && ui.includes("t('st.sum.marks.v', { n: T.noArea })") && ui.includes("t('st.sum.marks.v', { n: T.checks })"));
});
