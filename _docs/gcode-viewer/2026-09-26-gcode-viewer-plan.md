# Lathe G-code Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a free, instant, lathe-only G-code viewer page (`/gcode-viewer.html`) for www.aidedcam.com.
It draws the passes the control generates for Fanuc canned cycles, times them per tool and flags
common mistakes, in GR/EN/IT.

**Architecture:**
- A static page in the existing site pattern (inline translations, consent, GA), plus plain ES modules
  under `js/gcode/` with no build step.
- A pure pipeline, `parse → machine/interpret → cycles → segments → { time, checks, render }`, tested with
  `node --test`.
- A thin DOM layer (`drawing.js`, `ui.js`) that draws an SVG X–Z half-section.

**Tech Stack:** HTML/CSS/vanilla JS (ES2020 modules), SVG, Node ≥ 18 test runner (`node:test`,
`node:assert/strict`). No npm packages, no bundler.

**Spec:** `_docs/gcode-viewer/2026-09-26-gcode-viewer-design.md` (read it first; this plan argues from it).

**Repo:** `C:\Users\aris_\Desktop\AidedCAM\aidedcam-page` (GitHub Pages serves `main` directly).

## Global Constraints

- **Scope:** lathe G-code **viewer** only. No simulation, no stock model, no milling (spec §1).
- **No gate:** completely free, no form; printing is free (spec §1, §2).
- **Delivery:** plain ES modules loaded with `<script type="module">`. No npm dependencies, no bundler,
  no external scripts except the existing GA loader (spec §3.1).
- **Units:** internal unit is **mm**, and **X is radius**. Diameter appears only in labels and display
  (spec §3.3).
- **Pure modules:** every module except `drawing.js` and `ui.js` is pure (no DOM) and testable in Node
  (spec §3.2).
- **Cycles G70–G72:** port the desktop-CAM planners (`G71PassPlanner` (internal desktop-CAM source),
  `G72PassPlanner.cs`, `G70PassPlanner.cs`, `PassPlannerCommon.cs`), **not** the Python prototype
  (spec §5.1).
- **Other cycles:** every cycle other than G70–G72 gets a research note in `_docs/gcode-viewer/cycles/`,
  verified against the Fanuc/Haas references **before** its code is merged. The manual wins over this
  plan (spec §5.3).
- **GA:** only after consent, via the page's `gaEvent()`. Never send program text, file names or free
  text (spec §9).
- **Visual design:** data colours must be ≥ 3:1 against `--paper #f4f3ee`. Monospace only in the
  program panel. Works at 375 px width with no horizontal scroll and a 16 px gutter (spec §8).
- **Confidentiality:** customer programs (kept outside the repo) never enter the repo.
  They live only in git-ignored `_tests/private/` (spec §10.5).
- **Unpublished folders:** folders starting with `_` are not published by GitHub Pages (Jekyll default).
  Tests and docs live there.
- **Cache-busting:** shared assets are referenced with `?v=YYYYMMDD`.
- **Test command:** `node --test "_tests/gcode/*.test.js"`. Node 22+ needs the glob; a bare folder path fails.
- **Git:** work on branch `feat/gcode-viewer`, never commit to `main` directly, and add the attribution
  trailer from the session instructions to every commit.

## Review Focus

These are the inputs most likely to break the viewer for a real user, even though the spec doesn't
name them. Each one has a test in the task that owns the code.

1. **Glued tool calls such as `T3W303`** (glued dialect). They must be read as one tool call, not a
   202 mm incremental Z move. Covered in Task 1, the `T3W303` test.
2. **Messy real files:** CRLF, tabs, lowercase, `%` lines, glued words (`G99G18`), no N numbers. They
   must parse without losing words. Covered in Task 1, the CRLF/tabs and glued-words tests.
3. **Unknown start position:** programs begin after `G28U0 / G28W0` (home unknown), so the first moves
   must not draw lines from a made-up origin. Covered in Task 5, the "first move from unknown position"
   test.
4. **Missing or misplaced P/Q profile blocks** (profile after `M30`, or an N number that doesn't exist).
   No crash; the cycle is reported and the rest still draws. Covered in Task 6 and Task 8, the "P/Q not found"
   test.
5. **Facing to X0 under G96 with no G50 limit:** the time must stay finite and the warning must
   appear. Covered in Task 13, the "G96 to centre without G50" test, and Task 14, the `g96-no-g50` test.

---

## File Structure

Created in the site repo. The file list refines spec §3.1: G71/G72 share one file, and G74/G75 share one.

| File | Responsibility |
|---|---|
| `js/gcode/parse.js` | Text → `Block[]` (words, N/O numbers, comments, skipped lines, tool-call merge) |
| `js/gcode/settings.js` | `DEFAULT_SETTINGS`, `withDefaults()` |
| `js/gcode/dialects.js` | G-code system A/B/C map, one-line cycle detection, auto control detection |
| `js/gcode/geom.js` | Arc centres, arc sampling and length, `flatten()`, `firstIntrusion()` |
| `js/gcode/machine.js` | Modal state, word/length helpers, `executeBlock()`, `pushSegment()`, `feedMove()`, events |
| `js/gcode/profile.js` | `readProfile()`: find P…Q and replay it in a sandbox |
| `js/gcode/cycles/rough.js` | G71/G72: `roughFrame()`, `roughCore()` (desktop-CAM port), `roughMoves()` |
| `js/gcode/cycles/g73.js` | G73 pattern repeat |
| `js/gcode/cycles/peck.js` | G74/G75 peck cycles |
| `js/gcode/cycles/g76.js` | G76 depth schedule and moves |
| `js/gcode/cycles/single.js` | G90/G92/G94 box moves (pure) |
| `js/gcode/cycles/index.js` | Cycle handlers: read params (two-line/one-line), call planners, push segments, record cycles |
| `js/gcode/interpret.js` | Main loop, cycle dispatch, tool labels |
| `js/gcode/time.js` | Seconds per segment, per-tool summary, `formatDuration()` |
| `js/gcode/checks.js` | Events + cycle records → warnings |
| `js/gcode/analyze.js` | `analyze(text, settings)`: the whole pipeline |
| `js/gcode/render.js` | Pure scene: layers, SVG path strings, bounds, spatial index, line↔segment maps |
| `js/gcode/example.js` | The built-in synthetic example program |
| `js/gcode/drawing.js` | DOM: SVG mount, zoom/pan/fit, aspect, hover, highlight |
| `js/gcode/ui.js` | DOM: wires editor, settings, pipeline, tables, checks, print, CTA, survey, GA |
| `css/tools.css` | Tool-page layout, data colours, monospace exception, print stylesheet |
| `gcode-viewer.html` | Page shell (head/meta, nav, main markup, footer, consent, inline i18n + GA) |
| `_tests/gcode/*.test.js`, `_tests/gcode/fixtures/*.nc` | Unit, integration and fixture tests |
| `_tests/gcode/contrast.test.js` | Colour-contrast check for the data colours |
| `_tests/gcode/perf.mjs` | 50k-line synthetic program generator and timing |
| `_docs/gcode-viewer/cycles/*.md` | Research notes (G70–G72 pointers; G73–G76, single cycles, G-code systems) |

Run all tests with: `node --test "_tests/gcode/*.test.js"`

---

## Task 0: Branch and repo hygiene

**Files:**
- Modify: `.gitignore`
- Create: `_tests/gcode/.gitkeep`, `_tests/private/README.md` (git-ignored, local only)

- [ ] **Step 1: Create the branch**

```bash
cd /c/Users/aris_/Desktop/AidedCAM/aidedcam-page
git checkout main && git pull --ff-only
git checkout -b feat/gcode-viewer
```

- [ ] **Step 2: Git-ignore the private test folder BEFORE anything is copied into it**

Append to `.gitignore`:

```gitignore

# Local-only G-code test material (customer programs). Never commit.
_tests/private/
```

- [ ] **Step 3: Verify the ignore works**

```bash
mkdir -p _tests/private _tests/gcode/fixtures
echo "Customer programs for local cross-checks only. Git-ignored." > _tests/private/README.md
touch _tests/gcode/.gitkeep
git status --short
```

Expected: `.gitignore` and `_tests/gcode/.gitkeep` are listed; nothing under `_tests/private/`.

- [ ] **Step 4: Commit (spec + hygiene)**

```bash
git add .gitignore _tests/gcode/.gitkeep _docs/gcode-viewer/2026-09-26-gcode-viewer-design.md _docs/gcode-viewer/2026-09-26-gcode-viewer-plan.md
git commit -m "G-code viewer: spec, plan, and a git-ignored private test folder"
```

---

## Task 1: Parser

**Files:**
- Create: `js/gcode/parse.js`
- Test: `_tests/gcode/parse.test.js`

**Interfaces:**
- Produces:
  - `parseProgram(text: string) → Block[]`
  - `parseLine(raw: string, line: number) → Block`
  - `Block = { line, n: number|null, o: number|null, words: Word[], comment: string|null, raw, skipped: null|'blank'|'macro'|'expression', deleted: boolean }`
  - `Word = { letter: 'A'..'Z', value: number, raw: string, hasDecimal: boolean, start: number, end: number, toolKey?: string }`
  - N and O words are removed from `words` and stored in `n`/`o`.

- [ ] **Step 1: Write the failing tests**

`_tests/gcode/parse.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProgram, parseLine } from '../../js/gcode/parse.js';

const letters = b => b.words.map(w => w.letter + w.raw);

test('words, N number and comment', () => {
  const b = parseLine('N10 G0 G42 X229.5 Z15.366 (PROFILE)', 1);
  assert.equal(b.n, 10);
  assert.deepEqual(letters(b), ['G0', 'G42', 'X229.5', 'Z15.366']);
  assert.equal(b.comment, 'PROFILE');
  assert.equal(b.skipped, null);
});

test('glued words, lowercase and .5 numbers', () => {
  const b = parseLine('g99g18 x.5 z-2.', 3);
  assert.deepEqual(letters(b), ['G99', 'G18', 'X.5', 'Z-2.']);
  assert.equal(b.words[2].value, 0.5);
  assert.equal(b.words[3].value, -2);
  assert.equal(b.words[3].hasDecimal, true);
});

test('semicolon comment and block delete', () => {
  const b = parseLine('/G1 X10 ; note', 1);
  assert.equal(b.deleted, true);
  assert.equal(b.comment, 'note');
  assert.deepEqual(letters(b), ['G1', 'X10']);
});

test('blank, percent, macro and expression lines are skipped', () => {
  assert.equal(parseLine('', 1).skipped, 'blank');
  assert.equal(parseLine('%', 1).skipped, 'blank');
  assert.equal(parseLine('(ONLY A COMMENT)', 1).skipped, 'blank');
  assert.equal(parseLine('#500 = 0', 1).skipped, 'macro');
  assert.equal(parseLine('G1 X[#1+2]', 1).skipped, 'expression');
});

test('T3W303 is one tool call, not a W move', () => {
  const b = parseLine('T3W303', 1);
  assert.equal(b.words.length, 1);
  assert.equal(b.words[0].letter, 'T');
  assert.equal(b.words[0].toolKey, 'T3W303');
});

test('T3 W303 with a space stays two words', () => {
  const b = parseLine('T3 W303', 1);
  assert.deepEqual(letters(b), ['T3', 'W303']);
});

test('CRLF, tabs and line numbers', () => {
  const blocks = parseProgram('G0\tX10\r\nG1 Z-5\r\n');
  assert.equal(blocks.length, 3);
  assert.deepEqual(letters(blocks[1]), ['G1', 'Z-5']);
  assert.equal(blocks[1].line, 2);
});

test('decimal flag and O number', () => {
  assert.equal(parseLine('X100', 1).words[0].hasDecimal, false);
  assert.equal(parseLine('X100.', 1).words[0].hasDecimal, true);
  const o = parseLine('O71', 1);
  assert.equal(o.o, 71);
  assert.deepEqual(o.words, []);
});

test('unclosed comment runs to end of line', () => {
  const b = parseLine('G0 X10 (START', 1);
  assert.deepEqual(letters(b), ['G0', 'X10']);
  assert.equal(b.comment, 'START');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test _tests/gcode/parse.test.js`
Expected: FAIL with `Cannot find module ... js/gcode/parse.js`.

- [ ] **Step 3: Write the implementation**

`js/gcode/parse.js`:

```js
// Text → blocks. Pure: no DOM. See _docs/gcode-viewer/2026-09-26-gcode-viewer-design.md §4.
const WORD_RE = /([A-Z])\s*([+-]?(?:\d+\.?\d*|\.\d+))/g;

export function parseProgram(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const blocks = new Array(lines.length);
  for (let i = 0; i < lines.length; i++) blocks[i] = parseLine(lines[i], i + 1);
  return blocks;
}

export function parseLine(raw, line) {
  const block = { line, n: null, o: null, words: [], comment: null, raw, skipped: null, deleted: false };
  const comments = [];
  // ( ... ) comments, including an unclosed one that runs to the end of the line.
  let s = raw.replace(/\t/g, ' ').replace(/\(([^)]*)\)?/g, (_, c) => { comments.push(c.trim()); return ' '; });
  const semi = s.indexOf(';');
  if (semi >= 0) { comments.push(s.slice(semi + 1).trim()); s = s.slice(0, semi); }
  const text = comments.filter(Boolean).join(' ');
  if (text) block.comment = text;

  s = s.trim();
  if (s.startsWith('/')) { block.deleted = true; s = s.slice(1).trim(); }
  if (s === '' || s === '%') { block.skipped = 'blank'; return block; }
  const up = s.toUpperCase();
  if (up.includes('[')) { block.skipped = 'expression'; return block; }
  if (up.includes('#')) { block.skipped = 'macro'; return block; }

  WORD_RE.lastIndex = 0;
  let m;
  while ((m = WORD_RE.exec(up)) !== null) {
    const numRaw = m[2];
    block.words.push({
      letter: m[1], value: Number(numRaw), raw: numRaw, hasDecimal: numRaw.includes('.'),
      start: m.index, end: m.index + m[0].length,
    });
  }
  mergeToolOffsetWord(block);
  for (const w of block.words) {
    if (w.letter === 'N' && block.n === null) block.n = w.value;
    if (w.letter === 'O' && block.o === null) block.o = w.value;
  }
  block.words = block.words.filter(w => w.letter !== 'N' && w.letter !== 'O');
  return block;
}

// Some controls call tools as T3W303 (tool 3, wear offset 303). Read literally, W303 would be an
// incremental Z move of 303 mm. A W glued to a T (no space between them) belongs to the tool call.
function mergeToolOffsetWord(block) {
  const ws = block.words;
  for (let i = 0; i + 1 < ws.length; i++) {
    if (ws[i].letter === 'T' && ws[i + 1].letter === 'W' && ws[i + 1].start === ws[i].end) {
      ws[i].toolKey = `T${ws[i].raw}W${ws[i + 1].raw}`;
      ws.splice(i + 1, 1);
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test _tests/gcode/parse.test.js`
Expected: all 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add js/gcode/parse.js _tests/gcode/parse.test.js
git commit -m "G-code viewer: parser with comments, skipped lines and glued tool calls"
```

---

## Task 2: Settings and dialects (with the G-code system research note)

**Files:**
- Create: `js/gcode/settings.js`, `js/gcode/dialects.js`, `_docs/gcode-viewer/cycles/gcode-systems.md`
- Test: `_tests/gcode/dialects.test.js`

**Interfaces:**
- Consumes: `Block` from Task 1.
- Produces:
  - `DEFAULT_SETTINGS`, `withDefaults(partial) → Settings`
  - `mapGCode(g: number, system: 'A'|'B'|'C') → number | 'ABS' | 'INC' | 'RET'`
  - `isOneLineRough(block) → boolean`
  - `detectControl(blocks) → 'fanuc' | 'haas'`

- [ ] **Step 1: Write the research note and verify the code table against the manual**

Create `_docs/gcode-viewer/cycles/gcode-systems.md`. Open the FANUC lathe operator's manual (Series 0i
lathe system, chapter "G code list", systems A/B/C) and check every row of the table. **If the manual
differs, the manual wins:** correct the note, the `B`/`C` tables in Step 3, and the tests in Step 2.

```markdown
# G-code systems A / B / C (Fanuc lathe)

Status: DRAFT until checked against the FANUC lathe operator's manual "G code list". Record the
manual title, edition and page here when verified.

The viewer works in system A. Systems B and C are mapped to A before interpretation:

| Function | A | B | C |
|---|---|---|---|
| Turning cycle (box) | G90 | G77 | G20 |
| Thread cycle (box) | G92 | G78 | G21 |
| Facing cycle (box) | G94 | G79 | G24 |
| Coordinate setting / max spindle speed | G50 | G92 | G92 |
| Feed per minute / per rev | G98 / G99 | G94 / G95 | G94 / G95 |
| Absolute / incremental | X,Z / U,W | G90 / G91 | G90 / G91 |
| Inch / metric | G20 / G21 | G20 / G21 | G70 / G71 |
| Finishing / G71 / G72 / G73 / G74 / G75 / G76 | G70–G76 | G70–G76 | G72–G78 |
| Canned-cycle return level (not used by the viewer) | – | G98 / G99 | G98 / G99 |

Open question to settle from the manual: are U/W still incremental addresses in systems B/C?
The viewer keeps U/W incremental in all systems until the manual says otherwise.
```

- [ ] **Step 2: Write the failing tests**

`_tests/gcode/dialects.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapGCode, isOneLineRough, detectControl } from '../../js/gcode/dialects.js';
import { withDefaults, DEFAULT_SETTINGS } from '../../js/gcode/settings.js';
import { parseLine, parseProgram } from '../../js/gcode/parse.js';

test('system A is unchanged', () => {
  assert.equal(mapGCode(71, 'A'), 71);
  assert.equal(mapGCode(90, 'A'), 90);
});

test('system B maps box cycles, feed modes and abs/inc', () => {
  assert.equal(mapGCode(77, 'B'), 90);
  assert.equal(mapGCode(78, 'B'), 92);
  assert.equal(mapGCode(79, 'B'), 94);
  assert.equal(mapGCode(94, 'B'), 98);
  assert.equal(mapGCode(95, 'B'), 99);
  assert.equal(mapGCode(92, 'B'), 50);
  assert.equal(mapGCode(90, 'B'), 'ABS');
  assert.equal(mapGCode(91, 'B'), 'INC');
  assert.equal(mapGCode(98, 'B'), 'RET');
  assert.equal(mapGCode(71, 'B'), 71);
});

test('system C also renumbers the repetitive cycles and inch/metric', () => {
  assert.equal(mapGCode(72, 'C'), 70);
  assert.equal(mapGCode(73, 'C'), 71);
  assert.equal(mapGCode(78, 'C'), 76);
  assert.equal(mapGCode(20, 'C'), 90);
  assert.equal(mapGCode(70, 'C'), 20);
  assert.equal(mapGCode(71, 'C'), 21);
});

test('one-line rough form has P, Q and D in one block', () => {
  assert.equal(isOneLineRough(parseLine('G71 P10 Q20 U0.4 W0.1 D1.5 F0.25', 1)), true);
  assert.equal(isOneLineRough(parseLine('G71 P10 Q20 U0.4 W0.1 F0.25', 1)), false);
});

test('auto control detection', () => {
  assert.equal(detectControl(parseProgram('G71 U1.5 R0.5\nG71 P10 Q20 U0.4 W0.1 F0.25')), 'fanuc');
  assert.equal(detectControl(parseProgram('G71 P10 Q20 U0.4 W0.1 D1.5 F0.25')), 'haas');
});

test('settings defaults and overrides', () => {
  assert.equal(DEFAULT_SETTINGS.rapidX, 20000);
  const s = withDefaults({ system: 'B' });
  assert.equal(s.system, 'B');
  assert.equal(s.xDiameter, true);
});
```

- [ ] **Step 3: Write the implementation**

`js/gcode/settings.js`:

```js
// Viewer settings with defaults. Spec §2 (settings), §7 (time).
export const DEFAULT_SETTINGS = Object.freeze({
  control: 'auto',        // 'auto' | 'fanuc' | 'haas'
  system: 'A',            // G-code system: 'A' | 'B' | 'C'
  integerUnit: 'mm',      // meaning of X/Z/U/W/R/I/K without a decimal point: 'mm' | 'um'
  xDiameter: true,        // X and U are programmed as diameter
  rapidX: 20000,          // mm/min of X axis travel (radius); our desktop CycleTimeEstimator default
  rapidZ: 20000,          // mm/min
  toolChangeSeconds: 3,
  correctionPct: 0,       // multiplies every time figure by (1 + pct/100)
  oneLineRetract: 0.5,    // mm; retract for one-line G71/G72/G74/G75 forms that carry no R
  arcSegments: 48,        // chords per arc for geometry searches
});

export function withDefaults(partial) {
  return { ...DEFAULT_SETTINGS, ...(partial || {}) };
}
```

`js/gcode/dialects.js`:

```js
// Controller dialects. Everything downstream speaks Fanuc G-code system A.
// The B/C tables are checked in _docs/gcode-viewer/cycles/gcode-systems.md.
const B = { 77: 90, 78: 92, 79: 94, 94: 98, 95: 99, 92: 50, 98: 'RET', 99: 'RET' };
const C = {
  20: 90, 21: 92, 24: 94, 70: 20, 71: 21,
  72: 70, 73: 71, 74: 72, 75: 73, 76: 74, 77: 75, 78: 76,
  94: 98, 95: 99, 92: 50, 98: 'RET', 99: 'RET',
};

export function mapGCode(g, system) {
  if (system === 'B' || system === 'C') {
    if (g === 90) return 'ABS';
    if (g === 91) return 'INC';
    const table = system === 'B' ? B : C;
    return Object.prototype.hasOwnProperty.call(table, g) ? table[g] : g;
  }
  return g;
}

const has = (block, letter) => block.words.some(w => w.letter === letter);
const hasG = (block, codes) => block.words.some(w => w.letter === 'G' && codes.includes(Math.trunc(w.value)));

// G71/G72/G73 one-line form (older Fanuc 10T/15T, Haas): P, Q and D in the same block.
export function isOneLineRough(block) {
  return hasG(block, [71, 72, 73]) && has(block, 'P') && has(block, 'Q') && has(block, 'D');
}

// 'auto': Haas when any one-line rough block appears; otherwise Fanuc.
export function detectControl(blocks) {
  return blocks.some(b => !b.skipped && isOneLineRough(b)) ? 'haas' : 'fanuc';
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test _tests/gcode/dialects.test.js`
Expected: all 6 tests PASS. If Step 1 changed the table, the tests were updated to match the manual,
and they still pass.

- [ ] **Step 5: Commit**

```bash
git add js/gcode/settings.js js/gcode/dialects.js _tests/gcode/dialects.test.js _docs/gcode-viewer/cycles/gcode-systems.md
git commit -m "G-code viewer: settings, G-code system map and control detection"
```

---

## Task 3: Geometry helpers

**Files:**
- Create: `js/gcode/geom.js`
- Test: `_tests/gcode/geom.test.js`

**Interfaces:**
- Produces:
  - `Point = { x: number /* radius */, z: number }`
  - `Arc = { cx, cz, r, ccw }`
  - `arcFromR(from: Point, to: Point, r: number, ccw: boolean) → Arc|null`
  - `arcFromIK(from: Point, i: number, k: number, ccw: boolean) → Arc`
  - `sampleArc(from, to, arc, n) → Point[]` (n+1 points, including both ends)
  - `arcSweep(from, to, arc) → number` (signed radians)
  - `segmentLength(seg) → number` (line or arc; `seg = { from, to, arc|null }`)
  - `flatten(body: {from,to,arc}[], n) → { x1, z1, x2, z2 }[]`
  - `firstIntrusion(segs: { d1, c1, d2, c2 }[], target, startC, fallbackC) → number`
  - `pointSegmentDistance(p, a, b) → number`

- [ ] **Step 1: Write the failing tests**

`_tests/gcode/geom.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arcFromR, arcFromIK, sampleArc, arcSweep, segmentLength, flatten, firstIntrusion,
  pointSegmentDistance } from '../../js/gcode/geom.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('G3 corner radius: centre inside the part (desktop-CAM rule: Z right, X up, G3 = CCW)', () => {
  // G3 X245.8 Z-21 R1 from X243.8 Z-20 (diameters) → radius coordinates.
  const a = arcFromR({ x: 121.9, z: -20 }, { x: 122.9, z: -21 }, 1, true);
  near(a.cz, -21); near(a.cx, 121.9); near(a.r, 1);
});

test('G2 of the same chord puts the centre on the other side', () => {
  const a = arcFromR({ x: 121.9, z: -20 }, { x: 122.9, z: -21 }, 1, false);
  near(a.cz, -20); near(a.cx, 122.9);
});

test('I/K centre is incremental from the start (I is a radius value)', () => {
  const a = arcFromIK({ x: 10, z: 0 }, 0, -2, true);
  near(a.cx, 10); near(a.cz, -2); near(a.r, 2);
});

test('arc sampling ends on both endpoints and the sweep is +90°', () => {
  const from = { x: 121.9, z: -20 }, to = { x: 122.9, z: -21 };
  const a = arcFromR(from, to, 1, true);
  const pts = sampleArc(from, to, a, 8);
  assert.equal(pts.length, 9);
  near(pts[0].x, from.x); near(pts[8].z, to.z);
  near(arcSweep(from, to, a), Math.PI / 2);
  near(segmentLength({ from, to, arc: a }), Math.PI / 2);
});

test('flatten keeps lines and chords arcs', () => {
  const from = { x: 121.9, z: -20 }, to = { x: 122.9, z: -21 };
  const flat = flatten([{ from: { x: 0, z: 0 }, to: { x: 5, z: 0 }, arc: null },
    { from, to, arc: arcFromR(from, to, 1, true) }], 4);
  assert.equal(flat.length, 1 + 4);
  assert.deepEqual(flat[0], { x1: 0, z1: 0, x2: 5, z2: 0 });
});

test('firstIntrusion: shoulder face, sloped crossing and skim fallback', () => {
  // Normalised frame: d = depth axis, c = cut axis (cuts run toward smaller c).
  const shoulder = [{ d1: 30, c1: -20, d2: 40, c2: -20 }];
  near(firstIntrusion(shoulder, 35, 2, -40), -20);
  const taper = [{ d1: 30, c1: -10, d2: 40, c2: -30 }];     // climbs from d30 at c-10 to d40 at c-30
  near(firstIntrusion(taper, 35, 2, -40), -20);             // crosses d35 half way
  near(firstIntrusion(shoulder, 45, 2, -40), -40);          // nothing above d45 → fallback
});

test('point to segment distance', () => {
  near(pointSegmentDistance({ x: 1, z: 5 }, { x: 0, z: 0 }, { x: 0, z: 10 }), 1);
  near(pointSegmentDistance({ x: 0, z: 12 }, { x: 0, z: 0 }, { x: 0, z: 10 }), 2);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test _tests/gcode/geom.test.js`
Expected: FAIL with `Cannot find module ... js/gcode/geom.js`.

- [ ] **Step 3: Write the implementation**

`js/gcode/geom.js`:

```js
// Plane geometry in the lathe X–Z plane. Z is horizontal (right), X is vertical (up), X is a radius.
// Arc direction rule verified on production lathe programs (our internal gcode-reviewer-plan.md):
// G3 = CCW, G2 = CW when viewed with Z right and X up.
export const EPS = 1e-9;

// Centre from the R word. r < 0 selects the long (> 180°) arc, as on Fanuc.
export function arcFromR(from, to, r, ccw) {
  const dz = to.z - from.z, dx = to.x - from.x;
  const d = Math.hypot(dz, dx);
  if (d < EPS || !Number.isFinite(r) || r === 0) return null;
  const R = Math.abs(r);
  const h2 = R * R - (d / 2) * (d / 2);
  const h = h2 > 0 ? Math.sqrt(h2) : 0;            // R shorter than half the chord: use the midpoint
  const mz = (from.z + to.z) / 2, mx = (from.x + to.x) / 2;
  const nz = -dx / d, nx = dz / d;                  // left normal of the chord, in (z, x) components
  let side = ccw ? 1 : -1;                          // a CCW arc turns left: centre on the left
  if (r < 0) side = -side;
  return { cz: mz + side * h * nz, cx: mx + side * h * nx, r: Math.max(R, d / 2), ccw };
}

// Centre from I/K: incremental from the start point; on lathes I is always a radius value.
export function arcFromIK(from, i, k, ccw) {
  const cx = from.x + i, cz = from.z + k;
  return { cx, cz, r: Math.hypot(from.x - cx, from.z - cz), ccw };
}

// Signed sweep in radians: positive for CCW, negative for CW. Equal endpoints = full circle.
export function arcSweep(from, to, arc) {
  const a0 = Math.atan2(from.x - arc.cx, from.z - arc.cz);
  const a1 = Math.atan2(to.x - arc.cx, to.z - arc.cz);
  let s = a1 - a0;
  if (arc.ccw) { while (s <= 0) s += 2 * Math.PI; if (s > 2 * Math.PI) s -= 2 * Math.PI; }
  else { while (s >= 0) s -= 2 * Math.PI; if (s < -2 * Math.PI) s += 2 * Math.PI; }
  return s;
}

export function sampleArc(from, to, arc, n) {
  const a0 = Math.atan2(from.x - arc.cx, from.z - arc.cz);
  const sweep = arcSweep(from, to, arc);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    if (i === 0) { pts.push({ x: from.x, z: from.z }); continue; }
    if (i === n) { pts.push({ x: to.x, z: to.z }); continue; }
    const a = a0 + sweep * (i / n);
    pts.push({ x: arc.cx + arc.r * Math.sin(a), z: arc.cz + arc.r * Math.cos(a) });
  }
  return pts;
}

export function segmentLength(seg) {
  if (seg.arc) return Math.abs(arcSweep(seg.from, seg.to, seg.arc)) * seg.arc.r;
  return Math.hypot(seg.to.x - seg.from.x, seg.to.z - seg.from.z);
}

export function flatten(body, n = 48) {
  const out = [];
  for (const s of body) {
    if (s.arc) {
      const pts = sampleArc(s.from, s.to, s.arc, n);
      for (let i = 1; i < pts.length; i++) out.push({ x1: pts[i - 1].x, z1: pts[i - 1].z, x2: pts[i].x, z2: pts[i].z });
    } else {
      out.push({ x1: s.from.x, z1: s.from.z, x2: s.to.x, z2: s.to.z });
    }
  }
  return out;
}

// Port of our desktop G71PassPlanner.FindFirstIntrusionZ in a normalised frame:
// d = depth axis, c = cut axis. Walking from the entry toward smaller c, returns the c where the
// contour FIRST rises above `target` in d; `fallbackC` when nothing in [fallbackC, startC] intrudes.
// Tangent contact (d == target within 0.001) is not an intrusion.
export function firstIntrusion(segs, target, startC, fallbackC) {
  const dEps = 0.001, cTol = 0.001;
  let best = -Infinity;
  for (const s of segs) {
    let hiC, hiD, loC, loD;
    if (s.c1 >= s.c2) { hiC = s.c1; hiD = s.d1; loC = s.c2; loD = s.d2; }
    else { hiC = s.c2; hiD = s.d2; loC = s.c1; loD = s.d1; }
    const hiIn = hiD > target + dEps, loIn = loD > target + dEps;
    if (!hiIn && !loIn) continue;
    const cross = (hiIn || hiC - loC <= cTol) ? hiC : hiC + (target - hiD) / (loD - hiD) * (loC - hiC);
    if (cross > startC + cTol) continue;
    if (cross > best) best = cross;
  }
  return best > fallbackC ? best : fallbackC;
}

export function pointSegmentDistance(p, a, b) {
  const vz = b.z - a.z, vx = b.x - a.x;
  const len2 = vz * vz + vx * vx;
  let t = len2 > 0 ? ((p.z - a.z) * vz + (p.x - a.x) * vx) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.z - (a.z + t * vz), p.x - (a.x + t * vx));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test _tests/gcode/geom.test.js`
Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add js/gcode/geom.js _tests/gcode/geom.test.js
git commit -m "G-code viewer: arc and intrusion geometry (desktop-CAM intrusion search ported)"
```

---

## Task 4: Single cycles G90/G92/G94 (research note + pure moves)

**Files:**
- Create: `_docs/gcode-viewer/cycles/single.md`, `js/gcode/cycles/single.js`
- Test: `_tests/gcode/single.test.js`

**Interfaces:**
- Produces: `boxMoves(code: 90|92|94, A: Point, target: Point, taper: number) → { kind: 'rapid'|'feed'|'thread', to: Point }[]`.
  It always ends back at A.

- [ ] **Step 1: Write the research note and verify it against the references**

Create `_docs/gcode-viewer/cycles/single.md`. Check every statement against the FANUC lathe operator's
manual ("Single canned cycle", G90/G92/G94) and the Haas lathe G-code pages for G90/G92/G94.
**The manual wins**: correct the note, `single.js` and the tests if they differ.

```markdown
# Single canned cycles G90 / G92 / G94 (+ G32)

Status: DRAFT until verified. Record sources (manual title/edition/page, Haas URLs) here.

Start point A = tool position when the cycle block is read. All cycles end back at A.

| Cycle | Words | Moves from A |
|---|---|---|
| G90 turning | X/U Z/W R F | 1 rapid X to (X+R) · 2 feed to (X, Z) · 3 feed X back to A.x · 4 rapid Z back to A.z |
| G92 threading | X/U Z/W R F(lead) | 1 rapid X to (X+R) · 2 thread to (X, Z) · 3 rapid X back to A.x · 4 rapid Z back to A.z |
| G94 facing | X/U Z/W R F | 1 rapid Z to (Z+R) · 2 feed to (X, Z) · 3 feed Z back to A.z · 4 rapid X back to A.x |
| G32 | X/U Z/W F(lead) | one thread move |

- R (G90/G92) = radius at cut start minus radius at cut end (taper). R (G94) = Z at start minus Z at end.
- Modal: G90/G92/G94 stay active; a following block with only X (or only Z) repeats the cycle with the
  other coordinate from the previous cycle block.
- To verify: G92 chamfer pull-out (parameter-driven) is not drawn in v1.
```

- [ ] **Step 2: Write the failing tests**

`_tests/gcode/single.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boxMoves } from '../../js/gcode/cycles/single.js';

const A = { x: 26, z: 2 };

test('G90 turning box: rapid in, cut, cut out, rapid back', () => {
  const m = boxMoves(90, A, { x: 23, z: -30 }, 0);
  assert.deepEqual(m.map(s => s.kind), ['rapid', 'feed', 'feed', 'rapid']);
  assert.deepEqual(m.map(s => s.to), [{ x: 23, z: 2 }, { x: 23, z: -30 }, { x: 26, z: -30 }, { x: 26, z: 2 }]);
});

test('G90 taper: R shifts the X at the start of the cut', () => {
  const m = boxMoves(90, A, { x: 23, z: -30 }, -1);
  assert.deepEqual(m[0].to, { x: 22, z: 2 });
  assert.deepEqual(m[1].to, { x: 23, z: -30 });
});

test('G92 threading box: the Z move is a thread, the X-out move is a rapid', () => {
  const m = boxMoves(92, { x: 12.5, z: 5 }, { x: 9.6, z: -20 }, 0);
  assert.deepEqual(m.map(s => s.kind), ['rapid', 'thread', 'rapid', 'rapid']);
});

test('G94 facing box: rapid Z in, cut X, cut Z out, rapid X back', () => {
  const m = boxMoves(94, A, { x: 10, z: -1 }, 0);
  assert.deepEqual(m.map(s => s.kind), ['rapid', 'feed', 'feed', 'rapid']);
  assert.deepEqual(m.map(s => s.to), [{ x: 26, z: -1 }, { x: 10, z: -1 }, { x: 10, z: 2 }, { x: 26, z: 2 }]);
});

test('unknown code gives no moves', () => {
  assert.deepEqual(boxMoves(91, A, { x: 1, z: 1 }, 0), []);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test _tests/gcode/single.test.js`
Expected: FAIL with `Cannot find module ... cycles/single.js`.

- [ ] **Step 4: Write the implementation**

`js/gcode/cycles/single.js`:

```js
// Fanuc single canned cycles (system A). Pure. See _docs/gcode-viewer/cycles/single.md.
// G90 turning: rapid X in → cut Z → cut X out → rapid Z back.
// G92 threading: as G90, but the Z move is a thread and the X-out move is a rapid.
// G94 facing: rapid Z in → cut X → cut Z out → rapid X back.
export function boxMoves(code, a, t, taper = 0) {
  if (code === 90 || code === 92) {
    const threading = code === 92;
    return [
      { kind: 'rapid', to: { x: t.x + taper, z: a.z } },
      { kind: threading ? 'thread' : 'feed', to: { x: t.x, z: t.z } },
      { kind: threading ? 'rapid' : 'feed', to: { x: a.x, z: t.z } },
      { kind: 'rapid', to: { x: a.x, z: a.z } },
    ];
  }
  if (code === 94) {
    return [
      { kind: 'rapid', to: { x: a.x, z: t.z + taper } },
      { kind: 'feed', to: { x: t.x, z: t.z } },
      { kind: 'feed', to: { x: t.x, z: a.z } },
      { kind: 'rapid', to: { x: a.x, z: a.z } },
    ];
  }
  return [];
}
```

- [ ] **Step 5: Run the tests to verify they pass, then commit**

Run: `node --test _tests/gcode/single.test.js` → all 5 PASS.

```bash
git add js/gcode/cycles/single.js _tests/gcode/single.test.js _docs/gcode-viewer/cycles/single.md
git commit -m "G-code viewer: G90/G92/G94 box moves with research note"
```

---

## Task 5: Machine state (one block at a time)

**Files:**
- Create: `js/gcode/machine.js`
- Test: `_tests/gcode/machine.test.js`

**Interfaces:**
- Consumes: `parseProgram` (Task 1), `withDefaults`, `mapGCode` (Task 2), `arcFromR`, `arcFromIK` (Task 3),
  `boxMoves` (Task 4).
- Produces:
  - `newContext(blocks, settings) → Ctx`
    - `Ctx = { blocks, settings, state, segments, events, cycles, toolChanges, pending, index, block, profileMode }`
  - `createState()`, `cloneState(state)`
  - `executeBlock(ctx, block) → { cycle: 70..76 | null }`
  - `word(block, letter)`, `hasAny(block, letters)`, `lengthOf(word, ctx)`, `microOf(word, ctx)`,
    `feedOf(word, ctx)`, `targetOf(block, ctx)`
  - `pushSegment(ctx, kind, to, extra)`, `feedMove(ctx, kind, to, extra)`, `pushEvent(ctx, type, extra)`
  - `Segment = { kind: 'rapid'|'feed'|'arc'|'pass'|'retract'|'thread'|'dwell', from, to, arc, line, tool, cycle: { code, line, passIndex }|null, feed: { mode: 'rev'|'min', f }, spindle: { mode: 'css'|'rpm', s, max }, seconds: null, dwell? }`
  - Event types: `no-feed`, `no-speed`, `css-no-limit`, `css-thread`, `tool-zero` (with `tool`),
    `m98`, `milling`.

- [ ] **Step 1: Write the failing tests**

`_tests/gcode/machine.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProgram } from '../../js/gcode/parse.js';
import { withDefaults } from '../../js/gcode/settings.js';
import { newContext, executeBlock } from '../../js/gcode/machine.js';

function run(text, settings) {
  const ctx = newContext(parseProgram(text), withDefaults(settings));
  for (ctx.index = 0; ctx.index < ctx.blocks.length; ctx.index++) {
    const b = ctx.blocks[ctx.index];
    if (!b.skipped) executeBlock(ctx, b);
  }
  return ctx;
}
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('first move from unknown position draws nothing', () => {
  const ctx = run('G0 Z15\nG0 X100\nG1 Z-10 F0.2');
  assert.equal(ctx.segments.length, 1);
  assert.deepEqual(ctx.segments[0].from, { x: 50, z: 15 });
  assert.deepEqual(ctx.segments[0].to, { x: 50, z: -10 });
  assert.equal(ctx.segments[0].kind, 'feed');
});

test('U/W are incremental and X is a diameter', () => {
  const ctx = run('G0 X100 Z0\nG1 U-10 W-5 F0.1');
  assert.deepEqual(ctx.segments[0].to, { x: 45, z: -5 });
});

test('modal G1 carries over to a block with only Z', () => {
  const ctx = run('G0 X100 Z0\nG1 X90 F0.2\nZ-20');
  assert.equal(ctx.segments[1].kind, 'feed');
  assert.deepEqual(ctx.segments[1].to, { x: 45, z: -20 });
});

test('G3 with R makes an arc segment', () => {
  const ctx = run('G0 X243.8 Z-20\nG3 X245.8 Z-21 R1 F0.1');
  const s = ctx.segments[0];
  assert.equal(s.kind, 'arc');
  near(s.arc.cx, 121.9); near(s.arc.cz, -21);
});

test('G28 makes the axis unknown, so the next move draws nothing', () => {
  const ctx = run('G0 X100 Z0\nG28 U0\nG0 Z10');
  assert.equal(ctx.segments.length, 0);
  assert.equal(ctx.state.pos.x, null);
  assert.equal(ctx.state.pos.z, 10);
});

test('G50 S is the spindle limit; G50 X Z sets coordinates without moving', () => {
  const ctx = run('G50 S2500\nG50 X100 Z50');
  assert.equal(ctx.state.sMax, 2500);
  assert.deepEqual(ctx.state.pos, { x: 50, z: 50 });
  assert.equal(ctx.segments.length, 0);
});

test('G96 S is the surface speed; G97 S is rpm', () => {
  assert.equal(run('G96 S200').state.s, 200);
  assert.equal(run('G96 S200').state.spindleMode, 'css');
  assert.equal(run('G97 S1200').state.spindleMode, 'rpm');
});

test('inch program: lengths and feeds converted to mm', () => {
  const ctx = run('G20\nG0 X2 Z1\nG1 Z0 F0.01');
  near(ctx.segments[0].from.x, 25.4); near(ctx.segments[0].from.z, 25.4);
  near(ctx.segments[0].feed.f, 0.254);
});

test('numbers without a decimal point can mean microns', () => {
  const ctx = run('G0 X100000 Z0\nG1 Z-5000 F0.2', { integerUnit: 'um' });
  assert.deepEqual(ctx.segments[0].to, { x: 50, z: -5 });
});

test('tool changes and the tool-zero event (glued T0W000 form)', () => {
  const ctx = run('T0101\nT3W303\nT0W000');
  assert.deepEqual(ctx.toolChanges.map(t => t.tool), ['T0101', 'T3W303', 'T0W000']);
  assert.deepEqual(ctx.events.filter(e => e.type === 'tool-zero').map(e => e.tool), ['T0W000']);
});

test('dwell: P in milliseconds, X in seconds', () => {
  const ctx = run('G0 X10 Z0\nG4 P500\nG4 X1.5');
  assert.deepEqual(ctx.segments.filter(s => s.kind === 'dwell').map(s => s.dwell), [0.5, 1.5]);
});

test('facts for checks: missing feed, G96 without G50, Y word', () => {
  const ctx = run('G96 S200\nG0 X100 Z0\nG1 X50\nG0 Y5');
  const types = ctx.events.map(e => e.type);
  assert.ok(types.includes('no-feed'));
  assert.ok(types.includes('css-no-limit'));
  assert.ok(types.includes('milling'));
});

test('G90 modal repeats keep the previous Z', () => {
  const ctx = run('G0 X52 Z2\nG90 X46 Z-30 F0.2\nX42\nX38\nG0 X100');
  assert.equal(ctx.segments.length, 13);
  assert.deepEqual(ctx.segments[8].to, { x: 19, z: 2 });       // third box: rapid in to X38
  assert.deepEqual(ctx.segments[9].to, { x: 19, z: -30 });
  assert.deepEqual(ctx.segments[12].to, { x: 50, z: 2 });      // G0 X100 after the boxes
});

test('system B: G77 is the turning box', () => {
  const ctx = run('G0 X52 Z2\nG77 X46 Z-30 F0.2', { system: 'B' });
  assert.equal(ctx.segments.length, 4);
});

test('G32 is a thread move with the lead as feed', () => {
  const ctx = run('G97 S800\nG0 X19 Z5\nG32 Z-20 F1.5');
  assert.equal(ctx.segments[0].kind, 'thread');
  assert.equal(ctx.segments[0].feed.f, 1.5);
});

test('cycle blocks are handed back to the caller, not executed', () => {
  const ctx = newContext(parseProgram('G71 U1.5 R0.5'), withDefaults());
  assert.deepEqual(executeBlock(ctx, ctx.blocks[0]), { cycle: 71 });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test _tests/gcode/machine.test.js`
Expected: FAIL with `Cannot find module ... js/gcode/machine.js`.

- [ ] **Step 3: Write the implementation**

`js/gcode/machine.js`:

```js
// Modal state machine for one block of lathe G-code (system A after dialect mapping). Pure: no DOM.
// Spec §4. Positions are radius/mm; null = unknown (e.g. after a G28 reference return).
import { mapGCode } from './dialects.js';
import { arcFromR, arcFromIK } from './geom.js';
import { boxMoves } from './cycles/single.js';

export const CYCLE_CODES = new Set([70, 71, 72, 73, 74, 75, 76]);
const INCH = 25.4;
const BOX = new Set([90, 92, 94]);

export function createState() {
  return {
    pos: { x: null, z: null }, motion: 0, incremental: false,
    feedMode: 'rev', f: null, spindleMode: 'rpm', s: null, sMax: null,
    tool: null, tnrc: 40, units: 'mm', ended: false, box: null,
  };
}

export function cloneState(st) {
  return { ...st, pos: { ...st.pos }, box: st.box ? { ...st.box } : null };
}

export function newContext(blocks, settings) {
  return { blocks, settings, state: createState(), segments: [], events: [], cycles: [],
    toolChanges: [], pending: {}, index: 0, block: null, profileMode: false };
}

export const word = (block, letter) => block.words.find(w => w.letter === letter) || null;
export const hasAny = (block, letters) => block.words.some(w => letters.includes(w.letter));

// A length word in mm: honours "no decimal point = µm" and inch mode. Never halved for diameter.
export function lengthOf(w, ctx) {
  if (!w) return null;
  let v = w.value;
  if (!w.hasDecimal && ctx.settings.integerUnit === 'um') v /= 1000;
  if (ctx.state.units === 'inch') v *= INCH;
  return v;
}

// G74/G75/G76 P and Q: integers in µm (0.0001 in when inch). A decimal point is a mistake that
// checks.js reports (pq-decimal); the value is then read as mm (or inch).
export function microOf(w, ctx) {
  if (!w) return null;
  if (w.hasDecimal) return ctx.state.units === 'inch' ? w.value * INCH : w.value;
  return ctx.state.units === 'inch' ? (w.value / 10000) * INCH : w.value / 1000;
}

export function feedOf(w, ctx) {
  return w ? w.value * (ctx.state.units === 'inch' ? INCH : 1) : null;
}

// The block's target in radius/mm. Axes missing from the block keep the base value (maybe unknown).
export function targetOf(block, ctx, base = ctx.state.pos) {
  const st = ctx.state, xf = ctx.settings.xDiameter ? 0.5 : 1;
  let x = base.x, z = base.z, has = false;
  const X = word(block, 'X'), U = word(block, 'U'), Z = word(block, 'Z'), W = word(block, 'W');
  if (X) { const v = lengthOf(X, ctx) * xf; x = st.incremental ? (x === null ? null : x + v) : v; has = true; }
  if (U) { const v = lengthOf(U, ctx) * xf; x = x === null ? null : x + v; has = true; }
  if (Z) { const v = lengthOf(Z, ctx); z = st.incremental ? (z === null ? null : z + v) : v; has = true; }
  if (W) { const v = lengthOf(W, ctx); z = z === null ? null : z + v; has = true; }
  return { x, z, has };
}

export function pushEvent(ctx, type, extra = {}) {
  ctx.events.push({ type, line: ctx.block ? ctx.block.line : null, ...extra });
}

// Appends one segment when both ends are known, then moves the tool there either way.
export function pushSegment(ctx, kind, to, extra = {}) {
  const st = ctx.state, from = st.pos;
  const known = from.x !== null && from.z !== null && to.x !== null && to.z !== null;
  const moved = known && (Math.abs(from.x - to.x) > 1e-9 || Math.abs(from.z - to.z) > 1e-9);
  if (moved || (known && extra.arc)) {
    ctx.segments.push({
      kind, from: { x: from.x, z: from.z }, to: { x: to.x, z: to.z }, arc: extra.arc || null,
      line: ctx.block ? ctx.block.line : null, tool: st.tool, cycle: extra.cycle || null,
      feed: { mode: st.feedMode, f: extra.f !== undefined ? extra.f : st.f },
      spindle: { mode: st.spindleMode, s: st.s, max: st.sMax }, seconds: null,
    });
  }
  st.pos = { x: to.x, z: to.z };
}

// A cutting move (feed, arc, pass, retract, thread). Records the facts checks.js needs.
export function feedMove(ctx, kind, to, extra = {}) {
  const st = ctx.state;
  const f = extra.f !== undefined ? extra.f : st.f;
  if (f === null || f === undefined) pushEvent(ctx, 'no-feed');
  if (st.feedMode === 'rev' && st.s === null) pushEvent(ctx, 'no-speed');
  if (st.spindleMode === 'css' && st.sMax === null) pushEvent(ctx, 'css-no-limit');
  if (kind === 'thread' && st.spindleMode === 'css') pushEvent(ctx, 'css-thread');
  pushSegment(ctx, kind, to, { ...extra, f });
}

// Executes one non-skipped block. Returns { cycle } where cycle is a G70–G76 code for the caller
// to dispatch (cycles/index.js), or null. In profileMode (replaying P…Q) tool calls, program ends
// and nested cycles are ignored.
export function executeBlock(ctx, block) {
  const st = ctx.state;
  ctx.block = block;
  let cycle = null, g50 = false, g28 = false, dwell = false, motionSet = null;

  for (const w of block.words) {
    if (w.letter !== 'G') continue;
    const g = mapGCode(Math.trunc(w.value), ctx.settings.system);
    switch (g) {
      case 0: case 1: case 2: case 3: case 32: case 90: case 92: case 94: motionSet = g; break;
      case 4: dwell = true; break;
      case 20: st.units = 'inch'; break;
      case 21: st.units = 'mm'; break;
      case 28: g28 = true; break;
      case 40: case 41: case 42: st.tnrc = g; break;
      case 50: g50 = true; break;
      case 96: st.spindleMode = 'css'; break;
      case 97: st.spindleMode = 'rpm'; break;
      case 98: st.feedMode = 'min'; break;
      case 99: st.feedMode = 'rev'; break;
      case 17: case 19: pushEvent(ctx, 'milling', { code: g }); break;
      case 'ABS': st.incremental = false; break;
      case 'INC': st.incremental = true; break;
      default: if (CYCLE_CODES.has(g)) cycle = g;
    }
  }

  const S = word(block, 'S'), F = word(block, 'F'), T = word(block, 'T');
  if (S) {
    if (g50) st.sMax = S.value;
    else if (st.spindleMode === 'css') st.s = st.units === 'inch' ? S.value * 0.3048 : S.value; // SFM → m/min
    else st.s = S.value;
  }
  if (F && cycle === null) st.f = feedOf(F, ctx);
  if (word(block, 'Y')) pushEvent(ctx, 'milling', { word: 'Y' });

  if (!ctx.profileMode) {
    if (T) {
      const key = T.toolKey || `T${T.raw}`;
      if (key !== st.tool) { st.tool = key; ctx.toolChanges.push({ line: block.line, index: ctx.index, tool: key }); }
      if (T.value === 0 || /^0+$/.test(T.raw.slice(-2))) pushEvent(ctx, 'tool-zero', { tool: key });
    }
    for (const m of block.words) {
      if (m.letter !== 'M') continue;
      if (m.value === 30 || m.value === 2 || m.value === 99) st.ended = true;
      if (m.value === 98) pushEvent(ctx, 'm98');
    }
  }

  if (cycle !== null) return { cycle: ctx.profileMode ? null : cycle };

  if (g28) {
    if (word(block, 'U') || word(block, 'X')) st.pos = { ...st.pos, x: null };
    if (word(block, 'W') || word(block, 'Z')) st.pos = { ...st.pos, z: null };
    return { cycle: null };
  }
  if (g50) {
    const t = targetOf(block, ctx);
    if (t.has) st.pos = { x: t.x, z: t.z };            // coordinate setting, not a move
    return { cycle: null };
  }
  if (dwell) {
    const P = word(block, 'P'), X = word(block, 'X') || word(block, 'U');
    ctx.segments.push({
      kind: 'dwell', from: { ...st.pos }, to: { ...st.pos }, arc: null, line: block.line, tool: st.tool,
      cycle: null, feed: { mode: st.feedMode, f: st.f }, spindle: { mode: st.spindleMode, s: st.s, max: st.sMax },
      seconds: null, dwell: P ? P.value / 1000 : X ? X.value : 0,
    });
    return { cycle: null };
  }

  if (motionSet !== null) {
    if (!BOX.has(motionSet)) st.box = null;
    st.motion = motionSet;
  }
  if (BOX.has(st.motion)) { boxCycle(ctx, block); return { cycle: null }; }

  const t = targetOf(block, ctx);
  if (!t.has) return { cycle: null };
  switch (st.motion) {
    case 1: feedMove(ctx, 'feed', t); break;
    case 2: case 3: arcMove(ctx, block, t, st.motion === 3); break;
    case 32: feedMove(ctx, 'thread', t); break;
    default: pushSegment(ctx, 'rapid', t);
  }
  return { cycle: null };
}

function arcMove(ctx, block, to, ccw) {
  const st = ctx.state;
  const R = word(block, 'R'), I = word(block, 'I'), K = word(block, 'K');
  let arc = null;
  if (st.pos.x !== null && st.pos.z !== null && to.x !== null && to.z !== null) {
    if (R) arc = arcFromR(st.pos, to, lengthOf(R, ctx), ccw);
    else if (I || K) arc = arcFromIK(st.pos, I ? lengthOf(I, ctx) : 0, K ? lengthOf(K, ctx) : 0, ccw);
  }
  if (!arc) { feedMove(ctx, 'feed', to); return; }       // degenerate or unknown start: straight line
  feedMove(ctx, 'arc', to, { arc });
}

// G90 / G92 / G94 box cycles. Modal: a following block with only X (or only Z) repeats the cycle
// and keeps the other end coordinate of the previous box. Always ends back at the start point A.
function boxCycle(ctx, block) {
  const st = ctx.state;
  const t = targetOf(block, ctx);
  if (!t.has) return;
  const hasX = hasAny(block, ['X', 'U']), hasZ = hasAny(block, ['Z', 'W']);
  const prev = st.box;
  const target = { x: hasX || !prev ? t.x : prev.x, z: hasZ || !prev ? t.z : prev.z };
  const A = { ...st.pos };
  if (A.x === null || A.z === null) { st.pos = { ...target }; return; }
  const R = word(block, 'R');
  const taper = R ? lengthOf(R, ctx) : 0;
  const cycle = { code: st.motion, line: block.line, passIndex: 0 };
  for (const step of boxMoves(st.motion, A, target, taper)) {
    if (step.kind === 'rapid') pushSegment(ctx, 'rapid', step.to, { cycle });
    else feedMove(ctx, step.kind, step.to, { cycle });
  }
  st.box = target;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test _tests/gcode/machine.test.js`
Expected: all 16 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add js/gcode/machine.js _tests/gcode/machine.test.js
git commit -m "G-code viewer: modal machine state, arcs, box cycles, dwell and check facts"
```

---

## Task 6: Profile reader (P…Q replay)

**Files:**
- Create: `js/gcode/profile.js`
- Test: `_tests/gcode/profile.test.js`

**Interfaces:**
- Consumes: `newContext`, `executeBlock`, `cloneState` (Task 5).
- Produces:
  - `findBlockByN(blocks, n, from) → index | -1` (searches forward from `from`, then from the start)
  - `readProfile(ctx, p, q) → Profile | null`
  - `Profile = { pIndex, qIndex, pBlock, qBlock, first: Segment[], body: Segment[], pEnd: Point, endState, events }`
  - `first` holds the P block's own move; `body` holds everything after it up to and including Q.
    Dwell segments are dropped from `body`.

- [ ] **Step 1: Write the failing tests**

`_tests/gcode/profile.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProgram } from '../../js/gcode/parse.js';
import { withDefaults } from '../../js/gcode/settings.js';
import { newContext } from '../../js/gcode/machine.js';
import { readProfile, findBlockByN } from '../../js/gcode/profile.js';

const PROGRAM = [
  'G71 P10 Q20 U0.4 W0.1 F0.25',   // index 0: the cycle line
  'N10 G0 G42 X60',                // 1: P block (Type I, X only)
  'G1 Z-20 F0.1',                  // 2
  'X80',                           // 3
  'Z-40',                          // 4
  'N20 G40 X100',                  // 5: Q block
  'T0202',                         // 6
].join('\n');

function ctxAt(text, index, pos) {
  const ctx = newContext(parseProgram(text), withDefaults());
  ctx.index = index; ctx.state.pos = pos; ctx.state.s = 200;
  return ctx;
}

test('P…Q replayed from the start point; P move kept apart from the body', () => {
  const ctx = ctxAt(PROGRAM, 0, { x: 50, z: 2 });
  const p = readProfile(ctx, 10, 20);
  assert.equal(p.pIndex, 1); assert.equal(p.qIndex, 5);
  assert.equal(p.first.length, 1);
  assert.deepEqual(p.first[0].to, { x: 30, z: 2 });
  assert.deepEqual(p.pEnd, { x: 30, z: 2 });
  assert.equal(p.body.length, 4);
  assert.deepEqual(p.body.map(s => s.to), [{ x: 30, z: -20 }, { x: 40, z: -20 }, { x: 40, z: -40 }, { x: 50, z: -40 }]);
  assert.equal(p.body[0].feed.f, 0.1);
  assert.equal(p.endState.tnrc, 40);
});

test('the sandbox leaves the main context untouched', () => {
  const ctx = ctxAt(PROGRAM, 0, { x: 50, z: 2 });
  readProfile(ctx, 10, 20);
  assert.deepEqual(ctx.state.pos, { x: 50, z: 2 });
  assert.equal(ctx.state.f, null);
  assert.equal(ctx.segments.length, 0);
  assert.equal(ctx.toolChanges.length, 0);
});

test('P/Q not found returns null', () => {
  const ctx = ctxAt(PROGRAM, 0, { x: 50, z: 2 });
  assert.equal(readProfile(ctx, 10, 99), null);
  assert.equal(readProfile(ctx, 77, 20), null);
});

test('a profile earlier in the program is found (G70 case)', () => {
  const blocks = parseProgram('N10 G0 X60\nN20 G1 Z-5 F0.1\nG70 P10 Q20');
  assert.equal(findBlockByN(blocks, 10, 3), 0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test _tests/gcode/profile.test.js`
Expected: FAIL with `Cannot find module ... js/gcode/profile.js`.

- [ ] **Step 3: Write the implementation**

`js/gcode/profile.js`:

```js
// Finds the P…Q profile blocks of a canned cycle and replays them in a sandbox from the current
// state. Nothing leaks back into the main context. Spec §5.
import { cloneState, executeBlock } from './machine.js';

export function findBlockByN(blocks, n, from) {
  for (let i = Math.max(0, from); i < blocks.length; i++) if (blocks[i].n === n) return i;
  for (let i = 0; i < Math.min(from, blocks.length); i++) if (blocks[i].n === n) return i;
  return -1;
}

export function readProfile(ctx, p, q) {
  const { blocks } = ctx;
  const pIndex = findBlockByN(blocks, p, ctx.index + 1);
  if (pIndex < 0) return null;
  let qIndex = -1;
  for (let i = pIndex; i < blocks.length; i++) if (blocks[i].n === q) { qIndex = i; break; }
  if (qIndex < 0) return null;

  const child = { ...ctx, state: cloneState(ctx.state), segments: [], events: [], cycles: [],
    toolChanges: [], pending: {}, profileMode: true };
  let pCount = 0, pEnd = { ...ctx.state.pos };
  for (let i = pIndex; i <= qIndex; i++) {
    const b = blocks[i];
    if (b.skipped) continue;
    child.index = i;
    executeBlock(child, b);
    if (i === pIndex) { pCount = child.segments.length; pEnd = { ...child.state.pos }; }
  }
  return {
    pIndex, qIndex, pBlock: blocks[pIndex], qBlock: blocks[qIndex],
    first: child.segments.slice(0, pCount),
    body: child.segments.slice(pCount).filter(s => s.kind !== 'dwell'),
    pEnd, endState: child.state, events: child.events,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test _tests/gcode/profile.test.js`
Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add js/gcode/profile.js _tests/gcode/profile.test.js
git commit -m "G-code viewer: P…Q profile reader replayed in a sandbox"
```

---

## Task 7: Interpreter loop, cycle dispatch and tool labels

**Files:**
- Create: `js/gcode/interpret.js`, `js/gcode/cycles/index.js`
- Test: `_tests/gcode/interpret.test.js`

**Interfaces:**
- Consumes: Task 5 machine API; `detectControl`, `withDefaults` (Task 2).
- Produces:
  - `interpret(blocks, settings) → Run`
    - `Run = { segments, events, cycles, toolChanges, tools: { tool, label, firstLine }[], control, units: 'mm'|'inch' }`
  - `labelTools(blocks, toolChanges) → { tool, label, firstLine }[]`
  - In `cycles/index.js`:
    - `HANDLERS` (filled by later tasks)
    - `runCycle(ctx, code, block)`
    - `emit(ctx, moves, cycleBase, f)`, where `moves = { kind, from, to, arc?, passIndex }[]`
    - A handler is `{ isFirstLine(block) → boolean, run(ctx, block, firstLineBlock|null) }`.
    - A code with no handler pushes the event `cycle-unsupported`.

- [ ] **Step 1: Write the failing tests**

`_tests/gcode/interpret.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProgram } from '../../js/gcode/parse.js';
import { withDefaults } from '../../js/gcode/settings.js';
import { newContext } from '../../js/gcode/machine.js';
import { interpret, labelTools } from '../../js/gcode/interpret.js';
import { runCycle } from '../../js/gcode/cycles/index.js';

test('tool label: the last comment before the T call, dashes trimmed', () => {
  const blocks = parseProgram('(-----OD ROUGHING-----)\nG50 S2500\nG96 S300 M4\nT3W303\n(START POSITION)');
  const run = interpret(blocks);
  assert.deepEqual(run.tools, [{ tool: 'T3W303', label: 'OD ROUGHING', firstLine: 4 }]);
});

test('tool label falls back to the first comment after the call', () => {
  const blocks = parseProgram('T0101\n(FACE ROUGH)\nG0 X10 Z2');
  assert.equal(labelTools(blocks, [{ tool: 'T0101', line: 1, index: 0 }])[0].label, 'FACE ROUGH');
});

test('M30 stops interpretation', () => {
  const run = interpret(parseProgram('G0 X10 Z0\nG1 Z-5 F0.1\nM30\nG1 Z-50'));
  assert.equal(run.segments.length, 1);
});

test('macro and expression lines become skipped events', () => {
  const run = interpret(parseProgram('#500 = 0\nG1 X[#1]'));
  assert.deepEqual(run.events.map(e => [e.type, e.reason]), [['skipped', 'macro'], ['skipped', 'expression']]);
});

test('units and control are reported', () => {
  const run = interpret(parseProgram('G20\nG0 X1 Z1'));
  assert.equal(run.units, 'inch');
  assert.equal(run.control, 'fanuc');
});

test('a cycle code without a handler is reported', () => {
  const ctx = newContext(parseProgram('G99'), withDefaults());
  ctx.block = ctx.blocks[0];
  runCycle(ctx, 99, ctx.blocks[0]);
  assert.equal(ctx.events[0].type, 'cycle-unsupported');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test _tests/gcode/interpret.test.js`
Expected: FAIL with `Cannot find module ... js/gcode/interpret.js`.

- [ ] **Step 3: Write the implementation**

`js/gcode/cycles/index.js`:

```js
// Canned-cycle dispatch. Two-line Fanuc forms: the first line is stored and read by the second.
// One-line forms (older Fanuc, Haas) arrive with no stored first line. Handlers are registered by
// the cycle tasks (rough, G70, G73, G74/G75, G76).
import { pushSegment, feedMove, pushEvent } from '../machine.js';

export const HANDLERS = {};

export function runCycle(ctx, code, block) {
  const h = HANDLERS[code];
  if (!h) { pushEvent(ctx, 'cycle-unsupported', { code }); return; }
  if (h.isFirstLine(block)) { ctx.pending[code] = block; return; }
  const first = ctx.pending[code] || null;
  delete ctx.pending[code];
  h.run(ctx, block, first);
}

// Pushes planner moves into the main context. Each move carries its own `from`, so chains stay exact.
export function emit(ctx, moves, cycleBase, f) {
  for (const m of moves) {
    ctx.state.pos = { ...m.from };
    const cycle = { ...cycleBase, passIndex: m.passIndex ?? 0 };
    if (m.kind === 'rapid') pushSegment(ctx, 'rapid', m.to, { cycle });
    else feedMove(ctx, m.kind, m.to, { f, cycle, arc: m.arc || undefined });
  }
}
```

`js/gcode/interpret.js`:

```js
// Main interpretation loop: blocks → segments, events, cycle records, tool list. Pure.
import { newContext, executeBlock, pushEvent } from './machine.js';
import { runCycle } from './cycles/index.js';
import { detectControl } from './dialects.js';
import { withDefaults } from './settings.js';

export function interpret(blocks, settingsIn) {
  const settings = withDefaults(settingsIn);
  const ctx = newContext(blocks, settings);
  ctx.control = settings.control === 'auto' ? detectControl(blocks) : settings.control;
  let units = 'mm';
  for (ctx.index = 0; ctx.index < blocks.length; ctx.index++) {
    if (ctx.state.ended) break;
    const b = blocks[ctx.index];
    if (b.skipped) {
      if (b.skipped !== 'blank') { ctx.block = b; pushEvent(ctx, 'skipped', { reason: b.skipped }); }
      continue;
    }
    const { cycle } = executeBlock(ctx, b);
    if (ctx.state.units === 'inch') units = 'inch';
    if (cycle !== null) runCycle(ctx, cycle, b);
  }
  return {
    segments: ctx.segments, events: ctx.events, cycles: ctx.cycles, toolChanges: ctx.toolChanges,
    tools: labelTools(blocks, ctx.toolChanges), control: ctx.control, units,
  };
}

const clean = c => c.replace(/^[\s\-=*_]+|[\s\-=*_]+$/g, '').trim();

// A tool's label: the last comment before its first T call (within 8 lines, e.g. a section banner);
// otherwise a comment on the T line; otherwise the first comment after it (within 4 lines).
// Tools are listed once, in order of first use.
export function labelTools(blocks, changes) {
  const seen = new Map();
  for (const c of changes) {
    if (seen.has(c.tool)) continue;
    let label = '';
    for (let i = c.index - 1; i >= Math.max(0, c.index - 8) && !label; i--) if (blocks[i].comment) label = clean(blocks[i].comment);
    if (!label && blocks[c.index] && blocks[c.index].comment) label = clean(blocks[c.index].comment);
    for (let i = c.index + 1; i <= Math.min(blocks.length - 1, c.index + 4) && !label; i++) if (blocks[i].comment) label = clean(blocks[i].comment);
    seen.set(c.tool, { tool: c.tool, label, firstLine: c.line });
  }
  return [...seen.values()];
}
```

- [ ] **Step 4: Run all tests so far**

Run: `node --test "_tests/gcode/*.test.js"`
Expected: every test in parse, dialects, geom, single, machine, profile and interpret PASSES.

- [ ] **Step 5: Commit**

```bash
git add js/gcode/interpret.js js/gcode/cycles/index.js _tests/gcode/interpret.test.js
git commit -m "G-code viewer: interpreter loop, cycle dispatch and tool labels"
```

---

## Task 8: G71 / G72 roughing (desktop-CAM planner port)

**Files:**
- Create: `js/gcode/cycles/rough.js`, `_docs/gcode-viewer/cycles/g70-g72.md`
- Create: `_tests/gcode/fixtures/g71-od.nc`, `_tests/gcode/fixtures/g71-id.nc`, `_tests/gcode/fixtures/g72-face.nc`
- Modify: `js/gcode/cycles/index.js` (add imports and the rough handlers)
- Test: `_tests/gcode/rough.test.js`

**Interfaces:**
- Consumes: `flatten`, `firstIntrusion` (Task 3); `readProfile` (Task 6); `emit`, `HANDLERS` (Task 7);
  `word`, `hasAny`, `lengthOf`, `feedOf`, `pushEvent` (Task 5).
- Produces:
  - `roughFrame(code: 71|72, start, flat) → { sx, sz, toN(p) → {d,c}, fromN(q) → {x,z} }`
  - `roughCore({ start: {d,c}, segs, depth, retract, allowD, allowC }) → { kind: 'rapid'|'pass'|'retract', from: {d,c}, to: {d,c}, passIndex }[]`
  - `roughMoves(code, { start, body, depth, retract, allowX, allowZ }, arcSegments) → { moves (real coords), frame, allowD, allowC }`
  - `profileType(code: 71|72|73, pBlock) → 'I' | 'II' | 'bad'` (exported from `cycles/index.js`)
  - Cycle record pushed to `ctx.cycles`:
    `{ code, line, start, type, pBlock, qBlock, body, depth, allowX, allowZ, tnrcAtCall, tnrcAtQ, frame, allowD, allowC }`

- [ ] **Step 1: Write the research pointer note**

`_docs/gcode-viewer/cycles/g70-g72.md`:

```markdown
# G70 / G71 / G72: sources of truth

These three cycles port the verified desktop-CAM planners. Do not re-derive them.

- Semantics: `cycle-g70-research.md` (internal research note), `cycle-g71-research.md`, `cycle-g72-research.md`
- Motion contract: `cycle-visual-gcode-fidelity.md` (internal research note)
  - G71: per pass, rapid infeed at the clearance plane → Z feed cut to the (profile + allowance)
    intrusion → 45° R retract (feed) → rapid back to the clearance plane at the retracted depth.
    Passes chain; the only full return to A is after the final pass.
  - G72: the same topology turned 90°.
  - G70: re-traces P…Q at the F/S inside the profile blocks, then rapids straight back to the start
    point saved before G70.
- Code ported: `G71PassPlanner` (internal desktop-CAM source) (`ComputePassMoves`, `AppendPass`,
  `FindFirstIntrusionZ`), `PassPlannerCommon.cs` (`Sin45`, `MaxPasses`).
- Units trap (G71 research §1.2): first-line U = depth, **radius**; second-line U = X allowance,
  **diameter**.
- Viewer generalisation: the planner runs in a normalised frame (d = depth axis, c = cut axis), so one
  core serves G71 OD/ID and G72, and cuts toward ±Z.
- After G71/G72/G73 the control skips the P…Q blocks when they follow the cycle. Verify that Fanuc
  resumes after the Q block and record the manual page here.
```

- [ ] **Step 2: Write the fixtures**

`_tests/gcode/fixtures/g71-od.nc`:

```
%
O1001
(SYNTHETIC TEST PROGRAM - G71 OD + G70)
G21 G99 G18
G50 S3000
G96 S200 M3
(OD ROUGHING)
T0101
G0 X100 Z2
G71 U2 R0.5
G71 P10 Q20 U0.4 W0.1 F0.25
N10 G0 X60
G1 Z-20 F0.1
X80
Z-40
N20 X100
G70 P10 Q20
G0 X150 Z100
M30
%
```

`_tests/gcode/fixtures/g71-id.nc`:

```
(SYNTHETIC TEST PROGRAM - G71 ID BORE)
G21 G99
G50 S2500
G96 S150 M3
T0404
G0 X20 Z2
G71 U1 R0.5
G71 P50 Q60 U-0.4 W0.1 F0.2
N50 G0 X40
G1 Z-10 F0.1
X30
Z-20
N60 X20
G0 Z50
M30
```

`_tests/gcode/fixtures/g72-face.nc`:

```
(SYNTHETIC TEST PROGRAM - G72 FACING)
G21 G99
G50 S3000
G96 S180 M3
T0303
G0 X102 Z2
G72 W2 R0.5
G72 P30 Q40 U0.4 W0.1 F0.2
N30 G0 Z-5
G1 X60 F0.1
Z0
N40 X0
G0 X150 Z50
M30
```

- [ ] **Step 3: Write the failing tests**

The expected values are worked by hand from the desktop-CAM algorithm.
- **g71-od:** A = (r50, z2), depth 2, X allowance 0.2 (radius), Z allowance 0.1. Passes at
  r 48, 46, 44, 42 stop at the Z-40 shoulder (end z -39.9). Passes at r 40, 38, 36, 34, 32 and the
  final r 30.2 stop at the Z-20 shoulder (end z -19.9). Retract offset = 0.5·sin45 = 0.353553.
- **g72-face:** passes at z 0, -2, -4 and the final -4.9, each from r 51 to r 30.2.
- **g71-id:** passes at r 11 … 19 and the final 19.8. Retract goes toward the centre.

`_tests/gcode/rough.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseProgram } from '../../js/gcode/parse.js';
import { interpret } from '../../js/gcode/interpret.js';

const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const cycleSegs = (run, code) => run.segments.filter(s => s.cycle && s.cycle.code === code);

test('G71 OD: 10 passes, ends from the desktop planner intrusion search', () => {
  const run = interpret(parseProgram(fixture('g71-od.nc')));
  const passes = cycleSegs(run, 71).filter(s => s.kind === 'pass');
  assert.deepEqual(passes.map(p => +p.from.x.toFixed(6)), [48, 46, 44, 42, 40, 38, 36, 34, 32, 30.2]);
  assert.deepEqual(passes.map(p => +p.to.z.toFixed(6)), [-39.9, -39.9, -39.9, -39.9, -19.9, -19.9, -19.9, -19.9, -19.9, -19.9]);
  assert.ok(passes.every(p => p.feed.f === 0.25));
});

test('G71 OD: chained motion, 45° retract, one return to A', () => {
  const run = interpret(parseProgram(fixture('g71-od.nc')));
  const segs = cycleSegs(run, 71);
  assert.equal(segs.length, 41);
  assert.equal(segs[0].kind, 'rapid');
  assert.deepEqual(segs[0].from, { x: 50, z: 2 });
  assert.deepEqual(segs[0].to, { x: 48, z: 2 });
  assert.equal(segs[2].kind, 'retract');
  near(segs[2].to.x, 48.353553); near(segs[2].to.z, -39.546447);
  assert.deepEqual(segs[40].to, { x: 50, z: 2 });
});

test('G71: the profile blocks are skipped, not executed as normal moves', () => {
  const run = interpret(parseProgram(fixture('g71-od.nc')));
  const profileLines = new Set([12, 13, 14, 15, 16]);
  assert.equal(run.segments.filter(s => !s.cycle && profileLines.has(s.line)).length, 0);
});

test('G71 record: Type I profile, allowances, frame', () => {
  const run = interpret(parseProgram(fixture('g71-od.nc')));
  const rec = run.cycles.find(c => c.code === 71);
  assert.equal(rec.type, 'I');
  near(rec.allowX, 0.2); near(rec.allowZ, 0.1);
  assert.equal(rec.frame.sx, 1); assert.equal(rec.frame.sz, 1);
});

test('G71 ID: mirrored frame, retract toward the centre', () => {
  const run = interpret(parseProgram(fixture('g71-id.nc')));
  const segs = cycleSegs(run, 71);
  const passes = segs.filter(s => s.kind === 'pass');
  assert.deepEqual(passes.map(p => +p.from.x.toFixed(6)), [11, 12, 13, 14, 15, 16, 17, 18, 19, 19.8]);
  near(passes[0].to.z, -19.9);
  near(passes[4].to.z, -9.9);
  near(passes[9].to.z, -9.9);
  near(segs[2].to.x, 10.646447);
});

test('G72 facing: passes step in Z and cut along X', () => {
  const run = interpret(parseProgram(fixture('g72-face.nc')));
  const passes = cycleSegs(run, 72).filter(s => s.kind === 'pass');
  assert.deepEqual(passes.map(p => +p.from.z.toFixed(6)), [0, -2, -4, -4.9]);
  assert.ok(passes.every(p => p.from.x === 51 && Math.abs(p.to.x - 30.2) < 1e-9));
  const segs = cycleSegs(run, 72);
  assert.deepEqual(segs[segs.length - 1].to, { x: 51, z: 2 });
  assert.equal(run.cycles[0].type, 'I');
});

test('one-line form: D is the depth, the retract comes from settings', () => {
  const text = 'G99 G97 S500\nT0101\nG0 X100 Z2\nG71 P10 Q20 U0.4 W0.1 D2 F0.25\nN10 G0 X60\nG1 Z-20\nX80\nZ-40\nN20 X100';
  const run = interpret(parseProgram(text));
  assert.equal(run.control, 'haas');
  assert.equal(cycleSegs(run, 71).filter(s => s.kind === 'pass').length, 10);
});

test('P/Q not found: reported, nothing drawn, no crash', () => {
  const run = interpret(parseProgram('G99 G97 S500\nG0 X100 Z2\nG71 U2 R0.5\nG71 P10 Q99 U0.4 W0.1 F0.25\nN10 G0 X60\nG1 Z-20'));
  assert.ok(run.events.some(e => e.type === 'pq-not-found'));
  assert.equal(cycleSegs(run, 71).length, 0);
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `node --test _tests/gcode/rough.test.js`
Expected: FAIL. The G71 cycles report `cycle-unsupported` and no pass segments exist.

- [ ] **Step 5: Write the planner**

`js/gcode/cycles/rough.js`:

```js
// G71 / G72 multiple-repetitive roughing. Port of our desktop G71PassPlanner (ComputePassMoves,
// AppendPass) generalised to a normalised frame: d = depth axis (passes step DOWN in d),
// c = cut axis (cuts run DOWN in c from the start). See _docs/gcode-viewer/cycles/g70-g72.md.
import { flatten, firstIntrusion } from '../geom.js';

const SIN45 = Math.SQRT1_2;
const MAX_PASSES = 500;

// Orientation from the start point: OD when A is outside the profile (sx = +1), ID when inside
// (sx = -1). Cuts toward -Z when the profile lies below A in Z (sz = +1), else toward +Z (sz = -1).
export function roughFrame(code, start, flat) {
  const xs = flat.flatMap(s => [s.x1, s.x2]), zs = flat.flatMap(s => [s.z1, s.z2]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const sx = start.x >= maxX - 1e-6 ? 1 : start.x <= minX + 1e-6 ? -1 : 1;
  const sz = start.z >= maxZ - 1e-6 ? 1 : start.z <= minZ + 1e-6 ? -1 : 1;
  if (code === 72) {
    return { sx, sz, toN: p => ({ d: p.z * sz, c: p.x * sx }), fromN: q => ({ x: q.c * sx, z: q.d * sz }) };
  }
  return { sx, sz, toN: p => ({ d: p.x * sx, c: p.z * sz }), fromN: q => ({ x: q.d * sx, z: q.c * sz }) };
}

export function roughCore({ start, segs, depth, retract, allowD, allowC }) {
  const moves = [];
  if (!(depth > 1e-4) || segs.length === 0) return moves;
  let minD = Infinity, minC = Infinity;
  for (const s of segs) { minD = Math.min(minD, s.d1, s.d2); minC = Math.min(minC, s.c1, s.c2); }
  const first = start.d - depth, last = minD + allowD;
  if (first <= last) return moves;                     // start too close to the end: no passes
  const r = retract * SIN45;
  let cur = start.d, passIndex = 0;

  const pass = pd => {
    const endC = firstIntrusion(segs, pd - allowD, start.c, minC) + allowC;
    if (!(endC < start.c)) return;
    moves.push({ kind: 'rapid', from: { d: cur, c: start.c }, to: { d: pd, c: start.c }, passIndex });
    moves.push({ kind: 'pass', from: { d: pd, c: start.c }, to: { d: pd, c: endC }, passIndex });
    moves.push({ kind: 'retract', from: { d: pd, c: endC }, to: { d: pd + r, c: endC + r }, passIndex });
    moves.push({ kind: 'rapid', from: { d: pd + r, c: endC + r }, to: { d: pd + r, c: start.c }, passIndex });
    cur = pd + r;
    passIndex++;
  };

  for (let pd = first, n = 0; pd > last + 0.001 && n < MAX_PASSES; pd -= depth, n++) pass(pd);
  pass(last);                                          // final pass leaves exactly the allowance
  if (passIndex > 0 && Math.abs(cur - start.d) > 0.001) {
    moves.push({ kind: 'rapid', from: { d: cur, c: start.c }, to: { d: start.d, c: start.c }, passIndex: passIndex - 1 });
  }
  return moves;
}

export function roughMoves(code, { start, body, depth, retract, allowX, allowZ }, arcSegments = 48) {
  const flat = flatten(body, arcSegments);
  if (!flat.length) return { moves: [], frame: null, allowD: null, allowC: null };
  const frame = roughFrame(code, start, flat);
  const segs = flat.map(s => {
    const a = frame.toN({ x: s.x1, z: s.z1 }), b = frame.toN({ x: s.x2, z: s.z2 });
    return { d1: a.d, c1: a.c, d2: b.d, c2: b.c };
  });
  const allowD = code === 72 ? allowZ * frame.sz : allowX * frame.sx;
  const allowC = code === 72 ? allowX * frame.sx : allowZ * frame.sz;
  const core = roughCore({ start: frame.toN(start), segs, depth, retract, allowD, allowC });
  return {
    frame, allowD, allowC,
    moves: core.map(m => ({ kind: m.kind, passIndex: m.passIndex, from: frame.fromN(m.from), to: frame.fromN(m.to) })),
  };
}
```

- [ ] **Step 6: Register the handlers**

In `js/gcode/cycles/index.js`, replace the import line with:

```js
import { pushSegment, feedMove, pushEvent, word, hasAny, lengthOf, feedOf } from '../machine.js';
import { readProfile } from '../profile.js';
import { roughMoves } from './rough.js';
```

Append at the end of `js/gcode/cycles/index.js`:

```js
// Profile type from the P block (Fanuc): G71/G73 with X only = Type I, X and Z = Type II,
// Z only = bad P block (alarm 065). G72 swaps the axes.
export function profileType(code, pBlock) {
  const x = hasAny(pBlock, ['X', 'U']), z = hasAny(pBlock, ['Z', 'W']);
  const [main, other] = code === 72 ? [z, x] : [x, z];
  if (main && other) return 'II';
  if (main) return 'I';
  return 'bad';
}

// When the profile directly follows the cycle, the control does not execute it as normal moves:
// it continues after the Q block.
export function skipProfile(ctx, prof) {
  if (prof.pIndex > ctx.index) ctx.index = prof.qIndex;
}

function roughHandler(code) {
  return {
    isFirstLine: b => !word(b, 'P'),
    run(ctx, block, first) {
      const A = { ...ctx.state.pos };
      const P = word(block, 'P'), Q = word(block, 'Q');
      if (!P || !Q) { pushEvent(ctx, 'cycle-form', { code }); return; }
      const depthWord = first ? word(first, code === 71 ? 'U' : 'W') : word(block, 'D');
      const retractWord = first ? word(first, 'R') : null;
      const depth = depthWord ? lengthOf(depthWord, ctx) : null;            // G71 U depth is a radius
      const retract = retractWord ? lengthOf(retractWord, ctx) : ctx.settings.oneLineRetract;
      const U = word(block, 'U'), W = word(block, 'W');
      const allowX = U ? lengthOf(U, ctx) * (ctx.settings.xDiameter ? 0.5 : 1) : 0;   // diameter → radius
      const allowZ = W ? lengthOf(W, ctx) : 0;
      const f = word(block, 'F') ? feedOf(word(block, 'F'), ctx) : ctx.state.f;
      const prof = readProfile(ctx, P.value, Q.value);
      if (!prof) { pushEvent(ctx, 'pq-not-found', { code, p: P.value, q: Q.value }); return; }
      const record = {
        code, line: block.line, start: A, type: profileType(code, prof.pBlock),
        pBlock: prof.pBlock, qBlock: prof.qBlock, body: prof.body, depth, allowX, allowZ,
        tnrcAtCall: ctx.state.tnrc, tnrcAtQ: prof.endState.tnrc, frame: null, allowD: null, allowC: null,
      };
      if (depth === null) pushEvent(ctx, 'cycle-form', { code });
      else if (A.x === null || A.z === null) pushEvent(ctx, 'cycle-no-start', { code });
      else {
        const r = roughMoves(code, { start: A, body: prof.body, depth, retract, allowX, allowZ }, ctx.settings.arcSegments);
        Object.assign(record, { frame: r.frame, allowD: r.allowD, allowC: r.allowC });
        emit(ctx, r.moves, { code, line: block.line }, f);
        ctx.state.pos = { ...A };
      }
      ctx.cycles.push(record);
      skipProfile(ctx, prof);
    },
  };
}

HANDLERS[71] = roughHandler(71);
HANDLERS[72] = roughHandler(72);
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `node --test "_tests/gcode/*.test.js"`
Expected: all rough tests PASS, and all earlier suites still PASS.

- [ ] **Step 8: Commit**

```bash
git add js/gcode/cycles/rough.js js/gcode/cycles/index.js _tests/gcode/rough.test.js _tests/gcode/fixtures/g71-od.nc _tests/gcode/fixtures/g71-id.nc _tests/gcode/fixtures/g72-face.nc _docs/gcode-viewer/cycles/g70-g72.md
git commit -m "G-code viewer: G71/G72 roughing ported from the desktop-CAM planner (OD, ID, facing, one-line)"
```

---

## Task 9: G70 finishing

**Files:**
- Modify: `js/gcode/cycles/index.js` (append the G70 handler)
- Test: `_tests/gcode/g70.test.js`

**Interfaces:**
- Consumes: `readProfile` (Task 6), `pushSegment` (Task 5), `skipProfile` (Task 8).
- Produces: G70 segments tagged `cycle: { code: 70, line, passIndex: 0 }`. They keep the profile
  blocks' `line` numbers, so hovering a G70 move highlights its profile line. Also pushes the cycle
  record `{ code: 70, line, start, pBlock, qBlock, body }`.

- [ ] **Step 1: Write the failing test**

`_tests/gcode/g70.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseProgram } from '../../js/gcode/parse.js';
import { interpret } from '../../js/gcode/interpret.js';

const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('G70 re-traces P…Q from A with the profile feed, then rapids back to A', () => {
  const run = interpret(parseProgram(fixture('g71-od.nc')));
  const g70 = run.segments.filter(s => s.cycle && s.cycle.code === 70);
  assert.equal(g70.length, 6);
  assert.equal(g70[0].kind, 'rapid');
  assert.deepEqual(g70[0].to, { x: 30, z: 2 });
  assert.equal(g70[1].kind, 'feed');
  assert.equal(g70[1].feed.f, 0.1);
  assert.equal(g70[1].line, 13);                       // the profile line, for hover linking
  assert.deepEqual(g70[5].from, { x: 50, z: -40 });
  assert.deepEqual(g70[5].to, { x: 50, z: 2 });
});

test('whole fixture: G71 (41) + G70 (6) + final G0 (1) = 48 segments', () => {
  const run = interpret(parseProgram(fixture('g71-od.nc')));
  assert.equal(run.segments.length, 48);
  assert.deepEqual(run.segments[47].to, { x: 75, z: 100 });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test _tests/gcode/g70.test.js`
Expected: FAIL (G70 reports `cycle-unsupported`; `g70.length` is 0).

- [ ] **Step 3: Append the handler to `js/gcode/cycles/index.js`**

```js
// G70 finishing: the control re-executes P…Q at the feed/speed inside the profile blocks, then
// rapids straight back to the start point saved before G70 (our internal cycle-visual-gcode-fidelity.md).
HANDLERS[70] = {
  isFirstLine: () => false,
  run(ctx, block) {
    const A = { ...ctx.state.pos };
    const P = word(block, 'P'), Q = word(block, 'Q');
    if (!P || !Q) { pushEvent(ctx, 'cycle-form', { code: 70 }); return; }
    const prof = readProfile(ctx, P.value, Q.value);
    if (!prof) { pushEvent(ctx, 'pq-not-found', { code: 70, p: P.value, q: Q.value }); return; }
    if (A.x === null || A.z === null) { pushEvent(ctx, 'cycle-no-start', { code: 70 }); return; }
    const cycle = { code: 70, line: block.line, passIndex: 0 };
    for (const s of [...prof.first, ...prof.body]) ctx.segments.push({ ...s, cycle });
    for (const e of prof.events) ctx.events.push(e);
    const last = prof.body.length ? prof.body[prof.body.length - 1].to : prof.pEnd;
    ctx.state.pos = { ...last };
    pushSegment(ctx, 'rapid', A, { cycle });
    ctx.cycles.push({ code: 70, line: block.line, start: A, pBlock: prof.pBlock, qBlock: prof.qBlock, body: prof.body });
    skipProfile(ctx, prof);
  },
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test "_tests/gcode/*.test.js"`
Expected: g70 tests PASS; all earlier suites still PASS.

- [ ] **Step 5: Commit**

```bash
git add js/gcode/cycles/index.js _tests/gcode/g70.test.js
git commit -m "G-code viewer: G70 finishing re-traces the profile and returns to the start point"
```

---

## Task 10: G73 pattern repeat (research note first)

**Files:**
- Create: `_docs/gcode-viewer/cycles/g73.md`, `js/gcode/cycles/g73.js`, `_tests/gcode/fixtures/g73.nc`
- Modify: `js/gcode/cycles/index.js`
- Test: `_tests/gcode/g73.test.js`

**Interfaces:**
- Produces: `g73Moves({ start, pEnd, body, reliefX, reliefZ, divisions, allowX, allowZ }) → { kind: 'rapid'|'pass', from, to, arc|null, passIndex }[]`

- [ ] **Step 1: Write the research note and verify it against the references**

Create `_docs/gcode-viewer/cycles/g73.md`. Verify against the FANUC lathe manual ("Pattern repeating
cycle G73") and the Haas G73 page. **The manual wins**: fix the note, `g73.js` and the test if they
differ. Record the sources in the note.

```markdown
# G73 pattern repeating cycle

Status: DRAFT until verified.

Fanuc two-line form:
    G73 U(Δi) W(Δk) R(d)
    G73 P(ns) Q(nf) U(Δu) W(Δw) F

- Δi: total relief in X (radius value, signed); Δk: total relief in Z (signed).
- d: number of divisions (passes), a count.
- Δu: X finishing allowance (diameter); Δw: Z finishing allowance.
- One-line form (older Fanuc / Haas): G73 P Q I(Δi) K(Δk) U W D(d) F.

Motion: pass k = 1..d follows the P…Q profile shifted by
    x: Δu/2 + Δi·(d−k)/(d−1)      z: Δw + Δk·(d−k)/(d−1)    (d = 1: allowance only)
Each pass: rapid from A to the shifted profile start → cut along the shifted profile → rapid back to A.

To verify: does the tool return to A between passes (assumed), or step directly to the next pass start?

Hand-worked example (becomes the test): the profile of g71-od.nc with G73 U10 W0 R3, U0.4 W0.1:
- pass 1 starts at (r 40.2, z 2.1), offset (10.2, 0.1);
- pass 2 at offset (5.2, 0.1);
- pass 3 at offset (0.2, 0.1) and ends at (r 50.2, z -39.9).
Total: 3 passes × (1 rapid + 4 cuts + 1 rapid) = 18 segments.
```

- [ ] **Step 2: Write the fixture and the failing test**

`_tests/gcode/fixtures/g73.nc`:

```
(SYNTHETIC TEST PROGRAM - G73 PATTERN REPEAT)
G21 G99
G50 S3000
G96 S200 M3
T0101
G0 X100 Z2
G73 U10 W0 R3
G73 P10 Q20 U0.4 W0.1 F0.25
N10 G0 X60
G1 Z-20 F0.1
X80
Z-40
N20 X100
M30
```

`_tests/gcode/g73.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseProgram } from '../../js/gcode/parse.js';
import { interpret } from '../../js/gcode/interpret.js';

const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('G73: three shifted copies of the profile, returning to A between passes', () => {
  const run = interpret(parseProgram(fixture('g73.nc')));
  const segs = run.segments.filter(s => s.cycle && s.cycle.code === 73);
  assert.equal(segs.length, 18);
  assert.equal(segs.filter(s => s.kind === 'pass').length, 12);
  near(segs[0].to.x, 40.2); near(segs[0].to.z, 2.1);
  near(segs[6].to.x, 35.2);
  near(segs[16].to.x, 50.2); near(segs[16].to.z, -39.9);
  assert.deepEqual(segs[17].to, { x: 50, z: 2 });
  assert.equal(run.cycles[0].type, 'I');
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test _tests/gcode/g73.test.js`
Expected: FAIL (G73 reports `cycle-unsupported`).

- [ ] **Step 4: Write the planner and register the handler**

`js/gcode/cycles/g73.js`:

```js
// G73 pattern repeat. See _docs/gcode-viewer/cycles/g73.md. Pure.
export function g73Moves({ start, pEnd, body, reliefX, reliefZ, divisions, allowX, allowZ }) {
  const n = Math.max(1, Math.round(divisions || 1));
  const moves = [];
  for (let k = 1; k <= n; k++) {
    const t = n > 1 ? (n - k) / (n - 1) : 0;
    const ox = allowX + reliefX * t, oz = allowZ + reliefZ * t;
    const sh = p => ({ x: p.x + ox, z: p.z + oz });
    const passIndex = k - 1;
    moves.push({ kind: 'rapid', from: { ...start }, to: sh(pEnd), arc: null, passIndex });
    for (const s of body) {
      const arc = s.arc ? { ...s.arc, cx: s.arc.cx + ox, cz: s.arc.cz + oz } : null;
      moves.push({ kind: 'pass', from: sh(s.from), to: sh(s.to), arc, passIndex });
    }
    const end = body.length ? sh(body[body.length - 1].to) : sh(pEnd);
    moves.push({ kind: 'rapid', from: end, to: { ...start }, arc: null, passIndex });
  }
  return moves;
}
```

In `js/gcode/cycles/index.js` add `import { g73Moves } from './g73.js';` next to the other imports.
Then append:

```js
// G73 pattern repeat. Two-line: G73 U(Δi) W(Δk) R(d) / G73 P Q U W F.
// One-line: G73 P Q I K U W D F.
HANDLERS[73] = {
  isFirstLine: b => !word(b, 'P'),
  run(ctx, block, first) {
    const A = { ...ctx.state.pos };
    const P = word(block, 'P'), Q = word(block, 'Q');
    if (!P || !Q) { pushEvent(ctx, 'cycle-form', { code: 73 }); return; }
    const reliefX = first ? lengthOf(word(first, 'U'), ctx) ?? 0 : lengthOf(word(block, 'I'), ctx) ?? 0;
    const reliefZ = first ? lengthOf(word(first, 'W'), ctx) ?? 0 : lengthOf(word(block, 'K'), ctx) ?? 0;
    const divWord = first ? word(first, 'R') : word(block, 'D');
    const divisions = divWord ? divWord.value : 1;                        // a count: never unit-scaled
    const U = word(block, 'U'), W = word(block, 'W');
    const allowX = U ? lengthOf(U, ctx) * (ctx.settings.xDiameter ? 0.5 : 1) : 0;
    const allowZ = W ? lengthOf(W, ctx) : 0;
    const f = word(block, 'F') ? feedOf(word(block, 'F'), ctx) : ctx.state.f;
    const prof = readProfile(ctx, P.value, Q.value);
    if (!prof) { pushEvent(ctx, 'pq-not-found', { code: 73, p: P.value, q: Q.value }); return; }
    if (A.x === null || A.z === null) pushEvent(ctx, 'cycle-no-start', { code: 73 });
    else {
      const moves = g73Moves({ start: A, pEnd: prof.pEnd, body: prof.body, reliefX, reliefZ, divisions, allowX, allowZ });
      emit(ctx, moves, { code: 73, line: block.line }, f);
      ctx.state.pos = { ...A };
    }
    ctx.cycles.push({ code: 73, line: block.line, start: A, type: profileType(73, prof.pBlock),
      pBlock: prof.pBlock, qBlock: prof.qBlock, body: prof.body, allowX, allowZ,
      tnrcAtCall: ctx.state.tnrc, tnrcAtQ: prof.endState.tnrc });
    skipProfile(ctx, prof);
  },
};
```

- [ ] **Step 5: Run the tests, then commit**

Run: `node --test "_tests/gcode/*.test.js"` → all PASS.

```bash
git add js/gcode/cycles/g73.js js/gcode/cycles/index.js _tests/gcode/g73.test.js _tests/gcode/fixtures/g73.nc _docs/gcode-viewer/cycles/g73.md
git commit -m "G-code viewer: G73 pattern repeat with research note"
```

---

## Task 11: G74 / G75 peck cycles (research note first)

**Files:**
- Create: `_docs/gcode-viewer/cycles/g74-g75.md`, `js/gcode/cycles/peck.js`
- Modify: `js/gcode/cycles/index.js`
- Test: `_tests/gcode/peck.test.js`

**Interfaces:**
- Produces: `peckMoves(axis: 'z'|'x', { start, end, peck, step, retract }) → { kind: 'rapid'|'feed', from, to }[]`
  - G74 = axis `'z'`: pecks along Z, columns stepped in X.
  - G75 = axis `'x'`: pecks along X, columns stepped in Z.

- [ ] **Step 1: Write the research note and verify it against the references**

Create `_docs/gcode-viewer/cycles/g74-g75.md`. Verify against the FANUC lathe manual ("End face peck
drilling cycle G74", "Outer/inner diameter drilling cycle G75") and the Haas G74/G75 pages. **The
manual wins.** Record the sources.

```markdown
# G74 / G75 peck cycles

Status: DRAFT until verified.

Fanuc two-line forms:
    G74 R(e)
    G74 X(U) Z(W) P(Δi) Q(Δk) R(Δd) F      Δi = X shift between grooves (µm, radius), Δk = Z peck (µm)
    G75 R(e)
    G75 X(U) Z(W) P(Δi) Q(Δk) R(Δd) F      Δi = X peck (µm, radius), Δk = Z shift between grooves (µm)

- e = retract after each peck (chip break); Δd = relief at the bottom (not drawn in v1).
- P/Q are integers in µm; a decimal point there is a programming error (check pq-decimal).

Motion per column: feed one peck, rapid back by e, feed the next peck … the last feed reaches the end
exactly, then rapid back to the start of the peck axis. Next column: rapid shift. After the last
column: rapid back to A.

To verify: the return after each peck (retract e vs full return); the relief move Δd; the Haas one-line
forms (I/K/D).

Hand-worked examples (become the tests):
- G74 drilling from (r0, z2): R1 / Z-20 Q5000 → Z targets -3, -2, -8, -7, -13, -12, -18, -17, -20, 2 (10 moves).
- G75 grooving from (r26, z-10): R0.5 / X40 Z-14 P2000 Q3000 → columns z -10, -13, -14; column 1 X
  targets 24, 24.5, 22, 22.5, 20, 26; 21 moves in total, ending at A.
```

- [ ] **Step 2: Write the failing tests**

`_tests/gcode/peck.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProgram } from '../../js/gcode/parse.js';
import { interpret } from '../../js/gcode/interpret.js';

const cyc = (run, code) => run.segments.filter(s => s.cycle && s.cycle.code === code);

test('G74 peck drilling along Z with chip-break retracts', () => {
  const run = interpret(parseProgram('G97 S800 G99\nT0505\nG0 X0 Z2\nG74 R1\nG74 Z-20 Q5000 F0.1'));
  const segs = cyc(run, 74);
  assert.deepEqual(segs.map(s => s.to.z), [-3, -2, -8, -7, -13, -12, -18, -17, -20, 2]);
  assert.deepEqual(segs.map(s => s.kind), ['feed', 'rapid', 'feed', 'rapid', 'feed', 'rapid', 'feed', 'rapid', 'feed', 'rapid']);
});

test('G75 grooving: pecks along X, columns stepped in Z, back to A', () => {
  const run = interpret(parseProgram('G97 S600 G99\nT0606\nG0 X52 Z-10\nG75 R0.5\nG75 X40 Z-14 P2000 Q3000 F0.05'));
  const segs = cyc(run, 75);
  assert.equal(segs.length, 21);
  assert.deepEqual(segs.slice(0, 6).map(s => s.to.x), [24, 24.5, 22, 22.5, 20, 26]);
  assert.deepEqual(segs[6].to, { x: 26, z: -13 });
  assert.deepEqual(segs[20].to, { x: 26, z: -10 });
});

test('a decimal point in P/Q is reported', () => {
  const run = interpret(parseProgram('G97 S600 G99\nG0 X52 Z-10\nG75 R0.5\nG75 X40 Z-14 P2. Q3. F0.05'));
  assert.ok(run.events.some(e => e.type === 'pq-decimal'));
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test _tests/gcode/peck.test.js`
Expected: FAIL (`cycle-unsupported`).

- [ ] **Step 4: Write the planner and register the handlers**

`js/gcode/cycles/peck.js`:

```js
// G74 (axis 'z') and G75 (axis 'x') peck cycles. See _docs/gcode-viewer/cycles/g74-g75.md. Pure.
export function peckMoves(axis, { start, end, peck, step, retract }) {
  const other = axis === 'z' ? 'x' : 'z';
  const P = (a, o) => (axis === 'z' ? { x: o, z: a } : { x: a, z: o });
  const a0 = start[axis], a1 = end[axis], o0 = start[other], o1 = end[other];
  const dir = a1 < a0 ? -1 : 1;
  const odir = o1 < o0 ? -1 : 1;
  const cols = [];
  if (!(step > 0) || Math.abs(o1 - o0) < 1e-9) cols.push(o1);
  else {
    for (let o = o0, n = 0; odir * (o1 - o) > 1e-9 && n < 10000; o += odir * step, n++) cols.push(o);
    cols.push(o1);
  }
  const moves = [];
  let pos = { ...start };
  const push = (kind, to) => { moves.push({ kind, from: pos, to }); pos = to; };
  cols.forEach((o, ci) => {
    if (ci > 0 || Math.abs(o - o0) > 1e-9) push('rapid', P(a0, o));
    if (!(peck > 0)) push('feed', P(a1, o));
    else {
      let reached = a0;
      for (let n = 0; n < 10000; n++) {
        const next = reached + dir * peck;
        if (dir * (a1 - next) <= 1e-9) { push('feed', P(a1, o)); break; }
        push('feed', P(next, o));
        if (retract > 0) push('rapid', P(next - dir * retract, o));
        reached = next;
      }
    }
    push('rapid', P(a0, o));
  });
  if (Math.abs(pos[other] - o0) > 1e-9) push('rapid', { ...start });
  return moves;
}
```

In `js/gcode/cycles/index.js` add `import { peckMoves } from './peck.js';` and extend the machine
import with `microOf` and `targetOf`. Then append:

```js
function peckHandler(code) {
  const axis = code === 74 ? 'z' : 'x';
  return {
    isFirstLine: b => !hasAny(b, ['X', 'Z', 'U', 'W']),
    run(ctx, block, first) {
      const A = { ...ctx.state.pos };
      if (A.x === null || A.z === null) { pushEvent(ctx, 'cycle-no-start', { code }); return; }
      const P = word(block, 'P'), Q = word(block, 'Q');
      if ((P && P.hasDecimal) || (Q && Q.hasDecimal)) pushEvent(ctx, 'pq-decimal', { code });
      const end = targetOf(block, ctx, A);
      let peck, step, retract;
      if (first) {
        retract = word(first, 'R') ? lengthOf(word(first, 'R'), ctx) : 0;
        const pv = microOf(P, ctx) ?? 0, qv = microOf(Q, ctx) ?? 0;
        [peck, step] = code === 74 ? [qv, pv] : [pv, qv];
      } else {                                   // one-line form: I and K in mm (verify in the note)
        const iv = lengthOf(word(block, 'I'), ctx) ?? 0, kv = lengthOf(word(block, 'K'), ctx) ?? 0;
        [peck, step] = code === 74 ? [kv, iv] : [iv, kv];
        retract = ctx.settings.oneLineRetract;
      }
      const f = word(block, 'F') ? feedOf(word(block, 'F'), ctx) : ctx.state.f;
      const moves = peckMoves(axis, { start: A, end: { x: end.x, z: end.z }, peck, step, retract });
      emit(ctx, moves, { code, line: block.line }, f);
      ctx.state.pos = { ...A };
      ctx.cycles.push({ code, line: block.line, start: A });
    },
  };
}

HANDLERS[74] = peckHandler(74);
HANDLERS[75] = peckHandler(75);
```

- [ ] **Step 5: Run the tests, then commit**

Run: `node --test "_tests/gcode/*.test.js"` → all PASS.

```bash
git add js/gcode/cycles/peck.js js/gcode/cycles/index.js _tests/gcode/peck.test.js _docs/gcode-viewer/cycles/g74-g75.md
git commit -m "G-code viewer: G74/G75 peck cycles with research note"
```

---

## Task 12: G76 multiple threading (research note first)

**Files:**
- Create: `_docs/gcode-viewer/cycles/g76.md`, `js/gcode/cycles/g76.js`
- Modify: `js/gcode/cycles/index.js`
- Test: `_tests/gcode/g76.test.js`

**Interfaces:**
- Produces:
  - `g76Depths({ height, firstDepth, minDepth, finishAllow, finishPasses }) → number[]` (radius depths)
  - `g76Moves({ start, end, depths, height, angle, chamferLen, taper }) → { kind: 'rapid'|'thread', from, to, passIndex }[]`

- [ ] **Step 1: Write the research note and verify it against the references**

Create `_docs/gcode-viewer/cycles/g76.md`. Verify against the FANUC lathe manual ("Multiple threading
cycle G76") and the Haas G76 page. **The manual wins.** This is the cycle most likely to need
corrections: fix the note, `g76.js` and the test together. Record the sources.

```markdown
# G76 multiple threading cycle

Status: DRAFT until verified.

Fanuc two-line form:
    G76 P(m)(r)(a) Q(Δdmin) R(d)
    G76 X(U) Z(W) R(i) P(k) Q(Δd) F(L)

- m: finishing passes (2 digits); r: chamfer amount in 0.1·L units (2 digits); a: tool angle
  (80, 60, 55, 30, 29, 0).
- Δdmin: minimum depth of cut (µm, radius); d: finishing allowance (mm).
- X: thread root diameter; Z: thread end; i: taper (radius difference); k: thread height (µm, radius);
  Δd: first-pass depth (µm, radius); L: lead.

Depth of rough pass n: max(Δd·√n, previous + Δdmin), capped at k − d; then m finishing passes at k.
Pass X (radius) = crest − depth, where crest = root + k (external thread).
Single-flank infeed: the start Z of each pass shifts by depth·tan(a/2). **Direction to verify.**
Motion per pass: rapid A → (pass X, shifted start Z) · thread to Z end (chamfer pull-out when r > 0) ·
rapid X out to A.x · rapid Z back to A.z.

Haas one-line form (verify): G76 X Z K(height) D(first depth) A(angle) F(lead) [I(taper)].
v1 reads K and D as mm, uses min depth 0, finishing allowance 0 and one finishing pass.

Hand-worked example (becomes the test): from (r12.5, z5), G76 P020060 Q100 R0.05 /
G76 X17.4 Z-20 P1300 Q400 F2.
- Depths: 0.4, 0.565685, 0.692820, 0.8, 0.9, 1.0, 1.1, 1.2, 1.25, then 1.3, 1.3 (11 passes).
- Thread X (radius, crest 10): 9.6, 9.434315, 9.307180, 9.2, 9.1, 9.0, 8.9, 8.8, 8.75, 8.7, 8.7.
- 4 moves per pass = 44 segments.
```

- [ ] **Step 2: Write the failing tests**

`_tests/gcode/g76.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProgram } from '../../js/gcode/parse.js';
import { interpret } from '../../js/gcode/interpret.js';
import { g76Depths } from '../../js/gcode/cycles/g76.js';

const round = v => +v.toFixed(6);

test('G76 depth schedule: √n law, minimum depth, allowance, finishing passes', () => {
  const d = g76Depths({ height: 1.3, firstDepth: 0.4, minDepth: 0.1, finishAllow: 0.05, finishPasses: 2 });
  assert.deepEqual(d.map(round), [0.4, 0.565685, 0.69282, 0.8, 0.9, 1, 1.1, 1.2, 1.25, 1.3, 1.3]);
});

test('G76 program: 11 thread passes at the expected radii', () => {
  const run = interpret(parseProgram('G97 S800 G99\nT0707\nG0 X25 Z5\nG76 P020060 Q100 R0.05\nG76 X17.4 Z-20 P1300 Q400 F2'));
  const segs = run.segments.filter(s => s.cycle && s.cycle.code === 76);
  assert.equal(segs.length, 44);
  const threads = segs.filter(s => s.kind === 'thread');
  assert.deepEqual(threads.map(s => round(s.to.x)), [9.6, 9.434315, 9.30718, 9.2, 9.1, 9, 8.9, 8.8, 8.75, 8.7, 8.7]);
  assert.ok(threads.every(s => s.feed.f === 2 && s.to.z === -20));
  assert.deepEqual(segs[43].to, { x: 12.5, z: 5 });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test _tests/gcode/g76.test.js`
Expected: FAIL (`Cannot find module ... cycles/g76.js`).

- [ ] **Step 4: Write the planner and register the handler**

`js/gcode/cycles/g76.js`:

```js
// G76 multiple threading. See _docs/gcode-viewer/cycles/g76.md. Pure.
export function g76Depths({ height, firstDepth, minDepth = 0, finishAllow = 0, finishPasses = 1 }) {
  const depths = [];
  const cap = height - finishAllow;
  let prev = 0;
  for (let n = 1; n <= 1000; n++) {
    const d = Math.max(firstDepth * Math.sqrt(n), prev + minDepth);
    if (d >= cap - 1e-9) { if (cap > prev + 1e-9) depths.push(cap); break; }
    depths.push(d);
    prev = d;
  }
  for (let i = 0; i < Math.max(1, finishPasses); i++) depths.push(height);
  return depths;
}

export function g76Moves({ start, end, depths, height, angle = 0, chamferLen = 0, taper = 0 }) {
  const moves = [];
  const dirZ = end.z < start.z ? -1 : 1;
  const out = start.x >= end.x ? 1 : -1;               // external thread: A outside the root
  const crest = end.x + out * height;
  const tanHalf = Math.tan(((angle || 0) / 2) * Math.PI / 180);
  depths.forEach((d, passIndex) => {
    const x = crest - out * d;
    const zs = start.z - dirZ * d * tanHalf;           // flank infeed (direction: verify in the note)
    const entry = { x: x + taper, z: zs };
    moves.push({ kind: 'rapid', from: { ...start }, to: entry, passIndex });
    if (chamferLen > 0) {
      const pull = { x, z: end.z - dirZ * chamferLen };
      const outPt = { x: x + out * chamferLen, z: end.z };
      moves.push({ kind: 'thread', from: entry, to: pull, passIndex });
      moves.push({ kind: 'thread', from: pull, to: outPt, passIndex });
      moves.push({ kind: 'rapid', from: outPt, to: { x: start.x, z: end.z }, passIndex });
    } else {
      moves.push({ kind: 'thread', from: entry, to: { x, z: end.z }, passIndex });
      moves.push({ kind: 'rapid', from: { x, z: end.z }, to: { x: start.x, z: end.z }, passIndex });
    }
    moves.push({ kind: 'rapid', from: { x: start.x, z: end.z }, to: { ...start }, passIndex });
  });
  return moves;
}
```

In `js/gcode/cycles/index.js` add `import { g76Depths, g76Moves } from './g76.js';`, then append:

```js
// G76 threading. Two-line Fanuc: G76 P(mra) Q(Δdmin) R(d) / G76 X Z R(i) P(k) Q(Δd) F(L).
// One-line Haas (verify in the note): G76 X Z K D A F [I].
HANDLERS[76] = {
  isFirstLine: b => !hasAny(b, ['X', 'Z', 'U', 'W']),
  run(ctx, block, first) {
    const A = { ...ctx.state.pos };
    if (A.x === null || A.z === null) { pushEvent(ctx, 'cycle-no-start', { code: 76 }); return; }
    const end = targetOf(block, ctx, A);
    const lead = word(block, 'F') ? feedOf(word(block, 'F'), ctx) : ctx.state.f;
    const taperWord = word(block, 'R') || word(block, 'I');
    const taper = taperWord ? lengthOf(taperWord, ctx) : 0;
    let height, firstDepth, minDepth = 0, finishAllow = 0, finishPasses = 1, angle = 0, chamferLen = 0;
    if (first) {
      const P2 = word(block, 'P'), Q2 = word(block, 'Q'), P1 = word(first, 'P'), Q1 = word(first, 'Q');
      if ((P2 && P2.hasDecimal) || (Q2 && Q2.hasDecimal) || (Q1 && Q1.hasDecimal)) pushEvent(ctx, 'pq-decimal', { code: 76 });
      height = microOf(P2, ctx); firstDepth = microOf(Q2, ctx);
      minDepth = microOf(Q1, ctx) ?? 0;
      finishAllow = lengthOf(word(first, 'R'), ctx) ?? 0;
      if (P1) {
        const v = Math.round(P1.value);
        finishPasses = Math.floor(v / 10000); chamferLen = (Math.floor(v / 100) % 100) * 0.1 * (lead || 0); angle = v % 100;
      }
    } else {
      height = lengthOf(word(block, 'K'), ctx); firstDepth = lengthOf(word(block, 'D'), ctx);
      angle = word(block, 'A') ? word(block, 'A').value : 0;
    }
    if (!(height > 0) || !(firstDepth > 0)) { pushEvent(ctx, 'cycle-form', { code: 76 }); return; }
    const depths = g76Depths({ height, firstDepth, minDepth, finishAllow, finishPasses });
    const moves = g76Moves({ start: A, end: { x: end.x, z: end.z }, depths, height, angle, chamferLen, taper });
    emit(ctx, moves, { code: 76, line: block.line }, lead);
    ctx.state.pos = { ...A };
    ctx.cycles.push({ code: 76, line: block.line, start: A });
  },
};
```

- [ ] **Step 5: Run the tests, then commit**

Run: `node --test "_tests/gcode/*.test.js"` → all PASS.

```bash
git add js/gcode/cycles/g76.js js/gcode/cycles/index.js _tests/gcode/g76.test.js _docs/gcode-viewer/cycles/g76.md
git commit -m "G-code viewer: G76 threading with depth schedule and research note"
```

---

## Task 13: Time model

**Files:**
- Create: `js/gcode/time.js`
- Test: `_tests/gcode/time.test.js`

**Interfaces:**
- Consumes: `segmentLength`, `sampleArc` (Task 3); the `Run` from `interpret` (Task 7); `Settings` (Task 2).
- Produces:
  - `rpmAt(spindle, r) → number|null`
  - `cssRadialMinutes(r1, r2, f, vc, nMax) → minutes`
  - `segmentSeconds(seg, settings) → number|null` (null = missing F or S)
  - `computeTimes(run, settings) → { rows, total, incomplete }`
    - Also writes `seg.seconds` (correction applied) on every segment.
    - `Row = { tool, label, cycles, passes, cutLength, cutSeconds, rapidSeconds, changeSeconds, dwellSeconds, totalSeconds, incomplete }`
  - `formatDuration(seconds|null) → 'm:ss' | 'h:mm:ss' | '–'`

- [ ] **Step 1: Write the failing tests**

The expected values are worked by hand (spec §7).
- **CSS radial, above the clamp:** t = π(r₁² − r₂²)/(F·Vc·1000) min.
- **Below the clamp radius** r_c = Vc·1000/(2π·n_max): t = Δr/(F·n_max) min.

`_tests/gcode/time.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseProgram } from '../../js/gcode/parse.js';
import { interpret } from '../../js/gcode/interpret.js';
import { withDefaults } from '../../js/gcode/settings.js';
import { segmentSeconds, computeTimes, formatDuration } from '../../js/gcode/time.js';

const S = withDefaults();
const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const seg = (from, to, feed, spindle, kind = 'feed') => ({ kind, from, to, arc: null, feed, spindle, cycle: null, tool: 'T1' });

test('G98 feed per minute', () => {
  near(segmentSeconds(seg({ x: 10, z: 0 }, { x: 10, z: -10 }, { mode: 'min', f: 100 }, { mode: 'rpm', s: 500 }), S), 6);
});

test('G99 feed per rev at fixed rpm', () => {
  near(segmentSeconds(seg({ x: 10, z: 0 }, { x: 10, z: -10 }, { mode: 'rev', f: 0.2 }, { mode: 'rpm', s: 1000 }), S), 3);
});

test('G96 radial move above the clamp radius (closed form)', () => {
  near(segmentSeconds(seg({ x: 50, z: 0 }, { x: 30, z: 0 }, { mode: 'rev', f: 0.2 }, { mode: 'css', s: 200, max: 3000 }), S), 7.539822);
});

test('G96 facing to the centre crosses the G50 clamp', () => {
  near(segmentSeconds(seg({ x: 20, z: 0 }, { x: 0, z: 0 }, { mode: 'rev', f: 0.2 }, { mode: 'css', s: 200, max: 3000 }), S), 2.415472);
});

test('G96 to centre without G50 stays finite', () => {
  const t = segmentSeconds(seg({ x: 20, z: 0 }, { x: 0, z: 0 }, { mode: 'rev', f: 0.2 }, { mode: 'css', s: 200, max: null }), S);
  assert.ok(Number.isFinite(t));
  near(t, 1.884956);
});

test('rapid: the slower axis decides', () => {
  near(segmentSeconds(seg({ x: 0, z: 0 }, { x: 25, z: 100 }, { mode: 'rev', f: null }, { mode: 'rpm', s: null }, 'rapid'), S), 0.3);
});

test('thread: lead per rev, even under G98', () => {
  // 25 mm at 1.5 mm lead and 800 rpm: 25 / 1200 min = 1.25 s
  near(segmentSeconds(seg({ x: 9.6, z: 5 }, { x: 9.6, z: -20 }, { mode: 'min', f: 1.5 }, { mode: 'rpm', s: 800 }, 'thread'), S), 1.25);
});

test('missing feed gives null', () => {
  assert.equal(segmentSeconds(seg({ x: 10, z: 0 }, { x: 10, z: -10 }, { mode: 'rev', f: null }, { mode: 'rpm', s: 500 }), S), null);
});

test('per-tool summary of the G71/G70 fixture, with tool change and correction', () => {
  const text = readFileSync(new URL('./fixtures/g71-od.nc', import.meta.url), 'utf8');
  const base = computeTimes(interpret(parseProgram(text)), S);
  assert.equal(base.rows.length, 1);
  const r = base.rows[0];
  assert.equal(r.tool, 'T0101');
  assert.equal(r.cycles, 2);
  assert.equal(r.passes, 10);
  assert.equal(r.changeSeconds, 3);
  assert.equal(r.incomplete, false);
  near(r.totalSeconds, r.cutSeconds + r.rapidSeconds + r.changeSeconds + r.dwellSeconds, 1e-9);
  const corrected = computeTimes(interpret(parseProgram(text)), withDefaults({ correctionPct: 10 }));
  near(corrected.total, base.total * 1.1, 1e-6);
});

test('duration format', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(75), '1:15');
  assert.equal(formatDuration(3725), '1:02:05');
  assert.equal(formatDuration(null), '–');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test _tests/gcode/time.test.js`
Expected: FAIL with `Cannot find module ... js/gcode/time.js`.

- [ ] **Step 3: Write the implementation**

`js/gcode/time.js`:

```js
// Seconds per segment and the per-tool summary. Pure. Spec §7. Starts from our desktop
// CycleTimeEstimator, adding G96 integration along the move, per-axis rapids, threads, dwell and
// tool changes. The result is a planning estimate: no acceleration, spindle ramp or M-code time.
import { segmentLength, sampleArc } from './geom.js';

const R_FLOOR = 0.05;       // mm: our desktop CycleTimeEstimator's floor on the radius
const STEPS = 32;           // sub-steps for tapers and arcs under G96

export function rpmAt(spindle, r) {
  if (spindle.mode === 'css') {
    if (!(spindle.s > 0)) return null;
    const n = (spindle.s * 1000) / (2 * Math.PI * Math.max(R_FLOOR, Math.abs(r)));
    return spindle.max ? Math.min(spindle.max, n) : n;
  }
  return spindle.s > 0 ? spindle.s : null;
}

// Minutes to feed radially from r1 to r2 (same side of the axis) at f mm/rev under G96 with Vc m/min
// and an optional rpm clamp nMax. Above r_c = C/nMax, rpm = C/r, so dt = r·dr/(f·C); below it, rpm = nMax.
export function cssRadialMinutes(r1, r2, f, vc, nMax) {
  const a = Math.min(Math.abs(r1), Math.abs(r2)), b = Math.max(Math.abs(r1), Math.abs(r2));
  const C = (vc * 1000) / (2 * Math.PI);
  const rc = nMax ? C / nMax : 0;
  let t = 0;
  const hiStart = Math.max(a, rc);
  if (b > hiStart) t += (b * b - hiStart * hiStart) / (2 * f * C);
  const loEnd = Math.min(b, rc);
  if (loEnd > a) t += (loEnd - a) / (f * nMax);
  return t;
}

function linePoints(a, b, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push({ x: a.x + (b.x - a.x) * i / n, z: a.z + (b.z - a.z) * i / n });
  return pts;
}

export function segmentSeconds(seg, s) {
  if (seg.kind === 'dwell') return seg.dwell ?? 0;
  if (seg.kind === 'rapid') {
    const dx = Math.abs(seg.to.x - seg.from.x), dz = Math.abs(seg.to.z - seg.from.z);
    return Math.max(dx / s.rapidX, dz / s.rapidZ) * 60;
  }
  const f = seg.feed.f;
  if (!(f > 0)) return null;
  const L = segmentLength(seg);
  if (seg.feed.mode === 'min' && seg.kind !== 'thread') return (L / f) * 60;
  const sp = seg.spindle;
  if (sp.mode !== 'css') return sp.s > 0 ? (L / (f * sp.s)) * 60 : null;
  if (!(sp.s > 0)) return null;
  if (!seg.arc && Math.abs(seg.to.z - seg.from.z) < 1e-9) {
    const r1 = seg.from.x, r2 = seg.to.x;
    const mins = r1 * r2 < 0
      ? cssRadialMinutes(r1, 0, f, sp.s, sp.max) + cssRadialMinutes(0, r2, f, sp.s, sp.max)
      : cssRadialMinutes(r1, r2, f, sp.s, sp.max);
    return mins * 60;
  }
  const pts = seg.arc ? sampleArc(seg.from, seg.to, seg.arc, STEPS) : linePoints(seg.from, seg.to, STEPS);
  let mins = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const n = rpmAt(sp, (a.x + b.x) / 2);
    if (!(n > 0)) return null;
    mins += Math.hypot(b.x - a.x, b.z - a.z) / (f * n);
  }
  return mins * 60;
}

export function computeTimes(run, s) {
  const k = 1 + (s.correctionPct || 0) / 100;
  const rows = new Map();
  const labels = new Map(run.tools.map(t => [t.tool, t.label]));
  const rowFor = tool => {
    const key = tool || '';
    if (!rows.has(key)) {
      rows.set(key, { tool: key, label: labels.get(key) || '', cycles: new Set(), passes: new Set(),
        cutLength: 0, cutSeconds: 0, rapidSeconds: 0, changeSeconds: 0, dwellSeconds: 0, incomplete: false });
    }
    return rows.get(key);
  };
  for (const t of run.tools) rowFor(t.tool);
  for (const seg of run.segments) {
    const sec = segmentSeconds(seg, s);
    seg.seconds = sec === null ? null : sec * k;
    const row = rowFor(seg.tool);
    if (seg.cycle) {
      row.cycles.add(seg.cycle.line);
      if (seg.kind === 'pass' || seg.kind === 'thread') row.passes.add(`${seg.cycle.line}:${seg.cycle.passIndex}`);
    }
    if (sec === null) { row.incomplete = true; continue; }
    if (seg.kind === 'rapid') row.rapidSeconds += sec;
    else if (seg.kind === 'dwell') row.dwellSeconds += sec;
    else { row.cutSeconds += sec; row.cutLength += segmentLength(seg); }
  }
  for (const c of run.toolChanges) rowFor(c.tool).changeSeconds += s.toolChangeSeconds;

  const out = [...rows.values()]
    .filter(r => r.tool !== '' || r.cutSeconds + r.rapidSeconds + r.dwellSeconds > 0)
    .map(r => {
      const cut = r.cutSeconds * k, rapid = r.rapidSeconds * k, change = r.changeSeconds * k, dwell = r.dwellSeconds * k;
      return { tool: r.tool, label: r.label, cycles: r.cycles.size, passes: r.passes.size, cutLength: r.cutLength,
        cutSeconds: cut, rapidSeconds: rapid, changeSeconds: change, dwellSeconds: dwell,
        totalSeconds: cut + rapid + change + dwell, incomplete: r.incomplete };
    });
  return { rows: out, total: out.reduce((a, r) => a + r.totalSeconds, 0), incomplete: out.some(r => r.incomplete) };
}

export function formatDuration(sec) {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return '–';
  const t = Math.round(sec);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), r = t % 60;
  const pad = n => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test _tests/gcode/time.test.js`
Expected: all 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add js/gcode/time.js _tests/gcode/time.test.js
git commit -m "G-code viewer: CSS-aware time model with per-tool summary"
```

---

## Task 14: Program checks

**Files:**
- Create: `js/gcode/checks.js`
- Test: `_tests/gcode/checks.test.js`

**Interfaces:**
- Consumes: `Run` (Task 7) with events from Tasks 5–12 and cycle records from Tasks 8–10; `flatten` (Task 3).
- Produces:
  - `runChecks(run) → Warning[]`, sorted by line
    - `Warning = { id, line, severity: 'info'|'warn'|'error', params }`
  - `SEVERITY` (id → severity)
  - Ids: `g96-no-g50`, `type1-monotonic`, `type2-pocket`, `p-block`, `q-block-corner`, `tnrc-scope`,
    `start-in-material`, `allowance-vs-depth`, `pq-decimal`, `css-threading`, `no-feed`, `no-speed`,
    `tool-zero`, `subprogram`, `skipped`, `milling`, `pq-not-found`, `cycle-no-start`, `cycle-form`,
    `cycle-unsupported`

- [ ] **Step 1: Write the failing tests**

`_tests/gcode/checks.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseProgram } from '../../js/gcode/parse.js';
import { interpret } from '../../js/gcode/interpret.js';
import { runChecks } from '../../js/gcode/checks.js';

const check = text => runChecks(interpret(parseProgram(text)));
const ids = ws => ws.map(w => w.id);
const HEAD = 'G21 G99\nG50 S3000\nG96 S200 M3\nT0101\nG0 X100 Z2\nG71 U2 R0.5\nG71 P10 Q20 U0.4 W0.1 F0.25\n';

test('a clean program has no warnings', () => {
  const text = readFileSync(new URL('./fixtures/g71-od.nc', import.meta.url), 'utf8');
  assert.deepEqual(check(text), []);
});

test('G96 without G50 is reported once', () => {
  const ws = check('G99\nG96 S200\nT0101\nG0 X100 Z0\nG1 X50 F0.2\nG1 Z-10');
  assert.deepEqual(ids(ws), ['g96-no-g50']);
  assert.equal(ws[0].severity, 'warn');
});

test('tool zero only when it cuts', () => {
  assert.deepEqual(ids(check('G99 G97 S500\nT0W000\nG0 X10 Z0\nG1 Z-5 F0.1')), ['tool-zero']);
  assert.deepEqual(ids(check('T0100\nM30')), []);
});

test('Type I profile that is not monotonic (Fanuc alarm 064)', () => {
  const ws = check(HEAD + 'N10 G0 X60\nG1 Z-10 F0.1\nX50\nZ-20\nN20 X100');
  assert.ok(ids(ws).includes('type1-monotonic'));
});

test('P block with Z only (alarm 065)', () => {
  const ws = check(HEAD + 'N10 G0 Z2\nG1 X60 F0.1\nZ-20\nN20 X100');
  assert.ok(ids(ws).includes('p-block'));
});

test('chamfer in the Q block (alarm 069)', () => {
  const ws = check(HEAD + 'N10 G0 X60\nG1 Z-20 F0.1\nN20 X100 C1');
  assert.ok(ids(ws).includes('q-block-corner'));
});

test('G42 still active at the end of the profile', () => {
  const ws = check(HEAD + 'N10 G0 G42 X60\nG1 Z-20 F0.1\nN20 X100');
  assert.ok(ids(ws).includes('tnrc-scope'));
});

test('cycle start inside the material', () => {
  const ws = check('G21 G99\nG50 S3000\nG96 S200 M3\nT0101\nG0 X70 Z2\nG71 U2 R0.5\nG71 P10 Q20 U0.4 W0.1 F0.25\nN10 G0 X60\nG1 Z-20 F0.1\nX100\nN20 Z-40');
  assert.ok(ids(ws).includes('start-in-material'));
});

test('skipped lines are summarised once with a count', () => {
  const ws = check('#1 = 5\n#2 = 6\nG0 X10 Z0');
  assert.equal(ws.length, 1);
  assert.equal(ws[0].id, 'skipped');
  assert.equal(ws[0].params.count, 2);
});

test('Type II profile with a pocket is flagged for verification', () => {
  const ws = check(HEAD + 'N10 G0 X60 Z2\nG1 Z-10 F0.1\nX50\nZ-20\nN20 X100');
  assert.ok(ids(ws).includes('type2-pocket'));
  assert.ok(!ids(ws).includes('type1-monotonic'));
});

test('P/Q with a decimal point', () => {
  const ws = check('G97 S600 G99\nT0606\nG0 X52 Z-10\nG75 R0.5\nG75 X40 Z-14 P2. Q3. F0.05');
  assert.ok(ids(ws).includes('pq-decimal'));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test _tests/gcode/checks.test.js`
Expected: FAIL with `Cannot find module ... js/gcode/checks.js`.

- [ ] **Step 3: Write the implementation**

`js/gcode/checks.js`:

```js
// Turns interpreter facts (events) and cycle records into warnings. Pure. Spec §6.
// Rules for G71/G72 profiles follow our internal cycle-g71-research.md §1.4–1.6 (alarms 064/065/069).
import { flatten } from './geom.js';

export const SEVERITY = {
  'g96-no-g50': 'warn', 'type1-monotonic': 'error', 'p-block': 'error', 'q-block-corner': 'error',
  'tnrc-scope': 'warn', 'start-in-material': 'warn', 'allowance-vs-depth': 'info', 'pq-decimal': 'warn',
  'css-threading': 'warn', 'no-feed': 'warn', 'no-speed': 'warn', 'tool-zero': 'warn', 'subprogram': 'info',
  'skipped': 'info', 'milling': 'info', 'pq-not-found': 'error', 'cycle-no-start': 'warn',
  'cycle-form': 'error', 'cycle-unsupported': 'info', 'type2-pocket': 'info',
};
const EVENT_ID = { 'css-no-limit': 'g96-no-g50', 'css-thread': 'css-threading', 'm98': 'subprogram' };
const ONCE = new Set(['g96-no-g50', 'milling']);

export function runChecks(run) {
  const out = [];
  const add = (id, line, params = {}) => out.push({ id, line, severity: SEVERITY[id], params });
  const seen = new Set();
  let skipped = null;
  const cutTools = new Set(run.segments.filter(s => s.kind !== 'rapid' && s.kind !== 'dwell').map(s => s.tool));

  for (const e of run.events) {
    const id = EVENT_ID[e.type] || e.type;
    if (id === 'skipped') { skipped = skipped || { line: e.line, count: 0 }; skipped.count++; continue; }
    if (!SEVERITY[id]) continue;
    if (id === 'tool-zero' && !cutTools.has(e.tool)) continue;
    const key = ONCE.has(id) ? id : `${id}@${e.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    add(id, e.line, { code: e.code, tool: e.tool, p: e.p, q: e.q });
  }
  if (skipped) add('skipped', skipped.line, { count: skipped.count });
  for (const c of run.cycles) checkRoughCycle(c, add);
  return out.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
}

function checkRoughCycle(c, add) {
  if (![71, 72, 73].includes(c.code) || !c.pBlock) return;
  const params = { code: c.code };
  if (c.type === 'bad') add('p-block', c.pBlock.line, params);
  const last = c.body[c.body.length - 1];
  const qIsArc = !!(last && last.arc && last.line === c.qBlock.line);
  if (hasCorner(c.qBlock, qIsArc)) add('q-block-corner', c.qBlock.line, params);
  if (c.tnrcAtCall !== 40 || c.tnrcAtQ !== 40) add('tnrc-scope', c.line, params);
  if (!c.frame || !c.body.length) return;
  const pts = bodyPoints(c.body).map(c.frame.toN);
  if (c.type === 'I' && !monotonic(pts)) add('type1-monotonic', c.pBlock.line, params);
  if (c.type === 'II' && !monotonic(pts)) add('type2-pocket', c.pBlock.line, params);   // pockets: passes stop at the first rise
  const s = c.frame.toN(c.start);
  const maxD = Math.max(...pts.map(p => p.d)), maxC = Math.max(...pts.map(p => p.c));
  if (s.d < maxD - 1e-3 || s.c < maxC - 1e-3) add('start-in-material', c.line, params);
  if (c.depth !== null && c.allowD >= c.depth) add('allowance-vs-depth', c.line, params);
}

// Fanuc chamfer/corner words in the Q block: C, or R on a straight move (R on G2/G3 is the radius).
function hasCorner(block, qIsArc) {
  return block.words.some(w => w.letter === 'C') || (!qIsArc && block.words.some(w => w.letter === 'R'));
}

function bodyPoints(body) {
  const flat = flatten(body, 16);
  const pts = flat.length ? [{ x: flat[0].x1, z: flat[0].z1 }] : [];
  for (const s of flat) pts.push({ x: s.x2, z: s.z2 });
  return pts;
}

// In the normalised frame a Type I profile never climbs back in c and never drops in d.
function monotonic(pts) {
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].c > pts[i - 1].c + 1e-6) return false;
    if (pts[i].d < pts[i - 1].d - 1e-6) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test "_tests/gcode/*.test.js"`
Expected: all checks tests PASS; all earlier suites still PASS.

- [ ] **Step 5: Commit**

```bash
git add js/gcode/checks.js _tests/gcode/checks.test.js
git commit -m "G-code viewer: program checks (alarms 064/065/069, G96 limit, TNRC, P/Q units)"
```

---

## Task 15: Pipeline entry point and the example program

**Files:**
- Create: `js/gcode/analyze.js`, `js/gcode/example.js`
- Test: `_tests/gcode/analyze.test.js`

**Interfaces:**
- Consumes: `parseProgram`, `interpret`, `computeTimes`, `runChecks`, `withDefaults`.
- Produces:
  - `MAX_LINES = 300000`
  - `analyze(text, settings) → Result`
    - `Result = { tooLarge, lines, blocks, segments, events, cycles, toolChanges, tools, control, units, timing, warnings, settings }`
  - `EXAMPLE_PROGRAM: string`: synthetic G71 + G70 + G76, with no warnings

- [ ] **Step 1: Write the failing tests**

`_tests/gcode/analyze.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, MAX_LINES } from '../../js/gcode/analyze.js';
import { EXAMPLE_PROGRAM } from '../../js/gcode/example.js';

test('the example program: three labelled tools, times, no warnings', () => {
  const r = analyze(EXAMPLE_PROGRAM);
  assert.equal(r.tooLarge, false);
  assert.deepEqual(r.tools.map(t => t.label), ['OD ROUGHING', 'OD FINISHING', 'THREAD M24X2']);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.timing.rows.length, 3);
  assert.ok(r.timing.rows.every(row => !row.incomplete && row.totalSeconds > 0));
  assert.ok(r.segments.some(s => s.cycle && s.cycle.code === 71));
  assert.ok(r.segments.some(s => s.cycle && s.cycle.code === 70));
  assert.ok(r.segments.some(s => s.cycle && s.cycle.code === 76 && s.kind === 'thread'));
});

test('too many lines: refused with a flag, not a hang', () => {
  const r = analyze('\n'.repeat(MAX_LINES + 1));
  assert.equal(r.tooLarge, true);
  assert.equal(r.segments.length, 0);
});

test('a milling program is flagged', () => {
  const r = analyze('G17 G90\nG0 X10 Y10 Z5');
  assert.ok(r.warnings.some(w => w.id === 'milling'));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test _tests/gcode/analyze.test.js`
Expected: FAIL with `Cannot find module ... js/gcode/analyze.js`.

- [ ] **Step 3: Write the implementation**

`js/gcode/analyze.js`:

```js
// The whole pipeline: text → Result. Pure; used by ui.js and by the tests.
import { parseProgram } from './parse.js';
import { interpret } from './interpret.js';
import { computeTimes } from './time.js';
import { runChecks } from './checks.js';
import { withDefaults } from './settings.js';

export const MAX_LINES = 300000;

export function analyze(text, settingsIn) {
  const settings = withDefaults(settingsIn);
  const blocks = parseProgram(text);
  if (blocks.length > MAX_LINES) {
    return { tooLarge: true, lines: blocks.length, blocks: [], segments: [], events: [], cycles: [],
      toolChanges: [], tools: [], control: settings.control, units: 'mm',
      timing: { rows: [], total: 0, incomplete: false }, warnings: [], settings };
  }
  const run = interpret(blocks, settings);
  const timing = computeTimes(run, settings);
  const warnings = runChecks(run);
  return { tooLarge: false, lines: blocks.length, blocks, ...run, timing, warnings, settings };
}
```

`js/gcode/example.js` (synthetic, and safe to publish):

```js
// Built-in example: a synthetic part (no customer data). G71 roughing, G70 finishing, G76 thread.
export const EXAMPLE_PROGRAM = `%
O2026
(AIDEDCAM EXAMPLE - SYNTHETIC PART)
G21 G99 G18 G40
G50 S3000
(OD ROUGHING)
G96 S220 M3
T0101
G0 X64 Z2
G71 U1.5 R0.5
G71 P10 Q20 U0.4 W0.1 F0.25
N10 G0 X20
G1 Z0 F0.12
X24 Z-2
Z-18
G2 X32 Z-22 R4
G1 X40
Z-40
X56 Z-48
Z-60
N20 X64
(OD FINISHING)
G96 S260
T0303
G0 X64 Z2
G70 P10 Q20
G0 X100 Z100
(THREAD M24X2)
G97 S700 M3
T0505
G0 X28 Z5
G76 P020060 Q50 R0.02
G76 X21.4 Z-16 P1300 Q350 F2
G0 X100 Z100
M30
%
`;
```

- [ ] **Step 4: Run all tests**

Run: `node --test "_tests/gcode/*.test.js"`
Expected: every suite PASSES.

- [ ] **Step 5: Commit**

```bash
git add js/gcode/analyze.js js/gcode/example.js _tests/gcode/analyze.test.js
git commit -m "G-code viewer: analyze() pipeline entry point and the synthetic example program"
```

---

## Task 16: Drawing scene (pure) and hover index

**Files:**
- Create: `js/gcode/render.js`
- Test: `_tests/gcode/render.test.js`

**Interfaces:**
- Consumes: `Result` (Task 15); `sampleArc`, `pointSegmentDistance` (Task 3).
- Produces:
  - `layerOf(seg) → 'rapid'|'feed'|'pass'|null`: `pass` means control-generated (any cycle except G70)
  - `pointsOf(seg, n) → Point[]`
  - `toPathD(polylines) → string`: SVG path in user space x = z, y = −x
  - `buildScene(result, { arcSegments }) → { bounds, fitBounds, paths: { profile, rapid, feed, pass }, polylines, starts, labels: { x, z, text }[], empty }`
    - `labels`: the N numbers of each profile's P and Q blocks, once per position
    - `bounds` always includes X = 0, so the centreline is visible.
    - `fitBounds` covers the cutting moves and profiles only (plus X = 0). **Fit** uses it, so far
      tool-change rapids do not shrink the part.
  - `viewBoxFor(bounds, margin) → { x, y, w, h }`
  - `buildIndex(polylines, bounds, cells) → Index`
  - `nearestSegment(index, polylines, p, tol) → segIndex | null`
  - `segmentsByLine(segments) → Map<line, segIndex[]>`

- [ ] **Step 1: Write the failing tests**

`_tests/gcode/render.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyze } from '../../js/gcode/analyze.js';
import { layerOf, toPathD, buildScene, viewBoxFor, buildIndex, nearestSegment, segmentsByLine } from '../../js/gcode/render.js';

const g71 = analyze(readFileSync(new URL('./fixtures/g71-od.nc', import.meta.url), 'utf8'));

test('layers: rapids, programmed feeds, control-generated passes', () => {
  assert.equal(layerOf({ kind: 'rapid', cycle: null }), 'rapid');
  assert.equal(layerOf({ kind: 'feed', cycle: null }), 'feed');
  assert.equal(layerOf({ kind: 'feed', cycle: { code: 70 } }), 'feed');
  assert.equal(layerOf({ kind: 'pass', cycle: { code: 71 } }), 'pass');
  assert.equal(layerOf({ kind: 'dwell', cycle: null }), null);
});

test('path strings: connected polylines continue, gaps start a new M; y is -x', () => {
  assert.equal(toPathD([[{ x: 0, z: 0 }, { x: 0, z: 10 }], [{ x: 0, z: 10 }, { x: 5, z: 10 }]]), 'M0 0L10 0L10 -5');
  assert.equal(toPathD([[{ x: 0, z: 0 }, { x: 0, z: 10 }], [{ x: 1, z: 0 }, { x: 1, z: 5 }]]), 'M0 0L10 0M0 -1L5 -1');
});

test('scene of the G71 fixture: passes drawn, bounds include the centreline and the last move', () => {
  const sc = buildScene(g71);
  assert.ok(sc.paths.pass.length > 0);
  assert.ok(sc.paths.profile.length > 0);
  assert.equal(sc.bounds.minX, 0);
  assert.equal(sc.bounds.maxZ, 100);
  assert.equal(sc.fitBounds.maxZ, 2);                    // Fit ignores the far rapid to Z100
  assert.equal(sc.fitBounds.maxX, 50);
  assert.deepEqual(sc.starts.find(s => s.code === 71), { x: 50, z: 2, code: 71, line: 11 });
  const vb = viewBoxFor(sc.bounds, 0.05);
  assert.ok(vb.w > 0 && vb.h > 0);
});

test('hover index finds the first roughing pass near its middle', () => {
  const sc = buildScene(g71);
  const idx = buildIndex(sc.polylines, sc.bounds, 64);
  const firstPass = g71.segments.findIndex(s => s.kind === 'pass');
  assert.equal(nearestSegment(idx, sc.polylines, { x: 48.1, z: -10 }, 0.5), firstPass);
  assert.equal(nearestSegment(idx, sc.polylines, { x: 200, z: 500 }, 0.5), null);
});

test('P and Q block labels, once per profile', () => {
  const sc = buildScene(g71);
  assert.deepEqual(sc.labels.map(l => l.text), ['N10', 'N20']);
  assert.deepEqual({ x: sc.labels[0].x, z: sc.labels[0].z }, { x: 30, z: 2 });
});

test('line → segments map', () => {
  const m = segmentsByLine(g71.segments);
  assert.equal(m.get(11).length, 41);                  // the G71 second line owns its 41 moves
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test _tests/gcode/render.test.js`
Expected: FAIL with `Cannot find module ... js/gcode/render.js`.

- [ ] **Step 3: Write the implementation**

`js/gcode/render.js`:

```js
// Pure drawing scene: layers, SVG path strings, bounds, hover index. SVG user space: x = Z, y = −X
// (X up on screen), so paths need no transform. Spec §2 (drawing), §8 (colours live in tools.css).
import { sampleArc, pointSegmentDistance } from './geom.js';

export function layerOf(seg) {
  if (seg.kind === 'dwell') return null;
  if (seg.kind === 'rapid') return 'rapid';
  if (seg.cycle && seg.cycle.code !== 70) return 'pass';
  return 'feed';
}

export function pointsOf(seg, n = 24) {
  return seg.arc ? sampleArc(seg.from, seg.to, seg.arc, n) : [seg.from, seg.to];
}

const fmt = v => String(Math.round(v * 1000) / 1000 || 0);

export function toPathD(polys) {
  let d = '', last = null;
  for (const pts of polys) {
    if (!pts || !pts.length) continue;
    const joined = last && Math.abs(last.x - pts[0].x) < 1e-9 && Math.abs(last.z - pts[0].z) < 1e-9;
    for (let i = 0; i < pts.length; i++) {
      if (i === 0 && joined) continue;
      d += `${i === 0 ? 'M' : 'L'}${fmt(pts[i].z)} ${fmt(-pts[i].x)}`;
    }
    last = pts[pts.length - 1];
  }
  return d;
}

export function buildScene(result, opts = {}) {
  const n = opts.arcSegments || 24;
  const layers = { profile: [], rapid: [], feed: [], pass: [] };
  let minZ = Infinity, maxZ = -Infinity, minX = 0, maxX = -Infinity;
  const grow = p => { minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); };
  let fz0 = Infinity, fz1 = -Infinity, fx0 = 0, fx1 = -Infinity;
  const growFit = p => { fz0 = Math.min(fz0, p.z); fz1 = Math.max(fz1, p.z); fx0 = Math.min(fx0, p.x); fx1 = Math.max(fx1, p.x); };
  const polylines = new Array(result.segments.length).fill(null);
  result.segments.forEach((seg, i) => {
    const layer = layerOf(seg);
    if (!layer) return;
    const pts = pointsOf(seg, n);
    pts.forEach(grow);
    if (layer !== 'rapid') pts.forEach(growFit);
    polylines[i] = pts;
    layers[layer].push(pts);
  });
  for (const c of result.cycles) {
    if (![71, 72, 73].includes(c.code) || !c.body) continue;
    for (const s of c.body) { const pts = pointsOf(s, n); pts.forEach(grow); pts.forEach(growFit); layers.profile.push(pts); }
  }
  const empty = !Number.isFinite(maxZ);
  const bounds = empty ? { minZ: -10, maxZ: 10, minX: 0, maxX: 10 } : { minZ, maxZ, minX, maxX };
  // Fit frames the cutting moves: tool-change rapids to a far home position would shrink the part.
  const fitBounds = Number.isFinite(fz1) ? { minZ: fz0, maxZ: fz1, minX: fx0, maxX: fx1 } : bounds;
  const paths = {};
  for (const k of Object.keys(layers)) paths[k] = toPathD(layers[k]);
  const starts = result.cycles
    .filter(c => c.start && c.start.x !== null && c.start.z !== null)
    .map(c => ({ x: c.start.x, z: c.start.z, code: c.code, line: c.line }));
  const labels = [], seenLabel = new Set();
  for (const c of result.cycles) {
    if (!c.body || !c.body.length || !c.pBlock || !c.qBlock) continue;
    const ends = [[c.pBlock, c.body[0].from], [c.qBlock, c.body[c.body.length - 1].to]];
    for (const [b, p] of ends) {
      if (b.n === null) continue;
      const key = `${b.n}@${p.x},${p.z}`;
      if (seenLabel.has(key)) continue;
      seenLabel.add(key);
      labels.push({ x: p.x, z: p.z, text: `N${b.n}` });
    }
  }
  return { bounds, fitBounds, paths, polylines, starts, labels, empty };
}

export function viewBoxFor(b, margin = 0.06) {
  const w = Math.max(b.maxZ - b.minZ, 1), h = Math.max(b.maxX - b.minX, 1);
  return { x: b.minZ - margin * w, y: -b.maxX - margin * h, w: w * (1 + 2 * margin), h: h * (1 + 2 * margin) };
}

export function buildIndex(polylines, bounds, cells = 64) {
  const size = Math.max(bounds.maxZ - bounds.minZ, bounds.maxX - bounds.minX, 1e-6) / cells;
  const grid = new Map();
  const key = (cz, cx) => `${cz},${cx}`;
  polylines.forEach((pts, i) => {
    if (!pts) return;
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], b = pts[k];
      const z0 = Math.floor((Math.min(a.z, b.z) - bounds.minZ) / size), z1 = Math.floor((Math.max(a.z, b.z) - bounds.minZ) / size);
      const x0 = Math.floor((Math.min(a.x, b.x) - bounds.minX) / size), x1 = Math.floor((Math.max(a.x, b.x) - bounds.minX) / size);
      for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
        const kk = key(cz, cx);
        let arr = grid.get(kk);
        if (!arr) grid.set(kk, (arr = []));
        if (arr[arr.length - 1] !== i) arr.push(i);
      }
    }
  });
  return { size, grid, bounds, key };
}

export function nearestSegment(index, polylines, p, tol) {
  const { size, grid, bounds, key } = index;
  const r = Math.max(1, Math.ceil(tol / size));
  const cz0 = Math.floor((p.z - bounds.minZ) / size), cx0 = Math.floor((p.x - bounds.minX) / size);
  let best = null, bestD = tol;
  for (let cz = cz0 - r; cz <= cz0 + r; cz++) for (let cx = cx0 - r; cx <= cx0 + r; cx++) {
    const arr = grid.get(key(cz, cx));
    if (!arr) continue;
    for (const i of arr) {
      const pts = polylines[i];
      for (let k = 1; k < pts.length; k++) {
        const d = pointSegmentDistance(p, pts[k - 1], pts[k]);
        if (d <= bestD) { bestD = d; best = i; }
      }
    }
  }
  return best;
}

export function segmentsByLine(segments) {
  const m = new Map();
  segments.forEach((s, i) => { if (s.line === null) return; if (!m.has(s.line)) m.set(s.line, []); m.get(s.line).push(i); });
  return m;
}
```

- [ ] **Step 4: Run all tests**

Run: `node --test "_tests/gcode/*.test.js"`
Expected: every suite PASSES.

- [ ] **Step 5: Commit**

```bash
git add js/gcode/render.js _tests/gcode/render.test.js
git commit -m "G-code viewer: pure drawing scene, SVG paths and hover index"
```

---

## Task 17: Tool stylesheet and colour-contrast test

**Files:**
- Create: `css/tools.css`
- Test: `_tests/gcode/contrast.test.js`

**Interfaces:**
- Produces:
  - CSS custom properties `--gv-feed`, `--gv-rapid`, `--gv-pass`, `--gv-profile`, `--gv-hi` (hex), `--gv-mono`,
    `--gv-line-h: 20px` (must equal `LINE_H` in `ui.js`)
  - Classes used by Tasks 18–20: `.gv`, `.gv-head`, `.gv-eyebrow`, `.gv-lede`, `.gv-privacy`, `.gv-wrap`,
    `.gv-bar`, `.gv-btn`, `.gv-btn-primary`, `.gv-settings`, `.gv-settings-grid`, `.gv-banner`,
    `.gv-main`, `.gv-program`, `.gv-drawing`, `.gv-panel-head`, `.gv-link`, `.gv-code`,
    `.gv-code-spacer`, `.gv-code-window`, `.gv-line` (`.is-hi`, `.has-warn`), `.gv-no`, `.gv-tx`,
    `.gv-editor`, `.gv-drop-hint`, `.gv-dragging`, `.gv-tools`, `.gv-check`, `.gv-swatch`, `.gv-svg`,
    `.gv-path`, `.gv-feed`, `.gv-rapid`, `.gv-pass`, `.gv-profile`, `.gv-hi`, `.gv-axis`, `.gv-start`, `.gv-label`,
    `.gv-readout`, `.gv-results`, `.gv-time`, `.gv-checks`, `.gv-note`, `.gv-table-wrap`, `.gv-table`,
    `.gv-check-list`, `.gv-w` (`.is-info`/`.is-warn`/`.is-error`/`.is-ok`), `.gv-w-line`, `.gv-cta`,
    `.gv-survey`, `.gv-chip`, `.gv-thanks`, `.gv-footer`, `.gv-footer-legal`, `.gv-print-head`,
    `.gv-print-foot`

- [ ] **Step 1: Write the failing test**

`_tests/gcode/contrast.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../css/tools.css', import.meta.url), 'utf8');
const PAPER = '#f4f3ee';                                  // --paper in css/editorial.css

function luminance(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

test('drawing colours are at least 3:1 against the paper background', () => {
  for (const name of ['feed', 'rapid', 'pass', 'profile', 'hi']) {
    const m = css.match(new RegExp(`--gv-${name}:\\s*(#[0-9a-fA-F]{6})`));
    assert.ok(m, `--gv-${name} must be a 6-digit hex colour`);
    const r = ratio(m[1], PAPER);
    assert.ok(r >= 3, `--gv-${name} ${m[1]} has contrast ${r.toFixed(2)} (< 3)`);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test _tests/gcode/contrast.test.js`
Expected: FAIL with `ENOENT ... css/tools.css`.

- [ ] **Step 3: Write the stylesheet**

`css/tools.css`:

```css
/* Free-tool pages (the G-code viewer first). Builds on the css/editorial.css tokens. Spec §8. */
:root {
  --gv-feed: #0d7a3e;      /* = --accent */
  --gv-rapid: #b8741a;     /* amber, dashed */
  --gv-pass: #4a6f8f;      /* slate: passes the control generates */
  --gv-profile: #6b6a60;   /* = --muted */
  --gv-hi: #c2410c;        /* hover highlight */
  --gv-mono: ui-monospace, 'Cascadia Mono', Consolas, 'Courier New', monospace; /* program panel only */
  --gv-line-h: 20px;       /* must equal LINE_H in js/gcode/ui.js */
}

.gv { background: var(--paper); }
.gv [hidden] { display: none !important; }   /* a class display rule must never beat the hidden attribute */
.gv-head { text-align: center; padding: clamp(2.5rem, 6vw, 4.5rem) 16px clamp(1.5rem, 3vw, 2.5rem); border-bottom: 1px solid var(--line); }
.gv-eyebrow { font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); margin: 0 0 1rem; }
.gv-head h1 { font-family: var(--font-display); font-weight: 300; font-size: clamp(1.7rem, 3.6vw, 2.5rem); line-height: 1.1; letter-spacing: -0.02em; color: var(--ink); margin: 0 0 0.8rem; }
.gv-lede { max-width: 640px; margin: 0 auto 0.6rem; color: var(--ink-soft); font-size: 1.05rem; line-height: 1.6; }
.gv-privacy { color: var(--muted); font-size: 0.85rem; margin: 0; }
.gv-wrap { max-width: 1320px; margin: 0 auto; padding: 0 16px; }
@media (min-width: 720px) { .gv-wrap { padding: 0 clamp(1.25rem, 3vw, 2.5rem); } }

.gv-bar { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; padding: 1rem 0; }
.gv-btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.55rem 0.9rem; border: 1px solid var(--line-strong); background: var(--panel); color: var(--ink); font-family: var(--font-body); font-size: 0.9rem; font-weight: 500; border-radius: 2px; cursor: pointer; }
.gv-btn:hover { border-color: var(--accent-deep); color: var(--accent-deep); }
.gv-btn-primary { background: var(--ink); color: #fff; border-color: var(--ink); }
.gv-btn-primary:hover { background: var(--accent-deep); border-color: var(--accent-deep); color: #fff; }
.gv-settings { flex-basis: 100%; }
.gv-settings summary { cursor: pointer; color: var(--muted); font-size: 0.9rem; }
.gv-settings-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 0.6rem 1rem; padding: 0.8rem 0; }
.gv-settings-grid label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: var(--muted); }
.gv-settings-grid select, .gv-settings-grid input { font-family: var(--font-body); font-size: 0.9rem; padding: 0.4rem 0.5rem; border: 1px solid var(--line-strong); background: var(--panel); color: var(--ink); border-radius: 2px; min-width: 0; }
.gv-banner { margin: 0 0 1rem; padding: 0.7rem 0.9rem; border: 1px solid var(--line-strong); background: var(--accent-soft); font-size: 0.9rem; }

.gv-main { display: grid; grid-template-columns: 1fr; gap: 1rem; padding: 0; }   /* editorial.css pads every <section> */
.gv-drawing { order: -1; }                                     /* phones: drawing first */
@media (min-width: 960px) {
  .gv-main { grid-template-columns: minmax(300px, 0.8fr) 1.6fr; }
  .gv-drawing { order: 0; }
}
.gv-program, .gv-drawing { background: var(--panel); border: 1px solid var(--line); min-width: 0; }
.gv-panel-head { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--line); font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.gv-link { background: none; border: 0; padding: 0; color: var(--accent-deep); cursor: pointer; font-family: var(--font-body); font-size: 0.85rem; font-weight: 500; letter-spacing: 0; text-transform: none; }

.gv-code, .gv-editor { height: min(62vh, 560px); overflow: auto; font-family: var(--gv-mono); font-size: 13px; line-height: var(--gv-line-h); }
.gv-code { position: relative; outline: none; }
.gv-code-spacer { position: relative; }
.gv-code-window { position: absolute; left: 0; right: 0; top: 0; will-change: transform; }
.gv-line { display: flex; height: var(--gv-line-h); white-space: pre; }
.gv-line:hover, .gv-line.is-hi { background: var(--accent-soft); }
.gv-line.has-warn .gv-no { color: var(--gv-rapid); font-weight: 700; }
.gv-no { flex: 0 0 3.5em; text-align: right; padding-right: 0.8em; color: var(--faint); user-select: none; }
.gv-tx { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--ink); }
.gv-editor { display: block; width: 100%; border: 0; padding: 0 0.75rem; resize: vertical; background: var(--panel); color: var(--ink); box-sizing: border-box; }
.gv-drop-hint { padding: 1.5rem 1rem; text-align: center; color: var(--muted); font-size: 0.9rem; }
.gv-dragging .gv-program, .gv-dragging .gv-drawing { outline: 2px dashed var(--accent); outline-offset: -4px; }

.gv-tools { display: flex; flex-wrap: wrap; gap: 0.4rem 0.9rem; align-items: center; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--line); font-size: 0.82rem; }
.gv-check { display: inline-flex; align-items: center; gap: 0.35rem; color: var(--ink-soft); }
.gv-swatch { display: inline-block; width: 18px; height: 0; border-top: 2px solid; }
.gv-swatch.feed { border-color: var(--gv-feed); }
.gv-swatch.rapid { border-color: var(--gv-rapid); border-top-style: dashed; }
.gv-swatch.pass { border-color: var(--gv-pass); }
.gv-swatch.profile { border-color: var(--gv-profile); border-top-width: 4px; opacity: 0.5; }
.gv-svg { display: block; width: 100%; height: min(62vh, 560px); background: var(--panel); touch-action: none; cursor: crosshair; }
.gv-path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.gv-feed { stroke: var(--gv-feed); stroke-width: 1.6; }
.gv-rapid { stroke: var(--gv-rapid); stroke-width: 1.1; stroke-dasharray: 5 4; }
.gv-pass { stroke: var(--gv-pass); stroke-width: 1.1; }
.gv-profile { stroke: var(--gv-profile); stroke-width: 4; opacity: 0.35; }
.gv-hi { stroke: var(--gv-hi); stroke-width: 3; }
.gv-axis { stroke: var(--line-strong); stroke-width: 1; stroke-dasharray: 10 4 2 4; }
.gv-start { fill: var(--ink); }
.gv-label { fill: var(--ink-soft); font-family: var(--gv-mono); }
.gv-readout { margin: 0; padding: 0.4rem 0.75rem; border-top: 1px solid var(--line); font-family: var(--gv-mono); font-size: 12px; color: var(--muted); min-height: 1.6em; }

.gv-results { display: grid; grid-template-columns: 1fr; gap: 1.5rem; padding: 2rem 0; }
.gv-time, .gv-checks { min-width: 0; }   /* let the table scroll inside its box on phones */
@media (min-width: 960px) { .gv-results { grid-template-columns: 1.4fr 1fr; } }
.gv-results h2, .gv-cta h2 { font-family: var(--font-display); font-weight: 400; font-size: 1.35rem; margin: 0 0 0.4rem; color: var(--ink); }
.gv-note { color: var(--muted); font-size: 0.85rem; line-height: 1.5; margin: 0.4rem 0; }
.gv-table-wrap { overflow-x: auto; }
.gv-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; font-variant-numeric: tabular-nums; }
.gv-table th, .gv-table td { text-align: left; padding: 0.45rem 0.5rem; border-bottom: 1px solid var(--line); white-space: nowrap; }
.gv-table th { font-weight: 500; color: var(--muted); font-size: 0.78rem; }
.gv-table tfoot td { font-weight: 600; border-bottom: 0; }
.gv-check-list { list-style: none; margin: 0; padding: 0; }
.gv-w { display: flex; gap: 0.6rem; align-items: baseline; padding: 0.45rem 0; border-bottom: 1px solid var(--line); font-size: 0.9rem; }
.gv-w::before { content: ''; flex: 0 0 8px; height: 8px; border-radius: 50%; background: var(--faint); }
.gv-w.is-warn::before { background: var(--gv-rapid); }
.gv-w.is-error::before { background: var(--gv-hi); }
.gv-w.is-ok::before { background: var(--gv-feed); }
.gv-w-line { background: none; border: 0; padding: 0; color: var(--accent-deep); cursor: pointer; font-family: var(--gv-mono); font-size: 0.82rem; white-space: nowrap; }

.gv-cta { border-top: 1px solid var(--line); padding: 2rem 0 3rem; }
.gv-cta p { max-width: 640px; color: var(--ink-soft); line-height: 1.6; }
.gv-survey { margin-top: 1.5rem; display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.gv-survey p { margin: 0 0.5rem 0 0; color: var(--muted); font-size: 0.9rem; }
.gv-chip { border: 1px solid var(--line-strong); background: var(--panel); border-radius: 999px; padding: 0.35rem 0.85rem; font-family: var(--font-body); font-size: 0.85rem; cursor: pointer; color: var(--ink); }
.gv-chip:hover { border-color: var(--accent-deep); color: var(--accent-deep); }
.gv-thanks { margin: 0; color: var(--accent-deep); font-size: 0.9rem; }

.gv-footer { padding: 2rem 16px; border-top: 1px solid var(--line); display: flex; flex-direction: column; align-items: center; gap: 0.8rem; }
.gv-footer img { display: block; height: 12px; width: auto; }
.gv-footer-legal { display: flex; flex-wrap: wrap; justify-content: center; gap: 1.5rem; }
.gv-footer-legal a { font-size: 0.8rem; color: var(--muted); text-decoration: none; }
.gv-footer-legal a:hover { color: var(--accent-deep); }

.gv-print-head, .gv-print-foot { display: none; }
@media print {
  @page { size: A4; margin: 14mm; }
  body, .gv { background: #fff !important; }
  .navbar, .gv-head, .gv-bar, .gv-banner, .gv-program, .gv-tools, .gv-readout, .gv-cta, .gv-footer, .consent-banner { display: none !important; }
  .gv-print-head { display: flex !important; justify-content: space-between; align-items: center; gap: 12px; border-bottom: 2px solid var(--primary-light); padding-bottom: 8px; margin-bottom: 12px; font-size: 11px; color: #444; }
  .gv-print-head img { height: 16px; width: auto; }
  .gv-print-foot { display: block !important; margin-top: 12px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 10px; color: #777; text-align: center; }
  .gv-main { display: block; }
  .gv-drawing { border: 1px solid #ccc; break-inside: avoid; }
  .gv-svg { height: 95mm; }
  .gv-results { display: block; padding: 0; }
  .gv-time, .gv-checks { break-inside: avoid; margin-top: 10px; }
  .gv-table-wrap { overflow: visible; }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test _tests/gcode/contrast.test.js`
Expected: PASS. The hand-computed ratios are feed 4.9, rapid 3.4, pass 4.8, profile 4.9 and hi 4.7,
all ≥ 3. If a colour is changed later, this test guards it.

- [ ] **Step 5: Commit**

```bash
git add css/tools.css _tests/gcode/contrast.test.js
git commit -m "G-code viewer: tool stylesheet with contrast-checked data colours"
```

---

## Task 18: Page shell with GR/EN/IT translations

**Files:**
- Create: `gcode-viewer.html`

**Interfaces:**
- Consumes: the `css/tools.css` classes (Task 17); the site's `css/editorial.css`, `fonts.css`, logo files,
  and the consent/GA/i18n pattern copied from `calculator.html` (lines 32–70 and 924–978 there, and
  its `setLanguage`).
- Produces, for `ui.js` (Task 20):
  - Globals `window.GV_I18N` (`{ el, en, it }`) and `window.gaEvent(name, params)`.
  - A `gv:lang` event dispatched on `document` after every language change.
  - Element ids: `gvFile`, `gvExample`, `gvPaste`, `gvPrint`, `gvControl`, `gvSystem`, `gvInteger`,
    `gvXMode`, `gvRapidX`, `gvRapidZ`, `gvToolChange`, `gvCorrection`, `gvFlip`, `gvBanner`, `gvEdit`,
    `gvCode`, `gvEditor`, `gvDropHint`, `gvFit`, `gvAspect`, `gvSvg`, `gvReadout`, `gvTimeTable`,
    `gvTotal`, `gvIncomplete`, `gvChecks`, `gvCta`, `gvSurvey`, `gvThanks`, `gvPrintName`, `gvPrintDate`
  - Layer checkboxes carry `data-layer="feed|rapid|pass|profile"`; survey chips carry
    `data-answer="machine|hand|cam"`.

- [ ] **Step 1: Write the page**

`gcode-viewer.html`. The GR copy is the default in the markup. The EN and IT copy lives in the
`translations` object. The Italian uses the formal "voi", following the site's convention.

```html
<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AidedCAM - Προβολή G-code τόρνου</title>
  <meta name="description" content="Δωρεάν προβολή G-code τόρνου: δείτε τα περάσματα των κύκλων G71, G72, G76 και τον χρόνο κύκλου ανά εργαλείο. Χωρίς εγκατάσταση, χωρίς εγγραφή." />
  <meta name="robots" content="index, follow" />
  <link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="icon-192.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png" />
  <meta name="theme-color" content="#f4f3ee" />
  <link rel="canonical" href="https://www.aidedcam.com/gcode-viewer.html" />
  <meta property="og:title" content="AidedCAM - Προβολή G-code τόρνου" />
  <meta property="og:description" content="Δείτε τα περάσματα που κάνει στην πραγματικότητα ο έλεγχός σας, και πόσο χρόνο παίρνουν." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://www.aidedcam.com/gcode-viewer.html" />
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
  <link rel="stylesheet" href="css/editorial.css?v=20260923b" />
  <link rel="stylesheet" href="css/tools.css?v=20261001" />
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
      <h1 data-i18n="gv.title">Προβολή G-code τόρνου</h1>
      <p class="gv-lede" data-i18n="gv.lede">Δείτε τα περάσματα που κάνει στην πραγματικότητα ο έλεγχός σας, και πόσο χρόνο παίρνουν.</p>
      <p class="gv-privacy" data-i18n="gv.privacy">Το πρόγραμμά σας δεν φεύγει ποτέ από τον υπολογιστή σας.</p>
    </header>

    <div class="gv-wrap">
      <div class="gv-print-head" aria-hidden="true">
        <img src="aidedcam-wordmark.svg" alt="AidedCAM" width="716" height="67" />
        <span id="gvPrintName"></span><span id="gvPrintDate"></span>
      </div>
      <noscript><p class="gv-banner" data-i18n="gv.noscript">Το εργαλείο χρειάζεται JavaScript.</p></noscript>

      <section class="gv-bar" aria-label="Program">
        <label class="gv-btn gv-btn-primary"><input type="file" id="gvFile" hidden /><span data-i18n="gv.open">Άνοιγμα αρχείου</span></label>
        <button type="button" class="gv-btn" id="gvExample" data-i18n="gv.example">Φόρτωση παραδείγματος</button>
        <button type="button" class="gv-btn" id="gvPaste" data-i18n="gv.paste">Επικόλληση</button>
        <button type="button" class="gv-btn" id="gvPrint" data-i18n="gv.print">Εκτύπωση / Αποθήκευση PDF</button>
        <details class="gv-settings">
          <summary data-i18n="gv.settings">Ρυθμίσεις</summary>
          <div class="gv-settings-grid">
            <label><span data-i18n="gv.set.control">Έλεγχος</span>
              <select id="gvControl"><option value="auto" data-i18n="gv.set.auto">Αυτόματα</option><option value="fanuc">Fanuc</option><option value="haas">Haas</option></select></label>
            <label><span data-i18n="gv.set.system">Σύστημα G-code</span>
              <select id="gvSystem"><option value="A">A</option><option value="B">B</option><option value="C">C</option></select></label>
            <label><span data-i18n="gv.set.integer">Αριθμοί χωρίς υποδιαστολή</span>
              <select id="gvInteger"><option value="mm">mm</option><option value="um">µm</option></select></label>
            <label><span data-i18n="gv.set.xmode">Το X προγραμματίζεται ως</span>
              <select id="gvXMode"><option value="dia" data-i18n="gv.set.dia">διάμετρος</option><option value="rad" data-i18n="gv.set.rad">ακτίνα</option></select></label>
            <label><span data-i18n="gv.set.rapidx">Ταχεία X (mm/min)</span><input id="gvRapidX" type="number" min="100" step="100" /></label>
            <label><span data-i18n="gv.set.rapidz">Ταχεία Z (mm/min)</span><input id="gvRapidZ" type="number" min="100" step="100" /></label>
            <label><span data-i18n="gv.set.toolchange">Αλλαγή εργαλείου (s)</span><input id="gvToolChange" type="number" min="0" step="0.5" /></label>
            <label><span data-i18n="gv.set.correction">Διόρθωση (%)</span><input id="gvCorrection" type="number" step="1" /></label>
            <label><span data-i18n="gv.set.flip">X+ στην οθόνη</span>
              <select id="gvFlip"><option value="up" data-i18n="gv.set.up">πάνω</option><option value="down" data-i18n="gv.set.down">κάτω</option></select></label>
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
            <button type="button" class="gv-link" id="gvFit" data-i18n="gv.fit">Προσαρμογή</button>
            <label class="gv-check"><input type="checkbox" id="gvAspect" checked /><span data-i18n="gv.aspect">1:1</span></label>
            <label class="gv-check"><input type="checkbox" data-layer="feed" checked /><i class="gv-swatch feed"></i><span data-i18n="gv.l.feed">Κινήσεις κοπής</span></label>
            <label class="gv-check"><input type="checkbox" data-layer="rapid" checked /><i class="gv-swatch rapid"></i><span data-i18n="gv.l.rapid">Ταχείες</span></label>
            <label class="gv-check"><input type="checkbox" data-layer="pass" checked /><i class="gv-swatch pass"></i><span data-i18n="gv.l.pass">Από τον έλεγχο</span></label>
            <label class="gv-check"><input type="checkbox" data-layer="profile" checked /><i class="gv-swatch profile"></i><span data-i18n="gv.l.profile">Τελικό προφίλ</span></label>
          </div>
          <svg class="gv-svg" id="gvSvg" role="img" data-i18n-aria="gv.aria.svg" aria-label="Σχέδιο διαδρομών, ημιτομή X–Z"></svg>
          <p class="gv-readout" id="gvReadout"></p>
        </div>
      </section>

      <section class="gv-results">
        <div class="gv-time">
          <h2 data-i18n="gv.time.title">Χρόνος κύκλου</h2>
          <p class="gv-note" data-i18n="gv.time.note">Εκτίμηση για προγραμματισμό, υπολογισμένη κίνηση προς κίνηση, μαζί με τα περάσματα που παράγει ο έλεγχος.</p>
          <div class="gv-table-wrap">
            <table class="gv-table" id="gvTimeTable">
              <thead><tr>
                <th data-i18n="gv.time.tool">Εργαλείο</th><th data-i18n="gv.time.label">Περιγραφή</th>
                <th data-i18n="gv.time.cycles">Κύκλοι</th><th data-i18n="gv.time.passes">Περάσματα</th>
                <th data-i18n="gv.time.length">Μήκος κοπής (m)</th><th data-i18n="gv.time.cut">Κοπή</th>
                <th data-i18n="gv.time.rapid">Ταχείες</th><th data-i18n="gv.time.total">Σύνολο</th>
              </tr></thead>
              <tbody></tbody>
              <tfoot><tr><td colspan="7" data-i18n="gv.time.program">Σύνολο προγράμματος (με αλλαγές εργαλείων)</td><td id="gvTotal">–</td></tr></tfoot>
            </table>
          </div>
          <p class="gv-note" id="gvIncomplete" data-i18n="gv.time.incomplete" hidden>Κάποιες κινήσεις δεν έχουν πρόωση ή στροφές· ο χρόνος τους δεν μετράει.</p>
          <p class="gv-note" data-i18n="gv.time.excluded">Δεν περιλαμβάνονται: επιταχύνσεις και επιβραδύνσεις, επιτάχυνση ατράκτου, επεξεργασία μπλοκ, ενέργειες M (ψυκτικό, τσοκ) και επιστροφές G28.</p>
        </div>
        <div class="gv-checks">
          <h2 data-i18n="gv.checks.title">Έλεγχοι προγράμματος</h2>
          <ul class="gv-check-list" id="gvChecks"></ul>
          <p class="gv-note" data-i18n="gv.disclaimer">Προβολή, όχι προσομοίωση: ελέγχετε πάντα στη μηχανή σας.</p>
        </div>
      </section>

      <section class="gv-cta">
        <h2 data-i18n="gv.cta.title">Το θέλετε φτιαγμένο για τη δική σας μηχανή;</h2>
        <p data-i18n="gv.cta.text">Φτιάχνουμε λογισμικό CAM τόρνου σαν αυτό, στα μέτρα της μηχανής σας, του post-processor σας και του τρόπου που δουλεύει το μηχανουργείο σας.</p>
        <a class="btn-primary" id="gvCta" href="index.html#contact" data-i18n="gv.cta.button">Μιλήστε μαζί μας</a>
        <div class="gv-survey" id="gvSurvey">
          <p data-i18n="gv.survey.q">Πώς γράφετε τα προγράμματα τόρνου;</p>
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

  <script>
    var translations = {
      el: {
        '_title': 'AidedCAM - Προβολή G-code τόρνου',
        'gv.back': 'Αρχική', 'gv.eyebrow': 'Δωρεάν εργαλείο', 'gv.title': 'Προβολή G-code τόρνου',
        'gv.lede': 'Δείτε τα περάσματα που κάνει στην πραγματικότητα ο έλεγχός σας, και πόσο χρόνο παίρνουν.',
        'gv.privacy': 'Το πρόγραμμά σας δεν φεύγει ποτέ από τον υπολογιστή σας.',
        'gv.noscript': 'Το εργαλείο χρειάζεται JavaScript.',
        'gv.open': 'Άνοιγμα αρχείου', 'gv.example': 'Φόρτωση παραδείγματος', 'gv.paste': 'Επικόλληση',
        'gv.print': 'Εκτύπωση / Αποθήκευση PDF', 'gv.settings': 'Ρυθμίσεις',
        'gv.set.control': 'Έλεγχος', 'gv.set.auto': 'Αυτόματα', 'gv.set.system': 'Σύστημα G-code',
        'gv.set.integer': 'Αριθμοί χωρίς υποδιαστολή', 'gv.set.xmode': 'Το X προγραμματίζεται ως',
        'gv.set.dia': 'διάμετρος', 'gv.set.rad': 'ακτίνα', 'gv.set.rapidx': 'Ταχεία X (mm/min)',
        'gv.set.rapidz': 'Ταχεία Z (mm/min)', 'gv.set.toolchange': 'Αλλαγή εργαλείου (s)',
        'gv.set.correction': 'Διόρθωση (%)', 'gv.set.flip': 'X+ στην οθόνη', 'gv.set.up': 'πάνω', 'gv.set.down': 'κάτω',
        'gv.program': 'Πρόγραμμα', 'gv.edit': 'Επεξεργασία', 'gv.done': 'Τέλος',
        'gv.drop': 'Αφήστε εδώ ένα αρχείο ή επικολλήστε ένα πρόγραμμα',
        'gv.fit': 'Προσαρμογή', 'gv.aspect': '1:1', 'gv.l.feed': 'Κινήσεις κοπής', 'gv.l.rapid': 'Ταχείες',
        'gv.l.pass': 'Από τον έλεγχο', 'gv.l.profile': 'Τελικό προφίλ',
        'gv.aria.code': 'Γραμμές προγράμματος', 'gv.aria.svg': 'Σχέδιο διαδρομών, ημιτομή X–Z',
        'gv.readout': 'Γραμμή {line} · X{x} Z{z}',
        'gv.time.title': 'Χρόνος κύκλου',
        'gv.time.note': 'Εκτίμηση για προγραμματισμό, υπολογισμένη κίνηση προς κίνηση, μαζί με τα περάσματα που παράγει ο έλεγχος.',
        'gv.time.tool': 'Εργαλείο', 'gv.time.label': 'Περιγραφή', 'gv.time.cycles': 'Κύκλοι', 'gv.time.passes': 'Περάσματα',
        'gv.time.length': 'Μήκος κοπής (m)', 'gv.time.cut': 'Κοπή', 'gv.time.rapid': 'Ταχείες', 'gv.time.total': 'Σύνολο',
        'gv.time.program': 'Σύνολο προγράμματος (με αλλαγές εργαλείων)',
        'gv.time.incomplete': 'Κάποιες κινήσεις δεν έχουν πρόωση ή στροφές· ο χρόνος τους δεν μετράει.',
        'gv.time.excluded': 'Δεν περιλαμβάνονται: επιταχύνσεις και επιβραδύνσεις, επιτάχυνση ατράκτου, επεξεργασία μπλοκ, ενέργειες M (ψυκτικό, τσοκ) και επιστροφές G28.',
        'gv.checks.title': 'Έλεγχοι προγράμματος', 'gv.checks.none': 'Δεν βρέθηκαν προβλήματα.', 'gv.checks.line': 'Γραμμή',
        'gv.disclaimer': 'Προβολή, όχι προσομοίωση: ελέγχετε πάντα στη μηχανή σας.',
        'gv.cta.title': 'Το θέλετε φτιαγμένο για τη δική σας μηχανή;',
        'gv.cta.text': 'Φτιάχνουμε λογισμικό CAM τόρνου σαν αυτό, στα μέτρα της μηχανής σας, του post-processor σας και του τρόπου που δουλεύει το μηχανουργείο σας.',
        'gv.cta.button': 'Μιλήστε μαζί μας',
        'gv.survey.q': 'Πώς γράφετε τα προγράμματα τόρνου;', 'gv.survey.machine': 'Στη μηχανή',
        'gv.survey.hand': 'Με το χέρι', 'gv.survey.cam': 'Από CAM', 'gv.survey.thanks': 'Ευχαριστούμε!',
        'gv.banner.toolarge': 'Το αρχείο έχει {lines} γραμμές· η προβολή δέχεται έως {max}.',
        'gv.paste.fail': 'Ο browser δεν επιτρέπει την επικόλληση από το κουμπί. Πατήστε Ctrl+V μέσα στη σελίδα.',
        'gv.print.estimate': 'Εκτίμηση για προγραμματισμό',
        'gv.check.g96-no-g50': 'G96 (σταθερή ταχύτητα κοπής) χωρίς όριο στροφών G50: η άτρακτος μπορεί να ξεπεράσει τις στροφές κοντά στο κέντρο.',
        'gv.check.type1-monotonic': 'Το προφίλ Τύπου I δεν είναι μονότονο (συναγερμός Fanuc 064). Χρησιμοποιήστε Τύπο II (X και Z στο μπλοκ P) ή αλλάξτε το προφίλ.',
        'gv.check.p-block': 'Το μπλοκ P δεν κινεί τον άξονα που χρειάζεται ο κύκλος (συναγερμός Fanuc 065).',
        'gv.check.q-block-corner': 'Λοξότμηση ή στρογγύλευση (C/R) στο μπλοκ Q (συναγερμός Fanuc 069).',
        'gv.check.tnrc-scope': 'Η αντιστάθμιση ακτίνας μύτης (G41/G42) είναι ενεργή στην κλήση του κύκλου ή δεν ακυρώνεται μέχρι το μπλοκ Q.',
        'gv.check.start-in-material': 'Το σημείο εκκίνησης του κύκλου βρίσκεται μέσα στο προφίλ: το πρώτο πέρασμα θα ξεκινήσει μέσα στο υλικό.',
        'gv.check.allowance-vs-depth': 'Το περιθώριο φινιρίσματος δεν είναι μικρότερο από το βάθος κοπής.',
        'gv.check.pq-decimal': 'Τα P/Q στους G74/G75/G76 δίνονται σε μικρά χωρίς υποδιαστολή (Q250 = 0,25 mm).',
        'gv.check.css-threading': 'Σπείρωμα με G96: οι περισσότεροι έλεγχοι θέλουν G97 (σταθερές στροφές) για σπειρώματα.',
        'gv.check.no-feed': 'Κίνηση κοπής χωρίς πρόωση (F).',
        'gv.check.no-speed': 'Πρόωση ανά στροφή χωρίς στροφές ατράκτου (S).',
        'gv.check.tool-zero': 'Κοπή με εργαλείο ή διόρθωση μηδέν ({tool}).',
        'gv.check.subprogram': 'Η κλήση υποπρογράμματος M98 δεν ακολουθείται σε αυτή την έκδοση.',
        'gv.check.skipped': 'Παραλείφθηκαν {count} γραμμές macro/εκφράσεων.',
        'gv.check.milling': 'Μοιάζει με πρόγραμμα φρέζας· η προβολή είναι για προγράμματα τόρνου.',
        'gv.check.pq-not-found': 'P{p}/Q{q}: δεν βρέθηκαν τα μπλοκ του προφίλ.',
        'gv.check.cycle-no-start': 'Άγνωστο σημείο εκκίνησης κύκλου (καμία θέση πριν από τον κύκλο).',
        'gv.check.cycle-form': 'Λείπουν απαραίτητες λέξεις από τον κύκλο G{code}.',
        'gv.check.cycle-unsupported': 'Ο κύκλος G{code} δεν υποστηρίζεται σε αυτή την έκδοση.',
        'gv.check.type2-pocket': 'Προφίλ Τύπου II με εσοχές: τα περάσματα μέσα στις εσοχές διαφέρουν ανά έλεγχο και δεν σχεδιάζονται· ελέγξτε στη μηχανή σας.',
        'cookie_text': 'Αυτός ο ιστότοπος χρησιμοποιεί cookies για τη βελτιστοποίηση της λειτουργίας του και την ανάλυση επισκεψιμότητας.',
        'cookie_accept': 'Αποδοχή', 'cookie_decline': 'Απόρριψη', 'cookie_manage': 'Διαχείριση προτιμήσεων',
        'cookie_privacy_link': 'Πολιτική Απορρήτου',
        'cookie_prefs_desc': 'Επιλέξτε ποιες κατηγορίες cookies επιθυμείτε να ενεργοποιήσετε. Τα απαραίτητα cookies είναι πάντα ενεργά για τη σωστή λειτουργία του ιστότοπου.',
        'cookie_cat_necessary': 'Απαραίτητα', 'cookie_cat_necessary_desc': 'Βασική λειτουργία ιστότοπου',
        'cookie_cat_functional': 'Λειτουργικά', 'cookie_cat_functional_desc': 'Αποθήκευση προτιμήσεων γλώσσας',
        'cookie_cat_analytics': 'Ανάλυση επισκεψιμότητας', 'cookie_cat_analytics_desc': 'Google Analytics, ανώνυμα στατιστικά',
        'cookie_cat_marketing': 'Διαφημιστικά', 'cookie_cat_marketing_desc': 'Δεν χρησιμοποιούνται αυτήν τη στιγμή',
        'cookie_back': 'Πίσω', 'cookie_save': 'Αποθήκευση προτιμήσεων',
        'footer.privacy': 'Απόρρητο', 'footer.legal': 'Νομικά', 'footer.cookie_settings': 'Ρυθμίσεις Cookies'
      },
      en: {
        '_title': 'AidedCAM - Lathe G-code viewer',
        'gv.back': 'Home', 'gv.eyebrow': 'Free tool', 'gv.title': 'Lathe G-code viewer',
        'gv.lede': 'See the passes your control really makes, and how long they take.',
        'gv.privacy': 'Your program never leaves your computer.',
        'gv.noscript': 'This tool needs JavaScript.',
        'gv.open': 'Open file', 'gv.example': 'Load example', 'gv.paste': 'Paste',
        'gv.print': 'Print / Save as PDF', 'gv.settings': 'Settings',
        'gv.set.control': 'Control', 'gv.set.auto': 'Automatic', 'gv.set.system': 'G-code system',
        'gv.set.integer': 'Numbers without a decimal point', 'gv.set.xmode': 'X programmed as',
        'gv.set.dia': 'diameter', 'gv.set.rad': 'radius', 'gv.set.rapidx': 'Rapid X (mm/min)',
        'gv.set.rapidz': 'Rapid Z (mm/min)', 'gv.set.toolchange': 'Tool change (s)',
        'gv.set.correction': 'Correction (%)', 'gv.set.flip': 'X+ on screen', 'gv.set.up': 'up', 'gv.set.down': 'down',
        'gv.program': 'Program', 'gv.edit': 'Edit', 'gv.done': 'Done',
        'gv.drop': 'Drop a file here or paste a program',
        'gv.fit': 'Fit', 'gv.aspect': '1:1', 'gv.l.feed': 'Feed moves', 'gv.l.rapid': 'Rapids',
        'gv.l.pass': 'Generated by the control', 'gv.l.profile': 'Finished profile',
        'gv.aria.code': 'Program lines', 'gv.aria.svg': 'Toolpath drawing, X–Z half-section',
        'gv.readout': 'Line {line} · X{x} Z{z}',
        'gv.time.title': 'Cycle time',
        'gv.time.note': 'Planning estimate, calculated move by move, including the passes the control generates.',
        'gv.time.tool': 'Tool', 'gv.time.label': 'Description', 'gv.time.cycles': 'Cycles', 'gv.time.passes': 'Passes',
        'gv.time.length': 'Cut length (m)', 'gv.time.cut': 'Cutting', 'gv.time.rapid': 'Rapids', 'gv.time.total': 'Total',
        'gv.time.program': 'Program total (incl. tool changes)',
        'gv.time.incomplete': 'Some moves have no feed or speed; their time is not counted.',
        'gv.time.excluded': 'Not included: acceleration and deceleration, spindle ramp-up, block processing, M-code actions (coolant, chuck) and G28 reference returns.',
        'gv.checks.title': 'Program checks', 'gv.checks.none': 'No issues found.', 'gv.checks.line': 'Line',
        'gv.disclaimer': 'A viewer, not a simulator: always verify on your machine.',
        'gv.cta.title': 'Want this built around your own machine?',
        'gv.cta.text': 'We build lathe CAM software like this, tailored to your machine, your post-processor and the way your shop works.',
        'gv.cta.button': 'Talk to us',
        'gv.survey.q': 'How do you write your lathe programs?', 'gv.survey.machine': 'At the machine',
        'gv.survey.hand': 'By hand', 'gv.survey.cam': 'From CAM', 'gv.survey.thanks': 'Thank you!',
        'gv.banner.toolarge': 'This file has {lines} lines; the viewer handles up to {max}.',
        'gv.paste.fail': 'The browser blocks pasting from the button. Press Ctrl+V anywhere on the page.',
        'gv.print.estimate': 'Planning estimate',
        'gv.check.g96-no-g50': 'G96 (constant surface speed) with no G50 spindle limit: the spindle can over-speed near the centre.',
        'gv.check.type1-monotonic': 'The Type I profile is not monotonic (Fanuc alarm 064). Use Type II (X and Z in the P block) or change the profile.',
        'gv.check.p-block': 'The P block does not move the axis this cycle needs (Fanuc alarm 065).',
        'gv.check.q-block-corner': 'Chamfer or corner (C/R) in the Q block (Fanuc alarm 069).',
        'gv.check.tnrc-scope': 'Nose-radius compensation (G41/G42) is active at the cycle call or not cancelled by the Q block.',
        'gv.check.start-in-material': 'The cycle start point is inside the profile: the first pass would start in material.',
        'gv.check.allowance-vs-depth': 'The finishing allowance is not smaller than the depth of cut.',
        'gv.check.pq-decimal': 'P/Q in G74/G75/G76 are microns without a decimal point (Q250 = 0.25 mm).',
        'gv.check.css-threading': 'Threading under G96: most controls need G97 (fixed rpm) for threads.',
        'gv.check.no-feed': 'Cutting move with no feed (F).',
        'gv.check.no-speed': 'Feed per rev with no spindle speed (S).',
        'gv.check.tool-zero': 'Cutting with tool or offset zero ({tool}).',
        'gv.check.subprogram': 'The M98 subprogram call is not followed in this version.',
        'gv.check.skipped': '{count} macro/expression lines skipped.',
        'gv.check.milling': 'This looks like a milling program; the viewer is for lathe programs.',
        'gv.check.pq-not-found': 'P{p}/Q{q}: profile blocks not found.',
        'gv.check.cycle-no-start': 'Cycle start point unknown (no position before the cycle).',
        'gv.check.cycle-form': 'Cycle G{code} is missing required words.',
        'gv.check.cycle-unsupported': 'Cycle G{code} is not supported in this version.',
        'gv.check.type2-pocket': 'Type II profile with pockets: pocket passes differ by control and are not drawn; verify on your machine.',
        'cookie_text': 'This website uses cookies to optimize functionality and analyze traffic.',
        'cookie_accept': 'Accept', 'cookie_decline': 'Decline', 'cookie_manage': 'Manage preferences',
        'cookie_privacy_link': 'Privacy Policy',
        'cookie_prefs_desc': 'Choose which categories of cookies you wish to enable. Essential cookies are always active for the proper functioning of the website.',
        'cookie_cat_necessary': 'Essential', 'cookie_cat_necessary_desc': 'Basic website functionality',
        'cookie_cat_functional': 'Functional', 'cookie_cat_functional_desc': 'Language preference storage',
        'cookie_cat_analytics': 'Analytics', 'cookie_cat_analytics_desc': 'Google Analytics, anonymous statistics',
        'cookie_cat_marketing': 'Marketing', 'cookie_cat_marketing_desc': 'Not currently used',
        'cookie_back': 'Back', 'cookie_save': 'Save preferences',
        'footer.privacy': 'Privacy', 'footer.legal': 'Legal', 'footer.cookie_settings': 'Cookie Settings'
      },
      it: {
        '_title': 'AidedCAM - Visualizzatore G-code per tornio',
        'gv.back': 'Home', 'gv.eyebrow': 'Strumento gratuito', 'gv.title': 'Visualizzatore G-code per tornio',
        'gv.lede': 'Vedete le passate che il vostro controllo esegue davvero, e quanto tempo richiedono.',
        'gv.privacy': 'Il vostro programma non lascia mai il vostro computer.',
        'gv.noscript': 'Questo strumento richiede JavaScript.',
        'gv.open': 'Apri file', 'gv.example': 'Carica esempio', 'gv.paste': 'Incolla',
        'gv.print': 'Stampa / Salva PDF', 'gv.settings': 'Impostazioni',
        'gv.set.control': 'Controllo', 'gv.set.auto': 'Automatico', 'gv.set.system': 'Sistema G-code',
        'gv.set.integer': 'Numeri senza punto decimale', 'gv.set.xmode': 'X programmato come',
        'gv.set.dia': 'diametro', 'gv.set.rad': 'raggio', 'gv.set.rapidx': 'Rapido X (mm/min)',
        'gv.set.rapidz': 'Rapido Z (mm/min)', 'gv.set.toolchange': 'Cambio utensile (s)',
        'gv.set.correction': 'Correzione (%)', 'gv.set.flip': 'X+ sullo schermo', 'gv.set.up': 'in alto', 'gv.set.down': 'in basso',
        'gv.program': 'Programma', 'gv.edit': 'Modifica', 'gv.done': 'Fatto',
        'gv.drop': 'Trascinate qui un file o incollate un programma',
        'gv.fit': 'Adatta', 'gv.aspect': '1:1', 'gv.l.feed': 'Movimenti di taglio', 'gv.l.rapid': 'Rapidi',
        'gv.l.pass': 'Generati dal controllo', 'gv.l.profile': 'Profilo finito',
        'gv.aria.code': 'Righe del programma', 'gv.aria.svg': 'Disegno dei percorsi, semisezione X–Z',
        'gv.readout': 'Riga {line} · X{x} Z{z}',
        'gv.time.title': 'Tempo ciclo',
        'gv.time.note': 'Stima per la pianificazione, calcolata movimento per movimento, comprese le passate generate dal controllo.',
        'gv.time.tool': 'Utensile', 'gv.time.label': 'Descrizione', 'gv.time.cycles': 'Cicli', 'gv.time.passes': 'Passate',
        'gv.time.length': 'Lunghezza di taglio (m)', 'gv.time.cut': 'Taglio', 'gv.time.rapid': 'Rapidi', 'gv.time.total': 'Totale',
        'gv.time.program': 'Totale programma (inclusi cambi utensile)',
        'gv.time.incomplete': 'Alcuni movimenti non hanno avanzamento o giri; il loro tempo non è conteggiato.',
        'gv.time.excluded': 'Non inclusi: accelerazioni e decelerazioni, rampa del mandrino, elaborazione dei blocchi, azioni M (refrigerante, autocentrante) e ritorni G28.',
        'gv.checks.title': 'Controlli del programma', 'gv.checks.none': 'Nessun problema rilevato.', 'gv.checks.line': 'Riga',
        'gv.disclaimer': 'Un visualizzatore, non un simulatore: verificate sempre sulla vostra macchina.',
        'gv.cta.title': 'Lo volete su misura per la vostra macchina?',
        'gv.cta.text': 'Sviluppiamo software CAM per tornio come questo, su misura per la vostra macchina, il vostro post-processor e il modo in cui lavora la vostra officina.',
        'gv.cta.button': 'Parlate con noi',
        'gv.survey.q': 'Come scrivete i programmi per il tornio?', 'gv.survey.machine': 'In macchina',
        'gv.survey.hand': 'A mano', 'gv.survey.cam': 'Da CAM', 'gv.survey.thanks': 'Grazie!',
        'gv.banner.toolarge': 'Questo file ha {lines} righe; il visualizzatore ne gestisce fino a {max}.',
        'gv.paste.fail': 'Il browser blocca l’incolla dal pulsante. Premete Ctrl+V in un punto qualsiasi della pagina.',
        'gv.print.estimate': 'Stima per la pianificazione',
        'gv.check.g96-no-g50': 'G96 (velocità di taglio costante) senza limite giri G50: il mandrino può andare fuori giri vicino al centro.',
        'gv.check.type1-monotonic': 'Il profilo di Tipo I non è monotono (allarme Fanuc 064). Usate il Tipo II (X e Z nel blocco P) o modificate il profilo.',
        'gv.check.p-block': 'Il blocco P non muove l’asse richiesto dal ciclo (allarme Fanuc 065).',
        'gv.check.q-block-corner': 'Smusso o raccordo (C/R) nel blocco Q (allarme Fanuc 069).',
        'gv.check.tnrc-scope': 'La compensazione del raggio utensile (G41/G42) è attiva alla chiamata del ciclo o non viene annullata entro il blocco Q.',
        'gv.check.start-in-material': 'Il punto di partenza del ciclo è dentro il profilo: la prima passata partirebbe nel materiale.',
        'gv.check.allowance-vs-depth': 'Il sovrametallo di finitura non è inferiore alla profondità di passata.',
        'gv.check.pq-decimal': 'P/Q in G74/G75/G76 sono in micron senza punto decimale (Q250 = 0,25 mm).',
        'gv.check.css-threading': 'Filettatura in G96: la maggior parte dei controlli richiede G97 (giri fissi) per le filettature.',
        'gv.check.no-feed': 'Movimento di taglio senza avanzamento (F).',
        'gv.check.no-speed': 'Avanzamento al giro senza velocità del mandrino (S).',
        'gv.check.tool-zero': 'Taglio con utensile o correttore zero ({tool}).',
        'gv.check.subprogram': 'La chiamata di sottoprogramma M98 non viene seguita in questa versione.',
        'gv.check.skipped': '{count} righe di macro/espressioni ignorate.',
        'gv.check.milling': 'Sembra un programma di fresatura; il visualizzatore è per programmi di tornitura.',
        'gv.check.pq-not-found': 'P{p}/Q{q}: blocchi del profilo non trovati.',
        'gv.check.cycle-no-start': 'Punto di partenza del ciclo sconosciuto (nessuna posizione prima del ciclo).',
        'gv.check.cycle-form': 'Al ciclo G{code} mancano parole obbligatorie.',
        'gv.check.cycle-unsupported': 'Il ciclo G{code} non è supportato in questa versione.',
        'gv.check.type2-pocket': 'Profilo di Tipo II con tasche: le passate nelle tasche variano secondo il controllo e non sono disegnate; verificate sulla vostra macchina.',
        'cookie_text': 'Questo sito web utilizza i cookie per ottimizzare le sue funzionalità e analizzare il traffico.',
        'cookie_accept': 'Accetta', 'cookie_decline': 'Rifiuta', 'cookie_manage': 'Gestisci preferenze',
        'cookie_privacy_link': 'Informativa Privacy',
        'cookie_prefs_desc': 'Scegliete quali categorie di cookie desiderate attivare. I cookie essenziali sono sempre attivi per il corretto funzionamento del sito.',
        'cookie_cat_necessary': 'Essenziali', 'cookie_cat_necessary_desc': 'Funzionalità di base del sito web',
        'cookie_cat_functional': 'Funzionali', 'cookie_cat_functional_desc': 'Memorizzazione preferenza lingua',
        'cookie_cat_analytics': 'Analitici', 'cookie_cat_analytics_desc': 'Google Analytics, statistiche anonime',
        'cookie_cat_marketing': 'Marketing', 'cookie_cat_marketing_desc': 'Attualmente non utilizzati',
        'cookie_back': 'Indietro', 'cookie_save': 'Salva preferenze',
        'footer.privacy': 'Privacy', 'footer.legal': 'Note Legali', 'footer.cookie_settings': 'Impostazioni Cookie'
      }
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
  <script type="module" src="js/gcode/ui.js?v=20261001"></script>
</body>
</html>
```

- [ ] **Step 2: Check the static page renders**

Run in the repo root: `python -m http.server 8765`. Start it in the background; ES modules do not load
from `file://`. Open `http://localhost:8765/gcode-viewer.html`.
Expected: nav, heading, settings, empty panels and the consent banner render. The console shows one
error, a 404 for `js/gcode/ui.js`, which is fine until Task 20. Switching EL/EN/IT changes every
label. Stop the server when done.

- [ ] **Step 3: Commit**

```bash
git add gcode-viewer.html
git commit -m "G-code viewer: page shell with GR/EN/IT copy, consent and GA pattern"
```

---

## Task 19: Drawing (DOM)

**Files:**
- Create: `js/gcode/drawing.js`

**Interfaces:**
- Consumes: `buildScene`, `viewBoxFor`, `buildIndex`, `nearestSegment`, `toPathD` (Task 16).
- Produces:
  - `createDrawing(svg, { onHover(segIndex|null, worldPoint|null) }) → { update(result), fit(), setAspect(oneToOne), setFlip(xDown), setLayerVisible(layer, on), highlight(segIndexes) }`

- [ ] **Step 1: Write the module**

`js/gcode/drawing.js`:

```js
// DOM drawing: mounts a render.js scene into an <svg> with wheel zoom, drag pan, fit, 1:1 aspect,
// X+ up/down, layer toggles, hover and highlight. Only this file and ui.js touch the DOM.
import { buildScene, viewBoxFor, buildIndex, nearestSegment, toPathD } from './render.js';

const NS = 'http://www.w3.org/2000/svg';
const LAYERS = ['profile', 'rapid', 'pass', 'feed'];            // paint order: profile underneath

function el(name, attrs = {}) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

export function createDrawing(svg, { onHover } = {}) {
  let scene = null, index = null, vb = null, flip = false, drag = null;
  const root = el('g', { class: 'gv-root' });
  const axis = el('path', { class: 'gv-path gv-axis', 'vector-effect': 'non-scaling-stroke' });
  root.appendChild(axis);
  const paths = {};
  for (const k of LAYERS) {
    paths[k] = el('path', { class: `gv-path gv-${k}`, 'vector-effect': 'non-scaling-stroke' });
    root.appendChild(paths[k]);
  }
  const hi = el('path', { class: 'gv-path gv-hi', 'vector-effect': 'non-scaling-stroke' });
  const starts = el('g', { class: 'gv-starts' });
  root.append(hi, starts);
  const labelsG = el('g', { class: 'gv-labels' });
  svg.replaceChildren(root, labelsG);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  function worldPerPixel() {
    const r = svg.getBoundingClientRect();
    return vb ? Math.max(vb.w / Math.max(1, r.width), vb.h / Math.max(1, r.height)) : 1;
  }

  function apply() {
    if (!vb) return;
    const y = flip ? -(vb.y + vb.h) : vb.y;                       // flipped content: y' = -y
    svg.setAttribute('viewBox', `${vb.x} ${y} ${vb.w} ${vb.h}`);
    if (flip) root.setAttribute('transform', 'scale(1,-1)'); else root.removeAttribute('transform');
    const r = 4 * worldPerPixel();
    starts.querySelectorAll('circle').forEach(c => c.setAttribute('r', String(r)));
    const fs = 11 * worldPerPixel();                               // labels sit outside root: place by hand
    labelsG.querySelectorAll('text').forEach(tx => {
      const x = Number(tx.dataset.x), z = Number(tx.dataset.z);
      tx.setAttribute('x', String(z + fs * 0.4));
      tx.setAttribute('y', String((flip ? x : -x) - fs * 0.4));
      tx.setAttribute('font-size', String(fs));
    });
  }

  function toWorld(evt) {
    const m = root.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(evt.clientX, evt.clientY).matrixTransform(m.inverse());
    return { z: p.x, x: -p.y };                                   // path space is y = -x
  }

  function update(result) {
    scene = buildScene(result);
    index = buildIndex(scene.polylines, scene.bounds, 64);
    for (const k of LAYERS) paths[k].setAttribute('d', scene.paths[k]);
    const b = scene.bounds;
    axis.setAttribute('d', `M${b.minZ} 0L${b.maxZ} 0`);
    starts.replaceChildren(...scene.starts.map(s => el('circle', { class: 'gv-start', cx: s.z, cy: -s.x, r: 1 })));
    labelsG.replaceChildren(...scene.labels.map(l => {
      const tx = el('text', { class: 'gv-label' });
      tx.textContent = l.text; tx.dataset.x = String(l.x); tx.dataset.z = String(l.z);
      return tx;
    }));
    hi.setAttribute('d', '');
    fit();
  }

  function fit() { if (scene) { vb = viewBoxFor(scene.fitBounds, 0.06); apply(); } }
  function setAspect(oneToOne) { svg.setAttribute('preserveAspectRatio', oneToOne ? 'xMidYMid meet' : 'none'); apply(); }
  function setFlip(down) { flip = !!down; apply(); }
  function setLayerVisible(layer, on) { if (paths[layer]) paths[layer].style.display = on ? '' : 'none'; }
  function highlight(segIndexes) {
    if (!scene) return;
    hi.setAttribute('d', toPathD(segIndexes.map(i => scene.polylines[i]).filter(Boolean)));
  }

  svg.addEventListener('wheel', e => {
    if (!vb) return;
    e.preventDefault();
    const p = toWorld(e);
    if (!p) return;
    const s = Math.pow(1.0015, e.deltaY);                         // > 1 zooms out
    const py = -p.x;
    vb = { x: p.z - (p.z - vb.x) * s, y: py - (py - vb.y) * s, w: vb.w * s, h: vb.h * s };
    apply();
  }, { passive: false });

  svg.addEventListener('pointerdown', e => {
    if (!vb) return;
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, vb: { ...vb }, k: worldPerPixel(), moved: false };
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', e => {
    if (drag && drag.id === e.pointerId) {
      const dx = (e.clientX - drag.sx) * drag.k, dy = (e.clientY - drag.sy) * drag.k;
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 3) drag.moved = true;
      if (drag.moved) { vb = { ...drag.vb, x: drag.vb.x - dx, y: drag.vb.y - (flip ? -dy : dy) }; apply(); return; }
    }
    if (!scene || !onHover) return;
    const p = toWorld(e);
    if (!p) return;
    onHover(nearestSegment(index, scene.polylines, p, 6 * worldPerPixel()), p);
  });
  const end = e => { if (drag && drag.id === e.pointerId) drag = null; };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('pointerleave', () => { if (!drag && onHover) onHover(null, null); });
  window.addEventListener('resize', apply);

  return { update, fit, setAspect, setFlip, setLayerVisible, highlight };
}
```

- [ ] **Step 2: Syntax check**

Run: `node --check js/gcode/drawing.js`
Expected: no output (it parses). Behaviour is verified in the browser in Task 21.

- [ ] **Step 3: Commit**

```bash
git add js/gcode/drawing.js
git commit -m "G-code viewer: SVG drawing with zoom, pan, fit, flip, layers and hover"
```

---

## Task 20: Page controller

**Files:**
- Create: `js/gcode/ui.js`

**Interfaces:**
- Consumes: `analyze`, `MAX_LINES` (Task 15); `formatDuration` (Task 13); `segmentsByLine` (Task 16);
  `createDrawing` (Task 19); `EXAMPLE_PROGRAM` (Task 15); `DEFAULT_SETTINGS` (Task 2); the page ids,
  `window.GV_I18N`, `window.gaEvent` and the `gv:lang` event (Task 18).
- Produces: the working page. GA events: `gcode_file_loaded {lines, cycles, control}`, `gcode_example_loaded`,
  `gcode_print`, `gcode_cta_click`, `gcode_survey {answer}`. No program text or file names are sent.
- localStorage keys: `aidedcam-gv-settings` (settings, including the UI-only `flipX`) and
  `aidedcam-gv-survey`.

- [ ] **Step 1: Write the module**

`js/gcode/ui.js`:

```js
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
  try { return { ...DEFAULT_SETTINGS, flipX: false, ...JSON.parse(lsGetSafe(SETTINGS_KEY) || '{}') }; }
  catch (e) { return { ...DEFAULT_SETTINGS, flipX: false }; }
}

const state = { text: '', fileName: '', result: null, byLine: new Map(), warnLines: new Set(),
  hoverLine: null, editing: false, settings: loadSettings(), paint: () => {} };

function saveSettings() { lsSetSafe(SETTINGS_KEY, JSON.stringify(state.settings)); }
function lang() { return document.documentElement.lang || 'el'; }
function t(key, params = {}) {
  const all = window.GV_I18N || {};
  const s = (all[lang()] && all[lang()][key]) ?? (all.en && all.en[key]) ?? key;
  return String(s).replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? ''));
}
function ga(name, params) {
  try { if (typeof window.gaEvent === 'function') window.gaEvent(name, params || {}); } catch (e) { /* never break the tool */ }
}

const drawing = createDrawing($('gvSvg'), { onHover: hoverFromDrawing });

// ---- pipeline ----
let timer = null;
function schedule() { clearTimeout(timer); timer = setTimeout(run, 200); }

function run() {
  const r = analyze(state.text, state.settings);
  state.result = r;
  state.byLine = segmentsByLine(r.segments);
  state.warnLines = new Set(r.warnings.map(w => w.line));
  const milling = r.warnings.some(w => w.id === 'milling');
  showBanner(r.tooLarge ? t('gv.banner.toolarge', { lines: r.lines.toLocaleString(), max: MAX_LINES.toLocaleString() })
    : milling ? t('gv.check.milling') : '');
  showDetectedControl();
  drawing.update(r);
  renderCode();
  renderTime();
  renderChecks();
  renderPrintHead();
  $('gvDropHint').hidden = state.text.trim().length > 0;
}

function showBanner(text) { const b = $('gvBanner'); b.textContent = text; b.hidden = !text; }

// "Automatic" names the control it detected, so a wrong guess is visible (spec §4).
function showDetectedControl() {
  if (state.result) $('gvControl').options[0].textContent = `${t('gv.set.auto')} (${state.result.control === 'haas' ? 'Haas' : 'Fanuc'})`;
}

function loadText(text, source, name = '') {
  state.text = String(text);
  state.fileName = name;
  if (state.editing) $('gvEditor').value = state.text;
  run();
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

function highlightLine(line, scroll) {
  state.hoverLine = line;
  drawing.highlight(line ? (state.byLine.get(line) || []) : []);
  if (scroll && line && !state.editing) {
    const box = $('gvCode');
    const top = (line - 1) * LINE_H;
    if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - LINE_H) box.scrollTop = Math.max(0, top - box.clientHeight / 3);
  }
  state.paint();
}

function hoverFromDrawing(segIndex, p) {
  const seg = segIndex === null || !state.result ? null : state.result.segments[segIndex];
  highlightLine(seg ? seg.line : null, true);
  const k = state.result && state.result.units === 'inch' ? 1 / 25.4 : 1;
  $('gvReadout').textContent = p
    ? t('gv.readout', { line: seg ? seg.line : '–', x: (2 * p.x * k).toFixed(3), z: (p.z * k).toFixed(3) })
    : '';
}

// ---- results ----
function cell(text) { const c = document.createElement('td'); c.textContent = text; return c; }

function renderTime() {
  const r = state.result;
  $('gvTimeTable').tBodies[0].replaceChildren(...r.timing.rows.map(row => {
    const tr = document.createElement('tr');
    tr.append(cell(row.tool || '–'), cell(row.label), cell(String(row.cycles)), cell(String(row.passes)),
      cell((row.cutLength / 1000).toFixed(2)), cell(formatDuration(row.cutSeconds)), cell(formatDuration(row.rapidSeconds)),
      cell(formatDuration(row.totalSeconds) + (row.incomplete ? ' *' : '')));
    return tr;
  }));
  $('gvTotal').textContent = formatDuration(r.timing.total) + (r.timing.incomplete ? ' *' : '');
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
  ul.replaceChildren(...ws.map(w => {
    const li = document.createElement('li');
    li.className = `gv-w is-${w.severity}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gv-w-line';
    btn.textContent = `${t('gv.checks.line')} ${w.line ?? '–'}`;
    btn.addEventListener('click', () => { if (!w.line) return; if (state.editing) toggleEdit(); highlightLine(w.line, true); });
    const msg = document.createElement('span');
    msg.textContent = t(`gv.check.${w.id}`, w.params);
    li.append(btn, msg);
    return li;
  }));
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
$('gvFile').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0];
  if (f) loadText(await f.text(), 'file', f.name);
  e.target.value = '';
});
$('gvExample').addEventListener('click', () => loadText(EXAMPLE_PROGRAM, 'example', 'example.nc'));
$('gvPaste').addEventListener('click', async () => {
  try { const txt = await navigator.clipboard.readText(); if (txt) loadText(txt, 'paste'); }
  catch (e) { showBanner(t('gv.paste.fail')); }
});
document.addEventListener('paste', e => {
  if (state.editing || (e.target.closest && e.target.closest('input, textarea, select'))) return;
  const txt = e.clipboardData && e.clipboardData.getData('text');
  if (txt) { e.preventDefault(); loadText(txt, 'paste'); }
});
const main = document.querySelector('.gv');
main.addEventListener('dragover', e => { e.preventDefault(); main.classList.add('gv-dragging'); });
main.addEventListener('dragleave', e => { if (!main.contains(e.relatedTarget)) main.classList.remove('gv-dragging'); });
main.addEventListener('drop', async e => {
  e.preventDefault();
  main.classList.remove('gv-dragging');
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) loadText(await f.text(), 'file', f.name);
  else { const txt = e.dataTransfer.getData('text'); if (txt) loadText(txt, 'paste'); }
});

// ---- drawing controls ----
$('gvFit').addEventListener('click', () => drawing.fit());
$('gvAspect').addEventListener('change', e => drawing.setAspect(e.target.checked));
document.querySelectorAll('[data-layer]').forEach(cb => cb.addEventListener('change', () => drawing.setLayerVisible(cb.dataset.layer, cb.checked)));

// ---- settings ----
const FIELDS = [
  ['gvControl', 'control', v => v, v => v],
  ['gvSystem', 'system', v => v, v => v],
  ['gvInteger', 'integerUnit', v => v, v => v],
  ['gvXMode', 'xDiameter', v => v === 'dia', v => (v ? 'dia' : 'rad')],
  ['gvRapidX', 'rapidX', Number, v => v],
  ['gvRapidZ', 'rapidZ', Number, v => v],
  ['gvToolChange', 'toolChangeSeconds', Number, v => v],
  ['gvCorrection', 'correctionPct', Number, v => v],
];
for (const [id, key, read, write] of FIELDS) {
  const input = $(id);
  input.value = write(state.settings[key]);
  input.addEventListener('change', () => {
    const v = read(input.value);
    const bad = typeof v === 'number' && (!Number.isFinite(v) || (key.startsWith('rapid') && v <= 0) || (key === 'toolChangeSeconds' && v < 0));
    if (bad) { input.value = write(state.settings[key]); return; }
    state.settings[key] = v;
    saveSettings();
    run();
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
  if (!state.result) return;
  renderTime(); renderChecks(); renderPrintHead();
  if (state.result.tooLarge) showBanner(t('gv.banner.toolarge', { lines: state.result.lines.toLocaleString(), max: MAX_LINES.toLocaleString() }));
  else if (state.result.warnings.some(w => w.id === 'milling')) showBanner(t('gv.check.milling'));
  showDetectedControl();
});

// First paint: show the example so the page is never empty (no GA event for this one).
loadText(EXAMPLE_PROGRAM, 'init', 'example.nc');
```

- [ ] **Step 2: Syntax check and a quick smoke test**

Run: `node --check js/gcode/ui.js`. Expected: no output.

Start `python -m http.server 8765` in the repo root (in the background) and open
`http://localhost:8765/gcode-viewer.html`.
Expected:
- the example program is listed on the left, and the drawing shows green feeds, dashed amber rapids,
  slate G71/G76 passes and the grey profile;
- the time table has three rows (OD ROUGHING, OD FINISHING, THREAD M24X2);
- checks show "No issues found";
- no console errors.

Stop the server.

- [ ] **Step 3: Commit**

```bash
git add js/gcode/ui.js
git commit -m "G-code viewer: page controller (program panel, pipeline, tables, checks, print, survey)"
```

---

## Task 21: Browser verification and performance

**Files:**
- Create: `_tests/gcode/perf.mjs`
- Create (git-ignored): `_tests/private/perf-50k.nc`, written by the script

**Interfaces:**
- Consumes: the whole page and `analyze`, `buildScene`, `buildIndex`.

- [ ] **Step 1: Write the performance script**

`_tests/gcode/perf.mjs`. It is not picked up by `node --test`, because the file name has no `.test.`:

```js
// Generates a 50,000-line CAM-style lathe program and times the pure pipeline. Run: node _tests/gcode/perf.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { analyze } from '../../js/gcode/analyze.js';
import { buildScene, buildIndex } from '../../js/gcode/render.js';

const lines = ['G21 G99', 'G50 S3000', 'G96 S200 M3', 'T0101', 'G0 X100 Z2'];
let z = 0;
for (let i = 0; lines.length < 50000; i++) {
  const x = 60 + 20 * Math.sin(i / 50);
  z -= 0.01;
  lines.push(i % 25 === 0 ? `G2 X${x.toFixed(3)} Z${z.toFixed(3)} R40` : `G1 X${x.toFixed(3)} Z${z.toFixed(3)} F0.1`);
}
lines.push('M30');
const text = lines.join('\n');
mkdirSync(new URL('../private/', import.meta.url), { recursive: true });
writeFileSync(new URL('../private/perf-50k.nc', import.meta.url), text);

const t0 = performance.now();
const r = analyze(text);
const t1 = performance.now();
const sc = buildScene(r);
buildIndex(sc.polylines, sc.bounds, 64);
const t2 = performance.now();
console.log(`lines ${r.lines} · segments ${r.segments.length} · analyze ${(t1 - t0).toFixed(0)} ms · scene+index ${(t2 - t1).toFixed(0)} ms`);
if (t2 - t0 > 1500) { console.error('Too slow: over 1500 ms for 50k lines'); process.exit(1); }
```

- [ ] **Step 2: Run it**

Run: `node _tests/gcode/perf.mjs`
Expected: one line of timings, under 1500 ms total, exit code 0. Also run `git status --short`
and confirm `_tests/private/perf-50k.nc` is **not** listed.

- [ ] **Step 3: Verify in a real browser (Playwright MCP)**

Serve the repo with `python -m http.server 8765` started in the background, then:

1. Navigate to `http://localhost:8765/gcode-viewer.html`. Evaluate
   `document.querySelector('.gv-pass').getAttribute('d').length > 0` → `true`, and
   `document.querySelectorAll('#gvTimeTable tbody tr').length` → `3`.
2. Hover: evaluate
   `document.querySelector('.gv-line[data-line="11"]').dispatchEvent(new PointerEvent('pointerover', {bubbles:true}))`,
   then `document.querySelector('.gv-hi').getAttribute('d').length > 0` → `true`.
3. Click the EN button, then IT: the `<h1>` text changes, and the checks line reads "No issues found." /
   "Nessun problema rilevato.".
4. Resize to 375×800. Evaluate `document.documentElement.scrollWidth <= 375` → `true`. Take a
   screenshot and check the drawing comes first, then the program.
5. Emulate print media and take a screenshot: the logo header and footer are visible, and the editor,
   settings, nav, CTA and consent banner are hidden.
6. Upload `_tests/private/perf-50k.nc` through `#gvFile` (file upload tool). Within 2 s the table
   shows T0101, and hovering the drawing still updates the readout.
7. Console messages: no errors.
8. Stop the server. Leave Playwright snapshot files in `.playwright-mcp/`; they are outside the repo.

Record the outcome of each numbered check in the PR description.

- [ ] **Step 4: Commit**

```bash
git add _tests/gcode/perf.mjs
git commit -m "G-code viewer: 50k-line performance script and browser checks"
```

---

## Task 22: Local cross-check with real programs (never committed)

**Files:**
- Create (git-ignored, local only): the sample programs and one local test file, all under `_tests/private/`.

- [ ] **Step 1: Copy the local sample programs into the ignored folder**

Copy them from their local source (outside this repo) into `_tests/private/`, then run `git status --short`.
Expected: nothing under `_tests/private/` appears. If it does, **stop**: fix `.gitignore` before going on.

- [ ] **Step 2: Write the local test**

A `*.test.mjs` file in `_tests/private/` that runs `analyze()` on each sample and checks: the pass count of each
G71/G72 cycle against values worked by hand from the desktop-CAM planner, the tool list and labels, and the
warnings a manual review of the programs found (for example `tool-zero` and `skipped`). The expected values stay
in that local file; they are not written into this plan.

- [ ] **Step 3: Run it**

Run: `node --test "_tests/private/*.test.mjs"`
Expected: all local tests PASS. Then compare the G71/G72 pass lines in the desktop-CAM viewport with the viewer's
drawing of the same program. They must coincide. If any expectation fails, find out whether the viewer or the hand
arithmetic is wrong, fix the viewer through a normal task with a public synthetic test, and re-run.

- [ ] **Step 4: Nothing to commit**

Run: `git status --short`. Expected: clean except for work belonging to other tasks. The private
material stays local.

---

## Task 23: Launch

**Files:**
- Modify: `index.html` (nav link, footer link, `nav.freetools` translations ×3)
- Modify: `sitemap.xml`, `llms.txt`
- Create: `_docs/gcode-viewer/timing-check.md`
- Modify (only if the timing check calls for it): `js/gcode/settings.js`

- [ ] **Step 1: Link the tool from the homepage**

This is the default placement. Aris may move it (spec §14 question 4).

In `index.html`, directly after the line
`<li><a href="#giati" class="nav-link" data-i18n="nav.whyus">Γιατί Εμείς</a></li>` (currently line 1124), add:

```html
        <li><a href="gcode-viewer.html" class="nav-link" data-i18n="nav.freetools">Δωρεάν εργαλεία</a></li>
```

In the footer `<div class="footer-links">`, after the `#giati` link, add:

```html
            <a href="gcode-viewer.html" data-i18n="nav.freetools">Δωρεάν εργαλεία</a>
```

In the translations, directly after each `'nav.whyus': …,` line (el, en, it), add:

```js
        'nav.freetools': 'Δωρεάν εργαλεία',
```
```js
        'nav.freetools': 'Free tools',
```
```js
        'nav.freetools': 'Strumenti gratuiti',
```

Check at 1280 px and 375 px that the nav still fits, or collapses into the existing mobile menu.

- [ ] **Step 2: Sitemap and llms.txt**

In `sitemap.xml`, before `</urlset>`, add the entry below. `lastmod` is the day you deploy, in
YYYY-MM-DD form.

```xml
  <url>
    <loc>https://www.aidedcam.com/gcode-viewer.html</loc>
    <lastmod>2026-10-01</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
```

In `llms.txt`, after the "Built so far" section, add:

```markdown
## Free tools
- Lathe G-code viewer (https://www.aidedcam.com/gcode-viewer.html): runs in the browser, nothing is uploaded; draws the passes Fanuc canned cycles G70-G76 and G90/G92/G94 generate, estimates cycle time per tool, and flags common programming mistakes. Greek, English, Italian.
```

- [ ] **Step 3: Real-machine timing check (spec §10.7)**

Create `_docs/gcode-viewer/timing-check.md` with the table below. Ask Aris which shop can run 2–3
programs (spec §14 question 1), then fill in the real measurements:

```markdown
# Real-machine timing check

| Program (synthetic or shop-approved) | Machine / control | Measured cycle time | Viewer estimate | Difference % |
|---|---|---|---|---|

Decision: default correction % = (average difference, rounded to 5 %). Recorded by: <name>, <date>.
```

If the average difference is more than 5 %, set `correctionPct` in `js/gcode/settings.js` to that
value, update the `DEFAULT_SETTINGS` assertion in `_tests/gcode/dialects.test.js` if one is added for
it, and run `node --test "_tests/gcode/*.test.js"`.

- [ ] **Step 4: Bump cache-busting and run everything**

Set `?v=` on `css/tools.css` and `js/gcode/ui.js` in `gcode-viewer.html` to the deploy date. Then run:

```bash
node --test "_tests/gcode/*.test.js"
node _tests/gcode/perf.mjs
```

Expected: all PASS; perf under 1500 ms.

- [ ] **Step 5: Commit, then hand over for review. Do not merge.**

```bash
git add index.html sitemap.xml llms.txt _docs/gcode-viewer/timing-check.md gcode-viewer.html js/gcode/settings.js
git commit -m "G-code viewer: homepage link, sitemap, llms.txt, timing record"
```

Merging to `main` publishes the site (GitHub Pages serves `main`), so **stop here and ask Aris**.
With his OK: push `feat/gcode-viewer`, open a PR with the Task 21 check results, merge, then verify
the GA events in GA4 DebugView (accept cookies first) and open the live page on a phone.
