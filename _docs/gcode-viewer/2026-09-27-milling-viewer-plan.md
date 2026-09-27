# Milling G-code Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a free 3-axis milling G-code viewer (3D view, drilling cycles expanded, time per tool change, program checks, GR/EN/IT) and a free-tools index to www.aidedcam.com, next to the live lathe viewer, without changing how the lathe viewer behaves.

**Architecture:** Spec approach A.
- **Shared shell.** The page glue both viewers need moves out of the lathe `ui.js` into `js/gcode/shell/`: program panel, selection, inputs, tables, banner, i18n and storage. The viewer strings move into one shared classic script, `js/gcode/i18n-viewer.js`.
- **Milling engine.** A new pure engine in `js/mill/` streams each program line through the shared parser and writes typed arrays. It runs in a module Web Worker.
- **Drawing.** A self-hosted three.js orthographic view draws one line batch per layer. The pure `scene.js` builds the draw ranges and the screen-space pick grid.

**Tech Stack:**
- Plain ES modules, no build step, no npm dependencies.
- three.js 0.186.1, vendored.
- Web Worker (module).
- `node --test` for the pure modules; the Playwright MCP for the browser checks.
- A static GitHub Pages site.

**Spec:** `_docs/gcode-viewer/2026-09-27-milling-viewer-design.md`. It extends the lathe spec `_docs/gcode-viewer/2026-09-26-gcode-viewer-design.md`; anything the milling spec doesn't restate follows the lathe spec.

**Validated before writing:** every code block below was run in a scratch worktree of `feat/milling-viewer`.
- `node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js"`: 263 tests pass.
- A synthetic 1,000,000-line surfacing program analyses in 1.2–1.4 s in Node. In Chrome it goes from paste to first frame in 1.36 s; the longest main-thread frame was 163 ms.
- Task 19's browser checks were run and passed. The live lathe page's behaviour was re-checked after the refactor.

## Global Constraints

- **Public repo** (github.com/aidedcam/aidedcam-page): no client names, no real programs, and no values or labels copied from real programs in any committed file, test, doc or commit message. Real programs go only in the git-ignored `_tests/private/`.
- **No build, no npm dependencies.** three.js 0.186.1 is vendored under `js/vendor/three/` with its MIT `LICENSE`. There are no third-party requests except the consent-gated Google Analytics.
- **Privacy:** no program text or file names in GA events or in any request. The lathe ↔ milling handoff uses `sessionStorage` only.
- **Languages:** GR/EN/IT for every user-visible string. The Italian uses the formal "voi" and the typographic `’`. Every non-ASCII character is kept exact.
- **Colours:** data colours are ≥ 3:1 against `#ffffff` (the panel) and `#f4f3ee` (the paper). Monospace is used only in the program panel.
- **Layout at 375 px:** no horizontal page scroll; 16 px side gutter.
- **The live lathe viewer must not change behaviour**, except for what the spec adds: the handoff banner, the cross-link and the GA `machine` parameter.
- **Tests:** `node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js"` from the repo root. Quote the globs; on Node 24 a bare folder path doesn't work.
- **Cache-busting:** every new or changed asset URL carries `?v=20261015`, a placeholder; Task 20 replaces it with the deploy date.
- **Commits** end with the session trailer, copied verbatim:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
  ```
- **Whole files are extracted, never retyped.** A file shown in full is preceded by a line `<!-- file: <path> -->`. Write it with `node _tests/extract.mjs <brief-or-plan-file> <path>`, and check it with the same command plus `--check`. The helper comes from Task 0. Retyping long files that contain Greek and Italian corrupted characters in the lathe build.
- **Never push, merge or amend.** Pushing `main` publishes the live site, and only Aris decides that.

## Review Focus

Inputs real programs send that the spec doesn't spell out, most likely first, each pinned by a test:

1. **Next-tool preselect.** `T1 M6` followed at once by `T2`, and later a bare `M6`. The rows and the H check must follow the tool actually loaded. *Task 9, `machine.test.js`: "next-tool preselect".*
2. **Rotary words that never move.** `A0.` in a 3-axis safe-start line must not raise `unsupported` or blank the row's time; an A value that changes must. *Task 9: "rotary words that never move".*
3. **Messy formatting.** Lowercase, glued words, tabs, `;` comments and CRLF read the same as tidy code. *Task 9: "messy formatting".*
4. **Garbage input.** A binary file opened by mistake gives an empty result, never a throw; an oversized file gives the too-large result. *Task 9: "garbage input" and `analyze.test.js` "too large"; Task 19 checks the 1M-line file in the browser.*
5. **Multi-part programs with several work offsets.** No rapid is drawn across offsets, each offset gets its own tint, and every tint passes contrast. *Task 9: "new work offset makes the position unknown"; Task 13: tint contrast; Task 19: visual check.*

## Spec refinements made while validating this plan

Each one is small, recorded here so the reviewers can check it against the spec:
- **Cross-link placement.** The link to the other viewer sits in each page's header, not next to "Home" in the nav (spec §2). On phones the nav hides the back link, so a second nav link would crowd or vanish.
- **Time rows.** `MillResult` keeps its rows in `timing: { rows, total, incomplete }`, like the lathe result, so the shared renderers take either. Spec §3.3 lists them at the top level.
- **Extra check ids.**
  - `cycle-no-start` (warn): a cycle starts before Z is known, so it is drawn from R.
  - `main-m99` (info): spec §4 asks for "an info note" when M99 ends the main program.
  - A `more` summary entry when an id passes 200 warnings.
- **Rotary and extra axis words (A/B/C/U/V/W).** The first value only sets the reference; a change raises `unsupported`. Spec §4 lists them as not interpreted, but a parked `A0.` is not a move.
- **Camera.** The view is orthographic, which gives true Top/Front/Right views and simpler fit and picking. The visible width is clamped to 1e-3…1e6 mm, the lesson from the lathe's deep-zoom hang (fix R3).
- **Tapping aliases.** `G84.2`/`G84.3` are read as `G84`/`G74`.
- **Haas-only codes.** On the milling page, Haas G12/G13 (circular pocket), G47 (engraving), G150 (pocket), and bolt patterns G70/G71/G72 are flagged `unsupported`.

## File structure

| Path | Task | Responsibility |
|---|---|---|
| `_tests/extract.mjs` | 0 | Writes or checks one whole-file block from a brief |
| `js/gcode/shell/i18n.js` | 1 | `t()`, `lang()`, `fmtNum()`, `ga()` |
| `js/gcode/shell/settings-store.js` | 1 | Safe localStorage, settings load and save |
| `js/gcode/shell/loader.js` | 1 | File/example/paste/drop inputs, windows-1253 fallback, handoff |
| `js/gcode/shell/selection.js` | 1 | Hover and pin state machine (pure) |
| `js/gcode/shell/program-panel.js` | 1 | Virtualised program list |
| `js/gcode/shell/results.js` | 1 | Time table, total, checks list |
| `js/gcode/shell/banner.js` | 1 | Status banner with an optional action |
| `js/gcode/i18n-viewer.js` | 2, 3 | Shared viewer strings (classic script) |
| `gcode-viewer.html` | 2, 4 | Lathe page: strings split out; cross-link; `?v` |
| `js/gcode/ui.js` | 4 | Lathe controller on the shell; handoff; GA `machine` |
| `_docs/gcode-viewer/mill-cycles/*.md` | 5 | Research notes |
| `js/mill/settings.js`, `moves.js`, `time.js` | 6 | Defaults and limits, typed move buffer, time model |
| `js/mill/arcs.js` | 7 | G17/G18/G19 arcs, helical, radius check |
| `js/mill/cycles.js` | 8 | One hole → moves |
| `js/mill/machine.js`, `subprograms.js`, `checks.js`, `analyze.js` | 9 | Modal state, call stack, warnings, pipeline |
| `js/mill/example.js` | 10 | Synthetic example |
| `js/mill/worker.js`, `_tests/mill/perf.mjs` | 11 | Worker wrapper; 1M-line timing |
| `js/mill/scene.js` | 12 | Layers, draw ranges, pick grid, tints |
| `js/vendor/three/**` | 13 | three.js 0.186.1 and four add-ons |
| `js/mill/view3d.js` | 14 | three.js view |
| `css/tools.css` | 15 | Milling and index styles (appended) |
| `milling-gcode-viewer.html` | 16 | Milling page |
| `js/mill/ui.js` | 17 | Milling controller |
| `free-tools.html`, `index.html`, `sitemap.xml`, `llms.txt` | 18 | Tools index and links |
| `_tests/gcode/*.test.js`, `_tests/mill/*.test.js` | across | Node suites |

---

### Task 0: Branch check and the extraction helper

**Files:**
- Create: `_tests/extract.mjs`

**Interfaces:**
- Produces: `node _tests/extract.mjs <brief> <path> [--check]`, which every later task uses to write or verify whole files.

- [ ] **Step 1: Check the starting point**

Run: `git branch --show-current && git log --oneline -1 && node --test "_tests/gcode/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected:
- the branch is `feat/milling-viewer`, and HEAD is `dd53507 Milling G-code viewer: design spec`;
- the output ends with `ℹ pass 155` and `ℹ fail 0`.

- [ ] **Step 2: Write the helper**

This one file is typed, not extracted: the extractor can't extract itself. It is plain ASCII.

<!-- file: _tests/extract.mjs -->
```js
// Writes (or, with --check, compares) one whole-file block from a plan or task brief: the fenced
// code right after the line "<!-- file: <path> -->". Run from the repo root:
//   node _tests/extract.mjs <brief.md> <path>            write the file
//   node _tests/extract.mjs <brief.md> <path> --check    exit 1 if the file differs from the block
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [brief, path, flag] = process.argv.slice(2);
const text = readFileSync(brief, 'utf8').replace(/\r\n/g, '\n');
const marker = `<!-- file: ${path} -->\n`;
const at = text.indexOf(marker);
if (at < 0) { console.error(`no block for ${path} in ${brief}`); process.exit(2); }
const fence = text.indexOf('```', at + marker.length);
const open = text.indexOf('\n', fence) + 1;
const close = text.indexOf('\n```\n', open - 1);
const body = text.slice(open, close + 1);

if (flag === '--check') {
  const cur = existsSync(path) ? readFileSync(path, 'utf8').replace(/\r\n/g, '\n') : null;
  if (cur !== body) { console.error(`${path} differs from the block in ${brief}`); process.exit(1); }
  console.log(`${path} matches`);
} else {
  mkdirSync(dirname(path) || '.', { recursive: true });
  writeFileSync(path, body);
  console.log(`wrote ${path} (${body.split('\n').length - 1} lines)`);
}
```

- [ ] **Step 3: Check it on its own block**

Run: `node _tests/extract.mjs <this brief file> _tests/extract.mjs --check`
Expected: `_tests/extract.mjs matches`. A typing slip shows up here as `differs`; fix it and re-run.

- [ ] **Step 4: Commit**

```bash
git add _tests/extract.mjs
git commit -F - <<'EOF'
Milling viewer: whole-file extraction helper for the plan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 1: Shared shell modules

**Files:**
- Create: `js/gcode/shell/i18n.js`, `settings-store.js`, `loader.js`, `selection.js`, `program-panel.js`, `results.js` and `banner.js`
- Test: `_tests/gcode/shell.test.js`

**Interfaces:**
- Produces, used by the lathe controller (Task 4) and the milling controller (Task 17):
  - `i18n.js`: `lang()`, `t(key, params)`, `ga(name, params)`, `localeOf()`, `fmtNum(v, decimals)`.
  - `settings-store.js`: `lsGet(k)`, `lsSet(k, v)`, `loadStored(key, defaults, overrides)`, `saveStored(key, settings, keys)`.
  - `loader.js`: `readFileText(file)` returns a Promise of a string; `wireInputs({ fileInput, exampleButton, example, pasteButton, dropRoot, isEditing, onText(text, source, name), onError(kind) })`; `HANDOFF_KEY`, `HANDOFF_MAX_CHARS`, `writeHandoff(storage, text, name)` returns a boolean; `takeHandoff(storage)` returns `{ text, name }` or null.
  - `selection.js`: `createSelection({ apply(line, scroll), onClear })` returns `{ pinned, line, hover(line, scroll), pin(line, { toggle }), clear(), reset(), reapply(lineCount) }`.
  - `program-panel.js`: `LINE_H = 20`; `createProgramPanel(box, { isHi, hasWarn, onOver, onLeave, onClick })` returns `{ setText, clear, lineCount, paint, scrollToLine }`.
  - `results.js`: `renderTimeRows(tbody, rows, columns)`, where a column returning null renders "–"; `renderTotal(totalEl, noteEl, timing, formatDuration)`; `renderCheckList(ul, warnings, { text, lineLabel, noneText, onLine })`.
  - `banner.js`: `renderBanner(el, banner, t)`, where a banner is `{ key, params?, action?: { key, run } }` or null.

These are the lathe `ui.js` pieces, lifted out with their behaviour unchanged (compare them with the current `js/gcode/ui.js`). Only `selection.js` gains a public shape of its own: the lathe's `pinnedLine`/`hoverLine`/`highlightLine`/`pinLine`/`clearPin`/`reapplyPin` became one pure state machine.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/gcode/shell.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSelection } from '../../js/gcode/shell/selection.js';
import { readFileText, writeHandoff, takeHandoff, HANDOFF_KEY, HANDOFF_MAX_CHARS } from '../../js/gcode/shell/loader.js';

function track() {
  const calls = [];
  let cleared = 0;
  const sel = createSelection({ apply: (line, scroll) => calls.push([line, scroll]), onClear: () => { cleared++; } });
  return { sel, calls, cleared: () => cleared };
}

test('hover highlights while nothing is pinned; a pin blocks hover until cleared', () => {
  const { sel, calls } = track();
  assert.equal(sel.hover(5), true);
  sel.pin(7);
  assert.equal(sel.hover(9), false);
  assert.equal(sel.line, 7);
  sel.clear();
  assert.equal(sel.hover(9, true), true);
  assert.deepEqual(calls, [[5, false], [7, true], [null, false], [9, true]]);
});

test('clicking the pinned line again unpins it; a check link (toggle: false) always pins', () => {
  const { sel, cleared } = track();
  sel.pin(4);
  sel.pin(4);
  assert.equal(sel.pinned, null);
  assert.equal(cleared(), 1);
  sel.pin(4, { toggle: false });
  sel.pin(4, { toggle: false });
  assert.equal(sel.pinned, 4);
});

test('a new program resets silently; a re-run keeps the pin only if its line still exists', () => {
  const { sel, calls } = track();
  sel.pin(12);
  sel.reapply(20);
  assert.equal(sel.pinned, 12);
  sel.reapply(10);
  assert.equal(sel.pinned, null);
  sel.pin(3);
  const before = calls.length;
  sel.reset();
  assert.equal(calls.length, before);                       // reset draws nothing
  assert.equal(sel.pinned, null);
  assert.equal(sel.line, null);
});

test('readFileText: UTF-8 as is; Greek Windows-1253 bytes fall back instead of showing U+FFFD', async () => {
  const utf8 = { arrayBuffer: async () => new TextEncoder().encode('(ΕΚΧΟΝΔΡΩΣΗ)\nT0101').buffer };
  assert.equal(await readFileText(utf8), '(ΕΚΧΟΝΔΡΩΣΗ)\nT0101');
  const cp1253 = Uint8Array.from([0x28, 0xc5, 0xca, 0xd7, 0xcf, 0xcd, 0x29]);  // "(ΕΚΧΟΝ)" in Windows-1253
  assert.equal(await readFileText({ arrayBuffer: async () => cp1253.buffer }), '(ΕΚΧΟΝ)');
});

test('handoff: stored once, read once, removed; too large is refused; junk is ignored', () => {
  const mem = new Map();
  const storage = { setItem: (k, v) => mem.set(k, v), getItem: k => mem.get(k) ?? null, removeItem: k => mem.delete(k) };
  assert.equal(writeHandoff(storage, 'G0 X0', 'a.nc'), true);
  assert.deepEqual(takeHandoff(storage), { text: 'G0 X0', name: 'a.nc' });
  assert.equal(takeHandoff(storage), null);
  assert.equal(writeHandoff(storage, 'x'.repeat(HANDOFF_MAX_CHARS + 1), 'big.nc'), false);
  mem.set(HANDOFF_KEY, '{not json');
  assert.equal(takeHandoff(storage), null);
  assert.equal(mem.has(HANDOFF_KEY), false);
  const blocked = { setItem() { throw new Error('quota'); }, getItem() { throw new Error('blocked'); }, removeItem() {} };
  assert.equal(writeHandoff(blocked, 'G0', ''), false);
  assert.equal(takeHandoff(blocked), null);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test "_tests/gcode/shell.test.js"`
Expected: FAIL with `Cannot find module '…/js/gcode/shell/selection.js'`.

- [ ] **Step 3: Write the seven modules**

<!-- file: js/gcode/shell/i18n.js -->
```js
// Shared by both viewers: translation lookup, locale number formatting, and the consent-gated GA
// helper. Strings come from window.GV_I18N, which each page builds from the shared viewer strings
// (js/gcode/i18n-viewer.js) and its own inline keys.
export function lang() { return document.documentElement.lang || 'el'; }

export function t(key, params = {}) {
  const all = window.GV_I18N || {};
  const s = (all[lang()] && all[lang()][key]) ?? (all.en && all.en[key]) ?? key;
  return String(s).replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? ''));
}

export function ga(name, params) {
  try { if (typeof window.gaEvent === 'function') window.gaEvent(name, params || {}); } catch (e) { /* never break the tool */ }
}

// el-GR and it-IT use a decimal comma, en a point.
export function localeOf() { return lang() === 'el' ? 'el-GR' : lang() === 'it' ? 'it-IT' : 'en-US'; }

export function fmtNum(v, decimals) {
  return new Intl.NumberFormat(localeOf(), { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
}
```

<!-- file: js/gcode/shell/settings-store.js -->
```js
// Shared by both viewers: localStorage that never throws (private mode, blocked storage), and
// settings persistence that stores only the fields a user can change.
export function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
export function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }

// defaults, then whatever was stored, then overrides that must always win.
export function loadStored(key, defaults, overrides = {}) {
  try { return { ...defaults, ...JSON.parse(lsGet(key) || '{}'), ...overrides }; }
  catch (e) { return { ...defaults, ...overrides }; }
}

export function saveStored(key, settings, keys) {
  const out = {};
  for (const k of keys) out[k] = settings[k];
  lsSet(key, JSON.stringify(out));
}
```

<!-- file: js/gcode/shell/loader.js -->
```js
// Shared by both viewers: every way a program gets in (file, keyboard, example, paste button,
// Ctrl+V, drop anywhere), the Greek legacy-encoding fallback, and the lathe ↔ milling handoff.

// Greek comments saved as Windows-1253 decode as U+FFFD under UTF-8: re-decode the same bytes.
export async function readFileText(f) {
  const buf = await f.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buf);
  return utf8.includes('�') ? new TextDecoder('windows-1253').decode(buf) : utf8;
}

// onText(text, source, name) with source 'file' | 'example' | 'paste'. onError(kind) with kind
// 'read' (a file couldn't be read) or 'paste' (the browser refused the clipboard read).
export function wireInputs({ fileInput, exampleButton, example, pasteButton, dropRoot, isEditing, onText, onError }) {
  async function loadFile(f) {
    let text;
    try { text = await readFileText(f); }
    catch (err) { console.error(err); onError('read'); return; }
    onText(text, 'file', f.name);
  }
  // Space opens the file dialog natively; Enter too, for parity with buttons.
  fileInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fileInput.click(); } });
  fileInput.addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0];
    if (f) await loadFile(f);
    e.target.value = '';
  });
  exampleButton.addEventListener('click', () => onText(example, 'example', 'example.nc'));
  pasteButton.addEventListener('click', async () => {
    let txt;
    try { txt = await navigator.clipboard.readText(); }       // only the clipboard read is guarded here
    catch (e) { onError('paste'); return; }
    if (txt) onText(txt, 'paste', '');
  });
  document.addEventListener('paste', e => {
    if (isEditing() || (e.target.closest && e.target.closest('input, textarea, select'))) return;
    const txt = e.clipboardData && e.clipboardData.getData('text');
    if (txt) { e.preventDefault(); onText(txt, 'paste', ''); }
  });
  // Drop anywhere: a file dropped on the nav or footer must load, not navigate away.
  document.addEventListener('dragover', e => { e.preventDefault(); dropRoot.classList.add('gv-dragging'); });
  document.addEventListener('dragleave', e => { if (!e.relatedTarget) dropRoot.classList.remove('gv-dragging'); });
  document.addEventListener('drop', async e => {
    e.preventDefault();
    dropRoot.classList.remove('gv-dragging');
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) await loadFile(f);
    else { const txt = e.dataTransfer.getData('text'); if (txt) onText(txt, 'paste', ''); }
  });
}

// ---- lathe ↔ milling handoff (spec §2): the program moves between the two pages in
// sessionStorage, so it never leaves the browser. The storage object is a parameter so Node can
// test this with a stand-in.
export const HANDOFF_KEY = 'aidedcam-gv-handoff';
export const HANDOFF_MAX_CHARS = 4 * 1024 * 1024;

export function writeHandoff(storage, text, name) {
  if (text.length > HANDOFF_MAX_CHARS) return false;
  try { storage.setItem(HANDOFF_KEY, JSON.stringify({ text, name })); return true; }
  catch (e) { return false; }
}

export function takeHandoff(storage) {
  let raw = null;
  try { raw = storage.getItem(HANDOFF_KEY); storage.removeItem(HANDOFF_KEY); } catch (e) { return null; }
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v.text === 'string' ? { text: v.text, name: typeof v.name === 'string' ? v.name : '' } : null;
  } catch (e) { return null; }
}
```

<!-- file: js/gcode/shell/selection.js -->
```js
// Shared by both viewers: which program line is highlighted, and whether it is pinned. Pure (no
// DOM): apply(line | null, scroll) does the drawing; onClear() runs when a pin is dropped.
// Hover changes the highlight only while nothing is pinned. Clicking the pinned line again
// unpins it (toggle), so touch users have a way out; a check's "Line N" link always pins.
export function createSelection({ apply, onClear = () => {} }) {
  let pinned = null, current = null;
  const set = (line, scroll) => { current = line; apply(line, scroll); };
  const sel = {
    get pinned() { return pinned; },
    get line() { return current; },
    hover(line, scroll = false) {
      if (pinned !== null) return false;
      set(line, scroll);
      return true;
    },
    pin(line, { toggle = true } = {}) {
      if (toggle && pinned === line) { sel.clear(); return; }
      pinned = line;
      set(line, true);
    },
    clear() { pinned = null; set(null, false); onClear(); },
    // A new program: no pin and no hover, without drawing anything.
    reset() { pinned = null; current = null; },
    // After an edit or a settings re-run: keep the pin if the line still exists.
    reapply(lineCount) {
      if (pinned === null) return;
      if (pinned <= lineCount) set(pinned, false);
      else sel.clear();
    },
  };
  return sel;
}
```

<!-- file: js/gcode/shell/program-panel.js -->
```js
// Shared by both viewers: the virtualised program panel. Only the visible lines (plus a margin)
// are in the DOM, so a 1M-line program scrolls as smoothly as a short one.
export const LINE_H = 20;                                 // px: must equal --gv-line-h in css/tools.css

// isHi(n) / hasWarn(n) style a line; onOver(n), onLeave(), onClick(n) report pointer use.
export function createProgramPanel(box, { isHi, hasWarn, onOver, onLeave, onClick }) {
  let lines = [''];
  const spacer = document.createElement('div');
  spacer.className = 'gv-code-spacer';
  const win = document.createElement('div');
  win.className = 'gv-code-window';
  spacer.appendChild(win);

  function paint() {
    const first = Math.max(0, Math.floor(box.scrollTop / LINE_H) - 20);
    const last = Math.min(lines.length, first + Math.ceil(box.clientHeight / LINE_H) + 40);
    win.style.transform = `translateY(${first * LINE_H}px)`;
    const frag = document.createDocumentFragment();
    for (let i = first; i < last; i++) {
      const n = i + 1;
      const row = document.createElement('div');
      row.className = 'gv-line' + (isHi(n) ? ' is-hi' : '') + (hasWarn(n) ? ' has-warn' : '');
      row.dataset.line = String(n);
      const no = document.createElement('span'); no.className = 'gv-no'; no.textContent = String(n);
      const tx = document.createElement('span'); tx.className = 'gv-tx'; tx.textContent = lines[i] || ' ';
      row.append(no, tx);
      frag.appendChild(row);
    }
    win.replaceChildren(frag);
  }

  box.addEventListener('scroll', () => requestAnimationFrame(paint));
  box.addEventListener('pointerover', e => {
    const row = e.target.closest && e.target.closest('.gv-line');
    if (row) onOver(Number(row.dataset.line));
  });
  box.addEventListener('pointerleave', () => onLeave());
  box.addEventListener('click', e => {
    const row = e.target.closest && e.target.closest('.gv-line');
    if (row) onClick(Number(row.dataset.line));
  });

  return {
    setText(text) {
      lines = String(text).split(/\r\n?|\n/);
      spacer.style.height = `${lines.length * LINE_H}px`;
      box.replaceChildren(spacer);
      paint();
    },
    clear() { lines = ['']; box.replaceChildren(); },
    lineCount() { return lines.length; },
    paint,
    // Keep a line in view; only scrolls when it is outside the visible part.
    scrollToLine(line) {
      const top = (line - 1) * LINE_H;
      if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - LINE_H) box.scrollTop = Math.max(0, top - box.clientHeight / 3);
    },
  };
}
```

<!-- file: js/gcode/shell/results.js -->
```js
// Shared by both viewers: the time table and the checks list. Each viewer passes its own columns
// and check-text lookup; the "–" and "≥" rules live here once.
function cell(text) { const c = document.createElement('td'); c.textContent = text; return c; }

// columns: [(row) => text, ...]. An incomplete row shows "–" in every column whose function
// returns null for it (the timed cells).
export function renderTimeRows(tbody, rows, columns) {
  const frag = document.createDocumentFragment();
  for (const row of rows) {
    const tr = document.createElement('tr');
    for (const col of columns) { const v = col(row); tr.appendChild(cell(v === null ? '–' : v)); }
    frag.appendChild(tr);
  }
  tbody.replaceChildren(frag);
}

// The total counts only complete rows; "≥" says it leaves the incomplete ones out.
export function renderTotal(totalEl, noteEl, timing, formatDuration) {
  const total = timing.rows.filter(r => !r.incomplete).reduce((a, r) => a + r.totalSeconds, 0);
  totalEl.textContent = (timing.incomplete ? '≥ ' : '') + formatDuration(total);
  noteEl.hidden = !timing.incomplete;
}

// Loop-based (a program can carry thousands of warnings). Each line button pins its line.
export function renderCheckList(ul, warnings, { text, lineLabel, noneText, onLine }) {
  if (!warnings.length) {
    const li = document.createElement('li');
    li.className = 'gv-w is-ok';
    li.textContent = noneText;
    ul.replaceChildren(li);
    return;
  }
  const frag = document.createDocumentFragment();
  for (const w of warnings) {
    const li = document.createElement('li');
    li.className = `gv-w is-${w.severity}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gv-w-line';
    btn.textContent = `${lineLabel} ${w.line ?? '–'}`;
    btn.addEventListener('click', () => { if (w.line) onLine(w.line); });
    const msg = document.createElement('span');
    msg.textContent = text(w);
    li.append(btn, msg);
    frag.appendChild(li);
  }
  ul.replaceChildren(frag);
}
```

<!-- file: js/gcode/shell/banner.js -->
```js
// Shared by both viewers: the status banner. A banner is { key, params, action? } with action
// { key, run }, or null to hide it. Kept as data, so a language change can re-render it.
export function renderBanner(el, banner, t) {
  el.replaceChildren();
  el.hidden = !banner;
  if (!banner) return;
  const span = document.createElement('span');
  span.textContent = t(banner.key, banner.params || {});
  el.appendChild(span);
  if (banner.action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gv-link gv-banner-action';
    btn.textContent = t(banner.action.key);
    btn.addEventListener('click', banner.action.run);
    el.append(' ', btn);
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test "_tests/gcode/shell.test.js"`, then the full suite `node --test "_tests/gcode/*.test.js"`.
Expected: shell 5/5 pass, and the full suite 160 pass. Also run `node --check` on each of the seven modules; there should be no output.

- [ ] **Step 5: Commit**

```bash
git add js/gcode/shell _tests/gcode/shell.test.js
git commit -F - <<'EOF'
Viewer shell: shared panel, selection, inputs, tables, banner, i18n and storage modules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 2: Split the viewer strings out of the lathe page

**Files:**
- Create: `js/gcode/i18n-viewer.js` (generated by the script in Step 2)
- Modify: `gcode-viewer.html` (the same script: moves the strings and adds the `<script src>`)
- Test: `_tests/gcode/i18n.test.js`
- Temporary, not committed: `_tests/gcode/split-viewer-i18n.mjs`

**Interfaces:**
- Produces `window.GV_VIEWER_I18N = { el, en, it }`, a classic script loaded before each page's inline script. The inline script merges it under the page's own keys, and `window.GV_I18N` stays the merged result that `shell/i18n.js` reads.
- The page keeps inline: nav, consent and footer strings, `_title`, `gv.title`, `gv.lede`, `gv.cta.*`, `gv.survey.*` and `gv.aria.svg`. Every other `gv.*` key moves.

Why a script: the strings are copied by evaluating the page's own object literal, so no Greek or Italian character is retyped.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/gcode/i18n.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { SEVERITY } from '../../js/gcode/checks.js';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

// The strings a page really uses: the shared viewer file, then the page's inline block (which
// merges them), evaluated the way the browser does.
export function pageTranslations(pagePath) {
  const html = read(pagePath);
  const window = {};
  vm.runInNewContext(read('../../js/gcode/i18n-viewer.js'), { window });
  const start = html.indexOf('    var translations = {');
  const end = html.indexOf('    window.GV_I18N = translations;');
  const box = {};
  vm.runInNewContext(html.slice(start, end) + '\nbox.t = translations;', { window, box, Object });
  return { html, t: box.t, shared: window.GV_VIEWER_I18N };
}

const usedKeys = html => [...html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)].map(m => m[1]);

test('shared viewer strings: only gv.* keys, the same set in el, en and it', () => {
  const { shared } = pageTranslations('../../gcode-viewer.html');
  const en = Object.keys(shared.en).sort();
  assert.ok(en.length > 50);
  assert.ok(en.every(k => k.startsWith('gv.')));
  assert.deepEqual(Object.keys(shared.el).sort(), en);
  assert.deepEqual(Object.keys(shared.it).sort(), en);
});

test('lathe page: the merged strings match across languages and cover every key the page uses', () => {
  const { html, t } = pageTranslations('../../gcode-viewer.html');
  const en = Object.keys(t.en).sort();
  assert.ok(en.length >= 108, `${en.length} keys`);
  assert.deepEqual(Object.keys(t.el).sort(), en);
  assert.deepEqual(Object.keys(t.it).sort(), en);
  for (const k of usedKeys(html)) assert.ok(k in t.en, `missing ${k}`);
  for (const id of Object.keys(SEVERITY)) assert.ok(`gv.check.${id}` in t.en, `missing gv.check.${id}`);
});

test('the page keeps its own title, lede, CTA and survey inline (they differ per viewer)', () => {
  const { shared } = pageTranslations('../../gcode-viewer.html');
  for (const k of ['gv.title', 'gv.lede', 'gv.cta.text', 'gv.survey.q']) assert.ok(!(k in shared.en), `${k} should stay inline`);
});
```

Run: `node --test "_tests/gcode/i18n.test.js"`
Expected: FAIL with `ENOENT … js/gcode/i18n-viewer.js`.

- [ ] **Step 2: Write and run the migration script once**

<!-- file: _tests/gcode/split-viewer-i18n.mjs -->
```js
// One-off migration (plan Task 1): move the viewer strings out of gcode-viewer.html's inline
// translations into js/gcode/i18n-viewer.js, shared with the milling page. The page keeps its own
// keys (nav, consent, footer, title, lede, CTA, survey, drawing aria). Strings are copied by
// evaluating the page's own object literal, so no character is retyped. Run once, then delete.
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const PAGE = new URL('../../gcode-viewer.html', import.meta.url);
const SHARED = new URL('../../js/gcode/i18n-viewer.js', import.meta.url);
const PAGE_ONLY = /^(_title$|gv\.title$|gv\.lede$|gv\.cta\.|gv\.survey\.|gv\.aria\.svg$)/;

const html = readFileSync(PAGE, 'utf8');
const start = html.indexOf('    var translations = {');
const end = html.indexOf('    window.GV_I18N = translations;');
if (start < 0 || end < 0) throw new Error('translations block not found');
const block = html.slice(start, end);
const box = {};
vm.runInNewContext(block.replace('var translations', 'box.translations'), { box });
const all = box.translations;

const shared = {}, page = {};
for (const lang of ['el', 'en', 'it']) {
  shared[lang] = {}; page[lang] = {};
  for (const [k, v] of Object.entries(all[lang])) {
    const isViewer = k.startsWith('gv.') && !PAGE_ONLY.test(k);
    (isViewer ? shared : page)[lang][k] = v;
  }
}

const obj = (o, indent) => '{\n' + Object.entries(o)
  .map(([k, v]) => `${indent}  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n') + `\n${indent}}`;
const langs = (o, indent) => '{\n' + ['el', 'en', 'it']
  .map(l => `${indent}  ${l}: ${obj(o[l], indent + '  ')},`).join('\n') + `\n${indent}}`;

writeFileSync(SHARED, `// Viewer strings shared by the lathe and milling pages (GR/EN/IT). A classic script, not a module:
// each page loads it before its inline script, which merges it under the page's own keys.
window.GV_VIEWER_I18N = ${langs(shared, '')};
`);

const EOL = html.includes('\r\n') ? '\r\n' : '\n';        // keep the checkout's line endings
const pageBlock = `    var translations = ${langs(page, '    ')};
    // Shared viewer strings first, then this page's own keys on top.
    ['el', 'en', 'it'].forEach(function (l) {
      translations[l] = Object.assign({}, (window.GV_VIEWER_I18N || {})[l] || {}, translations[l]);
    });
`.replace(/\n/g, EOL);
let out = html.slice(0, start) + pageBlock + html.slice(end);
out = out.replace(`  <script>${EOL}    var translations`,
  `  <script src="js/gcode/i18n-viewer.js?v=20261015"></script>${EOL}  <script>${EOL}    var translations`);
if (!out.includes('js/gcode/i18n-viewer.js')) throw new Error('script tag not inserted');
writeFileSync(PAGE, out);
console.log(`shared ${Object.keys(shared.en).length} keys, page ${Object.keys(page.en).length} keys per language`);
```

Run: `node _tests/gcode/split-viewer-i18n.mjs && rm _tests/gcode/split-viewer-i18n.mjs`
Expected: `shared 77 keys, page 31 keys per language`. The script is not committed.

- [ ] **Step 3: Check the result**

Run:
```bash
node --check js/gcode/i18n-viewer.js
awk '/<script[^>]*>/{if($0 !~ /src=/){f=1;next}} /<\/script>/{f=0} f' gcode-viewer.html > /tmp/gv-inline.js && node --check /tmp/gv-inline.js && echo INLINE_OK
node --test "_tests/gcode/*.test.js"
```
Expected: no output from the first check, `INLINE_OK`, and 163 pass. `grep -n "i18n-viewer.js" gcode-viewer.html` shows one `<script src>` line, just before the inline script that starts with `var translations`.

- [ ] **Step 4: Commit**

```bash
git add js/gcode/i18n-viewer.js gcode-viewer.html _tests/gcode/i18n.test.js
git commit -F - <<'EOF'
Lathe viewer: move the viewer strings into a shared file for both viewers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 3: The full shared strings (milling and handoff copy)

**Files:**
- Modify: `js/gcode/i18n-viewer.js`, replaced in full by the block below
- Test: `_tests/gcode/i18n.test.js` (one test appended)

**Interfaces:**
- Adds, in el/en/it:
  - `gv.tomill`, `gv.tolathe`: the header cross-links;
  - `gv.lathe.mill.q`, `gv.lathe.mill.go`, `gv.mill.lathe.q`, `gv.mill.lathe.go`, `gv.handoff.big`: the handoff banners;
  - `gv.set.rapidy`, `gv.set.peck`: settings;
  - `gv.aria.view`;
  - `gv.mill.*`: view buttons, playback, readout, envelope, offsets, isolation, progress, no-WebGL, notes;
  - `gv.l.cycle`, `gv.l.markers`: layers;
  - `gv.mcheck.<id>`: all 18 milling check ids plus `more`.
- Every string the Task 2 split produced keeps its exact value (Step 3 proves it).

- [ ] **Step 1: Append the failing placeholder test**

Extract the block below to the git-ignored scratch path, then append it:

<!-- file: _tests/private/append-t3.js -->
```js

test('placeholders match across languages in the shared strings', () => {
  const { shared } = pageTranslations('../../gcode-viewer.html');
  const ph = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
  assert.equal(ph(shared.en['gv.mill.readout']), 'line,x,y,z');          // the check itself works
  for (const k of Object.keys(shared.en)) {
    assert.equal(ph(shared.el[k]), ph(shared.en[k]), `el ${k}`);
    assert.equal(ph(shared.it[k]), ph(shared.en[k]), `it ${k}`);
  }
});
```

Run: `node _tests/extract.mjs <brief> _tests/private/append-t3.js && cat _tests/private/append-t3.js >> _tests/gcode/i18n.test.js && rm _tests/private/append-t3.js`
Then: `node --test "_tests/gcode/i18n.test.js"`
Expected: the new test FAILS (`gv.mill.readout` is undefined).

- [ ] **Step 2: Replace the shared file**

Keep a copy of the Task 2 version for Step 3 first: `cp js/gcode/i18n-viewer.js _tests/private/i18n-before.js`. Then extract:

<!-- file: js/gcode/i18n-viewer.js -->
```js
// Viewer strings shared by the lathe and milling pages (GR/EN/IT). A classic script, not a module:
// each page loads it before its inline script, which merges it under the page's own keys.
window.GV_VIEWER_I18N = {
  el: {
    "gv.back": "Αρχική",
    "gv.eyebrow": "Δωρεάν εργαλείο",
    "gv.privacy": "Το πρόγραμμά σας δεν φεύγει ποτέ από τον υπολογιστή σας.",
    "gv.noscript": "Το εργαλείο χρειάζεται JavaScript.",
    "gv.open": "Άνοιγμα αρχείου",
    "gv.example": "Φόρτωση παραδείγματος",
    "gv.paste": "Επικόλληση",
    "gv.print": "Εκτύπωση / Αποθήκευση PDF",
    "gv.settings": "Ρυθμίσεις",
    "gv.set.control": "Έλεγχος",
    "gv.set.system": "Σύστημα G-code",
    "gv.set.integer": "Αριθμοί χωρίς υποδιαστολή",
    "gv.set.xmode": "Το X προγραμματίζεται ως",
    "gv.set.dia": "διάμετρος",
    "gv.set.rad": "ακτίνα",
    "gv.set.rapidx": "Ταχεία X (mm/min)",
    "gv.set.rapidz": "Ταχεία Z (mm/min)",
    "gv.set.toolchange": "Αλλαγή εργαλείου (s)",
    "gv.set.correction": "Διόρθωση (%)",
    "gv.set.flip": "X+ στην οθόνη",
    "gv.set.up": "πάνω",
    "gv.set.down": "κάτω",
    "gv.program": "Πρόγραμμα",
    "gv.edit": "Επεξεργασία",
    "gv.done": "Τέλος",
    "gv.drop": "Αφήστε εδώ ένα αρχείο ή επικολλήστε ένα πρόγραμμα",
    "gv.fit": "Προσαρμογή",
    "gv.aspect": "1:1",
    "gv.l.feed": "Κινήσεις κοπής",
    "gv.l.rapid": "Ταχείες",
    "gv.l.pass": "Από τον έλεγχο",
    "gv.l.profile": "Τελικό προφίλ",
    "gv.aria.code": "Γραμμές προγράμματος",
    "gv.aria.zoomout": "Σμίκρυνση",
    "gv.aria.zoomin": "Μεγέθυνση",
    "gv.readout": "Γραμμή {line} · {xlabel}{x} Z{z}",
    "gv.time.title": "Χρόνος κύκλου",
    "gv.time.note": "Εκτίμηση για προγραμματισμό, υπολογισμένη κίνηση προς κίνηση, μαζί με τα περάσματα που παράγει ο έλεγχος.",
    "gv.time.tool": "Εργαλείο",
    "gv.time.label": "Περιγραφή",
    "gv.time.cycles": "Κύκλοι",
    "gv.time.passes": "Περάσματα",
    "gv.time.length": "Μήκος κοπής",
    "gv.time.cut": "Κοπή",
    "gv.time.rapid": "Ταχείες",
    "gv.time.total": "Σύνολο",
    "gv.time.program": "Σύνολο προγράμματος (με αλλαγές εργαλείων)",
    "gv.time.incomplete": "Για τα εργαλεία με «–» ο χρόνος δεν υπολογίζεται πλήρως: κινήσεις χωρίς πρόωση ή στροφές, ή κύκλοι που δεν υποστηρίζονται ή απέτυχαν. Το σύνολο του προγράμματος δεν τα περιλαμβάνει.",
    "gv.time.excluded": "Δεν περιλαμβάνονται: επιταχύνσεις και επιβραδύνσεις, επιτάχυνση ατράκτου, επεξεργασία μπλοκ, ενέργειες M (ψυκτικό, τσοκ) και επιστροφές G28.",
    "gv.checks.title": "Έλεγχοι προγράμματος",
    "gv.checks.none": "Δεν βρέθηκαν προβλήματα.",
    "gv.checks.line": "Γραμμή",
    "gv.disclaimer": "Προβολή, όχι προσομοίωση: ελέγχετε πάντα στη μηχανή σας.",
    "gv.banner.toolarge": "Το αρχείο έχει {lines} γραμμές· η προβολή δέχεται έως {max}.",
    "gv.banner.error": "Το πρόγραμμα δεν μπόρεσε να αναλυθεί. Αν συμβαίνει ξανά, πείτε μας ποιο μπλοκ το προκαλεί.",
    "gv.paste.fail": "Ο browser δεν επιτρέπει την επικόλληση από το κουμπί. Πατήστε Ctrl+V μέσα στη σελίδα.",
    "gv.print.estimate": "Εκτίμηση για προγραμματισμό",
    "gv.check.g96-no-g50": "G96 (σταθερή ταχύτητα κοπής) χωρίς όριο στροφών G50: η άτρακτος μπορεί να ξεπεράσει τις στροφές κοντά στο κέντρο.",
    "gv.check.type1-monotonic": "Το προφίλ Τύπου I δεν είναι μονότονο (συναγερμός Fanuc 064). Χρησιμοποιήστε Τύπο II (X και Z στο μπλοκ P) ή αλλάξτε το προφίλ.",
    "gv.check.p-block": "Το μπλοκ P δεν κινεί τον άξονα που χρειάζεται ο κύκλος (συναγερμός Fanuc 065).",
    "gv.check.q-block-corner": "Λοξότμηση ή στρογγύλευση (C/R) στο μπλοκ Q (συναγερμός Fanuc 069).",
    "gv.check.tnrc-scope": "Η αντιστάθμιση ακτίνας μύτης (G41/G42) είναι ενεργή στην κλήση του κύκλου ή δεν ακυρώνεται μέχρι το μπλοκ Q.",
    "gv.check.start-in-material": "Το σημείο εκκίνησης του κύκλου βρίσκεται μέσα στο προφίλ: το πρώτο πέρασμα θα ξεκινήσει μέσα στο υλικό.",
    "gv.check.allowance-vs-depth": "Το περιθώριο φινιρίσματος δεν είναι μικρότερο από το βάθος κοπής.",
    "gv.check.pq-decimal": "Τα P/Q στους G74/G75/G76 δίνονται σε μικρά χωρίς υποδιαστολή (Q250 = 0,25 mm).",
    "gv.check.css-threading": "Σπείρωμα με G96: οι περισσότεροι έλεγχοι θέλουν G97 (σταθερές στροφές) για σπειρώματα.",
    "gv.check.no-feed": "Κίνηση κοπής χωρίς πρόωση (F).",
    "gv.check.no-speed": "Πρόωση ανά στροφή χωρίς στροφές ατράκτου (S).",
    "gv.check.tool-zero": "Κοπή με εργαλείο ή διόρθωση μηδέν ({tool}).",
    "gv.check.subprogram": "Η κλήση υποπρογράμματος M98 δεν ακολουθείται σε αυτή την έκδοση.",
    "gv.check.skipped": "Παραλείφθηκαν {count} γραμμές macro/εκφράσεων.",
    "gv.check.milling": "Μοιάζει με πρόγραμμα φρέζας· η προβολή είναι για προγράμματα τόρνου.",
    "gv.check.pq-not-found": "P{p}/Q{q}: δεν βρέθηκαν τα μπλοκ του προφίλ.",
    "gv.check.cycle-no-start": "Άγνωστο σημείο εκκίνησης κύκλου (καμία θέση πριν από τον κύκλο).",
    "gv.check.cycle-form": "Λείπουν απαραίτητες λέξεις από τον κύκλο G{code}.",
    "gv.check.cycle-unsupported": "Ο κύκλος G{code} δεν υποστηρίζεται σε αυτή την έκδοση.",
    "gv.check.type2-pocket": "Προφίλ Τύπου II με εσοχές: τα περάσματα μέσα στις εσοχές διαφέρουν ανά έλεγχο και δεν σχεδιάζονται· ελέγξτε στη μηχανή σας.",
    "gv.tomill": "Πρόγραμμα φρέζας; Ανοίξτε την προβολή G-code φρέζας →",
    "gv.tolathe": "Πρόγραμμα τόρνου; Ανοίξτε την προβολή G-code τόρνου →",
    "gv.lathe.mill.q": "Αυτό μοιάζει με πρόγραμμα φρέζας.",
    "gv.lathe.mill.go": "Άνοιγμα στην προβολή φρέζας",
    "gv.handoff.big": "Το πρόγραμμα είναι πολύ μεγάλο για να μεταφερθεί· ανοίξτε το αρχείο ξανά στην άλλη προβολή.",
    "gv.set.rapidy": "Ταχεία Y (mm/min)",
    "gv.set.peck": "Επιστροφή G73/G83 (mm)",
    "gv.aria.view": "Τρισδιάστατη προβολή διαδρομών εργαλείου",
    "gv.mill.top": "Πάνω",
    "gv.mill.front": "Εμπρός",
    "gv.mill.right": "Δεξιά",
    "gv.mill.iso": "Ισομετρική",
    "gv.l.cycle": "Κύκλοι διάτρησης",
    "gv.l.markers": "Σφάλματα",
    "gv.mill.play": "Αναπαραγωγή",
    "gv.mill.pause": "Παύση",
    "gv.mill.playpos": "{n} / {total} κινήσεις",
    "gv.mill.dims": "Περιοχή κοπής: X {x} × Y {y} × Z {z} {u}",
    "gv.mill.readout": "Γραμμή {line} · X{x} Y{y} Z{z}",
    "gv.mill.offsets": "Μηδενικά σημεία:",
    "gv.mill.isolated": "Εμφανίζεται μόνο το {tool}. Πατήστε ξανά τη γραμμή για όλα.",
    "gv.mill.rowtip": "Κλικ: μόνο αυτό το εργαλείο",
    "gv.mill.holes": "Τρύπες",
    "gv.mill.progress": "Ανάλυση… {pct}%",
    "gv.mill.nowebgl": "Ο browser σας δεν υποστηρίζει WebGL, οπότε η τρισδιάστατη προβολή δεν εμφανίζεται. Ο χρόνος και οι έλεγχοι λειτουργούν κανονικά.",
    "gv.mill.lathe.q": "Αυτό μοιάζει με πρόγραμμα τόρνου.",
    "gv.mill.lathe.go": "Άνοιγμα στην προβολή τόρνου",
    "gv.mill.notecomp": "Οι διαδρομές σχεδιάζονται όπως είναι γραμμένες: οι αντισταθμίσεις μήκους και ακτίνας εργαλείου δεν εφαρμόζονται.",
    "gv.mill.notewofs": "Σχεδίαση σε συντεταγμένες προγράμματος: οι τιμές των μηδενικών σημείων δεν είναι γνωστές.",
    "gv.mill.excluded": "Δεν περιλαμβάνονται: επιταχύνσεις και επιβραδύνσεις, επιτάχυνση ατράκτου, επεξεργασία μπλοκ, ενέργειες M και επιστροφές G28/G30/G53.",
    "gv.mcheck.no-g43": "Κίνηση Z μετά από αλλαγή εργαλείου χωρίς G43 (αντιστάθμιση μήκους).",
    "gv.mcheck.h-mismatch": "Το H{h} δεν ταιριάζει με το εργαλείο T{t}.",
    "gv.mcheck.spindle-off": "Κίνηση κοπής με την άτρακτο σταματημένη (χωρίς M3/M4).",
    "gv.mcheck.no-feed": "Κίνηση κοπής χωρίς πρόωση (F).",
    "gv.mcheck.comp-no-d": "G41/G42 χωρίς D (αριθμό διόρθωσης ακτίνας).",
    "gv.mcheck.comp-left-on": "Η αντιστάθμιση ακτίνας G41/G42 είναι ακόμη ενεργή σε αλλαγή εργαλείου ή στο τέλος.",
    "gv.mcheck.rapid-into-material": "Ταχεία κάτω από το βαθύτερο Z που έχει κοπεί ως τώρα: ελέγξτε για σύγκρουση (εκτίμηση).",
    "gv.mcheck.arc-radius": "Το τέλος του τόξου δεν βρίσκεται πάνω στην ακτίνα του (συναγερμός Fanuc).",
    "gv.mcheck.cycle-no-r": "Κύκλος διάτρησης χωρίς επίπεδο R ή βάθος Z.",
    "gv.mcheck.peck-no-q": "G73/G83 χωρίς Q (βάθος πάσου).",
    "gv.mcheck.cycle-no-start": "Ο κύκλος ξεκινά πριν γίνει γνωστό το Z· σχεδιάζεται από το επίπεδο R.",
    "gv.mcheck.sub-missing": "Το υποπρόγραμμα {p} δεν υπάρχει σε αυτό το αρχείο· η κλήση παραλείπεται.",
    "gv.mcheck.sub-loop": "Υποπρογράμματα σε βάθος πάνω από 4 ή κλήση σε βρόχο· η ανάλυση σταματά εδώ.",
    "gv.mcheck.main-m99": "M99 στο κύριο πρόγραμμα: ο έλεγχος θα ξεκινούσε ξανά από την αρχή· η προβολή σταματά εδώ.",
    "gv.mcheck.unsupported": "Το {code} δεν ερμηνεύεται· ο χρόνος αυτού του εργαλείου εμφανίζεται ως «–».",
    "gv.mcheck.approximated": "Το {code} σχεδιάζεται κατά προσέγγιση (πρόωση μέσα, ταχεία έξω).",
    "gv.mcheck.skipped": "Γραμμή macro ή έκφρασης: παραλείπεται.",
    "gv.mcheck.lathe-program": "Αυτό μοιάζει με πρόγραμμα τόρνου.",
    "gv.mcheck.more": "Ακόμη {count} όμοιες προειδοποιήσεις από αυτή τη γραμμή και μετά.",
  },
  en: {
    "gv.back": "Home",
    "gv.eyebrow": "Free tool",
    "gv.privacy": "Your program never leaves your computer.",
    "gv.noscript": "This tool needs JavaScript.",
    "gv.open": "Open file",
    "gv.example": "Load example",
    "gv.paste": "Paste",
    "gv.print": "Print / Save as PDF",
    "gv.settings": "Settings",
    "gv.set.control": "Control",
    "gv.set.system": "G-code system",
    "gv.set.integer": "Numbers without a decimal point",
    "gv.set.xmode": "X programmed as",
    "gv.set.dia": "diameter",
    "gv.set.rad": "radius",
    "gv.set.rapidx": "Rapid X (mm/min)",
    "gv.set.rapidz": "Rapid Z (mm/min)",
    "gv.set.toolchange": "Tool change (s)",
    "gv.set.correction": "Correction (%)",
    "gv.set.flip": "X+ on screen",
    "gv.set.up": "up",
    "gv.set.down": "down",
    "gv.program": "Program",
    "gv.edit": "Edit",
    "gv.done": "Done",
    "gv.drop": "Drop a file here or paste a program",
    "gv.fit": "Fit",
    "gv.aspect": "1:1",
    "gv.l.feed": "Feed moves",
    "gv.l.rapid": "Rapids",
    "gv.l.pass": "Generated by the control",
    "gv.l.profile": "Finished profile",
    "gv.aria.code": "Program lines",
    "gv.aria.zoomout": "Zoom out",
    "gv.aria.zoomin": "Zoom in",
    "gv.readout": "Line {line} · {xlabel}{x} Z{z}",
    "gv.time.title": "Cycle time",
    "gv.time.note": "Planning estimate, calculated move by move, including the passes the control generates.",
    "gv.time.tool": "Tool",
    "gv.time.label": "Description",
    "gv.time.cycles": "Cycles",
    "gv.time.passes": "Passes",
    "gv.time.length": "Cut length",
    "gv.time.cut": "Cutting",
    "gv.time.rapid": "Rapids",
    "gv.time.total": "Total",
    "gv.time.program": "Program total (incl. tool changes)",
    "gv.time.incomplete": "Tools marked “–” could not be fully timed: moves without feed or speed, or cycles that are unsupported or failed. The program total leaves them out.",
    "gv.time.excluded": "Not included: acceleration and deceleration, spindle ramp-up, block processing, M-code actions (coolant, chuck) and G28 reference returns.",
    "gv.checks.title": "Program checks",
    "gv.checks.none": "No issues found.",
    "gv.checks.line": "Line",
    "gv.disclaimer": "A viewer, not a simulator: always verify on your machine.",
    "gv.banner.toolarge": "This file has {lines} lines; the viewer handles up to {max}.",
    "gv.banner.error": "This program could not be analysed. If it happens again, tell us which block causes it.",
    "gv.paste.fail": "The browser blocks pasting from the button. Press Ctrl+V anywhere on the page.",
    "gv.print.estimate": "Planning estimate",
    "gv.check.g96-no-g50": "G96 (constant surface speed) with no G50 spindle limit: the spindle can over-speed near the centre.",
    "gv.check.type1-monotonic": "The Type I profile is not monotonic (Fanuc alarm 064). Use Type II (X and Z in the P block) or change the profile.",
    "gv.check.p-block": "The P block does not move the axis this cycle needs (Fanuc alarm 065).",
    "gv.check.q-block-corner": "Chamfer or corner (C/R) in the Q block (Fanuc alarm 069).",
    "gv.check.tnrc-scope": "Nose-radius compensation (G41/G42) is active at the cycle call or not cancelled by the Q block.",
    "gv.check.start-in-material": "The cycle start point is inside the profile: the first pass would start in material.",
    "gv.check.allowance-vs-depth": "The finishing allowance is not smaller than the depth of cut.",
    "gv.check.pq-decimal": "P/Q in G74/G75/G76 are microns without a decimal point (Q250 = 0.25 mm).",
    "gv.check.css-threading": "Threading under G96: most controls need G97 (fixed rpm) for threads.",
    "gv.check.no-feed": "Cutting move with no feed (F).",
    "gv.check.no-speed": "Feed per rev with no spindle speed (S).",
    "gv.check.tool-zero": "Cutting with tool or offset zero ({tool}).",
    "gv.check.subprogram": "The M98 subprogram call is not followed in this version.",
    "gv.check.skipped": "{count} macro/expression lines skipped.",
    "gv.check.milling": "This looks like a milling program; the viewer is for lathe programs.",
    "gv.check.pq-not-found": "P{p}/Q{q}: profile blocks not found.",
    "gv.check.cycle-no-start": "Cycle start point unknown (no position before the cycle).",
    "gv.check.cycle-form": "Cycle G{code} is missing required words.",
    "gv.check.cycle-unsupported": "Cycle G{code} is not supported in this version.",
    "gv.check.type2-pocket": "Type II profile with pockets: pocket passes differ by control and are not drawn; verify on your machine.",
    "gv.tomill": "Milling program? Open the milling G-code viewer →",
    "gv.tolathe": "Lathe program? Open the lathe G-code viewer →",
    "gv.lathe.mill.q": "This looks like a milling program.",
    "gv.lathe.mill.go": "Open in the milling viewer",
    "gv.handoff.big": "The program is too large to hand over; open the file again in the other viewer.",
    "gv.set.rapidy": "Rapid Y (mm/min)",
    "gv.set.peck": "G73/G83 peck clearance (mm)",
    "gv.aria.view": "3D view of the toolpaths",
    "gv.mill.top": "Top",
    "gv.mill.front": "Front",
    "gv.mill.right": "Right",
    "gv.mill.iso": "Iso",
    "gv.l.cycle": "Drilling cycles",
    "gv.l.markers": "Errors",
    "gv.mill.play": "Play",
    "gv.mill.pause": "Pause",
    "gv.mill.playpos": "{n} / {total} moves",
    "gv.mill.dims": "Cutting envelope: X {x} × Y {y} × Z {z} {u}",
    "gv.mill.readout": "Line {line} · X{x} Y{y} Z{z}",
    "gv.mill.offsets": "Work offsets:",
    "gv.mill.isolated": "Showing {tool} only. Click its row again to show all.",
    "gv.mill.rowtip": "Click: show this tool only",
    "gv.mill.holes": "Holes",
    "gv.mill.progress": "Analysing… {pct}%",
    "gv.mill.nowebgl": "Your browser has no WebGL, so the 3D view can’t be shown. The time table and the checks still work.",
    "gv.mill.lathe.q": "This looks like a lathe program.",
    "gv.mill.lathe.go": "Open in the lathe viewer",
    "gv.mill.notecomp": "Paths are drawn as programmed: tool length and radius compensation are not applied.",
    "gv.mill.notewofs": "Drawn in program coordinates: work offset values are not known.",
    "gv.mill.excluded": "Not included: acceleration and deceleration, spindle ramp-up, block processing, M-code actions and G28/G30/G53 reference returns.",
    "gv.mcheck.no-g43": "Z move after a tool change without G43 (tool length offset).",
    "gv.mcheck.h-mismatch": "H{h} does not match tool T{t}.",
    "gv.mcheck.spindle-off": "Cutting move with the spindle stopped (no M3/M4).",
    "gv.mcheck.no-feed": "Cutting move without a feed (F).",
    "gv.mcheck.comp-no-d": "G41/G42 without D (radius offset number).",
    "gv.mcheck.comp-left-on": "Radius compensation G41/G42 is still on at a tool change or at the end.",
    "gv.mcheck.rapid-into-material": "Rapid below the deepest Z cut so far: check for a crash (heuristic).",
    "gv.mcheck.arc-radius": "The arc end point is not on its radius (Fanuc alarm).",
    "gv.mcheck.cycle-no-r": "Drilling cycle without an R plane or a Z depth.",
    "gv.mcheck.peck-no-q": "G73/G83 without Q (peck depth).",
    "gv.mcheck.cycle-no-start": "The cycle starts before Z is known; drawn from the R plane.",
    "gv.mcheck.sub-missing": "Subprogram {p} is not in this file; the call is skipped.",
    "gv.mcheck.sub-loop": "Subprograms nested deeper than 4, or a call loop; the analysis stops here.",
    "gv.mcheck.main-m99": "M99 in the main program: the control would start over; the viewer stops here.",
    "gv.mcheck.unsupported": "{code} is not interpreted; this tool’s time shows “–”.",
    "gv.mcheck.approximated": "{code} is drawn approximately (feed in, rapid out).",
    "gv.mcheck.skipped": "Macro or expression line: skipped.",
    "gv.mcheck.lathe-program": "This looks like a lathe program.",
    "gv.mcheck.more": "{count} more warnings like this from this line on.",
  },
  it: {
    "gv.back": "Home",
    "gv.eyebrow": "Strumento gratuito",
    "gv.privacy": "Il vostro programma non lascia mai il vostro computer.",
    "gv.noscript": "Questo strumento richiede JavaScript.",
    "gv.open": "Apri file",
    "gv.example": "Carica esempio",
    "gv.paste": "Incolla",
    "gv.print": "Stampa / Salva PDF",
    "gv.settings": "Impostazioni",
    "gv.set.control": "Controllo",
    "gv.set.system": "Sistema G-code",
    "gv.set.integer": "Numeri senza punto decimale",
    "gv.set.xmode": "X programmato come",
    "gv.set.dia": "diametro",
    "gv.set.rad": "raggio",
    "gv.set.rapidx": "Rapido X (mm/min)",
    "gv.set.rapidz": "Rapido Z (mm/min)",
    "gv.set.toolchange": "Cambio utensile (s)",
    "gv.set.correction": "Correzione (%)",
    "gv.set.flip": "X+ sullo schermo",
    "gv.set.up": "in alto",
    "gv.set.down": "in basso",
    "gv.program": "Programma",
    "gv.edit": "Modifica",
    "gv.done": "Fatto",
    "gv.drop": "Trascinate qui un file o incollate un programma",
    "gv.fit": "Adatta",
    "gv.aspect": "1:1",
    "gv.l.feed": "Movimenti di taglio",
    "gv.l.rapid": "Rapidi",
    "gv.l.pass": "Generati dal controllo",
    "gv.l.profile": "Profilo finito",
    "gv.aria.code": "Righe del programma",
    "gv.aria.zoomout": "Riduci",
    "gv.aria.zoomin": "Ingrandisci",
    "gv.readout": "Riga {line} · {xlabel}{x} Z{z}",
    "gv.time.title": "Tempo ciclo",
    "gv.time.note": "Stima per la pianificazione, calcolata movimento per movimento, comprese le passate generate dal controllo.",
    "gv.time.tool": "Utensile",
    "gv.time.label": "Descrizione",
    "gv.time.cycles": "Cicli",
    "gv.time.passes": "Passate",
    "gv.time.length": "Lunghezza di taglio",
    "gv.time.cut": "Taglio",
    "gv.time.rapid": "Rapidi",
    "gv.time.total": "Totale",
    "gv.time.program": "Totale programma (inclusi cambi utensile)",
    "gv.time.incomplete": "Per gli utensili con «–» il tempo non è calcolabile per intero: movimenti senza avanzamento o giri, oppure cicli non supportati o non riusciti. Il totale del programma li esclude.",
    "gv.time.excluded": "Non inclusi: accelerazioni e decelerazioni, rampa del mandrino, elaborazione dei blocchi, azioni M (refrigerante, autocentrante) e ritorni G28.",
    "gv.checks.title": "Controlli del programma",
    "gv.checks.none": "Nessun problema rilevato.",
    "gv.checks.line": "Riga",
    "gv.disclaimer": "Un visualizzatore, non un simulatore: verificate sempre sulla vostra macchina.",
    "gv.banner.toolarge": "Questo file ha {lines} righe; il visualizzatore ne gestisce fino a {max}.",
    "gv.banner.error": "Non è stato possibile analizzare il programma. Se succede di nuovo, diteci quale blocco lo causa.",
    "gv.paste.fail": "Il browser blocca l’incolla dal pulsante. Premete Ctrl+V in un punto qualsiasi della pagina.",
    "gv.print.estimate": "Stima per la pianificazione",
    "gv.check.g96-no-g50": "G96 (velocità di taglio costante) senza limite giri G50: il mandrino può andare fuori giri vicino al centro.",
    "gv.check.type1-monotonic": "Il profilo di Tipo I non è monotono (allarme Fanuc 064). Usate il Tipo II (X e Z nel blocco P) o modificate il profilo.",
    "gv.check.p-block": "Il blocco P non muove l’asse richiesto dal ciclo (allarme Fanuc 065).",
    "gv.check.q-block-corner": "Smusso o raccordo (C/R) nel blocco Q (allarme Fanuc 069).",
    "gv.check.tnrc-scope": "La compensazione del raggio utensile (G41/G42) è attiva alla chiamata del ciclo o non viene annullata entro il blocco Q.",
    "gv.check.start-in-material": "Il punto di partenza del ciclo è dentro il profilo: la prima passata partirebbe nel materiale.",
    "gv.check.allowance-vs-depth": "Il sovrametallo di finitura non è inferiore alla profondità di passata.",
    "gv.check.pq-decimal": "P/Q in G74/G75/G76 sono in micron senza punto decimale (Q250 = 0,25 mm).",
    "gv.check.css-threading": "Filettatura in G96: la maggior parte dei controlli richiede G97 (giri fissi) per le filettature.",
    "gv.check.no-feed": "Movimento di taglio senza avanzamento (F).",
    "gv.check.no-speed": "Avanzamento al giro senza velocità del mandrino (S).",
    "gv.check.tool-zero": "Taglio con utensile o correttore zero ({tool}).",
    "gv.check.subprogram": "La chiamata di sottoprogramma M98 non viene seguita in questa versione.",
    "gv.check.skipped": "{count} righe di macro/espressioni ignorate.",
    "gv.check.milling": "Sembra un programma di fresatura; il visualizzatore è per programmi di tornitura.",
    "gv.check.pq-not-found": "P{p}/Q{q}: blocchi del profilo non trovati.",
    "gv.check.cycle-no-start": "Punto di partenza del ciclo sconosciuto (nessuna posizione prima del ciclo).",
    "gv.check.cycle-form": "Al ciclo G{code} mancano parole obbligatorie.",
    "gv.check.cycle-unsupported": "Il ciclo G{code} non è supportato in questa versione.",
    "gv.check.type2-pocket": "Profilo di Tipo II con tasche: le passate nelle tasche variano secondo il controllo e non sono disegnate; verificate sulla vostra macchina.",
    "gv.tomill": "Programma per fresa? Aprite il visualizzatore G-code per fresa →",
    "gv.tolathe": "Programma per tornio? Aprite il visualizzatore G-code per tornio →",
    "gv.lathe.mill.q": "Sembra un programma per fresa.",
    "gv.lathe.mill.go": "Apri nel visualizzatore per fresa",
    "gv.handoff.big": "Il programma è troppo grande per il passaggio; aprite di nuovo il file nell’altro visualizzatore.",
    "gv.set.rapidy": "Rapido Y (mm/min)",
    "gv.set.peck": "Ritorno G73/G83 (mm)",
    "gv.aria.view": "Vista 3D dei percorsi utensile",
    "gv.mill.top": "Alto",
    "gv.mill.front": "Fronte",
    "gv.mill.right": "Destra",
    "gv.mill.iso": "Iso",
    "gv.l.cycle": "Cicli di foratura",
    "gv.l.markers": "Errori",
    "gv.mill.play": "Riproduci",
    "gv.mill.pause": "Pausa",
    "gv.mill.playpos": "{n} / {total} movimenti",
    "gv.mill.dims": "Ingombro di taglio: X {x} × Y {y} × Z {z} {u}",
    "gv.mill.readout": "Riga {line} · X{x} Y{y} Z{z}",
    "gv.mill.offsets": "Origini pezzo:",
    "gv.mill.isolated": "Visibile solo {tool}. Cliccate di nuovo la riga per vedere tutto.",
    "gv.mill.rowtip": "Clic: solo questo utensile",
    "gv.mill.holes": "Fori",
    "gv.mill.progress": "Analisi in corso… {pct}%",
    "gv.mill.nowebgl": "Il vostro browser non supporta WebGL, quindi la vista 3D non può essere mostrata. Tempi e controlli funzionano comunque.",
    "gv.mill.lathe.q": "Sembra un programma per tornio.",
    "gv.mill.lathe.go": "Apri nel visualizzatore per tornio",
    "gv.mill.notecomp": "I percorsi sono disegnati come programmati: le compensazioni di lunghezza e raggio utensile non sono applicate.",
    "gv.mill.notewofs": "Disegnato in coordinate di programma: i valori delle origini pezzo non sono noti.",
    "gv.mill.excluded": "Non inclusi: accelerazioni e decelerazioni, avvio del mandrino, elaborazione dei blocchi, funzioni M e ritorni G28/G30/G53.",
    "gv.mcheck.no-g43": "Movimento Z dopo un cambio utensile senza G43 (correzione lunghezza).",
    "gv.mcheck.h-mismatch": "H{h} non corrisponde all’utensile T{t}.",
    "gv.mcheck.spindle-off": "Movimento di taglio con il mandrino fermo (senza M3/M4).",
    "gv.mcheck.no-feed": "Movimento di taglio senza avanzamento (F).",
    "gv.mcheck.comp-no-d": "G41/G42 senza D (numero correttore raggio).",
    "gv.mcheck.comp-left-on": "La compensazione raggio G41/G42 è ancora attiva al cambio utensile o alla fine.",
    "gv.mcheck.rapid-into-material": "Rapido sotto la Z più profonda lavorata finora: verificate una possibile collisione (stima).",
    "gv.mcheck.arc-radius": "Il punto finale dell’arco non è sul suo raggio (allarme Fanuc).",
    "gv.mcheck.cycle-no-r": "Ciclo di foratura senza piano R o profondità Z.",
    "gv.mcheck.peck-no-q": "G73/G83 senza Q (profondità di passata).",
    "gv.mcheck.cycle-no-start": "Il ciclo parte prima che Z sia noto; disegnato dal piano R.",
    "gv.mcheck.sub-missing": "Il sottoprogramma {p} non è in questo file; la chiamata è saltata.",
    "gv.mcheck.sub-loop": "Sottoprogrammi annidati oltre 4 livelli o chiamata ciclica; l’analisi si ferma qui.",
    "gv.mcheck.main-m99": "M99 nel programma principale: il controllo ripartirebbe dall’inizio; il visualizzatore si ferma qui.",
    "gv.mcheck.unsupported": "{code} non è interpretato; il tempo di questo utensile è «–».",
    "gv.mcheck.approximated": "{code} è disegnato in modo approssimato (avanzamento in entrata, rapido in uscita).",
    "gv.mcheck.skipped": "Riga macro o espressione: saltata.",
    "gv.mcheck.lathe-program": "Sembra un programma per tornio.",
    "gv.mcheck.more": "Altri {count} avvisi simili da questa riga in poi.",
  },
};
```

- [ ] **Step 3: Prove nothing that existed changed**

Run:
```bash
node -e "
const vm=require('vm'),fs=require('fs');
const load=f=>{const w={};vm.runInNewContext(fs.readFileSync(f,'utf8'),{window:w});return w.GV_VIEWER_I18N;};
const a=load('_tests/private/i18n-before.js'),b=load('js/gcode/i18n-viewer.js');
let n=0;for(const l of ['el','en','it'])for(const[k,v]of Object.entries(a[l])){if(b[l][k]!==v)throw new Error(l+' '+k);n++;}
console.log('unchanged',n,'of',n,'; now',Object.keys(b.en).length,'keys per language');"
```
Expected: `unchanged 231 of 231 ; now 126 keys per language`. Then `rm _tests/private/i18n-before.js`.

- [ ] **Step 4: Run the tests**

Run: `node --test "_tests/gcode/*.test.js"`
Expected: 164 pass.

- [ ] **Step 5: Commit**

```bash
git add js/gcode/i18n-viewer.js _tests/gcode/i18n.test.js
git commit -F - <<'EOF'
Viewer strings: milling, handoff and cross-link copy in Greek, English and Italian

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 4: Lathe controller on the shared shell; handoff, cross-link, GA machine parameter

**Files:**
- Modify: `js/gcode/ui.js`, replaced in full by the block below
- Modify: `gcode-viewer.html` (three exact edits)

**Interfaces:**
- Consumes: the Task 1 shell and the Task 3 strings.
- Produces:
  - GA events carry `machine: 'lathe'`;
  - `gcode_handoff { from: 'lathe', to: 'mill' }`;
  - the lathe page reads a handoff on first paint, so the milling page (Task 17) can send programs over.

Behaviour must match the live page. What is new:
- a milling program shows the banner "This looks like a milling program. [Open in the milling viewer]", where the page used to show a plain text banner (`gv.check.milling`);
- the cross-link;
- the GA `machine` parameter;
- the page reads a handoff.

- [ ] **Step 1: Replace the controller**

<!-- file: js/gcode/ui.js -->
```js
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
  ga('gcode_handoff', { from: 'lathe', to });
  if (writeHandoff(session(), state.text, state.fileName)) location.href = page;
  else showBanner({ key: 'gv.handoff.big' });
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
if (handed) loadText(handed.text, 'file', handed.name);
else loadText(EXAMPLE_PROGRAM, 'init', 'example.nc');
```

- [ ] **Step 2: Edit the page**

Extract and run this script. It is ASCII only: the Greek link text is read from the shared strings file that Task 3 wrote, so nothing is retyped, and each edit must match exactly once.

<!-- file: _tests/private/edit-lathe-page.mjs -->
```js
// One-off edit of gcode-viewer.html (plan Task 4): the cross-link to the milling viewer and the
// cache-busting of the two changed assets. The Greek link text comes from the shared strings file.
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const w = {};
vm.runInNewContext(readFileSync('js/gcode/i18n-viewer.js', 'utf8'), { window: w });
let h = readFileSync('gcode-viewer.html', 'utf8');
const EOL = h.includes('\r\n') ? '\r\n' : '\n';
const once = (re, fn) => {
  const m = h.match(re);
  if (!m || h.split(m[0]).length !== 2) throw new Error(`not exactly once: ${re}`);
  h = h.replace(m[0], fn(m[0]));
};
once(/ *<p class="gv-privacy" data-i18n="gv\.privacy">[^\r\n]*<\/p>/, line => line + EOL +
  `      <p class="gv-cross"><a href="milling-gcode-viewer.html" data-i18n="gv.tomill">${w.GV_VIEWER_I18N.el['gv.tomill']}</a></p>`);
once(/css\/tools\.css\?v=20260927/, () => 'css/tools.css?v=20261015');
once(/js\/gcode\/ui\.js\?v=20260927/, () => 'js/gcode/ui.js?v=20261015');
writeFileSync('gcode-viewer.html', h);
console.log('page edited');
```

Run: `node _tests/extract.mjs <brief> _tests/private/edit-lathe-page.mjs && node _tests/private/edit-lathe-page.mjs && rm _tests/private/edit-lathe-page.mjs`
Expected: `page edited`. Then `git diff --stat gcode-viewer.html` shows `3 insertions(+), 2 deletions(-)`.

- [ ] **Step 3: Static checks**

Run:
```bash
node --check js/gcode/ui.js
awk '/<script[^>]*>/{if($0 !~ /src=/){f=1;next}} /<\/script>/{f=0} f' gcode-viewer.html > /tmp/gv-inline.js && node --check /tmp/gv-inline.js && echo INLINE_OK
node --test "_tests/gcode/*.test.js"
```
Expected: `INLINE_OK`, and 164 pass.

- [ ] **Step 4: Lathe regression in the browser (Playwright MCP)**

Start `python -m http.server 8765 --bind 127.0.0.1` from the repo root, with the Bash tool's `run_in_background`. Load the Playwright tools with ToolSearch. Open `http://127.0.0.1:8765/gcode-viewer.html?lang=en` at 1280×800, and check each item with `browser_evaluate`. Every value below was measured on the page before this change.
1. The time table has 3 rows labelled `OD ROUGHING`, `OD FINISHING`, `THREAD M24X2`, and `#gvTotal` reads `2:07`. `#gvChecks` reads `No issues found.`, and `.gv-pass` has a non-empty `d`.
2. Dispatch `pointerover` on `.gv-line[data-line="11"]`: `.gv-hi` gets a `d` of length 673.
3. Click line 11, then hover line 20: line 11 stays `is-hi`. Click line 11 again, then hover line 20: line 20 is now `is-hi`.
4. Paste a program with warnings by dispatching a `ClipboardEvent('paste')` on `document`, with `G21 G99\nG97 S1000 M3\nT0101\nG0 X50 Z2\nG1 Z-10\nX60\nG0 X100 Z100\nM30`.
   - Two checks appear, for lines 5 and 6.
   - Pin line 3, then click the first check's line button: only line 5 is `is-hi`.
5. Click **Load example**, then hover line 11: it is `is-hi`, because a new program clears the pin.
6. Switch the language:
   - IT: the `gv.open` button reads `Apri file`, and the checks read `Nessun problema rilevato.`
   - EL: it reads `Άνοιγμα αρχείου`, and the CTA title reads `Το θέλετε φτιαγμένο για τη δική σας μηχανή;`
7. Paste `O3000 (MILL PART)\nG17 G90 G54 G0 X10 Y20 S3000 M3\nG43 Z5 H1\nG1 Z-2 F200\nX60 Y40\nG0 Z50\nM30`. The banner reads `This looks like a milling program. Open in the milling viewer`, with a button. Don't click it; the milling page comes in Task 16.
8. `.gv-cross a` points to `milling-gcode-viewer.html`.
9. At 375×800, `document.documentElement.scrollWidth <= 375`.
10. `browser_console_messages` shows no errors or warnings.

Then stop the server, confirm `netstat -ano | grep ":8765 .*LISTENING"` prints nothing, and close the browser. Record each check as PASS/FAIL, with its evidence, in your report.

- [ ] **Step 5: Commit**

```bash
git add js/gcode/ui.js gcode-viewer.html
git commit -F - <<'EOF'
Lathe viewer: controller on the shared shell; milling handoff, cross-link and GA machine parameter

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 5: Research notes for the milling cycles

**Files:**
- Create: `_docs/gcode-viewer/mill-cycles/frame.md`, `drilling.md`, `peck.md`, `tapping.md`, `boring.md`, `subprograms.md` and `arcs.md`

**Interfaces:**
- Produces a note per group, which the reviewers of Tasks 7–9 and the final review check the code against.
- Changes no code. If a source clearly contradicts what the code in this plan does, **stop and report DONE_WITH_CONCERNS**, quoting the source. The controller rules on it, and any code change goes through a separate fix task.

Spec §5.3 wants the notes written before the code. The notes record what this plan's code does, and verify it against sources where a source can be found.

- [ ] **Step 1: Write each note in the lathe notes' format**

Each note has:
- a first line `Status: VERIFIED | PARTLY VERIFIED | UNVERIFIED`, followed by what is and isn't verified;
- **Syntax**, with a table of every word and its unit;
- **Move sequence**, as the code draws it;
- **Fanuc vs Haas differences**;
- **Sources checked**: URL, class (official or secondary) and a short quote or paraphrase.

Mark something VERIFIED only when a source states it. Record everything else as UNVERIFIED, with what you tried.

What each note must cover, taken from this plan's code (Tasks 7–9):
1. `frame.md` (common drilling frame):
   - the initial level is the Z when cycle mode starts, and it is kept when the cycle code changes without G80;
   - R: in G90 absolute; in G91 measured from the initial level;
   - Z: in G90 absolute; in G91 measured from R;
   - G98 returns to the initial level, G99 to R;
   - K (Fanuc) or L (Haas) repeats, in G91 at incremental X/Y steps; K0/L0 stores the cycle without drilling;
   - a block in cycle mode with X, Y, Z or R drills a hole;
   - G80, or any G0/G1/G2/G3, cancels;
   - drilling in G18/G19 is not interpreted.
2. `drilling.md`:
   - G81: feed to Z, rapid out.
   - G82: dwell at the bottom.
   - G85: feed in, feed out.
   - G86: feed in, rapid out.
   - G89: dwell, then feed out.
   - Dwell P without a decimal point is in milliseconds; with a decimal point, in seconds. Check the Haas unit.
3. `peck.md`:
   - G83: feed Q, rapid to R, rapid back to the last depth + d, feed on.
   - G73: feed Q, retract d, feed on.
   - d is a machine parameter: Fanuc 5115 for G83 and 5114 for G73. The viewer uses the setting `peckClearance` (0.5 mm), and the note names the Haas equivalent.
4. `tapping.md`:
   - G84 (right-hand) and G74 (left-hand): feed in, spindle reverse, feed out to R, then G98 rapids to the initial level.
   - F is pitch × S in G94.
   - Rigid tapping M29.
   - G84.2/G84.3 are read as G84/G74.
5. `boring.md`: G76 (orient, shift Q), G87 (back boring) and G88 (manual retract), with the viewer's approximations (feed in, rapid out; G76/G88 keep the dwell).
6. `subprograms.md`:
   - M98 P<o>, with L or K repeats, or the older P<repeat><oooo> form;
   - M99 returns; M99 in the main program would loop back to the start;
   - Haas M97 P<n>;
   - the nesting limit (the viewer stops at 4 levels): check what Fanuc 0i-MF allows;
   - G65/G66 macro calls are not interpreted.
7. `arcs.md`:
   - G17 (XY, I/J), G18 (ZX, K/I), G19 (YZ, J/K);
   - G2 runs clockwise as seen from the positive end of the normal axis;
   - R > 0 is the minor arc, R < 0 the major arc;
   - a full circle takes I/J/K with no end change;
   - helical motion on the third axis;
   - the end-point radius check (0.02 mm; Fanuc alarm PS0020, or whatever the source names it).

Suggested sources, direct URLs (search engines may block fetches):
- helmancnc.com: e.g. https://www.helmancnc.com/fanuc-g83-peck-drilling-cycle/ and https://www.helmancnc.com/fanuc-g73-high-speed-peck-drilling-cycle/. Follow its internal links for G81, G82, G84, G85, G76, M98 and G02/G03.
- cnccookbook.com and gcodetutor.com drilling-cycle pages.
- Haas mill pages, e.g. https://www.haascnc.com/service/codes-settings.type=gcode.machine=mill.value=G83.html. These often return HTTP 403; try once, then move on.
- Any Fanuc 0i-MF operator's manual excerpt quoted by a tutorial page.

Keep to about 40 minutes of fetching.

- [ ] **Step 2: Commit**

```bash
git add _docs/gcode-viewer/mill-cycles
git commit -F - <<'EOF'
Milling viewer: research notes for drilling cycles, subprograms and arcs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 6: Milling settings, move buffer and time model

**Files:**
- Create: `js/mill/settings.js`, `js/mill/moves.js`, `js/mill/time.js`
- Test: `_tests/mill/moves.test.js`, `_tests/mill/time.test.js`

**Interfaces:**
- `settings.js`: `MILL_DEFAULTS`, a frozen object: `rapidX`, `rapidY`, `rapidZ` = 30000 mm/min; `toolChangeSeconds` = 5; `correctionPct` = 0; `integerUnit` = 'mm'; `peckClearance` = 0.5; `arcTolerance` = 0.02; `chordError` = 0.01; `maxChords` = 256. Also `millSettings(partial)`, `MILL_MAX_LINES` = 1500000 and `MILL_MAX_CHARS` = 60 MiB.
- `moves.js`:
  - the kinds `K_RAPID` = 0, `K_FEED` = 1, `K_CFEED` = 2, `K_CRAPID` = 3;
  - `createMoves(capacity)`;
  - `pushMove(m, a, b, kind, line, row, wofs, seconds)`;
  - `finishMoves(m)` returns `{ count, pos: Float32Array(6n), kind: Uint8Array, line: Uint32Array, row: Uint16Array, wofs: Uint8Array, seconds: Float32Array }` as exact-length copies;
  - `buildLineIndex(moves, lineCount)` returns `{ offsets, moves }` (CSR);
  - `movesOfLine(index, line)` returns `number[]`.
- `time.js`: `rapidSeconds(dx, dy, dz, s)`; `feedRate(st)` returns mm/min or null; `feedSeconds(length, rate)` returns seconds, or NaN when the rate is unknown; `summarizeRows(rows, s)` returns `{ rows, total, incomplete }`, with rows shaped as `{ tool, label, firstLine, moveStart, moveEnd, cycles, cutLength, cutSeconds, rapidSeconds, dwellSeconds, changeSeconds, totalSeconds, incomplete }`.

- [ ] **Step 1: Write the failing tests**

<!-- file: _tests/mill/moves.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMoves, pushMove, finishMoves, buildLineIndex, movesOfLine, K_FEED, K_RAPID } from '../../js/mill/moves.js';

const P = (x, y, z) => ({ x, y, z });

test('the buffer grows past its capacity and keeps every field', () => {
  const m = createMoves(2);
  for (let i = 0; i < 5; i++) pushMove(m, P(i, 0, 0), P(i + 1, 0, 0), i % 2 ? K_RAPID : K_FEED, 10 + i, 1, 0, i * 0.5);
  assert.equal(m.count, 5);
  assert.ok(m.cap >= 5);
  const f = finishMoves(m);
  assert.equal(f.pos.length, 30);
  assert.deepEqual(Array.from(f.pos.slice(24, 30)), [4, 0, 0, 5, 0, 0]);
  assert.deepEqual(Array.from(f.kind), [K_FEED, K_RAPID, K_FEED, K_RAPID, K_FEED]);
  assert.deepEqual(Array.from(f.line), [10, 11, 12, 13, 14]);
  assert.deepEqual(Array.from(f.seconds), [0, 0.5, 1, 1.5, 2]);
});

test('finishMoves returns exact-length copies with their own buffers (safe to transfer)', () => {
  const m = createMoves(8);
  pushMove(m, P(0, 0, 0), P(1, 1, 1), K_FEED, 1, 0, 0, NaN);
  const f = finishMoves(m);
  assert.equal(f.pos.buffer.byteLength, 6 * 4);
  assert.notEqual(f.pos.buffer, m.pos.buffer);
  assert.ok(Number.isNaN(f.seconds[0]));                  // "not timeable" survives as NaN
});

test('the line index maps a line to all its moves, even when they are not adjacent', () => {
  const m = createMoves();
  const lines = [3, 5, 3, 7, 3];
  lines.forEach((l, i) => pushMove(m, P(i, 0, 0), P(i + 1, 0, 0), K_FEED, l, 0, 0, 1));
  const idx = buildLineIndex(finishMoves(m), 8);
  assert.deepEqual(movesOfLine(idx, 3), [0, 2, 4]);
  assert.deepEqual(movesOfLine(idx, 5), [1]);
  assert.deepEqual(movesOfLine(idx, 4), []);
  assert.deepEqual(movesOfLine(idx, 99), []);
});
```

<!-- file: _tests/mill/time.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rapidSeconds, feedRate, feedSeconds, summarizeRows } from '../../js/mill/time.js';
import { MILL_DEFAULTS } from '../../js/mill/settings.js';

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test('rapid: the slowest axis decides, each at its own rate', () => {
  near(rapidSeconds(300, 150, 30, MILL_DEFAULTS), 0.6);
  near(rapidSeconds(0, 0, -100, { ...MILL_DEFAULTS, rapidZ: 12000 }), 0.5);
});

test('feed rate: G94 is F; G95 is F × S; unknown without F, or in G95 without S', () => {
  assert.equal(feedRate({ feedMode: 'min', f: 500 }), 500);
  assert.equal(feedRate({ feedMode: 'rev', f: 0.2, s: 1000 }), 200);
  assert.equal(feedRate({ feedMode: 'min', f: null }), null);
  assert.equal(feedRate({ feedMode: 'min', f: 0 }), null);
  assert.equal(feedRate({ feedMode: 'rev', f: 0.2, s: null }), null);
  near(feedSeconds(100, 500), 12);
  assert.ok(Number.isNaN(feedSeconds(100, null)));
});

test('rows: correction applies to every part; incomplete rows stay out of the total', () => {
  const row = (tool, cut, incomplete) => ({ tool, label: '', firstLine: 1, moveStart: 0, moveEnd: 0, holes: 0, cutLength: 0,
    cutSeconds: cut, rapidSeconds: 2, dwellSeconds: 1, changeSeconds: 5, incomplete });
  const t = summarizeRows([row('T1', 10, false), row('T2', 20, true)], { correctionPct: 10 });
  near(t.rows[0].totalSeconds, (10 + 2 + 1 + 5) * 1.1);
  near(t.total, (10 + 2 + 1 + 5) * 1.1);
  assert.equal(t.incomplete, true);
  assert.equal(t.rows[1].incomplete, true);
});
```

Run: `node --test "_tests/mill/*.test.js"`
Expected: FAIL with `Cannot find module …/js/mill/moves.js`.

- [ ] **Step 2: Write the modules**

<!-- file: js/mill/settings.js -->
```js
// Milling viewer settings and their defaults (spec §2). Pure: no DOM.
export const MILL_DEFAULTS = Object.freeze({
  rapidX: 30000,            // mm/min
  rapidY: 30000,            // mm/min
  rapidZ: 30000,            // mm/min
  toolChangeSeconds: 5,     // s per M6
  correctionPct: 0,         // % added to every timed move
  integerUnit: 'mm',        // numbers without a decimal point: 'mm' or 'um' (least increment)
  peckClearance: 0.5,       // mm: G73 retract and G83 clearance "d" (Fanuc parameters 5114/5115)
  arcTolerance: 0.02,       // mm: end point off the start radius by more than this is an error
  chordError: 0.01,         // mm: arcs are drawn as chords within this error
  maxChords: 256,           // per arc
});

export function millSettings(partial) {
  return { ...MILL_DEFAULTS, ...(partial || {}) };
}

// Size limits (spec §3.4): above either one the program is not analysed and the page says so.
export const MILL_MAX_LINES = 1500000;
export const MILL_MAX_CHARS = 60 * 1024 * 1024;
```

<!-- file: js/mill/moves.js -->
```js
// Growable typed arrays for the milling moves (spec §3.3). One entry per straight chord, in
// execution order. Pure: no DOM; runs in the worker and in Node.
export const K_RAPID = 0;       // G0
export const K_FEED = 1;        // G1/G2/G3 (arcs arrive as chords)
export const K_CFEED = 2;       // feed generated by a drilling cycle
export const K_CRAPID = 3;      // rapid generated by a drilling cycle

export function createMoves(capacity = 4096) {
  return {
    count: 0,
    cap: capacity,
    pos: new Float32Array(capacity * 6),
    kind: new Uint8Array(capacity),
    line: new Uint32Array(capacity),
    row: new Uint16Array(capacity),
    wofs: new Uint8Array(capacity),
    seconds: new Float32Array(capacity),
  };
}

function grow(m) {
  const cap = m.cap * 2;
  const next = (Ctor, old, per = 1) => { const a = new Ctor(cap * per); a.set(old); return a; };
  m.pos = next(Float32Array, m.pos, 6);
  m.kind = next(Uint8Array, m.kind);
  m.line = next(Uint32Array, m.line);
  m.row = next(Uint16Array, m.row);
  m.wofs = next(Uint8Array, m.wofs);
  m.seconds = next(Float32Array, m.seconds);
  m.cap = cap;
}

// a and b are {x, y, z}; seconds may be NaN (not timeable), which is kept as NaN.
export function pushMove(m, a, b, kind, line, row, wofs, seconds) {
  if (m.count === m.cap) grow(m);
  const i = m.count, p = i * 6;
  m.pos[p] = a.x; m.pos[p + 1] = a.y; m.pos[p + 2] = a.z;
  m.pos[p + 3] = b.x; m.pos[p + 4] = b.y; m.pos[p + 5] = b.z;
  m.kind[i] = kind;
  m.line[i] = line;
  m.row[i] = row;
  m.wofs[i] = wofs;
  m.seconds[i] = seconds;
  m.count = i + 1;
  return i;
}

// Exact-length copies, so the worker can transfer the buffers without sending unused capacity.
export function finishMoves(m) {
  const n = m.count;
  return {
    count: n,
    pos: m.pos.slice(0, n * 6),
    kind: m.kind.slice(0, n),
    line: m.line.slice(0, n),
    row: m.row.slice(0, n),
    wofs: m.wofs.slice(0, n),
    seconds: m.seconds.slice(0, n),
  };
}

// CSR map from source line to the moves it produced (a line inside a subprogram called three times
// owns three sets of moves). offsets has lines + 2 entries so line L's moves are
// moves[offsets[L] .. offsets[L + 1]).
export function buildLineIndex(moves, lineCount) {
  const offsets = new Uint32Array(lineCount + 2);
  for (let i = 0; i < moves.count; i++) offsets[moves.line[i] + 1]++;
  for (let l = 1; l < offsets.length; l++) offsets[l] += offsets[l - 1];
  const fill = offsets.slice();
  const list = new Uint32Array(moves.count);
  for (let i = 0; i < moves.count; i++) list[fill[moves.line[i]]++] = i;
  return { offsets, moves: list };
}

export function movesOfLine(index, line) {
  if (!index || line < 0 || line + 1 >= index.offsets.length) return [];
  return Array.from(index.moves.subarray(index.offsets[line], index.offsets[line + 1]));
}
```

<!-- file: js/mill/time.js -->
```js
// Milling time model (spec §7). Seconds per move, then per M6 row and the program total. Pure.

// Every axis moves at its own rapid rate; the slowest axis decides.
export function rapidSeconds(dx, dy, dz, s) {
  return 60 * Math.max(Math.abs(dx) / s.rapidX, Math.abs(dy) / s.rapidY, Math.abs(dz) / s.rapidZ);
}

// mm/min at the current modal state, or null when it can't be known (no F, or G95 without S).
export function feedRate(st) {
  if (!(st.f > 0)) return null;
  if (st.feedMode === 'min') return st.f;
  return st.s > 0 ? st.f * st.s : null;
}

export function feedSeconds(length, rate) {
  return rate ? (60 * length) / rate : NaN;
}

// Rows arrive with raw seconds; the correction % applies to every timed part, as on the lathe.
// A row with an untimeable move is incomplete: it keeps its numbers for reference, but the program
// total leaves it out and is marked "≥" by the page (spec §7).
export function summarizeRows(rows, s) {
  const k = 1 + (s.correctionPct || 0) / 100;
  const out = rows.map(r => {
    const cut = r.cutSeconds * k, rapid = r.rapidSeconds * k, dwell = r.dwellSeconds * k, change = r.changeSeconds * k;
    return {
      tool: r.tool, label: r.label, firstLine: r.firstLine, moveStart: r.moveStart, moveEnd: r.moveEnd,
      cycles: r.holes, cutLength: r.cutLength,
      cutSeconds: cut, rapidSeconds: rapid, dwellSeconds: dwell, changeSeconds: change,
      totalSeconds: cut + rapid + dwell + change, incomplete: r.incomplete,
    };
  });
  const complete = out.filter(r => !r.incomplete);
  return {
    rows: out,
    total: complete.reduce((a, r) => a + r.totalSeconds, 0),
    incomplete: out.some(r => r.incomplete),
  };
}
```

- [ ] **Step 3: Run the tests**

Run: `node --test "_tests/mill/*.test.js"`
Expected: 6 pass.

- [ ] **Step 4: Commit**

```bash
git add js/mill/settings.js js/mill/moves.js js/mill/time.js _tests/mill/moves.test.js _tests/mill/time.test.js
git commit -F - <<'EOF'
Milling viewer: settings, typed move buffer with a line index, and the time model

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 7: Arcs in G17/G18/G19

**Files:**
- Create: `js/mill/arcs.js`
- Test: `_tests/mill/arcs.test.js`

**Interfaces:**
- `PLANES` = `{ 17: { a: 'x', b: 'y', l: 'z', ia: 'I', ib: 'J' }, 18: { a: 'z', b: 'x', l: 'y', ia: 'K', ib: 'I' }, 19: { a: 'y', b: 'z', l: 'x', ia: 'J', ib: 'K' } }`.
- `arcPath(from, to, { plane, ccw, centre: { ca, cb } | null, r | null }, s)` returns `{ points: [{x, y, z}] ending exactly at to, length, radius, error: null | 'radius' }`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/mill/arcs.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arcPath } from '../../js/mill/arcs.js';
import { MILL_DEFAULTS } from '../../js/mill/settings.js';

const S = MILL_DEFAULTS;
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);
const last = arc => arc.points[arc.points.length - 1];

test('G17 G3 quarter circle from I/J: length, radius and an exact end point', () => {
  const arc = arcPath({ x: 10, y: 0, z: 0 }, { x: 0, y: 10, z: 0 }, { plane: 17, ccw: true, centre: { ca: 0, cb: 0 } }, S);
  assert.equal(arc.error, null);
  near(arc.length, 10 * Math.PI / 2, 1e-9);
  assert.deepEqual(last(arc), { x: 0, y: 10, z: 0 });
  for (const p of arc.points) near(Math.hypot(p.x, p.y), 10, 1e-9);
  const mid = arc.points[Math.floor(arc.points.length / 2)];
  assert.ok(mid.x > 0 && mid.y > 0, 'a counter-clockwise quarter from +X to +Y stays in the first quadrant');
});

test('G17 G2 with R: a clockwise half circle from left to right goes over the top', () => {
  const arc = arcPath({ x: 50, y: 10, z: 5 }, { x: 70, y: 10, z: 5 }, { plane: 17, ccw: false, r: 10 }, S);
  assert.equal(arc.error, null);
  near(arc.length, 10 * Math.PI, 1e-9);
  near(Math.max(...arc.points.map(p => p.y)), 20, 0.01);
});

test('a negative R asks for the major arc', () => {
  const arc = arcPath({ x: 10, y: 0, z: 0 }, { x: 0, y: 10, z: 0 }, { plane: 17, ccw: true, r: -10 }, S);
  near(arc.length, 10 * 3 * Math.PI / 2, 1e-9);
  // Centre (10, 10): the 270° way round passes (20, 10) and (10, 20).
  near(Math.max(...arc.points.map(p => p.x)), 20, 0.01);
  near(Math.max(...arc.points.map(p => p.y)), 20, 0.01);
});

test('full circle from I/J with no end change; helical Z interpolates along the sweep', () => {
  const flat = arcPath({ x: 10, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { plane: 17, ccw: true, centre: { ca: 0, cb: 0 } }, S);
  near(flat.length, 2 * Math.PI * 10, 1e-9);
  const helix = arcPath({ x: 10, y: 0, z: 0 }, { x: 10, y: 0, z: -1 }, { plane: 17, ccw: true, centre: { ca: 0, cb: 0 } }, S);
  near(helix.length, Math.hypot(2 * Math.PI * 10, 1), 1e-9);
  assert.deepEqual(last(helix), { x: 10, y: 0, z: -1 });
  const half = helix.points[Math.floor(helix.points.length / 2) - 1];
  near(half.z, -0.5, 0.02);
});

test('G18 G2 runs clockwise as seen from +Y: X10 Z0 → X0 Z10 is a quarter through X7.07 Z7.07', () => {
  const arc = arcPath({ x: 10, y: 0, z: 0 }, { x: 0, y: 0, z: 10 }, { plane: 18, ccw: false, centre: { ca: 0, cb: 0 } }, S);
  assert.equal(arc.error, null);
  near(arc.length, 10 * Math.PI / 2, 1e-9);
  const mid = arc.points.find(p => Math.abs(p.x - p.z) < 0.2);
  assert.ok(mid && mid.x > 7 && mid.z > 7 && mid.y === 0);
});

test('G19 plane: Y and Z move, X is the helical axis', () => {
  const arc = arcPath({ x: 0, y: 10, z: 0 }, { x: 2, y: 0, z: 10 }, { plane: 19, ccw: true, centre: { ca: 0, cb: 0 } }, S);
  assert.equal(arc.error, null);
  near(arc.length, Math.hypot(10 * Math.PI / 2, 2), 1e-9);
  assert.deepEqual(last(arc), { x: 2, y: 0, z: 10 });
});

test('radius errors: R shorter than half the chord, and an end point off the I/J radius', () => {
  const small = arcPath({ x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }, { plane: 17, ccw: true, r: 5 }, S);
  assert.equal(small.error, 'radius');
  assert.deepEqual(small.points, [{ x: 20, y: 0, z: 0 }]);
  const off = arcPath({ x: 10, y: 0, z: 0 }, { x: 0, y: 10.5, z: 0 }, { plane: 17, ccw: true, centre: { ca: 0, cb: 0 } }, S);
  assert.equal(off.error, 'radius');
  assert.deepEqual(last(off), { x: 0, y: 10.5, z: 0 });
});

test('chord count follows the chord error and is capped', () => {
  const r10 = arcPath({ x: 10, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { plane: 17, ccw: true, centre: { ca: 0, cb: 0 } }, S);
  assert.equal(r10.points.length, Math.ceil(2 * Math.PI / (2 * Math.acos(1 - 0.01 / 10))));
  const r500 = arcPath({ x: 500, y: 0, z: 0 }, { x: 500, y: 0, z: 0 }, { plane: 17, ccw: true, centre: { ca: 0, cb: 0 } }, S);
  assert.equal(r500.points.length, 256);
});
```

Run: `node --test "_tests/mill/arcs.test.js"`
Expected: FAIL with `Cannot find module …/js/mill/arcs.js`.

- [ ] **Step 2: Write the module**

<!-- file: js/mill/arcs.js -->
```js
// G2/G3 in the G17/G18/G19 planes, from I/J/K or R, with helical motion on the third axis (spec §4).
// Pure. Coordinates are {x, y, z} in mm.
//
// Each plane is named by its two in-plane axes (a, b), chosen so that a × b points along the plane
// normal: G17 (x, y) → z, G18 (z, x) → y, G19 (y, z) → x. G3 is then counter-clockwise in (a, b)
// as seen from the positive normal, as Fanuc and Haas define it, and G2 is clockwise.
export const PLANES = {
  17: { a: 'x', b: 'y', l: 'z', ia: 'I', ib: 'J' },
  18: { a: 'z', b: 'x', l: 'y', ia: 'K', ib: 'I' },
  19: { a: 'y', b: 'z', l: 'x', ia: 'J', ib: 'K' },
};

const TAU = Math.PI * 2;

// Positive sweep in (0, 2π], or 2π when start and end coincide (a full circle).
function ccwSweep(t0, t1, full) {
  let d = t1 - t0;
  while (d <= 1e-12) d += TAU;
  while (d > TAU) d -= TAU;
  return full ? TAU : d;
}

// centre: { ca, cb } in the plane, or null to use r. Returns
// { points: [{x,y,z}, ...] ending exactly at `to`, length, radius, error: null | 'radius' }.
// On 'radius' the arc is still drawn, with its radius blended from the start to the end radius, so
// the path stays continuous and ends where the program says.
export function arcPath(from, to, { plane = 17, ccw, centre = null, r = null }, s) {
  const P = PLANES[plane];
  const fa = from[P.a], fb = from[P.b], ta = to[P.a], tb = to[P.b];
  let ca, cb, error = null;
  const same = Math.hypot(ta - fa, tb - fb) < 1e-9;

  if (centre) {
    ca = centre.ca; cb = centre.cb;
  } else {
    const R = Math.abs(r);
    const ma = (fa + ta) / 2, mb = (fb + tb) / 2;
    const ua = ta - fa, ub = tb - fb;
    const d = Math.hypot(ua, ub);
    if (same || !(R > 0) || d > 2 * R + s.arcTolerance) {
      return { points: [{ ...to }], length: Math.hypot(ta - fa, tb - fb, to[P.l] - from[P.l]), radius: R, error: 'radius' };
    }
    const h = Math.sqrt(Math.max(0, R * R - (d / 2) * (d / 2)));
    // Left of the chord for a counter-clockwise minor arc (R > 0), right for a clockwise one;
    // a negative R asks for the major arc, which flips the side.
    const side = (ccw ? 1 : -1) * (r > 0 ? 1 : -1);
    ca = ma + side * (-ub / d) * h;
    cb = mb + side * (ua / d) * h;
  }

  const r0 = Math.hypot(fa - ca, fb - cb);
  const r1 = Math.hypot(ta - ca, tb - cb);
  if (Math.abs(r0 - r1) > s.arcTolerance) error = 'radius';
  const t0 = Math.atan2(fb - cb, fa - ca);
  const t1 = Math.atan2(tb - cb, ta - ca);
  const full = centre !== null && same;
  const sweep = ccw ? ccwSweep(t0, t1, full) : -ccwSweep(t1, t0, full);

  const rMax = Math.max(r0, r1, 1e-9);
  const step = 2 * Math.acos(Math.max(-1, 1 - s.chordError / rMax));
  const n = Math.min(s.maxChords, Math.max(1, Math.ceil(Math.abs(sweep) / step)));
  const dl = to[P.l] - from[P.l];
  const points = [];
  for (let i = 1; i <= n; i++) {
    if (i === n) { points.push({ ...to }); break; }
    const f = i / n, t = t0 + sweep * f, rr = r0 + (r1 - r0) * f;
    const p = { x: 0, y: 0, z: 0 };
    p[P.a] = ca + rr * Math.cos(t);
    p[P.b] = cb + rr * Math.sin(t);
    p[P.l] = from[P.l] + dl * f;
    points.push(p);
  }
  const arcLen = ((r0 + r1) / 2) * Math.abs(sweep);
  return { points, length: Math.hypot(arcLen, dl), radius: r0, error };
}
```

- [ ] **Step 3: Run the tests**

Run: `node --test "_tests/mill/arcs.test.js"`
Expected: 8 pass.

- [ ] **Step 4: Commit**

```bash
git add js/mill/arcs.js _tests/mill/arcs.test.js
git commit -F - <<'EOF'
Milling viewer: arcs in all three planes, helical motion and the radius check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 8: One hole → the moves the control makes

**Files:**
- Create: `js/mill/cycles.js`
- Test: `_tests/mill/cycles.test.js`

**Interfaces:**
- `DRILL_CODES`, `PECK_CODES` = {73, 83}, `APPROXIMATED` = {76, 87, 88}.
- `holeMoves(code, { from, x, y, initZ, r, z, q, p, retLevel, clearance })` returns `[{ kind: 'crapid' | 'cfeed' | 'dwell', to?, seconds? }]`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/mill/cycles.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { holeMoves } from '../../js/mill/cycles.js';

// Compact form of the move list: 'R' = cycle rapid, 'F' = cycle feed, then the Z; 'D' = dwell seconds.
const seq = moves => moves.map(m => (m.kind === 'dwell' ? `D${m.seconds}` : `${m.kind === 'crapid' ? 'R' : 'F'}${m.to.z}`));
const base = { from: { x: 10, y: 10, z: 2 }, x: 10, y: 10, initZ: 50, r: 2, z: -10, q: null, p: null, retLevel: 98, clearance: 0.5 };

test('G81 from a new position: XY at the current level, down to R, feed, rapid back to the initial level', () => {
  const moves = holeMoves(81, { ...base, from: { x: 0, y: 0, z: 50 } });
  assert.deepEqual(moves[0], { kind: 'crapid', to: { x: 10, y: 10, z: 50 } });
  assert.deepEqual(seq(moves), ['R50', 'R2', 'F-10', 'R50']);
});

test('G99 returns to R instead of the initial level', () => {
  assert.deepEqual(seq(holeMoves(81, { ...base, retLevel: 99 })), ['F-10', 'R2']);
});

test('G82 dwells at the bottom', () => {
  assert.deepEqual(seq(holeMoves(82, { ...base, p: 0.5 })), ['F-10', 'D0.5', 'R50']);
});

test('G83 pecks: full retract to R, back down to d above the last depth, feed on', () => {
  assert.deepEqual(seq(holeMoves(83, { ...base, q: 5 })),
    ['F-3', 'R2', 'R-2.5', 'F-8', 'R2', 'R-7.5', 'F-10', 'R50']);
});

test('G73 pecks: retract d only (chip break)', () => {
  assert.deepEqual(seq(holeMoves(73, { ...base, q: 5 })), ['F-3', 'R-2.5', 'F-8', 'R-7.5', 'F-10', 'R50']);
});

test('a peck cycle without Q drills in one feed (the caller reports peck-no-q)', () => {
  assert.deepEqual(seq(holeMoves(83, { ...base, q: null })), ['F-10', 'R50']);
});

test('G84 and G74 tap in and out at feed, then G98 rapids to the initial level', () => {
  assert.deepEqual(seq(holeMoves(84, base)), ['F-10', 'F2', 'R50']);
  assert.deepEqual(seq(holeMoves(74, { ...base, retLevel: 99, p: 0.2 })), ['F-10', 'D0.2', 'F2']);
});

test('G85 feeds out; G89 dwells and feeds out; G86 rapids out', () => {
  assert.deepEqual(seq(holeMoves(85, base)), ['F-10', 'F2', 'R50']);
  assert.deepEqual(seq(holeMoves(89, { ...base, p: 1 })), ['F-10', 'D1', 'F2', 'R50']);
  assert.deepEqual(seq(holeMoves(86, base)), ['F-10', 'R50']);
});

test('G76, G87 and G88 are approximated as feed in, rapid out (G88 and G76 keep the dwell)', () => {
  assert.deepEqual(seq(holeMoves(76, { ...base, p: 0.3 })), ['F-10', 'D0.3', 'R50']);
  assert.deepEqual(seq(holeMoves(87, base)), ['F-10', 'R50']);
  assert.deepEqual(seq(holeMoves(88, { ...base, p: 1 })), ['F-10', 'D1', 'R50']);
});
```

Run: `node --test "_tests/mill/cycles.test.js"`
Expected: FAIL with `Cannot find module …/js/mill/cycles.js`.

- [ ] **Step 2: Write the module**

<!-- file: js/mill/cycles.js -->
```js
// Drilling cycles G73/G74/G76/G81–G89 in G17 (spec §5). Pure: turns one hole into the moves the
// control makes. The research notes in _docs/gcode-viewer/mill-cycles/ are the source for each
// sequence; this file follows them.
export const DRILL_CODES = new Set([73, 74, 76, 81, 82, 83, 84, 85, 86, 87, 88, 89]);
export const PECK_CODES = new Set([73, 83]);
export const APPROXIMATED = new Set([76, 87, 88]);

// One hole. from: the current position {x, y, z}. Returns [{ kind: 'crapid' | 'cfeed' | 'dwell',
// to?: {x, y, z}, seconds? }], ending at the return level (G98: initial level, G99: R).
// q is the peck depth (G73/G83); null or 0 makes a peck cycle drill in one feed (the caller has
// already raised peck-no-q). p is the dwell in seconds, or null.
export function holeMoves(code, { from, x, y, initZ, r, z, q, p, retLevel, clearance }) {
  const out = [];
  const at = zz => ({ x, y, z: zz });
  const rapid = zz => out.push({ kind: 'crapid', to: at(zz) });
  const feed = zz => out.push({ kind: 'cfeed', to: at(zz) });
  const dwell = () => { if (p > 0) out.push({ kind: 'dwell', seconds: p }); };
  const retZ = retLevel === 99 ? r : initZ;

  // Position over the hole at the current level, then down (or up) to R.
  if (from.x !== x || from.y !== y) out.push({ kind: 'crapid', to: { x, y, z: from.z } });
  if (from.z !== r) rapid(r);

  const peck = PECK_CODES.has(code) && q > 0;
  if (peck) {
    let depth = r, first = true;
    while (depth > z + 1e-9) {
      const target = Math.max(depth - q, z);
      if (!first) {
        if (code === 83) rapid(r);                       // full retract to R after every peck
        rapid(depth + clearance);                        // G83: back down near the last depth; G73: retract d
      }
      feed(target);
      depth = target;
      first = false;
    }
    rapid(retZ);
    return out;
  }

  feed(z);
  switch (code) {
    case 82: case 88: case 76: dwell(); rapid(retZ); break;
    case 84: case 74: dwell(); feed(r); if (retLevel === 98) rapid(initZ); break;   // tap out at feed
    case 85: feed(r); if (retLevel === 98) rapid(initZ); break;
    case 89: dwell(); feed(r); if (retLevel === 98) rapid(initZ); break;
    default: rapid(retZ);                                // 81, 86, 87, and peck cycles without Q
  }
  return out;
}
```

- [ ] **Step 3: Run the tests**

Run: `node --test "_tests/mill/cycles.test.js"`
Expected: 9 pass.

- [ ] **Step 4: Commit**

```bash
git add js/mill/cycles.js _tests/mill/cycles.test.js
git commit -F - <<'EOF'
Milling viewer: drilling cycles G73/G74/G76/G81-G89 expanded into moves

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 9: The engine: modal state, subprograms, checks and the pipeline

**Files:**
- Create: `js/mill/machine.js`, `js/mill/subprograms.js`, `js/mill/checks.js`, `js/mill/analyze.js`
- Test: `_tests/mill/machine.test.js`, `_tests/mill/drill.test.js`, `_tests/mill/subprograms.test.js`, `_tests/mill/checks.test.js`, `_tests/mill/analyze.test.js`

**Interfaces:**
- Consumes `parseLine(raw, line)` from `js/gcode/parse.js`, unchanged. It returns `{ line, n, o, words: [{ letter, value, raw, hasDecimal }], comment, raw, skipped }`.
- Produces `analyzeMill(text, settings, { onProgress(done, total) })` returning a `MillResult`:
  - `lines`, `units` ('mm' or 'inch'), `tooLarge`, `control` ('fanuc' or 'haas');
  - `moves` (the Task 6 shape), `lineIndex`, `bounds`, `cutBounds`;
  - `timing: { rows, total, incomplete }`;
  - `workOffsets: string[]`;
  - `warnings: [{ line, id, severity, params }]`;
  - `markers: [{ x, y, z, line, id }]`;
  - `cycles` (holes drilled), `stats: { skipped }`.
- Also produces:
  - `MILL_SEVERITY` (18 ids) and `WARN_CAP` = 200;
  - `MAX_DEPTH` = 4, `indexPrograms(lines)`, `indexSequenceNumbers(lines)`.

The four modules only work together (`analyze` drives `machine` and `subprograms`, then `checks` finalises), so they form one task. The five test files pin the behaviour of spec §4–§7, the Review Focus inputs, and every check id (spec §10.3).

- [ ] **Step 1: Write the failing tests**

<!-- file: _tests/mill/machine.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMill } from '../../js/mill/analyze.js';

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);
const end = (r, i) => Array.from(r.moves.pos.slice(i * 6 + 3, i * 6 + 6));
const start = (r, i) => Array.from(r.moves.pos.slice(i * 6, i * 6 + 3));

test('nothing is drawn until X, Y and Z are all known', () => {
  const r = analyzeMill('G90 G0 X10 Y10\nZ5\nG1 Z0 F100');
  assert.equal(r.moves.count, 1);
  assert.deepEqual(start(r, 0), [10, 10, 5]);
  assert.deepEqual(end(r, 0), [10, 10, 0]);
});

test('G91 moves are incremental from the current position', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z10\nG91 G1 X10 F100\nX10');
  assert.equal(r.moves.count, 2);
  assert.deepEqual(end(r, 1), [20, 0, 10]);
});

test('G20 converts lengths and feed to mm; the result is marked inch', () => {
  const r = analyzeMill('G20 G90 G0 X0 Y0 Z1\nG1 X1 F10');
  assert.equal(r.units, 'inch');
  near(end(r, 0)[0], 25.4, 1e-4);
  near(r.moves.seconds[0], 6, 1e-4);                    // 25.4 mm at 254 mm/min
});

test('numbers without a decimal point follow the integer-unit setting', () => {
  const src = 'G90 G0 X0 Y0 Z0\nG1 X1000 F100';
  assert.equal(end(analyzeMill(src), 0)[0], 1000);
  assert.equal(end(analyzeMill(src, { integerUnit: 'um' }), 0)[0], 1);
  assert.equal(end(analyzeMill('G90 G0 X0 Y0 Z0\nG1 X1000. F100', { integerUnit: 'um' }), 0)[0], 1000);
});

test('G52 shifts the local origin; G92 redefines the current position', () => {
  const g52 = analyzeMill('G52 X100\nG90 G0 X0 Y0 Z0\nG1 X10 F100');
  assert.deepEqual(start(g52, 0), [100, 0, 0]);
  assert.deepEqual(end(g52, 0), [110, 0, 0]);
  const g92 = analyzeMill('G90 G0 X10 Y0 Z0\nG92 X0\nG1 X5 F100');
  assert.deepEqual(start(g92, 0), [10, 0, 0]);
  assert.deepEqual(end(g92, 0), [15, 0, 0]);
});

test('G28 makes the commanded axes unknown; a new work offset makes the position unknown', () => {
  const home = analyzeMill('G90 G0 X0 Y0 Z10\nG1 Z0 F100\nG91 G28 Z0\nG90 G0 X50');
  assert.equal(home.moves.count, 1);
  const wofs = analyzeMill('G90 G54 G0 X0 Y0 Z10\nG1 Z0 F100\nG55 G0 X0 Y0\nZ10\nG1 Z0');
  assert.equal(wofs.moves.count, 2);
  assert.deepEqual(Array.from(wofs.moves.wofs), [0, 1]);
  assert.deepEqual(wofs.workOffsets, ['G54', 'G55']);
});

test('rapid time: the slowest axis decides', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z0\nX300 Y150 Z30');
  near(r.moves.seconds[0], 0.6, 1e-6);                  // 300 mm at 30,000 mm/min
});

test('feed time in G94 and G95; G95 without S is not timeable', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z0\nG94 G1 X100 F500\nG95 G1 X200 F0.2 S1000');
  near(r.moves.seconds[0], 12, 1e-4);
  near(r.moves.seconds[1], 30, 1e-4);
  const noS = analyzeMill('G90 G0 X0 Y0 Z0\nG95 G1 X100 F0.2');
  assert.equal(noS.timing.rows[0].incomplete, true);
  assert.equal(noS.warnings.some(w => w.id === 'no-feed'), false);
});

test('G4 dwell counts in the row: P without a decimal point in ms, X in seconds', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z0\nG4 P1500\nG4 X0.5');
  near(r.timing.rows[0].dwellSeconds, 2, 1e-9);
});

test('rows per M6 with the lathe label rule, contiguous move ranges and tool-change time', () => {
  const src = ['%', 'O0001 (PART)', '(ROUGH)', 'T1 M6', 'G0 X0 Y0 Z0 S1000 M3', 'G1 X10 F100',
    'T2 M6 (FINISH)', 'G1 X20', 'T3 M6', '(DRILL)', 'G1 X30', 'M30'].join('\n');
  const r = analyzeMill(src);
  const rows = r.timing.rows;
  assert.deepEqual(rows.map(x => [x.tool, x.label, x.firstLine]), [['T1', 'ROUGH', 4], ['T2', 'FINISH', 7], ['T3', 'DRILL', 9]]);
  assert.deepEqual(rows.map(x => [x.moveStart, x.moveEnd]), [[0, 1], [1, 2], [2, 3]]);
  near(rows[0].changeSeconds, 5, 1e-9);
  near(rows[0].totalSeconds, 6 + 5, 1e-4);               // 10 mm at F100, plus the M6
  near(r.timing.total, 3 * 11, 1e-3);
});

test('correction % applies to every timed part of a row', () => {
  const r = analyzeMill('T1 M6\nG0 X0 Y0 Z0\nG1 X10 F100', { correctionPct: 10 });
  near(r.timing.rows[0].totalSeconds, (6 + 5) * 1.1, 1e-4);
});

test('a comment on the O line never labels a tool', () => {
  const r = analyzeMill('O0001 (PART NAME)\nG21\nT1 M6\nG0 X0 Y0 Z0\nG1 X10 F100\n(OD ROUGH)');
  assert.equal(r.timing.rows[0].label, 'OD ROUGH');
});

test('arcs arrive as chords sharing the arc time; the line index maps the arc line to all of them', () => {
  const r = analyzeMill('G90 G0 X10 Y0 Z0\nG3 X10 Y0 I-10 J0 F600');
  const chords = r.moves.count;
  assert.ok(chords > 20);
  const total = Array.from(r.moves.seconds).reduce((a, b) => a + b, 0);
  near(total, 60 * (2 * Math.PI * 10) / 600, 1e-3);
  assert.equal(r.lineIndex.offsets[3] - r.lineIndex.offsets[2], chords);
});

// ---- Review Focus (plan): inputs real programs send that the spec does not spell out ----

test('next-tool preselect: "T1 M6" then "T2" at once, "M6" later — rows and H follow the loaded tool', () => {
  const src = ['T1 M6', 'T2', 'G0 X0 Y0 S1000 M3', 'G43 Z50 H1', 'G1 Z0 F100', 'X10', 'M6', 'G0 X0 Y0 S1000 M3', 'G43 Z50 H2', 'G1 Z0 F100'].join('\n');
  const r = analyzeMill(src);
  assert.deepEqual(r.timing.rows.map(x => x.tool), ['T1', 'T2']);
  assert.equal(r.warnings.some(w => w.id === 'h-mismatch'), false);
});

test('rotary words that never move (A0. in a safe-start line) are not flagged; a real A move is', () => {
  const parked = analyzeMill('G0 G90 G54 X0 Y0 A0. S1000 M3\nG43 Z50 H1\nG1 Z0 F100\nX10\nG0 A0.');
  assert.deepEqual(parked.warnings.map(w => w.id), []);
  assert.equal(parked.timing.rows[0].incomplete, false);
  const moved = analyzeMill('G0 X0 Y0 Z0 A0 S1000 M3\nG1 X10 F100\nG0 A90.');
  assert.deepEqual(moved.warnings.map(w => [w.id, w.params.code]), [['unsupported', 'A']]);
  assert.equal(moved.timing.rows[0].incomplete, true);
});

test('messy formatting reads the same as tidy code: lowercase, glued words, tabs, ; comments, CRLF', () => {
  const tidy = analyzeMill('G90 G0 X0 Y0 Z5 S1000 M3\nG1 Z-1 F200\nX50 Y20\nG0 Z5');
  const messy = analyzeMill('g90g0x0y0z5s1000m3 ; start\r\n\tg1z-1.f200\r\nx50.  y20.\r\ng0 z5 (up)');
  assert.deepEqual(Array.from(messy.moves.pos), Array.from(tidy.moves.pos));
  assert.deepEqual(messy.warnings, tidy.warnings);
});

test('garbage input (a binary file read as text) gives an empty result, never a throw', () => {
  let junk = '';
  for (let i = 0; i < 20000; i++) junk += String.fromCharCode((i * 7919) % 256);
  const r = analyzeMill(junk);
  assert.equal(typeof r.moves.count, 'number');
  assert.equal(r.tooLarge, false);
});
```

<!-- file: _tests/mill/drill.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMill } from '../../js/mill/analyze.js';
import { K_CFEED } from '../../js/mill/moves.js';

const zs = r => Array.from({ length: r.moves.count }, (_, i) => r.moves.pos[i * 6 + 5]);
const feeds = r => Array.from(r.moves.kind).filter(k => k === K_CFEED).length;
const ids = r => r.warnings.map(w => w.id);

test('G99 returns to R between holes, G98 to the initial level; the initial level is fixed at cycle start', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z50\nG99 G81 X10 Y10 Z-10 R2 F100\nX20\nG98 X30\nG80\nG0 Z60');
  assert.equal(r.cycles, 3);
  assert.equal(feeds(r), 3);
  assert.deepEqual(zs(r), [50, 2, -10, 2, 2, -10, 2, 2, -10, 50, 60]);
});

test('G91: R from the initial level, Z from R, X/Y incremental per K repeat', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z10\nG91 G99 G81 X10 Z-5 R-8 K3 F100\nG80 G90');
  assert.equal(r.cycles, 3);
  const bottoms = [];
  for (let i = 0; i < r.moves.count; i++) {
    if (r.moves.kind[i] === K_CFEED) bottoms.push([r.moves.pos[i * 6 + 3], r.moves.pos[i * 6 + 5]]);
  }
  assert.deepEqual(bottoms, [[10, -3], [20, -3], [30, -3]]);
});

test('K0 stores the cycle without drilling; the next X/Y block drills', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z10\nG81 X10 Y0 Z-5 R2 F100 K0\nX20\nG80');
  assert.equal(r.cycles, 1);
});

test('G0 cancels the cycle: the next block is a plain rapid', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z10\nG81 X10 Y0 Z-5 R2 F100\nG0 X50');
  assert.equal(r.cycles, 1);
  assert.equal(r.moves.pos[(r.moves.count - 1) * 6 + 3], 50);
});

test('peck cycles draw every peck', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z10\nG98 G83 X0 Y0 Z-10 R2 Q5 F100');
  assert.equal(feeds(r), 3);                               // 2 → -3 → -8 → -10
});

test('a missing R draws from the current level and reports cycle-no-r; the row time becomes "–"', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z10\nG81 X10 Y0 Z-5 F100');
  assert.ok(ids(r).includes('cycle-no-r'));
  assert.equal(feeds(r), 1);
  assert.equal(r.timing.rows[0].incomplete, true);
  assert.equal(r.markers.length, 1);
});

test('a peck cycle without Q reports peck-no-q and drills in one feed', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z10\nG83 X10 Y0 Z-5 R2 F100');
  assert.ok(ids(r).includes('peck-no-q'));
  assert.equal(feeds(r), 1);
});

test('a cycle with no known start level starts from R and reports cycle-no-start', () => {
  const r = analyzeMill('G81 X10 Y0 Z-5 R2 F100');
  assert.ok(ids(r).includes('cycle-no-start'));
  assert.equal(feeds(r), 1);
});

test('G76/G87/G88 are approximated; drilling in G18 is not interpreted', () => {
  assert.ok(analyzeMill('G90 G0 X0 Y0 Z10\nG76 X10 Y0 Z-5 R2 Q0.1 F100').warnings
    .some(w => w.id === 'approximated' && w.params.code === 'G76'));
  const g18 = analyzeMill('G90 G0 X0 Y0 Z10\nG18 G81 X10 Y0 Z-5 R2 F100');
  assert.ok(g18.warnings.some(w => w.id === 'unsupported' && w.params.code === 'G81'));
  assert.equal(g18.cycles, 0);
});

test('G84.2/G84.3 are read as G84/G74 tapping', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z10\nG98 G84.2 X10 Y0 Z-5 R2 F100');
  assert.equal(r.cycles, 1);
  assert.equal(feeds(r), 2);                               // tap in, tap out
});

test('hole time: feed moves at F, rapids at the rapid rate', () => {
  const r = analyzeMill('G90 G0 X10 Y0 Z10\nG98 G81 X10 Y0 Z-5 R2 F100');
  const sec = Array.from(r.moves.seconds);
  // rapid 10 → 2 (8 mm at 30,000 mm/min), feed 2 → -5 (7 mm at 100 mm/min), rapid -5 → 10 (15 mm)
  assert.ok(Math.abs(sec[0] - 0.016) < 1e-6 && Math.abs(sec[1] - 4.2) < 1e-6 && Math.abs(sec[2] - 0.03) < 1e-6);
});
```

<!-- file: _tests/mill/subprograms.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMill } from '../../js/mill/analyze.js';
import { indexPrograms, indexSequenceNumbers } from '../../js/mill/subprograms.js';

const lastX = r => r.moves.pos[(r.moves.count - 1) * 6 + 3];
const ids = r => r.warnings.map(w => w.id);
const SUB = ['O1000', 'G91 G1 X10 F100', 'G90', 'M99'];

test('indexes: O lines (and ":" program numbers), N numbers for M97', () => {
  assert.deepEqual([...indexPrograms(['%', 'O0001', 'G0 X0', ':2000', 'o3000 (SUB)'])], [[1, 1], [2000, 3], [3000, 4]]);
  assert.deepEqual([...indexSequenceNumbers(['N10 G0 X0', '/N20 X1', 'G1 X2'])], [[10, 0], [20, 1]]);
});

test('M98 P1000 L2 runs the subprogram twice; its line owns both moves', () => {
  const r = analyzeMill(['O0001', 'G90 G0 X0 Y0 Z0 S1000 M3', 'M98 P1000 L2', 'M30', ...SUB].join('\n'));
  assert.equal(r.moves.count, 2);
  assert.equal(lastX(r), 20);
  assert.equal(r.lineIndex.offsets[7] - r.lineIndex.offsets[6], 2);
  assert.deepEqual(ids(r), []);
});

test('the older M98 P<repeat><oooo> form', () => {
  const r = analyzeMill(['G90 G0 X0 Y0 Z0', 'M98 P21000', 'M30', ...SUB].join('\n'));
  assert.equal(lastX(r), 20);
});

test('Haas M97 jumps to a sequence number and returns at M99', () => {
  const r = analyzeMill(['G90 G0 X0 Y0 Z0', 'M97 P100', 'M30', 'N100 G91 G1 X5 F100', 'G90', 'M99'].join('\n'));
  assert.equal(r.moves.count, 1);
  assert.equal(lastX(r), 5);
  assert.equal(r.control, 'haas');
});

test('a call to a subprogram that is not in the file is reported and skipped', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z0 S1000 M3\nM98 P2000\nG1 X10 F100\nM30');
  assert.deepEqual(r.warnings.map(w => [w.id, w.params.p]), [['sub-missing', 2000]]);
  assert.equal(lastX(r), 10);
});

test('recursion stops at nesting depth 4 with sub-loop', () => {
  const r = analyzeMill(['G90 G0 X0 Y0 Z0', 'M98 P1000', 'M30', 'O1000', 'M98 P1000', 'M99'].join('\n'));
  assert.ok(ids(r).includes('sub-loop'));
});

test('M99 in the main program ends it with an info note', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z0 S1000 M3\nG1 X10 F100\nM99\nG1 X20');
  assert.deepEqual(ids(r), ['main-m99']);
  assert.equal(lastX(r), 10);
});
```

<!-- file: _tests/mill/checks.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMill } from '../../js/mill/analyze.js';
import { MILL_SEVERITY, WARN_CAP } from '../../js/mill/checks.js';

const ids = src => analyzeMill(src).warnings.map(w => w.id);

// Every check fires on its bad program and stays silent on the good one (spec §10.3).
const CASES = {
  'no-g43': ['T1 M6\nG0 X0 Y0 S1000 M3\nZ50\nG1 Z0 F100', 'T1 M6\nG0 X0 Y0 S1000 M3\nG43 Z50 H1\nG1 Z0 F100'],
  'h-mismatch': ['T1 M6\nG43 Z50 H2', 'T1 M6\nG43 Z50 H1'],
  'spindle-off': ['T1 M6\nG0 X0 Y0\nG43 Z5 H1\nG1 Z0 F100', 'T1 M6\nG0 X0 Y0 S1000 M3\nG43 Z5 H1\nG1 Z0 F100'],
  'no-feed': ['G0 X0 Y0 Z0 S1000 M3\nG1 X10', 'G0 X0 Y0 Z0 S1000 M3\nG1 X10 F100'],
  'comp-no-d': ['G0 X0 Y0 Z0\nG41 G1 X10 F100', 'G0 X0 Y0 Z0\nG41 D1 G1 X10 F100'],
  'comp-left-on': ['G0 X0 Y0 Z0 S1000 M3\nG41 D1 G1 X10 F100\nM30', 'G0 X0 Y0 Z0 S1000 M3\nG41 D1 G1 X10 F100\nG40 G1 X20\nM30'],
  'rapid-into-material': ['G0 X0 Y0 Z5 S1000 M3\nG1 Z-5 F100\nG0 Z-8', 'G0 X0 Y0 Z5 S1000 M3\nG1 Z-5 F100\nG0 Z5'],
  'arc-radius': ['G0 X10 Y0 Z0 S1000 M3\nG3 X0 Y10.5 I-10 J0 F100', 'G0 X10 Y0 Z0 S1000 M3\nG3 X0 Y10 I-10 J0 F100'],
  'cycle-no-r': ['G0 X0 Y0 Z10 S1000 M3\nG81 X10 Y0 Z-5 F100', 'G0 X0 Y0 Z10 S1000 M3\nG81 X10 Y0 Z-5 R2 F100'],
  'peck-no-q': ['G0 X0 Y0 Z10 S1000 M3\nG83 X10 Y0 Z-5 R2 F100', 'G0 X0 Y0 Z10 S1000 M3\nG83 X10 Y0 Z-5 R2 Q2 F100'],
  'cycle-no-start': ['S1000 M3\nG81 X10 Y0 Z-5 R2 F100', 'G0 X0 Y0 Z10 S1000 M3\nG81 X10 Y0 Z-5 R2 F100'],
  'sub-missing': ['M98 P2000', 'M98 P2000\nM30\nO2000\nM99'],
  'sub-loop': ['M98 P1000\nM30\nO1000\nM98 P1000\nM99', 'M98 P1000\nM30\nO1000\nM99'],
  'main-m99': ['G0 X0 Y0 Z0\nM99', 'G0 X0 Y0 Z0\nM30'],
  'unsupported': ['G0 X0 Y0 Z0\nG68 X0 Y0 R45', 'G0 X0 Y0 Z0\nG69'],
  'approximated': ['G0 X0 Y0 Z10 S1000 M3\nG76 X10 Y0 Z-5 R2 Q0.1 F100', 'G0 X0 Y0 Z10 S1000 M3\nG86 X10 Y0 Z-5 R2 F100'],
  'skipped': ['#100 = 5', '(COMMENT)'],
  'lathe-program': ['G18 G96 S200\nG0 X50 Z2\nG1 Z-10 F0.2', 'G17 G0 X0 Y0 Z0'],
};

test('every check id has a case (and every case is a real id)', () => {
  assert.deepEqual(Object.keys(CASES).sort(), Object.keys(MILL_SEVERITY).sort());
});

for (const [id, [bad, good]] of Object.entries(CASES)) {
  test(`${id}: fires on the bad program, silent on the good one`, () => {
    assert.ok(ids(bad).includes(id), `${id} did not fire: ${ids(bad)}`);
    assert.ok(!ids(good).includes(id), `${id} fired on the good program`);
  });
}

test('warnings are capped per id, with one "more" entry carrying the rest', () => {
  // The first A value only sets the reference, so WARN_CAP + 51 lines give WARN_CAP + 50 changes.
  const src = ['G0 X0 Y0 Z0', ...Array.from({ length: WARN_CAP + 51 }, (_, i) => `G0 A${i}`)].join('\n');
  const ws = analyzeMill(src).warnings;
  assert.equal(ws.filter(w => w.id === 'unsupported').length, WARN_CAP);
  const more = ws.filter(w => w.id === 'more');
  assert.deepEqual(more.map(w => w.params), [{ count: 50, of: 'unsupported' }]);
  assert.equal(more[0].severity, 'info');
});

test('severities follow spec §6', () => {
  assert.equal(MILL_SEVERITY['no-feed'], 'error');
  assert.equal(MILL_SEVERITY['h-mismatch'], 'info');
  assert.equal(MILL_SEVERITY['rapid-into-material'], 'warn');
  assert.equal(MILL_SEVERITY['arc-radius'], 'error');
});
```

<!-- file: _tests/mill/analyze.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMill, MILL_MAX_LINES } from '../../js/mill/analyze.js';
import { movesOfLine } from '../../js/mill/moves.js';

test('bounds cover every move; cutBounds only the cutting moves', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z50\nZ2\nG1 Z-5 F100\nX40 Y20\nG0 Z50');
  assert.deepEqual(r.bounds, { min: [0, 0, -5], max: [40, 20, 50] });
  assert.deepEqual(r.cutBounds, { min: [0, 0, -5], max: [40, 20, 2] });
});

test('the line index lists each line\'s moves in execution order', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z10\nG98 G81 X10 Y0 Z-5 R2 F100\nX20');
  assert.deepEqual(movesOfLine(r.lineIndex, 2), [0, 1, 2, 3]);
  assert.deepEqual(movesOfLine(r.lineIndex, 3), [4, 5, 6, 7]);
  assert.deepEqual(movesOfLine(r.lineIndex, 1), []);
});

test('rows partition the moves: contiguous, in order, covering all of them', () => {
  const r = analyzeMill('G0 X0 Y0 Z0\nG1 X5 F100\nT1 M6\nG1 X10\nT2 M6\nG1 X20\nG1 X30');
  const rows = r.timing.rows;
  assert.equal(rows[0].moveStart, 0);
  for (let i = 1; i < rows.length; i++) assert.equal(rows[i].moveStart, rows[i - 1].moveEnd);
  assert.equal(rows[rows.length - 1].moveEnd, r.moves.count);
});

test('too large: over the line cap nothing is analysed', () => {
  const r = analyzeMill('\n'.repeat(MILL_MAX_LINES));
  assert.equal(r.tooLarge, true);
  assert.equal(r.moves.count, 0);
});

test('control: Haas-only codes mark the program as Haas, otherwise Fanuc', () => {
  assert.equal(analyzeMill('G154 P1 G0 X0 Y0 Z0').control, 'haas');
  assert.equal(analyzeMill('G54 G0 X0 Y0 Z0').control, 'fanuc');
});

test('empty and comment-only programs give an empty, valid result', () => {
  for (const src of ['', '%\n(ONLY A COMMENT)\n%']) {
    const r = analyzeMill(src);
    assert.equal(r.moves.count, 0);
    assert.equal(r.bounds, null);
    assert.deepEqual(r.timing, { rows: [], total: 0, incomplete: false });
  }
});

test('progress is reported every 50,000 executed lines', () => {
  const calls = [];
  analyzeMill('G0 X0 Y0 Z0\n'.repeat(120000), {}, { onProgress: (done, total) => calls.push([done, total]) });
  assert.deepEqual(calls.map(c => c[0]), [50000, 100000]);
});
```

Run: `node --test "_tests/mill/*.test.js"`
Expected: the five new files FAIL with `Cannot find module …/js/mill/analyze.js`; the Task 6–8 files still pass.

- [ ] **Step 2: Write the four modules**

<!-- file: js/mill/machine.js -->
```js
// Milling modal state and motion (spec §4). Pure: one parsed block in, moves and events out.
// Coordinates are program coordinates of the active work offset (tool tip, uncompensated), in mm.
import { K_RAPID, K_FEED, K_CFEED, K_CRAPID, createMoves, pushMove } from './moves.js';
import { rapidSeconds, feedRate, feedSeconds } from './time.js';
import { arcPath, PLANES } from './arcs.js';
import { holeMoves, DRILL_CODES, PECK_CODES, APPROXIMATED } from './cycles.js';

const AXES = ['x', 'y', 'z'];
const UNSUPPORTED_G = new Set([7.1, 10, 12, 12.1, 13, 16, 47, 51, 51.1, 65, 66, 68, 70, 71, 72, 107, 112, 150]);
const HAAS_G = new Set([12, 13, 47, 150, 154, 187]);
// Blocks whose axis words are data, not a move.
const NON_MOTION_G = new Set([4, 10, 28, 30, 52, 53, 65, 66, 92]);
const DRILL_ALIAS = new Map([[84.2, 84], [84.3, 74]]);

export function createMillState() {
  return {
    pos: { x: null, y: null, z: null },
    motion: 0, cycle: null, plane: 17, abs: true, inch: false, feedMode: 'min',
    f: null, s: null, spindle: 'off',
    wofs: 0, g52: { x: 0, y: 0, z: 0 }, g92: { x: 0, y: 0, z: 0 },
    lengthComp: false, h: null, radiusComp: 40, d: null, retLevel: 98,
    tNext: null, tool: null,
    cyc: { initZ: null, r: null, z: null, q: null, p: null },
  };
}

export function newMillContext(settings) {
  return {
    s: settings, st: createMillState(), moves: createMoves(),
    rows: [], row: -1, events: [], markers: [],
    wofsNames: ['G54'], minCutZ: Infinity, holes: 0,
    lastComment: null, pendingLabelRow: -1, sawInch: false,
    rotary: { A: null, B: null, C: null, U: null, V: null, W: null },
    flags: { hasY: false, latheLine: null, planes: new Set(), haas: false },
    block: null,
  };
}

export function millEvent(ctx, id, params = {}, line = ctx.block ? ctx.block.line : null) {
  ctx.events.push({ line, id, params });
}

const known = p => p.x !== null && p.y !== null && p.z !== null;

// A length word in mm: the "numbers without a decimal point" setting and inch input apply (spec §4).
function len(ctx, w) {
  let v = w.value;
  if (!w.hasDecimal && ctx.s.integerUnit === 'um') v = ctx.st.inch ? v / 10000 : v / 1000;
  return ctx.st.inch ? v * 25.4 : v;
}
// Dwell P: with a decimal point in seconds, without it in milliseconds (Fanuc P1000 = 1 s).
const dwellP = w => (w.hasDecimal ? w.value : w.value / 1000);

// ---- rows: one per M6 (spec §2 time table) ----
function openRow(ctx, tool, line, change) {
  if (ctx.row >= 0) ctx.rows[ctx.row].moveEnd = ctx.moves.count;
  ctx.rows.push({ tool, label: '', firstLine: line, moveStart: ctx.moves.count, moveEnd: ctx.moves.count,
    holes: 0, cutLength: 0, cutSeconds: 0, rapidSeconds: 0, dwellSeconds: 0,
    changeSeconds: change ? ctx.s.toolChangeSeconds : 0, incomplete: false,
    afterM6: change, g43Seen: false, once: new Set() });
  ctx.row = ctx.rows.length - 1;
  return ctx.rows[ctx.row];
}
function currentRow(ctx) {
  if (ctx.row >= 0) return ctx.rows[ctx.row];
  const r = openRow(ctx, ctx.st.tNext ? `T${ctx.st.tNext}` : '', ctx.block ? ctx.block.line : null, false);
  r.label = ctx.lastComment || '';
  return r;
}
export function closeRows(ctx) {
  if (ctx.row >= 0) ctx.rows[ctx.row].moveEnd = ctx.moves.count;
}
function rowOnce(ctx, id, params) {
  const row = currentRow(ctx);
  if (row.once.has(id)) return;
  row.once.add(id);
  millEvent(ctx, id, params);
}
function markIncomplete(ctx) { currentRow(ctx).incomplete = true; }
function mark(ctx, id, p = ctx.st.pos) {
  if (ctx.markers.length < 500 && p && known(p)) ctx.markers.push({ x: p.x, y: p.y, z: p.z, line: ctx.block.line, id });
}

// ---- recording moves ----
function record(ctx, a, b, kind, seconds) {
  const row = currentRow(ctx);
  pushMove(ctx.moves, a, b, kind, ctx.block.line, ctx.row, ctx.st.wofs, seconds);
  const cut = kind === K_FEED || kind === K_CFEED;
  if (Number.isNaN(seconds)) row.incomplete = true;
  else if (cut) row.cutSeconds += seconds;
  else row.rapidSeconds += seconds;
  if (cut) {
    row.cutLength += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    ctx.minCutZ = Math.min(ctx.minCutZ, a.z, b.z);
  }
}

function checkZMove(ctx, from, to) {
  const row = currentRow(ctx);
  if (row.afterM6 && !row.g43Seen && from.z !== to.z && to.z !== null) rowOnce(ctx, 'no-g43');
}
function checkCut(ctx) {
  const st = ctx.st;
  if (st.spindle === 'off') rowOnce(ctx, 'spindle-off');
  if (!(st.f > 0)) { rowOnce(ctx, 'no-feed'); markIncomplete(ctx); }
}

function moveTo(ctx, to, kind) {
  const st = ctx.st, from = st.pos;
  checkZMove(ctx, from, to);
  if (known(from) && known(to) && (from.x !== to.x || from.y !== to.y || from.z !== to.z)) {
    const rapid = kind === K_RAPID || kind === K_CRAPID;
    if (!rapid) checkCut(ctx);
    // Only once something has been cut: before the first cut there is no "deepest cut" yet.
    if (kind === K_RAPID && Number.isFinite(ctx.minCutZ) && to.z < ctx.minCutZ - 1e-6) millEvent(ctx, 'rapid-into-material');
    const seconds = rapid ? rapidSeconds(to.x - from.x, to.y - from.y, to.z - from.z, ctx.s)
      : feedSeconds(Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z), feedRate(st));
    record(ctx, from, to, kind, seconds);
  }
  st.pos = { ...to };
}

function arcTo(ctx, to, ccw, W) {
  const st = ctx.st, from = st.pos, P = PLANES[st.plane];
  checkZMove(ctx, from, to);
  if (!known(from) || !known(to)) { st.pos = { ...to }; return; }
  checkCut(ctx);
  const hasCentre = W[P.ia] || W[P.ib];
  let arc;
  if (hasCentre) {
    arc = arcPath(from, to, { plane: st.plane, ccw, centre: {
      ca: from[P.a] + (W[P.ia] ? len(ctx, W[P.ia]) : 0), cb: from[P.b] + (W[P.ib] ? len(ctx, W[P.ib]) : 0) } }, ctx.s);
  } else if (W.R) {
    arc = arcPath(from, to, { plane: st.plane, ccw, r: len(ctx, W.R) }, ctx.s);
  } else {
    arc = { points: [{ ...to }], length: Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z), error: 'radius' };
  }
  if (arc.error) { millEvent(ctx, 'arc-radius'); markIncomplete(ctx); mark(ctx, 'arc-radius', from); }
  const total = feedSeconds(arc.length, feedRate(st));
  let chordSum = 0, prev = from;
  for (const p of arc.points) { chordSum += Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z); prev = p; }
  prev = from;
  for (const p of arc.points) {
    const c = Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z);
    record(ctx, prev, p, K_FEED, chordSum > 0 ? total * (c / chordSum) : 0);
    prev = p;
  }
  st.pos = { ...to };
}

// Programmed axis words → the target in work coordinates (null where still unknown).
function targetOf(ctx, W) {
  const st = ctx.st, t = { ...st.pos };
  for (const a of AXES) {
    const w = W[a.toUpperCase()];
    if (!w) continue;
    const v = len(ctx, w);
    t[a] = st.abs ? v + st.g52[a] + st.g92[a] : (st.pos[a] === null ? null : st.pos[a] + v);
  }
  return t;
}

// ---- drilling (spec §5) ----
function drill(ctx, W) {
  const st = ctx.st, c = st.cyc, code = st.cycle;
  const shiftZ = st.g52.z + st.g92.z;
  if (c.initZ === null) c.initZ = st.pos.z;
  if (W.R) c.r = st.abs ? len(ctx, W.R) + shiftZ : (c.initZ ?? 0) + len(ctx, W.R);
  if (W.Z) c.z = st.abs ? len(ctx, W.Z) + shiftZ : (c.r ?? c.initZ ?? 0) + len(ctx, W.Z);
  if (W.Q) c.q = Math.abs(len(ctx, W.Q));
  if (W.P) c.p = dwellP(W.P);
  const rep = W.L ? W.L.value : W.K ? W.K.value : 1;
  if (W.L) ctx.flags.haas = true;
  if (rep <= 0) return;                                   // K0 / L0: store the cycle only

  if (st.plane !== 17) {                                  // horizontal drilling is not interpreted
    millEvent(ctx, 'unsupported', { code: `G${code}` });
    markIncomplete(ctx);
    moveTo(ctx, targetOf(ctx, W), K_RAPID);
    return;
  }
  if (APPROXIMATED.has(code)) millEvent(ctx, 'approximated', { code: `G${code}` });

  let initZ = c.initZ, r = c.r;
  if (initZ === null) { millEvent(ctx, 'cycle-no-start'); markIncomplete(ctx); initZ = r; }
  if (r === null || c.z === null) {
    millEvent(ctx, 'cycle-no-r'); markIncomplete(ctx); mark(ctx, 'cycle-no-r');
    if (r === null) r = initZ ?? st.pos.z;
  }
  if (PECK_CODES.has(code) && !(c.q > 0)) { millEvent(ctx, 'peck-no-q'); markIncomplete(ctx); mark(ctx, 'peck-no-q'); }
  if (initZ === null || r === null || c.z === null) return;

  const first = targetOf(ctx, W);
  const step = { x: first.x - st.pos.x, y: first.y - st.pos.y };
  for (let k = 0; k < rep; k++) {
    const x = k === 0 || st.abs ? first.x : st.pos.x + step.x;
    const y = k === 0 || st.abs ? first.y : st.pos.y + step.y;
    if (x === null || y === null) return;
    const from = { ...st.pos };
    if (from.z === null) from.z = initZ;
    st.pos = from;
    const moves = holeMoves(code, { from, x, y, initZ, r, z: c.z, q: c.q, p: c.p, retLevel: st.retLevel,
      clearance: ctx.s.peckClearance });
    for (const m of moves) {
      if (m.kind === 'dwell') { currentRow(ctx).dwellSeconds += m.seconds; continue; }
      moveTo(ctx, m.to, m.kind === 'cfeed' ? K_CFEED : K_CRAPID);
    }
    currentRow(ctx).holes++;
    ctx.holes++;
  }
}

// ---- one block ----
// Returns a flow instruction for the runner: null, { end: true }, { ret: true },
// { call: 'M98', o, repeat } or { call: 'M97', n, repeat }.
export function execBlock(ctx, b) {
  ctx.block = b;
  const st = ctx.st;
  const isO = b.o !== null || b.raw.trim() === '%';
  if (isO) ctx.lastComment = null;
  if (b.skipped === 'macro' || b.skipped === 'expression') { millEvent(ctx, 'skipped'); return null; }

  const G = [], M = [], W = {};
  for (const w of b.words) {
    if (w.letter === 'G') G.push(w.value);
    else if (w.letter === 'M') M.push(w.value);
    else if (!(w.letter in W)) W[w.letter] = w;
  }
  const hasM6 = M.includes(6);
  if (b.comment && !isO && !hasM6) {
    if (ctx.pendingLabelRow >= 0) { ctx.rows[ctx.pendingLabelRow].label = b.comment; ctx.pendingLabelRow = -1; }
    else ctx.lastComment = b.comment;
  }
  if (!b.words.length) return null;
  if (W.Y) ctx.flags.hasY = true;

  // Order inside a block: the T word, then the tool change, then the G codes (so a G43 in the same
  // block as M6 belongs to the new tool's row), then the other words and M codes.
  if (W.T) st.tNext = W.T.raw;
  if (hasM6) {
    if (st.radiusComp !== 40) millEvent(ctx, 'comp-left-on');
    const row = openRow(ctx, st.tNext ? `T${st.tNext}` : '', b.line, true);
    ctx.pendingLabelRow = -1;
    if (b.comment) row.label = b.comment;
    else if (ctx.lastComment) row.label = ctx.lastComment;
    else ctx.pendingLabelRow = ctx.row;
    ctx.lastComment = null;
    st.tool = st.tNext === null ? null : Number(st.tNext);
    st.spindle = 'off';
  }

  let nonMotion = null, dwell = false;
  for (const g0 of G) {
    const g = DRILL_ALIAS.get(g0) ?? g0;
    if (g === 0 || g === 1 || g === 2 || g === 3) { st.motion = g; st.cycle = null; }
    else if (g === 17 || g === 18 || g === 19) { st.plane = g; ctx.flags.planes.add(g); }
    else if (g === 20) { st.inch = true; ctx.sawInch = true; }
    else if (g === 21) st.inch = false;
    else if (g === 90) st.abs = true;
    else if (g === 91) st.abs = false;
    else if (g === 94) st.feedMode = 'min';
    else if (g === 95) st.feedMode = 'rev';
    else if (g === 98 || g === 99) st.retLevel = g;
    else if (g === 40) st.radiusComp = 40;
    else if (g === 41 || g === 42) {
      st.radiusComp = g;
      if (W.D) st.d = W.D.value;
      else if (st.d === null) millEvent(ctx, 'comp-no-d');
    }
    else if (g === 43 || g === 44) {
      st.lengthComp = true;
      currentRow(ctx).g43Seen = true;
      if (W.H) st.h = W.H.value;
      if (st.h !== null && st.tool !== null && st.h !== st.tool) millEvent(ctx, 'h-mismatch', { h: st.h, t: st.tool });
    }
    else if (g === 49) st.lengthComp = false;
    else if (g === 80) st.cycle = null;
    else if (DRILL_CODES.has(g)) {
      if (st.cycle === null) st.cyc = { initZ: st.pos.z, r: null, z: null, q: null, p: null };
      st.cycle = g;
    }
    else if ((g >= 54 && g <= 59 && Number.isInteger(g)) || g === 54.1 || g === 154 || (g >= 110 && g <= 129)) {
      if (g === 154 || g >= 110) ctx.flags.haas = true;
      const name = g === 54.1 || g === 154 ? `G${g} P${W.P ? W.P.value : ''}` : `G${g}`;
      let i = ctx.wofsNames.indexOf(name);
      if (i < 0) { ctx.wofsNames.push(name); i = ctx.wofsNames.length - 1; }
      if (i !== st.wofs) { st.wofs = i; st.pos = { x: null, y: null, z: null }; }   // new frame: position unknown
    }
    else if (g === 4) dwell = true;
    if (NON_MOTION_G.has(g)) nonMotion = g;
    if (g === 96 || (g === 50 && W.S) || ((g === 70 || g === 71 || g === 72) && W.P && W.Q)) {
      if (ctx.flags.latheLine === null) ctx.flags.latheLine = b.line;
    }
    if (HAAS_G.has(g) || (g >= 110 && g <= 129)) ctx.flags.haas = true;
    if (UNSUPPORTED_G.has(g)) { millEvent(ctx, 'unsupported', { code: `G${g}` }); markIncomplete(ctx); }
  }

  if (W.F) st.f = st.inch ? W.F.value * 25.4 : W.F.value;
  if (W.S) st.s = W.S.value;
  if (W.H && !G.some(g => g === 43 || g === 44)) st.h = W.H.value;
  if (W.D && !G.some(g => g === 41 || g === 42)) st.d = W.D.value;
  // Rotary and extra axes: the first value only sets the reference (a 3-axis safe-start line with
  // A0. must not flag anything); a later, different value is a move the viewer can't draw.
  for (const L of ['A', 'B', 'C', 'U', 'V', 'W']) {
    if (!W[L]) continue;
    const prev = ctx.rotary[L];
    ctx.rotary[L] = W[L].value;
    if (prev !== null && prev !== W[L].value) { millEvent(ctx, 'unsupported', { code: L }); markIncomplete(ctx); }
  }

  let flow = null;
  for (const m of M) {
    if (m === 3) st.spindle = 'cw';
    else if (m === 4) st.spindle = 'ccw';
    else if (m === 5) st.spindle = 'off';
    else if (m === 30 || m === 2) {
      if (st.radiusComp !== 40) millEvent(ctx, 'comp-left-on');
      flow = { end: true };
    }
    else if (m === 98) {
      const p = W.P ? W.P.raw.replace(/^[+-]/, '').split('.')[0] : '';
      let o = Number(p), repeat = W.L ? W.L.value : W.K ? W.K.value : 1;
      if (!W.L && !W.K && p.length > 4) { o = Number(p.slice(-4)); repeat = Number(p.slice(0, -4)) || 1; }
      if (W.L) ctx.flags.haas = true;
      flow = { call: 'M98', o, repeat };
    }
    else if (m === 97) { ctx.flags.haas = true; flow = { call: 'M97', n: W.P ? W.P.value : null, repeat: W.L ? W.L.value : 1 }; }
    else if (m === 99) flow = { ret: true };
  }

  // Non-motion G codes: their axis words are data.
  if (dwell) {
    const sec = W.P ? dwellP(W.P) : W.X ? W.X.value : 0;
    currentRow(ctx).dwellSeconds += sec;
  } else if (nonMotion === 52) {
    for (const a of AXES) { const w = W[a.toUpperCase()]; if (w) st.g52[a] = len(ctx, w); }
  } else if (nonMotion === 92) {
    for (const a of AXES) {
      const w = W[a.toUpperCase()];
      if (!w) continue;
      const v = len(ctx, w);
      if (st.pos[a] === null) { st.g92[a] = 0; st.pos[a] = v + st.g52[a]; }
      else st.g92[a] = st.pos[a] - st.g52[a] - v;
    }
  } else if (nonMotion === 28 || nonMotion === 30 || nonMotion === 53) {
    for (const a of AXES) if (W[a.toUpperCase()]) st.pos[a] = null;   // gone to a reference point
  } else if (nonMotion === null) {
    const axisWords = W.X || W.Y || W.Z;
    if (st.cycle !== null) {
      if (axisWords || W.R) drill(ctx, W);
    } else if (axisWords) {
      const to = targetOf(ctx, W);
      if (st.motion === 0) moveTo(ctx, to, K_RAPID);
      else if (st.motion === 1) moveTo(ctx, to, K_FEED);
      else arcTo(ctx, to, st.motion === 3, W);
    } else if ((st.motion === 2 || st.motion === 3) && (W.I || W.J || W.K)) {
      arcTo(ctx, { ...st.pos }, st.motion === 3, W);           // a full circle: centre only, no end change
    }
  }
  return flow;
}
```

<!-- file: js/mill/subprograms.js -->
```js
// In-file subprograms (spec §4): M98 P<o> (repeat L/K, or the older P<repeat><oooo> form), Haas
// M97 P<n> to a sequence number, M99 return. Pure: works on the raw lines and a small call stack.
export const MAX_DEPTH = 4;

// O number → index of its O line (':' is the ISO program-number sign). First occurrence wins.
export function indexPrograms(lines) {
  const map = new Map();
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*[Oo:](\d+)/.exec(lines[i]);
    if (m && !map.has(Number(m[1]))) map.set(Number(m[1]), i);
  }
  return map;
}

// N number → index of its line, for M97. Built only when a program uses M97.
export function indexSequenceNumbers(lines) {
  const map = new Map();
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*\/?\s*[Nn](\d+)/.exec(lines[i]);
    if (m && !map.has(Number(m[1]))) map.set(Number(m[1]), i);
  }
  return map;
}

export function createRunner(lines) {
  return { lines, pc: 0, stack: [], oIndex: indexPrograms(lines), nIndex: null };
}

// Applies one flow instruction from execBlock after the runner has already advanced pc past the
// block. report(id, params) records a check. Returns false when the program ends.
export function applyFlow(run, flow, report) {
  if (flow.end) return false;
  if (flow.ret) {
    if (!run.stack.length) { report('main-m99', {}); return false; }   // the control would loop
    const top = run.stack[run.stack.length - 1];
    if (top.remaining > 1) { top.remaining--; run.pc = top.start; }
    else { run.stack.pop(); run.pc = top.returnTo; }
    return true;
  }
  if (flow.call) {
    let start;
    if (flow.call === 'M98') start = run.oIndex.get(flow.o);
    else { run.nIndex = run.nIndex || indexSequenceNumbers(run.lines); start = run.nIndex.get(flow.n); }
    if (start === undefined) { report('sub-missing', { p: flow.call === 'M98' ? flow.o : flow.n }); return true; }
    if (run.stack.length >= MAX_DEPTH) { report('sub-loop', {}); return true; }
    if (!(flow.repeat >= 1)) return true;                        // L0: no call
    run.stack.push({ returnTo: run.pc, start, remaining: flow.repeat });
    run.pc = start;
  }
  return true;
}
```

<!-- file: js/mill/checks.js -->
```js
// Milling program checks (spec §6): events from machine.js and the runner become warnings. Pure.
// Text for each id lives in the shared viewer strings under gv.mcheck.<id> (GR/EN/IT).
export const MILL_SEVERITY = {
  'no-g43': 'warn', 'h-mismatch': 'info', 'spindle-off': 'warn', 'no-feed': 'error',
  'comp-no-d': 'warn', 'comp-left-on': 'warn', 'rapid-into-material': 'warn', 'arc-radius': 'error',
  'cycle-no-r': 'error', 'peck-no-q': 'error', 'cycle-no-start': 'warn',
  'sub-missing': 'warn', 'sub-loop': 'error', 'main-m99': 'info',
  'unsupported': 'info', 'approximated': 'info', 'skipped': 'info', 'lathe-program': 'info',
};
export const MILL_ONCE = new Set(['lathe-program', 'main-m99']);
export const WARN_CAP = 200;                  // per id; the rest collapse into one "more" entry

export function finalizeWarnings(events) {
  const seen = new Set(), perId = new Map(), more = new Map(), out = [];
  for (const e of events) {
    const key = MILL_ONCE.has(e.id) ? e.id : `${e.id}@${e.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const n = (perId.get(e.id) || 0) + 1;
    perId.set(e.id, n);
    if (n > WARN_CAP) {
      const m = more.get(e.id) || { line: e.line, count: 0 };
      m.count++;
      more.set(e.id, m);
      continue;
    }
    out.push({ line: e.line, id: e.id, severity: MILL_SEVERITY[e.id] || 'info', params: e.params || {} });
  }
  for (const [id, m] of more) {
    out.push({ line: m.line, id: 'more', severity: MILL_SEVERITY[id] || 'info', params: { count: m.count, of: id } });
  }
  return out.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
}

// A lathe program opened in the milling viewer (spec §2 handoff): no Y word anywhere, plus a
// lathe-only code, or G18 as the only plane code.
export function looksLikeLathe(flags) {
  if (flags.hasY) return false;
  if (flags.latheLine !== null) return true;
  return flags.planes.size === 1 && flags.planes.has(18);
}
```

<!-- file: js/mill/analyze.js -->
```js
// Milling pipeline entry point (spec §3.2): text → MillResult. Pure and Node-testable; the worker
// is a thin wrapper around it. Lines are parsed as they execute (streaming), so a 1M-line program
// never holds 1M block objects at once.
import { parseLine } from '../gcode/parse.js';
import { millSettings, MILL_MAX_LINES, MILL_MAX_CHARS } from './settings.js';
import { newMillContext, execBlock, closeRows, millEvent } from './machine.js';
import { createRunner, applyFlow } from './subprograms.js';
import { finishMoves, buildLineIndex, K_FEED, K_CFEED } from './moves.js';
import { summarizeRows } from './time.js';
import { finalizeWarnings, looksLikeLathe } from './checks.js';

export { MILL_MAX_LINES, MILL_MAX_CHARS };

function boundsOf(moves, keep) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let any = false;
  for (let i = 0; i < moves.count; i++) {
    if (!keep(moves.kind[i])) continue;
    any = true;
    for (let e = 0; e < 2; e++) {
      for (let a = 0; a < 3; a++) {
        const v = moves.pos[i * 6 + e * 3 + a];
        if (v < min[a]) min[a] = v;
        if (v > max[a]) max[a] = v;
      }
    }
  }
  return any ? { min, max } : null;
}

function emptyResult(lineCount, tooLarge) {
  const moves = finishMoves({ count: 0, pos: new Float32Array(0), kind: new Uint8Array(0), line: new Uint32Array(0),
    row: new Uint16Array(0), wofs: new Uint8Array(0), seconds: new Float32Array(0) });
  return { lines: lineCount, units: 'mm', tooLarge, control: 'fanuc', moves, lineIndex: buildLineIndex(moves, lineCount),
    bounds: null, cutBounds: null, timing: { rows: [], total: 0, incomplete: false }, workOffsets: ['G54'],
    warnings: [], markers: [], cycles: 0, stats: { skipped: 0 } };
}

export function analyzeMill(text, settingsIn, { onProgress } = {}) {
  const s = millSettings(settingsIn);
  const src = String(text);
  const lines = src.split(/\r\n?|\n/);
  if (src.length > MILL_MAX_CHARS || lines.length > MILL_MAX_LINES) return emptyResult(lines.length, true);

  const ctx = newMillContext(s);
  const run = createRunner(lines);
  const cap = Math.max(1e6, lines.length * 5);          // executed-line guard against call loops
  let executed = 0;
  while (run.pc < lines.length) {
    if (++executed > cap) { millEvent(ctx, 'sub-loop', {}, run.pc + 1); break; }
    const b = parseLine(lines[run.pc], run.pc + 1);
    run.pc++;
    const flow = execBlock(ctx, b);
    if (onProgress && executed % 50000 === 0) onProgress(executed, lines.length);
    if (flow && !applyFlow(run, flow, (id, params) => millEvent(ctx, id, params, b.line))) break;
  }
  closeRows(ctx);
  if (looksLikeLathe(ctx.flags)) millEvent(ctx, 'lathe-program', {}, ctx.flags.latheLine);

  const moves = finishMoves(ctx.moves);
  const bounds = boundsOf(moves, () => true);
  return {
    lines: lines.length,
    units: ctx.sawInch ? 'inch' : 'mm',
    tooLarge: false,
    control: ctx.flags.haas ? 'haas' : 'fanuc',
    moves,
    lineIndex: buildLineIndex(moves, lines.length),
    bounds,
    cutBounds: boundsOf(moves, k => k === K_FEED || k === K_CFEED) || bounds,
    timing: summarizeRows(ctx.rows, s),
    workOffsets: ctx.wofsNames,
    warnings: finalizeWarnings(ctx.events),
    markers: ctx.markers,
    cycles: ctx.holes,
    stats: { skipped: ctx.events.filter(e => e.id === 'skipped').length },
  };
}
```

- [ ] **Step 3: Run the tests**

Run: `node --test "_tests/mill/*.test.js"`
Expected: 86 pass. Then run the lathe suite `node --test "_tests/gcode/*.test.js"`: 164 pass.

- [ ] **Step 4: Commit**

```bash
git add js/mill/machine.js js/mill/subprograms.js js/mill/checks.js js/mill/analyze.js _tests/mill/machine.test.js _tests/mill/drill.test.js _tests/mill/subprograms.test.js _tests/mill/checks.test.js _tests/mill/analyze.test.js
git commit -F - <<'EOF'
Milling viewer: modal state, subprograms, checks and the streaming pipeline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 10: The built-in example program

**Files:**
- Create: `js/mill/example.js`
- Test: `_tests/mill/example.test.js`

**Interfaces:**
- `MILL_EXAMPLE` (string): a synthetic part with four tools (face mill; pocket with a helical entry plus a G41 contour; drilling with G81/G83 and G98/G99; G84 tapping). It must analyse with no warnings.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/mill/example.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMill } from '../../js/mill/analyze.js';
import { MILL_EXAMPLE } from '../../js/mill/example.js';

test('the example program is clean: four tools, labelled rows, holes counted, no warnings', () => {
  const r = analyzeMill(MILL_EXAMPLE);
  assert.deepEqual(r.warnings, []);
  assert.deepEqual(r.timing.rows.map(x => [x.tool, x.label, x.cycles]), [
    ['T1', 'FACE MILL D50', 0],
    ['T2', 'END MILL D10 - POCKET AND CONTOUR', 0],
    ['T3', 'DRILL D8.5', 4],
    ['T4', 'TAP M10X1.5', 2],
  ]);
  assert.equal(r.timing.incomplete, false);
  assert.ok(r.timing.total > 60 && r.timing.total < 600, `total ${r.timing.total}`);
  assert.deepEqual(r.cutBounds.min.map(v => Math.round(v)), [-30, -10, -25]);
  assert.equal(r.units, 'mm');
});

test('the example stays synthetic: no client names in it', () => {
  assert.match(MILL_EXAMPLE, /SYNTHETIC PART/);
});
```

Run: `node --test "_tests/mill/example.test.js"`
Expected: FAIL with `Cannot find module …/js/mill/example.js`.

- [ ] **Step 2: Write the example**

<!-- file: js/mill/example.js -->
```js
// Built-in example: a synthetic part (no customer data). Face milling, a pocket with a helical
// entry, a contour with G41, a drilling pattern with G81/G83 and G98/G99, and G84 tapping.
export const MILL_EXAMPLE = `%
O2027 (AIDEDCAM EXAMPLE - SYNTHETIC PART)
(BLOCK 100 X 60 X 20, TOP Z0, ORIGIN AT THE CORNER)
G21 G17 G40 G49 G80 G90
(FACE MILL D50)
T1 M6
G0 G54 X-30 Y15 S2500 M3
G43 Z50 H1 M8
Z2
G1 Z0 F800
X130
Y45
X-30
G0 Z50
(END MILL D10 - POCKET AND CONTOUR)
T2 M6
G0 X50 Y30 S6000 M3
G43 Z50 H2
Z2
G1 Z0 F300
G3 X50 Y30 I-2 J0 Z-1.25
G3 X50 Y30 I-2 J0 Z-2.5
G3 X50 Y30 I-2 J0 Z-3.75
G3 X50 Y30 I-2 J0 Z-5
G1 X65 F600
Y35
X35
Y25
X65
Y30
X50
G0 Z50
(CONTOUR)
X-10 Y-10
Z2
G1 Z-10 F300
G41 D2 X0 Y-5 F600
Y50
G2 X10 Y60 R10
G1 X100
Y0
X-5
G40 X-10 Y-10
G0 Z50
(DRILL D8.5)
T3 M6
G0 X15 Y15 S2000 M3
G43 Z50 H3
G99 G81 X15 Y15 Z-12 R2 F200
X85
G98 G83 X85 Y45 Z-25 R2 Q5
X15
G80
G0 Z50
(TAP M10X1.5)
T4 M6
G0 X15 Y15 S500 M3
G43 Z50 H4
G98 G84 X15 Y15 Z-10 R5 F750
X85
G80
G0 Z50
M5 M9
M30
%
`;
```

- [ ] **Step 3: Run the tests**

Run: `node --test "_tests/mill/*.test.js"`
Expected: 88 pass.

- [ ] **Step 4: Commit**

```bash
git add js/mill/example.js _tests/mill/example.test.js
git commit -F - <<'EOF'
Milling viewer: synthetic four-tool example program

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 11: The worker, and the 1M-line performance script

**Files:**
- Create: `js/mill/worker.js`, `_tests/mill/perf.mjs`
- Test: `_tests/mill/worker.test.js`
- Generated, git-ignored: `_tests/private/perf-mill-1m.nc`

**Interfaces:**
- Protocol: in `{ type: 'analyze', id, text, settings }`; out `{ type: 'progress', id, done, total }`, `{ type: 'result', id, result }` (eight buffers transferred), or `{ type: 'error', id, message }`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/mill/worker.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

// The worker module only needs `self`: stand one in, import it, and drive its onmessage.
const posted = [];
globalThis.self = { postMessage: (msg, transfer) => posted.push({ msg, transfer }) };
await import('../../js/mill/worker.js');

test('analyze → one result message with all eight buffers transferred', () => {
  posted.length = 0;
  self.onmessage({ data: { type: 'analyze', id: 7, text: 'G0 X0 Y0 Z0\nG1 X10 F100', settings: {} } });
  assert.equal(posted.length, 1);
  const { msg, transfer } = posted[0];
  assert.equal(msg.type, 'result');
  assert.equal(msg.id, 7);
  assert.equal(msg.result.moves.count, 1);
  assert.equal(transfer.length, 8);
  assert.equal(new Set(transfer).size, 8);
});

test('progress messages come before the result on a long program', () => {
  posted.length = 0;
  self.onmessage({ data: { type: 'analyze', id: 1, text: 'G0 X0 Y0 Z0\n'.repeat(60000), settings: {} } });
  assert.deepEqual(posted.map(p => p.msg.type), ['progress', 'result']);
});

test('a throw becomes an error message; other message types are ignored', () => {
  posted.length = 0;
  self.onmessage({ data: { type: 'analyze', id: 2, text: 'G0 X0', settings: { get rapidX() { throw new Error('boom'); } } } });
  assert.deepEqual(posted.map(p => [p.msg.type, p.msg.message]), [['error', 'boom']]);
  posted.length = 0;
  self.onmessage({ data: { type: 'ping' } });
  assert.equal(posted.length, 0);
});
```

Run: `node --test "_tests/mill/worker.test.js"`
Expected: FAIL with `Cannot find module …/js/mill/worker.js`.

- [ ] **Step 2: Write the worker and the performance script**

<!-- file: js/mill/worker.js -->
```js
// Module worker (spec §3.2): runs analyzeMill off the main thread so the page never freezes.
// Protocol: in { type: 'analyze', id, text, settings }; out { type: 'progress', id, done, total },
// { type: 'result', id, result } (typed-array buffers transferred, not copied) or
// { type: 'error', id, message }.
import { analyzeMill } from './analyze.js';

self.onmessage = e => {
  const { type, id, text, settings } = e.data || {};
  if (type !== 'analyze') return;
  try {
    const result = analyzeMill(text, settings, {
      onProgress: (done, total) => self.postMessage({ type: 'progress', id, done, total }),
    });
    const m = result.moves, li = result.lineIndex;
    self.postMessage({ type: 'result', id, result },
      [m.pos.buffer, m.kind.buffer, m.line.buffer, m.row.buffer, m.wofs.buffer, m.seconds.buffer,
        li.offsets.buffer, li.moves.buffer]);
  } catch (err) {
    self.postMessage({ type: 'error', id, message: String((err && err.message) || err) });
  }
};
```

<!-- file: _tests/mill/perf.mjs -->
```js
// Generates a 1,000,000-line 3D surfacing program (synthetic) and times the milling pipeline.
// Run: node _tests/mill/perf.mjs      Target (spec §3.4): analyze under 4 s.
import { writeFileSync, mkdirSync } from 'node:fs';
import { analyzeMill } from '../../js/mill/analyze.js';

const lines = ['%', 'O0100 (PERF SURFACE)', 'G21 G17 G40 G49 G80 G90', '(BALL MILL D6)', 'T1 M6',
  'G0 G54 X0 Y0 S12000 M3', 'G43 Z20 H1', 'G1 Z0 F2000'];
const N = 1000000, perRow = 1000;
for (let i = 0; lines.length < N - 3; i++) {
  const row = Math.floor(i / perRow), k = i % perRow;
  const x = (row % 2 ? perRow - k : k) * 0.1;             // zig-zag raster, 0.1 mm steps
  const y = row * 0.2;
  const z = -2 - 1.5 * Math.sin(x / 7) * Math.cos(y / 9);
  lines.push(`X${x.toFixed(3)} Y${y.toFixed(3)} Z${z.toFixed(3)}`);
}
lines.push('G0 Z20', 'M30', '%');
const text = lines.join('\n');
mkdirSync(new URL('../private/', import.meta.url), { recursive: true });
writeFileSync(new URL('../private/perf-mill-1m.nc', import.meta.url), text);

const t0 = performance.now();
const r = analyzeMill(text);
const t1 = performance.now();
const mb = (process.memoryUsage().heapUsed / 1048576).toFixed(0);
console.log(`lines ${r.lines} · moves ${r.moves.count} · analyze ${(t1 - t0).toFixed(0)} ms · heap ${mb} MB`);
if (t1 - t0 > 4000) { console.error('Too slow: over 4000 ms for 1M lines'); process.exit(1); }
```

- [ ] **Step 3: Run the tests and the performance script**

Run: `node --test "_tests/mill/*.test.js"`, then `node _tests/mill/perf.mjs`.
Expected:
- 91 pass;
- the performance script prints one line, `lines 1000000 · moves 999991 · analyze <N> ms · heap <M> MB`, with N under 4000 (validated at 1200–1400) and exit code 0;
- `git status --short` does not list `_tests/private/`.

- [ ] **Step 4: Commit**

```bash
git add js/mill/worker.js _tests/mill/perf.mjs _tests/mill/worker.test.js
git commit -F - <<'EOF'
Milling viewer: module worker wrapper and the 1M-line performance script

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 12: Scene data: layers, draw ranges, pick grid and tints

**Files:**
- Create: `js/mill/scene.js`
- Test: `_tests/mill/scene.test.js`

**Interfaces:**
- `LAYERS` = ['feed', 'rapid', 'cycleFeed', 'cycleRapid'].
- `buildLayers(moves)` returns 4 layers, each `{ name, count, pos, exec, wofs }`.
- `lowerBound(arr, v)`; `layerRange(layer, execStart, execEnd)` returns `{ first, count }`.
- `buildPickGrid(moves, visible(i), project(x, y, z, out), width, height, cell)` returns a grid; `pickNearest(grid, sx, sy, tol)` returns a move index or null.
- `offsetTints(hex, n)` returns hex strings: the base colour, then shades ×0.86, ×0.72 and ×0.6, repeating.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/mill/scene.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMill } from '../../js/mill/analyze.js';
import { MILL_EXAMPLE } from '../../js/mill/example.js';
import { buildLayers, lowerBound, layerRange, buildPickGrid, pickNearest, LAYERS } from '../../js/mill/scene.js';

const r = analyzeMill(MILL_EXAMPLE);
const layers = buildLayers(r.moves);

test('layers split the moves by kind and keep execution order', () => {
  assert.deepEqual(layers.map(l => l.name), LAYERS);
  assert.equal(layers.reduce((a, l) => a + l.count, 0), r.moves.count);
  for (const l of layers) for (let j = 1; j < l.count; j++) assert.ok(l.exec[j] > l.exec[j - 1]);
  const feed = layers[0], i = feed.exec[0];
  assert.deepEqual(Array.from(feed.pos.slice(0, 6)), Array.from(r.moves.pos.slice(i * 6, i * 6 + 6)));
});

test('lowerBound and layerRange: playback and isolation are plain ranges', () => {
  const arr = new Uint32Array([2, 5, 5, 9]);
  assert.deepEqual([0, 2, 3, 5, 6, 9, 10].map(v => lowerBound(arr, v)), [0, 0, 1, 1, 3, 3, 4]);
  // Tool isolation: one row's moves only, per layer.
  const row = r.timing.rows[2];                                 // T3 drill: cycle moves only
  const counts = layers.map(l => layerRange(l, row.moveStart, row.moveEnd).count);
  assert.equal(counts.reduce((a, b) => a + b, 0), row.moveEnd - row.moveStart);
  assert.ok(counts[2] > 0 && counts[3] > 0);
  // Playback up to move n: every layer's range ends before n.
  const n = Math.floor(r.moves.count / 2);
  const upTo = layers.map(l => layerRange(l, 0, n));
  assert.equal(upTo.reduce((a, x) => a + x.count, 0), n);
});

test('pick grid: the nearest visible move within the pixel tolerance', () => {
  // Orthographic top view, 1 px per mm, origin at the corner: screen = (x, 100 - y).
  const project = (x, y, z, out) => { out[0] = x + 40; out[1] = 100 - y; return true; };
  const grid = buildPickGrid(r.moves, () => true, project, 240, 140, 8);
  const hit = pickNearest(grid, 40 + 130, 100 - 45, 4);        // the face mill's pass end at X130 Y45
  assert.notEqual(hit, null);
  assert.equal(r.moves.line[hit] >= 12 && r.moves.line[hit] <= 14, true);
  assert.equal(pickNearest(grid, 239, 139, 4), null);          // empty corner
  const none = buildPickGrid(r.moves, () => false, project, 240, 140, 8);
  assert.equal(pickNearest(none, 40 + 130, 100 - 45, 4), null);
});

test('pick grid stays bounded for a segment much longer than the screen', () => {
  const moves = { count: 1, pos: new Float32Array([-1e6, 0, 0, 1e6, 0, 0]) };
  const grid = buildPickGrid(moves, () => true, (x, y, z, o) => { o[0] = x; o[1] = y + 50; return true; }, 100, 100, 8);
  assert.ok(grid.items.length <= 20, `${grid.items.length} cells`);          // clipped: about one row of cells
  assert.equal(pickNearest(grid, 50, 50, 4), 0);
});

test('work-offset tints: the base colour first, then darker shades, repeating after four', async () => {
  const { offsetTints } = await import('../../js/mill/scene.js');
  assert.deepEqual(offsetTints('#0d7a3e', 5), ['#0d7a3e', '#0b6935', '#09582d', '#084925', '#0d7a3e']);
});
```

Run: `node --test "_tests/mill/scene.test.js"`
Expected: FAIL with `Cannot find module …/js/mill/scene.js`.

- [ ] **Step 2: Write the module**

<!-- file: js/mill/scene.js -->
```js
// Pure drawing data for the 3D view (spec §3.3): per-layer vertex arrays in execution order, the
// draw ranges for playback and tool isolation, and a screen-space pick grid. No DOM, no three.js.
import { K_RAPID, K_FEED, K_CFEED, K_CRAPID } from './moves.js';

export const LAYERS = ['feed', 'rapid', 'cycleFeed', 'cycleRapid'];
const LAYER_OF_KIND = { [K_FEED]: 0, [K_RAPID]: 1, [K_CFEED]: 2, [K_CRAPID]: 3 };

// Splits the moves by layer. Each layer keeps its moves' positions (6 floats each), their execution
// indices (sorted ascending, because moves are recorded in execution order) and work offsets.
export function buildLayers(moves) {
  const counts = [0, 0, 0, 0];
  for (let i = 0; i < moves.count; i++) counts[LAYER_OF_KIND[moves.kind[i]]]++;
  const layers = LAYERS.map((name, l) => ({ name, count: 0, pos: new Float32Array(counts[l] * 6),
    exec: new Uint32Array(counts[l]), wofs: new Uint8Array(counts[l]) }));
  for (let i = 0; i < moves.count; i++) {
    const L = layers[LAYER_OF_KIND[moves.kind[i]]], j = L.count++;
    L.pos.set(moves.pos.subarray(i * 6, i * 6 + 6), j * 6);
    L.exec[j] = i;
    L.wofs[j] = moves.wofs[i];
  }
  return layers;
}

// First index whose value is >= v (arr sorted ascending).
export function lowerBound(arr, v) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (arr[mid] < v) lo = mid + 1; else hi = mid; }
  return lo;
}

// The part of a layer whose moves have execution index in [execStart, execEnd): playback draws
// [0, n), tool isolation draws one row's [moveStart, moveEnd), and both combine.
export function layerRange(layer, execStart, execEnd) {
  const first = lowerBound(layer.exec, execStart);
  const last = Math.max(first, lowerBound(layer.exec, execEnd));
  return { first, count: last - first };
}

// Screen-space pick grid over the visible moves. project(x, y, z, out) writes out[0..1] in pixels
// and returns false for points it can't place. visible(i) filters moves by index.
export function buildPickGrid(moves, visible, project, width, height, cell = 8) {
  const cols = Math.max(1, Math.ceil(width / cell)), rows = Math.max(1, Math.ceil(height / cell));
  const n = moves.count, scr = new Float32Array(n * 4), ok = new Uint8Array(n), a = [0, 0], b = [0, 0];
  for (let i = 0; i < n; i++) {
    if (!visible(i)) continue;
    const p = moves.pos, k = i * 6;
    if (!project(p[k], p[k + 1], p[k + 2], a) || !project(p[k + 3], p[k + 4], p[k + 5], b)) continue;
    scr[i * 4] = a[0]; scr[i * 4 + 1] = a[1]; scr[i * 4 + 2] = b[0]; scr[i * 4 + 3] = b[1];
    ok[i] = 1;
  }
  // Two passes over the same cell walk: count per cell, then fill (a flat CSR, no per-cell arrays).
  // Each segment is first clipped to the view (plus one cell), so its walk is bounded by the screen.
  const lo = [-cell, -cell], hi = [width + cell, height + cell];
  const walk = (i, visit) => {
    let x0 = scr[i * 4], y0 = scr[i * 4 + 1], x1 = scr[i * 4 + 2], y1 = scr[i * 4 + 3];
    let t0 = 0, t1 = 1;
    const d = [x1 - x0, y1 - y0], p0 = [x0, y0];
    for (let a = 0; a < 2; a++) {                      // Liang–Barsky against the expanded view
      if (d[a] === 0) { if (p0[a] < lo[a] || p0[a] > hi[a]) return; continue; }
      let ta = (lo[a] - p0[a]) / d[a], tb = (hi[a] - p0[a]) / d[a];
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) return;
    }
    x0 = p0[0] + d[0] * t0; y0 = p0[1] + d[1] * t0;
    x1 = p0[0] + d[0] * t1; y1 = p0[1] + d[1] * t1;
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / cell));
    let last = -1;
    for (let s = 0; s <= steps; s++) {
      const x = x0 + ((x1 - x0) * s) / steps, y = y0 + ((y1 - y0) * s) / steps;
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
      const c = cy * cols + cx;
      if (c !== last) { visit(c); last = c; }
    }
  };
  const start = new Uint32Array(cols * rows + 1);
  for (let i = 0; i < n; i++) if (ok[i]) walk(i, c => { start[c + 1]++; });
  for (let c = 1; c < start.length; c++) start[c] += start[c - 1];
  const fill = start.slice(), items = new Uint32Array(start[start.length - 1]);
  for (let i = 0; i < n; i++) if (ok[i]) walk(i, c => { items[fill[c]++] = i; });
  return { cell, cols, rows, start, items, scr };
}

// Work-offset tints (spec §8): the feed colour, then darker shades of it, repeating after four.
// Darker keeps every tint at or above the base colour's contrast on white and on paper.
const SHADES = [1, 0.86, 0.72, 0.6];
export function offsetTints(hex, n) {
  const v = parseInt(hex.slice(1), 16), rgb = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  return Array.from({ length: n }, (_, i) => '#' + rgb
    .map(c => Math.round(c * SHADES[i % SHADES.length]).toString(16).padStart(2, '0')).join(''));
}

function distToSegment(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / len2)) : 0;
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

// Nearest move within tol pixels of (sx, sy), with its screen parameter t, or null.
export function pickNearest(grid, sx, sy, tol = 6) {
  const { cell, cols, rows, start, items, scr } = grid;
  const r = Math.ceil(tol / cell), cx = Math.floor(sx / cell), cy = Math.floor(sy / cell);
  let best = null, bestD = tol;
  for (let y = Math.max(0, cy - r); y <= Math.min(rows - 1, cy + r); y++) {
    for (let x = Math.max(0, cx - r); x <= Math.min(cols - 1, cx + r); x++) {
      const c = y * cols + x;
      for (let k = start[c]; k < start[c + 1]; k++) {
        const i = items[k];
        const d = distToSegment(sx, sy, scr[i * 4], scr[i * 4 + 1], scr[i * 4 + 2], scr[i * 4 + 3]);
        if (d <= bestD) { bestD = d; best = i; }
      }
    }
  }
  return best;
}
```

- [ ] **Step 3: Run the tests**

Run: `node --test "_tests/mill/*.test.js"`
Expected: 96 pass.

- [ ] **Step 4: Commit**

```bash
git add js/mill/scene.js _tests/mill/scene.test.js
git commit -F - <<'EOF'
Milling viewer: layers, draw ranges for playback and isolation, pick grid and offset tints

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 13: Vendor three.js 0.186.1, and test the tint contrast

**Files:**
- Create: `js/vendor/three/three.module.js`, `three.core.js` and `LICENSE`, plus `js/vendor/three/addons/OrbitControls.js`, `LineSegments2.js`, `LineSegmentsGeometry.js` and `LineMaterial.js`, all from the npm tarball
- Test: `_tests/gcode/contrast.test.js` (one test appended)

**Interfaces:**
- `js/mill/view3d.js` (Task 14) imports `../vendor/three/three.module.js` and `../vendor/three/addons/*.js`. The add-ons' bare `'three'` import is rewritten to `'../three.module.js'`, so no import map is needed.

- [ ] **Step 1: Append the failing contrast test**

<!-- file: _tests/private/append-t13.js -->
```js

// Milling viewer (spec §8): the work-offset tints are shades of the feed colour and must pass too.
test('milling work-offset tints are at least 3:1 against both backgrounds', async () => {
  const { offsetTints } = await import('../../js/mill/scene.js');
  const feed = css.match(/--gv-feed:\s*(#[0-9a-fA-F]{6})/)[1];
  for (const tint of offsetTints(feed, 4)) {
    for (const bg of [PAPER, PANEL]) {
      const r = ratio(tint, bg);
      assert.ok(r >= 3, `tint ${tint} has contrast ${r.toFixed(2)} against ${bg} (< 3)`);
    }
  }
});
```

Run: `node _tests/extract.mjs <brief> _tests/private/append-t13.js && cat _tests/private/append-t13.js >> _tests/gcode/contrast.test.js && rm _tests/private/append-t13.js && node --test "_tests/gcode/contrast.test.js"`
Expected: 4 pass. The tints come from Task 12, so this guard has no failing phase; it exists so that a later colour change can't silently break the ≥ 3:1 rule.

- [ ] **Step 2: Download, verify and vendor**

```bash
set -e
TMP=$(mktemp -d)
curl -sfL -o "$TMP/three.tgz" https://registry.npmjs.org/three/-/three-0.186.1.tgz
echo "8cd068708ea44f2c73c944b1cead2ba2f0d5c15c8fc194e5700f4e4f4a033fe7  $TMP/three.tgz" | sha256sum -c -
tar -xzf "$TMP/three.tgz" -C "$TMP"
V=js/vendor/three
mkdir -p $V/addons
cp "$TMP/package/build/three.module.js" "$TMP/package/build/three.core.js" "$TMP/package/LICENSE" $V/
for f in controls/OrbitControls.js lines/LineSegments2.js lines/LineSegmentsGeometry.js lines/LineMaterial.js; do cp "$TMP/package/examples/jsm/$f" $V/addons/; done
sed -i "s#} from 'three';#} from '../three.module.js';#" $V/addons/*.js
rm -rf "$TMP"
```
Expected:
- `sha256sum` prints `…/three.tgz: OK`. This tarball's SHA-1 is also npm's published shasum, `6d50f70c2c437f844179bbb56d6f5b774e1ca38a`.
- `grep -n "from '" js/vendor/three/addons/*.js` shows `'../three.module.js'` and `'./…'` imports only, apart from lines inside ` * @three_import` comments.
- The sizes: `three.core.js` 1458113 bytes, `three.module.js` 662772, `LICENSE` 1081, `OrbitControls.js` 40768, `LineSegments2.js` 11490, `LineSegmentsGeometry.js` 6906, `LineMaterial.js` 14033. `sed` changes one line in each add-on, which doesn't move these sizes by more than a few bytes.

- [ ] **Step 3: Run the tests**

Run: `node --test "_tests/gcode/*.test.js"`
Expected: 165 pass.

- [ ] **Step 4: Commit**

```bash
git add js/vendor/three _tests/gcode/contrast.test.js
git commit -F - <<'EOF'
Milling viewer: vendor three.js 0.186.1 (MIT) with relative add-on imports; tint contrast test

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 14: The 3D view

**Files:**
- Create: `js/mill/view3d.js`

**Interfaces:**
- `createView3d(container, { onHover(i, point, marker), onPick(i, point, marker) })` returns `{ setResult(r, { fit }), clear(), fit(), preset('top' | 'front' | 'right' | 'iso'), zoomBy(f), setLayerVisible('feed' | 'rapid' | 'cycle' | 'markers', on), setRange(start, end), highlight(moveIndices), snapshot(scale) → dataURL, viewWidth(), canvas }`.
- It throws when WebGL is missing; the controller then shows `gv.mill.nowebgl`.
- Camera: orthographic, Z up. Presets: top (0, −1e-4, 1), front (0, −1, 0), right (1, 0, 0), iso (1, −1, 0.8). The visible width stays within 1e-3…1e6.
- Mouse: left-drag orbits, right-drag pans, the wheel zooms. Touch: one finger orbits, two fingers pinch and pan. Keys: `+`/`=`/`-` zoom, arrows orbit 5°, `F` fits.
- A pointerup without a drag (under 4 px) picks; `pointercancel` never picks. The pick grid is rebuilt 150 ms after the camera stops.

- [ ] **Step 1: Write the module**

<!-- file: js/mill/view3d.js -->
```js
// The milling 3D view (spec §2, §8): self-hosted three.js, orthographic, Z up. DOM and WebGL only;
// the pure parts (layers, ranges, pick grid, tints) are in scene.js.
import * as THREE from '../vendor/three/three.module.js';
import { OrbitControls } from '../vendor/three/addons/OrbitControls.js';
import { LineSegments2 } from '../vendor/three/addons/LineSegments2.js';
import { LineSegmentsGeometry } from '../vendor/three/addons/LineSegmentsGeometry.js';
import { LineMaterial } from '../vendor/three/addons/LineMaterial.js';
import { buildLayers, layerRange, buildPickGrid, pickNearest, offsetTints } from './scene.js';

const MIN_WIDTH = 1e-3, MAX_WIDTH = 1e6;             // visible width limits, world units (spec: no hang)
const PRESETS = {
  top: [0, -1e-4, 1], front: [0, -1, 0], right: [1, 0, 0], iso: [1, -1, 0.8],
};
const cssColor = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#000';

function crossTexture(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  g.strokeStyle = color; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(7, 7); g.lineTo(25, 25); g.moveTo(25, 7); g.lineTo(7, 25); g.stroke();
  return new THREE.CanvasTexture(c);
}
function letterSprite(text, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = color; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 16, 17);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  s.scale.set(0.8, 0.8, 0.8);
  return s;
}

// onHover(moveIndex | null, point | null, marker | null); onPick(moveIndex | null, point | null, marker | null).
// Throws when WebGL is not available (the page then shows its banner).
export function createView3d(container, { onHover, onPick }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0xffffff, 1);
  const canvas = renderer.domElement;
  canvas.className = 'gv-3d-canvas';
  canvas.tabIndex = 0;
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1e7, 1e7);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, canvas);
  controls.screenSpacePanning = true;
  controls.zoomToCursor = true;
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  // Axis triad in the bottom-left corner, rendered with the main camera's orientation.
  const triScene = new THREE.Scene();
  const triCam = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.1, 10);
  triCam.up.set(0, 0, 1);
  triScene.add(new THREE.AxesHelper(1));
  const labels = [['X', '#c2410c', [1.3, 0, 0]], ['Y', '#0d7a3e', [0, 1.3, 0]], ['Z', '#4a6f8f', [0, 0, 1.3]]];
  for (const [txt, col, p] of labels) { const s = letterSprite(txt, col); s.position.set(...p); triScene.add(s); }

  const colors = {
    feed: cssColor('--gv-feed'), rapid: cssColor('--gv-rapid'), pass: cssColor('--gv-pass'), hi: cssColor('--gv-hi'),
  };
  let result = null, layers = [], objects = [], hiObj = null, markerObj = null, viewSize = 1, radius = 1;
  const visible = { feed: true, rapid: true, cycle: true, markers: true };
  let range = [0, 0], grid = null, gridTimer = null, frame = 0;

  // ---- rendering on demand ----
  function render() {
    frame = 0;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setViewport(0, 0, w, h);
    renderer.setScissorTest(false);
    renderer.render(scene, camera);
    const dir = camera.position.clone().sub(controls.target).normalize();
    triCam.position.copy(dir.multiplyScalar(4));
    triCam.up.copy(camera.up);
    triCam.lookAt(0, 0, 0);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.setScissorTest(true);
    renderer.setViewport(6, 6, 96, 96);
    renderer.setScissor(6, 6, 96, 96);
    renderer.render(triScene, triCam);
    renderer.setScissorTest(false);
    renderer.autoClear = true;
  }
  function requestRender() { if (!frame) frame = requestAnimationFrame(render); }
  controls.addEventListener('change', () => { requestRender(); staleGrid(); });

  // ---- sizing ----
  function applyFrustum() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1, aspect = w / h;
    camera.left = (-viewSize * aspect) / 2; camera.right = (viewSize * aspect) / 2;
    camera.top = viewSize / 2; camera.bottom = -viewSize / 2;
    const frustumW = camera.right - camera.left;
    controls.minZoom = frustumW / MAX_WIDTH;
    controls.maxZoom = frustumW / MIN_WIDTH;
    camera.zoom = Math.min(controls.maxZoom, Math.max(controls.minZoom, camera.zoom));
    camera.updateProjectionMatrix();
    if (hiObj) hiObj.material.resolution.set(w, h);
  }
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    applyFrustum();
    staleGrid();
    requestRender();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  // ---- content ----
  function disposeObjects() {
    for (const o of [...objects, hiObj, markerObj]) {
      if (!o) continue;
      scene.remove(o);
      o.geometry.dispose();
      o.material.dispose();
    }
    objects = []; hiObj = null; markerObj = null; layers = []; grid = null;
  }

  function lineObject(layer, color, dashed, tints) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(layer.pos, 3));
    let mat;
    if (tints) {
      const col = new Float32Array(layer.count * 6), c = new THREE.Color();
      for (let j = 0; j < layer.count; j++) {
        c.set(tints[layer.wofs[j] % tints.length]);
        col.set([c.r, c.g, c.b, c.r, c.g, c.b], j * 6);
      }
      geom.setAttribute('color', new THREE.BufferAttribute(col, 3));
      mat = new THREE.LineBasicMaterial({ vertexColors: true });
    } else if (dashed) {
      mat = new THREE.LineDashedMaterial({ color, dashSize: radius / 60, gapSize: radius / 90 });
    } else {
      mat = new THREE.LineBasicMaterial({ color });
    }
    const obj = new THREE.LineSegments(geom, mat);
    if (dashed) obj.computeLineDistances();
    obj.frustumCulled = false;
    return obj;
  }

  function setResult(r, { fit = false } = {}) {
    disposeObjects();
    result = r;
    if (!r || !r.moves.count) { requestRender(); return; }
    const b = r.cutBounds || r.bounds;
    radius = Math.max(1, Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) / 2);
    layers = buildLayers(r.moves);
    const tints = r.workOffsets.length > 1 ? offsetTints(colors.feed, r.workOffsets.length) : null;
    objects = [
      lineObject(layers[0], colors.feed, false, tints),
      lineObject(layers[1], colors.rapid, true, null),
      lineObject(layers[2], colors.pass, false, null),
      lineObject(layers[3], colors.pass, true, null),
    ];
    objects.forEach(o => scene.add(o));
    if (r.markers.length) {
      const pos = new Float32Array(r.markers.length * 3);
      r.markers.forEach((m, i) => pos.set([m.x, m.y, m.z], i * 3));
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      markerObj = new THREE.Points(geom, new THREE.PointsMaterial({ size: 16, sizeAttenuation: false,
        map: crossTexture(colors.hi), transparent: true, depthTest: false }));
      markerObj.renderOrder = 11;
      markerObj.frustumCulled = false;
      scene.add(markerObj);
    }
    range = [0, r.moves.count];
    applyVisibility();
    if (fit) fitView();
    staleGrid();
    requestRender();
  }

  function applyVisibility() {
    if (!layers.length) return;
    const show = [visible.feed, visible.rapid, visible.cycle, visible.cycle];
    layers.forEach((L, i) => {
      const { first, count } = layerRange(L, range[0], range[1]);
      objects[i].geometry.setDrawRange(first * 2, count * 2);
      objects[i].visible = show[i];
    });
    if (markerObj) markerObj.visible = visible.markers;
  }

  // ---- camera ----
  function fitView(dirOverride) {
    if (!result || !result.moves.count) return;
    const b = result.cutBounds || result.bounds;
    const centre = new THREE.Vector3((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
    const dir = dirOverride || camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-12) dir.set(...PRESETS.iso);
    dir.normalize();
    viewSize = radius * 2.2;
    controls.target.copy(centre);
    camera.position.copy(centre).add(dir.multiplyScalar(radius * 4));
    camera.zoom = 1;
    applyFrustum();
    camera.lookAt(centre);
    controls.update();
    requestRender();
  }
  function preset(name) { fitView(new THREE.Vector3(...(PRESETS[name] || PRESETS.iso))); }
  function zoomBy(f) {
    camera.zoom = Math.min(controls.maxZoom, Math.max(controls.minZoom, camera.zoom * f));
    camera.updateProjectionMatrix();
    controls.update();
    requestRender();
    staleGrid();
  }
  function orbit(dAzimuth, dPolar) {
    const off = camera.position.clone().sub(controls.target);
    off.applyAxisAngle(new THREE.Vector3(0, 0, 1), dAzimuth);
    const right = off.clone().cross(new THREE.Vector3(0, 0, 1));
    if (right.lengthSq() > 1e-12) {
      const next = off.clone().applyAxisAngle(right.normalize(), dPolar);
      const polar = next.angleTo(new THREE.Vector3(0, 0, 1));
      if (polar > 0.01 && polar < Math.PI - 0.01) off.copy(next);
    }
    camera.position.copy(controls.target).add(off);
    camera.lookAt(controls.target);
    controls.update();
    requestRender();
    staleGrid();
  }

  // ---- picking ----
  function staleGrid() {
    grid = null;
    clearTimeout(gridTimer);
    gridTimer = setTimeout(buildGrid, 150);
  }
  function projector() {
    camera.updateMatrixWorld();
    const m = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).elements;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    return (x, y, z, out) => {
      const px = m[0] * x + m[4] * y + m[8] * z + m[12];
      const py = m[1] * x + m[5] * y + m[9] * z + m[13];
      out[0] = ((px + 1) / 2) * w;
      out[1] = ((1 - py) / 2) * h;
      return true;
    };
  }
  function buildGrid() {
    if (!result || !result.moves.count) return;
    const kinds = [visible.rapid, visible.feed, visible.cycle, visible.cycle];   // by move kind 0..3
    const k = result.moves.kind;
    grid = buildPickGrid(result.moves, i => kinds[k[i]] && i >= range[0] && i < range[1],
      projector(), canvas.clientWidth, canvas.clientHeight, 8);
  }
  function worldPointOn(i, sx, sy) {
    const p = result.moves.pos, s = grid.scr;
    const x0 = s[i * 4], y0 = s[i * 4 + 1], x1 = s[i * 4 + 2], y1 = s[i * 4 + 3];
    const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((sx - x0) * dx + (sy - y0) * dy) / l2)) : 0;
    const a = i * 6;
    return { x: p[a] + (p[a + 3] - p[a]) * t, y: p[a + 1] + (p[a + 4] - p[a + 1]) * t, z: p[a + 2] + (p[a + 5] - p[a + 2]) * t };
  }
  function markerAt(sx, sy) {
    if (!result || !markerObj || !visible.markers) return null;
    const project = projector(), out = [0, 0];
    for (const m of result.markers) {
      project(m.x, m.y, m.z, out);
      if (Math.hypot(out[0] - sx, out[1] - sy) <= 9) return m;
    }
    return null;
  }
  function hitAt(e) {
    const rect = canvas.getBoundingClientRect(), sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const marker = markerAt(sx, sy);
    if (marker) return { i: null, point: { x: marker.x, y: marker.y, z: marker.z }, marker };
    if (!grid) buildGrid();
    if (!grid) return { i: null, point: null, marker: null };
    const i = pickNearest(grid, sx, sy, 6);
    return { i, point: i === null ? null : worldPointOn(i, sx, sy), marker: null };
  }

  let down = null, pointers = 0;
  canvas.addEventListener('pointerdown', e => { pointers++; down = pointers === 1 ? { x: e.clientX, y: e.clientY } : null; });
  canvas.addEventListener('pointerup', e => {
    pointers = Math.max(0, pointers - 1);
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 4) {
      const h = hitAt(e);
      onPick(h.i, h.point, h.marker);
    }
    down = null;
  });
  canvas.addEventListener('pointercancel', () => { pointers = Math.max(0, pointers - 1); down = null; });
  canvas.addEventListener('pointermove', e => {
    if (e.buttons || pointers) return;                       // dragging: the camera moves, no hover
    const h = hitAt(e);
    onHover(h.i, h.point, h.marker);
  });
  canvas.addEventListener('pointerleave', () => onHover(null, null, null));
  canvas.addEventListener('keydown', e => {
    const step = Math.PI / 36;
    const keys = { '+': () => zoomBy(1.25), '=': () => zoomBy(1.25), '-': () => zoomBy(1 / 1.25), f: () => fitView(), F: () => fitView(),
      ArrowLeft: () => orbit(-step, 0), ArrowRight: () => orbit(step, 0), ArrowUp: () => orbit(0, -step), ArrowDown: () => orbit(0, step) };
    if (keys[e.key]) { e.preventDefault(); keys[e.key](); }
  });

  // ---- highlight ----
  function highlight(indices) {
    if (hiObj) { scene.remove(hiObj); hiObj.geometry.dispose(); hiObj.material.dispose(); hiObj = null; }
    if (result && indices.length) {
      const pos = new Float32Array(indices.length * 6);
      indices.forEach((i, j) => pos.set(result.moves.pos.subarray(i * 6, i * 6 + 6), j * 6));
      const geom = new LineSegmentsGeometry();
      geom.setPositions(pos);
      const mat = new LineMaterial({ color: colors.hi, linewidth: 3, depthTest: false });
      mat.resolution.set(canvas.clientWidth, canvas.clientHeight);
      hiObj = new LineSegments2(geom, mat);
      hiObj.renderOrder = 10;
      hiObj.frustumCulled = false;
      scene.add(hiObj);
    }
    requestRender();
  }

  // ---- snapshot for print: the current view at `scale` × the screen resolution ----
  function snapshot(scale = 2) {
    const before = renderer.getPixelRatio();
    renderer.setPixelRatio(scale);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    render();
    const url = canvas.toDataURL('image/png');
    renderer.setPixelRatio(before);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    render();
    return url;
  }

  resize();
  return {
    setResult,
    clear: () => setResult(null),
    fit: () => fitView(),
    preset,
    zoomBy,
    setLayerVisible(name, on) { visible[name] = on; applyVisibility(); staleGrid(); requestRender(); },
    setRange(start, end) { range = [start, end]; applyVisibility(); staleGrid(); requestRender(); },
    highlight,
    snapshot,
    viewWidth: () => (camera.right - camera.left) / camera.zoom,
    canvas,
  };
}
```

- [ ] **Step 2: Check it**

Run: `node --check js/mill/view3d.js`, and `node _tests/extract.mjs <brief> js/mill/view3d.js --check`.
Expected: no output, then `matches`. Behaviour is verified in the browser in Tasks 17 and 19.

- [ ] **Step 3: Commit**

```bash
git add js/mill/view3d.js
git commit -F - <<'EOF'
Milling viewer: orthographic three.js view with layers, highlight, markers, triad, picking and snapshot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 15: Styles for the milling page and the tools index

**Files:**
- Modify: `css/tools.css` (append only; no existing rule changes)

**Interfaces:**
- New classes, all prefixed `gv-` or `ft-` so they don't touch the lathe page:
  - `gv-cross`, `gv-banner-action`, `gv-3d`, `gv-3d-canvas`, `gv-swatch.hi`;
  - `gv-play`, `gv-play-pos`, `gv-dims`, `gv-offsets`, `gv-offset`;
  - `gv-table-rows` (clickable rows, `.is-iso`), `gv-print-shot`;
  - `ft-cards`, `ft-card`, `ft-open`.
- One contextual rule, `.gv-tools-controls .gv-link + .gv-link`, spaces the view buttons. It doesn't match the lathe toolbar, where Fit is followed by the zoom buttons.

- [ ] **Step 1: Append the styles**

<!-- file: _tests/private/append-t15.css -->
```css

/* ---- milling viewer (milling-gcode-viewer.html) ---- */
.gv-cross { margin: 0.4rem 0 0; font-size: 0.85rem; }
.gv-tools-controls .gv-link + .gv-link { margin-left: 0.55rem; }   /* Fit Top Front Right Iso */
.gv-cross a { color: var(--accent-deep); }
.gv-banner-action { margin-left: 0.4rem; }
.gv-3d { position: relative; width: 100%; height: min(62vh, 560px); background: var(--panel); touch-action: none; }
.gv-3d-canvas { display: block; cursor: crosshair; }
.gv-3d-canvas:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
@media (max-width: 720px) { .gv-3d { height: min(50vh, 380px); } }
.gv-swatch.hi { border-color: var(--gv-hi); border-top-width: 3px; }
.gv-play { display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.75rem; border-top: 1px solid var(--line); }
.gv-play input[type="range"] { flex: 1; min-width: 0; accent-color: var(--accent); }
.gv-play-pos { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.gv-dims, .gv-offsets { margin: 0; padding: 0.3rem 0.75rem 0.5rem; font-size: 12px; }
.gv-offsets { display: flex; flex-wrap: wrap; gap: 0.3rem 0.8rem; }
.gv-offsets[hidden] { display: none; }
.gv-offset { display: inline-flex; align-items: center; gap: 0.3rem; }
.gv-offset .gv-swatch { border-top: 0; height: 10px; width: 10px; }
.gv-table-rows tbody tr { cursor: pointer; }
.gv-table-rows tbody tr:hover td { background: var(--accent-soft); }
.gv-table-rows tbody tr.is-iso td { background: var(--accent-soft); font-weight: 600; }
.gv-table-rows tbody tr:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.gv-print-shot { display: none; }
@media print {
  .gv-3d, .gv-play, .gv-dims { display: none !important; }
  .gv-print-shot { display: block !important; width: 100%; max-height: 110mm; object-fit: contain; }
}

/* ---- free-tools.html: one card per tool ---- */
.ft-cards { display: grid; grid-template-columns: 1fr; gap: 1.25rem; padding: 2rem 0 1rem; }
@media (min-width: 720px) { .ft-cards { grid-template-columns: 1fr 1fr; } }
.ft-card { display: block; padding: 1.5rem; background: var(--panel); border: 1px solid var(--line); color: var(--ink); text-decoration: none; transition: border-color 0.2s ease; }
.ft-card:hover { border-color: var(--accent); }
.ft-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ft-card h2 { margin: 0 0 0.5rem; font-family: var(--font-display); font-weight: 300; font-size: 1.5rem; }
.ft-card p { margin: 0 0 1rem; color: var(--ink-soft); }
.ft-open { color: var(--accent-deep); font-weight: 500; }
```

Run: `node _tests/extract.mjs <brief> _tests/private/append-t15.css && cat _tests/private/append-t15.css >> css/tools.css && rm _tests/private/append-t15.css`
Then: `git diff --stat css/tools.css` shows only insertions, and `node --test "_tests/gcode/contrast.test.js"` passes (4).

- [ ] **Step 2: Commit**

```bash
git add css/tools.css
git commit -F - <<'EOF'
Tool styles: 3D view, playback, isolation rows, print snapshot and the tools index cards

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 16: The milling page

**Files:**
- Create: `milling-gcode-viewer.html`
- Test: `_tests/gcode/i18n.test.js` (one import line and one test)

**Interfaces:**
- Element ids used by the controller (Task 17):
  - inputs and settings: `gvFile`, `gvExample`, `gvPaste`, `gvPrint`, `gvControl`, `gvInteger`, `gvRapidX`, `gvRapidY`, `gvRapidZ`, `gvToolChange`, `gvCorrection`, `gvPeck`;
  - banner and program panel: `gvBanner`, `gvEdit`, `gvCode`, `gvEditor`, `gvDropHint`;
  - view: `gvFit`, `gvZoomOut`, `gvZoomIn`, `gvView`, `gvShot`, `gvPlay`, `gvScrub`, `gvPlayPos`, `gvReadout`, `gvDims`, `gvOffsets`;
  - results: `gvTimeTable`, `gvLengthHeader`, `gvTotal`, `gvIsoHint`, `gvIncomplete`, `gvChecks`;
  - CTA and survey: `gvCta`, `gvSurvey`, `gvThanks`;
  - print header: `gvPrintName`, `gvPrintDate`.
- Attributes: `data-view="top|front|right|iso"`, `data-layer="feed|rapid|cycle|markers"`, `data-answer="machine|hand|cam"`.
- Built from the lathe page's shell: head (GA loader), nav, footer, consent banner, and the inline script after `window.GV_I18N`, which stays byte-identical. The page loads `js/gcode/i18n-viewer.js?v=20261015` and `js/mill/ui.js?v=20261015`.

- [ ] **Step 1: Add the failing i18n test**

In `_tests/gcode/i18n.test.js`, add this line directly after the `import { SEVERITY } …` line:
```js
import { MILL_SEVERITY } from '../../js/mill/checks.js';
```
Then append:

<!-- file: _tests/private/append-t16.js -->
```js

test('milling page: the merged strings match across languages and cover every key and check id it uses', () => {
  const { html, t } = pageTranslations('../../milling-gcode-viewer.html');
  const en = Object.keys(t.en).sort();
  assert.deepEqual(Object.keys(t.el).sort(), en);
  assert.deepEqual(Object.keys(t.it).sort(), en);
  for (const k of usedKeys(html)) assert.ok(k in t.en, `missing ${k}`);
  for (const id of [...Object.keys(MILL_SEVERITY), 'more']) assert.ok(`gv.mcheck.${id}` in t.en, `missing gv.mcheck.${id}`);
  for (const k of ['gv.mill.readout', 'gv.mill.dims', 'gv.mill.playpos', 'gv.mill.isolated', 'gv.mill.progress', 'gv.mill.nowebgl',
    'gv.mill.lathe.q', 'gv.mill.lathe.go', 'gv.handoff.big', 'gv.aria.view', 'gv.mill.play', 'gv.mill.pause', 'gv.mill.rowtip', 'gv.mill.offsets']) {
    assert.ok(k in t.en, `missing ${k}`);
  }
  assert.equal(t.en['gv.title'], 'Milling G-code viewer');
});
```

Run: `node _tests/extract.mjs <brief> _tests/private/append-t16.js && cat _tests/private/append-t16.js >> _tests/gcode/i18n.test.js && rm _tests/private/append-t16.js && node --test "_tests/gcode/i18n.test.js"`
Expected: the new test FAILS with `ENOENT … milling-gcode-viewer.html`.

- [ ] **Step 2: Write the page**

<!-- file: milling-gcode-viewer.html -->
```html
<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AidedCAM - Προβολή G-code φρέζας</title>
  <meta name="description" content="Δωρεάν προβολή G-code φρέζας σε 3D: κύκλοι διάτρησης G81–G89, χρόνος ανά εργαλείο και έλεγχοι προγράμματος. Χωρίς εγκατάσταση, χωρίς εγγραφή." />
  <meta name="robots" content="index, follow" />
  <link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="icon-192.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png" />
  <meta name="theme-color" content="#f4f3ee" />
  <link rel="canonical" href="https://www.aidedcam.com/milling-gcode-viewer.html" />
  <meta property="og:title" content="AidedCAM - Προβολή G-code φρέζας" />
  <meta property="og:description" content="Δείτε κάθε κίνηση σε 3D, μαζί με τους κύκλους διάτρησης, και πόσο χρόνο παίρνει κάθε εργαλείο." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://www.aidedcam.com/milling-gcode-viewer.html" />
  <meta property="og:image" content="https://www.aidedcam.com/og-image.png" />
  <meta property="og:site_name" content="AidedCAM" />
  <meta property="og:locale" content="el_GR" />
  <meta property="og:locale:alternate" content="en_US" />
  <meta property="og:locale:alternate" content="it_IT" />
  <meta name="twitter:card" content="summary_large_image" />
  <!-- Google Analytics - loaded only after cookie consent (copied from calculator.html) -->
  <script>
    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function loadGA() {
      window['ga-disable-G-81935T6DNE'] = false;
      if (document.getElementById('ga-script')) {
        if (window.gtag) gtag('consent', 'update', { analytics_storage: 'granted' });
        return;
      }
      var s = document.createElement('script');
      s.id = 'ga-script'; s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=G-81935T6DNE';
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      window.gtag = gtag;
      gtag('js', new Date());
      gtag('config', 'G-81935T6DNE');
      var userLang = lsGet('aidedcam-lang') || document.documentElement.lang || 'el';
      gtag('set', 'user_properties', { preferred_language: userLang });
    }
    function revokeGA() {
      window['ga-disable-G-81935T6DNE'] = true;
      if (window.gtag) gtag('consent', 'update', { analytics_storage: 'denied' });
      var root = location.hostname.replace(/^www\./, '');
      document.cookie.split(';').forEach(function (c) {
        var n = c.split('=')[0].trim();
        if (n === '_ga' || n.indexOf('_ga_') === 0) {
          ['', location.hostname, '.' + root].forEach(function (d) {
            document.cookie = n + '=; Max-Age=0; path=/' + (d ? '; domain=' + d : '');
          });
        }
      });
    }
    if (lsGet('privacy-pref') === 'accepted') { loadGA(); }
  </script>
  <link rel="stylesheet" href="fonts.css?v=20260923" />
  <link rel="stylesheet" href="css/editorial.css?v=20260927" />
  <link rel="stylesheet" href="css/tools.css?v=20261015" />
</head>
<body>

  <nav class="navbar" id="navbar">
    <div class="nav-container">
      <a href="index.html" class="nav-logo">
        <img src="aided-cam-mark.png" alt="AidedCAM" width="30" height="34" />
        <img class="wordmark" src="aidedcam-wordmark.svg" alt="" width="716" height="67" />
      </a>
      <div class="nav-right">
        <a href="index.html" class="nav-back" data-i18n="gv.back">Αρχική</a>
        <div class="lang-switcher">
          <button class="lang-btn active" data-lang="el">EL</button>
          <button class="lang-btn" data-lang="en">EN</button>
          <button class="lang-btn" data-lang="it">IT</button>
        </div>
      </div>
    </div>
  </nav>

  <main class="gv">
    <header class="gv-head">
      <p class="gv-eyebrow" data-i18n="gv.eyebrow">Δωρεάν εργαλείο</p>
      <h1 data-i18n="gv.title">Προβολή G-code φρέζας</h1>
      <p class="gv-lede" data-i18n="gv.lede">Δείτε κάθε κίνηση σε 3D, μαζί με τους κύκλους διάτρησης, και πόσο χρόνο παίρνει κάθε εργαλείο.</p>
      <p class="gv-privacy" data-i18n="gv.privacy">Το πρόγραμμά σας δεν φεύγει ποτέ από τον υπολογιστή σας.</p>
      <p class="gv-cross"><a href="gcode-viewer.html" data-i18n="gv.tolathe">Πρόγραμμα τόρνου; Ανοίξτε την προβολή G-code τόρνου →</a></p>
    </header>

    <div class="gv-wrap">
      <div class="gv-print-head" aria-hidden="true">
        <img src="aidedcam-wordmark.svg" alt="AidedCAM" width="716" height="67" />
        <span id="gvPrintName"></span><span id="gvPrintDate"></span>
      </div>
      <noscript><p class="gv-banner" data-i18n="gv.noscript">Το εργαλείο χρειάζεται JavaScript.</p></noscript>

      <section class="gv-bar" aria-label="Program">
        <label class="gv-btn gv-btn-primary gv-file-label"><input type="file" id="gvFile" class="gv-visually-hidden" /><span data-i18n="gv.open">Άνοιγμα αρχείου</span></label>
        <button type="button" class="gv-btn" id="gvExample" data-i18n="gv.example">Φόρτωση παραδείγματος</button>
        <button type="button" class="gv-btn" id="gvPaste" data-i18n="gv.paste">Επικόλληση</button>
        <button type="button" class="gv-btn" id="gvPrint" data-i18n="gv.print">Εκτύπωση / Αποθήκευση PDF</button>
        <details class="gv-settings">
          <summary data-i18n="gv.settings">Ρυθμίσεις</summary>
          <div class="gv-settings-grid">
            <label><span data-i18n="gv.set.control">Έλεγχος</span>
              <output id="gvControl"></output></label>
            <label><span data-i18n="gv.set.integer">Αριθμοί χωρίς υποδιαστολή</span>
              <select id="gvInteger"><option value="mm">mm</option><option value="um">µm</option></select></label>
            <label><span data-i18n="gv.set.rapidx">Ταχεία X (mm/min)</span><input id="gvRapidX" type="number" min="100" step="100" /></label>
            <label><span data-i18n="gv.set.rapidy">Ταχεία Y (mm/min)</span><input id="gvRapidY" type="number" min="100" step="100" /></label>
            <label><span data-i18n="gv.set.rapidz">Ταχεία Z (mm/min)</span><input id="gvRapidZ" type="number" min="100" step="100" /></label>
            <label><span data-i18n="gv.set.toolchange">Αλλαγή εργαλείου (s)</span><input id="gvToolChange" type="number" min="0" step="0.5" /></label>
            <label><span data-i18n="gv.set.correction">Διόρθωση (%)</span><input id="gvCorrection" type="number" step="1" /></label>
            <label><span data-i18n="gv.set.peck">Επιστροφή G73/G83 (mm)</span><input id="gvPeck" type="number" min="0" step="0.1" /></label>
          </div>
        </details>
      </section>

      <div class="gv-banner" id="gvBanner" role="status" hidden></div>

      <section class="gv-main">
        <div class="gv-program">
          <div class="gv-panel-head"><span data-i18n="gv.program">Πρόγραμμα</span><button type="button" class="gv-link" id="gvEdit" data-i18n="gv.edit">Επεξεργασία</button></div>
          <div class="gv-code" id="gvCode" tabindex="0" data-i18n-aria="gv.aria.code" aria-label="Γραμμές προγράμματος"></div>
          <textarea class="gv-editor" id="gvEditor" spellcheck="false" hidden></textarea>
          <div class="gv-drop-hint" id="gvDropHint" data-i18n="gv.drop">Αφήστε εδώ ένα αρχείο ή επικολλήστε ένα πρόγραμμα</div>
        </div>
        <div class="gv-drawing">
          <div class="gv-tools">
            <span class="gv-tools-controls">
              <button type="button" class="gv-link" id="gvFit" data-i18n="gv.fit">Προσαρμογή</button>
              <button type="button" class="gv-link" data-view="top" data-i18n="gv.mill.top">Πάνω</button>
              <button type="button" class="gv-link" data-view="front" data-i18n="gv.mill.front">Εμπρός</button>
              <button type="button" class="gv-link" data-view="right" data-i18n="gv.mill.right">Δεξιά</button>
              <button type="button" class="gv-link" data-view="iso" data-i18n="gv.mill.iso">Ισομετρική</button>
              <button type="button" class="gv-zoom" id="gvZoomOut" data-i18n-aria="gv.aria.zoomout" aria-label="Σμίκρυνση">−</button>
              <button type="button" class="gv-zoom" id="gvZoomIn" data-i18n-aria="gv.aria.zoomin" aria-label="Μεγέθυνση">+</button>
            </span>
            <label class="gv-check"><input type="checkbox" data-layer="feed" checked /><i class="gv-swatch feed"></i><span data-i18n="gv.l.feed">Κινήσεις κοπής</span></label>
            <label class="gv-check"><input type="checkbox" data-layer="rapid" checked /><i class="gv-swatch rapid"></i><span data-i18n="gv.l.rapid">Ταχείες</span></label>
            <label class="gv-check"><input type="checkbox" data-layer="cycle" checked /><i class="gv-swatch pass"></i><span data-i18n="gv.l.cycle">Κύκλοι διάτρησης</span></label>
            <label class="gv-check"><input type="checkbox" data-layer="markers" checked /><i class="gv-swatch hi"></i><span data-i18n="gv.l.markers">Σφάλματα</span></label>
          </div>
          <div class="gv-3d" id="gvView"></div>
          <img class="gv-print-shot" id="gvShot" alt="" />
          <div class="gv-play">
            <button type="button" class="gv-zoom" id="gvPlay" data-i18n-aria="gv.mill.play" aria-label="Αναπαραγωγή">▶</button>
            <input type="range" id="gvScrub" min="0" max="0" value="0" step="1" data-i18n-aria="gv.mill.play" aria-label="Αναπαραγωγή" />
            <span class="gv-play-pos" id="gvPlayPos"></span>
          </div>
          <p class="gv-readout" id="gvReadout"></p>
          <p class="gv-note gv-dims" id="gvDims"></p>
          <p class="gv-note gv-offsets" id="gvOffsets" hidden></p>
        </div>
      </section>

      <section class="gv-results">
        <div class="gv-time">
          <h2 data-i18n="gv.time.title">Χρόνος κύκλου</h2>
          <p class="gv-note" data-i18n="gv.time.note">Εκτίμηση για προγραμματισμό, υπολογισμένη κίνηση προς κίνηση, μαζί με τα περάσματα που παράγει ο έλεγχος.</p>
          <div class="gv-table-wrap">
            <table class="gv-table gv-table-rows" id="gvTimeTable">
              <thead><tr>
                <th data-i18n="gv.time.tool">Εργαλείο</th><th data-i18n="gv.time.label">Περιγραφή</th>
                <th data-i18n="gv.mill.holes">Τρύπες</th>
                <th id="gvLengthHeader" data-i18n="gv.time.length">Μήκος κοπής</th><th data-i18n="gv.time.cut">Κοπή</th>
                <th data-i18n="gv.time.rapid">Ταχείες</th><th data-i18n="gv.time.total">Σύνολο</th>
              </tr></thead>
              <tbody></tbody>
              <tfoot><tr><td colspan="6" data-i18n="gv.time.program">Σύνολο προγράμματος (με αλλαγές εργαλείων)</td><td id="gvTotal">–</td></tr></tfoot>
            </table>
          </div>
          <p class="gv-note" id="gvIsoHint"></p>
          <p class="gv-note" id="gvIncomplete" data-i18n="gv.time.incomplete" hidden>Για τα εργαλεία με «–» ο χρόνος δεν υπολογίζεται πλήρως.</p>
          <p class="gv-note" data-i18n="gv.mill.excluded">Δεν περιλαμβάνονται: επιταχύνσεις και επιβραδύνσεις, επιτάχυνση ατράκτου, επεξεργασία μπλοκ, ενέργειες M και επιστροφές G28/G30/G53.</p>
        </div>
        <div class="gv-checks">
          <h2 data-i18n="gv.checks.title">Έλεγχοι προγράμματος</h2>
          <ul class="gv-check-list" id="gvChecks"></ul>
          <p class="gv-note" data-i18n="gv.disclaimer">Προβολή, όχι προσομοίωση: ελέγχετε πάντα στη μηχανή σας.</p>
          <p class="gv-note" data-i18n="gv.mill.notecomp">Οι διαδρομές σχεδιάζονται όπως είναι γραμμένες: οι αντισταθμίσεις μήκους και ακτίνας εργαλείου δεν εφαρμόζονται.</p>
          <p class="gv-note" data-i18n="gv.mill.notewofs">Σχεδίαση σε συντεταγμένες προγράμματος: οι τιμές των μηδενικών σημείων δεν είναι γνωστές.</p>
        </div>
      </section>

      <section class="gv-cta">
        <h2 data-i18n="gv.cta.title">Το θέλετε φτιαγμένο για τις δικές σας μηχανές;</h2>
        <p data-i18n="gv.cta.text">Φτιάχνουμε λογισμικό CAM σαν αυτό, στα μέτρα των μηχανών σας, των post-processor σας και του τρόπου που δουλεύει το μηχανουργείο σας.</p>
        <a class="btn-primary" id="gvCta" href="index.html#contact" data-i18n="gv.cta.button">Μιλήστε μαζί μας</a>
        <div class="gv-survey" id="gvSurvey">
          <p data-i18n="gv.survey.q">Πώς γράφετε τα προγράμματα φρέζας;</p>
          <button type="button" class="gv-chip" data-answer="machine" data-i18n="gv.survey.machine">Στη μηχανή</button>
          <button type="button" class="gv-chip" data-answer="hand" data-i18n="gv.survey.hand">Με το χέρι</button>
          <button type="button" class="gv-chip" data-answer="cam" data-i18n="gv.survey.cam">Από CAM</button>
          <p class="gv-thanks" id="gvThanks" data-i18n="gv.survey.thanks" hidden>Ευχαριστούμε!</p>
        </div>
      </section>

      <div class="gv-print-foot" aria-hidden="true">www.aidedcam.com · <span data-i18n="gv.print.estimate">Εκτίμηση για προγραμματισμό</span></div>
    </div>
  </main>

  <footer class="gv-footer">
    <img src="aidedcam-wordmark.svg" alt="AidedCAM" width="716" height="67" loading="lazy" />
    <div class="gv-footer-legal">
      <a href="privacy.html" data-i18n="footer.privacy">Απόρρητο</a>
      <a href="legal.html" data-i18n="footer.legal">Νομικά</a>
      <a href="javascript:void(0)" onclick="openCookieSettings()" data-i18n="footer.cookie_settings">Ρυθμίσεις Cookies</a>
    </div>
  </footer>

  <!-- COOKIE CONSENT BANNER: markup identical to calculator.html lines 925-977 -->
  <div class="consent-banner" id="privacyOverlay">
    <div class="consent-inner">
      <p>
        <span data-i18n="cookie_text">Αυτός ο ιστότοπος χρησιμοποιεί cookies για τη βελτιστοποίηση της λειτουργίας του και την ανάλυση επισκεψιμότητας.</span>
        <a href="privacy.html" class="consent-privacy-link" data-i18n="cookie_privacy_link">Πολιτική Απορρήτου</a>
      </p>
      <div class="consent-actions">
        <button class="consent-btn consent-btn-accept" id="privacyAccept" data-i18n="cookie_accept">Αποδοχή</button>
        <button class="consent-btn consent-btn-manage" id="privacyManage" data-i18n="cookie_manage">Διαχείριση προτιμήσεων</button>
        <button class="consent-btn consent-btn-decline" id="privacyDecline" data-i18n="cookie_decline">Απόρριψη</button>
      </div>
    </div>
    <div class="consent-prefs" id="consentPrefs">
      <div class="consent-prefs-inner">
        <p class="consent-prefs-desc" data-i18n="cookie_prefs_desc">Επιλέξτε ποιες κατηγορίες cookies επιθυμείτε να ενεργοποιήσετε. Τα απαραίτητα cookies είναι πάντα ενεργά για τη σωστή λειτουργία του ιστότοπου.</p>
        <div class="consent-categories">
          <div class="consent-cat">
            <input type="checkbox" checked disabled id="cookieNecessary">
            <label for="cookieNecessary">
              <span class="consent-cat-name" data-i18n="cookie_cat_necessary">Απαραίτητα</span>
              <span class="consent-cat-desc" data-i18n="cookie_cat_necessary_desc">Βασική λειτουργία ιστότοπου</span>
            </label>
          </div>
          <div class="consent-cat">
            <input type="checkbox" checked disabled id="cookieFunctional">
            <label for="cookieFunctional">
              <span class="consent-cat-name" data-i18n="cookie_cat_functional">Λειτουργικά</span>
              <span class="consent-cat-desc" data-i18n="cookie_cat_functional_desc">Αποθήκευση προτιμήσεων γλώσσας</span>
            </label>
          </div>
          <div class="consent-cat">
            <input type="checkbox" id="cookieAnalytics">
            <label for="cookieAnalytics">
              <span class="consent-cat-name" data-i18n="cookie_cat_analytics">Ανάλυση επισκεψιμότητας</span>
              <span class="consent-cat-desc" data-i18n="cookie_cat_analytics_desc">Google Analytics, ανώνυμα στατιστικά</span>
            </label>
          </div>
          <div class="consent-cat">
            <input type="checkbox" disabled id="cookieMarketing">
            <label for="cookieMarketing">
              <span class="consent-cat-name" data-i18n="cookie_cat_marketing">Διαφημιστικά</span>
              <span class="consent-cat-desc" data-i18n="cookie_cat_marketing_desc">Δεν χρησιμοποιούνται αυτήν τη στιγμή</span>
            </label>
          </div>
        </div>
        <div class="consent-prefs-actions">
          <button class="consent-btn consent-btn-accept" id="privacySavePrefs" data-i18n="cookie_save">Αποθήκευση προτιμήσεων</button>
          <button class="consent-btn consent-btn-decline" id="privacyBack" data-i18n="cookie_back">Πίσω</button>
        </div>
      </div>
    </div>
  </div>

  <script src="js/gcode/i18n-viewer.js?v=20261015"></script>
  <script>
    var translations = {
      el: {
        "_title": "AidedCAM - Προβολή G-code φρέζας",
        "gv.title": "Προβολή G-code φρέζας",
        "gv.lede": "Δείτε κάθε κίνηση σε 3D, μαζί με τους κύκλους διάτρησης, και πόσο χρόνο παίρνει κάθε εργαλείο.",
        "gv.cta.title": "Το θέλετε φτιαγμένο για τις δικές σας μηχανές;",
        "gv.cta.text": "Φτιάχνουμε λογισμικό CAM σαν αυτό, στα μέτρα των μηχανών σας, των post-processor σας και του τρόπου που δουλεύει το μηχανουργείο σας.",
        "gv.cta.button": "Μιλήστε μαζί μας",
        "gv.survey.q": "Πώς γράφετε τα προγράμματα φρέζας;",
        "gv.survey.machine": "Στη μηχανή",
        "gv.survey.hand": "Με το χέρι",
        "gv.survey.cam": "Από CAM",
        "gv.survey.thanks": "Ευχαριστούμε!",
        "cookie_text": "Αυτός ο ιστότοπος χρησιμοποιεί cookies για τη βελτιστοποίηση της λειτουργίας του και την ανάλυση επισκεψιμότητας.",
        "cookie_accept": "Αποδοχή",
        "cookie_decline": "Απόρριψη",
        "cookie_manage": "Διαχείριση προτιμήσεων",
        "cookie_privacy_link": "Πολιτική Απορρήτου",
        "cookie_prefs_desc": "Επιλέξτε ποιες κατηγορίες cookies επιθυμείτε να ενεργοποιήσετε. Τα απαραίτητα cookies είναι πάντα ενεργά για τη σωστή λειτουργία του ιστότοπου.",
        "cookie_cat_necessary": "Απαραίτητα",
        "cookie_cat_necessary_desc": "Βασική λειτουργία ιστότοπου",
        "cookie_cat_functional": "Λειτουργικά",
        "cookie_cat_functional_desc": "Αποθήκευση προτιμήσεων γλώσσας",
        "cookie_cat_analytics": "Ανάλυση επισκεψιμότητας",
        "cookie_cat_analytics_desc": "Google Analytics, ανώνυμα στατιστικά",
        "cookie_cat_marketing": "Διαφημιστικά",
        "cookie_cat_marketing_desc": "Δεν χρησιμοποιούνται αυτήν τη στιγμή",
        "cookie_back": "Πίσω",
        "cookie_save": "Αποθήκευση προτιμήσεων",
        "footer.privacy": "Απόρρητο",
        "footer.legal": "Νομικά",
        "footer.cookie_settings": "Ρυθμίσεις Cookies",
      },
      en: {
        "_title": "AidedCAM - Milling G-code viewer",
        "gv.title": "Milling G-code viewer",
        "gv.lede": "See every move in 3D, drilling cycles included, and how long each tool takes.",
        "gv.cta.title": "Want this built around your own machines?",
        "gv.cta.text": "We build CAM software like this, tailored to your machines, your post-processors and the way your shop works.",
        "gv.cta.button": "Talk to us",
        "gv.survey.q": "How do you write milling programs?",
        "gv.survey.machine": "At the machine",
        "gv.survey.hand": "By hand",
        "gv.survey.cam": "From CAM",
        "gv.survey.thanks": "Thank you!",
        "cookie_text": "This website uses cookies to optimize functionality and analyze traffic.",
        "cookie_accept": "Accept",
        "cookie_decline": "Decline",
        "cookie_manage": "Manage preferences",
        "cookie_privacy_link": "Privacy Policy",
        "cookie_prefs_desc": "Choose which categories of cookies you wish to enable. Essential cookies are always active for the proper functioning of the website.",
        "cookie_cat_necessary": "Essential",
        "cookie_cat_necessary_desc": "Basic website functionality",
        "cookie_cat_functional": "Functional",
        "cookie_cat_functional_desc": "Language preference storage",
        "cookie_cat_analytics": "Analytics",
        "cookie_cat_analytics_desc": "Google Analytics, anonymous statistics",
        "cookie_cat_marketing": "Marketing",
        "cookie_cat_marketing_desc": "Not currently used",
        "cookie_back": "Back",
        "cookie_save": "Save preferences",
        "footer.privacy": "Privacy",
        "footer.legal": "Legal",
        "footer.cookie_settings": "Cookie Settings",
      },
      it: {
        "_title": "AidedCAM - Visualizzatore G-code per fresa",
        "gv.title": "Visualizzatore G-code per fresa",
        "gv.lede": "Vedete ogni movimento in 3D, cicli di foratura compresi, e quanto tempo richiede ogni utensile.",
        "gv.cta.title": "Lo volete costruito sulle vostre macchine?",
        "gv.cta.text": "Realizziamo software CAM come questo, su misura per le vostre macchine, i vostri post-processor e il modo in cui lavora la vostra officina.",
        "gv.cta.button": "Parlate con noi",
        "gv.survey.q": "Come scrivete i programmi per fresa?",
        "gv.survey.machine": "In macchina",
        "gv.survey.hand": "A mano",
        "gv.survey.cam": "Da CAM",
        "gv.survey.thanks": "Grazie!",
        "cookie_text": "Questo sito web utilizza i cookie per ottimizzare le sue funzionalità e analizzare il traffico.",
        "cookie_accept": "Accetta",
        "cookie_decline": "Rifiuta",
        "cookie_manage": "Gestisci preferenze",
        "cookie_privacy_link": "Informativa Privacy",
        "cookie_prefs_desc": "Scegliete quali categorie di cookie desiderate attivare. I cookie essenziali sono sempre attivi per il corretto funzionamento del sito.",
        "cookie_cat_necessary": "Essenziali",
        "cookie_cat_necessary_desc": "Funzionalità di base del sito web",
        "cookie_cat_functional": "Funzionali",
        "cookie_cat_functional_desc": "Memorizzazione preferenza lingua",
        "cookie_cat_analytics": "Analitici",
        "cookie_cat_analytics_desc": "Google Analytics, statistiche anonime",
        "cookie_cat_marketing": "Marketing",
        "cookie_cat_marketing_desc": "Attualmente non utilizzati",
        "cookie_back": "Indietro",
        "cookie_save": "Salva preferenze",
        "footer.privacy": "Privacy",
        "footer.legal": "Note Legali",
        "footer.cookie_settings": "Impostazioni Cookie",
      },
    };
    // Shared viewer strings first, then this page's own keys on top.
    ['el', 'en', 'it'].forEach(function (l) {
      translations[l] = Object.assign({}, (window.GV_VIEWER_I18N || {})[l] || {}, translations[l]);
    });
    window.GV_I18N = translations;
    var currentLang = 'el';

    function setLanguage(lang) {
      var t = translations[lang];
      if (!t) return;
      currentLang = lang;
      document.querySelectorAll('[data-i18n]').forEach(function (el) {
        var key = el.getAttribute('data-i18n');
        if (t[key] !== undefined) el.textContent = t[key];
      });
      document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
        var key = el.getAttribute('data-i18n-aria');
        if (t[key] !== undefined) el.setAttribute('aria-label', t[key]);
      });
      document.title = t['_title'] || document.title;
      document.documentElement.lang = lang;
      document.querySelectorAll('.lang-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
      });
      lsSet('aidedcam-lang', lang);
      document.dispatchEvent(new CustomEvent('gv:lang', { detail: lang }));
    }

    try {
      var urlLangParam = new URLSearchParams(window.location.search).get('lang');
      var urlLang = (urlLangParam && translations[urlLangParam]) ? urlLangParam : null;
      var savedLang = lsGet('aidedcam-lang');
      if (savedLang && !translations[savedLang]) savedLang = null;
      var browserLangCode = navigator.language ? navigator.language.substring(0, 2) : 'el';
      var browserLang = browserLangCode === 'el' ? 'el' : browserLangCode === 'it' ? 'it' : 'en';
      currentLang = urlLang || savedLang || browserLang;
      if (currentLang !== 'el') setLanguage(currentLang);
    } catch (e) { console.error('i18n init:', e); }

    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { setLanguage(btn.getAttribute('data-lang')); });
    });

    // ===== COOKIE CONSENT (copied from calculator.html) =====
    (function () {
      var overlay = document.getElementById('privacyOverlay');
      var prefsPanel = document.getElementById('consentPrefs');
      var analyticsCheckbox = document.getElementById('cookieAnalytics');
      function showBanner() { overlay.classList.add('visible'); prefsPanel.classList.remove('visible'); }
      function hideBanner() { overlay.classList.remove('visible'); prefsPanel.classList.remove('visible'); }
      function loadPrefs() {
        try {
          var prefs = JSON.parse(lsGet('cookie-prefs') || '{}');
          analyticsCheckbox.checked = !!(prefs && prefs.analytics);
        } catch (e) { analyticsCheckbox.checked = false; }
      }
      if (!lsGet('privacy-pref')) { showBanner(); }
      document.getElementById('privacyAccept').addEventListener('click', function () {
        lsSet('privacy-pref', 'accepted');
        lsSet('cookie-prefs', JSON.stringify({ analytics: true }));
        hideBanner(); loadGA(); gaEvent('accepted_cookie_consent', {});
      });
      document.getElementById('privacyDecline').addEventListener('click', function () {
        lsSet('privacy-pref', 'declined');
        lsSet('cookie-prefs', JSON.stringify({ analytics: false }));
        hideBanner(); revokeGA();
      });
      document.getElementById('privacyManage').addEventListener('click', function () {
        loadPrefs(); prefsPanel.classList.toggle('visible');
      });
      document.getElementById('privacyBack').addEventListener('click', function () {
        prefsPanel.classList.remove('visible');
      });
      document.getElementById('privacySavePrefs').addEventListener('click', function () {
        var prefs = { analytics: analyticsCheckbox.checked };
        lsSet('cookie-prefs', JSON.stringify(prefs));
        lsSet('privacy-pref', prefs.analytics ? 'accepted' : 'declined');
        hideBanner();
        if (prefs.analytics) { loadGA(); gaEvent('accepted_cookie_consent', {}); } else { revokeGA(); }
      });
      window.openCookieSettings = function () { loadPrefs(); showBanner(); prefsPanel.classList.add('visible'); };
    })();

    // ===== GA HELPER: events only exist when the visitor accepted analytics =====
    function gaEvent(name, params) { if (window.gtag) gtag('event', name, params); }
    window.gaEvent = gaEvent;
  </script>
  <script type="module" src="js/mill/ui.js?v=20261015"></script>
</body>
</html>
```

- [ ] **Step 3: Check it**

Run:
```bash
node _tests/extract.mjs <brief> milling-gcode-viewer.html --check
awk '/<script[^>]*>/{if($0 !~ /src=/){f=1;next}} /<\/script>/{f=0} f' milling-gcode-viewer.html > /tmp/mv-inline.js && node --check /tmp/mv-inline.js && echo INLINE_OK
node --test "_tests/gcode/*.test.js"
```
Expected: `matches`, `INLINE_OK`, and 166 pass.

- [ ] **Step 4: Commit**

```bash
git add milling-gcode-viewer.html _tests/gcode/i18n.test.js
git commit -F - <<'EOF'
Milling viewer: page shell with 3D view, playback, settings and GR/EN/IT copy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 17: The milling controller

**Files:**
- Create: `js/mill/ui.js`

**Interfaces:**
- Consumes the Task 1 shell, `analyzeMill` through `worker.js` (a new module worker per analysis; a new program terminates the running one; 20 s timeout), `createView3d`, `offsetTints`, `movesOfLine`, `MILL_EXAMPLE`, `MILL_DEFAULTS` and `MILL_MAX_LINES`.
- Storage keys: `aidedcam-gm-settings` (settings) and `aidedcam-gm-survey`.
- GA events:
  - `gcode_file_loaded { lines, cycles, control, machine: 'mill' }`;
  - `gcode_example_loaded { machine }`, `gcode_print { machine }`, `gcode_cta_click { machine }`, `gcode_survey { answer, machine }`;
  - `gcode_view_preset { view }`, `gcode_playback` (once per page view), `gcode_handoff { from: 'mill', to: 'lathe' }`.

- [ ] **Step 1: Write the module**

<!-- file: js/mill/ui.js -->
```js
// Page controller for milling-gcode-viewer.html. DOM glue only: the analysis runs in a Web Worker
// (worker.js), the drawing in view3d.js, and the parts both viewers share come from ../gcode/shell/.
import { MILL_DEFAULTS, MILL_MAX_LINES } from './settings.js';
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
    if (m.type === 'progress') { showBanner({ key: 'gv.mill.progress', params: { pct: Math.round((100 * m.done) / m.total) } }); return; }
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
  showBanner({ key: 'gv.banner.error' });
}

function apply(r, fit) {
  state.result = r;
  state.warnLines = new Set(r.warnings.map(w => w.line));
  state.isoRow = null;
  state.playing = false;
  state.playPos = r.moves.count;
  if (r.tooLarge) showBanner({ key: 'gv.banner.toolarge', params: { lines: r.lines.toLocaleString(), max: MILL_MAX_LINES.toLocaleString() } });
  else if (r.warnings.some(w => w.id === 'lathe-program')) showBanner({ key: 'gv.mill.lathe.q', action: { key: 'gv.mill.lathe.go', run: () => handoff('gcode-viewer.html', 'lathe') } });
  else if (!view) showBanner({ key: 'gv.mill.nowebgl' });
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
  ga('gcode_handoff', { from: 'mill', to });
  if (writeHandoff(session(), state.text, state.fileName)) location.href = page;
  else showBanner({ key: 'gv.handoff.big' });
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
  onText: loadText,
  onError: kind => showBanner({ key: kind === 'paste' ? 'gv.paste.fail' : 'gv.banner.error' }),
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
    const bad = typeof v === 'number' && (!Number.isFinite(v) || (key.startsWith('rapid') && v <= 0) || v < 0);
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
if (handed) loadText(handed.text, 'file', handed.name);
else loadText(MILL_EXAMPLE, 'init', 'example.nc');
```

- [ ] **Step 2: Check it, then a first smoke run in the browser**

Run: `node --check js/mill/ui.js`, and `node _tests/extract.mjs <brief> js/mill/ui.js --check`.
Expected: no output, then `matches`.

Serve with `python -m http.server 8765 --bind 127.0.0.1` (run in the background), then open `http://127.0.0.1:8765/milling-gcode-viewer.html?lang=en` at 1280×800 with the Playwright MCP. Evaluate:
- the time table rows are `[['T1', 'FACE MILL D50', '0'], ['T2', 'END MILL D10 - POCKET AND CONTOUR', '0'], ['T3', 'DRILL D8.5', '4'], ['T4', 'TAP M10X1.5', '2']]`, taking the first three cells of each row;
- `#gvTotal` is `2:19`, and `#gvChecks` is `No issues found.`;
- `#gvPlayPos` is `227 / 227 moves`;
- `#gvDims` is `Cutting envelope: X 160.00 × Y 70.00 × Z 30.00 mm`;
- `.gv-3d-canvas` exists and is 780 px wide;
- the console has no errors.

Stop the server and close the browser.

- [ ] **Step 3: Commit**

```bash
git add js/mill/ui.js
git commit -F - <<'EOF'
Milling viewer: page controller with worker analysis, isolation, playback, handoff and print snapshot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 18: The tools index, homepage link, sitemap and llms.txt

**Files:**
- Create: `free-tools.html`
- Modify: `index.html` (two `href`s), `sitemap.xml` (two entries), `llms.txt` (two lines)
- Test: `_tests/gcode/i18n.test.js` (one test appended)

**Interfaces:**
- The nav and footer "Free tools" link (`data-i18n="nav.freetools"`) points to `free-tools.html`.
- `free-tools.html` loads no viewer script and no shared viewer strings. Its inline strings include `gv.back`.

- [ ] **Step 1: Append the failing test**

<!-- file: _tests/private/append-t18.js -->
```js

test('tools index: every key it uses exists in el, en and it (it loads no shared viewer strings)', () => {
  const { html, t } = pageTranslations('../../free-tools.html');
  assert.ok(!html.includes('i18n-viewer.js'));
  for (const k of usedKeys(html)) for (const l of ['el', 'en', 'it']) assert.ok(k in t[l], `${l} missing ${k}`);
});
```

Run: `node _tests/extract.mjs <brief> _tests/private/append-t18.js && cat _tests/private/append-t18.js >> _tests/gcode/i18n.test.js && rm _tests/private/append-t18.js && node --test "_tests/gcode/i18n.test.js"`
Expected: the new test FAILS with `ENOENT … free-tools.html`.

- [ ] **Step 2: Write the page**

<!-- file: free-tools.html -->
```html
<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AidedCAM - Δωρεάν εργαλεία</title>
  <meta name="description" content="Δωρεάν εργαλεία για προγραμματιστές CNC: προβολή G-code τόρνου και φρέζας με χρόνο κύκλου και ελέγχους προγράμματος. Στον browser, χωρίς εγγραφή." />
  <meta name="robots" content="index, follow" />
  <link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="icon-192.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png" />
  <meta name="theme-color" content="#f4f3ee" />
  <link rel="canonical" href="https://www.aidedcam.com/free-tools.html" />
  <meta property="og:title" content="AidedCAM - Δωρεάν εργαλεία" />
  <meta property="og:description" content="Ανοίγουν αμέσως στον browser, χωρίς εγκατάσταση και χωρίς εγγραφή." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://www.aidedcam.com/free-tools.html" />
  <meta property="og:image" content="https://www.aidedcam.com/og-image.png" />
  <meta property="og:site_name" content="AidedCAM" />
  <meta property="og:locale" content="el_GR" />
  <meta property="og:locale:alternate" content="en_US" />
  <meta property="og:locale:alternate" content="it_IT" />
  <meta name="twitter:card" content="summary_large_image" />
  <!-- Google Analytics - loaded only after cookie consent (copied from calculator.html) -->
  <script>
    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function loadGA() {
      window['ga-disable-G-81935T6DNE'] = false;
      if (document.getElementById('ga-script')) {
        if (window.gtag) gtag('consent', 'update', { analytics_storage: 'granted' });
        return;
      }
      var s = document.createElement('script');
      s.id = 'ga-script'; s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=G-81935T6DNE';
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      window.gtag = gtag;
      gtag('js', new Date());
      gtag('config', 'G-81935T6DNE');
      var userLang = lsGet('aidedcam-lang') || document.documentElement.lang || 'el';
      gtag('set', 'user_properties', { preferred_language: userLang });
    }
    function revokeGA() {
      window['ga-disable-G-81935T6DNE'] = true;
      if (window.gtag) gtag('consent', 'update', { analytics_storage: 'denied' });
      var root = location.hostname.replace(/^www\./, '');
      document.cookie.split(';').forEach(function (c) {
        var n = c.split('=')[0].trim();
        if (n === '_ga' || n.indexOf('_ga_') === 0) {
          ['', location.hostname, '.' + root].forEach(function (d) {
            document.cookie = n + '=; Max-Age=0; path=/' + (d ? '; domain=' + d : '');
          });
        }
      });
    }
    if (lsGet('privacy-pref') === 'accepted') { loadGA(); }
  </script>
  <link rel="stylesheet" href="fonts.css?v=20260923" />
  <link rel="stylesheet" href="css/editorial.css?v=20260927" />
  <link rel="stylesheet" href="css/tools.css?v=20261015" />
</head>
<body>

  <nav class="navbar" id="navbar">
    <div class="nav-container">
      <a href="index.html" class="nav-logo">
        <img src="aided-cam-mark.png" alt="AidedCAM" width="30" height="34" />
        <img class="wordmark" src="aidedcam-wordmark.svg" alt="" width="716" height="67" />
      </a>
      <div class="nav-right">
        <a href="index.html" class="nav-back" data-i18n="gv.back">Αρχική</a>
        <div class="lang-switcher">
          <button class="lang-btn active" data-lang="el">EL</button>
          <button class="lang-btn" data-lang="en">EN</button>
          <button class="lang-btn" data-lang="it">IT</button>
        </div>
      </div>
    </div>
  </nav>

  <main class="gv">
    <header class="gv-head">
      <p class="gv-eyebrow" data-i18n="ft.eyebrow">Δωρεάν εργαλεία</p>
      <h1 data-i18n="ft.title">Δωρεάν εργαλεία για προγραμματιστές CNC</h1>
      <p class="gv-lede" data-i18n="ft.lede">Ανοίγουν αμέσως στον browser, χωρίς εγκατάσταση και χωρίς εγγραφή. Το πρόγραμμά σας δεν φεύγει ποτέ από τον υπολογιστή σας.</p>
    </header>

    <div class="gv-wrap">
      <section class="ft-cards">
        <a class="ft-card" href="gcode-viewer.html">
          <h2 data-i18n="ft.lathe.title">Προβολή G-code τόρνου</h2>
          <p data-i18n="ft.lathe.text">Τα περάσματα που κάνουν οι κύκλοι G70–G76 και G90/G92/G94, ο χρόνος κύκλου ανά εργαλείο και τα συνηθισμένα λάθη προγραμματισμού.</p>
          <span class="ft-open" data-i18n="ft.open">Άνοιγμα →</span>
        </a>
        <a class="ft-card" href="milling-gcode-viewer.html">
          <h2 data-i18n="ft.mill.title">Προβολή G-code φρέζας</h2>
          <p data-i18n="ft.mill.text">Κάθε κίνηση σε 3D, οι κύκλοι διάτρησης G81–G89 όπως τους εκτελεί ο έλεγχος, ο χρόνος ανά εργαλείο και έλεγχοι προγράμματος.</p>
          <span class="ft-open" data-i18n="ft.open">Άνοιγμα →</span>
        </a>
      </section>

      <section class="gv-cta">
        <h2 data-i18n="gv.cta.title">Χρειάζεστε κάτι φτιαγμένο για τις δικές σας μηχανές;</h2>
        <p data-i18n="gv.cta.text">Φτιάχνουμε λογισμικό CAM στα μέτρα σας: post-processor, αυτοματισμούς και εργαλεία σαν αυτά.</p>
        <a class="btn-primary" id="gvCta" href="index.html#contact" data-i18n="gv.cta.button">Μιλήστε μαζί μας</a>
      </section>
    </div>
  </main>

  <footer class="gv-footer">
    <img src="aidedcam-wordmark.svg" alt="AidedCAM" width="716" height="67" loading="lazy" />
    <div class="gv-footer-legal">
      <a href="privacy.html" data-i18n="footer.privacy">Απόρρητο</a>
      <a href="legal.html" data-i18n="footer.legal">Νομικά</a>
      <a href="javascript:void(0)" onclick="openCookieSettings()" data-i18n="footer.cookie_settings">Ρυθμίσεις Cookies</a>
    </div>
  </footer>

  <!-- COOKIE CONSENT BANNER: markup identical to calculator.html lines 925-977 -->
  <div class="consent-banner" id="privacyOverlay">
    <div class="consent-inner">
      <p>
        <span data-i18n="cookie_text">Αυτός ο ιστότοπος χρησιμοποιεί cookies για τη βελτιστοποίηση της λειτουργίας του και την ανάλυση επισκεψιμότητας.</span>
        <a href="privacy.html" class="consent-privacy-link" data-i18n="cookie_privacy_link">Πολιτική Απορρήτου</a>
      </p>
      <div class="consent-actions">
        <button class="consent-btn consent-btn-accept" id="privacyAccept" data-i18n="cookie_accept">Αποδοχή</button>
        <button class="consent-btn consent-btn-manage" id="privacyManage" data-i18n="cookie_manage">Διαχείριση προτιμήσεων</button>
        <button class="consent-btn consent-btn-decline" id="privacyDecline" data-i18n="cookie_decline">Απόρριψη</button>
      </div>
    </div>
    <div class="consent-prefs" id="consentPrefs">
      <div class="consent-prefs-inner">
        <p class="consent-prefs-desc" data-i18n="cookie_prefs_desc">Επιλέξτε ποιες κατηγορίες cookies επιθυμείτε να ενεργοποιήσετε. Τα απαραίτητα cookies είναι πάντα ενεργά για τη σωστή λειτουργία του ιστότοπου.</p>
        <div class="consent-categories">
          <div class="consent-cat">
            <input type="checkbox" checked disabled id="cookieNecessary">
            <label for="cookieNecessary">
              <span class="consent-cat-name" data-i18n="cookie_cat_necessary">Απαραίτητα</span>
              <span class="consent-cat-desc" data-i18n="cookie_cat_necessary_desc">Βασική λειτουργία ιστότοπου</span>
            </label>
          </div>
          <div class="consent-cat">
            <input type="checkbox" checked disabled id="cookieFunctional">
            <label for="cookieFunctional">
              <span class="consent-cat-name" data-i18n="cookie_cat_functional">Λειτουργικά</span>
              <span class="consent-cat-desc" data-i18n="cookie_cat_functional_desc">Αποθήκευση προτιμήσεων γλώσσας</span>
            </label>
          </div>
          <div class="consent-cat">
            <input type="checkbox" id="cookieAnalytics">
            <label for="cookieAnalytics">
              <span class="consent-cat-name" data-i18n="cookie_cat_analytics">Ανάλυση επισκεψιμότητας</span>
              <span class="consent-cat-desc" data-i18n="cookie_cat_analytics_desc">Google Analytics, ανώνυμα στατιστικά</span>
            </label>
          </div>
          <div class="consent-cat">
            <input type="checkbox" disabled id="cookieMarketing">
            <label for="cookieMarketing">
              <span class="consent-cat-name" data-i18n="cookie_cat_marketing">Διαφημιστικά</span>
              <span class="consent-cat-desc" data-i18n="cookie_cat_marketing_desc">Δεν χρησιμοποιούνται αυτήν τη στιγμή</span>
            </label>
          </div>
        </div>
        <div class="consent-prefs-actions">
          <button class="consent-btn consent-btn-accept" id="privacySavePrefs" data-i18n="cookie_save">Αποθήκευση προτιμήσεων</button>
          <button class="consent-btn consent-btn-decline" id="privacyBack" data-i18n="cookie_back">Πίσω</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    var translations = {
      el: {
        "gv.back": "Αρχική",
        "_title": "AidedCAM - Δωρεάν εργαλεία",
        "gv.cta.button": "Μιλήστε μαζί μας",
        "cookie_text": "Αυτός ο ιστότοπος χρησιμοποιεί cookies για τη βελτιστοποίηση της λειτουργίας του και την ανάλυση επισκεψιμότητας.",
        "cookie_accept": "Αποδοχή",
        "cookie_decline": "Απόρριψη",
        "cookie_manage": "Διαχείριση προτιμήσεων",
        "cookie_privacy_link": "Πολιτική Απορρήτου",
        "cookie_prefs_desc": "Επιλέξτε ποιες κατηγορίες cookies επιθυμείτε να ενεργοποιήσετε. Τα απαραίτητα cookies είναι πάντα ενεργά για τη σωστή λειτουργία του ιστότοπου.",
        "cookie_cat_necessary": "Απαραίτητα",
        "cookie_cat_necessary_desc": "Βασική λειτουργία ιστότοπου",
        "cookie_cat_functional": "Λειτουργικά",
        "cookie_cat_functional_desc": "Αποθήκευση προτιμήσεων γλώσσας",
        "cookie_cat_analytics": "Ανάλυση επισκεψιμότητας",
        "cookie_cat_analytics_desc": "Google Analytics, ανώνυμα στατιστικά",
        "cookie_cat_marketing": "Διαφημιστικά",
        "cookie_cat_marketing_desc": "Δεν χρησιμοποιούνται αυτήν τη στιγμή",
        "cookie_back": "Πίσω",
        "cookie_save": "Αποθήκευση προτιμήσεων",
        "footer.privacy": "Απόρρητο",
        "footer.legal": "Νομικά",
        "footer.cookie_settings": "Ρυθμίσεις Cookies",
        "ft.eyebrow": "Δωρεάν εργαλεία",
        "ft.title": "Δωρεάν εργαλεία για προγραμματιστές CNC",
        "ft.lede": "Ανοίγουν αμέσως στον browser, χωρίς εγκατάσταση και χωρίς εγγραφή. Το πρόγραμμά σας δεν φεύγει ποτέ από τον υπολογιστή σας.",
        "ft.lathe.title": "Προβολή G-code τόρνου",
        "ft.lathe.text": "Τα περάσματα που κάνουν οι κύκλοι G70–G76 και G90/G92/G94, ο χρόνος κύκλου ανά εργαλείο και τα συνηθισμένα λάθη προγραμματισμού.",
        "ft.mill.title": "Προβολή G-code φρέζας",
        "ft.mill.text": "Κάθε κίνηση σε 3D, οι κύκλοι διάτρησης G81–G89 όπως τους εκτελεί ο έλεγχος, ο χρόνος ανά εργαλείο και έλεγχοι προγράμματος.",
        "ft.open": "Άνοιγμα →",
        "gv.cta.title": "Χρειάζεστε κάτι φτιαγμένο για τις δικές σας μηχανές;",
        "gv.cta.text": "Φτιάχνουμε λογισμικό CAM στα μέτρα σας: post-processor, αυτοματισμούς και εργαλεία σαν αυτά.",
      },
      en: {
        "gv.back": "Home",
        "_title": "AidedCAM - Free tools",
        "gv.cta.button": "Talk to us",
        "cookie_text": "This website uses cookies to optimize functionality and analyze traffic.",
        "cookie_accept": "Accept",
        "cookie_decline": "Decline",
        "cookie_manage": "Manage preferences",
        "cookie_privacy_link": "Privacy Policy",
        "cookie_prefs_desc": "Choose which categories of cookies you wish to enable. Essential cookies are always active for the proper functioning of the website.",
        "cookie_cat_necessary": "Essential",
        "cookie_cat_necessary_desc": "Basic website functionality",
        "cookie_cat_functional": "Functional",
        "cookie_cat_functional_desc": "Language preference storage",
        "cookie_cat_analytics": "Analytics",
        "cookie_cat_analytics_desc": "Google Analytics, anonymous statistics",
        "cookie_cat_marketing": "Marketing",
        "cookie_cat_marketing_desc": "Not currently used",
        "cookie_back": "Back",
        "cookie_save": "Save preferences",
        "footer.privacy": "Privacy",
        "footer.legal": "Legal",
        "footer.cookie_settings": "Cookie Settings",
        "ft.eyebrow": "Free tools",
        "ft.title": "Free tools for CNC programmers",
        "ft.lede": "They open instantly in your browser, with no install and no sign-up. Your program never leaves your computer.",
        "ft.lathe.title": "Lathe G-code viewer",
        "ft.lathe.text": "The passes that G70–G76 and G90/G92/G94 cycles really make, cycle time per tool, and common programming mistakes.",
        "ft.mill.title": "Milling G-code viewer",
        "ft.mill.text": "Every move in 3D, drilling cycles G81–G89 as the control runs them, time per tool, and program checks.",
        "ft.open": "Open →",
        "gv.cta.title": "Need something built around your own machines?",
        "gv.cta.text": "We build tailor-made CAM software: post-processors, automation and tools like these.",
      },
      it: {
        "gv.back": "Home",
        "_title": "AidedCAM - Strumenti gratuiti",
        "gv.cta.button": "Parlate con noi",
        "cookie_text": "Questo sito web utilizza i cookie per ottimizzare le sue funzionalità e analizzare il traffico.",
        "cookie_accept": "Accetta",
        "cookie_decline": "Rifiuta",
        "cookie_manage": "Gestisci preferenze",
        "cookie_privacy_link": "Informativa Privacy",
        "cookie_prefs_desc": "Scegliete quali categorie di cookie desiderate attivare. I cookie essenziali sono sempre attivi per il corretto funzionamento del sito.",
        "cookie_cat_necessary": "Essenziali",
        "cookie_cat_necessary_desc": "Funzionalità di base del sito web",
        "cookie_cat_functional": "Funzionali",
        "cookie_cat_functional_desc": "Memorizzazione preferenza lingua",
        "cookie_cat_analytics": "Analitici",
        "cookie_cat_analytics_desc": "Google Analytics, statistiche anonime",
        "cookie_cat_marketing": "Marketing",
        "cookie_cat_marketing_desc": "Attualmente non utilizzati",
        "cookie_back": "Indietro",
        "cookie_save": "Salva preferenze",
        "footer.privacy": "Privacy",
        "footer.legal": "Note Legali",
        "footer.cookie_settings": "Impostazioni Cookie",
        "ft.eyebrow": "Strumenti gratuiti",
        "ft.title": "Strumenti gratuiti per programmatori CNC",
        "ft.lede": "Si aprono subito nel browser, senza installazione e senza registrazione. Il vostro programma non lascia mai il vostro computer.",
        "ft.lathe.title": "Visualizzatore G-code per tornio",
        "ft.lathe.text": "Le passate che i cicli G70–G76 e G90/G92/G94 eseguono davvero, il tempo ciclo per utensile e gli errori di programmazione più comuni.",
        "ft.mill.title": "Visualizzatore G-code per fresa",
        "ft.mill.text": "Ogni movimento in 3D, i cicli di foratura G81–G89 come li esegue il controllo, il tempo per utensile e i controlli del programma.",
        "ft.open": "Apri →",
        "gv.cta.title": "Vi serve qualcosa costruito sulle vostre macchine?",
        "gv.cta.text": "Realizziamo software CAM su misura: post-processor, automazioni e strumenti come questi.",
      },
    };
    window.GV_I18N = translations;
    var currentLang = 'el';

    function setLanguage(lang) {
      var t = translations[lang];
      if (!t) return;
      currentLang = lang;
      document.querySelectorAll('[data-i18n]').forEach(function (el) {
        var key = el.getAttribute('data-i18n');
        if (t[key] !== undefined) el.textContent = t[key];
      });
      document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
        var key = el.getAttribute('data-i18n-aria');
        if (t[key] !== undefined) el.setAttribute('aria-label', t[key]);
      });
      document.title = t['_title'] || document.title;
      document.documentElement.lang = lang;
      document.querySelectorAll('.lang-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
      });
      lsSet('aidedcam-lang', lang);
      document.dispatchEvent(new CustomEvent('gv:lang', { detail: lang }));
    }

    try {
      var urlLangParam = new URLSearchParams(window.location.search).get('lang');
      var urlLang = (urlLangParam && translations[urlLangParam]) ? urlLangParam : null;
      var savedLang = lsGet('aidedcam-lang');
      if (savedLang && !translations[savedLang]) savedLang = null;
      var browserLangCode = navigator.language ? navigator.language.substring(0, 2) : 'el';
      var browserLang = browserLangCode === 'el' ? 'el' : browserLangCode === 'it' ? 'it' : 'en';
      currentLang = urlLang || savedLang || browserLang;
      if (currentLang !== 'el') setLanguage(currentLang);
    } catch (e) { console.error('i18n init:', e); }

    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { setLanguage(btn.getAttribute('data-lang')); });
    });

    // ===== COOKIE CONSENT (copied from calculator.html) =====
    (function () {
      var overlay = document.getElementById('privacyOverlay');
      var prefsPanel = document.getElementById('consentPrefs');
      var analyticsCheckbox = document.getElementById('cookieAnalytics');
      function showBanner() { overlay.classList.add('visible'); prefsPanel.classList.remove('visible'); }
      function hideBanner() { overlay.classList.remove('visible'); prefsPanel.classList.remove('visible'); }
      function loadPrefs() {
        try {
          var prefs = JSON.parse(lsGet('cookie-prefs') || '{}');
          analyticsCheckbox.checked = !!(prefs && prefs.analytics);
        } catch (e) { analyticsCheckbox.checked = false; }
      }
      if (!lsGet('privacy-pref')) { showBanner(); }
      document.getElementById('privacyAccept').addEventListener('click', function () {
        lsSet('privacy-pref', 'accepted');
        lsSet('cookie-prefs', JSON.stringify({ analytics: true }));
        hideBanner(); loadGA(); gaEvent('accepted_cookie_consent', {});
      });
      document.getElementById('privacyDecline').addEventListener('click', function () {
        lsSet('privacy-pref', 'declined');
        lsSet('cookie-prefs', JSON.stringify({ analytics: false }));
        hideBanner(); revokeGA();
      });
      document.getElementById('privacyManage').addEventListener('click', function () {
        loadPrefs(); prefsPanel.classList.toggle('visible');
      });
      document.getElementById('privacyBack').addEventListener('click', function () {
        prefsPanel.classList.remove('visible');
      });
      document.getElementById('privacySavePrefs').addEventListener('click', function () {
        var prefs = { analytics: analyticsCheckbox.checked };
        lsSet('cookie-prefs', JSON.stringify(prefs));
        lsSet('privacy-pref', prefs.analytics ? 'accepted' : 'declined');
        hideBanner();
        if (prefs.analytics) { loadGA(); gaEvent('accepted_cookie_consent', {}); } else { revokeGA(); }
      });
      window.openCookieSettings = function () { loadPrefs(); showBanner(); prefsPanel.classList.add('visible'); };
    })();

    // ===== GA HELPER: events only exist when the visitor accepted analytics =====
    function gaEvent(name, params) { if (window.gtag) gtag('event', name, params); }
    window.gaEvent = gaEvent;
  </script>
</body>
</html>
```

- [ ] **Step 3: Links, sitemap and llms.txt**

<!-- file: _tests/private/edit-site-links.mjs -->
```js
// One-off site edits (plan Task 18): the homepage "Free tools" links point to the index, the
// sitemap lists the two new pages, and llms.txt describes the milling viewer. ASCII only.
import { readFileSync, writeFileSync } from 'node:fs';

const eolOf = s => (s.includes('\r\n') ? '\r\n' : '\n');

let index = readFileSync('index.html', 'utf8');
const links = index.match(/href="gcode-viewer\.html"( class="nav-link")? data-i18n="nav\.freetools"/g) || [];
if (links.length !== 2) throw new Error(`expected 2 "Free tools" links, found ${links.length}`);
index = index.replace(/href="gcode-viewer\.html"( class="nav-link")? data-i18n="nav\.freetools"/g,
  'href="free-tools.html"$1 data-i18n="nav.freetools"');
writeFileSync('index.html', index);

let sitemap = readFileSync('sitemap.xml', 'utf8');
const E = eolOf(sitemap);
const entry = (loc, priority) => ['  <url>', `    <loc>https://www.aidedcam.com/${loc}</loc>`, '    <lastmod>2026-10-15</lastmod>',
  '    <changefreq>monthly</changefreq>', `    <priority>${priority}</priority>`, '  </url>'].join(E);
if (sitemap.split('</urlset>').length !== 2) throw new Error('expected one </urlset>');
sitemap = sitemap.replace('</urlset>', entry('milling-gcode-viewer.html', '0.8') + E + entry('free-tools.html', '0.7') + E + '</urlset>');
writeFileSync('sitemap.xml', sitemap);

let llms = readFileSync('llms.txt', 'utf8');
const L = eolOf(llms);
const lathe = llms.split(/\r?\n/).filter(x => x.startsWith('- Lathe G-code viewer'));
if (lathe.length !== 1) throw new Error('expected one lathe line in llms.txt');
llms = llms.replace(lathe[0], 'Index: https://www.aidedcam.com/free-tools.html' + L + lathe[0] + L +
  '- Milling G-code viewer (https://www.aidedcam.com/milling-gcode-viewer.html): runs in the browser, nothing is uploaded; '
  + 'draws every move of a 3-axis Fanuc/Haas program in 3D, expands drilling cycles G73/G74/G76/G81-G89 into their real '
  + 'pecks and retracts, estimates time per tool change, and flags common programming mistakes. Greek, English, Italian.');
writeFileSync('llms.txt', llms);
console.log('links edited');
```

Run: `node _tests/extract.mjs <brief> _tests/private/edit-site-links.mjs && node _tests/private/edit-site-links.mjs && rm _tests/private/edit-site-links.mjs`
Expected: `links edited`. `git diff --stat` shows index.html `2 insertions(+), 2 deletions(-)`, sitemap.xml `12 insertions(+)` and llms.txt `2 insertions(+)`.

- [ ] **Step 4: Check**

Run:
```bash
node _tests/extract.mjs <brief> free-tools.html --check
awk '/<script[^>]*>/{if($0 !~ /src=/){f=1;next}} /<\/script>/{f=0} f' free-tools.html > /tmp/ft-inline.js && node --check /tmp/ft-inline.js && echo INLINE_OK
node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js"
```
Expected: `matches`, `INLINE_OK`, and 263 pass.

- [ ] **Step 5: Commit**

```bash
git add free-tools.html index.html sitemap.xml llms.txt _tests/gcode/i18n.test.js
git commit -F - <<'EOF'
Free tools index: both viewers on one page; homepage link, sitemap and llms.txt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 19: Browser verification (Playwright MCP)

**Files:** none are committed. Screenshots go to `C:\Users\aris_\Desktop\Aris\.playwright-mcp\` and are named `mv-*.png`.

Serve the repo root with `python -m http.server 8765 --bind 127.0.0.1`, started with the Bash tool's `run_in_background`. Load the Playwright MCP tools with ToolSearch. For the 1M-line checks, first run `node _tests/mill/perf.mjs`: it writes `_tests/private/perf-mill-1m.nc`, which the server can then serve at `/_tests/private/perf-mill-1m.nc`.

Record every check as PASS/FAIL with its evidence (the evaluate output, or a screenshot description) in the report.

- [ ] **Step 1: The milling page at 1280×800, `?lang=en`**

1. The first load matches Task 17's smoke values (rows, total `2:19`, no issues, `227 / 227 moves`, envelope).
2. **Top view and hover.**
   - Click `[data-view="top"]` and wait 400 ms. With the canvas centre at the cut-bounds centre (X50 Y25) and scale = canvas height ÷ (88.6 × 2.2) px/mm, dispatch `pointermove` at X50 Y35.
   - The readout reads `Line 27 · X50.000 Y35.000 Z-5.000`, and line 27 is `is-hi`.
3. **Tap to pin.**
   - `pointerdown` and then `pointerup` at the same point pins line 27.
   - A `pointermove` elsewhere keeps line 27 highlighted.
   - `Escape` clears the pin.
4. **Tool isolation.**
   - Click the third time-table row: `#gvIsoHint` reads `Showing T3 only. Click its row again to show all.`, `#gvPlayPos` reads `217 / 227 moves`, and the row has class `is-iso`.
   - Click it again: the hint is empty and `227 / 227 moves` returns.
5. **Playback.**
   - Set `#gvScrub` to 100 and dispatch `input`: the label reads `100 / 227 moves`.
   - Click `#gvPlay` and wait 250 ms: `227 / 227 moves`, and the button shows `▶` again.
6. **Print snapshot.** `window.dispatchEvent(new Event('beforeprint'))` sets `#gvShot.src` to a `data:image/png;base64,…` URL longer than 10,000 characters. Emulate print media and take a screenshot: the header, the snapshot, the legend, the table and the checks show; the canvas, playback bar, toolbar controls, nav and CTA are hidden.
7. **Languages.**
   - EL: `[data-view="top"]` reads `Πάνω`; `#gvDims` reads `Περιοχή κοπής: X 160,00 × Y 70,00 × Z 30,00 mm` (decimal comma); the title reads `AidedCAM - Προβολή G-code φρέζας`.
   - IT: `[data-view="front"]` reads `Fronte`, and the checks read `Nessun problema rilevato.`
8. **Keyboard.** Focus `.gv-3d-canvas`, then press `+`, `-`, `ArrowLeft`, `ArrowUp` and `f`. There are no errors; take a screenshot after `f` (fitted).

- [ ] **Step 2: The 1M-line program**

9. On the milling page, fetch `/_tests/private/perf-mill-1m.nc` in `browser_evaluate` and paste it by dispatching a `ClipboardEvent('paste')` with the text. Record frame gaps with `requestAnimationFrame`, then wait until `#gvPlayPos` contains `999`.
   - Expected: paste to the first frame under 6000 ms (validated at 1361), the longest frame under 250 ms (validated at 163), and one time-table row.
   - Warm up with `await until(/227/)`. Put a timeout on every wait loop, so a wrong expectation can't hang the session.
10. Orbit with a left-button drag (pointerdown, 10 pointermoves, pointerup) and record the frame gaps: expect no frame over 250 ms. Software WebGL in headless Chrome is slower than a real GPU, so record the number rather than insisting on 30 fps.

- [ ] **Step 3: Lathe ↔ milling handoff**

11. **Lathe to milling.**
    - On `gcode-viewer.html?lang=en`, paste `O3000 (MILL PART)\nG17 G90 G54 G0 X10 Y20 S3000 M3\nG43 Z5 H1\nG1 Z-2 F200\nX60 Y40\nG0 Z50\nM30` and click the banner's button.
    - The browser lands on `/milling-gcode-viewer.html`, whose first program line is `O3000 (MILL PART)`.
    - `#gvPlayPos` reads `3 / 3 moves`, `#gvPrintName` reads `O3000`, and `sessionStorage.getItem('aidedcam-gv-handoff')` is null.
12. **Milling to lathe.**
    - On the milling page, paste `G18 G21 G99\nG50 S3000\nG96 S200 M3\nT0101\nG0 X50 Z2\nG1 Z-20 F0.2\nX60\nM30`. The banner reads `This looks like a lathe program. Open in the lathe viewer`.
    - Click it: the lathe page opens with that program, its time table shows `T0101`, and the banner is hidden.

- [ ] **Step 4: Layout, index, network, lathe**

13. The milling page at 375×800, `?lang=el`:
    - `scrollWidth` equals `clientWidth` (≤ 375);
    - `#gvView` is 380 px high, and the drawing comes before the program panel;
    - a full-page screenshot looks right.
14. `free-tools.html?lang=it` at 1280×800: two cards (`gcode-viewer.html` and `milling-gcode-viewer.html`), the nav back link reads `Home`, and the page title is `AidedCAM - Strumenti gratuiti`. Take a screenshot.
15. `index.html?lang=it`: the nav link `[data-i18n="nav.freetools"]` and the footer link both point to `free-tools.html`, and clicking the nav link opens it, still in Italian.
16. **Network.** `performance.getEntriesByType('resource')` on the milling page, the lathe page and the index lists only `127.0.0.1:8765`. Consent is not accepted, so GA isn't loaded.
17. **Lathe regression.** Task 4 Step 4 checks 1–6 and 8–10 again. Check 7 is now covered by check 11 above.
18. **Console.** `browser_console_messages` with `all: true` shows no errors across the session.

- [ ] **Step 5: Clean up**

Stop the server, and confirm `netstat -ano | grep ":8765 .*LISTENING"` prints nothing. Close the browser, and delete any copy of the 1M-line file outside `_tests/private/`. Nothing is committed.

---

### Task 20: Launch preparation (stop before any push)

**Files:**
- Create: `_docs/gcode-viewer/milling-timing-check.md`
- Modify, on deploy day only: every `?v=20261015` and the sitemap `lastmod` `2026-10-15`

- [ ] **Step 1: The timing record**

<!-- file: _docs/gcode-viewer/milling-timing-check.md -->
```markdown
# Real-machine timing check: milling viewer

Spec §10.7, as the lathe check (`timing-check.md`). Run 2–3 programs on a real vertical machining centre, compare
the machine's cycle time with the viewer's estimate, and set the default correction % from the average.

| Program (synthetic or shop-approved) | Machine / control | Rapid X/Y/Z used (mm/min) | Tool change used (s) | Measured cycle time | Viewer estimate | Difference % |
|---|---|---|---|---|---|---|

Decision: default correction % = (average difference, rounded to 5 %). Recorded by: <name>, <date>.
```

- [ ] **Step 2: Deploy date**

The date strings stay `20261015` / `2026-10-15` until Aris names the deploy day. Then replace them:
```bash
grep -rl "v=20261015" --include=*.html --include=*.js . | xargs sed -i 's/v=20261015/v=YYYYMMDD/g'
sed -i 's#<lastmod>2026-10-15</lastmod>#<lastmod>YYYY-MM-DD</lastmod>#g' sitemap.xml
```
`js/mill/ui.js` carries the worker URL `?v=`, so it is included.

- [ ] **Step 3: Run everything**

Run: `node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js"` and `node _tests/mill/perf.mjs`.
Expected: 263 pass; perf under 4000 ms.

- [ ] **Step 4: Commit, then stop**

```bash
git add _docs/gcode-viewer/milling-timing-check.md
git commit -F - <<'EOF'
Milling viewer: real-machine timing record (to be filled)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

**Stop here.** Merging and pushing `main` publishes the site; that is Aris's decision. Before any push:
- squash the branch;
- grep the whole branch history for client names: `git log -p main..HEAD | grep -i -E "<client names>"` must print nothing.
