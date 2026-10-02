# Steel take-off and galvanizing quote from NC1 and IFC: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tool #8, `steel-takeoff.html`. It reads a folder of DSTV/NC1 files (several files, a folder or a `.zip`) or one IFC, and gives a quote sheet:
- every piece, and the pieces grouped by profile and grade, with length, count, kg and m²;
- the longest and the heaviest piece;
- a galvanizing-bath fit check;
- cost lines from the rates the visitor types;
- an Excel file and a printable A4 sheet, in GR (default)/EN/IT.

The tool is ungated. It also takes its place on the site: a "Steel and building products" group on `free-tools.html`, a seventh tool in the sidebar, `sitemap.xml` and `llms.txt`.

**Architecture:**
- **NC1, on the page.** `js/steel/nc1.js` parses one file into a piece (the ST header, BO holes, AK/IK contours; other blocks read and skipped). `section.js` gives a section's area and painted perimeter from its dimensions; `plate.js` a plate's area, edges and weight from its contours with arcs; `piece.js` turns a parsed piece into a take-off row: nominal kg and m², the geometry check figure, the box. `bath.js` marks the bath fit; `quote.js` groups, totals and prices; `unzip.js` reads a `.zip` with `DecompressionStream('deflate-raw')`; `book.js` builds the four Excel sheets for `js/dwg/xlsx.js`. All pure and Node-tested.
- **IFC, in a worker.** `js/steel/worker.js` holds web-ifc (the plans tool's vendored copy) and answers the shared bridge's `process` messages. `ifcread.js` reads the open model: members and their extruded profiles, marks from Tekla's property sets, grades from materials, assemblies; breps from their meshes. The geometry check of the profile-priced members (it waits for web-ifc's booleans: bolt holes, cuts) is a second `process` message, answered after the rows are shown. A third answers the members' meshes for the whole-model view.
- **3D, on demand.** `shape3d.js` (pure) turns an NC1 piece into slabs: each face of the profile as a flat outline with its holes, or a plate, or a tube's section. `view3d.js` draws them with three.js r186, or the IFC's meshes coloured by grade. three.js loads with the first piece shown.
- **The page.** `steel-takeoff.html` + `js/steel/ui.js` + `js/steel/i18n-steel.js` + `js/steel/state.js` + a scoped `.st-*` block in `css/tools.css`. The shared shell (`js/gcode/shell/`), the bridge (`js/laser/bridge.js`), the Excel writer (`js/dwg/xlsx.js`), the plans tool's `model.js` and web-ifc are imported unchanged.

**Tech Stack:** plain ES modules; web-ifc 0.0.78 (vendored in `js/ifcplan/vendor/web-ifc/`); three.js r186 (vendored in `js/vendor/three/`); `DecompressionStream`; `node --test` (Node 24); the browser checks drive headless Chrome 154 through `playwright-core`; the static GitHub Pages site.

**Spec:** `_docs/steel-takeoff/2026-10-01-steel-takeoff-design.md` (8b70147). Format: `_docs/ifc-plans/2026-10-01-ifc-3d-view-plan.md`. Where this plan departs from the spec, the departure is listed under "Spec refinements" with its reason.

**Validated before writing.** Every block below was built and run in the scratch worktree `scratch/steel-validate` (from 8b70147, at 2c39245). The plan was built from those files, so every block equals its validated file; `node _tests/extract.mjs $PLAN <path> --check` confirms each one. The whole plan was then replayed on a fresh worktree (see "Replay" at the end).
- **Node:** `node --test $(git ls-files '_tests/**/*.test.js')` passes 611: the 517 of today, and the 94 of the new `_tests/steel/` suite (18 files). The sidebar suite stays at 7.
- **Browser:** `_tests/steel/browser-check.js` passes 50/50 on port 8821 (Chrome 154 headless, GPU WebGL). Its times on the development laptop:
  - the example, from the click to the table: 21–67 ms (spec: under 1 s);
  - the IFC example, web-ifc's first load included: 216–259 ms;
  - one piece in 3D, three.js included: 104–115 ms (spec: under 300 ms);
  - 500 NC1 files: 35–63 ms (spec: under 2 s).
- **The 13 MB target (spec §9).** `20210221PRIMARK.ifc`, a public Tekla Structures 21.1 export (12,896,085 bytes, 2,116 members, from `ladybug-tools/3d-models`, MIT; kept outside the repo), run with `BIG=<path>` (51 checks): the table in 1,665 ms. The geometry check of its 378 profile members ends at 4,681 ms. That pass is web-ifc subtracting 517 bolt-hole openings (3.1 s in Node); it is why the check is a second pass (Spec refinement 10). The read alone is 323 ms in Node.
- **The other checks still pass:** ifcplan 67/67 (8793), dwg 25/25 and coverage 52/52 (8765), sidebar 32/32 (8811; two of its checks adjusted for the seventh tool, Task 16).
- **Public NC1 samples** (downloaded outside the repo, never committed):
  - `Baseflow/DSTV.Net` test data (MIT), 13 files. 10 read; `E3` is "not an NC1 file" (its `ST` is `T`); `E4` is broken at line 11 (`6236:88`) and `E6` at line 8 (quantity `x`), as that library's own tests expect. `E2`'s code `Q` reads as SO. `E7`/`E8` carry the saw length after the length (`6236.88,313.2`).
  - `tluijken/dstv` test data (MIT), 12 files from two exporters, all read. The plates come from their contours: `P1565`, a disc of Ø233.7 written as two half arcs with its holes at negative x, weighs 6.35 kg (its header says 160 "kg/m", which is kg/m² for 20 mm plate). The Steel Detailer files leave the header weight at 0; the weights then come from the section (`IPE 300` 40.32 kg for 954.5 mm).
  - `serg-you-lin/dstvparser` examples (no licence: read locally only), 3 Tekla-style files. `2501.nc1`, HEA200, carries 42.300 kg/m and 1.136 m²/m, the catalogue values `section.js` reproduces (5,383.1 mm², 1.1361 m²/m).
- **Public steel IFC samples** (outside the repo), against Tekla's own `Tekla Quantity`/`Weight` per part:

  | Sample (licence) | Members | Our kg | Tekla's kg | Note |
  |---|---|---|---|---|
  | GeometryGym `IFC Model.ifc` (MIT), Tekla 20 | 21 | 8,956.4 | 8,973.1 (−0.19 %) | all from the profile parameters |
  | ladybug `20200205Model_PNO.ifc` (MIT), Tekla 2017 | 110 | 32,620.2 | 32,527.0 (+0.29 %) | 30 steel parts; the glass panes (IfcMember named `GLAS`) left out (Spec refinement 13) |
  | OMEN-Watson/Steel `111.ifc`, `222.ifc`, `3.ifc`, `ScullinModel.ifc` (no licence: local only) | 7, 10, 32, 12 | 150.6, 613.0, 2,385.4, 1,823.8 | +0.03 %, −0.11 %, −1.00 %, +0.01 % | breps, from their meshes |
  | OMEN-Watson/Steel `mod.ifc` | 10 | 614.4 | (no Tekla weights) | one ⚠: web-ifc's mesh of one clipped SHS is 1,081.8 kg against 35.6 nominal |
  | ladybug `20210221PRIMARK.ifc` (MIT), Tekla 21.1 | 2,116 | 217,770.7 | (no Tekla weights) | 1,738 from geometry, 17 ⚠ |
- **The example:** its NC1 set gives 16 pieces in 6 marks, 1,069.0 kg and 29.89 m², two double dips (the 13.5 m purlins). The same frame as IFC4 gives 1,069.2 kg and 29.88 m² (+0.02 %, spec: within 2 %), every member checked equal.
- **The other tools are untouched:** `git diff --stat 8b70147 -- js/laser js/dwg js/coverage js/gcode js/mill js/ifcplan js/vendor _src css/sidebar.css` is empty. The pages change only in their sidebar `?v=` (Task 15), and `free-tools.html`, `js/sidebar.js`, `css/tools.css` (one inserted block), `sitemap.xml`, `llms.txt` and `.gitattributes` as listed.

## Global Constraints

- **Public repo** (github.com/aidedcam/aidedcam-page). No client names, customer data, local user paths or licence data in any committed file, test, doc or commit message. NC1 and IFC files other than the generated example stay outside the repo (the large-file run takes its path from `BIG`, never from a committed file).
- **Commits:** the repo-local git email is akoulousis@aidedcam.com (Task 0 checks it). Every commit ends with exactly:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
  ```
- **Never push, merge or amend `main`.** Pushing `main` publishes the live site, and only Aris decides that.
- **Languages:** GR (default)/EN/IT for every visible string. Italian uses the formal voi and the typographic ’ (no ASCII `'` in Italian strings). The page carries its Greek strings inline. The word "free" (δωρεάν, gratuito) is not in any visible text; the page's meta description keeps «Δωρεάν», as the other tool pages do.
- **Layout:** at 375 px, no horizontal page scroll (a 16 px side gutter); the table and the cost block scroll inside their own boxes.
- **Other tools must not change.** Never edit `js/mill/*`, `js/vendor/*`, `js/laser/*`, `js/dwg/*`, `js/coverage/*`, `js/gcode/*`, `js/ifcplan/*`, `_src/*` or `css/sidebar.css`. The other pages change only in their sidebar `?v=` (Task 15). The site files that do change are given whole: `free-tools.html`, `js/sidebar.js`, `_tests/sidebar/sidebar.test.js`, `_tests/sidebar/browser-check.js`, `css/tools.css`, `sitemap.xml`, `llms.txt`, `.gitattributes`.
- **Imports:**
  - three.js is imported without a `?v=` (`../vendor/three/three.module.js`, `../vendor/three/addons/OrbitControls.js`). The addons import `../three.module.js` without one, so a `?v=` on ours would load a second instance. Only `view3d.js` imports three.js, and only `ui.js` imports `view3d.js`, through a dynamic `import()`.
  - The shared modules keep the `?v=` their own tool loads them with, so the browser shares one cached copy: `../laser/bridge.js?v=20261001` (as the plans tool), `../dwg/xlsx.js?v=20260930` (as the DWG tool), `../ifcplan/model.js?v=20261003` and `../ifcplan/vendor/web-ifc/web-ifc-api.js?v=20261003` with its `.wasm` (as the plans tool's worker). The shell `../gcode/shell/*` has none.
- **Cache-busting:** `?v=20261104` is a placeholder (no live page uses it; Task 0 greps), replaced on deploy day (Task 18). It is on every other relative import in `js/steel/*.js`, the worker URL, the example fetches, `view3d.js`'s import, and the page's `css/tools.css`, `i18n-steel.js` and `ui.js`. The sidebar's `css/sidebar.css` and `js/sidebar.js` move to it on all 13 pages, because `js/sidebar.js` gains the seventh tool (Spec refinement 23). `_tests/steel/site.test.js` and `_tests/sidebar/sidebar.test.js` pin all of this.
- **Spec values:** density 7,850 kg/m³; the check limit 5 %; the bath 12.6 × 1.3 × 1.8 m; VAT 24 %; 2,000 NC1 files; an IFC up to 150 MB; the bridge's 120 s timeout. Figures: kg to 1 decimal, m² to 2, lengths in mm.
- **GA** (consent-gated, anonymous): `steel_loaded { kind: nc1 | zip | ifc, pieces: 1-10 | 11-100 | 101-1000 | over-1000 }`, `steel_example`, `steel_xlsx`, `steel_print`, `steel_view3d { result }` once per set, `steel_error { reason }`, `steel_cta_click { where }`, `steel_survey { answer }`. Never a file name, a mark or a figure.
- **Tests:**
  - Node, from the repo root: `node --test $(git ls-files '_tests/**/*.test.js')` (tracked files). The TDD steps run `node --test "_tests/steel/*.test.js"`, which also sees new, untracked test files.
  - Browser checks: `_tests/steel/browser-check.cjs` (port 8821, new), `_tests/ifcplan/browser-check.cjs` (8793), `_tests/dwg/browser-check.cjs` and `_tests/coverage/browser-check.cjs` (8765), `_tests/sidebar/browser-check.cjs` (8811). Each one needs the repo root served with `python -m http.server <port> --bind 127.0.0.1`. Stop every server you start (Task 17, Step 4).
- **Whole files are extracted, never retyped.**
  - Every created or changed file is given whole, once, at its final content: a line `<!-- file: <path> -->` followed immediately by a fenced block.
  - Write a file with `node _tests/extract.mjs $PLAN <path>`, and check it with the same command plus `--check`, where `PLAN=_docs/steel-takeoff/2026-10-01-steel-takeoff-plan.md`. Set `PLAN` in every shell you run steps in.
  - A body never contains a line of exactly three backticks.
  - The example's NC1 and IFC files are never typed: the generator writes them (Task 10).
  - **The one exception is Task 15's interim edit.** The new page carries the sidebar at `?v=20261104`, and `sidebar.test.js` holds every page to one value and lists every page. So Task 15 moves the other 12 pages' sidebar `?v=` with `sed` (those pages are never given whole: only that line changes), and edits two lines of `sidebar.test.js` with `sed`; Task 16 gives `sidebar.test.js` and `free-tools.html` whole.

## Review Focus

These are five failure modes the spec implies but its test list doesn't name. Each is pinned by a test in its owning task:

1. **A real File read as nothing.** Chrome 154 defines `Blob.prototype.bytes()`. A loader that holds in-memory files as `{ name, bytes }` and reads `f.bytes || await f.arrayBuffer()` takes the *method* for every real File, decodes nothing, and reports "No NC1 piece was found" for every set the visitor drops, while the example (in memory) works. This happened while validating. *Pinned by `page.test.js` `the inputs of spec §6.2 …` (in-memory files are `{ name, data }`; no `.bytes ||`) (Task 15), and by the browser check's file-input checks: `files read and skipped …`, `500 NC1 files under 2 s` (Task 17).*
2. **A geometry ⚠ on every uncut member.** web-ifc 0.0.78 draws an I-section's root fillets as 45° chamfers (an HEA 200's mesh is 6.9 % heavier than its section) and circles as 11-gons (a CHS 5.3 % lighter). A naive "mesh × 7,850 against nominal" check would flag every light I-section and every tube. *Pinned by `ifcread.test.js` `web-ifc 0.0.78 draws I fillets as 45° chamfers …` (the measured meshes against `drawnArea`; a web-ifc upgrade that changes them fails here) and `the geometry check pass: … an uncut member equal to its nominal` (Task 11).*
3. **DSTV arcs on the wrong side.** A radius is the arc from its point to the next, its centre left of the way when positive. Tekla writes round plates and holes as two half arcs between two points. Read the other way, the area keeps its value but the box is wrong (the disc of `P1565` spans x −116.85…116.85, its holes at negative x), and a rounded corner subtracts instead of adds. *Pinned by `plate.test.js` `an arc: its centre left …` and `a circle of two half arcs …`, `piece.test.js` `a plate: from its contour …` (Tasks 3, 4), and by `ifcread.test.js`'s end plate (IFC three-point arcs, Task 11).*
4. **A plate's header weight read per metre.** Tekla writes a plate's weight per m² in the kg/m field (160 for 20 mm plate). Read per metre, a 233 mm disc would weigh 37 kg instead of 6.3. *Pinned by `piece.test.js` `a plate: from its contour, inner contours and holes at 7,850 kg/m³, whatever its header says per metre` (Task 4).*
5. **Glass or concrete counted as steel.** Tekla models glass panes and concrete parts as IfcMember or IfcBeam; at 7,850 kg/m³ the PNO sample came out at +158 % against Tekla's weights. *Pinned by `ifcread.test.js` `a member without an extruded body is priced from its mesh, marked; a glass or concrete member is left out` (Task 11).*

Also pinned: the saw length after a comma on the length line against a decimal comma (`nc1.test.js` `numbers: …`, Task 1); the IFC rows shown before the check is asked for (`page.test.js` `the bridge waits 120 s; the IFC check runs as its own pass …`, Task 15); the input cleared only after its files are read (browser check, Task 17).

## Spec refinements made while validating this plan

Each one is recorded here so the reviewers can check it against the spec, and so Aris can accept or reverse it.

1. **NC1 grades follow the IFC grade rule** (spec §3: S235, S275, S355 or S450 when the name holds one, else the name as written). `S355J2+N` groups as S355, so NC1 and IFC group alike and the per-grade rates find their grade. The Excel pieces sheet keeps the grade as written.
2. **Plates group by thickness** ("PL 20", "PL 15"), not by their profile name: each plate's name carries its width (`PL20*300`, `PL20*550`), which would give one group per plate. Flats (`FL…`, `STRIP…`, code B) join their thickness's group.
3. **Profile names group with spaces and case ignored, and `*` read as x** (`HEA 200` and `HEA200` together). The first name seen is shown.
4. **The bath check tries every orientation** of the piece's three dimensions, not only "length along the bath". A plate 1.9 × 1.75 × 0.02 m fits, standing; spec §5's rule is the case of a long member.
5. **The length line's comma.** DSTV allows the saw length after the length, separated by a comma (`6236.88,6230.00`); the spec also asks for decimal commas. One comma, no point and at most three digits after it is a decimal comma (`6236,88`); otherwise the comma separates the two values.
6. **The header, leniently:** blank or unknown codes read as SO; a profile name and code written the other way round (nc1-viewer.com's own example does) are put back; empty numbers read as 0; the four text lines may be missing; a file without EN still reads. A non-number in a numeric field, or a short header, is "broken" with its line.
7. **Contours:** the x suffix (the reference edge: `s`, `o`, `u`, `m`) is read and kept; the profile is drawn in its own face coordinates. A `w` or `t` after y (a notch) is read and kept, not drawn. Bevel fields after the radius are ignored. A new contour starts at a change of face, or after a point that closes on the first.
8. **Holes in the NC1 profile check:** the check figure is the section area × length less each hole's area × its face's thickness (web for v/h, flange for o/u); a slot adds its length × diameter; a blind hole counts by its depth.
9. **The plate's nominal ignores the header's kg/m and m²/m** (Review Focus 4); its check figure is the same contour cut into points (arcs every 11.25°), as the 3D build draws it.
10. **The IFC geometry check is a second worker pass.** The rows (nominal figures from the profile parameters, breps from their meshes, which web-ifc gives fast) come first; the check of the profile-priced members follows, the summary saying "running…". On the 13 MB sample the rows take 1.7 s in the browser and the check another 3 s (web-ifc subtracting 517 bolt holes). Spec §9's 3 s holds for the table.
11. **The IFC check compares like with like:** the mesh volume × 7,850 × (exact area ÷ the area web-ifc draws for the uncut profile), `drawnArea` in `ifcread.js` (Review Focus 2). A row's check is its member farthest from the nominal. Only kg is judged; the mesh surface is kept on the row but not judged (it holds the ends, the bores and a hollow section's inside).
12. **Breps and multi-solid bodies are priced from their meshes** ("from geometry", spec §7), meshed one by one (`GetFlatMesh`: `StreamMeshes` is broken in 0.0.78, its JS passes 4 arguments to a 3-argument binding).
13. **Members whose material or Name says concrete, timber, glass or aluminium** (`NOT_STEEL`) are listed with ⚠ and left out of the totals (Review Focus 5). Not in the spec.
14. **IFC members sharing a mark, profile, grade, length and weight are one row** with their count, as an NC1 file's quantity; the row keeps every member's id for the 3D view.
15. **IFC profiles:** a rectangle bar (IfcRectangleProfileDef, not a plate) is a flat: code B, grouped by its thickness, every face painted. An arbitrary outline extruded less than its smaller side is a plate. A U profile's FlangeSlope (radians) gives its taper.
16. **The single-piece 3D view of an IFC piece shows its own mesh** (with its real cuts and holes) rather than a profile rebuilt from parameters; the whole-model button shows every member by grade with the piece highlighted. An NC1 piece is rebuilt from its faces (each face a slab with its AK outline, IK openings and BO holes as real openings).
17. **A second example button, "The same as IFC",** loads the IFC twin of the example (spec §11 checks it gives the same totals; the visitor can compare too).
18. **The whole-model view has a cap of 3,000,000 triangles** ("too large for the 3D view").
19. **GA:** `steel_view3d` carries `{ result: shown | nogl }`, once per set; `steel_loaded`'s kind is `zip` when the set holds a ZIP; the example sends `steel_example` instead of `steel_loaded`.
20. **Counting:** "pieces" counts every physical piece (quantities summed), left-out ones too; the bath counts are pieces; a row's kg and m² are its totals (quantity × each); the Excel pieces sheet has both.
21. **One IFC is read alone:** in a set with an IFC, the first IFC is read and every other file is listed as skipped ("one IFC is read at a time").
22. **The settings:** VAT is on by default; bath dimensions are positive and under 100 m; a rate that is not a number is marked and the last good one kept; the per-grade rates replace the single steel rate while ticked.
23. **The sidebar's `?v=` moves to the placeholder on all 13 pages** (Task 15), because `js/sidebar.js` changes. `css/sidebar.css` does not change; it moves with it because `sidebar.test.js` holds both to one value. On deploy day both take the deploy value.
24. **The steel block in `css/tools.css` goes before the ifc-plans section,** not at the end: `_tests/ifcplan/page3d.test.js` scopes everything from its 3D block to the end of the file to `.ip-`.
25. **`.gitattributes` keeps `js/steel/examples/**` binary,** so the NC1 files keep their CRLF (as Tekla writes them) and the generator's `--check` holds on any checkout.
26. **Inputs:** the file input is cleared only after its files are read (clearing it first empties them in Chrome); a dropped folder is walked through the entries API; ZIP entries count as files read.
27. **The printed sheet has its own header** (`.gv-print-head` with the title): the shared print rule hides `.gv-head`.
28. **More modules than spec §3 lists:** `ifcread.js` (the reader, Node-tested apart from the worker's globals), `shape3d.js` (the 3D slabs, pure), `state.js` (settings, file kinds, the GA bucket), and the test helper `_tests/steel/example-rows.mjs`.
29. **`section.js`:** a U named UPN/UNP/U+digits gets the 8 % taper of DIN 1026-1, with r2 = r/2; an L's toe radius is r/2 (EN 10056-1); a hollow section's corners are EN 10210-2's (outside the given radius, else 1.5 t; inside ⅔ of it). An IPN is computed with parallel flanges (within 2 %).
30. **Strings beyond spec §6:** the skipped-files list, the sort labels, the check tooltip, the 3D notes (`noshape`, `stale`, `large`), the v1 note ("Not in this version: bolts and welds, cutting and nesting, …"), the Excel column headers.
31. **The tasks** are 0–18; the page is Task 15 and the site integration Task 16.

## File structure

| Path | Task | Responsibility |
|---|---|---|
| `js/steel/nc1.js`, `_tests/steel/nc1.test.js` | 1 | The DSTV parser |
| `js/steel/section.js`, `_tests/steel/section.test.js` | 2 | Area and painted perimeter per profile code |
| `js/steel/plate.js`, `_tests/steel/plate.test.js` | 3 | Rings with arcs; plate area, edges, kg, m² |
| `js/steel/piece.js`, `_tests/steel/piece.test.js` | 4 | One NC1 piece's nominal figures, check, box; the grade rule |
| `js/steel/bath.js`, `_tests/steel/bath.test.js` | 5 | The bath fit |
| `js/steel/quote.js`, `_tests/steel/quote.test.js` | 6 | Groups, totals, sorting, cost lines |
| `js/steel/state.js`, `_tests/steel/state.test.js` | 7 | Settings, file kinds, the GA bucket |
| `js/steel/unzip.js`, `_tests/steel/unzip.test.js` | 8 | Reading a `.zip` |
| `js/steel/book.js`, `_tests/steel/book.test.js` | 9 | The four Excel sheets |
| `_tests/steel/make-example.mjs`, `example-rows.mjs`, `examples.test.js`, `.gitattributes`, `js/steel/examples/*` (generated) | 10 | The example portal frame, NC1 and IFC |
| `js/steel/ifcread.js`, `js/steel/worker.js`, `_tests/steel/ifcread.test.js`, `worker.test.js` | 11 | The IFC reader and its worker |
| `js/steel/shape3d.js`, `_tests/steel/shape3d.test.js` | 12 | An NC1 piece as slabs for the 3D view |
| `js/steel/view3d.js`, `_tests/steel/view3d.test.js` | 13 | The three.js view |
| `js/steel/i18n-steel.js`, `_tests/steel/i18n.test.js` | 14 | The strings in el, en, it |
| `steel-takeoff.html`, `css/tools.css`, `js/steel/ui.js`, `_tests/steel/site.test.js`, `page.test.js` (+ the sidebar `?v=` on 12 pages) | 15 | The page |
| `free-tools.html`, `js/sidebar.js`, `_tests/sidebar/sidebar.test.js`, `sitemap.xml`, `llms.txt`, `_tests/steel/listing.test.js` | 16 | The site integration |
| `_tests/steel/browser-check.js`, `browser-check.cjs`, `_tests/sidebar/browser-check.js` | 17 | The browser checks |
| (deploy day) | 18 | The placeholder swap and the sitemap date |

## The DSTV format, as this plan reads it

The DSTV standard ("Standard Description for Steel Structure Pieces for the Numerical Controls", Deutscher Stahlbau-Verband, 7th edition 1998) is not freely published; its copies online sit behind sign-ins. The layout below was taken from these, which agree with each other and with every public sample:
- **Tekla Structures, "DSTV file description"** (support.tekla.com, 2026): the block codes (ST, EN, BO, SI, AK, IK, PU, KO, KA) and the faces `v` front, `o` top, `u` bottom, `h` behind; the profile codes I, L, U, M, RO, RU, B, C, T, SO.
- **nc1-viewer.com guides** ("DSTV block codes explained", "What is a DSTV NC1 file?", "DSTV profile types"): blocks as a two-letter code alone on a line; data lines starting with the face letter; coordinates per face in mm; suffix letters on coordinates naming the reference edge; numbered plane blocks (E1, B1, S1); millimetres and degrees.
- **Baseflow/DSTV.Net** (MIT), `HeaderReader.cs`: the ST field order with its formats, among them `2x, f [,f] Length, Saw Length`; `BodyReader.cs`, `DstvHole.cs`, `DstvContourPoint.cs`: BO as face, x, y, diameter, depth, then slot length, width and angle; AK/IK as face, x, y, radius, then bevel fields; a `w` or `t` after y marking a notch; `**` comment lines; the face carried over by lines without one.
- **tluijken/dstv** (MIT), `header.rs` and `border.rs`: the same order; the radius applies to the edge from its point to the next.

The ST header, one value per line after `ST` (comments `**` anywhere): 1 order, 2 drawing, 3 phase, 4 piece mark, 5 steel grade, 6 quantity, 7 profile name, 8 profile code, 9 length (mm, optionally `,saw length`), 10 profile height, 11 flange width, 12 flange thickness, 13 web thickness, 14 radius, 15 weight (kg/m), 16 painting surface (m²/m), 17 web start cut, 18 web end cut, 19 flange start cut, 20 flange end cut (degrees), then up to four text lines. The radius sign was fixed from the samples: in `0008-SE0008` a cope's fillet (+10, the arc's centre at 61.75, 27) and in `P1565` a disc of two half arcs (+116.85) with holes on both sides of x = 0 (Review Focus 3).

## Catalogue values for `section.test.js`

From staticstools.eu's section tables (EN 10365 / DIN 1025 / DIN 1026-1 / EN 10056-1 / EN 10210-2); HE 200 A also British Steel's HE datasheet (42.3 kg/m, 53.8 cm², 1.13 m²/m) and Tekla's catalogue in the public `2501.nc1` (42.300 kg/m, 1.136 m²/m):

| Section | A (mm²) | G (kg/m) | AL (m²/m) | `section.js` |
|---|---|---|---|---|
| HE 200 A (190 × 200 × 6.5 × 10, r 18) | 5,383 | 42.3 | 1.14 | 5,383.1; 1.1361 |
| IPE 300 (300 × 150 × 7.1 × 10.7, r 15) | 5,380 | 42.2 | 1.16 | 5,381.2; 1.1600 |
| UPN 200 (200 × 75 × 8.5 × 11.5, r1 11.5, r2 6) | 3,220 | 25.3 | 0.66 | 3,226.9; 0.6580 |
| L 80 × 80 × 8 (r1 10, r2 5) | 1,227 | 9.63 | 0.3114 | 1,226.7; 0.3114 |
| RHS 100 × 50 × 4 (EN 10210, r 6) | 1,120 | 8.78 | 0.29 | 1,118.8; 0.2897 |
| CHS 114.3 × 5 | 1,720 | 13.5 | 0.359 | 1,716.9; 0.3591 |
| FL 100 × 10 | 1,000 | 7.85 | 0.22 | 1,000; 0.2200 |

---

### Task 0: Starting point

Nothing is written in this task. It checks that the tools and the baseline are as this plan expects.

**Files:** none.

**Interfaces:**
- Produces: a known baseline for Tasks 1–17: Node 517; the placeholder `20261104` unused; WebGL2 in headless Chrome; ports 8821, 8793, 8765 and 8811 free.

- [ ] **Step 1: Check the starting point**

Run (Git Bash, repo root):
```bash
PLAN=_docs/steel-takeoff/2026-10-01-steel-takeoff-plan.md
git branch --show-current && git log --oneline -1
git config user.email
node --version
node --test $(git ls-files '_tests/**/*.test.js') 2>&1 | grep -E "^ℹ (pass|fail)"
grep -rln "20261104" --include=*.html --include=*.js --include=*.css --include=*.xml . | grep -v "^./_docs/" ; echo "placeholder check done"
ls js/steel _tests/steel 2>&1 | head -2
```
Expected:
- the branch is `feat/steel-takeoff` (or the worktree's own branch), and HEAD is the commit that adds this plan (or 8b70147 with this plan copied in);
- the email is `akoulousis@aidedcam.com` (if not: `git config --local user.email akoulousis@aidedcam.com`);
- Node `v24.x`;
- `ℹ pass 517`, `ℹ fail 0`;
- nothing listed before `placeholder check done`;
- `js/steel` and `_tests/steel` do not exist yet.

- [ ] **Step 2: The browser tooling, WebGL2 headless and the ports**

Run:
```bash
node -e "const p=require('path'),fs=require('fs'),d=p.join(require('os').homedir(),'AppData','Local','npm-cache','_npx');const c=fs.readdirSync(d).map(x=>p.join(d,x,'node_modules','playwright-core')).find(fs.existsSync);require(c).chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}).then(async b=>{const g=await (await b.newPage()).evaluate(()=>!!document.createElement('canvas').getContext('webgl2'));console.log('webgl2',g,b.version());await b.close()})"
python --version
for port in 8821 8793 8765 8811; do netstat -ano | grep -q ":$port .*LISTENING" && echo "port $port busy" || echo "port $port free"; done
```
Expected: `webgl2 true 154.…`, a Python 3 version, and the four ports free. If `webgl2 false`, run the steel and ifcplan browser checks of Task 17 with `GL=swiftshader`. If playwright-core is not found, run `npx playwright --version` once (or set `PW_CORE`).

No commit: nothing changed.

---

### Task 1: The NC1 parser

**Files:**
- Create: `js/steel/nc1.js`
- Test: `_tests/steel/nc1.test.js`

**Interfaces:**
- Produces (`js/steel/nc1.js`, pure):
  - `parseNc1(text) → { ok: true, piece } | { ok: false, reason: 'notnc1' | 'broken', line? }`;
  - `piece`: `{ order, drawing, phase, mark, grade, qty, profile, code, length, sawLength, h, b, tf, tw, r, kgm, m2m, webStart, webEnd, flangeStart, flangeEnd, text: [≤4], holes: [{ face, x, y, d, depth, slot: { l, w, angle } | null, ref, line }], contours: [{ kind: 'AK' | 'IK', face, pts: [{ x, y, r, ref, notch }] }], skipped: { CODE: count } }`;
  - `num(s)` (point or comma; `''` → null; else NaN), `lengthPair(s) → { length, saw }`, `CODES`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/steel/nc1.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNc1, num, lengthPair, CODES } from '../../js/steel/nc1.js';

// A header as Tekla writes it (DSTV order: order, drawing, phase, mark, grade, quantity, profile, code, length,
// height, flange width, flange thickness, web thickness, radius, kg/m, m²/m, four cut angles, four text lines).
const header = (o = {}) => {
  const f = { order: 'P1', drawing: 'D1', phase: '1', mark: 'B1', grade: 'S355J2', qty: '2', profile: 'HEA200', code: 'I', length: '4000.00',
    h: '190.00', b: '200.00', tf: '10.00', tw: '6.50', r: '18.00', kgm: '42.300', m2m: '1.136', cuts: ['0.000', '0.000', '0.000', '0.000'], ...o };
  return ['ST', '** written by hand', ...['order', 'drawing', 'phase', 'mark', 'grade', 'qty', 'profile', 'code', 'length', 'h', 'b', 'tf', 'tw', 'r', 'kgm', 'm2m'].map(k => `  ${f[k]}`),
    ...f.cuts.map(c => `  ${c}`), '  -', '  -', '  -', '  -'];
};
const file = (lines, eol = '\r\n') => lines.join(eol) + eol;

test('the header: twenty fields in DSTV order, then four text lines; comments skipped anywhere', () => {
  const r = parseNc1(file(header()));
  assert.equal(r.ok, true);
  const p = r.piece;
  assert.deepEqual([p.order, p.drawing, p.phase, p.mark, p.grade, p.qty, p.profile, p.code], ['P1', 'D1', '1', 'B1', 'S355J2', 2, 'HEA200', 'I']);
  assert.deepEqual([p.length, p.h, p.b, p.tf, p.tw, p.r, p.kgm, p.m2m], [4000, 190, 200, 10, 6.5, 18, 42.3, 1.136]);
  assert.deepEqual([p.webStart, p.webEnd, p.flangeStart, p.flangeEnd], [0, 0, 0, 0]);
  assert.deepEqual(p.text, ['-', '-', '-', '-']);
  const lines = header();
  lines.splice(8, 0, '** a comment inside the header');
  assert.equal(parseNc1(file(lines)).piece.profile, 'HEA200');
});

test('CRLF, LF and CR line ends, a BOM, blank lines before ST: the same piece', () => {
  const a = parseNc1(file(header(), '\r\n')).piece, b = parseNc1(file(header(), '\n')).piece, c = parseNc1(file(header(), '\r')).piece;
  const d = parseNc1('﻿\n\n' + file(header(), '\n')).piece;
  for (const x of [b, c, d]) assert.deepEqual(x, a);
});

test('numbers: a decimal comma or point; the length line may carry the saw length after a comma', () => {
  assert.equal(num(' 42,300 '), 42.3);
  assert.equal(num('1.136'), 1.136);
  assert.equal(num(''), null);
  assert.ok(Number.isNaN(num('6236:88')));
  assert.deepEqual(lengthPair('6236.88'), { length: 6236.88, saw: null });
  assert.deepEqual(lengthPair('6236,88'), { length: 6236.88, saw: null }, 'a decimal comma');
  assert.deepEqual(lengthPair('6236.88,6230.00'), { length: 6236.88, saw: 6230 }, 'length, saw length');
  assert.deepEqual(lengthPair('233.70,233.70'), { length: 233.7, saw: 233.7 });
  assert.deepEqual(lengthPair('5000,4998'), { length: 5000, saw: 4998 }, 'four digits after the comma: two values');
  const p = parseNc1(file(header({ kgm: '42,300', m2m: '1,136', length: '4000,5' }))).piece;
  assert.deepEqual([p.length, p.kgm, p.m2m], [4000.5, 42.3, 1.136]);
});

test('the code: blank or unknown reads as SO; a profile and code written the other way round are put back', () => {
  assert.deepEqual(CODES, ['I', 'L', 'U', 'B', 'RU', 'RO', 'M', 'C', 'T', 'SO']);
  assert.equal(parseNc1(file(header({ code: '' }))).piece.code, 'SO');
  assert.equal(parseNc1(file(header({ code: 'Q' }))).piece.code, 'SO');
  const p = parseNc1(file(header({ profile: 'I', code: 'W14X90' }))).piece;
  assert.deepEqual([p.profile, p.code], ['W14X90', 'I']);
  assert.equal(parseNc1(file(header({ code: 'ro' }))).piece.code, 'RO', 'any case');
});

test('missing fields: empty numbers read as 0; a short header or a non-number is broken, with its line', () => {
  const p = parseNc1(file(header({ kgm: '', m2m: '' }))).piece;
  assert.deepEqual([p.kgm, p.m2m], [0, 0]);
  assert.equal(parseNc1(file(header({ qty: '' }))).piece.qty, 0);
  assert.deepEqual(parseNc1(file(header({ length: '6236:88' }))), { ok: false, reason: 'broken', line: 11 });
  assert.deepEqual(parseNc1(file(header({ qty: 'x' }))), { ok: false, reason: 'broken', line: 8 });
  assert.deepEqual(parseNc1(file(header().slice(0, 12))), { ok: false, reason: 'broken', line: 13 });
});

test('a file that is not NC1 (no ST block first) is told apart', () => {
  assert.deepEqual(parseNc1('T\n  1\n'), { ok: false, reason: 'notnc1' });
  assert.deepEqual(parseNc1('0\nSECTION\n2\nENTITIES\n'), { ok: false, reason: 'notnc1' });
  assert.deepEqual(parseNc1(''), { ok: false, reason: 'notnc1' });
});

test('BO: face, x with its reference letter, y, diameter, depth and the slot fields; the face carries over', () => {
  const r = parseNc1(file([...header(), 'BO', '  o   3880.00s    50.00     22.00     0.00', '      3960.00s   150.00     22.00', '  v    100.00u    95.00     18.00     0.0    60.0    0.0    0.0', 'EN']));
  const h = r.piece.holes;
  assert.equal(h.length, 3);
  assert.deepEqual(h[0], { face: 'o', x: 3880, y: 50, d: 22, depth: 0, slot: null, ref: 's', line: 28 });
  assert.equal(h[1].face, 'o', 'a line without a face keeps the one before');
  assert.deepEqual(h[2].slot, { l: 60, w: 0, angle: 0 });
  assert.equal(h[2].ref, 'u');
});

test('AK and IK: x, y and radius, notch suffixes, one contour per face, closed on the first point or at the block end', () => {
  const r = parseNc1(file([...header(), 'AK',
    '  v      0.00u      0.00      0.00', '  v   1952.00       0.00w    10.00', '  v    200.00     100.00    -10.00', '        200.00     110.00t   -10.00', '  v      0.00u      0.00      0.00',
    '  o      0.00s      0.00      0.00       0.00       0.00       0.00       0.00', '        100.00       0.00      0.00       0.00       0.00       0.00       0.00', '        100.00     200.00      0.00',
    'IK', '  v    130.00     150.00    -20.00', '  v    170.00     150.00    -20.00', '  v    130.00     150.00      0.00', 'EN']));
  const c = r.piece.contours;
  assert.deepEqual(c.map(x => `${x.kind}${x.face}${x.pts.length}`), ['AKv4', 'AKo3', 'IKv2']);
  assert.deepEqual(c[0].pts[1], { x: 1952, y: 0, r: 10, ref: '', notch: true });
  assert.deepEqual(c[0].pts[3], { x: 200, y: 110, r: -10, ref: '', notch: true });
  assert.equal(c[0].pts[2].notch, false);
  assert.deepEqual(c[2].pts, [{ x: 130, y: 150, r: -20, ref: '', notch: false }, { x: 170, y: 150, r: -20, ref: '', notch: false }], 'a circle of two arcs');
});

test('SI, KO, PU, KA, numbered and unknown blocks are read and skipped; a data line before any block is broken', () => {
  const r = parseNc1(file([...header(), 'SI', '  v   20.00s   20.00   0.00  10 B1', 'KO', '  v 10.00 10.00 0.00', 'PU', '  v 5 5 0', 'KA', '  v 1 2 3 4', 'E1', '  0.00 0.00 90.00', 'B1', '  1100.00u 53.00 18.00', 'EN', 'BO', '  v 1 1 1']));
  assert.deepEqual(r.piece.skipped, { SI: 1, KO: 1, PU: 1, KA: 1, E1: 1, B1: 1 });
  assert.equal(r.piece.holes.length, 0, 'nothing after EN');
  const bad = parseNc1(file([...header().slice(0, 22), '  v 1 1 1']));
  assert.equal(bad.ok, true, 'without text lines, the next indented line is taken as one');
  assert.deepEqual(parseNc1(file([...header(), 'BO', '  v  12.0  zz  22.0'])), { ok: false, reason: 'broken', line: 28 });
  assert.deepEqual(parseNc1(file([...header(), 'BO', '  v  12.0'])), { ok: false, reason: 'broken', line: 28 });
});

test('a file without EN, and a header without its text lines, still read', () => {
  const r = parseNc1(file([...header().slice(0, 22), 'BO', '  v 10 20 14']));
  assert.equal(r.ok, true);
  assert.deepEqual(r.piece.text, []);
  assert.equal(r.piece.holes.length, 1);
});
```

Run: `node _tests/extract.mjs $PLAN _tests/steel/nc1.test.js && node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 0`, `ℹ fail 1` (the module is missing).

- [ ] **Step 2: Write the parser**

<!-- file: js/steel/nc1.js -->
```js
// Steel take-off: the DSTV (NC1) parser (spec §3). One file describes one piece: the ST header, then blocks, each a
// two-character code alone at the start of a line followed by its data lines, up to EN. BO (holes), AK (outer
// contours) and IK (inner contours) are read; SI, KO, PU, KA and any other block are read and skipped. Lines that
// start with ** are comments. Lengths are in mm, the weight in kg/m and the painting surface in m²/m, as DSTV defines
// them. Pure: text in, { ok: true, piece } or { ok: false, reason, line } out.

// The DSTV profile codes; a blank or unknown code is read as SO (special).
export const CODES = ['I', 'L', 'U', 'B', 'RU', 'RO', 'M', 'C', 'T', 'SO'];
const FACES = new Set(['v', 'o', 'u', 'h']);
const BLOCK = /^([A-Z][A-Z0-9])\s*$/;              // a block code: two characters from column 0, alone on the line
const isComment = s => s.trimStart().startsWith('**');

// A DSTV number: a point or a comma as the decimal mark. '' is null; anything else that is not a number is NaN.
export function num(s) {
  const t = String(s == null ? '' : s).trim();
  if (!t) return null;
  if (!/^[+-]?(\d+([.,]\d*)?|[.,]\d+)([eE][+-]?\d+)?$/.test(t)) return NaN;
  return Number(t.replace(',', '.'));
}

// The length line may carry the saw length after a comma ("6236.88,6230.00"). A single comma with at most three
// digits after it and no point is a decimal comma ("6236,88"); otherwise the comma separates the two values.
export function lengthPair(s) {
  const t = String(s == null ? '' : s).trim();
  const parts = t.split(',');
  if (parts.length === 2 && !t.includes('.') && /^\s*\d{1,3}\s*$/.test(parts[1])) return { length: num(t), saw: null };
  if (parts.length >= 2) return { length: num(parts[0]), saw: num(parts[1]) };
  return { length: num(t), saw: null };
}

// One data token: a number with an optional letter suffix ("674.41s", "0.00w", "-10.00").
function token(s) {
  const m = /^([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?)([a-z]*)$/.exec(s);
  return m ? { v: Number(m[1].replace(',', '.')), suffix: m[2] } : null;
}

// A data line: its face (the line's own, or the one before it in the block) and its numbers.
function dataLine(line, face) {
  const parts = line.trim().split(/\s+/);
  let f = face;
  if (FACES.has(parts[0])) f = parts.shift();
  const nums = [];
  for (const p of parts) {
    const x = token(p);
    if (!x) return null;
    nums.push(x);
  }
  return { face: f, nums };
}

const HEADER_TEXT = ['order', 'drawing', 'phase', 'mark', 'grade'];
const HEADER_NUM = ['h', 'b', 'tf', 'tw', 'r', 'kgm', 'm2m', 'webStart', 'webEnd', 'flangeStart', 'flangeEnd'];

export function parseNc1(text) {
  const lines = String(text).replace(/^﻿/, '').split(/\r\n|\r|\n/);
  let i = 0;
  while (i < lines.length && (!lines[i].trim() || isComment(lines[i]))) i++;
  if (i >= lines.length || lines[i].trim() !== 'ST') return { ok: false, reason: 'notnc1' };
  i++;

  // ---- the header: twenty fields, one per line, then up to four lines of text ----
  const fields = [];
  let lastLine = i;
  for (; i < lines.length && fields.length < 20; i++) {
    if (isComment(lines[i])) continue;
    fields.push({ s: lines[i], line: i + 1 });
    lastLine = i + 1;
  }
  if (fields.length < 20) return { ok: false, reason: 'broken', line: Math.min(lastLine + 1, lines.length) };   // the end of the file
  const piece = {};
  HEADER_TEXT.forEach((k, j) => { piece[k] = fields[j].s.trim(); });
  const qty = num(fields[5].s);
  if (Number.isNaN(qty)) return { ok: false, reason: 'broken', line: fields[5].line };
  piece.qty = qty === null ? 0 : qty;
  let profile = fields[6].s.trim(), code = fields[7].s.trim().toUpperCase();
  // Some writers swap the profile name and its code; the code is the one DSTV knows.
  if (CODES.includes(profile.toUpperCase()) && !CODES.includes(code)) [profile, code] = [fields[7].s.trim(), profile.toUpperCase()];
  piece.profile = profile;
  piece.code = CODES.includes(code) ? code : 'SO';
  const len = lengthPair(fields[8].s);
  if (Number.isNaN(len.length) || Number.isNaN(len.saw)) return { ok: false, reason: 'broken', line: fields[8].line };
  piece.length = len.length || 0;
  piece.sawLength = len.saw;
  for (let j = 0; j < HEADER_NUM.length; j++) {
    const v = num(fields[9 + j].s);
    if (Number.isNaN(v)) return { ok: false, reason: 'broken', line: fields[9 + j].line };
    piece[HEADER_NUM[j]] = v === null ? 0 : v;
  }
  piece.text = [];
  while (i < lines.length && piece.text.length < 4 && !BLOCK.test(lines[i])) {
    if (!isComment(lines[i])) piece.text.push(lines[i].trim());
    i++;
  }

  // ---- the blocks ----
  piece.holes = [];
  piece.contours = [];
  piece.skipped = {};
  let block = null, face = 'v', contour = null;
  const endContour = () => { if (contour && contour.pts.length) piece.contours.push(contour); contour = null; };
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || isComment(line)) continue;
    const m = BLOCK.exec(line);
    if (m) {
      endContour();
      block = m[1];
      face = 'v';
      if (block === 'EN') break;
      if (block !== 'BO' && block !== 'AK' && block !== 'IK') piece.skipped[block] = (piece.skipped[block] || 0) + 1;
      continue;
    }
    if (!block) return { ok: false, reason: 'broken', line: i + 1 };
    if (block !== 'BO' && block !== 'AK' && block !== 'IK') continue;
    const d = dataLine(line, face);
    if (!d || d.nums.length < 3) return { ok: false, reason: 'broken', line: i + 1 };
    face = d.face;
    const n = d.nums;
    if (block === 'BO') {
      const slot = n.length > 4 && n[4].v > 0 ? { l: n[4].v, w: n.length > 5 ? n[5].v : 0, angle: n.length > 6 ? n[6].v : 0 } : null;
      piece.holes.push({ face, x: n[0].v, y: n[1].v, d: n[2].v, depth: n.length > 3 ? n[3].v : 0, slot, ref: n[0].suffix, line: i + 1 });
      continue;
    }
    // AK / IK: x, y, radius (an arc from this point to the next, its centre left of the way for a positive radius,
    // right for a negative one), then optional bevel fields.
    // A suffix after x names the edge it is measured from; 'w' or 't' after y marks a notch. A new contour starts at a
    // face change, or after a point that closes the contour on its first point.
    const p = { x: n[0].v, y: n[1].v, r: n[2].v, ref: n[0].suffix, notch: /[wt]/.test(n[1].suffix) };
    if (contour && contour.face !== face) endContour();
    if (!contour) contour = { kind: block, face, pts: [] };
    contour.pts.push(p);
    const first = contour.pts[0];
    if (contour.pts.length >= 3 && Math.abs(p.x - first.x) < 1e-6 && Math.abs(p.y - first.y) < 1e-6) {
      contour.pts.pop();
      endContour();
    }
  }
  endContour();
  return { ok: true, piece };
}
```

Run: `node _tests/extract.mjs $PLAN js/steel/nc1.js && node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 10`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/steel/nc1.js _tests/steel/nc1.test.js
git commit -F - <<'EOF'
Steel take-off: the DSTV (NC1) parser

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 2: Sections from their dimensions

**Files:**
- Create: `js/steel/section.js`
- Test: `_tests/steel/section.test.js`

**Interfaces:**
- Produces (`js/steel/section.js`, pure): `section({ code, h, b, tf, tw, r, r2?, taper?, ri?, profile? }) → { area (mm²), perimeter (mm) } | null` for codes I, U, C, L, T, M, RO, RU, B (SO and missing dimensions: null); `taperOf(profile)` (0.08 for UPN/UNP/U+digits); `plateDims(header) → { t, w }`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/steel/section.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { section, taperOf, plateDims } from '../../js/steel/section.js';

// Published values (A mm², G kg/m, AL m²/m): staticstools.eu section tables (EN 10365 / DIN 1025 / DIN 1026-1 /
// EN 10056-1 / EN 10210-2), HE 200 A also British Steel's HE datasheet (42.3 kg/m, 53.8 cm²); the flat bar from its
// dimensions (EN 10058). Within 1 % (spec §11).
const CATALOGUE = [
  ['HEA 200', { code: 'I', h: 190, b: 200, tf: 10, tw: 6.5, r: 18 }, 5383, 42.3, 1.14],
  ['IPE 300', { code: 'I', h: 300, b: 150, tf: 10.7, tw: 7.1, r: 15 }, 5380, 42.2, 1.16],
  ['UPN 200', { code: 'U', h: 200, b: 75, tf: 11.5, tw: 8.5, r: 11.5, profile: 'UPN 200' }, 3220, 25.3, 0.66],
  ['L 80×8', { code: 'L', h: 80, b: 80, tf: 8, tw: 8, r: 10 }, 1227, 9.63, 0.3114],
  ['RHS 100×50×4', { code: 'M', h: 100, b: 50, tf: 4, tw: 4, r: 6 }, 1120, 8.78, 0.29],
  ['CHS 114.3×5', { code: 'RO', h: 114.3, b: 114.3, tf: 5, tw: 5 }, 1720, 13.5, 0.359],
  ['FL 100×10', { code: 'B', h: 100, b: 10, tf: 10, tw: 10 }, 1000, 7.85, 0.22],
];

test('area, kg/m and painted perimeter against the catalogue, within 1 %', () => {
  for (const [name, s, A, G, AL] of CATALOGUE) {
    const r = section(s);
    const near = (got, want, what) => assert.ok(Math.abs(got / want - 1) < 0.01, `${name} ${what}: ${got} vs ${want}`);
    near(r.area, A, 'A');
    near(r.area * 7850e-6, G, 'G');
    near(r.perimeter / 1000, AL, 'AL');
  }
});

test('the exact formulas: fillets of parallel-flange I sections, the UPN taper, EN 10210 corners', () => {
  const hea = section({ code: 'I', h: 190, b: 200, tf: 10, tw: 6.5, r: 18 });
  assert.equal(+hea.area.toFixed(2), 5383.12);
  assert.equal(+hea.perimeter.toFixed(2), 1136.10);
  assert.equal(taperOf('UPN 200'), 0.08);
  assert.equal(taperOf('U200'), 0.08);
  assert.equal(taperOf('UPE 200'), 0);
  assert.equal(taperOf('PFC250*90'), 0);
  const upe = section({ code: 'U', h: 200, b: 80, tf: 11, tw: 6, r: 13, profile: 'UPE 200' });
  assert.ok(Math.abs(upe.area - 2900) < 30, `UPE 200: ${upe.area} (catalogue 29.0 cm²)`);
  const rhs = section({ code: 'M', h: 100, b: 50, tf: 4, tw: 4, r: 0 });
  assert.equal(+rhs.area.toFixed(1), 1118.8, 'no radius: 1.5 t outside, t inside');
  assert.equal(+section({ code: 'M', h: 100, b: 50, tw: 4, r: 6, ri: 2 }).area.toFixed(1), 1108.5, 'an inner radius given');
  assert.equal(+section({ code: 'RU', h: 20 }).area.toFixed(2), 314.16);
  assert.equal(+section({ code: 'T', h: 100, b: 100, tf: 11, tw: 11, r: 0 }).area.toFixed(0), 2079);
});

test('no section without its dimensions, or for a special profile', () => {
  assert.equal(section({ code: 'SO', h: 175, b: 81, tf: 1.5, tw: 1.5 }), null);
  assert.equal(section({ code: 'I', h: 190, b: 200, tf: 0, tw: 6.5 }), null);
  assert.equal(section({ code: 'RO', h: 10, tw: 6 }), null, 'a wall thicker than the radius');
  assert.equal(section({ code: 'B', h: 0, b: 0, tw: 0, tf: 0 }), null);
});

test('a plate from its header: thickness from the web, else the flange, else the smaller dimension', () => {
  assert.deepEqual(plateDims({ h: 300, b: 20, tf: 20, tw: 20 }), { t: 20, w: 300 });
  assert.deepEqual(plateDims({ h: 10, b: 196.451, tf: 0, tw: 10 }), { t: 10, w: 196.451 });
  assert.deepEqual(plateDims({ h: 200, b: 15, tf: 15, tw: 0 }), { t: 15, w: 200 });
  assert.deepEqual(plateDims({ h: 200, b: 15, tf: 0, tw: 0 }), { t: 15, w: 200 });
});
```

Run: `node _tests/extract.mjs $PLAN _tests/steel/section.test.js && node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 10`, `ℹ fail 1`.

- [ ] **Step 2: Write the module**

<!-- file: js/steel/section.js -->
```js
// Steel take-off: a section's area and painted perimeter from its dimensions (spec §3, §4), for the NC1 pieces whose
// header leaves the weight or the paint surface empty, for the geometry check, and for the IFC's parametric profiles.
// Dimensions in mm, per DSTV profile code: h height (or diameter), b width, tf flange thickness, tw web thickness, r
// root radius. Returns { area } in mm² and { perimeter } in mm, or null when the dimensions do not describe the
// section. Pure.
const PI = Math.PI;
const pos = v => Number.isFinite(v) && v > 0;
const fil = r => (1 - PI / 4) * r * r;           // the area a fillet of radius r adds to a right-angled corner

// The flange slope of tapered channels (UPN / U: 8 % to DIN 1026-1); every other channel has parallel flanges.
export function taperOf(profile) {
  return /^\s*(UPN|UNP|U)\s*\d/i.test(String(profile || '')) ? 0.08 : 0;
}

// s: { code, h, b, tf, tw, r, r2?, taper?, ri?, profile? }.
export function section(s) {
  const { code } = s;
  const h = s.h, b = s.b, r = pos(s.r) ? s.r : 0;
  const t = pos(s.tw) ? s.tw : s.tf;
  switch (code) {
    case 'I': {
      if (![h, b, s.tf, s.tw].every(pos)) return null;
      return { area: 2 * b * s.tf + (h - 2 * s.tf) * s.tw + 4 * fil(r), perimeter: 2 * h + 4 * b - 2 * s.tw + (2 * PI - 8) * r };
    }
    case 'U':
    case 'C': {
      if (![h, b, s.tf, s.tw].every(pos)) return null;
      // A tapered flange is tf thick at b/2 from the back of the web; r2 rounds the inner corner of its tip.
      const k = Number.isFinite(s.taper) ? s.taper : taperOf(s.profile);
      const r2 = Number.isFinite(s.r2) ? s.r2 : k ? r / 2 : 0;
      const tTip = s.tf - k * b / 2, tRoot = s.tf + k * (b / 2 - s.tw);
      return {
        area: h * s.tw + 2 * (b - s.tw) * (s.tf - k * s.tw / 2) + 2 * (fil(r) - fil(r2)),
        perimeter: h + 2 * b + 2 * tTip + (h - 2 * tRoot) + 2 * (b - s.tw) * Math.sqrt(1 + k * k) + (PI - 4) * (r + r2),
      };
    }
    case 'L': {
      if (![h, t].every(pos)) return null;
      const w = pos(b) ? b : h, r2 = Number.isFinite(s.r2) ? s.r2 : r / 2;
      return { area: t * (h + w - t) + fil(r) - 2 * fil(r2), perimeter: 2 * (h + w) + (PI / 2 - 2) * (r + 2 * r2) };
    }
    case 'T': {
      if (![h, b, s.tf, s.tw].every(pos)) return null;
      return { area: b * s.tf + (h - s.tf) * s.tw + 2 * fil(r), perimeter: 2 * b + 2 * h + (PI - 4) * r };
    }
    case 'M': {
      if (![h, b, t].every(pos)) return null;
      // Corners as EN 10210-2 computes them: outer radius ro (1.5 t when not given), inner radius ro / 1.5.
      const ro = r || 1.5 * t, ri = Number.isFinite(s.ri) ? s.ri : ro / 1.5;
      return { area: 2 * t * (h + b - 2 * t) - (4 - PI) * (ro * ro - ri * ri), perimeter: 2 * (h + b) - (8 - 2 * PI) * ro };
    }
    case 'RO': {
      if (![h, t].every(pos) || 2 * t > h) return null;
      return { area: PI / 4 * (h * h - (h - 2 * t) * (h - 2 * t)), perimeter: PI * h };
    }
    case 'RU': {
      if (!pos(h)) return null;
      return { area: PI / 4 * h * h, perimeter: PI * h };
    }
    case 'B': {
      const { t: th, w } = plateDims(s);
      if (![th, w].every(pos)) return null;
      return { area: w * th, perimeter: 2 * (w + th) };
    }
    default:
      return null;
  }
}

// A flat's or a plate's thickness (the web, else the flange thickness, else the smaller dimension) and its width
// (the other dimension), from the header.
export function plateDims(s) {
  const t = pos(s.tw) ? s.tw : pos(s.tf) ? s.tf : Math.min(s.h || 0, s.b || 0);
  return { t, w: Math.abs((s.h || 0) - t) < 1e-6 ? s.b : s.h };
}
```

Run: `node _tests/extract.mjs $PLAN js/steel/section.js && node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 14`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/steel/section.js _tests/steel/section.test.js
git commit -F - <<'EOF'
Steel take-off: section area and painted perimeter from the dimensions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 3: Plates from their contours

**Files:**
- Create: `js/steel/plate.js`
- Test: `_tests/steel/plate.test.js`

**Interfaces:**
- Produces (`js/steel/plate.js`, pure): `DENSITY` (7850); `arcOf(p, q, r) → { cx, cy, a0, sweep, radius } | null`; `ringArea(ring)` (signed, counter-clockwise positive), `ringLength(ring)`, `ringPolygon(ring, step?) → [x, y, …]`, `polygonArea(xy)`, `polygonBox(xy) → { x0, y0, x1, y1 }`; `holeArea(hole, t)`, `holeEdge(hole)`; `plateFigures({ outer, inner, holes, t }) → { area, edge, kg, m2, check, box }`. A ring is `[{ x, y, r }]` in mm.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/steel/plate.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arcOf, ringArea, ringLength, ringPolygon, polygonArea, polygonBox, holeArea, plateFigures } from '../../js/steel/plate.js';

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} vs ${b}`);
const rect = (w, h) => [{ x: 0, y: 0, r: 0 }, { x: w, y: 0, r: 0 }, { x: w, y: h, r: 0 }, { x: 0, y: h, r: 0 }];
// The end plate of the example: 200 × 400, corners of radius 20, drawn anticlockwise (r > 0: the centre left).
const rounded = [{ x: 20, y: 0, r: 0 }, { x: 180, y: 0, r: 20 }, { x: 200, y: 20, r: 0 }, { x: 200, y: 380, r: 20 }, { x: 180, y: 400, r: 0 },
  { x: 20, y: 400, r: 20 }, { x: 0, y: 380, r: 0 }, { x: 0, y: 20, r: 20 }];

test('an arc: its centre left of the way for r > 0, right for r < 0; a chord longer than 2r is straight', () => {
  const a = arcOf({ x: 180, y: 0 }, { x: 200, y: 20 }, 20);
  near(a.cx, 180); near(a.cy, 20); near(a.sweep, Math.PI / 2);
  const b = arcOf({ x: 180, y: 0 }, { x: 200, y: 20 }, -20);
  near(b.cx, 200); near(b.cy, 0); near(b.sweep, -Math.PI / 2);
  assert.equal(arcOf({ x: 0, y: 0 }, { x: 100, y: 0 }, 10), null);
  assert.equal(arcOf({ x: 0, y: 0 }, { x: 100, y: 0 }, 0), null);
});

test('rings: shoelace plus segments, exact; rounded corners take (4 − π) r² off a rectangle', () => {
  near(ringArea(rect(300, 300)), 90000);
  near(-ringArea([...rect(300, 300)].reverse()), 90000);
  near(ringArea(rounded), 80000 - (4 - Math.PI) * 400);
  near(ringLength(rounded), 2 * (160 + 360) + 2 * Math.PI * 20);
});

test('a circle of two half arcs (as Tekla writes round plates and holes): area, length, and its box from the arcs', () => {
  // A disc of Ø233.7 from (0,0) to (0,233.7): it lies on both sides of x = 0, as its holes at negative x show.
  const disc = [{ x: 0, y: 0, r: 116.85 }, { x: 0, y: 233.7, r: 116.85 }];
  near(ringArea(disc), Math.PI * 116.85 ** 2);
  near(ringLength(disc), 2 * Math.PI * 116.85);
  const box = polygonBox(ringPolygon(disc));
  near(box.x0, -116.85, 1e-3); near(box.x1, 116.85, 1e-3); near(box.y1 - box.y0, 233.7, 1e-6);
  near(-ringArea([{ x: 130, y: 150, r: -20 }, { x: 170, y: 150, r: -20 }]), Math.PI * 400, 1e-9);
});

test('the polygon puts points on the arcs: its area comes within 1 % of the exact one', () => {
  const poly = ringPolygon(rounded);
  assert.ok(poly.length / 2 > 8 + 4 * 6, `${poly.length / 2} points`);
  near(polygonArea(poly), ringArea(rounded), 1e-3);
});

test('holes: round, slotted, and a blind hole by its depth', () => {
  near(holeArea({ d: 22, depth: 0 }, 15), Math.PI * 121);
  near(holeArea({ d: 22, depth: 0, slot: { l: 30 } }, 15), Math.PI * 121 + 660);
  near(holeArea({ d: 22, depth: 5 }, 15), Math.PI * 121 / 3);
  near(holeArea({ d: 22, depth: 20 }, 15), Math.PI * 121, 1e-9);
});

test('a plate: outer ring less inner rings and holes; kg at 7,850 kg/m³; m² both faces and the edges (bores too)', () => {
  const base = plateFigures({ outer: rect(300, 300), inner: [[{ x: 130, y: 150, r: -20 }, { x: 170, y: 150, r: -20 }]], holes: [50, 250].flatMap(x => [{ d: 26, depth: 0 }, { d: 26, depth: 0 }]), t: 20 });
  const net = 90000 - Math.PI * 400 - 4 * Math.PI * 169;
  near(base.area, net);
  near(base.kg, net * 20 * 7.85e-6);
  near(base.edge, 1200 + 2 * Math.PI * 20 + 4 * Math.PI * 26);
  near(base.m2, (2 * net + base.edge * 20) * 1e-6);
  near(base.kg, 13.5992, 1e-4);
  assert.ok(Math.abs(base.check / base.kg - 1) < 0.002, 'the polygon check agrees');
  assert.deepEqual(base.box, { x0: 0, y0: 0, x1: 300, y1: 300 });
  const end = plateFigures({ outer: rounded, holes: Array(6).fill({ d: 22, depth: 0 }), t: 15 });
  near(end.kg, 9.1109, 1e-4);
});
```

Run: `node _tests/extract.mjs $PLAN _tests/steel/plate.test.js && node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 14`, `ℹ fail 1`.

- [ ] **Step 2: Write the module**

<!-- file: js/steel/plate.js -->
```js
// Steel take-off: plates from their NC1 contours (spec §3, §4). A ring is a closed list of { x, y, r } in mm, where r
// is the arc from this point to the next: its centre left of the way for r > 0, right for r < 0, a straight edge for
// 0 (or a radius too small for the chord). The area is exact (shoelace plus circular segments); the polygon puts
// points on the arcs, as the 3D view draws them, and gives the plate's check figure. Pure.
export const DENSITY = 7850;                       // kg/m³, every grade (spec §4)
const KG_PER_MM3 = DENSITY * 1e-9;

// The arc from p to q with radius r: { cx, cy, a0, sweep, radius } (sweep > 0 counter-clockwise), or null for a
// straight edge. Minor arcs only; a chord of exactly 2|r| is a half circle.
export function arcOf(p, q, r) {
  if (!r) return null;
  const dx = q.x - p.x, dy = q.y - p.y, c = Math.hypot(dx, dy), R = Math.abs(r);
  if (!c || c > 2 * R * (1 + 1e-9)) return null;
  const half = Math.asin(Math.min(1, c / (2 * R)));
  const toCentre = Math.sqrt(Math.max(0, R * R - c * c / 4));
  const s = r > 0 ? 1 : -1;                        // centre left (+) or right (−) of p → q
  const cx = (p.x + q.x) / 2 - s * dy / c * toCentre, cy = (p.y + q.y) / 2 + s * dx / c * toCentre;
  return { cx, cy, a0: Math.atan2(p.y - cy, p.x - cx), sweep: s * 2 * half, radius: R };
}

// Signed area (counter-clockwise positive) and length of a ring.
export function ringArea(ring) {
  let a = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const p = ring[i], q = ring[(i + 1) % n];
    a += (p.x * q.y - q.x * p.y) / 2;
    const arc = arcOf(p, q, p.r);
    if (arc) {
      const th = Math.abs(arc.sweep);
      a += Math.sign(p.r) * arc.radius * arc.radius / 2 * (th - Math.sin(th));   // the segment bulges right of p → q for r > 0
    }
  }
  return a;
}
export function ringLength(ring) {
  let l = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const p = ring[i], q = ring[(i + 1) % n], arc = arcOf(p, q, p.r);
    l += arc ? arc.radius * Math.abs(arc.sweep) : Math.hypot(q.x - p.x, q.y - p.y);
  }
  return l;
}

// The ring as a flat polygon [x0, y0, x1, y1, …] (not repeating the first point), arcs cut into steps of at most
// `step` radians.
export function ringPolygon(ring, step = Math.PI / 16) {
  const out = [];
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const p = ring[i], q = ring[(i + 1) % n];
    out.push(p.x, p.y);
    const arc = arcOf(p, q, p.r);
    if (!arc) continue;
    const k = Math.max(2, Math.ceil(Math.abs(arc.sweep) / step));
    for (let j = 1; j < k; j++) {
      const a = arc.a0 + arc.sweep * j / k;
      out.push(arc.cx + arc.radius * Math.cos(a), arc.cy + arc.radius * Math.sin(a));
    }
  }
  return out;
}
export function polygonArea(xy) {
  let a = 0;
  const n = xy.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += xy[2 * i] * xy[2 * j + 1] - xy[2 * j] * xy[2 * i + 1];
  }
  return a / 2;
}
export function polygonBox(xy) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < xy.length; i += 2) {
    x0 = Math.min(x0, xy[i]); x1 = Math.max(x1, xy[i]);
    y0 = Math.min(y0, xy[i + 1]); y1 = Math.max(y1, xy[i + 1]);
  }
  return x0 <= x1 ? { x0, y0, x1, y1 } : { x0: 0, y0: 0, x1: 0, y1: 0 };
}

// A hole's area and bore length in its face: a round hole, or a slot (the hole drawn out by l). A hole shallower
// than the face counts for its depth only.
export function holeArea(h, t) {
  const a = Math.PI * h.d * h.d / 4 + (h.slot ? h.slot.l * h.d : 0);
  return h.depth > 0 && h.depth < t ? a * h.depth / t : a;
}
export const holeEdge = h => Math.PI * h.d + (h.slot ? 2 * h.slot.l : 0);

// A plate: outer ring, inner rings, holes ({ d, depth, slot }) and thickness t (mm). Returns the net face area
// (mm²), the edge length (mm, outer + inner + bores), kg, m² (both faces + edges × t, spec §4) and the outline's
// box. check: the same from the polygons (the 3D build's figure), in kg.
export function plateFigures({ outer, inner = [], holes = [], t }) {
  const net = Math.abs(ringArea(outer)) - inner.reduce((a, r) => a + Math.abs(ringArea(r)), 0) - holes.reduce((a, h) => a + holeArea(h, t), 0);
  const edge = ringLength(outer) + inner.reduce((a, r) => a + ringLength(r), 0) + holes.reduce((a, h) => a + holeEdge(h), 0);
  const poly = ringPolygon(outer);
  const polyNet = Math.abs(polygonArea(poly)) - inner.reduce((a, r) => a + Math.abs(polygonArea(ringPolygon(r))), 0) - holes.reduce((a, h) => a + holeArea(h, t), 0);
  return { area: net, edge, kg: net * t * KG_PER_MM3, m2: (2 * net + edge * t) * 1e-6, check: polyNet * t * KG_PER_MM3, box: polygonBox(poly) };
}
```

Run: `node _tests/extract.mjs $PLAN js/steel/plate.js && node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 20`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/steel/plate.js _tests/steel/plate.test.js
git commit -F - <<'EOF'
Steel take-off: plates from their contours, arcs included

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 4: One NC1 piece's figures

**Files:**
- Create: `js/steel/piece.js`
- Test: `_tests/steel/piece.test.js`

**Interfaces:**
- Consumes: `section`, `plateDims` (Task 2); `plateFigures`, `holeArea`, `DENSITY` (Task 3).
- Produces (`js/steel/piece.js`, pure):
  - `nc1Piece(parsed, file) → row` with `{ source: 'nc1', file, mark, drawing, order, phase, profile, code, grade, gradeText, qty, lengthMm, unitKg, unitM2, checkKg, kgFrom, m2From, warn, excluded, box: [mm × 3], thickness? (plates), nc: parsed }`; `kgFrom`/`m2From` are `header`, `section` or `contour`; `warn` ids `noweight`, `noarea`, `nolength`, `noqty`, `check`; `excluded` for no weight, length or quantity;
  - `gradeOf(name)` (the grade rule), `differs(nominal, check)` (over `CHECK_LIMIT` 0.05), `plateParts(parsed)`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/steel/piece.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nc1Piece, gradeOf, differs, plateParts, CHECK_LIMIT } from '../../js/steel/piece.js';

// A parsed piece as nc1.js returns it.
const piece = (o = {}) => ({ order: 'P1', drawing: 'D1', phase: '1', mark: 'B1', grade: 'S355J2', qty: 2, profile: 'HEA200', code: 'I', length: 4000, sawLength: null,
  h: 190, b: 200, tf: 10, tw: 6.5, r: 18, kgm: 42.3, m2m: 1.136, webStart: 0, webEnd: 0, flangeStart: 0, flangeEnd: 0, text: [], holes: [], contours: [], skipped: {}, ...o });
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} vs ${b}`);

test('a profile: nominal kg and m² from the header per metre; the check from the section less its holes', () => {
  const r = nc1Piece(piece({ holes: [{ face: 'o', x: 100, y: 50, d: 22, depth: 0, slot: null }] }), 'B1.nc1');
  near(r.unitKg, 169.2);
  near(r.unitM2, 4.544);
  assert.deepEqual([r.kgFrom, r.m2From, r.mark, r.grade, r.gradeText, r.qty, r.lengthMm, r.file], ['header', 'header', 'B1', 'S355', 'S355J2', 2, 4000, 'B1.nc1']);
  near(r.checkKg, (5383.12 * 4000 - Math.PI * 121 * 10) * 7.85e-6, 1e-5);
  assert.deepEqual(r.warn, []);
  assert.equal(r.excluded, false);
  assert.deepEqual(r.box, [4000, 190, 200]);
});

test('an empty header weight or paint: from the section dimensions', () => {
  const r = nc1Piece(piece({ kgm: 0, m2m: 0 }));
  near(r.unitKg, 5383.12 * 4000 * 7.85e-6, 1e-5);
  near(r.unitM2, 1136.1 * 4000 * 1e-6, 1e-5);
  assert.deepEqual([r.kgFrom, r.m2From], ['section', 'section']);
});

test('a header weight 5 % off its dimensions is ⚠ check; the quoted figure stays the header\'s', () => {
  assert.equal(CHECK_LIMIT, 0.05);
  const r = nc1Piece(piece({ kgm: 46 }));
  assert.ok(r.warn.includes('check'));
  near(r.unitKg, 184);
  assert.equal(r.excluded, false, 'still in the totals');
  assert.equal(differs(100, 105.1), true);
  assert.equal(differs(100, 104.9), false);
  assert.equal(differs(100, null), false);
});

test('a plate: from its contour, inner contours and holes at 7,850 kg/m³, whatever its header says per metre', () => {
  // Tekla writes a plate's weight per m² (160 for 20 mm) in the kg/m field: it must not be read per metre.
  const disc = { kind: 'AK', face: 'v', pts: [{ x: 0, y: 0, r: 116.85 }, { x: 0, y: 233.7, r: 116.85 }] };
  const r = nc1Piece(piece({ code: 'B', profile: 'PL20*233.7', length: 233.7, h: 233, b: 20, tf: 20, tw: 20, kgm: 160, m2m: 2.347, contours: [disc],
    holes: [21.13, -56.94, 70, -56.32, 22.13].map(x => ({ face: 'v', x, y: 100, d: 25, depth: 0, slot: null })) }));
  const net = Math.PI * 116.85 ** 2 - 5 * Math.PI * 156.25;
  near(r.unitKg, net * 20 * 7.85e-6);
  assert.deepEqual([r.kgFrom, r.m2From, r.thickness], ['contour', 'contour', 20]);
  assert.ok(Math.abs(r.box[0] - 233.7) < 0.01 && Math.abs(r.box[1] - 233.7) < 1e-6 && r.box[2] === 20, `box ${r.box}`);
  assert.ok(Math.abs(r.checkKg / r.unitKg - 1) < 0.01);
  assert.deepEqual(r.warn, []);
});

test('a plate without a contour: its header rectangle', () => {
  const r = nc1Piece(piece({ code: 'B', profile: 'FL100*10', length: 500, h: 100, b: 10, tf: 10, tw: 10, kgm: 0, m2m: 0 }));
  near(r.unitKg, 100 * 500 * 10 * 7.85e-6);
  near(r.unitM2, (2 * 50000 + 1200 * 10) * 1e-6);
  assert.deepEqual(r.box, [500, 100, 10]);
  assert.equal(plateParts(piece()).outer, null);
});

test('no weight (a special profile without kg/m), no length, no quantity: ⚠ and left out of the totals', () => {
  const so = nc1Piece(piece({ code: 'SO', profile: 'ZS175*1.5', kgm: 0, m2m: 0 }));
  assert.deepEqual(so.warn, ['noweight', 'noarea']);
  assert.equal(so.excluded, true);
  const soKg = nc1Piece(piece({ code: 'SO', profile: 'ZS175*1.5', kgm: 4.416, m2m: 0 }));
  assert.deepEqual(soKg.warn, ['noarea'], 'a weight but no paint surface: kept, without m²');
  assert.equal(soKg.excluded, false);
  assert.equal(soKg.checkKg, null);
  assert.deepEqual(nc1Piece(piece({ length: 0 })).warn, ['nolength']);
  assert.equal(nc1Piece(piece({ length: 0 })).excluded, true);
  assert.deepEqual(nc1Piece(piece({ qty: 0 })).warn, ['noqty']);
});

test('the grade rule: S235, S275, S355 or S450 when the name holds one, else as written', () => {
  assert.equal(gradeOf('S355J2+N'), 'S355');
  assert.equal(gradeOf('STEEL/S275J0'), 'S275');
  assert.equal(gradeOf('s450'), 'S450');
  assert.equal(gradeOf('A992'), 'A992');
  assert.equal(gradeOf(' STEEL/300PLUS '), 'STEEL/300PLUS');
  assert.equal(gradeOf(''), '');
});

test('round and angle boxes: a tube is D × D; an equal angle without its width is h × h', () => {
  assert.deepEqual(nc1Piece(piece({ code: 'RO', profile: 'CHS114.3*5', h: 114.3, b: 0, tf: 5, tw: 5, kgm: 13.5 })).box, [4000, 114.3, 114.3]);
  assert.deepEqual(nc1Piece(piece({ code: 'L', profile: 'L80*8', h: 80, b: 0, tf: 8, tw: 8, kgm: 9.63 })).box, [4000, 80, 80]);
});
```

Run: `node _tests/extract.mjs $PLAN _tests/steel/piece.test.js && node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 20`, `ℹ fail 1`.

- [ ] **Step 2: Write the module**

<!-- file: js/steel/piece.js -->
```js
// Steel take-off: one NC1 piece's nominal kg and m², its geometry check figure and its box (spec §4, §5, §7). The
// quoted figures are always the nominal ones; the check is ⚠ above a 5 % difference. Pure.
import { section, plateDims } from './section.js?v=20261104';
import { plateFigures, holeArea, DENSITY } from './plate.js?v=20261104';

export const CHECK_LIMIT = 0.05;
const KG_PER_MM3 = DENSITY * 1e-9;

// The thickness of a profile's face, for the volume its holes take away.
function faceThickness(code, face, s) {
  const t = s.tw > 0 ? s.tw : s.tf;
  if (code === 'I' || code === 'U' || code === 'C' || code === 'T') return face === 'o' || face === 'u' ? (s.tf || t) : (s.tw || t);
  return t || 0;
}

// The grade a piece is grouped and priced by: S235, S275, S355 or S450 when the name holds one, else the name as
// written (spec §3: "STEEL/S275J0" is S275). The NC1 grades follow the same rule, so both sources group alike.
export function gradeOf(name) {
  const s = String(name || '').trim();
  const m = /S(235|275|355|450)/i.exec(s);
  return m ? `S${m[1]}` : s;
}

// Whether a nominal figure and its check differ by more than the limit.
export const differs = (nominal, check) => Number.isFinite(check) && check > 0 && nominal > 0 && Math.abs(nominal - check) / nominal > CHECK_LIMIT;

// The outer and inner rings and the holes of a plate's face v (any face's holes: a plate has one).
export function plateParts(p) {
  const rings = p.contours.filter(c => c.face === 'v');
  const outer = rings.filter(c => c.kind === 'AK').map(c => c.pts);
  return {
    outer: outer.length ? outer.reduce((a, r) => (r.length > a.length ? r : a)) : null,
    inner: rings.filter(c => c.kind === 'IK').map(c => c.pts),
    holes: p.holes,
  };
}

// p: the parser's piece. Returns the take-off row: { source, file, mark, drawing, order, phase, profile, code, grade,
// gradeText (as written), qty, lengthMm, unitKg, unitM2, checkKg, kgFrom, m2From, warn: [...], excluded, box: [mm, mm, mm], nc: p }.
// kgFrom / m2From: 'header', 'section' (from the dimensions) or 'contour' (a plate). warn ids: noweight, noarea,
// nolength, noqty, check.
export function nc1Piece(p, file) {
  const row = {
    source: 'nc1', file, mark: p.mark || '', drawing: p.drawing || '', order: p.order || '', phase: p.phase || '',
    profile: p.profile || '', code: p.code, grade: gradeOf(p.grade), gradeText: p.grade || '', qty: p.qty, lengthMm: p.length,
    unitKg: null, unitM2: null, checkKg: null, kgFrom: null, m2From: null, warn: [], box: [p.length, p.h, p.b], nc: p,
  };
  const L = p.length;
  if (p.code === 'B') {
    const { t, w } = plateDims(p);
    const parts = plateParts(p);
    const outer = parts.outer || [{ x: 0, y: 0, r: 0 }, { x: L, y: 0, r: 0 }, { x: L, y: w, r: 0 }, { x: 0, y: w, r: 0 }];
    const f = plateFigures({ outer, inner: parts.inner, holes: parts.holes, t });
    row.unitKg = f.kg; row.unitM2 = f.m2; row.checkKg = f.check; row.kgFrom = row.m2From = 'contour';
    row.box = [f.box.x1 - f.box.x0, f.box.y1 - f.box.y0, t];
    row.lengthMm = Math.max(row.box[0], row.box[1]);
    row.thickness = t;
  } else {
    const s = section(p);
    if (p.kgm > 0) { row.unitKg = p.kgm * L / 1000; row.kgFrom = 'header'; }
    else if (s) { row.unitKg = s.area * L * KG_PER_MM3; row.kgFrom = 'section'; }
    if (p.m2m > 0) { row.unitM2 = p.m2m * L / 1000; row.m2From = 'header'; }
    else if (s) { row.unitM2 = s.perimeter * L * 1e-6; row.m2From = 'section'; }
    if (s && row.unitKg !== null) {
      const holes = p.holes.reduce((a, h) => a + holeArea(h, faceThickness(p.code, h.face, p)) * faceThickness(p.code, h.face, p), 0);
      row.checkKg = (s.area * L - holes) * KG_PER_MM3;
    }
    if (p.code === 'RO' || p.code === 'RU') row.box = [L, p.h, p.h];
    if (p.code === 'L' && !(p.b > 0)) row.box = [L, p.h, p.h];
  }
  if (row.unitKg === null) row.warn.push('noweight');
  if (row.unitM2 === null) row.warn.push('noarea');
  if (!(L > 0)) row.warn.push('nolength');
  if (!(p.qty > 0)) row.warn.push('noqty');
  if (differs(row.unitKg, row.checkKg)) row.warn.push('check');
  row.excluded = row.warn.some(w => w === 'noweight' || w === 'nolength' || w === 'noqty');
  return row;
}
```

Run: `node _tests/extract.mjs $PLAN js/steel/piece.js && node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 28`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/steel/piece.js _tests/steel/piece.test.js
git commit -F - <<'EOF'
Steel take-off: one NC1 piece's nominal kg and m², its check and its box

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 5: The galvanizing bath

**Files:**
- Create: `js/steel/bath.js`
- Test: `_tests/steel/bath.test.js`

**Interfaces:**
- Produces (`js/steel/bath.js`, pure): `BATH_DEFAULT` `{ length: 12.6, width: 1.3, depth: 1.8 }` (m); `bathFit(box mm × 3, bath) → 'fits' | 'double' | 'no'`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/steel/bath.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bathFit, BATH_DEFAULT } from '../../js/steel/bath.js';

test('the default bath is 12.6 × 1.3 × 1.8 m', () => {
  assert.deepEqual(BATH_DEFAULT, { length: 12.6, width: 1.3, depth: 1.8 });
});

test('fits: the length within the bath length, the cross dimensions within width and depth either way; edges inclusive', () => {
  assert.equal(bathFit([12600, 1300, 1800]), 'fits');
  assert.equal(bathFit([12600, 1800, 1300]), 'fits', 'turned');
  assert.equal(bathFit([4000, 190, 200]), 'fits');
  assert.equal(bathFit([300, 300, 20]), 'fits', 'a plate');
});

test('double dip: longer than the bath, at most twice its length, the cross dimensions fitting', () => {
  assert.equal(bathFit([12601, 100, 50]), 'double');
  assert.equal(bathFit([13500, 100, 50]), 'double');
  assert.equal(bathFit([25200, 100, 50]), 'double');
  assert.equal(bathFit([25201, 100, 50]), 'no');
});

test('doesn\'t fit: a cross dimension too large in every orientation', () => {
  assert.equal(bathFit([6000, 1301, 1801]), 'no');
  assert.equal(bathFit([6000, 1900, 1000]), 'no');
  assert.equal(bathFit([2000, 1700, 1200]), 'fits', 'any orientation: 2.0 along the bath, 1.7 deep, 1.2 wide');
  assert.equal(bathFit([1900, 1750, 1250]), 'fits', 'the longest side along the bath, the next one deep');
  assert.equal(bathFit([1900, 1850, 1250]), 'no', 'only 1.25 fits the width, and neither other side the depth');
});

test('another bath, and empty dimensions', () => {
  const small = { length: 7, width: 1.2, depth: 2.5 };
  assert.equal(bathFit([7000, 1000, 1000], small), 'fits');
  assert.equal(bathFit([13000, 1000, 1000], small), 'double');
  assert.equal(bathFit([15000, 1000, 1000], small), 'no');
  assert.equal(bathFit([4000, NaN, 0]), 'fits');
});
```

Run: `node _tests/extract.mjs $PLAN _tests/steel/bath.test.js && node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 28`, `ℹ fail 1`.

- [ ] **Step 2: Write the module**

<!-- file: js/steel/bath.js -->
```js
// Steel take-off: the galvanizing-bath fit check (spec §5). A guide only; the galvanizer confirms. Pure.
export const BATH_DEFAULT = { length: 12.6, width: 1.3, depth: 1.8 };     // m

const ORDERS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

// box: the piece's three dimensions in mm, in any order; bath in m. 'fits' when one orientation fits the bath,
// 'double' (a double dip) when one fits with the length along the bath up to twice its length, else 'no'.
export function bathFit(box, bath = BATH_DEFAULT) {
  const d = box.map(v => (Number.isFinite(v) && v > 0 ? v / 1000 : 0));
  const L = bath.length, W = bath.width, D = bath.depth;
  if (!(L > 0 && W > 0 && D > 0)) return 'fits';
  let best = 'no';
  for (const [a, b, c] of ORDERS) {
    if (d[b] > W || d[c] > D) continue;
    if (d[a] <= L) return 'fits';
    if (d[a] <= 2 * L) best = 'double';
  }
  return best;
}
```

Run: `node _tests/extract.mjs $PLAN js/steel/bath.js && node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 33`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/steel/bath.js _tests/steel/bath.test.js
git commit -F - <<'EOF'
Steel take-off: the galvanizing-bath fit check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 6: The quote

**Files:**
- Create: `js/steel/quote.js`
- Test: `_tests/steel/quote.test.js`

**Interfaces:**
- Consumes: `bathFit` (Task 5).
- Produces (`js/steel/quote.js`, pure):
  - `takeoff(rows, bath, sort = 'kg') → { rows, groups: [{ key, profile, grade, count, lengthM, kg, m2, rows }], totals: { marks, pieces, kg, m2, lengthM, excluded, noArea, checks, double, no }, longest, heaviest, kgByGrade: { S235, S275, S355, other } }`; it sets `row.bath`;
  - `sortTakeoff(groups, 'kg' | 'length' | 'mark')`, `profileKey(row)`, `gradeBucket(grade)`, `parseRate(s)` (number ≥ 0, null when empty, undefined otherwise), `kg1`, `m2`, `cents`, `mm`, `VAT_RATE` (0.24), `GRADES`;
  - `costs(take, rates) → { lines: [{ id, qty, unit, rate, amount }], subtotal, minimum, minApplies, net, vat, vatOn, total }` with `rates` `{ galv, zinc, paint, steel, perGrade, steelGrade: { S235, S275, S355, other }, minimum, vat }`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/steel/quote.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { takeoff, costs, sortTakeoff, profileKey, parseRate, gradeBucket, VAT_RATE, GRADES, kg1, m2 } from '../../js/steel/quote.js';
import { BATH_DEFAULT } from '../../js/steel/bath.js';

// Rows as piece.js makes them (only the fields the quote reads).
const row = o => ({ mark: 'X', profile: 'HEA200', code: 'I', grade: 'S355', qty: 1, lengthMm: 4000, unitKg: 169.2, unitM2: 4.544, warn: [], excluded: false, box: [4000, 190, 200], ...o });
const rows = () => [
  row({ mark: 'C1', qty: 2 }),
  row({ mark: 'C2', profile: 'HEA 200', qty: 1, lengthMm: 3000, unitKg: 126.9, unitM2: 3.408, box: [3000, 190, 200] }),
  row({ mark: 'R1', profile: 'IPE300', qty: 2, lengthMm: 5025, unitKg: 212.055, unitM2: 5.829, box: [5025, 300, 150] }),
  row({ mark: 'PU1', profile: 'RHS100*50*4', code: 'M', grade: 'S275', qty: 2, lengthMm: 13500, unitKg: 118.53, unitM2: 3.915, box: [13500, 100, 50] }),
  row({ mark: 'BP1', profile: 'PL20*300', code: 'B', grade: 'S275', thickness: 20, qty: 2, lengthMm: 300, unitKg: 13.599, unitM2: 0.2063, box: [300, 300, 20] }),
  row({ mark: 'HP1', profile: 'PL20*250', code: 'B', grade: 'S275', thickness: 20, qty: 1, lengthMm: 250, unitKg: 9.0, unitM2: 0.15, box: [250, 250, 20] }),
  row({ mark: 'Z1', profile: 'ZS175', code: 'SO', grade: 'A992', qty: 3, lengthMm: 1133, unitKg: null, unitM2: null, warn: ['noweight', 'noarea'], excluded: true, box: [1133, 175, 81] }),
  row({ mark: 'G1', profile: 'BIG', code: 'SO', grade: 'S450', qty: 1, lengthMm: 6000, unitKg: 900, unitM2: null, warn: ['noarea', 'check'], box: [6000, 1900, 1000] }),
];

test('groups: by profile (spaces, case and * ignored; plates by thickness) and grade', () => {
  assert.equal(profileKey(row({ profile: 'hea 200' })), 'HEA200');
  assert.equal(profileKey(row({ profile: 'RHS100*50*4' })), 'RHS100X50X4');
  assert.equal(profileKey(row({ code: 'B', thickness: 15, profile: 'PL15*200' })), 'PL 15');
  assert.equal(profileKey(row({ code: 'B', thickness: 12.5 })), 'PL 12.5');
  const t = takeoff(rows(), BATH_DEFAULT);
  assert.deepEqual(t.groups.map(g => [g.profile, g.grade, g.count, g.rows.length]), [
    ['BIG', 'S450', 1, 1], ['HEA200', 'S355', 3, 2], ['IPE300', 'S355', 2, 1], ['RHS100*50*4', 'S275', 2, 1], ['PL 20', 'S275', 3, 2], ['ZS175', 'A992', 3, 1]]);
  const hea = t.groups[1];
  assert.equal(+hea.kg.toFixed(3), 465.3);
  assert.equal(+hea.lengthM.toFixed(3), 11);
  assert.equal(+hea.m2.toFixed(3), 12.496);
});

test('totals: pieces, kg, m² of the rows in the totals; longest and heaviest; ⚠ and ✗ bath counts in pieces', () => {
  const t = takeoff(rows(), BATH_DEFAULT);
  const T = t.totals;
  assert.equal(T.marks, 8);
  assert.equal(T.pieces, 14, 'every piece, also those left out');
  assert.equal(+T.kg.toFixed(3), +(2 * 169.2 + 126.9 + 2 * 212.055 + 2 * 118.53 + 2 * 13.599 + 9 + 900).toFixed(3));
  assert.equal(+T.m2.toFixed(4), +(2 * 4.544 + 3.408 + 2 * 5.829 + 2 * 3.915 + 2 * 0.2063 + 0.15).toFixed(4));
  assert.deepEqual([T.excluded, T.noArea, T.checks, T.double, T.no], [1, 1, 1, 2, 1]);
  assert.equal(t.longest.mark, 'PU1');
  assert.equal(t.heaviest.mark, 'G1');
  assert.equal(t.rows.find(r => r.mark === 'PU1').bath, 'double');
  assert.equal(t.rows.find(r => r.mark === 'G1').bath, 'no');
  assert.equal(+t.kgByGrade.S355.toFixed(3), 889.41);
  assert.equal(+t.kgByGrade.S275.toFixed(3), 273.258);
  assert.equal(+t.kgByGrade.other.toFixed(3), 900, 'S450 and the rest');
  assert.equal(t.kgByGrade.S235, 0);
});

test('sorting: by kg (heaviest first), by length (longest first), by mark (profile, then mark in natural order)', () => {
  const t = takeoff(rows(), BATH_DEFAULT, 'length');
  assert.deepEqual(t.groups.map(g => g.profile), ['RHS100*50*4', 'HEA200', 'IPE300', 'BIG', 'PL 20', 'ZS175'], 'a group left out of the totals has no length');
  sortTakeoff(t.groups, 'mark');
  assert.deepEqual(t.groups.map(g => g.profile), ['BIG', 'HEA200', 'IPE300', 'PL 20', 'RHS100*50*4', 'ZS175']);
  assert.deepEqual(t.groups[3].rows.map(r => r.mark), ['BP1', 'HP1']);
  const marks = takeoff([row({ mark: 'A10' }), row({ mark: 'A9' }), row({ mark: 'a2' })], BATH_DEFAULT, 'mark');
  assert.deepEqual(marks.groups[0].rows.map(r => r.mark), ['a2', 'A9', 'A10']);
  sortTakeoff(t.groups, 'kg');
  assert.deepEqual(t.groups[1].rows.map(r => r.mark), ['C1', 'C2']);
});

test('rates as typed: comma or point, empty is null, anything else is not a rate', () => {
  assert.equal(parseRate('0,45'), 0.45);
  assert.equal(parseRate(' 1 200.5 '), 1200.5);
  assert.equal(parseRate(''), null);
  assert.equal(parseRate('abc'), undefined);
  assert.equal(parseRate('-1'), undefined);
  assert.deepEqual(GRADES, ['S235', 'S275', 'S355', 'other']);
  assert.equal(gradeBucket('S450'), 'other');
});

test('costs: one line per rate filled in, each its shown quantity × rate to the cent; empty rates leave no line', () => {
  const t = takeoff(rows(), BATH_DEFAULT);
  const kg = kg1(t.totals.kg), area = m2(t.totals.m2);
  const c = costs(t, { galv: 0.45, zinc: 0.05, paint: null, steel: 1.1, perGrade: false, minimum: null, vat: true });
  assert.deepEqual(c.lines.map(l => [l.id, l.qty, l.unit, l.rate]), [['galv', kg, 'kg', 0.45], ['zinc', kg, 'kg', 0.05], ['steel', kg, 'kg', 1.1]]);
  assert.equal(c.lines[0].amount, Math.round(kg * 0.45 * 100) / 100);
  assert.equal(c.subtotal, Math.round((c.lines[0].amount + c.lines[1].amount + c.lines[2].amount) * 100) / 100);
  assert.equal(VAT_RATE, 0.24);
  assert.equal(c.vat, Math.round(c.subtotal * 0.24 * 100) / 100);
  assert.equal(c.total, Math.round((c.subtotal + c.vat) * 100) / 100);
  const p = costs(t, { galv: null, zinc: null, paint: 12, steel: null, perGrade: false, minimum: null, vat: false });
  assert.deepEqual(p.lines.map(l => [l.id, l.qty, l.unit]), [['paint', area, 'm2']]);
  assert.deepEqual([p.vat, p.vatOn, p.total], [0, false, p.subtotal]);
  const none = costs(t, { galv: null, zinc: null, paint: null, steel: null, perGrade: false, minimum: 500, vat: true });
  assert.deepEqual([none.lines.length, none.subtotal, none.minApplies, none.total], [0, 0, false, 0], 'no rate: no minimum either');
});

test('the minimum charge replaces a smaller subtotal; VAT on the charged amount', () => {
  const t = takeoff([row({ qty: 1 })], BATH_DEFAULT);
  const c = costs(t, { galv: 0.5, zinc: null, paint: null, steel: null, perGrade: false, minimum: 150, vat: true });
  assert.equal(c.subtotal, 84.6);
  assert.deepEqual([c.minApplies, c.minimum, c.net, c.vat, c.total], [true, 150, 150, 36, 186]);
  const above = costs(t, { galv: 0.5, zinc: null, paint: null, steel: null, perGrade: false, minimum: 50, vat: true });
  assert.deepEqual([above.minApplies, above.net], [false, 84.6]);
});

test('the steel material per grade: one line per grade with kg and a rate', () => {
  const t = takeoff(rows(), BATH_DEFAULT);
  const c = costs(t, { galv: null, zinc: null, paint: null, steel: 9, perGrade: true, steelGrade: { S235: 0.9, S275: 1.0, S355: 1.2, other: null }, minimum: null, vat: false });
  assert.deepEqual(c.lines.map(l => [l.id, l.qty, l.rate]), [['steel.S275', kg1(t.kgByGrade.S275), 1.0], ['steel.S355', kg1(t.kgByGrade.S355), 1.2]], 'S235 has no kg, other no rate');
  assert.equal(c.total, Math.round((kg1(t.kgByGrade.S275) * 1.0 + kg1(t.kgByGrade.S355) * 1.2) * 100) / 100);
});
```

Run: `node _tests/extract.mjs $PLAN _tests/steel/quote.test.js && node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 33`, `ℹ fail 1`.

- [ ] **Step 2: Write the module**

<!-- file: js/steel/quote.js -->
```js
// Steel take-off: the quote (spec §5, §6.3, §6.5, §6.7). Rows are the pieces of piece.js (or of the IFC worker);
// this groups them by profile and grade, totals them, marks the bath fit, and prices the cost lines from the rates the
// visitor types. Figures: kg to 1 decimal, m² to 2, money to the cent; each cost line is its shown quantity times its
// rate, so the sheet adds up. Pure.
import { bathFit } from './bath.js?v=20261104';

export const VAT_RATE = 0.24;
export const GRADES = ['S235', 'S275', 'S355', 'other'];

const round = (v, d) => Math.round((v + Number.EPSILON) * 10 ** d) / 10 ** d;
export const kg1 = v => round(v, 1);
export const m2 = v => round(v, 2);
export const cents = v => round(v, 2);

export const gradeBucket = g => (['S235', 'S275', 'S355'].includes(g) ? g : 'other');

// A thickness or a length in mm as the sheet shows it: at most one decimal.
export const mm = v => String(round(v, 1));

// The profile a row is grouped under: a plate by its thickness ("PL 20"), any other piece by its profile name, with
// spaces and case ignored and * read as x ("HEA 200" and "HEA200" together).
export function profileKey(row) {
  if (row.code === 'B' && row.thickness > 0) return `PL ${mm(row.thickness)}`;
  return String(row.profile || '').toUpperCase().replace(/\s+/g, '').replace(/\*/g, 'X') || '?';
}
const profileLabel = row => (row.code === 'B' && row.thickness > 0 ? `PL ${mm(row.thickness)}` : String(row.profile || '').trim().replace(/\s+/g, ' ') || '?');

const byMark = (a, b) => String(a.mark).localeCompare(String(b.mark), undefined, { numeric: true, sensitivity: 'base' });

// rows → { rows, groups, totals, longest, heaviest, kgByGrade }. Every row gets its bath mark (row.bath). Rows left out
// of the totals (no weight, no length, no quantity) stay listed in their group. sort: 'kg' | 'length' | 'mark'.
export function takeoff(rows, bath, sort = 'kg') {
  const groups = new Map();
  const totals = { marks: rows.length, pieces: 0, kg: 0, m2: 0, lengthM: 0, excluded: 0, noArea: 0, checks: 0, double: 0, no: 0 };
  const kgByGrade = Object.fromEntries(GRADES.map(g => [g, 0]));
  let longest = null, heaviest = null;
  for (const r of rows) {
    r.bath = bathFit(r.box, bath);
    const key = `${profileKey(r)}|${r.grade}`;
    let g = groups.get(key);
    if (!g) groups.set(key, g = { key, profile: profileLabel(r), grade: r.grade, count: 0, lengthM: 0, kg: 0, m2: 0, rows: [] });
    g.rows.push(r);
    const n = r.qty > 0 ? r.qty : 0;
    totals.pieces += n;
    g.count += n;
    if (r.warn.includes('check')) totals.checks++;
    if (r.excluded) { totals.excluded++; continue; }
    if (r.bath === 'double') totals.double += n;
    if (r.bath === 'no') totals.no += n;
    const kg = r.unitKg * n, len = r.lengthMm * n / 1000;
    g.kg += kg; g.lengthM += len;
    totals.kg += kg; totals.lengthM += len;
    kgByGrade[gradeBucket(r.grade)] += kg;
    if (r.unitM2 === null) totals.noArea++;
    else { g.m2 += r.unitM2 * n; totals.m2 += r.unitM2 * n; }
    if (!longest || r.lengthMm > longest.lengthMm) longest = r;
    if (!heaviest || r.unitKg > heaviest.unitKg) heaviest = r;
  }
  const list = [...groups.values()];
  sortTakeoff(list, sort);
  return { rows, groups: list, totals, longest, heaviest, kgByGrade };
}

// Groups and their rows, in place: heaviest or longest first, or by profile and mark.
export function sortTakeoff(groups, sort) {
  const rowKey = { kg: r => -(r.excluded ? -1 : r.unitKg * r.qty), length: r => -r.lengthMm };
  if (sort === 'mark') {
    groups.sort((a, b) => a.profile.localeCompare(b.profile, undefined, { numeric: true }) || a.grade.localeCompare(b.grade));
    for (const g of groups) g.rows.sort(byMark);
  } else {
    const k = rowKey[sort] || rowKey.kg;
    groups.sort((a, b) => (sort === 'length' ? b.lengthM - a.lengthM : b.kg - a.kg) || a.profile.localeCompare(b.profile));
    for (const g of groups) g.rows.sort((a, b) => k(a) - k(b) || byMark(a, b));
  }
  return groups;
}

// The rates as typed: a number ≥ 0, or null when empty (its line stays off the sheet).
export function parseRate(s) {
  const t = String(s == null ? '' : s).trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  const v = Number(t);
  return Number.isFinite(v) && v >= 0 ? v : undefined;            // undefined: not a number
}

// The cost block (spec §6.7). rates: { galv, zinc, paint, steel, perGrade, steelGrade: { S235, S275, S355, other },
// minimum, vat }, each rate a number or null. Returns { lines: [{ id, qty, unit, rate, amount }], subtotal, minimum,
// minApplies, net, vat, total }.
export function costs(t, rates) {
  const kg = kg1(t.totals.kg), area = m2(t.totals.m2);
  const lines = [];
  const line = (id, qty, unit, rate) => { if (rate !== null && rate !== undefined) lines.push({ id, qty, unit, rate, amount: cents(qty * rate) }); };
  line('galv', kg, 'kg', rates.galv);
  line('zinc', kg, 'kg', rates.zinc);
  line('paint', area, 'm2', rates.paint);
  if (rates.perGrade) {
    for (const g of GRADES) if (t.kgByGrade[g] > 0) line(`steel.${g}`, kg1(t.kgByGrade[g]), 'kg', (rates.steelGrade || {})[g] ?? null);
  } else line('steel', kg, 'kg', rates.steel);
  const subtotal = cents(lines.reduce((a, l) => a + l.amount, 0));
  const minimum = rates.minimum > 0 ? rates.minimum : null;
  const minApplies = minimum !== null && lines.length > 0 && subtotal < minimum;
  const net = minApplies ? cents(minimum) : subtotal;
  const vat = rates.vat ? cents(net * VAT_RATE) : 0;
  return { lines, subtotal, minimum, minApplies, net, vat, vatOn: !!rates.vat, total: cents(net + vat) };
}
```

Run: `node _tests/extract.mjs $PLAN js/steel/quote.js && node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 40`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/steel/quote.js _tests/steel/quote.test.js
git commit -F - <<'EOF'
Steel take-off: groups, totals and the cost lines

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 7: The page's pure helpers

**Files:**
- Create: `js/steel/state.js`
- Test: `_tests/steel/state.test.js`

**Interfaces:**
- Consumes: `BATH_DEFAULT` (Task 5); `parseRate`, `GRADES` (Task 6).
- Produces (`js/steel/state.js`, pure): `SETTINGS_KEY` (`aidedcam-steel-settings`), `NC1_MAX` (2000), `IFC_MAX_BYTES` (150 MB), `SORTS`, `RATE_KEYS`; `cleanSettings(raw)`; `parsePositive(s)`, `parseRateInput(s)`; `kindOf(name) → 'nc1' | 'zip' | 'ifc' | 'other'`; `sortSet(files) → { ifc, nc1, zips, skipped }`; `piecesBucket(n)`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/steel/state.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanSettings, kindOf, sortSet, piecesBucket, parsePositive, parseRateInput, SETTINGS_KEY, NC1_MAX, IFC_MAX_BYTES, SORTS, RATE_KEYS } from '../../js/steel/state.js';

test('the limits and keys of spec §6–§7', () => {
  assert.equal(SETTINGS_KEY, 'aidedcam-steel-settings');
  assert.equal(NC1_MAX, 2000);
  assert.equal(IFC_MAX_BYTES, 150 * 1024 * 1024);
  assert.deepEqual(SORTS, ['kg', 'length', 'mark']);
  assert.deepEqual(RATE_KEYS, ['galv', 'zinc', 'paint', 'steel', 'minimum']);
});

test('settings: the defaults, what was stored, and nothing that is not a setting', () => {
  const d = cleanSettings(null);
  assert.deepEqual(d, {
    bath: { length: 12.6, width: 1.3, depth: 1.8 },
    rates: { galv: null, zinc: null, paint: null, steel: null, minimum: null, perGrade: false, steelGrade: { S235: null, S275: null, S355: null, other: null }, vat: true },
    sort: 'kg',
  });
  const s = cleanSettings({ bath: { length: 7, width: -1, depth: 'x' }, rates: { galv: 0.45, zinc: -2, paint: 12, perGrade: true, steelGrade: { S355: 1.2, S999: 3 }, vat: false, other: 5 }, sort: 'colour', extra: 1 });
  assert.deepEqual(s.bath, { length: 7, width: 1.3, depth: 1.8 });
  assert.deepEqual(s.rates, { galv: 0.45, zinc: null, paint: 12, steel: null, minimum: null, perGrade: true, steelGrade: { S235: null, S275: null, S355: 1.2, other: null }, vat: false });
  assert.equal(s.sort, 'kg');
  assert.ok(!('extra' in s));
});

test('numbers as typed', () => {
  assert.equal(parsePositive('12,6'), 12.6);
  assert.equal(parsePositive('0'), undefined);
  assert.equal(parsePositive(''), undefined);
  assert.equal(parseRateInput(''), null);
  assert.equal(parseRateInput('0'), 0);
  assert.equal(parseRateInput('x'), undefined);
});

test('which files a set holds: NC1 (.nc1, .nc, any case), ZIP, one IFC read alone, the rest skipped', () => {
  assert.deepEqual(['a.nc1', 'B.NC1', 'c.nc', 'd.NC', 'e.zip', 'f.IFC', 'g.dxf', 'nc1', 'h.nc1.bak'].map(kindOf), ['nc1', 'nc1', 'nc1', 'nc1', 'zip', 'ifc', 'other', 'other', 'other']);
  const s = sortSet([{ name: 'a.nc1' }, { name: 'b.zip' }, { name: 'c.pdf' }]);
  assert.deepEqual([s.ifc, s.nc1.map(f => f.name), s.zips.map(f => f.name), s.skipped], [null, ['a.nc1'], ['b.zip'], [{ name: 'c.pdf', reason: 'notnc1' }]]);
  const i = sortSet([{ name: 'a.nc1' }, { name: 'm.ifc' }, { name: 'n.ifc' }]);
  assert.equal(i.ifc.name, 'm.ifc');
  assert.deepEqual(i.skipped, [{ name: 'a.nc1', reason: 'ifcalone' }, { name: 'n.ifc', reason: 'ifcalone' }]);
});

test('the GA bucket of a piece count (spec §8)', () => {
  assert.deepEqual([1, 10, 11, 100, 101, 1000, 1001].map(piecesBucket), ['1-10', '1-10', '11-100', '11-100', '101-1000', '101-1000', 'over-1000']);
});
```

Run: `node _tests/extract.mjs $PLAN _tests/steel/state.test.js && node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 40`, `ℹ fail 1`.

- [ ] **Step 2: Write the module**

<!-- file: js/steel/state.js -->
```js
// Steel take-off: the page's pure helpers (spec §6, §7, §8): the settings as stored, numbers as typed, which files
// a dropped set holds, and the GA bucket. No DOM.
import { BATH_DEFAULT } from './bath.js?v=20261104';
import { parseRate, GRADES } from './quote.js?v=20261104';

export const SETTINGS_KEY = 'aidedcam-steel-settings';
export const NC1_MAX = 2000;                                   // spec §7: the first 2,000 NC1 files are read
export const IFC_MAX_BYTES = 150 * 1024 * 1024;                // spec §7: a larger IFC is refused before reading
export const SORTS = ['kg', 'length', 'mark'];
export const RATE_KEYS = ['galv', 'zinc', 'paint', 'steel', 'minimum'];

// A positive number as typed, with a decimal comma or point; undefined when it is not one.
export function parsePositive(s) {
  const v = parseRate(s);
  return v !== null && v !== undefined && v > 0 ? v : undefined;
}

// A rate as typed: a number ≥ 0, null when the field is empty, undefined when it is not a number.
export const parseRateInput = parseRate;

const rate = v => (v === null || (Number.isFinite(v) && v >= 0) ? v : null);

// The stored settings, cleaned: { bath: { length, width, depth }, rates: { galv, zinc, paint, steel, minimum,
// perGrade, steelGrade: { S235, S275, S355, other }, vat }, sort }. Rates are numbers or null (empty).
export function cleanSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const b = s.bath && typeof s.bath === 'object' ? s.bath : {};
  const r = s.rates && typeof s.rates === 'object' ? s.rates : {};
  const g = r.steelGrade && typeof r.steelGrade === 'object' ? r.steelGrade : {};
  const dim = (v, d) => (Number.isFinite(v) && v > 0 && v < 100 ? v : d);
  return {
    bath: { length: dim(b.length, BATH_DEFAULT.length), width: dim(b.width, BATH_DEFAULT.width), depth: dim(b.depth, BATH_DEFAULT.depth) },
    rates: {
      ...Object.fromEntries(RATE_KEYS.map(k => [k, rate(r[k] ?? null)])),
      perGrade: r.perGrade === true,
      steelGrade: Object.fromEntries(GRADES.map(k => [k, rate(g[k] ?? null)])),
      vat: r.vat !== false,
    },
    sort: SORTS.includes(s.sort) ? s.sort : 'kg',
  };
}

// What a file is, by its name: 'nc1' (.nc1, .nc, any case), 'zip', 'ifc' or 'other'.
export function kindOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(String(name || ''));
  const ext = m ? m[1].toLowerCase() : '';
  return ext === 'nc1' || ext === 'nc' ? 'nc1' : ext === 'zip' ? 'zip' : ext === 'ifc' ? 'ifc' : 'other';
}

// A dropped or chosen set: [{ name }] → { ifc: the first IFC or null, nc1: [...], zips: [...], skipped: [{ name,
// reason }] }. One IFC is read alone (spec §2): with an IFC in the set every other file is skipped ('ifcalone').
export function sortSet(files) {
  const ifc = files.find(f => kindOf(f.name) === 'ifc') || null;
  if (ifc) return { ifc, nc1: [], zips: [], skipped: files.filter(f => f !== ifc).map(f => ({ name: f.name, reason: 'ifcalone' })) };
  const out = { ifc: null, nc1: [], zips: [], skipped: [] };
  for (const f of files) {
    const k = kindOf(f.name);
    if (k === 'nc1') out.nc1.push(f);
    else if (k === 'zip') out.zips.push(f);
    else out.skipped.push({ name: f.name, reason: 'notnc1' });
  }
  return out;
}

// The GA bucket of a piece count (spec §8).
export function piecesBucket(n) {
  return n <= 10 ? '1-10' : n <= 100 ? '11-100' : n <= 1000 ? '101-1000' : 'over-1000';
}
```

Run: `node _tests/extract.mjs $PLAN js/steel/state.js && node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 45`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/steel/state.js _tests/steel/state.test.js
git commit -F - <<'EOF'
Steel take-off: settings, file kinds and the GA bucket

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 8: Reading a ZIP

**Files:**
- Create: `js/steel/unzip.js`
- Test: `_tests/steel/unzip.test.js`

**Interfaces:**
- Consumes (test only): `zipStore` of `js/laser/zip.js` (unchanged).
- Produces (`js/steel/unzip.js`): `readZip(bytes) → Promise<{ ok: true, files: [{ name, bytes }] } | { ok: false, reason: 'notzip' | 'encrypted' | 'zip64' | 'method' }>`; `zipEntries(bytes)`; `inflateRaw(bytes)`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/steel/unzip.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipStore } from '../../js/laser/zip.js';
import { readZip, zipEntries, inflateRaw } from '../../js/steel/unzip.js';

const enc = s => new TextEncoder().encode(s);
const dec = b => new TextDecoder().decode(b);
async function deflateRaw(bytes) {
  const s = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

// A small ZIP writer for the tests: entries { name, data, method (0 or 8), flags }, sizes and CRC as given.
async function zip(entries) {
  const parts = [], cen = [];
  let off = 0;
  for (const e of entries) {
    const raw = enc(e.data), body = e.method === 8 ? await deflateRaw(raw) : raw;
    const name = enc(e.name), h = new Uint8Array(30 + name.length), v = new DataView(h.buffer);
    v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, e.flags || 0, true); v.setUint16(8, e.method, true);
    v.setUint32(18, body.length, true); v.setUint32(22, raw.length, true); v.setUint16(26, name.length, true); h.set(name, 30);
    const c = new Uint8Array(46 + name.length), w = new DataView(c.buffer);
    w.setUint32(0, 0x02014b50, true); w.setUint16(6, 20, true); w.setUint16(8, e.flags || 0, true); w.setUint16(10, e.method, true);
    w.setUint32(20, e.csize ?? body.length, true); w.setUint32(24, raw.length, true); w.setUint16(28, name.length, true); w.setUint32(42, off, true); c.set(name, 46);
    parts.push(h, body); cen.push(c);
    off += h.length + body.length;
  }
  const size = cen.reduce((a, c) => a + c.length, 0), end = new Uint8Array(22), x = new DataView(end.buffer);
  x.setUint32(0, 0x06054b50, true); x.setUint16(8, entries.length, true); x.setUint16(10, entries.length, true); x.setUint32(12, size, true); x.setUint32(16, off, true);
  const all = [...parts, ...cen, end], out = new Uint8Array(all.reduce((a, p) => a + p.length, 0));
  let p = 0; for (const a of all) { out.set(a, p); p += a.length; }
  return out;
}

test('stored entries (the laser tool\'s writer): names and bytes back, folders left out', async () => {
  const bytes = zipStore([{ name: 'P1.nc1', bytes: enc('ST\r\n  P1\r\n') }, { name: 'sub/P2.NC1', bytes: enc('ST\n') }]);
  const r = await readZip(bytes);
  assert.equal(r.ok, true);
  assert.deepEqual(r.files.map(f => [f.name, dec(f.bytes)]), [['P1.nc1', 'ST\r\n  P1\r\n'], ['sub/P2.NC1', 'ST\n']]);
  const z = await readZip(await zip([{ name: 'dir/', data: '', method: 0 }, { name: 'dir/a.nc1', data: 'ST', method: 0 }]));
  assert.deepEqual(z.files.map(f => f.name), ['dir/a.nc1']);
});

test('deflated entries through DecompressionStream(\'deflate-raw\')', async () => {
  const text = 'ST\n' + '  HEA200\n'.repeat(500);
  const r = await readZip(await zip([{ name: 'big.nc1', data: text, method: 8 }, { name: 'small.nc', data: 'ST\n', method: 0 }]));
  assert.equal(r.ok, true);
  assert.equal(dec(r.files[0].bytes), text);
  assert.equal(dec(r.files[1].bytes), 'ST\n');
  assert.equal(dec(await inflateRaw(await deflateRaw(enc('abc')))), 'abc');
});

test('refused, naming the reason: another method, encryption, ZIP64, not a ZIP', async () => {
  assert.deepEqual(await readZip(await zip([{ name: 'a.nc1', data: 'ST', method: 12 }])), { ok: false, reason: 'method' });
  assert.deepEqual(await readZip(await zip([{ name: 'a.nc1', data: 'ST', method: 0, flags: 1 }])), { ok: false, reason: 'encrypted' });
  assert.deepEqual(await readZip(await zip([{ name: 'a.nc1', data: 'ST', method: 0, csize: 0xffffffff }])), { ok: false, reason: 'zip64' });
  assert.deepEqual(await readZip(enc('ST\n  not a zip at all, just text\n')), { ok: false, reason: 'notzip' });
  const bad = await zip([{ name: 'a.nc1', data: 'ST'.repeat(50), method: 8 }]);
  bad[34] ^= 0xff; bad[35] ^= 0xff; bad[36] ^= 0xff;                         // the deflate stream damaged
  assert.deepEqual(await readZip(bad), { ok: false, reason: 'notzip' });
  assert.deepEqual(zipEntries(new Uint8Array(10)), { reason: 'notzip' });
});
```

Run: `node _tests/extract.mjs $PLAN _tests/steel/unzip.test.js && node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 45`, `ℹ fail 1`.

- [ ] **Step 2: Write the module**

<!-- file: js/steel/unzip.js -->
```js
// Steel take-off: reads a .zip of NC1 files (spec §3, §7). The central directory names the entries; stored entries
// are copied and deflated ones go through the browser's DecompressionStream('deflate-raw') (Chrome, Firefox, Safari
// 16.4+, and Node). An encrypted entry, ZIP64 or any other method refuses the whole archive, naming the reason.
// Returns { ok: true, files: [{ name, bytes }] } or { ok: false, reason: 'notzip' | 'encrypted' | 'zip64' | 'method' }.
const EOCD = 0x06054b50, CEN = 0x02014b50, LOC = 0x04034b50, EOCD64_LOCATOR = 0x07064b50;

// The entries of the central directory, or { reason } when the archive can't be read here.
export function zipEntries(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 22 - 65535); p--) {
    if (v.getUint32(p, true) === EOCD) { end = p; break; }
  }
  if (end < 0) return { reason: 'notzip' };
  if (end >= 20 && v.getUint32(end - 20, true) === EOCD64_LOCATOR) return { reason: 'zip64' };
  const count = v.getUint16(end + 10, true), size = v.getUint32(end + 12, true), at = v.getUint32(end + 16, true);
  if (count === 0xffff || size === 0xffffffff || at === 0xffffffff) return { reason: 'zip64' };
  if (at + size > end) return { reason: 'notzip' };
  const entries = [];
  const utf8 = new TextDecoder('utf-8'), latin1 = new TextDecoder('latin1');
  for (let p = at, k = 0; k < count; k++) {
    if (p + 46 > bytes.length || v.getUint32(p, true) !== CEN) return { reason: 'notzip' };
    const flags = v.getUint16(p + 8, true), method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true), usize = v.getUint32(p + 24, true);
    const nameLen = v.getUint16(p + 28, true), extraLen = v.getUint16(p + 30, true), commentLen = v.getUint16(p + 32, true);
    const offset = v.getUint32(p + 42, true);
    const raw = bytes.subarray(p + 46, p + 46 + nameLen);
    const name = (flags & 0x800 ? utf8 : latin1).decode(raw);
    if (flags & 1) return { reason: 'encrypted' };
    if (csize === 0xffffffff || usize === 0xffffffff || offset === 0xffffffff) return { reason: 'zip64' };
    if (!name.endsWith('/')) {
      if (method !== 0 && method !== 8) return { reason: 'method' };
      entries.push({ name, method, csize, usize, offset });
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { entries };
}

// Raw deflate → bytes, through the browser's (or Node's) DecompressionStream.
export async function inflateRaw(data) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readZip(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dir = zipEntries(u8);
  if (dir.reason) return { ok: false, reason: dir.reason };
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const files = [];
  for (const e of dir.entries) {
    if (e.offset + 30 > u8.length || v.getUint32(e.offset, true) !== LOC) return { ok: false, reason: 'notzip' };
    const start = e.offset + 30 + v.getUint16(e.offset + 26, true) + v.getUint16(e.offset + 28, true);
    const data = u8.subarray(start, start + e.csize);
    if (data.length !== e.csize) return { ok: false, reason: 'notzip' };
    let out;
    try { out = e.method === 0 ? data.slice() : await inflateRaw(data); }
    catch (err) { return { ok: false, reason: 'notzip' }; }
    files.push({ name: e.name, bytes: out });
  }
  return { ok: true, files };
}
```

Run: `node _tests/extract.mjs $PLAN js/steel/unzip.js && node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 48`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/steel/unzip.js _tests/steel/unzip.test.js
git commit -F - <<'EOF'
Steel take-off: reading a ZIP of NC1 files

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 9: The Excel sheets

**Files:**
- Create: `js/steel/book.js`
- Test: `_tests/steel/book.test.js`

**Interfaces:**
- Consumes: `kg1`, `m2`, `cents` (Task 6); in the test, `writeXlsx` (`js/dwg/xlsx.js`, unchanged), `readZip` (Task 8), `takeoff`, `costs`, `cleanSettings`.
- Produces (`js/steel/book.js`, pure): `workbook({ take, cost, settings, source }, t) → sheets` (Pieces, Profiles, Costs, Settings); `rowNotes(row, t)`; `xlsxName(source, count)`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/steel/book.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workbook, xlsxName, rowNotes } from '../../js/steel/book.js';
import { writeXlsx } from '../../js/dwg/xlsx.js';
import { readZip } from '../../js/steel/unzip.js';
import { takeoff, costs } from '../../js/steel/quote.js';
import { cleanSettings } from '../../js/steel/state.js';

// A translator that shows the key and its parameters, so the sheets can be read without the strings file.
const t = (key, p = {}) => key + (Object.keys(p).length ? JSON.stringify(p) : '');
const row = o => ({ mark: 'X', drawing: 'D1', profile: 'HEA200', code: 'I', grade: 'S355', gradeText: 'S355J2', qty: 1, lengthMm: 4000, unitKg: 169.2, unitM2: 4.544,
  checkKg: 168.9, kgFrom: 'header', warn: [], excluded: false, box: [4000, 190, 200], file: 'X.nc1', ...o });
function model(rates = {}) {
  const settings = cleanSettings({ rates: { galv: 0.45, minimum: 1000, ...rates } });
  const take = takeoff([row({ mark: 'C1', qty: 2 }), row({ mark: 'PU1', profile: 'RHS100*50*4', code: 'M', grade: 'S275', gradeText: 'S275JR', qty: 2, lengthMm: 13500, unitKg: 118.53, unitM2: 3.915, box: [13500, 100, 50], file: 'PU1.nc1' }),
    row({ mark: 'Z1', profile: 'ZS175', code: 'SO', grade: 'A992', gradeText: 'A992', unitKg: null, unitM2: null, kgFrom: null, warn: ['noweight', 'noarea'], excluded: true, checkKg: null })], settings.bath);
  return { take, cost: costs(take, settings.rates), settings, source: 'portal' };
}
// The sheets back through our own reader: name → rows of [cell text].
async function sheets(bytes) {
  const z = await readZip(bytes);
  assert.equal(z.ok, true);
  const files = Object.fromEntries(z.files.map(f => [f.name, new TextDecoder().decode(f.bytes)]));
  const names = [...files['xl/workbook.xml'].matchAll(/<sheet name="([^"]*)"/g)].map(m => m[1]);
  return Object.fromEntries(names.map((n, i) => [n, [...files[`xl/worksheets/sheet${i + 1}.xml`].matchAll(/<row r="\d+">(.*?)<\/row>/g)].map(r =>
    [...r[1].matchAll(/<c r="([A-Z]+)\d+"[^>]*>(?:<v>([^<]*)<\/v>|<is><t[^>]*>([^<]*)<\/t><\/is>)<\/c>/g)].map(c => `${c[1]}:${(c[2] ?? c[3]).replace(/&quot;/g, '"').replace(/&amp;/g, '&')}`))]));
}

test('four sheets in the visitor\'s language: pieces, groups, costs, settings', async () => {
  const s = await sheets(writeXlsx(workbook(model(), t)));
  assert.deepEqual(Object.keys(s), ['st.sheet.pieces', 'st.sheet.groups', 'st.sheet.costs', 'st.sheet.settings']);
});

test('the pieces sheet: one row per mark, kg and m² each and in total as numbers, the left-out row without totals', async () => {
  const s = (await sheets(writeXlsx(workbook(model(), t))))['st.sheet.pieces'];
  assert.deepEqual(s[0].slice(0, 4), ['A:st.col.mark', 'B:st.col.drawing', 'C:st.col.profile', 'D:st.col.grade']);
  assert.deepEqual(s[1], ['A:C1', 'B:D1', 'C:HEA200', 'D:S355J2', 'E:2', 'F:4000', 'G:169.2', 'H:338.4', 'I:4.54', 'J:9.09', 'K:st.from.header', 'L:✓', 'N:X.nc1']);
  assert.deepEqual(s[2].slice(0, 13), ['A:PU1', 'B:D1', 'C:RHS100*50*4', 'D:S275JR', 'E:2', 'F:13500', 'G:118.5', 'H:237.1', 'I:3.92', 'J:7.83', 'K:st.from.header', 'L:⚠', 'M:st.bath.double']);
  assert.deepEqual(s[3].slice(0, 6), ['A:Z1', 'B:D1', 'C:ZS175', 'D:A992', 'E:1', 'F:4000']);
  assert.ok(s[3].includes('M:st.warn.noweight · st.warn.noarea'));
  assert.ok(!s[3].some(c => /^[GHIJ]:/.test(c)), 'no figures for a piece without a weight');
});

test('the groups sheet with its totals; the costs sheet adds up, with the minimum charge and VAT', async () => {
  const s = await sheets(writeXlsx(workbook(model(), t)));
  assert.deepEqual(s['st.sheet.groups'].slice(1), [
    ['A:HEA200', 'B:S355', 'C:2', 'D:8', 'E:338.4', 'F:9.09'],
    ['A:RHS100*50*4', 'B:S275', 'C:2', 'D:27', 'E:237.1', 'F:7.83'],
    ['A:ZS175', 'B:A992', 'C:1', 'D:0', 'E:0', 'F:0'],
    ['A:st.total', 'C:5', 'D:35', 'E:575.5', 'F:16.92'],
  ]);
  assert.deepEqual(s['st.sheet.costs'].slice(1), [
    ['A:st.cost.galv', 'B:575.5', 'C:kg', 'D:0.45', 'E:258.98'],
    ['A:st.cost.subtotal', 'E:258.98'],
    ['A:st.cost.minimum{"min":"1000.00"}', 'E:1000'],
    ['A:st.cost.vat', 'E:240'],
    ['A:st.cost.total', 'E:1240'],
  ]);
});

test('the settings sheet: the bath, every rate (empty ones blank), VAT, the source and the notes', async () => {
  const s = (await sheets(writeXlsx(workbook(model({ perGrade: true, steelGrade: { S355: 1.2 } }), t))))['st.sheet.settings'];
  assert.deepEqual(s.slice(1, 4), [['A:st.set.bath.length', 'B:12.6', 'C:m'], ['A:st.set.bath.width', 'B:1.3', 'C:m'], ['A:st.set.bath.depth', 'B:1.8', 'C:m']]);
  assert.deepEqual(s[4], ['A:st.set.galv', 'B:0.45', 'C:€/kg']);
  assert.deepEqual(s[5], ['A:st.set.zinc', 'C:€/kg']);
  assert.ok(s.some(r => r[0] === 'A:st.set.steel.S355' && r[1] === 'B:1.2'));
  assert.ok(s.some(r => r[0] === 'A:st.set.vat' && r[1] === 'B:st.yes'));
  assert.ok(s.some(r => r[0] === 'A:st.xlsx.source' && r[1] === 'B:portal'));
  assert.ok(s.some(r => r[0] === 'A:st.bath.note'));
});

test('a row\'s notes; the download name', () => {
  assert.equal(rowNotes({ warn: ['check'], checkKg: 180.04, bath: 'fits' }, t), 'st.warn.check.xlsx{"kg":180}');
  assert.equal(rowNotes({ warn: ['geometry'], bath: 'no' }, t), 'st.warn.geometry · st.bath.no');
  assert.equal(xlsxName('portal.ifc', 1), 'steel-takeoff-portal.xlsx');
  assert.equal(xlsxName('Έργο 12/a.zip', 1), 'steel-takeoff-a.xlsx');
  assert.equal(xlsxName('', 37), 'steel-takeoff-37-files.xlsx');
});
```

Run: `node _tests/extract.mjs $PLAN _tests/steel/book.test.js && node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 48`, `ℹ fail 1`.

- [ ] **Step 2: Write the module**

<!-- file: js/steel/book.js -->
```js
// Steel take-off: the Excel file (spec §6.8): four sheets in the visitor's language, pieces, groups, costs and
// settings, for the DWG quantities tool's writer (js/dwg/xlsx.js, reused unchanged). Figures are the sheet's own
// rounding (kg 1 decimal, m² 2, € 2) stored as numbers; t(key, params) is the page's translation. Pure.
import { kg1, m2, cents } from './quote.js?v=20261104';

const num = v => (Number.isFinite(v) ? { v, fmt: 'num' } : '');
const int = v => (Number.isFinite(v) ? { v, fmt: 'int' } : '');
const BATH = { fits: '✓', double: '⚠', no: '✗' };

// The notes of a row, in words: its warnings, and where its weight comes from when not the header.
export function rowNotes(r, t) {
  const out = r.warn.filter(w => w !== 'check').map(w => t(`st.warn.${w}`));
  if (r.warn.includes('check')) out.push(t('st.warn.check.xlsx', { kg: kg1(r.checkKg) }));
  if (r.bath !== 'fits') out.push(t(`st.bath.${r.bath}`));
  return out.join(' · ');
}

// model: { take: quote.takeoff(), cost: quote.costs(), settings, source }. Returns the sheets for writeXlsx.
export function workbook(model, t) {
  const { take, cost, settings } = model;
  const pieces = [];
  for (const g of take.groups) {
    for (const r of g.rows) {
      const n = r.qty > 0 ? r.qty : 0;
      pieces.push([r.mark, r.drawing, g.profile, r.gradeText || r.grade, int(r.qty), num(Math.round(r.lengthMm)),
        num(r.unitKg === null ? null : kg1(r.unitKg)), num(r.excluded ? null : kg1(r.unitKg * n)),
        num(r.unitM2 === null ? null : m2(r.unitM2)), num(r.excluded || r.unitM2 === null ? null : m2(r.unitM2 * n)),
        r.kgFrom ? t(`st.from.${r.kgFrom}`) : '', BATH[r.bath] || '', rowNotes(r, t), r.file || '']);
    }
  }
  const groups = take.groups.map(g => [g.profile, g.grade, int(g.count), num(m2(g.lengthM)), num(kg1(g.kg)), num(m2(g.m2))]);
  const costRows = cost.lines.map(l => [t(`st.cost.${l.id}`), num(l.qty), l.unit === 'm2' ? 'm²' : 'kg', num(l.rate), num(l.amount)]);
  if (!cost.lines.length) costRows.push([t('st.cost.none')]);
  const sumRow = (label, v) => ({ cells: [label, '', '', '', num(v)], bold: true });
  costRows.push(sumRow(t('st.cost.subtotal'), cost.subtotal));
  if (cost.minApplies) costRows.push([t('st.cost.minimum', { min: cents(cost.minimum).toFixed(2) }), '', '', '', num(cost.net)]);
  costRows.push([t(cost.vatOn ? 'st.cost.vat' : 'st.cost.novat'), '', '', '', num(cost.vat)]);
  costRows.push(sumRow(t('st.cost.total'), cost.total));
  const r = settings.rates, b = settings.bath;
  const rateRow = (key, v, unit) => [t(key), v === null ? '' : num(v), unit];
  const settingRows = [
    [t('st.set.bath.length'), num(b.length), 'm'], [t('st.set.bath.width'), num(b.width), 'm'], [t('st.set.bath.depth'), num(b.depth), 'm'],
    rateRow('st.set.galv', r.galv, '€/kg'), rateRow('st.set.zinc', r.zinc, '€/kg'), rateRow('st.set.paint', r.paint, '€/m²'),
    ...(r.perGrade ? ['S235', 'S275', 'S355', 'other'].map(g => rateRow(`st.set.steel.${g}`, r.steelGrade[g], '€/kg')) : [rateRow('st.set.steel', r.steel, '€/kg')]),
    rateRow('st.set.minimum', r.minimum, '€'), [t('st.set.vat'), t(r.vat ? 'st.yes' : 'st.no'), ''],
    [], [t('st.xlsx.source'), model.source || ''], [t('st.indicative')], [t('st.bath.note')],
  ];
  return [
    { name: t('st.sheet.pieces'), columns: [
      { header: t('st.col.mark'), width: 14 }, { header: t('st.col.drawing'), width: 12 }, { header: t('st.col.profile'), width: 16 },
      { header: t('st.col.grade'), width: 12 }, { header: t('st.col.qty'), width: 8, fmt: 'int' }, { header: t('st.col.lengthmm'), width: 12 },
      { header: t('st.col.kgeach'), width: 12 }, { header: t('st.col.kg'), width: 12 }, { header: t('st.col.m2each'), width: 12 },
      { header: t('st.col.m2'), width: 12 }, { header: t('st.col.from'), width: 16 }, { header: t('st.col.bath'), width: 8 },
      { header: t('st.col.notes'), width: 40 }, { header: t('st.col.file'), width: 18 },
    ], rows: pieces },
    { name: t('st.sheet.groups'), columns: [
      { header: t('st.col.profile'), width: 18 }, { header: t('st.col.grade'), width: 10 }, { header: t('st.col.qty'), width: 8, fmt: 'int' },
      { header: t('st.col.lengthm'), width: 12 }, { header: t('st.col.kg'), width: 12 }, { header: t('st.col.m2'), width: 12 },
    ], rows: groups, totals: [t('st.total'), '', int(take.totals.pieces), num(m2(take.totals.lengthM)), num(kg1(take.totals.kg)), num(m2(take.totals.m2))] },
    { name: t('st.sheet.costs'), columns: [
      { header: t('st.col.line'), width: 34 }, { header: t('st.col.amountqty'), width: 12 }, { header: t('st.col.unit'), width: 8 },
      { header: t('st.col.rate'), width: 10 }, { header: t('st.col.eur'), width: 12 },
    ], rows: costRows },
    { name: t('st.sheet.settings'), columns: [{ header: t('st.col.setting'), width: 34 }, { header: t('st.col.value'), width: 12 }, { header: t('st.col.unit'), width: 8 }], rows: settingRows },
  ];
}

// The download's name: steel-takeoff-<the IFC's, the ZIP's or the single NC1's stem>.xlsx, or one for n NC1 files.
export function xlsxName(source, count) {
  const s = String(source || '').replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}._ -]+/gu, '_').trim();
  return s ? `steel-takeoff-${s}.xlsx` : `steel-takeoff-${count}-files.xlsx`;
}
```

Run: `node _tests/extract.mjs $PLAN js/steel/book.js && node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 53`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/steel/book.js _tests/steel/book.test.js
git commit -F - <<'EOF'
Steel take-off: the Excel sheets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 10: The example portal frame

**Files:**
- Create: `_tests/steel/make-example.mjs`, `_tests/steel/example-rows.mjs`
- Modify: `.gitattributes` (the example stays byte-exact)
- Generate: `js/steel/examples/portal/{C1,R1,PU1,CL1,BP1,HP1}.nc1`, `js/steel/examples/portal/index.json`, `js/steel/examples/portal.ifc`
- Test: `_tests/steel/examples.test.js`

**Interfaces:**
- Consumes: `stepFile`, `startModel`, `E` (`_tests/ifcplan/step.mjs`, unchanged); `parseNc1`, `nc1Piece`, `takeoff`.
- Produces: the example (spec §10); `exampleRows()` (`_tests/steel/example-rows.mjs`): its NC1 set as rows, for Tasks 11 and 12.

- [ ] **Step 1: Write the failing test and its helper**

<!-- file: _tests/steel/example-rows.mjs -->
```js
// The example's NC1 set as take-off rows, for the tests that compare it (examples.test.js, ifcread.test.js).
import { readFileSync } from 'node:fs';
import { parseNc1 } from '../../js/steel/nc1.js';
import { nc1Piece } from '../../js/steel/piece.js';

const DIR = new URL('../../js/steel/examples/portal/', import.meta.url);

export function exampleRows() {
  const index = JSON.parse(readFileSync(new URL('index.json', DIR), 'utf8'));
  return index.files.map(f => nc1Piece(parseNc1(readFileSync(new URL(f, DIR), 'latin1')).piece, f));
}
```

<!-- file: _tests/steel/examples.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseNc1 } from '../../js/steel/nc1.js';
import { takeoff, kg1, m2 } from '../../js/steel/quote.js';
import { BATH_DEFAULT } from '../../js/steel/bath.js';
import { exampleRows } from './example-rows.mjs';

const DIR = new URL('../../js/steel/examples/portal/', import.meta.url);

test('the generator is deterministic: --check finds the committed example byte-identical', () => {
  const out = execFileSync(process.execPath, ['_tests/steel/make-example.mjs', '--check'], { encoding: 'utf8' });
  assert.equal(out.trim(), 'same 8 files');
});

test('the NC1 set: six marks in index.json, Tekla-style text (CRLF, ASCII), every file one piece', () => {
  const index = JSON.parse(readFileSync(new URL('index.json', DIR), 'utf8'));
  assert.deepEqual(index.files, ['C1.nc1', 'R1.nc1', 'PU1.nc1', 'CL1.nc1', 'BP1.nc1', 'HP1.nc1']);
  for (const f of index.files) {
    const text = readFileSync(new URL(f, DIR), 'latin1');
    assert.ok(text.startsWith('ST\r\n** AidedCAM example portal frame\r\n') && text.endsWith('EN\r\n'), f);
    assert.ok(!/[^\r\n\x20-\x7e]/.test(text), `${f}: ASCII only`);
    assert.equal(parseNc1(text).ok, true, f);
  }
});

test('the pinned take-off: per mark kg, m² and bath mark; 16 pieces, 1,069.0 kg, 29.89 m²', () => {
  const rows = exampleRows();
  assert.deepEqual(rows.map(r => [r.mark, r.profile, r.grade, r.qty, r.kgFrom, +r.unitKg.toFixed(3), +r.unitM2.toFixed(4), r.warn.join()]), [
    ['C1', 'HEA200', 'S355', 2, 'header', 169.2, 4.544, ''],
    ['R1', 'IPE300', 'S355', 2, 'header', 212.055, 5.829, ''],
    ['PU1', 'RHS100*50*4', 'S275', 2, 'header', 118.53, 3.915, ''],
    ['CL1', 'L80*8', 'S275', 4, 'header', 1.445, 0.0466, ''],
    ['BP1', 'PL20*300', 'S275', 2, 'contour', 13.599, 0.2063, ''],
    ['HP1', 'PL15*200', 'S275', 4, 'contour', 9.111, 0.1785, ''],
  ]);
  const t = takeoff(rows, BATH_DEFAULT);
  assert.deepEqual([t.totals.pieces, kg1(t.totals.kg), m2(t.totals.m2), t.totals.double, t.totals.no, t.totals.checks], [16, 1069, 29.89, 2, 0, 0]);
  assert.deepEqual(rows.map(r => r.bath), ['fits', 'fits', 'double', 'fits', 'fits', 'fits']);
  assert.deepEqual(t.groups.map(g => `${g.profile} ${g.grade}`), ['IPE300 S355', 'HEA200 S355', 'RHS100*50*4 S275', 'PL 15 S275', 'PL 20 S275', 'L80*8 S275']);
  assert.equal(t.longest.mark, 'PU1');
  assert.equal(t.heaviest.mark, 'R1');
});

test('the IFC example is IFC4 text in plain ASCII with unique GlobalIds', () => {
  const text = readFileSync(new URL('../portal.ifc', DIR), 'latin1');
  assert.ok(text.startsWith('ISO-10303-21;\nHEADER;\n') && text.includes("FILE_SCHEMA(('IFC4'));") && text.endsWith('END-ISO-10303-21;\n'));
  assert.ok(!/[^\x0a\x20-\x7e]/.test(text));
  const ids = [...text.matchAll(/^#\d+=IFC\w+\('([0-9A-Za-z_$]{22})'/gm)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  assert.ok(ids.every(g => g.startsWith('2AidedCAMsteelEx')));
  for (const k of ['IFCISHAPEPROFILEDEF', 'IFCRECTANGLEHOLLOWPROFILEDEF', 'IFCLSHAPEPROFILEDEF', 'IFCARBITRARYPROFILEDEFWITHVOIDS', 'IFCINDEXEDPOLYCURVE', 'IFCARCINDEX', 'IFCELEMENTASSEMBLY', "'Tekla Common'", "'Tekla Assembly'"]) assert.ok(text.includes(k), k);
});

test('.gitattributes keeps the example byte-exact', () => {
  assert.ok(readFileSync(new URL('../../.gitattributes', import.meta.url), 'utf8').includes('js/steel/examples/** binary'));
});
```

Run:
```bash
node _tests/extract.mjs $PLAN _tests/steel/example-rows.mjs
node _tests/extract.mjs $PLAN _tests/steel/examples.test.js
node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
```
Expected: `ℹ pass 53`, `ℹ fail 5` (no generator, no example, no `.gitattributes` line).

- [ ] **Step 2: Write the generator and `.gitattributes`, and generate**

<!-- file: _tests/steel/make-example.mjs -->
```js
// Writes the steel take-off's example (spec §10): a small portal frame of our own, so no third-party licence applies,
// as one NC1 file per piece mark in js/steel/examples/portal/ (with index.json, the list the page fetches) and as the
// same frame in IFC4, js/steel/examples/portal.ifc. Deterministic: the same bytes on every run.
//   node _tests/steel/make-example.mjs           write the files
//   node _tests/steel/make-example.mjs --check   compare with the committed files (exit 1 if one differs)
// Run from the repo root. The frame (mm): span 10,000, eaves 4,000, ridge 4,500.
//   C1   2 columns HEA200 S355J2, 4,000 long, 4 holes Ø22 in the top flange
//   R1   2 rafters IPE300 S355J2, 5,025 long, the ridge end cut at 5.7°, 8 holes Ø22 in the web
//   PU1  2 purlins RHS100*50*4 S275JR, 13,500 long (a double dip in the default bath), 4 holes Ø14
//   CL1  4 purlin cleats L80*8 S275JR, 150 long, 2 holes Ø14
//   BP1  2 base plates PL20, 300 × 300, 4 holes Ø26 and a grout hole Ø40 (an inner contour of two arcs)
//   HP1  4 end plates PL15, 200 × 400 with corners of radius 20, 6 holes Ø22
// The NC1 headers carry the catalogue weights and paint surfaces; the IFC carries parametric profiles, the plates as
// profiles with voids, Tekla-style marks (Part mark, Assembly/Cast unit Mark, then Tag, then Name) and the grades as
// materials, in four assemblies.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { stepFile, startModel, E } from '../ifcplan/step.mjs';

const DIR = 'js/steel/examples/portal';
const IFC = 'js/steel/examples/portal.ifc';

// ---- the NC1 files ----
const f2 = v => v.toFixed(2).padStart(10);
const f3 = v => v.toFixed(3).padStart(10);
function nc1(p) {
  const L = ['ST', '** AidedCAM example portal frame', `  ${p.order}`, `  ${p.drawing}`, `  ${p.phase}`, `  ${p.mark}`, `  ${p.grade}`, `  ${p.qty}`,
    `  ${p.profile}`, `  ${p.code}`, `  ${f2(p.length)}`, ...[p.h, p.b, p.tf, p.tw, p.r].map(v => `  ${f2(v)}`), ...[p.kgm, p.m2m].map(v => `  ${f3(v)}`),
    ...(p.cuts || [0, 0, 0, 0]).map(v => `  ${f3(v)}`), '  -', '  -', '  -', '  -'];
  for (const b of p.blocks || []) {
    L.push(b.code);
    for (const row of b.rows) L.push(`  ${row}`);
  }
  L.push('EN');
  return L.join('\r\n') + '\r\n';
}
const hole = (face, x, y, d, ref = 's') => `${face} ${f2(x)}${ref} ${f2(y)} ${f2(d)} ${f2(0)}`;
const pt = (face, x, y, r = 0) => `${face} ${f2(x)}u ${f2(y)} ${f2(r)}`;

const COMMON = { order: 'P-2026-01', phase: '1' };
const PIECES = [
  { ...COMMON, drawing: 'D-101', mark: 'C1', grade: 'S355J2', qty: 2, profile: 'HEA200', code: 'I', length: 4000, h: 190, b: 200, tf: 10, tw: 6.5, r: 18, kgm: 42.3, m2m: 1.136,
    blocks: [{ code: 'BO', rows: [hole('o', 3880, 50, 22), hole('o', 3880, 150, 22), hole('o', 3960, 50, 22), hole('o', 3960, 150, 22)] }] },
  { ...COMMON, drawing: 'D-102', mark: 'R1', grade: 'S355J2', qty: 2, profile: 'IPE300', code: 'I', length: 5025, h: 300, b: 150, tf: 10.7, tw: 7.1, r: 15, kgm: 42.2, m2m: 1.160,
    cuts: [0, 5.7, 0, 0],
    blocks: [{ code: 'BO', rows: [40, 260].flatMap(y => [60, 140, 4885, 4965].map(x => hole('v', x, y, 22))) }] },
  { ...COMMON, drawing: 'D-103', mark: 'PU1', grade: 'S275JR', qty: 2, profile: 'RHS100*50*4', code: 'M', length: 13500, h: 100, b: 50, tf: 4, tw: 4, r: 6, kgm: 8.78, m2m: 0.290,
    blocks: [{ code: 'BO', rows: [100, 13400].flatMap(x => [hole('u', x, 15, 14), hole('u', x, 35, 14)]) }] },
  { ...COMMON, drawing: 'D-103', mark: 'CL1', grade: 'S275JR', qty: 4, profile: 'L80*8', code: 'L', length: 150, h: 80, b: 80, tf: 8, tw: 8, r: 10, kgm: 9.63, m2m: 0.311,
    blocks: [{ code: 'BO', rows: [hole('v', 40, 45, 14), hole('v', 110, 45, 14)] }] },
  { ...COMMON, drawing: 'D-101', mark: 'BP1', grade: 'S275JR', qty: 2, profile: 'PL20*300', code: 'B', length: 300, h: 300, b: 20, tf: 20, tw: 20, r: 0, kgm: 0, m2m: 0,
    blocks: [
      { code: 'AK', rows: [pt('v', 0, 0), pt('v', 300, 0), pt('v', 300, 300), pt('v', 0, 300), pt('v', 0, 0)] },
      { code: 'IK', rows: [pt('v', 130, 150, -20), pt('v', 170, 150, -20), pt('v', 130, 150)] },
      { code: 'BO', rows: [[50, 50], [250, 50], [50, 250], [250, 250]].map(([x, y]) => hole('v', x, y, 26)) },
      { code: 'SI', rows: ['v    20.00s    20.00     0.00   10 BP1'] },
    ] },
  { ...COMMON, drawing: 'D-102', mark: 'HP1', grade: 'S275JR', qty: 4, profile: 'PL15*200', code: 'B', length: 400, h: 200, b: 15, tf: 15, tw: 15, r: 0, kgm: 0, m2m: 0,
    blocks: [
      { code: 'AK', rows: [pt('v', 20, 0), pt('v', 180, 0, 20), pt('v', 200, 20), pt('v', 200, 380, 20), pt('v', 180, 400), pt('v', 20, 400, 20), pt('v', 0, 380), pt('v', 0, 20, 20), pt('v', 20, 0)] },
      { code: 'BO', rows: [[50, 60], [150, 60], [50, 200], [150, 200], [50, 340], [150, 340]].map(([x, y]) => hole('v', x, y, 22)) },
    ] },
];
const files = PIECES.map(p => ({ name: `${p.mark}.nc1`, text: nc1(p) }));
const index = JSON.stringify({ files: files.map(f => f.name) }, null, 2) + '\n';

// ---- the IFC ----
const f = stepFile('2AidedCAMsteelEx');
const { add, guid } = f;
const m = startModel(f, { project: 'AidedCAM example portal frame' });
const P = (x, y, z) => add('IFCCARTESIANPOINT', [x, y, z]);
const D = v => add('IFCDIRECTION', v);
const P2 = (x, y) => add('IFCCARTESIANPOINT', [x, y]);
const centre2 = add('IFCAXIS2PLACEMENT2D', P2(0, 0), null);
const unit = v => { const l = Math.hypot(...v); return v.map(c => c / l); };
const placeAt = (o, axis = null, ref = null) => add('IFCLOCALPLACEMENT', null, add('IFCAXIS2PLACEMENT3D', P(...o), axis ? D(axis) : null, ref ? D(ref) : null));
const extrude = (profile, depth) => m.shape(add('IFCEXTRUDEDAREASOLID', profile, m.axis0, m.zUp, depth));
const label = s => ({ raw: `IFCLABEL('${s}')` });

const site = add('IFCSITE', guid(), null, 'Site', null, null, placeAt([0, 0, 0]), null, null, E('ELEMENT'), null, null, null, null, null);
const building = add('IFCBUILDING', guid(), null, 'Portal', null, null, placeAt([0, 0, 0]), null, null, E('ELEMENT'), null, null, null);
const storey = add('IFCBUILDINGSTOREY', guid(), null, 'Level 0', null, null, placeAt([0, 0, 0]), null, null, E('ELEMENT'), 0);
add('IFCRELAGGREGATES', guid(), null, null, null, m.project, [site]);
add('IFCRELAGGREGATES', guid(), null, null, null, site, [building]);
add('IFCRELAGGREGATES', guid(), null, null, null, building, [storey]);

const HEA200 = add('IFCISHAPEPROFILEDEF', E('AREA'), 'HEA200', centre2, 200, 190, 6.5, 10, 18, null, null);
const IPE300 = add('IFCISHAPEPROFILEDEF', E('AREA'), 'IPE300', centre2, 150, 300, 7.1, 10.7, 15, null, null);
const RHS = add('IFCRECTANGLEHOLLOWPROFILEDEF', E('AREA'), 'RHS100*50*4', centre2, 50, 100, 4, 4, 6);
const L80 = add('IFCLSHAPEPROFILEDEF', E('AREA'), 'L80*8', centre2, 80, 80, 8, 10, 5, null);
const circle = (x, y, r) => add('IFCCIRCLE', add('IFCAXIS2PLACEMENT2D', P2(x, y), null), r);
const polyline = pts => add('IFCPOLYLINE', [...pts, pts[0]].map(([x, y]) => P2(x, y)));
const BASE = add('IFCARBITRARYPROFILEDEFWITHVOIDS', E('AREA'), 'PL20*300', polyline([[0, 0], [300, 0], [300, 300], [0, 300]]),
  [circle(150, 150, 20), ...[[50, 50], [250, 50], [50, 250], [250, 250]].map(([x, y]) => circle(x, y, 13))]);
// The end plate's outline: lines and three-point arcs on one point list (corners of radius 20).
const c45 = 20 - 20 * Math.SQRT1_2;
const list = add('IFCCARTESIANPOINTLIST2D', [[20, 0], [180, 0], [200 - c45, c45], [200, 20], [200, 380], [200 - c45, 400 - c45], [180, 400], [20, 400], [c45, 400 - c45], [0, 380], [0, 20], [c45, c45]]);
const seg = (k, ...ix) => ({ raw: `${k}((${ix.join(',')}))` });
const outline = add('IFCINDEXEDPOLYCURVE', list, [seg('IFCLINEINDEX', 1, 2), seg('IFCARCINDEX', 2, 3, 4), seg('IFCLINEINDEX', 4, 5), seg('IFCARCINDEX', 5, 6, 7),
  seg('IFCLINEINDEX', 7, 8), seg('IFCARCINDEX', 8, 9, 10), seg('IFCLINEINDEX', 10, 11), seg('IFCARCINDEX', 11, 12, 1)], { raw: '.F.' });
const END = add('IFCARBITRARYPROFILEDEFWITHVOIDS', E('AREA'), 'PL15*200', outline,
  [[50, 60], [150, 60], [50, 200], [150, 200], [50, 340], [150, 340]].map(([x, y]) => circle(x, y, 11)));

const parts = [];                                   // { ref, mark: [kind, value], grade }
function part(type, name, tag, placement, shape, mark, grade) {
  const ref = add(type, guid(), null, name, null, null, placement, shape, tag, null);
  parts.push({ ref, mark, grade });
  return ref;
}
const assemblies = [];
function assembly(name, members) {
  const a = add('IFCELEMENTASSEMBLY', guid(), null, name, null, null, placeAt([0, 0, 0]), null, null, E('NOTDEFINED'), E('RIGID_FRAME'));
  add('IFCRELAGGREGATES', guid(), null, null, null, a, members);
  assemblies.push(a);
  return a;
}

const ridge = [5000, 0, 4500];
for (const x of [0, 10000]) {
  const col = part('IFCCOLUMN', 'COLUMN', null, placeAt([x, 0, 0], [0, 0, 1], [0, 1, 0]), extrude(HEA200, 4000), ['part', 'C1'], 'S355J2');
  const base = part('IFCPLATE', 'BP1', null, placeAt([x - 150, -150, -20]), extrude(BASE, 20), null, 'STEEL/S275JR');
  assembly('Column', [col, base]);
  const axis = unit([ridge[0] - x, 0, ridge[2] - 4000]);
  const raf = part('IFCBEAM', 'RAFTER', null, placeAt([x, 0, 4000], axis, [0, 1, 0]), extrude(IPE300, 5025), ['part', 'R1'], 'S355J2');
  const s = x ? -1 : 1;
  const ends = [x + s * 160, 5000 - s * 8].map(px => part('IFCPLATE', 'PLATE', null, placeAt([px, -100, 3850], [1, 0, 0], [0, 1, 0]), extrude(END, 15), ['part', 'HP1'], 'STEEL/S275JR'));
  const cleats = [-1, 1].map(k => part('IFCMEMBER', 'CLEAT', 'CL1', placeAt([x + s * 2500 + k * 60, -75, 4300], [0, 1, 0], [1, 0, 0]), extrude(L80, 150), null, 'STEEL/S275JR'));
  assembly('Rafter', [raf, ...ends, ...cleats]);
}
const purlins = [2500, 7500].map(x => part('IFCMEMBER', 'PURLIN', null, placeAt([x, -6750, 4420], [0, 1, 0], [1, 0, 0]), extrude(RHS, 13500), ['assembly', 'PU1'], 'STEEL/S275JR'));
add('IFCRELCONTAINEDINSPATIALSTRUCTURE', guid(), null, null, null, [...assemblies, ...purlins], storey);

// The marks, as Tekla writes them: a 'Tekla Common' set with the part mark, or a 'Tekla Assembly' set with the
// assembly mark. One set per part; the cleats have only their Tag, the base plates only their Name.
for (const p of parts) {
  if (!p.mark) continue;
  const [kind, value] = p.mark;
  const prop = add('IFCPROPERTYSINGLEVALUE', kind === 'part' ? 'Part mark' : 'Assembly/Cast unit Mark', null, label(value), null);
  const set = add('IFCPROPERTYSET', guid(), null, kind === 'part' ? 'Tekla Common' : 'Tekla Assembly', null, [prop]);
  add('IFCRELDEFINESBYPROPERTIES', guid(), null, null, null, [p.ref], set);
}
for (const grade of ['S355J2', 'STEEL/S275JR']) {
  const mat = add('IFCMATERIAL', grade, null, null);
  add('IFCRELASSOCIATESMATERIAL', guid(), null, null, null, parts.filter(p => p.grade === grade).map(p => p.ref), mat);
}
const ifc = f.text({ name: 'portal.ifc' });

// ---- write or check ----
const outputs = [...files.map(x => [`${DIR}/${x.name}`, x.text]), [`${DIR}/index.json`, index], [IFC, ifc]];
if (process.argv.includes('--check')) {
  let same = true;
  for (const [path, text] of outputs) {
    const ok = existsSync(path) && readFileSync(path, 'latin1') === text;
    if (!ok) { same = false; console.log(`differs ${path}`); }
  }
  console.log(same ? `same ${outputs.length} files` : 'differs');
  process.exit(same ? 0 : 1);
}
mkdirSync(DIR, { recursive: true });
for (const [path, text] of outputs) writeFileSync(path, text, 'latin1');
console.log(`wrote ${outputs.length} files`);
```

<!-- file: .gitattributes -->
```text
# CAD files stay byte-exact: the tests compare them and DXF code pages are not UTF-8.
*.dxf binary
*.dwg binary
# The published WebAssembly engine is build output: served exactly as published, never diffed.
js/laser/engine/** binary
js/dwg/engine/** binary
# The vendored IFC reader is served exactly as published on npm (its hashes are tested), and IFC files are kept
# byte-exact (the example generator compares its output with the committed file).
js/ifcplan/vendor/** binary
*.ifc binary
# The steel take-off's example (NC1 files with CRLF, as Tekla writes them, and its file list) stays byte-exact: the
# generator compares its output with the committed files.
js/steel/examples/** binary
```

Run:
```bash
node _tests/extract.mjs $PLAN _tests/steel/make-example.mjs
node _tests/extract.mjs $PLAN .gitattributes
node _tests/steel/make-example.mjs
node _tests/steel/make-example.mjs --check
node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
```
Expected: `wrote 8 files`, `same 8 files`, `ℹ pass 58`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

`.gitattributes` goes into the same commit, so git stores the NC1 files with their CRLF.
```bash
git add .gitattributes _tests/steel/make-example.mjs _tests/steel/example-rows.mjs _tests/steel/examples.test.js js/steel/examples
git ls-files --eol js/steel/examples/portal/C1.nc1
git commit -F - <<'EOF'
Steel take-off: the example portal frame, as NC1 files and as IFC4

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```
Expected: `i/crlf  w/crlf  attr/-text …C1.nc1`, then the commit.

---

### Task 11: The IFC reader and its worker

**Files:**
- Create: `js/steel/ifcread.js`, `js/steel/worker.js`
- Test: `_tests/steel/ifcread.test.js`, `_tests/steel/worker.test.js`

**Interfaces:**
- Consumes: `unitsOf`, `gather`, `sniff`, `MAX_BYTES` (`js/ifcplan/model.js?v=20261003`, unchanged); web-ifc (`js/ifcplan/vendor/web-ifc/web-ifc-api.js?v=20261003`); `section`, `ringArea`, `ringLength`, `ringPolygon`, `polygonBox`, `DENSITY`, `gradeOf`, `differs`. In the tests: `openApi` (`_tests/ifcplan/webifc-node.mjs`), `stepFile`, `startModel`, `smallModel`, `E` (`_tests/ifcplan/step.mjs`), `exampleRows` (Task 10).
- Produces:
  - `js/steel/ifcread.js`: `readSteel(api, W, id) → { rows, members, assemblies, fromGeometry, unitM, ratio }` (rows in piece.js's shape, with `source: 'ifc'`, `eids`, `assembly`, `checking`, `checkM2`; warn ids also `geometry`, `notsteel`); `checkSteel(api, W, id, read) → [{ row, checkKg, checkM2, check }]`; `packMeshes(api, W, id, maxTriangles) → { mesh: { origin, position, index, parts, triangles } | null, triangles, transfer }`; `meshFigures(P, ix)`, `drawnArea(s)`, `CIRCLE_DRAWN`, `NOT_STEEL`, `MEMBER_TYPES`, `memberCodes(W)`.
  - `js/steel/worker.js`: `createSession(loadApi) → { boot, process(message) → { reply, transfer } }`. `process` with bytes answers `{ type: 'result', id, name, file: { schema, members, assemblies, fromGeometry, unitM }, rows }`; with `settings.check`, `{ type: 'result', id, name, checks }`; with `settings.mesh`, `{ type: 'result', id, name, mesh }` or `{ …, mesh: null, triangles, reason: 'large' }`. Errors `{ type: 'error', id, reason: 'stale' | 'limit' | 'read' | 'schema' | 'nosteel' | 'engine', detail }`. In a worker, it answers the bridge's `boot` and `process`.

- [ ] **Step 1: Write the failing tests**

<!-- file: _tests/steel/ifcread.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openApi } from '../ifcplan/webifc-node.mjs';
import { stepFile, startModel, E } from '../ifcplan/step.mjs';
import { gather } from '../../js/ifcplan/model.js';
import { readSteel, checkSteel, packMeshes, meshFigures, drawnArea, CIRCLE_DRAWN, NOT_STEEL } from '../../js/steel/ifcread.js';
import { section } from '../../js/steel/section.js';
import { takeoff, kg1, m2 } from '../../js/steel/quote.js';
import { BATH_DEFAULT } from '../../js/steel/bath.js';
import { exampleRows } from './example-rows.mjs';

const EXAMPLE = new URL('../../js/steel/examples/portal.ifc', import.meta.url);
const open = async text => { const { api, W } = await openApi(); return { api, W, id: api.OpenModel(typeof text === 'string' ? new TextEncoder().encode(text) : text, { COORDINATE_TO_ORIGIN: false }) }; };

test('the example IFC: 16 members in 6 rows, 4 assemblies, the marks from Tekla sets, Tag and Name, the grades by rule', async () => {
  const { api, W, id } = await open(new Uint8Array(readFileSync(EXAMPLE)));
  const r = readSteel(api, W, id);
  assert.deepEqual([r.members, r.assemblies, r.fromGeometry, r.unitM], [16, 4, 0, 0.001]);
  assert.deepEqual(r.rows.map(x => [x.mark, x.profile, x.code, x.grade, x.gradeText, x.qty, Math.round(x.lengthMm), x.kgFrom, x.checking]), [
    ['C1', 'HEA200', 'I', 'S355', 'S355J2', 2, 4000, 'profile', true],
    ['BP1', 'PL20*300', 'B', 'S275', 'STEEL/S275JR', 2, 300, 'profile', true],
    ['R1', 'IPE300', 'I', 'S355', 'S355J2', 2, 5025, 'profile', true],
    ['HP1', 'PL15*200', 'B', 'S275', 'STEEL/S275JR', 4, 400, 'profile', true],
    ['CL1', 'L80*8', 'L', 'S275', 'STEEL/S275JR', 4, 150, 'profile', true],
    ['PU1', 'RHS100*50*4', 'M', 'S275', 'STEEL/S275JR', 2, 13500, 'profile', true],
  ]);
  assert.deepEqual(r.rows.map(x => x.thickness || null), [null, 20, null, 15, null, null]);
  assert.equal(r.rows[3].eids.length, 4);
  api.CloseModel(id);
});

test('the IFC and its NC1 export agree within 2 % on kg and m² (spec §1, §10), and per mark', async () => {
  const { api, W, id } = await open(new Uint8Array(readFileSync(EXAMPLE)));
  const ifc = takeoff(readSteel(api, W, id).rows, BATH_DEFAULT), nc1 = takeoff(exampleRows(), BATH_DEFAULT);
  assert.ok(Math.abs(ifc.totals.kg / nc1.totals.kg - 1) < 0.02, `${ifc.totals.kg} vs ${nc1.totals.kg}`);
  assert.ok(Math.abs(ifc.totals.m2 / nc1.totals.m2 - 1) < 0.02, `${ifc.totals.m2} vs ${nc1.totals.m2}`);
  assert.deepEqual([kg1(ifc.totals.kg), m2(ifc.totals.m2), ifc.totals.pieces, ifc.totals.double], [1069.2, 29.88, 16, 2]);
  const byMark = t => Object.fromEntries(t.rows.map(x => [x.mark, x.unitKg]));
  const a = byMark(ifc), b = byMark(nc1);
  for (const k of Object.keys(b)) assert.ok(Math.abs(a[k] / b[k] - 1) < 0.02, `${k}: ${a[k]} vs ${b[k]}`);
  api.CloseModel(id);
});

test('the geometry check pass: every member checked, an uncut member equal to its nominal (drawn ÷ exact undone)', async () => {
  const { api, W, id } = await open(new Uint8Array(readFileSync(EXAMPLE)));
  const read = readSteel(api, W, id);
  const checks = checkSteel(api, W, id, read);
  assert.deepEqual(checks.map(c => c.row), [0, 1, 2, 3, 4, 5]);
  assert.ok(checks.every(c => !c.check), JSON.stringify(checks));
  for (const c of checks) {
    const row = read.rows[c.row];
    assert.ok(Math.abs(c.checkKg / row.unitKg - 1) < 0.02, `${row.mark}: ${c.checkKg} vs ${row.unitKg}`);
  }
  const hea = checks[0];
  assert.ok(Math.abs(hea.checkKg / read.rows[0].unitKg - 1) < 0.001, 'the HEA200 equal once its chamfered fillets are allowed for');
  api.CloseModel(id);
});

// One extrusion per parametric profile, 1,000 mm long, as web-ifc 0.0.78 meshes them.
function probe() {
  const f = stepFile('0ProbeProbeProbe'); const { add, guid } = f; const m = startModel(f);
  const c2 = add('IFCAXIS2PLACEMENT2D', add('IFCCARTESIANPOINT', [0, 0]), null);
  const defs = [
    [add('IFCISHAPEPROFILEDEF', E('AREA'), 'HEA200', c2, 200, 190, 6.5, 10, 18, null, null), { code: 'I', h: 190, b: 200, tf: 10, tw: 6.5, r: 18 }],
    [add('IFCUSHAPEPROFILEDEF', E('AREA'), 'PFC250', c2, 250, 90, 8, 15, 12, null, null), { code: 'U', h: 250, b: 90, tf: 15, tw: 8, r: 12, taper: 0 }],
    [add('IFCUSHAPEPROFILEDEF', E('AREA'), 'UPN200', c2, 200, 75, 8.5, 11.5, 11.5, 6, 0.0798), { code: 'U', h: 200, b: 75, tf: 11.5, tw: 8.5, r: 11.5, r2: 6, taper: 0.08 }],
    [add('IFCLSHAPEPROFILEDEF', E('AREA'), 'L80*8', c2, 80, 80, 8, 10, 5, null), { code: 'L', h: 80, b: 80, tf: 8, tw: 8, r: 10, r2: 5 }],
    [add('IFCTSHAPEPROFILEDEF', E('AREA'), 'T100', c2, 100, 100, 11, 11, 11, null, null, null, null, null), { code: 'T', h: 100, b: 100, tf: 11, tw: 11, r: 11 }],
    [add('IFCRECTANGLEHOLLOWPROFILEDEF', E('AREA'), 'RHS', c2, 50, 100, 4, 4, 6), { code: 'M', h: 100, b: 50, tw: 4, tf: 4, r: 6, ri: 4 }],
    [add('IFCCIRCLEHOLLOWPROFILEDEF', E('AREA'), 'CHS', c2, 57.15, 5), { code: 'RO', h: 114.3, tw: 5 }],
    [add('IFCCIRCLEPROFILEDEF', E('AREA'), 'R40', c2, 20), { code: 'RU', h: 40 }],
  ];
  const els = defs.map(([p], i) => add('IFCMEMBER', guid(), null, `P${i}`, null, null, m.place(null, i * 1000, 0, 0), m.shape(add('IFCEXTRUDEDAREASOLID', p, m.axis0, m.zUp, 1000)), null, null));
  return { text: f.text({ name: 'probe.ifc' }), defs: defs.map(d => d[1]), els: els.map(e => Number(e.slice(1))) };
}

test('web-ifc 0.0.78 draws I fillets as 45° chamfers, U and T without fillets or slope, circles as 11-gons: drawnArea matches its meshes', async () => {
  const { text, defs, els } = probe();
  const { api, id } = await open(text);
  const vol = new Map();
  api.StreamAllMeshes(id, ms => { const g = gather(api, id, ms); vol.set(ms.expressID, meshFigures(g.P, g.ix).volume * 1e9 / 1000); });
  const got = defs.map((s, i) => [s.code, Math.round(vol.get(els[i])), Math.round(drawnArea(s)), Math.round(section(s).area)]);
  for (const [code, mesh, drawn] of got) assert.ok(Math.abs(mesh / drawn - 1) < 0.025, `${code}: mesh ${mesh} vs drawn ${drawn}`);
  assert.deepEqual(got.filter(([c]) => c === 'I' || c === 'RO' || c === 'RU').map(([c, mesh, drawn, exact]) => [c, mesh, drawn, exact]),
    [['I', 5753, 5753, 5383], ['RO', 1625, 1625, 1717], ['RU', 1189, 1189, 1257]], 'the I 6.9 % heavier, the tube 5.3 % lighter: a naive check would flag both');
  assert.equal(+CIRCLE_DRAWN.toFixed(4), 0.9465);
  api.CloseModel(id);
});

test('a member without an extruded body is priced from its mesh, marked; a glass or concrete member is left out', async () => {
  const f = stepFile('1SteelTestSteelT'); const { add, guid } = f; const m = startModel(f);
  const box = (w, d, h) => add('IFCEXTRUDEDAREASOLID', add('IFCRECTANGLEPROFILEDEF', E('AREA'), 'FL20*100', add('IFCAXIS2PLACEMENT2D', add('IFCCARTESIANPOINT', [0, 0]), null), w, d), m.axis0, m.zUp, h);
  // Two solids in one body: not one extrusion, so from the mesh.
  const twin = add('IFCPRODUCTDEFINITIONSHAPE', null, null, [add('IFCSHAPEREPRESENTATION', m.body, 'Body', 'SweptSolid', [box(100, 20, 1000), add('IFCEXTRUDEDAREASOLID', add('IFCRECTANGLEPROFILEDEF', E('AREA'), null, add('IFCAXIS2PLACEMENT2D', add('IFCCARTESIANPOINT', [0, 100]), null), 100, 20), m.axis0, m.zUp, 1000)])]);
  add('IFCBEAM', guid(), null, 'TWIN', null, 'TWIN', m.place(null, 0, 0, 0), twin, 'T1', null);
  add('IFCMEMBER', guid(), null, 'GLAS', null, 'PL10*1000', m.place(null, 0, 500, 0), m.shape(box(1000, 10, 2000)), 'G1', null);
  add('IFCMEMBER', guid(), null, 'FLAT', null, null, m.place(null, 0, 900, 0), m.shape(box(100, 20, 3000)), 'F1', null);
  const { api, W, id } = await open(f.text({ name: 't.ifc' }));
  const r = readSteel(api, W, id);
  const [twinRow, glass, flat] = r.rows;
  assert.deepEqual([twinRow.mark, twinRow.kgFrom, twinRow.warn, twinRow.checking], ['T1', 'geometry', ['geometry'], false]);
  assert.ok(Math.abs(twinRow.unitKg - 2 * 100 * 20 * 1000 * 7.85e-6) < 0.01, `${twinRow.unitKg}`);
  assert.deepEqual([glass.mark, glass.warn, glass.excluded], ['G1', ['notsteel'], true]);
  assert.deepEqual([flat.mark, flat.code, flat.thickness, flat.lengthMm], ['F1', 'B', 20, 3000], 'a rectangle bar: a flat, grouped by thickness');
  assert.ok(Math.abs(flat.unitM2 - (2 * 2000 + 240 * 3000) * 1e-6) < 1e-9, 'every face of a flat');
  assert.equal(r.fromGeometry, 1);
  assert.ok(NOT_STEEL.test('CONCRETE/C30/37') && NOT_STEEL.test('Timber') && !NOT_STEEL.test('STEEL/S275JR') && !NOT_STEEL.test('MISCELLANEOUS/8.8.2'));
  api.CloseModel(id);
});

test('the 3D meshes: positions from the lower corner, one index range per member, the cap', async () => {
  const { api, W, id } = await open(new Uint8Array(readFileSync(EXAMPLE)));
  const { mesh, transfer } = packMeshes(api, W, id);
  assert.equal(mesh.parts.length / 3, 16);
  assert.equal(transfer.length, 3);
  let lo = Infinity;
  for (let i = 0; i < mesh.position.length; i++) lo = Math.min(lo, mesh.position[i]);
  assert.ok(Math.abs(lo) < 1e-6, 'relative to the lower corner');
  assert.equal(mesh.index.length / 3, mesh.triangles);
  const large = packMeshes(api, W, id, 10);
  assert.deepEqual([large.mesh, large.triangles > 10], [null, true]);
  api.CloseModel(id);
});
```

<!-- file: _tests/steel/worker.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openApi } from '../ifcplan/webifc-node.mjs';
import { smallModel } from '../ifcplan/step.mjs';
import { createSession } from '../../js/steel/worker.js';

const EXAMPLE = readFileSync(new URL('../../js/steel/examples/portal.ifc', import.meta.url));
const buf = b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const session = () => createSession(openApi);

test('before any file, a check or a mesh request answers stale', async () => {
  const s = session();
  assert.deepEqual((await s.process({ id: 1, settings: { check: true } })).reply, { type: 'error', id: 1, reason: 'stale', detail: '' });
  assert.equal((await s.process({ id: 2, settings: { mesh: true } })).reply.reason, 'stale');
});

test('a file: its rows and figures; then the check pass; then the meshes, all from the open model', async () => {
  const s = session();
  const { reply } = await s.process({ id: 1, name: 'portal.ifc', bytes: buf(EXAMPLE), settings: {} });
  assert.equal(reply.type, 'result');
  assert.deepEqual(reply.file, { schema: 'IFC4', members: 16, assemblies: 4, fromGeometry: 0, unitM: 0.001 });
  assert.equal(reply.rows.length, 6);
  assert.ok(reply.rows.every(r => r.checking && r.checkKg === null));
  const c = (await s.process({ id: 2, name: 'check', settings: { check: true } })).reply;
  assert.deepEqual([c.type, c.name, c.checks.length, c.checks.filter(x => x.check).length], ['result', 'portal.ifc', 6, 0]);
  const m = await s.process({ id: 3, name: 'mesh', settings: { mesh: true, maxTriangles: 1e6 } });
  assert.equal(m.reply.mesh.parts.length, 48);
  assert.equal(m.transfer.length, 3);
  const large = (await s.process({ id: 4, settings: { mesh: true, maxTriangles: 5 } })).reply;
  assert.deepEqual([large.mesh, large.reason], [null, 'large']);
});

test('refusals: no steel members, not an IFC, ifcXML, over the size limit', async () => {
  const s = session();
  const walls = smallModel({ storeys: [{ name: 'G', z: 0 }], elements: [{ storey: 0, type: 'IFCWALL', box: [0, 0, 0, 4000, 200, 3000] }] });
  assert.equal((await s.process({ id: 1, name: 'w.ifc', bytes: buf(new TextEncoder().encode(walls)) })).reply.reason, 'nosteel');
  assert.equal((await s.process({ id: 2, settings: { check: true } })).reply.reason, 'stale', 'a refused file leaves no open model');
  const notIfc = (await s.process({ id: 3, name: 'a.ifc', bytes: buf(new TextEncoder().encode('ST\n  1\n')) })).reply;
  assert.deepEqual([notIfc.reason, notIfc.detail], ['read', 'not-ifc']);
  assert.equal((await s.process({ id: 4, name: 'a.ifc', bytes: buf(new TextEncoder().encode('<?xml version="1.0"?><ifcXML/>')) })).reply.detail, 'ifcxml');
  assert.equal((await s.process({ id: 5, name: 'big.ifc', bytes: { byteLength: 151 * 1024 * 1024 } })).reply.reason, 'limit');
});
```

Run:
```bash
node _tests/extract.mjs $PLAN _tests/steel/ifcread.test.js
node _tests/extract.mjs $PLAN _tests/steel/worker.test.js
node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
```
Expected: `ℹ pass 58`, `ℹ fail 2`.

- [ ] **Step 2: Write the reader and the worker**

<!-- file: js/steel/ifcread.js -->
```js
// Steel take-off: an open web-ifc model read into take-off rows (spec §3, §4, §7). No DOM: it runs in the worker,
// and in the Node tests on the same web-ifc build. `api` is a web-ifc IfcAPI, `W` the web-ifc module. Members are
// IfcBeam, IfcColumn, IfcMember and IfcPlate (and their IFC4 StandardCase forms). A member whose body is one
// IfcExtrudedAreaSolid (also under a boolean clipping or a mapped item) is priced from its profile's parameters; any
// other member from its mesh ("from geometry"). Lengths in mm on the rows; meshes in metres, Z up.
import { unitsOf, gather } from '../ifcplan/model.js?v=20261003';
import { section } from './section.js?v=20261104';
import { ringArea, ringLength, ringPolygon, polygonBox, DENSITY } from './plate.js?v=20261104';
import { gradeOf, differs } from './piece.js?v=20261104';

export const MEMBER_TYPES = ['IFCBEAM', 'IFCBEAMSTANDARDCASE', 'IFCCOLUMN', 'IFCCOLUMNSTANDARDCASE', 'IFCMEMBER', 'IFCMEMBERSTANDARDCASE', 'IFCPLATE', 'IFCPLATESTANDARDCASE'];
const KG_PER_MM3 = DENSITY * 1e-9;
// A member whose material or name says it is not steel: listed, left out of the totals.
export const NOT_STEEL = /\b(CONCRETE|BETON|TIMBER|WOOD|GLULAM|GLASS|GLAS|ALUMIN[A-Z]*)\b/i;
const val = x => (x && typeof x === 'object' && 'value' in x ? x.value : x);
const ref = x => (x && typeof x === 'object' ? x.value : x);

// The member type codes this web-ifc knows.
export const memberCodes = W => MEMBER_TYPES.map(k => W[k]).filter(Number.isFinite);

// The extruded solids of a member's body: walks boolean results (their first operand) and mapped items.
function solidsOf(api, W, id, eid) {
  const out = [];
  const visit = (r, depth) => {
    if (!r || depth > 8) return;
    const item = api.GetLine(id, r);
    const type = api.GetLineType(id, r);
    if (type === W.IFCEXTRUDEDAREASOLID) out.push(item);
    else if (type === W.IFCBOOLEANCLIPPINGRESULT || type === W.IFCBOOLEANRESULT) visit(ref(item.FirstOperand), depth + 1);
    else if (type === W.IFCMAPPEDITEM) {
      const map = api.GetLine(id, ref(item.MappingSource));
      const rep = api.GetLine(id, ref(map.MappedRepresentation));
      for (const it of rep.Items || []) visit(ref(it), depth + 1);
    } else out.push(null);                                        // a brep or anything else: priced from geometry
  };
  try {
    const p = api.GetLine(id, eid);
    if (!p.Representation) return [];
    const pds = api.GetLine(id, ref(p.Representation));
    for (const r of pds.Representations || []) {
      const rep = api.GetLine(id, ref(r));
      const ident = String(val(rep.RepresentationIdentifier) || '').toUpperCase();
      if (ident && ident !== 'BODY') continue;
      for (const it of rep.Items || []) visit(ref(it), 0);
    }
  } catch (e) { return [null]; }
  return out;
}

// A 2D curve of a profile as a ring of { x, y, r } (mm), or null for a curve this reader does not follow: polylines,
// circles, and indexed poly curves of lines and three-point arcs.
function curveRing(api, W, id, cid, mm) {
  const c = api.GetLine(id, cid);
  const type = api.GetLineType(id, cid);
  const xy = p => { const q = api.GetLine(id, ref(p)); return { x: Number(val(q.Coordinates[0])) * mm, y: Number(val(q.Coordinates[1])) * mm, r: 0 }; };
  if (type === W.IFCPOLYLINE) {
    const pts = (c.Points || []).map(xy);
    const a = pts[0], b = pts[pts.length - 1];
    if (pts.length > 1 && Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9) pts.pop();
    return pts.length >= 3 ? pts : null;
  }
  if (type === W.IFCCIRCLE) {
    const pos = api.GetLine(id, ref(c.Position)), o = api.GetLine(id, ref(pos.Location));
    const cx = Number(val(o.Coordinates[0])) * mm, cy = Number(val(o.Coordinates[1])) * mm, R = Number(val(c.Radius)) * mm;
    return [{ x: cx - R, y: cy, r: R }, { x: cx + R, y: cy, r: R }];
  }
  if (type === W.IFCINDEXEDPOLYCURVE) {
    const P = (api.GetLine(id, ref(c.Points)).CoordList || []).map(q => ({ x: Number(val(q[0])) * mm, y: Number(val(q[1])) * mm }));
    // The segments' kinds (IfcLineIndex or IfcArcIndex) are only in the raw line.
    const raw = api.GetRawLineData(id, cid).arguments[1];
    const segs = Array.isArray(raw) && raw.length ? raw.map(sg => ({ arc: sg.typecode === W.IFCARCINDEX, ix: sg.value.map(v => Number(val(v)) - 1) }))
      : [{ arc: false, ix: P.map((_, i) => i) }];
    const ring = [];
    for (const { arc, ix } of segs) {
      if (ix.some(k => !P[k])) return null;
      if (arc && ix.length === 3) {
        // A three-point arc as one ring edge: its radius from the circle through the points, its side from the turn.
        const [a, b, d] = ix.map(k => P[k]);
        const cross = (b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x);
        const R = Math.abs(cross) > 1e-12 ? Math.hypot(b.x - a.x, b.y - a.y) * Math.hypot(d.x - b.x, d.y - b.y) * Math.hypot(d.x - a.x, d.y - a.y) / (2 * Math.abs(cross)) : 0;
        ring.push({ x: a.x, y: a.y, r: cross > 0 ? R : -R });        // (b − a) × (d − a) > 0: b right of a → d, the centre left
      } else for (let k = 0; k < ix.length - 1; k++) ring.push({ ...P[ix[k]], r: 0 });
    }
    const last = segs[segs.length - 1].ix, end = P[last[last.length - 1]], a = ring[0];
    if (a && end && (Math.abs(a.x - end.x) > 1e-9 || Math.abs(a.y - end.y) > 1e-9)) ring.push({ ...end, r: 0 });
    return ring.length >= 2 ? ring : null;
  }
  return null;
}

// A profile definition: { name, s } for the parametric ones (as section() reads them), { name, rings } for a
// rectangle or an arbitrary outline, or null for a profile this reader does not price.
function profileOf(api, W, id, pid, mm) {
  const p = api.GetLine(id, pid);
  const type = api.GetLineType(id, pid);
  const n = k => (val(p[k]) == null ? null : Number(val(p[k])) * mm);
  const name = String(val(p.ProfileName) || '');
  if (type === W.IFCISHAPEPROFILEDEF) return { name, s: { code: 'I', h: n('OverallDepth'), b: n('OverallWidth'), tw: n('WebThickness'), tf: n('FlangeThickness'), r: n('FilletRadius') || 0 } };
  if (type === W.IFCUSHAPEPROFILEDEF) {
    const slope = Number(val(p.FlangeSlope)) || 0;
    return { name, s: { code: 'U', h: n('Depth'), b: n('FlangeWidth'), tw: n('WebThickness'), tf: n('FlangeThickness'), r: n('FilletRadius') || 0, r2: n('EdgeRadius') || 0, taper: Math.tan(slope) } };
  }
  if (type === W.IFCLSHAPEPROFILEDEF) return { name, s: { code: 'L', h: n('Depth'), b: n('Width') || n('Depth'), tw: n('Thickness'), tf: n('Thickness'), r: n('FilletRadius') || 0, r2: n('EdgeRadius') || 0 } };
  if (type === W.IFCTSHAPEPROFILEDEF) return { name, s: { code: 'T', h: n('Depth'), b: n('FlangeWidth'), tw: n('WebThickness'), tf: n('FlangeThickness'), r: n('FilletRadius') || 0 } };
  if (type === W.IFCRECTANGLEHOLLOWPROFILEDEF) return { name, s: { code: 'M', h: n('YDim'), b: n('XDim'), tw: n('WallThickness'), tf: n('WallThickness'), r: n('OuterFilletRadius') || 0, ri: n('InnerFilletRadius') ?? undefined } };
  if (type === W.IFCCIRCLEHOLLOWPROFILEDEF) return { name, s: { code: 'RO', h: 2 * n('Radius'), b: 2 * n('Radius'), tw: n('WallThickness'), tf: n('WallThickness') } };
  if (type === W.IFCCIRCLEPROFILEDEF) return { name, s: { code: 'RU', h: 2 * n('Radius'), b: 2 * n('Radius') } };
  if (type === W.IFCRECTANGLEPROFILEDEF) {
    const x = n('XDim'), y = n('YDim');
    return { name, rect: true, rings: [[{ x: 0, y: 0, r: 0 }, { x, y: 0, r: 0 }, { x, y, r: 0 }, { x: 0, y, r: 0 }]] };
  }
  if (type === W.IFCARBITRARYCLOSEDPROFILEDEF || type === W.IFCARBITRARYPROFILEDEFWITHVOIDS) {
    const outer = curveRing(api, W, id, ref(p.OuterCurve), mm);
    const inner = (p.InnerCurves || []).map(c => curveRing(api, W, id, ref(c), mm));
    return outer && inner.every(Boolean) ? { name, rings: [outer, ...inner] } : null;
  }
  return null;
}

// The area web-ifc 0.0.78 meshes for a parametric profile (measured, and pinned by ifcread.test.js): the I-section's
// root fillets as 45° chamfers; the channel's and the tee's fillets and the channel's flange slope left out; circles
// as 11-gons. The geometry check scales the mesh volume by exact ÷ drawn, so an uncut member checks equal.
export const CIRCLE_DRAWN = 11 * Math.sin(2 * Math.PI / 11) / (2 * Math.PI);
export function drawnArea(s) {
  const exact = section(s);
  if (!exact) return null;
  const r = s.r || 0;
  switch (s.code) {
    case 'I': return exact.area - 4 * (1 - Math.PI / 4) * r * r + 2 * r * r;
    case 'U': case 'C': return 2 * s.b * s.tf + (s.h - 2 * s.tf) * s.tw;
    case 'T': return s.b * s.tf + (s.h - s.tf) * s.tw;
    case 'RO': case 'RU': return exact.area * CIRCLE_DRAWN;
    default: return exact.area;
  }
}

// One extruded solid's nominal figures: { name, code, kg, m2, lengthMm, box, thickness, exact, drawn }. A plate
// (an IfcPlate, or an outline extruded less than its smaller side) and a rectangle bar count every face (spec §4:
// both faces + edges); a profile counts its painted perimeter along its length.
function nominalOf(api, W, id, solid, mm, isPlate) {
  const prof = profileOf(api, W, id, ref(solid.SweptArea), mm);
  const depth = Number(val(solid.Depth)) * mm;
  if (!prof || !(depth > 0)) return null;
  if (prof.s) {
    const s = section(prof.s);
    if (!s) return null;
    const round = prof.s.code === 'RO' || prof.s.code === 'RU';
    const dims = [prof.s.h, round ? prof.s.h : prof.s.code === 'L' ? (prof.s.b || prof.s.h) : prof.s.b];
    return { name: prof.name, code: prof.s.code, kg: s.area * depth * KG_PER_MM3, m2: s.perimeter * depth * 1e-6, lengthMm: depth,
      box: [depth, ...dims], thickness: null, exact: s.area, drawn: drawnArea(prof.s) };
  }
  const [outer, ...inner] = prof.rings;
  const area = Math.abs(ringArea(outer)) - inner.reduce((a, r) => a + Math.abs(ringArea(r)), 0);
  const perimeter = prof.rings.reduce((a, r) => a + ringLength(r), 0);
  const bx = polygonBox(ringPolygon(outer)), dims = [bx.x1 - bx.x0, bx.y1 - bx.y0];
  const plate = isPlate || depth < Math.min(...dims);
  const flat = !plate && prof.rect;
  return {
    name: prof.name, code: plate || flat ? 'B' : 'SO', kg: area * depth * KG_PER_MM3,
    m2: (plate || flat ? 2 * area + perimeter * depth : perimeter * depth) * 1e-6,
    lengthMm: plate ? Math.max(...dims) : depth, box: [depth, ...dims],
    thickness: plate ? depth : flat ? Math.min(...dims) : null, exact: area, drawn: area,
  };
}

// Volume (m³), surface (m²) and bounding box of gather()'s triangles (metres).
export function meshFigures(P, ix) {
  let v = 0, a = 0;
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let k = 0; k < ix.length; k += 3) {
    const i = 3 * ix[k], j = 3 * ix[k + 1], l = 3 * ix[k + 2];
    const ax = P[i], ay = P[i + 1], az = P[i + 2], bx = P[j] - ax, by = P[j + 1] - ay, bz = P[j + 2] - az, cx = P[l] - ax, cy = P[l + 1] - ay, cz = P[l + 2] - az;
    const nx = by * cz - bz * cy, ny = bz * cx - bx * cz, nz = bx * cy - by * cx;
    if (!Number.isFinite(nx + ny + nz)) continue;
    a += Math.hypot(nx, ny, nz) / 2;
    v += (ax * nx + ay * ny + az * nz) / 6;
  }
  for (let k = 0; k < P.length; k += 3) {
    if (!Number.isFinite(P[k] + P[k + 1] + P[k + 2])) continue;
    for (let c = 0; c < 3; c++) { b[c] = Math.min(b[c], P[k + c]); b[c + 3] = Math.max(b[c + 3], P[k + c]); }
  }
  return { volume: Math.abs(v), area: a, box: b };
}

// The marks, materials and assemblies of the members, each in one pass over its relations.
function relations(api, W, id, members) {
  const marks = new Map(), grades = new Map(), assembly = new Map();
  const each = (type, fn) => { const ids = api.GetLineIDsWithType(id, type); for (let i = 0; i < ids.size(); i++) fn(api.GetLine(id, ids.get(i))); };
  each(W.IFCRELDEFINESBYPROPERTIES, r => {
    const objs = (r.RelatedObjects || []).map(ref).filter(o => members.has(o));
    if (!objs.length || !r.RelatingPropertyDefinition) return;
    const def = ref(r.RelatingPropertyDefinition);
    if (api.GetLineType(id, def) !== W.IFCPROPERTYSET) return;
    const set = api.GetLine(id, def);
    const setName = String(val(set.Name) || '');
    if (setName !== 'Tekla Common' && setName !== 'Tekla Assembly') return;
    for (const pr of set.HasProperties || []) {
      const p = api.GetLine(id, ref(pr));
      const pn = String(val(p.Name) || '');
      const key = setName === 'Tekla Common' && pn === 'Part mark' ? 'part' : setName === 'Tekla Assembly' && pn === 'Assembly/Cast unit Mark' ? 'assembly' : null;
      const v = String(val(p.NominalValue) ?? '').trim();
      if (!key || !v) continue;
      for (const o of objs) { const m = marks.get(o) || {}; m[key] = v; marks.set(o, m); }
    }
  });
  const materialName = mid => {
    const m = api.GetLine(id, mid);
    const type = api.GetNameFromTypeCode(api.GetLineType(id, mid)).toUpperCase();
    if (type === 'IFCMATERIAL') return String(val(m.Name) || '');
    if (type === 'IFCMATERIALLIST') return m.Materials && m.Materials.length ? materialName(ref(m.Materials[0])) : '';
    if (type === 'IFCMATERIALPROFILESETUSAGE') return materialName(ref(m.ForProfileSet));
    if (type === 'IFCMATERIALPROFILESET') return m.MaterialProfiles && m.MaterialProfiles.length ? materialName(ref(m.MaterialProfiles[0])) : '';
    if (type === 'IFCMATERIALPROFILE' || type === 'IFCMATERIALLAYER') return m.Material ? materialName(ref(m.Material)) : '';
    if (type === 'IFCMATERIALLAYERSETUSAGE') return materialName(ref(m.ForLayerSet));
    if (type === 'IFCMATERIALLAYERSET') return m.MaterialLayers && m.MaterialLayers.length ? materialName(ref(m.MaterialLayers[0])) : '';
    return String(val(m.Name) || '');
  };
  each(W.IFCRELASSOCIATESMATERIAL, r => {
    const objs = (r.RelatedObjects || []).map(ref).filter(o => members.has(o));
    if (!objs.length) return;
    let name = '';
    try { name = materialName(ref(r.RelatingMaterial)); } catch (e) { name = ''; }
    for (const o of objs) if (!grades.has(o)) grades.set(o, name);
  });
  each(W.IFCRELAGGREGATES, r => {
    const whole = ref(r.RelatingObject);
    if (api.GetLineType(id, whole) !== W.IFCELEMENTASSEMBLY) return;
    for (const o of r.RelatedObjects || []) if (members.has(ref(o))) assembly.set(ref(o), whole);
  });
  return { marks, grades, assembly };
}

// The model's members as take-off rows (the same shape as piece.js's), with the members that share a mark, a
// profile, a grade, a length and a weight listed once with their count. A member priced from its profile waits for
// checkSteel (row.checking); one priced from geometry is meshed here, alone (GetFlatMesh: no booleans to wait for).
// Returns { rows, members, assemblies, fromGeometry, unitM, ratio } with ratio: eid → exact ÷ drawn area.
export function readSteel(api, W, id) {
  const unitM = unitsOf(api, W, id).lengthM, mm = unitM * 1000;
  const found = [];                                                // [eid, type code], in the file's order
  for (const c of memberCodes(W)) { const ids = api.GetLineIDsWithType(id, c); for (let i = 0; i < ids.size(); i++) found.push([ids.get(i), c]); }
  const members = new Map(found.sort((a, b) => a[0] - b[0]));
  const ratio = new Map();
  if (!members.size) return { rows: [], members: 0, assemblies: 0, fromGeometry: 0, unitM, ratio };
  const { marks, grades, assembly } = relations(api, W, id, members);
  const rows = [], byKey = new Map();
  let fromGeometry = 0;
  for (const [eid, code] of members) {
    const e = api.GetLine(id, eid);
    const isPlate = code === W.IFCPLATE || code === W.IFCPLATESTANDARDCASE;
    const solids = solidsOf(api, W, id, eid);
    const nominal = solids.length === 1 && solids[0] ? nominalOf(api, W, id, solids[0], mm, isPlate) : null;
    let g = null;
    if (!nominal) {
      const flat = api.GetFlatMesh(id, eid);
      const t = gather(api, id, flat);
      if (t.ix.length) g = meshFigures(t.P, t.ix);
      if (!g) continue;                                            // no body at all
    }
    const m = marks.get(eid) || {};
    const mark = m.part || m.assembly || String(val(e.Tag) || '').trim() || String(val(e.Name) || '').trim();
    const gradeText = grades.get(eid) || '';
    const row = {
      source: 'ifc', file: '', mark, drawing: '', order: '', phase: '', grade: gradeOf(gradeText), gradeText, qty: 1,
      profile: nominal ? nominal.name || String(val(e.ObjectType) || '') : String(val(e.ObjectType) || val(e.Name) || ''),
      code: nominal ? nominal.code : isPlate ? 'B' : 'SO', unitKg: null, unitM2: null, checkKg: null, checkM2: null, checking: !!nominal,
      kgFrom: nominal ? 'profile' : 'geometry', m2From: nominal ? 'profile' : 'geometry', warn: [], eids: [eid], assembly: assembly.get(eid) || null,
    };
    if (nominal) {
      Object.assign(row, { unitKg: nominal.kg, unitM2: nominal.m2, lengthMm: nominal.lengthMm, box: nominal.box });
      if (nominal.thickness) row.thickness = nominal.thickness;
      ratio.set(eid, nominal.drawn > 0 ? nominal.exact / nominal.drawn : 1);
    } else {
      fromGeometry++;
      const b = g.box, d = [b[3] - b[0], b[4] - b[1], b[5] - b[2]].map(v => v * 1000).sort((x, y) => y - x);
      Object.assign(row, { unitKg: g.volume * DENSITY, unitM2: g.area, lengthMm: d[0], box: d });
      row.warn.push('geometry');
      if (isPlate) row.thickness = Math.round(d[2] * 10) / 10;
    }
    if (NOT_STEEL.test(`${gradeText} ${val(e.Name) || ''}`)) row.warn.push('notsteel');
    if (!(row.unitKg > 0)) row.warn.push('noweight');
    row.excluded = row.warn.includes('noweight') || row.warn.includes('notsteel');
    const key = [row.mark, row.profile, row.grade, Math.round(row.lengthMm), Math.round(row.unitKg * 10), row.excluded].join('|');
    const same = byKey.get(key);
    if (same) { same.qty++; same.eids.push(eid); continue; }
    byKey.set(key, row);
    rows.push(row);
  }
  const assemblies = new Set([...members.keys()].map(e => assembly.get(e)).filter(Boolean)).size;
  return { rows, members: members.size, assemblies, fromGeometry, unitM, ratio };
}

// The geometry check of the members priced from their profiles (spec §4): each member's mesh volume × 7,850, scaled
// by exact ÷ drawn area (drawnArea), and its mesh surface. This pass waits for web-ifc's booleans (bolt holes, cuts),
// so it runs after the rows are shown. Per row, the member farthest from the nominal weight speaks for the row.
// Returns [{ row, checkKg, checkM2, check }] with check true above the 5 % limit.
export function checkSteel(api, W, id, read) {
  const fig = new Map();
  api.StreamAllMeshesWithTypes(id, memberCodes(W), m => {
    const k = read.ratio.get(m.expressID);
    if (k === undefined) return;
    const g = gather(api, id, m);
    if (!g.ix.length) return;
    const f = meshFigures(g.P, g.ix);
    fig.set(m.expressID, { kg: f.volume * DENSITY * k, m2: f.area });
  });
  const out = [];
  read.rows.forEach((r, i) => {
    if (!r.checking) return;
    let worst = null;
    for (const e of r.eids) {
      const f = fig.get(e);
      if (f && (!worst || Math.abs(f.kg - r.unitKg) > Math.abs(worst.kg - r.unitKg))) worst = f;
    }
    out.push({ row: i, checkKg: worst ? worst.kg : null, checkM2: worst ? worst.m2 : null, check: !!worst && differs(r.unitKg, worst.kg) });
  });
  return out;
}

// The members' triangles for the 3D view (spec §3): one Float32 position array relative to the model's lower
// corner, one index array, and per member [eid, first index, index count]. Returns { mesh, transfer } with
// mesh null and reason 'large' above maxTriangles.
export function packMeshes(api, W, id, maxTriangles = Infinity) {
  const list = [];
  let nv = 0, ni = 0;
  const lo = [Infinity, Infinity, Infinity];
  api.StreamAllMeshesWithTypes(id, memberCodes(W), m => {
    const g = gather(api, id, m);
    if (!g.ix.length) return;
    list.push({ eid: m.expressID, P: g.P, ix: g.ix });
    nv += g.P.length / 3; ni += g.ix.length;
    for (let k = 0; k < g.P.length; k += 3) for (let c = 0; c < 3; c++) if (Number.isFinite(g.P[k + c])) lo[c] = Math.min(lo[c], g.P[k + c]);
  });
  if (ni / 3 > maxTriangles) return { mesh: null, triangles: ni / 3, transfer: [] };
  const origin = lo.map(v => (Number.isFinite(v) ? v : 0));
  const position = new Float32Array(nv * 3), index = new Uint32Array(ni), parts = new Int32Array(list.length * 3);
  let pv = 0, pi = 0;
  list.forEach((e, k) => {
    for (let j = 0; j < e.P.length; j += 3) for (let c = 0; c < 3; c++) position[3 * pv + 3 * (j / 3) + c] = Number.isFinite(e.P[j + c]) ? e.P[j + c] - origin[c] : 0;
    parts[3 * k] = e.eid; parts[3 * k + 1] = pi; parts[3 * k + 2] = e.ix.length;
    for (let j = 0; j < e.ix.length; j++) index[pi + j] = pv + e.ix[j];
    pv += e.P.length / 3; pi += e.ix.length;
  });
  return { mesh: { origin, position, index, parts, triangles: ni / 3 }, transfer: [position.buffer, index.buffer, parts.buffer] };
}
```

<!-- file: js/steel/worker.js -->
```js
// Steel take-off: the module worker that holds web-ifc (spec §3), on the IFC floor plans tool's vendored copy. It
// answers the messages of the shared js/laser/bridge.js: 'boot' loads web-ifc and answers 'ready'; 'process' with an
// IFC's bytes opens the model and answers its take-off rows; 'process' with settings.check answers the open model's
// geometry check; 'process' with settings.mesh answers its members' triangles for the 3D view, or "large" above
// settings.maxTriangles. The model stays open until the next file. Single-threaded web-ifc: a static host needs no
// cross-origin isolation. createSession is the whole logic without the worker's globals, for the Node tests.
import * as WebIFC from '../ifcplan/vendor/web-ifc/web-ifc-api.js?v=20261003';
import { sniff, MAX_BYTES } from '../ifcplan/model.js?v=20261003';
import { readSteel, checkSteel, packMeshes } from './ifcread.js?v=20261104';

const supported = (W, schema) => (W.SchemaNames || []).some(names => Array.isArray(names) && names.includes(schema));

// loadApi: async () => ({ api, W }). Returns { boot, process(message) → { reply, transfer } }.
export function createSession(loadApi) {
  let booted = null;
  let open = null;                                            // { id, read, name }: the model kept for the check and 3D
  const boot = () => booted || (booted = loadApi());
  const error = (id, reason, detail = '') => ({ reply: { type: 'error', id, reason, detail }, transfer: [] });

  async function process(m) {
    const { api, W } = await boot();
    const settings = m.settings || {};
    try {
      if (settings.check || settings.mesh) {
        if (!open) return error(m.id, 'stale');               // the worker restarted, or the last file failed
        if (settings.check) return { reply: { type: 'result', id: m.id, name: open.name, checks: checkSteel(api, W, open.id, open.read) }, transfer: [] };
        const max = Number.isFinite(settings.maxTriangles) && settings.maxTriangles > 0 ? settings.maxTriangles : Infinity;
        const { mesh, triangles, transfer } = packMeshes(api, W, open.id, max);
        return { reply: mesh ? { type: 'result', id: m.id, name: open.name, mesh } : { type: 'result', id: m.id, name: open.name, mesh: null, triangles, reason: 'large' }, transfer };
      }
      if (open) { try { api.CloseModel(open.id); } catch (e) { /* already gone */ } open = null; }
      if (!m.bytes || m.bytes.byteLength > MAX_BYTES) return error(m.id, 'limit');
      const bytes = new Uint8Array(m.bytes);
      const s = sniff(bytes);
      if (!s.ok) return error(m.id, s.reason, s.detail);
      const id = api.OpenModel(bytes, { COORDINATE_TO_ORIGIN: false });
      if (id < 0) return supported(W, s.schema) ? error(m.id, 'read') : error(m.id, 'schema', s.schema);
      const read = readSteel(api, W, id);
      if (!read.rows.length) { api.CloseModel(id); return error(m.id, 'nosteel'); }
      open = { id, read, name: m.name };
      const file = { schema: api.GetModelSchema(id) || s.schema, members: read.members, assemblies: read.assemblies, fromGeometry: read.fromGeometry, unitM: read.unitM };
      return { reply: { type: 'result', id: m.id, name: m.name, file, rows: read.rows }, transfer: [] };
    } catch (err) {
      // web-ifc out of memory or aborted: the bridge restarts the worker on an 'engine' error.
      open = null;
      return error(m.id, 'engine', String((err && err.message) || err));
    }
  }
  return { boot, process };
}

async function browserApi() {
  const api = new WebIFC.IfcAPI();
  await api.Init(file => new URL(`../ifcplan/vendor/web-ifc/${file}?v=20261003`, import.meta.url).href, true);
  api.SetLogLevel(WebIFC.LogLevel.LOG_LEVEL_OFF);
  return { api, W: WebIFC };
}

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  const session = createSession(browserApi);
  let ready = false;
  self.onmessage = async e => {
    const m = e.data;
    try {
      await session.boot();
      if (!ready) { ready = true; self.postMessage({ type: 'ready' }); }
    } catch (err) {
      if (m.type === 'process') self.postMessage({ type: 'error', id: m.id, reason: 'engine', detail: String((err && err.message) || err) });
      return;
    }
    if (m.type !== 'process') return;
    const { reply, transfer } = await session.process(m);
    self.postMessage(reply, transfer);
  };
}
```

Run:
```bash
node _tests/extract.mjs $PLAN js/steel/ifcread.js
node _tests/extract.mjs $PLAN js/steel/worker.js
node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
```
Expected: `ℹ pass 67`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/steel/ifcread.js js/steel/worker.js _tests/steel/ifcread.test.js _tests/steel/worker.test.js
git commit -F - <<'EOF'
Steel take-off: the IFC reader, its geometry check and its worker

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 12: An NC1 piece as slabs

**Files:**
- Create: `js/steel/shape3d.js`
- Test: `_tests/steel/shape3d.test.js`

**Interfaces:**
- Consumes: `ringPolygon` (Task 3), `plateDims` (Task 2); in the test, `polygonArea`, `exampleRows`.
- Produces (`js/steel/shape3d.js`, pure): `pieceSlabs(parsed) → [{ outline: [x, y, …], holes: [[x, y, …]], depth, frame: { o, u, v, w }, part: 'web' | 'flange' | 'plate' | 'body' }]` (mm; u × v = w); `slabsBox(slabs) → { min, max }`; `cutRect(L, w, start, end)`; `circle(cx, cy, r, n)`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/steel/shape3d.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pieceSlabs, slabsBox, cutRect, circle } from '../../js/steel/shape3d.js';
import { polygonArea } from '../../js/steel/plate.js';
import { exampleRows } from './example-rows.mjs';

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const byMark = Object.fromEntries(exampleRows().map(r => [r.mark, r.nc]));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

test('an I section: web and two flanges, each extruded by its own thickness, in right-handed frames', () => {
  const s = pieceSlabs(byMark.C1);
  assert.deepEqual(s.map(x => [x.part, x.depth]), [['web', 6.5], ['flange', 10], ['flange', 10]]);
  for (const x of s) assert.deepEqual(cross(x.frame.u, x.frame.v), x.frame.w);
  assert.deepEqual(s[1].holes.length, 4, 'the four holes of face o in the top flange');
  assert.deepEqual(slabsBox(s), { min: [0, 0, 0], max: [4000, 200, 190] });
  assert.deepEqual(s[0].frame.o, [0, 103.25, 0], 'the web on the centre line');
});

test('header cut angles lean the ends of a face without a contour; a contour wins', () => {
  assert.deepEqual(cutRect(1000, 100, 0, 0), [0, 0, 1000, 0, 1000, 100, 0, 100]);
  const r = cutRect(1000, 100, 0, 45);
  near(r[2], 1000 - 100); near(r[4], 1000);
  const web = pieceSlabs(byMark.R1)[0];
  near(web.outline[2], 5025 - Math.tan(5.7 * Math.PI / 180) * 300, 1e-9);
  assert.equal(web.holes.length, 8);
  assert.equal(pieceSlabs(byMark.R1)[1].outline[2], 5025, 'the flanges have no cut');
});

test('a plate: one slab from its AK contour (arcs as points) with its IK contours and holes as openings', () => {
  const [hp] = pieceSlabs(byMark.HP1);
  assert.deepEqual([hp.part, hp.depth, hp.holes.length], ['plate', 15, 6]);
  near(polygonArea(hp.outline), 80000 - (4 - Math.PI) * 400, 15);
  const [bp] = pieceSlabs(byMark.BP1);
  assert.equal(bp.holes.length, 5, 'the grout hole (an inner contour of two arcs) and four bolt holes');
  near(Math.abs(polygonArea(bp.holes[0])), Math.PI * 400, 15);
});

test('a hollow section: four walls; an angle: two legs; a tube or bar: its section along the length', () => {
  const pu = pieceSlabs(byMark.PU1);
  assert.deepEqual(pu.map(x => x.part), ['web', 'web', 'flange', 'flange']);
  assert.deepEqual(slabsBox(pu), { min: [0, 0, 0], max: [13500, 50, 100] });
  assert.equal(pu[3].holes.length, 4, 'the holes of face u in the bottom wall');
  const cl = pieceSlabs(byMark.CL1);
  assert.deepEqual(cl.map(x => [x.part, x.depth, x.holes.length]), [['web', 8, 2], ['flange', 8, 0]]);
  const tube = pieceSlabs({ ...byMark.C1, code: 'RO', h: 114.3, b: 114.3, tw: 5, tf: 5, holes: [], contours: [] });
  assert.deepEqual([tube.length, tube[0].depth, tube[0].holes.length, tube[0].frame.w], [1, 4000, 1, [1, 0, 0]]);
  const bar = pieceSlabs({ ...byMark.C1, code: 'RU', h: 40, holes: [], contours: [] });
  assert.equal(bar[0].holes.length, 0);
});

test('a special profile is its box; a piece without a length or dimensions has no slabs', () => {
  const so = pieceSlabs({ ...byMark.C1, code: 'SO', h: 175, b: 81, holes: [], contours: [] });
  assert.deepEqual([so.length, so[0].part, so[0].outline], [1, 'body', [0, 0, 81, 0, 81, 175, 0, 175]]);
  assert.deepEqual(pieceSlabs({ ...byMark.C1, length: 0 }), []);
  assert.deepEqual(pieceSlabs({ ...byMark.C1, code: 'SO', h: 0, b: 0 }), []);
  assert.equal(circle(0, 0, 1, 8).length, 16);
});
```

Run: `node _tests/extract.mjs $PLAN _tests/steel/shape3d.test.js && node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 67`, `ℹ fail 1`.

- [ ] **Step 2: Write the module**

<!-- file: js/steel/shape3d.js -->
```js
// Steel take-off: one NC1 piece as slabs for the 3D view (spec §3). Pure, and Node-tested: view3d.js only turns each
// slab into a three.js extrusion. A slab is a flat outline with holes, in its own (u, v) plane, extruded along w by
// its depth, placed by its frame { o, u, v, w } in the piece's axes: x along the length, y across the width, z up,
// all in mm. A profile is its faces (web, flanges, legs, walls) each as a slab with that face's outline (its AK
// contour, else a rectangle whose ends follow the header's cut angles), its IK contours and its BO holes; a plate is
// one slab; a tube, a bar or a special profile is its section extruded along the length.
import { ringPolygon } from './plate.js?v=20261104';
import { plateDims } from './section.js?v=20261104';

const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1], NY = [0, -1, 0];
const STEP = Math.PI / 12;

// A circle as a flat polygon, counter-clockwise.
export function circle(cx, cy, r, n = 24) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; out.push(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
  return out;
}

// A rectangle 0..L × 0..w whose two ends lean by the cut angles (degrees from square): each end moves by
// tan(angle) × w across the face, kept inside 0..L.
export function cutRect(L, w, start = 0, end = 0) {
  const s = Math.max(-L / 2, Math.min(L / 2, Math.tan(start * Math.PI / 180) * w));
  const e = Math.max(-L / 2, Math.min(L / 2, Math.tan(end * Math.PI / 180) * w));
  return [Math.max(0, s), 0, L - Math.max(0, e), 0, L - Math.max(0, -e), w, Math.max(0, -s), w];
}

// The faces of each profile code: [face letters, frame, outline width, thickness] (frames in mm from the header).
function faces(p) {
  const { h, b } = p, tw = p.tw || p.tf, tf = p.tf || p.tw;
  switch (p.code) {
    case 'I': return [[['v', 'h'], { o: [0, b / 2 + tw / 2, 0], u: X, v: Z, w: NY }, h, tw, 'web'],
      [['o'], { o: [0, 0, h - tf], u: X, v: Y, w: Z }, b, tf, 'flange'], [['u'], { o: [0, 0, 0], u: X, v: Y, w: Z }, b, tf, 'flange']];
    case 'U': case 'C': return [[['v', 'h'], { o: [0, tw, 0], u: X, v: Z, w: NY }, h, tw, 'web'],
      [['o'], { o: [0, 0, h - tf], u: X, v: Y, w: Z }, b, tf, 'flange'], [['u'], { o: [0, 0, 0], u: X, v: Y, w: Z }, b, tf, 'flange']];
    case 'T': return [[['v', 'h'], { o: [0, b / 2 + tw / 2, 0], u: X, v: Z, w: NY }, h, tw, 'web'],
      [['o', 'u'], { o: [0, 0, h - tf], u: X, v: Y, w: Z }, b, tf, 'flange']];
    case 'L': return [[['v', 'h'], { o: [0, tw, 0], u: X, v: Z, w: NY }, h, tw, 'web'],
      [['o', 'u'], { o: [0, 0, 0], u: X, v: Y, w: Z }, b > 0 ? b : h, tw, 'flange']];
    case 'M': return [[['v'], { o: [0, tw, 0], u: X, v: Z, w: NY }, h, tw, 'web'], [['h'], { o: [0, b, 0], u: X, v: Z, w: NY }, h, tw, 'web'],
      [['o'], { o: [0, 0, h - tw], u: X, v: Y, w: Z }, b, tw, 'flange'], [['u'], { o: [0, 0, 0], u: X, v: Y, w: Z }, b, tw, 'flange']];
    default: return [];
  }
}

const holePolygon = hole => (hole.slot
  ? ringPolygon([{ x: hole.x, y: hole.y - hole.d / 2, r: 0 }, { x: hole.x + hole.slot.l, y: hole.y - hole.d / 2, r: hole.d / 2 },
    { x: hole.x + hole.slot.l, y: hole.y + hole.d / 2, r: 0 }, { x: hole.x, y: hole.y + hole.d / 2, r: hole.d / 2 }], STEP)
  : circle(hole.x, hole.y, hole.d / 2));

// The slabs of a parsed NC1 piece: [{ outline: [x, y, …], holes: [[x, y, …]], depth, frame, part }], part being
// 'web', 'flange', 'plate' or 'body' (for the colours). Returns [] when the header has no usable dimensions.
export function pieceSlabs(p) {
  const L = p.length;
  if (!(L > 0)) return [];
  const contours = face => p.contours.filter(c => c.face === face || (face === 'v' && !c.face));
  if (p.code === 'B') {
    const { t, w } = plateDims(p);
    if (!(t > 0)) return [];
    const ak = contours('v').filter(c => c.kind === 'AK');
    const outer = ak.length ? ringPolygon(ak.reduce((a, c) => (c.pts.length > a.pts.length ? c : a)).pts, STEP) : [0, 0, L, 0, L, w, 0, w];
    const holes = [...contours('v').filter(c => c.kind === 'IK').map(c => ringPolygon(c.pts, STEP)), ...p.holes.map(holePolygon)];
    return [{ outline: outer, holes, depth: t, frame: { o: [0, 0, 0], u: X, v: Y, w: Z }, part: 'plate' }];
  }
  if (p.code === 'RO' || p.code === 'RU') {
    const D = p.h, t = p.tw || p.tf;
    if (!(D > 0)) return [];
    const holes = p.code === 'RO' && t > 0 && 2 * t < D ? [circle(D / 2, D / 2, D / 2 - t, 32)] : [];
    return [{ outline: circle(D / 2, D / 2, D / 2, 32), holes, depth: L, frame: { o: [0, 0, 0], u: Y, v: Z, w: X }, part: 'body' }];
  }
  const list = faces(p);
  if (!list.length || !list.every(([, , w, t]) => w > 0 && t > 0)) {
    // A special profile (or one without its dimensions): its box, h × b.
    return p.h > 0 && p.b > 0 ? [{ outline: [0, 0, p.b, 0, p.b, p.h, 0, p.h], holes: [], depth: L, frame: { o: [0, 0, 0], u: Y, v: Z, w: X }, part: 'body' }] : [];
  }
  return list.map(([letters, frame, w, t, part]) => {
    const own = p.contours.filter(c => letters.includes(c.face));
    const ak = own.filter(c => c.kind === 'AK');
    const web = part === 'web';
    const outline = ak.length ? ringPolygon(ak.reduce((a, c) => (c.pts.length > a.pts.length ? c : a)).pts, STEP)
      : cutRect(L, w, web ? p.webStart : p.flangeStart, web ? p.webEnd : p.flangeEnd);
    const holes = [...own.filter(c => c.kind === 'IK').map(c => ringPolygon(c.pts, STEP)), ...p.holes.filter(hl => letters.includes(hl.face)).map(holePolygon)];
    return { outline, holes, depth: t, frame, part };
  });
}

// The slabs' box in the piece's axes: { min: [x, y, z], max: [x, y, z] } (for the camera).
export function slabsBox(slabs) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const s of slabs) {
    const { o, u, v, w } = s.frame;
    for (let i = 0; i < s.outline.length; i += 2) {
      for (const d of [0, s.depth]) {
        for (let c = 0; c < 3; c++) {
          const x = o[c] + u[c] * s.outline[i] + v[c] * s.outline[i + 1] + w[c] * d;
          if (x < min[c]) min[c] = x;
          if (x > max[c]) max[c] = x;
        }
      }
    }
  }
  return min[0] <= max[0] ? { min, max } : { min: [0, 0, 0], max: [0, 0, 0] };
}
```

Run: `node _tests/extract.mjs $PLAN js/steel/shape3d.js && node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 72`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/steel/shape3d.js _tests/steel/shape3d.test.js
git commit -F - <<'EOF'
Steel take-off: an NC1 piece as slabs for the 3D view

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 13: The three.js view

**Files:**
- Create: `js/steel/view3d.js`
- Test: `_tests/steel/view3d.test.js`

**Interfaces:**
- Consumes: three.js r186 (`js/vendor/three/`, no `?v=`); `slabsBox` (Task 12).
- Produces (`js/steel/view3d.js`): `createView3d(container, { onLost }) → { showPiece(slabs), showModel(mesh, gradeOf, highlight: Set, { focus, only }), clear, preset(name), fit, dispose, canvas, shown, disposed, meshes, geometries, ink() }`; `hasWebGL2()`; the pure `splitIndex(mesh, gradeOf, highlight)`, `partsBox(mesh, eids)`, `gradeColor(grade)`, `PRESETS`, `GRADE_COLORS`, `HIGHLIGHT`, `PART_COLORS`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/steel/view3d.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitIndex, partsBox, gradeColor, PRESETS, GRADE_COLORS, HIGHLIGHT } from '../../js/steel/view3d.js';

// Two members of three triangles' worth of indices: eid 7 (S355) and eid 9 (S275).
const mesh = {
  position: Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0, 5, 5, 5, 6, 5, 5, 5, 6, 7]),
  index: Uint32Array.from([0, 1, 2, 3, 4, 5]),
  parts: Int32Array.from([7, 0, 3, 9, 3, 3]),
};
const grade = e => ({ 7: 'S355', 9: 'S275' })[e];

test('the members split by grade, the highlighted ones apart', () => {
  const a = splitIndex(mesh, grade, new Set());
  assert.deepEqual(a.grades.map(([g, ix]) => [g, [...ix]]), [['S355', [0, 1, 2]], ['S275', [3, 4, 5]]]);
  assert.equal(a.highlight.length, 0);
  const b = splitIndex(mesh, grade, new Set([9]));
  assert.deepEqual(b.grades.map(([g, ix]) => [g, [...ix]]), [['S355', [0, 1, 2]]]);
  assert.deepEqual([...b.highlight], [3, 4, 5]);
  assert.deepEqual(splitIndex(mesh, () => undefined, new Set()).grades.map(([g]) => g), ['other']);
});

test('the box of the highlighted members; colours per grade', () => {
  assert.deepEqual(partsBox(mesh, new Set([9])), { min: [5, 5, 5], max: [6, 6, 7] });
  assert.equal(partsBox(mesh, new Set([42])), null);
  assert.equal(gradeColor('S355'), GRADE_COLORS.S355);
  assert.equal(gradeColor('A992'), GRADE_COLORS.other);
  assert.ok(!Object.values(GRADE_COLORS).includes(HIGHLIGHT));
  assert.deepEqual(Object.keys(PRESETS), ['top', 'front', 'side', 'iso']);
});
```

Run: `node _tests/extract.mjs $PLAN _tests/steel/view3d.test.js && node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 72`, `ℹ fail 1`.

- [ ] **Step 2: Write the view**

<!-- file: js/steel/view3d.js -->
```js
// Steel take-off: the 3D view (spec §3, §6.6). Self-hosted three.js r186, imported without a ?v= so OrbitControls
// shares its one instance; an orthographic camera, Z up, Fit and the presets Top / Front / Side / Iso. It shows either
// one piece (an NC1 piece from shape3d.js's slabs, in mm) or the IFC's members from the worker's meshes (in m),
// coloured by grade with the selected piece's members highlighted. DOM and WebGL; the pure helpers before
// createView3d are Node-tested. Loaded by the page only when a piece is first shown.
import * as THREE from '../vendor/three/three.module.js';
import { OrbitControls } from '../vendor/three/addons/OrbitControls.js';
import { slabsBox } from './shape3d.js?v=20261104';

export const PRESETS = { top: [0, -1e-4, 1], front: [0, -1, 0], side: [1, 0, 0], iso: [1, -1, 0.8] };
export const GRADE_COLORS = { S235: '#8fa6bf', S275: '#86b39a', S355: '#c9a46a', S450: '#b88fb0', other: '#a9a49b' };
export const HIGHLIGHT = '#e0632b';
export const PART_COLORS = { web: '#9aa9b9', flange: '#7f90a3', plate: '#a8a29a', body: '#9aa9b9' };
const BG = 0xffffff;

export const gradeColor = g => GRADE_COLORS[g] || GRADE_COLORS.other;

// The worker's mesh split for drawing: per grade, the indices of the members not highlighted; and the highlighted
// members' indices. parts: [eid, first, count, …]; gradeOf(eid) → grade; highlight: a Set of eids.
export function splitIndex(mesh, gradeOf, highlight) {
  const lists = new Map(), hi = [];
  const p = mesh.parts;
  for (let k = 0; k < p.length; k += 3) {
    const eid = p[k], first = p[k + 1], count = p[k + 2];
    let out = hi;
    if (!highlight.has(eid)) {
      const g = gradeOf(eid) || 'other';
      if (!lists.has(g)) lists.set(g, []);
      out = lists.get(g);
    }
    for (let i = 0; i < count; i++) out.push(mesh.index[first + i]);
  }
  return { grades: [...lists].map(([g, ix]) => [g, Uint32Array.from(ix)]), highlight: Uint32Array.from(hi) };
}

// The box of the members in a set, in the mesh's own coordinates (m), or null.
export function partsBox(mesh, eids) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const p = mesh.parts;
  for (let k = 0; k < p.length; k += 3) {
    if (!eids.has(p[k])) continue;
    for (let i = p[k + 1]; i < p[k + 1] + p[k + 2]; i++) {
      const v = 3 * mesh.index[i];
      for (let c = 0; c < 3; c++) { const x = mesh.position[v + c]; if (x < min[c]) min[c] = x; if (x > max[c]) max[c] = x; }
    }
  }
  return min[0] <= max[0] ? { min, max } : null;
}

export function hasWebGL2() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return true;
  } catch (e) { return false; }
}

// onLost(): the WebGL context was lost. Throws when WebGL is not available.
export function createView3d(container, { onLost = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(BG, 1);
  const canvas = renderer.domElement;
  canvas.className = 'st-3d-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  container.prepend(canvas);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8f8b80, 2.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(0.45, -0.8, 1.3);
  scene.add(sun);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, canvas);
  controls.screenSpacePanning = true;
  controls.zoomToCursor = true;
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  const content = new THREE.Group();
  scene.add(content);
  let box = null, viewSize = 2, frame = 0, disposed = false, shown = null;

  function render() {
    frame = 0;
    if (!canvas.clientWidth || !canvas.clientHeight) return;
    renderer.render(scene, camera);
  }
  const requestRender = () => { if (!frame && !disposed) frame = requestAnimationFrame(render); };
  controls.addEventListener('change', requestRender);
  canvas.addEventListener('webglcontextlost', () => onLost());

  function applyFrustum() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1, aspect = w / h;
    camera.left = (-viewSize * aspect) / 2; camera.right = (viewSize * aspect) / 2;
    camera.top = viewSize / 2; camera.bottom = -viewSize / 2;
    controls.minZoom = 0.05; controls.maxZoom = 2000;
    camera.updateProjectionMatrix();
  }
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h || disposed) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    applyFrustum();
    requestRender();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  function clear() {
    content.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    content.clear();
    content.scale.set(1, 1, 1);
    box = null; shown = null;
    requestRender();
  }
  const material = color => new THREE.MeshLambertMaterial({ color, flatShading: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const edges = (geometry, color) => new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 30), new THREE.LineBasicMaterial({ color }));

  // One NC1 piece: each slab extruded and placed by its frame; mm scaled to m.
  function showPiece(slabs) {
    clear();
    for (const s of slabs) {
      const shape = new THREE.Shape();
      for (let i = 0; i < s.outline.length; i += 2) (i ? shape.lineTo : shape.moveTo).call(shape, s.outline[i], s.outline[i + 1]);
      for (const hl of s.holes) {
        const path = new THREE.Path();
        for (let i = 0; i < hl.length; i += 2) (i ? path.lineTo : path.moveTo).call(path, hl[i], hl[i + 1]);
        shape.holes.push(path);
      }
      const g = new THREE.ExtrudeGeometry(shape, { depth: s.depth, bevelEnabled: false, curveSegments: 1 });
      const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...s.frame.u), new THREE.Vector3(...s.frame.v), new THREE.Vector3(...s.frame.w));
      m.setPosition(...s.frame.o);
      g.applyMatrix4(m);
      content.add(new THREE.Mesh(g, material(PART_COLORS[s.part] || PART_COLORS.body)));
      content.add(edges(g, 0x3d434b));
    }
    content.scale.setScalar(0.001);
    const b = slabsBox(slabs);
    box = new THREE.Box3(new THREE.Vector3(...b.min).multiplyScalar(0.001), new THREE.Vector3(...b.max).multiplyScalar(0.001));
    shown = 'piece';
    fitView(new THREE.Vector3(...PRESETS.iso));
  }

  // The IFC's members: per grade one mesh, the highlighted members in the highlight colour; fitted on the
  // highlighted members when `focus`, else on the whole model.
  function showModel(mesh, gradeOf, highlight, { focus = false, only = false } = {}) {
    clear();
    const position = new THREE.BufferAttribute(mesh.position, 3);
    const split = splitIndex(mesh, gradeOf, highlight);
    const add = (index, color) => {
      if (!index.length) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', position);
      g.setIndex(new THREE.BufferAttribute(index, 1));
      content.add(new THREE.Mesh(g, material(color)));
    };
    if (!only) for (const [grade, index] of split.grades) add(index, gradeColor(grade));
    add(split.highlight, only ? PART_COLORS.body : HIGHLIGHT);
    const b = (focus || only) && highlight.size ? partsBox(mesh, highlight) : null;
    if (b) box = new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max));
    else { box = new THREE.Box3(); for (const o of content.children) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox); } }
    if (box.isEmpty()) box = null;
    shown = only ? 'member' : 'model';
    fitView(new THREE.Vector3(...PRESETS.iso));
  }

  function fitView(dirOverride) {
    if (!box) { requestRender(); return; }
    const centre = box.getCenter(new THREE.Vector3());
    const radius = Math.max(0.05, box.getSize(new THREE.Vector3()).length() / 2);
    const dir = dirOverride ? dirOverride.clone() : camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-12) dir.set(...PRESETS.iso);
    dir.normalize();
    viewSize = radius * 2.1;
    controls.target.copy(centre);
    camera.position.copy(centre).addScaledVector(dir, radius * 4);
    camera.near = radius * 0.5; camera.far = radius * 8;
    camera.zoom = 1;
    applyFrustum();
    camera.lookAt(centre);
    controls.update();
    requestRender();
  }
  const preset = name => fitView(new THREE.Vector3(...(PRESETS[name] || PRESETS.iso)));

  function destroy() {
    if (disposed) return;
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    observer.disconnect();
    controls.dispose();
    clear();
    renderer.dispose();
    canvas.remove();
  }

  resize();
  return {
    showPiece, showModel, clear, preset, fit: () => fitView(), dispose: destroy, canvas,
    // For the browser check: what is shown, the renderer's geometries, and the drawn pixels that are not background.
    get shown() { return shown; },
    get disposed() { return disposed; },
    get meshes() { return content.children.filter(o => o.isMesh).length; },
    get geometries() { return renderer.info.memory.geometries; },
    ink() {
      render();
      const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, a = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a);
      let n = 0;
      for (let i = 0; i < a.length; i += 4) if (a[i] < 250 || a[i + 1] < 250 || a[i + 2] < 250) n++;
      return n;
    },
  };
}
```

Run: `node _tests/extract.mjs $PLAN js/steel/view3d.js && node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 74`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/steel/view3d.js _tests/steel/view3d.test.js
git commit -F - <<'EOF'
Steel take-off: the three.js view of a piece and of the IFC

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 14: The strings

**Files:**
- Create: `js/steel/i18n-steel.js`
- Test: `_tests/steel/i18n.test.js`

**Interfaces:**
- Consumes (test): `GRADES` (Task 6), `RATE_KEYS` (Task 7).
- Produces: `window.ST_I18N = { el, en, it }`, 185 `st.*` keys each, the same keys and placeholders in every language.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/steel/i18n.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { GRADES } from '../../js/steel/quote.js';
import { RATE_KEYS } from '../../js/steel/state.js';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const ph = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
function toolStrings() {
  const window = {};
  vm.runInNewContext(read('../../js/steel/i18n-steel.js'), { window });
  return window.ST_I18N;
}

// Ids that reach the strings through a computed key.
const COMPUTED = [
  ...['read', 'read.ifczip', 'read.ifcxml', 'schema', 'limit', 'timeout', 'engine', 'nosteel', 'nonc1', 'nowasm'].map(k => `st.err.${k}`),
  ...['notnc1', 'broken', 'ifcalone', 'read', 'zip.encrypted', 'zip.zip64', 'zip.method', 'zip.notzip'].map(k => `st.skip.${k}`),
  ...['galv', 'zinc', 'paint', 'steel', ...GRADES.map(g => `steel.${g}`)].map(k => `st.cost.${k}`),
  ...['noweight', 'noarea', 'nolength', 'noqty', 'geometry', 'notsteel', 'check'].map(k => `st.warn.${k}`),
  ...['header', 'section', 'contour', 'profile', 'geometry'].map(k => `st.from.${k}`),
  ...['fits', 'double', 'no'].map(k => `st.bath.${k}`),
  ...['top', 'front', 'side', 'iso', 'loading', 'failed', 'nogl', 'noshape', 'stale', 'large'].map(k => `st.3d.${k}`),
  ...RATE_KEYS.map(k => `st.set.${k}`), ...GRADES.map(g => `st.set.steel.${g}`),
  ...['kg', 'length', 'mark'].map(k => `st.sort.${k}`),
];

test('tool strings: only st.* keys, the same keys and placeholders in el, en and it, none empty', () => {
  const s = toolStrings();
  const en = Object.keys(s.en).sort();
  assert.ok(en.length >= 180, `${en.length} keys`);
  assert.ok(en.every(k => k.startsWith('st.')));
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
  for (const k of COMPUTED) for (const l of ['el', 'en', 'it']) assert.ok(k in s[l], `${l} missing ${k}`);
});

test('every literal st.* key the modules use exists', () => {
  const s = toolStrings();
  const dir = new URL('../../js/steel/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'i18n-steel.js').map(f => readFileSync(new URL(f, dir), 'utf8'));
  let used = 0;
  for (const src of files) {
    for (const m of src.matchAll(/['"`](st\.[A-Za-z0-9.]+[A-Za-z0-9])['"`]/g)) { used++; assert.ok(m[1] in s.en, `${m[1]} has no string`); }
  }
  assert.ok(used >= 40, `${used} keys found`);
});

test('the Italian uses the typographic apostrophe and the formal voi; no "free" in visible text', () => {
  const s = toolStrings();
  for (const [k, v] of Object.entries(s.it)) {
    assert.ok(!v.includes("'"), `it ${k} has a straight apostrophe`);
    assert.ok(!/\b(tu|tuo|tua|tuoi|tue|ti|Trascina|Scegli|Prova|Esporta|Controlla|Premi|Verifica|Apri il)\b/.test(v), `it ${k} is not formal: ${v}`);
  }
  assert.ok(Object.values(s.it).some(v => /\b(vostro|vostre|Trascinate|premete)\b/.test(v)));
  for (const l of ['el', 'en', 'it']) for (const [k, v] of Object.entries(s[l])) assert.ok(!/δωρεάν|\bfree\b|gratuit/i.test(v), `${l} ${k}`);
});

test('the wording of spec §6 and §7 in English', () => {
  const { en } = toolStrings();
  assert.equal(en['st.eyebrow'], 'Tool');
  assert.equal(en['st.privacy'], 'Your files stay on your computer; nothing is uploaded.');
  assert.equal(en['st.indicative'], "Figures from the files' nominal values. Check against the shop drawings.");
  assert.deepEqual(['st.open', 'st.folder', 'st.example', 'st.xlsx', 'st.print', 'st.skip.notnc1'].map(k => en[k]), ['Open files', 'Open folder', 'Load example', 'Download Excel', 'Print / PDF', 'not an NC1 file']);
  assert.ok(en['st.err.nosteel'].startsWith('No steel members found'));
  assert.equal(toolStrings().el['st.eyebrow'], 'Εργαλείο');
  assert.equal(toolStrings().it['st.eyebrow'], 'Strumento');
});
```

Run: `node _tests/extract.mjs $PLAN _tests/steel/i18n.test.js && node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 74`, `ℹ fail 5`.

- [ ] **Step 2: Write the strings**

<!-- file: js/steel/i18n-steel.js -->
```js
// Steel take-off strings (GR/EN/IT). The page merges them under its own inline keys into window.GV_I18N, which the
// shared shell's t() reads. Placeholders are {name}; every language has the same keys and placeholders. The Italian
// uses the formal "voi" and the typographic apostrophe.
window.ST_I18N = {
  el: {
    "st.back": "Αρχική",
    "st.eyebrow": "Εργαλείο",
    "st.title": "Προμέτρηση χάλυβα και προσφορά γαλβανίσματος",
    "st.lede": "Ρίξτε τα αρχεία NC1 (DSTV) ενός έργου, έναν φάκελο ή ένα ZIP, ή ένα IFC, και πάρτε κιλά και m² ανά τεμάχιο και ανά διατομή, έλεγχο για το λουτρό γαλβανίσματος και το κόστος από τις δικές σας τιμές, σε Excel ή σε εκτύπωση.",
    "st.privacy": "Τα αρχεία μένουν στον υπολογιστή σας· τίποτα δεν ανεβαίνει.",
    "st.indicative": "Τα μεγέθη βγαίνουν από τις ονομαστικές τιμές των αρχείων. Ελέγξτε τα απέναντι στα κατασκευαστικά σχέδια.",
    "st.cross": "Όλα τα εργαλεία →",
    "st.aria.files": "Αρχεία",
    "st.open": "Άνοιγμα αρχείων",
    "st.folder": "Άνοιγμα φακέλου",
    "st.example": "Φόρτωση παραδείγματος",
    "st.example.ifc": "Το ίδιο σε IFC",
    "st.clear": "Καθαρισμός",
    "st.drop": "Σύρετε εδώ αρχεία NC1, έναν φάκελο, ένα ZIP ή ένα IFC, ή πατήστε «Άνοιγμα αρχείων».",
    "st.reading": "Ανάγνωση των αρχείων…",
    "st.ifc.reading": "Ανάγνωση του IFC…",
    "st.engine.nowasm": "Ο browser σας δεν υποστηρίζει WebAssembly, που χρειάζεται για τα IFC. Τα αρχεία NC1 διαβάζονται κανονικά.",
    "st.example.failed": "Το παράδειγμα δεν φορτώθηκε. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.",
    "st.err.read": "Το αρχείο δεν διαβάστηκε.",
    "st.err.read.ifczip": "Είναι IFC-ZIP· αποσυμπιέστε το και ρίξτε το αρχείο .ifc.",
    "st.err.read.ifcxml": "Είναι ifcXML· χρειάζεται IFC σε μορφή STEP (.ifc).",
    "st.err.schema": "Αυτή η έκδοση IFC δεν υποστηρίζεται.",
    "st.err.limit": "Το IFC ξεπερνά τα 150 MB και δεν διαβάστηκε.",
    "st.err.timeout": "Η ανάγνωση ξεπέρασε τα 120 s και σταμάτησε· η σελίδα συνεχίζει κανονικά.",
    "st.err.engine": "Το IFC δεν μπόρεσε να διαβαστεί· η σελίδα συνεχίζει κανονικά.",
    "st.err.nosteel": "Δεν βρέθηκαν μεταλλικά μέλη (IfcBeam, IfcColumn, IfcMember, IfcPlate).",
    "st.err.nonc1": "Δεν βρέθηκε κανένα τεμάχιο NC1.",
    "st.err.nowasm": "Ο browser σας δεν υποστηρίζει WebAssembly, που χρειάζεται για τα IFC.",
    "st.summary": "Σύνοψη",
    "st.sum.files": "Αρχεία",
    "st.sum.files.v": "{read} διαβάστηκαν, {skipped} παραλείφθηκαν",
    "st.sum.ifc": "IFC",
    "st.sum.members": "Μέλη",
    "st.sum.members.v": "{n} μέλη, {a} συγκροτήματα",
    "st.sum.pieces": "Τεμάχια",
    "st.sum.pieces.v": "{n} τεμάχια σε {marks} θέσεις",
    "st.sum.kg": "Συνολικό βάρος",
    "st.sum.m2": "Συνολική επιφάνεια",
    "st.sum.longest": "Μακρύτερο τεμάχιο",
    "st.sum.heaviest": "Βαρύτερο τεμάχιο",
    "st.sum.bath": "Λουτρό",
    "st.sum.bath.v": "{l} × {w} × {d} m · ⚠ {double} διπλή βύθιση · ✗ {no} δεν χωρούν",
    "st.sum.checks": "⚠ Έλεγχος γεωμετρίας",
    "st.sum.checking": "σε εξέλιξη…",
    "st.sum.checkfailed": "δεν ολοκληρώθηκε",
    "st.sum.excluded": "⚠ Εκτός συνόλων",
    "st.sum.noarea": "⚠ Χωρίς επιφάνεια",
    "st.sum.geometry": "Βάρος από τη γεωμετρία",
    "st.capped": "Διαβάστηκαν τα πρώτα {n} αρχεία NC1.",
    "st.skipped": "Αρχεία που παραλείφθηκαν ({n})",
    "st.skip.notnc1": "δεν είναι αρχείο NC1",
    "st.skip.broken": "χαλασμένο NC1, γραμμή {line}",
    "st.skip.ifcalone": "διαβάζεται ένα IFC τη φορά, χωρίς άλλα αρχεία",
    "st.skip.read": "δεν διαβάστηκε",
    "st.skip.zip.encrypted": "το ZIP είναι κρυπτογραφημένο",
    "st.skip.zip.zip64": "το ZIP είναι ZIP64, που δεν υποστηρίζεται",
    "st.skip.zip.method": "το ZIP έχει συμπίεση άλλη από stored ή deflate",
    "st.skip.zip.notzip": "χαλασμένο ή μη έγκυρο ZIP",
    "st.settings": "Ρυθμίσεις",
    "st.set.bath": "Λουτρό γαλβανίσματος",
    "st.set.bath.length": "Μήκος λουτρού (m)",
    "st.set.bath.width": "Πλάτος λουτρού (m)",
    "st.set.bath.depth": "Βάθος λουτρού (m)",
    "st.set.rates": "Τιμές",
    "st.set.galv": "Γαλβάνισμα (€/kg)",
    "st.set.zinc": "Επιβάρυνση ψευδαργύρου (€/kg)",
    "st.set.paint": "Βαφή (€/m²)",
    "st.set.steel": "Υλικό χάλυβα (€/kg)",
    "st.set.pergrade": "Τιμή υλικού ανά ποιότητα χάλυβα",
    "st.set.steel.S235": "S235 (€/kg)",
    "st.set.steel.S275": "S275 (€/kg)",
    "st.set.steel.S355": "S355 (€/kg)",
    "st.set.steel.other": "Άλλη ποιότητα (€/kg)",
    "st.set.minimum": "Ελάχιστη χρέωση (€)",
    "st.set.vat": "ΦΠΑ 24%",
    "st.set.hint": "Οι ρυθμίσεις μένουν σε αυτόν τον browser. Ένα κενό πεδίο τιμής αφήνει τη γραμμή του εκτός.",
    "st.table": "Ανά διατομή και ποιότητα",
    "st.table.hint": "Ανοίξτε μια διατομή για τα τεμάχιά της· ένα κλικ σε τεμάχιο το δείχνει σε 3D.",
    "st.sort": "Ταξινόμηση",
    "st.sort.kg": "κατά βάρος",
    "st.sort.length": "κατά μήκος",
    "st.sort.mark": "κατά θέση",
    "st.th.profile": "Διατομή · θέση",
    "st.th.grade": "Ποιότητα · σχέδιο",
    "st.th.length": "Μήκος",
    "st.th.qty": "Τεμ.",
    "st.th.kg": "kg",
    "st.th.m2": "m²",
    "st.th.check": "Έλεγχος",
    "st.th.bath": "Λουτρό",
    "st.check.tip": "Ονομαστικό {nominal} · γεωμετρία {check}",
    "st.bath.fits": "χωράει στο λουτρό",
    "st.bath.double": "διπλή βύθιση",
    "st.bath.no": "δεν χωράει στο λουτρό",
    "st.bath.note": "Ο έλεγχος του λουτρού είναι ενδεικτικός· την τελική απόφαση την παίρνει ο γαλβανιστής.",
    "st.warn.noweight": "χωρίς βάρος, εκτός συνόλων",
    "st.warn.noarea": "χωρίς επιφάνεια",
    "st.warn.nolength": "χωρίς μήκος, εκτός συνόλων",
    "st.warn.noqty": "χωρίς ποσότητα, εκτός συνόλων",
    "st.warn.geometry": "βάρος από τη γεωμετρία",
    "st.warn.notsteel": "όχι χάλυβας κατά το υλικό, εκτός συνόλων",
    "st.warn.check": "η γεωμετρία διαφέρει πάνω από 5%",
    "st.warn.check.xlsx": "η γεωμετρία δίνει {kg} kg",
    "st.from.header": "κεφαλίδα NC1",
    "st.from.section": "διαστάσεις διατομής",
    "st.from.contour": "περίγραμμα ελάσματος",
    "st.from.profile": "παράμετροι διατομής IFC",
    "st.from.geometry": "γεωμετρία IFC",
    "st.view": "Προβολή 3D",
    "st.3d.top": "Κάτοψη",
    "st.3d.front": "Πρόσοψη",
    "st.3d.side": "Πλάγια",
    "st.3d.iso": "Αξονομετρικό",
    "st.fit": "Προσαρμογή",
    "st.3d.model": "Όλο το μοντέλο",
    "st.3d.loading": "Ετοιμάζεται η προβολή 3D…",
    "st.3d.failed": "Η προβολή 3D δεν μπόρεσε να φτιαχτεί· η λίστα δεν επηρεάζεται.",
    "st.3d.nogl": "Η προβολή 3D δεν είναι διαθέσιμη σε αυτόν τον browser.",
    "st.3d.noshape": "Αυτό το τεμάχιο δεν έχει διαστάσεις για προβολή 3D.",
    "st.3d.stale": "Ανοίξτε ξανά το αρχείο για να το δείτε σε 3D.",
    "st.3d.large": "Το μοντέλο είναι πολύ μεγάλο για την προβολή 3D σε αυτόν τον browser.",
    "st.aria.3d": "Τρισδιάστατη προβολή του επιλεγμένου τεμαχίου",
    "st.costs": "Κόστος",
    "st.cth.line": "Γραμμή",
    "st.cth.qty": "Ποσότητα",
    "st.cth.rate": "Τιμή",
    "st.cth.amount": "Ποσό",
    "st.cost.galv": "Γαλβάνισμα",
    "st.cost.zinc": "Επιβάρυνση ψευδαργύρου",
    "st.cost.paint": "Βαφή",
    "st.cost.steel": "Υλικό χάλυβα",
    "st.cost.steel.S235": "Υλικό χάλυβα S235",
    "st.cost.steel.S275": "Υλικό χάλυβα S275",
    "st.cost.steel.S355": "Υλικό χάλυβα S355",
    "st.cost.steel.other": "Υλικό χάλυβα, άλλες ποιότητες",
    "st.cost.subtotal": "Μερικό σύνολο",
    "st.cost.minimum": "Ισχύει η ελάχιστη χρέωση των {min} €",
    "st.cost.vat": "ΦΠΑ 24%",
    "st.cost.novat": "Χωρίς ΦΠΑ",
    "st.cost.total": "Σύνολο",
    "st.cost.none": "Συμπληρώστε μια τιμή στις ρυθμίσεις για να κοστολογηθεί η λίστα.",
    "st.xlsx": "Λήψη Excel",
    "st.print": "Εκτύπωση / PDF",
    "st.v1": "Δεν περιλαμβάνονται σε αυτή την έκδοση: βίδες και συγκολλήσεις, κοπή και nesting, τιμές ανά κατηγορία γαλβανίσματος, μεταφορά.",
    "st.sheet.pieces": "Τεμάχια",
    "st.sheet.groups": "Διατομές",
    "st.sheet.costs": "Κόστος",
    "st.sheet.settings": "Ρυθμίσεις",
    "st.col.mark": "Θέση",
    "st.col.drawing": "Σχέδιο",
    "st.col.profile": "Διατομή",
    "st.col.grade": "Ποιότητα",
    "st.col.qty": "Τεμ.",
    "st.col.lengthmm": "Μήκος (mm)",
    "st.col.lengthm": "Μήκος (m)",
    "st.col.kgeach": "kg/τεμ.",
    "st.col.kg": "kg",
    "st.col.m2each": "m²/τεμ.",
    "st.col.m2": "m²",
    "st.col.from": "Βάρος από",
    "st.col.bath": "Λουτρό",
    "st.col.notes": "Σημειώσεις",
    "st.col.file": "Αρχείο",
    "st.col.line": "Γραμμή",
    "st.col.amountqty": "Ποσότητα",
    "st.col.unit": "Μονάδα",
    "st.col.rate": "Τιμή (€)",
    "st.col.eur": "Ποσό (€)",
    "st.col.setting": "Ρύθμιση",
    "st.col.value": "Τιμή",
    "st.total": "Σύνολο",
    "st.yes": "Ναι",
    "st.no": "Όχι",
    "st.xlsx.source": "Πηγή",
    "st.xlsx.nfiles": "{n} αρχεία NC1",
    "st.cta.title": "Προσφορές γαλβανίσματος και βαφής από τα δικά σας αρχεία;",
    "st.cta.text": "Το στήνουμε πάνω στον τιμοκατάλογο και τα πρότυπα προσφορών της επιχείρησής σας, με σύνδεση στο ERP και μαζική επεξεργασία έργων.",
    "st.cta.link": "Επικοινωνήστε μαζί μας",
    "st.survey.q": "Πώς βγάζετε σήμερα τα κιλά για μια προσφορά;",
    "st.survey.tekla": "Από τη λίστα του Tekla",
    "st.survey.hand": "Με το χέρι από τα σχέδια",
    "st.survey.other": "Αλλιώς",
    "st.survey.thanks": "Ευχαριστούμε!",
    "st.notice": "Ανάγνωση IFC: web-ifc (ThatOpen Company), MPL-2.0,",
    "st.notice.link": "ο κώδικας στο GitHub"
  },
  en: {
    "st.back": "Home",
    "st.eyebrow": "Tool",
    "st.title": "Steel take-off and galvanizing quote",
    "st.lede": "Drop a project's NC1 (DSTV) files, a folder or a ZIP, or one IFC, and get kg and m² per piece and per profile, a galvanizing-bath check and the cost at your own rates, as Excel or a printed sheet.",
    "st.privacy": "Your files stay on your computer; nothing is uploaded.",
    "st.indicative": "Figures from the files' nominal values. Check against the shop drawings.",
    "st.cross": "All tools →",
    "st.aria.files": "Files",
    "st.open": "Open files",
    "st.folder": "Open folder",
    "st.example": "Load example",
    "st.example.ifc": "The same as IFC",
    "st.clear": "Clear",
    "st.drop": "Drop NC1 files, a folder, a ZIP or an IFC here, or press “Open files”.",
    "st.reading": "Reading the files…",
    "st.ifc.reading": "Reading the IFC…",
    "st.engine.nowasm": "Your browser does not support WebAssembly, which IFC files need. NC1 files read as usual.",
    "st.example.failed": "The example did not load. Check your connection and try again.",
    "st.err.read": "The file could not be read.",
    "st.err.read.ifczip": "This is an IFC-ZIP; unzip it and drop the .ifc file.",
    "st.err.read.ifcxml": "This is ifcXML; the tool needs IFC as STEP text (.ifc).",
    "st.err.schema": "This IFC version is not supported.",
    "st.err.limit": "The IFC is over 150 MB and was not read.",
    "st.err.timeout": "Reading took over 120 s and was stopped; the page keeps working.",
    "st.err.engine": "The IFC could not be read; the page keeps working.",
    "st.err.nosteel": "No steel members found (IfcBeam, IfcColumn, IfcMember, IfcPlate).",
    "st.err.nonc1": "No NC1 piece was found.",
    "st.err.nowasm": "Your browser does not support WebAssembly, which IFC files need.",
    "st.summary": "Summary",
    "st.sum.files": "Files",
    "st.sum.files.v": "{read} read, {skipped} skipped",
    "st.sum.ifc": "IFC",
    "st.sum.members": "Members",
    "st.sum.members.v": "{n} members, {a} assemblies",
    "st.sum.pieces": "Pieces",
    "st.sum.pieces.v": "{n} pieces in {marks} marks",
    "st.sum.kg": "Total weight",
    "st.sum.m2": "Total surface",
    "st.sum.longest": "Longest piece",
    "st.sum.heaviest": "Heaviest piece",
    "st.sum.bath": "Bath",
    "st.sum.bath.v": "{l} × {w} × {d} m · ⚠ {double} double dip · ✗ {no} don't fit",
    "st.sum.checks": "⚠ Geometry check",
    "st.sum.checking": "running…",
    "st.sum.checkfailed": "not completed",
    "st.sum.excluded": "⚠ Left out of the totals",
    "st.sum.noarea": "⚠ No surface",
    "st.sum.geometry": "Weight from geometry",
    "st.capped": "The first {n} NC1 files were read.",
    "st.skipped": "Files skipped ({n})",
    "st.skip.notnc1": "not an NC1 file",
    "st.skip.broken": "broken NC1, line {line}",
    "st.skip.ifcalone": "one IFC is read at a time, without other files",
    "st.skip.read": "could not be read",
    "st.skip.zip.encrypted": "the ZIP is encrypted",
    "st.skip.zip.zip64": "the ZIP is ZIP64, which is not supported",
    "st.skip.zip.method": "the ZIP uses a method other than stored or deflate",
    "st.skip.zip.notzip": "a broken or invalid ZIP",
    "st.settings": "Settings",
    "st.set.bath": "Galvanizing bath",
    "st.set.bath.length": "Bath length (m)",
    "st.set.bath.width": "Bath width (m)",
    "st.set.bath.depth": "Bath depth (m)",
    "st.set.rates": "Rates",
    "st.set.galv": "Galvanizing (€/kg)",
    "st.set.zinc": "Zinc surcharge (€/kg)",
    "st.set.paint": "Painting (€/m²)",
    "st.set.steel": "Steel material (€/kg)",
    "st.set.pergrade": "Material rate per steel grade",
    "st.set.steel.S235": "S235 (€/kg)",
    "st.set.steel.S275": "S275 (€/kg)",
    "st.set.steel.S355": "S355 (€/kg)",
    "st.set.steel.other": "Other grade (€/kg)",
    "st.set.minimum": "Minimum charge (€)",
    "st.set.vat": "VAT 24%",
    "st.set.hint": "Settings stay in this browser. An empty rate leaves its line off the sheet.",
    "st.table": "By profile and grade",
    "st.table.hint": "Open a profile for its pieces; a click on a piece shows it in 3D.",
    "st.sort": "Sort",
    "st.sort.kg": "by weight",
    "st.sort.length": "by length",
    "st.sort.mark": "by mark",
    "st.th.profile": "Profile · mark",
    "st.th.grade": "Grade · drawing",
    "st.th.length": "Length",
    "st.th.qty": "Qty",
    "st.th.kg": "kg",
    "st.th.m2": "m²",
    "st.th.check": "Check",
    "st.th.bath": "Bath",
    "st.check.tip": "Nominal {nominal} · geometry {check}",
    "st.bath.fits": "fits the bath",
    "st.bath.double": "double dip",
    "st.bath.no": "doesn't fit the bath",
    "st.bath.note": "The bath check is a guide; the galvanizer confirms.",
    "st.warn.noweight": "no weight, left out of the totals",
    "st.warn.noarea": "no surface",
    "st.warn.nolength": "no length, left out of the totals",
    "st.warn.noqty": "no quantity, left out of the totals",
    "st.warn.geometry": "weight from geometry",
    "st.warn.notsteel": "not steel by its material, left out of the totals",
    "st.warn.check": "the geometry differs by over 5%",
    "st.warn.check.xlsx": "the geometry gives {kg} kg",
    "st.from.header": "NC1 header",
    "st.from.section": "section dimensions",
    "st.from.contour": "plate contour",
    "st.from.profile": "IFC profile parameters",
    "st.from.geometry": "IFC geometry",
    "st.view": "3D view",
    "st.3d.top": "Top",
    "st.3d.front": "Front",
    "st.3d.side": "Side",
    "st.3d.iso": "Iso",
    "st.fit": "Fit",
    "st.3d.model": "Whole model",
    "st.3d.loading": "Preparing the 3D view…",
    "st.3d.failed": "The 3D view could not be built; the list is unaffected.",
    "st.3d.nogl": "3D is not available in this browser.",
    "st.3d.noshape": "This piece has no dimensions for a 3D view.",
    "st.3d.stale": "Open the file again to see it in 3D.",
    "st.3d.large": "This model is too large for the 3D view in this browser.",
    "st.aria.3d": "3D view of the selected piece",
    "st.costs": "Cost",
    "st.cth.line": "Line",
    "st.cth.qty": "Quantity",
    "st.cth.rate": "Rate",
    "st.cth.amount": "Amount",
    "st.cost.galv": "Galvanizing",
    "st.cost.zinc": "Zinc surcharge",
    "st.cost.paint": "Painting",
    "st.cost.steel": "Steel material",
    "st.cost.steel.S235": "Steel material S235",
    "st.cost.steel.S275": "Steel material S275",
    "st.cost.steel.S355": "Steel material S355",
    "st.cost.steel.other": "Steel material, other grades",
    "st.cost.subtotal": "Subtotal",
    "st.cost.minimum": "Minimum charge of {min} € applies",
    "st.cost.vat": "VAT 24%",
    "st.cost.novat": "No VAT",
    "st.cost.total": "Total",
    "st.cost.none": "Fill in a rate in the settings to price this take-off.",
    "st.xlsx": "Download Excel",
    "st.print": "Print / PDF",
    "st.v1": "Not in this version: bolts and welds, cutting and nesting, prices per galvanizing class, transport.",
    "st.sheet.pieces": "Pieces",
    "st.sheet.groups": "Profiles",
    "st.sheet.costs": "Costs",
    "st.sheet.settings": "Settings",
    "st.col.mark": "Mark",
    "st.col.drawing": "Drawing",
    "st.col.profile": "Profile",
    "st.col.grade": "Grade",
    "st.col.qty": "Qty",
    "st.col.lengthmm": "Length (mm)",
    "st.col.lengthm": "Length (m)",
    "st.col.kgeach": "kg each",
    "st.col.kg": "kg",
    "st.col.m2each": "m² each",
    "st.col.m2": "m²",
    "st.col.from": "Weight from",
    "st.col.bath": "Bath",
    "st.col.notes": "Notes",
    "st.col.file": "File",
    "st.col.line": "Line",
    "st.col.amountqty": "Quantity",
    "st.col.unit": "Unit",
    "st.col.rate": "Rate (€)",
    "st.col.eur": "Amount (€)",
    "st.col.setting": "Setting",
    "st.col.value": "Value",
    "st.total": "Total",
    "st.yes": "Yes",
    "st.no": "No",
    "st.xlsx.source": "Source",
    "st.xlsx.nfiles": "{n} NC1 files",
    "st.cta.title": "Galvanizing and painting quotes from your own files?",
    "st.cta.text": "We build it on your company's price list and quote templates, linked to your ERP, with whole projects processed in one go.",
    "st.cta.link": "Contact us",
    "st.survey.q": "How do you get the kilos for a quote today?",
    "st.survey.tekla": "From the Tekla list",
    "st.survey.hand": "By hand from the drawings",
    "st.survey.other": "Another way",
    "st.survey.thanks": "Thank you!",
    "st.notice": "IFC reading: web-ifc (ThatOpen Company), MPL-2.0,",
    "st.notice.link": "source on GitHub"
  },
  it: {
    "st.back": "Home",
    "st.eyebrow": "Strumento",
    "st.title": "Distinta acciaio e preventivo di zincatura",
    "st.lede": "Trascinate i file NC1 (DSTV) di un progetto, una cartella o uno ZIP, oppure un IFC, e ottenete kg e m² per pezzo e per profilo, il controllo della vasca di zincatura e il costo con le vostre tariffe, in Excel o in stampa.",
    "st.privacy": "I file restano sul vostro computer; non viene caricato nulla.",
    "st.indicative": "Valori dai dati nominali dei file. Confrontateli con i disegni d’officina.",
    "st.cross": "Tutti gli strumenti →",
    "st.aria.files": "File",
    "st.open": "Apri file",
    "st.folder": "Apri cartella",
    "st.example": "Carica esempio",
    "st.example.ifc": "Lo stesso in IFC",
    "st.clear": "Svuota",
    "st.drop": "Trascinate qui file NC1, una cartella, uno ZIP o un IFC, oppure premete «Apri file».",
    "st.reading": "Lettura dei file…",
    "st.ifc.reading": "Lettura dell’IFC…",
    "st.engine.nowasm": "Il vostro browser non supporta WebAssembly, necessario per i file IFC. I file NC1 si leggono normalmente.",
    "st.example.failed": "L’esempio non è stato caricato. Controllate la connessione e riprovate.",
    "st.err.read": "Non è stato possibile leggere il file.",
    "st.err.read.ifczip": "È un IFC-ZIP; decomprimetelo e trascinate il file .ifc.",
    "st.err.read.ifcxml": "È un ifcXML; serve un IFC in formato STEP (.ifc).",
    "st.err.schema": "Questa versione di IFC non è supportata.",
    "st.err.limit": "L’IFC supera i 150 MB e non è stato letto.",
    "st.err.timeout": "La lettura ha superato i 120 s ed è stata fermata; la pagina continua a funzionare.",
    "st.err.engine": "Non è stato possibile leggere l’IFC; la pagina continua a funzionare.",
    "st.err.nosteel": "Nessun elemento in acciaio trovato (IfcBeam, IfcColumn, IfcMember, IfcPlate).",
    "st.err.nonc1": "Nessun pezzo NC1 trovato.",
    "st.err.nowasm": "Il vostro browser non supporta WebAssembly, necessario per i file IFC.",
    "st.summary": "Riepilogo",
    "st.sum.files": "File",
    "st.sum.files.v": "{read} letti, {skipped} saltati",
    "st.sum.ifc": "IFC",
    "st.sum.members": "Elementi",
    "st.sum.members.v": "{n} elementi, {a} assiemi",
    "st.sum.pieces": "Pezzi",
    "st.sum.pieces.v": "{n} pezzi in {marks} marche",
    "st.sum.kg": "Peso totale",
    "st.sum.m2": "Superficie totale",
    "st.sum.longest": "Pezzo più lungo",
    "st.sum.heaviest": "Pezzo più pesante",
    "st.sum.bath": "Vasca",
    "st.sum.bath.v": "{l} × {w} × {d} m · ⚠ {double} doppia immersione · ✗ {no} non entrano",
    "st.sum.checks": "⚠ Controllo della geometria",
    "st.sum.checking": "in corso…",
    "st.sum.checkfailed": "non completato",
    "st.sum.excluded": "⚠ Esclusi dai totali",
    "st.sum.noarea": "⚠ Senza superficie",
    "st.sum.geometry": "Peso dalla geometria",
    "st.capped": "Sono stati letti i primi {n} file NC1.",
    "st.skipped": "File saltati ({n})",
    "st.skip.notnc1": "non è un file NC1",
    "st.skip.broken": "NC1 danneggiato, riga {line}",
    "st.skip.ifcalone": "si legge un IFC alla volta, senza altri file",
    "st.skip.read": "non è stato possibile leggerlo",
    "st.skip.zip.encrypted": "lo ZIP è cifrato",
    "st.skip.zip.zip64": "lo ZIP è uno ZIP64, non supportato",
    "st.skip.zip.method": "lo ZIP usa un metodo diverso da stored o deflate",
    "st.skip.zip.notzip": "uno ZIP danneggiato o non valido",
    "st.settings": "Impostazioni",
    "st.set.bath": "Vasca di zincatura",
    "st.set.bath.length": "Lunghezza della vasca (m)",
    "st.set.bath.width": "Larghezza della vasca (m)",
    "st.set.bath.depth": "Profondità della vasca (m)",
    "st.set.rates": "Tariffe",
    "st.set.galv": "Zincatura (€/kg)",
    "st.set.zinc": "Sovrapprezzo zinco (€/kg)",
    "st.set.paint": "Verniciatura (€/m²)",
    "st.set.steel": "Materiale acciaio (€/kg)",
    "st.set.pergrade": "Tariffa del materiale per qualità di acciaio",
    "st.set.steel.S235": "S235 (€/kg)",
    "st.set.steel.S275": "S275 (€/kg)",
    "st.set.steel.S355": "S355 (€/kg)",
    "st.set.steel.other": "Altra qualità (€/kg)",
    "st.set.minimum": "Importo minimo (€)",
    "st.set.vat": "IVA 24%",
    "st.set.hint": "Le impostazioni restano in questo browser. Una tariffa vuota lascia la sua riga fuori dal foglio.",
    "st.table": "Per profilo e qualità",
    "st.table.hint": "Aprite un profilo per vederne i pezzi; un clic su un pezzo lo mostra in 3D.",
    "st.sort": "Ordina",
    "st.sort.kg": "per peso",
    "st.sort.length": "per lunghezza",
    "st.sort.mark": "per marca",
    "st.th.profile": "Profilo · marca",
    "st.th.grade": "Qualità · disegno",
    "st.th.length": "Lunghezza",
    "st.th.qty": "Pz.",
    "st.th.kg": "kg",
    "st.th.m2": "m²",
    "st.th.check": "Controllo",
    "st.th.bath": "Vasca",
    "st.check.tip": "Nominale {nominal} · geometria {check}",
    "st.bath.fits": "entra nella vasca",
    "st.bath.double": "doppia immersione",
    "st.bath.no": "non entra nella vasca",
    "st.bath.note": "Il controllo della vasca è indicativo; conferma lo zincatore.",
    "st.warn.noweight": "senza peso, escluso dai totali",
    "st.warn.noarea": "senza superficie",
    "st.warn.nolength": "senza lunghezza, escluso dai totali",
    "st.warn.noqty": "senza quantità, escluso dai totali",
    "st.warn.geometry": "peso dalla geometria",
    "st.warn.notsteel": "non è acciaio secondo il materiale, escluso dai totali",
    "st.warn.check": "la geometria differisce di oltre il 5%",
    "st.warn.check.xlsx": "la geometria dà {kg} kg",
    "st.from.header": "intestazione NC1",
    "st.from.section": "dimensioni della sezione",
    "st.from.contour": "contorno della lamiera",
    "st.from.profile": "parametri del profilo IFC",
    "st.from.geometry": "geometria IFC",
    "st.view": "Vista 3D",
    "st.3d.top": "Pianta",
    "st.3d.front": "Fronte",
    "st.3d.side": "Lato",
    "st.3d.iso": "Iso",
    "st.fit": "Adatta",
    "st.3d.model": "Modello intero",
    "st.3d.loading": "Preparazione della vista 3D…",
    "st.3d.failed": "Non è stato possibile creare la vista 3D; la distinta non cambia.",
    "st.3d.nogl": "La vista 3D non è disponibile in questo browser.",
    "st.3d.noshape": "Questo pezzo non ha dimensioni per una vista 3D.",
    "st.3d.stale": "Riaprite il file per vederlo in 3D.",
    "st.3d.large": "Il modello è troppo grande per la vista 3D in questo browser.",
    "st.aria.3d": "Vista 3D del pezzo selezionato",
    "st.costs": "Costi",
    "st.cth.line": "Voce",
    "st.cth.qty": "Quantità",
    "st.cth.rate": "Tariffa",
    "st.cth.amount": "Importo",
    "st.cost.galv": "Zincatura",
    "st.cost.zinc": "Sovrapprezzo zinco",
    "st.cost.paint": "Verniciatura",
    "st.cost.steel": "Materiale acciaio",
    "st.cost.steel.S235": "Materiale acciaio S235",
    "st.cost.steel.S275": "Materiale acciaio S275",
    "st.cost.steel.S355": "Materiale acciaio S355",
    "st.cost.steel.other": "Materiale acciaio, altre qualità",
    "st.cost.subtotal": "Subtotale",
    "st.cost.minimum": "Si applica l’importo minimo di {min} €",
    "st.cost.vat": "IVA 24%",
    "st.cost.novat": "Senza IVA",
    "st.cost.total": "Totale",
    "st.cost.none": "Inserite una tariffa nelle impostazioni per valorizzare la distinta.",
    "st.xlsx": "Scarica Excel",
    "st.print": "Stampa / PDF",
    "st.v1": "Non inclusi in questa versione: bulloni e saldature, taglio e nesting, prezzi per classe di zincatura, trasporto.",
    "st.sheet.pieces": "Pezzi",
    "st.sheet.groups": "Profili",
    "st.sheet.costs": "Costi",
    "st.sheet.settings": "Impostazioni",
    "st.col.mark": "Marca",
    "st.col.drawing": "Disegno",
    "st.col.profile": "Profilo",
    "st.col.grade": "Qualità",
    "st.col.qty": "Pz.",
    "st.col.lengthmm": "Lunghezza (mm)",
    "st.col.lengthm": "Lunghezza (m)",
    "st.col.kgeach": "kg/pz.",
    "st.col.kg": "kg",
    "st.col.m2each": "m²/pz.",
    "st.col.m2": "m²",
    "st.col.from": "Peso da",
    "st.col.bath": "Vasca",
    "st.col.notes": "Note",
    "st.col.file": "File",
    "st.col.line": "Voce",
    "st.col.amountqty": "Quantità",
    "st.col.unit": "Unità",
    "st.col.rate": "Tariffa (€)",
    "st.col.eur": "Importo (€)",
    "st.col.setting": "Impostazione",
    "st.col.value": "Valore",
    "st.total": "Totale",
    "st.yes": "Sì",
    "st.no": "No",
    "st.xlsx.source": "Origine",
    "st.xlsx.nfiles": "{n} file NC1",
    "st.cta.title": "Preventivi di zincatura e verniciatura dai vostri file?",
    "st.cta.text": "Lo realizziamo sul listino e sui modelli di preventivo della vostra azienda, collegato al vostro ERP, con interi progetti elaborati in una volta.",
    "st.cta.link": "Contattateci",
    "st.survey.q": "Come ricavate oggi i chili per un preventivo?",
    "st.survey.tekla": "Dalla lista di Tekla",
    "st.survey.hand": "A mano dai disegni",
    "st.survey.other": "In un altro modo",
    "st.survey.thanks": "Grazie!",
    "st.notice": "Lettura IFC: web-ifc (ThatOpen Company), MPL-2.0,",
    "st.notice.link": "il codice su GitHub"
  },
};
```

Run: `node _tests/extract.mjs $PLAN js/steel/i18n-steel.js && node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 79`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/steel/i18n-steel.js _tests/steel/i18n.test.js
git commit -F - <<'EOF'
Steel take-off: the strings in Greek, English and Italian

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 15: The page

**Files:**
- Create: `steel-takeoff.html`, `js/steel/ui.js`
- Modify: `css/tools.css` (the `.st-*` block, inserted before the ifc-plans section)
- Modify by an interim edit: the sidebar `?v=` of the 12 other pages; two lines of `_tests/sidebar/sidebar.test.js` (given whole in Task 16)
- Test: `_tests/steel/site.test.js`, `_tests/steel/page.test.js`

**Interfaces:**
- Consumes: every module of Tasks 1–14; the shell (`t`, `ga`, `fmtNum`, `localeOf`, `lsGet`, `lsSet`, `renderBanner`); `createEngine` (`js/laser/bridge.js?v=20261001`); `writeXlsx` (`js/dwg/xlsx.js?v=20260930`).
- Produces: the page of spec §6, and the test hook `window.__steel = { timings: { example, file, check, view3d }, view3d }` for Task 17.

- [ ] **Step 1: Write the failing tests**

<!-- file: _tests/steel/site.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout has CRLF
const between = (s, from, to) => s.slice(s.indexOf(from), s.indexOf(to, s.indexOf(from)));

test('the page: canonical, the web-ifc notice with its link, the nominal-values note, no Eyeshot, no engine up front', () => {
  const page = read('../../steel-takeoff.html');
  assert.ok(page.includes('<link rel="canonical" href="https://www.aidedcam.com/steel-takeoff.html" />'));
  assert.ok(page.includes('<span data-i18n="st.notice">Ανάγνωση IFC: web-ifc (ThatOpen Company), MPL-2.0,</span> <a href="https://github.com/ThatOpen/engine_web-ifc" rel="noopener" data-i18n="st.notice.link">'));
  assert.ok(page.includes('data-i18n="st.indicative"'));
  assert.ok(page.includes('<p class="gv-eyebrow" data-i18n="st.eyebrow">Εργαλείο</p>'));
  assert.ok(!/devDept|Eyeshot/i.test(page));
  assert.ok(!/src="[^"]*vendor\//.test(page), 'web-ifc loads in the worker, three.js with the first piece shown');
  for (const f of readdirSync(new URL('../../js/steel/', import.meta.url)).filter(n => n.endsWith('.js'))) assert.ok(!/eyeshot|devdept|dotnet/i.test(read(`../../js/steel/${f}`)), f);
});

test('consent, GA and the language switcher are those of the IFC floor plans page', () => {
  const a = read('../../ifc-plans.html'), b = read('../../steel-takeoff.html');
  for (const [from, to] of [['<!-- Google Analytics', '</script>'], ['<!-- COOKIE CONSENT BANNER', '  <script src='], ["    // The tool's strings first", '  </script>'], ['<div class="lang-switcher">', '</div>']]) {
    const x = between(a, from, to).replace('IP_I18N', 'XX_I18N'), y = between(b, from, to).replace('ST_I18N', 'XX_I18N');
    assert.ok(x.length > 20, from);
    assert.equal(y, x, from);
  }
  const strings = s => [...s.matchAll(/"(cookie_[a-z_]+|footer\.[a-z_]+)": "([^"]*)"/g)].map(m => m[0]).join('\n');
  assert.equal(strings(b), strings(a));
});

test('every steel module URL carries the deploy placeholder ?v=20261104; shared modules keep their own', () => {
  const page = read('../../steel-takeoff.html');
  for (const u of ['css/tools.css?v=20261104', 'js/steel/i18n-steel.js?v=20261104', 'js/steel/ui.js?v=20261104', 'css/sidebar.css?v=20261104', 'js/sidebar.js?v=20261104']) assert.ok(page.includes(u), u);
  const SHARED = { '../laser/bridge.js': '20261001', '../dwg/xlsx.js': '20260930', '../ifcplan/model.js': '20261003', '../ifcplan/vendor/web-ifc/web-ifc-api.js': '20261003' };
  let n = 0;
  for (const f of readdirSync(new URL('../../js/steel/', import.meta.url)).filter(x => x.endsWith('.js'))) {
    const src = read(`../../js/steel/${f}`);
    for (const m of src.matchAll(/(?:from |import\()'(\.[^']+)'/g)) {
      n++;
      const u = m[1], base = u.replace(/\?.*$/, '');
      if (u.includes('/gcode/shell/') || u.includes('/vendor/three/')) assert.ok(!u.includes('?v='), `${f}: ${u}`);
      else if (SHARED[base]) assert.ok(u.endsWith(`?v=${SHARED[base]}`), `${f}: ${u}`);
      else assert.ok(u.startsWith('./') && u.endsWith('?v=20261104'), `${f}: ${u}`);
    }
  }
  assert.ok(n >= 30, `${n} imports`);
  const ui = read('../../js/steel/ui.js'), worker = read('../../js/steel/worker.js');
  assert.ok(ui.includes("new URL('./worker.js?v=20261104', import.meta.url)"));
  assert.ok(ui.includes('./examples/${path}?v=20261104'));
  assert.ok(ui.includes('import(`./view3d.js?v=20261104'));
  assert.ok(worker.includes('`../ifcplan/vendor/web-ifc/${file}?v=20261003`'), 'the same web-ifc URLs as the IFC floor plans tool');
});

test('three.js loads only with the 3D view; web-ifc only in the worker and the reader it runs', () => {
  const page = read('../../steel-takeoff.html'), ui = read('../../js/steel/ui.js');
  assert.ok(!page.includes('vendor/three') && !/from '\.\/view3d\.js/.test(ui));
  for (const f of readdirSync(new URL('../../js/steel/', import.meta.url)).filter(x => x.endsWith('.js'))) {
    const src = read(`../../js/steel/${f}`);
    assert.equal(src.includes('vendor/three'), f === 'view3d.js', `${f}: three.js`);
    assert.equal(src.includes('web-ifc-api'), f === 'worker.js', `${f}: web-ifc`);
    assert.equal(src.includes('../ifcplan/model.js'), f === 'worker.js' || f === 'ifcread.js', `${f}: the plans tool's model`);
  }
});

test('the shared files are reused unchanged: no steel code in the bridge, the Excel writer or the plans tool', () => {
  for (const f of ['../../js/laser/bridge.js', '../../js/dwg/xlsx.js', '../../js/ifcplan/model.js', '../../js/ifcplan/worker.js']) assert.ok(!/steel/i.test(read(f)), f);
});
```

<!-- file: _tests/steel/page.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout has CRLF
const page = read('../../steel-takeoff.html'), ui = read('../../js/steel/ui.js'), css = read('../../css/tools.css');
function toolStrings() {
  const window = {};
  vm.runInNewContext(read('../../js/steel/i18n-steel.js'), { window });
  return window.ST_I18N;
}

test('every element the controller looks up is on the page, once', () => {
  const ids = new Set([...ui.matchAll(/\$\('([A-Za-z0-9_]+)'\)/g)].map(m => m[1]));
  for (const k of ['length', 'width', 'depth']) ids.add(`stBath_${k}`);
  for (const k of ['galv', 'zinc', 'paint', 'steel', 'minimum']) ids.add(`stRate_${k}`);
  for (const g of ['S235', 'S275', 'S355', 'other']) ids.add(`stGrade_${g}`);
  assert.ok(ids.size >= 40, `${ids.size} ids`);
  for (const id of ids) assert.equal(page.split(`id="${id}"`).length - 1, 1, id);
});

test('the inputs of spec §6.2: files (NC1, ZIP, IFC, several), a folder, the example and its IFC twin', () => {
  assert.ok(page.includes('<input type="file" id="stFiles" multiple accept=".nc1,.nc,.NC1,.NC,.zip,.ifc" class="gv-visually-hidden" />'));
  assert.ok(page.includes('<input type="file" id="stFolder" webkitdirectory multiple class="gv-visually-hidden" />'));
  assert.ok(page.includes('id="stExample" data-i18n="st.example"') && page.includes('id="stExampleIfc" data-i18n="st.example.ifc"'));
  assert.ok(/webkitGetAsEntry[\s\S]*readEntries/.test(ui), 'a dropped folder is walked');
  assert.ok(!/\.bytes\s*(\|\||\?)/.test(ui) && ui.includes('f.data || new Uint8Array(await f.arrayBuffer())'), 'a File is read with arrayBuffer(): Chrome 154 has Blob.prototype.bytes');
});

test('the order of spec §6: summary, settings, table, 3D, costs, outputs, then the CTA and survey', () => {
  const at = s => { const i = page.indexOf(s); assert.ok(i > 0, s); return i; };
  const order = ['id="stSummary"', 'id="stSettings"', 'id="stTable"', 'id="stView"', 'id="stCosts"', 'id="stXlsx"', 'id="stPrint"', 'id="stCta"', 'id="stSurvey"'].map(at);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.deepEqual([...page.matchAll(/data-preset="(\w+)"/g)].map(m => m[1]), ['top', 'front', 'side', 'iso']);
  assert.ok(page.includes('id="st3dModel" aria-pressed="false" data-i18n="st.3d.model" hidden'), 'whole model: for an IFC only');
  assert.deepEqual([...page.matchAll(/data-answer="(\w+)"/g)].map(m => m[1]), ['tekla', 'hand', 'other']);
});

test('GA (spec §8): the events and their parameters, never names or figures', () => {
  const events = [...ui.matchAll(/ga\('([a-z0-9_]+)', (\{[^}]*\})/g)].map(m => `${m[1]} ${m[2].replace(/\s+/g, ' ')}`);
  assert.deepEqual(events.sort(), [
    "steel_cta_click { where: 'page' }",
    'steel_error { reason }',
    'steel_error { reason: \'nonc1\' }',
    'steel_example {}',
    'steel_example {}',
    "steel_loaded { kind: 'ifc', pieces: piecesBucket(m.rows.reduce((a, r) => a + r.qty, 0)) }",
    "steel_loaded { kind: s.zips.length ? 'zip' : 'nc1', pieces: piecesBucket(pieces) }",
    'steel_print {}',
    'steel_survey { answer: b.dataset.answer }',
    'steel_view3d { result }',
    'steel_xlsx {}',
  ].sort());
});

test('the bridge waits 120 s; the IFC check runs as its own pass after the rows are shown', () => {
  assert.ok(ui.includes('const TIMEOUT_MS = 120000;'));
  const read1 = ui.indexOf("engine.process(file.name, bytes, {})"), render1 = ui.indexOf('render();', read1), check = ui.indexOf("{ check: true }");
  assert.ok(read1 > 0 && render1 > read1 && check > render1, 'rows rendered before the check is asked for');
});

test('the CSS: steel rules scoped .st-*, the 375 px table scrolling in its box, the print sheet without the 3D view and controls', () => {
  const from = css.indexOf('/* ---- steel-takeoff.html'), steel = css.slice(from, css.indexOf('/* ---- ', from + 10));
  assert.ok(steel.length > 1000);
  for (const m of steel.matchAll(/^([^@\s}][^{]*)\{/gm)) assert.ok(/\.st-|#st[A-Z0-9]/.test(m[1]), `unscoped: ${m[1]}`);
  assert.ok(page.includes('<div class="gv-table-wrap">\n          <table class="gv-table st-table" id="stTable">'), 'the table scrolls inside its own box');
  const print = steel.slice(steel.indexOf('@media print'));
  for (const s of ['.st-settings', '.st-view', '.st-outputs', '.st-piece']) assert.ok(print.includes(s), s);
  assert.ok(page.includes('<div class="gv-print-head">'), 'the printed sheet keeps a title');
});

test('the page carries the Greek strings inline, as the page starts in Greek', () => {
  const s = toolStrings();
  let n = 0;
  for (const m of page.matchAll(/data-i18n="(st\.[^"]+)"[^>]*>([^<]*)</g)) { n++; assert.equal(m[2], s.el[m[1]], m[1]); }
  for (const m of page.matchAll(/data-i18n-aria="(st\.[^"]+)" aria-label="([^"]*)"/g)) { n++; assert.equal(m[2], s.el[m[1]], m[1]); }
  assert.ok(n >= 70, `${n} inline strings`);
});

test('every st.* key on the page and in the controller has a string', () => {
  const s = toolStrings();
  let used = 0;
  for (const src of [page, ui]) for (const m of src.matchAll(/['"`](st\.[A-Za-z0-9.]+[A-Za-z0-9])['"`]/g)) { used++; assert.ok(m[1] in s.en, `${m[1]} has no string`); }
  assert.ok(used >= 100, `${used} keys found`);
});
```

Run:
```bash
node _tests/extract.mjs $PLAN _tests/steel/site.test.js
node _tests/extract.mjs $PLAN _tests/steel/page.test.js
node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
```
Expected: `ℹ pass 80`, `ℹ fail 5` (the page is missing; the shared-files test already holds).

- [ ] **Step 2: Write the page, its styles and its controller**

<!-- file: steel-takeoff.html -->
```html
<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AidedCAM - Προμέτρηση χάλυβα και προσφορά γαλβανίσματος</title>
  <meta name="description" content="Δωρεάν προμέτρηση χάλυβα από αρχεία NC1 (DSTV) ή IFC: κιλά και m² ανά τεμάχιο και διατομή, έλεγχος λουτρού γαλβανίσματος, κόστος από τις δικές σας τιμές, Excel και εκτύπωση. Στον browser, χωρίς ανέβασμα, χωρίς εγγραφή." />
  <meta name="robots" content="index, follow" />
  <link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="icon-192.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png" />
  <meta name="theme-color" content="#f4f3ee" />
  <link rel="canonical" href="https://www.aidedcam.com/steel-takeoff.html" />
  <meta property="og:title" content="AidedCAM - Προμέτρηση χάλυβα και προσφορά γαλβανίσματος" />
  <meta property="og:description" content="Ρίξτε τα NC1 ή το IFC ενός έργου και πάρτε κιλά και m² ανά τεμάχιο, έλεγχο λουτρού και κόστος γαλβανίσματος, σε Excel ή εκτύπωση." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://www.aidedcam.com/steel-takeoff.html" />
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
  <link rel="stylesheet" href="css/tools.css?v=20261104" />
  <link rel="stylesheet" href="css/sidebar.css?v=20261104" />
  <script src="js/sidebar.js?v=20261104" defer></script>
</head>
<body>

  <nav class="navbar" id="navbar">
    <div class="nav-container">
      <a href="index.html" class="nav-logo">
        <img src="aided-cam-mark.png" alt="AidedCAM" width="30" height="34" />
        <img class="wordmark" src="aidedcam-wordmark.svg" alt="" width="716" height="67" />
      </a>
      <div class="nav-right">
        <a href="index.html" class="nav-back" data-i18n="st.back">Αρχική</a>
        <div class="lang-switcher">
          <button class="lang-btn active" data-lang="el">EL</button>
          <button class="lang-btn" data-lang="en">EN</button>
          <button class="lang-btn" data-lang="it">IT</button>
        </div>
      </div>
    </div>
  </nav>

  <main class="gv st">
    <header class="gv-head">
      <p class="gv-eyebrow" data-i18n="st.eyebrow">Εργαλείο</p>
      <h1 data-i18n="st.title">Προμέτρηση χάλυβα και προσφορά γαλβανίσματος</h1>
      <p class="gv-lede" data-i18n="st.lede">Ρίξτε τα αρχεία NC1 (DSTV) ενός έργου, έναν φάκελο ή ένα ZIP, ή ένα IFC, και πάρτε κιλά και m² ανά τεμάχιο και ανά διατομή, έλεγχο για το λουτρό γαλβανίσματος και το κόστος από τις δικές σας τιμές, σε Excel ή σε εκτύπωση.</p>
      <p class="gv-privacy" data-i18n="st.privacy">Τα αρχεία μένουν στον υπολογιστή σας· τίποτα δεν ανεβαίνει.</p>
      <p class="ip-indicative st-indicative" data-i18n="st.indicative">Τα μεγέθη βγαίνουν από τις ονομαστικές τιμές των αρχείων. Ελέγξτε τα απέναντι στα κατασκευαστικά σχέδια.</p>
      <p class="gv-cross"><a href="free-tools.html" data-i18n="st.cross">Όλα τα εργαλεία →</a></p>
    </header>

    <div class="gv-wrap">
      <noscript><p class="gv-banner">Το εργαλείο χρειάζεται JavaScript. / The tool needs JavaScript.</p></noscript>

      <section class="gv-bar st-bar" data-i18n-aria="st.aria.files" aria-label="Αρχεία">
        <label class="gv-btn gv-btn-primary gv-file-label">
          <input type="file" id="stFiles" multiple accept=".nc1,.nc,.NC1,.NC,.zip,.ifc" class="gv-visually-hidden" />
          <span data-i18n="st.open">Άνοιγμα αρχείων</span>
        </label>
        <label class="gv-btn gv-file-label">
          <input type="file" id="stFolder" webkitdirectory multiple class="gv-visually-hidden" />
          <span data-i18n="st.folder">Άνοιγμα φακέλου</span>
        </label>
        <button type="button" class="gv-btn" id="stExample" data-i18n="st.example">Φόρτωση παραδείγματος</button>
        <button type="button" class="gv-link" id="stExampleIfc" data-i18n="st.example.ifc">Το ίδιο σε IFC</button>
        <button type="button" class="gv-btn" id="stClear" data-i18n="st.clear" hidden>Καθαρισμός</button>
      </section>

      <div class="gv-banner" id="stBanner" role="status" hidden></div>
      <p class="gv-drop-hint" id="stDropHint" data-i18n="st.drop">Σύρετε εδώ αρχεία NC1, έναν φάκελο, ένα ZIP ή ένα IFC, ή πατήστε «Άνοιγμα αρχείων».</p>
      <p class="gv-note st-busy" id="stBusy" role="status" hidden></p>
      <div class="dq-error" id="stError" role="alert" hidden></div>

      <section class="st-panel" id="stPanel" hidden>
        <div class="gv-print-head"><img src="aidedcam-wordmark.svg" alt="AidedCAM" width="716" height="67" /><span data-i18n="st.title">Προμέτρηση χάλυβα και προσφορά γαλβανίσματος</span></div>
        <h2 class="st-h" data-i18n="st.summary">Σύνοψη</h2>
        <dl class="st-summary" id="stSummary"></dl>
        <p class="gv-note" id="stCapped" hidden></p>
        <details class="st-skipped" id="stSkipped" hidden>
          <summary id="stSkippedHead"></summary>
          <ul id="stSkippedList"></ul>
        </details>

        <section class="st-settings" id="stSettings">
          <h2 class="st-h" data-i18n="st.settings">Ρυθμίσεις</h2>
          <fieldset class="st-fields">
            <legend data-i18n="st.set.bath">Λουτρό γαλβανίσματος</legend>
            <div class="gv-settings-grid">
              <label><span data-i18n="st.set.bath.length">Μήκος λουτρού (m)</span><input type="text" inputmode="decimal" id="stBath_length" /></label>
              <label><span data-i18n="st.set.bath.width">Πλάτος λουτρού (m)</span><input type="text" inputmode="decimal" id="stBath_width" /></label>
              <label><span data-i18n="st.set.bath.depth">Βάθος λουτρού (m)</span><input type="text" inputmode="decimal" id="stBath_depth" /></label>
            </div>
          </fieldset>
          <fieldset class="st-fields">
            <legend data-i18n="st.set.rates">Τιμές</legend>
            <div class="gv-settings-grid">
              <label><span data-i18n="st.set.galv">Γαλβάνισμα (€/kg)</span><input type="text" inputmode="decimal" id="stRate_galv" /></label>
              <label><span data-i18n="st.set.zinc">Επιβάρυνση ψευδαργύρου (€/kg)</span><input type="text" inputmode="decimal" id="stRate_zinc" /></label>
              <label><span data-i18n="st.set.paint">Βαφή (€/m²)</span><input type="text" inputmode="decimal" id="stRate_paint" /></label>
              <label><span data-i18n="st.set.steel">Υλικό χάλυβα (€/kg)</span><input type="text" inputmode="decimal" id="stRate_steel" /></label>
              <label><span data-i18n="st.set.minimum">Ελάχιστη χρέωση (€)</span><input type="text" inputmode="decimal" id="stRate_minimum" /></label>
            </div>
            <label class="st-check"><input type="checkbox" id="stPerGrade" /><span data-i18n="st.set.pergrade">Τιμή υλικού ανά ποιότητα χάλυβα</span></label>
            <div class="gv-settings-grid" id="stGrades" hidden>
              <label><span data-i18n="st.set.steel.S235">S235 (€/kg)</span><input type="text" inputmode="decimal" id="stGrade_S235" /></label>
              <label><span data-i18n="st.set.steel.S275">S275 (€/kg)</span><input type="text" inputmode="decimal" id="stGrade_S275" /></label>
              <label><span data-i18n="st.set.steel.S355">S355 (€/kg)</span><input type="text" inputmode="decimal" id="stGrade_S355" /></label>
              <label><span data-i18n="st.set.steel.other">Άλλη ποιότητα (€/kg)</span><input type="text" inputmode="decimal" id="stGrade_other" /></label>
            </div>
            <label class="st-check"><input type="checkbox" id="stVat" /><span data-i18n="st.set.vat">ΦΠΑ 24%</span></label>
          </fieldset>
          <p class="gv-note" data-i18n="st.set.hint">Οι ρυθμίσεις μένουν σε αυτόν τον browser. Ένα κενό πεδίο τιμής αφήνει τη γραμμή του εκτός.</p>
        </section>

        <div class="st-table-head">
          <h2 class="st-h" data-i18n="st.table">Ανά διατομή και ποιότητα</h2>
          <label class="st-sort"><span data-i18n="st.sort">Ταξινόμηση</span>
            <select id="stSort">
              <option value="kg" data-i18n="st.sort.kg">κατά βάρος</option>
              <option value="length" data-i18n="st.sort.length">κατά μήκος</option>
              <option value="mark" data-i18n="st.sort.mark">κατά θέση</option>
            </select>
          </label>
        </div>
        <p class="gv-note st-table-hint" data-i18n="st.table.hint">Ανοίξτε μια διατομή για τα τεμάχιά της· ένα κλικ σε τεμάχιο το δείχνει σε 3D.</p>
        <div class="gv-table-wrap">
          <table class="gv-table st-table" id="stTable">
            <thead><tr><th data-i18n="st.th.profile">Διατομή · θέση</th><th data-i18n="st.th.grade">Ποιότητα · σχέδιο</th><th class="dq-num" data-i18n="st.th.length">Μήκος</th><th class="dq-num" data-i18n="st.th.qty">Τεμ.</th><th class="dq-num" data-i18n="st.th.kg">kg</th><th class="dq-num" data-i18n="st.th.m2">m²</th><th data-i18n="st.th.check">Έλεγχος</th><th data-i18n="st.th.bath">Λουτρό</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>

        <section class="st-view" id="stView" data-i18n-aria="st.view" aria-label="Προβολή 3D" hidden>
          <div class="gv-panel-head">
            <span id="st3dHead"></span>
            <span class="gv-tools-controls">
              <button type="button" class="gv-link" data-preset="top" data-i18n="st.3d.top">Κάτοψη</button>
              <button type="button" class="gv-link" data-preset="front" data-i18n="st.3d.front">Πρόσοψη</button>
              <button type="button" class="gv-link" data-preset="side" data-i18n="st.3d.side">Πλάγια</button>
              <button type="button" class="gv-link" data-preset="iso" data-i18n="st.3d.iso">Αξονομετρικό</button>
              <button type="button" class="gv-link" id="st3dFit" data-i18n="st.fit">Προσαρμογή</button>
              <button type="button" class="gv-link" id="st3dModel" aria-pressed="false" data-i18n="st.3d.model" hidden>Όλο το μοντέλο</button>
            </span>
          </div>
          <div class="st-3d-box" id="st3dBox">
            <p class="ip-3d-note" id="st3dNote" role="status" hidden></p>
          </div>
        </section>

        <h2 class="st-h" data-i18n="st.costs">Κόστος</h2>
        <div class="gv-table-wrap">
          <table class="gv-table st-costs" id="stCosts">
            <thead><tr><th data-i18n="st.cth.line">Γραμμή</th><th class="dq-num" data-i18n="st.cth.qty">Ποσότητα</th><th class="dq-num" data-i18n="st.cth.rate">Τιμή</th><th class="dq-num" data-i18n="st.cth.amount">Ποσό</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <p class="gv-note st-bath-note" data-i18n="st.bath.note">Ο έλεγχος του λουτρού είναι ενδεικτικός· την τελική απόφαση την παίρνει ο γαλβανιστής.</p>
        <p class="gv-note st-print-note" data-i18n="st.indicative">Τα μεγέθη βγαίνουν από τις ονομαστικές τιμές των αρχείων. Ελέγξτε τα απέναντι στα κατασκευαστικά σχέδια.</p>
        <div class="st-outputs">
          <button type="button" class="gv-btn gv-btn-primary" id="stXlsx" data-i18n="st.xlsx">Λήψη Excel</button>
          <button type="button" class="gv-btn" id="stPrint" data-i18n="st.print">Εκτύπωση / PDF</button>
        </div>
      </section>

      <p class="gv-note st-v1" data-i18n="st.v1">Δεν περιλαμβάνονται σε αυτή την έκδοση: βίδες και συγκολλήσεις, κοπή και nesting, τιμές ανά κατηγορία γαλβανίσματος, μεταφορά.</p>

      <section class="gv-cta">
        <h2 data-i18n="st.cta.title">Προσφορές γαλβανίσματος και βαφής από τα δικά σας αρχεία;</h2>
        <p data-i18n="st.cta.text">Το στήνουμε πάνω στον τιμοκατάλογο και τα πρότυπα προσφορών της επιχείρησής σας, με σύνδεση στο ERP και μαζική επεξεργασία έργων.</p>
        <a class="btn-primary" id="stCta" href="index.html#contact" data-i18n="st.cta.link">Επικοινωνήστε μαζί μας</a>
        <div class="gv-survey" id="stSurvey">
          <p data-i18n="st.survey.q">Πώς βγάζετε σήμερα τα κιλά για μια προσφορά;</p>
          <button type="button" class="gv-chip" data-answer="tekla" data-i18n="st.survey.tekla">Από τη λίστα του Tekla</button>
          <button type="button" class="gv-chip" data-answer="hand" data-i18n="st.survey.hand">Με το χέρι από τα σχέδια</button>
          <button type="button" class="gv-chip" data-answer="other" data-i18n="st.survey.other">Αλλιώς</button>
          <p class="gv-thanks" id="stThanks" data-i18n="st.survey.thanks" hidden>Ευχαριστούμε!</p>
        </div>
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
    <p class="lc-notice"><span data-i18n="st.notice">Ανάγνωση IFC: web-ifc (ThatOpen Company), MPL-2.0,</span> <a href="https://github.com/ThatOpen/engine_web-ifc" rel="noopener" data-i18n="st.notice.link">ο κώδικας στο GitHub</a></p>
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

  <script src="js/steel/i18n-steel.js?v=20261104"></script>
  <script>
    var translations = {
      el: {
        "_title": "AidedCAM - Προμέτρηση χάλυβα και προσφορά γαλβανίσματος",
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
        "_title": "AidedCAM - Steel take-off and galvanizing quote",
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
        "_title": "AidedCAM - Distinta acciaio e preventivo di zincatura",
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
      translations[l] = Object.assign({}, (window.ST_I18N || {})[l] || {}, translations[l]);
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
  <script type="module" src="js/steel/ui.js?v=20261104"></script>
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
.cp-table-head .gv-link:disabled { color: var(--faint); cursor: default; }                   /* until the union is back */
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

/* ---- steel-takeoff.html: steel take-off and galvanizing quote (spec §6) ---- */
.st-panel { padding: 0; }   /* editorial.css pads every <section> */
.st-busy { font-style: italic; }
.st-h { margin: 1.5rem 0 0.5rem; font-family: var(--font-mono); font-weight: 400; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.st-summary { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); margin: 0; border-top: 1px solid var(--line); border-left: 1px solid var(--line); }
.st-fig { margin: 0; padding: 0.6rem 0.8rem; background: var(--panel); min-width: 0; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.st-fig dt { font-size: 0.75rem; color: var(--muted); }
.st-fig dd { margin: 0.15rem 0 0; font-size: 0.95rem; color: var(--ink); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.st-fig.st-big dd { font-family: var(--font-display); font-size: 1.35rem; font-weight: 400; }
.st-fig.st-warn dd { color: var(--gv-rapid); }
.st-fig.st-bad dd { color: var(--gv-hi); }
.st-skipped { margin: 0.6rem 0 0; font-size: 0.85rem; color: var(--ink-soft); }
.st-skipped summary { cursor: pointer; color: var(--muted); }
.st-skipped ul { margin: 0.4rem 0 0; padding-left: 1.2rem; max-height: 12rem; overflow: auto; overflow-wrap: anywhere; }
.st-settings { padding: 0; }
.st-fields { margin: 0.4rem 0; padding: 0.2rem 0.9rem 0.6rem; border: 1px solid var(--line); background: var(--panel); min-width: 0; }
.st-fields legend { padding: 0 0.3rem; font-size: 0.8rem; color: var(--ink-soft); }
.st-fields input[aria-invalid="true"] { border-color: var(--gv-hi); }
.st-check { display: inline-flex; align-items: center; gap: 0.5rem; margin: 0.2rem 1.5rem 0.2rem 0; font-size: 0.85rem; color: var(--ink-soft); cursor: pointer; }
.st-table-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.5rem; }
.st-sort { display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--muted); }
.st-sort select { font: inherit; padding: 0.3rem 0.4rem; border: 1px solid var(--line-strong); background: var(--panel); color: var(--ink); border-radius: 2px; }
.st-table-hint { margin: 0 0 0.5rem; }
.st-group th, .st-group td { background: var(--paper-2); }
.st-group th { text-align: left; }
.st-expand { padding: 0; border: 0; background: none; color: var(--ink); font: inherit; font-weight: 600; cursor: pointer; }
.st-expand:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.st-piece { cursor: pointer; }
.st-piece td:first-child { padding-left: 1.6rem; }
.st-piece:hover td, .st-piece.is-sel td { background: var(--accent-soft); }
.st-piece:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.st-piece.is-out td { color: var(--muted); }
.st-sub { color: var(--muted); }
.st-mark { text-align: center !important; }
.st-warn { color: var(--gv-rapid); font-weight: 600; }
.st-bad { color: var(--gv-hi); font-weight: 600; }
.st-note { color: var(--gv-rapid); }
.st-view { margin: 1.25rem 0 0.5rem; padding: 0; border: 1px solid var(--line); background: var(--panel); min-width: 0; }
.st-view .gv-panel-head { flex-wrap: wrap; }
.st-view #st3dHead { text-transform: none; letter-spacing: 0; }   /* a mark keeps its case */
.st-3d-box { position: relative; width: 100%; height: min(56vh, 460px); overflow: hidden; background: var(--panel); }
@media (max-width: 720px) { .st-3d-box { height: min(50vh, 340px); } }
.st-3d-canvas { display: block; cursor: grab; touch-action: none; }
.st-3d-canvas:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
#st3dModel[aria-pressed="true"] { text-decoration: underline; }
.st-costs th { text-align: left; }
.st-costs tbody th { font-weight: 400; color: var(--ink); font-size: 0.88rem; }
.st-costs .st-sum th, .st-costs .st-sum td { border-top: 1px solid var(--line-strong); }
.st-costs .st-total th, .st-costs .st-total td { font-weight: 700; border-top: 2px solid var(--ink); }
.st-costs .st-min th { color: var(--gv-rapid); }
.st-cost-none td { color: var(--muted); font-style: italic; white-space: normal; }
.st-outputs { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 1rem 0 0.5rem; }
.st-print-note { display: none; }
.st-v1 { margin: 1rem 0; }
@media print {
  .st-settings, .st-sort, .st-table-hint, .st-view, .st-outputs, .st-piece, .st-skipped, .st-v1, #stDropHint, #stBusy { display: none !important; }
  .st-print-note { display: block !important; }
  .st-summary { grid-template-columns: repeat(3, 1fr); }
  .st-group th, .st-group td { background: none; }
  .st-table, .st-costs { break-inside: avoid; }
}

/* ---- ifc-plans.html: DXF floor plans from IFC (spec §6) ---- */
.ip-indicative { display: inline-block; margin: 0.6rem 0 0; padding: 0.2rem 0.7rem; border: 1px solid var(--gv-rapid); border-radius: 999px; color: var(--ink-soft); font-size: 0.82rem; }
.ip-settings { padding: 0.25rem 0 0.5rem; }   /* editorial.css pads every <section> */
.ip-settings h2, .ip-panel h2 { margin: 0.5rem 0 0; font-family: var(--font-mono); font-weight: 400; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.ip-settings input[aria-invalid="true"] { border-color: var(--gv-hi); }
.ip-settings .ip-check { flex-direction: row; align-items: center; gap: 0.5rem; align-self: end; padding-bottom: 0.45rem; color: var(--ink-soft); font-size: 0.85rem; }
.ip-busy { font-style: italic; }
.ip-panel { padding: 0; }
.ip-status .ip-file { font-weight: 600; color: var(--ink); }
.ip-table-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.5rem; margin: 1rem 0 0.5rem; }
.ip-storeys tbody tr { cursor: pointer; }
.ip-storeys tbody tr:hover td, .ip-storeys tbody tr.is-sel td { background: var(--accent-soft); }
.ip-storeys tbody tr.is-sel td:first-child { font-weight: 600; }
.ip-storeys tbody tr:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.ip-storeys .ip-empty { color: var(--muted); font-style: italic; }
.ip-storeys .ip-warn { color: var(--gv-rapid); font-weight: 600; }
.ip-storeys .gv-btn { padding: 0.25rem 0.6rem; font-size: 0.8rem; }
.ip-view { margin: 1.25rem 0 0.5rem; border: 1px solid var(--line); background: var(--panel); min-width: 0; }
.ip-legend { display: flex; flex-wrap: wrap; gap: 0.3rem 1rem; list-style: none; margin: 0; padding: 0.45rem 0.75rem; border-top: 1px solid var(--line); font-size: 0.8rem; color: var(--ink-soft); }
.ip-swatch { display: inline-block; width: 18px; height: 0; margin-right: 0.4rem; border-top: 2px solid; vertical-align: middle; }
.ip-panel .ip-h { margin-top: 1.5rem; }
.ip-warnings { margin: 0.3rem 0 1rem; }
.ip-v1 { margin: 1rem 0; }
.ip-legend li { display: flex; }
.ip-toggle { display: inline-flex; align-items: center; padding: 0.1rem 0.3rem; margin: 0 -0.3rem; border: 1px solid transparent; border-radius: 2px; background: none; color: inherit; font: inherit; cursor: pointer; }
.ip-toggle:hover { border-color: var(--line-strong); }
.ip-toggle[aria-pressed="false"] { color: var(--muted); text-decoration: line-through; }
.ip-toggle[aria-pressed="false"] .ip-swatch { opacity: 0.35; }
.ip-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.ip-legend-note { margin: 0; padding: 0 0.75rem 0.5rem; }

/* ---- ifc-plans.html: the 3D tab ---- */
.ip-tabs { display: flex; border-bottom: 1px solid var(--line); }
.ip-tab { margin-bottom: -1px; padding: 0.55rem 1rem; border: 0; border-bottom: 2px solid transparent; background: none; color: var(--muted); font-family: var(--font-body); font-size: 0.9rem; font-weight: 500; cursor: pointer; }
.ip-tab:hover { color: var(--ink); }
.ip-tab[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--accent); }
.ip-tab:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.ip-3d-head { flex-wrap: wrap; }
.ip-3d-head #ip3dHead { text-transform: none; letter-spacing: 0; }   /* the unit keeps its case: "1,10 m", not "1,10 M" */
.ip-3d-bar { padding: 0.4rem 0.75rem; border-bottom: 1px solid var(--line); color: var(--ink-soft); font-size: 0.85rem; }
.ip-3d-check { display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; }
.ip-3d-box { position: relative; width: 100%; height: min(62vh, 520px); overflow: hidden; background: var(--panel); }
@media (max-width: 720px) { .ip-3d-box { height: min(50vh, 360px); } }
.ip-3d-canvas { display: block; cursor: crosshair; touch-action: none; }
.ip-3d-canvas:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.ip-3d-note { position: absolute; inset: 0; z-index: 1; display: flex; align-items: center; justify-content: center; margin: 0; padding: 1rem; background: var(--panel); color: var(--muted); font-size: 0.9rem; text-align: center; }
.ip-3d-note[hidden] { display: none; }
@media print { .ip-tabs, #ip3dView, .ip-legend-note { display: none !important; } #ipPlanView { display: block !important; } }
```

<!-- file: js/steel/ui.js -->
```js
// Steel take-off: the page controller (spec §6, §7, §8). NC1 files (several, a folder or a .zip) are parsed here, on
// the page; one IFC goes to the web-ifc worker through the shared bridge, which answers its rows and then, in a second
// pass, their geometry check. The quote (groups, totals, bath marks, costs) is recomputed from the rows and the
// settings on every change. three.js and the 3D view load on the first piece shown.
import { t, ga, fmtNum, localeOf } from '../gcode/shell/i18n.js';
import { lsGet, lsSet } from '../gcode/shell/settings-store.js';
import { renderBanner } from '../gcode/shell/banner.js';
import { createEngine } from '../laser/bridge.js?v=20261001';
import { writeXlsx } from '../dwg/xlsx.js?v=20260930';
import { parseNc1 } from './nc1.js?v=20261104';
import { nc1Piece } from './piece.js?v=20261104';
import { takeoff, costs, sortTakeoff, kg1, m2 } from './quote.js?v=20261104';
import { readZip } from './unzip.js?v=20261104';
import { workbook, xlsxName, rowNotes } from './book.js?v=20261104';
import { pieceSlabs } from './shape3d.js?v=20261104';
import { cleanSettings, sortSet, kindOf, piecesBucket, parsePositive, parseRateInput, SETTINGS_KEY, NC1_MAX, IFC_MAX_BYTES, RATE_KEYS } from './state.js?v=20261104';

const $ = id => document.getElementById(id);
const SURVEY_KEY = 'aidedcam-steel-survey';
const TIMEOUT_MS = 120000;                                     // spec §7
const MAX_TRIANGLES = 3000000;                                 // the whole-model view's cap

const state = {
  set: null,            // { kind: 'nc1' | 'ifc', source, rows, skipped, read, capped, ifc, gen }
  error: null,          // { name, reason, detail }
  settings: cleanSettings(safeJson(lsGet(SETTINGS_KEY))),
  open: new Set(),      // the expanded groups' keys
  selected: null,       // the row shown in 3D
  whole: false,         // an IFC's whole model in 3D
  banner: null,
  busy: null,
};
let latest = 0;          // the newest set; a slower, earlier read must not replace it
let view3d = null, view3dModule = null, view3dTries = 0;
// Read by the browser check: the times (ms) of the example, a file set, the IFC check and the 3D view; the view.
window.__steel = { timings: {}, view3d: null };
const mark = (name, t0) => { window.__steel.timings[name] = Math.round(performance.now() - t0); };

function safeJson(s) { try { return JSON.parse(s || '{}'); } catch (e) { return {}; } }
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const saveSettings = () => lsSet(SETTINGS_KEY, JSON.stringify(state.settings));
function showBanner(b) { state.banner = b; renderBanner($('stBanner'), b, t); }
function busy(b) { state.busy = b; $('stBusy').hidden = !b; $('stBusy').textContent = b ? t(b.key, b.params) : ''; }
const kgText = v => `${fmtNum(kg1(v), 1)} kg`;
const m2Text = v => `${fmtNum(m2(v), 2)} m²`;
const mmText = v => `${fmtNum(Math.round(v), 0)} mm`;
const eur = v => `${fmtNum(v, 2)} €`;

// ---- the engine: web-ifc in its worker, loaded with the first IFC ----
const supported = typeof WebAssembly === 'object' && typeof Worker === 'function';
const engine = supported ? createEngine({
  makeWorker: () => new Worker(new URL('./worker.js?v=20261104', import.meta.url), { type: 'module' }),
  timeoutMs: TIMEOUT_MS,
}) : null;

// ---- reading a set ----
function decode(bytes) {
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  return utf8.includes('�') ? new TextDecoder('windows-1253').decode(bytes) : utf8;   // Greek marks saved as Windows-1253
}
const baseName = n => String(n).replace(/^.*[\\/]/, '');

function newSet(set) {
  state.set = set; state.error = null; state.open = new Set(); state.selected = null; state.whole = false;
  if (view3d) view3d.clear();
  $('stView').hidden = true;
}

// files: File objects, or { name, data } held in memory (the example, a ZIP's entries): never read a File's .bytes,
// which Chrome 154 defines as a method (Blob.prototype.bytes). source: 'file' | 'example'. folder: the chosen folder.
async function loadSet(files, source, { t0 = performance.now(), folder = '' } = {}) {
  const my = ++latest;
  if (!files.length) return;
  newSet(null);
  const s = sortSet(files);
  if (s.ifc) { await loadIfc(s.ifc, source, s.skipped, my, t0); return; }
  busy({ key: 'st.reading' });
  render();
  const skipped = [...s.skipped], items = [];
  for (const z of s.zips) {
    let r;
    try { r = await readZip(new Uint8Array(await z.arrayBuffer())); } catch (e) { r = { ok: false, reason: 'notzip' }; }
    if (my !== latest) return;
    if (!r.ok) { skipped.push({ name: z.name, reason: `zip.${r.reason}` }); continue; }
    for (const e of r.files) {
      if (kindOf(e.name) === 'nc1') items.push({ name: baseName(e.name), data: e.bytes });
      else skipped.push({ name: baseName(e.name), reason: 'notnc1' });
    }
  }
  items.push(...s.nc1);
  const capped = items.length > NC1_MAX;
  const take = items.slice(0, NC1_MAX);
  const texts = await Promise.all(take.map(async f => {
    try { return decode(f.data || new Uint8Array(await f.arrayBuffer())); } catch (e) { return null; }
  }));
  if (my !== latest) return;
  const rows = [];
  take.forEach((f, i) => {
    if (texts[i] === null) { skipped.push({ name: f.name, reason: 'read' }); return; }
    const r = parseNc1(texts[i]);
    if (!r.ok) skipped.push({ name: f.name, reason: r.reason, line: r.line });
    else rows.push(nc1Piece(r.piece, f.name));
  });
  busy(null);
  const sourceName = folder || (s.zips.length === 1 && !s.nc1.length ? s.zips[0].name : s.nc1.length === 1 && !s.zips.length ? s.nc1[0].name : '');
  if (!rows.length) {
    state.error = { name: sourceName || (files.length === 1 ? files[0].name : ''), reason: 'nonc1' };
    state.set = { kind: 'nc1', source: sourceName, rows: [], skipped, read: 0, capped };
    ga('steel_error', { reason: 'nonc1' });
    render();
    return;
  }
  newSet({ kind: 'nc1', source: sourceName, rows, skipped, read: rows.length, capped, count: take.length });
  render();
  mark(source === 'example' ? 'example' : 'file', t0);
  const pieces = rows.reduce((a, r) => a + (r.qty > 0 ? r.qty : 0), 0);
  if (source === 'example') ga('steel_example', {});
  else ga('steel_loaded', { kind: s.zips.length ? 'zip' : 'nc1', pieces: piecesBucket(pieces) });
}

async function loadIfc(file, source, skipped, my, t0) {
  const fail = reason => { busy(null); state.error = { name: file.name, reason }; ga('steel_error', { reason }); render(); };
  if (file.size > IFC_MAX_BYTES) { fail('limit'); return; }       // refused before reading
  if (!engine) { fail('nowasm'); return; }
  busy({ key: 'st.ifc.reading' });
  render();
  let bytes;
  try { bytes = file.data ? file.data.buffer.slice(0) : await file.arrayBuffer(); } catch (e) { if (my === latest) fail('read'); return; }
  if (my !== latest) return;
  const m = await engine.process(file.name, bytes, {});
  if (my !== latest) return;
  if (m.type !== 'result') { fail(m.reason === 'read' && m.detail ? `read.${m.detail}` : m.reason || 'engine'); return; }
  busy(null);
  const set = { kind: 'ifc', source: file.name, rows: m.rows, skipped, read: 1, capped: false, ifc: { name: file.name, file: m.file, checking: true, mesh: null } };
  newSet(set);
  render();
  mark(source === 'example' ? 'example' : 'file', t0);
  if (source === 'example') ga('steel_example', {});
  else ga('steel_loaded', { kind: 'ifc', pieces: piecesBucket(m.rows.reduce((a, r) => a + r.qty, 0)) });
  // The second pass: the members priced from their profiles get their geometry check.
  const t1 = performance.now();
  const c = await engine.process('check', new ArrayBuffer(0), { check: true });
  if (state.set !== set) return;
  set.ifc.checking = false;
  if (c.type === 'result') {
    for (const x of c.checks) {
      const r = set.rows[x.row];
      if (!r) continue;
      r.checking = false; r.checkKg = x.checkKg; r.checkM2 = x.checkM2;
      if (x.check && !r.warn.includes('check')) r.warn.push('check');
    }
  } else set.ifc.checkFailed = true;
  for (const r of set.rows) r.checking = false;
  mark('check', t1);
  render();
}

// ---- rendering ----
let model = null;        // the last quote: { take, cost }

function render() {
  const s = state.set;
  $('stDropHint').hidden = !!s || !!state.error;
  $('stClear').hidden = !s && !state.error;
  $('stError').hidden = !state.error;
  if (state.error) $('stError').textContent = (state.error.name ? `${state.error.name}: ` : '') + errorText(state.error);
  const ok = s && s.rows.length > 0;
  $('stPanel').hidden = !ok;
  if (!ok) { model = null; return; }
  const take = takeoff(s.rows, state.settings.bath, state.settings.sort);
  const cost = costs(take, state.settings.rates);
  model = { take, cost };
  renderSummary(s, take);
  renderSkipped(s);
  renderTable(take);
  renderCosts(cost);
}

function errorText(e) {
  if (e.reason === 'read.ifczip' || e.reason === 'read.ifcxml') return t(`st.err.${e.reason}`);
  return t(`st.err.${['read', 'limit', 'timeout', 'engine', 'nosteel', 'schema', 'nonc1', 'nowasm'].includes(e.reason) ? e.reason : 'engine'}`);
}

function renderSummary(s, take) {
  const T = take.totals, items = [];
  const add = (key, value, cls) => items.push([t(key), value, cls]);
  if (s.kind === 'ifc') {
    add('st.sum.ifc', `${s.ifc.name} · ${s.ifc.file.schema}`);
    add('st.sum.members', t('st.sum.members.v', { n: s.ifc.file.members, a: s.ifc.file.assemblies }));
  } else {
    add('st.sum.files', t('st.sum.files.v', { read: s.read, skipped: s.skipped.length }));
  }
  add('st.sum.pieces', t('st.sum.pieces.v', { n: T.pieces, marks: T.marks }));
  add('st.sum.kg', kgText(T.kg), 'st-big');
  add('st.sum.m2', m2Text(T.m2), 'st-big');
  if (take.longest) add('st.sum.longest', `${take.longest.mark || '–'} · ${mmText(take.longest.lengthMm)}`);
  if (take.heaviest) add('st.sum.heaviest', `${take.heaviest.mark || '–'} · ${kgText(take.heaviest.unitKg)}`);
  const b = state.settings.bath;
  add('st.sum.bath', t('st.sum.bath.v', { l: fmtNum(b.length, 1), w: fmtNum(b.width, 1), d: fmtNum(b.depth, 1), double: T.double, no: T.no }), T.no ? 'st-bad' : T.double ? 'st-warn' : '');
  add('st.sum.checks', s.ifc && s.ifc.checking ? t('st.sum.checking') : s.ifc && s.ifc.checkFailed ? t('st.sum.checkfailed') : String(T.checks), T.checks ? 'st-warn' : '');
  if (T.excluded) add('st.sum.excluded', String(T.excluded), 'st-warn');
  if (T.noArea) add('st.sum.noarea', String(T.noArea), 'st-warn');
  if (s.ifc && s.ifc.file.fromGeometry) add('st.sum.geometry', String(s.ifc.file.fromGeometry));
  const dl = $('stSummary');
  dl.replaceChildren(...items.map(([k, v, cls]) => { const d = el('div', cls ? `st-fig ${cls}` : 'st-fig'); d.append(el('dt', null, k), el('dd', null, v)); return d; }));
  $('stCapped').hidden = !s.capped;
  $('stCapped').textContent = s.capped ? t('st.capped', { n: fmtNum(NC1_MAX, 0) }) : '';
}

function renderSkipped(s) {
  const box = $('stSkipped');
  box.hidden = !s.skipped.length;
  if (!s.skipped.length) return;
  $('stSkippedHead').textContent = t('st.skipped', { n: s.skipped.length });
  $('stSkippedList').replaceChildren(...s.skipped.map(x => el('li', null, `${x.name}: ${t(`st.skip.${x.reason}`, { line: x.line })}`)));
}

const BATH_MARK = { fits: '✓', double: '⚠', no: '✗' };
function renderTable(take) {
  const body = $('stTable').tBodies[0];
  const rows = [];
  for (const g of take.groups) {
    const open = state.open.has(g.key);
    const tr = el('tr', 'st-group');
    tr.dataset.group = g.key;
    const th = el('th');
    th.scope = 'row';
    const btn = el('button', 'st-expand', `${open ? '▾' : '▸'} ${g.profile}`);
    btn.type = 'button';
    btn.setAttribute('aria-expanded', String(open));
    btn.dataset.toggle = g.key;
    th.appendChild(btn);
    const warnRows = g.rows.filter(r => r.warn.includes('check')).length;
    const count = mark => g.rows.reduce((a, r) => a + (!r.excluded && r.bath === mark && r.qty > 0 ? r.qty : 0), 0);
    const dbl = count('double'), no = count('no');
    tr.append(th, el('td', null, g.grade), el('td', 'dq-num', `${fmtNum(m2(g.lengthM), 2)} m`), el('td', 'dq-num', String(g.count)),
      el('td', 'dq-num', fmtNum(kg1(g.kg), 1)), el('td', 'dq-num', fmtNum(m2(g.m2), 2)),
      el('td', warnRows ? 'st-mark st-warn' : 'st-mark', warnRows ? `⚠ ${warnRows}` : ''),
      el('td', no ? 'st-mark st-bad' : dbl ? 'st-mark st-warn' : 'st-mark', no ? `✗ ${no}` : dbl ? `⚠ ${dbl}` : '✓'));
    rows.push(tr);
    if (!open) continue;
    for (const r of g.rows) rows.push(pieceRow(r));
  }
  body.replaceChildren(...rows);
}

function pieceRow(r) {
  const tr = el('tr', 'st-piece');
  tr.tabIndex = 0;
  tr.classList.toggle('is-sel', r === state.selected);
  tr.classList.toggle('is-out', !!r.excluded);
  tr._row = r;
  const n = r.qty > 0 ? r.qty : 0;
  const check = r.checking ? '…' : r.warn.includes('check') ? '⚠' : r.checkKg !== null && r.checkKg !== undefined ? '✓' : '–';
  const cc = el('td', r.warn.includes('check') ? 'st-mark st-warn' : 'st-mark', check);
  if (r.checkKg !== null && r.checkKg !== undefined) cc.title = t('st.check.tip', { nominal: kgText(r.unitKg), check: kgText(r.checkKg) });
  const notes = rowNotes(r, t);
  const mk = el('td', 'st-markcell', r.mark || '–');
  if (notes) { mk.title = notes; mk.append(el('span', 'st-note', ` ${r.warn.filter(w => w !== 'check').map(() => '⚠').join('')}`)); }
  const bath = el('td', r.bath === 'no' ? 'st-mark st-bad' : r.bath === 'double' ? 'st-mark st-warn' : 'st-mark', r.excluded ? '' : BATH_MARK[r.bath]);
  if (!r.excluded) bath.title = t(`st.bath.${r.bath}`);
  tr.append(mk, el('td', 'st-sub', r.drawing || ''), el('td', 'dq-num', mmText(r.lengthMm)), el('td', 'dq-num', String(r.qty)),
    el('td', 'dq-num', r.excluded ? '–' : fmtNum(kg1(r.unitKg * n), 1)), el('td', 'dq-num', r.excluded || r.unitM2 === null ? '–' : fmtNum(m2(r.unitM2 * n), 2)), cc, bath);
  return tr;
}

$('stTable').addEventListener('click', e => {
  const b = e.target.closest('[data-toggle]');
  if (b) {
    const k = b.dataset.toggle;
    if (state.open.has(k)) state.open.delete(k); else state.open.add(k);
    if (model) renderTable(model.take);
    const again = $('stTable').querySelector(`[data-toggle="${CSS.escape(k)}"]`);
    if (again) again.focus();
    return;
  }
  const tr = e.target.closest('tr.st-piece');
  if (tr && tr._row) select(tr._row);
});
$('stTable').addEventListener('keydown', e => {
  const tr = e.target.closest && e.target.closest('tr.st-piece');
  if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(tr._row); }
});
$('stSort').addEventListener('change', e => {
  state.settings.sort = e.target.value;
  saveSettings();
  if (model) { sortTakeoff(model.take.groups, state.settings.sort); renderTable(model.take); }
});

function renderCosts(cost) {
  const body = $('stCosts').tBodies[0];
  const rows = [];
  const line = (label, qty, rate, amount, cls) => {
    const tr = el('tr', cls);
    tr.append(el('th', null, label), el('td', 'dq-num', qty), el('td', 'dq-num', rate), el('td', 'dq-num', amount));
    rows.push(tr);
  };
  if (!cost.lines.length) {
    const tr = el('tr', 'st-cost-none');
    const td = el('td', null, t('st.cost.none'));
    td.colSpan = 4;
    tr.append(td);
    rows.push(tr);
  }
  for (const l of cost.lines) line(t(`st.cost.${l.id}`), l.unit === 'm2' ? m2Text(l.qty) : kgText(l.qty), `${fmtNum(l.rate, 3)} €/${l.unit === 'm2' ? 'm²' : 'kg'}`, eur(l.amount));
  line(t('st.cost.subtotal'), '', '', eur(cost.subtotal), 'st-sum');
  if (cost.minApplies) line(t('st.cost.minimum', { min: fmtNum(cost.minimum, 2) }), '', '', eur(cost.net), 'st-min');
  line(t(cost.vatOn ? 'st.cost.vat' : 'st.cost.novat'), '', '', eur(cost.vat));
  line(t('st.cost.total'), '', '', eur(cost.total), 'st-total');
  body.replaceChildren(...rows);
}

// ---- the 3D view ----
async function select(row) {
  state.selected = row;
  if (model) renderTable(model.take);
  await open3d(row);
}

async function open3d(row) {
  const s = state.set;
  const t0 = performance.now();
  $('stView').hidden = false;
  $('st3dModel').hidden = s.kind !== 'ifc';
  $('st3dModel').setAttribute('aria-pressed', String(state.whole));
  $('st3dHead').textContent = `${row.mark || '–'} · ${row.profile}`;
  note3d('st.3d.loading');
  let mod;
  try { mod = await (view3dModule || (view3dModule = import(`./view3d.js?v=20261104${view3dTries ? `#retry${view3dTries}` : ''}`))); }
  catch (e) { view3dModule = null; view3dTries++; if (state.selected === row) note3d('st.3d.failed'); return; }
  if (state.selected !== row || state.set !== s) return;
  if (!view3d) {
    if (!mod.hasWebGL2()) { note3d('st.3d.nogl'); view3dGa(s, 'nogl'); return; }
    try { view3d = mod.createView3d($('st3dBox'), { onLost: lost3d }); renderView3dLabel(); window.__steel.view3d = view3d; }
    catch (e) { if (view3d) view3d.dispose(); view3d = null; note3d('st.3d.nogl'); view3dGa(s, 'nogl'); return; }
  }
  if (s.kind === 'nc1') {
    const slabs = pieceSlabs(row.nc);
    if (!slabs.length) { view3d.clear(); note3d('st.3d.noshape'); return; }
    view3d.showPiece(slabs);
  } else {
    if (!s.ifc.mesh) {
      const m = await engine.process('mesh', new ArrayBuffer(0), { mesh: true, maxTriangles: MAX_TRIANGLES });
      if (state.set !== s) return;
      if (m.type !== 'result') { note3d(m.reason === 'stale' ? 'st.3d.stale' : 'st.3d.failed'); return; }
      if (!m.mesh) { note3d('st.3d.large'); return; }
      s.ifc.mesh = m.mesh;
      const grades = new Map();
      for (const r of s.rows) for (const e of r.eids) grades.set(e, r.grade);
      s.ifc.gradeOf = e => grades.get(e);
    }
    if (state.selected !== row) return;
    view3d.showModel(s.ifc.mesh, s.ifc.gradeOf, new Set(row.eids), { only: !state.whole, focus: true });
  }
  note3d(null);
  view3dGa(s, 'shown');
  requestAnimationFrame(() => mark('view3d', t0));
}
function view3dGa(s, result) { if (!s.ga3d) { s.ga3d = true; ga('steel_view3d', { result }); } }
function note3d(key) { const n = $('st3dNote'); n.hidden = !key; n.dataset.key = key || ''; n.textContent = key ? t(key) : ''; }
function lost3d() {
  if (view3d) { view3d.dispose(); view3d = null; window.__steel.view3d = null; }
  note3d('st.3d.failed');
}
function renderView3dLabel() { if (view3d) view3d.canvas.setAttribute('aria-label', t('st.aria.3d')); }
$('stView').addEventListener('click', e => {
  const b = e.target.closest('[data-preset]');
  if (b && view3d) view3d.preset(b.dataset.preset);
});
$('st3dFit').addEventListener('click', () => { if (view3d) view3d.fit(); });
$('st3dModel').addEventListener('click', () => {
  state.whole = !state.whole;
  if (state.selected) open3d(state.selected);
});

// ---- settings: remembered in this browser ----
function renderSettings() {
  const s = state.settings, r = s.rates;
  const show = v => (v === null || v === undefined ? '' : new Intl.NumberFormat(localeOf(), { maximumFractionDigits: 4, useGrouping: false }).format(v));
  for (const k of ['length', 'width', 'depth']) if (document.activeElement !== $(`stBath_${k}`)) $(`stBath_${k}`).value = show(s.bath[k]);
  for (const k of RATE_KEYS) if (document.activeElement !== $(`stRate_${k}`)) $(`stRate_${k}`).value = show(r[k]);
  for (const g of ['S235', 'S275', 'S355', 'other']) if (document.activeElement !== $(`stGrade_${g}`)) $(`stGrade_${g}`).value = show(r.steelGrade[g]);
  $('stPerGrade').checked = r.perGrade;
  $('stGrades').hidden = !r.perGrade;
  $('stRate_steel').closest('label').hidden = r.perGrade;
  $('stVat').checked = r.vat;
  $('stSort').value = s.sort;
}
function onSetting(input, apply) {
  input.addEventListener('change', () => {
    const ok = apply(input.value);
    if (ok === false) { input.setAttribute('aria-invalid', 'true'); return; }
    input.removeAttribute('aria-invalid');
    saveSettings();
    renderSettings();
    render();
  });
}
for (const k of ['length', 'width', 'depth']) onSetting($(`stBath_${k}`), v => { const x = parsePositive(v); if (x === undefined || x >= 100) return false; state.settings.bath[k] = x; return true; });
for (const k of RATE_KEYS) onSetting($(`stRate_${k}`), v => { const x = parseRateInput(v); if (x === undefined) return false; state.settings.rates[k] = x; return true; });
for (const g of ['S235', 'S275', 'S355', 'other']) onSetting($(`stGrade_${g}`), v => { const x = parseRateInput(v); if (x === undefined) return false; state.settings.rates.steelGrade[g] = x; return true; });
$('stPerGrade').addEventListener('change', e => { state.settings.rates.perGrade = e.target.checked; saveSettings(); renderSettings(); render(); });
$('stVat').addEventListener('change', e => { state.settings.rates.vat = e.target.checked; saveSettings(); render(); });

// ---- outputs ----
function save(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('stXlsx').addEventListener('click', () => {
  const s = state.set;
  if (!model || !s) return;
  const sheets = workbook({ take: model.take, cost: model.cost, settings: state.settings, source: s.source || t('st.xlsx.nfiles', { n: s.read }) }, t);
  save(new Blob([writeXlsx(sheets)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), xlsxName(s.source, s.read));
  ga('steel_xlsx', {});
});
$('stPrint').addEventListener('click', () => { ga('steel_print', {}); window.print(); });

// ---- inputs ----
// A drop: the files, and the files inside dropped folders (walked through the entries API).
async function dropped(dt) {
  const entries = [...(dt.items || [])].map(i => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null)).filter(Boolean);
  if (!entries.length) return { files: [...(dt.files || [])], folder: '' };
  const files = [];
  const walk = async entry => {
    if (entry.isFile) { files.push(await new Promise((res, rej) => entry.file(res, rej))); return; }
    const reader = entry.createReader();
    for (;;) {
      const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
      if (!batch.length) break;
      for (const e of batch) await walk(e);
    }
  };
  for (const e of entries) { try { await walk(e); } catch (err) { /* an unreadable entry is left out */ } }
  return { files, folder: entries.length === 1 && entries[0].isDirectory ? entries[0].name : '' };
}
// The input is cleared only once its files are read (clearing it first empties them in Chrome).
$('stFiles').addEventListener('change', async e => { const f = [...(e.target.files || [])]; if (f.length) await loadSet(f, 'file'); e.target.value = ''; });
$('stFolder').addEventListener('change', async e => {
  const f = [...(e.target.files || [])];
  const folder = f.length && f[0].webkitRelativePath ? f[0].webkitRelativePath.split('/')[0] : '';
  if (f.length) await loadSet(f, 'file', { folder });
  e.target.value = '';
});
document.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('gv-dragging'); });
document.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('gv-dragging'); });
document.addEventListener('drop', async e => {
  e.preventDefault(); document.body.classList.remove('gv-dragging');
  if (!e.dataTransfer) return;
  const { files, folder } = await dropped(e.dataTransfer);
  if (files.length) await loadSet(files, 'file', { folder });
});
async function example(kind) {
  const t0 = performance.now();
  const my = ++latest;
  const get = async path => {
    const r = await fetch(new URL(`./examples/${path}?v=20261104`, import.meta.url));
    if (!r.ok) throw new Error(String(r.status));
    return new Uint8Array(await r.arrayBuffer());
  };
  let files;
  try {
    if (kind === 'ifc') files = [{ name: 'portal.ifc', data: await get('portal.ifc'), size: 0 }];
    else {
      const index = JSON.parse(new TextDecoder().decode(await get('portal/index.json')));
      files = await Promise.all(index.files.map(async n => ({ name: n, data: await get(`portal/${n}`), size: 0 })));
    }
  } catch (e) { if (my === latest) showBanner({ key: 'st.example.failed' }); return; }
  if (my !== latest) return;
  if (state.banner && state.banner.key === 'st.example.failed') showBanner(null);
  await loadSet(files, 'example', { t0, folder: kind === 'ifc' ? '' : 'portal' });
}
$('stExample').addEventListener('click', () => example('nc1'));
$('stExampleIfc').addEventListener('click', () => example('ifc'));
$('stClear').addEventListener('click', () => { latest++; newSet(null); busy(null); render(); });

// ---- CTA and survey ----
$('stCta').addEventListener('click', () => ga('steel_cta_click', { where: 'page' }));
if (lsGet(SURVEY_KEY)) $('stSurvey').hidden = true;
$('stSurvey').addEventListener('click', e => {
  const b = e.target.closest('[data-answer]');
  if (!b) return;
  ga('steel_survey', { answer: b.dataset.answer });
  lsSet(SURVEY_KEY, b.dataset.answer);
  $('stSurvey').querySelectorAll('[data-answer]').forEach(x => { x.disabled = true; });
  $('stThanks').hidden = false;
});

// A language change re-renders everything built here.
document.addEventListener('gv:lang', () => {
  if (state.banner) showBanner(state.banner);
  busy(state.busy);
  renderSettings();
  renderView3dLabel();
  render();
  if (state.selected) $('st3dHead').textContent = `${state.selected.mark || '–'} · ${state.selected.profile}`;
  if ($('st3dNote').dataset.key) note3d($('st3dNote').dataset.key);
});

if (!supported) showBanner({ key: 'st.engine.nowasm' });
renderSettings();
render();
```

Run:
```bash
node _tests/extract.mjs $PLAN steel-takeoff.html
node _tests/extract.mjs $PLAN css/tools.css
node _tests/extract.mjs $PLAN js/steel/ui.js
for p in index what-you-gain calculator free-tools gcode-viewer milling-gcode-viewer laser-dxf-checker dwg-quantities coverage-precheck ifc-plans legal privacy; do
  sed -i 's#css/sidebar\.css?v=20261002#css/sidebar.css?v=20261104#; s#js/sidebar\.js?v=20261002#js/sidebar.js?v=20261104#' $p.html
done
sed -i "s/const V = '20261002';/const V = '20261104';/; s/'ifc-plans', 'legal', 'privacy'\]/'ifc-plans', 'steel-takeoff', 'legal', 'privacy']/" _tests/sidebar/sidebar.test.js
grep -rln "sidebar.js?v=20261104" --include=*.html . | wc -l
grep -rn "20261002" --include=*.html --include=*.js . | grep -v "^./_docs/"
node --test "_tests/steel/*.test.js" "_tests/sidebar/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
node --test $(git ls-files '_tests/**/*.test.js') 2>&1 | grep -E "^ℹ (pass|fail)"
```
Expected:
- `13` (every page on the placeholder), and the second grep prints nothing;
- `ℹ pass 99`, `ℹ fail 0` (92 steel, 7 sidebar);
- `ℹ pass 596`, `ℹ fail 0` (the tracked suites: the 517, and the 79 steel tests committed in Tasks 1–14; the ifcplan CSS test included).

- [ ] **Step 3: Look at it**

Serve the repo (`python -m http.server 8821 --bind 127.0.0.1`) and open `http://127.0.0.1:8821/steel-takeoff.html?lang=en`. Load the example; open IPE300 and click R1: the rafter shows in 3D with its leaning ridge end and eight web holes. Type a galvanizing rate: the cost block prices it. Load "The same as IFC": the totals agree. Stop the server (Task 17, Step 4 stops every one).

- [ ] **Step 4: Commit**

```bash
git add steel-takeoff.html css/tools.css js/steel/ui.js _tests/steel/site.test.js _tests/steel/page.test.js _tests/sidebar/sidebar.test.js index.html what-you-gain.html calculator.html free-tools.html gcode-viewer.html milling-gcode-viewer.html laser-dxf-checker.html dwg-quantities.html coverage-precheck.html ifc-plans.html legal.html privacy.html
git commit -F - <<'EOF'
Steel take-off: the page, its styles and its controller; the sidebar on the placeholder

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 16: The site integration

**Files:**
- Modify (given whole): `free-tools.html` (the "Steel and building products" group with the card; the strings), `js/sidebar.js` (the seventh tool, its icon and its el/en/it strings), `_tests/sidebar/sidebar.test.js` (seven tools; the steel page; the placeholder), `sitemap.xml`, `llms.txt`
- Test: `_tests/steel/listing.test.js`

**Interfaces:**
- Consumes: the page (Task 15).
- Produces: the tool listed on the site. The sidebar's tools stay the cards of `free-tools.html`, in order (`sidebar.test.js`).

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/steel/listing.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout has CRLF
const between = (s, from, to) => s.slice(s.indexOf(from), s.indexOf(to, s.indexOf(from)));

test('the tools index lists the steel take-off in its own group, Steel and building products', () => {
  const ft = read('../../free-tools.html');
  assert.ok(ft.includes('<a class="ft-card" href="steel-takeoff.html">'));
  const steel = between(ft, 'data-i18n="ft.group.steel"', '</section>');
  assert.ok(steel.includes('href="steel-takeoff.html"'), 'in the Steel and building products group');
  assert.equal((steel.match(/class="ft-card"/g) || []).length, 1, 'one card so far');
  for (const k of ['ft.group.steel', 'ft.steel.title', 'ft.steel.text']) assert.equal(ft.split(`"${k}":`).length - 1, 3, k);
  const strings = [...ft.matchAll(/"ft\.(?:group\.steel|steel\.title|steel\.text)": "([^"]*)"/g)].map(m => m[1]);
  assert.ok(strings.every(s => !/δωρεάν|\bfree\b|gratuit/i.test(s)), 'no "free" in the visible text');
  assert.ok(!strings.slice(6).some(s => s.includes("'")), 'the Italian uses ’');
});

test('the sitemap and llms.txt list it', () => {
  const sm = read('../../sitemap.xml');
  assert.ok(sm.includes('<loc>https://www.aidedcam.com/steel-takeoff.html</loc>\n    <lastmod>2026-10-01</lastmod>'), 'with the lastmod placeholder');
  assert.ok(read('../../llms.txt').includes('- Steel take-off and galvanizing quote (https://www.aidedcam.com/steel-takeoff.html)'));
});
```

Run: `node _tests/extract.mjs $PLAN _tests/steel/listing.test.js && node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 92`, `ℹ fail 2`.

- [ ] **Step 2: Write the site files**

<!-- file: free-tools.html -->
```html
<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AidedCAM - Εργαλεία</title>
  <meta name="description" content="Δωρεάν εργαλεία για μηχανικούς και προγραμματιστές CNC: προβολή G-code τόρνου και φρέζας με χρόνο κύκλου, έλεγχος DXF για κοπή laser και επιμετρήσεις από DWG. Στον browser, χωρίς εγγραφή." />
  <meta name="robots" content="index, follow" />
  <link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="icon-192.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png" />
  <meta name="theme-color" content="#f4f3ee" />
  <link rel="canonical" href="https://www.aidedcam.com/free-tools.html" />
  <meta property="og:title" content="AidedCAM - Εργαλεία" />
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
  <link rel="stylesheet" href="css/sidebar.css?v=20261104" />
  <script src="js/sidebar.js?v=20261104" defer></script>
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
      <p class="gv-eyebrow" data-i18n="ft.eyebrow">Εργαλεία</p>
      <h1 data-i18n="ft.title">Εργαλεία για μηχανικούς και παραγωγή</h1>
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
            <a class="ft-card" href="ifc-plans.html">
              <h3 data-i18n="ft.ifcplans.title">Κατόψεις DXF από IFC</h3>
              <p data-i18n="ft.ifcplans.text">Μία κάτοψη R12 DXF ανά όροφο από το IFC του αρχιτέκτονα, κομμένη στο ύψος που ορίζετε: κάθε τύπος στοιχείου σε δική του στρώση, οι χώροι με όνομα και εμβαδόν, έτοιμες για XREF. Στον browser, χωρίς ανέβασμα.</p>
              <span class="ft-open" data-i18n="ft.open">Άνοιγμα →</span>
            </a>
          </div>
        </div>
        <div class="ft-group">
          <h2 class="gv-eyebrow ft-group-title" data-i18n="ft.group.steel">Χάλυβας και δομικά προϊόντα</h2>
          <div class="ft-cards">
            <a class="ft-card" href="steel-takeoff.html">
              <h3 data-i18n="ft.steel.title">Προμέτρηση χάλυβα και προσφορά γαλβανίσματος</h3>
              <p data-i18n="ft.steel.text">Κιλά και m² ανά τεμάχιο και ανά διατομή από τα αρχεία NC1 (DSTV) ενός έργου ή από ένα IFC, με έλεγχο για το λουτρό γαλβανίσματος, κόστος από τις δικές σας τιμές και λήψη σε Excel. Στον browser, χωρίς ανέβασμα.</p>
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
        "_title": "AidedCAM - Εργαλεία",
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
        "ft.eyebrow": "Εργαλεία",
        "ft.title": "Εργαλεία για μηχανικούς και παραγωγή",
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
        "ft.ifcplans.title": "Κατόψεις DXF από IFC",
        "ft.group.steel": "Χάλυβας και δομικά προϊόντα",
        "ft.steel.title": "Προμέτρηση χάλυβα και προσφορά γαλβανίσματος",
        "ft.steel.text": "Κιλά και m² ανά τεμάχιο και ανά διατομή από τα αρχεία NC1 (DSTV) ενός έργου ή από ένα IFC, με έλεγχο για το λουτρό γαλβανίσματος, κόστος από τις δικές σας τιμές και λήψη σε Excel. Στον browser, χωρίς ανέβασμα.",
        "ft.ifcplans.text": "Μία κάτοψη R12 DXF ανά όροφο από το IFC του αρχιτέκτονα, κομμένη στο ύψος που ορίζετε: κάθε τύπος στοιχείου σε δική του στρώση, οι χώροι με όνομα και εμβαδόν, έτοιμες για XREF. Στον browser, χωρίς ανέβασμα.",
        "ft.open": "Άνοιγμα →",
        "gv.cta.title": "Χρειάζεστε εργαλεία φτιαγμένα για τη δική σας δουλειά;",
        "gv.cta.text": "Φτιάχνουμε λογισμικό στα μέτρα σας για μηχανικούς και παραγωγή: αυτοματισμούς CAD, CAM και BIM, post-processor και εργαλεία σαν αυτά.",
      },
      en: {
        "gv.back": "Home",
        "_title": "AidedCAM - Tools",
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
        "ft.eyebrow": "Tools",
        "ft.title": "Tools for engineering and manufacturing",
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
        "ft.ifcplans.title": "DXF floor plans from IFC",
        "ft.group.steel": "Steel and building products",
        "ft.steel.title": "Steel take-off and galvanizing quote",
        "ft.steel.text": "Kg and m² per piece and per profile from a project's NC1 (DSTV) files or one IFC, with a galvanizing-bath check, the cost at your own rates and an Excel download. In the browser, nothing uploaded.",
        "ft.ifcplans.text": "One R12 DXF floor plan per storey from the architect's IFC, cut at the height you choose: every element type on its own layer, rooms with their name and area, ready to XREF. In the browser, nothing uploaded.",
        "ft.open": "Open →",
        "gv.cta.title": "Need tools built around your own work?",
        "gv.cta.text": "We build tailor-made software for engineering and manufacturing: CAD, CAM and BIM automation, post-processors and tools like these.",
      },
      it: {
        "gv.back": "Home",
        "_title": "AidedCAM - Strumenti",
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
        "ft.eyebrow": "Strumenti",
        "ft.title": "Strumenti per l’ingegneria e la produzione",
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
        "ft.ifcplans.title": "Piante DXF da IFC",
        "ft.group.steel": "Acciaio e prodotti per l’edilizia",
        "ft.steel.title": "Distinta acciaio e preventivo di zincatura",
        "ft.steel.text": "Kg e m² per pezzo e per profilo dai file NC1 (DSTV) di un progetto o da un IFC, con il controllo della vasca di zincatura, il costo con le vostre tariffe e il download in Excel. Nel browser, senza caricare nulla.",
        "ft.ifcplans.text": "Una pianta DXF R12 per piano dall’IFC dell’architetto, tagliata all’altezza che scegliete: ogni tipo di elemento sul proprio layer, i locali con nome e superficie, pronte come XREF. Nel browser, senza caricare nulla.",
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

<!-- file: js/sidebar.js -->
```js
// Free-tools sidebar, on every page (spec: _docs/tools-sidebar/2026-10-01-tools-sidebar-design.md).
// It injects one <nav>: on a wide screen with a mouse, a slim strip of tool icons in the page's left gutter that
// expand into a card on hover or focus; otherwise (narrow, touch, or no gutter wide enough) a floating "Tools"
// button that opens a panel. Strings are el/en/it and follow <html lang>, since pages announce a language change
// with different events. The click is reported to GA only through window.gtag, which exists after consent.
(function () {
  'use strict';

  // The order and URLs of free-tools.html's cards; ids are its translation keys (ft.<id>.title).
  const TOOLS = [
    { id: 'lathe', href: 'gcode-viewer.html' },
    { id: 'mill', href: 'milling-gcode-viewer.html' },
    { id: 'laser', href: 'laser-dxf-checker.html' },
    { id: 'dwgq', href: 'dwg-quantities.html' },
    { id: 'coverage', href: 'coverage-precheck.html' },
    { id: 'ifcplans', href: 'ifc-plans.html' },
    { id: 'steel', href: 'steel-takeoff.html' },
  ];
  const ALL_HREF = 'free-tools.html';

  // Names are the cards' titles; each line is the card's text cut to one line.
  const COPY = {
    el: {
      label: 'Εργαλεία',
      button: 'Εργαλεία',
      all: 'Όλα τα εργαλεία',
      tools: {
        lathe: { name: 'Προβολή G-code τόρνου', line: 'Τα περάσματα των κύκλων, ο χρόνος κύκλου και τα λάθη προγραμματισμού.' },
        mill: { name: 'Προβολή G-code φρέζας', line: 'Κάθε κίνηση σε 3D, οι κύκλοι διάτρησης και ο χρόνος ανά εργαλείο.' },
        laser: { name: 'Έλεγχος DXF για κοπή laser', line: 'Διορθώνει DXF και DWG, δίνει μήκος κοπής, βάρος και χρόνο.' },
        dwgq: { name: 'Επιμετρήσεις από DWG', line: 'Μήκη, εμβαδά και μπλοκ ανά στρώση, με λήψη σε Excel.' },
        coverage: { name: 'Προέλεγχος διαγράμματος κάλυψης', line: 'Κάλυψη, δόμηση και όγκος από το DWG, απέναντι στους όρους δόμησης.' },
        ifcplans: { name: 'Κατόψεις DXF από IFC', line: 'Μία κάτοψη R12 DXF ανά όροφο από το IFC του αρχιτέκτονα.' },
        steel: { name: 'Προμέτρηση χάλυβα και προσφορά γαλβανίσματος', line: 'Κιλά, m² και κόστος γαλβανίσματος από αρχεία NC1 ή ένα IFC.' },
      },
    },
    en: {
      label: 'Tools',
      button: 'Tools',
      all: 'All tools',
      tools: {
        lathe: { name: 'Lathe G-code viewer', line: 'The passes of the cycles, cycle time per tool and common mistakes.' },
        mill: { name: 'Milling G-code viewer', line: 'Every move in 3D, drilling cycles expanded, time per tool.' },
        laser: { name: 'Laser DXF check', line: 'Repairs DXF and DWG files; cut length, weight and time.' },
        dwgq: { name: 'Quantities from DWG', line: 'Lengths, areas and blocks per layer, with an Excel download.' },
        coverage: { name: 'Coverage diagram pre-check', line: 'Coverage, built area and volume, checked against the zone’s terms.' },
        ifcplans: { name: 'DXF floor plans from IFC', line: 'One R12 DXF floor plan per storey from the architect’s IFC.' },
        steel: { name: 'Steel take-off and galvanizing quote', line: 'Kg, m² and galvanizing cost from NC1 files or one IFC.' },
      },
    },
    it: {
      label: 'Strumenti',
      button: 'Strumenti',
      all: 'Tutti gli strumenti',
      tools: {
        lathe: { name: 'Visualizzatore G-code per tornio', line: 'Le passate dei cicli, il tempo ciclo e gli errori più comuni.' },
        mill: { name: 'Visualizzatore G-code per fresa', line: 'Ogni movimento in 3D, i cicli di foratura, il tempo per utensile.' },
        laser: { name: 'Controllo DXF per taglio laser', line: 'Corregge DXF e DWG; lunghezza di taglio, peso e tempo.' },
        dwgq: { name: 'Computi da DWG', line: 'Lunghezze, aree e blocchi per layer, con il download in Excel.' },
        coverage: { name: 'Pre-verifica del diagramma di copertura', line: 'Copertura, superficie e volume a confronto con i parametri di zona.' },
        ifcplans: { name: 'Piante DXF da IFC', line: 'Una pianta DXF R12 per piano dall’IFC dell’architetto.' },
        steel: { name: 'Distinta acciaio e preventivo di zincatura', line: 'Kg, m² e costo di zincatura da file NC1 o da un IFC.' },
      },
    },
  };

  // 24 x 24 line icons, drawn with a 1.5 px stroke in currentColor.
  const ICONS = {
    // A part in the chuck, turned in two diameters, with the insert under it.
    lathe: '<path d="M2.5 4.5h4v15h-4z"/><path d="M6.5 7.5H13v2h7.5v5H13v2H6.5"/><path d="M14.5 21.5l2.5-4.5 2.5 4.5"/>',
    // An end mill with its flutes over a block with a pocket.
    mill: '<path d="M10 2.5h4v4h-4z"/><path d="M10.5 6.5v6.5l1.5 1.5 1.5-1.5V6.5"/><path d="M10.5 9.5l3-1.5M10.5 12l3-1.5"/><path d="M3 16h5.5v2h7v-2H21v5H3z"/>',
    // The laser head, its beam, and the sheet with sparks where it cuts.
    laser: '<path d="M8 2.5h8V7l-3 3.5h-2L8 7z"/><path d="M12 11v5.5" stroke-dasharray="1.6 1.6"/><path d="M2.5 19.5h19"/><path d="M9 17.5l-1.8-1.2M15 17.5l1.8-1.2"/>',
    // A dimension line over a ruler.
    dwgq: '<path d="M3 5h18M3 3.5v3M21 3.5v3"/><path d="M3 10h18v7H3z"/><path d="M6.5 10v3M10 10v4.5M13.5 10v3M17 10v4.5"/>',
    // A plot boundary (dashed) with a hatched building footprint inside it.
    coverage: '<path d="M3.5 7l8-4 9 4.5-2 13h-13z" stroke-dasharray="2 1.8"/><path d="M8.5 9.5h6.5v6.5H8.5z"/><path d="M8.5 13l3.5-3.5M11 16l4-4"/>',
    // A floor plan: outer walls, two partitions and a door swing.
    ifcplans: '<path d="M3 3h18v18H3z"/><path d="M3 12h5M13 12h8M12 12v9"/><path d="M8 12V8"/><path d="M8 8a4 4 0 0 1 4 4"/>',
    // An I-beam's end over a galvanizing bath, the zinc level dashed.
    steel: '<path d="M6 3h12M6 11h12M12 3v8"/><path d="M3 14h18v7H3z"/><path d="M3 16.5h18" stroke-dasharray="1.6 1.6"/>',
    all: '<path d="M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z"/>',
    // An open-end wrench.
    wrench: '<path d="M14.5 3.6a4.8 4.8 0 0 0-4.3 6.6l-6.4 6.4a1.9 1.9 0 0 0 2.7 2.7l6.4-6.4a4.8 4.8 0 0 0 6.6-4.3l-2.8 1.9-2.6-.9-.6-2.7z"/>',
  };

  if (typeof document === 'undefined') {                    // Node tests read the data and stop here
    if (typeof module === 'object' && module) module.exports = { TOOLS, COPY, ICONS };
    return;
  }
  if (document.querySelector('.afs')) return;               // loaded twice by mistake

  const svg = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
  const item = (cls, id, href) =>
    `<a class="${cls}" href="${href}" data-tool="${id}"><span class="afs-icon">${svg(ICONS[id])}</span>` +
    `<span class="afs-card"><span class="afs-name"></span>${id === 'all' ? '<span class="afs-arrow" aria-hidden="true"> →</span>' : '<span class="afs-line"></span>'}</span></a>`;

  const nav = document.createElement('nav');
  nav.className = 'afs';
  nav.dataset.layout = 'panel';
  nav.innerHTML =
    `<button class="afs-fab" type="button" aria-expanded="false" aria-controls="afs-list">${svg(ICONS.wrench)}<span class="afs-fab-text"></span></button>` +
    '<div class="afs-list" id="afs-list"><p class="afs-label" aria-hidden="true"></p><ul>' +
    TOOLS.map(t => `<li>${item('afs-item', t.id, t.href)}</li>`).join('') +
    `</ul>${item('afs-all', 'all', ALL_HREF)}</div>`;
  const fab = nav.querySelector('.afs-fab'), list = nav.querySelector('.afs-list');

  // The current page: its tool, or the all-tools box on free-tools.html. A pretty URL (/ifc-plans) counts too.
  let here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (!here.includes('.')) here += '.html';
  nav.querySelectorAll('a[href]').forEach(a => { if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page'); });

  // ---- Language: follows <html lang> ----
  const pick = () => { const l = (document.documentElement.getAttribute('lang') || 'el').slice(0, 2).toLowerCase(); return COPY[l] ? l : 'el'; };
  function render() {
    const c = COPY[pick()];
    nav.setAttribute('aria-label', c.label);
    nav.querySelector('.afs-label').textContent = c.button;
    nav.querySelector('.afs-fab-text').textContent = c.button;
    for (const t of TOOLS) {
      const a = nav.querySelector(`[data-tool="${t.id}"]`);
      a.querySelector('.afs-name').textContent = c.tools[t.id].name;
      a.querySelector('.afs-line').textContent = c.tools[t.id].line;
    }
    nav.querySelector('.afs-all .afs-name').textContent = c.all;
  }
  render();
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  // ---- Layout: the strip only where it fits, else the floating button ----
  const desktop = window.matchMedia('(min-width: 1200px) and (hover: hover) and (pointer: fine)');
  const CLEAR = 5;                                          // px between the strip and the page's content
  // Where the page's content starts: the content box of its layout wrappers (index-style pages and tool pages).
  function contentLeft() {
    let left = Infinity;
    document.querySelectorAll('.container, .nav-container, .gv-wrap').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && !nav.contains(el)) left = Math.min(left, r.left + (parseFloat(getComputedStyle(el).paddingLeft) || 0));
    });
    return left;
  }
  function stripFits() {
    if (!desktop.matches) return false;
    nav.dataset.layout = 'strip';                           // measure the strip where it would sit
    const r = list.getBoundingClientRect();
    return r.right + CLEAR <= contentLeft() && r.height + 2 * 80 <= window.innerHeight;   // clear of the navbar and the banner
  }
  function layout() {
    const strip = stripFits();
    const focused = nav.contains(document.activeElement) && document.activeElement !== fab;
    nav.dataset.layout = strip ? 'strip' : 'panel';
    if (strip) setOpen(false);
    else if (focused) fab.focus();                          // a strip link had focus and is now hidden: keep the place
  }

  // ---- The panel (narrow screens and touch) ----
  function setOpen(open, refocus) {
    const was = nav.classList.contains('is-open');
    nav.classList.toggle('is-open', open);
    fab.setAttribute('aria-expanded', String(open));
    if (was && !open && refocus) fab.focus();
  }
  fab.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  // Esc closes an open panel; the focus goes back to the button only if it was in the sidebar.
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('is-open')) setOpen(false, nav.contains(document.activeElement)); });
  // Focus leaving the sidebar closes the panel, so it never covers what the keyboard lands on. Tab out to the
  // browser's own UI gives no relatedTarget: look again on the next frame.
  nav.addEventListener('focusout', e => {
    if (!nav.classList.contains('is-open')) return;
    if (e.relatedTarget) { if (!nav.contains(e.relatedTarget)) setOpen(false); return; }
    requestAnimationFrame(() => { if (nav.classList.contains('is-open') && !nav.contains(document.activeElement)) setOpen(false); });
  });
  // Back from a tool page through the back/forward cache: the panel comes back closed.
  window.addEventListener('pageshow', e => { if (e.persisted) setOpen(false); });
  document.addEventListener('pointerdown', e => { if (nav.classList.contains('is-open') && !nav.contains(e.target)) setOpen(false); });

  // ---- GA: which tool, from which layout; no names or figures ----
  nav.addEventListener('click', e => {
    const a = e.target.closest('a[data-tool]');
    if (a && typeof window.gtag === 'function') window.gtag('event', 'freetools_sidebar_click', { tool: a.dataset.tool, layout: nav.dataset.layout });
  });

  document.body.appendChild(nav);
  layout();
  let queued = false;
  const relayout = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; layout(); }); } };
  window.addEventListener('resize', relayout);
  if (desktop.addEventListener) desktop.addEventListener('change', relayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
})();
```

<!-- file: _tests/sidebar/sidebar.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout has CRLF
const V = '20261104';                                                                           // deploy day swaps it
const PAGES = ['index', 'what-you-gain', 'calculator', 'free-tools', 'gcode-viewer', 'milling-gcode-viewer', 'laser-dxf-checker',
  'dwg-quantities', 'coverage-precheck', 'ifc-plans', 'steel-takeoff', 'legal', 'privacy'].map(p => `${p}.html`);
const LANGS = ['el', 'en', 'it'];

// The script runs in the browser; in Node it hands its data to `module.exports` and touches no DOM.
function loadSidebar() {
  const sandbox = { module: { exports: {} } };
  vm.runInNewContext(read('../../js/sidebar.js'), sandbox);
  return JSON.parse(JSON.stringify(sandbox.module.exports));         // plain objects of this realm
}
const count = (s, sub) => s.split(sub).length - 1;

test('every page at the site root is a listed page', () => {
  const root = readdirSync(new URL('../../', import.meta.url)).filter(f => f.endsWith('.html')).sort();
  assert.deepEqual(root, [...PAGES].sort());
});

test('every page loads the stylesheet and the deferred script once, in <head>, with the same ?v=', () => {
  for (const p of PAGES) {
    const html = read(`../../${p}`);
    assert.equal(count(html, 'css/sidebar.css'), 1, `${p}: one stylesheet`);
    assert.equal(count(html, 'js/sidebar.js'), 1, `${p}: one script`);
    assert.ok(html.includes(`  <link rel="stylesheet" href="css/sidebar.css?v=${V}" />\n  <script src="js/sidebar.js?v=${V}" defer></script>\n</head>`), `${p}: both just before </head>`);
  }
});

test('the seven tools and their URLs are the cards of free-tools.html, in order', () => {
  const { TOOLS } = loadSidebar();
  const ft = read('../../free-tools.html');
  const cards = [...ft.matchAll(/<a class="ft-card" href="([^"]+)">\s*<h3 data-i18n="ft\.([a-z]+)\.title">/g)].map(m => ({ id: m[2], href: m[1] }));
  assert.equal(cards.length, 7);
  assert.deepEqual(TOOLS.map(t => ({ id: t.id, href: t.href })), cards);
});

test('the tool names are those of the free-tools cards, in every language', () => {
  const { TOOLS, COPY } = loadSidebar();
  const ft = read('../../free-tools.html');
  for (const t of TOOLS) {
    const names = [...ft.matchAll(new RegExp(`"ft\.${t.id}\.title": "([^"]+)"`, 'g'))].map(m => m[1]);
    assert.equal(names.length, 3, t.id);
    LANGS.forEach((l, i) => assert.equal(COPY[l].tools[t.id].name, names[i], `${l} ${t.id}`));   // el, en, it order in the page
  }
});

test('the strings are complete in el, en and it, and each tool has one short line', () => {
  const { TOOLS, COPY } = loadSidebar();
  assert.deepEqual(Object.keys(COPY).sort(), [...LANGS].sort());
  const keys = o => Object.keys(o).filter(k => k !== 'tools').sort();
  for (const l of LANGS) {
    assert.deepEqual(keys(COPY[l]), keys(COPY.el), `${l}: same keys as el`);
    for (const k of keys(COPY[l])) assert.ok(typeof COPY[l][k] === 'string' && COPY[l][k].trim(), `${l}.${k}`);
    assert.deepEqual(Object.keys(COPY[l].tools).sort(), TOOLS.map(t => t.id).sort(), `${l}: every tool`);
    for (const t of TOOLS) {
      const { name, line } = COPY[l].tools[t.id];
      assert.ok(name && line, `${l} ${t.id}`);
      assert.ok(line.length <= 72 && !line.includes('\n'), `${l} ${t.id}: one line (${line.length})`);
    }
  }
});

test('the Italian uses the typographic apostrophe, and en/it carry no Greek', () => {
  const { COPY } = loadSidebar();
  const all = o => JSON.stringify(o);
  assert.ok(!all(COPY.it).includes("'"), 'no ASCII apostrophe in the Italian');
  const PROPER = [];                                    // Greek proper terms allowed in en/it (none needed so far)
  for (const l of ['en', 'it']) {
    let s = all(COPY[l]); for (const p of PROPER) s = s.split(p).join('');
    assert.ok(!/[Ͱ-Ͽἀ-῿]/.test(s), `${l}: ${s.match(/.{0,20}[Ͱ-Ͽἀ-῿].{0,20}/)}`);
  }
  assert.ok(/[Ͱ-Ͽ]/.test(all(COPY.el)), 'the Greek is Greek');
});

test('no external requests, the GA event through window.gtag only, nothing in editorial.css or tools.css', () => {
  const js = read('../../js/sidebar.js'), css = read('../../css/sidebar.css');
  for (const [n, s] of [['js', js], ['css', css]]) {
    assert.ok(!/https?:\/\/(?!www\.w3\.org\/2000\/svg)/.test(s), `${n}: no URL but the SVG namespace`);
    assert.ok(!/@import|url\(/.test(s) || n === 'js', `${n}: no imported files`);
  }
  assert.ok(js.includes("'freetools_sidebar_click'"));
  assert.ok(/window\.gtag\(\s*'event',\s*'freetools_sidebar_click',\s*\{\s*tool: [^,]+,\s*layout: [^}]+\}\s*\)/.test(js), 'tool and layout only');
  assert.ok(/typeof window\.gtag === 'function'/.test(js), 'only when gtag exists (after consent)');
  assert.ok(/MutationObserver[\s\S]*attributeFilter: \['lang'\]/.test(js), 'follows <html lang>');
  assert.ok(/@media print[\s\S]*display: none/.test(css), 'hidden in print');
  assert.ok(/prefers-reduced-motion: reduce/.test(css), 'reduced motion');
  for (const f of ['../../css/editorial.css', '../../css/tools.css']) assert.ok(!/afs-|sidebar/.test(read(f)), f);
});
```

<!-- file: sitemap.xml -->
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.aidedcam.com/</loc>
    <lastmod>2026-10-01</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://www.aidedcam.com/what-you-gain.html</loc>
    <lastmod>2026-10-01</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://www.aidedcam.com/calculator.html</loc>
    <lastmod>2026-10-01</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://www.aidedcam.com/gcode-viewer.html</loc>
    <lastmod>2026-10-01</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.aidedcam.com/milling-gcode-viewer.html</loc>
    <lastmod>2026-10-01</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.aidedcam.com/free-tools.html</loc>
    <lastmod>2026-10-01</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://www.aidedcam.com/laser-dxf-checker.html</loc>
    <lastmod>2026-10-01</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.aidedcam.com/dwg-quantities.html</loc>
    <lastmod>2026-10-01</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.aidedcam.com/coverage-precheck.html</loc>
    <lastmod>2026-10-01</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.aidedcam.com/ifc-plans.html</loc>
    <lastmod>2026-10-01</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.aidedcam.com/steel-takeoff.html</loc>
    <lastmod>2026-10-01</lastmod>
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
- DXF floor plans from IFC (https://www.aidedcam.com/ifc-plans.html): runs in the browser, nothing is uploaded; reads an IFC model (IFC2X3 or IFC4, .ifc in STEP text, up to 150 MB) with the open-source web-ifc reader and gives one R12 DXF floor plan per storey, cut at a chosen height above each storey's level (1.10 m by default): every element type on its own layer (walls, doors, windows, columns, beams, slabs, stairs, railings, curtain walls, furniture, MEP, other), the room outlines with labels of name and area (from the IFC quantities or the outline), Greek text in code page 1253, in metres, centimetres or millimetres, with an optional move to the origin, each storey as a download or all of them in a ZIP; every plan keeps the IFC's coordinates, so the storeys overlay as XREFs. Elements the reader cannot mesh are listed, not drawn. Greek, English, Italian.
- Steel take-off and galvanizing quote (https://www.aidedcam.com/steel-takeoff.html): runs in the browser, nothing is uploaded; reads a project's DSTV/NC1 files (several, a folder or a .zip; the ST header, holes BO and contours AK/IK) or one IFC (IfcBeam, IfcColumn, IfcMember, IfcPlate, read with the open-source web-ifc reader) and gives every piece and the pieces grouped by profile and grade with length, count, kg and m² (nominal values from the NC1 header or the IFC profile parameters, plates from their contours, at 7,850 kg/m³, each checked against the geometry with a warning above 5 %), the longest and the heaviest piece, a galvanizing-bath fit check (fits, double dip, doesn't fit; 12.6 × 1.3 × 1.8 m by default), and cost lines from the rates the visitor types (galvanizing and zinc surcharge per kg, painting per m², steel material per kg or per grade, a minimum charge, VAT 24 %), as an Excel (.xlsx) file or a printed A4 quote sheet. Greek, English, Italian.

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
for f in free-tools.html js/sidebar.js _tests/sidebar/sidebar.test.js sitemap.xml llms.txt; do node _tests/extract.mjs $PLAN $f; done
node --test "_tests/steel/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
node --test $(git ls-files '_tests/**/*.test.js') 2>&1 | grep -E "^ℹ (pass|fail)"
```
Expected: `ℹ pass 94`, `ℹ fail 0`; then `ℹ pass 609`, `ℹ fail 0` (517 + the 92 steel tests committed so far; the sidebar suite now holds seven tools; the laser, DWG, coverage, ifcplan and gcode tests of `free-tools.html` still pass).

- [ ] **Step 3: Commit**

```bash
git add free-tools.html js/sidebar.js _tests/sidebar/sidebar.test.js sitemap.xml llms.txt _tests/steel/listing.test.js
git commit -F - <<'EOF'
Steel take-off: on the tools page, in the sidebar, the sitemap and llms.txt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 17: Browser verification

**Files:**
- Create: `_tests/steel/browser-check.js`, `_tests/steel/browser-check.cjs` (port 8821; `SHOT`, `BIG`, `GL`)
- Modify: `_tests/sidebar/browser-check.js`: the steel page in `PAGES` and `TOOL_PAGE`; seven items; with seven tools the 375 px panel reaches y 110, so the "tap outside" moves to y 95, and leaving the panel by Tab takes nine presses.

**Interfaces:**
- Consumes: the page and `window.__steel` (Task 15); the site integration (Task 16).

- [ ] **Step 1: Write the checks and the runner**

<!-- file: _tests/steel/browser-check.js -->
```js
// Dev-only browser check of steel-takeoff.html (Jekyll skips _tests). It is one Playwright function: run it with the
// Playwright MCP (browser_run_code_unsafe, filename: _tests/steel/browser-check.js) or with
// node _tests/steel/browser-check.cjs. It expects the repo root served on http://127.0.0.1:8821/ and returns
// { pass, fail, checks: [{ name, ok, got }] }.
async (page) => {
  const BASE = 'http://127.0.0.1:8821/';
  const env = typeof process !== 'undefined' && process.env ? process.env : {};
  const checks = [];
  const check = (name, ok, got) => checks.push({ name, ok: !!ok, got });
  const errors = [], external = [], requests = [];
  const watch = p => {
    p.on('console', m => { if (m.type() === 'error' || /GL_INVALID|CONTEXT_LOST/.test(m.text())) errors.push(m.text()); });
    p.on('pageerror', e => errors.push(String(e)));
    p.on('request', r => { const u = r.url(); requests.push(u); if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
  };
  watch(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.clearBrowserCache');                           // a cached old module would hide a fix

  // A stored ZIP (the Excel file, and test archives) read and written here, in Node.
  const unzip = buf => {
    const out = {};
    let p = 0;
    while (buf.readUInt32LE(p) === 0x04034b50) {
      const size = buf.readUInt32LE(p + 18), n = buf.readUInt16LE(p + 26), x = buf.readUInt16LE(p + 28);
      out[buf.toString('utf8', p + 30, p + 30 + n)] = buf.toString('utf8', p + 30 + n + x, p + 30 + n + x + size);
      p += 30 + n + x + size;
    }
    return out;
  };
  const zipOf = (entries, flags = 0) => {
    const parts = [], cen = [];
    let off = 0;
    for (const [name, text] of entries) {
      const nm = Buffer.from(name), body = Buffer.from(text);
      const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(flags, 6); h.writeUInt32LE(body.length, 18); h.writeUInt32LE(body.length, 22); h.writeUInt16LE(nm.length, 26);
      const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(flags, 8); c.writeUInt32LE(body.length, 20); c.writeUInt32LE(body.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(off, 42);
      parts.push(h, nm, body); cen.push(c, nm); off += 30 + nm.length + body.length;
    }
    const cd = Buffer.concat(cen), end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
    return Buffer.concat([...parts, cd, end]);
  };
  const download = async selector => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click(selector)]);
    const chunks = []; for await (const c of await dl.createReadStream()) chunks.push(c);
    return { name: dl.suggestedFilename(), bytes: Buffer.concat(chunks) };
  };
  const summary = () => page.$$eval('#stSummary .st-fig', ds => Object.fromEntries(ds.map(d => [d.querySelector('dt').innerText.trim(), d.querySelector('dd').innerText.trim()])));
  const groups = () => page.$$eval('#stTable tbody tr.st-group', trs => trs.map(tr => [...tr.cells].map(c => c.innerText.replace(/^[▸▾]\s*/, '').trim()).join(' | ')));
  const costRows = () => page.$$eval('#stCosts tbody tr', trs => trs.map(tr => [...tr.cells].map(c => c.innerText.trim()).filter(Boolean).join(' | ')));
  const timings = () => page.evaluate(() => ({ ...window.__steel.timings }));
  const shown = () => page.waitForFunction(() => !document.querySelector('#stPanel').hidden && document.querySelector('#stBusy').hidden, null, { timeout: 30000 });
  const checked = () => page.waitForFunction(() => !/running|σε εξέλιξη/.test(document.querySelector('#stSummary').innerText), null, { timeout: 60000 });
  const view = () => page.waitForFunction(() => window.__steel.view3d && window.__steel.timings.view3d >= 0 && document.querySelector('#st3dNote').hidden, null, { timeout: 30000 });
  const files = (selector, list) => page.setInputFiles(selector, list.map(([name, text]) => ({ name, mimeType: 'application/octet-stream', buffer: Buffer.isBuffer(text) ? text : Buffer.from(text) })));
  const fresh = async (lang = 'en') => {
    await page.goto(BASE + 'steel-takeoff.html?lang=' + lang);
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('privacy-pref', 'declined'); });
    await page.goto(BASE + 'steel-takeoff.html?lang=' + lang);
    await page.evaluate(() => { window.__ga = []; window.gtag = (...a) => window.__ga.push(a); window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  };

  // 1. The page paints without web-ifc or three.js; the example NC1 set loads under 1 s.
  await page.setViewportSize({ width: 1280, height: 900 });
  await fresh();
  check('English title', (await page.title()) === 'AidedCAM - Steel take-off and galvanizing quote', await page.title());
  check('the eyebrow reads Tool', (await page.$eval('.gv-eyebrow', e => e.innerText.trim().toLowerCase())) === 'tool');
  const before = requests.slice();
  await page.click('#stExample');
  await shown();
  const t1 = await timings();
  check('the example: from the click to the table under 1 s (spec §9)', t1.example < 1000, t1);
  check('no worker, web-ifc or three.js for an NC1 set', !requests.some(u => /worker\.js|web-ifc|three/.test(u)), requests.filter(u => /steel|vendor/.test(u)));
  check('the page itself loaded no engine', !before.some(u => /web-ifc|three|worker/.test(u)), before.filter(u => /vendor/.test(u)));

  // 2. The summary and the table: the pinned figures of the example.
  let s = await summary();
  check('summary: 6 files read, 16 pieces in 6 marks, 1,069.0 kg, 29.89 m²', s.Files === '6 read, 0 skipped' && s.Pieces === '16 pieces in 6 marks' && s['Total weight'] === '1,069.0 kg' && s['Total surface'] === '29.89 m²', s);
  check('summary: longest PU1 · 13,500 mm, heaviest R1 · 212.1 kg, bath ⚠ 2 / ✗ 0, no check ⚠', s['Longest piece'] === 'PU1 · 13,500 mm' && s['Heaviest piece'] === 'R1 · 212.1 kg' && s.Bath === '12.6 × 1.3 × 1.8 m · ⚠ 2 double dip · ✗ 0 don\'t fit' && s['⚠ Geometry check'] === '0', s);
  const g = await groups();
  check('the groups by profile and grade, heaviest first', JSON.stringify(g) === JSON.stringify([
    'IPE300 | S355 | 10.05 m | 2 | 424.1 | 11.66 |  | ✓', 'HEA200 | S355 | 8.00 m | 2 | 338.4 | 9.09 |  | ✓', 'RHS100*50*4 | S275 | 27.00 m | 2 | 237.1 | 7.83 |  | ⚠ 2',
    'PL 15 | S275 | 1.60 m | 4 | 36.4 | 0.71 |  | ✓', 'PL 20 | S275 | 0.60 m | 2 | 27.2 | 0.41 |  | ✓', 'L80*8 | S275 | 0.60 m | 4 | 5.8 | 0.19 |  | ✓']), g);
  await page.click('[data-toggle="RHS100X50X4|S275"]');
  const pu = await page.$$eval('tr.st-piece', trs => trs.map(tr => [...tr.cells].map(c => c.innerText.trim()).join(' | ')));
  check('a group opens to its pieces: mark, drawing, length, quantity, kg, m², check, bath', JSON.stringify(pu) === JSON.stringify(['PU1 | D-103 | 13,500 mm | 2 | 237.1 | 7.83 | ✓ | ⚠']), pu);
  check('the bath mark explains itself on hover', (await page.$eval('tr.st-piece td:last-child', td => td.title)) === 'double dip');
  await page.selectOption('#stSort', 'mark');
  check('sorted by mark: the groups by profile name', (await groups()).map(x => x.split(' | ')[0]).join(',') === 'HEA200,IPE300,L80*8,PL 15,PL 20,RHS100*50*4', await groups());
  await page.selectOption('#stSort', 'length');
  check('sorted by length: the longest group first', (await groups())[0].startsWith('RHS100*50*4'), await groups());
  await page.selectOption('#stSort', 'kg');

  // 3. The rates change the cost block; an empty rate leaves its line off; the minimum charge; VAT; per grade.
  check('no rate: the cost block asks for one', (await costRows())[0] === 'Fill in a rate in the settings to price this take-off.', await costRows());
  const typeIn = async (sel, v) => { await page.fill(sel, v); await page.press(sel, 'Tab'); };
  await typeIn('#stRate_galv', '0.45');
  await typeIn('#stRate_zinc', '0.05');
  await typeIn('#stRate_paint', '12');
  let c = await costRows();
  check('galvanizing, zinc and painting lines, each its quantity × rate', JSON.stringify(c) === JSON.stringify([
    'Galvanizing | 1,069.0 kg | 0.450 €/kg | 481.05 €', 'Zinc surcharge | 1,069.0 kg | 0.050 €/kg | 53.45 €', 'Painting | 29.89 m² | 12.000 €/m² | 358.68 €',
    'Subtotal | 893.18 €', 'VAT 24% | 214.36 €', 'Total | 1,107.54 €']), c);
  await typeIn('#stRate_minimum', '1000');
  c = await costRows();
  check('a minimum charge above the subtotal applies, with VAT on it', c.includes('Minimum charge of 1,000.00 € applies | 1,000.00 €') && c.includes('VAT 24% | 240.00 €') && c.includes('Total | 1,240.00 €'), c);
  await page.click('#stVat');
  c = await costRows();
  check('VAT off', c.includes('No VAT | 0.00 €') && c.includes('Total | 1,000.00 €'), c);
  await typeIn('#stRate_paint', '');
  await typeIn('#stRate_minimum', '');
  await page.click('#stPerGrade');
  await typeIn('#stGrade_S275', '1,1');
  await typeIn('#stGrade_S355', '1.2');
  c = await costRows();
  check('the steel material per grade: one line each', c.includes('Steel material S275 | 306.5 kg | 1.100 €/kg | 337.15 €') && c.includes('Steel material S355 | 762.5 kg | 1.200 €/kg | 915.00 €') && !c.some(x => x.startsWith('Painting')), c);
  await typeIn('#stRate_galv', 'abc');
  check('a rate that is not a number is marked, and the last good one kept', (await page.getAttribute('#stRate_galv', 'aria-invalid')) === 'true' && (await costRows())[0].startsWith('Galvanizing | 1,069.0 kg | 0.450'), await costRows());
  await typeIn('#stRate_galv', '0.45');
  await typeIn('#stBath_length', '13.6');
  s = await summary();
  check('a longer bath: the purlins now fit', s.Bath === '13.6 × 1.3 × 1.8 m · ⚠ 0 double dip · ✗ 0 don\'t fit', s.Bath);
  await page.reload();
  await page.evaluate(() => { window.__ga = []; window.gtag = (...a) => window.__ga.push(a); window.print = () => {}; });
  check('the settings are remembered in this browser', (await page.inputValue('#stBath_length')) === '13.6' && (await page.inputValue('#stGrade_S355')) === '1.2' && (await page.isChecked('#stPerGrade')) && !(await page.isChecked('#stVat')),
    [await page.inputValue('#stBath_length'), await page.inputValue('#stGrade_S355')]);
  await page.evaluate(() => localStorage.removeItem('aidedcam-steel-settings'));
  await page.reload();
  await page.evaluate(() => { window.__ga = []; window.gtag = (...a) => window.__ga.push(a); window.print = () => { window.__printed = 1; }; });
  await page.click('#stExample');
  await shown();
  await typeIn('#stRate_galv', '0.45');

  // 4. The Excel file downloads and reads back: four sheets in the visitor's language.
  const x = await download('#stXlsx');
  const parts = unzip(x.bytes);
  const sheetNames = [...(parts['xl/workbook.xml'] || '').matchAll(/<sheet name="([^"]*)"/g)].map(m => m[1]);
  check('the Excel file: steel-takeoff-portal.xlsx, sheets Pieces, Profiles, Costs, Settings', x.name === 'steel-takeoff-portal.xlsx' && JSON.stringify(sheetNames) === JSON.stringify(['Pieces', 'Profiles', 'Costs', 'Settings']), { name: x.name, sheetNames });
  check('the pieces sheet lists every mark; the costs sheet the galvanizing line', ['C1', 'R1', 'PU1', 'CL1', 'BP1', 'HP1'].every(m => parts['xl/worksheets/sheet1.xml'].includes(`>${m}<`)) && parts['xl/worksheets/sheet3.xml'].includes('<v>481.05</v>'), null);

  // 5. Print: the A4 sheet without the 3D view and the controls.
  await page.click('[data-toggle="IPE300|S355"]');
  await page.click('tr.st-piece');
  await view();
  await page.click('#stPrint');
  await page.emulateMedia({ media: 'print' });
  const pr = await page.evaluate(() => Object.fromEntries(['#stView', '#stSettings', '.st-outputs', 'tr.st-piece', '#stTable', '#stCosts', '#stSummary', '.gv-print-head', '.st-print-note', '.gv-bar'].map(q => [q, getComputedStyle(document.querySelector(q)).display])));
  await page.emulateMedia({ media: 'screen' });
  check('print hides the 3D view, the settings, the buttons and the piece rows; keeps a title, the summary, the groups, the costs and the note',
    pr['#stView'] === 'none' && pr['#stSettings'] === 'none' && pr['.st-outputs'] === 'none' && pr['tr.st-piece'] === 'none' && pr['.gv-bar'] === 'none' &&
    pr['#stTable'] !== 'none' && pr['#stCosts'] !== 'none' && pr['#stSummary'] !== 'none' && pr['.gv-print-head'] !== 'none' && pr['.st-print-note'] !== 'none', pr);
  check('Print / PDF calls the browser\'s print', (await page.evaluate(() => window.__printed)) === 1);

  // 6. A piece in 3D: three.js only now; the time from the click to the first frame.
  const three = requests.filter(u => /three\.module\.js/.test(u));
  const t3 = (await timings()).view3d;
  check('a piece click shows it in 3D under 300 ms, three.js loaded only then (spec §9)', t3 < 300 && three.length === 1 && three[0] === BASE + 'js/vendor/three/three.module.js' && requests.some(u => u.endsWith('js/steel/view3d.js?v=20261104')), { t3, three });
  const ink = await page.evaluate(() => [window.__steel.view3d.shown, window.__steel.view3d.meshes, window.__steel.view3d.ink()]);
  check('the IPE300 rafter drawn: web and two flanges', ink[0] === 'piece' && ink[1] === 3 && ink[2] > 2000, ink);
  check('the heading names the piece', (await page.innerText('#st3dHead')) === 'R1 · IPE300');
  for (const p of ['top', 'front', 'side', 'iso']) await page.click(`[data-preset="${p}"]`);
  await page.click('#st3dFit');
  check('whole model is for an IFC only', await page.isHidden('#st3dModel'));
  await page.click('[data-toggle="PL 15|S275"]');
  await page.click('tr.st-piece >> text=HP1');
  await page.waitForFunction(() => document.querySelector('#st3dHead').innerText.startsWith('HP1'));
  check('a plate in 3D: one slab with its six holes', (await page.evaluate(() => [window.__steel.view3d.shown, window.__steel.view3d.meshes]))[1] === 1);
  const ga1 = await page.evaluate(() => window.__ga.map(a => `${a[1]} ${JSON.stringify(a[2])}`));
  check('GA: example, xlsx, view3d once, print; no names or figures', JSON.stringify(ga1) === JSON.stringify(['steel_example {}', 'steel_xlsx {}', 'steel_view3d {"result":"shown"}', 'steel_print {}']), ga1);
  if (env.SHOT) await page.screenshot({ path: `${env.SHOT}/steel-1280.png`, fullPage: true });

  // 7. The IFC of the same frame: the same totals within 2 %, its members and assemblies, its 3D.
  await page.click('#stExampleIfc');
  await page.waitForFunction(() => /portal\.ifc/.test(document.querySelector('#stSummary').innerText), null, { timeout: 30000 });
  const tIfc = (await timings()).example;
  await checked();
  s = await summary();
  check('the IFC example: 16 members, 4 assemblies, 16 pieces, 1,069.2 kg (NC1: 1,069.0), 29.88 m²', s.IFC === 'portal.ifc · IFC4' && s.Members === '16 members, 4 assemblies' && s.Pieces === '16 pieces in 6 marks' && s['Total weight'] === '1,069.2 kg' && s['Total surface'] === '29.88 m²', s);
  check('the IFC example loads under 3 s (web-ifc included) and its check pass ends with no ⚠', tIfc < 3000 && s['⚠ Geometry check'] === '0', { tIfc, check: (await timings()).check });
  await page.click('[data-toggle="HEA200|S355"]');
  await page.click('tr.st-piece');
  await view();
  let v = await page.evaluate(() => [window.__steel.view3d.shown, window.__steel.view3d.ink(), document.querySelector('#st3dModel').hidden]);
  check('an IFC piece in 3D from its mesh; the whole-model button offered', v[0] === 'member' && v[1] > 2000 && v[2] === false, v);
  await page.click('#st3dModel');
  await page.waitForFunction(() => window.__steel.view3d.shown === 'model');
  v = await page.evaluate(() => [window.__steel.view3d.meshes, document.querySelector('#st3dModel').getAttribute('aria-pressed')]);
  check('whole model: every member by grade, the piece highlighted', v[0] === 3 && v[1] === 'true', v);

  // 8. The errors of spec §7, each one line in the visitor's language.
  const c1 = await page.evaluate(async () => (await fetch('js/steel/examples/portal/C1.nc1')).text());
  await files('#stFiles', [['C1.nc1', c1], ['notes.txt', 'hello'], ['bad.nc1', c1.replace('4000.00', '40x0.00')], ['dxf.nc', '0\nSECTION\n'], ['locked.zip', zipOf([['a.nc1', c1]], 1)],
    ['z.zip', zipOf([['P1.nc1', c1.replace('C1', 'P1')], ['readme.pdf', 'x']])], ['so.nc1', c1.replace('  HEA200', '  ZS175').replace('\r\n  I\r\n', '\r\n  SO\r\n').replace('42.300', ' 0.000')]]);
  await shown();
  s = await summary();
  const skipped = await page.$$eval('#stSkippedList li', li => li.map(l => l.textContent));
  check('files read and skipped, each skipped file named with its reason', s.Files === '3 read, 5 skipped' && JSON.stringify(skipped) === JSON.stringify([
    'notes.txt: not an NC1 file', 'locked.zip: the ZIP is encrypted', 'readme.pdf: not an NC1 file', 'bad.nc1: broken NC1, line 11', 'dxf.nc: not an NC1 file']), { files: s.Files, skipped });
  check('a special profile without kg/m: left out of the totals, counted', s['⚠ Left out of the totals'] === '1' && s.Pieces === '6 pieces in 3 marks', s);
  await files('#stFiles', [['notes.txt', 'hello']]);
  await page.waitForFunction(() => !document.querySelector('#stError').hidden);
  check('nothing readable: one line', (await page.innerText('#stError')) === 'notes.txt: No NC1 piece was found.', await page.innerText('#stError'));
  const WALL = "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION((''),'2;1');\nFILE_NAME('w.ifc','2026-01-01T00:00:00',(''),(''),'','','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n#1=IFCPROJECT('0000000000000000000001',$,'P',$,$,$,$,(#5),#2);\n#2=IFCUNITASSIGNMENT((#3));\n#3=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);\n#4=IFCAXIS2PLACEMENT3D(#6,$,$);\n#5=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#4,$);\n#6=IFCCARTESIANPOINT((0.,0.,0.));\n#7=IFCLOCALPLACEMENT($,#4);\n#8=IFCAXIS2PLACEMENT2D(#9,$);\n#9=IFCCARTESIANPOINT((2000.,100.));\n#10=IFCRECTANGLEPROFILEDEF(.AREA.,$,#8,4000.,200.);\n#11=IFCDIRECTION((0.,0.,1.));\n#12=IFCEXTRUDEDAREASOLID(#10,#4,#11,3000.);\n#13=IFCSHAPEREPRESENTATION(#5,'Body','SweptSolid',(#12));\n#14=IFCPRODUCTDEFINITIONSHAPE($,$,(#13));\n#15=IFCWALL('0000000000000000000002',$,'W',$,$,#7,#14,$,$);\nENDSEC;\nEND-ISO-10303-21;\n";
  await files('#stFiles', [['walls.ifc', WALL], ['C1.nc1', c1]]);
  await page.waitForFunction(() => !document.querySelector('#stError').hidden);
  check('an IFC without IfcBeam, IfcColumn, IfcMember or IfcPlate', (await page.innerText('#stError')) === 'walls.ifc: No steel members found (IfcBeam, IfcColumn, IfcMember, IfcPlate).', await page.innerText('#stError'));
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(150 * 1024 * 1024 + 1)], 'huge.ifc'));
    const input = document.querySelector('#stFiles'); input.files = dt.files; input.dispatchEvent(new Event('change'));
  });
  await page.waitForFunction(() => /huge\.ifc/.test(document.querySelector('#stError').innerText));
  check('an IFC over 150 MB is refused before reading', (await page.innerText('#stError')) === 'huge.ifc: The IFC is over 150 MB and was not read.', await page.innerText('#stError'));
  // 500 NC1 files (spec §9: under 2 s), and over 2,000 (the first 2,000 read, with a note).
  const many = n => page.evaluate(async ([text, n]) => {
    const dt = new DataTransfer();
    for (let i = 0; i < n; i++) dt.items.add(new File([text.replace('  C1\r\n', `  C${i}\r\n`)], `C${i}.nc1`));
    delete window.__steel.timings.file;
    const input = document.querySelector('#stFiles'); input.files = dt.files; input.dispatchEvent(new Event('change'));
  }, [c1, n]);
  await many(500);
  await page.waitForFunction(() => window.__steel.timings.file >= 0, null, { timeout: 30000 });
  const t500 = (await timings()).file;
  check('500 NC1 files under 2 s', t500 < 2000 && (await summary()).Pieces === '1000 pieces in 500 marks', { t500, p: (await summary()).Pieces });
  await many(2001);
  await page.waitForFunction(() => !document.querySelector('#stCapped').hidden, null, { timeout: 60000 });
  check('over 2,000 NC1 files: the first 2,000, with a note', (await page.innerText('#stCapped')) === 'The first 2,000 NC1 files were read.' && (await summary()).Files === '2000 read, 0 skipped', [await page.innerText('#stCapped'), (await summary()).Files]);
  const ga2 = await page.evaluate(() => window.__ga.filter(a => a[1] === 'steel_loaded' || a[1] === 'steel_error').map(a => `${a[1]} ${JSON.stringify(a[2])}`));
  check('GA: loaded with the kind and a bucket, errors with a reason', JSON.stringify(ga2) === JSON.stringify(['steel_loaded {"kind":"zip","pieces":"1-10"}', 'steel_error {"reason":"nonc1"}', 'steel_error {"reason":"nosteel"}', 'steel_error {"reason":"limit"}', 'steel_loaded {"kind":"nc1","pieces":"101-1000"}', 'steel_loaded {"kind":"nc1","pieces":"over-1000"}']), ga2);

  // 9. No WebGL2: the 3D view says so; the rest works.
  const ctx2 = await page.context().browser().newContext();
  const p2 = await ctx2.newPage();
  watch(p2);
  await p2.addInitScript(() => { const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, ...a) { return /webgl/.test(k) ? null : get.call(this, k, ...a); }; });
  await p2.goto(BASE + 'steel-takeoff.html?lang=en');
  await p2.evaluate(() => localStorage.setItem('privacy-pref', 'declined'));
  await p2.click('#stExample');
  await p2.waitForFunction(() => !document.querySelector('#stPanel').hidden);
  await p2.click('.st-expand');
  await p2.click('tr.st-piece');
  await p2.waitForFunction(() => !document.querySelector('#st3dNote').hidden && !/Preparing/.test(document.querySelector('#st3dNote').innerText));
  check('no WebGL2: "3D is not available in this browser.", the table still there', (await p2.innerText('#st3dNote')) === '3D is not available in this browser.' && (await p2.$$('tr.st-group')).length === 6, await p2.innerText('#st3dNote'));
  await ctx2.close();

  // 10. Greek: the figures in Greek format; 375 px: no sideways scroll, the table scrolls in its box.
  await page.click('.lang-btn[data-lang="el"]');
  await page.evaluate(() => { delete window.__steel.timings.example; });
  await page.click('#stExample');
  await page.waitForFunction(() => window.__steel.timings.example >= 0);
  s = await summary();
  check('Greek: the summary re-rendered, 1.069,0 kg', s['Συνολικό βάρος'] === '1.069,0 kg' && s['Συνολική επιφάνεια'] === '29,89 m²', s);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.click('.st-expand');
  await page.click('tr.st-piece');
  await view();
  const phone = await page.evaluate(() => {
    const wrap = document.querySelector('#stTable').closest('.gv-table-wrap');
    return { scroll: [document.documentElement.scrollWidth, document.documentElement.clientWidth], table: [wrap.scrollWidth > wrap.clientWidth, getComputedStyle(wrap).overflowX], canvas: Math.round(window.__steel.view3d.canvas.getBoundingClientRect().width), box: Math.round(document.querySelector('#st3dBox').getBoundingClientRect().width) };
  });
  check('at 375 px: no sideways page scroll; the table scrolls inside its own box; the 3D view fits', phone.scroll[0] === phone.scroll[1] && phone.table[0] && phone.table[1] === 'auto' && phone.canvas === phone.box && phone.canvas <= 375 - 32, phone);
  if (env.SHOT) await page.screenshot({ path: `${env.SHOT}/steel-375.png`, fullPage: true });

  // 11. The tools index lists the tool in its group, without a sideways scroll.
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(BASE + 'free-tools.html?lang=en');
    const card = await page.evaluate(() => { const a = document.querySelector('.ft-card[href="steel-takeoff.html"]'); return a && a.closest('.ft-group').querySelector('.ft-group-title').innerText; });
    const scroll = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    check(`index at ${width} px: the card in Steel and building products, no sideways scroll`, /steel and building products/i.test(card || '') && scroll[0] === scroll[1], { card, scroll });
  }

  // 12. A large IFC outside the repo (BIG=<path>): the time to the table, and to the end of the check.
  if (env.BIG) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await fresh();
    const big = require('node:fs').readFileSync(env.BIG);
    const t0 = Date.now();
    await page.setInputFiles('#stFiles', { name: require('node:path').basename(env.BIG), mimeType: 'application/octet-stream', buffer: big });
    await shown();
    const table = Date.now() - t0;
    await checked();
    const all = Date.now() - t0;
    s = await summary();
    check(`BIG: ${(big.length / 1048576).toFixed(1)} MB to the table in ${table} ms (under 3 s), the check done at ${all} ms; ${s.Members}, ${s['Total weight']}, ⚠ ${s['⚠ Geometry check']}`, table < 3000, { table, all, s });
  }

  // 13. Nothing external, no console errors.
  check('no external requests', external.length === 0, external);
  check('no console errors', errors.length === 0, errors);
  check(`timings ${JSON.stringify({ example: t1.example, ifc: tIfc, view3d: t3, files500: t500 })}`, true, null);
  return { pass: checks.filter(c => c.ok).length, fail: checks.filter(c => !c.ok).length, checks };
}
```

<!-- file: _tests/steel/browser-check.cjs -->
```js
// Runs the steel take-off's browser checks in headless Chrome, for when the Playwright MCP is unavailable.
// Needs the repo root served on http://127.0.0.1:8821/ and playwright-core somewhere on this machine:
//   node _tests/steel/browser-check.cjs
// Set PW_CORE to a playwright-core folder, or it is looked for in the npx cache. Chrome is used from its default
// install path (or CHROME). SHOT=<folder> also saves screenshots at 1280 and 375 px (keep that folder outside the
// repo). BIG=<an .ifc outside the repo> adds the large-file timing. GL=swiftshader draws WebGL in software.
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
  const args = process.env.GL === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [];
  const browser = await chromium.launch({ executablePath: chrome, headless: true, args });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const r = await eval(fs.readFileSync(path.join(__dirname, 'browser-check.js'), 'utf8'))(page);
  for (const c of r.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : '  ' + JSON.stringify(c.got)}`);
  console.log(`${r.pass} passed, ${r.fail} failed`);
  await browser.close();
  process.exit(r.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
```

<!-- file: _tests/sidebar/browser-check.js -->
```js
// Dev-only browser check of the free-tools sidebar on every page (Jekyll skips _tests). It is one Playwright
// function: run it with the Playwright MCP (browser_run_code_unsafe, filename: _tests/sidebar/browser-check.js) or
// with node _tests/sidebar/browser-check.cjs. It expects the repo root served on http://127.0.0.1:8811/ and returns
// { pass, fail, checks: [{ name, ok, got }] }. With SHOT=<folder> (node runner) it saves full-page screenshots of
// every page at 1280 and 375 px, a 1440 px view with a card open and a 375 px view with the panel open.
async (page) => {
  const BASE = 'http://127.0.0.1:8811/';
  const SHOT = typeof process !== 'undefined' && process.env && process.env.SHOT;
  const PAGES = ['index', 'what-you-gain', 'calculator', 'free-tools', 'gcode-viewer', 'milling-gcode-viewer', 'laser-dxf-checker',
    'dwg-quantities', 'coverage-precheck', 'ifc-plans', 'steel-takeoff', 'legal', 'privacy'];
  const TOOL_PAGE = { 'gcode-viewer': 'lathe', 'milling-gcode-viewer': 'mill', 'laser-dxf-checker': 'laser', 'dwg-quantities': 'dwgq', 'coverage-precheck': 'coverage', 'ifc-plans': 'ifcplans', 'steel-takeoff': 'steel', 'free-tools': 'all' };
  const checks = [];
  const check = (name, ok, got) => checks.push({ name, ok: !!ok, got });
  const errors = [], external = [];
  const watch = p => {
    p.on('console', m => { if (m.type() === 'error') errors.push(`${p.url()}: ${m.text()}`); });
    p.on('pageerror', e => errors.push(`${p.url()}: ${e}`));
    p.on('request', r => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
  };
  watch(page);

  // Open a page with the consent already answered (declined: no GA), or with the banner showing.
  const open = async (p, name, { lang = 'el', banner = false } = {}) => {
    await p.goto(BASE + 'privacy.html');
    await p.evaluate(b => { localStorage.clear(); if (!b) localStorage.setItem('privacy-pref', 'declined'); }, banner);
    await p.goto(`${BASE}${name}.html?lang=${lang}`);
    await p.waitForSelector('nav.afs', { state: 'attached' });
    await p.evaluate(() => document.fonts.ready);
  };
  // Scroll the whole page once so scroll reveals have run, then back to the top.
  const reveal = p => p.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 400) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); }
    scrollTo(0, 0); await new Promise(r => setTimeout(r, 700));
  });
  const state = p => p.evaluate(() => {
    const nav = document.querySelector('nav.afs'), list = nav.querySelector('.afs-list'), fab = nav.querySelector('.afs-fab');
    const shown = el => { const r = el.getBoundingClientRect(); return getComputedStyle(el).display !== 'none' && r.width > 0 && r.height > 0; };
    const r = list.getBoundingClientRect();
    nav.style.display = 'none'; const own = document.documentElement.scrollWidth; nav.style.display = '';   // the page alone
    return {
      layout: nav.dataset.layout, label: nav.getAttribute('aria-label'),
      items: [...nav.querySelectorAll('.afs-item')].filter(shown).length, all: shown(nav.querySelector('.afs-all')),
      listShown: shown(list), fabShown: shown(fab), expanded: fab.getAttribute('aria-expanded'), controls: fab.getAttribute('aria-controls'),
      strip: { left: r.left, right: r.right, top: r.top, bottom: r.bottom },
      current: [...nav.querySelectorAll('[aria-current="page"]')].map(a => a.dataset.tool),
      scroll: [document.documentElement.scrollWidth, document.documentElement.clientWidth, own],
    };
  });
  // The leftmost visible content of the page (text, controls, media), clipped by its scroll boxes; the
  // sidebar, the consent banner and the skip link are left out. Opacity is ignored on purpose: content that
  // fades in later or a Μέθοδος view that is not showing yet still counts.
  // The sidebar adds no horizontal scroll: the page is no wider than the screen, or than the page alone.
  const noScroll = s => s.scroll[0] === Math.max(s.scroll[1], s.scroll[2]);
  const leftmost = p => p.evaluate(() => {
    const out = [];
    const vis = e => e.checkVisibility({ visibilityProperty: true });
    const clip = (el, rc) => {
      let l = rc.left, r = rc.right, t = rc.top, b = rc.bottom;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.overflowX !== 'visible' || s.clipPath !== 'none') { const q = a.getBoundingClientRect(); l = Math.max(l, q.left); r = Math.min(r, q.right); }
        if (s.overflowY !== 'visible' || s.clipPath !== 'none') { const q = a.getBoundingClientRect(); t = Math.max(t, q.top); b = Math.min(b, q.bottom); }
        if (s.position === 'fixed') break;
      }
      return r - l >= 1 && b - t >= 1 ? l : null;
    };
    const skip = el => el.closest('nav.afs, .consent-banner, .skip-to-content, script, style, noscript');
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = tw.nextNode())) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement; if (!el || skip(el) || !vis(el)) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const rc of rg.getClientRects()) { const l = clip(el, rc); if (l !== null) out.push([Math.round(l), `${el.tagName.toLowerCase()}.${el.className}: ${n.textContent.trim().slice(0, 30)}`]); }
    }
    for (const el of document.querySelectorAll('img, canvas, svg, input, select, textarea, button, video, iframe, table')) {
      if (skip(el) || !vis(el)) continue;
      const l = clip(el, el.getBoundingClientRect()); if (l !== null) out.push([Math.round(l), `${el.tagName.toLowerCase()}#${el.id}.${el.className.baseVal ?? el.className}`]);
    }
    out.sort((a, b) => a[0] - b[0]);
    return out.slice(0, 3);
  });

  // 1. Desktop widths: the strip only where the page has a gutter for it, and then over no content.
  const layouts = {};
  for (const width of [1200, 1280, 1366, 1440, 1536]) {
    await page.setViewportSize({ width, height: 900 });
    const bad = [], seen = {};
    for (const name of PAGES) {
      await open(page, name);
      await reveal(page);
      const s = await state(page), first = await leftmost(page);
      seen[name] = s.layout;
      if (s.layout === 'strip') {
        if (!(s.items === 7 && s.all && !s.fabShown)) bad.push({ name, s });
        if (first.length && first[0][0] < s.strip.right) bad.push({ name, stripRight: s.strip.right, first });
        if (s.strip.top < 80 || s.strip.bottom > 900 - 80) bad.push({ name, strip: s.strip });
      } else if (!(s.fabShown && !s.listShown)) bad.push({ name, s });
      if (!noScroll(s)) bad.push({ name, scroll: s.scroll });
    }
    layouts[width] = seen;
    check(`at ${width} px: the strip covers no content on any page (else the button)`, bad.length === 0, bad);
  }
  const strips = w => PAGES.filter(n => layouts[w][n] === 'strip');
  check('at 1440 px every page shows the strip', strips(1440).length === PAGES.length, layouts[1440]);
  // The label beside the tiles moves the strip right: the 5vw pages get it from 1280 px, the tool pages (3vw gutter) from 1366.
  check('at 1280 px the pages with the 5vw container show the strip; at 1200 and 1280 px the tool pages show the button; at 1366 px every page the strip',
    ['index', 'what-you-gain', 'calculator', 'legal', 'privacy'].every(n => layouts[1280][n] === 'strip') &&
    Object.keys(TOOL_PAGE).every(n => layouts[1200][n] === 'panel' && layouts[1280][n] === 'panel') &&
    strips(1366).length === PAGES.length, { 1200: layouts[1200], 1280: layouts[1280], 1366: layouts[1366] });

  // 2. At 1440 px: seven items and the all-tools box, hover expands a card without moving the page, current page marked.
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, 'index');
  let s = await state(page);
  check('1440 index: strip with seven items and the all-tools box, nothing current', s.layout === 'strip' && s.items === 7 && s.all && s.current.length === 0, s);
  const card = id => page.evaluate(id => {
    const a = document.querySelector(`nav.afs [data-tool="${id}"]`), c = a.querySelector('.afs-card'), r = c.getBoundingClientRect(), cs = getComputedStyle(c);
    return { opacity: +cs.opacity, pe: cs.pointerEvents, width: Math.round(r.width), left: Math.round(r.left), text: c.innerText.replace(/\s+/g, ' ').trim(), name: a.innerText.replace(/\s+/g, ' ').trim() };
  }, id);
  const before = await page.evaluate(() => [document.documentElement.scrollHeight, Math.round(document.querySelector('main, section, .container').getBoundingClientRect().left)]);
  let c0 = await card('laser');
  check('at rest the card is hidden and takes no clicks, but names the link', c0.opacity === 0 && c0.pe === 'none' && /laser/i.test(c0.text), c0);
  await page.hover('nav.afs [data-tool="laser"]');
  await page.waitForTimeout(400);
  let c1 = await card('laser');
  const after = await page.evaluate(() => [document.documentElement.scrollHeight, Math.round(document.querySelector('main, section, .container').getBoundingClientRect().left)]);
  check('hover expands the item into its card: name and one line', c1.opacity === 1 && c1.width > 200 && c1.text.startsWith('Έλεγχος DXF για κοπή laser') && c1.text.length > 40, c1);
  check('the hover moves nothing on the page', JSON.stringify(before) === JSON.stringify(after), { before, after });
  if (SHOT) await page.screenshot({ path: `${SHOT}/sb-1440-index-card.png` });
  await page.mouse.move(700, 450);
  await page.keyboard.press('Shift');                                          // a keyboard user: focus is visible
  await page.evaluate(() => document.querySelector('nav.afs [data-tool="ifcplans"]').focus());
  await page.waitForTimeout(400);
  const cf = await card('ifcplans');
  const fr = await page.evaluate(() => getComputedStyle(document.querySelector('nav.afs [data-tool="ifcplans"]')).outlineStyle);
  check('keyboard focus shows the ring and the card', cf.opacity === 1 && fr === 'solid', { cf, fr });

  const unmarked = [];
  for (const [name, id] of Object.entries(TOOL_PAGE)) {
    await open(page, name);
    s = await state(page);
    if (!(s.current.length === 1 && s.current[0] === id)) unmarked.push({ name, current: s.current });
  }
  check('the current tool (or the all-tools box on free-tools.html) is aria-current="page"', unmarked.length === 0, unmarked);
  if (SHOT) {
    await open(page, 'dwg-quantities');
    await page.hover('nav.afs [data-tool="all"]');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOT}/sb-1440-dwg-all-box.png` });
  }

  // 3. Language: the cards follow <html lang>, on the index (languageChanged) and on a tool page (gv:lang).
  for (const [name, btn, want, label] of [['index', 'it', 'Controllo DXF per taglio laser', 'Strumenti'], ['ifc-plans', 'en', 'Laser DXF check', 'Tools']]) {
    await open(page, name);
    await page.click(`.lang-btn[data-lang="${btn}"] >> visible=true`);
    await page.waitForTimeout(100);
    const got = await card('laser'), lab = (await state(page)).label;
    check(`${name}: switching to ${btn.toUpperCase()} changes the cards`, got.text.startsWith(want) && lab === label, { got: got.text, lab });
  }
  await open(page, 'calculator', { lang: 'en' });
  check('a page opened with ?lang=en starts in English', (await card('dwgq')).text.startsWith('Quantities from DWG'), await card('dwgq'));

  // 4. GA: one event with the tool and the layout, only when window.gtag exists (after consent).
  await open(page, 'legal');
  const ga = await page.evaluate(() => {
    const out = { without: null, with: [] };
    document.addEventListener('click', e => e.preventDefault(), true);          // stay on the page
    try { document.querySelector('nav.afs [data-tool="coverage"]').click(); out.without = 'no error'; } catch (e) { out.without = String(e); }
    window.gtag = (...a) => out.with.push(a);
    document.querySelector('nav.afs [data-tool="coverage"]').click();
    document.querySelector('nav.afs [data-tool="all"]').click();
    delete window.gtag;
    return out;
  });
  check('GA: freetools_sidebar_click { tool, layout } through window.gtag only', ga.without === 'no error' &&
    JSON.stringify(ga.with) === JSON.stringify([['event', 'freetools_sidebar_click', { tool: 'coverage', layout: 'strip' }], ['event', 'freetools_sidebar_click', { tool: 'all', layout: 'strip' }]]), ga);

  // 5. The consent banner stays on top of the strip, and its buttons stay clickable.
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: width === 375 ? 800 : 900 });
    await open(page, 'what-you-gain', { banner: true });
    await page.evaluate(() => document.getElementById('privacyManage').click());
    const hits = await page.evaluate(() => [...document.querySelectorAll('#privacyOverlay button')].filter(b => b.offsetParent).map(b => {
      const r = b.getBoundingClientRect(), el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { id: b.id, ok: b.contains(el), on: el && el.className };
    }));
    const z = await page.evaluate(() => [getComputedStyle(document.querySelector('nav.afs .afs-list')).zIndex, getComputedStyle(document.querySelector('nav.afs .afs-fab')).zIndex]);
    check(`at ${width} px the consent banner and its buttons are above the sidebar`, hits.length >= 4 && hits.every(h => h.ok) && z.every(v => v === 'auto' || +v < 9999), { hits, z });
  }

  // 6. At 375 px: no strip, the button opens and closes the panel, no horizontal scroll.
  await page.setViewportSize({ width: 375, height: 800 });
  const phone = [], ownScroll = [], phoneEnd = [];
  for (const name of PAGES) {
    await open(page, name);
    s = await state(page);
    if (!(s.layout === 'panel' && s.fabShown && !s.listShown && s.expanded === 'false' && s.controls === 'afs-list' && noScroll(s))) phone.push({ name, s });
    if (s.scroll[2] > s.scroll[1]) ownScroll.push({ name, scroll: s.scroll });
    // Scrolled to the end, the button sits on none of the page's text or controls.
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(150);
    const covered = await page.evaluate(() => {
      const f = document.querySelector('nav.afs .afs-fab').getBoundingClientRect(), hit = [];
      const meets = r => r.width > 0 && r.height > 0 && r.left < f.right && r.right > f.left && r.top < f.bottom && r.bottom > f.top;
      const skip = el => el.closest('nav.afs, .consent-banner, .skip-to-content, script, style, noscript') || !el.checkVisibility({ visibilityProperty: true, opacityProperty: true });
      const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
      while ((n = tw.nextNode())) {
        if (!n.textContent.trim() || !n.parentElement || skip(n.parentElement)) continue;
        const rg = document.createRange(); rg.selectNodeContents(n);
        if ([...rg.getClientRects()].some(meets)) hit.push(n.textContent.trim().slice(0, 30));
      }
      for (const el of document.querySelectorAll('img, canvas, svg, input, select, textarea, button, video, iframe')) if (!skip(el) && meets(el.getBoundingClientRect())) hit.push(el.tagName);
      return hit;
    });
    if (covered.length) phoneEnd.push({ name, covered });
  }
  check('375 px, every page: the button, no strip, no horizontal scroll from the sidebar', phone.length === 0, phone);
  check('375 px, every page scrolled to the end: the button covers no text or control', phoneEnd.length === 0, phoneEnd);
  // privacy.html's own table is 21 px too wide at 375 px, sidebar or not (known, outside the sidebar); a new one fails.
  check('375 px, the only page that scrolls sideways on its own is privacy.html', JSON.stringify(ownScroll.map(o => o.name)) === JSON.stringify(['privacy']), ownScroll);
  await open(page, 'gcode-viewer');
  await page.click('nav.afs .afs-fab');
  s = await state(page);
  const inView = await page.evaluate(() => { const r = document.querySelector('nav.afs .afs-list').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; });
  check('375: a tap opens the panel with seven tools and the all-tools link, inside the screen', s.expanded === 'true' && s.listShown && s.items === 7 && s.all && inView && s.current[0] === 'lathe' && noScroll(s), { s, inView });
  if (SHOT) await page.screenshot({ path: `${SHOT}/sb-375-panel-open.png` });
  await page.keyboard.press('Escape');
  s = await state(page);
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.className);
  check('375: Esc closes it and gives the focus back to the button', s.expanded === 'false' && !s.listShown && focused === 'afs-fab', { s, focused });
  await page.click('nav.afs .afs-fab');
  await page.mouse.click(300, 95);                                             // above the panel (seven tools reach y 110)
  s = await state(page);
  check('375: a tap outside closes it', s.expanded === 'false' && !s.listShown, s);
  await page.click('nav.afs .afs-fab');
  await page.click('nav.afs .afs-fab');
  s = await state(page);
  check('375: the button closes it again', s.expanded === 'false' && !s.listShown, s);
  // Keyboard: Tab through the panel and past its end closes it, so it never covers what gets the focus next.
  await page.focus('nav.afs .afs-fab');
  await page.keyboard.press('Enter');
  const openedByKey = (await state(page)).expanded;
  for (let i = 0; i < 9; i++) await page.keyboard.press('Tab');               // seven tools and the all-tools link
  await page.waitForTimeout(100);
  s = await state(page);
  const out = await page.evaluate(() => !document.querySelector('nav.afs').contains(document.activeElement));
  check('375: Tab past the end of the panel closes it', openedByKey === 'true' && s.expanded === 'false' && !s.listShown && out, { openedByKey, s, out });
  // A strip link with the focus when the window narrows to the panel layout: the focus moves to the button.
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, 'legal');
  await page.focus('nav.afs [data-tool="mill"]');
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.waitForTimeout(200);
  const moved = await page.evaluate(() => [document.querySelector('nav.afs').dataset.layout, document.activeElement && document.activeElement.className]);
  check('strip to panel with a strip link focused: the focus moves to the button', moved[0] === 'panel' && moved[1] === 'afs-fab', moved);
  await page.setViewportSize({ width: 375, height: 800 });

  // 7. A touch screen gets the button even when it is wide; print hides it; reduced motion has no transitions.
  const touch = await page.context().browser().newContext({ hasTouch: true, viewport: { width: 1440, height: 900 } });
  const tp = await touch.newPage();
  watch(tp);
  await open(tp, 'index');
  s = await state(tp);
  check('a 1440 px touch screen gets the button', s.layout === 'panel' && s.fabShown, { s, hover: await tp.evaluate(() => matchMedia('(hover: hover)').matches) });
  await touch.close();
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, 'index');
  await page.emulateMedia({ media: 'print' });
  const print = await page.evaluate(() => getComputedStyle(document.querySelector('nav.afs')).display);
  await page.emulateMedia({ media: 'screen', reducedMotion: 'reduce' });
  const motion = await page.evaluate(() => getComputedStyle(document.querySelector('nav.afs .afs-card')).transitionDuration);
  await page.emulateMedia({ media: 'screen', reducedMotion: 'no-preference' });
  check('hidden in print, no transition under reduced motion', print === 'none' && /^0s(, 0s)*$/.test(motion), { print, motion });

  // 8. Screenshots of every page, full length, at 1280 and 375 px.
  if (SHOT) {
    for (const width of [1280, 375]) {
      await page.setViewportSize({ width, height: width === 375 ? 800 : 900 });
      for (const name of PAGES) {
        await open(page, name);
        await reveal(page);
        await page.screenshot({ path: `${SHOT}/${name}-${width}.png`, fullPage: true });
      }
    }
  }

  // 9. Nothing external, no console errors.
  check('no external requests', external.length === 0, external);
  check('no console errors', errors.length === 0, errors);
  return { pass: checks.filter(c => c.ok).length, fail: checks.filter(c => !c.ok).length, checks };
}
```

Run:
```bash
for f in _tests/steel/browser-check.js _tests/steel/browser-check.cjs _tests/sidebar/browser-check.js; do node _tests/extract.mjs $PLAN $f; done
node -e "for (const f of ['_tests/steel/browser-check.js','_tests/sidebar/browser-check.js']) new Function('return ' + require('fs').readFileSync(f,'utf8'))(); console.log('syntax-ok')"
```
Expected: three `wrote` lines and `syntax-ok`.

- [ ] **Step 2: Serve the repo and run every browser check**

Run (each server in its own background shell, from the repo root):
```bash
python -m http.server 8821 --bind 127.0.0.1 &
python -m http.server 8793 --bind 127.0.0.1 &
python -m http.server 8765 --bind 127.0.0.1 &
python -m http.server 8811 --bind 127.0.0.1 &
node _tests/steel/browser-check.cjs 2>&1 | tail -2
node _tests/ifcplan/browser-check.cjs 2>&1 | tail -1
node _tests/dwg/browser-check.cjs 2>&1 | tail -1
node _tests/coverage/browser-check.cjs 2>&1 | tail -1
node _tests/sidebar/browser-check.cjs 2>&1 | tail -1
```
Expected: `PASS  timings {"example":…,"ifc":…,"view3d":…,"files500":…}` then `50 passed, 0 failed`; `67 passed, 0 failed`; `25 passed, 0 failed`; `52 passed, 0 failed`; `32 passed, 0 failed`.

The steel check, in order:
1. the title, the eyebrow "Tool"; the example from the click to the table under 1 s; no worker, web-ifc or three.js for an NC1 set, none on the page;
2. the summary and the groups of the example (pinned); a group opened to its pieces; the bath tooltip; sorting by mark and by length;
3. the cost block: no rate, then galvanizing, zinc and painting; the minimum charge with VAT; VAT off; per grade; a rate that is not a number; a longer bath; the settings remembered across a reload;
4. the Excel file (`steel-takeoff-portal.xlsx`, four sheets) read back;
5. print: the 3D view, the settings, the buttons and the piece rows hidden; the title, summary, groups, costs and note kept; Print / PDF calls the browser's print;
6. a piece in 3D under 300 ms with three.js loaded only then; the rafter's three slabs; the heading; the presets; whole model hidden for NC1; a plate as one slab; GA in order;
7. the IFC example: its summary (1,069.2 kg) and its check pass; an IFC piece from its mesh; whole model with the piece highlighted;
8. the errors of spec §7: files skipped with their reasons (not NC1, broken at line 11, an encrypted ZIP, a non-NC1 entry); a special profile without kg/m left out; nothing readable; an IFC without steel members; an IFC over 150 MB; 500 NC1 files under 2 s; 2,001 files read as 2,000 with a note; GA `steel_loaded` and `steel_error`;
9. no WebGL2: "3D is not available in this browser.";
10. Greek figures; at 375 px no sideways scroll, the table scrolling in its box, the 3D view inside the screen;
11. the tools index at 1280 and 375 px;
12. (with `BIG`) the large IFC's times;
13. no external requests, no console errors, the timings line.

If WebGL2 was missing in Task 0, run the steel and ifcplan checks with `GL=swiftshader`.

- [ ] **Step 3: Look at it, and the large public sample (by hand, not committed)**

Run `SHOT=<a folder outside the repo> node _tests/steel/browser-check.cjs` and look at `steel-1280.png` and `steel-375.png`: the summary tiles, the settings in two framed groups, the table with one group open, the rafter in 3D, the cost block; at 375 px the table and the cost block scroll sideways inside their boxes. Spec §9's 13 MB target was measured with `BIG=<path of 20210221PRIMARK.ifc>` (public, outside the repo): 51 checks, the table in 1,665 ms, the check pass done at 4,681 ms.

- [ ] **Step 4: Commit, and stop the servers**

```bash
git add _tests/steel/browser-check.js _tests/steel/browser-check.cjs _tests/sidebar/browser-check.js
git commit -F - <<'EOF'
Steel take-off: browser check; the sidebar check with seven tools

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
for port in 8821 8793 8765 8811; do pid=$(netstat -ano | grep ":$port .*LISTENING" | awk '{print $5}' | head -1); [ -n "$pid" ] && taskkill //PID $pid //F; done
netstat -ano | grep -E ":(8821|8793|8765|8811) .*LISTENING" || echo "servers stopped"
```
Expected: the commit, and `servers stopped`.

- [ ] **Step 5: Run everything**

Run:
```bash
node --test $(git ls-files '_tests/**/*.test.js') 2>&1 | grep -E "^ℹ (pass|fail)"
node _tests/steel/make-example.mjs --check
git diff --stat 8b70147 -- js/laser js/dwg js/coverage js/gcode js/mill js/ifcplan js/vendor _src css/sidebar.css
git diff 8b70147 --numstat -- index.html what-you-gain.html calculator.html gcode-viewer.html milling-gcode-viewer.html laser-dxf-checker.html dwg-quantities.html coverage-precheck.html ifc-plans.html legal.html privacy.html
git log --format=%B HEAD~17..HEAD | grep -c "^Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb$"
```
Expected: `ℹ pass 611`, `ℹ fail 0`; `same 8 files`; no output from the first diff; `2	2	<page>` for each of the 11 pages (the sidebar's two `?v=`); `17` (one trailer per commit of Tasks 1–17).

---

### Task 18: Deploy day (stop before any push)

Not part of the replay. Aris names the day; merging and pushing `main` is his decision.

**Files:**
- Modify, on deploy day only: every `?v=20261104` (the 13 pages, `js/steel/*.js`, `_tests/steel/site.test.js`, `_tests/steel/browser-check.js`, `_tests/sidebar/sidebar.test.js`), and the sitemap `lastmod` of `steel-takeoff.html` with its pin in `_tests/steel/listing.test.js`.

- [ ] **Step 1: Pick a version not live elsewhere**

Pick `YYYYMMDD`, and grep first: `grep -rn "v=YYYYMMDD" --include=*.html --include=*.js --include=*.css . | grep -v "^./_docs/"` must print nothing.

- [ ] **Step 2: Swap the placeholder**

```bash
sed -i 's/v=20261104/v=YYYYMMDD/g' *.html js/steel/*.js _tests/steel/site.test.js _tests/steel/browser-check.js
sed -i "s/const V = '20261104';/const V = 'YYYYMMDD';/" _tests/sidebar/sidebar.test.js
sed -i '/<loc>https:\/\/www.aidedcam.com\/steel-takeoff.html<\/loc>/{n;s#<lastmod>[0-9-]*</lastmod>#<lastmod>YYYY-MM-DD</lastmod>#}' sitemap.xml
sed -i "s#<lastmod>2026-10-01</lastmod>'), 'with the lastmod placeholder'#<lastmod>YYYY-MM-DD</lastmod>'), 'with the lastmod placeholder'#" _tests/steel/listing.test.js
grep -rn "20261104" --include=*.html --include=*.js --include=*.css . | grep -v "^./_docs/"    # must print nothing
git diff --stat sitemap.xml                                                                       # sitemap.xml | 2 +-
```
`js/steel/examples/` holds no placeholder, and the glob `js/steel/*.js` leaves it alone. The shared modules' own `?v=` (`20261001`, `20260930`, `20261003`) stay. The third `sed` changes only the `<lastmod>` right under the `steel-takeoff.html` `<loc>`; the fourth, the same date pinned in `listing.test.js`. If `css/tools.css` and the sidebar files are also changed by other work before the deploy, re-check their `?v=` on every page. Run the Node tests and the five browser checks again (Task 17, Steps 2 and 5).

- [ ] **Step 3: Before and after the push**

Before: squash the branch (house pattern), and confirm that `git log -p main..HEAD | grep -i -E "<client names>"` prints nothing. After: on the live site, load the example and its IFC twin, open a piece in 3D, download the Excel file, and print to PDF (spec §13). Then the real-file check, with a shop's own Tekla NC1 folder against its Tekla list (kept outside the repo, recorded without client names).

---

## Replay

The plan was replayed task by task on a fresh worktree of 8b70147, with only this plan copied in (untracked): branch `scratch/steel-replay`, created with `git worktree add ../aidedcam-page-steel-replay -b scratch/steel-replay 8b70147`. Only the plan's own commands were run, commits included: 17 commits for Tasks 1–17 (Task 0 commits nothing).
- **Every stated result appeared:**
  - the baseline 517, an unused placeholder, `webgl2 true 154.0.8037.58` and four free ports;
  - the red and green steps of the steel suite, in order: 0/1 → 10, 10/1 → 14, 14/1 → 20, 20/1 → 28, 28/1 → 33, 33/1 → 40, 40/1 → 45, 45/1 → 48, 48/1 → 53, 53/5 → 58, 58/2 → 67, 67/1 → 72, 72/1 → 74, 74/5 → 79, 80/5 → 92 (99 with the sidebar suite), 92/2 → 94;
  - Task 10's `wrote 8 files`, `same 8 files` and `i/crlf  w/crlf` for the NC1 files;
  - Task 15's `13` pages on the placeholder, nothing left on `20261002`, and the tracked suites at 596; Task 16's at 609;
  - `syntax-ok`;
  - the browser checks: steel `50 passed, 0 failed` (example 24 ms, IFC 240 ms, 3D 117 ms, 500 files 42 ms), ifcplan 67, dwg 25, coverage 52, sidebar 32;
  - `BIG=20210221PRIMARK.ifc`: 51 passed, the table in 1,686 ms, the check pass done at 4,872 ms;
  - `servers stopped`;
  - 611 in all, `same 8 files`, an empty diff for the other tools, `2	2` for each of the 11 pages, and `17` trailers.
- **The replay matches the validated branch:** `git diff --stat scratch/steel-validate scratch/steel-replay -- . ':(exclude)_docs'` is empty, so every file is byte-identical to the validated one. (The validated branch is one scratch commit, 2c39245; its content is in the blocks above.)
- Both scratch worktrees are left in place: `../aidedcam-page-steel-validate` (`scratch/steel-validate`) and `../aidedcam-page-steel-replay` (`scratch/steel-replay`).
