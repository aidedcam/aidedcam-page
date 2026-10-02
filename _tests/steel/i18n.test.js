import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { GRADES } from '../../js/steel/quote.js';
import { RATE_KEYS } from '../../js/steel/state.js';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const ph = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
function toolStrings() {
  const window = {};
  vm.runInNewContext(read('../../js/steel/i18n-steel.js'), { window });
  return window.ST_I18N;
}

// Ids that reach the strings through a computed key.
const COMPUTED = [
  ...['read', 'read.ifczip', 'read.ifcxml', 'schema', 'limit', 'timeout', 'engine', 'nosteel', 'nonc1', 'nowasm'].map(k => `st.err.${k}`),
  ...['notnc1', 'broken', 'ifcalone', 'read', 'zip.encrypted', 'zip.zip64', 'zip.method', 'zip.notzip'].map(k => `st.skip.${k}`),
  ...['galv', 'zinc', 'paint', 'steel', ...GRADES.map(g => `steel.${g}`)].map(k => `st.cost.${k}`),
  ...['noweight', 'noarea', 'nolength', 'noqty', 'geometry', 'notsteel', 'check'].map(k => `st.warn.${k}`),
  ...['header', 'section', 'contour', 'profile', 'geometry'].map(k => `st.from.${k}`),
  ...['fits', 'double', 'no'].map(k => `st.bath.${k}`),
  ...['top', 'front', 'side', 'iso', 'loading', 'failed', 'nogl', 'noshape', 'stale', 'large', 'piece', 'model'].map(k => `st.3d.${k}`),
  ...RATE_KEYS.map(k => `st.set.${k}`), ...GRADES.map(g => `st.set.steel.${g}`),
  ...['kg', 'length', 'mark'].map(k => `st.sort.${k}`),
];

test('tool strings: only st.* keys, the same keys and placeholders in el, en and it, none empty', () => {
  const s = toolStrings();
  const en = Object.keys(s.en).sort();
  assert.ok(en.length >= 180, `${en.length} keys`);
  assert.ok(en.every(k => k.startsWith('st.')));
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
  for (const k of COMPUTED) for (const l of ['el', 'en', 'it']) assert.ok(k in s[l], `${l} missing ${k}`);
});

test('every literal st.* key the modules use exists', () => {
  const s = toolStrings();
  const dir = new URL('../../js/steel/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'i18n-steel.js').map(f => readFileSync(new URL(f, dir), 'utf8'));
  let used = 0;
  for (const src of files) {
    for (const m of src.matchAll(/['"`](st\.[A-Za-z0-9.]+[A-Za-z0-9])['"`]/g)) { used++; assert.ok(m[1] in s.en, `${m[1]} has no string`); }
  }
  assert.ok(used >= 40, `${used} keys found`);
});

test('the 3D toggle strings, in the three languages', () => {
  const s = toolStrings();
  assert.equal(s.el['st.3d.piece'], 'Μόνο αυτό');
  assert.equal(s.en['st.3d.piece'], 'This piece only');
  assert.equal(s.it['st.3d.piece'], 'Solo questo pezzo');
});

test('the Italian uses the typographic apostrophe and the formal voi; no "free" in visible text', () => {
  const s = toolStrings();
  for (const [k, v] of Object.entries(s.it)) {
    assert.ok(!v.includes("'"), `it ${k} has a straight apostrophe`);
    assert.ok(!/\b(tu|tuo|tua|tuoi|tue|ti|Trascina|Scegli|Prova|Esporta|Controlla|Premi|Verifica|Apri il)\b/.test(v), `it ${k} is not formal: ${v}`);
  }
  assert.ok(Object.values(s.it).some(v => /\b(vostro|vostre|Trascinate|premete)\b/.test(v)));
  for (const l of ['el', 'en', 'it']) for (const [k, v] of Object.entries(s[l])) assert.ok(!/δωρεάν|\bfree\b|gratuit/i.test(v), `${l} ${k}`);
});

test('the wording of spec §6 and §7 in English', () => {
  const { en } = toolStrings();
  assert.equal(en['st.eyebrow'], 'Tool');
  assert.equal(en['st.privacy'], 'Your files stay on your computer; nothing is uploaded.');
  assert.equal(en['st.indicative'], "Figures from the files' nominal values. Check against the shop drawings.");
  assert.deepEqual(['st.open', 'st.folder', 'st.example', 'st.xlsx', 'st.print', 'st.skip.notnc1'].map(k => en[k]), ['Open files', 'Open folder', 'Load NC1 example', 'Download Excel', 'Print / PDF', 'not an NC1 file']);
  assert.ok(en['st.err.nosteel'].startsWith('No steel members found'));
  assert.equal(toolStrings().el['st.eyebrow'], 'Εργαλείο');
  assert.equal(toolStrings().it['st.eyebrow'], 'Strumento');
});
