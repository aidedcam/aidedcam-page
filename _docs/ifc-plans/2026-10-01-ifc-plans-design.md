# IFC to DXF floor plans: design

Date: 2026-10-01. Status: approved in conversation, section by section. This document is the binding reference for
the implementation plan.

## 1. Purpose and audience

A free tool on www.aidedcam.com. It reads an IFC model and gives **one R12 DXF floor plan per storey**, cut at a
chosen height above each storey's level. Every IFC element type goes on its own layer, and each room gets a label with
its name and area.

- **Audience:** structural and MEP offices, contractors and CAD-only consultants who receive an architect's IFC but
  draw in AutoCAD, ZWCAD, BricsCAD and the like. On the tools index the card goes in the "Engineering offices" group.
- **Why it exists.** It is a lead magnet for AidedCAM's tailor-made software, and the site's first IFC tool. Success
  is contacts: an engineer drops an IFC, gets clean plans in seconds, and finds them usable as XREFs.
- **What stays for the paid conversation:**
  - plans set up on an office's own layers and blocks;
  - door swings, dimensions and annotation;
  - the IFC route into the coverage pre-check;
  - batch conversion inside their CAD.
- **The gap.**
  - Greek offices pay for ERGOCAD "BIM Inside" for this job.
  - The only free online rival, BIMCamel, uploads the file and caps free use at 25–100 MB and 3–10 runs a day.
  - No free tool does it in the browser without an upload. (Research: `reports/General BIM free tool ideas.md`.)

## 2. Decisions

| Decision | Choice |
|---|---|
| Gate | None. Completely free, like the other tools, with a soft CTA, anonymous GA and the one-click survey |
| Engine | **web-ifc 0.0.78** (MPL-2.0), pinned and vendored, parses the IFC and streams triangle meshes. Our own JavaScript cuts the plans and writes the DXF. **No Eyeshot**: the 2026-10-01 spike measured a median load of 19.0 s for Eyeshot WASM against 0.35 s for web-ifc + JS, with the same cut geometry and a 13.2 MB download against 1.1 MB (spike report in the session scratchpad, summarised in §12) |
| Content per storey | The cut lines on a layer per element type, the room outlines, and room labels (name + area) |
| Packaging | One ZIP with a DXF per storey, plus a download per storey. Every plan keeps the IFC's coordinates, so the storeys overlay as XREFs |
| Units | The visitor chooses m (default), cm or mm, and the choice is remembered in the browser. `$INSUNITS` is set accordingly. Room areas are always in m² |
| Origin | A "move to origin" checkbox, off by default. When it is on, the shift is written into each DXF as a comment |
| Cut height | One field, default 1.10 m above each storey's level, applied to every storey |
| Not in v1 | Door swings, stair treads and anything below the cut (hidden lines), dimensions, DWG output, a combined side-by-side sheet, the coverage pre-check's `AC_*` layers, per-storey cut heights |
| Hosting | The existing static GitHub Pages site. No server, no special headers; nothing is uploaded |

## 3. Architecture

**The page** is `ifc-plans.html`, in plain HTML and JavaScript. Its modules live in `js/ifcplan/`. It reuses, without
editing them:

- the shared shell `js/gcode/shell/`: i18n, the language switch, settings storage, banners, consent and GA;
- `js/laser/bridge.js`: queue, one file at a time, timeout and worker restart. Its `makeWorker` option points it at
  this tool's worker;
- `js/laser/zip.js` for the ZIP.

The page paints instantly. The worker and web-ifc load only when a file arrives or the example is requested.

**The worker** (`js/ifcplan/worker.js`, a module Web Worker) holds web-ifc. It is single-threaded, so it needs no
SharedArrayBuffer and no COOP/COEP headers.

1. **Open:** `OpenModel(bytes, { COORDINATE_TO_ORIGIN: false })`.
2. **Read the header and units:** the schema, the authoring application, and the length unit from
   `IfcProject.UnitsInContext` (SI prefixes and conversion-based units such as feet and inches).
3. **Read the storeys.** The level is the **world Z of the storey's placement chain**, as the sum of Location Z along
   `PlacementRelTo`. `IfcBuildingStorey.Elevation` is relative to the building and is wrong for georeferenced files.
   The storeys are sorted by level.
4. **Stream the meshes:** `StreamAllMeshes`, plus `StreamAllMeshesWithTypes([IFCSPACE])` for rooms, since the first
   leaves them out. web-ifc's Y-up output is converted back to IFC Z-up.
5. **Cut** every triangle against every storey's cut plane (level + cut height) in one pass. The result is segments
   per storey and layer (`cut.js`).
6. **Return** per storey: segments by layer, the rooms (name, outline, area), the elements cut, and the elements with
   no geometry. File-level information comes back too: schema, application, unit scale, products, the bounding box.
7. **Keep the model open** until the next file, so a changed cut height re-streams without re-reading the bytes.

**The data contract** (bridge messages, `type: 'process'` as the bridge sends it):

```
→ { type: 'process', id, name, bytes, settings: { cutM } }
← { type: 'result', id, file: { schema, app, unitM, products, bbox }, storeys: [{ name, levelM, layers: { WALL: Float64Array[x0,y0,x1,y1,…], … },
     rooms: [{ name, longName, outline: [x,y,…], areaM2, areaFrom: 'qto' | 'outline' }], cut: n, noGeometry: [{ type, count }] }] }
→ { type: 'process', id, name: 'recut', bytes: empty, settings: { cutM, recut: true } }   // reuses the open model
← { type: 'error', id, reason: 'read' | 'schema' | 'limit' | 'timeout' | 'engine' | 'empty', detail }
```

Coordinates leave the worker in metres, in IFC world coordinates.

**Pure modules** have no DOM and no web-ifc, so Node tests can pin them:

| Module | Job |
|---|---|
| `cut.js` | Triangle ∩ horizontal plane → segment; one pass for many planes |
| `chain.js` | Joins segments into polylines (tolerance 0.5 mm), merges collinear runs, closes loops |
| `layers.js` | IFC type → layer table and colour; filters annotation-only proxies (grid and level markers) |
| `rooms.js` | Room label text, label point (polylabel-style point inside the outline), area from Qto or from the outline |
| `dxf.js` | R12 writer: header (`$ACADVER AC1009`, `$DWGCODEPAGE ANSI_1253`, `$INSUNITS`, extents), the layer table, LWPOLYLINE-free POLYLINE/VERTEX output, TEXT, the comment block; plus the cp1253 encoder |
| `names.js` | Storey file names: `NN <storey name>.dxf`, characters Windows forbids replaced, duplicates numbered |

`ui.js` is the controller and `drawing.js` the canvas preview. `i18n-ifcplan.js` holds the tool's strings as
`window.IP_I18N` (el, en, it).

**Repository layout:**

| Path | Content |
|---|---|
| `ifc-plans.html` | The page, with its inline page strings, consent, GA and language switcher (copied from `dwg-quantities.html`) |
| `js/ifcplan/*.js` | The modules above |
| `js/ifcplan/vendor/web-ifc/` | `web-ifc-api.js`, `web-ifc.wasm`, `LICENSE` (MPL-2.0), and a `SOURCE.md` naming the npm version and the upstream URL |
| `js/ifcplan/examples/example-house.ifc` | The example model (§10) |
| `_tests/ifcplan/` | Node tests, the example generator and the browser check |
| `_docs/ifc-plans/` | This spec, the plan, and `real-file-check.md` |

## 4. Layers

| Layer | IFC types | ACI colour |
|---|---|---|
| `IFC_WALL` | IfcWall, IfcWallStandardCase, IfcWallElementedCase | 7 |
| `IFC_DOOR` | IfcDoor | 4 |
| `IFC_WINDOW` | IfcWindow | 5 |
| `IFC_COLUMN` | IfcColumn | 1 |
| `IFC_BEAM` | IfcBeam, IfcMember | 8 |
| `IFC_SLAB` | IfcSlab, IfcRoof, IfcCovering | 9 |
| `IFC_STAIR` | IfcStair, IfcStairFlight, IfcRamp, IfcRampFlight | 3 |
| `IFC_RAILING` | IfcRailing | 30 |
| `IFC_CURTAINWALL` | IfcCurtainWall, IfcPlate | 140 |
| `IFC_FURNITURE` | IfcFurnishingElement, IfcFurniture, IfcSanitaryTerminal | 40 |
| `IFC_MEP` | IfcFlowSegment, IfcFlowTerminal, IfcFlowFitting, IfcDistributionElement and their IFC4 subtypes | 6 |
| `IFC_OTHER` | IfcBuildingElementProxy and any other product with a body | 8 |
| `IFC_SPACE` | IfcSpace outlines | 2 |
| `IFC_SPACE_TEXT` | Room labels | 2 |

**What is never drawn:** IfcOpeningElement, IfcAnnotation, IfcGrid, IfcSite and IfcVirtualElement.

**Proxy filtering.** An IfcBuildingElementProxy is dropped when its bounding box is under 1 mm thick in Z and it has
no Body representation. This catches the grid/level marker crosses some Revit exports carry.

## 5. Plans

**The cut.**
- Each triangle that crosses the plane gives one segment.
- A triangle lying in the plane is skipped, so a slab top exactly at the cut height draws nothing rather than
  garbage.
- Segments shorter than 0.1 mm are dropped.
- `chain.js` then joins the segments into polylines, which come out as closed POLYLINEs where a loop closes.

**Room labels:**
- The text is `Name` on the first line and `LongName` on the second when both are present. Revit puts the number in
  Name and the name in LongName.
- The area line follows, e.g. `24.50 m²`. Its value comes from `Qto_SpaceBaseQuantities.NetFloorArea` (or
  `GrossFloorArea`) when present, otherwise from the outline's shoelace area, at 2 decimals.
- The text height is 0.20 m in drawing units (200 in mm, 20 in cm). The label sits at a point inside the outline.
- Greek and other non-ASCII text is written in code page 1253. A character outside 1253 becomes `?`, and a warning
  counts how many were replaced.

**Room outlines** come from the IfcSpace mesh cut at the same plane. A space the plane doesn't cross (lower than
the cut height) gets no outline. If it belongs to this storey, its label goes at the centre of its plan bounding box,
and a warning counts such rooms.

**Units and origin:**
- Every coordinate is multiplied by the unit factor (m 1, cm 100, mm 1000).
- With "move to origin", the plan's lower-left corner over the whole model, rounded down to 1 m, is subtracted.
- Each DXF starts with a 999 comment block: the source file name, the storey, its level, the cut height, the unit and
  the shift, e.g. `999` / `Shift: X −538 512 000 mm, Y −… mm; add it back to return to the IFC's coordinates`.
- Outside the header, coordinates are written with at most 6 significant decimals.

## 6. The page

1. **A header:** the title, a one-line explainer, "Your file stays on your computer; nothing is uploaded", and the
   indicative note "Plans cut from the model's geometry. Check against the architect's drawings".
2. **A drop zone:** "Open file", and "Load example".
3. **A summary line:** file name, schema, authoring application, the number of storeys and products.
4. **Settings:** cut height in m, units (m/cm/mm), and the "move to origin" checkbox. These are remembered in the
   browser. A changed cut height re-cuts the file, and its time is shown. Units and origin only rewrite the DXFs.
5. **The storey table:** name, level, elements cut, ⚠ elements without geometry, rooms, and a "DXF" download per
   storey. "Download all (ZIP)" sits above it. Clicking a row selects that storey for the preview.
6. **The preview:** the selected storey on a canvas, coloured by layer, with a legend, pan, zoom, fit, and a hover
   tooltip showing the layer.
7. **Warnings,** each one line, e.g.:
   - "51 elements had no geometry and are not drawn (IfcWallStandardCase 51)";
   - "Coordinates are 540 km from the origin; consider 'move to origin'";
   - "4 characters could not be written in Greek code page 1253".
8. **The v1 note:** "Not drawn in this version: door swings, stair treads below the cut, hidden lines, dimensions."
9. **The CTA block and survey** as on the other tools.
10. **The footer,** with the web-ifc notice: "IFC reading: web-ifc (ThatOpen Company), MPL-2.0, source on GitHub",
    with a link.

The page is phone-friendly. The tables scroll inside their own boxes, and the preview takes the full width.

## 7. Errors and limits

| Situation | What happens |
|---|---|
| File over **150 MB** | Refused before reading: "This file is over 150 MB, more than a browser tab handles reliably" |
| File over 50 MB | Accepted, with a "large file: this may take a while" note |
| Not an IFC (no `ISO-10303-21` header) or `.ifcZIP`/`.ifcXML` | `read` error, naming what is supported: `.ifc` in STEP text |
| A schema web-ifc can't open | `schema` error, naming the schema found |
| No storeys | Everything goes into one plan named after the file, with a warning |
| A storey with nothing at the cut | The row says "nothing at 1.10 m"; its DXF is still offered, with only the comment block |
| Worker timeout (120 s) or crash | `timeout`/`engine` error, the worker restarts, and the message suggests a desktop browser for large files |
| Out of memory | Treated as an engine crash, with the same message |

Each error is one line in the visitor's language, and the page stays usable for the next file.

## 8. GA events

All of these are consent-gated and anonymous: never file names, storey names or figures.

- `ifcp_file_loaded` `{ schema, size: under-10mb | 10-50mb | over-50mb, storeys: bucket 1 | 2-5 | 6-20 | over-20 }`
- `ifcp_example_loaded`
- `ifcp_download` `{ what: storey | zip, units }`
- `ifcp_recut`
- `ifcp_error` `{ reason }`
- The shared survey and CTA events, as on the other tools.

## 9. Performance targets

Measured in headless Chrome on the development laptop:
- the example: under 1 s from click to preview;
- a 13 MB IFC: under 2 s;
- the 47 MB spike sample: under 3 s;
- a re-cut: under 1 s for 13 MB.

The spike measured 0.11–0.96 s for parsing plus cutting all storeys.

## 10. The example

A **synthetic IFC4 house written by our own generator** (`_tests/ifcplan/make-example.mjs`), so
there is no third-party licence question.
- **Storeys:** two, "Ισόγειο" at 0.00 and "Όροφος 1" at 3.00.
- **Walls:** exterior and interior walls as extruded solids, with IfcOpeningElement voids filled by one door and two
  windows.
- **Other elements:** one column, one stair flight crossing the ground-floor cut, and one railing on the upper floor.
- **Rooms:** three IfcSpace objects with Greek names ("Σαλόνι", "Κουζίνα", "Υπνοδωμάτιο"), and a
  Qto_SpaceBaseQuantities on one of them.

The generator is deterministic, and `--check` confirms the committed file is byte-identical. The expected plans
(segment counts per layer, room labels and areas) are pinned in the tests and in §11.

## 11. Testing

**Node** (`node --test _tests/ifcplan/*.test.js`):
- **`cut.js`:**
  - a box's triangles give a rectangle;
  - a vertex exactly on the plane;
  - a triangle in the plane gives nothing;
  - several planes in one pass.
- **`chain.js`:** loops close, collinear runs merge, the tolerance holds, and open chains stay open.
- **`layers.js`:** every row of §4, and the proxy filter.
- **`rooms.js`:** shoelace area, Qto before outline, label point inside an L-shape, and the Name/LongName rules.
- **`dxf.js`:**
  - the R12 structure parses back;
  - `$INSUNITS` is 6/5/4 for m/cm/mm;
  - the Greek text round-trips through cp1253, and a non-1253 character is replaced and counted;
  - the shift comment;
  - no TEXT or POLYLINE breaks on an empty layer.
- **`names.js`:** forbidden characters, duplicates and Greek names.
- **End to end in Node through web-ifc** on the example: the storey levels, the per-layer counts, and the labels
  "Σαλόνι" with its area, with tolerance-checked geometry.
- **Strings:** the i18n key parity, placeholders, the Italian typographic ’ and formal voi.
- **The site:** the page, free-tools card, sitemap and llms.txt checks.

**Browser** (`_tests/ifcplan/browser-check.js`, same runner pattern as the other tools):
- the example loads, with two storeys;
- every DXF re-parses;
- the ZIP holds two entries;
- a unit switch rewrites `$INSUNITS`;
- move-to-origin writes the shift;
- the re-cut works;
- language switching works;
- no external requests;
- no console errors;
- the timings stay within §9.

**The six spike samples** are run once, by hand, for timing and a visual check. They are not committed.

**`real-file-check.md`** records Greek IFC exports (Archicad and Revit) when Aris gets them, before or after launch.

## 12. Spike summary (2026-10-01)

Six public samples (3 Archicad, 3 Revit, 2.3–47 MB, IFC2X3 and IFC4) were run in headless Chrome 154.

| | Eyeshot WASM | web-ifc + JS |
|---|---|---|
| Median time | 19.0 s (load only) | 0.35 s (load, cut every storey and write the DXFs) |
| Peak memory | 306–902 MB | 237–377 MB |
| Download | 13.2 MB gzip | 1.06 MB gzip |

- **Same cuts:** both engines produce the same cut geometry on 5 of 6 files.
- **Known gap:** web-ifc returns no geometry for some voided walls, 4% of the wall length in the 47 MB sample.
  Hence the "no geometry" report in §6 and §7.

## 13. Out of scope for v1

- Door swings and hidden lines below the cut.
- Dimensions.
- DWG output.
- A combined sheet.
- Per-storey cut heights.
- The `AC_*` coverage layers. These are the planned next step, linking this tool to the coverage pre-check.
- `.ifcZIP` and `.ifcXML`.
- Sections and elevations.
- Batch conversion.
- Federated models (several files).

## 14. Launch

The house pattern:
1. The plan is validated in a scratch worktree, then replayed.
2. Subagent-driven execution.
3. Local squash-merge; the push only on Aris's word.
4. Deploy-day `?v=` and sitemap `lastmod`, with a `?v=` value not already live on another page.
5. Check on the live site that the example gives the expected plans.

The repo is public: no client names, local paths or licence data in any committed file. `real-file-check.md` stays a
template until Aris has Greek IFCs.
