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
