// Drilling cycles G73/G74/G76/G81–G89 in G17 (spec §5). Pure: turns one hole into the moves the
// control makes. The research notes in _docs/gcode-viewer/mill-cycles/ are the source for each
// sequence; this file follows them.
export const DRILL_CODES = new Set([73, 74, 76, 81, 82, 83, 84, 85, 86, 87, 88, 89]);
export const PECK_CODES = new Set([73, 83]);
export const APPROXIMATED = new Set([76, 87, 88]);

// One hole. from: the current position {x, y, z}. Returns [{ kind: 'crapid' | 'cfeed' | 'dwell',
// to?: {x, y, z}, seconds? }], ending at the return level (G98: initial level, G99: R).
// q is the peck depth (G73/G83); null or 0 makes a peck cycle drill in one feed (the caller has
// already raised peck-no-q), and so does a Z at or above R. p is the dwell in seconds, or null.
// qStep/qMin: the Haas I/J/K form, each peck qStep smaller than the last but never below qMin.
export function holeMoves(code, { from, x, y, initZ, r, z, q, p, retLevel, clearance, qStep = 0, qMin = 0 }) {
  const out = [];
  const at = zz => ({ x, y, z: zz });
  const rapid = zz => out.push({ kind: 'crapid', to: at(zz) });
  const feed = zz => out.push({ kind: 'cfeed', to: at(zz) });
  const dwell = () => { if (p > 0) out.push({ kind: 'dwell', seconds: p }); };
  const retZ = retLevel === 99 ? r : initZ;

  // Position over the hole at the current level, then down (or up) to R.
  if (from.x !== x || from.y !== y) out.push({ kind: 'crapid', to: { x, y, z: from.z } });
  if (from.z !== r) rapid(r);

  const peck = PECK_CODES.has(code) && q > 0 && z < r;
  if (peck) {
    let depth = r, first = true, step = q;
    while (depth > z + 1e-9) {
      const target = Math.max(depth - step, z);
      if (!first) {
        if (code === 83) rapid(r);                       // full retract to R after every peck
        rapid(depth + clearance);                        // G83: back down near the last depth; G73: retract d
      }
      feed(target);
      depth = target;
      first = false;
      if (qStep > 0) { const next = step - qStep; step = next >= qMin && next > 0 ? next : qMin > 0 ? qMin : step; }
    }
    rapid(retZ);
    return out;
  }

  feed(z);
  switch (code) {
    case 82: case 88: case 76: dwell(); rapid(retZ); break;
    case 84: case 74: dwell(); feed(r); if (retLevel === 98) rapid(initZ); break;   // tap out at feed
    case 85: feed(r); if (retLevel === 98) rapid(initZ); break;
    case 89: dwell(); feed(r); if (retLevel === 98) rapid(initZ); break;
    default: rapid(retZ);                                // 81, 86, 87; peck cycles without Q or with Z >= R
  }
  return out;
}
