#!/usr/bin/env python3
"""Builds the "see how it works" story pages of the #lyseis cards (lathe-cam.html, mold-cam.html)
from what-you-gain.html's shared parts: head (meta, canonical, hreflang, GA consent), nav, footer,
consent banner and the i18n + consent script. Only the story, its CSS and its translations are new.

    python _src/case-pages/build.py          from the repo root

Edit the texts and steps below, never the generated pages. Every sentence must be a fact from the
card or visible in the application's screens (the images are demo recordings; each page says so).
Media: _src/case-pages/media.sh.
"""
import re, sys, os

def between(s, a, b, inc_b=False):
    i = s.index(a); j = s.index(b, i)
    return s[i:j + (len(b) if inc_b else 0)]

LATHE_T = {
 'el': {
  '_title': 'AidedCAM - Εφαρμογή CAD/CAM για τόρνο: από 2 μέρες σε 12 λεπτά',
  '_description': 'Πώς μια εφαρμογή CAD/CAM που φτιάξαμε για μηχανουργείο τόρνου πηγαίνει από το σχέδιο DXF στο G-code Fanuc σε έξι βήματα: σχεδιασμός και προγραμματισμός από 2 μέρες σε 12 λεπτά.',
  'case.back': 'Αρχική',
  'case.label': 'Λύση που φτιάξαμε · Μηχανουργείο τόρνου',
  'case.title': 'Εφαρμογή CAD/CAM για τόρνο. <strong>Από το σχέδιο στο G-code σε έξι βήματα.</strong>',
  'case.lead': 'Από το σχέδιο του κομματιού στο πρόγραμμα της μηχανής, χωρίς άλλο λογισμικό CAM. Ο σχεδιασμός και ο προγραμματισμός που έπαιρναν 2 μέρες γίνονται σε 12 λεπτά.',
  'case.v_before': '2 μέρες', 'case.v_after': '12 λεπτά', 'case.what': 'σχεδιασμός και προγραμματισμός',
  'case.s1_t': 'Το σχέδιο μπαίνει ως DXF',
  'case.s1_d': 'Εισάγετε το σχέδιο του κομματιού. Η εφαρμογή διαβάζει τα layers του, και το προφίλ διορθώνεται με τα δικά της εργαλεία: γραμμή, τόξο, fillet, chamfer, trim.',
  'case.s2_t': 'Το προφίλ κλείνει και ελέγχεται',
  'case.s2_d': 'Η εφαρμογή μετρά διάμετρο και μήκος, βρίσκει ελεύθερα άκρα και επικαλύψεις, και σας λέει αν το προφίλ μπορεί να γίνει στερεό εκ περιστροφής.',
  'case.s3_t': '3D κομμάτι με ένα κλικ, στημένο στο τσοκ',
  'case.s3_d': 'Το προφίλ γίνεται 3D κομμάτι. Ορίζετε το ακατέργαστο, τις σιαγόνες και την πρώτη πλευρά, και τα βλέπετε όλα στην οθόνη πριν από την πρώτη κοπή.',
  'case.s4_t': 'Πλευρά Α: εκχόνδριση, φάτσα, φινίρισμα',
  'case.s4_d': 'Κύκλοι G71, G72 και G70, με το βάθος κοπής, το πρόσωμα και την πρόωση που ορίζετε. Η διαδρομή του εργαλείου σχεδιάζεται πάνω στο κομμάτι.',
  'case.s5_t': 'Πλευρά Β, με την Α κλειδωμένη',
  'case.s5_d': 'Μόλις η πλευρά Α σημειωθεί ως έτοιμη, το κομμάτι γυρίζει για την πλευρά Β και στήνεται με τους ίδιους κύκλους.',
  'case.s6_t': 'G-code Fanuc για κάθε πλευρά',
  'case.s6_d': 'Το πρόγραμμα της μηχανής βγαίνει για κάθε πλευρά και φαίνεται δίπλα στο κομμάτι. Αποθηκεύεται έτοιμο για τον τόρνο, χωρίς άλλο λογισμικό CAM.',
  'case.note': 'Οι εικόνες είναι από την εφαρμογή, με ένα δοκιμαστικό κομμάτι.',
  'case.out_title': 'Το αποτέλεσμα: <strong>12 λεπτά αντί για 2 μέρες.</strong>',
  'case.out_text': 'Έχετε κι εσείς μια δουλειά που σήμερα θέλει μέρες; Πείτε μας ποια είναι. Θα απαντήσουμε εντός 48 ωρών με το πώς θα το φτιάχναμε.',
  'case.cta_contact': 'Περιγράψτε τη δουλειά', 'case.cta_call': 'Κλείστε μια κλήση', 'case.cta_all': 'Όλες οι λύσεις',
 },
 'en': {
  '_title': 'AidedCAM - A CAD/CAM application for the lathe: from 2 days to 12 minutes',
  '_description': 'How a CAD/CAM application we built for a lathe machine shop goes from the DXF drawing to Fanuc G-code in six steps: design and programming from 2 days to 12 minutes.',
  'case.back': 'Home',
  'case.label': 'A solution we built · Lathe machine shop',
  'case.title': 'A CAD/CAM application for the lathe. <strong>From the drawing to G-code in six steps.</strong>',
  'case.lead': 'From the part drawing to the machine program, with no other CAM software. The design and programming that took 2 days now take 12 minutes.',
  'case.v_before': '2 days', 'case.v_after': '12 min', 'case.what': 'design and programming',
  'case.s1_t': 'The drawing comes in as a DXF',
  'case.s1_d': 'You import the part drawing. The application reads its layers, and the profile can be corrected with its own tools: line, arc, fillet, chamfer, trim.',
  'case.s2_t': 'The profile is closed and checked',
  'case.s2_d': 'The application measures diameter and length, finds open ends and overlaps, and tells you whether the profile can be revolved into a solid.',
  'case.s3_t': 'A 3D part in one click, set up in the chuck',
  'case.s3_d': 'The profile becomes a 3D part. You set the stock, the jaws and the first side, and see all of it on screen before the first cut.',
  'case.s4_t': 'Side A: roughing, facing, finishing',
  'case.s4_d': 'G71, G72 and G70 cycles, with the depth of cut, allowance and feed you set. The toolpath is drawn on the part.',
  'case.s5_t': 'Side B, with side A locked',
  'case.s5_d': 'Once side A is marked done, the part turns round for side B and is set up with the same cycles.',
  'case.s6_t': 'Fanuc G-code for each side',
  'case.s6_d': 'The machine program comes out for each side and shows next to the part. It is saved ready for the lathe, with no other CAM software.',
  'case.note': 'The images are from the application, with a test part.',
  'case.out_title': 'The result: <strong>12 minutes instead of 2 days.</strong>',
  'case.out_text': 'Do you have a job that takes days today? Tell us which one. We reply within 48 hours with how we would build it.',
  'case.cta_contact': 'Describe the job', 'case.cta_call': 'Book a call', 'case.cta_all': 'All solutions',
 },
 'it': {
  '_title': 'AidedCAM - Un’applicazione CAD/CAM per il tornio: da 2 giorni a 12 minuti',
  '_description': 'Come un’applicazione CAD/CAM che abbiamo sviluppato per un’officina di tornitura passa dal disegno DXF al G-code Fanuc in sei passi: progettazione e programmazione da 2 giorni a 12 minuti.',
  'case.back': 'Home',
  'case.label': 'Una soluzione realizzata · Officina di tornitura',
  'case.title': 'Un’applicazione CAD/CAM per il tornio. <strong>Dal disegno al G-code in sei passi.</strong>',
  'case.lead': 'Dal disegno del pezzo al programma della macchina, senza altro software CAM. La progettazione e la programmazione che richiedevano 2 giorni ora richiedono 12 minuti.',
  'case.v_before': '2 giorni', 'case.v_after': '12 min', 'case.what': 'progettazione e programmazione',
  'case.s1_t': 'Il disegno entra come DXF',
  'case.s1_d': 'Importate il disegno del pezzo. L’applicazione ne legge i layer, e il profilo si corregge con i suoi strumenti: linea, arco, raccordo, smusso, taglio.',
  'case.s2_t': 'Il profilo viene chiuso e controllato',
  'case.s2_d': 'L’applicazione misura diametro e lunghezza, trova estremi aperti e sovrapposizioni, e vi dice se il profilo può diventare un solido di rivoluzione.',
  'case.s3_t': 'Un pezzo 3D con un clic, montato nel mandrino',
  'case.s3_d': 'Il profilo diventa un pezzo 3D. Impostate il grezzo, le griffe e il primo lato, e vedete tutto a schermo prima del primo taglio.',
  'case.s4_t': 'Lato A: sgrossatura, sfacciatura, finitura',
  'case.s4_d': 'Cicli G71, G72 e G70, con la profondità di passata, il sovrametallo e l’avanzamento che impostate. Il percorso utensile si disegna sul pezzo.',
  'case.s5_t': 'Lato B, con il lato A bloccato',
  'case.s5_d': 'Quando il lato A è segnato come finito, il pezzo si gira per il lato B e si imposta con gli stessi cicli.',
  'case.s6_t': 'G-code Fanuc per ogni lato',
  'case.s6_d': 'Il programma della macchina esce per ogni lato e si vede accanto al pezzo. Si salva pronto per il tornio, senza altro software CAM.',
  'case.note': 'Le immagini sono dell’applicazione, con un pezzo di prova.',
  'case.out_title': 'Il risultato: <strong>12 minuti invece di 2 giorni.</strong>',
  'case.out_text': 'Avete anche voi un lavoro che oggi richiede giorni? Diteci quale. Vi rispondiamo entro 48 ore con come lo costruiremmo.',
  'case.cta_contact': 'Descrivete il lavoro', 'case.cta_call': 'Prenota una chiamata', 'case.cta_all': 'Tutte le soluzioni',
 },
}
# step: image (or {'video', 'poster'}), zoom origin x/y (%), zoom
LATHE_STEPS = [('img/lathe-cam/step-1.webp', 40, 45, 1.35), ('img/lathe-cam/step-2.webp', 88, 30, 2.1), ('img/lathe-cam/step-3.webp', 55, 55, 1.25),
               ('img/lathe-cam/step-4.webp', 55, 45, 1.35), ('img/lathe-cam/step-5.webp', 40, 32, 1.6), ('img/lathe-cam/step-6.webp', 90, 32, 1.9)]


def build(w, PAGE, T, STEPS, BAR, SLUG):
    EL = T['el']

    head = w[:w.index('  <noscript>')]
    head = head.replace('what-you-gain.html', PAGE)
    for old in re.findall(r'AidedCAM - Τι Κερδίζετε', head):
        pass
    head = head.replace('AidedCAM - Τι Κερδίζετε', EL['_title'])
    head = re.sub(r'(content=")Δείτε τι κερδίζετε[^"]*(")', lambda m: m.group(1) + EL['_description'] + m.group(2), head)
    assert 'Κερδίζετε' not in head and 'κερδίζετε' not in head, 'head text left'

    nav_css = between(w, '    /* ── nav-back: page-specific link with left-arrow glyph ── */', '    /* ── CTA right-arrow glyph ── */')
    foot_css = between(w, '    /* ===== FOOTER (page-specific compact ROI footer) ===== */', '    /* ===== Fade-in delay aliases')

    CSS = nav_css + foot_css + '''
        /* ===== CASE STORY =====
           A scrollytelling page: the steps scroll on the left while one window on the right stays put
           and shows the application at that step, zoomed to the part of the screen the step is about
           (STORY script: .is-on on the step and its shot; the zoom is each shot's --x/--y/--z).
           Without JS every step reads at full strength and the first shot shows; under reduced motion
           the switch is instant. The images are frames of the demo recording (test part). */
        .cs-eyebrow { font-family: var(--font-mono); font-size: 0.7rem; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent-deep); }
        .cs-hero { padding: clamp(4.5rem, 9vw, 7rem) 0 clamp(2.5rem, 5vw, 3.5rem); border-bottom: 1px solid var(--line); }
        .cs-hero h1 { margin: 1rem 0 0; max-width: 22ch; font-family: var(--font-display); font-weight: 300; font-size: clamp(2.2rem, 4.6vw, 3.7rem); line-height: 1.08; color: var(--ink); }
        .cs-hero h1 strong { display: block; font-weight: 600; color: var(--accent-deep); }
        .cs-lead { max-width: 40rem; margin: 1.4rem 0 0; font-size: 1.15rem; line-height: 1.6; color: var(--ink-soft); }
        .cs-result { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.4rem 1.2rem; margin-top: 2rem; }
        .cs-result s { font-family: var(--font-display); font-weight: 300; font-size: clamp(2rem, 4vw, 3rem); line-height: 1; color: var(--faint); text-decoration-color: var(--accent); text-decoration-thickness: 3px; }
        .cs-result b { font-family: var(--font-display); font-weight: 300; font-size: clamp(2.4rem, 5vw, 3.8rem); line-height: 1; color: var(--accent-deep); }
        .cs-result span { font-size: 0.95rem; color: var(--muted); }
        .cs-story { padding: clamp(1rem, 3vw, 2rem) 0 clamp(3rem, 6vw, 5rem); }
        .cs-grid { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: clamp(2rem, 4vw, 4rem); }
        .cs-steps { grid-column: 1; grid-row: 1; }
        .cs-step { min-height: 78vh; display: flex; flex-direction: column; justify-content: center; padding: 2rem 0; transition: opacity 0.4s var(--ease-out); }
        .cs-armed .cs-step:not(.is-on) { opacity: 0.32; }
        .cs-num { font-family: var(--font-mono); font-size: 0.68rem; font-weight: 500; letter-spacing: 0.14em; color: var(--accent-deep); }
        .cs-step h2 { margin: 0.7rem 0 0.8rem; font-family: var(--font-display); font-weight: 500; font-size: clamp(1.45rem, 2.4vw, 1.9rem); line-height: 1.2; color: var(--ink); }
        .cs-step p { margin: 0; max-width: 32rem; font-size: 1.05rem; line-height: 1.65; color: var(--ink-soft); }
        .cs-stage { grid-column: 2; grid-row: 1; position: sticky; top: max(84px, calc(50vh - 13rem)); align-self: start; margin-top: 26vh; }
        .cs-frame { background: var(--panel); border: 1px solid var(--line-strong); border-radius: 3px; box-shadow: var(--elev-1); overflow: hidden; }
        .cs-bar { display: flex; align-items: center; gap: 5px; padding: 0.55rem 0.8rem; border-bottom: 1px solid var(--line); }
        .cs-bar i { width: 7px; height: 7px; border-radius: 50%; background: var(--line-strong); }
        .cs-bar span { margin-left: auto; font-family: var(--font-mono); font-size: 0.56rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--faint); }
        .cs-view { position: relative; aspect-ratio: 2400 / 1368; overflow: hidden; background: var(--paper-2); }
        .cs-shot { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0;
          transform-origin: var(--x) var(--y); transform: scale(1);
          transition: opacity 0.5s ease, transform 0.9s cubic-bezier(0.77, 0, 0.175, 1); }
        .cs-shot.is-on { opacity: 1; transform: scale(var(--z)); }
        .cs-note { margin: 0.7rem 0 0; font-size: 0.78rem; color: var(--faint); }
        .cs-out { padding: clamp(3rem, 6vw, 5rem) 0; border-top: 1px solid var(--line); background: var(--paper-2); text-align: center; }
        .cs-out h2 { margin: 0 auto; max-width: 24ch; font-family: var(--font-display); font-weight: 300; font-size: clamp(1.8rem, 3.4vw, 2.6rem); line-height: 1.15; color: var(--ink); }
        .cs-out h2 strong { display: block; font-weight: 600; color: var(--accent-deep); }
        .cs-out p { max-width: 36rem; margin: 1rem auto 0; font-size: 1.05rem; line-height: 1.6; color: var(--ink-soft); }
        .cs-cta { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 0.8rem 1.2rem; margin-top: 1.8rem; }
        .cs-all { display: inline-block; margin-top: 1.4rem; font-size: 0.85rem; font-weight: 600; color: var(--accent-deep); text-decoration: underline; text-underline-offset: 3px; }
        @media (max-width: 900px) {
          .cs-grid { grid-template-columns: 1fr; gap: 0; }
          .cs-stage { grid-column: 1; grid-row: 1; top: 64px; z-index: 5; margin: 0; padding: 0.6rem 0 0.8rem; background: var(--paper); }
          .nav-back { display: none; }  /* as on what-you-gain.html: the logo leads home */
          .cs-steps { grid-row: 2; }
          .cs-step { min-height: 58vh; }
          .cs-cta { flex-direction: column; align-items: stretch; }
        }
    '''

    # ---------- body ----------
    nav = between(w, '  <!-- NAVIGATION -->', '  <!-- ROI CONTENT').replace('data-i18n="roi.back"', 'data-i18n="case.back"')
    footer = between(w, '    <!-- FOOTER -->', '  </div>\n\n  <!-- COOKIE CONSENT BANNER -->')
    consent = between(w, '  <!-- COOKIE CONSENT BANNER -->', '  <script>\n    // ===== TRANSLATIONS =====')

    steps_html = ''
    for i, _st in enumerate(STEPS, 1):
        steps_html += f'''          <article class="cs-step" data-i="{i-1}">
                <div class="cs-num">0{i} / 06</div>
                <h2 data-i18n="case.s{i}_t">{EL[f"case.s{i}_t"]}</h2>
                <p data-i18n="case.s{i}_d">{EL[f"case.s{i}_d"]}</p>
              </article>
    '''
    def shot_html(i, m, x, y, z):
        on = ' is-on' if i == 0 else ''
        st = f'--x:{x}%;--y:{y}%;--z:{z}'
        if isinstance(m, dict):
            return (f'<video class="cs-shot{on}" muted loop playsinline preload="none" disablepictureinpicture disableremoteplayback '
                    f'width="2400" height="1368" style="{st}" poster="{m["poster"]}" data-src="{m["video"]}"></video>')
        return f'<img class="cs-shot{on}" src="{m}" alt="" width="2400" height="1368" style="{st}"{"" if i == 0 else " loading=\"lazy\""} />'
    shots_html = ''.join(shot_html(i, *st) for i, st in enumerate(STEPS))

    MAIN = f'''  <main id="main" class="roi-content">
        <section class="cs-hero">
          <div class="container">
            <div class="cs-eyebrow" data-i18n="case.label">{EL['case.label']}</div>
            <h1 data-i18n-html="case.title">{EL['case.title']}</h1>
            <p class="cs-lead" data-i18n="case.lead">{EL['case.lead']}</p>
            <p class="cs-result"><s data-i18n="case.v_before">{EL['case.v_before']}</s><b data-i18n="case.v_after">{EL['case.v_after']}</b><span data-i18n="case.what">{EL['case.what']}</span></p>
          </div>
        </section>

        <section class="cs-story">
          <div class="container cs-grid">
            <div class="cs-steps">
    {steps_html}        </div>
            <div class="cs-stage">
              <div class="cs-frame" aria-hidden="true">
                <div class="cs-bar"><i></i><i></i><i></i><span>{BAR}</span></div>
                <div class="cs-view">{shots_html}</div>
              </div>
              <p class="cs-note" data-i18n="case.note">{EL['case.note']}</p>
            </div>
          </div>
        </section>

        <section class="cs-out">
          <div class="container">
            <h2 data-i18n-html="case.out_title">{EL['case.out_title']}</h2>
            <p data-i18n="case.out_text">{EL['case.out_text']}</p>
            <div class="cs-cta">
              <a href="index.html#contact" class="btn-primary" data-i18n="case.cta_contact">{EL['case.cta_contact']}</a>
              <a href="call.html" class="btn-secondary" data-i18n="case.cta_call">{EL['case.cta_call']}</a>
            </div>
            <a href="index.html#lyseis" class="cs-all" data-i18n="case.cta_all">{EL['case.cta_all']}</a>
          </div>
        </section>

    {footer}  </main>

    '''

    # ---------- script ----------
    script = w[w.index('  <script>\n    // ===== TRANSLATIONS ====='):w.index('</body>')]
    # keep the shared keys of each language, swap the page keys for ours
    def keep_shared(block):
        keys = re.findall(r"\n\s*'((?:cookie_|footer\.)[^']*)':\s*('(?:[^'\\]|\\.)*')", block)
        return keys
    langs = {}
    for lang, nxt in (('el', 'en'), ('en', 'it'), ('it', None)):
        a = script.index(f'      {lang}: {{')
        b = script.index(f'      {nxt}: {{', a) if nxt else script.index('    };', a)
        langs[lang] = keep_shared(script[a:b])
    def js(v): return "'" + v.replace('\\', '\\\\').replace("'", "\\'") + "'"
    tr = '    var translations = {\n'
    for lang in ('el', 'en', 'it'):
        lines = [f"        '{k}': {js(v)}" for k, v in T[lang].items() if not k.startswith('_')]
        lines += [f"        '{k}': {v}" for k, v in langs[lang]]
        lines += [f"        '_title': {js(T[lang]['_title'])}", f"        '_description': {js(T[lang]['_description'])}"]
        tr += f'      {lang}: {{\n' + ',\n'.join(lines) + '\n      }' + (',' if lang != 'it' else '') + '\n'
    tr += '    };\n'
    a = script.index('    var translations = {'); b = script.index('    };', a) + len('    };\n')
    script = script[:a] + tr + script[b:]

    # drop the calculator-lead greeting and the bar animations; start the story instead
    a = script.index('    // The whole page is open'); b = script.index('    initScrollAnimations();', a) + len('    initScrollAnimations();\n')
    script = script[:a] + '''    initScrollAnimations();
        initStory();
    ''' + script[b:]
    a = script.index('    // ===== STORED LEAD'); b = script.index('    // ===== SCROLL-TRIGGERED FADE-IN =====')
    script = script[:a] + script[b:]
    a = script.index('    // ===== BAR ANIMATIONS ====='); b = script.index('    // ===== COOKIE CONSENT =====')
    script = script[:a] + '''    // ===== STORY =====
        // The step nearest the middle of the window is the active one: it reads
        // at full strength and its shot shows in the window, zoomed to the part of
        // the screen the step is about (each shot's --x/--y/--z). Without JS the
        // first shot shows and every step reads normally.
        function initStory() {
          var story = document.querySelector('.cs-story');
          var steps = document.querySelectorAll('.cs-step');
          var shots = document.querySelectorAll('.cs-shot');
          if (!story || !steps.length || !('IntersectionObserver' in window)) return;
        var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          story.classList.add('cs-armed');
          function activate(i) {
            steps.forEach(function (s, k) { s.classList.toggle('is-on', k === i); });
            shots.forEach(function (im, k) {
            im.classList.toggle('is-on', k === i);
            if (im.tagName !== 'VIDEO') return;
            if (k === i && !reduce) {
              if (!im.getAttribute('src')) im.src = im.getAttribute('data-src');
              var p = im.play(); if (p && p.catch) p.catch(function () {});
            } else if (!im.paused) { im.pause(); }
          });
          }
          var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) { if (e.isIntersecting) activate(+e.target.getAttribute('data-i')); });
          }, { rootMargin: '-45% 0px -45% 0px' });
          steps.forEach(function (s) { io.observe(s); });
          activate(0);
          document.querySelectorAll('.cs-cta a, .cs-all').forEach(function (a) {
            a.addEventListener('click', function () {
              gaEvent('click_call_to_action', { text: a.textContent.trim(), href: a.href || '', location: 'case___SLUG__' });
            });
          });
        }

    ''' + script[b:]
    assert 'getLeadData' not in script and 'startBarAnimations' not in script, 'leftovers'

    page = (head + '  <noscript><style>.fade-in { opacity: 1 !important; transform: none !important; }</style></noscript>\n'
            '  <style>\n' + CSS + '  </style>\n'
            '  <link rel="stylesheet" href="css/sidebar.css?v=20261005" />\n  <script src="js/sidebar.js?v=20261005" defer></script>\n'
            '</head>\n<body>\n\n' + nav + MAIN + consent + script + '</body>\n</html>\n')
    page = page.replace('__SLUG__', SLUG)
    open(PAGE, 'w', encoding='utf-8', newline='\n').write(page)
    print(PAGE, len(page))

MOLD_T = {
 'el': {
  '_title': 'AidedCAM - Αυτοματισμός καλουπιών σε PowerShape και PowerMill: από 4 μέρες σε 26 λεπτά',
  '_description': 'Πώς μια εφαρμογή που φτιάξαμε για κατασκευή καλουπιών διαβάζει τα εξαρτήματα του καλουπιού, φτιάχνει το πλάνο δρομολόγησης και προγραμματίζει τις τρύπες της πλάκας μόνη της: από 4 μέρες σε 26 λεπτά ανά πλάκα.',
  'case.back': 'Αρχική',
  'case.label': 'Λύση που φτιάξαμε · Κατασκευή καλουπιών',
  'case.title': 'Αυτοματισμός καλουπιών μέσα σε PowerShape και PowerMill. <strong>Από το καλούπι στις διαδρομές της πλάκας.</strong>',
  'case.lead': 'Η εφαρμογή διαβάζει τα εξαρτήματα του καλουπιού και προγραμματίζει τις τυποποιημένες κατεργασίες με ένα κουμπί. Ο προγραμματισμός μιας πλάκας που έπαιρνε 4 μέρες γίνεται σε 26 λεπτά.',
  'case.v_before': '4 μέρες', 'case.v_after': '26 λεπτά', 'case.what': 'για τον προγραμματισμό μιας πλάκας',
  'case.s1_t': 'Τα εξαρτήματα διαβάζονται από το καλούπι',
  'case.s1_d': 'Η εφαρμογή διαβάζει το καλούπι στο PowerShape, εξάρτημα προς εξάρτημα, και κρατά για το καθένα όνομα, layer και ποσότητα.',
  'case.s2_t': 'Επιλέγετε τι μπαίνει στο πλάνο',
  'case.s2_d': 'Από τα διαθέσιμα εξαρτήματα κρατάτε όσα θα κατεργαστεί το μηχανουργείο. Τα υπόλοιπα μένουν έξω από το πλάνο.',
  'case.s3_t': 'Πλάνο δρομολόγησης ανά φάση',
  'case.s3_d': 'Κάθε εξάρτημα παίρνει προτεραιότητα και κατάσταση, αντί για χειρόγραφο πλάνο. Το πλάνο τυπώνεται και συγχρονίζεται όταν αλλάξει το καλούπι.',
  'case.s4_t': 'Workplanes για κάθε πλευρά κατεργασίας',
  'case.s4_d': 'Επιλέγετε την πλευρά κατεργασίας, και η εφαρμογή στήνει τα workplanes στο εξάρτημα, για παράδειγμα CNC UP και CNC DOWN.',
  'case.s5_t': 'Ένα project PowerMill για κάθε εξάρτημα',
  'case.s5_d': 'Με ένα κουμπί δημιουργείται το project του PowerMill για το εξάρτημα, και η πλάκα ανοίγει εκεί έτοιμη για προγραμματισμό.',
  'case.s6_t': 'Οι τρύπες προγραμματίζονται μόνες τους',
  'case.s6_d': 'Η εφαρμογή αναγνωρίζει τις τρύπες της πλάκας και φτιάχνει τις διαδρομές με τη σειρά και τους κανόνες της εταιρείας: τρύπημα, θύλακες, κατεργασία τρυπών, φάλτσα, φινίρισμα, και στο τέλος έλεγχο συγκρούσεων.',
  'case.note': 'Οι εικόνες είναι από την εφαρμογή, με ένα δοκιμαστικό καλούπι. Η ίδια λύση δουλεύει και σε Siemens NX.',
  'case.out_title': 'Το αποτέλεσμα: <strong>26 λεπτά αντί για 4 μέρες.</strong>',
  'case.out_text': 'Έχετε κι εσείς μια δουλειά που σήμερα θέλει μέρες; Πείτε μας ποια είναι. Θα απαντήσουμε εντός 48 ωρών με το πώς θα το φτιάχναμε.',
  'case.cta_contact': 'Περιγράψτε τη δουλειά', 'case.cta_call': 'Κλείστε μια κλήση', 'case.cta_all': 'Όλες οι λύσεις',
 },
 'en': {
  '_title': 'AidedCAM - Mould automation in PowerShape and PowerMill: from 4 days to 26 minutes',
  '_description': 'How an application we built for a mould maker reads the mould’s components, builds the routing plan and programs the plate’s holes by itself: from 4 days to 26 minutes per plate.',
  'case.back': 'Home',
  'case.label': 'A solution we built · Mould making',
  'case.title': 'Mould automation inside PowerShape and PowerMill. <strong>From the mould to the plate’s toolpaths.</strong>',
  'case.lead': 'The application reads the mould’s components and programs the standard machining with one button. Programming a plate, which took 4 days, now takes 26 minutes.',
  'case.v_before': '4 days', 'case.v_after': '26 min', 'case.what': 'to program a mould plate',
  'case.s1_t': 'The components are read from the mould',
  'case.s1_d': 'The application reads the mould in PowerShape, component by component, and keeps each one’s name, layer and quantity.',
  'case.s2_t': 'You choose what goes into the plan',
  'case.s2_d': 'From the available components you keep the ones the shop will machine. The rest stay out of the plan.',
  'case.s3_t': 'A routing plan by phase',
  'case.s3_d': 'Each component gets a priority and a status, instead of a hand-written plan. The plan prints, and syncs when the mould changes.',
  'case.s4_t': 'Workplanes for each machining side',
  'case.s4_d': 'You pick the machining side, and the application sets up the workplanes on the component, for example CNC UP and CNC DOWN.',
  'case.s5_t': 'One PowerMill project per component',
  'case.s5_d': 'One button creates the component’s PowerMill project, and the plate opens there ready to be programmed.',
  'case.s6_t': 'The holes program themselves',
  'case.s6_d': 'The application recognises the plate’s holes and builds the toolpaths in the company’s order and by its rules: drilling, pockets, hole machining, chamfers, finishing, and a collision check at the end.',
  'case.note': 'The images are from the application, with a test mould. The same solution also works in Siemens NX.',
  'case.out_title': 'The result: <strong>26 minutes instead of 4 days.</strong>',
  'case.out_text': 'Do you have a job that takes days today? Tell us which one. We reply within 48 hours with how we would build it.',
  'case.cta_contact': 'Describe the job', 'case.cta_call': 'Book a call', 'case.cta_all': 'All solutions',
 },
 'it': {
  '_title': 'AidedCAM - Automazione stampi in PowerShape e PowerMill: da 4 giorni a 26 minuti',
  '_description': 'Come un’applicazione che abbiamo sviluppato per un costruttore di stampi legge i componenti dello stampo, crea il piano di lavorazione e programma da sola i fori della piastra: da 4 giorni a 26 minuti per piastra.',
  'case.back': 'Home',
  'case.label': 'Una soluzione realizzata · Costruzione stampi',
  'case.title': 'Automazione stampi in PowerShape e PowerMill. <strong>Dallo stampo ai percorsi della piastra.</strong>',
  'case.lead': 'L’applicazione legge i componenti dello stampo e programma le lavorazioni standard con un pulsante. La programmazione di una piastra, che richiedeva 4 giorni, ora richiede 26 minuti.',
  'case.v_before': '4 giorni', 'case.v_after': '26 min', 'case.what': 'per programmare una piastra stampo',
  'case.s1_t': 'I componenti si leggono dallo stampo',
  'case.s1_d': 'L’applicazione legge lo stampo in PowerShape, componente per componente, e di ognuno tiene nome, layer e quantità.',
  'case.s2_t': 'Scegliete cosa entra nel piano',
  'case.s2_d': 'Tra i componenti disponibili tenete quelli che l’officina lavorerà. Gli altri restano fuori dal piano.',
  'case.s3_t': 'Un piano di lavorazione per fase',
  'case.s3_d': 'Ogni componente riceve una priorità e uno stato, al posto di un piano scritto a mano. Il piano si stampa e si sincronizza quando lo stampo cambia.',
  'case.s4_t': 'Workplane per ogni lato di lavorazione',
  'case.s4_d': 'Scegliete il lato di lavorazione, e l’applicazione imposta i workplane sul componente, per esempio CNC UP e CNC DOWN.',
  'case.s5_t': 'Un progetto PowerMill per ogni componente',
  'case.s5_d': 'Un pulsante crea il progetto PowerMill del componente, e la piastra si apre lì pronta per la programmazione.',
  'case.s6_t': 'I fori si programmano da soli',
  'case.s6_d': 'L’applicazione riconosce i fori della piastra e crea i percorsi nell’ordine e con le regole dell’azienda: foratura, tasche, lavorazione dei fori, smussi, finitura, e alla fine un controllo collisioni.',
  'case.note': 'Le immagini sono dell’applicazione, con uno stampo di prova. La stessa soluzione funziona anche in Siemens NX.',
  'case.out_title': 'Il risultato: <strong>26 minuti invece di 4 giorni.</strong>',
  'case.out_text': 'Avete anche voi un lavoro che oggi richiede giorni? Diteci quale. Vi rispondiamo entro 48 ore con come lo costruiremmo.',
  'case.cta_contact': 'Descrivete il lavoro', 'case.cta_call': 'Prenota una chiamata', 'case.cta_all': 'Tutte le soluzioni',
 },
}
MOLD_STEPS = [('img/mold-cam/step-1.webp', 15, 92, 1.5), ('img/mold-cam/step-2.webp', 42, 22, 1.5), ('img/mold-cam/step-3.webp', 45, 45, 1.3),
              ('img/mold-cam/step-4.webp', 50, 50, 1.15), ('img/mold-cam/step-5.webp', 35, 40, 1.45),
              ({'video': 'video/case-mold-toolpaths.mp4', 'poster': 'img/mold-cam/step-6.webp'}, 50, 50, 1.0)]

if __name__ == '__main__':
    w = open('what-you-gain.html', encoding='utf-8').read()
    build(w, 'lathe-cam.html', LATHE_T, LATHE_STEPS, '.acam', 'lathe')
    build(w, 'mold-cam.html', MOLD_T, MOLD_STEPS, 'routing plan', 'mold')
