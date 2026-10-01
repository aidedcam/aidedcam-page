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
  assert.ok(ui.includes('import(`./view3d.js?v=20261003${view3dTries ?'), 'loaded with the first 3D tab, the query unchanged; a retry adds only a fragment');
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

test('the final-review fixes: one placeTip, dispose on a lost context, the import-failure guard, the heading unit, the aria label', () => {
  const ui = read('../../js/ifcplan/ui.js'), view = read('../../js/ifcplan/view3d.js'), css = read('../../css/tools.css');
  assert.equal(ui.match(/function placeTip\(/g).length, 1);
  assert.equal(ui.match(/placeTip\(/g).length, 3, 'defined once, used by the 3D and the plan hover');
  assert.ok(!ui.includes('offsetWidth > box.width') || ui.match(/offsetWidth > box\.width/g).length === 1, 'the placement block exists once');
  assert.ok(/function lost3d\(\) \{[^}]*view3d\.dispose\(\)/.test(ui), 'a lost context disposes the view');
  assert.ok(!ui.includes('view3d.canvas.remove()'));
  assert.ok(ui.includes("if (state.file === f && f.three === three) { done3d(f, 'failed'); f.three = null; }"), 'a failed import is guarded and retried');
  assert.ok(ui.includes("t(state.cut3d ? 'ip.aria.3d' : 'ip.aria.3d.whole')"), 'the aria label follows the cut');
  for (const call of ["$('ip3dTip').hidden = true;                                     // a tooltip from before"]) assert.ok(ui.includes(call));
  assert.ok(/webglcontextlost', \(\) => \{ stopHover\(\); onLost\(\); \}/.test(view));
  assert.ok(/function destroy\(\) \{[\s\S]*cancelAnimationFrame\(frame\)[\s\S]*observer\.disconnect\(\)[\s\S]*controls\.dispose\(\)[\s\S]*clear\(\)[\s\S]*pickMaterial\.dispose\(\)[\s\S]*renderer\.dispose\(\)[\s\S]*canvas\.remove\(\)/.test(view));
  assert.ok(/function resize\(\) \{[^}]*renderer\.setPixelRatio\(Math\.min\(window\.devicePixelRatio \|\| 1, 2\)\)[^}]*renderer\.setSize/.test(view), 'the ratio is re-read on every resize');
  assert.ok(css.includes('.ip-3d-head #ip3dHead { text-transform: none;'), 'the unit keeps its case');
});
