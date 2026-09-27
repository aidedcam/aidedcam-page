// Shared by both viewers: the time table and the checks list. Each viewer passes its own columns
// and check-text lookup; the "–" and "≥" rules live here once.
function cell(text) { const c = document.createElement('td'); c.textContent = text; return c; }

// columns: [(row) => text, ...]. An incomplete row shows "–" in every column whose function
// returns null for it (the timed cells).
export function renderTimeRows(tbody, rows, columns) {
  const frag = document.createDocumentFragment();
  for (const row of rows) {
    const tr = document.createElement('tr');
    for (const col of columns) { const v = col(row); tr.appendChild(cell(v === null ? '–' : v)); }
    frag.appendChild(tr);
  }
  tbody.replaceChildren(frag);
}

// The total counts only complete rows; "≥" says it leaves the incomplete ones out.
export function renderTotal(totalEl, noteEl, timing, formatDuration) {
  const total = timing.rows.filter(r => !r.incomplete).reduce((a, r) => a + r.totalSeconds, 0);
  totalEl.textContent = (timing.incomplete ? '≥ ' : '') + formatDuration(total);
  noteEl.hidden = !timing.incomplete;
}

// Loop-based (a program can carry thousands of warnings). Each line button pins its line.
export function renderCheckList(ul, warnings, { text, lineLabel, noneText, onLine }) {
  if (!warnings.length) {
    const li = document.createElement('li');
    li.className = 'gv-w is-ok';
    li.textContent = noneText;
    ul.replaceChildren(li);
    return;
  }
  const frag = document.createDocumentFragment();
  for (const w of warnings) {
    const li = document.createElement('li');
    li.className = `gv-w is-${w.severity}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gv-w-line';
    btn.textContent = `${lineLabel} ${w.line ?? '–'}`;
    btn.addEventListener('click', () => { if (w.line) onLine(w.line); });
    const msg = document.createElement('span');
    msg.textContent = text(w);
    li.append(btn, msg);
    frag.appendChild(li);
  }
  ul.replaceChildren(frag);
}
