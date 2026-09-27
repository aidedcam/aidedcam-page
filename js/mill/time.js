// Milling time model (spec §7). Seconds per move, then per M6 row and the program total. Pure.

// Every axis moves at its own rapid rate; the slowest axis decides.
export function rapidSeconds(dx, dy, dz, s) {
  return 60 * Math.max(Math.abs(dx) / s.rapidX, Math.abs(dy) / s.rapidY, Math.abs(dz) / s.rapidZ);
}

// mm/min at the current modal state, or null when it can't be known (no F, or G95 without S).
export function feedRate(st) {
  if (!(st.f > 0)) return null;
  if (st.feedMode === 'min') return st.f;
  return st.s > 0 ? st.f * st.s : null;
}

export function feedSeconds(length, rate) {
  return rate ? (60 * length) / rate : NaN;
}

// Rows arrive with raw seconds; the correction % applies to every timed part, as on the lathe.
// A row with an untimeable move is incomplete: it keeps its numbers for reference, but the program
// total leaves it out and is marked "≥" by the page (spec §7).
export function summarizeRows(rows, s) {
  const k = 1 + (s.correctionPct || 0) / 100;
  const out = rows.map(r => {
    const cut = r.cutSeconds * k, rapid = r.rapidSeconds * k, dwell = r.dwellSeconds * k, change = r.changeSeconds * k;
    return {
      tool: r.tool, label: r.label, firstLine: r.firstLine, moveStart: r.moveStart, moveEnd: r.moveEnd,
      cycles: r.holes, cutLength: r.cutLength,
      cutSeconds: cut, rapidSeconds: rapid, dwellSeconds: dwell, changeSeconds: change,
      totalSeconds: cut + rapid + dwell + change, incomplete: r.incomplete,
    };
  });
  const complete = out.filter(r => !r.incomplete);
  return {
    rows: out,
    total: complete.reduce((a, r) => a + r.totalSeconds, 0),
    incomplete: out.some(r => r.incomplete),
  };
}
