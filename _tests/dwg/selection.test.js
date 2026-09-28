import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIndex, pick, selectBox, selectionTotals, selectionTsv } from '../../js/dwg/selection.js';

const line = (id, layer, x0, y0, x1, y1) => ({ id, layer, kind: 'line', len: Math.hypot(x1 - x0, y1 - y0), area: 0, block: null, copies: 1, bad: false, path: [[x0, y0, x1, y1]] });
const rect = (id, layer, x, y, w, h, kind = 'polyline', extra = {}) => ({
  id, layer, kind, len: kind === 'hatch' ? 0 : 2 * (w + h), area: w * h, block: null, copies: 1, bad: false,
  path: [[x, y, x + w, y, x + w, y + h, x, y + h, x, y]], ...extra,
});
const insert = (id, layer, block, x, y, copies = 1) => ({ id, layer, kind: 'insert', len: 0, area: 0, block, copies, bad: false, path: [[x, y, x + 1, y + 1], [x + 1, y, x, y + 1]] });

// A small plan: a pipe, a room outline with its hatch, an island hatch, two window blocks.
function plan() {
  return [
    line('A', 'PIPE', 0, 0, 10, 0),                                                            // 0
    rect('B', 'ROOM', 2, 2, 6, 4),                                                             // 1
    { ...rect('C', 'HATCH', 2, 2, 6, 4, 'hatch'), area: 24 - 1, path: [[2, 2, 8, 2, 8, 6, 2, 6, 2, 2], [4, 3, 5, 3, 5, 4, 4, 4, 4, 3]] },  // 2, with a 1×1 island
    insert('D', 'WIN', 'W1', 20, 0),                                                          // 3
    insert('E', 'WIN', 'W1', 22, 0, 6),                                                       // 4 (an array of 6)
    { ...rect('F', 'ROOM', 30, 0, 2, 2), bad: true, area: 0 },                                 // 5
  ];
}

test('pick: the nearest edge within the tolerance', () => {
  const items = plan(), ix = createIndex(items);
  assert.equal(pick(ix, items, 5, 0.05, 0.1), 0);
  assert.equal(pick(ix, items, 5, 1, 0.1), -1);
  assert.equal(pick(ix, items, 20.5, 0.5, 0.1), 3);
});

test('pick: inside a filled item, the smallest one wins; an island is a hole', () => {
  const items = plan(), ix = createIndex(items);
  // (3, 5) is inside the room outline (24 m²) and inside the hatch (23 m²): the hatch is smaller.
  assert.equal(pick(ix, items, 3, 5, 0.1), 2);
  // (4.5, 3.5) is in the hatch's island: only the room outline contains it.
  assert.equal(pick(ix, items, 4.5, 3.5, 0.1), 1);
  // A bad item has no trusted area, so it is not picked from inside.
  assert.equal(pick(ix, items, 31, 1, 0.1), -1);
});

test('window selects only items fully inside; crossing also takes what the box touches', () => {
  const items = plan(), ix = createIndex(items);
  assert.deepEqual(selectBox(ix, items, 1, 1, 9, 7, 'window'), [1, 2]);
  assert.deepEqual(selectBox(ix, items, 9, 7, 1, 1, 'window'), [1, 2], 'corners in any order');
  assert.deepEqual(selectBox(ix, items, 5, -1, 6, 2.5, 'crossing'), [0, 1, 2]);
  // A box inside the hatch but not touching any edge still crosses the hatch and the room.
  assert.deepEqual(selectBox(ix, items, 6, 4.5, 7, 5, 'crossing'), [1, 2]);
  // A box inside the island crosses only the room (its point is not in the hatch).
  assert.deepEqual(selectBox(ix, items, 4.2, 3.2, 4.8, 3.8, 'crossing'), [1]);
});

test('selection totals: lengths and areas per layer, hatch areas apart, blocks by name with copies', () => {
  const items = plan();
  const t = selectionTotals(items, [0, 1, 2, 3, 4, 5]);
  assert.equal(t.items, 6);
  assert.deepEqual(t.layers, [
    { name: 'HATCH', len: 0, area: 0, hatchArea: 23, bad: 0 },
    { name: 'PIPE', len: 10, area: 0, hatchArea: 0, bad: 0 },
    { name: 'ROOM', len: 28, area: 24, hatchArea: 0, bad: 1 },
  ]);
  assert.deepEqual(t.blocks, [{ name: 'W1', count: 7 }]);
});

test('the copied text is tab-separated with a point decimal and totals', () => {
  const items = plan();
  const tsv = selectionTsv(selectionTotals(items, [0, 1, 3]), k => k);
  assert.equal(tsv,
    'dq.col.layer\tdq.col.len\tdq.col.area\tdq.col.hatchArea\n'
    + 'PIPE\t10.000\t0.000\t0.000\n'
    + 'ROOM\t20.000\t24.000\t0.000\n'
    + 'dq.total\t30.000\t24.000\t0.000\n'
    + '\n'
    + 'dq.col.block\tdq.col.count\n'
    + 'W1\t1\n');
});

test('the copied text uses the decimal separator it is given, without grouping', () => {
  const items = [line('A', 'PIPE', 0, 0, 1085.6, 0)];
  const tsv = selectionTsv(selectionTotals(items, [0]), k => k, ',');
  assert.equal(tsv,
    'dq.col.layer\tdq.col.len\tdq.col.area\tdq.col.hatchArea\n'
    + 'PIPE\t1085,600\t0,000\t0,000\n'
    + 'dq.total\t1085,600\t0,000\t0,000\n');
});

// A tiny deterministic generator, so a failure repeats.
function rng(seed) { return () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); }

test('the grid finds exactly what a brute-force scan finds, on 2,000 random items', () => {
  const r = rng(7), items = [];
  for (let i = 0; i < 2000; i++) {
    const x = r() * 1000, y = r() * 500, k = r();
    if (k < 0.5) items.push(line(String(i), 'L', x, y, x + (r() - 0.5) * 40, y + (r() - 0.5) * 40));
    else if (k < 0.9) items.push(rect(String(i), 'R', x, y, r() * 30 + 0.01, r() * 30 + 0.01));
    else items.push(rect(String(i), 'H', x, y, r() * 400, r() * 300, 'hatch'));     // a few big ones
  }
  const ix = createIndex(items, 5);                                                   // small cells: big items go to the "always" list
  const all = { query: () => items.map((_, i) => i), bboxOf: i => ix.bboxOf(i) };
  for (let q = 0; q < 200; q++) {
    const x0 = r() * 1100 - 50, y0 = r() * 600 - 50, x1 = x0 + r() * 200, y1 = y0 + r() * 200;
    for (const mode of ['window', 'crossing']) {
      assert.deepEqual(selectBox(ix, items, x0, y0, x1, y1, mode), selectBox(all, items, x0, y0, x1, y1, mode), `${mode} box ${q}`);
    }
    const px = r() * 1000, py = r() * 500;
    assert.equal(pick(ix, items, px, py, 2), pick(all, items, px, py, 2), `pick ${q}`);
  }
});

test('an empty drawing or a zero-size one does not break the index', () => {
  assert.deepEqual(createIndex([]).query(0, 0, 1, 1), []);
  const pt = [line('p', 'L', 3, 3, 3, 3)];
  const ix = createIndex(pt);
  assert.deepEqual(ix.query(2, 2, 4, 4), [0]);
  assert.equal(pick(ix, pt, 3, 3, 0.1), 0);
});
