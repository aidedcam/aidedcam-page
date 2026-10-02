// Steel take-off: the galvanizing-bath fit check (spec §5). A guide only; the galvanizer confirms. Pure.
export const BATH_DEFAULT = { length: 12.6, width: 1.3, depth: 1.8 };     // m

const ORDERS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

// box: the piece's three dimensions in mm, in any order; bath in m. 'fits' when one orientation fits the bath,
// 'double' (a double dip) when one fits with the length along the bath up to twice its length, else 'no'.
export function bathFit(box, bath = BATH_DEFAULT) {
  const d = box.map(v => (Number.isFinite(v) && v > 0 ? v / 1000 : 0));
  const L = bath.length, W = bath.width, D = bath.depth;
  if (!(L > 0 && W > 0 && D > 0)) return 'fits';
  let best = 'no';
  for (const [a, b, c] of ORDERS) {
    if (d[b] > W || d[c] > D) continue;
    if (d[a] <= L) return 'fits';
    if (d[a] <= 2 * L) best = 'double';
  }
  return best;
}
