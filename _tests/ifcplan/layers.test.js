import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYERS, ACI, layerOf, isMarkerProxy } from '../../js/ifcplan/layers.js';

// Spec §4, row by row.
const SPEC = [
  ['IFC_WALL', 7, ['IfcWall', 'IfcWallStandardCase', 'IfcWallElementedCase']],
  ['IFC_DOOR', 4, ['IfcDoor']],
  ['IFC_WINDOW', 5, ['IfcWindow']],
  ['IFC_COLUMN', 1, ['IfcColumn']],
  ['IFC_BEAM', 8, ['IfcBeam', 'IfcMember']],
  ['IFC_SLAB', 9, ['IfcSlab', 'IfcRoof', 'IfcCovering']],
  ['IFC_STAIR', 3, ['IfcStair', 'IfcStairFlight', 'IfcRamp', 'IfcRampFlight']],
  ['IFC_RAILING', 30, ['IfcRailing']],
  ['IFC_CURTAINWALL', 140, ['IfcCurtainWall', 'IfcPlate']],
  ['IFC_FURNITURE', 40, ['IfcFurnishingElement', 'IfcFurniture', 'IfcSanitaryTerminal']],
  ['IFC_MEP', 6, ['IfcFlowSegment', 'IfcFlowTerminal', 'IfcFlowFitting', 'IfcDistributionElement', 'IfcPipeSegment', 'IfcDuctFitting', 'IfcAirTerminal', 'IfcLightFixture', 'IfcValve', 'IfcPump', 'IfcBoiler', 'IfcSensor', 'IfcCableCarrierSegment']],
  ['IFC_OTHER', 8, ['IfcBuildingElementProxy', 'IfcFooting', 'IfcChimney', 'IfcSomethingNew']],
  ['IFC_SPACE', 2, ['IfcSpace']],
  ['IFC_SPACE_TEXT', 2, []],
];

test('every row of spec §4: the layer, its colour and its IFC types', () => {
  assert.deepEqual(LAYERS.map(l => l.name), SPEC.map(r => r[0]), 'the layers, in the spec order');
  for (const [name, aci, types] of SPEC) {
    assert.equal(ACI[name], aci, name);
    for (const t of types) assert.equal(layerOf(t), name, t);
  }
});

test('IFC4 standard cases go with their parent; the type name is matched in any case', () => {
  for (const [t, l] of [['IfcDoorStandardCase', 'IFC_DOOR'], ['IfcWindowStandardCase', 'IFC_WINDOW'], ['IfcColumnStandardCase', 'IFC_COLUMN'], ['IfcBeamStandardCase', 'IFC_BEAM'], ['IfcMemberStandardCase', 'IFC_BEAM'], ['IfcSlabStandardCase', 'IFC_SLAB'], ['IfcSlabElementedCase', 'IFC_SLAB'], ['IfcPlateStandardCase', 'IFC_CURTAINWALL'], ['IfcSystemFurnitureElement', 'IFC_FURNITURE']]) assert.equal(layerOf(t), l, t);
  assert.equal(layerOf('IFCWALLSTANDARDCASE'), 'IFC_WALL');
  assert.equal(layerOf('ifcdoor'), 'IFC_DOOR');
});

test('never drawn: openings, annotations, grids, the site and virtual elements', () => {
  for (const t of ['IfcOpeningElement', 'IfcOpeningStandardCase', 'IfcAnnotation', 'IfcGrid', 'IfcSite', 'IfcVirtualElement', 'IFCSITE']) assert.equal(layerOf(t), null, t);
});

test('a proxy under 1 mm thick in Z without a Body representation is a grid or level marker, and is dropped', () => {
  assert.equal(isMarkerProxy({ type: 'IfcBuildingElementProxy', zSpan: 0.0005, hasBody: false }), true);
  assert.equal(isMarkerProxy({ type: 'IfcBuildingElementProxy', zSpan: 0.0005, hasBody: true }), false, 'a Body: a real element, however thin');
  assert.equal(isMarkerProxy({ type: 'IfcBuildingElementProxy', zSpan: 0.002, hasBody: false }), false, 'thicker than 1 mm');
  assert.equal(isMarkerProxy({ type: 'IfcWall', zSpan: 0, hasBody: false }), false, 'only proxies');
  assert.equal(isMarkerProxy({ type: 'IFCBUILDINGELEMENTPROXY', zSpan: 0, hasBody: false }), true);
});

test('IFC2X3\'s IfcElectricDistributionPoint is MEP', () => {
  assert.equal(layerOf('IfcElectricDistributionPoint'), 'IFC_MEP');
});
