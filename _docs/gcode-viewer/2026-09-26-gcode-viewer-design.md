# Lathe G-code viewer: design spec

Date: 2026-09-26 · Status: draft for Aris's review · Location: `_docs/`. Jekyll skips `_` folders, so this is not
served on www.aidedcam.com. It is still visible to anyone who can see the GitHub repo.

## 1. Why this exists

AidedCAM's first free tool on www.aidedcam.com. It follows the ncviewer.com model: a web page that
works instantly, with no install and no sign-up. It exists to bring lathe shops and programmers to
AidedCAM, and to show the kind of CAM software we build (our desktop lathe CAM).

**What sets it apart.** A general viewer draws only the lines written in the file. For Fanuc canned
cycles (G71/G72/G73/G76…) the *control* generates the passes, so a general viewer hides most of the
cutting and gets cycle time badly wrong. This viewer:

- draws the passes the control really makes;
- times them per tool, CSS-aware;
- flags common programming mistakes;
- works in GR/EN/IT.

Research behind this: `C:\Users\aris_\Desktop\Aris\reports\Greek industry needs Eyeshot tool ideas.md`
(rank 1; rivals: SmartCAD, MechSimulator, NC Viewer).

### Decisions already made (Aris, 2026-09-26)

| Topic | Decision |
|---|---|
| Scope | Lathe G-code **viewer** only. No simulator (no stock, insert or chuck model, no material removal). No milling. |
| Price | **Completely free, no gate, no form.** Everything is visible on screen; printing is free. |
| Leads | A soft CTA to contact, the brand on the printed report, anonymous GA events after consent, and an optional one-click survey. |
| Build | Approach A: a site page plus plain ES modules, no build step, a 2D SVG drawing, Node tests. |
| Controls | Fanuc and compatibles (GSK, KND…), Haas one-line forms; G-code system A, plus a mapping table for B/C. |
| Cycles v1 | G70–G76, G90/G92/G94, G32. Later: live-tool G83–G89, M98 subprograms, macros. |

## 2. User experience

**URL:** `/gcode-viewer.html`, flat, like `calculator.html`. It uses the site's nav, footer and consent
banner, GR/EN/IT, and the GA pattern (`loadGA()` / `gaEvent()` only after consent).

**Heading and promise:**

| | Heading | Promise |
|---|---|---|
| EN | Lathe G-code viewer | See the passes your control really makes, and how long they take. |
| GR | Προβολή G-code τόρνου | Final copy written idiomatically, not word for word. |
| IT | Visualizzatore G-code per tornio | Final copy written idiomatically, not word for word. |

**Top bar:**
- Open file · drop a file anywhere · paste · **Load example** (a synthetic program showing G71 + G70 + G76).
- **Settings:**
  - control: detected from the program, not chosen (read-only; see the dated note under §4 Dialects)
  - G-code system: A / B / C
  - numbers without a decimal point mean mm / µm
  - X programmed as diameter (default) / radius
  - rapid rate (one value, or X and Z separately)
  - tool-change seconds
  - correction %
  - view: X+ up / down

**Main area** (two columns on desktop, stacked on phones with the drawing first):

- **Program panel**
  - A monospace line list with line numbers.
  - Hovering or clicking a line highlights its move(s), and the other way round.
  - An **Edit** button swaps the list for a `<textarea>`. The pipeline re-runs about 200 ms after typing stops.
- **Drawing**
  - A 2D X–Z half-section: Z to the right, X up, axis labels in diameter.
  - Zoom, pan, fit, and a 1:1 aspect toggle.
  - Cycle start points are drawn as dots, with P/Q labels.
  - Layer toggles, one per legend entry:
    - feed moves
    - rapids
    - control-generated passes
    - finished profile
- **Time table**, one row per tool: T, label (the T line's own comment first; otherwise the last
  comment before it, e.g. "OD ROUGHING"; otherwise the first comment after it - neither search
  crosses another T call or the O/% line),
  cycles, passes, cut length, cutting time, rapid time, total. Then the program total and the
  tool-change time. Labelled **planning estimate**.
- **Program checks:** warnings, each linking to its line (see §6).
- **Print / Save as PDF:** browser print with a print stylesheet (see §8).
- **CTA panel:** "Want this built around your own machine and post-processor? We build lathe CAM
  software like this." → the index contact section.
- **Optional one-click survey:** "How do you write lathe programs?" At the machine / by hand / from
  CAM. It only sends a GA event and never blocks anything.

**Notes shown on the page:**
- Privacy: "Your program never leaves your computer."
- "Viewer, not a simulator: verify on your machine."
- Milling program detected (G17 or Y words): a banner saying the viewer is for lathe programs.

## 3. Architecture

### 3.1 Files (site repo `aidedcam-page`)

| Path | Published | Purpose |
|---|---|---|
| `gcode-viewer.html` | yes | Page shell in the site pattern: inline translations (`gv.*` keys), consent, GA, nav/footer |
| `css/tools.css` | yes | Tool-page layout, data colours, monospace exception, print stylesheet. Reused by later tools. |
| `js/gcode/parse.js` | yes | Text → blocks |
| `js/gcode/dialects.js` | yes | Fanuc/Haas cycle forms; G-code system A/B/C code map |
| `js/gcode/interpret.js` | yes | Modal state machine → moves and cycle calls |
| `js/gcode/geom.js` | yes | Line/arc intersections, profile shift by allowances, arc sampling |
| `js/gcode/cycles/g70.js … g76.js`, `single.js` | yes | Expand each cycle into control-generated segments |
| `js/gcode/time.js` | yes | Seconds per segment → per tool → total |
| `js/gcode/checks.js` | yes | Program checks |
| `js/gcode/render.js` | yes | SVG drawing, layers, spatial index for hover |
| `js/gcode/ui.js` | yes | Wires the editor, settings, pipeline, print, GA |
| `_docs/gcode-viewer/cycles/*.md` | no | One research note per cycle (see §5.3) |
| `_tests/gcode/*.test.js` | no | `node --test` suites and synthetic fixtures |
| `_tests/private/` | no, **git-ignored** | Local-only cross-checks with real programs (never committed) |

Everything is plain ES modules (`<script type="module">`). No bundler, no npm dependencies.
Shared assets get `?v=YYYYMMDD` cache-busting, following the site convention.

### 3.2 Pipeline

`parse → interpret → cycles → segments[] → { time, checks, render }`

Every stage except `render.js` and `ui.js` is a pure function (no DOM), testable in Node.

### 3.3 Data contracts

The internal unit is mm and X is **radius**. Diameter appears only in display and labels.
Inch programs (G20) are converted on input and displayed in inches.

```js
Block   = { line, n /* N number or null */, words: [{ letter, value, raw }], comment, raw,
            skipped /* null | 'macro' | 'expression' | 'blank' */ }

Segment = { kind: 'rapid' | 'feed' | 'arc' | 'pass' | 'retract' | 'thread' | 'dwell',
            from: { x, z }, to: { x, z },
            arc: { cx, cz, r, ccw } | null,
            line,                                   // source line that caused it
            tool,                                   // active T string or null
            cycle: { code, line, passIndex } | null,
            feed:    { mode: 'rev' | 'min', f },    // as modal at that point
            spindle: { mode: 'css' | 'rpm', s, max },
            seconds }                               // filled by time.js

Warning = { line, id, severity: 'info' | 'warn' | 'error', params }   // text from gv.check.<id>

Result  = { segments, tools: [{ t, label, firstLine }], warnings,
            stats: { lines, skipped, unknownWords } }
```

### 3.4 Performance

- Everything re-runs about 200 ms after typing stops.
- Each layer is drawn as a few merged `<path>` elements rather than one element per move.
- Hover uses a grid spatial index over the segments.
- Target: a 50,000-line CAM-posted program stays responsive.
- Hard cap: 300,000 lines, with a message.

## 4. Parsing and interpretation

**Parser:**
- Comments `( )` and `;`, `%`, `O` numbers, block delete `/`, lowercase, `.5`-style numbers.
- Unknown words are kept on the block and counted.
- Macro assignments (`#500 = 0`) and `[ ]` expressions set `skipped`, with an info note.

**Numbers without a decimal point.** For X/Z/U/W/R/F the meaning follows the setting: mm (default),
or µm as on a Fanuc with calculator-type input off. Cycle `P`/`Q` in G74/G75/G76 are **always µm
integers**, and a decimal point there raises check `pq-decimal`.

**Interpreter (system A):**
- Motion G0/G1/G2/G3, with arcs given by R or by I/K.
- X/Z absolute, U/W incremental.
- G96/G97 + S; G98/G99.
- **G50**: with S it is the spindle limit; with X/Z it is a coordinate setting.
- T calls: `T0202`, `T202`, and unknown forms such as `T3W303` are kept as-is as the tool key.
- G40/G41/G42 are recorded. Paths are drawn as programmed; nose-radius compensation is not applied.
- G20/G21, G4, G18.
- G28 is recorded, but no geometry or time (home position unknown).
- M30/M02/M99 end the program.
- M98 is not followed in v1 (check `subprogram`).

**Dialects (`dialects.js`):**
- Fanuc two-line cycle forms vs Haas/older one-line forms (e.g. `G71 P Q U W D F`, with D as the
  depth). The Haas G76 form differs and is covered by the G76 research note.
- G-code system B/C: a single mapping table to system A codes. **Verify it in a research note
  against the Fanuc manual before coding** (B renames G90/G92/G94; C renames more, including the
  repetitive cycles and inch/metric).
- "Auto" control detection: one-line vs two-line forms and characteristic words. When unsure it
  falls back to Fanuc and says so.
- **2026-09-26:** the control is detected, not chosen. Cycle forms are read from each block's words
  (Fanuc two-line vs Haas/older one-line), so a manual override had no effect and was removed.

## 5. Cycles

### 5.1 Sources of truth

- **G70–G72: port the verified desktop-CAM planners.** Do not port the Python prototype; it only
  approximates the passes.
  - `G71PassPlanner` (internal desktop-CAM source), `G72PassPlanner.cs`, `G70PassPlanner.cs`,
    `PassPlannerCommon.cs`, `ProfileExtractor.cs`
  - Contract: `cycle-visual-gcode-fidelity.md` (internal research note) (chained passes, 45° R retract as a feed,
    rapid return)
  - Semantics: `cycle-g70/g71/g72-research.md` (internal research note)
- **All other cycles: a research note is written and checked first** (§5.3).

### 5.2 Behaviour summary

| Cycle | Reads (Fanuc two-line) | Generates |
|---|---|---|
| G71 | `U`=depth (**radius**), `R`=retract · `P Q U`(X allowance, **diameter**) `W`(Z allowance) `F` | Z-parallel passes down to the profile shifted by (U/2, W). 45° retract (feed), rapid back, chained. Return to the start point. OD/ID from the start point's side. |
| G72 | `W`=depth, `R` · `P Q U W F` | The same pattern turned 90°: X-parallel passes stepping in Z. |
| G70 | `P Q` | Re-traces P…Q at the F/S *inside* the profile blocks, then rapids back to the start point. |
| G73 | `U W` (total relief), `R` (number of passes) · `P Q U W F` | The profile repeated R times, stepping from the relief down to the allowance. |
| G74 | `R` (retract) · `X/U Z/W P Q R F` | Pecks along Z. With X: repeated grooves stepped by P. |
| G75 | `R` · `X/U Z/W P Q R F` | Pecks along X, stepped in Z by Q. |
| G76 | `P`(finish passes · chamfer · angle) `Q`(min depth) `R`(finish allowance) · `X/U Z/W R`(taper) `P`(height) `Q`(first depth) `F`(lead) | Thread passes at depths d₁·√n (never less than the minimum), infeed along the flank, finish passes, chamfer pull-out. |
| G90 / G94 | `X/U Z/W R`(taper) `F`; modal repeats | 4 moves per line: rapid in, cut, cut out, rapid back. |
| G92 / G32 | `X/U Z/W R F`(lead) | A box thread pass / a single thread move. |

Cycles that are unsupported or that fail (e.g. the P/Q block is not found) are drawn as written,
with an error marker; their time shows "–".

**Type II pocket profiles.** Drawn, and flagged "verify on your machine": the pass order on pockets
varies by control.

### 5.3 Research note per cycle

Each file is `_docs/gcode-viewer/cycles/<code>.md` and holds:

- syntax (Fanuc two-line, Haas one-line), with a parameter table giving units (radius/diameter/µm);
- the exact motion sequence, including retracts and returns;
- **one hand-worked example**: a small program plus the expected pass count and the first/last pass
  coordinates, which becomes that cycle's unit test;
- sources (Fanuc manual sections, Haas service pages).

This follows the desktop-CAM rule: validate from the documentation, never guess.

## 6. Program checks (`checks.js`)

Start from `OpValidator` (internal desktop-CAM source) and the internal desktop-CAM research notes.

| id | Severity | Rule |
|---|---|---|
| `g96-no-g50` | warn | G96 active with no earlier G50 S limit: the spindle can overspeed near the centre |
| `type1-monotonic` | error | Type I profile (P block has X only) is not monotonic (Fanuc alarm 064) |
| `p-block` | error | The P block has Z but no X (alarm 065) |
| `q-block-corner` | error | A chamfer or corner in the Q block (alarm 069) |
| `tnrc-scope` | warn | G41/G42 is engaged outside P…Q, or not cancelled by the end (internal G71 research §1.6) |
| `start-in-material` | warn | The cycle start point is not outside the profile plus allowances |
| `allowance-vs-depth` | info | The finishing allowance (radius) is not smaller than the depth of cut |
| `pq-decimal` | warn | G74/G75/G76 `P`/`Q` written with a decimal point (these must be µm integers) |
| `css-threading` | warn | G96 is active during G32/G92/G76 |
| `no-feed` / `no-speed` | warn | A feed move with no F; G96/G97 with no S |
| `tool-zero` | warn | Cutting under T0 / offset 0 |
| `subprogram` | info | M98 call not followed (v1) |
| `skipped` | info | Macro or expression lines skipped (count) |
| `milling` | info | Looks like a milling program (G17, Y words) |

## 7. Time model (`time.js`)

It starts from `CycleTimeEstimator` (internal desktop-CAM source), with three improvements.

Segment kinds `feed`, `arc`, `pass` and `retract` are timed as feed moves. The G71/G72 45° retract is
a feed, per the desktop-CAM fidelity contract. `rapid` is timed as a rapid, `thread` at lead × n, and
`dwell` from its value.

**Feed moves:**
- G98: t = L / F.
- G99: t = L / (F · n).
- G97: n = S.
- G96: n = min(G50 limit, Vc·1000 / (π·D)). This is **integrated along the move** instead of using
  the average diameter. Straight radial moves use the closed form: above the clamp radius,
  t = π(r₁² − r₂²) / (F·Vc·1000); below it, t = Δr / (F·n_max). Arcs and tapers are split into steps.

**Rapids:** t = max(|Δr| / V_x, |Δz| / V_z). This assumes independent axis moves (non-interpolated G0).
The default is 20,000 mm/min on both axes, as in our desktop CAM.

**Other moves:**
- Threading passes: lead × n.
- Dwell: G4 X/U in seconds, P in ms.
- Tool change: a setting (default 3 s per T change; to be confirmed).

**Correction %** (default 0): multiplies the total. It is saved per visitor, so a shop can calibrate
against one real run.

**Not modelled, and listed on screen:**
- acceleration, deceleration and corner slowdown;
- spindle ramp-up;
- block processing time;
- M-code actions;
- G28 returns.

**Display:** `m:ss`, or `h:mm:ss` past an hour.

## 8. Visual design (extension of the site system)

The base is `css/editorial.css`: tokens, paper background, hairline grid lines, and Barlow (Greek
via Roboto) + Inter.

**Additions in `css/tools.css`:**

- **Data colours for the drawing:**

  | Element | Colour |
  |---|---|
  | Feed | `--accent` #0d7a3e |
  | Rapid | amber, about #b8741a, dashed |
  | Control-generated passes | slate, about #4a6f8f |
  | Finished profile | `--muted` #6b6a60 |
  | Start point / labels | `--ink` |

  Before launch, validate each colour at **≥ 3:1 against `--paper`** (dataviz validator). Adjust the
  hex values if any fails.
- **Monospace exception**, only in the program panel:
  `ui-monospace, 'Cascadia Mono', Consolas, 'Courier New', monospace`. This covers Greek comments.
  The site otherwise has no monospace face (see memory `aidedcam-brand-assets`).
- **Print stylesheet (A4):**
  - Header: `aidedcam-wordmark.svg`, program name (O number / file name), date.
  - Body: drawing, time table, checks.
  - Footer: www.aidedcam.com and the planning-estimate note.
  - Hidden: the editor, settings, nav, CTA and survey.
- **Layout:** it must work at 375 px width, with no horizontal page scroll and a 16 px side gutter.

## 9. Analytics (GA4, only after consent, no personal data)

| Event | Parameters |
|---|---|
| `gcode_file_loaded` | `lines`, `cycles`, `control` |
| `gcode_example_loaded` | – |
| `gcode_print` | – |
| `gcode_cta_click` | – |
| `gcode_survey` | `answer`: `machine` / `hand` / `cam` |

Never send program text, file names or free text (site rule).

## 10. Testing

`node --test "_tests/gcode/*.test.js"`. Node is needed only on the developer's PC.

1. **Parser and interpreter:** words, comments, `.5` numbers, the no-decimal setting, U/W
   incremental, G50's two roles, dialect forms, the system B/C map, inch.
2. **Each cycle:** the hand-worked example from its research note (pass count, first/last pass
   coordinates). OD and ID; Fanuc two-line and Haas one-line.
3. **Time:** closed-form cases (a CSS facing move crossing the G50 clamp radius; a G76 pass sequence).
4. **Checks:** every rule fires on a bad fixture and stays silent on a good one.
5. **Local only, `_tests/private/`:** cross-check G70–G72 passes against the desktop-CAM planner on the
   customer samples (kept outside the repo). **Customer programs never enter the repo.**
6. **In the browser (Playwright):**
   - the example loads and the drawing appears;
   - hover links both ways;
   - GR/EN/IT switching;
   - the print preview;
   - 375 px width;
   - a synthetic 50,000-line program stays responsive.
7. **Real machine, before launch:** run 2–3 programs on a real lathe and compare machine time with the
   estimate. Record the result in `_docs/gcode-viewer/` and set the default correction % from it.

## 11. Launch checklist

- `_tests/private/` added to `.gitignore` **before** any customer sample is copied in.
- Nav/footer link ("Free tools"); `sitemap.xml`; `llms.txt`; `?v=` cache-busting.
- GR/EN/IT `<title>` and meta description.
- GA events verified in the GA4 DebugView.
- Privacy and "viewer, not a simulator" notes visible.
- Print tested in Chrome and Edge.

## 12. Effort

About 2 weeks:

| Work | Days |
|---|---|
| Research notes | 2 |
| Parser and interpreter | 2 |
| Cycles | 3–4 |
| Time and checks | 1.5 |
| Drawing and UI | 2–3 |
| Print, i18n, tests and polish | 2 |

## 13. Out of scope (v1)

Simulation or material removal · milling · live-tool drilling G83–G89 · M98 subprograms · macros and
variables · nose-radius-compensated paths · Siemens/Mazak/Okuma cycle languages · 3D view · any server
or upload.

## 14. Open questions for Aris

1. Which shop can run 2–3 programs for the real-machine timing check (§10.7)?
2. Default tool-change time (3 s assumed).
3. Final GR/IT headings and CTA copy.
4. A homepage "Free tools" entry: where, and in what wording?
5. The contact target for the CTA: the index contact section (assumed), or a pre-filled subject?
