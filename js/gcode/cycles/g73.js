// G73 pattern repeat. See _docs/gcode-viewer/cycles/g73.md. Pure.
export function g73Moves({ start, pEnd, body, reliefX, reliefZ, divisions, allowX, allowZ }) {
  const n = Math.max(1, Math.round(divisions || 1));
  const moves = [];
  for (let k = 1; k <= n; k++) {
    const t = n > 1 ? (n - k) / (n - 1) : 0;
    const ox = allowX + reliefX * t, oz = allowZ + reliefZ * t;
    const sh = p => ({ x: p.x + ox, z: p.z + oz });
    const passIndex = k - 1;
    moves.push({ kind: 'rapid', from: { ...start }, to: sh(pEnd), arc: null, passIndex });
    for (const s of body) {
      const arc = s.arc ? { ...s.arc, cx: s.arc.cx + ox, cz: s.arc.cz + oz } : null;
      moves.push({ kind: 'pass', from: sh(s.from), to: sh(s.to), arc, passIndex });
    }
    const end = body.length ? sh(body[body.length - 1].to) : sh(pEnd);
    moves.push({ kind: 'rapid', from: end, to: { ...start }, arc: null, passIndex });
  }
  return moves;
}
