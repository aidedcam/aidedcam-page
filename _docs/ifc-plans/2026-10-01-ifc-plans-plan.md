# DXF Floor Plans from IFC: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a free IFC → DXF floor-plans tool to www.aidedcam.com, `ifc-plans.html`. It reads an IFC model in the browser and gives one R12 DXF floor plan per storey, cut at a chosen height above each storey's level: every IFC element type on its own layer, the room outlines, and room labels with name and area. One download per storey and one ZIP, in m, cm or mm, optionally moved to the origin; every plan keeps the IFC's coordinates, so the storeys overlay as XREFs. GR (default)/EN/IT.

**Architecture:**
- **Page.** `ifc-plans.html`, plain HTML and ES modules in `js/ifcplan/`, on the shared shell `js/gcode/shell/` (i18n, banner, settings storage, consent and GA, copied from `dwg-quantities.html`). It reuses, unchanged, `js/laser/bridge.js` (queue, one file at a time, 120 s timeout, worker restart; its `makeWorker` option points at this tool's worker) and `js/laser/zip.js`.
- **Worker.** `js/ifcplan/worker.js`, a module Web Worker that holds **web-ifc 0.0.78** (vendored in `js/ifcplan/vendor/web-ifc/`, single-threaded, so no cross-origin isolation). It opens the model, reads units and storeys (world Z of the placement chain), streams every mesh (and the rooms), cuts them against every storey's plane in one pass, chains each element's segments, and answers the plans in metres. The model stays open for a re-cut at a new height.
- **Pure modules** (no DOM, Node-tested): `cut.js`, `chain.js`, `layers.js`, `rooms.js`, `dxf.js` (R12 writer + Windows-1253), `names.js`, `model.js` (the worker's reading logic, so the Node end-to-end test runs it through the same web-ifc build), `state.js` (settings, the typed cut height, GA buckets, warnings). `drawing.js` is the canvas preview, `ui.js` the controller, `i18n-ifcplan.js` the strings.
- **The example** `js/ifcplan/examples/example-house.ifc` is written by our own generator (`_tests/ifcplan/make-example.mjs`, deterministic, with `--check`), never typed.

**Tech Stack:** plain ES modules; web-ifc 0.0.78 (MPL-2.0) from npm, vendored unchanged; `node --test` (Node 24); the browser check drives headless Chrome through `playwright-core`; the static GitHub Pages site.

**Spec:** `_docs/ifc-plans/2026-10-01-ifc-plans-design.md` (eabd4be). Where this plan departs from it, the departure is listed under "Spec refinements" below, with the reason.

**Validated before writing.** Every block below was built and run in the scratch worktree `scratch/ifcp-validate` (from `feat/ifc-plans` at eabd4be), every block was checked against the validated file with `node _tests/extract.mjs <plan> <path> --check`, and then the whole plan was replayed on a fresh worktree (see "Replay" at the end).
- **Node:** `node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js" "_tests/laser/*.test.js" "_tests/dwg/*.test.js" "_tests/coverage/*.test.js" "_tests/ifcplan/*.test.js"` passes 412 + 63 = 475; the five existing suites still pass 412.
- **The example:** `node _tests/ifcplan/make-example.mjs --check` prints `same js/ifcplan/examples/example-house.ifc` (16,459 bytes).
- **Browser (Chrome 154, headless, local server):** `_tests/ifcplan/browser-check.js` passes 40/40: the example from click to preview in about 0.25 s, a re-cut in 5–15 ms; every DXF re-parses; no request leaves the local server; no console errors.
- **The six spike samples** (by hand, not committed): every file reads, every storey's DXF passes ezdxf 1.4.4's strict read and audit with 0 errors and 0 fixes (29 DXFs), and every time is within spec §9 (table in Task 14).
- **The other tools are untouched:** `git diff --stat eabd4be -- js/laser js/dwg js/coverage js/gcode js/mill _src laser-dxf-checker.html dwg-quantities.html coverage-precheck.html` is empty.

## Global Constraints

- **Public repo** (github.com/aidedcam/aidedcam-page). No client names, no customer files, no local paths and no licence keys in any committed file, test, doc or commit message. IFC files other than the generated example go only in the git-ignored `_tests/private/`; the six public spike samples are never committed.
- **No Eyeshot, no devDept code or notice** on this page or in `js/ifcplan/`. The IFC reader is **web-ifc 0.0.78** (MPL-2.0), pinned, vendored unchanged as `js/ifcplan/vendor/web-ifc/web-ifc-api.js` + `web-ifc.wasm` + `LICENSE` + `SOURCE.md`; its SHA-256s are tested.
- **Footer notice**, as spec §6.10: "IFC reading: web-ifc (ThatOpen Company), MPL-2.0, source on GitHub", the link to `https://github.com/ThatOpen/engine_web-ifc`.
- **Other tools must not change.** `js/laser/`, `js/dwg/`, `js/coverage/`, `js/gcode/`, `js/mill/`, `_src/` and their pages are read, never edited; `js/laser/bridge.js` and `js/laser/zip.js` are imported unchanged. The existing suites pass 412 before and after.
- **Spec values:**
  - limits: refused over **150 MB** before reading; a "large file" note over **50 MB**; worker timeout **120 s**;
  - cut height: one field, default **1.10 m** above each storey's level (this plan accepts 0–10 m);
  - units: **m (default), cm, mm**, `$INSUNITS` **6/5/4**, coordinates × 1/100/1000; room areas always in **m²**, at 2 decimals, e.g. `24.50 m²`;
  - room text height **0.20 m** of the model (200 in mm, 20 in cm), Greek in code page **1253** (`$DWGCODEPAGE ANSI_1253`), a character outside it written `?` and counted;
  - R12: `$ACADVER AC1009`, POLYLINE/VERTEX/SEQEND (no LWPOLYLINE), TEXT, a 999 comment block; at most 6 decimals;
  - the cut: a triangle in the plane gives nothing; segments under **0.1 mm** dropped; chaining tolerance **0.5 mm**; closed POLYLINEs where a loop closes;
  - "move to origin": the model's lower-left corner rounded down to **1 m**, subtracted, and written as a comment;
  - layers and colours: spec §4 (`IFC_WALL` 7 … `IFC_SPACE_TEXT` 2); never drawn: IfcOpeningElement, IfcAnnotation, IfcGrid, IfcSite, IfcVirtualElement;
  - file names `NN <storey name>.dxf`.
- **GA** (consent-gated, anonymous: never file names, storey names or figures): `ifcp_file_loaded { schema, size: under-10mb | 10-50mb | over-50mb, storeys: 1 | 2-5 | 6-20 | over-20 }`, `ifcp_example_loaded`, `ifcp_download { what: storey | zip, units }`, `ifcp_recut`, `ifcp_error { reason }`, plus `ifcp_survey { answer }` and `ifcp_cta_click { where }` as on the other tools.
- **Performance (spec §9, headless Chrome on the development laptop):** the example under 1 s from click to preview; a 13 MB IFC under 2 s; the 47 MB sample under 3 s; a re-cut under 1 s for 13 MB.
- **Hosting:** the static site; no server, no special headers, nothing uploaded; the page paints without web-ifc, which loads with the first file or the example.
- **Languages:** GR (default)/EN/IT for every visible string; Italian in the formal "voi" with the typographic `’`; every non-ASCII character kept exact. The page carries its Greek strings inline.
- **Layout:** at 375 px no horizontal page scroll, a 16 px side gutter; the storey table scrolls inside its box; the preview takes the full width.
- **Tests:** `node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js" "_tests/laser/*.test.js" "_tests/dwg/*.test.js" "_tests/coverage/*.test.js" "_tests/ifcplan/*.test.js"` from the repo root. Quote the globs (Node 24).
- **Cache-busting:** `?v=20261101` is a placeholder (no live page uses it) that the deploy day replaces (Task 15). It is on: the page's `css/tools.css`, `i18n-ifcplan.js` and `ui.js`; every relative import in `js/ifcplan/*.js` except the shared shell's; the worker URL; the web-ifc import and its `.wasm` URL; the example's fetch. The sitemap's `lastmod` placeholder is `2026-11-01`.
- **Commits** end with the session trailer, copied verbatim:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
  ```
  The repo-local git email is `akoulousis@aidedcam.com`; Task 0 checks it.
- **Whole files are extracted, never retyped.**
  - A file shown in full is preceded by a line `<!-- file: <path> -->`. Changed existing files (`.gitattributes`, `css/tools.css`, `free-tools.html`, `sitemap.xml`, `llms.txt`) are given whole too; each task says which lines differ and the expected `git diff --stat`.
  - Write a file with `node _tests/extract.mjs $PLAN <path>`, check it with the same command plus `--check`, where `PLAN=_docs/ifc-plans/2026-10-01-ifc-plans-plan.md`. Set `PLAN` in every shell you run steps in.
  - Binary files are never typed: web-ifc comes from `npm pack` (Task 1), the example from the generator (Task 7).
- **Never push, merge or amend.** Pushing `main` publishes the live site, and only Aris decides that.

## Review Focus

The five failure modes real IFC exports are most likely to bring that the spec doesn't spell out, most likely first, each pinned by a test in its owning task:

1. **Units** (a model in mm, cm or feet; a DXF opened at the wrong scale): levels and plans off by 10×, 1000× or 0.3048×, silently. *Pinned by `model.test.js` `units: feet and centimetres are read from the project, and the plans come out in metres` and the example's `unitM: 0.001` (Task 8); `dxf.test.js` `$INSUNITS is 6, 5 and 4 for m, cm and mm, with the coordinates and the text height scaled` (Task 6); browser `a unit switch rewrites $INSUNITS and scales: mm` (Task 14).*
2. **Georeferenced or raised models** (a building placed 14 m up, coordinates 6,591 km north): storey `Elevation` relative to the building gives wrong cut heights; large coordinates lose welds. *Pinned by `model.test.js` `a storey's level is the world Z of its placement, not its Elevation (a building placed 100 m up)` (Task 8); `chain.test.js` `georeferenced coordinates (6,591 km north) weld and close as small ones do` (Task 3); `state.test.js` warnings `far` (Task 12); browser `move to origin writes the shift and moves the plan` (Task 14).*
3. **Geometry exactly at the cut** (a sill or a slab top at 1.10 m): garbage lines or open loops. *Pinned by `cut.test.js` `a vertex exactly on the plane …` and `a triangle lying in the plane gives nothing; the plan looks just above the cut` (Task 2); `model.test.js` `a re-cut on the open model: … at 0.00 m the plan looks just above the floor` (Task 8).*
4. **Elements web-ifc cannot mesh** (failed booleans on voided walls, 4 % of the 47 MB sample's walls): silently missing walls. *Pinned by `model.test.js` `an element web-ifc cannot mesh is reported by type and storey; a thin proxy without a Body is a marker` (Task 8); `state.test.js` `warnings: … missing geometry by type …` (Task 12); the 47 MB sample reports exactly the spike's 51 walls + 14 proxies (Task 14).*
5. **Text and names** (Greek labels, characters outside 1253, storey names with `:` or `/`, two storeys with one name): unreadable or overwritten files. *Pinned by `dxf.test.js` `Greek text round-trips through Windows-1253; a character outside it becomes ? and is counted` (Task 6); `names.test.js` (Task 6); `state.test.js` `cp1253` count (Task 12); browser `ground floor DXF: Greek labels with areas` and `the ZIP: its name and two entries` (Task 14).*

Also pinned: a re-cut after a worker restart re-reads the file (`worker.test.js` `a re-cut with no open model is stale …`, Task 9); ifcZIP / ifcXML / unknown schema errors (Task 9 and browser Task 14).

## Spec refinements made while validating this plan

Each one is recorded here so the reviewers can check it against the spec, and so Aris can accept or reverse it.

**For Aris's ruling** (the spec's behaviour is kept; the spec's stated reason didn't hold):
- **A. The proxy filter (spec §4) catches nothing in the six samples.** It is implemented exactly as specified (a proxy under 1 mm thick in Z with no Body representation is dropped) and pinned by a test. But the "grid/level marker crosses" the spike saw on the Revit ARC sample's proxy layer are **RPC entourage**: 16 trees, 4 people, a car, modelled as crossed vertical planes with a Body (`MappedRepresentation`), 1.5–12.8 m tall. They stay on `IFC_OTHER` and draw as crosses in plan, as they do in Revit's own plans. Options: keep (this plan), or also drop proxies whose name starts with `RPC` (a one-line change in `layers.js` plus a test).

**Refinements:**
1. **The worker answers chained polylines, not raw segments** (spec §3: `layers: { WALL: Float64Array[x0,y0,x1,y1,…] }`). Each element's segments are chained in the worker, so every wall closes on its own loops and the page writes DXFs without chaining again. `layers` is keyed by DXF layer name and holds `{ xy: Float64Array, ends: Uint32Array, closed: Uint8Array }` (transferred, not copied). Added: storey `cutZ`; room `id`, `at` (label point), `crossed`; file `rooms`, `noStoreys`, `noGeometry`; the reply's `name`, `recut`, `cutM`. Coordinates stay metres in IFC world coordinates.
2. **A re-cut whose model is gone answers `{ type: 'error', reason: 'stale' }`** (after a worker restart, or once a later file failed), and the page sends the bytes again once. `stale` is internal and never shown. The page keeps the bytes for this.
3. **Two pure modules the spec doesn't list.** `model.js` holds the worker's reading logic (`sniff`, `unitsOf`, `storeysOf`, `prepare`, `cutModel`), so the Node end-to-end test runs the same code through the same web-ifc build; `worker.js` exports `createSession` for the Node tests and wires the worker globals only inside a worker. `state.js` holds the controller's pure decisions (settings, the typed cut height, GA buckets, warnings).
4. **The vendored browser build runs in Node** through `_tests/ifcplan/webifc-node.mjs`: during `Init` only, `process` is hidden, `window` set, and `fetch` answers with the vendored `.wasm`. No Node build of web-ifc is vendored.
5. **The plan looks just above its plane.** A vertex on the plane (within 0.1 µm) counts as below it. So a triangle in the plane gives nothing and a slab whose top is at the cut draws nothing (spec), while a slab whose underside is at the cut draws its outline, and a window whose sill is at the cut is cut through its opening.
6. **Chaining is per element**; a doubled segment is drawn once; a junction of three or more ends the pieces there; collinear runs merge within 0.01 mm. Welding uses a grid relative to the element's first point (georeferenced coordinates keep their precision).
7. **The layer table names every type.** IFC4's standard-case subtypes and `IfcSystemFurnitureElement` go with their parents; `IfcOpeningStandardCase` is never drawn, like `IfcOpeningElement`; `IFC_MEP` lists every IFC2X3 distribution type and its IFC4 subtypes (82 names). `IfcSanitaryTerminal` stays on `IFC_FURNITURE` as the spec says, though IFC makes it a flow terminal.
8. **"Without geometry"** counts the elements of the spatial structure (contained, or parts of an aggregate) of a drawable type that carry a Body (or Facetation, or an unnamed solid) representation and that web-ifc does not mesh. They are listed per storey (the table's ⚠ column, with the types in its tooltip) and per file (the warning). On the 47 MB sample this gives exactly the spike's 51 `IfcWallStandardCase` + 14 proxies.
9. **Rooms.** A room belongs to the storey it is aggregated under (else the highest storey at or below its floor), and is cut only at that storey's plane, so a double-height room is labelled once. Its outline is the largest closed loop of its cut; all its loops go on `IFC_SPACE`. The area comes from `NetFloorArea`, else `GrossFloorArea`, in `Qto_SpaceBaseQuantities` **or IFC2X3's `BaseQuantities`** (Archicad and Revit IFC2X3 exports name it so; the 47 MB sample does), converted by the project's area unit; else the outline. A room that doesn't reach the cut gets its label at its plan's bounding-box centre (spec) and its area from a cut at its mid-height (spec silent), and is counted in a warning.
10. **No storeys:** one plan, cut at 0 + the cut height (world Z), named after the file, with a warning.
11. **Errors.** `read` carries what the file is (`ifczip`, `ifcxml`, `not-ifc`) and the page says so; `schema` names the `FILE_SCHEMA` found when web-ifc refuses it; `empty` when no element and no room has geometry. The 150 MB limit is checked by the page before reading, and again in the worker.
12. **The DXF.** Every file's layer table holds layer `0` and all 14 layers of spec §4 (so every storey has the same layer set as an XREF), plus LTYPE `CONTINUOUS` and STYLE `STANDARD`; CRLF line ends; group codes right-aligned in 3 characters. A label is one TEXT per line, middle-centre (72 = 1, 73 = 2), lines 1.6 text heights apart. The comment block reads: `IFC floor plan from aidedcam.com/ifc-plans.html`, `Source: …`, `Storey: …, level 0.000 m`, `Cut: 1.10 m above the storey level, at 1.100 m`, `Units: mm`, then `Shift: X -120000 mm, Y -80000 mm; add it back to return to the IFC's coordinates` (whole drawing units, ASCII minus; spec §5's example uses U+2212 and grouped digits, which code page 1253 cannot hold) or `Shift: none; the IFC's coordinates`. A storey with nothing at the cut still gets a whole DXF with no entities.
13. **The area line keeps the point** (`43.61 m²`, spec §5's example) in every language.
14. **File names.** `NN` counts from 01 and widens past 99; a storey name used twice (in any case) gets ` (2)`; an empty name becomes the language's word for storey; the ZIP is `<IFC name>-dxf.zip`.
15. **Warnings.** "Far from the origin" when any bounding-box coordinate is over 10 km, and not while "move to origin" is on. The code-page count counts each text once (file name, storey names, labels), not once per DXF.
16. **Settings.** The cut height accepts 0–10 m with one separator, comma or point (anything else is marked `aria-invalid`, never guessed), and applies on change (Enter or leaving the field), not on each keystroke. Settings are stored as `aidedcam-ifcp-settings`.
17. **The example** (spec §10) is generated in millimetres with areas in m², its site placed at (120.50, 80.25) m so that "move to origin" has a shift to show. The third room is Name `1.01` with LongName `Υπνοδωμάτιο`, to exercise the Name/LongName rule. Its column sits off the living room's label.
18. **The preview** fits the whole model, so every storey lines up when switching; labels are drawn at the model's 0.20 m, capped at 14 px and hidden under 6 px; the tooltip names the layer of the line within 6 px of the pointer.
19. **A re-cut re-streams the meshes** from web-ifc (no mesh cache, to keep memory flat): 0.87 s on the 11.5 MB sample, 0.12–0.31 s on the others (spec: under 1 s at 13 MB).
20. **`.gitattributes`** gains `js/ifcplan/vendor/** binary` and `*.ifc binary`, so the vendored files keep their hashes and the example its bytes on a CRLF checkout.
21. **The tasks** are 0–15, not 0–14: `model.js` (Task 8) is split from the worker (Task 9), and the strings check goes with the page (Task 11).

## File structure

| Path | Task | Responsibility |
|---|---|---|
| `.gitattributes` | 1 | Vendored web-ifc and `.ifc` files byte-exact |
| `js/ifcplan/vendor/web-ifc/web-ifc-api.js`, `web-ifc.wasm`, `LICENSE`, `SOURCE.md` | 1 | web-ifc 0.0.78 from npm, unchanged, and where it came from |
| `_tests/ifcplan/webifc-node.mjs`, `vendor.test.js` | 1 | The vendored build loaded in Node; hashes and a smoke test |
| `js/ifcplan/cut.js`, `_tests/ifcplan/mesh.mjs` | 2 | Triangle mesh ∩ horizontal planes; test meshes |
| `js/ifcplan/chain.js` | 3 | Segments → polylines; packed polyline sets |
| `js/ifcplan/layers.js` | 4 | IFC type → layer and colour; the proxy marker rule |
| `js/ifcplan/rooms.js` | 5 | Shoelace, Qto-first area, label point, label lines, outline |
| `js/ifcplan/dxf.js`, `names.js`, `_tests/ifcplan/dxf-read.mjs` | 6 | R12 writer, Windows-1253; file names; a strict DXF reader for the tests |
| `_tests/ifcplan/step.mjs`, `make-example.mjs`, `js/ifcplan/examples/example-house.ifc` | 7 | STEP writer, small test models; the example generator and the example |
| `js/ifcplan/model.js` | 8 | Sniff, units, storeys, spatial structure, rooms' quantities; the cut of every storey |
| `js/ifcplan/worker.js` | 9 | The worker: bridge messages, open model, re-cut, errors |
| `js/ifcplan/drawing.js` | 10 | Canvas preview |
| `js/ifcplan/i18n-ifcplan.js`, `ifc-plans.html`, `css/tools.css` | 11 | Strings (`window.IP_I18N`), the page, its styles (a section appended) |
| `js/ifcplan/state.js`, `ui.js` | 12 | The controller's pure decisions; the controller |
| `free-tools.html`, `sitemap.xml`, `llms.txt` | 13 | Site links |
| `_tests/ifcplan/browser-check.js`, `browser-check.cjs` | 14 | The browser check (40) and its runner |
| `_docs/ifc-plans/real-file-check.md` | 15 | The record for Greek IFC exports |
| `_tests/ifcplan/*.test.js` | 1–13 | Node suites (15 files, 63 tests) |

---

### Task 0: Starting point

Nothing is written in this task; it checks that the tools and the baseline are as this plan expects.

**Files:** none.

**Interfaces:**
- Produces: a known baseline for Tasks 1–15: Node 412; the placeholder `20261101` unused; `.ifc` and the vendor folder not yet byte-exact (Task 1 adds that).

- [ ] **Step 1: Check the starting point**

Run:
```bash
PLAN=_docs/ifc-plans/2026-10-01-ifc-plans-plan.md
git branch --show-current && git log --oneline -1
git config user.email
node --version
node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js" "_tests/laser/*.test.js" "_tests/dwg/*.test.js" "_tests/coverage/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
grep -rln "20261101\|2026-11-01" --include=*.html --include=*.js --include=*.css --include=*.xml . | grep -v "^./_docs/" ; echo "placeholder check done"
npm view web-ifc@0.0.78 version
```
Expected:
- the branch is `feat/ifc-plans` (or the worktree's own branch), and HEAD is the commit that adds this plan;
- the email is `akoulousis@aidedcam.com` (if not: `git config --local user.email akoulousis@aidedcam.com`);
- Node `v24.x`;
- `ℹ pass 412` and `ℹ fail 0`;
- nothing listed before `placeholder check done`;
- `0.0.78`.

- [ ] **Step 2: The browser tooling**

Run: `node -e "const p=require('path'),fs=require('fs'),d=p.join(require('os').homedir(),'AppData','Local','npm-cache','_npx');console.log(fs.readdirSync(d).some(x=>fs.existsSync(p.join(d,x,'node_modules','playwright-core'))))" && ls "C:/Program Files/Google/Chrome/Application/chrome.exe" && python --version && (netstat -ano | grep ":8793 .*LISTENING" || echo "port 8793 free")`
Expected: `true`, the Chrome path, a Python 3 version, and `port 8793 free`. If `false`: run `npx playwright --version` once (or set `PW_CORE` to a `playwright-core` folder).

No commit: nothing changed.

---

### Task 1: web-ifc, vendored, and loaded in the Node tests

**Files:**
- Modify: `.gitattributes` (4 lines appended)
- Create: `js/ifcplan/vendor/web-ifc/web-ifc-api.js`, `web-ifc.wasm`, `LICENSE` (from npm), `SOURCE.md`
- Create: `_tests/ifcplan/webifc-node.mjs`
- Test: `_tests/ifcplan/vendor.test.js`

**Interfaces:**
- Produces: `openApi() → Promise<{ api, W }>` (`_tests/ifcplan/webifc-node.mjs`): an initialised web-ifc `IfcAPI` on the vendored browser build, log level off, and the web-ifc module `W` (type codes such as `W.IFCWALL`, `W.FILE_NAME`). `api.GetNameFromTypeCode` answers names like `IfcWall`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/ifcplan/vendor.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { openApi } from './webifc-node.mjs';

const DIR = new URL('../../js/ifcplan/vendor/web-ifc/', import.meta.url);
const sha = name => createHash('sha256').update(readFileSync(new URL(name, DIR))).digest('hex');

// One wall, 4000 × 200 × 3000 mm, as the smallest IFC4 file web-ifc meshes.
const WALL = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [ReferenceView]'),'2;1');
FILE_NAME('wall.ifc','2026-01-01T00:00:00',(''),(''),'','','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCPROJECT('0000000000000000000001',$,'P',$,$,$,$,(#5),#2);
#2=IFCUNITASSIGNMENT((#3));
#3=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);
#4=IFCAXIS2PLACEMENT3D(#6,$,$);
#5=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#4,$);
#6=IFCCARTESIANPOINT((0.,0.,0.));
#7=IFCLOCALPLACEMENT($,#4);
#8=IFCAXIS2PLACEMENT2D(#9,$);
#9=IFCCARTESIANPOINT((2000.,100.));
#10=IFCRECTANGLEPROFILEDEF(.AREA.,$,#8,4000.,200.);
#11=IFCDIRECTION((0.,0.,1.));
#12=IFCEXTRUDEDAREASOLID(#10,#4,#11,3000.);
#13=IFCSHAPEREPRESENTATION(#5,'Body','SweptSolid',(#12));
#14=IFCPRODUCTDEFINITIONSHAPE($,$,(#13));
#15=IFCWALL('0000000000000000000002',$,'W',$,$,#7,#14,$,$);
ENDSEC;
END-ISO-10303-21;
`;

test('the vendored files are web-ifc 0.0.78 as published on npm, with its licence', () => {
  assert.equal(sha('web-ifc-api.js'), '1edb1dd8e8dba63757932f62001f1b2ee812d86594b6ffc5e1e8beebe1f16690');
  assert.equal(sha('web-ifc.wasm'), '1fbd30bd5515ff6ad15268e87aa26e41d57b29411c8461618b63bee92735d349');
  assert.ok(readFileSync(new URL('LICENSE', DIR), 'utf8').startsWith('Mozilla Public License Version 2.0'));
  const src = readFileSync(new URL('SOURCE.md', DIR), 'utf8');
  assert.ok(src.includes('0.0.78') && src.includes('https://github.com/ThatOpen/engine_web-ifc'));
});

test('the vendored browser build opens an IFC in Node and meshes it in metres', async () => {
  const { api, W } = await openApi();
  const id = api.OpenModel(new TextEncoder().encode(WALL), { COORDINATE_TO_ORIGIN: false });
  assert.equal(id, 0);
  assert.equal(api.GetModelSchema(id), 'IFC4');
  const meshes = [];
  api.StreamAllMeshes(id, m => {
    const g = m.geometries.get(0);
    const geo = api.GetGeometry(id, g.geometryExpressID);
    const v = api.GetVertexArray(geo.GetVertexData(), geo.GetVertexDataSize());
    const ix = api.GetIndexArray(geo.GetIndexData(), geo.GetIndexDataSize());
    const T = g.flatTransformation;
    let top = -Infinity;                                       // web-ifc is Y-up: the IFC's Z comes out as Y
    for (let k = 0; k < v.length; k += 6) top = Math.max(top, T[1] * v[k] + T[5] * v[k + 1] + T[9] * v[k + 2] + T[13]);
    meshes.push({ id: m.expressID, type: api.GetNameFromTypeCode(api.GetLineType(id, m.expressID)), tris: ix.length / 3, top });
    geo.delete();
  });
  assert.deepEqual(meshes.map(m => [m.id, m.type, m.tris]), [[15, 'IfcWall', 12]]);
  assert.ok(Math.abs(meshes[0].top - 3) < 1e-9, `top ${meshes[0].top} m`);
  assert.equal(W.IFCWALL, api.GetLineType(id, 15));
  api.CloseModel(id);
});
```

<!-- file: _tests/ifcplan/webifc-node.mjs -->
```js
// Loads the vendored browser build of web-ifc (js/ifcplan/vendor/web-ifc/) in Node, for the tests. That build is
// compiled for the web only: it refuses to start when it sees Node's `process`, wants a `window`, and fetches its
// .wasm. So, during Init only, `process` is hidden, `window` is set, and fetch answers with the vendored .wasm. The
// tests then run the same engine bytes the page serves.
import { readFileSync } from 'node:fs';

const DIR = new URL('../../js/ifcplan/vendor/web-ifc/', import.meta.url);

export async function openApi() {
  const W = await import(new URL('web-ifc-api.js', DIR).href);
  const api = new W.IfcAPI();
  const wasm = readFileSync(new URL('web-ifc.wasm', DIR));
  const saved = { process: globalThis.process, fetch: globalThis.fetch };
  globalThis.window = globalThis;
  globalThis.fetch = async () => new Response(wasm, { headers: { 'content-type': 'application/wasm' } });
  Object.defineProperty(globalThis, 'process', { value: undefined, configurable: true, writable: true });
  try {
    await api.Init(p => `http://vendor.invalid/${p}`, true);
  } finally {
    Object.defineProperty(globalThis, 'process', { value: saved.process, configurable: true, writable: true });
    globalThis.fetch = saved.fetch;
    delete globalThis.window;
  }
  api.SetLogLevel(W.LogLevel.LOG_LEVEL_OFF);
  return { api, W };
}
```

Run:
```bash
for f in _tests/ifcplan/vendor.test.js _tests/ifcplan/webifc-node.mjs; do node _tests/extract.mjs $PLAN $f; done
node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
```
Expected: `ℹ pass 0`, `ℹ fail 2` (the vendored files are missing).

- [ ] **Step 2: Vendor web-ifc 0.0.78 from npm, and keep it byte-exact**

`.gitattributes` gains the last four lines:

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
```

<!-- file: js/ifcplan/vendor/web-ifc/SOURCE.md -->
```markdown
# web-ifc 0.0.78 (vendored)

The IFC reader of the IFC floor-plans tool (`ifc-plans.html`). Pinned: it is a 0.0.x library whose API changes between
versions, so it is never updated in place without re-running every test of the tool.

- Package: `web-ifc` 0.0.78 on npm (https://www.npmjs.com/package/web-ifc/v/0.0.78), by ThatOpen Company.
- Upstream source: https://github.com/ThatOpen/engine_web-ifc
- Licence: Mozilla Public License 2.0, in `LICENSE` (the package's `LICENSE.md`, unchanged).
- Files taken unchanged from the package: `web-ifc-api.js` (the browser ES-module build) and `web-ifc.wasm` (the
  single-threaded engine). The multi-threaded `web-ifc-mt.wasm` is left out: the tool forces single-threaded mode, so a
  static host needs no cross-origin isolation headers.
- SHA-256:
  - `web-ifc-api.js` 1edb1dd8e8dba63757932f62001f1b2ee812d86594b6ffc5e1e8beebe1f16690
  - `web-ifc.wasm` 1fbd30bd5515ff6ad15268e87aa26e41d57b29411c8461618b63bee92735d349

To reproduce: `npm pack web-ifc@0.0.78`, unpack the tarball, and copy `package/web-ifc-api.js`, `package/web-ifc.wasm`
and `package/LICENSE.md` (as `LICENSE`). `_tests/ifcplan/vendor.test.js` checks the hashes.
```

Run:
```bash
node _tests/extract.mjs $PLAN .gitattributes && node _tests/extract.mjs $PLAN js/ifcplan/vendor/web-ifc/SOURCE.md
T=$(mktemp -d) && npm pack web-ifc@0.0.78 --pack-destination "$T" > /dev/null && tar -xzf "$T/web-ifc-0.0.78.tgz" -C "$T"
cp "$T/package/web-ifc-api.js" "$T/package/web-ifc.wasm" js/ifcplan/vendor/web-ifc/
cp "$T/package/LICENSE.md" js/ifcplan/vendor/web-ifc/LICENSE
rm -rf "$T"
sha256sum js/ifcplan/vendor/web-ifc/web-ifc-api.js js/ifcplan/vendor/web-ifc/web-ifc.wasm
git check-attr text -- js/ifcplan/vendor/web-ifc/web-ifc-api.js js/ifcplan/examples/example-house.ifc
git diff --stat
node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
```
Expected:
- npm prints its `npm notice` lines for the tarball (14 files, `version: 0.0.78`) on stderr;
- `1edb1dd8e8dba63757932f62001f1b2ee812d86594b6ffc5e1e8beebe1f16690` for `web-ifc-api.js` and `1fbd30bd5515ff6ad15268e87aa26e41d57b29411c8461618b63bee92735d349` for `web-ifc.wasm`;
- two lines ending `text: unset`;
- `.gitattributes | 4 ++++`;
- `ℹ pass 2`, `ℹ fail 0`.

The folder holds four files, 7.5 MB (1.06 MB gzipped). The multi-threaded `web-ifc-mt.wasm` is not copied.

- [ ] **Step 3: Commit**

```bash
git add .gitattributes js/ifcplan/vendor _tests/ifcplan/vendor.test.js _tests/ifcplan/webifc-node.mjs
git commit -F - <<'EOF'
IFC floor plans: vendor web-ifc 0.0.78, and load it in the Node tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 2: The cut

**Files:**
- Create: `js/ifcplan/cut.js`
- Create: `_tests/ifcplan/mesh.mjs` (test meshes)
- Test: `_tests/ifcplan/cut.test.js`

**Interfaces:**
- Produces (`js/ifcplan/cut.js`, pure): `MIN_SEGMENT` (1e-4 m); `cutMesh(P, ix, planes, onSegment) → count`, where `P` is `[x, y, z, …]` in metres (IFC Z-up), `ix` triangle indices, `planes` the cut heights, and `onSegment(k, x0, y0, x1, y1)` is called per segment of plane `k`.
- Produces (`_tests/ifcplan/mesh.mjs`): `box(x0, y0, z0, x1, y1, z1)` (12 triangles), `tri(a, b, c)`, `segmentsOf(cut, mesh, planes) → [[k, x0, y0, x1, y1]]`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/ifcplan/mesh.mjs -->
```js
// Hand-made meshes for the IFC plan tests, in the worker's form: P = [x, y, z, …] in metres (IFC Z-up) and
// triangle indices.

// An axis-parallel box as 12 triangles (two per face), as web-ifc meshes an extruded rectangle.
export function box(x0, y0, z0, x1, y1, z1) {
  const P = new Float64Array([
    x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0,
    x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1,
  ]);
  const ix = new Uint32Array([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7,          // bottom, top
    0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5,          // front, right
    2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7,          // back, left
  ]);
  return { P, ix };
}

// One triangle.
export const tri = (a, b, c) => ({ P: new Float64Array([...a, ...b, ...c]), ix: new Uint32Array([0, 1, 2]) });

// Every segment a cut gives, as [k, x0, y0, x1, y1] rows.
export function segmentsOf(cut, mesh, planes) {
  const out = [];
  cut(mesh.P, mesh.ix, planes, (k, x0, y0, x1, y1) => out.push([k, x0, y0, x1, y1]));
  return out;
}
```

<!-- file: _tests/ifcplan/cut.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cutMesh, MIN_SEGMENT } from '../../js/ifcplan/cut.js';
import { box, tri, segmentsOf } from './mesh.mjs';

const len = s => Math.hypot(s[3] - s[1], s[4] - s[2]);
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('a box cut through its middle gives its rectangle: one segment per side triangle', () => {
  const segs = segmentsOf(cutMesh, box(2, 1, 0, 6, 1.25, 3), [1.1]);
  assert.equal(segs.length, 8);
  assert.ok(near(segs.reduce((a, s) => a + len(s), 0), 2 * (4 + 0.25)), 'the perimeter');
  for (const [, x0, y0, x1, y1] of segs) {
    for (const [x, y] of [[x0, y0], [x1, y1]]) {
      const onEdge = near(x, 2) || near(x, 6) || near(y, 1) || near(y, 1.25);
      assert.ok(onEdge && x >= 2 - 1e-9 && x <= 6 + 1e-9 && y >= 1 - 1e-9 && y <= 1.25 + 1e-9, `${x}, ${y}`);
    }
  }
});

test('a vertex exactly on the plane: a segment from it when the triangle crosses, nothing when it only touches', () => {
  assert.deepEqual(segmentsOf(cutMesh, tri([0, 0, 1], [2, 0, 0], [4, 0, 2]), [1]).map(s => s.map(v => +v.toFixed(9))), [[0, 3, 0, 0, 0]]);
  assert.deepEqual(segmentsOf(cutMesh, tri([0, 0, 1], [2, 0, 2], [4, 1, 3]), [1]), [], 'the rest above');
  assert.deepEqual(segmentsOf(cutMesh, tri([0, 0, 1], [2, 0, 0], [4, 1, -1]), [1]), [], 'the rest below');
});

test('a triangle lying in the plane gives nothing; the plan looks just above the cut', () => {
  assert.deepEqual(segmentsOf(cutMesh, tri([0, 0, 1.1], [3, 0, 1.1], [0, 3, 1.1]), [1.1]), []);
  assert.deepEqual(segmentsOf(cutMesh, box(0, 0, 0.8, 5, 4, 1.1), [1.1]), [], 'a slab whose top is at the cut draws nothing');
  const under = segmentsOf(cutMesh, box(0, 0, 1.1, 5, 4, 1.4), [1.1]);
  assert.ok(near(under.reduce((a, s) => a + len(s), 0), 18), 'a slab whose underside is at the cut draws its outline');
});

test('several planes in one pass, each segment tagged with its plane', () => {
  const segs = segmentsOf(cutMesh, box(0, 0, 0, 1, 1, 6), [1.1, 4.1, 7.1, -1]);
  assert.deepEqual([0, 1, 2, 3].map(k => segs.filter(s => s[0] === k).length), [8, 8, 0, 0]);
  assert.equal(cutMesh(new Float64Array(0), new Uint32Array(0), [1], () => assert.fail('no triangles')), 0);
});

test('segments shorter than 0.1 mm are dropped', () => {
  assert.equal(MIN_SEGMENT, 1e-4);
  assert.deepEqual(segmentsOf(cutMesh, tri([0, 0, 0], [0.00009, 0, 0], [0, 0, 2]), [1]), []);
  assert.equal(segmentsOf(cutMesh, tri([0, 0, 0], [0.00022, 0, 0], [0, 0, 2]), [1]).length, 1);
});

test('a non-finite vertex gives no segment: every segment kept has finite ends and is at least 0.1 mm long', () => {
  const m = box(0, 0, 0, 4, 1, 3);
  m.P[0] = NaN;                              // vertex 0: x
  m.P[14] = NaN;                             // vertex 4: z
  m.P[18] = Infinity;                        // vertex 6: x
  const segs = segmentsOf(cutMesh, m, [1.1]);
  assert.ok(segs.length > 0, 'the triangles without a bad vertex still cut');
  for (const s of segs) {
    assert.ok(s.slice(1).every(Number.isFinite), JSON.stringify(s));
    assert.ok(len(s) >= MIN_SEGMENT);
  }
});
```

Run:
```bash
for f in _tests/ifcplan/mesh.mjs _tests/ifcplan/cut.test.js; do node _tests/extract.mjs $PLAN $f; done
node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
```
Expected: `ℹ pass 2`, `ℹ fail 1` (the module is missing).

- [ ] **Step 2: Write the module**

<!-- file: js/ifcplan/cut.js -->
```js
// IFC floor plans: a triangle mesh cut by horizontal planes (spec §5). Pure: no DOM, no web-ifc.
// The plan looks just above its plane: a vertex on the plane counts as below it. So a triangle lying in the plane
// gives nothing, a slab whose top is at the cut draws nothing, and one whose underside is at the cut draws its
// outline. Every mesh is cut by every plane in one pass.

export const MIN_SEGMENT = 1e-4;           // m: shorter segments are dropped (0.1 mm)
const ON_PLANE = 1e-7;                     // m: a vertex this close above the plane is on it
const pts = new Float64Array(4);

// The point where edge p–q crosses the plane, written at pts[m], pts[m + 1]: from the vertex below (or on the plane)
// towards the one above. dp, dq: heights above the plane; up: whether p is the one above.
function cross(P, p, q, dp, dq, up, m) {
  const lo = up ? q : p, hi = up ? p : q, dl = up ? dq : dp, dh = up ? dp : dq;
  const r = Math.min(1, Math.max(0, -dl / (dh - dl)));
  pts[m] = P[lo] + r * (P[hi] - P[lo]);
  pts[m + 1] = P[lo + 1] + r * (P[hi + 1] - P[lo + 1]);
  return m + 2;
}

// P: [x, y, z, …] in metres, IFC Z-up; ix: triangle indices into P/3; planes: the cut heights (m), in any order.
// Calls onSegment(k, x0, y0, x1, y1) for each segment of plane k; returns how many it gave.
export function cutMesh(P, ix, planes, onSegment) {
  let zmin = Infinity, zmax = -Infinity;
  for (let i = 2; i < P.length; i += 3) { const z = P[i]; if (z < zmin) zmin = z; if (z > zmax) zmax = z; }
  let n = 0;
  for (let k = 0; k < planes.length; k++) {
    const c = planes[k];
    if (!(zmin <= c + ON_PLANE && zmax > c + ON_PLANE)) continue;    // nothing of the mesh is just above the plane
    for (let t = 0; t + 2 < ix.length; t += 3) {
      const a = 3 * ix[t], b = 3 * ix[t + 1], d = 3 * ix[t + 2];
      const da = P[a + 2] - c, db = P[b + 2] - c, dd = P[d + 2] - c;
      const ua = da > ON_PLANE, ub = db > ON_PLANE, ud = dd > ON_PLANE;
      if (ua === ub && ub === ud) continue;                            // all above, or all below or on the plane
      let m = 0;
      if (ua !== ub) m = cross(P, a, b, da, db, ua, m);
      if (ub !== ud) m = cross(P, b, d, db, dd, ub, m);
      if (ud !== ua) cross(P, d, a, dd, da, ud, m);
      // Too short, or from a vertex web-ifc gave as NaN or Infinity: dropped.
      if (!(Math.hypot(pts[2] - pts[0], pts[3] - pts[1]) >= MIN_SEGMENT)) continue;
      if (!(Number.isFinite(pts[0]) && Number.isFinite(pts[1]) && Number.isFinite(pts[2]) && Number.isFinite(pts[3]))) continue;
      onSegment(k, pts[0], pts[1], pts[2], pts[3]);
      n++;
    }
  }
  return n;
}
```

Run: `node _tests/extract.mjs $PLAN js/ifcplan/cut.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 7`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/ifcplan/cut.js _tests/ifcplan/mesh.mjs _tests/ifcplan/cut.test.js
git commit -F - <<'EOF'
IFC floor plans: the cut of a mesh by the storeys' planes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 3: Segments into polylines

**Files:**
- Create: `js/ifcplan/chain.js`
- Test: `_tests/ifcplan/chain.test.js`

**Interfaces:**
- Consumes: `cutMesh` (Task 2), `box` (Task 2, tests).
- Produces (`js/ifcplan/chain.js`, pure): `WELD` (5e-4 m), `COLLINEAR` (1e-5 m); `chain(segs, tol) → [{ pts: [x, y, …], closed }]` (a closed loop lists each corner once); `simplify(pts, closed, eps) → pts`; `polylineSet()` → `{ add(pts, closed), count, pack() → { xy: Float64Array, ends: Uint32Array, closed: Uint8Array } }`; `forEachPolyline(set, fn(pts, closed, i))` (pts a view into `xy`).

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/ifcplan/chain.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chain, simplify, polylineSet, forEachPolyline, WELD } from '../../js/ifcplan/chain.js';
import { cutMesh } from '../../js/ifcplan/cut.js';
import { box } from './mesh.mjs';

const round = a => [...a].map(v => +v.toFixed(6));
const shoelace = p => { let s = 0; for (let i = 0; i < p.length; i += 2) { const j = (i + 2) % p.length; s += p[i] * p[j + 1] - p[j] * p[i + 1]; } return Math.abs(s) / 2; };

test('a box cut joins into one closed loop of its four corners', () => {
  const segs = [];
  cutMesh(box(2, 1, 0, 6, 1.25, 3).P, box(2, 1, 0, 6, 1.25, 3).ix, [1.1], (k, ...s) => segs.push(...s));
  const out = chain(segs);
  assert.equal(out.length, 1);
  assert.equal(out[0].closed, true);
  assert.equal(out[0].pts.length, 8, 'four corners, the split sides merged');
  assert.ok(Math.abs(shoelace(out[0].pts) - 1) < 1e-9);
});

test('collinear runs merge, in any order and direction', () => {
  const out = chain([3, 0, 4, 0, 1, 0, 0, 0, 2, 0, 3, 0, 2, 0, 1, 0, 4, 0, 5, 0]);
  assert.equal(out.length, 1);
  assert.equal(out[0].closed, false);
  assert.deepEqual(round(out[0].pts).sort((a, b) => a - b), [0, 0, 0, 5]);
  assert.deepEqual(round(simplify([0, 0, 1, 0, 2, 0.000005, 3, 0, 3, 2], false)), [0, 0, 3, 0, 3, 2], 'within 0.01 mm of the line');
  assert.deepEqual(round(simplify([0, 0, 1, 0, 2, 0.0001, 3, 0], false)), [0, 0, 1, 0, 2, 0.0001, 3, 0], '0.1 mm off the line is a corner');
  assert.deepEqual(round(simplify([0, 0, 2, 0, 1, 0], false)), [0, 0, 2, 0, 1, 0], 'a run that turns back is kept');
});

test('the 0.5 mm tolerance: gaps up to it are closed, wider ones are not', () => {
  assert.equal(WELD, 5e-4);
  const square = gap => [0, 0, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 0, gap];
  assert.deepEqual(chain(square(0.0004)).map(p => [p.closed, p.pts.length]), [[true, 8]]);
  assert.deepEqual(chain(square(0.0006)).map(p => [p.closed, p.pts.length]), [[false, 10]]);
});

test('open chains stay open; junctions end them; doubled segments are drawn once', () => {
  assert.deepEqual(chain([0, 0, 1, 0, 1, 0, 1, 1]).map(p => [p.closed, round(p.pts)]), [[false, [0, 0, 1, 0, 1, 1]]]);
  const t = chain([0, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 1]);
  assert.equal(t.length, 3, 'a T: three pieces from the junction');
  assert.ok(t.every(p => !p.closed && p.pts.length === 4));
  const eight = chain([0, 0, 1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 0, 0, -1, 0, -1, 0, -1, -1, -1, -1, 0, 0]);
  assert.deepEqual(eight.map(p => p.closed), [true, true], 'two loops through one point');
  assert.deepEqual(chain([0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 1]).map(p => p.pts.length), [6]);
  assert.deepEqual(chain([0, 0, 0.0001, 0]), [], 'a segment shorter than the tolerance welds into a point');
});

test('georeferenced coordinates (6,591 km north) weld and close as small ones do', () => {
  const x = 538450.123456, y = 6591584.654321, d = 0.0002;               // ends 0.2 mm apart
  const out = chain([x, y, x + 3, y, x + 3 + d, y, x + 3, y + 0.25, x + 3, y + 0.25, x, y + 0.25, x, y + 0.25 + d, x, y]);
  assert.deepEqual(out.map(p => [p.closed, p.pts.length]), [[true, 8]]);
  assert.ok(Math.abs(out[0].pts[0] - x) < 1e-3 && Math.abs(out[0].pts[1] - y) < 1e-3);
});

test('a segment overlapped by its own halves is one open line, not a closed loop', () => {
  const out = chain([0, 0, 2, 0, 0, 0, 1, 0, 1, 0, 2, 0]);
  assert.equal(out.length, 1);
  assert.equal(out[0].closed, false);
  const xs = [];
  for (let i = 0; i < out[0].pts.length; i += 2) xs.push(out[0].pts[i]);
  assert.equal(Math.min(...xs), 0);
  assert.equal(Math.max(...xs), 2);
});

test('a polyline set packs into typed arrays and reads back', () => {
  const set = polylineSet();
  set.add([0, 0, 1, 0, 1, 1], true);
  set.add([5, 5, 6, 6], false);
  const packed = set.pack();
  assert.ok(packed.xy instanceof Float64Array && packed.ends instanceof Uint32Array && packed.closed instanceof Uint8Array);
  assert.deepEqual([...packed.ends], [3, 5]);
  const back = [];
  forEachPolyline(packed, (pts, closed, i) => back.push([i, closed, [...pts]]));
  assert.deepEqual(back, [[0, true, [0, 0, 1, 0, 1, 1]], [1, false, [5, 5, 6, 6]]]);
  assert.equal(set.count, 2);
});
```

Run: `node _tests/extract.mjs $PLAN _tests/ifcplan/chain.test.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 7`, `ℹ fail 1`.

- [ ] **Step 2: Write the module**

<!-- file: js/ifcplan/chain.js -->
```js
// IFC floor plans: cut segments joined into polylines (spec §5). Pure: no DOM, no web-ifc.
// The worker chains each element's segments on its own, so every wall comes out as its own closed loops.

export const WELD = 5e-4;                  // m: segment ends closer than this are the same point (0.5 mm)
export const COLLINEAR = 1e-5;             // m: a vertex this close to the line through its neighbours is dropped

// segs: [x0, y0, x1, y1, …] in metres. Returns [{ pts: [x, y, …], closed }]: a closed loop lists each corner once.
// Ends are welded within tol; a doubled segment is drawn once; a junction of three or more ends the pieces there.
export function chain(segs, tol = WELD) {
  // Ends are found through a grid of tol-sized cells around the first point (numeric keys: a clash of two cells
  // only costs a distance test).
  const nodes = [], cells = new Map();
  const ox = segs[0], oy = segs[1];
  const nodeOf = (x, y) => {
    const cx = Math.floor((x - ox) / tol), cy = Math.floor((y - oy) / tol);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const list = cells.get((cx + i) * 1048576 + (cy + j));
        if (!list) continue;
        for (const n of list) if (Math.hypot(nodes[n].x - x, nodes[n].y - y) <= tol) return n;
      }
    }
    const n = nodes.length;
    nodes.push({ x, y, edges: [] });
    const key = cx * 1048576 + cy;
    const list = cells.get(key);
    if (list) list.push(n); else cells.set(key, [n]);
    return n;
  };
  const edges = [], seen = new Set();
  for (let i = 0; i + 3 < segs.length; i += 4) {
    const a = nodeOf(segs[i], segs[i + 1]), b = nodeOf(segs[i + 2], segs[i + 3]);
    if (a === b) continue;
    const key = a < b ? a * 4294967296 + b : b * 4294967296 + a;
    if (seen.has(key)) continue;
    seen.add(key);
    const e = edges.length;
    edges.push({ a, b, used: false });
    nodes[a].edges.push(e);
    nodes[b].edges.push(e);
  }
  const out = [];
  const walk = (start, e0) => {
    const ids = [start];
    let at = start, e = e0;
    for (;;) {
      edges[e].used = true;
      at = edges[e].a === at ? edges[e].b : edges[e].a;
      if (at === start) break;
      ids.push(at);
      if (nodes[at].edges.length !== 2) break;
      e = nodes[at].edges.find(x => !edges[x].used);
      if (e === undefined) break;
    }
    let closed = at === start;
    const pts = [];
    for (const n of ids) pts.push(nodes[n].x, nodes[n].y);
    const s = simplify(pts, closed);
    // Overlapping collinear segments (a long one and its halves) close a loop with no area: draw it open.
    if (closed && (s.length < 6 || Math.abs(area(s)) < tol * tol)) closed = false;
    out.push({ pts: s, closed });
  };
  // Open pieces first: from every end and junction. Whatever is left is made of closed loops.
  for (let n = 0; n < nodes.length; n++) {
    if (nodes[n].edges.length === 2) continue;
    for (const e of nodes[n].edges) if (!edges[e].used) walk(n, e);
  }
  for (let n = 0; n < nodes.length; n++) {
    for (const e of nodes[n].edges) if (!edges[e].used) walk(n, e);
  }
  return out;
}

// Signed shoelace area of a closed ring [x, y, …], relative to its first point.
function area(p) {
  let a = 0;
  for (let i = 2; i + 3 < p.length; i += 2) a += (p[i] - p[0]) * (p[i + 3] - p[1]) - (p[i + 2] - p[0]) * (p[i + 1] - p[1]);
  return a / 2;
}

// Is b on the line a–c (within eps) and between them?
function straight(ax, ay, bx, by, cx, cy, eps) {
  const dx = cx - ax, dy = cy - ay, l = Math.hypot(dx, dy);
  if (l === 0) return false;
  if (Math.abs(dx * (by - ay) - dy * (bx - ax)) / l > eps) return false;
  return (bx - ax) * (cx - bx) + (by - ay) * (cy - by) > 0;
}

// Drops the vertices of a straight run (pts: [x, y, …]). A closed polyline's first vertex is checked too.
export function simplify(pts, closed, eps = COLLINEAR) {
  const n = pts.length / 2;
  if (n < 3) return pts.slice();
  const src = closed ? [...pts, pts[0], pts[1]] : pts;
  const m = src.length / 2;
  const out = [src[0], src[1]];
  for (let i = 1; i < m - 1; i++) {
    const k = out.length - 2;
    if (straight(out[k], out[k + 1], src[2 * i], src[2 * i + 1], src[2 * i + 2], src[2 * i + 3], eps)) continue;
    out.push(src[2 * i], src[2 * i + 1]);
  }
  if (!closed) { out.push(src[2 * m - 2], src[2 * m - 1]); return out; }
  const k = out.length;
  if (k >= 6 && straight(out[k - 2], out[k - 1], out[0], out[1], out[2], out[3], eps)) out.splice(0, 2);
  return out;
}

// Polylines gathered for one layer of one storey, packed for the worker's answer:
// { xy: Float64Array, ends: Uint32Array (each polyline's end, in points), closed: Uint8Array }.
export function polylineSet() {
  const xy = [], ends = [], closed = [];
  return {
    add(pts, isClosed) { for (let i = 0; i < pts.length; i++) xy.push(pts[i]); ends.push(xy.length / 2); closed.push(isClosed ? 1 : 0); },
    get count() { return ends.length; },
    pack() { return { xy: Float64Array.from(xy), ends: Uint32Array.from(ends), closed: Uint8Array.from(closed) }; },
  };
}

// Calls fn(pts, closed, i) for each polyline of a packed set; pts is a view [x, y, …] into set.xy.
export function forEachPolyline(set, fn) {
  let start = 0;
  for (let i = 0; i < set.ends.length; i++) {
    const end = set.ends[i];
    fn(set.xy.subarray(2 * start, 2 * end), set.closed[i] === 1, i);
    start = end;
  }
}
```

Run: `node _tests/extract.mjs $PLAN js/ifcplan/chain.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 13`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/ifcplan/chain.js _tests/ifcplan/chain.test.js
git commit -F - <<'EOF'
IFC floor plans: segments joined into polylines

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 4: Layers and colours

**Files:**
- Create: `js/ifcplan/layers.js`
- Test: `_tests/ifcplan/layers.test.js`

**Interfaces:**
- Produces (`js/ifcplan/layers.js`, pure): `LAYERS` (14 `{ name, aci, types }`, spec §4's order), `ACI` (name → colour), `layerOf(typeName) → layer | null` (any case; unknown types → `IFC_OTHER`; never-drawn types → `null`), `isMarkerProxy({ type, zSpan, hasBody })`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/ifcplan/layers.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYERS, ACI, layerOf, isMarkerProxy } from '../../js/ifcplan/layers.js';

// Spec §4, row by row.
const SPEC = [
  ['IFC_WALL', 7, ['IfcWall', 'IfcWallStandardCase', 'IfcWallElementedCase']],
  ['IFC_DOOR', 4, ['IfcDoor']],
  ['IFC_WINDOW', 5, ['IfcWindow']],
  ['IFC_COLUMN', 1, ['IfcColumn']],
  ['IFC_BEAM', 8, ['IfcBeam', 'IfcMember']],
  ['IFC_SLAB', 9, ['IfcSlab', 'IfcRoof', 'IfcCovering']],
  ['IFC_STAIR', 3, ['IfcStair', 'IfcStairFlight', 'IfcRamp', 'IfcRampFlight']],
  ['IFC_RAILING', 30, ['IfcRailing']],
  ['IFC_CURTAINWALL', 140, ['IfcCurtainWall', 'IfcPlate']],
  ['IFC_FURNITURE', 40, ['IfcFurnishingElement', 'IfcFurniture', 'IfcSanitaryTerminal']],
  ['IFC_MEP', 6, ['IfcFlowSegment', 'IfcFlowTerminal', 'IfcFlowFitting', 'IfcDistributionElement', 'IfcPipeSegment', 'IfcDuctFitting', 'IfcAirTerminal', 'IfcLightFixture', 'IfcValve', 'IfcPump', 'IfcBoiler', 'IfcSensor', 'IfcCableCarrierSegment']],
  ['IFC_OTHER', 8, ['IfcBuildingElementProxy', 'IfcFooting', 'IfcChimney', 'IfcSomethingNew']],
  ['IFC_SPACE', 2, ['IfcSpace']],
  ['IFC_SPACE_TEXT', 2, []],
];

test('every row of spec §4: the layer, its colour and its IFC types', () => {
  assert.deepEqual(LAYERS.map(l => l.name), SPEC.map(r => r[0]), 'the layers, in the spec order');
  for (const [name, aci, types] of SPEC) {
    assert.equal(ACI[name], aci, name);
    for (const t of types) assert.equal(layerOf(t), name, t);
  }
});

test('IFC4 standard cases go with their parent; the type name is matched in any case', () => {
  for (const [t, l] of [['IfcDoorStandardCase', 'IFC_DOOR'], ['IfcWindowStandardCase', 'IFC_WINDOW'], ['IfcColumnStandardCase', 'IFC_COLUMN'], ['IfcBeamStandardCase', 'IFC_BEAM'], ['IfcMemberStandardCase', 'IFC_BEAM'], ['IfcSlabStandardCase', 'IFC_SLAB'], ['IfcSlabElementedCase', 'IFC_SLAB'], ['IfcPlateStandardCase', 'IFC_CURTAINWALL'], ['IfcSystemFurnitureElement', 'IFC_FURNITURE']]) assert.equal(layerOf(t), l, t);
  assert.equal(layerOf('IFCWALLSTANDARDCASE'), 'IFC_WALL');
  assert.equal(layerOf('ifcdoor'), 'IFC_DOOR');
});

test('never drawn: openings, annotations, grids, the site and virtual elements', () => {
  for (const t of ['IfcOpeningElement', 'IfcOpeningStandardCase', 'IfcAnnotation', 'IfcGrid', 'IfcSite', 'IfcVirtualElement', 'IFCSITE']) assert.equal(layerOf(t), null, t);
});

test('a proxy under 1 mm thick in Z without a Body representation is a grid or level marker, and is dropped', () => {
  assert.equal(isMarkerProxy({ type: 'IfcBuildingElementProxy', zSpan: 0.0005, hasBody: false }), true);
  assert.equal(isMarkerProxy({ type: 'IfcBuildingElementProxy', zSpan: 0.0005, hasBody: true }), false, 'a Body: a real element, however thin');
  assert.equal(isMarkerProxy({ type: 'IfcBuildingElementProxy', zSpan: 0.002, hasBody: false }), false, 'thicker than 1 mm');
  assert.equal(isMarkerProxy({ type: 'IfcWall', zSpan: 0, hasBody: false }), false, 'only proxies');
  assert.equal(isMarkerProxy({ type: 'IFCBUILDINGELEMENTPROXY', zSpan: 0, hasBody: false }), true);
});

test('IFC2X3\'s IfcElectricDistributionPoint is MEP', () => {
  assert.equal(layerOf('IfcElectricDistributionPoint'), 'IFC_MEP');
});
```

Run: `node _tests/extract.mjs $PLAN _tests/ifcplan/layers.test.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 13`, `ℹ fail 1`.

- [ ] **Step 2: Write the module**

<!-- file: js/ifcplan/layers.js -->
```js
// IFC floor plans: IFC types to DXF layers and colours (spec §4). Pure: no DOM, no web-ifc.

// IFC_MEP: the distribution elements of IFC2X3 and their IFC4 subtypes. IfcSanitaryTerminal is a flow terminal
// too, but spec §4 puts it with the furniture.
const MEP = [
  'IfcDistributionElement', 'IfcDistributionFlowElement', 'IfcDistributionControlElement', 'IfcDistributionChamberElement',
  'IfcFlowSegment', 'IfcPipeSegment', 'IfcDuctSegment', 'IfcCableSegment', 'IfcCableCarrierSegment',
  'IfcFlowFitting', 'IfcPipeFitting', 'IfcDuctFitting', 'IfcCableFitting', 'IfcCableCarrierFitting', 'IfcJunctionBox',
  'IfcFlowTerminal', 'IfcAirTerminal', 'IfcAudioVisualAppliance', 'IfcCommunicationsAppliance', 'IfcElectricAppliance',
  'IfcFireSuppressionTerminal', 'IfcLamp', 'IfcLightFixture', 'IfcMedicalDevice', 'IfcOutlet', 'IfcSignal', 'IfcSpaceHeater',
  'IfcStackTerminal', 'IfcWasteTerminal', 'IfcLiquidTerminal',
  'IfcFlowController', 'IfcAirTerminalBox', 'IfcDamper', 'IfcElectricDistributionBoard', 'IfcElectricDistributionPoint',
  'IfcElectricTimeControl', 'IfcFlowMeter',
  'IfcProtectiveDevice', 'IfcSwitchingDevice', 'IfcValve',
  'IfcFlowMovingDevice', 'IfcCompressor', 'IfcFan', 'IfcPump',
  'IfcFlowStorageDevice', 'IfcElectricFlowStorageDevice', 'IfcTank',
  'IfcFlowTreatmentDevice', 'IfcDuctSilencer', 'IfcFilter', 'IfcInterceptor',
  'IfcEnergyConversionDevice', 'IfcAirToAirHeatRecovery', 'IfcBoiler', 'IfcBurner', 'IfcChiller', 'IfcCoil', 'IfcCondenser',
  'IfcCooledBeam', 'IfcCoolingTower', 'IfcElectricGenerator', 'IfcElectricMotor', 'IfcEngine', 'IfcEvaporativeCooler',
  'IfcEvaporator', 'IfcHeatExchanger', 'IfcHumidifier', 'IfcMotorConnection', 'IfcSolarDevice', 'IfcTransformer',
  'IfcTubeBundle', 'IfcUnitaryEquipment',
  'IfcActuator', 'IfcAlarm', 'IfcController', 'IfcFlowInstrument', 'IfcProtectiveDeviceTrippingUnit', 'IfcSensor',
  'IfcUnitaryControlElement',
];

// The layers in the order of spec §4 (also the legend's), each with its AutoCAD colour index and IFC types. IFC4's
// "standard case" subtypes go with their parent.
export const LAYERS = [
  { name: 'IFC_WALL', aci: 7, types: ['IfcWall', 'IfcWallStandardCase', 'IfcWallElementedCase'] },
  { name: 'IFC_DOOR', aci: 4, types: ['IfcDoor', 'IfcDoorStandardCase'] },
  { name: 'IFC_WINDOW', aci: 5, types: ['IfcWindow', 'IfcWindowStandardCase'] },
  { name: 'IFC_COLUMN', aci: 1, types: ['IfcColumn', 'IfcColumnStandardCase'] },
  { name: 'IFC_BEAM', aci: 8, types: ['IfcBeam', 'IfcBeamStandardCase', 'IfcMember', 'IfcMemberStandardCase'] },
  { name: 'IFC_SLAB', aci: 9, types: ['IfcSlab', 'IfcSlabStandardCase', 'IfcSlabElementedCase', 'IfcRoof', 'IfcCovering'] },
  { name: 'IFC_STAIR', aci: 3, types: ['IfcStair', 'IfcStairFlight', 'IfcRamp', 'IfcRampFlight'] },
  { name: 'IFC_RAILING', aci: 30, types: ['IfcRailing'] },
  { name: 'IFC_CURTAINWALL', aci: 140, types: ['IfcCurtainWall', 'IfcPlate', 'IfcPlateStandardCase'] },
  { name: 'IFC_FURNITURE', aci: 40, types: ['IfcFurnishingElement', 'IfcFurniture', 'IfcSystemFurnitureElement', 'IfcSanitaryTerminal'] },
  { name: 'IFC_MEP', aci: 6, types: MEP },
  { name: 'IFC_OTHER', aci: 8, types: ['IfcBuildingElementProxy'] },
  { name: 'IFC_SPACE', aci: 2, types: ['IfcSpace'] },
  { name: 'IFC_SPACE_TEXT', aci: 2, types: [] },
];
export const ACI = Object.fromEntries(LAYERS.map(l => [l.name, l.aci]));

// Never drawn, whatever their geometry.
const NEVER = new Set(['IFCOPENINGELEMENT', 'IFCOPENINGSTANDARDCASE', 'IFCANNOTATION', 'IFCGRID', 'IFCSITE', 'IFCVIRTUALELEMENT']);
const BY_TYPE = new Map(LAYERS.flatMap(l => l.types.map(t => [t.toUpperCase(), l.name])));

// The layer of an IFC type name (web-ifc gives 'IfcWall'; any case is accepted), or null when it is never drawn.
// Any other product with a body goes on IFC_OTHER.
export function layerOf(type) {
  const k = String(type).toUpperCase();
  if (NEVER.has(k)) return null;
  return BY_TYPE.get(k) || 'IFC_OTHER';
}

// The grid and level marker crosses some Revit exports carry as proxies: under 1 mm thick in Z, with no Body
// representation (spec §4). zSpan in metres.
export function isMarkerProxy({ type, zSpan, hasBody }) {
  return String(type).toUpperCase() === 'IFCBUILDINGELEMENTPROXY' && zSpan < 0.001 && !hasBody;
}
```

Run: `node _tests/extract.mjs $PLAN js/ifcplan/layers.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 17`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/ifcplan/layers.js _tests/ifcplan/layers.test.js
git commit -F - <<'EOF'
IFC floor plans: IFC types to layers and colours

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 5: Room labels

**Files:**
- Create: `js/ifcplan/rooms.js`
- Test: `_tests/ifcplan/rooms.test.js`

**Interfaces:**
- Produces (`js/ifcplan/rooms.js`, pure): `shoelace(pts)`, `inside(x, y, pts)`, `roomArea({ net?, gross? }, outline) → { areaM2, areaFrom: 'qto' | 'outline' | null }`, `outlineOf([{ pts, closed }]) → pts` (largest closed loop), `labelLines({ name, longName, areaM2 }) → string[]`, `labelPoint(pts, precision = 0.01) → [x, y]`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/ifcplan/rooms.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shoelace, roomArea, labelPoint, labelLines, outlineOf, inside } from '../../js/ifcplan/rooms.js';

const L = [0, 0, 10, 0, 10, 2, 2, 2, 2, 10, 0, 10];                // an L, 2 m wide arms: 36 m²

test('shoelace area, whichever way the outline runs', () => {
  assert.equal(shoelace([0, 0, 4, 0, 4, 3, 0, 3]), 12);
  assert.equal(shoelace([0, 0, 0, 3, 4, 3, 4, 0]), 12);
  assert.equal(shoelace(L), 36);
  assert.equal(shoelace([]), 0);
});

test('the area: Qto_SpaceBaseQuantities first (net, then gross), else the outline, at 2 decimals on the label', () => {
  assert.deepEqual(roomArea({ net: 43.61, gross: 44 }, L), { areaM2: 43.61, areaFrom: 'qto' });
  assert.deepEqual(roomArea({ gross: 44 }, L), { areaM2: 44, areaFrom: 'qto' });
  assert.deepEqual(roomArea({}, L), { areaM2: 36, areaFrom: 'outline' });
  assert.deepEqual(roomArea({ net: 0 }, L), { areaM2: 36, areaFrom: 'outline' }, 'a zero quantity is not an area');
  assert.deepEqual(roomArea({}, []), { areaM2: null, areaFrom: null });
  assert.deepEqual(labelLines({ name: 'Σαλόνι', longName: '', areaM2: 24.5 }), ['Σαλόνι', '24.50 m²']);
});

test('the label point lies inside the outline, also in an L-shape whose centroid is outside it', () => {
  const [x, y] = labelPoint(L);
  assert.ok(inside(x, y, L), `${x}, ${y}`);
  assert.ok(!inside(3.3, 3.3, L), 'the centroid region is outside the L');
  assert.ok(Math.min(x, y) > 1 && Math.max(x, y) < 1.3, 'in the corner of the L, over 1 m from every edge');
  const [cx, cy] = labelPoint([0, 0, 4, 0, 4, 3, 0, 3]);
  assert.ok(Math.abs(cx - 2) < 0.02 && Math.abs(cy - 1.5) < 0.02, `${cx}, ${cy}`);
});

test('Name, then LongName when both are present and differ; the area line last', () => {
  assert.deepEqual(labelLines({ name: '1.01', longName: 'Υπνοδωμάτιο', areaM2: 36.1 }), ['1.01', 'Υπνοδωμάτιο', '36.10 m²']);
  assert.deepEqual(labelLines({ name: 'Κουζίνα', longName: 'Κουζίνα', areaM2: 27.74 }), ['Κουζίνα', '27.74 m²']);
  assert.deepEqual(labelLines({ name: '', longName: 'Hall', areaM2: null }), ['Hall']);
  assert.deepEqual(labelLines({ name: ' A\r\nB ', longName: null, areaM2: 1.005 }), ['A B', '1.00 m²'], 'one line each, trimmed');
});

test('the outline is the largest closed loop of the room cut', () => {
  const loops = [{ pts: [0, 0, 1, 0, 1, 1, 0, 1], closed: true }, { pts: L, closed: true }, { pts: [0, 0, 50, 0, 50, 50], closed: false }];
  assert.deepEqual(outlineOf(loops), L);
  assert.deepEqual(outlineOf([{ pts: [0, 0, 5, 5], closed: false }]), []);
});

test('an outline area less the room\'s own holes (a column, a shaft) inside it; the quantity set wins as before', () => {
  const room = [0, 0, 10, 0, 10, 5, 0, 5], hole = [2, 2, 3, 2, 3, 3, 2, 3];
  const loops = [{ pts: room, closed: true }, { pts: hole, closed: true }, { pts: [20, 20, 21, 20, 21, 21, 20, 21], closed: true }, { pts: [4, 1, 5, 1, 5, 2], closed: false }];
  assert.deepEqual(outlineOf(loops), room);
  assert.deepEqual(roomArea({}, room, loops), { areaM2: 49, areaFrom: 'outline' });
  assert.deepEqual(labelLines({ name: 'A', areaM2: roomArea({}, room, loops).areaM2 }), ['A', '49.00 m²']);
  assert.deepEqual(roomArea({}, room), { areaM2: 50, areaFrom: 'outline' }, 'no loops: the outline alone');
  assert.deepEqual(roomArea({ net: 50 }, room, loops), { areaM2: 50, areaFrom: 'qto' });
});

test('non-finite quantities are no area; the shoelace is exact far from the origin', () => {
  assert.deepEqual(roomArea({ net: Infinity, gross: NaN }, [0, 0, 4, 0, 4, 3, 0, 3]), { areaM2: 12, areaFrom: 'outline' });
  assert.deepEqual(labelLines({ name: 'A', areaM2: Infinity }), ['A']);
  assert.deepEqual(labelLines({ name: 'A', areaM2: NaN }), ['A']);
  const far = [1000000.5, 4000000.25, 1000013, 4000000.25, 1000013, 4000004.5, 1000000.5, 4000004.5];
  assert.ok(Math.abs(shoelace(far) - 12.5 * 4.25) <= 1e-9, String(shoelace(far)));
  const hole = [1000002, 4000001, 1000003, 4000001, 1000003, 4000002, 1000002, 4000002];
  assert.ok(Math.abs(roomArea({}, far, [{ pts: far, closed: true }, { pts: hole, closed: true }]).areaM2 - 52.125) <= 1e-9);
});
```

Run: `node _tests/extract.mjs $PLAN _tests/ifcplan/rooms.test.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 17`, `ℹ fail 1`.

- [ ] **Step 2: Write the module**

<!-- file: js/ifcplan/rooms.js -->
```js
// IFC floor plans: room labels (spec §5). Pure: no DOM, no web-ifc. Outlines are [x, y, …] in metres.

// The area of a closed outline, whichever way it runs. Relative to its first point, so georeferenced coordinates
// (millions of metres) keep their precision.
export function shoelace(pts) {
  let s = 0;
  const n = pts.length, x0 = pts[0], y0 = pts[1];
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n;
    s += (pts[i] - x0) * (pts[j + 1] - y0) - (pts[j] - x0) * (pts[i + 1] - y0);
  }
  return Math.abs(s) / 2;
}

// Is (x, y) inside the outline (even-odd)?
export function inside(x, y, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// The room's own holes: the closed loops of its cut ([{ pts, closed }]) with every vertex inside the outline, such as
// a column or a shaft. The outline itself is never one: its topmost vertex is not inside it.
export function holesOf(polylines, outline) {
  const out = [];
  for (const p of polylines || []) {
    if (!p.closed || p.pts.length < 6) continue;
    let all = true;
    for (let i = 0; all && i < p.pts.length; i += 2) all = inside(p.pts[i], p.pts[i + 1], outline);
    if (all) out.push(p.pts);
  }
  return out;
}

// The room's area in m²: Qto_SpaceBaseQuantities' NetFloorArea, else its GrossFloorArea (both already in m²), else
// the outline's shoelace area less the holes among the room cut's loops. qto: { net?, gross? }.
export function roomArea(qto, outline, loops = []) {
  for (const v of [qto && qto.net, qto && qto.gross]) if (Number.isFinite(v) && v > 0) return { areaM2: v, areaFrom: 'qto' };
  if (outline && outline.length >= 6) {
    let a = shoelace(outline);
    for (const h of holesOf(loops, outline)) a -= shoelace(h);
    return { areaM2: a, areaFrom: 'outline' };
  }
  return { areaM2: null, areaFrom: null };
}

// The largest closed loop of a room's cut ([{ pts, closed }]), or [] when the cut closed none.
export function outlineOf(polylines) {
  let best = [], area = 0;
  for (const p of polylines) {
    if (!p.closed || p.pts.length < 6) continue;
    const a = shoelace(p.pts);
    if (a > area) { area = a; best = p.pts; }
  }
  return Array.from(best);
}

const oneLine = s => String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();

// The label's lines: Name, then LongName when both are present and differ (Revit puts the number in Name and the
// name in LongName), then the area, e.g. "24.50 m²".
export function labelLines({ name, longName, areaM2 }) {
  const lines = [];
  const a = oneLine(name), b = oneLine(longName);
  if (a) lines.push(a);
  if (b && b !== a) lines.push(b);
  if (Number.isFinite(areaM2)) lines.push(`${areaM2.toFixed(2)} m²`);
  return lines;
}

// Signed distance from (x, y) to the outline: positive inside.
function distance(x, y, pts) {
  let d = Infinity;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const ax = pts[j], ay = pts[j + 1], bx = pts[i], by = pts[i + 1];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
    d = Math.min(d, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return inside(x, y, pts) ? d : -d;
}

// A point well inside the outline, for the label: the pole of inaccessibility, found by refining square cells
// (the polylabel method) to within `precision` metres.
export function labelPoint(pts, precision = 0.01) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]);
    y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]);
  }
  const size = Math.min(x1 - x0, y1 - y0);
  if (!(size > 0)) return [(x0 + x1) / 2 || 0, (y0 + y1) / 2 || 0];
  const cell = (x, y, h) => { const d = distance(x, y, pts); return { x, y, h, d, max: d + h * Math.SQRT2 }; };
  // A max-heap on each cell's best possible distance.
  const heap = [];
  const push = c => {
    heap.push(c);
    for (let i = heap.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (heap[p].max >= heap[i].max) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l].max > heap[m].max) m = l;
        if (r < heap.length && heap[r].max > heap[m].max) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  for (let x = x0; x < x1; x += size) for (let y = y0; y < y1; y += size) push(cell(x + size / 2, y + size / 2, size / 2));
  let best = cell((x0 + x1) / 2, (y0 + y1) / 2, 0);
  while (heap.length) {
    const c = pop();
    if (c.d > best.d) best = c;
    if (c.max - best.d <= precision) break;              // no cell left can do better
    const h = c.h / 2;
    push(cell(c.x - h, c.y - h, h)); push(cell(c.x + h, c.y - h, h)); push(cell(c.x - h, c.y + h, h)); push(cell(c.x + h, c.y + h, h));
  }
  return [best.x, best.y];
}
```

Run: `node _tests/extract.mjs $PLAN js/ifcplan/rooms.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 22`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/ifcplan/rooms.js _tests/ifcplan/rooms.test.js
git commit -F - <<'EOF'
IFC floor plans: room labels, areas and label points

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 6: The DXF, Windows-1253 and the file names

**Files:**
- Create: `js/ifcplan/dxf.js`, `js/ifcplan/names.js`
- Create: `_tests/ifcplan/dxf-read.mjs` (a strict reader of our DXFs)
- Test: `_tests/ifcplan/dxf.test.js`, `_tests/ifcplan/names.test.js`

**Interfaces:**
- Consumes: `LAYERS` (Task 4), `forEachPolyline`, `polylineSet` (Task 3), `labelLines` (Task 5).
- Produces (`js/ifcplan/dxf.js`, pure): `UNITS` (`m`/`cm`/`mm` → `{ factor, insunits }`), `TEXT_HEIGHT_M`, `CP1253_HIGH`, `cp1253(s) → { bytes, replaced }`, `unencodable(strings) → n`, `originShift(bbox) → { x, y }`, `num(v)`, `storeyDxf({ storey, source, cutM, units, shift }) → { bytes, replaced }` where `storey` is `{ name, levelM, layers: { LAYER: packed set }, rooms: [{ name, longName, areaM2, at }] }`.
- Produces (`js/ifcplan/names.js`, pure): `stem(name)`, `safeName(s, fallback)`, `storeyFileNames(names, fallback) → ['01 …dxf', …]`, `zipName(fileName)`.
- Produces (`_tests/ifcplan/dxf-read.mjs`): `readDxf(bytes) → { crlf, padded, comments, header, layers, styles, sections, entities }`; throws on a broken structure.

- [ ] **Step 1: Write the failing tests**

<!-- file: _tests/ifcplan/dxf-read.mjs -->
```js
// Reads back the R12 DXF the IFC plans tool writes, strictly enough to catch a broken structure: group codes and
// values in pairs, the sections in order, every POLYLINE closed by a SEQEND, every VERTEX inside a POLYLINE, EOF
// last. Text is decoded from Windows-1253 (the file's $DWGCODEPAGE).
export function readDxf(bytes) {
  const text = new TextDecoder('windows-1253').decode(bytes);
  const crlf = text.includes('\r\n') && !/[^\r]\n/.test(text);
  const lines = text.split('\r\n');
  if (lines.pop() !== '') throw new Error('the file does not end with a line break');
  if (lines.length % 2) throw new Error('an odd number of lines');
  const pairs = [];
  for (let i = 0; i < lines.length; i += 2) {
    if (!/^\s*\d+$/.test(lines[i])) throw new Error(`line ${i + 1}: not a group code: ${lines[i]}`);
    pairs.push([+lines[i], lines[i + 1]]);
  }
  const out = { crlf, padded: lines.filter((_, i) => i % 2 === 0).every(c => c.length === 3), comments: [], header: {}, layers: [], styles: [], sections: [], entities: [] };
  let i = 0;
  const next = () => pairs[i++];
  while (i < pairs.length && pairs[i][0] === 999) out.comments.push(next()[1]);
  for (;;) {
    const [c, v] = next();
    if (c !== 0) throw new Error(`expected 0, got ${c}`);
    if (v === 'EOF') break;
    if (v !== 'SECTION') throw new Error(`expected SECTION, got ${v}`);
    const [c2, name] = next();
    if (c2 !== 2) throw new Error('a section without a name');
    out.sections.push(name);
    const body = [];
    for (;;) { const p = next(); if (!p) throw new Error(`${name}: no ENDSEC`); if (p[0] === 0 && p[1] === 'ENDSEC') break; body.push(p); }
    if (name === 'HEADER') {
      let key = null;
      for (const [k, val] of body) {
        if (k === 9) { key = val; out.header[key] = []; } else out.header[key].push(k === 10 || k === 20 || k === 30 ? +val : val);
      }
      for (const k of Object.keys(out.header)) if (out.header[k].length === 1) out.header[k] = out.header[k][0];
    } else if (name === 'TABLES') {
      let cur = null;
      for (const [k, val] of body) {
        if (k === 0) { cur = val === 'LAYER' ? { name: null, color: null } : val === 'STYLE' ? { style: true } : null; if (cur && !cur.style) out.layers.push(cur); if (cur && cur.style) out.styles.push(cur); continue; }
        if (!cur) continue;
        if (cur.style) { if (k === 2) cur.name = val; if (k === 42) cur.height = +val; } else if (k === 2) cur.name = val; else if (k === 62) cur.color = +val;
      }
    } else if (name === 'ENTITIES') {
      let poly = null, ent = null;
      for (const [k, val] of body) {
        if (k === 0) {
          if (val === 'VERTEX') { if (!poly) throw new Error('a VERTEX outside a POLYLINE'); ent = { v: true }; poly.pts.push(ent); continue; }
          if (val === 'SEQEND') { if (!poly) throw new Error('a SEQEND without a POLYLINE'); poly.pts = poly.pts.flatMap(p => [p.x, p.y]); poly = null; ent = null; continue; }
          if (poly) throw new Error(`${val} inside a POLYLINE`);
          if (val === 'POLYLINE') { poly = { type: 'POLYLINE', layer: null, closed: false, pts: [] }; out.entities.push(poly); ent = poly; continue; }
          if (val === 'TEXT') { ent = { type: 'TEXT' }; out.entities.push(ent); continue; }
          throw new Error(`unexpected entity ${val}`);
        }
        if (!ent) continue;
        if (ent.v) { if (k === 10) ent.x = +val; if (k === 20) ent.y = +val; continue; }
        if (k === 8) ent.layer = val;
        if (ent.type === 'POLYLINE' && k === 70) ent.closed = (+val & 1) === 1;
        if (ent.type === 'TEXT') {
          if (k === 10) ent.x = +val; if (k === 20) ent.y = +val; if (k === 40) ent.h = +val; if (k === 1) ent.text = val;
          if (k === 72) ent.h72 = +val; if (k === 73) ent.v73 = +val; if (k === 11) ent.ax = +val; if (k === 21) ent.ay = +val;
        }
      }
      if (poly) throw new Error('a POLYLINE without its SEQEND');
    }
  }
  if (i !== pairs.length) throw new Error('data after EOF');
  return out;
}
```

<!-- file: _tests/ifcplan/dxf.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storeyDxf, cp1253, unencodable, originShift, num, UNITS, CP1253_HIGH } from '../../js/ifcplan/dxf.js';
import { polylineSet } from '../../js/ifcplan/chain.js';
import { readDxf } from './dxf-read.mjs';

function storey() {
  const walls = polylineSet();
  walls.add([120.5, 80.25, 130.5, 80.25, 130.5, 80.5, 120.5, 80.5], true);
  const door = polylineSet();
  door.add([122, 80.35, 122.9, 80.35], false);
  return {
    name: 'Ισόγειο', levelM: 0,
    layers: { IFC_WALL: walls.pack(), IFC_DOOR: door.pack(), IFC_WINDOW: polylineSet().pack() },
    rooms: [{ name: 'Σαλόνι', longName: '', areaM2: 43.61, at: [123, 84] }],
  };
}
const write = (opts = {}) => storeyDxf({ storey: storey(), source: 'example-house.ifc', cutM: 1.1, units: 'm', ...opts });

test('the R12 structure parses back: header, layer table, polylines, text', () => {
  const { bytes, replaced } = write();
  assert.equal(replaced, 0);
  const d = readDxf(bytes);
  assert.ok(d.crlf && d.padded, 'CRLF and 3-character group codes');
  assert.deepEqual(d.sections, ['HEADER', 'TABLES', 'ENTITIES']);
  assert.equal(d.header.$ACADVER, 'AC1009');
  assert.equal(d.header.$DWGCODEPAGE, 'ANSI_1253');
  assert.deepEqual(d.layers.map(l => [l.name, l.color]), [['0', 7], ['IFC_WALL', 7], ['IFC_DOOR', 4], ['IFC_WINDOW', 5], ['IFC_COLUMN', 1], ['IFC_BEAM', 8], ['IFC_SLAB', 9], ['IFC_STAIR', 3], ['IFC_RAILING', 30], ['IFC_CURTAINWALL', 140], ['IFC_FURNITURE', 40], ['IFC_MEP', 6], ['IFC_OTHER', 8], ['IFC_SPACE', 2], ['IFC_SPACE_TEXT', 2]]);
  assert.deepEqual(d.entities.map(e => [e.type, e.layer, e.closed]), [['POLYLINE', 'IFC_WALL', true], ['POLYLINE', 'IFC_DOOR', false], ['TEXT', 'IFC_SPACE_TEXT', undefined], ['TEXT', 'IFC_SPACE_TEXT', undefined]]);
  assert.deepEqual(d.entities[0].pts, [120.5, 80.25, 130.5, 80.25, 130.5, 80.5, 120.5, 80.5]);
  assert.deepEqual(d.header.$EXTMIN, [120.5, 80.25, 0]);
  assert.deepEqual(d.header.$EXTMAX, [130.5, 84.16, 0]);
  const [a, b] = d.entities.slice(2);
  assert.deepEqual([a.text, a.x, a.y, a.h, a.h72, a.v73, a.ax, a.ay], ['Σαλόνι', 123, 84.16, 0.2, 1, 2, 123, 84.16]);
  assert.deepEqual([b.text, b.y], ['43.61 m²', 83.84]);
});

test('$INSUNITS is 6, 5 and 4 for m, cm and mm, with the coordinates and the text height scaled', () => {
  for (const [units, code, k] of [['m', '6', 1], ['cm', '5', 100], ['mm', '4', 1000]]) {
    const d = readDxf(write({ units }).bytes);
    assert.equal(d.header.$INSUNITS, code, units);
    assert.equal(UNITS[units].factor, k);
    assert.deepEqual(d.entities[0].pts.slice(0, 2), [num(120.5 * k), num(80.25 * k)].map(Number), units);
    assert.equal(d.entities[2].h, 0.2 * k, units);
    assert.ok(d.comments.includes(`Units: ${units}`));
  }
});

test('Greek text round-trips through Windows-1253; a character outside it becomes ? and is counted', () => {
  for (let b = 0x80; b <= 0xff; b++) {
    const c = CP1253_HIGH[b - 0x80];
    if (c !== '�') assert.equal(new TextDecoder('windows-1253').decode(Uint8Array.of(b)), c, b.toString(16));
  }
  const all = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρσςτυφχψωάέήίόύώΆΈΉΊΌΎΏϊϋΐΰ m² €';
  const { bytes, replaced } = cp1253(all);
  assert.equal(replaced, 0);
  assert.equal(new TextDecoder('windows-1253').decode(bytes), all);
  assert.deepEqual([...cp1253('Ω−ŝ✓').bytes], [0xd9, 0x3f, 0x3f, 0x3f]);
  assert.equal(cp1253('Ω−ŝ✓').replaced, 3);
  assert.equal(unencodable(['Σαλόνι', 'Hall − 2', null, 'Küche']), 2);
  const s = storey();
  s.rooms[0].name = 'Σαλόνι ✓';
  const out = storeyDxf({ storey: s, source: 'σπίτι.ifc', cutM: 1.1 });
  assert.equal(out.replaced, 1);
  const d = readDxf(out.bytes);
  assert.equal(d.entities[2].text, 'Σαλόνι ?');
  assert.ok(d.comments.includes('Source: σπίτι.ifc'));
});

test('the comment block names the file, the storey, the cut, the units and the shift', () => {
  const shift = originShift({ x0: 120.5, y0: 80.25, x1: 131, y1: 90 });
  assert.deepEqual(shift, { x: 120, y: 80 });
  assert.deepEqual(originShift({ x0: -0.5, y0: 3, x1: 1, y1: 4 }), { x: -1, y: 3 }, 'rounded down, also below zero');
  const d = readDxf(write({ units: 'mm', shift }).bytes);
  assert.deepEqual(d.comments, [
    'IFC floor plan from aidedcam.com/ifc-plans.html',
    'Source: example-house.ifc',
    'Storey: Ισόγειο, level 0.000 m',
    'Cut: 1.10 m above the storey level, at 1.100 m',
    'Units: mm',
    "Shift: X -120000 mm, Y -80000 mm; add it back to return to the IFC's coordinates",
  ]);
  assert.deepEqual(d.entities[0].pts.slice(0, 4), [500, 250, 10500, 250]);
  assert.equal(readDxf(write().bytes).comments[5], "Shift: none; the IFC's coordinates");
});

test('an empty layer or an empty storey still gives a whole file, with no POLYLINE or TEXT left open', () => {
  const s = { name: 'Δώμα', levelM: 9, layers: { IFC_WALL: polylineSet().pack() }, rooms: [] };
  const d = readDxf(storeyDxf({ storey: s, source: 'x.ifc', cutM: 1.1 }).bytes);
  assert.deepEqual(d.sections, ['HEADER', 'TABLES', 'ENTITIES']);
  assert.deepEqual(d.entities, []);
  assert.deepEqual([d.header.$EXTMIN, d.header.$EXTMAX], [[0, 0, 0], [0, 0, 0]]);
  const one = polylineSet();
  one.add([1, 1], false);
  const e = readDxf(storeyDxf({ storey: { name: 'x', levelM: 0, layers: { IFC_WALL: one.pack() }, rooms: [{ name: 'A', areaM2: null, at: null }] }, source: 'x.ifc', cutM: 1.1 }).bytes);
  assert.deepEqual(e.entities, [], 'a one-point polyline and a room without a label point are skipped');
});

test('numbers: at most 6 decimals, always a decimal point, never -0', () => {
  assert.deepEqual([num(1), num(-0), num(0.1 + 0.2), num(538512000), num(-1.23456789), num(1e-9)], ['1.0', '0.0', '0.3', '538512000.0', '-1.234568', '0.0']);
});

test('numbers: NaN and Infinity are never written', () => {
  assert.deepEqual([num(NaN), num(Infinity), num(-Infinity)], ['0.0', '0.0', '0.0']);
});

test('Greek in decomposed form (NFD) or with the polytonic acute is composed first, so it is encodable', () => {
  const nfd = 'Σαλόνι'.normalize('NFD');
  assert.notEqual(nfd, 'Σαλόνι');
  assert.deepEqual(cp1253(nfd), cp1253('Σαλόνι'));
  assert.deepEqual([...cp1253('ά').bytes], [0xdc], 'U+1F71 is ά (U+03AC)');
  assert.equal(cp1253('ά').replaced, 0);
  assert.equal(unencodable([nfd, 'ά', 'Κουζίνα'.normalize('NFD')]), 0);
});
```

<!-- file: _tests/ifcplan/names.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storeyFileNames, safeName, stem, zipName } from '../../js/ifcplan/names.js';

test('storey files: "NN <storey name>.dxf" in level order, Greek names kept', () => {
  assert.deepEqual(storeyFileNames(['Ισόγειο', 'Όροφος 1'], 'Storey'), ['01 Ισόγειο.dxf', '02 Όροφος 1.dxf']);
  assert.equal(storeyFileNames(Array.from({ length: 120 }, (_, i) => `L${i}`), 'x')[119], '120 L119.dxf', 'NN widens past 99');
});

test('characters Windows forbids become _, and trailing dots and spaces go', () => {
  assert.equal(safeName('Level 1: "A/B" <x>|y?*', 'Storey'), 'Level 1_ _A_B_ _x__y__');
  assert.equal(safeName('  +3.20 ..  ', 'Storey'), '+3.20');
  assert.equal(safeName('a\tb\nc', 'Storey'), 'a b c');
  assert.equal(safeName('', 'Storey'), 'Storey');
  assert.equal(safeName('...', 'Όροφος'), 'Όροφος');
  assert.equal(safeName('x'.repeat(150), 'S').length, 100);
});

test('a storey name used twice is numbered, ignoring case; an empty one takes the fallback', () => {
  assert.deepEqual(storeyFileNames(['Level 1', 'level 1', 'LEVEL 1', ''], 'Storey'), ['01 Level 1.dxf', '02 level 1 (2).dxf', '03 LEVEL 1 (3).dxf', '04 Storey.dxf']);
});

test('the ZIP is named after the IFC', () => {
  assert.equal(stem('Σπίτι Α.ifc'), 'Σπίτι Α');
  assert.equal(stem('noext'), 'noext');
  assert.equal(zipName('Σπίτι Α.ifc'), 'Σπίτι Α-dxf.zip');
  assert.equal(zipName('a:b.ifc'), 'a_b-dxf.zip');
});
```

Run:
```bash
for f in _tests/ifcplan/dxf-read.mjs _tests/ifcplan/dxf.test.js _tests/ifcplan/names.test.js; do node _tests/extract.mjs $PLAN $f; done
node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
```
Expected: `ℹ pass 22`, `ℹ fail 2` (both modules are missing).

- [ ] **Step 2: Write the modules**

<!-- file: js/ifcplan/dxf.js -->
```js
// IFC floor plans: one storey's plan as an R12 DXF (spec §5). Pure: no DOM, no web-ifc.
// AC1009 under $DWGCODEPAGE ANSI_1253, so Greek text is written as Windows-1253 bytes; POLYLINE/VERTEX/SEQEND (no
// LWPOLYLINE in R12) and TEXT; every layer of spec §4 in the table, whether or not this storey uses it.
import { LAYERS } from './layers.js?v=20261101';
import { forEachPolyline } from './chain.js?v=20261101';
import { labelLines } from './rooms.js?v=20261101';

// The drawing units the visitor chooses: the factor from metres and the $INSUNITS code.
export const UNITS = { m: { factor: 1, insunits: 6 }, cm: { factor: 100, insunits: 5 }, mm: { factor: 1000, insunits: 4 } };
export const TEXT_HEIGHT_M = 0.2;          // room labels, in metres of the model (200 in mm, 20 in cm)
const LINE_STEP = 1.6;                     // the labels' line spacing, in text heights

// Windows-1253, bytes 0x80–0xFF (U+FFFD where the code page has no character).
const HIGH = '€�‚ƒ„…†‡�‰�‹�����‘’“”•–—�™�›����' +
  ' ΅Ά£¤¥¦§¨©�«¬­®―°±²³΄µ¶·ΈΉΊ»Ό½ΎΏ' +
  'ΐΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡ�ΣΤΥΦΧΨΩΪΫάέήί' +
  'ΰαβγδεζηθικλμνξοπρςστυφχψωϊϋόύώ�';
const TO_1253 = new Map([...HIGH].map((c, i) => [c, 0x80 + i]).filter(([c]) => c !== '�'));
export const CP1253_HIGH = HIGH;

// A string as Windows-1253 bytes, composed first (NFC), so decomposed Greek and the polytonic acute (U+1F71 → ά)
// are written. A character the code page lacks becomes '?', and is counted.
export function cp1253(s) {
  const out = [];
  let replaced = 0;
  for (const ch of String(s).normalize('NFC')) {
    const c = ch.codePointAt(0);
    if (c < 0x80) { out.push(c); continue; }
    const b = TO_1253.get(ch);
    if (b === undefined) { out.push(0x3f); replaced++; } else out.push(b);
  }
  return { bytes: Uint8Array.from(out), replaced };
}

// How many characters of these strings Windows-1253 can't hold, once composed as cp1253 composes them.
export function unencodable(strings) {
  let n = 0;
  for (const s of strings) for (const ch of String(s == null ? '' : s).normalize('NFC')) if (ch.codePointAt(0) >= 0x80 && !TO_1253.has(ch)) n++;
  return n;
}

// "Move to origin": the model's lower-left corner, rounded down to whole metres.
export function originShift(bbox) {
  return { x: Math.floor(bbox.x0), y: Math.floor(bbox.y0) };
}

// A real: at most 6 decimals, always with a decimal point, never "-0", never NaN or Infinity (written 0).
export function num(v) {
  if (!Number.isFinite(v)) return '0.0';
  let s = String(+v.toFixed(6));
  if (s === '-0') s = '0';
  return /[.e]/.test(s) ? s : `${s}.0`;
}

const line = s => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ');
const fmtM = (v, d) => (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d);

// The plan of one storey. storey: { name, levelM, layers: { LAYER: packed polylines }, rooms: [{ name, longName,
// areaM2, at: [x, y] }] }, in metres in the IFC's coordinates. source: the IFC file name; units: 'm' | 'cm' | 'mm';
// shift: null, or { x, y } in metres subtracted from every coordinate. Returns { bytes, replaced }.
export function storeyDxf({ storey, source, cutM, units = 'm', shift = null }) {
  const u = UNITS[units] || UNITS.m;
  const f = u.factor, sx = shift ? shift.x : 0, sy = shift ? shift.y : 0;
  const X = x => (x - sx) * f, Y = y => (y - sy) * f;
  const out = [];
  const g = (code, value) => { out.push(String(code).padStart(3), value); };
  const unit = units in UNITS ? units : 'm';
  g(999, `IFC floor plan from aidedcam.com/ifc-plans.html`);
  g(999, `Source: ${line(source)}`);
  g(999, `Storey: ${line(storey.name)}, level ${fmtM(storey.levelM, 3)} m`);
  g(999, `Cut: ${fmtM(cutM, 2)} m above the storey level, at ${fmtM(storey.levelM + cutM, 3)} m`);
  g(999, `Units: ${unit}`);
  g(999, shift
    ? `Shift: X ${String(-sx * f)} ${unit}, Y ${String(-sy * f)} ${unit}; add it back to return to the IFC's coordinates`
    : `Shift: none; the IFC's coordinates`);

  // Entities first, to know the extents.
  const ents = [];
  const e = (code, value) => { ents.push(String(code).padStart(3), value); };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const extend = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
  for (const l of LAYERS) {
    const set = storey.layers && storey.layers[l.name];
    if (!set) continue;
    forEachPolyline(set, (pts, closed) => {
      if (pts.length < 4) return;
      e(0, 'POLYLINE'); e(8, l.name); e(66, '1'); e(10, '0.0'); e(20, '0.0'); e(30, '0.0'); e(70, closed ? '1' : '0');
      for (let i = 0; i < pts.length; i += 2) {
        const x = X(pts[i]), y = Y(pts[i + 1]);
        extend(x, y);
        e(0, 'VERTEX'); e(8, l.name); e(10, num(x)); e(20, num(y)); e(30, '0.0');
      }
      e(0, 'SEQEND'); e(8, l.name);
    });
  }
  const h = TEXT_HEIGHT_M * f;
  const texts = [];
  for (const r of storey.rooms || []) {
    if (!r.at) continue;
    const lines = labelLines(r);
    lines.forEach((t, i) => {
      const x = X(r.at[0]), y = Y(r.at[1]) + ((lines.length - 1) / 2 - i) * LINE_STEP * h;
      extend(x, y);
      texts.push(t);
      e(0, 'TEXT'); e(8, 'IFC_SPACE_TEXT'); e(10, num(x)); e(20, num(y)); e(30, '0.0'); e(40, num(h)); e(1, line(t));
      e(72, '1'); e(73, '2'); e(11, num(x)); e(21, num(y)); e(31, '0.0');
    });
  }
  if (x0 > x1) x0 = y0 = x1 = y1 = 0;

  g(0, 'SECTION'); g(2, 'HEADER');
  g(9, '$ACADVER'); g(1, 'AC1009');
  g(9, '$DWGCODEPAGE'); g(3, 'ANSI_1253');
  g(9, '$INSUNITS'); g(70, String(u.insunits));
  g(9, '$EXTMIN'); g(10, num(x0)); g(20, num(y0)); g(30, '0.0');
  g(9, '$EXTMAX'); g(10, num(x1)); g(20, num(y1)); g(30, '0.0');
  g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'TABLES');
  g(0, 'TABLE'); g(2, 'LTYPE'); g(70, '1');
  g(0, 'LTYPE'); g(2, 'CONTINUOUS'); g(70, '0'); g(3, 'Solid line'); g(72, '65'); g(73, '0'); g(40, '0.0');
  g(0, 'ENDTAB');
  g(0, 'TABLE'); g(2, 'LAYER'); g(70, String(LAYERS.length + 1));
  for (const l of [{ name: '0', aci: 7 }, ...LAYERS]) { g(0, 'LAYER'); g(2, l.name); g(70, '0'); g(62, String(l.aci)); g(6, 'CONTINUOUS'); }
  g(0, 'ENDTAB');
  g(0, 'TABLE'); g(2, 'STYLE'); g(70, '1');
  g(0, 'STYLE'); g(2, 'STANDARD'); g(70, '0'); g(40, '0.0'); g(41, '1.0'); g(50, '0.0'); g(71, '0'); g(42, num(h)); g(3, 'arial.ttf'); g(4, '');
  g(0, 'ENDTAB');
  g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'ENTITIES');
  for (const v of ents) out.push(v);
  g(0, 'ENDSEC');
  g(0, 'EOF');
  return cp1253(out.join('\r\n') + '\r\n');
}
```

<!-- file: js/ifcplan/names.js -->
```js
// IFC floor plans: the file names of the plans (spec §3). Pure: no DOM, no web-ifc.

// The name without its extension.
export const stem = name => String(name).replace(/\.[^./\\]*$/, '') || String(name);

// A name Windows accepts: runs of white space become one space, the characters Windows forbids (< > : " / \ | ? *
// and control characters) become '_', trailing dots and spaces go, and it is kept to 100 characters.
export function safeName(s, fallback) {
  const out = String(s == null ? '' : s)
    .replace(/\s+/g, ' ')
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_')
    .trim()
    .slice(0, 100)
    .replace(/[. ]+$/, '');
  return out || fallback;
}

// One DXF name per storey, in level order: "NN <storey name>.dxf", NN from 01. A storey name used twice (in any case)
// gets " (2)", " (3)" …; an empty one becomes the fallback.
export function storeyFileNames(names, fallback) {
  const width = Math.max(2, String(names.length).length);
  const seen = new Map();
  return names.map((n, i) => {
    let base = safeName(n, fallback);
    const key = base.toLowerCase();
    const k = (seen.get(key) || 0) + 1;
    seen.set(key, k);
    if (k > 1) base = `${base} (${k})`;
    return `${String(i + 1).padStart(width, '0')} ${base}.dxf`;
  });
}

// The ZIP of every storey: "<IFC name>-dxf.zip".
export const zipName = fileName => `${safeName(stem(fileName), 'plans')}-dxf.zip`;
```

Run: `node _tests/extract.mjs $PLAN js/ifcplan/dxf.js && node _tests/extract.mjs $PLAN js/ifcplan/names.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 32`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/ifcplan/dxf.js js/ifcplan/names.js _tests/ifcplan/dxf-read.mjs _tests/ifcplan/dxf.test.js _tests/ifcplan/names.test.js
git commit -F - <<'EOF'
IFC floor plans: the R12 DXF writer, Windows-1253 text and the file names

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 7: The example house and its generator

**Files:**
- Create: `_tests/ifcplan/step.mjs` (STEP writer; small test models for Tasks 8–9)
- Create: `_tests/ifcplan/make-example.mjs`
- Create (generated): `js/ifcplan/examples/example-house.ifc`
- Test: `_tests/ifcplan/examples.test.js`

**Interfaces:**
- Consumes: `openApi` (Task 1).
- Produces (`_tests/ifcplan/step.mjs`): `E(v)`, `I(n)`, `stepFile(prefix) → { add(type, ...args) → '#n', guid(), text({ name, schema, app }) }`, `startModel(f, { length, project }) → { pt, dir, origin, zUp, axis0, body, project, place, shape, boxSolid }`, `smallModel({ length, buildingZ, storeys, elements, name }) → IFC text`.
- Produces (the example, spec §10): IFC4, mm, site at (120.50, 80.25) m. Storeys `Ισόγειο` (0.00) and `Όροφος 1` (3.00); 10 walls, 3 openings, 1 door, 2 windows, 1 column, 1 stair flight, 1 railing, 3 slabs (base, floor with the stair's void, roof); rooms `Σαλόνι` (Qto: gross 43.70, net 43.61), `Κουζίνα`, `1.01`/`Υπνοδωμάτιο`. 19 meshed elements.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/ifcplan/examples.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { openApi } from './webifc-node.mjs';

const FILE = new URL('../../js/ifcplan/examples/example-house.ifc', import.meta.url);

test('the generator is deterministic: --check finds the committed example byte-identical', () => {
  const out = execFileSync(process.execPath, ['_tests/ifcplan/make-example.mjs', '--check'], { encoding: 'utf8' });
  assert.equal(out.trim(), 'same js/ifcplan/examples/example-house.ifc');
});

test('the example is IFC4 STEP text in plain ASCII, its Greek names encoded as \\X2\\, its GlobalIds unique', () => {
  const text = readFileSync(FILE, 'latin1');
  assert.ok(text.startsWith('ISO-10303-21;\nHEADER;\n'));
  assert.ok(text.includes("FILE_SCHEMA(('IFC4'));"));
  assert.ok(text.endsWith('END-ISO-10303-21;\n'));
  assert.ok(!/[^\x0a\x20-\x7e]/.test(text), 'ASCII only, LF line ends');
  assert.ok(text.includes("IFCSPACE('1AidedCAMexample"), 'rooms');
  assert.ok(text.includes(String.raw`'\X2\03A303B103BB03CC03BD03B9\X0\'`), 'Σαλόνι');
  const ids = [...text.matchAll(/^#\d+=IFC\w+\('([0-9A-Za-z_$]{22})'/gm)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  assert.ok(ids.length >= 40, `${ids.length} GlobalIds`);
  assert.ok(ids.every(g => /^[0-3]/.test(g)), 'a GlobalId starts with 0–3');
});

test('web-ifc reads the example: two storeys, the elements of spec §10 and the three rooms', async () => {
  const { api, W } = await openApi();
  const id = api.OpenModel(new Uint8Array(readFileSync(FILE)), { COORDINATE_TO_ORIGIN: false });
  assert.equal(api.GetModelSchema(id), 'IFC4');
  const count = t => api.GetLineIDsWithType(id, W[t]).size();
  assert.deepEqual(['IFCBUILDINGSTOREY', 'IFCWALL', 'IFCOPENINGELEMENT', 'IFCDOOR', 'IFCWINDOW', 'IFCCOLUMN', 'IFCSTAIRFLIGHT', 'IFCRAILING', 'IFCSLAB', 'IFCSPACE', 'IFCELEMENTQUANTITY'].map(count), [2, 10, 3, 1, 2, 1, 1, 1, 3, 3, 1]);
  const names = t => { const ids = api.GetLineIDsWithType(id, W[t]), out = []; for (let i = 0; i < ids.size(); i++) out.push(api.GetLine(id, ids.get(i)).Name.value); return out; };
  assert.deepEqual(names('IFCBUILDINGSTOREY'), ['Ισόγειο', 'Όροφος 1']);
  assert.deepEqual(names('IFCSPACE'), ['Σαλόνι', 'Κουζίνα', '1.01']);
  let meshes = 0;
  api.StreamAllMeshes(id, () => meshes++);
  assert.equal(meshes, 19, 'every element but the openings and the rooms');
  api.CloseModel(id);
});
```

Run: `node _tests/extract.mjs $PLAN _tests/ifcplan/examples.test.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 32`, `ℹ fail 3` (no generator, no example).

- [ ] **Step 2: Write the generator, and generate the example**

<!-- file: _tests/ifcplan/step.mjs -->
```js
// A minimal IFC (STEP physical file) writer, for the example generator and the tests' small models.
// Numbers are REALs (always with a decimal point); I(n) is an INTEGER, E('X') an enumeration .X., { raw } is written
// as it is, null is $, '*' is *, '#n' a reference, any other string an IFC string (' and \ doubled, non-ASCII as
// \X2\…\X0\).

export const E = v => ({ enum: v });
export const I = v => ({ int: v });

function str(s) {
  let out = '', wide = '';
  const flush = () => { if (wide) { out += `\\X2\\${wide}\\X0\\`; wide = ''; } };
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c >= 0x20 && c < 0x7f) { flush(); out += ch === "'" ? "''" : ch === '\\' ? '\\\\' : ch; } else wide += c.toString(16).toUpperCase().padStart(4, '0');
  }
  flush();
  return `'${out}'`;
}
function real(v) {
  const s = String(+v.toFixed(6));
  return s.includes('.') || s.includes('e') ? s : `${s}.`;
}
function arg(a) {
  if (a === null || a === undefined) return '$';
  if (a === '*') return '*';
  if (typeof a === 'number') return real(a);
  if (typeof a === 'string') return a.startsWith('#') ? a : str(a);
  if (Array.isArray(a)) return `(${a.map(arg).join(',')})`;
  if ('enum' in a) return `.${a.enum}.`;
  if ('int' in a) return String(a.int);
  if ('raw' in a) return a.raw;
  throw new Error(`bad argument ${JSON.stringify(a)}`);
}

// GlobalIds: 22 characters of the IFC base-64 alphabet, numbered after a fixed 16-character prefix.
const B64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';

export function stepFile(prefix = '1AidedCAMexample') {
  const lines = [];
  let guids = 0;
  const f = {
    add(type, ...args) {
      lines.push(`#${lines.length + 1}=${type}(${args.map(arg).join(',')});`);
      return `#${lines.length}`;
    },
    guid() {
      let n = ++guids, s = '';
      while (n) { s = B64[n % 64] + s; n = Math.floor(n / 64); }
      return `${prefix}${s.padStart(6, '0')}`;
    },
    text({ name, schema = 'IFC4', app = 'AidedCAM example generator' }) {
      return [
        'ISO-10303-21;',
        'HEADER;',
        "FILE_DESCRIPTION(('ViewDefinition [ReferenceView_V1.2]'),'2;1');",
        `FILE_NAME('${name}','2026-10-01T00:00:00',('AidedCAM'),('AidedCAM'),'','${app}','');`,
        `FILE_SCHEMA(('${schema}'));`,
        'ENDSEC;',
        'DATA;',
        ...lines,
        'ENDSEC;',
        'END-ISO-10303-21;',
        '',
      ].join('\n');
    },
  };
  return f;
}

// The pieces every model needs, written in this order: origin, Z axis, the identity placement, the units, the
// contexts and the project. length: { prefix: 'MILLI' | 'CENTI' | null } for SI metres, or { foot: true }.
export function startModel(f, { length = { prefix: 'MILLI' }, project = 'AidedCAM example house' } = {}) {
  const { add } = f;
  const pt = (x, y, z) => add('IFCCARTESIANPOINT', z === undefined ? [x, y] : [x, y, z]);
  const dir = v => add('IFCDIRECTION', v);
  const origin = pt(0, 0, 0);
  const zUp = dir([0, 0, 1]);
  const axis0 = add('IFCAXIS2PLACEMENT3D', origin, null, null);
  let lengthUnit;
  if (length.foot) {
    const metre = add('IFCSIUNIT', '*', E('LENGTHUNIT'), null, E('METRE'));
    const dims = add('IFCDIMENSIONALEXPONENTS', I(1), I(0), I(0), I(0), I(0), I(0), I(0));
    lengthUnit = add('IFCCONVERSIONBASEDUNIT', dims, E('LENGTHUNIT'), 'FOOT', add('IFCMEASUREWITHUNIT', { raw: 'IFCLENGTHMEASURE(0.3048)' }, metre));
  } else lengthUnit = add('IFCSIUNIT', '*', E('LENGTHUNIT'), length.prefix ? E(length.prefix) : null, E('METRE'));
  const units = add('IFCUNITASSIGNMENT', [
    lengthUnit,
    add('IFCSIUNIT', '*', E('AREAUNIT'), null, E('SQUARE_METRE')),
    add('IFCSIUNIT', '*', E('VOLUMEUNIT'), null, E('CUBIC_METRE')),
    add('IFCSIUNIT', '*', E('PLANEANGLEUNIT'), null, E('RADIAN')),
  ]);
  const context = add('IFCGEOMETRICREPRESENTATIONCONTEXT', null, 'Model', I(3), 1e-5, axis0, null);
  const body = add('IFCGEOMETRICREPRESENTATIONSUBCONTEXT', 'Body', 'Model', '*', '*', '*', '*', context, null, E('MODEL_VIEW'), null);
  const proj = add('IFCPROJECT', f.guid(), null, project, null, null, null, null, [context], units);
  const place = (relTo, x, y, z) => add('IFCLOCALPLACEMENT', relTo, add('IFCAXIS2PLACEMENT3D', pt(x, y, z), null, null));
  const shape = (item, ident = 'Body') => add('IFCPRODUCTDEFINITIONSHAPE', null, null, [add('IFCSHAPEREPRESENTATION', body, ident, 'SweptSolid', [item])]);
  // A box from (0, 0, 0) to (w, d, h) in its placement.
  const boxSolid = (w, d, h) => add('IFCEXTRUDEDAREASOLID',
    add('IFCRECTANGLEPROFILEDEF', E('AREA'), null, add('IFCAXIS2PLACEMENT2D', pt(w / 2, d / 2), null), w, d), axis0, zUp, h);
  return { pt, dir, origin, zUp, axis0, body, project: proj, place, shape, boxSolid };
}

// A small model for the tests: storeys [{ name, z, elevation }] under a building placed at buildingZ, and elements
// [{ storey: index, or -1 for the building itself; type: 'IFCWALL' …; box: [x0, y0, z0, x1, y1, z1] in the model's
// units; ident: the representation's identifier, 'Body' by default; solid: a ready-made solid instead of the box }].
export function smallModel({ length, buildingZ = 0, storeys = [], elements = [], name = 'small.ifc' } = {}) {
  const f = stepFile('0TestTestTestTest');
  const { add, guid } = f;
  const m = startModel(f, { length, project: 'Test' });
  const bp = m.place(null, 0, 0, buildingZ);
  const building = add('IFCBUILDING', guid(), null, 'B', null, null, bp, null, null, E('ELEMENT'), null, null, null);
  add('IFCRELAGGREGATES', guid(), null, null, null, m.project, [building]);
  const st = storeys.map(s => {
    const p = m.place(bp, 0, 0, s.z);
    return { place: p, ref: add('IFCBUILDINGSTOREY', guid(), null, s.name, null, null, p, null, null, E('ELEMENT'), s.elevation ?? s.z), elements: [] };
  });
  if (st.length) add('IFCRELAGGREGATES', guid(), null, null, null, building, st.map(s => s.ref));
  const inBuilding = [];
  for (const e of elements) {
    const host = e.storey >= 0 ? st[e.storey] : { place: bp, elements: inBuilding };
    const [x0, y0, z0, x1, y1, z1] = e.box;
    const solid = e.solid ? e.solid(m, add) : m.boxSolid(x1 - x0, y1 - y0, z1 - z0);
    host.elements.push(add(e.type || 'IFCWALL', guid(), null, e.name || 'E', null, null, m.place(host.place, x0, y0, z0), m.shape(solid, e.ident || 'Body'), null, null));
  }
  for (const s of st) if (s.elements.length) add('IFCRELCONTAINEDINSPATIALSTRUCTURE', guid(), null, null, null, s.elements, s.ref);
  if (inBuilding.length) add('IFCRELCONTAINEDINSPATIALSTRUCTURE', guid(), null, null, null, inBuilding, building);
  return f.text({ name });
}
```

<!-- file: _tests/ifcplan/make-example.mjs -->
```js
// Writes the IFC floor-plans tool's example model, js/ifcplan/examples/example-house.ifc (spec §10): a synthetic IFC4
// house of our own, so no third-party licence applies. Deterministic: the same bytes on every run.
//   node _tests/ifcplan/make-example.mjs           write the file
//   node _tests/ifcplan/make-example.mjs --check   compare with the committed file (exit 1 if it differs)
// Run from the repo root. Lengths in millimetres (as most exports), areas in m².
//
// The house, 10.00 × 8.10 m, its site placed at (120.50, 80.25) m so that "move to origin" has a shift to show:
//   Ισόγειο (level 0.00): 250 mm outer walls, an inner wall at x 6.00–6.10, one door (south) and one window (north)
//     cut into the walls by openings, a 300 × 300 column, a stair flight rising 3.00 m over 4.00 m, the rooms
//     Σαλόνι (with Qto_SpaceBaseQuantities) and Κουζίνα.
//   Όροφος 1 (level 3.00): the floor slab with the stair's void, outer walls, an inner wall at x 5.00–5.10, one
//     window (south), a railing along the void, the room "1.01" / Υπνοδωμάτιο, and the roof slab.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { stepFile, startModel, E, I } from './step.mjs';

const OUT = 'js/ifcplan/examples/example-house.ifc';

const f = stepFile();
const { add, guid } = f;
const { pt, dir, origin, zUp, axis0, project, place, shape, boxSolid } = startModel(f);
const rectLoop = (x0, y0, x1, y1) => add('IFCPOLYLINE', [pt(x0, y0), pt(x1, y0), pt(x1, y1), pt(x0, y1), pt(x0, y0)]);

// ---- the spatial structure ----
const sitePlace = place(null, 120500, 80250, 0);
const site = add('IFCSITE', guid(), null, 'Οικόπεδο', null, null, sitePlace, null, null, E('ELEMENT'), null, null, null, null, null);
const buildingPlace = place(sitePlace, 0, 0, 0);
const building = add('IFCBUILDING', guid(), null, 'Κατοικία', null, null, buildingPlace, null, null, E('ELEMENT'), null, null, null);
add('IFCRELAGGREGATES', guid(), null, null, null, project, [site]);
add('IFCRELAGGREGATES', guid(), null, null, null, site, [building]);

const storeys = [{ name: 'Ισόγειο', level: 0 }, { name: 'Όροφος 1', level: 3000 }].map(s => {
  const p = place(buildingPlace, 0, 0, s.level);
  return { ...s, place: p, ref: add('IFCBUILDINGSTOREY', guid(), null, s.name, null, null, p, null, null, E('ELEMENT'), s.level), elements: [], spaces: [] };
});
add('IFCRELAGGREGATES', guid(), null, null, null, building, storeys.map(s => s.ref));

// ---- the elements: boxes in storey coordinates (mm) ----
function element(storey, type, name, [x0, y0, z0, x1, y1, z1], extra) {
  const p = place(storey.place, x0, y0, z0);
  const e = add(type, guid(), null, name, null, null, p, shape(boxSolid(x1 - x0, y1 - y0, z1 - z0)), ...extra);
  storey.elements.push(e);
  return { ref: e, place: p, x0, y0, z0 };
}
const wall = (s, name, b) => element(s, 'IFCWALL', name, b, [null, E('STANDARD')]);
// An opening through a wall, as a box relative to the wall's placement, filled by a door or a window.
function opening(w, [x0, y0, z0, x1, y1, z1], filler) {
  const o = add('IFCOPENINGELEMENT', guid(), null, 'Άνοιγμα', null, null, place(w.place, x0 - w.x0, y0 - w.y0, z0 - w.z0),
    shape(boxSolid(x1 - x0, y1 - y0, z1 - z0)), null, E('OPENING'));
  add('IFCRELVOIDSELEMENT', guid(), null, null, null, w.ref, o);
  add('IFCRELFILLSELEMENT', guid(), null, null, null, o, filler.ref);
}
function space(storey, name, longName, [x0, y0, z0, x1, y1, z1]) {
  const s = add('IFCSPACE', guid(), null, name, null, null, place(storey.place, x0, y0, z0), shape(boxSolid(x1 - x0, y1 - y0, z1 - z0)),
    longName, E('ELEMENT'), E('INTERNAL'), null);
  storey.spaces.push(s);
  return s;
}

const [g, f1] = storeys;
// Ισόγειο
element(g, 'IFCSLAB', 'Πλάκα ισογείου', [0, 0, -250, 10000, 8100, 0], [null, E('BASESLAB')]);
const gS = wall(g, 'Τοίχος Ν', [0, 0, 0, 10000, 250, 2750]);
const gN = wall(g, 'Τοίχος Β', [0, 7850, 0, 10000, 8100, 2750]);
wall(g, 'Τοίχος Δ', [0, 250, 0, 250, 7850, 2750]);
wall(g, 'Τοίχος Α', [9750, 250, 0, 10000, 7850, 2750]);
wall(g, 'Εσωτερικός τοίχος', [6000, 250, 0, 6100, 7850, 2750]);
opening(gS, [2000, 0, 0, 2900, 250, 2100], element(g, 'IFCDOOR', 'Πόρτα εισόδου', [2000, 100, 0, 2900, 150, 2100], [null, 2100, 900, E('DOOR'), E('SINGLE_SWING_LEFT'), null]));
opening(gN, [3000, 7850, 900, 4500, 8100, 2100], element(g, 'IFCWINDOW', 'Παράθυρο Β', [3000, 7940, 900, 4500, 8010, 2100], [null, 1200, 1500, E('WINDOW'), E('SINGLE_PANEL'), null]));
element(g, 'IFCCOLUMN', 'Υποστύλωμα', [2900, 5800, 0, 3200, 6100, 2750], [null, E('COLUMN')]);
{
  // The stair flight: its side profile (run along y, rise along z), 300 mm thick vertically, extruded 900 mm along x.
  const profile = add('IFCARBITRARYCLOSEDPROFILEDEF', E('AREA'), null,
    add('IFCPOLYLINE', [pt(0, 0), pt(4000, 3000), pt(4000, 2700), pt(400, 0), pt(0, 0)]));
  const position = add('IFCAXIS2PLACEMENT3D', origin, dir([1, 0, 0]), dir([0, 1, 0]));
  const solid = add('IFCEXTRUDEDAREASOLID', profile, position, zUp, 900);
  g.elements.push(add('IFCSTAIRFLIGHT', guid(), null, 'Σκάλα', null, null, place(g.place, 8700, 1500, 0), shape(solid), null, I(16), I(15), 187.5, 266.67, E('STRAIGHT')));
}
const salon = space(g, 'Σαλόνι', null, [250, 250, 0, 6000, 7850, 2750]);
space(g, 'Κουζίνα', null, [6100, 250, 0, 9750, 7850, 2750]);

// Όροφος 1
{
  const profile = add('IFCARBITRARYPROFILEDEFWITHVOIDS', E('AREA'), 'Πλάκα με κενό κλίμακας', rectLoop(0, 0, 10000, 8100), [rectLoop(8650, 1500, 9650, 5500)]);
  const solid = add('IFCEXTRUDEDAREASOLID', profile, axis0, zUp, 250);
  f1.elements.push(add('IFCSLAB', guid(), null, 'Πλάκα ορόφου', null, null, place(f1.place, 0, 0, -250), shape(solid), null, E('FLOOR')));
}
const fS = wall(f1, 'Τοίχος Ν', [0, 0, 0, 10000, 250, 2750]);
wall(f1, 'Τοίχος Β', [0, 7850, 0, 10000, 8100, 2750]);
wall(f1, 'Τοίχος Δ', [0, 250, 0, 250, 7850, 2750]);
wall(f1, 'Τοίχος Α', [9750, 250, 0, 10000, 7850, 2750]);
wall(f1, 'Εσωτερικός τοίχος', [5000, 250, 0, 5100, 7850, 2750]);
opening(fS, [4000, 0, 900, 5500, 250, 2100], element(f1, 'IFCWINDOW', 'Παράθυρο Ν', [4000, 90, 900, 5500, 160, 2100], [null, 1200, 1500, E('WINDOW'), E('SINGLE_PANEL'), null]));
element(f1, 'IFCRAILING', 'Κιγκλίδωμα', [8600, 1500, 0, 8650, 5500, 1200], [null, E('GUARDRAIL')]);
element(f1, 'IFCSLAB', 'Πλάκα οροφής', [0, 0, 2750, 10000, 8100, 3000], [null, E('ROOF')]);
space(f1, '1.01', 'Υπνοδωμάτιο', [250, 250, 0, 5000, 7850, 2750]);

for (const s of storeys) {
  add('IFCRELCONTAINEDINSPATIALSTRUCTURE', guid(), null, null, null, s.elements, s.ref);
  add('IFCRELAGGREGATES', guid(), null, null, null, s.ref, s.spaces);
}

// The quantities of one room: Σαλόνι, 43.70 m² gross, 43.61 m² net (its column off).
const qto = add('IFCELEMENTQUANTITY', guid(), null, 'Qto_SpaceBaseQuantities', null, null, [
  add('IFCQUANTITYAREA', 'GrossFloorArea', null, null, 43.7, null),
  add('IFCQUANTITYAREA', 'NetFloorArea', null, null, 43.61, null),
]);
add('IFCRELDEFINESBYPROPERTIES', guid(), null, null, null, [salon], qto);

const text = f.text({ name: 'example-house.ifc' });
if (process.argv.includes('--check')) {
  const same = existsSync(OUT) && readFileSync(OUT, 'latin1') === text;
  console.log(`${same ? 'same' : 'differs'} ${OUT}`);
  process.exit(same ? 0 : 1);
}
mkdirSync('js/ifcplan/examples', { recursive: true });
writeFileSync(OUT, text, 'latin1');
console.log(`wrote ${OUT} (${text.length} bytes)`);
```

Run:
```bash
node _tests/extract.mjs $PLAN _tests/ifcplan/step.mjs && node _tests/extract.mjs $PLAN _tests/ifcplan/make-example.mjs
node _tests/ifcplan/make-example.mjs
node _tests/ifcplan/make-example.mjs --check
node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
```
Expected: `wrote js/ifcplan/examples/example-house.ifc (16459 bytes)`, then `same js/ifcplan/examples/example-house.ifc`, then `ℹ pass 35`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add _tests/ifcplan/step.mjs _tests/ifcplan/make-example.mjs _tests/ifcplan/examples.test.js js/ifcplan/examples/example-house.ifc
git commit -F - <<'EOF'
IFC floor plans: the example house and its generator

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 8: The model, read and cut into storey plans

**Files:**
- Create: `js/ifcplan/model.js`
- Test: `_tests/ifcplan/model.test.js` (end to end through web-ifc)

**Interfaces:**
- Consumes: `cutMesh` (2), `chain`, `polylineSet` (3), `layerOf`, `isMarkerProxy` (4), `roomArea`, `outlineOf`, `labelPoint` (5); in tests `storeyDxf`, `originShift` (6), `smallModel`, `E` (7), `openApi` (1), `readDxf` (6).
- Produces (`js/ifcplan/model.js`, no DOM; `api` a web-ifc `IfcAPI`, `W` the web-ifc module):
  - `MAX_BYTES` (150 MB), `LARGE_BYTES` (50 MB);
  - `sniff(bytes) → { ok: true, schema } | { ok: false, reason: 'read', detail: 'ifczip' | 'ifcxml' | 'not-ifc' }`;
  - `unitsOf(api, W, id) → { lengthM, areaM2 }`, `storeysOf(api, W, id, lengthM) → [{ id, name, levelM }]` (lowest first, world Z);
  - `prepare(api, W, id) → { schema, app, units, storeys, storeyOf(eid), spaces, up }` (once per file);
  - `cutModel(api, W, id, prep, cutM) → { file: { schema, app, unitM, products, rooms, bbox: { x0, y0, z0, x1, y1, z1 }, noStoreys, noGeometry: [{ type, count }] }, storeys: [{ name, levelM, cutZ, layers: { LAYER: { xy, ends, closed } }, rooms: [{ id, name, longName, outline: Float64Array, areaM2, areaFrom, at: [x, y], crossed }], cut, noGeometry }], transfer: ArrayBuffer[] }`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/ifcplan/model.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sniff, prepare, cutModel, MAX_BYTES, LARGE_BYTES } from '../../js/ifcplan/model.js';
import { forEachPolyline } from '../../js/ifcplan/chain.js';
import { inside } from '../../js/ifcplan/rooms.js';
import { storeyDxf, originShift } from '../../js/ifcplan/dxf.js';
import { openApi } from './webifc-node.mjs';
import { smallModel, E } from './step.mjs';
import { readDxf } from './dxf-read.mjs';

const EXAMPLE = readFileSync(new URL('../../js/ifcplan/examples/example-house.ifc', import.meta.url));
const enc = s => new TextEncoder().encode(s);
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

let api, W;
async function read(bytes, cutM = 1.1) {
  if (!api) ({ api, W } = await openApi());
  const id = api.OpenModel(bytes instanceof Uint8Array ? bytes : enc(bytes), { COORDINATE_TO_ORIGIN: false });
  assert.ok(id >= 0, 'web-ifc opens it');
  const prep = prepare(api, W, id);
  const r = cutModel(api, W, id, prep, cutM);
  return { ...r, recut: c => cutModel(api, W, id, prep, c), close: () => api.CloseModel(id) };
}
// Per layer: closed and open polylines, e.g. { IFC_WALL: '7/0' }.
function counts(storey) {
  const out = {};
  for (const [name, set] of Object.entries(storey.layers)) {
    let c = 0, o = 0;
    forEachPolyline(set, (p, closed) => { if (closed) c++; else o++; });
    out[name] = `${c}/${o}`;
  }
  return out;
}
function loops(storey, layer) {
  const out = [];
  forEachPolyline(storey.layers[layer], (p, closed) => out.push({ pts: [...p], closed }));
  return out;
}
// A closed loop as its sorted corners, rounded to 0.1 mm.
const corners = pts => { const c = []; for (let i = 0; i < pts.length; i += 2) c.push([+pts[i].toFixed(4), +pts[i + 1].toFixed(4)]); return c.sort((a, b) => a[0] - b[0] || a[1] - b[1]); };

test('sniff: STEP text names its schema; ifcZIP, ifcXML and other files are refused as unreadable', () => {
  assert.deepEqual(sniff(EXAMPLE), { ok: true, schema: 'IFC4' });
  assert.deepEqual(sniff(enc("﻿  ISO-10303-21;\nHEADER;\nFILE_SCHEMA (( 'ifc2x3' ));")), { ok: true, schema: 'IFC2X3' });
  assert.deepEqual(sniff(Uint8Array.of(0x50, 0x4b, 3, 4, 0, 0)), { ok: false, reason: 'read', detail: 'ifczip' });
  assert.deepEqual(sniff(enc('<?xml version="1.0"?><ifcXML/>')), { ok: false, reason: 'read', detail: 'ifcxml' });
  assert.deepEqual(sniff(enc('0\nSECTION\n2\nHEADER')), { ok: false, reason: 'read', detail: 'not-ifc' });
  assert.deepEqual([MAX_BYTES, LARGE_BYTES], [150 * 1024 * 1024, 50 * 1024 * 1024]);
});

test('the example end to end: two storeys at 0.00 and 3.00, the layers of each plan, the rooms and their labels', async () => {
  const r = await read(EXAMPLE);
  assert.deepEqual({ ...r.file, bbox: null }, { schema: 'IFC4', app: 'AidedCAM example generator', unitM: 0.001, products: 19, rooms: 3, bbox: null, noStoreys: false, noGeometry: [] });
  assert.deepEqual(Object.values(r.file.bbox).map(v => +v.toFixed(6)), [120.5, 80.25, -0.25, 130.5, 88.35, 6]);
  assert.deepEqual(originShift(r.file.bbox), { x: 120, y: 80 });
  assert.deepEqual(r.storeys.map(s => [s.name, s.levelM, +s.cutZ.toFixed(6), s.cut]), [['Ισόγειο', 0, 1.1, 9], ['Όροφος 1', 3, 4.1, 7]]);
  const [g, f1] = r.storeys;
  assert.deepEqual(counts(g), { IFC_COLUMN: '1/0', IFC_WALL: '7/0', IFC_STAIR: '1/0', IFC_WINDOW: '1/0', IFC_DOOR: '1/0', IFC_SPACE: '2/0' });
  assert.deepEqual(counts(f1), { IFC_WALL: '6/0', IFC_RAILING: '1/0', IFC_WINDOW: '1/0', IFC_SPACE: '1/0' });
  assert.deepEqual(g.rooms.map(x => [x.name, x.longName, +x.areaM2.toFixed(6), x.areaFrom, x.crossed]), [['Σαλόνι', '', 43.61, 'qto', true], ['Κουζίνα', '', 27.74, 'outline', true]]);
  assert.deepEqual(f1.rooms.map(x => [x.name, x.longName, +x.areaM2.toFixed(6), x.areaFrom]), [['1.01', 'Υπνοδωμάτιο', 36.1, 'outline']]);
  for (const room of [...g.rooms, ...f1.rooms]) assert.ok(inside(room.at[0], room.at[1], room.outline), `${room.name} label inside its outline`);
  assert.deepEqual(g.noGeometry, []);
  r.close();
});

test('the example geometry, to 0.1 mm: the column, the stair cut on its slope, the door and the wall split by it', async () => {
  const r = await read(EXAMPLE);
  const [g] = r.storeys;
  assert.deepEqual(corners(loops(g, 'IFC_COLUMN')[0].pts), [[123.4, 86.05], [123.4, 86.35], [123.7, 86.05], [123.7, 86.35]]);
  assert.deepEqual(corners(loops(g, 'IFC_STAIR')[0].pts), [[129.2, 83.2167], [129.2, 83.6167], [130.1, 83.2167], [130.1, 83.6167]]);
  assert.deepEqual(corners(loops(g, 'IFC_DOOR')[0].pts), [[122.5, 80.35], [122.5, 80.4], [123.4, 80.35], [123.4, 80.4]]);
  const south = loops(g, 'IFC_WALL').map(l => corners(l.pts)).filter(c => c[0][1] === 80.25).sort((a, b) => a[0][0] - b[0][0]);
  assert.deepEqual(south, [[[120.5, 80.25], [120.5, 80.5], [122.5, 80.25], [122.5, 80.5]], [[123.4, 80.25], [123.4, 80.5], [130.5, 80.25], [130.5, 80.5]]]);
  r.close();
});

test('a re-cut on the open model: at 2.20 m the door and windows fall below the cut, at 0.00 m the plan looks just above the floor', async () => {
  const r = await read(EXAMPLE);
  const high = r.recut(2.2);
  assert.deepEqual(high.storeys.map(counts), [
    { IFC_COLUMN: '1/0', IFC_WALL: '5/0', IFC_STAIR: '1/0', IFC_SPACE: '2/0' },
    { IFC_WALL: '5/0', IFC_SPACE: '1/0' },
  ]);
  assert.deepEqual(high.storeys.map(s => +s.cutZ.toFixed(6)), [2.2, 5.2]);
  const floor = r.recut(0);
  assert.deepEqual(floor.storeys.map(counts)[0], { IFC_COLUMN: '1/0', IFC_WALL: '6/0', IFC_STAIR: '1/0', IFC_DOOR: '1/0', IFC_SPACE: '2/0' }, 'the door splits its wall; the window, from 0.90 m, does not');
  r.close();
});

test('the example plans as DXF: they parse back, in mm, with the Greek labels and the shift', async () => {
  const r = await read(EXAMPLE);
  const shift = originShift(r.file.bbox);
  const d = readDxf(storeyDxf({ storey: r.storeys[0], source: 'example-house.ifc', cutM: 1.1, units: 'mm', shift }).bytes);
  assert.equal(d.header.$INSUNITS, '4');
  const by = {};
  for (const e of d.entities) by[`${e.type} ${e.layer}`] = (by[`${e.type} ${e.layer}`] || 0) + 1;
  assert.deepEqual(by, { 'POLYLINE IFC_WALL': 7, 'POLYLINE IFC_DOOR': 1, 'POLYLINE IFC_WINDOW': 1, 'POLYLINE IFC_COLUMN': 1, 'POLYLINE IFC_STAIR': 1, 'POLYLINE IFC_SPACE': 2, 'TEXT IFC_SPACE_TEXT': 4 });
  assert.deepEqual(d.entities.filter(e => e.type === 'TEXT').map(e => e.text), ['Σαλόνι', '43.61 m²', 'Κουζίνα', '27.74 m²']);
  assert.deepEqual(d.header.$EXTMIN.map(v => +v.toFixed(3)), [500, 250, 0]);
  assert.ok(d.comments.includes("Shift: X -120000 mm, Y -80000 mm; add it back to return to the IFC's coordinates"));
  const up = readDxf(storeyDxf({ storey: r.storeys[1], source: 'example-house.ifc', cutM: 1.1, units: 'm' }).bytes);
  assert.deepEqual(up.entities.filter(e => e.type === 'TEXT').map(e => e.text), ['1.01', 'Υπνοδωμάτιο', '36.10 m²']);
  r.close();
});

test('units: feet and centimetres are read from the project, and the plans come out in metres', async () => {
  const ft = await read(smallModel({ length: { foot: true }, storeys: [{ name: 'L1', z: 0 }, { name: 'L2', z: 10 }], elements: [{ storey: 1, box: [0, 0, 0, 10, 1, 9] }] }));
  assert.equal(ft.file.unitM, 0.3048);
  assert.deepEqual(ft.storeys.map(s => +s.levelM.toFixed(6)), [0, 3.048]);
  assert.deepEqual(corners(loops(ft.storeys[1], 'IFC_WALL')[0].pts), [[0, 0], [0, 0.3048], [3.048, 0], [3.048, 0.3048]]);
  ft.close();
  const cm = await read(smallModel({ length: { prefix: 'CENTI' }, storeys: [{ name: 'L1', z: 280 }], elements: [{ storey: 0, box: [0, 0, 0, 500, 20, 280] }] }));
  assert.equal(cm.file.unitM, 0.01);
  assert.deepEqual(cm.storeys.map(s => [+s.levelM.toFixed(6), +s.cutZ.toFixed(6)]), [[2.8, 3.9]]);
  assert.deepEqual(counts(cm.storeys[0]), { IFC_WALL: '1/0' });
  cm.close();
});

test('a storey\'s level is the world Z of its placement, not its Elevation (a building placed 100 m up)', async () => {
  const r = await read(smallModel({ buildingZ: 100000, storeys: [{ name: 'Ground', z: 0, elevation: 0 }, { name: 'First', z: 3000, elevation: 3000 }], elements: [{ storey: 0, box: [0, 0, 0, 1000, 200, 3000] }] }));
  assert.deepEqual(r.storeys.map(s => [s.name, s.levelM]), [['Ground', 100], ['First', 103]]);
  assert.deepEqual(counts(r.storeys[0]), { IFC_WALL: '1/0' });
  r.close();
});

test('no storeys: one plan of everything, cut at 1.10 m above zero', async () => {
  const r = await read(smallModel({ elements: [{ storey: -1, box: [0, 0, 0, 1000, 200, 3000] }] }));
  assert.equal(r.file.noStoreys, true);
  assert.deepEqual(r.storeys.map(s => [s.name, s.levelM, s.cut, counts(s)]), [['', 0, 1, { IFC_WALL: '1/0' }]]);
  r.close();
});

test('an element web-ifc cannot mesh is reported by type and storey; a thin proxy without a Body is a marker', async () => {
  const empty = (m, add) => add('IFCBOOLEANCLIPPINGRESULT', E('DIFFERENCE'), m.boxSolid(1000, 100, 3000), m.boxSolid(1000, 100, 3000));
  const r = await read(smallModel({
    storeys: [{ name: 'S', z: 0 }],
    elements: [
      { storey: 0, box: [0, 0, 0, 1000, 100, 3000] },
      { storey: 0, box: [0, 0, 0, 1000, 100, 3000], solid: empty },
      { storey: 0, type: 'IFCBUILDINGELEMENTPROXY', box: [0, 2000, 1099.8, 500, 2500, 1100.3], ident: 'Annotation' },
      { storey: 0, type: 'IFCBUILDINGELEMENTPROXY', box: [0, 3000, 1099.8, 500, 3500, 1100.3] },
    ],
  }));
  assert.deepEqual(r.storeys[0].noGeometry, [{ type: 'IfcWall', count: 1 }]);
  assert.deepEqual(r.file.noGeometry, [{ type: 'IfcWall', count: 1 }]);
  assert.deepEqual(counts(r.storeys[0]), { IFC_WALL: '1/0', IFC_OTHER: '1/0' }, 'the proxy with a Body is drawn, the marker is not');
  assert.equal(r.file.products, 2);
  r.close();
});

test('non-finite vertices from web-ifc: the bounding box, the shift and the DXF stay finite', async () => {
  const { api: real, W: w } = await openApi();
  let n = 0;
  const bad = new Proxy(real, { get: (t, k) => (k === 'GetVertexArray'
    ? (...a) => { const v = t.GetVertexArray(...a).slice(); if (n++ === 0) { v[0] = NaN; v[7] = Infinity; } return v; }
    : typeof t[k] === 'function' ? t[k].bind(t) : t[k]) });
  const id = bad.OpenModel(enc(smallModel({ storeys: [{ name: 'S', z: 0 }], elements: [{ storey: 0, box: [0, 0, 0, 4000, 200, 3000] }, { storey: 0, box: [0, 2000, 0, 4000, 2200, 3000] }] })), { COORDINATE_TO_ORIGIN: false });
  const r = cutModel(bad, w, id, prepare(bad, w, id), 1.1);
  assert.ok(n >= 2, 'both walls meshed');
  assert.ok(Object.values(r.file.bbox).every(Number.isFinite), JSON.stringify(r.file.bbox));
  const shift = originShift(r.file.bbox);
  assert.ok(Number.isFinite(shift.x) && Number.isFinite(shift.y));
  const out = storeyDxf({ storey: r.storeys[0], source: 'x.ifc', cutM: 1.1, units: 'mm', shift });
  assert.ok(!/NaN|Infinity/.test(new TextDecoder('latin1').decode(out.bytes)));
  const d = readDxf(out.bytes);
  assert.ok(d.entities.length > 0);
  for (const e of d.entities) assert.ok(e.pts.every(Number.isFinite), JSON.stringify(e));
  assert.ok([...d.header.$EXTMIN, ...d.header.$EXTMAX].every(Number.isFinite));
  real.CloseModel(id);
});
```

Run: `node _tests/extract.mjs $PLAN _tests/ifcplan/model.test.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 35`, `ℹ fail 1`.

- [ ] **Step 2: Write the module**

<!-- file: js/ifcplan/model.js -->
```js
// IFC floor plans: an open web-ifc model read and cut into storey plans (spec §3, steps 2–6). No DOM: it runs in
// the worker, and in the Node tests on the same web-ifc build. `api` is a web-ifc IfcAPI, `W` the web-ifc module
// (for its type codes). Lengths come back in metres, in the IFC's world coordinates; areas in m².
import { cutMesh } from './cut.js?v=20261101';
import { chain, polylineSet } from './chain.js?v=20261101';
import { layerOf, isMarkerProxy } from './layers.js?v=20261101';
import { roomArea, outlineOf, labelPoint } from './rooms.js?v=20261101';

export const MAX_BYTES = 150 * 1024 * 1024;       // refused before reading (spec §7)
export const LARGE_BYTES = 50 * 1024 * 1024;      // accepted, with a "this may take a while" note

// What a file is, from its first bytes: { ok: true, schema } for STEP text, else { ok: false, reason: 'read', detail }
// with detail 'ifczip', 'ifcxml' or 'not-ifc'.
export function sniff(bytes) {
  const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  const head = new TextDecoder('latin1').decode(bytes.subarray(bom, Math.min(bytes.length, 65536)));
  if (head.startsWith('PK\u0003\u0004')) return { ok: false, reason: 'read', detail: 'ifczip' };
  const start = head.trimStart();
  if (start.startsWith('<')) return { ok: false, reason: 'read', detail: 'ifcxml' };
  if (!start.startsWith('ISO-10303-21')) return { ok: false, reason: 'read', detail: 'not-ifc' };
  const m = /FILE_SCHEMA\s*\(\s*\(\s*'([^']*)'/i.exec(head);
  return { ok: true, schema: m ? m[1].trim().toUpperCase() : '' };
}

const PREFIX = { EXA: 1e18, PETA: 1e15, TERA: 1e12, GIGA: 1e9, MEGA: 1e6, KILO: 1e3, HECTO: 1e2, DECA: 1e1, DECI: 1e-1, CENTI: 1e-2, MILLI: 1e-3, MICRO: 1e-6, NANO: 1e-9, PICO: 1e-12, FEMTO: 1e-15, ATTO: 1e-18 };
const val = x => (x && typeof x === 'object' && 'value' in x ? x.value : x);

// Metres per length unit and m² per area unit, from IfcProject.UnitsInContext: SI units with their prefix, and
// conversion-based units (feet, inches …) through their factor. A missing area unit follows the length unit.
export function unitsOf(api, W, id) {
  let lengthM = 1, areaM2 = null;
  const si = u => {
    const p = PREFIX[val(u.Prefix)] || 1;
    const name = String(val(u.Name) || '');
    return name === 'SQUARE_METRE' ? p * p : name === 'CUBIC_METRE' ? p * p * p : p;
  };
  const factor = u => {
    if (!u) return null;
    if (u.ConversionFactor) {
      const mw = u.ConversionFactor;
      const v = Number(val(mw.ValueComponent));
      const base = mw.UnitComponent ? factor(mw.UnitComponent) : 1;
      if (v > 0 && base) return v * base;
      const n = String(val(u.Name) || '').toUpperCase();
      return n.includes('FOOT') ? 0.3048 : n.includes('INCH') ? 0.0254 : null;
    }
    if (u.Name !== undefined) return si(u);
    return null;
  };
  try {
    const ids = api.GetLineIDsWithType(id, W.IFCPROJECT);
    if (ids.size()) {
      const project = api.GetLine(id, ids.get(0), true);
      const units = (project.UnitsInContext && project.UnitsInContext.Units) || [];
      for (const u of units) {
        const type = u && val(u.UnitType);
        if (type === 'LENGTHUNIT') { const f = factor(u); if (f > 0) lengthM = f; }
        if (type === 'AREAUNIT') { const f = factor(u); if (f > 0) areaM2 = f; }
      }
    }
  } catch (e) { /* no usable units: metres */ }
  return { lengthM, areaM2: areaM2 || lengthM * lengthM };
}

// The world Z of a placement: the Z of its location summed along PlacementRelTo (spec §3: a storey's Elevation is
// relative to the building, and wrong for georeferenced files). Rotations of the parents are not applied.
function worldZ(api, id, placementId) {
  let z = 0;
  for (let p = placementId, guard = 0; p && guard < 64; guard++) {
    const lp = api.GetLine(id, p);
    if (!lp || !lp.RelativePlacement) break;
    const ap = api.GetLine(id, lp.RelativePlacement.value);
    const loc = ap && ap.Location ? api.GetLine(id, ap.Location.value) : null;
    const c = loc && loc.Coordinates;
    if (c && c.length > 2) z += Number(val(c[2])) || 0;
    p = lp.PlacementRelTo ? lp.PlacementRelTo.value : 0;
  }
  return z;
}

// The storeys, lowest first: { id, name, levelM }.
export function storeysOf(api, W, id, lengthM) {
  const ids = api.GetLineIDsWithType(id, W.IFCBUILDINGSTOREY);
  const out = [];
  for (let i = 0; i < ids.size(); i++) {
    const sid = ids.get(i);
    const s = api.GetLine(id, sid);
    let z = null;
    try { if (s.ObjectPlacement) z = worldZ(api, id, s.ObjectPlacement.value); } catch (e) { z = null; }
    if (z === null) z = Number(val(s.Elevation)) || 0;
    out.push({ id: sid, name: val(s.Name) || '', levelM: z * lengthM });
  }
  return out.sort((a, b) => a.levelM - b.levelM || a.id - b.id);
}

const BODY_TYPES = new Set(['SWEPTSOLID', 'ADVANCEDSWEPTSOLID', 'BREP', 'ADVANCEDBREP', 'CSG', 'CLIPPING', 'SURFACEMODEL', 'TESSELLATION', 'SOLIDMODEL', 'MAPPEDREPRESENTATION']);

// Does the product carry a Body representation (a solid, not only a footprint, an axis or a box)?
function hasBody(api, id, eid) {
  try {
    const p = api.GetLine(id, eid);
    if (!p.Representation) return false;
    const pds = api.GetLine(id, p.Representation.value);
    for (const r of pds.Representations || []) {
      const rep = api.GetLine(id, r.value);
      const ident = String(val(rep.RepresentationIdentifier) || '').toUpperCase();
      const type = String(val(rep.RepresentationType) || '').toUpperCase();
      if (ident === 'BODY' || ident === 'FACETATION' || (!ident && BODY_TYPES.has(type))) return true;
    }
  } catch (e) { /* unreadable: no */ }
  return false;
}

// What does not change with the cut height: the units, the storeys, the spatial structure, the rooms' names and
// quantities. Read once per file.
export function prepare(api, W, id) {
  const header = (type, k) => { try { const a = api.GetHeaderLine(id, type).arguments; return k(a); } catch (e) { return ''; } };
  const app = header(W.FILE_NAME, a => String(val(a[5]) || val(a[4]) || '')).trim();
  const schema = api.GetModelSchema(id) || '';
  const units = unitsOf(api, W, id);
  const storeys = storeysOf(api, W, id, units.lengthM);
  const storeyIndex = new Map(storeys.map((s, i) => [s.id, i]));

  // The spatial structure: each element's container, each part's whole.
  const up = new Map();
  const each = (type, fn) => { const ids = api.GetLineIDsWithType(id, type); for (let i = 0; i < ids.size(); i++) fn(api.GetLine(id, ids.get(i))); };
  each(W.IFCRELCONTAINEDINSPATIALSTRUCTURE, r => { for (const e of r.RelatedElements || []) if (!up.has(e.value)) up.set(e.value, r.RelatingStructure.value); });
  each(W.IFCRELAGGREGATES, r => { for (const e of r.RelatedObjects || []) if (!up.has(e.value)) up.set(e.value, r.RelatingObject.value); });
  const memo = new Map();
  const storeyOf = eid => {
    if (memo.has(eid)) return memo.get(eid);
    let k = -1;
    for (let p = eid, guard = 0; p && guard < 32; guard++) {
      if (storeyIndex.has(p)) { k = storeyIndex.get(p); break; }
      p = up.get(p);
    }
    memo.set(eid, k);
    return k;
  };

  // The rooms: names, and areas from their quantity set (Qto_SpaceBaseQuantities, or IFC2X3's BaseQuantities).
  const spaces = new Map();
  each(W.IFCSPACE, s => spaces.set(s.expressID, { name: val(s.Name) || '', longName: val(s.LongName) || '', qto: {} }));
  if (spaces.size) {
    each(W.IFCRELDEFINESBYPROPERTIES, r => {
      const objs = (r.RelatedObjects || []).filter(o => spaces.has(o.value));
      if (!objs.length || !r.RelatingPropertyDefinition) return;
      const def = r.RelatingPropertyDefinition.value;
      if (api.GetLineType(id, def) !== W.IFCELEMENTQUANTITY) return;
      const q = api.GetLine(id, def);
      const name = String(val(q.Name) || '');
      if (name !== 'Qto_SpaceBaseQuantities' && name !== 'BaseQuantities') return;
      for (const qr of q.Quantities || []) {
        if (api.GetLineType(id, qr.value) !== W.IFCQUANTITYAREA) continue;
        const a = api.GetLine(id, qr.value);
        const key = val(a.Name) === 'NetFloorArea' ? 'net' : val(a.Name) === 'GrossFloorArea' ? 'gross' : null;
        const v = Number(val(a.AreaValue)) * units.areaM2;
        if (key && v > 0) for (const o of objs) spaces.get(o.value).qto[key] = v;
      }
    });
  }
  return { schema, app, units, storeys, storeyOf, spaces, up };
}

// The plans at one cut height: every mesh cut by every storey's plane in one pass (spec §3 step 5).
// Returns { file, storeys } as the worker answers it (spec §3), with { transfer } the buffers to hand over.
export function cutModel(api, W, id, prep, cutM) {
  const one = prep.storeys.length === 0;
  const storeys = one ? [{ id: 0, name: '', levelM: 0 }] : prep.storeys;
  const planes = storeys.map(s => s.levelM + cutM);
  const plans = storeys.map(() => ({ layers: new Map(), cut: new Set(), rooms: [] }));
  const typeNames = new Map();
  const typeOf = eid => {
    const code = api.GetLineType(id, eid);
    let n = typeNames.get(code);
    if (n === undefined) { n = api.GetNameFromTypeCode(code); typeNames.set(code, n); }
    return n;
  };
  const meshed = new Set();
  const bbox = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  let products = 0;

  // One product's triangles, in IFC Z-up metres (web-ifc gives Y-up: IFC (x, y, z) = (X, -Z, Y)). A vertex web-ifc
  // gives as NaN or Infinity stays out of the bounding box (the cut drops its segments); b.x0 > b.x1 when none is finite.
  const gather = mesh => {
    const gs = mesh.geometries, parts = [];
    let nv = 0, ni = 0;
    for (let i = 0; i < gs.size(); i++) {
      const pg = gs.get(i);
      const geo = api.GetGeometry(id, pg.geometryExpressID);
      const v = api.GetVertexArray(geo.GetVertexData(), geo.GetVertexDataSize());
      const ix = api.GetIndexArray(geo.GetIndexData(), geo.GetIndexDataSize());
      parts.push({ v: v.slice(), ix: ix.slice(), T: pg.flatTransformation });
      nv += v.length / 6; ni += ix.length;
      geo.delete();
    }
    const P = new Float64Array(nv * 3), IX = new Uint32Array(ni);
    let pv = 0, pi = 0;
    const b = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
    for (const { v, ix, T } of parts) {
      const base = pv;
      for (let k = 0; k < v.length; k += 6) {
        const x = v[k], y = v[k + 1], z = v[k + 2];
        const X = T[0] * x + T[4] * y + T[8] * z + T[12], Y = T[1] * x + T[5] * y + T[9] * z + T[13], Z = T[2] * x + T[6] * y + T[10] * z + T[14];
        const ix3 = 3 * pv++;
        P[ix3] = X; P[ix3 + 1] = -Z; P[ix3 + 2] = Y;
        if (!(Number.isFinite(X) && Number.isFinite(Y) && Number.isFinite(Z))) continue;
        if (X < b.x0) b.x0 = X; if (X > b.x1) b.x1 = X;
        if (-Z < b.y0) b.y0 = -Z; if (-Z > b.y1) b.y1 = -Z;
        if (Y < b.z0) b.z0 = Y; if (Y > b.z1) b.z1 = Y;
      }
      for (let k = 0; k < ix.length; k++) IX[pi++] = base + ix[k];
    }
    return { P, ix: IX, b };
  };
  const grow = b => {
    bbox.x0 = Math.min(bbox.x0, b.x0); bbox.y0 = Math.min(bbox.y0, b.y0); bbox.z0 = Math.min(bbox.z0, b.z0);
    bbox.x1 = Math.max(bbox.x1, b.x1); bbox.y1 = Math.max(bbox.y1, b.y1); bbox.z1 = Math.max(bbox.z1, b.z1);
  };
  const add = (plan, layer, polylines) => {
    let set = plan.layers.get(layer);
    if (!set) plan.layers.set(layer, set = polylineSet());
    for (const p of polylines) if (p.pts.length >= 4) set.add(p.pts, p.closed);
  };

  api.StreamAllMeshes(id, mesh => {
    const eid = mesh.expressID;
    const type = typeOf(eid);
    const layer = layerOf(type);
    if (!layer || layer === 'IFC_SPACE') return;
    const m = gather(mesh);
    if (!m.ix.length || !(m.b.x0 <= m.b.x1)) return;
    if (isMarkerProxy({ type, zSpan: m.b.z1 - m.b.z0, hasBody: m.b.z1 - m.b.z0 < 0.001 && hasBody(api, id, eid) })) return;
    meshed.add(eid);
    products++;
    grow(m.b);
    const segs = planes.map(() => null);
    cutMesh(m.P, m.ix, planes, (k, x0, y0, x1, y1) => { (segs[k] || (segs[k] = [])).push(x0, y0, x1, y1); });
    segs.forEach((s, k) => {
      if (!s) return;
      add(plans[k], layer, chain(s));
      plans[k].cut.add(eid);
    });
  });

  // Rooms: each space on its own storey's plane (spec §5). StreamAllMeshes leaves IfcSpace out.
  let rooms = 0;
  api.StreamAllMeshesWithTypes(id, [W.IFCSPACE], mesh => {
    const eid = mesh.expressID;
    const m = gather(mesh);
    if (!m.ix.length || !(m.b.x0 <= m.b.x1)) return;
    meshed.add(eid);
    grow(m.b);
    let k = one ? 0 : prep.storeyOf(eid);
    if (k < 0) {
      // Not in a storey: the highest storey at or below its floor.
      k = 0;
      for (let i = 0; i < storeys.length; i++) if (storeys[i].levelM <= m.b.z0 + 0.01) k = i;
    }
    const info = prep.spaces.get(eid) || { name: '', longName: '', qto: {} };
    const segs = [];
    cutMesh(m.P, m.ix, [planes[k]], (j, x0, y0, x1, y1) => segs.push(x0, y0, x1, y1));
    const pieces = chain(segs);
    let loops = pieces, outline = outlineOf(loops), crossed = outline.length >= 6, at;
    if (crossed) {
      add(plans[k], 'IFC_SPACE', pieces);
      at = labelPoint(outline);
    } else {
      // Lower than the cut: no outline; the label at the middle of its plan, its area from a cut at mid-height.
      const mid = [];
      cutMesh(m.P, m.ix, [(m.b.z0 + m.b.z1) / 2], (j, x0, y0, x1, y1) => mid.push(x0, y0, x1, y1));
      loops = chain(mid);
      outline = outlineOf(loops);
      at = [(m.b.x0 + m.b.x1) / 2, (m.b.y0 + m.b.y1) / 2];
    }
    const area = roomArea(info.qto, outline, loops);         // less the room's own holes: columns, shafts
    plans[k].rooms.push({ id: eid, name: info.name, longName: info.longName, outline: Float64Array.from(crossed ? outline : []), areaM2: area.areaM2, areaFrom: area.areaFrom, at, crossed });
    rooms++;
  });

  // Elements with a body that web-ifc could not mesh (for example a failed boolean): reported, not drawn.
  const missing = storeys.map(() => new Map()), missingAll = new Map();
  for (const eid of prep.up.keys()) {
    if (meshed.has(eid)) continue;
    const type = typeOf(eid);
    if (!layerOf(type) || !hasBody(api, id, eid)) continue;
    const k = one ? 0 : prep.storeyOf(eid);
    if (k >= 0) missing[k].set(type, (missing[k].get(type) || 0) + 1);
    missingAll.set(type, (missingAll.get(type) || 0) + 1);
  }
  const list = m => [...m].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count || (a.type < b.type ? -1 : 1));

  const transfer = [];
  const outStoreys = storeys.map((s, k) => {
    const layers = {};
    for (const [name, set] of plans[k].layers) {
      const p = set.pack();
      layers[name] = p;
      transfer.push(p.xy.buffer, p.ends.buffer, p.closed.buffer);
    }
    for (const r of plans[k].rooms) transfer.push(r.outline.buffer);
    return { name: s.name, levelM: s.levelM, cutZ: planes[k], layers, rooms: plans[k].rooms, cut: plans[k].cut.size, noGeometry: list(missing[k]) };
  });
  if (!(bbox.x0 <= bbox.x1)) for (const k of Object.keys(bbox)) bbox[k] = 0;
  const file = { schema: prep.schema, app: prep.app, unitM: prep.units.lengthM, products, rooms, bbox, noStoreys: one, noGeometry: list(missingAll) };
  return { file, storeys: outStoreys, transfer };
}
```

Run: `node _tests/extract.mjs $PLAN js/ifcplan/model.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 44`, `ℹ fail 0`. The example's numbers, worked by hand from the generator: ground cut at 1.10 m crosses 5 walls (the south and north ones split by the door and the window: 7 loops), the door, the window, the column and the stair (on its slope: y 2.9667–3.3667 m from the flight's start) = 9 elements, and both rooms; floor 1 at 4.10 m crosses 5 walls (6 loops), the window and the railing = 7, and its room. Areas: Σαλόνι 43.61 from Qto, Κουζίνα 3.65 × 7.60 = 27.74 and 1.01 4.75 × 7.60 = 36.10 from their outlines.

- [ ] **Step 3: Commit**

```bash
git add js/ifcplan/model.js _tests/ifcplan/model.test.js
git commit -F - <<'EOF'
IFC floor plans: the model read and cut into storey plans, end to end through web-ifc

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 9: The worker

**Files:**
- Create: `js/ifcplan/worker.js`
- Test: `_tests/ifcplan/worker.test.js`

**Interfaces:**
- Consumes: `sniff`, `prepare`, `cutModel`, `MAX_BYTES` (8); the bridge's messages (`js/laser/bridge.js`, unchanged): `{ type: 'boot' }` → `{ type: 'ready' }` once; `{ type: 'process', id, name, bytes, settings }` → one answer with that `id`; an `'engine'` error restarts the worker.
- Produces (`js/ifcplan/worker.js`): `DEFAULT_CUT_M` (1.1); `createSession(loadApi) → { boot(), process(message) → Promise<{ reply, transfer }> }`:
  - a file: `settings: { cutM }` → `{ type: 'result', id, name, recut: false, cutM, file, storeys }` (Task 8's shapes), its buffers in `transfer`;
  - a re-cut: `name: 'recut'`, empty `bytes`, `settings: { cutM, recut: true }` → the same with `recut: true`, or `{ type: 'error', id, reason: 'stale', detail: '' }` when no model is open;
  - errors: `{ type: 'error', id, reason: 'read' | 'schema' | 'limit' | 'empty' | 'engine' | 'stale', detail }`; `'timeout'` comes from the bridge.
  - Inside a worker it imports `./vendor/web-ifc/web-ifc-api.js?v=20261101`, loads `web-ifc.wasm?v=20261101` next to it, single-threaded, log off.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/ifcplan/worker.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSession, DEFAULT_CUT_M } from '../../js/ifcplan/worker.js';
import { MAX_BYTES } from '../../js/ifcplan/model.js';
import { openApi } from './webifc-node.mjs';
import { smallModel } from './step.mjs';

const EXAMPLE = readFileSync(new URL('../../js/ifcplan/examples/example-house.ifc', import.meta.url));
const buf = b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const text = s => buf(new TextEncoder().encode(s));
const file = (id, bytes, cutM = 1.1, name = 'example-house.ifc') => ({ type: 'process', id, name, bytes, settings: { cutM } });
const recut = (id, cutM) => ({ type: 'process', id, name: 'recut', bytes: new ArrayBuffer(0), settings: { cutM, recut: true } });

test('a file: the result of spec §3, its buffers listed for transfer', async () => {
  const s = createSession(openApi);
  const { reply, transfer } = await s.process(file(1, buf(EXAMPLE)));
  assert.equal(reply.type, 'result');
  assert.deepEqual([reply.id, reply.name, reply.recut, reply.cutM], [1, 'example-house.ifc', false, 1.1]);
  assert.deepEqual([reply.file.schema, reply.file.products, reply.storeys.length], ['IFC4', 19, 2]);
  assert.ok(transfer.length > 0 && transfer.every(b => b instanceof ArrayBuffer));
  assert.ok(transfer.includes(reply.storeys[0].layers.IFC_WALL.xy.buffer));
  assert.equal(DEFAULT_CUT_M, 1.1);
});

test('a re-cut reuses the open model: no bytes, a new height', async () => {
  const s = createSession(openApi);
  await s.process(file(1, buf(EXAMPLE)));
  const { reply } = await s.process(recut(2, 2.2));
  assert.deepEqual([reply.type, reply.id, reply.name, reply.recut, reply.cutM], ['result', 2, 'example-house.ifc', true, 2.2]);
  assert.deepEqual(reply.storeys.map(st => +st.cutZ.toFixed(6)), [2.2, 5.2]);
  assert.equal(reply.storeys[0].layers.IFC_DOOR, undefined, 'the door is below 2.20 m');
});

test('a re-cut with no open model is stale: after a restart, or once a later file failed', async () => {
  const s = createSession(openApi);
  assert.deepEqual((await s.process(recut(1, 1.1))).reply, { type: 'error', id: 1, reason: 'stale', detail: '' });
  await s.process(file(2, buf(EXAMPLE)));
  assert.equal((await s.process(file(3, text('not an IFC')))).reply.reason, 'read');
  assert.equal((await s.process(recut(4, 1.1))).reply.reason, 'stale');
});

test('errors: read (with what the file is), schema (with the schema found), limit, empty', async () => {
  const s = createSession(openApi);
  const reasons = async m => { const { reply } = await s.process(m); return [reply.type, reply.reason, reply.detail]; };
  assert.deepEqual(await reasons(file(1, text('0\nSECTION\n'))), ['error', 'read', 'not-ifc']);
  assert.deepEqual(await reasons(file(2, buf(Uint8Array.of(0x50, 0x4b, 3, 4, 20, 0)))), ['error', 'read', 'ifczip']);
  assert.deepEqual(await reasons(file(3, text('<?xml version="1.0"?>'))), ['error', 'read', 'ifcxml']);
  const ifc9 = new TextDecoder().decode(EXAMPLE).replace("FILE_SCHEMA(('IFC4'))", "FILE_SCHEMA(('IFC9'))");
  assert.deepEqual(await reasons(file(4, text(ifc9))), ['error', 'schema', 'IFC9']);
  assert.deepEqual(await reasons(file(5, { byteLength: MAX_BYTES + 1 })), ['error', 'limit', '']);
  assert.deepEqual(await reasons(file(6, text(smallModel({ storeys: [{ name: 'S', z: 0 }] })))), ['error', 'empty', '']);
});

test('a crash inside web-ifc is an engine error, and the open model is dropped', async () => {
  const s = createSession(async () => {
    const { api, W } = await openApi();
    let n = 0;
    return { W, api: new Proxy(api, { get: (t, k) => (k === 'StreamAllMeshes' && n++ > 0 ? () => { throw new Error('Aborted(OOM)'); } : typeof t[k] === 'function' ? t[k].bind(t) : t[k]) }) };
  });
  assert.equal((await s.process(file(1, buf(EXAMPLE)))).reply.type, 'result');
  assert.deepEqual((await s.process(recut(2, 2))).reply, { type: 'error', id: 2, reason: 'engine', detail: 'Aborted(OOM)' });
  assert.equal((await s.process(recut(3, 2))).reply.reason, 'stale');
});

test('web-ifc refusing a schema it supports is a read error, not a schema error', async () => {
  const refusing = async () => {
    const { api, W } = await openApi();
    return { W, api: new Proxy(api, { get: (t, k) => (k === 'OpenModel' ? () => -1 : typeof t[k] === 'function' ? t[k].bind(t) : t[k]) }) };
  };
  const s = createSession(refusing);
  const reasons = async m => { const { reply } = await s.process(m); return [reply.type, reply.reason, reply.detail]; };
  assert.deepEqual(await reasons(file(1, buf(EXAMPLE))), ['error', 'read', '']);
  const src = new TextDecoder().decode(EXAMPLE);
  for (const schema of ['IFC2X3', 'IFC4X3', 'IFC4X3_ADD2']) assert.deepEqual(await reasons(file(2, text(src.replace("FILE_SCHEMA(('IFC4'))", `FILE_SCHEMA(('${schema}'))`)))), ['error', 'read', ''], schema);
  assert.deepEqual(await reasons(file(3, text(src.replace("FILE_SCHEMA(('IFC4'))", "FILE_SCHEMA(('IFC9'))")))), ['error', 'schema', 'IFC9']);
});
```

Run: `node _tests/extract.mjs $PLAN _tests/ifcplan/worker.test.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 44`, `ℹ fail 1`.

- [ ] **Step 2: Write the worker**

<!-- file: js/ifcplan/worker.js -->
```js
// IFC floor plans: the module worker that holds web-ifc (spec §3). It answers the messages of the shared
// js/laser/bridge.js: 'boot' loads web-ifc and answers 'ready'; 'process' with a file's bytes opens the model, cuts
// every storey at settings.cutM and answers { type: 'result' }; 'process' with settings.recut cuts the open model
// again at a new height, without the bytes. The model stays open until the next file. Single-threaded web-ifc, so a
// static host needs no cross-origin isolation.
// createSession is the whole logic, without the worker's globals, so the Node tests drive it with the same web-ifc.
import * as WebIFC from './vendor/web-ifc/web-ifc-api.js?v=20261101';
import { sniff, prepare, cutModel, MAX_BYTES } from './model.js?v=20261101';

export const DEFAULT_CUT_M = 1.1;

// Whether web-ifc reads this schema: IFC2X3, IFC4, IFC4X3 and their aliases (web-ifc's own list).
const supported = (W, schema) => (W.SchemaNames || []).some(names => Array.isArray(names) && names.includes(schema));

// loadApi: async () => ({ api, W }). Returns { boot, process(message) → { reply, transfer } }.
export function createSession(loadApi) {
  let booted = null;
  let open = null;                                            // { id, prep, name }: the model kept for a re-cut
  const boot = () => booted || (booted = loadApi());
  const error = (id, reason, detail = '') => ({ reply: { type: 'error', id, reason, detail }, transfer: [] });

  async function process(m) {
    const { api, W } = await boot();
    const settings = m.settings || {};
    const cutM = Number.isFinite(settings.cutM) ? settings.cutM : DEFAULT_CUT_M;
    try {
      if (settings.recut) {
        if (!open) return error(m.id, 'stale');               // the worker restarted, or the last file failed
        const r = cutModel(api, W, open.id, open.prep, cutM);
        return { reply: { type: 'result', id: m.id, name: open.name, recut: true, cutM, file: r.file, storeys: r.storeys }, transfer: r.transfer };
      }
      if (open) { try { api.CloseModel(open.id); } catch (e) { /* already gone */ } open = null; }
      if (!m.bytes || m.bytes.byteLength > MAX_BYTES) return error(m.id, 'limit');
      const bytes = new Uint8Array(m.bytes);
      const s = sniff(bytes);
      if (!s.ok) return error(m.id, s.reason, s.detail);
      const id = api.OpenModel(bytes, { COORDINATE_TO_ORIGIN: false });
      // web-ifc refuses a schema it does not know; refusing one it knows means the file itself is unreadable.
      if (id < 0) return supported(W, s.schema) ? error(m.id, 'read') : error(m.id, 'schema', s.schema);
      const prep = prepare(api, W, id);
      const r = cutModel(api, W, id, prep, cutM);
      if (!r.file.products && !r.file.rooms) { api.CloseModel(id); return error(m.id, 'empty'); }
      open = { id, prep, name: m.name };
      return { reply: { type: 'result', id: m.id, name: m.name, recut: false, cutM, file: r.file, storeys: r.storeys }, transfer: r.transfer };
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
  await api.Init(file => new URL(`./vendor/web-ifc/${file}?v=20261101`, import.meta.url).href, true);
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

Run: `node _tests/extract.mjs $PLAN js/ifcplan/worker.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 49`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/ifcplan/worker.js _tests/ifcplan/worker.test.js
git commit -F - <<'EOF'
IFC floor plans: the worker, on the shared bridge's messages, with the re-cut

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 10: The preview

**Files:**
- Create: `js/ifcplan/drawing.js`
- Test: `_tests/ifcplan/drawing.test.js`

**Interfaces:**
- Consumes: `LAYERS` (4), `forEachPolyline` (3), `labelLines` (5).
- Produces (`js/ifcplan/drawing.js`, DOM): `LAYER_COLORS` (layer → `#rrggbb`), `LEGEND_ORDER` (spec §4's 13 drawn layers), `createDrawing(canvas, { onHover(layer | null, clientX, clientY) }) → { show(storey, bbox, keepView), clear(), fit(), zoomBy(f), layers, screenOf(x, y), layerAt(sx, sy) }`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/ifcplan/drawing.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYER_COLORS, LEGEND_ORDER, createDrawing } from '../../js/ifcplan/drawing.js';
import { LAYERS } from '../../js/ifcplan/layers.js';

test('every layer of spec §4 has a preview colour; the legend follows the spec order, without the label layer', () => {
  assert.deepEqual(Object.keys(LAYER_COLORS).sort(), LAYERS.map(l => l.name).sort());
  for (const c of Object.values(LAYER_COLORS)) assert.match(c, /^#[0-9a-f]{6}$/);
  assert.deepEqual(LEGEND_ORDER, LAYERS.map(l => l.name).slice(0, 13));
  assert.equal(typeof createDrawing, 'function');
});

test('hover picking is coalesced: at most one pick per animation frame, at the latest pointer position', () => {
  const frames = [], on = {}, hovers = [];
  const saved = { ResizeObserver: globalThis.ResizeObserver, raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame };
  globalThis.ResizeObserver = class { observe() {} };
  globalThis.requestAnimationFrame = fn => frames.push(fn);
  globalThis.cancelAnimationFrame = id => { frames[id - 1] = null; };
  const flush = () => frames.splice(0).forEach(fn => fn && fn());
  try {
    const canvas = { getContext: () => ({}), addEventListener: (type, fn) => { on[type] = fn; }, getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 100 }) };
    createDrawing(canvas, { onHover: (layer, x, y) => hovers.push([layer, x, y]) });
    for (const x of [30, 40, 50]) on.pointermove({ pointerType: 'mouse', pointerId: 1, clientX: x, clientY: 60 });
    assert.deepEqual(hovers, [], 'nothing picked before the frame');
    assert.equal(frames.length, 1, 'one frame asked for');
    flush();
    assert.deepEqual(hovers, [[null, 50, 60]]);
    on.pointermove({ pointerType: 'mouse', pointerId: 1, clientX: 70, clientY: 60 });
    on.pointerleave({});
    flush();
    assert.deepEqual(hovers, [[null, 50, 60], [null, 0, 0]], 'leaving cancels the pending pick');
    on.pointermove({ pointerType: 'touch', pointerId: 2, clientX: 70, clientY: 60 });
    assert.equal(frames.length, 0, 'no hover on touch');
  } finally {
    globalThis.ResizeObserver = saved.ResizeObserver;
    globalThis.requestAnimationFrame = saved.raf;
    globalThis.cancelAnimationFrame = saved.caf;
  }
});
```

Run: `node _tests/extract.mjs $PLAN _tests/ifcplan/drawing.test.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 49`, `ℹ fail 1`.

- [ ] **Step 2: Write the module**

<!-- file: js/ifcplan/drawing.js -->
```js
// IFC floor plans: the preview of one storey's plan (spec §6). A Canvas 2D view: each layer in its colour (the ACI
// hue of spec §4, darkened where it would vanish on the page's light background), rooms faintly filled with their
// labels, pan with a drag, zoom with the wheel, a pinch or the buttons, and a tooltip naming the layer under the
// pointer. Every storey is fitted to the whole model, so switching storeys keeps them aligned. Coordinates are kept
// relative to the model's lower-left corner, so georeferenced coordinates stay precise.
import { LAYERS } from './layers.js?v=20261101';
import { forEachPolyline } from './chain.js?v=20261101';
import { labelLines } from './rooms.js?v=20261101';

export const LAYER_COLORS = {
  IFC_WALL: '#17170f', IFC_DOOR: '#0e7490', IFC_WINDOW: '#1d4ed8', IFC_COLUMN: '#b91c1c', IFC_BEAM: '#6b7280',
  IFC_SLAB: '#9ca3af', IFC_STAIR: '#15803d', IFC_RAILING: '#c2410c', IFC_CURTAINWALL: '#0369a1', IFC_FURNITURE: '#a16207',
  IFC_MEP: '#a21caf', IFC_OTHER: '#57534e', IFC_SPACE: '#a16207', IFC_SPACE_TEXT: '#a16207',
};
// Drawn bottom to top: rooms and slabs under everything, walls on top.
const ORDER = ['IFC_SPACE', 'IFC_SLAB', 'IFC_OTHER', 'IFC_FURNITURE', 'IFC_MEP', 'IFC_BEAM', 'IFC_CURTAINWALL', 'IFC_RAILING', 'IFC_STAIR', 'IFC_WINDOW', 'IFC_DOOR', 'IFC_COLUMN', 'IFC_WALL'];
const PICK_PX = 6;

export function createDrawing(canvas, { onHover = () => {} } = {}) {
  const ctx = canvas.getContext('2d');
  let storey = null, X0 = 0, Y0 = 0, bw = 1, bh = 1;
  let paths = new Map();                     // layer → Path2D, relative to (X0, Y0)
  let w = 1, h = 1, dpr = 1, k = 1, cx = 0, cy = 0, fitted = false, frame = 0;
  let drag = null, pinch = null, userMoved = false;
  let hover = null, hoverFrame = 0;          // the latest pointer position to pick at, one pick per frame
  const touches = new Map();

  const toModel = (sx, sy) => ({ x: (sx - w / 2) / k + cx, y: (h / 2 - sy) / k + cy });
  const local = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    if ((!fitted || !userMoved) && storey) fit(); else draw();
  }

  function fit() {
    fitted = true; userMoved = false;
    k = 0.92 * Math.min(bw > 0 ? w / bw : Infinity, bh > 0 ? h / bh : Infinity);
    if (!Number.isFinite(k) || k <= 0) k = 10;
    cx = bw / 2; cy = bh / 2;
    draw();
  }

  function build() {
    paths = new Map();
    if (!storey) return;
    for (const name of ORDER) {
      const set = storey.layers[name];
      if (!set || !set.ends.length) continue;
      const p = new Path2D();
      forEachPolyline(set, (pts, closed) => {
        if (pts.length < 4) return;
        p.moveTo(pts[0] - X0, pts[1] - Y0);
        for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i] - X0, pts[i + 1] - Y0);
        if (closed) p.closePath();
      });
      paths.set(name, p);
    }
  }

  function draw() {
    frame = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = getComputedStyle(canvas).backgroundColor || '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!storey) return;
    ctx.setTransform(dpr * k, 0, 0, -dpr * k, dpr * (w / 2 - cx * k), dpr * (h / 2 + cy * k));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [name, p] of paths) {
      if (name === 'IFC_SPACE') { ctx.globalAlpha = 0.08; ctx.fillStyle = LAYER_COLORS[name]; ctx.fill(p, 'evenodd'); }
      ctx.globalAlpha = name === 'IFC_SPACE' || name === 'IFC_SLAB' ? 0.6 : 1;
      ctx.strokeStyle = LAYER_COLORS[name];
      ctx.lineWidth = (name === 'IFC_WALL' ? 1.4 : 1) / k;
      ctx.stroke(p);
    }
    ctx.globalAlpha = 1;
    // Room labels at 0.20 m of the model, as in the DXF, when they are big enough to read.
    const px = Math.min(14, 0.2 * k);
    if (px < 6) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `500 ${px}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = LAYER_COLORS.IFC_SPACE_TEXT;
    for (const r of storey.rooms) {
      if (!r.at) continue;
      const lines = labelLines(r);
      const sx = (r.at[0] - X0 - cx) * k + w / 2, sy = h / 2 - (r.at[1] - Y0 - cy) * k;
      lines.forEach((t, i) => ctx.fillText(t, sx, sy + (i - (lines.length - 1) / 2) * px * 1.3));
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

  // The layer of the line nearest the pointer, within a few pixels; the topmost layer wins a tie.
  function layerAt(sx, sy) {
    if (!storey) return null;
    const m = toModel(sx, sy), x = m.x + X0, y = m.y + Y0, tol = PICK_PX / k;
    let best = null, bestD = tol;
    for (const name of ORDER) {
      const set = storey.layers[name];
      if (!set) continue;
      forEachPolyline(set, (pts, closed) => {
        const n = pts.length / 2;
        for (let i = closed ? 0 : 1; i < n; i++) {
          const j = i === 0 ? n - 1 : i - 1;
          const ax = pts[2 * j], ay = pts[2 * j + 1], dx = pts[2 * i] - ax, dy = pts[2 * i + 1] - ay;
          if (Math.abs(x - ax) > bestD + Math.abs(dx) || Math.abs(y - ay) > bestD + Math.abs(dy)) continue;
          const l2 = dx * dx + dy * dy;
          const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
          const d = Math.hypot(x - ax - t * dx, y - ay - t * dy);
          if (d <= bestD) { bestD = d; best = name; }
        }
      });
    }
    return best;
  }

  // Hover picking walks every polyline: done at most once per animation frame, at the latest pointer position.
  function pick() {
    hoverFrame = 0;
    const q = hover;
    hover = null;
    if (q) onHover(layerAt(q.x, q.y), q.clientX, q.clientY);
  }
  function hoverAt(p, e) {
    hover = { x: p.x, y: p.y, clientX: e.clientX, clientY: e.clientY };
    if (!hoverFrame) hoverFrame = requestAnimationFrame(pick);
  }
  function stopHover() {
    if (hoverFrame) cancelAnimationFrame(hoverFrame);
    hoverFrame = 0; hover = null;
  }

  function onDown(e) {
    if (!storey) return;
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
    if (!drag) { if (e.pointerType !== 'touch') hoverAt(p, e); return; }
    if (!drag.moved && Math.hypot(p.x - drag.x, p.y - drag.y) < 4) return;
    drag.moved = true; userMoved = true;
    cx = drag.cx - (p.x - drag.x) / k; cy = drag.cy + (p.y - drag.y) / k;
    request();
  }
  function onUp(e) {
    touches.delete(e.pointerId);
    if (pinch) { if (touches.size < 2) pinch = null; return; }
    drag = null;
  }
  function onWheel(e) {
    if (!storey) return;
    e.preventDefault();
    const p = local(e);
    zoomAt(p.x, p.y, Math.exp(-(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY) * 0.0015));
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', e => { touches.delete(e.pointerId); drag = null; pinch = null; });
  canvas.addEventListener('pointerleave', () => { stopHover(); onHover(null, 0, 0); });
  canvas.addEventListener('wheel', onWheel, { passive: false });
  new ResizeObserver(resize).observe(canvas);

  return {
    // storey: one storey of the worker's answer; bbox: the whole model's, so every storey lines up. keepView keeps
    // the pan and zoom (another storey of the same file).
    show(next, bbox, keepView = false) {
      storey = next;
      if (!keepView || !fitted) {
        X0 = bbox.x0; Y0 = bbox.y0; bw = Math.max(0, bbox.x1 - bbox.x0); bh = Math.max(0, bbox.y1 - bbox.y0); fitted = false;
      }
      build();
      resize();
    },
    clear() { storey = null; paths = new Map(); fitted = false; draw(); },
    fit, zoomBy(f) { zoomAt(w / 2, h / 2, f); },
    // The layers shown, in drawing order (for the legend and the browser check).
    get layers() { return [...paths.keys()]; },
    // For the browser check: where a model point is on screen (CSS px in the canvas), and the layer under it.
    screenOf(x, y) { return { x: (x - X0 - cx) * k + w / 2, y: h / 2 - (y - Y0 - cy) * k }; },
    layerAt,
  };
}

// The legend's order: spec §4's.
export const LEGEND_ORDER = LAYERS.map(l => l.name).filter(n => n !== 'IFC_SPACE_TEXT');
```

Run: `node _tests/extract.mjs $PLAN js/ifcplan/drawing.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 50`, `ℹ fail 0`. (The canvas itself is checked in the browser, Task 14.)

- [ ] **Step 3: Commit**

```bash
git add js/ifcplan/drawing.js _tests/ifcplan/drawing.test.js
git commit -F - <<'EOF'
IFC floor plans: the plan preview

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 11: The page, its strings and styles

**Files:**
- Create: `js/ifcplan/i18n-ifcplan.js`, `ifc-plans.html`
- Modify: `css/tools.css` (a section appended: 24 lines)
- Test: `_tests/ifcplan/i18n.test.js`

The page is `dwg-quantities.html`'s head, navigation, consent markup and consent/GA/language script, character for character (`site.test.js` pins this in Task 13), with this tool's `<main>`, footer, titles, descriptions, canonical URL and scripts. Its stylesheet link is `css/tools.css?v=20261101`; `fonts.css` and `editorial.css` keep their live `?v=`.

**Interfaces:**
- Consumes: `UNITS` (6).
- Produces: `window.IP_I18N` (`el`, `en`, `it`; `ip.*` keys, the same in every language); the page's element ids used by `ui.js` (Task 12) and the browser check: `ipInput`, `ipExample`, `ipClear`, `ipCut`, `ipUnits`, `ipOrigin`, `ipBanner`, `ipDropHint`, `ipBusy`, `ipError`, `ipPanel`, `ipStatus`, `ipRecutTime`, `ipZip`, `ipStoreys`, `ipPreviewName`, `ipFit`, `ipZoomOut`, `ipZoomIn`, `ipCanvas`, `ipTip`, `ipLegend`, `ipWarnings`, `ipCta`, `ipSurvey`, `ipThanks`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/ifcplan/i18n.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { UNITS } from '../../js/ifcplan/dxf.js';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const ph = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');

function toolStrings() {
  const window = {};
  vm.runInNewContext(read('../../js/ifcplan/i18n-ifcplan.js'), { window });
  return window.IP_I18N;
}

// Ids that reach the strings through a computed key.
const WARNINGS = ['none', 'nogeometry', 'far', 'cp1253', 'nostoreys', 'lowrooms', 'samelevel'];
const ERRORS = ['read', 'read.ifczip', 'read.ifcxml', 'schema', 'limit', 'timeout', 'engine', 'empty'];

test('tool strings: only ip.* keys, the same keys and placeholders in el, en and it', () => {
  const s = toolStrings();
  const en = Object.keys(s.en).sort();
  assert.ok(en.length >= 70, `${en.length} keys`);
  assert.ok(en.every(k => k.startsWith('ip.')));
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
  const keys = [...WARNINGS.map(id => `ip.warn.${id}`), ...ERRORS.map(id => `ip.err.${id}`), ...Object.keys(UNITS).map(u => `ip.unit.${u}`)];
  for (const k of keys) for (const l of ['el', 'en', 'it']) assert.ok(k in s[l], `${l} missing ${k}`);
});

test('every literal ip.* key the modules and the page use exists', () => {
  const s = toolStrings();
  const dir = new URL('../../js/ifcplan/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'i18n-ifcplan.js').map(f => readFileSync(new URL(f, dir), 'utf8'));
  files.push(read('../../ifc-plans.html'));
  let used = 0;
  for (const src of files) {
    for (const m of src.matchAll(/['"`](ip\.[A-Za-z0-9.-]+[A-Za-z0-9])['"`]/g)) { used++; assert.ok(m[1] in s.en, `${m[1]} has no string`); }
  }
  assert.ok(used >= 40, `${used} keys found`);
});

test('the Italian uses the typographic apostrophe and the formal voi', () => {
  const s = toolStrings();
  for (const [k, v] of Object.entries(s.it)) {
    assert.ok(!v.includes("'"), `it ${k} has a straight apostrophe`);
    assert.ok(!/\b(tu|tuo|tua|tuoi|tue|ti|Trascina|Scegli|Prova|Esporta|Controlla|Premi|Verifica)\b/.test(v), `it ${k} is not formal: ${v}`);
  }
  assert.ok(Object.values(s.it).some(v => /\b(vostro|vostri|Trascinate|scegliete)\b/.test(v)));
});

test('the page carries the Greek strings inline, as the page starts in Greek', () => {
  const s = toolStrings();
  const page = read('../../ifc-plans.html');
  let n = 0;
  for (const m of page.matchAll(/data-i18n="(ip\.[^"]+)"[^>]*>([^<]*)</g)) { n++; assert.equal(m[2], s.el[m[1]], m[1]); }
  for (const m of page.matchAll(/data-i18n-aria="(ip\.[^"]+)" aria-label="([^"]*)"/g)) { n++; assert.equal(m[2], s.el[m[1]], m[1]); }
  assert.ok(n >= 40, `${n} inline strings`);
});
```

Run: `node _tests/extract.mjs $PLAN _tests/ifcplan/i18n.test.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 50`, `ℹ fail 5` (no strings, no page).

- [ ] **Step 2: Write the strings, the page and the styles**

<!-- file: js/ifcplan/i18n-ifcplan.js -->
```js
// IFC floor plans strings (GR/EN/IT). The page merges them under its own inline keys into window.GV_I18N, which the
// shared shell's t() reads. Placeholders are {name}; every language has the same keys and placeholders. The Italian
// uses the formal "voi" and the typographic apostrophe.
window.IP_I18N = {
  el: {
    "ip.back": "Αρχική",
    "ip.eyebrow": "Δωρεάν εργαλείο",
    "ip.title": "Κατόψεις DXF από IFC",
    "ip.lede": "Ρίξτε ένα μοντέλο IFC και πάρτε μία κάτοψη R12 DXF ανά όροφο, κομμένη στο ύψος που ορίζετε: κάθε τύπος στοιχείου στη δική του στρώση, κάθε χώρος με το όνομα και το εμβαδόν του.",
    "ip.privacy": "Το αρχείο μένει στον υπολογιστή σας· τίποτα δεν ανεβαίνει.",
    "ip.indicative": "Κατόψεις κομμένες από τη γεωμετρία του μοντέλου. Ελέγξτε τες απέναντι στα σχέδια του αρχιτέκτονα.",
    "ip.cross": "Όλα τα δωρεάν εργαλεία →",
    "ip.aria.files": "Αρχείο",
    "ip.open": "Άνοιγμα αρχείου",
    "ip.example": "Φόρτωση παραδείγματος",
    "ip.clear": "Καθαρισμός",
    "ip.drop": "Σύρετε εδώ ένα αρχείο IFC, ή πατήστε «Άνοιγμα αρχείου».",
    "ip.settings": "Ρυθμίσεις",
    "ip.set.cut": "Ύψος τομής πάνω από τη στάθμη κάθε ορόφου (m)",
    "ip.set.units": "Μονάδες των DXF",
    "ip.set.origin": "Μετακίνηση στην αρχή των αξόνων",
    "ip.set.hint": "Οι ρυθμίσεις μένουν σε αυτόν τον browser. Οι μονάδες και η μετακίνηση αλλάζουν μόνο τα DXF· η μετατόπιση γράφεται σε σχόλιο μέσα σε κάθε αρχείο.",
    "ip.unit.m": "μέτρα (m)",
    "ip.unit.cm": "εκατοστά (cm)",
    "ip.unit.mm": "χιλιοστά (mm)",
    "ip.processing": "Ανάγνωση του μοντέλου…",
    "ip.large": "Μεγάλο αρχείο: η ανάγνωση ίσως αργήσει λίγο…",
    "ip.recutting": "Νέα τομή στα {h} m…",
    "ip.recut.time": "Νέα τομή στα {h} m σε {s} s.",
    "ip.engine.nowasm": "Ο browser σας δεν υποστηρίζει WebAssembly, που χρειάζεται το εργαλείο. Δοκιμάστε μια πρόσφατη έκδοση Chrome, Edge, Firefox ή Safari.",
    "ip.example.failed": "Το παράδειγμα δεν φορτώθηκε. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.",
    "ip.sum.storeys": "{n} όροφοι",
    "ip.sum.products": "{n} στοιχεία",
    "ip.sum.rooms": "{n} χώροι",
    "ip.sum.units": "DXF σε {units}",
    "ip.sum.shift": "μετατόπιση X {x} m, Y {y} m",
    "ip.storeys": "Όροφοι",
    "ip.zip": "Λήψη όλων (ZIP)",
    "ip.col.storey": "Όροφος",
    "ip.col.level": "Στάθμη (m)",
    "ip.col.cut": "Στοιχεία στην τομή",
    "ip.col.nogeo": "⚠ Χωρίς γεωμετρία",
    "ip.col.rooms": "Χώροι",
    "ip.col.dxf": "DXF",
    "ip.row.nothing": "τίποτα στα {h} m",
    "ip.row.dxf": "DXF",
    "ip.row.dxf.aria": "Λήψη DXF: {name}",
    "ip.storey.fallback": "Όροφος",
    "ip.preview": "Προεπισκόπηση",
    "ip.fit": "Προσαρμογή",
    "ip.zoomin": "Μεγέθυνση",
    "ip.zoomout": "Σμίκρυνση",
    "ip.aria.drawing": "Κάτοψη του επιλεγμένου ορόφου",
    "ip.legend": "Υπόμνημα",
    "ip.tip.layer": "Στρώση",
    "ip.warnings": "Προειδοποιήσεις",
    "ip.warn.none": "Καμία προειδοποίηση.",
    "ip.warn.nogeometry": "{n} στοιχεία δεν είχαν γεωμετρία και δεν σχεδιάζονται ({types}).",
    "ip.warn.far": "Οι συντεταγμένες απέχουν {km} km από την αρχή των αξόνων· σκεφτείτε τη «Μετακίνηση στην αρχή των αξόνων».",
    "ip.warn.cp1253": "{n} χαρακτήρες δεν γράφονται στην ελληνική κωδικοσελίδα 1253 και στα DXF γίνονται «?».",
    "ip.warn.nostoreys": "Το μοντέλο δεν έχει ορόφους: όλα μπαίνουν σε μία κάτοψη, κομμένη {h} m πάνω από το μηδέν.",
    "ip.warn.lowrooms": "{n} χώροι δεν φτάνουν στο ύψος της τομής: η ετικέτα τους μπαίνει στη μέση τους, χωρίς περίγραμμα.",
    "ip.warn.samelevel": "Ορισμένοι όροφοι βρίσκονται στο ίδιο επίπεδο ({levels})· οι κατόψεις τους μπορεί να είναι ίδιες. Ελέγξτε τις θέσεις των ορόφων στο IFC.",
    "ip.v1": "Δεν σχεδιάζονται σε αυτή την έκδοση: φορές ανοιγμάτων θυρών, σκαλοπάτια κάτω από την τομή, κρυμμένες γραμμές, διαστάσεις.",
    "ip.err.read": "Το αρχείο δεν είναι IFC που διαβάζεται: υποστηρίζεται .ifc σε μορφή κειμένου STEP.",
    "ip.err.read.ifczip": "Τα αρχεία .ifcZIP δεν υποστηρίζονται: αποσυμπιέστε το και ρίξτε το .ifc που περιέχει.",
    "ip.err.read.ifcxml": "Τα αρχεία .ifcXML δεν υποστηρίζονται: εξάγετε το μοντέλο ως .ifc (κείμενο STEP).",
    "ip.err.schema": "Ο αναγνώστης IFC δεν ανοίγει το σχήμα «{schema}». Εξάγετε το μοντέλο ως IFC2X3 ή IFC4.",
    "ip.err.limit": "Το αρχείο είναι πάνω από 150 MB, περισσότερο από όσο αντέχει αξιόπιστα μια καρτέλα browser.",
    "ip.err.timeout": "Το μοντέλο δεν διαβάστηκε σε 120 s. Για μεγάλα αρχεία, δοκιμάστε έναν browser σε υπολογιστή.",
    "ip.err.engine": "Ο αναγνώστης IFC σταμάτησε, πιθανόν από έλλειψη μνήμης. Για μεγάλα αρχεία, δοκιμάστε έναν browser σε υπολογιστή.",
    "ip.err.empty": "Το μοντέλο δεν έχει στοιχεία με γεωμετρία για να κοπούν.",
    "ip.cta.title": "Κατόψεις στα πρότυπα του γραφείου σας;",
    "ip.cta.text": "Τις στήνουμε στις δικές σας στρώσεις και τα δικά σας μπλοκ, με φορές ανοιγμάτων, διαστάσεις και μαζική μετατροπή μέσα στο CAD σας.",
    "ip.cta.link": "Επικοινωνήστε μαζί μας",
    "ip.survey.q": "Πώς παίρνετε σήμερα κατόψεις από ένα IFC;",
    "ip.survey.addon": "Με πρόσθετο στο CAD μου",
    "ip.survey.ask": "Ζητάω DWG από τον αρχιτέκτονα",
    "ip.survey.other": "Αλλιώς",
    "ip.survey.thanks": "Ευχαριστούμε!",
    "ip.notice": "Ανάγνωση IFC: web-ifc (ThatOpen Company), MPL-2.0,",
    "ip.notice.link": "ο κώδικας στο GitHub",
  },
  en: {
    "ip.back": "Home",
    "ip.eyebrow": "Free tool",
    "ip.title": "DXF floor plans from IFC",
    "ip.lede": "Drop an IFC model and get one R12 DXF floor plan per storey, cut at the height you choose: every element type on its own layer, every room with its name and area.",
    "ip.privacy": "Your file stays on your computer; nothing is uploaded.",
    "ip.indicative": "Plans cut from the model's geometry. Check them against the architect's drawings.",
    "ip.cross": "All free tools →",
    "ip.aria.files": "File",
    "ip.open": "Open file",
    "ip.example": "Load example",
    "ip.clear": "Clear",
    "ip.drop": "Drop an IFC file here, or press “Open file”.",
    "ip.settings": "Settings",
    "ip.set.cut": "Cut height above each storey's level (m)",
    "ip.set.units": "DXF units",
    "ip.set.origin": "Move to origin",
    "ip.set.hint": "The settings stay in this browser. Units and the move only change the DXFs; the shift is written as a comment in each file.",
    "ip.unit.m": "metres (m)",
    "ip.unit.cm": "centimetres (cm)",
    "ip.unit.mm": "millimetres (mm)",
    "ip.processing": "Reading the model…",
    "ip.large": "Large file: reading it may take a while…",
    "ip.recutting": "Re-cutting at {h} m…",
    "ip.recut.time": "Re-cut at {h} m in {s} s.",
    "ip.engine.nowasm": "Your browser doesn't support WebAssembly, which the tool needs. Try a recent Chrome, Edge, Firefox or Safari.",
    "ip.example.failed": "The example didn't load. Check your connection and try again.",
    "ip.sum.storeys": "{n} storeys",
    "ip.sum.products": "{n} elements",
    "ip.sum.rooms": "{n} rooms",
    "ip.sum.units": "DXF in {units}",
    "ip.sum.shift": "shift X {x} m, Y {y} m",
    "ip.storeys": "Storeys",
    "ip.zip": "Download all (ZIP)",
    "ip.col.storey": "Storey",
    "ip.col.level": "Level (m)",
    "ip.col.cut": "Elements cut",
    "ip.col.nogeo": "⚠ Without geometry",
    "ip.col.rooms": "Rooms",
    "ip.col.dxf": "DXF",
    "ip.row.nothing": "nothing at {h} m",
    "ip.row.dxf": "DXF",
    "ip.row.dxf.aria": "Download the DXF: {name}",
    "ip.storey.fallback": "Storey",
    "ip.preview": "Preview",
    "ip.fit": "Fit",
    "ip.zoomin": "Zoom in",
    "ip.zoomout": "Zoom out",
    "ip.aria.drawing": "Floor plan of the selected storey",
    "ip.legend": "Legend",
    "ip.tip.layer": "Layer",
    "ip.warnings": "Warnings",
    "ip.warn.none": "No warnings.",
    "ip.warn.nogeometry": "{n} elements had no geometry and are not drawn ({types}).",
    "ip.warn.far": "Coordinates are {km} km from the origin; consider “Move to origin”.",
    "ip.warn.cp1253": "{n} characters can't be written in Greek code page 1253 and become “?” in the DXFs.",
    "ip.warn.nostoreys": "The model has no storeys: everything goes into one plan, cut {h} m above zero.",
    "ip.warn.lowrooms": "{n} rooms don't reach the cut height: their label goes at their middle, without an outline.",
    "ip.warn.samelevel": "Several storeys sit at the same level ({levels}); their plans may be identical. Check the IFC's storey placements.",
    "ip.v1": "Not drawn in this version: door swings, stair treads below the cut, hidden lines, dimensions.",
    "ip.err.read": "This is not an IFC file the tool can read: it supports .ifc in STEP text.",
    "ip.err.read.ifczip": ".ifcZIP files are not supported: unzip it and drop the .ifc inside.",
    "ip.err.read.ifcxml": ".ifcXML files are not supported: export the model as .ifc (STEP text).",
    "ip.err.schema": "The IFC reader can't open the schema “{schema}”. Export the model as IFC2X3 or IFC4.",
    "ip.err.limit": "This file is over 150 MB, more than a browser tab handles reliably.",
    "ip.err.timeout": "The model wasn't read within 120 s. For large files, try a desktop browser.",
    "ip.err.engine": "The IFC reader stopped, probably out of memory. For large files, try a desktop browser.",
    "ip.err.empty": "The model has no elements with geometry to cut.",
    "ip.cta.title": "Plans on your office's standards?",
    "ip.cta.text": "We set them up on your own layers and blocks, with door swings, dimensions and batch conversion inside your CAD.",
    "ip.cta.link": "Contact us",
    "ip.survey.q": "How do you get floor plans from an IFC today?",
    "ip.survey.addon": "With an add-on in my CAD",
    "ip.survey.ask": "I ask the architect for DWGs",
    "ip.survey.other": "Another way",
    "ip.survey.thanks": "Thank you!",
    "ip.notice": "IFC reading: web-ifc (ThatOpen Company), MPL-2.0,",
    "ip.notice.link": "source on GitHub",
  },
  it: {
    "ip.back": "Home",
    "ip.eyebrow": "Strumento gratuito",
    "ip.title": "Piante DXF da IFC",
    "ip.lede": "Trascinate un modello IFC e ottenete una pianta DXF R12 per piano, tagliata all’altezza che scegliete: ogni tipo di elemento sul proprio layer, ogni locale con il suo nome e la sua superficie.",
    "ip.privacy": "Il vostro file resta sul vostro computer; nulla viene caricato.",
    "ip.indicative": "Piante tagliate dalla geometria del modello. Verificatele con i disegni dell’architetto.",
    "ip.cross": "Tutti gli strumenti gratuiti →",
    "ip.aria.files": "File",
    "ip.open": "Apri file",
    "ip.example": "Carica esempio",
    "ip.clear": "Svuota",
    "ip.drop": "Trascinate qui un file IFC, oppure premete «Apri file».",
    "ip.settings": "Impostazioni",
    "ip.set.cut": "Altezza del taglio sopra la quota di ogni piano (m)",
    "ip.set.units": "Unità dei DXF",
    "ip.set.origin": "Sposta nell’origine",
    "ip.set.hint": "Le impostazioni restano in questo browser. Le unità e lo spostamento cambiano solo i DXF; lo spostamento è scritto come commento in ogni file.",
    "ip.unit.m": "metri (m)",
    "ip.unit.cm": "centimetri (cm)",
    "ip.unit.mm": "millimetri (mm)",
    "ip.processing": "Lettura del modello…",
    "ip.large": "File grande: la lettura potrebbe richiedere un po’ di tempo…",
    "ip.recutting": "Nuovo taglio a {h} m…",
    "ip.recut.time": "Nuovo taglio a {h} m in {s} s.",
    "ip.engine.nowasm": "Il vostro browser non supporta WebAssembly, necessario allo strumento. Provate una versione recente di Chrome, Edge, Firefox o Safari.",
    "ip.example.failed": "L’esempio non è stato caricato. Controllate la connessione e riprovate.",
    "ip.sum.storeys": "{n} piani",
    "ip.sum.products": "{n} elementi",
    "ip.sum.rooms": "{n} locali",
    "ip.sum.units": "DXF in {units}",
    "ip.sum.shift": "spostamento X {x} m, Y {y} m",
    "ip.storeys": "Piani",
    "ip.zip": "Scarica tutto (ZIP)",
    "ip.col.storey": "Piano",
    "ip.col.level": "Quota (m)",
    "ip.col.cut": "Elementi tagliati",
    "ip.col.nogeo": "⚠ Senza geometria",
    "ip.col.rooms": "Locali",
    "ip.col.dxf": "DXF",
    "ip.row.nothing": "niente a {h} m",
    "ip.row.dxf": "DXF",
    "ip.row.dxf.aria": "Scarica il DXF: {name}",
    "ip.storey.fallback": "Piano",
    "ip.preview": "Anteprima",
    "ip.fit": "Adatta",
    "ip.zoomin": "Ingrandisci",
    "ip.zoomout": "Riduci",
    "ip.aria.drawing": "Pianta del piano selezionato",
    "ip.legend": "Legenda",
    "ip.tip.layer": "Layer",
    "ip.warnings": "Avvisi",
    "ip.warn.none": "Nessun avviso.",
    "ip.warn.nogeometry": "{n} elementi non avevano geometria e non sono disegnati ({types}).",
    "ip.warn.far": "Le coordinate distano {km} km dall’origine; valutate «Sposta nell’origine».",
    "ip.warn.cp1253": "{n} caratteri non si possono scrivere nella code page greca 1253 e nei DXF diventano «?».",
    "ip.warn.nostoreys": "Il modello non ha piani: tutto va in un’unica pianta, tagliata {h} m sopra lo zero.",
    "ip.warn.lowrooms": "{n} locali non arrivano all’altezza del taglio: la loro etichetta va al centro, senza contorno.",
    "ip.warn.samelevel": "Più piani si trovano allo stesso livello ({levels}); le loro piante potrebbero essere identiche. Verificate la posizione dei piani nell’IFC.",
    "ip.v1": "Non disegnati in questa versione: aperture delle porte, gradini sotto il taglio, linee nascoste, quote.",
    "ip.err.read": "Non è un file IFC leggibile dallo strumento: è supportato .ifc in testo STEP.",
    "ip.err.read.ifczip": "I file .ifcZIP non sono supportati: decomprimetelo e trascinate il .ifc che contiene.",
    "ip.err.read.ifcxml": "I file .ifcXML non sono supportati: esportate il modello come .ifc (testo STEP).",
    "ip.err.schema": "Il lettore IFC non apre lo schema «{schema}». Esportate il modello come IFC2X3 o IFC4.",
    "ip.err.limit": "Il file supera i 150 MB, più di quanto una scheda del browser gestisca in modo affidabile.",
    "ip.err.timeout": "Il modello non è stato letto entro 120 s. Per file grandi, provate un browser su computer.",
    "ip.err.engine": "Il lettore IFC si è fermato, probabilmente per mancanza di memoria. Per file grandi, provate un browser su computer.",
    "ip.err.empty": "Il modello non ha elementi con geometria da tagliare.",
    "ip.cta.title": "Piante secondo gli standard del vostro studio?",
    "ip.cta.text": "Le impostiamo sui vostri layer e sui vostri blocchi, con aperture delle porte, quote e conversione in serie nel vostro CAD.",
    "ip.cta.link": "Contattateci",
    "ip.survey.q": "Come ottenete oggi le piante da un IFC?",
    "ip.survey.addon": "Con un plug-in nel mio CAD",
    "ip.survey.ask": "Chiedo i DWG all’architetto",
    "ip.survey.other": "In un altro modo",
    "ip.survey.thanks": "Grazie!",
    "ip.notice": "Lettura IFC: web-ifc (ThatOpen Company), MPL-2.0,",
    "ip.notice.link": "sorgente su GitHub",
  },
};
```

<!-- file: ifc-plans.html -->
```html
<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AidedCAM - Κατόψεις DXF από IFC</title>
  <meta name="description" content="Δωρεάν κατόψεις DXF από μοντέλα IFC: μία κάτοψη R12 ανά όροφο, κάθε τύπος στοιχείου σε δική του στρώση, οι χώροι με όνομα και εμβαδόν. Στον browser, χωρίς ανέβασμα, χωρίς εγγραφή." />
  <meta name="robots" content="index, follow" />
  <link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="icon-192.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png" />
  <meta name="theme-color" content="#f4f3ee" />
  <link rel="canonical" href="https://www.aidedcam.com/ifc-plans.html" />
  <meta property="og:title" content="AidedCAM - Κατόψεις DXF από IFC" />
  <meta property="og:description" content="Ρίξτε ένα IFC και πάρτε μία κάτοψη DXF ανά όροφο, με στρώσεις ανά τύπο στοιχείου και τους χώρους με όνομα και εμβαδόν." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://www.aidedcam.com/ifc-plans.html" />
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
  <link rel="stylesheet" href="css/tools.css?v=20261101" />
</head>
<body>

  <nav class="navbar" id="navbar">
    <div class="nav-container">
      <a href="index.html" class="nav-logo">
        <img src="aided-cam-mark.png" alt="AidedCAM" width="30" height="34" />
        <img class="wordmark" src="aidedcam-wordmark.svg" alt="" width="716" height="67" />
      </a>
      <div class="nav-right">
        <a href="index.html" class="nav-back" data-i18n="ip.back">Αρχική</a>
        <div class="lang-switcher">
          <button class="lang-btn active" data-lang="el">EL</button>
          <button class="lang-btn" data-lang="en">EN</button>
          <button class="lang-btn" data-lang="it">IT</button>
        </div>
      </div>
    </div>
  </nav>

  <main class="gv ip">
    <header class="gv-head">
      <p class="gv-eyebrow" data-i18n="ip.eyebrow">Δωρεάν εργαλείο</p>
      <h1 data-i18n="ip.title">Κατόψεις DXF από IFC</h1>
      <p class="gv-lede" data-i18n="ip.lede">Ρίξτε ένα μοντέλο IFC και πάρτε μία κάτοψη R12 DXF ανά όροφο, κομμένη στο ύψος που ορίζετε: κάθε τύπος στοιχείου στη δική του στρώση, κάθε χώρος με το όνομα και το εμβαδόν του.</p>
      <p class="gv-privacy" data-i18n="ip.privacy">Το αρχείο μένει στον υπολογιστή σας· τίποτα δεν ανεβαίνει.</p>
      <p class="ip-indicative" data-i18n="ip.indicative">Κατόψεις κομμένες από τη γεωμετρία του μοντέλου. Ελέγξτε τες απέναντι στα σχέδια του αρχιτέκτονα.</p>
      <p class="gv-cross"><a href="free-tools.html" data-i18n="ip.cross">Όλα τα δωρεάν εργαλεία →</a></p>
    </header>

    <div class="gv-wrap">
      <noscript><p class="gv-banner">Το εργαλείο χρειάζεται JavaScript. / The tool needs JavaScript.</p></noscript>

      <section class="gv-bar ip-bar" data-i18n-aria="ip.aria.files" aria-label="Αρχείο">
        <label class="gv-btn gv-btn-primary gv-file-label">
          <input type="file" id="ipInput" accept=".ifc" class="gv-visually-hidden" />
          <span data-i18n="ip.open">Άνοιγμα αρχείου</span>
        </label>
        <button type="button" class="gv-btn" id="ipExample" data-i18n="ip.example">Φόρτωση παραδείγματος</button>
        <button type="button" class="gv-btn" id="ipClear" data-i18n="ip.clear" hidden>Καθαρισμός</button>
      </section>

      <section class="ip-settings" id="ipSettings">
        <h2 data-i18n="ip.settings">Ρυθμίσεις</h2>
        <div class="gv-settings-grid">
          <label><span data-i18n="ip.set.cut">Ύψος τομής πάνω από τη στάθμη κάθε ορόφου (m)</span><input type="text" inputmode="decimal" id="ipCut" value="1,10" /></label>
          <label><span data-i18n="ip.set.units">Μονάδες των DXF</span><select id="ipUnits"></select></label>
          <label class="ip-check"><input type="checkbox" id="ipOrigin" /><span data-i18n="ip.set.origin">Μετακίνηση στην αρχή των αξόνων</span></label>
        </div>
        <p class="gv-note" data-i18n="ip.set.hint">Οι ρυθμίσεις μένουν σε αυτόν τον browser. Οι μονάδες και η μετακίνηση αλλάζουν μόνο τα DXF· η μετατόπιση γράφεται σε σχόλιο μέσα σε κάθε αρχείο.</p>
      </section>

      <div class="gv-banner" id="ipBanner" role="status" hidden></div>
      <p class="gv-drop-hint" id="ipDropHint" data-i18n="ip.drop">Σύρετε εδώ ένα αρχείο IFC, ή πατήστε «Άνοιγμα αρχείου».</p>
      <p class="gv-note ip-busy" id="ipBusy" role="status" hidden></p>
      <div class="dq-error" id="ipError" role="alert" hidden></div>

      <section class="ip-panel" id="ipPanel" hidden>
        <div class="dq-status ip-status" id="ipStatus"></div>
        <p class="gv-note" id="ipRecutTime" hidden></p>

        <div class="ip-table-head">
          <h2 data-i18n="ip.storeys">Όροφοι</h2>
          <button type="button" class="gv-btn" id="ipZip" data-i18n="ip.zip">Λήψη όλων (ZIP)</button>
        </div>
        <div class="gv-table-wrap">
          <table class="gv-table ip-storeys" id="ipStoreys">
            <thead><tr><th data-i18n="ip.col.storey">Όροφος</th><th class="dq-num" data-i18n="ip.col.level">Στάθμη (m)</th><th class="dq-num" data-i18n="ip.col.cut">Στοιχεία στην τομή</th><th class="dq-num" data-i18n="ip.col.nogeo">⚠ Χωρίς γεωμετρία</th><th class="dq-num" data-i18n="ip.col.rooms">Χώροι</th><th data-i18n="ip.col.dxf">DXF</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>

        <div class="ip-view">
          <div class="gv-panel-head">
            <span><span data-i18n="ip.preview">Προεπισκόπηση</span> · <span id="ipPreviewName"></span></span>
            <span class="gv-tools-controls">
              <button type="button" class="gv-link" id="ipFit" data-i18n="ip.fit">Προσαρμογή</button>
              <button type="button" class="gv-zoom" id="ipZoomOut" data-i18n-aria="ip.zoomout" aria-label="Σμίκρυνση">−</button>
              <button type="button" class="gv-zoom" id="ipZoomIn" data-i18n-aria="ip.zoomin" aria-label="Μεγέθυνση">+</button>
            </span>
          </div>
          <div class="dq-canvas-box">
            <canvas class="dq-canvas ip-canvas" id="ipCanvas" role="img" data-i18n-aria="ip.aria.drawing" aria-label="Κάτοψη του επιλεγμένου ορόφου"></canvas>
            <div class="dq-tip" id="ipTip" hidden></div>
          </div>
          <ul class="ip-legend" id="ipLegend" data-i18n-aria="ip.legend" aria-label="Υπόμνημα"></ul>
        </div>

        <h2 class="ip-h" data-i18n="ip.warnings">Προειδοποιήσεις</h2>
        <ul class="gv-check-list ip-warnings" id="ipWarnings"></ul>
      </section>

      <p class="gv-note ip-v1" data-i18n="ip.v1">Δεν σχεδιάζονται σε αυτή την έκδοση: φορές ανοιγμάτων θυρών, σκαλοπάτια κάτω από την τομή, κρυμμένες γραμμές, διαστάσεις.</p>

      <section class="gv-cta">
        <h2 data-i18n="ip.cta.title">Κατόψεις στα πρότυπα του γραφείου σας;</h2>
        <p data-i18n="ip.cta.text">Τις στήνουμε στις δικές σας στρώσεις και τα δικά σας μπλοκ, με φορές ανοιγμάτων, διαστάσεις και μαζική μετατροπή μέσα στο CAD σας.</p>
        <a class="btn-primary" id="ipCta" href="index.html#contact" data-i18n="ip.cta.link">Επικοινωνήστε μαζί μας</a>
        <div class="gv-survey" id="ipSurvey">
          <p data-i18n="ip.survey.q">Πώς παίρνετε σήμερα κατόψεις από ένα IFC;</p>
          <button type="button" class="gv-chip" data-answer="addon" data-i18n="ip.survey.addon">Με πρόσθετο στο CAD μου</button>
          <button type="button" class="gv-chip" data-answer="ask" data-i18n="ip.survey.ask">Ζητάω DWG από τον αρχιτέκτονα</button>
          <button type="button" class="gv-chip" data-answer="other" data-i18n="ip.survey.other">Αλλιώς</button>
          <p class="gv-thanks" id="ipThanks" data-i18n="ip.survey.thanks" hidden>Ευχαριστούμε!</p>
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
    <p class="lc-notice"><span data-i18n="ip.notice">Ανάγνωση IFC: web-ifc (ThatOpen Company), MPL-2.0,</span> <a href="https://github.com/ThatOpen/engine_web-ifc" rel="noopener" data-i18n="ip.notice.link">ο κώδικας στο GitHub</a></p>
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

  <script src="js/ifcplan/i18n-ifcplan.js?v=20261101"></script>
  <script>
    var translations = {
      el: {
        "_title": "AidedCAM - Κατόψεις DXF από IFC",
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
        "_title": "AidedCAM - DXF floor plans from IFC",
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
        "_title": "AidedCAM - Piante DXF da IFC",
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
      translations[l] = Object.assign({}, (window.IP_I18N || {})[l] || {}, translations[l]);
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
  <script type="module" src="js/ifcplan/ui.js?v=20261101"></script>
</body>
</html>
```

`css/tools.css` gains the last 24 lines, the section `/* ---- ifc-plans.html: DXF floor plans from IFC (spec §6) ---- */`; every class in it starts with `ip-` or is scoped under one.

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
```

Run:
```bash
for f in js/ifcplan/i18n-ifcplan.js ifc-plans.html css/tools.css; do node _tests/extract.mjs $PLAN $f; done
git diff --stat
node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
```
Expected: `css/tools.css | 24 ++++++++++++++++++++++++` (24 insertions, no deletions; git may warn that LF will be replaced by CRLF, which is the checkout's `core.autocrlf` and harmless), then `ℹ pass 55`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/ifcplan/i18n-ifcplan.js ifc-plans.html css/tools.css _tests/ifcplan/i18n.test.js
git commit -F - <<'EOF'
IFC floor plans: the page, its strings and styles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 12: The controller

**Files:**
- Create: `js/ifcplan/state.js`, `js/ifcplan/ui.js`
- Test: `_tests/ifcplan/state.test.js`

**Interfaces:**
- Consumes: the shell (`t`, `ga`, `lang`, `lsGet`, `lsSet`, `renderBanner`), `createEngine` (`js/laser/bridge.js`), `zipStore`, `uniqueNames` (`js/laser/zip.js`), `storeyDxf`, `originShift`, `UNITS`, `unencodable` (6), `storeyFileNames`, `zipName`, `stem` (6), `MAX_BYTES`, `LARGE_BYTES` (8), the worker (9), `createDrawing`, `LAYER_COLORS`, `LEGEND_ORDER` (10), the page (11).
- Produces (`js/ifcplan/state.js`, pure): `SETTINGS_KEY`, `DEFAULTS` (`{ cutM: 1.1, units: 'm', origin: false }`), `CUT_MAX` (10), `FAR_KM` (10), `cleanSettings(obj)`, `parseCut(text) → number | undefined`, `showM(v, lang)`, `sizeBucket(bytes)`, `storeysBucket(n)`, `textsOf(result, fileName)`, `warningsOf(result, { fileName, cutM, origin }) → [{ id, params }]` (ids `nostoreys`, `nogeometry`, `far`, `lowrooms`, `cp1253`, in that order).
- Produces (`js/ifcplan/ui.js`): the page's behaviour; `window.__ifcp = { timings: { example | file, recut }, drawing }` for the browser check.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/ifcplan/state.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanSettings, parseCut, showM, sizeBucket, storeysBucket, warningsOf, textsOf, DEFAULTS, SETTINGS_KEY } from '../../js/ifcplan/state.js';

const result = over => ({
  file: { noStoreys: false, noGeometry: [], bbox: { x0: 120.5, y0: 80.25, x1: 130.5, y1: 88.35 }, ...over },
  storeys: [
    { name: 'Ισόγειο', rooms: [{ name: 'Σαλόνι', longName: '', areaM2: 43.61, crossed: true }] },
    { name: 'Όροφος 1', rooms: [{ name: '1.01', longName: 'Υπνοδωμάτιο', areaM2: 36.1, crossed: true }] },
  ],
});

test('settings: the defaults of spec §2, and only well-formed stored values are kept', () => {
  assert.equal(SETTINGS_KEY, 'aidedcam-ifcp-settings');
  assert.deepEqual(DEFAULTS, { cutM: 1.1, units: 'm', origin: false });
  assert.deepEqual(cleanSettings(null), DEFAULTS);
  assert.deepEqual(cleanSettings({ cutM: 0.9, units: 'mm', origin: true }), { cutM: 0.9, units: 'mm', origin: true });
  assert.deepEqual(cleanSettings({ cutM: -1, units: 'ft', origin: 'yes' }), DEFAULTS);
  assert.deepEqual(cleanSettings({ cutM: '1.5', units: 'toString' }), DEFAULTS);
});

test('the cut height: a comma or a point, from 0 to 10 m; anything else is refused, never guessed', () => {
  assert.deepEqual(['1,10', '1.10', '0', ' 2.5 ', '10'].map(parseCut), [1.1, 1.1, 0, 2.5, 10]);
  assert.deepEqual(['', '1,100.5', '1.380,5', '-1', '1e2', '10.01', 'abc', ',5'].map(parseCut), Array(8).fill(undefined));
  assert.deepEqual([showM(1.1, 'el'), showM(1.1, 'en'), showM(0, 'it')], ['1,10', '1.10', '0,00']);
});

test('GA buckets: sizes and storey counts, never the figures', () => {
  assert.deepEqual([0, 10 * 1024 * 1024 - 1, 10 * 1024 * 1024, 50 * 1024 * 1024, 50 * 1024 * 1024 + 1].map(sizeBucket), ['under-10mb', 'under-10mb', '10-50mb', '10-50mb', 'over-50mb']);
  assert.deepEqual([1, 2, 5, 6, 20, 21].map(storeysBucket), ['1', '2-5', '2-5', '6-20', '6-20', 'over-20']);
});

test('warnings: none on a clean model; missing geometry by type, far coordinates, no storeys, low rooms, code page', () => {
  assert.deepEqual(warningsOf(result(), { fileName: 'σπίτι.ifc', cutM: 1.1, origin: false }), []);
  const r = result({ noStoreys: true, noGeometry: [{ type: 'IfcWallStandardCase', count: 51 }, { type: 'IfcBuildingElementProxy', count: 14 }], bbox: { x0: 538450.5, y0: 6591584.1, x1: 538511, y1: 6591628.1 } });
  r.storeys[0].rooms.push({ name: 'Hall ✓', longName: '', areaM2: null, crossed: false });
  assert.deepEqual(warningsOf(r, { fileName: 'Küche−1.ifc', cutM: 1.1, origin: false }), [
    { id: 'nostoreys', params: { h: 1.1 } },
    { id: 'nogeometry', params: { n: 65, types: 'IfcWallStandardCase 51, IfcBuildingElementProxy 14' } },
    { id: 'far', params: { km: 6592 } },
    { id: 'lowrooms', params: { n: 1 } },
    { id: 'cp1253', params: { n: 3 } },
  ]);
  assert.ok(!warningsOf(r, { fileName: 'x.ifc', cutM: 1.1, origin: true }).some(w => w.id === 'far'), 'not once the plans are moved');
  assert.deepEqual(textsOf(result(), 'a.ifc'), ['a.ifc', 'Ισόγειο', 'Σαλόνι', '43.61 m²', 'Όροφος 1', '1.01', 'Υπνοδωμάτιο', '36.10 m²']);
});

test('storeys at one level (within 1 mm): a warning naming each shared level', () => {
  const at = levels => ({ file: { noStoreys: false, noGeometry: [], bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } }, storeys: levels.map((levelM, i) => ({ name: `S${i}`, levelM, rooms: [] })) });
  const opts = { fileName: 'a.ifc', cutM: 1.1, origin: false };
  assert.deepEqual(warningsOf(at([0, 3, 3.0004, 6, 6, 6, 9]), opts), [{ id: 'samelevel', params: { levels: [3, 6] } }]);
  assert.deepEqual(warningsOf(at([0, 0.0011, 3, 6]), opts), [], 'over 1 mm apart');
  assert.deepEqual(warningsOf(at([0]), opts), []);
  const r = at([0, 0]);
  r.file.noGeometry = [{ type: 'IfcWall', count: 1 }];
  assert.deepEqual(warningsOf(r, opts).map(w => w.id), ['samelevel', 'nogeometry']);
});
```

Run: `node _tests/extract.mjs $PLAN _tests/ifcplan/state.test.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 55`, `ℹ fail 1`.

- [ ] **Step 2: Write the modules**

<!-- file: js/ifcplan/state.js -->
```js
// IFC floor plans: the controller's small decisions (spec §2, §6, §8), kept pure for the Node tests: the stored
// settings, the typed cut height, the GA buckets and the warnings.
import { UNITS, unencodable } from './dxf.js?v=20261101';
import { labelLines } from './rooms.js?v=20261101';

export const SETTINGS_KEY = 'aidedcam-ifcp-settings';
export const DEFAULTS = { cutM: 1.1, units: 'm', origin: false };
export const CUT_MAX = 10;                 // m above each storey's level
export const FAR_KM = 10;                  // coordinates farther than this suggest "move to origin"
export const SAME_LEVEL_M = 0.001;         // storeys this close in world Z sit at one level

const validCut = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= CUT_MAX;

// The settings read back from storage: only well-formed values survive, the rest are the defaults.
export function cleanSettings(obj) {
  const o = obj && typeof obj === 'object' ? obj : {};
  return {
    cutM: validCut(o.cutM) ? o.cutM : DEFAULTS.cutM,
    units: Object.prototype.hasOwnProperty.call(UNITS, o.units) ? o.units : DEFAULTS.units,
    origin: o.origin === true,
  };
}

// A typed cut height in metres: one decimal separator, comma or point, from 0 to 10 m. undefined when it is not one.
export function parseCut(text) {
  const s = String(text).trim();
  if (!/^\d+([.,]\d+)?$/.test(s)) return undefined;
  const v = Number(s.replace(',', '.'));
  return validCut(v) ? v : undefined;
}

// A height as the page shows it: 2 decimals, the page language's separator.
export const showM = (v, lang) => {
  const s = v.toFixed(2);
  return lang === 'en' ? s : s.replace('.', ',');
};

// GA buckets (spec §8): never the size or the storey count itself.
export const sizeBucket = bytes => (bytes < 10 * 1024 * 1024 ? 'under-10mb' : bytes <= 50 * 1024 * 1024 ? '10-50mb' : 'over-50mb');
export const storeysBucket = n => (n <= 1 ? '1' : n <= 5 ? '2-5' : n <= 20 ? '6-20' : 'over-20');

// Every string the DXFs write as text: the file name, the storey names and the room labels.
export function textsOf(result, fileName) {
  const out = [fileName];
  for (const s of result.storeys) {
    out.push(s.name);
    for (const r of s.rooms) out.push(...labelLines(r));
  }
  return out;
}

// The levels (m) shared by two or more storeys, each once, lowest first: their plans are cut at one height.
function sharedLevels(storeys) {
  const levels = storeys.map(s => s.levelM).filter(Number.isFinite).sort((a, b) => a - b);
  const out = [];
  for (let i = 1, start = 0; i <= levels.length; i++) {
    if (i < levels.length && levels[i] - levels[i - 1] <= SAME_LEVEL_M) continue;
    if (i - start > 1) out.push(levels[start]);
    start = i;
  }
  return out;
}

// The warnings of spec §6/§7, each { id, params }, in the order the page lists them.
export function warningsOf(result, { fileName, cutM, origin }) {
  const out = [];
  const f = result.file;
  if (f.noStoreys) out.push({ id: 'nostoreys', params: { h: cutM } });
  const levels = sharedLevels(result.storeys);
  if (levels.length) out.push({ id: 'samelevel', params: { levels } });
  const missing = f.noGeometry.reduce((a, x) => a + x.count, 0);
  if (missing) out.push({ id: 'nogeometry', params: { n: missing, types: f.noGeometry.map(x => `${x.type} ${x.count}`).join(', ') } });
  const b = f.bbox;
  const far = Math.max(Math.abs(b.x0), Math.abs(b.x1), Math.abs(b.y0), Math.abs(b.y1)) / 1000;
  if (!origin && far > FAR_KM) out.push({ id: 'far', params: { km: Math.round(far) } });
  const low = result.storeys.reduce((a, s) => a + s.rooms.filter(r => !r.crossed).length, 0);
  if (low) out.push({ id: 'lowrooms', params: { n: low } });
  const bad = unencodable(textsOf(result, fileName));
  if (bad) out.push({ id: 'cp1253', params: { n: bad } });
  return out;
}
```

<!-- file: js/ifcplan/ui.js -->
```js
// IFC floor plans: the page controller (spec §6). One file at a time goes to the web-ifc worker through the shared
// bridge; the page keeps its answer (every storey's plan in metres) and writes the DXFs from it on download, so the
// units and the move to origin need no new cut. A changed cut height re-cuts the open model in the worker.
import { t, ga, lang } from '../gcode/shell/i18n.js';
import { lsGet, lsSet } from '../gcode/shell/settings-store.js';
import { renderBanner } from '../gcode/shell/banner.js';
import { createEngine } from '../laser/bridge.js?v=20261101';
import { zipStore, uniqueNames } from '../laser/zip.js?v=20261101';
import { storeyDxf, originShift, UNITS } from './dxf.js?v=20261101';
import { storeyFileNames, zipName, stem } from './names.js?v=20261101';
import { MAX_BYTES, LARGE_BYTES } from './model.js?v=20261101';
import { cleanSettings, parseCut, showM, sizeBucket, storeysBucket, warningsOf, SETTINGS_KEY } from './state.js?v=20261101';
import { createDrawing, LAYER_COLORS, LEGEND_ORDER } from './drawing.js?v=20261101';

const $ = id => document.getElementById(id);
const SURVEY_KEY = 'aidedcam-ifcp-survey';
const EXAMPLE = 'example-house.ifc';
const TIMEOUT_MS = 120000;                 // spec §7

const state = {
  file: null,            // { name, bytes, source, result, error, gen }
  settings: cleanSettings(safeJson(lsGet(SETTINGS_KEY))),
  selected: 0,
  banner: null,
  busy: null,            // { key, params }
  recutMs: null,
};
let latest = 0;          // the newest file choice; a slower, earlier read must not replace it
window.__ifcp = { timings: {} };           // read by the browser check: file, example and re-cut times (ms)
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
  makeWorker: () => new Worker(new URL('./worker.js?v=20261101', import.meta.url), { type: 'module' }),
  timeoutMs: TIMEOUT_MS,
}) : null;
if (!supported) showBanner({ key: 'ip.engine.nowasm' });

async function run(f, settings) {
  return engine ? engine.process(f.name, f.bytes.slice(0), settings) : { type: 'error', reason: 'engine' };
}

async function loadFile(name, bytes, source, t0 = performance.now()) {
  const f = { name, bytes, source, result: null, gen: 0 };
  state.file = f; state.selected = 0; state.recutMs = null;
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
    const pick = () => { if (state.selected !== i) { state.selected = i; renderTable(f); renderPreview(f, true); } };
    tr.addEventListener('click', pick);
    tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    return tr;
  });
  $('ipStoreys').tBodies[0].replaceChildren(...rows);
}

function renderPreview(f, keepView) {
  const r = f.result, s = r.storeys[state.selected];
  $('ipPreviewName').textContent = s.name || names(f)[state.selected].replace(/^\d+ |\.dxf$/g, '');
  drawing.show(s, r.file.bbox, keepView);
  const shown = new Set(drawing.layers);
  $('ipLegend').replaceChildren(...LEGEND_ORDER.filter(n => shown.has(n)).map(n => {
    const li = el('li');
    const sw = el('span', 'ip-swatch');
    sw.style.borderColor = LAYER_COLORS[n];
    li.append(sw, n);
    return li;
  }));
}

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

// ---- the preview ----
const drawing = createDrawing($('ipCanvas'), {
  onHover(layer, x, y) {
    const tip = $('ipTip');
    if (!layer) { tip.hidden = true; return; }
    tip.replaceChildren(el('b', null, `${t('ip.tip.layer')}: `), document.createTextNode(layer));
    const box = $('ipCanvas').getBoundingClientRect();
    tip.hidden = false;
    let left = x - box.left + 14, top = y - box.top + 14;
    if (left + tip.offsetWidth > box.width) left = Math.max(0, x - box.left - tip.offsetWidth - 10);
    if (top + tip.offsetHeight > box.height) top = Math.max(0, y - box.top - tip.offsetHeight - 10);
    tip.style.left = `${left}px`; tip.style.top = `${top}px`;
  },
});
window.__ifcp.drawing = drawing;
$('ipFit').addEventListener('click', () => drawing.fit());
$('ipZoomIn').addEventListener('click', () => drawing.zoomBy(1.25));
$('ipZoomOut').addEventListener('click', () => drawing.zoomBy(1 / 1.25));

// ---- downloads ----
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
    const f = { name: file.name, bytes: null, source: 'file', result: { type: 'error', reason: 'read' }, gen: 0 };
    state.file = f; state.selected = 0; state.recutMs = null;
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
    const r = await fetch(new URL(`./examples/${EXAMPLE}?v=20261101`, import.meta.url));
    if (!r.ok) throw new Error(String(r.status));
    bytes = await r.arrayBuffer();
  } catch (e) { if (my === latest) showBanner({ key: 'ip.example.failed' }); return; }
  if (my !== latest) return;
  await loadFile(EXAMPLE, bytes, 'example', t0);
});
$('ipClear').addEventListener('click', () => { latest++; state.file = null; state.recutMs = null; busy(null); render(); });

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
  render(true);
});

renderSettings();
render();
```

Run:
```bash
node _tests/extract.mjs $PLAN js/ifcplan/state.js && node _tests/extract.mjs $PLAN js/ifcplan/ui.js
node --check js/ifcplan/ui.js && echo syntax-ok
node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
```
Expected: `syntax-ok`, then `ℹ pass 59`, `ℹ fail 0` (`i18n.test.js` now also reads `ui.js`'s keys).

- [ ] **Step 3: Commit**

```bash
git add js/ifcplan/state.js js/ifcplan/ui.js _tests/ifcplan/state.test.js
git commit -F - <<'EOF'
IFC floor plans: the controller

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 13: Site links, and the checks on the page

Changed existing files (given whole below):
- `free-tools.html` adds 11 lines: the card in "Engineering offices" (after the coverage card), and `ft.ifcplans.title` and `ft.ifcplans.text` in el/en/it;
- `sitemap.xml` adds a 6-line entry, with the `lastmod` placeholder `2026-11-01`;
- `llms.txt` adds 1 line under "Free tools".

**Files:**
- Modify: `free-tools.html`, `sitemap.xml`, `llms.txt`
- Test: `_tests/ifcplan/site.test.js`

**Interfaces:**
- Produces: the card `<a class="ft-card" href="ifc-plans.html">`. The existing `_tests/gcode/i18n.test.js` (`tools index: every key it uses exists in el, en and it`) covers its keys. `site.test.js` checks the index, the sitemap and llms.txt; the page's notice and canonical and the absence of Eyeshot; consent, GA and the switcher against DWG quantities'; the `?v=20261101` placeholders.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/ifcplan/site.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout has CRLF

test('the tools index, the sitemap and llms.txt list the IFC floor plans', () => {
  const ft = read('../../free-tools.html');
  assert.ok(ft.includes('<a class="ft-card" href="ifc-plans.html">'));
  const eng = ft.slice(ft.indexOf('data-i18n="ft.group.eng"'), ft.indexOf('</section>', ft.indexOf('data-i18n="ft.group.eng"')));
  assert.ok(eng.includes('href="ifc-plans.html"'), 'in the Engineering offices group');
  assert.equal(ft.split('"ft.ifcplans.title":').length - 1, 3, 'one card title per language');
  assert.equal(ft.split('"ft.ifcplans.text":').length - 1, 3, 'one card text per language');
  const sm = read('../../sitemap.xml');
  assert.ok(sm.includes('<loc>https://www.aidedcam.com/ifc-plans.html</loc>\n    <lastmod>2026-11-01</lastmod>'), 'with the lastmod placeholder');
  assert.ok(read('../../llms.txt').includes('- DXF floor plans from IFC (https://www.aidedcam.com/ifc-plans.html)'));
});

test('the page: canonical, the web-ifc notice with its link, the indicative note, and no Eyeshot', () => {
  const page = read('../../ifc-plans.html');
  assert.ok(page.includes('<link rel="canonical" href="https://www.aidedcam.com/ifc-plans.html" />'));
  assert.ok(page.includes('<span data-i18n="ip.notice">Ανάγνωση IFC: web-ifc (ThatOpen Company), MPL-2.0,</span> <a href="https://github.com/ThatOpen/engine_web-ifc" rel="noopener" data-i18n="ip.notice.link">'));
  assert.ok(page.includes('data-i18n="ip.indicative"'));
  assert.ok(page.includes('data-i18n="ip.v1"'));
  assert.ok(!/devDept|Eyeshot/i.test(page), 'web-ifc only');
  assert.ok(!/src="[^"]*vendor\//.test(page), 'web-ifc loads in the worker, on the first file');
  for (const f of readdirSync(new URL('../../js/ifcplan/', import.meta.url)).filter(n => n.endsWith('.js'))) {
    assert.ok(!/eyeshot|devdept|dotnet/i.test(read(`../../js/ifcplan/${f}`)), f);
  }
});

test('consent, GA and the language switcher are those of the DWG quantities page', () => {
  const a = read('../../dwg-quantities.html'), b = read('../../ifc-plans.html');
  const between = (s, from, to) => s.slice(s.indexOf(from), s.indexOf(to, s.indexOf(from)));
  for (const [from, to] of [['<!-- Google Analytics', '</script>'], ['<!-- COOKIE CONSENT BANNER', '  <script src='], ["    // The tool's strings first", '  </script>'], ['<div class="lang-switcher">', '</div>']]) {
    const x = between(a, from, to).replace('DQ_I18N', 'XX_I18N'), y = between(b, from, to).replace('IP_I18N', 'XX_I18N');
    assert.ok(x.length > 20, from);
    assert.equal(y, x, from);
  }
  const strings = s => [...s.matchAll(/"(cookie_[a-z_]+|footer\.[a-z_]+)": "([^"]*)"/g)].map(m => m[0]).join('\n');
  assert.equal(strings(b), strings(a));
});

test('every new asset URL carries the deploy placeholder ?v=20261101, and the shared modules are reused unchanged', () => {
  const page = read('../../ifc-plans.html');
  for (const u of ['css/tools.css?v=20261101', 'js/ifcplan/i18n-ifcplan.js?v=20261101', 'js/ifcplan/ui.js?v=20261101']) assert.ok(page.includes(u), u);
  for (const f of ['ui.js', 'worker.js', 'model.js', 'dxf.js', 'drawing.js', 'state.js']) {
    const src = read(`../../js/ifcplan/${f}`);
    for (const m of src.matchAll(/from '(\.[^']+)'/g)) if (!m[1].includes('/gcode/shell/')) assert.ok(m[1].endsWith('?v=20261101'), `${f}: ${m[1]}`);
  }
  const ui = read('../../js/ifcplan/ui.js'), worker = read('../../js/ifcplan/worker.js');
  assert.ok(ui.includes("new URL('./worker.js?v=20261101', import.meta.url)"));
  assert.ok(ui.includes("from '../laser/bridge.js?v=20261101'") && ui.includes("from '../laser/zip.js?v=20261101'"));
  assert.ok(ui.includes('./examples/${EXAMPLE}?v=20261101'));
  assert.ok(worker.includes("'./vendor/web-ifc/web-ifc-api.js?v=20261101'") && worker.includes('`./vendor/web-ifc/${file}?v=20261101`'));
  assert.ok(!read('../../js/laser/bridge.js').includes('ifcplan') && !read('../../js/laser/zip.js').includes('ifcplan'));
});
```

Run: `node _tests/extract.mjs $PLAN _tests/ifcplan/site.test.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 62`, `ℹ fail 1`. The failing test is `the tools index, the sitemap and llms.txt list the IFC floor plans`; the page's checks already pass.

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
            <a class="ft-card" href="ifc-plans.html">
              <h3 data-i18n="ft.ifcplans.title">Κατόψεις DXF από IFC</h3>
              <p data-i18n="ft.ifcplans.text">Μία κάτοψη R12 DXF ανά όροφο από το IFC του αρχιτέκτονα, κομμένη στο ύψος που ορίζετε: κάθε τύπος στοιχείου σε δική του στρώση, οι χώροι με όνομα και εμβαδόν, έτοιμες για XREF. Στον browser, χωρίς ανέβασμα.</p>
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
        "ft.ifcplans.title": "Κατόψεις DXF από IFC",
        "ft.ifcplans.text": "Μία κάτοψη R12 DXF ανά όροφο από το IFC του αρχιτέκτονα, κομμένη στο ύψος που ορίζετε: κάθε τύπος στοιχείου σε δική του στρώση, οι χώροι με όνομα και εμβαδόν, έτοιμες για XREF. Στον browser, χωρίς ανέβασμα.",
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
        "ft.ifcplans.title": "DXF floor plans from IFC",
        "ft.ifcplans.text": "One R12 DXF floor plan per storey from the architect's IFC, cut at the height you choose: every element type on its own layer, rooms with their name and area, ready to XREF. In the browser, nothing uploaded.",
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
        "ft.ifcplans.title": "Piante DXF da IFC",
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
    <lastmod>2026-09-29</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.aidedcam.com/ifc-plans.html</loc>
    <lastmod>2026-11-01</lastmod>
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
Expected: `free-tools.html | 11 +++++++++++`, `llms.txt | 1 +`, `sitemap.xml | 6 ++++++`: 18 insertions, no deletions.

- [ ] **Step 3: Run everything**

Run: `node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js" "_tests/laser/*.test.js" "_tests/dwg/*.test.js" "_tests/coverage/*.test.js" "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 475`, `ℹ fail 0`.

- [ ] **Step 4: Commit**

```bash
git add free-tools.html sitemap.xml llms.txt _tests/ifcplan/site.test.js
git commit -F - <<'EOF'
IFC floor plans: tools index card, sitemap and llms.txt; page checks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 14: Browser verification

**Files:**
- Create: `_tests/ifcplan/browser-check.js`, `_tests/ifcplan/browser-check.cjs` (dev-only; committed so the checks can be rerun after any change)

- [ ] **Step 1: Write the check and its runner**

<!-- file: _tests/ifcplan/browser-check.js -->
```js
// Dev-only browser check of ifc-plans.html (Jekyll skips _tests). It is one Playwright function: run it with the
// Playwright MCP (browser_run_code_unsafe, filename: _tests/ifcplan/browser-check.js) or with
// node _tests/ifcplan/browser-check.cjs. It expects the repo root served on http://127.0.0.1:8793/ and returns
// { pass, fail, checks: [{ name, ok, got }] }.
async (page) => {
  const BASE = 'http://127.0.0.1:8793/';
  const checks = [];
  const check = (name, ok, got) => checks.push({ name, ok: !!ok, got });
  const errors = [], external = [], requests = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => { const u = r.url(); requests.push(u); if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.clearBrowserCache');                           // a cached old module would hide a fix

  // A strict reader of the R12 DXFs the page writes: pairs, sections, POLYLINE…SEQEND, TEXT, Windows-1253 text.
  const readDxf = bytes => {
    const lines = new TextDecoder('windows-1253').decode(bytes).split('\r\n');
    if (lines.pop() !== '' || lines.length % 2) throw new Error('not whole group pairs');
    const out = { comments: [], header: {}, entities: [], sections: [] };
    let sec = null, key = null, poly = null, ent = null;
    for (let i = 0; i < lines.length; i += 2) {
      const c = +lines[i], v = lines[i + 1];
      if (c === 999) { out.comments.push(v); continue; }
      if (c === 0 && v === 'SECTION') { sec = lines[i + 3]; out.sections.push(sec); i += 2; continue; }
      if (c === 0 && v === 'ENDSEC') { if (poly) throw new Error('POLYLINE left open'); sec = null; continue; }
      if (c === 0 && v === 'EOF') { if (i + 2 !== lines.length) throw new Error('data after EOF'); out.eof = true; break; }
      if (sec === 'HEADER') { if (c === 9) { key = v; out.header[key] = []; } else out.header[key].push(v); continue; }
      if (sec !== 'ENTITIES') continue;
      if (c === 0) {
        if (v === 'VERTEX') { if (!poly) throw new Error('VERTEX outside POLYLINE'); poly.n++; ent = null; continue; }
        if (v === 'SEQEND') { if (!poly) throw new Error('SEQEND alone'); poly = null; ent = null; continue; }
        if (poly) throw new Error(`${v} inside POLYLINE`);
        ent = { type: v, layer: null, text: null };
        if (v === 'POLYLINE') { ent.n = 0; poly = ent; }
        out.entities.push(ent);
        continue;
      }
      if (ent && c === 8) ent.layer = v;
      if (ent && c === 1) ent.text = v;
    }
    if (!out.eof) throw new Error('no EOF');
    return out;
  };
  const byLayer = d => { const o = {}; for (const e of d.entities) { const k = `${e.type} ${e.layer}`; o[k] = (o[k] || 0) + 1; } return o; };
  const download = async selector => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click(selector)]);
    const chunks = []; for await (const c of await dl.createReadStream()) chunks.push(c);
    return { name: dl.suggestedFilename(), bytes: Buffer.concat(chunks) };
  };
  const rows = () => page.$$eval('#ipStoreys tbody tr', trs => trs.map(tr => [...tr.cells].map(c => c.innerText.trim())));
  const timings = () => page.evaluate(() => ({ ...window.__ifcp.timings }));
  const ready = () => page.waitForFunction(() => !document.querySelector('#ipPanel').hidden && document.querySelector('#ipBusy').hidden, null, { timeout: 30000 });

  // 1. The page paints without web-ifc; the example loads it.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(BASE + 'ifc-plans.html?lang=en');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('privacy-pref', 'declined'); });
  await page.goto(BASE + 'ifc-plans.html?lang=en');
  check('English title', (await page.title()) === 'AidedCAM - DXF floor plans from IFC', await page.title());
  check('no worker or web-ifc before a file', !requests.some(u => /worker\.js|web-ifc/.test(u)), requests.filter(u => /ifcplan/.test(u)));
  await page.click('#ipExample');
  await ready();
  check('the example: two storeys, levels, elements cut, rooms', JSON.stringify(await rows()) === JSON.stringify([['Ισόγειο', '0.00', '9', '0', '2', 'DXF'], ['Όροφος 1', '3.00', '7', '0', '1', 'DXF']]), await rows());
  const status = await page.$eval('#ipStatus', e => e.innerText.replace(/\s+/g, ' '));
  check('the summary line', status === 'example-house.ifc IFC4 AidedCAM example generator 2 storeys 19 elements 3 rooms DXF in m', status);
  check('web-ifc loaded with the example, from this site', requests.some(u => u.endsWith('web-ifc.wasm?v=20261101')), requests.filter(u => /web-ifc/.test(u)));
  const legend = await page.$eval('#ipLegend', e => e.innerText.split('\n').join(' '));
  check('the preview and its legend', legend === 'IFC_WALL IFC_DOOR IFC_WINDOW IFC_COLUMN IFC_STAIR IFC_SPACE', legend);
  check('no warnings on the example', (await page.$eval('#ipWarnings', e => e.innerText.trim())) === 'No warnings.', await page.$eval('#ipWarnings', e => e.innerText));
  const tExample = (await timings()).example;
  check(`the example: click to preview under 1 s (${tExample} ms)`, tExample < 1000, tExample);

  // 2. Every DXF re-parses, with its layers, its Greek labels and its name.
  const g = await download('button[data-dxf="0"]');
  const gd = readDxf(g.bytes);
  check('ground floor DXF: its name', g.name === '01 Ισόγειο.dxf', g.name);
  check('ground floor DXF: R12, code page 1253, metres', gd.header.$ACADVER[0] === 'AC1009' && gd.header.$DWGCODEPAGE[0] === 'ANSI_1253' && gd.header.$INSUNITS[0] === '6', gd.header);
  check('ground floor DXF: the layers of the plan', JSON.stringify(byLayer(gd)) === JSON.stringify({ 'POLYLINE IFC_WALL': 7, 'POLYLINE IFC_DOOR': 1, 'POLYLINE IFC_WINDOW': 1, 'POLYLINE IFC_COLUMN': 1, 'POLYLINE IFC_STAIR': 1, 'POLYLINE IFC_SPACE': 2, 'TEXT IFC_SPACE_TEXT': 4 }), byLayer(gd));
  check('ground floor DXF: Greek labels with areas', gd.entities.filter(e => e.type === 'TEXT').map(e => e.text).join('|') === 'Σαλόνι|43.61 m²|Κουζίνα|27.74 m²', gd.entities.filter(e => e.type === 'TEXT').map(e => e.text));
  const u = await download('button[data-dxf="1"]');
  const ud = readDxf(u.bytes);
  check('upper floor DXF: name, layers and its three-line label', u.name === '02 Όροφος 1.dxf' && JSON.stringify(byLayer(ud)) === JSON.stringify({ 'POLYLINE IFC_WALL': 6, 'POLYLINE IFC_WINDOW': 1, 'POLYLINE IFC_RAILING': 1, 'POLYLINE IFC_SPACE': 1, 'TEXT IFC_SPACE_TEXT': 3 }) && ud.entities.filter(e => e.type === 'TEXT').map(e => e.text).join('|') === '1.01|Υπνοδωμάτιο|36.10 m²', [u.name, byLayer(ud)]);
  check('the comment block names the source, storey and cut', ud.comments.slice(1, 4).join('|') === 'Source: example-house.ifc|Storey: Όροφος 1, level 3.000 m|Cut: 1.10 m above the storey level, at 4.100 m', ud.comments);

  // 3. The ZIP holds both plans.
  const z = await download('#ipZip');
  const entries = [];
  for (let p = 0; z.bytes.readUInt32LE(p) === 0x04034b50;) {
    const size = z.bytes.readUInt32LE(p + 18), nl = z.bytes.readUInt16LE(p + 26);
    entries.push({ name: z.bytes.slice(p + 30, p + 30 + nl).toString('utf8'), bytes: z.bytes.slice(p + 30 + nl, p + 30 + nl + size) });
    p += 30 + nl + size;
  }
  check('the ZIP: its name and two entries, each the storey DXF', z.name === 'example-house-dxf.zip' && entries.map(e => e.name).join('|') === '01 Ισόγειο.dxf|02 Όροφος 1.dxf' && entries[0].bytes.equals(g.bytes) && entries[1].bytes.equals(u.bytes), [z.name, entries.map(e => [e.name, e.bytes.length])]);

  // 4. Units and the move to origin rewrite the DXFs only.
  await page.selectOption('#ipUnits', 'mm');
  const mm = readDxf((await download('button[data-dxf="0"]')).bytes);
  check('a unit switch rewrites $INSUNITS and scales: mm', mm.header.$INSUNITS[0] === '4' && mm.header.$EXTMIN[0] === '120500.0' && mm.header.$EXTMIN[1] === '80250.0', mm.header);
  await page.check('#ipOrigin');
  const moved = readDxf((await download('button[data-dxf="0"]')).bytes);
  check('move to origin writes the shift and moves the plan', moved.comments[5] === "Shift: X -120000 mm, Y -80000 mm; add it back to return to the IFC's coordinates" && moved.header.$EXTMIN[0] === '500.0' && moved.header.$EXTMIN[1] === '250.0', [moved.comments[5], moved.header.$EXTMIN]);
  check('the summary names the units and the shift', (await page.$eval('#ipStatus', e => e.innerText.replace(/\s+/g, ' '))).endsWith('DXF in mm shift X -120 m, Y -80 m'), await page.$eval('#ipStatus', e => e.innerText));
  await page.uncheck('#ipOrigin');
  await page.selectOption('#ipUnits', 'm');

  // 5. A re-cut on the open model, and a refused height.
  await page.fill('#ipCut', '2.20');
  await page.press('#ipCut', 'Enter');
  await page.waitForFunction(() => !document.querySelector('#ipRecutTime').hidden && document.querySelector('#ipBusy').hidden, null, { timeout: 30000 });
  check('re-cut at 2.20 m: the door and windows drop out', JSON.stringify((await rows()).map(r => r[2])) === JSON.stringify(['7', '5']), await rows());
  const high = readDxf((await download('button[data-dxf="0"]')).bytes);
  check('the re-cut DXF: no door, the new cut in its comment', !byLayer(high)['POLYLINE IFC_DOOR'] && high.comments[3] === 'Cut: 2.20 m above the storey level, at 2.200 m', [byLayer(high), high.comments[3]]);
  const tRecut = (await timings()).recut;
  check(`a re-cut under 1 s (${tRecut} ms), its time shown`, tRecut < 1000 && /^Re-cut at 2\.20 m in \d\.\d\d s\.$/.test(await page.$eval('#ipRecutTime', e => e.innerText)), await page.$eval('#ipRecutTime', e => e.innerText));
  const webIfcLoads = requests.filter(u2 => u2.includes('web-ifc.wasm')).length;
  await page.fill('#ipCut', 'abc');
  await page.press('#ipCut', 'Enter');
  check('an invalid height is marked and not cut', (await page.getAttribute('#ipCut', 'aria-invalid')) === 'true' && JSON.stringify((await rows()).map(r => r[2])) === JSON.stringify(['7', '5']), await page.getAttribute('#ipCut', 'aria-invalid'));
  await page.fill('#ipCut', '1.10');
  await page.press('#ipCut', 'Enter');
  await page.waitForFunction(() => document.querySelector('#ipStoreys tbody tr').cells[2].innerText.trim() === '9', null, { timeout: 30000 });
  check('back at 1.10 m, without reloading web-ifc', requests.filter(u2 => u2.includes('web-ifc.wasm')).length === webIfcLoads && (await page.getAttribute('#ipCut', 'aria-invalid')) === null, webIfcLoads);

  // 6. The preview: a storey row selects it; the tooltip names the layer under the pointer.
  await page.click('#ipStoreys tbody tr:nth-child(2) td:first-child');
  const sel = await page.evaluate(() => ({ name: document.querySelector('#ipPreviewName').textContent, legend: document.querySelector('#ipLegend').innerText.split('\n').join(' '), sel: document.querySelector('#ipStoreys tr.is-sel td').innerText }));
  check('a row click shows that storey', sel.name === 'Όροφος 1' && sel.sel === 'Όροφος 1' && sel.legend === 'IFC_WALL IFC_WINDOW IFC_RAILING IFC_SPACE', sel);
  await page.$eval('#ipCanvas', c => c.scrollIntoView({ block: 'center', behavior: 'instant' }));   // the site scrolls smoothly: wait for none
  const at = await page.evaluate(() => { const s = window.__ifcp.drawing.screenOf(122, 80.25), r = document.querySelector('#ipCanvas').getBoundingClientRect(); return { x: r.left + s.x, y: r.top + s.y }; });
  await page.mouse.move(at.x, at.y);
  await page.waitForFunction(() => !document.querySelector('#ipTip').hidden, null, { timeout: 5000 }).catch(() => {});
  check('hover over the outer face of the south wall: the tooltip names IFC_WALL', (await page.$eval('#ipTip', e => e.hidden ? '' : e.innerText)) === 'Layer: IFC_WALL', await page.$eval('#ipTip', e => e.innerText));
  const canvasInk = await page.$eval('#ipCanvas', c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 80 && d[i + 1] < 80 && d[i + 2] < 80) n++; return n; });
  check('the preview draws the walls', canvasInk > 500, canvasInk);

  // 7. Languages.
  await page.click('.lang-btn[data-lang="el"]');
  check('Greek: title, decimal comma, headings', (await page.title()) === 'AidedCAM - Κατόψεις DXF από IFC' && (await rows())[1][1] === '3,00' && (await page.$eval('#ipStoreys thead', e => e.innerText)).includes('Στοιχεία στην τομή') && (await page.inputValue('#ipCut')) === '1,10', [await page.title(), (await rows())[1]]);
  await page.click('.lang-btn[data-lang="it"]');
  check('Italian: title, summary, warnings', (await page.title()) === 'AidedCAM - Piante DXF da IFC' && (await page.$eval('#ipStatus', e => e.innerText)).includes('2 piani') && (await page.$eval('#ipWarnings', e => e.innerText.trim())) === 'Nessun avviso.', await page.$eval('#ipStatus', e => e.innerText));
  await page.click('.lang-btn[data-lang="en"]');

  // 8. Settings stay in this browser.
  await page.fill('#ipCut', '0.90'); await page.press('#ipCut', 'Enter');
  await page.waitForFunction(() => document.querySelector('#ipRecutTime').innerText.startsWith('Re-cut at 0.90'), null, { timeout: 30000 });
  await page.selectOption('#ipUnits', 'cm');
  await page.reload();
  check('the cut height and units are remembered', (await page.inputValue('#ipCut')) === '0.90' && (await page.inputValue('#ipUnits')) === 'cm', [await page.inputValue('#ipCut'), await page.inputValue('#ipUnits')]);
  await page.evaluate(() => localStorage.removeItem('aidedcam-ifcp-settings'));
  await page.reload();
  check('the defaults: 1.10 m, metres, not moved', (await page.inputValue('#ipCut')) === '1.10' && (await page.inputValue('#ipUnits')) === 'm' && !(await page.isChecked('#ipOrigin')), await page.inputValue('#ipCut'));

  // 9. Files the tool refuses: one line in the visitor's language, and the page stays usable.
  await page.setInputFiles('#ipInput', { name: 'drawing.dxf', mimeType: 'application/dxf', buffer: Buffer.from('0\r\nSECTION\r\n2\r\nHEADER\r\n0\r\nENDSEC\r\n0\r\nEOF\r\n') });
  await page.waitForFunction(() => !document.querySelector('#ipError').hidden, null, { timeout: 30000 });
  check('not an IFC: the read error', (await page.$eval('#ipError', e => e.innerText)) === 'drawing.dxf: This is not an IFC file the tool can read: it supports .ifc in STEP text.', await page.$eval('#ipError', e => e.innerText));
  await page.setInputFiles('#ipInput', { name: 'model.ifczip', mimeType: 'application/zip', buffer: Buffer.from([0x50, 0x4b, 3, 4, 20, 0, 0, 0]) });
  await page.waitForFunction(() => document.querySelector('#ipError').innerText.startsWith('model.ifczip'), null, { timeout: 30000 });
  check('ifcZIP: says to unzip it', (await page.$eval('#ipError', e => e.innerText)).includes('.ifcZIP files are not supported'), await page.$eval('#ipError', e => e.innerText));
  const ifc9 = (await (await page.request.get(BASE + 'js/ifcplan/examples/example-house.ifc')).text()).replace("FILE_SCHEMA(('IFC4'))", "FILE_SCHEMA(('IFC9'))");
  await page.setInputFiles('#ipInput', { name: 'future.ifc', mimeType: 'application/octet-stream', buffer: Buffer.from(ifc9) });
  await page.waitForFunction(() => document.querySelector('#ipError').innerText.startsWith('future.ifc'), null, { timeout: 30000 });
  check('an unknown schema: named', (await page.$eval('#ipError', e => e.innerText)).includes('“IFC9”'), await page.$eval('#ipError', e => e.innerText));
  await page.click('#ipExample');
  await ready();
  check('the page stays usable: the example again', (await rows()).length === 2 && (await page.$eval('#ipError', e => e.hidden)), await rows());

  // 10. A phone: no horizontal page scroll, a 16 px gutter, the table scrolls in its own box.
  await page.setViewportSize({ width: 375, height: 800 });
  await page.waitForTimeout(200);
  const phone = await page.evaluate(() => ({ scroll: [document.documentElement.scrollWidth, document.documentElement.clientWidth], gutter: Math.round(document.querySelector('.ip-bar').getBoundingClientRect().left), canvas: Math.round(document.querySelector('#ipCanvas').getBoundingClientRect().width), wrap: getComputedStyle(document.querySelector('#ipStoreys').parentElement).overflowX }));
  check('at 375 px: no horizontal scroll, 16 px gutter, full-width preview, the table scrolls in its box', phone.scroll[0] === phone.scroll[1] && phone.gutter === 16 && phone.canvas >= 340 && phone.wrap === 'auto', phone);
  if (process.env && process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/ifcp-375.png`, fullPage: true });

  // 11. The tools index lists the tool, without a horizontal scroll.
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(BASE + 'free-tools.html?lang=en');
    const card = await page.evaluate(() => { const a = document.querySelector('.ft-card[href="ifc-plans.html"]'); return a && a.closest('.ft-group').querySelector('.ft-group-title').innerText; });
    const scroll = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    check(`index at ${width} px: the card in Engineering offices, no horizontal scroll`, /engineering/i.test(card || '') && scroll[0] === scroll[1], { card, scroll });
  }

  // 12. Nothing external, no console errors.
  check('no external requests', external.length === 0, external);
  check('no console errors', errors.length === 0, errors);
  check(`timings ${JSON.stringify({ example: tExample, recut: tRecut })}`, true, null);
  return { pass: checks.filter(c => c.ok).length, fail: checks.filter(c => !c.ok).length, checks };
}
```

<!-- file: _tests/ifcplan/browser-check.cjs -->
```js
// Runs the IFC floor plans' browser checks in headless Chrome, for when the Playwright MCP is unavailable.
// Needs the repo root served on http://127.0.0.1:8793/ and playwright-core somewhere on this machine:
//   node _tests/ifcplan/browser-check.cjs
// Set PW_CORE to a playwright-core folder, or it is looked for in the npx cache. Chrome is used from its default
// install path (or CHROME). SHOT=<folder> also saves a screenshot at 375 px.
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
  const page = await context.newPage();
  const r = await eval(fs.readFileSync(path.join(__dirname, 'browser-check.js'), 'utf8'))(page);
  for (const c of r.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : '  ' + JSON.stringify(c.got)}`);
  console.log(`${r.pass} passed, ${r.fail} failed`);
  await browser.close();
  process.exit(r.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
```

Run: `node _tests/extract.mjs $PLAN _tests/ifcplan/browser-check.js && node _tests/extract.mjs $PLAN _tests/ifcplan/browser-check.cjs`

- [ ] **Step 2: Serve the repo and run it**

Start the server in the background (Bash tool, `run_in_background`): `python -m http.server 8793 --bind 127.0.0.1` from the repo root.

Run: `node _tests/ifcplan/browser-check.cjs`
(or, with the Playwright MCP: `browser_run_code_unsafe` with the file's text as `code`).

Expected: `40 passed, 0 failed`. The checks, in order:
1. the English title; no worker or web-ifc request before a file;
2. the example: rows `Ισόγειο | 0.00 | 9 | 0 | 2` and `Όροφος 1 | 3.00 | 7 | 0 | 1`; the summary `example-house.ifc IFC4 AidedCAM example generator 2 storeys 19 elements 3 rooms DXF in m`; `web-ifc.wasm?v=20261101` from the local server; the legend `IFC_WALL IFC_DOOR IFC_WINDOW IFC_COLUMN IFC_STAIR IFC_SPACE`; no warnings; click to preview under 1 s;
3. every DXF re-parses: `01 Ισόγειο.dxf` (AC1009, ANSI_1253, `$INSUNITS 6`, 7 walls, door, window, column, stair, 2 rooms, 4 TEXT `Σαλόνι|43.61 m²|Κουζίνα|27.74 m²`) and `02 Όροφος 1.dxf` (6 walls, window, railing, 1 room, `1.01|Υπνοδωμάτιο|36.10 m²`), with the comment block;
4. the ZIP `example-house-dxf.zip` holds the two DXFs byte for byte;
5. mm: `$INSUNITS 4`, `$EXTMIN` 120500, 80250; move to origin: the shift comment and `$EXTMIN` 500, 250; the summary names the units and the shift;
6. a re-cut at 2.20 m: elements cut 7 and 5, no door in the DXF, its time shown, under 1 s; `abc` is marked invalid and cuts nothing; back at 1.10 m without loading web-ifc again;
7. a row click previews `Όροφος 1` (legend `IFC_WALL IFC_WINDOW IFC_RAILING IFC_SPACE`); the tooltip over the south wall's outer face reads `Layer: IFC_WALL`; the canvas has ink;
8. Greek (title, `3,00`, the column heading, `1,10`) and Italian (title, `2 piani`, `Nessun avviso.`);
9. the cut height and units are remembered across a reload; without them, the defaults 1.10 m, metres, not moved;
10. a DXF file, an ifcZIP and an `IFC9` schema each give their one-line error, and the example loads again after them;
11. at 375 px: no horizontal scroll, a 16 px gutter, a full-width preview, the table scrolling in its box;
12. the tools index at 1280 px and 375 px: the card in "Engineering offices", no horizontal scroll;
13. no external requests, no console errors, and the timings.

- [ ] **Step 3: Look at it, and run the six spike samples by hand**

Take full-page screenshots at 1280 px (`?lang=en`) and 375 px (`?lang=el`) with the example loaded (`SHOT=<folder> node _tests/ifcplan/browser-check.cjs` saves the 375 px one), and check by eye: the ground floor shows the walls as closed double lines with the door and window gaps, the window and door in their colours, the column, the stair's cut, and the labels `Σαλόνι 43.61 m²` and `Κουζίνα 27.74 m²` inside their rooms; at 375 px the table scrolls in its box.

The six public spike samples (never committed; drop each on the local page, 3 runs each in a fresh page, median; re-cut at 1.20 m) gave, in headless Chrome 154 on the development laptop:

| Sample (public) | MB | Schema | Authoring tool | Storeys | Elements | Rooms | Drop → preview | Re-cut |
|---|---|---|---|---|---|---|---|---|
| Duplex_A | 2.3 | IFC2X3 | Revit 2011 | 4 | 215 | 21 | 0.31 s | 0.04 s |
| AC20-FZK-Haus | 2.5 | IFC4 | Archicad 20 | 2 | 82 | 7 | 0.34 s | 0.09 s |
| Esplanades (georeferenced) | 11.5 | IFC2X3 | Archicad 22 | 7 | 1,958 | 285 | 1.29 s | 0.87 s |
| Clinic_Architectural | 12.4 | IFC2X3 | Revit 2011 + Solibri | 4 | 2,586 | 269 | 0.73 s | 0.29 s |
| Ifc4_Revit_ARC | 13.0 | IFC4 | Revit 2021 | 6 | 442 | 0 | 0.51 s | 0.12 s |
| Schependomlaan | 47.0 | IFC2X3 | Archicad 18 | 6 | 3,504 | 6 | 1.11 s | 0.31 s |

"Drop → preview" runs from the file input to the rendered table and preview, in a fresh page, so it includes starting the worker and web-ifc (about 0.2 s). Spec §9: 13 MB under 2 s (0.51–1.29 s), 47 MB under 3 s (1.11 s), a re-cut under 1 s at 13 MB (0.12–0.29 s; 0.87 s on the 11.5 MB georeferenced file, whose meshing dominates).

All 29 DXFs (every storey of every sample) pass ezdxf 1.4.4's strict read and audit with 0 errors and 0 fixes. The 47 MB sample reports the spike's 65 elements without geometry (`IfcWallStandardCase 51, IfcBuildingElementProxy 14`); the georeferenced 11.5 MB sample warns `Coordinates are 6592 km from the origin` and that 167 Estonian characters cannot be written in code page 1253; its roof storey reads "nothing at 1.10 m".

- [ ] **Step 4: Commit, and stop the server**

```bash
git add _tests/ifcplan/browser-check.js _tests/ifcplan/browser-check.cjs
git commit -F - <<'EOF'
IFC floor plans: browser check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```
Stop the background server (TaskStop, or `taskkill //PID <pid> //F` for the PID `netstat -ano | grep ":8793 .*LISTENING"` prints); afterwards that command must print nothing.

---

### Task 15: Launch preparation (stop before any push)

**Files:**
- Create: `_docs/ifc-plans/real-file-check.md`
- Modify, on deploy day only: every `?v=20261101` of this tool and the sitemap `lastmod` `2026-11-01`

- [ ] **Step 1: The real-file record**

<!-- file: _docs/ifc-plans/real-file-check.md -->
```markdown
# Real-file check: DXF floor plans from IFC

Spec §11. Before or after launch, run Greek IFC exports (Archicad and Revit, ideally both IFC2X3 and IFC4) through the
tool, and compare the plans with the architect's own drawings of the same storeys. The files stay in the git-ignored
`_tests/private/`; this record holds counts and differences only: no office names, no file names, no addresses, no
storey or room names and no coordinates.

How to run a file: serve the repo root (`python -m http.server 8793 --bind 127.0.0.1`), open
`http://127.0.0.1:8793/ifc-plans.html`, drop the file, and download the ZIP. Open each DXF in AutoCAD (or ZWCAD,
BricsCAD) and XREF the storeys over each other.

Also note, per file:
- the storeys: are they all listed, in level order, at the levels the architect's sections show (the world Z rule of
  spec §3)? Is any storey "nothing at 1.10 m", and is that right?
- the units: does the DXF open at the right size with the units chosen (m, cm, mm)? With "move to origin", does adding
  the shift in the comment block back return the IFC's coordinates?
- the walls: closed double lines, door and window openings cut in them? Any walls missing, and does the "without
  geometry" warning count them (compare with the architect's drawing, not with the coordinates)?
- the rooms: do the labels show the room name (and number), and does the area match the architect's room schedule
  (Qto or outline: note which)? Is any Greek text shown as "?"?
- the layers: is anything on IFC_OTHER that belongs on a named layer? Any grid or level markers drawn?
- rooms with columns or shafts inside them: where the area comes from the outline, the holes are now subtracted;
  confirm it against the room schedule.
- storeys sharing a level: does the "same level" warning appear, and are those storeys' plans really identical (a
  storey placement problem in the IFC, not the tool)?
- a georeferenced model (coordinates in the millions of metres): are the walls drawn closed, with no jitter along
  their lines? web-ifc's vertices are 32-bit floats.
- what is missing that an engineer would need first (door swings, stairs below the cut, dimensions): this feeds the
  paid conversation, not v1.

| # | Authoring tool / schema | MB | Storeys | Seconds to the preview | Walls OK? | Rooms: areas match? | Greek text OK? | Without geometry | Notes |
|---|---|---|---|---|---|---|---|---|---|

Acceptance: every storey listed at its level; walls, doors and windows where the architect's plan has them, apart from
elements the tool lists as without geometry; room areas within 0.01 m² of the room schedule when they come from Qto,
or the difference explained (outline area against a net area); Greek names readable in AutoCAD; the storeys overlay as
XREFs. Anything else is a bug to fix, or a limit to name on the page.

Timing on the same machine (the browser's first file includes loading web-ifc):

| # | MB | Seconds to the preview | Seconds to re-cut |
|---|---|---|---|

Recorded by: (name), (date).
```

Run: `node _tests/extract.mjs $PLAN _docs/ifc-plans/real-file-check.md`

- [ ] **Step 2: Run everything**

Run:
```bash
node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js" "_tests/laser/*.test.js" "_tests/dwg/*.test.js" "_tests/coverage/*.test.js" "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
node _tests/ifcplan/make-example.mjs --check
git diff --stat eabd4be -- js/laser js/dwg js/coverage js/gcode js/mill _src laser-dxf-checker.html dwg-quantities.html coverage-precheck.html
```
Expected: `ℹ pass 475`, `ℹ fail 0`; `same js/ifcplan/examples/example-house.ifc`; no diff output.

- [ ] **Step 3: Commit, then stop**

```bash
git add _docs/ifc-plans/real-file-check.md
git commit -F - <<'EOF'
IFC floor plans: real-file check record (to be filled with Greek exports)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

**Stop here.** Merging and pushing `main` publishes the site; that is Aris's decision.

**Deploy day (Aris names the day; not part of the replay):**
1. Pick `YYYYMMDD` and check it is not live on another page: `grep -rn "v=YYYYMMDD" --include=*.html --include=*.js .` must print nothing.
2. Replace the placeholders (`site.test.js` pins them, so it takes the same replacement):
   ```bash
   sed -i 's/v=20261101/v=YYYYMMDD/g' ifc-plans.html js/ifcplan/*.js _tests/ifcplan/site.test.js _tests/ifcplan/browser-check.js
   sed -i 's#<lastmod>2026-11-01</lastmod>#<lastmod>YYYY-MM-DD</lastmod>#' sitemap.xml
   sed -i 's#<lastmod>2026-11-01</lastmod>#<lastmod>YYYY-MM-DD</lastmod>#' _tests/ifcplan/site.test.js
   grep -rn "20261101\|2026-11-01" ifc-plans.html js/ifcplan sitemap.xml _tests/ifcplan    # must print nothing
   ```
   (`js/ifcplan/vendor/` holds no placeholder; the sed leaves it alone.) Run the Node tests and the browser check again.
3. Before any push: Aris decides ruling A (the proxy filter); Greek IFC exports go through `real-file-check.md` when he has them, before or after launch (spec §11); squash the branch (spec §14); `git log -p main..HEAD | grep -i -E "<client names>"` must print nothing.
4. After the push: on the live site, the example gives the plans of Task 14's checks 2–3 (spec §14.5), web-ifc loads from GitHub Pages, and the footer notice shows.

---

## Replay

The plan was replayed task by task on a fresh worktree of `feat/ifc-plans` with only this plan added (branch `scratch/ifcp-replay`, created with `git worktree add ../aidedcam-page-ifcp-replay -b scratch/ifcp-replay feat/ifc-plans`), running only the plan's own commands, commits included: 15 commits for Tasks 1–15 (Task 0 commits nothing).
- **Every stated result appeared:** the baseline 412 and an unused placeholder; the Node red and green steps 0/2 → 2, 2/1 → 7, 7/1 → 13, 13/1 → 17, 17/1 → 22, 22/2 → 32, 32/3 → 35, 35/1 → 44, 44/1 → 49, 49/1 → 50, 50/5 → 55, 55/1 → 59, 62/1 → 63; 475 in all; the two SHA-256s from `npm pack`; `text: unset` twice; the generator's `wrote … (16459 bytes)` and `same`; `syntax-ok`; the diff stats of Tasks 1, 11 and 13; the browser check `40 passed, 0 failed`, twice (example 0.23–0.24 s, re-cut 17 ms); and the other tools' empty diff.
- **The replay matches the validated branch:** `git diff --stat scratch/ifcp-validate scratch/ifcp-replay -- . ':(exclude)_docs'` is empty, so every file, including the npm files and the generated example, is byte-identical to the validated one. (On Git Bash for Windows, write the exclusion as `':(exclude)_docs'`.)
