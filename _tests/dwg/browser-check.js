// Dev-only browser check of dwg-quantities.html (plan Task 14; Jekyll skips _tests). It is one Playwright
// function: run it with the Playwright MCP (browser_run_code_unsafe, filename: _tests/dwg/browser-check.js)
// or with node _tests/dwg/browser-check.cjs. It expects the repo root served on http://127.0.0.1:8765/ and
// returns { pass, fail, checks: [{ name, ok, got }] }.
async (page) => {
  const BASE = 'http://127.0.0.1:8765/';
  const checks = [];
  const check = (name, ok, got) => checks.push({ name, ok: !!ok, got });
  const errors = [], external = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.clearBrowserCache');                           // a cached old module would hide a fix

  const rowText = sel => page.$$eval(sel, trs => trs.map(tr => [...tr.cells].map(c => c.textContent.trim()).join(' | ')));
  const waitRows = (min = 1) => page.waitForFunction(n => document.querySelectorAll('#dqLayers tbody tr').length >= n, min, { timeout: 60000 });

  // 0. Desktop–browser parity on the committed fixtures (spec §11 gate).
  await page.goto(BASE + '_tests/dwg/parity.html');
  await page.waitForFunction(() => window.__parity, null, { timeout: 120000 });
  const parity = await page.evaluate(() => window.__parity);
  check('parity: every fixture matches the desktop engine', parity.files === 6 && parity.failed === 0, parity);

  // 1. The page paints without the engine.
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto(BASE + 'dwg-quantities.html?lang=en');
  check('title', (await page.title()) === 'AidedCAM - Quantities from DWG', await page.title());
  const early = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => e.name.includes('/engine/')).length);
  check('no engine before the first file', early === 0, early);

  // 2. The example drawing.
  await page.click('#dqExample');
  await page.waitForFunction(() => document.body.innerText.includes('ΥΔΡΕΥΣΗ'), null, { timeout: 60000 });
  const layers = await rowText('#dqLayers tbody tr');
  const walls = layers.find(r => r.includes('ΤΟΙΧΟΙ')) || '';
  check('walls 85.60 m, 5 outlines, 108.16 m²', walls.includes('85.60') && walls.includes('108.16'), walls);
  const floors = layers.find(r => r.includes('ΔΑΠΕΔΑ')) || '';
  check('floor hatch 107.84 m² (column subtracted)', floors.includes('107.84'), floors);
  const blocks = await rowText('#dqBlocks tbody tr');
  check('7 lights (an array of 6 and one)', blocks.some(r => r.startsWith('ΦΩΤΙΣΤΙΚΟ') && r.includes('| 7 |')), blocks);
  check('the dynamic copy counts as a window: 5', blocks.some(r => r.startsWith('ΠΑΡΑΘΥΡΟ') && r.includes('| 5 |')), blocks);
  check('nested WC under the set layer', blocks.some(r => r.startsWith('ΛΕΚΑΝΗ | ΥΓΙΕΙΝΗ | 0 | 1')), blocks);
  const sched = await page.$eval('#dqSchedules', e => e.innerText);
  check('window schedule Π1 × 4', /Π1\s+120\s+140\s+4/.test(sched), sched.slice(0, 200));
  const unitsLine = await page.$eval('#dqStatus', e => e.textContent);
  check('the units line names the unit the engine applied: mm', /\bmm\b/.test(unitsLine), unitsLine);

  // 3. Row → drawing highlight.
  await page.click('#dqLayers tbody tr:has-text("ΥΔΡΕΥΣΗ")');
  check('row highlight', await page.$eval('#dqLayers tbody tr:has-text("ΥΔΡΕΥΣΗ")', tr => tr.classList.contains('is-hi')), null);
  await page.click('#dqLayers tbody tr:has-text("ΥΔΡΕΥΣΗ")');

  // 4. A window around the whole drawing selects every item. The cookie bar must not cover the canvas.
  const decline = await page.$('#privacyDecline');
  if (decline && await decline.isVisible()) await decline.click();
  await page.$eval('#dqCanvas', c => c.scrollIntoView({ block: 'center' }));
  await page.click('#dqFit');
  const box = await page.$eval('#dqCanvas', c => { const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await page.mouse.move(box.x + 3, box.y + 3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.w / 2, box.y + box.h / 2, { steps: 5 });
  await page.mouse.move(box.x + box.w - 3, box.y + box.h - 3, { steps: 5 });
  await page.mouse.up();
  const selCount = await page.$eval('#dqSelCount', e => e.textContent);
  const selLayers = await rowText('#dqSelLayers tbody tr');
  check('window selection totals', /\d+/.test(selCount) && selLayers.some(r => r.startsWith('ΤΟΙΧΟΙ') && r.includes('85.60')), { selCount, selLayers });
  await page.keyboard.press('Escape');
  check('Esc clears the selection', await page.$eval('#dqSelCount', e => e.hidden), null);

  // 5. The .xlsx download.
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#dqXlsx')]);
  check('xlsx name', dl.suggestedFilename() === 'quantities-example-plan.xlsx', dl.suggestedFilename());
  const stream = await dl.createReadStream();
  const chunks = []; for await (const c of stream) chunks.push(c);
  const bytes = Buffer.concat(chunks);
  const names = ['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml'].filter(n => bytes.includes(Buffer.from(n)));
  check('xlsx is a zip with a workbook', bytes.slice(0, 2).toString() === 'PK' && names.length === 3, names);

  // 6. The units override re-measures one file.
  await page.selectOption('#dqStatus select', 'cm');
  await page.waitForFunction(() => document.body.innerText.includes('856.00'), null, { timeout: 60000 });
  check('override cm: walls 856.00 m', true, 'ok');
  await page.selectOption('#dqStatus select', '');
  await page.waitForFunction(() => document.body.innerText.includes('85.60'), null, { timeout: 60000 });

  // 7. More files: two fixtures and a bad one; the Summary tab.
  const fetchBytes = async p => Buffer.from(await page.evaluate(async u => [...new Uint8Array(await (await fetch(u)).arrayBuffer())], BASE + p));
  // Every time a tab shows a file still waiting or measuring, the .xlsx button must be disabled.
  await page.evaluate(() => {
    window.__busy = [];
    window.__busyObs = new MutationObserver(() => {
      if (document.querySelector('#dqTabs .dq-mark.is-busy')) window.__busy.push(document.getElementById('dqXlsx').disabled);
    });
    window.__busyObs.observe(document.getElementById('dqTabs'), { childList: true, subtree: true });
  });
  await page.setInputFiles('#dqInput', [
    { name: 'rooms.dwg', mimeType: 'application/octet-stream', buffer: await fetchBytes('_tests/dwg/fixtures/rooms.dwg') },
    { name: 'rooms-2004.dxf', mimeType: 'application/octet-stream', buffer: await fetchBytes('_tests/dwg/fixtures/rooms-2004.dxf') },
    { name: 'notes.dwg', mimeType: 'application/octet-stream', buffer: Buffer.from('hello, not a drawing') },
  ]);
  await page.waitForFunction(() => document.querySelectorAll('#dqTabs .dq-mark.is-busy').length === 0 && document.querySelectorAll('#dqTabs .dq-tab').length === 5, null, { timeout: 60000 });
  const busy = await page.evaluate(() => { window.__busyObs.disconnect(); return window.__busy; });
  check('no .xlsx while a file is being measured', busy.length > 0 && busy.every(Boolean), busy);
  check('.xlsx again once every file is done', !(await page.$eval('#dqXlsx', b => b.disabled)), null);
  const marks = await page.$$eval('#dqTabs .dq-tab', ts => ts.map(t => t.textContent.trim()));
  // ⚠ only for what needs attention; text left unmeasured is an info line, not a warning.
  check('tabs: Summary first, then each file with its status', marks[0].length > 0 && marks.slice(1).map(m => m[0]).join('') === '✔✔✔✖', marks);
  await page.click('#dqTabs .dq-tab:has-text("notes.dwg")');
  check('the bad file shows why', (await page.$eval('#dqError', e => e.textContent)).includes('notes.dwg'), await page.$eval('#dqError', e => e.textContent));
  await page.click('#dqTabs .dq-tab >> nth=0');
  const sumWalls = (await rowText('#dqLayers tbody tr')).find(r => r.includes('ΤΟΙΧΟΙ')) || '';
  check('summary adds the files and marks the total ≥', sumWalls.includes('149.60') && (await page.$eval('#dqLayerTotals', e => e.textContent)).includes('≥'), sumWalls);

  // 8. Greek number format and the phone layout.
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(BASE + 'dwg-quantities.html?lang=el');
  await page.click('#dqExample');
  await page.waitForFunction(() => document.body.innerText.includes('ΥΔΡΕΥΣΗ'), null, { timeout: 60000 });
  const el = (await rowText('#dqLayers tbody tr')).find(r => r.includes('ΤΟΙΧΟΙ')) || '';
  check('Greek decimal comma', el.includes('85,60'), el);
  const sw = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  check('375 px: no horizontal page scroll', sw[0] === sw[1], sw);

  // 9. Nothing left the local server; no console errors.
  check('no external requests', external.length === 0, external);
  check('no console errors', errors.length === 0, errors);
  return { pass: checks.filter(c => c.ok).length, fail: checks.filter(c => !c.ok).length, checks };
}
