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
