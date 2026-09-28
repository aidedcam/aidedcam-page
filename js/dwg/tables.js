// DWG quantities: the rows behind the on-screen tables and the workbook (spec §5), from the engine's
// result JSON. Lengths in m, areas in m². Pure: no DOM, so the Node tests and the .xlsx writer share it.

const isOk = r => r && r.type === 'result';

const LAYER_SUMS = ['len', 'lenCount', 'area', 'areaCount', 'hatchArea', 'hatchCount', 'bad'];

// One row per layer, in the engine's order (sorted by name).
export function layerRows(result) {
  return (result.layers || []).map(l => ({
    name: l.name, color: l.color, off: !!l.off, frozen: !!l.frozen,
    len: l.len || 0, lenCount: l.lenCount || 0, area: l.area || 0, areaCount: l.areaCount || 0,
    hatchArea: l.hatchArea || 0, hatchCount: l.hatchCount || 0, bad: l.bad || 0,
  }));
}

export function layerTotals(rows) {
  const t = Object.fromEntries(LAYER_SUMS.map(k => [k, 0]));
  for (const r of rows) for (const k of LAYER_SUMS) t[k] += r[k] || 0;
  return t;
}

// One row per block name and layer, in the engine's order (by name, then layer).
export function blockRows(result) {
  return (result.blocks || []).map(b => ({ name: b.name, layer: b.layer, count: b.count || 0, nested: b.nested || 0 }));
}

export function blockTotals(rows) {
  let count = 0, nested = 0;
  for (const r of rows) { count += r.count; nested += r.nested; }
  return { count, nested };
}

// Ordinal and case-insensitive, like the engine's sort, then exact case as the tie-break.
export function cmpName(a, b) {
  const A = a.toUpperCase(), B = b.toUpperCase();
  return A < B ? -1 : A > B ? 1 : a < b ? -1 : a > b ? 1 : 0;
}

// Totals across a batch (spec §5 Summary). Layers are merged by name, blocks by name and layer. A file
// that failed is listed in `missing`, and the totals are then minimums ("≥", spec §8).
export function summary(files) {
  const layers = new Map(), blocks = new Map(), missing = [];
  for (const f of files) {
    if (!isOk(f.result)) { missing.push(f.name); continue; }
    for (const r of layerRows(f.result)) {
      const cur = layers.get(r.name);
      if (!cur) { layers.set(r.name, { ...r }); continue; }
      for (const k of LAYER_SUMS) cur[k] += r[k];
      cur.off = cur.off && r.off;                                    // off only if off in every file that has it
      cur.frozen = cur.frozen && r.frozen;
    }
    for (const r of blockRows(f.result)) {
      const key = r.name + '\u0000' + r.layer;
      const cur = blocks.get(key);
      if (!cur) blocks.set(key, { ...r });
      else { cur.count += r.count; cur.nested += r.nested; }
    }
  }
  const blockList = [...blocks.values()].sort((a, b) => cmpName(a.name, b.name) || cmpName(a.layer, b.layer));
  const layerList = [...layers.values()].sort((a, b) => cmpName(a.name, b.name));
  return { layers: layerList, blocks: blockList, missing, partial: missing.length > 0 };
}

// Everything the engine counted but did not measure; blocks' inner geometry has its own notice.
export function notMeasuredCount(nm) {
  let n = 0;
  for (const [k, v] of Object.entries(nm || {})) if (k !== 'insideBlocks' && typeof v === 'number') n += v;
  return n;
}
