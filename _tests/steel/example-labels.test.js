// Every tool's example button names the format it loads (brief 2026-10-02): the strings in el, en and it, and the
// inline Greek of each page equal to its el string.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = p => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const strings = (file, name) => { const window = {}; vm.runInNewContext(read(file), { window }); return window[name]; };

const TOOLS = [
  { key: 'gv.example', file: 'js/gcode/i18n-viewer.js', pages: ['gcode-viewer.html', 'milling-gcode-viewer.html'], el: 'Φόρτωση παραδείγματος G-code', en: 'Load G-code example', it: 'Carica esempio G-code' },
  { key: 'lc.example', file: 'js/laser/i18n-laser.js', pages: ['laser-dxf-checker.html'], el: 'Φόρτωση παραδείγματος DXF/DWG', en: 'Load DXF/DWG example', it: 'Carica esempio DXF/DWG' },
  { key: 'dq.example', file: 'js/dwg/i18n-dwg.js', pages: ['dwg-quantities.html'], el: 'Φόρτωση παραδείγματος DWG', en: 'Load DWG example', it: 'Carica esempio DWG' },
  { key: 'cp.example', file: 'js/coverage/i18n-coverage.js', pages: ['coverage-precheck.html'], el: 'Φόρτωση παραδείγματος DXF', en: 'Load DXF example', it: 'Carica esempio DXF' },
  { key: 'ip.example', file: 'js/ifcplan/i18n-ifcplan.js', pages: ['ifc-plans.html'], el: 'Φόρτωση παραδείγματος IFC', en: 'Load IFC example', it: 'Carica esempio IFC' },
  { key: 'st.example', file: 'js/steel/i18n-steel.js', pages: ['steel-takeoff.html'], el: 'Φόρτωση παραδείγματος NC1', en: 'Load NC1 example', it: 'Carica esempio NC1' },
  { key: 'st.example.ifc', file: 'js/steel/i18n-steel.js', pages: ['steel-takeoff.html'], el: 'Φόρτωση παραδείγματος IFC', en: 'Load IFC example', it: 'Carica esempio IFC' },
];
const bag = file => strings(file, { 'js/gcode/i18n-viewer.js': 'GV_VIEWER_I18N', 'js/laser/i18n-laser.js': 'LC_I18N', 'js/dwg/i18n-dwg.js': 'DQ_I18N', 'js/coverage/i18n-coverage.js': 'CP_I18N', 'js/ifcplan/i18n-ifcplan.js': 'IP_I18N', 'js/steel/i18n-steel.js': 'ST_I18N' }[file]);

for (const tool of TOOLS) {
  test(`${tool.key}: el, en and it name the format`, () => {
    const s = bag(tool.file);
    assert.equal(s.el[tool.key], tool.el);
    assert.equal(s.en[tool.key], tool.en);
    assert.equal(s.it[tool.key], tool.it);
  });
  for (const page of tool.pages) {
    test(`${page}: the inline Greek of ${tool.key} equals its el string`, () => {
      const m = new RegExp(`data-i18n="${tool.key.replace(/\./g, '\\.')}"[^>]*>([^<]*)<`).exec(read(page));
      assert.ok(m, 'the button');
      assert.equal(m[1], tool.el);
    });
  }
}

test('steel take-off: both example buttons are gv-btn, side by side', () => {
  const page = read('steel-takeoff.html');
  assert.ok(page.includes('<button type="button" class="gv-btn" id="stExampleIfc" data-i18n="st.example.ifc">'));
  const a = page.indexOf('id="stExample"'), b = page.indexOf('id="stExampleIfc"');
  assert.ok(a > 0 && b > a && !page.slice(a, b).includes('</div>'), 'no wrapper between the two buttons');
});
