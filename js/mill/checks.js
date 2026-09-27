// Milling program checks (spec §6): events from machine.js and the runner become warnings. Pure.
// Text for each id lives in the shared viewer strings under gv.mcheck.<id> (GR/EN/IT).
export const MILL_SEVERITY = {
  'no-g43': 'warn', 'h-mismatch': 'info', 'spindle-off': 'warn', 'no-feed': 'error',
  'comp-no-d': 'warn', 'comp-left-on': 'warn', 'rapid-into-material': 'warn', 'arc-radius': 'error',
  'cycle-no-r': 'error', 'peck-no-q': 'error', 'cycle-no-start': 'warn',
  'sub-missing': 'warn', 'sub-loop': 'error', 'main-m99': 'info',
  'unsupported': 'info', 'approximated': 'info', 'skipped': 'info', 'lathe-program': 'info',
};
export const MILL_ONCE = new Set(['lathe-program', 'main-m99']);
export const WARN_CAP = 200;                  // per id; the rest collapse into one "more" entry

export function finalizeWarnings(events) {
  const seen = new Set(), perId = new Map(), more = new Map(), out = [];
  for (const e of events) {
    const key = MILL_ONCE.has(e.id) ? e.id : `${e.id}@${e.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const n = (perId.get(e.id) || 0) + 1;
    perId.set(e.id, n);
    if (n > WARN_CAP) {
      const m = more.get(e.id) || { line: e.line, count: 0 };
      m.count++;
      more.set(e.id, m);
      continue;
    }
    out.push({ line: e.line, id: e.id, severity: MILL_SEVERITY[e.id] || 'info', params: e.params || {} });
  }
  for (const [id, m] of more) {
    out.push({ line: m.line, id: 'more', severity: MILL_SEVERITY[id] || 'info', params: { count: m.count, of: id } });
  }
  return out.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
}

// A lathe program opened in the milling viewer (spec §2 handoff): no Y word anywhere, plus a
// lathe-only code, or G18 as the only plane code.
export function looksLikeLathe(flags) {
  if (flags.hasY) return false;
  if (flags.latheLine !== null) return true;
  return flags.planes.size === 1 && flags.planes.has(18);
}
