import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, LIFT, pickColor, pickIndex, cutSegments, createView3d, hasWebGL2 } from '../../js/ifcplan/view3d.js';
import { polylineSet } from '../../js/ifcplan/chain.js';

test('the presets of 3D spec §2, Z up: Top, Front, Side and Iso (the default)', () => {
  assert.deepEqual(Object.keys(PRESETS), ['top', 'front', 'side', 'iso']);
  assert.ok(PRESETS.top[2] > 0.99 && PRESETS.front[1] < 0 && PRESETS.side[0] > 0);
  assert.equal(typeof createView3d, 'function');
  assert.equal(typeof hasWebGL2, 'function');
});

test('picking colours: element i is i + 1 in 24 bits, and 0 is the background', () => {
  for (const i of [0, 1, 254, 255, 256, 65535, 65536, 16777214]) assert.equal(pickIndex(...pickColor(i)), i);
  assert.deepEqual(pickColor(0), [1, 0, 0]);
  assert.deepEqual(pickColor(300), [45, 1, 0]);
  assert.equal(pickIndex(0, 0, 0), null);
});

test('the cut lines: each polyline as segments at the cut, relative to the origin; a closed one closes', () => {
  const set = polylineSet();
  set.add([100, 50, 104, 50, 104, 53, 100, 53], true);            // a closed rectangle: 4 segments
  set.add([100, 60, 102, 60, 102, 61], false);                    // an open polyline: 2 segments
  const door = polylineSet();
  door.add([101, 50, 101.9, 50], false);
  const storey = { cutZ: 1.1, layers: { IFC_WALL: set.pack(), IFC_DOOR: door.pack() } };
  const s = cutSegments(storey, [100, 50, -0.25]);
  assert.deepEqual(Object.keys(s), ['IFC_WALL', 'IFC_DOOR']);
  assert.ok(s.IFC_WALL instanceof Float32Array);
  assert.equal(s.IFC_WALL.length, 6 * 6);
  const z = Math.fround(1.1 + 0.25 + LIFT);
  assert.deepEqual([...s.IFC_WALL.subarray(0, 6)], [0, 3, z, 0, 0, z], 'the closing segment first: last point to first');
  assert.deepEqual([...s.IFC_WALL.subarray(6, 12)], [0, 0, z, 4, 0, z]);
  assert.deepEqual([...s.IFC_WALL.subarray(24, 30)], [0, 10, z, 2, 10, z], 'the open polyline does not close');
  assert.deepEqual([...s.IFC_DOOR].map(v => +v.toFixed(4)), [1, 0, +z.toFixed(4), 1.9, 0, +z.toFixed(4)]);
  assert.ok(LIFT > 0 && LIFT <= 0.005, 'just above the clipped faces');
});
