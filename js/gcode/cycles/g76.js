// G76 multiple threading. See _docs/gcode-viewer/cycles/g76.md. Pure.
export function g76Depths({ height, firstDepth, minDepth = 0, finishAllow = 0, finishPasses = 1 }) {
  const depths = [];
  const cap = height - finishAllow;
  let prev = 0;
  for (let n = 1; n <= 1000; n++) {
    const d = Math.max(firstDepth * Math.sqrt(n), prev + minDepth);
    if (d >= cap - 1e-9) { if (cap > prev + 1e-9) depths.push(cap); break; }
    depths.push(d);
    prev = d;
  }
  for (let i = 0; i < Math.max(1, finishPasses); i++) depths.push(height);
  return depths;
}

// Radial infeed: every pass enters at the start Z. The flank-infeed Z shift is not drawn until its
// direction is verified (g76.md); radial infeed does change the cycle time slightly versus flank
// infeed (g76.md's probes: two-line Fanuc 19.7s -> 19.3s, Haas one-line 23.8s -> 23.3s).
export function g76Moves({ start, end, depths, height, chamferLen = 0, taper = 0 }) {
  const moves = [];
  const dirZ = end.z < start.z ? -1 : 1;
  const out = start.x >= end.x ? 1 : -1;               // external thread: A outside the root
  const crest = end.x + out * height;
  depths.forEach((d, passIndex) => {
    const x = crest - out * d;
    const entry = { x: x + taper, z: start.z };
    moves.push({ kind: 'rapid', from: { ...start }, to: entry, passIndex });
    if (chamferLen > 0) {
      const pull = { x, z: end.z - dirZ * chamferLen };
      const outPt = { x: x + out * chamferLen, z: end.z };
      moves.push({ kind: 'thread', from: entry, to: pull, passIndex });
      moves.push({ kind: 'thread', from: pull, to: outPt, passIndex });
      moves.push({ kind: 'rapid', from: outPt, to: { x: start.x, z: end.z }, passIndex });
    } else {
      moves.push({ kind: 'thread', from: entry, to: { x, z: end.z }, passIndex });
      moves.push({ kind: 'rapid', from: { x, z: end.z }, to: { x: start.x, z: end.z }, passIndex });
    }
    moves.push({ kind: 'rapid', from: { x: start.x, z: end.z }, to: { ...start }, passIndex });
  });
  return moves;
}
