// Dev-only browser check of coverage-precheck.html (Jekyll skips _tests). It is one Playwright function: run it
// with the Playwright MCP (browser_run_code_unsafe, filename: _tests/coverage/browser-check.js) or with
// node _tests/coverage/browser-check.cjs. It expects the repo root served on http://127.0.0.1:8765/ and returns
// { pass, fail, checks: [{ name, ok, got }] }.
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

  const cells = key => page.$eval(`#cpSummary tr[data-key="${key}"]`, tr => [...tr.cells].map(c => c.innerText.trim().replace(/\s+/g, ' ')));
  const ready = () => page.waitForFunction(() => !document.querySelector('#cpPanel').hidden && !document.querySelector('#cpXlsx').disabled && document.querySelector('#cpBusy').hidden, null, { timeout: 60000 });
  const timings = () => page.evaluate(() => ({ ...window.__covp.timings }));

  // 0. The engine's union in the browser matches the hand-worked cases.
  await page.goto(BASE + '_tests/coverage/union.html');
  await page.waitForFunction(() => window.__union, null, { timeout: 120000 });
  const union = await page.evaluate(() => ({ ...window.__union, ms: window.__timings }));
  check(`union parity: overlap, touch, frame with a hole, arc, survey coordinates, 50 outlines (${union.ms.MANY} ms), stale file`, union.cases === 6 && union.failed === 0 && union.ms.MANY < 1000, union);

  // 1. The page paints without the engine.
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto(BASE + 'coverage-precheck.html?lang=en');
  check('title', (await page.title()) === 'AidedCAM - Coverage diagram pre-check', await page.title());
  const early = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => e.name.includes('/engine/')).length);
  check('no engine before the first file', early === 0, early);
  const decline = await page.$('#privacyDecline');
  if (decline && await decline.isVisible()) await decline.click();

  // 2. The example: every summary figure of spec §12.
  await page.click('#cpExample');
  await ready();
  const want = {
    plot: ['—', '500.00 m²', ''],
    coverage: ['300.00 m² (60%)', '150.00 m² (30.00%)', '✓'],
    uncovered: ['—', '350.00 m²', ''],
    'level-B1': ['—', '0.00 m²', ''], 'level-00': ['—', '110.00 m²', ''], 'level-01': ['—', '100.00 m²', ''], 'level-02': ['—', '90.00 m²', ''],
    semi: ['80.00 m²', '90.00 m²', '✗'],
    semiBalc: ['160.00 m²', '120.00 m²', '✓'],
    total: ['400.00 m² (ΣΔ 0.80)', '310.00 m² (ΣΔ 0.62)', '✓'],
    volume: ['2,000.00 m³ (σ.ο. 4.00)', '1,380.00 m³ (σ.ο. 2.76)', '✓'],
    height: ['11.00 + 2.00 m', '9.60 + 1.50 m', '✓'],
    planting: ['133.33 m² (⅔ × 200.00)', '140.00 m²', '✓'],
  };
  for (const [key, [perm, prop, mark]] of Object.entries(want)) {
    const c = await cells(key);
    check(`example ${key}: ${perm} | ${prop} | ${mark}`, c[1] === perm && c[2] === prop && c[3] === mark, c);
  }
  check('the semi-open overflow of 10.00 counts', (await cells('semi'))[0].includes('overflow 10.00 m² counts'), await cells('semi'));
  check('every figure cites its article', (await cells('coverage'))[4] === 'Code 207 (ΝΟΚ 12)' && (await cells('volume'))[4] === 'Code 208 (ΝΟΚ 13)', await cells('coverage'));
  const warn = await page.$eval('#cpWarnings', e => e.innerText);
  check('the open outline on the planting layer is listed', warn.includes('Open outline on layer AC_GREEN'), warn);
  const plotXY = await page.$$eval('#cpPlotCoords tbody tr', trs => trs.map(tr => tr.innerText.replace(/\s+/g, ' ').trim()));
  check('plot vertices in ΕΓΣΑ87, no grouping', plotXY[0] === '1 410000.00 4495000.00' && plotXY.length === 4, plotXY);
  const bXY = await page.$$eval('#cpBuildingCoords tbody tr', trs => trs.map(tr => tr.innerText.replace(/\s+/g, ' ').trim()));
  check('building vertices from the union', bXY.length === 4 && bXY[0] === '1 410000.00 4495010.00', bXY);
  check('coordinates are georeferenced: no banner', await page.$eval('#cpNotEgsa', e => e.hidden), null);
  const t1 = await timings();
  check(`example: engine boot ${t1.boot} ms, file ${t1.file} ms, first union ${t1.union} ms`, t1.file < 3000, t1);

  // 3. Highlight both ways: a row lights its outlines, an outline lights its rows.
  await page.hover('#cpSummary tr[data-key="coverage"]');
  const litByRow = await page.evaluate(() => window.__covp.drawing.highlighted);
  check('hovering the coverage row lights the coverage outline', litByRow.length === 1, litByRow);
  await page.click('#cpFit');
  await page.$eval('#cpCanvas', c => c.scrollIntoView({ block: 'center' }));
  const pt = await page.evaluate(() => { const s = window.__covp.drawing.screenOf(410015, 4495020); const r = document.getElementById('cpCanvas').getBoundingClientRect(); return { x: r.x + s.x, y: r.y + s.y }; });
  await page.mouse.click(pt.x, pt.y);
  const lit = await page.$$eval('#cpSummary tbody tr.is-hi', trs => trs.map(tr => tr.dataset.key));
  check('clicking the plot lights the plot rows', lit.includes('plot') && lit.includes('uncovered') && !lit.includes('coverage'), lit);
  await page.mouse.click(pt.x, pt.y);

  // 4. A remap re-runs the rules at once, without the engine.
  await page.selectOption('#cpMap tr[data-layer="AC_SEMIOPEN"] select', 'ignore');
  await page.waitForFunction(() => document.querySelector('#cpSummary tr[data-key="total"]').innerText.includes('390.00'), null, { timeout: 5000 });
  const t2 = await timings();
  check('remap: semi-open ignored, δόμηση 390.00 (3 × 130), no overflow', (await cells('total'))[2] === '390.00 m² (ΣΔ 0.78)', await cells('total'));
  check(`remap under 50 ms (${t2.remap} ms), no engine call`, t2.remap < 50 && t2.union === t1.union, t2);
  await page.selectOption('#cpMap tr[data-layer="AC_SEMIOPEN"] select', 'semiopen');
  await page.waitForFunction(() => document.querySelector('#cpSummary tr[data-key="total"]').innerText.includes('310.00'), null, { timeout: 5000 });

  // 5. A changed coverage mapping asks the engine for a new union: coverage + planting touch along x = 10.
  await page.selectOption('#cpMap tr[data-layer="AC_GREEN"] select', 'cover');
  await page.waitForFunction(() => document.querySelector('#cpSummary tr[data-key="coverage"]').innerText.includes('290.00'), null, { timeout: 30000 });
  await ready();
  const t3 = await timings();
  const b8 = await page.$$eval('#cpBuildingCoords tbody tr', trs => trs.map(tr => tr.innerText.replace(/\s+/g, ' ').trim()));
  check('union of two touching outlines: 290.00 m², 8 vertices from the lowest one', b8.length === 8 && b8[0] === '1 410010.00 4495000.00', b8);
  check(`union on a remap under 1 s (${t3.union} ms)`, t3.union < 1000, t3);
  await page.selectOption('#cpMap tr[data-layer="AC_GREEN"] select', 'green');
  await page.waitForFunction(() => document.querySelector('#cpSummary tr[data-key="coverage"]').innerText.includes('150.00 m² (30.00%)'), null, { timeout: 30000 });
  await ready();

  // 6. A term: ΣΔ 1.2 lifts the caps (no overflow) and the permitted δόμηση.
  await page.fill('#cpSd', '1.2');
  await page.waitForFunction(() => document.querySelector('#cpSummary tr[data-key="total"]').innerText.includes('600.00'), null, { timeout: 5000 });
  check('ΣΔ 1.2: permitted 600.00, proposed 300.00 without overflow', (await cells('total'))[1] === '600.00 m² (ΣΔ 1.20)' && (await cells('total'))[2] === '300.00 m² (ΣΔ 0.60)', await cells('total'));
  check(`a term change under 50 ms (${(await timings()).term} ms)`, (await timings()).term < 50, await timings());
  await page.fill('#cpSd', '0.8');
  await page.waitForFunction(() => document.querySelector('#cpSummary tr[data-key="total"]').innerText.includes('310.00'), null, { timeout: 5000 });

  // 7. The .xlsx.
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#cpXlsx')]);
  check('xlsx name', dl.suggestedFilename() === 'coverage-example-permit.xlsx', dl.suggestedFilename());
  const chunks = []; for await (const c of await dl.createReadStream()) chunks.push(c);
  const bytes = Buffer.concat(chunks);
  const parts = {};
  for (let p = 0; bytes.readUInt32LE(p) === 0x04034b50;) {
    const size = bytes.readUInt32LE(p + 18), nl = bytes.readUInt16LE(p + 26), ex = bytes.readUInt16LE(p + 28);
    parts[bytes.slice(p + 30, p + 30 + nl).toString()] = bytes.slice(p + 30 + nl + ex, p + 30 + nl + ex + size).toString('utf8');
    p += 30 + nl + ex + size;
  }
  const sheets = [...(parts['xl/workbook.xml'] || '').matchAll(/<sheet name="([^"]*)"/g)].map(m => m[1]);
  check('xlsx sheets', sheets.join('|') === 'Summary|Schedule|Coordinates|Mapping', sheets);
  check('xlsx summary holds 310 and the disclaimer', (parts['xl/worksheets/sheet1.xml'] || '').includes('<v>310</v>') && parts['xl/worksheets/sheet1.xml'].includes('Indicative pre-check'), null);

  // 8. Copy uses the language's decimal separator and no grouping.
  await page.click('button[data-copy="summary"]');
  const tsvEn = await page.evaluate(() => navigator.clipboard.readText());
  check('copy (en): 2000.00 m³, tab-separated', tsvEn.includes('\t2000.00 m³ (σ.ο. 4.00)\t') && tsvEn.split('\r\n')[0].split('\t').length === 6, tsvEn.slice(0, 300));

  // 9. Greek and Italian.
  await page.click('.lang-btn[data-lang="el"]');
  check('Greek title', (await page.title()) === 'AidedCAM - Προέλεγχος διαγράμματος κάλυψης', await page.title());
  check('Greek decimal comma', (await cells('plot'))[2] === '500,00 m²', await cells('plot'));
  await page.click('button[data-copy="schedule"]');
  const tsvEl = await page.evaluate(() => navigator.clipboard.readText());
  check('copy (el): comma decimals', tsvEl.includes('\t310,00\t') && !tsvEl.includes('310.00'), tsvEl.slice(-200));
  await page.click('.lang-btn[data-lang="it"]');
  check('Italian title and figures', (await page.title()) === 'AidedCAM - Pre-verifica del diagramma di copertura' && (await cells('coverage'))[0].startsWith('Copertura (κάλυψη)') && (await cells('plot'))[2] === '500,00 m²', await cells('coverage'));
  await page.click('.lang-btn[data-lang="en"]');

  // 10. The units override: the example read as centimetres has a tiny plot and no ΕΓΣΑ87 coordinates.
  await page.selectOption('#cpStatus select', 'cm');
  await page.waitForFunction(() => document.querySelector('#cpWarnings').innerText.includes('check the drawing'), null, { timeout: 60000 });
  await ready();
  check('override cm: plot 0.05 m², units and ΕΓΣΑ87 warnings', (await cells('plot'))[2] === '0.05 m²' && !(await page.$eval('#cpNotEgsa', e => e.hidden)), await cells('plot'));
  await page.selectOption('#cpStatus select', '');
  await page.waitForFunction(() => document.querySelector('#cpSummary tr[data-key="plot"]') && document.querySelector('#cpSummary tr[data-key="plot"]').innerText.includes('500.00'), null, { timeout: 60000 });
  await ready();

  // 11. Print: controls gone, the disclaimer on every page.
  await page.emulateMedia({ media: 'print' });
  const pr = await page.evaluate(() => ({
    step: getComputedStyle(document.getElementById('cpStep1')).display,
    bar: getComputedStyle(document.querySelector('.cp-bar')).display,
    xlsx: getComputedStyle(document.querySelector('.cp-export')).display,
    disclaimer: getComputedStyle(document.querySelector('.cp-print-disclaimer')).position,
    figures: getComputedStyle(document.getElementById('cpSummary')).display,
  }));
  check('print: steps and buttons hidden, figures shown, disclaimer fixed on every page', pr.step === 'none' && pr.bar === 'none' && pr.xlsx === 'none' && pr.disclaimer === 'fixed' && pr.figures !== 'none', pr);
  const pdf = await page.pdf({ format: 'A4' });
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  check('print: an A4 PDF of a few pages', pages >= 2 && pages <= 8, pages);
  await page.emulateMedia({ media: 'screen' });

  // 12. Bad input: not a drawing, and a drawing without closed outlines.
  const lines = ['0', 'SECTION', '2', 'ENTITIES', '0', 'LINE', '8', 'A', '10', '0.0', '20', '0.0', '11', '5.0', '21', '0.0', '0', 'ENDSEC', '0', 'EOF', ''].join('\r\n');
  await page.setInputFiles('#cpInput', { name: 'lines.dxf', mimeType: 'application/octet-stream', buffer: Buffer.from(lines) });
  await page.waitForFunction(() => !document.querySelector('#cpError').hidden, null, { timeout: 20000 }).catch(async e => { throw new Error(JSON.stringify(await page.evaluate(() => ({ err: document.querySelector('#cpError').outerHTML, busy: document.querySelector('#cpBusy').outerHTML, panel: document.querySelector('#cpPanel').hidden, status: document.querySelector('#cpStatus').innerText })))); });
  check('no closed outlines: an error card, not empty tables', (await page.$eval('#cpError', e => e.textContent)).includes('No closed outlines') && await page.$eval('#cpPanel', e => e.hidden), await page.$eval('#cpError', e => e.textContent));
  await page.setInputFiles('#cpInput', { name: 'notes.dwg', mimeType: 'application/octet-stream', buffer: Buffer.from('hello, not a drawing') });
  await page.waitForFunction(() => document.querySelector('#cpError').textContent.includes('notes.dwg'), null, { timeout: 60000 });
  check('a file that is not a drawing says why', (await page.$eval('#cpError', e => e.textContent)).includes('does not read as a DWG or DXF'), await page.$eval('#cpError', e => e.textContent));

  // 13. The phone layout, in Greek.
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(BASE + 'coverage-precheck.html?lang=el');
  await page.click('#cpExample');
  await ready();
  const sw = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  check('375 px: no horizontal page scroll', sw[0] === sw[1], sw);
  const gutter = await page.$eval('.gv-wrap', e => parseFloat(getComputedStyle(e).paddingLeft));
  check('375 px: 16 px gutter', gutter === 16, gutter);

  // 14. The template download.
  const tpl = await page.evaluate(async () => { const r = await fetch(document.getElementById('cpTemplate').href); const b = new Uint8Array(await r.arrayBuffer()); return { ok: r.ok, size: b.length, name: document.getElementById('cpTemplate').getAttribute('download') }; });
  check('the layer template is served', tpl.ok && tpl.size > 1000 && tpl.name === 'aidedcam-layer-template.dxf', tpl);
  const tEnd = await timings();

  // 15. The tools index: the new card in Engineering offices, and the single laser card beside the two engineering
  // cards keeps its own height (page-scoped rule in free-tools.html), at desktop width and at 375 px.
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(BASE + 'free-tools.html?lang=en');
    const cards = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.ft-card')].map(a => [a.getAttribute('href'), Math.round(a.getBoundingClientRect().height)])));
    const scroll = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    const laser = cards['laser-dxf-checker.html'], dwg = cards['dwg-quantities.html'];
    check(`index at ${width} px: the coverage card is listed, the laser card is not stretched, no horizontal scroll`, 'coverage-precheck.html' in cards && laser <= Math.max(dwg, cards['coverage-precheck.html']) + 40 && scroll[0] === scroll[1], { cards, scroll });
    if (process.env && process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/ft-${width}.png`, fullPage: true });
  }

  // 16. Nothing external, no console errors.
  check('no external requests', external.length === 0, external);
  check('no console errors', errors.length === 0, errors);
  check(`timings ${JSON.stringify(tEnd)}`, true, null);
  return { pass: checks.filter(c => c.ok).length, fail: checks.filter(c => !c.ok).length, checks };
}
