// Steel take-off: the page controller (spec §6, §7, §8). NC1 files (several, a folder or a .zip) are parsed here, on
// the page; one IFC goes to the web-ifc worker through the shared bridge, which answers its rows and then, in a second
// pass, their geometry check. The quote (groups, totals, bath marks, costs) is recomputed from the rows and the
// settings on every change. three.js and the 3D view load on the first piece shown.
import { t, ga, fmtNum, localeOf } from '../gcode/shell/i18n.js';
import { lsGet, lsSet } from '../gcode/shell/settings-store.js';
import { renderBanner } from '../gcode/shell/banner.js';
import { createEngine } from '../laser/bridge.js?v=20261001';
import { writeXlsx } from '../dwg/xlsx.js?v=20260930';
import { parseNc1 } from './nc1.js?v=20261005';
import { nc1Piece } from './piece.js?v=20261005';
import { takeoff, costs, sortTakeoff, kg1, m2 } from './quote.js?v=20261005';
import { readZip } from './unzip.js?v=20261005';
import { workbook, xlsxName, rowNotes } from './book.js?v=20261005';
import { pieceSlabs } from './shape3d.js?v=20261005';
import { cleanSettings, sortSet, kindOf, isMacClutter, skippedView, piecesBucket, parsePositive, parseRateInput, SETTINGS_KEY, NC1_MAX, IFC_MAX_BYTES, RATE_KEYS } from './state.js?v=20261005';

const $ = id => document.getElementById(id);
const SURVEY_KEY = 'aidedcam-steel-survey';
const TIMEOUT_MS = 120000;                                     // spec §7
const MAX_TRIANGLES = 3000000;                                 // the whole-model view's cap

const state = {
  set: null,            // { kind: 'nc1' | 'ifc', source, rows, skipped, read, capped, ifc, gen }
  error: null,          // { name, reason, detail }
  settings: cleanSettings(safeJson(lsGet(SETTINGS_KEY))),
  open: new Set(),      // the expanded groups' keys
  selected: null,       // the row shown in 3D
  whole: false,         // an IFC's whole model in 3D
  banner: null,
  busy: null,
};
let latest = 0;          // the newest set; a slower, earlier read must not replace it
let view3d = null, view3dModule = null, view3dTries = 0;
// Read by the browser check: the times (ms) of the example, a file set, the IFC check and the 3D view; the view.
window.__steel = { timings: {}, view3d: null };
const mark = (name, t0) => { window.__steel.timings[name] = Math.round(performance.now() - t0); };

function safeJson(s) { try { return JSON.parse(s || '{}'); } catch (e) { return {}; } }
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const saveSettings = () => lsSet(SETTINGS_KEY, JSON.stringify(state.settings));
function showBanner(b) { state.banner = b; renderBanner($('stBanner'), b, t); }
function busy(b) { state.busy = b; $('stBusy').hidden = !b; $('stBusy').textContent = b ? t(b.key, b.params) : ''; }
const kgText = v => `${fmtNum(kg1(v), 1)} kg`;
const m2Text = v => `${fmtNum(m2(v), 2)} m²`;
const mmText = v => `${fmtNum(Math.round(v), 0)} mm`;
const eur = v => `${fmtNum(v, 2)} €`;

// ---- the engine: web-ifc in its worker, loaded with the first IFC ----
const supported = typeof WebAssembly === 'object' && typeof Worker === 'function';
const engine = supported ? createEngine({
  makeWorker: () => new Worker(new URL('./worker.js?v=20261005', import.meta.url), { type: 'module' }),
  timeoutMs: TIMEOUT_MS,
}) : null;

// ---- reading a set ----
function decode(bytes) {
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  return utf8.includes('�') ? new TextDecoder('windows-1253').decode(bytes) : utf8;   // Greek marks saved as Windows-1253
}
const baseName = n => String(n).replace(/^.*[\\/]/, '');

function newSet(set) {
  state.set = set; state.error = null; state.open = new Set(); state.selected = null; state.whole = false;
  if (view3d) view3d.clear();
  $('stView').hidden = true;
}

// files: File objects, or { name, data } held in memory (the example, a ZIP's entries): never read a File's .bytes,
// which Chrome 154 defines as a method (Blob.prototype.bytes). source: 'file' | 'example'. folder: the chosen folder.
async function loadSet(files, source, { t0 = performance.now(), folder = '' } = {}) {
  const my = ++latest;
  if (!files.length) return;
  newSet(null);
  const s = sortSet(files);
  if (s.ifc) { await loadIfc(s.ifc, source, s.skipped, my, t0); return; }
  busy({ key: 'st.reading' });
  render();
  const skipped = [...s.skipped], items = [];
  for (const z of s.zips) {
    let r;
    try { r = await readZip(new Uint8Array(await z.arrayBuffer())); } catch (e) { r = { ok: false, reason: 'notzip' }; }
    if (my !== latest) return;
    if (!r.ok) { skipped.push({ name: z.name, reason: `zip.${r.reason}` }); continue; }
    for (const e of r.files) {
      if (isMacClutter(e.name)) continue;
      if (kindOf(e.name) === 'nc1') items.push({ name: baseName(e.name), data: e.bytes });
      else skipped.push({ name: baseName(e.name), reason: 'notnc1' });
    }
  }
  items.push(...s.nc1);
  const capped = items.length > NC1_MAX;
  const take = items.slice(0, NC1_MAX);
  const texts = await Promise.all(take.map(async f => {
    try { return decode(f.data || new Uint8Array(await f.arrayBuffer())); } catch (e) { return null; }
  }));
  if (my !== latest) return;
  const rows = [];
  take.forEach((f, i) => {
    if (texts[i] === null) { skipped.push({ name: f.name, reason: 'read' }); return; }
    const r = parseNc1(texts[i]);
    if (!r.ok) skipped.push({ name: f.name, reason: r.reason, line: r.line });
    else rows.push(nc1Piece(r.piece, f.name));
  });
  busy(null);
  const sourceName = folder || (s.zips.length === 1 && !s.nc1.length ? s.zips[0].name : s.nc1.length === 1 && !s.zips.length ? s.nc1[0].name : '');
  if (!rows.length) {
    state.error = { name: sourceName || (files.length === 1 ? files[0].name : ''), reason: 'nonc1' };
    state.set = { kind: 'nc1', source: sourceName, rows: [], skipped, read: 0, capped };
    ga('steel_error', { reason: 'nonc1' });
    render();
    return;
  }
  newSet({ kind: 'nc1', source: sourceName, rows, skipped, read: rows.length, capped, count: take.length });
  render();
  mark(source === 'example' ? 'example' : 'file', t0);
  const pieces = rows.reduce((a, r) => a + (r.qty > 0 ? r.qty : 0), 0);
  if (source === 'example') ga('steel_example', {});
  else ga('steel_loaded', { kind: s.zips.length ? 'zip' : 'nc1', pieces: piecesBucket(pieces) });
}

async function loadIfc(file, source, skipped, my, t0) {
  const fail = reason => { busy(null); state.error = { name: file.name, reason }; ga('steel_error', { reason }); render(); };
  if (file.size > IFC_MAX_BYTES) { fail('limit'); return; }       // refused before reading
  if (!engine) { fail('nowasm'); return; }
  busy({ key: 'st.ifc.reading' });
  render();
  let bytes;
  try { bytes = file.data ? file.data.buffer.slice(0) : await file.arrayBuffer(); } catch (e) { if (my === latest) fail('read'); return; }
  if (my !== latest) return;
  const m = await engine.process(file.name, bytes, {});
  if (my !== latest) return;
  if (m.type !== 'result') { fail(m.reason === 'read' && m.detail ? `read.${m.detail}` : m.reason || 'engine'); return; }
  busy(null);
  const set = { kind: 'ifc', source: file.name, rows: m.rows, skipped, read: 1, capped: false, ifc: { name: file.name, file: m.file, checking: true, mesh: null } };
  newSet(set);
  render();
  mark(source === 'example' ? 'example' : 'file', t0);
  if (source === 'example') ga('steel_example', {});
  else ga('steel_loaded', { kind: 'ifc', pieces: piecesBucket(m.rows.reduce((a, r) => a + r.qty, 0)) });
  // The second pass: the members priced from their profiles get their geometry check.
  const t1 = performance.now();
  const c = await engine.process('check', new ArrayBuffer(0), { check: true });
  if (state.set !== set) return;
  set.ifc.checking = false;
  if (c.type === 'result') {
    for (const x of c.checks) {
      const r = set.rows[x.row];
      if (!r) continue;
      r.checking = false; r.checkKg = x.checkKg; r.checkM2 = x.checkM2;
      if (x.check && !r.warn.includes('check')) r.warn.push('check');
    }
  } else set.ifc.checkFailed = true;
  for (const r of set.rows) r.checking = false;
  mark('check', t1);
  render();
}

// ---- rendering ----
let model = null;        // the last quote: { take, cost }

function render() {
  const s = state.set;
  $('stDropHint').hidden = !!s || !!state.error;
  $('stClear').hidden = !s && !state.error;
  $('stError').hidden = !state.error;
  if (state.error) $('stError').textContent = (state.error.name ? `${state.error.name}: ` : '') + errorText(state.error);
  const ok = s && s.rows.length > 0;
  $('stPanel').hidden = !ok;
  renderSkipped(s);
  if (!ok) { model = null; return; }
  const take = takeoff(s.rows, state.settings.bath, state.settings.sort);
  const cost = costs(take, state.settings.rates);
  model = { take, cost };
  renderSummary(s, take);
  renderTable(take);
  renderCosts(cost);
}

function errorText(e) {
  if (e.reason === 'read.ifczip' || e.reason === 'read.ifcxml') return t(`st.err.${e.reason}`);
  return t(`st.err.${['read', 'limit', 'timeout', 'engine', 'nosteel', 'schema', 'nonc1', 'nowasm'].includes(e.reason) ? e.reason : 'engine'}`);
}

function renderSummary(s, take) {
  const T = take.totals, items = [];
  const add = (key, value, cls) => items.push([t(key), value, cls]);
  if (s.kind === 'ifc') {
    add('st.sum.ifc', `${s.ifc.name} · ${s.ifc.file.schema}`);
    add('st.sum.members', t('st.sum.members.v', { n: s.ifc.file.members, a: s.ifc.file.assemblies }));
  } else {
    add('st.sum.files', t('st.sum.files.v', { read: s.read, skipped: s.skipped.length }));
  }
  add('st.sum.pieces', t('st.sum.pieces.v', { n: T.pieces, marks: T.marks }));
  add('st.sum.kg', kgText(T.kg), 'st-big');
  add('st.sum.m2', m2Text(T.m2), 'st-big');
  if (take.longest) add('st.sum.longest', `${take.longest.mark || '–'} · ${mmText(take.longest.lengthMm)}`);
  if (take.heaviest) add('st.sum.heaviest', `${take.heaviest.mark || '–'} · ${kgText(take.heaviest.unitKg)}`);
  const b = state.settings.bath;
  add('st.sum.bath', t('st.sum.bath.v', { l: fmtNum(b.length, 1), w: fmtNum(b.width, 1), d: fmtNum(b.depth, 1), double: T.double, no: T.no }), T.no ? 'st-bad' : T.double ? 'st-warn' : '');
  add('st.sum.checks', s.ifc && s.ifc.checking ? t('st.sum.checking') : s.ifc && s.ifc.checkFailed ? t('st.sum.checkfailed') : t('st.sum.marks.v', { n: T.checks }), T.checks ? 'st-warn' : '');
  if (T.excluded) add('st.sum.excluded', t('st.sum.marks.v', { n: T.excluded }), 'st-warn');
  if (T.noArea) add('st.sum.noarea', t('st.sum.marks.v', { n: T.noArea }), 'st-warn');
  if (s.ifc && s.ifc.file.fromGeometry) add('st.sum.geometry', String(s.ifc.file.fromGeometry));
  const dl = $('stSummary');
  dl.replaceChildren(...items.map(([k, v, cls]) => { const d = el('div', cls ? `st-fig ${cls}` : 'st-fig'); d.append(el('dt', null, k), el('dd', null, v)); return d; }));
  $('stCapped').hidden = !s.capped;
  $('stCapped').textContent = s.capped ? t('st.capped', { n: fmtNum(NC1_MAX, 0) }) : '';
}

function renderSkipped(s) {
  const box = $('stSkipped');
  const view = skippedView(s);
  box.hidden = view.hidden;
  if (view.hidden) return;
  $('stSkippedHead').textContent = t('st.skipped', { n: view.items.length });
  $('stSkippedList').replaceChildren(...view.items.map(x => el('li', null, `${x.name}: ${t(x.reasonKey, { line: x.line })}`)));
}

const BATH_MARK = { fits: '✓', double: '⚠', no: '✗' };
function renderTable(take) {
  const body = $('stTable').tBodies[0];
  const rows = [];
  for (const g of take.groups) {
    const open = state.open.has(g.key);
    const tr = el('tr', 'st-group');
    tr.dataset.group = g.key;
    const th = el('th');
    th.scope = 'row';
    const btn = el('button', 'st-expand', `${open ? '▾' : '▸'} ${g.profile}`);
    btn.type = 'button';
    btn.setAttribute('aria-expanded', String(open));
    btn.dataset.toggle = g.key;
    th.appendChild(btn);
    const warnRows = g.rows.filter(r => r.warn.includes('check')).length;
    const count = mark => g.rows.reduce((a, r) => a + (!r.excluded && r.bath === mark && r.qty > 0 ? r.qty : 0), 0);
    const dbl = count('double'), no = count('no');
    tr.append(th, el('td', null, g.grade), el('td', 'dq-num', `${fmtNum(m2(g.lengthM), 2)} m`), el('td', 'dq-num', String(g.count)),
      el('td', 'dq-num', fmtNum(kg1(g.kg), 1)), el('td', 'dq-num', fmtNum(m2(g.m2), 2)),
      el('td', warnRows ? 'st-mark st-warn' : 'st-mark', warnRows ? `⚠ ${warnRows}` : ''),
      el('td', no ? 'st-mark st-bad' : dbl ? 'st-mark st-warn' : 'st-mark', no ? `✗ ${no}` : dbl ? `⚠ ${dbl}` : '✓'));
    rows.push(tr);
    if (!open) continue;
    for (const r of g.rows) rows.push(pieceRow(r));
  }
  body.replaceChildren(...rows);
}

function pieceRow(r) {
  const tr = el('tr', 'st-piece');
  tr.tabIndex = 0;
  tr.classList.toggle('is-sel', r === state.selected);
  tr.classList.toggle('is-out', !!r.excluded);
  tr._row = r;
  const n = r.qty > 0 ? r.qty : 0;
  const check = r.checking ? '…' : r.warn.includes('check') ? '⚠' : r.checkKg !== null && r.checkKg !== undefined ? '✓' : '–';
  const cc = el('td', r.warn.includes('check') ? 'st-mark st-warn' : 'st-mark', check);
  if (r.checkKg !== null && r.checkKg !== undefined) cc.title = t('st.check.tip', { nominal: kgText(r.unitKg), check: kgText(r.checkKg) });
  const notes = rowNotes(r, t, fmtNum);
  const mk = el('td', 'st-markcell', r.mark || '–');
  if (notes) { mk.title = notes; mk.append(el('span', 'st-note', ` ${r.warn.filter(w => w !== 'check').map(() => '⚠').join('')}`)); }
  const bath = el('td', r.bath === 'no' ? 'st-mark st-bad' : r.bath === 'double' ? 'st-mark st-warn' : 'st-mark', r.excluded ? '' : BATH_MARK[r.bath]);
  if (!r.excluded) bath.title = t(`st.bath.${r.bath}`);
  tr.append(mk, el('td', 'st-sub', r.drawing || ''), el('td', 'dq-num', mmText(r.lengthMm)), el('td', 'dq-num', String(r.qty)),
    el('td', 'dq-num', r.excluded ? '–' : fmtNum(kg1(r.unitKg * n), 1)), el('td', 'dq-num', r.excluded || r.unitM2 === null ? '–' : fmtNum(m2(r.unitM2 * n), 2)), cc, bath);
  return tr;
}

$('stTable').addEventListener('click', e => {
  const b = e.target.closest('[data-toggle]');
  if (b) {
    const k = b.dataset.toggle;
    if (state.open.has(k)) state.open.delete(k); else state.open.add(k);
    if (model) renderTable(model.take);
    const again = $('stTable').querySelector(`[data-toggle="${CSS.escape(k)}"]`);
    if (again) again.focus();
    return;
  }
  const tr = e.target.closest('tr.st-piece');
  if (tr && tr._row) select(tr._row);
});
$('stTable').addEventListener('keydown', e => {
  const tr = e.target.closest && e.target.closest('tr.st-piece');
  if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(tr._row); }
});
$('stSort').addEventListener('change', e => {
  state.settings.sort = e.target.value;
  saveSettings();
  if (model) { sortTakeoff(model.take.groups, state.settings.sort); renderTable(model.take); }
});

function renderCosts(cost) {
  const body = $('stCosts').tBodies[0];
  const rows = [];
  const line = (label, qty, rate, amount, cls) => {
    const tr = el('tr', cls);
    tr.append(el('th', null, label), el('td', 'dq-num', qty), el('td', 'dq-num', rate), el('td', 'dq-num', amount));
    rows.push(tr);
  };
  if (!cost.lines.length) {
    const tr = el('tr', 'st-cost-none');
    const td = el('td', null, t('st.cost.none'));
    td.colSpan = 4;
    tr.append(td);
    rows.push(tr);
  }
  for (const l of cost.lines) {
    if (l.unpriced) line(t(`st.cost.${l.id}`), kgText(l.qty), '–', '–', 'st-unpriced');
    else line(t(`st.cost.${l.id}`), l.unit === 'm2' ? m2Text(l.qty) : kgText(l.qty), `${fmtNum(l.rate, 3)} €/${l.unit === 'm2' ? 'm²' : 'kg'}`, eur(l.amount));
  }
  line(t('st.cost.subtotal'), '', '', eur(cost.subtotal), 'st-sum');
  if (cost.minApplies) line(t('st.cost.minimum', { min: fmtNum(cost.minimum, 2) }), '', '', eur(cost.net), 'st-min');
  line(t(cost.vatOn ? 'st.cost.vat' : 'st.cost.novat'), '', '', eur(cost.vat));
  line(t('st.cost.total'), '', '', eur(cost.total), 'st-total');
  body.replaceChildren(...rows);
  const un = $('stUnpriced');
  un.hidden = !(cost.unpricedKg > 0);
  un.textContent = cost.unpricedKg > 0 ? t('st.cost.unpriced', { kg: fmtNum(cost.unpricedKg, 1) }) : '';
}

// ---- the 3D view ----
async function select(row) {
  state.selected = row;
  if (model) renderTable(model.take);
  await open3d(row);
}

async function open3d(row) {
  const s = state.set;
  const t0 = performance.now();
  $('stView').hidden = false;
  $('st3dModel').hidden = s.kind !== 'ifc';
  $('st3dModel').setAttribute('aria-pressed', String(state.whole));
  $('st3dHead').textContent = `${row.mark || '–'} · ${row.profile}`;
  note3d('st.3d.loading');
  let mod;
  try { mod = await (view3dModule || (view3dModule = import(`./view3d.js?v=20261005${view3dTries ? `#retry${view3dTries}` : ''}`))); }
  catch (e) { view3dModule = null; view3dTries++; if (state.selected === row) note3d('st.3d.failed'); return; }
  if (state.selected !== row || state.set !== s) return;
  if (!view3d) {
    if (!mod.hasWebGL2()) { note3d('st.3d.nogl'); view3dGa(s, 'nogl'); return; }
    try { view3d = mod.createView3d($('st3dBox'), { onLost: lost3d }); renderView3dLabel(); window.__steel.view3d = view3d; }
    catch (e) { if (view3d) view3d.dispose(); view3d = null; note3d('st.3d.nogl'); view3dGa(s, 'nogl'); return; }
  }
  if (s.kind === 'nc1') {
    const slabs = pieceSlabs(row.nc);
    if (!slabs.length) { view3d.clear(); note3d('st.3d.noshape'); return; }
    view3d.showPiece(slabs);
  } else {
    if (!s.ifc.mesh) {
      const m = await engine.process('mesh', new ArrayBuffer(0), { mesh: true, maxTriangles: MAX_TRIANGLES });
      if (state.set !== s) return;
      if (m.type !== 'result') { note3d(m.reason === 'stale' ? 'st.3d.stale' : 'st.3d.failed'); return; }
      if (!m.mesh) { note3d('st.3d.large'); return; }
      s.ifc.mesh = m.mesh;
      const grades = new Map();
      for (const r of s.rows) for (const e of r.eids) grades.set(e, r.grade);
      s.ifc.gradeOf = e => grades.get(e);
    }
    if (state.selected !== row) return;
    view3d.showModel(s.ifc.mesh, s.ifc.gradeOf, new Set(row.eids), { only: !state.whole, focus: true });
  }
  note3d(null);
  view3dGa(s, 'shown');
  requestAnimationFrame(() => mark('view3d', t0));
}
function view3dGa(s, result) { if (!s.ga3d) { s.ga3d = true; ga('steel_view3d', { result }); } }
function note3d(key) { const n = $('st3dNote'); n.hidden = !key; n.dataset.key = key || ''; n.textContent = key ? t(key) : ''; }
function lost3d() {
  if (view3d) { view3d.dispose(); view3d = null; window.__steel.view3d = null; }
  note3d('st.3d.failed');
}
function renderView3dLabel() { if (view3d) view3d.canvas.setAttribute('aria-label', t('st.aria.3d')); }
$('stView').addEventListener('click', e => {
  const b = e.target.closest('[data-preset]');
  if (b && view3d) view3d.preset(b.dataset.preset);
});
$('st3dFit').addEventListener('click', () => { if (view3d) view3d.fit(); });
$('st3dModel').addEventListener('click', () => {
  state.whole = !state.whole;
  if (state.selected) open3d(state.selected);
});

// ---- settings: remembered in this browser ----
function renderSettings() {
  const s = state.settings, r = s.rates;
  const show = v => (v === null || v === undefined ? '' : new Intl.NumberFormat(localeOf(), { maximumFractionDigits: 4, useGrouping: false }).format(v));
  for (const k of ['length', 'width', 'depth']) if (document.activeElement !== $(`stBath_${k}`)) $(`stBath_${k}`).value = show(s.bath[k]);
  for (const k of RATE_KEYS) if (document.activeElement !== $(`stRate_${k}`)) $(`stRate_${k}`).value = show(r[k]);
  for (const g of ['S235', 'S275', 'S355', 'other']) if (document.activeElement !== $(`stGrade_${g}`)) $(`stGrade_${g}`).value = show(r.steelGrade[g]);
  $('stPerGrade').checked = r.perGrade;
  $('stGrades').hidden = !r.perGrade;
  $('stRate_steel').closest('label').hidden = r.perGrade;
  $('stVat').checked = r.vat;
  $('stSort').value = s.sort;
}
function onSetting(input, apply) {
  input.addEventListener('change', () => {
    const ok = apply(input.value);
    if (ok === false) { input.setAttribute('aria-invalid', 'true'); return; }
    input.removeAttribute('aria-invalid');
    saveSettings();
    renderSettings();
    render();
  });
}
for (const k of ['length', 'width', 'depth']) onSetting($(`stBath_${k}`), v => { const x = parsePositive(v); if (x === undefined || x >= 100) return false; state.settings.bath[k] = x; return true; });
for (const k of RATE_KEYS) onSetting($(`stRate_${k}`), v => { const x = parseRateInput(v); if (x === undefined) return false; state.settings.rates[k] = x; return true; });
for (const g of ['S235', 'S275', 'S355', 'other']) onSetting($(`stGrade_${g}`), v => { const x = parseRateInput(v); if (x === undefined) return false; state.settings.rates.steelGrade[g] = x; return true; });
$('stPerGrade').addEventListener('change', e => { state.settings.rates.perGrade = e.target.checked; saveSettings(); renderSettings(); render(); });
$('stVat').addEventListener('change', e => { state.settings.rates.vat = e.target.checked; saveSettings(); render(); });

// ---- outputs ----
function save(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('stXlsx').addEventListener('click', () => {
  const s = state.set;
  if (!model || !s) return;
  const sheets = workbook({ take: model.take, cost: model.cost, settings: state.settings, source: s.source || t('st.xlsx.nfiles', { n: s.read }) }, t, fmtNum);
  save(new Blob([writeXlsx(sheets)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), xlsxName(s.source, s.read));
  ga('steel_xlsx', {});
});
$('stPrint').addEventListener('click', () => { ga('steel_print', {}); window.print(); });

// ---- inputs ----
// A drop: the files, and the files inside dropped folders (walked through the entries API).
async function dropped(dt) {
  const entries = [...(dt.items || [])].map(i => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null)).filter(Boolean);
  if (!entries.length) return { files: [...(dt.files || [])], folder: '' };
  const files = [];
  const walk = async entry => {
    if (entry.isFile) {
      if (!isMacClutter(entry.fullPath)) files.push(await new Promise((res, rej) => entry.file(res, rej)));
      return;
    }
    const reader = entry.createReader();
    for (;;) {
      const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
      if (!batch.length) break;
      for (const e of batch) await walk(e);
    }
  };
  for (const e of entries) { try { await walk(e); } catch (err) { /* an unreadable entry is left out */ } }
  return { files, folder: entries.length === 1 && entries[0].isDirectory ? entries[0].name : '' };
}
// The input is cleared only once its files are read (clearing it first empties them in Chrome).
$('stFiles').addEventListener('change', async e => { const f = [...(e.target.files || [])]; if (f.length) await loadSet(f, 'file'); e.target.value = ''; });
$('stFolder').addEventListener('change', async e => {
  const allFiles = [...(e.target.files || [])];
  const f = allFiles.filter(file => !isMacClutter(file.webkitRelativePath || file.name));
  const folder = f.length && f[0].webkitRelativePath ? f[0].webkitRelativePath.split('/')[0] : '';
  if (f.length) await loadSet(f, 'file', { folder });
  e.target.value = '';
});
document.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('gv-dragging'); });
document.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('gv-dragging'); });
document.addEventListener('drop', async e => {
  e.preventDefault(); document.body.classList.remove('gv-dragging');
  if (!e.dataTransfer) return;
  const { files, folder } = await dropped(e.dataTransfer);
  if (files.length) await loadSet(files, 'file', { folder });
});
async function example(kind) {
  const t0 = performance.now();
  const my = ++latest;
  const get = async path => {
    const r = await fetch(new URL(`./examples/${path}?v=20261005`, import.meta.url));
    if (!r.ok) throw new Error(String(r.status));
    return new Uint8Array(await r.arrayBuffer());
  };
  let files;
  try {
    if (kind === 'ifc') files = [{ name: 'portal.ifc', data: await get('portal.ifc'), size: 0 }];
    else {
      const index = JSON.parse(new TextDecoder().decode(await get('portal/index.json')));
      files = await Promise.all(index.files.map(async n => ({ name: n, data: await get(`portal/${n}`), size: 0 })));
    }
  } catch (e) { if (my === latest) showBanner({ key: 'st.example.failed' }); return; }
  if (my !== latest) return;
  if (state.banner && state.banner.key === 'st.example.failed') showBanner(null);
  await loadSet(files, 'example', { t0, folder: kind === 'ifc' ? '' : 'portal' });
}
$('stExample').addEventListener('click', () => example('nc1'));
$('stExampleIfc').addEventListener('click', () => example('ifc'));
$('stClear').addEventListener('click', () => { latest++; newSet(null); busy(null); render(); });

// ---- CTA and survey ----
$('stCta').addEventListener('click', () => ga('steel_cta_click', { where: 'page' }));
if (lsGet(SURVEY_KEY)) $('stSurvey').hidden = true;
$('stSurvey').addEventListener('click', e => {
  const b = e.target.closest('[data-answer]');
  if (!b) return;
  ga('steel_survey', { answer: b.dataset.answer });
  lsSet(SURVEY_KEY, b.dataset.answer);
  $('stSurvey').querySelectorAll('[data-answer]').forEach(x => { x.disabled = true; });
  $('stThanks').hidden = false;
});

// A language change re-renders everything built here.
document.addEventListener('gv:lang', () => {
  if (state.banner) showBanner(state.banner);
  busy(state.busy);
  renderSettings();
  renderView3dLabel();
  render();
  if (state.selected) $('st3dHead').textContent = `${state.selected.mark || '–'} · ${state.selected.profile}`;
  if ($('st3dNote').dataset.key) note3d($('st3dNote').dataset.key);
});

if (!supported) showBanner({ key: 'st.engine.nowasm' });
renderSettings();
render();
