# DWG quantities: design

Date: 2026-09-28. Status: approved in conversation, section by section. This document is the binding reference
for the implementation plan.

## 1. Purpose and audience

A free tool on www.aidedcam.com that reads DWG and DXF drawings and returns their quantities: lengths, areas and
block counts per layer, plus block-attribute schedules, on screen and as one .xlsx.

- **Two audiences, led by the first:**
  - MEP and building-services engineers, who total pipe, duct and cable lengths per layer;
  - architects and building-product makers, who count doors and windows and read their attribute values.

  Lengths, counts and areas per layer are the headline. The attribute schedule is one sheet in the workbook, because
  Greek demand for it is untested.
- **Why it exists.** It is a lead magnet for AidedCAM's tailor-made software. Success is contacts, not hours of use:
  a visitor gets a real result within a minute, trusts it because the drawing shows what was counted, and some click
  the call-to-action.
- **What stays for the paid conversation.** Named groups, saved sessions and mapping to a firm's own bill-of-quantities
  codes or ERP are not in the free tool. They are what the call-to-action offers to build.
- **The rival** is SmartCAD Quantity Takeoff (free, browser, block counts and lengths per layer, CSV). This tool adds
  areas, hatch areas, attribute schedules, many files at once, a drawing that proves the numbers, selection totals,
  .xlsx, and Greek.

## 2. Decisions

| Decision | Choice |
|---|---|
| Inputs | DWG and DXF in the formats ACadSharp reads; the exact range (expected R14 to 2018, as on the laser tool) is confirmed in the feasibility gate (§11). Many files per batch. |
| Primary user | MEP and architects together, led by lengths, counts and areas per layer |
| Gate | None. Completely free, like the other tools |
| Drawing | Shown, with two-way highlight and interactive selection (click, window, crossing) |
| Selection | Look only: live totals, copy to clipboard. No named groups, nothing saved, not in the .xlsx |
| Many files | One file shown at a time; the .xlsx has a summary across files plus sheets per file |
| Engine | New `_src/dwg-engine/`: ACadSharp reads, Eyeshot 2026 measures. The live laser engine is not touched. |
| devDept | Written yes to public browser use, no conditions (2026-09-27). The standard notice is shown anyway. |
| Hosting | The existing static GitHub Pages site. No server; nothing is uploaded. |

## 3. Architecture

**The page** is `dwg-quantities.html`, in plain HTML and JavaScript. Its modules live in `js/dwg/`. It reuses:

- the shared shell in `js/gcode/shell/`: i18n and the language switch, settings storage, banners, consent and GA;
- `js/laser/bridge.js`, imported as it is: the file queue, one file at a time, the 30 s timeout and the worker
  restart;
- `js/laser/zip.js`, as the base of the .xlsx writer.

It paints instantly and loads no engine until a file arrives.

**The engine** is a headless .NET 10 WebAssembly module in `_src/dwg-engine/`, built the same way as the laser
engine:

- the host project, the `[JSExport]` pattern, the trimming roots, `publish.ps1` and the gzip loader are copied from
  `_src/laser-engine/` and pointed at `js/dwg/engine/`;
- `js/dwg/worker.js` is a copy of `js/laser/worker.js` that loads the new engine;
- the code is laid out so that merging it with the laser engine later (one shared download for all DWG tools) is a
  mechanical step.

**Reading and measuring:**

- **ACadSharp reads** both DWG and DXF, once. It gives the structure the laser reader throws away: layers with their
  on/off and frozen state, inserts with their real block names and attributes, MINSERT arrays, hatches, polylines and
  xrefs, all keyed by DWG handle.
- **Eyeshot measures.** ACadSharp entities are converted to Eyeshot curves and regions, which give exact lengths
  (splines, ellipses, bulged polylines), areas (hatches with islands) and the tessellation for the drawing.
- Only Eyeshot's managed, cross-platform classes are used. Every Eyeshot call is verified in the Eyeshot 2026 API
  reference before it is used. Whether the conversion works cleanly in WebAssembly is the plan's first task (§11).

**The data contract** between the page and the worker (JSON):

```
→ { type: 'quantities', id, name, bytes, settings: { units: 'auto'|'mm'|'cm'|'m'|'inch'|'ft' } }
← { type: 'progress', id, stage }
← { type: 'result', id,
    file: { name, format: 'dwg'|'dxf', version, units, unitsSource: 'file'|'setting' },
    layers: [{ name, color, off, frozen, len, lenCount, area, areaCount, hatchArea, hatchCount }],
    blocks: [{ name, layer, count, nested }],
    schedules: [{ block, tags: [tag], rows: [{ values: [value], count }] }],
    items: [{ id, layer, kind, len, area, block, path }],
    xrefs: [name],
    notMeasured: { text, dim, solid3d, mesh, proxy, other, insideBlocks },
    warnings: [{ id, params }],
    bbox: { x0, y0, x1, y1 } }
← { type: 'error', id, reason: 'read'|'version'|'limit'|'timeout'|'engine'|'empty', message }
```

- Lengths are in metres and areas in m², after unit conversion.
- `items[]` holds every drawable thing with its own numbers. A block insert is **one item** (`kind: 'insert'`, `block`
  set), drawn from its exploded geometry. `path` is the tessellated outline in drawing coordinates, flat enough for
  Canvas 2D.
- `id` is the DWG handle, so a table row, an item and a selection all point at the same entity.

**Repository layout.** This is still the public site repository.

| Path | Content |
|---|---|
| `_src/dwg-engine/` | C# engine (class library), the WebAssembly host project and the test project |
| `js/dwg/engine/` | The published WebAssembly output, committed, as for the laser engine |
| `js/dwg/*.js` | Page modules: controller, worker, view, selection, tables, xlsx writer, strings |
| `_tests/dwg/` | Node tests for the JavaScript modules, and the browser check pages |

**The build** runs on Aris's machine, because it references Eyeshot 2026 from the local installation. No licence key,
serial or licence file is ever committed.

## 4. Measuring rules

**Scope:**

- **Model space only.** Paper-space layouts (title blocks, viewports) are ignored, because they would count things
  twice.
- **Units** come from the file's `$INSUNITS`. The units setting applies only to files that state no units, the same
  ruling as the laser tool. Output is in m and m², in Greek number format on the Greek page.
- **All layers are measured**, including layers that are off or frozen. Those carry a badge in the table.

**Per layer (the headline table and sheet):**

- **Length:** lines, arcs, circles, polylines (2D and 3D, with bulges), splines and ellipses. Count and total length.
- **Area:** closed polylines, circles, and closed splines and ellipses. Count and total area.
- **Hatch area:** a separate column, with islands subtracted. It is never added to the polyline areas, because rooms
  are often both outlined and hatched.

**Blocks:**

- Counted by their **real name**. Anonymous dynamic-block names (`*U…`) resolve to the name the user sees.
- Counted per layer of the insert.
- A MINSERT counts rows × columns.
- A second column counts **nested** inserts: blocks inside other blocks, such as the WCs inside a "bathroom" block.
- **Geometry inside blocks is not added to layer lengths or areas.** A block is an item, not metres. The count of
  entities left out this way goes in `notMeasured.insideBlocks` and a notice.

**Attribute schedule:**

- One table per block name that carries attributes, with its attribute tags as columns.
- Identical rows are collapsed, with a count: `W1 · 120 · 140 · ×8`.

**Not measured, but reported:**

- xrefs, listed as "not loaded": the browser has only the files the visitor dropped;
- text and dimensions;
- 3D solids, meshes, and proxy or unknown entities.

Each appears in the "not measured" line, so nothing disappears silently.

## 5. The page

**Header:**

- title, one-line promise, and "Files stay on your computer; nothing is uploaded";
- links to the free-tools index and the other tools.

**Input:**

- A drop zone that is also an **Open files** button: multiple files, DWG and DXF.
- **Load example drawing:** a synthetic floor plan built for the tool, with no customer data. It has pipe and duct
  layers, hatched rooms, door and window blocks with attributes, one dynamic block and one nested block.

**Engine banner.** On first use: "Loading the geometry engine, about 12 MB, only the first time… n %".

**File tabs.** One tab per file, with a status mark: ✖ error, ⚠ warnings, ✔ otherwise. A **Summary** tab comes first
when there is more than one file.

**The tables** (for the selected file, or totals across files on the Summary tab):

- **Layers:** layer, colour, length, count, area, count, hatch area, count, and an off/frozen badge;
- **Blocks:** block name, layer, count, nested;
- **Schedules:** one table per attributed block;
- **Not measured:** one line with the counts, and the xref list.

Totals sit under each numeric column.

**The drawing** is Canvas 2D and shows the selected file.

- Zoom, pan and fit work as on the other tools.
- **Row → drawing:** clicking a layer or block row lights up its items and fades the rest.
- **Drawing → row:** hovering an item shows a tooltip (layer, kind, length or area, block name); clicking it lights up
  its row.
- A file too heavy to draw in full still gets its tables; the drawing then shows a simplified view (coarser
  tessellation), and selection still works.

**Selection:**

- Click selects one item and replaces the selection; Shift+click adds or removes one item.
- Dragging left to right selects items fully inside the window; right to left selects items the box crosses.
- Esc clears the selection.
- The **Selection** panel shows the totals of exactly what is picked, split by layer: length, area, hatch area, and
  block counts by name. **Copy** puts it on the clipboard as tab-separated text.
- Selections are not named, not saved and not exported.
- Beside the panel: "Need groups mapped to your bill of quantities or your ERP? We build that."

**Settings panel:** units for files that state none. Settings are saved in the browser, under keys separate from the
other tools'.

**Output: one .xlsx** for the whole batch, written in the browser:

- a **Summary** sheet with totals across all files, per layer and per block name;
- per file: **Layers**, **Blocks** and **Schedules** sheets (the sheet name carries a short form of the file name);
- Greek headings on the Greek page, numbers stored as numbers with a number format, not as text;
- file name: `quantities-<first file name>.xlsx`, or `quantities-<n>-files.xlsx`.

**Around the tool:**

- **Call-to-action:** "Want these quantities inside your own workflow? We build software around your standards."
- **The optional one-click survey**, as on the other tools.
- **GA events**, sent only after consent:
  - `dwgq_files_loaded { files, errors, layers, blocks, schedules }`;
  - `dwgq_example_loaded`;
  - `dwgq_selection { items }`, at most once per file, when a selection is first made;
  - `dwgq_copy`;
  - `dwgq_xlsx_download { files }`;
  - `dwgq_cta_click { where: 'page'|'selection' }`;
  - `dwgq_survey { answer }`.
- **Footer**, in addition to the site footer: "Geometry engine: Eyeshot. Portion of copyright © devDept Software
  S.r.l. All Rights Reserved."
- **Languages:** Greek (default), English and Italian. Tool strings live in `js/dwg/i18n-dwg.js`; page keys are
  inline, as on the laser page.
- **Phones:** the layout stacks at 375 px with no horizontal page scroll; tables scroll inside their own box.
- **Site links:** a card on `free-tools.html`, a sitemap entry and a line in `llms.txt`.

## 6. JavaScript modules

| Module | Job |
|---|---|
| `js/dwg/ui.js` | Controller: file input, the bridge, file tabs, state, GA events |
| `js/dwg/worker.js` | Loads the engine, answers `quantities` messages |
| `js/dwg/view.js` | Canvas 2D drawing: pan, zoom, fit, highlight, hover tooltip, simplified mode |
| `js/dwg/selection.js` | Spatial grid, click, window and crossing hit-tests, selection totals |
| `js/dwg/tables.js` | Layer, block, schedule and not-measured tables; totals; summary across files |
| `js/dwg/xlsx.js` | Minimal SpreadsheetML writer on `zip.js`: sheets, inline strings, number formats, bold header, column widths |
| `js/dwg/i18n-dwg.js` | `window.DQ_I18N = { el, en, it }` with `dq.*` keys |

Selection totals are summed in JavaScript from `items[]`. There is no engine call, so the result is instant.

## 7. Performance targets

| What | Target |
|---|---|
| Page first paint | Instant; no engine download |
| Engine first load | Under 5 s at 50 Mbit/s; cached afterwards |
| A typical building DWG (under 50,000 entities) | Tables in under 3 s |
| Pan, zoom and highlight | Smooth at 50,000 items |
| Selection totals | Instant; no engine call |

## 8. Errors and limits

**Per file; one bad file never stops the batch:**

- **Unreadable or unsupported file** (not DWG or DXF, a DWG version ACadSharp cannot read, corrupt data): that tab
  shows an error card with the reason, and the other files continue.
- **Engine crash or timeout:** the bridge restarts the worker, marks that file failed and moves to the next.
- **Totals with a failed file:** the Summary tab and sheet show "≥" with a note naming the missing files, the same
  ruling as the laser tool.
- **Engine that cannot start** (no WebAssembly, no worker, or a failed download): a banner says so and offers a retry.
  The page's text and links keep working.

**Inside a file; a warning banner, and the numbers still show:**

- **No units in the file:** the units setting is used; the banner says so and lets the visitor change it, which
  re-measures the file.
- **Xrefs:** listed as "not loaded".
- **Self-intersecting closed polyline:** its area is shown with ⚠ and left out of the area total; the banner gives
  the count.
- **Hatch whose area cannot be computed:** the same treatment.
- **Model space empty, everything in paper space:** the error card says so plainly (`reason: 'empty'`) instead of
  showing empty tables.

**Limits.** The starting values are below; the perf task in the plan sets the final numbers against large generated
drawings.

- 30 MB per file;
- 300,000 entities per file;
- 20 files per batch;
- 30 s per file.

A file over a limit gets an error card; the rest of the batch continues.

## 9. Testing

**Engine** (`dotnet test`, xunit, as in `_src/laser-engine/Tests/`). The fixtures are written by ACadSharp inside the
tests, so every expected number is known exactly. Cases:

- per-layer lines, arcs and bulged polylines, checked against hand-worked lengths;
- a spline and an ellipse, checked against analytic lengths within 0.01 %;
- a hatch with an island;
- a dynamic block whose `*U` name resolves to its real name;
- a MINSERT;
- a nested block;
- attributed windows collapsing into schedule rows;
- a file with no units, a file with an xref, a self-intersecting polyline, and a paper-space-only file;
- one DWG and one DXF of the same drawing giving identical results.

**JavaScript** (`node --test "_tests/dwg/*.test.js"`):

- **xlsx:** unzip the output, parse the XML, and check sheet names, headings, number formats and Greek text;
- **selection:** click, window and crossing on a known item set; totals per layer; the grid hit-test compared with a
  brute-force check;
- **tables:** totals, the summary across files, and "≥" with a failed file;
- **bridge** with a fake worker: batch order, a failing file;
- **i18n:** the same keys and placeholders in all three languages.

**Browser:**

- engine smoke and parity pages: the WebAssembly result matches the .NET test output;
- a perf page with a large generated drawing, which sets the final limits;
- Playwright: the example drawing, highlight both ways, selection, copy, the .xlsx download, Greek, English and
  Italian, 375 px, and no external network requests.

**Real files, private, before launch.** 5–10 real Greek DWGs (MEP and architectural) from the git-ignored
`_tests/private/`.

- Numbers are compared with AutoCAD's own (`LIST`, `AREA`, data extraction) and with SmartCAD's counts.
- The result goes into `_docs/dwg-quantities/real-file-check.md` as figures only, with no names and no geometry.

## 10. Launch

- The deploy-day `?v=` bump for this page, with real dates.
- The sitemap `lastmod` set to the real date, fixing the three stale future dates on the other tools at the same time.
- A check on the live site that the engine loads and the example drawing works.
- The devDept notice is present.
- The free-tools card, sitemap and `llms.txt` are live.
- The outgoing commit is scanned: no client names and no customer data (the repository is public).

## 11. Feasibility gate (the plan's first task)

Before any user interface is built, a minimal engine must prove, in the browser, on the real hosting constraints:

1. ACadSharp reads a synthetic DWG and DXF, and returns layers, inserts with attributes and real dynamic-block names,
   hatches and MINSERT arrays.
2. Converting ACadSharp entities to Eyeshot curves and regions gives correct lengths and areas, including a spline,
   an ellipse and a hatch with an island.
3. The trimmed download size is known, and the engine boots from static files through the copied gzip loader.
4. The engine makes no network call at runtime.

If any item fails, work stops, and the fallback is decided with Aris before continuing. For item 2 the fallback is
computing that geometry in C# without Eyeshot.

## 12. Out of scope for version 1

- Named groups, saved selections, and selections in the .xlsx.
- Mapping to bill-of-quantities codes or an ERP.
- Loading xrefs.
- Paper-space layouts.
- Geometry inside blocks counted towards layer lengths or areas.
- 3D quantities (volumes, solids, surfaces).
- PDF input.
- The ΝΟΚ coverage table (a later profile on this reader).
- Merging with the laser engine.
- Any server-side processing.

## 13. Open questions for Aris

1. Which offices could lend real DWGs (MEP and architectural) for the pre-launch check?
2. Is the example drawing's content right: pipes, ducts, hatched rooms, doors and windows?
