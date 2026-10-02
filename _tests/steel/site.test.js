import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout has CRLF
const between = (s, from, to) => s.slice(s.indexOf(from), s.indexOf(to, s.indexOf(from)));

test('the page: canonical, the web-ifc notice with its link, the nominal-values note, no Eyeshot, no engine up front', () => {
  const page = read('../../steel-takeoff.html');
  assert.ok(page.includes('<link rel="canonical" href="https://www.aidedcam.com/steel-takeoff.html" />'));
  assert.ok(page.includes('<span data-i18n="st.notice">Ανάγνωση IFC: web-ifc (ThatOpen Company), MPL-2.0,</span> <a href="https://github.com/ThatOpen/engine_web-ifc" rel="noopener" data-i18n="st.notice.link">'));
  assert.ok(page.includes('data-i18n="st.indicative"'));
  assert.ok(page.includes('<p class="gv-eyebrow" data-i18n="st.eyebrow">Εργαλείο</p>'));
  assert.ok(!/devDept|Eyeshot/i.test(page));
  assert.ok(!/src="[^"]*vendor\//.test(page), 'web-ifc loads in the worker, three.js with the first piece shown');
  for (const f of readdirSync(new URL('../../js/steel/', import.meta.url)).filter(n => n.endsWith('.js'))) assert.ok(!/eyeshot|devdept|dotnet/i.test(read(`../../js/steel/${f}`)), f);
});

test('consent, GA and the language switcher are those of the IFC floor plans page', () => {
  const a = read('../../ifc-plans.html'), b = read('../../steel-takeoff.html');
  for (const [from, to] of [['<!-- Google Analytics', '</script>'], ['<!-- COOKIE CONSENT BANNER', '  <script src='], ["    // The tool's strings first", '  </script>'], ['<div class="lang-switcher">', '</div>']]) {
    const x = between(a, from, to).replace('IP_I18N', 'XX_I18N'), y = between(b, from, to).replace('ST_I18N', 'XX_I18N');
    assert.ok(x.length > 20, from);
    assert.equal(y, x, from);
  }
  const strings = s => [...s.matchAll(/"(cookie_[a-z_]+|footer\.[a-z_]+)": "([^"]*)"/g)].map(m => m[0]).join('\n');
  assert.equal(strings(b), strings(a));
});

test('every steel module URL carries the deploy placeholder ?v=20261005; shared modules keep their own', () => {
  const page = read('../../steel-takeoff.html');
  for (const u of ['css/tools.css?v=20261005', 'js/steel/i18n-steel.js?v=20261005', 'js/steel/ui.js?v=20261005', 'css/sidebar.css?v=20261005', 'js/sidebar.js?v=20261005']) assert.ok(page.includes(u), u);
  const SHARED = { '../laser/bridge.js': '20261001', '../dwg/xlsx.js': '20260930', '../ifcplan/model.js': '20261003', '../ifcplan/vendor/web-ifc/web-ifc-api.js': '20261003' };
  let n = 0;
  for (const f of readdirSync(new URL('../../js/steel/', import.meta.url)).filter(x => x.endsWith('.js'))) {
    const src = read(`../../js/steel/${f}`);
    for (const m of src.matchAll(/(?:from |import\()'(\.[^']+)'/g)) {
      n++;
      const u = m[1], base = u.replace(/\?.*$/, '');
      if (u.includes('/gcode/shell/') || u.includes('/vendor/three/')) assert.ok(!u.includes('?v='), `${f}: ${u}`);
      else if (SHARED[base]) assert.ok(u.endsWith(`?v=${SHARED[base]}`), `${f}: ${u}`);
      else assert.ok(u.startsWith('./') && u.endsWith('?v=20261005'), `${f}: ${u}`);
    }
  }
  assert.ok(n >= 30, `${n} imports`);
  const ui = read('../../js/steel/ui.js'), worker = read('../../js/steel/worker.js');
  assert.ok(ui.includes("new URL('./worker.js?v=20261005', import.meta.url)"));
  assert.ok(ui.includes('./examples/${path}?v=20261005'));
  assert.ok(ui.includes('import(`./view3d.js?v=20261005'));
  assert.ok(worker.includes('`../ifcplan/vendor/web-ifc/${file}?v=20261003`'), 'the same web-ifc URLs as the IFC floor plans tool');
});

test('three.js loads only with the 3D view; web-ifc only in the worker and the reader it runs', () => {
  const page = read('../../steel-takeoff.html'), ui = read('../../js/steel/ui.js');
  assert.ok(!page.includes('vendor/three') && !/from '\.\/view3d\.js/.test(ui));
  for (const f of readdirSync(new URL('../../js/steel/', import.meta.url)).filter(x => x.endsWith('.js'))) {
    const src = read(`../../js/steel/${f}`);
    assert.equal(src.includes('vendor/three'), f === 'view3d.js', `${f}: three.js`);
    assert.equal(src.includes('web-ifc-api'), f === 'worker.js', `${f}: web-ifc`);
    assert.equal(src.includes('../ifcplan/model.js'), f === 'worker.js' || f === 'ifcread.js', `${f}: the plans tool's model`);
  }
});

test('the shared files are reused unchanged: no steel code in the bridge, the Excel writer or the plans tool', () => {
  for (const f of ['../../js/laser/bridge.js', '../../js/dwg/xlsx.js', '../../js/ifcplan/model.js', '../../js/ifcplan/worker.js']) assert.ok(!/steel/i.test(read(f)), f);
});
