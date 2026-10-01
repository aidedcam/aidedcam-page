import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storeyDxf, cp1253, unencodable, originShift, num, UNITS, CP1253_HIGH } from '../../js/ifcplan/dxf.js';
import { polylineSet } from '../../js/ifcplan/chain.js';
import { readDxf } from './dxf-read.mjs';

function storey() {
  const walls = polylineSet();
  walls.add([120.5, 80.25, 130.5, 80.25, 130.5, 80.5, 120.5, 80.5], true);
  const door = polylineSet();
  door.add([122, 80.35, 122.9, 80.35], false);
  return {
    name: 'Ισόγειο', levelM: 0,
    layers: { IFC_WALL: walls.pack(), IFC_DOOR: door.pack(), IFC_WINDOW: polylineSet().pack() },
    rooms: [{ name: 'Σαλόνι', longName: '', areaM2: 43.61, at: [123, 84] }],
  };
}
const write = (opts = {}) => storeyDxf({ storey: storey(), source: 'example-house.ifc', cutM: 1.1, units: 'm', ...opts });

test('the R12 structure parses back: header, layer table, polylines, text', () => {
  const { bytes, replaced } = write();
  assert.equal(replaced, 0);
  const d = readDxf(bytes);
  assert.ok(d.crlf && d.padded, 'CRLF and 3-character group codes');
  assert.deepEqual(d.sections, ['HEADER', 'TABLES', 'ENTITIES']);
  assert.equal(d.header.$ACADVER, 'AC1009');
  assert.equal(d.header.$DWGCODEPAGE, 'ANSI_1253');
  assert.deepEqual(d.layers.map(l => [l.name, l.color]), [['0', 7], ['IFC_WALL', 7], ['IFC_DOOR', 4], ['IFC_WINDOW', 5], ['IFC_COLUMN', 1], ['IFC_BEAM', 8], ['IFC_SLAB', 9], ['IFC_STAIR', 3], ['IFC_RAILING', 30], ['IFC_CURTAINWALL', 140], ['IFC_FURNITURE', 40], ['IFC_MEP', 6], ['IFC_OTHER', 8], ['IFC_SPACE', 2], ['IFC_SPACE_TEXT', 2]]);
  assert.deepEqual(d.entities.map(e => [e.type, e.layer, e.closed]), [['POLYLINE', 'IFC_WALL', true], ['POLYLINE', 'IFC_DOOR', false], ['TEXT', 'IFC_SPACE_TEXT', undefined], ['TEXT', 'IFC_SPACE_TEXT', undefined]]);
  assert.deepEqual(d.entities[0].pts, [120.5, 80.25, 130.5, 80.25, 130.5, 80.5, 120.5, 80.5]);
  assert.deepEqual(d.header.$EXTMIN, [120.5, 80.25, 0]);
  assert.deepEqual(d.header.$EXTMAX, [130.5, 84.16, 0]);
  const [a, b] = d.entities.slice(2);
  assert.deepEqual([a.text, a.x, a.y, a.h, a.h72, a.v73, a.ax, a.ay], ['Σαλόνι', 123, 84.16, 0.2, 1, 2, 123, 84.16]);
  assert.deepEqual([b.text, b.y], ['43.61 m²', 83.84]);
});

test('$INSUNITS is 6, 5 and 4 for m, cm and mm, with the coordinates and the text height scaled', () => {
  for (const [units, code, k] of [['m', '6', 1], ['cm', '5', 100], ['mm', '4', 1000]]) {
    const d = readDxf(write({ units }).bytes);
    assert.equal(d.header.$INSUNITS, code, units);
    assert.equal(UNITS[units].factor, k);
    assert.deepEqual(d.entities[0].pts.slice(0, 2), [num(120.5 * k), num(80.25 * k)].map(Number), units);
    assert.equal(d.entities[2].h, 0.2 * k, units);
    assert.ok(d.comments.includes(`Units: ${units}`));
  }
});

test('Greek text round-trips through Windows-1253; a character outside it becomes ? and is counted', () => {
  for (let b = 0x80; b <= 0xff; b++) {
    const c = CP1253_HIGH[b - 0x80];
    if (c !== '�') assert.equal(new TextDecoder('windows-1253').decode(Uint8Array.of(b)), c, b.toString(16));
  }
  const all = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρσςτυφχψωάέήίόύώΆΈΉΊΌΎΏϊϋΐΰ m² €';
  const { bytes, replaced } = cp1253(all);
  assert.equal(replaced, 0);
  assert.equal(new TextDecoder('windows-1253').decode(bytes), all);
  assert.deepEqual([...cp1253('Ω−ŝ✓').bytes], [0xd9, 0x3f, 0x3f, 0x3f]);
  assert.equal(cp1253('Ω−ŝ✓').replaced, 3);
  assert.equal(unencodable(['Σαλόνι', 'Hall − 2', null, 'Küche']), 2);
  const s = storey();
  s.rooms[0].name = 'Σαλόνι ✓';
  const out = storeyDxf({ storey: s, source: 'σπίτι.ifc', cutM: 1.1 });
  assert.equal(out.replaced, 1);
  const d = readDxf(out.bytes);
  assert.equal(d.entities[2].text, 'Σαλόνι ?');
  assert.ok(d.comments.includes('Source: σπίτι.ifc'));
});

test('the comment block names the file, the storey, the cut, the units and the shift', () => {
  const shift = originShift({ x0: 120.5, y0: 80.25, x1: 131, y1: 90 });
  assert.deepEqual(shift, { x: 120, y: 80 });
  assert.deepEqual(originShift({ x0: -0.5, y0: 3, x1: 1, y1: 4 }), { x: -1, y: 3 }, 'rounded down, also below zero');
  const d = readDxf(write({ units: 'mm', shift }).bytes);
  assert.deepEqual(d.comments, [
    'IFC floor plan from aidedcam.com/ifc-plans.html',
    'Source: example-house.ifc',
    'Storey: Ισόγειο, level 0.000 m',
    'Cut: 1.10 m above the storey level, at 1.100 m',
    'Units: mm',
    "Shift: X -120000 mm, Y -80000 mm; add it back to return to the IFC's coordinates",
  ]);
  assert.deepEqual(d.entities[0].pts.slice(0, 4), [500, 250, 10500, 250]);
  assert.equal(readDxf(write().bytes).comments[5], "Shift: none; the IFC's coordinates");
});

test('an empty layer or an empty storey still gives a whole file, with no POLYLINE or TEXT left open', () => {
  const s = { name: 'Δώμα', levelM: 9, layers: { IFC_WALL: polylineSet().pack() }, rooms: [] };
  const d = readDxf(storeyDxf({ storey: s, source: 'x.ifc', cutM: 1.1 }).bytes);
  assert.deepEqual(d.sections, ['HEADER', 'TABLES', 'ENTITIES']);
  assert.deepEqual(d.entities, []);
  assert.deepEqual([d.header.$EXTMIN, d.header.$EXTMAX], [[0, 0, 0], [0, 0, 0]]);
  const one = polylineSet();
  one.add([1, 1], false);
  const e = readDxf(storeyDxf({ storey: { name: 'x', levelM: 0, layers: { IFC_WALL: one.pack() }, rooms: [{ name: 'A', areaM2: null, at: null }] }, source: 'x.ifc', cutM: 1.1 }).bytes);
  assert.deepEqual(e.entities, [], 'a one-point polyline and a room without a label point are skipped');
});

test('numbers: at most 6 decimals, always a decimal point, never -0', () => {
  assert.deepEqual([num(1), num(-0), num(0.1 + 0.2), num(538512000), num(-1.23456789), num(1e-9)], ['1.0', '0.0', '0.3', '538512000.0', '-1.234568', '0.0']);
});

test('numbers: NaN and Infinity are never written', () => {
  assert.deepEqual([num(NaN), num(Infinity), num(-Infinity)], ['0.0', '0.0', '0.0']);
});

test('Greek in decomposed form (NFD) or with the polytonic acute is composed first, so it is encodable', () => {
  const nfd = 'Σαλόνι'.normalize('NFD');
  assert.notEqual(nfd, 'Σαλόνι');
  assert.deepEqual(cp1253(nfd), cp1253('Σαλόνι'));
  assert.deepEqual([...cp1253('ά').bytes], [0xdc], 'U+1F71 is ά (U+03AC)');
  assert.equal(cp1253('ά').replaced, 0);
  assert.equal(unencodable([nfd, 'ά', 'Κουζίνα'.normalize('NFD')]), 0);
});
