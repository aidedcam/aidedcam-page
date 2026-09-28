import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowItems, clickSelection, boxSelection, fileStatus, engineSettings, admit, loadedEvent, MAX_FILES, MAX_BYTES } from '../../js/dwg/state.js';

const items = [
  { layer: 'PIPE', kind: 'line' },
  { layer: 'WIN', kind: 'insert', block: 'W1' },
  { layer: 'WIN', kind: 'insert', block: 'W2' },
  { layer: 'WIN', kind: 'polyline' },
  { layer: '0', kind: 'insert', block: 'W1' },
];

test('a layer row stands for all its items; a block row for that block on that layer', () => {
  assert.deepEqual(rowItems(items, { layer: 'WIN' }), [1, 2, 3]);
  assert.deepEqual(rowItems(items, { block: 'W1', layer: 'WIN' }), [1]);
  assert.deepEqual(rowItems(items, { block: 'W1', layer: '0' }), [4]);
  assert.deepEqual(rowItems(items, { layer: 'NONE' }), []);
});

test('clicks: replace, Shift toggles, empty space clears unless Shift', () => {
  assert.deepEqual(clickSelection([1, 2], 3, false), [3]);
  assert.deepEqual(clickSelection([1, 2], 3, true), [1, 2, 3]);
  assert.deepEqual(clickSelection([1, 2], 2, true), [1]);
  assert.deepEqual(clickSelection([1, 2], -1, false), []);
  assert.deepEqual(clickSelection([2, 1], -1, true), [1, 2]);
});

test('boxes: replace, or add with Shift', () => {
  assert.deepEqual(boxSelection([5], [3, 1], false), [1, 3]);
  assert.deepEqual(boxSelection([5], [3, 5], true), [3, 5]);
});

test('file status', () => {
  assert.equal(fileStatus({ result: null }), null);
  assert.equal(fileStatus({ result: { type: 'error' } }), 'error');
  assert.equal(fileStatus({ result: { type: 'result', warnings: [] } }), 'ok');
  assert.equal(fileStatus({ result: { type: 'result', warnings: [{ id: 'xrefs' }] } }), 'warn');
  // Text left unmeasured and geometry inside blocks are in almost every drawing: information, not a warning.
  assert.equal(fileStatus({ result: { type: 'result', warnings: [{ id: 'not-measured' }, { id: 'inside-blocks' }] } }), 'ok');
});

test('engine settings: page units always, a valid per-file override only', () => {
  assert.deepEqual(engineSettings({ units: 'cm' }, {}), { units: 'cm' });
  assert.deepEqual(engineSettings({}, { override: 'm' }), { units: 'auto', override: 'm' });
  assert.deepEqual(engineSettings({ units: 'mm' }, { override: 'yards' }), { units: 'mm' });
});

test('admit: at most 20 files; a file over 30 MB becomes a limit error without reaching the engine', () => {
  const f = (n, size = 10) => ({ name: `f${n}.dwg`, bytes: new ArrayBuffer(size) });
  const r = admit(15, [f(1), f(2, MAX_BYTES + 1), ...Array.from({ length: 8 }, (_, i) => f(i + 3))]);
  assert.equal(r.take.length, MAX_FILES - 15);
  assert.equal(r.dropped, 10 - 5);
  assert.equal(r.take[1].result.reason, 'limit');
  assert.equal(r.take[0].result, undefined);
  assert.equal(admit(MAX_FILES, [f(1)]).take.length, 0);
});

test('the files-loaded event carries counts only', () => {
  const ok = { type: 'result', layers: [{}, {}], blocks: [{ count: 3 }, { count: 2 }], schedules: [{}] };
  assert.deepEqual(loadedEvent([{ name: 'secret.dwg', result: ok }, { name: 'x', result: { type: 'error' } }]),
    { files: 2, errors: 1, layers: 2, blocks: 5, schedules: 1 });
});
