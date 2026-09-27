import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSelection } from '../../js/gcode/shell/selection.js';
import { readFileText, writeHandoff, takeHandoff, HANDOFF_KEY, HANDOFF_MAX_CHARS } from '../../js/gcode/shell/loader.js';

function track() {
  const calls = [];
  let cleared = 0;
  const sel = createSelection({ apply: (line, scroll) => calls.push([line, scroll]), onClear: () => { cleared++; } });
  return { sel, calls, cleared: () => cleared };
}

test('hover highlights while nothing is pinned; a pin blocks hover until cleared', () => {
  const { sel, calls } = track();
  assert.equal(sel.hover(5), true);
  sel.pin(7);
  assert.equal(sel.hover(9), false);
  assert.equal(sel.line, 7);
  sel.clear();
  assert.equal(sel.hover(9, true), true);
  assert.deepEqual(calls, [[5, false], [7, true], [null, false], [9, true]]);
});

test('clicking the pinned line again unpins it; a check link (toggle: false) always pins', () => {
  const { sel, cleared } = track();
  sel.pin(4);
  sel.pin(4);
  assert.equal(sel.pinned, null);
  assert.equal(cleared(), 1);
  sel.pin(4, { toggle: false });
  sel.pin(4, { toggle: false });
  assert.equal(sel.pinned, 4);
});

test('a new program resets silently; a re-run keeps the pin only if its line still exists', () => {
  const { sel, calls } = track();
  sel.pin(12);
  sel.reapply(20);
  assert.equal(sel.pinned, 12);
  sel.reapply(10);
  assert.equal(sel.pinned, null);
  sel.pin(3);
  const before = calls.length;
  sel.reset();
  assert.equal(calls.length, before);                       // reset draws nothing
  assert.equal(sel.pinned, null);
  assert.equal(sel.line, null);
});

test('readFileText: UTF-8 as is; Greek Windows-1253 bytes fall back instead of showing U+FFFD', async () => {
  const utf8 = { arrayBuffer: async () => new TextEncoder().encode('(ΕΚΧΟΝΔΡΩΣΗ)\nT0101').buffer };
  assert.equal(await readFileText(utf8), '(ΕΚΧΟΝΔΡΩΣΗ)\nT0101');
  const cp1253 = Uint8Array.from([0x28, 0xc5, 0xca, 0xd7, 0xcf, 0xcd, 0x29]);  // "(ΕΚΧΟΝ)" in Windows-1253
  assert.equal(await readFileText({ arrayBuffer: async () => cp1253.buffer }), '(ΕΚΧΟΝ)');
});

test('handoff: stored once, read once, removed; too large is refused; junk is ignored', () => {
  const mem = new Map();
  const storage = { setItem: (k, v) => mem.set(k, v), getItem: k => mem.get(k) ?? null, removeItem: k => mem.delete(k) };
  assert.equal(writeHandoff(storage, 'G0 X0', 'a.nc'), true);
  assert.deepEqual(takeHandoff(storage), { text: 'G0 X0', name: 'a.nc' });
  assert.equal(takeHandoff(storage), null);
  assert.equal(writeHandoff(storage, 'x'.repeat(HANDOFF_MAX_CHARS + 1), 'big.nc'), false);
  mem.set(HANDOFF_KEY, '{not json');
  assert.equal(takeHandoff(storage), null);
  assert.equal(mem.has(HANDOFF_KEY), false);
  const blocked = { setItem() { throw new Error('quota'); }, getItem() { throw new Error('blocked'); }, removeItem() {} };
  assert.equal(writeHandoff(blocked, 'G0', ''), false);
  assert.equal(takeHandoff(blocked), null);
});

test('program panel: past MAX_SPACER the spacer stops growing and the scroll scales onto the lines', async () => {
  const { panelScale, MAX_SPACER, LINE_H } = await import('../../js/gcode/shell/program-panel.js');
  assert.ok(MAX_SPACER < 17000000);                                   // under Firefox's element-height limit
  assert.deepEqual(panelScale(300000, 600), { spacer: 300000 * LINE_H, k: 1 });   // the lathe's cap: unchanged
  assert.deepEqual(panelScale(10, 600), { spacer: 10 * LINE_H, k: 1 });           // shorter than the view
  const big = panelScale(1000000, 600);
  assert.equal(big.spacer, MAX_SPACER);
  // At the last scroll position the last line sits at the bottom of the view.
  assert.ok(Math.abs((MAX_SPACER - 600) * big.k - (1000000 * LINE_H - 600)) < 1e-6);
});
