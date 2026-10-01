// Dev-only browser check of the free-tools sidebar on every page (Jekyll skips _tests). It is one Playwright
// function: run it with the Playwright MCP (browser_run_code_unsafe, filename: _tests/sidebar/browser-check.js) or
// with node _tests/sidebar/browser-check.cjs. It expects the repo root served on http://127.0.0.1:8811/ and returns
// { pass, fail, checks: [{ name, ok, got }] }. With SHOT=<folder> (node runner) it saves full-page screenshots of
// every page at 1280 and 375 px, a 1440 px view with a card open and a 375 px view with the panel open.
async (page) => {
  const BASE = 'http://127.0.0.1:8811/';
  const SHOT = typeof process !== 'undefined' && process.env && process.env.SHOT;
  const PAGES = ['index', 'what-you-gain', 'calculator', 'free-tools', 'gcode-viewer', 'milling-gcode-viewer', 'laser-dxf-checker',
    'dwg-quantities', 'coverage-precheck', 'ifc-plans', 'legal', 'privacy'];
  const TOOL_PAGE = { 'gcode-viewer': 'lathe', 'milling-gcode-viewer': 'mill', 'laser-dxf-checker': 'laser', 'dwg-quantities': 'dwgq', 'coverage-precheck': 'coverage', 'ifc-plans': 'ifcplans', 'free-tools': 'all' };
  const checks = [];
  const check = (name, ok, got) => checks.push({ name, ok: !!ok, got });
  const errors = [], external = [];
  const watch = p => {
    p.on('console', m => { if (m.type() === 'error') errors.push(`${p.url()}: ${m.text()}`); });
    p.on('pageerror', e => errors.push(`${p.url()}: ${e}`));
    p.on('request', r => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
  };
  watch(page);

  // Open a page with the consent already answered (declined: no GA), or with the banner showing.
  const open = async (p, name, { lang = 'el', banner = false } = {}) => {
    await p.goto(BASE + 'privacy.html');
    await p.evaluate(b => { localStorage.clear(); if (!b) localStorage.setItem('privacy-pref', 'declined'); }, banner);
    await p.goto(`${BASE}${name}.html?lang=${lang}`);
    await p.waitForSelector('nav.afs', { state: 'attached' });
    await p.evaluate(() => document.fonts.ready);
  };
  // Scroll the whole page once so scroll reveals have run, then back to the top.
  const reveal = p => p.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 400) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); }
    scrollTo(0, 0); await new Promise(r => setTimeout(r, 700));
  });
  const state = p => p.evaluate(() => {
    const nav = document.querySelector('nav.afs'), list = nav.querySelector('.afs-list'), fab = nav.querySelector('.afs-fab');
    const shown = el => { const r = el.getBoundingClientRect(); return getComputedStyle(el).display !== 'none' && r.width > 0 && r.height > 0; };
    const r = list.getBoundingClientRect();
    nav.style.display = 'none'; const own = document.documentElement.scrollWidth; nav.style.display = '';   // the page alone
    return {
      layout: nav.dataset.layout, label: nav.getAttribute('aria-label'),
      items: [...nav.querySelectorAll('.afs-item')].filter(shown).length, all: shown(nav.querySelector('.afs-all')),
      listShown: shown(list), fabShown: shown(fab), expanded: fab.getAttribute('aria-expanded'), controls: fab.getAttribute('aria-controls'),
      strip: { left: r.left, right: r.right, top: r.top, bottom: r.bottom },
      current: [...nav.querySelectorAll('[aria-current="page"]')].map(a => a.dataset.tool),
      scroll: [document.documentElement.scrollWidth, document.documentElement.clientWidth, own],
    };
  });
  // The leftmost visible content of the page (text, controls, media), clipped by its scroll boxes; the
  // sidebar, the consent banner and the skip link are left out. Opacity is ignored on purpose: content that
  // fades in later or a Μέθοδος view that is not showing yet still counts.
  // The sidebar adds no horizontal scroll: the page is no wider than the screen, or than the page alone.
  const noScroll = s => s.scroll[0] === Math.max(s.scroll[1], s.scroll[2]);
  const leftmost = p => p.evaluate(() => {
    const out = [];
    const vis = e => e.checkVisibility({ visibilityProperty: true });
    const clip = (el, rc) => {
      let l = rc.left, r = rc.right, t = rc.top, b = rc.bottom;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.overflowX !== 'visible' || s.clipPath !== 'none') { const q = a.getBoundingClientRect(); l = Math.max(l, q.left); r = Math.min(r, q.right); }
        if (s.overflowY !== 'visible' || s.clipPath !== 'none') { const q = a.getBoundingClientRect(); t = Math.max(t, q.top); b = Math.min(b, q.bottom); }
        if (s.position === 'fixed') break;
      }
      return r - l >= 1 && b - t >= 1 ? l : null;
    };
    const skip = el => el.closest('nav.afs, .consent-banner, .skip-to-content, script, style, noscript');
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = tw.nextNode())) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement; if (!el || skip(el) || !vis(el)) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const rc of rg.getClientRects()) { const l = clip(el, rc); if (l !== null) out.push([Math.round(l), `${el.tagName.toLowerCase()}.${el.className}: ${n.textContent.trim().slice(0, 30)}`]); }
    }
    for (const el of document.querySelectorAll('img, canvas, svg, input, select, textarea, button, video, iframe, table')) {
      if (skip(el) || !vis(el)) continue;
      const l = clip(el, el.getBoundingClientRect()); if (l !== null) out.push([Math.round(l), `${el.tagName.toLowerCase()}#${el.id}.${el.className.baseVal ?? el.className}`]);
    }
    out.sort((a, b) => a[0] - b[0]);
    return out.slice(0, 3);
  });

  // 1. Desktop widths: the strip only where the page has a gutter for it, and then over no content.
  const layouts = {};
  for (const width of [1200, 1280, 1366, 1440, 1536]) {
    await page.setViewportSize({ width, height: 900 });
    const bad = [], seen = {};
    for (const name of PAGES) {
      await open(page, name);
      await reveal(page);
      const s = await state(page), first = await leftmost(page);
      seen[name] = s.layout;
      if (s.layout === 'strip') {
        if (!(s.items === 6 && s.all && !s.fabShown)) bad.push({ name, s });
        if (first.length && first[0][0] < s.strip.right) bad.push({ name, stripRight: s.strip.right, first });
        if (s.strip.top < 80 || s.strip.bottom > 900 - 80) bad.push({ name, strip: s.strip });
      } else if (!(s.fabShown && !s.listShown)) bad.push({ name, s });
      if (!noScroll(s)) bad.push({ name, scroll: s.scroll });
    }
    layouts[width] = seen;
    check(`at ${width} px: the strip covers no content on any page (else the button)`, bad.length === 0, bad);
  }
  const strips = w => PAGES.filter(n => layouts[w][n] === 'strip');
  check('at 1440 px every page shows the strip', strips(1440).length === PAGES.length, layouts[1440]);
  // The label beside the tiles moves the strip right: the 5vw pages get it from 1280 px, the tool pages (3vw gutter) from 1366.
  check('at 1280 px the pages with the 5vw container show the strip; at 1200 and 1280 px the tool pages show the button; at 1366 px every page the strip',
    ['index', 'what-you-gain', 'calculator', 'legal', 'privacy'].every(n => layouts[1280][n] === 'strip') &&
    Object.keys(TOOL_PAGE).every(n => layouts[1200][n] === 'panel' && layouts[1280][n] === 'panel') &&
    strips(1366).length === PAGES.length, { 1200: layouts[1200], 1280: layouts[1280], 1366: layouts[1366] });

  // 2. At 1440 px: six items and the all-tools box, hover expands a card without moving the page, current page marked.
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, 'index');
  let s = await state(page);
  check('1440 index: strip with six items and the all-tools box, nothing current', s.layout === 'strip' && s.items === 6 && s.all && s.current.length === 0, s);
  const card = id => page.evaluate(id => {
    const a = document.querySelector(`nav.afs [data-tool="${id}"]`), c = a.querySelector('.afs-card'), r = c.getBoundingClientRect(), cs = getComputedStyle(c);
    return { opacity: +cs.opacity, pe: cs.pointerEvents, width: Math.round(r.width), left: Math.round(r.left), text: c.innerText.replace(/\s+/g, ' ').trim(), name: a.innerText.replace(/\s+/g, ' ').trim() };
  }, id);
  const before = await page.evaluate(() => [document.documentElement.scrollHeight, Math.round(document.querySelector('main, section, .container').getBoundingClientRect().left)]);
  let c0 = await card('laser');
  check('at rest the card is hidden and takes no clicks, but names the link', c0.opacity === 0 && c0.pe === 'none' && /laser/i.test(c0.text), c0);
  await page.hover('nav.afs [data-tool="laser"]');
  await page.waitForTimeout(400);
  let c1 = await card('laser');
  const after = await page.evaluate(() => [document.documentElement.scrollHeight, Math.round(document.querySelector('main, section, .container').getBoundingClientRect().left)]);
  check('hover expands the item into its card: name and one line', c1.opacity === 1 && c1.width > 200 && c1.text.startsWith('Έλεγχος DXF για κοπή laser') && c1.text.length > 40, c1);
  check('the hover moves nothing on the page', JSON.stringify(before) === JSON.stringify(after), { before, after });
  if (SHOT) await page.screenshot({ path: `${SHOT}/sb-1440-index-card.png` });
  await page.mouse.move(700, 450);
  await page.keyboard.press('Shift');                                          // a keyboard user: focus is visible
  await page.evaluate(() => document.querySelector('nav.afs [data-tool="ifcplans"]').focus());
  await page.waitForTimeout(400);
  const cf = await card('ifcplans');
  const fr = await page.evaluate(() => getComputedStyle(document.querySelector('nav.afs [data-tool="ifcplans"]')).outlineStyle);
  check('keyboard focus shows the ring and the card', cf.opacity === 1 && fr === 'solid', { cf, fr });

  const unmarked = [];
  for (const [name, id] of Object.entries(TOOL_PAGE)) {
    await open(page, name);
    s = await state(page);
    if (!(s.current.length === 1 && s.current[0] === id)) unmarked.push({ name, current: s.current });
  }
  check('the current tool (or the all-tools box on free-tools.html) is aria-current="page"', unmarked.length === 0, unmarked);
  if (SHOT) {
    await open(page, 'dwg-quantities');
    await page.hover('nav.afs [data-tool="all"]');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOT}/sb-1440-dwg-all-box.png` });
  }

  // 3. Language: the cards follow <html lang>, on the index (languageChanged) and on a tool page (gv:lang).
  for (const [name, btn, want, label] of [['index', 'it', 'Controllo DXF per taglio laser', 'Strumenti'], ['ifc-plans', 'en', 'Laser DXF check', 'Tools']]) {
    await open(page, name);
    await page.click(`.lang-btn[data-lang="${btn}"] >> visible=true`);
    await page.waitForTimeout(100);
    const got = await card('laser'), lab = (await state(page)).label;
    check(`${name}: switching to ${btn.toUpperCase()} changes the cards`, got.text.startsWith(want) && lab === label, { got: got.text, lab });
  }
  await open(page, 'calculator', { lang: 'en' });
  check('a page opened with ?lang=en starts in English', (await card('dwgq')).text.startsWith('Quantities from DWG'), await card('dwgq'));

  // 4. GA: one event with the tool and the layout, only when window.gtag exists (after consent).
  await open(page, 'legal');
  const ga = await page.evaluate(() => {
    const out = { without: null, with: [] };
    document.addEventListener('click', e => e.preventDefault(), true);          // stay on the page
    try { document.querySelector('nav.afs [data-tool="coverage"]').click(); out.without = 'no error'; } catch (e) { out.without = String(e); }
    window.gtag = (...a) => out.with.push(a);
    document.querySelector('nav.afs [data-tool="coverage"]').click();
    document.querySelector('nav.afs [data-tool="all"]').click();
    delete window.gtag;
    return out;
  });
  check('GA: freetools_sidebar_click { tool, layout } through window.gtag only', ga.without === 'no error' &&
    JSON.stringify(ga.with) === JSON.stringify([['event', 'freetools_sidebar_click', { tool: 'coverage', layout: 'strip' }], ['event', 'freetools_sidebar_click', { tool: 'all', layout: 'strip' }]]), ga);

  // 5. The consent banner stays on top of the strip, and its buttons stay clickable.
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: width === 375 ? 800 : 900 });
    await open(page, 'what-you-gain', { banner: true });
    await page.evaluate(() => document.getElementById('privacyManage').click());
    const hits = await page.evaluate(() => [...document.querySelectorAll('#privacyOverlay button')].filter(b => b.offsetParent).map(b => {
      const r = b.getBoundingClientRect(), el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { id: b.id, ok: b.contains(el), on: el && el.className };
    }));
    const z = await page.evaluate(() => [getComputedStyle(document.querySelector('nav.afs .afs-list')).zIndex, getComputedStyle(document.querySelector('nav.afs .afs-fab')).zIndex]);
    check(`at ${width} px the consent banner and its buttons are above the sidebar`, hits.length >= 4 && hits.every(h => h.ok) && z.every(v => v === 'auto' || +v < 9999), { hits, z });
  }

  // 6. At 375 px: no strip, the button opens and closes the panel, no horizontal scroll.
  await page.setViewportSize({ width: 375, height: 800 });
  const phone = [], ownScroll = [], phoneEnd = [];
  for (const name of PAGES) {
    await open(page, name);
    s = await state(page);
    if (!(s.layout === 'panel' && s.fabShown && !s.listShown && s.expanded === 'false' && s.controls === 'afs-list' && noScroll(s))) phone.push({ name, s });
    if (s.scroll[2] > s.scroll[1]) ownScroll.push({ name, scroll: s.scroll });
    // Scrolled to the end, the button sits on none of the page's text or controls.
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(150);
    const covered = await page.evaluate(() => {
      const f = document.querySelector('nav.afs .afs-fab').getBoundingClientRect(), hit = [];
      const meets = r => r.width > 0 && r.height > 0 && r.left < f.right && r.right > f.left && r.top < f.bottom && r.bottom > f.top;
      const skip = el => el.closest('nav.afs, .consent-banner, .skip-to-content, script, style, noscript') || !el.checkVisibility({ visibilityProperty: true, opacityProperty: true });
      const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
      while ((n = tw.nextNode())) {
        if (!n.textContent.trim() || !n.parentElement || skip(n.parentElement)) continue;
        const rg = document.createRange(); rg.selectNodeContents(n);
        if ([...rg.getClientRects()].some(meets)) hit.push(n.textContent.trim().slice(0, 30));
      }
      for (const el of document.querySelectorAll('img, canvas, svg, input, select, textarea, button, video, iframe')) if (!skip(el) && meets(el.getBoundingClientRect())) hit.push(el.tagName);
      return hit;
    });
    if (covered.length) phoneEnd.push({ name, covered });
  }
  check('375 px, every page: the button, no strip, no horizontal scroll from the sidebar', phone.length === 0, phone);
  check('375 px, every page scrolled to the end: the button covers no text or control', phoneEnd.length === 0, phoneEnd);
  // privacy.html's own table is 21 px too wide at 375 px, sidebar or not (known, outside the sidebar); a new one fails.
  check('375 px, the only page that scrolls sideways on its own is privacy.html', JSON.stringify(ownScroll.map(o => o.name)) === JSON.stringify(['privacy']), ownScroll);
  await open(page, 'gcode-viewer');
  await page.click('nav.afs .afs-fab');
  s = await state(page);
  const inView = await page.evaluate(() => { const r = document.querySelector('nav.afs .afs-list').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; });
  check('375: a tap opens the panel with six tools and the all-tools link, inside the screen', s.expanded === 'true' && s.listShown && s.items === 6 && s.all && inView && s.current[0] === 'lathe' && noScroll(s), { s, inView });
  if (SHOT) await page.screenshot({ path: `${SHOT}/sb-375-panel-open.png` });
  await page.keyboard.press('Escape');
  s = await state(page);
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.className);
  check('375: Esc closes it and gives the focus back to the button', s.expanded === 'false' && !s.listShown && focused === 'afs-fab', { s, focused });
  await page.click('nav.afs .afs-fab');
  await page.mouse.click(300, 150);
  s = await state(page);
  check('375: a tap outside closes it', s.expanded === 'false' && !s.listShown, s);
  await page.click('nav.afs .afs-fab');
  await page.click('nav.afs .afs-fab');
  s = await state(page);
  check('375: the button closes it again', s.expanded === 'false' && !s.listShown, s);
  // Keyboard: Tab through the panel and past its end closes it, so it never covers what gets the focus next.
  await page.focus('nav.afs .afs-fab');
  await page.keyboard.press('Enter');
  const openedByKey = (await state(page)).expanded;
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
  await page.waitForTimeout(100);
  s = await state(page);
  const out = await page.evaluate(() => !document.querySelector('nav.afs').contains(document.activeElement));
  check('375: Tab past the end of the panel closes it', openedByKey === 'true' && s.expanded === 'false' && !s.listShown && out, { openedByKey, s, out });
  // A strip link with the focus when the window narrows to the panel layout: the focus moves to the button.
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, 'legal');
  await page.focus('nav.afs [data-tool="mill"]');
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.waitForTimeout(200);
  const moved = await page.evaluate(() => [document.querySelector('nav.afs').dataset.layout, document.activeElement && document.activeElement.className]);
  check('strip to panel with a strip link focused: the focus moves to the button', moved[0] === 'panel' && moved[1] === 'afs-fab', moved);
  await page.setViewportSize({ width: 375, height: 800 });

  // 7. A touch screen gets the button even when it is wide; print hides it; reduced motion has no transitions.
  const touch = await page.context().browser().newContext({ hasTouch: true, viewport: { width: 1440, height: 900 } });
  const tp = await touch.newPage();
  watch(tp);
  await open(tp, 'index');
  s = await state(tp);
  check('a 1440 px touch screen gets the button', s.layout === 'panel' && s.fabShown, { s, hover: await tp.evaluate(() => matchMedia('(hover: hover)').matches) });
  await touch.close();
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, 'index');
  await page.emulateMedia({ media: 'print' });
  const print = await page.evaluate(() => getComputedStyle(document.querySelector('nav.afs')).display);
  await page.emulateMedia({ media: 'screen', reducedMotion: 'reduce' });
  const motion = await page.evaluate(() => getComputedStyle(document.querySelector('nav.afs .afs-card')).transitionDuration);
  await page.emulateMedia({ media: 'screen', reducedMotion: 'no-preference' });
  check('hidden in print, no transition under reduced motion', print === 'none' && /^0s(, 0s)*$/.test(motion), { print, motion });

  // 8. Screenshots of every page, full length, at 1280 and 375 px.
  if (SHOT) {
    for (const width of [1280, 375]) {
      await page.setViewportSize({ width, height: width === 375 ? 800 : 900 });
      for (const name of PAGES) {
        await open(page, name);
        await reveal(page);
        await page.screenshot({ path: `${SHOT}/${name}-${width}.png`, fullPage: true });
      }
    }
  }

  // 9. Nothing external, no console errors.
  check('no external requests', external.length === 0, external);
  check('no console errors', errors.length === 0, errors);
  return { pass: checks.filter(c => c.ok).length, fail: checks.filter(c => !c.ok).length, checks };
}
