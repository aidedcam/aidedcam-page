// Page controller for gcode-viewer.html. DOM glue only; all maths lives in the pure modules, and the
// parts both viewers share (panel, selection, inputs, tables, i18n, storage) live in ./shell/.
import { analyze, MAX_LINES } from './analyze.js';
import { formatDuration } from './time.js';
import { segmentsByLine } from './render.js';
import { createDrawing } from './drawing.js';
import { EXAMPLE_PROGRAM } from './example.js';
import { DEFAULT_SETTINGS } from './settings.js';
import { t, ga, fmtNum, lang } from './shell/i18n.js';
import { lsGet, lsSet, loadStored, saveStored } from './shell/settings-store.js';
import { wireInputs, writeHandoff, takeHandoff } from './shell/loader.js';
import { createSelection } from './shell/selection.js';
import { createProgramPanel } from './shell/program-panel.js';
import { renderTimeRows, renderTotal, renderCheckList } from './shell/results.js';
import { renderBanner } from './shell/banner.js';

const $ = id => document.getElementById(id);
const SETTINGS_KEY = 'aidedcam-gv-settings';
const SURVEY_KEY = 'aidedcam-gv-survey';
// Reading sessionStorage can itself throw when a browser blocks storage; the handoff helpers accept null.
const session = () => { try { return window.sessionStorage; } catch (e) { return null; } };

// 'control' is always ignored: it is detected, never chosen, even if an older visit stored one.
const state = { text: '', fileName: '', result: null, byLine: new Map(), warnLines: new Set(),
  lastReadout: null, banner: null, editing: false,
  settings: loadStored(SETTINGS_KEY, { ...DEFAULT_SETTINGS, flipX: false }, { control: DEFAULT_SETTINGS.control }) };

function saveSettings() { saveStored(SETTINGS_KEY, state.settings, ['flipX', ...FIELDS.map(f => f[1])]); }

const drawing = createDrawing($('gvSvg'), {
  onHover: hoverFromDrawing, onPick: pickFromDrawing,
  checkText: (id, params) => t(`gv.check.${id}`, params),          // error marker <title>
  unitFactor: () => (state.result && state.result.units === 'inch' ? 25.4 : 1),
  fmtNumber: fmtNum,
});

const sel = createSelection({
  apply(line, scroll) {
    drawing.highlight(line ? (state.byLine.get(line) || []) : []);
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

// ---- pipeline ----
let timer = null;
function schedule() { clearTimeout(timer); timer = setTimeout(run, 200); }

function run(opts = {}) {
  // The whole pipeline is guarded: a throw anywhere shows the analysis-error banner.
  try {
    const r = analyze(state.text, state.settings);
    state.result = r;
    state.byLine = segmentsByLine(r.segments);
    state.warnLines = new Set(r.warnings.map(w => w.line));
    const milling = r.warnings.some(w => w.id === 'milling');
    showBanner(r.tooLarge ? { key: 'gv.banner.toolarge', params: { lines: r.lines.toLocaleString(), max: MAX_LINES.toLocaleString() } }
      : milling ? { key: 'gv.lathe.mill.q', action: { key: 'gv.lathe.mill.go', run: () => handoff('milling-gcode-viewer.html', 'mill') } }
      : null);
    showDetectedControl();
    drawing.update(r, { fit: !!opts.fit });                   // only a new program resets the view
    panel.setText(state.text);
    renderTime();
    renderChecks();
    renderPrintHead();
    $('gvDropHint').hidden = state.text.trim().length > 0;
    sel.reapply(panel.lineCount());
  } catch (err) {
    console.error(err);
    clearOnAnalysisError();
    showBanner({ key: 'gv.banner.error' });
  }
}

function clearOnAnalysisError() {
  state.result = null;
  state.byLine = new Map();
  state.warnLines = new Set();
  drawing.clear();
  panel.clear();
  $('gvTimeTable').tBodies[0].replaceChildren();
  $('gvTotal').textContent = '–';
  $('gvIncomplete').hidden = true;
  $('gvChecks').replaceChildren();
}

function showBanner(banner) { state.banner = banner; renderBanner($('gvBanner'), banner, t); }

// The program moves to the other viewer in sessionStorage (spec §2), never leaving the browser.
function handoff(page, to) {
  if (!writeHandoff(session(), state.text, state.fileName)) { showBanner({ key: 'gv.handoff.big' }); return; }
  ga('gcode_handoff', { from: 'lathe', to });                 // only a handoff that happened counts
  location.href = page;
}

function showDetectedControl() {
  if (state.result) $('gvControl').textContent = state.result.control === 'haas' ? 'Haas' : 'Fanuc';
}

function loadText(text, source, name = '') {
  state.text = String(text);
  state.fileName = name;
  sel.reset();                                   // a new program starts with no pin, hover or readout
  state.lastReadout = null;
  $('gvReadout').textContent = '';
  if (state.editing) $('gvEditor').value = state.text;
  run({ fit: true });
  if (!state.result) return;                    // run() already reported the analysis error
  if (source === 'example') ga('gcode_example_loaded', { machine: 'lathe' });
  else if (source === 'file' || source === 'paste') {
    ga('gcode_file_loaded', { lines: state.result.lines, cycles: state.result.cycles.length, control: state.result.control, machine: 'lathe' });
  }
}

function readoutText(line, p) {
  const k = state.result && state.result.units === 'inch' ? 1 / 25.4 : 1;
  const dia = state.settings.xDiameter;
  const xVal = (dia ? 2 : 1) * p.x * k;
  return t('gv.readout', { line: line ?? '–', xlabel: dia ? 'X' : 'X(r)', x: fmtNum(xVal, 3), z: fmtNum(p.z * k, 3) });
}

function hoverFromDrawing(segIndex, p, forcedLine) {
  if (sel.pinned !== null) return;                          // pinned: hover elsewhere is inert
  const seg = segIndex === null || !state.result ? null : state.result.segments[segIndex];
  const line = forcedLine != null ? forcedLine : (seg ? seg.line : null);   // a marker forces its own line
  sel.hover(line, true);
  state.lastReadout = p ? { line, x: p.x, z: p.z } : null;
  $('gvReadout').textContent = p ? readoutText(line, p) : '';
}

// A click or tap on the drawing: empty space clears the pin, a segment (or marker) pins its line.
function pickFromDrawing(segIndex, p, forcedLine) {
  if (forcedLine != null) {
    sel.pin(forcedLine);
    state.lastReadout = { line: forcedLine, x: p.x, z: p.z };
    $('gvReadout').textContent = readoutText(forcedLine, p);
    return;
  }
  if (segIndex === null || !state.result) { sel.clear(); return; }
  const seg = state.result.segments[segIndex];
  sel.pin(seg.line);
  state.lastReadout = { line: seg.line, x: p.x, z: p.z };
  $('gvReadout').textContent = readoutText(seg.line, p);
}

// ---- results ----
function renderTime() {
  const r = state.result;
  const inch = r.units === 'inch';
  const div = inch ? 25.4 : 1000;                           // cut length: m, or inches for inch programs
  $('gvLengthHeader').textContent = `${t('gv.time.length')} (${inch ? 'in' : 'm'})`;
  const timed = f => row => (row.incomplete ? null : formatDuration(f(row)));
  renderTimeRows($('gvTimeTable').tBodies[0], r.timing.rows, [
    row => row.tool || '–', row => row.label, row => String(row.cycles), row => String(row.passes),
    row => fmtNum(row.cutLength / div, 2),
    timed(row => row.cutSeconds), timed(row => row.rapidSeconds), timed(row => row.totalSeconds),
  ]);
  renderTotal($('gvTotal'), $('gvIncomplete'), r.timing, formatDuration);
}

function renderChecks() {
  renderCheckList($('gvChecks'), state.result.warnings, {
    text: w => t(`gv.check.${w.id}`, w.params),
    lineLabel: t('gv.checks.line'),
    noneText: t('gv.checks.none'),
    onLine: line => { if (state.editing) toggleEdit(); sel.pin(line, { toggle: false }); },
  });
}

function renderPrintHead() {
  const o = state.result.blocks.find(b => b.o !== null);
  $('gvPrintName').textContent = o ? `O${o.o}` : state.fileName;
  $('gvPrintDate').textContent = new Date().toLocaleDateString(lang());
}

// ---- editing ----
function toggleEdit() {
  state.editing = !state.editing;
  $('gvCode').hidden = state.editing;
  $('gvEditor').hidden = !state.editing;
  $('gvEdit').textContent = t(state.editing ? 'gv.done' : 'gv.edit');
  if (state.editing) { $('gvEditor').value = state.text; $('gvEditor').focus(); }
  else run();
}
$('gvEdit').addEventListener('click', toggleEdit);
$('gvEditor').addEventListener('input', e => { state.text = e.target.value; schedule(); });

// ---- input: file, example, paste, drop ----
wireInputs({
  fileInput: $('gvFile'), exampleButton: $('gvExample'), example: EXAMPLE_PROGRAM, pasteButton: $('gvPaste'),
  dropRoot: document.querySelector('.gv'), isEditing: () => state.editing,
  onText: loadText,
  onError: kind => showBanner({ key: kind === 'paste' ? 'gv.paste.fail' : 'gv.banner.error' }),
});

// ---- drawing controls ----
$('gvFit').addEventListener('click', () => drawing.fit());
$('gvZoomOut').addEventListener('click', () => drawing.zoomBy(1.25));
$('gvZoomIn').addEventListener('click', () => drawing.zoomBy(1 / 1.25));
$('gvAspect').addEventListener('change', e => drawing.setAspect(e.target.checked));
document.querySelectorAll('[data-layer]').forEach(cb => cb.addEventListener('change', () => drawing.setLayerVisible(cb.dataset.layer, cb.checked)));

// ---- settings ----
// No 'control' entry: it's detected, not chosen, and #gvControl is a read-only <output>.
const FIELDS = [
  ['gvSystem', 'system', v => v, v => v],
  ['gvInteger', 'integerUnit', v => v, v => v],
  ['gvXMode', 'xDiameter', v => v === 'dia', v => (v ? 'dia' : 'rad')],
  ['gvRapidX', 'rapidX', Number, v => v],
  ['gvRapidZ', 'rapidZ', Number, v => v],
  ['gvToolChange', 'toolChangeSeconds', Number, v => v],
  ['gvCorrection', 'correctionPct', Number, v => v],
];
// These three rescale the drawn geometry itself, so a change refits; the rest keep the view.
const REFIT_KEYS = new Set(['system', 'integerUnit', 'xDiameter']);
for (const [id, key, read, write] of FIELDS) {
  const input = $(id);
  input.value = write(state.settings[key]);
  input.addEventListener('change', () => {
    const v = read(input.value);
    const bad = typeof v === 'number' && (!Number.isFinite(v) || (key.startsWith('rapid') && v <= 0) || (key === 'toolChangeSeconds' && v < 0) || (key === 'correctionPct' && v <= -100));
    if (bad) { input.value = write(state.settings[key]); return; }
    state.settings[key] = v;
    saveSettings();
    run({ fit: REFIT_KEYS.has(key) });
  });
}
$('gvFlip').value = state.settings.flipX ? 'down' : 'up';
drawing.setFlip(state.settings.flipX);
$('gvFlip').addEventListener('change', () => { state.settings.flipX = $('gvFlip').value === 'down'; saveSettings(); drawing.setFlip(state.settings.flipX); });

// ---- print, CTA, survey ----
$('gvPrint').addEventListener('click', () => { renderPrintHead(); ga('gcode_print', { machine: 'lathe' }); window.print(); });
$('gvCta').addEventListener('click', () => ga('gcode_cta_click', { machine: 'lathe' }));
function surveyDone() {
  $('gvSurvey').querySelectorAll('.gv-chip').forEach(b => { b.hidden = true; });
  $('gvThanks').hidden = false;
}
if (lsGet(SURVEY_KEY)) surveyDone();
$('gvSurvey').querySelectorAll('.gv-chip').forEach(b => b.addEventListener('click', () => {
  ga('gcode_survey', { answer: b.dataset.answer, machine: 'lathe' });
  lsSet(SURVEY_KEY, '1');
  surveyDone();
}));

// ---- language changes re-render the dynamic text ----
document.addEventListener('gv:lang', () => {
  $('gvEdit').textContent = t(state.editing ? 'gv.done' : 'gv.edit');
  showBanner(state.banner);
  if (!state.result) return;
  renderTime(); renderChecks(); renderPrintHead();
  drawing.relabel();                                               // marker <title>s and tick labels
  showDetectedControl();
  if (state.lastReadout) $('gvReadout').textContent = readoutText(state.lastReadout.line, state.lastReadout);
});

// First paint: a program handed over from the milling page, else the example (no GA event).
const handed = takeHandoff(session());
if (handed) loadText(handed.text, 'handoff', handed.name);       // counted once, as gcode_handoff
else loadText(EXAMPLE_PROGRAM, 'init', 'example.nc');
