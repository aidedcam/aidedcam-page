// IFC floor plans: the page controller (spec §6; 3D spec §3.2, §4). One file at a time goes to the web-ifc worker
// through the shared bridge; the page keeps its answer (every storey's plan in metres) and writes the DXFs from it on
// download, so the units and the move to origin need no new cut. A changed cut height re-cuts the open model in the
// worker. The 3D tab loads three.js and asks the worker for the model's triangles only when it is first opened; the
// storey, the cut height and the legend's layer toggles drive both views.
import { t, ga, lang } from '../gcode/shell/i18n.js';
import { lsGet, lsSet } from '../gcode/shell/settings-store.js';
import { renderBanner } from '../gcode/shell/banner.js';
import { createEngine } from '../laser/bridge.js?v=20261001';
import { zipStore, uniqueNames } from '../laser/zip.js?v=20261001';
import { storeyDxf, originShift, UNITS } from './dxf.js?v=20261003';
import { storeyFileNames, zipName, stem } from './names.js?v=20261003';
import { MAX_BYTES, LARGE_BYTES } from './model.js?v=20261003';
import { cleanSettings, parseCut, showM, sizeBucket, storeysBucket, warningsOf, SETTINGS_KEY, triangleCap, tipParts } from './state.js?v=20261003';
import { createDrawing, LAYER_COLORS, LEGEND_ORDER } from './drawing.js?v=20261003';

const $ = id => document.getElementById(id);
const SURVEY_KEY = 'aidedcam-ifcp-survey';
const EXAMPLE = 'example-house.ifc';
const TIMEOUT_MS = 120000;                 // spec §7

const state = {
  file: null,            // { name, bytes, source, result, error, gen, three }
  settings: cleanSettings(safeJson(lsGet(SETTINGS_KEY))),
  selected: 0,
  banner: null,
  busy: null,            // { key, params }
  recutMs: null,
  tab: 'plan',           // 'plan' | '3d': the plan for every new file
  hidden: new Set(),     // layers the legend switched off, in both views; all on for every new file
  cut3d: true,           // "Cut at the plan height"
};
let latest = 0;          // the newest file choice; a slower, earlier read must not replace it
let view3d = null;       // the 3D view, made on the first 3D tab; kept for later files
let view3dModule = null; // the import of view3d.js (and three.js), once
let view3dTries = 0;     // a failed import is remembered by the browser per URL: a retry adds a fragment
// Read by the browser check: file, example, re-cut and 3D times (ms), the views; maxTriangles overrides the cap.
window.__ifcp = { timings: {}, view3d: null, maxTriangles: undefined };
const mark = (name, t0) => { window.__ifcp.timings[name] = Math.round(performance.now() - t0); };

function safeJson(s) { try { return JSON.parse(s || '{}'); } catch (e) { return {}; } }
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const ok = f => f && f.result && f.result.type === 'result';
const m2 = v => showM(v, lang());
function saveSettings() { lsSet(SETTINGS_KEY, JSON.stringify(state.settings)); }
function showBanner(b) { state.banner = b; renderBanner($('ipBanner'), b, t); }
function busy(b) { state.busy = b; $('ipBusy').hidden = !b; $('ipBusy').textContent = b ? t(b.key, b.params) : ''; }

// ---- the engine: web-ifc in its worker, loaded with the first file ----
const supported = typeof WebAssembly === 'object' && typeof Worker === 'function';
const engine = supported ? createEngine({
  makeWorker: () => new Worker(new URL('./worker.js?v=20261003', import.meta.url), { type: 'module' }),
  timeoutMs: TIMEOUT_MS,
}) : null;
if (!supported) showBanner({ key: 'ip.engine.nowasm' });

async function run(f, settings) {
  return engine ? engine.process(f.name, f.bytes.slice(0), settings) : { type: 'error', reason: 'engine' };
}

// A new file (or none): the plan tab, every layer on, and the last file's 3D scene disposed.
function newFile(f) {
  state.file = f; state.selected = 0; state.recutMs = null;
  state.tab = 'plan';
  state.hidden = new Set();
  drawing.setHidden(state.hidden);
  if (view3d) { view3d.clear(); view3d.setHidden(state.hidden); }
  $('ip3dTip').hidden = true;
}

async function loadFile(name, bytes, source, t0 = performance.now()) {
  const f = { name, bytes, source, result: null, gen: 0, three: null };
  newFile(f);
  if (bytes.byteLength > MAX_BYTES) { f.result = { type: 'error', reason: 'limit' }; busy(null); fail(f); render(); return; }
  busy({ key: bytes.byteLength > LARGE_BYTES ? 'ip.large' : 'ip.processing' });
  render();
  const m = await run(f, { cutM: state.settings.cutM });
  if (state.file !== f) return;                                   // replaced meanwhile
  busy(null);
  f.result = m;
  if (m.type !== 'result') { fail(f); render(); return; }
  f.cutM = m.cutM;
  if (state.banner && state.banner.key === 'ip.example.failed') showBanner(null);
  render();
  mark(source === 'example' ? 'example' : 'file', t0);
  if (source === 'example') ga('ifcp_example_loaded', {});
  else ga('ifcp_file_loaded', { schema: m.file.schema, size: sizeBucket(bytes.byteLength), storeys: storeysBucket(m.storeys.length) });
  if (state.settings.cutM !== m.cutM) recut(state.settings.cutM);   // a height typed while this file loaded
}

function fail(f, r = f.result) { ga('ifcp_error', { reason: r.reason || 'engine' }); }

// A changed cut height: the worker cuts its open model again. If it restarted meanwhile (a timeout or a crash in
// another file), it no longer holds the model, so the file is read again once.
async function recut(cutM) {
  const f = state.file;
  if (!ok(f)) return;
  const gen = f.gen = f.gen + 1;
  const t0 = performance.now();
  busy({ key: 'ip.recutting', params: { h: m2(cutM) } });
  let m = engine ? await engine.process('recut', new ArrayBuffer(0), { cutM, recut: true }) : { type: 'error', reason: 'engine' };
  if (m.type === 'error' && m.reason === 'stale' && state.file === f && f.gen === gen) m = await run(f, { cutM });
  if (state.file !== f || f.gen !== gen) return;                  // a newer file or height took over
  busy(null);
  if (m.type !== 'result') { f.error = m; fail(f, m); render(true); return; }   // the last good plans stay
  f.result = m; f.cutM = m.cutM; f.error = null;
  state.recutMs = performance.now() - t0;
  mark('recut', t0);
  ga('ifcp_recut', {});
  render(true);
}

// ---- rendering ----
function render(keepView = false) {
  const f = state.file;
  $('ipDropHint').hidden = !!f;
  $('ipClear').hidden = !f;
  const err = f && (f.error || (f.result && f.result.type !== 'result' ? f.result : null));
  $('ipError').hidden = !err;
  if (err) $('ipError').textContent = `${f.name}: ${errorText(err)}`;
  $('ipPanel').hidden = !ok(f);
  if (!ok(f)) { drawing.clear(); return; }
  renderStatus(f);
  renderTable(f);
  renderTabs();
  renderPreview(f, keepView);
  renderWarnings(f);
}

function errorText(r) {
  const reason = r.reason || 'engine';
  if (reason === 'read' && (r.detail === 'ifczip' || r.detail === 'ifcxml')) return t(`ip.err.read.${r.detail}`);
  if (reason === 'schema') return t('ip.err.schema', { schema: r.detail || '?' });
  return t(`ip.err.${['read', 'limit', 'timeout', 'engine', 'empty'].includes(reason) ? reason : 'engine'}`);
}

function shift(f) { return state.settings.origin ? originShift(f.result.file.bbox) : null; }
const names = f => storeyFileNames(f.result.storeys.map(s => s.name || (f.result.file.noStoreys ? stem(f.name) : '')), t('ip.storey.fallback'));
const storeyName = (f, i) => f.result.storeys[i].name || names(f)[i].replace(/^\d+ |\.dxf$/g, '');

function renderStatus(f) {
  const r = f.result, box = $('ipStatus');
  const parts = [r.file.schema, r.file.app, t('ip.sum.storeys', { n: r.storeys.length }), t('ip.sum.products', { n: r.file.products }), t('ip.sum.rooms', { n: r.file.rooms }), t('ip.sum.units', { units: state.settings.units })];
  const s = shift(f);
  if (s) parts.push(t('ip.sum.shift', { x: -s.x, y: -s.y }));
  box.replaceChildren(el('span', 'ip-file', f.name), ...parts.filter(Boolean).map(p => el('span', null, p)));
  $('ipRecutTime').hidden = state.recutMs == null;
  if (state.recutMs != null) $('ipRecutTime').textContent = t('ip.recut.time', { h: m2(f.cutM), s: (state.recutMs / 1000).toFixed(2).replace('.', lang() === 'en' ? '.' : ',') });
}

function renderTable(f) {
  const r = f.result, files = names(f);
  const rows = r.storeys.map((s, i) => {
    const tr = document.createElement('tr');
    tr.tabIndex = 0;
    tr.dataset.storey = String(i);
    tr.classList.toggle('is-sel', i === state.selected);
    tr.appendChild(el('td', 'dq-name', s.name || files[i].replace(/^\d+ |\.dxf$/g, '')));
    tr.appendChild(el('td', 'dq-num', m2(s.levelM)));
    const drawn = Object.keys(s.layers).length > 0 || s.rooms.length > 0;
    tr.appendChild(drawn ? el('td', 'dq-num', String(s.cut)) : el('td', 'dq-num ip-empty', t('ip.row.nothing', { h: m2(f.cutM) })));
    const missing = s.noGeometry.reduce((a, x) => a + x.count, 0);
    const mc = el('td', missing ? 'dq-num ip-warn' : 'dq-num', missing ? `⚠ ${missing}` : '0');
    if (missing) mc.title = s.noGeometry.map(x => `${x.type} ${x.count}`).join(', ');
    tr.appendChild(mc);
    tr.appendChild(el('td', 'dq-num', String(s.rooms.length)));
    const td = el('td');
    const b = el('button', 'gv-btn', t('ip.row.dxf'));
    b.type = 'button';
    b.dataset.dxf = String(i);
    b.setAttribute('aria-label', t('ip.row.dxf.aria', { name: files[i] }));
    b.addEventListener('click', e => { e.stopPropagation(); downloadStorey(i); });
    td.appendChild(b);
    tr.appendChild(td);
    // A row selects its storey in the plan and moves the cut in 3D.
    const pick = () => { if (state.selected !== i) { state.selected = i; renderTable(f); renderPreview(f, true); } };
    tr.addEventListener('click', pick);
    tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    return tr;
  });
  $('ipStoreys').tBodies[0].replaceChildren(...rows);
}

function renderPreview(f, keepView) {
  const r = f.result, s = r.storeys[state.selected];
  $('ipPreviewName').textContent = storeyName(f, state.selected);
  drawing.show(s, r.file.bbox, keepView);
  update3dCut(f);
  render3d();
  renderLegend(f);
}

// The legend: one toggle per layer of the view shown (the storey's plan; in 3D, the model's layers too). A toggle
// hides its layer in both views, never in the DXF.
function renderLegend(f) {
  const shown = new Set(drawing.layers);
  if (state.tab === '3d' && f.three && f.three.mesh) for (const n of Object.keys(f.three.mesh.layers)) shown.add(n);
  $('ipLegend').replaceChildren(...LEGEND_ORDER.filter(n => shown.has(n)).map(n => {
    const li = el('li');
    const b = el('button', 'ip-toggle');
    b.type = 'button';
    b.dataset.layer = n;
    b.setAttribute('aria-pressed', String(!state.hidden.has(n)));
    const sw = el('span', 'ip-swatch');
    sw.style.borderColor = LAYER_COLORS[n];
    b.append(sw, n);
    li.append(b);
    return li;
  }));
}
$('ipLegend').addEventListener('click', e => {
  const b = e.target.closest('[data-layer]');
  if (!b) return;
  const n = b.dataset.layer;
  if (state.hidden.has(n)) state.hidden.delete(n); else state.hidden.add(n);
  drawing.setHidden(state.hidden);
  if (view3d) view3d.setHidden(state.hidden);
  ga('ifcp_layer_toggle', { layer: n });
  if (ok(state.file)) renderLegend(state.file);
  $('ipLegend').querySelector(`[data-layer="${n}"]`).focus();
});

function renderWarnings(f) {
  const list = warningsOf(f.result, { fileName: f.name, cutM: f.cutM, origin: state.settings.origin });
  const ul = $('ipWarnings');
  if (!list.length) { ul.replaceChildren(el('li', 'gv-w is-ok', t('ip.warn.none'))); return; }
  ul.replaceChildren(...list.map(w => {
    const p = { ...w.params };
    if (w.id === 'nostoreys') p.h = m2(p.h);
    if (w.id === 'samelevel') p.levels = p.levels.map(v => `${m2(v)} m`).join(', ');
    const li = el('li', 'gv-w is-warn');
    li.dataset.warn = w.id;
    li.appendChild(el('span', null, t(`ip.warn.${w.id}`, p)));
    return li;
  }));
}

// ---- the tabs: «Κάτοψη» | «3D» ----
const TABS = ['plan', '3d'];
function renderTabs() {
  for (const tab of TABS) {
    const b = $(tab === 'plan' ? 'ipTabPlan' : 'ipTab3d'), on = state.tab === tab;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    $(tab === 'plan' ? 'ipPlanView' : 'ip3dView').hidden = !on;
  }
}
function selectTab(tab, focus = false) {
  if (focus) $(tab === 'plan' ? 'ipTabPlan' : 'ipTab3d').focus();
  if (state.tab === tab) return;
  state.tab = tab;
  $('ip3dTip').hidden = true;                                     // a tooltip from before the round trip is stale
  renderTabs();
  if (tab === '3d') open3d();
  if (ok(state.file)) renderLegend(state.file);
}
$('ipTabPlan').addEventListener('click', () => selectTab('plan'));
$('ipTab3d').addEventListener('click', () => selectTab('3d'));
$('ipTabs').addEventListener('keydown', e => {
  const i = TABS.indexOf(state.tab);
  const next = { ArrowRight: (i + 1) % TABS.length, ArrowLeft: (i + TABS.length - 1) % TABS.length, Home: 0, End: TABS.length - 1 }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  selectTab(TABS[next], true);
});

// ---- the 3D view ----
// The first open on a file: load view3d.js (and three.js) once, check WebGL2, ask the worker for the mesh with this
// device's triangle cap, and show it. A newer file meanwhile makes the answer moot.
async function open3d() {
  const f = state.file;
  if (!ok(f) || f.three) { render3d(); return; }
  const t0 = performance.now();
  const three = f.three = { status: 'loading', mesh: null, ga: false };
  render3d();
  let mod;
  try { mod = await (view3dModule || (view3dModule = import(`./view3d.js?v=20261003${view3dTries ? `#retry${view3dTries}` : ''}`))); }
  catch (e) {
    view3dModule = null; view3dTries++;  // the next 3D tab open retries, for this file too
    if (state.file === f && f.three === three) { done3d(f, 'failed'); f.three = null; }
    return;
  }
  if (state.file !== f || f.three !== three) return;
  if (!view3d) {
    if (!mod.hasWebGL2()) { done3d(f, 'nogl'); return; }
    try {
      view3d = mod.createView3d($('ip3dBox'), { onHover: hover3d, onLost: lost3d });
      view3d.setHidden(state.hidden);
      renderView3dLabel();
      window.__ifcp.view3d = view3d;
    } catch (e) { if (view3d) view3d.dispose(); view3d = null; window.__ifcp.view3d = null; done3d(f, 'nogl'); return; }
  }
  const cap = Number.isFinite(window.__ifcp.maxTriangles) ? window.__ifcp.maxTriangles
    : triangleCap({ coarse: window.matchMedia('(pointer: coarse)').matches, memoryGB: navigator.deviceMemory });
  const m = engine ? await engine.process('mesh3d', new ArrayBuffer(0), { mesh3d: true, maxTriangles: cap }) : { type: 'error', reason: 'engine' };
  if (state.file !== f || f.three !== three) return;              // a newer file took over
  if (m.type !== 'result') { done3d(f, m.reason === 'stale' ? 'stale' : 'failed'); return; }
  if (!m.mesh3d) { done3d(f, 'large'); return; }
  try {
    three.mesh = m.mesh3d;
    view3d.setMesh(m.mesh3d);
    three.status = 'shown';
    update3dCut(f);
  } catch (e) { three.mesh = null; done3d(f, 'failed'); return; }
  done3d(f, 'shown');
  requestAnimationFrame(() => mark('view3d', t0));                // after the view's first frame, drawn in this one
}

// The 3D outcome for this file: its note, and the GA event once per file (a stale model counts as failed).
function done3d(f, status) {
  f.three.status = status;
  if (!f.three.ga) { f.three.ga = true; ga('ifcp_view3d', { result: status === 'stale' ? 'failed' : status }); }
  render3d();
  renderLegend(f);
}

function lost3d() {
  const f = state.file;
  if (view3d) { view3d.dispose(); view3d = null; window.__ifcp.view3d = null; }
  $('ip3dTip').hidden = true;
  if (f && f.three) done3d(f, 'failed');
}

// The cut follows the selected storey and the cut height: one clipping plane at the storey's cut Z, its plan's lines
// drawn there. A re-cut only moves the plane; no new mesh.
function update3dCut(f) {
  if (!view3d || !f.three || f.three.status !== 'shown') return;
  const s = f.result.storeys[state.selected];
  view3d.setCut(state.cut3d ? s.cutZ : null, s);
}

function render3d() {
  const f = state.file;
  const status = f && f.three ? f.three.status : 'idle';
  const note = $('ip3dNote');
  const key = status === 'loading' ? 'ip.3d.loading' : ['large', 'nogl', 'stale', 'failed'].includes(status) ? `ip.3d.${status}` : null;
  note.hidden = !key;
  note.textContent = key ? t(key) : '';
  if (!ok(f)) return;
  const where = state.cut3d ? `${storeyName(f, state.selected)} · ${t('ip.3d.cutat', { h: m2(f.cutM) })}` : t('ip.3d.whole');
  $('ip3dHead').textContent = `${t('ip.tab.3d')} · ${where}`;
}
function renderView3dLabel() { if (view3d) view3d.canvas.setAttribute('aria-label', t(state.cut3d ? 'ip.aria.3d' : 'ip.aria.3d.whole')); }

function hover3d(index, x, y) {
  const tip = $('ip3dTip'), f = state.file;
  const e = index != null && ok(f) && f.three && f.three.mesh ? f.three.mesh.elements[index] : null;
  if (!e) { tip.hidden = true; return; }
  tip.textContent = tipParts(e, f.result.storeys).join(' · ');
  placeTip(tip, $('ip3dBox'), x, y);
}

// A tooltip next to the pointer (client x, y), kept inside boxEl: flipped to the left or above where it would overflow.
function placeTip(tip, boxEl, x, y) {
  const box = boxEl.getBoundingClientRect();
  tip.hidden = false;
  let left = x - box.left + 14, top = y - box.top + 14;
  if (left + tip.offsetWidth > box.width) left = Math.max(0, x - box.left - tip.offsetWidth - 10);
  if (top + tip.offsetHeight > box.height) top = Math.max(0, y - box.top - tip.offsetHeight - 10);
  tip.style.left = `${left}px`; tip.style.top = `${top}px`;
}

$('ip3dCut').addEventListener('change', e => {
  state.cut3d = e.target.checked;
  renderView3dLabel();
  if (ok(state.file)) { update3dCut(state.file); render3d(); }
  ga('ifcp_3d_cut', { on: state.cut3d });
});
$('ip3dView').addEventListener('click', e => {
  const b = e.target.closest('[data-preset]');
  if (b && view3d) view3d.preset(b.dataset.preset);
});
$('ip3dFit').addEventListener('click', () => { if (view3d) view3d.fit(); });

// ---- the plan preview ----
const drawing = createDrawing($('ipCanvas'), {
  onHover(layer, x, y) {
    const tip = $('ipTip');
    if (!layer) { tip.hidden = true; return; }
    tip.replaceChildren(el('b', null, `${t('ip.tip.layer')}: `), document.createTextNode(layer));
    placeTip(tip, $('ipCanvas'), x, y);
  },
});
window.__ifcp.drawing = drawing;
$('ipFit').addEventListener('click', () => drawing.fit());
$('ipZoomIn').addEventListener('click', () => drawing.zoomBy(1.25));
$('ipZoomOut').addEventListener('click', () => drawing.zoomBy(1 / 1.25));

// ---- downloads: every layer, whatever the legend hides ----
function save(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function dxfOf(f, i) {
  return storeyDxf({ storey: f.result.storeys[i], source: f.name, cutM: f.cutM, units: state.settings.units, shift: shift(f) }).bytes;
}
function downloadStorey(i) {
  const f = state.file;
  if (!ok(f)) return;
  save(new Blob([dxfOf(f, i)], { type: 'application/dxf' }), names(f)[i]);
  ga('ifcp_download', { what: 'storey', units: state.settings.units });
}
$('ipZip').addEventListener('click', () => {
  const f = state.file;
  if (!ok(f)) return;
  const files = uniqueNames(names(f)).map((name, i) => ({ name, bytes: dxfOf(f, i) }));
  save(new Blob([zipStore(files)], { type: 'application/zip' }), zipName(f.name));
  ga('ifcp_download', { what: 'zip', units: state.settings.units });
});

// ---- settings: remembered in this browser ----
function renderSettings() {
  const u = $('ipUnits');
  u.replaceChildren(...Object.keys(UNITS).map(k => { const o = el('option', null, t(`ip.unit.${k}`)); o.value = k; return o; }));
  u.value = state.settings.units;
  $('ipOrigin').checked = state.settings.origin;
  if (document.activeElement !== $('ipCut')) $('ipCut').value = m2(state.settings.cutM);
}
$('ipCut').addEventListener('change', e => {
  const v = parseCut(e.target.value);
  if (v === undefined) { e.target.setAttribute('aria-invalid', 'true'); return; }
  e.target.removeAttribute('aria-invalid');
  e.target.value = m2(v);
  if (v === state.settings.cutM) return;
  state.settings.cutM = v;
  saveSettings();
  recut(v);
});
$('ipUnits').addEventListener('change', e => {
  state.settings.units = e.target.value;
  saveSettings();
  if (ok(state.file)) renderStatus(state.file);
});
$('ipOrigin').addEventListener('change', e => {
  state.settings.origin = e.target.checked;
  saveSettings();
  if (ok(state.file)) { renderStatus(state.file); renderWarnings(state.file); }
});

// ---- inputs ----
async function readFile(file) {
  const my = ++latest;
  if (file.size > MAX_BYTES) { await loadFile(file.name, { byteLength: file.size }, 'file'); return; }   // refused before reading
  let bytes;
  try { bytes = await file.arrayBuffer(); }
  catch (e) {
    if (my !== latest) return;
    const f = { name: file.name, bytes: null, source: 'file', result: { type: 'error', reason: 'read' }, gen: 0, three: null };
    newFile(f);
    busy(null); fail(f); render();
    return;
  }
  if (my !== latest) return;
  await loadFile(file.name, bytes, 'file');
}
$('ipInput').addEventListener('change', async e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) await readFile(f); });
document.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('gv-dragging'); });
document.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('gv-dragging'); });
document.addEventListener('drop', async e => {
  e.preventDefault(); document.body.classList.remove('gv-dragging');
  const f = [...((e.dataTransfer && e.dataTransfer.files) || [])][0];
  if (f) await readFile(f);
});
$('ipExample').addEventListener('click', async () => {
  const t0 = performance.now();                                    // the example's time runs from the click
  const my = ++latest;
  let bytes;
  try {
    const r = await fetch(new URL(`./examples/${EXAMPLE}?v=20261003`, import.meta.url));
    if (!r.ok) throw new Error(String(r.status));
    bytes = await r.arrayBuffer();
  } catch (e) { if (my === latest) showBanner({ key: 'ip.example.failed' }); return; }
  if (my !== latest) return;
  await loadFile(EXAMPLE, bytes, 'example', t0);
});
$('ipClear').addEventListener('click', () => { latest++; newFile(null); busy(null); render(); });

// ---- CTA and survey ----
$('ipCta').addEventListener('click', () => ga('ifcp_cta_click', { where: 'page' }));
if (lsGet(SURVEY_KEY)) $('ipSurvey').hidden = true;
$('ipSurvey').addEventListener('click', e => {
  const b = e.target.closest('[data-answer]');
  if (!b) return;
  ga('ifcp_survey', { answer: b.dataset.answer });
  lsSet(SURVEY_KEY, b.dataset.answer);
  $('ipSurvey').querySelectorAll('[data-answer]').forEach(x => { x.disabled = true; });
  $('ipThanks').hidden = false;
});

// A language change re-renders everything built here (the preview keeps its view).
document.addEventListener('gv:lang', () => {
  if (state.banner) showBanner(state.banner);
  busy(state.busy);
  renderSettings();
  renderView3dLabel();
  $('ip3dTip').hidden = true; $('ipTip').hidden = true;           // built in the old language
  render(true);
});

renderSettings();
render();
