#!/usr/bin/env python3
"""Builds the "see how it works" story pages of the #lyseis cards (lathe-cam.html, mold-cam.html,
projects-app.html)
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


def build(w, PAGE, T, STEPS, BAR, SLUG, PANELS=None):
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

    if PANELS:
        # the commands, grouped like the add-in's ribbon panels: icon, the add-in's own (English) name,
        # one line on what it does. Names carry no data-i18n: they are the UI's names in every language.
        rows = ''
        for key, tag, cmds in PANELS:
            items = ''.join(
                f'<li class="cm-item"><img src="icons/revit/{ic[0].lower() + ic[1:]}.svg" alt="" width="32" height="32" loading="lazy" />'
                f'<div><b>{name}</b><span data-i18n="cmd.{ic}">{EL["cmd." + ic]}</span></div></li>'
                for ic, name in cmds)
            rows += (f'          <section class="cm-panel fade-in"><header><h2 data-i18n="cmd.p_{key}">{EL["cmd.p_" + key]}</h2>'
                     f'<span class="cm-tag">{tag} · {len(cmds)}</span></header><ul>{items}</ul></section>\n')
        story = f'''        <section class="cm-list">
          <div class="container">
            <p class="cm-intro" data-i18n="case.intro">{EL['case.intro']}</p>
{rows}          </div>
        </section>
'''
        CSS += '''
        /* ===== COMMANDS (card 03, no recording of Revit) =====
           The add-in's generic commands, grouped like its ribbon panels; the panels fade in as they
           scroll into view (the shared fade-in observer). */
        .cm-list { padding: clamp(2.5rem, 5vw, 4rem) 0 clamp(3rem, 6vw, 5rem); }
        .cm-intro { max-width: 46rem; margin: 0 0 2.2rem; font-size: 1.05rem; line-height: 1.65; color: var(--ink-soft); }
        .cm-panel { margin-top: 2rem; padding: 0; border: 1px solid var(--line-strong); border-radius: 3px; background: var(--panel); }
        .cm-panel header { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; padding: 0.9rem 1.2rem; border-bottom: 1px solid var(--line); background: var(--paper-2); }
        .cm-panel h2 { margin: 0; font-family: var(--font-display); font-weight: 500; font-size: 1.2rem; color: var(--ink); }
        .cm-tag { font-family: var(--font-mono); font-size: 0.64rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }
        .cm-panel ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); }
        .cm-item { display: flex; gap: 0.9rem; align-items: flex-start; padding: 1rem 1.2rem; border-top: 1px solid var(--line); margin-top: -1px; }
        .cm-item img { flex: none; width: 32px; height: 32px; margin-top: 2px; }
        .cm-item b { display: block; font-size: 0.95rem; font-weight: 600; color: var(--ink); }
        .cm-item span { display: block; margin-top: 0.2rem; font-size: 0.9rem; line-height: 1.5; color: var(--ink-soft); }
    '''
    else:
        story = f'''        <section class="cs-story">
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
'''

    MAIN = f'''  <main id="main" class="roi-content">
        <section class="cs-hero">
          <div class="container">
            <div class="cs-eyebrow" data-i18n="case.label">{EL['case.label']}</div>
            <h1 data-i18n-html="case.title">{EL['case.title']}</h1>
            <p class="cs-lead" data-i18n="case.lead">{EL['case.lead']}</p>
            <p class="cs-result"><s data-i18n="case.v_before">{EL['case.v_before']}</s><b data-i18n="case.v_after">{EL['case.v_after']}</b><span data-i18n="case.what">{EL['case.what']}</span></p>
          </div>
        </section>

{story}
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
        initDepth();
    ''' + script[b:]
    a = script.index('    // ===== STORED LEAD'); b = script.index('    // ===== SCROLL-TRIGGERED FADE-IN =====')
    script = script[:a] + script[b:]
    a = script.index('    // ===== BAR ANIMATIONS ====='); b = script.index('    // ===== COOKIE CONSENT =====')
    script = script[:a] + '''    // ===== STORY =====
        // The step nearest the middle of the window is the active one: it reads
        // at full strength and its shot shows in the window, zoomed to the part of
        // the screen the step is about (each shot's --x/--y/--z). Without JS the
        // first shot shows and every step reads normally.
        // ===== READING DEPTH =====
        // Each step of the story (or panel of commands) counts once, as it is first
        // reached, and so does the closing ask: section_became_visible with
        // section "<page>-step-N" / "<page>-end", which the local stats page reads.
        // The first step is not counted (everyone who opens the page sees it).
        function initDepth() {
          if (!('IntersectionObserver' in window)) return;
          var seen = {};
          function mark(name) { if (seen[name]) return; seen[name] = true; gaEvent('section_became_visible', { section: name }); }
          var parts = document.querySelectorAll('.cs-step, .cm-panel');
          var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
              if (!e.isIntersecting) return;
              var i = Array.prototype.indexOf.call(parts, e.target);
              if (i > 0) mark('__SLUG__-step-' + (i + 1));
              io.unobserve(e.target);
            });
          }, { rootMargin: '-45% 0px -45% 0px' });
          parts.forEach(function (p) { io.observe(p); });
          var out = document.querySelector('.cs-out');
          if (out) {
            var io2 = new IntersectionObserver(function (entries) {
              if (entries.some(function (e) { return e.isIntersecting; })) { mark('__SLUG__-end'); io2.disconnect(); }
            }, { threshold: 0.4 });
            io2.observe(out);
          }
        }

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

PROJ_T = {
 'el': {
  '_title': 'AidedCAM - Από τα αρχεία Excel σε μία κοινή εικόνα των έργων',
  '_description': 'Πώς μια εφαρμογή που φτιάξαμε για γραφείο στατικών μελετών βάζει κοστολόγηση, χρονοδιάγραμμα, φόρτο και ώρες σε μία κοινή εφαρμογή, αντί για δεκάδες αρχεία Excel.',
  'case.back': 'Αρχική',
  'case.label': 'Λύση που φτιάξαμε · Γραφείο στατικών μελετών',
  'case.title': 'Από τα αρχεία Excel σε μία κοινή εικόνα των έργων. <strong>Κοστολόγηση, χρονοδιάγραμμα και φόρτος σε μία εφαρμογή.</strong>',
  'case.lead': 'Κοστολόγηση, χρονοδιάγραμμα, φόρτος και ώρες σε μία εφαρμογή, σε κοινή βάση, με τους υπολογισμούς του γραφείου. Όλοι βλέπουν και ενημερώνουν την ίδια εικόνα.',
  'case.v_before': 'Δεκάδες αρχεία Excel', 'case.v_after': 'Μία κοινή πηγή', 'case.what': 'κοστολόγηση, χρονοδιάγραμμα και ώρες',
  'case.s1_t': 'Όλα τα έργα σε μία λίστα',
  'case.s1_d': 'Κάθε έργο σε μία γραμμή: υπεύθυνος, έναρξη, προθεσμία, ημέρες σύμβασης, συνολικές ώρες, εκτίμηση και κατάσταση.',
  'case.s2_t': 'Οι εργασίες, με ώρες ανά ρόλο',
  'case.s2_d': 'Κάθε εργασία του έργου έχει κατηγορία, κατάσταση, υπεύθυνο και ώρες για κάθε ρόλο: μηχανικούς, σχεδιαστές, BIM modeler.',
  'case.s3_t': 'Η εκτίμηση υπολογίζεται ζωντανά',
  'case.s3_d': 'Με κάθε αλλαγή, οι ώρες, το περιθώριο ασφαλείας και οι μέρες ξαναϋπολογίζονται αμέσως, όπως στο φύλλο του γραφείου. Αν η εκτίμηση δεν χωρά στην προθεσμία, η εφαρμογή λέει πόσες μέρες λείπουν.',
  'case.s4_t': 'Ο φόρτος κάθε ανθρώπου, ανά εβδομάδα',
  'case.s4_d': 'Οι ώρες κάθε ανθρώπου ανά εβδομάδα. Οι εβδομάδες πάνω από 40 ώρες, ή με μέρα πάνω από 8, σημειώνονται με κόκκινο.',
  'case.s5_t': 'Το χρονοδιάγραμμα κάθε έργου',
  'case.s5_d': 'Οι εργασίες σε διάγραμμα Gantt, με κατηγορία, κατάσταση και υπεύθυνο, σε προβολή ανά μέρα, εβδομάδα ή μήνα.',
  'case.s6_t': 'Όλα τα έργα, μία εικόνα',
  'case.s6_d': 'Στη μηνιαία προβολή φαίνονται όλα τα έργα μαζί. Ό,τι πριν ζούσε σε δεκάδες αρχεία Excel είναι πια μία κοινή πηγή.',
  'case.note': 'Οι εικόνες είναι από την εφαρμογή, με δοκιμαστικά δεδομένα.',
  'case.out_title': 'Το αποτέλεσμα: <strong>μία κοινή πηγή αντί για δεκάδες αρχεία Excel.</strong>',
  'case.out_text': 'Έχετε κι εσείς δουλειά που ζει σε αρχεία Excel; Πείτε μας ποια είναι. Θα απαντήσουμε εντός 48 ωρών με το πώς θα το φτιάχναμε.',
  'case.cta_contact': 'Περιγράψτε τη δουλειά', 'case.cta_call': 'Κλείστε μια κλήση', 'case.cta_all': 'Όλες οι λύσεις',
 },
 'en': {
  '_title': 'AidedCAM - From Excel files to one shared picture of the projects',
  '_description': 'How an application we built for a structural engineering office puts estimates, schedules, workload and hours in one shared application, instead of dozens of Excel files.',
  'case.back': 'Home',
  'case.label': 'A solution we built · Structural engineering office',
  'case.title': 'From Excel files to one shared picture of the projects. <strong>Estimates, schedule and workload in one application.</strong>',
  'case.lead': 'Estimates, schedule, workload and hours in one application, on a shared database, with the office’s own calculations. Everyone sees and updates the same picture.',
  'case.v_before': 'Dozens of Excel files', 'case.v_after': 'One shared source', 'case.what': 'estimates, schedule and hours',
  'case.s1_t': 'Every project in one list',
  'case.s1_d': 'Each project on one line: project manager, start, deadline, contract days, total hours, estimate and status.',
  'case.s2_t': 'The tasks, with hours per role',
  'case.s2_d': 'Each task of the project has a category, a status, an assignee and hours for each role: engineers, drafters, BIM modeller.',
  'case.s3_t': 'The estimate updates live',
  'case.s3_d': 'With every change, the hours, the contingency and the days are recalculated at once, just like the office’s spreadsheet. If the estimate does not fit the deadline, the application says how many days are missing.',
  'case.s4_t': 'Each person’s workload, week by week',
  'case.s4_d': 'Each person’s hours per week. Weeks over 40 hours, or with a day over 8, are marked in red.',
  'case.s5_t': 'Each project’s schedule',
  'case.s5_d': 'The tasks on a Gantt chart, with category, status and assignee, by day, week or month.',
  'case.s6_t': 'All projects, one picture',
  'case.s6_d': 'The monthly view shows every project together. What used to live in dozens of Excel files is now one shared source.',
  'case.note': 'The images are from the application, with test data.',
  'case.out_title': 'The result: <strong>one shared source instead of dozens of Excel files.</strong>',
  'case.out_text': 'Does some of your work live in Excel files too? Tell us which. We reply within 48 hours with how we would build it.',
  'case.cta_contact': 'Describe the job', 'case.cta_call': 'Book a call', 'case.cta_all': 'All solutions',
 },
 'it': {
  '_title': 'AidedCAM - Dai file Excel a un’unica visione dei progetti',
  '_description': 'Come un’applicazione che abbiamo sviluppato per uno studio di ingegneria strutturale mette preventivi, cronoprogramma, carico di lavoro e ore in un’unica applicazione condivisa, al posto di decine di file Excel.',
  'case.back': 'Home',
  'case.label': 'Una soluzione realizzata · Studio di ingegneria strutturale',
  'case.title': 'Dai file Excel a un’unica visione dei progetti. <strong>Preventivi, cronoprogramma e carico di lavoro in un’unica applicazione.</strong>',
  'case.lead': 'Preventivi, cronoprogramma, carico di lavoro e ore in un’unica applicazione, su un database condiviso, con i calcoli dello studio. Tutti vedono e aggiornano la stessa visione.',
  'case.v_before': 'Decine di file Excel', 'case.v_after': 'Un’unica fonte condivisa', 'case.what': 'preventivi, cronoprogramma e ore',
  'case.s1_t': 'Tutti i progetti in un elenco',
  'case.s1_d': 'Ogni progetto su una riga: responsabile, inizio, scadenza, giorni di contratto, ore totali, stima e stato.',
  'case.s2_t': 'Le attività, con ore per ruolo',
  'case.s2_d': 'Ogni attività del progetto ha categoria, stato, assegnatario e ore per ogni ruolo: ingegneri, disegnatori, BIM modeler.',
  'case.s3_t': 'La stima si aggiorna dal vivo',
  'case.s3_d': 'A ogni modifica, ore, margine di sicurezza e giorni si ricalcolano subito, come nel foglio dello studio. Se la stima non rientra nella scadenza, l’applicazione dice quanti giorni mancano.',
  'case.s4_t': 'Il carico di ogni persona, settimana per settimana',
  'case.s4_d': 'Le ore di ogni persona per settimana. Le settimane oltre 40 ore, o con un giorno oltre 8, sono segnate in rosso.',
  'case.s5_t': 'Il cronoprogramma di ogni progetto',
  'case.s5_d': 'Le attività su un diagramma di Gantt, con categoria, stato e assegnatario, per giorno, settimana o mese.',
  'case.s6_t': 'Tutti i progetti, un’unica visione',
  'case.s6_d': 'La vista mensile mostra tutti i progetti insieme. Ciò che prima viveva in decine di file Excel ora è un’unica fonte condivisa.',
  'case.note': 'Le immagini sono dell’applicazione, con dati di prova.',
  'case.out_title': 'Il risultato: <strong>un’unica fonte condivisa al posto di decine di file Excel.</strong>',
  'case.out_text': 'Anche parte del vostro lavoro vive in file Excel? Diteci quale. Vi rispondiamo entro 48 ore con come lo costruiremmo.',
  'case.cta_contact': 'Descrivete il lavoro', 'case.cta_call': 'Prenota una chiamata', 'case.cta_all': 'Tutte le soluzioni',
 },
}
PROJ_STEPS = [('img/projects-app/step-1.webp', 10, 45, 1.9), ('img/projects-app/step-2.webp', 72, 28, 1.45),
              ('img/projects-app/step-2.webp', 40, 95, 1.55), ('img/projects-app/step-4.webp', 1, 98, 2.0),
              ('img/projects-app/step-5.webp', 58, 48, 1.8),
              ({'video': 'video/built-projects.mp4', 'poster': 'video/built-projects.webp'}, 50, 50, 1.0)]

# ---------- card 03 (Revit add-in): no recording, so a list of its commands ----------
REVIT_PANELS = [
 ('mech', 'Mechanical', [('ductThroughCeiling', 'Duct through ceiling'), ('ductThroughWall', 'Duct through wall'), ('ventilatorOnDuct', 'Ventilator on duct'),
   ('ductSplit', 'Duct split'), ('exhaustRun', 'Exhaust run'), ('exhaustOffset', 'Exhaust offset'), ('ahuEditor', 'AHU editor'),
   ('insertCvdVav', 'Insert CVD and VAV'), ('takeOffMainDiameters', 'Take off main diameters'), ('quantities', 'Quantities'), ('create3DView', 'Create 3D view')]),
 ('elec', 'Electrical', [('cableLengths', 'Cable lengths'), ('createCableMarkers', 'Create cable markers'), ('associateCableMarker', 'Associate cable marker'),
   ('calculateLineLengths', 'Calculate line lengths'), ('removeConduitLines', 'Remove conduit lines'), ('aCableInfo', 'Cable info')]),
 ('plumb', 'Plumbing', [('pprctSplitAll', 'PP-RCT split'), ('replaceReduction', 'Replace reduction'), ('weldSaddleDiameters', 'Weld saddle diameters'),
   ('flexPipeConnection', 'Flex pipe connection'), ('copyRoutingPreferences', 'Copy routing preferences')]),
 ('data', 'Data', [('DwfxDwgPdf', 'Sheet export'), ('dataGrid', 'Data grid'), ('cableData', 'Cable data'), ('checkingTools', 'Checking tools')]),
 ('plan', 'Plan', [('renumberDuctSystem', 'Renumber duct system'), ('centerRoomsTags', 'Center room tags'), ('structureSelector', 'Structure selector'),
   ('alignPointCloud', 'Align point cloud'), ('familyReadParameter', 'Family read parameter'), ('familyUpgrade', 'Family upgrade')]),
]
CMD = {
 'el': {
  'cmd.p_mech': 'Αεραγωγοί', 'cmd.p_elec': 'Καλώδια', 'cmd.p_plumb': 'Σωληνώσεις', 'cmd.p_data': 'Δεδομένα και εξαγωγή', 'cmd.p_plan': 'Σχέδιο και families',
  'cmd.ductThroughCeiling': 'Τοποθετεί τα σημεία ανάρτησης όπου οι αεραγωγοί περνούν από οροφή.',
  'cmd.ductThroughWall': 'Τοποθετεί τα σημεία ανάρτησης όπου οι αεραγωγοί περνούν από τοίχο.',
  'cmd.ventilatorOnDuct': 'Τοποθετεί τα σημεία ανάρτησης για ανεμιστήρες πάνω σε αεραγωγούς.',
  'cmd.ductSplit': 'Κόβει στρογγυλούς και ορθογώνιους αεραγωγούς στα κομμάτια που θα κατασκευαστούν.',
  'cmd.exhaustRun': 'Φτιάχνει ολόκληρη κατακόρυφη απαγωγή μέσα από τη στέγη: αεραγωγό, καπέλο και θυρίδες επιθεώρησης.',
  'cmd.exhaustOffset': 'Μετατοπίζει έναν αεραγωγό πλάγια με δύο γωνίες, ώστε να συνεχίζει παράλληλα.',
  'cmd.ahuEditor': 'Επεξεργαστής για τα τμήματα της κλιματιστικής μονάδας: φίλτρα, στοιχεία, υγραντήρας, ανεμιστήρας, με αναφορά.',
  'cmd.insertCvdVav': 'Βάζει CVD και VAV στον αεραγωγό, μαζί με τους συνδέσμους τους.',
  'cmd.takeOffMainDiameters': 'Γράφει τη διάμετρο του κύριου αεραγωγού σε κάθε στρογγυλή διακλάδωση.',
  'cmd.quantities': 'Συμπληρώνει τις συνολικές ποσότητες, όταν το μοντέλο είναι πλήρες.',
  'cmd.create3DView': 'Φτιάχνει ισομετρική 3D όψη του στοιχείου που επιλέξατε.',
  'cmd.cableLengths': 'Μετρά την απόσταση κάθε σημαδευτή καλωδίου από τον πίνακά του.',
  'cmd.createCableMarkers': 'Φτιάχνει τους σημαδευτές καλωδίων και τους συνδέει με ένα βήμα.',
  'cmd.associateCableMarker': 'Συνδέει τις παραμέτρους του σημαδευτή με τις παραμέτρους του family.',
  'cmd.calculateLineLengths': 'Αθροίζει το μήκος των γραμμών, ανά τύπο γραμμής.',
  'cmd.removeConduitLines': 'Αφαιρεί όλες τις γραμμές σωληνώσεων καλωδίων από το μοντέλο.',
  'cmd.aCableInfo': 'Δείχνει τα στοιχεία των καλωδίων.',
  'cmd.pprctSplitAll': 'Κόβει τους σωλήνες PP-RCT σε τυποποιημένα μήκη, λίγους ή όλους μαζί.',
  'cmd.replaceReduction': 'Αντικαθιστά μια μη έγκυρη συστολή σωλήνα με μια σειρά έγκυρων.',
  'cmd.weldSaddleDiameters': 'Γράφει τη διάμετρο του κύριου σωλήνα σε κάθε σέλα συγκόλλησης PP-RCT.',
  'cmd.flexPipeConnection': 'Ενώνει δύο σωλήνες με εύκαμπτο σωλήνα.',
  'cmd.copyRoutingPreferences': 'Αντιγράφει τις ρυθμίσεις δρομολόγησης, τα τμήματα και τα μεγέθη σωλήνων από άλλο έργο, με αναφορά.',
  'cmd.DwfxDwgPdf': 'Εξάγει τα επιλεγμένα φύλλα σε PDF, DWG, DWFX και IFC με ένα τρέξιμο.',
  'cmd.dataGrid': 'Δείχνει τις παραμέτρους πολλών families σε έναν πίνακα, για ανάγνωση και αλλαγή μαζί.',
  'cmd.cableData': 'Συγκρίνει τα στοιχεία καλωδίων του μοντέλου με το αρχείο κανονισμού σε Excel.',
  'cmd.checkingTools': 'Όλοι οι έλεγχοι του μοντέλου σε ένα παράθυρο.',
  'cmd.renumberDuctSystem': 'Αριθμεί ένα δίκτυο αεραγωγών με σειρά, ώστε τα κομμάτια να διαβάζονται στη σειρά στις 3D όψεις.',
  'cmd.centerRoomsTags': 'Κεντράρει κάθε ετικέτα χώρου μέσα στον χώρο της.',
  'cmd.structureSelector': 'Επιλέγει μια ολόκληρη ομάδα μεταλλικών στοιχείων με μία κίνηση.',
  'cmd.alignPointCloud': 'Μετακινεί, περιστρέφει και γέρνει ένα συνδεδεμένο νέφος σημείων για να ταιριάξει με το μοντέλο.',
  'cmd.familyReadParameter': 'Τυπώνει τις παραμέτρους ενός family σε πίνακα, για σύγκριση δίπλα δίπλα.',
  'cmd.familyUpgrade': 'Αναβαθμίζει παλιότερα families στην έκδοση Revit που τρέχετε.',
 },
 'en': {
  'cmd.p_mech': 'Ducts', 'cmd.p_elec': 'Cables', 'cmd.p_plumb': 'Piping', 'cmd.p_data': 'Data and export', 'cmd.p_plan': 'Plan and families',
  'cmd.ductThroughCeiling': 'Places the suspension markers where ducts pass through a ceiling.',
  'cmd.ductThroughWall': 'Places the suspension markers where ducts pass through a wall.',
  'cmd.ventilatorOnDuct': 'Places the suspension markers for fans mounted on ducts.',
  'cmd.ductSplit': 'Splits round and rectangular ducts into the segments that get fabricated.',
  'cmd.exhaustRun': 'Builds a whole vertical exhaust run through the roof: duct, roof hood and inspection doors.',
  'cmd.exhaustOffset': 'Shifts a duct sideways with two elbows, so it carries on parallel.',
  'cmd.ahuEditor': 'An editor for the air handling unit’s sections: filters, coils, humidifier, fan, with a report.',
  'cmd.insertCvdVav': 'Inserts a CVD and a VAV into the duct, with their connectors.',
  'cmd.takeOffMainDiameters': 'Writes the main duct’s diameter on every round take-off.',
  'cmd.quantities': 'Fills in the total quantities once the model is complete.',
  'cmd.create3DView': 'Creates an isometric 3D view of the selected element.',
  'cmd.cableLengths': 'Measures the distance from each cable marker to its switchboard.',
  'cmd.createCableMarkers': 'Creates the cable markers and links them in one step.',
  'cmd.associateCableMarker': 'Links a cable marker’s parameters to the family’s own.',
  'cmd.calculateLineLengths': 'Adds up the length of lines, per line type.',
  'cmd.removeConduitLines': 'Removes all the conduit lines from the model.',
  'cmd.aCableInfo': 'Shows the cables’ data.',
  'cmd.pprctSplitAll': 'Splits PP-RCT pipes into standard lengths, a few or all at once.',
  'cmd.replaceReduction': 'Replaces an invalid pipe reduction with a series of valid ones.',
  'cmd.weldSaddleDiameters': 'Writes the main pipe’s diameter on every PP-RCT weld saddle.',
  'cmd.flexPipeConnection': 'Joins two pipes with a flexible pipe.',
  'cmd.copyRoutingPreferences': 'Copies pipe routing preferences, segments and sizes from another project, with a report.',
  'cmd.DwfxDwgPdf': 'Exports the selected sheets to PDF, DWG, DWFX and IFC in one run.',
  'cmd.dataGrid': 'Shows many families’ parameters in one grid, to read and edit together.',
  'cmd.cableData': 'Compares the model’s cable data with the regulation Excel file.',
  'cmd.checkingTools': 'Every model check in one window.',
  'cmd.renumberDuctSystem': 'Numbers a duct system in order, so its parts read in sequence in 3D views.',
  'cmd.centerRoomsTags': 'Centres every room tag in its room.',
  'cmd.structureSelector': 'Selects a whole group of steel members in one go.',
  'cmd.alignPointCloud': 'Moves, rotates and tilts a linked point cloud to align it with the model.',
  'cmd.familyReadParameter': 'Prints a family’s parameters into a grid, to compare side by side.',
  'cmd.familyUpgrade': 'Upgrades older families to the Revit version you run.',
 },
 'it': {
  'cmd.p_mech': 'Canali', 'cmd.p_elec': 'Cavi', 'cmd.p_plumb': 'Tubazioni', 'cmd.p_data': 'Dati ed esportazione', 'cmd.p_plan': 'Pianta e famiglie',
  'cmd.ductThroughCeiling': 'Posiziona i punti di sospensione dove i canali attraversano un soffitto.',
  'cmd.ductThroughWall': 'Posiziona i punti di sospensione dove i canali attraversano una parete.',
  'cmd.ventilatorOnDuct': 'Posiziona i punti di sospensione per i ventilatori montati sui canali.',
  'cmd.ductSplit': 'Divide i canali tondi e rettangolari nei tratti da costruire.',
  'cmd.exhaustRun': 'Crea un’intera espulsione verticale attraverso il tetto: canale, cappello e portelli d’ispezione.',
  'cmd.exhaustOffset': 'Sposta lateralmente un canale con due curve, così prosegue in parallelo.',
  'cmd.ahuEditor': 'Un editor per le sezioni dell’unità di trattamento aria: filtri, batterie, umidificatore, ventilatore, con un report.',
  'cmd.insertCvdVav': 'Inserisce un CVD e un VAV nel canale, con i loro raccordi.',
  'cmd.takeOffMainDiameters': 'Scrive il diametro del canale principale su ogni stacco tondo.',
  'cmd.quantities': 'Compila le quantità totali a modello completo.',
  'cmd.create3DView': 'Crea una vista 3D isometrica dell’elemento selezionato.',
  'cmd.cableLengths': 'Misura la distanza di ogni marcatore di cavo dal suo quadro.',
  'cmd.createCableMarkers': 'Crea i marcatori dei cavi e li collega in un solo passo.',
  'cmd.associateCableMarker': 'Collega i parametri del marcatore a quelli della famiglia.',
  'cmd.calculateLineLengths': 'Somma la lunghezza delle linee, per tipo di linea.',
  'cmd.removeConduitLines': 'Rimuove tutte le linee dei condotti dal modello.',
  'cmd.aCableInfo': 'Mostra i dati dei cavi.',
  'cmd.pprctSplitAll': 'Divide i tubi PP-RCT in lunghezze standard, alcuni o tutti insieme.',
  'cmd.replaceReduction': 'Sostituisce una riduzione non valida con una serie di riduzioni valide.',
  'cmd.weldSaddleDiameters': 'Scrive il diametro del tubo principale su ogni sella a saldare PP-RCT.',
  'cmd.flexPipeConnection': 'Unisce due tubi con un tubo flessibile.',
  'cmd.copyRoutingPreferences': 'Copia preferenze di instradamento, segmenti e dimensioni dei tubi da un altro progetto, con un report.',
  'cmd.DwfxDwgPdf': 'Esporta le tavole selezionate in PDF, DWG, DWFX e IFC in un’unica esecuzione.',
  'cmd.dataGrid': 'Mostra i parametri di molte famiglie in una griglia, da leggere e modificare insieme.',
  'cmd.cableData': 'Confronta i dati dei cavi del modello con il file Excel delle norme.',
  'cmd.checkingTools': 'Tutti i controlli del modello in una finestra.',
  'cmd.renumberDuctSystem': 'Numera una rete di canali in ordine, così i pezzi si leggono in sequenza nelle viste 3D.',
  'cmd.centerRoomsTags': 'Centra ogni etichetta di locale nel suo locale.',
  'cmd.structureSelector': 'Seleziona un intero gruppo di elementi in acciaio in un colpo solo.',
  'cmd.alignPointCloud': 'Sposta, ruota e inclina una nuvola di punti collegata per allinearla al modello.',
  'cmd.familyReadParameter': 'Stampa i parametri di una famiglia in una griglia, per confrontarli fianco a fianco.',
  'cmd.familyUpgrade': 'Aggiorna le famiglie più vecchie alla versione di Revit in uso.',
 },
}
REVIT_T = {
 'el': {
  '_title': 'AidedCAM - Σαράντα εντολές Revit σε μία καρτέλα: από μια μέρα σε 11 λεπτά',
  '_description': 'Οι εντολές ενός add-in για Revit που φτιάξαμε για το τμήμα BIM εταιρείας βιομηχανικού εξοπλισμού: αεραγωγοί, καλώδια, σωληνώσεις, δεδομένα και εξαγωγή φύλλων, με ένα κουμπί η καθεμία.',
  'case.back': 'Αρχική',
  'case.label': 'Λύση που φτιάξαμε · Βιομηχανικός εξοπλισμός, τμήμα BIM',
  'case.title': 'Σαράντα εντολές Revit σε μία καρτέλα. <strong>Κάθε επαναλαμβανόμενη δουλειά, ένα κουμπί.</strong>',
  'case.lead': 'Κάθε επαναλαμβανόμενη δουλειά μοντελοποίησης του τμήματος BIM έγινε ένα κουμπί μέσα στο Revit. Τα σχέδια και οι πίνακες από το μοντέλο, που έπαιρναν μια μέρα, βγαίνουν σε 11 λεπτά.',
  'case.v_before': '1 μέρα', 'case.v_after': '11 λεπτά', 'case.what': 'για σχέδια και πίνακες από το μοντέλο',
  'case.intro': 'Αυτές είναι οι εντολές, ομαδοποιημένες όπως στην καρτέλα του Revit. Δείχνουμε όσες είναι γενικές· μερικές ακόμα είναι φτιαγμένες ειδικά για τα προϊόντα της εταιρείας και μένουν δικές της.',
  'case.out_title': 'Το αποτέλεσμα: <strong>11 λεπτά αντί για μια μέρα.</strong>',
  'case.out_text': 'Υπάρχει κι εσάς μια δουλειά στο Revit που επαναλαμβάνετε κάθε μέρα; Πείτε μας ποια είναι. Θα απαντήσουμε εντός 48 ωρών με το πώς θα το φτιάχναμε.',
  'case.cta_contact': 'Περιγράψτε τη δουλειά', 'case.cta_call': 'Κλείστε μια κλήση', 'case.cta_all': 'Όλες οι λύσεις',
  **CMD['el']},
 'en': {
  '_title': 'AidedCAM - Forty Revit commands in one ribbon tab: from a day to 11 minutes',
  '_description': 'The commands of a Revit add-in we built for an industrial equipment maker’s BIM department: ducts, cables, piping, data and sheet export, one button each.',
  'case.back': 'Home',
  'case.label': 'A solution we built · Industrial equipment, BIM department',
  'case.title': 'Forty Revit commands in one ribbon tab. <strong>Every repetitive job, one button.</strong>',
  'case.lead': 'Every repetitive modelling job of the BIM department became a button inside Revit. Drawings and schedules from the model, which took a day, now come out in 11 minutes.',
  'case.v_before': '1 day', 'case.v_after': '11 min', 'case.what': 'for drawings and schedules from the model',
  'case.intro': 'These are the commands, grouped as on the Revit ribbon tab. We show the general ones; a few more are built for the company’s own products and stay theirs.',
  'case.out_title': 'The result: <strong>11 minutes instead of a day.</strong>',
  'case.out_text': 'Is there a job in Revit you repeat every day too? Tell us which. We reply within 48 hours with how we would build it.',
  'case.cta_contact': 'Describe the job', 'case.cta_call': 'Book a call', 'case.cta_all': 'All solutions',
  **CMD['en']},
 'it': {
  '_title': 'AidedCAM - Quaranta comandi Revit in una scheda: da un giorno a 11 minuti',
  '_description': 'I comandi di un add-in per Revit che abbiamo sviluppato per il reparto BIM di un costruttore di attrezzature industriali: canali, cavi, tubazioni, dati ed esportazione tavole, un pulsante ciascuno.',
  'case.back': 'Home',
  'case.label': 'Una soluzione realizzata · Attrezzature industriali, reparto BIM',
  'case.title': 'Quaranta comandi Revit in una scheda. <strong>Ogni lavoro ripetitivo, un pulsante.</strong>',
  'case.lead': 'Ogni lavoro di modellazione ripetitivo del reparto BIM è diventato un pulsante dentro Revit. Tavole e abachi dal modello, che richiedevano un giorno, ora escono in 11 minuti.',
  'case.v_before': '1 giorno', 'case.v_after': '11 min', 'case.what': 'per tavole e abachi dal modello',
  'case.intro': 'Questi sono i comandi, raggruppati come nella scheda di Revit. Mostriamo quelli generali; alcuni altri sono fatti per i prodotti dell’azienda e restano suoi.',
  'case.out_title': 'Il risultato: <strong>11 minuti invece di un giorno.</strong>',
  'case.out_text': 'C’è anche per voi un lavoro in Revit che ripetete ogni giorno? Diteci quale. Vi rispondiamo entro 48 ore con come lo costruiremmo.',
  'case.cta_contact': 'Descrivete il lavoro', 'case.cta_call': 'Prenota una chiamata', 'case.cta_all': 'Tutte le soluzioni',
  **CMD['it']},
}

if __name__ == '__main__':
    w = open('what-you-gain.html', encoding='utf-8').read()
    build(w, 'lathe-cam.html', LATHE_T, LATHE_STEPS, '.acam', 'lathe')
    build(w, 'mold-cam.html', MOLD_T, MOLD_STEPS, 'routing plan', 'mold')
    build(w, 'projects-app.html', PROJ_T, PROJ_STEPS, 'shared db', 'projects')
    build(w, 'revit-commands.html', REVIT_T, [], 'ribbon', 'revit', REVIT_PANELS)
