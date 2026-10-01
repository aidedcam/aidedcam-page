// Free-tools sidebar, on every page (spec: _docs/tools-sidebar/2026-10-01-tools-sidebar-design.md).
// It injects one <nav>: on a wide screen with a mouse, a slim strip of tool icons in the page's left gutter that
// expand into a card on hover or focus; otherwise (narrow, touch, or no gutter wide enough) a floating "Tools"
// button that opens a panel. Strings are el/en/it and follow <html lang>, since pages announce a language change
// with different events. The click is reported to GA only through window.gtag, which exists after consent.
(function () {
  'use strict';

  // The order and URLs of free-tools.html's cards; ids are its translation keys (ft.<id>.title).
  const TOOLS = [
    { id: 'lathe', href: 'gcode-viewer.html' },
    { id: 'mill', href: 'milling-gcode-viewer.html' },
    { id: 'laser', href: 'laser-dxf-checker.html' },
    { id: 'dwgq', href: 'dwg-quantities.html' },
    { id: 'coverage', href: 'coverage-precheck.html' },
    { id: 'ifcplans', href: 'ifc-plans.html' },
  ];
  const ALL_HREF = 'free-tools.html';

  // Names are the cards' titles; each line is the card's text cut to one line.
  const COPY = {
    el: {
      label: 'Δωρεάν εργαλεία',
      button: 'Εργαλεία',
      all: 'Όλα τα δωρεάν εργαλεία',
      tools: {
        lathe: { name: 'Προβολή G-code τόρνου', line: 'Τα περάσματα των κύκλων, ο χρόνος κύκλου και τα λάθη προγραμματισμού.' },
        mill: { name: 'Προβολή G-code φρέζας', line: 'Κάθε κίνηση σε 3D, οι κύκλοι διάτρησης και ο χρόνος ανά εργαλείο.' },
        laser: { name: 'Έλεγχος DXF για κοπή laser', line: 'Διορθώνει DXF και DWG, δίνει μήκος κοπής, βάρος και χρόνο.' },
        dwgq: { name: 'Επιμετρήσεις από DWG', line: 'Μήκη, εμβαδά και μπλοκ ανά στρώση, με λήψη σε Excel.' },
        coverage: { name: 'Προέλεγχος διαγράμματος κάλυψης', line: 'Κάλυψη, δόμηση και όγκος από το DWG, απέναντι στους όρους δόμησης.' },
        ifcplans: { name: 'Κατόψεις DXF από IFC', line: 'Μία κάτοψη R12 DXF ανά όροφο από το IFC του αρχιτέκτονα.' },
      },
    },
    en: {
      label: 'Free tools',
      button: 'Tools',
      all: 'All free tools',
      tools: {
        lathe: { name: 'Lathe G-code viewer', line: 'The passes of the cycles, cycle time per tool and common mistakes.' },
        mill: { name: 'Milling G-code viewer', line: 'Every move in 3D, drilling cycles expanded, time per tool.' },
        laser: { name: 'Laser DXF check', line: 'Repairs DXF and DWG files; cut length, weight and time.' },
        dwgq: { name: 'Quantities from DWG', line: 'Lengths, areas and blocks per layer, with an Excel download.' },
        coverage: { name: 'Coverage diagram pre-check', line: 'Coverage, built area and volume, checked against the zone’s terms.' },
        ifcplans: { name: 'DXF floor plans from IFC', line: 'One R12 DXF floor plan per storey from the architect’s IFC.' },
      },
    },
    it: {
      label: 'Strumenti gratuiti',
      button: 'Strumenti',
      all: 'Tutti gli strumenti gratuiti',
      tools: {
        lathe: { name: 'Visualizzatore G-code per tornio', line: 'Le passate dei cicli, il tempo ciclo e gli errori più comuni.' },
        mill: { name: 'Visualizzatore G-code per fresa', line: 'Ogni movimento in 3D, i cicli di foratura, il tempo per utensile.' },
        laser: { name: 'Controllo DXF per taglio laser', line: 'Corregge DXF e DWG; lunghezza di taglio, peso e tempo.' },
        dwgq: { name: 'Computi da DWG', line: 'Lunghezze, aree e blocchi per layer, con il download in Excel.' },
        coverage: { name: 'Pre-verifica del diagramma di copertura', line: 'Copertura, superficie e volume a confronto con i parametri di zona.' },
        ifcplans: { name: 'Piante DXF da IFC', line: 'Una pianta DXF R12 per piano dall’IFC dell’architetto.' },
      },
    },
  };

  // 24 x 24 line icons, drawn with a 1.5 px stroke in currentColor.
  const ICONS = {
    // A part in the chuck, turned in two diameters, with the insert under it.
    lathe: '<path d="M2.5 4.5h4v15h-4z"/><path d="M6.5 7.5H13v2h7.5v5H13v2H6.5"/><path d="M14.5 21.5l2.5-4.5 2.5 4.5"/>',
    // An end mill with its flutes over a block with a pocket.
    mill: '<path d="M10 2.5h4v4h-4z"/><path d="M10.5 6.5v6.5l1.5 1.5 1.5-1.5V6.5"/><path d="M10.5 9.5l3-1.5M10.5 12l3-1.5"/><path d="M3 16h5.5v2h7v-2H21v5H3z"/>',
    // The laser head, its beam, and the sheet with sparks where it cuts.
    laser: '<path d="M8 2.5h8V7l-3 3.5h-2L8 7z"/><path d="M12 11v5.5" stroke-dasharray="1.6 1.6"/><path d="M2.5 19.5h19"/><path d="M9 17.5l-1.8-1.2M15 17.5l1.8-1.2"/>',
    // A dimension line over a ruler.
    dwgq: '<path d="M3 5h18M3 3.5v3M21 3.5v3"/><path d="M3 10h18v7H3z"/><path d="M6.5 10v3M10 10v4.5M13.5 10v3M17 10v4.5"/>',
    // A plot boundary (dashed) with a hatched building footprint inside it.
    coverage: '<path d="M3.5 7l8-4 9 4.5-2 13h-13z" stroke-dasharray="2 1.8"/><path d="M8.5 9.5h6.5v6.5H8.5z"/><path d="M8.5 13l3.5-3.5M11 16l4-4"/>',
    // A floor plan: outer walls, two partitions and a door swing.
    ifcplans: '<path d="M3 3h18v18H3z"/><path d="M3 12h5M13 12h8M12 12v9"/><path d="M8 12V8"/><path d="M8 8a4 4 0 0 1 4 4"/>',
    all: '<path d="M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z"/>',
    // An open-end wrench.
    wrench: '<path d="M14.5 3.6a4.8 4.8 0 0 0-4.3 6.6l-6.4 6.4a1.9 1.9 0 0 0 2.7 2.7l6.4-6.4a4.8 4.8 0 0 0 6.6-4.3l-2.8 1.9-2.6-.9-.6-2.7z"/>',
  };

  if (typeof document === 'undefined') {                    // Node tests read the data and stop here
    if (typeof module === 'object' && module) module.exports = { TOOLS, COPY, ICONS };
    return;
  }
  if (document.querySelector('.afs')) return;               // loaded twice by mistake

  const svg = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
  const item = (cls, id, href) =>
    `<a class="${cls}" href="${href}" data-tool="${id}"><span class="afs-icon">${svg(ICONS[id])}</span>` +
    `<span class="afs-card"><span class="afs-name"></span>${id === 'all' ? '<span class="afs-arrow" aria-hidden="true"> →</span>' : '<span class="afs-line"></span>'}</span></a>`;

  const nav = document.createElement('nav');
  nav.className = 'afs';
  nav.dataset.layout = 'panel';
  nav.innerHTML =
    `<button class="afs-fab" type="button" aria-expanded="false" aria-controls="afs-list">${svg(ICONS.wrench)}<span class="afs-fab-text"></span></button>` +
    '<div class="afs-list" id="afs-list"><p class="afs-label" aria-hidden="true"></p><ul>' +
    TOOLS.map(t => `<li>${item('afs-item', t.id, t.href)}</li>`).join('') +
    `</ul>${item('afs-all', 'all', ALL_HREF)}</div>`;
  const fab = nav.querySelector('.afs-fab'), list = nav.querySelector('.afs-list');

  // The current page: its tool, or the all-tools box on free-tools.html. A pretty URL (/ifc-plans) counts too.
  let here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (!here.includes('.')) here += '.html';
  nav.querySelectorAll('a[href]').forEach(a => { if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page'); });

  // ---- Language: follows <html lang> ----
  const pick = () => { const l = (document.documentElement.getAttribute('lang') || 'el').slice(0, 2).toLowerCase(); return COPY[l] ? l : 'el'; };
  function render() {
    const c = COPY[pick()];
    nav.setAttribute('aria-label', c.label);
    nav.querySelector('.afs-label').textContent = c.button;
    nav.querySelector('.afs-fab-text').textContent = c.button;
    for (const t of TOOLS) {
      const a = nav.querySelector(`[data-tool="${t.id}"]`);
      a.querySelector('.afs-name').textContent = c.tools[t.id].name;
      a.querySelector('.afs-line').textContent = c.tools[t.id].line;
    }
    nav.querySelector('.afs-all .afs-name').textContent = c.all;
  }
  render();
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  // ---- Layout: the strip only where it fits, else the floating button ----
  const desktop = window.matchMedia('(min-width: 1200px) and (hover: hover) and (pointer: fine)');
  const CLEAR = 5;                                          // px between the strip and the page's content
  // Where the page's content starts: the content box of its layout wrappers (index-style pages and tool pages).
  function contentLeft() {
    let left = Infinity;
    document.querySelectorAll('.container, .nav-container, .gv-wrap').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && !nav.contains(el)) left = Math.min(left, r.left + (parseFloat(getComputedStyle(el).paddingLeft) || 0));
    });
    return left;
  }
  function stripFits() {
    if (!desktop.matches) return false;
    nav.dataset.layout = 'strip';                           // measure the strip where it would sit
    const r = list.getBoundingClientRect();
    return r.right + CLEAR <= contentLeft() && r.height + 2 * 80 <= window.innerHeight;   // clear of the navbar and the banner
  }
  function layout() {
    const strip = stripFits();
    const focused = nav.contains(document.activeElement) && document.activeElement !== fab;
    nav.dataset.layout = strip ? 'strip' : 'panel';
    if (strip) setOpen(false);
    else if (focused) fab.focus();                          // a strip link had focus and is now hidden: keep the place
  }

  // ---- The panel (narrow screens and touch) ----
  function setOpen(open, refocus) {
    const was = nav.classList.contains('is-open');
    nav.classList.toggle('is-open', open);
    fab.setAttribute('aria-expanded', String(open));
    if (was && !open && refocus) fab.focus();
  }
  fab.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  // Esc closes an open panel; the focus goes back to the button only if it was in the sidebar.
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('is-open')) setOpen(false, nav.contains(document.activeElement)); });
  // Focus leaving the sidebar closes the panel, so it never covers what the keyboard lands on. Tab out to the
  // browser's own UI gives no relatedTarget: look again on the next frame.
  nav.addEventListener('focusout', e => {
    if (!nav.classList.contains('is-open')) return;
    if (e.relatedTarget) { if (!nav.contains(e.relatedTarget)) setOpen(false); return; }
    requestAnimationFrame(() => { if (nav.classList.contains('is-open') && !nav.contains(document.activeElement)) setOpen(false); });
  });
  // Back from a tool page through the back/forward cache: the panel comes back closed.
  window.addEventListener('pageshow', e => { if (e.persisted) setOpen(false); });
  document.addEventListener('pointerdown', e => { if (nav.classList.contains('is-open') && !nav.contains(e.target)) setOpen(false); });

  // ---- GA: which tool, from which layout; no names or figures ----
  nav.addEventListener('click', e => {
    const a = e.target.closest('a[data-tool]');
    if (a && typeof window.gtag === 'function') window.gtag('event', 'freetools_sidebar_click', { tool: a.dataset.tool, layout: nav.dataset.layout });
  });

  document.body.appendChild(nav);
  layout();
  let queued = false;
  const relayout = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; layout(); }); } };
  window.addEventListener('resize', relayout);
  if (desktop.addEventListener) desktop.addEventListener('change', relayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
})();
