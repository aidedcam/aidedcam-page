import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTerm, termsFromStorage, sizeBucket, formatOf, unionKey } from '../../js/coverage/state.js';
import { DEFAULT_TERMS } from '../../js/coverage/rules.js';

test('a typed term: a comma or a point, spaces ignored; empty is "not typed"; the rest is refused', () => {
  assert.equal(parseTerm('0,8'), 0.8);
  assert.equal(parseTerm('0.8'), 0.8);
  assert.equal(parseTerm(' 11 '), 11);
  assert.equal(parseTerm(',5'), 0.5);
  assert.equal(parseTerm('3,'), 3);
  assert.equal(parseTerm(''), null);
  assert.equal(parseTerm(null), null);
  for (const bad of ['1.380,5', '1,380.5', '-1', 'abc', '1e3', '0,8,1']) assert.equal(parseTerm(bad), undefined, bad);
});

test('a typed term that reads as a thousands group ("1.380", "2,500") is refused, not read as 1.38 or 2.5', () => {
  for (const bad of ['1.380', '2,500', '0.800', '12.000', '999,999']) assert.equal(parseTerm(bad), undefined, bad);
  for (const [text, v] of [['3,5', 3.5], ['0,80', 0.8], ['11', 11], ['1380', 1380], [',5', 0.5], ['3,', 3], ['1.3800', 1.38], ['0,8000', 0.8]]) assert.equal(parseTerm(text), v, text);
});

test('stored terms: cleaned, with the defaults for anything missing or malformed', () => {
  assert.deepEqual(termsFromStorage(null), { ...DEFAULT_TERMS, storey: {} });
  assert.deepEqual(termsFromStorage('not json'), { ...DEFAULT_TERMS, storey: {} });
  const t = termsFromStorage(JSON.stringify({ sd: 0.8, sk: '60', hmax: -1, roofAllow: null, storey: { '00': 3.2, XX: 3, '01': 0 }, entrance: 'ATTIC', parking: 'yes' }));
  assert.equal(t.sd, 0.8);
  assert.equal(t.sk, null, 'a string is not a number');
  assert.equal(t.hmax, null, 'negative');
  assert.equal(t.roofAllow, null, 'cleared by the visitor');
  assert.deepEqual(t.storey, { '00': 3.2 });
  assert.equal(t.entrance, '00');
  assert.equal(t.parking, false);
});

test('GA parameters carry buckets and formats only; the union key follows the file and the outline set', () => {
  assert.equal(sizeBucket(1000), 'under-1mb');
  assert.equal(sizeBucket(2 << 20), '1-5mb');
  assert.equal(sizeBucket(10 << 20), 'over-5mb');
  assert.equal(formatOf({ name: 'a.DWG' }), 'dwg');
  assert.equal(formatOf({ name: 'x', result: { file: { format: 'dxf' } } }), 'dxf');
  assert.equal(unionKey(3, ['B', 'A']), unionKey(3, ['A', 'B']));
  assert.notEqual(unionKey(3, ['A']), unionKey(4, ['A']));
});
