import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storeyFileNames, safeName, stem, zipName } from '../../js/ifcplan/names.js';

test('storey files: "NN <storey name>.dxf" in level order, Greek names kept', () => {
  assert.deepEqual(storeyFileNames(['Ισόγειο', 'Όροφος 1'], 'Storey'), ['01 Ισόγειο.dxf', '02 Όροφος 1.dxf']);
  assert.equal(storeyFileNames(Array.from({ length: 120 }, (_, i) => `L${i}`), 'x')[119], '120 L119.dxf', 'NN widens past 99');
});

test('characters Windows forbids become _, and trailing dots and spaces go', () => {
  assert.equal(safeName('Level 1: "A/B" <x>|y?*', 'Storey'), 'Level 1_ _A_B_ _x__y__');
  assert.equal(safeName('  +3.20 ..  ', 'Storey'), '+3.20');
  assert.equal(safeName('a\tb\nc', 'Storey'), 'a b c');
  assert.equal(safeName('', 'Storey'), 'Storey');
  assert.equal(safeName('...', 'Όροφος'), 'Όροφος');
  assert.equal(safeName('x'.repeat(150), 'S').length, 100);
});

test('a storey name used twice is numbered, ignoring case; an empty one takes the fallback', () => {
  assert.deepEqual(storeyFileNames(['Level 1', 'level 1', 'LEVEL 1', ''], 'Storey'), ['01 Level 1.dxf', '02 level 1 (2).dxf', '03 LEVEL 1 (3).dxf', '04 Storey.dxf']);
});

test('the ZIP is named after the IFC', () => {
  assert.equal(stem('Σπίτι Α.ifc'), 'Σπίτι Α');
  assert.equal(stem('noext'), 'noext');
  assert.equal(zipName('Σπίτι Α.ifc'), 'Σπίτι Α-dxf.zip');
  assert.equal(zipName('a:b.ifc'), 'a_b-dxf.zip');
});
