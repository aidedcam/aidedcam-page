# IFC floor plans: a 3D view of the model, with the cut shown (design)

Date: 2026-10-01. Extends the live tool `ifc-plans.html` (spec `2026-10-01-ifc-plans-design.md`, "the plans spec").
Approved in chat by Aris. The design: a "3D" tab next to the plan; the model clipped above the selected storey's cut
height; hover naming the element; layer toggles shared by both views; a size limit.

## 1. Purpose

Today the tool shows only the 2D plan of each storey. The visitor never sees the model they dropped, so they cannot
check that the right storey was cut, or cut at the right height. A 3D view answers that at a glance: you look down
into the storey exactly where the plan is cut, and the plan's lines are drawn at the cut.

**Success means:**
- the visitor opens 3D, sees the whole model, and picks a storey;
- the view clips everything above that storey's cut plane, and the plan's lines show in 3D at the cut;
- typing a new cut height moves the cut in 3D as well as in the plan.

**Not the goal:** a general IFC viewer. There is no properties panel, no measuring, no tree, no sections other than
the storey cut, and no federated models. The research ruled out a standalone viewer as a product
(`general-bim-free-tools-research`); this view serves the plans.

## 2. Decisions

| Topic | Decision |
|---|---|
| Library | three.js r186, already self-hosted in `js/vendor/three/` for the milling viewer. No new dependency and no edits to `js/mill/*`. |
| Loading | three.js and the 3D module load only when the 3D tab is first opened, so the page's first paint is unchanged. |
| Geometry source | The worker's open web-ifc model, streamed again on request (`mesh3d`), not kept from the cut pass. The first result stays as lean and fast as today. |
| Camera | Orthographic, Z up, OrbitControls; the presets Top, Front, Side and Iso (Iso is the default); Fit. The same pattern as `js/mill/view3d.js`. |
| The cut | One three.js clipping plane at the selected storey's cut Z (level + cut height). A checkbox "Cut at the plan height" (on by default) switches it off to show the whole model. |
| Cut lines | The selected storey's plan polylines, already on the page, drawn as dark lines at the cut Z. No section caps. |
| Colours | A light 3D palette per layer, tinted from the plan's layer hues (§5). Glass (windows, curtain walls) is semi-transparent. |
| Rooms | IfcSpace volumes are drawn at 15% opacity, so they tint the rooms without hiding the walls. Like every layer, they start on in both views. |
| Hover | GPU picking: an element-index render to a 1×1 target under the pointer, at most one per animation frame, only while the pointer is still. The tooltip shows the IFC type, the layer, the element's Name and its storey. |
| Layer toggles | The legend items become toggle buttons. They hide a layer in **both** previews, never in the DXF. One line under the legend says so. |
| Size limit | Above **2,000,000 triangles** (desktop) or **500,000** (touch screens, or `navigator.deviceMemory` ≤ 4), the worker builds no 3D data. The tab shows "This model is too large for the 3D view in this browser; the plans are unaffected." |
| Precision | Positions leave the worker as Float32, relative to the model's bounding-box minimum, so georeferenced coordinates (~5×10⁵ m) stay exact to well under a millimetre. |

## 3. Architecture

### 3.1 Worker: a new `mesh3d` request

The bridge (`js/laser/bridge.js`, unchanged) only sends `process` messages, so the request rides on `settings`, as the
re-cut does:

```
→ { type: 'process', id, name: 'mesh3d', bytes: empty, settings: { mesh3d: true, maxTriangles } }
← { type: 'result', id, mesh3d: {
      origin: [x0, y0, z0],                       // metres, IFC world; positions below are relative to it
      layers: { IFC_WALL: { position: Float32Array, index: Uint32Array, element: Uint32Array }, … },
      elements: [{ type, layer, name, storey }],  // element[i] (per vertex) indexes this table
      triangles: n } }
← { type: 'result', id, mesh3d: null, triangles: n, reason: 'large' }      // over maxTriangles
← { type: 'error', id, reason: 'stale' }                                   // no open model (worker restarted)
```

- **One stream pass:** `StreamAllMeshes` plus `StreamAllMeshesWithTypes([IFCSPACE])`, with the same type→layer table,
  the same marker-proxy filter and the same Y-up→Z-up conversion as the cut (`model.js`'s `gather`). Elements the cut
  skips are skipped here too.
- **Packing:** per layer, every element's vertices are appended to one position array and its indices to one index
  array; a parallel per-vertex `element` array holds the element's index in `elements` (for picking). Vertices are
  not shared between elements.
- **The count first:** the worker counts triangles while it streams. Once the count passes `maxTriangles` it stops
  packing, finishes counting, and answers `mesh3d: null, reason: 'large'`.
- **Transfer:** every typed array's buffer goes in the transfer list.
- **Pure part:** the packing (`mesh3d.js`) takes `{ layer, type, name, storey, P (Float64, Z-up metres), ix }` per
  element and returns the message body. It has no web-ifc and no DOM, so Node tests pin it.

A model that has no storeys (the plans spec's "one plan named after the file") gives `storey: -1` for every element.

### 3.2 The page

**New modules:**

| Module | Job |
|---|---|
| `js/ifcplan/mesh3d.js` | Pure: packs elements into per-layer arrays, applies the triangle cap, computes the origin |
| `js/ifcplan/palette3d.js` | Pure: the 3D colour and opacity per layer |
| `js/ifcplan/view3d.js` | DOM + WebGL: scene, camera, controls, presets, Fit, clipping plane, cut lines, picking, resize, dispose |

**Changed modules:**

| Module | Change |
|---|---|
| `worker.js` | Answers the `mesh3d` request from the open model (§3.1) |
| `model.js` | Its `gather` is exported for reuse; no change in behaviour |
| `ui.js` | The tabs, lazy loading of `view3d.js`, the storey and cut-height wiring, the toggles, the 3D notes, the GA events |
| `drawing.js` | Skips hidden layers; exposes `setHidden(set)` |
| `i18n-ifcplan.js` | New strings in el, en, it (§6) |
| `ifc-plans.html` | Tab markup, the 3D container and tooltip, the cut checkbox, the presets, the toggle note |
| `css/tools.css` | New scoped `.ip-*` rules only |

**Flow:**

1. The visitor opens the 3D tab for the first time on this file.
2. The page imports `view3d.js` (which imports three.js), and checks for WebGL2. Without it, the tab shows "3D is not
   available in this browser".
3. The page sends `mesh3d`, with the cap that §2 sets for this device, and shows "Preparing the 3D view…".
4. On the result, `view3d` builds one `Mesh` per layer (`BufferGeometry`, `MeshLambertMaterial` with `flatShading`,
   the layer's colour and opacity) and fits the camera to the model.
5. The cut follows the selected storey and the cut height. A re-cut only moves the clipping plane and redraws the cut
   lines; no new `mesh3d` request.
6. A new file disposes the 3D scene (geometries, materials, render targets) and forgets the mesh. The next 3D open
   asks again.

The 3D data lives only while that file is shown. The plan tab, the downloads and the ZIP never wait for it.

## 4. The page

- **Tabs** above the preview: «Κάτοψη» | «3D». Keyboard: arrow keys move between tabs (`role="tablist"`). The plan
  tab is the default for every new file.
- **The 3D toolbar:** Top / Front / Side / Iso, Fit, and the checkbox "Cut at the plan height" (on).
- **The heading** keeps the selected storey's name: "3D · Όροφος 1 · cut at 1,10 m". With the cut off: "3D · whole
  model".
- **The storey table** drives both views: clicking a row selects that storey in the plan and moves the cut in 3D.
- **The legend** under the preview: each layer a toggle button (`aria-pressed`), shared by both views, all on for
  every new file. Under it:
  "Hiding a layer changes only the preview; the DXF keeps every layer."
- **The tooltip** in 3D: "IfcWall · IFC_WALL · Basic Wall:200mm · Ισόγειο". An element with no Name leaves that part
  out.
- **Phones:** the 3D canvas takes the full width, orbit with one finger, pan with two, pinch to zoom. No hover on
  touch, so a tap picks.

## 5. Colours (3D)

| Layer | Colour | Opacity |
|---|---|---|
| IFC_WALL | #d8d4c8 | 1 |
| IFC_SLAB | #bfbcb2 | 1 |
| IFC_COLUMN | #c98a84 | 1 |
| IFC_BEAM | #a9adb4 | 1 |
| IFC_DOOR | #6fb3c2 | 1 |
| IFC_WINDOW | #8fb4f0 | 0.45 |
| IFC_CURTAINWALL | #7fb2d6 | 0.45 |
| IFC_STAIR | #8cc29a | 1 |
| IFC_RAILING | #e0a07a | 1 |
| IFC_FURNITURE | #d8c08a | 1 |
| IFC_MEP | #cf93cf | 1 |
| IFC_OTHER | #b5b0a8 | 1 |
| IFC_SPACE | #e8c96a | 0.15 |

The cut lines use the plan's own layer colours (`LAYER_COLORS`), at 2 px.

## 6. Strings (el / en / it)

| Key | el | en | it |
|---|---|---|---|
| `ip.tab.plan` | Κάτοψη | Plan | Pianta |
| `ip.tab.3d` | 3D | 3D | 3D |
| `ip.3d.loading` | Ετοιμάζεται η προβολή 3D… | Preparing the 3D view… | Preparazione della vista 3D… |
| `ip.3d.cut` | Τομή στο ύψος της κάτοψης | Cut at the plan height | Taglio all’altezza della pianta |
| `ip.3d.whole` | ολόκληρο το μοντέλο | whole model | modello intero |
| `ip.3d.cutat` | τομή στα {h} m | cut at {h} m | taglio a {h} m |
| `ip.3d.top` / `front` / `side` / `iso` | Κάτοψη / Πρόσοψη / Πλάγια / Αξονομετρικό | Top / Front / Side / Iso | Pianta / Fronte / Lato / Iso |
| `ip.3d.large` | Το μοντέλο είναι πολύ μεγάλο για την προβολή 3D σε αυτόν τον browser· οι κατόψεις δεν επηρεάζονται. | This model is too large for the 3D view in this browser; the plans are unaffected. | Il modello è troppo grande per la vista 3D in questo browser; le piante non cambiano. |
| `ip.3d.nogl` | Η προβολή 3D δεν είναι διαθέσιμη σε αυτόν τον browser. | 3D is not available in this browser. | La vista 3D non è disponibile in questo browser. |
| `ip.3d.stale` | Ανοίξτε ξανά το αρχείο για να το δείτε σε 3D. | Open the file again to see it in 3D. | Riaprite il file per vederlo in 3D. |
| `ip.3d.failed` | Η προβολή 3D δεν μπόρεσε να φτιαχτεί· οι κατόψεις δεν επηρεάζονται. | The 3D view could not be built; the plans are unaffected. | Non è stato possibile creare la vista 3D; le piante non cambiano. |
| `ip.legend.note` | Η απόκρυψη στρώσης αλλάζει μόνο την προεπισκόπηση· το DXF κρατά όλες τις στρώσεις. | Hiding a layer changes only the preview; the DXF keeps every layer. | Nascondere un layer cambia solo l’anteprima; il DXF conserva tutti i layer. |

Italian: the typographic ’ and the formal voi, as everywhere on the site.

## 7. Errors and limits

| Situation | What happens |
|---|---|
| No WebGL2 | `ip.3d.nogl` in the 3D tab; the plan tab works as before |
| Over the triangle cap | `ip.3d.large`; GA `ifcp_view3d { result: 'large' }` |
| The worker restarted since the file loaded (`stale`) | `ip.3d.stale` |
| Timeout, engine error, or a WebGL context loss | `ip.3d.failed`; the plan tab and the downloads keep working |
| A new file while 3D is being prepared | The old answer is ignored (the `latest` token, as for loads) |

The `mesh3d` request uses the bridge's existing 120 s timeout. A 3D failure never sets the file's error banner.

## 8. GA events

Consent-gated and anonymous, as before:
- `ifcp_view3d { result: shown | large | nogl | failed }`, once per file;
- `ifcp_3d_cut { on: true | false }` when the checkbox changes;
- `ifcp_layer_toggle { layer }` when a legend toggle changes (a layer name, never a figure).

## 9. Performance targets

Headless Chrome on the development laptop:
- the example: 3D shown under 1 s after the tab click (three.js load included);
- a 13 MB IFC: under 3 s;
- moving the cut (a re-cut or a storey change): the 3D view updates in the same frame as the plan;
- hover: no frame over 50 ms while the pointer moves over a 13 MB model.

## 10. Testing

**Node:**
- `mesh3d.js`: per-layer packing, the per-vertex element index, the origin offset (a georeferenced cube keeps its
  1 mm edges exact), the cap (`null` above it, with the count), rooms kept on `IFC_SPACE`, elements with no storey.
- `palette3d.js`: every layer of the plans spec's §4 has a colour; only glass and rooms are semi-transparent.
- The worker session on the example: `mesh3d` answers with walls, slabs, doors, windows, the column, the stair, the
  railing and three rooms; the triangle count is pinned; `stale` before any file; `large` with `maxTriangles: 10`.
- Strings: every new key in el, en and it, and no ASCII `'` in Italian.

**Browser check** (`_tests/ifcplan/browser-check.js`, extended; the existing 40 steps stay):
- the 3D tab loads three.js only on first open (no three.js request before);
- after loading the example, the 3D canvas has non-background pixels;
- with the cut on and "Ισόγειο" selected, the pixels above the cut are clear (a top view rendered with the cut on
  and off differs);
- a re-cut moves the clipping plane to the new Z;
- picking at a wall's screen position names `IFC_WALL`;
- hiding IFC_WALL in the legend hides it in both views, and the DXF download still contains IFC_WALL;
- WebGL missing (a `getContext` stub) shows `ip.3d.nogl`;
- a forced cap (a test hook sets `maxTriangles` to 10) shows `ip.3d.large`;
- a new file disposes the 3D scene (the renderer's geometry count drops to 0);
- at 375 px, the tabs and the 3D canvas fit with no sideways scroll.

The other tools' browser checks (dwg 25, coverage 52, sidebar 32) still pass, and the milling viewer's 3D is untouched.

## 11. Out of scope

Section caps (filled cut faces), a properties panel, measuring, element isolation, a model tree, saving
screenshots, VR, several files, and the 3D view on the other tools.

## 12. Launch

The house pattern: plan, subagent-driven build on branch `feat/ifc-3d`, final review, local squash-merge, push only
on Aris's word. Every `js/ifcplan/` module URL moves to the placeholder `?v=20261103`, swapped on deploy day for a
value not live elsewhere (grep first). The live check: the example in 3D, the cut on and off, hover on a wall.

The repo is public: no client names, local paths or licence data in any committed file.
