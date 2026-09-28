# Real-file check: laser DXF check

Spec §13. Before launch, run 5–10 real customer files through the tool and compare its numbers with what the shop's
laser CAM reports for the same files. The files stay in the git-ignored `_tests/private/`; this record holds figures
only: no customer names, no file names, no geometry.

How to run a file: open `laser-dxf-checker.html` on the local server, drop the file, set the material and thickness the
CAM used, and read the row. In the CAM, import the same file with its usual cleanup and read cut length and pierces.

| # | Format / version | Curves | Tool status | Tool cut length (mm) | CAM cut length (mm) | Diff % | Tool pierces | CAM pierces | Checks the tool raised | Did the CAM open the repaired DXF without cleanup? |
|---|---|---|---|---|---|---|---|---|---|---|

Acceptance: cut length within 1 % and pierces equal on every file the tool marks ✔ or ⚠; every ✖ file has a check
that names the real problem. Anything else is a bug to fix before launch.

Timing on the same machine (the browser's first file includes the engine start):

| # | Curves | Seconds in the browser |
|---|---|---|

Recorded by: (name), (date).
