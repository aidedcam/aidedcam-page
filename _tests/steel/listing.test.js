import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout has CRLF
const between = (s, from, to) => s.slice(s.indexOf(from), s.indexOf(to, s.indexOf(from)));

test('the tools index lists the steel take-off in its own group, Steel and building products', () => {
  const ft = read('../../free-tools.html');
  assert.ok(ft.includes('<a class="ft-card" href="steel-takeoff.html">'));
  const steel = between(ft, 'data-i18n="ft.group.steel"', '</section>');
  assert.ok(steel.includes('href="steel-takeoff.html"'), 'in the Steel and building products group');
  assert.equal((steel.match(/class="ft-card"/g) || []).length, 1, 'one card so far');
  for (const k of ['ft.group.steel', 'ft.steel.title', 'ft.steel.text']) assert.equal(ft.split(`"${k}":`).length - 1, 3, k);
  const strings = [...ft.matchAll(/"ft\.(?:group\.steel|steel\.title|steel\.text)": "([^"]*)"/g)].map(m => m[1]);
  assert.ok(strings.every(s => !/δωρεάν|\bfree\b|gratuit/i.test(s)), 'no "free" in the visible text');
  assert.ok(!strings.slice(6).some(s => s.includes("'")), 'the Italian uses ’');
});

test('the sitemap and llms.txt list it', () => {
  const sm = read('../../sitemap.xml');
  assert.ok(sm.includes('<loc>https://www.aidedcam.com/steel-takeoff.html</loc>\n    <lastmod>2026-10-01</lastmod>'), 'with the lastmod placeholder');
  assert.ok(read('../../llms.txt').includes('- Steel take-off and galvanizing quote (https://www.aidedcam.com/steel-takeoff.html)'));
});
