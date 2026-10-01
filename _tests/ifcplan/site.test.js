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

test('every new asset URL carries the deploy placeholder ?v=20261001, and the shared modules are reused unchanged', () => {
  const page = read('../../ifc-plans.html');
  for (const u of ['css/tools.css?v=20261001', 'js/ifcplan/i18n-ifcplan.js?v=20261001', 'js/ifcplan/ui.js?v=20261001']) assert.ok(page.includes(u), u);
  for (const f of ['ui.js', 'worker.js', 'model.js', 'dxf.js', 'drawing.js', 'state.js']) {
    const src = read(`../../js/ifcplan/${f}`);
    for (const m of src.matchAll(/from '(\.[^']+)'/g)) if (!m[1].includes('/gcode/shell/')) assert.ok(m[1].endsWith('?v=20261001'), `${f}: ${m[1]}`);
  }
  const ui = read('../../js/ifcplan/ui.js'), worker = read('../../js/ifcplan/worker.js');
  assert.ok(ui.includes("new URL('./worker.js?v=20261001', import.meta.url)"));
  assert.ok(ui.includes("from '../laser/bridge.js?v=20261001'") && ui.includes("from '../laser/zip.js?v=20261001'"));
  assert.ok(ui.includes('./examples/${EXAMPLE}?v=20261001'));
  assert.ok(worker.includes("'./vendor/web-ifc/web-ifc-api.js?v=20261001'") && worker.includes('`./vendor/web-ifc/${file}?v=20261001`'));
  assert.ok(!read('../../js/laser/bridge.js').includes('ifcplan') && !read('../../js/laser/zip.js').includes('ifcplan'));
});
