// Page controller for gcode-viewer.html. DOM glue only; all maths lives in the pure modules.
import { analyze, MAX_LINES } from './analyze.js';
import { formatDuration } from './time.js';
import { segmentsByLine } from './render.js';
import { createDrawing } from './drawing.js';
import { EXAMPLE_PROGRAM } from './example.js';
import { DEFAULT_SETTINGS } from './settings.js';

const $ = id => document.getElementById(id);
const LINE_H = 20;                                        // px: must equal --gv-line-h in css/tools.css
const SETTINGS_KEY = 'aidedcam-gv-settings';
const SURVEY_KEY = 'aidedcam-gv-survey';

function lsGetSafe(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSetSafe(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
function loadSettings() {
  // 'control' is always ignored (item 6): even a value stored before this change must not override
  // detection.
  try { return { ...DEFAULT_SETTINGS, flipX: false, ...JSON.parse(lsGetSafe(SETTINGS_KEY) || '{}'), control: DEFAULT_SETTINGS.control }; }
  catch (e) { return { ...DEFAULT_SETTINGS, flipX: false }; }
}

const state = { text: '', fileName: '', result: null, byLine: new Map(), warnLines: new Set(),
  hoverLine: null, pinnedLine: null, lastReadout: null, showingError: false,
  editing: false, settings: loadSettings(), paint: () => {} };

// Only the fields a user can actually change (item 15): never an internal key such as arcSegments
// or oneLineRetract, so a returning visitor still gets any future default change to those.
function saveSettings() {
  const toSave = { flipX: state.settings.flipX };
  for (const [, key] of FIELDS) toSave[key] = state.settings[key];
  lsSetSafe(SETTINGS_KEY, JSON.stringify(toSave));
}
function lang() { return document.documentElement.lang || 'el'; }
function t(key, params = {}) {
  const all = window.GV_I18N || {};
  const s = (all[lang()] && all[lang()][key]) ?? (all.en && all.en[key]) ?? key;
  return String(s).replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? ''));
}
function ga(name, params) {
  try { if (typeof window.gaEvent === 'function') window.gaEvent(name, params || {}); } catch (e) { /* never break the tool */ }
}

// Locale-aware numbers (item 13): el-GR/it-IT use a decimal comma, en a point.
function localeOf() { return lang() === 'el' ? 'el-GR' : lang() === 'it' ? 'it-IT' : 'en-US'; }
function fmtNum(v, decimals) {
  return new Intl.NumberFormat(localeOf(), { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
}

const drawing = createDrawing($('gvSvg'), {
  onHover: hoverFromDrawing, onPick: pickFromDrawing,
  checkText: (id, params) => t(`gv.check.${id}`, params),          // error marker <title> (item 5)
  unitFactor: () => (state.result && state.result.units === 'inch' ? 25.4 : 1),   // R4: tick units
  fmtNumber: fmtNum,                                               // R4: tick labels use the same locale as the readout
});

// ---- pipeline ----
let timer = null;
function schedule() { clearTimeout(timer); timer = setTimeout(run, 200); }

function run(opts = {}) {
  // R10: the whole pipeline is guarded, not just analyze(). A throw from drawing.update/buildScene
  // etc. must reach this same analysis-error path regardless of which caller (paste included)
  // triggered it, rather than surfacing as that caller's own, unrelated error message.
  try {
    const r = analyze(state.text, state.settings);
    state.showingError = false;
    state.result = r;
    state.byLine = segmentsByLine(r.segments);
    state.warnLines = new Set(r.warnings.map(w => w.line));
    const milling = r.warnings.some(w => w.id === 'milling');
    showBanner(r.tooLarge ? t('gv.banner.toolarge', { lines: r.lines.toLocaleString(), max: MAX_LINES.toLocaleString() })
      : milling ? t('gv.check.milling') : '');
    showDetectedControl();
    // Only a new program resets the view (item 9); edits and settings changes keep the current pan/zoom.
    drawing.update(r, { fit: !!opts.fit });
    renderCode();
    renderTime();
    renderChecks();
    renderPrintHead();
    $('gvDropHint').hidden = state.text.trim().length > 0;
    reapplyPin();                                               // R1: keep, or drop, the pin across an edit/settings re-run
  } catch (err) {
    console.error(err);
    clearOnAnalysisError();
    state.showingError = true;                                  // R6: so gv:lang can retranslate this banner
    showBanner(t('gv.banner.error'));
  }
}

// Analysis threw: leave no stale drawing, tables or checks on screen (item 1, review item 3).
function clearOnAnalysisError() {
  state.result = null;
  state.byLine = new Map();
  state.warnLines = new Set();
  drawing.clear();
  $('gvCode').replaceChildren();
  $('gvTimeTable').tBodies[0].replaceChildren();
  $('gvTotal').textContent = '–';
  $('gvIncomplete').hidden = true;
  $('gvChecks').replaceChildren();
}

function showBanner(text) { const b = $('gvBanner'); b.textContent = text; b.hidden = !text; }

// The control is detected, not chosen (item 6, review item 9 ruling): a read-only name, so a wrong
// guess is visible (spec §4).
function showDetectedControl() {
  if (state.result) $('gvControl').textContent = state.result.control === 'haas' ? 'Haas' : 'Fanuc';
}

function loadText(text, source, name = '') {
  state.text = String(text);
  state.fileName = name;
  // A new program starts with no pin, no hover and no readout (R1): the old line number must not
  // stay highlighted, inert, in a program that may not even have that many lines.
  state.pinnedLine = null;
  state.hoverLine = null;
  state.lastReadout = null;
  $('gvReadout').textContent = '';
  if (state.editing) $('gvEditor').value = state.text;
  run({ fit: true });                            // a new program (file/example/paste/drop) resets the view (item 9)
  if (!state.result) return;                    // run() already reported the analysis error; no GA event
  if (source === 'example') ga('gcode_example_loaded');
  else if (source === 'file' || source === 'paste') {
    ga('gcode_file_loaded', { lines: state.result.lines, cycles: state.result.cycles.length, control: state.result.control });
  }
}

// ---- program panel: virtualised, only visible lines are in the DOM ----
function renderCode() {
  const box = $('gvCode');
  const lines = state.text.split(/\r\n?|\n/);
  const spacer = document.createElement('div');
  spacer.className = 'gv-code-spacer';
  spacer.style.height = `${lines.length * LINE_H}px`;
  const win = document.createElement('div');
  win.className = 'gv-code-window';
  spacer.appendChild(win);
  box.replaceChildren(spacer);
  state.paint = () => {
    const first = Math.max(0, Math.floor(box.scrollTop / LINE_H) - 20);
    const last = Math.min(lines.length, first + Math.ceil(box.clientHeight / LINE_H) + 40);
    win.style.transform = `translateY(${first * LINE_H}px)`;
    const frag = document.createDocumentFragment();
    for (let i = first; i < last; i++) {
      const n = i + 1;
      const row = document.createElement('div');
      row.className = 'gv-line' + (n === state.hoverLine ? ' is-hi' : '') + (state.warnLines.has(n) ? ' has-warn' : '');
      row.dataset.line = String(n);
      const no = document.createElement('span'); no.className = 'gv-no'; no.textContent = String(n);
      const tx = document.createElement('span'); tx.className = 'gv-tx'; tx.textContent = lines[i] || ' ';
      row.append(no, tx);
      frag.appendChild(row);
    }
    win.replaceChildren(frag);
  };
  state.paint();
}

$('gvCode').addEventListener('scroll', () => requestAnimationFrame(() => state.paint()));
$('gvCode').addEventListener('pointerover', e => {
  const row = e.target.closest && e.target.closest('.gv-line');
  if (row) highlightLine(Number(row.dataset.line), false);
});
$('gvCode').addEventListener('pointerleave', () => highlightLine(null, false));
// Clicking a program line pins its highlight (item 11, spec §2 "hovering or clicking").
$('gvCode').addEventListener('click', e => {
  const row = e.target.closest && e.target.closest('.gv-line');
  if (row) pinLine(Number(row.dataset.line));
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.pinnedLine !== null) clearPin(); });

// `pin: true` is the only way to change the highlight while a line is pinned; hover-origin calls
// (pointerover/pointerleave/onHover) are ignored until the pin is cleared (item 11).
function highlightLine(line, scroll, { pin = false } = {}) {
  if (state.pinnedLine !== null && !pin) return;
  state.hoverLine = line;
  drawing.highlight(line ? (state.byLine.get(line) || []) : []);
  if (scroll && line && !state.editing) {
    const box = $('gvCode');
    const top = (line - 1) * LINE_H;
    if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - LINE_H) box.scrollTop = Math.max(0, top - box.clientHeight / 3);
  }
  state.paint();
}

// toggle=true (code-panel and drawing clicks/taps, R1): clicking the already-pinned line unpins it,
// so touch users have a way out besides tapping empty drawing space. toggle=false (the checks'
// "Line N" button, R1): always pins that line, replacing any existing pin.
function pinLine(line, { toggle = true } = {}) {
  if (toggle && state.pinnedLine === line) { clearPin(); return; }
  state.pinnedLine = line;
  highlightLine(line, true, { pin: true });
}
function clearPin() { state.pinnedLine = null; highlightLine(null, false, { pin: true }); state.lastReadout = null; $('gvReadout').textContent = ''; }

// After an edit or a settings re-run (R1): keep the pin if that line still exists in the new text,
// otherwise clear it. A brand-new program (loadText) already cleared the pin before calling run(),
// so this is a no-op then.
function reapplyPin() {
  if (state.pinnedLine === null) return;
  const lineCount = state.text.split(/\r\n?|\n/).length;
  if (state.pinnedLine <= lineCount) highlightLine(state.pinnedLine, false, { pin: true });
  else clearPin();
}

function readoutText(line, p) {
  const k = state.result && state.result.units === 'inch' ? 1 / 25.4 : 1;
  const dia = state.settings.xDiameter;                       // item 14: X per the X-mode setting
  const xVal = (dia ? 2 : 1) * p.x * k;
  return t('gv.readout', { line: line ?? '–', xlabel: dia ? 'X' : 'X(r)', x: fmtNum(xVal, 3), z: fmtNum(p.z * k, 3) });
}

function hoverFromDrawing(segIndex, p, forcedLine) {
  if (state.pinnedLine !== null) return;                    // pinned: hover elsewhere is inert (item 11)
  // R8: a marker forces its own line; otherwise the nearest segment's, as before.
  const seg = segIndex === null || !state.result ? null : state.result.segments[segIndex];
  const line = forcedLine != null ? forcedLine : (seg ? seg.line : null);
  highlightLine(line, true);
  state.lastReadout = p ? { line, x: p.x, z: p.z } : null;
  $('gvReadout').textContent = p ? readoutText(line, p) : '';
}

// A click or tap on the drawing (item 3's tap-to-select, item 11's click-to-pin): empty space clears
// the pin, a segment pins its line. R8: a marker pins its own line, not the nearest segment's.
function pickFromDrawing(segIndex, p, forcedLine) {
  if (forcedLine != null) {
    pinLine(forcedLine);
    state.lastReadout = { line: forcedLine, x: p.x, z: p.z };
    $('gvReadout').textContent = readoutText(forcedLine, p);
    return;
  }
  if (segIndex === null || !state.result) { clearPin(); return; }
  const seg = state.result.segments[segIndex];
  pinLine(seg.line);
  state.lastReadout = { line: seg.line, x: p.x, z: p.z };
  $('gvReadout').textContent = readoutText(seg.line, p);
}

// ---- results ----
function cell(text) { const c = document.createElement('td'); c.textContent = text; return c; }

function renderTime() {
  const r = state.result;
  // Cut length (item 13): metric programs in m; inch programs in inches (spec §3.3: inch programs
  // are "converted on input and displayed in inches" - the same choice as the readout, not feet).
  const inch = r.units === 'inch';
  const div = inch ? 25.4 : 1000;
  $('gvLengthHeader').textContent = `${t('gv.time.length')} (${inch ? 'in' : 'm'})`;
  $('gvTimeTable').tBodies[0].replaceChildren(...r.timing.rows.map(row => {
    const tr = document.createElement('tr');
    // An incomplete row (item 7): "-" in the timed cells, and it doesn't contribute to the total.
    tr.append(cell(row.tool || '–'), cell(row.label), cell(String(row.cycles)), cell(String(row.passes)),
      cell(fmtNum(row.cutLength / div, 2)),
      cell(row.incomplete ? '–' : formatDuration(row.cutSeconds)),
      cell(row.incomplete ? '–' : formatDuration(row.rapidSeconds)),
      cell(row.incomplete ? '–' : formatDuration(row.totalSeconds)));
    return tr;
  }));
  const total = r.timing.rows.filter(row => !row.incomplete).reduce((a, row) => a + row.totalSeconds, 0);
  // R7: "≥" flags that the total leaves out every incomplete row's own time, not just this row's.
  $('gvTotal').textContent = (r.timing.incomplete ? '≥ ' : '') + formatDuration(total);
  $('gvIncomplete').hidden = !r.timing.incomplete;
}

function renderChecks() {
  const ul = $('gvChecks'), ws = state.result.warnings;
  if (!ws.length) {
    const li = document.createElement('li');
    li.className = 'gv-w is-ok';
    li.textContent = t('gv.checks.none');
    ul.replaceChildren(li);
    return;
  }
  // Loop-based, not a spread: a program with a warning on most of its (up to 300k) lines must not
  // overflow the call stack (item 20).
  const frag = document.createDocumentFragment();
  for (const w of ws) {
    const li = document.createElement('li');
    li.className = `gv-w is-${w.severity}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gv-w-line';
    btn.textContent = `${t('gv.checks.line')} ${w.line ?? '–'}`;
    // Pins (replacing any existing pin), it doesn't toggle: the link must always scroll and
    // highlight, even if that line happened to be the one already pinned (R1).
    btn.addEventListener('click', () => { if (!w.line) return; if (state.editing) toggleEdit(); pinLine(w.line, { toggle: false }); });
    const msg = document.createElement('span');
    msg.textContent = t(`gv.check.${w.id}`, w.params);
    li.append(btn, msg);
    frag.appendChild(li);
  }
  ul.replaceChildren(frag);
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
// Keyboard file open (item 2): Space already opens the dialog natively; add Enter for parity.
// Legacy Greek comments saved as Windows-1253 decode as U+FFFD under UTF-8 (item 16): fall back
// and re-decode the same bytes.
async function readFileText(f) {
  const buf = await f.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buf);
  return utf8.includes('�') ? new TextDecoder('windows-1253').decode(buf) : utf8;
}

// R11: a failed read (arrayBuffer/decode) is caught here, not left as an unhandled rejection - the
// same analysis-error banner, since from the visitor's chair "the file didn't load" is one thing.
async function loadFile(f, source) {
  let text;
  try { text = await readFileText(f); }
  catch (err) { console.error(err); state.showingError = true; showBanner(t('gv.banner.error')); return; }
  loadText(text, source, f.name);
}

$('gvFile').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); $('gvFile').click(); }
});
$('gvFile').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0];
  if (f) await loadFile(f, 'file');
  e.target.value = '';
});
$('gvExample').addEventListener('click', () => loadText(EXAMPLE_PROGRAM, 'example', 'example.nc'));
$('gvPaste').addEventListener('click', async () => {
  // R10: only the clipboard read is guarded here. loadText (and the run() it calls) has its own,
  // wider try/catch now, so an unrelated failure there shows the analysis-error banner, not this one.
  let txt;
  try { txt = await navigator.clipboard.readText(); }
  catch (e) { showBanner(t('gv.paste.fail')); return; }
  if (txt) loadText(txt, 'paste');
});
document.addEventListener('paste', e => {
  if (state.editing || (e.target.closest && e.target.closest('input, textarea, select'))) return;
  const txt = e.clipboardData && e.clipboardData.getData('text');
  if (txt) { e.preventDefault(); loadText(txt, 'paste'); }
});
// Drop anywhere on the page (item 12, spec §2): a file dropped on the nav or footer must be loaded,
// not opened by the browser as a navigation.
const main = document.querySelector('.gv');
document.addEventListener('dragover', e => { e.preventDefault(); main.classList.add('gv-dragging'); });
document.addEventListener('dragleave', e => { if (!e.relatedTarget) main.classList.remove('gv-dragging'); });
document.addEventListener('drop', async e => {
  e.preventDefault();
  main.classList.remove('gv-dragging');
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) await loadFile(f, 'file');
  else { const txt = e.dataTransfer.getData('text'); if (txt) loadText(txt, 'paste'); }
});

// ---- drawing controls ----
$('gvFit').addEventListener('click', () => drawing.fit());
$('gvZoomOut').addEventListener('click', () => drawing.zoomBy(1.25));
$('gvZoomIn').addEventListener('click', () => drawing.zoomBy(1 / 1.25));
$('gvAspect').addEventListener('change', e => drawing.setAspect(e.target.checked));
document.querySelectorAll('[data-layer]').forEach(cb => cb.addEventListener('change', () => drawing.setLayerVisible(cb.dataset.layer, cb.checked)));

// ---- settings ----
// No 'control' entry (item 6): it's detected, not chosen, and #gvControl is a read-only <output>.
const FIELDS = [
  ['gvSystem', 'system', v => v, v => v],
  ['gvInteger', 'integerUnit', v => v, v => v],
  ['gvXMode', 'xDiameter', v => v === 'dia', v => (v ? 'dia' : 'rad')],
  ['gvRapidX', 'rapidX', Number, v => v],
  ['gvRapidZ', 'rapidZ', Number, v => v],
  ['gvToolChange', 'toolChangeSeconds', Number, v => v],
  ['gvCorrection', 'correctionPct', Number, v => v],
];
// A change of these three rescales the drawn geometry itself (µm vs mm, radius vs diameter, or a
// dialect's own unit handling), leaving the part 1000x too small/large or off to one side until
// the user finds Fit; every other setting only changes numbers, so it keeps the current view (R9).
const REFIT_KEYS = new Set(['system', 'integerUnit', 'xDiameter']);
for (const [id, key, read, write] of FIELDS) {
  const input = $(id);
  input.value = write(state.settings[key]);
  input.addEventListener('change', () => {
    const v = read(input.value);
    const bad = typeof v === 'number' && (!Number.isFinite(v) || (key.startsWith('rapid') && v <= 0) || (key === 'toolChangeSeconds' && v < 0));
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
$('gvPrint').addEventListener('click', () => { renderPrintHead(); ga('gcode_print'); window.print(); });
$('gvCta').addEventListener('click', () => ga('gcode_cta_click'));
function surveyDone() {
  $('gvSurvey').querySelectorAll('.gv-chip').forEach(b => { b.hidden = true; });
  $('gvThanks').hidden = false;
}
if (lsGetSafe(SURVEY_KEY)) surveyDone();
$('gvSurvey').querySelectorAll('.gv-chip').forEach(b => b.addEventListener('click', () => {
  ga('gcode_survey', { answer: b.dataset.answer });
  lsSetSafe(SURVEY_KEY, '1');
  surveyDone();
}));

// ---- language changes re-render the dynamic text ----
document.addEventListener('gv:lang', () => {
  $('gvEdit').textContent = t(state.editing ? 'gv.done' : 'gv.edit');
  if (!state.result) {
    if (state.showingError) showBanner(t('gv.banner.error'));      // R6: the error banner has no result to hang the check on
    return;
  }
  renderTime(); renderChecks(); renderPrintHead();
  drawing.relabel();                                               // R6: marker <title>s and tick labels (units/locale, R4)
  if (state.result.tooLarge) showBanner(t('gv.banner.toolarge', { lines: state.result.lines.toLocaleString(), max: MAX_LINES.toLocaleString() }));
  else if (state.result.warnings.some(w => w.id === 'milling')) showBanner(t('gv.check.milling'));
  showDetectedControl();
  // Re-render the readout's numbers in the new language (item 13); it has no persistent state
  // otherwise, so this is a no-op when nothing is currently shown.
  if (state.lastReadout) $('gvReadout').textContent = readoutText(state.lastReadout.line, state.lastReadout);
});

// First paint: show the example so the page is never empty (no GA event for this one).
loadText(EXAMPLE_PROGRAM, 'init', 'example.nc');
