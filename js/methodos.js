(() => {
  // "System ▸ Workflow ▸ Task ▸ Result" animated zoom.
  // Self-contained: the scene cycles through the four views while it is on
  // screen; a tab click jumps to that view and stops the cycle for good, so
  // the visitor can watch a view for as long as they like.
  // No window-scroll hijacking. Copy is EN / EL / IT and follows <html lang>.

  // ── I18N ──
  const COPY = {
    en: {
      thesisHTML: 'A company is a <strong>system</strong> of workflows. A workflow is a <strong>chain</strong> of tasks. Automation starts at the <strong>task</strong> — the gain shows up in the system.',
      corner: 'How we look at your work',
      tabs: { system: 'System', workflow: 'Workflow', task: 'Task', result: 'Result' },
      lookLabel: 'What we look for',
      changeLabel: 'What changes',
      system: {
        k: '03 · Step all the way back',
        t: 'The <strong>system</strong>',
        d: 'All the workflows in your company, and how they hand work to each other — from design, through preparation, to production.',
        r: 'Where the <strong>same information is entered twice</strong>, and where one team’s output doesn’t fit the next team’s input.',
      },
      workflow: {
        k: '02 · Step back',
        t: 'One <strong>workflow</strong>',
        d: 'The chain of steps a job travels through, from the moment it comes in until it is delivered.',
        r: 'Which steps <strong>block the others</strong>, and where the work sits <strong>waiting</strong> for someone.',
      },
      task: {
        k: '01 · Up close',
        t: 'One <strong>task</strong>',
        d: 'A single step, done by one person, the same way every time. Nobody notices it — it’s just how the work is done.',
        r: 'The steps that are <strong>manual and repeated</strong>. This is where we start.',
      },
      result: {
        k: '04 · The whole picture',
        t: 'The <strong>result</strong>',
        d: 'We automate the task. The workflow gets shorter. The whole system moves faster — with the same people.',
        r: 'Hours become <strong>minutes</strong>, errors <strong>disappear</strong>, and the know-how lives in the <strong>software</strong>, not in one person’s head.',
      },
      cols: ['Design', 'Preparation', 'Production'],
      sysNote: 'Same information, entered twice',
      steps: ['Receive', 'Check', 'Prepare', 'Execute', 'Approve', 'Deliver'],
      wait: 'waiting',
      wfNote: 'Work waits here',
      taskTitle: 'Prepare the file',
      taskSteps: ['Open the model', 'Check units & layers', 'Apply your standards', 'Name & save'],
      taskFoot: 'By hand · same way · every time',
      autoLabel: 'Automated',
      resNote: 'One action instead of three steps',
    },
    el: {
      thesisHTML: 'Μια εταιρεία είναι ένα <strong>σύστημα</strong> από ροές. Μια ροή είναι μια <strong>αλυσίδα</strong> από εργασίες. Η αυτοματοποίηση ξεκινά από την <strong>εργασία</strong> — το κέρδος φαίνεται στο σύστημα.',
      corner: 'Πώς βλέπουμε τη δουλειά σας',
      tabs: { system: 'Σύστημα', workflow: 'Ροή', task: 'Εργασία', result: 'Αποτέλεσμα' },
      lookLabel: 'Τι ψάχνουμε',
      changeLabel: 'Τι αλλάζει',
      system: {
        k: '03 · Ακόμη πιο πίσω',
        t: 'Το <strong>σύστημα</strong>',
        d: 'Όλες οι ροές της εταιρείας σας και το πώς παραδίδουν τη δουλειά η μία στην άλλη — από τον σχεδιασμό, στην προετοιμασία, στην παραγωγή.',
        r: 'Πού η <strong>ίδια πληροφορία μπαίνει δύο φορές</strong>, και πού αυτό που βγάζει μια ομάδα δεν ταιριάζει με αυτό που χρειάζεται η επόμενη.',
      },
      workflow: {
        k: '02 · Ένα βήμα πίσω',
        t: 'Μία <strong>ροή</strong>',
        d: 'Η αλυσίδα των βημάτων που περνά μια δουλειά, από τη στιγμή που μπαίνει μέχρι να παραδοθεί.',
        r: 'Ποια βήματα <strong>μπλοκάρουν τα υπόλοιπα</strong>, και πού η δουλειά <strong>περιμένει</strong> κάποιον.',
      },
      task: {
        k: '01 · Από κοντά',
        t: 'Μία <strong>εργασία</strong>',
        d: 'Ένα μόνο βήμα, από ένα άτομο, με τον ίδιο τρόπο κάθε φορά. Κανείς δεν το προσέχει — έτσι γίνεται η δουλειά.',
        r: 'Τα βήματα που γίνονται <strong>με το χέρι και επαναλαμβάνονται</strong>. Από εδώ ξεκινάμε.',
      },
      result: {
        k: '04 · Η συνολική εικόνα',
        t: 'Το <strong>αποτέλεσμα</strong>',
        d: 'Αυτοματοποιούμε την εργασία. Η ροή γίνεται πιο σύντομη. Όλο το σύστημα κινείται πιο γρήγορα — με τους ίδιους ανθρώπους.',
        r: 'Οι ώρες γίνονται <strong>λεπτά</strong>, τα λάθη <strong>εξαφανίζονται</strong>, και η τεχνογνωσία ζει στο <strong>λογισμικό</strong>, όχι στο κεφάλι ενός ανθρώπου.',
      },
      cols: ['Σχεδιασμός', 'Προετοιμασία', 'Παραγωγή'],
      sysNote: 'Ίδια πληροφορία, δύο φορές',
      steps: ['Παραλαβή', 'Έλεγχος', 'Στήσιμο', 'Εκτέλεση', 'Έγκριση', 'Παράδοση'],
      wait: 'αναμονή',
      wfNote: 'Εδώ περιμένει η δουλειά',
      taskTitle: 'Προετοιμασία αρχείου',
      taskSteps: ['Άνοιγμα μοντέλου', 'Έλεγχος μονάδων & layers', 'Εφαρμογή προτύπων', 'Ονομασία & αποθήκευση'],
      taskFoot: 'Με το χέρι · ίδιος τρόπος · κάθε φορά',
      autoLabel: 'Αυτόματα',
      resNote: 'Μία ενέργεια αντί για τρία βήματα',
    },
    it: {
      thesisHTML: 'Un’azienda è un <strong>sistema</strong> di flussi. Un flusso è una <strong>catena</strong> di attività. L’automazione parte dall’<strong>attività</strong> — il guadagno si vede nel sistema.',
      corner: 'Come guardiamo il vostro lavoro',
      tabs: { system: 'Sistema', workflow: 'Flusso', task: 'Attività', result: 'Risultato' },
      lookLabel: 'Cosa cerchiamo',
      changeLabel: 'Cosa cambia',
      system: {
        k: '03 · Ancora più indietro',
        t: 'Il <strong>sistema</strong>',
        d: 'Tutti i flussi della vostra azienda e come si passano il lavoro — dalla progettazione, alla preparazione, alla produzione.',
        r: 'Dove la <strong>stessa informazione viene inserita due volte</strong>, e dove ciò che produce un team non combacia con ciò che serve al successivo.',
      },
      workflow: {
        k: '02 · Un passo indietro',
        t: 'Un <strong>flusso</strong>',
        d: 'La catena di passaggi che un lavoro attraversa, da quando entra a quando viene consegnato.',
        r: 'Quali passaggi <strong>bloccano gli altri</strong>, e dove il lavoro resta <strong>in attesa</strong> di qualcuno.',
      },
      task: {
        k: '01 · Da vicino',
        t: 'Un’<strong>attività</strong>',
        d: 'Un singolo passaggio, fatto da una persona, sempre allo stesso modo. Nessuno ci fa caso — è così che si lavora.',
        r: 'I passaggi <strong>manuali e ripetuti</strong>. È da qui che partiamo.',
      },
      result: {
        k: '04 · Il quadro completo',
        t: 'Il <strong>risultato</strong>',
        d: 'Automatizziamo l’attività. Il flusso si accorcia. Tutto il sistema va più veloce — con le stesse persone.',
        r: 'Le ore diventano <strong>minuti</strong>, gli errori <strong>spariscono</strong>, e il know-how vive nel <strong>software</strong>, non nella testa di una persona.',
      },
      cols: ['Progettazione', 'Preparazione', 'Produzione'],
      sysNote: 'Stessa informazione, due volte',
      steps: ['Arrivo', 'Verifica', 'Prepara', 'Esegui', 'Approva', 'Consegna'],
      wait: 'attesa',
      wfNote: 'Qui il lavoro aspetta',
      taskTitle: 'Prepara il file',
      taskSteps: ['Apri il modello', 'Controlla unità e layer', 'Applica gli standard', 'Nomina e salva'],
      taskFoot: 'A mano · stesso modo · ogni volta',
      autoLabel: 'Automatizzato',
      resNote: 'Un’azione invece di tre passaggi',
    },
  };

  const ORDER = ['task', 'workflow', 'system', 'result'];
  const DWELL = { system: 4600, workflow: 5400, task: 5200, result: 5000 };

  const root = document.querySelector('.tm-root');
  if (!root) return;
  const scene = root.querySelector('.method-scene');
  const views = {};
  root.querySelectorAll('.mv').forEach(v => { views[v.dataset.view] = v; });
  const tabs = Array.from(root.querySelectorAll('.m-tab'));
  const thesisEl = root.querySelector('.method-thesis');
  const info = {
    k:  root.querySelector('[data-mk]'),
    t:  root.querySelector('[data-mt]'),
    d:  root.querySelector('[data-md]'),
    rl: root.querySelector('[data-mrl]'),
    r:  root.querySelector('[data-mr]'),
  };
  if (!scene || !info.t) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lang = 'el';
  let view = 'system';

  // ── Copy ──
  function setList(selector, arr) {
    root.querySelectorAll(selector).forEach((n, i) => { if (arr[i] !== undefined) n.textContent = arr[i]; });
  }
  function renderCopy(animate) {
    const c = COPY[lang] || COPY.el;
    if (thesisEl) thesisEl.innerHTML = c.thesisHTML;
    scene.setAttribute('data-corner', c.corner);
    tabs.forEach(b => { b.textContent = c.tabs[b.dataset.layer]; });
    // scene labels
    setList('.mv-system .ms-col .mtag', c.cols);
    setList('.mv-result .ms-col .mtag', c.cols);
    setList('.mv-system .mnote', [c.sysNote]);
    setList('.mv-workflow .mw-cell .mtag', c.steps);
    setList('.mv-workflow .mnote', [c.wfNote]);
    root.querySelectorAll('.mw-gap.wait').forEach(g => g.setAttribute('data-label', c.wait));
    setList('.mv-task .mt-head .mtag', [c.taskTitle]);
    setList('.mv-task .mt-steps li span', c.taskSteps);
    setList('.mv-task .mt-foot', [c.taskFoot]);
    setList('.mv-result .mw-cell:not(.auto) .mtag', [c.steps[0], c.steps[1], c.steps[5]]);
    setList('.mv-result .mw-cell.auto .mtag', [c.autoLabel]);
    setList('.mv-result .mnote', [c.resNote]);
    // info column
    const m = c[view];
    info.k.textContent = m.k;
    info.t.innerHTML = m.t;
    info.d.innerHTML = m.d;
    info.rl.textContent = view === 'result' ? c.changeLabel : c.lookLabel;
    info.r.innerHTML = m.r;
    if (animate && !reduced) {
      [info.k, info.t, info.d, info.r].forEach(el => { el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); });
    }
  }

  // ── Views ──
  const ZOOM = { task: 3, workflow: 2, system: 1, result: 0 };
  function setView(next) {
    if (!views[next] || next === view) return;
    // closer = zoom in, further = zoom out (result is the furthest: the whole picture)
    scene.setAttribute('data-dir', ZOOM[next] > ZOOM[view] ? 'in' : 'out');
    const leaving = views[view];
    Object.values(views).forEach(v => v.classList.remove('is-leaving'));
    if (leaving && leaving !== views[next]) {
      leaving.classList.remove('is-on');
      leaving.classList.add('is-leaving');
      setTimeout(() => leaving.classList.remove('is-leaving'), 800);
    }
    view = next;
    scene.setAttribute('data-view', next);
    views[next].classList.add('is-on');
    tabs.forEach(b => {
      const on = b.dataset.layer === next;
      b.classList.toggle('on', on);
      b.classList.toggle('is-result', on && next === 'result');
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    renderCopy(true);
    if (next === 'task') startTaskLoop(); else stopTaskLoop();
    if (next === 'workflow' || next === 'result') measureChain();
  }

  // Positions of the chain cells (as % of the chain width) feed the CSS keyframes.
  function measureChain() {
    const setVars = (chain, prefix, waitVar) => {
      if (!chain) return;
      const cw = chain.getBoundingClientRect();
      if (!cw.width) return;
      const cells = Array.from(chain.querySelectorAll('.mw-cell'));
      cells.forEach((cell, i) => {
        const r = cell.getBoundingClientRect();
        chain.style.setProperty(prefix + (i + 1), (((r.left + r.width / 2) - cw.left) / cw.width * 100).toFixed(2) + '%');
      });
      const wait = chain.querySelector('.mw-gap.wait');
      if (wait && waitVar) {
        const r = wait.getBoundingClientRect();
        chain.style.setProperty(waitVar, (((r.left + r.width / 2) - cw.left) / cw.width * 100).toFixed(2) + '%');
      }
    };
    setVars(root.querySelector('.mv-workflow .mw-chain'), '--p', '--pw');
    setVars(root.querySelector('.mv-result .mw-chain'), '--r', null);
    drawTie();
  }

  // System view: dashed tie between the two "same information" cells,
  // drawn from their real positions so it survives any viewport.
  function drawTie() {
    const mv = views.system;
    const svg = mv && mv.querySelector('.ms-tie');
    const dups = mv ? mv.querySelectorAll('.ms-cells i.dup') : [];
    if (!svg || dups.length < 2) return;
    const box = mv.getBoundingClientRect();
    if (!box.width) return;
    const a = dups[0].getBoundingClientRect(), b = dups[1].getBoundingClientRect();
    const ax = a.left + a.width / 2 - box.left, ay = a.bottom - box.top;
    const bx = b.left + b.width / 2 - box.left, by = b.bottom - box.top;
    const dip = Math.max(ay, by) + Math.min(box.height * 0.22, 70);
    svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);
    svg.querySelector('path').setAttribute('d',
      'M' + ax.toFixed(1) + ' ' + ay.toFixed(1) +
      ' C ' + ax.toFixed(1) + ' ' + dip.toFixed(1) + ', ' + bx.toFixed(1) + ' ' + dip.toFixed(1) + ', ' + bx.toFixed(1) + ' ' + by.toFixed(1));
  }

  // Task view: tick the four sub-steps, then wipe and count another repetition.
  let taskTimer = null;
  let taskCount = 0;
  function stopTaskLoop() { clearTimeout(taskTimer); taskTimer = null; }
  function startTaskLoop() {
    stopTaskLoop();
    const items = Array.from(root.querySelectorAll('.mv-task .mt-steps li'));
    const count = root.querySelector('.mv-task .mt-count');
    if (!items.length || !count) return;
    if (reduced) { items.forEach(li => li.classList.add('done')); count.textContent = '×12'; return; }
    taskCount = 0;
    const cycle = () => {
      items.forEach(li => li.classList.remove('done'));
      taskCount += 1;
      count.textContent = '×' + taskCount;
      items.forEach((li, i) => { taskTimer = setTimeout(() => li.classList.add('done'), 260 + i * 300); });
      taskTimer = setTimeout(cycle, 260 + items.length * 300 + 650);
    };
    cycle();
  }

  // ── Auto cycle while on screen; the first tab click ends it ──
  let visible = false;
  let autoTimer = null;
  let userDriven = false;
  function scheduleNext() {
    clearTimeout(autoTimer);
    if (!visible || reduced || userDriven) return;
    const wait = DWELL[view];
    autoTimer = setTimeout(() => {
      if (!visible) return;
      const i = ORDER.indexOf(view);
      setView(ORDER[(i + 1) % ORDER.length]);
      scheduleNext();
    }, wait);
  }

  tabs.forEach(b => b.addEventListener('click', () => {
    userDriven = true;
    clearTimeout(autoTimer);
    setView(b.dataset.layer);
  }));

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      entries.forEach(e => {
        visible = e.isIntersecting;
        if (visible) { measureChain(); scheduleNext(); if (view === 'task') startTaskLoop(); }
        else { clearTimeout(autoTimer); stopTaskLoop(); }
      });
    }, { threshold: 0.35 }).observe(scene);
  } else {
    visible = true; scheduleNext();
  }
  window.addEventListener('resize', measureChain);

  // ── Language sync with the site (EL / EN / IT) ──
  const pick = () => (COPY[document.documentElement.lang] ? document.documentElement.lang : 'el');
  lang = pick();
  view = 'task';
  views.task.classList.add('is-on');
  scene.setAttribute('data-view', 'task');
  scene.setAttribute('data-dir', 'out');
  renderCopy(false);
  measureChain();
  new MutationObserver(() => { lang = pick(); renderCopy(false); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
})();
