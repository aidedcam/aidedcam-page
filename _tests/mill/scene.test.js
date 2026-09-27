import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMill } from '../../js/mill/analyze.js';
import { MILL_EXAMPLE } from '../../js/mill/example.js';
import { buildLayers, lowerBound, layerRange, buildPickGrid, pickNearest, LAYERS } from '../../js/mill/scene.js';

const r = analyzeMill(MILL_EXAMPLE);
const layers = buildLayers(r.moves);

test('layers split the moves by kind and keep execution order', () => {
  assert.deepEqual(layers.map(l => l.name), LAYERS);
  assert.equal(layers.reduce((a, l) => a + l.count, 0), r.moves.count);
  for (const l of layers) for (let j = 1; j < l.count; j++) assert.ok(l.exec[j] > l.exec[j - 1]);
  const feed = layers[0], i = feed.exec[0];
  assert.deepEqual(Array.from(feed.pos.slice(0, 6)), Array.from(r.moves.pos.slice(i * 6, i * 6 + 6)));
});

test('lowerBound and layerRange: playback and isolation are plain ranges', () => {
  const arr = new Uint32Array([2, 5, 5, 9]);
  assert.deepEqual([0, 2, 3, 5, 6, 9, 10].map(v => lowerBound(arr, v)), [0, 0, 1, 1, 3, 3, 4]);
  // Tool isolation: one row's moves only, per layer.
  const row = r.timing.rows[2];                                 // T3 drill: cycle moves only
  const counts = layers.map(l => layerRange(l, row.moveStart, row.moveEnd).count);
  assert.equal(counts.reduce((a, b) => a + b, 0), row.moveEnd - row.moveStart);
  assert.ok(counts[2] > 0 && counts[3] > 0);
  // Playback up to move n: every layer's range ends before n.
  const n = Math.floor(r.moves.count / 2);
  const upTo = layers.map(l => layerRange(l, 0, n));
  assert.equal(upTo.reduce((a, x) => a + x.count, 0), n);
});

test('pick grid: the nearest visible move within the pixel tolerance', () => {
  // Orthographic top view, 1 px per mm, origin at the corner: screen = (x, 100 - y).
  const project = (x, y, z, out) => { out[0] = x + 40; out[1] = 100 - y; return true; };
  const grid = buildPickGrid(r.moves, () => true, project, 240, 140, 8);
  const hit = pickNearest(grid, 40 + 130, 100 - 45, 4);        // the face mill's pass end at X130 Y45
  assert.notEqual(hit, null);
  assert.equal(r.moves.line[hit] >= 12 && r.moves.line[hit] <= 14, true);
  assert.equal(pickNearest(grid, 239, 139, 4), null);          // empty corner
  const none = buildPickGrid(r.moves, () => false, project, 240, 140, 8);
  assert.equal(pickNearest(none, 40 + 130, 100 - 45, 4), null);
});

test('pick grid stays bounded for a segment much longer than the screen', () => {
  const moves = { count: 1, pos: new Float32Array([-1e6, 0, 0, 1e6, 0, 0]) };
  const grid = buildPickGrid(moves, () => true, (x, y, z, o) => { o[0] = x; o[1] = y + 50; return true; }, 100, 100, 8);
  assert.ok(grid.items.length <= 20, `${grid.items.length} cells`);          // clipped: about one row of cells
  assert.equal(pickNearest(grid, 50, 50, 4), 0);
});

test('work-offset tints: the base colour first, then darker shades, repeating after four', async () => {
  const { offsetTints } = await import('../../js/mill/scene.js');
  assert.deepEqual(offsetTints('#0d7a3e', 5), ['#0d7a3e', '#0b6935', '#09582d', '#084925', '#0d7a3e']);
});
