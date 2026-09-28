import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const ph = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');

// The tool's strings file, evaluated the way the browser does.
function toolStrings() {
  const window = {};
  vm.runInNewContext(read('../../js/dwg/i18n-dwg.js'), { window });
  return window.DQ_I18N;
}

// Ids that reach the page from the engine (contract) and are looked up with a computed key.
const WARNINGS = ['units-assumed', 'units-setting', 'units-override', 'units-override-none', 'xrefs', 'bad-area', 'inside-blocks', 'not-measured', 'simplified'];
const ERRORS = ['read', 'version', 'limit', 'timeout', 'engine', 'empty', 'blank'];
const KINDS = ['line', 'arc', 'circle', 'polyline', 'spline', 'ellipse', 'hatch', 'insert'];
const NOT_MEASURED = ['text', 'dim', 'solid3d', 'mesh', 'proxy', 'other', 'insideBlocks', 'xrefs'];
const UNITS = ['auto', 'mm', 'cm', 'm', 'inch', 'ft'];

test('tool strings: only dq.* keys, the same keys and placeholders in el, en and it', () => {
  const s = toolStrings();
  const en = Object.keys(s.en).sort();
  assert.ok(en.length >= 100, `${en.length} keys`);
  assert.ok(en.every(k => k.startsWith('dq.')));
  assert.deepEqual(Object.keys(s.el).sort(), en);
  assert.deepEqual(Object.keys(s.it).sort(), en);
  for (const k of en) {
    assert.equal(ph(s.el[k]), ph(s.en[k]), `el ${k}`);
    assert.equal(ph(s.it[k]), ph(s.en[k]), `it ${k}`);
    for (const l of ['el', 'en', 'it']) assert.ok(String(s[l][k]).trim().length > 0, `${l} ${k} is empty`);
  }
  assert.equal(ph(s.en['dq.engine.loading']), 'pct');
  assert.equal(ph(s.en['dq.warn.units-setting']), 'units');
});

test('every id the engine can send has a string in every language', () => {
  const s = toolStrings();
  const keys = [
    ...WARNINGS.map(id => `dq.warn.${id}`), ...ERRORS.map(id => `dq.err.${id}`), ...KINDS.map(k => `dq.kind.${k}`),
    ...NOT_MEASURED.map(k => `dq.nm.${k}`), ...UNITS.map(u => `dq.unit.${u}`),
  ];
  for (const k of keys) for (const l of ['el', 'en', 'it']) assert.ok(k in s[l], `${l} missing ${k}`);
});

test('every literal dq.* key the modules use exists', () => {
  const s = toolStrings();
  const dir = new URL('../../js/dwg/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'i18n-dwg.js');
  assert.ok(files.length >= 3, files.join(','));
  let used = 0;
  for (const f of files) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    for (const m of src.matchAll(/['"`](dq\.[A-Za-z0-9.-]+[A-Za-z0-9])['"`]/g)) {
      used++;
      assert.ok(m[1] in s.en, `${f} uses ${m[1]}, which has no string`);
    }
  }
  assert.ok(used >= 15, `${used} keys found`);
});

test('the Italian uses the typographic apostrophe', () => {
  const s = toolStrings();
  for (const [k, v] of Object.entries(s.it)) assert.ok(!v.includes("'"), `it ${k} has a straight apostrophe`);
});
