// In-file subprograms (spec §4): M98 P<o> (repeat L/K, or the older P<repeat><oooo> form), Haas
// M97 P<n> to a sequence number, M99 return. Pure: works on the raw lines and a small call stack.
export const MAX_DEPTH = 4;

// O number → index of its O line (':' is the ISO program-number sign). First occurrence wins.
export function indexPrograms(lines) {
  const map = new Map();
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*[Oo:](\d+)/.exec(lines[i]);
    if (m && !map.has(Number(m[1]))) map.set(Number(m[1]), i);
  }
  return map;
}

// N number → index of its line, for M97. Built only when a program uses M97.
export function indexSequenceNumbers(lines) {
  const map = new Map();
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*\/?\s*[Nn](\d+)/.exec(lines[i]);
    if (m && !map.has(Number(m[1]))) map.set(Number(m[1]), i);
  }
  return map;
}

export function createRunner(lines) {
  return { lines, pc: 0, stack: [], oIndex: indexPrograms(lines), nIndex: null, calls: 0 };
}

// Applies one flow instruction from execBlock after the runner has already advanced pc past the
// block. report(id, params) records a check. Returns false when the program ends.
export function applyFlow(run, flow, report) {
  if (flow.end) return false;
  if (flow.ret) {
    if (!run.stack.length) { report('main-m99', {}); return false; }   // the control would loop
    const top = run.stack[run.stack.length - 1];
    if (top.remaining > 1) { top.remaining--; run.pc = top.start; }
    else { run.stack.pop(); run.pc = top.returnTo; }
    return true;
  }
  if (flow.call) {
    let start, repeat = flow.repeat;
    if (flow.call === 'M98') {
      start = run.oIndex.get(flow.o);
      if (flow.whole !== undefined && run.oIndex.has(flow.whole)) { start = run.oIndex.get(flow.whole); repeat = 1; }   // Haas O12345
    }
    else { run.nIndex = run.nIndex || indexSequenceNumbers(run.lines); start = run.nIndex.get(flow.n); }
    if (start === undefined) { report('sub-missing', { p: flow.call === 'M98' ? (flow.whole ?? flow.o) : flow.n }); return true; }
    if (run.stack.length >= MAX_DEPTH) { report('sub-loop', {}); return true; }
    if (!(repeat >= 1)) return true;                             // L0: no call
    run.stack.push({ returnTo: run.pc, start, remaining: repeat });
    run.calls++;
    run.pc = start;
  }
  return true;
}
