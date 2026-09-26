// Canned-cycle dispatch. Each block's form (first line, second line, one-line) is read from its own
// words. Fanuc stores first-line values as parameters, so they persist for the rest of the program:
// they are kept per cycle code, and a first line that omits a word keeps the stored value.
// One-line forms (older Fanuc, Haas) carry everything in one block. cycle-form is raised only when a
// value the block's form needs was never given.
import { pushSegment, feedMove, pushEvent, cycleFailed, word, hasAny, lengthOf, feedOf, microOf, targetOf } from '../machine.js';
import { readProfile } from '../profile.js';
import { roughMoves } from './rough.js';
import { g73Moves } from './g73.js';
import { peckMoves } from './peck.js';
import { g76Depths, g76Moves } from './g76.js';

export const HANDLERS = {};

export function runCycle(ctx, code, block) {
  const h = HANDLERS[code];
  if (!h) { cycleFailed(ctx, 'cycle-unsupported', { code }); return; }
  const form = h.form(block);
  if (form === 'first') { ctx.firstLines[code] = { ...ctx.firstLines[code], ...given(h.readFirst(ctx, block)) }; return; }
  h.run(ctx, block, form, ctx.firstLines[code] || {});
}

// Only the values the block actually carries, so an omitted word keeps its stored value.
const given = values => Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null && v !== undefined));

// Pushes planner moves into the main context. Each move carries its own `from`, so chains stay exact.
export function emit(ctx, moves, cycleBase, f) {
  for (const m of moves) {
    ctx.state.pos = { ...m.from };
    const cycle = { ...cycleBase, passIndex: m.passIndex ?? 0 };
    if (m.kind === 'rapid') pushSegment(ctx, 'rapid', m.to, { cycle });
    else feedMove(ctx, m.kind, m.to, { f, cycle, arc: m.arc || undefined });
  }
}

// Profile type from the P block (Fanuc): G71/G73 with X only = Type I, X and Z = Type II,
// Z only = bad P block (alarm 065). G72 swaps the axes.
export function profileType(code, pBlock) {
  const x = hasAny(pBlock, ['X', 'U']), z = hasAny(pBlock, ['Z', 'W']);
  const [main, other] = code === 72 ? [z, x] : [x, z];
  if (main && other) return 'II';
  if (main) return 'I';
  return 'bad';
}

// When the profile directly follows the cycle, the control does not execute it as normal moves:
// it continues after the Q block.
export function skipProfile(ctx, prof) {
  if (prof.pIndex > ctx.index) ctx.index = prof.qIndex;
}

// G71: U(Δd) R(e) first line · P Q U W F second line · P Q U W D F one-line. G72: W(Δd) instead of U.
function roughHandler(code) {
  const depthLetter = code === 71 ? 'U' : 'W';
  return {
    form: b => (!hasAny(b, ['P', 'Q']) ? 'first' : word(b, 'D') ? 'one' : 'second'),
    readFirst: (ctx, b) => ({ depth: lengthOf(word(b, depthLetter), ctx), retract: lengthOf(word(b, 'R'), ctx) }),
    run(ctx, block, form, stored) {
      const A = { ...ctx.state.pos };
      const P = word(block, 'P'), Q = word(block, 'Q');
      if (!P || !Q) { cycleFailed(ctx, 'cycle-form', { code }); return; }
      const one = form === 'one';
      const depth = (one ? lengthOf(word(block, 'D'), ctx) : stored.depth) ?? null;   // G71 U depth is a radius
      const retract = (one ? null : stored.retract) ?? ctx.settings.oneLineRetract;
      const U = word(block, 'U'), W = word(block, 'W');
      const allowX = U ? lengthOf(U, ctx) * (ctx.settings.xDiameter ? 0.5 : 1) : 0;   // diameter → radius
      const allowZ = W ? lengthOf(W, ctx) : 0;
      const f = word(block, 'F') ? feedOf(word(block, 'F'), ctx) : ctx.state.f;
      const prof = readProfile(ctx, P.value, Q.value);
      if (!prof) { cycleFailed(ctx, 'pq-not-found', { code, p: P.value, q: Q.value }); return; }
      const record = {
        code, line: block.line, start: A, type: profileType(code, prof.pBlock),
        pBlock: prof.pBlock, qBlock: prof.qBlock, body: prof.body, depth, allowX, allowZ,
        tnrcAtCall: ctx.state.tnrc, tnrcAtQ: prof.endState.tnrc, frame: null, allowD: null, allowC: null,
      };
      if (depth === null) cycleFailed(ctx, 'cycle-form', { code });
      else if (A.x === null || A.z === null) cycleFailed(ctx, 'cycle-no-start', { code });
      else {
        const r = roughMoves(code, { start: A, body: prof.body, depth, retract, allowX, allowZ }, ctx.settings.arcSegments);
        Object.assign(record, { frame: r.frame, allowD: r.allowD, allowC: r.allowC });
        emit(ctx, r.moves, { code, line: block.line }, f);
        ctx.state.pos = { ...A };
      }
      ctx.cycles.push(record);
      skipProfile(ctx, prof);
    },
  };
}

HANDLERS[71] = roughHandler(71);
HANDLERS[72] = roughHandler(72);

// G70 finishing: the control re-executes P…Q at the feed/speed inside the profile blocks, then
// rapids straight back to the start point saved before G70 (our internal cycle-visual-gcode-fidelity.md).
HANDLERS[70] = {
  form: () => 'second',
  run(ctx, block) {
    const A = { ...ctx.state.pos };
    const P = word(block, 'P'), Q = word(block, 'Q');
    if (!P || !Q) { cycleFailed(ctx, 'cycle-form', { code: 70 }); return; }
    const prof = readProfile(ctx, P.value, Q.value);
    if (!prof) { cycleFailed(ctx, 'pq-not-found', { code: 70, p: P.value, q: Q.value }); return; }
    if (A.x === null || A.z === null) { cycleFailed(ctx, 'cycle-no-start', { code: 70 }); return; }
    const cycle = { code: 70, line: block.line, passIndex: 0 };
    for (const s of [...prof.first, ...prof.body]) ctx.segments.push({ ...s, cycle });
    for (const e of prof.events) ctx.events.push(e);
    const last = prof.body.length ? prof.body[prof.body.length - 1].to : prof.pEnd;
    ctx.state.pos = { ...last };
    pushSegment(ctx, 'rapid', A, { cycle });
    ctx.cycles.push({ code: 70, line: block.line, start: A, pBlock: prof.pBlock, qBlock: prof.qBlock, body: prof.body });
    skipProfile(ctx, prof);
  },
};

// G73 pattern repeat. Two-line: G73 U(Δi) W(Δk) R(d) / G73 P Q U W F.
// One-line: G73 P Q I K U W D F. The pass count (R or D) is needed: without it the drawing is a guess.
HANDLERS[73] = {
  form: b => (!hasAny(b, ['P', 'Q']) ? 'first' : hasAny(b, ['I', 'K', 'D']) ? 'one' : 'second'),
  readFirst: (ctx, b) => ({
    reliefX: lengthOf(word(b, 'U'), ctx), reliefZ: lengthOf(word(b, 'W'), ctx),
    divisions: word(b, 'R') ? word(b, 'R').value : null,                  // a count: never unit-scaled
  }),
  run(ctx, block, form, stored) {
    const A = { ...ctx.state.pos };
    const P = word(block, 'P'), Q = word(block, 'Q');
    if (!P || !Q) { cycleFailed(ctx, 'cycle-form', { code: 73 }); return; }
    const one = form === 'one', D = word(block, 'D');
    const reliefX = (one ? lengthOf(word(block, 'I'), ctx) : stored.reliefX) ?? 0;
    const reliefZ = (one ? lengthOf(word(block, 'K'), ctx) : stored.reliefZ) ?? 0;
    const divisions = (one ? (D ? D.value : null) : stored.divisions) ?? null;
    const U = word(block, 'U'), W = word(block, 'W');
    const allowX = U ? lengthOf(U, ctx) * (ctx.settings.xDiameter ? 0.5 : 1) : 0;
    const allowZ = W ? lengthOf(W, ctx) : 0;
    const f = word(block, 'F') ? feedOf(word(block, 'F'), ctx) : ctx.state.f;
    const prof = readProfile(ctx, P.value, Q.value);
    if (!prof) { cycleFailed(ctx, 'pq-not-found', { code: 73, p: P.value, q: Q.value }); return; }
    if (divisions === null) cycleFailed(ctx, 'cycle-form', { code: 73 });
    else if (A.x === null || A.z === null) cycleFailed(ctx, 'cycle-no-start', { code: 73 });
    else {
      const moves = g73Moves({ start: A, pEnd: prof.pEnd, body: prof.body, reliefX, reliefZ, divisions, allowX, allowZ });
      emit(ctx, moves, { code: 73, line: block.line }, f);
      ctx.state.pos = { ...A };
    }
    ctx.cycles.push({ code: 73, line: block.line, start: A, type: profileType(73, prof.pBlock),
      pBlock: prof.pBlock, qBlock: prof.qBlock, body: prof.body, allowX, allowZ,
      tnrcAtCall: ctx.state.tnrc, tnrcAtQ: prof.endState.tnrc });
    skipProfile(ctx, prof);
  },
};

// G74/G75: R(e) first line · X/U Z/W P Q R F second line · X Z I K D F one-line. With no stored R
// (never given, or the one-line form) the retract comes from settings, as a machine parameter would.
function peckHandler(code) {
  const axis = code === 74 ? 'z' : 'x';
  return {
    form: b => (hasAny(b, ['I', 'K', 'D']) ? 'one' : hasAny(b, ['X', 'Z', 'U', 'W']) ? 'second' : 'first'),
    readFirst: (ctx, b) => ({ retract: lengthOf(word(b, 'R'), ctx) }),
    run(ctx, block, form, stored) {
      const A = { ...ctx.state.pos };
      if (A.x === null || A.z === null) { cycleFailed(ctx, 'cycle-no-start', { code }); return; }
      const P = word(block, 'P'), Q = word(block, 'Q');
      if ((P && P.hasDecimal) || (Q && Q.hasDecimal)) pushEvent(ctx, 'pq-decimal', { code });
      const end = targetOf(block, ctx, A);
      let peck, step, retract;
      if (form === 'second') {
        retract = stored.retract ?? ctx.settings.oneLineRetract;
        const pv = microOf(P, ctx) ?? 0, qv = microOf(Q, ctx) ?? 0;
        [peck, step] = code === 74 ? [qv, pv] : [pv, qv];
      } else {                                   // one-line form: I and K in mm (verify in the note)
        const iv = lengthOf(word(block, 'I'), ctx) ?? 0, kv = lengthOf(word(block, 'K'), ctx) ?? 0;
        [peck, step] = code === 74 ? [kv, iv] : [iv, kv];
        retract = ctx.settings.oneLineRetract;
      }
      const f = word(block, 'F') ? feedOf(word(block, 'F'), ctx) : ctx.state.f;
      const moves = peckMoves(axis, { start: A, end: { x: end.x, z: end.z }, peck, step, retract });
      emit(ctx, moves, { code, line: block.line }, f);
      ctx.state.pos = { ...A };
      ctx.cycles.push({ code, line: block.line, start: A });
    },
  };
}

HANDLERS[74] = peckHandler(74);
HANDLERS[75] = peckHandler(75);

// G76 threading. Two-line Fanuc: G76 P(mra) Q(Δdmin) R(d) / G76 X Z R(i) P(k) Q(Δd) F(L).
// One-line Haas (verify in the note): G76 X Z K D A F [I]. The second line needs its own P and Q;
// first-line values never given fall back to one finishing pass, no chamfer, no minimum, no allowance.
HANDLERS[76] = {
  form: b => (hasAny(b, ['K', 'D']) ? 'one' : hasAny(b, ['X', 'Z', 'U', 'W']) ? 'second' : 'first'),
  readFirst(ctx, b) {
    const P = word(b, 'P'), Q = word(b, 'Q');
    if (Q && Q.hasDecimal) pushEvent(ctx, 'pq-decimal', { code: 76 });
    const v = P ? Math.round(P.value) : null;
    return {                                     // the angle digits (v % 100) only set the flank infeed: not drawn
      finishPasses: v === null ? null : Math.floor(v / 10000), chamfer: v === null ? null : Math.floor(v / 100) % 100,
      minDepth: microOf(Q, ctx), finishAllow: lengthOf(word(b, 'R'), ctx),
    };
  },
  run(ctx, block, form, stored) {
    const A = { ...ctx.state.pos };
    if (A.x === null || A.z === null) { cycleFailed(ctx, 'cycle-no-start', { code: 76 }); return; }
    const end = targetOf(block, ctx, A);
    const lead = word(block, 'F') ? feedOf(word(block, 'F'), ctx) : ctx.state.f;
    const taperWord = word(block, 'R') || word(block, 'I');
    const taper = taperWord ? lengthOf(taperWord, ctx) : 0;
    let height, firstDepth, minDepth = 0, finishAllow = 0, finishPasses = 1, chamferLen = 0;
    if (form === 'second') {
      const P = word(block, 'P'), Q = word(block, 'Q');
      if ((P && P.hasDecimal) || (Q && Q.hasDecimal)) pushEvent(ctx, 'pq-decimal', { code: 76 });
      height = microOf(P, ctx); firstDepth = microOf(Q, ctx);
      minDepth = stored.minDepth ?? 0; finishAllow = stored.finishAllow ?? 0;
      finishPasses = stored.finishPasses ?? 1;
      chamferLen = (stored.chamfer ?? 0) * 0.1 * (lead || 0);
    } else {
      height = lengthOf(word(block, 'K'), ctx); firstDepth = lengthOf(word(block, 'D'), ctx);
    }
    if (!(height > 0) || !(firstDepth > 0)) { cycleFailed(ctx, 'cycle-form', { code: 76 }); return; }
    const depths = g76Depths({ height, firstDepth, minDepth, finishAllow, finishPasses });
    const moves = g76Moves({ start: A, end: { x: end.x, z: end.z }, depths, height, chamferLen, taper });
    emit(ctx, moves, { code: 76, line: block.line }, lead);
    ctx.state.pos = { ...A };
    ctx.cycles.push({ code: 76, line: block.line, start: A });
  },
};
