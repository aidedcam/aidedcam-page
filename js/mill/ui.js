// Page controller for milling-gcode-viewer.html. DOM glue only: the analysis runs in a Web Worker
// (worker.js), the drawing in view3d.js, and the parts both viewers share come from ../gcode/shell/.
import { MILL_DEFAULTS, MILL_MAX_LINES, MILL_MAX_CHARS } from './settings.js';
import { MILL_EXAMPLE } from './example.js';
import { movesOfLine } from './moves.js';
import { offsetTints } from './scene.js';
import { createView3d } from './view3d.js';
import { formatDuration } from '../gcode/time.js';
import { t, ga, fmtNum, lang } from '../gcode/shell/i18n.js';
import { lsGet, lsSet, loadStored, saveStored } from '../gcode/shell/settings-store.js';
import { wireInputs, writeHandoff, takeHandoff } from '../gcode/shell/loader.js';
import { createSelection } from '../gcode/shell/selection.js';
import { createProgramPanel } from '../gcode/shell/program-panel.js';
import { renderTimeRows, renderTotal, renderCheckList } from '../gcode/shell/results.js';
import { renderBanner } from '../gcode/shell/banner.js';

const $ = id => document.getElementById(id);
const SETTINGS_KEY = 'aidedcam-gm-settings';
const SURVEY_KEY = 'aidedcam-gm-survey';
const WORKER_URL = new URL('./worker.js?v=20261015', import.meta.url);
const TIMEOUT_MS = 20000;
const PLAY_RATE = 5000;                                   // moves per second (about 2 s per 10,000)
// Reading sessionStorage can itself throw when a browser blocks storage; the handoff helpers accept null.
const session = () => { try { return window.sessionStorage; } catch (e) { return null; } };

const state = { text: '', fileName: '', result: null, warnLines: new Set(), lastReadout: null,
  banner: null, editing: false, isoRow: null, playPos: 0, playing: false, playedOnce: false,
  settings: loadStored(SETTINGS_KEY, { ...MILL_DEFAULTS }) };

function saveSettings() { saveStored(SETTINGS_KEY, state.settings, FIELDS.map(f => f[1])); }

// ---- 3D view (optional: without WebGL the time table and checks still work) ----
let view = null;
try {
  view = createView3d($('gvView'), { onHover: hoverFromView, onPick: pickFromView });
  view.canvas.setAttribute('aria-label', t('gv.aria.view'));
} catch (err) {
  console.error(err);
}

const sel = createSelection({
  apply(line, scroll) {
    if (view) view.highlight(line && state.result ? movesOfLine(state.result.lineIndex, line) : []);
    if (scroll && line && !state.editing) panel.scrollToLine(line);
    panel.paint();
  },
  onClear() { state.lastReadout = null; $('gvReadout').textContent = ''; },
});
const panel = createProgramPanel($('gvCode'), {
  isHi: n => n === sel.line,
  hasWarn: n => state.warnLines.has(n),
  onOver: n => sel.hover(n, false),
  onLeave: () => sel.hover(null, false),
  onClick: n => sel.pin(n),
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sel.pinned !== null) sel.clear(); });

// ---- banner (shared renderer; kept as data so a language change re-renders it) ----
function showBanner(banner) { state.banner = banner; renderBanner($('gvBanner'), banner, t); }

// ---- analysis in the worker ----
let worker = null, jobId = 0, timeout = null;
function stopWorker() { if (worker) { worker.terminate(); worker = null; } clearTimeout(timeout); }

function analyze({ fit = false, onDone = () => {} } = {}) {
  stopWorker();
  const id = ++jobId;
  worker = new Worker(WORKER_URL, { type: 'module' });
  timeout = setTimeout(() => { if (id === jobId) { stopWorker(); failed(new Error('analysis timed out')); } }, TIMEOUT_MS);
  worker.onmessage = e => {
    const m = e.data;
    if (m.id !== id) return;
    if (m.type === 'progress') { showBanner({ key: 'gv.mill.progress', params: { pct: Math.min(100, Math.round((100 * m.done) / m.total)) } }); return; }
    stopWorker();
    if (m.type === 'result') {
      try { apply(m.result, fit); onDone(); } catch (err) { failed(err); }
    } else failed(new Error(m.message));
  };
  worker.onerror = e => { if (id === jobId) { stopWorker(); failed(e.error || new Error(e.message || 'worker error')); } };
  worker.postMessage({ type: 'analyze', id, text: state.text, settings: state.settings });
}

function failed(err) {
  console.error(err);
  state.result = null;
  state.warnLines = new Set();
  if (view) view.clear();
  panel.clear();
  $('gvTimeTable').tBodies[0].replaceChildren();
  $('gvTotal').textContent = '–';
  $('gvIncomplete').hidden = true;
  $('gvChecks').replaceChildren();
  $('gvDims').textContent = '';
  $('gvOffsets').hidden = true;
  state.isoRow = null;
  $('gvIsoHint').textContent = '';
  showBanner({ key: 'gv.banner.error' });
}

function apply(r, fit) {
  state.result = r;
  state.warnLines = new Set(r.warnings.map(w => w.line));
  state.isoRow = null;
  $('gvIsoHint').textContent = '';
  state.playing = false;
  state.playPos = r.moves.count;
  if (r.tooLarge) showBanner({ key: 'gv.banner.toolarge', params: { lines: r.lines.toLocaleString(), max: MILL_MAX_LINES.toLocaleString() } });
  else if (r.warnings.some(w => w.id === 'lathe-program')) showBanner({ key: 'gv.mill.lathe.q', action: { key: 'gv.mill.lathe.go', run: () => handoff('gcode-viewer.html', 'lathe') } });
  else if (!view) showBanner({ key: 'gv.mill.nowebgl' });
  else if (r.movesCapped) showBanner({ key: 'gv.mill.capped' });
  else showBanner(null);
  $('gvControl').textContent = r.control === 'haas' ? 'Haas' : 'Fanuc';
  if (view) view.setResult(r, { fit });
  panel.setText(state.text);
  renderTime();
  renderChecks();
  renderDims();
  renderOffsets();
  renderPrintHead();
  renderPlay();
  $('gvDropHint').hidden = state.text.trim().length > 0;
  sel.reapply(panel.lineCount());
}

function loadText(text, source, name = '') {
  state.text = String(text);
  state.fileName = name;
  sel.reset();
  state.lastReadout = null;
  $('gvReadout').textContent = '';
  if (state.editing) $('gvEditor').value = state.text;
  analyze({ fit: true, onDone: () => {
    if (source === 'example') ga('gcode_example_loaded', { machine: 'mill' });
    else if (source === 'file' || source === 'paste') {
      ga('gcode_file_loaded', { lines: state.result.lines, cycles: state.result.cycles, control: state.result.control, machine: 'mill' });
    }
  } });
}

function handoff(page, to) {
  if (!writeHandoff(session(), state.text, state.fileName)) { showBanner({ key: 'gv.handoff.big' }); return; }
  ga('gcode_handoff', { from: 'mill', to });                  // only a handoff that happened counts
  location.href = page;
}

// ---- view ↔ program ----
function readoutText(line, p) {
  const k = state.result && state.result.units === 'inch' ? 1 / 25.4 : 1;
  return t('gv.mill.readout', { line: line ?? '–', x: fmtNum(p.x * k, 3), y: fmtNum(p.y * k, 3), z: fmtNum(p.z * k, 3) });
}
function showReadout(line, p, marker) {
  state.lastReadout = p ? { line, p, marker } : null;
  const coords = p ? readoutText(line, p) : '';
  $('gvReadout').textContent = marker ? `${t(`gv.mcheck.${marker.id}`, {})} · ${coords}` : coords;
}
function hoverFromView(i, p, marker) {
  if (sel.pinned !== null || !state.result) return;
  const line = marker ? marker.line : (i === null ? null : state.result.moves.line[i]);
  sel.hover(line, true);
  showReadout(line, p, marker);
}
function pickFromView(i, p, marker) {
  if (!state.result) return;
  if (!marker && i === null) { sel.clear(); return; }
  const line = marker ? marker.line : state.result.moves.line[i];
  sel.pin(line);
  showReadout(line, p, marker);
}

// ---- results ----
function renderTime() {
  const r = state.result;
  const inch = r.units === 'inch', div = inch ? 25.4 : 1000;
  $('gvLengthHeader').textContent = `${t('gv.time.length')} (${inch ? 'in' : 'm'})`;
  const timed = f => row => (row.incomplete ? null : formatDuration(f(row)));
  const tbody = $('gvTimeTable').tBodies[0];
  renderTimeRows(tbody, r.timing.rows, [
    row => row.tool || '–', row => row.label, row => String(row.cycles),
    row => fmtNum(row.cutLength / div, 2),
    timed(row => row.cutSeconds), timed(row => row.rapidSeconds), timed(row => row.totalSeconds),
  ]);
  // Click (or Enter on) a row to show only that tool; again for all.
  [...tbody.rows].forEach((tr, i) => {
    tr.tabIndex = 0;
    tr.title = t('gv.mill.rowtip');
    tr.classList.toggle('is-iso', state.isoRow === i);
    const toggle = () => isolate(state.isoRow === i ? null : i);
    tr.addEventListener('click', toggle);
    tr.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); toggle(); } });
  });
  renderTotal($('gvTotal'), $('gvIncomplete'), r.timing, formatDuration);
}

function renderChecks() {
  renderCheckList($('gvChecks'), state.result.warnings, {
    text: w => (w.id === 'more' ? t('gv.mcheck.more', w.params) : t(`gv.mcheck.${w.id}`, w.params)),
    lineLabel: t('gv.checks.line'),
    noneText: t('gv.checks.none'),
    onLine: line => { if (state.editing) toggleEdit(); sel.pin(line, { toggle: false }); },
  });
}

function renderDims() {
  const r = state.result, b = r.cutBounds;
  if (!b) { $('gvDims').textContent = ''; return; }
  const inch = r.units === 'inch', k = inch ? 1 / 25.4 : 1;
  const size = a => fmtNum((b.max[a] - b.min[a]) * k, 2);
  $('gvDims').textContent = t('gv.mill.dims', { x: size(0), y: size(1), z: size(2), u: inch ? 'in' : 'mm' });
}

function renderOffsets() {
  const names = state.result.workOffsets, box = $('gvOffsets');
  box.replaceChildren();
  box.hidden = names.length < 2;
  if (names.length < 2) return;
  const tints = offsetTints(getComputedStyle(document.documentElement).getPropertyValue('--gv-feed').trim(), names.length);
  const label = document.createElement('span');
  label.textContent = t('gv.mill.offsets');
  box.appendChild(label);
  names.forEach((n, i) => {
    const s = document.createElement('span');
    s.className = 'gv-offset';
    const sw = document.createElement('i');
    sw.className = 'gv-swatch';
    sw.style.background = tints[i];
    s.append(sw, n);
    box.appendChild(s);
  });
}

function renderPrintHead() {
  const m = /^\s*O(\d+)/m.exec(state.text);
  $('gvPrintName').textContent = m ? `O${m[1]}` : state.fileName;
  $('gvPrintDate').textContent = new Date().toLocaleDateString(lang());
}

// ---- tool isolation and playback: both are draw ranges over the execution order ----
function drawRange() {
  const r = state.result;
  if (!r) return [0, 0];
  const row = state.isoRow === null ? null : r.timing.rows[state.isoRow];
  const start = row ? row.moveStart : 0, end = row ? row.moveEnd : r.moves.count;
  return [start, Math.min(end, Math.max(start, state.playPos))];
}
function applyRange() { if (view) view.setRange(...drawRange()); }

function isolate(i) {
  state.isoRow = i;
  const r = state.result;
  [...$('gvTimeTable').tBodies[0].rows].forEach((tr, j) => tr.classList.toggle('is-iso', j === i));
  $('gvIsoHint').textContent = i === null ? '' : t('gv.mill.isolated', { tool: r.timing.rows[i].tool || '–' });
  if (i !== null) state.playPos = r.timing.rows[i].moveEnd;
  else state.playPos = r.moves.count;
  applyRange();
  renderPlay();
}

function renderPlay() {
  const r = state.result, total = r ? r.moves.count : 0;
  const scrub = $('gvScrub');
  scrub.max = String(total);
  scrub.value = String(Math.min(total, Math.round(state.playPos)));
  $('gvPlayPos').textContent = t('gv.mill.playpos', { n: Math.min(total, Math.round(state.playPos)).toLocaleString(lang()), total: total.toLocaleString(lang()) });
  const btn = $('gvPlay');
  btn.textContent = state.playing ? '❚❚' : '▶';
  btn.setAttribute('aria-label', t(state.playing ? 'gv.mill.pause' : 'gv.mill.play'));
}

function followLine() {
  const r = state.result, i = Math.round(state.playPos) - 1;
  if (r && i >= 0 && i < r.moves.count && !state.editing) panel.scrollToLine(r.moves.line[i]);
}

let last = 0;
function tick(now) {
  if (!state.playing || !state.result) return;
  const dt = last ? (now - last) / 1000 : 0;
  last = now;
  const [start] = drawRange();
  const row = state.isoRow === null ? null : state.result.timing.rows[state.isoRow];
  const end = row ? row.moveEnd : state.result.moves.count;
  state.playPos = Math.max(state.playPos, start) + dt * PLAY_RATE;
  if (state.playPos >= end) { state.playPos = end; state.playing = false; }
  applyRange();
  followLine();
  renderPlay();
  if (state.playing) requestAnimationFrame(tick);
}
$('gvPlay').addEventListener('click', () => {
  const r = state.result;
  if (!r) return;
  const row = state.isoRow === null ? null : r.timing.rows[state.isoRow];
  const start = row ? row.moveStart : 0, end = row ? row.moveEnd : r.moves.count;
  state.playing = !state.playing;
  if (state.playing) {
    if (state.playPos >= end) state.playPos = start;          // at the end: play again from the start
    if (!state.playedOnce) { state.playedOnce = true; ga('gcode_playback'); }
    last = 0;
    requestAnimationFrame(tick);
  }
  renderPlay();
});
$('gvScrub').addEventListener('input', e => {
  state.playing = false;
  state.playPos = Number(e.target.value);
  applyRange();
  followLine();
  renderPlay();
});

// ---- editing ----
let timer = null;
function toggleEdit() {
  state.editing = !state.editing;
  $('gvCode').hidden = state.editing;
  $('gvEditor').hidden = !state.editing;
  $('gvEdit').textContent = t(state.editing ? 'gv.done' : 'gv.edit');
  if (state.editing) { $('gvEditor').value = state.text; $('gvEditor').focus(); }
  else analyze();
}
$('gvEdit').addEventListener('click', toggleEdit);
$('gvEditor').addEventListener('input', e => { state.text = e.target.value; clearTimeout(timer); timer = setTimeout(() => analyze(), 200); });

// ---- inputs ----
wireInputs({
  fileInput: $('gvFile'), exampleButton: $('gvExample'), example: MILL_EXAMPLE, pasteButton: $('gvPaste'),
  dropRoot: document.querySelector('.gv'), isEditing: () => state.editing,
  onText: loadText, maxBytes: MILL_MAX_CHARS,
  onError: kind => showBanner(kind === 'size' ? { key: 'gv.banner.filebig', params: { mb: Math.round(MILL_MAX_CHARS / 1048576) } }
    : { key: kind === 'paste' ? 'gv.paste.fail' : 'gv.banner.error' }),
});

// ---- view controls ----
$('gvFit').addEventListener('click', () => view && view.fit());
$('gvZoomOut').addEventListener('click', () => view && view.zoomBy(1 / 1.25));
$('gvZoomIn').addEventListener('click', () => view && view.zoomBy(1.25));
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
  if (!view) return;
  view.preset(b.dataset.view);
  ga('gcode_view_preset', { view: b.dataset.view });
}));
document.querySelectorAll('[data-layer]').forEach(cb => cb.addEventListener('change', () => view && view.setLayerVisible(cb.dataset.layer, cb.checked)));

// ---- settings ----
const FIELDS = [
  ['gvInteger', 'integerUnit', v => v, v => v],
  ['gvRapidX', 'rapidX', Number, v => v],
  ['gvRapidY', 'rapidY', Number, v => v],
  ['gvRapidZ', 'rapidZ', Number, v => v],
  ['gvToolChange', 'toolChangeSeconds', Number, v => v],
  ['gvCorrection', 'correctionPct', Number, v => v],
  ['gvPeck', 'peckClearance', Number, v => v],
];
for (const [id, key, read, write] of FIELDS) {
  const input = $(id);
  input.value = write(state.settings[key]);
  input.addEventListener('change', () => {
    const v = read(input.value);
    const bad = typeof v === 'number' && (!Number.isFinite(v) || (key.startsWith('rapid') && v <= 0) || ((key === 'toolChangeSeconds' || key === 'peckClearance') && v < 0) || (key === 'correctionPct' && v <= -100));
    if (bad) { input.value = write(state.settings[key]); return; }
    state.settings[key] = v;
    saveSettings();
    analyze({ fit: key === 'integerUnit' });                // µm ↔ mm rescales the part: refit
  });
}

// ---- print, CTA, survey ----
// The snapshot never carries a hover or pin highlight (as the lathe print hides .gv-hi).
function prepareShot() {
  if (!view || !state.result) return;
  view.highlight([]);
  $('gvShot').src = view.snapshot(2);
  view.highlight(sel.line ? movesOfLine(state.result.lineIndex, sel.line) : []);
}
window.addEventListener('beforeprint', () => { renderPrintHead(); prepareShot(); });
$('gvPrint').addEventListener('click', () => { renderPrintHead(); prepareShot(); ga('gcode_print', { machine: 'mill' }); window.print(); });
$('gvCta').addEventListener('click', () => ga('gcode_cta_click', { machine: 'mill' }));
function surveyDone() {
  $('gvSurvey').querySelectorAll('.gv-chip').forEach(b => { b.hidden = true; });
  $('gvThanks').hidden = false;
}
if (lsGet(SURVEY_KEY)) surveyDone();
$('gvSurvey').querySelectorAll('.gv-chip').forEach(b => b.addEventListener('click', () => {
  ga('gcode_survey', { answer: b.dataset.answer, machine: 'mill' });
  lsSet(SURVEY_KEY, '1');
  surveyDone();
}));

// ---- language changes re-render the dynamic text ----
document.addEventListener('gv:lang', () => {
  $('gvEdit').textContent = t(state.editing ? 'gv.done' : 'gv.edit');
  if (view) view.canvas.setAttribute('aria-label', t('gv.aria.view'));
  showBanner(state.banner);
  if (!state.result) return;
  renderTime(); renderChecks(); renderDims(); renderOffsets(); renderPrintHead(); renderPlay();
  if (state.isoRow !== null) $('gvIsoHint').textContent = t('gv.mill.isolated', { tool: state.result.timing.rows[state.isoRow].tool || '–' });
  if (state.lastReadout) showReadout(state.lastReadout.line, state.lastReadout.p, state.lastReadout.marker);
});

// First paint: a program handed over from the lathe page, else the example (no GA event).
const handed = takeHandoff(session());
if (handed) loadText(handed.text, 'handoff', handed.name);       // counted once, as gcode_handoff
else loadText(MILL_EXAMPLE, 'init', 'example.nc');
