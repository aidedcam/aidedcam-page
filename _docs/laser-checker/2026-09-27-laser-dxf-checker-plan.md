# Laser DXF Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a free laser DXF check to www.aidedcam.com. It reads a whole order of DXF and DWG files in the browser, repairs them, shows what still needs the customer, prices the order in cut length, pierces, weight and time, and hands back clean R12 DXFs.

**Architecture:**
- **Engine.** A headless C# engine on devDept Eyeshot 2026, compiled to .NET 10 WebAssembly.
  - It runs in a module Web Worker and reads with Eyeshot's managed `ReadDXF`/`ReadDWG`.
  - It does its own exact line/arc geometry: repair, contours, parts.
  - It writes R12 DXF itself, because the managed core has no DXF writer.
- **Page.** A plain-JS page (`laser-dxf-checker.html`) on the viewers' shared shell (`js/gcode/shell/`). It prices in JavaScript, so a change of material, thickness, quantity or speed never calls the engine.
- **Build.** The engine is built on Aris's machine from the local Eyeshot installation and published into `js/laser/engine/`, as committed static files.

**Tech Stack:**
- C# on .NET 10: an engine class library, a `Microsoft.NET.Sdk.WebAssembly` host with `[JSExport]`, and xUnit tests.
- devDept.Eyeshot 2026.2.284 (NuGet, from the local installation).
- ACadSharp 3.3.23, the library Eyeshot reads DXF and DWG with: the engine uses it for arrayed inserts, and the tests use it to write DXF 2004 and DWG fixtures.
- Plain ES modules; `node --test`; the Playwright MCP for the browser checks.
- The static GitHub Pages site.

**Spec:** `_docs/laser-checker/2026-09-27-laser-dxf-checker-design.md`. Where this plan departs from it, the departure is listed under "Spec refinements" below, with the reason.

**Validated before writing.** Every block below was built and run in a scratch worktree of `feat/laser-checker`, and the whole plan was then replayed on a fresh checkout.
- **Engine:** `dotnet test _src/laser-engine/Tests` passes 39 tests, stable over 5 runs.
- **Node:** `node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js" "_tests/laser/*.test.js"` passes 168 + 105 + 24 = 297.
- **Size:** the published engine is 108 files, 11.9 MB, loaded as gzip.
- **Browser (Chrome, headless):**
  - the engine boots in 0.9–1.0 s from the local server;
  - desktop–browser parity is 11/11 fixtures, including arrayed inserts in DXF and DWG;
  - a synthetic 5,004-curve part takes 0.85–1.5 s on the first file and 0.45–0.75 s warm, across runs (spec §11 target: 2 s);
  - there are no requests except to the local server.
- **Replay.**
  - On the fresh checkout, every step of Tasks 0–13 and 15 ran from the plan's own commands, with the stated failures and counts.
  - The Task 6 gate and Task 14 checks 1–10 ran in the browser there too.
  - Checks 11–18 passed on the validation worktree. The browser tool disconnected before they could be re-run on the replay; since then, the page has changed only by two strings.
- **Superseded blocks.** Task reviews fixed the code after these blocks were written; the branch history (commits eaf6dea, 2db6564, 4c9f52c and the final-review fixes) is the record, and replaying the plan's blocks alone reproduces those bugs.

## Global Constraints

- **Public repo** (github.com/aidedcam/aidedcam-page). No client names, no customer files, and no values or labels copied from customer files in any committed file, test, doc or commit message. Real files go only in the git-ignored `_tests/private/`.
- **No licence key, serial or licence file** anywhere in the repo. The headless engine needs none; if a step ever seems to need one, stop and ask Aris.
- **Eyeshot's managed classes only:** `ReadDXF`, `ReadDWG`, the entity classes and `ICurve`, plus ACadSharp 3.3.23 (the same version Eyeshot depends on) for arrayed inserts. Never `ReadAutodesk`, `WriteAutodesk`, `UtilityEx` or any WinForms/WPF/x64 package: they don't run in the browser.
- **devDept notice**, on the page's footer, verbatim: `Portion of copyright © devDept Software S.r.l. All Rights Reserved.`
- **Build:**
  - The site has no build step and no npm dependencies.
  - The engine is built only by `powershell -ExecutionPolicy Bypass -File _src/laser-engine/publish.ps1`, and its output in `js/laser/engine/` is committed.
- **Privacy:**
  - Nothing is uploaded, and the engine makes no network call.
  - GA events (consent-gated, as on the viewers) never carry file names, text or geometry.
- **Units:** lengths in mm, areas in mm², angles in degrees counter-clockwise from +X (spec §3).
- **Limits** (spec §12): 20 MB per file, 200,000 curves per file, 50 files per order, 30 s per file.
- **Languages:** GR (default)/EN/IT for every user-visible string. The Italian uses the formal "voi" and the typographic `’`. Every non-ASCII character is kept exact.
- **Layout:**
  - At 375 px there is no horizontal page scroll, with a 16 px side gutter.
  - The parts table scrolls inside its own box.
- **The live viewers must not change behaviour.** The tools index only gains a card, and its wording changes "program" to "files".
- **Tests:**
  - Node: `node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js" "_tests/laser/*.test.js"`. Quote the globs; on Node 24 a bare folder path doesn't work.
  - Engine: `dotnet test _src/laser-engine/Tests`.
  - Both run from the repo root.
- **Cache-busting:** `?v=20261015` is a placeholder, and Task 15 replaces it on deploy day. It goes on every new asset URL:
  - the page's two scripts;
  - `ui.js`'s imports of its own modules;
  - the worker URL in `bridge.js`;
  - the worker's import of `engine/dotnet.js`.
- **Commits** end with the session trailer, copied verbatim:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
  ```
- **Whole files are extracted, never retyped.**
  - A file shown in full is preceded by a line `<!-- file: <path> -->`.
  - Write it with `node _tests/extract.mjs <brief-or-plan-file> <path>`, and check it with the same command plus `--check`.
  - Binary files are never typed: fixtures, examples and the published engine are generated by the commands given.
- **Never push, merge or amend.** Pushing `main` publishes the live site, and only Aris decides that.

## Review Focus

Inputs real orders bring that the spec doesn't spell out, most likely first, each pinned by a test:

1. **Blocks Eyeshot's conversion loses.** Hole patterns are often blocks, and a lost block means a part priced and cut without its holes.
   - Old R12 files: the blocks come in empty.
   - Arrayed inserts (MINSERT): one copy comes in from a DXF, none from a DWG.

   Model-space arrays must be exploded copy by copy. Anything that can't be recovered must be a visible error naming the blocks.

   *Task 2: `Arrayed_inserts_are_exploded_copy_by_copy_in_dxf_and_dwg`, `An_array_inside_a_block_is_recorded_not_lost_silently`, `An_R12_block_that_comes_in_empty_is_recorded_not_lost_silently`. Task 4: `An_empty_block_is_an_error_that_names_it`, `An_array_inside_a_block_is_an_error_that_names_the_block`. Tasks 5 and 6: the `array-2004.dxf` and `array.dwg` fixtures, on the desktop and in the browser.*
2. **A drawing in inches.** US/UK customers and old templates.
   - It is converted ×25.4 and noted.
   - The units setting still overrides it.

   *Task 2: `A_file_drawn_in_inches_is_converted_to_mm`.*
3. **A sheet with thousands of holes.** A perforated panel, or a customer's own nest. Nesting must stay near-linear, so the file finishes well inside the 30 s limit. *Task 4 (`A_sheet_with_twenty_thousand_holes_nests_in_near_linear_time`); Task 6 timing page.*
4. **Two files with the same name in one order** (from different folders). The ZIP must hold `part-laser.dxf` and `part-laser (2).dxf`, never two entries with one name. *Task 8: `two files with the same name get distinct entries`.*
5. **A file that hangs or crashes the engine, or an engine that can't start.**
   - That file gets an error row, and the rest of the order continues.
   - An engine that can't start shows a banner with a retry.

   *Task 9 (bridge timeout and crash tests); Task 14 (engine files blocked in the browser).*

## Spec refinements made while validating this plan

Each one is recorded here so the reviewers can check it against the spec.

- **Own R12 writer** (spec §3, §14.2). The managed Eyeshot core has no `WriteDXF`, despite the documentation. `DxfR12.cs` writes R12 itself:
  - layers CUT/MARK/BEND/TEXT with the spec's colours;
  - arcs kept as bulges;
  - Windows-1253 text.
- **Exact areas and containment** (spec §3, §6, §8). Areas come from Green's theorem over lines and arcs, which is exact. Containment is a point-in-polygon test on a contour sampled within 0.05 mm. `Region.GetArea`/`IsPointInside` aren't used.
- **Nesting uses a grid of bounding boxes,** so a sheet with 12,500 holes nests in 25 ms on the desktop instead of 1.4 s.
- **Arrayed inserts (MINSERT)** (spec §4). Eyeshot's conversion keeps one copy from a DXF and drops the insert from a DWG. ACadSharp, which Eyeshot reads with, keeps the array. So the reader reads the file again with ACadSharp 3.3.23 (Eyeshot's own dependency, so nothing extra ships) and explodes the missing copies through Eyeshot's blocks.
  - Arrays inside block definitions get the new `block-array` error.
  - A DXF without an arrayed INSERT skips the second read; a DWG always gets it, which roughly doubles its read time.
- **Extra check ids and notes:**
  - `block-empty` (error): R12 DXF blocks come in empty from Eyeshot's reader; the files were checked valid with ezdxf.
  - `block-array` (error): an arrayed insert inside a block definition, read only once.
  - `read-version` is the page's text for the error reason "version".
  - `clamped` is the "outside the speed table" note (spec §8).
- **Contract:** full circles are a segment of their own, `{t:'C',cx,cy,r}`. Polylines arrive as their line and arc pieces, so the engine emits only L, A and C; `drawing.js` still draws P.
- **Mark geometry** goes through the same removal of tiny pieces, duplicates and overlaps as cut, and its ends join within the join tolerance, but its gaps are never closed (gap tolerance 0) and its open ends and branches get no markers: engraving strokes often stop short of each other on purpose, and a mark never makes a part fall out.
- **Trimming roots.** The WebAssembly host keeps five trimming roots: `System.Runtime`, `mscorlib`, `devDept.Eyeshot.v2026`, `System.Configuration.ConfigurationManager` and `ACadSharp`. Without the last one, DXF circle centres read as (0, 0) in the browser.
- **Runtime folder** (spec §3 left it to the gate). `publish.ps1` copies `_framework`'s JavaScript and `.gz` files into `js/laser/engine/`. The worker fetches each `.gz` and unpacks it with `DecompressionStream`, because GitHub Pages doesn't serve pre-compressed files. `.gitattributes` keeps these files, the fixtures and the examples byte-exact, which matters because the boot config carries SHA-256 hashes.
- **Feasibility gate** (spec §14 calls it the plan's first task). It was run in full while validating this plan (the results are above). Task 6 re-runs it on the branch as its acceptance check, before any page work. If it fails there, work stops, as the spec says.
- **DWG fixtures** are written with ACadSharp, not Eyeshot, because the managed core has no DWG writer either. They are synthetic.
- **Example order** (spec §10 lists three parts). It has four:
  - a bracket and a flange (DXF 2004, in mm), which show as ready;
  - a cover (R12 with no units), which shows the repairs, the text, the bend line and the marking;
  - a spacer (DWG 2018, in mm).
- **Module versions.** The viewers version only their worker URL. The laser page also versions `ui.js`'s own imports and the worker's `engine/dotnet.js` import:
  - after an update, a cached old module must never meet the new controller;
  - `dotnet.js` names the fingerprinted files of its own publish, so a stale copy would request files that no longer exist.
- **Check texts** use the "label: count" form, so no plural rules are needed in three languages.
- **Marking speed** is one setting for all materials, not a column of the speeds table (spec §8).
- **Header links:** the page links to the free-tools index, which lists both viewers, and not to each viewer (spec §10). Three links crowd the header on phones.
- **Tools index:** besides the card, the lede says "files" instead of "program" in the three languages, and the meta description mentions the laser check.
- **Units setting** (spec §4 vs §10): the setting applies only to files that state no units; a file's own units always win. §4 says "overrides both", but the page labels the setting "for files that state none", and a shop that sets mm for unitless files must not have its inch files shrunk 25.4×.
- **Big files** (spec §11–12). In Chrome, 50,004 curves take 16 s, because .NET's WebAssembly interpreter runs about 13–20× slower than the desktop. Above roughly 90,000 curves, the 30 s limit therefore trips before the 200,000-curve limit, and the file gets `too-large` ("over 30 s"). Parts are far below this. AOT compilation is the lever if big nests ever matter, at the cost of a larger download.
- **Speed defaults** come from the research in `speed-defaults.md` (Task 8), which replaced the first draft's values. Spec §17 question 1 (research or Aris's own machine) stays open. The shop's own values override the defaults in the browser anyway.

## File structure

| Path | Task | Responsibility |
|---|---|---|
| `.gitattributes`, `.gitignore` | 0 | Byte-exact CAD and engine files; build output ignored |
| `_src/laser-engine/nuget.config` | 1 | Eyeshot from the local installation, the rest from nuget.org |
| `_src/laser-engine/Engine/Engine.csproj`, `Geometry.cs` | 1 | Points, pieces (line/arc/circle), exact areas, sampling, point-in-polygon |
| `_src/laser-engine/Tests/Tests.csproj`, `AssemblyInfo.cs` | 1 | xUnit project (invariant globalization, no parallel runs) |
| `_src/laser-engine/Engine/Model.cs`, `Roles.cs`, `Reader.cs` | 2 | Drawing model, settings, limits; default roles; DXF/DWG → flat pieces in mm |
| `_src/laser-engine/Tests/Dxf.cs` | 2 | Synthetic R12 DXF builder for the tests |
| `_src/laser-engine/Engine/Repair.cs`, `Chains.cs` | 3 | Tiny/duplicate/overlap removal, join, gap closing; contours, self-crossing, parts |
| `_src/laser-engine/Engine/DxfR12.cs`, `Processor.cs`, `ResultJson.cs` | 4 | R12 writer; the pipeline and checks; the JSON contract |
| `_src/laser-engine/Tests/Fixtures.cs`, `ParityTests.cs`, `_tests/laser/fixtures/*` | 5 | Golden fixtures and their expected results |
| `_src/laser-engine/Host/*`, `publish.ps1`, `js/laser/worker.js`, `js/laser/engine/*` | 6 | WebAssembly host, publish, worker, published runtime |
| `_tests/laser/engine-smoke.html`, `parity.html`, `perf-dxf.mjs`, `perf.html` | 6 | Dev-only browser checks (Jekyll skips `_tests`) |
| `_src/laser-engine/Tests/Examples.cs`, `js/laser/examples/*` | 7 | The example order |
| `js/laser/pricing.js`, `zip.js`, `drawing.js`, `_docs/laser-checker/speed-defaults.md` | 8 | Weight/time/totals; ZIP writer; SVG paths; researched defaults |
| `js/laser/bridge.js` | 9 | Queue, timeout and restart around the worker |
| `js/laser/i18n-laser.js` | 10 | Tool strings GR/EN/IT |
| `laser-dxf-checker.html`, `css/tools.css` | 11 | The page and its styles (appended) |
| `js/laser/ui.js` | 12 | The controller |
| `free-tools.html`, `sitemap.xml`, `llms.txt` | 13 | Site links |
| `_docs/laser-checker/real-file-check.md` | 15 | Pre-launch record for real files |
| `_tests/laser/*.test.js` | 8–13 | Node suites |

---

### Task 0: Branch check and repository attributes

**Files:**
- Create: `.gitattributes`
- Modify: `.gitignore` (append 4 lines)

**Interfaces:**
- Produces: CAD files (`*.dxf`, `*.dwg`) and `js/laser/engine/**` are stored byte-exact; `_src/laser-engine/**/bin/` and `obj/` are ignored. Every later task relies on this before it adds such a file.

- [ ] **Step 1: Check the starting point**

Run:
```bash
git branch --show-current && git log --oneline -1
node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
dotnet --version
ls "C:/Program Files/devDept/Eyeshot 2026/NuGet Packages/devDept.Eyeshot.2026.2.284.nupkg"
```
Expected:
- the branch is `feat/laser-checker`, and HEAD is the commit `Laser DXF check: implementation plan`;
- `ℹ pass 273` and `ℹ fail 0`;
- a .NET version starting with `10.`;
- the package path is printed.

If Eyeshot 2026 or .NET 10 is missing, stop and tell Aris: the engine can only be built on his machine.

- [ ] **Step 2: Write the attributes and extend `.gitignore`**

<!-- file: .gitattributes -->
```text
# CAD files stay byte-exact: the tests compare them and DXF code pages are not UTF-8.
*.dxf binary
*.dwg binary
# The published WebAssembly engine is build output: served exactly as published, never diffed.
js/laser/engine/** binary
```

Run:
```bash
node _tests/extract.mjs <brief> .gitattributes
printf '\n# Laser engine build output\n_src/laser-engine/**/bin/\n_src/laser-engine/**/obj/\n' >> .gitignore
```

- [ ] **Step 3: Check them**

Run: `git check-attr text -- a.dxf b.dwg js/laser/engine/dotnet.js && git check-ignore _src/laser-engine/Engine/bin/x _src/laser-engine/Tests/obj/y`
Expected: three lines ending `text: unset`, then both paths printed.

- [ ] **Step 4: Commit**

```bash
git add .gitattributes .gitignore
git commit -F - <<'EOF'
Laser DXF check: byte-exact CAD and engine files, ignore engine build output

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 1: Engine projects and exact geometry

**Files:**
- Create: `_src/laser-engine/nuget.config`, `_src/laser-engine/Engine/Engine.csproj`, `_src/laser-engine/Engine/Geometry.cs`
- Create: `_src/laser-engine/Tests/Tests.csproj`, `_src/laser-engine/Tests/AssemblyInfo.cs`, `_src/laser-engine/Tests/GeometryTests.cs`

**Interfaces:**
- Produces (namespace `AidedCam.Laser`):
  - `record struct P(double X, double Y)` with `+ - *`, `Length`, `static Cross(P, P)`.
  - `enum SegKind { Line, Arc, Circle }`.
  - `class Seg`:
    - fields `Kind`, `A`, `B`, `C`, `R`, `Ccw`, `Group`, `Bridge`;
    - factories `Seg.Line(P a, P b, int group)`, `Seg.Arc(P c, double r, P a, P b, bool ccw, int group)` and `Seg.Circle(P c, double r, int group)`;
    - members `StartAngle`, `EndAngle`, `Sweep`, `Length`, `Reversed()`, `PointAt(double t)`, `Sample(double maxErr)`, `Bounds()`, `ContainsAngle(double deg)`, `Bulge`.
  - `static class Geo`: `SignedArea(IEnumerable<Seg>)` (exact, counter-clockwise positive), `Polygon(IEnumerable<Seg>)`, `Inside(P, List<P>)`.

- [ ] **Step 1: Write the projects and the failing test**

<!-- file: _src/laser-engine/nuget.config -->
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

<!-- file: _src/laser-engine/Engine/Engine.csproj -->
```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>disable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <RootNamespace>AidedCam.Laser</RootNamespace>
    <AssemblyName>AidedCam.Laser.Engine</AssemblyName>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="devDept.Eyeshot" Version="2026.2.284" />
    <!-- The library Eyeshot reads DXF/DWG with (the same version Eyeshot depends on, so nothing extra ships):
         the reader uses it for arrayed inserts, which Eyeshot's conversion loses. -->
    <PackageReference Include="ACadSharp" Version="3.3.23" />
  </ItemGroup>
</Project>
```

<!-- file: _src/laser-engine/Tests/Tests.csproj -->
```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>disable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <IsPackable>false</IsPackable>
    <!-- The browser build runs in invariant globalization; the tests do too. -->
    <InvariantGlobalization>true</InvariantGlobalization>
    <RootNamespace>AidedCam.Laser.Tests</RootNamespace>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.14.1" />
    <PackageReference Include="xunit" Version="2.9.3" />
    <PackageReference Include="xunit.runner.visualstudio" Version="3.1.4" />
    <!-- Eyeshot uses ACadSharp internally but hides it from compile; the tests write DWG fixtures with it. -->
    <PackageReference Include="ACadSharp" Version="3.3.23" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\Engine\Engine.csproj" />
  </ItemGroup>
</Project>
```

<!-- file: _src/laser-engine/Tests/AssemblyInfo.cs -->
```csharp
// ACadSharp's writers (used to build fixtures) are not safe to run from parallel test classes,
// and the browser engine processes one file at a time anyway.
[assembly: Xunit.CollectionBehavior(DisableTestParallelization = true)]
```

<!-- file: _src/laser-engine/Tests/GeometryTests.cs -->
```csharp
using Xunit;

namespace AidedCam.Laser.Tests;

public class GeometryTests
{
    [Fact]
    public void Arc_sweep_length_and_bulge_follow_the_direction()
    {
        var ccw = Seg.Arc(new P(0, 0), 10, new P(10, 0), new P(0, 10), true, 0);      // quarter, counter-clockwise
        Assert.Equal(Math.PI / 2, ccw.Sweep, 9);
        Assert.Equal(10 * Math.PI / 2, ccw.Length, 9);
        Assert.Equal(Math.Tan(Math.PI / 8), ccw.Bulge, 9);
        var cw = ccw.Reversed();                                                          // the same arc walked back
        Assert.False(cw.Ccw);
        Assert.Equal(Math.PI / 2, cw.Sweep, 9);
        Assert.Equal(-Math.Tan(Math.PI / 8), cw.Bulge, 9);
        var big = Seg.Arc(new P(0, 0), 10, new P(0, 10), new P(10, 0), true, 0);         // three quarters
        Assert.Equal(3 * Math.PI / 2, big.Sweep, 9);
    }

    [Fact]
    public void Signed_area_is_exact_for_lines_and_arcs()
    {
        // A 20 × 10 rectangle with its right side replaced by a half circle bulging out (radius 5).
        var chain = new List<Seg>
        {
            Seg.Line(new P(0, 0), new P(20, 0), 0),
            Seg.Arc(new P(20, 5), 5, new P(20, 0), new P(20, 10), true, 0),
            Seg.Line(new P(20, 10), new P(0, 10), 0),
            Seg.Line(new P(0, 10), new P(0, 0), 0),
        };
        Assert.Equal(200 + Math.PI * 25 / 2, Geo.SignedArea(chain), 9);
        Assert.Equal(-(200 + Math.PI * 25 / 2), Geo.SignedArea(chain.AsEnumerable().Reverse().Select(s => s.Reversed()).ToList()), 9);
        Assert.Equal(Math.PI * 9, Geo.SignedArea(new List<Seg> { Seg.Circle(new P(1, 1), 3, 0) }), 9);
    }

    [Fact]
    public void Arc_bounds_include_the_extreme_points_it_passes()
    {
        var (min, max) = Seg.Arc(new P(0, 0), 10, new P(10, 0), new P(-10, 0), true, 0).Bounds();   // upper half
        Assert.Equal(-10, min.X, 9); Assert.Equal(0, min.Y, 9); Assert.Equal(10, max.X, 9); Assert.Equal(10, max.Y, 9);
    }

    [Fact]
    public void Samples_stay_within_the_chord_error()
    {
        var arc = Seg.Arc(new P(0, 0), 50, new P(50, 0), new P(-50, 0), true, 0);
        var pts = arc.Sample(0.01);
        for (int i = 0; i + 1 < pts.Count; i++)
        {
            var mid = (pts[i] + pts[i + 1]) * 0.5;
            Assert.True(50 - mid.Length <= 0.0101, $"chord error {50 - mid.Length}");
        }
    }
}
```

Run: `for f in _src/laser-engine/nuget.config _src/laser-engine/Engine/Engine.csproj _src/laser-engine/Tests/Tests.csproj _src/laser-engine/Tests/AssemblyInfo.cs _src/laser-engine/Tests/GeometryTests.cs; do node _tests/extract.mjs <brief> $f; done`

- [ ] **Step 2: Run it and see it fail**

Run: `dotnet test _src/laser-engine/Tests 2>&1 | grep -m1 -E "error CS"`
Expected: `error CS0103: The name 'Seg' does not exist in the current context`. The first restore also downloads xUnit and ACadSharp from nuget.org.

- [ ] **Step 3: Write the geometry**

<!-- file: _src/laser-engine/Engine/Geometry.cs -->
```csharp
namespace AidedCam.Laser;

// A 2D point in millimetres.
public readonly record struct P(double X, double Y)
{
    public static P operator +(P a, P b) => new(a.X + b.X, a.Y + b.Y);
    public static P operator -(P a, P b) => new(a.X - b.X, a.Y - b.Y);
    public static P operator *(P a, double k) => new(a.X * k, a.Y * k);
    public double Length => Math.Sqrt(X * X + Y * Y);
    public double DistanceTo(P o) => (this - o).Length;
    public static double Cross(P a, P b) => a.X * b.Y - a.Y * b.X;
}

public enum SegKind { Line, Arc, Circle }

// One piece of a contour.
// Line: A → B.
// Arc: A → B around centre C with radius R, counter-clockwise when Ccw.
// Circle: centre C, radius R; A and B are both the point at angle 0.
public sealed class Seg
{
    public SegKind Kind;
    public P A, B, C;
    public double R;
    public bool Ccw;
    public int Group;          // index into the file's groups
    public bool Bridge;        // a short line added to close a gap

    public static Seg Line(P a, P b, int group) => new() { Kind = SegKind.Line, A = a, B = b, Group = group };
    public static Seg Arc(P c, double r, P a, P b, bool ccw, int group) =>
        new() { Kind = SegKind.Arc, C = c, R = r, A = a, B = b, Ccw = ccw, Group = group };
    public static Seg Circle(P c, double r, int group)
    {
        var p = new P(c.X + r, c.Y);
        return new() { Kind = SegKind.Circle, C = c, R = r, A = p, B = p, Group = group };
    }

    public double StartAngle => Math.Atan2(A.Y - C.Y, A.X - C.X);
    public double EndAngle => Math.Atan2(B.Y - C.Y, B.X - C.X);

    // Sweep in radians, always positive: (0, 2π] for arcs, 2π for circles, 0 for lines.
    public double Sweep
    {
        get
        {
            if (Kind == SegKind.Circle) return 2 * Math.PI;
            if (Kind == SegKind.Line) return 0;
            double s = Ccw ? EndAngle - StartAngle : StartAngle - EndAngle;
            while (s <= 1e-12) s += 2 * Math.PI;
            while (s > 2 * Math.PI + 1e-12) s -= 2 * Math.PI;
            return s;
        }
    }

    public double Length => Kind == SegKind.Line ? A.DistanceTo(B) : R * Sweep;

    public Seg Reversed() => Kind == SegKind.Line
        ? new Seg { Kind = Kind, A = B, B = A, Group = Group, Bridge = Bridge }
        : new Seg { Kind = Kind, A = B, B = A, C = C, R = R, Ccw = !Ccw, Group = Group, Bridge = Bridge };

    // Point at parameter t in [0, 1] along the piece.
    public P PointAt(double t)
    {
        if (Kind == SegKind.Line) return A + (B - A) * t;
        double a = StartAngle + (Ccw || Kind == SegKind.Circle ? 1 : -1) * Sweep * t;
        return new P(C.X + R * Math.Cos(a), C.Y + R * Math.Sin(a));
    }

    // Points along the piece, first and last included, with chord error below maxErr (mm).
    public List<P> Sample(double maxErr = 0.01)
    {
        var pts = new List<P> { A };
        if (Kind == SegKind.Line) { pts.Add(B); return pts; }
        double step = R <= maxErr ? Math.PI / 2 : 2 * Math.Acos(1 - maxErr / R);
        int n = Math.Clamp((int)Math.Ceiling(Sweep / step), 2, 720);
        for (int i = 1; i < n; i++) pts.Add(PointAt((double)i / n));
        pts.Add(B);
        return pts;
    }

    // Axis-aligned bounds, exact for arcs (their extreme points are included).
    public (P Min, P Max) Bounds()
    {
        double x0 = Math.Min(A.X, B.X), y0 = Math.Min(A.Y, B.Y), x1 = Math.Max(A.X, B.X), y1 = Math.Max(A.Y, B.Y);
        if (Kind != SegKind.Line)
        {
            for (int q = 0; q < 4; q++)
            {
                double ang = q * Math.PI / 2;
                if (Kind == SegKind.Circle || ContainsAngle(ang))
                {
                    double x = C.X + R * Math.Cos(ang), y = C.Y + R * Math.Sin(ang);
                    x0 = Math.Min(x0, x); y0 = Math.Min(y0, y); x1 = Math.Max(x1, x); y1 = Math.Max(y1, y);
                }
            }
        }
        return (new P(x0, y0), new P(x1, y1));
    }

    // True when the direction ang (radians) lies on the arc between A and B.
    public bool ContainsAngle(double ang)
    {
        if (Kind == SegKind.Circle) return true;
        double from = Ccw ? StartAngle : EndAngle;
        double d = ang - from;
        while (d < 0) d += 2 * Math.PI;
        while (d >= 2 * Math.PI) d -= 2 * Math.PI;
        return d <= Sweep + 1e-12;
    }

    // DXF bulge of an arc piece: tan(sweep / 4), negative for clockwise; 0 for lines.
    public double Bulge => Kind == SegKind.Arc ? Math.Tan(Sweep / 4) * (Ccw ? 1 : -1) : 0;
}

public static class Geo
{
    // Signed area of a closed chain (counter-clockwise positive), exact for lines and arcs.
    public static double SignedArea(IReadOnlyList<Seg> chain)
    {
        if (chain.Count == 1 && chain[0].Kind == SegKind.Circle) return Math.PI * chain[0].R * chain[0].R;
        double a = 0;
        foreach (var s in chain)
        {
            a += P.Cross(s.A, s.B) / 2;                                  // the chord
            if (s.Kind == SegKind.Arc)
            {
                double t = s.Sweep;
                a += (s.Ccw ? 1 : -1) * s.R * s.R * (t - Math.Sin(t)) / 2;   // the circular segment beyond it
            }
        }
        return a;
    }

    // A polygon approximating a closed chain, for containment tests.
    public static List<P> Polygon(IReadOnlyList<Seg> chain, double maxErr = 0.05)
    {
        var pts = new List<P>();
        foreach (var s in chain)
        {
            var sp = s.Sample(maxErr);
            for (int i = 0; i < sp.Count - 1; i++) pts.Add(sp[i]);
        }
        return pts;
    }

    // Even-odd point-in-polygon test.
    public static bool Inside(P p, List<P> poly)
    {
        bool inside = false;
        for (int i = 0, j = poly.Count - 1; i < poly.Count; j = i++)
        {
            var a = poly[i]; var b = poly[j];
            if ((a.Y > p.Y) != (b.Y > p.Y) && p.X < (b.X - a.X) * (p.Y - a.Y) / (b.Y - a.Y) + a.X) inside = !inside;
        }
        return inside;
    }
}
```

Run: `node _tests/extract.mjs <brief> _src/laser-engine/Engine/Geometry.cs`

- [ ] **Step 4: Run the tests**

Run: `dotnet test _src/laser-engine/Tests 2>&1 | tail -1`
Expected: `Passed!  - Failed:     0, Passed:     4, Skipped:     0, Total:     4`, followed by the duration. `git status --short` shows no `bin/` or `obj/`.

- [ ] **Step 5: Commit**

```bash
git add _src/laser-engine
git commit -F - <<'EOF'
Laser DXF check: engine projects and exact line/arc geometry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 2: Reading DXF and DWG

**Files:**
- Create: `_src/laser-engine/Engine/Model.cs`, `_src/laser-engine/Engine/Roles.cs`, `_src/laser-engine/Engine/Reader.cs`
- Create: `_src/laser-engine/Tests/Dxf.cs`, `_src/laser-engine/Tests/ReaderTests.cs`

**Interfaces:**
- Consumes: `Seg`, `P`, `SegKind` (Task 1).
- Produces:
  - `Group { Layer, Color "#rrggbb", LineType, Curves, DefaultRole, Role, Key => Layer + "|" + Color }`.
  - `TextItem { At, Height, Rotation, Value }`.
  - `Drawing`:
    - `Format "dxf"|"dwg"`, `Version`, `Units`, `UnitsSource "file"|"assumed"|"setting"`;
    - `Segs`, `Groups`, `Texts`, `NotFlat`, `EmptyBlocks` and `NestedArrays` (SortedSets of block names), `Ignored` {hatch, dim, leader, point, other}.
  - `Settings { Units = "auto", JoinTol = 0.01, GapTol = 0.2, Roles }`.
  - `LaserFileException(string reason, string message)` with `Reason` ∈ read|version|limit.
  - `Limits.MaxBytes`, `Limits.MaxCurves`, `Limits.Tiny`.
  - `Roles.Cut/Mark/Bend/Ignore`, `Roles.Default(layer)`, `Roles.IsDashed(linetype)`, `Roles.IsRole(string)`.
  - `Reader.Read(byte[] bytes, Settings s) → Drawing`.
  - `Reader.Read` explodes model-space arrayed inserts itself (read again with ACadSharp), and records arrays inside block definitions in `NestedArrays`.
  - Tests:
    - `new Dxf()` builds R12 files with `.Layer .CodePage .Line .Arc .Circle .Rect .Polyline .Text .Block .Insert .Bytes()`;
    - `AcadFile.Write(CadDocument, bool dwg)` writes DXF 2004+ or DWG with ACadSharp.

- [ ] **Step 1: Write the DXF builder and the failing tests**

<!-- file: _src/laser-engine/Tests/Dxf.cs -->
```csharp
using System.Globalization;
using System.Text;

namespace AidedCam.Laser.Tests;

// Builds small synthetic R12 DXF files for the tests. No customer file is ever used.
public sealed class Dxf
{
    readonly List<(string name, int aci, string lt)> layers = new() { ("0", 7, "CONTINUOUS") };
    readonly StringBuilder blocks = new(), ents = new();
    string codePage;

    static string N(double v) => v.ToString("0.0#########", CultureInfo.InvariantCulture);
    static void G(StringBuilder sb, int code, string v) => sb.Append(code).Append("\r\n").Append(v).Append("\r\n");

    public Dxf Layer(string name, int aci = 7, string lineType = "CONTINUOUS") { layers.Add((name, aci, lineType)); return this; }
    public Dxf CodePage(string cp) { codePage = cp; return this; }

    static void Common(StringBuilder sb, string layer, int? aci)
    {
        G(sb, 8, layer);
        if (aci.HasValue) G(sb, 62, aci.Value.ToString(CultureInfo.InvariantCulture));
    }

    public Dxf Line(double x1, double y1, double x2, double y2, string layer = "0", int? aci = null) => To(ents, sb =>
    {
        G(sb, 0, "LINE"); Common(sb, layer, aci);
        G(sb, 10, N(x1)); G(sb, 20, N(y1)); G(sb, 30, "0"); G(sb, 11, N(x2)); G(sb, 21, N(y2)); G(sb, 31, "0");
    });

    // DXF arcs run counter-clockwise from a0 to a1 (degrees).
    public Dxf Arc(double cx, double cy, double r, double a0, double a1, string layer = "0") => To(ents, sb =>
    {
        G(sb, 0, "ARC"); Common(sb, layer, null);
        G(sb, 10, N(cx)); G(sb, 20, N(cy)); G(sb, 30, "0"); G(sb, 40, N(r)); G(sb, 50, N(a0)); G(sb, 51, N(a1));
    });

    public Dxf Circle(double cx, double cy, double r, string layer = "0") => To(ents, sb =>
    {
        G(sb, 0, "CIRCLE"); Common(sb, layer, null);
        G(sb, 10, N(cx)); G(sb, 20, N(cy)); G(sb, 30, "0"); G(sb, 40, N(r));
    });

    public Dxf Rect(double x, double y, double w, double h, string layer = "0") =>
        Line(x, y, x + w, y, layer).Line(x + w, y, x + w, y + h, layer).Line(x + w, y + h, x, y + h, layer).Line(x, y + h, x, y, layer);

    // Vertices (x, y, bulge); bulge belongs to the piece that starts at that vertex.
    public Dxf Polyline(bool closed, string layer, params (double x, double y, double b)[] v) => To(ents, sb =>
    {
        G(sb, 0, "POLYLINE"); Common(sb, layer, null); G(sb, 66, "1"); G(sb, 70, closed ? "1" : "0");
        G(sb, 10, "0"); G(sb, 20, "0"); G(sb, 30, "0");
        foreach (var (x, y, b) in v)
        {
            G(sb, 0, "VERTEX"); G(sb, 8, layer); G(sb, 10, N(x)); G(sb, 20, N(y)); G(sb, 30, "0");
            if (b != 0) G(sb, 42, N(b));
        }
        G(sb, 0, "SEQEND"); G(sb, 8, layer);
    });

    public Dxf Text(double x, double y, double h, string value, string layer = "0") => To(ents, sb =>
    {
        G(sb, 0, "TEXT"); Common(sb, layer, null); G(sb, 10, N(x)); G(sb, 20, N(y)); G(sb, 30, "0"); G(sb, 40, N(h)); G(sb, 1, value);
    });

    public Dxf Block(string name, Action<Dxf> body)
    {
        var inner = new Dxf();
        body(inner);
        G(blocks, 0, "BLOCK"); G(blocks, 8, "0"); G(blocks, 2, name); G(blocks, 70, "0"); G(blocks, 10, "0"); G(blocks, 20, "0"); G(blocks, 30, "0");
        blocks.Append(inner.ents);
        G(blocks, 0, "ENDBLK"); G(blocks, 8, "0");
        return this;
    }

    public Dxf Insert(string block, double x, double y, double scale = 1, double rotation = 0, string layer = "0") => To(ents, sb =>
    {
        G(sb, 0, "INSERT"); Common(sb, layer, null); G(sb, 2, block); G(sb, 10, N(x)); G(sb, 20, N(y)); G(sb, 30, "0");
        G(sb, 41, N(scale)); G(sb, 42, N(scale)); G(sb, 50, N(rotation));
    });

    Dxf To(StringBuilder sb, Action<StringBuilder> a) { a(sb); return this; }

    public byte[] Bytes()
    {
        var sb = new StringBuilder();
        G(sb, 0, "SECTION"); G(sb, 2, "HEADER"); G(sb, 9, "$ACADVER"); G(sb, 1, "AC1009");
        if (codePage != null) { G(sb, 9, "$DWGCODEPAGE"); G(sb, 3, codePage); }
        G(sb, 0, "ENDSEC");
        G(sb, 0, "SECTION"); G(sb, 2, "TABLES");
        G(sb, 0, "TABLE"); G(sb, 2, "LTYPE"); G(sb, 70, "2");
        G(sb, 0, "LTYPE"); G(sb, 2, "CONTINUOUS"); G(sb, 70, "0"); G(sb, 3, "Solid"); G(sb, 72, "65"); G(sb, 73, "0"); G(sb, 40, "0");
        G(sb, 0, "LTYPE"); G(sb, 2, "DASHED"); G(sb, 70, "0"); G(sb, 3, "__ __"); G(sb, 72, "65"); G(sb, 73, "2"); G(sb, 40, "9"); G(sb, 49, "6"); G(sb, 49, "-3");
        G(sb, 0, "ENDTAB");
        G(sb, 0, "TABLE"); G(sb, 2, "LAYER"); G(sb, 70, layers.Count.ToString(CultureInfo.InvariantCulture));
        foreach (var (name, aci, lt) in layers) { G(sb, 0, "LAYER"); G(sb, 2, name); G(sb, 70, "0"); G(sb, 62, aci.ToString(CultureInfo.InvariantCulture)); G(sb, 6, lt); }
        G(sb, 0, "ENDTAB"); G(sb, 0, "ENDSEC");
        G(sb, 0, "SECTION"); G(sb, 2, "BLOCKS"); sb.Append(blocks); G(sb, 0, "ENDSEC");
        G(sb, 0, "SECTION"); G(sb, 2, "ENTITIES"); sb.Append(ents); G(sb, 0, "ENDSEC");
        G(sb, 0, "EOF");
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        return Encoding.GetEncoding(codePage == "ANSI_1253" ? 1253 : 1252).GetBytes(sb.ToString());
    }
}

// DXF 2004+ and DWG files for the tests, written with ACadSharp, the library Eyeshot reads them with.
public static class AcadFile
{
    public static byte[] Write(ACadSharp.CadDocument doc, bool dwg)
    {
        var ms = new MemoryStream();
        if (dwg) { using var w = new ACadSharp.IO.DwgWriter(ms, doc); w.Write(); }
        else { using var w = new ACadSharp.IO.DxfWriter(ms, doc, false); w.Write(); }
        return ms.ToArray();
    }
}
```

<!-- file: _src/laser-engine/Tests/ReaderTests.cs -->
```csharp
using ACadSharp;
using CSMath;
using Xunit;

namespace AidedCam.Laser.Tests;

public class ReaderTests
{
    static Drawing Read(byte[] b, Settings s = null) => Reader.Read(b, s ?? new Settings());

    [Fact]
    public void Lines_arcs_circles_and_bulge_polylines_become_pieces_in_groups()
    {
        var d = Read(new Dxf().Layer("CUT").Layer("ENGRAVE", 5)
            .Rect(0, 0, 100, 50, "CUT")
            .Circle(20, 25, 5, "CUT")
            .Polyline(true, "CUT", (60, 20, 0), (80, 20, 1), (80, 30, 0), (60, 30, 1))
            .Line(10, 10, 30, 10, "ENGRAVE").Bytes());
        Assert.Equal("dxf", d.Format);
        Assert.Equal("R12", d.Version);
        Assert.Equal(4 + 1 + 4 + 1, d.Segs.Count);
        Assert.Equal(1, d.Segs.Count(s => s.Kind == SegKind.Circle));
        Assert.Equal(2, d.Segs.Count(s => s.Kind == SegKind.Arc));
        var groups = d.Groups.ToDictionary(g => g.Layer);
        Assert.Equal(Roles.Cut, groups["CUT"].Role);
        Assert.Equal(Roles.Mark, groups["ENGRAVE"].Role);
        Assert.Equal("#0000ff", groups["ENGRAVE"].Color);
        Assert.Equal(9, groups["CUT"].Curves);
    }

    [Fact]
    public void A_colour_on_one_line_makes_its_own_group()
    {
        var d = Read(new Dxf().Line(0, 0, 10, 0).Line(0, 5, 10, 5, "0", 1).Bytes());
        Assert.Equal(2, d.Groups.Count);
        Assert.Contains(d.Groups, g => g.Key == "0|#ff0000");
    }

    [Fact]
    public void Blocks_are_exploded_with_scale_and_rotation_in_dxf_2004_and_dwg()
    {
        var doc = new CadDocument(ACadVersion.AC1018);
        var rec = new ACadSharp.Tables.BlockRecord("HOLE");
        rec.Entities.Add(new ACadSharp.Entities.Circle { Center = new XYZ(0, 0, 0), Radius = 3 });
        doc.BlockRecords.Add(rec);
        doc.Entities.Add(new ACadSharp.Entities.Insert(rec) { InsertPoint = new XYZ(40, 10, 0), XScale = 2, YScale = 2, Rotation = Math.PI / 6 });
        foreach (var dwg in new[] { false, true })
        {
            var d = Read(AcadFile.Write(doc, dwg));
            var c = Assert.Single(d.Segs);
            Assert.Equal(SegKind.Circle, c.Kind);
            Assert.Equal(6, c.R, 9);
            Assert.Equal(40, c.C.X, 9); Assert.Equal(10, c.C.Y, 9);
            Assert.Empty(d.EmptyBlocks);
        }
    }

    [Fact]
    public void Arrayed_inserts_are_exploded_copy_by_copy_in_dxf_and_dwg()
    {
        var doc = new CadDocument(ACadVersion.AC1018);
        var rec = new ACadSharp.Tables.BlockRecord("HOLE");
        rec.Entities.Add(new ACadSharp.Entities.Circle { Center = new XYZ(0, 0, 0), Radius = 3 });
        doc.BlockRecords.Add(rec);
        doc.Entities.Add(new ACadSharp.Entities.Insert(rec) { InsertPoint = new XYZ(10, 10, 0), ColumnCount = 3, RowCount = 2, ColumnSpacing = 20, RowSpacing = 15, Rotation = Math.PI / 2 });
        doc.PaperSpace.Entities.Add(new ACadSharp.Entities.Line { StartPoint = new XYZ(0, 0, 0), EndPoint = new XYZ(500, 0, 0) });   // ignored
        // Turned 90°: the columns run along +Y and the rows along −X.
        var expected = new List<(double, double)>();
        for (int r = 0; r < 2; r++) for (int c = 0; c < 3; c++) expected.Add((10 - 15 * r, 10 + 20 * c));
        foreach (var dwg in new[] { false, true })
        {
            var d = Read(AcadFile.Write(doc, dwg));
            Assert.All(d.Segs, s => Assert.Equal(SegKind.Circle, s.Kind));
            Assert.Equal(expected.OrderBy(p => p), d.Segs.Select(s => (Math.Round(s.C.X, 6), Math.Round(s.C.Y, 6))).OrderBy(p => p));
            Assert.Empty(d.NestedArrays);
        }
    }

    [Fact]
    public void An_array_inside_a_block_is_recorded_not_lost_silently()
    {
        var doc = new CadDocument(ACadVersion.AC1018);
        var hole = new ACadSharp.Tables.BlockRecord("HOLE");
        hole.Entities.Add(new ACadSharp.Entities.Circle { Center = new XYZ(0, 0, 0), Radius = 3 });
        doc.BlockRecords.Add(hole);
        var grid = new ACadSharp.Tables.BlockRecord("GRID");
        grid.Entities.Add(new ACadSharp.Entities.Insert(hole) { ColumnCount = 4, ColumnSpacing = 10 });
        doc.BlockRecords.Add(grid);
        doc.Entities.Add(new ACadSharp.Entities.Insert(grid) { InsertPoint = new XYZ(5, 5, 0) });
        foreach (var dwg in new[] { false, true }) Assert.Equal(new[] { "GRID" }, Read(AcadFile.Write(doc, dwg)).NestedArrays);
    }

    [Fact]
    public void An_R12_block_that_comes_in_empty_is_recorded_not_lost_silently()
    {
        var d = Read(new Dxf().Rect(0, 0, 100, 50).Block("HOLE", b => b.Circle(0, 0, 3)).Insert("HOLE", 40, 10).Bytes());
        Assert.Equal(new[] { "HOLE" }, d.EmptyBlocks);
        Assert.Equal(4, d.Segs.Count);
    }

    [Fact]
    public void Greek_text_in_a_1253_file_is_read_as_text_not_geometry()
    {
        var d = Read(new Dxf().CodePage("ANSI_1253").Text(5, 40, 3, "ΤΕΜΑΧΙΟ Α-1").Rect(0, 0, 10, 10).Bytes());
        var t = Assert.Single(d.Texts);
        Assert.Equal("ΤΕΜΑΧΙΟ Α-1", t.Value);
        Assert.Equal(3, t.Height, 9);
        Assert.Equal(4, d.Segs.Count);
    }

    [Fact]
    public void Layer_rules_match_greek_and_english_names_without_accents_or_case()
    {
        Assert.Equal(Roles.Mark, Roles.Default("ΧΑΡΑΞΗ"));
        Assert.Equal(Roles.Mark, Roles.Default("σήμανση"));
        Assert.Equal(Roles.Bend, Roles.Default("Κάμψεις"));
        Assert.Equal(Roles.Bend, Roles.Default("BEND_UP"));
        Assert.Equal(Roles.Ignore, Roles.Default("Defpoints"));
        Assert.Equal(Roles.Ignore, Roles.Default("διαστάσεις"));
        Assert.Equal(Roles.Cut, Roles.Default("0"));
        Assert.True(Roles.IsDashed("DASHED2"));
        Assert.False(Roles.IsDashed("CONTINUOUS"));
    }

    [Fact]
    public void R12_files_have_no_units_so_mm_is_assumed_unless_set()
    {
        var bytes = new Dxf().Line(0, 0, 1, 0).Bytes();
        var d = Read(bytes);
        Assert.Equal("assumed", d.UnitsSource);
        Assert.Equal(1, d.Segs[0].Length, 9);
        var inch = Read(bytes, new Settings { Units = "inch" });
        Assert.Equal("setting", inch.UnitsSource);
        Assert.Equal(25.4, inch.Segs[0].Length, 9);
    }

    [Fact]
    public void A_file_drawn_in_inches_is_converted_to_mm()
    {
        var doc = new CadDocument(ACadVersion.AC1018);
        doc.Header.InsUnits = ACadSharp.Types.Units.UnitsType.Inches;
        doc.Entities.Add(new ACadSharp.Entities.Line { StartPoint = new XYZ(0, 0, 0), EndPoint = new XYZ(2, 0, 0) });
        var bytes = AcadFile.Write(doc, false);
        var d = Read(bytes);
        Assert.Equal("inch", d.Units);
        Assert.Equal("file", d.UnitsSource);
        Assert.Equal(50.8, d.Segs[0].Length, 9);
        Assert.Equal(2, Read(bytes, new Settings { Units = "mm" }).Segs[0].Length, 9);   // the setting still wins
    }

    [Fact]
    public void A_dwg_file_is_read_with_its_text()
    {
        var doc = new CadDocument(ACadVersion.AC1032);
        doc.Entities.Add(new ACadSharp.Entities.Line { StartPoint = new XYZ(0, 0, 0), EndPoint = new XYZ(100, 0, 0) });
        doc.Entities.Add(new ACadSharp.Entities.Circle { Center = new XYZ(20, 25, 0), Radius = 5 });
        doc.Entities.Add(new ACadSharp.Entities.TextEntity { Value = "ΑΒΓ", InsertPoint = new XYZ(5, 40, 0), Height = 3 });
        var d = Read(AcadFile.Write(doc, true));
        Assert.Equal("dwg", d.Format);
        Assert.Equal("2018", d.Version);
        Assert.Equal(2, d.Segs.Count);
        Assert.Equal("ΑΒΓ", Assert.Single(d.Texts).Value);
    }

    [Fact]
    public void Files_that_are_not_cad_or_are_binary_dxf_are_refused_with_a_reason()
    {
        var e1 = Assert.Throws<LaserFileException>(() => Read(System.Text.Encoding.ASCII.GetBytes("hello world")));
        Assert.Equal("read", e1.Reason);
        var e2 = Assert.Throws<LaserFileException>(() => Read(System.Text.Encoding.ASCII.GetBytes("AutoCAD Binary DXF\r\n\u001a\0")));
        Assert.Equal("read", e2.Reason);
        var e3 = Assert.Throws<LaserFileException>(() => Read(System.Text.Encoding.ASCII.GetBytes("AC1040 future dwg")));
        Assert.Equal("version", e3.Reason);
    }
}
```

Run: `for f in Dxf ReaderTests; do node _tests/extract.mjs <brief> _src/laser-engine/Tests/$f.cs; done`

- [ ] **Step 2: Run them and see them fail**

Run: `dotnet test _src/laser-engine/Tests 2>&1 | grep -m1 -E "error CS"`
Expected: `error CS0246` naming `Drawing` or `Settings`.

- [ ] **Step 3: Write the model, the roles and the reader**

<!-- file: _src/laser-engine/Engine/Model.cs -->
```csharp
namespace AidedCam.Laser;

// Geometry that shares a layer and a colour. Every group has exactly one role (spec §7).
public sealed class Group
{
    public string Layer = "0";
    public string Color = "#000000";          // resolved colour, #rrggbb
    public string LineType = "CONTINUOUS";    // resolved linetype name, upper case
    public int Curves;                        // pieces read on this group
    public string DefaultRole = Roles.Cut;
    public string Role = Roles.Cut;
    public string Key => Layer + "|" + Color;
}

public sealed class TextItem
{
    public P At;
    public double Height;
    public double Rotation;                   // degrees
    public string Value = "";
}

// What the reader returns: pieces in millimetres on the XY plane, plus everything the checks need.
public sealed class Drawing
{
    public string Format = "dxf";             // "dxf" or "dwg"
    public string Version = "";               // AutoCAD version name, e.g. "R12", "2018"
    public string Units = "mm";               // units the file said: "mm", "inch", "cm", "m", "ft" or "none"
    public string UnitsSource = "file";       // "file", "assumed" or "setting"
    public List<Seg> Segs = new();
    public List<Group> Groups = new();
    public List<TextItem> Texts = new();
    public bool NotFlat;
    public SortedSet<string> EmptyBlocks = new();   // block references that came in without geometry (R12 blocks, see spec §9)
    public SortedSet<string> NestedArrays = new();  // blocks holding an arrayed insert (MINSERT), read once only
    public Dictionary<string, int> Ignored = new() { ["hatch"] = 0, ["dim"] = 0, ["leader"] = 0, ["point"] = 0, ["other"] = 0 };
}

public sealed class Settings
{
    public string Units = "auto";             // "auto", "mm" or "inch"
    public double JoinTol = 0.01;             // mm
    public double GapTol = 0.2;               // mm
    public Dictionary<string, string> Roles = new();   // group key → role, from the roles table
}

// A file the engine refuses. Reason is one of: read, version, limit.
public sealed class LaserFileException(string reason, string message) : Exception(message)
{
    public string Reason { get; } = reason;
}

public static class Limits
{
    public const int MaxBytes = 20 * 1024 * 1024;
    public const int MaxCurves = 200_000;
    public const double Tiny = 0.001;        // mm: shorter pieces are removed
}
```

<!-- file: _src/laser-engine/Engine/Roles.cs -->
```csharp
namespace AidedCam.Laser;

// Default roles from the layer name (spec §7). Matching is case- and accent-insensitive, Greek and English.
public static class Roles
{
    public const string Cut = "cut", Mark = "mark", Bend = "bend", Ignore = "ignore";
    public static readonly string[] All = { Cut, Mark, Bend, Ignore };

    static readonly string[] MarkWords = { "mark", "engrave", "etch", "χαραξ", "σημανσ" };
    static readonly string[] BendWords = { "bend", "fold", "καμψ", "στραντζ" };
    static readonly string[] IgnoreWords = { "dim", "defpoints", "construction", "center", "centre", "αξον", "διαστασ" };
    static readonly string[] DashedWords = { "DASH", "HIDDEN", "CENTER", "CENTRE", "PHANTOM", "DOT", "DIVIDE", "BORDER" };

    public static string Default(string layer)
    {
        string s = Fold(layer ?? "");
        if (MarkWords.Any(s.Contains)) return Mark;
        if (BendWords.Any(s.Contains)) return Bend;
        if (IgnoreWords.Any(s.Contains)) return Ignore;
        return Cut;
    }

    public static bool IsDashed(string lineType)
    {
        string s = (lineType ?? "").ToUpperInvariant();
        return DashedWords.Any(s.Contains);
    }

    public static bool IsRole(string role) => Array.IndexOf(All, role) >= 0;

    // Lower case without Greek accents. Written out by hand: the browser runs in invariant globalization.
    public static string Fold(string s)
    {
        var sb = new System.Text.StringBuilder(s.Length);
        foreach (char ch in s.ToLowerInvariant())
        {
            sb.Append(ch switch
            {
                'ά' => 'α', 'έ' => 'ε', 'ή' => 'η', 'ί' or 'ϊ' or 'ΐ' => 'ι', 'ό' => 'ο', 'ύ' or 'ϋ' or 'ΰ' => 'υ', 'ώ' => 'ω', 'ς' => 'σ',
                _ => ch,
            });
        }
        return sb.ToString();
    }
}
```

<!-- file: _src/laser-engine/Engine/Reader.cs -->
```csharp
using devDept.Eyeshot;
using devDept.Eyeshot.Entities;
using devDept.Eyeshot.Translators;
using devDept.Geometry;

namespace AidedCam.Laser;

// Reads a DXF or DWG with Eyeshot's managed readers and turns model space into flat pieces in mm (spec §4).
public static class Reader
{
    const double Deviation = 0.01;     // mm: splines and ellipses become lines within this error

    public static Drawing Read(byte[] bytes, Settings settings)
    {
        if (bytes.Length > Limits.MaxBytes) throw new LaserFileException("limit", "over 20 MB");
        var d = new Drawing();
        string head = System.Text.Encoding.ASCII.GetString(bytes, 0, Math.Min(bytes.Length, 4096));
        ReadFileAsync rd;
        if (head.StartsWith("AC10"))
        {
            d.Format = "dwg";
            d.Version = VersionName(head.Substring(0, 6));
            if (d.Version == "") throw new LaserFileException("version", $"DWG version {head.Substring(0, 6)} is not supported");
            rd = new ReadDWG(new MemoryStream(bytes), /* password */ null, /* fixErrors */ false, /* skipProxies */ true);
        }
        else if (head.StartsWith("AutoCAD Binary DXF")) throw new LaserFileException("read", "binary DXF is not supported");
        else if (head.Contains("SECTION"))
        {
            d.Format = "dxf";
            int v = head.IndexOf("$ACADVER");
            if (v >= 0) { var m = System.Text.RegularExpressions.Regex.Match(head.Substring(v), @"AC\d{4}"); if (m.Success) d.Version = VersionName(m.Value); }
            rd = new ReadDXF(new MemoryStream(bytes));
        }
        else throw new LaserFileException("read", "not a DXF or DWG file");

        try { rd.DoWork(null, CancellationToken.None); }
        catch (Exception ex) { throw new LaserFileException("read", ex.Message); }
        if (!rd.Result) throw new LaserFileException("read", "the file could not be read");

        double scale = UnitScale(rd.Units, settings, d);
        var layers = rd.Layers;
        var groups = new Dictionary<string, int>();
        foreach (var e in rd.Entities)
        {
            if (e is BlockReference br)
            {
                var inner = br.ExplodeDeep(rd.Blocks, /* keepTessellation */ false);
                if (inner == null || inner.Length == 0) d.EmptyBlocks.Add(br.BlockName ?? "?");   // Eyeshot reads R12 blocks without their geometry
                else foreach (var x in inner) Add(d, x, layers, groups, scale);
            }
            else Add(d, e, layers, groups, scale);
            if (d.Segs.Count > Limits.MaxCurves) throw new LaserFileException("limit", "over 200,000 curves");
        }
        AddArrays(d, bytes, rd.Blocks, layers, groups, scale);
        foreach (var g in d.Groups) g.Role = settings.Roles.TryGetValue(g.Key, out var r) && Roles.IsRole(r) ? r : g.DefaultRole;
        return d;
    }

    // Arrayed inserts (MINSERT). Eyeshot's conversion keeps only the first copy from a DXF file and drops the
    // whole insert from a DWG file, while ACadSharp, which Eyeshot reads with, keeps the array. So model-space
    // arrays are read again with ACadSharp and the missing copies are exploded here (spec §4). An array inside
    // a block definition is only recorded, for the block-array check. A DXF without one skips the second read.
    static void AddArrays(Drawing d, byte[] bytes, BlockKeyedCollection blocks, LayerKeyedCollection layers, Dictionary<string, int> groups, double k)
    {
        bool dwg = d.Format == "dwg";
        if (!dwg && !DxfHasArray(bytes)) return;
        ACadSharp.CadDocument doc;
        try { doc = dwg ? ACadSharp.IO.DwgReader.Read(new MemoryStream(bytes)) : ACadSharp.IO.DxfReader.Read(new MemoryStream(bytes)); }
        catch { return; }                                   // Eyeshot read the file; without ACadSharp's view there is nothing to add
        static bool IsArray(ACadSharp.Entities.Insert i) => i.RowCount > 1 || i.ColumnCount > 1;
        foreach (var rec in doc.BlockRecords)
        {
            bool space = rec.Name.Equals("*Model_Space", StringComparison.OrdinalIgnoreCase) || rec.Name.StartsWith("*Paper_Space", StringComparison.OrdinalIgnoreCase);
            if (!space && rec.Entities.OfType<ACadSharp.Entities.Insert>().Any(IsArray)) d.NestedArrays.Add(rec.Name);
        }
        foreach (var ins in doc.Entities.OfType<ACadSharp.Entities.Insert>().Where(IsArray))
        {
            double cos = Math.Cos(ins.Rotation), sin = Math.Sin(ins.Rotation);
            for (int r = 0; r < Math.Max(1, (int)ins.RowCount); r++)
                for (int c = 0; c < Math.Max(1, (int)ins.ColumnCount); c++)
                {
                    if (!dwg && r == 0 && c == 0) continue;     // the copy Eyeshot kept
                    double ox = c * ins.ColumnSpacing, oy = r * ins.RowSpacing;     // the grid turns with the insert
                    var br = new BlockReference(ins.InsertPoint.X + ox * cos - oy * sin, ins.InsertPoint.Y + ox * sin + oy * cos, ins.InsertPoint.Z,
                        ins.Block.Name, ins.XScale, ins.YScale, ins.ZScale, ins.Rotation) { LayerName = ins.Layer?.Name ?? "0" };
                    var inner = br.ExplodeDeep(blocks, /* keepTessellation */ false);
                    if (inner == null || inner.Length == 0) d.EmptyBlocks.Add(ins.Block.Name);
                    else foreach (var x in inner) Add(d, x, layers, groups, k);
                    if (d.Segs.Count > Limits.MaxCurves) throw new LaserFileException("limit", "over 200,000 curves");
                }
        }
    }

    // True when a DXF file has an INSERT with more than one column (code 70) or row (code 71).
    static bool DxfHasArray(byte[] bytes)
    {
        var text = System.Text.Encoding.Latin1.GetString(bytes);
        if (text.IndexOf("INSERT", StringComparison.Ordinal) < 0) return false;
        var lines = text.Split('\n');
        bool insert = false;
        for (int i = 0; i + 1 < lines.Length; i += 2)
        {
            string code = lines[i].Trim(), value = lines[i + 1].Trim();
            if (code == "0") insert = value == "INSERT";
            else if (insert && (code == "70" || code == "71") && int.TryParse(value, out int n) && n > 1) return true;
        }
        return false;
    }

    static string VersionName(string ac) => ac switch
    {
        "AC1009" => "R12", "AC1012" => "R13", "AC1014" => "R14", "AC1015" => "2000", "AC1018" => "2004",
        "AC1021" => "2007", "AC1024" => "2010", "AC1027" => "2013", "AC1032" => "2018", _ => "",
    };

    static double UnitScale(linearUnitsType u, Settings s, Drawing d)
    {
        (string name, double k) = u switch
        {
            linearUnitsType.Millimeters => ("mm", 1.0),
            linearUnitsType.Centimeters => ("cm", 10.0),
            linearUnitsType.Meters => ("m", 1000.0),
            linearUnitsType.Inches => ("inch", 25.4),
            linearUnitsType.Feet => ("ft", 304.8),
            _ => ("none", 1.0),
        };
        d.Units = name;
        if (s.Units == "mm" || s.Units == "inch") { d.UnitsSource = "setting"; return s.Units == "inch" ? 25.4 : 1.0; }
        d.UnitsSource = name == "none" ? "assumed" : "file";
        return k;
    }

    static int GroupOf(Drawing d, Entity e, LayerKeyedCollection layers, Dictionary<string, int> groups)
    {
        string layer = string.IsNullOrEmpty(e.LayerName) ? "0" : e.LayerName;
        Layer l = layers.Contains(layer) ? layers[layer] : null;
        var color = e.ColorMethod == colorMethodType.byLayer && l != null ? l.Color : e.Color;
        string hex = $"#{color.R:x2}{color.G:x2}{color.B:x2}";
        string lt = (e.LineTypeMethod == colorMethodType.byLayer || string.IsNullOrEmpty(e.LineTypeName)) && l != null
            ? l.LineTypeName : e.LineTypeName;
        string key = layer + "|" + hex;
        if (!groups.TryGetValue(key, out int gi))
        {
            gi = d.Groups.Count;
            groups[key] = gi;
            d.Groups.Add(new Group { Layer = layer, Color = hex, LineType = (lt ?? "CONTINUOUS").ToUpperInvariant(), DefaultRole = Roles.Default(layer) });
        }
        return gi;
    }

    static void Add(Drawing d, Entity e, LayerKeyedCollection layers, Dictionary<string, int> groups, double k)
    {
        switch (e)
        {
            case Dimension: d.Ignored["dim"]++; return;      // Dimension derives from Text in Eyeshot: test it first
            case Text t:
                var ax = t.Plane.AxisX;
                d.Texts.Add(new TextItem
                {
                    At = new P(t.InsertionPoint.X * k, t.InsertionPoint.Y * k),
                    Height = t.Height * k,
                    Rotation = Math.Atan2(ax.Y, ax.X) * 180 / Math.PI,
                    Value = t.TextString ?? "",
                });
                return;
            case Hatch: d.Ignored["hatch"]++; return;
            case Leader: d.Ignored["leader"]++; return;
            case devDept.Eyeshot.Entities.Point: d.Ignored["point"]++; return;
        }
        if (e is not ICurve) { d.Ignored["other"]++; return; }
        int g = GroupOf(d, e, layers, groups);
        int before = d.Segs.Count;
        AddCurve(d, (ICurve)e, g, k);
        d.Groups[g].Curves += d.Segs.Count - before;
    }

    static bool Flat(Plane p) => Math.Abs(Math.Abs(p.AxisZ.Z) - 1) < 1e-9;
    static P Q(Point3D p, double k) => new(p.X * k, p.Y * k);

    static void AddCurve(Drawing d, ICurve c, int g, double k)
    {
        switch (c)
        {
            case Line ln:
                if (Math.Abs(ln.StartPoint.Z) > 1e-6 || Math.Abs(ln.EndPoint.Z) > 1e-6) d.NotFlat = true;
                d.Segs.Add(Seg.Line(Q(ln.StartPoint, k), Q(ln.EndPoint, k), g));
                return;
            case Circle ci when ci is not Arc && Flat(ci.Plane):
                if (Math.Abs(ci.Center.Z) > 1e-6) d.NotFlat = true;
                d.Segs.Add(Seg.Circle(Q(ci.Center, k), ci.Radius * k, g));
                return;
            case Arc ar when Flat(ar.Plane):
                if (Math.Abs(ar.Center.Z) > 1e-6) d.NotFlat = true;
                P a = Q(ar.StartPoint, k), b = Q(ar.EndPoint, k), m = Q(ar.MidPoint, k);
                bool ccw = P.Cross(b - a, m - a) < 0;
                d.Segs.Add(Seg.Arc(Q(ar.Center, k), ar.Radius * k, a, b, ccw, g));
                return;
            case CompositeCurve cc:
                foreach (var sub in cc.CurveList) AddCurve(d, sub, g, k);
                return;
            case LinearPath lp:
                AddPoints(d, lp.Vertices, g, k);
                return;
            default:
                // Splines, ellipses and anything tilted out of the XY plane: lines within the deviation.
                if (c is Circle tilted && !Flat(tilted.Plane)) d.NotFlat = true;
                var path = c.ConvertToLinearPath(/* deviation */ Deviation / k, /* angle */ 0);
                if (path != null) AddPoints(d, path.Vertices, g, k);
                return;
        }
    }

    static void AddPoints(Drawing d, Point3D[] v, int g, double k)
    {
        if (v == null) return;
        foreach (var p in v) if (Math.Abs(p.Z) > 1e-6) { d.NotFlat = true; break; }
        for (int i = 0; i + 1 < v.Length; i++) d.Segs.Add(Seg.Line(Q(v[i], k), Q(v[i + 1], k), g));
    }
}
```

Run: `for f in Model Roles Reader; do node _tests/extract.mjs <brief> _src/laser-engine/Engine/$f.cs; done`

- [ ] **Step 4: Run the tests**

Run: `dotnet test _src/laser-engine/Tests 2>&1 | tail -1`
Expected: `Passed: 16`, `Failed: 0`.

- [ ] **Step 5: Commit**

```bash
git add _src/laser-engine
git commit -F - <<'EOF'
Laser DXF check: read DXF and DWG into flat pieces in mm, with roles and units

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 3: Repair and contours

**Files:**
- Create: `_src/laser-engine/Engine/Repair.cs`, `_src/laser-engine/Engine/Chains.cs`, `_src/laser-engine/Tests/RepairTests.cs`

**Interfaces:**
- Consumes: `Seg`, `Geo` (Task 1); `Limits`, `Roles` (Task 2).
- Produces:
  - `Marker { Kind "open"|"gap"|"branch"|"self", At, Size }`.
  - `RepairStats { TinyRemoved, DuplicatesRemoved, DuplicateLength, OverlapsMerged, GapsClosed, MaxGapClosed }`.
  - `Graph { Nodes, Edges (Seg s, int a, int b), Circles }`.
  - `Repair.RemoveTiny(List<Seg>, RepairStats)`.
  - `Repair.MergeOverlaps(List<Seg>, double tol, RepairStats)`.
  - `Repair.Join(List<Seg>, double joinTol, double gapTol, RepairStats, List<Marker>) → Graph`.
  - `Contour { Id, Role, Closed, Segs, Length, Part, IsHole, Area }`.
  - `PartInfo { Id, Outer, Holes, Area, CutLength, Pierces, Min, Max }`.
  - `Chains.Build(Graph, string role, List<Marker>, ref int branches) → List<Contour>`.
  - `Chains.SelfIntersections(List<Contour>, List<Marker>) → int`.
  - `Chains.Parts(List<Contour>) → List<PartInfo>`: grid-indexed, and largest area first.
  - `Chains.Bounds(Contour)`.

- [ ] **Step 1: Write the failing tests**

<!-- file: _src/laser-engine/Tests/RepairTests.cs -->
```csharp
using Xunit;

namespace AidedCam.Laser.Tests;

public class RepairTests
{
    static Seg L(double x1, double y1, double x2, double y2) => Seg.Line(new P(x1, y1), new P(x2, y2), 0);

    static List<Contour> Chain(List<Seg> segs, RepairStats st, List<Marker> markers, double gap = 0.2)
    {
        int branches = 0;
        var merged = Repair.MergeOverlaps(Repair.RemoveTiny(segs, st), 0.01, st);
        return Chains.Build(Repair.Join(merged, 0.01, gap, st, markers), Roles.Cut, markers, ref branches);
    }

    [Fact]
    public void Tiny_pieces_are_removed_and_counted()
    {
        var st = new RepairStats();
        var keep = Repair.RemoveTiny(new List<Seg> { L(0, 0, 10, 0), L(10, 0, 10.0005, 0) }, st);
        Assert.Single(keep);
        Assert.Equal(1, st.TinyRemoved);
    }

    [Fact]
    public void Identical_reversed_and_overlapping_lines_are_cut_once()
    {
        var st = new RepairStats();
        var outp = Repair.MergeOverlaps(new List<Seg>
        {
            L(0, 0, 100, 0), L(100, 0, 0, 0),          // the same line twice, once reversed
            L(50, 0, 150, 0),                           // overlaps the first by 50
            L(150, 0, 200, 0),                          // only touches: stays its own piece
            L(0, 10, 100, 10),                          // parallel, not collinear
        }, 0.01, st);
        Assert.Equal(3, outp.Count);
        var merged = outp.Single(s => s.A.Y == 0 && s.Length > 100);
        Assert.Equal(150, merged.Length, 9);
        Assert.Equal(2, st.DuplicatesRemoved);
        Assert.Equal(150, st.DuplicateLength, 9);       // 100 + 100 + 100 read, 150 kept
    }

    [Fact]
    public void Arcs_on_one_circle_merge_and_a_full_circle_covers_them()
    {
        var st = new RepairStats();
        var c = new P(0, 0);
        var outp = Repair.MergeOverlaps(new List<Seg>
        {
            Seg.Arc(c, 10, new P(10, 0), new P(-10, 0), true, 0),
            Seg.Arc(c, 10, new P(0, 10), new P(0, -10), true, 0),     // overlaps the first quarter to half
        }, 0.01, st);
        var a = Assert.Single(outp);
        Assert.Equal(SegKind.Arc, a.Kind);
        Assert.Equal(Math.PI * 1.5, a.Sweep, 6);
        var withCircle = Repair.MergeOverlaps(new List<Seg> { Seg.Circle(c, 10, 0), Seg.Arc(c, 10, new P(10, 0), new P(0, 10), true, 0) }, 0.01, new RepairStats());
        Assert.Equal(SegKind.Circle, Assert.Single(withCircle).Kind);
    }

    [Fact]
    public void Ends_within_the_join_tolerance_meet_and_a_rectangle_closes()
    {
        var st = new RepairStats(); var markers = new List<Marker>();
        var cs = Chain(new List<Seg> { L(0, 0, 100, 0), L(100.005, 0, 100, 50), L(100, 50, 0, 50), L(0, 50, 0, 0.004) }, st, markers);
        var c = Assert.Single(cs);
        Assert.True(c.Closed);
        Assert.Equal(0, st.GapsClosed);
        Assert.Empty(markers);
    }

    [Fact]
    public void A_gap_between_two_lines_is_closed_at_the_midpoint_and_marked()
    {
        var st = new RepairStats(); var markers = new List<Marker>();
        var cs = Chain(new List<Seg> { L(0, 0, 100, 0), L(100, 0, 100, 50), L(100, 50, 0, 50), L(0, 50, 0, 0.15) }, st, markers);
        var c = Assert.Single(cs);
        Assert.True(c.Closed);
        Assert.Equal(1, st.GapsClosed);
        Assert.Equal(0.15, st.MaxGapClosed, 9);
        var m = Assert.Single(markers);
        Assert.Equal("gap", m.Kind);
        Assert.Equal(0.075, m.At.Y, 9);
        Assert.DoesNotContain(c.Segs, s => s.Bridge);
    }

    [Fact]
    public void A_gap_at_an_arc_end_gets_a_short_bridge_line_so_the_radius_stays()
    {
        var st = new RepairStats(); var markers = new List<Marker>();
        // A half circle closed by a diameter line that stops 0.1 short of the arc.
        var cs = Chain(new List<Seg> { Seg.Arc(new P(0, 0), 10, new P(10, 0), new P(-10, 0), true, 0), L(-10, 0, 9.9, 0) }, st, markers);
        var c = Assert.Single(cs);
        Assert.True(c.Closed);
        var bridge = Assert.Single(c.Segs, s => s.Bridge);
        Assert.Equal(0.1, bridge.Length, 9);
        Assert.Equal(10, c.Segs.Single(s => s.Kind == SegKind.Arc).R, 9);
    }

    [Fact]
    public void A_gap_wider_than_the_tolerance_stays_open_with_red_ends()
    {
        var st = new RepairStats(); var markers = new List<Marker>();
        var cs = Chain(new List<Seg> { L(0, 0, 100, 0), L(100, 0, 100, 50), L(100, 50, 0, 50), L(0, 50, 0, 0.5) }, st, markers);
        var c = Assert.Single(cs);
        Assert.False(c.Closed);
        Assert.Equal(2, markers.Count(m => m.Kind == "open"));
        Assert.Equal(0, st.GapsClosed);
    }
}
```

Run: `node _tests/extract.mjs <brief> _src/laser-engine/Tests/RepairTests.cs`

- [ ] **Step 2: Run them and see them fail**

Run: `dotnet test _src/laser-engine/Tests 2>&1 | grep -m1 -E "error CS"`
Expected: `error CS0246` naming `RepairStats`, `Marker` or `Contour`, or `error CS0103: The name 'Repair' does not exist`.

- [ ] **Step 3: Write the repair and the chains**

<!-- file: _src/laser-engine/Engine/Repair.cs -->
```csharp
namespace AidedCam.Laser;

public sealed class Marker
{
    public string Kind;          // "open", "gap", "branch" or "self"
    public P At;
    public double Size;          // gap width for "gap", 0 otherwise
}

public sealed class RepairStats
{
    public int TinyRemoved, DuplicatesRemoved, OverlapsMerged, GapsClosed;
    public double DuplicateLength, MaxGapClosed;
}

// Repair steps 1–4 of spec §5, on the pieces of one role. Steps 3–4 give every piece start/end node ids.
public static class Repair
{
    // Step 1: pieces shorter than Limits.Tiny.
    public static List<Seg> RemoveTiny(List<Seg> segs, RepairStats st)
    {
        var keep = segs.Where(s => s.Length >= Limits.Tiny).ToList();
        st.TinyRemoved += segs.Count - keep.Count;
        return keep;
    }

    // Step 2: identical pieces and overlaps. Collinear lines and arcs on the same circle are merged
    // where they overlap by more than tol, so each stretch is cut once.
    public static List<Seg> MergeOverlaps(List<Seg> segs, double tol, RepairStats st)
    {
        var lines = segs.Where(s => s.Kind == SegKind.Line).ToList();
        var round = segs.Where(s => s.Kind != SegKind.Line).ToList();
        var outp = new List<Seg>();
        outp.AddRange(MergeLines(lines, tol, st));
        outp.AddRange(MergeRound(round, tol, st));
        return outp;
    }

    static List<Seg> MergeLines(List<Seg> lines, double tol, RepairStats st)
    {
        // Canonical direction angle in [0, π) and signed offset of the infinite line from the origin.
        var items = lines.Select(s =>
        {
            var d = s.B - s.A; double len = d.Length;
            var u = new P(d.X / len, d.Y / len);
            if (u.Y < 0 || (u.Y == 0 && u.X < 0)) u = new P(-u.X, -u.Y);
            double ang = Math.Atan2(u.Y, u.X);
            if (ang >= Math.PI - 1e-9) { ang = 0; u = new P(1, 0); }
            double off = P.Cross(u, s.A);
            return (s, u, ang, off);
        }).OrderBy(x => x.ang).ThenBy(x => x.off).ToList();

        var result = new List<Seg>();
        int i = 0;
        while (i < items.Count)
        {
            // A run of parallel lines on the same infinite line (within tol).
            int j = i + 1;
            while (j < items.Count && items[j].ang - items[i].ang < 1e-6 && Math.Abs(items[j].off - items[j - 1].off) <= tol) j++;
            var run = items.GetRange(i, j - i);
            i = j;
            if (run.Count == 1) { result.Add(run[0].s); continue; }
            var u0 = run[0].u;
            var iv = run.Select(x =>
            {
                double t0 = x.s.A.X * u0.X + x.s.A.Y * u0.Y, t1 = x.s.B.X * u0.X + x.s.B.Y * u0.Y;
                return t0 <= t1 ? (lo: t0, hi: t1, pLo: x.s.A, pHi: x.s.B, s: x.s) : (lo: t1, hi: t0, pLo: x.s.B, pHi: x.s.A, s: x.s);
            }).OrderBy(x => x.lo).ToList();
            int k = 0;
            while (k < iv.Count)
            {
                var cur = iv[k]; int members = 1; double sum = cur.hi - cur.lo;
                int m = k + 1;
                while (m < iv.Count && iv[m].lo < cur.hi - tol)
                {
                    sum += iv[m].hi - iv[m].lo;
                    if (iv[m].hi > cur.hi) { cur.hi = iv[m].hi; cur.pHi = iv[m].pHi; }
                    members++; m++;
                }
                if (members == 1) result.Add(cur.s);
                else
                {
                    result.Add(Seg.Line(cur.pLo, cur.pHi, cur.s.Group));
                    st.DuplicatesRemoved += members - 1;
                    st.OverlapsMerged++;
                    st.DuplicateLength += sum - (cur.hi - cur.lo);
                }
                k = m;
            }
        }
        return result;
    }

    static List<Seg> MergeRound(List<Seg> round, double tol, RepairStats st)
    {
        var result = new List<Seg>();
        var used = new bool[round.Count];
        double cell = Math.Max(tol, 1e-6) * 2;
        var byCentre = new Dictionary<(long, long), List<int>>();
        for (int i = 0; i < round.Count; i++)
        {
            var k = ((long)Math.Floor(round[i].C.X / cell), (long)Math.Floor(round[i].C.Y / cell));
            if (!byCentre.TryGetValue(k, out var l)) byCentre[k] = l = new List<int>();
            l.Add(i);
        }
        for (int i = 0; i < round.Count; i++)
        {
            if (used[i]) continue;
            var same = new List<Seg> { round[i] }; used[i] = true;
            long kx = (long)Math.Floor(round[i].C.X / cell), ky = (long)Math.Floor(round[i].C.Y / cell);
            for (long dx = -1; dx <= 1; dx++)
                for (long dy = -1; dy <= 1; dy++)
                    if (byCentre.TryGetValue((kx + dx, ky + dy), out var near))
                        foreach (int j in near)
                            if (!used[j] && round[j].C.DistanceTo(round[i].C) <= tol && Math.Abs(round[j].R - round[i].R) <= tol) { same.Add(round[j]); used[j] = true; }
            if (same.Count == 1) { result.Add(same[0]); continue; }
            var circle = same.FirstOrDefault(s => s.Kind == SegKind.Circle);
            if (circle != null)
            {
                // A full circle covers every arc on it.
                result.Add(circle);
                st.DuplicatesRemoved += same.Count - 1; st.OverlapsMerged++;
                st.DuplicateLength += same.Where(s => s != circle).Sum(s => s.Length);
                continue;
            }
            // Arcs as counter-clockwise angular intervals [lo, lo + sweep], merged where they overlap.
            var iv = same.Select(s =>
            {
                var c = s.Ccw ? s : s.Reversed();
                return (lo: c.StartAngle, sw: c.Sweep, pLo: c.A, pHi: c.B, s);
            }).OrderBy(x => x.lo).ToList();
            double angTol = tol / same[0].R;
            var merged = new List<(double lo, double sw, P pLo, P pHi, Seg s, int n, double sum)>();
            foreach (var x in iv)
            {
                bool joined = false;
                for (int q = 0; q < merged.Count; q++)
                {
                    var g = merged[q];
                    double d = x.lo - g.lo; while (d < 0) d += 2 * Math.PI;
                    if (d < g.sw - angTol)
                    {
                        double end = Math.Max(g.sw, d + x.sw);
                        merged[q] = (g.lo, end, g.pLo, end > g.sw ? x.pHi : g.pHi, g.s, g.n + 1, g.sum + x.sw);
                        joined = true; break;
                    }
                }
                if (!joined) merged.Add((x.lo, x.sw, x.pLo, x.pHi, x.s, 1, x.sw));
            }
            foreach (var g in merged)
            {
                if (g.n == 1) { result.Add(g.s); continue; }
                st.DuplicatesRemoved += g.n - 1; st.OverlapsMerged++;
                double r = g.s.R;
                if (g.sw >= 2 * Math.PI - angTol) { st.DuplicateLength += (g.sum - 2 * Math.PI) * r; result.Add(Seg.Circle(g.s.C, r, g.s.Group)); }
                else { st.DuplicateLength += (g.sum - g.sw) * r; result.Add(Seg.Arc(g.s.C, r, g.pLo, g.pHi, true, g.s.Group)); }
            }
        }
        return result;
    }

    // Steps 3 and 4. Returns the node positions; every non-circle piece gets Start/End node ids in the lists.
    public static Graph Join(List<Seg> segs, double joinTol, double gapTol, RepairStats st, List<Marker> markers)
    {
        var g = new Graph();
        double cell = Math.Max(gapTol, joinTol) * 2;
        var grid = new Dictionary<(long, long), List<int>>();
        (long, long) Key(P p) => ((long)Math.Floor(p.X / cell), (long)Math.Floor(p.Y / cell));

        int NodeFor(P p)
        {
            var k = Key(p);
            for (long dx = -1; dx <= 1; dx++)
                for (long dy = -1; dy <= 1; dy++)
                    if (grid.TryGetValue((k.Item1 + dx, k.Item2 + dy), out var list))
                        foreach (int n in list) if (g.Nodes[n].DistanceTo(p) <= joinTol) return n;
            g.Nodes.Add(p);
            if (!grid.TryGetValue(k, out var l2)) grid[k] = l2 = new List<int>();
            l2.Add(g.Nodes.Count - 1);
            return g.Nodes.Count - 1;
        }

        foreach (var s in segs)
        {
            if (s.Kind == SegKind.Circle) { g.Circles.Add(s); continue; }
            int a = NodeFor(s.A), b = NodeFor(s.B);
            if (a == b && s.Kind == SegKind.Line) { st.TinyRemoved++; continue; }     // collapsed by the join
            s.A = g.Nodes[a]; s.B = g.Nodes[b];
            g.Edges.Add((s, a, b));
        }

        // Gap closing: pair loose ends (nodes with one piece end) within gapTol of each other, nearest first.
        var degree = new int[g.Nodes.Count];
        var edgeAt = new int[g.Nodes.Count];
        for (int q = 0; q < g.Edges.Count; q++) { var e = g.Edges[q]; degree[e.a]++; degree[e.b]++; edgeAt[e.a] = q; edgeAt[e.b] = q; }
        var pairs = new List<(double d, int a, int b)>();
        for (int n = 0; n < g.Nodes.Count; n++)
        {
            if (degree[n] != 1) continue;
            var k = Key(g.Nodes[n]);
            for (long dx = -1; dx <= 1; dx++)
                for (long dy = -1; dy <= 1; dy++)
                    if (grid.TryGetValue((k.Item1 + dx, k.Item2 + dy), out var list))
                        foreach (int m in list)
                        {
                            if (m <= n || degree[m] != 1) continue;
                            double d = g.Nodes[n].DistanceTo(g.Nodes[m]);
                            if (d > gapTol) continue;
                            if (edgeAt[n] == edgeAt[m] && g.Edges[edgeAt[n]].s.Kind == SegKind.Line) continue;   // both ends of one line
                            pairs.Add((d, n, m));
                        }
        }
        var done = new HashSet<int>();
        foreach (var (d, a, b) in pairs.OrderBy(p => p.d))
        {
            if (done.Contains(a) || done.Contains(b)) continue;
            done.Add(a); done.Add(b);
            var mid = (g.Nodes[a] + g.Nodes[b]) * 0.5;
            int ia = edgeAt[a], ib = edgeAt[b];
            var sa = g.Edges[ia].s; var sb = g.Edges[ib].s;
            if (sa.Kind == SegKind.Line && sb.Kind == SegKind.Line)
            {
                // Both ends are lines: pull them together at the midpoint; node b folds into node a.
                g.Nodes[a] = mid;
                if (g.Edges[ia].a == a) sa.A = mid; else sa.B = mid;
                if (g.Edges[ib].a == b) sb.A = mid; else sb.B = mid;
                var eb = g.Edges[ib];
                if (eb.a == b) eb.a = a;
                if (eb.b == b) eb.b = a;
                g.Edges[ib] = eb;
            }
            else
            {
                // An arc end: moving it would change the radius, so a short line bridges the gap.
                var bridge = Seg.Line(g.Nodes[a], g.Nodes[b], (sa.Kind == SegKind.Line ? sb : sa).Group);
                bridge.Bridge = true;
                g.Edges.Add((bridge, a, b));
            }
            st.GapsClosed++;
            st.MaxGapClosed = Math.Max(st.MaxGapClosed, d);
            markers.Add(new Marker { Kind = "gap", At = mid, Size = d });
        }
        return g;
    }
}

// Nodes (joined piece ends) and edges (pieces between them). Circles are closed on their own.
public sealed class Graph
{
    public List<P> Nodes = new();
    public List<(Seg s, int a, int b)> Edges = new();
    public List<Seg> Circles = new();
}
```

<!-- file: _src/laser-engine/Engine/Chains.cs -->
```csharp
namespace AidedCam.Laser;

public sealed class Contour
{
    public int Id;
    public string Role;
    public bool Closed;
    public List<Seg> Segs = new();                 // consecutive: each piece's B is the next piece's A
    public double Length => Segs.Sum(s => s.Length);
    public int Part = -1;                          // part id, for closed cut contours
    public bool IsHole;
    public double Area;                            // |area| of a closed contour, mm²
}

public sealed class PartInfo
{
    public int Id;
    public int Outer;
    public List<int> Holes = new();
    public double Area, CutLength;
    public int Pierces;
    public P Min, Max;
}

// Step 5 of spec §5 (contours) and spec §6 (parts).
public static class Chains
{
    public static List<Contour> Build(Graph g, string role, List<Marker> markers, ref int branches)
    {
        var result = new List<Contour>();
        foreach (var c in g.Circles) result.Add(new Contour { Role = role, Closed = true, Segs = { c } });

        var incident = new List<int>[g.Nodes.Count];
        for (int i = 0; i < g.Nodes.Count; i++) incident[i] = new List<int>();
        for (int e = 0; e < g.Edges.Count; e++) { incident[g.Edges[e].a].Add(e); incident[g.Edges[e].b].Add(e); }
        var used = new bool[g.Edges.Count];

        for (int n = 0; n < g.Nodes.Count; n++)
        {
            int deg = incident[n].Count;
            if (deg == 1) markers.Add(new Marker { Kind = "open", At = g.Nodes[n] });
            if (deg >= 3) { markers.Add(new Marker { Kind = "branch", At = g.Nodes[n] }); branches++; }
        }

        // Open paths: walk from every node that is not a plain pass-through (degree != 2).
        for (int n = 0; n < g.Nodes.Count; n++)
        {
            if (incident[n].Count == 2) continue;
            foreach (int e0 in incident[n])
            {
                if (used[e0]) continue;
                var c = Walk(g, incident, used, n, e0, role);
                c.Closed = false;
                result.Add(c);
            }
        }
        // What is left are clean loops: every node on them has degree 2.
        for (int e0 = 0; e0 < g.Edges.Count; e0++)
        {
            if (used[e0]) continue;
            var c = Walk(g, incident, used, g.Edges[e0].a, e0, role);
            c.Closed = true;
            result.Add(c);
        }
        return result;
    }

    static Contour Walk(Graph g, List<int>[] incident, bool[] used, int start, int e0, string role)
    {
        var c = new Contour { Role = role };
        int node = start, e = e0;
        while (true)
        {
            used[e] = true;
            var (s, a, b) = g.Edges[e];
            var piece = a == node ? s : s.Reversed();
            c.Segs.Add(piece);
            node = a == node ? b : a;
            if (incident[node].Count != 2 || node == start) break;
            int next = incident[node][0] == e ? incident[node][1] : incident[node][0];
            if (used[next]) break;
            e = next;
        }
        return c;
    }

    // Closed contours that cross themselves; one marker per crossing found.
    public static int SelfIntersections(List<Contour> closed, List<Marker> markers)
    {
        int count = 0;
        foreach (var c in closed)
        {
            if (c.Segs.Count == 1 && c.Segs[0].Kind == SegKind.Circle) continue;
            var poly = new List<P>();
            foreach (var s in c.Segs) { var sp = s.Sample(0.05); for (int i = 0; i < sp.Count - 1; i++) poly.Add(sp[i]); }
            int n = poly.Count;
            if (n < 4) continue;
            // Bucket edges in a grid so only nearby edges are compared.
            double minX = poly.Min(p => p.X), minY = poly.Min(p => p.Y);
            double size = Math.Max(poly.Max(p => p.X) - minX, poly.Max(p => p.Y) - minY);
            double cell = Math.Max(size / Math.Sqrt(n), 1e-6);
            var grid = new Dictionary<(int, int), List<int>>();
            for (int i = 0; i < n; i++)
            {
                P a = poly[i], b = poly[(i + 1) % n];
                int x0 = (int)((Math.Min(a.X, b.X) - minX) / cell), x1 = (int)((Math.Max(a.X, b.X) - minX) / cell);
                int y0 = (int)((Math.Min(a.Y, b.Y) - minY) / cell), y1 = (int)((Math.Max(a.Y, b.Y) - minY) / cell);
                for (int x = x0; x <= x1; x++) for (int y = y0; y <= y1; y++)
                {
                    if (!grid.TryGetValue((x, y), out var l)) grid[(x, y)] = l = new List<int>();
                    l.Add(i);
                }
            }
            var seen = new HashSet<(int, int)>();
            bool found = false;
            foreach (var l in grid.Values)
            {
                for (int u = 0; u < l.Count && !found; u++)
                    for (int v = u + 1; v < l.Count && !found; v++)
                    {
                        int i = Math.Min(l[u], l[v]), j = Math.Max(l[u], l[v]);
                        if (j - i <= 1 || (i == 0 && j == n - 1) || !seen.Add((i, j))) continue;   // neighbours share a point
                        if (Cross(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n], out var at))
                        {
                            markers.Add(new Marker { Kind = "self", At = at });
                            count++; found = true;
                        }
                    }
                if (found) break;
            }
        }
        return count;
    }

    // Proper crossing of segments pq and rs (touching at an end point does not count).
    static bool Cross(P p, P q, P r, P s, out P at)
    {
        at = default;
        var d1 = q - p; var d2 = s - r;
        double den = P.Cross(d1, d2);
        if (Math.Abs(den) < 1e-12) return false;
        double t = P.Cross(r - p, d2) / den, u = P.Cross(r - p, d1) / den;
        if (t <= 1e-9 || t >= 1 - 1e-9 || u <= 1e-9 || u >= 1 - 1e-9) return false;
        at = p + d1 * t;
        return true;
    }

    // Spec §6: closed cut contours nested by containment. Even depth = part, odd depth = hole of its parent.
    public static List<PartInfo> Parts(List<Contour> closedCut)
    {
        foreach (var c in closedCut) c.Area = Math.Abs(Geo.SignedArea(c.Segs));
        var order = closedCut.OrderByDescending(c => c.Area).ToList();
        int n = order.Count;
        var boxes = new (P Min, P Max)[n];
        var polys = new List<P>[n];
        for (int i = 0; i < n; i++) boxes[i] = Bounds(order[i]);

        // Each box is listed in the grid cells it covers, so a probe only meets the contours whose box covers its
        // cell: a sheet with thousands of holes stays near-linear instead of comparing every pair.
        double gx0 = double.MaxValue, gy0 = double.MaxValue, gx1 = double.MinValue, gy1 = double.MinValue;
        foreach (var (mn, mx) in boxes) { gx0 = Math.Min(gx0, mn.X); gy0 = Math.Min(gy0, mn.Y); gx1 = Math.Max(gx1, mx.X); gy1 = Math.Max(gy1, mx.Y); }
        int side = Math.Max(1, (int)Math.Sqrt(n));
        double cw = Math.Max((gx1 - gx0) / side, 1e-9), ch = Math.Max((gy1 - gy0) / side, 1e-9);
        int Cx(double x) => Math.Clamp((int)((x - gx0) / cw), 0, side - 1);
        int Cy(double y) => Math.Clamp((int)((y - gy0) / ch), 0, side - 1);
        var grid = new List<int>[side * side];
        for (int j = 0; j < n; j++)                     // ascending j: every cell list stays sorted
            for (int x = Cx(boxes[j].Min.X); x <= Cx(boxes[j].Max.X); x++)
                for (int y = Cy(boxes[j].Min.Y); y <= Cy(boxes[j].Max.Y); y++)
                    (grid[y * side + x] ??= new List<int>()).Add(j);

        var parent = new int[n];
        var depth = new int[n];
        for (int i = 0; i < n; i++)
        {
            var c = order[i];
            var probe = c.Segs[0].PointAt(0.5);
            int best = -1;
            var cell = grid[Cy(probe.Y) * side + Cx(probe.X)];
            for (int k = cell.Count - 1; k >= 0; k--)   // smallest containing contour first
            {
                int j = cell[k];
                if (j >= i) continue;
                var (mn, mx) = boxes[j];
                if (probe.X < mn.X || probe.X > mx.X || probe.Y < mn.Y || probe.Y > mx.Y) continue;
                if (order[j].Area > c.Area && Geo.Inside(probe, polys[j] ??= Geo.Polygon(order[j].Segs))) { best = j; break; }
            }
            parent[i] = best;
            depth[i] = best < 0 ? 0 : depth[best] + 1;
        }
        var parts = new List<PartInfo>();
        var partOf = new PartInfo[n];
        for (int i = 0; i < n; i++)
        {
            if (depth[i] % 2 != 0) continue;
            var c = order[i];
            var p = new PartInfo { Id = parts.Count, Outer = c.Id, Min = boxes[i].Min, Max = boxes[i].Max, Area = c.Area, CutLength = c.Length, Pierces = 1 };
            c.Part = p.Id;
            parts.Add(p); partOf[i] = p;
        }
        for (int i = 0; i < n; i++)
        {
            if (depth[i] % 2 != 1) continue;
            var c = order[i];
            var p = partOf[parent[i]];
            c.Part = p.Id; c.IsHole = true;
            p.Holes.Add(c.Id); p.Area -= c.Area; p.CutLength += c.Length; p.Pierces++;
        }
        return parts;
    }

    public static (P, P) Bounds(Contour c)
    {
        double x0 = double.MaxValue, y0 = double.MaxValue, x1 = double.MinValue, y1 = double.MinValue;
        foreach (var s in c.Segs)
        {
            var (mn, mx) = s.Bounds();
            x0 = Math.Min(x0, mn.X); y0 = Math.Min(y0, mn.Y); x1 = Math.Max(x1, mx.X); y1 = Math.Max(y1, mx.Y);
        }
        return (new P(x0, y0), new P(x1, y1));
    }
}
```

Run: `for f in Repair Chains; do node _tests/extract.mjs <brief> _src/laser-engine/Engine/$f.cs; done`

- [ ] **Step 4: Run the tests**

Run: `dotnet test _src/laser-engine/Tests 2>&1 | tail -1`
Expected: `Passed: 23`, `Failed: 0`.

- [ ] **Step 5: Commit**

```bash
git add _src/laser-engine
git commit -F - <<'EOF'
Laser DXF check: repair (tiny, duplicates, overlaps, joins, gaps) and contours

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 4: Parts, checks, the result JSON and the R12 writer

**Files:**
- Create: `_src/laser-engine/Engine/DxfR12.cs`, `_src/laser-engine/Engine/Processor.cs`, `_src/laser-engine/Engine/ResultJson.cs`
- Create: `_src/laser-engine/Tests/PartsTests.cs`, `_src/laser-engine/Tests/ProcessorTests.cs`

**Interfaces:**
- Consumes: everything from Tasks 1–3.
- Produces:
  - `Check { Id, Severity, Params }`.
  - `Result`:
    - `Drawing`, `Contours`, `Parts`, `Markers`, `Stats`, `Checks`;
    - `OpenCutLength`, `OpenPierces`, `MarkLength`, `MarkStarts`, `CurvesIn`, `Dxf`.
  - `Processor.Process(byte[] bytes, Settings s) → Result`. It throws `LaserFileException` for unreadable files and files over a limit.
  - `DxfR12.Write(IEnumerable<Contour>, IEnumerable<TextItem>) → byte[]` (R12, Windows-1253).
  - `ResultJson.Write(string name, Result) → string` and `ResultJson.Error(string name, string reason, string message) → string`, both following spec §3, plus the `C` segment.
  - The check ids and their order, which Task 10's strings test reads from this file: `Add("<id>"`.

- [ ] **Step 1: Write the failing tests**

<!-- file: _src/laser-engine/Tests/PartsTests.cs -->
```csharp
using Xunit;

namespace AidedCam.Laser.Tests;

public class PartsTests
{
    static Result Run(Dxf d, Settings s = null) => Processor.Process(d.Bytes(), s ?? new Settings());

    [Fact]
    public void A_plate_with_four_holes_is_one_part_with_exact_numbers()
    {
        var r = Run(new Dxf().Rect(0, 0, 100, 50).Circle(10, 10, 5).Circle(90, 10, 5).Circle(10, 40, 5).Circle(90, 40, 5));
        var p = Assert.Single(r.Parts);
        Assert.Equal(4, p.Holes.Count);
        Assert.Equal(5000 - 4 * Math.PI * 25, p.Area, 6);
        Assert.Equal(300 + 4 * Math.PI * 10, p.CutLength, 6);
        Assert.Equal(5, p.Pierces);
        Assert.Equal(100, p.Max.X - p.Min.X, 9);
        Assert.Equal(50, p.Max.Y - p.Min.Y, 9);
    }

    [Fact]
    public void A_piece_inside_a_hole_is_its_own_part()
    {
        var r = Run(new Dxf().Rect(0, 0, 100, 100).Rect(20, 20, 60, 60).Rect(40, 40, 20, 20));
        Assert.Equal(2, r.Parts.Count);
        Assert.Equal(10000 - 3600, r.Parts[0].Area, 6);
        Assert.Equal(400, r.Parts[1].Area, 6);
        Assert.Contains(r.Checks, c => c.Id == "multi-part" && (int)c.Params["count"] == 2);
    }

    [Fact]
    public void Three_ends_at_one_point_are_a_branch_and_a_bow_tie_crosses_itself()
    {
        // A plate split by a middle line: the outline pieces meet the middle line end to end at (50,0) and (50,50).
        var branch = Run(new Dxf().Line(0, 0, 50, 0).Line(50, 0, 100, 0).Line(100, 0, 100, 50).Line(100, 50, 50, 50).Line(50, 50, 0, 50).Line(0, 50, 0, 0).Line(50, 0, 50, 50));
        Assert.Contains(branch.Checks, c => c.Id == "branch" && (int)c.Params["count"] == 2);
        Assert.Contains(branch.Markers, m => m.Kind == "branch");
        var bowTie = Run(new Dxf().Polyline(true, "0", (0, 0, 0), (100, 50, 0), (100, 0, 0), (0, 50, 0)));
        Assert.Contains(bowTie.Checks, c => c.Id == "self-intersect");
        var m = Assert.Single(bowTie.Markers, m => m.Kind == "self");
        Assert.Equal(50, m.At.X, 6); Assert.Equal(25, m.At.Y, 6);
    }

    [Fact]
    public void A_sheet_with_twenty_thousand_holes_nests_in_near_linear_time()
    {
        // A pairwise scan takes seconds here on the desktop and about 20 times longer in the browser.
        static Seg L(double x1, double y1, double x2, double y2) => Seg.Line(new P(x1, y1), new P(x2, y2), 0);
        var all = new List<Contour> { new() { Closed = true, Segs = { L(0, 0, 2000, 0), L(2000, 0, 2000, 1000), L(2000, 1000, 0, 1000), L(0, 1000, 0, 0) } } };
        for (int i = 0; i < 200; i++)
            for (int j = 0; j < 100; j++) all.Add(new Contour { Closed = true, Segs = { Seg.Circle(new P(5 + 10 * i, 5 + 10 * j), 3, 0) } });
        for (int k = 0; k < all.Count; k++) all[k].Id = k;
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var p = Assert.Single(Chains.Parts(all));
        sw.Stop();
        Assert.Equal(20000, p.Holes.Count);
        Assert.Equal(2e6 - 20000 * Math.PI * 9, p.Area, 3);
        Assert.True(sw.ElapsedMilliseconds < 1000, $"{sw.ElapsedMilliseconds} ms");
    }
}
```

<!-- file: _src/laser-engine/Tests/ProcessorTests.cs -->
```csharp
using System.Text.Json;
using devDept.Eyeshot.Entities;
using devDept.Eyeshot.Translators;
using Xunit;

namespace AidedCam.Laser.Tests;

public class ProcessorTests
{
    static Result Run(Dxf d, Settings s = null) => Processor.Process(d.Bytes(), s ?? new Settings());
    static List<string> Ids(Result r) => r.Checks.Select(c => c.Id).ToList();

    [Fact]
    public void Roles_split_cut_mark_bend_and_ignore()
    {
        var r = Run(new Dxf().Layer("MARK", 5).Layer("BEND", 30, "DASHED").Layer("DIM")
            .Rect(0, 0, 100, 50).Line(10, 10, 40, 10, "MARK").Line(50, 0, 50, 50, "BEND").Line(0, -10, 100, -10, "DIM"));
        Assert.Single(r.Parts);
        Assert.Equal(30, r.MarkLength, 9);
        Assert.Equal(1, r.MarkStarts);
        Assert.Single(r.Contours, c => c.Role == Roles.Bend);
        Assert.Single(r.Contours, c => c.Role == Roles.Ignore);
        Assert.DoesNotContain("branch", Ids(r));               // the bend line touches the outline but is not cut
    }

    [Fact]
    public void A_role_change_from_the_table_is_applied()
    {
        var bytes = new Dxf().Layer("NOTES").Rect(0, 0, 10, 10).Rect(20, 0, 10, 10, "NOTES").Bytes();
        Assert.Equal(2, Processor.Process(bytes, new Settings()).Parts.Count);
        var s = new Settings(); s.Roles["NOTES|#ffffff"] = Roles.Ignore;
        Assert.Single(Processor.Process(bytes, s).Parts);
    }

    [Fact]
    public void Checks_report_what_happened()
    {
        var r = Run(new Dxf().Layer("CUT2", 7, "DASHED")
            .Rect(0, 0, 100, 50).Line(0, 0, 100, 0)                   // a doubled edge
            .Line(200, 0, 300, 0)                                     // an open path
            .Line(0, 60, 40, 60, "CUT2").Line(40, 60, 40, 60.0005)    // dashed layer; a tiny piece
            .Text(0, 80, 5, "PART 1"));
        var ids = Ids(r);
        Assert.Equal("open-path", ids[0]);                            // errors first
        Assert.Contains("dashed-on-cut", ids);
        Assert.Contains("units-assumed", ids);
        Assert.Contains("duplicates-removed", ids);
        Assert.Contains("tiny-removed", ids);
        Assert.Contains("text-kept", ids);
        var open = r.Checks.First(c => c.Id == "open-path");
        Assert.Equal(2, (int)open.Params["count"]);                   // the lone line and the dashed stroke
        Assert.Equal(140, (double)open.Params["length"], 6);
        Assert.Equal(2, r.OpenPierces);
    }

    [Fact]
    public void An_empty_block_is_an_error_that_names_it()
    {
        var r = Run(new Dxf().Rect(0, 0, 100, 50).Block("HOLE", b => b.Circle(0, 0, 3)).Insert("HOLE", 40, 10));
        var c = Assert.Single(r.Checks, c => c.Id == "block-empty");
        Assert.Equal("error", c.Severity);
        Assert.Equal("HOLE", c.Params["blocks"]);
    }

    [Fact]
    public void An_array_inside_a_block_is_an_error_that_names_the_block()
    {
        var doc = new ACadSharp.CadDocument(ACadSharp.ACadVersion.AC1018);
        var hole = new ACadSharp.Tables.BlockRecord("HOLE");
        hole.Entities.Add(new ACadSharp.Entities.Circle { Center = new CSMath.XYZ(0, 0, 0), Radius = 3 });
        doc.BlockRecords.Add(hole);
        var grid = new ACadSharp.Tables.BlockRecord("GRID");
        grid.Entities.Add(new ACadSharp.Entities.Insert(hole) { ColumnCount = 4, ColumnSpacing = 10 });
        doc.BlockRecords.Add(grid);
        doc.Entities.Add(new ACadSharp.Entities.Insert(grid) { InsertPoint = new CSMath.XYZ(5, 5, 0) });
        var c = Assert.Single(Processor.Process(AcadFile.Write(doc, false), new Settings()).Checks, c => c.Id == "block-array");
        Assert.Equal("error", c.Severity);
        Assert.Equal("GRID", c.Params["blocks"]);
    }

    [Fact]
    public void A_file_with_nothing_to_cut_says_so()
    {
        var r = Run(new Dxf().Layer("MARK").Line(0, 0, 10, 0, "MARK"));
        Assert.Contains("empty-cut", Ids(r));
        Assert.Empty(r.Parts);
    }

    [Fact]
    public void The_json_result_follows_the_contract()
    {
        var r = Run(new Dxf().Rect(0, 0, 100, 50).Circle(20, 25, 5).Polyline(true, "0", (60, 20, 0), (80, 20, 1), (80, 30, 0), (60, 30, 1)));
        using var doc = JsonDocument.Parse(ResultJson.Write("plate.dxf", r));
        var root = doc.RootElement;
        Assert.Equal("result", root.GetProperty("type").GetString());
        Assert.Equal("plate.dxf", root.GetProperty("file").GetProperty("name").GetString());
        Assert.Equal(1, root.GetProperty("parts").GetArrayLength());
        var part = root.GetProperty("parts")[0];
        Assert.Equal(2, part.GetProperty("holes").GetArrayLength());
        Assert.Equal(3, part.GetProperty("pierces").GetInt32());
        var kinds = root.GetProperty("contours").EnumerateArray().SelectMany(c => c.GetProperty("segs").EnumerateArray()).Select(s => s.GetProperty("t").GetString()).ToHashSet();
        Assert.Equal(new HashSet<string> { "L", "A", "C" }, kinds);
        Assert.Equal("units-assumed", root.GetProperty("checks")[0].GetProperty("id").GetString());
        using var err = JsonDocument.Parse(ResultJson.Error("x.dwg", "version", "too new"));
        Assert.Equal("error", err.RootElement.GetProperty("type").GetString());
    }

    [Fact]
    public void The_repaired_dxf_reads_back_with_the_same_geometry_and_greek_text()
    {
        var r = Run(new Dxf().CodePage("ANSI_1253").Layer("MARK", 5)
            .Rect(0, 0, 100, 50).Circle(20, 25, 5).Polyline(true, "0", (60, 20, 0), (80, 20, 1), (80, 30, 0), (60, 30, 1))
            .Line(10, 45, 40, 45, "MARK").Text(5, 5, 3, "ΑΒΓ-1"));
        var text = System.Text.Encoding.Latin1.GetString(r.Dxf);
        Assert.Contains("AC1009", text);
        var rd = new ReadDXF(new MemoryStream(r.Dxf));
        rd.DoWork(null, CancellationToken.None);
        Assert.True(rd.Result);
        Assert.Equal(new[] { "CUT", "MARK", "TEXT" }, rd.Entities.Select(e => e.LayerName).Distinct().OrderBy(x => x).ToArray());
        Assert.Equal("ΑΒΓ-1", rd.Entities.OfType<Text>().Single().TextString);
        var back = Processor.Process(r.Dxf, new Settings());
        Assert.Equal(r.Parts[0].Area, back.Parts[0].Area, 6);
        Assert.Equal(r.Parts[0].CutLength, back.Parts[0].CutLength, 6);
        Assert.Equal(r.MarkLength, back.MarkLength, 6);
    }
}
```

Run: `for f in PartsTests ProcessorTests; do node _tests/extract.mjs <brief> _src/laser-engine/Tests/$f.cs; done`

- [ ] **Step 2: Run them and see them fail**

Run: `dotnet test _src/laser-engine/Tests 2>&1 | grep -m1 -E "error CS"`
Expected: `error CS0246: The type or namespace name 'Result' could not be found`, or `CS0103` naming `Processor`.

- [ ] **Step 3: Write the writer, the pipeline and the JSON**

<!-- file: _src/laser-engine/Engine/DxfR12.cs -->
```csharp
using System.Globalization;
using System.Text;

namespace AidedCam.Laser;

// The repaired file (spec §10): AutoCAD R12 DXF, which every laser CAM reads.
// Each contour is one POLYLINE with bulge arcs (a lone circle stays a CIRCLE); text is TEXT on its own layer.
public static class DxfR12
{
    static readonly (string Name, int Aci, string LineType)[] Layers =
    {
        ("0", 7, "CONTINUOUS"), ("CUT", 7, "CONTINUOUS"), ("MARK", 5, "CONTINUOUS"), ("BEND", 30, "DASHED"), ("TEXT", 8, "CONTINUOUS"),
    };

    public static byte[] Write(IEnumerable<Contour> contours, IEnumerable<TextItem> texts)
    {
        var sb = new StringBuilder();
        void G(int code, string v) { sb.Append(code.ToString(CultureInfo.InvariantCulture).PadLeft(3)).Append("\r\n").Append(v).Append("\r\n"); }
        void N(int code, double v) => G(code, v.ToString("0.0#########", CultureInfo.InvariantCulture));

        var list = contours.Where(c => c.Role != Roles.Ignore && c.Segs.Count > 0).ToList();
        var textList = texts.ToList();
        double x0 = 0, y0 = 0, x1 = 0, y1 = 0; bool any = false;
        foreach (var c in list)
        {
            var (mn, mx) = Chains.Bounds(c);
            if (!any) { x0 = mn.X; y0 = mn.Y; x1 = mx.X; y1 = mx.Y; any = true; }
            else { x0 = Math.Min(x0, mn.X); y0 = Math.Min(y0, mn.Y); x1 = Math.Max(x1, mx.X); y1 = Math.Max(y1, mx.Y); }
        }

        G(0, "SECTION"); G(2, "HEADER");
        G(9, "$ACADVER"); G(1, "AC1009");
        G(9, "$DWGCODEPAGE"); G(3, "ANSI_1253");
        G(9, "$EXTMIN"); N(10, x0); N(20, y0); N(30, 0);
        G(9, "$EXTMAX"); N(10, x1); N(20, y1); N(30, 0);
        G(0, "ENDSEC");

        G(0, "SECTION"); G(2, "TABLES");
        G(0, "TABLE"); G(2, "LTYPE"); G(70, "2");
        G(0, "LTYPE"); G(2, "CONTINUOUS"); G(70, "0"); G(3, "Solid line"); G(72, "65"); G(73, "0"); N(40, 0);
        G(0, "LTYPE"); G(2, "DASHED"); G(70, "0"); G(3, "__ __ __"); G(72, "65"); G(73, "2"); N(40, 9); N(49, 6); N(49, -3);
        G(0, "ENDTAB");
        G(0, "TABLE"); G(2, "LAYER"); G(70, Layers.Length.ToString(CultureInfo.InvariantCulture));
        foreach (var (name, aci, lt) in Layers) { G(0, "LAYER"); G(2, name); G(70, "0"); G(62, aci.ToString(CultureInfo.InvariantCulture)); G(6, lt); }
        G(0, "ENDTAB");
        G(0, "ENDSEC");

        G(0, "SECTION"); G(2, "ENTITIES");
        foreach (var c in list)
        {
            string layer = c.Role == Roles.Mark ? "MARK" : c.Role == Roles.Bend ? "BEND" : "CUT";
            if (c.Segs.Count == 1 && c.Segs[0].Kind == SegKind.Circle)
            {
                var ci = c.Segs[0];
                G(0, "CIRCLE"); G(8, layer); N(10, ci.C.X); N(20, ci.C.Y); N(30, 0); N(40, ci.R);
                continue;
            }
            G(0, "POLYLINE"); G(8, layer); G(66, "1"); N(10, 0); N(20, 0); N(30, 0); G(70, c.Closed ? "1" : "0");
            foreach (var s in c.Segs)
            {
                G(0, "VERTEX"); G(8, layer); N(10, s.A.X); N(20, s.A.Y); N(30, 0);
                if (s.Kind == SegKind.Arc) N(42, s.Bulge);
            }
            if (!c.Closed)
            {
                var last = c.Segs[^1];
                G(0, "VERTEX"); G(8, layer); N(10, last.B.X); N(20, last.B.Y); N(30, 0);
            }
            G(0, "SEQEND"); G(8, layer);
        }
        foreach (var t in textList)
        {
            G(0, "TEXT"); G(8, "TEXT"); N(10, t.At.X); N(20, t.At.Y); N(30, 0); N(40, t.Height > 0 ? t.Height : 2.5);
            G(1, t.Value.Replace("\r", " ").Replace("\n", " "));
            if (Math.Abs(t.Rotation) > 1e-9) N(50, t.Rotation);
        }
        G(0, "ENDSEC");
        G(0, "EOF");

        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        var enc = Encoding.GetEncoding(1253, EncoderFallback.ReplacementFallback, DecoderFallback.ReplacementFallback);
        return enc.GetBytes(sb.ToString());
    }
}
```

<!-- file: _src/laser-engine/Engine/Processor.cs -->
```csharp
namespace AidedCam.Laser;

public sealed class Check
{
    public string Id, Severity;
    public Dictionary<string, object> Params = new();
}

public sealed class Result
{
    public Drawing Drawing;
    public List<Contour> Contours = new();
    public List<PartInfo> Parts = new();
    public List<Marker> Markers = new();
    public RepairStats Stats = new();
    public List<Check> Checks = new();
    public double OpenCutLength, MarkLength;
    public int OpenPierces, MarkStarts, CurvesIn;
    public byte[] Dxf;
}

// The whole pipeline for one file: read, repair per role, chain, parts, checks, repaired DXF.
public static class Processor
{
    public static Result Process(byte[] bytes, Settings s)
    {
        var d = Reader.Read(bytes, s);
        var r = new Result { Drawing = d, CurvesIn = d.Segs.Count };
        List<Seg> OfRole(string role) => d.Segs.Where(x => d.Groups[x.Group].Role == role).ToList();

        // Cut: every repair step, then contours and parts.
        var cutIn = OfRole(Roles.Cut);
        int branches = 0;
        var cutSegs = Repair.MergeOverlaps(Repair.RemoveTiny(cutIn, r.Stats), s.JoinTol, r.Stats);
        var cutGraph = Repair.Join(cutSegs, s.JoinTol, s.GapTol, r.Stats, r.Markers);
        var cut = Chains.Build(cutGraph, Roles.Cut, r.Markers, ref branches);

        // Mark: the same repair, so doubled engraving is not run twice; its markers are not reported.
        var scratch = new List<Marker>();
        int markBranches = 0;
        var markSegs = Repair.MergeOverlaps(Repair.RemoveTiny(OfRole(Roles.Mark), r.Stats), s.JoinTol, r.Stats);
        var mark = Chains.Build(Repair.Join(markSegs, s.JoinTol, 0, r.Stats, scratch), Roles.Mark, scratch, ref markBranches);

        // Bend lines are kept as they are (duplicates removed); ignored geometry is only drawn.
        var bend = Repair.MergeOverlaps(Repair.RemoveTiny(OfRole(Roles.Bend), r.Stats), s.JoinTol, r.Stats)
            .Select(x => new Contour { Role = Roles.Bend, Closed = x.Kind == SegKind.Circle, Segs = { x } });
        var ignore = OfRole(Roles.Ignore).Select(x => new Contour { Role = Roles.Ignore, Closed = x.Kind == SegKind.Circle, Segs = { x } });

        r.Contours.AddRange(cut); r.Contours.AddRange(mark); r.Contours.AddRange(bend); r.Contours.AddRange(ignore);
        for (int i = 0; i < r.Contours.Count; i++) r.Contours[i].Id = i;

        var closedCut = cut.Where(c => c.Closed).ToList();
        int selfX = Chains.SelfIntersections(closedCut, r.Markers);
        r.Parts = Chains.Parts(closedCut);
        var openCut = cut.Where(c => !c.Closed).ToList();
        r.OpenCutLength = openCut.Sum(c => c.Length);
        r.OpenPierces = openCut.Count;
        r.MarkLength = mark.Sum(c => c.Length);
        r.MarkStarts = mark.Count;

        // Checks (spec §9), most serious first.
        void Add(string id, string severity, params (string k, object v)[] ps)
        {
            var c = new Check { Id = id, Severity = severity };
            foreach (var (k, v) in ps) c.Params[k] = v;
            r.Checks.Add(c);
        }
        if (d.EmptyBlocks.Count > 0) Add("block-empty", "error", ("blocks", string.Join(", ", d.EmptyBlocks)));
        if (d.NestedArrays.Count > 0) Add("block-array", "error", ("blocks", string.Join(", ", d.NestedArrays)));
        if (cutIn.Count == 0) Add("empty-cut", "error");
        if (openCut.Count > 0) Add("open-path", "error", ("count", openCut.Count), ("length", Math.Round(r.OpenCutLength, 2)));
        if (branches > 0) Add("branch", "warn", ("count", branches));
        if (selfX > 0) Add("self-intersect", "warn", ("count", selfX));
        var dashed = d.Groups.Where(g => g.Role == Roles.Cut && Roles.IsDashed(g.LineType)).Select(g => g.Layer).Distinct().ToList();
        if (dashed.Count > 0) Add("dashed-on-cut", "warn", ("layers", string.Join(", ", dashed)));
        if (d.NotFlat) Add("not-flat", "warn");
        if (d.UnitsSource == "assumed") Add("units-assumed", "warn");
        if (d.UnitsSource == "file" && d.Units == "inch") Add("units-inch", "info");
        if (r.Stats.GapsClosed > 0) Add("gaps-closed", "info", ("count", r.Stats.GapsClosed), ("max", Math.Round(r.Stats.MaxGapClosed, 3)));
        if (r.Stats.DuplicatesRemoved > 0) Add("duplicates-removed", "info", ("count", r.Stats.DuplicatesRemoved), ("length", Math.Round(r.Stats.DuplicateLength, 2)));
        if (r.Stats.TinyRemoved > 0) Add("tiny-removed", "info", ("count", r.Stats.TinyRemoved));
        if (d.Texts.Count > 0) Add("text-kept", "info", ("count", d.Texts.Count));
        if (d.Ignored.Values.Sum() > 0)
            Add("ignored-entities", "info", ("hatch", d.Ignored["hatch"]), ("dim", d.Ignored["dim"]), ("leader", d.Ignored["leader"]), ("point", d.Ignored["point"]), ("other", d.Ignored["other"]));
        if (r.Parts.Count > 1) Add("multi-part", "info", ("count", r.Parts.Count));

        r.Dxf = DxfR12.Write(r.Contours, d.Texts);
        return r;
    }
}
```

<!-- file: _src/laser-engine/Engine/ResultJson.cs -->
```csharp
using System.Text.Json;

namespace AidedCam.Laser;

// The result as JSON for the page (spec §3 contract). Written by hand with Utf8JsonWriter:
// reflection-based serialization is disabled in a trimmed WebAssembly build.
public static class ResultJson
{
    static double R4(double v) => Math.Round(v, 4);

    public static string Write(string name, Result r)
    {
        var ms = new MemoryStream();
        using (var w = new Utf8JsonWriter(ms, new JsonWriterOptions { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping }))
        {
            var d = r.Drawing;
            w.WriteStartObject();
            w.WriteString("type", "result");
            w.WriteStartObject("file");
            w.WriteString("name", name); w.WriteString("format", d.Format); w.WriteString("version", d.Version);
            w.WriteString("units", d.Units); w.WriteString("unitsSource", d.UnitsSource);
            w.WriteEndObject();

            w.WriteStartArray("groups");
            foreach (var g in d.Groups)
            {
                w.WriteStartObject();
                w.WriteString("key", g.Key); w.WriteString("layer", g.Layer); w.WriteString("color", g.Color);
                w.WriteString("linetype", g.LineType); w.WriteString("role", g.Role); w.WriteString("defaultRole", g.DefaultRole);
                w.WriteNumber("curves", g.Curves);
                w.WriteEndObject();
            }
            w.WriteEndArray();

            w.WriteStartArray("parts");
            foreach (var p in r.Parts)
            {
                w.WriteStartObject();
                w.WriteNumber("id", p.Id); w.WriteNumber("outer", p.Outer);
                w.WriteStartArray("holes"); foreach (var h in p.Holes) w.WriteNumberValue(h); w.WriteEndArray();
                w.WriteNumber("area", R4(p.Area));
                w.WriteStartObject("bbox"); w.WriteNumber("w", R4(p.Max.X - p.Min.X)); w.WriteNumber("h", R4(p.Max.Y - p.Min.Y)); w.WriteEndObject();
                w.WriteNumber("cutLength", R4(p.CutLength)); w.WriteNumber("pierces", p.Pierces);
                w.WriteEndObject();
            }
            w.WriteEndArray();

            w.WriteStartObject("extras");
            w.WriteNumber("openCutLength", R4(r.OpenCutLength)); w.WriteNumber("openPierces", r.OpenPierces);
            w.WriteNumber("markLength", R4(r.MarkLength)); w.WriteNumber("markStarts", r.MarkStarts);
            w.WriteEndObject();

            w.WriteStartArray("contours");
            foreach (var c in r.Contours)
            {
                w.WriteStartObject();
                w.WriteNumber("id", c.Id); w.WriteString("role", c.Role); w.WriteBoolean("closed", c.Closed);
                w.WriteNumber("length", R4(c.Length));
                if (c.Part >= 0) w.WriteNumber("part", c.Part); else w.WriteNull("part");
                w.WriteBoolean("isHole", c.IsHole);
                w.WriteStartArray("segs");
                foreach (var s in c.Segs)
                {
                    w.WriteStartObject();
                    if (s.Kind == SegKind.Line)
                    {
                        w.WriteString("t", "L");
                        w.WriteNumber("x1", R4(s.A.X)); w.WriteNumber("y1", R4(s.A.Y)); w.WriteNumber("x2", R4(s.B.X)); w.WriteNumber("y2", R4(s.B.Y));
                    }
                    else if (s.Kind == SegKind.Circle)
                    {
                        w.WriteString("t", "C"); w.WriteNumber("cx", R4(s.C.X)); w.WriteNumber("cy", R4(s.C.Y)); w.WriteNumber("r", R4(s.R));
                    }
                    else
                    {
                        w.WriteString("t", "A"); w.WriteNumber("cx", R4(s.C.X)); w.WriteNumber("cy", R4(s.C.Y)); w.WriteNumber("r", R4(s.R));
                        w.WriteNumber("a0", R4(s.StartAngle * 180 / Math.PI)); w.WriteNumber("a1", R4(s.EndAngle * 180 / Math.PI));
                        w.WriteBoolean("ccw", s.Ccw);
                    }
                    w.WriteEndObject();
                }
                w.WriteEndArray();
                w.WriteEndObject();
            }
            w.WriteEndArray();

            w.WriteStartArray("texts");
            foreach (var t in d.Texts)
            {
                w.WriteStartObject();
                w.WriteNumber("x", R4(t.At.X)); w.WriteNumber("y", R4(t.At.Y)); w.WriteNumber("h", R4(t.Height));
                w.WriteNumber("rot", R4(t.Rotation)); w.WriteString("value", t.Value);
                w.WriteEndObject();
            }
            w.WriteEndArray();

            w.WriteStartArray("markers");
            foreach (var m in r.Markers)
            {
                w.WriteStartObject();
                w.WriteString("kind", m.Kind); w.WriteNumber("x", R4(m.At.X)); w.WriteNumber("y", R4(m.At.Y));
                if (m.Size > 0) w.WriteNumber("size", R4(m.Size));
                w.WriteEndObject();
            }
            w.WriteEndArray();

            w.WriteStartArray("checks");
            foreach (var c in r.Checks)
            {
                w.WriteStartObject();
                w.WriteString("id", c.Id); w.WriteString("severity", c.Severity);
                w.WriteStartObject("params");
                foreach (var (k, v) in c.Params)
                {
                    switch (v)
                    {
                        case int i: w.WriteNumber(k, i); break;
                        case double x: w.WriteNumber(k, x); break;
                        default: w.WriteString(k, v?.ToString() ?? ""); break;
                    }
                }
                w.WriteEndObject();
                w.WriteEndObject();
            }
            w.WriteEndArray();

            w.WriteStartObject("stats");
            w.WriteNumber("curvesIn", r.CurvesIn); w.WriteNumber("tinyRemoved", r.Stats.TinyRemoved);
            w.WriteNumber("duplicatesRemoved", r.Stats.DuplicatesRemoved); w.WriteNumber("overlapsMerged", r.Stats.OverlapsMerged);
            w.WriteNumber("gapsClosed", r.Stats.GapsClosed); w.WriteNumber("maxGapClosed", R4(r.Stats.MaxGapClosed));
            w.WriteStartObject("ignored");
            foreach (var (k, v) in d.Ignored) w.WriteNumber(k, v);
            w.WriteEndObject();
            w.WriteEndObject();

            w.WriteEndObject();
        }
        return System.Text.Encoding.UTF8.GetString(ms.ToArray());
    }

    public static string Error(string name, string reason, string message)
    {
        var ms = new MemoryStream();
        using (var w = new Utf8JsonWriter(ms))
        {
            w.WriteStartObject();
            w.WriteString("type", "error"); w.WriteString("name", name); w.WriteString("reason", reason); w.WriteString("message", message);
            w.WriteEndObject();
        }
        return System.Text.Encoding.UTF8.GetString(ms.ToArray());
    }
}
```

Run: `for f in DxfR12 Processor ResultJson; do node _tests/extract.mjs <brief> _src/laser-engine/Engine/$f.cs; done`

- [ ] **Step 4: Run the tests**

Run: `dotnet test _src/laser-engine/Tests 2>&1 | tail -1`
Expected: `Passed: 35`, `Failed: 0`.

The nesting test has a 1,000 ms bound. It takes about 40 ms with the grid, and about 3 s with a pairwise scan. If it fails on time alone, run it again with nothing else busy before touching the code.

- [ ] **Step 5: Commit**

```bash
git add _src/laser-engine
git commit -F - <<'EOF'
Laser DXF check: parts, checks, JSON contract and R12 output

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 5: Golden fixtures for desktop–browser parity

**Files:**
- Create: `_src/laser-engine/Tests/Fixtures.cs`, `_src/laser-engine/Tests/ParityTests.cs`
- Generate: `_tests/laser/fixtures/` (11 DXF/DWG files and `expected.json`)

**Interfaces:**
- Consumes: `Processor.Process` (Task 4).
- Produces:
  - `Fixtures.SameResult(byte[] a, byte[] b)` and `Fixtures.WriteChanged(string dir, Dictionary<string, byte[]> files)`, which Task 7 reuses for the examples.
  - `_tests/laser/fixtures/expected.json`, which maps each fixture name to `Fixtures.Summary(result)`:
    - `parts: [{ area, cutLength, pierces, holes }]`, sorted by area, largest first;
    - `checks`, `openCutLength`, `markLength`, `contours`, `texts`.
    - Numbers are rounded to 0.001.
  - Task 6's `parity.html` compares the browser engine against it.

- [ ] **Step 1: Write the failing tests**

<!-- file: _src/laser-engine/Tests/Fixtures.cs -->
```csharp
using System.Globalization;
using System.Text;
using System.Text.Json;
using ACadSharp;
using CSMath;

namespace AidedCam.Laser.Tests;

// Synthetic files that the browser engine must read exactly as the desktop engine does (spec §13).
// They are committed to _tests/laser/fixtures/ with the desktop results in expected.json, and
// _tests/laser/parity.html runs them through the published engine and compares.
public static class Fixtures
{
    public static Dictionary<string, byte[]> All()
    {
        var f = new Dictionary<string, byte[]>
        {
            ["plate-holes.dxf"] = new Dxf().Rect(0, 0, 100, 50).Circle(10, 10, 5).Circle(90, 10, 5).Circle(10, 40, 5).Circle(90, 40, 5).Bytes(),
            ["gaps.dxf"] = new Dxf().Line(0, 0, 100, 0).Line(100, 0, 100, 50).Line(100, 50, 0, 50).Line(0, 50, 0, 0.15)
                .Arc(50, 25, 10, 0, 180).Line(40, 25, 59.9, 25).Circle(20, 25, 5).Bytes(),
            ["nested.dxf"] = new Dxf().Rect(0, 0, 100, 100).Rect(20, 20, 60, 60).Rect(40, 40, 20, 20).Bytes(),
            ["slot-bulge.dxf"] = new Dxf().Rect(0, 0, 120, 60).Polyline(true, "0", (40, 25, 0), (80, 25, 1), (80, 35, 0), (40, 35, 1)).Bytes(),
            ["roles-text.dxf"] = new Dxf().CodePage("ANSI_1253").Layer("ΧΑΡΑΞΗ", 5).Layer("BEND", 30, "DASHED").Layer("DIM")
                .Rect(0, 0, 200, 100).Line(20, 80, 80, 80, "ΧΑΡΑΞΗ").Line(100, 0, 100, 100, "BEND").Line(0, -10, 200, -10, "DIM")
                .Text(10, 10, 5, "ΤΕΜ. 1").Rect(150, 20, 30, 30).Line(150, 20, 180, 20).Bytes(),
            ["open.dxf"] = new Dxf().Line(0, 0, 100, 0).Line(100, 0, 100, 50).Line(100, 50, 0, 50).Line(0, 50, 0, 1).Bytes(),
        };
        f["blocks-2004.dxf"] = AcadFile.Write(BlocksDoc(), false);
        f["blocks.dwg"] = AcadFile.Write(BlocksDoc(), true);
        f["curves-2004.dxf"] = AcadFile.Write(CurvesDoc(), false);
        f["array-2004.dxf"] = AcadFile.Write(ArrayDoc(), false);
        f["array.dwg"] = AcadFile.Write(ArrayDoc(), true);
        return f;
    }

    static CadDocument BlocksDoc()
    {
        var doc = new CadDocument(ACadVersion.AC1018);
        var rec = new ACadSharp.Tables.BlockRecord("HOLE");
        rec.Entities.Add(new ACadSharp.Entities.Circle { Center = new XYZ(0, 0, 0), Radius = 3 });
        doc.BlockRecords.Add(rec);
        var corners = new[] { new XYZ(0, 0, 0), new XYZ(80, 0, 0), new XYZ(80, 40, 0), new XYZ(0, 40, 0) };
        for (int i = 0; i < 4; i++) doc.Entities.Add(new ACadSharp.Entities.Line { StartPoint = corners[i], EndPoint = corners[(i + 1) % 4] });
        doc.Entities.Add(new ACadSharp.Entities.Insert(rec) { InsertPoint = new XYZ(10, 10, 0) });
        doc.Entities.Add(new ACadSharp.Entities.Insert(rec) { InsertPoint = new XYZ(70, 30, 0), XScale = 2, YScale = 2, Rotation = Math.PI / 6 });
        return doc;
    }

    static CadDocument CurvesDoc()
    {
        var doc = new CadDocument(ACadVersion.AC1018);
        doc.Entities.Add(new ACadSharp.Entities.Ellipse { Center = new XYZ(50, 30, 0), MajorAxisEndPoint = new XYZ(40, 0, 0), RadiusRatio = 0.5, StartParameter = 0, EndParameter = 2 * Math.PI });
        var sp = new ACadSharp.Entities.Spline { Degree = 3 };
        foreach (var p in new[] { (20.0, 25.0), (35.0, 40.0), (50.0, 20.0), (65.0, 40.0), (80.0, 25.0) }) sp.ControlPoints.Add(new XYZ(p.Item1, p.Item2, 0));
        foreach (var k in new[] { 0.0, 0, 0, 0, 0.5, 1, 1, 1, 1 }) sp.Knots.Add(k);
        sp.Layer = new ACadSharp.Tables.Layer("MARK");
        doc.Entities.Add(sp);
        return doc;
    }

    // A plate with a 3 × 2 array of holes as one MINSERT, turned 90°: Eyeshot alone keeps one hole from the
    // DXF and none from the DWG.
    static CadDocument ArrayDoc()
    {
        var doc = new CadDocument(ACadVersion.AC1018);
        var rec = new ACadSharp.Tables.BlockRecord("HOLE");
        rec.Entities.Add(new ACadSharp.Entities.Circle { Center = new XYZ(0, 0, 0), Radius = 3 });
        doc.BlockRecords.Add(rec);
        var corners = new[] { new XYZ(-40, 0, 0), new XYZ(20, 0, 0), new XYZ(20, 70, 0), new XYZ(-40, 70, 0) };
        for (int i = 0; i < 4; i++) doc.Entities.Add(new ACadSharp.Entities.Line { StartPoint = corners[i], EndPoint = corners[(i + 1) % 4] });
        doc.Entities.Add(new ACadSharp.Entities.Insert(rec) { InsertPoint = new XYZ(10, 10, 0), ColumnCount = 3, RowCount = 2, ColumnSpacing = 20, RowSpacing = 15, Rotation = Math.PI / 2 });
        return doc;
    }

    // The comparable summary of a result; parity.html computes the same from the engine's JSON.
    public static Dictionary<string, object> Summary(Result r)
    {
        static double R3(double v) => Math.Round(v, 3);
        return new Dictionary<string, object>
        {
            ["parts"] = r.Parts.OrderByDescending(p => p.Area)
                .Select(p => new Dictionary<string, object> { ["area"] = R3(p.Area), ["cutLength"] = R3(p.CutLength), ["pierces"] = p.Pierces, ["holes"] = p.Holes.Count }).ToList(),
            ["checks"] = r.Checks.Select(c => c.Id).ToList(),
            ["openCutLength"] = R3(r.OpenCutLength),
            ["markLength"] = R3(r.MarkLength),
            ["contours"] = r.Contours.Count,
            ["texts"] = r.Drawing.Texts.Select(t => t.Value).ToList(),
        };
    }

    // Two files read the same when their summaries match.
    public static bool SameResult(byte[] a, byte[] b) =>
        JsonSerializer.Serialize(Summary(Processor.Process(a, new Settings()))) == JsonSerializer.Serialize(Summary(Processor.Process(b, new Settings())));

    // Writes only the files that are missing or read differently. ACadSharp stamps the save time into DXF 2004
    // and DWG, so rewriting an unchanged file would change its bytes in git for nothing.
    public static void WriteChanged(string dir, Dictionary<string, byte[]> files)
    {
        Directory.CreateDirectory(dir);
        foreach (var (name, bytes) in files)
        {
            var path = Path.Combine(dir, name);
            if (!File.Exists(path) || !SameResult(File.ReadAllBytes(path), bytes)) File.WriteAllBytes(path, bytes);
        }
    }

    public static string ExpectedJson() => JsonSerializer.Serialize(
        All().OrderBy(kv => kv.Key, StringComparer.Ordinal).ToDictionary(kv => kv.Key, kv => Summary(Processor.Process(kv.Value, new Settings()))),
        new JsonSerializerOptions { WriteIndented = true, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping });
}
```

<!-- file: _src/laser-engine/Tests/ParityTests.cs -->
```csharp
using Xunit;

namespace AidedCam.Laser.Tests;

// The committed parity fixtures must match what this engine produces. After a deliberate engine change,
// regenerate them with:  LASER_WRITE_FIXTURES=1 dotnet test _src/laser-engine/Tests
public class ParityTests
{
    static string Dir([System.Runtime.CompilerServices.CallerFilePath] string here = "") =>
        Path.GetFullPath(Path.Combine(Path.GetDirectoryName(here), "..", "..", "..", "_tests", "laser", "fixtures"));

    [Fact]
    public void Committed_fixtures_and_expected_results_are_current()
    {
        var dir = Dir();
        var files = Fixtures.All();
        string expected = Fixtures.ExpectedJson().Replace("\r\n", "\n");
        if (Environment.GetEnvironmentVariable("LASER_WRITE_FIXTURES") == "1")
        {
            Fixtures.WriteChanged(dir, files);
            File.WriteAllText(Path.Combine(dir, "expected.json"), expected + "\n");
        }
        foreach (var (name, bytes) in files)
        {
            var path = Path.Combine(dir, name);
            Assert.True(File.Exists(path), $"missing fixture {name}");
            Assert.True(Fixtures.SameResult(File.ReadAllBytes(path), bytes), $"fixture {name} is stale");
        }
        Assert.Equal(expected, File.ReadAllText(Path.Combine(dir, "expected.json")).Replace("\r\n", "\n").TrimEnd('\n'));
    }

    [Fact]
    public void The_fixtures_cover_the_risky_cases()
    {
        var s = Fixtures.All().ToDictionary(kv => kv.Key, kv => Processor.Process(kv.Value, new Settings()));
        Assert.Equal(4, s["plate-holes.dxf"].Parts[0].Holes.Count);
        Assert.Equal(2, s["gaps.dxf"].Stats.GapsClosed);
        Assert.Equal(2, s["nested.dxf"].Parts.Count);
        Assert.Single(s["slot-bulge.dxf"].Parts[0].Holes);
        Assert.Contains(s["roles-text.dxf"].Checks, c => c.Id == "duplicates-removed");
        Assert.Equal("ΤΕΜ. 1", Assert.Single(s["roles-text.dxf"].Drawing.Texts).Value);
        Assert.Contains(s["open.dxf"].Checks, c => c.Id == "open-path");
        Assert.Equal(2, s["blocks-2004.dxf"].Parts[0].Holes.Count);
        Assert.Equal(2, s["blocks.dwg"].Parts[0].Holes.Count);
        Assert.Equal(6, s["array-2004.dxf"].Parts[0].Holes.Count);
        Assert.Equal(6, s["array.dwg"].Parts[0].Holes.Count);
        var curves = s["curves-2004.dxf"];
        Assert.Single(curves.Parts);                                       // the ellipse, as lines within 0.01 mm
        Assert.True(curves.MarkLength > 60, $"spline mark length {curves.MarkLength}");
    }
}
```

Run: `for f in Fixtures ParityTests; do node _tests/extract.mjs <brief> _src/laser-engine/Tests/$f.cs; done`

- [ ] **Step 2: Run them and see them fail**

Run: `dotnet test _src/laser-engine/Tests 2>&1 | grep -E "missing fixture|Failed!"`
Expected: `Committed_fixtures_and_expected_results_are_current` fails with `missing fixture …`, and the summary line reads `Failed!  - Failed:     1, Passed:    36`.

- [ ] **Step 3: Generate the fixtures**

Run: `LASER_WRITE_FIXTURES=1 dotnet test _src/laser-engine/Tests 2>&1 | tail -1 && ls _tests/laser/fixtures`
Expected: `Passed: 37`. The folder lists these eleven fixtures plus `expected.json`:
- `array-2004.dxf`, `array.dwg`;
- `blocks-2004.dxf`, `blocks.dwg`, `curves-2004.dxf`;
- `gaps.dxf`, `nested.dxf`, `open.dxf`;
- `plate-holes.dxf`, `roles-text.dxf`, `slot-bulge.dxf`.

- [ ] **Step 4: Run the tests normally**

Run: `dotnet test _src/laser-engine/Tests 2>&1 | tail -1 && git check-attr text -- _tests/laser/fixtures/gaps.dxf`
Expected: `Passed: 37`, `Failed: 0`, and `text: unset`.

Regeneration rewrites only files that are missing or read differently. ACadSharp stamps the save time into DXF 2004 and DWG files, so blind rewrites would change them in git on every run. Running Step 3 again leaves `git status --short _tests/laser/fixtures` unchanged.

- [ ] **Step 5: Commit**

```bash
git add _src/laser-engine _tests/laser/fixtures
git commit -F - <<'EOF'
Laser DXF check: golden fixtures and expected results for browser parity

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 6: The browser engine and the feasibility gate

**Files:**
- Create: `_src/laser-engine/Host/Host.csproj`, `_src/laser-engine/Host/Program.cs`, `_src/laser-engine/publish.ps1`
- Create: `js/laser/worker.js`
- Create: `_tests/laser/engine-smoke.html`, `_tests/laser/parity.html`, `_tests/laser/perf-dxf.mjs`, `_tests/laser/perf.html`
- Generate: `js/laser/engine/` (the published runtime, about 108 files)

**Interfaces:**
- Consumes: `Processor`, `ResultJson`, `Settings`, `LaserFileException` (Tasks 2–4); `expected.json` (Task 5).
- Produces:
  - `[JSExport] Api.Process(byte[] bytes, string name, string settingsJson) → string`, the result or error JSON.
  - `[JSExport] Api.LastDxf() → byte[]`.
  - `js/laser/worker.js`, a module worker:
    - it answers `{type:'boot'}` and `{type:'process', id, name, bytes, settings}`;
    - it posts `boot-progress {pct}`, `ready`, `progress {id}`, then `result` (with `dxf` as a transferred ArrayBuffer) or `error {id, reason, message}`.

- [ ] **Step 1: Write the host and the publish script**

<!-- file: _src/laser-engine/Host/Host.csproj -->
```xml
<Project Sdk="Microsoft.NET.Sdk.WebAssembly">
  <!-- The browser engine: a headless .NET WebAssembly module run inside a Web Worker (spec §3). -->
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <OutputType>Exe</OutputType>
    <AllowUnsafeBlocks>true</AllowUnsafeBlocks>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>disable</Nullable>
    <AssemblyName>AidedCam.Laser.Host</AssemblyName>
    <PublishTrimmed>true</PublishTrimmed>
    <InvariantGlobalization>true</InvariantGlobalization>
    <UseSystemResourceKeys>false</UseSystemResourceKeys>
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

<!-- file: _src/laser-engine/Host/Program.cs -->
```csharp
using System.Runtime.InteropServices.JavaScript;
using System.Text.Json;
using AidedCam.Laser;

// The engine starts with the worker; there is nothing to do until a file arrives.
Console.WriteLine("laser engine ready");

public static partial class Api
{
    static byte[] lastDxf = Array.Empty<byte>();

    // One file in, the result JSON out (spec §3 contract). The repaired DXF is fetched with LastDxf().
    [JSExport]
    public static string Process(byte[] bytes, string name, string settingsJson)
    {
        lastDxf = Array.Empty<byte>();
        try
        {
            var r = Processor.Process(bytes, ParseSettings(settingsJson));
            lastDxf = r.Dxf;
            return ResultJson.Write(name, r);
        }
        catch (LaserFileException ex) { return ResultJson.Error(name, ex.Reason, ex.Message); }
        catch (Exception ex) { return ResultJson.Error(name, "read", ex.GetType().Name + ": " + ex.Message); }
    }

    [JSExport]
    public static byte[] LastDxf() => lastDxf;

    static Settings ParseSettings(string json)
    {
        var s = new Settings();
        if (string.IsNullOrWhiteSpace(json)) return s;
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        if (root.TryGetProperty("units", out var u) && u.ValueKind == JsonValueKind.String) s.Units = u.GetString();
        if (root.TryGetProperty("joinTol", out var j) && j.TryGetDouble(out var jv) && jv > 0) s.JoinTol = jv;
        if (root.TryGetProperty("gapTol", out var g) && g.TryGetDouble(out var gv) && gv >= 0) s.GapTol = gv;
        if (root.TryGetProperty("roles", out var roles) && roles.ValueKind == JsonValueKind.Object)
            foreach (var p in roles.EnumerateObject())
                if (p.Value.ValueKind == JsonValueKind.String && Roles.IsRole(p.Value.GetString())) s.Roles[p.Name] = p.Value.GetString();
        return s;
    }
}
```

<!-- file: _src/laser-engine/publish.ps1 -->
```powershell
# Publishes the browser engine and copies it to js/laser/engine/ (spec §3). Run from the repo root:
#   powershell -ExecutionPolicy Bypass -File _src/laser-engine/publish.ps1
# Only the JavaScript modules and the gzip copies are kept: the worker unpacks each .wasm itself.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$out = Join-Path $env:TEMP 'aidedcam-laser-publish'
if (Test-Path $out) { Remove-Item -Recurse -Force $out }
dotnet publish (Join-Path $PSScriptRoot 'Host/Host.csproj') -c Release -o $out -v q
if ($LASTEXITCODE -ne 0) { throw 'dotnet publish failed' }
$fw = Join-Path $out 'wwwroot/_framework'
$dest = Join-Path $root 'js/laser/engine'
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
'{0} files, {1:N1} MB in js/laser/engine' -f $all.Count, (($all | Measure-Object Length -Sum).Sum / 1MB)
```

Run: `for f in Host/Host.csproj Host/Program.cs publish.ps1; do node _tests/extract.mjs <brief> _src/laser-engine/$f; done`

- [ ] **Step 2: Publish**

Run: `powershell -ExecutionPolicy Bypass -File _src/laser-engine/publish.ps1 2>&1 | tail -1`
Expected: `108 files, 11.9 MB in js/laser/engine` (±2 files and ±0.3 MB is fine). Trim warnings `IL2104` for Xbim/Esent assemblies are expected. Then `ls js/laser/engine | grep -c "\.gz$"` prints `104`, and `cat js/laser/engine/manifest.json` shows `{"files":104,"bytes":…}`.

- [ ] **Step 3: Write the worker and the dev pages**

<!-- file: js/laser/worker.js -->
```js
// The laser engine's worker (spec §3). On the first message it boots the .NET runtime from ./engine/,
// fetching each .wasm as its gzip copy and unpacking it with the browser's DecompressionStream, so any
// static host works. Then it processes one file per 'process' message.
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
    self.postMessage({ type: 'progress', id: m.id, stage: 'processing' });
    const result = JSON.parse(engine.Process(new Uint8Array(m.bytes), m.name, JSON.stringify(m.settings || {})));
    result.id = m.id;
    if (result.type === 'result') {
      const dxf = engine.LastDxf();                                   // a copy owned by this worker
      result.dxf = dxf.buffer;
      self.postMessage(result, [dxf.buffer]);
    } else self.postMessage(result);
  } catch (err) {
    self.postMessage({ type: 'error', id: m.id, reason: 'engine', message: String((err && err.message) || err) });
  }
};
```

<!-- file: _tests/laser/engine-smoke.html -->
```html
<!doctype html>
<!-- Dev-only check that the published engine boots in a worker and processes a DXF (not deployed: Jekyll skips _tests). -->
<meta charset="utf-8"><link rel="icon" href="data:,"><title>laser engine smoke</title><pre id="out">booting…</pre>
<script type="module">
const dxf = [
  '0','SECTION','2','ENTITIES',
  '0','LINE','8','0','10','0','20','0','30','0','11','100','21','0','31','0',
  '0','LINE','8','0','10','100','20','0','30','0','11','100','21','50','31','0',
  '0','LINE','8','0','10','100','20','50','30','0','11','0','21','50','31','0',
  '0','LINE','8','0','10','0','20','50','30','0','11','0','21','0.1','31','0',
  '0','CIRCLE','8','0','10','20','20','25','30','0','40','5',
  '0','ENDSEC','0','EOF',
].join('\r\n') + '\r\n';
const w = new Worker('../../js/laser/worker.js', { type: 'module' });
const progress = [];
const t0 = performance.now();
w.onmessage = e => {
  const m = e.data;
  if (m.type === 'boot-progress') { progress.push(m.pct); return; }
  if (m.type === 'ready' || m.type === 'progress') return;
  window.__smoke = { type: m.type, parts: m.parts, checks: (m.checks || []).map(c => c.id), dxfBytes: m.dxf ? m.dxf.byteLength : 0,
    error: m.message, progressSteps: progress.length, lastPct: progress[progress.length - 1], ms: Math.round(performance.now() - t0) };
  document.getElementById('out').textContent = JSON.stringify(window.__smoke, null, 1);
};
const bytes = new TextEncoder().encode(dxf).buffer;
w.postMessage({ type: 'process', id: 1, name: 'smoke.dxf', bytes, settings: {} }, [bytes]);
</script>
```

<!-- file: _tests/laser/parity.html -->
```html
<!doctype html>
<!-- Dev-only (Jekyll skips _tests): runs every parity fixture through the published browser engine and
     compares with the desktop results in fixtures/expected.json (spec §13). window.__parity holds the outcome. -->
<meta charset="utf-8"><link rel="icon" href="data:,"><title>laser engine parity</title><pre id="out">running…</pre>
<script type="module">
const expected = await (await fetch('./fixtures/expected.json')).json();
const r3 = v => Math.round(v * 1000) / 1000;
// The same summary as Fixtures.Summary in the C# tests.
function summary(m) {
  return {
    parts: [...m.parts].sort((a, b) => b.area - a.area)
      .map(p => ({ area: r3(p.area), cutLength: r3(p.cutLength), pierces: p.pierces, holes: p.holes.length })),
    checks: m.checks.map(c => c.id),
    openCutLength: r3(m.extras.openCutLength),
    markLength: r3(m.extras.markLength),
    contours: m.contours.length,
    texts: m.texts.map(t => t.value),
  };
}
function same(a, b, path, out) {
  if (typeof a === 'number' && typeof b === 'number') { if (Math.abs(a - b) > 0.002) out.push(`${path}: ${a} ≠ ${b}`); return; }
  if (Array.isArray(a) || (a && typeof a === 'object')) {
    const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    for (const k of keys) same(a?.[k], b?.[k], `${path}.${k}`, out);
    return;
  }
  if (a !== b) out.push(`${path}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
}
const w = new Worker('../../js/laser/worker.js', { type: 'module' });
const pending = new Map();
w.onmessage = e => { const m = e.data; if ((m.type === 'result' || m.type === 'error') && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const run = (id, name, bytes) => new Promise(res => { pending.set(id, res); w.postMessage({ type: 'process', id, name, bytes, settings: {} }, [bytes]); });
const results = {};
let id = 0;
for (const name of Object.keys(expected)) {
  const bytes = await (await fetch('./fixtures/' + name)).arrayBuffer();
  const m = await run(++id, name, bytes);
  const diffs = [];
  if (m.type !== 'result') diffs.push(`engine error: ${m.reason} ${m.message}`);
  else same(summary(m), expected[name], name, diffs);
  results[name] = diffs;
}
const failed = Object.entries(results).filter(([, d]) => d.length);
window.__parity = { files: Object.keys(results).length, failed: failed.length, diffs: failed };
document.getElementById('out').textContent = JSON.stringify(window.__parity, null, 1);
</script>
```

<!-- file: _tests/laser/perf-dxf.mjs -->
```js
// Writes a synthetic "typical part" at the spec's size (§11: under 5,000 curves) for the browser timing
// page: a 360 × 410 mm plate with 1,250 slots, each two lines and two arcs, so 5,004 curves.
// Run: node _tests/laser/perf-dxf.mjs      Then open /_tests/laser/perf.html on the local server.
import { writeFileSync, mkdirSync } from 'node:fs';

const out = [];
const g = (code, v) => out.push(String(code), String(v));
const n = v => (Math.round(v * 1e6) / 1e6).toString();
const line = (x1, y1, x2, y2) => { g(0, 'LINE'); g(8, 'CUT'); g(10, n(x1)); g(20, n(y1)); g(30, 0); g(11, n(x2)); g(21, n(y2)); g(31, 0); };
const arc = (cx, cy, r, a0, a1) => { g(0, 'ARC'); g(8, 'CUT'); g(10, n(cx)); g(20, n(cy)); g(30, 0); g(40, n(r)); g(50, n(a0)); g(51, n(a1)); };

g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(0, 'ENDSEC');
g(0, 'SECTION'); g(2, 'ENTITIES');
const W = 360, H = 410;
line(0, 0, W, 0); line(W, 0, W, H); line(W, H, 0, H); line(0, H, 0, 0);
let curves = 4;
for (let row = 0; row < 50; row++) {
  for (let col = 0; col < 25; col++) {
    const x = 8 + col * 14, y = 6 + row * 8;           // slot: 6 mm straight, R2 ends, 10 × 4 overall
    line(x, y, x + 6, y); arc(x + 6, y + 2, 2, 270, 90); line(x + 6, y + 4, x, y + 4); arc(x, y + 2, 2, 90, 270);
    curves += 4;
  }
}
g(0, 'ENDSEC'); g(0, 'EOF');

mkdirSync(new URL('../private/', import.meta.url), { recursive: true });
writeFileSync(new URL('../private/perf-5000.dxf', import.meta.url), out.join('\r\n') + '\r\n');
console.log(`perf-5000.dxf: ${curves} curves, 1 part with 1250 holes`);
```

<!-- file: _tests/laser/perf.html -->
```html
<!doctype html>
<!-- Dev-only (Jekyll skips _tests): times the published browser engine on the synthetic 5,000-curve part that
     _tests/laser/perf-dxf.mjs writes (spec §11: a typical part in under 2 s). window.__perf holds the outcome. -->
<meta charset="utf-8"><link rel="icon" href="data:,"><title>laser engine timing</title><pre id="out">running…</pre>
<script type="module">
const w = new Worker('../../js/laser/worker.js', { type: 'module' });
const pending = new Map();
w.onmessage = e => { const m = e.data; if ((m.type === 'result' || m.type === 'error') && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const run = (id, name, bytes) => new Promise(res => { pending.set(id, res); w.postMessage({ type: 'process', id, name, bytes, settings: {} }, [bytes]); });
const get = async url => (await fetch(url)).arrayBuffer();

let t = performance.now();
await run(1, 'plate-holes.dxf', await get('./fixtures/plate-holes.dxf'));    // boots the engine
const bootMs = Math.round(performance.now() - t);
const src = await get('../private/perf-5000.dxf');
const runs = [];
let last = null;
for (let i = 0; i < 3; i++) {
  t = performance.now();
  last = await run(2 + i, 'perf-5000.dxf', src.slice(0));
  runs.push(Math.round(performance.now() - t));
}
window.__perf = {
  bootMs, runs, best: Math.min(...runs), type: last.type,
  parts: last.parts?.length, holes: last.parts?.[0]?.holes.length, checks: last.checks?.map(c => c.id),
};
document.getElementById('out').textContent = JSON.stringify(window.__perf, null, 1);
</script>
```

Run: `for f in js/laser/worker.js _tests/laser/engine-smoke.html _tests/laser/parity.html _tests/laser/perf-dxf.mjs _tests/laser/perf.html; do node _tests/extract.mjs <brief> $f; done && node _tests/laser/perf-dxf.mjs`
Expected: `perf-5000.dxf: 5004 curves, 1 part with 1250 holes`. The file is in `_tests/private/`, so it is never committed.

- [ ] **Step 4: The gate, in the browser (Playwright MCP)**

Serve the repo root with `python -m http.server 8767 --bind 127.0.0.1`, started with the Bash tool's `run_in_background`, and load the Playwright tools with ToolSearch.

In each page, wait with `browser_evaluate` on a loop that has a timeout. Record every result in the report.

1. **Boot and process.** Open `http://127.0.0.1:8767/_tests/laser/engine-smoke.html` and wait for `window.__smoke`.
   - It has `type: 'result'`, and `parts` holds one part with `area` 4918.9602, `cutLength` 331.3659 and 2 pierces.
   - `checks` is `['units-assumed', 'gaps-closed']`, `dxfBytes` > 1000, `progressSteps` > 50 and `lastPct` 99.
2. **Parity.** Open `/_tests/laser/parity.html` and wait for `window.__parity`: it reads `{ files: 11, failed: 0, diffs: [] }`.
3. **Timing.** Open `/_tests/laser/perf.html` and wait for `window.__perf`.
   - `type` is `'result'`, with 1 part and 1250 holes.
   - `best` is under 2000 ms (validated at 454–745), and the first of the three runs is under 3000 ms (validated at 853–1512).
4. **Network.** `browser_network_requests` for the three pages lists only `127.0.0.1:8767`. This list includes the worker's fetches.
5. **No licence material.** `git status --short` shows no file whose name contains `lic` or `key`.

**If any of 1–4 fails, stop here** and report to Aris with the evidence (spec §14). Don't build the page on an engine that failed the gate.

Leave the server running for Task 7 onwards, or stop it now and start it again later.

- [ ] **Step 5: Commit**

```bash
git add _src/laser-engine js/laser/worker.js js/laser/engine _tests/laser/engine-smoke.html _tests/laser/parity.html _tests/laser/perf-dxf.mjs _tests/laser/perf.html
git commit -F - <<'EOF'
Laser DXF check: WebAssembly host, publish script, worker and browser gate pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 7: The example order

**Files:**
- Create: `_src/laser-engine/Tests/Examples.cs`
- Generate: `js/laser/examples/bracket.dxf`, `flange.dxf`, `cover.dxf`, `spacer.dwg`

**Interfaces:**
- Produces:
  - the four example files the page loads;
  - `Examples.Quantities`: bracket 10, flange 4, cover 2, spacer 20. The page's `EXAMPLE` list in Task 12 repeats them.

- [ ] **Step 1: Write the failing tests**

<!-- file: _src/laser-engine/Tests/Examples.cs -->
```csharp
using ACadSharp;
using CSMath;
using Xunit;

namespace AidedCam.Laser.Tests;

// The page's "Load example order" (spec §10): synthetic parts built here, committed to js/laser/examples/.
// Regenerate after a deliberate change with:  LASER_WRITE_FIXTURES=1 dotnet test _src/laser-engine/Tests
public static class Examples
{
    public static Dictionary<string, byte[]> All() => new()
    {
        // A mounting plate (DXF 2004, in mm): rounded corners (arcs), four bolt holes and two slots (bulge polylines).
        ["bracket.dxf"] = Bracket(),
        // A flange (DXF 2004, in mm): outer circle, bore and six bolt holes on a 110 mm pitch circle.
        ["flange.dxf"] = Flange(),
        // A cover as customers send it (old R12, no units): a corner gap, a doubled edge, a part number, a bend line, a marking.
        ["cover.dxf"] = new Dxf().CodePage("ANSI_1253").Layer("CUT").Layer("BEND", 30, "DASHED").Layer("MARK", 5)
            .Line(0, 0, 200, 0, "CUT").Line(200, 0, 200, 100, "CUT").Line(200, 100, 0, 100, "CUT").Line(0, 100, 0, 0.15, "CUT")
            .Line(0, 0, 200, 0, "CUT")
            .Rect(20, 30, 40, 40, "CUT").Circle(150, 50, 12, "CUT")
            .Line(100, 0, 100, 100, "BEND")
            .Line(20, 88, 60, 88, "MARK")
            .Text(20, 8, 6, "ΚΑΛΥΜΜΑ Κ-01", "MARK").Bytes(),
        // A spacer, as DWG 2018 in mm: a ring with four holes.
        ["spacer.dwg"] = Spacer(),
    };

    // Quantities the page applies to the example order.
    public static readonly Dictionary<string, int> Quantities = new() { ["bracket.dxf"] = 10, ["flange.dxf"] = 4, ["cover.dxf"] = 2, ["spacer.dwg"] = 20 };

    static CadDocument Mm(ACadVersion v)
    {
        var doc = new CadDocument(v);
        doc.Header.InsUnits = ACadSharp.Types.Units.UnitsType.Millimeters;
        return doc;
    }

    static byte[] Bracket()
    {
        var doc = Mm(ACadVersion.AC1018);
        var cut = new ACadSharp.Tables.Layer("CUT");
        void Line(double x1, double y1, double x2, double y2) => doc.Entities.Add(new ACadSharp.Entities.Line { StartPoint = new XYZ(x1, y1, 0), EndPoint = new XYZ(x2, y2, 0), Layer = cut });
        void Arc(double cx, double cy, double a0, double a1) => doc.Entities.Add(new ACadSharp.Entities.Arc { Center = new XYZ(cx, cy, 0), Radius = 10, StartAngle = a0 * Math.PI / 180, EndAngle = a1 * Math.PI / 180, Layer = cut });
        void Hole(double x, double y) => doc.Entities.Add(new ACadSharp.Entities.Circle { Center = new XYZ(x, y, 0), Radius = 4.25, Layer = cut });
        void Slot(double x0, double y0, double x1, double y1)
        {
            var p = new ACadSharp.Entities.LwPolyline { IsClosed = true, Layer = cut };
            p.Vertices.Add(new ACadSharp.Entities.LwPolyline.Vertex(new XY(x0, y0)));
            p.Vertices.Add(new ACadSharp.Entities.LwPolyline.Vertex(new XY(x1, y0)) { Bulge = 1 });
            p.Vertices.Add(new ACadSharp.Entities.LwPolyline.Vertex(new XY(x1, y1)));
            p.Vertices.Add(new ACadSharp.Entities.LwPolyline.Vertex(new XY(x0, y1)) { Bulge = 1 });
            doc.Entities.Add(p);
        }
        Line(10, 0, 110, 0); Arc(110, 10, 270, 360); Line(120, 10, 120, 70); Arc(110, 70, 0, 90);
        Line(110, 80, 10, 80); Arc(10, 70, 90, 180); Line(0, 70, 0, 10); Arc(10, 10, 180, 270);
        Hole(15, 15); Hole(105, 15); Hole(15, 65); Hole(105, 65);
        Slot(40, 36, 80, 44); Slot(55, 15, 65, 23);
        return AcadFile.Write(doc, false);
    }

    static byte[] Flange()
    {
        var doc = Mm(ACadVersion.AC1018);
        var cut = new ACadSharp.Tables.Layer("CUT");
        void Circle(double x, double y, double r) => doc.Entities.Add(new ACadSharp.Entities.Circle { Center = new XYZ(x, y, 0), Radius = r, Layer = cut });
        Circle(0, 0, 75); Circle(0, 0, 30);
        for (int i = 0; i < 6; i++) Circle(55 * Math.Cos(i * Math.PI / 3), 55 * Math.Sin(i * Math.PI / 3), 6);
        return AcadFile.Write(doc, false);
    }

    static byte[] Spacer()
    {
        var doc = Mm(ACadVersion.AC1032);
        doc.Entities.Add(new ACadSharp.Entities.Circle { Center = new XYZ(0, 0, 0), Radius = 40 });
        doc.Entities.Add(new ACadSharp.Entities.Circle { Center = new XYZ(0, 0, 0), Radius = 20 });
        foreach (var (x, y) in new[] { (30.0, 0.0), (0.0, 30.0), (-30.0, 0.0), (0.0, -30.0) })
            doc.Entities.Add(new ACadSharp.Entities.Circle { Center = new XYZ(x, y, 0), Radius = 3 });
        return AcadFile.Write(doc, true);
    }
}

public class ExamplesTests
{
    static string Dir([System.Runtime.CompilerServices.CallerFilePath] string here = "") =>
        Path.GetFullPath(Path.Combine(Path.GetDirectoryName(here), "..", "..", "..", "js", "laser", "examples"));

    [Fact]
    public void The_example_order_shows_what_the_tool_does()
    {
        var r = Examples.All().ToDictionary(kv => kv.Key, kv => Processor.Process(kv.Value, new Settings()));
        var bracket = Assert.Single(r["bracket.dxf"].Parts);
        Assert.Equal(6, bracket.Holes.Count);
        foreach (var clean in new[] { "bracket.dxf", "flange.dxf", "spacer.dwg" })
        {
            Assert.Empty(r[clean].Checks);                          // declared mm, nothing to repair: shows as ready
            Assert.Equal("mm", r[clean].Drawing.Units);
        }
        Assert.Contains(r["cover.dxf"].Checks, c => c.Id == "units-assumed");
        var flange = Assert.Single(r["flange.dxf"].Parts);
        Assert.Equal(7, flange.Holes.Count);
        Assert.Equal(Math.PI * (75 * 75 - 30 * 30 - 6 * 36), flange.Area, 6);
        var cover = r["cover.dxf"];
        var ids = cover.Checks.Select(c => c.Id).ToList();
        Assert.Contains("gaps-closed", ids);
        Assert.Contains("duplicates-removed", ids);
        Assert.Contains("text-kept", ids);
        Assert.DoesNotContain("open-path", ids);
        Assert.Equal(2, Assert.Single(cover.Parts).Holes.Count);
        Assert.Equal(40, cover.MarkLength, 6);
        Assert.Equal("dwg", r["spacer.dwg"].Drawing.Format);
        Assert.Equal(5, Assert.Single(r["spacer.dwg"].Parts).Holes.Count);
    }

    [Fact]
    public void Committed_example_files_are_current()
    {
        var dir = Dir();
        if (Environment.GetEnvironmentVariable("LASER_WRITE_FIXTURES") == "1") Fixtures.WriteChanged(dir, Examples.All());
        foreach (var (name, bytes) in Examples.All())
        {
            var path = Path.Combine(dir, name);
            Assert.True(File.Exists(path), $"missing example {name}");
            Assert.True(Fixtures.SameResult(File.ReadAllBytes(path), bytes), $"example {name} is stale");
        }
    }
}
```

Run: `node _tests/extract.mjs <brief> _src/laser-engine/Tests/Examples.cs && dotnet test _src/laser-engine/Tests 2>&1 | grep -E "missing example|Failed!"`
Expected: `missing example bracket.dxf`, and `Failed:     1, Passed:    38`.

- [ ] **Step 2: Generate the examples**

Run: `LASER_WRITE_FIXTURES=1 dotnet test _src/laser-engine/Tests 2>&1 | tail -1 && ls js/laser/examples && git status --short _tests/laser/fixtures`
Expected: `Passed: 39` and the four files. The last command prints nothing: the same switch also covers the fixtures, and it leaves unchanged ones alone.

- [ ] **Step 3: Run the tests normally**

Run: `dotnet test _src/laser-engine/Tests 2>&1 | tail -1`
Expected: `Passed: 39`, `Failed: 0`.

- [ ] **Step 4: Commit**

```bash
git add _src/laser-engine js/laser/examples
git commit -F - <<'EOF'
Laser DXF check: synthetic example order (bracket, flange, cover, spacer)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 8: Pricing, the ZIP writer and the drawing paths

**Files:**
- Create: `js/laser/pricing.js`, `js/laser/zip.js`, `js/laser/drawing.js`
- Create: `_tests/laser/pricing.test.js`, `_tests/laser/zip.test.js`, `_tests/laser/drawing.test.js`
- Create: `_docs/laser-checker/speed-defaults.md`

**Interfaces:**
- Consumes: the result JSON shape (spec §3 and Task 4): `parts[].{area, cutLength, pierces}`, `extras`, `checks`, `contours[].segs`, `texts`, `markers`.
- Produces:
  - `pricing.js`:
    - `MATERIALS`, `DEFAULT_SPEEDS`, `DEFAULT_MARK_SPEED`, `THICKNESSES`;
    - `speedAt(rows, t) → {cut, pierce, clamped}`;
    - `weightKg(area, t, density)`;
    - `fileNumbers(result, {material, thickness}, speeds, markSpeed) → {parts, area, weight, cutLength, pierces, markLength, seconds, clamped, incomplete}`;
    - `orderTotals([{numbers, qty}])`;
    - `statusOf(result) → 'ok'|'warn'|'error'`;
    - `formatDuration(s)`.
  - `zip.js`: `crc32(bytes)`, `uniqueNames(names)`, `zipStore([{name, bytes}], date) → Uint8Array`.
  - `drawing.js`:
    - `arcSweep`, `segPath`, `contourPath`, `boundsOf`;
    - `createDrawing(svg, {onHover}) → {show, fit, clear, zoomBy, highlight}`.

- [ ] **Step 1: Write the failing tests**

<!-- file: _tests/laser/pricing.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MATERIALS, DEFAULT_SPEEDS, speedAt, weightKg, fileNumbers, orderTotals, statusOf, formatDuration,
} from '../../js/laser/pricing.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

test('speedAt interpolates between rows and clamps outside the table', () => {
  const rows = [[3, 6000, 0.5], [1, 20000, 0.1]];                      // unsorted on purpose
  const mid = speedAt(rows, 2);
  close(mid.cut, 13000); close(mid.pierce, 0.3); assert.equal(mid.clamped, false);
  assert.deepEqual(speedAt(rows, 1), { cut: 20000, pierce: 0.1, clamped: false });
  assert.deepEqual(speedAt(rows, 0.5), { cut: 20000, pierce: 0.1, clamped: true });
  assert.deepEqual(speedAt(rows, 3), { cut: 6000, pierce: 0.5, clamped: false });
  assert.deepEqual(speedAt(rows, 25), { cut: 6000, pierce: 0.5, clamped: true });
  assert.deepEqual(speedAt([], 2), { cut: 0, pierce: 0, clamped: true });
});

test('weight is area × thickness × density', () => {
  close(weightKg(1e6, 1, 7.85), 7.85);                                 // 1 m² of 1 mm steel
  close(weightKg(4000, 2, MATERIALS.aluminium), 0.0216);
});

test('one file: parts plus open paths, cutting and marking time, open paths make it incomplete', () => {
  const result = {
    parts: [{ area: 4000, cutLength: 300, pierces: 3 }, { area: 1000, cutLength: 100, pierces: 1 }],
    extras: { openCutLength: 50, openPierces: 1, markLength: 60, markStarts: 1 },
  };
  const n = fileNumbers(result, { material: 'steel', thickness: 2 }, { steel: [[2, 6000, 0.5]] }, 1200);
  assert.equal(n.parts, 2);
  assert.equal(n.area, 5000);
  close(n.weight, 5000 * 2 * 7.85 / 1e6);
  assert.equal(n.cutLength, 450);
  assert.equal(n.pierces, 5);
  assert.equal(n.markLength, 60);
  close(n.seconds, 4.5 + 2.5 + 3);                                     // 450 mm at 6000, 5 × 0.5 s, 60 mm at 1200
  assert.equal(n.clamped, false);
  assert.equal(n.incomplete, true);
  const clean = fileNumbers({ parts: result.parts }, { material: 'steel', thickness: 2 }, { steel: [[2, 6000, 0.5]] }, 1200);
  assert.equal(clean.incomplete, false);
  close(clean.seconds, 4 + 2);
});

test('order totals multiply by quantity; a failed file turns the totals into "at least"', () => {
  const a = { parts: 1, area: 100, weight: 1, cutLength: 10, pierces: 2, seconds: 5, incomplete: false };
  const b = { parts: 2, area: 50, weight: 0.5, cutLength: 20, pierces: 1, seconds: 3, incomplete: false };
  const t = orderTotals([{ numbers: a, qty: 10 }, { numbers: b, qty: 2 }]);
  assert.deepEqual(t, { cutLength: 140, pierces: 22, area: 1100, weight: 11, seconds: 56, parts: 14, incomplete: false });
  assert.equal(orderTotals([{ numbers: a, qty: 1 }, { numbers: null, qty: 3 }]).incomplete, true);
  assert.equal(orderTotals([{ numbers: { ...a, incomplete: true }, qty: 1 }]).incomplete, true);
  assert.equal(orderTotals([{ numbers: { ...a, seconds: NaN }, qty: 1 }]).incomplete, true);
  assert.equal(orderTotals([{ numbers: a, qty: 0 }]).cutLength, 0);
});

test('status: error beats warning beats a repair', () => {
  const r = checks => ({ type: 'result', checks });
  assert.equal(statusOf(null), 'error');
  assert.equal(statusOf({ type: 'error' }), 'error');
  assert.equal(statusOf(r([])), 'ok');
  assert.equal(statusOf(r([{ id: 'text-kept', severity: 'info' }])), 'ok');
  assert.equal(statusOf(r([{ id: 'gaps-closed', severity: 'info' }])), 'warn');
  assert.equal(statusOf(r([{ id: 'branch', severity: 'warn' }])), 'warn');
  assert.equal(statusOf(r([{ id: 'branch', severity: 'warn' }, { id: 'open-path', severity: 'error' }])), 'error');
});

test('every material has a density and at least five speed rows', () => {
  for (const m of Object.keys(MATERIALS)) {
    assert.ok(DEFAULT_SPEEDS[m] && DEFAULT_SPEEDS[m].length >= 5, m);
    for (const [t, cut, pierce] of DEFAULT_SPEEDS[m]) assert.ok(t > 0 && cut > 0 && pierce > 0, `${m} ${t}`);
  }
});

test('durations read as m:ss or h:mm:ss', () => {
  assert.equal(formatDuration(59.4), '0:59');
  assert.equal(formatDuration(3725), '1:02:05');
  assert.equal(formatDuration(NaN), '–');
});
```

<!-- file: _tests/laser/zip.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, zipStore, uniqueNames } from '../../js/laser/zip.js';

const enc = new TextEncoder();

test('CRC-32 of the standard check string', () => {
  assert.equal(crc32(enc.encode('123456789')), 0xcbf43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test('the archive reads back: local headers, central directory with UTF-8 names, end record', () => {
  const files = [
    { name: 'πλάκα-laser.dxf', bytes: enc.encode('0\nSECTION\n0\nEOF\n') },
    { name: 'b.dxf', bytes: enc.encode('second') },
  ];
  const zip = zipStore(files);
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const dec = new TextDecoder();

  const endAt = zip.length - 22;
  assert.equal(v.getUint32(endAt, true), 0x06054b50);
  assert.equal(v.getUint16(endAt + 8, true), 2);
  assert.equal(v.getUint16(endAt + 10, true), 2);
  let cd = v.getUint32(endAt + 16, true);
  assert.equal(cd + v.getUint32(endAt + 12, true), endAt);

  for (const f of files) {
    assert.equal(v.getUint32(cd, true), 0x02014b50);
    assert.ok(v.getUint16(cd + 8, true) & 0x0800, 'UTF-8 flag');
    const nameLen = v.getUint16(cd + 28, true);
    assert.equal(dec.decode(zip.subarray(cd + 46, cd + 46 + nameLen)), f.name);
    assert.equal(v.getUint32(cd + 16, true), crc32(f.bytes));
    const local = v.getUint32(cd + 42, true);
    assert.equal(v.getUint32(local, true), 0x04034b50);
    assert.ok(v.getUint16(local + 6, true) & 0x0800);
    assert.equal(v.getUint16(local + 8, true), 0, 'stored');
    const size = v.getUint32(local + 18, true);
    const at = local + 30 + v.getUint16(local + 26, true);
    assert.deepEqual(zip.subarray(at, at + size), f.bytes);
    cd += 46 + nameLen;
  }
});

test('two files with the same name get distinct entries', () => {
  assert.deepEqual(uniqueNames(['a-laser.dxf', 'A-laser.dxf', 'b-laser.dxf', 'a-laser.dxf']),
    ['a-laser.dxf', 'A-laser (2).dxf', 'b-laser.dxf', 'a-laser (3).dxf']);
  assert.deepEqual(uniqueNames(['a (2).dxf', 'a.dxf', 'a.dxf']), ['a (2).dxf', 'a.dxf', 'a (3).dxf']);
  assert.deepEqual(uniqueNames(['noext', 'noext']), ['noext', 'noext (2)']);
});
```

<!-- file: _tests/laser/drawing.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arcSweep, segPath, contourPath, boundsOf } from '../../js/laser/drawing.js';

// Model y points up, SVG y points down: every y is negated.
test('a line flips y', () => {
  assert.equal(segPath({ t: 'L', x1: 0, y1: 0, x2: 10, y2: 5 }), 'M0 0L10 -5');
});

test('a circle is two half arcs', () => {
  assert.equal(segPath({ t: 'C', cx: 0, cy: 0, r: 2 }), 'M2 0A2 2 0 1 1 -2 0A2 2 0 1 1 2 0');
});

// Where SVG puts an arc's centre from its end points and flags (SVG 1.1, F.6.5, circular arcs), so the
// tests check geometry rather than a string: a wrong flag moves the centre and draws the arc inside out.
function svgArcCentre(d) {
  const m = d.match(/^M(\S+) (\S+)A(\S+) \S+ 0 ([01]) ([01]) (\S+) (\S+)$/);
  const [x1, y1, r, large, sweep, x2, y2] = m.slice(1).map(Number);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const k = Math.sqrt(Math.max(0, (r * r - dx * dx - dy * dy) / (dx * dx + dy * dy)));
  const s = large === sweep ? -1 : 1;
  return [s * k * dy + (x1 + x2) / 2, -s * k * dx + (y1 + y2) / 2];
}

test('arcs keep their centre: y is flipped, so counter-clockwise draws with sweep 0; the long way sets large-arc', () => {
  const quarter = { t: 'A', cx: 3, cy: 4, r: 10, a0: 0, a1: 90 };
  assert.equal(segPath({ ...quarter, ccw: true }), 'M13 -4A10 10 0 0 0 3 -14');
  assert.equal(arcSweep({ ...quarter, ccw: true }), 90);
  assert.equal(segPath({ ...quarter, ccw: false }), 'M13 -4A10 10 0 1 1 3 -14');
  assert.equal(arcSweep({ ...quarter, ccw: false }), 270);
  assert.equal(arcSweep({ a0: 350, a1: 10, ccw: true }), 20);
  for (const ccw of [true, false]) {
    const [x, y] = svgArcCentre(segPath({ ...quarter, ccw }));
    assert.ok(Math.abs(x - 3) < 1e-9 && Math.abs(y + 4) < 1e-9, `ccw ${ccw}: centre ${x} ${y}`);
  }
});

test('bounds include the extreme points an arc passes through', () => {
  const b = boundsOf({ contours: [{ segs: [{ t: 'A', cx: 0, cy: 0, r: 10, a0: 0, a1: 180, ccw: true }] }] });
  assert.ok(Math.abs(b.minX + 10) < 1e-9 && Math.abs(b.maxX - 10) < 1e-9);
  assert.ok(Math.abs(b.minY) < 1e-9 && Math.abs(b.maxY - 10) < 1e-9);
  assert.deepEqual(boundsOf({ contours: [] }), { minX: 0, minY: 0, maxX: 100, maxY: 100 });
});

test('a contour joins its pieces', () => {
  const c = { segs: [{ t: 'L', x1: 0, y1: 0, x2: 1, y2: 0 }, { t: 'L', x1: 1, y1: 0, x2: 1, y2: 1 }] };
  assert.equal(contourPath(c), 'M0 0L1 0M1 0L1 -1');
});
```

Run: `for f in pricing zip drawing; do node _tests/extract.mjs <brief> _tests/laser/$f.test.js; done && node --test "_tests/laser/*.test.js" 2>&1 | grep -m1 -o "Cannot find module '[^']*'"`
Expected: `Cannot find module '…jslaserpricing.js'`, or the same for `zip.js` or `drawing.js`.

- [ ] **Step 2: Write the modules and the research note**

The speed rows in `pricing.js` are the values recommended in `speed-defaults.md`. Keep the two in step if either changes.

<!-- file: js/laser/pricing.js -->
```js
// Laser DXF check: weight, cutting time and totals from the engine's geometry (spec §8). Pure: no DOM.
// The engine gives lengths in mm and areas in mm²; the page shows metres, kg and m:ss.

// Densities in g/cm³ (spec §8).
export const MATERIALS = {
  steel: 7.85, stainless: 7.93, aluminium: 2.70, galvanised: 7.85, copper: 8.96, brass: 8.50,
};

// Typical fiber-laser values (about 3 kW) per material, one row per thickness in mm:
// [thickness, cutting speed mm/min, pierce time s]. Sources and status: _docs/laser-checker/speed-defaults.md.
// The page labels them "typical values: set your machine's"; the shop's own values are saved in the browser.
export const DEFAULT_SPEEDS = {
  steel: [[0.5, 30000, 0.1], [1, 28000, 0.15], [2, 16000, 0.25], [3, 4500, 0.4], [5, 3000, 0.7], [8, 1900, 1.3], [10, 1300, 2], [15, 750, 3.5], [20, 450, 5.5]],
  stainless: [[0.5, 34000, 0.1], [1, 27000, 0.15], [2, 13000, 0.3], [3, 6500, 0.5], [5, 2200, 0.9], [8, 1000, 1.6], [10, 700, 2.3], [15, 250, 4.5], [20, 120, 7]],
  aluminium: [[0.5, 35000, 0.1], [1, 20000, 0.15], [2, 10000, 0.3], [3, 5000, 0.5], [5, 2000, 0.9], [8, 800, 1.6], [10, 450, 2.3], [15, 180, 4.5], [20, 90, 7]],
  galvanised: [[0.5, 27000, 0.15], [1, 25000, 0.2], [2, 13500, 0.3], [3, 3800, 0.5], [5, 2550, 0.9], [8, 1600, 1.6], [10, 1100, 2.3], [15, 640, 4], [20, 380, 6.5]],
  copper: [[0.5, 16000, 0.2], [1, 10000, 0.3], [2, 3500, 0.5], [3, 2200, 0.8], [5, 1000, 1.4], [8, 250, 3], [10, 150, 4.5], [15, 70, 7], [20, 40, 9]],
  brass: [[0.5, 29000, 0.2], [1, 25000, 0.3], [2, 10000, 0.5], [3, 6000, 0.8], [5, 1300, 1.4], [8, 400, 2.8], [10, 220, 4.2], [15, 100, 6.5], [20, 60, 9]],
};
export const DEFAULT_MARK_SPEED = 10000;   // mm/min, all materials

export const THICKNESSES = [0.5, 0.8, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20];

// Cutting speed and pierce time at a thickness: linear between rows, the nearest row outside the table.
export function speedAt(rows, thickness) {
  const r = [...rows].sort((a, b) => a[0] - b[0]);
  if (!r.length) return { cut: 0, pierce: 0, clamped: true };
  if (thickness <= r[0][0]) return { cut: r[0][1], pierce: r[0][2], clamped: thickness < r[0][0] };
  const last = r[r.length - 1];
  if (thickness >= last[0]) return { cut: last[1], pierce: last[2], clamped: thickness > last[0] };
  for (let i = 0; i + 1 < r.length; i++) {
    const [t0, c0, p0] = r[i], [t1, c1, p1] = r[i + 1];
    if (thickness >= t0 && thickness <= t1) {
      const k = (thickness - t0) / (t1 - t0);
      return { cut: c0 + (c1 - c0) * k, pierce: p0 + (p1 - p0) * k, clamped: false };
    }
  }
  return { cut: last[1], pierce: last[2], clamped: true };
}

// kg from mm² × mm × g/cm³.
export const weightKg = (areaMm2, thicknessMm, density) => (areaMm2 * thicknessMm * density) / 1e6;

// One file's numbers for ONE copy (spec §8): its parts plus its open paths.
// result: the engine's JSON. job: { material, thickness }. speeds: { [material]: rows }, markSpeed mm/min.
export function fileNumbers(result, job, speeds = DEFAULT_SPEEDS, markSpeed = DEFAULT_MARK_SPEED) {
  const parts = result.parts || [];
  const ex = result.extras || { openCutLength: 0, openPierces: 0, markLength: 0, markStarts: 0 };
  const area = parts.reduce((a, p) => a + p.area, 0);
  const cutLength = parts.reduce((a, p) => a + p.cutLength, 0) + ex.openCutLength;
  const pierces = parts.reduce((a, p) => a + p.pierces, 0) + ex.openPierces;
  const density = MATERIALS[job.material] ?? MATERIALS.steel;
  const sp = speedAt(speeds[job.material] || DEFAULT_SPEEDS[job.material] || DEFAULT_SPEEDS.steel, job.thickness);
  const cutSeconds = sp.cut > 0 ? (60 * cutLength) / sp.cut : NaN;
  const markSeconds = markSpeed > 0 ? (60 * ex.markLength) / markSpeed : 0;
  const open = ex.openPierces > 0;
  return {
    parts: parts.length,
    area,
    weight: weightKg(area, job.thickness, density),
    cutLength,
    pierces,
    markLength: ex.markLength,
    seconds: cutSeconds + pierces * sp.pierce + markSeconds,
    clamped: sp.clamped,
    incomplete: open,
  };
}

// Order totals: every file's numbers times its quantity. A file that could not be read, or that
// has open paths, makes the totals "at least" (≥), as on the G-code viewers.
export function orderTotals(rows) {
  const t = { cutLength: 0, pierces: 0, area: 0, weight: 0, seconds: 0, parts: 0, incomplete: false };
  for (const r of rows) {
    if (!r.numbers) { t.incomplete = true; continue; }
    const q = r.qty > 0 ? r.qty : 0;
    const n = r.numbers;
    t.cutLength += n.cutLength * q; t.pierces += n.pierces * q; t.area += n.area * q;
    t.weight += n.weight * q; t.seconds += (Number.isFinite(n.seconds) ? n.seconds : 0) * q; t.parts += n.parts * q;
    if (n.incomplete || !Number.isFinite(n.seconds)) t.incomplete = true;
  }
  return t;
}

// Status for the table (spec §9): error beats warning beats a repair.
export function statusOf(result) {
  if (!result || result.type !== 'result') return 'error';
  const sev = (result.checks || []).map(c => c.severity);
  if (sev.includes('error')) return 'error';
  const repaired = (result.checks || []).some(c => ['gaps-closed', 'duplicates-removed', 'tiny-removed'].includes(c.id));
  return sev.includes('warn') || repaired ? 'warn' : 'ok';
}

export function formatDuration(sec) {
  if (!Number.isFinite(sec)) return '–';
  const t = Math.round(sec), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const pad = n => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
```

<!-- file: js/laser/zip.js -->
```js
// A minimal ZIP writer for "download all" (spec §10): stored entries (no compression, DXF is small),
// CRC-32, UTF-8 names (general-purpose flag bit 11). Pure: bytes in, bytes out.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Names for the archive: a second "part-laser.dxf" becomes "part-laser (2).dxf", so no entry overwrites
// another. Compared without case, as Windows unpacks them.
export function uniqueNames(names) {
  const seen = new Set();
  return names.map(n => {
    const dot = n.lastIndexOf('.');
    const stem = dot > 0 ? n.slice(0, dot) : n, ext = dot > 0 ? n.slice(dot) : '';
    let out = n, k = 1;
    while (seen.has(out.toLowerCase())) out = `${stem} (${++k})${ext}`;
    seen.add(out.toLowerCase());
    return out;
  });
}

// files: [{ name, bytes: Uint8Array }]. Returns the .zip as a Uint8Array.
export function zipStore(files, date = new Date(1980, 0, 1)) {
  const enc = new TextEncoder();
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const dosDate = ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const locals = [], centrals = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.bytes), size = f.bytes.length;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true); local.setUint16(10, dosTime, true); local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true); local.setUint32(18, size, true); local.setUint32(22, size, true);
    local.setUint16(26, name.length, true); local.setUint16(28, 0, true);
    locals.push(new Uint8Array(local.buffer), name, f.bytes);
    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true); central.setUint16(4, 20, true); central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true); central.setUint16(10, 0, true); central.setUint16(12, dosTime, true);
    central.setUint16(14, dosDate, true); central.setUint32(16, crc, true); central.setUint32(20, size, true);
    central.setUint32(24, size, true); central.setUint16(28, name.length, true);
    central.setUint32(42, offset, true);
    centrals.push(new Uint8Array(central.buffer), name);
    offset += 30 + name.length + size;
  }
  const cdSize = centrals.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((a, b) => a + b.length, 0));
  let p = 0;
  for (const part of parts) { out.set(part, p); p += part.length; }
  return out;
}
```

<!-- file: js/laser/drawing.js -->
```js
// Laser DXF check: the SVG drawing of one file (spec §10). Model y points up, SVG y points down, so every
// y is negated. A counter-clockwise arc in the model then runs towards decreasing SVG angles: sweep-flag 0.
const NS = 'http://www.w3.org/2000/svg';
const f = v => (Math.round(v * 1000) / 1000).toString();
const rad = d => (d * Math.PI) / 180;

function arcEnds(s) {
  return {
    x0: s.cx + s.r * Math.cos(rad(s.a0)), y0: s.cy + s.r * Math.sin(rad(s.a0)),
    x1: s.cx + s.r * Math.cos(rad(s.a1)), y1: s.cy + s.r * Math.sin(rad(s.a1)),
  };
}

// Sweep of an arc in degrees, in (0, 360].
export function arcSweep(s) {
  let d = s.ccw ? s.a1 - s.a0 : s.a0 - s.a1;
  while (d <= 1e-9) d += 360;
  while (d > 360 + 1e-9) d -= 360;
  return d;
}

// Path data for one piece, starting with its own M.
export function segPath(s) {
  if (s.t === 'L') return `M${f(s.x1)} ${f(-s.y1)}L${f(s.x2)} ${f(-s.y2)}`;
  if (s.t === 'C') {
    return `M${f(s.cx + s.r)} ${f(-s.cy)}A${f(s.r)} ${f(s.r)} 0 1 1 ${f(s.cx - s.r)} ${f(-s.cy)}` +
      `A${f(s.r)} ${f(s.r)} 0 1 1 ${f(s.cx + s.r)} ${f(-s.cy)}`;
  }
  if (s.t === 'P') return 'M' + s.pts.map(p => `${f(p[0])} ${f(-p[1])}`).join('L');
  const e = arcEnds(s);
  const large = arcSweep(s) > 180 ? 1 : 0;
  return `M${f(e.x0)} ${f(-e.y0)}A${f(s.r)} ${f(s.r)} 0 ${large} ${s.ccw ? 0 : 1} ${f(e.x1)} ${f(-e.y1)}`;
}

export const contourPath = c => c.segs.map(segPath).join('');

// Bounds of everything drawn, in model coordinates (arcs by their extreme points).
export function boundsOf(result) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const add = (x, y) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
  for (const c of result.contours || []) {
    for (const s of c.segs) {
      if (s.t === 'L') { add(s.x1, s.y1); add(s.x2, s.y2); }
      else if (s.t === 'P') s.pts.forEach(p => add(p[0], p[1]));
      else if (s.t === 'C') { add(s.cx - s.r, s.cy - s.r); add(s.cx + s.r, s.cy + s.r); }
      else {
        const e = arcEnds(s); add(e.x0, e.y0); add(e.x1, e.y1);
        const from = s.ccw ? s.a0 : s.a1, sweep = arcSweep(s);
        for (let q = 0; q < 360; q += 90) {
          const d = (((q - from) % 360) + 360) % 360;
          if (d <= sweep) add(s.cx + s.r * Math.cos(rad(q)), s.cy + s.r * Math.sin(rad(q)));
        }
      }
    }
  }
  for (const t of result.texts || []) add(t.x, t.y);
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : { minX: 0, minY: 0, maxX: 100, maxY: 100 };
}

function el(name, attrs = {}, parent) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

// svg: the <svg> element. onHover(contour | null) reports the contour under the pointer.
export function createDrawing(svg, { onHover = () => {} } = {}) {
  let vb = { x: 0, y: -100, w: 100, h: 100 }, fitBox = vb, result = null;
  const layer = el('g', { class: 'lc-geo' }, svg);
  const marks = el('g', { class: 'lc-marks' }, svg);

  function apply() {
    svg.setAttribute('viewBox', `${f(vb.x)} ${f(vb.y)} ${f(vb.w)} ${f(vb.h)}`);
    const px = svg.clientWidth || 600;
    const k = Math.max(vb.w / px, vb.h / (svg.clientHeight || 400));
    marks.querySelectorAll('circle').forEach(c => c.setAttribute('r', f(5 * k)));
  }

  function fit() {
    if (!result) return;
    const b = boundsOf(result);
    const w = Math.max(b.maxX - b.minX, 1e-3), h = Math.max(b.maxY - b.minY, 1e-3), pad = Math.max(w, h) * 0.05;
    fitBox = { x: b.minX - pad, y: -b.maxY - pad, w: w + 2 * pad, h: h + 2 * pad };
    vb = { ...fitBox };
    apply();
  }

  function show(r) {
    result = r;
    layer.replaceChildren(); marks.replaceChildren();
    for (const c of r.contours || []) {
      const cls = `lc-c lc-${c.role}` + (c.role === 'cut' && !c.closed ? ' lc-open' : '');
      const p = el('path', { d: contourPath(c), class: cls, 'data-id': String(c.id) }, layer);
      p.addEventListener('pointerenter', () => onHover(c));
      p.addEventListener('pointerleave', () => onHover(null));
    }
    for (const t of r.texts || []) {
      const tx = el('text', { x: f(t.x), y: f(-t.y), 'font-size': f(t.h || 2.5), class: 'lc-text',
        transform: t.rot ? `rotate(${f(-t.rot)} ${f(t.x)} ${f(-t.y)})` : '' }, layer);
      tx.textContent = t.value;
    }
    for (const m of r.markers || []) el('circle', { cx: f(m.x), cy: f(-m.y), r: '1', class: `lc-m lc-m-${m.kind}` }, marks);
    fit();
  }

  // Wheel zooms about the pointer; dragging pans.
  svg.addEventListener('wheel', e => {
    if (!result) return;
    e.preventDefault();
    const r = svg.getBoundingClientRect();
    const k = e.deltaY > 0 ? 1.2 : 1 / 1.2;
    const mx = vb.x + ((e.clientX - r.left) / r.width) * vb.w, my = vb.y + ((e.clientY - r.top) / r.height) * vb.h;
    vb = { x: mx - (mx - vb.x) * k, y: my - (my - vb.y) * k, w: vb.w * k, h: vb.h * k };
    apply();
  }, { passive: false });
  let drag = null;
  svg.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, vb: { ...vb } }; });
  window.addEventListener('pointerup', () => { drag = null; });
  svg.addEventListener('pointermove', e => {
    if (!drag || !(e.buttons & 1)) return;
    const r = svg.getBoundingClientRect();
    vb = { ...drag.vb, x: drag.vb.x - ((e.clientX - drag.x) / r.width) * drag.vb.w, y: drag.vb.y - ((e.clientY - drag.y) / r.height) * drag.vb.h };
    apply();
  });

  return {
    show,
    fit,
    clear() { result = null; layer.replaceChildren(); marks.replaceChildren(); },
    zoomBy(k) { const cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2; vb = { x: cx - (vb.w * k) / 2, y: cy - (vb.h * k) / 2, w: vb.w * k, h: vb.h * k }; apply(); },
    highlight(id) { layer.querySelectorAll('.lc-c').forEach(p => p.classList.toggle('is-hi', p.getAttribute('data-id') === String(id))); },
  };
}
```

<!-- file: _docs/laser-checker/speed-defaults.md -->
```markdown
# Default cutting speeds and pierce times

Researched 2026-09-27 for the laser DXF check (spec §8). `js/laser/pricing.js` holds exactly these rows; change both together.

## How to read this

These are typical values for a **3 kW fiber laser** cutting job-shop-grade sheet metal, gathered from public cutting-speed charts and machine-builder guides (no single laser brand's chart is reproduced here — only the numbers actually used, with their source). The gas shown is the one a job shop would normally run at that thickness: nitrogen or air on thin material for speed and edge quality, switching to oxygen on mild/galvanised steel above about 2 mm for cost (oxygen is far cheaper than nitrogen, even though nitrogen would cut a bit faster). Where two or more sources disagreed, the slower, more conservative figure was kept — a safer basis for a time/cost estimate than the fastest number a marketing chart shows. The tool labels these rows "typical values: set your machine's" and any numbers a shop enters for its own machine override these defaults in the browser.

Every thickness required by the tool (0.5, 1, 2, 3, 5, 8, 10, 15, 20 mm) has a row even where a 3 kW laser cannot realistically cut that material at that thickness (e.g. copper/brass above ~6-8 mm, stainless/aluminium above ~10-12 mm). Those rows are clearly marked **UNVERIFIED (extrapolated)** — they exist only so the tool always has a number to show, not because the cut is production-viable.

## Steel (mild/carbon)

Gas: N2/air up to 2 mm, oxygen from 3 mm up (job-shop practice; N2 could cut faster at 3 mm but is rarely used there for cost).

| Thickness (mm) | Cutting speed (mm/min) | Pierce time (s) | Source / status |
|---|---|---|---|
| 0.5 | 30000 | 0.1 | UNVERIFIED — interpolated above the 1 mm figure; no source publishes 0.5 mm mild steel, thin-gauge speed is capped by machine axis speed rather than laser power |
| 1 | 28000 | 0.15 | Sourced — artizono.com (N2/air, 28-35 m/min) and istarmachining.com (air, 25-30 m/min) agree closely; laserspechub.com shows 35 m/min (marketing-optimistic, not used) |
| 2 | 16000 | 0.25 | Sourced — artizono.com (N2/air, 16-20 m/min) and laserspechub.com (~20 m/min) agree; conservative low end taken |
| 3 | 4500 | 0.4 | Sourced, sources disagree — artizono.com gives O2 at 3.8-4.2 m/min; istarmachining.com and laserspechub.com give air/O2 at 7-10 m/min. Took the slower O2 figure as the safer, cost-typical shop choice |
| 5 | 3000 | 0.7 | Sourced — artizono.com O2 2.7-3.0 m/min, within adhmt.com's 4-8 mm O2 range (1.2-5 m/min) |
| 8 | 1900 | 1.3 | Sourced — artizono.com O2 1.8-2.2 m/min, consistent with istarmachining.com and adhmt.com ranges |
| 10 | 1300 | 2.0 | Sourced — artizono.com O2 1.0-1.3 m/min, istarmachining.com 1.0-1.5 m/min, adhmt.com range midpoint |
| 15 | 750 | 3.5 | Sourced — laserspechub.com 0.8 m/min, adhmt.com 10-16 mm range midpoint ~0.85 m/min, istarmachining.com interpolated ~0.6-0.7 m/min |
| 20 | 450 | 5.5 | Sourced — laserspechub.com 0.4 m/min, adhmt.com ~0.3 m/min, istarmachining.com 0.5-0.6 m/min; conservative middle taken |

Pierce times: no source gave a thickness-matched pierce-time table for a 3 kW machine specifically. All pierce times above are **UNVERIFIED typical-practice estimates**, based on general guidance found (paramountmachinery.ca, arcuscnc.com, laserspechub.com "thick plate cutting" guide): roughly 0.3-0.8 s for 1-3 mm, 1.0-2.5 s for 6-20 mm, with multi-second pulsed piercing on the thickest plate.

## Stainless steel (N2)

| Thickness (mm) | Cutting speed (mm/min) | Pierce time (s) | Source / status |
|---|---|---|---|
| 0.5 | 34000 | 0.1 | UNVERIFIED — interpolated above the 1 mm figure, no direct 0.5 mm source |
| 1 | 27000 | 0.15 | Sourced — istarmachining.com N2 20-25 m/min, artizono.com N2 31-38.5 m/min; conservative middle taken |
| 2 | 13000 | 0.3 | Sourced — artizono.com N2 10-16.5 m/min, midpoint ~13.25 m/min |
| 3 | 6500 | 0.5 | Sourced — artizono.com N2 7-10 m/min, istarmachining.com N2 5-7 m/min; conservative middle-low taken |
| 5 | 2200 | 0.9 | Sourced, sources disagree — artizono.com N2 1.8-2.45 m/min vs adhmt.com's wider 4-6 mm range (2-7 m/min); took the lower, more specific figure |
| 8 | 1000 | 1.6 | Sourced — artizono.com N2 1.2-2.0 m/min, istarmachining.com 0.8-1.0 m/min, adhmt.com 8-10 mm range midpoint; converge near 1000 |
| 10 | 700 | 2.3 | Sourced — artizono.com N2 0.7-1.0 m/min, istarmachining.com 0.6-0.7 m/min; conservative middle |
| 15 | 250 | 4.5 | UNVERIFIED (extrapolated) — multiple sources put practical 3 kW stainless capability at ~10-12 mm max; 15 mm figure extrapolated downward from the 10 mm value |
| 20 | 120 | 7.0 | UNVERIFIED (extrapolated) — well beyond realistic 3 kW stainless cutting; figure exists only to fill the tool's row |

## Aluminium (N2)

| Thickness (mm) | Cutting speed (mm/min) | Pierce time (s) | Source / status |
|---|---|---|---|
| 0.5 | 35000 | 0.1 | UNVERIFIED — interpolated above the 1 mm figure, no direct 0.5 mm source |
| 1 | 20000 | 0.15 | Sourced, sources disagree — istarmachining.com N2 18-22 m/min, artizono.com N2 25-40 m/min, gyclaser.com only 8-12 m/min. Took istarmachining.com's middle figure as the conservative choice |
| 2 | 10000 | 0.3 | Sourced — artizono.com N2 10-20 m/min and gyclaser.com 4-6 m/min bracket this; adhmt.com's 1-3 mm range (5-30 m/min) is consistent |
| 3 | 5000 | 0.5 | Sourced — istarmachining.com N2 4-6 m/min, artizono.com 5-6.6 m/min; gyclaser.com lower at 2-3.5 m/min not used (outlier) |
| 5 | 2000 | 0.9 | Sourced — artizono.com N2 2-2.65 m/min |
| 8 | 800 | 1.6 | Sourced — istarmachining.com N2 0.7-0.9 m/min |
| 10 | 450 | 2.3 | Sourced — artizono.com N2 0.3-0.45 m/min, istarmachining.com 0.5-0.6 m/min; conservative middle |
| 15 | 180 | 4.5 | UNVERIFIED (extrapolated) — sources put practical 3 kW aluminium capability at roughly 10-12 mm max due to reflectivity/conductivity; extrapolated downward |
| 20 | 90 | 7.0 | UNVERIFIED (extrapolated) — well beyond realistic 3 kW aluminium cutting |

## Galvanised steel (estimated from mild steel)

No 3 kW manufacturer chart for galvanised steel was found in this search — every row below is **UNVERIFIED**, estimated as the mild-steel figures above reduced by roughly 10-15% (same gas pattern: N2/air thin, O2 from 3 mm), reflecting the extra energy/slower feed job shops typically use to burn off the zinc coating cleanly and avoid zinc-oxide fuming.

| Thickness (mm) | Cutting speed (mm/min) | Pierce time (s) | Source / status |
|---|---|---|---|
| 0.5 | 27000 | 0.15 | UNVERIFIED — estimated at ~90% of the mild-steel N2/air value |
| 1 | 25000 | 0.2 | UNVERIFIED — estimated at ~90% of the mild-steel N2/air value |
| 2 | 13500 | 0.3 | UNVERIFIED — estimated at ~85% of the mild-steel N2/air value |
| 3 | 3800 | 0.5 | UNVERIFIED — estimated at ~85% of the mild-steel O2 value |
| 5 | 2550 | 0.9 | UNVERIFIED — estimated at ~85% of the mild-steel O2 value |
| 8 | 1600 | 1.6 | UNVERIFIED — estimated at ~85% of the mild-steel O2 value |
| 10 | 1100 | 2.3 | UNVERIFIED — estimated at ~85% of the mild-steel O2 value |
| 15 | 640 | 4.0 | UNVERIFIED — estimated at ~85% of the mild-steel O2 value |
| 20 | 380 | 6.5 | UNVERIFIED — estimated at ~85% of the mild-steel O2 value |

## Copper (N2)

Public 3 kW charts for copper are scarce; most manufacturer charts show copper cutting starting at 4-6 kW because copper's high reflectivity/conductivity is hard on a 3 kW source. One data point found: a fiber laser (power not clearly stated, ~3-6 kW class) cutting 6 mm copper at about 1.3 m/min (1300 mm/min) — used only as a rough sanity check, not a direct source for any single row below.

| Thickness (mm) | Cutting speed (mm/min) | Pierce time (s) | Source / status |
|---|---|---|---|
| 0.5 | 16000 | 0.2 | UNVERIFIED (extrapolated) — no source for thin copper at 3 kW specifically |
| 1 | 10000 | 0.3 | UNVERIFIED (extrapolated) — general copper speed-range claims (0.1-65 m/min across 1-80 mm and many powers) too broad to anchor a single figure |
| 2 | 3500 | 0.5 | UNVERIFIED (extrapolated) |
| 3 | 2200 | 0.8 | UNVERIFIED, loosely supported — consistent with general copper speed-range claims for this thickness band |
| 5 | 1000 | 1.4 | UNVERIFIED, loosely supported by the ~1.3 m/min at 6 mm data point noted above |
| 8 | 250 | 3.0 | UNVERIFIED (extrapolated) — beyond the ~5-6 mm practical limit most sources give for copper at 3 kW; row exists only to fill the tool's grid |
| 10 | 150 | 4.5 | UNVERIFIED (extrapolated) — beyond practical 3 kW copper capability |
| 15 | 70 | 7.0 | UNVERIFIED (extrapolated) — beyond practical 3 kW copper capability |
| 20 | 40 | 9.0 | UNVERIFIED (extrapolated) — beyond practical 3 kW copper capability |

## Brass (N2)

| Thickness (mm) | Cutting speed (mm/min) | Pierce time (s) | Source / status |
|---|---|---|---|
| 0.5 | 29000 | 0.2 | UNVERIFIED (extrapolated) — above the sourced 1 mm figure, no direct 0.5 mm source |
| 1 | 25000 | 0.3 | Sourced — artizono.com N2 20-31 m/min, midpoint ~25.5 m/min |
| 2 | 10000 | 0.5 | Sourced — artizono.com N2 7-13.2 m/min, midpoint ~10.1 m/min |
| 3 | 6000 | 0.8 | Sourced — artizono.com N2 5-7.2 m/min, midpoint ~6.1 m/min |
| 5 | 1300 | 1.4 | Sourced — artizono.com N2 1-1.65 m/min, midpoint ~1.3 m/min |
| 8 | 400 | 2.8 | Sourced — artizono.com N2 0.3-0.45 m/min, midpoint ~0.375 m/min |
| 10 | 220 | 4.2 | UNVERIFIED (extrapolated) — artizono.com's table stops at 8 mm; most sources put practical 3 kW brass capability at ~6-8 mm max |
| 15 | 100 | 6.5 | UNVERIFIED (extrapolated) — beyond practical 3 kW brass capability |
| 20 | 60 | 9.0 | UNVERIFIED (extrapolated) — beyond practical 3 kW brass capability |

## Marking speed

**10000 mm/min** for all materials — **UNVERIFIED, typical-practice estimate**. No manufacturer publishes a "marking speed" figure for the low-power mark pass on a cutting-head machine specifically. Dedicated fiber marking/engraving machines (small galvo-scanner heads, much lower power) run far faster — commonly 500-2000 mm/s, with high-speed setups at 3000-10000+ mm/s (sources: stylecnc.com, heatsign.com) — but that figure describes a galvo mirror scanning a small field, not a gantry-mounted cutting head moving its whole beam-delivery carriage, which is limited by machine axis dynamics rather than laser/optics speed. A few-thousand-to-low-tens-of-thousands mm/min mark-pass speed is consistent with typical CAM/nesting-software defaults for cutting machines, so the tool uses 10000 mm/min.

## DWG format written by current AutoCAD

**AutoCAD 2025, 2026 and 2027 all still write the "AutoCAD 2018" DWG format (internal version code AC1032) — no new DWG format has been introduced since AutoCAD 2018.** The laser check reads DWG from R14 up to this format, so files saved by current AutoCAD releases open.

Sources:
- en.wikipedia.org/wiki/.dwg — version table lists AC1032 as the DWG format code covering AutoCAD 2018 through the current release, with no newer internal DWG version code listed.
- Search results referencing autodesk.com/blogs/autocad/autocad-2027/, architosh.com's April-2026 AutoCAD 2027 coverage, and cadpilot.com's AutoCAD 2027 release article: consistently state there is no DWG file-format change in the 2027 release, and that the format remains the AutoCAD 2018 (AC1032) format. (The Autodesk support pages autodesk.com/.../Compatibility-with-previous-AutoCAD-dwg-releases.html and .../AutoCAD-drawing-file-format.html, Autodesk's own canonical pages on this topic, returned HTTP 403 to automated fetch in this session and could not be quoted directly — their titles/summaries were visible in search results and are consistent with the above, but should be spot-checked manually if a fully first-party citation is needed.)

## Sources

1. artizono.com/fiber-laser-cutting-thickness-speed-chart/ — 3 kW cutting-speed table used for mild steel (N2/air thin, O2 thick), stainless steel (N2), aluminium (N2) and brass (N2) rows across most thicknesses.
2. istarmachining.com/fiber-laser-cutting-speed-thickness-chart-guide/ — 3000 W table used as a cross-check for mild steel, stainless steel and aluminium.
3. adhmt.com/how-to-set-3000w-laser-cutting-parameters-for-speed-gas-and-thickness/ — "3000W Baseline Reference Ranges" used as a cross-check/range for mild steel, stainless steel and aluminium.
4. laserspechub.com/guides/cutting-speed-chart — used as a cross-check (and upper-bound/marketing comparison) for mild steel at 1-20 mm.
5. gyclaser.com/2024/03/07/fiber-laser-cutting-speed-chart/ — used as a lower-bound cross-check for aluminium; general 3000W nitrogen/air speed range statement (28-35 m/min) and general copper/brass thickness-limit commentary.
6. General web-search summaries (queries: "copper laser cutting speed mm/min fiber laser…", "fiber laser cutting speed chart copper brass 3000W…") aggregating krrass.com, stylecnc.com and similar manufacturer-blog claims — used only as loose, UNVERIFIED sanity checks for copper/brass, not as a primary source for any single row.
7. paramountmachinery.ca (via search: "How Fiber Laser Power Affects Piercing Time") and arcuscnc.com ("Optimizing Laser Piercing Parameters for Thick Plate Cutting") and laserspechub.com/guides/thick-plate-cutting — general pierce-time-by-thickness guidance (0.3-0.8 s thin, 1.0-2.5 s mid/thick, multi-second pulsed piercing on very thick plate), used for all materials' pierce-time column, all marked UNVERIFIED as no thickness-matched pierce table for a 3 kW machine specifically was found.
8. stylecnc.com/blog/laser-engraving-speed-and-power-settings-chart.html and heatsign.com ("How fast do modern laser engravers operate today") — general fiber marking/engraving speed ranges, used only as background for the marking-speed note (background only: these describe a different machine class).
9. en.wikipedia.org/wiki/.dwg — DWG format version table, used for the DWG-format answer.
10. Search results citing autodesk.com/blogs/autocad/autocad-2027/, architosh.com and cadpilot.com AutoCAD 2027 coverage — used to confirm no DWG format change in AutoCAD 2027.
```

Run: `for f in js/laser/pricing.js js/laser/zip.js js/laser/drawing.js _docs/laser-checker/speed-defaults.md; do node _tests/extract.mjs <brief> $f; done`

- [ ] **Step 3: Run the tests**

Run: `node --test "_tests/laser/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 15`, `ℹ fail 0`.

- [ ] **Step 4: Commit**

```bash
git add js/laser/pricing.js js/laser/zip.js js/laser/drawing.js _tests/laser/*.test.js _docs/laser-checker/speed-defaults.md
git commit -F - <<'EOF'
Laser DXF check: pricing, ZIP writer, SVG paths and researched speed defaults

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 9: The worker bridge

**Files:**
- Create: `js/laser/bridge.js`, `_tests/laser/bridge.test.js`

**Interfaces:**
- Consumes: the worker's messages (Task 6).
- Produces: `createEngine({makeWorker, onBootProgress, onReady, timeoutMs = 30000})`, which returns:
  - `process(name, bytes, settings) → Promise<result | error>`. It never rejects: a timeout resolves `{type:'error', reason:'timeout'}`, and a worker crash resolves `reason:'engine'`.
  - `boot()`, `ready`, `pending` and `dispose()`.

  Files run one at a time, in order. After a timeout or a crash, the worker is restarted for the next file.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/laser/bridge.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../../js/laser/bridge.js';

// A stand-in for the engine worker: answers 'ready' once, then 'progress' and a result per file.
// A file named hang.dxf never answers; crash.dxf raises a worker error.
function fakeWorkers() {
  const made = [];
  const makeWorker = () => {
    const w = {
      terminated: false, booted: false, onmessage: null, onerror: null,
      post(m) { setTimeout(() => { if (!w.terminated) w.onmessage({ data: m }); }, 0); },
      postMessage(m) {
        if (!w.booted) { w.booted = true; w.post({ type: 'ready' }); }
        if (m.type !== 'process') return;
        if (m.name === 'hang.dxf') return;
        if (m.name === 'crash.dxf') { setTimeout(() => w.onerror({ message: 'boom', preventDefault() {} }), 0); return; }
        w.post({ type: 'progress', id: m.id, stage: 'processing' });
        w.post({ type: 'result', id: m.id, name: m.name });
      },
      terminate() { w.terminated = true; },
    };
    made.push(w);
    return w;
  };
  return { made, makeWorker };
}

test('files come back in order, progress messages are not answers', async () => {
  const { made, makeWorker } = fakeWorkers();
  let readyCalls = 0;
  const engine = createEngine({ makeWorker, onReady: () => readyCalls++ });
  const [a, b] = await Promise.all([engine.process('a.dxf', new ArrayBuffer(1)), engine.process('b.dxf', new ArrayBuffer(1))]);
  assert.equal(a.type, 'result'); assert.equal(a.name, 'a.dxf');
  assert.equal(b.type, 'result'); assert.equal(b.name, 'b.dxf');
  assert.equal(made.length, 1);
  assert.equal(readyCalls, 1);
  assert.equal(engine.ready, true);
  assert.equal(engine.pending, 0);
  engine.dispose();
});

test('a file over the timeout gets an error and the next file still works', async () => {
  const { made, makeWorker } = fakeWorkers();
  const engine = createEngine({ makeWorker, timeoutMs: 50 });
  await engine.process('warm.dxf', new ArrayBuffer(1));
  const [hung, next] = await Promise.all([engine.process('hang.dxf', new ArrayBuffer(1)), engine.process('c.dxf', new ArrayBuffer(1))]);
  assert.equal(hung.type, 'error'); assert.equal(hung.reason, 'timeout'); assert.equal(hung.name, 'hang.dxf');
  assert.equal(next.type, 'result'); assert.equal(next.name, 'c.dxf');
  assert.equal(made.length, 2);
  assert.equal(made[0].terminated, true);
  engine.dispose();
});

test('a worker crash gets an error and the next file still works', async () => {
  const { made, makeWorker } = fakeWorkers();
  const engine = createEngine({ makeWorker });
  const [crashed, next] = await Promise.all([engine.process('crash.dxf', new ArrayBuffer(1)), engine.process('d.dxf', new ArrayBuffer(1))]);
  assert.equal(crashed.type, 'error'); assert.equal(crashed.reason, 'engine'); assert.equal(crashed.message, 'boom');
  assert.equal(next.type, 'result'); assert.equal(next.name, 'd.dxf');
  assert.equal(made.length, 2);
  engine.dispose();
});
```

Run: `node _tests/extract.mjs <brief> _tests/laser/bridge.test.js && node --test "_tests/laser/bridge.test.js" 2>&1 | grep -m1 -o "Cannot find module '[^']*'"`
Expected: `Cannot find module '…jslaserridge.js'`.

- [ ] **Step 2: Write the bridge**

<!-- file: js/laser/bridge.js -->
```js
// Laser DXF check: the page's side of the engine worker (spec §3, §12). Files are processed one at a
// time, in order. A file that takes longer than the timeout, or crashes the worker, gets an error
// result and the worker is restarted for the next file. makeWorker is injectable for the Node tests.
export const TIMEOUT_MS = 30000;

export function createEngine({
  makeWorker = () => new Worker(new URL('./worker.js?v=20261015', import.meta.url), { type: 'module' }),
  onBootProgress = () => {},
  onReady = () => {},
  timeoutMs = TIMEOUT_MS,
} = {}) {
  let worker = null, ready = false, nextId = 0, busy = null;
  const queue = [];

  function start() {
    worker = makeWorker();
    worker.onmessage = e => {
      const m = e.data;
      if (m.type === 'boot-progress') { onBootProgress(m.pct); return; }
      if (m.type === 'ready') { if (!ready) { ready = true; onReady(); } arm(); return; }
      if (m.type === 'progress') return;                               // not an answer: keep waiting
      if (busy && m.id === busy.id) finish(m);
    };
    worker.onerror = e => {
      if (e && e.preventDefault) e.preventDefault();
      if (busy) fail(busy, 'engine', (e && e.message) || 'worker error');
      else restart();
    };
  }

  function restart() {
    try { if (worker) worker.terminate(); } catch (e) { /* already gone */ }
    worker = null;
    start();
  }

  function finish(m) {
    const job = busy;
    busy = null;
    clearTimeout(job.timer);
    job.resolve(m);
    pump();
  }

  function fail(job, reason, message) {
    restart();
    finish({ type: 'error', id: job.id, name: job.name, reason, message });
  }

  // The timeout starts once the engine is ready: the first file also waits for its download.
  function arm() {
    if (busy && !busy.timer) busy.timer = setTimeout(() => { if (busy) fail(busy, 'timeout', `over ${timeoutMs / 1000} s`); }, timeoutMs);
  }

  function pump() {
    if (busy || !queue.length) return;
    if (!worker) start();
    busy = queue.shift();
    if (ready) arm();
    worker.postMessage({ type: 'process', id: busy.id, name: busy.name, bytes: busy.bytes, settings: busy.settings }, [busy.bytes]);
  }

  return {
    // Resolves with the engine's result or error message (never rejects).
    process(name, bytes, settings = {}) {
      return new Promise(resolve => {
        queue.push({ id: ++nextId, name, bytes, settings, resolve, timer: null });
        pump();
      });
    },
    // Starts the engine download without a file, e.g. when the example order is requested.
    boot() { if (!worker) start(); worker.postMessage({ type: 'boot' }); },
    get ready() { return ready; },
    get pending() { return queue.length + (busy ? 1 : 0); },
    dispose() { try { if (worker) worker.terminate(); } catch (e) { /* ignore */ } worker = null; },
  };
}
```

Run: `node _tests/extract.mjs <brief> js/laser/bridge.js`

- [ ] **Step 3: Run the tests**

Run: `node --test "_tests/laser/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 18`, `ℹ fail 0`.

- [ ] **Step 4: Commit**

```bash
git add js/laser/bridge.js _tests/laser/bridge.test.js
git commit -F - <<'EOF'
Laser DXF check: worker bridge with queue, timeout and restart

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 10: The tool's strings (GR/EN/IT)

**Files:**
- Create: `js/laser/i18n-laser.js`, `_tests/laser/i18n.test.js`

**Interfaces:**
- Consumes: the check ids in `Processor.cs` (Task 4).
- Produces:
  - `window.LC_I18N = { el, en, it }`, a classic script with about 110 `lc.*` keys each.
  - `lc.check.<id>` for every engine check, plus `read-error`, `read-version`, `too-large` and `clamped`.
  - Placeholders are `{name}`. The page (Task 11) merges its own keys on top into `window.GV_I18N`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/laser/i18n.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const ph = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');

// The tool's strings file, evaluated the way the browser does.
function toolStrings() {
  const window = {};
  vm.runInNewContext(read('../../js/laser/i18n-laser.js'), { window });
  return window.LC_I18N;
}

// Every id the engine can report, the page's own read errors, and the speed-table note.
const CHECK_IDS = ['read-error', 'read-version', 'too-large', 'block-empty', 'block-array', 'empty-cut', 'open-path', 'branch',
  'self-intersect', 'dashed-on-cut', 'not-flat', 'units-assumed', 'units-inch', 'gaps-closed', 'duplicates-removed',
  'tiny-removed', 'text-kept', 'ignored-entities', 'multi-part', 'clamped'];

test('tool strings: only lc.* keys, the same keys and placeholders in el, en and it', () => {
  const tool = toolStrings();
  const en = Object.keys(tool.en).sort();
  assert.ok(en.length >= 100, `${en.length} keys`);
  assert.ok(en.every(k => k.startsWith('lc.')));
  assert.deepEqual(Object.keys(tool.el).sort(), en);
  assert.deepEqual(Object.keys(tool.it).sort(), en);
  assert.equal(ph(tool.en['lc.check.open-path']), 'count,length');     // the check itself works
  for (const k of en) {
    assert.equal(ph(tool.el[k]), ph(tool.en[k]), `el ${k}`);
    assert.equal(ph(tool.it[k]), ph(tool.en[k]), `it ${k}`);
  }
});

test('every check id has a string, including every id the engine source adds', () => {
  const tool = toolStrings();
  for (const id of CHECK_IDS) for (const l of ['el', 'en', 'it']) assert.ok(`lc.check.${id}` in tool[l], `${l} missing lc.check.${id}`);
  const engine = read('../../_src/laser-engine/Engine/Processor.cs');
  const ids = [...engine.matchAll(/Add\("([a-z-]+)"/g)].map(m => m[1]);
  assert.ok(ids.length >= 15, `${ids.length} ids in Processor.cs`);
  for (const id of ids) assert.ok(CHECK_IDS.includes(id), `${id} is not listed here`);
});
```

Run: `node _tests/extract.mjs <brief> _tests/laser/i18n.test.js && node --test "_tests/laser/i18n.test.js" 2>&1 | grep -m1 ENOENT`
Expected: `ENOENT` naming `js/laser/i18n-laser.js`.

- [ ] **Step 2: Write the strings**

<!-- file: js/laser/i18n-laser.js -->
```js
// Laser DXF check strings (GR/EN/IT). The page merges them under its own inline keys into window.GV_I18N,
// which the shared shell's t() reads. Placeholders are {name}; every language has the same keys and placeholders.
window.LC_I18N = {
  el: {
    "lc.eyebrow": "Δωρεάν εργαλείο",
    "lc.privacy": "Τα αρχεία σας δεν φεύγουν ποτέ από τον υπολογιστή σας.",
    "lc.cross": "Όλα τα δωρεάν εργαλεία →",
    "lc.open": "Άνοιγμα αρχείων",
    "lc.example": "Φόρτωση παραδείγματος",
    "lc.drop": "Σύρετε εδώ αρχεία DXF ή DWG, ή πατήστε «Άνοιγμα αρχείων».",
    "lc.engine.loading": "Φόρτωση της μηχανής γεωμετρίας, περίπου 12 MB, μόνο την πρώτη φορά… {pct} %",
    "lc.engine.failed": "Η μηχανή γεωμετρίας δεν ξεκίνησε σε αυτόν τον browser.",
    "lc.engine.retry": "Δοκιμάστε ξανά",
    "lc.engine.nowasm": "Ο browser σας δεν υποστηρίζει WebAssembly, που χρειάζεται το εργαλείο. Δοκιμάστε μια πρόσφατη έκδοση Chrome, Edge, Firefox ή Safari.",
    "lc.toomany": "Έως {max} αρχεία ανά παραγγελία· τα υπόλοιπα δεν φορτώθηκαν.",
    "lc.col.file": "Αρχείο",
    "lc.col.parts": "Τεμάχια",
    "lc.col.status": "Κατάσταση",
    "lc.col.cut": "Μήκος κοπής",
    "lc.col.pierces": "Διατρήσεις",
    "lc.col.area": "Καθαρό εμβαδό",
    "lc.col.weight": "Βάρος",
    "lc.col.time": "Χρόνος",
    "lc.col.qty": "Ποσότητα",
    "lc.col.material": "Υλικό",
    "lc.col.thickness": "Πάχος (mm)",
    "lc.col.dxf": "DXF",
    "lc.total": "Σύνολο παραγγελίας",
    "lc.waiting": "σε αναμονή…",
    "lc.processing": "επεξεργασία…",
    "lc.download": "Λήψη",
    "lc.zip": "Λήψη όλων (ZIP)",
    "lc.print": "Εκτύπωση αναφοράς",
    "lc.clear": "Καθαρισμός",
    "lc.remove": "Αφαίρεση αρχείου",
    "lc.status.ok": "Έτοιμο",
    "lc.status.warn": "Με διορθώσεις ή προειδοποιήσεις",
    "lc.status.error": "Χρειάζεται διόρθωση",
    "lc.incomplete": "«≥»: ένα ή περισσότερα αρχεία έχουν ανοιχτές διαδρομές ή δεν διαβάστηκαν, οπότε τα σύνολα είναι ελάχιστα.",
    "lc.mat.steel": "Χάλυβας",
    "lc.mat.stainless": "Ανοξείδωτος",
    "lc.mat.aluminium": "Αλουμίνιο",
    "lc.mat.galvanised": "Γαλβανιζέ",
    "lc.mat.copper": "Χαλκός",
    "lc.mat.brass": "Ορείχαλκος",
    "lc.role.cut": "Κοπή",
    "lc.role.mark": "Χάραξη",
    "lc.role.bend": "Κάμψη",
    "lc.role.ignore": "Αγνόηση",
    "lc.roles.title": "Επίπεδα και ρόλοι",
    "lc.roles.layer": "Επίπεδο",
    "lc.roles.color": "Χρώμα",
    "lc.roles.linetype": "Τύπος γραμμής",
    "lc.roles.curves": "Καμπύλες",
    "lc.roles.role": "Ρόλος",
    "lc.drawing": "Σχέδιο",
    "lc.fit": "Προσαρμογή",
    "lc.zoomin": "Μεγέθυνση",
    "lc.zoomout": "Σμίκρυνση",
    "lc.pick": "Επιλέξτε ένα αρχείο από τον πίνακα για να δείτε το σχέδιό του.",
    "lc.hover": "{kind} · μήκος {len} mm",
    "lc.kind.outer": "Εξωτερικό περίγραμμα",
    "lc.kind.hole": "Οπή",
    "lc.kind.open": "Ανοιχτή διαδρομή",
    "lc.kind.mark": "Χάραξη",
    "lc.kind.bend": "Γραμμή κάμψης",
    "lc.kind.ignore": "Αγνοείται",
    "lc.l.cut": "Κοπή",
    "lc.l.mark": "Χάραξη",
    "lc.l.bend": "Κάμψη",
    "lc.l.ignore": "Αγνοείται",
    "lc.l.open": "Ανοιχτά άκρα",
    "lc.l.gap": "Κλεισμένα κενά",
    "lc.checks": "Έλεγχοι",
    "lc.none": "Κανένα πρόβλημα.",
    "lc.check.read-error": "Το αρχείο δεν διαβάστηκε ({message}).",
    "lc.check.read-version": "Αυτή η έκδοση DWG δεν διαβάζεται. Αποθηκεύστε το ως DWG 2018 ή ως DXF.",
    "lc.check.too-large": "Το αρχείο ξεπερνά τα όρια του εργαλείου ({message}).",
    "lc.check.block-empty": "Τα μπλοκ {blocks} ήρθαν χωρίς γεωμετρία (όριο των παλιών αρχείων R12). Αποθηκεύστε το αρχείο ως DXF 2004 ή νεότερο, ή ως DWG.",
    "lc.check.block-array": "Τα μπλοκ {blocks} περιέχουν πίνακα μπλοκ (MINSERT), που διαβάστηκε μία φορά. Κάντε explode στον πίνακα στο CAD και αποθηκεύστε ξανά.",
    "lc.check.empty-cut": "Δεν υπάρχει τίποτα για κοπή.",
    "lc.check.open-path": "Ανοιχτές διαδρομές στην κοπή: {count} ({length} mm)· θέλουν διευκρίνιση από τον πελάτη.",
    "lc.check.branch": "Σημεία όπου συναντώνται τρεις ή περισσότερες γραμμές: {count}· εκεί η διαδρομή κοπής δεν είναι σαφής.",
    "lc.check.self-intersect": "Περιγράμματα που τέμνουν τον εαυτό τους: {count}.",
    "lc.check.dashed-on-cut": "Διακεκομμένες γραμμές στην κοπή (επίπεδα {layers}): ελέγξτε αν είναι γραμμές κάμψης ή άξονες.",
    "lc.check.not-flat": "Η γεωμετρία δεν είναι επίπεδη· προβλήθηκε στο επίπεδο XY.",
    "lc.check.units-assumed": "Το αρχείο δεν δηλώνει μονάδες· θεωρήθηκαν χιλιοστά.",
    "lc.check.units-inch": "Μετατράπηκε από ίντσες σε χιλιοστά.",
    "lc.check.gaps-closed": "Κενά που κλείστηκαν: {count} (το μεγαλύτερο {max} mm).",
    "lc.check.duplicates-removed": "Διπλές γραμμές που αφαιρέθηκαν: {count} ({length} mm που θα κόβονταν δύο φορές).",
    "lc.check.tiny-removed": "Πολύ μικρά κομμάτια που αφαιρέθηκαν: {count}.",
    "lc.check.text-kept": "Κείμενα στο επίπεδο TEXT (δεν κόβονται): {count}.",
    "lc.check.ignored-entities": "Παραλείφθηκαν: {hatch} διαγραμμίσεις, {dim} διαστάσεις, {leader} οδηγοί, {point} σημεία, {other} άλλα.",
    "lc.check.multi-part": "Τεμάχια στο αρχείο: {count}· η ποσότητα πολλαπλασιάζει όλο το αρχείο.",
    "lc.check.clamped": "Το πάχος είναι εκτός του πίνακα ταχυτήτων· χρησιμοποιήθηκε η πλησιέστερη γραμμή.",
    "lc.set.title": "Ρυθμίσεις",
    "lc.set.units": "Μονάδες για αρχεία που δεν τις δηλώνουν",
    "lc.set.units.auto": "Αυτόματα (χιλιοστά)",
    "lc.set.units.mm": "Χιλιοστά",
    "lc.set.units.inch": "Ίντσες",
    "lc.set.join": "Ανοχή ένωσης (mm)",
    "lc.set.gap": "Ανοχή κλεισίματος κενών (mm)",
    "lc.set.material": "Υλικό παραγγελίας",
    "lc.set.thickness": "Πάχος παραγγελίας (mm)",
    "lc.set.speeds": "Ταχύτητες: {material}",
    "lc.set.cut": "Ταχύτητα κοπής (mm/min)",
    "lc.set.pierce": "Χρόνος διάτρησης (s)",
    "lc.set.mark": "Ταχύτητα χάραξης (mm/min)",
    "lc.set.typical": "Τυπικές τιμές fiber laser: βάλτε τις τιμές της δικής σας μηχανής.",
    "lc.set.reset": "Επαναφορά τυπικών",
    "lc.print.title": "Αναφορά παραγγελίας laser",
    "lc.print.note": "Εκτίμηση για προσφορά· ελέγξτε με το CAM της μηχανής σας.",
    "lc.notice": "Μηχανή γεωμετρίας: Eyeshot.",
    "lc.aria.drawing": "Σχέδιο του επιλεγμένου αρχείου",
    "lc.aria.table": "Αρχεία της παραγγελίας"
  },
  en: {
    "lc.eyebrow": "Free tool",
    "lc.privacy": "Your files never leave your computer.",
    "lc.cross": "All free tools →",
    "lc.open": "Open files",
    "lc.example": "Load example order",
    "lc.drop": "Drop DXF or DWG files here, or press “Open files”.",
    "lc.engine.loading": "Loading the geometry engine, about 12 MB, only the first time… {pct} %",
    "lc.engine.failed": "The geometry engine could not start in this browser.",
    "lc.engine.retry": "Try again",
    "lc.engine.nowasm": "Your browser has no WebAssembly, which the tool needs. Try a recent Chrome, Edge, Firefox or Safari.",
    "lc.toomany": "Up to {max} files per order; the rest were not loaded.",
    "lc.col.file": "File",
    "lc.col.parts": "Parts",
    "lc.col.status": "Status",
    "lc.col.cut": "Cut length",
    "lc.col.pierces": "Pierces",
    "lc.col.area": "Net area",
    "lc.col.weight": "Weight",
    "lc.col.time": "Time",
    "lc.col.qty": "Qty",
    "lc.col.material": "Material",
    "lc.col.thickness": "Thickness (mm)",
    "lc.col.dxf": "DXF",
    "lc.total": "Order total",
    "lc.waiting": "waiting…",
    "lc.processing": "processing…",
    "lc.download": "Download",
    "lc.zip": "Download all (ZIP)",
    "lc.print": "Print report",
    "lc.clear": "Clear",
    "lc.remove": "Remove file",
    "lc.status.ok": "Ready",
    "lc.status.warn": "Repaired or with warnings",
    "lc.status.error": "Needs fixing",
    "lc.incomplete": "“≥”: one or more files have open paths or could not be read, so the totals are minimums.",
    "lc.mat.steel": "Steel",
    "lc.mat.stainless": "Stainless steel",
    "lc.mat.aluminium": "Aluminium",
    "lc.mat.galvanised": "Galvanised steel",
    "lc.mat.copper": "Copper",
    "lc.mat.brass": "Brass",
    "lc.role.cut": "Cut",
    "lc.role.mark": "Mark",
    "lc.role.bend": "Bend",
    "lc.role.ignore": "Ignore",
    "lc.roles.title": "Layers and roles",
    "lc.roles.layer": "Layer",
    "lc.roles.color": "Colour",
    "lc.roles.linetype": "Linetype",
    "lc.roles.curves": "Curves",
    "lc.roles.role": "Role",
    "lc.drawing": "Drawing",
    "lc.fit": "Fit",
    "lc.zoomin": "Zoom in",
    "lc.zoomout": "Zoom out",
    "lc.pick": "Select a file in the table to see its drawing.",
    "lc.hover": "{kind} · length {len} mm",
    "lc.kind.outer": "Outer contour",
    "lc.kind.hole": "Hole",
    "lc.kind.open": "Open path",
    "lc.kind.mark": "Marking",
    "lc.kind.bend": "Bend line",
    "lc.kind.ignore": "Ignored",
    "lc.l.cut": "Cut",
    "lc.l.mark": "Mark",
    "lc.l.bend": "Bend",
    "lc.l.ignore": "Ignored",
    "lc.l.open": "Open ends",
    "lc.l.gap": "Closed gaps",
    "lc.checks": "Checks",
    "lc.none": "No issues found.",
    "lc.check.read-error": "The file could not be read ({message}).",
    "lc.check.read-version": "This DWG version cannot be read. Save it as DWG 2018 or as DXF.",
    "lc.check.too-large": "The file is over the tool’s limits ({message}).",
    "lc.check.block-empty": "Blocks {blocks} came in without geometry (a limit of old R12 files). Save the file as DXF 2004 or newer, or as DWG.",
    "lc.check.block-array": "Blocks {blocks} contain an arrayed insert (MINSERT), which was read only once. Explode the array in CAD and save again.",
    "lc.check.empty-cut": "There is nothing to cut.",
    "lc.check.open-path": "Open paths on the cut: {count} ({length} mm); ask the customer.",
    "lc.check.branch": "Points where three or more lines meet: {count}; the cutting path is unclear there.",
    "lc.check.self-intersect": "Contours that cross themselves: {count}.",
    "lc.check.dashed-on-cut": "Dashed lines on the cut (layers {layers}): check whether they are bend lines or centre lines.",
    "lc.check.not-flat": "The geometry is not flat; it was projected onto the XY plane.",
    "lc.check.units-assumed": "The file states no units; millimetres were assumed.",
    "lc.check.units-inch": "Converted from inches to millimetres.",
    "lc.check.gaps-closed": "Gaps closed: {count} (the largest {max} mm).",
    "lc.check.duplicates-removed": "Duplicate lines removed: {count} ({length} mm that would have been cut twice).",
    "lc.check.tiny-removed": "Tiny pieces removed: {count}.",
    "lc.check.text-kept": "Texts moved to the TEXT layer (not cut): {count}.",
    "lc.check.ignored-entities": "Left out: {hatch} hatches, {dim} dimensions, {leader} leaders, {point} points, {other} other.",
    "lc.check.multi-part": "Parts in the file: {count}; the quantity multiplies the whole file.",
    "lc.check.clamped": "The thickness is outside the speed table; the nearest row was used.",
    "lc.set.title": "Settings",
    "lc.set.units": "Units for files that state none",
    "lc.set.units.auto": "Automatic (millimetres)",
    "lc.set.units.mm": "Millimetres",
    "lc.set.units.inch": "Inches",
    "lc.set.join": "Join tolerance (mm)",
    "lc.set.gap": "Gap tolerance (mm)",
    "lc.set.material": "Order material",
    "lc.set.thickness": "Order thickness (mm)",
    "lc.set.speeds": "Speeds: {material}",
    "lc.set.cut": "Cutting speed (mm/min)",
    "lc.set.pierce": "Pierce time (s)",
    "lc.set.mark": "Marking speed (mm/min)",
    "lc.set.typical": "Typical fiber-laser values: set your machine’s.",
    "lc.set.reset": "Reset to typical",
    "lc.print.title": "Laser order report",
    "lc.print.note": "An estimate for quoting; check with your machine’s CAM.",
    "lc.notice": "Geometry engine: Eyeshot.",
    "lc.aria.drawing": "Drawing of the selected file",
    "lc.aria.table": "Files in the order"
  },
  it: {
    "lc.eyebrow": "Strumento gratuito",
    "lc.privacy": "I vostri file non lasciano mai il vostro computer.",
    "lc.cross": "Tutti gli strumenti gratuiti →",
    "lc.open": "Apri file",
    "lc.example": "Carica ordine di esempio",
    "lc.drop": "Trascinate qui file DXF o DWG, oppure premete «Apri file».",
    "lc.engine.loading": "Caricamento del motore geometrico, circa 12 MB, solo la prima volta… {pct} %",
    "lc.engine.failed": "Il motore geometrico non è riuscito ad avviarsi in questo browser.",
    "lc.engine.retry": "Riprovate",
    "lc.engine.nowasm": "Il vostro browser non supporta WebAssembly, necessario per lo strumento. Provate una versione recente di Chrome, Edge, Firefox o Safari.",
    "lc.toomany": "Fino a {max} file per ordine; gli altri non sono stati caricati.",
    "lc.col.file": "File",
    "lc.col.parts": "Pezzi",
    "lc.col.status": "Stato",
    "lc.col.cut": "Lunghezza di taglio",
    "lc.col.pierces": "Sfondamenti",
    "lc.col.area": "Area netta",
    "lc.col.weight": "Peso",
    "lc.col.time": "Tempo",
    "lc.col.qty": "Q.tà",
    "lc.col.material": "Materiale",
    "lc.col.thickness": "Spessore (mm)",
    "lc.col.dxf": "DXF",
    "lc.total": "Totale ordine",
    "lc.waiting": "in attesa…",
    "lc.processing": "elaborazione…",
    "lc.download": "Scarica",
    "lc.zip": "Scarica tutto (ZIP)",
    "lc.print": "Stampa report",
    "lc.clear": "Svuota",
    "lc.remove": "Rimuovi file",
    "lc.status.ok": "Pronto",
    "lc.status.warn": "Corretto o con avvisi",
    "lc.status.error": "Da correggere",
    "lc.incomplete": "«≥»: uno o più file hanno percorsi aperti o non sono stati letti, quindi i totali sono minimi.",
    "lc.mat.steel": "Acciaio",
    "lc.mat.stainless": "Acciaio inox",
    "lc.mat.aluminium": "Alluminio",
    "lc.mat.galvanised": "Acciaio zincato",
    "lc.mat.copper": "Rame",
    "lc.mat.brass": "Ottone",
    "lc.role.cut": "Taglio",
    "lc.role.mark": "Marcatura",
    "lc.role.bend": "Piega",
    "lc.role.ignore": "Ignora",
    "lc.roles.title": "Layer e ruoli",
    "lc.roles.layer": "Layer",
    "lc.roles.color": "Colore",
    "lc.roles.linetype": "Tipo di linea",
    "lc.roles.curves": "Curve",
    "lc.roles.role": "Ruolo",
    "lc.drawing": "Disegno",
    "lc.fit": "Adatta",
    "lc.zoomin": "Ingrandisci",
    "lc.zoomout": "Riduci",
    "lc.pick": "Selezionate un file nella tabella per vederne il disegno.",
    "lc.hover": "{kind} · lunghezza {len} mm",
    "lc.kind.outer": "Contorno esterno",
    "lc.kind.hole": "Foro",
    "lc.kind.open": "Percorso aperto",
    "lc.kind.mark": "Marcatura",
    "lc.kind.bend": "Linea di piega",
    "lc.kind.ignore": "Ignorato",
    "lc.l.cut": "Taglio",
    "lc.l.mark": "Marcatura",
    "lc.l.bend": "Piega",
    "lc.l.ignore": "Ignorato",
    "lc.l.open": "Estremi aperti",
    "lc.l.gap": "Aperture chiuse",
    "lc.checks": "Controlli",
    "lc.none": "Nessun problema rilevato.",
    "lc.check.read-error": "Il file non è stato letto ({message}).",
    "lc.check.read-version": "Questa versione DWG non si può leggere. Salvatelo come DWG 2018 o come DXF.",
    "lc.check.too-large": "Il file supera i limiti dello strumento ({message}).",
    "lc.check.block-empty": "I blocchi {blocks} sono arrivati senza geometria (un limite dei vecchi file R12). Salvate il file come DXF 2004 o successivo, oppure come DWG.",
    "lc.check.block-array": "I blocchi {blocks} contengono un inserimento a serie (MINSERT), letto una sola volta. Esplodete la serie nel CAD e salvate di nuovo.",
    "lc.check.empty-cut": "Non c’è niente da tagliare.",
    "lc.check.open-path": "Percorsi aperti nel taglio: {count} ({length} mm); chiedete al cliente.",
    "lc.check.branch": "Punti in cui si incontrano tre o più linee: {count}; lì il percorso di taglio non è chiaro.",
    "lc.check.self-intersect": "Contorni che si intersecano da soli: {count}.",
    "lc.check.dashed-on-cut": "Linee tratteggiate nel taglio (layer {layers}): verificate se sono linee di piega o assi.",
    "lc.check.not-flat": "La geometria non è piana; è stata proiettata sul piano XY.",
    "lc.check.units-assumed": "Il file non indica unità; si sono assunti millimetri.",
    "lc.check.units-inch": "Convertito da pollici a millimetri.",
    "lc.check.gaps-closed": "Aperture chiuse: {count} (la più grande {max} mm).",
    "lc.check.duplicates-removed": "Linee doppie rimosse: {count} ({length} mm che sarebbero stati tagliati due volte).",
    "lc.check.tiny-removed": "Pezzetti minuscoli rimossi: {count}.",
    "lc.check.text-kept": "Testi spostati nel layer TEXT (non tagliati): {count}.",
    "lc.check.ignored-entities": "Esclusi: {hatch} tratteggi, {dim} quote, {leader} direttrici, {point} punti, {other} altri.",
    "lc.check.multi-part": "Pezzi nel file: {count}; la quantità moltiplica tutto il file.",
    "lc.check.clamped": "Lo spessore è fuori dalla tabella delle velocità; è stata usata la riga più vicina.",
    "lc.set.title": "Impostazioni",
    "lc.set.units": "Unità per i file che non le indicano",
    "lc.set.units.auto": "Automatico (millimetri)",
    "lc.set.units.mm": "Millimetri",
    "lc.set.units.inch": "Pollici",
    "lc.set.join": "Tolleranza di unione (mm)",
    "lc.set.gap": "Tolleranza di chiusura (mm)",
    "lc.set.material": "Materiale dell’ordine",
    "lc.set.thickness": "Spessore dell’ordine (mm)",
    "lc.set.speeds": "Velocità: {material}",
    "lc.set.cut": "Velocità di taglio (mm/min)",
    "lc.set.pierce": "Tempo di sfondamento (s)",
    "lc.set.mark": "Velocità di marcatura (mm/min)",
    "lc.set.typical": "Valori tipici di un laser fibra: inserite quelli della vostra macchina.",
    "lc.set.reset": "Ripristina i tipici",
    "lc.print.title": "Report ordine laser",
    "lc.print.note": "Una stima per il preventivo; verificate con il CAM della vostra macchina.",
    "lc.notice": "Motore geometrico: Eyeshot.",
    "lc.aria.drawing": "Disegno del file selezionato",
    "lc.aria.table": "File dell’ordine"
  }
};
```

Run: `node _tests/extract.mjs <brief> js/laser/i18n-laser.js`

- [ ] **Step 3: Run the tests**

Run: `node --test "_tests/laser/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 20`, `ℹ fail 0`.

- [ ] **Step 4: Commit**

```bash
git add js/laser/i18n-laser.js _tests/laser/i18n.test.js
git commit -F - <<'EOF'
Laser DXF check: tool strings in Greek, English and Italian

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 11: The page and its styles

**Files:**
- Create: `laser-dxf-checker.html`
- Modify: `css/tools.css` (57 lines appended)
- Test: `_tests/laser/i18n.test.js` (two tests appended)

**Interfaces:**
- Consumes: `js/gcode/shell/*` (live); `js/laser/i18n-laser.js` (Task 10).
- Produces:
  - **Element ids for the controller (Task 12):**
    - input and actions: `lcFile`, `lcExample`, `lcZip`, `lcPrint`, `lcClear`, `lcBanner`, `lcDropHint`;
    - the parts table: `lcTable` (with `tfoot#lcTotals`, 12 cells) and `lcIncomplete`;
    - the drawing: `lcDetail`, `lcFileName`, `lcFit`, `lcZoomOut`, `lcZoomIn`, `lcSvg`, `lcPick`, `lcHover`;
    - checks and roles: `lcChecks`, `lcRoles`;
    - settings: `lcSettings`, `lcUnits`, `lcJoin`, `lcGap`, `lcMaterial`, `lcThickness`, `lcMarkSpeed`, `lcSpeedsTitle`, `lcSpeeds`, `lcReset`;
    - print: `lcPrintAll`, `lcPrintDate`;
    - around the tool: `lcCta`, `lcSurvey`, `lcThanks`.
  - **Scripts:** `js/laser/i18n-laser.js?v=20261015` is a classic script, then `js/laser/ui.js?v=20261015` is a module.
  - **Strings:** the page's inline `translations` merge `LC_I18N` under the page keys into `window.GV_I18N`, and `setLanguage` dispatches `gv:lang`.
  - **Copied verbatim:** the GA snippet, the consent banner and the language code come from `milling-gcode-viewer.html`.

- [ ] **Step 1: Append the failing tests**

<!-- file: _tests/private/append-t11.js -->
```js

// The strings the page really uses: the tool's file, then the page's inline block that merges them.
function pageTranslations() {
  const html = read('../../laser-dxf-checker.html');
  const window = {};
  vm.runInNewContext(read('../../js/laser/i18n-laser.js'), { window });
  const start = html.indexOf('    var translations = {');
  const end = html.indexOf('    window.GV_I18N = translations;');
  assert.ok(start > 0 && end > start, 'inline translations block');
  const box = {};
  vm.runInNewContext(html.slice(start, end) + '\nbox.t = translations;', { window, box, Object });
  return { html, t: box.t };
}

const usedKeys = html => [...html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)].map(m => m[1]);

test('page: the merged strings match across languages and cover every key the page uses', () => {
  const { html, t } = pageTranslations();
  const en = Object.keys(t.en).sort();
  assert.deepEqual(Object.keys(t.el).sort(), en);
  assert.deepEqual(Object.keys(t.it).sort(), en);
  const used = usedKeys(html);
  assert.ok(used.length > 20);
  for (const k of used) assert.ok(k in t.en, `missing ${k}`);
  assert.equal(t.en._title, 'AidedCAM - Laser DXF check');
});

test('the page shows the devDept notice', () => {
  const { html } = pageTranslations();
  assert.ok(html.includes('Portion of copyright © devDept Software S.r.l. All Rights Reserved.'));
});
```

Run: `node _tests/extract.mjs <brief> _tests/private/append-t11.js && cat _tests/private/append-t11.js >> _tests/laser/i18n.test.js && rm _tests/private/append-t11.js && node --test "_tests/laser/i18n.test.js" 2>&1 | grep -m1 ENOENT`
Expected: `ENOENT` naming `laser-dxf-checker.html`.

- [ ] **Step 2: Write the page and append the styles**

<!-- file: laser-dxf-checker.html -->
```html
<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AidedCAM - Έλεγχος DXF για κοπή laser</title>
  <meta name="description" content="Δωρεάν έλεγχος και διόρθωση αρχείων DXF και DWG για κοπή laser: κλείνει κενά, σβήνει διπλές γραμμές και δίνει μήκος κοπής, διατρήσεις, βάρος και χρόνο. Χωρίς εγκατάσταση, χωρίς εγγραφή." />
  <meta name="robots" content="index, follow" />
  <link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="icon-192.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png" />
  <meta name="theme-color" content="#f4f3ee" />
  <link rel="canonical" href="https://www.aidedcam.com/laser-dxf-checker.html" />
  <meta property="og:title" content="AidedCAM - Έλεγχος DXF για κοπή laser" />
  <meta property="og:description" content="Ρίξτε μια παραγγελία DXF ή DWG: διορθώνει τα αρχεία και δίνει μήκος κοπής, διατρήσεις, βάρος και χρόνο για κάθε τεμάχιο." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://www.aidedcam.com/laser-dxf-checker.html" />
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
        <a href="index.html" class="nav-back" data-i18n="lc.back">Αρχική</a>
        <div class="lang-switcher">
          <button class="lang-btn active" data-lang="el">EL</button>
          <button class="lang-btn" data-lang="en">EN</button>
          <button class="lang-btn" data-lang="it">IT</button>
        </div>
      </div>
    </div>
  </nav>

  <main class="gv lc">
    <header class="gv-head">
      <p class="gv-eyebrow" data-i18n="lc.eyebrow">Δωρεάν εργαλείο</p>
      <h1 data-i18n="lc.title">Έλεγχος DXF για κοπή laser</h1>
      <p class="gv-lede" data-i18n="lc.lede">Ρίξτε μια παραγγελία DXF ή DWG: διορθώνει τα αρχεία και δίνει μήκος κοπής, διατρήσεις, βάρος και χρόνο για κάθε τεμάχιο.</p>
      <p class="gv-privacy" data-i18n="lc.privacy">Τα αρχεία σας δεν φεύγουν ποτέ από τον υπολογιστή σας.</p>
      <p class="gv-cross"><a href="free-tools.html" data-i18n="lc.cross">Όλα τα δωρεάν εργαλεία →</a></p>
    </header>

    <div class="gv-wrap">
      <div class="gv-print-head" aria-hidden="true">
        <img src="aidedcam-wordmark.svg" alt="AidedCAM" width="716" height="67" />
        <span data-i18n="lc.print.title">Αναφορά παραγγελίας laser</span><span id="lcPrintDate"></span>
      </div>
      <noscript><p class="gv-banner">Το εργαλείο χρειάζεται JavaScript. / The tool needs JavaScript.</p></noscript>

      <section class="gv-bar" aria-label="Files">
        <label class="gv-btn gv-btn-primary gv-file-label">
          <input type="file" id="lcFile" multiple accept=".dxf,.dwg" class="gv-visually-hidden" />
          <span data-i18n="lc.open">Άνοιγμα αρχείων</span>
        </label>
        <button type="button" class="gv-btn" id="lcExample" data-i18n="lc.example">Φόρτωση παραδείγματος</button>
        <button type="button" class="gv-btn" id="lcZip" data-i18n="lc.zip" disabled>Λήψη όλων (ZIP)</button>
        <button type="button" class="gv-btn" id="lcPrint" data-i18n="lc.print">Εκτύπωση αναφοράς</button>
        <button type="button" class="gv-btn" id="lcClear" data-i18n="lc.clear">Καθαρισμός</button>
      </section>

      <div class="gv-banner" id="lcBanner" role="status" hidden></div>
      <p class="gv-drop-hint" id="lcDropHint" data-i18n="lc.drop">Σύρετε εδώ αρχεία DXF ή DWG, ή πατήστε «Άνοιγμα αρχείων».</p>

      <section class="lc-order">
        <div class="gv-table-wrap">
          <table class="gv-table lc-table" id="lcTable" data-i18n-aria="lc.aria.table" aria-label="Αρχεία της παραγγελίας">
            <thead>
              <tr>
                <th data-i18n="lc.col.file">Αρχείο</th>
                <th data-i18n="lc.col.parts">Τεμάχια</th>
                <th data-i18n="lc.col.status">Κατάσταση</th>
                <th data-i18n="lc.col.cut">Μήκος κοπής</th>
                <th data-i18n="lc.col.pierces">Διατρήσεις</th>
                <th data-i18n="lc.col.area">Καθαρό εμβαδό</th>
                <th data-i18n="lc.col.weight">Βάρος</th>
                <th data-i18n="lc.col.time">Χρόνος</th>
                <th data-i18n="lc.col.qty">Ποσότητα</th>
                <th data-i18n="lc.col.material">Υλικό</th>
                <th data-i18n="lc.col.thickness">Πάχος (mm)</th>
                <th data-i18n="lc.col.dxf">DXF</th>
              </tr>
            </thead>
            <tbody></tbody>
            <tfoot>
              <tr id="lcTotals">
                <td data-i18n="lc.total">Σύνολο παραγγελίας</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p class="gv-note" id="lcIncomplete" data-i18n="lc.incomplete" hidden>«≥»: ένα ή περισσότερα αρχεία έχουν ανοιχτές διαδρομές ή δεν διαβάστηκαν, οπότε τα σύνολα είναι ελάχιστα.</p>
      </section>

      <section class="lc-detail" id="lcDetail" hidden>
        <div class="lc-view">
          <div class="gv-panel-head">
            <span><span data-i18n="lc.drawing">Σχέδιο</span> · <span id="lcFileName"></span></span>
            <span class="gv-tools-controls">
              <button type="button" class="gv-link" id="lcFit" data-i18n="lc.fit">Προσαρμογή</button>
              <button type="button" class="gv-zoom" id="lcZoomOut" data-i18n-aria="lc.zoomout" aria-label="Σμίκρυνση">−</button>
              <button type="button" class="gv-zoom" id="lcZoomIn" data-i18n-aria="lc.zoomin" aria-label="Μεγέθυνση">+</button>
            </span>
          </div>
          <svg class="lc-svg" id="lcSvg" role="img" data-i18n-aria="lc.aria.drawing" aria-label="Σχέδιο του επιλεγμένου αρχείου"></svg>
          <p class="lc-pick" id="lcPick" data-i18n="lc.pick">Επιλέξτε ένα αρχείο από τον πίνακα για να δείτε το σχέδιό του.</p>
          <p class="gv-readout" id="lcHover"></p>
          <p class="lc-legend">
            <span><i class="lc-key cut"></i><span data-i18n="lc.l.cut">Κοπή</span></span>
            <span><i class="lc-key mark"></i><span data-i18n="lc.l.mark">Χάραξη</span></span>
            <span><i class="lc-key bend"></i><span data-i18n="lc.l.bend">Κάμψη</span></span>
            <span><i class="lc-key ignore"></i><span data-i18n="lc.l.ignore">Αγνοείται</span></span>
            <span><i class="lc-dot open"></i><span data-i18n="lc.l.open">Ανοιχτά άκρα</span></span>
            <span><i class="lc-dot gap"></i><span data-i18n="lc.l.gap">Κλεισμένα κενά</span></span>
          </p>
        </div>
        <div class="lc-side">
          <h2 data-i18n="lc.checks">Έλεγχοι</h2>
          <ul class="gv-check-list" id="lcChecks"></ul>
          <h2 data-i18n="lc.roles.title">Επίπεδα και ρόλοι</h2>
          <div class="gv-table-wrap">
            <table class="gv-table lc-roles" id="lcRoles">
              <thead>
                <tr>
                  <th data-i18n="lc.roles.color">Χρώμα</th>
                  <th data-i18n="lc.roles.layer">Επίπεδο</th>
                  <th data-i18n="lc.roles.linetype">Τύπος γραμμής</th>
                  <th data-i18n="lc.roles.curves">Καμπύλες</th>
                  <th data-i18n="lc.roles.role">Ρόλος</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </section>

      <details class="gv-settings lc-settings" id="lcSettings">
        <summary data-i18n="lc.set.title">Ρυθμίσεις</summary>
        <div class="gv-settings-grid">
          <label><span data-i18n="lc.set.units">Μονάδες για αρχεία που δεν τις δηλώνουν</span><select id="lcUnits"></select></label>
          <label><span data-i18n="lc.set.join">Ανοχή ένωσης (mm)</span><input id="lcJoin" type="number" min="0.001" max="1" step="0.001" /></label>
          <label><span data-i18n="lc.set.gap">Ανοχή κλεισίματος κενών (mm)</span><input id="lcGap" type="number" min="0" max="5" step="0.05" /></label>
          <label><span data-i18n="lc.set.material">Υλικό παραγγελίας</span><select id="lcMaterial"></select></label>
          <label><span data-i18n="lc.set.thickness">Πάχος παραγγελίας (mm)</span><select id="lcThickness"></select></label>
          <label><span data-i18n="lc.set.mark">Ταχύτητα χάραξης (mm/min)</span><input id="lcMarkSpeed" type="number" min="1" step="100" /></label>
        </div>
        <h3 id="lcSpeedsTitle"></h3>
        <p class="gv-note" data-i18n="lc.set.typical">Τυπικές τιμές fiber laser: βάλτε τις τιμές της δικής σας μηχανής.</p>
        <div class="gv-table-wrap">
          <table class="gv-table lc-speeds" id="lcSpeeds">
            <thead><tr><th>mm</th><th data-i18n="lc.set.cut">Ταχύτητα κοπής (mm/min)</th><th data-i18n="lc.set.pierce">Χρόνος διάτρησης (s)</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <button type="button" class="gv-link" id="lcReset" data-i18n="lc.set.reset">Επαναφορά τυπικών</button>
      </details>

      <div class="lc-print-all" id="lcPrintAll" aria-hidden="true"></div>

      <section class="gv-cta">
        <h2 data-i18n="lc.cta.title">Θέλετε αυτό μέσα στις προσφορές σας;</h2>
        <p data-i18n="lc.cta.text">Φτιάχνουμε λογισμικό στα μέτρα σας: σύνδεση με το CAM και το nesting της μηχανής σας, τιμές από τον δικό σας τιμοκατάλογο, προσφορά με ένα κλικ.</p>
        <a class="btn-primary" id="lcCta" href="index.html#contact" data-i18n="lc.cta.button">Μιλήστε μαζί μας</a>
        <div class="gv-survey" id="lcSurvey">
          <p data-i18n="lc.survey.q">Πώς βγάζετε σήμερα τις προσφορές κοπής;</p>
          <button type="button" class="gv-chip" data-answer="hand" data-i18n="lc.survey.hand">Με το χέρι ή σε Excel</button>
          <button type="button" class="gv-chip" data-answer="machine" data-i18n="lc.survey.machine">Με το λογισμικό της μηχανής</button>
          <button type="button" class="gv-chip" data-answer="other" data-i18n="lc.survey.other">Με άλλο πρόγραμμα</button>
          <p class="gv-thanks" id="lcThanks" data-i18n="lc.survey.thanks" hidden>Ευχαριστούμε!</p>
        </div>
      </section>

      <div class="gv-print-foot" aria-hidden="true">www.aidedcam.com · <span data-i18n="lc.print.note">Εκτίμηση για προσφορά· ελέγξτε με το CAM της μηχανής σας.</span></div>
    </div>
  </main>

  <footer class="gv-footer">
    <img src="aidedcam-wordmark.svg" alt="AidedCAM" width="716" height="67" loading="lazy" />
    <div class="gv-footer-legal">
      <a href="privacy.html" data-i18n="footer.privacy">Απόρρητο</a>
      <a href="legal.html" data-i18n="footer.legal">Νομικά</a>
      <a href="javascript:void(0)" onclick="openCookieSettings()" data-i18n="footer.cookie_settings">Ρυθμίσεις Cookies</a>
    </div>
    <p class="lc-notice"><span data-i18n="lc.notice">Μηχανή γεωμετρίας: Eyeshot.</span> Portion of copyright © devDept Software S.r.l. All Rights Reserved.</p>
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

  <script src="js/laser/i18n-laser.js?v=20261015"></script>
  <script>
    var translations = {
      el: {
        "_title": "AidedCAM - Έλεγχος DXF για κοπή laser",
        "lc.back": "Αρχική",
        "lc.title": "Έλεγχος DXF για κοπή laser",
        "lc.lede": "Ρίξτε μια παραγγελία DXF ή DWG: διορθώνει τα αρχεία και δίνει μήκος κοπής, διατρήσεις, βάρος και χρόνο για κάθε τεμάχιο.",
        "lc.cta.title": "Θέλετε αυτό μέσα στις προσφορές σας;",
        "lc.cta.text": "Φτιάχνουμε λογισμικό στα μέτρα σας: σύνδεση με το CAM και το nesting της μηχανής σας, τιμές από τον δικό σας τιμοκατάλογο, προσφορά με ένα κλικ.",
        "lc.cta.button": "Μιλήστε μαζί μας",
        "lc.survey.q": "Πώς βγάζετε σήμερα τις προσφορές κοπής;",
        "lc.survey.hand": "Με το χέρι ή σε Excel",
        "lc.survey.machine": "Με το λογισμικό της μηχανής",
        "lc.survey.other": "Με άλλο πρόγραμμα",
        "lc.survey.thanks": "Ευχαριστούμε!",
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
        "_title": "AidedCAM - Laser DXF check",
        "lc.back": "Home",
        "lc.title": "Laser DXF check",
        "lc.lede": "Drop a DXF or DWG order: it repairs the files and gives cut length, pierces, weight and time for every part.",
        "lc.cta.title": "Want this inside your quoting?",
        "lc.cta.text": "We build software around your shop: linked to your machine’s CAM and nesting, priced from your own rates, a quote in one click.",
        "lc.cta.button": "Talk to us",
        "lc.survey.q": "How do you price cutting jobs today?",
        "lc.survey.hand": "By hand or in Excel",
        "lc.survey.machine": "With the machine’s software",
        "lc.survey.other": "With another program",
        "lc.survey.thanks": "Thank you!",
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
        "_title": "AidedCAM - Controllo DXF per taglio laser",
        "lc.back": "Home",
        "lc.title": "Controllo DXF per taglio laser",
        "lc.lede": "Trascinate un ordine DXF o DWG: corregge i file e fornisce lunghezza di taglio, sfondamenti, peso e tempo per ogni pezzo.",
        "lc.cta.title": "Lo volete dentro i vostri preventivi?",
        "lc.cta.text": "Realizziamo software su misura: collegato al CAM e al nesting della vostra macchina, con i vostri prezzi, un preventivo in un clic.",
        "lc.cta.button": "Parlate con noi",
        "lc.survey.q": "Come fate oggi i preventivi di taglio?",
        "lc.survey.hand": "A mano o in Excel",
        "lc.survey.machine": "Con il software della macchina",
        "lc.survey.other": "Con un altro programma",
        "lc.survey.thanks": "Grazie!",
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
      translations[l] = Object.assign({}, (window.LC_I18N || {})[l] || {}, translations[l]);
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
  <script type="module" src="js/laser/ui.js?v=20261015"></script>
</body>
</html>
```

<!-- file: _tests/private/append-lc.css -->
```css

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
```

Run:
```bash
node _tests/extract.mjs <brief> laser-dxf-checker.html
node _tests/extract.mjs <brief> _tests/private/append-lc.css && cat _tests/private/append-lc.css >> css/tools.css && rm _tests/private/append-lc.css
```

- [ ] **Step 3: Check it**

Run:
```bash
node _tests/extract.mjs <brief> laser-dxf-checker.html --check
awk '/<script[^>]*>/{if($0 !~ /src=/){f=1;next}} /<\/script>/{f=0} f' laser-dxf-checker.html > _tests/private/lc-inline.js && node --check _tests/private/lc-inline.js && echo INLINE_OK && rm _tests/private/lc-inline.js
git diff --stat css/tools.css
node --test "_tests/laser/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
```
Expected: `matches`, `INLINE_OK`, `css/tools.css | 57 +`, then `ℹ pass 22` and `ℹ fail 0`.

- [ ] **Step 4: Commit**

```bash
git add laser-dxf-checker.html css/tools.css _tests/laser/i18n.test.js
git commit -F - <<'EOF'
Laser DXF check: the page, its styles and the devDept notice

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 12: The controller

**Files:**
- Create: `js/laser/ui.js`
- Test: `_tests/laser/i18n.test.js` (one test appended)

**Interfaces:**
- **Consumes:**
  - `createEngine` (Task 9);
  - `pricing.js`, `zip.js`, `drawing.js` (Task 8);
  - the shell's `t`, `ga`, `fmtNum`, `lang`, `lsGet`, `lsSet`, `loadStored`, `saveStored` and `renderBanner`;
  - the element ids (Task 11).
- **Produces:**
  - the page's behaviour;
  - GA events: `laser_files_loaded`, `laser_example_loaded`, `laser_dxf_download`, `laser_zip_download`, `laser_print`, `laser_cta_click`, `laser_survey`;
  - storage keys `aidedcam-lc-settings` and `aidedcam-lc-survey`;
  - the constants `MAX_FILES = 50` and `EXAMPLE` (Task 7's names and quantities).

- [ ] **Step 1: Append the failing test**

<!-- file: _tests/private/append-t12.js -->
```js

test('the example order is committed and the controller loads it', () => {
  const ui = read('../../js/laser/ui.js');
  for (const f of ['bracket.dxf', 'flange.dxf', 'cover.dxf', 'spacer.dwg']) {
    assert.ok(readFileSync(new URL(`../../js/laser/examples/${f}`, import.meta.url)).length > 0, f);
    assert.ok(ui.includes(`'${f}'`), `ui.js does not load ${f}`);
  }
});
```

Run: `node _tests/extract.mjs <brief> _tests/private/append-t12.js && cat _tests/private/append-t12.js >> _tests/laser/i18n.test.js && rm _tests/private/append-t12.js && node --test "_tests/laser/i18n.test.js" 2>&1 | grep -m1 ENOENT`
Expected: `ENOENT` naming `js/laser/ui.js`.

- [ ] **Step 2: Write the controller**

<!-- file: js/laser/ui.js -->
```js
// Laser DXF check: the page controller (spec §10). Files go to the engine worker one at a time; the page
// keeps each file's result and recomputes weight, time and totals in JavaScript (spec §3).
import { t, ga, fmtNum, lang } from '../gcode/shell/i18n.js';
import { lsGet, lsSet, loadStored, saveStored } from '../gcode/shell/settings-store.js';
import { renderBanner } from '../gcode/shell/banner.js';
// The tool's own modules carry the deploy version, so a cached old module never meets a new controller.
import { createEngine } from './bridge.js?v=20261015';
import { createDrawing } from './drawing.js?v=20261015';
import { MATERIALS, DEFAULT_SPEEDS, DEFAULT_MARK_SPEED, THICKNESSES, fileNumbers, orderTotals, statusOf, formatDuration } from './pricing.js?v=20261015';
import { zipStore, uniqueNames } from './zip.js?v=20261015';

const $ = id => document.getElementById(id);
const MAX_FILES = 50;
const SETTINGS_KEY = 'aidedcam-lc-settings';
const SURVEY_KEY = 'aidedcam-lc-survey';
const EXAMPLE = [['bracket.dxf', 10], ['flange.dxf', 4], ['cover.dxf', 2], ['spacer.dwg', 20]];
const SETTING_FIELDS = ['units', 'joinTol', 'gapTol', 'material', 'thickness', 'markSpeed', 'speeds'];

const state = {
  files: [],                  // { id, name, bytes, result, numbers, qty, material, thickness, own: {material, thickness}, roles, status }
  selected: null,
  banner: null,
  engineReady: false,
  settings: loadStored(SETTINGS_KEY, {
    units: 'auto', joinTol: 0.01, gapTol: 0.2, material: 'steel', thickness: 2, markSpeed: DEFAULT_MARK_SPEED,
    speeds: JSON.parse(JSON.stringify(DEFAULT_SPEEDS)),
  }),
};
let nextId = 0, batch = null;

function saveSettings() { saveStored(SETTINGS_KEY, state.settings, SETTING_FIELDS); }
function showBanner(b) { state.banner = b; renderBanner($('lcBanner'), b, t); }
const num = (v, d) => fmtNum(v, d);
const fmtParam = v => (typeof v === 'number' ? num(v, Number.isInteger(v) ? 0 : 2) : String(v ?? ''));

// ---- the engine ----
const supported = typeof WebAssembly === 'object' && typeof Worker === 'function' && typeof DecompressionStream === 'function';
const engine = supported ? createEngine({
  onBootProgress: pct => showBanner({ key: 'lc.engine.loading', params: { pct } }),
  onReady: () => { state.engineReady = true; if (state.banner && state.banner.key === 'lc.engine.loading') showBanner(null); },
}) : null;
if (!supported) showBanner({ key: 'lc.engine.nowasm' });

function engineSettings(f) {
  const s = state.settings;
  return { units: s.units, joinTol: Number(s.joinTol), gapTol: Number(s.gapTol), roles: f.roles };
}

async function run(f) {
  if (!engine) return;
  f.status = 'processing';
  render();
  const m = await engine.process(f.name, f.bytes.slice(0), engineSettings(f));
  if (!state.files.includes(f)) return;                          // removed meanwhile
  f.result = m;
  f.status = m.type === 'result' ? 'done' : 'error';
  if (m.type === 'error' && m.reason === 'engine' && !state.engineReady) showBanner({ key: 'lc.engine.failed', action: { key: 'lc.engine.retry', run: () => location.reload() } });
  recompute(f);
  if ((state.selected === null && f.status === 'done') || state.selected === f.id) select(f.id);   // redraw a re-run
  else render();
  if (batch && batch.files.includes(f)) finishBatch(f);
}

function addFiles(list, source) {
  const room = MAX_FILES - state.files.length;
  if (list.length > room) showBanner({ key: 'lc.toomany', params: { max: MAX_FILES } });
  const added = [];
  for (const { name, bytes, qty } of list.slice(0, Math.max(0, room))) {
    const f = { id: ++nextId, name, bytes, result: null, numbers: null, qty: qty || 1, own: {}, roles: {}, status: 'waiting' };
    state.files.push(f);
    added.push(f);
  }
  if (!added.length) return;
  batch = { files: added, left: added.length, source };
  render();
  added.forEach(run);
}

function finishBatch(f) {
  batch.left--;
  if (batch.left > 0) return;
  const done = batch.files;
  const results = done.map(x => x.result).filter(r => r && r.type === 'result');
  if (batch.source === 'example') ga('laser_example_loaded', {});
  else {
    ga('laser_files_loaded', {
      files: done.length,
      parts: results.reduce((a, r) => a + r.parts.length, 0),
      errors: done.length - results.length,
      open: results.filter(r => r.extras.openPierces > 0).length,
      repaired: results.filter(r => statusOf(r) === 'warn').length,
    });
  }
  batch = null;
}

// ---- numbers ----
function jobOf(f) {
  return { material: f.own.material || state.settings.material, thickness: Number(f.own.thickness || state.settings.thickness) };
}
function recompute(f) {
  f.numbers = f.result && f.result.type === 'result'
    ? fileNumbers(f.result, jobOf(f), state.settings.speeds, Number(state.settings.markSpeed))
    : null;
}
function recomputeAll() { state.files.forEach(recompute); render(); }

// ---- the parts table ----
function statusCell(f) {
  const td = document.createElement('td');
  const st = f.status === 'done' || f.status === 'error' ? statusOf(f.result) : null;
  const span = document.createElement('span');
  if (!st) { span.className = 'lc-status is-busy'; span.textContent = t(f.status === 'processing' ? 'lc.processing' : 'lc.waiting'); }
  else {
    span.className = `lc-status is-${st}`;
    span.textContent = st === 'ok' ? '✔' : st === 'warn' ? '⚠' : '✖';
    span.title = t(`lc.status.${st}`);
    span.setAttribute('aria-label', t(`lc.status.${st}`));
  }
  td.appendChild(span);
  return td;
}

function dropdown(el, options, value, onChange) {
  const s = document.createElement('select');
  for (const [v, label] of options) { const o = document.createElement('option'); o.value = v; o.textContent = label; s.appendChild(o); }
  s.value = String(value);
  s.addEventListener('change', () => onChange(s.value));
  s.addEventListener('click', e => e.stopPropagation());
  el.appendChild(s);
  return s;
}
const materialOptions = () => Object.keys(MATERIALS).map(m => [m, t(`lc.mat.${m}`)]);
const thicknessOptions = () => THICKNESSES.map(v => [String(v), num(v, v % 1 ? 1 : 0)]);

function td(text, cls) { const c = document.createElement('td'); c.textContent = text; if (cls) c.className = cls; return c; }

function renderTable() {
  const body = $('lcTable').tBodies[0];
  body.replaceChildren();
  for (const f of state.files) {
    const tr = document.createElement('tr');
    tr.className = 'lc-row' + (f.id === state.selected ? ' is-sel' : '');
    tr.tabIndex = 0;
    tr.addEventListener('click', () => select(f.id));
    tr.addEventListener('keydown', e => { if (e.key === 'Enter') select(f.id); });
    tr.appendChild(td(f.name, 'lc-name'));
    const n = f.numbers;
    tr.appendChild(td(n ? String(n.parts) : '–'));
    tr.appendChild(statusCell(f));
    tr.appendChild(td(n ? `${num(n.cutLength / 1000, 2)} m` : '–'));
    tr.appendChild(td(n ? String(n.pierces) : '–'));
    tr.appendChild(td(n ? `${num(n.area / 1e6, 3)} m²` : '–'));
    tr.appendChild(td(n ? `${num(n.weight, 2)} kg` : '–'));
    tr.appendChild(td(n ? (n.incomplete ? '≥ ' : '') + formatDuration(n.seconds) : '–'));
    const q = document.createElement('td');
    const qi = document.createElement('input');
    qi.type = 'number'; qi.min = '0'; qi.step = '1'; qi.value = String(f.qty); qi.className = 'lc-qty';
    qi.setAttribute('aria-label', t('lc.col.qty'));
    qi.addEventListener('click', e => e.stopPropagation());
    qi.addEventListener('change', () => { const v = Math.max(0, Math.floor(Number(qi.value) || 0)); f.qty = v; qi.value = String(v); renderTotals(); });
    q.appendChild(qi); tr.appendChild(q);
    const m = document.createElement('td');
    dropdown(m, materialOptions(), jobOf(f).material, v => { f.own.material = v; recompute(f); render(); });
    tr.appendChild(m);
    const th = document.createElement('td');
    dropdown(th, thicknessOptions(), String(jobOf(f).thickness), v => { f.own.thickness = Number(v); recompute(f); render(); });
    tr.appendChild(th);
    const d = document.createElement('td');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'gv-link'; btn.textContent = t('lc.download');
    btn.disabled = !(f.result && f.result.type === 'result');
    btn.addEventListener('click', e => { e.stopPropagation(); downloadDxf(f); });
    d.appendChild(btn); tr.appendChild(d);
    body.appendChild(tr);
  }
  renderTotals();
}

function renderTotals() {
  const tot = orderTotals(state.files.map(f => ({ numbers: f.numbers, qty: f.qty })));
  const pending = state.files.some(f => f.status === 'waiting' || f.status === 'processing');
  const ge = tot.incomplete || pending ? '≥ ' : '';
  const cells = $('lcTotals').children;
  cells[1].textContent = String(tot.parts);
  cells[3].textContent = `${ge}${num(tot.cutLength / 1000, 2)} m`;
  cells[4].textContent = `${ge}${tot.pierces}`;
  cells[5].textContent = `${ge}${num(tot.area / 1e6, 3)} m²`;
  cells[6].textContent = `${ge}${num(tot.weight, 2)} kg`;
  cells[7].textContent = ge + formatDuration(tot.seconds);
  $('lcIncomplete').hidden = !tot.incomplete;
  $('lcZip').disabled = !state.files.some(f => f.result && f.result.type === 'result');
  $('lcDropHint').hidden = state.files.length > 0;
}

// ---- the selected file: drawing, checks, roles ----
const drawing = createDrawing($('lcSvg'), { onHover: c => showHover(c) });

function showHover(c) {
  const out = $('lcHover');
  if (!c) { out.textContent = ''; drawing.highlight(null); return; }
  const kind = c.role !== 'cut' ? c.role : !c.closed ? 'open' : c.isHole ? 'hole' : 'outer';
  out.textContent = t('lc.hover', { kind: t(`lc.kind.${kind}`), len: num(c.length, 2) });
  drawing.highlight(c.id);
}

function checksOf(f) {
  const r = f.result;
  if (!r) return [];
  if (r.type === 'error') {
    const id = r.reason === 'version' ? 'read-version' : r.reason === 'limit' || r.reason === 'timeout' ? 'too-large' : 'read-error';
    return [{ id, severity: 'error', params: { message: r.message || r.reason } }];
  }
  const list = [...r.checks];
  if (f.numbers && f.numbers.clamped) list.push({ id: 'clamped', severity: 'info', params: {} });
  return list;
}

function renderChecks(f) {
  const ul = $('lcChecks');
  const list = checksOf(f);
  if (!list.length) {
    const li = document.createElement('li'); li.className = 'gv-w is-ok'; li.textContent = t('lc.none');
    ul.replaceChildren(li); return;
  }
  ul.replaceChildren(...list.map(c => {
    const li = document.createElement('li');
    li.className = `gv-w is-${c.severity === 'info' ? 'ok' : c.severity}`;
    const params = Object.fromEntries(Object.entries(c.params || {}).map(([k, v]) => [k, fmtParam(v)]));
    li.textContent = t(`lc.check.${c.id}`, params);
    return li;
  }));
}

function renderRoles(f) {
  const body = $('lcRoles').tBodies[0];
  body.replaceChildren();
  const groups = f.result && f.result.type === 'result' ? f.result.groups : [];
  for (const g of groups) {
    const tr = document.createElement('tr');
    const sw = document.createElement('td');
    const chip = document.createElement('span'); chip.className = 'lc-chip'; chip.style.background = g.color;
    sw.appendChild(chip); tr.appendChild(sw);
    tr.appendChild(td(g.layer)); tr.appendChild(td(g.linetype)); tr.appendChild(td(String(g.curves)));
    const r = document.createElement('td');
    dropdown(r, ['cut', 'mark', 'bend', 'ignore'].map(x => [x, t(`lc.role.${x}`)]), g.role, v => { f.roles[g.key] = v; run(f); });
    tr.appendChild(r);
    body.appendChild(tr);
  }
}

function select(id) {
  if (typeof id !== 'number') return;
  state.selected = id;
  const f = state.files.find(x => x.id === id);
  render();
  if (!f) return;
  $('lcFileName').textContent = f.name;
  $('lcPick').hidden = true;
  if (f.result && f.result.type === 'result') drawing.show(f.result); else drawing.clear();
}

function renderDetail() {
  const f = state.files.find(x => x.id === state.selected);
  $('lcDetail').hidden = !state.files.length;
  if (!f) { $('lcPick').hidden = false; $('lcFileName').textContent = ''; $('lcChecks').replaceChildren(); $('lcRoles').tBodies[0].replaceChildren(); return; }
  renderChecks(f);
  renderRoles(f);
}

function render() { renderTable(); renderDetail(); }

// ---- settings ----
function renderSpeeds() {
  const s = state.settings, m = s.material;
  $('lcSpeedsTitle').textContent = t('lc.set.speeds', { material: t(`lc.mat.${m}`) });
  const body = $('lcSpeeds').tBodies[0];
  body.replaceChildren();
  const rows = s.speeds[m] || (s.speeds[m] = JSON.parse(JSON.stringify(DEFAULT_SPEEDS[m])));
  rows.forEach((row, i) => {
    const tr = document.createElement('tr');
    tr.appendChild(td(num(row[0], row[0] % 1 ? 1 : 0)));
    for (const k of [1, 2]) {
      const c = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = 'number'; inp.min = '0'; inp.step = k === 1 ? '100' : '0.1'; inp.value = String(row[k]);
      inp.setAttribute('aria-label', `${t(k === 1 ? 'lc.set.cut' : 'lc.set.pierce')} ${row[0]} mm`);
      inp.addEventListener('change', () => { const v = Number(inp.value); if (Number.isFinite(v) && v > 0) { rows[i][k] = v; saveSettings(); recomputeAll(); } else inp.value = String(rows[i][k]); });
      c.appendChild(inp); tr.appendChild(c);
    }
    body.appendChild(tr);
  });
}

function wireSettings() {
  const s = state.settings;
  const units = $('lcUnits');
  units.replaceChildren(...['auto', 'mm', 'inch'].map(v => { const o = document.createElement('option'); o.value = v; o.textContent = t(`lc.set.units.${v}`); return o; }));
  units.value = s.units;
  $('lcJoin').value = String(s.joinTol); $('lcGap').value = String(s.gapTol); $('lcMarkSpeed').value = String(s.markSpeed);
  const mat = $('lcMaterial');
  mat.replaceChildren(...materialOptions().map(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; return o; }));
  mat.value = s.material;
  const thk = $('lcThickness');
  thk.replaceChildren(...thicknessOptions().map(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; return o; }));
  thk.value = String(s.thickness);
  renderSpeeds();
}

function onEngineSetting(key, read, valid) {
  return e => {
    const v = read(e.target.value);
    if (!valid(v)) { e.target.value = String(state.settings[key]); return; }
    state.settings[key] = v; saveSettings();
    state.files.forEach(f => run(f));
  };
}

$('lcUnits').addEventListener('change', onEngineSetting('units', v => v, v => ['auto', 'mm', 'inch'].includes(v)));
$('lcJoin').addEventListener('change', onEngineSetting('joinTol', Number, v => Number.isFinite(v) && v > 0 && v <= 1));
$('lcGap').addEventListener('change', onEngineSetting('gapTol', Number, v => Number.isFinite(v) && v >= 0 && v <= 5));
$('lcMaterial').addEventListener('change', e => { state.settings.material = e.target.value; saveSettings(); renderSpeeds(); recomputeAll(); });
$('lcThickness').addEventListener('change', e => { state.settings.thickness = Number(e.target.value); saveSettings(); recomputeAll(); });
$('lcMarkSpeed').addEventListener('change', e => {
  const v = Number(e.target.value);
  if (!(Number.isFinite(v) && v > 0)) { e.target.value = String(state.settings.markSpeed); return; }
  state.settings.markSpeed = v; saveSettings(); recomputeAll();
});
$('lcReset').addEventListener('click', () => {
  const m = state.settings.material;
  state.settings.speeds[m] = JSON.parse(JSON.stringify(DEFAULT_SPEEDS[m]));
  saveSettings(); renderSpeeds(); recomputeAll();
});

// ---- downloads and print ----
const baseName = n => n.replace(/\.(dxf|dwg)$/i, '');
function save(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function downloadDxf(f) {
  save(new Blob([new Uint8Array(f.result.dxf)], { type: 'application/dxf' }), `${baseName(f.name)}-laser.dxf`);
  ga('laser_dxf_download', {});
}
$('lcZip').addEventListener('click', () => {
  const ready = state.files.filter(f => f.result && f.result.type === 'result');
  const names = uniqueNames(ready.map(f => `${baseName(f.name)}-laser.dxf`));
  const files = ready.map((f, i) => ({ name: names[i], bytes: new Uint8Array(f.result.dxf) }));
  if (!files.length) return;
  save(new Blob([zipStore(files, new Date())], { type: 'application/zip' }), 'laser-order.zip');
  ga('laser_zip_download', { files: files.length });
});

// The report prints every file with its drawing and checks (spec §10).
function buildPrint() {
  const box = $('lcPrintAll');
  box.replaceChildren();
  $('lcPrintDate').textContent = new Date().toLocaleDateString(lang());
  for (const f of state.files) {
    const sec = document.createElement('section'); sec.className = 'lc-print-file';
    const h = document.createElement('h3'); h.textContent = `${f.name} · ${t('lc.col.qty')} ${f.qty}`; sec.appendChild(h);
    if (f.result && f.result.type === 'result') {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'lc-svg lc-print-svg');
      sec.appendChild(svg);
      box.appendChild(sec);
      createDrawing(svg).show(f.result);
    } else box.appendChild(sec);
    const ul = document.createElement('ul'); ul.className = 'gv-check-list';
    for (const c of checksOf(f)) {
      const li = document.createElement('li');
      li.className = `gv-w is-${c.severity === 'info' ? 'ok' : c.severity}`;
      li.textContent = t(`lc.check.${c.id}`, Object.fromEntries(Object.entries(c.params || {}).map(([k, v]) => [k, fmtParam(v)])));
      ul.appendChild(li);
    }
    sec.appendChild(ul);
  }
}
$('lcPrint').addEventListener('click', () => { ga('laser_print', {}); window.print(); });
window.addEventListener('beforeprint', buildPrint);
window.addEventListener('afterprint', () => $('lcPrintAll').replaceChildren());

// ---- inputs ----
async function readFiles(fileList) {
  const list = [];
  for (const file of fileList) list.push({ name: file.name, bytes: await file.arrayBuffer() });
  addFiles(list, 'file');
}
$('lcFile').addEventListener('change', async e => { const fl = [...e.target.files]; e.target.value = ''; await readFiles(fl); });
document.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('gv-dragging'); });
document.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('gv-dragging'); });
document.addEventListener('drop', async e => {
  e.preventDefault(); document.body.classList.remove('gv-dragging');
  const fl = [...(e.dataTransfer && e.dataTransfer.files || [])].filter(f => /\.(dxf|dwg)$/i.test(f.name));
  if (fl.length) await readFiles(fl);
});
$('lcExample').addEventListener('click', async () => {
  const base = new URL('./examples/', import.meta.url);
  const list = [];
  for (const [name, qty] of EXAMPLE) list.push({ name, qty, bytes: await (await fetch(new URL(name, base))).arrayBuffer() });
  addFiles(list, 'example');
});
$('lcClear').addEventListener('click', () => { state.files = []; state.selected = null; drawing.clear(); render(); });
$('lcFit').addEventListener('click', () => drawing.fit());
$('lcZoomIn').addEventListener('click', () => drawing.zoomBy(1 / 1.25));
$('lcZoomOut').addEventListener('click', () => drawing.zoomBy(1.25));

// ---- CTA and survey ----
$('lcCta').addEventListener('click', () => ga('laser_cta_click', {}));
if (lsGet(SURVEY_KEY)) $('lcSurvey').hidden = true;
$('lcSurvey').addEventListener('click', e => {
  const b = e.target.closest('[data-answer]');
  if (!b) return;
  ga('laser_survey', { answer: b.dataset.answer });
  lsSet(SURVEY_KEY, b.dataset.answer);
  $('lcSurvey').querySelectorAll('[data-answer]').forEach(x => { x.disabled = true; });
  $('lcThanks').hidden = false;
});

// A language change re-renders everything built here.
document.addEventListener('gv:lang', () => {
  if (state.banner) showBanner(state.banner);
  wireSettings();
  render();
  const f = state.files.find(x => x.id === state.selected);
  if (f) $('lcFileName').textContent = f.name;
});

wireSettings();
render();
```

Run: `node _tests/extract.mjs <brief> js/laser/ui.js && node --check js/laser/ui.js && node --test "_tests/laser/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 23`, `ℹ fail 0`.

- [ ] **Step 3: First smoke run in the browser**

With the server from Task 6 running, open `http://127.0.0.1:8767/laser-dxf-checker.html?lang=en` at 1280×800 and click `#lcExample`. Wait until the table has four rows with no `…` status.
- The status cells read ✔ ✔ ⚠ ✔ (bracket, flange, cover, spacer).
- `browser_console_messages` with level `error` is empty.

Task 14 does the full pass.

- [ ] **Step 4: Commit**

```bash
git add js/laser/ui.js _tests/laser/i18n.test.js
git commit -F - <<'EOF'
Laser DXF check: controller (order table, drawing, checks, roles, settings, downloads, print)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 13: Site links

**Files:**
- Modify: `free-tools.html` (a card, 6 strings, the lede and the description), `sitemap.xml` (an entry), `llms.txt` (a line)
- Test: `_tests/laser/i18n.test.js` (one test appended)

**Interfaces:**
- Produces: the card `<a class="ft-card" href="laser-dxf-checker.html">` with `ft.laser.title` and `ft.laser.text` in el/en/it. The existing test `tools index: every key it uses exists in el, en and it` in `_tests/gcode/i18n.test.js` covers the new keys.

- [ ] **Step 1: Append the failing test**

<!-- file: _tests/private/append-t13.js -->
```js

test('the tools index, the sitemap and llms.txt list the laser check', () => {
  const ft = read('../../free-tools.html');
  assert.ok(ft.includes('<a class="ft-card" href="laser-dxf-checker.html">'));
  assert.equal(ft.split('"ft.laser.text":').length - 1, 3, 'one card text per language');
  assert.ok(read('../../sitemap.xml').includes('<loc>https://www.aidedcam.com/laser-dxf-checker.html</loc>'));
  assert.ok(read('../../llms.txt').includes('- Laser DXF check (https://www.aidedcam.com/laser-dxf-checker.html)'));
});
```

Run: `node _tests/extract.mjs <brief> _tests/private/append-t13.js && cat _tests/private/append-t13.js >> _tests/laser/i18n.test.js && rm _tests/private/append-t13.js && node --test "_tests/laser/i18n.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 5`, `ℹ fail 1`.

- [ ] **Step 2: Edit the three files**

Every replacement in the script must match the expected number of times, or it throws before writing.

<!-- file: _tests/private/edit-site-links.mjs -->
```js
// One-off site edits (plan Task 15): a laser card on the tools index, its sitemap entry and its llms.txt line.
// Every replacement must match exactly the expected number of times, or nothing is written.
import { readFileSync, writeFileSync } from 'node:fs';

const eolOf = s => (s.includes('\r\n') ? '\r\n' : '\n');
function swap(text, from, to, times, what) {
  const n = text.split(from).length - 1;
  if (n !== times) throw new Error(`${what}: expected ${times} match(es), found ${n}`);
  return text.split(from).join(to);
}

let ft = readFileSync('free-tools.html', 'utf8');
const E = eolOf(ft);
const millCard = [
  '          <p data-i18n="ft.mill.text">Κάθε κίνηση σε 3D, οι κύκλοι διάτρησης, βηματικής διάτρησης και κολαούζου αναλυμένοι σε κινήσεις, ο χρόνος ανά εργαλείο και έλεγχοι προγράμματος.</p>',
  '          <span class="ft-open" data-i18n="ft.open">Άνοιγμα →</span>',
  '        </a>',
].join(E);
ft = swap(ft, millCard, millCard + E + [
  '        <a class="ft-card" href="laser-dxf-checker.html">',
  '          <h2 data-i18n="ft.laser.title">Έλεγχος DXF για κοπή laser</h2>',
  '          <p data-i18n="ft.laser.text">Διορθώνει τα DXF και DWG μιας παραγγελίας (κενά, διπλές γραμμές, ανοιχτά περιγράμματα) και δίνει μήκος κοπής, διατρήσεις, βάρος, χρόνο και καθαρό DXF για το laser.</p>',
  '          <span class="ft-open" data-i18n="ft.open">Άνοιγμα →</span>',
  '        </a>',
].join(E), 1, 'milling card');

const strings = {
  el: ['Έλεγχος DXF για κοπή laser', 'Διορθώνει τα DXF και DWG μιας παραγγελίας (κενά, διπλές γραμμές, ανοιχτά περιγράμματα) και δίνει μήκος κοπής, διατρήσεις, βάρος, χρόνο και καθαρό DXF για το laser.'],
  en: ['Laser DXF check', 'Repairs the DXF and DWG files of an order (gaps, doubled lines, open contours) and gives cut length, pierces, weight, time and a clean DXF for the laser.'],
  it: ['Controllo DXF per taglio laser', 'Corregge i file DXF e DWG di un ordine (interruzioni, linee doppie, contorni aperti) e fornisce lunghezza di taglio, sfondamenti, peso, tempo e un DXF pulito per il laser.'],
};
const millText = {
  el: '"ft.mill.text": "Κάθε κίνηση σε 3D, οι κύκλοι διάτρησης, βηματικής διάτρησης και κολαούζου αναλυμένοι σε κινήσεις, ο χρόνος ανά εργαλείο και έλεγχοι προγράμματος.",',
  en: '"ft.mill.text": "Every move in 3D, drilling, peck and tapping cycles expanded into their moves, time per tool, and program checks.",',
  it: '"ft.mill.text": "Ogni movimento in 3D, i cicli di foratura, foratura a tratti e maschiatura scomposti in movimenti, il tempo per utensile e i controlli del programma.",',
};
for (const l of ['el', 'en', 'it']) {
  const [title, text] = strings[l];
  ft = swap(ft, millText[l], millText[l] + E + `        "ft.laser.title": "${title}",` + E + `        "ft.laser.text": "${text}",`, 1, `${l} strings`);
}
// The index now lists a tool that reads files, not programs.
ft = swap(ft, 'Το πρόγραμμά σας δεν φεύγει ποτέ από τον υπολογιστή σας.', 'Τα αρχεία σας δεν φεύγουν ποτέ από τον υπολογιστή σας.', 2, 'el lede');
ft = swap(ft, 'Your program never leaves your computer.', 'Your files never leave your computer.', 1, 'en lede');
ft = swap(ft, 'Il vostro programma non lascia mai il vostro computer.', 'I vostri file non lasciano mai il vostro computer.', 1, 'it lede');
ft = swap(ft, 'με χρόνο κύκλου και ελέγχους προγράμματος. Στον browser, χωρίς εγγραφή.',
  'με χρόνο κύκλου και ελέγχους προγράμματος, και έλεγχος DXF για κοπή laser. Στον browser, χωρίς εγγραφή.', 1, 'description');
writeFileSync('free-tools.html', ft);

let sitemap = readFileSync('sitemap.xml', 'utf8');
const S = eolOf(sitemap);
const entry = ['  <url>', '    <loc>https://www.aidedcam.com/laser-dxf-checker.html</loc>', '    <lastmod>2026-10-15</lastmod>',
  '    <changefreq>monthly</changefreq>', '    <priority>0.8</priority>', '  </url>'].join(S);
sitemap = swap(sitemap, '</urlset>', entry + S + '</urlset>', 1, 'sitemap');
writeFileSync('sitemap.xml', sitemap);

let llms = readFileSync('llms.txt', 'utf8');
const L = eolOf(llms);
const mill = llms.split(/\r?\n/).filter(x => x.startsWith('- Milling G-code viewer'));
if (mill.length !== 1) throw new Error('expected one milling line in llms.txt');
llms = swap(llms, mill[0], mill[0] + L +
  '- Laser DXF check (https://www.aidedcam.com/laser-dxf-checker.html): runs in the browser, nothing is uploaded; reads a whole '
  + 'order of DXF and DWG files (up to the 2018 format), closes small gaps, removes doubled lines, finds open contours, splits '
  + 'cut/mark/bend layers, and gives cut length, pierces, net area, weight and cutting time per part and for the order, plus a '
  + 'clean R12 DXF for the laser. Geometry engine: Eyeshot (devDept Software). Greek, English, Italian.', 1, 'llms');
writeFileSync('llms.txt', llms);
console.log('links edited');
```

Run: `node _tests/extract.mjs <brief> _tests/private/edit-site-links.mjs && node _tests/private/edit-site-links.mjs && rm _tests/private/edit-site-links.mjs && git diff --stat`
Expected:
- the script prints `links edited`;
- `free-tools.html` shows 16 insertions and 5 deletions (the diff may count one or two lines differently);
- `sitemap.xml` shows 6 insertions, and `llms.txt` shows 1.

- [ ] **Step 3: Run everything**

Run: `node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js" "_tests/laser/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 297`, `ℹ fail 0`.

- [ ] **Step 4: Commit**

```bash
git add free-tools.html sitemap.xml llms.txt _tests/laser/i18n.test.js
git commit -F - <<'EOF'
Laser DXF check: tools index card, sitemap and llms.txt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

---

### Task 14: Browser verification (Playwright MCP)

**Files:** none are committed. Screenshots go to the Playwright MCP output folder and are named `lc-*.png`.

Serve the repo root on port 8767, as in Task 6. Record every check as PASS or FAIL, with its evidence (the evaluate output, or a description of the screenshot), in the report. Put a timeout on every wait loop.

The Playwright MCP browser keeps its HTTP cache between sessions, and a cached old module hides a fix. Start by clearing the cache with `browser_run_code_unsafe`:
`async (page) => { const c = await page.context().newCDPSession(page); await c.send('Network.clearBrowserCache'); }`

The values below are for the default settings: steel, 2 mm.

To wait for the order, poll (with a 30 s limit) until `#lcTable tbody` has the expected number of rows and none has `.lc-status.is-busy`.

- [ ] **Step 1: The example order at 1280×800, `?lang=en`**

1. **Load.** Open `http://127.0.0.1:8767/laser-dxf-checker.html?lang=en`.
   - Before any click, `performance.getEntriesByType('resource')` has no URL containing `/engine/`: the page paints without the engine (spec §11).
2. **The example order.** Click `#lcExample`.
   - While the engine loads, `#lcBanner` shows `Loading the geometry engine, about 12 MB, only the first time… n %` with a rising n; it is hidden at the end.
   - The rows (file, parts, status, cut length, pierces, net area, weight, time) read:

     | File | Parts | Status | Cut length | Pierces | Net area | Weight | Time |
     |---|---|---|---|---|---|---|---|
     | `bracket.dxf` | 1 | ✔ | 0.64 m | 7 | 0.009 m² | 0.14 kg | 0:04 |
     | `flange.dxf` | 1 | ✔ | 0.89 m | 8 | 0.014 m² | 0.22 kg | 0:05 |
     | `cover.dxf` | 1 | ⚠ | 0.84 m | 3 | 0.018 m² | 0.28 kg | 0:04 |
     | `spacer.dwg` | 1 | ✔ | 0.45 m | 6 | 0.004 m² | 0.06 kg | 0:03 |

   - The quantities are 10, 4, 2 and 20.
   - `#lcTotals` reads 36 parts, `20.66 m`, `228`, `0.254 m²`, `3.98 kg`, `2:15`, and `#lcIncomplete` is hidden.
3. **The drawing.** `bracket.dxf` is selected, and `#lcChecks` reads `No issues found.`
   - Screenshot `#lcSvg` (`lc-bracket.png`). The four corners are rounded **outwards** and both slots have round ends.
   - An arc drawn inside out means the SVG sweep flag is wrong. Task 8's centre test should have caught that; report it as a failure.
4. **The cover.** Click the third row.
   - `#lcChecks` has four entries:
     - `The file states no units; millimetres were assumed.`
     - `Gaps closed: 1 (the largest 0.15 mm).`
     - `Duplicate lines removed: 1 (200 mm that would have been cut twice).`
     - `Texts moved to the TEXT layer (not cut): 1.`
   - `#lcRoles` lists three groups: CUT (CONTINUOUS, 10 curves, cut), BEND (DASHED, 1, bend) and MARK (CONTINUOUS, 1, mark).
   - The drawing has 3 `.lc-cut` paths, 1 `.lc-mark`, 1 `.lc-bend` and one `.lc-m-gap` marker, and a `.lc-text` reads `ΚΑΛΥΜΜΑ Κ-01`.
5. **Hover.** Dispatch `pointerenter` on each `.lc-cut` path. `#lcHover` reads, in some order:
   - `Hole · length 75.40 mm`
   - `Outer contour · length 599.93 mm`
   - `Hole · length 160.00 mm`
6. **Role change.** Set the BEND group's role to `cut` and dispatch `change`.
   - The cover's status becomes ✖.
   - `#lcChecks` starts `Open paths on the cut: 1 (100 mm); ask the customer.` and then `Dashed lines on the cut (layers BEND): …`.
   - There is one `.lc-open` path and two `.lc-m-open` markers.
   - The totals read `≥ 20.86 m`, `≥ 230` and `≥ 2:16`, and `#lcIncomplete` shows.
   - Set the role back to `bend`: ⚠ returns, and so do the totals of check 2.
7. **Pricing without the engine.** Set `#lcMaterial` to `aluminium` and `#lcThickness` to `3`, dispatching `change` on each.
   - Within 100 ms the totals read `2.05 kg` and `6:02`, with the length, pierces and area unchanged.
   - No row shows `.is-busy`, so there was no engine call.
   - Set them back to steel and 2.
8. **Downloads.** Hook `URL.createObjectURL` and `HTMLAnchorElement.prototype.click` in the page to capture the blob and the `download` name, then click the first row's download button and `#lcZip`.
   - The DXF is named `bracket-laser.dxf`. Its text starts `  0\r\nSECTION`, contains `AC1009`, and has the layers CUT, MARK, BEND and TEXT.
   - The ZIP is named `laser-order.zip`, starts with `PK`, and its central directory names `bracket-laser.dxf`, `flange-laser.dxf`, `cover-laser.dxf` and `spacer-laser.dxf`.
9. **Print.** `window.dispatchEvent(new Event('beforeprint'))`.
   - `#lcPrintAll` has four sections with four `svg`s, titled `bracket.dxf · Qty 10` … `spacer.dwg · Qty 20`, and `#lcPrintDate` has today's date.
   - `browser_emulate_media` `print`, then take a full-page screenshot (`lc-print.png`). It shows the header, the table with totals, and each drawing with the cover's checks. Nav, buttons, settings and CTA are hidden.
   - Set the media back to `screen`.

- [ ] **Step 2: Order edge cases**

10. **Same name, bad file.** Click `#lcClear`. Then set `#lcFile.files` from a `DataTransfer` holding three files, and dispatch `change`:
    - `part.dxf`, with the bytes of `_tests/laser/fixtures/plate-holes.dxf`;
    - `part.dxf`, with the bytes of `gaps.dxf`;
    - `notes.dxf`, holding the text `hello, not a drawing`.

    Expected:
    - statuses ⚠ ⚠ ✖;
    - selecting `notes.dxf` shows `The file could not be read (not a DXF or DWG file).`;
    - the cut-length total starts with `≥`;
    - the ZIP holds `part-laser.dxf` and `part-laser (2).dxf`.
11. **The engine can't start.** In `browser_run_code_unsafe`:
    - call `page.route('**/js/laser/engine/**', r => r.abort())`;
    - open the page, click `#lcExample`, and poll.

    `#lcBanner` reads `The geometry engine could not start in this browser.` with a `Try again` button, all four rows are ✖, and the page text still works. Call `page.unroute` afterwards.

- [ ] **Step 3: Languages and phones**

12. **Greek.** `?lang=el` with the example order:
    - the title is `AidedCAM - Έλεγχος DXF για κοπή laser`;
    - the totals read `20,66 m`, `0,254 m²` and `3,98 kg` (decimal commas);
    - `#lcSpeedsTitle` reads `Ταχύτητες: Χάλυβας`;
    - the footer notice reads `Μηχανή γεωμετρίας: Eyeshot. Portion of copyright © devDept Software S.r.l. All Rights Reserved.`
13. **Italian.** Switch the language to IT with the page's own switch:
    - the title becomes `AidedCAM - Controllo DXF per taglio laser`;
    - the pierces header reads `Sfondamenti`, and the totals label reads `Totale ordine`.
14. **Phone.** At 375×800, `?lang=el`, with the example order:
    - `document.documentElement.scrollWidth` equals `clientWidth`;
    - the parts table's wrapper and the roles table's `.gv-table-wrap` have `overflow-x: auto` and scroll inside themselves;
    - the content starts 16 px from the left edge.

    Take a full-page screenshot (`lc-375.png`).

- [ ] **Step 4: Site, network, console**

15. **Tools index.** Open `free-tools.html?lang=it`.
    - There are three `.ft-card`s: `gcode-viewer.html`, `milling-gcode-viewer.html` and `laser-dxf-checker.html` (`Controllo DXF per taglio laser`).
    - The lede ends `I vostri file non lasciano mai il vostro computer.`
    - Clicking the laser card opens the laser page, still in Italian.
16. **Viewers unchanged.**
    - `milling-gcode-viewer.html?lang=en` reaches `226 / 226 moves`.
    - `gcode-viewer.html?lang=en` shows its example with the total `2:07` and 3 time rows.
17. **Network.** On the laser page with the example order loaded, `browser_network_requests` with `static: true` and the filter `^(?!http://127\.0\.0\.1:8767/)` returns nothing. This list includes the worker's engine files. Consent is not accepted, so GA isn't loaded.
18. **Console.** `browser_console_messages` with `level: error` and `all: true` is empty. Aborted engine requests in check 11 don't count.

- [ ] **Step 5: Clean up**

- Stop the server, and confirm that `netstat -ano | grep ":8767 .*LISTENING"` prints nothing.
- Close the browser.
- Delete the downloaded files outside the repo.

Nothing is committed.

---

### Task 15: Launch preparation (stop before any push)

**Files:**
- Create: `_docs/laser-checker/real-file-check.md`
- Modify, on deploy day only: every `?v=20261015`, and the sitemap `lastmod` `2026-10-15` of the new entry

- [ ] **Step 1: The real-file record**

<!-- file: _docs/laser-checker/real-file-check.md -->
```markdown
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
```

Run: `node _tests/extract.mjs <brief> _docs/laser-checker/real-file-check.md`

- [ ] **Step 2: Deploy date**

The date strings stay `20261015` / `2026-10-15` until Aris names the deploy day. Then replace them in the laser files only; the viewers keep their own:
```bash
sed -i 's/v=20261015/v=YYYYMMDD/g' laser-dxf-checker.html js/laser/ui.js js/laser/bridge.js js/laser/worker.js
grep -rn "v=20261015" laser-dxf-checker.html js/laser/*.js    # must print nothing
node -e "const fs=require('fs');let s=fs.readFileSync('sitemap.xml','utf8');s=s.replace(/(laser-dxf-checker\.html<\/loc>\s*<lastmod>)2026-10-15/,'\$1YYYY-MM-DD');fs.writeFileSync('sitemap.xml',s)"
```

- [ ] **Step 3: Run everything**

Run:
```bash
node --test "_tests/gcode/*.test.js" "_tests/mill/*.test.js" "_tests/laser/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
dotnet test _src/laser-engine/Tests 2>&1 | tail -1
```
Expected: `ℹ pass 297`, `ℹ fail 0`, and `Passed: 39`.

- [ ] **Step 4: Commit, then stop**

```bash
git add _docs/laser-checker/real-file-check.md
git commit -F - <<'EOF'
Laser DXF check: real-file check record (to be filled before launch)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017zqFh8G2FfSsoj4wukBuJ5
EOF
```

**Stop here.** Merging and pushing `main` publishes the site; that is Aris's decision. Before any push:
- Aris runs the real files and fills `real-file-check.md` (spec §13);
- squash the branch;
- grep the whole branch history for client names: `git log -p main..HEAD | grep -i -E "<client names>"` must print nothing;
- after the push, check on the live site that the engine loads from GitHub Pages, the example order works, and the devDept notice shows (spec §15).
