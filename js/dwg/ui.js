// DWG quantities: the page controller (spec §5). Files go to the engine worker one at a time; the page keeps
// each file's result, shows one file (or the Summary) at a time, and does selection totals and the .xlsx in
// JavaScript, so neither ever calls the engine.
import { t, ga, fmtNum, lang } from '../gcode/shell/i18n.js';
import { lsGet, lsSet, loadStored, saveStored } from '../gcode/shell/settings-store.js';
import { renderBanner } from '../gcode/shell/banner.js';
// The tool's own modules carry the deploy version, so a cached old module never meets a new controller.
import { createEngine } from '../laser/bridge.js?v=20260928';
import { layerRows, layerTotals, blockRows, blockTotals, summary } from './tables.js?v=20260928';
import { selectBox, selectionTotals, selectionTsv } from './selection.js?v=20260928';
import { writeXlsx, workbookFor, xlsxName } from './xlsx.js?v=20260928';
import { createView } from './view.js?v=20260928';
import { UNITS, INFO_WARNINGS, rowItems, clickSelection, boxSelection, fileStatus, engineSettings, admit, loadedEvent } from './state.js?v=20260928';

const $ = id => document.getElementById(id);
const SETTINGS_KEY = 'aidedcam-dq-settings';
const SURVEY_KEY = 'aidedcam-dq-survey';
const EXAMPLE = 'example-plan.dwg';
const TIMEOUT_MS = 60000;                 // big building drawings take longer than laser parts

const state = {
  files: [],                  // { id, name, bytes, result, status: waiting|processing|done, override, selCounted }
  active: null,               // a file id, or 'summary'
  sel: [],                    // selected item indices of the active file
  hl: null,                   // the highlighted table row: { layer } or { block, layer }
  pickRow: null,              // the row of the last clicked item
  banner: null,
  engineReady: false,
  settings: loadStored(SETTINGS_KEY, { units: 'auto' }),
};
let nextId = 0, shown = null;

const num2 = v => fmtNum(v, 2);
const int = v => fmtNum(v, 0);
const unitName = u => (u === 'inch' ? 'in' : u);
function showBanner(b) { state.banner = b; renderBanner($('dqBanner'), b, t); }
const okResult = f => f && f.result && f.result.type === 'result';
const activeFile = () => state.files.find(f => f.id === state.active) || null;
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

// ---- the engine ----
const supported = typeof WebAssembly === 'object' && typeof Worker === 'function' && typeof DecompressionStream === 'function';
const engine = supported ? createEngine({
  makeWorker: () => new Worker(new URL('./worker.js?v=20260928', import.meta.url), { type: 'module' }),
  onBootProgress: pct => showBanner({ key: 'dq.engine.loading', params: { pct } }),
  onReady: () => { state.engineReady = true; if (state.banner && state.banner.key === 'dq.engine.loading') showBanner(null); },
  timeoutMs: TIMEOUT_MS,
}) : null;
if (!supported) showBanner({ key: 'dq.engine.nowasm' });

async function run(f) {
  if (!engine) { f.result = { type: 'error', reason: 'engine', message: 'no WebAssembly' }; f.status = 'done'; render(); return; }
  const gen = f.gen = (f.gen || 0) + 1;      // a stale re-measure (superseded by a later one) must not land
  f.status = 'processing';
  render();
  const m = await engine.process(f.name, f.bytes.slice(0), engineSettings(state.settings, f));
  if (!state.files.includes(f)) return;                          // removed meanwhile
  if (f.gen !== gen) return;                                      // a newer run() for this file finished first
  f.result = m;
  f.status = 'done';
  if (m.type === 'error' && m.reason === 'engine' && !state.engineReady) {
    showBanner({ key: 'dq.engine.failed', action: { key: 'dq.engine.retry', run: () => location.reload() } });
  }
  if (f.id === state.active) { state.sel = []; state.hl = null; state.pickRow = null; }
  render();
  if (f.batch) finishBatch(f);
}

function addFiles(list, source) {
  const { take, dropped } = admit(state.files.length, list);
  if (dropped > 0) showBanner({ key: 'dq.toomany', params: { max: 20 } });
  const added = take.map(x => ({
    id: ++nextId, name: x.name, bytes: x.bytes, override: null, selCounted: false,
    result: x.result || null, status: x.result ? 'done' : 'waiting',
  }));
  if (!added.length) return;
  state.files.push(...added);
  if (state.active === null) state.active = added[0].id;
  // Each file keeps its own batch: a later addFiles() call must not lose an earlier one still in flight.
  const b = { files: added, left: added.length, source, counted: new Set() };
  for (const f of added) f.batch = b;
  render();
  for (const f of added) { if (f.status === 'done') finishBatch(f); else run(f); }
}

function finishBatch(f) {
  const b = f.batch;
  if (!b || b.counted.has(f)) return;
  b.counted.add(f);
  if (--b.left > 0) return;
  if (b.source === 'example') ga('dwgq_example_loaded', {});
  else ga('dwgq_files_loaded', loadedEvent(b.files));
}

// ---- tabs ----
function statusMark(f) {
  const st = fileStatus(f);
  if (!st) return el('span', 'dq-mark is-busy', t(f.status === 'processing' ? 'dq.processing' : 'dq.waiting'));
  const s = el('span', `dq-mark is-${st}`, st === 'ok' ? '✔' : st === 'warn' ? '⚠' : '✖');
  s.title = t(`dq.status.${st}`);
  s.setAttribute('aria-label', t(`dq.status.${st}`));
  return s;
}

function tab(label, key, mark) {
  const b = el('button', 'dq-tab');
  b.type = 'button';
  b.setAttribute('role', 'tab');
  b.setAttribute('aria-selected', String(state.active === key));
  if (mark) b.appendChild(mark);
  b.appendChild(el('span', 'dq-tab-name', label));
  b.title = label;
  b.addEventListener('click', () => activate(key));
  return b;
}

function renderTabs() {
  const box = $('dqTabs');
  box.hidden = !state.files.length;
  const list = [];
  if (state.files.length > 1) list.push(tab(t('dq.tab.summary'), 'summary', null));
  for (const f of state.files) list.push(tab(f.name, f.id, statusMark(f)));
  box.replaceChildren(...list);
}

function activate(key) {
  if (state.active === key) return;
  state.active = key;
  state.sel = []; state.hl = null; state.pickRow = null;
  render();
}

// ---- tables ----
const cell = (text, cls) => el('td', cls, text);
const rowKey = r => (r ? (r.block != null ? `b\u0000${r.block}\u0000${r.layer}` : `l\u0000${r.layer}`) : '');

function layerRow(r, clickable) {
  const tr = document.createElement('tr');
  const sw = document.createElement('td');
  const chip = el('span', 'lc-chip'); chip.style.background = r.color || 'transparent';
  sw.appendChild(chip); tr.appendChild(sw);
  tr.appendChild(cell(r.name, 'dq-name'));
  tr.appendChild(cell(num2(r.len), 'dq-num'));
  tr.appendChild(cell(int(r.lenCount), 'dq-num'));
  tr.appendChild(cell(num2(r.area), 'dq-num'));
  tr.appendChild(cell(int(r.areaCount), 'dq-num'));
  tr.appendChild(cell(num2(r.hatchArea), 'dq-num'));
  tr.appendChild(cell(int(r.hatchCount), 'dq-num'));
  const st = document.createElement('td');
  if (r.off) st.appendChild(el('span', 'dq-badge', t('dq.badge.off')));
  if (r.frozen) st.appendChild(el('span', 'dq-badge', t('dq.badge.frozen')));
  if (r.bad) st.appendChild(el('span', 'dq-badge is-bad', '⚠ ' + t('dq.badge.bad', { n: r.bad })));
  tr.appendChild(st);
  if (clickable) makeRowClickable(tr, { layer: r.name });
  return tr;
}

function blockRow(r, clickable) {
  const tr = document.createElement('tr');
  tr.appendChild(cell(r.name, 'dq-name'));
  tr.appendChild(cell(r.layer, 'dq-name'));
  tr.appendChild(cell(int(r.count), 'dq-num'));
  tr.appendChild(cell(int(r.nested), 'dq-num'));
  if (clickable && r.count > 0) makeRowClickable(tr, { block: r.name, layer: r.layer });
  return tr;
}

function makeRowClickable(tr, key) {
  tr.dataset.key = rowKey(key);
  tr.tabIndex = 0;
  const go = () => toggleHighlight(key);
  tr.addEventListener('click', go);
  tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
}

function renderTables(layers, blocks, clickable, prefix) {
  $('dqLayers').tBodies[0].replaceChildren(...layers.map(r => layerRow(r, clickable)));
  const lt = layerTotals(layers);
  const c = $('dqLayerTotals').children;
  c[2].textContent = prefix + num2(lt.len); c[3].textContent = prefix + int(lt.lenCount);
  c[4].textContent = prefix + num2(lt.area); c[5].textContent = prefix + int(lt.areaCount);
  c[6].textContent = prefix + num2(lt.hatchArea); c[7].textContent = prefix + int(lt.hatchCount);
  for (const i of [2, 3, 4, 5, 6, 7]) c[i].className = 'dq-num';
  $('dqBlocks').tBodies[0].replaceChildren(...blocks.map(r => blockRow(r, clickable)));
  const bt = blockTotals(blocks);
  const b = $('dqBlockTotals').children;
  b[2].textContent = prefix + int(bt.count); b[3].textContent = prefix + int(bt.nested);
  b[2].className = b[3].className = 'dq-num';
  $('dqBlocks').hidden = !blocks.length;
  $('dqNoBlocks').hidden = blocks.length > 0;
  markRows();
}

function renderSchedules(r) {
  const box = $('dqSchedules');
  if (!r.schedules.length) { box.replaceChildren(el('p', 'gv-note', t('dq.schedules.none'))); return; }
  box.replaceChildren(...r.schedules.map(s => {
    const wrap = el('div');
    wrap.appendChild(el('h3', null, s.block));
    const tw = el('div', 'gv-table-wrap');
    const table = el('table', 'gv-table');
    const head = document.createElement('tr');
    for (const tag of s.tags) head.appendChild(el('th', null, tag));
    head.appendChild(el('th', 'dq-num', t('dq.col.count')));
    const thead = document.createElement('thead'); thead.appendChild(head);
    const body = document.createElement('tbody');
    for (const row of s.rows) {
      const tr = document.createElement('tr');
      for (const v of row.values) tr.appendChild(cell(v));
      tr.appendChild(cell(int(row.count), 'dq-num'));
      body.appendChild(tr);
    }
    table.append(thead, body); tw.appendChild(table); wrap.appendChild(tw);
    return wrap;
  }));
}

function renderNotMeasured(r) {
  const ul = $('dqNotMeasured');
  const list = [];
  for (const [k, v] of Object.entries(r.notMeasured || {})) {
    if (!v) continue;
    const li = el('li', `gv-w ${k === 'insideBlocks' ? 'is-ok' : 'is-warn'}`, `${t(`dq.nm.${k}`)}: ${int(v)}`);
    list.push(li);
  }
  if (r.xrefs && r.xrefs.length) list.push(el('li', 'gv-w is-warn', `${t('dq.nm.xrefs')}: ${r.xrefs.join(', ')}`));
  if (!list.length) list.push(el('li', 'gv-w is-ok', t('dq.nm.none')));
  ul.replaceChildren(...list);
}

// ---- units: the line on every file, and the select the units warnings reuse ----
// The unit the engine actually applied, so the line never names one the numbers were not measured in.
const usedUnits = f => f.result.file.used;

function unitsSelect(f) {
  const s = document.createElement('select');
  s.setAttribute('aria-label', t('dq.units.change'));
  const opt = (v, label) => { const o = el('option', null, label); o.value = v; s.appendChild(o); };
  opt('', t(f.result.file.units === 'none' ? 'dq.units.fromSettings' : 'dq.units.fromFile'));
  for (const u of UNITS) opt(u, t(`dq.unit.${u}`));
  s.value = f.override || '';
  s.addEventListener('change', () => {
    f.override = s.value || null;
    ga('dwgq_units_override', { units: s.value || 'file' });
    run(f);
  });
  return s;
}

function renderStatus(f) {
  const box = $('dqStatus');
  box.replaceChildren();
  if (!okResult(f)) return;
  const src = f.result.file.unitsSource;
  box.appendChild(el('span', null, t('dq.units.line', { units: unitName(usedUnits(f)), source: t(`dq.units.src.${src}`) })));
  const lab = el('label', null, t('dq.units.change') + ' ');
  lab.appendChild(unitsSelect(f));
  box.appendChild(lab);
}

const fmtParam = v => (typeof v === 'number' ? fmtNum(v, Number.isInteger(v) ? 0 : 2) : unitName(String(v ?? '')));

function renderWarnings(f) {
  const ul = $('dqWarnings');
  const list = okResult(f) ? f.result.warnings : [];
  ul.replaceChildren(...list.map(w => {
    const params = Object.fromEntries(Object.entries(w.params || {}).map(([k, v]) => [k, fmtParam(v)]));
    const li = el('li', `gv-w ${INFO_WARNINGS.has(w.id) ? 'is-ok' : 'is-warn'}`, t(`dq.warn.${w.id}`, params));
    if (w.id === 'units-assumed' || w.id === 'units-setting') li.appendChild(unitsSelect(f));
    return li;
  }));
}

// ---- selection ----
function renderSelection() {
  const f = activeFile();
  const items = okResult(f) ? f.result.items : [];
  const tot = selectionTotals(items, state.sel);
  const has = state.sel.length > 0;
  $('dqSelHint').hidden = has;
  $('dqSelCount').hidden = !has;
  $('dqSelCount').textContent = t('dq.sel.items', { n: int(tot.items) });
  $('dqSelLayers').hidden = !tot.layers.length;
  $('dqSelLayers').tBodies[0].replaceChildren(...tot.layers.map(l => {
    const tr = document.createElement('tr');
    tr.append(cell(l.name, 'dq-name'), cell(num2(l.len), 'dq-num'), cell(num2(l.area), 'dq-num'), cell(num2(l.hatchArea), 'dq-num'));
    return tr;
  }));
  const sum = tot.layers.reduce((a, l) => ({ len: a.len + l.len, area: a.area + l.area, hatch: a.hatch + l.hatchArea }), { len: 0, area: 0, hatch: 0 });
  const fc = $('dqSelLayers').tFoot.rows[0].cells;
  fc[1].textContent = num2(sum.len); fc[2].textContent = num2(sum.area); fc[3].textContent = num2(sum.hatch);
  for (const i of [1, 2, 3]) fc[i].className = 'dq-num';
  $('dqSelBlocks').hidden = !tot.blocks.length;
  $('dqSelBlocks').tBodies[0].replaceChildren(...tot.blocks.map(b => {
    const tr = document.createElement('tr');
    tr.append(cell(b.name, 'dq-name'), cell(int(b.count), 'dq-num'));
    return tr;
  }));
  $('dqCopy').disabled = !has;
  $('dqSelClear').disabled = !has;
}

function setSelection(indices) {
  state.sel = indices;
  const f = activeFile();
  view.setSelection(indices);
  renderSelection();
  if (f && indices.length && !f.selCounted) { f.selCounted = true; ga('dwgq_selection', { items: indices.length }); }
}

function toggleHighlight(key) {
  const f = activeFile();
  if (!okResult(f)) return;
  state.hl = rowKey(state.hl) === rowKey(key) ? null : key;
  view.setHighlight(state.hl ? rowItems(f.result.items, state.hl) : null);
  markRows();
}

function itemRow(it) { return it.kind === 'insert' ? { block: it.block, layer: it.layer } : { layer: it.layer }; }

function markRows(hoverKey) {
  const hl = rowKey(state.hl), hv = hoverKey || rowKey(state.pickRow);
  for (const tr of document.querySelectorAll('#dqLayers tbody tr, #dqBlocks tbody tr')) {
    tr.classList.toggle('is-hi', !!hl && tr.dataset.key === hl);
    tr.classList.toggle('is-hover', !!hv && tr.dataset.key === hv);
  }
}

// ---- the drawing ----
const view = createView($('dqCanvas'), {
  onHover(i, x, y) {
    const f = activeFile(), tip = $('dqTip');
    if (!okResult(f) || i < 0) { tip.hidden = true; markRows(); return; }
    const it = f.result.items[i];
    const lines = [[t('dq.tip.layer'), it.layer], [t('dq.tip.kind'), t(`dq.kind.${it.kind}`)]];
    if (it.len > 0) lines.push([t('dq.tip.len'), `${num2(it.len)} m`]);
    if (it.area > 0) lines.push([t('dq.tip.area'), `${num2(it.area)} m²`]);
    if (it.block) lines.push([t('dq.tip.block'), it.block]);
    if ((it.copies || 1) > 1) lines.push([t('dq.tip.copies'), int(it.copies)]);
    if (it.bad) lines.push([null, t('dq.tip.bad')]);
    tip.replaceChildren(...lines.map(([k, v]) => {
      const d = el('div');
      if (k != null) d.appendChild(el('b', null, k + ': '));
      d.appendChild(document.createTextNode(v));
      return d;
    }));
    const box = $('dqCanvas').getBoundingClientRect();
    tip.hidden = false;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = x - box.left + 14, top = y - box.top + 14;
    if (left + tw > box.width) left = Math.max(0, x - box.left - tw - 10);
    if (top + th > box.height) top = Math.max(0, y - box.top - th - 10);
    tip.style.left = `${left}px`; tip.style.top = `${top}px`;
    markRows(rowKey(itemRow(it)));
  },
  onPick(i, shift) {
    const f = activeFile();
    if (!okResult(f)) return;
    state.pickRow = i >= 0 ? itemRow(f.result.items[i]) : (shift ? state.pickRow : null);
    setSelection(clickSelection(state.sel, i, shift));
    markRows();
  },
  onBox(x0, y0, x1, y1, mode, shift) {
    const f = activeFile();
    if (!okResult(f)) return;
    setSelection(boxSelection(state.sel, selectBox(view.index, f.result.items, x0, y0, x1, y1, mode), shift));
  },
});

// ---- the panel: one file, or the Summary ----
function render() {
  renderTabs();
  const any = state.files.length > 0;
  $('dqDropHint').hidden = any;
  $('dqPanel').hidden = !any;
  // No export while a file is waiting or re-measuring: the workbook would silently leave it out.
  $('dqXlsx').disabled = !state.files.some(okResult) || state.files.some(f => f.status !== 'done');
  if (!any) { shown = null; view.clear(); return; }
  if (state.active === null) state.active = state.files[0].id;

  const pending = state.files.some(f => f.status !== 'done');
  if (state.active === 'summary') {
    $('dqPanel').classList.add('dq-summary');
    $('dqStatus').replaceChildren(); $('dqWarnings').replaceChildren();
    $('dqError').hidden = true; $('dqWork').hidden = true; $('dqFileOnly').hidden = true;
    $('dqLayers').closest('.dq-tables').hidden = false;
    const s = summary(state.files.filter(f => f.status === 'done'));
    renderTables(s.layers, s.blocks, false, s.partial || pending ? '≥ ' : '');
    $('dqPartial').hidden = !s.partial;
    $('dqPartial').textContent = s.partial ? t('dq.partial', { files: s.missing.join(', ') }) : '';
    shown = null;
    return;
  }

  $('dqPanel').classList.remove('dq-summary');
  const f = activeFile();
  $('dqPartial').hidden = true;
  renderStatus(f);
  renderWarnings(f);
  const failed = f && f.result && f.result.type !== 'result';
  $('dqError').hidden = !failed;
  if (failed) $('dqError').textContent = `${f.name}: ${t(`dq.err.${f.result.reason}`)}`;
  const ok = okResult(f);
  $('dqWork').hidden = !ok;
  $('dqFileOnly').hidden = !ok;
  $('dqLayers').closest('.dq-tables').hidden = !ok;
  if (!ok) { shown = null; return; }
  $('dqFileName').textContent = f.name;
  $('dqSimplified').hidden = !f.result.simplified;
  renderTables(layerRows(f.result), blockRows(f.result), true, '');
  renderSchedules(f.result);
  renderNotMeasured(f.result);
  if (shown !== f.result) {
    shown = f.result;
    view.show(f.result);
    if (state.hl) view.setHighlight(rowItems(f.result.items, state.hl));
    if (state.sel.length) view.setSelection(state.sel);
  }
  renderSelection();
}

// ---- settings ----
function wireSettings() {
  const units = $('dqUnits');
  units.replaceChildren(...['auto', ...UNITS].map(v => { const o = el('option', null, t(`dq.unit.${v}`)); o.value = v; return o; }));
  units.value = state.settings.units;
}
$('dqUnits').addEventListener('change', e => {
  const v = e.target.value;
  if (!['auto', ...UNITS].includes(v)) { e.target.value = state.settings.units; return; }
  state.settings.units = v;
  saveStored(SETTINGS_KEY, state.settings, ['units']);
  // Only files that state no units depend on this setting; a file still waiting or measuring is run again with
  // it (its per-file gen makes the superseded run harmless).
  for (const f of state.files) {
    if (f.override) continue;
    if (f.status !== 'done' || (okResult(f) && f.result.file.unitsSource !== 'file')) run(f);
  }
});

// ---- downloads and the clipboard ----
function save(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('dqXlsx').addEventListener('click', () => {
  if (state.files.some(f => f.status !== 'done')) return;
  const files = state.files.filter(f => f.status === 'done').map(f => ({ name: f.name, result: f.result }));
  if (!files.some(f => f.result.type === 'result')) return;
  save(new Blob([writeXlsx(workbookFor(files, t))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), xlsxName(files));
  ga('dwgq_xlsx_download', { files: files.length });
});
$('dqCopy').addEventListener('click', async () => {
  const f = activeFile();
  if (!okResult(f) || !state.sel.length) return;
  const text = selectionTsv(selectionTotals(f.result.items, state.sel), t, lang() === 'en' ? '.' : ',');
  try { await navigator.clipboard.writeText(text); } catch (e) { return; }
  ga('dwgq_copy', {});
  const b = $('dqCopy');
  b.textContent = t('dq.sel.copied');
  setTimeout(() => { b.textContent = t('dq.sel.copy'); }, 1500);
});
$('dqSelClear').addEventListener('click', () => { state.pickRow = null; setSelection([]); markRows(); });
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (state.sel.length) { state.pickRow = null; setSelection([]); markRows(); }
});

// ---- inputs ----
async function readFiles(fileList) {
  const list = [];
  for (const file of fileList) list.push({ name: file.name, bytes: await file.arrayBuffer() });
  addFiles(list, 'file');
}
$('dqInput').addEventListener('change', async e => { const fl = [...e.target.files]; e.target.value = ''; await readFiles(fl); });
document.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('gv-dragging'); });
document.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('gv-dragging'); });
document.addEventListener('drop', async e => {
  e.preventDefault(); document.body.classList.remove('gv-dragging');
  const fl = [...(e.dataTransfer && e.dataTransfer.files || [])].filter(f => /\.(dxf|dwg)$/i.test(f.name));
  if (fl.length) await readFiles(fl);
});
$('dqExample').addEventListener('click', async () => {
  try {
    const r = await fetch(new URL(`./examples/${EXAMPLE}`, import.meta.url));
    if (!r.ok) throw new Error(String(r.status));
    addFiles([{ name: EXAMPLE, bytes: await r.arrayBuffer() }], 'example');
  } catch (e) { showBanner({ key: 'dq.example.failed' }); }
});
$('dqClear').addEventListener('click', () => {
  state.files = []; state.active = null; state.sel = []; state.hl = null; state.pickRow = null;
  render();
});
$('dqFit').addEventListener('click', () => view.fit());
$('dqZoomIn').addEventListener('click', () => view.zoomBy(1.25));
$('dqZoomOut').addEventListener('click', () => view.zoomBy(1 / 1.25));

// ---- CTAs and survey ----
$('dqCta').addEventListener('click', () => ga('dwgq_cta_click', { where: 'page' }));
$('dqCtaGroups').addEventListener('click', () => ga('dwgq_cta_click', { where: 'selection' }));
if (lsGet(SURVEY_KEY)) $('dqSurvey').hidden = true;
$('dqSurvey').addEventListener('click', e => {
  const b = e.target.closest('[data-answer]');
  if (!b) return;
  ga('dwgq_survey', { answer: b.dataset.answer });
  lsSet(SURVEY_KEY, b.dataset.answer);
  $('dqSurvey').querySelectorAll('[data-answer]').forEach(x => { x.disabled = true; });
  $('dqThanks').hidden = false;
});

// A language change re-renders everything built here (the drawing keeps its view).
document.addEventListener('gv:lang', () => {
  if (state.banner) showBanner(state.banner);
  wireSettings();
  render();
});

wireSettings();
render();
