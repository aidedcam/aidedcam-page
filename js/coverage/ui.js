// Coverage pre-check: the page controller (spec §6). One file at a time goes to the DWG quantities engine
// worker; the page keeps its result, maps its layers to roles, and computes every figure in JavaScript. Only a
// changed coverage mapping asks the engine again (for the union of the coverage outlines).
import { t, ga, fmtNum, lang, localeOf } from '../gcode/shell/i18n.js';
import { lsGet, lsSet } from '../gcode/shell/settings-store.js';
import { renderBanner } from '../gcode/shell/banner.js';
import { createEngine } from '../laser/bridge.js?v=20260930';
import { writeXlsx } from '../dwg/xlsx.js?v=20260930';
import { UNITS, MAX_BYTES } from '../dwg/state.js?v=20260930';
import { ROLES, LEVELS, TEMPLATE, isBasement, layerList, autoMap, remember, cleanRemembered, rolesUsed, isClosed } from './mapping.js?v=20260930';
import { buildModel, evaluate, coverIds, defaultHmax, EXAMPLE_TERMS, DEFAULT_STOREY } from './rules.js?v=20260930';
import { summaryRows, scheduleRows, coordTables, summaryTsv, scheduleTsv, coordsTsv, workbookFor, xlsxName, markText, articleText, plain, formatParams, levelName } from './tables.js?v=20260930';
import { createDrawing, ROLE_COLORS } from './drawing.js?v=20260930';
import { parseTerm, termsFromStorage, sizeBucket, formatOf, unionKey } from './state.js?v=20260930';

const $ = id => document.getElementById(id);
const TERMS_KEY = 'aidedcam-covp-terms';
const MAPPING_KEY = 'aidedcam-covp-mapping';
const SURVEY_KEY = 'aidedcam-covp-survey';
const EXAMPLE = 'example-permit.dxf';
const TIMEOUT_MS = 60000;                  // the engine's timeout for building drawings (DWG quantities)

const state = {
  file: null,                // { name, bytes, source, result, override, gen }
  map: {},                   // layer → { role, level? }
  layers: { used: [], other: [] },
  terms: termsFromStorage(lsGet(TERMS_KEY)),
  saveTerms: true,           // false while the example's own terms are shown untouched
  union: { key: null, answer: null, pending: false },
  model: null, ev: null,
  hl: null,                  // ids highlighted from a row, a warning or a click
  banner: null,
  engineReady: false,
  gaMapped: false, gaTerms: false,
};
window.__covp = { timings: {} };           // read by the browser check: boot, file, union and remap times (ms)
const mark = (name, t0) => { window.__covp.timings[name] = Math.round(performance.now() - t0); };

const n2 = v => fmtNum(v, 2);
// Coordinates without thousands grouping, in the page's decimal separator.
const fmtCoord = (v, d) => new Intl.NumberFormat(localeOf(), { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: false }).format(v);
const unitName = u => (u === 'inch' ? 'in' : u);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function showBanner(b) { state.banner = b; renderBanner($('cpBanner'), b, t); }
const okResult = f => f && f.result && f.result.type === 'result';

// ---- the engine: the DWG quantities worker, shared download ----
const supported = typeof WebAssembly === 'object' && typeof Worker === 'function' && typeof DecompressionStream === 'function';
const bootT0 = performance.now();
const engine = supported ? createEngine({
  makeWorker: () => new Worker(new URL('../dwg/worker.js?v=20260930', import.meta.url), { type: 'module' }),
  onBootProgress: pct => showBanner({ key: 'cp.engine.loading', params: { pct } }),
  onReady: () => { state.engineReady = true; mark('boot', bootT0); if (state.banner && state.banner.key === 'cp.engine.loading') showBanner(null); },
  timeoutMs: TIMEOUT_MS,
}) : null;
if (!supported) showBanner({ key: 'cp.engine.nowasm' });

function busy(key) { $('cpBusy').hidden = !key; $('cpBusy').textContent = key ? t(key) : ''; }

async function measure(f) {
  const gen = f.gen = (f.gen || 0) + 1;
  busy('cp.processing');
  const t0 = performance.now();
  const settings = { units: 'auto' };
  if (f.override && UNITS.includes(f.override)) settings.override = f.override;
  const m = engine ? await engine.process(f.name, f.bytes.slice(0), settings) : { type: 'error', reason: 'engine' };
  if (state.file !== f || f.gen !== gen) return false;               // replaced meanwhile
  mark('file', t0);
  busy(null);
  f.result = m;
  if (m.type === 'error' && m.reason === 'engine' && !state.engineReady) showBanner({ key: 'cp.engine.failed', action: { key: 'cp.engine.retry', run: () => location.reload() } });
  return true;
}

async function loadFile(name, bytes, source) {
  if (bytes.byteLength > MAX_BYTES) {
    state.file = { name, bytes, source, result: { type: 'error', reason: 'limit' } };
    state.union = { key: null, answer: null, pending: false }; state.model = state.ev = null; state.hl = null;
    busy(null); render(); return;
  }
  const f = { name, bytes, source, result: null, override: null };
  state.file = f; state.union = { key: null, answer: null, pending: false }; state.hl = null; state.gaMapped = false;
  if (source === 'example') { state.terms = JSON.parse(JSON.stringify(EXAMPLE_TERMS)); state.saveTerms = false; }
  else if (!state.saveTerms) { state.terms = termsFromStorage(lsGet(TERMS_KEY)); state.saveTerms = true; }
  render();
  if (!(await measure(f))) return;
  ga(source === 'example' ? 'covp_example_loaded' : 'covp_file_loaded', { format: formatOf(f), size: sizeBucket(bytes.byteLength) });
  startMapping(f);
}

function startMapping(f) {
  if (okResult(f)) {
    state.layers = layerList(f.result);
    const auto = autoMap(state.layers.used.map(l => l.name), cleanRemembered(safeJson(lsGet(MAPPING_KEY))));
    state.map = auto.map;
    state.auto = auto;
  }
  recompute();
}

const safeJson = s => { try { return JSON.parse(s || '{}'); } catch (e) { return {}; } };

// ---- the figures: instant, except the union after a changed coverage mapping ----
function recompute() {
  const f = state.file;
  if (!okResult(f) || !state.layers.used.length) { state.model = state.ev = null; render(); return; }
  const t0 = performance.now();
  state.model = buildModel(f.result, state.map);
  const ids = coverIds(state.model);
  const key = unionKey(f.result.id, ids);
  if (key !== state.union.key) {
    state.union = { key, answer: ids.length ? null : { type: 'union', area: 0, paths: [], verts: [], bad: [], error: null }, pending: ids.length > 0 };
    if (ids.length) requestUnion(f, ids, key, false);
  }
  state.ev = evaluate(state.model, state.terms, state.union.answer);
  mark('evaluate', t0);
  render();
  if (!state.gaMapped && !state.union.pending) {
    state.gaMapped = true;
    ga('covp_mapping_done', { roles: rolesUsed(state.map), template: state.auto && state.auto.fromTemplate > 0 ? 'yes' : 'no' });
  }
}

async function requestUnion(f, ids, key, retried) {
  const t0 = performance.now();
  busy('cp.union.pending');
  const m = await engine.process('union', new ArrayBuffer(0), { union: { fileKey: f.result.id, ids } });
  if (state.file !== f || state.union.key !== key) {                   // a newer mapping or file took over
    if (state.file === f && !state.union.pending) busy(null);          // … and needs no union: clear the note
    return;
  }
  // The worker restarted since (a timeout or a crash): it no longer holds the file. Read it again once.
  if (m.type === 'union' && m.error === 'stale' && !retried) {
    if (!(await measure(f))) return;                                  // superseded: the newer read owns the state
    if (state.union.key !== key) { recompute(); return; }             // remapped during the read: start over
    if (!okResult(f)) { finishUnion(key, { type: 'union', area: 0, paths: [], verts: [], bad: [], error: 'engine' }); return; }
    state.union.key = unionKey(f.result.id, ids);
    requestUnion(f, ids, state.union.key, true);
    return;
  }
  mark('union', t0);
  busy(null);
  finishUnion(key, m.type === 'union' ? m : { type: 'union', area: 0, paths: [], verts: [], bad: [], error: m.reason || 'engine' });
}

function finishUnion(key, answer) {
  state.union.answer = answer;
  state.union.pending = false;
  busy(null);
  recompute();
}

// ---- rendering ----
function render() {
  const f = state.file;
  $('cpDropHint').hidden = !!f;
  $('cpClear').hidden = !f;
  const failed = f && f.result && f.result.type !== 'result';
  const none = okResult(f) && !state.layers.used.length;
  $('cpError').hidden = !(failed || none);
  if (failed) $('cpError').textContent = `${f.name}: ${t(`cp.err.${f.result.reason}`)}`;
  else if (none) $('cpError').textContent = `${f.name}: ${t('cp.err.nooutlines')}`;
  const show = okResult(f) && state.layers.used.length > 0;
  $('cpPanel').hidden = !show;
  if (!show) { drawing.clear(); return; }
  renderStatus(f);
  renderMapping();
  renderTerms();
  renderResults();
}

function renderStatus(f) {
  const box = $('cpStatus');
  box.replaceChildren();
  const file = f.result.file;
  box.appendChild(el('span', 'cp-file', f.name));
  $('cpPrintName').textContent = f.name;
  box.appendChild(el('span', null, t('cp.units.line', { units: unitName(file.used), source: t(`cp.units.src.${file.unitsSource}`) })));
  const lab = el('label', null, t('cp.units.change') + ' ');
  const s = document.createElement('select');
  const opt = (v, label) => { const o = el('option', null, label); o.value = v; s.appendChild(o); };
  opt('', t(file.units === 'none' ? 'cp.units.fromSettings' : 'cp.units.fromFile'));
  for (const u of UNITS) opt(u, t(`cp.unit.${u}`));
  s.value = f.override || '';
  s.addEventListener('change', async () => {
    f.override = s.value || null;
    ga('covp_units_override', { units: s.value || 'file' });
    state.union = { key: null, answer: null, pending: false };
    state.model = state.ev = null;                                  // the old figures are not this unit's
    render();
    if (await measure(f)) startMapping(f);
  });
  lab.appendChild(s);
  box.appendChild(lab);
}

function roleSelect(name) {
  const s = document.createElement('select');
  s.setAttribute('aria-label', `${t('cp.col.role')}: ${name}`);
  for (const r of ROLES) { const o = el('option', null, t(`cp.role.${r}`)); o.value = r; s.appendChild(o); }
  s.value = state.map[name].role;
  s.addEventListener('change', () => {
    const r = s.value;
    state.map[name] = r === 'level' ? { role: 'level', level: state.map[name].level || '00' } : { role: r };
    remap();
  });
  return s;
}

function levelSelect(name) {
  const s = document.createElement('select');
  s.setAttribute('aria-label', `${t('cp.col.level')}: ${name}`);
  for (const lv of LEVELS) { const o = el('option', null, levelName(t, lv)); o.value = lv; s.appendChild(o); }
  s.value = state.map[name].level || '00';
  s.addEventListener('change', () => { state.map[name] = { role: 'level', level: s.value }; remap(); });
  return s;
}

function remap() {
  const t0 = performance.now();
  lsSet(MAPPING_KEY, JSON.stringify(remember(cleanRemembered(safeJson(lsGet(MAPPING_KEY))), state.map)));
  recompute();
  mark('remap', t0);
}

function renderMapping() {
  const rows = state.layers.used.map(l => {
    const tr = document.createElement('tr');
    tr.dataset.layer = l.name;
    tr.appendChild(el('td', 'dq-name', l.name));
    const c = el('td', 'dq-num', String(l.outlines));
    if (l.bad) c.appendChild(el('span', 'dq-badge is-bad', '⚠ ' + t('cp.layers.bad', { n: l.bad })));
    tr.appendChild(c);
    tr.appendChild(el('td', 'dq-num', n2(l.area)));
    const r = state.map[l.name] || { role: 'ignore' };
    const rc = el('td'); const sw = el('span', 'cp-swatch'); sw.style.background = ROLE_COLORS[r.role] || 'transparent';
    rc.append(sw, roleSelect(l.name)); tr.appendChild(rc);
    const lc = el('td'); if (r.role === 'level') lc.appendChild(levelSelect(l.name)); tr.appendChild(lc);
    return tr;
  });
  $('cpMap').tBodies[0].replaceChildren(...rows);
  const a = state.auto;
  $('cpAuto').hidden = !(a && a.fromTemplate);
  if (a) $('cpAuto').textContent = t('cp.layers.auto', { n: a.fromTemplate });
  const other = state.layers.other;
  $('cpOther').hidden = !other.length;
  $('cpOtherSummary').textContent = t('cp.layers.other', { n: other.length });
  $('cpOtherList').textContent = other.map(l => l.name).join(', ');
}

// ---- step 2: the terms, stored per browser ----
const TERM_INPUTS = { sd: 'cpSd', sk: 'cpSk', hmax: 'cpHmax', roofAllow: 'cpRoofAllow', h: 'cpH', roof: 'cpRoof', basementAbove: 'cpBasementAbove', roofVolume: 'cpRoofVolume' };
const showNum = v => (v == null ? '' : String(v).replace('.', lang() === 'en' ? '.' : ','));

function termChanged() {
  // A term typed while the example's terms are shown makes them the visitor's own: from then on they are kept.
  state.saveTerms = true;
  lsSet(TERMS_KEY, JSON.stringify(state.terms));
  if (!state.gaTerms) { state.gaTerms = true; ga('covp_terms_entered', {}); }
  const t0 = performance.now();
  if (state.model) { state.ev = evaluate(state.model, state.terms, state.union.answer); renderResults(); }
  mark('term', t0);
}

for (const [key, id] of Object.entries(TERM_INPUTS)) {
  $(id).addEventListener('input', e => {
    const v = parseTerm(e.target.value);
    if (v === undefined) { e.target.setAttribute('aria-invalid', 'true'); return; }
    e.target.removeAttribute('aria-invalid');
    state.terms[key] = v;
    termChanged();
    if (key === 'sd') renderHmaxHint();
  });
}
$('cpEntrance').addEventListener('change', e => { state.terms.entrance = e.target.value; termChanged(); });
$('cpParking').addEventListener('change', e => { state.terms.parking = e.target.checked; termChanged(); });

function renderHmaxHint() {
  const h = defaultHmax(state.terms.sd);
  $('cpHmaxHint').textContent = h != null ? t('cp.term.hmax.hint', { h: n2(h) }) : '';
}

function renderTerms() {
  for (const [key, id] of Object.entries(TERM_INPUTS)) {
    const input = $(id);
    if (document.activeElement !== input) input.value = showNum(state.terms[key]);
  }
  $('cpParking').checked = !!state.terms.parking;
  renderHmaxHint();
  const levels = state.model ? [...new Set(state.model.levels.map(l => l.level))].sort((a, b) => LEVELS.indexOf(a) - LEVELS.indexOf(b)) : [];
  const ent = $('cpEntrance');
  const opts = levels.filter(lv => lv !== 'ATTIC');
  if (!opts.includes(state.terms.entrance)) opts.unshift(state.terms.entrance || '00');
  ent.replaceChildren(...opts.map(lv => { const o = el('option', null, levelName(t, lv)); o.value = lv; return o; }));
  ent.value = state.terms.entrance || '00';
  // One storey height per level above ground.
  const box = $('cpStoreys');
  const focused = document.activeElement && document.activeElement.dataset.level;
  if (!focused) {
    box.replaceChildren(...levels.filter(lv => !isBasement(lv)).map(lv => {
      const lab = el('label');
      lab.appendChild(el('span', null, t('cp.term.storey', { level: levelName(t, lv) })));
      const i = document.createElement('input');
      i.type = 'text'; i.inputMode = 'decimal'; i.dataset.level = lv;
      i.placeholder = showNum(DEFAULT_STOREY.toFixed(2));
      i.value = state.terms.storey[lv] != null ? showNum(state.terms.storey[lv]) : '';
      i.addEventListener('input', () => {
        const v = parseTerm(i.value);
        if (v === undefined) { i.setAttribute('aria-invalid', 'true'); return; }
        i.removeAttribute('aria-invalid');
        if (v == null) delete state.terms.storey[lv]; else state.terms.storey[lv] = v;
        termChanged();
      });
      lab.appendChild(i);
      return lab;
    }));
  }
}

// ---- step 3: the results ----
function artCell(key) {
  const td = el('td', 'cp-art-cell');
  if (!key) return td;
  const d = el('details', 'cp-art');
  d.appendChild(el('summary', null, articleText(key, t)));
  d.appendChild(el('span', 'cp-art-text', t(`cp.art.${key}`)));
  td.appendChild(d);
  return td;
}

function hlRow(tr, ids) {
  if (!ids || !ids.length) return;
  tr.dataset.ids = ids.join(' ');
  tr.tabIndex = 0;
  tr.classList.add('cp-linked');
  tr.addEventListener('mouseenter', () => drawing.setHighlight(ids));
  tr.addEventListener('mouseleave', () => drawing.setHighlight(state.hl));
  tr.addEventListener('focus', () => drawing.setHighlight(ids));
  tr.addEventListener('blur', () => drawing.setHighlight(state.hl));
  tr.addEventListener('click', e => { if (e.target.closest('summary, details')) return; setHl(state.hl && state.hl.join(' ') === ids.join(' ') ? null : ids); });
}

function setHl(ids) {
  state.hl = ids && ids.length ? ids : null;
  drawing.setHighlight(state.hl);
  markRows();
}

function markRows() {
  const set = new Set(state.hl || []);
  for (const tr of document.querySelectorAll('#cpSummary tbody tr, #cpSchedule tbody tr')) {
    const ids = (tr.dataset.ids || '').split(' ').filter(Boolean);
    tr.classList.toggle('is-hi', ids.length > 0 && ids.some(i => set.has(i)));
  }
}

function renderResults() {
  const ev = state.ev;
  const blocked = !ev || ev.blocked;
  $('cpBlocked').hidden = !(ev && ev.blocked);
  $('cpFigures').hidden = !!blocked;
  // The exports wait for the union: a copy or a print taken meanwhile would carry the sum, not the coverage.
  const noExport = !!blocked || state.union.pending;
  $('cpXlsx').disabled = noExport;
  $('cpPrint').disabled = noExport;
  document.querySelectorAll('[data-copy]').forEach(b => { b.disabled = noExport; });
  renderWarnings(ev);
  if (blocked) {
    $('cpBlocked').textContent = ev ? t(`cp.block.${ev.blocked}`, { n: (ev.plotIds || []).length }) : '';
    showDrawing(null);
    return;
  }
  // Summary: two blocks.
  const rows = summaryRows(ev, t, fmtNum);
  const body = [];
  for (const block of ['ydom', 'sworn']) {
    const head = document.createElement('tr');
    head.className = 'cp-block';
    const th = el('th', null, t(`cp.block.${block}`)); th.colSpan = 5; th.scope = 'rowgroup';
    head.appendChild(th); body.push(head);
    for (const r of rows.filter(x => x.block === block)) {
      const tr = document.createElement('tr');
      tr.dataset.key = r.key;
      const lab = el('td', 'cp-fig', r.label);
      if (r.note) lab.appendChild(el('small', 'cp-row-note', r.note));
      tr.appendChild(lab);
      tr.appendChild(el('td', 'cp-val', r.permitted.text));
      tr.appendChild(el('td', 'cp-val', r.proposed.text));
      const mk = el('td', `cp-mark ${r.mark === true ? 'is-ok' : r.mark === false ? 'is-over' : ''}`, markText(r.mark, t));
      if (r.mark != null) mk.title = t(r.mark ? 'cp.mark.ok' : 'cp.mark.over');
      tr.appendChild(mk);
      tr.appendChild(artCell(r.art));
      hlRow(tr, r.ids);
      body.push(tr);
    }
  }
  $('cpSummary').tBodies[0].replaceChildren(...body);

  // Schedule.
  $('cpSchedule').tBodies[0].replaceChildren(...scheduleRows(ev, t, fmtNum).map(r => {
    const tr = document.createElement('tr');
    tr.className = `cp-sch-${r.kind}`;
    tr.append(el('td', null, r.label), el('td', 'dq-num', r.areaText), el('td', 'dq-num', r.excludedText), el('td', 'dq-num', r.countsText), el('td', 'cp-note', r.note));
    hlRow(tr, r.ids);
    return tr;
  }));

  // Coordinates.
  const co = coordTables(ev, t, fmtCoord);
  const coordRow = r => {
    const tr = document.createElement('tr');
    if (r.head) { const th = el('th', null, r.label); th.colSpan = 4; tr.appendChild(th); return tr; }
    tr.append(el('td', null, String(r.n)), el('td', 'dq-num', r.xText), el('td', 'dq-num', r.yText), el('td', 'cp-note', r.note));
    return tr;
  };
  $('cpPlotCoords').tBodies[0].replaceChildren(...co.plot.map(coordRow));
  $('cpBuildingCoords').tBodies[0].replaceChildren(...co.building.map(coordRow));
  $('cpNotEgsa').hidden = ev.coords.egsa;
  const notes = [];
  if (!ev.coords.plotHasVerts) notes.push(t('cp.coords.noVerts'));
  if (ev.coverage.state === 'failed') notes.push(t('cp.coords.approx'));
  $('cpCoordsNote').hidden = !notes.length;
  $('cpCoordsNote').textContent = notes.join(' ');
  showDrawing(ev);
  markRows();
}

function renderWarnings(ev) {
  const ul = $('cpWarnings');
  const list = ev ? ev.warnings : [];
  if (!list.length) { ul.replaceChildren(el('li', 'gv-w is-ok', t('cp.warn.none'))); return; }
  ul.replaceChildren(...list.map(w => {
    const li = el('li', 'gv-w is-warn');
    li.appendChild(el('span', null, t(`cp.warn.${w.id}`, formatParams(w.params, fmtNum))));
    if (w.ids && w.ids.length) {
      const b = el('button', 'gv-w-line', t('cp.warn.show'));
      b.type = 'button';
      b.addEventListener('click', () => { setHl(w.ids); $('cpCanvas').scrollIntoView({ block: 'center', behavior: 'smooth' }); });
      li.appendChild(b);
    }
    return li;
  }));
}

// ---- the drawing ----
const drawing = createDrawing($('cpCanvas'), {
  onHover(i, x, y) {
    const tip = $('cpTip');
    const f = state.file;
    if (!okResult(f) || i < 0) { tip.hidden = true; return; }
    const it = f.result.items[i], r = state.map[it.layer] || { role: 'ignore' };
    const lines = [[t('cp.tip.layer'), it.layer], [t('cp.tip.role'), t(`cp.role.${r.role}`)]];
    if (it.area > 0) lines.push([t('cp.tip.area'), `${n2(it.area)} m²`]);
    const sp = state.model && state.model.spaces.find(s => s.id === it.id);
    if (r.role === 'level') lines.push([t('cp.tip.level'), levelName(t, r.level)]);
    else if (sp && sp.level) lines.push([t('cp.tip.level'), levelName(t, sp.level)]);
    tip.replaceChildren(...lines.map(([k, v]) => { const d = el('div'); d.appendChild(el('b', null, k + ': ')); d.appendChild(document.createTextNode(v)); return d; }));
    const box = $('cpCanvas').getBoundingClientRect();
    tip.hidden = false;
    let left = x - box.left + 14, top = y - box.top + 14;
    if (left + tip.offsetWidth > box.width) left = Math.max(0, x - box.left - tip.offsetWidth - 10);
    if (top + tip.offsetHeight > box.height) top = Math.max(0, y - box.top - tip.offsetHeight - 10);
    tip.style.left = `${left}px`; tip.style.top = `${top}px`;
  },
  onPick(i) {
    const f = state.file;
    if (!okResult(f)) return;
    if (i < 0) { setHl(null); return; }
    const id = f.result.items[i].id;
    setHl([id]);
    const row = [...document.querySelectorAll('#cpSummary tbody tr, #cpSchedule tbody tr')].find(tr => (tr.dataset.ids || '').split(' ').includes(id));
    if (row) row.scrollIntoView({ block: 'nearest' });
  },
});

let shownFile = null;
function showDrawing(ev) {
  const f = state.file;
  if (!okResult(f)) { drawing.clear(); return; }
  const roleOf = it => {
    const r = state.map[it.layer];
    if (!r || r.role === 'ignore' || it.kind === 'hatch' || it.kind === 'insert') return null;
    return { role: r.role, closed: isClosed(it) && !it.bad };
  };
  const labels = [];
  let building = [];
  if (ev && !ev.blocked) {
    for (const r of ev.coords.plot) labels.push({ x: r.x, y: r.y, n: r.n, plot: true });
    for (const part of ev.coords.building) for (const r of part.rows) labels.push({ x: r.x, y: r.y, n: r.n });
    if (ev.coverage.state === 'ok' && state.union.answer) building = state.union.answer.paths || [];
  }
  const keep = shownFile === f.result;
  shownFile = f.result;
  drawing.show(f.result, roleOf, { building, labels }, keep);
  drawing.setHighlight(state.hl);
  $('cpLegend').replaceChildren(...[...new Set(Object.values(state.map).map(r => r.role))].filter(r => r !== 'ignore').sort((a, b) => ROLES.indexOf(a) - ROLES.indexOf(b)).map(r => {
    const li = el('li'); const sw = el('span', 'cp-swatch'); sw.style.background = ROLE_COLORS[r]; li.append(sw, t(`cp.role.${r}`)); return li;
  }));
}

window.__covp.drawing = drawing;
$('cpFit').addEventListener('click', () => drawing.fit());
// The printed drawing is the whole drawing, whatever the screen showed.
window.addEventListener('beforeprint', () => drawing.fit());
$('cpZoomIn').addEventListener('click', () => drawing.zoomBy(1.25));
$('cpZoomOut').addEventListener('click', () => drawing.zoomBy(1 / 1.25));

// ---- exports ----
function save(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('cpXlsx').addEventListener('click', () => {
  if (!state.ev || state.ev.blocked || state.union.pending) return;
  const f = state.file;
  const sheets = workbookFor({ ev: state.ev, layers: state.layers.used, map: state.map, file: { units: unitName(f.result.file.used) }, t, n: fmtNum });
  save(new Blob([writeXlsx(sheets)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), xlsxName(f.name));
  ga('covp_xlsx_download', {});
});
document.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
  const ev = state.ev;
  if (!ev || ev.blocked || state.union.pending) return;
  const n = plain(lang() === 'en' ? '.' : ',');
  let text;
  if (b.dataset.copy === 'summary') text = summaryTsv(summaryRows(ev, t, n), t);
  else if (b.dataset.copy === 'schedule') text = scheduleTsv(scheduleRows(ev, t, n), t);
  else { const co = coordTables(ev, t, n); text = coordsTsv([{ head: true, label: t('cp.coords.plot') }, ...co.plot, { head: true, label: t('cp.coords.building') }, ...co.building], t); }
  try { await navigator.clipboard.writeText(text); } catch (e) { return; }
  ga('covp_copy', {});
  b.textContent = t('cp.copied');
  setTimeout(() => { b.textContent = t('cp.copy'); }, 1500);
}));
$('cpPrint').addEventListener('click', () => { ga('covp_print', {}); window.print(); });
$('cpTemplate').addEventListener('click', () => ga('covp_template_download', {}));

// ---- inputs ----
async function readFile(file) { await loadFile(file.name, await file.arrayBuffer(), 'file'); }
$('cpInput').addEventListener('change', async e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) await readFile(f); });
document.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('gv-dragging'); });
document.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('gv-dragging'); });
document.addEventListener('drop', async e => {
  e.preventDefault(); document.body.classList.remove('gv-dragging');
  const f = [...(e.dataTransfer && e.dataTransfer.files || [])].find(x => /\.(dxf|dwg)$/i.test(x.name));
  if (f) await readFile(f);
});
$('cpExample').addEventListener('click', async () => {
  try {
    const r = await fetch(new URL(`./examples/${EXAMPLE}`, import.meta.url));
    if (!r.ok) throw new Error(String(r.status));
    await loadFile(EXAMPLE, await r.arrayBuffer(), 'example');
  } catch (e) { showBanner({ key: 'cp.example.failed' }); }
});
$('cpClear').addEventListener('click', () => {
  state.file = null; state.model = state.ev = null; state.layers = { used: [], other: [] }; state.hl = null;
  if (!state.saveTerms) { state.terms = termsFromStorage(lsGet(TERMS_KEY)); state.saveTerms = true; }
  busy(null); render();
});

// ---- the template names ----
function renderNames() {
  $('cpNames').replaceChildren(...TEMPLATE.map(x => {
    const li = el('li');
    li.appendChild(el('code', null, x.layer));
    li.appendChild(document.createTextNode(' ' + t(`cp.role.${x.role}`) + (x.level ? ` · ${levelName(t, x.level)}` : '')));
    return li;
  }));
}

// ---- CTA and survey ----
$('cpCta').addEventListener('click', () => ga('covp_cta_click', { where: 'page' }));
if (lsGet(SURVEY_KEY)) $('cpSurvey').hidden = true;
$('cpSurvey').addEventListener('click', e => {
  const b = e.target.closest('[data-answer]');
  if (!b) return;
  ga('covp_survey', { answer: b.dataset.answer });
  lsSet(SURVEY_KEY, b.dataset.answer);
  $('cpSurvey').querySelectorAll('[data-answer]').forEach(x => { x.disabled = true; });
  $('cpThanks').hidden = false;
});

// A language change re-renders everything built here (the drawing keeps its view).
document.addEventListener('gv:lang', () => {
  if (state.banner) showBanner(state.banner);
  busy($('cpBusy').hidden ? null : state.union.pending ? 'cp.union.pending' : 'cp.processing');
  renderNames();
  render();
});

renderNames();
render();
