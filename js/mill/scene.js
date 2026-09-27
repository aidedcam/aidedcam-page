// Pure drawing data for the 3D view (spec §3.3): per-layer vertex arrays in execution order, the
// draw ranges for playback and tool isolation, and a screen-space pick grid. No DOM, no three.js.
import { K_RAPID, K_FEED, K_CFEED, K_CRAPID } from './moves.js';

export const LAYERS = ['feed', 'rapid', 'cycleFeed', 'cycleRapid'];
const LAYER_OF_KIND = { [K_FEED]: 0, [K_RAPID]: 1, [K_CFEED]: 2, [K_CRAPID]: 3 };

// Splits the moves by layer. Each layer keeps its moves' positions (6 floats each), their execution
// indices (sorted ascending, because moves are recorded in execution order) and work offsets.
export function buildLayers(moves) {
  const counts = [0, 0, 0, 0];
  for (let i = 0; i < moves.count; i++) counts[LAYER_OF_KIND[moves.kind[i]]]++;
  const layers = LAYERS.map((name, l) => ({ name, count: 0, pos: new Float32Array(counts[l] * 6),
    exec: new Uint32Array(counts[l]), wofs: new Uint8Array(counts[l]) }));
  for (let i = 0; i < moves.count; i++) {
    const L = layers[LAYER_OF_KIND[moves.kind[i]]], j = L.count++;
    L.pos.set(moves.pos.subarray(i * 6, i * 6 + 6), j * 6);
    L.exec[j] = i;
    L.wofs[j] = moves.wofs[i];
  }
  return layers;
}

// First index whose value is >= v (arr sorted ascending).
export function lowerBound(arr, v) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (arr[mid] < v) lo = mid + 1; else hi = mid; }
  return lo;
}

// The part of a layer whose moves have execution index in [execStart, execEnd): playback draws
// [0, n), tool isolation draws one row's [moveStart, moveEnd), and both combine.
export function layerRange(layer, execStart, execEnd) {
  const first = lowerBound(layer.exec, execStart);
  const last = Math.max(first, lowerBound(layer.exec, execEnd));
  return { first, count: last - first };
}

// Screen-space pick grid over the visible moves. project(x, y, z, out) writes out[0..1] in pixels
// and returns false for points it can't place. visible(i) filters moves by index.
export function buildPickGrid(moves, visible, project, width, height, cell = 8) {
  const cols = Math.max(1, Math.ceil(width / cell)), rows = Math.max(1, Math.ceil(height / cell));
  const n = moves.count, scr = new Float32Array(n * 4), ok = new Uint8Array(n), a = [0, 0], b = [0, 0];
  for (let i = 0; i < n; i++) {
    if (!visible(i)) continue;
    const p = moves.pos, k = i * 6;
    if (!project(p[k], p[k + 1], p[k + 2], a) || !project(p[k + 3], p[k + 4], p[k + 5], b)) continue;
    scr[i * 4] = a[0]; scr[i * 4 + 1] = a[1]; scr[i * 4 + 2] = b[0]; scr[i * 4 + 3] = b[1];
    ok[i] = 1;
  }
  // Two passes over the same cell walk: count per cell, then fill (a flat CSR, no per-cell arrays).
  // Each segment is first clipped to the view (plus one cell), so its walk is bounded by the screen.
  const lo = [-cell, -cell], hi = [width + cell, height + cell];
  const walk = (i, visit) => {
    let x0 = scr[i * 4], y0 = scr[i * 4 + 1], x1 = scr[i * 4 + 2], y1 = scr[i * 4 + 3];
    let t0 = 0, t1 = 1;
    const d = [x1 - x0, y1 - y0], p0 = [x0, y0];
    for (let a = 0; a < 2; a++) {                      // Liang–Barsky against the expanded view
      if (d[a] === 0) { if (p0[a] < lo[a] || p0[a] > hi[a]) return; continue; }
      let ta = (lo[a] - p0[a]) / d[a], tb = (hi[a] - p0[a]) / d[a];
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) return;
    }
    x0 = p0[0] + d[0] * t0; y0 = p0[1] + d[1] * t0;
    x1 = p0[0] + d[0] * t1; y1 = p0[1] + d[1] * t1;
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / cell));
    let last = -1;
    for (let s = 0; s <= steps; s++) {
      const x = x0 + ((x1 - x0) * s) / steps, y = y0 + ((y1 - y0) * s) / steps;
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
      const c = cy * cols + cx;
      if (c !== last) { visit(c); last = c; }
    }
  };
  const start = new Uint32Array(cols * rows + 1);
  for (let i = 0; i < n; i++) if (ok[i]) walk(i, c => { start[c + 1]++; });
  for (let c = 1; c < start.length; c++) start[c] += start[c - 1];
  const fill = start.slice(), items = new Uint32Array(start[start.length - 1]);
  for (let i = 0; i < n; i++) if (ok[i]) walk(i, c => { items[fill[c]++] = i; });
  return { cell, cols, rows, start, items, scr };
}

// Work-offset tints (spec §8): the feed colour, then darker shades of it, repeating after four.
// Darker keeps every tint at or above the base colour's contrast on white and on paper.
const SHADES = [1, 0.86, 0.72, 0.6];
export function offsetTints(hex, n) {
  const v = parseInt(hex.slice(1), 16), rgb = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  return Array.from({ length: n }, (_, i) => '#' + rgb
    .map(c => Math.round(c * SHADES[i % SHADES.length]).toString(16).padStart(2, '0')).join(''));
}

function distToSegment(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / len2)) : 0;
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

// Nearest move within tol pixels of (sx, sy), with its screen parameter t, or null.
export function pickNearest(grid, sx, sy, tol = 6) {
  const { cell, cols, rows, start, items, scr } = grid;
  const r = Math.ceil(tol / cell), cx = Math.floor(sx / cell), cy = Math.floor(sy / cell);
  let best = null, bestD = tol;
  for (let y = Math.max(0, cy - r); y <= Math.min(rows - 1, cy + r); y++) {
    for (let x = Math.max(0, cx - r); x <= Math.min(cols - 1, cx + r); x++) {
      const c = y * cols + x;
      for (let k = start[c]; k < start[c + 1]; k++) {
        const i = items[k];
        const d = distToSegment(sx, sy, scr[i * 4], scr[i * 4 + 1], scr[i * 4 + 2], scr[i * 4 + 3]);
        if (d <= bestD) { bestD = d; best = i; }
      }
    }
  }
  return best;
}
