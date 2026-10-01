import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE_3D, style3d } from '../../js/ifcplan/palette3d.js';
import { LAYERS } from '../../js/ifcplan/layers.js';

test('every drawn layer of the plans spec has a 3D colour: the table of the 3D spec §5', () => {
  assert.deepEqual(Object.keys(PALETTE_3D).sort(), LAYERS.map(l => l.name).filter(n => n !== 'IFC_SPACE_TEXT').sort());
  assert.deepEqual(PALETTE_3D, {
    IFC_WALL: ['#d8d4c8', 1], IFC_SLAB: ['#bfbcb2', 1], IFC_COLUMN: ['#c98a84', 1], IFC_BEAM: ['#a9adb4', 1],
    IFC_DOOR: ['#6fb3c2', 1], IFC_WINDOW: ['#8fb4f0', 0.45], IFC_CURTAINWALL: ['#7fb2d6', 0.45], IFC_STAIR: ['#8cc29a', 1],
    IFC_RAILING: ['#e0a07a', 1], IFC_FURNITURE: ['#d8c08a', 1], IFC_MEP: ['#cf93cf', 1], IFC_OTHER: ['#b5b0a8', 1],
    IFC_SPACE: ['#e8c96a', 0.15],
  });
});

test('only glass and rooms are semi-transparent, and they draw after the solids, rooms last', () => {
  const see = Object.keys(PALETTE_3D).filter(n => style3d(n).transparent).sort();
  assert.deepEqual(see, ['IFC_CURTAINWALL', 'IFC_SPACE', 'IFC_WINDOW']);
  assert.deepEqual(style3d('IFC_WALL'), { color: '#d8d4c8', opacity: 1, transparent: false, order: 0 });
  assert.deepEqual(style3d('IFC_WINDOW'), { color: '#8fb4f0', opacity: 0.45, transparent: true, order: 1 });
  assert.deepEqual(style3d('IFC_SPACE'), { color: '#e8c96a', opacity: 0.15, transparent: true, order: 2 });
  assert.deepEqual(style3d('IFC_UNKNOWN'), style3d('IFC_OTHER'), 'an unknown layer is drawn as IFC_OTHER');
});
