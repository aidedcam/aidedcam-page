# Steel take-off and galvanizing quote from NC1 and IFC (design)

Date: 2026-10-01. Tool #8 of the free tools on www.aidedcam.com. Approved in chat by Aris, section by section.

## 1. Purpose and audience

Steel shops downstream of Tekla receive DSTV/NC1 files or the engineer's IFC, but don't own the model. The same is
true of beam-line operators, galvanizers and painters. Greece has 1,410 metal-structure firms (NACE C25.11) and 357
firms that treat and coat metals (C25.61). Galvanizers price per kilo, and painters per square metre.

The tool turns a folder of NC1 files, or one IFC, into a **quote sheet**:
- every piece, and the pieces grouped by profile and grade, with length, count, kg and m²;
- the longest and the heaviest piece;
- a galvanizing-bath fit check;
- cost lines from rates the visitor types;
- an Excel file and a printable A4 sheet, in Greek, English and Italian.

Free NC1 viewers stop at viewing. The nearest product that computes mass and area, FastCAM MTO, costs US$99 a year
and is in English only. The tool is free and ungated, like the other tools.

**Success means:**
- a shop drops a Tekla NC1 folder and gets kg and m² per piece that match the Tekla list within rounding;
- the galvanizer gets a sheet they can price from, with a bath warning on pieces that won't fit;
- an IFC of the same structure gives the same totals as its NC1 export, within 2%.

## 2. Decisions (Aris, 2026-10-01)

| Topic | Decision |
|---|---|
| Inputs | Both in v1: NC1 files (several, a folder, or a `.zip`) and one IFC |
| Test files | Public DSTV and steel IFC samples, plus our own generated example; the real-file check stays pending |
| Viewer | 3D of the selected piece (three.js); an IFC also gets a whole-model view |
| Weight and area | Nominal values are quoted; a geometry figure checks them, with ⚠ above a 5% difference |
| Rate lines | Galvanizing €/kg + zinc surcharge €/kg; painting €/m²; steel material €/kg (one rate, or per grade); minimum charge; VAT 24% |
| Gate | None: free and ungated |
| Engine | Plain JS. NC1 is parsed on the page. IFC goes through a web-ifc worker, as in the plans tool. No Eyeshot |

## 3. Architecture

**The page** is `steel-takeoff.html`, with its modules in `js/steel/`. It reuses these without editing them:
- the shared shell `js/gcode/shell/`: i18n, the language switch, settings storage, banners, consent and GA;
- `js/laser/bridge.js`, for the IFC worker (queue, timeout of 120 s, restart);
- `js/dwg/xlsx.js` (`writeXlsx`), for the Excel file;
- web-ifc 0.0.78 from `js/ifcplan/vendor/web-ifc/`. Nothing is copied; the notice is already in that folder;
- three.js r186 from `js/vendor/three/`, imported without `?v=` and only by the 3D module, which loads on first use.

The page paints instantly. web-ifc and three.js load only when needed.

**Pure modules** (no DOM; Node-tested):

| Module | Job |
|---|---|
| `nc1.js` | DSTV parser: ST header, BO holes, AK/IK contours; SI, KO, PU, KA, EN read and skipped; comment lines `**`; comma or point decimals; returns one piece or a parse error |
| `section.js` | Section area and painted perimeter from the dimensions, per profile code (I, U, L, T, RO, RU, M, C, B); used when the NC1 header leaves weight/m or paint/m empty, and for IFC profiles |
| `piece.js` | One piece's nominal kg and m², its geometry check figure, its bounding box |
| `plate.js` | Plate area from the AK contour (shoelace) minus IK contours and BO holes; weight from thickness × 7,850 kg/m³; m² = both faces + edges |
| `bath.js` | Bath fit: fits / double dip / doesn't fit |
| `quote.js` | Groups (profile + grade), totals, longest and heaviest piece, the cost lines |
| `unzip.js` | Reads a `.zip` with the browser's `DecompressionStream('deflate-raw')`; stored and deflated entries only |
| `book.js` | Builds the Excel sheets for `writeXlsx` |

**The IFC worker** (`js/steel/worker.js`, a module Web Worker on web-ifc) reads:
- IfcBeam, IfcColumn, IfcMember and IfcPlate, with their IfcElementAssembly;
- the body's IfcExtrudedAreaSolid: the profile definition (IfcIShapeProfileDef, IfcUShapeProfileDef,
  IfcLShapeProfileDef, IfcTShapeProfileDef, IfcRectangleHollowProfileDef, IfcCircleHollowProfileDef,
  IfcRectangleProfileDef, IfcCircleProfileDef, IfcArbitraryClosedProfileDef) and the extrusion depth;
- the grade from IfcMaterial's name (`S235`, `S275`, `S355`, `S450`, otherwise the name as written);
- the mark from Tekla's property sets (`Tekla Common.Part mark` or `Tekla Assembly.Assembly/Cast unit Mark`), then
  `Tag`, then `Name`;
- the geometry check from web-ifc's mesh (volume and surface).

The length unit comes from the project's units, as in the plans tool.

**The 3D view** (`js/steel/view3d.js`, three.js):
- the selected piece only: its section extruded to its length, with the end cuts from the header angles, the holes as
  cylinders cut through, and plates from their contours;
- for an IFC, the "whole model" button shows every member from the worker's meshes, coloured by grade, with the
  selected piece highlighted.

**Data that leaves the worker:** the pieces as plain objects, plus, on request, the meshes as typed arrays. The
contract follows the plans tool's: `process` messages through the bridge.

## 4. Weight and area

| Piece | Nominal kg | Nominal m² | Geometry check |
|---|---|---|---|
| NC1 profile (I, U, L, T, RO, RU, M, C) | header weight/m × length; when empty, `section.js` area × 7,850 | header paint/m × length; when empty, `section.js` perimeter × length | section area × length − holes, from the dimensions |
| NC1 plate (B) | contour area × thickness × 7,850, less inner contours and holes | both faces + edge length × thickness | the same contour from the 3D build |
| NC1 special (SO) | header weight/m × length; none → ⚠ "no weight", left out of the totals | header paint/m × length; none → ⚠ | none |
| IFC profile | section area × length × 7,850, from the profile parameters | painted perimeter × length | mesh volume × 7,850, mesh surface |
| IFC plate or arbitrary profile | profile area × thickness × 7,850 | both faces + edges | mesh volume × 7,850 |

- Lengths are in mm in NC1, and kg/m and m²/m in the header, as DSTV defines them.
- The check is ⚠ when nominal and geometry differ by more than **5%**.
- The quoted figures are always the nominal ones.
- Density **7,850 kg/m³** for every steel grade.
- Figures shown: kg to 1 decimal, m² to 2 decimals, lengths in mm.

## 5. Galvanizing bath

- Bath length × width × depth: default **12.6 × 1.3 × 1.8 m**, editable and remembered.
- A piece's box is its length × the section's two outer dimensions. A plate's box is its contour's box × thickness.
- **✓ fits:** the length fits the bath length, and the two cross dimensions fit the width and depth in either
  orientation.
- **⚠ double dip:** the length exceeds the bath length but is at most **2 × bath length**, and the cross dimensions
  fit.
- **✗ doesn't fit:** anything else.

Counts of ⚠ and ✗ appear in the summary. The sheet says the check is a guide; the galvanizer confirms.

## 6. The page

1. **Header:**
   - the title and a one-line explainer;
   - "Your files stay on your computer; nothing is uploaded";
   - the note "Figures from the files' nominal values. Check against the shop drawings".
2. **Drop zone:** "Open files", "Open folder" and "Load example". The page accepts NC1 (`.nc1`, `.nc`, any case), `.zip`
   and `.ifc`. Dropping a new set replaces the old one.
3. **Summary:** files read, files skipped, pieces (and assemblies for an IFC), total kg, total m², the longest piece,
   the heaviest piece, and the counts of ⚠ and ✗.
4. **Settings,** remembered in the browser:
   - the bath dimensions;
   - the rates: galvanizing €/kg, zinc surcharge €/kg, painting €/m², steel material €/kg, a minimum charge in €;
   - the per-grade option for steel material (S235 / S275 / S355 / other);
   - VAT 24% on or off.

   An empty rate leaves its line off the sheet.
5. **The table:**
   - grouped by profile + grade: count, total length (m), kg, m²;
   - each group expands to its pieces: mark, drawing, length, quantity, kg, m², the check (⚠ with the two figures on
     hover) and the bath mark;
   - sortable by kg, length or mark;
   - a click on a piece shows it in 3D.
6. **The 3D view:** the selected piece, with Fit and Top/Front/Side/Iso. An IFC adds "whole model".
7. **The cost block:**
   - one line per filled-in rate (galvanizing kg × rate; zinc surcharge kg × rate; painting m² × rate; material
     kg × rate, or kg per grade × rate);
   - the subtotal;
   - "minimum charge applies", when the subtotal is below it;
   - VAT;
   - the total.
8. **Outputs:**
   - "Download Excel", with four sheets in the visitor's language: pieces, groups, costs, settings;
   - "Print / PDF": an A4 quote sheet with the summary, the groups, the costs, the bath counts and the note. The page's
     print CSS hides the 3D view and the controls.
9. **The CTA block and the survey,** as on the other tools.
10. **The footer,** with the web-ifc notice (MPL-2.0, as on `ifc-plans.html`).

The page is phone-friendly. At 375 px there is no sideways page scroll, and the table scrolls inside its own box.

**Site integration:**
- a new "Steel and building products" group on `free-tools.html`, with this tool's card;
- a seventh tool in the sidebar (`js/sidebar.js`, with its icon and its el/en/it strings), whose list must match the
  cards;
- `sitemap.xml` and `llms.txt` entries.

## 7. Errors and limits

| Situation | What happens |
|---|---|
| A file that isn't NC1 (no `ST` block) | Skipped and listed by name ("not an NC1 file"); the rest load |
| A broken NC1 block | That file skipped, with the line number |
| Profile code SO, or blank, with no weight/m | Listed, with ⚠ "no weight"; left out of the totals, with the count shown |
| A length or quantity of 0 or missing | ⚠, left out of the totals |
| More than **2,000** NC1 files | The first 2,000 are read, with a note |
| A `.zip` with encryption, ZIP64, or a method other than stored/deflate | `read` error naming the reason |
| An IFC over **150 MB** | Refused before reading |
| An IFC with no IfcBeam, IfcColumn, IfcMember or IfcPlate | "No steel members found" |
| A member without an extruded profile (a brep) | Weight from the mesh volume, marked "from geometry" |
| Worker timeout (120 s) or crash | One line; the worker restarts; the page stays usable |
| No WebGL2 | The 3D view says it is not available; everything else works |

Each error is one line in the visitor's language.

## 8. GA events

Consent-gated and anonymous: never file names, marks or figures.

- `steel_loaded { kind: nc1 | zip | ifc, pieces: 1-10 | 11-100 | 101-1000 | over-1000 }`
- `steel_example`
- `steel_xlsx`
- `steel_print`
- `steel_view3d`
- `steel_error { reason }`
- The shared survey and CTA events, as on the other tools.

## 9. Performance targets

Headless Chrome on the development laptop:
- the example: under 1 s from click to table;
- 500 NC1 files: under 2 s;
- a 13 MB steel IFC: under 3 s;
- the 3D view of one piece: under 300 ms after the click (three.js load included).

## 10. The example

Written by our own generator (`_tests/steel/make-example.mjs`), deterministic, with a `--check` mode:
- **The structure:** a small portal frame with two HEA 200 columns, two IPE 300 rafters, base plates and haunch
  plates with holes, and one RHS purlin row.
- **Its NC1 files**, in `js/steel/examples/portal/` (one file per piece mark), with header weights from the
  catalogue.
- **The same frame as an IFC4 file**, `js/steel/examples/portal.ifc`, with parametric profiles and Tekla-style mark
  property sets.

The tests pin the expected kg, m² and bath marks. NC1 and IFC agree within 2%.

## 11. Testing

**Node:**
- `nc1.js`: every block type, comment lines, comma decimals, CRLF/LF, missing fields, and a file that isn't NC1;
- `section.js`: area and perimeter against catalogue values within 1% (HEA 200, IPE 300, UPN 200, L 80×8,
  RHS 100×50×4, CHS 114.3×5, a flat bar);
- `plate.js`: contour with arcs (AK radius), inner contours, holes;
- `bath.js`: fits / double dip / doesn't fit at the edges;
- `quote.js`: groups, totals, the minimum charge, VAT, the per-grade material rate;
- `book.js` and the Excel file: it re-reads through the zip it writes;
- `unzip.js`: stored and deflated entries; a refused method;
- the IFC worker on the example IFC: members, profiles, marks, grades, and the totals against the NC1 set;
- strings: every key in el, en and it; no ASCII `'` in Italian.

**Browser check** (`_tests/steel/browser-check.js` + `.cjs`, its own port):
- the example loads under 1 s;
- the table and totals match the pinned values;
- the rates change the cost block;
- the Excel file downloads and parses;
- the print CSS hides the 3D view;
- a piece click shows it in 3D, with three.js loaded only then;
- the IFC example gives the same totals;
- no sideways scroll at 375 px;
- the errors of §7.

**Other checks:** the other tools' browser checks keep passing, and the sidebar check grows to seven tools.

**By hand, not committed:** a handful of public DSTV and steel IFC samples, kept outside the repo, compared with
their published weight lists where available.

## 12. Out of scope for v1

- Nesting and cutting lists.
- DXF export of plates.
- Bolts and welds in the take-off.
- Several IFC files at once.
- Sub-assemblies of sub-assemblies (one assembly level only).
- Pricing per galvanizing class, and transport.
- A PDF library: printing uses the browser.
- An NC1 → DXF converter.

## 13. Launch

The house pattern:
1. Plan, validated in a scratch worktree, then replayed.
2. Subagent-driven build on `feat/steel-takeoff`.
3. Final review, then a local squash-merge.
4. Push only on Aris's word.
5. On deploy day, a `?v=` value not live elsewhere (grep first), and the sitemap `lastmod`.
6. A live check of the example.

The repo is public: no client names, customer files, local paths or licence data in any committed file. Public
samples stay outside the repo.
