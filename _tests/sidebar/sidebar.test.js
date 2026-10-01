import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout has CRLF
const V = '20261102';                                                                           // deploy day swaps it
const PAGES = ['index', 'what-you-gain', 'calculator', 'free-tools', 'gcode-viewer', 'milling-gcode-viewer', 'laser-dxf-checker',
  'dwg-quantities', 'coverage-precheck', 'ifc-plans', 'legal', 'privacy'].map(p => `${p}.html`);
const LANGS = ['el', 'en', 'it'];

// The script runs in the browser; in Node it hands its data to `module.exports` and touches no DOM.
function loadSidebar() {
  const sandbox = { module: { exports: {} } };
  vm.runInNewContext(read('../../js/sidebar.js'), sandbox);
  return JSON.parse(JSON.stringify(sandbox.module.exports));         // plain objects of this realm
}
const count = (s, sub) => s.split(sub).length - 1;

test('every page at the site root is a listed page', () => {
  const root = readdirSync(new URL('../../', import.meta.url)).filter(f => f.endsWith('.html')).sort();
  assert.deepEqual(root, [...PAGES].sort());
});

test('every page loads the stylesheet and the deferred script once, in <head>, with the same ?v=', () => {
  for (const p of PAGES) {
    const html = read(`../../${p}`);
    assert.equal(count(html, 'css/sidebar.css'), 1, `${p}: one stylesheet`);
    assert.equal(count(html, 'js/sidebar.js'), 1, `${p}: one script`);
    assert.ok(html.includes(`  <link rel="stylesheet" href="css/sidebar.css?v=${V}" />\n  <script src="js/sidebar.js?v=${V}" defer></script>\n</head>`), `${p}: both just before </head>`);
  }
});

test('the six tools and their URLs are the cards of free-tools.html, in order', () => {
  const { TOOLS } = loadSidebar();
  const ft = read('../../free-tools.html');
  const cards = [...ft.matchAll(/<a class="ft-card" href="([^"]+)">\s*<h3 data-i18n="ft\.([a-z]+)\.title">/g)].map(m => ({ id: m[2], href: m[1] }));
  assert.equal(cards.length, 6);
  assert.deepEqual(TOOLS.map(t => ({ id: t.id, href: t.href })), cards);
});

test('the tool names are those of the free-tools cards, in every language', () => {
  const { TOOLS, COPY } = loadSidebar();
  const ft = read('../../free-tools.html');
  for (const t of TOOLS) {
    const names = [...ft.matchAll(new RegExp(`"ft\.${t.id}\.title": "([^"]+)"`, 'g'))].map(m => m[1]);
    assert.equal(names.length, 3, t.id);
    LANGS.forEach((l, i) => assert.equal(COPY[l].tools[t.id].name, names[i], `${l} ${t.id}`));   // el, en, it order in the page
  }
});

test('the strings are complete in el, en and it, and each tool has one short line', () => {
  const { TOOLS, COPY } = loadSidebar();
  assert.deepEqual(Object.keys(COPY).sort(), [...LANGS].sort());
  const keys = o => Object.keys(o).filter(k => k !== 'tools').sort();
  for (const l of LANGS) {
    assert.deepEqual(keys(COPY[l]), keys(COPY.el), `${l}: same keys as el`);
    for (const k of keys(COPY[l])) assert.ok(typeof COPY[l][k] === 'string' && COPY[l][k].trim(), `${l}.${k}`);
    assert.deepEqual(Object.keys(COPY[l].tools).sort(), TOOLS.map(t => t.id).sort(), `${l}: every tool`);
    for (const t of TOOLS) {
      const { name, line } = COPY[l].tools[t.id];
      assert.ok(name && line, `${l} ${t.id}`);
      assert.ok(line.length <= 72 && !line.includes('\n'), `${l} ${t.id}: one line (${line.length})`);
    }
  }
});

test('the Italian uses the typographic apostrophe, and en/it carry no Greek', () => {
  const { COPY } = loadSidebar();
  const all = o => JSON.stringify(o);
  assert.ok(!all(COPY.it).includes("'"), 'no ASCII apostrophe in the Italian');
  const PROPER = [];                                    // Greek proper terms allowed in en/it (none needed so far)
  for (const l of ['en', 'it']) {
    let s = all(COPY[l]); for (const p of PROPER) s = s.split(p).join('');
    assert.ok(!/[Ͱ-Ͽἀ-῿]/.test(s), `${l}: ${s.match(/.{0,20}[Ͱ-Ͽἀ-῿].{0,20}/)}`);
  }
  assert.ok(/[Ͱ-Ͽ]/.test(all(COPY.el)), 'the Greek is Greek');
});

test('no external requests, the GA event through window.gtag only, nothing in editorial.css or tools.css', () => {
  const js = read('../../js/sidebar.js'), css = read('../../css/sidebar.css');
  for (const [n, s] of [['js', js], ['css', css]]) {
    assert.ok(!/https?:\/\/(?!www\.w3\.org\/2000\/svg)/.test(s), `${n}: no URL but the SVG namespace`);
    assert.ok(!/@import|url\(/.test(s) || n === 'js', `${n}: no imported files`);
  }
  assert.ok(js.includes("'freetools_sidebar_click'"));
  assert.ok(/window\.gtag\(\s*'event',\s*'freetools_sidebar_click',\s*\{\s*tool: [^,]+,\s*layout: [^}]+\}\s*\)/.test(js), 'tool and layout only');
  assert.ok(/typeof window\.gtag === 'function'/.test(js), 'only when gtag exists (after consent)');
  assert.ok(/MutationObserver[\s\S]*attributeFilter: \['lang'\]/.test(js), 'follows <html lang>');
  assert.ok(/@media print[\s\S]*display: none/.test(css), 'hidden in print');
  assert.ok(/prefers-reduced-motion: reduce/.test(css), 'reduced motion');
  for (const f of ['../../css/editorial.css', '../../css/tools.css']) assert.ok(!/afs-|sidebar/.test(read(f)), f);
});
