# Laser DXF check: design

Date: 2026-09-27. Status: approved in conversation, section by section. This document is the binding reference
for the implementation plan.

## 1. Purpose and audience

A free tool on www.aidedcam.com that checks, repairs and prices a laser-cutting order made of DXF or DWG files.

- **Shop-first.** The page is written for a laser or sheet-metal shop's intake: "check and price a customer's
  order". The shop's customers can use the same page to fix a file before sending it.
- **Why it exists.** It is a lead magnet for AidedCAM's tailor-made software. Every shop's quoting and nesting
  workflow is different, so the call-to-action offers to build this into that workflow.
- **Success.** A shop drops a real customer order and within seconds sees:
  - which files are ready and what was repaired;
  - what still needs the customer;
  - cut length, pierces, weight and cutting time per part and for the order.

  It then downloads clean DXFs that its laser CAM opens without further cleaning.

## 2. Decisions

| Decision | Choice |
|---|---|
| Inputs, version 1 | DXF (R11 to 2018 format) and DWG (R14 to 2018 format). Vector PDF is phase 2; newer DWG formats wait for Eyeshot. |
| Geometry engine | devDept Eyeshot 2026, compiled to WebAssembly and run in the visitor's browser |
| devDept | Written yes to public browser use, no conditions (2026-09-27). The standard notice is shown anyway (§10). |
| Unit of work | A whole order: several files, each with a quantity, and order totals |
| Gate | None. Completely free, like the G-code viewers |
| Cutting time | From the shop's own speeds and pierce times, starting from researched defaults |
| Hosting | The existing static GitHub Pages site. No server; nothing is uploaded. |

## 3. Architecture

**The page** is `laser-dxf-checker.html`, in plain HTML and JavaScript. It reuses the viewers' shared shell in
`js/gcode/shell/`:

- i18n and the language switch;
- settings storage;
- file input, with a new multiple-file mode;
- banners;
- consent and GA.

The page's own modules live in `js/laser/`. It paints instantly and loads no engine until a file arrives.

**The engine** is a headless .NET 10 WebAssembly module, not a Blazor app, built on Eyeshot 2026.

- It runs in a dedicated Web Worker and exposes its functions to JavaScript with `[JSExport]`.
- It starts on the first file drop or on "Load example order". The download is about 12 MB, done once and then
  cached; a progress banner shows it.
- It uses only Eyeshot's managed, cross-platform classes, verified in the Eyeshot 2026 API reference:
  - `ReadDXF` and `ReadDWG` to read;
  - `Region` for areas and containment;
  - `CompositeCurve` for contour curves;
  - `WriteDXF` to write the repaired file.
- The x64/ODA classes (`ReadAutodesk`, `WriteAutodesk`) and the WinForms-only helpers (`UtilityEx`) are Windows-only
  and are never referenced.
- Geometry work is in the engine. Pricing is in JavaScript: weight, time, quantities and totals are recomputed
  instantly when a material, thickness, quantity or speed changes. A change of role or tolerance re-runs the
  engine for that file.

**The data contract** between the page and the worker (JSON, with the DXF bytes transferred):

```
→ { type: 'process', id, name, bytes, settings: { units: 'auto'|'mm'|'inch', joinTol, gapTol, roles: { [groupKey]: role } } }
← { type: 'progress', id, stage }
← { type: 'result', id,
    file: { name, format: 'dxf'|'dwg', version, units, unitsSource: 'file'|'assumed'|'setting' },
    groups: [{ key, layer, color, linetype, role, defaultRole, curves }],
    parts: [{ id, outer, holes: [contourId], area, bbox: { w, h }, cutLength, pierces }],
    extras: { openCutLength, openPierces, markLength, markStarts },
    contours: [{ id, role, closed, length, part, isHole, segs: [ {t:'L',x1,y1,x2,y2} | {t:'A',cx,cy,r,a0,a1,ccw} | {t:'P',pts:[...]} ] }],
    texts: [{ x, y, h, rot, value }],
    markers: [{ kind: 'open'|'gap'|'branch'|'self', x, y }],
    checks: [{ id, severity, params }],
    stats: { curvesIn, tinyRemoved, duplicatesRemoved, overlapsMerged, gapsClosed, maxGapClosed, ignored: { hatch, dim, leader, point, other } },
    dxf }
← { type: 'error', id, reason: 'read'|'version'|'limit'|'timeout'|'engine', message }
```

All lengths are in millimetres. Areas are in mm². Angles are in degrees, counter-clockwise from +X.

**Repository layout.** This is still the public site repository.

| Path | Content |
|---|---|
| `_src/laser-engine/` | C# engine (class library), the WebAssembly host project and the test project. Jekyll ignores underscore folders. |
| `js/laser/engine/` | The published WebAssembly output, committed. .NET's default runtime folder is `_framework`, which Jekyll hides. The build renames it where .NET allows; otherwise the site gets a Jekyll `include` allow-list for it. The feasibility gate (§14) settles which. |
| `js/laser/*.js` | Page modules: controller, worker bridge, pricing, drawing, zip writer, report |
| `_tests/laser/` | Node tests for the JavaScript modules |

**The build** runs on Aris's machine, because it references Eyeshot 2026 from the local installation. It is a
single documented command that publishes into `js/laser/engine/`. No licence key, serial or licence file is ever
committed; the browser test showed the headless runtime needs none.

## 4. Reading a file

- The format is detected from the content, not the file name. Binary DXF is refused with a clear message.
- **Scope:**
  - Model space only; paper-space layouts are ignored.
  - Block references, including nested blocks and arrayed inserts (MINSERT), are exploded with their transforms.
  - Tables, tolerances and multileaders arrive from Eyeshot as block references and are exploded like any block.
- **Curves used:**
  - line and arc;
  - circle, which is closed;
  - ellipse and elliptical arc;
  - polyline, keeping the arcs of its bulge segments;
  - spline;
  - 3D polyline, used only if it lies flat.
- **Flatness.** Geometry is flattened onto the XY plane. A file whose cut geometry is not flat gets the `not-flat`
  warning.
- **Units:**
  - The file's own units are used.
  - Inches are converted to millimetres (`units-inch` info).
  - A file that states no units is read as millimetres (`units-assumed` warning).
  - A units setting overrides both.
- **Text encoding** (Greek code pages in older files, Unicode in newer ones) is left to Eyeshot's readers.
- **Current AutoCAD.** Whether the latest AutoCAD releases still write the 2018 DWG format, which `ReadDWG`
  covers, is confirmed in the plan's research task. A newer format gets `read-error` with the reason
  "version", and the message asks the customer to save as 2018 DWG or as DXF.

## 5. Repair

The steps run in this order. Every change is counted in `stats` and, where it has a location, marked on the drawing.

1. **Tiny curves.** Curves shorter than 0.001 mm are removed.
2. **Duplicates and overlaps.**
   - Identical curves are removed, including reversed ones.
   - Collinear overlapping lines, and overlapping arcs on the same circle, are merged, so each stretch is cut
     once.
3. **Join.** Curve ends within the **join tolerance** (default 0.01 mm) are treated as one point.
4. **Close gaps.**
   - Ends within the **gap tolerance** (default 0.2 mm) of each other are pulled together:
     - a line end moves;
     - an arc gets a short connecting line, because moving an arc end would change its radius.
   - Each closed gap gets a marker.
   - Gaps wider than the gap tolerance are left open.
5. **Contours.** The curves are chained into contours.
   - A chain that returns to its start is a **closed contour**.
   - Anything else is an **open path**, with a red marker at each loose end.
   - A point where three or more curve ends meet is a **branch** (`branch` warning).
   - A closed contour that crosses itself gets the `self-intersect` warning.
   - In both cases the laser path is ambiguous there.

The tool never closes a gap wider than the gap tolerance and never deletes geometry except in steps 1 and 2.

## 6. Parts

Closed contours with the cut role are ordered by containment, using `Region.IsPointInside` on a point of each
contour.

- A contour inside no other contour is a **part**.
- A contour directly inside a part is one of its **holes**.
- A contour inside a hole is a **new part**, such as a piece cut free from inside a window.

A file can therefore hold several parts. When it does, the `multi-part` info note tells the visitor that the
quantity multiplies the whole file.

## 7. Roles

Geometry is grouped by **layer + colour**. Each group has exactly one role:

| Role | Meaning |
|---|---|
| cut | cut through |
| mark | engrave or etch |
| bend | a bend line for the press brake: kept in the output, never cut |
| ignore | left out of the numbers and out of the output |

**Default rules** match the layer name, case-insensitive:

| Layer name contains | Role |
|---|---|
| mark, engrave, etch, χάραξ, σήμανσ | mark |
| bend, fold, κάμψ, στράντζ | bend |
| dim, defpoints, construction, center, centre, άξον, διάστασ | ignore |
| anything else | cut |

- **Linetypes.** A group on the cut role with a dashed or centre linetype keeps the cut role and gets the
  `dashed-on-cut` warning. Guessing either way could cost a part.
- **The roles table** lists every group with a role dropdown. A change re-runs the engine for that file and is
  remembered for the session.
- **Text** (TEXT, MTEXT, attributes) is never cut and has no role. It goes to the TEXT layer of the repaired DXF as
  text (`text-kept` info with a count).
- **Dropped entities.** Hatches, dimensions, leaders, points and other non-curve entities are dropped from the
  output and counted (`ignored-entities` info).

## 8. Numbers

**Per part.** The engine counts only contours with the cut role.

| Number | Definition |
|---|---|
| Cut length | Total length of the part's closed contours (outer contour + holes) |
| Pierces | 1 per closed contour |
| Net area | Outer area minus hole areas, from Eyeshot's `Region.GetArea` |
| Bounding box | W × H of the outer contour |

**Per file:**

| Number | Definition |
|---|---|
| Open-path cut length | Total length of open paths on the cut role |
| Open-path pierces | 1 per open path |
| Mark length and mark starts | Mark geometry, listed separately |

**In JavaScript:**
- **Weight** = net area × thickness × density.
- **Time** = cut length ÷ cutting speed + pierces × pierce time + mark length ÷ marking speed.
- **File totals** are the sum of its parts plus its open paths, times the file's quantity.
- **The order total** is the sum over all files.
- **Incomplete totals.** When any file has open paths or could not be read, the time and weight totals get "≥",
  as on the viewers.

**Materials** apply to the whole order, and each file can override them. Densities in g/cm³:

| Material | Density |
|---|---|
| Steel | 7.85 |
| Stainless steel | 7.93 |
| Aluminium | 2.70 |
| Galvanised steel | 7.85 |
| Copper | 8.96 |
| Brass | 8.50 |

**Speeds** form a table per material and thickness, with these columns:
- cutting speed, in mm/min;
- pierce time, in s;
- marking speed, in mm/min.

The rules for the table:
- The rows cover thicknesses 0.5–20 mm. Between rows, values are interpolated linearly; outside the table the
  nearest row applies, with a note.
- The defaults are typical fiber-laser values. They are researched and recorded in
  `_docs/laser-checker/speed-defaults.md` with sources, and any figure no source confirms is marked UNVERIFIED.
- The page labels them "typical values: set your machine's". Edits are saved in the browser.

## 9. Checks

Each check has an id, a severity, and text in Greek, English and Italian under `lc.check.<id>`.

| Id | Severity | When |
|---|---|---|
| `read-error` | error | The file could not be read (reason given) |
| `too-large` | error | The file is over a limit (§12) |
| `empty-cut` | error | Nothing on the cut role |
| `open-path` | error | An open path on the cut role (count, total length) |
| `branch` | warn | Three or more curve ends meet at a point |
| `self-intersect` | warn | A closed contour crosses itself |
| `dashed-on-cut` | warn | A dashed or centre linetype on the cut role |
| `not-flat` | warn | Cut geometry does not lie in one plane |
| `units-assumed` | warn | No units in the file; mm assumed |
| `units-inch` | info | Converted from inches |
| `gaps-closed` | info | Gaps closed (count, largest) |
| `duplicates-removed` | info | Duplicates removed and overlaps merged (count, length) |
| `tiny-removed` | info | Tiny curves removed (count) |
| `text-kept` | info | Text moved to the TEXT layer (count) |
| `ignored-entities` | info | Hatches, dimensions and other entities dropped (counts) |
| `multi-part` | info | The file holds several parts (count) |

The status column shows:
- ✖ if the file has any error;
- ⚠ if it has any warning, or a repair was made;
- ✔ otherwise.

## 10. The page

**Header:**
- title, one-line promise, and "nothing leaves your computer";
- links to the free-tools index and the two viewers.

**Input:**
- A drop zone that is also an **Open files** button; multiple files, DXF and DWG.
- **Load example order**: a synthetic order of 3–4 parts built for the tool, with no customer data:
  - a bracket with holes;
  - a flange;
  - a part with deliberate gaps, doubled lines, text and a bend line.

**Engine banner.** On the first use: "Loading the geometry engine, about 12 MB, only the first time… n %".

**The parts table:**
- one row per file: file, parts, status, cut length, pierces, net area, weight, time, quantity, material,
  thickness, **Download DXF**;
- totals underneath;
- clicking a row selects the file.

**The drawing** is SVG and shows the selected file.
- Colours:
  - cut in ink;
  - mark in blue;
  - bend in dashed orange;
  - ignored geometry and text in light grey;
  - open ends in red markers;
  - closed gaps in amber markers.
- Zoom, pan and fit work as on the lathe viewer.
- Hovering a contour shows its length and whether it is an outer contour or a hole.
- Beside the drawing sit the file's checks list and its roles table.

**Settings panel:**
- units when the file states none;
- join tolerance and gap tolerance;
- order material and thickness;
- the speeds table.

Settings are saved in the browser, under keys separate from the viewers'.

**Outputs:**
- **The repaired DXF.** Written in R12 format, with arcs and circles kept as arcs.
  - Layers: CUT (ACI 7), MARK (ACI 5), BEND (ACI 30, dashed) and TEXT (ACI 8).
  - Splines and ellipses are approximated as polylines within 0.01 mm, as the R12 format requires.
  - File name: `<name>-laser.dxf`.
- **All files** as one ZIP, written in the browser without compression.
- **A printable report**: header with date, parts table, totals, and each file's drawing with its checks.

**Around the tool:**
- **Call-to-action:** "Want this inside your quoting or nesting workflow? We build it around your machine."
- **The optional one-click survey**, as on the viewers.
- **GA events**, sent only after consent:
  - `laser_files_loaded { files, parts, errors, open, repaired }`;
  - `laser_example_loaded`;
  - `laser_dxf_download`;
  - `laser_zip_download`;
  - `laser_print`;
  - `laser_cta_click`;
  - `laser_survey { answer }`.
- **Footer**, in addition to the site footer: "Geometry engine: Eyeshot. Portion of copyright © devDept Software
  S.r.l. All Rights Reserved."
- **Languages:** Greek (default), English and Italian, using the viewers' pattern: shared keys in a strings file,
  page keys inline.
- **Phones:** the layout stacks at 375 px with no horizontal scroll. The parts table scrolls inside its own box.
- **Site links:** a card on `free-tools.html`, a sitemap entry and a line in `llms.txt`.

## 11. Performance targets

| What | Target |
|---|---|
| Page first paint | Instant; no engine download |
| Engine first load | Under 5 s at 50 Mbit/s; cached afterwards |
| A typical part (under 5,000 curves) | Processed in under 2 s |
| Pricing change (material, quantity, speed) | Instant; no engine call |

## 12. Errors and limits

- **Limits:**
  - 20 MB per file;
  - 200,000 curves per file after blocks are exploded;
  - 50 files per order;
  - 30 s per file.
- A file over a limit, or one that fails to read, gets an error on its row. The rest of the order continues.
- **Engine that cannot start** (no WebAssembly, no worker, or a failed download): a banner says so and offers a
  retry. The page's text and links keep working.
- **Engine that crashes on a file:** the worker is restarted, that file is marked with `read-error`, and the queue
  continues.
- Files are processed one at a time, in the order they were dropped.

## 13. Testing

- **Engine.** `dotnet test` runs on the same C# code on Aris's machine.
  - The fixtures are small synthetic DXF files written by the tests. DWG fixtures are written once with Eyeshot's
    desktop writer and committed; they are synthetic, never customer files.
  - Every repair step, every check, nesting, text, blocks, units, polyline arcs and splines get a case.
  - The numbers are checked against shapes whose results can be worked out by hand, for example a 100 × 50 plate
    with four Ø10 holes.
- **JavaScript.** Node tests for the pure modules: pricing, interpolation, totals and "≥", the zip writer, the
  roles table state and formatting. `node --test "_tests/laser/*.test.js"` runs next to the viewers' suites.
- **Browser.** Playwright runs the whole flow:
  - the example order;
  - repairs shown on the drawing;
  - role changes;
  - DXF and zip downloads;
  - print;
  - Greek, English and Italian;
  - 375 px;
  - no external network requests.
- **Real files, private, before launch.** Aris runs 5–10 real customer files from the git-ignored `_tests/private/`.
  - He compares cut length and pierces with what his laser CAM reports.
  - The result goes into `_docs/laser-checker/real-file-check.md` as figures only, with no names and no geometry.

## 14. Feasibility gate (the plan's first task)

Before any user interface is built, a minimal engine must prove all of the following on the real hosting
constraints:

1. The .NET 10 WebAssembly runtime with Eyeshot boots inside a Web Worker, and a `[JSExport]` function returns a
   result.
2. `ReadDXF` and `ReadDWG` read a synthetic file in the browser, and `WriteDXF` writes R12.
3. The trimmed download size is known, and loading works from static files as GitHub Pages serves them:
   - compressed transfer, via a decoder if Pages does not serve pre-compressed files itself;
   - the `.wasm` content type;
   - the runtime folder name.
4. The engine makes no network call at runtime, including no licence-server call.

If any item fails, work stops, and the fallback is decided with Aris before continuing.

## 15. Launch

- The deploy-day `?v=` bump, as for the viewers.
- A check on the live site that the engine loads and the example order works.
- The devDept notice is present.
- The free-tools card, sitemap and `llms.txt` are live.

## 16. Out of scope for version 1

- Nesting.
- Pricing in euros.
- PDF input.
- DWG formats newer than 2018 and older than R14.
- 3D parts and tubes.
- Offsetting for the kerf.
- Lead-ins.
- Cutting order.
- Any server-side processing.

## 17. Open questions for Aris

1. Should the default speeds and pierce times come from research alone, or from Aris's own machine's numbers?
2. Is the material list right, and are more materials needed?
3. Which shop could test the tool before launch?
