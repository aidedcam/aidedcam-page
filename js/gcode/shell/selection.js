// Shared by both viewers: which program line is highlighted, and whether it is pinned. Pure (no
// DOM): apply(line | null, scroll) does the drawing; onClear() runs when a pin is dropped.
// Hover changes the highlight only while nothing is pinned. Clicking the pinned line again
// unpins it (toggle), so touch users have a way out; a check's "Line N" link always pins.
export function createSelection({ apply, onClear = () => {} }) {
  let pinned = null, current = null;
  const set = (line, scroll) => { current = line; apply(line, scroll); };
  const sel = {
    get pinned() { return pinned; },
    get line() { return current; },
    hover(line, scroll = false) {
      if (pinned !== null) return false;
      set(line, scroll);
      return true;
    },
    pin(line, { toggle = true } = {}) {
      if (toggle && pinned === line) { sel.clear(); return; }
      pinned = line;
      set(line, true);
    },
    clear() { pinned = null; set(null, false); onClear(); },
    // A new program: no pin and no hover, without drawing anything.
    reset() { pinned = null; current = null; },
    // After an edit or a settings re-run: keep the pin if the line still exists.
    reapply(lineCount) {
      if (pinned === null) return;
      if (pinned <= lineCount) set(pinned, false);
      else sel.clear();
    },
  };
  return sel;
}
