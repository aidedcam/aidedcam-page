// Shared by both viewers: the virtualised program panel. Only the visible lines (plus a margin)
// are in the DOM, so a 1M-line program scrolls as smoothly as a short one.
export const LINE_H = 20;                                 // px: must equal --gv-line-h in css/tools.css

// Browsers cap an element's height (Firefox at about 17.9M px), so past MAX_SPACER the spacer stops
// growing and the scroll position is scaled onto the lines by k. Below it k is exactly 1: nothing changes.
export const MAX_SPACER = 8000000;
export function panelScale(lineCount, viewH) {
  const natural = lineCount * LINE_H;
  const spacer = Math.min(natural, MAX_SPACER);
  const k = natural > spacer && spacer > viewH ? (natural - viewH) / (spacer - viewH) : 1;
  return { spacer, k };
}

// isHi(n) / hasWarn(n) style a line; onOver(n), onLeave(), onClick(n) report pointer use.
export function createProgramPanel(box, { isHi, hasWarn, onOver, onLeave, onClick }) {
  let lines = [''];
  const spacer = document.createElement('div');
  spacer.className = 'gv-code-spacer';
  const win = document.createElement('div');
  win.className = 'gv-code-window';
  spacer.appendChild(win);

  function paint() {
    const { k } = panelScale(lines.length, box.clientHeight);
    const top = box.scrollTop * k;                          // the scroll position in unscaled px
    const first = Math.max(0, Math.floor(top / LINE_H) - 20);
    const last = Math.min(lines.length, first + Math.ceil(box.clientHeight / LINE_H) + 40);
    const y = k === 1 ? first * LINE_H : box.scrollTop + first * LINE_H - top;
    win.style.transform = `translateY(${y}px)`;
    const frag = document.createDocumentFragment();
    for (let i = first; i < last; i++) {
      const n = i + 1;
      const row = document.createElement('div');
      row.className = 'gv-line' + (isHi(n) ? ' is-hi' : '') + (hasWarn(n) ? ' has-warn' : '');
      row.dataset.line = String(n);
      const no = document.createElement('span'); no.className = 'gv-no'; no.textContent = String(n);
      const tx = document.createElement('span'); tx.className = 'gv-tx'; tx.textContent = lines[i] || ' ';
      row.append(no, tx);
      frag.appendChild(row);
    }
    win.replaceChildren(frag);
  }

  box.addEventListener('scroll', () => requestAnimationFrame(paint));
  box.addEventListener('pointerover', e => {
    const row = e.target.closest && e.target.closest('.gv-line');
    if (row) onOver(Number(row.dataset.line));
  });
  box.addEventListener('pointerleave', () => onLeave());
  box.addEventListener('click', e => {
    const row = e.target.closest && e.target.closest('.gv-line');
    if (row) onClick(Number(row.dataset.line));
  });

  return {
    setText(text) {
      lines = String(text).split(/\r\n?|\n/);
      spacer.style.height = `${panelScale(lines.length, 0).spacer}px`;
      box.replaceChildren(spacer);
      paint();
    },
    clear() { lines = ['']; box.replaceChildren(); },
    lineCount() { return lines.length; },
    paint,
    // Keep a line in view; only scrolls when it is outside the visible part.
    scrollToLine(line) {
      const { k } = panelScale(lines.length, box.clientHeight);
      const top = (line - 1) * LINE_H, now = box.scrollTop * k;
      if (top < now || top > now + box.clientHeight - LINE_H) box.scrollTop = Math.max(0, top - box.clientHeight / 3) / k;
    },
  };
}
