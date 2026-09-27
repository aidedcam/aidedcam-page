import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { SEVERITY } from '../../js/gcode/checks.js';
import { MILL_SEVERITY } from '../../js/mill/checks.js';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

// The strings a page really uses: the shared viewer file, then the page's inline block (which
// merges them), evaluated the way the browser does.
export function pageTranslations(pagePath) {
  const html = read(pagePath);
  const window = {};
  vm.runInNewContext(read('../../js/gcode/i18n-viewer.js'), { window });
  const start = html.indexOf('    var translations = {');
  const end = html.indexOf('    window.GV_I18N = translations;');
  const box = {};
  vm.runInNewContext(html.slice(start, end) + '\nbox.t = translations;', { window, box, Object });
  return { html, t: box.t, shared: window.GV_VIEWER_I18N };
}

const usedKeys = html => [...html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)].map(m => m[1]);

test('shared viewer strings: only gv.* keys, the same set in el, en and it', () => {
  const { shared } = pageTranslations('../../gcode-viewer.html');
  const en = Object.keys(shared.en).sort();
  assert.ok(en.length > 50);
  assert.ok(en.every(k => k.startsWith('gv.')));
  assert.deepEqual(Object.keys(shared.el).sort(), en);
  assert.deepEqual(Object.keys(shared.it).sort(), en);
});

test('lathe page: the merged strings match across languages and cover every key the page uses', () => {
  const { html, t } = pageTranslations('../../gcode-viewer.html');
  const en = Object.keys(t.en).sort();
  assert.ok(en.length >= 108, `${en.length} keys`);
  assert.deepEqual(Object.keys(t.el).sort(), en);
  assert.deepEqual(Object.keys(t.it).sort(), en);
  for (const k of usedKeys(html)) assert.ok(k in t.en, `missing ${k}`);
  for (const id of Object.keys(SEVERITY)) assert.ok(`gv.check.${id}` in t.en, `missing gv.check.${id}`);
});

test('the page keeps its own title, lede, CTA and survey inline (they differ per viewer)', () => {
  const { shared } = pageTranslations('../../gcode-viewer.html');
  for (const k of ['gv.title', 'gv.lede', 'gv.cta.text', 'gv.survey.q']) assert.ok(!(k in shared.en), `${k} should stay inline`);
});

test('placeholders match across languages in the shared strings', () => {
  const { shared } = pageTranslations('../../gcode-viewer.html');
  const ph = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
  assert.equal(ph(shared.en['gv.mill.readout']), 'line,x,y,z');          // the check itself works
  for (const k of Object.keys(shared.en)) {
    assert.equal(ph(shared.el[k]), ph(shared.en[k]), `el ${k}`);
    assert.equal(ph(shared.it[k]), ph(shared.en[k]), `it ${k}`);
  }
});

test('milling page: the merged strings match across languages and cover every key and check id it uses', () => {
  const { html, t } = pageTranslations('../../milling-gcode-viewer.html');
  const en = Object.keys(t.en).sort();
  assert.deepEqual(Object.keys(t.el).sort(), en);
  assert.deepEqual(Object.keys(t.it).sort(), en);
  for (const k of usedKeys(html)) assert.ok(k in t.en, `missing ${k}`);
  for (const id of [...Object.keys(MILL_SEVERITY), 'more']) assert.ok(`gv.mcheck.${id}` in t.en, `missing gv.mcheck.${id}`);
  for (const k of ['gv.mill.readout', 'gv.mill.dims', 'gv.mill.playpos', 'gv.mill.isolated', 'gv.mill.progress', 'gv.mill.nowebgl',
    'gv.mill.lathe.q', 'gv.mill.lathe.go', 'gv.handoff.big', 'gv.aria.view', 'gv.mill.play', 'gv.mill.pause', 'gv.mill.rowtip', 'gv.mill.offsets']) {
    assert.ok(k in t.en, `missing ${k}`);
  }
  assert.equal(t.en['gv.title'], 'Milling G-code viewer');
});

test('tools index: every key it uses exists in el, en and it (it loads no shared viewer strings)', () => {
  const { html, t } = pageTranslations('../../free-tools.html');
  assert.ok(!html.includes('i18n-viewer.js'));
  for (const k of usedKeys(html)) for (const l of ['el', 'en', 'it']) assert.ok(k in t[l], `${l} missing ${k}`);
});
