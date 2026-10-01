// Dev-only browser check of ifc-plans.html (Jekyll skips _tests). It is one Playwright function: run it with the
// Playwright MCP (browser_run_code_unsafe, filename: _tests/ifcplan/browser-check.js) or with
// node _tests/ifcplan/browser-check.cjs. It expects the repo root served on http://127.0.0.1:8793/ and returns
// { pass, fail, checks: [{ name, ok, got }] }.
async (page) => {
  const BASE = 'http://127.0.0.1:8793/';
  const checks = [];
  const check = (name, ok, got) => checks.push({ name, ok: !!ok, got });
  const errors = [], external = [], requests = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => { const u = r.url(); requests.push(u); if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.clearBrowserCache');                           // a cached old module would hide a fix

  // A strict reader of the R12 DXFs the page writes: pairs, sections, POLYLINE…SEQEND, TEXT, Windows-1253 text.
  const readDxf = bytes => {
    const lines = new TextDecoder('windows-1253').decode(bytes).split('\r\n');
    if (lines.pop() !== '' || lines.length % 2) throw new Error('not whole group pairs');
    const out = { comments: [], header: {}, entities: [], sections: [] };
    let sec = null, key = null, poly = null, ent = null;
    for (let i = 0; i < lines.length; i += 2) {
      const c = +lines[i], v = lines[i + 1];
      if (c === 999) { out.comments.push(v); continue; }
      if (c === 0 && v === 'SECTION') { sec = lines[i + 3]; out.sections.push(sec); i += 2; continue; }
      if (c === 0 && v === 'ENDSEC') { if (poly) throw new Error('POLYLINE left open'); sec = null; continue; }
      if (c === 0 && v === 'EOF') { if (i + 2 !== lines.length) throw new Error('data after EOF'); out.eof = true; break; }
      if (sec === 'HEADER') { if (c === 9) { key = v; out.header[key] = []; } else out.header[key].push(v); continue; }
      if (sec !== 'ENTITIES') continue;
      if (c === 0) {
        if (v === 'VERTEX') { if (!poly) throw new Error('VERTEX outside POLYLINE'); poly.n++; ent = null; continue; }
        if (v === 'SEQEND') { if (!poly) throw new Error('SEQEND alone'); poly = null; ent = null; continue; }
        if (poly) throw new Error(`${v} inside POLYLINE`);
        ent = { type: v, layer: null, text: null };
        if (v === 'POLYLINE') { ent.n = 0; poly = ent; }
        out.entities.push(ent);
        continue;
      }
      if (ent && c === 8) ent.layer = v;
      if (ent && c === 1) ent.text = v;
    }
    if (!out.eof) throw new Error('no EOF');
    return out;
  };
  const byLayer = d => { const o = {}; for (const e of d.entities) { const k = `${e.type} ${e.layer}`; o[k] = (o[k] || 0) + 1; } return o; };
  const download = async selector => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click(selector)]);
    const chunks = []; for await (const c of await dl.createReadStream()) chunks.push(c);
    return { name: dl.suggestedFilename(), bytes: Buffer.concat(chunks) };
  };
  const rows = () => page.$$eval('#ipStoreys tbody tr', trs => trs.map(tr => [...tr.cells].map(c => c.innerText.trim())));
  const timings = () => page.evaluate(() => ({ ...window.__ifcp.timings }));
  const ready = () => page.waitForFunction(() => !document.querySelector('#ipPanel').hidden && document.querySelector('#ipBusy').hidden, null, { timeout: 30000 });

  // 1. The page paints without web-ifc; the example loads it.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(BASE + 'ifc-plans.html?lang=en');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('privacy-pref', 'declined'); });
  await page.goto(BASE + 'ifc-plans.html?lang=en');
  check('English title', (await page.title()) === 'AidedCAM - DXF floor plans from IFC', await page.title());
  check('no worker or web-ifc before a file', !requests.some(u => /worker\.js|web-ifc/.test(u)), requests.filter(u => /ifcplan/.test(u)));
  await page.click('#ipExample');
  await ready();
  check('the example: two storeys, levels, elements cut, rooms', JSON.stringify(await rows()) === JSON.stringify([['Ισόγειο', '0.00', '9', '0', '2', 'DXF'], ['Όροφος 1', '3.00', '7', '0', '1', 'DXF']]), await rows());
  const status = await page.$eval('#ipStatus', e => e.innerText.replace(/\s+/g, ' '));
  check('the summary line', status === 'example-house.ifc IFC4 AidedCAM example generator 2 storeys 19 elements 3 rooms DXF in m', status);
  check('web-ifc loaded with the example, from this site', requests.some(u => u.endsWith('web-ifc.wasm?v=20261001')), requests.filter(u => /web-ifc/.test(u)));
  const legend = await page.$eval('#ipLegend', e => e.innerText.split('\n').join(' '));
  check('the preview and its legend', legend === 'IFC_WALL IFC_DOOR IFC_WINDOW IFC_COLUMN IFC_STAIR IFC_SPACE', legend);
  check('no warnings on the example', (await page.$eval('#ipWarnings', e => e.innerText.trim())) === 'No warnings.', await page.$eval('#ipWarnings', e => e.innerText));
  const tExample = (await timings()).example;
  check(`the example: click to preview under 1 s (${tExample} ms)`, tExample < 1000, tExample);

  // 2. Every DXF re-parses, with its layers, its Greek labels and its name.
  const g = await download('button[data-dxf="0"]');
  const gd = readDxf(g.bytes);
  check('ground floor DXF: its name', g.name === '01 Ισόγειο.dxf', g.name);
  check('ground floor DXF: R12, code page 1253, metres', gd.header.$ACADVER[0] === 'AC1009' && gd.header.$DWGCODEPAGE[0] === 'ANSI_1253' && gd.header.$INSUNITS[0] === '6', gd.header);
  check('ground floor DXF: the layers of the plan', JSON.stringify(byLayer(gd)) === JSON.stringify({ 'POLYLINE IFC_WALL': 7, 'POLYLINE IFC_DOOR': 1, 'POLYLINE IFC_WINDOW': 1, 'POLYLINE IFC_COLUMN': 1, 'POLYLINE IFC_STAIR': 1, 'POLYLINE IFC_SPACE': 2, 'TEXT IFC_SPACE_TEXT': 4 }), byLayer(gd));
  check('ground floor DXF: Greek labels with areas', gd.entities.filter(e => e.type === 'TEXT').map(e => e.text).join('|') === 'Σαλόνι|43.61 m²|Κουζίνα|27.74 m²', gd.entities.filter(e => e.type === 'TEXT').map(e => e.text));
  const u = await download('button[data-dxf="1"]');
  const ud = readDxf(u.bytes);
  check('upper floor DXF: name, layers and its three-line label', u.name === '02 Όροφος 1.dxf' && JSON.stringify(byLayer(ud)) === JSON.stringify({ 'POLYLINE IFC_WALL': 6, 'POLYLINE IFC_WINDOW': 1, 'POLYLINE IFC_RAILING': 1, 'POLYLINE IFC_SPACE': 1, 'TEXT IFC_SPACE_TEXT': 3 }) && ud.entities.filter(e => e.type === 'TEXT').map(e => e.text).join('|') === '1.01|Υπνοδωμάτιο|36.10 m²', [u.name, byLayer(ud)]);
  check('the comment block names the source, storey and cut', ud.comments.slice(1, 4).join('|') === 'Source: example-house.ifc|Storey: Όροφος 1, level 3.000 m|Cut: 1.10 m above the storey level, at 4.100 m', ud.comments);

  // 3. The ZIP holds both plans.
  const z = await download('#ipZip');
  const entries = [];
  for (let p = 0; z.bytes.readUInt32LE(p) === 0x04034b50;) {
    const size = z.bytes.readUInt32LE(p + 18), nl = z.bytes.readUInt16LE(p + 26);
    entries.push({ name: z.bytes.slice(p + 30, p + 30 + nl).toString('utf8'), bytes: z.bytes.slice(p + 30 + nl, p + 30 + nl + size) });
    p += 30 + nl + size;
  }
  check('the ZIP: its name and two entries, each the storey DXF', z.name === 'example-house-dxf.zip' && entries.map(e => e.name).join('|') === '01 Ισόγειο.dxf|02 Όροφος 1.dxf' && entries[0].bytes.equals(g.bytes) && entries[1].bytes.equals(u.bytes), [z.name, entries.map(e => [e.name, e.bytes.length])]);

  // 4. Units and the move to origin rewrite the DXFs only.
  await page.selectOption('#ipUnits', 'mm');
  const mm = readDxf((await download('button[data-dxf="0"]')).bytes);
  check('a unit switch rewrites $INSUNITS and scales: mm', mm.header.$INSUNITS[0] === '4' && mm.header.$EXTMIN[0] === '120500.0' && mm.header.$EXTMIN[1] === '80250.0', mm.header);
  await page.check('#ipOrigin');
  const moved = readDxf((await download('button[data-dxf="0"]')).bytes);
  check('move to origin writes the shift and moves the plan', moved.comments[5] === "Shift: X -120000 mm, Y -80000 mm; add it back to return to the IFC's coordinates" && moved.header.$EXTMIN[0] === '500.0' && moved.header.$EXTMIN[1] === '250.0', [moved.comments[5], moved.header.$EXTMIN]);
  check('the summary names the units and the shift', (await page.$eval('#ipStatus', e => e.innerText.replace(/\s+/g, ' '))).endsWith('DXF in mm shift X -120 m, Y -80 m'), await page.$eval('#ipStatus', e => e.innerText));
  await page.uncheck('#ipOrigin');
  await page.selectOption('#ipUnits', 'm');

  // 5. A re-cut on the open model, and a refused height.
  await page.fill('#ipCut', '2.20');
  await page.press('#ipCut', 'Enter');
  await page.waitForFunction(() => !document.querySelector('#ipRecutTime').hidden && document.querySelector('#ipBusy').hidden, null, { timeout: 30000 });
  check('re-cut at 2.20 m: the door and windows drop out', JSON.stringify((await rows()).map(r => r[2])) === JSON.stringify(['7', '5']), await rows());
  const high = readDxf((await download('button[data-dxf="0"]')).bytes);
  check('the re-cut DXF: no door, the new cut in its comment', !byLayer(high)['POLYLINE IFC_DOOR'] && high.comments[3] === 'Cut: 2.20 m above the storey level, at 2.200 m', [byLayer(high), high.comments[3]]);
  const tRecut = (await timings()).recut;
  check(`a re-cut under 1 s (${tRecut} ms), its time shown`, tRecut < 1000 && /^Re-cut at 2\.20 m in \d\.\d\d s\.$/.test(await page.$eval('#ipRecutTime', e => e.innerText)), await page.$eval('#ipRecutTime', e => e.innerText));
  const webIfcLoads = requests.filter(u2 => u2.includes('web-ifc.wasm')).length;
  await page.fill('#ipCut', 'abc');
  await page.press('#ipCut', 'Enter');
  check('an invalid height is marked and not cut', (await page.getAttribute('#ipCut', 'aria-invalid')) === 'true' && JSON.stringify((await rows()).map(r => r[2])) === JSON.stringify(['7', '5']), await page.getAttribute('#ipCut', 'aria-invalid'));
  await page.fill('#ipCut', '1.10');
  await page.press('#ipCut', 'Enter');
  await page.waitForFunction(() => document.querySelector('#ipStoreys tbody tr').cells[2].innerText.trim() === '9', null, { timeout: 30000 });
  check('back at 1.10 m, without reloading web-ifc', requests.filter(u2 => u2.includes('web-ifc.wasm')).length === webIfcLoads && (await page.getAttribute('#ipCut', 'aria-invalid')) === null, webIfcLoads);

  // 6. The preview: a storey row selects it; the tooltip names the layer under the pointer.
  await page.click('#ipStoreys tbody tr:nth-child(2) td:first-child');
  const sel = await page.evaluate(() => ({ name: document.querySelector('#ipPreviewName').textContent, legend: document.querySelector('#ipLegend').innerText.split('\n').join(' '), sel: document.querySelector('#ipStoreys tr.is-sel td').innerText }));
  check('a row click shows that storey', sel.name === 'Όροφος 1' && sel.sel === 'Όροφος 1' && sel.legend === 'IFC_WALL IFC_WINDOW IFC_RAILING IFC_SPACE', sel);
  await page.$eval('#ipCanvas', c => c.scrollIntoView({ block: 'center', behavior: 'instant' }));   // the site scrolls smoothly: wait for none
  const at = await page.evaluate(() => { const s = window.__ifcp.drawing.screenOf(122, 80.25), r = document.querySelector('#ipCanvas').getBoundingClientRect(); return { x: r.left + s.x, y: r.top + s.y }; });
  await page.mouse.move(at.x, at.y);
  await page.waitForFunction(() => !document.querySelector('#ipTip').hidden, null, { timeout: 5000 }).catch(() => {});
  check('hover over the outer face of the south wall: the tooltip names IFC_WALL', (await page.$eval('#ipTip', e => e.hidden ? '' : e.innerText)) === 'Layer: IFC_WALL', await page.$eval('#ipTip', e => e.innerText));
  const canvasInk = await page.$eval('#ipCanvas', c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 80 && d[i + 1] < 80 && d[i + 2] < 80) n++; return n; });
  check('the preview draws the walls', canvasInk > 500, canvasInk);

  // 7. Languages.
  await page.click('.lang-btn[data-lang="el"]');
  check('Greek: title, decimal comma, headings', (await page.title()) === 'AidedCAM - Κατόψεις DXF από IFC' && (await rows())[1][1] === '3,00' && (await page.$eval('#ipStoreys thead', e => e.innerText)).includes('Στοιχεία στην τομή') && (await page.inputValue('#ipCut')) === '1,10', [await page.title(), (await rows())[1]]);
  await page.click('.lang-btn[data-lang="it"]');
  check('Italian: title, summary, warnings', (await page.title()) === 'AidedCAM - Piante DXF da IFC' && (await page.$eval('#ipStatus', e => e.innerText)).includes('2 piani') && (await page.$eval('#ipWarnings', e => e.innerText.trim())) === 'Nessun avviso.', await page.$eval('#ipStatus', e => e.innerText));
  await page.click('.lang-btn[data-lang="en"]');

  // 8. Settings stay in this browser.
  await page.fill('#ipCut', '0.90'); await page.press('#ipCut', 'Enter');
  await page.waitForFunction(() => document.querySelector('#ipRecutTime').innerText.startsWith('Re-cut at 0.90'), null, { timeout: 30000 });
  await page.selectOption('#ipUnits', 'cm');
  await page.reload();
  check('the cut height and units are remembered', (await page.inputValue('#ipCut')) === '0.90' && (await page.inputValue('#ipUnits')) === 'cm', [await page.inputValue('#ipCut'), await page.inputValue('#ipUnits')]);
  await page.evaluate(() => localStorage.removeItem('aidedcam-ifcp-settings'));
  await page.reload();
  check('the defaults: 1.10 m, metres, not moved', (await page.inputValue('#ipCut')) === '1.10' && (await page.inputValue('#ipUnits')) === 'm' && !(await page.isChecked('#ipOrigin')), await page.inputValue('#ipCut'));

  // 9. Files the tool refuses: one line in the visitor's language, and the page stays usable.
  await page.setInputFiles('#ipInput', { name: 'drawing.dxf', mimeType: 'application/dxf', buffer: Buffer.from('0\r\nSECTION\r\n2\r\nHEADER\r\n0\r\nENDSEC\r\n0\r\nEOF\r\n') });
  await page.waitForFunction(() => !document.querySelector('#ipError').hidden, null, { timeout: 30000 });
  check('not an IFC: the read error', (await page.$eval('#ipError', e => e.innerText)) === 'drawing.dxf: This is not an IFC file the tool can read: it supports .ifc in STEP text.', await page.$eval('#ipError', e => e.innerText));
  await page.setInputFiles('#ipInput', { name: 'model.ifczip', mimeType: 'application/zip', buffer: Buffer.from([0x50, 0x4b, 3, 4, 20, 0, 0, 0]) });
  await page.waitForFunction(() => document.querySelector('#ipError').innerText.startsWith('model.ifczip'), null, { timeout: 30000 });
  check('ifcZIP: says to unzip it', (await page.$eval('#ipError', e => e.innerText)).includes('.ifcZIP files are not supported'), await page.$eval('#ipError', e => e.innerText));
  const ifc9 = (await (await page.request.get(BASE + 'js/ifcplan/examples/example-house.ifc')).text()).replace("FILE_SCHEMA(('IFC4'))", "FILE_SCHEMA(('IFC9'))");
  await page.setInputFiles('#ipInput', { name: 'future.ifc', mimeType: 'application/octet-stream', buffer: Buffer.from(ifc9) });
  await page.waitForFunction(() => document.querySelector('#ipError').innerText.startsWith('future.ifc'), null, { timeout: 30000 });
  check('an unknown schema: named', (await page.$eval('#ipError', e => e.innerText)).includes('“IFC9”'), await page.$eval('#ipError', e => e.innerText));
  await page.click('#ipExample');
  await ready();
  check('the page stays usable: the example again', (await rows()).length === 2 && (await page.$eval('#ipError', e => e.hidden)), await rows());

  // 10. A phone: no horizontal page scroll, a 16 px gutter, the table scrolls in its own box.
  await page.setViewportSize({ width: 375, height: 800 });
  await page.waitForTimeout(200);
  const phone = await page.evaluate(() => ({ scroll: [document.documentElement.scrollWidth, document.documentElement.clientWidth], gutter: Math.round(document.querySelector('.ip-bar').getBoundingClientRect().left), canvas: Math.round(document.querySelector('#ipCanvas').getBoundingClientRect().width), wrap: getComputedStyle(document.querySelector('#ipStoreys').parentElement).overflowX }));
  check('at 375 px: no horizontal scroll, 16 px gutter, full-width preview, the table scrolls in its box', phone.scroll[0] === phone.scroll[1] && phone.gutter === 16 && phone.canvas >= 340 && phone.wrap === 'auto', phone);
  if (process.env && process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/ifcp-375.png`, fullPage: true });

  // 11. The tools index lists the tool, without a horizontal scroll.
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(BASE + 'free-tools.html?lang=en');
    const card = await page.evaluate(() => { const a = document.querySelector('.ft-card[href="ifc-plans.html"]'); return a && a.closest('.ft-group').querySelector('.ft-group-title').innerText; });
    const scroll = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    check(`index at ${width} px: the card in Engineering offices, no horizontal scroll`, /engineering/i.test(card || '') && scroll[0] === scroll[1], { card, scroll });
  }

  // 12. Nothing external, no console errors.
  check('no external requests', external.length === 0, external);
  check('no console errors', errors.length === 0, errors);
  check(`timings ${JSON.stringify({ example: tExample, recut: tRecut })}`, true, null);
  return { pass: checks.filter(c => c.ok).length, fail: checks.filter(c => !c.ok).length, checks };
}
