(() => {
  // Inlined task-mining primer. The bundle was authored to run against
  // window scroll; embedded here as a section of index.html, that's
  // still true — natural page scroll drives the panel transitions.
  const SCROLL_TOP = () => window.scrollY;
  const VH = () => window.innerHeight;
  const ROOT_TOP = () => 0;


  // ── I18N ──
  const COPY = {
    en: {
      chapter: 'The task mining logic',
      thesis:  'The mental model',
      thesisHTML: 'Every <strong>system</strong> is a pack of <strong>workflows</strong>.<br>Every <strong>workflow</strong> is a pack of <strong>tasks</strong>.',
      thesisSub: 'A three-layer way of looking at your company — so you can see what’s worth automating before you automate anything.',
      taskK: 'Zoom in', wfK: 'Zoom out', sysK: 'Zoom all the way out',
      reveals: 'This view reveals',
      taskTitle: 'A <strong>task</strong>.',
      taskDefn: 'One action, done by one person, done the same way again and again. The substance of every company — and most of them are invisible from where the owner sits.',
      taskReveals: 'Which individual steps are <strong>manual, repeated, and ripe</strong> for someone — or something — else to take over.',
      wfTitle: 'A <strong>workflow</strong>.',
      wfDefn: 'A sequence of tasks that produces a result. Not a chart on a wall — the actual chain a piece of work travels through, from the moment it starts until someone is done with it.',
      wfReveals: 'Which tasks <strong>block others</strong>, and which <strong>handoffs add time</strong> without adding value.',
      sysTitle: 'A <strong>system</strong>.',
      sysDefn: 'How the workflows in your company connect to each other — what they share, and what they don’t.',
      sysReveals: 'Where the <strong>same information</strong> lives in more than one place, where <strong>tools overlap</strong>, and where one group’s output doesn’t quite fit the next group’s input.',
      qK: 'Three questions · one per layer',
      qTitle: 'Now look at your own company.',
      qSub: 'Keep a notebook nearby. The answers tend to arrive over the following week, not in the next minute.',
      qTag1: 'Task', qTag2: 'Workflow', qTag3: 'System',
      q1: 'Which task in your company is done <strong>by hand, the same way, again and again</strong> — and whose hands are on it?',
      q2: 'In your longest workflow, <strong>between which two steps</strong> does work most often pause?',
      q3: 'Which two parts of your operation <strong>need the same information</strong> but store it separately?',
      qHint: 'Observe for a day',
      qCta: 'Got work like this? Let\u2019s talk \u2192',
      scroll: 'scroll',
      pips: ['00 · Thesis', '01 · Task', '02 · Workflow', '03 · System'],
      labels: { system: 'SYSTEM', workflow: 'WORKFLOW', task: 'TASK' },
    },
    el: {
      chapter: 'Η λογική του task mining',
      thesis: 'Το μοντέλο',
      thesisHTML: 'Κάθε <strong>σύστημα</strong> είναι ένα σύνολο από <strong>ροές</strong>.<br>Κάθε <strong>ροή</strong> είναι ένα σύνολο από <strong>εργασίες</strong>.',
      thesisSub: 'Ένας τρόπος να βλέπετε την εταιρεία σας σε τρία επίπεδα — για να ξεχωρίζετε τι αξίζει να αυτοματοποιηθεί, πριν αυτοματοποιήσετε οτιδήποτε.',
      taskK: 'Εστίαση μέσα', wfK: 'Πιο πίσω', sysK: 'Πολύ πιο πίσω',
      reveals: 'Αυτό το επίπεδο αποκαλύπτει',
      taskTitle: 'Μία <strong>εργασία</strong>.',
      taskDefn: 'Μία ενέργεια, από ένα άτομο, με τον ίδιο τρόπο κάθε φορά. Η ύλη κάθε εταιρείας — κι οι περισσότερες είναι αόρατες από τη θέση του ιδιοκτήτη.',
      taskReveals: 'Ποια βήματα γίνονται <strong>με το χέρι, επαναληπτικά</strong>, και είναι ώριμα να τα αναλάβει κάποιος — ή κάτι — άλλος.',
      wfTitle: 'Μία <strong>ροή</strong>.',
      wfDefn: 'Μια ακολουθία εργασιών που παράγει ένα αποτέλεσμα. Όχι διάγραμμα σε τοίχο — η πραγματική αλυσίδα από την οποία περνάει η δουλειά.',
      wfReveals: 'Ποιες εργασίες <strong>μπλοκάρουν άλλες</strong>, και ποιες <strong>μεταβιβάσεις</strong> προσθέτουν χρόνο χωρίς να προσθέτουν αξία.',
      sysTitle: 'Ένα <strong>σύστημα</strong>.',
      sysDefn: 'Πώς οι ροές της εταιρείας σας συνδέονται μεταξύ τους — τι μοιράζονται και τι όχι.',
      sysReveals: 'Πού η <strong>ίδια πληροφορία</strong> ζει σε παραπάνω από ένα σημεία, πού <strong>τα εργαλεία επικαλύπτονται</strong>, και πού το αποτέλεσμα μιας ομάδας δεν ταιριάζει στην επόμενη.',
      qK: 'Τρεις ερωτήσεις · μία για κάθε επίπεδο',
      qTitle: 'Τώρα κοιτάξτε τη δική σας εταιρεία.',
      qSub: 'Κρατήστε ένα μπλοκ κοντά. Οι απαντήσεις συνήθως έρχονται μέσα στην επόμενη εβδομάδα, όχι στο επόμενο λεπτό.',
      qTag1: 'Εργασία', qTag2: 'Ροή', qTag3: 'Σύστημα',
      q1: 'Ποια εργασία στην εταιρεία σας γίνεται <strong>με το χέρι, με τον ίδιο τρόπο, ξανά και ξανά</strong> — και ποιος την κάνει;',
      q2: 'Στη μακρύτερη ροή σας, <strong>ανάμεσα σε ποια δύο βήματα</strong> σταματά πιο συχνά η δουλειά;',
      q3: 'Ποια δύο μέρη της λειτουργίας σας <strong>χρειάζονται την ίδια πληροφορία</strong> αλλά την κρατούν ξεχωριστά;',
      qHint: 'Παρατηρήστε μία μέρα',
      qCta: 'Έχετε τέτοια εργασία; Ας μιλήσουμε \u2192',
      scroll: 'κύλιση',
      pips: ['00 · Θέση', '01 · Εργασία', '02 · Ροή', '03 · Σύστημα'],
      labels: { system: 'ΣΥΣΤΗΜΑ', workflow: 'ΡΟΗ', task: 'ΕΡΓΑΣΙΑ' },
    },
    it: {
      chapter: 'La logica del task mining',
      thesis: 'Il modello mentale',
      thesisHTML: 'Ogni <strong>sistema</strong> è un insieme di <strong>flussi</strong>.<br>Ogni <strong>flusso</strong> è un insieme di <strong>attività</strong>.',
      thesisSub: 'Un modo di guardare la vostra azienda su tre livelli — per capire cosa vale la pena automatizzare, prima di automatizzare qualsiasi cosa.',
      taskK: 'Zoom avanti', wfK: 'Zoom indietro', sysK: 'Zoom totale',
      reveals: 'Questo livello rivela',
      taskTitle: "Un'<strong>attività</strong>.",
      taskDefn: "Un'azione, svolta da una persona, allo stesso modo ancora e ancora. La sostanza di ogni azienda — e la maggior parte sono invisibili dalla postazione del titolare.",
      taskReveals: 'Quali passaggi sono <strong>manuali, ripetuti e pronti</strong> per essere presi in carico da qualcuno — o qualcosa — altro.',
      wfTitle: 'Un <strong>flusso</strong>.',
      wfDefn: "Una sequenza di attività che produce un risultato. Non un diagramma su un muro — la vera catena attraverso cui viaggia un pezzo di lavoro, dal momento in cui inizia fino alla fine.",
      wfReveals: 'Quali attività <strong>bloccano le altre</strong>, e quali <strong>passaggi aggiungono tempo</strong> senza aggiungere valore.',
      sysTitle: 'Un <strong>sistema</strong>.',
      sysDefn: 'Come i flussi della vostra azienda si collegano tra loro — cosa condividono e cosa no.',
      sysReveals: "Dove le <strong>stesse informazioni</strong> vivono in più di un luogo, dove gli <strong>strumenti si sovrappongono</strong>, e dove l'output di un gruppo non si adatta bene all'input del successivo.",
      qK: 'Tre domande · una per livello',
      qTitle: 'Ora guardate la vostra azienda.',
      qSub: 'Tenete un taccuino vicino. Le risposte arrivano di solito nella settimana successiva, non nel minuto successivo.',
      qTag1: 'Attività', qTag2: 'Flusso', qTag3: 'Sistema',
      q1: 'Quale attività nella vostra azienda viene svolta <strong>a mano, nello stesso modo, ancora e ancora</strong> — e di chi sono le mani che la svolgono?',
      q2: 'Nel vostro flusso più lungo, <strong>tra quali due passaggi</strong> si ferma più spesso il lavoro?',
      q3: 'Quali due parti della vostra operatività <strong>hanno bisogno delle stesse informazioni</strong> ma le conservano separatamente?',
      qHint: 'Osservate per un giorno',
      qCta: 'Avete lavori come questi? Parliamone \u2192',
      scroll: 'scorri',
      pips: ['00 · Tesi', '01 · Attività', '02 · Flusso', '03 · Sistema'],
      labels: { system: 'SISTEMA', workflow: 'FLUSSO', task: 'ATTIVITÀ' },
    },
  };

  // ── Tree renderer (persistent single SVG) ──────
  // Coordinates in 800×800 viewBox. Tree is always rendered; camera pans/zooms via transform.
  const TREE = (() => {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.getElementById('tree');
    function el(name, attrs = {}, children = []) {
      const n = document.createElementNS(NS, name);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      for (const c of children) n.appendChild(c);
      return n;
    }

    // Layout:
    // System node centered at (400, 150)
    // 5 Workflow nodes at y=320, spread across x=140..660
    // Task mosaic at y=500..740, wide base
    const SYS = { x: 400, y: 150, w: 140, h: 54 };
    const WF_Y = 330, WF_H = 44, WF_W = 100;
    const WF_XS = [140, 260, 400, 540, 660].map(x => x - WF_W / 2);
    // Task mosaic cells — irregular grid 13 cols × 5 rows with some skips,
    // varying widths. Area spans x=60..740, y=500..740.
    const MOSAIC = (() => {
      const rows = 5;
      const cols = 13;
      const x0 = 60, y0 = 500;
      const cellW = (740 - 60) / cols;
      const cellH = (740 - 500) / rows;
      const cells = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          // randomly skip corners for organic edge
          const isEdge = (r === 0 && (c === 0 || c === cols - 1)) ||
                         (r === rows - 1 && (c === 0 || c === cols - 1));
          if (isEdge && Math.random() < 0.5) continue;
          const pad = 2;
          // Occasionally merge a cell horizontally (w×2) for variety
          const big = Math.random() < 0.08 && c < cols - 1;
          cells.push({
            x: x0 + c * cellW + pad,
            y: y0 + r * cellH + pad,
            w: (big ? cellW * 2 : cellW) - pad * 2,
            h: cellH - pad * 2,
            big,
          });
          if (big) continue; // skip next col index naturally by cellW alone — but our loop uses col idx, so don't double-draw: we'll instead not advance. Simpler: draw both widths normal; big is just visual hint not layout.
        }
      }
      return cells;
    })();

    function build(labels) {
      svg.innerHTML = '';
      const defs = el('defs');
      defs.innerHTML = `
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 Z" fill="#3a9b6b" />
        </marker>`;
      svg.appendChild(defs);

      const g = el('g', { id: 'root' });
      svg.appendChild(g);

      // Lines: sys -> each workflow
      WF_XS.forEach((wx, i) => {
        const line = el('line', {
          x1: SYS.x, y1: SYS.y + SYS.h / 2,
          x2: wx + WF_W / 2, y2: WF_Y,
          stroke: '#3a9b6b', 'stroke-width': '1.2', opacity: '0.55',
          class: 'l-sys-wf', 'data-idx': i,
        });
        g.appendChild(line);
      });

      // Lines: each workflow -> band above mosaic (visual root of its task group)
      WF_XS.forEach((wx, i) => {
        const cx = wx + WF_W / 2;
        const line = el('line', {
          x1: cx, y1: WF_Y + WF_H,
          x2: cx, y2: 492,
          stroke: '#3a9b6b', 'stroke-width': '1.2', opacity: '0.4',
          class: 'l-wf-task', 'data-idx': i,
        });
        g.appendChild(line);
      });

      // Horizontal bus above mosaic (connects each wf drop to the mosaic band)
      g.appendChild(el('line', {
        x1: 80, y1: 492, x2: 720, y2: 492,
        stroke: '#3a9b6b', 'stroke-width': '1', opacity: '0.35',
        class: 'l-bus',
      }));

      // Task mosaic
      const mosG = el('g', { class: 'mosaic' });
      MOSAIC.forEach((cell, i) => {
        const r = el('rect', {
          x: cell.x, y: cell.y, width: cell.w, height: cell.h,
          rx: '1.5', fill: '#3a9b6b', opacity: '0.85',
          class: 'task-cell', 'data-i': i,
        });
        mosG.appendChild(r);
      });
      g.appendChild(mosG);

      // Workflow boxes (drawn on top of lines)
      WF_XS.forEach((wx, i) => {
        const group = el('g', { class: 'wf-box', 'data-idx': i });
        group.appendChild(el('rect', {
          x: wx, y: WF_Y, width: WF_W, height: WF_H,
          rx: '3', fill: '#f0f7f2', stroke: '#256b48', 'stroke-width': '1.5',
        }));
        const t = el('text', {
          x: wx + WF_W / 2, y: WF_Y + 28,
          'text-anchor': 'middle', 'font-family': 'JetBrains Mono, monospace',
          'font-size': '12', 'font-weight': '700', fill: '#163f2c',
          'letter-spacing': '1.6',
        });
        t.textContent = `${labels.workflow}·${String(i + 1).padStart(2, '0')}`;
        group.appendChild(t);
        g.appendChild(group);
      });

      // System box on top
      const sysG = el('g', { class: 'sys-box' });
      sysG.appendChild(el('rect', {
        x: SYS.x - SYS.w / 2, y: SYS.y, width: SYS.w, height: SYS.h,
        rx: '4', fill: '#163f2c', stroke: '#163f2c', 'stroke-width': '1.5',
      }));
      const sysT = el('text', {
        x: SYS.x, y: SYS.y + 34,
        'text-anchor': 'middle', 'font-family': 'JetBrains Mono, monospace',
        'font-size': '14', 'font-weight': '700', fill: '#f0f7f2',
        'letter-spacing': '2.4',
      });
      sysT.textContent = labels.system;
      sysG.appendChild(sysT);
      g.appendChild(sysG);

      // Task label band (only shown when zoomed into tasks layer)
      const bandG = el('g', { class: 'task-band', opacity: '0' });
      bandG.appendChild(el('text', {
        x: 400, y: 480,
        'text-anchor': 'middle', 'font-family': 'JetBrains Mono, monospace',
        'font-size': '11', 'font-weight': '700', fill: '#5a6a61',
        'letter-spacing': '2.4',
        class: 'band-text',
      })).textContent = `${labels.task} · ${{system:'SYSTEM',workflow:'WORKFLOW',task:'TASK'}[Object.keys(labels).find(k=>labels[k]===labels.task)] || ''}`;
      // Simpler: just "TASK · all the volume"
      bandG.innerHTML = `<text x="400" y="482" text-anchor="middle"
        font-family="JetBrains Mono, monospace" font-size="11" font-weight="700"
        fill="#163f2c" letter-spacing="2.4">${labels.task}</text>`;
      g.appendChild(bandG);
    }

    // ── Camera presets ──
    // Each panel sets transform on the #root <g> to simulate zoom/pan.
    // scale ~1 shows full 800×800. To "zoom into tasks" we scale up and translate up/left.
    const PRESETS = {
      // Full tree, centered
      0: { scale: 1.0, tx: 0, ty: 0, sysOp: 1, wfOp: 1, taskOp: 0.85, linkOp: 1, bandOp: 0, mosaicEm: 0 },
      // Zoom to tasks (bottom band)
      1: { scale: 2.1, tx: 0, ty: -320, sysOp: 0.15, wfOp: 0.25, taskOp: 1, linkOp: 0.2, bandOp: 1, mosaicEm: 1 },
      // Zoom to one workflow (middle, e.g. WF index 2 — center one), slight zoom
      2: { scale: 1.5, tx: 0, ty: -60, sysOp: 0.35, wfOp: 1, taskOp: 0.55, linkOp: 0.95, bandOp: 0, mosaicEm: 0, wfFocus: 2 },
      // Zoom out — full system; emphasize root
      3: { scale: 1.0, tx: 0, ty: -10, sysOp: 1, wfOp: 0.75, taskOp: 0.35, linkOp: 0.8, bandOp: 0, mosaicEm: 0, sysEm: 1 },
    };

    function apply(panel, progress) {
      // progress: 0..1 within the panel's viewport
      const p = PRESETS[panel];
      if (!p) return;
      const root = svg.querySelector('#root');
      if (!root) return;

      // Smooth between presets slightly for panel 1 using its deeper height
      root.style.transition = 'transform 700ms cubic-bezier(0.65, 0, 0.35, 1)';
      // vbCenter adjustments: translate is in viewBox units (800 wide)
      // We apply translate first then scale, around center (400,400).
      root.setAttribute('transform',
        `translate(${400 + p.tx * 0 - 400 * (p.scale - 1)} ${400 + p.ty - 400 * (p.scale - 1)}) ` +
        `scale(${p.scale}) ` +
        `translate(${-p.tx} ${-p.ty}) ` +
        `translate(${-400 + 400} ${-400 + 400})`
      );
      // simpler: use transform="translate(cx cy) scale(s) translate(-cx+tx -cy+ty)"
      const cx = 400, cy = 400;
      root.setAttribute('transform',
        `translate(${cx} ${cy}) scale(${p.scale}) translate(${-cx + p.tx} ${-cy + p.ty})`
      );

      // Opacities
      svg.querySelector('.sys-box rect').style.transition = 'opacity 600ms, fill 600ms';
      svg.querySelector('.sys-box rect').style.opacity = p.sysOp;
      svg.querySelectorAll('.sys-box text').forEach(t => { t.style.transition = 'opacity 600ms'; t.style.opacity = p.sysOp; });

      svg.querySelectorAll('.wf-box').forEach((n, i) => {
        n.style.transition = 'opacity 600ms';
        if (p.wfFocus !== undefined) {
          n.style.opacity = (i === p.wfFocus) ? 1 : p.wfOp * 0.35;
        } else {
          n.style.opacity = p.wfOp;
        }
      });
      svg.querySelectorAll('.task-cell').forEach((n, i) => {
        n.style.transition = 'opacity 600ms, fill 600ms';
        if (panel === 2 && p.wfFocus !== undefined) {
          // emphasize tasks that "belong" to focused workflow — group by column band
          const cols = 13;
          const col = i % cols;
          const band = Math.floor(col / (cols / 5)); // 0..4
          const belong = band === p.wfFocus;
          n.style.opacity = belong ? 1 : 0.18;
        } else {
          n.style.opacity = p.taskOp;
        }
      });
      svg.querySelectorAll('.l-sys-wf, .l-wf-task, .l-bus').forEach(n => {
        n.style.transition = 'opacity 600ms';
        n.style.opacity = p.linkOp * parseFloat(n.getAttribute('opacity') || '1');
      });
      const band = svg.querySelector('.task-band');
      if (band) { band.style.transition = 'opacity 600ms'; band.style.opacity = p.bandOp; }

      // Emphasize system on panel 3
      const sysRect = svg.querySelector('.sys-box rect');
      if (sysRect) sysRect.setAttribute('stroke-width', panel === 3 ? '2.5' : '1.5');
    }

    return { build, apply };
  })();

  // ── Copy swap ──
  let currentLang = 'en';
  function applyCopy(lang) {
    currentLang = lang;
    const c = COPY[lang];
    // Nav
    document.querySelector('.nav .chapter').textContent = c.chapter;
    // Kickers
    document.querySelectorAll('[data-k]').forEach(n => {
      const k = n.getAttribute('data-k');
      if (c[k]) {
        // preserve the step span if present
        const step = n.querySelector('.step');
        n.textContent = c[k];
        if (step) n.appendChild(step);
      }
    });
    // Text nodes with data-t
    document.querySelectorAll('[data-t]').forEach(n => {
      const key = n.getAttribute('data-t');
      if (key === 'thesis') n.innerHTML = c.thesisHTML;
      else if (c[key] !== undefined) {
        if (/[<>]/.test(c[key])) n.innerHTML = c[key];
        else n.textContent = c[key];
      }
    });
    // Reveals label
    document.querySelectorAll('[data-l="reveals"]').forEach(n => n.textContent = c.reveals);
    // Pips
    document.querySelectorAll('.gutter .pip').forEach((n, i) => {
      n.querySelector('span:last-child').textContent = c.pips[i];
    });
    // Tree labels
    TREE.build(c.labels);
    // Re-apply active panel so tree styling matches
    TREE.apply(activePanel, 0);
  }

  // ── Scroll-driven panel switching ──
  let activePanel = 0;
  function syncPanel() {
    // Find which of the four sticky panels is currently under the viewport midline
    const panels = document.querySelectorAll('.panels .panel');
    const vh = VH();
    const mid = SCROLL_TOP() + vh * 0.35;
    let idx = 0;
    let progress = 0;
    panels.forEach((p, i) => {
      const rect = p.getBoundingClientRect();
        const top = rect.top - ROOT_TOP() + SCROLL_TOP();
      const bot = top + rect.height;
      if (mid >= top && mid < bot) {
        idx = i;
        progress = (mid - top) / rect.height;
      } else if (mid >= bot && i === panels.length - 1) {
        idx = i; progress = 1;
      }
    });
    if (idx !== activePanel) {
      activePanel = idx;
      document.querySelectorAll('.panel-text').forEach(n => {
        n.classList.toggle('active', parseInt(n.getAttribute('data-panel'), 10) === idx);
      });
      document.querySelectorAll('.gutter .pip').forEach(n => {
        n.classList.toggle('on', parseInt(n.getAttribute('data-p'), 10) === idx);
      });
      TREE.apply(idx, progress);
    }
    // Hide scroll hint after user scrolls a bit
    const hint = document.getElementById('hint');
    if (SCROLL_TOP() > 80) hint.classList.add('gone');
  }

  // ── Language sync with the site (EL / EN / IT) ──
  // The site's setLanguage() writes to <html lang>; observe it and re-apply.
  const pickLang = () => {
    const l = document.documentElement.lang;
    return COPY[l] ? l : 'el';
  };
  applyCopy(pickLang());
  new MutationObserver(() => applyCopy(pickLang()))
    .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  // Mark first panel active immediately
  document.querySelector('.panel-text[data-panel="0"]').classList.add('active');
  document.querySelector('.gutter .pip[data-p="0"]').classList.add('on');
  TREE.apply(0, 0);

  let raf = null;
  window.addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { syncPanel(); raf = null; });
  }, { passive: true });
  window.addEventListener('resize', () => TREE.apply(activePanel, 0));
})();
