# Real-file check: DWG quantities

Spec §9. Before launch, run 5–10 real Greek drawings (MEP and architectural) through the tool and compare its
numbers with AutoCAD's own and with SmartCAD's. The files stay in the git-ignored `_tests/private/`; this record
holds figures only: no office names, no file names, no layer names, no geometry.

How to run a file: open `dwg-quantities.html` on the local server and drop the file. In AutoCAD, on the same file:
- lengths: select the layer (`QSELECT`, or `LAYISO` then select all) and read the total length (`LIST` shows it for
  polylines; for mixed entities use `DATAEXTRACTION` with the Length column);
- areas: `DATAEXTRACTION` with the Area column for closed polylines and hatches;
- block counts: `DATAEXTRACTION` with Count, per block name (dynamic blocks under their own name);
- attributes: the same extraction with the attribute columns.

In SmartCAD Quantity Takeoff, note block counts and lengths per layer.

Also note, per file:
- whether the file states its units correctly (if not: which units it was really drawn in, and whether the
  per-file units override fixed it);
- dynamic blocks: were they counted under the name AutoCAD shows (this checks the byte-order fallback in
  `Blocks.Name`, which the synthetic fixtures cannot prove against a real AutoCAD file);
- Greek layer names and attribute values: shown correctly, in a pre-2007 DXF too?
- elliptical hatch boundaries: a partial ellipse edge (not a full ellipse) in a DWG and in a DXF — the engine reads its start/end as angles, not parameters, and ACadSharp 3.3.23 loses a DXF ellipse edge's major axis (that hatch shows ⚠ and is left out); compare with AutoCAD's area;
- DXF hatches with arc edges (curved or circular rooms): the area must match AutoCAD (their angles are stored in degrees);
- a pre-2007 DWG with Greek layer names (the code-page path): are the names shown correctly?
- a dense survey or contour drawing: is the drawing simplified, and how long does it take?
- associative arrays (ARRAYRECT): are they counted as `*U…` blocks rather than by the name AutoCAD shows?
- a Greek-Excel paste of Copy: the numbers must land as numbers, not ×1000.

| # | Format / version | Entities | Units right? | Layer (anonymised) | Tool length (m) | AutoCAD length (m) | Diff % | Tool area (m²) | AutoCAD area (m²) | Diff % | Blocks: tool vs AutoCAD | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

Acceptance: lengths and areas within 0.5 % of AutoCAD on every layer compared; block counts equal; every warning
the tool raised names a real property of the file. Anything else is a bug to fix before launch.

Timing on the same machine (the browser's first file includes the engine start):

| # | Entities | Seconds in the browser |
|---|---|---|

Recorded by: (name), (date).
