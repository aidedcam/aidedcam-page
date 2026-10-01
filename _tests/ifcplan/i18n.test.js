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
  const keys = [...WARNINGS.map(id => `ip.warn.${id}`), ...ERRORS.map(id => `ip.err.${id}`), ...Object.keys(UNITS).map(u => `ip.unit.${u}`)];
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
