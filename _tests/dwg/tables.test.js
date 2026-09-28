import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layerRows, layerTotals, blockRows, blockTotals, summary, notMeasuredCount, cmpName } from '../../js/dwg/tables.js';

const L = (name, o = {}) => ({ name, color: '#ffffff', off: false, frozen: false, len: 0, lenCount: 0, area: 0, areaCount: 0, hatchArea: 0, hatchCount: 0, bad: 0, ...o });
const res = (layers, blocks = []) => ({ type: 'result', layers, blocks, schedules: [], items: [], notMeasured: {} });

test('layer rows keep the engine order and default missing numbers to 0', () => {
  const rows = layerRows(res([L('A', { len: 2.5, lenCount: 3 }), { name: 'B', color: '#ff0000' }]));
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[1], L('B', { color: '#ff0000' }));
  assert.equal(rows[0].len, 2.5);
});

test('layer totals add every numeric column', () => {
  const t = layerTotals([L('A', { len: 1, lenCount: 2, area: 3, areaCount: 1, hatchArea: 4, hatchCount: 2, bad: 1 }), L('B', { len: 0.5, lenCount: 1, bad: 2 })]);
  assert.deepEqual(t, { len: 1.5, lenCount: 3, area: 3, areaCount: 1, hatchArea: 4, hatchCount: 2, bad: 3 });
});

test('block rows and totals', () => {
  const rows = blockRows(res([], [{ name: 'W1', layer: 'WIN', count: 8, nested: 0 }, { name: 'WC', layer: '0', count: 0, nested: 4 }]));
  assert.equal(rows.length, 2);
  assert.deepEqual(blockTotals(rows), { count: 8, nested: 4 });
});

test('summary merges layers by name and blocks by name and layer, across files', () => {
  const f1 = { name: 'a.dwg', result: res([L('PIPE', { len: 10, lenCount: 2, off: true }), L('WALL', { area: 5, areaCount: 1, frozen: true })], [{ name: 'W1', layer: 'WIN', count: 2, nested: 0 }]) };
  const f2 = { name: 'b.dxf', result: res([L('PIPE', { len: 5, lenCount: 1, off: false, color: '#00ff00' }), L('wall', { area: 1, areaCount: 1, frozen: true })], [{ name: 'W1', layer: 'WIN', count: 3, nested: 1 }, { name: 'W1', layer: '0', count: 1, nested: 0 }]) };
  const s = summary([f1, f2]);
  assert.equal(s.partial, false);
  assert.deepEqual(s.missing, []);
  const pipe = s.layers.find(l => l.name === 'PIPE');
  assert.equal(pipe.len, 15);
  assert.equal(pipe.lenCount, 3);
  assert.equal(pipe.color, '#ffffff', 'colour of the first file');
  assert.equal(pipe.off, false, 'off only if off everywhere');
  assert.deepEqual(s.layers.map(l => l.name), ['PIPE', 'WALL', 'wall'], 'names are case-sensitive keys, sorted case-insensitively');
  assert.equal(s.layers.find(l => l.name === 'WALL').frozen, true);
  assert.deepEqual(s.blocks, [{ name: 'W1', layer: '0', count: 1, nested: 0 }, { name: 'W1', layer: 'WIN', count: 5, nested: 1 }]);
});

test('a failed file makes the summary partial and is named', () => {
  const s = summary([{ name: 'ok.dwg', result: res([L('A', { len: 1, lenCount: 1 })]) }, { name: 'bad.dwg', result: { type: 'error', reason: 'read' } }]);
  assert.equal(s.partial, true);
  assert.deepEqual(s.missing, ['bad.dwg']);
  assert.equal(s.layers[0].len, 1);
});

test('not-measured count leaves out the geometry inside blocks', () => {
  assert.equal(notMeasuredCount({ text: 3, dim: 2, solid3d: 1, mesh: 0, proxy: 1, other: 4, insideBlocks: 100 }), 11);
  assert.equal(notMeasuredCount(undefined), 0);
});

test('names sort ordinally without case, like the engine', () => {
  assert.deepEqual(['b', 'A', 'a', 'Β', '_x', '0'].sort(cmpName), ['0', 'A', 'a', 'b', '_x', 'Β']);
});
