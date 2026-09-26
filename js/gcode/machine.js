// Modal state machine for one block of lathe G-code (system A after dialect mapping). Pure: no DOM.
// Spec §4. Positions are radius/mm; null = unknown (e.g. after a G28 reference return).
import { mapGCode } from './dialects.js';
import { arcFromR, arcFromIK } from './geom.js';
import { boxMoves } from './cycles/single.js';

export const CYCLE_CODES = new Set([70, 71, 72, 73, 74, 75, 76]);
const INCH = 25.4;
const BOX = new Set([90, 92, 94]);

// Known codes the viewer does not expand (spec §5.2): drilling G81–G89 (modal until G80 or G0–G3),
// variable-lead threading G34, polar G12.1/G112 and cylindrical G7.1/G107 interpolation. The block
// is drawn as written and flagged, and its tool's time is incomplete. G80 itself only cancels.
const DRILL = new Set([81, 82, 83, 84, 85, 86, 87, 88, 89]);
const UNSUPPORTED = new Set([34, 107, 112]);
const UNSUPPORTED_DECIMAL = new Set([12.1, 7.1]);

// Events for a cycle the viewer could not draw: time.js marks the tool's row incomplete ("–") and
// render.js places an error marker. Every one of them is pushed through cycleFailed().
export const CYCLE_FAILURES = new Set(['cycle-unsupported', 'pq-not-found', 'cycle-form', 'cycle-no-start']);

export function createState() {
  return {
    pos: { x: null, z: null }, motion: 0, incremental: false,
    feedMode: 'rev', f: null, spindleMode: 'rpm', s: null, sMax: null,
    tool: null, tnrc: 40, units: 'mm', ended: false, box: null, drill: null, offsetCancelLine: null,
  };
}

// Fanuc 2+2 T code: T<tt>00 on the tool already in place cancels its wear offset; the turret does
// not index. The glued T<n>W<nnn> form is left alone.
function isOffsetCancel(T, current) {
  const m = /^(\d{2})00$/.exec(T.raw), c = current && /^T(\d{1,2})\d{2}$/.exec(current);
  return !T.toolKey && !!m && !!c && Number(m[1]) === Number(c[1]);
}

// The reverse of isOffsetCancel (R14): a plain T<tt><oo> word with oo != 00, whose tt matches the
// CURRENT tool's number, is applying/confirming that tool's normal offset, not a new tool. This
// also catches a brand-new tool whose first call used oo=00 (T0100) and only got a real offset on
// a later line (T0101): that first call already committed a row under the placeholder key, so the
// caller renames it in place to this, the first non-00 form.
function sameToolApply(T, current) {
  const m = /^(\d{2})(\d{2})$/.exec(T.raw), c = current && /^T(\d{1,2})\d{2}$/.exec(current);
  return !T.toolKey && !!m && m[2] !== '00' && !!c && Number(m[1]) === Number(c[1]);
}

export function cloneState(st) {
  return { ...st, pos: { ...st.pos }, box: st.box ? { ...st.box } : null };
}

export function newContext(blocks, settings) {
  return { blocks, settings, state: createState(), segments: [], events: [], cycles: [],
    toolChanges: [], firstLines: {}, index: 0, block: null, profileMode: false };
}

export const word = (block, letter) => block.words.find(w => w.letter === letter) || null;
export const hasAny = (block, letters) => block.words.some(w => letters.includes(w.letter));

// A length word in mm: honours "no decimal point = µm" and inch mode. Never halved for diameter.
export function lengthOf(w, ctx) {
  if (!w) return null;
  let v = w.value;
  if (!w.hasDecimal && ctx.settings.integerUnit === 'um') v /= 1000;
  if (ctx.state.units === 'inch') v *= INCH;
  return v;
}

// G74/G75/G76 P and Q: integers in µm (0.0001 in when inch). A decimal point is a mistake that
// checks.js reports (pq-decimal); the value is then read as mm (or inch).
export function microOf(w, ctx) {
  if (!w) return null;
  if (w.hasDecimal) return ctx.state.units === 'inch' ? w.value * INCH : w.value;
  return ctx.state.units === 'inch' ? (w.value / 10000) * INCH : w.value / 1000;
}

export function feedOf(w, ctx) {
  return w ? w.value * (ctx.state.units === 'inch' ? INCH : 1) : null;
}

// The block's target in radius/mm. Axes missing from the block keep the base value (maybe unknown).
export function targetOf(block, ctx, base = ctx.state.pos) {
  const st = ctx.state, xf = ctx.settings.xDiameter ? 0.5 : 1;
  let x = base.x, z = base.z, has = false;
  const X = word(block, 'X'), U = word(block, 'U'), Z = word(block, 'Z'), W = word(block, 'W');
  if (X) { const v = lengthOf(X, ctx) * xf; x = st.incremental ? (x === null ? null : x + v) : v; has = true; }
  if (U) { const v = lengthOf(U, ctx) * xf; x = x === null ? null : x + v; has = true; }
  if (Z) { const v = lengthOf(Z, ctx); z = st.incremental ? (z === null ? null : z + v) : v; has = true; }
  if (W) { const v = lengthOf(W, ctx); z = z === null ? null : z + v; has = true; }
  return { x, z, has };
}

export function pushEvent(ctx, type, extra = {}) {
  ctx.events.push({ type, line: ctx.block ? ctx.block.line : null, ...extra });
}

// One of CYCLE_FAILURES, with the owning tool and the tool position now (the block's end point, or
// the cycle start when nothing moved); `at` is null while that position is unknown.
export function cycleFailed(ctx, type, extra = {}) {
  const p = ctx.state.pos;
  const at = p.x !== null && p.z !== null ? { x: p.x, z: p.z } : null;
  pushEvent(ctx, type, { ...extra, tool: ctx.state.tool, at });
}

// Appends one segment when both ends are known, then moves the tool there either way.
export function pushSegment(ctx, kind, to, extra = {}) {
  const st = ctx.state, from = st.pos;
  const known = from.x !== null && from.z !== null && to.x !== null && to.z !== null;
  const moved = known && (Math.abs(from.x - to.x) > 1e-9 || Math.abs(from.z - to.z) > 1e-9);
  if (moved || (known && extra.arc)) {
    ctx.segments.push({
      kind, from: { x: from.x, z: from.z }, to: { x: to.x, z: to.z }, arc: extra.arc || null,
      line: ctx.block ? ctx.block.line : null, tool: st.tool, cycle: extra.cycle || null,
      feed: { mode: st.feedMode, f: extra.f !== undefined ? extra.f : st.f },
      spindle: { mode: st.spindleMode, s: st.s, max: st.sMax }, seconds: null,
    });
  }
  st.pos = { x: to.x, z: to.z };
}

// A cutting move (feed, arc, pass, retract, thread). Records the facts checks.js needs.
export function feedMove(ctx, kind, to, extra = {}) {
  const st = ctx.state;
  const f = extra.f !== undefined ? extra.f : st.f;
  if (st.offsetCancelLine !== null) {                  // cutting with the offset cancelled: flag the T line once
    pushEvent(ctx, 'tool-zero', { tool: st.tool, line: st.offsetCancelLine });
    st.offsetCancelLine = null;
  }
  if (f === null || f === undefined) pushEvent(ctx, 'no-feed');
  if (st.feedMode === 'rev' && st.s === null) pushEvent(ctx, 'no-speed');
  if (st.spindleMode === 'css' && st.sMax === null) pushEvent(ctx, 'css-no-limit');
  if (kind === 'thread' && st.spindleMode === 'css') pushEvent(ctx, 'css-thread');
  pushSegment(ctx, kind, to, { ...extra, f });
}

// Executes one non-skipped block. Returns { cycle } where cycle is a G70–G76 code for the caller
// to dispatch (cycles/index.js), or null. In profileMode (replaying P…Q) tool calls, program ends
// and nested cycles are ignored.
export function executeBlock(ctx, block) {
  const st = ctx.state;
  ctx.block = block;
  let cycle = null, g50 = false, g28 = false, dwell = false, motionSet = null;
  let unsupported = null, drill = null, drillOff = false;

  for (const w of block.words) {
    if (w.letter !== 'G') continue;
    if (UNSUPPORTED_DECIMAL.has(w.value)) { unsupported = w.value; continue; }
    const g = mapGCode(Math.trunc(w.value), ctx.settings.system);
    switch (g) {
      case 0: case 1: case 2: case 3: case 32: case 90: case 92: case 94: motionSet = g; break;
      case 4: dwell = true; break;
      case 20: st.units = 'inch'; break;
      case 21: st.units = 'mm'; break;
      case 28: g28 = true; break;
      case 40: case 41: case 42: st.tnrc = g; break;
      case 50: g50 = true; break;
      case 96: st.spindleMode = 'css'; break;
      case 97: st.spindleMode = 'rpm'; break;
      case 98: st.feedMode = 'min'; break;
      case 99: st.feedMode = 'rev'; break;
      case 17: case 19: pushEvent(ctx, 'milling', { code: g }); break;
      case 80: drillOff = true; break;
      case 'ABS': st.incremental = false; break;
      case 'INC': st.incremental = true; break;
      default:
        if (CYCLE_CODES.has(g)) cycle = g;
        else if (DRILL.has(g)) unsupported = drill = w.value;
        else if (UNSUPPORTED.has(g)) unsupported = w.value;
    }
  }
  if (drill !== null) st.drill = drill;
  else if (drillOff || motionSet !== null) st.drill = null;

  const S = word(block, 'S'), F = word(block, 'F'), T = word(block, 'T');
  if (S) {
    if (g50) st.sMax = S.value;
    else if (st.spindleMode === 'css') st.s = st.units === 'inch' ? S.value * 0.3048 : S.value; // SFM → m/min
    else st.s = S.value;
  }
  if (F && cycle === null) st.f = feedOf(F, ctx);
  if (word(block, 'Y')) pushEvent(ctx, 'milling', { word: 'Y' });

  if (!ctx.profileMode) {
    if (T && isOffsetCancel(T, st.tool)) st.offsetCancelLine = block.line;
    else if (T && sameToolApply(T, st.tool)) {
      // Same physical tool, offset now applied (R14): rename in place rather than opening a new
      // row. ctx.segments/ctx.toolChanges are plain arrays owned by this context, so the rename
      // reaches everything already tagged with the placeholder key.
      const key = `T${T.raw}`;
      if (key !== st.tool) {
        const oldKey = st.tool;
        // Fix C2: a brand-new T<tt>00 fires an immediate tool-zero on selection (see the plain else
        // branch below). That's fine while it sits on its own, cut-less placeholder row - but once
        // renamed onto the merged row, it would wrongly warn about the real cut that happens AFTER
        // the offset is applied, unless something actually cut while the offset was still zero.
        const cutAtZero = ctx.segments.some(s => s.tool === oldKey && s.kind !== 'rapid' && s.kind !== 'dwell');
        st.tool = key;
        for (const s of ctx.segments) if (s.tool === oldKey) s.tool = key;
        for (const c of ctx.toolChanges) if (c.tool === oldKey) c.tool = key;
        if (cutAtZero) {
          for (const e of ctx.events) if (e.tool === oldKey) e.tool = key;
        } else {
          ctx.events = ctx.events.filter(e => !(e.type === 'tool-zero' && e.tool === oldKey));
          for (const e of ctx.events) if (e.tool === oldKey) e.tool = key;
        }
      }
      st.offsetCancelLine = null;
    }
    else if (T) {
      const key = T.toolKey || `T${T.raw}`;
      st.offsetCancelLine = null;
      if (key !== st.tool) { st.tool = key; ctx.toolChanges.push({ line: block.line, index: ctx.index, tool: key }); }
      if (T.value === 0 || /^0+$/.test(T.raw.slice(-2))) pushEvent(ctx, 'tool-zero', { tool: key });
    }
    for (const m of block.words) {
      if (m.letter !== 'M') continue;
      if (m.value === 30 || m.value === 2 || m.value === 99) st.ended = true;
      if (m.value === 98) pushEvent(ctx, 'm98');
    }
  }

  if (cycle !== null) {
    if (unsupported !== null) cycleFailed(ctx, 'cycle-unsupported', { code: unsupported });
    return { cycle: ctx.profileMode ? null : cycle };
  }
  // Under G81–G89 every block with a position is another hole.
  const plain = !g28 && !g50 && !dwell;
  if (unsupported === null && plain && drill === null && st.drill !== null && hasAny(block, ['X', 'U', 'Z', 'W'])) {
    unsupported = st.drill;
  }
  moveBlock(ctx, block, { g28, g50, dwell, motionSet });
  if (unsupported !== null) cycleFailed(ctx, 'cycle-unsupported', { code: unsupported });
  return { cycle: null };
}

// The motion part of a block that is not a G70–G76 call.
function moveBlock(ctx, block, { g28, g50, dwell, motionSet }) {
  const st = ctx.state;
  if (g28) {
    if (word(block, 'U') || word(block, 'X')) st.pos = { ...st.pos, x: null };
    if (word(block, 'W') || word(block, 'Z')) st.pos = { ...st.pos, z: null };
    return;
  }
  if (g50) {
    const t = targetOf(block, ctx);
    if (t.has) st.pos = { x: t.x, z: t.z };            // coordinate setting, not a move
    return;
  }
  if (dwell) {
    const P = word(block, 'P'), X = word(block, 'X') || word(block, 'U');
    ctx.segments.push({
      kind: 'dwell', from: { ...st.pos }, to: { ...st.pos }, arc: null, line: block.line, tool: st.tool,
      cycle: null, feed: { mode: st.feedMode, f: st.f }, spindle: { mode: st.spindleMode, s: st.s, max: st.sMax },
      seconds: null, dwell: P ? P.value / 1000 : X ? X.value : 0,
    });
    return;
  }

  if (motionSet !== null) {
    if (!BOX.has(motionSet)) st.box = null;
    st.motion = motionSet;
  }
  if (BOX.has(st.motion)) { boxCycle(ctx, block); return; }

  const t = targetOf(block, ctx);
  if (!t.has) return;
  switch (st.motion) {
    case 1: feedMove(ctx, 'feed', t); break;
    case 2: case 3: arcMove(ctx, block, t, st.motion === 3); break;
    case 32: feedMove(ctx, 'thread', t); break;
    default: pushSegment(ctx, 'rapid', t);
  }
}

function arcMove(ctx, block, to, ccw) {
  const st = ctx.state;
  const R = word(block, 'R'), I = word(block, 'I'), K = word(block, 'K');
  let arc = null;
  if (st.pos.x !== null && st.pos.z !== null && to.x !== null && to.z !== null) {
    if (R) arc = arcFromR(st.pos, to, lengthOf(R, ctx), ccw);
    else if (I || K) arc = arcFromIK(st.pos, I ? lengthOf(I, ctx) : 0, K ? lengthOf(K, ctx) : 0, ccw);
  }
  if (!arc) { feedMove(ctx, 'feed', to); return; }       // degenerate or unknown start: straight line
  feedMove(ctx, 'arc', to, { arc });
}

// G90 / G92 / G94 box cycles. Modal: a following block with only X (or only Z) repeats the cycle
// and keeps the other end coordinate of the previous box. Always ends back at the start point A.
function boxCycle(ctx, block) {
  const st = ctx.state;
  const t = targetOf(block, ctx);
  if (!t.has) return;
  const hasX = hasAny(block, ['X', 'U']), hasZ = hasAny(block, ['Z', 'W']);
  const prev = st.box;
  const target = { x: hasX || !prev ? t.x : prev.x, z: hasZ || !prev ? t.z : prev.z };
  const A = { ...st.pos };
  if (A.x === null || A.z === null) { st.pos = { ...target }; return; }
  const R = word(block, 'R');
  const taper = R ? lengthOf(R, ctx) : 0;
  const cycle = { code: st.motion, line: block.line, passIndex: 0 };
  for (const step of boxMoves(st.motion, A, target, taper)) {
    if (step.kind === 'rapid') pushSegment(ctx, 'rapid', step.to, { cycle });
    else feedMove(ctx, step.kind, step.to, { cycle });
  }
  st.box = target;
}
