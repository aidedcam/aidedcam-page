import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bathFit, BATH_DEFAULT } from '../../js/steel/bath.js';

test('the default bath is 12.6 × 1.3 × 1.8 m', () => {
  assert.deepEqual(BATH_DEFAULT, { length: 12.6, width: 1.3, depth: 1.8 });
});

test('fits: the length within the bath length, the cross dimensions within width and depth either way; edges inclusive', () => {
  assert.equal(bathFit([12600, 1300, 1800]), 'fits');
  assert.equal(bathFit([12600, 1800, 1300]), 'fits', 'turned');
  assert.equal(bathFit([4000, 190, 200]), 'fits');
  assert.equal(bathFit([300, 300, 20]), 'fits', 'a plate');
});

test('double dip: longer than the bath, at most twice its length, the cross dimensions fitting', () => {
  assert.equal(bathFit([12601, 100, 50]), 'double');
  assert.equal(bathFit([13500, 100, 50]), 'double');
  assert.equal(bathFit([25200, 100, 50]), 'double');
  assert.equal(bathFit([25201, 100, 50]), 'no');
});

test('doesn\'t fit: a cross dimension too large in every orientation', () => {
  assert.equal(bathFit([6000, 1301, 1801]), 'no');
  assert.equal(bathFit([6000, 1900, 1000]), 'no');
  assert.equal(bathFit([2000, 1700, 1200]), 'fits', 'any orientation: 2.0 along the bath, 1.7 deep, 1.2 wide');
  assert.equal(bathFit([1900, 1750, 1250]), 'fits', 'the longest side along the bath, the next one deep');
  assert.equal(bathFit([1900, 1850, 1250]), 'no', 'only 1.25 fits the width, and neither other side the depth');
});

test('another bath, and empty dimensions', () => {
  const small = { length: 7, width: 1.2, depth: 2.5 };
  assert.equal(bathFit([7000, 1000, 1000], small), 'fits');
  assert.equal(bathFit([13000, 1000, 1000], small), 'double');
  assert.equal(bathFit([15000, 1000, 1000], small), 'no');
  assert.equal(bathFit([4000, NaN, 0]), 'fits');
});
