// Dev-only browser check of steel-takeoff.html (Jekyll skips _tests). It is one Playwright function: run it with the
// Playwright MCP (browser_run_code_unsafe, filename: _tests/steel/browser-check.js) or with
// node _tests/steel/browser-check.cjs. It expects the repo root served on http://127.0.0.1:8821/ and returns
// { pass, fail, checks: [{ name, ok, got }] }.
async (page) => {
  const BASE = 'http://127.0.0.1:8821/';
  const env = typeof process !== 'undefined' && process.env ? process.env : {};
  const checks = [];
  const check = (name, ok, got) => checks.push({ name, ok: !!ok, got });
  const errors = [], external = [], requests = [];
  const watch = p => {
    p.on('console', m => { if (m.type() === 'error' || /GL_INVALID|CONTEXT_LOST/.test(m.text())) errors.push(m.text()); });
    p.on('pageerror', e => errors.push(String(e)));
    p.on('request', r => { const u = r.url(); requests.push(u); if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
  };
  watch(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.clearBrowserCache');                           // a cached old module would hide a fix

  // A stored ZIP (the Excel file, and test archives) read and written here, in Node.
  const unzip = buf => {
    const out = {};
    let p = 0;
    while (buf.readUInt32LE(p) === 0x04034b50) {
      const size = buf.readUInt32LE(p + 18), n = buf.readUInt16LE(p + 26), x = buf.readUInt16LE(p + 28);
      out[buf.toString('utf8', p + 30, p + 30 + n)] = buf.toString('utf8', p + 30 + n + x, p + 30 + n + x + size);
      p += 30 + n + x + size;
    }
    return out;
  };
  const zipOf = (entries, flags = 0) => {
    const parts = [], cen = [];
    let off = 0;
    for (const [name, text] of entries) {
      const nm = Buffer.from(name), body = Buffer.from(text);
      const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(flags, 6); h.writeUInt32LE(body.length, 18); h.writeUInt32LE(body.length, 22); h.writeUInt16LE(nm.length, 26);
      const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(flags, 8); c.writeUInt32LE(body.length, 20); c.writeUInt32LE(body.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(off, 42);
      parts.push(h, nm, body); cen.push(c, nm); off += 30 + nm.length + body.length;
    }
    const cd = Buffer.concat(cen), end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
    return Buffer.concat([...parts, cd, end]);
  };
  const download = async selector => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click(selector)]);
    const chunks = []; for await (const c of await dl.createReadStream()) chunks.push(c);
    return { name: dl.suggestedFilename(), bytes: Buffer.concat(chunks) };
  };
  const summary = () => page.$$eval('#stSummary .st-fig', ds => Object.fromEntries(ds.map(d => [d.querySelector('dt').innerText.trim(), d.querySelector('dd').innerText.trim()])));
  const groups = () => page.$$eval('#stTable tbody tr.st-group', trs => trs.map(tr => [...tr.cells].map(c => c.innerText.replace(/^[▸▾]\s*/, '').trim()).join(' | ')));
  const costRows = () => page.$$eval('#stCosts tbody tr', trs => trs.map(tr => [...tr.cells].map(c => c.innerText.trim()).filter(Boolean).join(' | ')));
  const timings = () => page.evaluate(() => ({ ...window.__steel.timings }));
  const shown = () => page.waitForFunction(() => !document.querySelector('#stPanel').hidden && document.querySelector('#stBusy').hidden, null, { timeout: 30000 });
  const checked = () => page.waitForFunction(() => !/running|σε εξέλιξη/.test(document.querySelector('#stSummary').innerText), null, { timeout: 60000 });
  const view = () => page.waitForFunction(() => window.__steel.view3d && window.__steel.timings.view3d >= 0 && document.querySelector('#st3dNote').hidden, null, { timeout: 30000 });
  const files = (selector, list) => page.setInputFiles(selector, list.map(([name, text]) => ({ name, mimeType: 'application/octet-stream', buffer: Buffer.isBuffer(text) ? text : Buffer.from(text) })));
  const fresh = async (lang = 'en') => {
    await page.goto(BASE + 'steel-takeoff.html?lang=' + lang);
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('privacy-pref', 'declined'); });
    await page.goto(BASE + 'steel-takeoff.html?lang=' + lang);
    await page.evaluate(() => { window.__ga = []; window.gtag = (...a) => window.__ga.push(a); window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  };

  // 1. The page paints without web-ifc or three.js; the example NC1 set loads under 1 s.
  await page.setViewportSize({ width: 1280, height: 900 });
  await fresh();
  check('English title', (await page.title()) === 'AidedCAM - Steel take-off and galvanizing quote', await page.title());
  check('the eyebrow reads Tool', (await page.$eval('.gv-eyebrow', e => e.innerText.trim().toLowerCase())) === 'tool');
  const before = requests.slice();
  await page.click('#stExample');
  await shown();
  const t1 = await timings();
  check('the example: from the click to the table under 1 s (spec §9)', t1.example < 1000, t1);
  check('an NC1 set shows no 3D panel until a click', await page.isHidden('#stView'));
  check('no worker, web-ifc or three.js for an NC1 set', !requests.some(u => /worker\.js|web-ifc|three/.test(u)), requests.filter(u => /steel|vendor/.test(u)));
  check('the page itself loaded no engine', !before.some(u => /web-ifc|three|worker/.test(u)), before.filter(u => /vendor/.test(u)));

  // 2. The summary and the table: the pinned figures of the example.
  let s = await summary();
  check('summary: 6 files read, 16 pieces in 6 marks, 1,069.0 kg, 29.89 m²', s.Files === '6 read, 0 skipped' && s.Pieces === '16 pieces in 6 marks' && s['Total weight'] === '1,069.0 kg' && s['Total surface'] === '29.89 m²', s);
  check('summary: longest PU1 · 13,500 mm, heaviest R1 · 212.1 kg, bath ⚠ 2 / ✗ 0, no check ⚠', s['Longest piece'] === 'PU1 · 13,500 mm' && s['Heaviest piece'] === 'R1 · 212.1 kg' && s.Bath === '12.6 × 1.3 × 1.8 m · ⚠ 2 double dip · ✗ 0 don\'t fit' && s['⚠ Geometry check'] === '0 marks', s);
  const g = await groups();
  check('the groups by profile and grade, heaviest first', JSON.stringify(g) === JSON.stringify([
    'IPE300 | S355 | 10.05 m | 2 | 424.1 | 11.66 |  | ✓', 'HEA200 | S355 | 8.00 m | 2 | 338.4 | 9.09 |  | ✓', 'RHS100*50*4 | S275 | 27.00 m | 2 | 237.1 | 7.83 |  | ⚠ 2',
    'PL 15 | S275 | 1.60 m | 4 | 36.4 | 0.71 |  | ✓', 'PL 20 | S275 | 0.60 m | 2 | 27.2 | 0.41 |  | ✓', 'L80*8 | S275 | 0.60 m | 4 | 5.8 | 0.19 |  | ✓']), g);
  await page.click('[data-toggle="RHS100X50X4|S275"]');
  const pu = await page.$$eval('tr.st-piece', trs => trs.map(tr => [...tr.cells].map(c => c.innerText.trim()).join(' | ')));
  check('a group opens to its pieces: mark, drawing, length, quantity, kg, m², check, bath', JSON.stringify(pu) === JSON.stringify(['PU1 | D-103 | 13,500 mm | 2 | 237.1 | 7.83 | ✓ | ⚠']), pu);
  check('the bath mark explains itself on hover', (await page.$eval('tr.st-piece td:last-child', td => td.title)) === 'double dip');
  await page.selectOption('#stSort', 'mark');
  check('sorted by mark: the groups by profile name', (await groups()).map(x => x.split(' | ')[0]).join(',') === 'HEA200,IPE300,L80*8,PL 15,PL 20,RHS100*50*4', await groups());
  await page.selectOption('#stSort', 'length');
  check('sorted by length: the longest group first', (await groups())[0].startsWith('RHS100*50*4'), await groups());
  await page.selectOption('#stSort', 'kg');

  // 3. The rates change the cost block; an empty rate leaves its line off; the minimum charge; VAT; per grade.
  check('no rate: the cost block asks for one', (await costRows())[0] === 'Fill in a rate in the settings to price this take-off.', await costRows());
  const typeIn = async (sel, v) => { await page.fill(sel, v); await page.press(sel, 'Tab'); };
  await typeIn('#stRate_galv', '0.45');
  await typeIn('#stRate_zinc', '0.05');
  await typeIn('#stRate_paint', '12');
  let c = await costRows();
  check('galvanizing, zinc and painting lines, each its quantity × rate', JSON.stringify(c) === JSON.stringify([
    'Galvanizing | 1,069.0 kg | 0.450 €/kg | 481.05 €', 'Zinc surcharge | 1,069.0 kg | 0.050 €/kg | 53.45 €', 'Painting | 29.89 m² | 12.000 €/m² | 358.68 €',
    'Subtotal | 893.18 €', 'VAT 24% | 214.36 €', 'Total | 1,107.54 €']), c);
  await typeIn('#stRate_minimum', '1000');
  c = await costRows();
  check('a minimum charge above the subtotal applies, with VAT on it', c.includes('Minimum charge of 1,000.00 € applies | 1,000.00 €') && c.includes('VAT 24% | 240.00 €') && c.includes('Total | 1,240.00 €'), c);
  await page.click('#stVat');
  c = await costRows();
  check('VAT off', c.includes('No VAT | 0.00 €') && c.includes('Total | 1,000.00 €'), c);
  await typeIn('#stRate_paint', '');
  await typeIn('#stRate_minimum', '');
  await page.click('#stPerGrade');
  await typeIn('#stGrade_S275', '1,1');
  await typeIn('#stGrade_S355', '1.2');
  c = await costRows();
  check('the steel material per grade: one line each', c.includes('Steel material S275 | 306.5 kg | 1.100 €/kg | 337.15 €') && c.includes('Steel material S355 | 762.5 kg | 1.200 €/kg | 915.00 €') && !c.some(x => x.startsWith('Painting')), c);
  await typeIn('#stGrade_S275', '');
  c = await costRows();
  check('a grade with weight and no rate stays as an unpriced line, with a note, outside the total', c.includes('Steel material S275 | 306.5 kg | – | –') && c.includes('Steel material S355 | 762.5 kg | 1.200 €/kg | 915.00 €') && (await page.isVisible('#stUnpriced')) && (await page.innerText('#stUnpriced')).includes('306.5 kg') && c.includes('Subtotal | 1,449.50 €'), [c, await page.innerText('#stUnpriced')]);
  await typeIn('#stGrade_S275', '1,1');
  check('the note goes when every grade has its rate', await page.isHidden('#stUnpriced'));
  await typeIn('#stRate_galv', 'abc');
  check('a rate that is not a number is marked, and the last good one kept', (await page.getAttribute('#stRate_galv', 'aria-invalid')) === 'true' && (await costRows())[0].startsWith('Galvanizing | 1,069.0 kg | 0.450'), await costRows());
  await typeIn('#stRate_galv', '0.45');
  await typeIn('#stBath_length', '13.6');
  s = await summary();
  check('a longer bath: the purlins now fit', s.Bath === '13.6 × 1.3 × 1.8 m · ⚠ 0 double dip · ✗ 0 don\'t fit', s.Bath);
  await page.reload();
  await page.evaluate(() => { window.__ga = []; window.gtag = (...a) => window.__ga.push(a); window.print = () => {}; });
  check('the settings are remembered in this browser', (await page.inputValue('#stBath_length')) === '13.6' && (await page.inputValue('#stGrade_S355')) === '1.2' && (await page.isChecked('#stPerGrade')) && !(await page.isChecked('#stVat')),
    [await page.inputValue('#stBath_length'), await page.inputValue('#stGrade_S355')]);
  await page.evaluate(() => localStorage.removeItem('aidedcam-steel-settings'));
  await page.reload();
  await page.evaluate(() => { window.__ga = []; window.gtag = (...a) => window.__ga.push(a); window.print = () => { window.__printed = 1; }; });
  await page.click('#stExample');
  await shown();
  await typeIn('#stRate_galv', '0.45');

  // 4. The Excel file downloads and reads back: four sheets in the visitor's language.
  const x = await download('#stXlsx');
  const parts = unzip(x.bytes);
  const sheetNames = [...(parts['xl/workbook.xml'] || '').matchAll(/<sheet name="([^"]*)"/g)].map(m => m[1]);
  check('the Excel file: steel-takeoff-portal.xlsx, sheets Pieces, Profiles, Costs, Settings', x.name === 'steel-takeoff-portal.xlsx' && JSON.stringify(sheetNames) === JSON.stringify(['Pieces', 'Profiles', 'Costs', 'Settings']), { name: x.name, sheetNames });
  check('the pieces sheet lists every mark; the costs sheet the galvanizing line', ['C1', 'R1', 'PU1', 'CL1', 'BP1', 'HP1'].every(m => parts['xl/worksheets/sheet1.xml'].includes(`>${m}<`)) && parts['xl/worksheets/sheet3.xml'].includes('<v>481.05</v>'), null);

  // 5. Print: the A4 sheet without the 3D view and the controls.
  await page.click('[data-toggle="IPE300|S355"]');
  await page.click('tr.st-piece');
  await view();
  await page.click('#stPrint');
  await page.emulateMedia({ media: 'print' });
  const pr = await page.evaluate(() => Object.fromEntries(['#stView', '#stSettings', '.st-outputs', 'tr.st-piece', '#stTable', '#stCosts', '#stSummary', '.gv-print-head', '.st-print-note', '.gv-bar'].map(q => [q, getComputedStyle(document.querySelector(q)).display])));
  await page.emulateMedia({ media: 'screen' });
  check('print hides the 3D view, the settings, the buttons and the piece rows; keeps a title, the summary, the groups, the costs and the note',
    pr['#stView'] === 'none' && pr['#stSettings'] === 'none' && pr['.st-outputs'] === 'none' && pr['tr.st-piece'] === 'none' && pr['.gv-bar'] === 'none' &&
    pr['#stTable'] !== 'none' && pr['#stCosts'] !== 'none' && pr['#stSummary'] !== 'none' && pr['.gv-print-head'] !== 'none' && pr['.st-print-note'] !== 'none', pr);
  check('Print / PDF calls the browser\'s print', (await page.evaluate(() => window.__printed)) === 1);

  // 6. A piece in 3D: three.js only now; the time from the click to the first frame.
  const three = requests.filter(u => /three\.module\.js/.test(u));
  const t3 = (await timings()).view3d;
  check('a piece click shows it in 3D under 300 ms, three.js loaded only then (spec §9)', t3 < 300 && three.length === 1 && three[0] === BASE + 'js/vendor/three/three.module.js' && requests.some(u => u.endsWith('js/steel/view3d.js?v=20261005')), { t3, three });
  const ink = await page.evaluate(() => [window.__steel.view3d.shown, window.__steel.view3d.meshes, window.__steel.view3d.ink()]);
  check('the IPE300 rafter drawn: web and two flanges', ink[0] === 'piece' && ink[1] === 3 && ink[2] > 2000, ink);
  check('the heading names the piece', (await page.innerText('#st3dHead')) === 'R1 · IPE300');
  for (const p of ['top', 'front', 'side', 'iso']) await page.click(`[data-preset="${p}"]`);
  await page.click('#st3dFit');
  check('whole model is for an IFC only', await page.isHidden('#st3dModel'));
  await page.click('[data-toggle="PL 15|S275"]');
  await page.click('tr.st-piece >> text=HP1');
  await page.waitForFunction(() => document.querySelector('#st3dHead').innerText.startsWith('HP1'));
  check('a plate in 3D: one slab with its six holes', (await page.evaluate(() => [window.__steel.view3d.shown, window.__steel.view3d.meshes]))[1] === 1);
  const ga1 = await page.evaluate(() => window.__ga.map(a => `${a[1]} ${JSON.stringify(a[2])}`));
  check('GA: example, xlsx, view3d once, print; no names or figures', JSON.stringify(ga1) === JSON.stringify(['steel_example {}', 'steel_xlsx {}', 'steel_view3d {"result":"shown"}', 'steel_print {}']), ga1);
  if (env.SHOT) await page.screenshot({ path: `${env.SHOT}/steel-1280.png`, fullPage: true });

  // 7. The IFC of the same frame: the same totals within 2 %, its members and assemblies, its 3D.
  await page.click('#stExampleIfc');
  await page.waitForFunction(() => /portal\.ifc/.test(document.querySelector('#stSummary').innerText), null, { timeout: 30000 });
  const tIfc = (await timings()).example;
  await checked();
  s = await summary();
  check('the IFC example: 16 members, 4 assemblies, 16 pieces, 1,069.2 kg (NC1: 1,069.0), 29.88 m²', s.IFC === 'portal.ifc · IFC4' && s.Members === '16 members, 4 assemblies' && s.Pieces === '16 pieces in 6 marks' && s['Total weight'] === '1,069.2 kg' && s['Total surface'] === '29.88 m²', s);
  check('the IFC example loads under 3 s (web-ifc included) and its check pass ends with no ⚠', tIfc < 3000 && s['⚠ Geometry check'] === '0 marks', { tIfc, check: (await timings()).check });
  // The whole model is open as soon as the IFC has loaded: no click, nothing highlighted, the toggle not offered yet.
  await page.waitForFunction(() => window.__steel.view3d && window.__steel.view3d.shown === 'model' && !document.querySelector('#stView').hidden && document.querySelector('#st3dNote').hidden, null, { timeout: 30000 });
  let v = await page.evaluate(() => ({ head: document.querySelector('#st3dHead').innerText, sel: document.querySelectorAll('tr.st-piece.is-sel').length, toggle: document.querySelector('#st3dModel').hidden, meshes: window.__steel.view3d.meshes, ink: window.__steel.view3d.ink() }));
  check('an IFC shows its whole model in 3D before any click: heading "Whole model", nothing highlighted, no toggle', v.head === 'Whole model' && v.sel === 0 && v.toggle === true && v.ink > 2000, v);
  const wholeMeshes = v.meshes;
  check('right after the auto-open: exactly two meshes (two grades, no highlight)', wholeMeshes === 2, wholeMeshes);
  await page.emulateMedia({ media: 'print' });
  const prOpen = await page.evaluate(() => getComputedStyle(document.querySelector('#stView')).display);
  await page.emulateMedia({ media: 'screen' });
  check('print with the whole model open: the 3D view is hidden', prOpen === 'none', prOpen);
  await page.click('[data-toggle="HEA200|S355"]');
  await page.click('tr.st-piece');
  await page.waitForFunction(() => /·/.test(document.querySelector('#st3dHead').innerText));
  v = await page.evaluate(() => ({ shown: window.__steel.view3d.shown, meshes: window.__steel.view3d.meshes, head: document.querySelector('#st3dHead').innerText, label: document.querySelector('#st3dModel').innerText.trim(), hidden: document.querySelector('#st3dModel').hidden, pressed: document.querySelector('#st3dModel').getAttribute('aria-pressed') }));
  check('a piece click keeps the whole model, highlights the piece, names it, and offers "This piece only"', v.shown === 'model' && v.meshes === wholeMeshes + 1 && /^\S+ · HEA200$/.test(v.head) && v.label === 'This piece only' && v.hidden === false && v.pressed === 'true', { v, wholeMeshes });
  await page.click('#st3dModel');
  await page.waitForFunction(() => window.__steel.view3d.shown === 'member');
  v = await page.evaluate(() => [window.__steel.view3d.ink(), document.querySelector('#st3dModel').innerText.trim(), document.querySelector('#st3dModel').getAttribute('aria-pressed')]);
  check('"This piece only" shows the piece alone; the button reads "Whole model", aria-pressed false', v[0] > 2000 && v[1] === 'Whole model' && v[2] === 'false', v);
  await page.click('#st3dModel');
  await page.waitForFunction(() => window.__steel.view3d.shown === 'model');
  v = await page.evaluate(() => [window.__steel.view3d.meshes, document.querySelector('#st3dModel').innerText.trim(), document.querySelector('#st3dModel').getAttribute('aria-pressed')]);
  check('"Whole model" switches back: every member by grade, the piece highlighted, "This piece only", aria-pressed true', v[0] === wholeMeshes + 1 && v[1] === 'This piece only' && v[2] === 'true', v);
  const gaIfc = await page.evaluate(() => window.__ga.map(a => a[1]).filter(n => n === 'steel_view3d').length);
  check('GA: steel_view3d once per set (the NC1 piece, then the IFC auto-open)', gaIfc === 2, gaIfc);

  // The late model: a new file or Clear right after the IFC's auto-open began must drop the old model.
  for (const how of ['Clear', 'NC1 example']) {
    await page.click('#stExampleIfc');
    await page.waitForFunction(() => !document.querySelector('#stView').hidden && !document.querySelector('#stPanel').hidden, null, { timeout: 30000 });
    await page.click(how === 'Clear' ? '#stClear' : '#stExample');
    await page.waitForTimeout(3000);
    const late = await page.evaluate(() => ({ hidden: document.querySelector('#stView').hidden, shown: window.__steel.view3d ? window.__steel.view3d.shown : null, meshes: window.__steel.view3d ? window.__steel.view3d.meshes : 0 }));
    check(`${how} right after an IFC's auto-open: no old model comes back`, late.shown !== 'model' && late.meshes === 0 && (how === 'Clear' ? late.hidden : true), late);
  }

  // 8. The errors of spec §7, each one line in the visitor's language.
  const c1 = await page.evaluate(async () => (await fetch('js/steel/examples/portal/C1.nc1')).text());
  await files('#stFiles', [['C1.nc1', c1], ['notes.txt', 'hello'], ['bad.nc1', c1.replace('4000.00', '40x0.00')], ['dxf.nc', '0\nSECTION\n'], ['locked.zip', zipOf([['a.nc1', c1]], 1)],
    ['z.zip', zipOf([['P1.nc1', c1.replace('C1', 'P1')], ['readme.pdf', 'x']])], ['so.nc1', c1.replace('  HEA200', '  ZS175').replace('\r\n  I\r\n', '\r\n  SO\r\n').replace('42.300', ' 0.000')]]);
  await shown();
  s = await summary();
  const skipped = await page.$$eval('#stSkippedList li', li => li.map(l => l.textContent));
  check('files read and skipped, each skipped file named with its reason', s.Files === '3 read, 5 skipped' && JSON.stringify(skipped) === JSON.stringify([
    'notes.txt: not an NC1 file', 'locked.zip: the ZIP is encrypted', 'readme.pdf: not an NC1 file', 'bad.nc1: invalid NC1, line 11', 'dxf.nc: not an NC1 file']), { files: s.Files, skipped });
  check('a special profile without kg/m: left out of the totals, counted', s['⚠ Left out of the totals'] === '1 marks' && s.Pieces === '6 pieces in 3 marks', s);
  await files('#stFiles', [['notes.txt', 'hello']]);
  await page.waitForFunction(() => !document.querySelector('#stError').hidden);
  check('nothing readable: one line', (await page.innerText('#stError')) === 'notes.txt: No NC1 piece was found.', await page.innerText('#stError'));
  const WALL = "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION((''),'2;1');\nFILE_NAME('w.ifc','2026-01-01T00:00:00',(''),(''),'','','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n#1=IFCPROJECT('0000000000000000000001',$,'P',$,$,$,$,(#5),#2);\n#2=IFCUNITASSIGNMENT((#3));\n#3=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);\n#4=IFCAXIS2PLACEMENT3D(#6,$,$);\n#5=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#4,$);\n#6=IFCCARTESIANPOINT((0.,0.,0.));\n#7=IFCLOCALPLACEMENT($,#4);\n#8=IFCAXIS2PLACEMENT2D(#9,$);\n#9=IFCCARTESIANPOINT((2000.,100.));\n#10=IFCRECTANGLEPROFILEDEF(.AREA.,$,#8,4000.,200.);\n#11=IFCDIRECTION((0.,0.,1.));\n#12=IFCEXTRUDEDAREASOLID(#10,#4,#11,3000.);\n#13=IFCSHAPEREPRESENTATION(#5,'Body','SweptSolid',(#12));\n#14=IFCPRODUCTDEFINITIONSHAPE($,$,(#13));\n#15=IFCWALL('0000000000000000000002',$,'W',$,$,#7,#14,$,$);\nENDSEC;\nEND-ISO-10303-21;\n";
  await files('#stFiles', [['walls.ifc', WALL], ['C1.nc1', c1]]);
  await page.waitForFunction(() => !document.querySelector('#stError').hidden);
  check('an IFC without IfcBeam, IfcColumn, IfcMember or IfcPlate', (await page.innerText('#stError')) === 'walls.ifc: No steel members found (IfcBeam, IfcColumn, IfcMember, IfcPlate).', await page.innerText('#stError'));
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(150 * 1024 * 1024 + 1)], 'huge.ifc'));
    const input = document.querySelector('#stFiles'); input.files = dt.files; input.dispatchEvent(new Event('change'));
  });
  await page.waitForFunction(() => /huge\.ifc/.test(document.querySelector('#stError').innerText));
  check('an IFC over 150 MB is refused before reading', (await page.innerText('#stError')) === 'huge.ifc: The IFC is over 150 MB and was not read.', await page.innerText('#stError'));
  // 500 NC1 files (spec §9: under 2 s), and over 2,000 (the first 2,000 read, with a note).
  const many = n => page.evaluate(async ([text, n]) => {
    const dt = new DataTransfer();
    for (let i = 0; i < n; i++) dt.items.add(new File([text.replace('  C1\r\n', `  C${i}\r\n`)], `C${i}.nc1`));
    delete window.__steel.timings.file;
    const input = document.querySelector('#stFiles'); input.files = dt.files; input.dispatchEvent(new Event('change'));
  }, [c1, n]);
  await many(500);
  await page.waitForFunction(() => window.__steel.timings.file >= 0, null, { timeout: 30000 });
  const t500 = (await timings()).file;
  check('500 NC1 files under 2 s', t500 < 2000 && (await summary()).Pieces === '1000 pieces in 500 marks', { t500, p: (await summary()).Pieces });
  await many(2001);
  await page.waitForFunction(() => !document.querySelector('#stCapped').hidden, null, { timeout: 60000 });
  check('over 2,000 NC1 files: the first 2,000, with a note', (await page.innerText('#stCapped')) === 'The first 2,000 NC1 files were read.' && (await summary()).Files === '2000 read, 0 skipped', [await page.innerText('#stCapped'), (await summary()).Files]);
  const ga2 = await page.evaluate(() => window.__ga.filter(a => a[1] === 'steel_loaded' || a[1] === 'steel_error').map(a => `${a[1]} ${JSON.stringify(a[2])}`));
  check('GA: loaded with the kind and a bucket, errors with a reason', JSON.stringify(ga2) === JSON.stringify(['steel_loaded {"kind":"zip","pieces":"1-10"}', 'steel_error {"reason":"nonc1"}', 'steel_error {"reason":"nosteel"}', 'steel_error {"reason":"limit"}', 'steel_loaded {"kind":"nc1","pieces":"101-1000"}', 'steel_loaded {"kind":"nc1","pieces":"over-1000"}']), ga2);

  // 9. No WebGL2: the 3D view says so; the rest works.
  const ctx2 = await page.context().browser().newContext();
  const p2 = await ctx2.newPage();
  watch(p2);
  await p2.addInitScript(() => { const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, ...a) { return /webgl/.test(k) ? null : get.call(this, k, ...a); }; });
  await p2.goto(BASE + 'steel-takeoff.html?lang=en');
  await p2.evaluate(() => localStorage.setItem('privacy-pref', 'declined'));
  await p2.click('#stExample');
  await p2.waitForFunction(() => !document.querySelector('#stPanel').hidden);
  await p2.click('.st-expand');
  await p2.click('tr.st-piece');
  await p2.waitForFunction(() => !document.querySelector('#st3dNote').hidden && !/Preparing/.test(document.querySelector('#st3dNote').innerText));
  check('no WebGL2: "3D is not available in this browser.", the table still there', (await p2.innerText('#st3dNote')) === '3D is not available in this browser.' && (await p2.$$('tr.st-group')).length === 6, await p2.innerText('#st3dNote'));
  await ctx2.close();

  // 9b. Over the cap: the worker answers "too large" (stubbed in the page); the note shows, the table and quote stay.
  const ctx3 = await page.context().browser().newContext();
  const p3 = await ctx3.newPage();
  watch(p3);
  await p3.addInitScript(() => {
    const W = window.Worker;
    window.Worker = function (...a) {
      const w = new W(...a), post = w.postMessage.bind(w);
      w.postMessage = (m, t) => {
        if (m && m.settings && m.settings.mesh) { setTimeout(() => w.onmessage && w.onmessage({ data: { type: 'result', id: m.id, name: m.name, mesh: null, triangles: 9e6, reason: 'large' } }), 0); return; }
        return post(m, t);
      };
      return w;
    };
  });
  await p3.goto(BASE + 'steel-takeoff.html?lang=en');
  await p3.evaluate(() => localStorage.setItem('privacy-pref', 'declined'));
  await p3.click('#stExampleIfc');
  await p3.waitForFunction(() => !document.querySelector('#stView').hidden && !document.querySelector('#st3dNote').hidden && !/Preparing/.test(document.querySelector('#st3dNote').innerText), null, { timeout: 30000 });
  const big = await p3.evaluate(() => ({ note: document.querySelector('#st3dNote').innerText, groups: document.querySelectorAll('tr.st-group').length, kg: document.querySelector('#stSummary').innerText.includes('1,069.2 kg'), total: document.querySelectorAll('#stCosts tbody tr').length }));
  check('over the cap: the note says the model is too large; the table, summary and quote are filled', big.note === 'This model is too large for the 3D view in this browser.' && big.groups === 6 && big.kg && big.total > 3, big);
  await ctx3.close();

  // 10. Greek: the figures in Greek format; 375 px: no sideways scroll, the table scrolls in its box.
  await page.click('.lang-btn[data-lang="el"]');
  await page.evaluate(() => { delete window.__steel.timings.example; });
  await page.click('#stExample');
  await page.waitForFunction(() => window.__steel.timings.example >= 0);
  s = await summary();
  check('Greek: the summary re-rendered, 1.069,0 kg', s['Συνολικό βάρος'] === '1.069,0 kg' && s['Συνολική επιφάνεια'] === '29,89 m²', s);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.click('.st-expand');
  await page.click('tr.st-piece');
  await view();
  // The view built at 1280 px is resized by its ResizeObserver, a frame or two after the viewport change.
  await page.waitForFunction(() => Math.round(window.__steel.view3d.canvas.getBoundingClientRect().width) === Math.round(document.querySelector('#st3dBox').getBoundingClientRect().width), null, { timeout: 5000 }).catch(() => {});
  const phone = await page.evaluate(() => {
    const wrap = document.querySelector('#stTable').closest('.gv-table-wrap');
    return { scroll: [document.documentElement.scrollWidth, document.documentElement.clientWidth], table: [wrap.scrollWidth > wrap.clientWidth, getComputedStyle(wrap).overflowX], canvas: Math.round(window.__steel.view3d.canvas.getBoundingClientRect().width), box: Math.round(document.querySelector('#st3dBox').getBoundingClientRect().width) };
  });
  check('at 375 px: no sideways page scroll; the table scrolls inside its own box; the 3D view fits', phone.scroll[0] === phone.scroll[1] && phone.table[0] && phone.table[1] === 'auto' && phone.canvas === phone.box && phone.canvas <= 375 - 32, phone);
  const costBox = await page.evaluate(() => {
    const wrap = document.querySelector('#stCosts').closest('.gv-table-wrap'), w = wrap.getBoundingClientRect();
    const lastCells = [...document.querySelectorAll('#stCosts tbody tr')].map(tr => tr.cells[tr.cells.length - 1].getBoundingClientRect().right);
    return { rows: lastCells.length, maxRight: Math.max(...lastCells), wrapRight: w.right, scrolls: wrap.scrollWidth > wrap.clientWidth };
  });
  check('at 375 px: the cost table keeps its amount column inside its box', costBox.rows > 3 && costBox.maxRight <= costBox.wrapRight + 0.5 && !costBox.scrolls, costBox);
  if (env.SHOT) await page.screenshot({ path: `${env.SHOT}/steel-375.png`, fullPage: true });

  // 11. The tools index lists the tool in its group, without a sideways scroll.
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(BASE + 'free-tools.html?lang=en');
    const card = await page.evaluate(() => { const a = document.querySelector('.ft-row[href="steel-takeoff.html"]'); return a && a.querySelector('.ft-cat').innerText; });
    const scroll = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    check(`index at ${width} px: the card in Steel and building products, no sideways scroll`, /steel and building products/i.test(card || '') && scroll[0] === scroll[1], { card, scroll });
  }

  // 12. A large IFC outside the repo (BIG=<path>): the time to the table, and to the end of the check.
  if (env.BIG) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await fresh();
    const big = require('node:fs').readFileSync(env.BIG);
    const t0 = Date.now();
    await page.setInputFiles('#stFiles', { name: require('node:path').basename(env.BIG), mimeType: 'application/octet-stream', buffer: big });
    await shown();
    const table = Date.now() - t0;
    await checked();
    const all = Date.now() - t0;
    s = await summary();
    check(`BIG: ${(big.length / 1048576).toFixed(1)} MB to the table in ${table} ms (under 3 s), the check done at ${all} ms; ${s.Members}, ${s['Total weight']}, ⚠ ${s['⚠ Geometry check']}`, table < 3000, { table, all, s });
  }

  // 13. Nothing external, no console errors.
  check('no external requests', external.length === 0, external);
  check('no console errors', errors.length === 0, errors);
  check(`timings ${JSON.stringify({ example: t1.example, ifc: tIfc, view3d: t3, files500: t500 })}`, true, null);
  return { pass: checks.filter(c => c.ok).length, fail: checks.filter(c => !c.ok).length, checks };
}
