// Laser DXF check: the page controller (spec §10). Files go to the engine worker one at a time; the page
// keeps each file's result and recomputes weight, time and totals in JavaScript (spec §3).
import { t, ga, fmtNum, lang } from '../gcode/shell/i18n.js';
import { lsGet, lsSet, loadStored, saveStored } from '../gcode/shell/settings-store.js';
import { renderBanner } from '../gcode/shell/banner.js';
// The tool's own modules carry the deploy version, so a cached old module never meets a new controller.
import { createEngine } from './bridge.js?v=20261015';
import { createDrawing } from './drawing.js?v=20261015';
import { MATERIALS, DEFAULT_SPEEDS, DEFAULT_MARK_SPEED, THICKNESSES, fileNumbers, orderTotals, statusOf, formatDuration } from './pricing.js?v=20261015';
import { zipStore, uniqueNames } from './zip.js?v=20261015';

const $ = id => document.getElementById(id);
const MAX_FILES = 50;
const SETTINGS_KEY = 'aidedcam-lc-settings';
const SURVEY_KEY = 'aidedcam-lc-survey';
const EXAMPLE = [['bracket.dxf', 10], ['flange.dxf', 4], ['cover.dxf', 2], ['spacer.dwg', 20]];
const SETTING_FIELDS = ['units', 'joinTol', 'gapTol', 'material', 'thickness', 'markSpeed', 'speeds'];

const state = {
  files: [],                  // { id, name, bytes, result, numbers, qty, material, thickness, own: {material, thickness}, roles, status }
  selected: null,
  banner: null,
  engineReady: false,
  settings: loadStored(SETTINGS_KEY, {
    units: 'auto', joinTol: 0.01, gapTol: 0.2, material: 'steel', thickness: 2, markSpeed: DEFAULT_MARK_SPEED,
    speeds: JSON.parse(JSON.stringify(DEFAULT_SPEEDS)),
  }),
};
let nextId = 0, batch = null;

function saveSettings() { saveStored(SETTINGS_KEY, state.settings, SETTING_FIELDS); }
function showBanner(b) { state.banner = b; renderBanner($('lcBanner'), b, t); }
const num = (v, d) => fmtNum(v, d);
const fmtParam = v => (typeof v === 'number' ? num(v, Number.isInteger(v) ? 0 : 2) : String(v ?? ''));

// ---- the engine ----
const supported = typeof WebAssembly === 'object' && typeof Worker === 'function' && typeof DecompressionStream === 'function';
const engine = supported ? createEngine({
  onBootProgress: pct => showBanner({ key: 'lc.engine.loading', params: { pct } }),
  onReady: () => { state.engineReady = true; if (state.banner && state.banner.key === 'lc.engine.loading') showBanner(null); },
}) : null;
if (!supported) showBanner({ key: 'lc.engine.nowasm' });

function engineSettings(f) {
  const s = state.settings;
  return { units: s.units, joinTol: Number(s.joinTol), gapTol: Number(s.gapTol), roles: f.roles };
}

async function run(f) {
  if (!engine) return;
  f.status = 'processing';
  render();
  const m = await engine.process(f.name, f.bytes.slice(0), engineSettings(f));
  if (!state.files.includes(f)) return;                          // removed meanwhile
  f.result = m;
  f.status = m.type === 'result' ? 'done' : 'error';
  if (m.type === 'error' && m.reason === 'engine' && !state.engineReady) showBanner({ key: 'lc.engine.failed', action: { key: 'lc.engine.retry', run: () => location.reload() } });
  recompute(f);
  if ((state.selected === null && f.status === 'done') || state.selected === f.id) select(f.id);   // redraw a re-run
  else render();
  if (batch && batch.files.includes(f)) finishBatch(f);
}

function addFiles(list, source) {
  const room = MAX_FILES - state.files.length;
  if (list.length > room) showBanner({ key: 'lc.toomany', params: { max: MAX_FILES } });
  const added = [];
  for (const { name, bytes, qty } of list.slice(0, Math.max(0, room))) {
    const f = { id: ++nextId, name, bytes, result: null, numbers: null, qty: qty || 1, own: {}, roles: {}, status: 'waiting' };
    state.files.push(f);
    added.push(f);
  }
  if (!added.length) return;
  batch = { files: added, left: added.length, source, counted: new Set() };
  render();
  added.forEach(run);
}

function finishBatch(f) {
  if (batch.counted.has(f)) return;                     // a re-run of the same file counts once
  batch.counted.add(f);
  batch.left--;
  if (batch.left > 0) return;
  const done = batch.files;
  const results = done.map(x => x.result).filter(r => r && r.type === 'result');
  if (batch.source === 'example') ga('laser_example_loaded', {});
  else {
    ga('laser_files_loaded', {
      files: done.length,
      parts: results.reduce((a, r) => a + r.parts.length, 0),
      errors: done.length - results.length,
      open: results.filter(r => r.extras.openPierces > 0).length,
      repaired: results.filter(r => statusOf(r) === 'warn').length,
    });
  }
  batch = null;
}

// ---- numbers ----
function jobOf(f) {
  return { material: f.own.material || state.settings.material, thickness: Number(f.own.thickness || state.settings.thickness) };
}
function recompute(f) {
  f.numbers = f.result && f.result.type === 'result'
    ? fileNumbers(f.result, jobOf(f), state.settings.speeds, Number(state.settings.markSpeed))
    : null;
}
function recomputeAll() { state.files.forEach(recompute); render(); }

// ---- the parts table ----
function statusCell(f) {
  const td = document.createElement('td');
  const st = f.status === 'done' || f.status === 'error' ? statusOf(f.result) : null;
  const span = document.createElement('span');
  if (!st) { span.className = 'lc-status is-busy'; span.textContent = t(f.status === 'processing' ? 'lc.processing' : 'lc.waiting'); }
  else {
    span.className = `lc-status is-${st}`;
    span.textContent = st === 'ok' ? '✔' : st === 'warn' ? '⚠' : '✖';
    span.title = t(`lc.status.${st}`);
    span.setAttribute('aria-label', t(`lc.status.${st}`));
  }
  td.appendChild(span);
  return td;
}

function dropdown(el, options, value, onChange) {
  const s = document.createElement('select');
  for (const [v, label] of options) { const o = document.createElement('option'); o.value = v; o.textContent = label; s.appendChild(o); }
  s.value = String(value);
  s.addEventListener('change', () => onChange(s.value));
  s.addEventListener('click', e => e.stopPropagation());
  el.appendChild(s);
  return s;
}
const materialOptions = () => Object.keys(MATERIALS).map(m => [m, t(`lc.mat.${m}`)]);
const thicknessOptions = () => THICKNESSES.map(v => [String(v), num(v, v % 1 ? 1 : 0)]);

function td(text, cls) { const c = document.createElement('td'); c.textContent = text; if (cls) c.className = cls; return c; }

function renderTable() {
  const body = $('lcTable').tBodies[0];
  body.replaceChildren();
  for (const f of state.files) {
    const tr = document.createElement('tr');
    tr.className = 'lc-row' + (f.id === state.selected ? ' is-sel' : '');
    tr.tabIndex = 0;
    tr.addEventListener('click', () => select(f.id));
    tr.addEventListener('keydown', e => { if (e.key === 'Enter') select(f.id); });
    tr.appendChild(td(f.name, 'lc-name'));
    const n = f.numbers;
    tr.appendChild(td(n ? String(n.parts) : '–'));
    tr.appendChild(statusCell(f));
    tr.appendChild(td(n ? `${num(n.cutLength / 1000, 2)} m` : '–'));
    tr.appendChild(td(n ? String(n.pierces) : '–'));
    tr.appendChild(td(n ? `${num(n.area / 1e6, 3)} m²` : '–'));
    tr.appendChild(td(n ? `${num(n.weight, 2)} kg` : '–'));
    tr.appendChild(td(n ? (n.incomplete ? '≥ ' : '') + formatDuration(n.seconds) : '–'));
    const q = document.createElement('td');
    const qi = document.createElement('input');
    qi.type = 'number'; qi.min = '0'; qi.step = '1'; qi.value = String(f.qty); qi.className = 'lc-qty';
    qi.setAttribute('aria-label', t('lc.col.qty'));
    qi.addEventListener('click', e => e.stopPropagation());
    qi.addEventListener('change', () => { const v = Math.max(0, Math.floor(Number(qi.value) || 0)); f.qty = v; qi.value = String(v); renderTotals(); });
    q.appendChild(qi); tr.appendChild(q);
    const m = document.createElement('td');
    dropdown(m, materialOptions(), jobOf(f).material, v => { f.own.material = v; recompute(f); render(); });
    tr.appendChild(m);
    const th = document.createElement('td');
    dropdown(th, thicknessOptions(), String(jobOf(f).thickness), v => { f.own.thickness = Number(v); recompute(f); render(); });
    tr.appendChild(th);
    const d = document.createElement('td');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'gv-link'; btn.textContent = t('lc.download');
    btn.disabled = !(f.result && f.result.type === 'result');
    btn.addEventListener('click', e => { e.stopPropagation(); downloadDxf(f); });
    d.appendChild(btn); tr.appendChild(d);
    body.appendChild(tr);
  }
  renderTotals();
}

function renderTotals() {
  const tot = orderTotals(state.files.map(f => ({ numbers: f.numbers, qty: f.qty })));
  const pending = state.files.some(f => f.status === 'waiting' || f.status === 'processing');
  const ge = tot.incomplete || pending ? '≥ ' : '';
  const cells = $('lcTotals').children;
  cells[1].textContent = String(tot.parts);
  cells[3].textContent = `${ge}${num(tot.cutLength / 1000, 2)} m`;
  cells[4].textContent = `${ge}${tot.pierces}`;
  cells[5].textContent = `${ge}${num(tot.area / 1e6, 3)} m²`;
  cells[6].textContent = `${ge}${num(tot.weight, 2)} kg`;
  cells[7].textContent = ge + formatDuration(tot.seconds);
  $('lcIncomplete').hidden = !tot.incomplete;
  $('lcZip').disabled = !state.files.some(f => f.result && f.result.type === 'result');
  $('lcDropHint').hidden = state.files.length > 0;
}

// ---- the selected file: drawing, checks, roles ----
const drawing = createDrawing($('lcSvg'), { onHover: c => showHover(c) });

function showHover(c) {
  const out = $('lcHover');
  if (!c) { out.textContent = ''; drawing.highlight(null); return; }
  const kind = c.role !== 'cut' ? c.role : !c.closed ? 'open' : c.isHole ? 'hole' : 'outer';
  out.textContent = t('lc.hover', { kind: t(`lc.kind.${kind}`), len: num(c.length, 2) });
  drawing.highlight(c.id);
}

function checksOf(f) {
  const r = f.result;
  if (!r) return [];
  if (r.type === 'error') {
    const id = r.reason === 'version' ? 'read-version' : r.reason === 'limit' || r.reason === 'timeout' ? 'too-large' : 'read-error';
    return [{ id, severity: 'error', params: { message: r.message || r.reason } }];
  }
  const list = [...r.checks];
  if (f.numbers && f.numbers.clamped) list.push({ id: 'clamped', severity: 'info', params: {} });
  return list;
}

function renderChecks(f) {
  const ul = $('lcChecks');
  const list = checksOf(f);
  if (!list.length) {
    const li = document.createElement('li'); li.className = 'gv-w is-ok'; li.textContent = t('lc.none');
    ul.replaceChildren(li); return;
  }
  ul.replaceChildren(...list.map(c => {
    const li = document.createElement('li');
    li.className = `gv-w is-${c.severity === 'info' ? 'ok' : c.severity}`;
    const params = Object.fromEntries(Object.entries(c.params || {}).map(([k, v]) => [k, fmtParam(v)]));
    li.textContent = t(`lc.check.${c.id}`, params);
    return li;
  }));
}

function renderRoles(f) {
  const body = $('lcRoles').tBodies[0];
  body.replaceChildren();
  const groups = f.result && f.result.type === 'result' ? f.result.groups : [];
  for (const g of groups) {
    const tr = document.createElement('tr');
    const sw = document.createElement('td');
    const chip = document.createElement('span'); chip.className = 'lc-chip'; chip.style.background = g.color;
    sw.appendChild(chip); tr.appendChild(sw);
    tr.appendChild(td(g.layer)); tr.appendChild(td(g.linetype)); tr.appendChild(td(String(g.curves)));
    const r = document.createElement('td');
    dropdown(r, ['cut', 'mark', 'bend', 'ignore'].map(x => [x, t(`lc.role.${x}`)]), g.role, v => { f.roles[g.key] = v; run(f); });
    tr.appendChild(r);
    body.appendChild(tr);
  }
}

function select(id) {
  if (typeof id !== 'number') return;
  state.selected = id;
  const f = state.files.find(x => x.id === id);
  render();
  if (!f) return;
  $('lcFileName').textContent = f.name;
  $('lcPick').hidden = true;
  if (f.result && f.result.type === 'result') drawing.show(f.result); else drawing.clear();
}

function renderDetail() {
  const f = state.files.find(x => x.id === state.selected);
  $('lcDetail').hidden = !state.files.length;
  if (!f) { $('lcPick').hidden = false; $('lcFileName').textContent = ''; $('lcChecks').replaceChildren(); $('lcRoles').tBodies[0].replaceChildren(); return; }
  renderChecks(f);
  renderRoles(f);
}

function render() { renderTable(); renderDetail(); }

// ---- settings ----
function renderSpeeds() {
  const s = state.settings, m = s.material;
  $('lcSpeedsTitle').textContent = t('lc.set.speeds', { material: t(`lc.mat.${m}`) });
  const body = $('lcSpeeds').tBodies[0];
  body.replaceChildren();
  const rows = s.speeds[m] || (s.speeds[m] = JSON.parse(JSON.stringify(DEFAULT_SPEEDS[m])));
  rows.forEach((row, i) => {
    const tr = document.createElement('tr');
    tr.appendChild(td(num(row[0], row[0] % 1 ? 1 : 0)));
    for (const k of [1, 2]) {
      const c = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = 'number'; inp.min = '0'; inp.step = k === 1 ? '100' : '0.1'; inp.value = String(row[k]);
      inp.setAttribute('aria-label', `${t(k === 1 ? 'lc.set.cut' : 'lc.set.pierce')} ${row[0]} mm`);
      inp.addEventListener('change', () => { const v = Number(inp.value); if (Number.isFinite(v) && v > 0) { rows[i][k] = v; saveSettings(); recomputeAll(); } else inp.value = String(rows[i][k]); });
      c.appendChild(inp); tr.appendChild(c);
    }
    body.appendChild(tr);
  });
}

function wireSettings() {
  const s = state.settings;
  const units = $('lcUnits');
  units.replaceChildren(...['auto', 'mm', 'inch'].map(v => { const o = document.createElement('option'); o.value = v; o.textContent = t(`lc.set.units.${v}`); return o; }));
  units.value = s.units;
  $('lcJoin').value = String(s.joinTol); $('lcGap').value = String(s.gapTol); $('lcMarkSpeed').value = String(s.markSpeed);
  const mat = $('lcMaterial');
  mat.replaceChildren(...materialOptions().map(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; return o; }));
  mat.value = s.material;
  const thk = $('lcThickness');
  thk.replaceChildren(...thicknessOptions().map(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; return o; }));
  thk.value = String(s.thickness);
  renderSpeeds();
}

function onEngineSetting(key, read, valid) {
  return e => {
    const v = read(e.target.value);
    if (!valid(v)) { e.target.value = String(state.settings[key]); return; }
    state.settings[key] = v; saveSettings();
    state.files.forEach(f => run(f));
  };
}

$('lcUnits').addEventListener('change', onEngineSetting('units', v => v, v => ['auto', 'mm', 'inch'].includes(v)));
$('lcJoin').addEventListener('change', onEngineSetting('joinTol', Number, v => Number.isFinite(v) && v > 0 && v <= 1));
$('lcGap').addEventListener('change', onEngineSetting('gapTol', Number, v => Number.isFinite(v) && v >= 0 && v <= 5));
$('lcMaterial').addEventListener('change', e => { state.settings.material = e.target.value; saveSettings(); renderSpeeds(); recomputeAll(); });
$('lcThickness').addEventListener('change', e => { state.settings.thickness = Number(e.target.value); saveSettings(); recomputeAll(); });
$('lcMarkSpeed').addEventListener('change', e => {
  const v = Number(e.target.value);
  if (!(Number.isFinite(v) && v > 0)) { e.target.value = String(state.settings.markSpeed); return; }
  state.settings.markSpeed = v; saveSettings(); recomputeAll();
});
$('lcReset').addEventListener('click', () => {
  const m = state.settings.material;
  state.settings.speeds[m] = JSON.parse(JSON.stringify(DEFAULT_SPEEDS[m]));
  saveSettings(); renderSpeeds(); recomputeAll();
});

// ---- downloads and print ----
const baseName = n => n.replace(/\.(dxf|dwg)$/i, '');
function save(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function downloadDxf(f) {
  save(new Blob([new Uint8Array(f.result.dxf)], { type: 'application/dxf' }), `${baseName(f.name)}-laser.dxf`);
  ga('laser_dxf_download', {});
}
$('lcZip').addEventListener('click', () => {
  const ready = state.files.filter(f => f.result && f.result.type === 'result');
  const names = uniqueNames(ready.map(f => `${baseName(f.name)}-laser.dxf`));
  const files = ready.map((f, i) => ({ name: names[i], bytes: new Uint8Array(f.result.dxf) }));
  if (!files.length) return;
  save(new Blob([zipStore(files, new Date())], { type: 'application/zip' }), 'laser-order.zip');
  ga('laser_zip_download', { files: files.length });
});

// The report prints every file with its drawing and checks (spec §10).
function buildPrint() {
  const box = $('lcPrintAll');
  box.replaceChildren();
  $('lcPrintDate').textContent = new Date().toLocaleDateString(lang());
  for (const f of state.files) {
    const sec = document.createElement('section'); sec.className = 'lc-print-file';
    const h = document.createElement('h3'); h.textContent = `${f.name} · ${t('lc.col.qty')} ${f.qty}`; sec.appendChild(h);
    if (f.result && f.result.type === 'result') {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'lc-svg lc-print-svg');
      sec.appendChild(svg);
      box.appendChild(sec);
      createDrawing(svg).show(f.result);
    } else box.appendChild(sec);
    const ul = document.createElement('ul'); ul.className = 'gv-check-list';
    for (const c of checksOf(f)) {
      const li = document.createElement('li');
      li.className = `gv-w is-${c.severity === 'info' ? 'ok' : c.severity}`;
      li.textContent = t(`lc.check.${c.id}`, Object.fromEntries(Object.entries(c.params || {}).map(([k, v]) => [k, fmtParam(v)])));
      ul.appendChild(li);
    }
    sec.appendChild(ul);
  }
}
$('lcPrint').addEventListener('click', () => { ga('laser_print', {}); window.print(); });
window.addEventListener('beforeprint', buildPrint);
window.addEventListener('afterprint', () => $('lcPrintAll').replaceChildren());

// ---- inputs ----
async function readFiles(fileList) {
  const list = [];
  for (const file of fileList) list.push({ name: file.name, bytes: await file.arrayBuffer() });
  addFiles(list, 'file');
}
$('lcFile').addEventListener('change', async e => { const fl = [...e.target.files]; e.target.value = ''; await readFiles(fl); });
document.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('gv-dragging'); });
document.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('gv-dragging'); });
document.addEventListener('drop', async e => {
  e.preventDefault(); document.body.classList.remove('gv-dragging');
  const fl = [...(e.dataTransfer && e.dataTransfer.files || [])].filter(f => /\.(dxf|dwg)$/i.test(f.name));
  if (fl.length) await readFiles(fl);
});
$('lcExample').addEventListener('click', async () => {
  const base = new URL('./examples/', import.meta.url);
  const list = [];
  for (const [name, qty] of EXAMPLE) list.push({ name, qty, bytes: await (await fetch(new URL(name, base))).arrayBuffer() });
  addFiles(list, 'example');
});
$('lcClear').addEventListener('click', () => { state.files = []; state.selected = null; drawing.clear(); render(); });
$('lcFit').addEventListener('click', () => drawing.fit());
$('lcZoomIn').addEventListener('click', () => drawing.zoomBy(1 / 1.25));
$('lcZoomOut').addEventListener('click', () => drawing.zoomBy(1.25));

// ---- CTA and survey ----
$('lcCta').addEventListener('click', () => ga('laser_cta_click', {}));
if (lsGet(SURVEY_KEY)) $('lcSurvey').hidden = true;
$('lcSurvey').addEventListener('click', e => {
  const b = e.target.closest('[data-answer]');
  if (!b) return;
  ga('laser_survey', { answer: b.dataset.answer });
  lsSet(SURVEY_KEY, b.dataset.answer);
  $('lcSurvey').querySelectorAll('[data-answer]').forEach(x => { x.disabled = true; });
  $('lcThanks').hidden = false;
});

// A language change re-renders everything built here.
document.addEventListener('gv:lang', () => {
  if (state.banner) showBanner(state.banner);
  wireSettings();
  render();
  const f = state.files.find(x => x.id === state.selected);
  if (f) $('lcFileName').textContent = f.name;
});

wireSettings();
render();
