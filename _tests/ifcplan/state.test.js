import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanSettings, parseCut, showM, sizeBucket, storeysBucket, warningsOf, textsOf, DEFAULTS, SETTINGS_KEY } from '../../js/ifcplan/state.js';

const result = over => ({
  file: { noStoreys: false, noGeometry: [], bbox: { x0: 120.5, y0: 80.25, x1: 130.5, y1: 88.35 }, ...over },
  storeys: [
    { name: 'Ισόγειο', rooms: [{ name: 'Σαλόνι', longName: '', areaM2: 43.61, crossed: true }] },
    { name: 'Όροφος 1', rooms: [{ name: '1.01', longName: 'Υπνοδωμάτιο', areaM2: 36.1, crossed: true }] },
  ],
});

test('settings: the defaults of spec §2, and only well-formed stored values are kept', () => {
  assert.equal(SETTINGS_KEY, 'aidedcam-ifcp-settings');
  assert.deepEqual(DEFAULTS, { cutM: 1.1, units: 'm', origin: false });
  assert.deepEqual(cleanSettings(null), DEFAULTS);
  assert.deepEqual(cleanSettings({ cutM: 0.9, units: 'mm', origin: true }), { cutM: 0.9, units: 'mm', origin: true });
  assert.deepEqual(cleanSettings({ cutM: -1, units: 'ft', origin: 'yes' }), DEFAULTS);
  assert.deepEqual(cleanSettings({ cutM: '1.5', units: 'toString' }), DEFAULTS);
});

test('the cut height: a comma or a point, from 0 to 10 m; anything else is refused, never guessed', () => {
  assert.deepEqual(['1,10', '1.10', '0', ' 2.5 ', '10'].map(parseCut), [1.1, 1.1, 0, 2.5, 10]);
  assert.deepEqual(['', '1,100.5', '1.380,5', '-1', '1e2', '10.01', 'abc', ',5'].map(parseCut), Array(8).fill(undefined));
  assert.deepEqual([showM(1.1, 'el'), showM(1.1, 'en'), showM(0, 'it')], ['1,10', '1.10', '0,00']);
});

test('GA buckets: sizes and storey counts, never the figures', () => {
  assert.deepEqual([0, 10 * 1024 * 1024 - 1, 10 * 1024 * 1024, 50 * 1024 * 1024, 50 * 1024 * 1024 + 1].map(sizeBucket), ['under-10mb', 'under-10mb', '10-50mb', '10-50mb', 'over-50mb']);
  assert.deepEqual([1, 2, 5, 6, 20, 21].map(storeysBucket), ['1', '2-5', '2-5', '6-20', '6-20', 'over-20']);
});

test('warnings: none on a clean model; missing geometry by type, far coordinates, no storeys, low rooms, code page', () => {
  assert.deepEqual(warningsOf(result(), { fileName: 'σπίτι.ifc', cutM: 1.1, origin: false }), []);
  const r = result({ noStoreys: true, noGeometry: [{ type: 'IfcWallStandardCase', count: 51 }, { type: 'IfcBuildingElementProxy', count: 14 }], bbox: { x0: 538450.5, y0: 6591584.1, x1: 538511, y1: 6591628.1 } });
  r.storeys[0].rooms.push({ name: 'Hall ✓', longName: '', areaM2: null, crossed: false });
  assert.deepEqual(warningsOf(r, { fileName: 'Küche−1.ifc', cutM: 1.1, origin: false }), [
    { id: 'nostoreys', params: { h: 1.1 } },
    { id: 'nogeometry', params: { n: 65, types: 'IfcWallStandardCase 51, IfcBuildingElementProxy 14' } },
    { id: 'far', params: { km: 6592 } },
    { id: 'lowrooms', params: { n: 1 } },
    { id: 'cp1253', params: { n: 3 } },
  ]);
  assert.ok(!warningsOf(r, { fileName: 'x.ifc', cutM: 1.1, origin: true }).some(w => w.id === 'far'), 'not once the plans are moved');
  assert.deepEqual(textsOf(result(), 'a.ifc'), ['a.ifc', 'Ισόγειο', 'Σαλόνι', '43.61 m²', 'Όροφος 1', '1.01', 'Υπνοδωμάτιο', '36.10 m²']);
});

test('storeys at one level (within 1 mm): a warning naming each shared level', () => {
  const at = levels => ({ file: { noStoreys: false, noGeometry: [], bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } }, storeys: levels.map((levelM, i) => ({ name: `S${i}`, levelM, rooms: [] })) });
  const opts = { fileName: 'a.ifc', cutM: 1.1, origin: false };
  assert.deepEqual(warningsOf(at([0, 3, 3.0004, 6, 6, 6, 9]), opts), [{ id: 'samelevel', params: { levels: [3, 6] } }]);
  assert.deepEqual(warningsOf(at([0, 0.0011, 3, 6]), opts), [], 'over 1 mm apart');
  assert.deepEqual(warningsOf(at([0]), opts), []);
  const r = at([0, 0]);
  r.file.noGeometry = [{ type: 'IfcWall', count: 1 }];
  assert.deepEqual(warningsOf(r, opts).map(w => w.id), ['samelevel', 'nogeometry']);
});
