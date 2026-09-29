import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { ROLES, LEVELS } from '../../js/coverage/mapping.js';
import { ARTICLES } from '../../js/coverage/rules.js';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const ph = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');

function toolStrings() {
  const window = {};
  vm.runInNewContext(read('../../js/coverage/i18n-coverage.js'), { window });
  return window.CP_I18N;
}

// Ids that reach the strings through a computed key.
const WARNINGS = ['open', 'bad', 'no-level', 'balcony-far', 'level-ambiguous', 'duplicate-outline', 'nested-level', 'units-check', 'sk-high', 'no-cover', 'union-failed', 'no-levels', 'pilotis-small', 'attic-alone', 'bsmt-not-basement', 'not-egsa'];
const ERRORS = ['read', 'version', 'limit', 'timeout', 'engine', 'empty', 'blank', 'nooutlines'];
const NOTES = ['bsmt-half', 'in-basement', 'bsmt-rest', 'in-attic', 'attic-stair', 'attic-half', 'pilotis-ok', 'pilotis-small', 'mezz', 'balcony', 'bsmt-not-basement', 'capsUnchecked', 'parking'];
const UNITS = ['mm', 'cm', 'm', 'inch', 'ft'];

test('tool strings: only cp.* keys, the same keys and placeholders in el, en and it', () => {
  const s = toolStrings();
  const en = Object.keys(s.en).sort();
  assert.ok(en.length >= 200, `${en.length} keys`);
  assert.ok(en.every(k => k.startsWith('cp.')));
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
  const keys = [
    ...WARNINGS.map(id => `cp.warn.${id}`), ...ERRORS.map(id => `cp.err.${id}`), ...NOTES.map(id => `cp.note.${id}`),
    ...[...ROLES, 'basementRest', 'atticRest'].map(r => `cp.role.${r}`), ...LEVELS.map(lv => `cp.level.${lv}`),
    ...Object.keys(ARTICLES).map(a => `cp.art.${a}`), ...UNITS.map(u => `cp.unit.${u}`),
    ...['file', 'setting', 'assumed', 'override'].map(u => `cp.units.src.${u}`),
    ...['ydom', 'sworn'].map(b => `cp.block.${b}`), ...['plot-missing', 'plot-many'].map(b => `cp.block.${b}`),
  ];
  for (const k of keys) for (const l of ['el', 'en', 'it']) assert.ok(k in s[l], `${l} missing ${k}`);
});

test('every literal cp.* key the modules and the page use exists', () => {
  const s = toolStrings();
  const dir = new URL('../../js/coverage/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'i18n-coverage.js').map(f => readFileSync(new URL(f, dir), 'utf8'));
  files.push(read('../../coverage-precheck.html'));
  let used = 0;
  for (const src of files) {
    for (const m of src.matchAll(/['"`](cp\.[A-Za-z0-9.-]+[A-Za-z0-9])['"`]/g)) { used++; assert.ok(m[1] in s.en, `${m[1]} has no string`); }
  }
  assert.ok(used >= 80, `${used} keys found`);
});

test('the Italian uses the typographic apostrophe', () => {
  const s = toolStrings();
  for (const [k, v] of Object.entries(s.it)) assert.ok(!v.includes("'"), `it ${k} has a straight apostrophe`);
});

test('Greek legal terms stay in Greek in the English and Italian roles and figures', () => {
  const s = toolStrings();
  for (const k of ['cp.role.plot', 'cp.role.cover', 'cp.role.semiopen', 'cp.role.pilotis', 'cp.fig.coverage', 'cp.fig.total', 'cp.block.sworn']) {
    for (const l of ['en', 'it']) assert.ok(/[Ͱ-Ͽ]/.test(s[l][k]), `${l} ${k}: ${s[l][k]}`);
  }
});

test('the page carries the Greek strings inline, as the page starts in Greek', () => {
  const s = toolStrings();
  const page = read('../../coverage-precheck.html');
  for (const m of page.matchAll(/data-i18n="(cp\.[^"]+)"[^>]*>([^<]*)</g)) assert.equal(m[2], s.el[m[1]], m[1]);
});
