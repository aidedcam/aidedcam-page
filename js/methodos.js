(() => {
  // "System ▸ Workflow ▸ Task" nested-layers block.
  // Self-contained: tabs switch the focused layer; on first scroll into view
  // it plays one gentle pass through the layers, then hands control to the user.
  // No window-scroll hijacking. Copy is available in EN / EL / IT and follows
  // the site language (<html lang>).

  // ── I18N ──
  const COPY = {
    en: {
      thesisHTML: 'Every <strong>system</strong> is a pack of <strong>workflows</strong>. Every <strong>workflow</strong> is a pack of <strong>tasks</strong>.',
      reveals: 'This view reveals',
      taskK: 'Zoom in', wfK: 'Zoom out', sysK: 'Zoom all the way out',
      taskTitle: 'A <strong>task</strong>.',
      taskDefn: 'One action, done by one person, done the same way again and again. The substance of every company — and most of them are invisible from where the owner sits.',
      taskReveals: 'Which individual steps are <strong>manual, repeated, and ripe</strong> for someone — or something — else to take over.',
      wfTitle: 'A <strong>workflow</strong>.',
      wfDefn: 'A sequence of tasks that produces a result. Not a chart on a wall — the actual chain a piece of work travels through, from the moment it starts until someone is done with it.',
      wfReveals: 'Which tasks <strong>block others</strong>, and which <strong>handoffs add time</strong> without adding value.',
      sysTitle: 'A <strong>system</strong>.',
      sysDefn: 'How the workflows in your company connect to each other — what they share, and what they don’t.',
      sysReveals: 'Where the <strong>same information</strong> lives in more than one place, where <strong>tools overlap</strong>, and where one group’s output doesn’t quite fit the next group’s input.',
      labels: { system: 'System', workflow: 'Workflow', task: 'Task' },
    },
    el: {
      thesisHTML: 'Κάθε <strong>σύστημα</strong> είναι ένα σύνολο από <strong>ροές</strong>. Κάθε <strong>ροή</strong> είναι ένα σύνολο από <strong>εργασίες</strong>.',
      reveals: 'Αυτό το επίπεδο αποκαλύπτει',
      taskK: 'Εστίαση μέσα', wfK: 'Πιο πίσω', sysK: 'Πολύ πιο πίσω',
      taskTitle: 'Μία <strong>εργασία</strong>.',
      taskDefn: 'Μία ενέργεια, από ένα άτομο, με τον ίδιο τρόπο κάθε φορά. Η ύλη κάθε εταιρείας — κι οι περισσότερες είναι αόρατες από τη θέση του ιδιοκτήτη.',
      taskReveals: 'Ποια βήματα γίνονται <strong>με το χέρι, επαναληπτικά</strong>, και είναι ώριμα να τα αναλάβει κάποιος — ή κάτι — άλλος.',
      wfTitle: 'Μία <strong>ροή</strong>.',
      wfDefn: 'Μια ακολουθία εργασιών που παράγει ένα αποτέλεσμα. Όχι διάγραμμα σε τοίχο — η πραγματική αλυσίδα από την οποία περνάει η δουλειά.',
      wfReveals: 'Ποιες εργασίες <strong>μπλοκάρουν άλλες</strong>, και ποιες <strong>μεταβιβάσεις</strong> προσθέτουν χρόνο χωρίς να προσθέτουν αξία.',
      sysTitle: 'Ένα <strong>σύστημα</strong>.',
      sysDefn: 'Πώς οι ροές της εταιρείας σας συνδέονται μεταξύ τους — τι μοιράζονται και τι όχι.',
      sysReveals: 'Πού η <strong>ίδια πληροφορία</strong> ζει σε παραπάνω από ένα σημεία, πού <strong>τα εργαλεία επικαλύπτονται</strong>, και πού το αποτέλεσμα μιας ομάδας δεν ταιριάζει στην επόμενη.',
      labels: { system: 'Σύστημα', workflow: 'Ροή', task: 'Εργασία' },
    },
    it: {
      thesisHTML: 'Ogni <strong>sistema</strong> è un insieme di <strong>flussi</strong>. Ogni <strong>flusso</strong> è un insieme di <strong>attività</strong>.',
      reveals: 'Questo livello rivela',
      taskK: 'Zoom avanti', wfK: 'Zoom indietro', sysK: 'Zoom totale',
      taskTitle: "Un'<strong>attività</strong>.",
      taskDefn: "Un'azione, svolta da una persona, allo stesso modo ancora e ancora. La sostanza di ogni azienda — e la maggior parte sono invisibili dalla postazione del titolare.",
      taskReveals: 'Quali passaggi sono <strong>manuali, ripetuti e pronti</strong> per essere presi in carico da qualcuno — o qualcosa — altro.',
      wfTitle: 'Un <strong>flusso</strong>.',
      wfDefn: 'Una sequenza di attività che produce un risultato. Non un diagramma su un muro — la vera catena attraverso cui viaggia un pezzo di lavoro, dal momento in cui inizia fino alla fine.',
      wfReveals: 'Quali attività <strong>bloccano le altre</strong>, e quali <strong>passaggi aggiungono tempo</strong> senza aggiungere valore.',
      sysTitle: 'Un <strong>sistema</strong>.',
      sysDefn: 'Come i flussi della vostra azienda si collegano tra loro — cosa condividono e cosa no.',
      sysReveals: "Dove le <strong>stesse informazioni</strong> vivono in più di un luogo, dove gli <strong>strumenti si sovrappongono</strong>, e dove l'output di un gruppo non si adatta bene all'input del successivo.",
      labels: { system: 'Sistema', workflow: 'Flusso', task: 'Attività' },
    },
  };

  const LAYER = {
    task:     { k: 'taskK', t: 'taskTitle', d: 'taskDefn', r: 'taskReveals' },
    workflow: { k: 'wfK',   t: 'wfTitle',   d: 'wfDefn',   r: 'wfReveals' },
    system:   { k: 'sysK',  t: 'sysTitle',  d: 'sysDefn',  r: 'sysReveals' },
  };
  const ORDER = ['system', 'workflow', 'task'];

  const root = document.querySelector('.tm-root');
  if (!root) return;
  const diagram = root.querySelector('.method-diagram');
  const tabs = Array.from(root.querySelectorAll('.m-tab'));
  const thesisEl = root.querySelector('.method-thesis');
  const els = {
    k:  root.querySelector('[data-mk]'),
    t:  root.querySelector('[data-mt]'),
    d:  root.querySelector('[data-md]'),
    rl: root.querySelector('[data-mrl]'),
    r:  root.querySelector('[data-mr]'),
  };
  if (!diagram || !els.t) return;

  let lang = 'el';
  let layer = 'system';

  function renderCopy() {
    const c = COPY[lang] || COPY.el;
    if (thesisEl) thesisEl.innerHTML = c.thesisHTML;
    if (els.rl) els.rl.textContent = c.reveals;
    tabs.forEach(b => { b.textContent = c.labels[b.dataset.layer]; });
    root.querySelectorAll('[data-ml]').forEach(n => { n.textContent = c.labels[n.dataset.ml]; });
    const m = LAYER[layer];
    if (els.k) els.k.textContent = c[m.k];
    els.t.innerHTML = c[m.t];
    if (els.d) els.d.innerHTML = c[m.d];
    if (els.r) els.r.innerHTML = c[m.r];
  }

  function setLayer(next) {
    if (!LAYER[next]) return;
    layer = next;
    diagram.setAttribute('data-focus', next);
    tabs.forEach(b => {
      const on = b.dataset.layer === next;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    renderCopy();
  }

  // ── Gentle auto first-pass (stops on any user interaction) ──
  let interacted = false;
  let played = false;
  const timers = [];
  function clearTimers() { timers.forEach(clearTimeout); timers.length = 0; }
  function stopAuto() { interacted = true; clearTimers(); }
  function playPass() {
    if (played || interacted) return;
    played = true;
    // system is already shown; reveal workflow, then task.
    timers.push(setTimeout(() => { if (!interacted) setLayer('workflow'); }, 2600));
    timers.push(setTimeout(() => { if (!interacted) setLayer('task'); }, 5200));
    timers.push(setTimeout(() => { if (!interacted) setLayer('system'); }, 8200));
  }

  tabs.forEach(b => b.addEventListener('click', () => { stopAuto(); setLayer(b.dataset.layer); }));
  // Clicking a workflow card in the diagram jumps to that layer too.
  diagram.querySelectorAll('.md-flow').forEach(flow => {
    flow.addEventListener('click', () => {
      stopAuto();
      diagram.querySelectorAll('.md-flow').forEach(f => f.classList.toggle('is-active', f === flow));
      setLayer(layer === 'task' ? 'task' : 'workflow');
    });
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => { if (e.isIntersecting) { playPass(); obs.disconnect(); } });
    }, { threshold: 0.45 });
    io.observe(diagram);
  } else {
    playPass();
  }

  // ── Language sync with the site (EL / EN / IT) ──
  const pick = () => (COPY[document.documentElement.lang] ? document.documentElement.lang : 'el');
  lang = pick();
  setLayer('system');
  new MutationObserver(() => { lang = pick(); renderCopy(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
})();
