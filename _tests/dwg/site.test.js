import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

test('the tools index, the sitemap and llms.txt list the DWG quantities tool', () => {
  const ft = read('../../free-tools.html');
  assert.ok(ft.includes('<a class="ft-card" href="dwg-quantities.html">'));
  assert.equal(ft.split('"ft.dwgq.text":').length - 1, 3, 'one card text per language');
  assert.ok(read('../../sitemap.xml').includes('<loc>https://www.aidedcam.com/dwg-quantities.html</loc>'));
  assert.ok(read('../../llms.txt').includes('- DWG quantities (https://www.aidedcam.com/dwg-quantities.html)'));
});

test('the page carries the devDept notice verbatim and loads no engine up front', () => {
  const page = read('../../dwg-quantities.html');
  assert.ok(page.includes('Portion of copyright © devDept Software S.r.l. All Rights Reserved.'));
  assert.ok(!/src="[^"]*engine\//.test(page), 'the engine loads in the worker, on the first file');
});
