# Milling G-code viewer: design spec

Date: 2026-09-27 · Status: draft for Aris's review · Location: `_docs/`. Jekyll skips `_` folders, so this is not
served on www.aidedcam.com, but anyone who can see the GitHub repo can read it. The repo is **public**: no client
names and no real programs in any committed file (§11).

This spec extends the live lathe viewer (`2026-09-26-gcode-viewer-design.md`, "the lathe spec"). Anything not
restated here follows the lathe spec: site pattern, privacy, no gate, CTA, survey, print conventions, launch
routine.

## 1. Why this exists

More shops mill than turn. A milling viewer widens the audience of the free tools, and Aris expects it to bring more
visitors ("this might lead to people join our page").

**What sets it apart.** NC Viewer (ncviewer.com) already draws milling toolpaths in 3D for free, so the drawing on
its own would be a me-too feature. This viewer adds what NC Viewer doesn't:

- **Drilling cycles expanded.** G73/G74/G76/G81–G89 are drawn as the pecks, dwells and retracts the control
  really makes.
- **Cycle time per tool.** The tool-change time counts at M6.
- **Program checks.** Missing G43, spindle off, compensation left on, rapid into material, arc radius errors, and
  more.
- **GR/EN/IT, and a printable report.**

### Decisions already made (Aris, 2026-09-27)

| Topic | Decision |
|---|---|
| Controls | Fanuc/Haas ISO G-code, 3-axis vertical machining. The same family as the lathe tool: Fanuc, Haas, Mitsubishi, Brother, GSK and most CAM posts. |
| Drawing | Interactive 3D (three.js, self-hosted). The print report uses a snapshot of the current view. |
| Pages | A separate milling page with its own URL and title, plus a `free-tools.html` index. The nav's "Free tools" points at the index. |
| File size | Up to about 1M lines, analysed in a Web Worker with compact typed arrays. |
| Architecture | Approach A: a shared core, the lathe tool unchanged in behaviour, and a separate milling engine and view. |
| Playback | Keep the playback slider (draws the program up to a point). |
| Scope | Viewer, not simulator: no stock, no material removal, no tool shapes. |
| Price | Completely free, no gate, no form (as the lathe tool). |

## 2. User experience

**URL:** `/milling-gcode-viewer.html`. Same nav, footer, consent banner, GR/EN/IT and GA pattern as the lathe page.

| | Heading | Promise |
|---|---|---|
| EN | Milling G-code viewer | See every move in 3D, drilling cycles included, and how long each tool takes. |
| GR | Προβολή G-code φρέζας | Final copy written idiomatically, not word for word. |
| IT | Visualizzatore G-code per fresa | Final copy written idiomatically, not word for word. |

**Top bar:** Open file · drop a file anywhere · paste · **Load example** · Print / Save as PDF. **Settings:**
- rapid rate X, Y, Z (default 30,000 mm/min each);
- tool-change seconds (default 5);
- correction % (default 0);
- numbers without a decimal point mean mm / µm (as the lathe);
- peck clearance for G73/G83 (default 0.5 mm; see §5).

There is no diameter/radius or G-code-system setting; those are lathe-only.

**Main area** (the lathe layout; stacked on phones with the drawing first):

- **Program panel.** Shared with the lathe: a virtualised line list, hover and click-to-pin in both directions,
  Edit mode, and the focus ring.
- **3D view:**
  - **Toolbar:** Fit · Top · Front · Right · Iso · − · +.
  - **Mouse:** left-drag orbits, right-drag (or Shift+drag) pans, the wheel zooms about the cursor.
  - **Touch:** one finger orbits, two fingers pinch-zoom and pan. A tap selects the nearest move.
  - **Keyboard:** `+` / `-` zoom, the arrow keys orbit, and `F` fits, when the view has focus.
  - **Phones:** the view height is capped at `min(50vh, 380px)`, so the page can still scroll.
  - **Axis triad and scale:** a small XYZ triad in a corner, and the bounding-box dimensions of the cutting
    moves shown under the view (e.g. "X 120.00 × Y 80.00 × Z 25.00 mm").
  - **Layers**, one toggle per legend entry: feed moves · rapids · drilling-cycle moves · error markers.
  - **Work offsets:** when the program uses more than one work offset (G54–G59, G54.1 P), each offset's moves get
    a slight tint, with a legend line per offset.
- **Playback.** A slider and a play/pause button below the view. The drawing shows the program up to that point in
  execution order, and the program panel follows the current line. Speed is about 2 s per 10,000 moves; the
  slider can be dragged.
- **Time table.** One row per tool change (M6):
  - **Columns:** T, label, cycles, cut length, cutting time, rapid time, total.
  - **Label rule:** the lathe rule, with M6 in place of the T call. The M6 block's own comment first, otherwise the
    last comment before it, otherwise the first comment after it; never crossing another M6 or the O/% line.
  - **Click a row** to show only that tool's moves; click again for all.
  - Then the program total and the tool-change time. Labelled **planning estimate**.
- **Program checks.** Warnings, each linking to its line (§6).
- **CTA panel:** "Want this built around your own machines and post-processors? We build CAM software like this."
- **Optional survey:** "How do you write milling programs?" At the machine / by hand / from CAM.

**Notes on the page:**
- Privacy: "Your program never leaves your computer."
- "Viewer, not a simulator: verify on your machine."
- "Paths are drawn as programmed: tool length and radius compensation are not applied."
- "Drawn in program coordinates: work offset values are not known."

**Lathe ↔ milling handoff.** When the lathe page detects a milling program (it already fires the `milling` check
on G17 or Y words), the banner offers **Open in the milling viewer**. The milling page offers the reverse when a
program has **no Y word anywhere** and at least one of: G70/G71/G72 with P and Q; G96; G50 with S; G18 as the only
plane code.
- The program travels in `sessionStorage` (key `aidedcam-gv-handoff`, up to about 4 MB), so it never leaves the
  browser.
- The target page reads the key once, deletes it, and loads the program.
- Larger files show "open the file again on the other viewer".

**`free-tools.html`** (new):
- A short page in the editorial style, GR/EN/IT.
- One card per tool: Lathe G-code viewer and Milling G-code viewer, each with a one-line promise and an Open
  button.
- The soft CTA at the end.
- Nav and footer "Free tools" point here instead of the lathe viewer. Each viewer's header gets a small link to the
  other viewer next to "Home".

## 3. Architecture

### 3.1 Files

| Path | Published | Purpose |
|---|---|---|
| `milling-gcode-viewer.html` | yes | Page shell: inline site keys (nav, consent, footer, mill headings), consent, GA |
| `free-tools.html` | yes | Tools index |
| `js/gcode/i18n-viewer.js` | yes | **Classic script** (not a module) defining `window.GV_VIEWER_I18N = { el, en, it }`: the viewer strings shared by both viewers. Each page loads it before its inline script and merges it into `translations`. |
| `js/gcode/shell/program-panel.js` | yes | Shared: virtualised line list, hover, pin, edit mode (moved out of the lathe `ui.js`) |
| `js/gcode/shell/loader.js` | yes | Shared: open, drop anywhere, paste, the windows-1253 fallback, size guard, handoff read/write |
| `js/gcode/shell/i18n.js` | yes | Shared: `t()`, locale number formatting, `gv:lang` wiring |
| `js/gcode/shell/results.js` | yes | Shared: time-table and checks-list rendering, the "–" and "≥" rules |
| `js/gcode/shell/settings-store.js` | yes | Shared: persist only the listed fields, per viewer key |
| `js/gcode/ui.js` | yes | Lathe page controller, now built on `shell/*`; behaviour unchanged |
| `js/mill/machine.js` | yes | 3D modal state and motion (§4) |
| `js/mill/arcs.js` | yes | G17/G18/G19 arcs from I/J/K or R, helical Z, chord sampling, radius check |
| `js/mill/cycles.js` | yes | Drilling cycles (§5) |
| `js/mill/subprograms.js` | yes | O-block index, M98/M97/M99 call stack, loop guard |
| `js/mill/time.js` | yes | Seconds per move, per M6 row, total (§7) |
| `js/mill/checks.js` | yes | Program checks (§6) |
| `js/mill/analyze.js` | yes | Orchestrator: text → `MillResult` (§3.3). Pure, Node-testable. |
| `js/mill/worker.js` | yes | Web Worker wrapper around `analyze` (module worker) |
| `js/mill/scene.js` | yes | Pure: result → per-layer vertex arrays, execution-order indices, line index, pick grid |
| `js/mill/view3d.js` | yes | three.js view: layers, camera presets, highlight, playback, isolation, snapshot |
| `js/mill/ui.js` | yes | Milling page controller on `shell/*` |
| `js/mill/example.js` | yes | Synthetic example program (§2) |
| `js/vendor/three/` | yes | Pinned three.js release: `three.module.min.js`, `OrbitControls.js`, `LICENSE` (MIT) |
| `css/tools.css` | yes | Extended: 3D view, toolbar, playback, index cards; mill layer colours |
| `_docs/gcode-viewer/mill-cycles/*.md` | no | Research notes (§5.3) |
| `_tests/gcode/*.test.js`, `_tests/mill/*.test.js` | no | `node --test` suites |
| `_tests/private/` | no, git-ignored | Real programs for local cross-checks, and the generated 1M-line perf file |

Plain ES modules, no bundler, no npm dependencies. `?v=YYYYMMDD` cache-busting on every shared asset, including
the worker URL and three.js.

### 3.2 Pipeline

Main thread: read the file (UTF-8, windows-1253 fallback), then `worker.postMessage({ type: 'analyze', text,
settings })`.

The worker runs:
1. Split into lines.
2. Index the O-blocks and N numbers (for M98/M97).
3. **Stream** each executed line through the shared `parseLine` (`js/gcode/parse.js`, unchanged), then through
   `machine`, `cycles` and `subprograms`.
4. Append each move to growable typed arrays.
5. Run `time` and `checks`.

It then posts `{ type: 'result', result }` with its buffers in the transfer list, and a
`{ type: 'progress', done, total }` message every 50,000 lines.

Back on the main thread, `scene.js` turns the result into layer buffers, and `view3d.js` draws them. The program
panel and the result tables use the shared shell. A new load terminates the running worker and starts a fresh one.

### 3.3 Data contracts

Internal unit: mm (G20 is converted on input and displayed in inches). Coordinates are program coordinates of the
active work offset, tool tip, uncompensated.

```js
MillResult = {
  lines, units: 'mm' | 'inch', tooLarge,
  moves: {                                  // one entry per straight chord; arcs pre-sampled into chords
    count,
    pos:    Float32Array,                   // 6 floats per move: x0 y0 z0 x1 y1 z1
    kind:   Uint8Array,                     // 0 rapid, 1 feed, 2 cycle-feed, 3 cycle-rapid
    line:   Uint32Array,                    // source line (1-based) that produced it
    row:    Uint16Array,                    // time-table row (M6 occurrence) index
    wofs:   Uint8Array,                     // work-offset index (0 = G54 or none)
    seconds: Float32Array,                  // filled by time.js
  },
  lineIndex: { offsets: Uint32Array /* lines+2 */, moves: Uint32Array /* count */ },  // CSR: line → moves
  bounds, cutBounds,                        // { min: [x,y,z], max: [x,y,z] }
  rows: [{ tool, label, firstLine, moveStart, moveEnd, cycles, cutLength, cutSeconds, rapidSeconds,
           totalSeconds, incomplete }],
  total, incomplete, workOffsets: ['G54', ...],
  warnings: [{ line, id, severity, params }],
  markers:  [{ x, y, z, line, id }],
  stats: { skipped, subprogramCalls },
}
```

- A time-table row covers one contiguous range of moves, `moveStart..moveEnd`, in execution order, because
  subprogram calls are expanded in place. That makes tool isolation and playback plain draw ranges.
- Per layer, `scene.js` keeps the execution indices of its moves, sorted. The count of a layer's moves before
  execution index N is then a binary search.
- `lineIndex` is a CSR map: one line can own many moves (arcs, cycles, lines inside a subprogram called several
  times).

### 3.4 Performance

Targets, on a synthetic 1M-line 3D surfacing program generated into `_tests/private/`:

| Measure | Target |
|---|---|
| `analyze` in Node | < 4 s |
| File drop to first frame in Chrome on the dev laptop | < 6 s, with the page responsive throughout (progress bar) |
| Orbiting at 1M moves | smooth (≥ 30 fps) |
| Hover from the drawing | < 50 ms after the pick grid rebuild (see below) |
| Tab memory | < 500 MB |

- **Hover index:** a screen-space pick grid is rebuilt about 150 ms after the camera stops moving. It is not
  raycasting, which would be too slow at 1M moves.
- **Hard cap:** 1.5M lines or 60 MB. Above it, the "too large" banner.
- **Worker timeout:** 20 s. On timeout, the worker is terminated and the error banner shown.

## 4. Parsing and interpretation (`machine.js`)

Uses the shared `parseLine`. Macro and expression lines are skipped with the lathe's `skipped` info.

Modal state:
- **Motion:** G0/G1/G2/G3; the cycle group (G73/G74/G76/G81–G89, G80).
- **Plane:** G17/G18/G19.
- **Positioning:** G90/G91.
- **Units:** G20/G21.
- **Feed mode:** G94 (default) / G95.
- **Work offset:** G54–G59, G54.1 P1–P48, Haas G154 P1–P99 and G110–G129. Each is only an index: the values
  aren't known.
- **Local shift:** G52 X Y Z (applied).
- **Coordinate set:** G92 X Y Z (applied, relative to the current position).
- **Compensation:** G43/G44 H (state only; G49 cancels) and G40/G41/G42 D (state only).
- **Return level:** G98/G99.
- **Tool and spindle:** T (preselect), M6 (tool change), S, M3/M4/M5.
- **Coolant M8/M9:** ignored.

Motion:
- **Arcs:**
  - In the active plane. The centre comes from I/J/K (incremental from the start) or R; negative R means the
    arc over 180°.
  - A full circle is programmed with I/J/K and no end change.
  - The linear axis of the plane moves during the arc, making it helical.
  - Arcs are sampled into chords with a chord error of 0.01 mm, and at most 256 chords per arc.
- **G28 / G30 / G53 moves:** the position becomes unknown, and no move is drawn or timed. The next move that sets
  every axis starts a new path. This is the lathe's "unknown start" rule in 3D.
- **Start position:** unknown until X, Y and Z are all known. Moves before that are not drawn.
- **Subprograms (`subprograms.js`):**
  - `M98 P<o>` with repeat `L<n>` (Haas) or `K<n>`, or the older `P<nnnn><oooo>` form (up to 4 repeat digits
    before a 4-digit O number): the research note fixes the accepted forms.
  - `M97 P<n>` (Haas): a jump to N<n> in the same file.
  - `M99` returns to the caller. In the main program, `M99` ends it, with an info note that the control would loop.
  - An O-block missing from the file raises a `sub-missing` warning and the call is skipped.
  - Nesting over 4 levels, or a call loop, raises `sub-loop` (error) and stops that call.
- **Not interpreted**, each with a warning, the line still shown, and the row's time set to "–":
  - rotary axes A/B/C: moves drawn using X/Y/Z only;
  - G68/G69 rotation, G51/G50 scaling, G51.1/G50.1 mirror;
  - G10 offset writes;
  - G65/G66 macro calls;
  - polar G16;
  - drilling in G18/G19 (horizontal drilling).

## 5. Drilling cycles (`cycles.js`)

### 5.1 Behaviour

Common frame, G17 only:
- **Initial level:** the Z when the cycle mode starts. A new cycle word in cycle mode keeps it.
- **R:** the R plane. In G91, R is measured from the initial level, and Z from R.
- **Holes:** each block in cycle mode with X/Y (or the cycle block itself) is a hole. Rapid to X/Y at the current
  level, rapid to R, run the cycle's moves, return to the initial level (G98) or to R (G99).
- **Repeats:** `K<n>` (Fanuc) or `L<n>` (Haas) repeats the hole n times; in G91 at incremental X/Y steps. `K0`/`L0`
  stores the cycle without drilling.
- **Cancel:** G80, or any G0–G3, cancels.

| Cycle | Moves per hole |
|---|---|
| G81 | feed to Z · rapid out |
| G82 | feed to Z · dwell P · rapid out |
| G83 | pecks: feed by Q · rapid to R · rapid back to (last depth + clearance d) · feed on · … · rapid out |
| G73 | pecks: feed by Q · retract d (rapid) · feed on · … · rapid out |
| G84 / G74 | feed to Z at F · (spindle reverses) · feed out to R at F. Right-hand / left-hand tapping. |
| G85 | feed to Z · feed out |
| G86 | feed to Z · (spindle stop) · rapid out |
| G89 | feed to Z · dwell P · feed out |
| G76 | feed to Z · (orient, shift Q, ignored) · rapid out · **info:** shift not drawn |
| G87 / G88 | feed to Z · rapid out · **info:** approximated (back boring / manual retract) |

- **Clearance d** for G73/G83 is the peck-clearance setting (default 0.5 mm). The research note records the Fanuc
  parameter numbers (5114/5115) and the Haas settings, so a shop can match its machine.
- **Dwell P:** Fanuc reads P without a decimal point as milliseconds. The research note fixes Haas's unit and
  whether P with a decimal point is read as seconds.

### 5.2 Failures

A cycle with no R ever given raises `cycle-no-r`. G73/G83 with no Q raises `peck-no-q`. Both are errors. The
cycle's holes are drawn as a feed to Z and a rapid out, with an error marker, and the row's time shows "–", as
the lathe spec's §5.2 does for failed cycles.

### 5.3 Research notes

Before the code for each group, write `_docs/gcode-viewer/mill-cycles/<group>.md`: syntax, the move sequence,
units, Fanuc vs Haas differences, and sources. The groups are: common frame and repeats; G81/G82/G85/G86/G89;
peck G73/G83; tapping G74/G84; boring G76/G87/G88; subprograms M98/M97/M99.
- **Status VERIFIED** only where a source states the fact, preferably Fanuc 0i-MF or Haas mill documentation.
- Everything else stays **UNVERIFIED** and is added to Aris's Fanuc-manual checklist.
- The plan's code follows the note; a note that contradicts the plan stops the task for a ruling.

## 6. Program checks (`checks.js`)

Text keys `gv.check.<id>` go in the shared viewer strings, GR/EN/IT.

| id | Severity | Rule |
|---|---|---|
| `no-g43` | warn | The first Z move after an M6 happens without G43/G44 active |
| `h-mismatch` | info | G43 H number ≠ the active tool number |
| `spindle-off` | warn | A cutting move with no M3/M4 since the last M6, or after M5 |
| `no-feed` | error | A cutting move with F not yet set, or F0 |
| `comp-no-d` | warn | G41/G42 without D |
| `comp-left-on` | warn | G41/G42 still active at M6 or at the program end (M30/M02) |
| `rapid-into-material` | warn | A G0 that ends below the deepest Z cut so far. The message says it is a heuristic. |
| `arc-radius` | error | The arc end point is off the start radius by more than 0.02 mm (Fanuc alarm) |
| `cycle-no-r` | error | A drilling cycle with no R ever given |
| `peck-no-q` | error | G73/G83 without Q |
| `sub-missing` | warn | M98/M97 target not in the file |
| `sub-loop` | error | Subprogram nesting over 4, or a call loop |
| `unsupported` | info | A/B/C axes, G68, G51, G51.1, G10, G65/G66, G16, G18/G19 drilling |
| `approximated` | info | G76 shift, G87/G88 |
| `skipped` | info | Macro/expression lines (shared with the lathe) |
| `lathe-program` | info | The program looks like a lathe program; offers the handoff |

Each rule fires once per line, and `ONCE` rules fire once per program, as on the lathe.

## 7. Time model (`time.js`)

- **Rapid:** `max(|Δx|/rapidX, |Δy|/rapidY, |Δz|/rapidZ)`, so the slowest axis decides.
- **Feed:**
  - G94: the move length divided by F, in mm/min (in/min in G20). Arc length includes the helical Z.
  - G95: F × S gives mm/min. With S unknown, the row is incomplete.
- **Drilling:** each generated move by its own kind, plus dwell P. Tapping uses the programmed F both ways (G94),
  or F × S (G95).
- **Tool change:** `toolChangeSeconds` per M6, added to the total.
- **Correction %:** as the lathe.
- **Not included:** acceleration, block processing, spindle ramp-up, M-code actions, reference returns
  (G28/G30/G53).
- **Rows:** one per M6. A row with any move that can't be timed, or any `unsupported` move, is incomplete: it shows
  "–" and is left out of the total, and the total gets "≥" (the lathe rule).

## 8. Visual design

`css/tools.css` gains the mill view styles. The view's background is the white panel.

| Layer | Colour |
|---|---|
| Feed | `--gv-feed` #0d7a3e |
| Rapid | `--gv-rapid` #b8741a, dashed |
| Drilling-cycle moves (kinds 2 and 3; the cycle's rapids dashed) | `--gv-pass` #4a6f8f |
| Highlight | `--gv-hi`, drawn as thick lines for the small highlighted set |
| Error markers | `--gv-hi` crosses |

- **Colour tests:** the same contrast test covers every mill colour, at ≥ 3:1 on `#ffffff` and `#f4f3ee`.
- **Work-offset tints:** vary the lightness within the passing range. The test checks every tint.
- **Lines:** WebGL lines are 1 px, except the highlight.
- **Print:**
  - On `beforeprint`, render the current view at 2× into an `<img>` shown only in print, and restore it after
    printing.
  - Header, legend, time table, checks and footer as on the lathe.
  - Hidden: the toolbar, playback, editor, settings, nav, CTA and survey.
- **Layout:** 375 px with no horizontal scroll; a 16 px gutter.
- **Accessibility:** the view has `tabindex="0"`, an `aria-label` and the keyboard controls in §2. The toolbar is
  made of real buttons with aria-labels.

## 9. Analytics (GA4, after consent only)

| Event | Parameters |
|---|---|
| `gcode_file_loaded` | `lines`, `cycles`, `control`, **`machine`** (`lathe` / `mill`) |
| `gcode_example_loaded` | `machine` |
| `gcode_print` | `machine` |
| `gcode_cta_click` | `machine` |
| `gcode_survey` | `answer`, `machine` |
| `gcode_view_preset` | `view`: `top` / `front` / `right` / `iso` |
| `gcode_playback` | none |
| `gcode_handoff` | `from`, `to` |

The lathe page adds `machine: 'lathe'` to its existing events. As always: no program text, file names or free
text.

## 10. Testing

`node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js"`.

1. **Shared refactor first.**
   - All 155 lathe tests stay green.
   - The lathe browser checklist from the last build is re-run on the refactored page before milling code starts.
     That covers Task 21 1–12, fix B 26 and fix C 12.
   - The live page must not change behaviour.
2. **Milling engine** (synthetic programs only):
   - motion: absolute/incremental, units, unknown start, G28/G53, G52, G92;
   - arcs: I/J/K and R in all three planes, a full circle, helical, the radius check;
   - every drilling cycle: G98/G99, G91, K/L repeats, K0, cancel by G80 and by G0;
   - subprograms: M98 forms, M97, M99, missing target, loop;
   - time: closed-form cases per move kind, drilling, tapping, M6.
3. **Checks:** every id fires on a bad fixture and stays silent on a good one, with a guard that the test table's
   keys equal the checks' severity map.
4. **Scene:** the draw-range counts for playback and isolation, the CSR line index with repeated lines, and the
   pick grid.
5. **Performance:** `_tests/mill/perf.mjs` generates the 1M-line file into `_tests/private/` and checks the §3.4
   Node target.
6. **Browser (Playwright, headless Chromium with software WebGL):**
   - the example loads and the view draws; each view button moves the camera;
   - hover and pin both ways;
   - tool isolation; playback; the print snapshot;
   - the error banner; the 1M-line file loads within the target with the page responsive;
   - 375 px; keyboard; touch (pinch, tap); EL/EN/IT;
   - the handoff both ways; the tools index;
   - the network log shows only GA after consent; no console errors.
7. **Real machine before launch:** 2–3 programs on a real VMC. Compare machine time with the estimate, and set the
   default correction % from it (as the lathe §10.7).

## 11. Repo hygiene and delivery

- **Public repo:** no client names, no real programs, and no values or labels copied from real programs in
  committed files, tests, docs or commit messages. Real programs used for cross-checks stay in `_tests/private/`.
  Before any push, grep the whole branch history for client names.
- **Branch:** `feat/milling-viewer`. The shared refactor lands first and is proven on the lathe page, before any
  milling code.
- **Process:** plan, subagent-driven execution with task reviews, a final whole-branch review, then a squashed merge
  into `main`. The push, which publishes the site, is Aris's call.
- **Launch:**
  - sitemap entries for both new pages; llms.txt lists both tools;
  - GR/EN/IT `<title>` and meta description;
  - `?v=` set to the deploy date;
  - GA DebugView check;
  - print tested in Chrome and Edge.

## 12. Effort

About 3½ weeks (18 working days):

| Work | Days |
|---|---|
| Shared refactor and lathe re-verification | 2 |
| Research notes | 1.5 |
| Milling engine: machine, arcs, cycles, subprograms, time, checks | 4.5 |
| Worker, typed arrays, scene | 2 |
| 3D view: presets, hover, highlight, playback, isolation, snapshot | 4 |
| Milling page, tools index, i18n, handoff | 2 |
| Browser checks, performance and fixes | 2 |

## 13. Out of scope (v1)

Stock and material removal · tool shapes and holders · 4th/5th-axis kinematics and mill-turn · wire EDM ·
Siemens Sinumerik and Heidenhain · G68/G51/G51.1 transforms · macros and variables · compensated (G41/G42, G43)
path display · horizontal drilling (G18/G19) · any server or upload.

## 14. Open questions for Aris

1. Default rapid rates (30,000 mm/min on X, Y and Z assumed) and tool-change time (5 s assumed) for typical Greek
   VMCs.
2. Which shop can run 2–3 milling programs for the timing check?
3. Final GR/IT headings, promise and CTA copy for the milling page and the tools index.
4. A real 3D-surfacing program for a private performance cross-check (optional; the synthetic 1M-line file covers
   the target).
