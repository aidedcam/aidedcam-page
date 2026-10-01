import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYER_COLORS, LEGEND_ORDER, createDrawing } from '../../js/ifcplan/drawing.js';
import { LAYERS } from '../../js/ifcplan/layers.js';
import { polylineSet } from '../../js/ifcplan/chain.js';

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

test('hidden layers (the legend toggles): not drawn, not picked, and still listed for the legend', () => {
  const saved = { ResizeObserver: globalThis.ResizeObserver, Path2D: globalThis.Path2D, window: globalThis.window, gcs: globalThis.getComputedStyle };
  globalThis.ResizeObserver = class { observe() {} };
  globalThis.Path2D = class { moveTo() {} lineTo() {} closePath() {} };
  globalThis.window = { devicePixelRatio: 1 };
  globalThis.getComputedStyle = () => ({ backgroundColor: '#fff' });
  const strokes = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : k === 'stroke' ? () => strokes.push(t.strokeStyle) : () => {}),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const line = (x0, y0, x1, y1) => { const s = polylineSet(); s.add([x0, y0, x1, y1], false); return s.pack(); };
  try {
    const canvas = { getContext: () => ctx, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }), width: 0, height: 0 };
    const d = createDrawing(canvas);
    const room = { name: 'R', longName: '', areaM2: 1, at: [5, 2.5] };
    d.show({ layers: { IFC_WALL: line(0, 0, 10, 0), IFC_DOOR: line(0, 5, 10, 5) }, rooms: [room] }, { x0: 0, y0: 0, x1: 10, y1: 5 });
    const wall = d.screenOf(5, 0);
    assert.equal(d.layerAt(wall.x, wall.y), 'IFC_WALL');
    assert.deepEqual(strokes, [LAYER_COLORS.IFC_DOOR, LAYER_COLORS.IFC_WALL]);
    strokes.length = 0;
    d.setHidden(new Set(['IFC_WALL']));
    assert.deepEqual(strokes, [LAYER_COLORS.IFC_DOOR], 'redrawn at once, without the wall');
    assert.equal(d.layerAt(wall.x, wall.y), null, 'a hidden layer is not picked');
    assert.deepEqual(d.layers, ['IFC_DOOR', 'IFC_WALL'], 'the legend still lists it');
    d.setHidden(new Set());
    assert.equal(d.layerAt(wall.x, wall.y), 'IFC_WALL');
  } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; }
  }
});

test('a canvas with no size (the plan under the 3D tab) keeps its bitmap, so print shows the plan', () => {
  const saved = { ResizeObserver: globalThis.ResizeObserver, Path2D: globalThis.Path2D, window: globalThis.window, gcs: globalThis.getComputedStyle };
  globalThis.ResizeObserver = class { observe() {} };
  globalThis.Path2D = class { moveTo() {} lineTo() {} closePath() {} };
  globalThis.window = { devicePixelRatio: 1 };
  globalThis.getComputedStyle = () => ({ backgroundColor: '#fff' });
  try {
    let rect = { left: 0, top: 0, width: 600, height: 260 };
    const ctx = { setTransform() {}, fillRect() {}, save() {}, restore() {}, stroke() {}, fill() {}, clearRect() {} };
    const canvas = { width: 0, height: 0, getContext: () => ctx, addEventListener() {}, getBoundingClientRect: () => rect };
    const d = createDrawing(canvas);
    const storey = { layers: {}, rooms: [] }, bbox = { x0: 0, y0: 0, x1: 10, y1: 5 };
    d.show(storey, bbox);
    assert.deepEqual([canvas.width, canvas.height], [600, 260], 'sized while visible');
    rect = { left: 0, top: 0, width: 0, height: 0 };
    d.show(storey, bbox, true);                                    // a storey click while the plan is hidden
    assert.deepEqual([canvas.width, canvas.height], [600, 260], 'not shrunk to 1 x 1 while hidden');
  } finally {
    Object.assign(globalThis, { ResizeObserver: saved.ResizeObserver, Path2D: saved.Path2D, getComputedStyle: saved.gcs });
    if (saved.window === undefined) delete globalThis.window; else globalThis.window = saved.window;
  }
});
