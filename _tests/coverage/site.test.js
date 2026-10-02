import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout has CRLF

test('the tools index, the sitemap and llms.txt list the coverage pre-check', () => {
  const ft = read('../../free-tools.html');
  assert.ok(ft.includes('<a class="ft-row" href="coverage-precheck.html">'));
  const rowHtml = ft.slice(ft.indexOf('<a class="ft-row" href="coverage-precheck.html">'), ft.indexOf('</a>', ft.indexOf('<a class="ft-row" href="coverage-precheck.html">')));
  assert.ok(rowHtml.includes('data-i18n="ft.group.eng"'), 'its row is labelled Engineering offices');
  assert.equal(ft.split('"ft.coverage.title":').length - 1, 3, 'one card title per language');
  assert.equal(ft.split('"ft.coverage.text":').length - 1, 3, 'one card text per language');
  assert.ok(!ft.includes('<style>'), 'no page-only grid rule: the page is one list of full-width rows');
  assert.ok(!read('../../css/tools.css').includes('align-content: start'), 'not in the shared stylesheet');
  assert.ok(read('../../sitemap.xml').includes('<loc>https://www.aidedcam.com/coverage-precheck.html</loc>'));
  assert.ok(read('../../llms.txt').includes('- Coverage diagram pre-check (https://www.aidedcam.com/coverage-precheck.html)'));
});

test('the page carries the devDept notice verbatim, the disclaimer, and loads no engine up front', () => {
  const page = read('../../coverage-precheck.html');
  assert.ok(page.includes('Portion of copyright © devDept Software S.r.l. All Rights Reserved.'));
  assert.ok(page.includes('Ενδεικτικός προέλεγχος — όχι επίσημος υπολογισμός.'));
  assert.ok(!/src="[^"]*engine\//.test(page), 'the engine loads in the worker, on the first file');
  assert.ok(page.includes('<link rel="canonical" href="https://www.aidedcam.com/coverage-precheck.html" />'));
});

test('consent, GA and the language switcher are those of the DWG quantities page', () => {
  const a = read('../../dwg-quantities.html'), b = read('../../coverage-precheck.html');
  const between = (s, from, to) => s.slice(s.indexOf(from), s.indexOf(to, s.indexOf(from)));
  // The GA loader in the head, the consent markup, and the script from setLanguage to the end of the consent code.
  for (const [from, to] of [['<!-- Google Analytics', '</script>'], ['<!-- COOKIE CONSENT BANNER', '  <script src='], ['    // The tool\'s strings first', '  </script>'], ['<div class="lang-switcher">', '</div>']]) {
    const x = between(a, from, to).replace('DQ_I18N', 'XX_I18N'), y = between(b, from, to).replace('CP_I18N', 'XX_I18N');
    assert.ok(x.length > 20, from);
    assert.equal(y, x, from);
  }
  // The cookie and footer strings are the same in every language.
  const strings = s => [...s.matchAll(/"(cookie_[a-z_]+|footer\.[a-z_]+)": "([^"]*)"/g)].map(m => m[0]).join('\n');
  assert.equal(strings(b), strings(a));
});

test('every new asset URL carries the deploy placeholder', () => {
  const page = read('../../coverage-precheck.html');
  for (const u of ['css/tools.css?v=20260930', 'js/coverage/i18n-coverage.js?v=20260930', 'js/coverage/ui.js?v=20260930']) assert.ok(page.includes(u), u);
  const ui = read('../../js/coverage/ui.js');
  for (const m of ui.matchAll(/from '(\.[^']+)'/g)) if (!m[1].includes('/gcode/shell/')) assert.ok(m[1].endsWith('?v=20260930'), m[1]);
  assert.ok(ui.includes("'../dwg/worker.js?v=20260930'"));
  assert.ok(read('../../js/dwg/worker.js').includes("'./engine/dotnet.js?v=20260930'"), 'the republished engine');
});
