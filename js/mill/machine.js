// Milling modal state and motion (spec §4). Pure: one parsed block in, moves and events out.
// Coordinates are program coordinates of the active work offset (tool tip, uncompensated), in mm.
import { K_RAPID, K_FEED, K_CFEED, K_CRAPID, createMoves, pushMove } from './moves.js';
import { rapidSeconds, feedRate, feedSeconds } from './time.js';
import { arcPath, PLANES } from './arcs.js';
import { holeMoves, DRILL_CODES, PECK_CODES, APPROXIMATED } from './cycles.js';

const AXES = ['x', 'y', 'z'];
const UNSUPPORTED_G = new Set([7.1, 10, 12, 12.1, 13, 16, 47, 51, 51.1, 53.1, 65, 66, 68, 68.2, 68.3, 68.4, 70, 71, 72, 107, 112, 150]);
const HAAS_G = new Set([12, 13, 47, 150, 154, 187]);
// Blocks whose axis words are data, not a move.
const NON_MOTION_G = new Set([4, 10, 28, 30, 51, 51.1, 52, 53, 65, 66, 68, 68.2, 68.3, 68.4, 92]);
const DRILL_ALIAS = new Map([[84.2, 84], [84.3, 74]]);

export function createMillState() {
  return {
    pos: { x: null, y: null, z: null },
    motion: 0, cycle: null, plane: 17, abs: true, inch: false, feedMode: 'min',
    f: null, s: null, spindle: 'off',
    wofs: 0, g52: { x: 0, y: 0, z: 0 }, g92: { x: 0, y: 0, z: 0 },
    lengthComp: false, h: null, radiusComp: 40, d: null, retLevel: 98,
    tNext: null, tool: null,
    cyc: { initZ: null, r: null, z: null, q: null, p: null, i: null, j: 0, kMin: 0 },
  };
}

export function newMillContext(settings) {
  return {
    s: settings, st: createMillState(), moves: createMoves(),
    rows: [], row: -1, events: [], markers: [],
    wofsNames: ['G54'], minCutZ: Infinity, holes: 0,
    lastComment: null, pendingLabelRow: -1, sawInch: false,
    rotary: { A: null, B: null, C: null, U: null, V: null, W: null },
    flags: { hasY: false, latheLine: null, planes: new Set(), haas: false },
    block: null,
  };
}

export function millEvent(ctx, id, params = {}, line = ctx.block ? ctx.block.line : null) {
  ctx.events.push({ line, id, params });
}

const known = p => p.x !== null && p.y !== null && p.z !== null;

// A length word in mm: the "numbers without a decimal point" setting and inch input apply (spec §4).
function len(ctx, w) {
  let v = w.value;
  if (!w.hasDecimal && ctx.s.integerUnit === 'um') v = ctx.st.inch ? v / 10000 : v / 1000;
  return ctx.st.inch ? v * 25.4 : v;
}
// Dwell P: with a decimal point in seconds, without it in milliseconds (Fanuc P1000 = 1 s).
const dwellP = w => (w.hasDecimal ? w.value : w.value / 1000);

// ---- rows: one per M6 (spec §2 time table) ----
function openRow(ctx, tool, line, change) {
  if (ctx.row >= 0) ctx.rows[ctx.row].moveEnd = ctx.moves.count;
  ctx.rows.push({ tool, label: '', firstLine: line, moveStart: ctx.moves.count, moveEnd: ctx.moves.count,
    holes: 0, cutLength: 0, cutSeconds: 0, rapidSeconds: 0, dwellSeconds: 0,
    changeSeconds: change ? ctx.s.toolChangeSeconds : 0, incomplete: false,
    afterM6: change, g43Seen: false, once: new Set() });
  ctx.row = ctx.rows.length - 1;
  return ctx.rows[ctx.row];
}
function currentRow(ctx) {
  if (ctx.row >= 0) return ctx.rows[ctx.row];
  const r = openRow(ctx, ctx.st.tNext ? `T${ctx.st.tNext}` : '', ctx.block ? ctx.block.line : null, false);
  r.label = ctx.lastComment || '';
  return r;
}
export function closeRows(ctx) {
  if (ctx.row >= 0) ctx.rows[ctx.row].moveEnd = ctx.moves.count;
}
function rowOnce(ctx, id, params) {
  const row = currentRow(ctx);
  if (row.once.has(id)) return;
  row.once.add(id);
  millEvent(ctx, id, params);
}
export function markIncomplete(ctx) { currentRow(ctx).incomplete = true; }
function mark(ctx, id, p = ctx.st.pos) {
  if (ctx.markers.length < 500 && p && known(p)) ctx.markers.push({ x: p.x, y: p.y, z: p.z, line: ctx.block.line, id });
}

// ---- recording moves ----
function record(ctx, a, b, kind, seconds) {
  const row = currentRow(ctx);
  if (ctx.moves.count < ctx.s.maxMoves) pushMove(ctx.moves, a, b, kind, ctx.block.line, ctx.row, ctx.st.wofs, seconds);
  else ctx.movesCapped = true;                            // memory: the drawing stops, the timing goes on
  const cut = kind === K_FEED || kind === K_CFEED;
  if (Number.isNaN(seconds)) row.incomplete = true;
  else if (cut) row.cutSeconds += seconds;
  else row.rapidSeconds += seconds;
  if (cut) {
    row.cutLength += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    ctx.minCutZ = Math.min(ctx.minCutZ, a.z, b.z);
  }
}

function checkZMove(ctx, from, to) {
  const row = currentRow(ctx);
  if (row.afterM6 && !row.g43Seen && from.z !== to.z && to.z !== null) rowOnce(ctx, 'no-g43');
}
function checkCut(ctx) {
  const st = ctx.st;
  if (st.spindle === 'off') rowOnce(ctx, 'spindle-off');
  if (!(st.f > 0)) { rowOnce(ctx, 'no-feed'); markIncomplete(ctx); }
}

function moveTo(ctx, to, kind) {
  const st = ctx.st, from = st.pos;
  checkZMove(ctx, from, to);
  if (known(from) && known(to) && (from.x !== to.x || from.y !== to.y || from.z !== to.z)) {
    const rapid = kind === K_RAPID || kind === K_CRAPID;
    if (!rapid) checkCut(ctx);
    // Only once something has been cut: before the first cut there is no "deepest cut" yet.
    if (kind === K_RAPID && Number.isFinite(ctx.minCutZ) && to.z < ctx.minCutZ - 1e-6) millEvent(ctx, 'rapid-into-material');
    const seconds = rapid ? rapidSeconds(to.x - from.x, to.y - from.y, to.z - from.z, ctx.s)
      : feedSeconds(Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z), feedRate(st));
    record(ctx, from, to, kind, seconds);
  }
  st.pos = { ...to };
}

function arcTo(ctx, to, ccw, W) {
  const st = ctx.st, from = st.pos, P = PLANES[st.plane];
  checkZMove(ctx, from, to);
  if (!known(from) || !known(to)) { st.pos = { ...to }; return; }
  checkCut(ctx);
  const hasCentre = W[P.ia] || W[P.ib];
  let arc;
  if (hasCentre) {
    arc = arcPath(from, to, { plane: st.plane, ccw, centre: {
      ca: from[P.a] + (W[P.ia] ? len(ctx, W[P.ia]) : 0), cb: from[P.b] + (W[P.ib] ? len(ctx, W[P.ib]) : 0) } }, ctx.s);
  } else if (W.R) {
    arc = arcPath(from, to, { plane: st.plane, ccw, r: len(ctx, W.R) }, ctx.s);
  } else {
    arc = { points: [{ ...to }], length: Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z), error: 'radius' };
  }
  if (arc.error) { millEvent(ctx, 'arc-radius'); markIncomplete(ctx); mark(ctx, 'arc-radius', from); }
  const total = feedSeconds(arc.length, feedRate(st));
  let chordSum = 0, prev = from;
  for (const p of arc.points) { chordSum += Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z); prev = p; }
  prev = from;
  for (const p of arc.points) {
    const c = Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z);
    record(ctx, prev, p, K_FEED, chordSum > 0 ? total * (c / chordSum) : 0);
    prev = p;
  }
  st.pos = { ...to };
}

// Programmed axis words → the target in work coordinates (null where still unknown).
function targetOf(ctx, W) {
  const st = ctx.st, t = { ...st.pos };
  for (const a of AXES) {
    const w = W[a.toUpperCase()];
    if (!w) continue;
    const v = len(ctx, w);
    t[a] = st.abs ? v + st.g52[a] + st.g92[a] : (st.pos[a] === null ? null : st.pos[a] + v);
  }
  return t;
}

// ---- drilling (spec §5) ----
function drill(ctx, W) {
  const st = ctx.st, c = st.cyc, code = st.cycle;
  const shiftZ = st.g52.z + st.g92.z;
  if (c.initZ === null) c.initZ = st.pos.z;
  if (W.R) c.r = st.abs ? len(ctx, W.R) + shiftZ : (c.initZ ?? 0) + len(ctx, W.R);
  if (W.Z) c.z = st.abs ? len(ctx, W.Z) + shiftZ : (c.r ?? c.initZ ?? 0) + len(ctx, W.Z);
  if (W.Q) { c.q = Math.abs(len(ctx, W.Q)); c.i = null; }
  if (W.I && PECK_CODES.has(code)) {                     // Haas: I the first peck, J less each time, K the smallest
    c.i = Math.abs(len(ctx, W.I)); c.j = W.J ? Math.abs(len(ctx, W.J)) : 0; c.kMin = W.K ? Math.abs(len(ctx, W.K)) : 0;
    c.q = null; ctx.flags.haas = true;
  }
  const haasPeck = PECK_CODES.has(code) && c.i > 0;
  if (W.P) c.p = dwellP(W.P);
  const rep = W.L ? W.L.value : W.K && !haasPeck ? W.K.value : 1;   // Haas repeats with L; its K is the smallest peck
  if (W.L) ctx.flags.haas = true;
  if (rep <= 0) return;                                   // K0 / L0: store the cycle only

  if (st.plane !== 17) {                                  // horizontal drilling is not interpreted
    millEvent(ctx, 'unsupported', { code: `G${code}` });
    markIncomplete(ctx);
    moveTo(ctx, targetOf(ctx, W), K_RAPID);
    return;
  }
  if (APPROXIMATED.has(code)) millEvent(ctx, 'approximated', { code: `G${code}` });

  let initZ = c.initZ, r = c.r;
  if (initZ === null) { millEvent(ctx, 'cycle-no-start'); markIncomplete(ctx); initZ = r; }
  if (r === null || c.z === null) {
    millEvent(ctx, 'cycle-no-r'); markIncomplete(ctx); mark(ctx, 'cycle-no-r');
    if (r === null) r = initZ ?? st.pos.z;
  }
  if (PECK_CODES.has(code) && !(c.q > 0) && !haasPeck) { millEvent(ctx, 'peck-no-q'); markIncomplete(ctx); mark(ctx, 'peck-no-q'); }
  if (initZ === null || r === null || c.z === null) return;

  const first = targetOf(ctx, W);
  const step = { x: first.x - st.pos.x, y: first.y - st.pos.y };
  for (let k = 0; k < rep; k++) {
    const x = k === 0 || st.abs ? first.x : st.pos.x + step.x;
    const y = k === 0 || st.abs ? first.y : st.pos.y + step.y;
    if (x === null || y === null) return;
    const from = { ...st.pos };
    if (from.z === null) from.z = initZ;
    st.pos = from;
    const moves = holeMoves(code, { from, x, y, initZ, r, z: c.z, q: haasPeck ? c.i : c.q, p: c.p, retLevel: st.retLevel,
      clearance: ctx.s.peckClearance, qStep: haasPeck ? c.j : 0, qMin: haasPeck ? c.kMin : 0 });
    for (const m of moves) {
      if (m.kind === 'dwell') { currentRow(ctx).dwellSeconds += m.seconds; continue; }
      moveTo(ctx, m.to, m.kind === 'cfeed' ? K_CFEED : K_CRAPID);
    }
    currentRow(ctx).holes++;
    ctx.holes++;
  }
}

// ---- one block ----
// Returns a flow instruction for the runner: null, { end: true }, { ret: true },
// { call: 'M98', o, repeat, whole } or { call: 'M97', n, repeat }.
export function execBlock(ctx, b) {
  ctx.block = b;
  const st = ctx.st;
  const isO = b.o !== null || b.raw.trim() === '%';
  if (isO) ctx.lastComment = null;
  if (b.skipped === 'macro' || b.skipped === 'expression') { millEvent(ctx, 'skipped'); return null; }

  const G = [], M = [], W = {};
  for (const w of b.words) {
    if (w.letter === 'G') G.push(w.value);
    else if (w.letter === 'M') M.push(w.value);
    else if (!(w.letter in W)) W[w.letter] = w;
  }
  const hasM6 = M.includes(6);
  if (b.comment && !isO && !hasM6) {
    if (ctx.pendingLabelRow >= 0) { ctx.rows[ctx.pendingLabelRow].label = b.comment; ctx.pendingLabelRow = -1; }
    else ctx.lastComment = b.comment;
  }
  if (!b.words.length) return null;
  if (W.Y) ctx.flags.hasY = true;

  // Order inside a block: the T word, then the tool change, then the G codes (so a G43 in the same
  // block as M6 belongs to the new tool's row), then the other words and M codes.
  if (W.T) st.tNext = W.T.raw;
  if (hasM6) {
    if (st.radiusComp !== 40) millEvent(ctx, 'comp-left-on');
    const row = openRow(ctx, st.tNext ? `T${st.tNext}` : '', b.line, true);
    ctx.pendingLabelRow = -1;
    if (b.comment) row.label = b.comment;
    else if (ctx.lastComment) row.label = ctx.lastComment;
    else ctx.pendingLabelRow = ctx.row;
    ctx.lastComment = null;
    st.tool = st.tNext === null ? null : Number(st.tNext);
    st.spindle = 'off';
  }

  let nonMotion = null, dwell = false;
  for (const g0 of G) {
    const g = DRILL_ALIAS.get(g0) ?? g0;
    if (g === 0 || g === 1 || g === 2 || g === 3) { st.motion = g; st.cycle = null; }
    else if (g === 17 || g === 18 || g === 19) { st.plane = g; ctx.flags.planes.add(g); }
    else if (g === 20) { st.inch = true; ctx.sawInch = true; }
    else if (g === 21) st.inch = false;
    else if (g === 90) st.abs = true;
    else if (g === 91) st.abs = false;
    else if (g === 94) st.feedMode = 'min';
    else if (g === 95) st.feedMode = 'rev';
    else if (g === 98 || g === 99) st.retLevel = g;
    else if (g === 40) st.radiusComp = 40;
    else if (g === 41 || g === 42) {
      st.radiusComp = g;
      if (W.D) st.d = W.D.value;
      else if (st.d === null) millEvent(ctx, 'comp-no-d');
    }
    else if (g === 43 || g === 44) {
      st.lengthComp = true;
      currentRow(ctx).g43Seen = true;
      if (W.H) st.h = W.H.value;
      if (st.h !== null && st.tool !== null && st.h !== st.tool) millEvent(ctx, 'h-mismatch', { h: st.h, t: st.tool });
    }
    else if (g === 49) st.lengthComp = false;
    else if (g === 80) st.cycle = null;
    else if (DRILL_CODES.has(g)) {
      if (st.cycle === null) st.cyc = { initZ: st.pos.z, r: null, z: null, q: null, p: null, i: null, j: 0, kMin: 0 };
      st.cycle = g;
    }
    else if ((g >= 54 && g <= 59 && Number.isInteger(g)) || g === 54.1 || g === 154 || (g >= 110 && g <= 129)) {
      if (g === 154 || g >= 110) ctx.flags.haas = true;
      const name = g === 54.1 || g === 154 ? `G${g} P${W.P ? W.P.value : ''}` : `G${g}`;
      let i = ctx.wofsNames.indexOf(name);
      if (i < 0) { ctx.wofsNames.push(name); i = ctx.wofsNames.length - 1; }
      if (i !== st.wofs) { st.wofs = i; st.pos = { x: null, y: null, z: null }; }   // new frame: position unknown
    }
    else if (g === 4) dwell = true;
    if (NON_MOTION_G.has(g)) nonMotion = g;
    if (g === 96 || (g === 50 && W.S) || ((g === 70 || g === 71 || g === 72) && W.P && W.Q)) {
      if (ctx.flags.latheLine === null) ctx.flags.latheLine = b.line;
    }
    if (HAAS_G.has(g) || (g >= 110 && g <= 129)) ctx.flags.haas = true;
    if (UNSUPPORTED_G.has(g)) { millEvent(ctx, 'unsupported', { code: `G${g}` }); markIncomplete(ctx); }
  }

  if (W.F) st.f = st.inch ? W.F.value * 25.4 : W.F.value;
  if (W.S) st.s = W.S.value;
  if (W.H && !G.some(g => g === 43 || g === 44)) st.h = W.H.value;
  if (W.D && !G.some(g => g === 41 || g === 42)) st.d = W.D.value;
  // Rotary and extra axes: the first value only sets the reference (a 3-axis safe-start line with
  // A0. must not flag anything); a later, different value is a move the viewer can't draw.
  for (const L of ['A', 'B', 'C', 'U', 'V', 'W']) {
    if (!W[L]) continue;
    const prev = ctx.rotary[L];
    ctx.rotary[L] = W[L].value;
    if (prev !== null && prev !== W[L].value) { millEvent(ctx, 'unsupported', { code: L }); markIncomplete(ctx); }
  }

  let flow = null;
  for (const m of M) {
    if (m === 3) st.spindle = 'cw';
    else if (m === 4) st.spindle = 'ccw';
    else if (m === 5) st.spindle = 'off';
    else if (m === 30 || m === 2) {
      if (st.radiusComp !== 40) millEvent(ctx, 'comp-left-on');
      flow = { end: true };
    }
    else if (m === 98) {
      const p = W.P ? W.P.raw.replace(/^[+-]/, '').split('.')[0] : '';
      let o = Number(p), repeat = W.L ? W.L.value : W.K ? W.K.value : 1, whole;
      if (!W.L && !W.K && p.length > 4) { whole = o; o = Number(p.slice(-4)); repeat = Number(p.slice(0, -4)) || 1; }
      if (W.L) ctx.flags.haas = true;
      flow = { call: 'M98', o, repeat, whole };              // whole: a Haas five-digit O number, if the file has it
    }
    else if (m === 97) { ctx.flags.haas = true; flow = { call: 'M97', n: W.P ? W.P.value : null, repeat: W.L ? W.L.value : 1 }; }
    else if (m === 99) flow = { ret: true };
  }

  // Non-motion G codes: their axis words are data.
  if (dwell) {
    const sec = W.P ? dwellP(W.P) : W.X ? W.X.value : 0;
    currentRow(ctx).dwellSeconds += sec;
  } else if (nonMotion === 52) {
    for (const a of AXES) { const w = W[a.toUpperCase()]; if (w) st.g52[a] = len(ctx, w); }
  } else if (nonMotion === 92) {
    for (const a of AXES) {
      const w = W[a.toUpperCase()];
      if (!w) continue;
      const v = len(ctx, w);
      if (st.pos[a] === null) { st.g92[a] = 0; st.pos[a] = v + st.g52[a]; }
      else st.g92[a] = st.pos[a] - st.g52[a] - v;
    }
  } else if (nonMotion === 28 || nonMotion === 30 || nonMotion === 53) {
    for (const a of AXES) if (W[a.toUpperCase()]) st.pos[a] = null;   // gone to a reference point
  } else if (nonMotion === null) {
    const axisWords = W.X || W.Y || W.Z;
    if (st.cycle !== null) {
      if (axisWords || W.R) drill(ctx, W);
    } else if (axisWords) {
      const to = targetOf(ctx, W);
      if (st.motion === 0) moveTo(ctx, to, K_RAPID);
      else if (st.motion === 1) moveTo(ctx, to, K_FEED);
      else arcTo(ctx, to, st.motion === 3, W);
    } else if ((st.motion === 2 || st.motion === 3) && (W.I || W.J || W.K)) {
      arcTo(ctx, { ...st.pos }, st.motion === 3, W);           // a full circle: centre only, no end change
    }
  }
  return flow;
}
