import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout has CRLF
const ft = read('../../free-tools.html');
const sandbox = { module: { exports: {} } };
vm.runInNewContext(read('../../js/sidebar.js'), sandbox);
const { TOOLS, ICONS } = JSON.parse(JSON.stringify(sandbox.module.exports));
const GROUP = { lathe: 'cnc', mill: 'cnc', laser: 'sheet', dwgq: 'eng', coverage: 'eng', ifcplans: 'eng', steel: 'steel' };
const rows = [...ft.matchAll(/<a class="ft-row" href="([^"]+)">([\s\S]*?)<\/a>/g)].map(m => ({ href: m[1], html: m[2] }));
const esc = k => k.replace(/\./g, '\\.');
const el = k => (ft.match(new RegExp(`"${esc(k)}": "([^"]*)"`)) || [])[1];   // the el dictionary comes first

test('the page is one list of seven rows, in the sidebar order, each one a link to its tool', () => {
  assert.equal(rows.length, 7);
  assert.deepEqual(rows.map(r => r.href), TOOLS.map(t => t.href));
  assert.deepEqual(rows.map(r => r.html.match(/data-i18n="ft\.([a-z]+)\.title"/)[1]), TOOLS.map(t => t.id));
  assert.equal((ft.match(/<section class="ft-list"/g) || []).length, 1);
});

test('each row carries the sidebar icon inline, hidden from assistive tech', () => {
  for (const [i, t] of TOOLS.entries()) {
    const svg = rows[i].html.match(/<span class="ft-icon"><svg ([^>]*)>([\s\S]*?)<\/svg><\/span>/);
    assert.ok(svg, t.id);
    assert.equal(svg[2], ICONS[t.id], `${t.id}: path data equals ICONS`);
    assert.ok(svg[1].includes('aria-hidden="true"') && svg[1].includes('stroke="currentColor"') && svg[1].includes('viewBox="0 0 24 24"'), t.id);
  }
});

test('each row has its category label, title, description and open text, inline Greek equal to el', () => {
  for (const [i, t] of TOOLS.entries()) {
    const h = rows[i].html;
    const part = (tag, key) => { const m = h.match(new RegExp(`<${tag}[^>]*data-i18n="${esc(key)}">([^<]*)</`)); assert.ok(m, `${t.id} ${key}`); return m[1]; };
    for (const [tag, key] of [['p', `ft.group.${GROUP[t.id]}`], ['h2', `ft.${t.id}.title`], ['p', `ft.${t.id}.text`], ['span', 'ft.open']]) {
      assert.equal(part(tag, key), el(key), `${t.id} ${key}`);
    }
    assert.ok(/<p class="gv-eyebrow ft-cat"/.test(h), `${t.id}: eyebrow label`);
  }
});

test('the group headings and their grid are gone, the group strings stay in all three languages', () => {
  assert.ok(!/ft-group|ft-groups|ft-cards|ft-card\b/.test(ft), 'no old markup or style');
  assert.ok(!/<style>/.test(ft), 'no page-only style block');
  for (const g of ['cnc', 'sheet', 'eng', 'steel']) assert.equal(ft.split(`"ft.group.${g}":`).length - 1, 3, g);
});
