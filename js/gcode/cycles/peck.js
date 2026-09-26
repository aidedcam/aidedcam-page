// G74 (axis 'z') and G75 (axis 'x') peck cycles. See _docs/gcode-viewer/cycles/g74-g75.md. Pure.
export function peckMoves(axis, { start, end, peck, step, retract }) {
  const other = axis === 'z' ? 'x' : 'z';
  const P = (a, o) => (axis === 'z' ? { x: o, z: a } : { x: a, z: o });
  const a0 = start[axis], a1 = end[axis], o0 = start[other], o1 = end[other];
  const dir = a1 < a0 ? -1 : 1;
  const odir = o1 < o0 ? -1 : 1;
  const cols = [];
  if (!(step > 0) || Math.abs(o1 - o0) < 1e-9) cols.push(o1);
  else {
    for (let o = o0, n = 0; odir * (o1 - o) > 1e-9 && n < 10000; o += odir * step, n++) cols.push(o);
    cols.push(o1);
  }
  const moves = [];
  let pos = { ...start };
  const push = (kind, to) => { moves.push({ kind, from: pos, to }); pos = to; };
  cols.forEach((o, ci) => {
    if (ci > 0 || Math.abs(o - o0) > 1e-9) push('rapid', P(a0, o));
    if (!(peck > 0)) push('feed', P(a1, o));
    else {
      let reached = a0;
      for (let n = 0; n < 10000; n++) {
        const next = reached + dir * peck;
        if (dir * (a1 - next) <= 1e-9) { push('feed', P(a1, o)); break; }
        push('feed', P(next, o));
        if (retract > 0) push('rapid', P(next - dir * retract, o));
        reached = next;
      }
    }
    push('rapid', P(a0, o));
  });
  if (Math.abs(pos[other] - o0) > 1e-9) push('rapid', { ...start });
  return moves;
}
