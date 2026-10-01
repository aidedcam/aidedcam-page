# IFC floor plans, a 3D view of the model: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "3D" tab to the live IFC → DXF floor plans tool (`ifc-plans.html`). It shows the dropped model in three.js, clipped above the selected storey's cut plane, with that storey's plan lines drawn at the cut. A re-cut or a storey change moves the cut in 3D as well as in the plan. Hovering names the element. The legend's layer toggles hide a layer in both previews, never in the DXF. Above a triangle cap the tab says the model is too large. GR (default)/EN/IT.

**Architecture:**
- **Worker.** `js/ifcplan/worker.js` answers a new `mesh3d` request from the open web-ifc model. It rides on the bridge's `process` message (`name: 'mesh3d'`, empty bytes, `settings: { mesh3d: true, maxTriangles }`), as the re-cut does. One stream pass goes through `forEachElement`, the stream-and-filter loop that `cutModel` now uses too (`js/ifcplan/model.js`), so the 3D view skips exactly what the cut skips. The pure packer `js/ifcplan/mesh3d.js` builds per-layer Float32 positions relative to the model's lower corner, Uint32 indices and a per-vertex element index, and applies the cap. Every buffer is transferred.
- **Page.** `js/ifcplan/ui.js` adds the tabs, the lazy `import('./view3d.js?v=20261103')`, the storey and cut wiring, the toggles, the 3D notes and the GA events. `js/ifcplan/view3d.js` (DOM + WebGL) imports the self-hosted three.js r186 in `js/vendor/three/` without a `?v=`, as the milling viewer does. It has an orthographic Z-up camera, OrbitControls, the presets Top/Front/Side/Iso and Fit. It also handles one clipping plane, the cut lines (LineSegments2), GPU picking into a 1×1 render target, and disposal. `js/ifcplan/palette3d.js` holds the 3D colours, and `state.js` the triangle cap and the tooltip's parts. `drawing.js` gains `setHidden`.
- **Unchanged:** `js/laser/bridge.js`, `js/vendor/*`, `js/mill/*` and every other tool's files.

**Tech Stack:** plain ES modules; three.js r186 (MIT, already vendored); web-ifc 0.0.78 (already vendored); `node --test` (Node 24); the browser check drives headless Chrome 154 through `playwright-core`; the static GitHub Pages site.

**Spec:** `_docs/ifc-plans/2026-10-01-ifc-3d-view-design.md` (7329f34). Background: `2026-10-01-ifc-plans-design.md` and `2026-10-01-ifc-plans-plan.md` (this plan follows its format). Where this plan departs from the spec, the departure is listed under "Spec refinements" with its reason.

**Validated before writing.** Every block below was built and run in the scratch worktree `scratch/ifc3d-validate` (from `feat/ifc-3d` at 7329f34). Every block was checked against the validated file with `node _tests/extract.mjs <plan> <path> --check`. The whole plan was then replayed on a fresh worktree (see "Replay" at the end).
- **Node:** `node --test $(git ls-files '_tests/**/*.test.js')` passes 515 (493 before; the ifcplan suites go from 74 to 96).
- **Browser:** `_tests/ifcplan/browser-check.js` passes 59/59 (the 40 earlier checks kept, 19 new). Run in Chrome 154 headless on the development laptop:
  - The example, from the 3D tab click to the view's first frame, three.js included: 107–135 ms.
  - The worker packs the example's 340 triangles (22 elements) in 6 ms.
  - The other checks still pass: dwg 25/25, coverage 52/52, sidebar 32/32.
- **The 13 MB target (spec §9).** `Ifc4_Revit_ARC.ifc`, a public sample (13.6 MB, 351,817 triangles, 442 elements), was downloaded outside the repo and run with `BIG=<path>`. Its 3D view took 199–255 ms (255 in the replay). The worst frame while the pointer moved over it was 17 ms (spec: under 3 s and under 50 ms).
- **WebGL headless.** Chrome 154's headless mode gives WebGL2 on the GPU by default (ANGLE on Direct3D 11), and needs no flags. SwiftShader also passes 59/59 with `--use-angle=swiftshader --enable-unsafe-swiftshader` (the runner's `GL=swiftshader`), for a machine without a usable GPU.
- **The other tools are untouched:** `git diff --stat 7329f34 -- js/laser js/dwg js/coverage js/gcode js/mill js/vendor _src js/sidebar.js css/sidebar.css laser-dxf-checker.html dwg-quantities.html coverage-precheck.html milling-gcode-viewer.html gcode-viewer.html free-tools.html sitemap.xml llms.txt` is empty. `node _tests/ifcplan/make-example.mjs --check` prints `same`.

## Global Constraints

- **Public repo** (github.com/aidedcam/aidedcam-page). No client names, customer data, local user paths or licence data in any committed file, test, doc or commit message. IFC files other than the generated example stay outside the repo (the large-file run takes its path from `BIG`, never from a committed file).
- **Commits:** the repo-local git email is akoulousis@aidedcam.com (Task 0 checks it). Every commit ends with exactly:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
  ```
- **Never push, merge or amend `main`.** Pushing `main` publishes the live site, and only Aris decides that.
- **Languages:** GR (default)/EN/IT for every visible string. Italian uses the formal voi and the typographic ’ (no ASCII `'` in Italian strings). The page carries its Greek strings inline.
- **Layout:** at 375 px, no horizontal page scroll (a 16 px side gutter, as before). The 3D canvas takes the full width.
- **Other tools must not change.** Never edit `js/mill/*`, `js/vendor/*`, `js/laser/*` (the bridge is imported unchanged), `js/dwg/*`, `js/coverage/*`, `js/gcode/*`, `_src/*`, the sidebar (`js/sidebar.js`, `css/sidebar.css`) or their pages. `css/tools.css` is shared, and this plan only appends scoped `.ip-*` rules to it.
- **three.js is imported without a `?v=`** (`../vendor/three/three.module.js` and `../vendor/three/addons/*.js`). The addons import `../three.module.js` without one, so a `?v=` on ours would load a second three.js instance. Only `view3d.js` imports three.js, and only `ui.js` imports `view3d.js`, through a dynamic `import()`.
- **Cache-busting:** `?v=20261103` is a placeholder (no live page uses it), replaced on deploy day (Task 11). It is on every relative import in `js/ifcplan/*.js` except the shared shell (`../gcode/shell/`), three.js (no `?v=`) and the laser modules (`../laser/bridge.js` and `../laser/zip.js` keep `?v=20261001`; they are unchanged). It is also on the worker URL, the web-ifc import and its `.wasm`, the example's fetch, and the page's `css/tools.css`, `i18n-ifcplan.js` and `ui.js`. `_tests/ifcplan/site.test.js` pins all of this.
- **Spec values:**
  - the triangle cap: **2,000,000**, or **500,000** on a touch screen (a coarse primary pointer) or with `navigator.deviceMemory` ≤ 4;
  - the request uses the bridge's existing **120 s** timeout;
  - the 3D colours and opacities of spec §5;
  - the cut lines in the plan's `LAYER_COLORS` at **2 px**;
  - rooms at **15 %**, glass at **45 %**.
- **GA** (consent-gated, anonymous): `ifcp_view3d { result: shown | large | nogl | failed }` once per file; `ifcp_3d_cut { on }`; `ifcp_layer_toggle { layer }` (a layer name, never a figure or a file name).
- **Tests:**
  - Node, from the repo root: `node --test $(git ls-files '_tests/**/*.test.js')` (tracked files; the TDD steps run `node --test "_tests/ifcplan/*.test.js"`, which also sees a new, untracked test file).
  - Browser checks: `_tests/ifcplan/browser-check.cjs` (port 8793), `_tests/dwg/browser-check.cjs` and `_tests/coverage/browser-check.cjs` (port 8765), `_tests/sidebar/browser-check.cjs` (port 8811). Each one serves the repo root with `python -m http.server <port> --bind 127.0.0.1`. Stop every server you start (Task 10, Step 4).
- **Whole files are extracted, never retyped.**
  - Every created or changed file is given whole, once, at its final content: a line `<!-- file: <path> -->` followed immediately by a fenced block. That includes large existing files (`ifc-plans.html`, `css/tools.css`, `js/ifcplan/ui.js`, `js/ifcplan/model.js`).
  - Write a file with `node _tests/extract.mjs $PLAN <path>`, and check it with the same command plus `--check`, where `PLAN=_docs/ifc-plans/2026-10-01-ifc-3d-view-plan.md`. Set `PLAN` in every shell you run steps in.
  - A body never contains a line of exactly three backticks.
  - **The one exception is Task 1's interim rename.** `site.test.js` pins the placeholder for every module from Task 1 on. So Task 1 renames `?v=20261001` to `?v=20261103` with `sed` in the seven files that a later task gives whole (`drawing.js`, `model.js`, `state.js`, `ui.js`, `worker.js`, `ifc-plans.html`, `browser-check.js`). `dxf.js`, which changes only for the rename, is given whole in Task 1.

## Review Focus

These are five failure modes the spec implies but its test list doesn't name. Each is pinned by a test in its owning task:

1. **three.js loaded twice.** A `?v=` on our three.js import would make a second instance next to the one the addons import. OrbitControls and LineSegments2 would then fail `instanceof` checks, or render nothing, with no error. *Pinned by `site.test.js` `every IFC floor plans module URL carries the deploy placeholder …`: shell and three.js imports carry no `?v=`. Also by `three.js loads only with the 3D view …`: only `view3d.js` imports three.js, and `ui.js` never statically (Task 1).*
2. **Picking silently dead.** three.js binds a `Uint32Array` attribute as an integer (`vertexAttribIPointer`). A `float` shader input then draws nothing, and Chrome only logs a `GL_INVALID_OPERATION` *warning*, which a console-error check misses. This happened while validating. *Pinned by the browser check's hover checks (`hover over the south wall in Iso …`, `top view: the cut shows the ground floor, without it the roof`). Also by its console filter, which now counts `GL_INVALID` and `CONTEXT_LOST` messages of any level (Task 10).*
3. **The 3D view and the plan disagreeing on what exists.** A marker proxy drawn in 3D but not in the plan, or an element outside every storey crashing the tooltip. *Pinned by `worker.test.js` `mesh3d skips what the cut skips (a marker proxy); an element outside the storeys has storey -1` (Task 4); `state.test.js` `the 3D tooltip: …` (Task 5).*
4. **web-ifc vertices that are NaN** (they occur in real exports; the plans tool already guards its bounding box). In three.js a NaN position makes the bounding sphere NaN and logs a console error, and can blank the view. *Pinned by `mesh3d.test.js` `a vertex web-ifc gives as NaN drops its triangles and sits at the origin …` (Task 3).*
5. **A browser without `navigator.deviceMemory`** (Firefox, Safari), or a laptop with a touch screen. Read naively, the cap would fall to the phone value, or to none. *Pinned by `state.test.js` `the 3D triangle cap: …`: unknown memory gives the desktop cap, and only a coarse pointer or ≤ 4 GB gives 500,000 (Task 5).*

Also pinned: `mesh3d` before any file answers `stale` (`worker.test.js`, Task 4). A new file's answer replaces the old scene (browser check `a new file disposes the 3D scene …`, Task 10).

## Spec refinements made while validating this plan

Each one is recorded here so the reviewers can check it against the spec, and so Aris can accept or reverse it.

1. **The origin comes from the worker, not from the packer.** Spec §3.2 says `mesh3d.js` "computes the origin". Instead, `createPacker({ origin, maxTriangles })` takes the model's bounding-box minimum, which the worker already holds from the cut (`file.bbox`), so positions become relative as they stream. Computing it in the packer would mean keeping every element's Float64 copy until the end (about 72 MB at the 2,000,000 cap).
2. **`model.js` exports more than `gather`.** It also exports `typeNamer`, `nameOf` and `forEachElement`, the stream-and-filter loop (products, then rooms; no triangles, no finite vertex and marker proxies skipped). `cutModel` now streams through `forEachElement` too, so "elements the cut skips are skipped here too" holds by construction. The cut's behaviour is unchanged: `model.test.js` passes unchanged.
3. **The reply also carries `name`**, the open file's, as a re-cut's reply does: `{ type: 'result', id, name, mesh3d: {…} }` and `{ type: 'result', id, name, mesh3d: null, triangles, reason: 'large' }`.
4. **NaN vertices** (see Review Focus 4) are written at the origin and their triangles dropped. `triangles` still counts what web-ifc gave.
5. **Rooms are not picked.** Their volumes share the walls' inner faces and cover them, so a hover would name the room instead of the wall it points at. A hover inside a room names the wall or the floor slab behind.
6. **"Only while the pointer is still"** is read as "never while a button is held (orbiting or panning)". Otherwise at most one pick runs per animation frame, at the latest pointer position. The 13 MB sample's worst frame was 17 ms.
7. **Pure helpers in `state.js`:** `triangleCap({ coarse, memoryGB })` and `tipParts(element, storeys)`.
   - A "touch screen" is a coarse primary pointer (`matchMedia('(pointer: coarse)')`). Laptops with touch screens keep the desktop cap.
   - An unknown `deviceMemory` gives the desktop cap.
   - The test hook `window.__ifcp.maxTriangles`, when a number, overrides the cap.
8. **Three strings beyond spec §6:**
   - `ip.aria.tabs` (Προβολή / View / Vista), the tab list's label;
   - `ip.aria.3d`, the 3D canvas's label;
   - Fit reuses `ip.fit`.
9. **Hiding IFC_SPACE also hides the plan's room labels.** They belong to the rooms, and the legend has no IFC_SPACE_TEXT entry.
10. **In the 3D tab, the legend lists the model's layers as well as the storey plan's** (slabs, for instance, which the plan at 1.10 m does not cut), so every 3D layer can be toggled. In the plan tab it lists the plan's layers, as before.
11. **A `stale` answer is sent to GA as `failed`.** Spec §8's results are `shown | large | nogl | failed`; the visitor sees `ip.3d.stale`.
12. **The cut lines sit 3 mm above the cut plane** (`LIFT`), clear of the clipped faces. They are drawn per layer, so a toggle hides them too, and with the cut off they are not drawn. The heading shows the cut height above the storey level, as the plan does: "3D · Ισόγειο · τομή στα 1,10 m".
13. **The checkbox "Cut at the plan height"** keeps its state while the page is open, across files. It is not stored.
14. **A lost WebGL context** shows `ip.3d.failed` and drops the 3D view. The next file makes a new one.
15. **The tabs:** the arrow keys, Home and End move between the tabs and select them (automatic activation).
16. **The 3D time** (`window.__ifcp.timings.view3d`) runs from the tab click to the view's first frame. It includes loading three.js, the worker's `mesh3d` and building the scene.
17. **The page's `css/tools.css` reference** moves to the placeholder too, because the file gains rules (the other pages keep their own `?v=`). On deploy day the sitemap's `lastmod` for `ifc-plans.html` moves to the deploy date, as the page changes (Task 11).
18. **Two more Node test files**: `view3d.test.js` (the pure helpers of `view3d.js`: presets, picking colours, cut segments; three.js imports in Node) and `page3d.test.js` (the markup, the controller's wiring, the scoped CSS).
19. **The browser check** gains `GL=swiftshader` (software WebGL) and `BIG=<path>` (the large-file timing, never a committed file), and treats WebGL `GL_INVALID` and `CONTEXT_LOST` console messages as errors.
20. **The tasks** are 0–11. Task 1 moves the placeholder before any other change, so `site.test.js` holds from the first commit.

## File structure

| Path | Task | Responsibility |
|---|---|---|
| `_tests/ifcplan/site.test.js`, `js/ifcplan/dxf.js` | 1 | The placeholder `?v=20261103` everywhere; three.js only with the 3D view |
| `js/ifcplan/palette3d.js`, `_tests/ifcplan/palette3d.test.js` | 2 | The 3D colour and opacity per layer (spec §5) |
| `js/ifcplan/mesh3d.js`, `_tests/ifcplan/mesh3d.test.js` | 3 | Packs elements into per-layer arrays; the cap |
| `js/ifcplan/model.js`, `js/ifcplan/worker.js`, `_tests/ifcplan/worker.test.js` | 4 | `forEachElement`; the worker's `mesh3d` answer |
| `js/ifcplan/state.js`, `_tests/ifcplan/state.test.js` | 5 | The triangle cap per device; the tooltip's parts |
| `js/ifcplan/drawing.js`, `_tests/ifcplan/drawing.test.js` | 6 | The plan preview's hidden layers |
| `js/ifcplan/i18n-ifcplan.js`, `_tests/ifcplan/i18n.test.js` | 7 | The strings (spec §6) in el, en, it |
| `js/ifcplan/view3d.js`, `_tests/ifcplan/view3d.test.js` | 8 | The three.js view |
| `ifc-plans.html`, `css/tools.css`, `js/ifcplan/ui.js`, `_tests/ifcplan/page3d.test.js` | 9 | The tabs, the toolbar, the toggles, the controller |
| `_tests/ifcplan/browser-check.js`, `browser-check.cjs` | 10 | The browser check (59) and its runner |
| (deploy day) | 11 | The placeholder swap |

---

### Task 0: Starting point

Nothing is written in this task. It checks that the tools and the baseline are as this plan expects.

**Files:** none.

**Interfaces:**
- Produces: a known baseline for Tasks 1–11: Node 493 (ifcplan 74); the placeholder `20261103` unused; WebGL2 in headless Chrome; ports 8793, 8765 and 8811 free.

- [ ] **Step 1: Check the starting point**

Run (Git Bash, repo root):
```bash
PLAN=_docs/ifc-plans/2026-10-01-ifc-3d-view-plan.md
git branch --show-current && git log --oneline -1
git config user.email
node --version
node --test $(git ls-files '_tests/**/*.test.js') 2>&1 | grep -E "^ℹ (pass|fail)"
node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
grep -rln "20261103" --include=*.html --include=*.js --include=*.css --include=*.xml . | grep -v "^./_docs/" ; echo "placeholder check done"
```
Expected:
- the branch is `feat/ifc-3d` (or the worktree's own branch), and HEAD is the commit that adds this plan (or 7329f34 with this plan copied in);
- the email is `akoulousis@aidedcam.com` (if not: `git config --local user.email akoulousis@aidedcam.com`);
- Node `v24.x`;
- `ℹ pass 493`, `ℹ fail 0`, then `ℹ pass 74`, `ℹ fail 0`;
- nothing listed before `placeholder check done`.

- [ ] **Step 2: The browser tooling, and WebGL2 headless**

Run:
```bash
node -e "const p=require('path'),fs=require('fs'),d=p.join(require('os').homedir(),'AppData','Local','npm-cache','_npx');const c=fs.readdirSync(d).map(x=>p.join(d,x,'node_modules','playwright-core')).find(fs.existsSync);require(c).chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}).then(async b=>{const g=await (await b.newPage()).evaluate(()=>!!document.createElement('canvas').getContext('webgl2'));console.log('webgl2',g,b.version());await b.close()})"
python --version
for port in 8793 8765 8811; do netstat -ano | grep -q ":$port .*LISTENING" && echo "port $port busy" || echo "port $port free"; done
```
Expected: `webgl2 true 154.…`, a Python 3 version, and the three ports free. If `webgl2 false`, run the browser checks of Task 10 with `GL=swiftshader`. If playwright-core is not found, run `npx playwright --version` once (or set `PW_CORE`).

No commit: nothing changed.

---

### Task 1: The placeholder, and three.js only with the 3D view

**Files:**
- Modify: `_tests/ifcplan/site.test.js` (its placeholder test rewritten; one test added), `js/ifcplan/dxf.js` (its three imports move to `?v=20261103`)
- Modify by an interim rename (each given whole later): `js/ifcplan/drawing.js` (Task 6), `model.js` and `worker.js` (Task 4), `state.js` (Task 5), `ui.js` and `ifc-plans.html` (Task 9), `_tests/ifcplan/browser-check.js` (Task 10)

**Interfaces:**
- Produces: every `js/ifcplan` module URL on `?v=20261103`, with the shell, three.js and laser exceptions of the Global Constraints. The test reads every `.js` in `js/ifcplan/`, so the modules of later tasks are held to it as they arrive.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/ifcplan/site.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout has CRLF

test('the tools index, the sitemap and llms.txt list the IFC floor plans', () => {
  const ft = read('../../free-tools.html');
  assert.ok(ft.includes('<a class="ft-card" href="ifc-plans.html">'));
  const eng = ft.slice(ft.indexOf('data-i18n="ft.group.eng"'), ft.indexOf('</section>', ft.indexOf('data-i18n="ft.group.eng"')));
  assert.ok(eng.includes('href="ifc-plans.html"'), 'in the Engineering offices group');
  assert.equal(ft.split('"ft.ifcplans.title":').length - 1, 3, 'one card title per language');
  assert.equal(ft.split('"ft.ifcplans.text":').length - 1, 3, 'one card text per language');
  const sm = read('../../sitemap.xml');
  assert.ok(sm.includes('<loc>https://www.aidedcam.com/ifc-plans.html</loc>\n    <lastmod>2026-10-01</lastmod>'), 'with the lastmod placeholder');
  assert.ok(read('../../llms.txt').includes('- DXF floor plans from IFC (https://www.aidedcam.com/ifc-plans.html)'));
});

test('the page: canonical, the web-ifc notice with its link, the indicative note, and no Eyeshot', () => {
  const page = read('../../ifc-plans.html');
  assert.ok(page.includes('<link rel="canonical" href="https://www.aidedcam.com/ifc-plans.html" />'));
  assert.ok(page.includes('<span data-i18n="ip.notice">Ανάγνωση IFC: web-ifc (ThatOpen Company), MPL-2.0,</span> <a href="https://github.com/ThatOpen/engine_web-ifc" rel="noopener" data-i18n="ip.notice.link">'));
  assert.ok(page.includes('data-i18n="ip.indicative"'));
  assert.ok(page.includes('data-i18n="ip.v1"'));
  assert.ok(!/devDept|Eyeshot/i.test(page), 'web-ifc only');
  assert.ok(!/src="[^"]*vendor\//.test(page), 'web-ifc loads in the worker, on the first file');
  for (const f of readdirSync(new URL('../../js/ifcplan/', import.meta.url)).filter(n => n.endsWith('.js'))) {
    assert.ok(!/eyeshot|devdept|dotnet/i.test(read(`../../js/ifcplan/${f}`)), f);
  }
});

test('consent, GA and the language switcher are those of the DWG quantities page', () => {
  const a = read('../../dwg-quantities.html'), b = read('../../ifc-plans.html');
  const between = (s, from, to) => s.slice(s.indexOf(from), s.indexOf(to, s.indexOf(from)));
  for (const [from, to] of [['<!-- Google Analytics', '</script>'], ['<!-- COOKIE CONSENT BANNER', '  <script src='], ["    // The tool's strings first", '  </script>'], ['<div class="lang-switcher">', '</div>']]) {
    const x = between(a, from, to).replace('DQ_I18N', 'XX_I18N'), y = between(b, from, to).replace('IP_I18N', 'XX_I18N');
    assert.ok(x.length > 20, from);
    assert.equal(y, x, from);
  }
  const strings = s => [...s.matchAll(/"(cookie_[a-z_]+|footer\.[a-z_]+)": "([^"]*)"/g)].map(m => m[0]).join('\n');
  assert.equal(strings(b), strings(a));
});

test('every IFC floor plans module URL carries the deploy placeholder ?v=20261103; the shared modules are reused unchanged', () => {
  const page = read('../../ifc-plans.html');
  for (const u of ['css/tools.css?v=20261103', 'js/ifcplan/i18n-ifcplan.js?v=20261103', 'js/ifcplan/ui.js?v=20261103']) assert.ok(page.includes(u), u);
  assert.ok(!page.includes('?v=20261001'), 'the page keeps no earlier placeholder');
  // Every relative import of every module: the tool's own carry the placeholder; the shared shell and three.js carry
  // none (three.js is one module instance with its addons, which import it without one); the laser modules keep theirs.
  let n = 0;
  for (const f of readdirSync(new URL('../../js/ifcplan/', import.meta.url)).filter(x => x.endsWith('.js'))) {
    const src = read(`../../js/ifcplan/${f}`);
    for (const m of src.matchAll(/(?:from |import\()'(\.[^']+)'/g)) {
      n++;
      const u = m[1];
      if (u.includes('/gcode/shell/') || u.includes('/vendor/three/')) assert.ok(!u.includes('?v='), `${f}: ${u}`);
      else if (u.startsWith('../laser/')) assert.ok(u.endsWith('?v=20261001'), `${f}: ${u}`);
      else assert.ok(u.endsWith('?v=20261103'), `${f}: ${u}`);
    }
  }
  assert.ok(n >= 20, `${n} imports`);
  const ui = read('../../js/ifcplan/ui.js'), worker = read('../../js/ifcplan/worker.js');
  assert.ok(ui.includes("new URL('./worker.js?v=20261103', import.meta.url)"));
  assert.ok(ui.includes("from '../laser/bridge.js?v=20261001'") && ui.includes("from '../laser/zip.js?v=20261001'"));
  assert.ok(ui.includes('./examples/${EXAMPLE}?v=20261103'));
  assert.ok(worker.includes("'./vendor/web-ifc/web-ifc-api.js?v=20261103'") && worker.includes('`./vendor/web-ifc/${file}?v=20261103`'));
  assert.ok(!read('../../js/laser/bridge.js').includes('ifcplan') && !read('../../js/laser/zip.js').includes('ifcplan'));
});

test('three.js loads only with the 3D view: not on the page, not imported statically by the controller', () => {
  const page = read('../../ifc-plans.html'), ui = read('../../js/ifcplan/ui.js');
  assert.ok(!page.includes('vendor/three'), 'the page has no three.js tag');
  assert.ok(!/from '\.\/view3d\.js/.test(ui), 'ui.js imports view3d.js only on demand');
  for (const f of readdirSync(new URL('../../js/ifcplan/', import.meta.url)).filter(x => x.endsWith('.js') && x !== 'view3d.js')) {
    assert.ok(!read(`../../js/ifcplan/${f}`).includes('vendor/three'), `${f} does not import three.js`);
  }
});
```

Run: `node _tests/extract.mjs $PLAN _tests/ifcplan/site.test.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 74`, `ℹ fail 1` (the placeholder test: `css/tools.css?v=20261103`).

- [ ] **Step 2: Move the placeholder**

<!-- file: js/ifcplan/dxf.js -->
```js
// IFC floor plans: one storey's plan as an R12 DXF (spec §5). Pure: no DOM, no web-ifc.
// AC1009 under $DWGCODEPAGE ANSI_1253, so Greek text is written as Windows-1253 bytes; POLYLINE/VERTEX/SEQEND (no
// LWPOLYLINE in R12) and TEXT; every layer of spec §4 in the table, whether or not this storey uses it.
import { LAYERS } from './layers.js?v=20261103';
import { forEachPolyline } from './chain.js?v=20261103';
import { labelLines } from './rooms.js?v=20261103';

// The drawing units the visitor chooses: the factor from metres and the $INSUNITS code.
export const UNITS = { m: { factor: 1, insunits: 6 }, cm: { factor: 100, insunits: 5 }, mm: { factor: 1000, insunits: 4 } };
export const TEXT_HEIGHT_M = 0.2;          // room labels, in metres of the model (200 in mm, 20 in cm)
const LINE_STEP = 1.6;                     // the labels' line spacing, in text heights

// Windows-1253, bytes 0x80–0xFF (U+FFFD where the code page has no character).
const HIGH = '€�‚ƒ„…†‡�‰�‹�����‘’“”•–—�™�›����' +
  ' ΅Ά£¤¥¦§¨©�«¬­®―°±²³΄µ¶·ΈΉΊ»Ό½ΎΏ' +
  'ΐΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡ�ΣΤΥΦΧΨΩΪΫάέήί' +
  'ΰαβγδεζηθικλμνξοπρςστυφχψωϊϋόύώ�';
const TO_1253 = new Map([...HIGH].map((c, i) => [c, 0x80 + i]).filter(([c]) => c !== '�'));
export const CP1253_HIGH = HIGH;

// A string as Windows-1253 bytes, composed first (NFC), so decomposed Greek and the polytonic acute (U+1F71 → ά)
// are written. A character the code page lacks becomes '?', and is counted.
export function cp1253(s) {
  const out = [];
  let replaced = 0;
  for (const ch of String(s).normalize('NFC')) {
    const c = ch.codePointAt(0);
    if (c < 0x80) { out.push(c); continue; }
    const b = TO_1253.get(ch);
    if (b === undefined) { out.push(0x3f); replaced++; } else out.push(b);
  }
  return { bytes: Uint8Array.from(out), replaced };
}

// How many characters of these strings Windows-1253 can't hold, once composed as cp1253 composes them.
export function unencodable(strings) {
  let n = 0;
  for (const s of strings) for (const ch of String(s == null ? '' : s).normalize('NFC')) if (ch.codePointAt(0) >= 0x80 && !TO_1253.has(ch)) n++;
  return n;
}

// "Move to origin": the model's lower-left corner, rounded down to whole metres.
export function originShift(bbox) {
  return { x: Math.floor(bbox.x0), y: Math.floor(bbox.y0) };
}

// A real: at most 6 decimals, always with a decimal point, never "-0", never NaN or Infinity (written 0).
export function num(v) {
  if (!Number.isFinite(v)) return '0.0';
  let s = String(+v.toFixed(6));
  if (s === '-0') s = '0';
  return /[.e]/.test(s) ? s : `${s}.0`;
}

const line = s => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ');
const fmtM = (v, d) => (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d);

// The plan of one storey. storey: { name, levelM, layers: { LAYER: packed polylines }, rooms: [{ name, longName,
// areaM2, at: [x, y] }] }, in metres in the IFC's coordinates. source: the IFC file name; units: 'm' | 'cm' | 'mm';
// shift: null, or { x, y } in metres subtracted from every coordinate. Returns { bytes, replaced }.
export function storeyDxf({ storey, source, cutM, units = 'm', shift = null }) {
  const u = UNITS[units] || UNITS.m;
  const f = u.factor, sx = shift ? shift.x : 0, sy = shift ? shift.y : 0;
  const X = x => (x - sx) * f, Y = y => (y - sy) * f;
  const out = [];
  const g = (code, value) => { out.push(String(code).padStart(3), value); };
  const unit = units in UNITS ? units : 'm';
  g(999, `IFC floor plan from aidedcam.com/ifc-plans.html`);
  g(999, `Source: ${line(source)}`);
  g(999, `Storey: ${line(storey.name)}, level ${fmtM(storey.levelM, 3)} m`);
  g(999, `Cut: ${fmtM(cutM, 2)} m above the storey level, at ${fmtM(storey.levelM + cutM, 3)} m`);
  g(999, `Units: ${unit}`);
  g(999, shift
    ? `Shift: X ${String(-sx * f)} ${unit}, Y ${String(-sy * f)} ${unit}; add it back to return to the IFC's coordinates`
    : `Shift: none; the IFC's coordinates`);

  // Entities first, to know the extents.
  const ents = [];
  const e = (code, value) => { ents.push(String(code).padStart(3), value); };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const extend = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
  for (const l of LAYERS) {
    const set = storey.layers && storey.layers[l.name];
    if (!set) continue;
    forEachPolyline(set, (pts, closed) => {
      if (pts.length < 4) return;
      e(0, 'POLYLINE'); e(8, l.name); e(66, '1'); e(10, '0.0'); e(20, '0.0'); e(30, '0.0'); e(70, closed ? '1' : '0');
      for (let i = 0; i < pts.length; i += 2) {
        const x = X(pts[i]), y = Y(pts[i + 1]);
        extend(x, y);
        e(0, 'VERTEX'); e(8, l.name); e(10, num(x)); e(20, num(y)); e(30, '0.0');
      }
      e(0, 'SEQEND'); e(8, l.name);
    });
  }
  const h = TEXT_HEIGHT_M * f;
  const texts = [];
  for (const r of storey.rooms || []) {
    if (!r.at) continue;
    const lines = labelLines(r);
    lines.forEach((t, i) => {
      const x = X(r.at[0]), y = Y(r.at[1]) + ((lines.length - 1) / 2 - i) * LINE_STEP * h;
      extend(x, y);
      texts.push(t);
      e(0, 'TEXT'); e(8, 'IFC_SPACE_TEXT'); e(10, num(x)); e(20, num(y)); e(30, '0.0'); e(40, num(h)); e(1, line(t));
      e(72, '1'); e(73, '2'); e(11, num(x)); e(21, num(y)); e(31, '0.0');
    });
  }
  if (x0 > x1) x0 = y0 = x1 = y1 = 0;

  g(0, 'SECTION'); g(2, 'HEADER');
  g(9, '$ACADVER'); g(1, 'AC1009');
  g(9, '$DWGCODEPAGE'); g(3, 'ANSI_1253');
  g(9, '$INSUNITS'); g(70, String(u.insunits));
  g(9, '$EXTMIN'); g(10, num(x0)); g(20, num(y0)); g(30, '0.0');
  g(9, '$EXTMAX'); g(10, num(x1)); g(20, num(y1)); g(30, '0.0');
  g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'TABLES');
  g(0, 'TABLE'); g(2, 'LTYPE'); g(70, '1');
  g(0, 'LTYPE'); g(2, 'CONTINUOUS'); g(70, '0'); g(3, 'Solid line'); g(72, '65'); g(73, '0'); g(40, '0.0');
  g(0, 'ENDTAB');
  g(0, 'TABLE'); g(2, 'LAYER'); g(70, String(LAYERS.length + 1));
  for (const l of [{ name: '0', aci: 7 }, ...LAYERS]) { g(0, 'LAYER'); g(2, l.name); g(70, '0'); g(62, String(l.aci)); g(6, 'CONTINUOUS'); }
  g(0, 'ENDTAB');
  g(0, 'TABLE'); g(2, 'STYLE'); g(70, '1');
  g(0, 'STYLE'); g(2, 'STANDARD'); g(70, '0'); g(40, '0.0'); g(41, '1.0'); g(50, '0.0'); g(71, '0'); g(42, num(h)); g(3, 'arial.ttf'); g(4, '');
  g(0, 'ENDTAB');
  g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'ENTITIES');
  for (const v of ents) out.push(v);
  g(0, 'ENDSEC');
  g(0, 'EOF');
  return cp1253(out.join('\r\n') + '\r\n');
}
```

Run:
```bash
node _tests/extract.mjs $PLAN js/ifcplan/dxf.js
sed -i 's/?v=20261001/?v=20261103/g' js/ifcplan/drawing.js js/ifcplan/model.js js/ifcplan/state.js js/ifcplan/ui.js js/ifcplan/worker.js ifc-plans.html _tests/ifcplan/browser-check.js
sed -i 's#\(\.\./laser/[a-z]*\.js\)?v=20261103#\1?v=20261001#g' js/ifcplan/ui.js
grep -rn "20261001" js/ifcplan ifc-plans.html _tests/ifcplan/browser-check.js
node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
git diff --stat
```
Expected:
- `grep` lists only `js/ifcplan/ui.js` lines 7 and 8 (`../laser/bridge.js?v=20261001`, `../laser/zip.js?v=20261001`);
- `ℹ pass 75`, `ℹ fail 0`;
- the stat lists 9 files: `_tests/ifcplan/browser-check.js | 2 +-`, `_tests/ifcplan/site.test.js | 34 +++++++…`, `ifc-plans.html | 6 +++---`, `js/ifcplan/drawing.js | 6 +++---`, `js/ifcplan/dxf.js | 6 +++---`, `js/ifcplan/model.js | 8 ++++----`, `js/ifcplan/state.js | 4 ++--`, `js/ifcplan/ui.js | 14 +++++++-------`, `js/ifcplan/worker.js | 6 +++---` (53 insertions, 33 deletions).

- [ ] **Step 3: Commit**

```bash
git add _tests/ifcplan/site.test.js _tests/ifcplan/browser-check.js ifc-plans.html js/ifcplan/drawing.js js/ifcplan/dxf.js js/ifcplan/model.js js/ifcplan/state.js js/ifcplan/ui.js js/ifcplan/worker.js
git commit -F - <<'EOF'
IFC 3D view: every module URL on the placeholder ?v=20261103

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 2: The 3D colours

**Files:**
- Create: `js/ifcplan/palette3d.js`
- Test: `_tests/ifcplan/palette3d.test.js`

**Interfaces:**
- Consumes: `LAYERS` (`js/ifcplan/layers.js`, for the test).
- Produces (`js/ifcplan/palette3d.js`, pure): `PALETTE_3D` (layer → `[#rrggbb, opacity]`, spec §5's 13 layers); `style3d(layer) → { color, opacity, transparent, order }`, where order is 0 for solids, 1 for glass and 2 for rooms, and an unknown layer is styled as `IFC_OTHER`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/ifcplan/palette3d.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE_3D, style3d } from '../../js/ifcplan/palette3d.js';
import { LAYERS } from '../../js/ifcplan/layers.js';

test('every drawn layer of the plans spec has a 3D colour: the table of the 3D spec §5', () => {
  assert.deepEqual(Object.keys(PALETTE_3D).sort(), LAYERS.map(l => l.name).filter(n => n !== 'IFC_SPACE_TEXT').sort());
  assert.deepEqual(PALETTE_3D, {
    IFC_WALL: ['#d8d4c8', 1], IFC_SLAB: ['#bfbcb2', 1], IFC_COLUMN: ['#c98a84', 1], IFC_BEAM: ['#a9adb4', 1],
    IFC_DOOR: ['#6fb3c2', 1], IFC_WINDOW: ['#8fb4f0', 0.45], IFC_CURTAINWALL: ['#7fb2d6', 0.45], IFC_STAIR: ['#8cc29a', 1],
    IFC_RAILING: ['#e0a07a', 1], IFC_FURNITURE: ['#d8c08a', 1], IFC_MEP: ['#cf93cf', 1], IFC_OTHER: ['#b5b0a8', 1],
    IFC_SPACE: ['#e8c96a', 0.15],
  });
});

test('only glass and rooms are semi-transparent, and they draw after the solids, rooms last', () => {
  const see = Object.keys(PALETTE_3D).filter(n => style3d(n).transparent).sort();
  assert.deepEqual(see, ['IFC_CURTAINWALL', 'IFC_SPACE', 'IFC_WINDOW']);
  assert.deepEqual(style3d('IFC_WALL'), { color: '#d8d4c8', opacity: 1, transparent: false, order: 0 });
  assert.deepEqual(style3d('IFC_WINDOW'), { color: '#8fb4f0', opacity: 0.45, transparent: true, order: 1 });
  assert.deepEqual(style3d('IFC_SPACE'), { color: '#e8c96a', opacity: 0.15, transparent: true, order: 2 });
  assert.deepEqual(style3d('IFC_UNKNOWN'), style3d('IFC_OTHER'), 'an unknown layer is drawn as IFC_OTHER');
});
```

Run: `node _tests/extract.mjs $PLAN _tests/ifcplan/palette3d.test.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 75`, `ℹ fail 1` (the module is missing).

- [ ] **Step 2: Write the module**

<!-- file: js/ifcplan/palette3d.js -->
```js
// IFC floor plans, the 3D view: each layer's colour and opacity (3D spec §5). Light tints of the plan's layer hues, so
// the dark cut lines stand out on them; glass and rooms are see-through. Pure: no DOM, no three.js.
export const PALETTE_3D = {
  IFC_WALL: ['#d8d4c8', 1], IFC_SLAB: ['#bfbcb2', 1], IFC_COLUMN: ['#c98a84', 1], IFC_BEAM: ['#a9adb4', 1],
  IFC_DOOR: ['#6fb3c2', 1], IFC_WINDOW: ['#8fb4f0', 0.45], IFC_CURTAINWALL: ['#7fb2d6', 0.45], IFC_STAIR: ['#8cc29a', 1],
  IFC_RAILING: ['#e0a07a', 1], IFC_FURNITURE: ['#d8c08a', 1], IFC_MEP: ['#cf93cf', 1], IFC_OTHER: ['#b5b0a8', 1],
  IFC_SPACE: ['#e8c96a', 0.15],
};

// { color, opacity, transparent, order }: order 0 for the solids, 1 for glass, 2 for the rooms, drawn in that order so
// the see-through layers blend over what is behind them.
export function style3d(layer) {
  const [color, opacity] = PALETTE_3D[layer] || PALETTE_3D.IFC_OTHER;
  const transparent = opacity < 1;
  return { color, opacity, transparent, order: !transparent ? 0 : layer === 'IFC_SPACE' ? 2 : 1 };
}
```

Run: `node _tests/extract.mjs $PLAN js/ifcplan/palette3d.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 77`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/ifcplan/palette3d.js _tests/ifcplan/palette3d.test.js
git commit -F - <<'EOF'
IFC 3D view: the 3D colour and opacity per layer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 3: Packing the model for the 3D view

**Files:**
- Create: `js/ifcplan/mesh3d.js`
- Test: `_tests/ifcplan/mesh3d.test.js`

**Interfaces:**
- Produces (`js/ifcplan/mesh3d.js`, pure: no web-ifc, no DOM):
  - `createPacker({ origin: [x0, y0, z0], maxTriangles = Infinity }) → { add(element), over, triangles, finish() }`, where `add({ layer, type, name, storey, P: Float64Array xyz (Z up, metres), ix: Uint32Array })`;
  - `finish() → { body, transfer }`:
    - `body` is `{ mesh3d: { origin, layers: { LAYER: { position: Float32Array, index: Uint32Array, element: Uint32Array } }, elements: [{ type, layer, name, storey }], triangles } }`;
    - over the cap, `body` is `{ mesh3d: null, triangles, reason: 'large' }`;
    - `transfer` lists every buffer;
  - `packMesh(list, options)`: all at once.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/ifcplan/mesh3d.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPacker, packMesh } from '../../js/ifcplan/mesh3d.js';

// A box from (x0, y0, z0) to (x1, y1, z1): 8 vertices, 12 triangles, as gather() gives them (Float64, Z up, metres).
function box(x0, y0, z0, x1, y1, z1) {
  const P = new Float64Array(24);
  for (let i = 0; i < 8; i++) P.set([i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0], 3 * i);
  const ix = Uint32Array.from([0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5]);
  return { P, ix };
}
const wall = (name, b, storey = 0) => ({ layer: 'IFC_WALL', type: 'IfcWall', name, storey, ...box(...b) });

test('per layer: positions relative to the origin, indices offset per element, and each vertex names its element', () => {
  const { body, transfer } = packMesh([
    wall('W1', [10, 20, 0, 14, 20.2, 3]),
    { layer: 'IFC_DOOR', type: 'IfcDoor', name: 'D', storey: 0, ...box(11, 20, 0, 12, 20.2, 2.1) },
    wall('W2', [10, 23, 0, 14, 23.2, 3], 1),
  ], { origin: [10, 20, 0] });
  const m = body.mesh3d;
  assert.deepEqual(m.origin, [10, 20, 0]);
  assert.deepEqual(Object.keys(m.layers), ['IFC_WALL', 'IFC_DOOR']);
  assert.deepEqual(m.elements, [
    { type: 'IfcWall', layer: 'IFC_WALL', name: 'W1', storey: 0 },
    { type: 'IfcDoor', layer: 'IFC_DOOR', name: 'D', storey: 0 },
    { type: 'IfcWall', layer: 'IFC_WALL', name: 'W2', storey: 1 },
  ]);
  assert.equal(m.triangles, 36);
  const w = m.layers.IFC_WALL;
  assert.ok(w.position instanceof Float32Array && w.index instanceof Uint32Array && w.element instanceof Uint32Array);
  assert.deepEqual([w.position.length, w.index.length, w.element.length], [48, 72, 16], 'vertices are not shared between elements');
  assert.deepEqual([...w.position.subarray(0, 6)], [0, 0, 0, 4, 0, 0]);
  assert.deepEqual([...w.position.subarray(24, 27)].map(v => +v.toFixed(5)), [0, 3, 0], 'the second wall, relative');
  assert.deepEqual([...w.index.subarray(36, 39)], [8, 10, 9], 'the second wall indexes its own vertices');
  assert.deepEqual([...w.element], [0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2]);
  assert.deepEqual([...m.layers.IFC_DOOR.element], [1, 1, 1, 1, 1, 1, 1, 1]);
  assert.equal(transfer.length, 6);
  for (const L of Object.values(m.layers)) for (const a of [L.position, L.index, L.element]) assert.ok(transfer.includes(a.buffer));
});

test('a georeferenced model keeps its 1 mm edges exact: Float32 relative to the origin, not absolute', () => {
  const x = 512345.678, y = 4123456.789, z = 104.25;
  const { body } = packMesh([wall('cube', [x, y, z, x + 0.001, y + 0.001, z + 0.001])], { origin: [x, y, z] });
  const p = body.mesh3d.layers.IFC_WALL.position;
  for (let i = 0; i < 8; i++) {
    for (const [k, bit] of [[0, 1], [1, 2], [2, 4]]) {
      const want = i & bit ? 0.001 : 0;
      assert.ok(Math.abs(p[3 * i + k] - want) < 1e-9, `vertex ${i} axis ${k}: ${p[3 * i + k]}`);
    }
  }
  assert.equal(Math.fround(y + 0.001), Math.fround(y), 'absolute Float32 would collapse the edge');
});

test('the cap: over maxTriangles nothing is packed, every triangle is still counted, and the answer is "large"', () => {
  const p = createPacker({ origin: [0, 0, 0], maxTriangles: 20 });
  p.add(wall('a', [0, 0, 0, 1, 1, 1]));
  assert.equal(p.over, false);
  p.add(wall('b', [2, 0, 0, 3, 1, 1]));
  assert.equal(p.over, true, '24 triangles > 20');
  p.add(wall('c', [4, 0, 0, 5, 1, 1]));
  assert.equal(p.triangles, 36);
  assert.deepEqual(p.finish(), { body: { mesh3d: null, triangles: 36, reason: 'large' }, transfer: [] });
  const at = createPacker({ origin: [0, 0, 0], maxTriangles: 24 });
  at.add(wall('a', [0, 0, 0, 1, 1, 1])); at.add(wall('b', [2, 0, 0, 3, 1, 1]));
  assert.equal(at.finish().body.mesh3d.triangles, 24, 'exactly at the cap is drawn');
});

test('rooms go on IFC_SPACE; an element outside any storey keeps storey -1', () => {
  const { body } = packMesh([
    { layer: 'IFC_SPACE', type: 'IfcSpace', name: 'Σαλόνι', storey: 0, ...box(0, 0, 0, 5, 4, 2.7) },
    { layer: 'IFC_OTHER', type: 'IfcBuildingElementProxy', name: '', storey: -1, ...box(0, 0, 0, 1, 1, 1) },
  ], { origin: [0, 0, 0] });
  assert.deepEqual(Object.keys(body.mesh3d.layers), ['IFC_SPACE', 'IFC_OTHER']);
  assert.deepEqual(body.mesh3d.elements.map(e => [e.type, e.layer, e.name, e.storey]), [['IfcSpace', 'IFC_SPACE', 'Σαλόνι', 0], ['IfcBuildingElementProxy', 'IFC_OTHER', '', -1]]);
});

test('a vertex web-ifc gives as NaN drops its triangles and sits at the origin, so the view stays finite', () => {
  const b = wall('w', [1, 1, 1, 2, 2, 2]);
  b.P[0] = NaN;                                                  // vertex 0: in 3 of the 12 triangles
  const { body } = packMesh([b], { origin: [0, 0, 0] });
  const L = body.mesh3d.layers.IFC_WALL;
  assert.ok(L.position.every(Number.isFinite));
  assert.deepEqual([...L.position.subarray(0, 3)], [0, 0, 0]);
  assert.equal(L.index.length, 27, '9 of 12 triangles kept');
  assert.ok(!L.index.includes(0));
  assert.equal(body.mesh3d.triangles, 12, 'the count is what web-ifc gave');
});
```

Run: `node _tests/extract.mjs $PLAN _tests/ifcplan/mesh3d.test.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 77`, `ℹ fail 1`.

- [ ] **Step 2: Write the module**

<!-- file: js/ifcplan/mesh3d.js -->
```js
// IFC floor plans, the 3D view: the model's triangles packed in the worker for the page (3D spec §3.1). Pure: no
// web-ifc, no DOM. Per layer, every element's vertices go into one position array and its triangles into one index
// array, and a parallel per-vertex array holds the element's place in the `elements` table (for picking); vertices are
// not shared between elements. Positions are Float32 relative to `origin` (the model's bounding-box minimum), so
// georeferenced coordinates (~5 × 10⁵ m) stay exact to well under a millimetre.

// A typed array that grows by doubling; take() hands over exactly the written part.
function growable(Type) {
  let a = new Type(4096), n = 0;
  return {
    reserve(k) {
      if (n + k <= a.length) return;
      let size = a.length * 2;
      while (size < n + k) size *= 2;
      const b = new Type(size);
      b.set(a.subarray(0, n));
      a = b;
    },
    push(v) { a[n++] = v; },
    get length() { return n; },
    take() { return n === a.length ? a : a.slice(0, n); },
  };
}

// createPacker({ origin: [x0, y0, z0], maxTriangles }) → { add(element), over, triangles, finish() }.
// add({ layer, type, name, storey, P: Float64Array xyz (Z up, metres), ix: Uint32Array }). Every triangle web-ifc gives
// is counted; once the count passes maxTriangles nothing more is packed, and finish() answers "large".
export function createPacker({ origin = [0, 0, 0], maxTriangles = Infinity } = {}) {
  const [ox, oy, oz] = origin;
  const layers = new Map();
  const elements = [];
  let triangles = 0, over = false;

  function add({ layer, type, name, storey, P, ix }) {
    triangles += Math.floor(ix.length / 3);
    if (over || triangles > maxTriangles) { over = true; layers.clear(); elements.length = 0; return; }
    let L = layers.get(layer);
    if (!L) layers.set(layer, L = { position: growable(Float32Array), index: growable(Uint32Array), element: growable(Uint32Array) });
    const e = elements.length;
    elements.push({ type, layer, name, storey });
    const nv = P.length / 3, base = L.element.length;
    L.position.reserve(3 * nv); L.element.reserve(nv);
    let bad = null;
    for (let k = 0; k < nv; k++) {
      const x = P[3 * k] - ox, y = P[3 * k + 1] - oy, z = P[3 * k + 2] - oz;
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        L.position.push(x); L.position.push(y); L.position.push(z);
      } else {
        // A vertex web-ifc could not compute: kept at the origin (a corner of the model's box), its triangles dropped.
        L.position.push(0); L.position.push(0); L.position.push(0);
        (bad || (bad = new Set())).add(k);
      }
      L.element.push(e);
    }
    L.index.reserve(ix.length);
    for (let t = 0; t + 2 < ix.length; t += 3) {
      const a = ix[t], b = ix[t + 1], c = ix[t + 2];
      if (bad && (bad.has(a) || bad.has(b) || bad.has(c))) continue;
      L.index.push(base + a); L.index.push(base + b); L.index.push(base + c);
    }
  }

  // { body, transfer }: body is the reply's part, transfer every buffer in it.
  function finish() {
    if (over) return { body: { mesh3d: null, triangles, reason: 'large' }, transfer: [] };
    const out = {}, transfer = [];
    for (const [name, L] of layers) {
      const position = L.position.take(), index = L.index.take(), element = L.element.take();
      out[name] = { position, index, element };
      transfer.push(position.buffer, index.buffer, element.buffer);
    }
    return { body: { mesh3d: { origin: [ox, oy, oz], layers: out, elements, triangles } }, transfer };
  }

  return { add, finish, get over() { return over; }, get triangles() { return triangles; } };
}

// All at once, for the tests.
export function packMesh(list, options) {
  const p = createPacker(options);
  for (const e of list) p.add(e);
  return p.finish();
}
```

Run: `node _tests/extract.mjs $PLAN js/ifcplan/mesh3d.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 82`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/ifcplan/mesh3d.js _tests/ifcplan/mesh3d.test.js
git commit -F - <<'EOF'
IFC 3D view: pack the model's triangles per layer, with the triangle cap

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 4: The worker answers `mesh3d`

**Files:**
- Modify: `js/ifcplan/model.js` (`gather` moved out of `cutModel` and exported; `typeNamer`, `nameOf`, `forEachElement` added; `cutModel` streams through `forEachElement`)
- Modify: `js/ifcplan/worker.js` (the `mesh3d` request; the open model keeps its origin)
- Test: `_tests/ifcplan/worker.test.js` (three tests appended, and a `mesh3d` message helper)

**Interfaces:**
- Consumes: `createPacker` (Task 3); the bridge's `process` message (`js/laser/bridge.js`, unchanged); `prepare`'s `storeyOf`.
- Produces:
  - `js/ifcplan/model.js`:
    - `gather(api, id, mesh) → { P, ix, b }`;
    - `typeNamer(api, id) → eid → 'IfcWall' …`;
    - `nameOf(api, id, eid) → string`;
    - `forEachElement(api, W, id, typeOf, fn)`, with `fn({ eid, type, layer, m })`; the products come first, then the rooms (`type 'IfcSpace'`, `layer 'IFC_SPACE'`).
  - `js/ifcplan/worker.js`:
    - `{ type: 'process', id, name: 'mesh3d', bytes: empty, settings: { mesh3d: true, maxTriangles } }` answers `{ type: 'result', id, name, mesh3d: {…} }`, or `{ type: 'result', id, name, mesh3d: null, triangles, reason: 'large' }`, or `{ type: 'error', id, reason: 'stale', detail: '' }` with no open model;
    - a `maxTriangles` that is not a positive number means no cap;
    - the origin is the open file's `file.bbox` minimum.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/ifcplan/worker.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSession, DEFAULT_CUT_M } from '../../js/ifcplan/worker.js';
import { MAX_BYTES } from '../../js/ifcplan/model.js';
import { openApi } from './webifc-node.mjs';
import { smallModel } from './step.mjs';

const EXAMPLE = readFileSync(new URL('../../js/ifcplan/examples/example-house.ifc', import.meta.url));
const buf = b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const text = s => buf(new TextEncoder().encode(s));
const file = (id, bytes, cutM = 1.1, name = 'example-house.ifc') => ({ type: 'process', id, name, bytes, settings: { cutM } });
const recut = (id, cutM) => ({ type: 'process', id, name: 'recut', bytes: new ArrayBuffer(0), settings: { cutM, recut: true } });
const mesh3d = (id, maxTriangles) => ({ type: 'process', id, name: 'mesh3d', bytes: new ArrayBuffer(0), settings: { mesh3d: true, maxTriangles } });

test('a file: the result of spec §3, its buffers listed for transfer', async () => {
  const s = createSession(openApi);
  const { reply, transfer } = await s.process(file(1, buf(EXAMPLE)));
  assert.equal(reply.type, 'result');
  assert.deepEqual([reply.id, reply.name, reply.recut, reply.cutM], [1, 'example-house.ifc', false, 1.1]);
  assert.deepEqual([reply.file.schema, reply.file.products, reply.storeys.length], ['IFC4', 19, 2]);
  assert.ok(transfer.length > 0 && transfer.every(b => b instanceof ArrayBuffer));
  assert.ok(transfer.includes(reply.storeys[0].layers.IFC_WALL.xy.buffer));
  assert.equal(DEFAULT_CUT_M, 1.1);
});

test('a re-cut reuses the open model: no bytes, a new height', async () => {
  const s = createSession(openApi);
  await s.process(file(1, buf(EXAMPLE)));
  const { reply } = await s.process(recut(2, 2.2));
  assert.deepEqual([reply.type, reply.id, reply.name, reply.recut, reply.cutM], ['result', 2, 'example-house.ifc', true, 2.2]);
  assert.deepEqual(reply.storeys.map(st => +st.cutZ.toFixed(6)), [2.2, 5.2]);
  assert.equal(reply.storeys[0].layers.IFC_DOOR, undefined, 'the door is below 2.20 m');
});

test('a re-cut with no open model is stale: after a restart, or once a later file failed', async () => {
  const s = createSession(openApi);
  assert.deepEqual((await s.process(recut(1, 1.1))).reply, { type: 'error', id: 1, reason: 'stale', detail: '' });
  await s.process(file(2, buf(EXAMPLE)));
  assert.equal((await s.process(file(3, text('not an IFC')))).reply.reason, 'read');
  assert.equal((await s.process(recut(4, 1.1))).reply.reason, 'stale');
});

test('errors: read (with what the file is), schema (with the schema found), limit, empty', async () => {
  const s = createSession(openApi);
  const reasons = async m => { const { reply } = await s.process(m); return [reply.type, reply.reason, reply.detail]; };
  assert.deepEqual(await reasons(file(1, text('0\nSECTION\n'))), ['error', 'read', 'not-ifc']);
  assert.deepEqual(await reasons(file(2, buf(Uint8Array.of(0x50, 0x4b, 3, 4, 20, 0)))), ['error', 'read', 'ifczip']);
  assert.deepEqual(await reasons(file(3, text('<?xml version="1.0"?>'))), ['error', 'read', 'ifcxml']);
  const ifc9 = new TextDecoder().decode(EXAMPLE).replace("FILE_SCHEMA(('IFC4'))", "FILE_SCHEMA(('IFC9'))");
  assert.deepEqual(await reasons(file(4, text(ifc9))), ['error', 'schema', 'IFC9']);
  assert.deepEqual(await reasons(file(5, { byteLength: MAX_BYTES + 1 })), ['error', 'limit', '']);
  assert.deepEqual(await reasons(file(6, text(smallModel({ storeys: [{ name: 'S', z: 0 }] })))), ['error', 'empty', '']);
});

test('a crash inside web-ifc is an engine error, and the open model is dropped', async () => {
  const s = createSession(async () => {
    const { api, W } = await openApi();
    let n = 0;
    return { W, api: new Proxy(api, { get: (t, k) => (k === 'StreamAllMeshes' && n++ > 0 ? () => { throw new Error('Aborted(OOM)'); } : typeof t[k] === 'function' ? t[k].bind(t) : t[k]) }) };
  });
  assert.equal((await s.process(file(1, buf(EXAMPLE)))).reply.type, 'result');
  assert.deepEqual((await s.process(recut(2, 2))).reply, { type: 'error', id: 2, reason: 'engine', detail: 'Aborted(OOM)' });
  assert.equal((await s.process(recut(3, 2))).reply.reason, 'stale');
});

test('web-ifc refusing a schema it supports is a read error, not a schema error', async () => {
  const refusing = async () => {
    const { api, W } = await openApi();
    return { W, api: new Proxy(api, { get: (t, k) => (k === 'OpenModel' ? () => -1 : typeof t[k] === 'function' ? t[k].bind(t) : t[k]) }) };
  };
  const s = createSession(refusing);
  const reasons = async m => { const { reply } = await s.process(m); return [reply.type, reply.reason, reply.detail]; };
  assert.deepEqual(await reasons(file(1, buf(EXAMPLE))), ['error', 'read', '']);
  const src = new TextDecoder().decode(EXAMPLE);
  for (const schema of ['IFC2X3', 'IFC4X3', 'IFC4X3_ADD2']) assert.deepEqual(await reasons(file(2, text(src.replace("FILE_SCHEMA(('IFC4'))", `FILE_SCHEMA(('${schema}'))`)))), ['error', 'read', ''], schema);
  assert.deepEqual(await reasons(file(3, text(src.replace("FILE_SCHEMA(('IFC4'))", "FILE_SCHEMA(('IFC9'))")))), ['error', 'schema', 'IFC9']);
});

test('mesh3d on the example: every element the plans draw, per layer, relative to the model lower corner', async () => {
  const s = createSession(openApi);
  const first = await s.process(file(1, buf(EXAMPLE)));
  const { reply, transfer } = await s.process(mesh3d(2, 2000000));
  assert.deepEqual([reply.type, reply.id, reply.name], ['result', 2, 'example-house.ifc']);
  const m = reply.mesh3d;
  const b = first.reply.file.bbox;
  assert.deepEqual(m.origin, [b.x0, b.y0, b.z0]);
  assert.deepEqual(m.origin, [120.5, 80.25, -0.25]);
  assert.equal(m.triangles, 340);
  const tris = Object.fromEntries(Object.entries(m.layers).map(([k, L]) => [k, L.index.length / 3]));
  assert.deepEqual(tris, { IFC_SLAB: 56, IFC_COLUMN: 12, IFC_WALL: 176, IFC_STAIR: 12, IFC_RAILING: 12, IFC_WINDOW: 24, IFC_DOOR: 12, IFC_SPACE: 36 });
  const count = {};
  for (const e of m.elements) count[e.layer] = (count[e.layer] || 0) + 1;
  assert.deepEqual(count, { IFC_SLAB: 3, IFC_COLUMN: 1, IFC_WALL: 10, IFC_STAIR: 1, IFC_RAILING: 1, IFC_WINDOW: 2, IFC_DOOR: 1, IFC_SPACE: 3 });
  assert.deepEqual(m.elements.find(e => e.type === 'IfcDoor'), { type: 'IfcDoor', layer: 'IFC_DOOR', name: 'Πόρτα εισόδου', storey: 0 });
  assert.deepEqual(m.elements.filter(e => e.layer === 'IFC_SPACE').map(e => [e.type, e.name, e.storey]), [['IfcSpace', 'Σαλόνι', 0], ['IfcSpace', 'Κουζίνα', 0], ['IfcSpace', '1.01', 1]]);
  let top = 0;
  for (const L of Object.values(m.layers)) for (let i = 2; i < L.position.length; i += 3) top = Math.max(top, L.position[i]);
  assert.ok(Math.abs(top - 6.25) < 1e-5, `the roof top, 6.25 m above the slab's underside: ${top}`);
  assert.equal(transfer.length, 3 * Object.keys(m.layers).length);
  const again = await s.process(recut(3, 2.2));
  assert.equal(again.reply.recut, true, 'the model stays open for a re-cut');
});

test('mesh3d: stale before any file, "large" over the cap (with the count), and the cap left out means no cap', async () => {
  const s = createSession(openApi);
  assert.deepEqual((await s.process(mesh3d(1, 2000000))).reply, { type: 'error', id: 1, reason: 'stale', detail: '' });
  await s.process(file(2, buf(EXAMPLE)));
  const { reply, transfer } = await s.process(mesh3d(3, 10));
  assert.deepEqual(reply, { type: 'result', id: 3, name: 'example-house.ifc', mesh3d: null, triangles: 340, reason: 'large' });
  assert.deepEqual(transfer, []);
  assert.equal((await s.process(mesh3d(4))).reply.mesh3d.triangles, 340);
});

test('mesh3d skips what the cut skips (a marker proxy); an element outside the storeys has storey -1', async () => {
  const s = createSession(openApi);
  const model = smallModel({
    storeys: [{ name: 'S', z: 0 }],
    elements: [
      { storey: 0, name: 'Wall A', box: [0, 0, 0, 1000, 100, 3000] },
      { storey: 0, type: 'IFCBUILDINGELEMENTPROXY', box: [0, 2000, 1099.8, 500, 2500, 1100.3], ident: 'Annotation' },
      { storey: 0, type: 'IFCBUILDINGELEMENTPROXY', name: 'Thin', box: [0, 3000, 1099.8, 500, 3500, 1100.3] },
      { storey: -1, type: 'IFCCOLUMN', name: 'In the building', box: [2000, 0, 0, 2300, 300, 3000] },
    ],
  });
  const first = await s.process(file(1, text(model), 1.1, 'small.ifc'));
  assert.equal(first.reply.file.products, 3);
  const { reply } = await s.process(mesh3d(2, 2000000));
  assert.deepEqual(reply.mesh3d.elements.map(e => [e.type, e.name, e.storey]), [['IfcColumn', 'In the building', -1], ['IfcWall', 'Wall A', 0], ['IfcBuildingElementProxy', 'Thin', 0]]);
});
```

Run: `node _tests/extract.mjs $PLAN _tests/ifcplan/worker.test.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 82`, `ℹ fail 3` (the three `mesh3d` tests).

- [ ] **Step 2: Write the model and the worker**

<!-- file: js/ifcplan/model.js -->
```js
// IFC floor plans: an open web-ifc model read and cut into storey plans (spec §3, steps 2–6). No DOM: it runs in
// the worker, and in the Node tests on the same web-ifc build. `api` is a web-ifc IfcAPI, `W` the web-ifc module
// (for its type codes). Lengths come back in metres, in the IFC's world coordinates; areas in m².
import { cutMesh } from './cut.js?v=20261103';
import { chain, polylineSet } from './chain.js?v=20261103';
import { layerOf, isMarkerProxy } from './layers.js?v=20261103';
import { roomArea, outlineOf, labelPoint } from './rooms.js?v=20261103';

export const MAX_BYTES = 150 * 1024 * 1024;       // refused before reading (spec §7)
export const LARGE_BYTES = 50 * 1024 * 1024;      // accepted, with a "this may take a while" note

// What a file is, from its first bytes: { ok: true, schema } for STEP text, else { ok: false, reason: 'read', detail }
// with detail 'ifczip', 'ifcxml' or 'not-ifc'.
export function sniff(bytes) {
  const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  const head = new TextDecoder('latin1').decode(bytes.subarray(bom, Math.min(bytes.length, 65536)));
  if (head.startsWith('PK\u0003\u0004')) return { ok: false, reason: 'read', detail: 'ifczip' };
  const start = head.trimStart();
  if (start.startsWith('<')) return { ok: false, reason: 'read', detail: 'ifcxml' };
  if (!start.startsWith('ISO-10303-21')) return { ok: false, reason: 'read', detail: 'not-ifc' };
  const m = /FILE_SCHEMA\s*\(\s*\(\s*'([^']*)'/i.exec(head);
  return { ok: true, schema: m ? m[1].trim().toUpperCase() : '' };
}

const PREFIX = { EXA: 1e18, PETA: 1e15, TERA: 1e12, GIGA: 1e9, MEGA: 1e6, KILO: 1e3, HECTO: 1e2, DECA: 1e1, DECI: 1e-1, CENTI: 1e-2, MILLI: 1e-3, MICRO: 1e-6, NANO: 1e-9, PICO: 1e-12, FEMTO: 1e-15, ATTO: 1e-18 };
const val = x => (x && typeof x === 'object' && 'value' in x ? x.value : x);

// Metres per length unit and m² per area unit, from IfcProject.UnitsInContext: SI units with their prefix, and
// conversion-based units (feet, inches …) through their factor. A missing area unit follows the length unit.
export function unitsOf(api, W, id) {
  let lengthM = 1, areaM2 = null;
  const si = u => {
    const p = PREFIX[val(u.Prefix)] || 1;
    const name = String(val(u.Name) || '');
    return name === 'SQUARE_METRE' ? p * p : name === 'CUBIC_METRE' ? p * p * p : p;
  };
  const factor = u => {
    if (!u) return null;
    if (u.ConversionFactor) {
      const mw = u.ConversionFactor;
      const v = Number(val(mw.ValueComponent));
      const base = mw.UnitComponent ? factor(mw.UnitComponent) : 1;
      if (v > 0 && base) return v * base;
      const n = String(val(u.Name) || '').toUpperCase();
      return n.includes('FOOT') ? 0.3048 : n.includes('INCH') ? 0.0254 : null;
    }
    if (u.Name !== undefined) return si(u);
    return null;
  };
  try {
    const ids = api.GetLineIDsWithType(id, W.IFCPROJECT);
    if (ids.size()) {
      const project = api.GetLine(id, ids.get(0), true);
      const units = (project.UnitsInContext && project.UnitsInContext.Units) || [];
      for (const u of units) {
        const type = u && val(u.UnitType);
        if (type === 'LENGTHUNIT') { const f = factor(u); if (f > 0) lengthM = f; }
        if (type === 'AREAUNIT') { const f = factor(u); if (f > 0) areaM2 = f; }
      }
    }
  } catch (e) { /* no usable units: metres */ }
  return { lengthM, areaM2: areaM2 || lengthM * lengthM };
}

// The world Z of a placement: the Z of its location summed along PlacementRelTo (spec §3: a storey's Elevation is
// relative to the building, and wrong for georeferenced files). Rotations of the parents are not applied.
function worldZ(api, id, placementId) {
  let z = 0;
  for (let p = placementId, guard = 0; p && guard < 64; guard++) {
    const lp = api.GetLine(id, p);
    if (!lp || !lp.RelativePlacement) break;
    const ap = api.GetLine(id, lp.RelativePlacement.value);
    const loc = ap && ap.Location ? api.GetLine(id, ap.Location.value) : null;
    const c = loc && loc.Coordinates;
    if (c && c.length > 2) z += Number(val(c[2])) || 0;
    p = lp.PlacementRelTo ? lp.PlacementRelTo.value : 0;
  }
  return z;
}

// The storeys, lowest first: { id, name, levelM }.
export function storeysOf(api, W, id, lengthM) {
  const ids = api.GetLineIDsWithType(id, W.IFCBUILDINGSTOREY);
  const out = [];
  for (let i = 0; i < ids.size(); i++) {
    const sid = ids.get(i);
    const s = api.GetLine(id, sid);
    let z = null;
    try { if (s.ObjectPlacement) z = worldZ(api, id, s.ObjectPlacement.value); } catch (e) { z = null; }
    if (z === null) z = Number(val(s.Elevation)) || 0;
    out.push({ id: sid, name: val(s.Name) || '', levelM: z * lengthM });
  }
  return out.sort((a, b) => a.levelM - b.levelM || a.id - b.id);
}

const BODY_TYPES = new Set(['SWEPTSOLID', 'ADVANCEDSWEPTSOLID', 'BREP', 'ADVANCEDBREP', 'CSG', 'CLIPPING', 'SURFACEMODEL', 'TESSELLATION', 'SOLIDMODEL', 'MAPPEDREPRESENTATION']);

// Does the product carry a Body representation (a solid, not only a footprint, an axis or a box)?
function hasBody(api, id, eid) {
  try {
    const p = api.GetLine(id, eid);
    if (!p.Representation) return false;
    const pds = api.GetLine(id, p.Representation.value);
    for (const r of pds.Representations || []) {
      const rep = api.GetLine(id, r.value);
      const ident = String(val(rep.RepresentationIdentifier) || '').toUpperCase();
      const type = String(val(rep.RepresentationType) || '').toUpperCase();
      if (ident === 'BODY' || ident === 'FACETATION' || (!ident && BODY_TYPES.has(type))) return true;
    }
  } catch (e) { /* unreadable: no */ }
  return false;
}

// What does not change with the cut height: the units, the storeys, the spatial structure, the rooms' names and
// quantities. Read once per file.
export function prepare(api, W, id) {
  const header = (type, k) => { try { const a = api.GetHeaderLine(id, type).arguments; return k(a); } catch (e) { return ''; } };
  const app = header(W.FILE_NAME, a => String(val(a[5]) || val(a[4]) || '')).trim();
  const schema = api.GetModelSchema(id) || '';
  const units = unitsOf(api, W, id);
  const storeys = storeysOf(api, W, id, units.lengthM);
  const storeyIndex = new Map(storeys.map((s, i) => [s.id, i]));

  // The spatial structure: each element's container, each part's whole.
  const up = new Map();
  const each = (type, fn) => { const ids = api.GetLineIDsWithType(id, type); for (let i = 0; i < ids.size(); i++) fn(api.GetLine(id, ids.get(i))); };
  each(W.IFCRELCONTAINEDINSPATIALSTRUCTURE, r => { for (const e of r.RelatedElements || []) if (!up.has(e.value)) up.set(e.value, r.RelatingStructure.value); });
  each(W.IFCRELAGGREGATES, r => { for (const e of r.RelatedObjects || []) if (!up.has(e.value)) up.set(e.value, r.RelatingObject.value); });
  const memo = new Map();
  const storeyOf = eid => {
    if (memo.has(eid)) return memo.get(eid);
    let k = -1;
    for (let p = eid, guard = 0; p && guard < 32; guard++) {
      if (storeyIndex.has(p)) { k = storeyIndex.get(p); break; }
      p = up.get(p);
    }
    memo.set(eid, k);
    return k;
  };

  // The rooms: names, and areas from their quantity set (Qto_SpaceBaseQuantities, or IFC2X3's BaseQuantities).
  const spaces = new Map();
  each(W.IFCSPACE, s => spaces.set(s.expressID, { name: val(s.Name) || '', longName: val(s.LongName) || '', qto: {} }));
  if (spaces.size) {
    each(W.IFCRELDEFINESBYPROPERTIES, r => {
      const objs = (r.RelatedObjects || []).filter(o => spaces.has(o.value));
      if (!objs.length || !r.RelatingPropertyDefinition) return;
      const def = r.RelatingPropertyDefinition.value;
      if (api.GetLineType(id, def) !== W.IFCELEMENTQUANTITY) return;
      const q = api.GetLine(id, def);
      const name = String(val(q.Name) || '');
      if (name !== 'Qto_SpaceBaseQuantities' && name !== 'BaseQuantities') return;
      for (const qr of q.Quantities || []) {
        if (api.GetLineType(id, qr.value) !== W.IFCQUANTITYAREA) continue;
        const a = api.GetLine(id, qr.value);
        const key = val(a.Name) === 'NetFloorArea' ? 'net' : val(a.Name) === 'GrossFloorArea' ? 'gross' : null;
        const v = Number(val(a.AreaValue)) * units.areaM2;
        if (key && v > 0) for (const o of objs) spaces.get(o.value).qto[key] = v;
      }
    });
  }
  return { schema, app, units, storeys, storeyOf, spaces, up };
}

// One element's triangles, in IFC Z-up metres (web-ifc gives Y-up: IFC (x, y, z) = (X, -Z, Y)): { P (Float64 xyz),
// ix, b (its bounding box) }. A vertex web-ifc gives as NaN or Infinity stays out of the bounding box (the cut drops
// its segments); b.x0 > b.x1 when none is finite.
export function gather(api, id, mesh) {
  const gs = mesh.geometries, parts = [];
  let nv = 0, ni = 0;
  for (let i = 0; i < gs.size(); i++) {
    const pg = gs.get(i);
    const geo = api.GetGeometry(id, pg.geometryExpressID);
    const v = api.GetVertexArray(geo.GetVertexData(), geo.GetVertexDataSize());
    const ix = api.GetIndexArray(geo.GetIndexData(), geo.GetIndexDataSize());
    parts.push({ v: v.slice(), ix: ix.slice(), T: pg.flatTransformation });
    nv += v.length / 6; ni += ix.length;
    geo.delete();
  }
  const P = new Float64Array(nv * 3), IX = new Uint32Array(ni);
  let pv = 0, pi = 0;
  const b = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  for (const { v, ix, T } of parts) {
    const base = pv;
    for (let k = 0; k < v.length; k += 6) {
      const x = v[k], y = v[k + 1], z = v[k + 2];
      const X = T[0] * x + T[4] * y + T[8] * z + T[12], Y = T[1] * x + T[5] * y + T[9] * z + T[13], Z = T[2] * x + T[6] * y + T[10] * z + T[14];
      const ix3 = 3 * pv++;
      P[ix3] = X; P[ix3 + 1] = -Z; P[ix3 + 2] = Y;
      if (!(Number.isFinite(X) && Number.isFinite(Y) && Number.isFinite(Z))) continue;
      if (X < b.x0) b.x0 = X; if (X > b.x1) b.x1 = X;
      if (-Z < b.y0) b.y0 = -Z; if (-Z > b.y1) b.y1 = -Z;
      if (Y < b.z0) b.z0 = Y; if (Y > b.z1) b.z1 = Y;
    }
    for (let k = 0; k < ix.length; k++) IX[pi++] = base + ix[k];
  }
  return { P, ix: IX, b };
}

// The IFC type name of an element (IfcWall …), cached per type code.
export function typeNamer(api, id) {
  const names = new Map();
  return eid => {
    const code = api.GetLineType(id, eid);
    let n = names.get(code);
    if (n === undefined) { n = api.GetNameFromTypeCode(code); names.set(code, n); }
    return n;
  };
}

// An element's Name attribute, '' when it has none.
export function nameOf(api, id, eid) {
  try { return String(val(api.GetLine(id, eid).Name) || ''); } catch (e) { return ''; }
}

// Every element the plans draw, with its triangles, in one order: the products first (a type with a layer, IfcSpace
// apart), then the rooms (StreamAllMeshes leaves IfcSpace out). Skipped: no triangles, no finite vertex, and the
// marker proxies of spec §4. fn({ eid, type, layer, m }) with m = gather()'s. The cut and the 3D view both stream
// through here, so they skip the same elements.
export function forEachElement(api, W, id, typeOf, fn) {
  api.StreamAllMeshes(id, mesh => {
    const eid = mesh.expressID;
    const type = typeOf(eid);
    const layer = layerOf(type);
    if (!layer || layer === 'IFC_SPACE') return;
    const m = gather(api, id, mesh);
    if (!m.ix.length || !(m.b.x0 <= m.b.x1)) return;
    if (isMarkerProxy({ type, zSpan: m.b.z1 - m.b.z0, hasBody: m.b.z1 - m.b.z0 < 0.001 && hasBody(api, id, eid) })) return;
    fn({ eid, type, layer, m });
  });
  api.StreamAllMeshesWithTypes(id, [W.IFCSPACE], mesh => {
    const eid = mesh.expressID;
    const m = gather(api, id, mesh);
    if (!m.ix.length || !(m.b.x0 <= m.b.x1)) return;
    fn({ eid, type: 'IfcSpace', layer: 'IFC_SPACE', m });
  });
}

// The plans at one cut height: every mesh cut by every storey's plane in one pass (spec §3 step 5).
// Returns { file, storeys } as the worker answers it (spec §3), with { transfer } the buffers to hand over.
export function cutModel(api, W, id, prep, cutM) {
  const one = prep.storeys.length === 0;
  const storeys = one ? [{ id: 0, name: '', levelM: 0 }] : prep.storeys;
  const planes = storeys.map(s => s.levelM + cutM);
  const plans = storeys.map(() => ({ layers: new Map(), cut: new Set(), rooms: [] }));
  const typeOf = typeNamer(api, id);
  const meshed = new Set();
  const bbox = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  let products = 0;
  const grow = b => {
    bbox.x0 = Math.min(bbox.x0, b.x0); bbox.y0 = Math.min(bbox.y0, b.y0); bbox.z0 = Math.min(bbox.z0, b.z0);
    bbox.x1 = Math.max(bbox.x1, b.x1); bbox.y1 = Math.max(bbox.y1, b.y1); bbox.z1 = Math.max(bbox.z1, b.z1);
  };
  const add = (plan, layer, polylines) => {
    let set = plan.layers.get(layer);
    if (!set) plan.layers.set(layer, set = polylineSet());
    for (const p of polylines) if (p.pts.length >= 4) set.add(p.pts, p.closed);
  };

  // The products cut by every storey's plane; the rooms each on its own storey's plane (spec §5).
  let rooms = 0;
  forEachElement(api, W, id, typeOf, ({ eid, layer, m }) => {
    meshed.add(eid);
    grow(m.b);
    if (layer !== 'IFC_SPACE') {
      products++;
      const segs = planes.map(() => null);
      cutMesh(m.P, m.ix, planes, (k, x0, y0, x1, y1) => { (segs[k] || (segs[k] = [])).push(x0, y0, x1, y1); });
      segs.forEach((s, k) => {
        if (!s) return;
        add(plans[k], layer, chain(s));
        plans[k].cut.add(eid);
      });
      return;
    }
    let k = one ? 0 : prep.storeyOf(eid);
    if (k < 0) {
      // Not in a storey: the highest storey at or below its floor.
      k = 0;
      for (let i = 0; i < storeys.length; i++) if (storeys[i].levelM <= m.b.z0 + 0.01) k = i;
    }
    const info = prep.spaces.get(eid) || { name: '', longName: '', qto: {} };
    const segs = [];
    cutMesh(m.P, m.ix, [planes[k]], (j, x0, y0, x1, y1) => segs.push(x0, y0, x1, y1));
    const pieces = chain(segs);
    let loops = pieces, outline = outlineOf(loops), crossed = outline.length >= 6, at;
    if (crossed) {
      add(plans[k], 'IFC_SPACE', pieces);
      at = labelPoint(outline);
    } else {
      // Lower than the cut: no outline; the label at the middle of its plan, its area from a cut at mid-height.
      const mid = [];
      cutMesh(m.P, m.ix, [(m.b.z0 + m.b.z1) / 2], (j, x0, y0, x1, y1) => mid.push(x0, y0, x1, y1));
      loops = chain(mid);
      outline = outlineOf(loops);
      at = [(m.b.x0 + m.b.x1) / 2, (m.b.y0 + m.b.y1) / 2];
    }
    const area = roomArea(info.qto, outline, loops);         // less the room's own holes: columns, shafts
    plans[k].rooms.push({ id: eid, name: info.name, longName: info.longName, outline: Float64Array.from(crossed ? outline : []), areaM2: area.areaM2, areaFrom: area.areaFrom, at, crossed });
    rooms++;
  });

  // Elements with a body that web-ifc could not mesh (for example a failed boolean): reported, not drawn.
  const missing = storeys.map(() => new Map()), missingAll = new Map();
  for (const eid of prep.up.keys()) {
    if (meshed.has(eid)) continue;
    const type = typeOf(eid);
    if (!layerOf(type) || !hasBody(api, id, eid)) continue;
    const k = one ? 0 : prep.storeyOf(eid);
    if (k >= 0) missing[k].set(type, (missing[k].get(type) || 0) + 1);
    missingAll.set(type, (missingAll.get(type) || 0) + 1);
  }
  const list = m => [...m].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count || (a.type < b.type ? -1 : 1));

  const transfer = [];
  const outStoreys = storeys.map((s, k) => {
    const layers = {};
    for (const [name, set] of plans[k].layers) {
      const p = set.pack();
      layers[name] = p;
      transfer.push(p.xy.buffer, p.ends.buffer, p.closed.buffer);
    }
    for (const r of plans[k].rooms) transfer.push(r.outline.buffer);
    return { name: s.name, levelM: s.levelM, cutZ: planes[k], layers, rooms: plans[k].rooms, cut: plans[k].cut.size, noGeometry: list(missing[k]) };
  });
  if (!(bbox.x0 <= bbox.x1)) for (const k of Object.keys(bbox)) bbox[k] = 0;
  const file = { schema: prep.schema, app: prep.app, unitM: prep.units.lengthM, products, rooms, bbox, noStoreys: one, noGeometry: list(missingAll) };
  return { file, storeys: outStoreys, transfer };
}
```

<!-- file: js/ifcplan/worker.js -->
```js
// IFC floor plans: the module worker that holds web-ifc (spec §3). It answers the messages of the shared
// js/laser/bridge.js: 'boot' loads web-ifc and answers 'ready'; 'process' with a file's bytes opens the model, cuts
// every storey at settings.cutM and answers { type: 'result' }; 'process' with settings.recut cuts the open model
// again at a new height, without the bytes; 'process' with settings.mesh3d answers the open model's triangles for the
// 3D view (3D spec §3.1), or "large" over settings.maxTriangles. The model stays open until the next file.
// Single-threaded web-ifc, so a static host needs no cross-origin isolation.
// createSession is the whole logic, without the worker's globals, so the Node tests drive it with the same web-ifc.
import * as WebIFC from './vendor/web-ifc/web-ifc-api.js?v=20261103';
import { sniff, prepare, cutModel, forEachElement, typeNamer, nameOf, MAX_BYTES } from './model.js?v=20261103';
import { createPacker } from './mesh3d.js?v=20261103';

export const DEFAULT_CUT_M = 1.1;

// Whether web-ifc reads this schema: IFC2X3, IFC4, IFC4X3 and their aliases (web-ifc's own list).
const supported = (W, schema) => (W.SchemaNames || []).some(names => Array.isArray(names) && names.includes(schema));

// loadApi: async () => ({ api, W }). Returns { boot, process(message) → { reply, transfer } }.
export function createSession(loadApi) {
  let booted = null;
  let open = null;                                            // { id, prep, name, origin }: the model kept for a re-cut
  const boot = () => booted || (booted = loadApi());
  const error = (id, reason, detail = '') => ({ reply: { type: 'error', id, reason, detail }, transfer: [] });

  async function process(m) {
    const { api, W } = await boot();
    const settings = m.settings || {};
    const cutM = Number.isFinite(settings.cutM) ? settings.cutM : DEFAULT_CUT_M;
    try {
      if (settings.recut) {
        if (!open) return error(m.id, 'stale');               // the worker restarted, or the last file failed
        const r = cutModel(api, W, open.id, open.prep, cutM);
        return { reply: { type: 'result', id: m.id, name: open.name, recut: true, cutM, file: r.file, storeys: r.storeys }, transfer: r.transfer };
      }
      if (settings.mesh3d) {
        if (!open) return error(m.id, 'stale');
        const max = Number.isFinite(settings.maxTriangles) && settings.maxTriangles > 0 ? settings.maxTriangles : Infinity;
        const pack = createPacker({ origin: open.origin, maxTriangles: max });
        forEachElement(api, W, open.id, typeNamer(api, open.id), ({ eid, type, layer, m: g }) => {
          pack.add({ layer, type, name: pack.over ? '' : nameOf(api, open.id, eid), storey: open.prep.storeyOf(eid), P: g.P, ix: g.ix });
        });
        const { body, transfer } = pack.finish();
        return { reply: { type: 'result', id: m.id, name: open.name, ...body }, transfer };
      }
      if (open) { try { api.CloseModel(open.id); } catch (e) { /* already gone */ } open = null; }
      if (!m.bytes || m.bytes.byteLength > MAX_BYTES) return error(m.id, 'limit');
      const bytes = new Uint8Array(m.bytes);
      const s = sniff(bytes);
      if (!s.ok) return error(m.id, s.reason, s.detail);
      const id = api.OpenModel(bytes, { COORDINATE_TO_ORIGIN: false });
      // web-ifc refuses a schema it does not know; refusing one it knows means the file itself is unreadable.
      if (id < 0) return supported(W, s.schema) ? error(m.id, 'read') : error(m.id, 'schema', s.schema);
      const prep = prepare(api, W, id);
      const r = cutModel(api, W, id, prep, cutM);
      if (!r.file.products && !r.file.rooms) { api.CloseModel(id); return error(m.id, 'empty'); }
      const b = r.file.bbox;
      open = { id, prep, name: m.name, origin: [b.x0, b.y0, b.z0] };
      return { reply: { type: 'result', id: m.id, name: m.name, recut: false, cutM, file: r.file, storeys: r.storeys }, transfer: r.transfer };
    } catch (err) {
      // web-ifc out of memory or aborted: the bridge restarts the worker on an 'engine' error.
      open = null;
      return error(m.id, 'engine', String((err && err.message) || err));
    }
  }
  return { boot, process };
}

async function browserApi() {
  const api = new WebIFC.IfcAPI();
  await api.Init(file => new URL(`./vendor/web-ifc/${file}?v=20261103`, import.meta.url).href, true);
  api.SetLogLevel(WebIFC.LogLevel.LOG_LEVEL_OFF);
  return { api, W: WebIFC };
}

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  const session = createSession(browserApi);
  let ready = false;
  self.onmessage = async e => {
    const m = e.data;
    try {
      await session.boot();
      if (!ready) { ready = true; self.postMessage({ type: 'ready' }); }
    } catch (err) {
      if (m.type === 'process') self.postMessage({ type: 'error', id: m.id, reason: 'engine', detail: String((err && err.message) || err) });
      return;
    }
    if (m.type !== 'process') return;
    const { reply, transfer } = await session.process(m);
    self.postMessage(reply, transfer);
  };
}
```

Run: `node _tests/extract.mjs $PLAN js/ifcplan/model.js && node _tests/extract.mjs $PLAN js/ifcplan/worker.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 85`, `ℹ fail 0`. `model.test.js` is unchanged and still passes: the cut's results are the same.

- [ ] **Step 3: Commit**

```bash
git add js/ifcplan/model.js js/ifcplan/worker.js _tests/ifcplan/worker.test.js
git commit -F - <<'EOF'
IFC 3D view: the worker answers mesh3d from the open model

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 5: The triangle cap and the tooltip's parts

**Files:**
- Modify: `js/ifcplan/state.js` (two exports and two constants appended; its header comment updated)
- Test: `_tests/ifcplan/state.test.js` (two tests appended; the import line)

**Interfaces:**
- Produces (`js/ifcplan/state.js`, pure):
  - `TRIANGLES_DESKTOP` (2,000,000) and `TRIANGLES_SMALL` (500,000);
  - `triangleCap({ coarse, memoryGB }) → number`;
  - `tipParts(element, storeys) → [type, layer, name, storey name]`, without the empty parts.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/ifcplan/state.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanSettings, parseCut, showM, sizeBucket, storeysBucket, warningsOf, textsOf, DEFAULTS, SETTINGS_KEY, triangleCap, tipParts } from '../../js/ifcplan/state.js';

const result = over => ({
  file: { noStoreys: false, noGeometry: [], bbox: { x0: 120.5, y0: 80.25, x1: 130.5, y1: 88.35 }, ...over },
  storeys: [
    { name: 'Ισόγειο', rooms: [{ name: 'Σαλόνι', longName: '', areaM2: 43.61, crossed: true }] },
    { name: 'Όροφος 1', rooms: [{ name: '1.01', longName: 'Υπνοδωμάτιο', areaM2: 36.1, crossed: true }] },
  ],
});

test('settings: the defaults of spec §2, and only well-formed stored values are kept', () => {
  assert.equal(SETTINGS_KEY, 'aidedcam-ifcp-settings');
  assert.deepEqual(DEFAULTS, { cutM: 1.1, units: 'm', origin: false });
  assert.deepEqual(cleanSettings(null), DEFAULTS);
  assert.deepEqual(cleanSettings({ cutM: 0.9, units: 'mm', origin: true }), { cutM: 0.9, units: 'mm', origin: true });
  assert.deepEqual(cleanSettings({ cutM: -1, units: 'ft', origin: 'yes' }), DEFAULTS);
  assert.deepEqual(cleanSettings({ cutM: '1.5', units: 'toString' }), DEFAULTS);
});

test('the cut height: a comma or a point, from 0 to 10 m; anything else is refused, never guessed', () => {
  assert.deepEqual(['1,10', '1.10', '0', ' 2.5 ', '10'].map(parseCut), [1.1, 1.1, 0, 2.5, 10]);
  assert.deepEqual(['', '1,100.5', '1.380,5', '-1', '1e2', '10.01', 'abc', ',5'].map(parseCut), Array(8).fill(undefined));
  assert.deepEqual([showM(1.1, 'el'), showM(1.1, 'en'), showM(0, 'it')], ['1,10', '1.10', '0,00']);
});

test('GA buckets: sizes and storey counts, never the figures', () => {
  assert.deepEqual([0, 10 * 1024 * 1024 - 1, 10 * 1024 * 1024, 50 * 1024 * 1024, 50 * 1024 * 1024 + 1].map(sizeBucket), ['under-10mb', 'under-10mb', '10-50mb', '10-50mb', 'over-50mb']);
  assert.deepEqual([1, 2, 5, 6, 20, 21].map(storeysBucket), ['1', '2-5', '2-5', '6-20', '6-20', 'over-20']);
});

test('warnings: none on a clean model; missing geometry by type, far coordinates, no storeys, low rooms, code page', () => {
  assert.deepEqual(warningsOf(result(), { fileName: 'σπίτι.ifc', cutM: 1.1, origin: false }), []);
  const r = result({ noStoreys: true, noGeometry: [{ type: 'IfcWallStandardCase', count: 51 }, { type: 'IfcBuildingElementProxy', count: 14 }], bbox: { x0: 538450.5, y0: 6591584.1, x1: 538511, y1: 6591628.1 } });
  r.storeys[0].rooms.push({ name: 'Hall ✓', longName: '', areaM2: null, crossed: false });
  assert.deepEqual(warningsOf(r, { fileName: 'Küche−1.ifc', cutM: 1.1, origin: false }), [
    { id: 'nostoreys', params: { h: 1.1 } },
    { id: 'nogeometry', params: { n: 65, types: 'IfcWallStandardCase 51, IfcBuildingElementProxy 14' } },
    { id: 'far', params: { km: 6592 } },
    { id: 'lowrooms', params: { n: 1 } },
    { id: 'cp1253', params: { n: 3 } },
  ]);
  assert.ok(!warningsOf(r, { fileName: 'x.ifc', cutM: 1.1, origin: true }).some(w => w.id === 'far'), 'not once the plans are moved');
  assert.deepEqual(textsOf(result(), 'a.ifc'), ['a.ifc', 'Ισόγειο', 'Σαλόνι', '43.61 m²', 'Όροφος 1', '1.01', 'Υπνοδωμάτιο', '36.10 m²']);
});

test('storeys at one level (within 1 mm): a warning naming each shared level', () => {
  const at = levels => ({ file: { noStoreys: false, noGeometry: [], bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } }, storeys: levels.map((levelM, i) => ({ name: `S${i}`, levelM, rooms: [] })) });
  const opts = { fileName: 'a.ifc', cutM: 1.1, origin: false };
  assert.deepEqual(warningsOf(at([0, 3, 3.0004, 6, 6, 6, 9]), opts), [{ id: 'samelevel', params: { levels: [3, 6] } }]);
  assert.deepEqual(warningsOf(at([0, 0.0011, 3, 6]), opts), [], 'over 1 mm apart');
  assert.deepEqual(warningsOf(at([0]), opts), []);
  const r = at([0, 0]);
  r.file.noGeometry = [{ type: 'IfcWall', count: 1 }];
  assert.deepEqual(warningsOf(r, opts).map(w => w.id), ['samelevel', 'nogeometry']);
});

test('the 3D triangle cap: 2,000,000 on a desktop, 500,000 on a touch screen or with 4 GB of memory or less', () => {
  assert.equal(triangleCap({}), 2000000);
  assert.equal(triangleCap({ coarse: false, memoryGB: 8 }), 2000000);
  assert.equal(triangleCap({ coarse: true, memoryGB: 8 }), 500000);
  assert.equal(triangleCap({ coarse: false, memoryGB: 4 }), 500000);
  assert.equal(triangleCap({ coarse: false, memoryGB: undefined }), 2000000, 'deviceMemory unknown (Firefox, Safari)');
});

test('the 3D tooltip: type, layer, Name and storey, the empty parts left out', () => {
  const storeys = [{ name: 'Ισόγειο' }, { name: 'Όροφος 1' }];
  assert.deepEqual(tipParts({ type: 'IfcWall', layer: 'IFC_WALL', name: 'Basic Wall:200mm', storey: 0 }, storeys), ['IfcWall', 'IFC_WALL', 'Basic Wall:200mm', 'Ισόγειο']);
  assert.deepEqual(tipParts({ type: 'IfcSlab', layer: 'IFC_SLAB', name: '', storey: 1 }, storeys), ['IfcSlab', 'IFC_SLAB', 'Όροφος 1']);
  assert.deepEqual(tipParts({ type: 'IfcColumn', layer: 'IFC_COLUMN', name: 'C1', storey: -1 }, storeys), ['IfcColumn', 'IFC_COLUMN', 'C1']);
});
```

Run: `node _tests/extract.mjs $PLAN _tests/ifcplan/state.test.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 80`, `ℹ fail 1` (`state.test.js` cannot import `triangleCap`, so its five earlier tests do not run either).

- [ ] **Step 2: Write the module**

<!-- file: js/ifcplan/state.js -->
```js
// IFC floor plans: the controller's small decisions (spec §2, §6, §8; 3D spec §2, §4), kept pure for the Node tests:
// the stored settings, the typed cut height, the GA buckets, the warnings, the 3D triangle cap and the 3D tooltip.
import { UNITS, unencodable } from './dxf.js?v=20261103';
import { labelLines } from './rooms.js?v=20261103';

export const SETTINGS_KEY = 'aidedcam-ifcp-settings';
export const DEFAULTS = { cutM: 1.1, units: 'm', origin: false };
export const CUT_MAX = 10;                 // m above each storey's level
export const FAR_KM = 10;                  // coordinates farther than this suggest "move to origin"
export const SAME_LEVEL_M = 0.001;         // storeys this close in world Z sit at one level

const validCut = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= CUT_MAX;

// The settings read back from storage: only well-formed values survive, the rest are the defaults.
export function cleanSettings(obj) {
  const o = obj && typeof obj === 'object' ? obj : {};
  return {
    cutM: validCut(o.cutM) ? o.cutM : DEFAULTS.cutM,
    units: Object.prototype.hasOwnProperty.call(UNITS, o.units) ? o.units : DEFAULTS.units,
    origin: o.origin === true,
  };
}

// A typed cut height in metres: one decimal separator, comma or point, from 0 to 10 m. undefined when it is not one.
export function parseCut(text) {
  const s = String(text).trim();
  if (!/^\d+([.,]\d+)?$/.test(s)) return undefined;
  const v = Number(s.replace(',', '.'));
  return validCut(v) ? v : undefined;
}

// A height as the page shows it: 2 decimals, the page language's separator.
export const showM = (v, lang) => {
  const s = v.toFixed(2);
  return lang === 'en' ? s : s.replace('.', ',');
};

// GA buckets (spec §8): never the size or the storey count itself.
export const sizeBucket = bytes => (bytes < 10 * 1024 * 1024 ? 'under-10mb' : bytes <= 50 * 1024 * 1024 ? '10-50mb' : 'over-50mb');
export const storeysBucket = n => (n <= 1 ? '1' : n <= 5 ? '2-5' : n <= 20 ? '6-20' : 'over-20');

// Every string the DXFs write as text: the file name, the storey names and the room labels.
export function textsOf(result, fileName) {
  const out = [fileName];
  for (const s of result.storeys) {
    out.push(s.name);
    for (const r of s.rooms) out.push(...labelLines(r));
  }
  return out;
}

// The levels (m) shared by two or more storeys, each once, lowest first: their plans are cut at one height.
function sharedLevels(storeys) {
  const levels = storeys.map(s => s.levelM).filter(Number.isFinite).sort((a, b) => a - b);
  const out = [];
  for (let i = 1, start = 0; i <= levels.length; i++) {
    if (i < levels.length && levels[i] - levels[i - 1] <= SAME_LEVEL_M) continue;
    if (i - start > 1) out.push(levels[start]);
    start = i;
  }
  return out;
}

// The warnings of spec §6/§7, each { id, params }, in the order the page lists them.
export function warningsOf(result, { fileName, cutM, origin }) {
  const out = [];
  const f = result.file;
  if (f.noStoreys) out.push({ id: 'nostoreys', params: { h: cutM } });
  const levels = sharedLevels(result.storeys);
  if (levels.length) out.push({ id: 'samelevel', params: { levels } });
  const missing = f.noGeometry.reduce((a, x) => a + x.count, 0);
  if (missing) out.push({ id: 'nogeometry', params: { n: missing, types: f.noGeometry.map(x => `${x.type} ${x.count}`).join(', ') } });
  const b = f.bbox;
  const far = Math.max(Math.abs(b.x0), Math.abs(b.x1), Math.abs(b.y0), Math.abs(b.y1)) / 1000;
  if (!origin && far > FAR_KM) out.push({ id: 'far', params: { km: Math.round(far) } });
  const low = result.storeys.reduce((a, s) => a + s.rooms.filter(r => !r.crossed).length, 0);
  if (low) out.push({ id: 'lowrooms', params: { n: low } });
  const bad = unencodable(textsOf(result, fileName));
  if (bad) out.push({ id: 'cp1253', params: { n: bad } });
  return out;
}

// The 3D view's triangle cap (3D spec §2): 2,000,000 on a desktop; 500,000 on a touch screen (a coarse primary
// pointer) or with navigator.deviceMemory at 4 GB or less. Over it the worker builds no 3D data.
export const TRIANGLES_DESKTOP = 2000000;
export const TRIANGLES_SMALL = 500000;
export const triangleCap = ({ coarse = false, memoryGB } = {}) =>
  (coarse || (Number.isFinite(memoryGB) && memoryGB <= 4) ? TRIANGLES_SMALL : TRIANGLES_DESKTOP);

// The 3D tooltip's parts (3D spec §4): the IFC type, the layer, the element's Name and its storey's name, the empty
// ones left out. element is one of the mesh's `elements`; storeys the result's.
export function tipParts(element, storeys) {
  const storey = element.storey >= 0 && storeys[element.storey] ? storeys[element.storey].name : '';
  return [element.type, element.layer, element.name, storey].filter(Boolean);
}
```

Run: `node _tests/extract.mjs $PLAN js/ifcplan/state.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 87`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/ifcplan/state.js _tests/ifcplan/state.test.js
git commit -F - <<'EOF'
IFC 3D view: the triangle cap per device and the 3D tooltip's parts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 6: The plan preview hides layers

**Files:**
- Modify: `js/ifcplan/drawing.js` (a `hidden` set: skipped in drawing and picking; `setHidden(set)`; the header comment)
- Test: `_tests/ifcplan/drawing.test.js` (one test appended)

**Interfaces:**
- Produces (`createDrawing`): `setHidden(set)` redraws at once without those layers; `layerAt` skips them; hiding `IFC_SPACE` also hides the room labels; `layers` still lists every layer of the storey (for the legend).

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/ifcplan/drawing.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYER_COLORS, LEGEND_ORDER, createDrawing } from '../../js/ifcplan/drawing.js';
import { LAYERS } from '../../js/ifcplan/layers.js';
import { polylineSet } from '../../js/ifcplan/chain.js';

test('every layer of spec §4 has a preview colour; the legend follows the spec order, without the label layer', () => {
  assert.deepEqual(Object.keys(LAYER_COLORS).sort(), LAYERS.map(l => l.name).sort());
  for (const c of Object.values(LAYER_COLORS)) assert.match(c, /^#[0-9a-f]{6}$/);
  assert.deepEqual(LEGEND_ORDER, LAYERS.map(l => l.name).slice(0, 13));
  assert.equal(typeof createDrawing, 'function');
});

test('hover picking is coalesced: at most one pick per animation frame, at the latest pointer position', () => {
  const frames = [], on = {}, hovers = [];
  const saved = { ResizeObserver: globalThis.ResizeObserver, raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame };
  globalThis.ResizeObserver = class { observe() {} };
  globalThis.requestAnimationFrame = fn => frames.push(fn);
  globalThis.cancelAnimationFrame = id => { frames[id - 1] = null; };
  const flush = () => frames.splice(0).forEach(fn => fn && fn());
  try {
    const canvas = { getContext: () => ({}), addEventListener: (type, fn) => { on[type] = fn; }, getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 100 }) };
    createDrawing(canvas, { onHover: (layer, x, y) => hovers.push([layer, x, y]) });
    for (const x of [30, 40, 50]) on.pointermove({ pointerType: 'mouse', pointerId: 1, clientX: x, clientY: 60 });
    assert.deepEqual(hovers, [], 'nothing picked before the frame');
    assert.equal(frames.length, 1, 'one frame asked for');
    flush();
    assert.deepEqual(hovers, [[null, 50, 60]]);
    on.pointermove({ pointerType: 'mouse', pointerId: 1, clientX: 70, clientY: 60 });
    on.pointerleave({});
    flush();
    assert.deepEqual(hovers, [[null, 50, 60], [null, 0, 0]], 'leaving cancels the pending pick');
    on.pointermove({ pointerType: 'touch', pointerId: 2, clientX: 70, clientY: 60 });
    assert.equal(frames.length, 0, 'no hover on touch');
  } finally {
    globalThis.ResizeObserver = saved.ResizeObserver;
    globalThis.requestAnimationFrame = saved.raf;
    globalThis.cancelAnimationFrame = saved.caf;
  }
});

test('hidden layers (the legend toggles): not drawn, not picked, and still listed for the legend', () => {
  const saved = { ResizeObserver: globalThis.ResizeObserver, Path2D: globalThis.Path2D, window: globalThis.window, gcs: globalThis.getComputedStyle };
  globalThis.ResizeObserver = class { observe() {} };
  globalThis.Path2D = class { moveTo() {} lineTo() {} closePath() {} };
  globalThis.window = { devicePixelRatio: 1 };
  globalThis.getComputedStyle = () => ({ backgroundColor: '#fff' });
  const strokes = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : k === 'stroke' ? () => strokes.push(t.strokeStyle) : () => {}),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const line = (x0, y0, x1, y1) => { const s = polylineSet(); s.add([x0, y0, x1, y1], false); return s.pack(); };
  try {
    const canvas = { getContext: () => ctx, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }), width: 0, height: 0 };
    const d = createDrawing(canvas);
    const room = { name: 'R', longName: '', areaM2: 1, at: [5, 2.5] };
    d.show({ layers: { IFC_WALL: line(0, 0, 10, 0), IFC_DOOR: line(0, 5, 10, 5) }, rooms: [room] }, { x0: 0, y0: 0, x1: 10, y1: 5 });
    const wall = d.screenOf(5, 0);
    assert.equal(d.layerAt(wall.x, wall.y), 'IFC_WALL');
    assert.deepEqual(strokes, [LAYER_COLORS.IFC_DOOR, LAYER_COLORS.IFC_WALL]);
    strokes.length = 0;
    d.setHidden(new Set(['IFC_WALL']));
    assert.deepEqual(strokes, [LAYER_COLORS.IFC_DOOR], 'redrawn at once, without the wall');
    assert.equal(d.layerAt(wall.x, wall.y), null, 'a hidden layer is not picked');
    assert.deepEqual(d.layers, ['IFC_DOOR', 'IFC_WALL'], 'the legend still lists it');
    d.setHidden(new Set());
    assert.equal(d.layerAt(wall.x, wall.y), 'IFC_WALL');
  } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; }
  }
});
```

Run: `node _tests/extract.mjs $PLAN _tests/ifcplan/drawing.test.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 87`, `ℹ fail 1` (`d.setHidden is not a function`).

- [ ] **Step 2: Write the module**

<!-- file: js/ifcplan/drawing.js -->
```js
// IFC floor plans: the preview of one storey's plan (spec §6). A Canvas 2D view: each layer in its colour (the ACI
// hue of spec §4, darkened where it would vanish on the page's light background), rooms faintly filled with their
// labels, pan with a drag, zoom with the wheel, a pinch or the buttons, and a tooltip naming the layer under the
// pointer. Every storey is fitted to the whole model, so switching storeys keeps them aligned. Coordinates are kept
// relative to the model's lower-left corner, so georeferenced coordinates stay precise. Layers the legend hides
// (setHidden) are neither drawn nor picked; hiding IFC_SPACE hides the room labels too.
import { LAYERS } from './layers.js?v=20261103';
import { forEachPolyline } from './chain.js?v=20261103';
import { labelLines } from './rooms.js?v=20261103';

export const LAYER_COLORS = {
  IFC_WALL: '#17170f', IFC_DOOR: '#0e7490', IFC_WINDOW: '#1d4ed8', IFC_COLUMN: '#b91c1c', IFC_BEAM: '#6b7280',
  IFC_SLAB: '#9ca3af', IFC_STAIR: '#15803d', IFC_RAILING: '#c2410c', IFC_CURTAINWALL: '#0369a1', IFC_FURNITURE: '#a16207',
  IFC_MEP: '#a21caf', IFC_OTHER: '#57534e', IFC_SPACE: '#a16207', IFC_SPACE_TEXT: '#a16207',
};
// Drawn bottom to top: rooms and slabs under everything, walls on top.
const ORDER = ['IFC_SPACE', 'IFC_SLAB', 'IFC_OTHER', 'IFC_FURNITURE', 'IFC_MEP', 'IFC_BEAM', 'IFC_CURTAINWALL', 'IFC_RAILING', 'IFC_STAIR', 'IFC_WINDOW', 'IFC_DOOR', 'IFC_COLUMN', 'IFC_WALL'];
const PICK_PX = 6;

export function createDrawing(canvas, { onHover = () => {} } = {}) {
  const ctx = canvas.getContext('2d');
  let storey = null, X0 = 0, Y0 = 0, bw = 1, bh = 1;
  let paths = new Map();                     // layer → Path2D, relative to (X0, Y0)
  let w = 1, h = 1, dpr = 1, k = 1, cx = 0, cy = 0, fitted = false, frame = 0;
  let drag = null, pinch = null, userMoved = false;
  let hover = null, hoverFrame = 0;          // the latest pointer position to pick at, one pick per frame
  let hidden = new Set();                    // layers the legend switched off
  const touches = new Map();

  const toModel = (sx, sy) => ({ x: (sx - w / 2) / k + cx, y: (h / 2 - sy) / k + cy });
  const local = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    if ((!fitted || !userMoved) && storey) fit(); else draw();
  }

  function fit() {
    fitted = true; userMoved = false;
    k = 0.92 * Math.min(bw > 0 ? w / bw : Infinity, bh > 0 ? h / bh : Infinity);
    if (!Number.isFinite(k) || k <= 0) k = 10;
    cx = bw / 2; cy = bh / 2;
    draw();
  }

  function build() {
    paths = new Map();
    if (!storey) return;
    for (const name of ORDER) {
      const set = storey.layers[name];
      if (!set || !set.ends.length) continue;
      const p = new Path2D();
      forEachPolyline(set, (pts, closed) => {
        if (pts.length < 4) return;
        p.moveTo(pts[0] - X0, pts[1] - Y0);
        for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i] - X0, pts[i + 1] - Y0);
        if (closed) p.closePath();
      });
      paths.set(name, p);
    }
  }

  function draw() {
    frame = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = getComputedStyle(canvas).backgroundColor || '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!storey) return;
    ctx.setTransform(dpr * k, 0, 0, -dpr * k, dpr * (w / 2 - cx * k), dpr * (h / 2 + cy * k));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [name, p] of paths) {
      if (hidden.has(name)) continue;
      if (name === 'IFC_SPACE') { ctx.globalAlpha = 0.08; ctx.fillStyle = LAYER_COLORS[name]; ctx.fill(p, 'evenodd'); }
      ctx.globalAlpha = name === 'IFC_SPACE' || name === 'IFC_SLAB' ? 0.6 : 1;
      ctx.strokeStyle = LAYER_COLORS[name];
      ctx.lineWidth = (name === 'IFC_WALL' ? 1.4 : 1) / k;
      ctx.stroke(p);
    }
    ctx.globalAlpha = 1;
    // Room labels at 0.20 m of the model, as in the DXF, when they are big enough to read.
    const px = Math.min(14, 0.2 * k);
    if (px < 6 || hidden.has('IFC_SPACE')) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `500 ${px}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = LAYER_COLORS.IFC_SPACE_TEXT;
    for (const r of storey.rooms) {
      if (!r.at) continue;
      const lines = labelLines(r);
      const sx = (r.at[0] - X0 - cx) * k + w / 2, sy = h / 2 - (r.at[1] - Y0 - cy) * k;
      lines.forEach((t, i) => ctx.fillText(t, sx, sy + (i - (lines.length - 1) / 2) * px * 1.3));
    }
  }
  const request = () => { if (!frame) frame = requestAnimationFrame(draw); };

  function zoomAt(sx, sy, f) {
    const m = toModel(sx, sy);
    k = Math.min(1e7, Math.max(1e-6, k * f));
    userMoved = true;
    cx = m.x - (sx - w / 2) / k; cy = m.y - (h / 2 - sy) / k;
    request();
  }

  // The layer of the line nearest the pointer, within a few pixels; the topmost layer wins a tie.
  function layerAt(sx, sy) {
    if (!storey) return null;
    const m = toModel(sx, sy), x = m.x + X0, y = m.y + Y0, tol = PICK_PX / k;
    let best = null, bestD = tol;
    for (const name of ORDER) {
      const set = storey.layers[name];
      if (!set || hidden.has(name)) continue;
      forEachPolyline(set, (pts, closed) => {
        const n = pts.length / 2;
        for (let i = closed ? 0 : 1; i < n; i++) {
          const j = i === 0 ? n - 1 : i - 1;
          const ax = pts[2 * j], ay = pts[2 * j + 1], dx = pts[2 * i] - ax, dy = pts[2 * i + 1] - ay;
          if (Math.abs(x - ax) > bestD + Math.abs(dx) || Math.abs(y - ay) > bestD + Math.abs(dy)) continue;
          const l2 = dx * dx + dy * dy;
          const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
          const d = Math.hypot(x - ax - t * dx, y - ay - t * dy);
          if (d <= bestD) { bestD = d; best = name; }
        }
      });
    }
    return best;
  }

  // Hover picking walks every polyline: done at most once per animation frame, at the latest pointer position.
  function pick() {
    hoverFrame = 0;
    const q = hover;
    hover = null;
    if (q) onHover(layerAt(q.x, q.y), q.clientX, q.clientY);
  }
  function hoverAt(p, e) {
    hover = { x: p.x, y: p.y, clientX: e.clientX, clientY: e.clientY };
    if (!hoverFrame) hoverFrame = requestAnimationFrame(pick);
  }
  function stopHover() {
    if (hoverFrame) cancelAnimationFrame(hoverFrame);
    hoverFrame = 0; hover = null;
  }

  function onDown(e) {
    if (!storey) return;
    canvas.setPointerCapture(e.pointerId);
    const p = local(e);
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, p);
      if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k }; drag = null; return; }
    }
    drag = { x: p.x, y: p.y, cx, cy, moved: false };
  }
  function onMove(e) {
    const p = local(e);
    if (pinch && touches.has(e.pointerId)) {
      touches.set(e.pointerId, p);
      const [a, b] = [...touches.values()];
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (pinch.k * (Math.hypot(a.x - b.x, a.y - b.y) || 1)) / pinch.d / k);
      return;
    }
    if (!drag) { if (e.pointerType !== 'touch') hoverAt(p, e); return; }
    if (!drag.moved && Math.hypot(p.x - drag.x, p.y - drag.y) < 4) return;
    drag.moved = true; userMoved = true;
    cx = drag.cx - (p.x - drag.x) / k; cy = drag.cy + (p.y - drag.y) / k;
    request();
  }
  function onUp(e) {
    touches.delete(e.pointerId);
    if (pinch) { if (touches.size < 2) pinch = null; return; }
    drag = null;
  }
  function onWheel(e) {
    if (!storey) return;
    e.preventDefault();
    const p = local(e);
    zoomAt(p.x, p.y, Math.exp(-(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY) * 0.0015));
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', e => { touches.delete(e.pointerId); drag = null; pinch = null; });
  canvas.addEventListener('pointerleave', () => { stopHover(); onHover(null, 0, 0); });
  canvas.addEventListener('wheel', onWheel, { passive: false });
  new ResizeObserver(resize).observe(canvas);

  return {
    // storey: one storey of the worker's answer; bbox: the whole model's, so every storey lines up. keepView keeps
    // the pan and zoom (another storey of the same file).
    show(next, bbox, keepView = false) {
      storey = next;
      if (!keepView || !fitted) {
        X0 = bbox.x0; Y0 = bbox.y0; bw = Math.max(0, bbox.x1 - bbox.x0); bh = Math.max(0, bbox.y1 - bbox.y0); fitted = false;
      }
      build();
      resize();
    },
    clear() { storey = null; paths = new Map(); fitted = false; draw(); },
    fit, zoomBy(f) { zoomAt(w / 2, h / 2, f); },
    // The layers the legend switched off; redrawn at once.
    setHidden(set) { hidden = new Set(set); draw(); },
    // The layers of this storey's plan, hidden or not, in drawing order (for the legend and the browser check).
    get layers() { return [...paths.keys()]; },
    // For the browser check: where a model point is on screen (CSS px in the canvas), and the layer under it.
    screenOf(x, y) { return { x: (x - X0 - cx) * k + w / 2, y: h / 2 - (y - Y0 - cy) * k }; },
    layerAt,
  };
}

// The legend's order: spec §4's.
export const LEGEND_ORDER = LAYERS.map(l => l.name).filter(n => n !== 'IFC_SPACE_TEXT');
```

Run: `node _tests/extract.mjs $PLAN js/ifcplan/drawing.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 88`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/ifcplan/drawing.js _tests/ifcplan/drawing.test.js
git commit -F - <<'EOF'
IFC 3D view: the plan preview hides the layers the legend switches off

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 7: The strings

**Files:**
- Modify: `js/ifcplan/i18n-ifcplan.js` (17 keys per language, after `ip.tip.layer`)
- Test: `_tests/ifcplan/i18n.test.js` (the computed 3D keys; one test of spec §6 word for word)

**Interfaces:**
- Produces (`window.IP_I18N`, el/en/it): `ip.tab.plan`, `ip.tab.3d`, `ip.aria.tabs`, `ip.aria.3d`, `ip.3d.loading`, `ip.3d.cut`, `ip.3d.whole`, `ip.3d.cutat` (`{h}`), `ip.3d.top`, `ip.3d.front`, `ip.3d.side`, `ip.3d.iso`, `ip.3d.large`, `ip.3d.nogl`, `ip.3d.stale`, `ip.3d.failed`, `ip.legend.note`.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/ifcplan/i18n.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { UNITS } from '../../js/ifcplan/dxf.js';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const ph = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');

function toolStrings() {
  const window = {};
  vm.runInNewContext(read('../../js/ifcplan/i18n-ifcplan.js'), { window });
  return window.IP_I18N;
}

// Ids that reach the strings through a computed key.
const WARNINGS = ['none', 'nogeometry', 'far', 'cp1253', 'nostoreys', 'lowrooms', 'samelevel'];
const ERRORS = ['read', 'read.ifczip', 'read.ifcxml', 'schema', 'limit', 'timeout', 'engine', 'empty'];
const PRESETS = ['top', 'front', 'side', 'iso'];
const NOTES_3D = ['loading', 'large', 'nogl', 'stale', 'failed'];

test('tool strings: only ip.* keys, the same keys and placeholders in el, en and it', () => {
  const s = toolStrings();
  const en = Object.keys(s.en).sort();
  assert.ok(en.length >= 70, `${en.length} keys`);
  assert.ok(en.every(k => k.startsWith('ip.')));
  assert.deepEqual(Object.keys(s.el).sort(), en);
  assert.deepEqual(Object.keys(s.it).sort(), en);
  for (const k of en) {
    assert.equal(ph(s.el[k]), ph(s.en[k]), `el ${k}`);
    assert.equal(ph(s.it[k]), ph(s.en[k]), `it ${k}`);
    for (const l of ['el', 'en', 'it']) assert.ok(String(s[l][k]).trim().length > 0, `${l} ${k} is empty`);
  }
});

test('every computed key has a string in every language', () => {
  const s = toolStrings();
  const keys = [...WARNINGS.map(id => `ip.warn.${id}`), ...ERRORS.map(id => `ip.err.${id}`), ...Object.keys(UNITS).map(u => `ip.unit.${u}`),
    ...PRESETS.map(p => `ip.3d.${p}`), ...NOTES_3D.map(n => `ip.3d.${n}`)];
  for (const k of keys) for (const l of ['el', 'en', 'it']) assert.ok(k in s[l], `${l} missing ${k}`);
});

test('every literal ip.* key the modules and the page use exists', () => {
  const s = toolStrings();
  const dir = new URL('../../js/ifcplan/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'i18n-ifcplan.js').map(f => readFileSync(new URL(f, dir), 'utf8'));
  files.push(read('../../ifc-plans.html'));
  let used = 0;
  for (const src of files) {
    for (const m of src.matchAll(/['"`](ip\.[A-Za-z0-9.-]+[A-Za-z0-9])['"`]/g)) { used++; assert.ok(m[1] in s.en, `${m[1]} has no string`); }
  }
  assert.ok(used >= 40, `${used} keys found`);
});

test('the Italian uses the typographic apostrophe and the formal voi', () => {
  const s = toolStrings();
  for (const [k, v] of Object.entries(s.it)) {
    assert.ok(!v.includes("'"), `it ${k} has a straight apostrophe`);
    assert.ok(!/\b(tu|tuo|tua|tuoi|tue|ti|Trascina|Scegli|Prova|Esporta|Controlla|Premi|Verifica)\b/.test(v), `it ${k} is not formal: ${v}`);
  }
  assert.ok(Object.values(s.it).some(v => /\b(vostro|vostri|Trascinate|scegliete)\b/.test(v)));
});

test('the page carries the Greek strings inline, as the page starts in Greek', () => {
  const s = toolStrings();
  const page = read('../../ifc-plans.html');
  let n = 0;
  for (const m of page.matchAll(/data-i18n="(ip\.[^"]+)"[^>]*>([^<]*)</g)) { n++; assert.equal(m[2], s.el[m[1]], m[1]); }
  for (const m of page.matchAll(/data-i18n-aria="(ip\.[^"]+)" aria-label="([^"]*)"/g)) { n++; assert.equal(m[2], s.el[m[1]], m[1]); }
  assert.ok(n >= 40, `${n} inline strings`);
});

test('the 3D view strings of 3D spec §6, word for word', () => {
  const s = toolStrings();
  const want = {
    'ip.tab.plan': ['Κάτοψη', 'Plan', 'Pianta'],
    'ip.tab.3d': ['3D', '3D', '3D'],
    'ip.3d.loading': ['Ετοιμάζεται η προβολή 3D…', 'Preparing the 3D view…', 'Preparazione della vista 3D…'],
    'ip.3d.cut': ['Τομή στο ύψος της κάτοψης', 'Cut at the plan height', 'Taglio all’altezza della pianta'],
    'ip.3d.whole': ['ολόκληρο το μοντέλο', 'whole model', 'modello intero'],
    'ip.3d.cutat': ['τομή στα {h} m', 'cut at {h} m', 'taglio a {h} m'],
    'ip.3d.top': ['Κάτοψη', 'Top', 'Pianta'],
    'ip.3d.front': ['Πρόσοψη', 'Front', 'Fronte'],
    'ip.3d.side': ['Πλάγια', 'Side', 'Lato'],
    'ip.3d.iso': ['Αξονομετρικό', 'Iso', 'Iso'],
    'ip.3d.large': ['Το μοντέλο είναι πολύ μεγάλο για την προβολή 3D σε αυτόν τον browser· οι κατόψεις δεν επηρεάζονται.', 'This model is too large for the 3D view in this browser; the plans are unaffected.', 'Il modello è troppo grande per la vista 3D in questo browser; le piante non cambiano.'],
    'ip.3d.nogl': ['Η προβολή 3D δεν είναι διαθέσιμη σε αυτόν τον browser.', '3D is not available in this browser.', 'La vista 3D non è disponibile in questo browser.'],
    'ip.3d.stale': ['Ανοίξτε ξανά το αρχείο για να το δείτε σε 3D.', 'Open the file again to see it in 3D.', 'Riaprite il file per vederlo in 3D.'],
    'ip.3d.failed': ['Η προβολή 3D δεν μπόρεσε να φτιαχτεί· οι κατόψεις δεν επηρεάζονται.', 'The 3D view could not be built; the plans are unaffected.', 'Non è stato possibile creare la vista 3D; le piante non cambiano.'],
    'ip.legend.note': ['Η απόκρυψη στρώσης αλλάζει μόνο την προεπισκόπηση· το DXF κρατά όλες τις στρώσεις.', 'Hiding a layer changes only the preview; the DXF keeps every layer.', 'Nascondere un layer cambia solo l’anteprima; il DXF conserva tutti i layer.'],
  };
  for (const [k, [el, en, it]] of Object.entries(want)) assert.deepEqual([s.el[k], s.en[k], s.it[k]], [el, en, it], k);
});
```

Run: `node _tests/extract.mjs $PLAN _tests/ifcplan/i18n.test.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 87`, `ℹ fail 2` (the computed keys and spec §6).

- [ ] **Step 2: Write the strings**

<!-- file: js/ifcplan/i18n-ifcplan.js -->
```js
// IFC floor plans strings (GR/EN/IT). The page merges them under its own inline keys into window.GV_I18N, which the
// shared shell's t() reads. Placeholders are {name}; every language has the same keys and placeholders. The Italian
// uses the formal "voi" and the typographic apostrophe.
window.IP_I18N = {
  el: {
    "ip.back": "Αρχική",
    "ip.eyebrow": "Εργαλείο",
    "ip.title": "Κατόψεις DXF από IFC",
    "ip.lede": "Ρίξτε ένα μοντέλο IFC και πάρτε μία κάτοψη R12 DXF ανά όροφο, κομμένη στο ύψος που ορίζετε: κάθε τύπος στοιχείου στη δική του στρώση, κάθε χώρος με το όνομα και το εμβαδόν του.",
    "ip.privacy": "Το αρχείο μένει στον υπολογιστή σας· τίποτα δεν ανεβαίνει.",
    "ip.indicative": "Κατόψεις κομμένες από τη γεωμετρία του μοντέλου. Ελέγξτε τες απέναντι στα σχέδια του αρχιτέκτονα.",
    "ip.cross": "Όλα τα εργαλεία →",
    "ip.aria.files": "Αρχείο",
    "ip.open": "Άνοιγμα αρχείου",
    "ip.example": "Φόρτωση παραδείγματος",
    "ip.clear": "Καθαρισμός",
    "ip.drop": "Σύρετε εδώ ένα αρχείο IFC, ή πατήστε «Άνοιγμα αρχείου».",
    "ip.settings": "Ρυθμίσεις",
    "ip.set.cut": "Ύψος τομής πάνω από τη στάθμη κάθε ορόφου (m)",
    "ip.set.units": "Μονάδες των DXF",
    "ip.set.origin": "Μετακίνηση στην αρχή των αξόνων",
    "ip.set.hint": "Οι ρυθμίσεις μένουν σε αυτόν τον browser. Οι μονάδες και η μετακίνηση αλλάζουν μόνο τα DXF· η μετατόπιση γράφεται σε σχόλιο μέσα σε κάθε αρχείο.",
    "ip.unit.m": "μέτρα (m)",
    "ip.unit.cm": "εκατοστά (cm)",
    "ip.unit.mm": "χιλιοστά (mm)",
    "ip.processing": "Ανάγνωση του μοντέλου…",
    "ip.large": "Μεγάλο αρχείο: η ανάγνωση ίσως αργήσει λίγο…",
    "ip.recutting": "Νέα τομή στα {h} m…",
    "ip.recut.time": "Νέα τομή στα {h} m σε {s} s.",
    "ip.engine.nowasm": "Ο browser σας δεν υποστηρίζει WebAssembly, που χρειάζεται το εργαλείο. Δοκιμάστε μια πρόσφατη έκδοση Chrome, Edge, Firefox ή Safari.",
    "ip.example.failed": "Το παράδειγμα δεν φορτώθηκε. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.",
    "ip.sum.storeys": "{n} όροφοι",
    "ip.sum.products": "{n} στοιχεία",
    "ip.sum.rooms": "{n} χώροι",
    "ip.sum.units": "DXF σε {units}",
    "ip.sum.shift": "μετατόπιση X {x} m, Y {y} m",
    "ip.storeys": "Όροφοι",
    "ip.zip": "Λήψη όλων (ZIP)",
    "ip.col.storey": "Όροφος",
    "ip.col.level": "Στάθμη (m)",
    "ip.col.cut": "Στοιχεία στην τομή",
    "ip.col.nogeo": "⚠ Χωρίς γεωμετρία",
    "ip.col.rooms": "Χώροι",
    "ip.col.dxf": "DXF",
    "ip.row.nothing": "τίποτα στα {h} m",
    "ip.row.dxf": "DXF",
    "ip.row.dxf.aria": "Λήψη DXF: {name}",
    "ip.storey.fallback": "Όροφος",
    "ip.preview": "Προεπισκόπηση",
    "ip.fit": "Προσαρμογή",
    "ip.zoomin": "Μεγέθυνση",
    "ip.zoomout": "Σμίκρυνση",
    "ip.aria.drawing": "Κάτοψη του επιλεγμένου ορόφου",
    "ip.legend": "Υπόμνημα",
    "ip.tip.layer": "Στρώση",
    "ip.tab.plan": "Κάτοψη",
    "ip.tab.3d": "3D",
    "ip.aria.tabs": "Προβολή",
    "ip.aria.3d": "Τρισδιάστατη προβολή του μοντέλου, κομμένη στο ύψος της κάτοψης",
    "ip.3d.loading": "Ετοιμάζεται η προβολή 3D…",
    "ip.3d.cut": "Τομή στο ύψος της κάτοψης",
    "ip.3d.whole": "ολόκληρο το μοντέλο",
    "ip.3d.cutat": "τομή στα {h} m",
    "ip.3d.top": "Κάτοψη",
    "ip.3d.front": "Πρόσοψη",
    "ip.3d.side": "Πλάγια",
    "ip.3d.iso": "Αξονομετρικό",
    "ip.3d.large": "Το μοντέλο είναι πολύ μεγάλο για την προβολή 3D σε αυτόν τον browser· οι κατόψεις δεν επηρεάζονται.",
    "ip.3d.nogl": "Η προβολή 3D δεν είναι διαθέσιμη σε αυτόν τον browser.",
    "ip.3d.stale": "Ανοίξτε ξανά το αρχείο για να το δείτε σε 3D.",
    "ip.3d.failed": "Η προβολή 3D δεν μπόρεσε να φτιαχτεί· οι κατόψεις δεν επηρεάζονται.",
    "ip.legend.note": "Η απόκρυψη στρώσης αλλάζει μόνο την προεπισκόπηση· το DXF κρατά όλες τις στρώσεις.",
    "ip.warnings": "Προειδοποιήσεις",
    "ip.warn.none": "Καμία προειδοποίηση.",
    "ip.warn.nogeometry": "{n} στοιχεία δεν είχαν γεωμετρία και δεν σχεδιάζονται ({types}).",
    "ip.warn.far": "Οι συντεταγμένες απέχουν {km} km από την αρχή των αξόνων· σκεφτείτε τη «Μετακίνηση στην αρχή των αξόνων».",
    "ip.warn.cp1253": "{n} χαρακτήρες δεν γράφονται στην ελληνική κωδικοσελίδα 1253 και στα DXF γίνονται «?».",
    "ip.warn.nostoreys": "Το μοντέλο δεν έχει ορόφους: όλα μπαίνουν σε μία κάτοψη, κομμένη {h} m πάνω από το μηδέν.",
    "ip.warn.lowrooms": "{n} χώροι δεν φτάνουν στο ύψος της τομής: η ετικέτα τους μπαίνει στη μέση τους, χωρίς περίγραμμα.",
    "ip.warn.samelevel": "Ορισμένοι όροφοι βρίσκονται στο ίδιο επίπεδο ({levels})· οι κατόψεις τους μπορεί να είναι ίδιες. Ελέγξτε τις θέσεις των ορόφων στο IFC.",
    "ip.v1": "Δεν σχεδιάζονται σε αυτή την έκδοση: φορές ανοιγμάτων θυρών, σκαλοπάτια κάτω από την τομή, κρυμμένες γραμμές, διαστάσεις.",
    "ip.err.read": "Το αρχείο δεν είναι IFC που διαβάζεται: υποστηρίζεται .ifc σε μορφή κειμένου STEP.",
    "ip.err.read.ifczip": "Τα αρχεία .ifcZIP δεν υποστηρίζονται: αποσυμπιέστε το και ρίξτε το .ifc που περιέχει.",
    "ip.err.read.ifcxml": "Τα αρχεία .ifcXML δεν υποστηρίζονται: εξάγετε το μοντέλο ως .ifc (κείμενο STEP).",
    "ip.err.schema": "Ο αναγνώστης IFC δεν ανοίγει το σχήμα «{schema}». Εξάγετε το μοντέλο ως IFC2X3 ή IFC4.",
    "ip.err.limit": "Το αρχείο είναι πάνω από 150 MB, περισσότερο από όσο αντέχει αξιόπιστα μια καρτέλα browser.",
    "ip.err.timeout": "Το μοντέλο δεν διαβάστηκε σε 120 s. Για μεγάλα αρχεία, δοκιμάστε έναν browser σε υπολογιστή.",
    "ip.err.engine": "Ο αναγνώστης IFC σταμάτησε, πιθανόν από έλλειψη μνήμης. Για μεγάλα αρχεία, δοκιμάστε έναν browser σε υπολογιστή.",
    "ip.err.empty": "Το μοντέλο δεν έχει στοιχεία με γεωμετρία για να κοπούν.",
    "ip.cta.title": "Κατόψεις στα πρότυπα του γραφείου σας;",
    "ip.cta.text": "Τις στήνουμε στις δικές σας στρώσεις και τα δικά σας μπλοκ, με φορές ανοιγμάτων, διαστάσεις και μαζική μετατροπή μέσα στο CAD σας.",
    "ip.cta.link": "Επικοινωνήστε μαζί μας",
    "ip.survey.q": "Πώς παίρνετε σήμερα κατόψεις από ένα IFC;",
    "ip.survey.addon": "Με πρόσθετο στο CAD μου",
    "ip.survey.ask": "Ζητάω DWG από τον αρχιτέκτονα",
    "ip.survey.other": "Αλλιώς",
    "ip.survey.thanks": "Ευχαριστούμε!",
    "ip.notice": "Ανάγνωση IFC: web-ifc (ThatOpen Company), MPL-2.0,",
    "ip.notice.link": "ο κώδικας στο GitHub",
  },
  en: {
    "ip.back": "Home",
    "ip.eyebrow": "Tool",
    "ip.title": "DXF floor plans from IFC",
    "ip.lede": "Drop an IFC model and get one R12 DXF floor plan per storey, cut at the height you choose: every element type on its own layer, every room with its name and area.",
    "ip.privacy": "Your file stays on your computer; nothing is uploaded.",
    "ip.indicative": "Plans cut from the model's geometry. Check them against the architect's drawings.",
    "ip.cross": "All tools →",
    "ip.aria.files": "File",
    "ip.open": "Open file",
    "ip.example": "Load example",
    "ip.clear": "Clear",
    "ip.drop": "Drop an IFC file here, or press “Open file”.",
    "ip.settings": "Settings",
    "ip.set.cut": "Cut height above each storey's level (m)",
    "ip.set.units": "DXF units",
    "ip.set.origin": "Move to origin",
    "ip.set.hint": "The settings stay in this browser. Units and the move only change the DXFs; the shift is written as a comment in each file.",
    "ip.unit.m": "metres (m)",
    "ip.unit.cm": "centimetres (cm)",
    "ip.unit.mm": "millimetres (mm)",
    "ip.processing": "Reading the model…",
    "ip.large": "Large file: reading it may take a while…",
    "ip.recutting": "Re-cutting at {h} m…",
    "ip.recut.time": "Re-cut at {h} m in {s} s.",
    "ip.engine.nowasm": "Your browser doesn't support WebAssembly, which the tool needs. Try a recent Chrome, Edge, Firefox or Safari.",
    "ip.example.failed": "The example didn't load. Check your connection and try again.",
    "ip.sum.storeys": "{n} storeys",
    "ip.sum.products": "{n} elements",
    "ip.sum.rooms": "{n} rooms",
    "ip.sum.units": "DXF in {units}",
    "ip.sum.shift": "shift X {x} m, Y {y} m",
    "ip.storeys": "Storeys",
    "ip.zip": "Download all (ZIP)",
    "ip.col.storey": "Storey",
    "ip.col.level": "Level (m)",
    "ip.col.cut": "Elements cut",
    "ip.col.nogeo": "⚠ Without geometry",
    "ip.col.rooms": "Rooms",
    "ip.col.dxf": "DXF",
    "ip.row.nothing": "nothing at {h} m",
    "ip.row.dxf": "DXF",
    "ip.row.dxf.aria": "Download the DXF: {name}",
    "ip.storey.fallback": "Storey",
    "ip.preview": "Preview",
    "ip.fit": "Fit",
    "ip.zoomin": "Zoom in",
    "ip.zoomout": "Zoom out",
    "ip.aria.drawing": "Floor plan of the selected storey",
    "ip.legend": "Legend",
    "ip.tip.layer": "Layer",
    "ip.tab.plan": "Plan",
    "ip.tab.3d": "3D",
    "ip.aria.tabs": "View",
    "ip.aria.3d": "3D view of the model, cut at the plan height",
    "ip.3d.loading": "Preparing the 3D view…",
    "ip.3d.cut": "Cut at the plan height",
    "ip.3d.whole": "whole model",
    "ip.3d.cutat": "cut at {h} m",
    "ip.3d.top": "Top",
    "ip.3d.front": "Front",
    "ip.3d.side": "Side",
    "ip.3d.iso": "Iso",
    "ip.3d.large": "This model is too large for the 3D view in this browser; the plans are unaffected.",
    "ip.3d.nogl": "3D is not available in this browser.",
    "ip.3d.stale": "Open the file again to see it in 3D.",
    "ip.3d.failed": "The 3D view could not be built; the plans are unaffected.",
    "ip.legend.note": "Hiding a layer changes only the preview; the DXF keeps every layer.",
    "ip.warnings": "Warnings",
    "ip.warn.none": "No warnings.",
    "ip.warn.nogeometry": "{n} elements had no geometry and are not drawn ({types}).",
    "ip.warn.far": "Coordinates are {km} km from the origin; consider “Move to origin”.",
    "ip.warn.cp1253": "{n} characters can't be written in Greek code page 1253 and become “?” in the DXFs.",
    "ip.warn.nostoreys": "The model has no storeys: everything goes into one plan, cut {h} m above zero.",
    "ip.warn.lowrooms": "{n} rooms don't reach the cut height: their label goes at their middle, without an outline.",
    "ip.warn.samelevel": "Several storeys sit at the same level ({levels}); their plans may be identical. Check the IFC's storey placements.",
    "ip.v1": "Not drawn in this version: door swings, stair treads below the cut, hidden lines, dimensions.",
    "ip.err.read": "This is not an IFC file the tool can read: it supports .ifc in STEP text.",
    "ip.err.read.ifczip": ".ifcZIP files are not supported: unzip it and drop the .ifc inside.",
    "ip.err.read.ifcxml": ".ifcXML files are not supported: export the model as .ifc (STEP text).",
    "ip.err.schema": "The IFC reader can't open the schema “{schema}”. Export the model as IFC2X3 or IFC4.",
    "ip.err.limit": "This file is over 150 MB, more than a browser tab handles reliably.",
    "ip.err.timeout": "The model wasn't read within 120 s. For large files, try a desktop browser.",
    "ip.err.engine": "The IFC reader stopped, probably out of memory. For large files, try a desktop browser.",
    "ip.err.empty": "The model has no elements with geometry to cut.",
    "ip.cta.title": "Plans on your office's standards?",
    "ip.cta.text": "We set them up on your own layers and blocks, with door swings, dimensions and batch conversion inside your CAD.",
    "ip.cta.link": "Contact us",
    "ip.survey.q": "How do you get floor plans from an IFC today?",
    "ip.survey.addon": "With an add-on in my CAD",
    "ip.survey.ask": "I ask the architect for DWGs",
    "ip.survey.other": "Another way",
    "ip.survey.thanks": "Thank you!",
    "ip.notice": "IFC reading: web-ifc (ThatOpen Company), MPL-2.0,",
    "ip.notice.link": "source on GitHub",
  },
  it: {
    "ip.back": "Home",
    "ip.eyebrow": "Strumento",
    "ip.title": "Piante DXF da IFC",
    "ip.lede": "Trascinate un modello IFC e ottenete una pianta DXF R12 per piano, tagliata all’altezza che scegliete: ogni tipo di elemento sul proprio layer, ogni locale con il suo nome e la sua superficie.",
    "ip.privacy": "Il vostro file resta sul vostro computer; nulla viene caricato.",
    "ip.indicative": "Piante tagliate dalla geometria del modello. Verificatele con i disegni dell’architetto.",
    "ip.cross": "Tutti gli strumenti →",
    "ip.aria.files": "File",
    "ip.open": "Apri file",
    "ip.example": "Carica esempio",
    "ip.clear": "Svuota",
    "ip.drop": "Trascinate qui un file IFC, oppure premete «Apri file».",
    "ip.settings": "Impostazioni",
    "ip.set.cut": "Altezza del taglio sopra la quota di ogni piano (m)",
    "ip.set.units": "Unità dei DXF",
    "ip.set.origin": "Sposta nell’origine",
    "ip.set.hint": "Le impostazioni restano in questo browser. Le unità e lo spostamento cambiano solo i DXF; lo spostamento è scritto come commento in ogni file.",
    "ip.unit.m": "metri (m)",
    "ip.unit.cm": "centimetri (cm)",
    "ip.unit.mm": "millimetri (mm)",
    "ip.processing": "Lettura del modello…",
    "ip.large": "File grande: la lettura potrebbe richiedere un po’ di tempo…",
    "ip.recutting": "Nuovo taglio a {h} m…",
    "ip.recut.time": "Nuovo taglio a {h} m in {s} s.",
    "ip.engine.nowasm": "Il vostro browser non supporta WebAssembly, necessario allo strumento. Provate una versione recente di Chrome, Edge, Firefox o Safari.",
    "ip.example.failed": "L’esempio non è stato caricato. Controllate la connessione e riprovate.",
    "ip.sum.storeys": "{n} piani",
    "ip.sum.products": "{n} elementi",
    "ip.sum.rooms": "{n} locali",
    "ip.sum.units": "DXF in {units}",
    "ip.sum.shift": "spostamento X {x} m, Y {y} m",
    "ip.storeys": "Piani",
    "ip.zip": "Scarica tutto (ZIP)",
    "ip.col.storey": "Piano",
    "ip.col.level": "Quota (m)",
    "ip.col.cut": "Elementi tagliati",
    "ip.col.nogeo": "⚠ Senza geometria",
    "ip.col.rooms": "Locali",
    "ip.col.dxf": "DXF",
    "ip.row.nothing": "niente a {h} m",
    "ip.row.dxf": "DXF",
    "ip.row.dxf.aria": "Scarica il DXF: {name}",
    "ip.storey.fallback": "Piano",
    "ip.preview": "Anteprima",
    "ip.fit": "Adatta",
    "ip.zoomin": "Ingrandisci",
    "ip.zoomout": "Riduci",
    "ip.aria.drawing": "Pianta del piano selezionato",
    "ip.legend": "Legenda",
    "ip.tip.layer": "Layer",
    "ip.tab.plan": "Pianta",
    "ip.tab.3d": "3D",
    "ip.aria.tabs": "Vista",
    "ip.aria.3d": "Vista 3D del modello, tagliata all’altezza della pianta",
    "ip.3d.loading": "Preparazione della vista 3D…",
    "ip.3d.cut": "Taglio all’altezza della pianta",
    "ip.3d.whole": "modello intero",
    "ip.3d.cutat": "taglio a {h} m",
    "ip.3d.top": "Pianta",
    "ip.3d.front": "Fronte",
    "ip.3d.side": "Lato",
    "ip.3d.iso": "Iso",
    "ip.3d.large": "Il modello è troppo grande per la vista 3D in questo browser; le piante non cambiano.",
    "ip.3d.nogl": "La vista 3D non è disponibile in questo browser.",
    "ip.3d.stale": "Riaprite il file per vederlo in 3D.",
    "ip.3d.failed": "Non è stato possibile creare la vista 3D; le piante non cambiano.",
    "ip.legend.note": "Nascondere un layer cambia solo l’anteprima; il DXF conserva tutti i layer.",
    "ip.warnings": "Avvisi",
    "ip.warn.none": "Nessun avviso.",
    "ip.warn.nogeometry": "{n} elementi non avevano geometria e non sono disegnati ({types}).",
    "ip.warn.far": "Le coordinate distano {km} km dall’origine; valutate «Sposta nell’origine».",
    "ip.warn.cp1253": "{n} caratteri non si possono scrivere nella code page greca 1253 e nei DXF diventano «?».",
    "ip.warn.nostoreys": "Il modello non ha piani: tutto va in un’unica pianta, tagliata {h} m sopra lo zero.",
    "ip.warn.lowrooms": "{n} locali non arrivano all’altezza del taglio: la loro etichetta va al centro, senza contorno.",
    "ip.warn.samelevel": "Più piani si trovano allo stesso livello ({levels}); le loro piante potrebbero essere identiche. Verificate la posizione dei piani nell’IFC.",
    "ip.v1": "Non disegnati in questa versione: aperture delle porte, gradini sotto il taglio, linee nascoste, quote.",
    "ip.err.read": "Non è un file IFC leggibile dallo strumento: è supportato .ifc in testo STEP.",
    "ip.err.read.ifczip": "I file .ifcZIP non sono supportati: decomprimetelo e trascinate il .ifc che contiene.",
    "ip.err.read.ifcxml": "I file .ifcXML non sono supportati: esportate il modello come .ifc (testo STEP).",
    "ip.err.schema": "Il lettore IFC non apre lo schema «{schema}». Esportate il modello come IFC2X3 o IFC4.",
    "ip.err.limit": "Il file supera i 150 MB, più di quanto una scheda del browser gestisca in modo affidabile.",
    "ip.err.timeout": "Il modello non è stato letto entro 120 s. Per file grandi, provate un browser su computer.",
    "ip.err.engine": "Il lettore IFC si è fermato, probabilmente per mancanza di memoria. Per file grandi, provate un browser su computer.",
    "ip.err.empty": "Il modello non ha elementi con geometria da tagliare.",
    "ip.cta.title": "Piante secondo gli standard del vostro studio?",
    "ip.cta.text": "Le impostiamo sui vostri layer e sui vostri blocchi, con aperture delle porte, quote e conversione in serie nel vostro CAD.",
    "ip.cta.link": "Contattateci",
    "ip.survey.q": "Come ottenete oggi le piante da un IFC?",
    "ip.survey.addon": "Con un plug-in nel mio CAD",
    "ip.survey.ask": "Chiedo i DWG all’architetto",
    "ip.survey.other": "In un altro modo",
    "ip.survey.thanks": "Grazie!",
    "ip.notice": "Lettura IFC: web-ifc (ThatOpen Company), MPL-2.0,",
    "ip.notice.link": "sorgente su GitHub",
  },
};
```

Run: `node _tests/extract.mjs $PLAN js/ifcplan/i18n-ifcplan.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 89`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add js/ifcplan/i18n-ifcplan.js _tests/ifcplan/i18n.test.js
git commit -F - <<'EOF'
IFC 3D view: the strings in Greek, English and Italian

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 8: The three.js view

**Files:**
- Create: `js/ifcplan/view3d.js`
- Test: `_tests/ifcplan/view3d.test.js` (the pure helpers; three.js imports in Node)

**Interfaces:**
- Consumes: three.js r186 (`js/vendor/three/`, unchanged, no `?v=`); `style3d` (Task 2); `forEachPolyline` (`chain.js`); `LAYER_COLORS` (`drawing.js`).
- Produces (`js/ifcplan/view3d.js`):
  - Pure:
    - `PRESETS` (`top`, `front`, `side`, `iso`);
    - `LIFT` (0.003 m);
    - `pickColor(i)` and `pickIndex(r, g, b)` (element i is colour i + 1; 0 is the background);
    - `cutSegments(storey, origin) → { LAYER: Float32Array }`.
  - DOM:
    - `hasWebGL2()`;
    - `createView3d(container, { onHover(index | null, clientX, clientY), onLost() })`, which prepends its canvas (`.ip-3d-canvas`) to `container` and returns:
      - `setMesh(mesh3d)`: one Lambert, flat-shaded mesh per layer, then a fit in Iso;
      - `setCut(z | null, storey)`: the clipping plane at world Z, and the storey's lines at the cut;
      - `setHidden(set)`, `clear()`, `preset(name)`, `fit()`, `zoomBy(f)`, `pickAt(sx, sy) → index | null`, `canvas`;
    - for the browser check: `cutZ`, `layers`, `lineLayers`, `geometries` (the renderer's), `screenOf(x, y, z)` (world metres to canvas CSS px) and `ink() → { n, sig }`.
  - Hover: one pick per animation frame, none while a button is held, no rooms picked. A tap picks on touch.

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/ifcplan/view3d.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, LIFT, pickColor, pickIndex, cutSegments, createView3d, hasWebGL2 } from '../../js/ifcplan/view3d.js';
import { polylineSet } from '../../js/ifcplan/chain.js';

test('the presets of 3D spec §2, Z up: Top, Front, Side and Iso (the default)', () => {
  assert.deepEqual(Object.keys(PRESETS), ['top', 'front', 'side', 'iso']);
  assert.ok(PRESETS.top[2] > 0.99 && PRESETS.front[1] < 0 && PRESETS.side[0] > 0);
  assert.equal(typeof createView3d, 'function');
  assert.equal(typeof hasWebGL2, 'function');
});

test('picking colours: element i is i + 1 in 24 bits, and 0 is the background', () => {
  for (const i of [0, 1, 254, 255, 256, 65535, 65536, 16777214]) assert.equal(pickIndex(...pickColor(i)), i);
  assert.deepEqual(pickColor(0), [1, 0, 0]);
  assert.deepEqual(pickColor(300), [45, 1, 0]);
  assert.equal(pickIndex(0, 0, 0), null);
});

test('the cut lines: each polyline as segments at the cut, relative to the origin; a closed one closes', () => {
  const set = polylineSet();
  set.add([100, 50, 104, 50, 104, 53, 100, 53], true);            // a closed rectangle: 4 segments
  set.add([100, 60, 102, 60, 102, 61], false);                    // an open polyline: 2 segments
  const door = polylineSet();
  door.add([101, 50, 101.9, 50], false);
  const storey = { cutZ: 1.1, layers: { IFC_WALL: set.pack(), IFC_DOOR: door.pack() } };
  const s = cutSegments(storey, [100, 50, -0.25]);
  assert.deepEqual(Object.keys(s), ['IFC_WALL', 'IFC_DOOR']);
  assert.ok(s.IFC_WALL instanceof Float32Array);
  assert.equal(s.IFC_WALL.length, 6 * 6);
  const z = Math.fround(1.1 + 0.25 + LIFT);
  assert.deepEqual([...s.IFC_WALL.subarray(0, 6)], [0, 3, z, 0, 0, z], 'the closing segment first: last point to first');
  assert.deepEqual([...s.IFC_WALL.subarray(6, 12)], [0, 0, z, 4, 0, z]);
  assert.deepEqual([...s.IFC_WALL.subarray(24, 30)], [0, 10, z, 2, 10, z], 'the open polyline does not close');
  assert.deepEqual([...s.IFC_DOOR].map(v => +v.toFixed(4)), [1, 0, +z.toFixed(4), 1.9, 0, +z.toFixed(4)]);
  assert.ok(LIFT > 0 && LIFT <= 0.005, 'just above the clipped faces');
});
```

Run: `node _tests/extract.mjs $PLAN _tests/ifcplan/view3d.test.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 89`, `ℹ fail 1`.

- [ ] **Step 2: Write the module**

<!-- file: js/ifcplan/view3d.js -->
```js
// IFC floor plans, the 3D view (3D spec §3.2, §4): self-hosted three.js (the milling viewer's copy, imported without
// a ?v= so the addons share its one instance), an orthographic camera with Z up, OrbitControls, the presets Top /
// Front / Side / Iso and Fit. One clipping plane at the selected storey's cut; that storey's plan lines drawn at the
// cut in the plan's colours; layers hidden by the legend; GPU picking for the tooltip. DOM and WebGL; the small pure
// helpers before createView3d are Node-tested. Loaded by the page only when the 3D tab is first opened.
import * as THREE from '../vendor/three/three.module.js';
import { OrbitControls } from '../vendor/three/addons/OrbitControls.js';
import { LineSegments2 } from '../vendor/three/addons/LineSegments2.js';
import { LineSegmentsGeometry } from '../vendor/three/addons/LineSegmentsGeometry.js';
import { LineMaterial } from '../vendor/three/addons/LineMaterial.js';
import { style3d } from './palette3d.js?v=20261103';
import { forEachPolyline } from './chain.js?v=20261103';
import { LAYER_COLORS } from './drawing.js?v=20261103';

// Camera directions (from the target towards the camera), Z up.
export const PRESETS = { top: [0, -1e-4, 1], front: [0, -1, 0], side: [1, 0, 0], iso: [1, -1, 0.8] };
export const LIFT = 0.003;                   // m: the cut lines sit this far above the cut, clear of the clipped faces
const BG = 0xffffff;
const OFF = 1e9;                             // the clipping plane's constant with the cut switched off

// GPU picking: element i is drawn in the colour i + 1 (24 bits), the background stays 0.
export const pickColor = i => { const n = i + 1; return [n & 255, (n >> 8) & 255, (n >> 16) & 255]; };
export const pickIndex = (r, g, b) => { const n = r + (g << 8) + (b << 16); return n ? n - 1 : null; };

// A storey's plan polylines (the worker's packed sets, IFC world metres) as line segments for LineSegments2: per layer,
// a Float32Array [x0, y0, z, x1, y1, z, …] relative to origin, at the storey's cut Z plus LIFT.
export function cutSegments(storey, origin) {
  const out = {};
  const z = storey.cutZ - origin[2] + LIFT;
  for (const [name, set] of Object.entries(storey.layers)) {
    let n = 0;
    forEachPolyline(set, (pts, closed) => { const k = pts.length / 2; if (k >= 2) n += closed ? k : k - 1; });
    if (!n) continue;
    const a = new Float32Array(6 * n);
    let j = 0;
    forEachPolyline(set, (pts, closed) => {
      const k = pts.length / 2;
      if (k < 2) return;
      for (let i = closed ? 0 : 1; i < k; i++) {
        const p = i === 0 ? k - 1 : i - 1;
        a[j++] = pts[2 * p] - origin[0]; a[j++] = pts[2 * p + 1] - origin[1]; a[j++] = z;
        a[j++] = pts[2 * i] - origin[0]; a[j++] = pts[2 * i + 1] - origin[1]; a[j++] = z;
      }
    });
    out[name] = a;
  }
  return out;
}

// Whether this browser gives a WebGL2 context (the 3D view needs one). The test context is released at once.
export function hasWebGL2() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return true;
  } catch (e) { return false; }
}

// The element index arrives as an integer attribute (three.js binds a Uint32Array with vertexAttribIPointer).
const PICK_VERTEX = `
attribute uint element;
varying vec3 vPick;
#include <common>
#include <clipping_planes_pars_vertex>
void main() {
  float n = float(element) + 1.0;
  vPick = vec3(mod(n, 256.0), mod(floor(n / 256.0), 256.0), floor(n / 65536.0)) / 255.0;
  #include <begin_vertex>
  #include <project_vertex>
  #include <clipping_planes_vertex>
}`;
const PICK_FRAGMENT = `
varying vec3 vPick;
#include <clipping_planes_pars_fragment>
void main() {
  #include <clipping_planes_fragment>
  gl_FragColor = vec4(vPick, 1.0);
}`;

// onHover(elementIndex | null, clientX, clientY): the element under a still mouse pointer, or under a tap.
// onLost(): the WebGL context was lost. Throws when WebGL is not available.
export function createView3d(container, { onHover = () => {}, onLost = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(BG, 1);
  renderer.localClippingEnabled = true;
  const canvas = renderer.domElement;
  canvas.className = 'ip-3d-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  container.prepend(canvas);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8f8b80, 2.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(0.45, -0.8, 1.3);
  scene.add(sun);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, canvas);
  controls.screenSpacePanning = true;
  controls.zoomToCursor = true;
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  const plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), OFF);   // keeps z ≤ constant (relative to origin)
  const pickMaterial = new THREE.ShaderMaterial({ vertexShader: PICK_VERTEX, fragmentShader: PICK_FRAGMENT, side: THREE.DoubleSide, clipping: true, clippingPlanes: [plane] });
  const meshes = new Map(), lines = new Map();
  let origin = [0, 0, 0], box = null, radius = 1, viewSize = 2, cutZ = null, hidden = new Set(), pickTarget = null, frame = 0;
  const pixel = new Uint8Array(4);

  // ---- rendering on demand ----
  function render() {
    frame = 0;
    if (!canvas.clientWidth || !canvas.clientHeight) return;
    renderer.render(scene, camera);
  }
  const requestRender = () => { if (!frame) frame = requestAnimationFrame(render); };
  controls.addEventListener('change', requestRender);
  canvas.addEventListener('webglcontextlost', () => onLost());

  // ---- sizing ----
  function applyFrustum() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1, aspect = w / h;
    camera.left = (-viewSize * aspect) / 2; camera.right = (viewSize * aspect) / 2;
    camera.top = viewSize / 2; camera.bottom = -viewSize / 2;
    controls.minZoom = 0.05; controls.maxZoom = 2000;
    camera.updateProjectionMatrix();
    for (const o of lines.values()) o.material.resolution.set(w, h);
  }
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    applyFrustum();
    requestRender();
  }
  new ResizeObserver(resize).observe(container);

  // ---- content ----
  function dispose(o) { scene.remove(o); o.geometry.dispose(); o.material.dispose(); }
  function clearLines() { for (const o of lines.values()) dispose(o); lines.clear(); }
  function clear() {
    for (const m of meshes.values()) dispose(m);
    meshes.clear();
    clearLines();
    if (pickTarget) { pickTarget.dispose(); pickTarget = null; }
    box = null; cutZ = null; plane.constant = OFF;
    requestRender();
  }

  // mesh: the worker's mesh3d (3D spec §3.1). One Mesh per layer, in the layer's 3D colour; fitted in Iso.
  function setMesh(mesh) {
    clear();
    origin = mesh.origin;
    box = new THREE.Box3();
    for (const [name, L] of Object.entries(mesh.layers)) {
      if (!L.index.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(L.position, 3));
      g.setAttribute('element', new THREE.BufferAttribute(L.element, 1));
      g.setIndex(new THREE.BufferAttribute(L.index, 1));
      g.computeBoundingBox();
      box.union(g.boundingBox);
      const st = style3d(name);
      const mat = new THREE.MeshLambertMaterial({ color: st.color, flatShading: true, side: THREE.DoubleSide, transparent: st.transparent, opacity: st.opacity, depthWrite: !st.transparent, clippingPlanes: [plane] });
      const m = new THREE.Mesh(g, mat);
      m.renderOrder = st.order;
      m.visible = !hidden.has(name);
      scene.add(m);
      meshes.set(name, m);
    }
    if (box.isEmpty()) box = null;
    fitView(new THREE.Vector3(...PRESETS.iso));
  }

  // The cut: z the clipping plane's world Z (the storey's cutZ), or null to show the whole model; storey the plan
  // whose lines are drawn at the cut.
  function setCut(z, storey) {
    cutZ = Number.isFinite(z) ? z : null;
    plane.constant = cutZ === null ? OFF : cutZ - origin[2];
    clearLines();
    if (cutZ !== null && storey && meshes.size) {
      const segs = cutSegments({ layers: storey.layers, cutZ }, origin);
      for (const [name, a] of Object.entries(segs)) {
        const g = new LineSegmentsGeometry();
        g.setPositions(a);
        const mat = new LineMaterial({ color: LAYER_COLORS[name] || LAYER_COLORS.IFC_OTHER, linewidth: 2 });
        mat.resolution.set(canvas.clientWidth || 1, canvas.clientHeight || 1);
        const o = new LineSegments2(g, mat);
        o.renderOrder = 3;
        o.visible = !hidden.has(name);
        scene.add(o);
        lines.set(name, o);
      }
    }
    requestRender();
  }

  function setHidden(set) {
    hidden = new Set(set);
    for (const [name, o] of [...meshes, ...lines]) o.visible = !hidden.has(name);
    requestRender();
  }

  // ---- camera ----
  function fitView(dirOverride) {
    if (!box) { requestRender(); return; }
    const centre = box.getCenter(new THREE.Vector3());
    radius = Math.max(0.5, box.getSize(new THREE.Vector3()).length() / 2);
    const dir = dirOverride ? dirOverride.clone() : camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-12) dir.set(...PRESETS.iso);
    dir.normalize();
    viewSize = radius * 2.1;
    controls.target.copy(centre);
    camera.position.copy(centre).addScaledVector(dir, radius * 4);
    camera.near = radius; camera.far = radius * 8;          // the depth range spans the model only
    camera.zoom = 1;
    applyFrustum();
    camera.lookAt(centre);
    controls.update();
    requestRender();
  }
  const preset = name => fitView(new THREE.Vector3(...(PRESETS[name] || PRESETS.iso)));
  function zoomBy(f) {
    camera.zoom = Math.min(controls.maxZoom, Math.max(controls.minZoom, camera.zoom * f));
    camera.updateProjectionMatrix();
    controls.update();
    requestRender();
  }
  function orbit(dAzimuth, dPolar) {
    const off = camera.position.clone().sub(controls.target);
    off.applyAxisAngle(new THREE.Vector3(0, 0, 1), dAzimuth);
    const right = off.clone().cross(new THREE.Vector3(0, 0, 1));
    if (right.lengthSq() > 1e-12) {
      const next = off.clone().applyAxisAngle(right.normalize(), dPolar);
      const polar = next.angleTo(new THREE.Vector3(0, 0, 1));
      if (polar > 0.01 && polar < Math.PI - 0.01) off.copy(next);
    }
    camera.position.copy(controls.target).add(off);
    camera.lookAt(controls.target);
    controls.update();
    requestRender();
  }

  // ---- picking: the element-index render of one pixel ----
  function pickAt(sx, sy) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!meshes.size || !w || !h || sx < 0 || sy < 0 || sx >= w || sy >= h) return null;
    if (!pickTarget) pickTarget = new THREE.WebGLRenderTarget(1, 1);
    const saved = [];
    for (const [name, m] of meshes) { saved.push([m, m.visible]); if (name === 'IFC_SPACE') m.visible = false; }   // rooms cover the walls
    for (const o of lines.values()) { saved.push([o, o.visible]); o.visible = false; }
    scene.overrideMaterial = pickMaterial;
    camera.setViewOffset(w, h, Math.floor(sx), Math.floor(sy), 1, 1);
    renderer.setRenderTarget(pickTarget);
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(pickTarget, 0, 0, 1, 1, pixel);
    renderer.setRenderTarget(null);
    renderer.setClearColor(BG, 1);
    camera.clearViewOffset();
    scene.overrideMaterial = null;
    for (const [o, v] of saved) o.visible = v;
    return pickIndex(pixel[0], pixel[1], pixel[2]);
  }

  // Hover: at most one pick per animation frame, at the latest pointer position, never while a button is held.
  let hover = null, hoverFrame = 0, down = null, pointers = 0;
  const local = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function stopHover() { if (hoverFrame) cancelAnimationFrame(hoverFrame); hoverFrame = 0; hover = null; }
  function doHover() {
    hoverFrame = 0;
    const q = hover;
    hover = null;
    if (q) onHover(pickAt(q.x, q.y), q.clientX, q.clientY);
  }
  canvas.addEventListener('pointerdown', e => { pointers++; down = pointers === 1 ? { x: e.clientX, y: e.clientY } : null; stopHover(); onHover(null, 0, 0); });
  canvas.addEventListener('pointerup', e => {
    pointers = Math.max(0, pointers - 1);
    if (down && e.pointerType === 'touch' && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 4) {
      const p = local(e);
      onHover(pickAt(p.x, p.y), e.clientX, e.clientY);         // no hover on touch: a tap picks
    }
    down = null;
  });
  canvas.addEventListener('pointercancel', () => { pointers = Math.max(0, pointers - 1); down = null; });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' || e.buttons || pointers) return;
    const p = local(e);
    hover = { x: p.x, y: p.y, clientX: e.clientX, clientY: e.clientY };
    if (!hoverFrame) hoverFrame = requestAnimationFrame(doHover);
  });
  canvas.addEventListener('pointerleave', () => { stopHover(); onHover(null, 0, 0); });
  canvas.addEventListener('keydown', e => {
    const step = Math.PI / 36;
    const keys = { '+': () => zoomBy(1.25), '=': () => zoomBy(1.25), '-': () => zoomBy(1 / 1.25), f: () => fitView(), F: () => fitView(),
      ArrowLeft: () => orbit(-step, 0), ArrowRight: () => orbit(step, 0), ArrowUp: () => orbit(0, -step), ArrowDown: () => orbit(0, step) };
    if (keys[e.key]) { e.preventDefault(); keys[e.key](); }
  });

  resize();
  return {
    setMesh, setCut, setHidden, clear, preset, fit: () => fitView(), zoomBy, pickAt, canvas,
    // For the browser check: the cut's world Z (null when off), the layers drawn, the geometries the renderer holds,
    // where a world point is on screen (CSS px in the canvas), and the drawn pixels that are not background.
    get cutZ() { return cutZ; },
    get layers() { return [...meshes.keys()].filter(n => meshes.get(n).visible); },
    get lineLayers() { return [...lines.keys()].filter(n => lines.get(n).visible); },
    get geometries() { return renderer.info.memory.geometries; },
    screenOf(x, y, z) {
      const v = new THREE.Vector3(x - origin[0], y - origin[1], z - origin[2]).project(camera);
      return { x: ((v.x + 1) / 2) * canvas.clientWidth, y: ((1 - v.y) / 2) * canvas.clientHeight };
    },
    ink() {
      render();
      const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, a = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a);
      let n = 0, sig = 0;
      for (let i = 0; i < a.length; i += 4) if (a[i] < 250 || a[i + 1] < 250 || a[i + 2] < 250) { n++; sig = (sig * 31 + a[i] + 7 * a[i + 1] + 13 * a[i + 2] + i) >>> 0; }
      return { n, sig };
    },
  };
}
```

Run: `node _tests/extract.mjs $PLAN js/ifcplan/view3d.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 92`, `ℹ fail 0`. The new module is covered by `site.test.js` too: three.js without a `?v=`, the others with the placeholder.

- [ ] **Step 3: Commit**

```bash
git add js/ifcplan/view3d.js _tests/ifcplan/view3d.test.js
git commit -F - <<'EOF'
IFC 3D view: the three.js view, with the cut, the cut lines and GPU picking

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 9: The page: tabs, toolbar, toggles, controller

**Files:**
- Modify: `ifc-plans.html`. In `.ip-view`:
  - the tab list;
  - the plan preview, moved into `#ipPlanView` (unchanged);
  - the new `#ip3dView` (heading, presets, Fit, the cut checkbox, `#ip3dBox` with its note and tooltip);
  - the legend note under the legend.
- Modify: `css/tools.css` (the legend toggles, and a `/* ---- ifc-plans.html: the 3D tab ---- */` section, appended at the end; only `.ip-*` and `#ip*` selectors)
- Modify: `js/ifcplan/ui.js` (the tabs, the lazy 3D, the cut wiring, the toggles, the notes, GA; `newFile` resets the tab, the toggles and the 3D scene)
- Test: `_tests/ifcplan/page3d.test.js`

**Interfaces:**
- Consumes: Tasks 2–8. `engine.process('mesh3d', new ArrayBuffer(0), { mesh3d: true, maxTriangles })` goes through the unchanged bridge.
- Produces (page):
  - `#ipTabs` (`role="tablist"`), `#ipTabPlan` and `#ipTab3d` (`role="tab"`), `#ipPlanView` and `#ip3dView` (`role="tabpanel"`);
  - in the 3D panel: `#ip3dHead`, `[data-preset]`, `#ip3dFit`, `#ip3dCut`, `#ip3dBox`, `#ip3dNote`, `#ip3dTip`;
  - the legend toggles `#ipLegend [data-layer]` (`aria-pressed`).
- Produces (test hooks):
  - `window.__ifcp.view3d` (the view);
  - `window.__ifcp.maxTriangles` (a number overrides the cap);
  - `window.__ifcp.timings.view3d` (ms from the tab click to the first frame).

- [ ] **Step 1: Write the failing test**

<!-- file: _tests/ifcplan/page3d.test.js -->
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout has CRLF

test('the page: the Plan | 3D tabs, the plan tab selected, the 3D panel hidden', () => {
  const page = read('../../ifc-plans.html');
  assert.ok(page.includes('<div class="ip-tabs" id="ipTabs" role="tablist" data-i18n-aria="ip.aria.tabs" aria-label="Προβολή">'));
  assert.ok(page.includes('<button type="button" class="ip-tab" role="tab" id="ipTabPlan" aria-selected="true" aria-controls="ipPlanView" data-i18n="ip.tab.plan">Κάτοψη</button>'));
  assert.ok(page.includes('<button type="button" class="ip-tab" role="tab" id="ipTab3d" aria-selected="false" aria-controls="ip3dView" tabindex="-1" data-i18n="ip.tab.3d">3D</button>'));
  assert.ok(page.includes('<div id="ipPlanView" role="tabpanel" aria-labelledby="ipTabPlan">'));
  assert.ok(page.includes('<div id="ip3dView" role="tabpanel" aria-labelledby="ipTab3d" hidden>'));
  const plan = page.slice(page.indexOf('id="ipPlanView"'), page.indexOf('id="ip3dView"'));
  assert.ok(plan.includes('id="ipCanvas"') && plan.includes('id="ipFit"'), 'the plan preview lives in the plan tab');
});

test('the 3D toolbar: Top, Front, Side, Iso, Fit and the cut checkbox (on); the legend note under the legend', () => {
  const page = read('../../ifc-plans.html');
  const three = page.slice(page.indexOf('id="ip3dView"'), page.indexOf('id="ipLegend"'));
  assert.deepEqual([...three.matchAll(/data-preset="(\w+)" data-i18n="ip\.3d\.(\w+)"/g)].map(m => m[1] === m[2] && m[1]), ['top', 'front', 'side', 'iso']);
  assert.ok(three.includes('id="ip3dFit" data-i18n="ip.fit"'));
  assert.ok(three.includes('<input type="checkbox" id="ip3dCut" checked /><span data-i18n="ip.3d.cut">'));
  assert.ok(three.includes('id="ip3dBox"') && three.includes('id="ip3dNote" role="status" hidden') && three.includes('id="ip3dTip" hidden'));
  const after = page.slice(page.indexOf('id="ipLegend"'));
  assert.ok(after.indexOf('data-i18n="ip.legend.note"') < after.indexOf('</div>'), 'the note follows the legend');
});

test('the controller: view3d.js on demand, the cap and the stale answer, the three GA events', () => {
  const ui = read('../../js/ifcplan/ui.js');
  assert.ok(ui.includes("import('./view3d.js?v=20261103')"), 'loaded with the first 3D tab');
  assert.ok(ui.includes("engine.process('mesh3d', new ArrayBuffer(0), { mesh3d: true, maxTriangles: cap })"));
  assert.ok(ui.includes("ga('ifcp_view3d', { result:") && ui.includes("ga('ifcp_3d_cut', { on: state.cut3d })") && ui.includes("ga('ifcp_layer_toggle', { layer: n })"));
  assert.ok(!/ga\('ifcp_layer_toggle'[^)]*name/.test(ui), 'a layer name, never a figure or a file name');
});

test('the styles: the tabs, the 3D box and the toggles, scoped to .ip-', () => {
  const css = read('../../css/tools.css');
  const start = css.indexOf('/* ---- ifc-plans.html: the 3D tab ---- */');
  assert.ok(start > 0);
  for (const rule of ['.ip-tabs {', '.ip-tab[aria-selected="true"]', '.ip-3d-box {', '.ip-3d-note[hidden] { display: none; }', '.ip-3d-canvas {']) assert.ok(css.includes(rule), rule);
  assert.ok(css.includes('.ip-toggle[aria-pressed="false"]'));
  const block = css.slice(start);
  for (const m of block.matchAll(/^([^@\s}][^{]*)\{/gm)) assert.ok(m[1].split(',').every(sel => /(^|\s)[.#]ip/.test(sel.trim())), m[1]);
});
```

Run: `node _tests/extract.mjs $PLAN _tests/ifcplan/page3d.test.js && node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 92`, `ℹ fail 4`.

- [ ] **Step 2: Write the page, the styles and the controller**

<!-- file: ifc-plans.html -->
```html
<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AidedCAM - Κατόψεις DXF από IFC</title>
  <meta name="description" content="Δωρεάν κατόψεις DXF από μοντέλα IFC: μία κάτοψη R12 ανά όροφο, κάθε τύπος στοιχείου σε δική του στρώση, οι χώροι με όνομα και εμβαδόν. Στον browser, χωρίς ανέβασμα, χωρίς εγγραφή." />
  <meta name="robots" content="index, follow" />
  <link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="icon-192.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png" />
  <meta name="theme-color" content="#f4f3ee" />
  <link rel="canonical" href="https://www.aidedcam.com/ifc-plans.html" />
  <meta property="og:title" content="AidedCAM - Κατόψεις DXF από IFC" />
  <meta property="og:description" content="Ρίξτε ένα IFC και πάρτε μία κάτοψη DXF ανά όροφο, με στρώσεις ανά τύπο στοιχείου και τους χώρους με όνομα και εμβαδόν." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://www.aidedcam.com/ifc-plans.html" />
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
  <link rel="stylesheet" href="css/tools.css?v=20261103" />
  <link rel="stylesheet" href="css/sidebar.css?v=20261002" />
  <script src="js/sidebar.js?v=20261002" defer></script>
</head>
<body>

  <nav class="navbar" id="navbar">
    <div class="nav-container">
      <a href="index.html" class="nav-logo">
        <img src="aided-cam-mark.png" alt="AidedCAM" width="30" height="34" />
        <img class="wordmark" src="aidedcam-wordmark.svg" alt="" width="716" height="67" />
      </a>
      <div class="nav-right">
        <a href="index.html" class="nav-back" data-i18n="ip.back">Αρχική</a>
        <div class="lang-switcher">
          <button class="lang-btn active" data-lang="el">EL</button>
          <button class="lang-btn" data-lang="en">EN</button>
          <button class="lang-btn" data-lang="it">IT</button>
        </div>
      </div>
    </div>
  </nav>

  <main class="gv ip">
    <header class="gv-head">
      <p class="gv-eyebrow" data-i18n="ip.eyebrow">Εργαλείο</p>
      <h1 data-i18n="ip.title">Κατόψεις DXF από IFC</h1>
      <p class="gv-lede" data-i18n="ip.lede">Ρίξτε ένα μοντέλο IFC και πάρτε μία κάτοψη R12 DXF ανά όροφο, κομμένη στο ύψος που ορίζετε: κάθε τύπος στοιχείου στη δική του στρώση, κάθε χώρος με το όνομα και το εμβαδόν του.</p>
      <p class="gv-privacy" data-i18n="ip.privacy">Το αρχείο μένει στον υπολογιστή σας· τίποτα δεν ανεβαίνει.</p>
      <p class="ip-indicative" data-i18n="ip.indicative">Κατόψεις κομμένες από τη γεωμετρία του μοντέλου. Ελέγξτε τες απέναντι στα σχέδια του αρχιτέκτονα.</p>
      <p class="gv-cross"><a href="free-tools.html" data-i18n="ip.cross">Όλα τα εργαλεία →</a></p>
    </header>

    <div class="gv-wrap">
      <noscript><p class="gv-banner">Το εργαλείο χρειάζεται JavaScript. / The tool needs JavaScript.</p></noscript>

      <section class="gv-bar ip-bar" data-i18n-aria="ip.aria.files" aria-label="Αρχείο">
        <label class="gv-btn gv-btn-primary gv-file-label">
          <input type="file" id="ipInput" accept=".ifc" class="gv-visually-hidden" />
          <span data-i18n="ip.open">Άνοιγμα αρχείου</span>
        </label>
        <button type="button" class="gv-btn" id="ipExample" data-i18n="ip.example">Φόρτωση παραδείγματος</button>
        <button type="button" class="gv-btn" id="ipClear" data-i18n="ip.clear" hidden>Καθαρισμός</button>
      </section>

      <section class="ip-settings" id="ipSettings">
        <h2 data-i18n="ip.settings">Ρυθμίσεις</h2>
        <div class="gv-settings-grid">
          <label><span data-i18n="ip.set.cut">Ύψος τομής πάνω από τη στάθμη κάθε ορόφου (m)</span><input type="text" inputmode="decimal" id="ipCut" value="1,10" /></label>
          <label><span data-i18n="ip.set.units">Μονάδες των DXF</span><select id="ipUnits"></select></label>
          <label class="ip-check"><input type="checkbox" id="ipOrigin" /><span data-i18n="ip.set.origin">Μετακίνηση στην αρχή των αξόνων</span></label>
        </div>
        <p class="gv-note" data-i18n="ip.set.hint">Οι ρυθμίσεις μένουν σε αυτόν τον browser. Οι μονάδες και η μετακίνηση αλλάζουν μόνο τα DXF· η μετατόπιση γράφεται σε σχόλιο μέσα σε κάθε αρχείο.</p>
      </section>

      <div class="gv-banner" id="ipBanner" role="status" hidden></div>
      <p class="gv-drop-hint" id="ipDropHint" data-i18n="ip.drop">Σύρετε εδώ ένα αρχείο IFC, ή πατήστε «Άνοιγμα αρχείου».</p>
      <p class="gv-note ip-busy" id="ipBusy" role="status" hidden></p>
      <div class="dq-error" id="ipError" role="alert" hidden></div>

      <section class="ip-panel" id="ipPanel" hidden>
        <div class="dq-status ip-status" id="ipStatus"></div>
        <p class="gv-note" id="ipRecutTime" hidden></p>

        <div class="ip-table-head">
          <h2 data-i18n="ip.storeys">Όροφοι</h2>
          <button type="button" class="gv-btn" id="ipZip" data-i18n="ip.zip">Λήψη όλων (ZIP)</button>
        </div>
        <div class="gv-table-wrap">
          <table class="gv-table ip-storeys" id="ipStoreys">
            <thead><tr><th data-i18n="ip.col.storey">Όροφος</th><th class="dq-num" data-i18n="ip.col.level">Στάθμη (m)</th><th class="dq-num" data-i18n="ip.col.cut">Στοιχεία στην τομή</th><th class="dq-num" data-i18n="ip.col.nogeo">⚠ Χωρίς γεωμετρία</th><th class="dq-num" data-i18n="ip.col.rooms">Χώροι</th><th data-i18n="ip.col.dxf">DXF</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>

        <div class="ip-view">
          <div class="ip-tabs" id="ipTabs" role="tablist" data-i18n-aria="ip.aria.tabs" aria-label="Προβολή">
            <button type="button" class="ip-tab" role="tab" id="ipTabPlan" aria-selected="true" aria-controls="ipPlanView" data-i18n="ip.tab.plan">Κάτοψη</button>
            <button type="button" class="ip-tab" role="tab" id="ipTab3d" aria-selected="false" aria-controls="ip3dView" tabindex="-1" data-i18n="ip.tab.3d">3D</button>
          </div>
          <div id="ipPlanView" role="tabpanel" aria-labelledby="ipTabPlan">
            <div class="gv-panel-head">
              <span><span data-i18n="ip.preview">Προεπισκόπηση</span> · <span id="ipPreviewName"></span></span>
              <span class="gv-tools-controls">
                <button type="button" class="gv-link" id="ipFit" data-i18n="ip.fit">Προσαρμογή</button>
                <button type="button" class="gv-zoom" id="ipZoomOut" data-i18n-aria="ip.zoomout" aria-label="Σμίκρυνση">−</button>
                <button type="button" class="gv-zoom" id="ipZoomIn" data-i18n-aria="ip.zoomin" aria-label="Μεγέθυνση">+</button>
              </span>
            </div>
            <div class="dq-canvas-box">
              <canvas class="dq-canvas ip-canvas" id="ipCanvas" role="img" data-i18n-aria="ip.aria.drawing" aria-label="Κάτοψη του επιλεγμένου ορόφου"></canvas>
              <div class="dq-tip" id="ipTip" hidden></div>
            </div>
          </div>
          <div id="ip3dView" role="tabpanel" aria-labelledby="ipTab3d" hidden>
            <div class="gv-panel-head ip-3d-head">
              <span id="ip3dHead">3D</span>
              <span class="gv-tools-controls">
                <button type="button" class="gv-link" data-preset="top" data-i18n="ip.3d.top">Κάτοψη</button>
                <button type="button" class="gv-link" data-preset="front" data-i18n="ip.3d.front">Πρόσοψη</button>
                <button type="button" class="gv-link" data-preset="side" data-i18n="ip.3d.side">Πλάγια</button>
                <button type="button" class="gv-link" data-preset="iso" data-i18n="ip.3d.iso">Αξονομετρικό</button>
                <button type="button" class="gv-link" id="ip3dFit" data-i18n="ip.fit">Προσαρμογή</button>
              </span>
            </div>
            <div class="ip-3d-bar">
              <label class="ip-3d-check"><input type="checkbox" id="ip3dCut" checked /><span data-i18n="ip.3d.cut">Τομή στο ύψος της κάτοψης</span></label>
            </div>
            <div class="ip-3d-box" id="ip3dBox">
              <p class="ip-3d-note" id="ip3dNote" role="status" hidden></p>
              <div class="dq-tip" id="ip3dTip" hidden></div>
            </div>
          </div>
          <ul class="ip-legend" id="ipLegend" data-i18n-aria="ip.legend" aria-label="Υπόμνημα"></ul>
          <p class="gv-note ip-legend-note" data-i18n="ip.legend.note">Η απόκρυψη στρώσης αλλάζει μόνο την προεπισκόπηση· το DXF κρατά όλες τις στρώσεις.</p>
        </div>

        <h2 class="ip-h" data-i18n="ip.warnings">Προειδοποιήσεις</h2>
        <ul class="gv-check-list ip-warnings" id="ipWarnings"></ul>
      </section>

      <p class="gv-note ip-v1" data-i18n="ip.v1">Δεν σχεδιάζονται σε αυτή την έκδοση: φορές ανοιγμάτων θυρών, σκαλοπάτια κάτω από την τομή, κρυμμένες γραμμές, διαστάσεις.</p>

      <section class="gv-cta">
        <h2 data-i18n="ip.cta.title">Κατόψεις στα πρότυπα του γραφείου σας;</h2>
        <p data-i18n="ip.cta.text">Τις στήνουμε στις δικές σας στρώσεις και τα δικά σας μπλοκ, με φορές ανοιγμάτων, διαστάσεις και μαζική μετατροπή μέσα στο CAD σας.</p>
        <a class="btn-primary" id="ipCta" href="index.html#contact" data-i18n="ip.cta.link">Επικοινωνήστε μαζί μας</a>
        <div class="gv-survey" id="ipSurvey">
          <p data-i18n="ip.survey.q">Πώς παίρνετε σήμερα κατόψεις από ένα IFC;</p>
          <button type="button" class="gv-chip" data-answer="addon" data-i18n="ip.survey.addon">Με πρόσθετο στο CAD μου</button>
          <button type="button" class="gv-chip" data-answer="ask" data-i18n="ip.survey.ask">Ζητάω DWG από τον αρχιτέκτονα</button>
          <button type="button" class="gv-chip" data-answer="other" data-i18n="ip.survey.other">Αλλιώς</button>
          <p class="gv-thanks" id="ipThanks" data-i18n="ip.survey.thanks" hidden>Ευχαριστούμε!</p>
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
    <p class="lc-notice"><span data-i18n="ip.notice">Ανάγνωση IFC: web-ifc (ThatOpen Company), MPL-2.0,</span> <a href="https://github.com/ThatOpen/engine_web-ifc" rel="noopener" data-i18n="ip.notice.link">ο κώδικας στο GitHub</a></p>
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

  <script src="js/ifcplan/i18n-ifcplan.js?v=20261103"></script>
  <script>
    var translations = {
      el: {
        "_title": "AidedCAM - Κατόψεις DXF από IFC",
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
        "_title": "AidedCAM - DXF floor plans from IFC",
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
        "_title": "AidedCAM - Piante DXF da IFC",
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
      translations[l] = Object.assign({}, (window.IP_I18N || {})[l] || {}, translations[l]);
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
  <script type="module" src="js/ifcplan/ui.js?v=20261103"></script>
</body>
</html>
```

<!-- file: css/tools.css -->
```css
/* Free-tool pages (the G-code viewer first). Builds on the css/editorial.css tokens. Spec §8. */
:root {
  --gv-feed: #0d7a3e;      /* = --accent */
  --gv-rapid: #b8741a;     /* amber, dashed */
  --gv-pass: #4a6f8f;      /* slate: passes the control generates */
  --gv-profile: #8a897f;   /* R5: lighter than --gv-feed (luminance 0.248 vs 0.144), still >=3:1 on white/paper */
  --gv-hi: #c2410c;        /* hover highlight */
  --gv-mono: ui-monospace, 'Cascadia Mono', Consolas, 'Courier New', monospace; /* program panel only */
  --gv-line-h: 20px;       /* must equal LINE_H in js/gcode/shell/program-panel.js */
}

/* Tool-page nav: back link + language switcher on one row (same as calculator.html's inline styles) */
:root {
  --ic-arrow-l: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M19 12H6M12 5l-7 7 7 7'/%3E%3C/svg%3E");
}
.nav-right { display: flex; align-items: center; gap: 1.25rem; }
.nav-back {
  display: inline-flex; align-items: center; gap: 0.4rem;
  color: var(--muted); text-decoration: none;
  font-family: var(--font-mono); font-weight: 400; font-size: 0.72rem;
  letter-spacing: 0.1em; text-transform: uppercase;
  transition: color 0.2s ease;
}
.nav-back:hover { color: var(--ink); }
.nav-back::before {
  content: ''; width: 1em; height: 1em; flex: none;
  background-color: currentColor;
  -webkit-mask: var(--ic-arrow-l) center / contain no-repeat;
          mask: var(--ic-arrow-l) center / contain no-repeat;
  transition: transform 0.25s ease;
}
.nav-back:hover::before { transform: translateX(-3px); }
@media (max-width: 768px) { .nav-back { display: none; } }

.gv { background: var(--paper); }
.gv [hidden] { display: none !important; }   /* a class display rule must never beat the hidden attribute */
.gv-head { text-align: center; padding: clamp(2.5rem, 6vw, 4.5rem) 16px clamp(1.5rem, 3vw, 2.5rem); border-bottom: 1px solid var(--line); }
.gv-eyebrow { font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); margin: 0 0 1rem; }
.gv-head h1 { font-family: var(--font-display); font-weight: 300; font-size: clamp(1.7rem, 3.6vw, 2.5rem); line-height: 1.1; letter-spacing: -0.02em; color: var(--ink); margin: 0 0 0.8rem; }
.gv-lede { max-width: 640px; margin: 0 auto 0.6rem; color: var(--ink-soft); font-size: 1.05rem; line-height: 1.6; }
.gv-privacy { color: var(--muted); font-size: 0.85rem; margin: 0; }
.gv-wrap { max-width: 1320px; margin: 0 auto; padding: 0 16px; }
@media (min-width: 720px) { .gv-wrap { padding: 0 clamp(1.25rem, 3vw, 2.5rem); } }

.gv-bar { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; padding: 1rem 0; }
.gv-btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.55rem 0.9rem; border: 1px solid var(--line-strong); background: var(--panel); color: var(--ink); font-family: var(--font-body); font-size: 0.9rem; font-weight: 500; border-radius: 2px; cursor: pointer; }
.gv-btn:hover { border-color: var(--accent-deep); color: var(--accent-deep); }
.gv-btn-primary { background: var(--ink); color: #fff; border-color: var(--ink); }
.gv-btn-primary:hover { background: var(--accent-deep); border-color: var(--accent-deep); color: #fff; }
/* Keyboard file open (item 2): the input stays in the layout and focusable, unlike display:none. */
.gv-visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; opacity: 0; }
.gv-file-label:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
.gv-settings { flex-basis: 100%; }
.gv-settings summary { cursor: pointer; color: var(--muted); font-size: 0.9rem; }
.gv-settings-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 0.6rem 1rem; padding: 0.8rem 0; }
.gv-settings-grid label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: var(--muted); }
.gv-settings-grid select, .gv-settings-grid input, .gv-settings-grid output { display: block; font-family: var(--font-body); font-size: 0.9rem; padding: 0.4rem 0.5rem; border: 1px solid var(--line-strong); background: var(--panel); color: var(--ink); border-radius: 2px; min-width: 0; }
.gv-banner { margin: 0 0 1rem; padding: 0.7rem 0.9rem; border: 1px solid var(--line-strong); background: var(--accent-soft); font-size: 0.9rem; }

.gv-main { display: grid; grid-template-columns: 1fr; gap: 1rem; padding: 0; }   /* editorial.css pads every <section> */
.gv-drawing { order: -1; }                                     /* phones: drawing first */
@media (min-width: 960px) {
  .gv-main { grid-template-columns: minmax(300px, 0.8fr) 1.6fr; }
  .gv-drawing { order: 0; }
}
.gv-program, .gv-drawing { background: var(--panel); border: 1px solid var(--line); min-width: 0; }
.gv-panel-head { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--line); font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.gv-link { background: none; border: 0; padding: 0; color: var(--accent-deep); cursor: pointer; font-family: var(--font-body); font-size: 0.85rem; font-weight: 500; letter-spacing: 0; text-transform: none; }

.gv-code, .gv-editor { height: min(62vh, 560px); overflow: auto; font-family: var(--gv-mono); font-size: 13px; line-height: var(--gv-line-h); }
.gv-code { position: relative; }
.gv-code:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.gv-code-spacer { position: relative; }
.gv-code-window { position: absolute; left: 0; right: 0; top: 0; will-change: transform; }
.gv-line { display: flex; height: var(--gv-line-h); white-space: pre; }
.gv-line:hover, .gv-line.is-hi { background: var(--accent-soft); }
.gv-line.has-warn .gv-no { color: var(--gv-rapid); font-weight: 700; }
.gv-no { flex: 0 0 3.5em; text-align: right; padding-right: 0.8em; color: var(--faint); user-select: none; }
.gv-tx { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--ink); }
.gv-editor { display: block; width: 100%; border: 0; padding: 0 0.75rem; resize: vertical; background: var(--panel); color: var(--ink); box-sizing: border-box; }
.gv-drop-hint { padding: 1.5rem 1rem; text-align: center; color: var(--muted); font-size: 0.9rem; }
.gv-dragging .gv-program, .gv-dragging .gv-drawing { outline: 2px dashed var(--accent); outline-offset: -4px; }

.gv-tools { display: flex; flex-wrap: wrap; gap: 0.4rem 0.9rem; align-items: center; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--line); font-size: 0.82rem; }
.gv-check { display: inline-flex; align-items: center; gap: 0.35rem; color: var(--ink-soft); }
.gv-swatch { display: inline-block; width: 18px; height: 0; border-top: 2px solid; }
.gv-swatch.feed { border-color: var(--gv-feed); }
.gv-swatch.rapid { border-color: var(--gv-rapid); border-top-style: dashed; }
.gv-swatch.pass { border-color: var(--gv-pass); }
.gv-swatch.profile { border-color: var(--gv-profile); border-top-width: 4px; }   /* R5: solid, matches the drawn stroke */
.gv-svg { display: block; width: 100%; height: min(62vh, 560px); background: var(--panel); touch-action: none; cursor: crosshair; }
.gv-svg:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
@media (max-width: 720px) {
  /* The drawing must not trap the whole page's scroll on phones (item 3). */
  .gv-svg { height: min(50vh, 380px); }
}
.gv-zoom {
  display: inline-flex; align-items: center; justify-content: center;
  width: 1.7rem; height: 1.7rem; padding: 0; line-height: 1;
  border: 1px solid var(--line-strong); background: var(--panel); color: var(--ink);
  font-family: var(--font-body); font-size: 1rem; border-radius: 2px; cursor: pointer;
}
.gv-zoom:hover { border-color: var(--accent-deep); color: var(--accent-deep); }
.gv-zoom:focus-visible, .gv-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.gv-path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.gv-feed { stroke: var(--gv-feed); stroke-width: 1.6; }
.gv-rapid { stroke: var(--gv-rapid); stroke-width: 1.1; stroke-dasharray: 5 4; }
.gv-pass { stroke: var(--gv-pass); stroke-width: 1.1; }
.gv-profile { stroke: var(--gv-profile); stroke-width: 4; }         /* solid: opacity blended it below 3:1 (item 18) */
.gv-hi { stroke: var(--gv-hi); stroke-width: 3; }
.gv-marker path { stroke: var(--gv-hi); stroke-width: 1.6; stroke-linecap: round; }
.gv-axis { stroke: var(--line-strong); stroke-width: 1; stroke-dasharray: 10 4 2 4; }
.gv-tick { stroke: var(--line-strong); stroke-width: 1; }
.gv-tick-label { fill: var(--ink-soft); font-family: var(--font-mono); }
.gv-start { fill: var(--ink); }
.gv-label { fill: var(--ink-soft); font-family: var(--font-mono); }
.gv-readout { margin: 0; padding: 0.4rem 0.75rem; border-top: 1px solid var(--line); font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 12px; color: var(--muted); min-height: 1.6em; }

.gv-results { display: grid; grid-template-columns: 1fr; gap: 1.5rem; padding: 2rem 0; }
.gv-time, .gv-checks { min-width: 0; }   /* let the table scroll inside its box on phones */
@media (min-width: 960px) { .gv-results { grid-template-columns: 1.4fr 1fr; } }
.gv-results h2, .gv-cta h2 { font-family: var(--font-display); font-weight: 400; font-size: 1.35rem; margin: 0 0 0.4rem; color: var(--ink); }
.gv-note { color: var(--muted); font-size: 0.85rem; line-height: 1.5; margin: 0.4rem 0; }
.gv-table-wrap { overflow-x: auto; }
.gv-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; font-variant-numeric: tabular-nums; }
.gv-table th, .gv-table td { text-align: left; padding: 0.45rem 0.5rem; border-bottom: 1px solid var(--line); white-space: nowrap; }
.gv-table th { font-weight: 500; color: var(--muted); font-size: 0.78rem; }
.gv-table tfoot td { font-weight: 600; border-bottom: 0; }
.gv-check-list { list-style: none; margin: 0; padding: 0; }
.gv-w { display: flex; gap: 0.6rem; align-items: baseline; padding: 0.45rem 0; border-bottom: 1px solid var(--line); font-size: 0.9rem; }
.gv-w::before { content: ''; flex: 0 0 8px; height: 8px; border-radius: 50%; background: var(--faint); }
.gv-w.is-warn::before { background: var(--gv-rapid); }
.gv-w.is-error::before { background: var(--gv-hi); }
.gv-w.is-ok::before { background: var(--gv-feed); }
.gv-w-line { background: none; border: 0; padding: 0; color: var(--accent-deep); cursor: pointer; font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 0.82rem; white-space: nowrap; }

.gv-cta { border-top: 1px solid var(--line); padding: 2rem 0 3rem; }
.gv-cta p { max-width: 640px; color: var(--ink-soft); line-height: 1.6; }
.gv-survey { margin-top: 1.5rem; display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.gv-survey p { margin: 0 0.5rem 0 0; color: var(--muted); font-size: 0.9rem; }
.gv-chip { border: 1px solid var(--line-strong); background: var(--panel); border-radius: 999px; padding: 0.35rem 0.85rem; font-family: var(--font-body); font-size: 0.85rem; cursor: pointer; color: var(--ink); }
.gv-chip:hover { border-color: var(--accent-deep); color: var(--accent-deep); }
.gv-thanks { margin: 0; color: var(--accent-deep); font-size: 0.9rem; }

.gv-footer { padding: 2rem 16px; border-top: 1px solid var(--line); display: flex; flex-direction: column; align-items: center; gap: 0.8rem; }
.gv-footer img { display: block; height: 12px; width: auto; }
.gv-footer-legal { display: flex; flex-wrap: wrap; justify-content: center; gap: 1.5rem; }
.gv-footer-legal a { font-size: 0.8rem; color: var(--muted); text-decoration: none; }
.gv-footer-legal a:hover { color: var(--accent-deep); }

.gv-print-head, .gv-print-foot { display: none; }
@media print {
  @page { size: A4; margin: 14mm; }
  body, .gv { background: #fff !important; }
  .navbar, .gv-head, .gv-bar, .gv-banner, .gv-program, .gv-readout, .gv-cta, .gv-footer, .consent-banner { display: none !important; }
  /* Print keeps the layer legend (swatches + names), without the Fit/zoom/1:1 controls or the
     checkboxes themselves (item 8). */
  .gv-tools-controls, .gv-tools input[type="checkbox"] { display: none !important; }
  .gv-print-head { display: flex !important; justify-content: space-between; align-items: center; gap: 12px; border-bottom: 2px solid var(--primary-light); padding-bottom: 8px; margin-bottom: 12px; font-size: 11px; color: #444; }
  .gv-print-head img { height: 16px; width: auto; }
  .gv-print-foot { display: block !important; margin-top: 12px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 10px; color: #777; text-align: center; }
  .gv-main { display: block; }
  .gv-drawing { border: 1px solid #ccc; break-inside: avoid; }
  .gv-svg { height: 95mm; }
  .gv-results { display: block; padding: 0; }
  .gv-time, .gv-checks { break-inside: avoid; margin-top: 10px; }
  .gv-table-wrap { overflow: visible; }
  .gv-hi { display: none !important; }   /* R13: a hover or pin never prints in the highlight colour */
}

/* ---- milling viewer (milling-gcode-viewer.html) ---- */
.gv-cross { margin: 0.4rem 0 0; font-size: 0.85rem; }
.gv-tools-controls .gv-link + .gv-link { margin-left: 0.55rem; }   /* Fit Top Front Right Iso */
.gv-cross a { color: var(--accent-deep); }
.gv-banner-action { margin-left: 0.4rem; }
.gv-3d { position: relative; width: 100%; height: min(62vh, 560px); background: var(--panel); touch-action: none; }
.gv-3d-canvas { display: block; cursor: crosshair; }
.gv-3d-canvas:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
@media (max-width: 720px) { .gv-3d { height: min(50vh, 380px); } }
.gv-swatch.hi { border-color: var(--gv-hi); border-top-width: 3px; }
.gv-play { display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.75rem; border-top: 1px solid var(--line); }
.gv-play input[type="range"] { flex: 1; min-width: 0; accent-color: var(--accent); }
.gv-play-pos { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.gv-dims, .gv-offsets { margin: 0; padding: 0.3rem 0.75rem 0.5rem; font-size: 12px; }
.gv-offsets { display: flex; flex-wrap: wrap; gap: 0.3rem 0.8rem; }
.gv-offsets[hidden] { display: none; }
.gv-offset { display: inline-flex; align-items: center; gap: 0.3rem; }
.gv-offset .gv-swatch { border-top: 0; height: 10px; width: 10px; }
.gv-table-rows tbody tr { cursor: pointer; }
.gv-table-rows tbody tr:hover td { background: var(--accent-soft); }
.gv-table-rows tbody tr.is-iso td { background: var(--accent-soft); font-weight: 600; }
.gv-table-rows tbody tr:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.gv-print-shot { display: none; }
@media print {
  .gv-3d, .gv-play { display: none !important; }
  .gv-print-shot { display: block !important; width: 100%; max-height: 110mm; object-fit: contain; }
}

/* ---- free-tools.html: one card per tool ---- */
/* Tools grouped by who they are for: the wide group spans both columns, single-card groups share a row. */
.ft-groups { display: grid; grid-template-columns: 1fr; gap: 2rem 1.25rem; padding: 2rem 0 1rem; }
.ft-group { display: flex; flex-direction: column; min-width: 0; }
.ft-group-title { margin: 0 0 0.75rem; font-weight: 400; }
.ft-cards { display: grid; grid-template-columns: 1fr; gap: 1.25rem; flex: 1; }
@media (min-width: 720px) {
  .ft-groups { grid-template-columns: 1fr 1fr; }
  .ft-group.is-wide { grid-column: 1 / -1; }
  .ft-group.is-wide .ft-cards { grid-template-columns: 1fr 1fr; }
}
.ft-card { display: block; padding: 1.5rem; background: var(--panel); border: 1px solid var(--line); color: var(--ink); text-decoration: none; transition: border-color 0.2s ease; }
.ft-card:hover { border-color: var(--accent); }
.ft-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ft-card h2, .ft-card h3 { margin: 0 0 0.5rem; font-family: var(--font-display); font-weight: 300; font-size: 1.5rem; }
.ft-card p { margin: 0 0 1rem; color: var(--ink-soft); }
.ft-open { color: var(--accent-deep); font-weight: 500; }

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

/* ---- coverage-precheck.html: the coverage diagram pre-check (spec §6) ---- */
.cp-indicative { display: inline-block; margin: 0.6rem 0 0; padding: 0.2rem 0.7rem; border: 1px solid var(--gv-rapid); border-radius: 999px; color: var(--ink-soft); font-size: 0.82rem; }
.cp-template-link { margin-left: 0.3rem; }
.cp-template-names { margin: 0 0 1rem; }
.cp-names { list-style: none; margin: 0; padding: 0; columns: 2 16rem; column-gap: 1.5rem; font-size: 0.85rem; color: var(--ink-soft); }
.cp-names li { padding: 0.15rem 0; break-inside: avoid; }
.cp-names code { font-family: var(--gv-mono); font-size: 0.8rem; color: var(--ink); }
.cp-busy { font-style: italic; }
.cp-panel { padding: 0; }
.cp-status .cp-file { font-weight: 600; color: var(--ink); }
.cp-step, .cp-results { padding: 1.25rem 0; border-top: 1px solid var(--line); }   /* editorial.css pads every <section> */
.cp-step h2, .cp-results h2 { font-family: var(--font-display); font-weight: 400; font-size: 1.35rem; margin: 0 0 0.3rem; color: var(--ink); }
.cp-results h3 { margin: 1.5rem 0 0.5rem; font-family: var(--font-mono); font-weight: 400; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.cp-map select, .cp-terms select { font: inherit; font-size: 0.85rem; padding: 0.2rem 0.3rem; border: 1px solid var(--line-strong); background: var(--panel); color: var(--ink); max-width: 16rem; }
.cp-swatch { display: inline-block; width: 10px; height: 10px; margin-right: 0.45rem; border-radius: 2px; vertical-align: middle; }
.cp-other { margin-top: 0.6rem; font-size: 0.85rem; color: var(--muted); }
.cp-other summary { cursor: pointer; }
.cp-terms input[aria-invalid="true"] { border-color: var(--gv-hi); }
.cp-hint { color: var(--faint); font-size: 0.75rem; line-height: 1.35; }
.cp-terms .cp-check { flex-direction: row; align-items: center; gap: 0.5rem; }
.cp-results-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.5rem; }
.cp-export { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.cp-table-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
.cp-table-head .gv-link:disabled { color: var(--faint); cursor: default; }                   /* until the union is back */
.cp-summary .cp-block th { padding-top: 0.9rem; color: var(--ink); font-weight: 600; font-size: 0.82rem; background: var(--paper-2, transparent); }
.cp-summary .cp-fig { white-space: normal; min-width: 12rem; }
.cp-row-note { display: block; color: var(--muted); font-size: 0.75rem; white-space: normal; }
.cp-mark { font-weight: 700; text-align: center !important; }
.cp-mark.is-ok { color: var(--gv-feed); }
.cp-mark.is-over { color: var(--gv-hi); }
.cp-art summary { cursor: pointer; color: var(--accent-deep); font-size: 0.78rem; list-style: none; }
.cp-art summary::-webkit-details-marker { display: none; }
.cp-art[open] summary { font-weight: 600; }
.cp-art-text { display: block; max-width: 22rem; white-space: normal; font-size: 0.78rem; color: var(--ink-soft); line-height: 1.45; }
.cp-linked { cursor: pointer; }
.cp-linked:hover td, .cp-linked:focus td { background: var(--accent-soft); }
.cp-linked.is-hi td { background: var(--accent-soft); font-weight: 600; }
.cp-linked:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.cp-view { margin: 1.25rem 0 0.5rem; border: 1px solid var(--line); background: var(--panel); min-width: 0; }
.cp-legend { display: flex; flex-wrap: wrap; gap: 0.3rem 1rem; list-style: none; margin: 0; padding: 0.45rem 0.75rem; border-top: 1px solid var(--line); font-size: 0.8rem; color: var(--ink-soft); }
.cp-schedule .cp-sch-head td { padding-top: 0.9rem; font-weight: 600; color: var(--ink); }
.cp-schedule .cp-sch-domisi td, .cp-schedule .cp-sch-total td, .cp-schedule .cp-sch-sum td { font-weight: 600; border-bottom-color: var(--line-strong); }
.cp-schedule .cp-sch-space td:first-child, .cp-schedule .cp-sch-gross td:first-child { padding-left: 1.2rem; }
.cp-schedule .cp-sch-cap td:first-child { padding-left: 2.2rem; color: var(--muted); font-size: 0.8rem; }
.cp-note { color: var(--muted); font-size: 0.8rem; white-space: normal !important; min-width: 10rem; }
.cp-coords { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; }
@media (min-width: 900px) { .cp-coords { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
.cp-coord caption { text-align: left; padding: 0 0 0.3rem; font-size: 0.85rem; font-weight: 500; color: var(--ink); }
.cp-warnings { margin: 0 0 1rem; }
.cp-warnings .gv-w-line { margin-left: auto; }
.cp-disclaimer { margin: 1rem 0 0; padding: 0.6rem 0.8rem; border-left: 2px solid var(--gv-rapid); background: var(--accent-soft); font-size: 0.85rem; color: var(--ink-soft); }
.cp-print-disclaimer { display: none; }
@media print {
  .cp-bar, .cp-template-names, .cp-busy, .cp-status select, .cp-status label, .cp-step, .cp-export, .cp-table-head .gv-link, .gv-tools-controls, .cp-warnings .gv-w-line { display: none !important; }
  .cp-results { border-top: 0; padding-top: 0; }
  .cp-art summary { color: #444; }
  .cp-art-text { display: none; }
  .cp-view { break-inside: avoid; border: 1px solid #ccc; }
  .cp-canvas { height: 110mm !important; }
  .cp-summary, .cp-coord { break-inside: avoid; }
  .cp-coords { grid-template-columns: 1fr 1fr; }
  .cp-disclaimer { display: none; }
  .cp-print-disclaimer { display: block !important; position: fixed; bottom: 0; left: 0; right: 0; margin: 0; padding: 2mm 0; background: #fff; border-top: 1px solid #ccc; font-size: 9px; color: #555; text-align: center; }
  .cp .gv-wrap { padding-bottom: 12mm; }
}

/* ---- ifc-plans.html: DXF floor plans from IFC (spec §6) ---- */
.ip-indicative { display: inline-block; margin: 0.6rem 0 0; padding: 0.2rem 0.7rem; border: 1px solid var(--gv-rapid); border-radius: 999px; color: var(--ink-soft); font-size: 0.82rem; }
.ip-settings { padding: 0.25rem 0 0.5rem; }   /* editorial.css pads every <section> */
.ip-settings h2, .ip-panel h2 { margin: 0.5rem 0 0; font-family: var(--font-mono); font-weight: 400; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.ip-settings input[aria-invalid="true"] { border-color: var(--gv-hi); }
.ip-settings .ip-check { flex-direction: row; align-items: center; gap: 0.5rem; align-self: end; padding-bottom: 0.45rem; color: var(--ink-soft); font-size: 0.85rem; }
.ip-busy { font-style: italic; }
.ip-panel { padding: 0; }
.ip-status .ip-file { font-weight: 600; color: var(--ink); }
.ip-table-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.5rem; margin: 1rem 0 0.5rem; }
.ip-storeys tbody tr { cursor: pointer; }
.ip-storeys tbody tr:hover td, .ip-storeys tbody tr.is-sel td { background: var(--accent-soft); }
.ip-storeys tbody tr.is-sel td:first-child { font-weight: 600; }
.ip-storeys tbody tr:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.ip-storeys .ip-empty { color: var(--muted); font-style: italic; }
.ip-storeys .ip-warn { color: var(--gv-rapid); font-weight: 600; }
.ip-storeys .gv-btn { padding: 0.25rem 0.6rem; font-size: 0.8rem; }
.ip-view { margin: 1.25rem 0 0.5rem; border: 1px solid var(--line); background: var(--panel); min-width: 0; }
.ip-legend { display: flex; flex-wrap: wrap; gap: 0.3rem 1rem; list-style: none; margin: 0; padding: 0.45rem 0.75rem; border-top: 1px solid var(--line); font-size: 0.8rem; color: var(--ink-soft); }
.ip-swatch { display: inline-block; width: 18px; height: 0; margin-right: 0.4rem; border-top: 2px solid; vertical-align: middle; }
.ip-panel .ip-h { margin-top: 1.5rem; }
.ip-warnings { margin: 0.3rem 0 1rem; }
.ip-v1 { margin: 1rem 0; }
.ip-legend li { display: flex; }
.ip-toggle { display: inline-flex; align-items: center; padding: 0.1rem 0.3rem; margin: 0 -0.3rem; border: 1px solid transparent; border-radius: 2px; background: none; color: inherit; font: inherit; cursor: pointer; }
.ip-toggle:hover { border-color: var(--line-strong); }
.ip-toggle[aria-pressed="false"] { color: var(--muted); text-decoration: line-through; }
.ip-toggle[aria-pressed="false"] .ip-swatch { opacity: 0.35; }
.ip-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.ip-legend-note { margin: 0; padding: 0 0.75rem 0.5rem; }

/* ---- ifc-plans.html: the 3D tab ---- */
.ip-tabs { display: flex; border-bottom: 1px solid var(--line); }
.ip-tab { margin-bottom: -1px; padding: 0.55rem 1rem; border: 0; border-bottom: 2px solid transparent; background: none; color: var(--muted); font-family: var(--font-body); font-size: 0.9rem; font-weight: 500; cursor: pointer; }
.ip-tab:hover { color: var(--ink); }
.ip-tab[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--accent); }
.ip-tab:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.ip-3d-head { flex-wrap: wrap; }
.ip-3d-bar { padding: 0.4rem 0.75rem; border-bottom: 1px solid var(--line); color: var(--ink-soft); font-size: 0.85rem; }
.ip-3d-check { display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; }
.ip-3d-box { position: relative; width: 100%; height: min(62vh, 520px); overflow: hidden; background: var(--panel); }
@media (max-width: 720px) { .ip-3d-box { height: min(50vh, 360px); } }
.ip-3d-canvas { display: block; cursor: crosshair; touch-action: none; }
.ip-3d-canvas:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.ip-3d-note { position: absolute; inset: 0; z-index: 1; display: flex; align-items: center; justify-content: center; margin: 0; padding: 1rem; background: var(--panel); color: var(--muted); font-size: 0.9rem; text-align: center; }
.ip-3d-note[hidden] { display: none; }
@media print { .ip-tabs, #ip3dView, .ip-legend-note { display: none !important; } #ipPlanView { display: block !important; } }
```

<!-- file: js/ifcplan/ui.js -->
```js
// IFC floor plans: the page controller (spec §6; 3D spec §3.2, §4). One file at a time goes to the web-ifc worker
// through the shared bridge; the page keeps its answer (every storey's plan in metres) and writes the DXFs from it on
// download, so the units and the move to origin need no new cut. A changed cut height re-cuts the open model in the
// worker. The 3D tab loads three.js and asks the worker for the model's triangles only when it is first opened; the
// storey, the cut height and the legend's layer toggles drive both views.
import { t, ga, lang } from '../gcode/shell/i18n.js';
import { lsGet, lsSet } from '../gcode/shell/settings-store.js';
import { renderBanner } from '../gcode/shell/banner.js';
import { createEngine } from '../laser/bridge.js?v=20261001';
import { zipStore, uniqueNames } from '../laser/zip.js?v=20261001';
import { storeyDxf, originShift, UNITS } from './dxf.js?v=20261103';
import { storeyFileNames, zipName, stem } from './names.js?v=20261103';
import { MAX_BYTES, LARGE_BYTES } from './model.js?v=20261103';
import { cleanSettings, parseCut, showM, sizeBucket, storeysBucket, warningsOf, SETTINGS_KEY, triangleCap, tipParts } from './state.js?v=20261103';
import { createDrawing, LAYER_COLORS, LEGEND_ORDER } from './drawing.js?v=20261103';

const $ = id => document.getElementById(id);
const SURVEY_KEY = 'aidedcam-ifcp-survey';
const EXAMPLE = 'example-house.ifc';
const TIMEOUT_MS = 120000;                 // spec §7

const state = {
  file: null,            // { name, bytes, source, result, error, gen, three }
  settings: cleanSettings(safeJson(lsGet(SETTINGS_KEY))),
  selected: 0,
  banner: null,
  busy: null,            // { key, params }
  recutMs: null,
  tab: 'plan',           // 'plan' | '3d': the plan for every new file
  hidden: new Set(),     // layers the legend switched off, in both views; all on for every new file
  cut3d: true,           // "Cut at the plan height"
};
let latest = 0;          // the newest file choice; a slower, earlier read must not replace it
let view3d = null;       // the 3D view, made on the first 3D tab; kept for later files
let view3dModule = null; // the import of view3d.js (and three.js), once
// Read by the browser check: file, example, re-cut and 3D times (ms), the views; maxTriangles overrides the cap.
window.__ifcp = { timings: {}, view3d: null, maxTriangles: undefined };
const mark = (name, t0) => { window.__ifcp.timings[name] = Math.round(performance.now() - t0); };

function safeJson(s) { try { return JSON.parse(s || '{}'); } catch (e) { return {}; } }
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const ok = f => f && f.result && f.result.type === 'result';
const m2 = v => showM(v, lang());
function saveSettings() { lsSet(SETTINGS_KEY, JSON.stringify(state.settings)); }
function showBanner(b) { state.banner = b; renderBanner($('ipBanner'), b, t); }
function busy(b) { state.busy = b; $('ipBusy').hidden = !b; $('ipBusy').textContent = b ? t(b.key, b.params) : ''; }

// ---- the engine: web-ifc in its worker, loaded with the first file ----
const supported = typeof WebAssembly === 'object' && typeof Worker === 'function';
const engine = supported ? createEngine({
  makeWorker: () => new Worker(new URL('./worker.js?v=20261103', import.meta.url), { type: 'module' }),
  timeoutMs: TIMEOUT_MS,
}) : null;
if (!supported) showBanner({ key: 'ip.engine.nowasm' });

async function run(f, settings) {
  return engine ? engine.process(f.name, f.bytes.slice(0), settings) : { type: 'error', reason: 'engine' };
}

// A new file (or none): the plan tab, every layer on, and the last file's 3D scene disposed.
function newFile(f) {
  state.file = f; state.selected = 0; state.recutMs = null;
  state.tab = 'plan';
  state.hidden = new Set();
  drawing.setHidden(state.hidden);
  if (view3d) { view3d.clear(); view3d.setHidden(state.hidden); }
  $('ip3dTip').hidden = true;
}

async function loadFile(name, bytes, source, t0 = performance.now()) {
  const f = { name, bytes, source, result: null, gen: 0, three: null };
  newFile(f);
  if (bytes.byteLength > MAX_BYTES) { f.result = { type: 'error', reason: 'limit' }; busy(null); fail(f); render(); return; }
  busy({ key: bytes.byteLength > LARGE_BYTES ? 'ip.large' : 'ip.processing' });
  render();
  const m = await run(f, { cutM: state.settings.cutM });
  if (state.file !== f) return;                                   // replaced meanwhile
  busy(null);
  f.result = m;
  if (m.type !== 'result') { fail(f); render(); return; }
  f.cutM = m.cutM;
  if (state.banner && state.banner.key === 'ip.example.failed') showBanner(null);
  render();
  mark(source === 'example' ? 'example' : 'file', t0);
  if (source === 'example') ga('ifcp_example_loaded', {});
  else ga('ifcp_file_loaded', { schema: m.file.schema, size: sizeBucket(bytes.byteLength), storeys: storeysBucket(m.storeys.length) });
  if (state.settings.cutM !== m.cutM) recut(state.settings.cutM);   // a height typed while this file loaded
}

function fail(f, r = f.result) { ga('ifcp_error', { reason: r.reason || 'engine' }); }

// A changed cut height: the worker cuts its open model again. If it restarted meanwhile (a timeout or a crash in
// another file), it no longer holds the model, so the file is read again once.
async function recut(cutM) {
  const f = state.file;
  if (!ok(f)) return;
  const gen = f.gen = f.gen + 1;
  const t0 = performance.now();
  busy({ key: 'ip.recutting', params: { h: m2(cutM) } });
  let m = engine ? await engine.process('recut', new ArrayBuffer(0), { cutM, recut: true }) : { type: 'error', reason: 'engine' };
  if (m.type === 'error' && m.reason === 'stale' && state.file === f && f.gen === gen) m = await run(f, { cutM });
  if (state.file !== f || f.gen !== gen) return;                  // a newer file or height took over
  busy(null);
  if (m.type !== 'result') { f.error = m; fail(f, m); render(true); return; }   // the last good plans stay
  f.result = m; f.cutM = m.cutM; f.error = null;
  state.recutMs = performance.now() - t0;
  mark('recut', t0);
  ga('ifcp_recut', {});
  render(true);
}

// ---- rendering ----
function render(keepView = false) {
  const f = state.file;
  $('ipDropHint').hidden = !!f;
  $('ipClear').hidden = !f;
  const err = f && (f.error || (f.result && f.result.type !== 'result' ? f.result : null));
  $('ipError').hidden = !err;
  if (err) $('ipError').textContent = `${f.name}: ${errorText(err)}`;
  $('ipPanel').hidden = !ok(f);
  if (!ok(f)) { drawing.clear(); return; }
  renderStatus(f);
  renderTable(f);
  renderTabs();
  renderPreview(f, keepView);
  renderWarnings(f);
}

function errorText(r) {
  const reason = r.reason || 'engine';
  if (reason === 'read' && (r.detail === 'ifczip' || r.detail === 'ifcxml')) return t(`ip.err.read.${r.detail}`);
  if (reason === 'schema') return t('ip.err.schema', { schema: r.detail || '?' });
  return t(`ip.err.${['read', 'limit', 'timeout', 'engine', 'empty'].includes(reason) ? reason : 'engine'}`);
}

function shift(f) { return state.settings.origin ? originShift(f.result.file.bbox) : null; }
const names = f => storeyFileNames(f.result.storeys.map(s => s.name || (f.result.file.noStoreys ? stem(f.name) : '')), t('ip.storey.fallback'));
const storeyName = (f, i) => f.result.storeys[i].name || names(f)[i].replace(/^\d+ |\.dxf$/g, '');

function renderStatus(f) {
  const r = f.result, box = $('ipStatus');
  const parts = [r.file.schema, r.file.app, t('ip.sum.storeys', { n: r.storeys.length }), t('ip.sum.products', { n: r.file.products }), t('ip.sum.rooms', { n: r.file.rooms }), t('ip.sum.units', { units: state.settings.units })];
  const s = shift(f);
  if (s) parts.push(t('ip.sum.shift', { x: -s.x, y: -s.y }));
  box.replaceChildren(el('span', 'ip-file', f.name), ...parts.filter(Boolean).map(p => el('span', null, p)));
  $('ipRecutTime').hidden = state.recutMs == null;
  if (state.recutMs != null) $('ipRecutTime').textContent = t('ip.recut.time', { h: m2(f.cutM), s: (state.recutMs / 1000).toFixed(2).replace('.', lang() === 'en' ? '.' : ',') });
}

function renderTable(f) {
  const r = f.result, files = names(f);
  const rows = r.storeys.map((s, i) => {
    const tr = document.createElement('tr');
    tr.tabIndex = 0;
    tr.dataset.storey = String(i);
    tr.classList.toggle('is-sel', i === state.selected);
    tr.appendChild(el('td', 'dq-name', s.name || files[i].replace(/^\d+ |\.dxf$/g, '')));
    tr.appendChild(el('td', 'dq-num', m2(s.levelM)));
    const drawn = Object.keys(s.layers).length > 0 || s.rooms.length > 0;
    tr.appendChild(drawn ? el('td', 'dq-num', String(s.cut)) : el('td', 'dq-num ip-empty', t('ip.row.nothing', { h: m2(f.cutM) })));
    const missing = s.noGeometry.reduce((a, x) => a + x.count, 0);
    const mc = el('td', missing ? 'dq-num ip-warn' : 'dq-num', missing ? `⚠ ${missing}` : '0');
    if (missing) mc.title = s.noGeometry.map(x => `${x.type} ${x.count}`).join(', ');
    tr.appendChild(mc);
    tr.appendChild(el('td', 'dq-num', String(s.rooms.length)));
    const td = el('td');
    const b = el('button', 'gv-btn', t('ip.row.dxf'));
    b.type = 'button';
    b.dataset.dxf = String(i);
    b.setAttribute('aria-label', t('ip.row.dxf.aria', { name: files[i] }));
    b.addEventListener('click', e => { e.stopPropagation(); downloadStorey(i); });
    td.appendChild(b);
    tr.appendChild(td);
    // A row selects its storey in the plan and moves the cut in 3D.
    const pick = () => { if (state.selected !== i) { state.selected = i; renderTable(f); renderPreview(f, true); } };
    tr.addEventListener('click', pick);
    tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    return tr;
  });
  $('ipStoreys').tBodies[0].replaceChildren(...rows);
}

function renderPreview(f, keepView) {
  const r = f.result, s = r.storeys[state.selected];
  $('ipPreviewName').textContent = storeyName(f, state.selected);
  drawing.show(s, r.file.bbox, keepView);
  update3dCut(f);
  render3d();
  renderLegend(f);
}

// The legend: one toggle per layer of the view shown (the storey's plan; in 3D, the model's layers too). A toggle
// hides its layer in both views, never in the DXF.
function renderLegend(f) {
  const shown = new Set(drawing.layers);
  if (state.tab === '3d' && f.three && f.three.mesh) for (const n of Object.keys(f.three.mesh.layers)) shown.add(n);
  $('ipLegend').replaceChildren(...LEGEND_ORDER.filter(n => shown.has(n)).map(n => {
    const li = el('li');
    const b = el('button', 'ip-toggle');
    b.type = 'button';
    b.dataset.layer = n;
    b.setAttribute('aria-pressed', String(!state.hidden.has(n)));
    const sw = el('span', 'ip-swatch');
    sw.style.borderColor = LAYER_COLORS[n];
    b.append(sw, n);
    li.append(b);
    return li;
  }));
}
$('ipLegend').addEventListener('click', e => {
  const b = e.target.closest('[data-layer]');
  if (!b) return;
  const n = b.dataset.layer;
  if (state.hidden.has(n)) state.hidden.delete(n); else state.hidden.add(n);
  drawing.setHidden(state.hidden);
  if (view3d) view3d.setHidden(state.hidden);
  ga('ifcp_layer_toggle', { layer: n });
  if (ok(state.file)) renderLegend(state.file);
  $('ipLegend').querySelector(`[data-layer="${n}"]`).focus();
});

function renderWarnings(f) {
  const list = warningsOf(f.result, { fileName: f.name, cutM: f.cutM, origin: state.settings.origin });
  const ul = $('ipWarnings');
  if (!list.length) { ul.replaceChildren(el('li', 'gv-w is-ok', t('ip.warn.none'))); return; }
  ul.replaceChildren(...list.map(w => {
    const p = { ...w.params };
    if (w.id === 'nostoreys') p.h = m2(p.h);
    if (w.id === 'samelevel') p.levels = p.levels.map(v => `${m2(v)} m`).join(', ');
    const li = el('li', 'gv-w is-warn');
    li.dataset.warn = w.id;
    li.appendChild(el('span', null, t(`ip.warn.${w.id}`, p)));
    return li;
  }));
}

// ---- the tabs: «Κάτοψη» | «3D» ----
const TABS = ['plan', '3d'];
function renderTabs() {
  for (const tab of TABS) {
    const b = $(tab === 'plan' ? 'ipTabPlan' : 'ipTab3d'), on = state.tab === tab;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    $(tab === 'plan' ? 'ipPlanView' : 'ip3dView').hidden = !on;
  }
}
function selectTab(tab, focus = false) {
  if (focus) $(tab === 'plan' ? 'ipTabPlan' : 'ipTab3d').focus();
  if (state.tab === tab) return;
  state.tab = tab;
  renderTabs();
  if (tab === '3d') open3d();
  if (ok(state.file)) renderLegend(state.file);
}
$('ipTabPlan').addEventListener('click', () => selectTab('plan'));
$('ipTab3d').addEventListener('click', () => selectTab('3d'));
$('ipTabs').addEventListener('keydown', e => {
  const i = TABS.indexOf(state.tab);
  const next = { ArrowRight: (i + 1) % TABS.length, ArrowLeft: (i + TABS.length - 1) % TABS.length, Home: 0, End: TABS.length - 1 }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  selectTab(TABS[next], true);
});

// ---- the 3D view ----
// The first open on a file: load view3d.js (and three.js) once, check WebGL2, ask the worker for the mesh with this
// device's triangle cap, and show it. A newer file meanwhile makes the answer moot.
async function open3d() {
  const f = state.file;
  if (!ok(f) || f.three) { render3d(); return; }
  const t0 = performance.now();
  const three = f.three = { status: 'loading', mesh: null, ga: false };
  render3d();
  let mod;
  try { mod = await (view3dModule || (view3dModule = import('./view3d.js?v=20261103'))); }
  catch (e) { view3dModule = null; if (f.three === three) done3d(f, 'failed'); return; }
  if (state.file !== f || f.three !== three) return;
  if (!view3d) {
    if (!mod.hasWebGL2()) { done3d(f, 'nogl'); return; }
    try {
      view3d = mod.createView3d($('ip3dBox'), { onHover: hover3d, onLost: lost3d });
      view3d.setHidden(state.hidden);
      renderView3dLabel();
      window.__ifcp.view3d = view3d;
    } catch (e) { view3d = null; done3d(f, 'nogl'); return; }
  }
  const cap = Number.isFinite(window.__ifcp.maxTriangles) ? window.__ifcp.maxTriangles
    : triangleCap({ coarse: window.matchMedia('(pointer: coarse)').matches, memoryGB: navigator.deviceMemory });
  const m = engine ? await engine.process('mesh3d', new ArrayBuffer(0), { mesh3d: true, maxTriangles: cap }) : { type: 'error', reason: 'engine' };
  if (state.file !== f || f.three !== three) return;              // a newer file took over
  if (m.type !== 'result') { done3d(f, m.reason === 'stale' ? 'stale' : 'failed'); return; }
  if (!m.mesh3d) { done3d(f, 'large'); return; }
  try {
    three.mesh = m.mesh3d;
    view3d.setMesh(m.mesh3d);
    three.status = 'shown';
    update3dCut(f);
  } catch (e) { three.mesh = null; done3d(f, 'failed'); return; }
  done3d(f, 'shown');
  requestAnimationFrame(() => mark('view3d', t0));                // after the view's first frame, drawn in this one
}

// The 3D outcome for this file: its note, and the GA event once per file (a stale model counts as failed).
function done3d(f, status) {
  f.three.status = status;
  if (!f.three.ga) { f.three.ga = true; ga('ifcp_view3d', { result: status === 'stale' ? 'failed' : status }); }
  render3d();
  renderLegend(f);
}

function lost3d() {
  const f = state.file;
  if (view3d) { view3d.canvas.remove(); view3d = null; window.__ifcp.view3d = null; }
  if (f && f.three) done3d(f, 'failed');
}

// The cut follows the selected storey and the cut height: one clipping plane at the storey's cut Z, its plan's lines
// drawn there. A re-cut only moves the plane; no new mesh.
function update3dCut(f) {
  if (!view3d || !f.three || f.three.status !== 'shown') return;
  const s = f.result.storeys[state.selected];
  view3d.setCut(state.cut3d ? s.cutZ : null, s);
}

function render3d() {
  const f = state.file;
  const status = f && f.three ? f.three.status : 'idle';
  const note = $('ip3dNote');
  const key = status === 'loading' ? 'ip.3d.loading' : ['large', 'nogl', 'stale', 'failed'].includes(status) ? `ip.3d.${status}` : null;
  note.hidden = !key;
  note.textContent = key ? t(key) : '';
  if (!ok(f)) return;
  const where = state.cut3d ? `${storeyName(f, state.selected)} · ${t('ip.3d.cutat', { h: m2(f.cutM) })}` : t('ip.3d.whole');
  $('ip3dHead').textContent = `${t('ip.tab.3d')} · ${where}`;
}
function renderView3dLabel() { if (view3d) view3d.canvas.setAttribute('aria-label', t('ip.aria.3d')); }

function hover3d(index, x, y) {
  const tip = $('ip3dTip'), f = state.file;
  const e = index != null && ok(f) && f.three && f.three.mesh ? f.three.mesh.elements[index] : null;
  if (!e) { tip.hidden = true; return; }
  tip.textContent = tipParts(e, f.result.storeys).join(' · ');
  const box = $('ip3dBox').getBoundingClientRect();
  tip.hidden = false;
  let left = x - box.left + 14, top = y - box.top + 14;
  if (left + tip.offsetWidth > box.width) left = Math.max(0, x - box.left - tip.offsetWidth - 10);
  if (top + tip.offsetHeight > box.height) top = Math.max(0, y - box.top - tip.offsetHeight - 10);
  tip.style.left = `${left}px`; tip.style.top = `${top}px`;
}

$('ip3dCut').addEventListener('change', e => {
  state.cut3d = e.target.checked;
  if (ok(state.file)) { update3dCut(state.file); render3d(); }
  ga('ifcp_3d_cut', { on: state.cut3d });
});
$('ip3dView').addEventListener('click', e => {
  const b = e.target.closest('[data-preset]');
  if (b && view3d) view3d.preset(b.dataset.preset);
});
$('ip3dFit').addEventListener('click', () => { if (view3d) view3d.fit(); });

// ---- the plan preview ----
const drawing = createDrawing($('ipCanvas'), {
  onHover(layer, x, y) {
    const tip = $('ipTip');
    if (!layer) { tip.hidden = true; return; }
    tip.replaceChildren(el('b', null, `${t('ip.tip.layer')}: `), document.createTextNode(layer));
    const box = $('ipCanvas').getBoundingClientRect();
    tip.hidden = false;
    let left = x - box.left + 14, top = y - box.top + 14;
    if (left + tip.offsetWidth > box.width) left = Math.max(0, x - box.left - tip.offsetWidth - 10);
    if (top + tip.offsetHeight > box.height) top = Math.max(0, y - box.top - tip.offsetHeight - 10);
    tip.style.left = `${left}px`; tip.style.top = `${top}px`;
  },
});
window.__ifcp.drawing = drawing;
$('ipFit').addEventListener('click', () => drawing.fit());
$('ipZoomIn').addEventListener('click', () => drawing.zoomBy(1.25));
$('ipZoomOut').addEventListener('click', () => drawing.zoomBy(1 / 1.25));

// ---- downloads: every layer, whatever the legend hides ----
function save(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function dxfOf(f, i) {
  return storeyDxf({ storey: f.result.storeys[i], source: f.name, cutM: f.cutM, units: state.settings.units, shift: shift(f) }).bytes;
}
function downloadStorey(i) {
  const f = state.file;
  if (!ok(f)) return;
  save(new Blob([dxfOf(f, i)], { type: 'application/dxf' }), names(f)[i]);
  ga('ifcp_download', { what: 'storey', units: state.settings.units });
}
$('ipZip').addEventListener('click', () => {
  const f = state.file;
  if (!ok(f)) return;
  const files = uniqueNames(names(f)).map((name, i) => ({ name, bytes: dxfOf(f, i) }));
  save(new Blob([zipStore(files)], { type: 'application/zip' }), zipName(f.name));
  ga('ifcp_download', { what: 'zip', units: state.settings.units });
});

// ---- settings: remembered in this browser ----
function renderSettings() {
  const u = $('ipUnits');
  u.replaceChildren(...Object.keys(UNITS).map(k => { const o = el('option', null, t(`ip.unit.${k}`)); o.value = k; return o; }));
  u.value = state.settings.units;
  $('ipOrigin').checked = state.settings.origin;
  if (document.activeElement !== $('ipCut')) $('ipCut').value = m2(state.settings.cutM);
}
$('ipCut').addEventListener('change', e => {
  const v = parseCut(e.target.value);
  if (v === undefined) { e.target.setAttribute('aria-invalid', 'true'); return; }
  e.target.removeAttribute('aria-invalid');
  e.target.value = m2(v);
  if (v === state.settings.cutM) return;
  state.settings.cutM = v;
  saveSettings();
  recut(v);
});
$('ipUnits').addEventListener('change', e => {
  state.settings.units = e.target.value;
  saveSettings();
  if (ok(state.file)) renderStatus(state.file);
});
$('ipOrigin').addEventListener('change', e => {
  state.settings.origin = e.target.checked;
  saveSettings();
  if (ok(state.file)) { renderStatus(state.file); renderWarnings(state.file); }
});

// ---- inputs ----
async function readFile(file) {
  const my = ++latest;
  if (file.size > MAX_BYTES) { await loadFile(file.name, { byteLength: file.size }, 'file'); return; }   // refused before reading
  let bytes;
  try { bytes = await file.arrayBuffer(); }
  catch (e) {
    if (my !== latest) return;
    const f = { name: file.name, bytes: null, source: 'file', result: { type: 'error', reason: 'read' }, gen: 0, three: null };
    newFile(f);
    busy(null); fail(f); render();
    return;
  }
  if (my !== latest) return;
  await loadFile(file.name, bytes, 'file');
}
$('ipInput').addEventListener('change', async e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) await readFile(f); });
document.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('gv-dragging'); });
document.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('gv-dragging'); });
document.addEventListener('drop', async e => {
  e.preventDefault(); document.body.classList.remove('gv-dragging');
  const f = [...((e.dataTransfer && e.dataTransfer.files) || [])][0];
  if (f) await readFile(f);
});
$('ipExample').addEventListener('click', async () => {
  const t0 = performance.now();                                    // the example's time runs from the click
  const my = ++latest;
  let bytes;
  try {
    const r = await fetch(new URL(`./examples/${EXAMPLE}?v=20261103`, import.meta.url));
    if (!r.ok) throw new Error(String(r.status));
    bytes = await r.arrayBuffer();
  } catch (e) { if (my === latest) showBanner({ key: 'ip.example.failed' }); return; }
  if (my !== latest) return;
  await loadFile(EXAMPLE, bytes, 'example', t0);
});
$('ipClear').addEventListener('click', () => { latest++; newFile(null); busy(null); render(); });

// ---- CTA and survey ----
$('ipCta').addEventListener('click', () => ga('ifcp_cta_click', { where: 'page' }));
if (lsGet(SURVEY_KEY)) $('ipSurvey').hidden = true;
$('ipSurvey').addEventListener('click', e => {
  const b = e.target.closest('[data-answer]');
  if (!b) return;
  ga('ifcp_survey', { answer: b.dataset.answer });
  lsSet(SURVEY_KEY, b.dataset.answer);
  $('ipSurvey').querySelectorAll('[data-answer]').forEach(x => { x.disabled = true; });
  $('ipThanks').hidden = false;
});

// A language change re-renders everything built here (the preview keeps its view).
document.addEventListener('gv:lang', () => {
  if (state.banner) showBanner(state.banner);
  busy(state.busy);
  renderSettings();
  renderView3dLabel();
  render(true);
});

renderSettings();
render();
```

Run:
```bash
for f in ifc-plans.html css/tools.css js/ifcplan/ui.js; do node _tests/extract.mjs $PLAN $f; done
node --test "_tests/ifcplan/*.test.js" 2>&1 | grep -E "^ℹ (pass|fail)"
git diff --stat
```
Expected:
- `ℹ pass 96`, `ℹ fail 0`. The i18n test checks that every new inline Greek string equals `el`, and that every literal `ip.*` key in `ui.js` exists.
- `css/tools.css | 24 +`: appended lines only; the other tools' rules are untouched.

- [ ] **Step 3: Commit**

```bash
git add ifc-plans.html css/tools.css js/ifcplan/ui.js _tests/ifcplan/page3d.test.js
git commit -F - <<'EOF'
IFC 3D view: the Plan | 3D tabs, the 3D toolbar and the shared layer toggles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
```

---

### Task 10: Browser verification

**Files:**
- Modify: `_tests/ifcplan/browser-check.js`:
  - the 3D section (new step 10, 17 checks), and the 3D check at 375 px;
  - the steps renumbered 11–13;
  - WebGL `GL_INVALID` and `CONTEXT_LOST` console messages counted as errors;
  - the optional `BIG` run;
  - the timings line with `view3d`.
- Modify: `_tests/ifcplan/browser-check.cjs` (`GL=swiftshader`; the header names `BIG` and `GL`)

**Interfaces:**
- Consumes: the page of Task 9 and its test hooks.

- [ ] **Step 1: Write the check and its runner**

<!-- file: _tests/ifcplan/browser-check.js -->
```js
// Dev-only browser check of ifc-plans.html (Jekyll skips _tests). It is one Playwright function: run it with the
// Playwright MCP (browser_run_code_unsafe, filename: _tests/ifcplan/browser-check.js) or with
// node _tests/ifcplan/browser-check.cjs. It expects the repo root served on http://127.0.0.1:8793/ and returns
// { pass, fail, checks: [{ name, ok, got }] }.
async (page) => {
  const BASE = 'http://127.0.0.1:8793/';
  const checks = [];
  const check = (name, ok, got) => checks.push({ name, ok: !!ok, got });
  const errors = [], external = [], requests = [];
  page.on('console', m => { if (m.type() === 'error' || /GL_INVALID|CONTEXT_LOST/.test(m.text())) errors.push(m.text()); });   // WebGL errors come as warnings
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => { const u = r.url(); requests.push(u); if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.clearBrowserCache');                           // a cached old module would hide a fix

  // A strict reader of the R12 DXFs the page writes: pairs, sections, POLYLINE…SEQEND, TEXT, Windows-1253 text.
  const readDxf = bytes => {
    const lines = new TextDecoder('windows-1253').decode(bytes).split('\r\n');
    if (lines.pop() !== '' || lines.length % 2) throw new Error('not whole group pairs');
    const out = { comments: [], header: {}, entities: [], sections: [] };
    let sec = null, key = null, poly = null, ent = null;
    for (let i = 0; i < lines.length; i += 2) {
      const c = +lines[i], v = lines[i + 1];
      if (c === 999) { out.comments.push(v); continue; }
      if (c === 0 && v === 'SECTION') { sec = lines[i + 3]; out.sections.push(sec); i += 2; continue; }
      if (c === 0 && v === 'ENDSEC') { if (poly) throw new Error('POLYLINE left open'); sec = null; continue; }
      if (c === 0 && v === 'EOF') { if (i + 2 !== lines.length) throw new Error('data after EOF'); out.eof = true; break; }
      if (sec === 'HEADER') { if (c === 9) { key = v; out.header[key] = []; } else out.header[key].push(v); continue; }
      if (sec !== 'ENTITIES') continue;
      if (c === 0) {
        if (v === 'VERTEX') { if (!poly) throw new Error('VERTEX outside POLYLINE'); poly.n++; ent = null; continue; }
        if (v === 'SEQEND') { if (!poly) throw new Error('SEQEND alone'); poly = null; ent = null; continue; }
        if (poly) throw new Error(`${v} inside POLYLINE`);
        ent = { type: v, layer: null, text: null };
        if (v === 'POLYLINE') { ent.n = 0; poly = ent; }
        out.entities.push(ent);
        continue;
      }
      if (ent && c === 8) ent.layer = v;
      if (ent && c === 1) ent.text = v;
    }
    if (!out.eof) throw new Error('no EOF');
    return out;
  };
  const byLayer = d => { const o = {}; for (const e of d.entities) { const k = `${e.type} ${e.layer}`; o[k] = (o[k] || 0) + 1; } return o; };
  const download = async selector => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click(selector)]);
    const chunks = []; for await (const c of await dl.createReadStream()) chunks.push(c);
    return { name: dl.suggestedFilename(), bytes: Buffer.concat(chunks) };
  };
  const rows = () => page.$$eval('#ipStoreys tbody tr', trs => trs.map(tr => [...tr.cells].map(c => c.innerText.trim())));
  const timings = () => page.evaluate(() => ({ ...window.__ifcp.timings }));
  const ready = () => page.waitForFunction(() => !document.querySelector('#ipPanel').hidden && document.querySelector('#ipBusy').hidden, null, { timeout: 30000 });

  // 1. The page paints without web-ifc; the example loads it.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(BASE + 'ifc-plans.html?lang=en');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('privacy-pref', 'declined'); });
  await page.goto(BASE + 'ifc-plans.html?lang=en');
  check('English title', (await page.title()) === 'AidedCAM - DXF floor plans from IFC', await page.title());
  check('no worker or web-ifc before a file', !requests.some(u => /worker\.js|web-ifc/.test(u)), requests.filter(u => /ifcplan/.test(u)));
  await page.click('#ipExample');
  await ready();
  check('the example: two storeys, levels, elements cut, rooms', JSON.stringify(await rows()) === JSON.stringify([['Ισόγειο', '0.00', '9', '0', '2', 'DXF'], ['Όροφος 1', '3.00', '7', '0', '1', 'DXF']]), await rows());
  const status = await page.$eval('#ipStatus', e => e.innerText.replace(/\s+/g, ' '));
  check('the summary line', status === 'example-house.ifc IFC4 AidedCAM example generator 2 storeys 19 elements 3 rooms DXF in m', status);
  check('web-ifc loaded with the example, from this site', requests.some(u => u.endsWith('web-ifc.wasm?v=20261103')), requests.filter(u => /web-ifc/.test(u)));
  const legend = await page.$eval('#ipLegend', e => e.innerText.split('\n').join(' '));
  check('the preview and its legend', legend === 'IFC_WALL IFC_DOOR IFC_WINDOW IFC_COLUMN IFC_STAIR IFC_SPACE', legend);
  check('no warnings on the example', (await page.$eval('#ipWarnings', e => e.innerText.trim())) === 'No warnings.', await page.$eval('#ipWarnings', e => e.innerText));
  const tExample = (await timings()).example;
  check(`the example: click to preview under 1 s (${tExample} ms)`, tExample < 1000, tExample);

  // 2. Every DXF re-parses, with its layers, its Greek labels and its name.
  const g = await download('button[data-dxf="0"]');
  const gd = readDxf(g.bytes);
  check('ground floor DXF: its name', g.name === '01 Ισόγειο.dxf', g.name);
  check('ground floor DXF: R12, code page 1253, metres', gd.header.$ACADVER[0] === 'AC1009' && gd.header.$DWGCODEPAGE[0] === 'ANSI_1253' && gd.header.$INSUNITS[0] === '6', gd.header);
  check('ground floor DXF: the layers of the plan', JSON.stringify(byLayer(gd)) === JSON.stringify({ 'POLYLINE IFC_WALL': 7, 'POLYLINE IFC_DOOR': 1, 'POLYLINE IFC_WINDOW': 1, 'POLYLINE IFC_COLUMN': 1, 'POLYLINE IFC_STAIR': 1, 'POLYLINE IFC_SPACE': 2, 'TEXT IFC_SPACE_TEXT': 4 }), byLayer(gd));
  check('ground floor DXF: Greek labels with areas', gd.entities.filter(e => e.type === 'TEXT').map(e => e.text).join('|') === 'Σαλόνι|43.61 m²|Κουζίνα|27.74 m²', gd.entities.filter(e => e.type === 'TEXT').map(e => e.text));
  const u = await download('button[data-dxf="1"]');
  const ud = readDxf(u.bytes);
  check('upper floor DXF: name, layers and its three-line label', u.name === '02 Όροφος 1.dxf' && JSON.stringify(byLayer(ud)) === JSON.stringify({ 'POLYLINE IFC_WALL': 6, 'POLYLINE IFC_WINDOW': 1, 'POLYLINE IFC_RAILING': 1, 'POLYLINE IFC_SPACE': 1, 'TEXT IFC_SPACE_TEXT': 3 }) && ud.entities.filter(e => e.type === 'TEXT').map(e => e.text).join('|') === '1.01|Υπνοδωμάτιο|36.10 m²', [u.name, byLayer(ud)]);
  check('the comment block names the source, storey and cut', ud.comments.slice(1, 4).join('|') === 'Source: example-house.ifc|Storey: Όροφος 1, level 3.000 m|Cut: 1.10 m above the storey level, at 4.100 m', ud.comments);

  // 3. The ZIP holds both plans.
  const z = await download('#ipZip');
  const entries = [];
  for (let p = 0; z.bytes.readUInt32LE(p) === 0x04034b50;) {
    const size = z.bytes.readUInt32LE(p + 18), nl = z.bytes.readUInt16LE(p + 26);
    entries.push({ name: z.bytes.slice(p + 30, p + 30 + nl).toString('utf8'), bytes: z.bytes.slice(p + 30 + nl, p + 30 + nl + size) });
    p += 30 + nl + size;
  }
  check('the ZIP: its name and two entries, each the storey DXF', z.name === 'example-house-dxf.zip' && entries.map(e => e.name).join('|') === '01 Ισόγειο.dxf|02 Όροφος 1.dxf' && entries[0].bytes.equals(g.bytes) && entries[1].bytes.equals(u.bytes), [z.name, entries.map(e => [e.name, e.bytes.length])]);

  // 4. Units and the move to origin rewrite the DXFs only.
  await page.selectOption('#ipUnits', 'mm');
  const mm = readDxf((await download('button[data-dxf="0"]')).bytes);
  check('a unit switch rewrites $INSUNITS and scales: mm', mm.header.$INSUNITS[0] === '4' && mm.header.$EXTMIN[0] === '120500.0' && mm.header.$EXTMIN[1] === '80250.0', mm.header);
  await page.check('#ipOrigin');
  const moved = readDxf((await download('button[data-dxf="0"]')).bytes);
  check('move to origin writes the shift and moves the plan', moved.comments[5] === "Shift: X -120000 mm, Y -80000 mm; add it back to return to the IFC's coordinates" && moved.header.$EXTMIN[0] === '500.0' && moved.header.$EXTMIN[1] === '250.0', [moved.comments[5], moved.header.$EXTMIN]);
  check('the summary names the units and the shift', (await page.$eval('#ipStatus', e => e.innerText.replace(/\s+/g, ' '))).endsWith('DXF in mm shift X -120 m, Y -80 m'), await page.$eval('#ipStatus', e => e.innerText));
  await page.uncheck('#ipOrigin');
  await page.selectOption('#ipUnits', 'm');

  // 5. A re-cut on the open model, and a refused height.
  await page.fill('#ipCut', '2.20');
  await page.press('#ipCut', 'Enter');
  await page.waitForFunction(() => !document.querySelector('#ipRecutTime').hidden && document.querySelector('#ipBusy').hidden, null, { timeout: 30000 });
  check('re-cut at 2.20 m: the door and windows drop out', JSON.stringify((await rows()).map(r => r[2])) === JSON.stringify(['7', '5']), await rows());
  const high = readDxf((await download('button[data-dxf="0"]')).bytes);
  check('the re-cut DXF: no door, the new cut in its comment', !byLayer(high)['POLYLINE IFC_DOOR'] && high.comments[3] === 'Cut: 2.20 m above the storey level, at 2.200 m', [byLayer(high), high.comments[3]]);
  const tRecut = (await timings()).recut;
  check(`a re-cut under 1 s (${tRecut} ms), its time shown`, tRecut < 1000 && /^Re-cut at 2\.20 m in \d\.\d\d s\.$/.test(await page.$eval('#ipRecutTime', e => e.innerText)), await page.$eval('#ipRecutTime', e => e.innerText));
  const webIfcLoads = requests.filter(u2 => u2.includes('web-ifc.wasm')).length;
  await page.fill('#ipCut', 'abc');
  await page.press('#ipCut', 'Enter');
  check('an invalid height is marked and not cut', (await page.getAttribute('#ipCut', 'aria-invalid')) === 'true' && JSON.stringify((await rows()).map(r => r[2])) === JSON.stringify(['7', '5']), await page.getAttribute('#ipCut', 'aria-invalid'));
  await page.fill('#ipCut', '1.10');
  await page.press('#ipCut', 'Enter');
  await page.waitForFunction(() => document.querySelector('#ipStoreys tbody tr').cells[2].innerText.trim() === '9', null, { timeout: 30000 });
  check('back at 1.10 m, without reloading web-ifc', requests.filter(u2 => u2.includes('web-ifc.wasm')).length === webIfcLoads && (await page.getAttribute('#ipCut', 'aria-invalid')) === null, webIfcLoads);

  // 6. The preview: a storey row selects it; the tooltip names the layer under the pointer.
  await page.click('#ipStoreys tbody tr:nth-child(2) td:first-child');
  const sel = await page.evaluate(() => ({ name: document.querySelector('#ipPreviewName').textContent, legend: document.querySelector('#ipLegend').innerText.split('\n').join(' '), sel: document.querySelector('#ipStoreys tr.is-sel td').innerText }));
  check('a row click shows that storey', sel.name === 'Όροφος 1' && sel.sel === 'Όροφος 1' && sel.legend === 'IFC_WALL IFC_WINDOW IFC_RAILING IFC_SPACE', sel);
  await page.$eval('#ipCanvas', c => c.scrollIntoView({ block: 'center', behavior: 'instant' }));   // the site scrolls smoothly: wait for none
  const at = await page.evaluate(() => { const s = window.__ifcp.drawing.screenOf(122, 80.25), r = document.querySelector('#ipCanvas').getBoundingClientRect(); return { x: r.left + s.x, y: r.top + s.y }; });
  await page.mouse.move(at.x, at.y);
  await page.waitForFunction(() => !document.querySelector('#ipTip').hidden, null, { timeout: 5000 }).catch(() => {});
  check('hover over the outer face of the south wall: the tooltip names IFC_WALL', (await page.$eval('#ipTip', e => e.hidden ? '' : e.innerText)) === 'Layer: IFC_WALL', await page.$eval('#ipTip', e => e.innerText));
  const canvasInk = await page.$eval('#ipCanvas', c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 80 && d[i + 1] < 80 && d[i + 2] < 80) n++; return n; });
  check('the preview draws the walls', canvasInk > 500, canvasInk);

  // 7. Languages.
  await page.click('.lang-btn[data-lang="el"]');
  check('Greek: title, decimal comma, headings', (await page.title()) === 'AidedCAM - Κατόψεις DXF από IFC' && (await rows())[1][1] === '3,00' && (await page.$eval('#ipStoreys thead', e => e.innerText)).includes('Στοιχεία στην τομή') && (await page.inputValue('#ipCut')) === '1,10', [await page.title(), (await rows())[1]]);
  await page.click('.lang-btn[data-lang="it"]');
  check('Italian: title, summary, warnings', (await page.title()) === 'AidedCAM - Piante DXF da IFC' && (await page.$eval('#ipStatus', e => e.innerText)).includes('2 piani') && (await page.$eval('#ipWarnings', e => e.innerText.trim())) === 'Nessun avviso.', await page.$eval('#ipStatus', e => e.innerText));
  await page.click('.lang-btn[data-lang="en"]');

  // 8. Settings stay in this browser.
  await page.fill('#ipCut', '0.90'); await page.press('#ipCut', 'Enter');
  await page.waitForFunction(() => document.querySelector('#ipRecutTime').innerText.startsWith('Re-cut at 0.90'), null, { timeout: 30000 });
  await page.selectOption('#ipUnits', 'cm');
  await page.reload();
  check('the cut height and units are remembered', (await page.inputValue('#ipCut')) === '0.90' && (await page.inputValue('#ipUnits')) === 'cm', [await page.inputValue('#ipCut'), await page.inputValue('#ipUnits')]);
  await page.evaluate(() => localStorage.removeItem('aidedcam-ifcp-settings'));
  await page.reload();
  check('the defaults: 1.10 m, metres, not moved', (await page.inputValue('#ipCut')) === '1.10' && (await page.inputValue('#ipUnits')) === 'm' && !(await page.isChecked('#ipOrigin')), await page.inputValue('#ipCut'));

  // 9. Files the tool refuses: one line in the visitor's language, and the page stays usable.
  await page.setInputFiles('#ipInput', { name: 'drawing.dxf', mimeType: 'application/dxf', buffer: Buffer.from('0\r\nSECTION\r\n2\r\nHEADER\r\n0\r\nENDSEC\r\n0\r\nEOF\r\n') });
  await page.waitForFunction(() => !document.querySelector('#ipError').hidden, null, { timeout: 30000 });
  check('not an IFC: the read error', (await page.$eval('#ipError', e => e.innerText)) === 'drawing.dxf: This is not an IFC file the tool can read: it supports .ifc in STEP text.', await page.$eval('#ipError', e => e.innerText));
  await page.setInputFiles('#ipInput', { name: 'model.ifczip', mimeType: 'application/zip', buffer: Buffer.from([0x50, 0x4b, 3, 4, 20, 0, 0, 0]) });
  await page.waitForFunction(() => document.querySelector('#ipError').innerText.startsWith('model.ifczip'), null, { timeout: 30000 });
  check('ifcZIP: says to unzip it', (await page.$eval('#ipError', e => e.innerText)).includes('.ifcZIP files are not supported'), await page.$eval('#ipError', e => e.innerText));
  const ifc9 = (await (await page.request.get(BASE + 'js/ifcplan/examples/example-house.ifc')).text()).replace("FILE_SCHEMA(('IFC4'))", "FILE_SCHEMA(('IFC9'))");
  await page.setInputFiles('#ipInput', { name: 'future.ifc', mimeType: 'application/octet-stream', buffer: Buffer.from(ifc9) });
  await page.waitForFunction(() => document.querySelector('#ipError').innerText.startsWith('future.ifc'), null, { timeout: 30000 });
  check('an unknown schema: named', (await page.$eval('#ipError', e => e.innerText)).includes('“IFC9”'), await page.$eval('#ipError', e => e.innerText));
  await page.click('#ipExample');
  await ready();
  check('the page stays usable: the example again', (await rows()).length === 2 && (await page.$eval('#ipError', e => e.hidden)), await rows());

  // 10. The 3D view (3D spec §10): three.js only with the tab, the cut, picking, the shared toggles, the limits.
  await page.evaluate(() => { window.__ga = []; window.gaEvent = (n, p) => window.__ga.push([n, p]); });
  const gaEvents = () => page.evaluate(() => window.__ga.map(([n, p]) => `${n} ${JSON.stringify(p)}`));
  check('no three.js or 3D module before the 3D tab', !requests.some(u => /vendor\/three|view3d\.js/.test(u)), requests.filter(u => /three|view3d/.test(u)));
  const shown3d = () => page.waitForFunction(() => window.__ifcp.view3d && window.__ifcp.timings.view3d != null && document.querySelector('#ip3dNote').hidden, null, { timeout: 30000 });
  const frames = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const v3 = (fn, arg) => page.evaluate(([f, a]) => new Function('v', 'a', `return (${f})(v, a)`)(window.__ifcp.view3d, a), [fn.toString(), arg]);
  // The tooltip over a world point (IFC metres), as the mouse gives it.
  const tip3d = async (x, y, z) => {
    await page.$eval('#ip3dBox', c => c.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await frames();
    const at = await page.evaluate(([x, y, z]) => { const v = window.__ifcp.view3d, s = v.screenOf(x, y, z), r = v.canvas.getBoundingClientRect(); return { x: r.left + s.x, y: r.top + s.y }; }, [x, y, z]);
    await page.mouse.move(at.x - 3, at.y - 3);
    await page.mouse.move(at.x, at.y);
    await frames(); await frames();
    return page.$eval('#ip3dTip', e => (e.hidden ? '' : e.innerText));
  };
  await page.click('#ipTab3d');
  await shown3d();
  const t3d = (await timings()).view3d;
  check(`the example in 3D: tab click to view under 1 s, three.js included (${t3d} ms)`, t3d < 1000 && requests.some(u => u.endsWith('/js/vendor/three/three.module.js')) && requests.some(u => u.endsWith('view3d.js?v=20261103')), t3d);
  const head = await page.$eval('#ip3dHead', e => e.textContent);
  const legend3d = await page.$eval('#ipLegend', e => e.innerText.split('\n').join(' '));
  check('the 3D heading, and the model\'s layers in the legend', head === '3D · Ισόγειο · cut at 1.10 m' && legend3d === 'IFC_WALL IFC_DOOR IFC_WINDOW IFC_COLUMN IFC_SLAB IFC_STAIR IFC_RAILING IFC_SPACE', [head, legend3d]);
  const ink = await v3(v => v.ink());
  check(`the 3D canvas draws the model (${ink.n} px)`, ink.n > 5000, ink);
  check('the cut at the ground floor\'s plane, with its plan\'s lines', (await v3(v => v.cutZ)) === 1.1 && JSON.stringify((await v3(v => v.lineLayers)).sort()) === JSON.stringify(['IFC_COLUMN', 'IFC_DOOR', 'IFC_SPACE', 'IFC_STAIR', 'IFC_WALL', 'IFC_WINDOW']), [await v3(v => v.cutZ), await v3(v => v.lineLayers)]);
  await page.click('[data-preset="top"]');
  await frames();
  const onTop = await v3(v => v.ink()), floorTip = await tip3d(123, 84, 0);
  await page.uncheck('#ip3dCut');
  await frames();
  const offTop = await v3(v => v.ink()), roofTip = await tip3d(123, 84, 0);
  check('top view: the cut shows the ground floor, without it the roof', onTop.sig !== offTop.sig && floorTip === 'IfcSlab · IFC_SLAB · Πλάκα ισογείου · Ισόγειο' && roofTip === 'IfcSlab · IFC_SLAB · Πλάκα οροφής · Όροφος 1', [floorTip, roofTip, onTop, offTop]);
  check('the cut off: the whole model, no cut lines', (await v3(v => v.cutZ)) === null && (await v3(v => v.lineLayers)).length === 0 && (await page.$eval('#ip3dHead', e => e.textContent)) === '3D · whole model', await page.$eval('#ip3dHead', e => e.textContent));
  await page.check('#ip3dCut');
  await page.fill('#ipCut', '2.20'); await page.press('#ipCut', 'Enter');
  await page.waitForFunction(() => window.__ifcp.view3d.cutZ > 2, null, { timeout: 30000 });
  check('a re-cut moves the plane: 2.20 m', Math.abs((await v3(v => v.cutZ)) - 2.2) < 1e-9 && (await page.$eval('#ip3dHead', e => e.textContent)) === '3D · Ισόγειο · cut at 2.20 m', await v3(v => v.cutZ));
  await page.fill('#ipCut', '1.10'); await page.press('#ipCut', 'Enter');
  await page.waitForFunction(() => Math.abs(window.__ifcp.view3d.cutZ - 1.1) < 1e-9, null, { timeout: 30000 });
  await page.click('#ipStoreys tbody tr:nth-child(2) td:first-child');
  check('a storey row moves the cut: Όροφος 1 at 4.10 m', Math.abs((await v3(v => v.cutZ)) - 4.1) < 1e-9 && (await page.$eval('#ip3dHead', e => e.textContent)) === '3D · Όροφος 1 · cut at 1.10 m', await v3(v => v.cutZ));
  await page.click('#ipStoreys tbody tr:nth-child(1) td:first-child');
  await page.click('[data-preset="iso"]');
  await frames();
  const wallTip = await tip3d(125.5, 80.25, 0.6);
  check('hover over the south wall in Iso: its type, layer, name and storey', wallTip === 'IfcWall · IFC_WALL · Τοίχος Ν · Ισόγειο', wallTip);
  await page.click('#ipLegend [data-layer="IFC_WALL"]');
  const hiddenTip = await tip3d(125.5, 80.25, 0.6);
  const planLayerAt = () => page.evaluate(() => { const d = window.__ifcp.drawing, s = d.screenOf(122, 80.25); return d.layerAt(s.x, s.y); });
  await page.click('#ipTabPlan');
  await frames();                                                        // the plan canvas takes its size back
  const planWall = await planLayerAt();
  check('IFC_WALL hidden: off in 3D (mesh and cut lines) and in the plan, its toggle not pressed', !(await v3(v => v.layers)).includes('IFC_WALL') && !(await v3(v => v.lineLayers)).includes('IFC_WALL') && !hiddenTip.includes('IFC_WALL') && planWall === null && (await page.getAttribute('#ipLegend [data-layer="IFC_WALL"]', 'aria-pressed')) === 'false', [hiddenTip, planWall]);
  const kept = readDxf((await download('button[data-dxf="0"]')).bytes);
  check('the DXF keeps IFC_WALL', byLayer(kept)['POLYLINE IFC_WALL'] === 7, byLayer(kept));
  await page.click('#ipLegend [data-layer="IFC_WALL"]');
  check('IFC_WALL back in both views', (await v3(v => v.layers)).includes('IFC_WALL') && (await planLayerAt()) === 'IFC_WALL', await v3(v => v.layers));
  await page.click('#ipTab3d');
  await page.focus('#ipTab3d');
  await page.keyboard.press('ArrowLeft');
  check('the arrow keys move between the tabs', (await page.getAttribute('#ipTabPlan', 'aria-selected')) === 'true' && (await page.$eval('#ip3dView', e => e.hidden)) && (await page.evaluate(() => document.activeElement.id)) === 'ipTabPlan', await page.evaluate(() => document.activeElement.id));
  check('GA: the 3D view once, the cut checkbox, the layer toggles', JSON.stringify(await gaEvents()) === JSON.stringify(['ifcp_view3d {"result":"shown"}', 'ifcp_3d_cut {"on":false}', 'ifcp_3d_cut {"on":true}', 'ifcp_recut {}', 'ifcp_recut {}', 'ifcp_layer_toggle {"layer":"IFC_WALL"}', 'ifcp_download {"what":"storey","units":"m"}', 'ifcp_layer_toggle {"layer":"IFC_WALL"}']), await gaEvents());

  // A new file: the plan tab, the 3D scene disposed; over the cap: "too large".
  await page.click('#ipTab3d');
  const before = await v3(v => v.geometries);
  await page.evaluate(() => { window.__ifcp.maxTriangles = 10; delete window.__ifcp.timings.example; });
  await page.click('#ipExample');
  await page.waitForFunction(() => window.__ifcp.timings.example != null, null, { timeout: 30000 });
  check(`a new file disposes the 3D scene (${before} geometries, then 0) and shows the plan`, before > 0 && (await v3(v => v.geometries)) === 0 && (await page.getAttribute('#ipTabPlan', 'aria-selected')) === 'true', [before, await v3(v => v.geometries)]);
  await page.click('#ipTab3d');
  await page.waitForFunction(() => document.querySelector('#ip3dNote').textContent.startsWith('This model'), null, { timeout: 30000 });
  check('over the triangle cap: too large for the 3D view, the plans unaffected', (await page.$eval('#ip3dNote', e => e.textContent)) === 'This model is too large for the 3D view in this browser; the plans are unaffected.' && (await rows()).length === 2 && (await gaEvents()).includes('ifcp_view3d {"result":"large"}'), await page.$eval('#ip3dNote', e => e.textContent));
  await page.evaluate(() => { window.__ifcp.maxTriangles = undefined; window.gaEvent = () => {}; });
  await page.click('#ipExample');
  await ready();

  // No WebGL: a page whose canvases give no WebGL context.
  const p2 = await page.context().newPage();
  p2.on('pageerror', e => errors.push(String(e)));
  p2.on('console', m => { if (m.type() === 'error' || /GL_INVALID|CONTEXT_LOST/.test(m.text())) errors.push(m.text()); });
  await p2.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return /webgl/.test(type) ? null : get.call(this, type, ...rest); };
  });
  await p2.goto(BASE + 'ifc-plans.html?lang=en');
  await p2.click('#ipExample');
  await p2.waitForFunction(() => !document.querySelector('#ipPanel').hidden && document.querySelector('#ipBusy').hidden, null, { timeout: 30000 });
  await p2.click('#ipTab3d');
  await p2.waitForFunction(() => !document.querySelector('#ip3dNote').hidden && !document.querySelector('#ip3dNote').textContent.startsWith('Preparing'), null, { timeout: 30000 });
  const nogl = await p2.$eval('#ip3dNote', e => e.textContent);
  await p2.click('#ipTabPlan');
  const planOk = await p2.$eval('#ipStoreys tbody', e => e.rows.length);
  check('no WebGL: "3D is not available", the plan tab works', nogl === '3D is not available in this browser.' && planOk === 2, [nogl, planOk]);
  await p2.close();

  // A large public sample, when BIG names one (never committed): 3D within spec §9, hover frames under 50 ms.
  if (process.env && process.env.BIG) {
    await page.setInputFiles('#ipInput', process.env.BIG);
    await ready();
    await page.evaluate(() => { delete window.__ifcp.timings.view3d; });
    await page.click('#ipTab3d');
    await shown3d();
    const tBig = (await timings()).view3d;
    await page.$eval('#ip3dBox', c => c.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.evaluate(() => { window.__frames = []; let last = performance.now(); const tick = t => { window.__frames.push(t - last); last = t; if (window.__frames.length < 400) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    const box = await page.$eval('#ip3dBox', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    for (let i = 0; i <= 60; i++) { await page.mouse.move(box.x + box.w * (0.2 + 0.6 * i / 60), box.y + box.h * (0.5 + 0.2 * Math.sin(i / 6))); await page.waitForTimeout(16); }
    const worst = await page.evaluate(() => Math.round(Math.max(...window.__frames.slice(2))));
    check(`a large file (BIG): 3D in ${tBig} ms (spec: under 3 s), worst frame while hovering ${worst} ms (spec: under 50)`, tBig < 3000 && worst < 50, { tBig, worst });
    await page.click('#ipExample');
    await ready();
  }

  // 11. A phone: no horizontal page scroll, a 16 px gutter, the table scrolls in its own box; the tabs and the 3D view fit.
  await page.setViewportSize({ width: 375, height: 800 });
  await page.waitForTimeout(200);
  const phone = await page.evaluate(() => ({ scroll: [document.documentElement.scrollWidth, document.documentElement.clientWidth], gutter: Math.round(document.querySelector('.ip-bar').getBoundingClientRect().left), canvas: Math.round(document.querySelector('#ipCanvas').getBoundingClientRect().width), wrap: getComputedStyle(document.querySelector('#ipStoreys').parentElement).overflowX }));
  check('at 375 px: no horizontal scroll, 16 px gutter, full-width preview, the table scrolls in its box', phone.scroll[0] === phone.scroll[1] && phone.gutter === 16 && phone.canvas >= 340 && phone.wrap === 'auto', phone);
  await page.evaluate(() => { delete window.__ifcp.timings.view3d; });
  await page.click('#ipTab3d');
  await shown3d();
  const phone3d = await page.evaluate(() => ({ scroll: [document.documentElement.scrollWidth, document.documentElement.clientWidth], tabs: Math.round(document.querySelector('#ipTabs').getBoundingClientRect().right), canvas: Math.round(window.__ifcp.view3d.canvas.getBoundingClientRect().width), box: Math.round(document.querySelector('#ip3dBox').getBoundingClientRect().width) }));
  check('at 375 px: the tabs and the 3D view fit, no horizontal scroll', phone3d.scroll[0] === phone3d.scroll[1] && phone3d.tabs <= 375 - 16 && phone3d.canvas === phone3d.box && phone3d.canvas >= 340, phone3d);
  if (process.env && process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/ifcp-375.png`, fullPage: true });

  // 12. The tools index lists the tool, without a horizontal scroll.
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(BASE + 'free-tools.html?lang=en');
    const card = await page.evaluate(() => { const a = document.querySelector('.ft-card[href="ifc-plans.html"]'); return a && a.closest('.ft-group').querySelector('.ft-group-title').innerText; });
    const scroll = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    check(`index at ${width} px: the card in Engineering offices, no horizontal scroll`, /engineering/i.test(card || '') && scroll[0] === scroll[1], { card, scroll });
  }

  // 13. Nothing external, no console errors.
  check('no external requests', external.length === 0, external);
  check('no console errors', errors.length === 0, errors);
  check(`timings ${JSON.stringify({ example: tExample, recut: tRecut, view3d: t3d })}`, true, null);
  return { pass: checks.filter(c => c.ok).length, fail: checks.filter(c => !c.ok).length, checks };
}
```

<!-- file: _tests/ifcplan/browser-check.cjs -->
```js
// Runs the IFC floor plans' browser checks in headless Chrome, for when the Playwright MCP is unavailable.
// Needs the repo root served on http://127.0.0.1:8793/ and playwright-core somewhere on this machine:
//   node _tests/ifcplan/browser-check.cjs
// Set PW_CORE to a playwright-core folder, or it is looked for in the npx cache. Chrome is used from its default
// install path (or CHROME). SHOT=<folder> also saves a screenshot at 375 px. BIG=<an .ifc outside the repo> adds the
// large-file timing of the 3D view. Headless Chrome draws WebGL on the GPU; GL=swiftshader draws it in software
// instead (for a machine without a usable GPU).
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
  const args = process.env.GL === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [];
  const browser = await chromium.launch({ executablePath: chrome, headless: true, args });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const r = await eval(fs.readFileSync(path.join(__dirname, 'browser-check.js'), 'utf8'))(page);
  for (const c of r.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : '  ' + JSON.stringify(c.got)}`);
  console.log(`${r.pass} passed, ${r.fail} failed`);
  await browser.close();
  process.exit(r.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
```

Run: `node _tests/extract.mjs $PLAN _tests/ifcplan/browser-check.js && node _tests/extract.mjs $PLAN _tests/ifcplan/browser-check.cjs && node -e "new Function(require('fs').readFileSync('_tests/ifcplan/browser-check.js','utf8')); console.log('syntax-ok')"`
Expected: two `wrote …` lines, then `syntax-ok`.

- [ ] **Step 2: Serve the repo and run every browser check**

Start three servers in the background from the repo root (Bash tool, `run_in_background`, `timeout` 7200000 so they outlive the runs):
- `python -m http.server 8793 --bind 127.0.0.1`
- `python -m http.server 8765 --bind 127.0.0.1`
- `python -m http.server 8811 --bind 127.0.0.1`

Run:
```bash
node _tests/ifcplan/browser-check.cjs 2>&1 | tail -3
node _tests/dwg/browser-check.cjs 2>&1 | tail -1
node _tests/coverage/browser-check.cjs 2>&1 | tail -1
node _tests/sidebar/browser-check.cjs 2>&1 | tail -1
```
Expected: `59 passed, 0 failed` (the line before it reads `PASS  timings {"example":…,"recut":…,"view3d":…}`, view3d about 100–150 ms), then `25 passed, 0 failed`, `52 passed, 0 failed`, `32 passed, 0 failed`.

The 19 new ifcplan checks, in order:
1. no three.js or `view3d.js` request before the 3D tab;
2. the example in 3D, tab click to first frame under 1 s, `three.module.js` and `view3d.js?v=20261103` from this site;
3. the heading `3D · Ισόγειο · cut at 1.10 m`, and the legend `IFC_WALL IFC_DOOR IFC_WINDOW IFC_COLUMN IFC_SLAB IFC_STAIR IFC_RAILING IFC_SPACE`;
4. the canvas has more than 5,000 non-background pixels;
5. the cut at Z 1.10 with the plan's six line layers;
6. in the Top view the cut shows the ground floor slab (`IfcSlab · IFC_SLAB · Πλάκα ισογείου · Ισόγειο`), and without the cut the roof (`… Πλάκα οροφής · Όροφος 1`); the two images differ;
7. with the cut off: `3D · whole model`, no cut lines;
8. a re-cut at 2.20 m moves the plane to Z 2.20;
9. a storey row moves it to 4.10 (Όροφος 1);
10. hover in Iso over the south wall: `IfcWall · IFC_WALL · Τοίχος Ν · Ισόγειο`;
11. IFC_WALL hidden from the legend: gone from the 3D meshes and cut lines, from the hover and from the plan's hit test; `aria-pressed="false"`;
12. the DXF still has 7 `IFC_WALL` polylines;
13. IFC_WALL back in both views;
14. ArrowLeft moves from the 3D tab to the plan tab;
15. GA: `ifcp_view3d {"result":"shown"}` once, `ifcp_3d_cut` off and on, `ifcp_layer_toggle {"layer":"IFC_WALL"}` twice, in order with the re-cuts and the download;
16. a new file disposes the scene (14 geometries, then 0) and shows the plan tab;
17. with `maxTriangles` 10: `This model is too large for the 3D view in this browser; the plans are unaffected.`, with GA `large`;
18. with WebGL stubbed away: `3D is not available in this browser.`, and the plan tab works;
19. at 375 px the tabs and the 3D canvas fit, with no sideways scroll.

If WebGL2 was missing in Task 0, run the ifcplan check as `GL=swiftshader node _tests/ifcplan/browser-check.cjs` (also 59/59).

- [ ] **Step 3: Look at it, and the large public sample (by hand, not committed)**

With the example loaded, open the 3D tab at 1280 px (`?lang=en`) and at 375 px (`?lang=el`), and check by eye:
- Iso shows the ground floor clipped at 1.10 m, with the dark plan lines on the cut walls, the door and window gaps, the column and the stair;
- unticking "Cut at the plan height" shows the closed house with its roof;
- at 375 px the toolbar wraps under the heading, and the canvas takes the full width.

Spec §9's 13 MB target was measured on `Ifc4_Revit_ARC.ifc` (public; 13.6 MB, IFC4, 351,817 triangles). It was downloaded outside the repo and run with `BIG=<its path> node _tests/ifcplan/browser-check.cjs` (60 checks):

| Run | 3D tab click to first frame | Worst frame while hovering |
|---|---|---|
| GPU (default) | 199 ms | 17 ms |
| `GL=swiftshader` | 205 ms | 17 ms |

Spec §9: under 3 s and under 50 ms. The worker packs it in 138 ms in Node.

- [ ] **Step 4: Commit, and stop the servers**

```bash
git add _tests/ifcplan/browser-check.js _tests/ifcplan/browser-check.cjs
git commit -F - <<'EOF'
IFC 3D view: browser check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb
EOF
for port in 8793 8765 8811; do pid=$(netstat -ano | grep ":$port .*LISTENING" | awk '{print $5}' | head -1); [ -n "$pid" ] && taskkill //PID $pid //F; done
netstat -ano | grep -E ":(8793|8765|8811) .*LISTENING" || echo "servers stopped"
```
Expected: the commit, and `servers stopped`.

- [ ] **Step 5: Run everything**

Run:
```bash
node --test $(git ls-files '_tests/**/*.test.js') 2>&1 | grep -E "^ℹ (pass|fail)"
node _tests/ifcplan/make-example.mjs --check
git diff --stat 7329f34 -- js/laser js/dwg js/coverage js/gcode js/mill js/vendor _src js/sidebar.js css/sidebar.css laser-dxf-checker.html dwg-quantities.html coverage-precheck.html milling-gcode-viewer.html gcode-viewer.html free-tools.html sitemap.xml llms.txt
git log --format=%B HEAD~10..HEAD | grep -c "^Claude-Session: https://claude.ai/code/session_01RiQhcUUfbg72VXx4eDYuEb$"
```
Expected: `ℹ pass 515`, `ℹ fail 0`; `same js/ifcplan/examples/example-house.ifc`; no diff output; `10` (one trailer per commit of Tasks 1–10).

---

### Task 11: Deploy day (stop before any push)

Not part of the replay. Aris names the day; merging and pushing `main` is his decision.

**Files:**
- Modify, on deploy day only: every `?v=20261103` (the page, `js/ifcplan/*.js`, `_tests/ifcplan/site.test.js`, `page3d.test.js`, `browser-check.js`), and the sitemap `lastmod` of `ifc-plans.html` with its pin in `site.test.js`.

- [ ] **Step 1: Pick a version not live elsewhere**

Pick `YYYYMMDD`, and grep first: `grep -rn "v=YYYYMMDD" --include=*.html --include=*.js --include=*.css . | grep -v "^./_docs/"` must print nothing.

- [ ] **Step 2: Swap the placeholder**

```bash
sed -i 's/v=20261103/v=YYYYMMDD/g' ifc-plans.html js/ifcplan/*.js _tests/ifcplan/site.test.js _tests/ifcplan/page3d.test.js _tests/ifcplan/browser-check.js
sed -i '/<loc>https:\/\/www.aidedcam.com\/ifc-plans.html<\/loc>/{n;s#<lastmod>[0-9-]*</lastmod>#<lastmod>YYYY-MM-DD</lastmod>#}' sitemap.xml
sed -i "s#<lastmod>2026-10-01</lastmod>'), 'with the lastmod placeholder'#<lastmod>YYYY-MM-DD</lastmod>'), 'with the lastmod placeholder'#" _tests/ifcplan/site.test.js
grep -rn "20261103" ifc-plans.html js/ifcplan _tests/ifcplan    # must print nothing
git diff --stat sitemap.xml                                        # sitemap.xml | 2 +-
```
`js/ifcplan/vendor/` holds no placeholder of its own, and the glob `js/ifcplan/*.js` leaves it alone. The second `sed` changes only the `<lastmod>` right under the `ifc-plans.html` `<loc>` (the other pages keep theirs); the third, the same date pinned in `site.test.js`'s first test. Run the Node tests and the four browser checks again (Task 10, Steps 2 and 5).

- [ ] **Step 3: Before and after the push**

Before: squash the branch (house pattern), and confirm that `git log -p main..HEAD | grep -i -E "<client names>"` prints nothing. After: on the live site, check the example in 3D, the cut on and off, and the hover on a wall (spec §12), with three.js loading from GitHub Pages.

---

## Replay

The plan was replayed task by task on a fresh worktree of 7329f34, with only this plan copied in (untracked): branch `scratch/ifc3d-replay`, created with `git worktree add ../aidedcam-page-ifc3d-replay -b scratch/ifc3d-replay 7329f34`. Only the plan's own commands were run, commits included: 10 commits for Tasks 1–10 (Task 0 commits nothing).
- **Every stated result appeared:**
  - the baseline 493 (ifcplan 74), an unused placeholder, `webgl2 true 154.0.8037.58` and three free ports;
  - the Node red and green steps of the ifcplan suites, in order: 74/1 → 75, 75/1 → 77, 77/1 → 82, 82/3 → 85, 80/1 → 87, 87/1 → 88, 87/2 → 89, 89/1 → 92, 92/4 → 96;
  - Task 1's grep (only the two laser imports in `ui.js`) and its 9-file stat (53 insertions, 33 deletions);
  - `syntax-ok`;
  - the browser checks: ifcplan `59 passed, 0 failed` three times (one with `GL=swiftshader`; the example's 3D in 130 ms each time), dwg 25, coverage 52, sidebar 32;
  - `BIG=Ifc4_Revit_ARC.ifc`: 60 passed, 3D in 255 ms, worst hover frame 17 ms;
  - `servers stopped`;
  - 515 in all, `same` for the example, an empty diff for the other tools, and `10` trailers.
- **The replay matches the validated branch:** `git diff --stat scratch/ifc3d-validate scratch/ifc3d-replay -- . ':(exclude)_docs'` is empty, so every file is byte-identical to the validated one. (The validated branch has three extra fix-up commits from building it; their content is in the blocks above.)
- Both scratch worktrees are left in place: `../aidedcam-page-ifc3d-validate` (`scratch/ifc3d-validate`) and `../aidedcam-page-ifc3d-replay` (`scratch/ifc3d-replay`).
