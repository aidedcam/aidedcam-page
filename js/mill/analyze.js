// Milling pipeline entry point (spec §3.2): text → MillResult. Pure and Node-testable; the worker
// is a thin wrapper around it. Lines are parsed as they execute (streaming), so a 1M-line program
// never holds 1M block objects at once.
import { parseLine } from '../gcode/parse.js';
import { millSettings, MILL_MAX_LINES, MILL_MAX_CHARS } from './settings.js';
import { newMillContext, execBlock, closeRows, millEvent, markIncomplete } from './machine.js';
import { createRunner, applyFlow } from './subprograms.js';
import { finishMoves, buildLineIndex, K_FEED, K_CFEED } from './moves.js';
import { summarizeRows } from './time.js';
import { finalizeWarnings, looksLikeLathe } from './checks.js';

export { MILL_MAX_LINES, MILL_MAX_CHARS };

function boundsOf(moves, keep) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let any = false;
  for (let i = 0; i < moves.count; i++) {
    if (!keep(moves.kind[i])) continue;
    any = true;
    for (let e = 0; e < 2; e++) {
      for (let a = 0; a < 3; a++) {
        const v = moves.pos[i * 6 + e * 3 + a];
        if (v < min[a]) min[a] = v;
        if (v > max[a]) max[a] = v;
      }
    }
  }
  return any ? { min, max } : null;
}

function countLines(src) {
  let n = 1;
  for (let i = src.indexOf('\n'); i !== -1; i = src.indexOf('\n', i + 1)) n++;
  return n;
}

function emptyResult(lineCount, tooLarge) {
  const moves = finishMoves({ count: 0, pos: new Float32Array(0), kind: new Uint8Array(0), line: new Uint32Array(0),
    row: new Uint16Array(0), wofs: new Uint8Array(0), seconds: new Float32Array(0) });
  return { lines: lineCount, units: 'mm', tooLarge, control: 'fanuc', moves, lineIndex: buildLineIndex(moves, lineCount),
    bounds: null, cutBounds: null, timing: { rows: [], total: 0, incomplete: false }, movesCapped: false, workOffsets: ['G54'],
    warnings: [], markers: [], cycles: 0, stats: { skipped: 0, subprogramCalls: 0 } };
}

export function analyzeMill(text, settingsIn, { onProgress } = {}) {
  const s = millSettings(settingsIn);
  const src = String(text);
  if (src.length > MILL_MAX_CHARS) return emptyResult(countLines(src), true);   // never split a huge text
  const lines = src.split(/\r\n?|\n/);
  if (lines.length > MILL_MAX_LINES) return emptyResult(lines.length, true);

  const ctx = newMillContext(s);
  const run = createRunner(lines);
  // Executed-line budget: stops call loops, and bounds memory when finite repeats multiply a program past
  // what the page can hold (about 1M moves measured 295 MB). Either way the time is incomplete from here.
  const cap = Math.max(1e6, lines.length * 5);
  const flowEvent = (id, params, line) => { millEvent(ctx, id, params, line); if (id === 'sub-loop') markIncomplete(ctx); };
  let executed = 0;
  while (run.pc < lines.length) {
    if (++executed > cap) { flowEvent('sub-loop', {}, run.pc + 1); break; }
    const b = parseLine(lines[run.pc], run.pc + 1);
    run.pc++;
    const flow = execBlock(ctx, b);
    if (onProgress && executed % 50000 === 0) onProgress(executed, lines.length);
    if (flow && !applyFlow(run, flow, (id, params) => flowEvent(id, params, b.line))) break;
  }
  closeRows(ctx);
  if (looksLikeLathe(ctx.flags)) millEvent(ctx, 'lathe-program', {}, ctx.flags.latheLine);

  const moves = finishMoves(ctx.moves);
  const bounds = boundsOf(moves, () => true);
  return {
    lines: lines.length,
    units: ctx.sawInch ? 'inch' : 'mm',
    tooLarge: false,
    control: ctx.flags.haas ? 'haas' : 'fanuc',
    moves,
    lineIndex: buildLineIndex(moves, lines.length),
    bounds,
    cutBounds: boundsOf(moves, k => k === K_FEED || k === K_CFEED) || bounds,
    timing: summarizeRows(ctx.rows, s),
    movesCapped: Boolean(ctx.movesCapped),
    workOffsets: ctx.wofsNames,
    warnings: finalizeWarnings(ctx.events),
    markers: ctx.markers,
    cycles: ctx.holes,
    stats: { skipped: ctx.events.filter(e => e.id === 'skipped').length, subprogramCalls: run.calls },
  };
}
