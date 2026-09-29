# Coverage Diagram Pre-check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a free coverage diagram pre-check to www.aidedcam.com. It reads the DWG or DXF of a Greek building permit in the browser. The visitor maps the drawing's layers to roles and types the zone terms. The tool then computes the figures of the διάγραμμα κάλυψης, each against its permitted value and with its Code article: plot area, coverage, δόμηση per level with the 206 §6 exclusions, the semi-open and balcony caps, volume, height, planting, the area schedule and the ΕΓΣΑ87 vertex tables. They show on screen with the drawing, and export as .xlsx, copy and print.

**Architecture:**
- **Engine.** The DWG quantities engine (`_src/dwg-engine/`), with two additions and no change to its existing results.
  - Closed 2D and lightweight polylines report their true vertices: `verts: [x, y, bulge, …]` in metres, in drawing coordinates.
  - `Union(idsJson)` unites closed items of the last measured file with Eyeshot's `Region.Union` (managed core). It answers the area, the parts, the drawable paths, the true vertices, and the items it had to leave out.
  - It is republished once into `js/dwg/engine/`, so both pages share one download. The worker routes a union through the bridge's `process` message.
- **Page.** `coverage-precheck.html`, with plain ES modules in `js/coverage/`, on the viewers' shared shell (`js/gcode/shell/`).
  - It reuses, unchanged, `js/laser/bridge.js` (queue, timeout, restart), `js/dwg/xlsx.js` on `js/laser/zip.js`, and `UNITS`/`MAX_BYTES` from `js/dwg/state.js`.
  - Mapping → levels → rules → tables are pure functions. A role or term change is re-evaluated in JavaScript in milliseconds; only a changed set of coverage outlines asks the engine for a union.
  - Its own canvas view, `js/coverage/drawing.js`: role fills, the building outline and numbered vertices.
- **Committed drawings.** The example permit, the layer template and the union fixture are written by a Node generator (`_tests/coverage/make-examples.mjs`), never typed.

**Tech Stack:**
- C# on .NET 10: the existing engine library, `Microsoft.NET.Sdk.WebAssembly` host with `[JSExport]`, and xUnit tests.
- devDept.Eyeshot 2026.2.284 (from the local installation) and ACadSharp 3.3.23, as in DWG quantities.
- Plain ES modules; `node --test`; the browser checks drive headless Chrome through `playwright-core`.
- The static GitHub Pages site.

**Spec:** `_docs/coverage-precheck/2026-09-29-coverage-precheck-design.md`, as amended by 95c5168 with Aris's attic and pilotis rulings. Where this plan departs from it, the departure is listed under "Spec refinements" below, with the reason.

**Validated before writing.** Every block below was built and run in a scratch worktree of `feat/coverage-precheck`, reviewed, and then the whole plan was replayed on a fresh checkout (see "Replay" at the end).
- **Node:** `node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js" "_tests/laser/*.test.js" "_tests/dwg/*.test.js" "_tests/coverage/*.test.js"` passes 340 + 64 = 404.
- **Engine:** `dotnet test _src/dwg-engine/Tests` passes 56 + 18 = 74; `dotnet test _src/laser-engine/Tests` still passes 43.
- **DWG quantities unchanged:** its page check passes 25/25 and its parity 6/6 on the republished engine. Its JSON on 9 real drawings × 2 unit settings was identical before and after once `verts` is stripped; 54 items gained `verts`.
- **Size:** the published engine is still 108 files, 11.4 MB. Only `AidedCam.Dwg.Engine` and `AidedCam.Dwg.Host` change, plus `dotnet.js` and `manifest.json`.
- **Browser (Chrome, headless, local server):**
  - the union parity page passes 6/6 cases and the stale-file refusal;
  - the page check (`_tests/coverage/browser-check.js`) passes 52/52;
  - the engine boots in 0.4–0.5 s and measures the example in 0.6 s. The first union takes about 0.3 s (Eyeshot's static set-up), later ones 2–20 ms, and 50 overlapping outlines about 120 ms;
  - a remap takes about 10 ms and a term change 5–6 ms, with no engine call;
  - no request leaves the local server, and there are no console errors.

## Global Constraints

- **Public repo** (github.com/aidedcam/aidedcam-page). No client names, no customer files, and no values or labels copied from customer files in any committed file, test, doc or commit message. Real permit drawings go only in the git-ignored `_tests/private/`.
- **No licence key, serial or licence file** anywhere in the repo. The headless engine needs none; if a step ever seems to need one, stop and ask Aris.
- **Eyeshot's managed classes only:** `devDept.Eyeshot.Entities.Region` (`Union`, `ContourList`), `CompositeCurve`, `Line`, `Arc` and `ICurve`, and `devDept.Geometry` (`Plane`, points). Never `ReadAutodesk`, `WriteAutodesk`, `UtilityEx` or any WinForms/WPF/x64 package: they don't run in the browser. `Region.GetArea` throws headless (it needs tessellation), so areas come from the resulting contours.
- **The laser tool must not change.** `_src/laser-engine/`, `js/laser/` and `laser-dxf-checker.html` are read, never edited.
- **DWG quantities must not change its results.**
  - `dwg-quantities.html` and `js/dwg/view.js`, `tables.js`, `selection.js`, `xlsx.js` and `state.js` are not edited.
  - `js/dwg/ui.js` changes one line (its worker's `?v=`), and `js/dwg/worker.js` gains the union routing.
  - The engine adds `verts` to closed polylines only. The existing 56 engine tests and DWG quantities' browser checks pass unchanged.
- **devDept notice**, on the page's footer, verbatim: `Portion of copyright © devDept Software S.r.l. All Rights Reserved.`
- **Build:**
  - The site has no build step and no npm dependencies.
  - The engine is built only by `powershell -ExecutionPolicy Bypass -File _src/dwg-engine/publish.ps1`, and its output in `js/dwg/engine/` is committed.
- **Privacy:**
  - Nothing is uploaded, and the engine makes no network call.
  - GA events (consent-gated, as on the other tools) never carry file names, layer names, figures or geometry.
- **Units:** areas in m², volumes in m³, coordinates in metres. The units used show on screen and in every export.
- **Limits:** 30 MB per file, 300,000 model-space entities, 60 s per file (see "Timeout" below), and one file at a time.
- **Languages:** GR (default)/EN/IT for every user-visible string. The Italian uses the formal "voi" and the typographic `’`. Greek legal terms stay in Greek in the EN and IT tables. Every non-ASCII character is kept exact.
- **Layout:** at 375 px there is no horizontal page scroll, with a 16 px side gutter; tables scroll inside their own box.
- **Tests:**
  - Node: `node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js" "_tests/laser/*.test.js" "_tests/dwg/*.test.js" "_tests/coverage/*.test.js"`. Quote the globs; on Node 24 a bare folder path doesn't work.
  - Engine: `dotnet test _src/dwg-engine/Tests`.
  - Both run from the repo root.
- **Cache-busting:** `?v=20261015` is a placeholder, and Task 14 replaces it on deploy day. It is on every new or changed asset URL:
  - the page's stylesheet and two scripts;
  - every import in `js/coverage/*.js` except the shared shell's;
  - the worker URL in `js/coverage/ui.js` and in `js/dwg/ui.js`;
  - the worker's import of `engine/dotnet.js`.
- **Commits** end with the session trailer, copied verbatim:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
  ```
  The repo-local git email is `akoulousis@aidedcam.com` (the global git email is a different one); Task 0 checks it.
- **Whole files are extracted, never retyped.**
  - A file shown in full is preceded by a line `<!-- file: <path> -->`. Changed existing files are given whole too; each task says which lines differ.
  - Write it with `node _tests/extract.mjs $PLAN <path>`, and check it with the same command plus `--check`, where `PLAN=_docs/coverage-precheck/2026-09-29-coverage-precheck-plan.md`. Set `PLAN` in every shell you run steps in.
  - Binary files are never typed. The three drawings are written by `_tests/coverage/make-examples.mjs` (Task 4), and the published engine by `publish.ps1` (Task 6).
- **Never push, merge or amend.** Pushing `main` publishes the live site, and only Aris decides that.

## Review Focus

Inputs real permit drawings bring that the spec doesn't spell out, most likely first, each pinned by a test:

1. **Wrong units** (a template in mm, drawn in cm): every area is off by 100× or 10⁶×, silently. *Pinned by C# `The_example_permit_measures_as_spec_12_says` (Task 5); rules `warnings: Σ.Κ. above 60 %, a plot area that suggests the wrong units, no levels, no coverage` (Task 3); examples `the example states metres and its integer group codes carry no decimal point` (Task 4); browser `override cm: plot 0.05 m², units and ΕΓΣΑ87 warnings` (Task 13).*
2. **Overlapping or touching coverage outlines** (per-floor footprints drawn separately): the sum double-counts, and a union keeps split points in the vertex table. *Pinned by C# `Two_overlapping_squares_unite_into_one_outline_of_eight_vertices`, `Two_touching_squares_unite_without_the_shared_edges_points`, `Four_bars_around_a_courtyard_unite_into_a_square_with_a_hole`, `Fifty_outlines_unite_quickly` (Task 5); union parity (Task 6); rules `a failed union shows the sum with a warning, and the rest continues` (Task 3); browser `union of two touching outlines: 290.00 m², 8 vertices from the lowest one` (Task 13).*
3. **Spaces against levels** (floors side by side, overlapping plans, balconies outside the outline): a space on the wrong level, or a guessed one, changes δόμηση. *Pinned by rules `§5.2: a space goes to the level containing its centroid, the smaller one if two do` and `§5.2: a balcony within 0.50 m goes to the nearest level; beyond it, or a space outside every level, is left out` (Task 3); levels `assignment goes by the centroid, even when an L-shaped space has it outside itself` and `a balcony equally near two levels goes to the smaller` (Task 2).*
4. **Arcs and mirrored polylines in the plot and building outlines**: the bulge sign and the drawing coordinates in the vertex tables. *Pinned by C# `A_closed_lightweight_polyline_with_a_bulge_reports_its_true_vertices_in_metres`, `A_closed_2D_polyline_reports_its_true_vertices`, `A_mirrored_polyline_reports_drawing_coordinates_and_flips_its_bulges`, `An_outline_with_an_arc_keeps_it_as_a_bulge`, `Survey_coordinates_keep_their_precision` (Task 5); rules `coordinate rows: numbered, with the arc edges marked` (Task 3).*
5. **Open or self-crossing outlines on a mapped layer** (a plot not closed, a bow tie): never measured silently. *Pinned by C# `Open_self_crossing_and_unknown_items_are_left_out_and_listed` (Task 5); rules `open and self-crossing outlines on a mapped layer are listed and never measured` and `§8: the plot missing or mapped twice blocks the results` (Task 3); browser `the open outline on the planting layer is listed` and `no closed outlines: an error card, not empty tables` (Task 13).*

Also pinned: the Greek decimal comma in typed terms (`state.test.js`, Task 7); TSV decimals without grouping (`tables.test.js`, Task 8; browser `copy (el): comma decimals`, Task 13); .xlsx sheet names within 31 characters in el/en/it (`xlsx.test.js`, Task 8).

## Spec refinements made while validating this plan

Each one is recorded here so the reviewers can check it against the spec, and so Aris can accept or reverse it.

**Spec edits already made (95c5168, Aris ruled 2026-09-29).** Two rows of §5.3 changed after validation began, and this plan implements the edited text:
- **§5.3 #6 Attic.** It said "max(attic gross − ½ × gross of the level below, 0)"; it now takes the stair off first (ruling 19 below).
- **§5.3 #10 Volume.** It said "(gross area − voids) × storey height"; it now also takes off a valid pilotis (ruling 18 below).

**Aris's rulings (2026-09-29):**
- **18. A pilotis adds no volume (Code 208 §2β).**
  - A pilotis that is valid as a δόμηση exclusion (≥ 50 % of the coverage, 206 §6ιστ) comes off its level's volume, like a void: (gross − voids − excluded pilotis) × storey height.
  - A pilotis under 50 % counts in δόμηση and keeps its volume. Spec §12 has no pilotis, so the example is unaffected.
  - Hand-worked: coverage 100, ground 100 with pilotis 60, floor 1 100, storey 3 → V = 40 × 3 + 100 × 3 = 420, ground δόμηση 40; with pilotis 49 → V = 600, δόμηση 100.
  - The string `cp.art.volume` says so in el/en/it. Pinned by rules `#10 (Aris ruled 2026-09-29, 208 §2β) …` (Task 3).
- **19. The attic's stair comes off first (Code 206 §6ιδ: "the stair up to it is not counted"; the 2022 template's "Ε σοφ. − Ε κλιμακ.").**
  - Attic check area = attic gross − every unit and common stair outline assigned to the attic level, in full, with no 25/30 m² cap. Attic δόμηση = max(check area − ½ × gross of the level below, 0).
  - The schedule lists each attic stair as excluded (note `cp.note.attic-stair`), and the rest as "attic without its stair, within ½ of the level below", with excluded = check − δόμηση.
  - Hand-worked: levels 100 and 100, attic 70 with a unit stair 8 → check 62, 62 − 50 = 12, total 212, excluded 8 + 50 = 58 = 70 − 12. Attic 58 with a common stair 10 → 48 ≤ 50 → 0.
  - Pinned by rules `#6 (Aris ruled 2026-09-29, 206 §6ιδ) …` (Task 3).
- **20. On the tools index, the single laser card no longer stretches** beside the two engineering cards (the shared `.ft-cards` grid stretched its row once the second engineering card arrived).
  - A page-scoped inline `<style>` in `free-tools.html`: `.ft-groups .ft-cards { align-content: start; }`. `css/tools.css` and `editorial.css` are untouched by it, so the tools.css diff is the appended coverage section only.
  - Pinned by `site.test.js` (the rule is in the page, not in tools.css; Task 12) and browser `index at 1280 px / 375 px: … the laser card is not stretched, no horizontal scroll` (Task 13).

**Refinements:**
1. **The union goes through the bridge's `process` message** (spec §3 has `{ type: 'union' }`).
   - `js/laser/bridge.js` only sends `process`, and it is reused unchanged. So the page sends `{ type: 'process', name: 'union', bytes: <empty ArrayBuffer>, settings: { union: { fileKey, ids } } }`, and the worker answers `{ type: 'union', id, area, parts, paths, verts, bad, error }`.
   - Added to the contract: `parts` (separate pieces) and `error` (null, `'stale'`, `'check'`, or an exception name).
   - The C# engine keeps the last measured file's closed curves whatever the key. The **worker** keeps `lastKey` (the message id of the last successful file) and answers `error: 'stale'` for any other `fileKey`, also after a restart. On `stale` the page re-measures the file once, then falls back to the sum.
2. **The union's output is normalised.**
   - Collinear lines and same-circle arcs are merged: Eyeshot splits edges where other outlines touched them, and a vertex table must not list those points.
   - Each part's outer contour is counter-clockwise and starts at its lowest, then leftmost vertex; holes are clockwise.
   - Outlines are moved to a local origin before the booleans, for ΕΓΣΑ87's large coordinates.
   - Areas come from the result contours with the engine's exact geometry (Green's theorem). They are sanity-bounded: largest outline ≤ union ≤ Σ outlines, else `error: 'check'`, and the page shows the sum with ⚠.
3. **`js/dwg/ui.js` changes one line**: its worker URL goes from `?v=20260928` to the `?v=20261015` placeholder.
   - The engine is republished, so `dotnet.js` names new fingerprinted assemblies. A cached old `worker.js` would import a cached old `dotnet.js` that points at deleted files.
   - `js/dwg/worker.js` imports `engine/dotnet.js?v=20261015` for the same reason.
   - **On deploy day DWG quantities' `?v=` must be bumped too**, and it must be re-checked live (Task 14).
4. **Its own drawing view, `js/coverage/drawing.js`**, instead of `js/dwg/view.js` (spec §3 allows a wrapper in `js/coverage/`).
   - `view.js` colours by layer, has no role fills and no numbered vertices, and exposes no transform to place labels with. `js/dwg/view.js` is untouched.
   - `drawing.js` exposes `highlighted` and `screenOf()` for the browser check.
5. **The scope of `verts`**: closed lightweight and 2D polylines only, as the spec says.
   - A mirrored polyline (extrusion 0, 0, −1) reports drawing coordinates, with its bulges' sign flipped. A tilted one gets no `verts`, and the union lists it in `bad`.
   - `verts` coordinates are rounded to 1e-6 m and bulges to 1e-12; the paths stay at 1e-4.
6. **The union's inputs** are circles and closed splines or ellipses as well as polylines. Splines and ellipses are sampled to short lines, and a full circle goes in as two arcs.
7. **The template has 25 layers**: `AC_PLOT`, `AC_COVER`, 13 `AC_LVL_*`, and 10 space and planting roles.
   - R12 has no layer descriptions, so the Greek descriptions are a TEXT legend in Windows-1253 under `$DWGCODEPAGE ANSI_1253`.
   - The level names' "−" (U+2212) is not in Windows-1253, so it is written "-".
8. **The drawings are generated**: `_tests/coverage/make-examples.mjs` (with `--check`) writes three files.
   - `example-permit.dxf`, an AutoCAD 2000 DXF: header with `$INSUNITS 6`, LAYER and BLOCK_RECORD tables, `*Model_Space`/`*Paper_Space` blocks, and LWPOLYLINEs with handles and owners.
   - `layer-template.dxf` (R12) and `_tests/coverage/fixtures/union.dxf`.
   - `example-geometry.mjs` is the single source of the example's numbers, for both the generator and the rules tests.
9. **The example's terms** live in `rules.js` (`EXAMPLE_TERMS`, re-exported by the test geometry).
   - Loading the example fills them without saving them. The first term the visitor types saves the shown terms as theirs.
   - Loading their own file restores the stored terms.
10. **Summary rows.** A pilotis row appears only when a pilotis is mapped. Setbacks and parking read "not in version 1" in the Υ.ΔΟΜ block. The height row carries the 210 §1 default as a note when ΣΔ is typed.
11. **GA additions.**
    - An extra event `covp_units_override { units }`, mirroring `dwgq_units_override`.
    - `covp_file_loaded` and `covp_example_loaded` carry `{ format, size }`, with size in buckets `under-1mb`, `1-5mb`, `over-5mb`.
    - `covp_mapping_done { roles, template: 'yes'|'no' }` fires once per file, after its first union.
12. **Print** uses the existing tools.css `@page { size: A4 }` (no new `@page`) and the existing `.gv-print-head` markup for the title and file name.
    - A `position: fixed` disclaimer footer repeats on every printed page in Chrome.
    - Steps 1–2, the buttons, the zoom controls and "show in drawing" are hidden. The drawing refits on `beforeprint`.
13. **Coordinates** are shown without thousands grouping (`410000,00`), on screen and in the TSV. The .xlsx stores them as numbers.
14. **The schedule's columns** are Area | Excluded from ΣΔ | Counted in ΣΔ (a mezzanine's addition, and the level's δόμηση). The stair cap is a line of its own, with the excess in the note; the excess is already inside the gross.
15. **Timeout 60 s**, DWG quantities' value. Spec §8 says "those of DWG quantities … 30 s", but DWG quantities uses 60 s.
16. **Spec §10's "mapping table under 3 s at < 50 000 entities" is not met.** 10,000 entities take 1.7 s and 50,000 take 14.3 s, in the WASM interpreter, the same as DWG quantities. AOT compilation is the lever, and it is left to Aris.
17. **`sitemap.xml`'s `lastmod`** for the new page is the placeholder `2026-10-15`, like the `?v=` placeholder.

**Rulings on ambiguities (made while validating; reviewers check them against the spec):**
- **Auto-fill order.**
  - Template names win over a remembered role (the spec's order), and template-named layers are never stored.
  - Setting a layer back to Ignore forgets it. Other files' remembered layers are kept.
- **Pilotis (#7).** It is valid when Σ pilotis ≥ 50 % of the coverage: the union, or the sum while the union is pending or failed. The comparison is made at cents.
- **Volume (#10).** Only the uppermost basement counts above ground. The attic uses its own storey-height input. For the pilotis, see ruling 18.
- **Marks** compare values rounded to the cent, which is what the table shows.
- **Basement main use** mapped on a non-basement level is not measured, and gets a warning. Other spaces in a basement are listed as excluded.
- **Level assignment.**
  - A space goes by the centroid of the engine's sampled ring, with even-odd containment, and to the smaller level on overlap. This also holds for an L-shaped space whose centroid lies outside itself.
  - A balcony goes to the nearest level within 0.50 m (touching = 0), with ties to the smaller level. A balcony drawn inside a level is assigned to it.
- **Open outlines.**
  - Open polylines, splines and ellipses on mapped layers are warnings, with "show in drawing". Lines and arcs on mapped layers are ignored silently: they are not outlines.
  - Layers without closed outlines sit under "other layers (not used)".
- **Typed numbers.** One separator, comma or point, so `1.380` is 1.38. Grouped forms (`1.380,5`), negatives and exponents are refused (`aria-invalid`), never guessed.
- **Entrance level** defaults to ground, and is chosen among the mapped levels that are not the attic.
- **Storey heights**: one input per mapped above-ground level, the attic included, with the placeholder 3,00.
- **Semi-open and balcony totals** count only spaces assigned to a level.
- **While a union is pending**, the coverage shows the sum and the .xlsx button is disabled.
- **Vertex numbering.**
  - The plot is numbered as drawn. The building comes from the union: the outer contour counter-clockwise from the lowest, then leftmost vertex, with parts numbered on ("Part n" headings when there are several).
  - An arc edge marks its start vertex "(arc to the next)".
- **Units-check banner** for a plot area under 20 m² or over 1,000,000 m². The ΕΓΣΑ87 check covers all plot vertices (the ring if the plot has no `verts`).

**Pitfalls found while validating** (each is handled in the blocks below; don't "simplify" them away):
- ACadSharp silently ignores an integer group code written as a real: `70 / 6.0` for `$INSUNITS` left the default (mm), and the example read 10⁶× too small. The writer refuses non-integers there, and a test pins the bytes.
- ACadSharp drops entities whose owner (330) doesn't resolve ("the drawing is empty"). A minimal DXF with owner codes must carry the BLOCK_RECORD table.
- ACadSharp renumbers a handle that clashes with its default objects (2A → 35). Ids are the reader's, consistent within one read, not the file's.
- Eyeshot's booleans split edges where outlines touched (for example (10,0) on a 0–20 edge), so the contours are merged before their vertices are listed.
- A 1e-7 m gap keeps two outlines as separate parts; the area is still right.
- A units-override re-render once used the previous figures with the union cleared, and crashed. The figures are now cleared before re-measuring, and the browser check's override step pins it.
- The page's default language is Greek, and `setLanguage` isn't run for `el`, so every `data-i18n` element carries its Greek text inline (pinned by `i18n.test.js`).
- Headless, clicking a button above the canvas scrolls it. The browser check computes canvas coordinates after the last scroll.

## File structure

| Path | Task | Responsibility |
|---|---|---|
| `_tests/coverage/dxf-writer.mjs`, `helpers.mjs` | 1 | DXF writer (AutoCAD 2000 and R12, Windows-1253) and `rect`; hand-made engine items for the tests |
| `js/coverage/mapping.js` | 1 | Roles, levels, the 25-layer template, auto-fill, remembering, the layer list |
| `js/coverage/levels.js` | 2 | Ring, centroid, containment, ring distance, level assignment |
| `js/coverage/rules.js`, `_tests/coverage/example-geometry.mjs` | 3 | Articles, limits, default and example terms, `buildModel`, `evaluate`, coordinates; the example's numbers |
| `js/coverage/i18n-coverage.js` | 4 | Tool strings `window.CP_I18N` (el/en/it) |
| `_tests/coverage/make-examples.mjs`, `js/coverage/examples/*.dxf`, `_tests/coverage/fixtures/union.dxf` | 4 | The generator and the three generated drawings |
| `_src/dwg-engine/Engine/Model.cs`, `Measure.cs`, `Quantities.cs`, `ResultJson.cs`, `Union.cs` | 5 | `Item.Verts`; `Shape.Verts()`; `LastFile`; `Flat`, `UnionResult`, `Union.Of`; `verts` and `ResultJson.Union` in the JSON |
| `_src/dwg-engine/Tests/CoverageTests.cs` | 5 | 18 engine tests: vertices, unions, JSON, the example, the template |
| `_src/dwg-engine/Host/Program.cs`, `js/dwg/worker.js`, `js/dwg/ui.js`, `js/dwg/engine/*` | 6 | `[JSExport] Union`; union routing and `lastKey`; the worker's `?v=`; the republished engine |
| `_tests/coverage/union.html`, `browser-check.cjs` | 6 | The browser union parity page and the headless runner |
| `js/coverage/state.js` | 7 | Typed terms, stored terms, GA buckets, the union key |
| `js/coverage/tables.js` | 8 | Summary, schedule, coordinate and mapping rows; TSV; the workbook; the file name |
| `js/coverage/drawing.js` | 9 | Canvas view: role fills, building outline, numbered vertices, highlight, pick, pan and zoom |
| `coverage-precheck.html`, `css/tools.css` | 10 | The page and its styles (a section appended) |
| `js/coverage/ui.js` | 11 | The controller |
| `free-tools.html`, `sitemap.xml`, `llms.txt` | 12 | Site links, and the index's page-scoped card rule |
| `_tests/coverage/browser-check.js` | 13 | The browser check (52) |
| `_docs/coverage-precheck/real-file-check.md` | 14 | Pre-launch record for real permit drawings |
| `_tests/coverage/*.test.js` | 1–12 | Node suites (9 files, 64 tests) |

---

### Task 0: Starting point

Nothing is written in this task; it checks that the tools and the baseline are as this plan expects.

**Files:** none.

**Interfaces:**
- Produces: a known baseline for Tasks 1–14: Node 340, engine 56, laser engine 43. `.gitattributes` already stores `*.dxf` and `js/dwg/engine/**` byte-exact, and `_src/dwg-engine/**/bin/` and `obj/` are already ignored.

- [ ] **Step 1: Check the starting point**

Run:
```bash
PLAN=_docs/coverage-precheck/2026-09-29-coverage-precheck-plan.md
git branch --show-current && git log --oneline -1
git config user.email
node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js" "_tests/laser/*.test.js" "_tests/dwg/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
dotnet test _src/dwg-engine/Tests 2>&1 | tail -1
dotnet test _src/laser-engine/Tests 2>&1 | tail -1
git check-attr text -- js/coverage/examples/x.dxf js/dwg/engine/dotnet.js
ls "C:/Program Files/devDept/Eyeshot 2026/NuGet Packages/devDept.Eyeshot.2026.2.284.nupkg"
```
Expected:
- the branch is `feat/coverage-precheck` (or the worktree's own branch, when the plan runs in a worktree), and HEAD is the commit that adds this plan;
- the email is `akoulousis@aidedcam.com` (if not: `git config --local user.email akoulousis@aidedcam.com`);
- `ℹ pass 340` and `ℹ fail 0`;
- `Passed!  - Failed:     0, Passed:    56, …`, then `… Passed:    43, …`;
- two lines ending `text: unset`;
- the package path is printed.

If Eyeshot 2026 or .NET 10 is missing, stop and tell Aris: the engine can only be built on his machine.

- [ ] **Step 2: The browser tooling**

Run: `node -e "const p=require('path'),fs=require('fs'),d=p.join(require('os').homedir(),'AppData','Local','npm-cache','_npx');console.log(fs.readdirSync(d).some(x=>fs.existsSync(p.join(d,x,'node_modules','playwright-core'))))" && ls "C:/Program Files/Google/Chrome/Application/chrome.exe" && python --version`
Expected: `true`, the Chrome path, and a Python 3 version. If `false`: run `npx playwright --version` once (or set `PW_CORE` to a `playwright-core` folder).

No commit: nothing changed.

---

### Task 1: Roles, the template and the layer mapping

**Files:**
- Create: `_tests/coverage/dxf-writer.mjs` (the DXF writer; here only its `rect` is used, the writers in Task 4), `_tests/coverage/helpers.mjs`
- Create: `js/coverage/mapping.js`
- Test: `_tests/coverage/mapping.test.js`

**Interfaces:**
- Produces (`js/coverage/mapping.js`, pure):
  - `ROLES` (14 ids, `'ignore'` last), `LEVELS` (`'B2' 'B1' '00' … '09' 'ATTIC'`), `isBasement(lv)`, `SPACE_ROLES` (9 roles assigned to levels).
  - `TEMPLATE`: 25 `{ layer, role, level?, aci }`, `AC_PLOT` … `AC_GREEN`.
  - `normName(name)`, `templateFor(name) → entry | null` (ignoring case and `-`/`_`/spaces).
  - `isOutlineKind(it)`, `isClosed(it)` (area > 0 or `bad`), `isOpen(it)` (not closed, not a line or arc).
  - `layerList(result) → { used: [{ name, color, outlines, area, open }], other }`.
  - `autoMap(layerNames, remembered) → { map: { layer: { role, level? } }, fromTemplate, fromMemory }`.
  - `remember(remembered, map) → remembered`, `cleanRemembered(obj)`, `rolesUsed(map) → count`.
- Produces (test support): `dxf-writer.mjs` exports `cp1253(s)`, `dxf2000({ units, layers, polylines })`, `dxfR12({ layers, texts })`, `rect(x, y, w, h)`. `helpers.mjs` exports `item(layer, verts, { id, bad, closed })` (an engine item with shoelace area, path and `verts`), `rect`, `result(items)`, `unionOf(area, verts)`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/coverage/dxf-writer.mjs -->
```js
// A small DXF writer for the coverage pre-check's committed drawings (the example, the layer template and the
// browser fixture). It writes what AutoCAD writes for these entities, so the engine is tested on real group
// codes, not on a library's round trip:
//   - AutoCAD 2000 (AC1015) with $INSUNITS, a LAYER and a BLOCK_RECORD table, *Model_Space and *Paper_Space
//     blocks, and LWPOLYLINE entities (90 count, 70 flags, 43 width, 10/20 per vertex, 42 bulge after it);
//   - R12 (AC1009) with a LAYER table and TEXT entities, Greek text as Windows-1253 bytes under
//     $DWGCODEPAGE ANSI_1253, the way a Greek AutoCAD saves an R12 DXF.

// Group codes 10–59, 110–149 and 210–239 hold reals (AutoCAD writes them with a decimal point); 60–99, 170–179,
// 270–289 and 370–389 hold integers, written without one (a "6.0" there does not parse as 6).
const isReal = c => (c >= 10 && c <= 59) || (c >= 110 && c <= 149) || (c >= 210 && c <= 239);
const num = (c, v) => {
  if (!isReal(c)) { if (!Number.isInteger(v)) throw new Error(`group ${c} needs an integer, got ${v}`); return String(v); }
  return Number.isInteger(v) ? v.toFixed(1) : String(+v.toFixed(10));
};

// Windows-1253 for ASCII, the Greek block (U+0386–U+03CE map to 0xB6–0xFE) and the few Latin-1 signs it
// shares (§ « » ° ± ½ ©); anything else is refused, so a character the file can't hold never goes in silently.
const SHARED = new Set([0xa7, 0xab, 0xbb, 0xb0, 0xb1, 0xbd, 0xa9]);
export function cp1253(s) {
  const out = [];
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c < 0x80 || SHARED.has(c)) out.push(c);
    else if (c >= 0x0386 && c <= 0x03ce && c !== 0x0387 && c !== 0x038b && c !== 0x038d && c !== 0x03a2) out.push(c - 0x2d0);
    else throw new Error(`no Windows-1253 byte for U+${c.toString(16)}`);
  }
  return Uint8Array.from(out);
}

class Groups {
  constructor() { this.parts = []; }
  g(code, value) { this.parts.push(String(code).padStart(3), typeof value === 'number' ? num(code, value) : String(value)); return this; }
  text() { return this.parts.join('\r\n') + '\r\n'; }
}

// layers: [{ name, color }]; polylines: [{ layer, closed, verts: [[x, y, bulge?], …] }]
export function dxf2000({ units = 6, layers, polylines }) {
  const d = new Groups();
  let handle = 0x100;
  const h = () => (handle++).toString(16).toUpperCase();
  d.g(0, 'SECTION').g(2, 'HEADER')
    .g(9, '$ACADVER').g(1, 'AC1015')
    .g(9, '$DWGCODEPAGE').g(3, 'ANSI_1253')
    .g(9, '$INSUNITS').g(70, units)
    .g(0, 'ENDSEC');
  d.g(0, 'SECTION').g(2, 'TABLES');
  d.g(0, 'TABLE').g(2, 'LAYER').g(5, '2').g(100, 'AcDbSymbolTable').g(70, layers.length + 1);
  for (const l of [{ name: '0', color: 7 }, ...layers]) {
    d.g(0, 'LAYER').g(5, h()).g(330, '2').g(100, 'AcDbSymbolTableRecord').g(100, 'AcDbLayerTableRecord')
      .g(2, l.name).g(70, 0).g(62, l.color || 7).g(6, 'Continuous');
  }
  d.g(0, 'ENDTAB');
  d.g(0, 'TABLE').g(2, 'BLOCK_RECORD').g(5, '1').g(100, 'AcDbSymbolTable').g(70, 2);
  d.g(0, 'BLOCK_RECORD').g(5, '1F').g(330, '1').g(100, 'AcDbSymbolTableRecord').g(100, 'AcDbBlockTableRecord').g(2, '*Model_Space');
  d.g(0, 'BLOCK_RECORD').g(5, '1B').g(330, '1').g(100, 'AcDbSymbolTableRecord').g(100, 'AcDbBlockTableRecord').g(2, '*Paper_Space');
  d.g(0, 'ENDTAB');
  d.g(0, 'ENDSEC');
  d.g(0, 'SECTION').g(2, 'BLOCKS');
  for (const [rec, name, ps] of [['1F', '*Model_Space', false], ['1B', '*Paper_Space', true]]) {
    d.g(0, 'BLOCK').g(5, h()).g(330, rec).g(100, 'AcDbEntity');
    if (ps) d.g(67, 1);
    d.g(8, '0').g(100, 'AcDbBlockBegin').g(2, name).g(70, 0).g(10, 0).g(20, 0).g(30, 0).g(3, name).g(1, '');
    d.g(0, 'ENDBLK').g(5, h()).g(330, rec).g(100, 'AcDbEntity');
    if (ps) d.g(67, 1);
    d.g(8, '0').g(100, 'AcDbBlockEnd');
  }
  d.g(0, 'ENDSEC');
  d.g(0, 'SECTION').g(2, 'ENTITIES');
  for (const p of polylines) {
    d.g(0, 'LWPOLYLINE').g(5, h()).g(330, '1F').g(100, 'AcDbEntity').g(8, p.layer).g(100, 'AcDbPolyline')
      .g(90, p.verts.length).g(70, p.closed ? 1 : 0).g(43, 0);
    for (const [x, y, b] of p.verts) { d.g(10, x).g(20, y); if (b) d.g(42, b); }
  }
  d.g(0, 'ENDSEC');
  d.g(0, 'SECTION').g(2, 'OBJECTS').g(0, 'DICTIONARY').g(5, 'C').g(330, '0').g(100, 'AcDbDictionary').g(0, 'ENDSEC');
  d.g(0, 'EOF');
  return new TextEncoder().encode(d.text());                                   // ASCII only
}

// layers: [{ name, color }]; texts: [{ layer, x, y, height, text }]; Greek text is written in Windows-1253.
export function dxfR12({ layers, texts }) {
  const d = new Groups();
  d.g(0, 'SECTION').g(2, 'HEADER')
    .g(9, '$ACADVER').g(1, 'AC1009')
    .g(9, '$DWGCODEPAGE').g(3, 'ANSI_1253')
    .g(0, 'ENDSEC');
  d.g(0, 'SECTION').g(2, 'TABLES');
  d.g(0, 'TABLE').g(2, 'LAYER').g(70, layers.length + 1);
  for (const l of [{ name: '0', color: 7 }, ...layers]) d.g(0, 'LAYER').g(2, l.name).g(70, 0).g(62, l.color || 7).g(6, 'CONTINUOUS');
  d.g(0, 'ENDTAB');
  d.g(0, 'ENDSEC');
  d.g(0, 'SECTION').g(2, 'ENTITIES');
  for (const t of texts) d.g(0, 'TEXT').g(8, t.layer).g(10, t.x).g(20, t.y).g(30, 0).g(40, t.height).g(1, t.text);
  d.g(0, 'ENDSEC');
  d.g(0, 'EOF');
  return cp1253(d.text());
}

// A rectangle as closed-polyline vertices, counter-clockwise from its lower-left corner.
export const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
```

<!-- file: _tests/coverage/helpers.mjs -->
```js
// Hand-made engine items for the coverage tests: what the engine returns for closed polylines drawn on a
// layer (id, layer, kind, area, bad, path, verts), from vertices in metres. Areas are the shoelace of the
// straight-edged outlines used here, so every expected number in the tests is worked by hand.
import { rect } from './dxf-writer.mjs';
export { rect };

let next = 0x100;
export function item(layer, verts, { id, bad = false, closed = true } = {}) {
  const pts = verts.map(v => [v[0], v[1]]);
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; a += x0 * y1 - x1 * y0; }
  const path = [];
  for (const [x, y] of pts) path.push(x, y);
  if (closed) path.push(pts[0][0], pts[0][1]);
  return {
    id: id || (next++).toString(16).toUpperCase(), layer, kind: 'polyline', len: 0,
    area: closed && !bad ? Math.abs(a) / 2 : 0, bad, block: null, copies: 1, path: [path],
    verts: closed ? verts.flatMap(v => [v[0], v[1], v[2] || 0]) : undefined,
  };
}

export const result = items => ({ type: 'result', layers: [...new Set(items.map(i => i.layer))].map(name => ({ name, color: '#ffffff' })), items, bbox: { x0: 0, y0: 0, x1: 1, y1: 1 }, file: { units: 'm', unitsSource: 'file', used: 'm' }, warnings: [] });

// The union of axis-parallel rectangles by the answer the engine gives for them (tests of the rules only).
export const unionOf = (area, verts = []) => ({ type: 'union', area, parts: verts.length, paths: [], verts, bad: [], error: null });
```

<!-- file: _tests/coverage/mapping.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, LEVELS, TEMPLATE, normName, templateFor, autoMap, remember, cleanRemembered, layerList, rolesUsed, isClosed, isOpen } from '../../js/coverage/mapping.js';
import { item, rect, result } from './helpers.mjs';

test('the template: 25 layers, every role but Ignore, every level once', () => {
  assert.equal(TEMPLATE.length, 25);
  assert.deepEqual([...new Set(TEMPLATE.map(t => t.role))].sort(), ROLES.filter(r => r !== 'ignore').sort());
  assert.deepEqual(TEMPLATE.filter(t => t.role === 'level').map(t => t.level), LEVELS);
  assert.equal(new Set(TEMPLATE.map(t => normName(t.layer))).size, 25, 'no two template names collide once normalised');
});

test('template names match ignoring case and the separators - _ and spaces', () => {
  for (const name of ['AC_LVL_01', 'ac_lvl_01', 'AC-LVL-01', 'Ac Lvl 01', 'AC__LVL 01', 'aclvl01']) {
    const t = templateFor(name);
    assert.deepEqual(t && [t.role, t.level], ['level', '01'], name);
  }
  assert.equal(templateFor('AC_PLOT').role, 'plot');
  assert.equal(templateFor('AC_LVL_10'), null, 'there is no floor 10');
  assert.equal(templateFor('ΟΙΚΟΠΕΔΟ'), null);
  assert.equal(templateFor('AC_PLOTS'), null);
});

test('auto-fill: template names first, then what this browser remembers, else Ignore', () => {
  const remembered = { 'ΟΡΙΑ ΟΙΚΟΠΕΔΟΥ': { role: 'plot' }, 'ΚΑΤΟΨΗ Α': { role: 'level', level: '01' }, AC_COVER: { role: 'green' }, 'ΠΑΛΙΑ': { role: 'nonsense' } };
  const { map, fromTemplate, fromMemory } = autoMap(['ac-cover', 'ΟΡΙΑ ΟΙΚΟΠΕΔΟΥ', 'ΚΑΤΟΨΗ Α', 'ΠΑΛΙΑ', 'ΤΟΙΧΟΙ', 'AC_COVER'], remembered);
  assert.deepEqual(map['ac-cover'], { role: 'cover' });
  assert.deepEqual(map.AC_COVER, { role: 'cover' }, 'a template name wins over a remembered role');
  assert.deepEqual(map['ΟΡΙΑ ΟΙΚΟΠΕΔΟΥ'], { role: 'plot' });
  assert.deepEqual(map['ΚΑΤΟΨΗ Α'], { role: 'level', level: '01' });
  assert.deepEqual(map['ΠΑΛΙΑ'], { role: 'ignore' }, 'a malformed memory is ignored');
  assert.deepEqual(map['ΤΟΙΧΟΙ'], { role: 'ignore' });
  assert.equal(fromTemplate, 2); assert.equal(fromMemory, 2);
});

test('remembering: roles by layer name; template names and Ignore are not stored; other files keep theirs', () => {
  const before = { 'OTHER FILE': { role: 'green' }, 'ΚΑΤΟΨΗ Α': { role: 'plot' } };
  const after = remember(before, { AC_PLOT: { role: 'plot' }, 'ΚΑΤΟΨΗ Α': { role: 'ignore' }, 'ΚΑΤΟΨΗ Β': { role: 'level', level: '02' }, 'ΜΠΑΛΚΟΝΙΑ': { role: 'balcony' } });
  assert.deepEqual(after, { 'OTHER FILE': { role: 'green' }, 'ΚΑΤΟΨΗ Β': { role: 'level', level: '02' }, 'ΜΠΑΛΚΟΝΙΑ': { role: 'balcony' } });
  assert.deepEqual(cleanRemembered({ a: { role: 'level', level: 'XX' }, b: { role: 'void' }, c: null, d: 'x' }), { b: { role: 'void' } });
  assert.deepEqual(cleanRemembered('not an object'), {});
});

test('the layer list: layers with closed outlines, counted, and the others apart', () => {
  const r = result([
    item('AC_PLOT', rect(0, 0, 20, 25)),
    item('ROOMS', rect(0, 0, 2, 2)), item('ROOMS', rect(5, 0, 3, 2)), item('ROOMS', [[0, 0], [2, 2], [2, 0], [0, 2]], { bad: true }),
    item('ROOMS', [[0, 0], [1, 0], [1, 1]], { closed: false }),
    item('TEXT', [[0, 0], [1, 0]], { closed: false }),
    { id: 'H1', layer: 'HATCH', kind: 'hatch', area: 50, bad: false, path: [] },
  ]);
  const { used, other } = layerList(r);
  assert.deepEqual(used.map(l => [l.name, l.outlines, l.area, l.bad, l.open]), [['AC_PLOT', 1, 500, 0, 0], ['ROOMS', 3, 10, 1, 1]]);
  assert.deepEqual(other.map(l => l.name), ['TEXT', 'HATCH']);
});

test('closed and open: hatches and inserts are never outlines; lines and arcs are not open outlines', () => {
  assert.equal(isClosed({ kind: 'circle', area: 3 }), true);
  assert.equal(isClosed({ kind: 'polyline', area: 0, bad: true }), true);
  assert.equal(isClosed({ kind: 'hatch', area: 3 }), false);
  assert.equal(isOpen({ kind: 'polyline', area: 0 }), true);
  assert.equal(isOpen({ kind: 'line', area: 0 }), false);
  assert.equal(rolesUsed({ a: { role: 'plot' }, b: { role: 'level', level: '00' }, c: { role: 'level', level: '01' }, d: { role: 'ignore' } }), 2);
});
```

Run:
```bash
for f in _tests/coverage/dxf-writer.mjs _tests/coverage/helpers.mjs _tests/coverage/mapping.test.js; do node _tests/extract.mjs $PLAN $f; done
node --test "_tests/coverage/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
```
Expected: `ℹ pass 0`, `ℹ fail 1` (the module is missing).

- [ ] **Step 2: Write the module**

<!-- file: js/coverage/mapping.js -->
```js
// Coverage pre-check: the drawing's own layers mapped to roles (spec §4). Pure: no DOM, no engine.
// The template names fill in by themselves, a mapping remembered in this browser fills the rest, everything
// else starts as "Ignore".

// Every role a layer can have, in the order the dropdown lists them.
export const ROLES = ['plot', 'cover', 'level', 'mezz', 'semiopen', 'balcony', 'stairCommon', 'stairUnit', 'void', 'pilotis', 'bsmtMain', 'exclOther', 'green', 'ignore'];

// The levels a level outline can be, lowest first.
export const LEVELS = ['B2', 'B1', '00', '01', '02', '03', '04', '05', '06', '07', '08', '09', 'ATTIC'];
export const isBasement = lv => lv === 'B1' || lv === 'B2';

// Roles whose outlines are spaces inside a level (spec §5.2): assigned by containment, or (balconies) by
// distance.
export const SPACE_ROLES = ['mezz', 'semiopen', 'balcony', 'stairCommon', 'stairUnit', 'void', 'pilotis', 'bsmtMain', 'exclOther'];

// The published AidedCAM layer template, with the AutoCAD colour index the template file gives each layer.
export const TEMPLATE = [
  { layer: 'AC_PLOT', role: 'plot', aci: 1 },
  { layer: 'AC_COVER', role: 'cover', aci: 5 },
  ...LEVELS.map(lv => ({ layer: `AC_LVL_${lv}`, role: 'level', level: lv, aci: 7 })),
  { layer: 'AC_MEZZ', role: 'mezz', aci: 6 },
  { layer: 'AC_SEMIOPEN', role: 'semiopen', aci: 4 },
  { layer: 'AC_BALCONY', role: 'balcony', aci: 30 },
  { layer: 'AC_STAIR_COMMON', role: 'stairCommon', aci: 2 },
  { layer: 'AC_STAIR_UNIT', role: 'stairUnit', aci: 40 },
  { layer: 'AC_VOID', role: 'void', aci: 8 },
  { layer: 'AC_PILOTIS', role: 'pilotis', aci: 9 },
  { layer: 'AC_BSMT_MAIN', role: 'bsmtMain', aci: 150 },
  { layer: 'AC_EXCL_OTHER', role: 'exclOther', aci: 210 },
  { layer: 'AC_GREEN', role: 'green', aci: 3 },
];

// Layer names compared ignoring case and the separators - _ and spaces (spec §4).
export const normName = name => String(name).toUpperCase().replace(/[-_\s]+/g, '');
const BY_NORM = new Map(TEMPLATE.map(t => [normName(t.layer), t]));
export const templateFor = name => BY_NORM.get(normName(name)) || null;

// An outline the rules can measure: a closed curve of the engine (area > 0), or one whose area can't be
// trusted (bad: self-crossing). Hatches and block inserts are not outlines.
export const isOutlineKind = it => it.kind !== 'hatch' && it.kind !== 'insert';
export const isClosed = it => isOutlineKind(it) && (it.area > 0 || !!it.bad);
export const isOpen = it => isOutlineKind(it) && !isClosed(it) && it.kind !== 'line' && it.kind !== 'arc';

// Layers that hold at least one closed outline, with counts and areas, then the rest ("other layers, not
// used"). Sorted as the engine sorted them (by name).
export function layerList(result) {
  const by = new Map();
  for (const it of result.items || []) {
    let l = by.get(it.layer);
    if (!l) by.set(it.layer, l = { name: it.layer, outlines: 0, area: 0, bad: 0, open: 0 });
    if (isClosed(it)) { l.outlines++; if (it.bad) l.bad++; else l.area += it.area; }
    else if (isOpen(it)) l.open++;
  }
  const names = (result.layers || []).map(l => l.name);
  for (const n of by.keys()) if (!names.includes(n)) names.push(n);
  const used = [], other = [];
  for (const n of names) {
    const l = by.get(n) || { name: n, outlines: 0, area: 0, bad: 0, open: 0 };
    (l.outlines > 0 ? used : other).push(l);
  }
  return { used, other };
}

const validRole = r => r && ROLES.includes(r.role) && (r.role !== 'level' || LEVELS.includes(r.level));

// The starting mapping of a file's layers: template names first, then what this browser remembers, else Ignore.
// Returns { map: { layer: { role, level? } }, fromTemplate, fromMemory }.
export function autoMap(layerNames, remembered = {}) {
  const map = {};
  let fromTemplate = 0, fromMemory = 0;
  for (const name of layerNames) {
    const t = templateFor(name);
    if (t) { map[name] = t.level ? { role: t.role, level: t.level } : { role: t.role }; fromTemplate++; continue; }
    const r = Object.prototype.hasOwnProperty.call(remembered, name) ? remembered[name] : null;
    if (validRole(r) && r.role !== 'ignore') { map[name] = r.role === 'level' ? { role: 'level', level: r.level } : { role: r.role }; fromMemory++; continue; }
    map[name] = { role: 'ignore' };
  }
  return { map, fromTemplate, fromMemory };
}

// What is kept in this browser after a change: every layer the visitor gave a role, by name. A template name
// is not stored (it fills in by itself); a layer set back to Ignore is forgotten. Other files' layers stay.
export function remember(remembered, map) {
  const out = { ...remembered };
  for (const [name, r] of Object.entries(map)) {
    if (templateFor(name)) continue;
    if (!validRole(r) || r.role === 'ignore') delete out[name];
    else out[name] = r.role === 'level' ? { role: 'level', level: r.level } : { role: r.role };
  }
  return out;
}

// A remembered mapping read back from storage: only well-formed entries survive.
export function cleanRemembered(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const [name, r] of Object.entries(obj)) if (validRole(r) && r.role !== 'ignore') out[name] = r.role === 'level' ? { role: 'level', level: r.level } : { role: r.role };
  return out;
}

// The number of roles in use (for GA, no names).
export function rolesUsed(map) { return new Set(Object.values(map).map(r => r.role).filter(r => r !== 'ignore')).size; }
```

Run: `node _tests/extract.mjs $PLAN js/coverage/mapping.js && node --test "_tests/coverage/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 6`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/coverage/mapping.js _tests/coverage/dxf-writer.mjs _tests/coverage/helpers.mjs _tests/coverage/mapping.test.js
git commit -F - <<'EOF'
Coverage pre-check: roles, layer template and mapping

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 2: Assigning spaces to levels

**Files:**
- Create: `js/coverage/levels.js`
- Test: `_tests/coverage/levels.test.js`

**Interfaces:**
- Consumes: `rect` from `helpers.mjs` (Task 1).
- Produces (`js/coverage/levels.js`, pure): `BALCONY_REACH` (0.5 m); `ringOf(item) → [[x, y], …]` (the engine's path without the repeated closing point); `centroid(ring) → [x, y]` (relative to the first point, so survey coordinates keep their digits); `inside([x, y], ring)` (even-odd); `ringDistance(a, b)` (0 when touching or overlapping); `assign(levels: [{ id, level, area, ring }], spaces: [{ id, role, area, ring }]) → spaces with { level } or { level: null, why: 'outside' | 'far' }`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/coverage/levels.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centroid, inside, ringDistance, ringOf, assign, BALCONY_REACH } from '../../js/coverage/levels.js';
import { rect } from './helpers.mjs';

test('centroid: of a rectangle, of an L, and at survey coordinates', () => {
  assert.deepEqual(centroid(rect(0, 0, 4, 2)), [2, 1]);
  // An L of two rectangles: 4 × 1 (centroid 2, 0.5) and 1 × 3 above its left end (0.5, 2.5): areas 4 and 3.
  const c = centroid([[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4]]);
  assert.ok(Math.abs(c[0] - (4 * 2 + 3 * 0.5) / 7) < 1e-12 && Math.abs(c[1] - (4 * 0.5 + 3 * 2.5) / 7) < 1e-12, String(c));
  const s = centroid(rect(410000, 4495000, 10, 15));
  assert.ok(Math.abs(s[0] - 410005) < 1e-9 && Math.abs(s[1] - 4495007.5) < 1e-9, String(s));
});

test('distance between outlines: touching is 0, a gap is its width, overlapping or inside is 0', () => {
  assert.equal(ringDistance(rect(0, 0, 10, 10), rect(0, -3, 5, 3)), 0);
  assert.ok(Math.abs(ringDistance(rect(0, 0, 10, 10), rect(0, -3.5, 5, 3)) - 0.5) < 1e-12);
  assert.equal(ringDistance(rect(0, 0, 10, 10), rect(8, 8, 5, 5)), 0);
  assert.equal(ringDistance(rect(0, 0, 10, 10), rect(2, 2, 1, 1)), 0);
  assert.equal(BALCONY_REACH, 0.5);
});

test('the ring of an engine path drops the repeated closing point', () => {
  const ring = ringOf({ path: [[0, 0, 1, 0, 1, 1, 0, 0]] });
  assert.deepEqual(ring, [[0, 0], [1, 0], [1, 1]]);
  assert.equal(inside([0.9, 0.5], ring), true);
});

test('assignment goes by the centroid, even when an L-shaped space has it outside itself', () => {
  const levels = [{ id: 'L', level: '00', area: 100, ring: rect(0, 0, 10, 10) }];
  const L = [[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4]];
  assert.equal(assign(levels, [{ id: 's', role: 'semiopen', area: 7, ring: L }])[0].level, '00');
  const out = assign(levels, [{ id: 's', role: 'void', area: 4, ring: rect(20, 0, 2, 2) }])[0];
  assert.deepEqual([out.level, out.why], [null, 'outside']);
});

test('a balcony equally near two levels goes to the smaller', () => {
  const levels = [{ id: 'A', level: '01', area: 200, ring: rect(0, 0, 10, 20) }, { id: 'B', level: '02', area: 100, ring: rect(12, 0, 10, 10) }];
  assert.equal(assign(levels, [{ id: 'b', role: 'balcony', area: 2, ring: rect(10, 0, 2, 1) }])[0].level, '02');
});
```

Run: `node _tests/extract.mjs $PLAN _tests/coverage/levels.test.js && node --test "_tests/coverage/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 6`, `ℹ fail 1`.

- [ ] **Step 2: Write the module**

<!-- file: js/coverage/levels.js -->
```js
// Coverage pre-check: which level each space belongs to (spec §5.2). Pure geometry on the engine's outlines.
//   - A space belongs to the level outline that contains its centroid; if two do (overlapping plans), the
//     smaller one wins.
//   - A balcony belongs to the level outline nearest to it, if that distance is at most 0.50 m.
//   - A space that fits no level is reported and left out of every figure; it never goes to a guessed level.

export const BALCONY_REACH = 0.5;             // metres

// The outline's ring: the engine's drawn path (metres), closed, as [[x, y], …] without the repeated last point.
export function ringOf(item) {
  const p = (item.path && item.path[0]) || [];
  const ring = [];
  for (let i = 0; i + 1 < p.length; i += 2) ring.push([p[i], p[i + 1]]);
  if (ring.length > 1) {
    const [a, b] = [ring[0], ring[ring.length - 1]];
    if (Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9) ring.pop();
  }
  return ring;
}

// Area centroid of a ring (shoelace), relative to its first point so survey coordinates keep their digits.
export function centroid(ring) {
  if (!ring.length) return [0, 0];
  const [ox, oy] = ring[0];
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[(i + 1) % ring.length];
    const ax = x0 - ox, ay = y0 - oy, bx = x1 - ox, by = y1 - oy;
    const c = ax * by - bx * ay;
    a += c; cx += (ax + bx) * c; cy += (ay + by) * c;
  }
  if (Math.abs(a) < 1e-12) {                                   // degenerate: the mean of the points
    let sx = 0, sy = 0;
    for (const [x, y] of ring) { sx += x; sy += y; }
    return [sx / ring.length, sy / ring.length];
  }
  return [ox + cx / (3 * a), oy + cy / (3 * a)];
}

// Even-odd point in ring.
export function inside([px, py], ring) {
  let s = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) s = !s;
  }
  return s;
}

function segDist([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function segsCross(a, b, c, d) {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

// The smallest distance between two rings: 0 when they overlap or cross.
export function ringDistance(a, b) {
  if (!a.length || !b.length) return Infinity;
  if (inside(a[0], b) || inside(b[0], a)) return 0;
  let best = Infinity;
  for (let i = 0; i < a.length; i++) {
    const a0 = a[i], a1 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const b0 = b[j], b1 = b[(j + 1) % b.length];
      if (segsCross(a0, a1, b0, b1)) return 0;
      best = Math.min(best, segDist(a0, b0, b1), segDist(a1, b0, b1), segDist(b0, a0, a1), segDist(b1, a0, a1));
    }
  }
  return best;
}

// levels: [{ id, level, area, ring }]; spaces: [{ id, role, area, ring }].
// Returns spaces with { level } set, or { level: null, why: 'outside' | 'far' }.
export function assign(levels, spaces) {
  return spaces.map(s => {
    if (s.role === 'balcony') {
      let best = null;
      for (const l of levels) {
        const d = ringDistance(s.ring, l.ring);
        if (d > BALCONY_REACH + 1e-9) continue;
        if (!best || d < best.d - 1e-9 || (Math.abs(d - best.d) <= 1e-9 && l.area < best.l.area)) best = { d, l };
      }
      return best ? { ...s, level: best.l.level, levelId: best.l.id, distance: best.d } : { ...s, level: null, why: 'far' };
    }
    const c = centroid(s.ring);
    let best = null;
    for (const l of levels) if (inside(c, l.ring) && (!best || l.area < best.area)) best = l;
    return best ? { ...s, level: best.level, levelId: best.id } : { ...s, level: null, why: 'outside' };
  });
}
```

Run: `node _tests/extract.mjs $PLAN js/coverage/levels.js && node --test "_tests/coverage/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 11`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/coverage/levels.js _tests/coverage/levels.test.js
git commit -F - <<'EOF'
Coverage pre-check: assigning spaces to levels

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 3: The rules (spec §5) and the example's numbers

The figures of §5.3, one pure function. Every expected number in `rules.test.js` is worked by hand in the test, and the example drawing's figures are spec §12's table. Aris's rulings 18 and 19 are two tests of their own.

**Files:**
- Create: `js/coverage/rules.js`, `_tests/coverage/example-geometry.mjs`
- Test: `_tests/coverage/rules.test.js`

**Interfaces:**
- Consumes: `mapping.js` (`isClosed`, `isOpen`, `isBasement`, `LEVELS`, `SPACE_ROLES`), `levels.js` (`ringOf`, `centroid`, `assign`); `rect` from `dxf-writer.mjs`.
- Produces (`js/coverage/rules.js`, pure):
  - `RULES_AS_OF` (`'2026-06-08'`), `ARTICLES` (14 keys `plot` … `coords`, each `{ code, old, from }`), `LIMITS`, `EGSA` (`{ x0: 100000, x1: 1000000, y0: 3850000, y1: 4650000 }`), `DEFAULT_STOREY` (3.0).
  - `DEFAULT_TERMS` (`{ sd, sk, hmax, roofAllow: 2, h, roof, storey: {}, basementAbove: 0, roofVolume: 0, entrance: '00', parking: false }`) and `EXAMPLE_TERMS` (spec §12).
  - `defaultHmax(sd)` (210 §1).
  - `buildModel(result, map) → { plot, cover, levels, spaces, green, excluded, mapped }` (outlines `{ id, index, layer, role, area, ring, verts, c }`; spaces carry their level).
  - `coverIds(model) → sorted ids` (what a union is asked for).
  - `evaluate(model, terms, union | null) → { blocked: null | 'plot-missing' | 'plot-many', warnings: [{ id, params, ids }], terms, plot, coverage: { area, sum, state: 'none'|'pending'|'failed'|'ok', ratio, permitted, mark, ids }, uncovered, levels, caps, domisi, volume, height, planting, pilotis, coords: { plot, plotHasVerts, building: [{ part, rows }], egsa } }`.
- Produces (`example-geometry.mjs`): `X0`, `Y0` (410000, 4495000), `OUTLINES` (15 `{ layer, verts }` in local metres), `OPEN` (one open polyline on `AC_GREEN`), `TERMS` (= `EXAMPLE_TERMS`), `inSurvey(verts)`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/coverage/example-geometry.mjs -->
```js
// The page's example drawing (spec §12): a synthetic permit on the template layers, in metres, placed in
// ΕΓΣΑ87 near X 410 000, Y 4 495 000. No customer data. make-examples.mjs writes it to
// js/coverage/examples/example-permit.dxf, and the rules tests build their outlines from the same numbers.
import { rect } from './dxf-writer.mjs';

export const X0 = 410000, Y0 = 4495000;

// Local metres; the plot is 20 × 25. The four levels are drawn side by side to the right of the plot, each
// 10 × 15, with their spaces inside them and the balconies against their lower edge (outside).
export const OUTLINES = [
  { layer: 'AC_PLOT', verts: rect(0, 0, 20, 25) },                       // 500.00
  { layer: 'AC_COVER', verts: rect(0, 10, 10, 15) },                     // 150.00
  { layer: 'AC_GREEN', verts: rect(10, 0, 10, 14) },                     // 140.00
  { layer: 'AC_LVL_B1', verts: rect(30, 10, 10, 15) },                   // basement −1, auxiliary
  { layer: 'AC_LVL_00', verts: rect(45, 10, 10, 15) },
  { layer: 'AC_SEMIOPEN', verts: rect(45, 10, 5, 4) },                   // 20.00
  { layer: 'AC_STAIR_COMMON', verts: rect(51, 20, 4, 5) },               // 20.00, the entrance level
  { layer: 'AC_LVL_01', verts: rect(60, 10, 10, 15) },
  { layer: 'AC_SEMIOPEN', verts: rect(60, 10, 5, 6) },                   // 30.00
  { layer: 'AC_STAIR_COMMON', verts: rect(66, 20, 4, 5) },               // 20.00
  { layer: 'AC_BALCONY', verts: rect(60, 7, 5, 3) },                     // 15.00, below the outline
  { layer: 'AC_LVL_02', verts: rect(75, 10, 10, 15) },
  { layer: 'AC_SEMIOPEN', verts: rect(75, 10, 5, 8) },                   // 40.00
  { layer: 'AC_STAIR_COMMON', verts: rect(81, 20, 4, 5) },               // 20.00
  { layer: 'AC_BALCONY', verts: rect(75, 7, 5, 3) },                     // 15.00
];

// One open polyline on the planting layer: the page must list it as an open outline, never measure it.
export const OPEN = [{ layer: 'AC_GREEN', verts: [[1, 1], [8, 1], [8, 8]] }];

// The zone terms and heights the example is shown with (spec §12) live with the page's rules.
export { EXAMPLE_TERMS as TERMS } from '../../js/coverage/rules.js';

export const inSurvey = verts => verts.map(([x, y, b]) => (b ? [x + X0, y + Y0, b] : [x + X0, y + Y0]));
```

<!-- file: _tests/coverage/rules.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModel, evaluate, coverIds, defaultHmax, ARTICLES, LIMITS, EGSA } from '../../js/coverage/rules.js';
import { autoMap } from '../../js/coverage/mapping.js';
import { item, rect, result, unionOf } from './helpers.mjs';
import { OUTLINES, OPEN, TERMS, inSurvey } from './example-geometry.mjs';

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} ≠ ${b}`);
const lvl = (ev, lv) => ev.levels.find(l => l.level === lv);

// A drawing from [layer, verts] pairs, mapped by the template names, evaluated with the union given.
function run(outlines, terms, union) {
  const items = outlines.map(([layer, verts, opts]) => item(layer, verts, opts));
  const r = result(items);
  const { map } = autoMap(r.layers.map(l => l.name));
  const model = buildModel(r, map);
  return { model, ev: evaluate(model, terms, union === undefined ? unionOf(model.cover.reduce((a, o) => a + o.area, 0)) : union) };
}

// A 20 × 25 plot with a 10 × 15 coverage outline, as most tests start.
const PLOT = ['AC_PLOT', rect(0, 0, 20, 25)];
const COVER = ['AC_COVER', rect(0, 10, 10, 15)];

test('the example drawing gives exactly the figures of spec §12', () => {
  const items = [...OUTLINES.map(o => item(o.layer, inSurvey(o.verts))), ...OPEN.map(o => item(o.layer, inSurvey(o.verts), { closed: false }))];
  const r = result(items);
  const { map, fromTemplate } = autoMap(r.layers.map(l => l.name));
  assert.equal(fromTemplate, 10);
  const model = buildModel(r, map);
  const cover = model.cover[0];
  const ev = evaluate(model, TERMS, unionOf(150, [cover.verts]));
  assert.equal(ev.blocked, null);
  near(ev.plot.area, 500, 'plot');
  near(ev.coverage.area, 150, 'coverage'); near(ev.coverage.permitted, 300, 'permitted coverage'); near(ev.coverage.ratio, 0.3, 'ratio');
  assert.equal(ev.coverage.mark, true);
  near(ev.uncovered, 350, 'uncovered');
  assert.deepEqual(ev.levels.map(l => [l.level, +l.domisi.toFixed(6)]), [['B1', 0], ['00', 110], ['01', 100], ['02', 90]]);
  near(ev.caps.semi, 90, 'semi-open'); near(ev.caps.semiCap, 80, '0.20 P'); assert.equal(ev.caps.semiMark, false);
  near(ev.caps.semi + ev.caps.balc, 120, 'semi-open + balconies'); near(ev.caps.totalCap, 160, '0.40 P'); assert.equal(ev.caps.totalMark, true);
  near(ev.caps.overflow, 10, 'overflow');
  near(ev.domisi.total, 310, 'δόμηση'); near(ev.domisi.sd, 0.62, 'achieved ΣΔ'); near(ev.domisi.permitted, 400, 'P'); assert.equal(ev.domisi.mark, true);
  near(ev.volume.V, 1380, 'volume'); near(ev.volume.so, 4, 'σ.ο.'); near(ev.volume.permitted, 2000, 'permitted V'); near(ev.volume.achievedSo, 2.76, 'achieved σ.ο.');
  assert.equal(ev.volume.mark, true);
  assert.equal(ev.height.mark, true);
  near(ev.planting.mandatory, 200, 'mandatory uncovered'); near(ev.planting.required, 400 / 3, '⅔'); near(ev.planting.actual, 140, 'planting');
  assert.equal(ev.planting.mark, true);
  assert.deepEqual(ev.warnings.map(w => w.id), ['open'], 'only the open outline on the planting layer');
  assert.deepEqual(ev.coords.plot.map(r => [r.n, r.x, r.y]), [[1, 410000, 4495000], [2, 410020, 4495000], [3, 410020, 4495025], [4, 410000, 4495025]]);
  assert.equal(ev.coords.egsa, true);
  assert.equal(ev.coords.building[0].rows.length, 4);
});

test('#1–3: plot area, coverage against Σ.Κ., the uncovered area', () => {
  const { ev } = run([PLOT, COVER, ['AC_COVER', rect(8, 5, 4, 10)]], { sk: 30 }, unionOf(150 + 40 - 20));
  near(ev.plot.area, 500, 'plot');
  near(ev.coverage.area, 170, 'the union, not the sum 190');
  near(ev.coverage.sum, 190, 'sum');
  near(ev.coverage.permitted, 150, '30 % of 500'); assert.equal(ev.coverage.mark, false);
  near(ev.uncovered, 330, 'uncovered');
  assert.deepEqual(ev.coverage.ids.length, 2);
});

test('#2 without Σ.Κ.: the proposed value only, no permitted value and no mark', () => {
  const { ev } = run([PLOT, COVER], {});
  assert.equal(ev.coverage.permitted, null);
  assert.equal(ev.coverage.mark, null);
  assert.equal(ev.planting.required, null);
  assert.equal(ev.planting.mark, null);
});

test('a failed union shows the sum with a warning, and the rest continues', () => {
  const { ev } = run([PLOT, COVER, ['AC_COVER', rect(8, 5, 4, 10)]], { sk: 60 }, { ...unionOf(0), error: 'check' });
  near(ev.coverage.area, 190, 'sum');
  assert.equal(ev.coverage.state, 'failed');
  assert.ok(ev.warnings.some(w => w.id === 'union-failed' && w.ids.length === 2));
  assert.equal(ev.blocked, null);
});

test('#4 and #5: stair caps at 30, 40 (entrance level) and 25 m², with and without excess', () => {
  const L = (lv, x) => [`AC_LVL_${lv}`, rect(x, 0, 10, 10)];               // 100 m² each
  const { ev } = run([PLOT, COVER,
    L('00', 100), ['AC_STAIR_COMMON', rect(100, 0, 5, 9)],                   // 45 on the entrance level: 40 excluded, 5 counts
    L('01', 120), ['AC_STAIR_COMMON', rect(120, 0, 5, 7)],                   // 35 on a floor: 30 excluded, 5 counts
    L('02', 140), ['AC_STAIR_COMMON', rect(140, 0, 4, 5)], ['AC_STAIR_UNIT', rect(145, 0, 4, 7)],   // 20 all out; unit 28: 25 out, 3 counts
    L('03', 160), ['AC_STAIR_UNIT', rect(160, 0, 4, 5)],                     // 20: all out
  ], { entrance: '00' });
  const line = (lv, role) => lvl(ev, lv).lines.filter(l => l.role === role);
  assert.deepEqual(line('00', 'stairCommon').map(l => [l.cap, l.excluded, l.counts]), [[40, 40, 5]]);
  assert.deepEqual(line('01', 'stairCommon').map(l => [l.cap, l.excluded, l.counts]), [[30, 30, 5]]);
  assert.deepEqual(line('02', 'stairCommon').map(l => [l.cap, l.excluded, l.counts]), [[30, 20, 0]]);
  assert.deepEqual(line('02', 'stairUnit').map(l => [l.cap, l.excluded, l.counts]), [[25, 25, 3]]);
  assert.deepEqual(ev.levels.map(l => [l.level, l.domisi]), [['00', 60], ['01', 70], ['02', 55], ['03', 80]]);
});

test('#5: a common stair on a floor chosen as the entrance level gets the 40 m² cap', () => {
  const { ev } = run([PLOT, COVER, ['AC_LVL_01', rect(100, 0, 10, 10)], ['AC_STAIR_COMMON', rect(100, 0, 5, 7)]], { entrance: '01' });
  assert.deepEqual(lvl(ev, '01').lines[0].excluded, 35);
});

test('#6: the attic counts only above half of the level below it', () => {
  const a = run([PLOT, COVER, ['AC_LVL_00', rect(100, 0, 10, 10)], ['AC_LVL_01', rect(120, 0, 10, 10)], ['AC_LVL_ATTIC', rect(140, 0, 10, 7)]], {}).ev;
  near(lvl(a, 'ATTIC').domisi, 20, '70 − ½ × 100');
  const b = run([PLOT, COVER, ['AC_LVL_01', rect(120, 0, 10, 10)], ['AC_LVL_ATTIC', rect(140, 0, 10, 4)]], {}).ev;
  near(lvl(b, 'ATTIC').domisi, 0, '40 is within half of 100');
  near(b.domisi.total, 100, 'total');
});

test('#6 (Aris ruled 2026-09-29, 206 §6ιδ): the stair up to the attic comes off before the half-of-below check', () => {
  // Levels 00 and 01 of 100 m²; a 10 × 7 attic (70) with a 2 × 4 unit stair (8): check area 62, half of below 50 → 12.
  const L = [PLOT, COVER, ['AC_LVL_00', rect(100, 0, 10, 10)], ['AC_LVL_01', rect(120, 0, 10, 10)], ['AC_LVL_ATTIC', rect(140, 0, 10, 7)]];
  const a = run([...L, ['AC_STAIR_UNIT', rect(141, 1, 2, 4)]], {}).ev;
  near(lvl(a, 'ATTIC').domisi, 12, '70 − 8 − ½ × 100');
  near(a.domisi.total, 212, '100 + 100 + 12');
  const lines = lvl(a, 'ATTIC').lines;
  assert.deepEqual(lines.map(x => [x.role, x.area, x.excluded, x.note]), [['stairUnit', 8, 8, 'attic-stair'], ['atticRest', 62, 50, 'attic-half']]);
  near(lines.reduce((s, x) => s + x.excluded, 0), 70 - 12, 'everything excluded adds up to gross − δόμηση');
  // A common stair counts the same way; 58 − 10 = 48 is within 50, so the attic adds nothing.
  const b = run([PLOT, COVER, ['AC_LVL_01', rect(120, 0, 10, 10)], ['AC_LVL_ATTIC', rect(140, 0, 10, 5.8)], ['AC_STAIR_COMMON', rect(141, 1, 2, 5)]], {}).ev;
  near(lvl(b, 'ATTIC').domisi, 0, '48 ≤ 50');
});

test('#10 (Aris ruled 2026-09-29, 208 §2β): a pilotis excluded from δόμηση adds no volume; one that counts does', () => {
  // Coverage 100; ground 100 with a pilotis, floor 1 100; storey heights 3.
  const at = h => run([PLOT, ['AC_COVER', rect(0, 0, 10, 10)], ['AC_LVL_00', rect(100, 0, 10, 10)], ['AC_PILOTIS', rect(100, 0, 10, h)], ['AC_LVL_01', rect(120, 0, 10, 10)]], { sd: 1 }, unionOf(100)).ev;
  const valid = at(6), small = at(4.9);                    // pilotis 60 (≥ 50 % of 100) and 49
  near(valid.volume.V, (100 - 60) * 3 + 100 * 3, '120 + 300');
  near(lvl(valid, '00').domisi, 40, 'and out of δόμηση');
  near(small.volume.V, 100 * 3 + 100 * 3, 'a pilotis that counts keeps its volume');
  near(lvl(small, '00').domisi, 100, 'and its δόμηση');
});

test('#7: pilotis at 49 % of the coverage counts (✗), at 50 % it is excluded', () => {
  const at = h => run([PLOT, ['AC_COVER', rect(0, 0, 10, 10)], ['AC_LVL_00', rect(100, 0, 10, 10)], ['AC_PILOTIS', rect(100, 0, 10, h)]], {}, unionOf(100)).ev;
  const small = at(4.9), half = at(5);
  assert.equal(small.pilotis.valid, false);
  near(lvl(small, '00').domisi, 100, 'pilotis 49 m² counts');
  assert.ok(small.warnings.some(w => w.id === 'pilotis-small'));
  assert.equal(half.pilotis.valid, true);
  near(lvl(half, '00').domisi, 50, 'pilotis 50 m² excluded');
});

test('#8: semi-open and balcony overflow is counted once', () => {
  // Plot 10 × 10 = 100 and ΣΔ 1: P = 100, semi-open cap 20, semi-open + balconies cap 40.
  const plot = ['AC_PLOT', rect(0, 0, 10, 10)];
  const lv = ['AC_LVL_00', rect(100, 0, 20, 20)];
  const semi = a => ['AC_SEMIOPEN', rect(100, 0, a / 5, 5)];
  const balc = a => ['AC_BALCONY', rect(100, -5, a / 5, 5)];
  const over = (...o) => run([plot, lv, ...o], { sd: 1 }).ev.caps;
  const a = over(semi(25));                   // semi-open alone over
  near(a.overflow, 5, 'semi-open alone'); assert.equal(a.semiMark, false); assert.equal(a.totalMark, true);
  const b = over(semi(15), balc(30));         // the total alone over
  near(b.overflow, 5, 'total alone'); assert.equal(b.semiMark, true); assert.equal(b.totalMark, false);
  const c = over(semi(30), balc(20));         // both over by 10: counted once
  near(c.overflow, 10, 'both, no double count');
  const d = over(semi(30), balc(25));         // both over: the larger excess, 15
  near(d.overflow, 15, 'both, the larger');
  const all = run([plot, lv, semi(30), balc(25)], { sd: 1 }).ev;
  near(all.domisi.total, 400 - 30 + 15, 'level 400 − semi-open 30 + overflow 15');
  const none = run([plot, lv, semi(30), balc(25)], {}).ev;
  assert.equal(none.caps.checked, false); near(none.caps.overflow, 0, 'no ΣΔ: nothing added');
  near(none.domisi.total, 370, 'without ΣΔ');
});

test('#4: mezzanines count in δόμηση', () => {
  const { ev } = run([PLOT, COVER, ['AC_LVL_00', rect(100, 0, 10, 10)], ['AC_MEZZ', rect(101, 1, 4, 5)]], {});
  near(lvl(ev, '00').domisi, 120, '100 + 20');
});

test('#4: voids and other exclusions come off the level; the basement counts 50 % of its main use only', () => {
  const { ev } = run([PLOT, COVER,
    ['AC_LVL_00', rect(100, 0, 10, 10)], ['AC_VOID', rect(101, 1, 2, 2)], ['AC_EXCL_OTHER', rect(104, 1, 3, 2)],
    ['AC_LVL_B1', rect(120, 0, 10, 15)], ['AC_BSMT_MAIN', rect(120, 0, 5, 8)],
  ], {});
  near(lvl(ev, '00').domisi, 100 - 4 - 6, 'void and declared exclusion');
  near(lvl(ev, 'B1').domisi, 20, '50 % of 40');
  near(ev.domisi.total, 110, 'total');
});

test('#10: σ.ο. is 5 × ΣΔ, or 5.5 × ΣΔ when Hmax ≤ 8.50 m', () => {
  const so = hmax => run([PLOT, COVER], { sd: 1, hmax }).ev.volume.so;
  assert.equal(so(8.5), 5.5);
  assert.equal(so(8.51), 5);
  assert.equal(so(null), 5);
});

test('#10: volume = (gross − voids) × storey height, + basement above ground, + roof', () => {
  const { ev } = run([PLOT, COVER,
    ['AC_LVL_00', rect(100, 0, 10, 10)], ['AC_VOID', rect(101, 1, 2, 5)], ['AC_MEZZ', rect(104, 1, 2, 5)],
    ['AC_LVL_B2', rect(120, 0, 10, 10)], ['AC_LVL_B1', rect(140, 0, 10, 10)],
  ], { sd: 1, storey: { '00': 3.5 }, basementAbove: 1.2, roofVolume: 50 });
  near(ev.volume.V, 90 * 3.5 + 100 * 1.2 + 50, 'mezzanines add no volume; only B1 sticks out');
  near(ev.volume.permitted, 2500, '5 × 1 × 500');
});

test('#11: height is a check on typed values', () => {
  const h = t => run([PLOT, COVER], t).ev.height.mark;
  assert.equal(h({ hmax: 11, roofAllow: 2, h: 9.6, roof: 1.5 }), true);
  assert.equal(h({ hmax: 11, roofAllow: 2, h: 9.6, roof: 2.1 }), false);
  assert.equal(h({ hmax: 11, roofAllow: 2, h: 11.01, roof: 0 }), false);
  assert.equal(h({ hmax: 11, roofAllow: 2, h: null, roof: 0 }), null);
});

test('#12: planting, with and without outdoor parking', () => {
  const p = parking => run([PLOT, COVER, ['AC_GREEN', rect(10, 0, 10, 14)]], { sk: 60, parking }).ev.planting;
  const a = p(false);
  near(a.mandatory, 200, '500 − 300'); near(a.required, 133.333333, '⅔ × 200'); assert.equal(a.mark, true);
  const b = p(true);
  near(b.mandatory, 150, '500 − 70 % × 500'); near(b.required, 100, '⅔ × 150');
});

test('§5.2: a space goes to the level containing its centroid, the smaller one if two do', () => {
  const { ev, model } = run([PLOT, COVER,
    ['AC_LVL_00', rect(100, 0, 20, 20)], ['AC_LVL_01', rect(100, 0, 10, 10)],      // overlapping plans
    ['AC_SEMIOPEN', rect(101, 1, 2, 2)],                                           // centroid (102, 2): inside both
    ['AC_SEMIOPEN', rect(115, 15, 2, 2)],                                          // only in the big one
  ], {});
  assert.deepEqual(model.spaces.map(s => s.level), ['01', '00']);
  near(lvl(ev, '01').domisi, 96, '100 − 4'); near(lvl(ev, '00').domisi, 396, '400 − 4');
});

test('§5.2: a balcony within 0.50 m goes to the nearest level; beyond it, or a space outside every level, is left out', () => {
  const { ev, model } = run([['AC_PLOT', rect(0, 0, 10, 10)],
    ['AC_LVL_00', rect(100, 0, 10, 10)], ['AC_LVL_01', rect(130, 0, 10, 10)],
    ['AC_BALCONY', rect(100, -3.5, 5, 3)],                                         // 0.50 below level 00
    ['AC_BALCONY', rect(130, -3.6, 5, 3)],                                         // 0.60 below level 01
    ['AC_SEMIOPEN', rect(200, 0, 2, 2)],                                           // in no level at all
  ], { sd: 1 });
  assert.deepEqual(model.spaces.map(s => [s.role, s.level, s.why || '']), [['balcony', '00', ''], ['balcony', null, 'far'], ['semiopen', null, 'outside']]);
  near(ev.caps.balc, 15, 'only the near balcony');
  near(ev.caps.semi, 0, 'the lost semi-open space is in no figure');
  assert.deepEqual(ev.warnings.filter(w => w.ids.length).map(w => w.id).sort(), ['balcony-far', 'no-level']);
  near(ev.domisi.total, 200, 'both levels, nothing guessed');
});

test('§8: the plot missing or mapped twice blocks the results', () => {
  assert.equal(run([COVER], {}).ev.blocked, 'plot-missing');
  const two = run([PLOT, ['AC_PLOT', rect(50, 0, 5, 5)], COVER], {}).ev;
  assert.equal(two.blocked, 'plot-many');
  assert.equal(two.plotIds.length, 2);
});

test('§5.3: coordinates outside the ΕΓΣΑ87 range for Greece are flagged', () => {
  const at = (x, y) => run([['AC_PLOT', rect(x, y, 20, 25)]], {}).ev;
  assert.equal(at(0, 0).coords.egsa, false);
  assert.ok(at(0, 0).warnings.some(w => w.id === 'not-egsa'));
  assert.equal(at(410000, 4495000).coords.egsa, true);
  assert.equal(at(EGSA.x0 - 0.01, 4495000).coords.egsa, false);
  assert.equal(at(EGSA.x1 - 20, EGSA.y1 - 25).coords.egsa, true);
  assert.equal(at(410000, EGSA.y0 - 1).coords.egsa, false);
});

test('coordinate rows: numbered, with the arc edges marked', () => {
  const b = Math.tan(Math.PI / 8);
  const { ev } = run([['AC_PLOT', [[0, 0], [6, 0, b], [6, 4], [0, 4]]]], {});
  assert.deepEqual(ev.coords.plot.map(r => [r.n, r.x, r.y, r.arc]), [[1, 0, 0, false], [2, 6, 0, true], [3, 6, 4, false], [4, 0, 4, false]]);
});

test('open and self-crossing outlines on a mapped layer are listed and never measured', () => {
  const { ev, model } = run([PLOT, COVER, ['AC_GREEN', rect(10, 0, 10, 14)], ['AC_GREEN', [[1, 1], [8, 1], [8, 8]], { closed: false }], ['AC_GREEN', [[0, 0], [2, 2], [2, 0], [0, 2]], { bad: true }]], { sk: 60 });
  near(ev.planting.actual, 140, 'only the good outline');
  assert.deepEqual(model.excluded.map(x => x.why), ['open', 'bad']);
  assert.deepEqual(ev.warnings.filter(w => w.ids.length).map(w => w.id), ['open', 'bad']);
});

test('warnings: Σ.Κ. above 60 %, a plot area that suggests the wrong units, no levels, no coverage', () => {
  const a = run([PLOT, COVER], { sk: 70 }).ev;
  assert.ok(a.warnings.some(w => w.id === 'sk-high'));
  assert.ok(a.warnings.some(w => w.id === 'no-levels'));
  const b = run([['AC_PLOT', rect(0, 0, 4, 4)]], {}).ev;                        // 16 m²: drawn in cm, read as m?
  assert.ok(b.warnings.some(w => w.id === 'units-check'));
  assert.ok(b.warnings.some(w => w.id === 'no-cover'));
});

test('210 §1: the default height for a ΣΔ', () => {
  assert.deepEqual([0.4, 0.8, 0.81, 1.2, 1.6, 2.0, 2.6, 3, 4].map(defaultHmax), [10.75, 14, 17.25, 17.25, 19.5, 22.75, 26, 30, 32]);
  assert.equal(defaultHmax(null), null);
});

test('every figure cites its Code article, the old one and the date it applies from', () => {
  for (const k of ['plot', 'coverage', 'uncovered', 'level', 'stairs', 'attic', 'pilotis', 'caps', 'total', 'volume', 'height', 'planting', 'coords']) {
    const a = ARTICLES[k];
    assert.ok(a && a.code && a.old && a.from === '2026-06-08', k);
  }
  assert.equal(ARTICLES.coverage.code, '207'); assert.equal(ARTICLES.coverage.old, 'ΝΟΚ 12');
  assert.equal(LIMITS.stairCommon, 30); assert.equal(LIMITS.stairCommonEntrance, 40); assert.equal(LIMITS.stairUnit, 25);
});

test('the union is asked for the coverage outlines only', () => {
  const { model } = run([PLOT, COVER, ['AC_COVER', rect(8, 5, 4, 10)], ['AC_GREEN', rect(10, 0, 10, 14)]], {});
  assert.equal(coverIds(model).length, 2);
});
```

Run:
```bash
node _tests/extract.mjs $PLAN _tests/coverage/example-geometry.mjs && node _tests/extract.mjs $PLAN _tests/coverage/rules.test.js
node --test "_tests/coverage/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
```
Expected: `ℹ pass 11`, `ℹ fail 1`.

- [ ] **Step 2: Write the rules**

<!-- file: js/coverage/rules.js -->
```js
// Coverage pre-check: the figures of the coverage diagram (spec §5), as pure functions on the mapped outlines
// and the typed terms. No DOM, no engine: a remap or a term change re-runs this in a few milliseconds.
// v1 covers in-plan plots and housing. Every figure carries its article: a later change of the law is an edit
// to ARTICLES (and to the numbers below it names).
import { isClosed, isOpen, isBasement, LEVELS, SPACE_ROLES } from './mapping.js?v=20261015';
import { ringOf, centroid, assign } from './levels.js?v=20261015';

// The law the rules follow (spec §2): Ν.5306/2026 (ΦΕΚ Α' 88/08.06.2026) and circular ΥΠΕΝ/ΔΑΟΚΑ/15494/397/2026.
export const RULES_AS_OF = '2026-06-08';

// Code article, the old article in brackets (ΝΟΚ, Ν.4067/2012, or Ν.4495/2017 for the diagram's content) and
// the date the rule applies from.
const FROM = '2026-06-08';
export const ARTICLES = {
  plot: { code: '325 §3α', old: 'Ν.4495/2017 39 §3', from: FROM },
  coverage: { code: '207', old: 'ΝΟΚ 12', from: FROM },
  uncovered: { code: '207, 212', old: 'ΝΟΚ 12, 17', from: FROM },
  level: { code: '206 §5, §6', old: 'ΝΟΚ 11', from: FROM },
  basement: { code: '206 §6ι', old: 'ΝΟΚ 11 §6', from: FROM },
  stairs: { code: '206 §6δ, §6ε', old: 'ΝΟΚ 11 §6', from: FROM },
  attic: { code: '206 §6ιδ', old: 'ΝΟΚ 11 §6', from: FROM },
  pilotis: { code: '206 §6ιστ', old: 'ΝΟΚ 11 §6', from: FROM },
  caps: { code: '206 §5δ, §6α', old: 'ΝΟΚ 11', from: FROM },
  total: { code: '206', old: 'ΝΟΚ 11', from: FROM },
  volume: { code: '208', old: 'ΝΟΚ 13', from: FROM },
  height: { code: '210, 197 §89–90', old: 'ΝΟΚ 15, 2', from: FROM },
  planting: { code: '212 §2α', old: 'ΝΟΚ 17 §2α', from: FROM },
  coords: { code: '325 §3α', old: 'Ν.4495/2017 39 §3', from: FROM },
};

// The numbers the articles set.
export const LIMITS = {
  skWarn: 60,                         // 207 §1α: above this, the special cases are for the engineer to judge
  stairCommon: 30, stairCommonEntrance: 40, stairUnit: 25,   // 206 §6δ, §6ε (m² per outline per level)
  atticShare: 0.5,                    // 206 §6ιδ
  pilotisShare: 0.5,                  // 206 §6ιστ: of the coverage
  semiShare: 0.2, semiBalcShare: 0.4, // 206 §6α: of the permitted δόμηση
  basementMainShare: 0.5,             // 206 §6ι: housing, main use
  so: 5, soLow: 5.5, soLowHmax: 8.5,  // 208 §1
  plantingShare: 2 / 3, parkingPoints: 10,   // 212 §2α
  unitsLow: 20, unitsHigh: 1e6,       // plot areas that suggest the wrong units (spec §8)
};

// The ΕΓΣΑ87 range for Greece (spec §5.3), metres.
export const EGSA = { x0: 100000, x1: 1000000, y0: 3850000, y1: 4650000 };

export const DEFAULT_STOREY = 3.0;

// The terms a visitor types (spec §5.1). null: not typed.
export const DEFAULT_TERMS = {
  sd: null, sk: null, hmax: null, roofAllow: 2.0, h: null, roof: null,
  storey: {}, basementAbove: 0, roofVolume: 0, entrance: '00', parking: false,
};

// The example drawing's terms (spec §12).
export const EXAMPLE_TERMS = {
  sd: 0.8, sk: 60, hmax: 11, roofAllow: 2, h: 9.6, roof: 1.5,
  storey: { B1: 3, '00': 3.2, '01': 3, '02': 3 }, basementAbove: 0, roofVolume: 0, entrance: '00', parking: false,
};

// 210 §1: the default height for a ΣΔ, the hint beside Hmax.
export function defaultHmax(sd) {
  if (sd == null || !(sd > 0)) return null;
  const table = [[0.4, 10.75], [0.8, 14], [1.2, 17.25], [1.6, 19.5], [2.0, 22.75], [2.6, 26]];
  for (const [upTo, h] of table) if (sd <= upTo + 1e-12) return h;
  return Math.min(10 * sd, 32);
}

// Values are compared as shown, to the cent: a proposal of 300.004 m² against 300.00 permitted is within.
const r2 = v => Math.round(v * 100) / 100;
const within = (proposed, permitted) => (permitted == null || proposed == null ? null : r2(proposed) <= r2(permitted) + 1e-9);
const atLeast = (actual, required) => (required == null || actual == null ? null : r2(actual) >= r2(required) - 1e-9);
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const sum = (list, f = x => x.area) => list.reduce((a, x) => a + f(x), 0);

// The engine's result and the layer mapping, as the outlines the rules work on.
export function buildModel(result, map) {
  const m = { plot: [], cover: [], levels: [], spaces: [], green: [], excluded: [], mapped: 0 };
  (result.items || []).forEach((it, index) => {
    const r = map[it.layer];
    if (!r || r.role === 'ignore') return;
    if (!isClosed(it)) { if (isOpen(it)) m.excluded.push({ id: it.id, index, layer: it.layer, role: r.role, why: 'open' }); return; }
    if (it.bad) { m.excluded.push({ id: it.id, index, layer: it.layer, role: r.role, why: 'bad' }); return; }
    const ring = ringOf(it);
    const o = { id: it.id, index, layer: it.layer, role: r.role, area: it.area, ring, verts: it.verts || null, c: centroid(ring) };
    m.mapped++;
    if (r.role === 'plot') m.plot.push(o);
    else if (r.role === 'cover') m.cover.push(o);
    else if (r.role === 'green') m.green.push(o);
    else if (r.role === 'level') m.levels.push({ ...o, level: r.level });
    else if (SPACE_ROLES.includes(r.role)) m.spaces.push(o);
  });
  m.spaces = assign(m.levels, m.spaces);
  return m;
}

// The coverage outlines the union is asked for (spec §3: only a changed coverage mapping calls the engine).
export const coverIds = model => model.cover.map(o => o.id).sort();

const levelOrder = lv => LEVELS.indexOf(lv);

// All the figures. union: the engine's answer for coverIds(model), or null while it is pending.
export function evaluate(model, termsIn, union) {
  const terms = { ...DEFAULT_TERMS, ...termsIn, storey: { ...(termsIn && termsIn.storey) } };
  const warnings = [];
  const W = (id, params = {}, ids = []) => warnings.push({ id, params, ids });
  for (const x of model.excluded) W(x.why === 'open' ? 'open' : 'bad', { layer: x.layer }, [x.id]);

  if (model.plot.length !== 1) {
    return { blocked: model.plot.length ? 'plot-many' : 'plot-missing', warnings, plotIds: model.plot.map(p => p.id) };
  }
  const plot = model.plot[0];
  const E = plot.area;
  const sd = num(terms.sd), sk = num(terms.sk), hmax = num(terms.hmax);
  if (E < LIMITS.unitsLow || E > LIMITS.unitsHigh) W('units-check', { area: E });
  if (sk != null && sk > LIMITS.skWarn) W('sk-high', { sk });

  // ---- coverage (207): the union of the coverage outlines ----
  const coverSum = sum(model.cover);
  let cov = coverSum, unionState = 'none';
  if (!model.cover.length) W('no-cover');
  else if (!union) unionState = 'pending';
  else if (union.error) { unionState = 'failed'; W('union-failed', {}, model.cover.map(o => o.id)); }
  else { cov = union.area; unionState = 'ok'; }
  const coverage = {
    area: cov, sum: coverSum, state: unionState, ratio: E > 0 ? cov / E : 0,
    permitted: sk != null ? (sk / 100) * E : null, ids: model.cover.map(o => o.id),
  };
  coverage.mark = within(cov, coverage.permitted);

  // ---- levels and their spaces (206) ----
  for (const s of model.spaces) if (s.level == null) W(s.why === 'far' ? 'balcony-far' : 'no-level', { layer: s.layer }, [s.id]);
  const keys = [...new Set(model.levels.map(l => l.level))].sort((a, b) => levelOrder(a) - levelOrder(b));
  if (!keys.length) W('no-levels');
  const grossOf = lv => sum(model.levels.filter(l => l.level === lv));
  const pilotisTotal = sum(model.spaces.filter(s => s.level != null && s.role === 'pilotis'));
  const pilotisValid = pilotisTotal > 0 ? r2(pilotisTotal) >= r2(LIMITS.pilotisShare * cov) - 1e-9 : null;
  if (pilotisValid === false) W('pilotis-small', { share: cov > 0 ? (100 * pilotisTotal) / cov : 0 });

  const levels = keys.map(lv => {
    const outlines = model.levels.filter(l => l.level === lv);
    const gross = sum(outlines);
    const spaces = model.spaces.filter(s => s.level === lv);
    const lines = [];
    let domisi;
    if (isBasement(lv)) {
      // 206 §6ι (housing, one auxiliary basement): only 50 % of the main-use spaces counts; the rest is excluded.
      const main = sum(spaces.filter(s => s.role === 'bsmtMain'));
      for (const s of spaces) lines.push({ id: s.id, role: s.role, area: s.area, excluded: s.role === 'bsmtMain' ? s.area * (1 - LIMITS.basementMainShare) : 0, note: s.role === 'bsmtMain' ? 'bsmt-half' : 'in-basement' });
      domisi = LIMITS.basementMainShare * main;
      lines.push({ role: 'basementRest', area: gross - main, excluded: gross - main, note: 'bsmt-rest' });
    } else if (lv === 'ATTIC') {
      // 206 §6ιδ: the stair up to the attic is not counted, and of the rest only what exceeds half of the level
      // below counts (Aris ruled 2026-09-29, as the 2022 template: check area = attic gross − its stairs).
      const below = keys.filter(k => !isBasement(k) && k !== 'ATTIC').pop();
      const belowGross = below ? grossOf(below) : 0;
      if (!below) W('attic-alone');
      let stairs = 0;
      for (const s of spaces) {
        const stair = s.role === 'stairCommon' || s.role === 'stairUnit';
        if (stair) stairs += s.area;
        lines.push({ id: s.id, role: s.role, area: s.area, excluded: stair ? s.area : 0, note: stair ? 'attic-stair' : 'in-attic' });
      }
      const check = gross - stairs;
      domisi = Math.max(check - LIMITS.atticShare * belowGross, 0);
      lines.push({ role: 'atticRest', area: check, excluded: check - domisi, note: 'attic-half', params: { below, belowGross } });
    } else {
      let d = gross;
      for (const s of spaces) {
        const line = { id: s.id, role: s.role, area: s.area, excluded: 0 };
        switch (s.role) {
          case 'semiopen': case 'void': case 'exclOther':
            line.excluded = s.area; break;
          case 'stairCommon': {
            const cap = lv === terms.entrance ? LIMITS.stairCommonEntrance : LIMITS.stairCommon;
            line.cap = cap; line.excluded = Math.min(s.area, cap); line.counts = s.area - line.excluded; break;
          }
          case 'stairUnit':
            line.cap = LIMITS.stairUnit; line.excluded = Math.min(s.area, LIMITS.stairUnit); line.counts = s.area - line.excluded; break;
          case 'pilotis':
            line.excluded = pilotisValid ? s.area : 0; line.note = pilotisValid ? 'pilotis-ok' : 'pilotis-small'; break;
          case 'mezz':
            line.added = s.area; line.note = 'mezz'; break;
          case 'balcony':
            line.note = 'balcony'; break;
          case 'bsmtMain':
            line.note = 'bsmt-not-basement'; W('bsmt-not-basement', { layer: s.layer }, [s.id]); break;
        }
        d += (line.added || 0) - line.excluded;
        lines.push(line);
      }
      domisi = d;
    }
    return { level: lv, gross, ids: outlines.map(o => o.id), lines, domisi };
  });

  // ---- semi-open and balcony caps (206 §5δ, §6α) ----
  const semi = sum(model.spaces.filter(s => s.level != null && s.role === 'semiopen'));
  const balc = sum(model.spaces.filter(s => s.level != null && s.role === 'balcony'));
  const P = sd != null ? sd * E : null;
  const caps = { semi, balc, P, semiCap: null, totalCap: null, overflow: 0, checked: P != null };
  if (P != null) {
    caps.semiCap = LIMITS.semiShare * P;
    caps.totalCap = LIMITS.semiBalcShare * P;
    // The overflow that counts in δόμηση is counted once: the larger of the two excesses.
    caps.overflow = Math.max(semi - caps.semiCap, semi + balc - caps.totalCap, 0);
    caps.semiMark = within(semi, caps.semiCap);
    caps.totalMark = within(semi + balc, caps.totalCap);
  }
  caps.semiIds = model.spaces.filter(s => s.level != null && s.role === 'semiopen').map(s => s.id);
  caps.balcIds = model.spaces.filter(s => s.level != null && s.role === 'balcony').map(s => s.id);

  // ---- δόμηση total (206) ----
  const total = sum(levels, l => l.domisi) + caps.overflow;
  const domisi = { total, sd: E > 0 ? total / E : 0, permitted: P, mark: within(total, P) };

  // ---- volume (208) ----
  const storeyOf = lv => { const v = num(terms.storey[lv]); return v != null ? v : DEFAULT_STOREY; };
  const volLines = [];
  for (const l of levels) {
    if (isBasement(l.level)) continue;
    // 208 §2β: a pilotis excluded from δόμηση (206 §6ιστ) adds no volume either (Aris ruled 2026-09-29).
    const voids = sum(l.lines.filter(x => x.role === 'void' || (x.role === 'pilotis' && pilotisValid)));
    volLines.push({ level: l.level, area: l.gross - voids, height: storeyOf(l.level), volume: (l.gross - voids) * storeyOf(l.level) });
  }
  const topBasement = levels.filter(l => isBasement(l.level)).pop();
  const bAbove = num(terms.basementAbove) || 0;
  if (topBasement && bAbove > 0) volLines.push({ level: topBasement.level, area: topBasement.gross, height: bAbove, volume: topBasement.gross * bAbove, basement: true });
  const roofV = num(terms.roofVolume) || 0;
  const V = sum(volLines, x => x.volume) + roofV;
  const so = sd != null ? (hmax != null && hmax <= LIMITS.soLowHmax + 1e-9 ? LIMITS.soLow : LIMITS.so) * sd : null;
  const volume = { V, lines: volLines, roof: roofV, so, permitted: so != null ? so * E : null, achievedSo: E > 0 ? V / E : 0 };
  volume.mark = within(V, volume.permitted);

  // ---- height (210, 197 §89–90): a check on typed values ----
  const h = num(terms.h), roof = num(terms.roof), roofAllow = num(terms.roofAllow);
  const height = { hmax, roofAllow, h, roof, hint: defaultHmax(sd) };
  height.mark = hmax != null && h != null && roofAllow != null && roof != null ? within(h, hmax) && within(roof, roofAllow) : null;

  // ---- planting (212 §2α) ----
  const actual = sum(model.green);
  let planting = { actual, mandatory: null, required: null, ids: model.green.map(o => o.id) };
  if (sk != null) {
    const share = sk / 100 + (terms.parking ? LIMITS.parkingPoints / 100 : 0);
    planting.mandatory = E - share * E;
    planting.required = LIMITS.plantingShare * planting.mandatory;
  }
  planting.mark = atLeast(actual, planting.required);

  // ---- coordinates (325 §3α) ----
  const coords = coordinates(plot, model, union, unionState);
  if (!coords.egsa) W('not-egsa');

  return {
    blocked: null, warnings, terms,
    plot: { area: E, id: plot.id }, coverage, uncovered: E - cov,
    levels, caps, domisi, volume, height, planting, pilotis: { total: pilotisTotal, valid: pilotisValid },
    coords,
  };
}

// Vertex rows: { n, x, y, arc } where arc says the edge to the next vertex is an arc.
function vertexRows(verts, start = 1) {
  const rows = [];
  for (let i = 0; i + 2 < verts.length; i += 3) rows.push({ n: start + rows.length, x: verts[i], y: verts[i + 1], arc: verts[i + 2] !== 0 });
  return rows;
}

function coordinates(plot, model, union, unionState) {
  const plotRows = plot.verts ? vertexRows(plot.verts) : [];
  const building = [];
  if (unionState === 'ok') {
    let n = 1;
    union.verts.forEach((v, part) => { const rows = vertexRows(v, n); n += rows.length; building.push({ part, rows }); });
  } else if (unionState === 'failed' || unionState === 'pending') {
    let n = 1;
    model.cover.forEach((o, part) => { if (!o.verts) return; const rows = vertexRows(o.verts, n); n += rows.length; building.push({ part, rows }); });
  }
  const pts = plot.verts ? plotRows.map(r => [r.x, r.y]) : plot.ring;
  const egsa = pts.length > 0 && pts.every(([x, y]) => x >= EGSA.x0 && x <= EGSA.x1 && y >= EGSA.y0 && y <= EGSA.y1);
  return { plot: plotRows, plotHasVerts: !!plot.verts, building, egsa };
}
```

Run: `node _tests/extract.mjs $PLAN js/coverage/rules.js && node --test "_tests/coverage/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 38`, `ℹ fail 0`.

If a test fails, fix the rules, not the test: every expected number is worked out by hand in the test (and the ledger's own hand values were re-derived once, after one was found wrong).

- [ ] **Step 3: Commit**

```bash
git add js/coverage/rules.js _tests/coverage/example-geometry.mjs _tests/coverage/rules.test.js
git commit -F - <<'EOF'
Coverage pre-check: the rules of spec §5 and the example's numbers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 4: The tool's strings and the generated drawings

The generator takes the template's Greek role names from the tool's strings, so both arrive in this task. `i18n.test.js` (key parity, the Italian ’, the page's inline Greek) comes in Task 12, once the page and the controller that use the keys exist.

**Files:**
- Create: `js/coverage/i18n-coverage.js`, `_tests/coverage/make-examples.mjs`
- Generate (binary, never typed): `js/coverage/examples/example-permit.dxf`, `js/coverage/examples/layer-template.dxf`, `_tests/coverage/fixtures/union.dxf`
- Test: `_tests/coverage/examples.test.js`

**Interfaces:**
- Consumes: `TEMPLATE` (Task 1), `OUTLINES`, `OPEN`, `inSurvey` (Task 3), `dxf2000`, `dxfR12`, `cp1253` (Task 1).
- Produces:
  - `window.CP_I18N = { el, en, it }`, 241 `cp.*` keys per language. It includes `cp.role.*`, `cp.level.*`, `cp.art.*`, `cp.warn.*`, `cp.err.*`, `cp.note.*`, `cp.unit.*`, `cp.units.src.*`, `cp.block.*` and `cp.fig.*`. The page merges it into `window.GV_I18N` in Task 10.
  - `node _tests/coverage/make-examples.mjs [--check]`: writes the three drawings, or exits 1 if a committed one differs.
  - The example drawing the page loads (Task 11) and the engine tests read (Task 5); the template the page links; the union fixture of Task 6.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/coverage/examples.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cp1253, dxf2000 } from './dxf-writer.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = p => readFileSync(new URL(`../../${p}`, import.meta.url));

test('the committed drawings are exactly what the generator writes', () => {
  // Exits non-zero when a committed file differs.
  execFileSync(process.execPath, ['_tests/coverage/make-examples.mjs', '--check'], { cwd: root, stdio: 'pipe' });
});

test('the example states metres and its integer group codes carry no decimal point', () => {
  const text = read('js/coverage/examples/example-permit.dxf').toString('latin1');
  assert.ok(text.includes('  9\r\n$INSUNITS\r\n 70\r\n6\r\n'), '$INSUNITS 6 (a "6.0" there is silently read as millimetres)');
  assert.ok(text.includes('LWPOLYLINE\r\n  5\r\n'), 'handles');
  assert.ok(!/\r\n (?:62|70|90)\r\n-?\d+\.\d/.test(text), 'no real in an integer group');
  assert.ok(text.includes(' 10\r\n410000.0\r\n 20\r\n4495000.0\r\n'), 'the plot in ΕΓΣΑ87');
});

test('the template is R12 with its Greek legend in Windows-1253', () => {
  const bytes = read('js/coverage/examples/layer-template.dxf');
  const text = new TextDecoder('windows-1253').decode(bytes);
  assert.ok(text.includes('$ACADVER\r\n  1\r\nAC1009') && text.includes('$DWGCODEPAGE\r\n  3\r\nANSI_1253'));
  assert.ok(text.includes('AC_PLOT  Οικόπεδο') && text.includes('AC_LVL_B1  Περίγραμμα στάθμης - Υπόγειο -1'), text.slice(-900));
  assert.ok(![...bytes].some(b => b === 0xc2 || b === 0xce), 'no UTF-8 lead bytes');
});

test('the writer refuses characters Windows-1253 cannot hold, and integers written as reals', () => {
  assert.deepEqual([...cp1253('Αω§')], [0xc1, 0xf9, 0xa7]);
  assert.throws(() => cp1253('−'), /U\+2212/);
  assert.throws(() => dxf2000({ units: 6.5, layers: [], polylines: [] }), /integer/);
});
```

Run: `node _tests/extract.mjs $PLAN _tests/coverage/examples.test.js && node --test "_tests/coverage/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 39`, `ℹ fail 3` (the generator and the drawings are missing; the writer's own test passes).

- [ ] **Step 2: Write the strings and the generator**

<!-- file: js/coverage/i18n-coverage.js -->
```js
// Coverage pre-check strings (GR/EN/IT). The page merges them under its own inline keys into window.GV_I18N,
// which the shared shell's t() reads. Placeholders are {name}; every language has the same keys and
// placeholders. Greek legal terms stay in Greek in the English and Italian tables, with the translation beside
// them: they are the terms of a Greek permit.
window.CP_I18N = {
  el: {
    "cp.eyebrow": "Δωρεάν εργαλείο",
    "cp.title": "Προέλεγχος διαγράμματος κάλυψης",
    "cp.lede": "Ρίξτε το DWG ή DXF της άδειας και πάρτε τα μεγέθη του διαγράμματος κάλυψης: κάλυψη, δόμηση, όγκο, φύτευση, αναλυτικό πίνακα επιφανειών και συντεταγμένες κορυφών, απέναντι στους όρους δόμησης.",
    "cp.privacy": "Τα αρχεία μένουν στον υπολογιστή σας· τίποτα δεν ανεβαίνει.",
    "cp.indicative": "Ενδεικτικός προέλεγχος — όχι επίσημος υπολογισμός.",
    "cp.cross": "Όλα τα δωρεάν εργαλεία →",
    "cp.open": "Άνοιγμα αρχείου",
    "cp.example": "Φόρτωση παραδείγματος",
    "cp.template": "Λήψη προτύπου στρώσεων (DXF)",
    "cp.template.names": "Τα ονόματα στρώσεων του προτύπου",
    "cp.template.text": "Στρώσεις με αυτά τα ονόματα (χωρίς διάκριση πεζών-κεφαλαίων, -, _ ή κενών) αντιστοιχίζονται μόνες τους.",
    "cp.drop": "Σύρετε εδώ ένα αρχείο DWG ή DXF, ή πατήστε «Άνοιγμα αρχείου».",
    "cp.clear": "Καθαρισμός",
    "cp.engine.loading": "Φόρτωση της μηχανής γεωμετρίας, περίπου 12 MB, μόνο την πρώτη φορά… {pct} %",
    "cp.engine.failed": "Η μηχανή γεωμετρίας δεν ξεκίνησε σε αυτόν τον browser.",
    "cp.engine.retry": "Δοκιμάστε ξανά",
    "cp.engine.nowasm": "Ο browser σας δεν υποστηρίζει WebAssembly, που χρειάζεται το εργαλείο. Δοκιμάστε μια πρόσφατη έκδοση Chrome, Edge, Firefox ή Safari.",
    "cp.example.failed": "Το παράδειγμα δεν φορτώθηκε. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.",
    "cp.processing": "Ανάγνωση του σχεδίου…",
    "cp.union.pending": "Υπολογισμός της κάλυψης…",
    "cp.err.read": "Το αρχείο δεν διαβάζεται ως DWG ή DXF.",
    "cp.err.version": "Αυτή η έκδοση DWG δεν υποστηρίζεται. Αποθηκεύστε το ως DWG 2018 ή DXF και δοκιμάστε ξανά.",
    "cp.err.limit": "Το αρχείο ξεπερνά τα όρια του εργαλείου (30 MB, 300.000 οντότητες).",
    "cp.err.timeout": "Η ανάγνωση άργησε υπερβολικά και σταμάτησε.",
    "cp.err.engine": "Η μηχανή γεωμετρίας σταμάτησε σε αυτό το αρχείο.",
    "cp.err.empty": "Ο χώρος μοντέλου είναι κενός· το σχέδιο βρίσκεται στον χώρο χαρτιού.",
    "cp.err.blank": "Το σχέδιο είναι κενό.",
    "cp.err.nooutlines": "Κανένα κλειστό περίγραμμα στον χώρο μοντέλου. Το εργαλείο μετρά κλειστές πολυγραμμές, κύκλους και κλειστές καμπύλες.",
    "cp.units.line": "Μονάδες: {units} ({source})",
    "cp.units.src.file": "από το αρχείο",
    "cp.units.src.setting": "από τη ρύθμιση",
    "cp.units.src.assumed": "υπόθεση: το αρχείο δεν δηλώνει μονάδες",
    "cp.units.src.override": "δική σας διόρθωση",
    "cp.units.change": "Αλλαγή μονάδων:",
    "cp.units.fromFile": "όπως δηλώνει το αρχείο",
    "cp.units.fromSettings": "χιλιοστά (το αρχείο δεν δηλώνει)",
    "cp.unit.mm": "χιλιοστά (mm)",
    "cp.unit.cm": "εκατοστά (cm)",
    "cp.unit.m": "μέτρα (m)",
    "cp.unit.inch": "ίντσες (in)",
    "cp.unit.ft": "πόδια (ft)",
    "cp.step1": "1. Στρώσεις",
    "cp.step1.hint": "Δώστε σε κάθε στρώση τον ρόλο της. Οι στρώσεις του προτύπου συμπληρώνονται μόνες τους· οι άλλες θυμούνται την τελευταία σας επιλογή σε αυτόν τον browser.",
    "cp.layers.other": "Άλλες στρώσεις, χωρίς κλειστά περιγράμματα (δεν χρησιμοποιούνται): {n}",
    "cp.layers.auto": "{n} στρώσεις αντιστοιχίστηκαν από τα ονόματα του προτύπου.",
    "cp.layers.bad": "{n} ανοιχτά ή αυτοτεμνόμενα",
    "cp.col.layer": "Στρώση",
    "cp.col.outlines": "Περιγράμματα",
    "cp.col.area": "Εμβαδόν (m²)",
    "cp.col.role": "Ρόλος",
    "cp.col.level": "Στάθμη",
    "cp.col.figure": "Μέγεθος",
    "cp.col.article": "Άρθρο",
    "cp.col.permitted": "Επιτρεπόμενο",
    "cp.col.proposed": "Πραγματοποιούμενο",
    "cp.col.permittedText": "Επιτρεπόμενο (κείμενο)",
    "cp.col.proposedText": "Πραγματοποιούμενο (κείμενο)",
    "cp.col.mark": "Έλεγχος",
    "cp.col.note": "Σημείωση",
    "cp.col.unit": "Μον.",
    "cp.role.plot": "Οικόπεδο",
    "cp.role.cover": "Κάλυψη",
    "cp.role.level": "Περίγραμμα στάθμης",
    "cp.role.mezz": "Πατάρι",
    "cp.role.semiopen": "Ημιυπαίθριος",
    "cp.role.balcony": "Εξώστης",
    "cp.role.stairCommon": "Κοινόχρηστο κλιμακοστάσιο",
    "cp.role.stairUnit": "Εσωτερική κλίμακα",
    "cp.role.void": "Φωταγωγός, αίθριο, κενό",
    "cp.role.pilotis": "Πυλωτή",
    "cp.role.bsmtMain": "Υπόγειο κύριας χρήσης",
    "cp.role.exclOther": "Άλλο εκτός ΣΔ (206 §6)",
    "cp.role.green": "Φύτευση",
    "cp.role.ignore": "Αγνόηση",
    "cp.role.basementRest": "Υπόλοιπο υπογείου εκτός ΣΔ",
    "cp.role.atticRest": "Σοφίτα χωρίς κλίμακα, εντός ½ του υποκείμενου ορόφου",
    "cp.level.B2": "Υπόγειο −2",
    "cp.level.B1": "Υπόγειο −1",
    "cp.level.00": "Ισόγειο",
    "cp.level.01": "1ος όροφος",
    "cp.level.02": "2ος όροφος",
    "cp.level.03": "3ος όροφος",
    "cp.level.04": "4ος όροφος",
    "cp.level.05": "5ος όροφος",
    "cp.level.06": "6ος όροφος",
    "cp.level.07": "7ος όροφος",
    "cp.level.08": "8ος όροφος",
    "cp.level.09": "9ος όροφος",
    "cp.level.ATTIC": "Σοφίτα",
    "cp.step2": "2. Όροι δόμησης και ύψη",
    "cp.step2.hint": "Όπως τους γράφει το τοπογραφικό. Αποθηκεύονται μόνο σε αυτόν τον browser.",
    "cp.term.sd": "Συντελεστής δόμησης ΣΔ",
    "cp.term.sd.hint": "Με πολλά πρόσωπα, γράψτε τον σταθμισμένο ΣΔ (206 §2).",
    "cp.term.sk": "Ποσοστό κάλυψης Σ.Κ. (%)",
    "cp.term.sk.hint": "Πάνω από 60% ισχύουν ειδικές περιπτώσεις (207 §1α).",
    "cp.term.hmax": "Μέγιστο ύψος Hmax (m)",
    "cp.term.hmax.hint": "Για τον ΣΔ που γράψατε, το 210 §1 δίνει {h} m, αν οι όροι της περιοχής δεν ορίζουν άλλο.",
    "cp.term.roofAllow": "Επιτρεπόμενη στέγη (m)",
    "cp.term.h": "Πραγματοποιούμενο ύψος H (m)",
    "cp.term.roof": "Ύψος στέγης (m)",
    "cp.term.storey": "Ύψος ορόφου: {level} (m)",
    "cp.term.storey.hint": "Από στάθμη σε στάθμη δαπέδου· 3,00 m αν δεν γράψετε άλλο.",
    "cp.term.basementAbove": "Υπόγειο πάνω από το οριστικό έδαφος (m)",
    "cp.term.roofVolume": "Όγκος στέγης (m³)",
    "cp.term.roofVolume.hint": "Μόνο αν η στέγη δεν είναι υποχρεωτική (208 §2).",
    "cp.term.entrance": "Στάθμη εισόδου",
    "cp.term.parking": "Υπαίθριες θέσεις στάθμευσης στο οικόπεδο",
    "cp.yes": "Ναι",
    "cp.no": "Όχι",
    "cp.results": "3. Αποτελέσματα",
    "cp.rules.asof": "Κανόνες: Ν.5306/2026 (08.06.2026) και εγκύκλιος 15494/397/2026.",
    "cp.block.ydom": "Ελέγχονται από την Υ.ΔΟΜ",
    "cp.block.sworn": "Στην υπεύθυνη δήλωσή σας",
    "cp.fig.plot": "Εμβαδόν οικοπέδου Εοικ",
    "cp.fig.coverage": "Κάλυψη",
    "cp.fig.uncovered": "Ακάλυπτος χώρος",
    "cp.fig.volume": "Όγκος",
    "cp.fig.height": "Ύψος + στέγη",
    "cp.fig.planting": "Φύτευση",
    "cp.fig.setbacks": "Αποστάσεις Δ και δ",
    "cp.fig.parking": "Θέσεις στάθμευσης",
    "cp.fig.level": "Δόμηση: {level}",
    "cp.fig.pilotis": "Πυλωτή (≥ 50% της κάλυψης)",
    "cp.fig.semi": "Ημιυπαίθριοι (όριο 0,20 × επιτρ. δόμησης = {cap} m²)",
    "cp.fig.semiBalc": "Ημιυπαίθριοι + εξώστες (όριο 0,40 × επιτρ. δόμησης = {cap} m²)",
    "cp.fig.semiNoSd": "Ημιυπαίθριοι (όριο 0,20 × επιτρ. δόμησης)",
    "cp.fig.semiBalcNoSd": "Ημιυπαίθριοι + εξώστες (όριο 0,40 × επιτρ. δόμησης)",
    "cp.fig.total": "Δόμηση συνολικά",
    "cp.notv1": "όχι στην έκδοση 1",
    "cp.need.sd": "γράψτε ΣΔ",
    "cp.need.sk": "γράψτε Σ.Κ.",
    "cp.need.height": "γράψτε τα ύψη",
    "cp.sub.so": "σ.ο. {v}",
    "cp.sub.sd": "ΣΔ {v}",
    "cp.sub.overflow": "πλεόνασμα {v} m² μετρά στη δόμηση",
    "cp.mark.ok": "εντός",
    "cp.mark.over": "υπέρβαση",
    "cp.assume.storey": "Ο όγκος υπολογίζεται με ύψος ορόφου από στάθμη σε στάθμη δαπέδου (υπόθεση).",
    "cp.art.chip": "Κώδ. {code} ({old})",
    "cp.art.plot": "Το εμβαδόν του κλειστού περιγράμματος του οικοπέδου.",
    "cp.art.coverage": "Η ένωση των προβολών όλων των περιγραμμάτων κάλυψης, ημιυπαίθριοι μαζί· επιτρέπεται Σ.Κ. × Εοικ.",
    "cp.art.uncovered": "Εοικ μείον την κάλυψη.",
    "cp.art.level": "Μικτό εμβαδόν στάθμης μείον ημιυπαίθριους, το εξαιρούμενο μέρος των κλιμάκων, κενά, πυλωτή και δηλωμένες εξαιρέσεις, συν τα πατάρια.",
    "cp.art.basement": "Κατοικία: από το υπόγειο μετρά μόνο το 50% των χώρων κύριας χρήσης.",
    "cp.art.stairs": "Κοινόχρηστο κλιμακοστάσιο έως 30 m² ανά στάθμη (40 m² στην είσοδο)· εσωτερική κλίμακα έως 25 m². Το υπόλοιπο μετρά.",
    "cp.art.attic": "Η κλίμακα προς τη σοφίτα δεν μετρά· από την υπόλοιπη σοφίτα μετρά μόνο ό,τι ξεπερνά το ½ του υποκείμενου ορόφου.",
    "cp.art.pilotis": "Η πυλωτή εξαιρείται μόνο αν είναι τουλάχιστον το 50% της κάλυψης.",
    "cp.art.caps": "Ημιυπαίθριοι έως 0,20 και ημιυπαίθριοι μαζί με εξώστες έως 0,40 της επιτρεπόμενης δόμησης· το πλεόνασμα μετρά μία φορά.",
    "cp.art.total": "Άθροισμα της δόμησης των σταθμών συν το πλεόνασμα ημιυπαίθριων και εξωστών· επιτρέπεται ΣΔ × Εοικ.",
    "cp.art.volume": "Σ (μικτό − κενά − πυλωτή εκτός ΣΔ) × ύψος ορόφου, συν το υπόγειο πάνω από το έδαφος και τη στέγη· επιτρέπεται 5 × ΣΔ × Εοικ, ή 5,5 × ΣΔ × Εοικ με Hmax ≤ 8,50 m.",
    "cp.art.height": "Το ύψος και η στέγη που γράψατε, απέναντι στο Hmax και την επιτρεπόμενη στέγη.",
    "cp.art.planting": "Τα ⅔ του υποχρεωτικά ακάλυπτου (Εοικ − Σ.Κ. × Εοικ, ή Σ.Κ. + 10% με υπαίθρια στάθμευση) φυτεύονται.",
    "cp.art.coords": "Οι κορυφές του οικοπέδου και του κτιρίου σε ΕΓΣΑ87.",
    "cp.schedule": "Αναλυτικός πίνακας επιφανειών",
    "cp.sch.col.item": "Επιφάνεια",
    "cp.sch.col.area": "Εμβαδόν (m²)",
    "cp.sch.col.excluded": "Εκτός ΣΔ (m²)",
    "cp.sch.col.counts": "Εντός ΣΔ (m²)",
    "cp.sch.gross": "Μικτό εμβαδόν στάθμης",
    "cp.sch.levelDomisi": "Δόμηση: {level}",
    "cp.sch.cap": "όριο {cap} m²",
    "cp.sch.capExcess": "τα {v} m² πάνω από το όριο μένουν στη δόμηση",
    "cp.sch.capWithin": "εντός ορίου",
    "cp.sch.totals": "Σύνολα",
    "cp.sch.sumLevels": "Άθροισμα δόμησης σταθμών",
    "cp.sch.overflow": "Πλεόνασμα ημιυπαίθριων και εξωστών",
    "cp.sch.mezzNote": "Τα πατάρια μετρούν στη δόμηση από τον Ν.5197/2025· η εξαίρεση πατάρι του προτύπου του 2022 δεν ισχύει πια.",
    "cp.note.bsmt-half": "μετρά το 50% (206 §6ι)",
    "cp.note.in-basement": "μέσα στο υπόγειο, εκτός ΣΔ",
    "cp.note.bsmt-rest": "βοηθητικό υπόγειο, εκτός ΣΔ (206 §6ι)",
    "cp.note.in-attic": "μέσα στη σοφίτα",
    "cp.note.attic-stair": "η κλίμακα προς τη σοφίτα δεν μετρά (206 §6ιδ)",
    "cp.note.attic-half": "½ του υποκείμενου ορόφου ({below}) = {half} m²",
    "cp.note.pilotis-ok": "≥ 50% της κάλυψης: εκτός ΣΔ",
    "cp.note.pilotis-small": "κάτω από το 50% της κάλυψης: μετρά στη δόμηση",
    "cp.note.mezz": "μετρά στη δόμηση",
    "cp.note.balcony": "μετρά μόνο στο όριο 0,40",
    "cp.note.bsmt-not-basement": "υπόγειο κύριας χρήσης σε στάθμη που δεν είναι υπόγειο: δεν μετρήθηκε",
    "cp.note.capsUnchecked": "χωρίς ΣΔ τα όρια δεν ελέγχονται και δεν προστίθεται τίποτα",
    "cp.note.parking": "με υπαίθρια στάθμευση: Σ.Κ. + 10%",
    "cp.coords": "Συντεταγμένες κορυφών ΕΓΣΑ87",
    "cp.coords.plot": "Κορυφές οικοπέδου",
    "cp.coords.building": "Κορυφές κτιρίου (περίγραμμα κάλυψης)",
    "cp.coords.col.n": "Α/Α",
    "cp.coords.col.x": "X",
    "cp.coords.col.y": "Y",
    "cp.coords.arc": "(τόξο ως την επόμενη)",
    "cp.coords.part": "Τμήμα {n}",
    "cp.coords.noVerts": "Το οικόπεδο δεν είναι πολυγραμμή· δεν έχει κορυφές να καταγραφούν.",
    "cp.coords.approx": "Η ένωση δεν υπολογίστηκε: οι κορυφές είναι των περιγραμμάτων κάλυψης όπως σχεδιάστηκαν.",
    "cp.warnings": "Προειδοποιήσεις",
    "cp.warn.none": "Καμία προειδοποίηση.",
    "cp.warn.show": "Εμφάνιση στο σχέδιο",
    "cp.warn.open": "Ανοιχτό περίγραμμα στη στρώση {layer}: δεν μετρήθηκε.",
    "cp.warn.bad": "Αυτοτεμνόμενο περίγραμμα στη στρώση {layer}: δεν μετρήθηκε.",
    "cp.warn.no-level": "Χώρος στη στρώση {layer} έξω από κάθε περίγραμμα στάθμης: δεν μετρήθηκε.",
    "cp.warn.balcony-far": "Εξώστης στη στρώση {layer} πάνω από 0,50 m μακριά από κάθε περίγραμμα στάθμης: δεν μετρήθηκε.",
    "cp.warn.units-check": "Εμβαδόν οικοπέδου {area} m²: ελέγξτε τις μονάδες του σχεδίου.",
    "cp.warn.sk-high": "Σ.Κ. {sk}% πάνω από 60%: οι ειδικές περιπτώσεις του 207 §1α είναι δική σας κρίση.",
    "cp.warn.no-cover": "Καμία στρώση κάλυψης: η κάλυψη είναι 0.",
    "cp.warn.union-failed": "τα περιγράμματα επικαλύπτονται ή εφάπτονται· η ένωση δεν υπολογίστηκε, φαίνεται το άθροισμα",
    "cp.warn.no-levels": "Καμία στρώση περιγράμματος στάθμης: η δόμηση και ο όγκος είναι 0.",
    "cp.warn.pilotis-small": "Η πυλωτή είναι το {share}% της κάλυψης, κάτω από 50%: μετρά στη δόμηση.",
    "cp.warn.attic-alone": "Σοφίτα χωρίς υποκείμενο όροφο: μετρά ολόκληρη.",
    "cp.warn.bsmt-not-basement": "Υπόγειο κύριας χρήσης (στρώση {layer}) σε στάθμη που δεν είναι υπόγειο: δεν μετρήθηκε.",
    "cp.warn.not-egsa": "Οι συντεταγμένες δεν είναι σε ΕΓΣΑ87: το σχέδιο δεν είναι γεωαναφερμένο ή οι μονάδες του είναι λάθος.",
    "cp.block.plot-missing": "Αντιστοιχίστε ακριβώς ένα περίγραμμα οικοπέδου: δεν βρέθηκε κανένα.",
    "cp.block.plot-many": "Αντιστοιχίστε ακριβώς ένα περίγραμμα οικοπέδου: βρέθηκαν {n}.",
    "cp.drawing": "Σχέδιο",
    "cp.fit": "Προσαρμογή",
    "cp.zoomin": "Μεγέθυνση",
    "cp.zoomout": "Σμίκρυνση",
    "cp.aria.drawing": "Σχέδιο με τα αντιστοιχισμένα περιγράμματα",
    "cp.aria.files": "Αρχείο",
    "cp.tip.layer": "Στρώση",
    "cp.tip.role": "Ρόλος",
    "cp.tip.area": "Εμβαδόν",
    "cp.tip.level": "Στάθμη",
    "cp.legend": "Υπόμνημα",
    "cp.xlsx": "Λήψη Excel (.xlsx)",
    "cp.copy": "Αντιγραφή",
    "cp.copied": "Αντιγράφηκε",
    "cp.print": "Εκτύπωση / PDF",
    "cp.sheet.summary": "Σύνοψη",
    "cp.sheet.schedule": "Αναλυτικός πίνακας",
    "cp.sheet.coords": "Συντεταγμένες",
    "cp.sheet.mapping": "Αντιστοίχιση",
    "cp.xlsx.inputs": "Δεδομένα που γράψατε",
    "cp.xlsx.units": "Μονάδες σχεδίου: {units}",
    "cp.xlsx.warnings": "Προειδοποιήσεις",
    "cp.disclaimer": "Ενδεικτικός προέλεγχος — όχι επίσημος υπολογισμός. Το διάγραμμα κάλυψης το συντάσσει και το υπογράφει ο μηχανικός.",
    "cp.cta.title": "Το διάγραμμα κάλυψης μέσα στο CAD σας;",
    "cp.cta.text": "Το στήνουμε στις στρώσεις και τα πρότυπα του γραφείου σας, και γράφουμε το διάγραμμα πίσω στο CAD σας.",
    "cp.cta.link": "Επικοινωνήστε μαζί μας",
    "cp.survey.q": "Πώς βγάζετε σήμερα το διάγραμμα κάλυψης;",
    "cp.survey.hand": "Με το χέρι ή σε Excel",
    "cp.survey.software": "Με εξειδικευμένο πρόγραμμα",
    "cp.survey.other": "Αλλιώς",
    "cp.survey.thanks": "Ευχαριστούμε!",
    "cp.notice": "Μηχανή γεωμετρίας: Eyeshot.",
    "cp.back": "Αρχική"
  },
  en: {
    "cp.eyebrow": "Free tool",
    "cp.title": "Coverage diagram pre-check",
    "cp.lede": "Drop the DWG or DXF of a Greek building permit and get the figures of its coverage diagram (διάγραμμα κάλυψης): coverage, built floor area, volume, planting, the area schedule and the vertex coordinates, against the zone's terms.",
    "cp.privacy": "Your files stay on your computer; nothing is uploaded.",
    "cp.indicative": "Indicative pre-check — not an official calculation.",
    "cp.cross": "All free tools →",
    "cp.open": "Open file",
    "cp.example": "Load example",
    "cp.template": "Download the layer template (DXF)",
    "cp.template.names": "The template's layer names",
    "cp.template.text": "Layers with these names (ignoring case, -, _ and spaces) are mapped automatically.",
    "cp.drop": "Drop a DWG or DXF file here, or press “Open file”.",
    "cp.clear": "Clear",
    "cp.engine.loading": "Loading the geometry engine, about 12 MB, only the first time… {pct} %",
    "cp.engine.failed": "The geometry engine did not start in this browser.",
    "cp.engine.retry": "Try again",
    "cp.engine.nowasm": "Your browser does not support WebAssembly, which the tool needs. Try a recent Chrome, Edge, Firefox or Safari.",
    "cp.example.failed": "The example did not load. Check your connection and try again.",
    "cp.processing": "Reading the drawing…",
    "cp.union.pending": "Computing the coverage…",
    "cp.err.read": "The file does not read as a DWG or DXF.",
    "cp.err.version": "This DWG version is not supported. Save it as DWG 2018 or DXF and try again.",
    "cp.err.limit": "The file is over the tool's limits (30 MB, 300,000 entities).",
    "cp.err.timeout": "Reading took too long and was stopped.",
    "cp.err.engine": "The geometry engine stopped on this file.",
    "cp.err.empty": "Model space is empty; the drawing is in paper space.",
    "cp.err.blank": "The drawing is empty.",
    "cp.err.nooutlines": "No closed outlines in model space. The tool measures closed polylines, circles and closed curves.",
    "cp.units.line": "Units: {units} ({source})",
    "cp.units.src.file": "from the file",
    "cp.units.src.setting": "from the setting",
    "cp.units.src.assumed": "assumed: the file states no units",
    "cp.units.src.override": "your correction",
    "cp.units.change": "Change units:",
    "cp.units.fromFile": "as the file states",
    "cp.units.fromSettings": "millimetres (the file states none)",
    "cp.unit.mm": "millimetres (mm)",
    "cp.unit.cm": "centimetres (cm)",
    "cp.unit.m": "metres (m)",
    "cp.unit.inch": "inches (in)",
    "cp.unit.ft": "feet (ft)",
    "cp.step1": "1. Layers",
    "cp.step1.hint": "Give each layer its role. Template layers fill in by themselves; others remember your last choice in this browser.",
    "cp.layers.other": "Other layers, without closed outlines (not used): {n}",
    "cp.layers.auto": "{n} layers mapped from the template names.",
    "cp.layers.bad": "{n} open or self-crossing",
    "cp.col.layer": "Layer",
    "cp.col.outlines": "Outlines",
    "cp.col.area": "Area (m²)",
    "cp.col.role": "Role",
    "cp.col.level": "Level",
    "cp.col.figure": "Figure",
    "cp.col.article": "Article",
    "cp.col.permitted": "Permitted",
    "cp.col.proposed": "Proposed",
    "cp.col.permittedText": "Permitted (text)",
    "cp.col.proposedText": "Proposed (text)",
    "cp.col.mark": "Check",
    "cp.col.note": "Note",
    "cp.col.unit": "Unit",
    "cp.role.plot": "Plot (οικόπεδο)",
    "cp.role.cover": "Coverage (κάλυψη)",
    "cp.role.level": "Level outline",
    "cp.role.mezz": "Mezzanine (πατάρι)",
    "cp.role.semiopen": "Semi-open (ημιυπαίθριος)",
    "cp.role.balcony": "Balcony (εξώστης)",
    "cp.role.stairCommon": "Common stair (κοινόχρηστο κλιμακοστάσιο)",
    "cp.role.stairUnit": "Unit stair (εσωτερική κλίμακα)",
    "cp.role.void": "Shaft, atrium, void",
    "cp.role.pilotis": "Pilotis (πυλωτή)",
    "cp.role.bsmtMain": "Basement, main use",
    "cp.role.exclOther": "Other excluded (206 §6)",
    "cp.role.green": "Planting (φύτευση)",
    "cp.role.ignore": "Ignore",
    "cp.role.basementRest": "Rest of the basement, excluded",
    "cp.role.atticRest": "Attic without its stair, within ½ of the level below",
    "cp.level.B2": "Basement −2",
    "cp.level.B1": "Basement −1",
    "cp.level.00": "Ground floor",
    "cp.level.01": "Floor 1",
    "cp.level.02": "Floor 2",
    "cp.level.03": "Floor 3",
    "cp.level.04": "Floor 4",
    "cp.level.05": "Floor 5",
    "cp.level.06": "Floor 6",
    "cp.level.07": "Floor 7",
    "cp.level.08": "Floor 8",
    "cp.level.09": "Floor 9",
    "cp.level.ATTIC": "Attic (σοφίτα)",
    "cp.step2": "2. Zone terms and heights",
    "cp.step2.hint": "As the site survey states them. They are stored in this browser only.",
    "cp.term.sd": "Building coefficient ΣΔ",
    "cp.term.sd.hint": "For several frontages, type the weighted ΣΔ (206 §2).",
    "cp.term.sk": "Coverage ratio Σ.Κ. (%)",
    "cp.term.sk.hint": "Above 60% special cases apply (207 §1α).",
    "cp.term.hmax": "Max height Hmax (m)",
    "cp.term.hmax.hint": "For the ΣΔ you typed, 210 §1 gives {h} m unless the area's terms set another height.",
    "cp.term.roofAllow": "Roof allowance (m)",
    "cp.term.h": "Actual height H (m)",
    "cp.term.roof": "Roof height (m)",
    "cp.term.storey": "Storey height: {level} (m)",
    "cp.term.storey.hint": "Floor to floor; 3.00 m unless you type another.",
    "cp.term.basementAbove": "Basement above final ground (m)",
    "cp.term.roofVolume": "Roof volume (m³)",
    "cp.term.roofVolume.hint": "Only when the roof is not mandatory (208 §2).",
    "cp.term.entrance": "Entrance level",
    "cp.term.parking": "Outdoor parking in the plot",
    "cp.yes": "Yes",
    "cp.no": "No",
    "cp.results": "3. Results",
    "cp.rules.asof": "Rules as of: Ν.5306/2026 (08.06.2026) and circular 15494/397/2026.",
    "cp.block.ydom": "Checked by the building office (Υ.ΔΟΜ)",
    "cp.block.sworn": "On your sworn statement (υπεύθυνη δήλωση)",
    "cp.fig.plot": "Plot area Εοικ",
    "cp.fig.coverage": "Coverage (κάλυψη)",
    "cp.fig.uncovered": "Uncovered area (ακάλυπτος)",
    "cp.fig.volume": "Volume (όγκος)",
    "cp.fig.height": "Height + roof",
    "cp.fig.planting": "Planting (φύτευση)",
    "cp.fig.setbacks": "Setbacks Δ and δ",
    "cp.fig.parking": "Parking spaces",
    "cp.fig.level": "δόμηση (built floor area): {level}",
    "cp.fig.pilotis": "Pilotis (πυλωτή, ≥ 50% of coverage)",
    "cp.fig.semi": "Semi-open (cap 0.20 × permitted δόμηση = {cap} m²)",
    "cp.fig.semiBalc": "Semi-open + balconies (cap 0.40 × permitted δόμηση = {cap} m²)",
    "cp.fig.semiNoSd": "Semi-open (cap 0.20 × permitted δόμηση)",
    "cp.fig.semiBalcNoSd": "Semi-open + balconies (cap 0.40 × permitted δόμηση)",
    "cp.fig.total": "δόμηση (built floor area), total",
    "cp.notv1": "not in version 1",
    "cp.need.sd": "type ΣΔ",
    "cp.need.sk": "type Σ.Κ.",
    "cp.need.height": "type the heights",
    "cp.sub.so": "σ.ο. {v}",
    "cp.sub.sd": "ΣΔ {v}",
    "cp.sub.overflow": "overflow {v} m² counts in δόμηση",
    "cp.mark.ok": "within",
    "cp.mark.over": "over",
    "cp.assume.storey": "Volume uses floor-to-floor storey heights (an assumption).",
    "cp.art.chip": "Code {code} ({old})",
    "cp.art.plot": "The area of the plot's closed outline.",
    "cp.art.coverage": "The union of every coverage outline's projection, semi-open spaces included; permitted Σ.Κ. × Εοικ.",
    "cp.art.uncovered": "Εοικ minus the coverage.",
    "cp.art.level": "Gross level area minus semi-open spaces, the excluded part of stairs, voids, pilotis and declared exclusions, plus mezzanines.",
    "cp.art.basement": "Housing: of the basement only 50% of the main-use spaces counts.",
    "cp.art.stairs": "Common stair up to 30 m² per level (40 m² at the entrance); unit stair up to 25 m². The rest counts.",
    "cp.art.attic": "The stair up to the attic is not counted; of the rest, only what exceeds ½ of the level below counts.",
    "cp.art.pilotis": "The pilotis is excluded only when it is at least 50% of the coverage.",
    "cp.art.caps": "Semi-open up to 0.20, and semi-open with balconies up to 0.40 of the permitted δόμηση; the overflow counts once.",
    "cp.art.total": "The levels' δόμηση plus the semi-open and balcony overflow; permitted ΣΔ × Εοικ.",
    "cp.art.volume": "Σ (gross − voids − excluded pilotis) × storey height, plus the basement above ground and the roof; permitted 5 × ΣΔ × Εοικ, or 5.5 × ΣΔ × Εοικ with Hmax ≤ 8.50 m.",
    "cp.art.height": "The height and roof you typed, against Hmax and the roof allowance.",
    "cp.art.planting": "⅔ of the mandatory uncovered area (Εοικ − Σ.Κ. × Εοικ, or Σ.Κ. + 10% with outdoor parking) is planted.",
    "cp.art.coords": "The plot and building vertices in ΕΓΣΑ87.",
    "cp.schedule": "Area schedule",
    "cp.sch.col.item": "Surface",
    "cp.sch.col.area": "Area (m²)",
    "cp.sch.col.excluded": "Excluded from ΣΔ (m²)",
    "cp.sch.col.counts": "Counted in ΣΔ (m²)",
    "cp.sch.gross": "Gross level area",
    "cp.sch.levelDomisi": "δόμηση: {level}",
    "cp.sch.cap": "cap {cap} m²",
    "cp.sch.capExcess": "the {v} m² over the cap stay in δόμηση",
    "cp.sch.capWithin": "within the cap",
    "cp.sch.totals": "Totals",
    "cp.sch.sumLevels": "Sum of the levels' δόμηση",
    "cp.sch.overflow": "Semi-open and balcony overflow",
    "cp.sch.mezzNote": "Mezzanines count in δόμηση since Ν.5197/2025; the 2022 template's mezzanine exclusion no longer applies.",
    "cp.note.bsmt-half": "50% counts (206 §6ι)",
    "cp.note.in-basement": "inside the basement, excluded",
    "cp.note.bsmt-rest": "auxiliary basement, excluded (206 §6ι)",
    "cp.note.in-attic": "inside the attic",
    "cp.note.attic-stair": "the stair up to the attic is not counted (206 §6ιδ)",
    "cp.note.attic-half": "½ of the level below ({below}) = {half} m²",
    "cp.note.pilotis-ok": "≥ 50% of the coverage: excluded",
    "cp.note.pilotis-small": "under 50% of the coverage: counts in δόμηση",
    "cp.note.mezz": "counts in δόμηση",
    "cp.note.balcony": "counts only against the 0.40 cap",
    "cp.note.bsmt-not-basement": "basement main use on a level that is not a basement: not measured",
    "cp.note.capsUnchecked": "without ΣΔ the caps can't be checked and nothing is added",
    "cp.note.parking": "with outdoor parking: Σ.Κ. + 10%",
    "cp.coords": "Vertex coordinates ΕΓΣΑ87",
    "cp.coords.plot": "Plot vertices",
    "cp.coords.building": "Building vertices (coverage outline)",
    "cp.coords.col.n": "No.",
    "cp.coords.col.x": "X",
    "cp.coords.col.y": "Y",
    "cp.coords.arc": "(arc to the next)",
    "cp.coords.part": "Part {n}",
    "cp.coords.noVerts": "The plot is not a polyline; it has no vertices to list.",
    "cp.coords.approx": "The union was not computed: the vertices are the coverage outlines as drawn.",
    "cp.warnings": "Warnings",
    "cp.warn.none": "No warnings.",
    "cp.warn.show": "Show in drawing",
    "cp.warn.open": "Open outline on layer {layer}: not measured.",
    "cp.warn.bad": "Self-crossing outline on layer {layer}: not measured.",
    "cp.warn.no-level": "A space on layer {layer} is not inside any level outline: not measured.",
    "cp.warn.balcony-far": "A balcony on layer {layer} is more than 0.50 m from every level outline: not measured.",
    "cp.warn.units-check": "Plot area {area} m²: check the drawing's units.",
    "cp.warn.sk-high": "Σ.Κ. {sk}% is above 60%: the special cases of 207 §1α are for you to judge.",
    "cp.warn.no-cover": "No coverage layer: the coverage is 0.",
    "cp.warn.union-failed": "outlines overlap or touch; the union could not be computed, the sum is shown",
    "cp.warn.no-levels": "No level outline layer: δόμηση and volume are 0.",
    "cp.warn.pilotis-small": "The pilotis is {share}% of the coverage, under 50%: it counts in δόμηση.",
    "cp.warn.attic-alone": "An attic with no level below it: all of it counts.",
    "cp.warn.bsmt-not-basement": "Basement main use (layer {layer}) on a level that is not a basement: not measured.",
    "cp.warn.not-egsa": "Coordinates are not in ΕΓΣΑ87: the drawing is not georeferenced, or its units are wrong.",
    "cp.block.plot-missing": "Map exactly one plot outline: none was found.",
    "cp.block.plot-many": "Map exactly one plot outline: {n} were found.",
    "cp.drawing": "Drawing",
    "cp.fit": "Fit",
    "cp.zoomin": "Zoom in",
    "cp.zoomout": "Zoom out",
    "cp.aria.drawing": "Drawing with the mapped outlines",
    "cp.aria.files": "File",
    "cp.tip.layer": "Layer",
    "cp.tip.role": "Role",
    "cp.tip.area": "Area",
    "cp.tip.level": "Level",
    "cp.legend": "Legend",
    "cp.xlsx": "Download Excel (.xlsx)",
    "cp.copy": "Copy",
    "cp.copied": "Copied",
    "cp.print": "Print / PDF",
    "cp.sheet.summary": "Summary",
    "cp.sheet.schedule": "Schedule",
    "cp.sheet.coords": "Coordinates",
    "cp.sheet.mapping": "Mapping",
    "cp.xlsx.inputs": "Your inputs",
    "cp.xlsx.units": "Drawing units: {units}",
    "cp.xlsx.warnings": "Warnings",
    "cp.disclaimer": "Indicative pre-check — not an official calculation. The engineer draws up and signs the coverage diagram.",
    "cp.cta.title": "The coverage diagram inside your CAD?",
    "cp.cta.text": "We set this up on your office's layers and templates, and write the diagram back into your CAD.",
    "cp.cta.link": "Contact us",
    "cp.survey.q": "How do you produce the coverage diagram today?",
    "cp.survey.hand": "By hand or in Excel",
    "cp.survey.software": "With dedicated software",
    "cp.survey.other": "Another way",
    "cp.survey.thanks": "Thank you!",
    "cp.notice": "Geometry engine: Eyeshot.",
    "cp.back": "Home"
  },
  it: {
    "cp.eyebrow": "Strumento gratuito",
    "cp.title": "Pre-verifica del diagramma di copertura",
    "cp.lede": "Trascinate il DWG o DXF di un permesso di costruire greco e ottenete le grandezze del suo diagramma di copertura (διάγραμμα κάλυψης): copertura, superficie edificata, volume, verde, il prospetto delle superfici e le coordinate dei vertici, a confronto con i parametri della zona.",
    "cp.privacy": "I vostri file restano sul vostro computer; nulla viene caricato.",
    "cp.indicative": "Pre-verifica indicativa — non è un calcolo ufficiale.",
    "cp.cross": "Tutti gli strumenti gratuiti →",
    "cp.open": "Apri file",
    "cp.example": "Carica esempio",
    "cp.template": "Scarica il modello dei layer (DXF)",
    "cp.template.names": "I nomi dei layer del modello",
    "cp.template.text": "I layer con questi nomi (senza distinguere maiuscole, -, _ o spazi) vengono assegnati automaticamente.",
    "cp.drop": "Trascinate qui un file DWG o DXF, oppure premete «Apri file».",
    "cp.clear": "Svuota",
    "cp.engine.loading": "Caricamento del motore geometrico, circa 12 MB, solo la prima volta… {pct} %",
    "cp.engine.failed": "Il motore geometrico non si è avviato in questo browser.",
    "cp.engine.retry": "Riprova",
    "cp.engine.nowasm": "Il vostro browser non supporta WebAssembly, necessario allo strumento. Provate una versione recente di Chrome, Edge, Firefox o Safari.",
    "cp.example.failed": "L’esempio non è stato caricato. Controllate la connessione e riprovate.",
    "cp.processing": "Lettura del disegno…",
    "cp.union.pending": "Calcolo della copertura…",
    "cp.err.read": "Il file non si legge come DWG o DXF.",
    "cp.err.version": "Questa versione DWG non è supportata. Salvatelo come DWG 2018 o DXF e riprovate.",
    "cp.err.limit": "Il file supera i limiti dello strumento (30 MB, 300.000 entità).",
    "cp.err.timeout": "La lettura ha richiesto troppo tempo ed è stata interrotta.",
    "cp.err.engine": "Il motore geometrico si è fermato su questo file.",
    "cp.err.empty": "Lo spazio modello è vuoto; il disegno è nello spazio carta.",
    "cp.err.blank": "Il disegno è vuoto.",
    "cp.err.nooutlines": "Nessun contorno chiuso nello spazio modello. Lo strumento misura polilinee chiuse, cerchi e curve chiuse.",
    "cp.units.line": "Unità: {units} ({source})",
    "cp.units.src.file": "dal file",
    "cp.units.src.setting": "dall’impostazione",
    "cp.units.src.assumed": "ipotesi: il file non dichiara unità",
    "cp.units.src.override": "vostra correzione",
    "cp.units.change": "Cambia unità:",
    "cp.units.fromFile": "come dichiara il file",
    "cp.units.fromSettings": "millimetri (il file non le dichiara)",
    "cp.unit.mm": "millimetri (mm)",
    "cp.unit.cm": "centimetri (cm)",
    "cp.unit.m": "metri (m)",
    "cp.unit.inch": "pollici (in)",
    "cp.unit.ft": "piedi (ft)",
    "cp.step1": "1. Layer",
    "cp.step1.hint": "Assegnate a ogni layer il suo ruolo. I layer del modello si compilano da soli; gli altri ricordano la vostra ultima scelta in questo browser.",
    "cp.layers.other": "Altri layer, senza contorni chiusi (non usati): {n}",
    "cp.layers.auto": "{n} layer assegnati dai nomi del modello.",
    "cp.layers.bad": "{n} aperti o autointersecanti",
    "cp.col.layer": "Layer",
    "cp.col.outlines": "Contorni",
    "cp.col.area": "Area (m²)",
    "cp.col.role": "Ruolo",
    "cp.col.level": "Livello",
    "cp.col.figure": "Grandezza",
    "cp.col.article": "Articolo",
    "cp.col.permitted": "Consentito",
    "cp.col.proposed": "Di progetto",
    "cp.col.permittedText": "Consentito (testo)",
    "cp.col.proposedText": "Di progetto (testo)",
    "cp.col.mark": "Verifica",
    "cp.col.note": "Nota",
    "cp.col.unit": "Unità",
    "cp.role.plot": "Lotto (οικόπεδο)",
    "cp.role.cover": "Copertura (κάλυψη)",
    "cp.role.level": "Contorno di livello",
    "cp.role.mezz": "Soppalco (πατάρι)",
    "cp.role.semiopen": "Semiaperto (ημιυπαίθριος)",
    "cp.role.balcony": "Balcone (εξώστης)",
    "cp.role.stairCommon": "Scala comune (κοινόχρηστο κλιμακοστάσιο)",
    "cp.role.stairUnit": "Scala interna (εσωτερική κλίμακα)",
    "cp.role.void": "Cavedio, atrio, vuoto",
    "cp.role.pilotis": "Pilotis (πυλωτή)",
    "cp.role.bsmtMain": "Interrato ad uso principale",
    "cp.role.exclOther": "Altra esclusione (206 §6)",
    "cp.role.green": "Verde (φύτευση)",
    "cp.role.ignore": "Ignora",
    "cp.role.basementRest": "Resto dell’interrato, escluso",
    "cp.role.atticRest": "Sottotetto senza scala, entro ½ del livello sottostante",
    "cp.level.B2": "Interrato −2",
    "cp.level.B1": "Interrato −1",
    "cp.level.00": "Piano terra",
    "cp.level.01": "Piano 1",
    "cp.level.02": "Piano 2",
    "cp.level.03": "Piano 3",
    "cp.level.04": "Piano 4",
    "cp.level.05": "Piano 5",
    "cp.level.06": "Piano 6",
    "cp.level.07": "Piano 7",
    "cp.level.08": "Piano 8",
    "cp.level.09": "Piano 9",
    "cp.level.ATTIC": "Sottotetto (σοφίτα)",
    "cp.step2": "2. Parametri di zona e altezze",
    "cp.step2.hint": "Come li riporta il rilievo topografico. Sono salvati solo in questo browser.",
    "cp.term.sd": "Indice di edificabilità ΣΔ",
    "cp.term.sd.hint": "Con più fronti, scrivete il ΣΔ ponderato (206 §2).",
    "cp.term.sk": "Rapporto di copertura Σ.Κ. (%)",
    "cp.term.sk.hint": "Oltre il 60% valgono casi particolari (207 §1α).",
    "cp.term.hmax": "Altezza massima Hmax (m)",
    "cp.term.hmax.hint": "Per il ΣΔ indicato, il 210 §1 dà {h} m se i parametri della zona non fissano un’altra altezza.",
    "cp.term.roofAllow": "Tetto consentito (m)",
    "cp.term.h": "Altezza di progetto H (m)",
    "cp.term.roof": "Altezza del tetto (m)",
    "cp.term.storey": "Altezza di piano: {level} (m)",
    "cp.term.storey.hint": "Da pavimento a pavimento; 3,00 m se non ne indicate un’altra.",
    "cp.term.basementAbove": "Interrato fuori terra (m)",
    "cp.term.roofVolume": "Volume del tetto (m³)",
    "cp.term.roofVolume.hint": "Solo se il tetto non è obbligatorio (208 §2).",
    "cp.term.entrance": "Livello d’ingresso",
    "cp.term.parking": "Parcheggi scoperti nel lotto",
    "cp.yes": "Sì",
    "cp.no": "No",
    "cp.results": "3. Risultati",
    "cp.rules.asof": "Regole in vigore: Ν.5306/2026 (08.06.2026) e circolare 15494/397/2026.",
    "cp.block.ydom": "Verificati dall’ufficio edilizio (Υ.ΔΟΜ)",
    "cp.block.sworn": "Nella vostra dichiarazione giurata (υπεύθυνη δήλωση)",
    "cp.fig.plot": "Superficie del lotto Εοικ",
    "cp.fig.coverage": "Copertura (κάλυψη)",
    "cp.fig.uncovered": "Area scoperta (ακάλυπτος)",
    "cp.fig.volume": "Volume (όγκος)",
    "cp.fig.height": "Altezza + tetto",
    "cp.fig.planting": "Verde (φύτευση)",
    "cp.fig.setbacks": "Distanze Δ e δ",
    "cp.fig.parking": "Posti auto",
    "cp.fig.level": "δόμηση (superficie edificata): {level}",
    "cp.fig.pilotis": "Pilotis (πυλωτή, ≥ 50% della copertura)",
    "cp.fig.semi": "Semiaperti (limite 0,20 × δόμηση consentita = {cap} m²)",
    "cp.fig.semiBalc": "Semiaperti + balconi (limite 0,40 × δόμηση consentita = {cap} m²)",
    "cp.fig.semiNoSd": "Semiaperti (limite 0,20 × δόμηση consentita)",
    "cp.fig.semiBalcNoSd": "Semiaperti + balconi (limite 0,40 × δόμηση consentita)",
    "cp.fig.total": "δόμηση (superficie edificata), totale",
    "cp.notv1": "non nella versione 1",
    "cp.need.sd": "indicate il ΣΔ",
    "cp.need.sk": "indicate il Σ.Κ.",
    "cp.need.height": "indicate le altezze",
    "cp.sub.so": "σ.ο. {v}",
    "cp.sub.sd": "ΣΔ {v}",
    "cp.sub.overflow": "eccedenza di {v} m² conteggiata nella δόμηση",
    "cp.mark.ok": "entro il limite",
    "cp.mark.over": "oltre il limite",
    "cp.assume.storey": "Il volume usa altezze di piano da pavimento a pavimento (un’ipotesi).",
    "cp.art.chip": "Cod. {code} ({old})",
    "cp.art.plot": "L’area del contorno chiuso del lotto.",
    "cp.art.coverage": "L’unione delle proiezioni di tutti i contorni di copertura, semiaperti compresi; consentito Σ.Κ. × Εοικ.",
    "cp.art.uncovered": "Εοικ meno la copertura.",
    "cp.art.level": "Superficie lorda del livello meno semiaperti, la parte esclusa delle scale, vuoti, pilotis ed esclusioni dichiarate, più i soppalchi.",
    "cp.art.basement": "Residenza: dell’interrato conta solo il 50% degli spazi ad uso principale.",
    "cp.art.stairs": "Scala comune fino a 30 m² per livello (40 m² all’ingresso); scala interna fino a 25 m². Il resto conta.",
    "cp.art.attic": "La scala verso il sottotetto non si conteggia; del resto conta solo ciò che supera ½ del livello sottostante.",
    "cp.art.pilotis": "Il pilotis è escluso solo se è almeno il 50% della copertura.",
    "cp.art.caps": "Semiaperti fino a 0,20, e semiaperti con balconi fino a 0,40 della δόμηση consentita; l’eccedenza conta una sola volta.",
    "cp.art.total": "La δόμηση dei livelli più l’eccedenza di semiaperti e balconi; consentito ΣΔ × Εοικ.",
    "cp.art.volume": "Σ (lorda − vuoti − pilotis escluso) × altezza di piano, più l’interrato fuori terra e il tetto; consentito 5 × ΣΔ × Εοικ, o 5,5 × ΣΔ × Εοικ con Hmax ≤ 8,50 m.",
    "cp.art.height": "L’altezza e il tetto indicati, a confronto con Hmax e il tetto consentito.",
    "cp.art.planting": "I ⅔ dell’area obbligatoriamente scoperta (Εοικ − Σ.Κ. × Εοικ, o Σ.Κ. + 10% con parcheggi scoperti) sono a verde.",
    "cp.art.coords": "I vertici del lotto e dell’edificio in ΕΓΣΑ87.",
    "cp.schedule": "Prospetto delle superfici",
    "cp.sch.col.item": "Superficie",
    "cp.sch.col.area": "Area (m²)",
    "cp.sch.col.excluded": "Esclusa dal ΣΔ (m²)",
    "cp.sch.col.counts": "Conteggiata nel ΣΔ (m²)",
    "cp.sch.gross": "Superficie lorda del livello",
    "cp.sch.levelDomisi": "δόμηση: {level}",
    "cp.sch.cap": "limite {cap} m²",
    "cp.sch.capExcess": "i {v} m² oltre il limite restano nella δόμηση",
    "cp.sch.capWithin": "entro il limite",
    "cp.sch.totals": "Totali",
    "cp.sch.sumLevels": "Somma della δόμηση dei livelli",
    "cp.sch.overflow": "Eccedenza di semiaperti e balconi",
    "cp.sch.mezzNote": "I soppalchi contano nella δόμηση dalla Ν.5197/2025; l’esclusione dei soppalchi del modello del 2022 non vale più.",
    "cp.note.bsmt-half": "conta il 50% (206 §6ι)",
    "cp.note.in-basement": "nell’interrato, escluso",
    "cp.note.bsmt-rest": "interrato accessorio, escluso (206 §6ι)",
    "cp.note.in-attic": "nel sottotetto",
    "cp.note.attic-stair": "la scala verso il sottotetto non si conteggia (206 §6ιδ)",
    "cp.note.attic-half": "½ del livello sottostante ({below}) = {half} m²",
    "cp.note.pilotis-ok": "≥ 50% della copertura: escluso",
    "cp.note.pilotis-small": "sotto il 50% della copertura: conta nella δόμηση",
    "cp.note.mezz": "conta nella δόμηση",
    "cp.note.balcony": "conta solo per il limite 0,40",
    "cp.note.bsmt-not-basement": "interrato ad uso principale su un livello che non è interrato: non misurato",
    "cp.note.capsUnchecked": "senza ΣΔ i limiti non si verificano e non si aggiunge nulla",
    "cp.note.parking": "con parcheggi scoperti: Σ.Κ. + 10%",
    "cp.coords": "Coordinate dei vertici ΕΓΣΑ87",
    "cp.coords.plot": "Vertici del lotto",
    "cp.coords.building": "Vertici dell’edificio (contorno di copertura)",
    "cp.coords.col.n": "N.",
    "cp.coords.col.x": "X",
    "cp.coords.col.y": "Y",
    "cp.coords.arc": "(arco fino al successivo)",
    "cp.coords.part": "Parte {n}",
    "cp.coords.noVerts": "Il lotto non è una polilinea; non ha vertici da elencare.",
    "cp.coords.approx": "L’unione non è stata calcolata: i vertici sono quelli dei contorni di copertura come disegnati.",
    "cp.warnings": "Avvisi",
    "cp.warn.none": "Nessun avviso.",
    "cp.warn.show": "Mostra nel disegno",
    "cp.warn.open": "Contorno aperto sul layer {layer}: non misurato.",
    "cp.warn.bad": "Contorno autointersecante sul layer {layer}: non misurato.",
    "cp.warn.no-level": "Uno spazio sul layer {layer} non è dentro alcun contorno di livello: non misurato.",
    "cp.warn.balcony-far": "Un balcone sul layer {layer} dista più di 0,50 m da ogni contorno di livello: non misurato.",
    "cp.warn.units-check": "Superficie del lotto {area} m²: controllate le unità del disegno.",
    "cp.warn.sk-high": "Σ.Κ. {sk}% oltre il 60%: i casi particolari del 207 §1α sono da valutare da voi.",
    "cp.warn.no-cover": "Nessun layer di copertura: la copertura è 0.",
    "cp.warn.union-failed": "i contorni si sovrappongono o si toccano; l’unione non è stata calcolata, si mostra la somma",
    "cp.warn.no-levels": "Nessun layer di contorno di livello: δόμηση e volume sono 0.",
    "cp.warn.pilotis-small": "Il pilotis è il {share}% della copertura, sotto il 50%: conta nella δόμηση.",
    "cp.warn.attic-alone": "Un sottotetto senza livello sottostante: conta per intero.",
    "cp.warn.bsmt-not-basement": "Interrato ad uso principale (layer {layer}) su un livello che non è interrato: non misurato.",
    "cp.warn.not-egsa": "Le coordinate non sono in ΕΓΣΑ87: il disegno non è georeferenziato, o le sue unità sono errate.",
    "cp.block.plot-missing": "Assegnate esattamente un contorno di lotto: non ne è stato trovato nessuno.",
    "cp.block.plot-many": "Assegnate esattamente un contorno di lotto: ne sono stati trovati {n}.",
    "cp.drawing": "Disegno",
    "cp.fit": "Adatta",
    "cp.zoomin": "Ingrandisci",
    "cp.zoomout": "Riduci",
    "cp.aria.drawing": "Disegno con i contorni assegnati",
    "cp.aria.files": "File",
    "cp.tip.layer": "Layer",
    "cp.tip.role": "Ruolo",
    "cp.tip.area": "Area",
    "cp.tip.level": "Livello",
    "cp.legend": "Legenda",
    "cp.xlsx": "Scarica Excel (.xlsx)",
    "cp.copy": "Copia",
    "cp.copied": "Copiato",
    "cp.print": "Stampa / PDF",
    "cp.sheet.summary": "Riepilogo",
    "cp.sheet.schedule": "Prospetto",
    "cp.sheet.coords": "Coordinate",
    "cp.sheet.mapping": "Assegnazione",
    "cp.xlsx.inputs": "I vostri dati",
    "cp.xlsx.units": "Unità del disegno: {units}",
    "cp.xlsx.warnings": "Avvisi",
    "cp.disclaimer": "Pre-verifica indicativa — non è un calcolo ufficiale. Il diagramma di copertura lo redige e lo firma l’ingegnere.",
    "cp.cta.title": "Il diagramma di copertura dentro il vostro CAD?",
    "cp.cta.text": "Lo configuriamo sui layer e sui modelli del vostro studio, e riscriviamo il diagramma nel vostro CAD.",
    "cp.cta.link": "Contattateci",
    "cp.survey.q": "Come preparate oggi il diagramma di copertura?",
    "cp.survey.hand": "A mano o in Excel",
    "cp.survey.software": "Con un software dedicato",
    "cp.survey.other": "In altro modo",
    "cp.survey.thanks": "Grazie!",
    "cp.notice": "Motore geometrico: Eyeshot.",
    "cp.back": "Home"
  }
};
```

<!-- file: _tests/coverage/make-examples.mjs -->
```js
// Writes the coverage pre-check's committed drawings (spec §4, §12), so none of them is typed by hand:
//   js/coverage/examples/example-permit.dxf   the page's example (AutoCAD 2000 DXF, metres, ΕΓΣΑ87)
//   js/coverage/examples/layer-template.dxf   the downloadable layer template (R12, layers + a Greek legend)
//   _tests/coverage/fixtures/union.dxf        the browser check's union fixture
// Run from the repo root: node _tests/coverage/make-examples.mjs   (add --check to compare instead of writing)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';
import { dxf2000, dxfR12, rect } from './dxf-writer.mjs';
import { OUTLINES, OPEN, inSurvey } from './example-geometry.mjs';
import { TEMPLATE } from '../../js/coverage/mapping.js';

const root = new URL('../../', import.meta.url);
const check = process.argv.includes('--check');

// The Greek role names come from the tool's own strings, so the legend says what the page says.
function strings() {
  const window = {};
  vm.runInNewContext(readFileSync(new URL('js/coverage/i18n-coverage.js', root), 'utf8'), { window });
  return window.CP_I18N;
}

function example() {
  const layers = [...new Set(OUTLINES.map(o => o.layer))].map(name => ({ name, color: TEMPLATE.find(t => t.layer === name).aci }));
  const polylines = [
    ...OUTLINES.map(o => ({ layer: o.layer, closed: true, verts: inSurvey(o.verts) })),
    ...OPEN.map(o => ({ layer: o.layer, closed: false, verts: inSurvey(o.verts) })),
  ];
  return dxf2000({ units: 6, layers, polylines });
}

function template() {
  const el = strings().el;
  const layers = TEMPLATE.map(t => ({ name: t.layer, color: t.aci }));
  const texts = [];
  let y = 0;
  texts.push({ layer: '0', x: 0, y: y, height: 0.5, text: 'AidedCAM - Προέλεγχος διαγράμματος κάλυψης: πρότυπο στρώσεων' });
  y -= 1.2;
  for (const t of TEMPLATE) {
    const role = el[`cp.role.${t.role}`] + (t.level ? ' - ' + el[`cp.level.${t.level}`] : '');
    texts.push({ layer: t.layer, x: 0, y, height: 0.35, text: `${t.layer}  ${role}`.replace(/−/g, '-') });   // R12 text has no minus sign
    y -= 0.7;
  }
  return dxfR12({ layers, texts });
}

// Hand-worked unions for the browser: overlap 175, touch 200, a frame 800, an arc 164.2699…, survey 200,
// and 50 squares into 2556.
function unionFixture() {
  const b = 1;                                                             // a half circle
  const polylines = [
    ...[rect(0, 0, 10, 10), rect(5, 5, 10, 10)].map(verts => ({ layer: 'OVERLAP', closed: true, verts })),
    ...[rect(0, 50, 10, 10), rect(10, 50, 10, 10)].map(verts => ({ layer: 'TOUCH', closed: true, verts })),
    ...[rect(0, 100, 30, 10), rect(0, 120, 30, 10), rect(0, 100, 10, 30), rect(20, 100, 10, 30)].map(verts => ({ layer: 'FRAME', closed: true, verts })),
    { layer: 'ARC', closed: true, verts: [[0, 160, b], [0, 150], [10, 150], [10, 160]] },
    { layer: 'ARC', closed: true, verts: rect(5, 150, 10, 5) },
    ...[rect(410000, 4495000, 10, 15), rect(410005, 4495005, 10, 10)].map(verts => ({ layer: 'SURVEY', closed: true, verts })),
    // 50 overlapping 8 × 8 squares on a 7 m grid: one 71 × 36 block, the spec §10 speed case.
    ...Array.from({ length: 50 }, (_, i) => ({ layer: 'MANY', closed: true, verts: rect(200 + (i % 10) * 7, (i / 10 | 0) * 7, 8, 8) })),
  ];
  const layers = ['OVERLAP', 'TOUCH', 'FRAME', 'ARC', 'SURVEY', 'MANY'].map((name, i) => ({ name, color: i + 1 }));
  return dxf2000({ units: 6, layers, polylines });
}

const out = {
  'js/coverage/examples/example-permit.dxf': example(),
  'js/coverage/examples/layer-template.dxf': template(),
  '_tests/coverage/fixtures/union.dxf': unionFixture(),
};

// The template's Greek must survive the trip through Windows-1253.
const legend = new TextDecoder('windows-1253').decode(out['js/coverage/examples/layer-template.dxf']);
if (!legend.includes('Οικόπεδο') && !legend.includes('οικόπεδο')) throw new Error('the Greek legend did not round-trip');

let differ = 0;
for (const [path, bytes] of Object.entries(out)) {
  const url = new URL(path, root);
  if (check) {
    let old = null;
    try { old = readFileSync(url); } catch (e) { /* missing */ }
    const same = old && Buffer.compare(old, Buffer.from(bytes)) === 0;
    if (!same) differ++;
    console.log(`${same ? 'same' : 'DIFFERS'}  ${path}`);
  } else {
    mkdirSync(new URL('.', url), { recursive: true });
    writeFileSync(url, bytes);
    console.log(`wrote ${path} (${bytes.length} bytes)`);
  }
}
process.exit(differ ? 1 : 0);
```

Run:
```bash
node _tests/extract.mjs $PLAN js/coverage/i18n-coverage.js && node _tests/extract.mjs $PLAN _tests/coverage/make-examples.mjs
node _tests/coverage/make-examples.mjs
node _tests/coverage/make-examples.mjs --check
```
Expected:
```
wrote js/coverage/examples/example-permit.dxf (6490 bytes)
wrote js/coverage/examples/layer-template.dxf (4738 bytes)
wrote _tests/coverage/fixtures/union.dxf (14579 bytes)
same  js/coverage/examples/example-permit.dxf
same  js/coverage/examples/layer-template.dxf
same  _tests/coverage/fixtures/union.dxf
```
The generator is deterministic: the same bytes on every run and every machine.

- [ ] **Step 3: Run the tests**

Run: `node --test "_tests/coverage/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 42`, `ℹ fail 0`.

- [ ] **Step 4: Commit**

```bash
git add js/coverage/i18n-coverage.js js/coverage/examples _tests/coverage/make-examples.mjs _tests/coverage/examples.test.js _tests/coverage/fixtures
git commit -F - <<'EOF'
Coverage pre-check: the tool's strings, the example permit, the layer template and the union fixture

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 5: The engine's true vertices and union

Both additions of spec §3 in one task, because `Measure.cs` uses `Flat` from `Union.cs` and the 18 tests are one file. The vertex fixtures are DXF text written as AutoCAD writes it (group codes, subclass markers, a mirrored polyline's −Z extrusion), not ACadSharp round trips. The last two tests read the drawings of Task 4.

Changed existing files (given whole below):
- `Model.cs` adds one line, `Item.Verts`;
- `Measure.cs` adds 20 lines: `Shape.HasVerts`, `Shape.Verts()`, set for LW and 2D polylines;
- `Quantities.cs` adds 6 lines and changes 1: it clears the union cache at the start of a run, sets `Verts` in metres, and keeps the file's closed curves at the end;
- `ResultJson.cs` adds 42 lines: `verts` in the item JSON, and `ResultJson.Union`.

**Files:**
- Modify: `_src/dwg-engine/Engine/Model.cs`, `Measure.cs`, `Quantities.cs`, `ResultJson.cs`
- Create: `_src/dwg-engine/Engine/Union.cs`
- Test: `_src/dwg-engine/Tests/CoverageTests.cs`

**Interfaces:**
- Consumes: the engine's `Piece`, `Outline`, `Affine`, `Shape`, `Quantities.Run`, `Cad` test helpers (existing); the committed drawings (Task 4).
- Produces (namespace `AidedCam.Dwg`):
  - `Item.Verts` (`double[]`, `[x, y, bulge, …]` in metres, null unless a flat closed LW/2D polyline); JSON `items[].verts` is written only when set.
  - `Shape.HasVerts`, `Shape.Verts() → double[]` (drawing coordinates in the file's units, the bulge sign flipped for a mirrored polyline).
  - `static class Flat { static bool Of(Affine map, out double sign) }`.
  - `static class LastFile { Clear(); Has(id); Scale }` (plus the internal `Keep` and `TryGet`), filled by `Quantities.Run`.
  - `sealed class UnionResult { double Area; List<double[]> Paths; List<double[]> Verts; List<string> Bad; int Parts; string Error; }`.
  - `static class Union { static UnionResult Of(IEnumerable<string> ids) }`.
  - `ResultJson.Union(string idsJson) → string` `{ type: 'union', area, parts, paths, verts, bad, error }`, which never throws.

- [ ] **Step 1: Write the failing tests**

<!-- file: _src/dwg-engine/Tests/CoverageTests.cs -->
```csharp
using System.Text;
using System.Text.Json;
using ACadSharp.Types.Units;
using Xunit;

namespace AidedCam.Dwg.Tests;

// The two engine additions for the coverage pre-check (spec §3, §11): true vertices of closed polylines, and the
// union of closed items of the last file. The vertex fixtures are DXF text written the way AutoCAD writes it
// (group codes, subclass markers, a mirrored polyline's −Z extrusion), not ACadSharp round trips.
public class CoverageTests
{
    // A minimal AutoCAD 2000 DXF: header with the units, the layer table, then the entities as given.
    public static byte[] Dxf(int insunits, string[] layers, params string[] entities)
    {
        var sb = new StringBuilder();
        void G(int code, object v) => sb.Append(code.ToString().PadLeft(3)).Append("\r\n").Append(Convert.ToString(v, System.Globalization.CultureInfo.InvariantCulture)).Append("\r\n");
        G(0, "SECTION"); G(2, "HEADER");
        G(9, "$ACADVER"); G(1, "AC1015");
        G(9, "$INSUNITS"); G(70, insunits);
        G(0, "ENDSEC");
        G(0, "SECTION"); G(2, "TABLES");
        G(0, "TABLE"); G(2, "LAYER"); G(5, "2"); G(100, "AcDbSymbolTable"); G(70, layers.Length + 1);
        int h = 0x10;
        foreach (var l in new[] { "0" }.Concat(layers))
        {
            G(0, "LAYER"); G(5, (h++).ToString("X")); G(100, "AcDbSymbolTableRecord"); G(100, "AcDbLayerTableRecord");
            G(2, l); G(70, 0); G(62, 7); G(6, "Continuous");
        }
        G(0, "ENDTAB");
        // The block records the entities' owner handle (330) points at, as AutoCAD writes them.
        G(0, "TABLE"); G(2, "BLOCK_RECORD"); G(5, "1"); G(100, "AcDbSymbolTable"); G(70, 2);
        G(0, "BLOCK_RECORD"); G(5, "1F"); G(330, "1"); G(100, "AcDbSymbolTableRecord"); G(100, "AcDbBlockTableRecord"); G(2, "*Model_Space"); G(340, "0");
        G(0, "BLOCK_RECORD"); G(5, "1B"); G(330, "1"); G(100, "AcDbSymbolTableRecord"); G(100, "AcDbBlockTableRecord"); G(2, "*Paper_Space"); G(340, "0");
        G(0, "ENDTAB");
        G(0, "ENDSEC");
        G(0, "SECTION"); G(2, "BLOCKS");
        G(0, "BLOCK"); G(5, "20"); G(330, "1F"); G(100, "AcDbEntity"); G(8, "0"); G(100, "AcDbBlockBegin"); G(2, "*Model_Space"); G(70, 0); G(10, 0.0); G(20, 0.0); G(30, 0.0); G(3, "*Model_Space"); G(1, "");
        G(0, "ENDBLK"); G(5, "21"); G(330, "1F"); G(100, "AcDbEntity"); G(8, "0"); G(100, "AcDbBlockEnd");
        G(0, "BLOCK"); G(5, "1C"); G(330, "1B"); G(100, "AcDbEntity"); G(67, 1); G(8, "0"); G(100, "AcDbBlockBegin"); G(2, "*Paper_Space"); G(70, 0); G(10, 0.0); G(20, 0.0); G(30, 0.0); G(3, "*Paper_Space"); G(1, "");
        G(0, "ENDBLK"); G(5, "1D"); G(330, "1B"); G(100, "AcDbEntity"); G(67, 1); G(8, "0"); G(100, "AcDbBlockEnd");
        G(0, "ENDSEC");
        G(0, "SECTION"); G(2, "ENTITIES");
        foreach (var e in entities) sb.Append(e);
        G(0, "ENDSEC");
        G(0, "EOF");
        return Encoding.ASCII.GetBytes(sb.ToString());
    }

    static string Codes(params (int Code, object Value)[] g)
    {
        var sb = new StringBuilder();
        foreach (var (c, v) in g) sb.Append(c.ToString().PadLeft(3)).Append("\r\n").Append(Convert.ToString(v, System.Globalization.CultureInfo.InvariantCulture)).Append("\r\n");
        return sb.ToString();
    }

    // LWPOLYLINE as AutoCAD writes it: handle, subclasses, vertex count, flags (1 = closed), constant width, then
    // 10/20 per vertex with 42 (bulge) after the vertex it starts from; 210/220/230 only for a non-default extrusion.
    public static string Lw(string handle, string layer, bool closed, (double X, double Y, double B)[] v, bool mirrored = false)
    {
        var g = new List<(int, object)> { (0, "LWPOLYLINE"), (5, handle), (330, "1F"), (100, "AcDbEntity"), (8, layer), (100, "AcDbPolyline"), (90, v.Length), (70, closed ? 1 : 0), (43, 0.0) };
        foreach (var (x, y, b) in v) { g.Add((10, x)); g.Add((20, y)); if (b != 0) g.Add((42, b)); }
        if (mirrored) { g.Add((210, 0.0)); g.Add((220, 0.0)); g.Add((230, -1.0)); }
        return Codes(g.ToArray());
    }

    // An old-style 2D POLYLINE: header with 66 (vertices follow) and 70 (1 = closed), VERTEX entities, SEQEND.
    static string Poly2D(string handle, string layer, (double X, double Y, double B)[] v)
    {
        var g = new List<(int, object)> { (0, "POLYLINE"), (5, handle), (330, "1F"), (100, "AcDbEntity"), (8, layer), (100, "AcDb2dPolyline"), (66, 1), (10, 0.0), (20, 0.0), (30, 0.0), (70, 1) };
        int h = Convert.ToInt32(handle, 16);
        foreach (var (x, y, b) in v)
        {
            g.AddRange(new (int, object)[] { (0, "VERTEX"), (5, (++h).ToString("X")), (330, handle), (100, "AcDbEntity"), (8, layer), (100, "AcDbVertex"), (100, "AcDb2dVertex"), (10, x), (20, y), (30, 0.0) });
            if (b != 0) g.Add((42, b));
            g.Add((70, 0));
        }
        g.AddRange(new (int, object)[] { (0, "SEQEND"), (5, (++h).ToString("X")), (330, handle), (100, "AcDbEntity"), (8, layer) });
        return Codes(g.ToArray());
    }

    static Result Run(byte[] dxf) => Quantities.Run(dxf, new Settings());

    static void Near(double[] expected, double[] actual, int digits = 6)
    {
        Assert.NotNull(actual);
        Assert.Equal(expected.Length, actual.Length);
        for (int i = 0; i < expected.Length; i++) Assert.True(Math.Abs(expected[i] - actual[i]) < Math.Pow(10, -digits), $"[{i}] expected {expected[i]}, got {actual[i]}\n{string.Join(", ", actual)}");
    }

    [Fact]
    public void A_closed_lightweight_polyline_with_a_bulge_reports_its_true_vertices_in_metres()
    {
        // In millimetres: a 10 × 5 m room whose top edge is a half circle of radius 5 m bulging upwards.
        var dxf = Dxf(4, new[] { "AC_COVER" }, Lw("2A", "AC_COVER", true, new[] { (0.0, 0.0, 0.0), (10000.0, 0.0, 0.0), (10000.0, 5000.0, 1.0), (0.0, 5000.0, 0.0) }));
        var r = Run(dxf);
        var it = Assert.Single(r.Items);
        Assert.False(string.IsNullOrEmpty(it.Id));                                                     // ACadSharp may renumber a handle that clashes with its defaults
        Near(new[] { 0, 0, 0, 10, 0, 0, 10, 5, 1.0, 0, 5, 0 }, it.Verts);
        Assert.Equal(50 + Math.PI * 25 / 2, it.Area, 9);                                              // 89.2699…: the arc counts exactly
    }

    [Fact]
    public void A_closed_2D_polyline_reports_its_true_vertices()
    {
        // Metres: a 6 × 4 plot with one side bowed outwards by a quarter-circle bulge (tan(π/8)).
        double b = Math.Tan(Math.PI / 8);
        var dxf = Dxf(6, new[] { "AC_PLOT" }, Poly2D("40", "AC_PLOT", new[] { (0.0, 0.0, 0.0), (6.0, 0.0, b), (6.0, 4.0, 0.0), (0.0, 4.0, 0.0) }));
        var r = Run(dxf);
        var it = Assert.Single(r.Items);
        Assert.Equal("polyline", it.Kind);
        Near(new[] { 0, 0, 0, 6, 0, b, 6, 4, 0, 0, 4, 0 }, it.Verts, 9);
        // Chord 4 and a 90° sweep: radius 4/√2 (r² = 8), segment area r²(θ − sin θ)/2 = 4·(π/2 − 1) = 2.2832.
        Assert.Equal(24 + 4 * (Math.PI / 2 - 1), it.Area, 9);
    }

    [Fact]
    public void A_mirrored_polyline_reports_drawing_coordinates_and_flips_its_bulges()
    {
        // AutoCAD's MIRROR can leave an extrusion of (0, 0, −1): the stored x is the negated drawing x, and an arc
        // stored counter-clockwise runs clockwise in the drawing.
        var dxf = Dxf(6, new[] { "L" }, Lw("50", "L", true, new[] { (0.0, 0.0, 0.0), (4.0, 0.0, 0.5), (4.0, 3.0, 0.0), (0.0, 3.0, 0.0) }, mirrored: true));
        var it = Assert.Single(Run(dxf).Items);
        Near(new[] { 0, 0, 0, -4, 0, -0.5, -4, 3, 0, 0, 3, 0 }, it.Verts, 9);
    }

    [Fact]
    public void Open_polylines_circles_and_lines_carry_no_vertices()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        doc.Entities.Add(Cad.Poly(false, (0, 0, 0), (5, 0, 0), (5, 5, 0)).On(doc, "OPEN"));
        doc.Entities.Add(new ACadSharp.Entities.Circle { Center = new CSMath.XYZ(20, 0, 0), Radius = 2 }.On(doc, "C"));
        doc.Entities.Add(Cad.Line(0, 0, 1, 1).On(doc, "L"));
        var r = Cad.Run(doc);
        Assert.All(r.Items, i => Assert.Null(i.Verts));
        var json = JsonDocument.Parse(ResultJson.Write("x.dwg", r)).RootElement;
        foreach (var i in json.GetProperty("items").EnumerateArray()) Assert.False(i.TryGetProperty("verts", out _));   // DWG quantities' contract unchanged
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void The_DWG_and_the_DXF_give_the_same_vertices(bool dwg)
    {
        var doc = Cad.Doc(UnitsType.Centimeters);
        doc.Entities.Add(Cad.Poly(true, (0, 0, 0), (1000, 0, 0), (1000, 500, -0.25), (0, 500, 0)).On(doc, "R"));
        var it = Assert.Single(Cad.Run(doc, dwg).Items);
        Near(new[] { 0, 0, 0, 10, 0, 0, 10, 5, -0.25, 0, 5, 0 }, it.Verts, 9);
    }

    // ---- the union ----

    static string[] Load(params (double X, double Y, double W, double H)[] rects)
    {
        var doc = Cad.Doc(UnitsType.Meters);
        foreach (var r in rects) doc.Entities.Add(Cad.Rect(r.X, r.Y, r.W, r.H).On(doc, "AC_COVER"));
        return Cad.Run(doc).Items.Select(i => i.Id).ToArray();
    }

    static double[][] Contours(UnionResult u) => u.Verts.ToArray();

    [Fact]
    public void Two_overlapping_squares_unite_into_one_outline_of_eight_vertices()
    {
        var ids = Load((0, 0, 10, 10), (5, 5, 10, 10));
        var u = Union.Of(ids);
        Assert.Null(u.Error);
        Assert.Equal(175, u.Area, 9);                                                                   // 100 + 100 − 25
        Assert.Equal(1, u.Parts);
        Near(new double[] { 0, 0, 0, 10, 0, 0, 10, 5, 0, 15, 5, 0, 15, 15, 0, 5, 15, 0, 5, 10, 0, 0, 10, 0 }, Assert.Single(Contours(u)), 9);
        Assert.Empty(u.Bad);
    }

    [Fact]
    public void Two_touching_squares_unite_without_the_shared_edges_points()
    {
        var u = Union.Of(Load((0, 0, 10, 10), (10, 0, 10, 10)));
        Assert.Equal(200, u.Area, 9);
        Near(new double[] { 0, 0, 0, 20, 0, 0, 20, 10, 0, 0, 10, 0 }, Assert.Single(Contours(u)), 9);   // (10, 0) and (10, 10) merged away
    }

    [Fact]
    public void Four_bars_around_a_courtyard_unite_into_a_square_with_a_hole()
    {
        var u = Union.Of(Load((0, 0, 30, 10), (0, 20, 30, 10), (0, 0, 10, 30), (20, 0, 10, 30)));
        Assert.Equal(900 - 100, u.Area, 9);
        Assert.Equal(1, u.Parts);
        var c = Contours(u);
        Assert.Equal(2, c.Length);
        Near(new double[] { 0, 0, 0, 30, 0, 0, 30, 30, 0, 0, 30, 0 }, c[0], 9);                        // outer, counter-clockwise
        Assert.Equal(12, c[1].Length);                                                                  // the courtyard: 4 vertices, clockwise
        double a = 0;
        for (int i = 0; i < 4; i++) { int j = (i + 1) % 4; a += c[1][3 * i] * c[1][3 * j + 1] - c[1][3 * j] * c[1][3 * i + 1]; }
        Assert.Equal(-200, a, 9);
    }

    [Fact]
    public void Separate_outlines_stay_separate_parts_and_add_up()
    {
        var u = Union.Of(Load((0, 0, 10, 10), (20, 0, 5, 4)));
        Assert.Equal(120, u.Area, 9);
        Assert.Equal(2, u.Parts);
    }

    [Fact]
    public void Survey_coordinates_keep_their_precision()
    {
        var u = Union.Of(Load((410000, 4495000, 10, 15), (410005, 4495005, 10, 10)));
        Assert.Equal(150 + 100 - 50, u.Area, 6);
        Near(new double[] { 410000, 4495000, 0, 410010, 4495000, 0, 410010, 4495005, 0, 410015, 4495005, 0, 410015, 4495015, 0, 410000, 4495015, 0 }, Assert.Single(Contours(u)), 6);
    }

    [Fact]
    public void An_outline_with_an_arc_keeps_it_as_a_bulge()
    {
        // A 10 × 10 square whose left side is a half circle bulging out (radius 5), and a 10 × 5 bar overlapping it.
        var doc = Cad.Doc(UnitsType.Meters);
        doc.Entities.Add(Cad.Poly(true, (0, 10, 1), (0, 0, 0), (10, 0, 0), (10, 10, 0)).On(doc, "A"));
        doc.Entities.Add(Cad.Rect(5, 0, 10, 5).On(doc, "A"));
        var u = Union.Of(Cad.Run(doc).Items.Select(i => i.Id));
        Assert.Null(u.Error);
        Assert.Equal(100 + Math.PI * 12.5 + 25, u.Area, 6);
        var v = Assert.Single(Contours(u));
        Assert.Equal(6 * 3, v.Length);                                                                  // (0,0) (15,0) (15,5) (10,5) (10,10) (0,10)~arc
        int arc = Enumerable.Range(0, 6).Single(i => v[3 * i + 2] != 0);
        Assert.Equal(0, v[3 * arc], 6); Assert.Equal(10, v[3 * arc + 1], 6); Assert.Equal(1, v[3 * arc + 2], 9);
    }

    [Fact]
    public void Open_self_crossing_and_unknown_items_are_left_out_and_listed()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        doc.Entities.Add(Cad.Rect(0, 0, 10, 10).On(doc, "C"));
        doc.Entities.Add(Cad.Poly(false, (0, 0, 0), (5, 0, 0), (5, 5, 0)).On(doc, "C"));
        doc.Entities.Add(Cad.Poly(true, (20, 0, 0), (22, 2, 0), (22, 0, 0), (20, 2, 0)).On(doc, "C"));    // a bow tie
        var ids = Cad.Run(doc).Items.Select(i => i.Id).ToList();
        var u = Union.Of(ids.Append("FFFF"));
        Assert.Equal(100, u.Area, 9);
        Assert.Equal(new[] { ids[1], ids[2], "FFFF" }, u.Bad);
    }

    [Fact]
    public void A_circle_joins_the_union()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        doc.Entities.Add(new ACadSharp.Entities.Circle { Center = new CSMath.XYZ(0, 0, 0), Radius = 2 }.On(doc, "C"));
        doc.Entities.Add(Cad.Rect(0, -2, 4, 4).On(doc, "C"));
        var u = Union.Of(Cad.Run(doc).Items.Select(i => i.Id));
        Assert.Equal(16 + Math.PI * 4 / 2, u.Area, 6);
    }

    [Fact]
    public void The_union_answers_for_the_last_file_only_and_as_json()
    {
        var first = Load((0, 0, 10, 10));
        var doc = Cad.Doc(UnitsType.Millimeters);
        doc.Entities.Add(Cad.Rect(0, 0, 4000, 3000).On(doc, "AC_COVER"));
        doc.Entities.Add(Cad.Rect(2000, 0, 4000, 3000).On(doc, "AC_COVER"));
        var run = JsonDocument.Parse(ResultJson.Run(Cad.Bytes(doc, true), "b.dwg", new Settings())).RootElement;
        var ids = run.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("id").GetString()).ToArray();
        var json = JsonDocument.Parse(ResultJson.Union(JsonSerializer.Serialize(ids))).RootElement;
        Assert.Equal("union", json.GetProperty("type").GetString());
        Assert.Equal(18, json.GetProperty("area").GetDouble(), 6);                                     // millimetres to metres: 6 × 3
        Assert.Equal(JsonValueKind.Null, json.GetProperty("error").ValueKind);
        Assert.Equal(12, json.GetProperty("verts")[0].GetArrayLength());
        Assert.Equal(10, json.GetProperty("paths")[0].GetArrayLength());
        // An id of the first file is unknown now.
        var stale = JsonDocument.Parse(ResultJson.Union(JsonSerializer.Serialize(first.Where(f => !ids.Contains(f)).Append("ABCDEF")))).RootElement;
        Assert.Equal(0, stale.GetProperty("area").GetDouble());
        Assert.Contains("ABCDEF", stale.GetProperty("bad").EnumerateArray().Select(b => b.GetString()));
        Assert.Equal(JsonValueKind.String, JsonDocument.Parse(ResultJson.Union("not json")).RootElement.GetProperty("error").ValueKind);   // never throws
    }

    [Fact]
    public void Fifty_outlines_unite_quickly()
    {
        var rects = Enumerable.Range(0, 50).Select(i => ((double)(i % 10) * 7, (double)(i / 10) * 7, 8.0, 8.0)).ToArray();
        var ids = Load(rects);
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var u = Union.Of(ids);
        sw.Stop();
        Assert.Null(u.Error);
        Assert.Equal((9 * 7 + 8) * (4 * 7 + 8), u.Area, 6);                                            // they overlap into one 71 × 36 block
        Assert.True(sw.ElapsedMilliseconds < 1500, $"{sw.ElapsedMilliseconds} ms");
    }
    // ---- the committed drawings (written by _tests/coverage/make-examples.mjs) ----

    [Fact]
    public void The_example_permit_measures_as_spec_12_says()
    {
        var bytes = File.ReadAllBytes(Path.Combine(Cad.Root(), "js", "coverage", "examples", "example-permit.dxf"));
        var r = Quantities.Run(bytes, new Settings());
        Assert.Equal("dxf", r.Format); Assert.Equal("2000", r.Version);
        Assert.Equal("m", r.Used); Assert.Equal("file", r.UnitsSource);
        var expected = new Dictionary<string, double>
        {
            ["AC_PLOT"] = 500, ["AC_COVER"] = 150, ["AC_GREEN"] = 140, ["AC_LVL_B1"] = 150, ["AC_LVL_00"] = 150, ["AC_LVL_01"] = 150, ["AC_LVL_02"] = 150,
            ["AC_SEMIOPEN"] = 20 + 30 + 40, ["AC_STAIR_COMMON"] = 60, ["AC_BALCONY"] = 30,
        };
        foreach (var (layer, area) in expected) Assert.Equal(area, r.Layer(layer).Area, 6);
        Assert.Equal(16, r.Items.Count);                                                                // 15 outlines and the open polyline
        Assert.Single(r.Items, i => i.Layer == "AC_GREEN" && i.Area == 0 && i.Verts == null);
        var plot = r.Items.Single(i => i.Layer == "AC_PLOT");
        Near(new double[] { 410000, 4495000, 0, 410020, 4495000, 0, 410020, 4495025, 0, 410000, 4495025, 0 }, plot.Verts, 6);
        var u = Union.Of(r.Items.Where(i => i.Layer == "AC_COVER").Select(i => i.Id));
        Assert.Equal(150, u.Area, 6);
        Near(new double[] { 410000, 4495010, 0, 410010, 4495010, 0, 410010, 4495025, 0, 410000, 4495025, 0 }, Assert.Single(u.Verts), 6);
    }

    [Fact]
    public void The_layer_template_carries_every_template_layer_and_a_Greek_legend()
    {
        var bytes = File.ReadAllBytes(Path.Combine(Cad.Root(), "js", "coverage", "examples", "layer-template.dxf"));
        Assert.StartsWith("  0\r\nSECTION", Encoding.ASCII.GetString(bytes, 0, 14));
        var doc = ACadSharp.IO.DxfReader.Read(new MemoryStream(bytes));
        var names = doc.Layers.Select(l => l.Name).ToHashSet();
        var expected = new[] { "AC_PLOT", "AC_COVER", "AC_LVL_B2", "AC_LVL_B1", "AC_LVL_00", "AC_LVL_09", "AC_LVL_ATTIC", "AC_MEZZ", "AC_SEMIOPEN", "AC_BALCONY",
            "AC_STAIR_COMMON", "AC_STAIR_UNIT", "AC_VOID", "AC_PILOTIS", "AC_BSMT_MAIN", "AC_EXCL_OTHER", "AC_GREEN" };
        foreach (var n in expected) Assert.Contains(n, names);
        Assert.Equal(25, names.Count(n => n.StartsWith("AC_")));                                        // the 25 template layers
        var texts = doc.Entities.OfType<ACadSharp.Entities.TextEntity>().Select(t => t.Value).ToList();
        Assert.Contains(texts, t => t.StartsWith("AC_PLOT") && t.Contains("Οικόπεδο"));
        Assert.Contains(texts, t => t.StartsWith("AC_LVL_B1") && t.Contains("Υπόγειο -1"));
    }
}
```

Run:
```bash
node _tests/extract.mjs $PLAN _src/dwg-engine/Tests/CoverageTests.cs
dotnet test _src/dwg-engine/Tests 2>&1 | grep -E "error CS" | head -3
```
Expected: a compile error `CS0246`: `UnionResult` not found.

- [ ] **Step 2: Write the engine additions**

<!-- file: _src/dwg-engine/Engine/Model.cs -->
```csharp
namespace AidedCam.Dwg;

// The engine's result for one file (spec §3 contract). Lengths in metres, areas in m², coordinates in metres.
public sealed class Result
{
    public string Format = "dwg";                  // "dwg" or "dxf"
    public string Version = "";                    // AutoCAD version name, e.g. "2018"
    public string Units = "mm";                    // what the file states: mm, cm, m, inch, ft, … or "none"
    public string UnitsSource = "file";            // "file", "setting", "assumed" or "override"
    public string Used = "mm";                     // the unit the scale came from: the override, the file's, the setting's, or mm
    public List<LayerTotal> Layers = new();
    public List<BlockCount> Blocks = new();
    public List<Schedule> Schedules = new();
    public List<Item> Items = new();
    public List<string> Xrefs = new();
    public NotMeasured NotMeasured = new();
    public List<Warning> Warnings = new();
    public double X0, Y0, X1, Y1;                   // bounding box of every item's path
    public bool Simplified;                        // drawing paths were coarsened to stay within the point budget
}

public sealed class LayerTotal
{
    public string Name = "0";
    public string Color = "#ffffff";               // #rrggbb of the layer
    public bool Off, Frozen;
    public double Len, Area, HatchArea;
    public int LenCount, AreaCount, HatchCount, Bad;
}

public sealed class BlockCount
{
    public string Name = "", Layer = "0";
    public int Count;                              // model-space inserts (a MINSERT counts rows × columns)
    public int Nested;                             // inserts found inside other blocks, times their placements
}

public sealed class Schedule
{
    public string Block = "";
    public List<string> Tags = new();
    public List<ScheduleRow> Rows = new();
}

public sealed class ScheduleRow
{
    public List<string> Values = new();
    public int Count;
}

// One drawable thing: a curve, a hatch, or a whole block insert. Paths are flat [x0, y0, x1, y1, …] polylines.
public sealed class Item
{
    public string Id = "";                         // DWG handle, hex
    public string Layer = "0";
    public string Kind = "line";                   // line, arc, circle, polyline, spline, ellipse, hatch, insert
    public double Len, Area;
    public string Block;                           // effective block name, inserts only
    public int Copies = 1;                         // a MINSERT's rows × columns
    public bool Bad;                               // area that cannot be trusted: left out of the totals
    public List<double[]> Path = new();
    public double[] Verts;                         // closed 2D and lightweight polylines only: [x, y, bulge, …] in metres (coverage pre-check)
}

public sealed class NotMeasured
{
    public int Text, Dim, Solid3d, Mesh, Proxy, Other, InsideBlocks;
}

public sealed class Warning
{
    public string Id = "";
    public List<(string Key, string Value)> Params = new();
}

public sealed class Settings
{
    public string Units = "auto";                  // for files that state no units: auto, mm, cm, m, inch, ft
    public string Override = "";                   // the visitor's correction for one file, whatever it states: mm, cm, m, inch, ft
}

// A file the engine refuses. Reason is one of: read, version, limit, empty (all in paper space), blank.
public sealed class DwgFileException(string reason, string message) : Exception(message)
{
    public string Reason { get; } = reason;
}

public static class Limits
{
    public const int MaxBytes = 30 * 1024 * 1024;
    public const int MaxEntities = 300_000;        // model-space entities
    public const int MaxPathPoints = 1_000_000;    // above this the drawing is coarsened (Result.Simplified)
}
```

<!-- file: _src/dwg-engine/Engine/Measure.cs -->
```csharp
using ACadSharp.Entities;
using CSMath;

namespace AidedCam.Dwg;

// A measured entity, in drawing units: its kind, its true length and area, and outlines in its own plane
// that Map carries into model space (or block space, for entities inside a block definition).
public sealed class Shape
{
    public string Kind = "line";
    public double Len, Area;
    public bool Bad;                                // an area that cannot be trusted (self-intersecting outline)
    public bool IsCurve => Kind != "hatch";
    public List<Outline> Outlines = new();
    public Affine Map = Affine.Identity;
    public bool HasVerts;                           // a closed 2D or lightweight polyline: its true vertices are reported (Verts)

    // The true vertices of a closed polyline in drawing coordinates (units, not metres): [x, y, bulge, …], arcs as
    // bulges. Null unless HasVerts, or when the polyline does not lie flat in the drawing's XY plane.
    public double[] Verts()
    {
        if (!HasVerts || Outlines.Count != 1 || !Flat.Of(Map, out double sign)) return null;
        var o = Outlines[0];
        var v = new double[o.Pieces.Count * 3];
        for (int i = 0; i < o.Pieces.Count; i++)
        {
            var p = o.Pieces[i];
            var a = Map.Apply(p.Start.X, p.Start.Y, 0);
            v[3 * i] = a.X; v[3 * i + 1] = a.Y;
            v[3 * i + 2] = p.Kind == PieceKind.Arc ? Math.Tan(p.Sweep / 4) * sign : 0;
        }
        return v;
    }

    public IEnumerable<List<(double X, double Y, double Z)>> Polylines(double dev, Affine outer)
    {
        var map = Map.Then(outer);
        double k = Math.Max(map.MaxScale, 1e-12);
        foreach (var o in Outlines)
        {
            var pts = o.Sample(dev / k);
            var line = new List<(double, double, double)>(pts.Count);
            foreach (var p in pts) line.Add(map.Apply(p.X, p.Y, 0));
            yield return line;
        }
    }
}

// Measures the curve entities (spec §4): lines, arcs, circles, polylines (with bulges), splines and ellipses.
// Everything is measured in the entity's own plane, so a tilted circle keeps its true length and area.
public static class Measure
{
    public static bool IsCurveType(Entity e) => e is Line or Circle or LwPolyline or Polyline2D or Polyline3D or Spline or Ellipse;

    // Returns null for anything that is not a curve.
    public static Shape Curve(Entity e) => e switch
    {
        Line l => LineShape(l),
        Arc a => ArcShape(a),                       // Arc derives from Circle: test it first
        Circle c => CircleShape(c),
        LwPolyline p => LwShape(p),
        Polyline2D p => Poly2DShape(p),
        Polyline3D p => Poly3DShape(p),
        Spline s => SplineShape(s),
        Ellipse el => EllipseShape(el),
        _ => null,
    };

    static Shape LineShape(Line l)
    {
        var s = new Shape { Kind = "line" };
        var o = new Outline();
        o.Pieces.Add(Piece.Line(new V(l.StartPoint.X, l.StartPoint.Y), new V(l.EndPoint.X, l.EndPoint.Y)));
        s.Outlines.Add(o);
        var d = l.EndPoint - l.StartPoint;
        s.Len = Math.Sqrt(d.X * d.X + d.Y * d.Y + d.Z * d.Z);
        return s;
    }

    static Shape ArcShape(Arc a)
    {
        double sweep = a.EndAngle - a.StartAngle;
        while (sweep <= 0) sweep += 2 * Math.PI;
        while (sweep > 2 * Math.PI) sweep -= 2 * Math.PI;
        var o = new Outline();
        o.Pieces.Add(Piece.Arc(new V(a.Center.X, a.Center.Y), a.Radius, a.StartAngle, sweep));
        var s = new Shape { Kind = "arc", Map = Affine.Ocs(a.Normal.X, a.Normal.Y, a.Normal.Z, a.Center.Z) };
        s.Outlines.Add(o);
        s.Len = a.Radius * sweep;
        return s;
    }

    static Shape CircleShape(Circle c)
    {
        var o = new Outline { Closed = true };
        o.Pieces.Add(Piece.Arc(new V(c.Center.X, c.Center.Y), c.Radius, 0, 2 * Math.PI));
        var s = new Shape { Kind = "circle", Map = Affine.Ocs(c.Normal.X, c.Normal.Y, c.Normal.Z, c.Center.Z) };
        s.Outlines.Add(o);
        s.Len = 2 * Math.PI * c.Radius;
        s.Area = Math.PI * c.Radius * c.Radius;
        return s;
    }

    static Shape LwShape(LwPolyline p)
    {
        var pts = p.Vertices.Select(v => (new V(v.Location.X, v.Location.Y), v.Bulge)).ToList();
        var s = BulgeShape(pts, p.IsClosed);
        s.Map = Affine.Ocs(p.Normal.X, p.Normal.Y, p.Normal.Z, p.Elevation);
        s.HasVerts = s.Outlines[0].Closed && s.Outlines[0].Pieces.Count > 0;
        return s;
    }

    static Shape Poly2DShape(Polyline2D p)
    {
        // Spline-fit polylines keep their frame (control) vertices: only the curve's own vertices are measured.
        var pts = p.Vertices.Where(v => !v.Flags.HasFlag(VertexFlags.SplineFrameControlPoint))
            .Select(v => (new V(v.Location.X, v.Location.Y), v.Bulge)).ToList();
        var s = BulgeShape(pts, p.IsClosed);
        s.Map = Affine.Ocs(p.Normal.X, p.Normal.Y, p.Normal.Z, p.Elevation);
        s.HasVerts = s.Outlines[0].Closed && s.Outlines[0].Pieces.Count > 0;
        return s;
    }

    // A 3D polyline has no plane: its length is the true 3D length, it has no area, and it is drawn projected.
    static Shape Poly3DShape(Polyline3D p)
    {
        var v = p.Vertices.Where(x => !x.Flags.HasFlag(VertexFlags.SplineFrameControlPoint)).Select(x => x.Location).ToList();
        if (p.IsClosed && v.Count > 2) v.Add(v[0]);
        var s = new Shape { Kind = "polyline" };
        var o = new Outline();
        if (v.Count >= 2) o.Pieces.Add(Piece.Points(v.Select(q => new V(q.X, q.Y)).ToList()));
        s.Outlines.Add(o);
        for (int i = 1; i < v.Count; i++) { var d = v[i] - v[i - 1]; s.Len += Math.Sqrt(d.X * d.X + d.Y * d.Y + d.Z * d.Z); }
        return s;
    }

    static Shape BulgeShape(List<(V P, double Bulge)> v, bool closedFlag)
    {
        var s = new Shape { Kind = "polyline" };
        var o = new Outline();
        s.Outlines.Add(o);
        if (v.Count < 2) return s;
        // A polyline whose last vertex returns to its first is closed too, even without the flag.
        bool closed = closedFlag || (v.Count > 2 && (v[^1].P - v[0].P).Length < 1e-9 * Math.Max(1, v[0].P.Length));
        int n = closedFlag ? v.Count : v.Count - 1;
        for (int i = 0; i < n; i++)
        {
            var a = v[i]; var b = v[(i + 1) % v.Count];
            if ((b.P - a.P).Length < 1e-15) continue;                               // a repeated vertex
            o.Pieces.Add(Piece.Bulge(a.P, b.P, a.Bulge));
        }
        o.Closed = closed;
        s.Len = o.Length;
        if (closed) SetArea(s, o);
        return s;
    }

    // Exact area, unless the outline crosses itself (then the area is meaningless: Bad, left out of totals).
    static void SetArea(Shape s, Outline o)
    {
        double len = o.Length;
        if (len <= 0) return;
        var ring = o.Sample(len * 1e-5);
        if (Geo.SelfIntersects(ring)) { s.Bad = true; s.Area = 0; return; }
        s.Area = Math.Abs(o.SignedArea);
    }

    // Splines go through Eyeshot's NURBS curve for an exact length (spec §3). Eyeshot takes rational control
    // points in homogeneous form (x·w, y·w, z·w, w).
    static Shape SplineShape(Spline sp)
    {
        var s = new Shape { Kind = "spline" };
        List<XYZ> pts3;
        double len;
        var curve = ToEyeshot(sp);
        if (curve != null)
        {
            len = curve.Length();
            double dev = Math.Max(len * 1e-5, 1e-12);
            var path = curve.ConvertToLinearPath(dev, 0);
            pts3 = path.Vertices.Select(p => new XYZ(p.X, p.Y, p.Z)).ToList();
        }
        else if (sp.FitPoints.Count >= 2)
        {
            pts3 = sp.FitPoints.ToList();                                           // a fit-point spline Eyeshot can't take: chords through the fit points
            len = 0;
            for (int i = 1; i < pts3.Count; i++) len += (pts3[i] - pts3[i - 1]).GetLength();
        }
        else return null;
        s.Len = len;
        var flat = pts3.Select(p => new V(p.X, p.Y)).ToList();
        bool closed = sp.IsClosed || sp.IsPeriodic || (pts3.Count > 2 && (pts3[^1] - pts3[0]).GetLength() < len * 1e-9);
        var o = new Outline { Closed = closed };
        o.Pieces.Add(Piece.Points(flat, len));
        s.Outlines.Add(o);
        if (closed)
        {
            if (Geo.SelfIntersects(flat)) s.Bad = true;
            else s.Area = Newell(pts3);
        }
        return s;
    }

    static devDept.Eyeshot.Entities.Curve ToEyeshot(Spline sp)
    {
        int n = sp.ControlPoints.Count;
        if (n < 2 || sp.Knots.Count != n + sp.Degree + 1) return null;
        var cp = new devDept.Geometry.Point4D[n];
        for (int i = 0; i < n; i++)
        {
            double w = i < sp.Weights.Count && sp.Weights[i] > 0 ? sp.Weights[i] : 1;
            var p = sp.ControlPoints[i];
            cp[i] = new devDept.Geometry.Point4D(p.X * w, p.Y * w, p.Z * w, w);
        }
        try { return new devDept.Eyeshot.Entities.Curve(sp.Degree, sp.Knots.ToArray(), cp); }
        catch { return null; }
    }

    // Ellipses: P(t) = C + cos t · M + sin t · m, with m = (N × M) · ratio. The length is integrated numerically
    // (Gauss–Legendre on 64 panels), accurate far beyond the drawing's precision.
    static Shape EllipseShape(Ellipse el)
    {
        var n = el.Normal; var M = el.MajorAxisEndPoint;
        double nl = Math.Sqrt(n.X * n.X + n.Y * n.Y + n.Z * n.Z);
        if (nl < 1e-12) { n = new XYZ(0, 0, 1); nl = 1; }
        var mnr = new XYZ((n.Y * M.Z - n.Z * M.Y) / nl, (n.Z * M.X - n.X * M.Z) / nl, (n.X * M.Y - n.Y * M.X) / nl) * el.RadiusRatio;
        double t0 = el.StartParameter, t1 = el.EndParameter;
        while (t1 <= t0) t1 += 2 * Math.PI;
        bool full = el.IsFullEllipse || Math.Abs(t1 - t0 - 2 * Math.PI) < 1e-9;
        if (full) { t0 = 0; t1 = 2 * Math.PI; }
        double a = M.GetLength(), b = mnr.GetLength();
        XYZ At(double t) => el.Center + M * Math.Cos(t) + mnr * Math.Sin(t);
        double Speed(double t) => (M * -Math.Sin(t) + mnr * Math.Cos(t)).GetLength();
        var s = new Shape { Kind = "ellipse", Len = Integrate(Speed, t0, t1) };
        int steps = Piece.ArcSteps(Math.Max(a, 1e-12), t1 - t0, Math.Max(a, 1e-12) * 2e-4) * 2;
        var pts = new List<V>(steps + 1);
        for (int i = 0; i <= steps; i++) { var p = At(t0 + (t1 - t0) * i / steps); pts.Add(new V(p.X, p.Y)); }
        var o = new Outline { Closed = full };
        o.Pieces.Add(Piece.Points(pts, s.Len));
        s.Outlines.Add(o);
        if (full) s.Area = Math.PI * a * b;
        return s;
    }

    static readonly double[] GlX = { -0.9061798459386640, -0.5384693101056831, 0, 0.5384693101056831, 0.9061798459386640 };
    static readonly double[] GlW = { 0.2369268850561891, 0.4786286704993665, 0.5688888888888889, 0.4786286704993665, 0.2369268850561891 };

    public static double Integrate(Func<double, double> f, double a, double b, int panels = 64)
    {
        double h = (b - a) / panels, s = 0;
        for (int i = 0; i < panels; i++)
        {
            double m = a + h * (i + 0.5);
            for (int k = 0; k < 5; k++) s += GlW[k] * f(m + h / 2 * GlX[k]);
        }
        return s * h / 2;
    }

    // Area of a planar polygon in 3D (Newell's method): the right area whatever plane the curve lies in.
    public static double Newell(IReadOnlyList<XYZ> p)
    {
        double x = 0, y = 0, z = 0;
        for (int i = 0; i < p.Count; i++)
        {
            var a = p[i]; var b = p[(i + 1) % p.Count];
            x += (a.Y - b.Y) * (a.Z + b.Z); y += (a.Z - b.Z) * (a.X + b.X); z += (a.X - b.X) * (a.Y + b.Y);
        }
        return Math.Sqrt(x * x + y * y + z * z) / 2;
    }
}
```

<!-- file: _src/dwg-engine/Engine/Quantities.cs -->
```csharp
using ACadSharp;
using ACadSharp.Entities;
using ACadSharp.Tables;

namespace AidedCam.Dwg;

// The whole measurement of one file (spec §4): model space only, every layer, results in metres.
public static class Quantities
{
    sealed class Pending
    {
        public Item Item;
        public Shape Shape;                       // curves and hatches
        public Insert Insert;                     // block inserts
    }

    public static Result Run(byte[] bytes, Settings settings)
    {
        var r = new Result();
        LastFile.Clear();                                                       // the union cache holds the last file only (coverage pre-check)
        var doc = Reader.Open(bytes, r);
        double k = Reader.Scale(doc, settings, r);
        var model = doc.Entities.ToList();
        if (model.Count > Limits.MaxEntities) throw new DwgFileException("limit", "over 300,000 entities");
        if (model.Count == 0)
        {
            bool paper = doc.BlockRecords.Any(b => b.Name.StartsWith("*Paper_Space", StringComparison.OrdinalIgnoreCase) && b.Entities.Count > 0);
            if (paper) throw new DwgFileException("empty", "model space is empty; the drawing is in paper space");
            throw new DwgFileException("blank", "the drawing is empty");
        }

        var blocks = new Blocks(doc, r.Format == "dxf");
        r.Xrefs = doc.BlockRecords.Where(Blocks.IsXref).Select(b => b.Name).OrderBy(n => n, StringComparer.OrdinalIgnoreCase).ToList();
        var pending = new List<Pending>();
        var counts = new Dictionary<(string Name, string Layer), BlockCount>();
        var schedules = new Dictionary<string, Dictionary<string, (List<string> Values, int Count)>>();
        var scheduleTags = new Dictionary<string, List<string>>();

        foreach (var e in model)
        {
            string layer = e.Layer?.Name ?? "0";
            string id = e.Handle.ToString("X");
            switch (e)
            {
                case Insert ins when ins.Block != null && !Blocks.IsXref(ins.Block):
                {
                    string name = blocks.Name(ins.Block);
                    int copies = Blocks.Copies(ins);
                    Count(counts, name, layer).Count += copies;
                    foreach (var kv in blocks.Nested(ins.Block)) Count(counts, kv.Key.Name, kv.Key.Layer ?? layer).Nested += copies * kv.Value;
                    r.NotMeasured.InsideBlocks += copies * blocks.Geometry(ins.Block);
                    AddSchedule(schedules, scheduleTags, name, ins, copies);
                    pending.Add(new Pending { Item = new Item { Id = id, Layer = layer, Kind = "insert", Block = name, Copies = copies }, Insert = ins });
                    break;
                }
                case Insert:
                    break;                                                          // an xref: listed, not loaded
                case Hatch h:
                {
                    var s = Hatches.Measure(h, r.Format == "dxf");
                    pending.Add(new Pending { Item = new Item { Id = id, Layer = layer, Kind = "hatch", Area = s.Area * k * k, Bad = s.Bad }, Shape = s });
                    break;
                }
                default:
                {
                    try
                    {
                        var s = Measure.Curve(e);
                        if (s == null) { NotMeasured(r.NotMeasured, e); break; }
                        var item = new Item { Id = id, Layer = layer, Kind = s.Kind, Len = s.Len * k, Area = s.Area * k * k, Bad = s.Bad };
                        var verts = s.Verts();
                        if (verts != null) { for (int i = 0; i < verts.Length; i += 3) { verts[i] *= k; verts[i + 1] *= k; } item.Verts = verts; }
                        pending.Add(new Pending { Item = item, Shape = s });
                    }
                    catch { r.NotMeasured.Other++; }
                    break;
                }
            }
        }

        Draw(r, pending, blocks, k);
        r.Items = pending.Select(p => p.Item).ToList();
        r.Layers = LayerTotals(doc, r.Items);
        r.Blocks = counts.Values.OrderBy(b => b.Name, StringComparer.OrdinalIgnoreCase).ThenBy(b => b.Name, StringComparer.Ordinal)
            .ThenBy(b => b.Layer, StringComparer.OrdinalIgnoreCase).ToList();
        r.Schedules = schedules.OrderBy(s => s.Key, StringComparer.OrdinalIgnoreCase).Select(s => new Schedule
        {
            Block = s.Key,
            Tags = scheduleTags[s.Key],
            Rows = s.Value.Values.OrderBy(v => string.Join("\u0001", v.Values), StringComparer.Ordinal)
                .Select(v => new ScheduleRow { Values = Pad(v.Values, scheduleTags[s.Key].Count), Count = v.Count }).ToList(),
        }).ToList();
        Warn(r, settings);
        LastFile.Keep(pending.Where(p => p.Shape != null && p.Shape.IsCurve).Select(p => (p.Item, p.Shape)), k);
        return r;
    }

    static BlockCount Count(Dictionary<(string, string), BlockCount> d, string name, string layer)
    {
        if (!d.TryGetValue((name, layer), out var b)) d[(name, layer)] = b = new BlockCount { Name = name, Layer = layer };
        return b;
    }

    // One schedule per block name, with its attribute tags as columns in order of first appearance; identical
    // rows are collapsed with a count (spec §4).
    static void AddSchedule(Dictionary<string, Dictionary<string, (List<string>, int)>> schedules, Dictionary<string, List<string>> tags, string name, Insert ins, int copies)
    {
        var attrs = ins.Attributes.ToList();
        if (attrs.Count == 0) return;
        if (!tags.TryGetValue(name, out var t)) { tags[name] = t = new List<string>(); schedules[name] = new(); }
        foreach (var a in attrs) if (!t.Contains(a.Tag ?? "")) t.Add(a.Tag ?? "");
        var values = t.Select(tag => attrs.FirstOrDefault(a => (a.Tag ?? "") == tag)?.Value ?? "").ToList();
        var rows = schedules[name];
        // Rows are keyed by their values under the tags known so far; a later tag only adds empty cells at the end.
        string key = string.Join("\u0001", values).TrimEnd('\u0001');
        rows[key] = rows.TryGetValue(key, out var row) ? (row.Item1, row.Item2 + copies) : (values, copies);
    }

    static List<string> Pad(List<string> v, int n) { var r = new List<string>(v); while (r.Count < n) r.Add(""); return r; }

    static void NotMeasured(NotMeasured nm, Entity e)
    {
        switch (e)
        {
            case TextEntity or MText or TableEntity: nm.Text++; break;          // AttributeEntity derives from TextEntity too
            case Dimension or Leader or MultiLeader or Tolerance: nm.Dim++; break;
            case Solid3D or Region or CadBody or ModelerGeometry: nm.Solid3d++; break;
            case Mesh or PolyfaceMesh or Face3D: nm.Mesh++; break;
            case ProxyEntity or UnknownEntity: nm.Proxy++; break;
            default: nm.Other++; break;
        }
    }

    // Paths in metres. The sampling tolerance follows the drawing's size; when the points would exceed the
    // budget, everything is sampled again more coarsely and the result says so (spec §8).
    static void Draw(Result r, List<Pending> pending, Blocks blocks, double k)
    {
        // The drawing's size, from a coarse pass (arcs as a few chords, blocks as their placements' origins).
        double x0 = double.MaxValue, y0 = double.MaxValue, x1 = double.MinValue, y1 = double.MinValue;
        void Grow(double x, double y) { x0 = Math.Min(x0, x); y0 = Math.Min(y0, y); x1 = Math.Max(x1, x); y1 = Math.Max(y1, y); }
        foreach (var p in pending)
        {
            if (p.Shape != null) { foreach (var line in p.Shape.Polylines(double.MaxValue, Affine.Identity)) foreach (var q in line) Grow(q.X, q.Y); }
            else Grow(p.Insert.InsertPoint.X, p.Insert.InsertPoint.Y);
        }
        double diag = x1 >= x0 ? Math.Sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0)) : 1;
        double dev = Math.Max(diag, 1e-9) * 2e-5;
        if (!Sample(pending, blocks, dev, k))
        {
            r.Simplified = true;
            Sample(pending, blocks, dev * 20, k, force: true);
        }
        x0 = double.MaxValue; y0 = double.MaxValue; x1 = double.MinValue; y1 = double.MinValue;
        foreach (var p in pending) foreach (var line in p.Item.Path) for (int i = 0; i + 1 < line.Length; i += 2) Grow(line[i], line[i + 1]);
        if (x1 >= x0) { r.X0 = x0; r.Y0 = y0; r.X1 = x1; r.Y1 = y1; }
    }

    // Returns false (and stops) when the point budget runs out, unless forced.
    static bool Sample(List<Pending> pending, Blocks blocks, double dev, double k, bool force = false)
    {
        long points = 0;
        foreach (var p in pending)
        {
            p.Item.Path.Clear();
            try
            {
                IEnumerable<List<(double X, double Y, double Z)>> lines;
                if (p.Shape != null) lines = p.Shape.Polylines(dev, Affine.Identity);
                else
                {
                    var inner = blocks.Drawing(p.Insert.Block, dev);
                    // Simplified: a block of many pieces is drawn as the outline of its extents, still one item.
                    if (force && inner.Count > 8) inner = new() { Box(inner) };
                    lines = Blocks.Placements(p.Insert).SelectMany(map => inner.Select(line => line.Select(q => map.Apply(q.X, q.Y, q.Z)).ToList()));
                }
                foreach (var line in lines)
                {
                    if (line.Count < 2) continue;
                    var flat = new double[line.Count * 2];
                    for (int i = 0; i < line.Count; i++) { flat[2 * i] = line[i].X * k; flat[2 * i + 1] = line[i].Y * k; }
                    p.Item.Path.Add(flat);
                    points += line.Count;
                }
            }
            catch { }  // An entity may fail to sample (e.g. Eyeshot curve operations): leave Path empty and continue.
            if (!force && points > Limits.MaxPathPoints) return false;
        }
        return true;
    }

    static List<(double X, double Y, double Z)> Box(List<List<(double X, double Y, double Z)>> lines)
    {
        double x0 = double.MaxValue, y0 = double.MaxValue, x1 = double.MinValue, y1 = double.MinValue;
        foreach (var line in lines) foreach (var q in line) { x0 = Math.Min(x0, q.X); y0 = Math.Min(y0, q.Y); x1 = Math.Max(x1, q.X); y1 = Math.Max(y1, q.Y); }
        return new() { (x0, y0, 0), (x1, y0, 0), (x1, y1, 0), (x0, y1, 0), (x0, y0, 0) };
    }

    static List<LayerTotal> LayerTotals(CadDocument doc, List<Item> items)
    {
        var d = new Dictionary<string, LayerTotal>();
        foreach (var it in items)
        {
            if (!d.TryGetValue(it.Layer, out var t))
            {
                d[it.Layer] = t = new LayerTotal { Name = it.Layer };
                if (doc.Layers.TryGetValue(it.Layer, out Layer l))
                {
                    t.Color = $"#{l.Color.R:x2}{l.Color.G:x2}{l.Color.B:x2}";
                    t.Off = !l.IsOn;
                    t.Frozen = l.Flags.HasFlag(LayerFlags.Frozen);
                }
            }
            if (it.Bad) t.Bad++;
            if (it.Kind == "insert") continue;
            if (it.Kind == "hatch")
            {
                if (!it.Bad) { t.HatchArea += it.Area; t.HatchCount++; }
                continue;
            }
            t.Len += it.Len; t.LenCount++;
            if (!it.Bad && it.Area > 0) { t.Area += it.Area; t.AreaCount++; }
        }
        return d.Values.OrderBy(t => t.Name, StringComparer.OrdinalIgnoreCase).ThenBy(t => t.Name, StringComparer.Ordinal).ToList();
    }

    static void Warn(Result r, Settings s)
    {
        void W(string id, params (string, string)[] p) => r.Warnings.Add(new Warning { Id = id, Params = p.ToList() });
        if (r.UnitsSource == "assumed") W("units-assumed");
        if (r.UnitsSource == "setting") W("units-setting", ("units", s.Units));
        if (r.UnitsSource == "override" && r.Units == "none") W("units-override-none", ("units", s.Override));
        else if (r.UnitsSource == "override") W("units-override", ("units", s.Override), ("file", r.Units));
        if (r.Xrefs.Count > 0) W("xrefs", ("count", r.Xrefs.Count.ToString()));
        int bad = r.Items.Count(i => i.Bad);
        if (bad > 0) W("bad-area", ("count", bad.ToString()));
        if (r.NotMeasured.InsideBlocks > 0) W("inside-blocks", ("count", r.NotMeasured.InsideBlocks.ToString()));
        var nm = r.NotMeasured;
        int other = nm.Text + nm.Dim + nm.Solid3d + nm.Mesh + nm.Proxy + nm.Other;
        if (other > 0) W("not-measured", ("count", other.ToString()));
        if (r.Simplified) W("simplified");
    }
}
```

<!-- file: _src/dwg-engine/Engine/ResultJson.cs -->
```csharp
using System.Text.Json;

namespace AidedCam.Dwg;

// The result as JSON for the page (spec §3 contract). Written by hand with Utf8JsonWriter: reflection-based
// serialization is disabled in a trimmed WebAssembly build.
public static class ResultJson
{
    static double R6(double v) => Math.Round(v, 6);
    static double R4(double v) => Math.Round(v, 4);

    static Utf8JsonWriter Writer(Stream s) =>
        new(s, new JsonWriterOptions { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping });

    public static string Write(string name, Result r)
    {
        var ms = new MemoryStream();
        using (var w = Writer(ms))
        {
            w.WriteStartObject();
            w.WriteString("type", "result");
            w.WriteStartObject("file");
            w.WriteString("name", name); w.WriteString("format", r.Format); w.WriteString("version", r.Version);
            w.WriteString("units", r.Units); w.WriteString("unitsSource", r.UnitsSource);
            w.WriteString("used", r.Used);
            w.WriteEndObject();

            w.WriteStartArray("layers");
            foreach (var l in r.Layers)
            {
                w.WriteStartObject();
                w.WriteString("name", l.Name); w.WriteString("color", l.Color);
                w.WriteBoolean("off", l.Off); w.WriteBoolean("frozen", l.Frozen);
                w.WriteNumber("len", R6(l.Len)); w.WriteNumber("lenCount", l.LenCount);
                w.WriteNumber("area", R6(l.Area)); w.WriteNumber("areaCount", l.AreaCount);
                w.WriteNumber("hatchArea", R6(l.HatchArea)); w.WriteNumber("hatchCount", l.HatchCount);
                w.WriteNumber("bad", l.Bad);
                w.WriteEndObject();
            }
            w.WriteEndArray();

            w.WriteStartArray("blocks");
            foreach (var b in r.Blocks)
            {
                w.WriteStartObject();
                w.WriteString("name", b.Name); w.WriteString("layer", b.Layer);
                w.WriteNumber("count", b.Count); w.WriteNumber("nested", b.Nested);
                w.WriteEndObject();
            }
            w.WriteEndArray();

            w.WriteStartArray("schedules");
            foreach (var s in r.Schedules)
            {
                w.WriteStartObject();
                w.WriteString("block", s.Block);
                w.WriteStartArray("tags"); foreach (var t in s.Tags) w.WriteStringValue(t); w.WriteEndArray();
                w.WriteStartArray("rows");
                foreach (var row in s.Rows)
                {
                    w.WriteStartObject();
                    w.WriteStartArray("values"); foreach (var v in row.Values) w.WriteStringValue(v); w.WriteEndArray();
                    w.WriteNumber("count", row.Count);
                    w.WriteEndObject();
                }
                w.WriteEndArray();
                w.WriteEndObject();
            }
            w.WriteEndArray();

            w.WriteStartArray("items");
            foreach (var it in r.Items)
            {
                w.WriteStartObject();
                w.WriteString("id", it.Id); w.WriteString("layer", it.Layer); w.WriteString("kind", it.Kind);
                w.WriteNumber("len", R6(it.Len)); w.WriteNumber("area", R6(it.Area));
                if (it.Block != null) w.WriteString("block", it.Block); else w.WriteNull("block");
                w.WriteNumber("copies", it.Copies); w.WriteBoolean("bad", it.Bad);
                if (it.Verts != null) WriteVerts(w, "verts", it.Verts);
                w.WriteStartArray("path");
                foreach (var line in it.Path)
                {
                    w.WriteStartArray();
                    foreach (var v in line) w.WriteNumberValue(R4(v));
                    w.WriteEndArray();
                }
                w.WriteEndArray();
                w.WriteEndObject();
            }
            w.WriteEndArray();

            w.WriteStartArray("xrefs"); foreach (var x in r.Xrefs) w.WriteStringValue(x); w.WriteEndArray();

            var nm = r.NotMeasured;
            w.WriteStartObject("notMeasured");
            w.WriteNumber("text", nm.Text); w.WriteNumber("dim", nm.Dim); w.WriteNumber("solid3d", nm.Solid3d);
            w.WriteNumber("mesh", nm.Mesh); w.WriteNumber("proxy", nm.Proxy); w.WriteNumber("other", nm.Other);
            w.WriteNumber("insideBlocks", nm.InsideBlocks);
            w.WriteEndObject();

            w.WriteStartArray("warnings");
            foreach (var wn in r.Warnings)
            {
                w.WriteStartObject();
                w.WriteString("id", wn.Id);
                w.WriteStartObject("params"); foreach (var (key, value) in wn.Params) w.WriteString(key, value); w.WriteEndObject();
                w.WriteEndObject();
            }
            w.WriteEndArray();

            w.WriteStartObject("bbox");
            w.WriteNumber("x0", R4(r.X0)); w.WriteNumber("y0", R4(r.Y0)); w.WriteNumber("x1", R4(r.X1)); w.WriteNumber("y1", R4(r.Y1));
            w.WriteEndObject();
            w.WriteBoolean("simplified", r.Simplified);
            w.WriteEndObject();
        }
        return System.Text.Encoding.UTF8.GetString(ms.ToArray());
    }

    public static string Error(string name, string reason, string message)
    {
        var ms = new MemoryStream();
        using (var w = Writer(ms))
        {
            w.WriteStartObject();
            w.WriteString("type", "error"); w.WriteString("name", name);
            w.WriteString("reason", reason); w.WriteString("message", message ?? "");
            w.WriteEndObject();
        }
        return System.Text.Encoding.UTF8.GetString(ms.ToArray());
    }

    // True vertices: coordinates to 0.1 mm like the paths would lose, so to the micrometre; bulges to 1e-12.
    static void WriteVerts(Utf8JsonWriter w, string name, double[] v)
    {
        if (name != null) w.WriteStartArray(name); else w.WriteStartArray();
        for (int i = 0; i + 2 < v.Length; i += 3) { w.WriteNumberValue(R6(v[i])); w.WriteNumberValue(R6(v[i + 1])); w.WriteNumberValue(Math.Round(v[i + 2], 12)); }
        w.WriteEndArray();
    }

    // The union of the last file's closed items (coverage pre-check, spec §3): { type: 'union', area, paths,
    // verts, bad, parts } or, when the booleans failed, the same with error set. Never throws.
    public static string Union(string idsJson)
    {
        UnionResult u;
        try
        {
            var ids = new List<string>();
            using (var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(idsJson) ? "[]" : idsJson))
                foreach (var e in doc.RootElement.EnumerateArray()) if (e.ValueKind == JsonValueKind.String) ids.Add(e.GetString());
            u = AidedCam.Dwg.Union.Of(ids);
        }
        catch (Exception ex) { u = new UnionResult { Error = ex.GetType().Name }; }
        var ms = new MemoryStream();
        using (var w = Writer(ms))
        {
            w.WriteStartObject();
            w.WriteString("type", "union");
            w.WriteNumber("area", R6(u.Area));
            w.WriteNumber("parts", u.Parts);
            w.WriteStartArray("paths");
            foreach (var line in u.Paths) { w.WriteStartArray(); foreach (var v in line) w.WriteNumberValue(R4(v)); w.WriteEndArray(); }
            w.WriteEndArray();
            w.WriteStartArray("verts");
            foreach (var v in u.Verts) WriteVerts(w, null, v);
            w.WriteEndArray();
            w.WriteStartArray("bad"); foreach (var b in u.Bad) w.WriteStringValue(b); w.WriteEndArray();
            if (u.Error != null) w.WriteString("error", u.Error); else w.WriteNull("error");
            w.WriteEndObject();
        }
        return System.Text.Encoding.UTF8.GetString(ms.ToArray());
    }

    // The one entry point the host calls: never throws.
    public static string Run(byte[] bytes, string name, Settings settings)
    {
        try { return Write(name, Quantities.Run(bytes, settings)); }
        catch (DwgFileException ex) { return Error(name, ex.Reason, ex.Message); }
        catch (Exception ex) { return Error(name, "engine", ex.GetType().Name + ": " + ex.Message); }   // not the file's fault as far as we know
    }
}
```

<!-- file: _src/dwg-engine/Engine/Union.cs -->
```csharp
using devDept.Geometry;
using EyLine = devDept.Eyeshot.Entities.Line;
using EyArc = devDept.Eyeshot.Entities.Arc;
using EyCurve = devDept.Eyeshot.Entities.ICurve;
using EyComposite = devDept.Eyeshot.Entities.CompositeCurve;
using EyRegion = devDept.Eyeshot.Entities.Region;

namespace AidedCam.Dwg;

// Whether a shape's plane map lies flat in the drawing's XY plane (normal ±Z), and the sign that turns its own
// counter-clockwise into the drawing's: −1 for a mirrored (normal −Z) entity.
public static class Flat
{
    public static bool Of(Affine map, out double sign)
    {
        var o = map.Apply(0, 0, 0); var ex = map.Apply(1, 0, 0); var ey = map.Apply(0, 1, 0); var ez = map.Apply(0, 0, 1);
        double zx = ez.X - o.X, zy = ez.Y - o.Y, zz = ez.Z - o.Z;
        double det = (ex.X - o.X) * (ey.Y - o.Y) - (ex.Y - o.Y) * (ey.X - o.X);
        sign = det < 0 ? -1 : 1;
        double len = Math.Sqrt(zx * zx + zy * zy + zz * zz);
        return len > 0 && Math.Abs(Math.Abs(zz) / len - 1) < 1e-9;
    }
}

// The last file's closed curves, kept for union requests after a remap (coverage pre-check, spec §3). One
// entry, replaced when the next file is measured.
public static class LastFile
{
    internal sealed class Entry { public Item Item; public Shape Shape; }
    static Dictionary<string, Entry> items = new();
    static double scale = 1;

    public static void Clear() { items = new(); scale = 1; }

    internal static void Keep(IEnumerable<(Item Item, Shape Shape)> list, double k)
    {
        var d = new Dictionary<string, Entry>();
        foreach (var (it, s) in list) if (s.Outlines.Count == 1 && s.Outlines[0].Closed) d[it.Id] = new Entry { Item = it, Shape = s };
        items = d; scale = k;
    }

    public static bool Has(string id) => items.ContainsKey(id);
    internal static bool TryGet(string id, out Entry e) => items.TryGetValue(id, out e);
    public static double Scale => scale;
}

// The union's answer: area in m², drawable paths and true vertices in metres, and the items left out.
public sealed class UnionResult
{
    public double Area;
    public List<double[]> Paths = new();
    public List<double[]> Verts = new();           // one [x, y, bulge, …] per contour: each part's outer first, then its holes
    public List<string> Bad = new();
    public int Parts;                               // separate pieces of the union
    public string Error;                            // set when the union itself failed: the page falls back to the sum
}

// The 2D union of closed outlines with Eyeshot's region booleans (managed core, spec §3). Outlines are moved
// near the origin first, so survey coordinates (ΕΓΣΑ87, millions of metres) keep their precision; areas and
// vertices come back from the resulting contours with the engine's own exact geometry.
public static class Union
{
    public static UnionResult Of(IEnumerable<string> ids)
    {
        var r = new UnionResult();
        var shapes = new List<(Item Item, List<Piece> Pieces)>();
        foreach (var id in ids.Distinct())
        {
            if (!LastFile.TryGet(id, out var e) || e.Item.Bad) { r.Bad.Add(id); continue; }
            var pieces = InDrawing(e.Shape, LastFile.Scale);
            if (pieces == null) { r.Bad.Add(id); continue; }
            shapes.Add((e.Item, pieces));
        }
        if (shapes.Count == 0) return r;

        // Local origin: the first vertex, so the region booleans work on small numbers.
        var origin = shapes[0].Pieces[0].Start;
        double sum = 0, max = 0;
        var regions = new List<EyRegion>();
        foreach (var (item, pieces) in shapes)
        {
            var local = pieces.Select(p => Move(p, origin * -1)).ToList();
            double a = Math.Abs(Signed(local));
            sum += a; max = Math.Max(max, a);
            regions.Add(new EyRegion(new EyComposite(local.SelectMany(ToEyeshot).ToList()), Plane.XY));
        }

        EyRegion[] result;
        try { result = regions.Count == 1 ? regions.ToArray() : EyRegion.Union(regions.ToArray()); }
        catch (Exception ex) { r.Error = ex.GetType().Name; return r; }

        double total = 0;
        foreach (var region in result)
        {
            bool outer = true;
            foreach (var contour in region.ContourList)
            {
                var pieces = FromEyeshot(contour);
                if (pieces == null) { r.Error = "contour"; return r; }
                double a = Signed(pieces);
                // Each part's outer contour counter-clockwise, its holes clockwise, whatever Eyeshot returned.
                if ((outer && a < 0) || (!outer && a > 0)) pieces = Reverse(pieces);
                total += outer ? Math.Abs(a) : -Math.Abs(a);
                pieces = Merge(pieces).Select(p => Move(p, origin)).ToList();
                r.Verts.Add(VertsOf(outer ? StartLowLeft(pieces) : pieces));
                var o = new Outline { Closed = true };
                o.Pieces.AddRange(pieces);
                var pts = o.Sample(Math.Max(Math.Sqrt(max), 1e-6) * 2e-4);
                var flat = new double[pts.Count * 2];
                for (int i = 0; i < pts.Count; i++) { flat[2 * i] = pts[i].X; flat[2 * i + 1] = pts[i].Y; }
                r.Paths.Add(flat);
                outer = false;
            }
            r.Parts++;
        }
        // A union is never smaller than its largest outline nor bigger than their sum: anything else is a failed
        // boolean, and the page shows the plain sum with a warning instead.
        double tol = Math.Max(1e-6, sum * 1e-7);
        if (total < max - tol || total > sum + tol) { r.Error = "check"; r.Paths.Clear(); r.Verts.Clear(); r.Parts = 0; return r; }
        r.Area = total;
        return r;
    }

    // The outline in drawing coordinates, in metres: lines and arcs (points pieces become short lines).
    static List<Piece> InDrawing(Shape s, double k)
    {
        if (s.Outlines.Count != 1 || !Flat.Of(s.Map, out double sign)) return null;
        var list = new List<Piece>();
        V At(V p) { var q = s.Map.Apply(p.X, p.Y, 0); return new V(q.X * k, q.Y * k); }
        foreach (var p in s.Outlines[0].Pieces)
        {
            switch (p.Kind)
            {
                case PieceKind.Line: list.Add(Piece.Line(At(p.A), At(p.B))); break;
                case PieceKind.Arc:
                {
                    var c = At(p.C); var a = At(p.Start);
                    list.Add(Piece.Arc(c, (a - c).Length, Math.Atan2(a.Y - c.Y, a.X - c.X), p.Sweep * sign));
                    break;
                }
                default:
                    for (int i = 1; i < p.Pts.Count; i++) list.Add(Piece.Line(At(p.Pts[i - 1]), At(p.Pts[i])));
                    break;
            }
        }
        // A points outline (spline, ellipse) closes back to its start.
        if (list.Count > 0 && (list[^1].End - list[0].Start).Length > 1e-9 * Math.Max(1, list[0].Start.Length)) list.Add(Piece.Line(list[^1].End, list[0].Start));
        list.RemoveAll(p => p.Length < 1e-12);
        return list.Count > 0 ? list : null;
    }

    static Piece Move(Piece p, V d) => p.Kind == PieceKind.Line ? Piece.Line(p.A + d, p.B + d) : Piece.Arc(p.C + d, p.R, p.A0, p.Sweep);

    static double Signed(List<Piece> pieces) { double s = 0; foreach (var p in pieces) s += p.AreaTerm; return s; }

    static List<Piece> Reverse(List<Piece> pieces) => Enumerable.Reverse(pieces).Select(p => p.Reversed()).ToList();

    static IEnumerable<EyCurve> ToEyeshot(Piece p)
    {
        if (p.Kind == PieceKind.Line) { yield return new EyLine(p.A.X, p.A.Y, 0, p.B.X, p.B.Y, 0); yield break; }
        // A full circle goes in as two halves; a clockwise arc is built counter-clockwise, then reversed.
        int n = Math.Abs(p.Sweep) > Math.PI * 1.5 ? 2 : 1;
        for (int i = 0; i < n; i++)
        {
            double a0 = p.A0 + p.Sweep * i / n, sw = p.Sweep / n;
            double s = sw >= 0 ? a0 : a0 + sw, e = sw >= 0 ? a0 + sw : a0;
            var arc = new EyArc(Plane.XY, new Point3D(p.C.X, p.C.Y, 0), p.R, s, e);
            if (sw < 0) arc.Reverse();
            yield return arc;
        }
    }

    // A contour of lines and arcs, back as pieces; null if it holds anything else.
    static List<Piece> FromEyeshot(EyCurve contour)
    {
        var curves = contour is EyComposite cc ? cc.CurveList.ToList() : new List<EyCurve> { contour };
        var list = new List<Piece>();
        foreach (var c in curves)
        {
            V s = new(c.StartPoint.X, c.StartPoint.Y), e = new(c.EndPoint.X, c.EndPoint.Y);
            if (c is EyArc arc)
            {
                V cen = new(arc.Center.X, arc.Center.Y);
                double a0 = Math.Atan2(s.Y - cen.Y, s.X - cen.X), len = arc.Domain.Length;
                double sweep = len * (arc.Plane.AxisZ.Z >= 0 ? 1 : -1);
                var p = Piece.Arc(cen, arc.Radius, a0, sweep);
                if ((p.End - e).Length > 1e-6 * Math.Max(1, arc.Radius)) p = Piece.Arc(cen, arc.Radius, a0, -sweep);
                list.Add(p);
            }
            else if (c is EyLine) { if ((e - s).Length > 1e-12) list.Add(Piece.Line(s, e)); }
            else return null;
        }
        return list;
    }

    // Consecutive collinear lines, and consecutive arcs of one circle turning the same way, become one piece:
    // the booleans split edges where other outlines touched them, and a vertex table must not list those points.
    static List<Piece> Merge(List<Piece> pieces)
    {
        var list = new List<Piece>(pieces);
        bool Same(Piece a, Piece b)
        {
            if (a.Kind != b.Kind) return false;
            if (a.Kind == PieceKind.Line)
            {
                V d1 = a.B - a.A, d2 = b.B - b.A;
                return Math.Abs(V.Cross(d1, d2)) <= 1e-9 * d1.Length * d2.Length && d1.X * d2.X + d1.Y * d2.Y > 0;
            }
            return (a.C - b.C).Length <= 1e-7 * Math.Max(1, a.R) && Math.Abs(a.R - b.R) <= 1e-7 * Math.Max(1, a.R) && Math.Sign(a.Sweep) == Math.Sign(b.Sweep)
                && Math.Abs(a.Sweep + b.Sweep) < 2 * Math.PI - 1e-9;
        }
        Piece Join(Piece a, Piece b) => a.Kind == PieceKind.Line ? Piece.Line(a.A, b.B) : Piece.Arc(a.C, a.R, a.A0, a.Sweep + b.Sweep);
        bool changed = true;
        while (changed && list.Count > 2)
        {
            changed = false;
            for (int i = 0; i < list.Count && list.Count > 2; i++)
            {
                int j = (i + 1) % list.Count;
                if (!Same(list[i], list[j])) continue;
                list[i] = Join(list[i], list[j]);
                list.RemoveAt(j);
                if (j < i) i--;
                changed = true;
            }
        }
        return list;
    }

    // The outer contour starts at its lowest vertex (then the leftmost), so a vertex table reads the same
    // whatever vertex the booleans happened to start from.
    static List<Piece> StartLowLeft(List<Piece> pieces)
    {
        int best = 0;
        for (int i = 1; i < pieces.Count; i++)
        {
            V a = pieces[i].Start, b = pieces[best].Start;
            if (a.Y < b.Y - 1e-9 || (Math.Abs(a.Y - b.Y) <= 1e-9 && a.X < b.X)) best = i;
        }
        return pieces.Skip(best).Concat(pieces.Take(best)).ToList();
    }

    static double[] VertsOf(List<Piece> pieces)
    {
        var v = new double[pieces.Count * 3];
        for (int i = 0; i < pieces.Count; i++)
        {
            var p = pieces[i];
            v[3 * i] = p.Start.X; v[3 * i + 1] = p.Start.Y;
            v[3 * i + 2] = p.Kind == PieceKind.Arc ? Math.Tan(p.Sweep / 4) : 0;
        }
        return v;
    }
}
```

Run:
```bash
for f in Model Measure Quantities ResultJson Union; do node _tests/extract.mjs $PLAN _src/dwg-engine/Engine/$f.cs; done
git diff --stat _src/dwg-engine/Engine
```
Expected: `Measure.cs | 20 +`, `Model.cs | 1 +`, `Quantities.cs | 7 +-`, `ResultJson.cs | 42 +` (the new `Union.cs` is untracked).

- [ ] **Step 3: Run the tests**

Run: `dotnet test _src/dwg-engine/Tests 2>&1 | tail -1`
Expected: `Passed!  - Failed:     0, Passed:    74, …` (56 unchanged + 18). `Fifty_outlines_unite_quickly` must stay under its 1,500 ms bound on the desktop.

If a test fails, fix the engine, not the test: every expected number is worked out by hand in the test's comment.

- [ ] **Step 4: Commit**

```bash
git add _src/dwg-engine
git commit -F - <<'EOF'
Coverage pre-check: engine true vertices of closed polylines and the union of closed outlines

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 6: The browser engine: host, worker, republish, union parity

Changed existing files (given whole below):
- `Host/Program.cs` adds 5 lines, the `Union` export;
- `js/dwg/worker.js` adds 16 lines and changes 1: `lastKey`, the union branch, and `dotnet.js?v=20261015`;
- `js/dwg/ui.js` changes 1 line, the worker's `?v=`.

**Files:**
- Modify: `_src/dwg-engine/Host/Program.cs`, `js/dwg/worker.js`, `js/dwg/ui.js`
- Generate: `js/dwg/engine/*` (republished; 108 files)
- Create: `_tests/coverage/union.html`, `_tests/coverage/browser-check.cjs`

**Interfaces:**
- Consumes: `ResultJson.Union` (Task 5); `fixtures/union.dxf` (Task 4).
- Produces:
  - `[JSExport] Api.Union(string idsJson) → string`.
  - The worker answers `{ type: 'process', id, name: 'union', bytes: <empty>, settings: { union: { fileKey, ids } } }` with `{ type: 'union', id, area, parts, paths, verts, bad, error }`. `fileKey` is the message id of the last successfully measured file; any other key gives `error: 'stale'`.
  - `node _tests/coverage/browser-check.cjs [page|union]`. It loads `browser-check.js` only in `page` mode, which arrives in Task 13.

- [ ] **Step 1: Write the host export and the worker**

<!-- file: _src/dwg-engine/Host/Program.cs -->
```csharp
using System.Runtime.InteropServices.JavaScript;
using System.Text.Json;
using AidedCam.Dwg;

// The engine starts with the worker; there is nothing to do until a file arrives.
Console.WriteLine("dwg quantities engine ready");

public static partial class Api
{
    // One file in, the result JSON out (spec §3 contract). Never throws: a refused file is an error result.
    [JSExport]
    public static string Quantities(byte[] bytes, string name, string settingsJson) =>
        ResultJson.Run(bytes, name, ParseSettings(settingsJson));

    // The 2D union of closed items of the last measured file (coverage pre-check, spec §3); ids as a JSON array
    // of handles. Never throws.
    [JSExport]
    public static string Union(string idsJson) => ResultJson.Union(idsJson);

    static Settings ParseSettings(string json)
    {
        var s = new Settings();
        if (string.IsNullOrWhiteSpace(json)) return s;
        using var doc = JsonDocument.Parse(json);
        if (doc.RootElement.TryGetProperty("units", out var u) && u.ValueKind == JsonValueKind.String) s.Units = u.GetString();
        if (doc.RootElement.TryGetProperty("override", out var o) && o.ValueKind == JsonValueKind.String) s.Override = o.GetString();
        return s;
    }
}
```

<!-- file: js/dwg/worker.js -->
```js
// The DWG quantities engine's worker (spec §3), built like the laser engine's: on the first message it boots
// the .NET runtime from ./engine/, fetching each .wasm as its gzip copy and unpacking it with the browser's
// DecompressionStream, so any static host works. Then it measures one file per 'process' message (the
// message the shared js/laser/bridge.js sends).
// The coverage pre-check asks for unions through the same message: settings.union = { fileKey, ids } with no
// bytes. The engine keeps the last measured file's closed items; fileKey is the id of that file's message,
// so a union asked for an older file (or after a worker restart) is answered { type: 'union', error: 'stale' }.
// The ?v= changes on every deploy: dotnet.js names the fingerprinted files of its own publish.
import { dotnet } from './engine/dotnet.js?v=20261015';

const COMPRESSED = new Set(['dotnetwasm', 'assembly', 'pdb', 'icu']);
let total = 0, loaded = 0;

function loadResource(type, name, defaultUri) {
  if (!COMPRESSED.has(type)) return defaultUri;                    // the small JS modules load as they are
  return fetch(defaultUri + '.gz').then(r => {
    if (!r.ok) throw new Error(`engine file missing: ${name}`);
    loaded += Number(r.headers.get('content-length') || 0);
    if (total) self.postMessage({ type: 'boot-progress', pct: Math.min(99, Math.round((100 * loaded) / total)) });
    const body = r.body.pipeThrough(new DecompressionStream('gzip'));
    return new Response(body, { headers: { 'content-type': type === 'dotnetwasm' ? 'application/wasm' : 'application/octet-stream' } });
  });
}

let api = null;
let lastKey = null;                                                // the message id of the file the engine holds
function boot() {
  if (!api) api = (async () => {
    try { total = (await (await fetch('./engine/manifest.json')).json()).bytes || 0; } catch (e) { total = 0; }
    const { getAssemblyExports, getConfig } = await dotnet.withResourceLoader(loadResource).create();
    const exports = await getAssemblyExports(getConfig().mainAssemblyName);
    self.postMessage({ type: 'ready' });
    return exports.Api;
  })();
  return api;
}

self.onmessage = async e => {
  const m = e.data;
  try {
    const engine = await boot();
    if (m.type !== 'process') return;
    const union = m.settings && m.settings.union;
    if (union) {
      const answer = union.fileKey === lastKey
        ? JSON.parse(engine.Union(JSON.stringify(union.ids || [])))
        : { type: 'union', area: 0, parts: 0, paths: [], verts: [], bad: [], error: 'stale' };
      answer.id = m.id;
      self.postMessage(answer);
      return;
    }
    lastKey = null;
    self.postMessage({ type: 'progress', id: m.id, stage: 'measuring' });
    const result = JSON.parse(engine.Quantities(new Uint8Array(m.bytes), m.name, JSON.stringify(m.settings || {})));
    result.id = m.id;
    if (result.type === 'result') lastKey = m.id;
    self.postMessage(result);
  } catch (err) {
    self.postMessage({ type: 'error', id: m.id, reason: 'engine', message: String((err && err.message) || err) });
  }
};
```

<!-- file: js/dwg/ui.js -->
```js
// DWG quantities: the page controller (spec §5). Files go to the engine worker one at a time; the page keeps
// each file's result, shows one file (or the Summary) at a time, and does selection totals and the .xlsx in
// JavaScript, so neither ever calls the engine.
import { t, ga, fmtNum, lang } from '../gcode/shell/i18n.js';
import { lsGet, lsSet, loadStored, saveStored } from '../gcode/shell/settings-store.js';
import { renderBanner } from '../gcode/shell/banner.js';
// The tool's own modules carry the deploy version, so a cached old module never meets a new controller.
import { createEngine } from '../laser/bridge.js?v=20260928';
import { layerRows, layerTotals, blockRows, blockTotals, summary } from './tables.js?v=20260928';
import { selectBox, selectionTotals, selectionTsv } from './selection.js?v=20260928';
import { writeXlsx, workbookFor, xlsxName } from './xlsx.js?v=20260928';
import { createView } from './view.js?v=20260928';
import { UNITS, INFO_WARNINGS, rowItems, clickSelection, boxSelection, fileStatus, engineSettings, admit, loadedEvent } from './state.js?v=20260928';

const $ = id => document.getElementById(id);
const SETTINGS_KEY = 'aidedcam-dq-settings';
const SURVEY_KEY = 'aidedcam-dq-survey';
const EXAMPLE = 'example-plan.dwg';
const TIMEOUT_MS = 60000;                 // big building drawings take longer than laser parts

const state = {
  files: [],                  // { id, name, bytes, result, status: waiting|processing|done, override, selCounted }
  active: null,               // a file id, or 'summary'
  sel: [],                    // selected item indices of the active file
  hl: null,                   // the highlighted table row: { layer } or { block, layer }
  pickRow: null,              // the row of the last clicked item
  banner: null,
  engineReady: false,
  settings: loadStored(SETTINGS_KEY, { units: 'auto' }),
};
let nextId = 0, shown = null;

const num2 = v => fmtNum(v, 2);
const int = v => fmtNum(v, 0);
const unitName = u => (u === 'inch' ? 'in' : u);
function showBanner(b) { state.banner = b; renderBanner($('dqBanner'), b, t); }
const okResult = f => f && f.result && f.result.type === 'result';
const activeFile = () => state.files.find(f => f.id === state.active) || null;
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

// ---- the engine ----
const supported = typeof WebAssembly === 'object' && typeof Worker === 'function' && typeof DecompressionStream === 'function';
const engine = supported ? createEngine({
  makeWorker: () => new Worker(new URL('./worker.js?v=20261015', import.meta.url), { type: 'module' }),
  onBootProgress: pct => showBanner({ key: 'dq.engine.loading', params: { pct } }),
  onReady: () => { state.engineReady = true; if (state.banner && state.banner.key === 'dq.engine.loading') showBanner(null); },
  timeoutMs: TIMEOUT_MS,
}) : null;
if (!supported) showBanner({ key: 'dq.engine.nowasm' });

async function run(f) {
  if (!engine) { f.result = { type: 'error', reason: 'engine', message: 'no WebAssembly' }; f.status = 'done'; render(); return; }
  const gen = f.gen = (f.gen || 0) + 1;      // a stale re-measure (superseded by a later one) must not land
  f.status = 'processing';
  render();
  const m = await engine.process(f.name, f.bytes.slice(0), engineSettings(state.settings, f));
  if (!state.files.includes(f)) return;                          // removed meanwhile
  if (f.gen !== gen) return;                                      // a newer run() for this file finished first
  f.result = m;
  f.status = 'done';
  if (m.type === 'error' && m.reason === 'engine' && !state.engineReady) {
    showBanner({ key: 'dq.engine.failed', action: { key: 'dq.engine.retry', run: () => location.reload() } });
  }
  if (f.id === state.active) { state.sel = []; state.hl = null; state.pickRow = null; }
  render();
  if (f.batch) finishBatch(f);
}

function addFiles(list, source) {
  const { take, dropped } = admit(state.files.length, list);
  if (dropped > 0) showBanner({ key: 'dq.toomany', params: { max: 20 } });
  const added = take.map(x => ({
    id: ++nextId, name: x.name, bytes: x.bytes, override: null, selCounted: false,
    result: x.result || null, status: x.result ? 'done' : 'waiting',
  }));
  if (!added.length) return;
  state.files.push(...added);
  if (state.active === null) state.active = added[0].id;
  // Each file keeps its own batch: a later addFiles() call must not lose an earlier one still in flight.
  const b = { files: added, left: added.length, source, counted: new Set() };
  for (const f of added) f.batch = b;
  render();
  for (const f of added) { if (f.status === 'done') finishBatch(f); else run(f); }
}

function finishBatch(f) {
  const b = f.batch;
  if (!b || b.counted.has(f)) return;
  b.counted.add(f);
  if (--b.left > 0) return;
  if (b.source === 'example') ga('dwgq_example_loaded', {});
  else ga('dwgq_files_loaded', loadedEvent(b.files));
}

// ---- tabs ----
function statusMark(f) {
  const st = fileStatus(f);
  if (!st) return el('span', 'dq-mark is-busy', t(f.status === 'processing' ? 'dq.processing' : 'dq.waiting'));
  const s = el('span', `dq-mark is-${st}`, st === 'ok' ? '✔' : st === 'warn' ? '⚠' : '✖');
  s.title = t(`dq.status.${st}`);
  s.setAttribute('aria-label', t(`dq.status.${st}`));
  return s;
}

function tab(label, key, mark) {
  const b = el('button', 'dq-tab');
  b.type = 'button';
  b.setAttribute('role', 'tab');
  b.setAttribute('aria-selected', String(state.active === key));
  if (mark) b.appendChild(mark);
  b.appendChild(el('span', 'dq-tab-name', label));
  b.title = label;
  b.addEventListener('click', () => activate(key));
  return b;
}

function renderTabs() {
  const box = $('dqTabs');
  box.hidden = !state.files.length;
  const list = [];
  if (state.files.length > 1) list.push(tab(t('dq.tab.summary'), 'summary', null));
  for (const f of state.files) list.push(tab(f.name, f.id, statusMark(f)));
  box.replaceChildren(...list);
}

function activate(key) {
  if (state.active === key) return;
  state.active = key;
  state.sel = []; state.hl = null; state.pickRow = null;
  render();
}

// ---- tables ----
const cell = (text, cls) => el('td', cls, text);
const rowKey = r => (r ? (r.block != null ? `b\u0000${r.block}\u0000${r.layer}` : `l\u0000${r.layer}`) : '');

function layerRow(r, clickable) {
  const tr = document.createElement('tr');
  const sw = document.createElement('td');
  const chip = el('span', 'lc-chip'); chip.style.background = r.color || 'transparent';
  sw.appendChild(chip); tr.appendChild(sw);
  tr.appendChild(cell(r.name, 'dq-name'));
  tr.appendChild(cell(num2(r.len), 'dq-num'));
  tr.appendChild(cell(int(r.lenCount), 'dq-num'));
  tr.appendChild(cell(num2(r.area), 'dq-num'));
  tr.appendChild(cell(int(r.areaCount), 'dq-num'));
  tr.appendChild(cell(num2(r.hatchArea), 'dq-num'));
  tr.appendChild(cell(int(r.hatchCount), 'dq-num'));
  const st = document.createElement('td');
  if (r.off) st.appendChild(el('span', 'dq-badge', t('dq.badge.off')));
  if (r.frozen) st.appendChild(el('span', 'dq-badge', t('dq.badge.frozen')));
  if (r.bad) st.appendChild(el('span', 'dq-badge is-bad', '⚠ ' + t('dq.badge.bad', { n: r.bad })));
  tr.appendChild(st);
  if (clickable) makeRowClickable(tr, { layer: r.name });
  return tr;
}

function blockRow(r, clickable) {
  const tr = document.createElement('tr');
  tr.appendChild(cell(r.name, 'dq-name'));
  tr.appendChild(cell(r.layer, 'dq-name'));
  tr.appendChild(cell(int(r.count), 'dq-num'));
  tr.appendChild(cell(int(r.nested), 'dq-num'));
  if (clickable && r.count > 0) makeRowClickable(tr, { block: r.name, layer: r.layer });
  return tr;
}

function makeRowClickable(tr, key) {
  tr.dataset.key = rowKey(key);
  tr.tabIndex = 0;
  const go = () => toggleHighlight(key);
  tr.addEventListener('click', go);
  tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
}

function renderTables(layers, blocks, clickable, prefix) {
  $('dqLayers').tBodies[0].replaceChildren(...layers.map(r => layerRow(r, clickable)));
  const lt = layerTotals(layers);
  const c = $('dqLayerTotals').children;
  c[2].textContent = prefix + num2(lt.len); c[3].textContent = prefix + int(lt.lenCount);
  c[4].textContent = prefix + num2(lt.area); c[5].textContent = prefix + int(lt.areaCount);
  c[6].textContent = prefix + num2(lt.hatchArea); c[7].textContent = prefix + int(lt.hatchCount);
  for (const i of [2, 3, 4, 5, 6, 7]) c[i].className = 'dq-num';
  $('dqBlocks').tBodies[0].replaceChildren(...blocks.map(r => blockRow(r, clickable)));
  const bt = blockTotals(blocks);
  const b = $('dqBlockTotals').children;
  b[2].textContent = prefix + int(bt.count); b[3].textContent = prefix + int(bt.nested);
  b[2].className = b[3].className = 'dq-num';
  $('dqBlocks').hidden = !blocks.length;
  $('dqNoBlocks').hidden = blocks.length > 0;
  markRows();
}

function renderSchedules(r) {
  const box = $('dqSchedules');
  if (!r.schedules.length) { box.replaceChildren(el('p', 'gv-note', t('dq.schedules.none'))); return; }
  box.replaceChildren(...r.schedules.map(s => {
    const wrap = el('div');
    wrap.appendChild(el('h3', null, s.block));
    const tw = el('div', 'gv-table-wrap');
    const table = el('table', 'gv-table');
    const head = document.createElement('tr');
    for (const tag of s.tags) head.appendChild(el('th', null, tag));
    head.appendChild(el('th', 'dq-num', t('dq.col.count')));
    const thead = document.createElement('thead'); thead.appendChild(head);
    const body = document.createElement('tbody');
    for (const row of s.rows) {
      const tr = document.createElement('tr');
      for (const v of row.values) tr.appendChild(cell(v));
      tr.appendChild(cell(int(row.count), 'dq-num'));
      body.appendChild(tr);
    }
    table.append(thead, body); tw.appendChild(table); wrap.appendChild(tw);
    return wrap;
  }));
}

function renderNotMeasured(r) {
  const ul = $('dqNotMeasured');
  const list = [];
  for (const [k, v] of Object.entries(r.notMeasured || {})) {
    if (!v) continue;
    const li = el('li', `gv-w ${k === 'insideBlocks' ? 'is-ok' : 'is-warn'}`, `${t(`dq.nm.${k}`)}: ${int(v)}`);
    list.push(li);
  }
  if (r.xrefs && r.xrefs.length) list.push(el('li', 'gv-w is-warn', `${t('dq.nm.xrefs')}: ${r.xrefs.join(', ')}`));
  if (!list.length) list.push(el('li', 'gv-w is-ok', t('dq.nm.none')));
  ul.replaceChildren(...list);
}

// ---- units: the line on every file, and the select the units warnings reuse ----
// The unit the engine actually applied, so the line never names one the numbers were not measured in.
const usedUnits = f => f.result.file.used;

function unitsSelect(f) {
  const s = document.createElement('select');
  s.setAttribute('aria-label', t('dq.units.change'));
  const opt = (v, label) => { const o = el('option', null, label); o.value = v; s.appendChild(o); };
  opt('', t(f.result.file.units === 'none' ? 'dq.units.fromSettings' : 'dq.units.fromFile'));
  for (const u of UNITS) opt(u, t(`dq.unit.${u}`));
  s.value = f.override || '';
  s.addEventListener('change', () => {
    f.override = s.value || null;
    ga('dwgq_units_override', { units: s.value || 'file' });
    run(f);
  });
  return s;
}

function renderStatus(f) {
  const box = $('dqStatus');
  box.replaceChildren();
  if (!okResult(f)) return;
  const src = f.result.file.unitsSource;
  box.appendChild(el('span', null, t('dq.units.line', { units: unitName(usedUnits(f)), source: t(`dq.units.src.${src}`) })));
  const lab = el('label', null, t('dq.units.change') + ' ');
  lab.appendChild(unitsSelect(f));
  box.appendChild(lab);
}

const fmtParam = v => (typeof v === 'number' ? fmtNum(v, Number.isInteger(v) ? 0 : 2) : unitName(String(v ?? '')));

function renderWarnings(f) {
  const ul = $('dqWarnings');
  const list = okResult(f) ? f.result.warnings : [];
  ul.replaceChildren(...list.map(w => {
    const params = Object.fromEntries(Object.entries(w.params || {}).map(([k, v]) => [k, fmtParam(v)]));
    const li = el('li', `gv-w ${INFO_WARNINGS.has(w.id) ? 'is-ok' : 'is-warn'}`, t(`dq.warn.${w.id}`, params));
    if (w.id === 'units-assumed' || w.id === 'units-setting') li.appendChild(unitsSelect(f));
    return li;
  }));
}

// ---- selection ----
function renderSelection() {
  const f = activeFile();
  const items = okResult(f) ? f.result.items : [];
  const tot = selectionTotals(items, state.sel);
  const has = state.sel.length > 0;
  $('dqSelHint').hidden = has;
  $('dqSelCount').hidden = !has;
  $('dqSelCount').textContent = t('dq.sel.items', { n: int(tot.items) });
  $('dqSelLayers').hidden = !tot.layers.length;
  $('dqSelLayers').tBodies[0].replaceChildren(...tot.layers.map(l => {
    const tr = document.createElement('tr');
    tr.append(cell(l.name, 'dq-name'), cell(num2(l.len), 'dq-num'), cell(num2(l.area), 'dq-num'), cell(num2(l.hatchArea), 'dq-num'));
    return tr;
  }));
  const sum = tot.layers.reduce((a, l) => ({ len: a.len + l.len, area: a.area + l.area, hatch: a.hatch + l.hatchArea }), { len: 0, area: 0, hatch: 0 });
  const fc = $('dqSelLayers').tFoot.rows[0].cells;
  fc[1].textContent = num2(sum.len); fc[2].textContent = num2(sum.area); fc[3].textContent = num2(sum.hatch);
  for (const i of [1, 2, 3]) fc[i].className = 'dq-num';
  $('dqSelBlocks').hidden = !tot.blocks.length;
  $('dqSelBlocks').tBodies[0].replaceChildren(...tot.blocks.map(b => {
    const tr = document.createElement('tr');
    tr.append(cell(b.name, 'dq-name'), cell(int(b.count), 'dq-num'));
    return tr;
  }));
  $('dqCopy').disabled = !has;
  $('dqSelClear').disabled = !has;
}

function setSelection(indices) {
  state.sel = indices;
  const f = activeFile();
  view.setSelection(indices);
  renderSelection();
  if (f && indices.length && !f.selCounted) { f.selCounted = true; ga('dwgq_selection', { items: indices.length }); }
}

function toggleHighlight(key) {
  const f = activeFile();
  if (!okResult(f)) return;
  state.hl = rowKey(state.hl) === rowKey(key) ? null : key;
  view.setHighlight(state.hl ? rowItems(f.result.items, state.hl) : null);
  markRows();
}

function itemRow(it) { return it.kind === 'insert' ? { block: it.block, layer: it.layer } : { layer: it.layer }; }

function markRows(hoverKey) {
  const hl = rowKey(state.hl), hv = hoverKey || rowKey(state.pickRow);
  for (const tr of document.querySelectorAll('#dqLayers tbody tr, #dqBlocks tbody tr')) {
    tr.classList.toggle('is-hi', !!hl && tr.dataset.key === hl);
    tr.classList.toggle('is-hover', !!hv && tr.dataset.key === hv);
  }
}

// ---- the drawing ----
const view = createView($('dqCanvas'), {
  onHover(i, x, y) {
    const f = activeFile(), tip = $('dqTip');
    if (!okResult(f) || i < 0) { tip.hidden = true; markRows(); return; }
    const it = f.result.items[i];
    const lines = [[t('dq.tip.layer'), it.layer], [t('dq.tip.kind'), t(`dq.kind.${it.kind}`)]];
    if (it.len > 0) lines.push([t('dq.tip.len'), `${num2(it.len)} m`]);
    if (it.area > 0) lines.push([t('dq.tip.area'), `${num2(it.area)} m²`]);
    if (it.block) lines.push([t('dq.tip.block'), it.block]);
    if ((it.copies || 1) > 1) lines.push([t('dq.tip.copies'), int(it.copies)]);
    if (it.bad) lines.push([null, t('dq.tip.bad')]);
    tip.replaceChildren(...lines.map(([k, v]) => {
      const d = el('div');
      if (k != null) d.appendChild(el('b', null, k + ': '));
      d.appendChild(document.createTextNode(v));
      return d;
    }));
    const box = $('dqCanvas').getBoundingClientRect();
    tip.hidden = false;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = x - box.left + 14, top = y - box.top + 14;
    if (left + tw > box.width) left = Math.max(0, x - box.left - tw - 10);
    if (top + th > box.height) top = Math.max(0, y - box.top - th - 10);
    tip.style.left = `${left}px`; tip.style.top = `${top}px`;
    markRows(rowKey(itemRow(it)));
  },
  onPick(i, shift) {
    const f = activeFile();
    if (!okResult(f)) return;
    state.pickRow = i >= 0 ? itemRow(f.result.items[i]) : (shift ? state.pickRow : null);
    setSelection(clickSelection(state.sel, i, shift));
    markRows();
  },
  onBox(x0, y0, x1, y1, mode, shift) {
    const f = activeFile();
    if (!okResult(f)) return;
    setSelection(boxSelection(state.sel, selectBox(view.index, f.result.items, x0, y0, x1, y1, mode), shift));
  },
});

// ---- the panel: one file, or the Summary ----
function render() {
  renderTabs();
  const any = state.files.length > 0;
  $('dqDropHint').hidden = any;
  $('dqPanel').hidden = !any;
  // No export while a file is waiting or re-measuring: the workbook would silently leave it out.
  $('dqXlsx').disabled = !state.files.some(okResult) || state.files.some(f => f.status !== 'done');
  if (!any) { shown = null; view.clear(); return; }
  if (state.active === null) state.active = state.files[0].id;

  const pending = state.files.some(f => f.status !== 'done');
  if (state.active === 'summary') {
    $('dqPanel').classList.add('dq-summary');
    $('dqStatus').replaceChildren(); $('dqWarnings').replaceChildren();
    $('dqError').hidden = true; $('dqWork').hidden = true; $('dqFileOnly').hidden = true;
    $('dqLayers').closest('.dq-tables').hidden = false;
    const s = summary(state.files.filter(f => f.status === 'done'));
    renderTables(s.layers, s.blocks, false, s.partial || pending ? '≥ ' : '');
    $('dqPartial').hidden = !s.partial;
    $('dqPartial').textContent = s.partial ? t('dq.partial', { files: s.missing.join(', ') }) : '';
    shown = null;
    return;
  }

  $('dqPanel').classList.remove('dq-summary');
  const f = activeFile();
  $('dqPartial').hidden = true;
  renderStatus(f);
  renderWarnings(f);
  const failed = f && f.result && f.result.type !== 'result';
  $('dqError').hidden = !failed;
  if (failed) $('dqError').textContent = `${f.name}: ${t(`dq.err.${f.result.reason}`)}`;
  const ok = okResult(f);
  $('dqWork').hidden = !ok;
  $('dqFileOnly').hidden = !ok;
  $('dqLayers').closest('.dq-tables').hidden = !ok;
  if (!ok) { shown = null; return; }
  $('dqFileName').textContent = f.name;
  $('dqSimplified').hidden = !f.result.simplified;
  renderTables(layerRows(f.result), blockRows(f.result), true, '');
  renderSchedules(f.result);
  renderNotMeasured(f.result);
  if (shown !== f.result) {
    shown = f.result;
    view.show(f.result);
    if (state.hl) view.setHighlight(rowItems(f.result.items, state.hl));
    if (state.sel.length) view.setSelection(state.sel);
  }
  renderSelection();
}

// ---- settings ----
function wireSettings() {
  const units = $('dqUnits');
  units.replaceChildren(...['auto', ...UNITS].map(v => { const o = el('option', null, t(`dq.unit.${v}`)); o.value = v; return o; }));
  units.value = state.settings.units;
}
$('dqUnits').addEventListener('change', e => {
  const v = e.target.value;
  if (!['auto', ...UNITS].includes(v)) { e.target.value = state.settings.units; return; }
  state.settings.units = v;
  saveStored(SETTINGS_KEY, state.settings, ['units']);
  // Only files that state no units depend on this setting; a file still waiting or measuring is run again with
  // it (its per-file gen makes the superseded run harmless).
  for (const f of state.files) {
    if (f.override) continue;
    if (f.status !== 'done' || (okResult(f) && f.result.file.unitsSource !== 'file')) run(f);
  }
});

// ---- downloads and the clipboard ----
function save(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('dqXlsx').addEventListener('click', () => {
  if (state.files.some(f => f.status !== 'done')) return;
  const files = state.files.filter(f => f.status === 'done').map(f => ({ name: f.name, result: f.result }));
  if (!files.some(f => f.result.type === 'result')) return;
  save(new Blob([writeXlsx(workbookFor(files, t))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), xlsxName(files));
  ga('dwgq_xlsx_download', { files: files.length });
});
$('dqCopy').addEventListener('click', async () => {
  const f = activeFile();
  if (!okResult(f) || !state.sel.length) return;
  const text = selectionTsv(selectionTotals(f.result.items, state.sel), t, lang() === 'en' ? '.' : ',');
  try { await navigator.clipboard.writeText(text); } catch (e) { return; }
  ga('dwgq_copy', {});
  const b = $('dqCopy');
  b.textContent = t('dq.sel.copied');
  setTimeout(() => { b.textContent = t('dq.sel.copy'); }, 1500);
});
$('dqSelClear').addEventListener('click', () => { state.pickRow = null; setSelection([]); markRows(); });
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (state.sel.length) { state.pickRow = null; setSelection([]); markRows(); }
});

// ---- inputs ----
async function readFiles(fileList) {
  const list = [];
  for (const file of fileList) list.push({ name: file.name, bytes: await file.arrayBuffer() });
  addFiles(list, 'file');
}
$('dqInput').addEventListener('change', async e => { const fl = [...e.target.files]; e.target.value = ''; await readFiles(fl); });
document.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('gv-dragging'); });
document.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('gv-dragging'); });
document.addEventListener('drop', async e => {
  e.preventDefault(); document.body.classList.remove('gv-dragging');
  const fl = [...(e.dataTransfer && e.dataTransfer.files || [])].filter(f => /\.(dxf|dwg)$/i.test(f.name));
  if (fl.length) await readFiles(fl);
});
$('dqExample').addEventListener('click', async () => {
  try {
    const r = await fetch(new URL(`./examples/${EXAMPLE}`, import.meta.url));
    if (!r.ok) throw new Error(String(r.status));
    addFiles([{ name: EXAMPLE, bytes: await r.arrayBuffer() }], 'example');
  } catch (e) { showBanner({ key: 'dq.example.failed' }); }
});
$('dqClear').addEventListener('click', () => {
  state.files = []; state.active = null; state.sel = []; state.hl = null; state.pickRow = null;
  render();
});
$('dqFit').addEventListener('click', () => view.fit());
$('dqZoomIn').addEventListener('click', () => view.zoomBy(1.25));
$('dqZoomOut').addEventListener('click', () => view.zoomBy(1 / 1.25));

// ---- CTAs and survey ----
$('dqCta').addEventListener('click', () => ga('dwgq_cta_click', { where: 'page' }));
$('dqCtaGroups').addEventListener('click', () => ga('dwgq_cta_click', { where: 'selection' }));
if (lsGet(SURVEY_KEY)) $('dqSurvey').hidden = true;
$('dqSurvey').addEventListener('click', e => {
  const b = e.target.closest('[data-answer]');
  if (!b) return;
  ga('dwgq_survey', { answer: b.dataset.answer });
  lsSet(SURVEY_KEY, b.dataset.answer);
  $('dqSurvey').querySelectorAll('[data-answer]').forEach(x => { x.disabled = true; });
  $('dqThanks').hidden = false;
});

// A language change re-renders everything built here (the drawing keeps its view).
document.addEventListener('gv:lang', () => {
  if (state.banner) showBanner(state.banner);
  wireSettings();
  render();
});

wireSettings();
render();
```

Run:
```bash
for f in _src/dwg-engine/Host/Program.cs js/dwg/worker.js js/dwg/ui.js; do node _tests/extract.mjs $PLAN $f; done
git diff --stat
```
Expected: `Program.cs | 5 +`, `js/dwg/ui.js | 2 +-`, `js/dwg/worker.js | 17 +++-`.

- [ ] **Step 2: Republish the engine**

Run: `powershell.exe -ExecutionPolicy Bypass -File _src/dwg-engine/publish.ps1 2>&1 | tail -1`
Expected: `108 files, 11.4 MB in js/dwg/engine` (trim warnings from Eyeshot's dependencies are normal).

Run: `git status --short js/dwg/engine`
Expected: exactly six lines. The old `AidedCam.Dwg.Engine.*.wasm.gz` and `AidedCam.Dwg.Host.*.wasm.gz` are deleted, new ones with other fingerprints are untracked, and `dotnet.js` and `manifest.json` are modified. The other 102 files are byte-identical. (The fingerprints are the build's own; they need not match any other build.)

Check that no local path leaked into the published files:
```bash
for f in js/dwg/engine/*.gz; do zcat "$f" | grep -a -q -i 'Users\\\\\|/Users/\|scratchpad' && echo "LEAK $f"; done; echo scan-done
```
Expected: only `scan-done`.

- [ ] **Step 3: Write the union parity page and the runner**

<!-- file: _tests/coverage/union.html -->
```html
<!doctype html>
<!-- Dev-only (Jekyll skips _tests): runs fixtures/union.dxf through the published browser engine and asks for
     the union of each layer's outlines, then compares with the hand-worked values (the same cases as the
     engine's CoverageTests). window.__union holds the outcome, window.__timings the milliseconds. -->
<meta charset="utf-8"><link rel="icon" href="data:,"><title>coverage union parity</title><pre id="out">running…</pre>
<script type="module">
const EXPECTED = {
  OVERLAP: { area: 175, verts: 8, parts: 1 },
  TOUCH: { area: 200, verts: 4, parts: 1 },
  FRAME: { area: 800, verts: 8, parts: 1, contours: 2 },
  ARC: { area: 100 + Math.PI * 12.5 + 25, verts: 6, parts: 1, arcs: 1 },
  SURVEY: { area: 200, verts: 6, parts: 1, first: [410000, 4495000] },
  MANY: { area: 71 * 36, verts: 4, parts: 1 },
};
const w = new Worker('../../js/dwg/worker.js', { type: 'module' });
const pending = new Map();
w.onmessage = e => { const m = e.data; if (pending.has(m.id) && m.type !== 'progress') { pending.get(m.id)(m); pending.delete(m.id); } };
let id = 0;
const send = (msg, transfer = []) => new Promise(res => { const i = ++id; pending.set(i, res); w.postMessage({ ...msg, type: 'process', id: i }, transfer); });
const t0 = performance.now();
const bytes = await (await fetch('./fixtures/union.dxf')).arrayBuffer();
const r = await send({ name: 'union.dxf', bytes, settings: {} }, [bytes]);
const timings = { file: Math.round(performance.now() - t0) };
const diffs = [];
if (r.type !== 'result') diffs.push(`engine error ${r.reason} ${r.message}`);
else {
  for (const [layer, e] of Object.entries(EXPECTED)) {
    const ids = r.items.filter(i => i.layer === layer).map(i => i.id);
    const t1 = performance.now();
    const u = await send({ name: 'union', bytes: new ArrayBuffer(0), settings: { union: { fileKey: r.id, ids } } });
    timings[layer] = Math.round(performance.now() - t1);
    const nverts = u.verts.reduce((a, v) => a + v.length / 3, 0);
    if (u.error) diffs.push(`${layer}: error ${u.error}`);
    if (Math.abs(u.area - e.area) > 1e-6) diffs.push(`${layer}: area ${u.area} ≠ ${e.area}`);
    if (nverts !== e.verts) diffs.push(`${layer}: ${nverts} vertices ≠ ${e.verts}`);
    if (u.parts !== e.parts) diffs.push(`${layer}: ${u.parts} parts ≠ ${e.parts}`);
    if (e.contours && u.verts.length !== e.contours) diffs.push(`${layer}: ${u.verts.length} contours ≠ ${e.contours}`);
    if (e.arcs && u.verts.flat().filter((v, i) => i % 3 === 2 && v !== 0).length !== e.arcs) diffs.push(`${layer}: arcs`);
    if (e.first && (u.verts[0][0] !== e.first[0] || u.verts[0][1] !== e.first[1])) diffs.push(`${layer}: first vertex ${u.verts[0].slice(0, 2)}`);
  }
  // A union asked for an older file is refused as stale, never answered from the wrong drawing.
  const stale = await send({ name: 'union', bytes: new ArrayBuffer(0), settings: { union: { fileKey: r.id - 1, ids: [] } } });
  if (stale.error !== 'stale') diffs.push(`stale: ${stale.error}`);
}
window.__timings = timings;
window.__union = { cases: Object.keys(EXPECTED).length, failed: diffs.length, diffs };
document.getElementById('out').textContent = JSON.stringify({ ...window.__union, timings }, null, 1);
</script>
```

<!-- file: _tests/coverage/browser-check.cjs -->
```js
// Runs the coverage pre-check's browser checks in headless Chrome, for when the Playwright MCP is unavailable.
// Needs the repo root served on http://127.0.0.1:8765/, and playwright-core somewhere on this machine:
//   node _tests/coverage/browser-check.cjs          the page checks in browser-check.js
//   node _tests/coverage/browser-check.cjs union    only the engine's union parity page (union.html)
// Set PW_CORE to a playwright-core folder, or it is looked for in the npx cache. Chrome is used from its
// default install path (or CHROME).
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');

function findCore() {
  if (process.env.PW_CORE) return process.env.PW_CORE;
  const npx = path.join(os.homedir(), 'AppData', 'Local', 'npm-cache', '_npx');
  for (const d of fs.existsSync(npx) ? fs.readdirSync(npx) : []) {
    const p = path.join(npx, d, 'node_modules', 'playwright-core');
    if (fs.existsSync(p)) return p;
  }
  throw new Error('playwright-core not found: set PW_CORE, or run `npx playwright --version` once');
}

(async () => {
  const { chromium } = require(findCore());
  const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:8765' });
  const page = await context.newPage();
  const mode = process.argv[2] || 'page';
  const fns = {
    page: p => eval(fs.readFileSync(path.join(__dirname, 'browser-check.js'), 'utf8'))(p),
    async union(p) {
      await p.goto('http://127.0.0.1:8765/_tests/coverage/union.html');
      await p.waitForFunction(() => window.__union, null, { timeout: 120000 });
      const r = await p.evaluate(() => ({ union: window.__union, ms: window.__timings }));
      const ok = r.union.cases === 6 && r.union.failed === 0;
      return { pass: ok ? 1 : 0, fail: ok ? 0 : 1, checks: [{ name: `union ${JSON.stringify(r)}`, ok, got: r }] };
    },
  };
  if (!fns[mode]) throw new Error(`unknown mode ${mode}`);
  const r = await fns[mode](page);
  for (const c of r.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : '  ' + JSON.stringify(c.got)}`);
  console.log(`${r.pass} passed, ${r.fail} failed`);
  await browser.close();
  process.exit(r.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
```

Run: `node _tests/extract.mjs $PLAN _tests/coverage/union.html && node _tests/extract.mjs $PLAN _tests/coverage/browser-check.cjs`

- [ ] **Step 4: Check it in the browser**

Serve the repo root in a second terminal, and keep it running for Tasks 6–13: `python -m http.server 8765 --bind 127.0.0.1`

Run:
```bash
node _tests/coverage/browser-check.cjs union
node _tests/dwg/browser-check.cjs parity
node _tests/dwg/browser-check.cjs
node _tests/dwg/browser-check.cjs perf
```
Expected:
1. `PASS  union {"union":{"cases":6,"failed":0,"diffs":[]},"ms":{…}}` and `1 passed, 0 failed`. The cases are overlap 175, touch 200, a frame with a hole 800, an arc 164.27, survey coordinates 200, and 50 outlines 2556, plus the stale-file refusal. `MANY` should take about 110–190 ms and the first case about 0.3–0.5 s (Eyeshot's static set-up); the page check in Task 13 requires `MANY` under 1 s.
2. DWG quantities on the republished engine: parity `{"files":6,"failed":0,…}`, then its page check `25 passed, 0 failed`.
3. Perf as before: 10,000 entities in about 1.7 s, and 50,000 in 13–25 s.

- [ ] **Step 5: Commit**

```bash
git add _src/dwg-engine/Host/Program.cs js/dwg/worker.js js/dwg/ui.js js/dwg/engine _tests/coverage/union.html _tests/coverage/browser-check.cjs
git status --short js/dwg/engine
git commit -F - <<'EOF'
Coverage pre-check: union export, worker union routing, republished engine, union parity page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```
The `git status` before the commit must show the six engine changes staged (`D`, `A`, `M`), with nothing left unstaged.

---

### Task 7: Typed terms and the controller's small decisions

**Files:**
- Create: `js/coverage/state.js`
- Test: `_tests/coverage/state.test.js`

**Interfaces:**
- Consumes: `DEFAULT_TERMS` (Task 3), `LEVELS` (Task 1).
- Produces (pure):
  - `parseTerm(text) → number | null | undefined`: null means not typed, undefined means refused.
  - `termsFromStorage(json) → terms`.
  - `sizeBucket(bytes) → 'under-1mb' | '1-5mb' | 'over-5mb'`.
  - `formatOf(file) → 'dwg' | 'dxf'`.
  - `unionKey(fileId, ids) → string`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/coverage/state.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTerm, termsFromStorage, sizeBucket, formatOf, unionKey } from '../../js/coverage/state.js';
import { DEFAULT_TERMS } from '../../js/coverage/rules.js';

test('a typed term: a comma or a point, spaces ignored; empty is "not typed"; the rest is refused', () => {
  assert.equal(parseTerm('0,8'), 0.8);
  assert.equal(parseTerm('0.8'), 0.8);
  assert.equal(parseTerm(' 11 '), 11);
  assert.equal(parseTerm(',5'), 0.5);
  assert.equal(parseTerm('3,'), 3);
  assert.equal(parseTerm(''), null);
  assert.equal(parseTerm(null), null);
  for (const bad of ['1.380,5', '1,380.5', '-1', 'abc', '1e3', '0,8,1']) assert.equal(parseTerm(bad), undefined, bad);
});

test('stored terms: cleaned, with the defaults for anything missing or malformed', () => {
  assert.deepEqual(termsFromStorage(null), { ...DEFAULT_TERMS, storey: {} });
  assert.deepEqual(termsFromStorage('not json'), { ...DEFAULT_TERMS, storey: {} });
  const t = termsFromStorage(JSON.stringify({ sd: 0.8, sk: '60', hmax: -1, roofAllow: null, storey: { '00': 3.2, XX: 3, '01': 0 }, entrance: 'ATTIC', parking: 'yes' }));
  assert.equal(t.sd, 0.8);
  assert.equal(t.sk, null, 'a string is not a number');
  assert.equal(t.hmax, null, 'negative');
  assert.equal(t.roofAllow, null, 'cleared by the visitor');
  assert.deepEqual(t.storey, { '00': 3.2 });
  assert.equal(t.entrance, '00');
  assert.equal(t.parking, false);
});

test('GA parameters carry buckets and formats only; the union key follows the file and the outline set', () => {
  assert.equal(sizeBucket(1000), 'under-1mb');
  assert.equal(sizeBucket(2 << 20), '1-5mb');
  assert.equal(sizeBucket(10 << 20), 'over-5mb');
  assert.equal(formatOf({ name: 'a.DWG' }), 'dwg');
  assert.equal(formatOf({ name: 'x', result: { file: { format: 'dxf' } } }), 'dxf');
  assert.equal(unionKey(3, ['B', 'A']), unionKey(3, ['A', 'B']));
  assert.notEqual(unionKey(3, ['A']), unionKey(4, ['A']));
});
```

Run: `node _tests/extract.mjs $PLAN _tests/coverage/state.test.js && node --test "_tests/coverage/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 42`, `ℹ fail 1`.

- [ ] **Step 2: Write the module**

<!-- file: js/coverage/state.js -->
```js
// Coverage pre-check: the controller's pure decisions, kept out of ui.js so the Node tests can pin them.
import { DEFAULT_TERMS } from './rules.js?v=20261015';
import { LEVELS } from './mapping.js?v=20261015';

// A typed number: a comma or a point as the decimal separator (Greek and Italian keyboards type a comma), spaces
// ignored. '' is "not typed" (null); anything else that is not a plain non-negative number is refused
// (undefined), including "1.380,5": a grouped number is ambiguous between the languages.
export function parseTerm(text) {
  const s = String(text ?? '').replace(/\s+/g, '');
  if (s === '') return null;
  if (s.includes(',') && s.includes('.')) return undefined;
  if (!/^\d*[.,]?\d+$|^\d+[.,]$/.test(s)) return undefined;
  const v = Number(s.replace(',', '.'));
  return Number.isFinite(v) ? v : undefined;
}

// The terms stored in this browser, cleaned: numbers or null, a storey height per known level, a known entrance.
export function termsFromStorage(json) {
  let raw = {};
  try { raw = JSON.parse(json || '{}') || {}; } catch (e) { raw = {}; }
  const out = { ...DEFAULT_TERMS, storey: {} };
  for (const k of ['sd', 'sk', 'hmax', 'roofAllow', 'h', 'roof', 'basementAbove', 'roofVolume']) {
    const v = raw[k];
    if (v === null) out[k] = null;
    else if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v;
  }
  if (raw.storey && typeof raw.storey === 'object') {
    for (const [lv, v] of Object.entries(raw.storey)) if (LEVELS.includes(lv) && typeof v === 'number' && Number.isFinite(v) && v > 0) out.storey[lv] = v;
  }
  if (LEVELS.includes(raw.entrance) && raw.entrance !== 'ATTIC') out.entrance = raw.entrance;
  out.parking = raw.parking === true;
  return out;
}

// GA parameters: no names, no figures (spec §9).
export const sizeBucket = bytes => (bytes < 1 << 20 ? 'under-1mb' : bytes < 5 << 20 ? '1-5mb' : 'over-5mb');
export const formatOf = f => (f && f.result && f.result.file ? f.result.file.format : /\.dwg$/i.test((f && f.name) || '') ? 'dwg' : 'dxf');

// The union a mapping needs: one per measured file (the engine's message id) and set of coverage outlines.
export const unionKey = (fileId, ids) => `${fileId}:${[...ids].sort().join(',')}`;
```

Run: `node _tests/extract.mjs $PLAN js/coverage/state.js && node --test "_tests/coverage/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 45`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/coverage/state.js _tests/coverage/state.test.js
git commit -F - <<'EOF'
Coverage pre-check: typed terms, stored terms, GA buckets, union key

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 8: Tables, the clipboard and the workbook

**Files:**
- Create: `js/coverage/tables.js`
- Test: `_tests/coverage/tables.test.js`, `_tests/coverage/xlsx.test.js`

**Interfaces:**
- Consumes: `ARTICLES`, `RULES_AS_OF`, `DEFAULT_STOREY` (Task 3); `LEVELS`, `TEMPLATE` (Task 1); `writeXlsx` from `js/dwg/xlsx.js` (existing; used by the test and the controller); the strings (Task 4, loaded with `vm` by the tests).
- Produces (pure; `t` is the page's translate function, `n(v, d)` its number formatter):
  - `M2`, `M3`, `M`; `plain(dec) → (v, d) → string` (fixed decimals, the language's separator, never grouped).
  - `levelName(t, lv)`.
  - `summaryRows(ev, t, n)`, `scheduleRows(ev, t, n)`, `coordTables(ev, t, n) → { plot, building }`, `mappingRows(layers, map, t)`.
  - `summaryTsv(rows, t)`, `scheduleTsv(rows, t)`, `coordsTsv(rows, t)`.
  - `workbookFor({ ev, layers, map, file, t, n, nc }) → sheets` (Summary, Schedule, Coordinates, Mapping, for `writeXlsx`).
  - `markText(mark, t)`, `articleText(key, t)`, `formatParams(params, n)`.
  - `xlsxName(fileName) → 'coverage-<name>.xlsx'`.
  - Re-exports `RULES_AS_OF`, `LEVELS`, `TEMPLATE`.

- [ ] **Step 1: Write the failing tests**

<!-- file: _tests/coverage/tables.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { buildModel, evaluate } from '../../js/coverage/rules.js';
import { autoMap } from '../../js/coverage/mapping.js';
import { summaryRows, scheduleRows, coordTables, summaryTsv, scheduleTsv, coordsTsv, plain, xlsxName, markText, articleText } from '../../js/coverage/tables.js';
import { item, result, unionOf } from './helpers.mjs';
import { OUTLINES, OPEN, TERMS, inSurvey } from './example-geometry.mjs';

// The tool's strings, as the page's t() would read them.
const window = {};
vm.runInNewContext(readFileSync(new URL('../../js/coverage/i18n-coverage.js', import.meta.url), 'utf8'), { window });
const tr = l => (key, p = {}) => String(window.CP_I18N[l][key] ?? key).replace(/\{(\w+)\}/g, (_, k) => p[k] ?? '');

function example() {
  const r = result([...OUTLINES.map(o => item(o.layer, inSurvey(o.verts))), ...OPEN.map(o => item(o.layer, inSurvey(o.verts), { closed: false }))]);
  const model = buildModel(r, autoMap(r.layers.map(l => l.name)).map);
  return evaluate(model, TERMS, unionOf(150, [model.cover[0].verts]));
}

test('the clipboard number: fixed decimals, the language separator, never grouped', () => {
  assert.equal(plain('.')(1380, 2), '1380.00');
  assert.equal(plain(',')(1380, 2), '1380,00');
  assert.equal(plain(',')(4495025.5, 2), '4495025,50');
  assert.equal(plain('.')(null, 2), '');
});

test('the summary as TSV, in English and in Greek', () => {
  const ev = example();
  const en = summaryTsv(summaryRows(ev, tr('en'), plain('.')), tr('en'));
  const lines = en.split('\r\n');
  assert.deepEqual(lines[0].split('\t'), ['Figure', 'Article', 'Permitted', 'Proposed', 'Check', 'Note']);
  assert.ok(lines.includes('Coverage (κάλυψη)\tCode 207 (ΝΟΚ 12)\t300.00 m² (60%)\t150.00 m² (30.00%)\t✓\t'), en);
  assert.ok(en.includes('\t2000.00 m³ (σ.ο. 4.00)\t1380.00 m³ (σ.ο. 2.76)\t✓\t'));
  const el = summaryTsv(summaryRows(ev, tr('el'), plain(',')), tr('el'));
  assert.ok(el.includes('Δόμηση συνολικά\tΚώδ. 206 (ΝΟΚ 11)\t400,00 m² (ΣΔ 0,80)\t310,00 m² (ΣΔ 0,62)\t✓\t'), el);
  assert.ok(el.includes('\t80,00 m²\t90,00 m²\t✗\tπλεόνασμα 10,00 m² μετρά στη δόμηση'));
  assert.ok(!/\d\.\d{3},/.test(el), 'no grouped thousands');
});

test('the schedule: each level, its spaces with the cap lines, its δόμηση; then the totals', () => {
  const ev = example();
  const rows = scheduleRows(ev, tr('en'), plain('.'));
  const ground = rows.slice(rows.findIndex(r => r.label === 'Ground floor'), rows.findIndex(r => r.label === 'δόμηση: Ground floor') + 1);
  assert.deepEqual(ground.map(r => [r.kind, r.areaText, r.excludedText, r.countsText]), [
    ['head', '', '', ''], ['gross', '150.00', '', ''], ['space', '20.00', '20.00', ''], ['space', '20.00', '20.00', ''], ['cap', '', '', ''], ['domisi', '', '', '110.00'],
  ]);
  assert.equal(ground[4].label, 'cap 40 m²');
  const tail = rows.slice(-3).map(r => [r.label, r.countsText]);
  assert.deepEqual(tail, [['Semi-open + balconies (cap 0.40 × permitted δόμηση = 160.00 m²)', ''], ['Semi-open and balcony overflow', '10.00'], ['δόμηση (built floor area), total', '310.00']]);
  const tsv = scheduleTsv(rows, tr('el'));
  assert.ok(tsv.startsWith('Επιφάνεια\tΕμβαδόν (m²)\tΕκτός ΣΔ (m²)\tΕντός ΣΔ (m²)\tΣημείωση\r\n'));
});

test('the coordinate tables, numbered, with parts and arcs, as TSV', () => {
  const ev = example();
  const co = coordTables(ev, tr('en'), plain(','));
  assert.deepEqual(co.plot.map(r => [r.n, r.xText, r.yText]), [[1, '410000,00', '4495000,00'], [2, '410020,00', '4495000,00'], [3, '410020,00', '4495025,00'], [4, '410000,00', '4495025,00']]);
  const tsv = coordsTsv(co.plot, tr('el'));
  assert.equal(tsv.split('\r\n')[1], '1\t410000,00\t4495000,00\t');
  const two = { ...ev, coords: { ...ev.coords, building: [{ part: 0, rows: [{ n: 1, x: 0, y: 0, arc: true }] }, { part: 1, rows: [{ n: 2, x: 5, y: 0, arc: false }] }] } };
  const b = coordTables(two, tr('en'), plain('.')).building;
  assert.deepEqual(b.map(r => (r.head ? r.label : `${r.n} ${r.note}`)), ['Part 1', '1 (arc to the next)', 'Part 2', '2 ']);
});

test('marks, article chips and the download name', () => {
  assert.equal(markText(true), '✓'); assert.equal(markText(false), '✗'); assert.equal(markText(null), '');
  assert.equal(articleText('planting', tr('el')), 'Κώδ. 212 §2α (ΝΟΚ 17 §2α)');
  assert.equal(xlsxName('κάτοψη Α/1.dwg'), 'coverage-κάτοψη Α_1.xlsx');
  assert.equal(xlsxName('example-permit.dxf'), 'coverage-example-permit.xlsx');
});

test('without ΣΔ and Σ.Κ. the rows say what to type, with no mark', () => {
  const r = result(OUTLINES.map(o => item(o.layer, inSurvey(o.verts))));
  const model = buildModel(r, autoMap(r.layers.map(l => l.name)).map);
  const rows = summaryRows(evaluate(model, {}, unionOf(150)), tr('en'), plain('.'));
  const get = k => rows.find(x => x.key === k);
  assert.equal(get('coverage').permitted.text, 'type Σ.Κ.');
  assert.equal(get('total').permitted.text, 'type ΣΔ');
  assert.equal(get('semi').permitted.text, 'type ΣΔ');
  assert.equal(get('semi').note, 'without ΣΔ the caps can’t be checked and nothing is added'.replace('’', "'"));
  for (const k of ['coverage', 'total', 'semi', 'volume', 'planting', 'height']) assert.equal(get(k).mark, null, k);
});
```

<!-- file: _tests/coverage/xlsx.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { writeXlsx } from '../../js/dwg/xlsx.js';
import { buildModel, evaluate } from '../../js/coverage/rules.js';
import { autoMap, layerList } from '../../js/coverage/mapping.js';
import { workbookFor } from '../../js/coverage/tables.js';
import { item, result, unionOf } from './helpers.mjs';
import { OUTLINES, OPEN, TERMS, inSurvey } from './example-geometry.mjs';

const window = {};
vm.runInNewContext(readFileSync(new URL('../../js/coverage/i18n-coverage.js', import.meta.url), 'utf8'), { window });
const tr = l => (key, p = {}) => String(window.CP_I18N[l][key] ?? key).replace(/\{(\w+)\}/g, (_, k) => p[k] ?? '');
const fmt = l => (v, d) => new Intl.NumberFormat(l === 'en' ? 'en-US' : l === 'el' ? 'el-GR' : 'it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

// The stored ZIP read back through its local headers.
function unzip(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), dec = new TextDecoder();
  const out = {};
  for (let p = 0; v.getUint32(p, true) === 0x04034b50;) {
    const size = v.getUint32(p + 18, true), nl = v.getUint16(p + 26, true), ex = v.getUint16(p + 28, true);
    out[dec.decode(bytes.subarray(p + 30, p + 30 + nl))] = dec.decode(bytes.subarray(p + 30 + nl + ex, p + 30 + nl + ex + size));
    p += 30 + nl + ex + size;
  }
  return out;
}

function workbook(l) {
  const r = result([...OUTLINES.map(o => item(o.layer, inSurvey(o.verts))), ...OPEN.map(o => item(o.layer, inSurvey(o.verts), { closed: false }))]);
  const map = autoMap(r.layers.map(x => x.name)).map;
  const model = buildModel(r, map);
  const ev = evaluate(model, TERMS, unionOf(150, [model.cover[0].verts]));
  return unzip(writeXlsx(workbookFor({ ev, layers: layerList(r).used, map, file: { units: 'm' }, t: tr(l), n: fmt(l) })));
}
const sheetNames = x => [...x['xl/workbook.xml'].matchAll(/<sheet name="([^"]*)"/g)].map(m => m[1]);

test('four sheets, named in the page language within Excel’s 31 characters', () => {
  assert.deepEqual(sheetNames(workbook('el')), ['Σύνοψη', 'Αναλυτικός πίνακας', 'Συντεταγμένες', 'Αντιστοίχιση']);
  assert.deepEqual(sheetNames(workbook('en')), ['Summary', 'Schedule', 'Coordinates', 'Mapping']);
  assert.deepEqual(sheetNames(workbook('it')), ['Riepilogo', 'Prospetto', 'Coordinate', 'Assegnazione']);
  for (const l of ['el', 'en', 'it']) for (const n of sheetNames(workbook(l))) assert.ok(n.length <= 31 && !/[[\]:*?/\\]/.test(n) && !/^'|'$/.test(n), n);
});

test('the summary sheet: both blocks with numbers as numbers, the inputs, the rules date and the disclaimer, in Greek', () => {
  const s = workbook('el')['xl/worksheets/sheet1.xml'];
  assert.ok(s.includes('Ενδεικτικός προέλεγχος — όχι επίσημος υπολογισμός.'), 'disclaimer');
  assert.ok(s.includes('>Ελέγχονται από την Υ.ΔΟΜ<') && s.includes('>Στην υπεύθυνη δήλωσή σας<'), 'the two blocks');
  assert.ok(s.includes('>Μέγεθος<') && s.includes('>Επιτρεπόμενο<') && s.includes('>Πραγματοποιούμενο<'), 'headings');
  for (const v of ['500', '300', '150', '310', '400', '1380', '2000']) assert.ok(s.includes(`<v>${v}</v>`), `number ${v}`);
  assert.ok(s.includes('>Κώδ. 207 (ΝΟΚ 12)<'), 'article');
  assert.ok(s.includes('Κανόνες: Ν.5306/2026 (08.06.2026)'), 'rules date');
  assert.ok(s.includes('>Ύψος ορόφου: Ισόγειο (m)<') && s.includes('<v>3.2</v>'), 'storey height input');
  assert.ok(s.includes('Μονάδες σχεδίου: m'), 'units');
});

test('the schedule, coordinate and mapping sheets', () => {
  const x = workbook('en');
  const sch = x['xl/worksheets/sheet2.xml'];
  assert.ok(sch.includes('>Ground floor<') && sch.includes('<v>110</v>') && sch.includes('>cap 40 m²<'));
  assert.ok(sch.includes('Mezzanines count in δόμηση since Ν.5197/2025'));
  const co = x['xl/worksheets/sheet3.xml'];
  assert.ok(co.includes('<v>410000</v>') && co.includes('<v>4495025</v>') && co.includes('>Building vertices (coverage outline)<'));
  const mp = x['xl/worksheets/sheet4.xml'];
  assert.ok(mp.includes('>AC_LVL_00<') && mp.includes('>Level outline<') && mp.includes('>Ground floor<'));
  assert.ok(mp.includes('Open outline on layer AC_GREEN: not measured.'), 'warnings');
  assert.ok(mp.includes('Volume uses floor-to-floor storey heights'), 'the storey-height assumption');
});
```

Run:
```bash
node _tests/extract.mjs $PLAN _tests/coverage/tables.test.js && node _tests/extract.mjs $PLAN _tests/coverage/xlsx.test.js
node --test "_tests/coverage/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
```
Expected: `ℹ pass 45`, `ℹ fail 2`.

- [ ] **Step 2: Write the module**

<!-- file: js/coverage/tables.js -->
```js
// Coverage pre-check: the summary, the analytical schedule, the coordinate tables and the mapping as data
// (spec §6, §7). One source for the screen, the clipboard and the .xlsx: each cell has its number (v) and its
// text, and the text is built with the number formatter it is given (the page's locale on screen, a plain
// decimal separator for the clipboard).
import { ARTICLES, RULES_AS_OF, DEFAULT_STOREY } from './rules.js?v=20261015';
import { LEVELS, TEMPLATE } from './mapping.js?v=20261015';

export const M2 = 'm²', M3 = 'm³', M = 'm';

// A number to the clipboard: fixed decimals, the language's separator, no grouping (a grouped "1.380,00"
// reads as 1.38 in some spreadsheets, and "2.000" as two thousand in others).
export const plain = dec => (v, d) => (v == null || !Number.isFinite(v) ? '' : v.toFixed(d).replace('.', dec));

const cell = (v, unit, text) => ({ v, unit, text });
const empty = () => cell(null, '', '—');

export function levelName(t, lv) { return t(`cp.level.${lv}`); }

// The summary: the Υ.ΔΟΜ block, then the sworn-statement block (spec §5.3 "The two blocks").
export function summaryRows(ev, t, n) {
  const rows = [];
  const R = (block, key, label, art, permitted, proposed, mark, extra = {}) => rows.push({ block, key, label, art, permitted, proposed, mark, ids: [], note: '', ...extra });
  const m2 = v => `${n(v, 2)} ${M2}`;
  const E = ev.plot.area;
  const levelIds = ev.levels.flatMap(l => l.ids);

  // Checked by the building office.
  R('ydom', 'plot', t('cp.fig.plot'), 'plot', empty(), cell(E, M2, m2(E)), null, { ids: [ev.plot.id] });
  const c = ev.coverage;
  R('ydom', 'coverage', t('cp.fig.coverage'), 'coverage',
    c.permitted != null ? cell(c.permitted, M2, `${m2(c.permitted)} (${n(ev.terms.sk, Number.isInteger(ev.terms.sk) ? 0 : 2)}%)`) : cell(null, '', t('cp.need.sk')),
    cell(c.area, M2, `${m2(c.area)} (${n(100 * c.ratio, 2)}%)` + (c.state === 'failed' ? ` ⚠ ${t('cp.warn.union-failed')}` : '')),
    c.mark, { ids: c.ids, note: c.state === 'failed' ? t('cp.warn.union-failed') : '' });
  R('ydom', 'uncovered', t('cp.fig.uncovered'), 'uncovered', empty(), cell(ev.uncovered, M2, m2(ev.uncovered)), null, { ids: [ev.plot.id] });
  const vol = ev.volume;
  R('ydom', 'volume', t('cp.fig.volume'), 'volume',
    vol.permitted != null ? cell(vol.permitted, M3, `${n(vol.permitted, 2)} ${M3} (${t('cp.sub.so', { v: n(vol.so, 2) })})`) : cell(null, '', t('cp.need.sd')),
    cell(vol.V, M3, `${n(vol.V, 2)} ${M3} (${t('cp.sub.so', { v: n(vol.achievedSo, 2) })})`), vol.mark,
    { ids: levelIds, note: t('cp.assume.storey') });
  const h = ev.height;
  const hText = (a, b) => (a == null || b == null ? t('cp.need.height') : `${n(a, 2)} + ${n(b, 2)} ${M}`);
  R('ydom', 'height', t('cp.fig.height'), 'height', cell(h.hmax, M, hText(h.hmax, h.roofAllow)), cell(h.h, M, hText(h.h, h.roof)), h.mark,
    { note: h.hint != null ? t('cp.term.hmax.hint', { h: n(h.hint, 2) }) : '' });
  const p = ev.planting;
  R('ydom', 'planting', t('cp.fig.planting'), 'planting',
    p.required != null ? cell(p.required, M2, `${m2(p.required)} (⅔ × ${n(p.mandatory, 2)})`) : cell(null, '', t('cp.need.sk')),
    cell(p.actual, M2, m2(p.actual)), p.mark, { ids: p.ids, note: ev.terms.parking ? t('cp.note.parking') : '' });
  R('ydom', 'setbacks', t('cp.fig.setbacks'), null, cell(null, '', t('cp.notv1')), cell(null, '', t('cp.notv1')), null);
  R('ydom', 'parking', t('cp.fig.parking'), null, cell(null, '', t('cp.notv1')), cell(null, '', t('cp.notv1')), null);

  // On the engineer's sworn statement.
  for (const l of ev.levels) {
    R('sworn', `level-${l.level}`, t('cp.fig.level', { level: levelName(t, l.level) }), l.level.startsWith('B') ? 'basement' : l.level === 'ATTIC' ? 'attic' : 'level',
      empty(), cell(l.domisi, M2, m2(l.domisi)), null, { ids: l.ids });
  }
  if (ev.pilotis.valid != null) {
    R('sworn', 'pilotis', t('cp.fig.pilotis'), 'pilotis', cell(0.5 * c.area, M2, `≥ ${m2(0.5 * c.area)}`), cell(ev.pilotis.total, M2, m2(ev.pilotis.total)), ev.pilotis.valid,
      { note: ev.pilotis.valid ? '' : t('cp.note.pilotis-small') });
  }
  const k = ev.caps;
  if (k.checked) {
    R('sworn', 'semi', t('cp.fig.semi', { cap: n(k.semiCap, 2) }), 'caps', cell(k.semiCap, M2, m2(k.semiCap)), cell(k.semi, M2, m2(k.semi)), k.semiMark,
      { ids: k.semiIds, note: k.overflow > 0 && !k.semiMark ? t('cp.sub.overflow', { v: n(k.overflow, 2) }) : '' });
    R('sworn', 'semiBalc', t('cp.fig.semiBalc', { cap: n(k.totalCap, 2) }), 'caps', cell(k.totalCap, M2, m2(k.totalCap)), cell(k.semi + k.balc, M2, m2(k.semi + k.balc)), k.totalMark,
      { ids: [...k.semiIds, ...k.balcIds], note: k.overflow > 0 && !k.totalMark ? t('cp.sub.overflow', { v: n(k.overflow, 2) }) : '' });
  } else {
    R('sworn', 'semi', t('cp.fig.semiNoSd'), 'caps', cell(null, '', t('cp.need.sd')), cell(k.semi, M2, m2(k.semi)), null, { ids: k.semiIds, note: t('cp.note.capsUnchecked') });
    R('sworn', 'semiBalc', t('cp.fig.semiBalcNoSd'), 'caps', cell(null, '', t('cp.need.sd')), cell(k.semi + k.balc, M2, m2(k.semi + k.balc)), null, { ids: [...k.semiIds, ...k.balcIds], note: t('cp.note.capsUnchecked') });
  }
  const d = ev.domisi;
  R('sworn', 'total', t('cp.fig.total'), 'total',
    d.permitted != null ? cell(d.permitted, M2, `${m2(d.permitted)} (${t('cp.sub.sd', { v: n(ev.terms.sd, 2) })})`) : cell(null, '', t('cp.need.sd')),
    cell(d.total, M2, `${m2(d.total)} (${t('cp.sub.sd', { v: n(d.sd, 2) })})`), d.mark, { ids: levelIds });
  return rows;
}

export const markText = (mark, t) => (mark === true ? '✓' : mark === false ? '✗' : '');
export const articleText = (key, t) => (key ? t('cp.art.chip', { code: ARTICLES[key].code, old: ARTICLES[key].old }) : '');

// The analytical schedule, per level (spec §6): the level outlines, every space with its cap line where a
// cap applies, the level's δόμηση; then the totals and the caps block.
export function scheduleRows(ev, t, n) {
  const rows = [];
  const m2 = v => (v == null ? '' : n(v, 2));
  const R = (kind, label, area, excluded, counts, extra = {}) => rows.push({ kind, label, area, excluded, counts, areaText: m2(area), excludedText: m2(excluded), countsText: m2(counts), ids: [], note: '', ...extra });
  for (const l of ev.levels) {
    R('head', levelName(t, l.level), null, null, null, { ids: l.ids });
    R('gross', t('cp.sch.gross'), l.gross, null, null, { ids: l.ids });
    // Each space: what comes off the level (excluded), or what it adds (a mezzanine); the level's δόμηση is
    // gross − Σ excluded + Σ added.
    for (const x of l.lines) {
      const note = x.note ? t(`cp.note.${x.note}`, { below: x.params && x.params.below ? levelName(t, x.params.below) : '—', half: x.params ? n((x.params.belowGross || 0) / 2, 2) : '' }) : '';
      R('space', t(`cp.role.${x.role}`), x.area, x.added || x.role === 'balcony' ? null : x.excluded, x.added ? x.added : null, { ids: x.id ? [x.id] : [], note, role: x.role });
      if (x.cap != null) R('cap', t('cp.sch.cap', { cap: n(x.cap, 0) }), null, null, null, { ids: x.id ? [x.id] : [], note: x.counts > 0 ? t('cp.sch.capExcess', { v: n(x.counts, 2) }) : t('cp.sch.capWithin') });
    }
    R('domisi', t('cp.sch.levelDomisi', { level: levelName(t, l.level) }), null, null, l.domisi, { ids: l.ids });
  }
  const k = ev.caps;
  R('head', t('cp.sch.totals'), null, null, null);
  R('sum', t('cp.sch.sumLevels'), null, null, ev.levels.reduce((a, l) => a + l.domisi, 0));
  if (k.checked) {
    R('capblock', t('cp.fig.semi', { cap: n(k.semiCap, 2) }), k.semi, null, null, { ids: k.semiIds });
    R('capblock', t('cp.fig.semiBalc', { cap: n(k.totalCap, 2) }), k.semi + k.balc, null, null, { ids: [...k.semiIds, ...k.balcIds] });
    R('overflow', t('cp.sch.overflow'), null, null, k.overflow, { ids: [...k.semiIds, ...k.balcIds] });
  } else {
    R('overflow', t('cp.sch.overflow'), null, null, null, { note: t('cp.note.capsUnchecked') });
  }
  R('total', t('cp.fig.total'), null, null, ev.domisi.total, { ids: ev.levels.flatMap(l => l.ids) });
  return rows;
}

// Coordinate rows for the plot and the building (the coverage union's outline). n formats a coordinate: the page
// passes one without thousands grouping, as coordinate tables are written ("410000,00").
export function coordTables(ev, t, n) {
  const row = r => ({ n: r.n, x: r.x, y: r.y, xText: n(r.x, 2), yText: n(r.y, 2), note: r.arc ? t('cp.coords.arc') : '' });
  const building = [];
  for (const part of ev.coords.building) {
    if (ev.coords.building.length > 1) building.push({ head: true, label: t('cp.coords.part', { n: part.part + 1 }) });
    building.push(...part.rows.map(row));
  }
  return { plot: ev.coords.plot.map(row), building };
}

// The layer → role mapping used, for the export.
export function mappingRows(layers, map, t) {
  return layers.map(l => {
    const r = map[l.name] || { role: 'ignore' };
    return { layer: l.name, role: t(`cp.role.${r.role}`), level: r.role === 'level' ? levelName(t, r.level) : '', outlines: l.outlines, area: l.area };
  });
}

// ---- the clipboard ----
const tsvLine = cells => cells.map(c => String(c ?? '').replace(/[\t\r\n]+/g, ' ')).join('\t');

export function summaryTsv(rows, t) {
  const out = [tsvLine([t('cp.col.figure'), t('cp.col.article'), t('cp.col.permitted'), t('cp.col.proposed'), t('cp.col.mark'), t('cp.col.note')])];
  for (const r of rows) out.push(tsvLine([r.label, articleText(r.art, t), r.permitted.text, r.proposed.text, markText(r.mark, t), r.note]));
  return out.join('\r\n') + '\r\n';
}

export function scheduleTsv(rows, t) {
  const out = [tsvLine([t('cp.sch.col.item'), t('cp.sch.col.area'), t('cp.sch.col.excluded'), t('cp.sch.col.counts'), t('cp.col.note')])];
  for (const r of rows) out.push(tsvLine([r.label, r.areaText, r.excludedText, r.countsText, r.note]));
  return out.join('\r\n') + '\r\n';
}

export function coordsTsv(rows, t) {
  const out = [tsvLine([t('cp.coords.col.n'), t('cp.coords.col.x'), t('cp.coords.col.y'), t('cp.col.note')])];
  for (const r of rows) out.push(r.head ? tsvLine([r.label]) : tsvLine([r.n, r.xText, r.yText, r.note]));
  return out.join('\r\n') + '\r\n';
}

// ---- the workbook (spec §7): Summary, Schedule, Coordinates, Mapping ----
export function workbookFor({ ev, layers, map, file, t, n, nc = n }) {
  const num2 = v => ({ v: v == null ? null : Math.round(v * 1e6) / 1e6, fmt: 'm2' });
  const sum = summaryRows(ev, t, n);
  const summaryRowsX = [];
  for (const block of ['ydom', 'sworn']) {
    summaryRowsX.push({ cells: [t(`cp.block.${block}`)], bold: true });
    for (const r of sum.filter(x => x.block === block)) {
      summaryRowsX.push([r.label, articleText(r.art, t), num2(r.permitted.v), r.permitted.v != null ? r.permitted.unit : '', r.permitted.text, num2(r.proposed.v), r.proposed.v != null ? r.proposed.unit : '', r.proposed.text, markText(r.mark, t), r.note]);
    }
    summaryRowsX.push([]);
  }
  const terms = ev.terms;
  const T = (label, v, unit = '') => [label, '', v == null ? '' : { v, fmt: 'm2' }, unit];
  summaryRowsX.push({ cells: [t('cp.xlsx.inputs')], bold: true });
  summaryRowsX.push(T(t('cp.term.sd'), terms.sd), T(t('cp.term.sk'), terms.sk, '%'), T(t('cp.term.hmax'), terms.hmax, M), T(t('cp.term.roofAllow'), terms.roofAllow, M),
    T(t('cp.term.h'), terms.h, M), T(t('cp.term.roof'), terms.roof, M));
  for (const l of ev.levels) if (!l.level.startsWith('B')) summaryRowsX.push(T(t('cp.term.storey', { level: levelName(t, l.level) }), terms.storey[l.level] ?? DEFAULT_STOREY, M));
  summaryRowsX.push(T(t('cp.term.basementAbove'), terms.basementAbove, M), T(t('cp.term.roofVolume'), terms.roofVolume, M3),
    [t('cp.term.entrance'), '', levelName(t, terms.entrance)], [t('cp.term.parking'), '', terms.parking ? t('cp.yes') : t('cp.no')], []);
  summaryRowsX.push([t('cp.rules.asof')], [t('cp.assume.storey')], [t('cp.xlsx.units', { units: file.units })], [t('cp.disclaimer')]);

  const sched = scheduleRows(ev, t, n).map(r => (r.kind === 'head' || r.kind === 'total' || r.kind === 'domisi'
    ? { cells: [r.label, num2(r.area), num2(r.excluded), num2(r.counts), r.note], bold: true }
    : [r.label, num2(r.area), num2(r.excluded), num2(r.counts), r.note]));
  sched.push([], [t('cp.sch.mezzNote')], [t('cp.disclaimer')]);

  const co = coordTables(ev, t, nc);
  const coordRows = [{ cells: [t('cp.coords.plot')], bold: true }];
  const xy = r => (r.head ? { cells: [r.label], bold: true } : [r.n, { v: r.x, fmt: 'm2' }, { v: r.y, fmt: 'm2' }, r.note]);
  coordRows.push(...co.plot.map(xy));
  if (!ev.coords.plotHasVerts) coordRows.push([t('cp.coords.noVerts')]);
  coordRows.push([], { cells: [t('cp.coords.building')], bold: true }, ...co.building.map(xy));
  if (ev.coverage.state !== 'ok') coordRows.push([t('cp.coords.approx')]);
  if (!ev.coords.egsa) coordRows.push([t('cp.warn.not-egsa')]);
  coordRows.push([], [t('cp.disclaimer')]);

  const mapRows = mappingRows(layers, map, t).map(r => [r.layer, r.role, r.level, { v: r.outlines, fmt: 'int' }, num2(r.area)]);
  mapRows.push([], [t('cp.xlsx.units', { units: file.units })], [t('cp.assume.storey')]);
  if (ev.warnings.length) {
    mapRows.push([], { cells: [t('cp.xlsx.warnings')], bold: true });
    for (const w of ev.warnings) mapRows.push([t(`cp.warn.${w.id}`, formatParams(w.params, n))]);
  }
  mapRows.push([], [t('cp.disclaimer')]);

  return [
    {
      name: t('cp.sheet.summary'), note: t('cp.disclaimer'),
      columns: [
        { header: t('cp.col.figure'), width: 40, fmt: 'text' }, { header: t('cp.col.article'), width: 22, fmt: 'text' },
        { header: t('cp.col.permitted'), width: 14, fmt: 'm2' }, { header: t('cp.col.unit'), width: 6, fmt: 'text' }, { header: t('cp.col.permittedText'), width: 28, fmt: 'text' },
        { header: t('cp.col.proposed'), width: 14, fmt: 'm2' }, { header: t('cp.col.unit'), width: 6, fmt: 'text' }, { header: t('cp.col.proposedText'), width: 28, fmt: 'text' },
        { header: t('cp.col.mark'), width: 6, fmt: 'text' }, { header: t('cp.col.note'), width: 40, fmt: 'text' },
      ],
      rows: summaryRowsX,
    },
    {
      name: t('cp.sheet.schedule'),
      columns: [{ header: t('cp.sch.col.item'), width: 40, fmt: 'text' }, { header: t('cp.sch.col.area'), width: 14, fmt: 'm2' }, { header: t('cp.sch.col.excluded'), width: 14, fmt: 'm2' }, { header: t('cp.sch.col.counts'), width: 16, fmt: 'm2' }, { header: t('cp.col.note'), width: 44, fmt: 'text' }],
      rows: sched,
    },
    {
      name: t('cp.sheet.coords'),
      columns: [{ header: t('cp.coords.col.n'), width: 8, fmt: 'int' }, { header: t('cp.coords.col.x'), width: 16, fmt: 'm2' }, { header: t('cp.coords.col.y'), width: 16, fmt: 'm2' }, { header: t('cp.col.note'), width: 24, fmt: 'text' }],
      rows: coordRows,
    },
    {
      name: t('cp.sheet.mapping'),
      columns: [{ header: t('cp.col.layer'), width: 28, fmt: 'text' }, { header: t('cp.col.role'), width: 34, fmt: 'text' }, { header: t('cp.col.level'), width: 16, fmt: 'text' }, { header: t('cp.col.outlines'), width: 10, fmt: 'int' }, { header: t('cp.col.area'), width: 14, fmt: 'm2' }],
      rows: mapRows,
    },
  ];
}

// Warning parameters as text: numbers with two decimals.
export function formatParams(params, n) {
  return Object.fromEntries(Object.entries(params || {}).map(([k, v]) => [k, typeof v === 'number' ? n(v, 2) : String(v ?? '')]));
}

export function xlsxName(fileName) {
  const d = String(fileName).lastIndexOf('.');
  const stem = (d > 0 ? String(fileName).slice(0, d) : String(fileName)).replace(/[^\p{L}\p{N}._ -]+/gu, '_').trim() || 'drawing';
  return `coverage-${stem}.xlsx`;
}

export { RULES_AS_OF, LEVELS, TEMPLATE };
```

Run: `node _tests/extract.mjs $PLAN js/coverage/tables.js && node --test "_tests/coverage/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 54`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/coverage/tables.js _tests/coverage/tables.test.js _tests/coverage/xlsx.test.js
git commit -F - <<'EOF'
Coverage pre-check: summary, schedule and coordinate tables, TSV and the workbook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 9: The drawing

The canvas itself is checked in the browser in Task 13 (highlight both ways, picking, print refit). Here the module is imported in Node, which it allows: it touches the DOM only inside `createDrawing`.

**Files:**
- Create: `js/coverage/drawing.js`

**Interfaces:**
- Consumes: `inside` (Task 2).
- Produces:
  - `ROLE_COLORS` (one colour per role except Ignore).
  - `createDrawing(canvas, { onHover(index, clientX, clientY), onPick(index) })`, where `index` is the picked item's index in `result.items` (−1 for none), returning:
    - `show(result, roleOf, { building, labels }, keepView)`, where `roleOf(item)` gives `{ role, closed }` or null, `building` is the union's paths, and `labels` are `[{ x, y, n, plot }]`;
    - `setHighlight(ids)`, `clear()`, `fit()`, `zoomBy(f)`, `restyle()`;
    - for the browser check, `highlighted` (a getter) and `screenOf(x, y)`.

- [ ] **Step 1: The check that fails now**

Run: `node -e "import('./js/coverage/drawing.js').then(m => console.log(Object.keys(m).sort().join(' ')))" 2>&1 | grep -o ERR_MODULE_NOT_FOUND | head -1`
Expected: `ERR_MODULE_NOT_FOUND` (Node names it several times; the first is enough).

- [ ] **Step 2: Write the module**

<!-- file: js/coverage/drawing.js -->
```js
// Coverage pre-check: the drawing (spec §6). A small Canvas 2D view of its own, because the DWG quantities view
// (js/dwg/view.js) has no hook for fills by role or numbered vertices: mapped outlines are filled and stroked
// in their role's colour, everything else is faint context, the building outline (the coverage union) is drawn
// strong with its vertices numbered, and highlighted outlines stand out. Pan with a drag, zoom with the wheel,
// a pinch or the buttons. Coordinates are kept relative to the drawing's lower-left corner, so survey
// coordinates stay precise.
import { inside } from './levels.js?v=20261015';

export const ROLE_COLORS = {
  plot: '#8a2c0d', cover: '#1d4ed8', level: '#17170f', mezz: '#7e22ce', semiopen: '#0e7490', balcony: '#b45309',
  stairCommon: '#be123c', stairUnit: '#c026d3', void: '#57534e', pilotis: '#4d7c0f', bsmtMain: '#92400e', exclOther: '#475569', green: '#15803d',
};
const HI = '#c2410c';
const PICK_PX = 5;

export function createDrawing(canvas, { onHover = () => {}, onPick = () => {} } = {}) {
  const ctx = canvas.getContext('2d');
  let items = [], roles = [], rings = [], X0 = 0, Y0 = 0, bw = 1, bh = 1;
  let building = [], labels = [], hl = new Set();
  let w = 1, h = 1, dpr = 1, k = 1, cx = 0, cy = 0, fitted = false, frame = 0;
  let drag = null, pinch = null, userMoved = false;     // a pan or zoom by the visitor: a resize keeps it
  const touches = new Map();

  const css = n => getComputedStyle(canvas).getPropertyValue(n).trim();
  const toModel = (sx, sy) => ({ x: (sx - w / 2) / k + cx, y: (h / 2 - sy) / k + cy });     // relative metres
  const local = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    if ((!fitted || !userMoved) && items.length) fit(); else draw();
  }

  function fit() {
    fitted = true; userMoved = false;
    k = bw > 0 || bh > 0 ? 0.9 * Math.min(bw > 0 ? w / bw : Infinity, bh > 0 ? h / bh : Infinity) : 10;
    if (!Number.isFinite(k) || k <= 0) k = 10;
    cx = bw / 2; cy = bh / 2;
    draw();
  }

  function pathOf(p) {
    const out = new Path2D();
    for (const pl of p) {
      if (pl.length < 4) continue;
      out.moveTo(pl[0] - X0, pl[1] - Y0);
      for (let i = 2; i + 1 < pl.length; i += 2) out.lineTo(pl[i] - X0, pl[i + 1] - Y0);
    }
    return out;
  }

  function draw() {
    frame = 0;
    const bg = getComputedStyle(canvas).backgroundColor || '#fff';
    const faint = css('--faint') || '#b9b8ae';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!items.length) return;
    ctx.setTransform(dpr * k, 0, 0, -dpr * k, dpr * (w / 2 - cx * k), dpr * (h / 2 + cy * k));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const any = hl.size > 0;
    // Context first, then mapped outlines by role (big areas first so small spaces sit on top).
    const context = new Path2D();
    const mapped = [];
    items.forEach((it, i) => { if (!it.path || !it.path.length) return; if (roles[i]) mapped.push(i); else context.addPath(pathOf(it.path)); });
    ctx.globalAlpha = any ? 0.3 : 0.7;
    ctx.strokeStyle = faint; ctx.lineWidth = 0.8 / k; ctx.stroke(context);
    mapped.sort((a, b) => (items[b].area || 0) - (items[a].area || 0));
    for (const i of mapped) {
      const it = items[i], role = roles[i], color = ROLE_COLORS[role.role] || '#17170f';
      const p = pathOf(it.path), on = hl.has(it.id), dim = any && !on;
      if (role.closed) { ctx.globalAlpha = dim ? 0.04 : on ? 0.3 : 0.12; ctx.fillStyle = on ? HI : color; ctx.fill(p, 'evenodd'); }
      ctx.globalAlpha = dim ? 0.25 : 1;
      ctx.strokeStyle = on ? HI : color;
      ctx.lineWidth = (on ? 2.6 : role.closed ? 1.2 : 1.6) / k;
      ctx.setLineDash(role.closed ? [] : [6 / k, 4 / k]);
      ctx.stroke(p);
      ctx.setLineDash([]);
    }
    // The building outline and its numbered vertices.
    ctx.globalAlpha = 1;
    if (building.length) {
      ctx.strokeStyle = css('--ink') || '#17170f';
      ctx.lineWidth = 2.2 / k;
      ctx.stroke(pathOf(building));
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    for (const l of labels) {
      const sx = (l.x - X0 - cx) * k + w / 2, sy = h / 2 - (l.y - Y0 - cy) * k;
      if (sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20) continue;
      const r = String(l.n).length > 1 ? 9 : 7.5;
      ctx.fillStyle = l.plot ? ROLE_COLORS.plot : css('--ink') || '#17170f';
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(String(l.n), sx, sy + 0.5);
    }
  }
  const request = () => { if (!frame) frame = requestAnimationFrame(draw); };

  function zoomAt(sx, sy, f) {
    const m = toModel(sx, sy);
    k = Math.min(1e7, Math.max(1e-6, k * f));
    userMoved = true;
    cx = m.x - (sx - w / 2) / k; cy = m.y - (h / 2 - sy) / k;
    request();
  }

  // The outline under a point: the smallest mapped closed outline containing it, else a mapped open one near it.
  function pickAt(sx, sy) {
    const m = toModel(sx, sy), p = [m.x + X0, m.y + Y0];
    let best = -1, bestArea = Infinity;
    items.forEach((it, i) => {
      const r = roles[i];
      if (!r || !r.closed || !rings[i]) return;
      if (inside(p, rings[i]) && it.area < bestArea) { best = i; bestArea = it.area; }
    });
    if (best >= 0) return best;
    const tol = PICK_PX / k;
    items.forEach((it, i) => {
      if (best >= 0 || !roles[i] || roles[i].closed) return;
      for (const pl of it.path || []) for (let j = 2; j + 1 < pl.length; j += 2) {
        const ax = pl[j - 2], ay = pl[j - 1], bx = pl[j], by = pl[j + 1];
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
        const t = l2 > 0 ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2)) : 0;
        if (Math.hypot(p[0] - ax - t * dx, p[1] - ay - t * dy) <= tol) { best = i; return; }
      }
    });
    return best;
  }

  function onDown(e) {
    if (!items.length) return;
    canvas.setPointerCapture(e.pointerId);
    const p = local(e);
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, p);
      if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k }; drag = null; return; }
    }
    drag = { x: p.x, y: p.y, cx, cy, moved: false };
  }
  function onMove(e) {
    const p = local(e);
    if (pinch && touches.has(e.pointerId)) {
      touches.set(e.pointerId, p);
      const [a, b] = [...touches.values()];
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (pinch.k * (Math.hypot(a.x - b.x, a.y - b.y) || 1)) / pinch.d / k);
      return;
    }
    if (!drag) { if (e.pointerType !== 'touch') { const i = pickAt(p.x, p.y); onHover(i, e.clientX, e.clientY); } return; }
    if (!drag.moved && Math.hypot(p.x - drag.x, p.y - drag.y) < 4) return;
    drag.moved = true; userMoved = true;
    cx = drag.cx - (p.x - drag.x) / k; cy = drag.cy + (p.y - drag.y) / k;
    request();
  }
  function onUp(e) {
    touches.delete(e.pointerId);
    if (pinch) { if (touches.size < 2) pinch = null; return; }
    const d = drag; drag = null;
    if (d && !d.moved) { const p = local(e); onPick(pickAt(p.x, p.y)); }
  }
  function onWheel(e) {
    if (!items.length) return;
    e.preventDefault();
    const p = local(e);
    zoomAt(p.x, p.y, Math.exp(-(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY) * 0.0015));
  }
  const onLeave = () => onHover(-1, 0, 0);
  const onCancel = e => { touches.delete(e.pointerId); drag = null; pinch = null; };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize', resize);

  return {
    // result: the engine's; roleOf(item) → { role, closed } or null; opts.building: the union's paths;
    // opts.labels: [{ x, y, n, plot }]. keepView keeps the current pan and zoom (a remap, not a new file).
    show(result, roleOf, opts = {}, keepView = false) {
      items = (result && result.items) || [];
      roles = items.map(roleOf);
      rings = items.map((it, i) => (roles[i] && roles[i].closed ? ringFromPath(it.path) : null));
      const b = (result && result.bbox) || { x0: 0, y0: 0, x1: 1, y1: 1 };
      if (!keepView || !fitted) { X0 = b.x0; Y0 = b.y0; bw = Math.max(0, b.x1 - b.x0); bh = Math.max(0, b.y1 - b.y0); fitted = false; }
      building = opts.building || []; labels = opts.labels || [];
      resize();
    },
    setHighlight(ids) { hl = new Set(ids || []); draw(); },
    clear() { items = []; roles = []; rings = []; building = []; labels = []; hl = new Set(); fitted = false; draw(); },
    fit, zoomBy(f) { zoomAt(w / 2, h / 2, f); }, restyle: draw,
    // For the browser check: what is highlighted, and where a drawing point is on screen (CSS px in the canvas).
    get highlighted() { return [...hl]; },
    screenOf(x, y) { return { x: (x - X0 - cx) * k + w / 2, y: h / 2 - (y - Y0 - cy) * k }; },
  };
}

function ringFromPath(path) {
  const p = (path && path[0]) || [];
  const ring = [];
  for (let i = 0; i + 1 < p.length; i += 2) ring.push([p[i], p[i + 1]]);
  return ring;
}
```

Run: `node _tests/extract.mjs $PLAN js/coverage/drawing.js && node -e "import('./js/coverage/drawing.js').then(m => console.log(Object.keys(m).sort().join(' ')))"`
Expected: `ROLE_COLORS createDrawing`.

- [ ] **Step 3: Commit**

```bash
git add js/coverage/drawing.js
git commit -F - <<'EOF'
Coverage pre-check: the drawing (role fills, building outline, numbered vertices, highlight)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 10: The page and its styles

The head, the consent banner, GA and the language switcher are copied from `dwg-quantities.html`; `site.test.js` (Task 12) diffs them. Every `data-i18n` element carries its Greek text inline, because the page starts in Greek and the shell doesn't re-render `el`.

`css/tools.css` is given whole: the coverage section (65 lines) is appended at its end, and no existing rule changes.

**Files:**
- Create: `coverage-precheck.html`
- Modify: `css/tools.css` (a coverage section appended)

**Interfaces:**
- Consumes: the strings (Task 4), the shell (`js/gcode/shell/`), the controller (Task 11, loaded as `js/coverage/ui.js?v=20261015`).
- Produces: the element ids the controller uses:
  - work area: `cpInput`, `cpExample`, `cpTemplate`, `cpClear`, `cpTemplateNames`, `cpNames`, `cpBanner`, `cpDropHint`, `cpBusy`, `cpError`, `cpPanel`, `cpStatus`;
  - steps 1 and 2: `cpStep1`, `cpAuto`, `cpMap`, `cpOther`, `cpOtherSummary`, `cpOtherList`, `cpStep2`, `cpTerms`, `cpSd`, `cpSk`, `cpHmax`, `cpHmaxHint`, `cpRoofAllow`, `cpH`, `cpRoof`, `cpBasementAbove`, `cpRoofVolume`, `cpEntrance`, `cpParking`, `cpStoreys`;
  - results: `cpResults`, `cpXlsx`, `cpPrint`, `cpBlocked`, `cpFigures`, `cpSummary`, `cpFit`, `cpZoomOut`, `cpZoomIn`, `cpCanvas`, `cpTip`, `cpLegend`, `cpSchedule`, `cpNotEgsa`, `cpCoordsNote`, `cpPlotCoords`, `cpBuildingCoords`, `cpWarnings`;
  - around them: `cpCta`, `cpSurvey`, `cpThanks`, and `cpPrintName` (the print header).

- [ ] **Step 1: Write the page and the styles**

<!-- file: coverage-precheck.html -->
```html
<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AidedCAM - Προέλεγχος διαγράμματος κάλυψης</title>
  <meta name="description" content="Δωρεάν προέλεγχος διαγράμματος κάλυψης από DWG ή DXF: κάλυψη, δόμηση, όγκος, φύτευση, αναλυτικός πίνακας επιφανειών και συντεταγμένες ΕΓΣΑ87, απέναντι στους όρους δόμησης. Χωρίς εγκατάσταση, χωρίς εγγραφή." />
  <meta name="robots" content="index, follow" />
  <link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="icon-192.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png" />
  <meta name="theme-color" content="#f4f3ee" />
  <link rel="canonical" href="https://www.aidedcam.com/coverage-precheck.html" />
  <meta property="og:title" content="AidedCAM - Προέλεγχος διαγράμματος κάλυψης" />
  <meta property="og:description" content="Ρίξτε το DWG της άδειας και πάρτε κάλυψη, δόμηση, όγκο και φύτευση απέναντι στους όρους δόμησης." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://www.aidedcam.com/coverage-precheck.html" />
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
        <a href="index.html" class="nav-back" data-i18n="cp.back">Αρχική</a>
        <div class="lang-switcher">
          <button class="lang-btn active" data-lang="el">EL</button>
          <button class="lang-btn" data-lang="en">EN</button>
          <button class="lang-btn" data-lang="it">IT</button>
        </div>
      </div>
    </div>
  </nav>

  <main class="gv cp">
    <header class="gv-head">
      <p class="gv-eyebrow" data-i18n="cp.eyebrow">Δωρεάν εργαλείο</p>
      <h1 data-i18n="cp.title">Προέλεγχος διαγράμματος κάλυψης</h1>
      <p class="gv-lede" data-i18n="cp.lede">Ρίξτε το DWG ή DXF της άδειας και πάρτε τα μεγέθη του διαγράμματος κάλυψης: κάλυψη, δόμηση, όγκο, φύτευση, αναλυτικό πίνακα επιφανειών και συντεταγμένες κορυφών, απέναντι στους όρους δόμησης.</p>
      <p class="gv-privacy" data-i18n="cp.privacy">Τα αρχεία μένουν στον υπολογιστή σας· τίποτα δεν ανεβαίνει.</p>
      <p class="cp-indicative" data-i18n="cp.indicative">Ενδεικτικός προέλεγχος — όχι επίσημος υπολογισμός.</p>
      <p class="gv-cross"><a href="free-tools.html" data-i18n="cp.cross">Όλα τα δωρεάν εργαλεία →</a></p>
    </header>

    <div class="gv-wrap">
      <div class="gv-print-head" aria-hidden="true">
        <img src="aidedcam-wordmark.svg" alt="AidedCAM" width="716" height="67" />
        <span data-i18n="cp.title">Προέλεγχος διαγράμματος κάλυψης</span><span id="cpPrintName"></span>
      </div>
      <noscript><p class="gv-banner">Το εργαλείο χρειάζεται JavaScript. / The tool needs JavaScript.</p></noscript>

      <section class="gv-bar cp-bar" data-i18n-aria="cp.aria.files" aria-label="Αρχείο">
        <label class="gv-btn gv-btn-primary gv-file-label">
          <input type="file" id="cpInput" accept=".dwg,.dxf" class="gv-visually-hidden" />
          <span data-i18n="cp.open">Άνοιγμα αρχείου</span>
        </label>
        <button type="button" class="gv-btn" id="cpExample" data-i18n="cp.example">Φόρτωση παραδείγματος</button>
        <a class="gv-link cp-template-link" id="cpTemplate" href="js/coverage/examples/layer-template.dxf" download="aidedcam-layer-template.dxf" data-i18n="cp.template">Λήψη προτύπου στρώσεων (DXF)</a>
        <button type="button" class="gv-btn" id="cpClear" data-i18n="cp.clear" hidden>Καθαρισμός</button>
      </section>
      <details class="gv-settings cp-template-names" id="cpTemplateNames">
        <summary data-i18n="cp.template.names">Τα ονόματα στρώσεων του προτύπου</summary>
        <p class="gv-note" data-i18n="cp.template.text">Στρώσεις με αυτά τα ονόματα (χωρίς διάκριση πεζών-κεφαλαίων, -, _ ή κενών) αντιστοιχίζονται μόνες τους.</p>
        <ul class="cp-names" id="cpNames"></ul>
      </details>

      <div class="gv-banner" id="cpBanner" role="status" hidden></div>
      <p class="gv-drop-hint" id="cpDropHint" data-i18n="cp.drop">Σύρετε εδώ ένα αρχείο DWG ή DXF, ή πατήστε «Άνοιγμα αρχείου».</p>
      <p class="gv-note cp-busy" id="cpBusy" hidden></p>
      <div class="dq-error" id="cpError" role="alert" hidden></div>

      <div class="cp-panel" id="cpPanel" hidden>
        <div class="dq-status cp-status" id="cpStatus"></div>

        <section class="cp-step" id="cpStep1">
          <h2 data-i18n="cp.step1">1. Στρώσεις</h2>
          <p class="gv-note" data-i18n="cp.step1.hint">Δώστε σε κάθε στρώση τον ρόλο της. Οι στρώσεις του προτύπου συμπληρώνονται μόνες τους· οι άλλες θυμούνται την τελευταία σας επιλογή σε αυτόν τον browser.</p>
          <p class="gv-note" id="cpAuto" hidden></p>
          <div class="gv-table-wrap">
            <table class="gv-table cp-map" id="cpMap">
              <thead><tr><th data-i18n="cp.col.layer">Στρώση</th><th class="dq-num" data-i18n="cp.col.outlines">Περιγράμματα</th><th class="dq-num" data-i18n="cp.col.area">Εμβαδόν (m²)</th><th data-i18n="cp.col.role">Ρόλος</th><th data-i18n="cp.col.level">Στάθμη</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <details class="cp-other" id="cpOther"><summary id="cpOtherSummary"></summary><p class="gv-note" id="cpOtherList"></p></details>
        </section>

        <section class="cp-step" id="cpStep2">
          <h2 data-i18n="cp.step2">2. Όροι δόμησης και ύψη</h2>
          <p class="gv-note" data-i18n="cp.step2.hint">Όπως τους γράφει το τοπογραφικό. Αποθηκεύονται μόνο σε αυτόν τον browser.</p>
          <div class="gv-settings-grid cp-terms" id="cpTerms">
            <label><span data-i18n="cp.term.sd">Συντελεστής δόμησης ΣΔ</span><input type="text" inputmode="decimal" id="cpSd" data-term="sd" /><small class="cp-hint" data-i18n="cp.term.sd.hint">Με πολλά πρόσωπα, γράψτε τον σταθμισμένο ΣΔ (206 §2).</small></label>
            <label><span data-i18n="cp.term.sk">Ποσοστό κάλυψης Σ.Κ. (%)</span><input type="text" inputmode="decimal" id="cpSk" data-term="sk" /><small class="cp-hint" data-i18n="cp.term.sk.hint">Πάνω από 60% ισχύουν ειδικές περιπτώσεις (207 §1α).</small></label>
            <label><span data-i18n="cp.term.hmax">Μέγιστο ύψος Hmax (m)</span><input type="text" inputmode="decimal" id="cpHmax" data-term="hmax" /><small class="cp-hint" id="cpHmaxHint"></small></label>
            <label><span data-i18n="cp.term.roofAllow">Επιτρεπόμενη στέγη (m)</span><input type="text" inputmode="decimal" id="cpRoofAllow" data-term="roofAllow" /></label>
            <label><span data-i18n="cp.term.h">Πραγματοποιούμενο ύψος H (m)</span><input type="text" inputmode="decimal" id="cpH" data-term="h" /></label>
            <label><span data-i18n="cp.term.roof">Ύψος στέγης (m)</span><input type="text" inputmode="decimal" id="cpRoof" data-term="roof" /></label>
            <label><span data-i18n="cp.term.basementAbove">Υπόγειο πάνω από το οριστικό έδαφος (m)</span><input type="text" inputmode="decimal" id="cpBasementAbove" data-term="basementAbove" /></label>
            <label><span data-i18n="cp.term.roofVolume">Όγκος στέγης (m³)</span><input type="text" inputmode="decimal" id="cpRoofVolume" data-term="roofVolume" /><small class="cp-hint" data-i18n="cp.term.roofVolume.hint">Μόνο αν η στέγη δεν είναι υποχρεωτική (208 §2).</small></label>
            <label><span data-i18n="cp.term.entrance">Στάθμη εισόδου</span><select id="cpEntrance"></select></label>
            <label class="cp-check"><input type="checkbox" id="cpParking" /><span data-i18n="cp.term.parking">Υπαίθριες θέσεις στάθμευσης στο οικόπεδο</span></label>
          </div>
          <div class="gv-settings-grid cp-terms" id="cpStoreys"></div>
          <p class="gv-note" data-i18n="cp.term.storey.hint">Από στάθμη σε στάθμη δαπέδου· 3,00 m αν δεν γράψετε άλλο.</p>
        </section>

        <section class="cp-results" id="cpResults">
          <div class="cp-results-head">
            <h2 data-i18n="cp.results">3. Αποτελέσματα</h2>
            <span class="cp-export">
              <button type="button" class="gv-btn" id="cpXlsx" data-i18n="cp.xlsx">Λήψη Excel (.xlsx)</button>
              <button type="button" class="gv-btn" id="cpPrint" data-i18n="cp.print">Εκτύπωση / PDF</button>
            </span>
          </div>
          <p class="gv-note" data-i18n="cp.rules.asof">Κανόνες: Ν.5306/2026 (08.06.2026) και εγκύκλιος 15494/397/2026.</p>
          <div class="dq-error" id="cpBlocked" role="alert" hidden></div>

          <div id="cpFigures">
            <div class="cp-table-head"><h3 data-i18n="cp.col.figure">Μέγεθος</h3><button type="button" class="gv-link" data-copy="summary" data-i18n="cp.copy">Αντιγραφή</button></div>
            <div class="gv-table-wrap">
              <table class="gv-table cp-summary" id="cpSummary">
                <thead><tr><th data-i18n="cp.col.figure">Μέγεθος</th><th data-i18n="cp.col.permitted">Επιτρεπόμενο</th><th data-i18n="cp.col.proposed">Πραγματοποιούμενο</th><th data-i18n="cp.col.mark">Έλεγχος</th><th data-i18n="cp.col.article">Άρθρο</th></tr></thead>
                <tbody></tbody>
              </table>
            </div>

            <div class="cp-view">
              <div class="gv-panel-head">
                <span data-i18n="cp.drawing">Σχέδιο</span>
                <span class="gv-tools-controls">
                  <button type="button" class="gv-link" id="cpFit" data-i18n="cp.fit">Προσαρμογή</button>
                  <button type="button" class="gv-zoom" id="cpZoomOut" data-i18n-aria="cp.zoomout" aria-label="Σμίκρυνση">−</button>
                  <button type="button" class="gv-zoom" id="cpZoomIn" data-i18n-aria="cp.zoomin" aria-label="Μεγέθυνση">+</button>
                </span>
              </div>
              <div class="dq-canvas-box">
                <canvas class="dq-canvas cp-canvas" id="cpCanvas" role="img" data-i18n-aria="cp.aria.drawing" aria-label="Σχέδιο με τα αντιστοιχισμένα περιγράμματα"></canvas>
                <div class="dq-tip" id="cpTip" hidden></div>
              </div>
              <ul class="cp-legend" id="cpLegend" data-i18n-aria="cp.legend" aria-label="Υπόμνημα"></ul>
            </div>

            <div class="cp-table-head"><h3 data-i18n="cp.schedule">Αναλυτικός πίνακας επιφανειών</h3><button type="button" class="gv-link" data-copy="schedule" data-i18n="cp.copy">Αντιγραφή</button></div>
            <div class="gv-table-wrap">
              <table class="gv-table cp-schedule" id="cpSchedule">
                <thead><tr><th data-i18n="cp.sch.col.item">Επιφάνεια</th><th class="dq-num" data-i18n="cp.sch.col.area">Εμβαδόν (m²)</th><th class="dq-num" data-i18n="cp.sch.col.excluded">Εκτός ΣΔ (m²)</th><th class="dq-num" data-i18n="cp.sch.col.counts">Εντός ΣΔ (m²)</th><th data-i18n="cp.col.note">Σημείωση</th></tr></thead>
                <tbody></tbody>
              </table>
            </div>
            <p class="gv-note" data-i18n="cp.sch.mezzNote">Τα πατάρια μετρούν στη δόμηση από τον Ν.5197/2025· η εξαίρεση πατάρι του προτύπου του 2022 δεν ισχύει πια.</p>

            <div class="cp-table-head"><h3 data-i18n="cp.coords">Συντεταγμένες κορυφών ΕΓΣΑ87</h3><button type="button" class="gv-link" data-copy="coords" data-i18n="cp.copy">Αντιγραφή</button></div>
            <p class="gv-banner" id="cpNotEgsa" data-i18n="cp.warn.not-egsa" hidden>Οι συντεταγμένες δεν είναι σε ΕΓΣΑ87: το σχέδιο δεν είναι γεωαναφερμένο ή οι μονάδες του είναι λάθος.</p>
            <p class="gv-note" id="cpCoordsNote" hidden></p>
            <div class="cp-coords">
              <div class="gv-table-wrap">
                <table class="gv-table cp-coord" id="cpPlotCoords">
                  <caption data-i18n="cp.coords.plot">Κορυφές οικοπέδου</caption>
                  <thead><tr><th data-i18n="cp.coords.col.n">Α/Α</th><th class="dq-num" data-i18n="cp.coords.col.x">X</th><th class="dq-num" data-i18n="cp.coords.col.y">Y</th><th></th></tr></thead>
                  <tbody></tbody>
                </table>
              </div>
              <div class="gv-table-wrap">
                <table class="gv-table cp-coord" id="cpBuildingCoords">
                  <caption data-i18n="cp.coords.building">Κορυφές κτιρίου (περίγραμμα κάλυψης)</caption>
                  <thead><tr><th data-i18n="cp.coords.col.n">Α/Α</th><th class="dq-num" data-i18n="cp.coords.col.x">X</th><th class="dq-num" data-i18n="cp.coords.col.y">Y</th><th></th></tr></thead>
                  <tbody></tbody>
                </table>
              </div>
            </div>
          </div>

          <h3 data-i18n="cp.warnings">Προειδοποιήσεις</h3>
          <ul class="gv-check-list cp-warnings" id="cpWarnings"></ul>
          <p class="cp-disclaimer" data-i18n="cp.disclaimer">Ενδεικτικός προέλεγχος — όχι επίσημος υπολογισμός. Το διάγραμμα κάλυψης το συντάσσει και το υπογράφει ο μηχανικός.</p>
        </section>
      </div>

      <section class="gv-cta">
        <h2 data-i18n="cp.cta.title">Το διάγραμμα κάλυψης μέσα στο CAD σας;</h2>
        <p data-i18n="cp.cta.text">Το στήνουμε στις στρώσεις και τα πρότυπα του γραφείου σας, και γράφουμε το διάγραμμα πίσω στο CAD σας.</p>
        <a class="btn-primary" id="cpCta" href="index.html#contact" data-i18n="cp.cta.link">Επικοινωνήστε μαζί μας</a>
        <div class="gv-survey" id="cpSurvey">
          <p data-i18n="cp.survey.q">Πώς βγάζετε σήμερα το διάγραμμα κάλυψης;</p>
          <button type="button" class="gv-chip" data-answer="hand" data-i18n="cp.survey.hand">Με το χέρι ή σε Excel</button>
          <button type="button" class="gv-chip" data-answer="software" data-i18n="cp.survey.software">Με εξειδικευμένο πρόγραμμα</button>
          <button type="button" class="gv-chip" data-answer="other" data-i18n="cp.survey.other">Αλλιώς</button>
          <p class="gv-thanks" id="cpThanks" data-i18n="cp.survey.thanks" hidden>Ευχαριστούμε!</p>
        </div>
      </section>
    </div>
    <p class="cp-print-disclaimer" data-i18n="cp.disclaimer" aria-hidden="true">Ενδεικτικός προέλεγχος — όχι επίσημος υπολογισμός. Το διάγραμμα κάλυψης το συντάσσει και το υπογράφει ο μηχανικός.</p>
  </main>

  <footer class="gv-footer">
    <img src="aidedcam-wordmark.svg" alt="AidedCAM" width="716" height="67" loading="lazy" />
    <div class="gv-footer-legal">
      <a href="privacy.html" data-i18n="footer.privacy">Απόρρητο</a>
      <a href="legal.html" data-i18n="footer.legal">Νομικά</a>
      <a href="javascript:void(0)" onclick="openCookieSettings()" data-i18n="footer.cookie_settings">Ρυθμίσεις Cookies</a>
    </div>
    <p class="lc-notice"><span data-i18n="cp.notice">Μηχανή γεωμετρίας: Eyeshot.</span> Portion of copyright © devDept Software S.r.l. All Rights Reserved.</p>
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

  <script src="js/coverage/i18n-coverage.js?v=20261015"></script>
  <script>
    var translations = {
      el: {
        "_title": "AidedCAM - Προέλεγχος διαγράμματος κάλυψης",
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
        "_title": "AidedCAM - Coverage diagram pre-check",
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
        "_title": "AidedCAM - Pre-verifica del diagramma di copertura",
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
    // The tool's strings first, then this page's own keys on top.
    ['el', 'en', 'it'].forEach(function (l) {
      translations[l] = Object.assign({}, (window.CP_I18N || {})[l] || {}, translations[l]);
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
  <script type="module" src="js/coverage/ui.js?v=20261015"></script>
</body>
</html>
```

<!-- file: css/tools.css -->
```css
/* Free-tool pages (the G-code viewer first). Builds on the css/editorial.css tokens. Spec §8. */
:root {
  --gv-feed: #0d7a3e;      /* = --accent */
  --gv-rapid: #b8741a;     /* amber, dashed */
  --gv-pass: #4a6f8f;      /* slate: passes the control generates */
  --gv-profile: #8a897f;   /* R5: lighter than --gv-feed (luminance 0.248 vs 0.144), still >=3:1 on white/paper */
  --gv-hi: #c2410c;        /* hover highlight */
  --gv-mono: ui-monospace, 'Cascadia Mono', Consolas, 'Courier New', monospace; /* program panel only */
  --gv-line-h: 20px;       /* must equal LINE_H in js/gcode/shell/program-panel.js */
}

/* Tool-page nav: back link + language switcher on one row (same as calculator.html's inline styles) */
:root {
  --ic-arrow-l: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M19 12H6M12 5l-7 7 7 7'/%3E%3C/svg%3E");
}
.nav-right { display: flex; align-items: center; gap: 1.25rem; }
.nav-back {
  display: inline-flex; align-items: center; gap: 0.4rem;
  color: var(--muted); text-decoration: none;
  font-family: var(--font-mono); font-weight: 400; font-size: 0.72rem;
  letter-spacing: 0.1em; text-transform: uppercase;
  transition: color 0.2s ease;
}
.nav-back:hover { color: var(--ink); }
.nav-back::before {
  content: ''; width: 1em; height: 1em; flex: none;
  background-color: currentColor;
  -webkit-mask: var(--ic-arrow-l) center / contain no-repeat;
          mask: var(--ic-arrow-l) center / contain no-repeat;
  transition: transform 0.25s ease;
}
.nav-back:hover::before { transform: translateX(-3px); }
@media (max-width: 768px) { .nav-back { display: none; } }

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
/* Keyboard file open (item 2): the input stays in the layout and focusable, unlike display:none. */
.gv-visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; opacity: 0; }
.gv-file-label:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
.gv-settings { flex-basis: 100%; }
.gv-settings summary { cursor: pointer; color: var(--muted); font-size: 0.9rem; }
.gv-settings-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 0.6rem 1rem; padding: 0.8rem 0; }
.gv-settings-grid label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: var(--muted); }
.gv-settings-grid select, .gv-settings-grid input, .gv-settings-grid output { display: block; font-family: var(--font-body); font-size: 0.9rem; padding: 0.4rem 0.5rem; border: 1px solid var(--line-strong); background: var(--panel); color: var(--ink); border-radius: 2px; min-width: 0; }
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
.gv-code { position: relative; }
.gv-code:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
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
.gv-swatch.profile { border-color: var(--gv-profile); border-top-width: 4px; }   /* R5: solid, matches the drawn stroke */
.gv-svg { display: block; width: 100%; height: min(62vh, 560px); background: var(--panel); touch-action: none; cursor: crosshair; }
.gv-svg:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
@media (max-width: 720px) {
  /* The drawing must not trap the whole page's scroll on phones (item 3). */
  .gv-svg { height: min(50vh, 380px); }
}
.gv-zoom {
  display: inline-flex; align-items: center; justify-content: center;
  width: 1.7rem; height: 1.7rem; padding: 0; line-height: 1;
  border: 1px solid var(--line-strong); background: var(--panel); color: var(--ink);
  font-family: var(--font-body); font-size: 1rem; border-radius: 2px; cursor: pointer;
}
.gv-zoom:hover { border-color: var(--accent-deep); color: var(--accent-deep); }
.gv-zoom:focus-visible, .gv-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.gv-path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.gv-feed { stroke: var(--gv-feed); stroke-width: 1.6; }
.gv-rapid { stroke: var(--gv-rapid); stroke-width: 1.1; stroke-dasharray: 5 4; }
.gv-pass { stroke: var(--gv-pass); stroke-width: 1.1; }
.gv-profile { stroke: var(--gv-profile); stroke-width: 4; }         /* solid: opacity blended it below 3:1 (item 18) */
.gv-hi { stroke: var(--gv-hi); stroke-width: 3; }
.gv-marker path { stroke: var(--gv-hi); stroke-width: 1.6; stroke-linecap: round; }
.gv-axis { stroke: var(--line-strong); stroke-width: 1; stroke-dasharray: 10 4 2 4; }
.gv-tick { stroke: var(--line-strong); stroke-width: 1; }
.gv-tick-label { fill: var(--ink-soft); font-family: var(--font-mono); }
.gv-start { fill: var(--ink); }
.gv-label { fill: var(--ink-soft); font-family: var(--font-mono); }
.gv-readout { margin: 0; padding: 0.4rem 0.75rem; border-top: 1px solid var(--line); font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 12px; color: var(--muted); min-height: 1.6em; }

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
.gv-w-line { background: none; border: 0; padding: 0; color: var(--accent-deep); cursor: pointer; font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 0.82rem; white-space: nowrap; }

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
  .navbar, .gv-head, .gv-bar, .gv-banner, .gv-program, .gv-readout, .gv-cta, .gv-footer, .consent-banner { display: none !important; }
  /* Print keeps the layer legend (swatches + names), without the Fit/zoom/1:1 controls or the
     checkboxes themselves (item 8). */
  .gv-tools-controls, .gv-tools input[type="checkbox"] { display: none !important; }
  .gv-print-head { display: flex !important; justify-content: space-between; align-items: center; gap: 12px; border-bottom: 2px solid var(--primary-light); padding-bottom: 8px; margin-bottom: 12px; font-size: 11px; color: #444; }
  .gv-print-head img { height: 16px; width: auto; }
  .gv-print-foot { display: block !important; margin-top: 12px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 10px; color: #777; text-align: center; }
  .gv-main { display: block; }
  .gv-drawing { border: 1px solid #ccc; break-inside: avoid; }
  .gv-svg { height: 95mm; }
  .gv-results { display: block; padding: 0; }
  .gv-time, .gv-checks { break-inside: avoid; margin-top: 10px; }
  .gv-table-wrap { overflow: visible; }
  .gv-hi { display: none !important; }   /* R13: a hover or pin never prints in the highlight colour */
}

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
  .gv-3d, .gv-play { display: none !important; }
  .gv-print-shot { display: block !important; width: 100%; max-height: 110mm; object-fit: contain; }
}

/* ---- free-tools.html: one card per tool ---- */
/* Tools grouped by who they are for: the wide group spans both columns, single-card groups share a row. */
.ft-groups { display: grid; grid-template-columns: 1fr; gap: 2rem 1.25rem; padding: 2rem 0 1rem; }
.ft-group { display: flex; flex-direction: column; min-width: 0; }
.ft-group-title { margin: 0 0 0.75rem; font-weight: 400; }
.ft-cards { display: grid; grid-template-columns: 1fr; gap: 1.25rem; flex: 1; }
@media (min-width: 720px) {
  .ft-groups { grid-template-columns: 1fr 1fr; }
  .ft-group.is-wide { grid-column: 1 / -1; }
  .ft-group.is-wide .ft-cards { grid-template-columns: 1fr 1fr; }
}
.ft-card { display: block; padding: 1.5rem; background: var(--panel); border: 1px solid var(--line); color: var(--ink); text-decoration: none; transition: border-color 0.2s ease; }
.ft-card:hover { border-color: var(--accent); }
.ft-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ft-card h2, .ft-card h3 { margin: 0 0 0.5rem; font-family: var(--font-display); font-weight: 300; font-size: 1.5rem; }
.ft-card p { margin: 0 0 1rem; color: var(--ink-soft); }
.ft-open { color: var(--accent-deep); font-weight: 500; }

/* ---- laser-dxf-checker.html: the laser DXF check (spec §10) ---- */
:root { --lc-mark: #1d4ed8; --lc-branch: #7c3aed; }
.lc-table .lc-row { cursor: pointer; }
.lc-table .lc-row:hover td, .lc-table .lc-row.is-sel td { background: var(--accent-soft); }
.lc-table .lc-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.lc-name { max-width: 16rem; overflow: hidden; text-overflow: ellipsis; }
.lc-table select, .lc-roles select, .lc-qty, .lc-speeds input { font: inherit; font-size: 0.85rem; padding: 0.2rem 0.3rem; border: 1px solid var(--line-strong); background: var(--panel); color: var(--ink); }
.lc-qty { width: 4.5rem; }
.lc-status { font-size: 1rem; }
.lc-status.is-ok { color: var(--gv-feed); }
.lc-status.is-warn { color: var(--gv-rapid); }
.lc-status.is-error { color: var(--gv-hi); }
.lc-status.is-busy { font-size: 0.8rem; font-style: italic; color: var(--muted); }
.lc-detail { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 1.25rem; margin-top: 1.5rem; }
@media (max-width: 900px) { .lc-detail { grid-template-columns: minmax(0, 1fr); } }
.lc-view { min-width: 0; border: 1px solid var(--line); background: var(--panel); }
.lc-svg { display: block; width: 100%; height: 420px; background: #fff; touch-action: none; cursor: grab; }
@media (max-width: 600px) { .lc-svg { height: 300px; } }
.lc-c { fill: none; stroke-width: 1.5; vector-effect: non-scaling-stroke; }
.lc-cut { stroke: var(--ink); }
.lc-mark { stroke: var(--lc-mark); }
.lc-bend { stroke: var(--gv-rapid); stroke-dasharray: 6 4; }
.lc-ignore { stroke: var(--faint); }
.lc-c.lc-open { stroke: var(--gv-hi); }
.lc-c.is-hi { stroke: var(--gv-hi); stroke-width: 3; }
.lc-text { fill: var(--muted); font-family: var(--font-body); }
.lc-m { fill: none; stroke-width: 2; vector-effect: non-scaling-stroke; }
.lc-m-open, .lc-m-self { stroke: var(--gv-hi); }
.lc-m-gap { stroke: var(--gv-rapid); }
.lc-m-branch { stroke: var(--lc-branch); }
.lc-pick { margin: 0; padding: 1rem 0.75rem; text-align: center; color: var(--muted); font-size: 0.9rem; }
.lc-legend { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; margin: 0; padding: 0.5rem 0.75rem; border-top: 1px solid var(--line); font-size: 0.8rem; color: var(--muted); }
.lc-key { display: inline-block; width: 18px; border-top: 2px solid; vertical-align: middle; margin-right: 0.35rem; }
.lc-key.cut { border-color: var(--ink); }
.lc-key.mark { border-color: var(--lc-mark); }
.lc-key.bend { border-color: var(--gv-rapid); border-top-style: dashed; }
.lc-key.ignore { border-color: var(--faint); }
.lc-dot { display: inline-block; width: 9px; height: 9px; border: 2px solid; border-radius: 50%; vertical-align: middle; margin-right: 0.35rem; }
.lc-dot.open { border-color: var(--gv-hi); }
.lc-dot.gap { border-color: var(--gv-rapid); }
.lc-side { min-width: 0; }
.lc-side h2 { margin: 0 0 0.5rem; font-family: var(--font-mono); font-weight: 400; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.lc-side .gv-check-list { margin-bottom: 1.25rem; }
.lc-chip { display: inline-block; width: 14px; height: 14px; border: 1px solid var(--line-strong); vertical-align: middle; }
.lc-settings { margin-top: 1.5rem; }
.lc-settings h3 { margin: 0.5rem 0 0.25rem; font-size: 0.9rem; font-weight: 500; }
.lc-speeds input { width: 7rem; }
.lc-notice { margin: 0.75rem 0 0; font-size: 0.72rem; color: var(--muted); }
.lc-print-all { display: none; }
@media print {
  .lc-detail, .lc-settings, .gv-drop-hint, .lc-table td:last-child, .lc-table th:last-child { display: none !important; }
  .lc-print-all { display: block !important; }
  .lc-print-file { break-inside: avoid; margin: 0 0 12px; }
  .lc-print-file h3 { margin: 0 0 4px; font-size: 12px; }
  .lc-print-svg { display: block; width: 100%; height: 80mm; border: 1px solid #ccc; }
}

/* ---- dwg-quantities.html: quantities from DWG (spec §5) ---- */
.dq-panel { padding: 0; }   /* editorial.css pads every <section> */
.dq-tabs { display: flex; gap: 0.25rem; overflow-x: auto; overflow-y: hidden; border-bottom: 1px solid var(--line-strong); margin: 0 0 1rem; }
.dq-tab { display: inline-flex; align-items: center; gap: 0.4rem; flex: none; max-width: 16rem; padding: 0.5rem 0.8rem; border: 1px solid transparent; border-bottom: 0; background: none; color: var(--muted); font-family: var(--font-body); font-size: 0.88rem; cursor: pointer; white-space: nowrap; }
.dq-tab .dq-tab-name { overflow: hidden; text-overflow: ellipsis; }
.dq-tab:hover { color: var(--ink); }
.dq-tab[aria-selected="true"] { background: var(--panel); color: var(--ink); border-color: var(--line-strong); margin-bottom: -1px; }
.dq-tab:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.dq-mark { font-size: 0.95rem; }
.dq-mark.is-ok { color: var(--gv-feed); }
.dq-mark.is-warn { color: var(--gv-rapid); }
.dq-mark.is-error { color: var(--gv-hi); }
.dq-mark.is-busy { font-size: 0.78rem; font-style: italic; color: var(--muted); }
.dq-status { display: flex; flex-wrap: wrap; gap: 0.4rem 0.8rem; align-items: center; font-size: 0.85rem; color: var(--muted); margin: 0 0 0.6rem; }
.dq-status select { font: inherit; font-size: 0.85rem; padding: 0.2rem 0.3rem; border: 1px solid var(--line-strong); background: var(--panel); color: var(--ink); }
.dq-error { margin: 0 0 1rem; padding: 0.8rem 0.9rem; border: 1px solid var(--gv-hi); background: rgba(194, 65, 12, 0.06); color: var(--ink); font-size: 0.9rem; }
.dq-warnings { margin: 0 0 1rem; }
.dq-warnings select { margin-left: 0.4rem; font: inherit; font-size: 0.85rem; padding: 0.15rem 0.3rem; border: 1px solid var(--line-strong); background: var(--panel); color: var(--ink); }
.dq-work { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 1.25rem; }
@media (max-width: 900px) { .dq-work { grid-template-columns: minmax(0, 1fr); } }
.dq-view { min-width: 0; border: 1px solid var(--line); background: var(--panel); }
.dq-canvas-box { position: relative; }
.dq-canvas { display: block; width: 100%; height: min(62vh, 520px); background: var(--panel); touch-action: none; cursor: crosshair; }
@media (max-width: 720px) { .dq-canvas { height: min(50vh, 360px); } }
.dq-canvas:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.dq-tip { position: absolute; z-index: 2; pointer-events: none; max-width: 16rem; padding: 0.35rem 0.55rem; background: var(--ink); color: var(--paper); font-size: 0.78rem; line-height: 1.45; border-radius: 2px; font-variant-numeric: tabular-nums; }
.dq-tip b { font-weight: 600; }
.dq-simplified { margin: 0; padding: 0.4rem 0.75rem; border-top: 1px solid var(--line); }
.dq-sel { min-width: 0; }
.dq-sel h2, .dq-tables h2 { margin: 0 0 0.5rem; font-family: var(--font-mono); font-weight: 400; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.dq-sel-count { margin: 0.2rem 0 0.4rem; font-weight: 600; font-size: 0.9rem; }
.dq-sel-actions { display: flex; gap: 0.8rem; align-items: center; margin: 0.6rem 0; }
.dq-sel-cta { margin: 1rem 0 0; padding: 0.7rem 0.8rem; border-left: 2px solid var(--accent); background: var(--accent-soft); font-size: 0.85rem; line-height: 1.5; color: var(--ink-soft); }
.dq-sel-cta a { color: var(--accent-deep); font-weight: 500; white-space: nowrap; }
.dq-tables { margin-top: 1.75rem; }
.dq-tables h2 { margin-top: 1.5rem; }
.dq-tables h3 { margin: 0.8rem 0 0.3rem; font-size: 0.9rem; font-weight: 500; color: var(--ink); }
.dq-layers tbody tr, .dq-blocks tbody tr { cursor: pointer; }
.dq-layers tbody tr:hover td, .dq-blocks tbody tr:hover td,
.dq-layers tbody tr.is-hover td, .dq-blocks tbody tr.is-hover td { background: var(--accent-soft); }
.dq-layers tbody tr.is-hi td, .dq-blocks tbody tr.is-hi td { background: var(--accent-soft); font-weight: 600; }
.dq-layers tbody tr:focus-visible, .dq-blocks tbody tr:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.dq-summary .dq-layers tbody tr, .dq-summary .dq-blocks tbody tr { cursor: default; }
.dq-name { max-width: 18rem; overflow: hidden; text-overflow: ellipsis; }
.dq-badge { display: inline-block; margin-right: 0.3rem; padding: 0 0.4rem; border: 1px solid var(--line-strong); border-radius: 999px; font-size: 0.72rem; color: var(--muted); }
.dq-badge.is-bad { border-color: var(--gv-rapid); color: var(--gv-rapid); }
.dq-num { text-align: right !important; }
.dq-settings { margin-top: 1.5rem; }
@media print { .dq-tabs, .dq-view, .dq-sel, .dq-settings, .dq-status select { display: none !important; } .dq-work { display: block; } }

/* ---- coverage-precheck.html: the coverage diagram pre-check (spec §6) ---- */
.cp-indicative { display: inline-block; margin: 0.6rem 0 0; padding: 0.2rem 0.7rem; border: 1px solid var(--gv-rapid); border-radius: 999px; color: var(--ink-soft); font-size: 0.82rem; }
.cp-template-link { margin-left: 0.3rem; }
.cp-template-names { margin: 0 0 1rem; }
.cp-names { list-style: none; margin: 0; padding: 0; columns: 2 16rem; column-gap: 1.5rem; font-size: 0.85rem; color: var(--ink-soft); }
.cp-names li { padding: 0.15rem 0; break-inside: avoid; }
.cp-names code { font-family: var(--gv-mono); font-size: 0.8rem; color: var(--ink); }
.cp-busy { font-style: italic; }
.cp-panel { padding: 0; }
.cp-status .cp-file { font-weight: 600; color: var(--ink); }
.cp-step, .cp-results { padding: 1.25rem 0; border-top: 1px solid var(--line); }   /* editorial.css pads every <section> */
.cp-step h2, .cp-results h2 { font-family: var(--font-display); font-weight: 400; font-size: 1.35rem; margin: 0 0 0.3rem; color: var(--ink); }
.cp-results h3 { margin: 1.5rem 0 0.5rem; font-family: var(--font-mono); font-weight: 400; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.cp-map select, .cp-terms select { font: inherit; font-size: 0.85rem; padding: 0.2rem 0.3rem; border: 1px solid var(--line-strong); background: var(--panel); color: var(--ink); max-width: 16rem; }
.cp-swatch { display: inline-block; width: 10px; height: 10px; margin-right: 0.45rem; border-radius: 2px; vertical-align: middle; }
.cp-other { margin-top: 0.6rem; font-size: 0.85rem; color: var(--muted); }
.cp-other summary { cursor: pointer; }
.cp-terms input[aria-invalid="true"] { border-color: var(--gv-hi); }
.cp-hint { color: var(--faint); font-size: 0.75rem; line-height: 1.35; }
.cp-terms .cp-check { flex-direction: row; align-items: center; gap: 0.5rem; }
.cp-results-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.5rem; }
.cp-export { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.cp-table-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
.cp-summary .cp-block th { padding-top: 0.9rem; color: var(--ink); font-weight: 600; font-size: 0.82rem; background: var(--paper-2, transparent); }
.cp-summary .cp-fig { white-space: normal; min-width: 12rem; }
.cp-row-note { display: block; color: var(--muted); font-size: 0.75rem; white-space: normal; }
.cp-mark { font-weight: 700; text-align: center !important; }
.cp-mark.is-ok { color: var(--gv-feed); }
.cp-mark.is-over { color: var(--gv-hi); }
.cp-art summary { cursor: pointer; color: var(--accent-deep); font-size: 0.78rem; list-style: none; }
.cp-art summary::-webkit-details-marker { display: none; }
.cp-art[open] summary { font-weight: 600; }
.cp-art-text { display: block; max-width: 22rem; white-space: normal; font-size: 0.78rem; color: var(--ink-soft); line-height: 1.45; }
.cp-linked { cursor: pointer; }
.cp-linked:hover td, .cp-linked:focus td { background: var(--accent-soft); }
.cp-linked.is-hi td { background: var(--accent-soft); font-weight: 600; }
.cp-linked:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.cp-view { margin: 1.25rem 0 0.5rem; border: 1px solid var(--line); background: var(--panel); min-width: 0; }
.cp-legend { display: flex; flex-wrap: wrap; gap: 0.3rem 1rem; list-style: none; margin: 0; padding: 0.45rem 0.75rem; border-top: 1px solid var(--line); font-size: 0.8rem; color: var(--ink-soft); }
.cp-schedule .cp-sch-head td { padding-top: 0.9rem; font-weight: 600; color: var(--ink); }
.cp-schedule .cp-sch-domisi td, .cp-schedule .cp-sch-total td, .cp-schedule .cp-sch-sum td { font-weight: 600; border-bottom-color: var(--line-strong); }
.cp-schedule .cp-sch-space td:first-child, .cp-schedule .cp-sch-gross td:first-child { padding-left: 1.2rem; }
.cp-schedule .cp-sch-cap td:first-child { padding-left: 2.2rem; color: var(--muted); font-size: 0.8rem; }
.cp-note { color: var(--muted); font-size: 0.8rem; white-space: normal !important; min-width: 10rem; }
.cp-coords { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; }
@media (min-width: 900px) { .cp-coords { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
.cp-coord caption { text-align: left; padding: 0 0 0.3rem; font-size: 0.85rem; font-weight: 500; color: var(--ink); }
.cp-warnings { margin: 0 0 1rem; }
.cp-warnings .gv-w-line { margin-left: auto; }
.cp-disclaimer { margin: 1rem 0 0; padding: 0.6rem 0.8rem; border-left: 2px solid var(--gv-rapid); background: var(--accent-soft); font-size: 0.85rem; color: var(--ink-soft); }
.cp-print-disclaimer { display: none; }
@media print {
  .cp-bar, .cp-template-names, .cp-busy, .cp-status select, .cp-status label, .cp-step, .cp-export, .cp-table-head .gv-link, .gv-tools-controls, .cp-warnings .gv-w-line { display: none !important; }
  .cp-results { border-top: 0; padding-top: 0; }
  .cp-art summary { color: #444; }
  .cp-art-text { display: none; }
  .cp-view { break-inside: avoid; border: 1px solid #ccc; }
  .cp-canvas { height: 110mm !important; }
  .cp-summary, .cp-coord { break-inside: avoid; }
  .cp-coords { grid-template-columns: 1fr 1fr; }
  .cp-disclaimer { display: none; }
  .cp-print-disclaimer { display: block !important; position: fixed; bottom: 0; left: 0; right: 0; margin: 0; padding: 2mm 0; background: #fff; border-top: 1px solid #ccc; font-size: 9px; color: #555; text-align: center; }
  .cp .gv-wrap { padding-bottom: 12mm; }
}
```

Run:
```bash
node _tests/extract.mjs $PLAN coverage-precheck.html && node _tests/extract.mjs $PLAN css/tools.css
git diff --stat css/tools.css
git diff css/tools.css | grep -c '^-[^-]'
```
Expected: `css/tools.css | 65 +++…` with insertions only, then `0`: no existing line changed.

- [ ] **Step 2: Check it**

Run: `grep -c 'Portion of copyright © devDept Software S.r.l. All Rights Reserved.' coverage-precheck.html && node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js" "_tests/laser/*.test.js" "_tests/dwg/*.test.js" "_tests/coverage/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `1`, then `ℹ pass 394`, `ℹ fail 0` (the other tools' tests still pass with the appended styles).

Open `http://127.0.0.1:8765/coverage-precheck.html`: the header, the disclaimer line, the buttons and the footer show. Nothing works yet: the controller comes in Task 11.

- [ ] **Step 3: Commit**

```bash
git add coverage-precheck.html css/tools.css
git commit -F - <<'EOF'
Coverage pre-check: the page and its styles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 11: The controller

**Files:**
- Create: `js/coverage/ui.js`

**Interfaces:**
- Consumes: everything above, plus `createEngine` from `js/laser/bridge.js` with this page's own `makeWorker` (`../dwg/worker.js?v=20261015`) and `timeoutMs: 60000`, `writeXlsx` from `js/dwg/xlsx.js`, and `UNITS` and `MAX_BYTES` from `js/dwg/state.js`.
- Produces:
  - The working page, and `window.__covp` = `{ timings: { boot, file, union, remap, term, evaluate }, drawing }` for the browser check.
  - `localStorage` keys `aidedcam-covp-mapping` (the remembered roles by layer name), `aidedcam-covp-terms` (the typed terms) and `aidedcam-covp-survey`.
  - GA events (consent-gated, anonymous):
    - `covp_file_loaded` and `covp_example_loaded` `{ format, size }`;
    - `covp_mapping_done { roles, template }` and `covp_terms_entered`;
    - `covp_xlsx_download`, `covp_copy`, `covp_print`, `covp_template_download`;
    - `covp_units_override { units }`, `covp_cta_click { where: 'page' }`, `covp_survey { answer }`.

- [ ] **Step 1: The check that fails now**

Run: `node --check js/coverage/ui.js 2>&1 | grep -c "Cannot find module"`
Expected: `1`.

- [ ] **Step 2: Write the controller**

<!-- file: js/coverage/ui.js -->
```js
// Coverage pre-check: the page controller (spec §6). One file at a time goes to the DWG quantities engine
// worker; the page keeps its result, maps its layers to roles, and computes every figure in JavaScript. Only a
// changed coverage mapping asks the engine again (for the union of the coverage outlines).
import { t, ga, fmtNum, lang, localeOf } from '../gcode/shell/i18n.js';
import { lsGet, lsSet } from '../gcode/shell/settings-store.js';
import { renderBanner } from '../gcode/shell/banner.js';
import { createEngine } from '../laser/bridge.js?v=20261015';
import { writeXlsx } from '../dwg/xlsx.js?v=20261015';
import { UNITS, MAX_BYTES } from '../dwg/state.js?v=20261015';
import { ROLES, LEVELS, TEMPLATE, isBasement, layerList, autoMap, remember, cleanRemembered, rolesUsed, isClosed } from './mapping.js?v=20261015';
import { buildModel, evaluate, coverIds, defaultHmax, EXAMPLE_TERMS, DEFAULT_STOREY } from './rules.js?v=20261015';
import { summaryRows, scheduleRows, coordTables, summaryTsv, scheduleTsv, coordsTsv, workbookFor, xlsxName, markText, articleText, plain, formatParams, levelName } from './tables.js?v=20261015';
import { createDrawing, ROLE_COLORS } from './drawing.js?v=20261015';
import { parseTerm, termsFromStorage, sizeBucket, formatOf, unionKey } from './state.js?v=20261015';

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
  makeWorker: () => new Worker(new URL('../dwg/worker.js?v=20261015', import.meta.url), { type: 'module' }),
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
  $('cpXlsx').disabled = !!blocked || state.union.pending;
  $('cpPrint').disabled = !!blocked;
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
  if (!ev || ev.blocked) return;
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
```

Run: `node _tests/extract.mjs $PLAN js/coverage/ui.js && node --check js/coverage/ui.js && echo syntax-ok`
Expected: `wrote js/coverage/ui.js (589 lines)`, then `syntax-ok`.

- [ ] **Step 3: Try it**

Open `http://127.0.0.1:8765/coverage-precheck.html?lang=en` and click **Load example**. The engine banner counts up once. Then:
- step 1 lists the template layers already mapped;
- step 2 is filled with the example's terms (spec §12);
- the summary reads plot `500.00 m²`, coverage `150.00 m² (30.00%) ✓`, δόμηση total `310.00 m² (ΣΔ 0.62) ✓`, volume `1,380.00 m³`;
- the drawing shows the plot, the coverage outline with its four numbered vertices, and the four levels side by side.

Task 13 checks the rest.

- [ ] **Step 4: Commit**

```bash
git add js/coverage/ui.js
git commit -F - <<'EOF'
Coverage pre-check: the controller

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 12: Site links, and the checks on strings and the page

Changed existing files (given whole below):
- `free-tools.html` adds 16 lines: a page-scoped `<style>` (ruling 20), the card in "Engineering offices", and `ft.coverage.title` and `ft.coverage.text` in el/en/it;
- `sitemap.xml` adds a 6-line entry (with the `lastmod` placeholder `2026-10-15`);
- `llms.txt` adds 1 line.

**Files:**
- Modify: `free-tools.html`, `sitemap.xml`, `llms.txt`
- Test: `_tests/coverage/site.test.js`, `_tests/coverage/i18n.test.js`

**Interfaces:**
- Produces:
  - The card `<a class="ft-card" href="coverage-precheck.html">`. The existing test `tools index: every key it uses exists in el, en and it` in `_tests/gcode/i18n.test.js` covers its keys.
  - `site.test.js` checks the index, the sitemap and llms.txt; the page's devDept notice and disclaimer; the page's consent, GA and switcher against DWG quantities'; and the `?v=` placeholders.
  - `i18n.test.js` checks key and placeholder parity, the computed keys, the literal keys in the modules and the page, the Italian ’, the Greek terms in EN/IT, and the page's inline Greek.

- [ ] **Step 1: Write the failing tests**

<!-- file: _tests/coverage/site.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout has CRLF

test('the tools index, the sitemap and llms.txt list the coverage pre-check', () => {
  const ft = read('../../free-tools.html');
  assert.ok(ft.includes('<a class="ft-card" href="coverage-precheck.html">'));
  const eng = ft.slice(ft.indexOf('data-i18n="ft.group.eng"'), ft.indexOf('</section>', ft.indexOf('data-i18n="ft.group.eng"')));
  assert.ok(eng.includes('href="coverage-precheck.html"'), 'in the Engineering offices group');
  assert.equal(ft.split('"ft.coverage.title":').length - 1, 3, 'one card title per language');
  assert.equal(ft.split('"ft.coverage.text":').length - 1, 3, 'one card text per language');
  assert.ok(/<style>[\s\S]*\.ft-groups \.ft-cards \{ align-content: start; \}[\s\S]*<\/style>/.test(ft), 'the page-scoped rule that keeps a single card at its own height');
  assert.ok(!read('../../css/tools.css').includes('align-content: start'), 'not in the shared stylesheet');
  assert.ok(read('../../sitemap.xml').includes('<loc>https://www.aidedcam.com/coverage-precheck.html</loc>'));
  assert.ok(read('../../llms.txt').includes('- Coverage diagram pre-check (https://www.aidedcam.com/coverage-precheck.html)'));
});

test('the page carries the devDept notice verbatim, the disclaimer, and loads no engine up front', () => {
  const page = read('../../coverage-precheck.html');
  assert.ok(page.includes('Portion of copyright © devDept Software S.r.l. All Rights Reserved.'));
  assert.ok(page.includes('Ενδεικτικός προέλεγχος — όχι επίσημος υπολογισμός.'));
  assert.ok(!/src="[^"]*engine\//.test(page), 'the engine loads in the worker, on the first file');
  assert.ok(page.includes('<link rel="canonical" href="https://www.aidedcam.com/coverage-precheck.html" />'));
});

test('consent, GA and the language switcher are those of the DWG quantities page', () => {
  const a = read('../../dwg-quantities.html'), b = read('../../coverage-precheck.html');
  const between = (s, from, to) => s.slice(s.indexOf(from), s.indexOf(to, s.indexOf(from)));
  // The GA loader in the head, the consent markup, and the script from setLanguage to the end of the consent code.
  for (const [from, to] of [['<!-- Google Analytics', '</script>'], ['<!-- COOKIE CONSENT BANNER', '  <script src='], ['    // The tool\'s strings first', '  </script>'], ['<div class="lang-switcher">', '</div>']]) {
    const x = between(a, from, to).replace('DQ_I18N', 'XX_I18N'), y = between(b, from, to).replace('CP_I18N', 'XX_I18N');
    assert.ok(x.length > 20, from);
    assert.equal(y, x, from);
  }
  // The cookie and footer strings are the same in every language.
  const strings = s => [...s.matchAll(/"(cookie_[a-z_]+|footer\.[a-z_]+)": "([^"]*)"/g)].map(m => m[0]).join('\n');
  assert.equal(strings(b), strings(a));
});

test('every new asset URL carries the deploy placeholder', () => {
  const page = read('../../coverage-precheck.html');
  for (const u of ['css/tools.css?v=20261015', 'js/coverage/i18n-coverage.js?v=20261015', 'js/coverage/ui.js?v=20261015']) assert.ok(page.includes(u), u);
  const ui = read('../../js/coverage/ui.js');
  for (const m of ui.matchAll(/from '(\.[^']+)'/g)) if (!m[1].includes('/gcode/shell/')) assert.ok(m[1].endsWith('?v=20261015'), m[1]);
  assert.ok(ui.includes("'../dwg/worker.js?v=20261015'"));
  assert.ok(read('../../js/dwg/worker.js').includes("'./engine/dotnet.js?v=20261015'"), 'the republished engine');
});
```

<!-- file: _tests/coverage/i18n.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { ROLES, LEVELS } from '../../js/coverage/mapping.js';
import { ARTICLES } from '../../js/coverage/rules.js';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const ph = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');

function toolStrings() {
  const window = {};
  vm.runInNewContext(read('../../js/coverage/i18n-coverage.js'), { window });
  return window.CP_I18N;
}

// Ids that reach the strings through a computed key.
const WARNINGS = ['open', 'bad', 'no-level', 'balcony-far', 'units-check', 'sk-high', 'no-cover', 'union-failed', 'no-levels', 'pilotis-small', 'attic-alone', 'bsmt-not-basement', 'not-egsa'];
const ERRORS = ['read', 'version', 'limit', 'timeout', 'engine', 'empty', 'blank', 'nooutlines'];
const NOTES = ['bsmt-half', 'in-basement', 'bsmt-rest', 'in-attic', 'attic-stair', 'attic-half', 'pilotis-ok', 'pilotis-small', 'mezz', 'balcony', 'bsmt-not-basement', 'capsUnchecked', 'parking'];
const UNITS = ['mm', 'cm', 'm', 'inch', 'ft'];

test('tool strings: only cp.* keys, the same keys and placeholders in el, en and it', () => {
  const s = toolStrings();
  const en = Object.keys(s.en).sort();
  assert.ok(en.length >= 200, `${en.length} keys`);
  assert.ok(en.every(k => k.startsWith('cp.')));
  assert.deepEqual(Object.keys(s.el).sort(), en);
  assert.deepEqual(Object.keys(s.it).sort(), en);
  for (const k of en) {
    assert.equal(ph(s.el[k]), ph(s.en[k]), `el ${k}`);
    assert.equal(ph(s.it[k]), ph(s.en[k]), `it ${k}`);
    for (const l of ['el', 'en', 'it']) assert.ok(String(s[l][k]).trim().length > 0, `${l} ${k} is empty`);
  }
});

test('every computed key has a string in every language', () => {
  const s = toolStrings();
  const keys = [
    ...WARNINGS.map(id => `cp.warn.${id}`), ...ERRORS.map(id => `cp.err.${id}`), ...NOTES.map(id => `cp.note.${id}`),
    ...[...ROLES, 'basementRest', 'atticRest'].map(r => `cp.role.${r}`), ...LEVELS.map(lv => `cp.level.${lv}`),
    ...Object.keys(ARTICLES).map(a => `cp.art.${a}`), ...UNITS.map(u => `cp.unit.${u}`),
    ...['file', 'setting', 'assumed', 'override'].map(u => `cp.units.src.${u}`),
    ...['ydom', 'sworn'].map(b => `cp.block.${b}`), ...['plot-missing', 'plot-many'].map(b => `cp.block.${b}`),
  ];
  for (const k of keys) for (const l of ['el', 'en', 'it']) assert.ok(k in s[l], `${l} missing ${k}`);
});

test('every literal cp.* key the modules and the page use exists', () => {
  const s = toolStrings();
  const dir = new URL('../../js/coverage/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'i18n-coverage.js').map(f => readFileSync(new URL(f, dir), 'utf8'));
  files.push(read('../../coverage-precheck.html'));
  let used = 0;
  for (const src of files) {
    for (const m of src.matchAll(/['"`](cp\.[A-Za-z0-9.-]+[A-Za-z0-9])['"`]/g)) { used++; assert.ok(m[1] in s.en, `${m[1]} has no string`); }
  }
  assert.ok(used >= 80, `${used} keys found`);
});

test('the Italian uses the typographic apostrophe', () => {
  const s = toolStrings();
  for (const [k, v] of Object.entries(s.it)) assert.ok(!v.includes("'"), `it ${k} has a straight apostrophe`);
});

test('Greek legal terms stay in Greek in the English and Italian roles and figures', () => {
  const s = toolStrings();
  for (const k of ['cp.role.plot', 'cp.role.cover', 'cp.role.semiopen', 'cp.role.pilotis', 'cp.fig.coverage', 'cp.fig.total', 'cp.block.sworn']) {
    for (const l of ['en', 'it']) assert.ok(/[Ͱ-Ͽ]/.test(s[l][k]), `${l} ${k}: ${s[l][k]}`);
  }
});

test('the page carries the Greek strings inline, as the page starts in Greek', () => {
  const s = toolStrings();
  const page = read('../../coverage-precheck.html');
  for (const m of page.matchAll(/data-i18n="(cp\.[^"]+)"[^>]*>([^<]*)</g)) assert.equal(m[2], s.el[m[1]], m[1]);
});
```

Run:
```bash
node _tests/extract.mjs $PLAN _tests/coverage/site.test.js && node _tests/extract.mjs $PLAN _tests/coverage/i18n.test.js
node --test "_tests/coverage/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
```
Expected: `ℹ pass 63`, `ℹ fail 1`. The failing test is `the tools index, the sitemap and llms.txt list the coverage pre-check`; the page, strings and placeholder tests already pass.

- [ ] **Step 2: Write the three files**

<!-- file: free-tools.html -->
```html
<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AidedCAM - Δωρεάν εργαλεία</title>
  <meta name="description" content="Δωρεάν εργαλεία για μηχανικούς και προγραμματιστές CNC: προβολή G-code τόρνου και φρέζας με χρόνο κύκλου, έλεγχος DXF για κοπή laser και επιμετρήσεις από DWG. Στον browser, χωρίς εγγραφή." />
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
  <link rel="stylesheet" href="css/tools.css?v=20260929" />
  <style>
    /* This page only: a group with one card beside a group with two keeps its card at its own height
       instead of stretching it to the taller group (the shared .ft-cards grid stretches its row). */
    .ft-groups .ft-cards { align-content: start; }
  </style>
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
      <h1 data-i18n="ft.title">Δωρεάν εργαλεία για μηχανικούς και παραγωγή</h1>
      <p class="gv-lede" data-i18n="ft.lede">Ανοίγουν αμέσως στον browser, χωρίς εγκατάσταση και χωρίς εγγραφή. Τα αρχεία σας δεν φεύγουν ποτέ από τον υπολογιστή σας.</p>
    </header>

    <div class="gv-wrap">
      <section class="ft-groups">
        <div class="ft-group is-wide">
          <h2 class="gv-eyebrow ft-group-title" data-i18n="ft.group.cnc">Προγραμματισμός CNC</h2>
          <div class="ft-cards">
            <a class="ft-card" href="gcode-viewer.html">
              <h3 data-i18n="ft.lathe.title">Προβολή G-code τόρνου</h3>
              <p data-i18n="ft.lathe.text">Τα περάσματα που κάνουν οι κύκλοι G70–G76 και G90/G92/G94, ο χρόνος κύκλου ανά εργαλείο και τα συνηθισμένα λάθη προγραμματισμού.</p>
              <span class="ft-open" data-i18n="ft.open">Άνοιγμα →</span>
            </a>
            <a class="ft-card" href="milling-gcode-viewer.html">
              <h3 data-i18n="ft.mill.title">Προβολή G-code φρέζας</h3>
              <p data-i18n="ft.mill.text">Κάθε κίνηση σε 3D, οι κύκλοι διάτρησης, βηματικής διάτρησης και κολαούζου αναλυμένοι σε κινήσεις, ο χρόνος ανά εργαλείο και έλεγχοι προγράμματος.</p>
              <span class="ft-open" data-i18n="ft.open">Άνοιγμα →</span>
            </a>
          </div>
        </div>
        <div class="ft-group">
          <h2 class="gv-eyebrow ft-group-title" data-i18n="ft.group.sheet">Λαμαρίνα και laser</h2>
          <div class="ft-cards">
            <a class="ft-card" href="laser-dxf-checker.html">
              <h3 data-i18n="ft.laser.title">Έλεγχος DXF για κοπή laser</h3>
              <p data-i18n="ft.laser.text">Διορθώνει τα DXF και DWG μιας παραγγελίας (κενά, διπλές γραμμές, ανοιχτά περιγράμματα) και δίνει μήκος κοπής, διατρήσεις, βάρος, χρόνο και καθαρό DXF για το laser.</p>
              <span class="ft-open" data-i18n="ft.open">Άνοιγμα →</span>
            </a>
          </div>
        </div>
        <div class="ft-group">
          <h2 class="gv-eyebrow ft-group-title" data-i18n="ft.group.eng">Γραφεία μηχανικών</h2>
          <div class="ft-cards">
            <a class="ft-card" href="dwg-quantities.html">
              <h3 data-i18n="ft.dwgq.title">Επιμετρήσεις από DWG</h3>
              <p data-i18n="ft.dwgq.text">Μήκη, εμβαδά και εμβαδά διαγράμμισης ανά στρώση, πλήθος μπλοκ και πίνακες χαρακτηριστικών (π.χ. κουφώματα) από αρχεία DWG και DXF, με το σχέδιο για επιβεβαίωση και λήψη σε Excel.</p>
              <span class="ft-open" data-i18n="ft.open">Άνοιγμα →</span>
            </a>
            <a class="ft-card" href="coverage-precheck.html">
              <h3 data-i18n="ft.coverage.title">Προέλεγχος διαγράμματος κάλυψης</h3>
              <p data-i18n="ft.coverage.text">Κάλυψη, δόμηση, όγκος, φύτευση και συντεταγμένες ΕΓΣΑ87 από το DWG ή DXF της άδειας, απέναντι στους όρους δόμησης και με το άρθρο του Κώδικα σε κάθε μέγεθος. Ενδεικτικός προέλεγχος.</p>
              <span class="ft-open" data-i18n="ft.open">Άνοιγμα →</span>
            </a>
          </div>
        </div>
      </section>

      <section class="gv-cta">
        <h2 data-i18n="gv.cta.title">Χρειάζεστε εργαλεία φτιαγμένα για τη δική σας δουλειά;</h2>
        <p data-i18n="gv.cta.text">Φτιάχνουμε λογισμικό στα μέτρα σας για μηχανικούς και παραγωγή: αυτοματισμούς CAD, CAM και BIM, post-processor και εργαλεία σαν αυτά.</p>
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
        "ft.title": "Δωρεάν εργαλεία για μηχανικούς και παραγωγή",
        "ft.group.cnc": "Προγραμματισμός CNC",
        "ft.group.sheet": "Λαμαρίνα και laser",
        "ft.group.eng": "Γραφεία μηχανικών",
        "ft.lede": "Ανοίγουν αμέσως στον browser, χωρίς εγκατάσταση και χωρίς εγγραφή. Τα αρχεία σας δεν φεύγουν ποτέ από τον υπολογιστή σας.",
        "ft.lathe.title": "Προβολή G-code τόρνου",
        "ft.lathe.text": "Τα περάσματα που κάνουν οι κύκλοι G70–G76 και G90/G92/G94, ο χρόνος κύκλου ανά εργαλείο και τα συνηθισμένα λάθη προγραμματισμού.",
        "ft.mill.title": "Προβολή G-code φρέζας",
        "ft.mill.text": "Κάθε κίνηση σε 3D, οι κύκλοι διάτρησης, βηματικής διάτρησης και κολαούζου αναλυμένοι σε κινήσεις, ο χρόνος ανά εργαλείο και έλεγχοι προγράμματος.",
        "ft.laser.title": "Έλεγχος DXF για κοπή laser",
        "ft.laser.text": "Διορθώνει τα DXF και DWG μιας παραγγελίας (κενά, διπλές γραμμές, ανοιχτά περιγράμματα) και δίνει μήκος κοπής, διατρήσεις, βάρος, χρόνο και καθαρό DXF για το laser.",
        "ft.dwgq.title": "Επιμετρήσεις από DWG",
        "ft.dwgq.text": "Μήκη, εμβαδά και εμβαδά διαγράμμισης ανά στρώση, πλήθος μπλοκ και πίνακες χαρακτηριστικών (π.χ. κουφώματα) από αρχεία DWG και DXF, με το σχέδιο για επιβεβαίωση και λήψη σε Excel.",
        "ft.coverage.title": "Προέλεγχος διαγράμματος κάλυψης",
        "ft.coverage.text": "Κάλυψη, δόμηση, όγκος, φύτευση και συντεταγμένες ΕΓΣΑ87 από το DWG ή DXF της άδειας, απέναντι στους όρους δόμησης και με το άρθρο του Κώδικα σε κάθε μέγεθος. Ενδεικτικός προέλεγχος.",
        "ft.open": "Άνοιγμα →",
        "gv.cta.title": "Χρειάζεστε εργαλεία φτιαγμένα για τη δική σας δουλειά;",
        "gv.cta.text": "Φτιάχνουμε λογισμικό στα μέτρα σας για μηχανικούς και παραγωγή: αυτοματισμούς CAD, CAM και BIM, post-processor και εργαλεία σαν αυτά.",
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
        "ft.title": "Free tools for engineering and manufacturing",
        "ft.group.cnc": "CNC programming",
        "ft.group.sheet": "Sheet metal and laser",
        "ft.group.eng": "Engineering offices",
        "ft.lede": "They open instantly in your browser, with no install and no sign-up. Your files never leave your computer.",
        "ft.lathe.title": "Lathe G-code viewer",
        "ft.lathe.text": "The passes that G70–G76 and G90/G92/G94 cycles really make, cycle time per tool, and common programming mistakes.",
        "ft.mill.title": "Milling G-code viewer",
        "ft.mill.text": "Every move in 3D, drilling, peck and tapping cycles expanded into their moves, time per tool, and program checks.",
        "ft.laser.title": "Laser DXF check",
        "ft.laser.text": "Repairs the DXF and DWG files of an order (gaps, doubled lines, open contours) and gives cut length, pierces, weight, time and a clean DXF for the laser.",
        "ft.dwgq.title": "Quantities from DWG",
        "ft.dwgq.text": "Lengths, areas and hatch areas per layer, block counts and attribute schedules (doors, windows) from DWG and DXF files, with the drawing to check them and an Excel download.",
        "ft.coverage.title": "Coverage diagram pre-check",
        "ft.coverage.text": "Coverage, built floor area (δόμηση), volume, planting and ΕΓΣΑ87 coordinates from a Greek permit's DWG or DXF, against the zone's terms, with the Code article for every figure. An indicative pre-check.",
        "ft.open": "Open →",
        "gv.cta.title": "Need tools built around your own work?",
        "gv.cta.text": "We build tailor-made software for engineering and manufacturing: CAD, CAM and BIM automation, post-processors and tools like these.",
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
        "ft.title": "Strumenti gratuiti per l’ingegneria e la produzione",
        "ft.group.cnc": "Programmazione CNC",
        "ft.group.sheet": "Lamiera e laser",
        "ft.group.eng": "Studi di ingegneria",
        "ft.lede": "Si aprono subito nel browser, senza installazione e senza registrazione. I vostri file non lasciano mai il vostro computer.",
        "ft.lathe.title": "Visualizzatore G-code per tornio",
        "ft.lathe.text": "Le passate che i cicli G70–G76 e G90/G92/G94 eseguono davvero, il tempo ciclo per utensile e gli errori di programmazione più comuni.",
        "ft.mill.title": "Visualizzatore G-code per fresa",
        "ft.mill.text": "Ogni movimento in 3D, i cicli di foratura, foratura a tratti e maschiatura scomposti in movimenti, il tempo per utensile e i controlli del programma.",
        "ft.laser.title": "Controllo DXF per taglio laser",
        "ft.laser.text": "Corregge i file DXF e DWG di un ordine (interruzioni, linee doppie, contorni aperti) e fornisce lunghezza di taglio, sfondamenti, peso, tempo e un DXF pulito per il laser.",
        "ft.dwgq.title": "Computi da DWG",
        "ft.dwgq.text": "Lunghezze, aree e aree dei tratteggi per layer, conteggio dei blocchi e tabelle degli attributi (porte, finestre) da file DWG e DXF, con il disegno per verificarle e il download in Excel.",
        "ft.coverage.title": "Pre-verifica del diagramma di copertura",
        "ft.coverage.text": "Copertura, superficie edificata (δόμηση), volume, verde e coordinate ΕΓΣΑ87 dal DWG o DXF di un permesso greco, a confronto con i parametri della zona, con l’articolo del Codice per ogni grandezza. Una pre-verifica indicativa.",
        "ft.open": "Apri →",
        "gv.cta.title": "Vi servono strumenti costruiti sul vostro lavoro?",
        "gv.cta.text": "Realizziamo software su misura per l’ingegneria e la produzione: automazioni CAD, CAM e BIM, post-processor e strumenti come questi.",
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

<!-- file: sitemap.xml -->
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.aidedcam.com/</loc>
    <lastmod>2026-09-23</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://www.aidedcam.com/what-you-gain.html</loc>
    <lastmod>2026-09-23</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://www.aidedcam.com/calculator.html</loc>
    <lastmod>2026-09-23</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://www.aidedcam.com/gcode-viewer.html</loc>
    <lastmod>2026-09-27</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.aidedcam.com/milling-gcode-viewer.html</loc>
    <lastmod>2026-09-27</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.aidedcam.com/free-tools.html</loc>
    <lastmod>2026-09-28</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://www.aidedcam.com/laser-dxf-checker.html</loc>
    <lastmod>2026-09-28</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.aidedcam.com/dwg-quantities.html</loc>
    <lastmod>2026-09-28</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.aidedcam.com/coverage-precheck.html</loc>
    <lastmod>2026-10-15</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
```

<!-- file: llms.txt -->
```text
# AidedCAM

> Custom, tailor-made software built for one company's needs, with automation applied where time and money are lost.
> Runs inside the CAD/CAM/BIM tools a company already uses, or as the company's own desktop application.
> Autodesk Authorized Developer. Based in Greece (Athens, Thessaloniki).
> Serves companies in Greece, Italy, Belgium, Switzerland, Austria, Germany.

## What we build (so far it has taken three forms)
- Task automation: a manual, multi-step job becomes one button, in the company's own order, rules and standards
- Management, from Excel to a live picture: estimates, schedules, workload and time tracking move from Excel files into one shared application everyone sees and updates
- Special CAD/CAM/BIM solutions: add-ins inside PowerMill, PowerShape, Revit and other systems, or standalone design and machine-programming applications

## Built so far (anonymised)
- Lathe machine shop: a standalone CAD/CAM application, from DXF drawing to Fanuc G-code in six steps (2 days -> 12 min of design and programming)
- Mould making: automation inside PowerShape and PowerMill, routing plan per phase, cooling/screw/plate holes with one button (4 days -> 26 min per mould plate)
- Industrial equipment, BIM department: forty Revit commands in one ribbon tab, sheet export to PDF/DWG/DWFX/IFC in one run (1 day -> 11 min for drawings and schedules)
- Structural engineering office: estimation, Gantt schedule, workload and time tracking on one shared database, replacing dozens of Excel files

## Free tools
- Free tools index (https://www.aidedcam.com/free-tools.html): all free AidedCAM tools on one page.
- Lathe G-code viewer (https://www.aidedcam.com/gcode-viewer.html): runs in the browser, nothing is uploaded; draws the passes Fanuc canned cycles G70-G76 and G90/G92/G94 generate, estimates cycle time per tool, and flags common programming mistakes. Greek, English, Italian.
- Milling G-code viewer (https://www.aidedcam.com/milling-gcode-viewer.html): runs in the browser, nothing is uploaded; draws every move of a 3-axis Fanuc/Haas program in 3D, expands the drilling, peck, tapping and boring cycles G73/G74/G76/G81-G89 into their moves (G76/G87/G88 simplified), estimates cycle time per tool, and flags common programming mistakes. Greek, English, Italian.
- Laser DXF check (https://www.aidedcam.com/laser-dxf-checker.html): runs in the browser, nothing is uploaded; reads a whole order of DXF and DWG files (up to the 2018 format), closes small gaps, removes doubled lines, finds open contours, splits cut/mark/bend layers, and gives cut length, pierces, net area, weight and cutting time per part and for the order, plus a clean R12 DXF for the laser. Geometry engine: Eyeshot (devDept Software). Greek, English, Italian.
- DWG quantities (https://www.aidedcam.com/dwg-quantities.html): runs in the browser, nothing is uploaded; reads DWG and DXF files (up to the 2018 format), several at once, and gives per layer the lengths of lines, arcs, polylines and splines, the areas of closed outlines and of hatches (islands subtracted), block counts by name (dynamic blocks under their own name, nested blocks counted) and block-attribute schedules such as door and window tables, with the drawing to check what was counted, selection totals, and an Excel (.xlsx) download. Geometry engine: Eyeshot (devDept Software). Greek, English, Italian.
- Coverage diagram pre-check (https://www.aidedcam.com/coverage-precheck.html): runs in the browser, nothing is uploaded; reads the DWG or DXF of a Greek building permit whose layers the visitor maps to roles (plot, coverage, level outlines, semi-open spaces, balconies, stairs, voids, pilotis, planting; layers named after the published AidedCAM template map themselves) and computes the figures of the coverage diagram (διάγραμμα κάλυψης) against the typed zone terms: plot area, coverage as the union of the outlines, built floor area (δόμηση) per level with the Code 206 §6 exclusions and caps, the semi-open and balcony caps, volume, height, planting, an area schedule and the ΕΓΣΑ87 vertex tables of plot and building, each figure with its article of Ν.5306/2026. An indicative pre-check, not an official calculation; Excel (.xlsx), copy and print. Geometry engine: Eyeshot (devDept Software). Greek, English, Italian.

## What every engagement includes
- Requirements analysis, development, testing, installation, training, bug fixes, new features and ongoing support

## Supported Software (8 CAD / CAM / BIM systems)
- Autodesk PowerShape (CAD)
- Autodesk PowerMill (CAM)
- Autodesk Fusion 360 (CAD/CAM)
- Autodesk FeatureCAM (CAM)
- Autodesk Inventor (CAD)
- Autodesk Revit (BIM)
- Autodesk AutoCAD (CAD)
- Siemens NX (CAD/CAM)
- TopSolid (coming soon)
- Standalone solutions via DevDept (no third-party CAD/CAM required)

## Process
1. Workflow analysis - map every production step
2. Solution design - decide what the solution must do and where automation pays off
3. Tool development - build custom software
4. Integration and testing - install and fine-tune
5. Training and support - onboard the team

## Key Facts
- Measured on delivered solutions: 2 days -> 12 min from DXF drawing to lathe program, 4 days -> 26 min per mould plate, 1 day -> 11 min for Revit drawings and schedules
- Projects in 5 countries
- 100% custom-built solutions
- Zero dependency on individual operators

## Contact
- Email: info@aidedcam.com
- Athens: +30 6984680874
- Thessaloniki: +30 6980818754
- Website: https://www.aidedcam.com
```

Run:
```bash
for f in free-tools.html sitemap.xml llms.txt; do node _tests/extract.mjs $PLAN $f; done
git diff --stat
```
Expected: `free-tools.html | 16 +`, `llms.txt | 1 +`, `sitemap.xml | 6 +`: 23 insertions, no deletions. Git may warn that LF will be replaced by CRLF; that is the checkout's `core.autocrlf`, and harmless.

- [ ] **Step 3: Run everything**

Run: `node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js" "_tests/laser/*.test.js" "_tests/dwg/*.test.js" "_tests/coverage/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 404`, `ℹ fail 0`.

- [ ] **Step 4: Commit**

```bash
git add free-tools.html sitemap.xml llms.txt _tests/coverage/site.test.js _tests/coverage/i18n.test.js
git commit -F - <<'EOF'
Coverage pre-check: tools index card, sitemap and llms.txt; string and page checks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 13: Browser verification

**Files:**
- Create: `_tests/coverage/browser-check.js` (dev-only; committed so the checks can be rerun after any change)

The checks are one Playwright function. The server from Task 6 must be running on port 8765.

- [ ] **Step 1: Write the check**

<!-- file: _tests/coverage/browser-check.js -->
```js
// Dev-only browser check of coverage-precheck.html (Jekyll skips _tests). It is one Playwright function: run it
// with the Playwright MCP (browser_run_code_unsafe, filename: _tests/coverage/browser-check.js) or with
// node _tests/coverage/browser-check.cjs. It expects the repo root served on http://127.0.0.1:8765/ and returns
// { pass, fail, checks: [{ name, ok, got }] }.
async (page) => {
  const BASE = 'http://127.0.0.1:8765/';
  const checks = [];
  const check = (name, ok, got) => checks.push({ name, ok: !!ok, got });
  const errors = [], external = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.clearBrowserCache');                           // a cached old module would hide a fix

  const cells = key => page.$eval(`#cpSummary tr[data-key="${key}"]`, tr => [...tr.cells].map(c => c.innerText.trim().replace(/\s+/g, ' ')));
  const ready = () => page.waitForFunction(() => !document.querySelector('#cpPanel').hidden && !document.querySelector('#cpXlsx').disabled && document.querySelector('#cpBusy').hidden, null, { timeout: 60000 });
  const timings = () => page.evaluate(() => ({ ...window.__covp.timings }));

  // 0. The engine's union in the browser matches the hand-worked cases.
  await page.goto(BASE + '_tests/coverage/union.html');
  await page.waitForFunction(() => window.__union, null, { timeout: 120000 });
  const union = await page.evaluate(() => ({ ...window.__union, ms: window.__timings }));
  check(`union parity: overlap, touch, frame with a hole, arc, survey coordinates, 50 outlines (${union.ms.MANY} ms), stale file`, union.cases === 6 && union.failed === 0 && union.ms.MANY < 1000, union);

  // 1. The page paints without the engine.
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto(BASE + 'coverage-precheck.html?lang=en');
  check('title', (await page.title()) === 'AidedCAM - Coverage diagram pre-check', await page.title());
  const early = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => e.name.includes('/engine/')).length);
  check('no engine before the first file', early === 0, early);
  const decline = await page.$('#privacyDecline');
  if (decline && await decline.isVisible()) await decline.click();

  // 2. The example: every summary figure of spec §12.
  await page.click('#cpExample');
  await ready();
  const want = {
    plot: ['—', '500.00 m²', ''],
    coverage: ['300.00 m² (60%)', '150.00 m² (30.00%)', '✓'],
    uncovered: ['—', '350.00 m²', ''],
    'level-B1': ['—', '0.00 m²', ''], 'level-00': ['—', '110.00 m²', ''], 'level-01': ['—', '100.00 m²', ''], 'level-02': ['—', '90.00 m²', ''],
    semi: ['80.00 m²', '90.00 m²', '✗'],
    semiBalc: ['160.00 m²', '120.00 m²', '✓'],
    total: ['400.00 m² (ΣΔ 0.80)', '310.00 m² (ΣΔ 0.62)', '✓'],
    volume: ['2,000.00 m³ (σ.ο. 4.00)', '1,380.00 m³ (σ.ο. 2.76)', '✓'],
    height: ['11.00 + 2.00 m', '9.60 + 1.50 m', '✓'],
    planting: ['133.33 m² (⅔ × 200.00)', '140.00 m²', '✓'],
  };
  for (const [key, [perm, prop, mark]] of Object.entries(want)) {
    const c = await cells(key);
    check(`example ${key}: ${perm} | ${prop} | ${mark}`, c[1] === perm && c[2] === prop && c[3] === mark, c);
  }
  check('the semi-open overflow of 10.00 counts', (await cells('semi'))[0].includes('overflow 10.00 m² counts'), await cells('semi'));
  check('every figure cites its article', (await cells('coverage'))[4] === 'Code 207 (ΝΟΚ 12)' && (await cells('volume'))[4] === 'Code 208 (ΝΟΚ 13)', await cells('coverage'));
  const warn = await page.$eval('#cpWarnings', e => e.innerText);
  check('the open outline on the planting layer is listed', warn.includes('Open outline on layer AC_GREEN'), warn);
  const plotXY = await page.$$eval('#cpPlotCoords tbody tr', trs => trs.map(tr => tr.innerText.replace(/\s+/g, ' ').trim()));
  check('plot vertices in ΕΓΣΑ87, no grouping', plotXY[0] === '1 410000.00 4495000.00' && plotXY.length === 4, plotXY);
  const bXY = await page.$$eval('#cpBuildingCoords tbody tr', trs => trs.map(tr => tr.innerText.replace(/\s+/g, ' ').trim()));
  check('building vertices from the union', bXY.length === 4 && bXY[0] === '1 410000.00 4495010.00', bXY);
  check('coordinates are georeferenced: no banner', await page.$eval('#cpNotEgsa', e => e.hidden), null);
  const t1 = await timings();
  check(`example: engine boot ${t1.boot} ms, file ${t1.file} ms, first union ${t1.union} ms`, t1.file < 3000, t1);

  // 3. Highlight both ways: a row lights its outlines, an outline lights its rows.
  await page.hover('#cpSummary tr[data-key="coverage"]');
  const litByRow = await page.evaluate(() => window.__covp.drawing.highlighted);
  check('hovering the coverage row lights the coverage outline', litByRow.length === 1, litByRow);
  await page.click('#cpFit');
  await page.$eval('#cpCanvas', c => c.scrollIntoView({ block: 'center' }));
  const pt = await page.evaluate(() => { const s = window.__covp.drawing.screenOf(410015, 4495020); const r = document.getElementById('cpCanvas').getBoundingClientRect(); return { x: r.x + s.x, y: r.y + s.y }; });
  await page.mouse.click(pt.x, pt.y);
  const lit = await page.$$eval('#cpSummary tbody tr.is-hi', trs => trs.map(tr => tr.dataset.key));
  check('clicking the plot lights the plot rows', lit.includes('plot') && lit.includes('uncovered') && !lit.includes('coverage'), lit);
  await page.mouse.click(pt.x, pt.y);

  // 4. A remap re-runs the rules at once, without the engine.
  await page.selectOption('#cpMap tr[data-layer="AC_SEMIOPEN"] select', 'ignore');
  await page.waitForFunction(() => document.querySelector('#cpSummary tr[data-key="total"]').innerText.includes('390.00'), null, { timeout: 5000 });
  const t2 = await timings();
  check('remap: semi-open ignored, δόμηση 390.00 (3 × 130), no overflow', (await cells('total'))[2] === '390.00 m² (ΣΔ 0.78)', await cells('total'));
  check(`remap under 50 ms (${t2.remap} ms), no engine call`, t2.remap < 50 && t2.union === t1.union, t2);
  await page.selectOption('#cpMap tr[data-layer="AC_SEMIOPEN"] select', 'semiopen');
  await page.waitForFunction(() => document.querySelector('#cpSummary tr[data-key="total"]').innerText.includes('310.00'), null, { timeout: 5000 });

  // 5. A changed coverage mapping asks the engine for a new union: coverage + planting touch along x = 10.
  await page.selectOption('#cpMap tr[data-layer="AC_GREEN"] select', 'cover');
  await page.waitForFunction(() => document.querySelector('#cpSummary tr[data-key="coverage"]').innerText.includes('290.00'), null, { timeout: 30000 });
  await ready();
  const t3 = await timings();
  const b8 = await page.$$eval('#cpBuildingCoords tbody tr', trs => trs.map(tr => tr.innerText.replace(/\s+/g, ' ').trim()));
  check('union of two touching outlines: 290.00 m², 8 vertices from the lowest one', b8.length === 8 && b8[0] === '1 410010.00 4495000.00', b8);
  check(`union on a remap under 1 s (${t3.union} ms)`, t3.union < 1000, t3);
  await page.selectOption('#cpMap tr[data-layer="AC_GREEN"] select', 'green');
  await page.waitForFunction(() => document.querySelector('#cpSummary tr[data-key="coverage"]').innerText.includes('150.00 m² (30.00%)'), null, { timeout: 30000 });
  await ready();

  // 6. A term: ΣΔ 1.2 lifts the caps (no overflow) and the permitted δόμηση.
  await page.fill('#cpSd', '1.2');
  await page.waitForFunction(() => document.querySelector('#cpSummary tr[data-key="total"]').innerText.includes('600.00'), null, { timeout: 5000 });
  check('ΣΔ 1.2: permitted 600.00, proposed 300.00 without overflow', (await cells('total'))[1] === '600.00 m² (ΣΔ 1.20)' && (await cells('total'))[2] === '300.00 m² (ΣΔ 0.60)', await cells('total'));
  check(`a term change under 50 ms (${(await timings()).term} ms)`, (await timings()).term < 50, await timings());
  await page.fill('#cpSd', '0.8');
  await page.waitForFunction(() => document.querySelector('#cpSummary tr[data-key="total"]').innerText.includes('310.00'), null, { timeout: 5000 });

  // 7. The .xlsx.
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#cpXlsx')]);
  check('xlsx name', dl.suggestedFilename() === 'coverage-example-permit.xlsx', dl.suggestedFilename());
  const chunks = []; for await (const c of await dl.createReadStream()) chunks.push(c);
  const bytes = Buffer.concat(chunks);
  const parts = {};
  for (let p = 0; bytes.readUInt32LE(p) === 0x04034b50;) {
    const size = bytes.readUInt32LE(p + 18), nl = bytes.readUInt16LE(p + 26), ex = bytes.readUInt16LE(p + 28);
    parts[bytes.slice(p + 30, p + 30 + nl).toString()] = bytes.slice(p + 30 + nl + ex, p + 30 + nl + ex + size).toString('utf8');
    p += 30 + nl + ex + size;
  }
  const sheets = [...(parts['xl/workbook.xml'] || '').matchAll(/<sheet name="([^"]*)"/g)].map(m => m[1]);
  check('xlsx sheets', sheets.join('|') === 'Summary|Schedule|Coordinates|Mapping', sheets);
  check('xlsx summary holds 310 and the disclaimer', (parts['xl/worksheets/sheet1.xml'] || '').includes('<v>310</v>') && parts['xl/worksheets/sheet1.xml'].includes('Indicative pre-check'), null);

  // 8. Copy uses the language's decimal separator and no grouping.
  await page.click('button[data-copy="summary"]');
  const tsvEn = await page.evaluate(() => navigator.clipboard.readText());
  check('copy (en): 2000.00 m³, tab-separated', tsvEn.includes('\t2000.00 m³ (σ.ο. 4.00)\t') && tsvEn.split('\r\n')[0].split('\t').length === 6, tsvEn.slice(0, 300));

  // 9. Greek and Italian.
  await page.click('.lang-btn[data-lang="el"]');
  check('Greek title', (await page.title()) === 'AidedCAM - Προέλεγχος διαγράμματος κάλυψης', await page.title());
  check('Greek decimal comma', (await cells('plot'))[2] === '500,00 m²', await cells('plot'));
  await page.click('button[data-copy="schedule"]');
  const tsvEl = await page.evaluate(() => navigator.clipboard.readText());
  check('copy (el): comma decimals', tsvEl.includes('\t310,00\t') && !tsvEl.includes('310.00'), tsvEl.slice(-200));
  await page.click('.lang-btn[data-lang="it"]');
  check('Italian title and figures', (await page.title()) === 'AidedCAM - Pre-verifica del diagramma di copertura' && (await cells('coverage'))[0].startsWith('Copertura (κάλυψη)') && (await cells('plot'))[2] === '500,00 m²', await cells('coverage'));
  await page.click('.lang-btn[data-lang="en"]');

  // 10. The units override: the example read as centimetres has a tiny plot and no ΕΓΣΑ87 coordinates.
  await page.selectOption('#cpStatus select', 'cm');
  await page.waitForFunction(() => document.querySelector('#cpWarnings').innerText.includes('check the drawing'), null, { timeout: 60000 });
  await ready();
  check('override cm: plot 0.05 m², units and ΕΓΣΑ87 warnings', (await cells('plot'))[2] === '0.05 m²' && !(await page.$eval('#cpNotEgsa', e => e.hidden)), await cells('plot'));
  await page.selectOption('#cpStatus select', '');
  await page.waitForFunction(() => document.querySelector('#cpSummary tr[data-key="plot"]') && document.querySelector('#cpSummary tr[data-key="plot"]').innerText.includes('500.00'), null, { timeout: 60000 });
  await ready();

  // 11. Print: controls gone, the disclaimer on every page.
  await page.emulateMedia({ media: 'print' });
  const pr = await page.evaluate(() => ({
    step: getComputedStyle(document.getElementById('cpStep1')).display,
    bar: getComputedStyle(document.querySelector('.cp-bar')).display,
    xlsx: getComputedStyle(document.querySelector('.cp-export')).display,
    disclaimer: getComputedStyle(document.querySelector('.cp-print-disclaimer')).position,
    figures: getComputedStyle(document.getElementById('cpSummary')).display,
  }));
  check('print: steps and buttons hidden, figures shown, disclaimer fixed on every page', pr.step === 'none' && pr.bar === 'none' && pr.xlsx === 'none' && pr.disclaimer === 'fixed' && pr.figures !== 'none', pr);
  const pdf = await page.pdf({ format: 'A4' });
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  check('print: an A4 PDF of a few pages', pages >= 2 && pages <= 8, pages);
  await page.emulateMedia({ media: 'screen' });

  // 12. Bad input: not a drawing, and a drawing without closed outlines.
  const lines = ['0', 'SECTION', '2', 'ENTITIES', '0', 'LINE', '8', 'A', '10', '0.0', '20', '0.0', '11', '5.0', '21', '0.0', '0', 'ENDSEC', '0', 'EOF', ''].join('\r\n');
  await page.setInputFiles('#cpInput', { name: 'lines.dxf', mimeType: 'application/octet-stream', buffer: Buffer.from(lines) });
  await page.waitForFunction(() => !document.querySelector('#cpError').hidden, null, { timeout: 20000 }).catch(async e => { throw new Error(JSON.stringify(await page.evaluate(() => ({ err: document.querySelector('#cpError').outerHTML, busy: document.querySelector('#cpBusy').outerHTML, panel: document.querySelector('#cpPanel').hidden, status: document.querySelector('#cpStatus').innerText })))); });
  check('no closed outlines: an error card, not empty tables', (await page.$eval('#cpError', e => e.textContent)).includes('No closed outlines') && await page.$eval('#cpPanel', e => e.hidden), await page.$eval('#cpError', e => e.textContent));
  await page.setInputFiles('#cpInput', { name: 'notes.dwg', mimeType: 'application/octet-stream', buffer: Buffer.from('hello, not a drawing') });
  await page.waitForFunction(() => document.querySelector('#cpError').textContent.includes('notes.dwg'), null, { timeout: 60000 });
  check('a file that is not a drawing says why', (await page.$eval('#cpError', e => e.textContent)).includes('does not read as a DWG or DXF'), await page.$eval('#cpError', e => e.textContent));

  // 13. The phone layout, in Greek.
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(BASE + 'coverage-precheck.html?lang=el');
  await page.click('#cpExample');
  await ready();
  const sw = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  check('375 px: no horizontal page scroll', sw[0] === sw[1], sw);
  const gutter = await page.$eval('.gv-wrap', e => parseFloat(getComputedStyle(e).paddingLeft));
  check('375 px: 16 px gutter', gutter === 16, gutter);

  // 14. The template download.
  const tpl = await page.evaluate(async () => { const r = await fetch(document.getElementById('cpTemplate').href); const b = new Uint8Array(await r.arrayBuffer()); return { ok: r.ok, size: b.length, name: document.getElementById('cpTemplate').getAttribute('download') }; });
  check('the layer template is served', tpl.ok && tpl.size > 1000 && tpl.name === 'aidedcam-layer-template.dxf', tpl);
  const tEnd = await timings();

  // 15. The tools index: the new card in Engineering offices, and the single laser card beside the two engineering
  // cards keeps its own height (page-scoped rule in free-tools.html), at desktop width and at 375 px.
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(BASE + 'free-tools.html?lang=en');
    const cards = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.ft-card')].map(a => [a.getAttribute('href'), Math.round(a.getBoundingClientRect().height)])));
    const scroll = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    const laser = cards['laser-dxf-checker.html'], dwg = cards['dwg-quantities.html'];
    check(`index at ${width} px: the coverage card is listed, the laser card is not stretched, no horizontal scroll`, 'coverage-precheck.html' in cards && laser <= Math.max(dwg, cards['coverage-precheck.html']) + 40 && scroll[0] === scroll[1], { cards, scroll });
    if (process.env && process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/ft-${width}.png`, fullPage: true });
  }

  // 16. Nothing external, no console errors.
  check('no external requests', external.length === 0, external);
  check('no console errors', errors.length === 0, errors);
  check(`timings ${JSON.stringify(tEnd)}`, true, null);
  return { pass: checks.filter(c => c.ok).length, fail: checks.filter(c => !c.ok).length, checks };
}
```

Run: `node _tests/extract.mjs $PLAN _tests/coverage/browser-check.js`

- [ ] **Step 2: Run it**

Run: `node _tests/coverage/browser-check.cjs`
(or, with the Playwright MCP: `browser_run_code_unsafe` with the file's text as `code`).

Expected: `52 passed, 0 failed`. The checks, in order:
0. union parity 6/6 with the stale file, 50 outlines under 1 s;
1. the English title; no engine request before the first file;
2. the example, row by row against spec §12:
   - plot `500.00 m²`; coverage `300.00 m² (60%) | 150.00 m² (30.00%) | ✓`; uncovered `350.00 m²`;
   - levels B1 `0.00`, ground `110.00`, floor 1 `100.00`, floor 2 `90.00`;
   - semi-open `80.00 | 90.00 | ✗` with the overflow of 10.00 counted, and semi-open + balconies `160.00 | 120.00 | ✓`;
   - total `400.00 m² (ΣΔ 0.80) | 310.00 m² (ΣΔ 0.62) | ✓`; volume `2,000.00 m³ (σ.ο. 4.00) | 1,380.00 m³ (σ.ο. 2.76) | ✓`;
   - height `11.00 + 2.00 m | 9.60 + 1.50 m | ✓`; planting `133.33 m² (⅔ × 200.00) | 140.00 m² | ✓`;
   - every figure cites its article; the open outline on the planting layer is listed; the plot vertices are in ΕΓΣΑ87 with no grouping; the building vertices come from the union; there is no georeference banner; the example's timings;
3. highlight both ways: hovering the coverage row lights its outline, and clicking the plot lights the plot rows;
4. remap:
   - with semi-open ignored, δόμηση reads 390.00 (3 × 130) with no overflow, under 50 ms and with no engine call;
   - the union of two touching outlines is `290.00 m²`, with 8 vertices from the lowest one, under 1 s;
   - with ΣΔ 1.2, permitted 600.00 and proposed 300.00 with no overflow, and a term change under 50 ms;
5. the .xlsx: its name, its four sheets, and a summary holding 310 and the disclaimer; copy (en) gives `2000.00` m³, tab-separated;
6. Greek: the title, the decimal comma, and copy (el) with comma decimals; Italian: the title and the figures;
7. overriding to cm gives plot `0.05 m²`, with the units and ΕΓΣΑ87 warnings;
8. print: the steps and buttons are hidden, the figures show, the disclaimer is fixed on every page, and the result is an A4 PDF of a few pages;
9. a drawing with no closed outlines gives an error card, not empty tables; a file that is not a drawing says why;
10. at 375 px: no horizontal page scroll, and a 16 px gutter;
11. the layer template is served;
12. the tools index at 1280 px and 375 px: the coverage card is listed, the laser card is not stretched, and there is no horizontal scroll;
13. no external requests, no console errors, and the timings.

- [ ] **Step 3: Look at it**

Take full-page screenshots at 1280 px (`?lang=en`) and 375 px (`?lang=el`) with the example loaded, and check by eye:
- the drawing shows the plot (brown), the coverage (blue tint, outlined strongly in black), the planting (green) with the open polyline dashed, and the four levels side by side with their semi-open spaces, stairs and balconies in their role colours;
- the building vertices are numbered 1–4 in black, and the plot's in brown (its fourth label sits under the building's 4, at the shared corner);
- at 375 px, the tables scroll inside their own boxes.

Also open `free-tools.html` at 1280 px: the laser card keeps its own height beside the two engineering cards.

- [ ] **Step 4: Commit**

```bash
git add _tests/coverage/browser-check.js
git commit -F - <<'EOF'
Coverage pre-check: browser check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

Stop the server afterwards (`netstat -ano | grep ":8765 .*LISTENING"` must print nothing).

---

### Task 14: Launch preparation (stop before any push)

**Files:**
- Create: `_docs/coverage-precheck/real-file-check.md`
- Modify, on deploy day only: every `?v=20261015` of this tool and of the republished engine; DWG quantities' `?v=20260928`; the sitemap `lastmod` `2026-10-15`

- [ ] **Step 1: The real-file record**

<!-- file: _docs/coverage-precheck/real-file-check.md -->
```markdown
# Real-file check: coverage diagram pre-check

Spec §11. Before launch, run 3–5 real permit drawings whose submitted coverage tables (διάγραμμα κάλυψης) Aris has
through the tool, and compare figure by figure. The files stay in the git-ignored `_tests/private/`; this record holds
figures and differences only: no office names, no file names, no addresses, no layer names and no coordinates.

How to run a file: open `coverage-precheck.html` on the local server and drop the file. Map its layers (or note that
they were template-named), type the zone terms and heights of the submitted diagram, and read the summary and the
schedule.

Also note, per file:
- the units: did the file state them correctly (if not: which units it was really drawn in, and whether the per-file
  units override fixed it)? Did the ΕΓΣΑ87 check pass?
- the coverage: were the footprints drawn as one outline or several (overlapping, touching)? Did the union agree with
  the submitted coverage, and did the building vertex table list only real corners?
- the vertices: do the plot and building vertex tables match the submitted ones in count, order and arcs (compare
  counts and the differences only; do not record coordinates)?
- the levels: were any spaces "not inside any level outline", or balconies farther than 0.50 m?
- the stairs, the attic (stair off first, ruling 19) and the pilotis (no volume when excluded, ruling 18): does the
  submitted diagram treat them the same way?
- open or self-crossing outlines: were any listed, and were they real drawing errors?
- a Greek-Excel paste of Copy: the numbers must land as numbers, not ×1000.

| # | Format / version | Entities | Units right? | Figure | Tool | Submitted | Diff | Notes |
|---|---|---|---|---|---|---|---|---|

Acceptance: plot area, coverage, δόμηση, volume and planting within 0.01 m² (0.01 m³) of the submitted table, or the
difference explained by a rule the submitted table applied differently (record which). Every warning the tool raised
names a real property of the file. Anything else is a bug to fix before launch.

Timing on the same machine (the browser's first file includes the engine start):

| # | Entities | Seconds to the mapping table |
|---|---|---|

Recorded by: (name), (date).
```

Run: `node _tests/extract.mjs $PLAN _docs/coverage-precheck/real-file-check.md`

- [ ] **Step 2: Deploy date**

The date strings stay `20261015` / `2026-10-15` until Aris names the deploy day.

Then this tool and DWG quantities must both be bumped. DWG quantities loads the republished engine through `js/dwg/ui.js` → `worker.js` → `engine/dotnet.js`, so its page must fetch the new `ui.js`:
```bash
sed -i 's/v=20261015/v=YYYYMMDD/g' coverage-precheck.html js/coverage/*.js js/dwg/ui.js js/dwg/worker.js _tests/coverage/site.test.js
sed -i 's/v=20260928/v=YYYYMMDD/g' dwg-quantities.html js/dwg/ui.js js/dwg/selection.js js/dwg/view.js js/dwg/xlsx.js
grep -rn "v=20261015\|v=20260928" coverage-precheck.html dwg-quantities.html js/coverage/*.js js/dwg/*.js    # must print nothing
sed -i 's#<lastmod>2026-10-15</lastmod>#<lastmod>YYYY-MM-DD</lastmod>#' sitemap.xml
```
`site.test.js` pins the placeholder, so it takes the same replacement. The other tools' own `?v=` strings are theirs to bump when they next change.

- [ ] **Step 3: Run everything**

Run:
```bash
node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js" "_tests/laser/*.test.js" "_tests/dwg/*.test.js" "_tests/coverage/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
dotnet test _src/dwg-engine/Tests 2>&1 | tail -1
dotnet test _src/laser-engine/Tests 2>&1 | tail -1
node _tests/coverage/make-examples.mjs --check
```
Expected: `ℹ pass 404`, `ℹ fail 0`; `Passed:    74`; `Passed:    43`; three `same` lines.

- [ ] **Step 4: Commit, then stop**

```bash
git add _docs/coverage-precheck/real-file-check.md
git commit -F - <<'EOF'
Coverage pre-check: real-file check record (to be filled before launch)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

**Stop here.** Merging and pushing `main` publishes the site; that is Aris's decision. Before any push:
- Aris runs 3–5 real permit drawings and fills `real-file-check.md` (spec §11), comparing figure by figure with the submitted tables;
- Aris decides on the points left to him: AOT or not (refinement 16), and spec §13's open questions;
- re-check arts 197–212 and 325 against the official ΦΕΚ (spec §13.4);
- squash the branch;
- grep the whole branch history for client names: `git log -p main..HEAD | grep -i -E "<client names>"` must print nothing;
- after the push:
  - check on the live site that the engine loads from GitHub Pages, the example gives spec §12's figures, and the devDept notice shows;
  - check DWG quantities live with its example, since it now loads the republished engine (spec §15).

---

## Replay

The plan was replayed task by task on a fresh worktree of `feat/coverage-precheck` at the plan's own commit (branch `scratch/covp-replay`, created with `git worktree add ../aidedcam-page-covp-replay -b scratch/covp-replay feat/coverage-precheck`). Only the plan's own commands were run, commits included: 14 commits for Tasks 1–14 (Task 0 commits nothing).
- **Every stated result appeared:**
  - Task 0's baselines: 340, 56 and 43.
  - The Node red and green steps: 0/1 → 6, 6/1 → 11, 11/1 → 38, 39/3 → 42, 42/1 → 45, 45/2 → 54; 394 after the page; 63/1 → 64; and 404 in all.
  - The engine: `CS0246` (`UnionResult`), then `Passed: 74`.
  - The generator: three `wrote` lines (6,490, 4,738 and 14,579 bytes), then three `same` lines.
  - The diff stats of Tasks 5, 6, 10 and 12.
  - The publish: `108 files, 11.4 MB in js/dwg/engine`, exactly the six engine changes, and a clean leak scan.
  - Union parity 6/6 with the stale refusal. DWG quantities on the republished engine: parity 6/6, its page check 25/25, perf 1.8 s at 10,000 entities and 15.6 s at 50,000.
  - The drawing module's exports, `syntax-ok`, and the browser check `52 passed, 0 failed`; the screenshots looked as Task 13 describes. Task 14's run: 404, 74, 43 and three `same`.
- **The replay matches the validated branch.**
  - `git diff --stat scratch/covp-validate scratch/covp-replay -- . ':(exclude)_docs'` lists only the published engine. That is the two rebuilt assemblies (`AidedCam.Dwg.Engine.*.wasm.gz` and `AidedCam.Dwg.Host.*.wasm.gz`, with other fingerprints and 1 and 3 bytes' difference in gzip), `dotnet.js`, which names them, and `manifest.json`, whose byte total went from 11,412,041 to 11,412,045.
  - With `js/dwg/engine` also excluded, the diff is empty. Every other file, including the three generated drawings, is byte-identical to the validated one.
  - Both engine folders hold the same 108 file names apart from the two fingerprints. The engine build is not byte-reproducible across worktrees, and every check passed on both builds.
  - On Git Bash for Windows, write the exclusion as `':(exclude)_docs'`: `':!_docs'` fails with "Unimplemented pathspec magic".
  - `_docs` differs by design. The validated branch predates 95c5168's spec edits, and has neither this plan nor the real-file record.
- **Fixes that came out of the replay** changed the plan's text only, never a block:
  - Task 9's red check printed `ERR_MODULE_NOT_FOUND` three times, so it now keeps the first line.
  - Task 6's expected union timings were widened: in the replay `MANY` took 184 ms and the first case 0.46 s, against 112–139 ms and about 0.4 s while validating.
  - Task 13's description of the drawing now says where the plot's fourth vertex label is.
  - Task 0 now allows a worktree's own branch name.
