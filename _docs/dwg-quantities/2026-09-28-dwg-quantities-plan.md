# DWG Quantities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a free DWG quantities tool to www.aidedcam.com. It reads DWG and DXF drawings in the browser and returns, per layer, lengths, areas and hatch areas, block counts and attribute schedules, on screen with the drawing and as one .xlsx.

**Architecture:**
- **Engine.** A headless C# engine compiled to .NET 10 WebAssembly and run in a module Web Worker.
  - ACadSharp 3.3.23 reads the file once: layers, inserts with their attributes, hatches and polylines.
  - Eyeshot 2026's NURBS `Curve` measures splines exactly.
  - Lengths and areas of lines, arcs and bulges are the engine's own exact geometry (Green's theorem), as in the laser engine.
- **Page.** A plain-JS page (`dwg-quantities.html`) on the viewers' shared shell (`js/gcode/shell/`).
  - It reuses the laser tool's `bridge.js` (the queue, timeout and restart) and `zip.js` (under the new .xlsx writer).
  - Tables, selection totals and the workbook are computed in JavaScript from the engine's result, so they never call the engine again.
- **Build.** The engine is built on Aris's machine from the local Eyeshot installation and published into `js/dwg/engine/`, as committed static files. The laser engine is not touched.

**Tech Stack:**
- C# on .NET 10: an engine class library, a `Microsoft.NET.Sdk.WebAssembly` host with `[JSExport]`, and xUnit tests.
- devDept.Eyeshot 2026.2.284 (NuGet, from the local installation).
- ACadSharp 3.3.23: the engine reads with it, and the tests write their DWG and DXF fixtures with it.
- Plain ES modules; `node --test`; the Playwright MCP for the browser checks.
- The static GitHub Pages site.

**Spec:** `_docs/dwg-quantities/2026-09-28-dwg-quantities-design.md`. Where this plan departs from it, the departure is listed under "Spec refinements" below, with the reason.

**Validated before writing.** Every block below was built and run in a scratch worktree of `feat/dwg-quantities`, and the whole plan was then replayed on a fresh checkout (see "Replay" at the end).
- **Engine:** `dotnet test _src/dwg-engine/Tests` passes 45 tests.
- **Node:** `node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js" "_tests/laser/*.test.js" "_tests/dwg/*.test.js"` passes 302 + 35 = 337.
- **Size:** the published engine is 108 files, 11.4 MB, loaded as gzip.
- **Browser (Chrome, headless):**
  - desktop–browser parity is 6/6 fixtures, including a Windows-1253 Greek DXF, an Eyeshot spline and a dynamic block;
  - the engine boots and measures the first fixture in 0.7–0.8 s from the local server;
  - 10,000 entities take 1.7 s, and 50,000 entities take 13–25 s (see "Big files" below);
  - the page check (`_tests/dwg/browser-check.js`) passes 22/22;
  - there are no requests except to the local server.

## Global Constraints

- **Public repo** (github.com/aidedcam/aidedcam-page). No client names, no customer files, and no values or labels copied from customer files in any committed file, test, doc or commit message. Real files go only in the git-ignored `_tests/private/`.
- **No licence key, serial or licence file** anywhere in the repo. The headless engine needs none; if a step ever seems to need one, stop and ask Aris.
- **Eyeshot's managed classes only:** `devDept.Eyeshot.Entities.Curve` (NURBS length and sampling) and `devDept.Geometry.Point4D`. ACadSharp 3.3.23, the same version Eyeshot depends on, reads the files. Never `ReadAutodesk`, `WriteAutodesk`, `UtilityEx` or any WinForms/WPF/x64 package: they don't run in the browser.
- **The laser tool must not change.** `_src/laser-engine/`, `js/laser/` and `laser-dxf-checker.html` are read, never edited. The new page imports `js/laser/bridge.js` and `js/laser/zip.js` as they are.
- **devDept notice**, on the page's footer, verbatim: `Portion of copyright © devDept Software S.r.l. All Rights Reserved.`
- **Build:**
  - The site has no build step and no npm dependencies.
  - The engine is built only by `powershell -ExecutionPolicy Bypass -File _src/dwg-engine/publish.ps1`, and its output in `js/dwg/engine/` is committed.
- **Privacy:**
  - Nothing is uploaded, and the engine makes no network call.
  - GA events (consent-gated, as on the other tools) never carry file names, layer names, text or geometry.
- **Units:** results in metres and m²; coordinates in metres (spec §3).
- **Limits** (spec §8): 30 MB per file, 300,000 model-space entities per file, 20 files on the page, 60 s per file (see "Timeout" below). The drawing's point budget is 1,000,000 points.
- **Languages:** GR (default)/EN/IT for every user-visible string. The Italian uses the formal "voi" and the typographic `’`. Every non-ASCII character is kept exact.
- **Layout:** at 375 px there is no horizontal page scroll, with a 16 px side gutter; tables scroll inside their own box.
- **Tests:**
  - Node: `node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js" "_tests/laser/*.test.js" "_tests/dwg/*.test.js"`. Quote the globs; on Node 24 a bare folder path doesn't work.
  - Engine: `dotnet test _src/dwg-engine/Tests`.
  - Both run from the repo root.
- **Cache-busting:** `?v=20261015` is a placeholder, and Task 15 replaces it on deploy day. It is on every new asset URL: the page's stylesheet and two scripts, `ui.js`'s imports of its own modules and of `bridge.js`, `view.js`'s import of `selection.js`, the worker URL, and the worker's import of `engine/dotnet.js`.
- **Commits** end with the session trailer, copied verbatim:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
  ```
  The repo-local git email is `akoulousis@aidedcam.com` (the global git email is a different one); Task 0 checks it.
- **Whole files are extracted, never retyped.**
  - A file shown in full is preceded by a line `<!-- file: <path> -->`.
  - Write it with `node _tests/extract.mjs $PLAN <path>`, and check it with the same command plus `--check`, where `PLAN=_docs/dwg-quantities/2026-09-28-dwg-quantities-plan.md`.
  - Binary files are never typed: fixtures, the example drawing and the published engine are generated by the commands given.
- **Never push, merge or amend.** Pushing `main` publishes the live site, and only Aris decides that.

## Review Focus

Inputs real drawings bring that the spec doesn't spell out, most likely first, each pinned by a test:

1. **A file that states the wrong units.** Building drawings are often drawn in cm or m on a template that says mm; the Eyeshot sample apartment reads as 0.18 × 0.12 m. Every number would be off by 10× or 1000×, silently.
   - The visitor can correct one file with the per-file units override (spec refinement below); the file tab always says which units were used and where they came from.

   *Task 2: `The_visitors_override_corrects_a_file_that_states_the_wrong_units`, `Units_come_from_the_file_then_the_setting_then_millimetres` (4 cases). Task 14: check `override cm: walls 856.00 m`.*
2. **Greek names in an older DXF.** A pre-2007 DXF from a Greek AutoCAD stores layer names and attribute values as Windows-1253 bytes under `$DWGCODEPAGE ANSI_1253`, and the browser build runs with invariant globalization.

   *Task 3: the `rooms-2004.dxf` and `blocks-2004.dxf` fixtures carry 1253 Greek bytes; `The_DWG_and_DXF_fixtures_agree`; Task 4 runs them in the browser (parity).*
3. **Dynamic blocks.** Each stretched door or window is an anonymous `*U…` copy. Counted by the copy's name, a schedule of 40 windows turns into 40 one-off rows.

   *Task 2: `A_dynamic_blocks_anonymous_copy_is_counted_under_the_name_users_see` (DWG and DXF). The link's handle comes back byte-reversed from ACadSharp's DWG reader, so both byte orders are tried; a real AutoCAD file is still to be checked (Task 15, real files).*
4. **A drawing too big to draw.** A site plan with thousands of blocks of hundreds of lines each: the page must stay responsive and the numbers must stay complete.

   *Task 2: `A_drawing_over_the_point_budget_is_drawn_simplified_but_measured_in_full`, `A_closed_outline_of_twenty_thousand_vertices_is_checked_in_near_linear_time`. Task 4: the perf page at 50,000 entities.*
5. **A bad file in a batch, or a file that hangs the engine.** It gets an error tab; the others and the Summary continue, and the Summary's totals are marked "≥".

   *Task 8: `admit: …over 30 MB becomes a limit error…`. Task 5: the summary's `missing`/`partial`. Task 14: checks `tabs: …✖` and `summary adds the files and marks the total ≥`. The bridge's timeout and restart are the laser tool's, already tested in `_tests/laser/bridge.test.js`.*

## Spec refinements made while validating this plan

Each one is recorded here so the reviewers can check it against the spec, and so Aris can accept or reverse it.

- **Who measures what** (spec §3 "Eyeshot measures"). Eyeshot's NURBS `Curve` gives splines their exact length (a rational quarter-circle measures π·5 to 1e-14; Eyeshot takes rational control points in homogeneous form, x·w, y·w, z·w, w). Lines, arcs, bulges and areas use the engine's own exact geometry (Green's theorem), as the laser engine does; ellipses are integrated numerically (Gauss–Legendre, 64 panels). Converting every entity to Eyeshot objects would add work and no precision.
- **Per-file units override** (spec §4 said a file's own units always win). The Eyeshot sample apartment states mm and is drawn in other units, and Greek building templates often do the same. Each file's tab has a line "Units: mm (from the file) · Change", and choosing a unit re-measures that file only (`settings.override`, `unitsSource: 'override'`, warning `units-override`). The page-wide setting still applies only to files that state none. **Aris decides at review whether to keep it.**
- **Timeout 60 s, not 30 s** (spec §8). ACadSharp's reading is about 70 % of the work, and .NET's WebAssembly interpreter runs it 15–30× slower than the desktop: 10,000 entities take 1.7 s and 50,000 take 13–25 s in Chrome. The spec's §7 target (under 3 s at 50,000) is not reachable without AOT compilation, which would enlarge the 11.4 MB download; that is left as an option for Aris. The laser tool keeps its 30 s.
- **Message type.** The worker answers `{ type: 'process' }`, not `'quantities'` (spec §3), because the shared `js/laser/bridge.js` sends `'process'` and is reused unchanged.
- **Contract additions.** `items[]` also carry `copies` (a MINSERT's rows × columns) and `bad`; `layers[]` carry `hatchCount` and `bad`; `file.unitsSource` can be `'override'`; warnings carry `params` as an object. The exact shape is in `ResultJson.cs` (Task 2).
- **⚠ means "needs attention".** Text and dimensions (in almost every drawing) and geometry inside blocks (by design) are information lines, not warnings: a file with only those shows ✔ (`INFO_WARNINGS` in `state.js`).
- **Simplified drawing.** Over the point budget, everything is sampled 20× more coarsely, and a block insert of more than 8 pieces is drawn as the outline of its extents. It is still one selectable item and is counted in full.
- **Dynamic block names.** ACadSharp 3.3.23 leaves `BlockRecord.Source` empty for AutoCAD's `AcDbBlockRepBTag` link and reads its handle from a DWG with the bytes reversed; `Blocks.Name` follows the link itself and tries both byte orders.
- **Greek DXF fixtures.** ACadSharp's DXF writer writes UTF-8 under a pre-2007 code page, which no real file does. The fixtures therefore use ASCII placeholders of the same byte length, swapped for Windows-1253 bytes (`Fixtures.Greek1253`); the reader decodes them correctly.
- **Fixtures missing a layer table.** An entity whose layer is not in the LAYER table comes back from ACadSharp on layer "0". Real AutoCAD files always carry the table; the perf page's generated DXF doesn't, which doesn't matter for timing.
- **Example drawing** (spec §5): a synthetic 12 × 9 m apartment in mm, DWG 2018, Greek layers: walls with a column, hatched floors with the column as an island, water with a rounded bend, ducts, windows (one a dynamic block's stretched copy) and doors with attributes, a bathroom set with nested fittings, and an array of 6 ceiling lights plus one.
- **Browser checks as code.** The Playwright MCP disconnected several times while validating. Task 14's checks are therefore one Playwright function (`_tests/dwg/browser-check.js`) that runs either through the MCP or through `node _tests/dwg/browser-check.cjs`, which drives headless Chrome with a local `playwright-core`.
- **Tools-index card and description.** The card reads "Επιμετρήσεις από DWG" / "Quantities from DWG" / "Computi da DWG", like the page title, and the index's meta description now says "για μηχανικούς και προγραμματιστές CNC".

## File structure

| Path | Task | Responsibility |
|---|---|---|
| `.gitattributes`, `.gitignore` | 0 | Byte-exact engine files; engine build output ignored |
| `_src/dwg-engine/nuget.config`, `Engine/Engine.csproj`, `Engine/Geo.cs` | 1 | Points, pieces (line/arc/points), exact areas, bulges, self-intersection, OCS and affine maps |
| `_src/dwg-engine/Tests/Tests.csproj`, `AssemblyInfo.cs`, `GeoTests.cs` | 1 | xUnit project (invariant globalization, no parallel runs) |
| `_src/dwg-engine/Engine/Model.cs`, `Reader.cs`, `Measure.cs`, `Hatches.cs`, `Blocks.cs`, `Quantities.cs`, `ResultJson.cs` | 2 | Result model; open + units; curves; hatches with islands; blocks, nesting, dynamic names, drawing; the pipeline; the JSON contract |
| `_src/dwg-engine/Tests/Cad.cs`, `MeasureTests.cs`, `HatchTests.cs`, `BlockTests.cs`, `FileTests.cs` | 2 | Synthetic drawings and the engine's tests |
| `_src/dwg-engine/Tests/Fixtures.cs`, `Examples.cs`, `_tests/dwg/fixtures/*`, `js/dwg/examples/example-plan.dwg` | 3 | Golden fixtures with expected results; the example drawing |
| `_src/dwg-engine/Host/*`, `publish.ps1`, `js/dwg/worker.js`, `js/dwg/engine/*` | 4 | WebAssembly host, publish, worker, published runtime |
| `_tests/dwg/parity.html`, `perf.html`, `browser-check.cjs` | 4 | Dev-only browser checks (Jekyll skips `_tests`) |
| `js/dwg/tables.js` | 5 | Layer and block rows, totals, the summary across files |
| `js/dwg/selection.js` | 6 | Spatial grid, pick, window/crossing, selection totals, TSV |
| `js/dwg/xlsx.js` | 7 | Minimal .xlsx writer on `zip.js`; the workbook; its file name |
| `js/dwg/state.js` | 8 | The controller's pure decisions |
| `js/dwg/view.js` | 9 | Canvas 2D drawing: pan, zoom, highlight, hover, box |
| `js/dwg/i18n-dwg.js` | 10 | Tool strings GR/EN/IT |
| `dwg-quantities.html`, `css/tools.css` | 11 | The page and its styles (appended) |
| `js/dwg/ui.js` | 12 | The controller |
| `free-tools.html`, `sitemap.xml`, `llms.txt` | 13 | Site links |
| `_tests/dwg/browser-check.js` | 14 | The browser check |
| `_docs/dwg-quantities/real-file-check.md` | 15 | Pre-launch record for real files |
| `_tests/dwg/*.test.js` | 5–13 | Node suites |

---

### Task 0: Branch check and repository attributes

**Files:**
- Modify: `.gitattributes` (append 1 line), `.gitignore` (append 3 lines)

**Interfaces:**
- Produces: `js/dwg/engine/**` is stored byte-exact; `_src/dwg-engine/**/bin/` and `obj/` are ignored. Tasks 3 and 4 rely on this before they add such files.

- [ ] **Step 1: Check the starting point**

Run:
```bash
git branch --show-current && git log --oneline -1
git config user.email
node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js" "_tests/laser/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
dotnet --version
ls "C:/Program Files/devDept/Eyeshot 2026/NuGet Packages/devDept.Eyeshot.2026.2.284.nupkg"
```
Expected:
- the branch is `feat/dwg-quantities`, and HEAD is the commit `DWG quantities: implementation plan`;
- the email is `akoulousis@aidedcam.com` (if not: `git config --local user.email akoulousis@aidedcam.com`);
- `ℹ pass 302` and `ℹ fail 0`;
- a .NET version starting with `10.`;
- the package path is printed.

If Eyeshot 2026 or .NET 10 is missing, stop and tell Aris: the engine can only be built on his machine.

- [ ] **Step 2: Extend the attributes and `.gitignore`**

Run:
```bash
printf 'js/dwg/engine/** binary\n' >> .gitattributes
printf '\n# DWG quantities engine build output\n_src/dwg-engine/**/bin/\n_src/dwg-engine/**/obj/\n' >> .gitignore
```

- [ ] **Step 3: Check them**

Run: `git check-attr text -- js/dwg/engine/dotnet.js a.dwg && git check-ignore _src/dwg-engine/Engine/bin/x _src/dwg-engine/Tests/obj/y`
Expected: two lines ending `text: unset`, then both paths printed.

- [ ] **Step 4: Commit**

```bash
git add .gitattributes .gitignore
git commit -F - <<'EOF'
DWG quantities: byte-exact engine files, ignore engine build output

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 1: Engine projects and exact geometry

**Files:**
- Create: `_src/dwg-engine/nuget.config`, `_src/dwg-engine/Engine/Engine.csproj`, `_src/dwg-engine/Engine/Geo.cs`
- Create: `_src/dwg-engine/Tests/Tests.csproj`, `_src/dwg-engine/Tests/AssemblyInfo.cs`, `_src/dwg-engine/Tests/GeoTests.cs`

**Interfaces:**
- Produces (namespace `AidedCam.Dwg`):
  - `record struct V(double X, double Y)` with `+ - *`, `Length`, `static Cross(V, V)`.
  - `enum PieceKind { Line, Arc, Points }`.
  - `class Piece`: factories `Line(V a, V b)`, `Arc(V c, double r, double a0, double sweep)` (radians, counter-clockwise positive), `Points(List<V>, double exactLength = NaN)`, `Bulge(V a, V b, double bulge)`; members `Reversed()`, `Start`, `End`, `Length`, `AreaTerm`, `SampleInto(List<V>, double dev)`, `static ArcSteps(double r, double sweep, double dev)`.
  - `class Outline`: `Pieces`, `Closed`, `Length`, `SignedArea` (exact, counter-clockwise positive), `Sample(double dev)`, `Bounds(double dev)`.
  - `static class Geo`: `Area(IReadOnlyList<V>)`, `Inside(V, IReadOnlyList<V>)`, `SelfIntersects(IReadOnlyList<V>)` (grid-bucketed).
  - `struct Affine` (3 × 4): `Identity`, `Apply(x, y, z)`, `Then(outer)` (inner first), `MaxScale`, `FromBasis(o, ex, ey, ez)`, `Ocs(nx, ny, nz, elevation)` (AutoCAD's arbitrary-axis algorithm).

- [ ] **Step 1: Write the projects and the failing test**

<!-- file: _src/dwg-engine/nuget.config -->
```xml
<?xml version="1.0" encoding="utf-8"?>
<!-- Eyeshot 2026 comes from the local installation's NuGet folder; everything else from nuget.org. -->
<configuration>
  <packageSources>
    <clear />
    <add key="eyeshot-local" value="C:\Program Files\devDept\Eyeshot 2026\NuGet Packages" />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
  </packageSources>
</configuration>
```

<!-- file: _src/dwg-engine/Engine/Engine.csproj -->
```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>disable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <RootNamespace>AidedCam.Dwg</RootNamespace>
    <AssemblyName>AidedCam.Dwg.Engine</AssemblyName>
  </PropertyGroup>
  <ItemGroup>
    <!-- Eyeshot measures splines (exact NURBS length); ACadSharp, the library Eyeshot itself reads DWG with,
         reads the file: layers, blocks with their attributes, hatches (spec §3). -->
    <PackageReference Include="devDept.Eyeshot" Version="2026.2.284" />
    <PackageReference Include="ACadSharp" Version="3.3.23" />
  </ItemGroup>
</Project>
```

<!-- file: _src/dwg-engine/Tests/Tests.csproj -->
```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>disable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <IsPackable>false</IsPackable>
    <!-- The browser build runs in invariant globalization; the tests do too. -->
    <InvariantGlobalization>true</InvariantGlobalization>
    <RootNamespace>AidedCam.Dwg.Tests</RootNamespace>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.14.1" />
    <PackageReference Include="xunit" Version="2.9.3" />
    <PackageReference Include="xunit.runner.visualstudio" Version="3.1.4" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\Engine\Engine.csproj" />
  </ItemGroup>
</Project>
```

<!-- file: _src/dwg-engine/Tests/AssemblyInfo.cs -->
```csharp
// ACadSharp's writers (used to build fixtures) are not safe to run from parallel test classes,
// and the browser engine measures one file at a time anyway.
[assembly: Xunit.CollectionBehavior(DisableTestParallelization = true)]
```

<!-- file: _src/dwg-engine/Tests/GeoTests.cs -->
```csharp
using Xunit;

namespace AidedCam.Dwg.Tests;

public class GeoTests
{
    [Fact]
    public void A_bulge_of_one_is_a_counter_clockwise_half_circle()
    {
        var p = Piece.Bulge(new V(0, 0), new V(2, 0), 1);
        Assert.Equal(PieceKind.Arc, p.Kind);
        Assert.Equal(1, p.R, 12);
        Assert.Equal(Math.PI, p.Length, 12);
        Assert.Equal(1, p.C.X, 12); Assert.Equal(0, p.C.Y, 12);
        Assert.Equal(2, p.End.X, 12); Assert.Equal(0, p.End.Y, 12);
        var pts = new List<V>();
        p.SampleInto(pts, 1e-6);
        Assert.True(pts[pts.Count / 2].Y < 0, "from (0,0) to (2,0) counter-clockwise runs through (1, −1)");
    }

    [Fact]
    public void Greens_theorem_gives_exact_areas_for_lines_and_arcs()
    {
        var disc = new Outline { Closed = true };
        disc.Pieces.Add(Piece.Arc(new V(3, 4), 2, 0.3, 2 * Math.PI));
        Assert.Equal(4 * Math.PI, disc.SignedArea, 12);

        var slot = new Outline { Closed = true };                                                      // 4 × 2 with round ends of r 1
        slot.Pieces.Add(Piece.Line(new V(0, 0), new V(4, 0)));
        slot.Pieces.Add(Piece.Bulge(new V(4, 0), new V(4, 2), 1));
        slot.Pieces.Add(Piece.Line(new V(4, 2), new V(0, 2)));
        slot.Pieces.Add(Piece.Bulge(new V(0, 2), new V(0, 0), 1));
        Assert.Equal(8 + Math.PI, slot.SignedArea, 12);
        Assert.Equal(8 + 2 * Math.PI, slot.Length, 12);

        var clockwise = new Outline { Closed = true };
        foreach (var p in Enumerable.Reverse(slot.Pieces)) clockwise.Pieces.Add(p.Reversed());
        Assert.Equal(-(8 + Math.PI), clockwise.SignedArea, 12);
    }

    [Fact]
    public void Self_intersection_finds_crossings_and_touches_but_not_neighbours()
    {
        var square = new List<V> { new(0, 0), new(1, 0), new(1, 1), new(0, 1) };
        var bowtie = new List<V> { new(0, 0), new(1, 1), new(1, 0), new(0, 1) };
        var touching = new List<V> { new(0, 0), new(4, 0), new(4, 4), new(2, 0.0), new(0, 4) };        // a vertex on the bottom edge
        Assert.False(Geo.SelfIntersects(square));
        Assert.True(Geo.SelfIntersects(bowtie));
        Assert.True(Geo.SelfIntersects(touching));
        Assert.False(Geo.SelfIntersects(new List<V> { new(0, 0), new(1, 0), new(1, 1), new(0, 1), new(0, 0) }));   // closing point repeated
    }

    [Fact]
    public void The_arbitrary_axis_algorithm_mirrors_X_for_a_downward_normal()
    {
        var ocs = Affine.Ocs(0, 0, -1);
        var p = ocs.Apply(2, 3, 0);
        Assert.Equal(-2, p.X, 12); Assert.Equal(3, p.Y, 12);
        var up = Affine.Ocs(0, 0, 1, 5).Apply(2, 3, 0);
        Assert.Equal(2, up.X, 12); Assert.Equal(3, up.Y, 12); Assert.Equal(5, up.Z, 12);
    }

    [Fact]
    public void Affine_maps_compose_inner_first()
    {
        var scale = new Affine(new double[] { 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0 });
        var shift = new Affine(new double[] { 1, 0, 0, 10, 0, 1, 0, 0, 0, 0, 1, 0 });
        var p = scale.Then(shift).Apply(1, 1, 0);                                                      // scale, then shift
        Assert.Equal(12, p.X, 12); Assert.Equal(2, p.Y, 12);
        Assert.Equal(2, scale.Then(shift).MaxScale, 12);
    }
}
```


Run:
```bash
for f in _src/dwg-engine/nuget.config _src/dwg-engine/Engine/Engine.csproj _src/dwg-engine/Tests/Tests.csproj _src/dwg-engine/Tests/AssemblyInfo.cs _src/dwg-engine/Tests/GeoTests.cs; do node _tests/extract.mjs $PLAN $f; done
dotnet test _src/dwg-engine/Tests 2>&1 | grep -E "error CS" | head -3
```
Expected: compile errors `CS0246` (`Piece`, `V`, `Outline`, `Geo`, `Affine` not found). The first restore downloads the test packages.

- [ ] **Step 2: Write the geometry**

<!-- file: _src/dwg-engine/Engine/Geo.cs -->
```csharp
namespace AidedCam.Dwg;

public readonly record struct V(double X, double Y)
{
    public static V operator +(V a, V b) => new(a.X + b.X, a.Y + b.Y);
    public static V operator -(V a, V b) => new(a.X - b.X, a.Y - b.Y);
    public static V operator *(V a, double k) => new(a.X * k, a.Y * k);
    public double Length => Math.Sqrt(X * X + Y * Y);
    public static double Cross(V a, V b) => a.X * b.Y - a.Y * b.X;
}

public enum PieceKind { Line, Arc, Points }

// One piece of a planar outline, in the outline's own plane coordinates: a line, an arc (start angle A0 and a
// signed sweep, counter-clockwise positive, both in radians) or sampled points (splines and ellipses, whose
// exact length is measured separately and kept in ExactLength).
public sealed class Piece
{
    public PieceKind Kind;
    public V A, B;                      // line ends
    public V C; public double R, A0, Sweep;
    public List<V> Pts;
    public double ExactLength = double.NaN;

    public static Piece Line(V a, V b) => new() { Kind = PieceKind.Line, A = a, B = b };
    public static Piece Arc(V c, double r, double a0, double sweep) => new() { Kind = PieceKind.Arc, C = c, R = r, A0 = a0, Sweep = sweep };
    public static Piece Points(List<V> pts, double exactLength = double.NaN) => new() { Kind = PieceKind.Points, Pts = pts, ExactLength = exactLength };

    // The arc from a to b with the given polyline bulge (tan of a quarter of the sweep; positive = counter-clockwise).
    public static Piece Bulge(V a, V b, double bulge)
    {
        if (Math.Abs(bulge) < 1e-12) return Line(a, b);
        double sweep = 4 * Math.Atan(bulge);
        V d = b - a;
        double chord = d.Length;
        if (chord < 1e-15) return Line(a, b);
        double h = chord / 2 / Math.Tan(sweep / 2);                      // signed distance from the chord's middle to the centre
        V mid = (a + b) * 0.5, left = new(-d.Y / chord, d.X / chord);
        V c = mid + left * h;
        return Arc(c, (a - c).Length, Math.Atan2(a.Y - c.Y, a.X - c.X), sweep);
    }

    public Piece Reversed() => Kind switch
    {
        PieceKind.Line => Line(B, A),
        PieceKind.Arc => Arc(C, R, A0 + Sweep, -Sweep),
        _ => Points(Enumerable.Reverse(Pts).ToList(), ExactLength),
    };

    public V Start => Kind switch
    {
        PieceKind.Line => A,
        PieceKind.Arc => new(C.X + R * Math.Cos(A0), C.Y + R * Math.Sin(A0)),
        _ => Pts[0],
    };

    public V End => Kind switch
    {
        PieceKind.Line => B,
        PieceKind.Arc => new(C.X + R * Math.Cos(A0 + Sweep), C.Y + R * Math.Sin(A0 + Sweep)),
        _ => Pts[^1],
    };

    public double Length
    {
        get
        {
            switch (Kind)
            {
                case PieceKind.Line: return (B - A).Length;
                case PieceKind.Arc: return R * Math.Abs(Sweep);
                default:
                    if (!double.IsNaN(ExactLength)) return ExactLength;
                    double s = 0;
                    for (int i = 1; i < Pts.Count; i++) s += (Pts[i] - Pts[i - 1]).Length;
                    return s;
            }
        }
    }

    // This piece's share of Green's theorem, ½∮(x dy − y dx): summed over a closed outline it is the exact
    // signed area (counter-clockwise positive).
    public double AreaTerm
    {
        get
        {
            switch (Kind)
            {
                case PieceKind.Line: return V.Cross(A, B) / 2;
                case PieceKind.Arc:
                    double a1 = A0 + Sweep;
                    return (R * C.X * (Math.Sin(a1) - Math.Sin(A0)) - R * C.Y * (Math.Cos(a1) - Math.Cos(A0)) + R * R * Sweep) / 2;
                default:
                    double s = 0;
                    for (int i = 1; i < Pts.Count; i++) s += V.Cross(Pts[i - 1], Pts[i]) / 2;
                    return s;
            }
        }
    }

    // Appends this piece's points to a polyline, without repeating the first point when the polyline already
    // ends there. dev is the largest allowed distance between an arc and its chords.
    public void SampleInto(List<V> into, double dev)
    {
        switch (Kind)
        {
            case PieceKind.Line:
                AddPoint(into, A); into.Add(B);
                return;
            case PieceKind.Arc:
                int n = ArcSteps(R, Sweep, dev);
                AddPoint(into, Start);
                for (int i = 1; i <= n; i++)
                {
                    double t = A0 + Sweep * i / n;
                    into.Add(new V(C.X + R * Math.Cos(t), C.Y + R * Math.Sin(t)));
                }
                return;
            default:
                AddPoint(into, Pts[0]);
                for (int i = 1; i < Pts.Count; i++) into.Add(Pts[i]);
                return;
        }
    }

    static void AddPoint(List<V> into, V p)
    {
        if (into.Count == 0 || (into[^1] - p).Length > 1e-12) into.Add(p);
    }

    public static int ArcSteps(double r, double sweep, double dev)
    {
        if (r <= 0 || dev <= 0) return 2;
        double c = 1 - dev / r;
        double step = c <= -1 ? Math.PI : 2 * Math.Acos(c);
        return Math.Clamp((int)Math.Ceiling(Math.Abs(sweep) / Math.Max(step, 1e-9)), 2, 1024);
    }
}

// A planar outline: connected pieces in order. Measured in its own plane, so tilted entities keep their
// true length and area; drawn by sampling and mapping each point to model space.
public sealed class Outline
{
    public readonly List<Piece> Pieces = new();
    public bool Closed;

    public double Length { get { double s = 0; foreach (var p in Pieces) s += p.Length; return s; } }

    // Exact signed area of a closed outline; 0 for an open one.
    public double SignedArea
    {
        get
        {
            if (!Closed || Pieces.Count == 0) return 0;
            double s = 0;
            foreach (var p in Pieces) s += p.AreaTerm;
            var gap = Pieces[^1].End - Pieces[0].Start;                       // a points outline closes back to its start
            if (gap.Length > 0) s += V.Cross(Pieces[^1].End, Pieces[0].Start) / 2;
            return s;
        }
    }

    public List<V> Sample(double dev)
    {
        var pts = new List<V>();
        foreach (var p in Pieces) p.SampleInto(pts, dev);
        if (Closed && pts.Count > 1 && (pts[^1] - pts[0]).Length > 1e-12) pts.Add(pts[0]);
        return pts;
    }

    public (V Min, V Max) Bounds(double dev)
    {
        var pts = Sample(dev);
        double x0 = double.MaxValue, y0 = double.MaxValue, x1 = double.MinValue, y1 = double.MinValue;
        foreach (var p in pts) { x0 = Math.Min(x0, p.X); y0 = Math.Min(y0, p.Y); x1 = Math.Max(x1, p.X); y1 = Math.Max(y1, p.Y); }
        return (new V(x0, y0), new V(x1, y1));
    }
}

public static class Geo
{
    // Signed area of a closed polygon given as points (the last point may repeat the first).
    public static double Area(IReadOnlyList<V> pts)
    {
        double s = 0;
        for (int i = 0; i < pts.Count; i++) s += V.Cross(pts[i], pts[(i + 1) % pts.Count]);
        return s / 2;
    }

    // Even-odd point-in-polygon.
    public static bool Inside(V p, IReadOnlyList<V> poly)
    {
        bool inside = false;
        for (int i = 0, j = poly.Count - 1; i < poly.Count; j = i++)
        {
            V a = poly[i], b = poly[j];
            if ((a.Y > p.Y) != (b.Y > p.Y) && p.X < (b.X - a.X) * (p.Y - a.Y) / (b.Y - a.Y) + a.X) inside = !inside;
        }
        return inside;
    }

    // True when two non-adjacent edges of a closed ring cross or touch. The ring's last point may repeat the
    // first. Edges are bucketed on a grid, so a ring of thousands of points stays near-linear.
    public static bool SelfIntersects(IReadOnlyList<V> ring)
    {
        var pts = new List<V>(ring);
        if (pts.Count > 1 && (pts[^1] - pts[0]).Length < 1e-12) pts.RemoveAt(pts.Count - 1);
        int n = pts.Count;
        if (n < 4) return false;
        double x0 = double.MaxValue, y0 = double.MaxValue, x1 = double.MinValue, y1 = double.MinValue;
        foreach (var p in pts) { x0 = Math.Min(x0, p.X); y0 = Math.Min(y0, p.Y); x1 = Math.Max(x1, p.X); y1 = Math.Max(y1, p.Y); }
        double size = Math.Max(x1 - x0, y1 - y0);
        if (size <= 0) return false;
        double eps = size * 1e-9;
        int cells = Math.Clamp((int)Math.Sqrt(n), 1, 256);
        double cw = (x1 - x0) / cells + eps, ch = (y1 - y0) / cells + eps;
        var grid = new Dictionary<int, List<int>>();
        for (int i = 0; i < n; i++)
        {
            V a = pts[i], b = pts[(i + 1) % n];
            int cx0 = (int)((Math.Min(a.X, b.X) - x0) / cw), cx1 = (int)((Math.Max(a.X, b.X) - x0) / cw);
            int cy0 = (int)((Math.Min(a.Y, b.Y) - y0) / ch), cy1 = (int)((Math.Max(a.Y, b.Y) - y0) / ch);
            for (int gx = cx0; gx <= cx1; gx++)
                for (int gy = cy0; gy <= cy1; gy++)
                {
                    int key = gx * 1024 + gy;
                    if (!grid.TryGetValue(key, out var list)) grid[key] = list = new List<int>();
                    foreach (int j in list)
                    {
                        if (Math.Abs(i - j) <= 1 || (i == 0 && j == n - 1) || (j == 0 && i == n - 1)) continue;
                        if (Cross(a, b, pts[j], pts[(j + 1) % n], eps)) return true;
                    }
                    list.Add(i);
                }
        }
        return false;
    }

    static bool Cross(V p1, V p2, V q1, V q2, double eps)
    {
        double d1 = V.Cross(p2 - p1, q1 - p1), d2 = V.Cross(p2 - p1, q2 - p1);
        double d3 = V.Cross(q2 - q1, p1 - q1), d4 = V.Cross(q2 - q1, p2 - q1);
        double l1 = (p2 - p1).Length, l2 = (q2 - q1).Length;
        double t1 = eps * l1, t2 = eps * l2;
        if (((d1 > t1 && d2 < -t1) || (d1 < -t1 && d2 > t1)) && ((d3 > t2 && d4 < -t2) || (d3 < -t2 && d4 > t2))) return true;
        // An end point lying on the other edge counts as touching.
        return OnSeg(q1, p1, p2, d1, t1) || OnSeg(q2, p1, p2, d2, t1) || OnSeg(p1, q1, q2, d3, t2) || OnSeg(p2, q1, q2, d4, t2);
    }

    static bool OnSeg(V p, V a, V b, double cross, double tol)
    {
        if (Math.Abs(cross) > tol) return false;
        double dot = (p.X - a.X) * (b.X - a.X) + (p.Y - a.Y) * (b.Y - a.Y), len2 = (b.X - a.X) * (b.X - a.X) + (b.Y - a.Y) * (b.Y - a.Y);
        return dot > len2 * 1e-9 && dot < len2 * (1 - 1e-9);
    }
}

// A 3D affine map (3 × 4, row-major): plane coordinates → model space, block space → model space.
public readonly struct Affine
{
    readonly double[] m;
    public Affine(double[] m) { this.m = m; }
    public static readonly Affine Identity = new(new double[] { 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0 });

    public (double X, double Y, double Z) Apply(double x, double y, double z) =>
        (m[0] * x + m[1] * y + m[2] * z + m[3], m[4] * x + m[5] * y + m[6] * z + m[7], m[8] * x + m[9] * y + m[10] * z + m[11]);

    // this ∘ other: apply other first.
    public Affine Then(Affine outer)
    {
        var a = outer.m; var b = m; var r = new double[12];
        for (int i = 0; i < 3; i++)
        {
            for (int j = 0; j < 3; j++) r[i * 4 + j] = a[i * 4] * b[j] + a[i * 4 + 1] * b[4 + j] + a[i * 4 + 2] * b[8 + j];
            r[i * 4 + 3] = a[i * 4] * b[3] + a[i * 4 + 1] * b[7] + a[i * 4 + 2] * b[11] + a[i * 4 + 3];
        }
        return new Affine(r);
    }

    // Largest factor by which the map stretches a length (for choosing a sampling tolerance in block space).
    public double MaxScale => Math.Max(Math.Sqrt(m[0] * m[0] + m[4] * m[4] + m[8] * m[8]), Math.Max(Math.Sqrt(m[1] * m[1] + m[5] * m[5] + m[9] * m[9]), Math.Sqrt(m[2] * m[2] + m[6] * m[6] + m[10] * m[10])));

    // From a map given by where it sends the origin and the three unit axes.
    public static Affine FromBasis((double X, double Y, double Z) o, (double X, double Y, double Z) ex, (double X, double Y, double Z) ey, (double X, double Y, double Z) ez) =>
        new(new[] { ex.X - o.X, ey.X - o.X, ez.X - o.X, o.X, ex.Y - o.Y, ey.Y - o.Y, ez.Y - o.Y, o.Y, ex.Z - o.Z, ey.Z - o.Z, ez.Z - o.Z, o.Z });

    // AutoCAD's arbitrary-axis algorithm: the object coordinate system of an entity with the given normal.
    public static Affine Ocs(double nx, double ny, double nz, double elevation = 0)
    {
        double len = Math.Sqrt(nx * nx + ny * ny + nz * nz);
        if (len < 1e-12) { nx = 0; ny = 0; nz = 1; len = 1; }
        nx /= len; ny /= len; nz /= len;
        double ax, ay, az;
        if (Math.Abs(nx) < 1.0 / 64 && Math.Abs(ny) < 1.0 / 64) { ax = nz; ay = 0; az = -nx; }       // Wy × N
        else { ax = -ny; ay = nx; az = 0; }                                                          // Wz × N
        double al = Math.Sqrt(ax * ax + ay * ay + az * az);
        ax /= al; ay /= al; az /= al;
        double bx = ny * az - nz * ay, by = nz * ax - nx * az, bz = nx * ay - ny * ax;               // N × Ax
        return new(new[] { ax, bx, nx, nx * elevation, ay, by, ny, ny * elevation, az, bz, nz, nz * elevation });
    }
}
```


Run: `node _tests/extract.mjs $PLAN _src/dwg-engine/Engine/Geo.cs`

- [ ] **Step 3: Run the tests**

Run: `dotnet test _src/dwg-engine/Tests 2>&1 | tail -1`
Expected: `Passed!  - Failed:     0, Passed:     5, …`.

- [ ] **Step 4: Commit**

```bash
git add _src/dwg-engine
git commit -F - <<'EOF'
DWG quantities: engine projects and exact geometry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 2: Reading and measuring

The whole measurement of one file (spec §4): model space only, every layer, results in metres. It is one task because the pipeline (`Quantities.Run`) needs every part to run at all; the four test files review separately.

**Files:**
- Create: `_src/dwg-engine/Engine/Model.cs`, `Reader.cs`, `Measure.cs`, `Hatches.cs`, `Blocks.cs`, `Quantities.cs`, `ResultJson.cs`
- Create: `_src/dwg-engine/Tests/Cad.cs`, `MeasureTests.cs`, `HatchTests.cs`, `BlockTests.cs`, `FileTests.cs`

**Interfaces:**
- Consumes: Task 1's geometry.
- Produces:
  - `Quantities.Run(byte[] bytes, Settings settings) → Result` (throws `DwgFileException(reason, message)` with reason `read`, `version`, `limit` or `empty`).
  - `ResultJson.Run(byte[] bytes, string name, Settings settings) → string` (never throws; the host's one call), `ResultJson.Write(name, Result)`, `ResultJson.Error(name, reason, message)`.
  - `Settings { Units = "auto" | "mm" | "cm" | "m" | "inch" | "ft", Override = "" | same units }`.
  - `Result`: `Format`, `Version`, `Units`, `UnitsSource` (`file`/`setting`/`assumed`/`override`), `Layers` (`LayerTotal`), `Blocks` (`BlockCount`), `Schedules`, `Items`, `Xrefs`, `NotMeasured`, `Warnings`, `X0 Y0 X1 Y1`, `Simplified`.
  - `Limits.MaxBytes` (30 MB), `MaxEntities` (300,000), `MaxPathPoints` (1,000,000).
  - Test helper `Cad`: `Doc(units, version)`, `Layer(doc, name, aci)`, `.On(doc, layer)`, `Line`, `Poly(closed, (x, y, bulge)…)`, `Rect`, `Bytes(doc, dwg)`, `Run(doc, dwg, units)`, `result.Layer(name)`.
  - Warning ids: `units-assumed`, `units-setting {units}`, `units-override {units, file}`, `xrefs {count}`, `bad-area {count}`, `inside-blocks {count}`, `not-measured {count}`, `simplified`.

- [ ] **Step 1: Write the failing tests**

<!-- file: _src/dwg-engine/Tests/Cad.cs -->
```csharp
using ACadSharp;
using ACadSharp.Entities;
using ACadSharp.Tables;
using ACadSharp.Types.Units;
using CSMath;

namespace AidedCam.Dwg.Tests;

// Synthetic drawings for the tests, written with ACadSharp (the library the engine reads with), so every
// expected number is known exactly.
public static class Cad
{
    public static CadDocument Doc(UnitsType units = UnitsType.Millimeters, ACadVersion version = ACadVersion.AC1032)
    {
        var doc = new CadDocument(version);
        doc.Header.InsUnits = units;
        return doc;
    }

    public static Layer Layer(CadDocument doc, string name, short aci = 7)
    {
        if (doc.Layers.TryGetValue(name, out Layer l)) return l;
        l = new Layer(name) { Color = new Color(aci) };
        doc.Layers.Add(l);
        return l;
    }

    public static T On<T>(this T e, CadDocument doc, string layer) where T : Entity { e.Layer = Layer(doc, layer); return e; }

    public static Line Line(double x0, double y0, double x1, double y1) => new() { StartPoint = new XYZ(x0, y0, 0), EndPoint = new XYZ(x1, y1, 0) };

    public static LwPolyline Poly(bool closed, params (double X, double Y, double Bulge)[] v)
    {
        var p = new LwPolyline { IsClosed = closed };
        foreach (var (x, y, b) in v) p.Vertices.Add(new LwPolyline.Vertex(new XY(x, y)) { Bulge = b });
        return p;
    }

    public static LwPolyline Rect(double x, double y, double w, double h) => Poly(true, (x, y, 0), (x + w, y, 0), (x + w, y + h, 0), (x, y + h, 0));

    public static byte[] Bytes(CadDocument doc, bool dwg)
    {
        var ms = new MemoryStream();
        if (dwg) { using var w = new ACadSharp.IO.DwgWriter(ms, doc); w.Write(); }
        else { using var w = new ACadSharp.IO.DxfWriter(ms, doc, false); w.Write(); }
        return ms.ToArray();
    }

    public static Result Run(CadDocument doc, bool dwg = true, string units = "auto") =>
        Quantities.Run(Bytes(doc, dwg), new Settings { Units = units });

    public static LayerTotal Layer(this Result r, string name) => r.Layers.Single(l => l.Name == name);
}
```

<!-- file: _src/dwg-engine/Tests/MeasureTests.cs -->
```csharp
using ACadSharp.Entities;
using ACadSharp.Types.Units;
using CSMath;
using Xunit;

namespace AidedCam.Dwg.Tests;

public class MeasureTests
{
    [Fact]
    public void Lines_arcs_and_bulged_polylines_are_totalled_per_layer_in_metres()
    {
        var doc = Cad.Doc(UnitsType.Millimeters);
        doc.Entities.Add(Cad.Line(0, 0, 3000, 4000).On(doc, "PIPE"));                                  // 5 m
        doc.Entities.Add(new Arc { Center = new XYZ(0, 0, 0), Radius = 1000, StartAngle = 0, EndAngle = Math.PI / 2 }.On(doc, "PIPE"));   // π/2 m
        doc.Entities.Add(Cad.Poly(false, (0, 0, 0), (2000, 0, 1), (2000, 2000, 0)).On(doc, "DUCT"));   // a half circle of Ø2 m, then 2 m straight
        var r = Cad.Run(doc);
        Assert.Equal(5 + Math.PI / 2, r.Layer("PIPE").Len, 9);
        Assert.Equal(2, r.Layer("PIPE").LenCount);
        Assert.Equal(Math.PI + 2, r.Layer("DUCT").Len, 9);
        Assert.Equal(0, r.Layer("DUCT").AreaCount);                                                     // open: no area
    }

    [Fact]
    public void Closed_outlines_have_exact_areas_and_a_bulged_slot_counts_its_round_ends()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        doc.Entities.Add(Cad.Rect(0, 0, 4, 3).On(doc, "ROOMS"));                                        // 12 m²
        doc.Entities.Add(new Circle { Center = new XYZ(10, 0, 0), Radius = 1 }.On(doc, "ROOMS"));     // π m²
        doc.Entities.Add(Cad.Poly(true, (0, 10, 0), (4, 10, 1), (4, 12, 0), (0, 12, 1)).On(doc, "SLOT")); // 4 × 2 plus two half discs of r 1
        var r = Cad.Run(doc);
        Assert.Equal(12 + Math.PI, r.Layer("ROOMS").Area, 9);
        Assert.Equal(2, r.Layer("ROOMS").AreaCount);
        Assert.Equal(14 + 2 * Math.PI, r.Layer("ROOMS").Len, 9);
        Assert.Equal(8 + Math.PI, r.Layer("SLOT").Area, 9);
        Assert.Equal(8 + 2 * Math.PI, r.Layer("SLOT").Len, 9);
    }

    [Fact]
    public void A_polyline_that_returns_to_its_start_is_closed_without_the_flag()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        doc.Entities.Add(Cad.Poly(false, (0, 0, 0), (2, 0, 0), (2, 2, 0), (0, 2, 0), (0, 0, 0)).On(doc, "A"));
        Assert.Equal(4, Cad.Run(doc).Layer("A").Area, 9);
    }

    [Fact]
    public void A_self_intersecting_outline_keeps_its_length_but_its_area_is_bad_and_left_out()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        doc.Entities.Add(Cad.Poly(true, (0, 0, 0), (2, 2, 0), (2, 0, 0), (0, 2, 0)).On(doc, "A"));   // a bow tie
        doc.Entities.Add(Cad.Rect(10, 0, 1, 1).On(doc, "A"));
        var r = Cad.Run(doc);
        Assert.Equal(1, r.Layer("A").Area, 9);
        Assert.Equal(1, r.Layer("A").AreaCount);
        Assert.Equal(1, r.Layer("A").Bad);
        Assert.Equal(4 + 2 * Math.Sqrt(8) + 4, r.Layer("A").Len, 9);                                  // two sides and two diagonals, and the square
        Assert.Contains(r.Warnings, w => w.Id == "bad-area");
        Assert.True(r.Items.Single(i => i.Bad).Area == 0);
    }

    [Fact]
    public void A_rational_spline_quarter_circle_is_measured_exactly()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        var sp = new Spline { Degree = 2 };
        foreach (var p in new[] { new XYZ(10, 0, 0), new XYZ(10, 10, 0), new XYZ(0, 10, 0) }) sp.ControlPoints.Add(p);
        foreach (var w in new[] { 1, Math.Sqrt(0.5), 1 }) sp.Weights.Add(w);
        foreach (var k in new[] { 0.0, 0, 0, 1, 1, 1 }) sp.Knots.Add(k);
        sp.Flags |= SplineFlags.Rational;
        doc.Entities.Add(sp.On(doc, "S"));
        var r = Cad.Run(doc);
        Assert.Equal(5 * Math.PI, r.Layer("S").Len, 9);
        Assert.Equal("spline", r.Items.Single().Kind);
    }

    [Fact]
    public void A_full_ellipse_has_its_true_perimeter_and_area()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        doc.Entities.Add(new Ellipse { Center = new XYZ(0, 0, 0), MajorAxisEndPoint = new XYZ(4, 0, 0), RadiusRatio = 0.5, StartParameter = 0, EndParameter = 2 * Math.PI }.On(doc, "E"));
        var r = Cad.Run(doc);
        // Reference perimeter of a = 4, b = 2 from a million-chord polygon: 19.376896441095…
        double reference = 0; double px = 4, py = 0;
        for (int i = 1; i <= 1_000_000; i++) { double t = 2 * Math.PI * i / 1_000_000; double x = 4 * Math.Cos(t), y = 2 * Math.Sin(t); reference += Math.Sqrt((x - px) * (x - px) + (y - py) * (y - py)); px = x; py = y; }
        Assert.True(Math.Abs(r.Layer("E").Len / reference - 1) < 1e-4, $"{r.Layer("E").Len} vs {reference}");
        Assert.Equal(8 * Math.PI, r.Layer("E").Area, 9);
    }

    [Fact]
    public void A_mirrored_arc_keeps_its_length_and_is_drawn_mirrored()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        // Normal −Z: the object coordinate system's X points the other way, so centre (5, 0) lies at (−5, 0).
        doc.Entities.Add(new Arc { Center = new XYZ(5, 0, 0), Radius = 1, StartAngle = 0, EndAngle = Math.PI, Normal = new XYZ(0, 0, -1) }.On(doc, "M"));
        var r = Cad.Run(doc);
        Assert.Equal(Math.PI, r.Layer("M").Len, 9);
        var path = r.Items.Single().Path.Single();
        Assert.Equal(-6, path[0], 6); Assert.Equal(0, path[1], 6);                                     // starts at angle 0 → (−6, 0)
        Assert.All(Enumerable.Range(0, path.Length / 2), i => Assert.InRange(path[2 * i], -6.0001, -3.9999));
    }

    [Fact]
    public void A_3D_polyline_has_its_true_length_and_no_area()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        var p = new Polyline3D();
        p.Vertices.Add(new Vertex3D(new XYZ(0, 0, 0))); p.Vertices.Add(new Vertex3D(new XYZ(3, 0, 4))); p.Vertices.Add(new Vertex3D(new XYZ(3, 5, 4)));
        doc.Entities.Add(p.On(doc, "P"));
        var r = Cad.Run(doc);
        Assert.Equal(10, r.Layer("P").Len, 9);
        Assert.Equal(0, r.Layer("P").AreaCount);
    }
}
```

<!-- file: _src/dwg-engine/Tests/HatchTests.cs -->
```csharp
using ACadSharp.Entities;
using ACadSharp.Types.Units;
using CSMath;
using Xunit;

namespace AidedCam.Dwg.Tests;

public class HatchTests
{
    static Hatch.BoundaryPath Square(double x, double y, double s, bool outer)
    {
        var p = new Hatch.BoundaryPath { Flags = BoundaryPathFlags.Polyline | (outer ? BoundaryPathFlags.External : BoundaryPathFlags.Default) };
        p.Edges.Add(new Hatch.BoundaryPath.Polyline { IsClosed = true, Vertices = { new XYZ(x, y, 0), new XYZ(x + s, y, 0), new XYZ(x + s, y + s, 0), new XYZ(x, y + s, 0) } });
        return p;
    }

    static Hatch Hatch(HatchStyleType style, params Hatch.BoundaryPath[] paths)
    {
        var h = new Hatch { IsSolid = true, Style = style, Pattern = new HatchPattern("SOLID") };
        foreach (var p in paths) h.Paths.Add(p);
        return h;
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void An_island_is_subtracted_and_hatch_area_stays_out_of_the_polyline_areas(bool dwg)
    {
        var doc = Cad.Doc(UnitsType.Meters);
        doc.Entities.Add(Hatch(HatchStyleType.Normal, Square(0, 0, 10, true), Square(4, 4, 2, false)).On(doc, "FLOOR"));
        doc.Entities.Add(Cad.Rect(0, 0, 10, 10).On(doc, "FLOOR"));                                     // the room outlined too
        var r = Cad.Run(doc, dwg);
        Assert.Equal(96, r.Layer("FLOOR").HatchArea, 9);
        Assert.Equal(1, r.Layer("FLOOR").HatchCount);
        Assert.Equal(100, r.Layer("FLOOR").Area, 9);                                                   // never added together
        Assert.Equal(2, r.Items.Single(i => i.Kind == "hatch").Path.Count);
    }

    [Fact]
    public void Nested_islands_follow_the_hatch_style()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        var loops = new[] { Square(0, 0, 10, true), Square(2, 2, 6, false), Square(4, 4, 2, false) };   // 100, 36, 4
        doc.Entities.Add(Hatch(HatchStyleType.Normal, loops).On(doc, "N"));
        doc.Entities.Add(Hatch(HatchStyleType.Outer, Square(0, 0, 10, true), Square(2, 2, 6, false), Square(4, 4, 2, false)).On(doc, "O"));
        doc.Entities.Add(Hatch(HatchStyleType.Ignore, Square(0, 0, 10, true), Square(2, 2, 6, false), Square(4, 4, 2, false)).On(doc, "I"));
        var r = Cad.Run(doc);
        Assert.Equal(100 - 36 + 4, r.Layer("N").HatchArea, 9);
        Assert.Equal(100 - 36, r.Layer("O").HatchArea, 9);
        Assert.Equal(100, r.Layer("I").HatchArea, 9);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void A_boundary_of_line_and_arc_edges_is_exact_whichever_way_the_arc_turns(bool ccw)
    {
        // A half disc of radius 5: the arc from (5, 0) over the top to (−5, 0), then the diameter back.
        var doc = Cad.Doc(UnitsType.Meters);
        var p = new Hatch.BoundaryPath { Flags = BoundaryPathFlags.External };
        if (ccw) p.Edges.Add(new Hatch.BoundaryPath.Arc { Center = new XY(0, 0), Radius = 5, StartAngle = 0, EndAngle = Math.PI, CounterClockWise = true });
        else p.Edges.Add(new Hatch.BoundaryPath.Arc { Center = new XY(0, 0), Radius = 5, StartAngle = Math.PI, EndAngle = 2 * Math.PI, CounterClockWise = false });   // stored mirrored: −π … −2π clockwise is the same top half
        p.Edges.Add(new Hatch.BoundaryPath.Line { Start = new XY(-5, 0), End = new XY(5, 0) });
        doc.Entities.Add(Hatch(HatchStyleType.Normal, p).On(doc, "H"));
        var r = Cad.Run(doc);
        Assert.Equal(12.5 * Math.PI, r.Layer("H").HatchArea, 9);
        Assert.True(r.Items.Single().Path.Single().Where((v, i) => i % 2 == 1).All(y => y >= -1e-6));   // the top half
    }

    [Fact]
    public void A_hatch_without_a_usable_boundary_is_bad_not_zero()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        doc.Entities.Add(Hatch(HatchStyleType.Normal).On(doc, "H"));
        doc.Entities.Add(Hatch(HatchStyleType.Normal, Square(0, 0, 1, true)).On(doc, "H"));
        var r = Cad.Run(doc);
        Assert.Equal(1, r.Layer("H").HatchArea, 9);
        Assert.Equal(1, r.Layer("H").HatchCount);
        Assert.Equal(1, r.Layer("H").Bad);
    }
}
```

<!-- file: _src/dwg-engine/Tests/BlockTests.cs -->
```csharp
using ACadSharp;
using ACadSharp.Entities;
using ACadSharp.Tables;
using ACadSharp.Types.Units;
using ACadSharp.XData;
using CSMath;
using Xunit;

namespace AidedCam.Dwg.Tests;

public class BlockTests
{
    static BlockRecord Block(CadDocument doc, string name, params Entity[] entities)
    {
        var b = new BlockRecord(name);
        foreach (var e in entities) b.Entities.Add(e);
        doc.BlockRecords.Add(b);
        return b;
    }

    static Insert Place(BlockRecord b, double x, double y, CadDocument doc, string layer)
    {
        var i = new Insert(b) { InsertPoint = new XYZ(x, y, 0) };
        return i.On(doc, layer);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void Inserts_are_counted_per_name_and_layer_and_their_geometry_is_not_added_to_layer_lengths(bool dwg)
    {
        var doc = Cad.Doc(UnitsType.Meters);
        var valve = Block(doc, "VALVE", Cad.Line(-0.1, 0, 0.1, 0), new Circle { Center = new XYZ(0, 0, 0), Radius = 0.05 });
        doc.Entities.Add(Cad.Line(0, 0, 10, 0).On(doc, "PIPE"));
        doc.Entities.Add(Place(valve, 2, 0, doc, "PIPE"));
        doc.Entities.Add(Place(valve, 6, 0, doc, "PIPE"));
        doc.Entities.Add(Place(valve, 0, 5, doc, "SPARE"));
        var r = Cad.Run(doc, dwg);
        Assert.Equal(10, r.Layer("PIPE").Len, 9);                                                      // the pipe only
        Assert.Equal(2, r.Blocks.Single(b => b.Name == "VALVE" && b.Layer == "PIPE").Count);
        Assert.Equal(1, r.Blocks.Single(b => b.Name == "VALVE" && b.Layer == "SPARE").Count);
        Assert.Equal(6, r.NotMeasured.InsideBlocks);                                                   // 2 curves × 3 inserts
        Assert.Contains(r.Warnings, w => w.Id == "inside-blocks");
        var item = r.Items.First(i => i.Kind == "insert");
        Assert.Equal("VALVE", item.Block);
        Assert.Equal(2, item.Path.Count);                                                              // drawn from the block's line and circle
        Assert.Equal(1.9, item.Path[0][0], 6);                                                         // placed at x = 2
    }

    [Fact]
    public void An_arrayed_insert_counts_rows_times_columns_and_draws_every_copy()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        var lamp = Block(doc, "LAMP", new Circle { Center = new XYZ(0, 0, 0), Radius = 0.1 });
        doc.Entities.Add(new Insert(lamp) { InsertPoint = new XYZ(0, 0, 0), RowCount = 2, ColumnCount = 3, RowSpacing = 2, ColumnSpacing = 3 }.On(doc, "LIGHT"));
        var r = Cad.Run(doc);
        Assert.Equal(6, r.Blocks.Single().Count);
        Assert.Equal(6, r.Items.Single().Copies);
        Assert.Equal(6, r.Items.Single().Path.Count);
        Assert.Equal(6.1, r.X1, 4);                                                                     // the far column at x = 6
    }

    [Fact]
    public void Nested_inserts_are_counted_through_their_placements_and_take_the_parents_layer_from_layer_0()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        var wc = Block(doc, "WC", Cad.Rect(0, 0, 0.4, 0.6));
        var bath = Block(doc, "BATHROOM", Cad.Rect(0, 0, 2, 3), new Insert(wc) { InsertPoint = new XYZ(0.2, 0.2, 0) }, new Insert(wc) { InsertPoint = new XYZ(1.2, 0.2, 0) });
        for (int i = 0; i < 3; i++) doc.Entities.Add(Place(bath, i * 5, 0, doc, "SANITARY"));
        var r = Cad.Run(doc);
        Assert.Equal(3, r.Blocks.Single(b => b.Name == "BATHROOM").Count);
        var nested = r.Blocks.Single(b => b.Name == "WC");
        Assert.Equal(0, nested.Count);
        Assert.Equal(6, nested.Nested);
        Assert.Equal("SANITARY", nested.Layer);
        Assert.Equal(3 * (1 + 2), r.NotMeasured.InsideBlocks);
        Assert.Equal(3, r.Items[0].Path.Count);                                                        // the room and its two WCs
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void A_dynamic_blocks_anonymous_copy_is_counted_under_the_name_users_see(bool dwg)
    {
        var doc = Cad.Doc(UnitsType.Meters);
        var window = Block(doc, "WINDOW", Cad.Line(0, 0, 1, 0));
        var copy = Block(doc, "*U12", Cad.Line(0, 0, 1.2, 0));
        var app = new AppId("AcDbBlockRepBTag");
        doc.AppIds.Add(app);
        copy.ExtendedData.Add(app, new ExtendedData(new List<ExtendedDataRecord> { new ExtendedDataInteger16(1), new ExtendedDataHandle(window.Handle) }));
        doc.Entities.Add(Place(window, 0, 0, doc, "WINDOWS"));
        doc.Entities.Add(Place(copy, 5, 0, doc, "WINDOWS"));
        var r = Cad.Run(doc, dwg);
        Assert.Equal(2, r.Blocks.Single().Count);
        Assert.Equal("WINDOW", r.Blocks.Single().Name);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void Attributes_become_a_schedule_with_identical_rows_collapsed(bool dwg)
    {
        var doc = Cad.Doc(UnitsType.Meters);
        var window = Block(doc, "WINDOW", Cad.Rect(0, 0, 1, 0.2));
        void Add(double x, string type, string w, string h)
        {
            var i = Place(window, x, 0, doc, "WINDOWS");
            i.Attributes.Add(new AttributeEntity { Tag = "TYPE", Value = type });
            i.Attributes.Add(new AttributeEntity { Tag = "W", Value = w });
            i.Attributes.Add(new AttributeEntity { Tag = "H", Value = h });
            doc.Entities.Add(i);
        }
        for (int k = 0; k < 8; k++) Add(k * 2, "W1", "120", "140");
        Add(20, "W2", "80", "60"); Add(22, "W2", "80", "60");
        var r = Cad.Run(doc, dwg);
        var s = r.Schedules.Single();
        Assert.Equal("WINDOW", s.Block);
        Assert.Equal(new[] { "TYPE", "W", "H" }, s.Tags);
        Assert.Equal(2, s.Rows.Count);
        Assert.Equal(new[] { "W1", "120", "140" }, s.Rows[0].Values);
        Assert.Equal(8, s.Rows[0].Count);
        Assert.Equal(2, s.Rows[1].Count);
    }

    [Fact]
    public void A_blocks_base_point_is_honoured_when_it_is_drawn()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        var b = Block(doc, "B", Cad.Line(5, 0, 6, 0));
        b.BlockEntity.BasePoint = new XYZ(5, 0, 0);
        doc.Entities.Add(Place(b, 10, 0, doc, "L"));
        var path = Cad.Run(doc).Items.Single().Path.Single();
        Assert.Equal(10, path[0], 9); Assert.Equal(11, path[2], 9);
    }

    [Fact]
    public void Xrefs_are_listed_not_loaded_and_not_counted_as_blocks()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        var x = new BlockRecord("SITE-PLAN") { Flags = ACadSharp.Blocks.BlockTypeFlags.XRef };
        doc.BlockRecords.Add(x);
        doc.Entities.Add(new Insert(x) { InsertPoint = new XYZ(0, 0, 0) });
        doc.Entities.Add(Cad.Line(0, 0, 1, 0).On(doc, "L"));
        var r = Quantities.Run(Cad.Bytes(doc, false), new Settings());
        Assert.Equal(new[] { "SITE-PLAN" }, r.Xrefs);
        Assert.Empty(r.Blocks);
        Assert.Contains(r.Warnings, w => w.Id == "xrefs");
    }
}
```

<!-- file: _src/dwg-engine/Tests/FileTests.cs -->
```csharp
using System.Text.Json;
using ACadSharp.Entities;
using ACadSharp.Types.Units;
using CSMath;
using Xunit;

namespace AidedCam.Dwg.Tests;

public class FileTests
{
    [Theory]
    [InlineData(UnitsType.Centimeters, "auto", 0.01, "file")]
    [InlineData(UnitsType.Unitless, "auto", 0.001, "assumed")]
    [InlineData(UnitsType.Unitless, "m", 1.0, "setting")]
    [InlineData(UnitsType.Inches, "m", 0.0254, "file")]                                               // the file's own units win
    public void Units_come_from_the_file_then_the_setting_then_millimetres(UnitsType units, string setting, double metres, string source)
    {
        var doc = Cad.Doc(units);
        doc.Entities.Add(Cad.Line(0, 0, 100, 0).On(doc, "L"));
        var r = Cad.Run(doc, true, setting);
        Assert.Equal(100 * metres, r.Layer("L").Len, 9);
        Assert.Equal(source, r.UnitsSource);
        Assert.Equal(source == "assumed", r.Warnings.Any(w => w.Id == "units-assumed"));
        Assert.Equal(source == "setting", r.Warnings.Any(w => w.Id == "units-setting"));
    }

    [Fact]
    public void The_visitors_override_corrects_a_file_that_states_the_wrong_units()
    {
        var doc = Cad.Doc(UnitsType.Millimeters);                                                      // says mm, drawn in cm
        doc.Entities.Add(Cad.Line(0, 0, 450, 0).On(doc, "L"));
        var r = Quantities.Run(Cad.Bytes(doc, true), new Settings { Override = "cm" });
        Assert.Equal(4.5, r.Layer("L").Len, 9);
        Assert.Equal("override", r.UnitsSource);
        Assert.Equal("mm", r.Units);                                                                   // what the file said, kept for the banner
        Assert.Contains(r.Warnings, w => w.Id == "units-override" && w.Params.Contains(("units", "cm")) && w.Params.Contains(("file", "mm")));
    }

    [Fact]
    public void The_same_drawing_as_DWG_and_DXF_gives_the_same_numbers()
    {
        var doc = Cad.Doc(UnitsType.Millimeters);
        doc.Entities.Add(Cad.Rect(0, 0, 4000, 3000).On(doc, "ROOMS"));
        doc.Entities.Add(new Arc { Center = new XYZ(0, 0, 0), Radius = 900, StartAngle = 0, EndAngle = Math.PI / 2 }.On(doc, "DOORS"));
        doc.Entities.Add(new Circle { Center = new XYZ(500, 500, 0), Radius = 100 }.On(doc, "PIPE"));
        var a = Cad.Run(doc, true); var b = Cad.Run(doc, false);
        Assert.Equal(a.Layers.Select(l => (l.Name, Math.Round(l.Len, 9), Math.Round(l.Area, 9))), b.Layers.Select(l => (l.Name, Math.Round(l.Len, 9), Math.Round(l.Area, 9))));
        Assert.Equal("dwg", a.Format); Assert.Equal("2018", a.Version);
        Assert.Equal("dxf", b.Format); Assert.Equal("2018", b.Version);
    }

    [Fact]
    public void Layer_state_and_colour_are_reported()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        var l = Cad.Layer(doc, "HIDDEN", 1);
        l.IsOn = false;
        doc.Entities.Add(Cad.Line(0, 0, 1, 0).On(doc, "HIDDEN"));
        var r = Cad.Run(doc);
        Assert.True(r.Layer("HIDDEN").Off);
        Assert.Equal("#ff0000", r.Layer("HIDDEN").Color);
        Assert.Equal(1, r.Layer("HIDDEN").Len, 9);                                                     // measured all the same
    }

    [Fact]
    public void Text_dimensions_and_other_entities_are_counted_as_not_measured()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        doc.Entities.Add(Cad.Line(0, 0, 1, 0).On(doc, "L"));
        doc.Entities.Add(new TextEntity { Value = "ΣΑΛΟΝΙ", Height = 0.2 });
        doc.Entities.Add(new MText { Value = "note", Height = 0.2 });
        doc.Entities.Add(new Point(new XYZ(1, 1, 0)));
        var r = Cad.Run(doc);
        Assert.Equal(2, r.NotMeasured.Text);
        Assert.Equal(1, r.NotMeasured.Other);
        Assert.Contains(r.Warnings, w => w.Id == "not-measured" && w.Params.Contains(("count", "3")));
    }

    [Fact]
    public void A_drawing_with_everything_in_paper_space_is_refused_plainly()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        doc.PaperSpace.Entities.Add(Cad.Line(0, 0, 1, 0));
        var ex = Assert.Throws<DwgFileException>(() => Cad.Run(doc));
        Assert.Equal("empty", ex.Reason);
        Assert.Contains("paper space", ex.Message);
    }

    [Fact]
    public void Files_that_are_not_drawings_or_too_big_are_refused_with_a_reason()
    {
        Assert.Equal("read", Assert.Throws<DwgFileException>(() => Quantities.Run(System.Text.Encoding.ASCII.GetBytes("hello"), new Settings())).Reason);
        Assert.Equal("limit", Assert.Throws<DwgFileException>(() => Quantities.Run(new byte[Limits.MaxBytes + 1], new Settings())).Reason);
        var dwg = Cad.Bytes(Cad.Doc(), true);
        System.Text.Encoding.ASCII.GetBytes("AC1099").CopyTo(dwg, 0);
        Assert.Equal("version", Assert.Throws<DwgFileException>(() => Quantities.Run(dwg, new Settings())).Reason);
    }

    [Fact]
    public void The_json_follows_the_contract()
    {
        var doc = Cad.Doc(UnitsType.Millimeters);
        doc.Entities.Add(Cad.Rect(0, 0, 4000, 3000).On(doc, "ΔΩΜΑΤΙΑ"));
        var json = ResultJson.Run(Cad.Bytes(doc, true), "κάτοψη.dwg", new Settings());
        using var d = JsonDocument.Parse(json);
        var root = d.RootElement;
        Assert.Equal("result", root.GetProperty("type").GetString());
        Assert.Equal("κάτοψη.dwg", root.GetProperty("file").GetProperty("name").GetString());
        var layer = root.GetProperty("layers")[0];
        Assert.Equal("ΔΩΜΑΤΙΑ", layer.GetProperty("name").GetString());
        Assert.Equal(12, layer.GetProperty("area").GetDouble(), 6);
        Assert.Equal(14, layer.GetProperty("len").GetDouble(), 6);
        var item = root.GetProperty("items")[0];
        Assert.Equal("polyline", item.GetProperty("kind").GetString());
        Assert.Equal(JsonValueKind.Null, item.GetProperty("block").ValueKind);
        Assert.Equal(10, item.GetProperty("path")[0].GetArrayLength());                                 // 4 corners and back to the first
        Assert.Equal(4, root.GetProperty("bbox").GetProperty("x1").GetDouble(), 6);
        var err = JsonDocument.Parse(ResultJson.Run(new byte[] { 1, 2, 3 }, "x.dwg", new Settings())).RootElement;
        Assert.Equal("error", err.GetProperty("type").GetString());
        Assert.Equal("read", err.GetProperty("reason").GetString());
    }

    [Fact]
    public void A_closed_outline_of_twenty_thousand_vertices_is_checked_in_near_linear_time()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        int n = 20_000;
        var v = Enumerable.Range(0, n).Select(i => { double t = 2 * Math.PI * i / n, r = 10 + 0.5 * Math.Sin(40 * t); return (r * Math.Cos(t), r * Math.Sin(t), 0.0); }).ToArray();
        doc.Entities.Add(Cad.Poly(true, v).On(doc, "CONTOUR"));
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var r = Cad.Run(doc);
        Assert.True(sw.ElapsedMilliseconds < 2000, $"{sw.ElapsedMilliseconds} ms");
        Assert.Equal(0, r.Layer("CONTOUR").Bad);
        Assert.InRange(r.Layer("CONTOUR").Area, 314, 316);
    }

    [Fact]
    public void A_drawing_over_the_point_budget_is_drawn_simplified_but_measured_in_full()
    {
        var doc = Cad.Doc(UnitsType.Meters);
        var block = new ACadSharp.Tables.BlockRecord("GRID");
        for (int i = 0; i < 100; i++) block.Entities.Add(Cad.Line(i * 0.01, 0, i * 0.01, 1));
        doc.BlockRecords.Add(block);
        for (int i = 0; i < 6000; i++) doc.Entities.Add(new Insert(block) { InsertPoint = new XYZ(i % 80 * 2, i / 80 * 2, 0) }.On(doc, "G"));
        var r = Cad.Run(doc);
        Assert.True(r.Simplified);
        Assert.Contains(r.Warnings, w => w.Id == "simplified");
        Assert.Equal(6000, r.Blocks.Single().Count);
        Assert.Equal(600_000, r.NotMeasured.InsideBlocks);
        Assert.True(r.Items.Sum(i => i.Path.Sum(p => p.Length / 2)) <= Limits.MaxPathPoints);           // blocks drawn as their outlines
        Assert.Equal(5, r.Items[0].Path.Single().Length / 2);
    }
}
```


Run:
```bash
for f in Cad MeasureTests HatchTests BlockTests FileTests; do node _tests/extract.mjs $PLAN _src/dwg-engine/Tests/$f.cs; done
dotnet test _src/dwg-engine/Tests 2>&1 | grep -E "error CS" | head -3
```
Expected: compile errors `CS0246`/`CS0103` (`Quantities`, `Result`, `Settings`, `LayerTotal` not found).

- [ ] **Step 2: Write the engine**

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

// A file the engine refuses. Reason is one of: read, version, limit, empty.
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

<!-- file: _src/dwg-engine/Engine/Reader.cs -->
```csharp
using ACadSharp;
using ACadSharp.Types.Units;

namespace AidedCam.Dwg;

// Opens a DWG or DXF file with ACadSharp and works out its units (spec §3, §4).
public static class Reader
{
    public static CadDocument Open(byte[] bytes, Result r)
    {
        if (bytes.Length > Limits.MaxBytes) throw new DwgFileException("limit", "over 30 MB");
        string head = System.Text.Encoding.ASCII.GetString(bytes, 0, Math.Min(bytes.Length, 4096));
        CadDocument doc;
        try
        {
            if (head.StartsWith("AC10"))
            {
                r.Format = "dwg";
                r.Version = VersionName(head.Substring(0, 6));
                if (r.Version == "") throw new DwgFileException("version", $"DWG version {head.Substring(0, 6)} is not supported");
                doc = ACadSharp.IO.DwgReader.Read(new MemoryStream(bytes));
            }
            else if (head.StartsWith("AutoCAD Binary DXF") || head.Contains("SECTION"))
            {
                r.Format = "dxf";
                doc = ACadSharp.IO.DxfReader.Read(new MemoryStream(bytes));
                r.Version = VersionName(doc.Header.VersionString ?? "");
            }
            else throw new DwgFileException("read", "not a DWG or DXF file");
        }
        catch (DwgFileException) { throw; }
        catch (Exception ex) when (ex.GetType().Name.Contains("NotSupported")) { throw new DwgFileException("version", ex.Message); }
        catch (Exception ex) { throw new DwgFileException("read", ex.Message); }
        return doc;
    }

    public static string VersionName(string ac) => ac switch
    {
        "AC1009" => "R12", "AC1012" => "R13", "AC1014" => "R14", "AC1015" => "2000", "AC1018" => "2004",
        "AC1021" => "2007", "AC1024" => "2010", "AC1027" => "2013", "AC1032" => "2018", _ => "",
    };

    // Metres per drawing unit. A file's own units win over the setting, which applies only to files that state
    // none (spec §4); without a setting such a file is assumed to be in millimetres. Building drawings often
    // state the wrong units (a template in mm, drawn in cm), so the visitor can correct one file: the override
    // wins over everything.
    public static double Scale(CadDocument doc, Settings s, Result r)
    {
        (string name, double k) = doc.Header.InsUnits switch
        {
            UnitsType.Millimeters => ("mm", 0.001),
            UnitsType.Centimeters => ("cm", 0.01),
            UnitsType.Decimeters => ("dm", 0.1),
            UnitsType.Meters => ("m", 1.0),
            UnitsType.Kilometers => ("km", 1000.0),
            UnitsType.Inches => ("inch", 0.0254),
            UnitsType.Feet => ("ft", 0.3048),
            UnitsType.USSurveyFeet => ("ft", 1200.0 / 3937.0),
            UnitsType.Yards => ("yd", 0.9144),
            _ => ("none", 0.0),
        };
        r.Units = name;
        double over = Metres(s.Override);
        if (over > 0) { r.UnitsSource = "override"; return over; }
        if (name != "none") { r.UnitsSource = "file"; return k; }
        double set = Metres(s.Units);
        if (set > 0) { r.UnitsSource = "setting"; return set; }
        r.UnitsSource = "assumed";
        return 0.001;
    }

    static double Metres(string unit) => unit switch { "mm" => 0.001, "cm" => 0.01, "m" => 1.0, "inch" => 0.0254, "ft" => 0.3048, _ => 0.0 };
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
        return s;
    }

    static Shape Poly2DShape(Polyline2D p)
    {
        // Spline-fit polylines keep their frame (control) vertices: only the curve's own vertices are measured.
        var pts = p.Vertices.Where(v => !v.Flags.HasFlag(VertexFlags.SplineFrameControlPoint))
            .Select(v => (new V(v.Location.X, v.Location.Y), v.Bulge)).ToList();
        var s = BulgeShape(pts, p.IsClosed);
        s.Map = Affine.Ocs(p.Normal.X, p.Normal.Y, p.Normal.Z, p.Elevation);
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

<!-- file: _src/dwg-engine/Engine/Hatches.cs -->
```csharp
using ACadSharp.Entities;

namespace AidedCam.Dwg;

// Hatch area with islands subtracted (spec §4). Each boundary loop becomes an outline of exact pieces in the
// hatch's own plane, its edges joined head to tail; its area is exact (Green's theorem). Islands follow the
// hatch style: Normal alternates by nesting depth, Outer keeps the outermost loops minus the islands directly
// inside them, Ignore keeps the outermost loops only.
public static class Hatches
{
    public static Shape Measure(Hatch h)
    {
        var s = new Shape { Kind = "hatch", Map = Affine.Ocs(h.Normal.X, h.Normal.Y, h.Normal.Z, h.Elevation) };
        try
        {
            foreach (var path in h.Paths)
            {
                var o = Loop(path);
                if (o.Pieces.Count > 0 && Math.Abs(o.SignedArea) > 0) s.Outlines.Add(o);
            }
            if (s.Outlines.Count == 0) { s.Bad = true; return s; }
            double area = IslandArea(s.Outlines, h.Style);
            if (!(area > 0)) { s.Bad = true; s.Area = 0; return s; }
            s.Area = area;
        }
        catch { s.Bad = true; s.Area = 0; }
        return s;
    }

    public static double IslandArea(List<Outline> loops, HatchStyleType style)
    {
        var abs = loops.Select(l => Math.Abs(l.SignedArea)).ToArray();
        var rings = loops.Select(l => { var (min, max) = l.Bounds(double.MaxValue); return l.Sample(Math.Max(max.X - min.X, max.Y - min.Y) * 1e-4); }).ToList();
        double total = 0;
        for (int i = 0; i < loops.Count; i++)
        {
            // A point of the loop to test nesting with: the middle of its first edge, on no other loop in a sane hatch.
            var probe = (rings[i][0] + rings[i][1]) * 0.5;
            int depth = 0;
            for (int j = 0; j < loops.Count; j++)
                if (j != i && abs[j] > abs[i] && Geo.Inside(probe, rings[j])) depth++;
            total += style switch
            {
                HatchStyleType.Ignore => depth == 0 ? abs[i] : 0,
                HatchStyleType.Outer => depth == 0 ? abs[i] : depth == 1 ? -abs[i] : 0,
                _ => depth % 2 == 0 ? abs[i] : -abs[i],
            };
        }
        return total;
    }

    static Outline Loop(Hatch.BoundaryPath path)
    {
        var o = new Outline { Closed = true };
        foreach (var edge in path.Edges)
            foreach (var piece in EdgePieces(edge))
            {
                var p = piece;
                if (o.Pieces.Count > 0)
                {
                    // Edges are stored head to tail, but some writers reverse one: follow the nearer end.
                    var end = o.Pieces[^1].End;
                    if ((p.End - end).Length < (p.Start - end).Length) p = p.Reversed();
                }
                o.Pieces.Add(p);
            }
        return o;
    }

    static IEnumerable<Piece> EdgePieces(Hatch.BoundaryPath.Edge edge)
    {
        switch (edge)
        {
            case Hatch.BoundaryPath.Line l:
                yield return Piece.Line(new V(l.Start.X, l.Start.Y), new V(l.End.X, l.End.Y));
                break;
            case Hatch.BoundaryPath.Arc a:
            {
                // A clockwise arc edge is stored mirrored: its angles are negated.
                var (s0, sweep) = Sweep(a.StartAngle, a.EndAngle, a.CounterClockWise);
                yield return Piece.Arc(new V(a.Center.X, a.Center.Y), a.Radius, s0, sweep);
                break;
            }
            case Hatch.BoundaryPath.Ellipse e:
            {
                var (s0, sweep) = Sweep(e.StartAngle, e.EndAngle, e.CounterClockWise);
                var M = new V(e.MajorAxisEndPoint.X, e.MajorAxisEndPoint.Y);
                var m = new V(-M.Y, M.X) * e.MinorToMajorRatio;
                var c = new V(e.Center.X, e.Center.Y);
                int n = Piece.ArcSteps(1, sweep, 1e-6) * 2;
                var pts = new List<V>(n + 1);
                for (int i = 0; i <= n; i++) { double t = s0 + sweep * i / n; pts.Add(c + M * Math.Cos(t) + m * Math.Sin(t)); }
                yield return Piece.Points(pts);
                break;
            }
            case Hatch.BoundaryPath.Spline sp:
            {
                var w = sp.Weights?.ToList() ?? new List<double>();
                int n = sp.ControlPoints.Count;
                if (n >= 2 && sp.Knots.Count == n + sp.Degree + 1)
                {
                    var cp = new devDept.Geometry.Point4D[n];
                    for (int i = 0; i < n; i++)
                    {
                        double wi = i < w.Count && w[i] > 0 ? w[i] : 1;
                        cp[i] = new devDept.Geometry.Point4D(sp.ControlPoints[i].X * wi, sp.ControlPoints[i].Y * wi, 0, wi);
                    }
                    var curve = new devDept.Eyeshot.Entities.Curve(sp.Degree, sp.Knots.ToArray(), cp);
                    double len = curve.Length();
                    var pts = curve.ConvertToLinearPath(Math.Max(len * 1e-6, 1e-12), 0).Vertices.Select(p => new V(p.X, p.Y)).ToList();
                    yield return Piece.Points(pts, len);
                }
                else if (sp.FitPoints.Count >= 2) yield return Piece.Points(sp.FitPoints.Select(p => new V(p.X, p.Y)).ToList());
                break;
            }
            case Hatch.BoundaryPath.Polyline pl:
            {
                var v = pl.Vertices;                                     // Z carries the bulge
                int count = pl.IsClosed ? v.Count : v.Count - 1;
                for (int i = 0; i < count; i++)
                {
                    var a = v[i]; var b = v[(i + 1) % v.Count];
                    if (Math.Abs(a.X - b.X) + Math.Abs(a.Y - b.Y) < 1e-15) continue;
                    yield return Piece.Bulge(new V(a.X, a.Y), new V(b.X, b.Y), a.Z);
                }
                break;
            }
        }
    }

    static (double Start, double Sweep) Sweep(double start, double end, bool ccw)
    {
        if (ccw) return (start, Norm(end - start));
        return (-start, -Norm(end - start));
    }

    static double Norm(double a)
    {
        while (a <= 0) a += 2 * Math.PI;
        while (a > 2 * Math.PI + 1e-12) a -= 2 * Math.PI;
        return a;
    }
}
```

<!-- file: _src/dwg-engine/Engine/Blocks.cs -->
```csharp
using ACadSharp;
using ACadSharp.Entities;
using ACadSharp.Tables;

namespace AidedCam.Dwg;

// Block definitions (spec §4): the names users see, what is nested inside, and the drawing of an insert.
// Everything here is cached per block definition, so a block placed a thousand times is walked once.
public sealed class Blocks(CadDocument doc)
{
    const int MaxDepth = 16;
    readonly Dictionary<ulong, string> names = new();
    readonly Dictionary<ulong, Dictionary<(string Name, string Layer), int>> nested = new();
    readonly Dictionary<ulong, int> geometry = new();
    readonly Dictionary<ulong, List<List<(double X, double Y, double Z)>>> drawings = new();
    double drawingDev = double.NaN;

    public static bool IsXref(BlockRecord b) =>
        b.Flags.HasFlag(ACadSharp.Blocks.BlockTypeFlags.XRef) || b.Flags.HasFlag(ACadSharp.Blocks.BlockTypeFlags.XRefOverlay);

    // The name a user sees. A dynamic block's insert points at an anonymous copy (*U…); AutoCAD links the copy
    // back to its dynamic block with the extended data AcDbBlockRepBTag, whose handle names the original.
    public string Name(BlockRecord b)
    {
        if (names.TryGetValue(b.Handle, out var n)) return n;
        n = b.Name;
        if (n.StartsWith("*"))
        {
            if (b.Source != null) n = b.Source.Name;
            else if (b.ExtendedData.TryGet("AcDbBlockRepBTag", out var xd))
                foreach (var rec in xd.Records)
                {
                    if (rec is not ACadSharp.XData.ExtendedDataHandle h) continue;
                    // ACadSharp 3.3.23 reads this handle from a DWG with its bytes reversed (its own DWG writer
                    // round-trips 0x46 as 0x4600000000000000), so both byte orders are tried.
                    if ((doc.TryGetCadObject<BlockRecord>(h.Value, out var src) && src != null) ||
                        (doc.TryGetCadObject<BlockRecord>(System.Buffers.Binary.BinaryPrimitives.ReverseEndianness(h.Value), out src) && src != null))
                    { n = src.Name; break; }
                }
        }
        return names[b.Handle] = n;
    }

    public static int Copies(Insert i) => Math.Max(1, (int)i.RowCount) * Math.Max(1, (int)i.ColumnCount);

    // Inserts inside a block definition, by (name, layer), times their placements. A nested insert on layer
    // "0" takes the layer of the insert that places it: its layer here is null until then.
    public Dictionary<(string Name, string Layer), int> Nested(BlockRecord b, int depth = 0)
    {
        if (nested.TryGetValue(b.Handle, out var d)) return d;
        d = new Dictionary<(string, string), int>();
        if (depth < MaxDepth)
            foreach (var child in b.Entities.OfType<Insert>())
            {
                if (child.Block == null || IsXref(child.Block)) continue;
                string layer = child.Layer?.Name is null or "0" ? null : child.Layer.Name;
                int copies = Copies(child);
                Add(d, (Name(child.Block), layer), copies);
                foreach (var kv in Nested(child.Block, depth + 1))
                    Add(d, (kv.Key.Name, kv.Key.Layer ?? layer), copies * kv.Value);
            }
        return nested[b.Handle] = d;
    }

    static void Add(Dictionary<(string, string), int> d, (string, string) key, int n) => d[key] = d.GetValueOrDefault(key) + n;

    // Curves and hatches inside a block definition, counting nested blocks by their placements. None of them
    // is added to the layer totals: a block is an item, not metres (spec §4).
    public int Geometry(BlockRecord b, int depth = 0)
    {
        if (geometry.TryGetValue(b.Handle, out var n)) return n;
        n = 0;
        foreach (var e in b.Entities)
        {
            if (e is Hatch || Measure.IsCurveType(e)) n++;
            else if (e is Insert child && child.Block != null && !IsXref(child.Block) && depth < MaxDepth) n += Copies(child) * Geometry(child.Block, depth + 1);
        }
        return geometry[b.Handle] = n;
    }

    // The block's curves and hatch boundaries as polylines in block coordinates, nested blocks included,
    // sampled within dev. Attributes and text are not drawn.
    public List<List<(double X, double Y, double Z)>> Drawing(BlockRecord b, double dev, int depth = 0)
    {
        if (drawingDev != dev) { drawings.Clear(); drawingDev = dev; }
        if (drawings.TryGetValue(b.Handle, out var lines)) return lines;
        lines = new List<List<(double, double, double)>>();
        drawings[b.Handle] = lines;                                   // a block that (wrongly) contains itself draws once
        if (depth >= MaxDepth) return lines;
        var bp = b.BlockEntity?.BasePoint ?? new CSMath.XYZ(0, 0, 0);
        var toBase = new Affine(new double[] { 1, 0, 0, -bp.X, 0, 1, 0, -bp.Y, 0, 0, 1, -bp.Z });
        foreach (var e in b.Entities)
        {
            if (e is Insert child)
            {
                if (child.Block == null || IsXref(child.Block)) continue;
                var inner = Drawing(child.Block, dev, depth + 1);
                foreach (var map in Placements(child))
                    foreach (var line in inner) lines.Add(Apply(line, map.Then(toBase)));
                continue;
            }
            var shape = e is Hatch h ? Hatches.Measure(h) : Measure.Curve(e);
            if (shape == null) continue;
            foreach (var line in shape.Polylines(dev, toBase)) lines.Add(line);
        }
        return lines;
    }

    static List<(double X, double Y, double Z)> Apply(List<(double X, double Y, double Z)> line, Affine map)
    {
        var r = new List<(double, double, double)>(line.Count);
        foreach (var p in line) r.Add(map.Apply(p.X, p.Y, p.Z));
        return r;
    }

    // Block space → the insert's owner space, one map per copy (a MINSERT has rows × columns copies; the grid
    // turns with the insert). ACadSharp's transform ignores the block's base point; Drawing takes it off.
    public static IEnumerable<Affine> Placements(Insert i)
    {
        var t = i.GetTransform();
        (double, double, double) P(double x, double y, double z) { var v = t.ApplyTransform(new CSMath.XYZ(x, y, z)); return (v.X, v.Y, v.Z); }
        var baseMap = Affine.FromBasis(P(0, 0, 0), P(1, 0, 0), P(0, 1, 0), P(0, 0, 1));    // ignores the base point
        int rows = Math.Max(1, (int)i.RowCount), cols = Math.Max(1, (int)i.ColumnCount);
        double cos = Math.Cos(i.Rotation), sin = Math.Sin(i.Rotation);
        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
            {
                double ox = c * i.ColumnSpacing, oy = r * i.RowSpacing;
                double dx = ox * cos - oy * sin, dy = ox * sin + oy * cos;
                yield return baseMap.Then(new Affine(new double[] { 1, 0, 0, dx, 0, 1, 0, dy, 0, 0, 1, 0 }));
            }
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
        var doc = Reader.Open(bytes, r);
        double k = Reader.Scale(doc, settings, r);
        var model = doc.Entities.ToList();
        if (model.Count > Limits.MaxEntities) throw new DwgFileException("limit", "over 300,000 entities");
        if (model.Count == 0)
        {
            bool paper = doc.BlockRecords.Any(b => b.Name.StartsWith("*Paper_Space", StringComparison.OrdinalIgnoreCase) && b.Entities.Count > 0);
            throw new DwgFileException("empty", paper ? "model space is empty; the drawing is in paper space" : "the drawing is empty");
        }

        var blocks = new Blocks(doc);
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
                    var s = Hatches.Measure(h);
                    pending.Add(new Pending { Item = new Item { Id = id, Layer = layer, Kind = "hatch", Area = s.Area * k * k, Bad = s.Bad }, Shape = s });
                    break;
                }
                default:
                {
                    var s = Measure.Curve(e);
                    if (s == null) { NotMeasured(r.NotMeasured, e); break; }
                    pending.Add(new Pending { Item = new Item { Id = id, Layer = layer, Kind = s.Kind, Len = s.Len * k, Area = s.Area * k * k, Bad = s.Bad }, Shape = s });
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
        if (r.UnitsSource == "override") W("units-override", ("units", s.Override), ("file", r.Units));
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

    // The one entry point the host calls: never throws.
    public static string Run(byte[] bytes, string name, Settings settings)
    {
        try { return Write(name, Quantities.Run(bytes, settings)); }
        catch (DwgFileException ex) { return Error(name, ex.Reason, ex.Message); }
        catch (Exception ex) { return Error(name, "read", ex.GetType().Name + ": " + ex.Message); }
    }
}
```


Run: `for f in Model Reader Measure Hatches Blocks Quantities ResultJson; do node _tests/extract.mjs $PLAN _src/dwg-engine/Engine/$f.cs; done`

- [ ] **Step 3: Run the tests**

Run: `dotnet test _src/dwg-engine/Tests 2>&1 | tail -1`
Expected: `Passed!  - Failed:     0, Passed:    42, …` (5 + 8 + 6 + 10 + 13).

If a test fails, fix the engine, not the test: every expected number is worked out by hand in the test's comment.

- [ ] **Step 4: Commit**

```bash
git add _src/dwg-engine
git commit -F - <<'EOF'
DWG quantities: reading and measuring (curves, hatches, blocks, units, JSON)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 3: Golden fixtures and the example drawing

**Files:**
- Create: `_src/dwg-engine/Tests/Fixtures.cs`, `_src/dwg-engine/Tests/Examples.cs`
- Generate (binary, never typed): `_tests/dwg/fixtures/{rooms-2004.dxf, rooms.dwg, blocks-2004.dxf, blocks.dwg, curves.dwg, no-units-2004.dxf, expected.json}`, `js/dwg/examples/example-plan.dwg`

**Interfaces:**
- Produces: `Fixtures.Summary(Result)` (the comparable summary that `parity.html` recomputes in Task 4) and the committed fixtures with `expected.json`; the example drawing the page loads in Task 12.

- [ ] **Step 1: Write the fixture and example builders**

<!-- file: _src/dwg-engine/Tests/Fixtures.cs -->
```csharp
using System.Text.Json;
using ACadSharp;
using ACadSharp.Entities;
using ACadSharp.Tables;
using ACadSharp.Types.Units;
using ACadSharp.XData;
using CSMath;
using Xunit;

namespace AidedCam.Dwg.Tests;

// Synthetic files that the browser engine must measure exactly as the desktop engine does (spec §9). They are
// committed to _tests/dwg/fixtures/ with the desktop results in expected.json, and _tests/dwg/parity.html runs
// them through the published engine and compares. ACadSharp stamps files with the time they were written, so
// the committed bytes are the reference: set DWGQ_WRITE_FIXTURES=1 once to write them.
public class Fixtures
{
    static readonly string Dir = Path.Combine(Root(), "_tests", "dwg", "fixtures");

    static string Root()
    {
        var d = new DirectoryInfo(AppContext.BaseDirectory);
        while (d != null && !File.Exists(Path.Combine(d.FullName, "free-tools.html"))) d = d.Parent;
        return d?.FullName ?? throw new InvalidOperationException("repo root not found");
    }

    public static Dictionary<string, byte[]> Build() => new()
    {
        ["rooms-2004.dxf"] = Greek1253(Cad.Bytes(Rooms(ACadVersion.AC1018, ascii: true), false)),
        ["rooms.dwg"] = Cad.Bytes(Rooms(ACadVersion.AC1032), true),
        ["blocks-2004.dxf"] = Greek1253(Cad.Bytes(BlocksDoc(ACadVersion.AC1018, ascii: true), false)),
        ["blocks.dwg"] = Cad.Bytes(BlocksDoc(ACadVersion.AC1032), true),
        ["curves.dwg"] = Cad.Bytes(Curves(), true),
        ["no-units-2004.dxf"] = Cad.Bytes(NoUnits(), false),
    };

    // Greek names, as a pre-2007 DXF from a Greek AutoCAD carries them: Windows-1253 bytes under
    // $DWGCODEPAGE ANSI_1253. ACadSharp's own DXF writer would write UTF-8 there, so the documents use ASCII
    // placeholders of the same byte length, swapped here for the Greek bytes.
    static readonly (string Ascii, string Greek)[] Names =
    {
        ("LYR_T1", "ΤΟΙΧΟΙ"), ("LYR_D1", "ΔΑΠΕΔΑ"), ("LYR_P1", "ΠΟΡΤΕΣ"), ("LYR_Y01", "ΥΔΡΕΥΣΗ"), ("TXT_S1", "ΣΑΛΟΝΙ"), ("~1", "Π1"), ("~2", "Π2"),
    };

    static string N(string greek, bool ascii) => ascii ? Names.Single(n => n.Greek == greek).Ascii : greek;

    static byte[] Greek1253(byte[] dxf)
    {
        System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);
        var enc = System.Text.Encoding.GetEncoding(1253);
        foreach (var (a, g) in Names)
        {
            byte[] from = System.Text.Encoding.ASCII.GetBytes(a), to = enc.GetBytes(g);
            for (int i = 0; i + from.Length <= dxf.Length; i++)
                if (dxf.AsSpan(i, from.Length).SequenceEqual(from)) to.CopyTo(dxf, i);
        }
        return dxf;
    }

    // Rooms in centimetres: outlines, a hatched floor with an island, a door arc, a pipe run.
    static CadDocument Rooms(ACadVersion v, bool ascii = false)
    {
        var doc = Cad.Doc(UnitsType.Centimeters, v);
        doc.Header.CodePage = "ANSI_1253";
        doc.Entities.Add(Cad.Rect(0, 0, 500, 400).On(doc, N("ΤΟΙΧΟΙ", ascii)));
        doc.Entities.Add(Cad.Rect(500, 0, 300, 400).On(doc, N("ΤΟΙΧΟΙ", ascii)));
        var h = new Hatch { IsSolid = true, Pattern = new HatchPattern("SOLID") };
        var outer = new Hatch.BoundaryPath { Flags = BoundaryPathFlags.External | BoundaryPathFlags.Polyline };
        outer.Edges.Add(new Hatch.BoundaryPath.Polyline { IsClosed = true, Vertices = { new XYZ(0, 0, 0), new XYZ(500, 0, 0), new XYZ(500, 400, 0), new XYZ(0, 400, 0) } });
        var column = new Hatch.BoundaryPath { Flags = BoundaryPathFlags.Polyline };
        column.Edges.Add(new Hatch.BoundaryPath.Polyline { IsClosed = true, Vertices = { new XYZ(200, 150, 0), new XYZ(240, 150, 0), new XYZ(240, 190, 0), new XYZ(200, 190, 0) } });
        h.Paths.Add(outer); h.Paths.Add(column);
        doc.Entities.Add(h.On(doc, N("ΔΑΠΕΔΑ", ascii)));
        doc.Entities.Add(new Arc { Center = new XYZ(500, 100, 0), Radius = 90, StartAngle = Math.PI / 2, EndAngle = Math.PI }.On(doc, N("ΠΟΡΤΕΣ", ascii)));
        doc.Entities.Add(Cad.Poly(false, (20, 380, 0), (480, 380, 0), (480, 20, -0.4142135623730950), (700, 20, 0)).On(doc, N("ΥΔΡΕΥΣΗ", ascii)));
        doc.Entities.Add(new TextEntity { Value = N("ΣΑΛΟΝΙ", ascii), Height = 20, InsertPoint = new XYZ(250, 200, 0) });
        return doc;
    }

    // Blocks in metres: counts per layer, an arrayed insert, nesting, a dynamic block's anonymous copy, attributes.
    static CadDocument BlocksDoc(ACadVersion v, bool ascii = false)
    {
        var doc = Cad.Doc(UnitsType.Meters, v);
        doc.Header.CodePage = "ANSI_1253";
        BlockRecord B(string name, params Entity[] es) { var b = new BlockRecord(name); foreach (var e in es) b.Entities.Add(e); doc.BlockRecords.Add(b); return b; }
        var valve = B("VALVE", Cad.Line(-0.1, 0, 0.1, 0), new Circle { Center = new XYZ(0, 0, 0), Radius = 0.05 });
        var lamp = B("LAMP", new Circle { Center = new XYZ(0, 0, 0), Radius = 0.1 });
        var wc = B("WC", Cad.Rect(0, 0, 0.4, 0.6));
        var bath = B("BATHROOM", Cad.Rect(0, 0, 2, 3), new Insert(wc) { InsertPoint = new XYZ(0.2, 0.2, 0) }, new Insert(wc) { InsertPoint = new XYZ(1.2, 0.2, 0) });
        var window = B("WINDOW", Cad.Rect(0, 0, 1, 0.2));
        var copy = B("*U12", Cad.Rect(0, 0, 1.2, 0.2));
        var app = new AppId("AcDbBlockRepBTag"); doc.AppIds.Add(app);
        copy.ExtendedData.Add(app, new ExtendedData(new List<ExtendedDataRecord> { new ExtendedDataInteger16(1), new ExtendedDataHandle(window.Handle) }));

        doc.Entities.Add(Cad.Line(0, 0, 20, 0).On(doc, "PIPE"));
        foreach (var x in new[] { 4.0, 12 }) doc.Entities.Add(new Insert(valve) { InsertPoint = new XYZ(x, 0, 0) }.On(doc, "PIPE"));
        doc.Entities.Add(new Insert(lamp) { InsertPoint = new XYZ(0, 5, 0), RowCount = 2, ColumnCount = 3, RowSpacing = 2, ColumnSpacing = 3 }.On(doc, "LIGHT"));
        for (int i = 0; i < 2; i++) doc.Entities.Add(new Insert(bath) { InsertPoint = new XYZ(i * 5, 10, 0) }.On(doc, "SANITARY"));
        void Win(double x, BlockRecord b, string type, string w, string h)
        {
            var ins = new Insert(b) { InsertPoint = new XYZ(x, 15, 0) }.On(doc, "WINDOWS");
            ins.Attributes.Add(new AttributeEntity { Tag = "TYPE", Value = type });
            ins.Attributes.Add(new AttributeEntity { Tag = "W", Value = w });
            ins.Attributes.Add(new AttributeEntity { Tag = "H", Value = h });
            doc.Entities.Add(ins);
        }
        for (int i = 0; i < 3; i++) Win(i * 2, window, N("Π1", ascii), "100", "140");
        Win(8, copy, N("Π2", ascii), "120", "140");
        return doc;
    }

    // Curves in millimetres: a rational spline, an ellipse, a mirrored arc, a bulged slot, a bow tie, a 3D polyline.
    static CadDocument Curves()
    {
        var doc = Cad.Doc(UnitsType.Millimeters);
        var sp = new Spline { Degree = 2 };
        foreach (var p in new[] { new XYZ(1000, 0, 0), new XYZ(1000, 1000, 0), new XYZ(0, 1000, 0) }) sp.ControlPoints.Add(p);
        foreach (var w in new[] { 1, Math.Sqrt(0.5), 1 }) sp.Weights.Add(w);
        foreach (var k in new[] { 0.0, 0, 0, 1, 1, 1 }) sp.Knots.Add(k);
        sp.Flags |= SplineFlags.Rational;
        doc.Entities.Add(sp.On(doc, "SPLINE"));
        doc.Entities.Add(new Ellipse { Center = new XYZ(3000, 0, 0), MajorAxisEndPoint = new XYZ(800, 0, 0), RadiusRatio = 0.5, StartParameter = 0, EndParameter = 2 * Math.PI }.On(doc, "ELLIPSE"));
        doc.Entities.Add(new Arc { Center = new XYZ(500, -2000, 0), Radius = 300, StartAngle = 0, EndAngle = Math.PI, Normal = new XYZ(0, 0, -1) }.On(doc, "MIRROR"));
        doc.Entities.Add(Cad.Poly(true, (0, 3000, 0), (400, 3000, 1), (400, 3200, 0), (0, 3200, 1)).On(doc, "SLOT"));
        doc.Entities.Add(Cad.Poly(true, (2000, 3000, 0), (2200, 3200, 0), (2200, 3000, 0), (2000, 3200, 0)).On(doc, "BAD"));
        var p3 = new Polyline3D();
        foreach (var q in new[] { new XYZ(0, -4000, 0), new XYZ(300, -4000, 400), new XYZ(300, -3500, 400) }) p3.Vertices.Add(new Vertex3D(q));
        doc.Entities.Add(p3.On(doc, "3D"));
        return doc;
    }

    static CadDocument NoUnits()
    {
        var doc = Cad.Doc(UnitsType.Unitless, ACadVersion.AC1018);
        doc.Entities.Add(Cad.Rect(0, 0, 2500, 1500).On(doc, "A"));
        return doc;
    }

    // The comparable summary of a result; parity.html computes the same from the engine's JSON.
    public static Dictionary<string, object> Summary(Result r)
    {
        static double R(double v) => Math.Round(v, 6);
        return new Dictionary<string, object>
        {
            ["units"] = r.Units + "/" + r.UnitsSource,
            ["layers"] = r.Layers.Select(l => $"{l.Name}|{R(l.Len)}|{l.LenCount}|{R(l.Area)}|{l.AreaCount}|{R(l.HatchArea)}|{l.HatchCount}|{l.Bad}").ToList(),
            ["blocks"] = r.Blocks.Select(b => $"{b.Name}|{b.Layer}|{b.Count}|{b.Nested}").ToList(),
            ["schedules"] = r.Schedules.SelectMany(s => s.Rows.Select(row => $"{s.Block}|{string.Join(",", s.Tags)}|{string.Join(",", row.Values)}|{row.Count}")).ToList(),
            ["items"] = r.Items.Count,
            ["notMeasured"] = $"{r.NotMeasured.Text}|{r.NotMeasured.Dim}|{r.NotMeasured.Other}|{r.NotMeasured.InsideBlocks}",
            ["warnings"] = r.Warnings.Select(w => w.Id).ToList(),
        };
    }

    [Fact]
    public void The_committed_fixtures_give_the_committed_expected_results()
    {
        var opts = new JsonSerializerOptions { WriteIndented = true, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
        var expectedPath = Path.Combine(Dir, "expected.json");
        if (Environment.GetEnvironmentVariable("DWGQ_WRITE_FIXTURES") == "1")
        {
            Directory.CreateDirectory(Dir);
            var all = new SortedDictionary<string, Dictionary<string, object>>(StringComparer.Ordinal);
            foreach (var (name, bytes) in Build())
            {
                File.WriteAllBytes(Path.Combine(Dir, name), bytes);
                all[name] = Summary(Quantities.Run(bytes, new Settings()));
            }
            File.WriteAllText(expectedPath, JsonSerializer.Serialize(all, opts) + "\n");
        }
        var expected = JsonDocument.Parse(File.ReadAllText(expectedPath)).RootElement;
        foreach (var file in expected.EnumerateObject())
        {
            var actual = JsonSerializer.Serialize(Summary(Quantities.Run(File.ReadAllBytes(Path.Combine(Dir, file.Name)), new Settings())), opts);
            Assert.Equal(JsonSerializer.Serialize(file.Value, opts), actual);
        }
    }

    [Fact]
    public void The_DWG_and_DXF_fixtures_agree()
    {
        var f = Build();
        foreach (var (dxf, dwg) in new[] { ("rooms-2004.dxf", "rooms.dwg"), ("blocks-2004.dxf", "blocks.dwg") })
        {
            var a = Summary(Quantities.Run(f[dxf], new Settings())); var b = Summary(Quantities.Run(f[dwg], new Settings()));
            Assert.Equal(JsonSerializer.Serialize(a), JsonSerializer.Serialize(b));
        }
    }
}
```

<!-- file: _src/dwg-engine/Tests/Examples.cs -->
```csharp
using ACadSharp;
using ACadSharp.Entities;
using ACadSharp.Tables;
using ACadSharp.Types.Units;
using ACadSharp.XData;
using CSMath;
using Xunit;

namespace AidedCam.Dwg.Tests;

// The page's example drawing (spec §5): a synthetic 12 × 9 m apartment in millimetres, built for the tool with
// no customer data. It shows every table: walls, hatched floors with a column island, water pipes with a bend,
// air ducts, doors and windows with attributes (one a dynamic block's anonymous copy), a bathroom block with
// nested fittings, and an arrayed insert of ceiling lights. Set DWGQ_WRITE_EXAMPLE=1 once to write
// js/dwg/examples/example-plan.dwg; the committed file is then the reference.
public class Examples
{
    static readonly string File = Path.Combine(Root(), "js", "dwg", "examples", "example-plan.dwg");

    static string Root()
    {
        var d = new DirectoryInfo(AppContext.BaseDirectory);
        while (d != null && !System.IO.File.Exists(Path.Combine(d.FullName, "free-tools.html"))) d = d.Parent;
        return d?.FullName ?? throw new InvalidOperationException("repo root not found");
    }

    public static CadDocument Plan()
    {
        var doc = Cad.Doc(UnitsType.Millimeters);
        Cad.Layer(doc, "ΤΟΙΧΟΙ", 7); Cad.Layer(doc, "ΔΑΠΕΔΑ", 8); Cad.Layer(doc, "ΥΔΡΕΥΣΗ", 5); Cad.Layer(doc, "ΑΕΡΑΓΩΓΟΙ", 4);
        Cad.Layer(doc, "ΚΟΥΦΩΜΑΤΑ", 3); Cad.Layer(doc, "ΥΓΙΕΙΝΗ", 6); Cad.Layer(doc, "ΦΩΤΙΣΜΟΣ", 2); Cad.Layer(doc, "ΚΕΙΜΕΝΑ", 7);
        BlockRecord B(string name, params Entity[] es) { var b = new BlockRecord(name); foreach (var e in es) b.Entities.Add(e); doc.BlockRecords.Add(b); return b; }

        // Rooms: living room, bedroom, kitchen, bathroom (outer walls 12 × 9 m).
        (string Name, double X, double Y, double W, double H)[] rooms =
        {
            ("ΣΑΛΟΝΙ", 0, 0, 7000, 5000), ("ΥΠΝΟΔΩΜΑΤΙΟ", 7000, 0, 5000, 5000), ("ΚΟΥΖΙΝΑ", 0, 5000, 7000, 4000), ("ΛΟΥΤΡΟ", 7000, 5000, 5000, 4000),
        };
        foreach (var r in rooms)
        {
            doc.Entities.Add(Cad.Rect(r.X, r.Y, r.W, r.H).On(doc, "ΤΟΙΧΟΙ"));
            var h = new Hatch { IsSolid = false, Pattern = new HatchPattern("ANSI31"), PatternScale = 50 };
            var outer = new Hatch.BoundaryPath { Flags = BoundaryPathFlags.External | BoundaryPathFlags.Polyline };
            outer.Edges.Add(new Hatch.BoundaryPath.Polyline { IsClosed = true, Vertices = { new XYZ(r.X, r.Y, 0), new XYZ(r.X + r.W, r.Y, 0), new XYZ(r.X + r.W, r.Y + r.H, 0), new XYZ(r.X, r.Y + r.H, 0) } });
            h.Paths.Add(outer);
            if (r.Name == "ΣΑΛΟΝΙ")
            {
                var column = new Hatch.BoundaryPath { Flags = BoundaryPathFlags.Polyline };
                column.Edges.Add(new Hatch.BoundaryPath.Polyline { IsClosed = true, Vertices = { new XYZ(3300, 2300, 0), new XYZ(3700, 2300, 0), new XYZ(3700, 2700, 0), new XYZ(3300, 2700, 0) } });
                h.Paths.Add(column);
                doc.Entities.Add(Cad.Rect(3300, 2300, 400, 400).On(doc, "ΤΟΙΧΟΙ"));
            }
            doc.Entities.Add(h.On(doc, "ΔΑΠΕΔΑ"));
            doc.Entities.Add(new TextEntity { Value = r.Name, Height = 250, InsertPoint = new XYZ(r.X + 400, r.Y + r.H - 600, 0) }.On(doc, "ΚΕΙΜΕΝΑ"));
        }

        // Water: a supply run with a rounded bend into the kitchen and the bathroom.
        doc.Entities.Add(Cad.Poly(false, (500, 8600, 0), (6000, 8600, 0), (6500, 8100, 0), (6500, 6000, 0)).On(doc, "ΥΔΡΕΥΣΗ"));
        doc.Entities.Add(Cad.Poly(false, (6500, 6000, 0), (9000, 6000, -0.4142135623730950), (9500, 6500, 0), (9500, 8500, 0)).On(doc, "ΥΔΡΕΥΣΗ"));
        // Air: two duct runs along the ceiling.
        doc.Entities.Add(Cad.Line(500, 4600, 11500, 4600).On(doc, "ΑΕΡΑΓΩΓΟΙ"));
        doc.Entities.Add(Cad.Line(3500, 4600, 3500, 500).On(doc, "ΑΕΡΑΓΩΓΟΙ"));
        doc.Entities.Add(new Circle { Center = new XYZ(3500, 500, 0), Radius = 150 }.On(doc, "ΑΕΡΑΓΩΓΟΙ"));

        // Doors and windows with attributes.
        var door = B("ΠΟΡΤΑ", Cad.Line(0, 0, 900, 0), new Arc { Center = new XYZ(0, 0, 0), Radius = 900, StartAngle = 0, EndAngle = Math.PI / 2 });
        var window = B("ΠΑΡΑΘΥΡΟ", Cad.Rect(0, -100, 1200, 200), Cad.Line(0, 0, 1200, 0));
        var wide = B("*U4", Cad.Rect(0, -100, 1800, 200), Cad.Line(0, 0, 1800, 0));                     // a stretched copy of the dynamic window
        var app = new AppId("AcDbBlockRepBTag"); doc.AppIds.Add(app);
        wide.ExtendedData.Add(app, new ExtendedData(new List<ExtendedDataRecord> { new ExtendedDataInteger16(1), new ExtendedDataHandle(window.Handle) }));
        void Place(BlockRecord b, double x, double y, double rot, string type, string w, string h)
        {
            var i = new Insert(b) { InsertPoint = new XYZ(x, y, 0), Rotation = rot }.On(doc, "ΚΟΥΦΩΜΑΤΑ");
            i.Attributes.Add(new AttributeEntity { Tag = "ΤΥΠΟΣ", Value = type });
            i.Attributes.Add(new AttributeEntity { Tag = "ΠΛΑΤΟΣ", Value = w });
            i.Attributes.Add(new AttributeEntity { Tag = "ΥΨΟΣ", Value = h });
            doc.Entities.Add(i);
        }
        Place(window, 1500, 0, 0, "Π1", "120", "140"); Place(window, 4000, 0, 0, "Π1", "120", "140");
        Place(window, 8500, 0, 0, "Π1", "120", "140"); Place(window, 12000, 6000, Math.PI / 2, "Π1", "120", "140");
        Place(wide, 1500, 9000, 0, "Π2", "180", "140");
        Place(door, 7000, 1000, Math.PI / 2, "Θ1", "90", "220"); Place(door, 6000, 5000, 0, "Θ1", "90", "220");
        Place(door, 8000, 5000, 0, "Θ2", "80", "220");

        // A bathroom set with nested fittings, and the ceiling lights as one arrayed insert.
        var wc = B("ΛΕΚΑΝΗ", Cad.Rect(0, 0, 400, 600));
        var basin = B("ΝΙΠΤΗΡΑΣ", new Ellipse { Center = new XYZ(250, 200, 0), MajorAxisEndPoint = new XYZ(250, 0, 0), RadiusRatio = 0.7, StartParameter = 0, EndParameter = 2 * Math.PI });
        var set = B("ΣΕΤ ΛΟΥΤΡΟΥ", new Insert(wc) { InsertPoint = new XYZ(0, 0, 0) }, new Insert(basin) { InsertPoint = new XYZ(800, 0, 0) }, Cad.Rect(1600, 0, 1700, 750));
        doc.Entities.Add(new Insert(set) { InsertPoint = new XYZ(11700, 8850, 0), Rotation = Math.PI }.On(doc, "ΥΓΙΕΙΝΗ"));
        var lamp = B("ΦΩΤΙΣΤΙΚΟ", new Circle { Center = new XYZ(0, 0, 0), Radius = 150 }, Cad.Line(-150, 0, 150, 0), Cad.Line(0, -150, 0, 150));
        doc.Entities.Add(new Insert(lamp) { InsertPoint = new XYZ(1500, 1500, 0), RowCount = 2, ColumnCount = 3, RowSpacing = 2000, ColumnSpacing = 2000 }.On(doc, "ΦΩΤΙΣΜΟΣ"));
        doc.Entities.Add(new Insert(lamp) { InsertPoint = new XYZ(9500, 2500, 0) }.On(doc, "ΦΩΤΙΣΜΟΣ"));
        return doc;
    }

    [Fact]
    public void The_example_plan_shows_every_table()
    {
        if (Environment.GetEnvironmentVariable("DWGQ_WRITE_EXAMPLE") == "1")
        {
            Directory.CreateDirectory(Path.GetDirectoryName(File));
            System.IO.File.WriteAllBytes(File, Cad.Bytes(Plan(), true));
        }
        var r = Quantities.Run(System.IO.File.ReadAllBytes(File), new Settings());
        Assert.Equal("mm", r.Units);
        Assert.Equal(24 + 20 + 22 + 18 + 1.6, r.Layer("ΤΟΙΧΟΙ").Len, 6);                                   // 4 rooms + the column
        Assert.Equal(108.16, r.Layer("ΤΟΙΧΟΙ").Area, 6);
        Assert.Equal(108 - 0.16, r.Layer("ΔΑΠΕΔΑ").HatchArea, 6);                                          // floors minus the column
        Assert.Equal(4, r.Layer("ΔΑΠΕΔΑ").HatchCount);
        Assert.Equal(5, r.Blocks.Where(b => b.Name == "ΠΑΡΑΘΥΡΟ").Sum(b => b.Count));                     // four windows and the stretched one
        Assert.Equal(7, r.Blocks.Where(b => b.Name == "ΦΩΤΙΣΤΙΚΟ").Sum(b => b.Count));                     // an array of 6 and one more
        Assert.Equal(1, r.Blocks.Single(b => b.Name == "ΛΕΚΑΝΗ").Nested);
        Assert.Equal("ΥΓΙΕΙΝΗ", r.Blocks.Single(b => b.Name == "ΛΕΚΑΝΗ").Layer);
        Assert.Equal(2, r.Schedules.Count);
        Assert.Equal(4, r.Schedules.Single(s => s.Block == "ΠΑΡΑΘΥΡΟ").Rows.Single(x => x.Values[0] == "Π1").Count);
        Assert.Equal(4, r.NotMeasured.Text);
        Assert.DoesNotContain(r.Warnings, w => w.Id == "units-assumed");
    }
}
```


Run:
```bash
node _tests/extract.mjs $PLAN _src/dwg-engine/Tests/Fixtures.cs && node _tests/extract.mjs $PLAN _src/dwg-engine/Tests/Examples.cs
dotnet test _src/dwg-engine/Tests 2>&1 | tail -1
```
Expected: `Failed!  - Failed:     2, Passed:    43, …`: the committed files don't exist yet (`FileNotFoundException`).

- [ ] **Step 2: Generate the files**

Run:
```bash
DWGQ_WRITE_FIXTURES=1 DWGQ_WRITE_EXAMPLE=1 dotnet test _src/dwg-engine/Tests 2>&1 | tail -1
ls _tests/dwg/fixtures js/dwg/examples
grep -c '"' _tests/dwg/fixtures/expected.json
```
Expected: `Passed: 45`; seven fixture files and `example-plan.dwg`. `expected.json` holds, among others:
- `"ΤΟΙΧΟΙ|32|2|32|2|0|0|0"` and `"ΔΑΠΕΔΑ|0|0|0|0|19.84|1|0"` for both `rooms` files (the 2004 DXF read from Windows-1253 bytes);
- `"WINDOW|WINDOWS|4|0"` and `"WC|SANITARY|0|4"` for both `blocks` files;
- `"ELLIPSE|3.875379|1|1.00531|1|0|0|0"` and `"BAD|0.965685|1|0|0|0|0|1"` for `curves.dwg`.

- [ ] **Step 3: Run the tests against the committed files**

Run: `dotnet test _src/dwg-engine/Tests 2>&1 | tail -1`
Expected: `Passed: 45`, with no environment variables set.

- [ ] **Step 4: Commit**

```bash
git add _src/dwg-engine/Tests _tests/dwg/fixtures js/dwg/examples
git commit -F - <<'EOF'
DWG quantities: golden fixtures and the example drawing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 4: The browser engine and the feasibility gate

This task is the spec's feasibility gate (§11). If any check in Step 4 fails, stop: work does not continue until the fallback is decided with Aris.

**Files:**
- Create: `_src/dwg-engine/Host/Host.csproj`, `_src/dwg-engine/Host/Program.cs`, `_src/dwg-engine/publish.ps1`, `js/dwg/worker.js`
- Create: `_tests/dwg/parity.html`, `_tests/dwg/perf.html`, `_tests/dwg/browser-check.cjs`
- Generate: `js/dwg/engine/*` (108 files)

**Interfaces:**
- Produces:
  - `[JSExport] Api.Quantities(byte[] bytes, string name, string settingsJson) → string` (settings `{ units, override }`).
  - The worker answers `{ type: 'process', id, name, bytes, settings }` with the result (plus `id`) or `{ type: 'error', id, reason: 'engine', message }`; it posts `boot-progress { pct }`, `ready` and `progress`. It is the message `js/laser/bridge.js` sends.
  - `node _tests/dwg/browser-check.cjs [page|parity|perf]`.

- [ ] **Step 1: Write the host, the publish script and the worker**

<!-- file: _src/dwg-engine/Host/Host.csproj -->
```xml
<Project Sdk="Microsoft.NET.Sdk.WebAssembly">
  <!-- The browser engine: a headless .NET WebAssembly module run inside a Web Worker (spec §3); its trimming setup is the laser engine’s. -->
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <OutputType>Exe</OutputType>
    <AllowUnsafeBlocks>true</AllowUnsafeBlocks>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>disable</Nullable>
    <AssemblyName>AidedCam.Dwg.Host</AssemblyName>
    <PublishTrimmed>true</PublishTrimmed>
    <InvariantGlobalization>true</InvariantGlobalization>
    <UseSystemResourceKeys>false</UseSystemResourceKeys>
    <!-- No PDB: otherwise its build path (a local user folder) is embedded in the published assemblies. -->
    <DebugType>none</DebugType>
    <!-- The trimmer rewrites every assembly that ships a PDB (ours and some packages) and would point it at a
         PDB under obj/, embedding that path too; strip the symbols instead. -->
    <TrimmerRemoveSymbols>true</TrimmerRemoveSymbols>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="..\Engine\Engine.csproj" />
  </ItemGroup>
  <!-- The obfuscated Eyeshot DLL resolves types by name at run time, and its start-up reads the .NET
       configuration system; trimming must keep these whole or the reader fails to start. -->
  <ItemGroup>
    <TrimmerRootAssembly Include="System.Runtime" />
    <TrimmerRootAssembly Include="mscorlib" />
    <TrimmerRootAssembly Include="devDept.Eyeshot.v2026" />
    <TrimmerRootAssembly Include="System.Configuration.ConfigurationManager" />
    <TrimmerRootAssembly Include="ACadSharp" />
  </ItemGroup>
</Project>
```

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

<!-- file: _src/dwg-engine/publish.ps1 -->
```powershell
# Publishes the browser engine and copies it to js/dwg/engine/ (spec §3). Run from the repo root:
#   powershell -ExecutionPolicy Bypass -File _src/dwg-engine/publish.ps1
# Only the JavaScript modules and the gzip copies are kept: the worker unpacks each .wasm itself.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$out = Join-Path $env:TEMP 'aidedcam-dwg-publish'
if (Test-Path $out) { Remove-Item -Recurse -Force $out }
dotnet publish (Join-Path $PSScriptRoot 'Host/Host.csproj') -c Release -o $out -v q
if ($LASTEXITCODE -ne 0) { throw 'dotnet publish failed' }
$fw = Join-Path $out 'wwwroot/_framework'
$dest = Join-Path $root 'js/dwg/engine'
if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
New-Item -ItemType Directory -Force $dest | Out-Null
Get-ChildItem $fw -File |
    Where-Object { ($_.Name -like '*.js') -or ($_.Name -like '*.gz' -and $_.Name -notlike '*.js.gz') } |
    Copy-Item -Destination $dest
$gz = Get-ChildItem $dest -File -Filter '*.gz'
$bytes = ($gz | Measure-Object Length -Sum).Sum
# The worker shows download progress against these totals.
'{{"files":{0},"bytes":{1}}}' -f $gz.Count, $bytes | Set-Content -Encoding ascii (Join-Path $dest 'manifest.json')
$all = Get-ChildItem $dest -File
'{0} files, {1:N1} MB in js/dwg/engine' -f $all.Count, (($all | Measure-Object Length -Sum).Sum / 1MB)
```

<!-- file: js/dwg/worker.js -->
```js
// The DWG quantities engine's worker (spec §3), built like the laser engine's: on the first message it boots
// the .NET runtime from ./engine/, fetching each .wasm as its gzip copy and unpacking it with the browser's
// DecompressionStream, so any static host works. Then it measures one file per 'process' message (the
// message the shared js/laser/bridge.js sends).
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
    self.postMessage({ type: 'progress', id: m.id, stage: 'measuring' });
    const result = JSON.parse(engine.Quantities(new Uint8Array(m.bytes), m.name, JSON.stringify(m.settings || {})));
    result.id = m.id;
    self.postMessage(result);
  } catch (err) {
    self.postMessage({ type: 'error', id: m.id, reason: 'engine', message: String((err && err.message) || err) });
  }
};
```


Run: `for f in _src/dwg-engine/Host/Host.csproj _src/dwg-engine/Host/Program.cs _src/dwg-engine/publish.ps1 js/dwg/worker.js; do node _tests/extract.mjs $PLAN $f; done`

- [ ] **Step 2: Publish**

Run: `powershell.exe -ExecutionPolicy Bypass -File _src/dwg-engine/publish.ps1 2>&1 | tail -1`
Expected: `108 files, 11.4 MB in js/dwg/engine` (trim warnings from Eyeshot's dependencies are normal).

Check that no local path leaked into the published files:
```bash
for f in js/dwg/engine/*.gz; do zcat "$f" | grep -a -q -i 'Users\\\\\|/Users/\|scratchpad' && echo "LEAK $f"; done; echo scan-done
```
Expected: only `scan-done`.

- [ ] **Step 3: Write the browser checks**

<!-- file: _tests/dwg/parity.html -->
```html
<!doctype html>
<!-- Dev-only (Jekyll skips _tests): runs every parity fixture through the published browser engine and
     compares with the desktop results in fixtures/expected.json (spec §9, §11). window.__parity holds the
     outcome, window.__timings the milliseconds per file. -->
<meta charset="utf-8"><link rel="icon" href="data:,"><title>dwg engine parity</title><pre id="out">running…</pre>
<script type="module">
const expected = await (await fetch('./fixtures/expected.json')).json();
const r6 = v => Math.round(v * 1e6) / 1e6;
// The same summary as Fixtures.Summary in the C# tests (numbers printed the way .NET prints a double).
function summary(m) {
  return {
    units: `${m.file.units}/${m.file.unitsSource}`,
    layers: m.layers.map(l => [l.name, r6(l.len), l.lenCount, r6(l.area), l.areaCount, r6(l.hatchArea), l.hatchCount, l.bad].join('|')),
    blocks: m.blocks.map(b => [b.name, b.layer, b.count, b.nested].join('|')),
    schedules: m.schedules.flatMap(s => s.rows.map(row => [s.block, s.tags.join(','), row.values.join(','), row.count].join('|'))),
    items: m.items.length,
    notMeasured: [m.notMeasured.text, m.notMeasured.dim, m.notMeasured.other, m.notMeasured.insideBlocks].join('|'),
    warnings: m.warnings.map(w => w.id),
  };
}
function same(a, b, path, out) {
  if (Array.isArray(a) || (a && typeof a === 'object')) {
    const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    for (const k of keys) same(a?.[k], b?.[k], `${path}.${k}`, out);
    return;
  }
  if (a !== b) out.push(`${path}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
}
const w = new Worker('../../js/dwg/worker.js', { type: 'module' });
const pending = new Map();
w.onmessage = e => { const m = e.data; if ((m.type === 'result' || m.type === 'error') && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const run = (id, name, bytes) => new Promise(res => { pending.set(id, res); w.postMessage({ type: 'process', id, name, bytes, settings: {} }, [bytes]); });
const results = {}, timings = {};
let id = 0;
for (const name of Object.keys(expected)) {
  const bytes = await (await fetch('./fixtures/' + name)).arrayBuffer();
  const t0 = performance.now();
  const m = await run(++id, name, bytes);
  timings[name] = Math.round(performance.now() - t0);
  const diffs = [];
  if (m.type !== 'result') diffs.push(`engine error: ${m.reason} ${m.message}`);
  else same(summary(m), expected[name], name, diffs);
  results[name] = diffs;
}
const failed = Object.entries(results).filter(([, d]) => d.length);
window.__timings = timings;
window.__parity = { files: Object.keys(results).length, failed: failed.length, diffs: failed };
document.getElementById('out').textContent = JSON.stringify({ ...window.__parity, timings }, null, 1);
</script>
```

<!-- file: _tests/dwg/perf.html -->
```html
<!doctype html>
<!-- Dev-only (Jekyll skips _tests): times the published engine on a generated building-sized DXF (spec §7, §8).
     ?n=50000 sets the entity count. window.__perf holds { n, ms, items, jsonKB, simplified }. -->
<meta charset="utf-8"><link rel="icon" href="data:,"><title>dwg engine perf</title><pre id="out">running…</pre>
<script type="module">
const n = Number(new URLSearchParams(location.search).get('n') || 50000);
// A grid of "rooms": per room a closed polyline, a door arc, a pipe line and a fixture circle, plus one block
// insert per room. Plain DXF text, so the page needs no fixture file. It has no LAYER table, so ACadSharp puts
// every entity on layer 0; that does not change the timing.
const out = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1015', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC',
  '0', 'SECTION', '2', 'BLOCKS', '0', 'BLOCK', '8', '0', '2', 'WC', '70', '0', '10', '0', '20', '0', '30', '0', '3', 'WC',
  '0', 'CIRCLE', '8', '0', '10', '0', '20', '0', '30', '0', '40', '200', '0', 'ENDBLK', '8', '0', '0', 'ENDSEC',
  '0', 'SECTION', '2', 'ENTITIES'];
const per = 5, rooms = Math.ceil(n / per), side = Math.ceil(Math.sqrt(rooms));
for (let i = 0; i < rooms; i++) {
  const x = (i % side) * 5000, y = Math.floor(i / side) * 4000;
  out.push('0', 'LWPOLYLINE', '8', 'WALLS', '90', '4', '70', '1',
    '10', x, '20', y, '10', x + 4800, '20', y, '10', x + 4800, '20', y + 3800, '10', x, '20', y + 3800);
  out.push('0', 'ARC', '8', 'DOORS', '10', x, '20', y, '30', '0', '40', '900', '50', '0', '51', '90');
  out.push('0', 'LINE', '8', 'PIPE', '10', x + 100, '20', y + 100, '30', '0', '11', x + 4700, '21', y + 100, '31', '0');
  out.push('0', 'CIRCLE', '8', 'FIXTURES', '10', x + 2400, '20', y + 1900, '30', '0', '40', '150');
  out.push('0', 'INSERT', '8', 'SANITARY', '2', 'WC', '10', x + 600, '20', y + 3000, '30', '0');
}
out.push('0', 'ENDSEC', '0', 'EOF');
const bytes = new TextEncoder().encode(out.join('\r\n') + '\r\n').buffer;
const w = new Worker('../../js/dwg/worker.js', { type: 'module' });
const warm = new TextEncoder().encode(['0', 'SECTION', '2', 'ENTITIES', '0', 'LINE', '8', '0', '10', '0', '20', '0', '30', '0', '11', '1', '21', '0', '31', '0', '0', 'ENDSEC', '0', 'EOF'].join('\r\n') + '\r\n').buffer;
let t0 = 0;
w.onmessage = e => {
  const m = e.data;
  if (m.type !== 'result' && m.type !== 'error') return;
  if (m.id === 1) { t0 = performance.now(); w.postMessage({ type: 'process', id: 2, name: 'perf.dxf', bytes, settings: {} }, [bytes]); return; }
  const ms = Math.round(performance.now() - t0);
  window.__perf = m.type === 'result'
    ? { n: rooms * per, bytesKB: Math.round(out.join('\r\n').length / 1024), ms, items: m.items.length, jsonKB: Math.round(JSON.stringify(m).length / 1024), simplified: m.simplified }
    : { n: rooms * per, ms, error: m.reason + ' ' + m.message };
  document.getElementById('out').textContent = JSON.stringify(window.__perf, null, 1);
};
w.postMessage({ type: 'process', id: 1, name: 'warm.dxf', bytes: warm, settings: {} }, [warm]);   // boot first: time the file alone
</script>
```

<!-- file: _tests/dwg/browser-check.cjs -->
```js
// Runs the browser checks in headless Chrome, for when the Playwright MCP is unavailable. Needs the repo root
// served on http://127.0.0.1:8765/, and playwright-core somewhere on this machine:
//   node _tests/dwg/browser-check.cjs            the page checks in browser-check.js (plan Task 14)
//   node _tests/dwg/browser-check.cjs parity     only the desktop–browser parity page (plan Task 4)
//   node _tests/dwg/browser-check.cjs perf       the timing page at 10,000 and 50,000 entities (plan Task 4)
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
  const page = await (await browser.newContext({ acceptDownloads: true })).newPage();
  const mode = process.argv[2] || 'page';
  const BASE = 'http://127.0.0.1:8765/_tests/dwg/';
  const fns = {
    page: p => eval(fs.readFileSync(path.join(__dirname, 'browser-check.js'), 'utf8'))(p),   // arrives in Task 14
    async parity(p) {
      await p.goto(BASE + 'parity.html');
      await p.waitForFunction(() => window.__parity, null, { timeout: 120000 });
      const r = await p.evaluate(() => ({ parity: window.__parity, ms: window.__timings }));
      const ok = r.parity.files === 6 && r.parity.failed === 0;
      return { pass: ok ? 1 : 0, fail: ok ? 0 : 1, checks: [{ name: `parity ${JSON.stringify(r)}`, ok, got: r }] };
    },
    async perf(p) {
      const checks = [];
      for (const n of [10000, 50000]) {
        await p.goto(BASE + `perf.html?n=${n}`);
        await p.waitForFunction(() => window.__perf, null, { timeout: 180000 });
        const r = await p.evaluate(() => window.__perf);
        checks.push({ name: `perf ${JSON.stringify(r)}`, ok: !r.error && r.items === n, got: r });
      }
      return { pass: checks.filter(c => c.ok).length, fail: checks.filter(c => !c.ok).length, checks };
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


Run: `for f in _tests/dwg/parity.html _tests/dwg/perf.html _tests/dwg/browser-check.cjs; do node _tests/extract.mjs $PLAN $f; done`

`browser-check.cjs` loads `browser-check.js` only in its default mode, which arrives in Task 14.

- [ ] **Step 4: The gate, in the browser**

Serve the repo root in a second terminal (keep it running for Tasks 4–14): `python -m http.server 8765 --bind 127.0.0.1`

Run: `node _tests/dwg/browser-check.cjs parity && node _tests/dwg/browser-check.cjs perf`
(or, with the Playwright MCP: open `http://127.0.0.1:8765/_tests/dwg/parity.html` and read `window.__parity`, then `perf.html?n=10000` and `?n=50000` and read `window.__perf`).

Expected:
1. `PASS  parity {"parity":{"files":6,"failed":0,…}` — the WebAssembly engine boots in the worker and measures every fixture exactly as the desktop does, including the Windows-1253 DXFs and the Eyeshot spline.
2. `PASS  perf {"n":10000,…,"ms":…}` about 1,700 ms, and `n: 50000` between 13,000 and 25,000 ms, `simplified: false`.
3. No request left the local server: with the MCP, `browser_network_requests` (static, filter `^(?!http://127\.0\.0\.1:8765/)`) returns nothing; the Node runner's page check repeats this in Task 14.

- [ ] **Step 5: Commit**

```bash
git add _src/dwg-engine js/dwg/worker.js js/dwg/engine _tests/dwg/parity.html _tests/dwg/perf.html _tests/dwg/browser-check.cjs
git commit -F - <<'EOF'
DWG quantities: browser engine (WebAssembly host, worker, published runtime) and parity checks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 5: Tables and the summary across files

**Files:**
- Create: `js/dwg/tables.js`
- Test: `_tests/dwg/tables.test.js`

**Interfaces:**
- Consumes: the result contract (Task 2).
- Produces: `layerRows(result)`, `layerTotals(rows) → { len, lenCount, area, areaCount, hatchArea, hatchCount, bad }`, `blockRows(result)`, `blockTotals(rows) → { count, nested }`, `summary(files: [{ name, result }]) → { layers, blocks, missing: [name], partial }`, `notMeasuredCount(nm)`, `cmpName(a, b)`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/dwg/tables.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layerRows, layerTotals, blockRows, blockTotals, summary, notMeasuredCount, cmpName } from '../../js/dwg/tables.js';

const L = (name, o = {}) => ({ name, color: '#ffffff', off: false, frozen: false, len: 0, lenCount: 0, area: 0, areaCount: 0, hatchArea: 0, hatchCount: 0, bad: 0, ...o });
const res = (layers, blocks = []) => ({ type: 'result', layers, blocks, schedules: [], items: [], notMeasured: {} });

test('layer rows keep the engine order and default missing numbers to 0', () => {
  const rows = layerRows(res([L('A', { len: 2.5, lenCount: 3 }), { name: 'B', color: '#ff0000' }]));
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[1], L('B', { color: '#ff0000' }));
  assert.equal(rows[0].len, 2.5);
});

test('layer totals add every numeric column', () => {
  const t = layerTotals([L('A', { len: 1, lenCount: 2, area: 3, areaCount: 1, hatchArea: 4, hatchCount: 2, bad: 1 }), L('B', { len: 0.5, lenCount: 1, bad: 2 })]);
  assert.deepEqual(t, { len: 1.5, lenCount: 3, area: 3, areaCount: 1, hatchArea: 4, hatchCount: 2, bad: 3 });
});

test('block rows and totals', () => {
  const rows = blockRows(res([], [{ name: 'W1', layer: 'WIN', count: 8, nested: 0 }, { name: 'WC', layer: '0', count: 0, nested: 4 }]));
  assert.equal(rows.length, 2);
  assert.deepEqual(blockTotals(rows), { count: 8, nested: 4 });
});

test('summary merges layers by name and blocks by name and layer, across files', () => {
  const f1 = { name: 'a.dwg', result: res([L('PIPE', { len: 10, lenCount: 2, off: true }), L('WALL', { area: 5, areaCount: 1, frozen: true })], [{ name: 'W1', layer: 'WIN', count: 2, nested: 0 }]) };
  const f2 = { name: 'b.dxf', result: res([L('PIPE', { len: 5, lenCount: 1, off: false, color: '#00ff00' }), L('wall', { area: 1, areaCount: 1, frozen: true })], [{ name: 'W1', layer: 'WIN', count: 3, nested: 1 }, { name: 'W1', layer: '0', count: 1, nested: 0 }]) };
  const s = summary([f1, f2]);
  assert.equal(s.partial, false);
  assert.deepEqual(s.missing, []);
  const pipe = s.layers.find(l => l.name === 'PIPE');
  assert.equal(pipe.len, 15);
  assert.equal(pipe.lenCount, 3);
  assert.equal(pipe.color, '#ffffff', 'colour of the first file');
  assert.equal(pipe.off, false, 'off only if off everywhere');
  assert.deepEqual(s.layers.map(l => l.name), ['PIPE', 'WALL', 'wall'], 'names are case-sensitive keys, sorted case-insensitively');
  assert.equal(s.layers.find(l => l.name === 'WALL').frozen, true);
  assert.deepEqual(s.blocks, [{ name: 'W1', layer: '0', count: 1, nested: 0 }, { name: 'W1', layer: 'WIN', count: 5, nested: 1 }]);
});

test('a failed file makes the summary partial and is named', () => {
  const s = summary([{ name: 'ok.dwg', result: res([L('A', { len: 1, lenCount: 1 })]) }, { name: 'bad.dwg', result: { type: 'error', reason: 'read' } }]);
  assert.equal(s.partial, true);
  assert.deepEqual(s.missing, ['bad.dwg']);
  assert.equal(s.layers[0].len, 1);
});

test('not-measured count leaves out the geometry inside blocks', () => {
  assert.equal(notMeasuredCount({ text: 3, dim: 2, solid3d: 1, mesh: 0, proxy: 1, other: 4, insideBlocks: 100 }), 11);
  assert.equal(notMeasuredCount(undefined), 0);
});

test('names sort ordinally without case, like the engine', () => {
  assert.deepEqual(['b', 'A', 'a', 'Β', '_x', '0'].sort(cmpName), ['0', 'A', 'a', 'b', '_x', 'Β']);
});
```


Run: `node _tests/extract.mjs $PLAN _tests/dwg/tables.test.js && node --test "_tests/dwg/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ fail 1` (the module is missing).

- [ ] **Step 2: Write the module**

<!-- file: js/dwg/tables.js -->
```js
// DWG quantities: the rows behind the on-screen tables and the workbook (spec §5), from the engine's
// result JSON. Lengths in m, areas in m². Pure: no DOM, so the Node tests and the .xlsx writer share it.

const isOk = r => r && r.type === 'result';

const LAYER_SUMS = ['len', 'lenCount', 'area', 'areaCount', 'hatchArea', 'hatchCount', 'bad'];

// One row per layer, in the engine's order (sorted by name).
export function layerRows(result) {
  return (result.layers || []).map(l => ({
    name: l.name, color: l.color, off: !!l.off, frozen: !!l.frozen,
    len: l.len || 0, lenCount: l.lenCount || 0, area: l.area || 0, areaCount: l.areaCount || 0,
    hatchArea: l.hatchArea || 0, hatchCount: l.hatchCount || 0, bad: l.bad || 0,
  }));
}

export function layerTotals(rows) {
  const t = Object.fromEntries(LAYER_SUMS.map(k => [k, 0]));
  for (const r of rows) for (const k of LAYER_SUMS) t[k] += r[k] || 0;
  return t;
}

// One row per block name and layer, in the engine's order (by name, then layer).
export function blockRows(result) {
  return (result.blocks || []).map(b => ({ name: b.name, layer: b.layer, count: b.count || 0, nested: b.nested || 0 }));
}

export function blockTotals(rows) {
  let count = 0, nested = 0;
  for (const r of rows) { count += r.count; nested += r.nested; }
  return { count, nested };
}

// Ordinal and case-insensitive, like the engine's sort, then exact case as the tie-break.
export function cmpName(a, b) {
  const A = a.toUpperCase(), B = b.toUpperCase();
  return A < B ? -1 : A > B ? 1 : a < b ? -1 : a > b ? 1 : 0;
}

// Totals across a batch (spec §5 Summary). Layers are merged by name, blocks by name and layer. A file
// that failed is listed in `missing`, and the totals are then minimums ("≥", spec §8).
export function summary(files) {
  const layers = new Map(), blocks = new Map(), missing = [];
  for (const f of files) {
    if (!isOk(f.result)) { missing.push(f.name); continue; }
    for (const r of layerRows(f.result)) {
      const cur = layers.get(r.name);
      if (!cur) { layers.set(r.name, { ...r }); continue; }
      for (const k of LAYER_SUMS) cur[k] += r[k];
      cur.off = cur.off && r.off;                                    // off only if off in every file that has it
      cur.frozen = cur.frozen && r.frozen;
    }
    for (const r of blockRows(f.result)) {
      const key = r.name + '\u0000' + r.layer;
      const cur = blocks.get(key);
      if (!cur) blocks.set(key, { ...r });
      else { cur.count += r.count; cur.nested += r.nested; }
    }
  }
  const blockList = [...blocks.values()].sort((a, b) => cmpName(a.name, b.name) || cmpName(a.layer, b.layer));
  const layerList = [...layers.values()].sort((a, b) => cmpName(a.name, b.name));
  return { layers: layerList, blocks: blockList, missing, partial: missing.length > 0 };
}

// Everything the engine counted but did not measure; blocks' inner geometry has its own notice.
export function notMeasuredCount(nm) {
  let n = 0;
  for (const [k, v] of Object.entries(nm || {})) if (k !== 'insideBlocks' && typeof v === 'number') n += v;
  return n;
}
```


Run: `node _tests/extract.mjs $PLAN js/dwg/tables.js && node --test "_tests/dwg/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 7`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/dwg/tables.js _tests/dwg/tables.test.js
git commit -F - <<'EOF'
DWG quantities: layer and block tables, summary across files

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 6: Selection

**Files:**
- Create: `js/dwg/selection.js`
- Test: `_tests/dwg/selection.test.js`

**Interfaces:**
- Consumes: `items[]` of the result contract.
- Produces: `createIndex(items, cellSize?) → { query(x0, y0, x1, y1) → indices, bboxOf(i) }`, `pick(index, items, x, y, tol) → i | -1`, `selectBox(index, items, x0, y0, x1, y1, 'window' | 'crossing') → sorted indices`, `selectionTotals(items, indices) → { layers: [{ name, len, area, hatchArea, bad }], blocks: [{ name, count }], items }`, `selectionTsv(totals, t) → string`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/dwg/selection.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIndex, pick, selectBox, selectionTotals, selectionTsv } from '../../js/dwg/selection.js';

const line = (id, layer, x0, y0, x1, y1) => ({ id, layer, kind: 'line', len: Math.hypot(x1 - x0, y1 - y0), area: 0, block: null, copies: 1, bad: false, path: [[x0, y0, x1, y1]] });
const rect = (id, layer, x, y, w, h, kind = 'polyline', extra = {}) => ({
  id, layer, kind, len: kind === 'hatch' ? 0 : 2 * (w + h), area: w * h, block: null, copies: 1, bad: false,
  path: [[x, y, x + w, y, x + w, y + h, x, y + h, x, y]], ...extra,
});
const insert = (id, layer, block, x, y, copies = 1) => ({ id, layer, kind: 'insert', len: 0, area: 0, block, copies, bad: false, path: [[x, y, x + 1, y + 1], [x + 1, y, x, y + 1]] });

// A small plan: a pipe, a room outline with its hatch, an island hatch, two window blocks.
function plan() {
  return [
    line('A', 'PIPE', 0, 0, 10, 0),                                                            // 0
    rect('B', 'ROOM', 2, 2, 6, 4),                                                             // 1
    { ...rect('C', 'HATCH', 2, 2, 6, 4, 'hatch'), area: 24 - 1, path: [[2, 2, 8, 2, 8, 6, 2, 6, 2, 2], [4, 3, 5, 3, 5, 4, 4, 4, 4, 3]] },  // 2, with a 1×1 island
    insert('D', 'WIN', 'W1', 20, 0),                                                          // 3
    insert('E', 'WIN', 'W1', 22, 0, 6),                                                       // 4 (an array of 6)
    { ...rect('F', 'ROOM', 30, 0, 2, 2), bad: true, area: 0 },                                 // 5
  ];
}

test('pick: the nearest edge within the tolerance', () => {
  const items = plan(), ix = createIndex(items);
  assert.equal(pick(ix, items, 5, 0.05, 0.1), 0);
  assert.equal(pick(ix, items, 5, 1, 0.1), -1);
  assert.equal(pick(ix, items, 20.5, 0.5, 0.1), 3);
});

test('pick: inside a filled item, the smallest one wins; an island is a hole', () => {
  const items = plan(), ix = createIndex(items);
  // (3, 5) is inside the room outline (24 m²) and inside the hatch (23 m²): the hatch is smaller.
  assert.equal(pick(ix, items, 3, 5, 0.1), 2);
  // (4.5, 3.5) is in the hatch's island: only the room outline contains it.
  assert.equal(pick(ix, items, 4.5, 3.5, 0.1), 1);
  // A bad item has no trusted area, so it is not picked from inside.
  assert.equal(pick(ix, items, 31, 1, 0.1), -1);
});

test('window selects only items fully inside; crossing also takes what the box touches', () => {
  const items = plan(), ix = createIndex(items);
  assert.deepEqual(selectBox(ix, items, 1, 1, 9, 7, 'window'), [1, 2]);
  assert.deepEqual(selectBox(ix, items, 9, 7, 1, 1, 'window'), [1, 2], 'corners in any order');
  assert.deepEqual(selectBox(ix, items, 5, -1, 6, 2.5, 'crossing'), [0, 1, 2]);
  // A box inside the hatch but not touching any edge still crosses the hatch and the room.
  assert.deepEqual(selectBox(ix, items, 6, 4.5, 7, 5, 'crossing'), [1, 2]);
  // A box inside the island crosses only the room (its point is not in the hatch).
  assert.deepEqual(selectBox(ix, items, 4.2, 3.2, 4.8, 3.8, 'crossing'), [1]);
});

test('selection totals: lengths and areas per layer, hatch areas apart, blocks by name with copies', () => {
  const items = plan();
  const t = selectionTotals(items, [0, 1, 2, 3, 4, 5]);
  assert.equal(t.items, 6);
  assert.deepEqual(t.layers, [
    { name: 'HATCH', len: 0, area: 0, hatchArea: 23, bad: 0 },
    { name: 'PIPE', len: 10, area: 0, hatchArea: 0, bad: 0 },
    { name: 'ROOM', len: 28, area: 24, hatchArea: 0, bad: 1 },
  ]);
  assert.deepEqual(t.blocks, [{ name: 'W1', count: 7 }]);
});

test('the copied text is tab-separated with a point decimal and totals', () => {
  const items = plan();
  const tsv = selectionTsv(selectionTotals(items, [0, 1, 3]), k => k);
  assert.equal(tsv,
    'dq.col.layer\tdq.col.len\tdq.col.area\tdq.col.hatchArea\n'
    + 'PIPE\t10.000\t0.000\t0.000\n'
    + 'ROOM\t20.000\t24.000\t0.000\n'
    + 'dq.total\t30.000\t24.000\t0.000\n'
    + '\n'
    + 'dq.col.block\tdq.col.count\n'
    + 'W1\t1\n');
});

// A tiny deterministic generator, so a failure repeats.
function rng(seed) { return () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); }

test('the grid finds exactly what a brute-force scan finds, on 2,000 random items', () => {
  const r = rng(7), items = [];
  for (let i = 0; i < 2000; i++) {
    const x = r() * 1000, y = r() * 500, k = r();
    if (k < 0.5) items.push(line(String(i), 'L', x, y, x + (r() - 0.5) * 40, y + (r() - 0.5) * 40));
    else if (k < 0.9) items.push(rect(String(i), 'R', x, y, r() * 30 + 0.01, r() * 30 + 0.01));
    else items.push(rect(String(i), 'H', x, y, r() * 400, r() * 300, 'hatch'));     // a few big ones
  }
  const ix = createIndex(items, 5);                                                   // small cells: big items go to the "always" list
  const all = { query: () => items.map((_, i) => i), bboxOf: i => ix.bboxOf(i) };
  for (let q = 0; q < 200; q++) {
    const x0 = r() * 1100 - 50, y0 = r() * 600 - 50, x1 = x0 + r() * 200, y1 = y0 + r() * 200;
    for (const mode of ['window', 'crossing']) {
      assert.deepEqual(selectBox(ix, items, x0, y0, x1, y1, mode), selectBox(all, items, x0, y0, x1, y1, mode), `${mode} box ${q}`);
    }
    const px = r() * 1000, py = r() * 500;
    assert.equal(pick(ix, items, px, py, 2), pick(all, items, px, py, 2), `pick ${q}`);
  }
});

test('an empty drawing or a zero-size one does not break the index', () => {
  assert.deepEqual(createIndex([]).query(0, 0, 1, 1), []);
  const pt = [line('p', 'L', 3, 3, 3, 3)];
  const ix = createIndex(pt);
  assert.deepEqual(ix.query(2, 2, 4, 4), [0]);
  assert.equal(pick(ix, pt, 3, 3, 0.1), 0);
});
```


Run: `node _tests/extract.mjs $PLAN _tests/dwg/selection.test.js && node --test "_tests/dwg/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 7`, `ℹ fail 1`.

- [ ] **Step 2: Write the module**

<!-- file: js/dwg/selection.js -->
```js
// DWG quantities: picking in the drawing and the totals of a selection (spec §5 Selection). Everything
// works on the engine's items[] in drawing coordinates (m), so a selection never calls the engine.
// Pure: no DOM. A uniform grid over the items' bounding boxes keeps hit-tests fast on large drawings.
import { cmpName } from './tables.js';

const CURVES = new Set(['line', 'arc', 'circle', 'polyline', 'spline', 'ellipse']);
const MAX_CELLS_PER_ITEM = 4096;          // bigger items (a site boundary, a big hatch) are always candidates

function pathBox(path) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const pl of path || []) for (let i = 0; i + 1 < pl.length; i += 2) {
    const x = pl[i], y = pl[i + 1];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x0 <= x1 ? [x0, y0, x1, y1] : null;
}

// The grid. cellSize defaults to 1/64 of the drawing's larger side.
export function createIndex(items, cellSize) {
  const boxes = items.map(it => pathBox(it.path));
  let X0 = Infinity, Y0 = Infinity, X1 = -Infinity, Y1 = -Infinity;
  for (const b of boxes) if (b) { X0 = Math.min(X0, b[0]); Y0 = Math.min(Y0, b[1]); X1 = Math.max(X1, b[2]); Y1 = Math.max(Y1, b[3]); }
  if (!(X0 <= X1)) { X0 = Y0 = 0; X1 = Y1 = 1; }
  let cell = cellSize > 0 ? cellSize : Math.max(X1 - X0, Y1 - Y0) / 64;
  if (!(cell > 0)) cell = 1;
  const nx = Math.max(1, Math.floor((X1 - X0) / cell) + 1), ny = Math.max(1, Math.floor((Y1 - Y0) / cell) + 1);
  const cells = new Map(), big = [];
  const cx = x => Math.min(nx - 1, Math.max(0, Math.floor((x - X0) / cell)));
  const cy = y => Math.min(ny - 1, Math.max(0, Math.floor((y - Y0) / cell)));
  boxes.forEach((b, i) => {
    if (!b) return;
    const i0 = cx(b[0]), i1 = cx(b[2]), j0 = cy(b[1]), j1 = cy(b[3]);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > MAX_CELLS_PER_ITEM) { big.push(i); return; }
    for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) {
      const key = j * nx + k;
      const list = cells.get(key);
      if (list) list.push(i); else cells.set(key, [i]);
    }
  });
  const stamp = new Int32Array(items.length);
  let q = 0;
  return {
    // Candidate items whose box may touch the rectangle (deduplicated).
    query(x0, y0, x1, y1) {
      if (x0 > x1) [x0, x1] = [x1, x0];
      if (y0 > y1) [y0, y1] = [y1, y0];
      q++;
      const out = [];
      for (const i of big) { stamp[i] = q; out.push(i); }
      if (x1 < X0 || y1 < Y0 || x0 > X1 || y0 > Y1) return out;
      const i0 = cx(x0), i1 = cx(x1), j0 = cy(y0), j1 = cy(y1);
      for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) {
        const list = cells.get(j * nx + k);
        if (list) for (const i of list) if (stamp[i] !== q) { stamp[i] = q; out.push(i); }
      }
      return out;
    },
    bboxOf(i) { return boxes[i]; },
  };
}

function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = ax + t * dx - px, ey = ay + t * dy - py;
  return ex * ex + ey * ey;
}

function minDist2(path, x, y) {
  let d = Infinity;
  for (const pl of path) {
    if (pl.length === 2) d = Math.min(d, (pl[0] - x) ** 2 + (pl[1] - y) ** 2);
    for (let i = 0; i + 3 < pl.length; i += 2) d = Math.min(d, segDist2(x, y, pl[i], pl[i + 1], pl[i + 2], pl[i + 3]));
  }
  return d;
}

// Even-odd over all loops of the path, so a hatch's islands are holes.
function insidePath(path, x, y) {
  let inside = false;
  for (const pl of path) {
    const n = pl.length;
    for (let i = 0, j = n - 2; i + 1 < n; j = i, i += 2) {
      const xi = pl[i], yi = pl[i + 1], xj = pl[j], yj = pl[j + 1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

// Items that can be clicked inside: hatches and closed curves with a trusted area.
const isFilled = it => it.kind === 'hatch' ? !it.bad : CURVES.has(it.kind) && it.area > 0 && !it.bad;

// The item under a click: the nearest edge within tol; failing that, the smallest filled item around the point.
export function pick(index, items, x, y, tol) {
  let best = -1, bestD = tol * tol, inner = -1, innerArea = Infinity;
  // Ties go to the lower index, so the answer doesn't depend on the grid's candidate order.
  for (const i of index.query(x - tol, y - tol, x + tol, y + tol)) {
    const it = items[i];
    const d = minDist2(it.path || [], x, y);
    if (d < bestD || (d === bestD && (best < 0 || i < best))) { best = i; bestD = d; continue; }
    if (d <= tol * tol || !isFilled(it)) continue;
    if ((it.area < innerArea || (it.area === innerArea && i < inner)) && insidePath(it.path, x, y)) { inner = i; innerArea = it.area; }
  }
  return best >= 0 ? best : inner;
}

// Does segment a–b touch the rectangle? (Liang–Barsky clip.)
function segHitsBox(ax, ay, bx, by, x0, y0, x1, y1) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay;
  const edges = [[-dx, ax - x0], [dx, x1 - ax], [-dy, ay - y0], [dy, y1 - ay]];
  for (const [p, q] of edges) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return true;
}

function pathHitsBox(path, x0, y0, x1, y1) {
  for (const pl of path) {
    if (pl.length === 2 && pl[0] >= x0 && pl[0] <= x1 && pl[1] >= y0 && pl[1] <= y1) return true;
    for (let i = 0; i + 3 < pl.length; i += 2) if (segHitsBox(pl[i], pl[i + 1], pl[i + 2], pl[i + 3], x0, y0, x1, y1)) return true;
  }
  return false;
}

// Window: items entirely inside the box. Crossing: items the box touches, or a filled item the box sits in.
export function selectBox(index, items, x0, y0, x1, y1, mode) {
  if (x0 > x1) [x0, x1] = [x1, x0];
  if (y0 > y1) [y0, y1] = [y1, y0];
  const out = [];
  for (const i of index.query(x0, y0, x1, y1)) {
    const b = index.bboxOf(i);
    if (!b) continue;
    if (mode === 'window') {
      if (b[0] >= x0 && b[2] <= x1 && b[1] >= y0 && b[3] <= y1) out.push(i);
      continue;
    }
    if (b[2] < x0 || b[0] > x1 || b[3] < y0 || b[1] > y1) continue;
    const it = items[i];
    if (pathHitsBox(it.path || [], x0, y0, x1, y1) || (isFilled(it) && insidePath(it.path, (x0 + x1) / 2, (y0 + y1) / 2))) out.push(i);
  }
  return out.sort((a, b) => a - b);
}

// What the Selection panel shows: per layer, the lengths and areas; per block name, the count.
export function selectionTotals(items, indices) {
  const layers = new Map(), blocks = new Map();
  for (const i of indices) {
    const it = items[i];
    if (it.kind === 'insert') {
      const name = it.block || '?';
      blocks.set(name, (blocks.get(name) || 0) + (it.copies || 1));
      continue;
    }
    let l = layers.get(it.layer);
    if (!l) layers.set(it.layer, l = { name: it.layer, len: 0, area: 0, hatchArea: 0, bad: 0 });
    if (it.bad) { l.bad++; if (CURVES.has(it.kind)) l.len += it.len || 0; continue; }
    if (it.kind === 'hatch') l.hatchArea += it.area || 0;
    else if (CURVES.has(it.kind)) { l.len += it.len || 0; if (it.area > 0) l.area += it.area; }
  }
  return {
    layers: [...layers.values()].sort((a, b) => cmpName(a.name, b.name)),
    blocks: [...blocks.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => cmpName(a.name, b.name)),
    items: indices.length,
  };
}

// The Copy button: tab-separated, a point as the decimal separator, so any spreadsheet pastes it as numbers.
export function selectionTsv(totals, t) {
  const f = v => v.toFixed(3);
  const lines = [[t('dq.col.layer'), t('dq.col.len'), t('dq.col.area'), t('dq.col.hatchArea')].join('\t')];
  let len = 0, area = 0, hatch = 0;
  for (const l of totals.layers) {
    lines.push([l.name, f(l.len), f(l.area), f(l.hatchArea)].join('\t'));
    len += l.len; area += l.area; hatch += l.hatchArea;
  }
  if (totals.layers.length) lines.push([t('dq.total'), f(len), f(area), f(hatch)].join('\t'));
  if (totals.blocks.length) {
    lines.push('', [t('dq.col.block'), t('dq.col.count')].join('\t'));
    for (const b of totals.blocks) lines.push([b.name, String(b.count)].join('\t'));
  }
  return lines.join('\n') + '\n';
}
```


Run: `node _tests/extract.mjs $PLAN js/dwg/selection.js && node --test "_tests/dwg/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 14`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/dwg/selection.js _tests/dwg/selection.test.js
git commit -F - <<'EOF'
DWG quantities: selection (grid, pick, window and crossing, totals)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 7: The .xlsx writer and the workbook

**Files:**
- Create: `js/dwg/xlsx.js`
- Test: `_tests/dwg/xlsx.test.js`

**Interfaces:**
- Consumes: `zipStore` from `js/laser/zip.js`; `summary` from Task 5.
- Produces: `writeXlsx(sheets) → Uint8Array` (sheets `[{ name, note?, columns: [{ header, width, fmt: 'text'|'int'|'m'|'m2' }], rows: [cells | { cells, bold }], totals? }]`), `workbookFor(files, t) → sheets`, `xlsxName(files) → string`, `sheetNames(names)`, `esc(s)`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/dwg/xlsx.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeXlsx, workbookFor, xlsxName, sheetNames, esc } from '../../js/dwg/xlsx.js';

// Reads the stored (uncompressed) entries back through their local headers.
function unzip(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), dec = new TextDecoder();
  const out = {};
  let p = 0;
  while (v.getUint32(p, true) === 0x04034b50) {
    assert.equal(v.getUint16(p + 8, true), 0, 'stored');
    const size = v.getUint32(p + 18, true), nameLen = v.getUint16(p + 26, true), extra = v.getUint16(p + 28, true);
    const name = dec.decode(bytes.subarray(p + 30, p + 30 + nameLen));
    const at = p + 30 + nameLen + extra;
    out[name] = dec.decode(bytes.subarray(at, at + size));
    p = at + size;
  }
  return out;
}

const sheetNamesOf = files => [...files['xl/workbook.xml'].matchAll(/<sheet name="([^"]*)"/g)].map(m => m[1]);

test('the package has its parts, and each sheet is declared, related and present', () => {
  const x = unzip(writeXlsx([
    { name: 'One', columns: [{ header: 'A', width: 10, fmt: 'text' }], rows: [['x']] },
    { name: 'Two', columns: [{ header: 'B', fmt: 'int' }], rows: [[1]] },
  ]));
  for (const p of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) assert.ok(p in x, p);
  assert.ok(x['[Content_Types].xml'].includes('PartName="/xl/worksheets/sheet2.xml"'));
  assert.ok(x['xl/_rels/workbook.xml.rels'].includes('Target="worksheets/sheet2.xml"'));
  assert.ok(x['xl/_rels/workbook.xml.rels'].includes('Target="styles.xml"'));
  assert.deepEqual(sheetNamesOf(x), ['One', 'Two']);
  for (const f of Object.values(x)) assert.ok(f.startsWith('<?xml'), 'every part is XML');
});

test('numbers are numbers with their format; text is inline; the header is bold and frozen', () => {
  const x = unzip(writeXlsx([{
    name: 'S',
    columns: [{ header: 'Στρώση', width: 20, fmt: 'text' }, { header: 'Μήκος (m)', fmt: 'm' }, { header: 'Πλήθος', fmt: 'int' }],
    rows: [['ΣΩΛΗΝΑΣ', 12.3456, 4], ['X', { v: 7, fmt: 'int' }, null]],
    totals: ['Σύνολο', 19.3456, 4],
  }]));
  const s = x['xl/worksheets/sheet1.xml'];
  assert.ok(s.includes('<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">Στρώση</t></is></c>'), 'bold Greek header');
  assert.ok(s.includes('<c r="B2" s="3"><v>12.3456</v></c>'), 'metres: number format 164');
  assert.ok(s.includes('<c r="C2" s="2"><v>4</v></c>'), 'integer: format 1');
  assert.ok(s.includes('<c r="B3" s="2"><v>7</v></c>'), 'a cell can set its own format');
  assert.ok(!s.includes('r="C3"'), 'an empty cell is left out');
  assert.ok(s.includes('<c r="B4" s="5"><v>19.3456</v></c>'), 'bold totals keep the format');
  assert.ok(s.includes('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'));
  assert.ok(s.includes('<col min="1" max="1" width="20" customWidth="1"/>'));
  assert.ok(!/<v>[^<]*[^0-9.eE+-][^<]*<\/v>/.test(s), 'every <v> holds a number');
  const st = x['xl/styles.xml'];
  assert.ok(st.includes('<numFmt numFmtId="164" formatCode="#,##0.000"/>'));
  assert.ok(st.includes('<fonts count="2">') && st.includes('<b/>'));
  assert.equal((st.match(/<xf numFmtId/g) || []).length, 7, '1 style xf + 6 cell xfs');
});

test('text is escaped and characters XML forbids are dropped', () => {
  const x = unzip(writeXlsx([{ name: 'a<b>&c', columns: [{ header: 'h' }], rows: [['<A & B> "q"\u0001￾ ok']] }]));
  assert.ok(x['xl/worksheets/sheet1.xml'].includes('&lt;A &amp; B&gt; &quot;q&quot; ok'));
  assert.deepEqual(sheetNamesOf(x), ['a&lt;b&gt;&amp;c']);
  assert.equal(esc('\uD800x'), 'x', 'a lone surrogate is dropped');
});

test('sheet names: 31 characters, no forbidden characters, unique without case', () => {
  const long = 'Α'.repeat(40);
  const names = sheetNames(['Layers', 'layers', 'LAYERS', long, long, 'a/b:c*d?e[f]\\g', "'quoted'", '']);
  assert.equal(names[0], 'Layers');
  assert.equal(names[1], 'layers (2)');
  assert.equal(names[2], 'LAYERS (3)');
  assert.equal(names[3], 'Α'.repeat(31));
  assert.equal(names[4], 'Α'.repeat(27) + ' (2)');
  assert.equal(names[5], 'a_b_c_d_e_f__g');
  assert.equal(names[6], 'quoted');
  assert.equal(names[7], 'Sheet');
  for (const n of names) assert.ok(n.length <= 31, n);
  assert.equal(new Set(names.map(n => n.toLowerCase())).size, names.length);
});

const L = (name, o = {}) => ({ name, color: '#ffffff', off: false, frozen: false, len: 0, lenCount: 0, area: 0, areaCount: 0, hatchArea: 0, hatchCount: 0, bad: 0, ...o });
const t = (k, p = {}) => k + (Object.keys(p).length ? JSON.stringify(p) : '');

function batch() {
  const a = { name: 'ισόγειο-ύδρευση-και-αποχέτευση.dwg', result: {
    type: 'result',
    layers: [L('ΣΩΛΗΝΕΣ', { len: 42.5, lenCount: 7 }), L('ROOMS', { area: 31.2, areaCount: 3, hatchArea: 30, hatchCount: 2, off: true, bad: 1 })],
    blocks: [{ name: 'WC', layer: '0', count: 2, nested: 0 }],
    schedules: [{ block: 'WINDOW', tags: ['TYPE', 'W', 'H'], rows: [{ values: ['W1', '120', '140'], count: 8 }, { values: ['W2', '80', '140'], count: 2 }] }],
    items: [], notMeasured: {},
  } };
  const b = { name: 'broken.dxf', result: { type: 'error', reason: 'read' } };
  const c = { name: 'first-floor.dxf', result: { type: 'result', layers: [L('ΣΩΛΗΝΕΣ', { len: 7.5, lenCount: 1 })], blocks: [], schedules: [], items: [], notMeasured: {} } };
  return [a, b, c];
}

test('the batch workbook: Summary first, then three sheets per read file, a failed file noted', () => {
  const sheets = workbookFor(batch(), t);
  assert.deepEqual(sheets.map(s => s.name), [
    'dq.sheet.summary',
    'ισόγειο-ύδρευση dq.sheet.layers', 'ισόγειο-ύδρευση dq.sheet.blocks', 'ισόγειο-ύδρε dq.sheet.schedules',
    'first-floor dq.sheet.layers', 'first-floor dq.sheet.blocks', 'first-floor dq.sheet.schedules',
  ]);
  for (const s of sheets) assert.ok(s.name.length <= 31, s.name);
  const sum = sheets[0];
  assert.equal(sum.note, 'dq.xlsx.partial{"files":"broken.dxf"}');
  const pipes = sum.rows.find(r => Array.isArray(r) && r[0] === 'ΣΩΛΗΝΕΣ');
  assert.equal(pipes[1], 50, 'lengths add across files');
  assert.equal(pipes[2], 8);
  const rooms = sum.rows.find(r => Array.isArray(r) && r[0] === 'ROOMS');
  assert.equal(rooms[7], 'dq.badge.off, dq.badge.bad{"n":1}');
  const total = sum.rows.find(r => r.bold && r.cells[0] === 'dq.total');
  assert.deepEqual(total.cells, ['dq.total', 50, 8, 31.2, 3, 30, 2, '']);
  const sched = sheets[3];
  assert.deepEqual(sched.rows[0], { cells: ['WINDOW'], bold: true });
  assert.deepEqual(sched.rows[1], { cells: ['TYPE', 'W', 'H', 'dq.col.count'], bold: true });
  assert.deepEqual(sched.rows[2], ['W1', '120', '140', { v: 8, fmt: 'int' }]);
  assert.deepEqual(sheets[6].rows, [['dq.schedules.none']]);
});

test('the batch workbook writes and reads back with the partial note on row 1 and the header frozen under it', () => {
  const x = unzip(writeXlsx(workbookFor(batch(), t)));
  assert.equal(sheetNamesOf(x).length, 7);
  const s1 = x['xl/worksheets/sheet1.xml'];
  assert.ok(s1.includes('<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">dq.xlsx.partial{&quot;files&quot;:&quot;broken.dxf&quot;}</t></is></c>'));
  assert.ok(s1.includes('<pane ySplit="2" topLeftCell="A3"'));
  assert.ok(s1.includes('<t xml:space="preserve">ΣΩΛΗΝΕΣ</t>'));
});

test('the file name', () => {
  assert.equal(xlsxName([{ name: 'Κάτοψη ισογείου.dwg' }]), 'quantities-Κάτοψη ισογείου.xlsx');
  assert.equal(xlsxName([{ name: 'a:b*c.dxf' }]), 'quantities-a_b_c.xlsx');
  assert.equal(xlsxName([{ name: 'a.dwg' }, { name: 'b.dwg' }, { name: 'c.dwg' }]), 'quantities-3-files.xlsx');
});
```


Run: `node _tests/extract.mjs $PLAN _tests/dwg/xlsx.test.js && node --test "_tests/dwg/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 14`, `ℹ fail 1`.

- [ ] **Step 2: Write the module**

<!-- file: js/dwg/xlsx.js -->
```js
// DWG quantities: the .xlsx download (spec §5 Output). A minimal SpreadsheetML writer on the laser tool's
// stored ZIP: inline strings, numbers stored as numbers with a number format, a bold header row, column
// widths and a frozen header. Pure: sheets in, bytes out.
import { zipStore } from '../laser/zip.js';
import { summary, layerRows, layerTotals, blockRows, blockTotals } from './tables.js';

// Style ids in styles.xml: plain text, bold, then per format plain/bold.
const FMT = { text: 0, int: 2, m: 3, m2: 3 };
const BOLD = { text: 1, int: 4, m: 5, m2: 5 };

const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
export const esc = s => String(s).replace(INVALID_XML, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function colName(i) {
  let s = '';
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

// Excel's rules: at most 31 characters, none of []:*?/\, no leading or trailing apostrophe, unique
// without regard to case.
export function sheetNames(names) {
  const seen = new Set();
  return names.map(raw => {
    let base = String(raw).replace(INVALID_XML, '').replace(/[[\]:*?/\\]/g, '_').replace(/^'+|'+$/g, '').trim() || 'Sheet';
    base = base.slice(0, 31).trim();
    let out = base, k = 1;
    while (seen.has(out.toLowerCase())) {
      const suffix = ` (${++k})`;
      out = base.slice(0, 31 - suffix.length).trimEnd() + suffix;
    }
    seen.add(out.toLowerCase());
    return out;
  });
}

// A cell: null/undefined/'' is empty; a number uses the column's format; { v, fmt } sets its own format.
function cellXml(ref, cell, fmt, bold) {
  if (cell && typeof cell === 'object') { fmt = cell.fmt || fmt; cell = cell.v; }
  if (cell === null || cell === undefined || cell === '') return '';
  const s = (bold ? BOLD : FMT)[fmt] ?? (bold ? 1 : 0);
  if (typeof cell === 'number' && Number.isFinite(cell)) return `<c r="${ref}" s="${s}"><v>${cell}</v></c>`;
  return `<c r="${ref}" t="inlineStr" s="${bold ? 1 : 0}"><is><t xml:space="preserve">${esc(cell)}</t></is></c>`;
}

// A row is an array of cells, or { cells, bold } for titles and in-sheet headers.
function sheetXml(sheet) {
  const cols = sheet.columns || [];
  const rows = [];
  let freeze = 0;
  if (sheet.note) rows.push({ cells: [sheet.note], bold: true });
  if (cols.some(c => c.header != null)) { rows.push({ cells: cols.map(c => c.header ?? ''), bold: true }); freeze = rows.length; }
  for (const r of sheet.rows || []) rows.push(Array.isArray(r) ? { cells: r, bold: false } : r);
  if (sheet.totals) rows.push({ cells: sheet.totals, bold: true });
  const body = rows.map((r, ri) => {
    const cells = r.cells.map((c, ci) => cellXml(colName(ci) + (ri + 1), c, (cols[ci] && cols[ci].fmt) || 'text', r.bold)).join('');
    return `<row r="${ri + 1}">${cells}</row>`;
  }).join('');
  const pane = freeze
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${freeze}" topLeftCell="A${freeze + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const widths = cols.length
    ? '<cols>' + cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 12}" customWidth="1"/>`).join('') + '</cols>'
    : '';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + pane + widths + `<sheetData>${body}</sheetData></worksheet>`;
}

const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
  + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  + '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.000"/></numFmts>'
  + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
  + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
  + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="6">'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
  + '<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  + '<xf numFmtId="1" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>'
  + '<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>'
  + '</cellXfs>'
  + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
  + '</styleSheet>';

// sheets: [{ name, columns: [{ header, width, fmt }], rows, totals?, note? }] → the .xlsx bytes.
export function writeXlsx(sheets) {
  const enc = new TextEncoder();
  const names = sheetNames(sheets.map(s => s.name));
  const n = sheets.length;
  const files = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
      + '</Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
      + '</Relationships>'],
    ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
      + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + '<sheets>' + names.map((nm, i) => `<sheet name="${esc(nm)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets>'
      + '</workbook>'],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
      + `<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
      + '</Relationships>'],
    ['xl/styles.xml', STYLES],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)]),
  ];
  return zipStore(files.map(([name, text]) => ({ name, bytes: enc.encode(text) })));
}

const stem = name => { const d = String(name).lastIndexOf('.'); return d > 0 ? String(name).slice(0, d) : String(name); };

// "<file> <label>", with the file part cut so the whole name fits Excel's 31 characters.
function fileSheet(name, label) {
  const room = Math.max(1, 31 - 1 - label.length);
  return `${stem(name).slice(0, room).trim()} ${label}`;
}

const LAYER_COLS = t => [
  { header: t('dq.col.layer'), width: 28, fmt: 'text' },
  { header: t('dq.col.len'), width: 14, fmt: 'm' },
  { header: t('dq.col.count'), width: 10, fmt: 'int' },
  { header: t('dq.col.area'), width: 14, fmt: 'm2' },
  { header: t('dq.col.count'), width: 10, fmt: 'int' },
  { header: t('dq.col.hatchArea'), width: 16, fmt: 'm2' },
  { header: t('dq.col.count'), width: 10, fmt: 'int' },
  { header: t('dq.col.state'), width: 24, fmt: 'text' },
];

function stateNote(r, t) {
  const s = [];
  if (r.off) s.push(t('dq.badge.off'));
  if (r.frozen) s.push(t('dq.badge.frozen'));
  if (r.bad) s.push(t('dq.badge.bad', { n: r.bad }));
  return s.join(', ');
}

const layerRow = (r, t) => [r.name, r.len, r.lenCount, r.area, r.areaCount, r.hatchArea, r.hatchCount, stateNote(r, t)];
const layerTotalRow = (rows, t) => { const s = layerTotals(rows); return [t('dq.total'), s.len, s.lenCount, s.area, s.areaCount, s.hatchArea, s.hatchCount, '']; };

const BLOCK_COLS = t => [
  { header: t('dq.col.block'), width: 28, fmt: 'text' },
  { header: t('dq.col.layer'), width: 24, fmt: 'text' },
  { header: t('dq.col.count'), width: 10, fmt: 'int' },
  { header: t('dq.col.nested'), width: 14, fmt: 'int' },
];

// The workbook for a batch (spec §5): a Summary sheet, then Layers, Blocks and Schedules per read file.
export function workbookFor(files, t) {
  const sum = summary(files);
  const int = v => ({ v, fmt: 'int' });
  const blockTableRows = rows => rows.map(b => [b.name, b.layer, int(b.count), int(b.nested)]);
  const blockTotal = rows => { const s = blockTotals(rows); return { cells: [t('dq.total'), '', int(s.count), int(s.nested)], bold: true }; };

  // Summary: the layer table under the frozen header, then the block table with its own header.
  const summaryRows = sum.layers.map(r => layerRow(r, t));
  summaryRows.push({ cells: layerTotalRow(sum.layers, t), bold: true }, []);
  summaryRows.push({ cells: [t('dq.col.block'), t('dq.col.layer'), t('dq.col.count'), t('dq.col.nested')], bold: true });
  summaryRows.push(...blockTableRows(sum.blocks), blockTotal(sum.blocks));
  const sheets = [{
    name: t('dq.sheet.summary'),
    note: sum.partial ? t('dq.xlsx.partial', { files: sum.missing.join(', ') }) : undefined,
    columns: LAYER_COLS(t),
    rows: summaryRows,
  }];

  for (const f of files) {
    if (!f.result || f.result.type !== 'result') continue;
    const layers = layerRows(f.result), blocks = blockRows(f.result);
    sheets.push({ name: fileSheet(f.name, t('dq.sheet.layers')), columns: LAYER_COLS(t), rows: layers.map(r => layerRow(r, t)), totals: layerTotalRow(layers, t) });
    const bt = blockTotals(blocks);
    sheets.push({ name: fileSheet(f.name, t('dq.sheet.blocks')), columns: BLOCK_COLS(t), rows: blockTableRows(blocks), totals: [t('dq.total'), '', bt.count, bt.nested] });
    const sched = f.result.schedules || [];
    const width = Math.max(1, ...sched.map(s => s.tags.length + 1));
    const rows = [];
    if (!sched.length) rows.push([t('dq.schedules.none')]);
    sched.forEach((s, i) => {
      if (i) rows.push([]);
      rows.push({ cells: [s.block], bold: true });
      rows.push({ cells: [...s.tags, t('dq.col.count')], bold: true });
      for (const r of s.rows) rows.push([...r.values, int(r.count)]);
    });
    sheets.push({
      name: fileSheet(f.name, t('dq.sheet.schedules')),
      columns: Array.from({ length: width }, () => ({ header: null, width: 16, fmt: 'text' })),
      rows,
    });
  }
  return sheets;
}

// The download's file name.
export function xlsxName(files) {
  if (files.length === 1) {
    const s = stem(files[0].name).replace(/[^\p{L}\p{N}._ -]+/gu, '_').trim() || 'drawing';
    return `quantities-${s}.xlsx`;
  }
  return `quantities-${files.length}-files.xlsx`;
}
```


Run: `node _tests/extract.mjs $PLAN js/dwg/xlsx.js && node --test "_tests/dwg/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 21`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/dwg/xlsx.js _tests/dwg/xlsx.test.js
git commit -F - <<'EOF'
DWG quantities: .xlsx writer and workbook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 8: The controller's pure decisions

**Files:**
- Create: `js/dwg/state.js`
- Test: `_tests/dwg/ui-state.test.js`

**Interfaces:**
- Produces: `MAX_FILES` (20), `MAX_BYTES` (30 MB), `UNITS`, `INFO_WARNINGS`, `rowItems(items, row)`, `clickSelection(current, picked, shift)`, `boxSelection(current, found, shift)`, `fileStatus(f) → 'ok'|'warn'|'error'|null`, `engineSettings(settings, f) → { units, override? }`, `admit(existing, incoming) → { take, dropped }`, `loadedEvent(files)`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/dwg/ui-state.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowItems, clickSelection, boxSelection, fileStatus, engineSettings, admit, loadedEvent, MAX_FILES, MAX_BYTES } from '../../js/dwg/state.js';

const items = [
  { layer: 'PIPE', kind: 'line' },
  { layer: 'WIN', kind: 'insert', block: 'W1' },
  { layer: 'WIN', kind: 'insert', block: 'W2' },
  { layer: 'WIN', kind: 'polyline' },
  { layer: '0', kind: 'insert', block: 'W1' },
];

test('a layer row stands for all its items; a block row for that block on that layer', () => {
  assert.deepEqual(rowItems(items, { layer: 'WIN' }), [1, 2, 3]);
  assert.deepEqual(rowItems(items, { block: 'W1', layer: 'WIN' }), [1]);
  assert.deepEqual(rowItems(items, { block: 'W1', layer: '0' }), [4]);
  assert.deepEqual(rowItems(items, { layer: 'NONE' }), []);
});

test('clicks: replace, Shift toggles, empty space clears unless Shift', () => {
  assert.deepEqual(clickSelection([1, 2], 3, false), [3]);
  assert.deepEqual(clickSelection([1, 2], 3, true), [1, 2, 3]);
  assert.deepEqual(clickSelection([1, 2], 2, true), [1]);
  assert.deepEqual(clickSelection([1, 2], -1, false), []);
  assert.deepEqual(clickSelection([2, 1], -1, true), [1, 2]);
});

test('boxes: replace, or add with Shift', () => {
  assert.deepEqual(boxSelection([5], [3, 1], false), [1, 3]);
  assert.deepEqual(boxSelection([5], [3, 5], true), [3, 5]);
});

test('file status', () => {
  assert.equal(fileStatus({ result: null }), null);
  assert.equal(fileStatus({ result: { type: 'error' } }), 'error');
  assert.equal(fileStatus({ result: { type: 'result', warnings: [] } }), 'ok');
  assert.equal(fileStatus({ result: { type: 'result', warnings: [{ id: 'xrefs' }] } }), 'warn');
  // Text left unmeasured and geometry inside blocks are in almost every drawing: information, not a warning.
  assert.equal(fileStatus({ result: { type: 'result', warnings: [{ id: 'not-measured' }, { id: 'inside-blocks' }] } }), 'ok');
});

test('engine settings: page units always, a valid per-file override only', () => {
  assert.deepEqual(engineSettings({ units: 'cm' }, {}), { units: 'cm' });
  assert.deepEqual(engineSettings({}, { override: 'm' }), { units: 'auto', override: 'm' });
  assert.deepEqual(engineSettings({ units: 'mm' }, { override: 'yards' }), { units: 'mm' });
});

test('admit: at most 20 files; a file over 30 MB becomes a limit error without reaching the engine', () => {
  const f = (n, size = 10) => ({ name: `f${n}.dwg`, bytes: new ArrayBuffer(size) });
  const r = admit(15, [f(1), f(2, MAX_BYTES + 1), ...Array.from({ length: 8 }, (_, i) => f(i + 3))]);
  assert.equal(r.take.length, MAX_FILES - 15);
  assert.equal(r.dropped, 10 - 5);
  assert.equal(r.take[1].result.reason, 'limit');
  assert.equal(r.take[0].result, undefined);
  assert.equal(admit(MAX_FILES, [f(1)]).take.length, 0);
});

test('the files-loaded event carries counts only', () => {
  const ok = { type: 'result', layers: [{}, {}], blocks: [{ count: 3 }, { count: 2 }], schedules: [{}] };
  assert.deepEqual(loadedEvent([{ name: 'secret.dwg', result: ok }, { name: 'x', result: { type: 'error' } }]),
    { files: 2, errors: 1, layers: 2, blocks: 5, schedules: 1 });
});
```


Run: `node _tests/extract.mjs $PLAN _tests/dwg/ui-state.test.js && node --test "_tests/dwg/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 21`, `ℹ fail 1`.

- [ ] **Step 2: Write the module**

<!-- file: js/dwg/state.js -->
```js
// DWG quantities: the controller's pure decisions, kept out of ui.js so the Node tests can pin them.
export const MAX_FILES = 20;                         // per batch (spec §8)
export const MAX_BYTES = 30 * 1024 * 1024;           // per file, checked before the engine sees it
export const UNITS = ['mm', 'cm', 'm', 'inch', 'ft'];

// The items a table row stands for: a layer's items, or one block name's inserts on one layer.
export function rowItems(items, row) {
  const out = [];
  items.forEach((it, i) => {
    if (row.block != null) { if (it.kind === 'insert' && it.block === row.block && it.layer === row.layer) out.push(i); }
    else if (it.layer === row.layer) out.push(i);
  });
  return out;
}

// A click in the drawing: a plain click replaces the selection (or clears it on empty space); Shift+click
// adds or removes one item.
export function clickSelection(current, picked, shift) {
  const s = new Set(current);
  if (picked < 0) return shift ? [...s].sort((a, b) => a - b) : [];
  if (!shift) return [picked];
  if (s.has(picked)) s.delete(picked); else s.add(picked);
  return [...s].sort((a, b) => a - b);
}

// A box: replaces the selection, or with Shift adds to it.
export function boxSelection(current, found, shift) {
  const s = new Set(shift ? current : []);
  for (const i of found) s.add(i);
  return [...s].sort((a, b) => a - b);
}

// Warnings that only inform: almost every drawing has text, and blocks hold geometry by design.
export const INFO_WARNINGS = new Set(['not-measured', 'inside-blocks']);

// ✔ / ⚠ / ✖, or null while waiting. ⚠ means something needs the visitor's attention.
export function fileStatus(f) {
  if (!f.result) return null;
  if (f.result.type !== 'result') return 'error';
  return (f.result.warnings || []).some(w => !INFO_WARNINGS.has(w.id)) ? 'warn' : 'ok';
}

// What the engine is asked for one file: the page-wide units for files that state none, and the file's
// own override if the visitor set one.
export function engineSettings(settings, f) {
  const s = { units: settings.units || 'auto' };
  if (f.override && UNITS.includes(f.override)) s.override = f.override;
  return s;
}

// Files the engine will not see: too many for the batch, or too big (an error result made here).
export function admit(existing, incoming) {
  const room = Math.max(0, MAX_FILES - existing);
  const take = incoming.slice(0, room).map(f => (f.bytes.byteLength > MAX_BYTES
    ? { ...f, result: { type: 'error', reason: 'limit', message: 'over 30 MB' } }
    : f));
  return { take, dropped: incoming.length - take.length };
}

// The GA payload after a batch is read (spec §5): counts only, never names.
export function loadedEvent(files) {
  const ok = files.map(f => f.result).filter(r => r && r.type === 'result');
  return {
    files: files.length,
    errors: files.length - ok.length,
    layers: ok.reduce((a, r) => a + r.layers.length, 0),
    blocks: ok.reduce((a, r) => a + r.blocks.reduce((b, x) => b + x.count, 0), 0),
    schedules: ok.reduce((a, r) => a + r.schedules.length, 0),
  };
}
```


Run: `node _tests/extract.mjs $PLAN js/dwg/state.js && node --test "_tests/dwg/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 28`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/dwg/state.js _tests/dwg/ui-state.test.js
git commit -F - <<'EOF'
DWG quantities: the controller's pure decisions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 9: The drawing

**Files:**
- Create: `js/dwg/view.js`
- Test: `_tests/dwg/view.test.js` (the pure colour rule; the canvas itself is checked in the browser in Task 14)

**Interfaces:**
- Consumes: `createIndex`, `pick`, `selectBox` from Task 6.
- Produces: `visibleColor(color, bg, ink) → '#rrggbb'`; `createView(canvas, { onHover(i, clientX, clientY), onPick(i, shiftKey), onBox(x0, y0, x1, y1, mode, shiftKey) }) → { show(result), clear(), setHighlight(indices | null), setSelection(indices), fit(), zoomBy(f), restyle(), index, destroy() }`. Left-drag on the drawing draws a box (left to right = window, right to left = crossing); middle button, Space + drag or one finger pans; wheel and pinch zoom.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/dwg/view.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleColor } from '../../js/dwg/view.js';

test('layer colours keep their hue but never vanish into the background', () => {
  assert.equal(visibleColor('#ff0000', '#ffffff', '#1a1a1a'), '#ff0000');            // red on white: kept
  assert.equal(visibleColor('#ffffff', '#ffffff', '#1a1a1a'), '#1a1a1a');            // white (ACI 7) on white: the ink
  assert.equal(visibleColor('#000000', '#1a1a1a', '#f0f0f0'), '#f0f0f0');            // black on a dark canvas: the ink
  const yellow = visibleColor('#ffff00', '#ffffff', '#1a1a1a');                      // yellow on white: darkened, still yellowish
  assert.notEqual(yellow, '#ffff00');
  const [r, g, b] = [1, 3, 5].map(i => parseInt(yellow.slice(i, i + 2), 16));
  assert.ok(r > b && g > b, yellow);
});
```


Run: `node _tests/extract.mjs $PLAN _tests/dwg/view.test.js && node --test "_tests/dwg/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 28`, `ℹ fail 1`.

- [ ] **Step 2: Write the module**

<!-- file: js/dwg/view.js -->
```js
// DWG quantities: the Canvas 2D drawing of one file (spec §5 The drawing). Items are drawn from the engine's
// tessellated paths, grouped into one Path2D per colour so a frame is a handful of stroke calls even at
// 50,000 items. Pan and zoom first move a cached bitmap of the last full frame, then redraw when the hand
// stops. Paths are stored relative to the drawing's lower-left corner, so survey coordinates stay precise.
import { createIndex, pick, selectBox } from './selection.js?v=20261015';

const PICK_PX = 4;            // pick tolerance in CSS pixels
const DRAG_PX = 4;            // a press that moves further than this is a box or a pan, not a click
const IDLE_MS = 120;          // full redraw after the last pan or zoom step

// sRGB relative luminance and contrast ratio, to keep layer colours visible on the canvas background.
function rgbOf(s) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(s).trim());
  if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const r = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i.exec(String(s));
  return r ? [+r[1], +r[2], +r[3]] : [255, 255, 255];
}
function lum([r, g, b]) {
  const c = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

// A layer colour too close to the background is replaced: a grey or white one (CAD's colour 7, "white on a
// black screen") by the ink itself, a coloured one (yellow on white) by a darker shade of its own hue.
export function visibleColor(color, bg, ink) {
  const c = rgbOf(color), b = rgbOf(bg), k = rgbOf(ink);
  if (contrast(c, b) >= 2) return hex(c);
  if (Math.max(...c) - Math.min(...c) < 24) return hex(k);
  for (let t = 0.2; t <= 1.0001; t += 0.1) {
    const m = c.map((v, i) => v + (k[i] - v) * t);
    if (contrast(m, b) >= 2.5) return hex(m);
  }
  return hex(k);
}

export function createView(canvas, { onHover = () => {}, onPick = () => {}, onBox = () => {} } = {}) {
  const ctx = canvas.getContext('2d');
  const base = document.createElement('canvas');           // the last full frame, for pan and zoom
  const bctx = base.getContext('2d');
  let result = null, items = [], index = null, paths = [], colorOf = [];
  let groups = [], hlGroups = null, selStroke = null, selFill = null;
  let X0 = 0, Y0 = 0, bw = 1, bh = 1;                        // drawing origin and size (m)
  let w = 1, h = 1, dpr = 1;                                 // canvas size in CSS px
  let k = 1, cx = 0, cy = 0;                                 // view: scale (px per m), centre (relative m)
  let baseView = null, fitted = false, idleTimer = 0, frame = 0;
  let press = null, box = null, spaceDown = false, hoverIdx = -1;
  const touches = new Map();
  let pinch = null;

  const css = name => getComputedStyle(canvas).getPropertyValue(name).trim();
  const colors = () => ({
    bg: getComputedStyle(canvas).backgroundColor || '#ffffff',
    ink: css('--ink') || '#17170f',
    hi: css('--gv-hi') || '#c2410c',
    accent: css('--accent') || '#0d7a3e',
  });

  // ---- coordinates ----
  const toModel = (sx, sy) => ({ x: (sx - w / 2) / k + cx + X0, y: (h / 2 - sy) / k + cy + Y0 });
  const local = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  // ---- building the paths ----
  function itemPath(it) {
    const p = new Path2D();
    for (const pl of it.path || []) {
      if (pl.length < 4) continue;
      p.moveTo(pl[0] - X0, pl[1] - Y0);
      for (let i = 2; i + 1 < pl.length; i += 2) p.lineTo(pl[i] - X0, pl[i + 1] - Y0);
    }
    return p;
  }

  function groupBy(indices) {
    const map = new Map();
    for (const i of indices) {
      const c = colorOf[i];
      let g = map.get(c);
      if (!g) map.set(c, g = { color: c, stroke: new Path2D(), fill: null });
      g.stroke.addPath(paths[i]);
      if (items[i].kind === 'hatch' && !items[i].bad) { if (!g.fill) g.fill = new Path2D(); g.fill.addPath(paths[i]); }
    }
    return [...map.values()];
  }

  function build() {
    const { bg, ink } = colors();
    const byLayer = new Map((result.layers || []).map(l => [l.name, visibleColor(l.color || ink, bg, ink)]));
    paths = items.map(itemPath);
    colorOf = items.map(it => byLayer.get(it.layer) || ink);
    groups = groupBy(items.map((_, i) => i));
  }

  // ---- drawing ----
  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; base.width = W; base.height = H; }
    if (result && !fitted) fit(); else full();
  }

  function paintGroups(c, list, width, alpha) {
    c.globalAlpha = alpha;
    for (const g of list) {
      if (g.fill) { c.globalAlpha = alpha * 0.14; c.fillStyle = g.color; c.fill(g.fill, 'evenodd'); c.globalAlpha = alpha; }
      c.strokeStyle = g.color;
      c.lineWidth = width / k;
      c.stroke(g.stroke);
    }
    c.globalAlpha = 1;
  }

  // Everything, at the current view, into the base bitmap; then onto the screen.
  function full() {
    clearTimeout(idleTimer);
    const { bg, hi } = colors();
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.fillStyle = bg;
    bctx.fillRect(0, 0, base.width, base.height);
    if (result) {
      bctx.setTransform(dpr * k, 0, 0, -dpr * k, dpr * (w / 2 - cx * k), dpr * (h / 2 + cy * k));
      bctx.lineJoin = 'round'; bctx.lineCap = 'round';
      if (hlGroups) { paintGroups(bctx, groups, 1, 0.18); paintGroups(bctx, hlGroups, 2, 1); }
      else paintGroups(bctx, groups, 1, 1);
      if (selStroke) {
        if (selFill) { bctx.globalAlpha = 0.22; bctx.fillStyle = hi; bctx.fill(selFill, 'evenodd'); bctx.globalAlpha = 1; }
        bctx.strokeStyle = hi; bctx.lineWidth = 2.5 / k; bctx.stroke(selStroke);
      }
    }
    baseView = { k, cx, cy };
    compose();
  }

  // The base bitmap moved to the current view, plus the selection box.
  function compose() {
    frame = 0;
    const { bg, hi, accent } = colors();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (baseView) {
      const s = k / baseView.k;
      const tx = (w / 2) * (1 - s) + (baseView.cx - cx) * k, ty = (h / 2) * (1 - s) - (baseView.cy - cy) * k;
      ctx.setTransform(s, 0, 0, s, tx * dpr, ty * dpr);
      ctx.drawImage(base, 0, 0);
    }
    if (box) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const crossing = box.x1 < box.x0;
      ctx.setLineDash(crossing ? [6, 4] : []);
      ctx.strokeStyle = crossing ? accent : hi;
      ctx.fillStyle = crossing ? 'rgba(13, 122, 62, 0.08)' : 'rgba(194, 65, 12, 0.08)';
      const x = Math.min(box.x0, box.x1), y = Math.min(box.y0, box.y1), bw_ = Math.abs(box.x1 - box.x0), bh_ = Math.abs(box.y1 - box.y0);
      ctx.fillRect(x, y, bw_, bh_);
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, bw_, bh_);
      ctx.setLineDash([]);
    }
  }

  const requestCompose = () => { if (!frame) frame = requestAnimationFrame(compose); };
  // A pan or zoom step: move the bitmap now, redraw everything once the hand stops.
  function moved() { requestCompose(); clearTimeout(idleTimer); idleTimer = setTimeout(full, IDLE_MS); }

  function fit() {
    if (!result) { full(); return; }
    fitted = true;
    const sw = bw > 0 ? bw : 0, sh = bh > 0 ? bh : 0;
    k = sw || sh ? 0.92 * Math.min(sw ? w / sw : Infinity, sh ? h / sh : Infinity) : 100;
    cx = bw / 2; cy = bh / 2;
    full();
  }

  function zoomAt(sx, sy, factor) {
    const m = toModel(sx, sy);
    k = Math.min(1e7, Math.max(1e-6, k * factor));
    cx = m.x - X0 - (sx - w / 2) / k;
    cy = m.y - Y0 - (h / 2 - sy) / k;
    moved();
  }

  // ---- input ----
  function hover(e) {
    if (!result || !index) return;
    const p = local(e), m = toModel(p.x, p.y);
    const i = pick(index, items, m.x, m.y, PICK_PX / k);
    if (i !== hoverIdx || i >= 0) { hoverIdx = i; onHover(i, e.clientX, e.clientY); }
  }

  function onPointerDown(e) {
    if (!result) return;
    canvas.setPointerCapture(e.pointerId);
    const p = local(e);
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, p);
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        press = null;
        return;
      }
    }
    const pan = e.button === 1 || (e.button === 0 && spaceDown) || e.pointerType === 'touch';
    press = { x: p.x, y: p.y, pan, moved: false, shift: e.shiftKey, cx, cy };
    if (e.button === 1) e.preventDefault();
  }

  function onPointerMove(e) {
    const p = local(e);
    if (pinch && touches.has(e.pointerId)) {
      touches.set(e.pointerId, p);
      const [a, b] = [...touches.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      zoomAt(mx, my, (pinch.k * d) / pinch.d / k);
      cx -= (mx - pinch.mx) / k; cy += (my - pinch.my) / k;
      pinch.mx = mx; pinch.my = my;
      return;
    }
    if (!press) { if (e.pointerType !== 'touch') hover(e); return; }
    if (!press.moved && Math.hypot(p.x - press.x, p.y - press.y) < DRAG_PX) return;
    press.moved = true;
    if (press.pan) {
      cx = press.cx - (p.x - press.x) / k;
      cy = press.cy + (p.y - press.y) / k;
      moved();
    } else {
      box = { x0: press.x, y0: press.y, x1: p.x, y1: p.y };
      requestCompose();
    }
  }

  function onPointerUp(e) {
    touches.delete(e.pointerId);
    if (pinch) { if (touches.size < 2) pinch = null; return; }
    const pr = press;
    press = null;
    if (!pr || !result) return;
    const p = local(e);
    if (!pr.moved) {
      if (pr.pan && e.pointerType !== 'touch') return;
      const m = toModel(p.x, p.y);
      onPick(pick(index, items, m.x, m.y, PICK_PX / k), pr.shift || e.shiftKey);
      return;
    }
    if (box) {
      const a = toModel(box.x0, box.y0), b = toModel(box.x1, box.y1);
      const mode = box.x1 >= box.x0 ? 'window' : 'crossing';
      box = null;
      requestCompose();
      onBox(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y), mode, pr.shift || e.shiftKey);
    }
  }

  function onWheel(e) {
    if (!result) return;
    e.preventDefault();
    const p = local(e);
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(p.x, p.y, Math.exp(-dy * 0.0015));
  }

  const onLeave = () => { if (!press && hoverIdx !== -1) { hoverIdx = -1; onHover(-1, 0, 0); } };
  const onKey = e => { if (e.code === 'Space' && e.target === document.body) { spaceDown = e.type === 'keydown'; if (spaceDown) e.preventDefault(); } };
  const onCancel = e => { touches.delete(e.pointerId); press = null; pinch = null; box = null; requestCompose(); };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const onDpr = () => resize();
  window.addEventListener('resize', onDpr);

  return {
    show(r) {
      result = r;
      items = (r && r.items) || [];
      const b = (r && r.bbox) || { x0: 0, y0: 0, x1: 1, y1: 1 };
      X0 = b.x0; Y0 = b.y0; bw = Math.max(0, b.x1 - b.x0); bh = Math.max(0, b.y1 - b.y0);
      index = createIndex(items);
      hlGroups = null; selStroke = null; selFill = null; hoverIdx = -1;
      build();
      resize();
      fit();
    },
    clear() { result = null; items = []; index = null; groups = []; hlGroups = null; selStroke = selFill = null; baseView = null; full(); },
    // Highlighted items drawn strong, the rest faded; null shows all normally.
    setHighlight(indices) {
      hlGroups = indices && indices.length ? groupBy(indices) : null;
      full();
    },
    setSelection(indices) {
      selStroke = selFill = null;
      if (indices && indices.length) {
        selStroke = new Path2D();
        for (const i of indices) {
          selStroke.addPath(paths[i]);
          if (items[i].kind === 'hatch' && !items[i].bad) { if (!selFill) selFill = new Path2D(); selFill.addPath(paths[i]); }
        }
      }
      full();
    },
    fit,
    zoomBy(f) { zoomAt(w / 2, h / 2, f); },
    // Colours come from CSS: rebuild them after a theme change.
    restyle() { if (result) { build(); full(); } },
    get index() { return index; },
    destroy() {
      ro.disconnect();
      clearTimeout(idleTimer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('resize', onDpr);
    },
  };
}
```


Run: `node _tests/extract.mjs $PLAN js/dwg/view.js && node --test "_tests/dwg/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 29`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/dwg/view.js _tests/dwg/view.test.js
git commit -F - <<'EOF'
DWG quantities: the drawing (canvas, pan, zoom, highlight, box selection)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 10: The tool's strings (GR/EN/IT)

**Files:**
- Create: `js/dwg/i18n-dwg.js`
- Test: `_tests/dwg/i18n.test.js`

**Interfaces:**
- Produces: `window.DQ_I18N = { el, en, it }`, 129 `dq.*` keys per language, including every warning, error, kind, not-measured, unit and sheet id the engine and the modules use. The page merges it into `window.GV_I18N` in Task 11.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/dwg/i18n.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const ph = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');

// The tool's strings file, evaluated the way the browser does.
function toolStrings() {
  const window = {};
  vm.runInNewContext(read('../../js/dwg/i18n-dwg.js'), { window });
  return window.DQ_I18N;
}

// Ids that reach the page from the engine (contract) and are looked up with a computed key.
const WARNINGS = ['units-assumed', 'units-setting', 'units-override', 'xrefs', 'bad-area', 'inside-blocks', 'not-measured', 'simplified'];
const ERRORS = ['read', 'version', 'limit', 'timeout', 'engine', 'empty'];
const KINDS = ['line', 'arc', 'circle', 'polyline', 'spline', 'ellipse', 'hatch', 'insert'];
const NOT_MEASURED = ['text', 'dim', 'solid3d', 'mesh', 'proxy', 'other', 'insideBlocks', 'xrefs'];
const UNITS = ['auto', 'mm', 'cm', 'm', 'inch', 'ft'];

test('tool strings: only dq.* keys, the same keys and placeholders in el, en and it', () => {
  const s = toolStrings();
  const en = Object.keys(s.en).sort();
  assert.ok(en.length >= 100, `${en.length} keys`);
  assert.ok(en.every(k => k.startsWith('dq.')));
  assert.deepEqual(Object.keys(s.el).sort(), en);
  assert.deepEqual(Object.keys(s.it).sort(), en);
  for (const k of en) {
    assert.equal(ph(s.el[k]), ph(s.en[k]), `el ${k}`);
    assert.equal(ph(s.it[k]), ph(s.en[k]), `it ${k}`);
    for (const l of ['el', 'en', 'it']) assert.ok(String(s[l][k]).trim().length > 0, `${l} ${k} is empty`);
  }
  assert.equal(ph(s.en['dq.engine.loading']), 'pct');
  assert.equal(ph(s.en['dq.warn.units-setting']), 'units');
});

test('every id the engine can send has a string in every language', () => {
  const s = toolStrings();
  const keys = [
    ...WARNINGS.map(id => `dq.warn.${id}`), ...ERRORS.map(id => `dq.err.${id}`), ...KINDS.map(k => `dq.kind.${k}`),
    ...NOT_MEASURED.map(k => `dq.nm.${k}`), ...UNITS.map(u => `dq.unit.${u}`),
  ];
  for (const k of keys) for (const l of ['el', 'en', 'it']) assert.ok(k in s[l], `${l} missing ${k}`);
});

test('every literal dq.* key the modules use exists', () => {
  const s = toolStrings();
  const dir = new URL('../../js/dwg/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'i18n-dwg.js');
  assert.ok(files.length >= 3, files.join(','));
  let used = 0;
  for (const f of files) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    for (const m of src.matchAll(/['"`](dq\.[A-Za-z0-9.-]+[A-Za-z0-9])['"`]/g)) {
      used++;
      assert.ok(m[1] in s.en, `${f} uses ${m[1]}, which has no string`);
    }
  }
  assert.ok(used >= 15, `${used} keys found`);
});

test('the Italian uses the typographic apostrophe', () => {
  const s = toolStrings();
  for (const [k, v] of Object.entries(s.it)) assert.ok(!v.includes("'"), `it ${k} has a straight apostrophe`);
});
```


Run: `node _tests/extract.mjs $PLAN _tests/dwg/i18n.test.js && node --test "_tests/dwg/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 29`, `ℹ fail 4` (the strings file is missing).

- [ ] **Step 2: Write the strings**

<!-- file: js/dwg/i18n-dwg.js -->
```js
// DWG quantities strings (GR/EN/IT). The page merges them under its own inline keys into window.GV_I18N,
// which the shared shell's t() reads. Placeholders are {name}; every language has the same keys and placeholders.
window.DQ_I18N = {
  el: {
    "dq.eyebrow": "Δωρεάν εργαλείο",
    "dq.title": "Επιμετρήσεις από DWG",
    "dq.lede": "Ρίξτε σχέδια DWG ή DXF και πάρτε μήκη, εμβαδά και πλήθη μπλοκ ανά στρώση, μαζί με τους πίνακες χαρακτηριστικών, σε Excel.",
    "dq.privacy": "Τα αρχεία μένουν στον υπολογιστή σας· τίποτα δεν ανεβαίνει.",
    "dq.cross": "Όλα τα δωρεάν εργαλεία →",
    "dq.open": "Άνοιγμα αρχείων",
    "dq.example": "Φόρτωση παραδείγματος",
    "dq.drop": "Σύρετε εδώ αρχεία DWG ή DXF, ή πατήστε «Άνοιγμα αρχείων».",
    "dq.engine.loading": "Φόρτωση της μηχανής γεωμετρίας, περίπου 12 MB, μόνο την πρώτη φορά… {pct} %",
    "dq.engine.failed": "Η μηχανή γεωμετρίας δεν ξεκίνησε σε αυτόν τον browser.",
    "dq.engine.retry": "Δοκιμάστε ξανά",
    "dq.engine.nowasm": "Ο browser σας δεν υποστηρίζει WebAssembly, που χρειάζεται το εργαλείο. Δοκιμάστε μια πρόσφατη έκδοση Chrome, Edge, Firefox ή Safari.",
    "dq.toomany": "Έως {max} αρχεία τη φορά· τα υπόλοιπα δεν φορτώθηκαν.",
    "dq.tab.summary": "Σύνοψη",
    "dq.status.ok": "Έτοιμο",
    "dq.status.warn": "Με προειδοποιήσεις",
    "dq.status.error": "Δεν διαβάστηκε",
    "dq.waiting": "σε αναμονή…",
    "dq.processing": "επεξεργασία…",
    "dq.remove": "Αφαίρεση αρχείου",
    "dq.clear": "Καθαρισμός",
    "dq.table.layers": "Στρώσεις",
    "dq.table.blocks": "Μπλοκ",
    "dq.table.schedules": "Πίνακες χαρακτηριστικών",
    "dq.table.notMeasured": "Δεν μετρήθηκαν",
    "dq.col.file": "Αρχείο",
    "dq.col.layer": "Στρώση",
    "dq.col.color": "Χρώμα",
    "dq.col.len": "Μήκος (m)",
    "dq.col.count": "Πλήθος",
    "dq.col.area": "Εμβαδόν (m²)",
    "dq.col.hatchArea": "Εμβαδόν διαγράμμισης (m²)",
    "dq.col.block": "Μπλοκ",
    "dq.col.nested": "Εμφωλευμένα",
    "dq.col.state": "Κατάσταση",
    "dq.badge.off": "σβηστή",
    "dq.badge.frozen": "παγωμένη",
    "dq.badge.bad": "{n} εμβαδά εκτός συνόλου",
    "dq.total": "Σύνολο",
    "dq.partial": "«≥»: τα αρχεία {files} δεν διαβάστηκαν, οπότε τα σύνολα είναι ελάχιστα.",
    "dq.schedules.none": "Κανένα μπλοκ με χαρακτηριστικά.",
    "dq.blocks.none": "Κανένα μπλοκ στον χώρο μοντέλου.",
    "dq.drawing": "Σχέδιο",
    "dq.fit": "Προσαρμογή",
    "dq.zoomin": "Μεγέθυνση",
    "dq.zoomout": "Σμίκρυνση",
    "dq.simplified": "Απλοποιημένη προβολή: το σχέδιο είναι μεγάλο και οι καμπύλες σχεδιάζονται πιο αδρά. Οι αριθμοί δεν αλλάζουν.",
    "dq.sel.title": "Επιλογή",
    "dq.sel.hint": "Κάντε κλικ σε ένα στοιχείο, ή σύρετε ένα παράθυρο: από αριστερά προς δεξιά για ό,τι είναι ολόκληρο μέσα, από δεξιά προς αριστερά για ό,τι αγγίζει. Shift+κλικ προσθέτει ή αφαιρεί, Esc καθαρίζει.",
    "dq.sel.items": "{n} στοιχεία",
    "dq.sel.copy": "Αντιγραφή",
    "dq.sel.copied": "Αντιγράφηκε",
    "dq.sel.clear": "Καθαρισμός επιλογής",
    "dq.sel.blocks": "Μπλοκ στην επιλογή",
    "dq.cta.groups": "Χρειάζεστε ομάδες αντιστοιχισμένες στον προϋπολογισμό σας ή στο ERP σας; Το φτιάχνουμε.",
    "dq.cta.groupsLink": "Μιλήστε μαζί μας",
    "dq.cta.text": "Θέλετε αυτές τις επιμετρήσεις μέσα στη δική σας ροή εργασίας; Φτιάχνουμε λογισμικό γύρω από τα δικά σας πρότυπα.",
    "dq.cta.link": "Επικοινωνήστε μαζί μας",
    "dq.settings.title": "Ρυθμίσεις",
    "dq.settings.units": "Μονάδες για αρχεία που δεν τις δηλώνουν",
    "dq.unit.auto": "Αυτόματα (mm)",
    "dq.unit.mm": "Χιλιοστά (mm)",
    "dq.unit.cm": "Εκατοστά (cm)",
    "dq.unit.m": "Μέτρα (m)",
    "dq.unit.inch": "Ίντσες (in)",
    "dq.unit.ft": "Πόδια (ft)",
    "dq.xlsx": "Λήψη Excel (.xlsx)",
    "dq.warn.units-assumed": "Το αρχείο δεν δηλώνει μονάδες· θεωρήθηκαν χιλιοστά. Αλλάξτε το στις ρυθμίσεις αν δεν ισχύει.",
    "dq.warn.units-setting": "Το αρχείο δεν δηλώνει μονάδες· χρησιμοποιήθηκαν {units} από τις ρυθμίσεις.",
    "dq.warn.xrefs": "Εξωτερικές αναφορές που δεν φορτώθηκαν: {count}",
    "dq.warn.bad-area": "Κλειστές γραμμές που τέμνουν τον εαυτό τους ή διαγραμμίσεις χωρίς υπολογίσιμο εμβαδόν, εκτός συνόλου: {count}",
    "dq.warn.inside-blocks": "Στοιχεία μέσα σε μπλοκ που δεν προστέθηκαν στα μήκη και τα εμβαδά: {count}",
    "dq.warn.not-measured": "Στοιχεία που δεν μετρήθηκαν (κείμενα, διαστάσεις, στερεά κ.ά.): {count}",
    "dq.warn.simplified": "Μεγάλο σχέδιο: η προβολή είναι απλοποιημένη, οι αριθμοί όχι.",
    "dq.err.read": "Το αρχείο δεν διαβάστηκε. Είναι DWG ή DXF;",
    "dq.err.version": "Αυτή η έκδοση DWG δεν υποστηρίζεται. Αποθηκεύστε το ως DWG 2018 ή παλαιότερο.",
    "dq.err.limit": "Το αρχείο ξεπερνά τα όρια του εργαλείου (30 MB ή 300.000 στοιχεία).",
    "dq.err.timeout": "Η επεξεργασία ξεπέρασε το ένα λεπτό.",
    "dq.err.engine": "Η μηχανή γεωμετρίας σταμάτησε σε αυτό το αρχείο.",
    "dq.err.empty": "Ο χώρος μοντέλου είναι άδειος· το σχέδιο βρίσκεται μόνο σε διατάξεις (paper space).",
    "dq.nm.text": "Κείμενα",
    "dq.nm.dim": "Διαστάσεις",
    "dq.nm.solid3d": "Στερεά 3D",
    "dq.nm.mesh": "Πλέγματα",
    "dq.nm.proxy": "Άγνωστα στοιχεία (proxy)",
    "dq.nm.other": "Άλλα",
    "dq.nm.insideBlocks": "Μέσα σε μπλοκ",
    "dq.nm.xrefs": "Εξωτερικές αναφορές (δεν φορτώθηκαν)",
    "dq.sheet.summary": "Σύνοψη",
    "dq.sheet.layers": "Στρώσεις",
    "dq.sheet.blocks": "Μπλοκ",
    "dq.sheet.schedules": "Χαρακτηριστικά",
    "dq.xlsx.partial": "Ελάχιστα σύνολα: τα αρχεία {files} δεν διαβάστηκαν.",
    "dq.survey.q": "Πώς βγάζετε σήμερα επιμετρήσεις από σχέδια;",
    "dq.survey.hand": "Με το χέρι ή σε Excel",
    "dq.survey.cad": "Με εντολές ή LISP στο CAD",
    "dq.survey.other": "Με άλλο πρόγραμμα",
    "dq.survey.thanks": "Ευχαριστούμε!",
    "dq.tip.layer": "Στρώση",
    "dq.tip.kind": "Τύπος",
    "dq.tip.len": "Μήκος",
    "dq.tip.area": "Εμβαδόν",
    "dq.tip.block": "Μπλοκ",
    "dq.tip.copies": "Αντίγραφα",
    "dq.kind.line": "Γραμμή",
    "dq.kind.arc": "Τόξο",
    "dq.kind.circle": "Κύκλος",
    "dq.kind.polyline": "Πολυγραμμή",
    "dq.kind.spline": "Spline",
    "dq.kind.ellipse": "Έλλειψη",
    "dq.kind.hatch": "Διαγράμμιση",
    "dq.kind.insert": "Μπλοκ",
    "dq.aria.files": "Αρχεία",
    "dq.aria.tabs": "Αρχεία του σχεδίου",
    "dq.aria.drawing": "Σχέδιο του επιλεγμένου αρχείου",
    "dq.back": "Αρχική",
    "dq.cta.title": "Θέλετε τις επιμετρήσεις μέσα στη δουλειά σας;",
    "dq.notice": "Μηχανή γεωμετρίας: Eyeshot.",
    "dq.nm.none": "Όλα τα στοιχεία του χώρου μοντέλου μετρήθηκαν.",
    "dq.units.line": "Μονάδες: {units} ({source})",
    "dq.units.change": "Αλλαγή",
    "dq.units.fromFile": "Όπως δηλώνει το αρχείο",
    "dq.units.src.file": "από το αρχείο",
    "dq.units.src.setting": "από τις ρυθμίσεις",
    "dq.units.src.assumed": "υπόθεση",
    "dq.units.src.override": "δική σας επιλογή",
    "dq.warn.units-override": "Μετρήθηκε σε {units} αντί για {file} που δηλώνει το αρχείο.",
    "dq.example.failed": "Το παράδειγμα δεν φορτώθηκε. Δοκιμάστε ξανά.",
    "dq.tab.close": "Κλείσιμο"
  },
  en: {
    "dq.eyebrow": "Free tool",
    "dq.title": "Quantities from DWG",
    "dq.lede": "Drop DWG or DXF drawings and get lengths, areas and block counts per layer, with the attribute schedules, in Excel.",
    "dq.privacy": "Files stay on your computer; nothing is uploaded.",
    "dq.cross": "All free tools →",
    "dq.open": "Open files",
    "dq.example": "Load example",
    "dq.drop": "Drop DWG or DXF files here, or press “Open files”.",
    "dq.engine.loading": "Loading the geometry engine, about 12 MB, only the first time… {pct} %",
    "dq.engine.failed": "The geometry engine could not start in this browser.",
    "dq.engine.retry": "Try again",
    "dq.engine.nowasm": "Your browser does not support WebAssembly, which the tool needs. Try a recent Chrome, Edge, Firefox or Safari.",
    "dq.toomany": "Up to {max} files at a time; the rest were not loaded.",
    "dq.tab.summary": "Summary",
    "dq.status.ok": "Ready",
    "dq.status.warn": "With warnings",
    "dq.status.error": "Not read",
    "dq.waiting": "waiting…",
    "dq.processing": "processing…",
    "dq.remove": "Remove file",
    "dq.clear": "Clear",
    "dq.table.layers": "Layers",
    "dq.table.blocks": "Blocks",
    "dq.table.schedules": "Attribute schedules",
    "dq.table.notMeasured": "Not measured",
    "dq.col.file": "File",
    "dq.col.layer": "Layer",
    "dq.col.color": "Colour",
    "dq.col.len": "Length (m)",
    "dq.col.count": "Count",
    "dq.col.area": "Area (m²)",
    "dq.col.hatchArea": "Hatch area (m²)",
    "dq.col.block": "Block",
    "dq.col.nested": "Nested",
    "dq.col.state": "State",
    "dq.badge.off": "off",
    "dq.badge.frozen": "frozen",
    "dq.badge.bad": "{n} areas left out",
    "dq.total": "Total",
    "dq.partial": "“≥”: {files} could not be read, so the totals are minimums.",
    "dq.schedules.none": "No blocks with attributes.",
    "dq.blocks.none": "No blocks in model space.",
    "dq.drawing": "Drawing",
    "dq.fit": "Fit",
    "dq.zoomin": "Zoom in",
    "dq.zoomout": "Zoom out",
    "dq.simplified": "Simplified view: the drawing is large, so curves are drawn coarser. The numbers are unchanged.",
    "dq.sel.title": "Selection",
    "dq.sel.hint": "Click an item, or drag a window: left to right for what is fully inside, right to left for what it touches. Shift+click adds or removes, Esc clears.",
    "dq.sel.items": "{n} items",
    "dq.sel.copy": "Copy",
    "dq.sel.copied": "Copied",
    "dq.sel.clear": "Clear selection",
    "dq.sel.blocks": "Blocks in the selection",
    "dq.cta.groups": "Need groups mapped to your bill of quantities or your ERP? We build that.",
    "dq.cta.groupsLink": "Talk to us",
    "dq.cta.text": "Want these quantities inside your own workflow? We build software around your standards.",
    "dq.cta.link": "Get in touch",
    "dq.settings.title": "Settings",
    "dq.settings.units": "Units for files that state none",
    "dq.unit.auto": "Automatic (mm)",
    "dq.unit.mm": "Millimetres (mm)",
    "dq.unit.cm": "Centimetres (cm)",
    "dq.unit.m": "Metres (m)",
    "dq.unit.inch": "Inches (in)",
    "dq.unit.ft": "Feet (ft)",
    "dq.xlsx": "Download Excel (.xlsx)",
    "dq.warn.units-assumed": "The file states no units; millimetres were assumed. Change it in the settings if that is wrong.",
    "dq.warn.units-setting": "The file states no units; {units} from the settings were used.",
    "dq.warn.xrefs": "External references not loaded: {count}",
    "dq.warn.bad-area": "Self-intersecting closed lines or hatches without a computable area, left out of the totals: {count}",
    "dq.warn.inside-blocks": "Items inside blocks not added to lengths and areas: {count}",
    "dq.warn.not-measured": "Items not measured (text, dimensions, solids and others): {count}",
    "dq.warn.simplified": "Large drawing: the view is simplified, the numbers are not.",
    "dq.err.read": "The file could not be read. Is it a DWG or DXF?",
    "dq.err.version": "This DWG version is not supported. Save it as DWG 2018 or older.",
    "dq.err.limit": "The file is over the tool’s limits (30 MB or 300,000 items).",
    "dq.err.timeout": "Processing took longer than one minute.",
    "dq.err.engine": "The geometry engine stopped on this file.",
    "dq.err.empty": "Model space is empty; the drawing is only in layouts (paper space).",
    "dq.nm.text": "Text",
    "dq.nm.dim": "Dimensions",
    "dq.nm.solid3d": "3D solids",
    "dq.nm.mesh": "Meshes",
    "dq.nm.proxy": "Unknown items (proxy)",
    "dq.nm.other": "Other",
    "dq.nm.insideBlocks": "Inside blocks",
    "dq.nm.xrefs": "External references (not loaded)",
    "dq.sheet.summary": "Summary",
    "dq.sheet.layers": "Layers",
    "dq.sheet.blocks": "Blocks",
    "dq.sheet.schedules": "Schedules",
    "dq.xlsx.partial": "Minimum totals: {files} could not be read.",
    "dq.survey.q": "How do you take quantities off drawings today?",
    "dq.survey.hand": "By hand or in Excel",
    "dq.survey.cad": "With CAD commands or LISP",
    "dq.survey.other": "With another program",
    "dq.survey.thanks": "Thank you!",
    "dq.tip.layer": "Layer",
    "dq.tip.kind": "Type",
    "dq.tip.len": "Length",
    "dq.tip.area": "Area",
    "dq.tip.block": "Block",
    "dq.tip.copies": "Copies",
    "dq.kind.line": "Line",
    "dq.kind.arc": "Arc",
    "dq.kind.circle": "Circle",
    "dq.kind.polyline": "Polyline",
    "dq.kind.spline": "Spline",
    "dq.kind.ellipse": "Ellipse",
    "dq.kind.hatch": "Hatch",
    "dq.kind.insert": "Block",
    "dq.aria.files": "Files",
    "dq.aria.tabs": "The drawing’s files",
    "dq.aria.drawing": "Drawing of the selected file",
    "dq.back": "Home",
    "dq.cta.title": "Want the quantities inside your work?",
    "dq.notice": "Geometry engine: Eyeshot.",
    "dq.nm.none": "Everything in model space was measured.",
    "dq.units.line": "Units: {units} ({source})",
    "dq.units.change": "Change",
    "dq.units.fromFile": "As the file says",
    "dq.units.src.file": "from the file",
    "dq.units.src.setting": "from the settings",
    "dq.units.src.assumed": "assumed",
    "dq.units.src.override": "your choice",
    "dq.warn.units-override": "Measured in {units} instead of the {file} the file states.",
    "dq.example.failed": "The example could not be loaded. Please try again.",
    "dq.tab.close": "Close"
  },
  it: {
    "dq.eyebrow": "Strumento gratuito",
    "dq.title": "Computi da DWG",
    "dq.lede": "Trascinate disegni DWG o DXF e ottenete lunghezze, aree e conteggi dei blocchi per layer, con le tabelle degli attributi, in Excel.",
    "dq.privacy": "I file restano sul vostro computer; non viene caricato nulla.",
    "dq.cross": "Tutti gli strumenti gratuiti →",
    "dq.open": "Apri file",
    "dq.example": "Carica esempio",
    "dq.drop": "Trascinate qui file DWG o DXF, oppure premete «Apri file».",
    "dq.engine.loading": "Caricamento del motore geometrico, circa 12 MB, solo la prima volta… {pct} %",
    "dq.engine.failed": "Il motore geometrico non è riuscito ad avviarsi in questo browser.",
    "dq.engine.retry": "Riprovate",
    "dq.engine.nowasm": "Il vostro browser non supporta WebAssembly, necessario per lo strumento. Provate una versione recente di Chrome, Edge, Firefox o Safari.",
    "dq.toomany": "Fino a {max} file alla volta; gli altri non sono stati caricati.",
    "dq.tab.summary": "Riepilogo",
    "dq.status.ok": "Pronto",
    "dq.status.warn": "Con avvisi",
    "dq.status.error": "Non letto",
    "dq.waiting": "in attesa…",
    "dq.processing": "elaborazione…",
    "dq.remove": "Rimuovi file",
    "dq.clear": "Svuota",
    "dq.table.layers": "Layer",
    "dq.table.blocks": "Blocchi",
    "dq.table.schedules": "Tabelle degli attributi",
    "dq.table.notMeasured": "Non misurati",
    "dq.col.file": "File",
    "dq.col.layer": "Layer",
    "dq.col.color": "Colore",
    "dq.col.len": "Lunghezza (m)",
    "dq.col.count": "Numero",
    "dq.col.area": "Area (m²)",
    "dq.col.hatchArea": "Area tratteggi (m²)",
    "dq.col.block": "Blocco",
    "dq.col.nested": "Annidati",
    "dq.col.state": "Stato",
    "dq.badge.off": "spento",
    "dq.badge.frozen": "congelato",
    "dq.badge.bad": "{n} aree escluse",
    "dq.total": "Totale",
    "dq.partial": "«≥»: {files} non è stato possibile leggerli, quindi i totali sono minimi.",
    "dq.schedules.none": "Nessun blocco con attributi.",
    "dq.blocks.none": "Nessun blocco nello spazio modello.",
    "dq.drawing": "Disegno",
    "dq.fit": "Adatta",
    "dq.zoomin": "Ingrandisci",
    "dq.zoomout": "Riduci",
    "dq.simplified": "Vista semplificata: il disegno è grande, quindi le curve sono disegnate in modo più grossolano. I numeri non cambiano.",
    "dq.sel.title": "Selezione",
    "dq.sel.hint": "Fate clic su un elemento, o trascinate una finestra: da sinistra a destra per ciò che è tutto dentro, da destra a sinistra per ciò che tocca. Maiusc+clic aggiunge o toglie, Esc svuota.",
    "dq.sel.items": "{n} elementi",
    "dq.sel.copy": "Copia",
    "dq.sel.copied": "Copiato",
    "dq.sel.clear": "Svuota la selezione",
    "dq.sel.blocks": "Blocchi nella selezione",
    "dq.cta.groups": "Vi servono gruppi collegati al vostro computo metrico o al vostro ERP? Li realizziamo noi.",
    "dq.cta.groupsLink": "Parliamone",
    "dq.cta.text": "Volete questi computi dentro il vostro flusso di lavoro? Realizziamo software attorno ai vostri standard.",
    "dq.cta.link": "Contattateci",
    "dq.settings.title": "Impostazioni",
    "dq.settings.units": "Unità per i file che non le dichiarano",
    "dq.unit.auto": "Automatico (mm)",
    "dq.unit.mm": "Millimetri (mm)",
    "dq.unit.cm": "Centimetri (cm)",
    "dq.unit.m": "Metri (m)",
    "dq.unit.inch": "Pollici (in)",
    "dq.unit.ft": "Piedi (ft)",
    "dq.xlsx": "Scarica Excel (.xlsx)",
    "dq.warn.units-assumed": "Il file non dichiara le unità; sono stati assunti i millimetri. Cambiatelo nelle impostazioni se non è corretto.",
    "dq.warn.units-setting": "Il file non dichiara le unità; sono stati usati {units} dalle impostazioni.",
    "dq.warn.xrefs": "Riferimenti esterni non caricati: {count}",
    "dq.warn.bad-area": "Linee chiuse che si autointersecano o tratteggi senza un’area calcolabile, esclusi dai totali: {count}",
    "dq.warn.inside-blocks": "Elementi dentro i blocchi non aggiunti a lunghezze e aree: {count}",
    "dq.warn.not-measured": "Elementi non misurati (testi, quote, solidi e altri): {count}",
    "dq.warn.simplified": "Disegno grande: la vista è semplificata, i numeri no.",
    "dq.err.read": "Non è stato possibile leggere il file. È un DWG o un DXF?",
    "dq.err.version": "Questa versione DWG non è supportata. Salvatelo come DWG 2018 o precedente.",
    "dq.err.limit": "Il file supera i limiti dello strumento (30 MB o 300.000 elementi).",
    "dq.err.timeout": "L’elaborazione ha superato un minuto.",
    "dq.err.engine": "Il motore geometrico si è fermato su questo file.",
    "dq.err.empty": "Lo spazio modello è vuoto; il disegno è solo nei layout (spazio carta).",
    "dq.nm.text": "Testi",
    "dq.nm.dim": "Quote",
    "dq.nm.solid3d": "Solidi 3D",
    "dq.nm.mesh": "Mesh",
    "dq.nm.proxy": "Elementi sconosciuti (proxy)",
    "dq.nm.other": "Altri",
    "dq.nm.insideBlocks": "Dentro i blocchi",
    "dq.nm.xrefs": "Riferimenti esterni (non caricati)",
    "dq.sheet.summary": "Riepilogo",
    "dq.sheet.layers": "Layer",
    "dq.sheet.blocks": "Blocchi",
    "dq.sheet.schedules": "Attributi",
    "dq.xlsx.partial": "Totali minimi: {files} non è stato possibile leggerli.",
    "dq.survey.q": "Come ricavate oggi i computi dai disegni?",
    "dq.survey.hand": "A mano o in Excel",
    "dq.survey.cad": "Con comandi CAD o LISP",
    "dq.survey.other": "Con un altro programma",
    "dq.survey.thanks": "Grazie!",
    "dq.tip.layer": "Layer",
    "dq.tip.kind": "Tipo",
    "dq.tip.len": "Lunghezza",
    "dq.tip.area": "Area",
    "dq.tip.block": "Blocco",
    "dq.tip.copies": "Copie",
    "dq.kind.line": "Linea",
    "dq.kind.arc": "Arco",
    "dq.kind.circle": "Cerchio",
    "dq.kind.polyline": "Polilinea",
    "dq.kind.spline": "Spline",
    "dq.kind.ellipse": "Ellisse",
    "dq.kind.hatch": "Tratteggio",
    "dq.kind.insert": "Blocco",
    "dq.aria.files": "File",
    "dq.aria.tabs": "I file del disegno",
    "dq.aria.drawing": "Disegno del file selezionato",
    "dq.back": "Home",
    "dq.cta.title": "Volete i computi dentro il vostro lavoro?",
    "dq.notice": "Motore geometrico: Eyeshot.",
    "dq.nm.none": "Tutto lo spazio modello è stato misurato.",
    "dq.units.line": "Unità: {units} ({source})",
    "dq.units.change": "Cambia",
    "dq.units.fromFile": "Come dichiara il file",
    "dq.units.src.file": "dal file",
    "dq.units.src.setting": "dalle impostazioni",
    "dq.units.src.assumed": "ipotesi",
    "dq.units.src.override": "vostra scelta",
    "dq.warn.units-override": "Misurato in {units} invece che in {file} come dichiara il file.",
    "dq.example.failed": "Non è stato possibile caricare l’esempio. Riprovate.",
    "dq.tab.close": "Chiudi"
  }
};
```


Run: `node _tests/extract.mjs $PLAN js/dwg/i18n-dwg.js && node --test "_tests/dwg/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 33`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/dwg/i18n-dwg.js _tests/dwg/i18n.test.js
git commit -F - <<'EOF'
DWG quantities: the tool's strings (GR/EN/IT)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 11: The page and its styles

**Files:**
- Create: `dwg-quantities.html`
- Modify: `css/tools.css` (a DWG quantities section appended; no existing rule changes)

**Interfaces:**
- Consumes: the strings (Task 10); the site's shell (`js/gcode/shell/`), consent, GA and language switch, copied from `laser-dxf-checker.html`.
- Produces: the element ids the controller uses: `dqInput`, `dqExample`, `dqXlsx`, `dqClear`, `dqBanner`, `dqDropHint`, `dqTabs`, `dqPanel`, `dqStatus`, `dqError`, `dqWarnings`, `dqWork`, `dqFileName`, `dqFit`, `dqZoomOut`, `dqZoomIn`, `dqCanvas`, `dqTip`, `dqSimplified`, `dqSel`, `dqSelHint`, `dqSelCount`, `dqSelLayers`, `dqSelBlocks`, `dqCopy`, `dqSelClear`, `dqCtaGroups`, `dqLayers`, `dqLayerTotals`, `dqPartial`, `dqBlocks`, `dqBlockTotals`, `dqNoBlocks`, `dqFileOnly`, `dqSchedules`, `dqNotMeasured`, `dqSettings`, `dqUnits`, `dqCta`, `dqSurvey`, `dqThanks`.

- [ ] **Step 1: Write the page and the styles**

<!-- file: dwg-quantities.html -->
```html
<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AidedCAM - Επιμετρήσεις από DWG</title>
  <meta name="description" content="Δωρεάν επιμετρήσεις από σχέδια DWG και DXF: μήκη, εμβαδά, διαγραμμίσεις και πλήθη μπλοκ ανά στρώση, πίνακες χαρακτηριστικών, σε Excel. Χωρίς εγκατάσταση, χωρίς εγγραφή." />
  <meta name="robots" content="index, follow" />
  <link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="icon-192.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png" />
  <meta name="theme-color" content="#f4f3ee" />
  <link rel="canonical" href="https://www.aidedcam.com/dwg-quantities.html" />
  <meta property="og:title" content="AidedCAM - Επιμετρήσεις από DWG" />
  <meta property="og:description" content="Ρίξτε σχέδια DWG ή DXF και πάρτε μήκη, εμβαδά και πλήθη μπλοκ ανά στρώση, σε Excel." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://www.aidedcam.com/dwg-quantities.html" />
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
        <a href="index.html" class="nav-back" data-i18n="dq.back">Αρχική</a>
        <div class="lang-switcher">
          <button class="lang-btn active" data-lang="el">EL</button>
          <button class="lang-btn" data-lang="en">EN</button>
          <button class="lang-btn" data-lang="it">IT</button>
        </div>
      </div>
    </div>
  </nav>

  <main class="gv dq">
    <header class="gv-head">
      <p class="gv-eyebrow" data-i18n="dq.eyebrow">Δωρεάν εργαλείο</p>
      <h1 data-i18n="dq.title">Επιμετρήσεις από DWG</h1>
      <p class="gv-lede" data-i18n="dq.lede">Ρίξτε σχέδια DWG ή DXF και πάρτε μήκη, εμβαδά και πλήθη μπλοκ ανά στρώση, μαζί με τους πίνακες χαρακτηριστικών, σε Excel.</p>
      <p class="gv-privacy" data-i18n="dq.privacy">Τα αρχεία μένουν στον υπολογιστή σας· τίποτα δεν ανεβαίνει.</p>
      <p class="gv-cross"><a href="free-tools.html" data-i18n="dq.cross">Όλα τα δωρεάν εργαλεία →</a></p>
    </header>

    <div class="gv-wrap">
      <noscript><p class="gv-banner">Το εργαλείο χρειάζεται JavaScript. / The tool needs JavaScript.</p></noscript>

      <section class="gv-bar" data-i18n-aria="dq.aria.files" aria-label="Αρχεία">
        <label class="gv-btn gv-btn-primary gv-file-label">
          <input type="file" id="dqInput" multiple accept=".dwg,.dxf" class="gv-visually-hidden" />
          <span data-i18n="dq.open">Άνοιγμα αρχείων</span>
        </label>
        <button type="button" class="gv-btn" id="dqExample" data-i18n="dq.example">Φόρτωση παραδείγματος</button>
        <button type="button" class="gv-btn" id="dqXlsx" data-i18n="dq.xlsx" disabled>Λήψη Excel (.xlsx)</button>
        <button type="button" class="gv-btn" id="dqClear" data-i18n="dq.clear">Καθαρισμός</button>
      </section>

      <div class="gv-banner" id="dqBanner" role="status" hidden></div>
      <p class="gv-drop-hint" id="dqDropHint" data-i18n="dq.drop">Σύρετε εδώ αρχεία DWG ή DXF, ή πατήστε «Άνοιγμα αρχείων».</p>

      <div class="dq-tabs" id="dqTabs" role="tablist" data-i18n-aria="dq.aria.tabs" aria-label="Αρχεία του σχεδίου" hidden></div>

      <section class="dq-panel" id="dqPanel" hidden>
        <div class="dq-status" id="dqStatus"></div>
        <div class="dq-error" id="dqError" role="alert" hidden></div>
        <ul class="gv-check-list dq-warnings" id="dqWarnings"></ul>

        <div class="dq-work" id="dqWork">
          <div class="dq-view">
            <div class="gv-panel-head">
              <span><span data-i18n="dq.drawing">Σχέδιο</span> · <span id="dqFileName"></span></span>
              <span class="gv-tools-controls">
                <button type="button" class="gv-link" id="dqFit" data-i18n="dq.fit">Προσαρμογή</button>
                <button type="button" class="gv-zoom" id="dqZoomOut" data-i18n-aria="dq.zoomout" aria-label="Σμίκρυνση">−</button>
                <button type="button" class="gv-zoom" id="dqZoomIn" data-i18n-aria="dq.zoomin" aria-label="Μεγέθυνση">+</button>
              </span>
            </div>
            <div class="dq-canvas-box">
              <canvas class="dq-canvas" id="dqCanvas" role="img" data-i18n-aria="dq.aria.drawing" aria-label="Σχέδιο του επιλεγμένου αρχείου"></canvas>
              <div class="dq-tip" id="dqTip" hidden></div>
            </div>
            <p class="gv-note dq-simplified" id="dqSimplified" data-i18n="dq.simplified" hidden>Απλοποιημένη προβολή: το σχέδιο είναι μεγάλο και οι καμπύλες σχεδιάζονται πιο αδρά. Οι αριθμοί δεν αλλάζουν.</p>
          </div>

          <aside class="dq-sel" id="dqSel">
            <h2 data-i18n="dq.sel.title">Επιλογή</h2>
            <p class="gv-note" id="dqSelHint" data-i18n="dq.sel.hint">Κάντε κλικ σε ένα στοιχείο, ή σύρετε ένα παράθυρο.</p>
            <p class="dq-sel-count" id="dqSelCount" hidden></p>
            <div class="gv-table-wrap">
              <table class="gv-table dq-sel-layers" id="dqSelLayers" hidden>
                <thead><tr><th data-i18n="dq.col.layer">Στρώση</th><th data-i18n="dq.col.len">Μήκος (m)</th><th data-i18n="dq.col.area">Εμβαδόν (m²)</th><th data-i18n="dq.col.hatchArea">Εμβαδόν διαγράμμισης (m²)</th></tr></thead>
                <tbody></tbody>
                <tfoot><tr><td data-i18n="dq.total">Σύνολο</td><td></td><td></td><td></td></tr></tfoot>
              </table>
            </div>
            <div class="gv-table-wrap">
              <table class="gv-table dq-sel-blocks" id="dqSelBlocks" hidden>
                <thead><tr><th data-i18n="dq.sel.blocks">Μπλοκ στην επιλογή</th><th data-i18n="dq.col.count">Πλήθος</th></tr></thead>
                <tbody></tbody>
              </table>
            </div>
            <p class="dq-sel-actions">
              <button type="button" class="gv-btn" id="dqCopy" data-i18n="dq.sel.copy" disabled>Αντιγραφή</button>
              <button type="button" class="gv-link" id="dqSelClear" data-i18n="dq.sel.clear" disabled>Καθαρισμός επιλογής</button>
            </p>
            <p class="dq-sel-cta"><span data-i18n="dq.cta.groups">Χρειάζεστε ομάδες αντιστοιχισμένες στον προϋπολογισμό σας ή στο ERP σας; Το φτιάχνουμε.</span>
              <a href="index.html#contact" id="dqCtaGroups" data-i18n="dq.cta.groupsLink">Μιλήστε μαζί μας</a></p>
          </aside>
        </div>

        <div class="dq-tables">
          <h2 data-i18n="dq.table.layers">Στρώσεις</h2>
          <div class="gv-table-wrap">
            <table class="gv-table dq-layers" id="dqLayers">
              <thead>
                <tr>
                  <th data-i18n="dq.col.color">Χρώμα</th>
                  <th data-i18n="dq.col.layer">Στρώση</th>
                  <th data-i18n="dq.col.len">Μήκος (m)</th>
                  <th data-i18n="dq.col.count">Πλήθος</th>
                  <th data-i18n="dq.col.area">Εμβαδόν (m²)</th>
                  <th data-i18n="dq.col.count">Πλήθος</th>
                  <th data-i18n="dq.col.hatchArea">Εμβαδόν διαγράμμισης (m²)</th>
                  <th data-i18n="dq.col.count">Πλήθος</th>
                  <th data-i18n="dq.col.state">Κατάσταση</th>
                </tr>
              </thead>
              <tbody></tbody>
              <tfoot><tr id="dqLayerTotals"><td></td><td data-i18n="dq.total">Σύνολο</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr></tfoot>
            </table>
          </div>
          <p class="gv-note" id="dqPartial" hidden></p>

          <h2 data-i18n="dq.table.blocks">Μπλοκ</h2>
          <div class="gv-table-wrap">
            <table class="gv-table dq-blocks" id="dqBlocks">
              <thead><tr><th data-i18n="dq.col.block">Μπλοκ</th><th data-i18n="dq.col.layer">Στρώση</th><th data-i18n="dq.col.count">Πλήθος</th><th data-i18n="dq.col.nested">Εμφωλευμένα</th></tr></thead>
              <tbody></tbody>
              <tfoot><tr id="dqBlockTotals"><td data-i18n="dq.total">Σύνολο</td><td></td><td></td><td></td></tr></tfoot>
            </table>
          </div>
          <p class="gv-note" id="dqNoBlocks" data-i18n="dq.blocks.none" hidden>Κανένα μπλοκ στον χώρο μοντέλου.</p>

          <div id="dqFileOnly">
            <h2 data-i18n="dq.table.schedules">Πίνακες χαρακτηριστικών</h2>
            <div id="dqSchedules"></div>
            <h2 data-i18n="dq.table.notMeasured">Δεν μετρήθηκαν</h2>
            <ul class="gv-check-list" id="dqNotMeasured"></ul>
          </div>
        </div>
      </section>

      <details class="gv-settings dq-settings" id="dqSettings">
        <summary data-i18n="dq.settings.title">Ρυθμίσεις</summary>
        <div class="gv-settings-grid">
          <label><span data-i18n="dq.settings.units">Μονάδες για αρχεία που δεν τις δηλώνουν</span><select id="dqUnits"></select></label>
        </div>
      </details>

      <section class="gv-cta">
        <h2 data-i18n="dq.cta.title">Θέλετε τις επιμετρήσεις μέσα στη δουλειά σας;</h2>
        <p data-i18n="dq.cta.text">Θέλετε αυτές τις επιμετρήσεις μέσα στη δική σας ροή εργασίας; Φτιάχνουμε λογισμικό γύρω από τα δικά σας πρότυπα.</p>
        <a class="btn-primary" id="dqCta" href="index.html#contact" data-i18n="dq.cta.link">Επικοινωνήστε μαζί μας</a>
        <div class="gv-survey" id="dqSurvey">
          <p data-i18n="dq.survey.q">Πώς βγάζετε σήμερα επιμετρήσεις από σχέδια;</p>
          <button type="button" class="gv-chip" data-answer="hand" data-i18n="dq.survey.hand">Με το χέρι ή σε Excel</button>
          <button type="button" class="gv-chip" data-answer="cad" data-i18n="dq.survey.cad">Με εντολές ή LISP στο CAD</button>
          <button type="button" class="gv-chip" data-answer="other" data-i18n="dq.survey.other">Με άλλο πρόγραμμα</button>
          <p class="gv-thanks" id="dqThanks" data-i18n="dq.survey.thanks" hidden>Ευχαριστούμε!</p>
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
    <p class="lc-notice"><span data-i18n="dq.notice">Μηχανή γεωμετρίας: Eyeshot.</span> Portion of copyright © devDept Software S.r.l. All Rights Reserved.</p>
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

  <script src="js/dwg/i18n-dwg.js?v=20261015"></script>
  <script>
    var translations = {
      el: {
        "_title": "AidedCAM - Επιμετρήσεις από DWG",
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
        "_title": "AidedCAM - Quantities from DWG",
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
        "_title": "AidedCAM - Computi da DWG",
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
      translations[l] = Object.assign({}, (window.DQ_I18N || {})[l] || {}, translations[l]);
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
  <script type="module" src="js/dwg/ui.js?v=20261015"></script>
</body>
</html>
```

<!-- file: _tests/private/append-dwg.css -->
```css

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
```


Run:
```bash
node _tests/extract.mjs $PLAN dwg-quantities.html
node _tests/extract.mjs $PLAN _tests/private/append-dwg.css && cat _tests/private/append-dwg.css >> css/tools.css && rm _tests/private/append-dwg.css
git diff --stat css/tools.css
```
Expected: `css/tools.css | 50 ++++…`, insertions only.

- [ ] **Step 2: Check it**

Run: `grep -c 'Portion of copyright © devDept Software S.r.l. All Rights Reserved.' dwg-quantities.html && node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js" "_tests/laser/*.test.js" "_tests/dwg/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `1`, then `ℹ pass 335`, `ℹ fail 0` (the other tools' tests still pass with the appended styles).

Open `http://127.0.0.1:8765/dwg-quantities.html`: the header, the buttons and the footer show; nothing works yet (the controller comes in Task 12).

- [ ] **Step 3: Commit**

```bash
git add dwg-quantities.html css/tools.css
git commit -F - <<'EOF'
DWG quantities: the page and its styles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 12: The controller

**Files:**
- Create: `js/dwg/ui.js`

**Interfaces:**
- Consumes: everything above. `createEngine` from `js/laser/bridge.js` with this page's own `makeWorker` and `timeoutMs: 60000`.
- Produces: the working page. GA events (consent-gated): `dwgq_files_loaded { files, errors, layers, blocks, schedules }`, `dwgq_example_loaded`, `dwgq_selection { items }` (once per file), `dwgq_copy`, `dwgq_xlsx_download { files }`, `dwgq_cta_click { where: 'page' | 'selection' }`, `dwgq_units_override { units }`, `dwgq_survey { answer }`.

- [ ] **Step 1: Write the controller**

<!-- file: js/dwg/ui.js -->
```js
// DWG quantities: the page controller (spec §5). Files go to the engine worker one at a time; the page keeps
// each file's result, shows one file (or the Summary) at a time, and does selection totals and the .xlsx in
// JavaScript, so neither ever calls the engine.
import { t, ga, fmtNum } from '../gcode/shell/i18n.js';
import { lsGet, lsSet, loadStored, saveStored } from '../gcode/shell/settings-store.js';
import { renderBanner } from '../gcode/shell/banner.js';
// The tool's own modules carry the deploy version, so a cached old module never meets a new controller.
import { createEngine } from '../laser/bridge.js?v=20261015';
import { layerRows, layerTotals, blockRows, blockTotals, summary, notMeasuredCount } from './tables.js?v=20261015';
import { selectBox, selectionTotals, selectionTsv } from './selection.js?v=20261015';
import { writeXlsx, workbookFor, xlsxName } from './xlsx.js?v=20261015';
import { createView } from './view.js?v=20261015';
import { UNITS, INFO_WARNINGS, rowItems, clickSelection, boxSelection, fileStatus, engineSettings, admit, loadedEvent } from './state.js?v=20261015';

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
let nextId = 0, batch = null, shown = null;

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
  f.status = 'processing';
  render();
  const m = await engine.process(f.name, f.bytes.slice(0), engineSettings(state.settings, f));
  if (!state.files.includes(f)) return;                          // removed meanwhile
  f.result = m;
  f.status = 'done';
  if (m.type === 'error' && m.reason === 'engine' && !state.engineReady) {
    showBanner({ key: 'dq.engine.failed', action: { key: 'dq.engine.retry', run: () => location.reload() } });
  }
  if (f.id === state.active) { state.sel = []; state.hl = null; state.pickRow = null; }
  render();
  if (batch && batch.files.includes(f)) finishBatch(f);
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
  batch = { files: added, left: added.length, source, counted: new Set() };
  render();
  for (const f of added) { if (f.status === 'done') finishBatch(f); else run(f); }
}

function finishBatch(f) {
  if (!batch || batch.counted.has(f)) return;
  batch.counted.add(f);
  if (--batch.left > 0) return;
  if (batch.source === 'example') ga('dwgq_example_loaded', {});
  else ga('dwgq_files_loaded', loadedEvent(batch.files));
  batch = null;
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
function usedUnits(f) {
  const file = f.result.file;
  if (file.unitsSource === 'override') return f.override || file.units;
  if (file.unitsSource === 'file') return file.units;
  if (file.unitsSource === 'setting') return state.settings.units;
  return 'mm';
}

function unitsSelect(f) {
  const s = document.createElement('select');
  s.setAttribute('aria-label', t('dq.units.change'));
  const opt = (v, label) => { const o = el('option', null, label); o.value = v; s.appendChild(o); };
  opt('', t('dq.units.fromFile'));
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
    tip.replaceChildren(...lines.map(([k, v], n) => { const d = el('div'); d.append(el('b', null, k + ': '), document.createTextNode(v)); return d; }));
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
  $('dqXlsx').disabled = !state.files.some(okResult);
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
  // Only files that state no units depend on this setting.
  for (const f of state.files) if (okResult(f) && f.result.file.unitsSource !== 'file' && !f.override) run(f);
});

// ---- downloads and the clipboard ----
function save(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('dqXlsx').addEventListener('click', () => {
  const files = state.files.filter(f => f.status === 'done').map(f => ({ name: f.name, result: f.result }));
  if (!files.some(f => f.result.type === 'result')) return;
  save(new Blob([writeXlsx(workbookFor(files, t))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), xlsxName(files));
  ga('dwgq_xlsx_download', { files: files.length });
});
$('dqCopy').addEventListener('click', async () => {
  const f = activeFile();
  if (!okResult(f) || !state.sel.length) return;
  const text = selectionTsv(selectionTotals(f.result.items, state.sel), t);
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


Run: `node _tests/extract.mjs $PLAN js/dwg/ui.js && node --test "_tests/dwg/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 33`, `ℹ fail 0` (the strings test now also sees the controller's keys).

- [ ] **Step 2: Try it**

Open `http://127.0.0.1:8765/dwg-quantities.html?lang=en` and click **Load example**. The engine banner counts up once; then the layer table shows `ΤΟΙΧΟΙ 85.60 … 108.16` and `ΔΑΠΕΔΑ … 107.84`, and the drawing shows the apartment. Task 14 checks the rest.

- [ ] **Step 3: Commit**

```bash
git add js/dwg/ui.js
git commit -F - <<'EOF'
DWG quantities: the controller

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 13: Site links

**Files:**
- Modify: `free-tools.html` (a card, 6 strings, the description), `sitemap.xml` (an entry), `llms.txt` (a line)
- Test: `_tests/dwg/site.test.js`

**Interfaces:**
- Produces: the card `<a class="ft-card" href="dwg-quantities.html">` with `ft.dwgq.title` and `ft.dwgq.text` in el/en/it. The existing test `tools index: every key it uses exists in el, en and it` in `_tests/gcode/i18n.test.js` covers the new keys.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/dwg/site.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

test('the tools index, the sitemap and llms.txt list the DWG quantities tool', () => {
  const ft = read('../../free-tools.html');
  assert.ok(ft.includes('<a class="ft-card" href="dwg-quantities.html">'));
  assert.equal(ft.split('"ft.dwgq.text":').length - 1, 3, 'one card text per language');
  assert.ok(read('../../sitemap.xml').includes('<loc>https://www.aidedcam.com/dwg-quantities.html</loc>'));
  assert.ok(read('../../llms.txt').includes('- DWG quantities (https://www.aidedcam.com/dwg-quantities.html)'));
});

test('the page carries the devDept notice verbatim and loads no engine up front', () => {
  const page = read('../../dwg-quantities.html');
  assert.ok(page.includes('Portion of copyright © devDept Software S.r.l. All Rights Reserved.'));
  assert.ok(!/src="[^"]*engine\//.test(page), 'the engine loads in the worker, on the first file');
});
```


Run: `node _tests/extract.mjs $PLAN _tests/dwg/site.test.js && node --test "_tests/dwg/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 34`, `ℹ fail 1` (the page test passes; the links don't exist yet).

- [ ] **Step 2: Edit the three files**

Every replacement in the script must match the expected number of times, or it throws before writing.

<!-- file: _tests/private/edit-site-links.mjs -->
```js
// One-off site edits (plan Task 13): a DWG quantities card on the tools index, its sitemap entry and its
// llms.txt line. Every replacement must match exactly the expected number of times, or nothing is written.
import { readFileSync, writeFileSync } from 'node:fs';

const eolOf = s => (s.includes('\r\n') ? '\r\n' : '\n');
function swap(text, from, to, times, what) {
  const n = text.split(from).length - 1;
  if (n !== times) throw new Error(`${what}: expected ${times} match(es), found ${n}`);
  return text.split(from).join(to);
}

let ft = readFileSync('free-tools.html', 'utf8');
const E = eolOf(ft);
const laserCard = [
  '          <p data-i18n="ft.laser.text">Διορθώνει τα DXF και DWG μιας παραγγελίας (κενά, διπλές γραμμές, ανοιχτά περιγράμματα) και δίνει μήκος κοπής, διατρήσεις, βάρος, χρόνο και καθαρό DXF για το laser.</p>',
  '          <span class="ft-open" data-i18n="ft.open">Άνοιγμα →</span>',
  '        </a>',
].join(E);
const strings = {
  el: ['Επιμετρήσεις από DWG', 'Μήκη, εμβαδά και εμβαδά διαγράμμισης ανά στρώση, πλήθος μπλοκ και πίνακες ιδιοτήτων (π.χ. κουφώματα) από αρχεία DWG και DXF, με το σχέδιο για επιβεβαίωση και λήψη σε Excel.'],
  en: ['Quantities from DWG', 'Lengths, areas and hatch areas per layer, block counts and attribute schedules (doors, windows) from DWG and DXF files, with the drawing to check them and an Excel download.'],
  it: ['Computi da DWG', 'Lunghezze, aree e aree dei tratteggi per layer, conteggio dei blocchi e tabelle degli attributi (porte, finestre) da file DWG e DXF, con il disegno per verificarle e il download in Excel.'],
};
ft = swap(ft, laserCard, laserCard + E + [
  '        <a class="ft-card" href="dwg-quantities.html">',
  `          <h2 data-i18n="ft.dwgq.title">${strings.el[0]}</h2>`,
  `          <p data-i18n="ft.dwgq.text">${strings.el[1]}</p>`,
  '          <span class="ft-open" data-i18n="ft.open">Άνοιγμα →</span>',
  '        </a>',
].join(E), 1, 'laser card');
const laserText = {
  el: '"ft.laser.text": "Διορθώνει τα DXF και DWG μιας παραγγελίας (κενά, διπλές γραμμές, ανοιχτά περιγράμματα) και δίνει μήκος κοπής, διατρήσεις, βάρος, χρόνο και καθαρό DXF για το laser.",',
  en: '"ft.laser.text": "Repairs the DXF and DWG files of an order (gaps, doubled lines, open contours) and gives cut length, pierces, weight, time and a clean DXF for the laser.",',
  it: '"ft.laser.text": "Corregge i file DXF e DWG di un ordine (interruzioni, linee doppie, contorni aperti) e fornisce lunghezza di taglio, sfondamenti, peso, tempo e un DXF pulito per il laser.",',
};
for (const l of ['el', 'en', 'it']) {
  const [title, text] = strings[l];
  ft = swap(ft, laserText[l], laserText[l] + E + `        "ft.dwgq.title": "${title}",` + E + `        "ft.dwgq.text": "${text}",`, 1, `${l} strings`);
}
// The index now serves building offices too, not only CNC programmers.
ft = swap(ft, 'Δωρεάν εργαλεία για προγραμματιστές CNC: προβολή G-code τόρνου και φρέζας με χρόνο κύκλου και ελέγχους προγράμματος, και έλεγχος DXF για κοπή laser. Στον browser, χωρίς εγγραφή.',
  'Δωρεάν εργαλεία για μηχανικούς και προγραμματιστές CNC: προβολή G-code τόρνου και φρέζας με χρόνο κύκλου, έλεγχος DXF για κοπή laser και ποσότητες από DWG. Στον browser, χωρίς εγγραφή.', 1, 'description');
writeFileSync('free-tools.html', ft);

let sitemap = readFileSync('sitemap.xml', 'utf8');
const S = eolOf(sitemap);
const entry = ['  <url>', '    <loc>https://www.aidedcam.com/dwg-quantities.html</loc>', '    <lastmod>2026-10-15</lastmod>',
  '    <changefreq>monthly</changefreq>', '    <priority>0.8</priority>', '  </url>'].join(S);
sitemap = swap(sitemap, '</urlset>', entry + S + '</urlset>', 1, 'sitemap');
writeFileSync('sitemap.xml', sitemap);

let llms = readFileSync('llms.txt', 'utf8');
const L = eolOf(llms);
const laser = llms.split(/\r?\n/).filter(x => x.startsWith('- Laser DXF check'));
if (laser.length !== 1) throw new Error('expected one laser line in llms.txt');
llms = swap(llms, laser[0], laser[0] + L +
  '- DWG quantities (https://www.aidedcam.com/dwg-quantities.html): runs in the browser, nothing is uploaded; reads DWG and DXF '
  + 'files (up to the 2018 format), several at once, and gives per layer the lengths of lines, arcs, polylines and splines, the '
  + 'areas of closed outlines and of hatches (islands subtracted), block counts by name (dynamic blocks under their own name, '
  + 'nested blocks counted) and block-attribute schedules such as door and window tables, with the drawing to check what was '
  + 'counted, selection totals, and an Excel (.xlsx) download. Geometry engine: Eyeshot (devDept Software). Greek, English, Italian.', 1, 'llms');
writeFileSync('llms.txt', llms);
console.log('links edited');
```


Run: `node _tests/extract.mjs $PLAN _tests/private/edit-site-links.mjs && node _tests/private/edit-site-links.mjs && rm _tests/private/edit-site-links.mjs && git diff --stat`
Expected: `links edited`; `free-tools.html` 13 lines changed (12 insertions, 1 deletion), `sitemap.xml` 6 insertions, `llms.txt` 1.

- [ ] **Step 3: Run everything**

Run: `node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js" "_tests/laser/*.test.js" "_tests/dwg/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 337`, `ℹ fail 0`.

- [ ] **Step 4: Commit**

```bash
git add free-tools.html sitemap.xml llms.txt _tests/dwg/site.test.js
git commit -F - <<'EOF'
DWG quantities: tools index card, sitemap and llms.txt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 14: Browser verification

**Files:**
- Create: `_tests/dwg/browser-check.js` (dev-only; committed so the checks can be rerun after any change)

The checks are one Playwright function. The server from Task 4 must be running on port 8765.

- [ ] **Step 1: Write the check**

<!-- file: _tests/dwg/browser-check.js -->
```js
// Dev-only browser check of dwg-quantities.html (plan Task 14; Jekyll skips _tests). It is one Playwright
// function: run it with the Playwright MCP (browser_run_code_unsafe, filename: _tests/dwg/browser-check.js)
// or with node _tests/dwg/browser-check.cjs. It expects the repo root served on http://127.0.0.1:8765/ and
// returns { pass, fail, checks: [{ name, ok, got }] }.
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

  const rowText = sel => page.$$eval(sel, trs => trs.map(tr => [...tr.cells].map(c => c.textContent.trim()).join(' | ')));
  const waitRows = (min = 1) => page.waitForFunction(n => document.querySelectorAll('#dqLayers tbody tr').length >= n, min, { timeout: 60000 });

  // 0. Desktop–browser parity on the committed fixtures (spec §11 gate).
  await page.goto(BASE + '_tests/dwg/parity.html');
  await page.waitForFunction(() => window.__parity, null, { timeout: 120000 });
  const parity = await page.evaluate(() => window.__parity);
  check('parity: every fixture matches the desktop engine', parity.files === 6 && parity.failed === 0, parity);

  // 1. The page paints without the engine.
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto(BASE + 'dwg-quantities.html?lang=en');
  check('title', (await page.title()) === 'AidedCAM - Quantities from DWG', await page.title());
  const early = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => e.name.includes('/engine/')).length);
  check('no engine before the first file', early === 0, early);

  // 2. The example drawing.
  await page.click('#dqExample');
  await page.waitForFunction(() => document.body.innerText.includes('ΥΔΡΕΥΣΗ'), null, { timeout: 60000 });
  const layers = await rowText('#dqLayers tbody tr');
  const walls = layers.find(r => r.includes('ΤΟΙΧΟΙ')) || '';
  check('walls 85.60 m, 5 outlines, 108.16 m²', walls.includes('85.60') && walls.includes('108.16'), walls);
  const floors = layers.find(r => r.includes('ΔΑΠΕΔΑ')) || '';
  check('floor hatch 107.84 m² (column subtracted)', floors.includes('107.84'), floors);
  const blocks = await rowText('#dqBlocks tbody tr');
  check('7 lights (an array of 6 and one)', blocks.some(r => r.startsWith('ΦΩΤΙΣΤΙΚΟ') && r.includes('| 7 |')), blocks);
  check('the dynamic copy counts as a window: 5', blocks.some(r => r.startsWith('ΠΑΡΑΘΥΡΟ') && r.includes('| 5 |')), blocks);
  check('nested WC under the set layer', blocks.some(r => r.startsWith('ΛΕΚΑΝΗ | ΥΓΙΕΙΝΗ | 0 | 1')), blocks);
  const sched = await page.$eval('#dqSchedules', e => e.innerText);
  check('window schedule Π1 × 4', /Π1\s+120\s+140\s+4/.test(sched), sched.slice(0, 200));

  // 3. Row → drawing highlight.
  await page.click('#dqLayers tbody tr:has-text("ΥΔΡΕΥΣΗ")');
  check('row highlight', await page.$eval('#dqLayers tbody tr:has-text("ΥΔΡΕΥΣΗ")', tr => tr.classList.contains('is-hi')), null);
  await page.click('#dqLayers tbody tr:has-text("ΥΔΡΕΥΣΗ")');

  // 4. A window around the whole drawing selects every item. The cookie bar must not cover the canvas.
  const decline = await page.$('#privacyDecline');
  if (decline && await decline.isVisible()) await decline.click();
  await page.$eval('#dqCanvas', c => c.scrollIntoView({ block: 'center' }));
  await page.click('#dqFit');
  const box = await page.$eval('#dqCanvas', c => { const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await page.mouse.move(box.x + 3, box.y + 3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.w / 2, box.y + box.h / 2, { steps: 5 });
  await page.mouse.move(box.x + box.w - 3, box.y + box.h - 3, { steps: 5 });
  await page.mouse.up();
  const selCount = await page.$eval('#dqSelCount', e => e.textContent);
  const selLayers = await rowText('#dqSelLayers tbody tr');
  check('window selection totals', /\d+/.test(selCount) && selLayers.some(r => r.startsWith('ΤΟΙΧΟΙ') && r.includes('85.60')), { selCount, selLayers });
  await page.keyboard.press('Escape');
  check('Esc clears the selection', await page.$eval('#dqSelCount', e => e.hidden), null);

  // 5. The .xlsx download.
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#dqXlsx')]);
  check('xlsx name', dl.suggestedFilename() === 'quantities-example-plan.xlsx', dl.suggestedFilename());
  const stream = await dl.createReadStream();
  const chunks = []; for await (const c of stream) chunks.push(c);
  const bytes = Buffer.concat(chunks);
  const names = ['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml'].filter(n => bytes.includes(Buffer.from(n)));
  check('xlsx is a zip with a workbook', bytes.slice(0, 2).toString() === 'PK' && names.length === 3, names);

  // 6. The units override re-measures one file.
  await page.selectOption('#dqStatus select', 'cm');
  await page.waitForFunction(() => document.body.innerText.includes('856.00'), null, { timeout: 60000 });
  check('override cm: walls 856.00 m', true, 'ok');
  await page.selectOption('#dqStatus select', '');
  await page.waitForFunction(() => document.body.innerText.includes('85.60'), null, { timeout: 60000 });

  // 7. More files: two fixtures and a bad one; the Summary tab.
  const fetchBytes = async p => Buffer.from(await page.evaluate(async u => [...new Uint8Array(await (await fetch(u)).arrayBuffer())], BASE + p));
  await page.setInputFiles('#dqInput', [
    { name: 'rooms.dwg', mimeType: 'application/octet-stream', buffer: await fetchBytes('_tests/dwg/fixtures/rooms.dwg') },
    { name: 'rooms-2004.dxf', mimeType: 'application/octet-stream', buffer: await fetchBytes('_tests/dwg/fixtures/rooms-2004.dxf') },
    { name: 'notes.dwg', mimeType: 'application/octet-stream', buffer: Buffer.from('hello, not a drawing') },
  ]);
  await page.waitForFunction(() => document.querySelectorAll('#dqTabs .dq-mark.is-busy').length === 0 && document.querySelectorAll('#dqTabs .dq-tab').length === 5, null, { timeout: 60000 });
  const marks = await page.$$eval('#dqTabs .dq-tab', ts => ts.map(t => t.textContent.trim()));
  // ⚠ only for what needs attention; text left unmeasured is an info line, not a warning.
  check('tabs: Summary first, then each file with its status', marks[0].length > 0 && marks.slice(1).map(m => m[0]).join('') === '✔✔✔✖', marks);
  await page.click('#dqTabs .dq-tab:has-text("notes.dwg")');
  check('the bad file shows why', (await page.$eval('#dqError', e => e.textContent)).includes('notes.dwg'), await page.$eval('#dqError', e => e.textContent));
  await page.click('#dqTabs .dq-tab >> nth=0');
  const sumWalls = (await rowText('#dqLayers tbody tr')).find(r => r.includes('ΤΟΙΧΟΙ')) || '';
  check('summary adds the files and marks the total ≥', sumWalls.includes('149.60') && (await page.$eval('#dqLayerTotals', e => e.textContent)).includes('≥'), sumWalls);

  // 8. Greek number format and the phone layout.
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(BASE + 'dwg-quantities.html?lang=el');
  await page.click('#dqExample');
  await page.waitForFunction(() => document.body.innerText.includes('ΥΔΡΕΥΣΗ'), null, { timeout: 60000 });
  const el = (await rowText('#dqLayers tbody tr')).find(r => r.includes('ΤΟΙΧΟΙ')) || '';
  check('Greek decimal comma', el.includes('85,60'), el);
  const sw = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  check('375 px: no horizontal page scroll', sw[0] === sw[1], sw);

  // 9. Nothing left the local server; no console errors.
  check('no external requests', external.length === 0, external);
  check('no console errors', errors.length === 0, errors);
  return { pass: checks.filter(c => c.ok).length, fail: checks.filter(c => !c.ok).length, checks };
}
```


Run: `node _tests/extract.mjs $PLAN _tests/dwg/browser-check.js`

- [ ] **Step 2: Run it**

Run: `node _tests/dwg/browser-check.cjs`
(or, with the Playwright MCP: `browser_run_code_unsafe` with the file's text as `code`; the MCP only reads files under its allowed roots).

Expected: `22 passed, 0 failed`. The checks, in order:
0. parity with the desktop engine, 6/6;
1. the English title; no engine request before the first file;
2. the example: walls `85.60` m and `108.16` m²; floor hatch `107.84` m²; 7 lights; 5 windows (the dynamic copy included); the nested WC under `ΥΓΙΕΙΝΗ`; the window schedule `Π1 120 140 4`;
3. a layer row highlights;
4. a window around the whole drawing selects every item and totals `ΤΟΙΧΟΙ 85.60`; Esc clears it;
5. the .xlsx is `quantities-example-plan.xlsx`, a ZIP with `[Content_Types].xml`, `xl/workbook.xml` and a sheet;
6. choosing cm re-measures the walls to `856.00` m, and "As the file says" brings back `85.60`;
7. three more files (`rooms.dwg`, `rooms-2004.dxf`, a text file named `notes.dwg`): tabs `Summary, ✔, ✔, ✔, ✖`; the bad tab says why; the Summary's walls read `149.60` and its totals carry `≥`;
8. Greek decimal commas (`85,60`); no horizontal scroll at 375 px;
9. no request outside the local server; no console error.

- [ ] **Step 3: Look at it**

Take full-page screenshots at 1280 px (`?lang=en`) and 375 px (`?lang=el`) with the example loaded, and check by eye: the drawing shows four rooms with grey-hatched floors, blue water pipes, cyan ducts, green windows and doors, and olive lights (yellow darkened for the light background); at 375 px the tables scroll inside their own boxes.

- [ ] **Step 4: Commit**

```bash
git add _tests/dwg/browser-check.js
git commit -F - <<'EOF'
DWG quantities: browser check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

Stop the server afterwards (`netstat -ano | grep ":8765 .*LISTENING"` must print nothing).

---

### Task 15: Launch preparation (stop before any push)

**Files:**
- Create: `_docs/dwg-quantities/real-file-check.md`
- Modify, on deploy day only: every `?v=20261015` of this tool, and the sitemap `lastmod` `2026-10-15`

- [ ] **Step 1: The real-file record**

<!-- file: _docs/dwg-quantities/real-file-check.md -->
```markdown
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

| # | Format / version | Entities | Units right? | Layer (anonymised) | Tool length (m) | AutoCAD length (m) | Diff % | Tool area (m²) | AutoCAD area (m²) | Diff % | Blocks: tool vs AutoCAD | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

Acceptance: lengths and areas within 0.5 % of AutoCAD on every layer compared; block counts equal; every warning
the tool raised names a real property of the file. Anything else is a bug to fix before launch.

Timing on the same machine (the browser's first file includes the engine start):

| # | Entities | Seconds in the browser |
|---|---|---|

Recorded by: (name), (date).
```


Run: `node _tests/extract.mjs $PLAN _docs/dwg-quantities/real-file-check.md`

- [ ] **Step 2: Deploy date**

The date strings stay `20261015` / `2026-10-15` until Aris names the deploy day. Then, as the spec's §10 asks, fix the three stale sitemap dates of the other tools at the same time:
```bash
sed -i 's/v=20261015/v=YYYYMMDD/g' dwg-quantities.html js/dwg/ui.js js/dwg/view.js js/dwg/worker.js
grep -rn "v=20261015" dwg-quantities.html js/dwg/*.js    # must print nothing
sed -i 's#<lastmod>2026-10-15</lastmod>#<lastmod>YYYY-MM-DD</lastmod>#' sitemap.xml
```
The other tools' own `?v=` strings are theirs to bump when they next change.

- [ ] **Step 3: Run everything**

Run:
```bash
node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js" "_tests/laser/*.test.js" "_tests/dwg/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
dotnet test _src/dwg-engine/Tests 2>&1 | tail -1
dotnet test _src/laser-engine/Tests 2>&1 | tail -1
```
Expected: `ℹ pass 337`, `ℹ fail 0`; `Passed: 45`; the laser engine's own count, unchanged.

- [ ] **Step 4: Commit, then stop**

```bash
git add _docs/dwg-quantities/real-file-check.md
git commit -F - <<'EOF'
DWG quantities: real-file check record (to be filled before launch)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

**Stop here.** Merging and pushing `main` publishes the site; that is Aris's decision. Before any push:
- Aris runs the real files and fills `real-file-check.md` (spec §9), including one file with dynamic blocks, one pre-2007 DXF with Greek layers, and one that states the wrong units;
- Aris decides on the spec refinements marked for him (the units override; AOT or not);
- squash the branch;
- grep the whole branch history for client names: `git log -p main..HEAD | grep -i -E "<client names>"` must print nothing;
- after the push, check on the live site that the engine loads from GitHub Pages, the example works, and the devDept notice shows (spec §10).

---

## Replay

The plan was replayed task by task on a fresh worktree of `feat/dwg-quantities` (the spec commit plus this plan), running only the plan's own commands.
- **Every stated result appeared:** the compile errors of Tasks 1–2; `Passed: 5`, `42`, then `Failed: 2, Passed: 43`, then `45`; the Node counts 7 → 14 → 21 → 28 → 29 → 33 with each red step's failures; `335`, `33`, `34`/`1`, `337`; the publish line `108 files, 11.4 MB`; parity 6/6; perf 1.7 s and 15.8 s; the browser check `22 passed, 0 failed`.
- **`expected.json` regenerated byte-identical** to the validation run's.
- **The final tree matches the validated worktree** in every text file. Only the generated binaries differ: the fixtures and the example drawing carry the time they were written, and the engine's assembly fingerprints change per build.
- **One fix came out of the replay:** `browser-check.cjs` read `browser-check.js` at start-up, so its `parity` mode failed in Task 4, before that file exists. It now loads it only in the default mode, and the block above is the fixed one.
