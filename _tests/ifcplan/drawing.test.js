import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYER_COLORS, LEGEND_ORDER, createDrawing } from '../../js/ifcplan/drawing.js';
import { LAYERS } from '../../js/ifcplan/layers.js';

test('every layer of spec §4 has a preview colour; the legend follows the spec order, without the label layer', () => {
  assert.deepEqual(Object.keys(LAYER_COLORS).sort(), LAYERS.map(l => l.name).sort());
  for (const c of Object.values(LAYER_COLORS)) assert.match(c, /^#[0-9a-f]{6}$/);
  assert.deepEqual(LEGEND_ORDER, LAYERS.map(l => l.name).slice(0, 13));
  assert.equal(typeof createDrawing, 'function');
});

test('hover picking is coalesced: at most one pick per animation frame, at the latest pointer position', () => {
  const frames = [], on = {}, hovers = [];
  const saved = { ResizeObserver: globalThis.ResizeObserver, raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame };
  globalThis.ResizeObserver = class { observe() {} };
  globalThis.requestAnimationFrame = fn => frames.push(fn);
  globalThis.cancelAnimationFrame = id => { frames[id - 1] = null; };
  const flush = () => frames.splice(0).forEach(fn => fn && fn());
  try {
    const canvas = { getContext: () => ({}), addEventListener: (type, fn) => { on[type] = fn; }, getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 100 }) };
    createDrawing(canvas, { onHover: (layer, x, y) => hovers.push([layer, x, y]) });
    for (const x of [30, 40, 50]) on.pointermove({ pointerType: 'mouse', pointerId: 1, clientX: x, clientY: 60 });
    assert.deepEqual(hovers, [], 'nothing picked before the frame');
    assert.equal(frames.length, 1, 'one frame asked for');
    flush();
    assert.deepEqual(hovers, [[null, 50, 60]]);
    on.pointermove({ pointerType: 'mouse', pointerId: 1, clientX: 70, clientY: 60 });
    on.pointerleave({});
    flush();
    assert.deepEqual(hovers, [[null, 50, 60], [null, 0, 0]], 'leaving cancels the pending pick');
    on.pointermove({ pointerType: 'touch', pointerId: 2, clientX: 70, clientY: 60 });
    assert.equal(frames.length, 0, 'no hover on touch');
  } finally {
    globalThis.ResizeObserver = saved.ResizeObserver;
    globalThis.requestAnimationFrame = saved.raf;
    globalThis.cancelAnimationFrame = saved.caf;
  }
});
