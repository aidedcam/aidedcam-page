// G71 / G72 multiple-repetitive roughing. Port of our desktop G71PassPlanner (ComputePassMoves,
// AppendPass) generalised to a normalised frame: d = depth axis (passes step DOWN in d),
// c = cut axis (cuts run DOWN in c from the start). See _docs/gcode-viewer/cycles/g70-g72.md.
import { flatten, firstIntrusion } from '../geom.js';

const SIN45 = Math.SQRT1_2;
const MAX_PASSES = 500;

// Orientation from the start point: OD when A is outside the profile (sx = +1), ID when inside
// (sx = -1). Cuts toward -Z when the profile lies below A in Z (sz = +1), else toward +Z (sz = -1).
// Bounds by loop, not Math.min(...xs): a spread of a long arc-fitted profile overflows the stack.
export function roughFrame(code, start, flat) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const s of flat) {
    minX = Math.min(minX, s.x1, s.x2); maxX = Math.max(maxX, s.x1, s.x2);
    minZ = Math.min(minZ, s.z1, s.z2); maxZ = Math.max(maxZ, s.z1, s.z2);
  }
  const sx = start.x >= maxX - 1e-6 ? 1 : start.x <= minX + 1e-6 ? -1 : 1;
  const sz = start.z >= maxZ - 1e-6 ? 1 : start.z <= minZ + 1e-6 ? -1 : 1;
  if (code === 72) {
    return { sx, sz, toN: p => ({ d: p.z * sz, c: p.x * sx }), fromN: q => ({ x: q.c * sx, z: q.d * sz }) };
  }
  return { sx, sz, toN: p => ({ d: p.x * sx, c: p.z * sz }), fromN: q => ({ x: q.d * sx, z: q.c * sz }) };
}

export function roughCore({ start, segs, depth, retract, allowD, allowC }) {
  const moves = [];
  if (!(depth > 1e-4) || segs.length === 0) return moves;
  let minD = Infinity, minC = Infinity;
  for (const s of segs) { minD = Math.min(minD, s.d1, s.d2); minC = Math.min(minC, s.c1, s.c2); }
  const first = start.d - depth, last = minD + allowD;
  if (first <= last) return moves;                     // start too close to the end: no passes
  const r = retract * SIN45;
  let cur = start.d, passIndex = 0;

  const pass = pd => {
    const endC = firstIntrusion(segs, pd - allowD, start.c, minC) + allowC;
    if (!(endC < start.c)) return;
    moves.push({ kind: 'rapid', from: { d: cur, c: start.c }, to: { d: pd, c: start.c }, passIndex });
    moves.push({ kind: 'pass', from: { d: pd, c: start.c }, to: { d: pd, c: endC }, passIndex });
    moves.push({ kind: 'retract', from: { d: pd, c: endC }, to: { d: pd + r, c: endC + r }, passIndex });
    moves.push({ kind: 'rapid', from: { d: pd + r, c: endC + r }, to: { d: pd + r, c: start.c }, passIndex });
    cur = pd + r;
    passIndex++;
  };

  for (let pd = first, n = 0; pd > last + 0.001 && n < MAX_PASSES; pd -= depth, n++) pass(pd);
  pass(last);                                          // final pass leaves exactly the allowance
  if (passIndex > 0 && Math.abs(cur - start.d) > 0.001) {
    moves.push({ kind: 'rapid', from: { d: cur, c: start.c }, to: { d: start.d, c: start.c }, passIndex: passIndex - 1 });
  }
  return moves;
}

export function roughMoves(code, { start, body, depth, retract, allowX, allowZ }, arcSegments = 48) {
  const flat = flatten(body, arcSegments);
  if (!flat.length) return { moves: [], frame: null, allowD: null, allowC: null };
  const frame = roughFrame(code, start, flat);
  const segs = flat.map(s => {
    const a = frame.toN({ x: s.x1, z: s.z1 }), b = frame.toN({ x: s.x2, z: s.z2 });
    return { d1: a.d, c1: a.c, d2: b.d, c2: b.c };
  });
  const allowD = code === 72 ? allowZ * frame.sz : allowX * frame.sx;
  const allowC = code === 72 ? allowX * frame.sx : allowZ * frame.sz;
  const core = roughCore({ start: frame.toN(start), segs, depth, retract, allowD, allowC });
  return {
    frame, allowD, allowC,
    moves: core.map(m => ({ kind: m.kind, passIndex: m.passIndex, from: frame.fromN(m.from), to: frame.fromN(m.to) })),
  };
}
