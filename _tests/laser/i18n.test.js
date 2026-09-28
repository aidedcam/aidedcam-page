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

test('the example order is committed and the controller loads it', () => {
  const ui = read('../../js/laser/ui.js');
  for (const f of ['bracket.dxf', 'flange.dxf', 'cover.dxf', 'spacer.dwg']) {
    assert.ok(readFileSync(new URL(`../../js/laser/examples/${f}`, import.meta.url)).length > 0, f);
    assert.ok(ui.includes(`'${f}'`), `ui.js does not load ${f}`);
  }
});

test('the tools index, the sitemap and llms.txt list the laser check', () => {
  const ft = read('../../free-tools.html');
  assert.ok(ft.includes('<a class="ft-card" href="laser-dxf-checker.html">'));
  assert.equal(ft.split('"ft.laser.text":').length - 1, 3, 'one card text per language');
  assert.ok(read('../../sitemap.xml').includes('<loc>https://www.aidedcam.com/laser-dxf-checker.html</loc>'));
  assert.ok(read('../../llms.txt').includes('- Laser DXF check (https://www.aidedcam.com/laser-dxf-checker.html)'));
});
