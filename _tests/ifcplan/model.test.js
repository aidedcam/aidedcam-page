import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sniff, prepare, cutModel, MAX_BYTES, LARGE_BYTES } from '../../js/ifcplan/model.js';
import { forEachPolyline } from '../../js/ifcplan/chain.js';
import { inside } from '../../js/ifcplan/rooms.js';
import { storeyDxf, originShift } from '../../js/ifcplan/dxf.js';
import { openApi } from './webifc-node.mjs';
import { smallModel, E } from './step.mjs';
import { readDxf } from './dxf-read.mjs';

const EXAMPLE = readFileSync(new URL('../../js/ifcplan/examples/example-house.ifc', import.meta.url));
const enc = s => new TextEncoder().encode(s);
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

let api, W;
async function read(bytes, cutM = 1.1) {
  if (!api) ({ api, W } = await openApi());
  const id = api.OpenModel(bytes instanceof Uint8Array ? bytes : enc(bytes), { COORDINATE_TO_ORIGIN: false });
  assert.ok(id >= 0, 'web-ifc opens it');
  const prep = prepare(api, W, id);
  const r = cutModel(api, W, id, prep, cutM);
  return { ...r, recut: c => cutModel(api, W, id, prep, c), close: () => api.CloseModel(id) };
}
// Per layer: closed and open polylines, e.g. { IFC_WALL: '7/0' }.
function counts(storey) {
  const out = {};
  for (const [name, set] of Object.entries(storey.layers)) {
    let c = 0, o = 0;
    forEachPolyline(set, (p, closed) => { if (closed) c++; else o++; });
    out[name] = `${c}/${o}`;
  }
  return out;
}
function loops(storey, layer) {
  const out = [];
  forEachPolyline(storey.layers[layer], (p, closed) => out.push({ pts: [...p], closed }));
  return out;
}
// A closed loop as its sorted corners, rounded to 0.1 mm.
const corners = pts => { const c = []; for (let i = 0; i < pts.length; i += 2) c.push([+pts[i].toFixed(4), +pts[i + 1].toFixed(4)]); return c.sort((a, b) => a[0] - b[0] || a[1] - b[1]); };

test('sniff: STEP text names its schema; ifcZIP, ifcXML and other files are refused as unreadable', () => {
  assert.deepEqual(sniff(EXAMPLE), { ok: true, schema: 'IFC4' });
  assert.deepEqual(sniff(enc("﻿  ISO-10303-21;\nHEADER;\nFILE_SCHEMA (( 'ifc2x3' ));")), { ok: true, schema: 'IFC2X3' });
  assert.deepEqual(sniff(Uint8Array.of(0x50, 0x4b, 3, 4, 0, 0)), { ok: false, reason: 'read', detail: 'ifczip' });
  assert.deepEqual(sniff(enc('<?xml version="1.0"?><ifcXML/>')), { ok: false, reason: 'read', detail: 'ifcxml' });
  assert.deepEqual(sniff(enc('0\nSECTION\n2\nHEADER')), { ok: false, reason: 'read', detail: 'not-ifc' });
  assert.deepEqual([MAX_BYTES, LARGE_BYTES], [150 * 1024 * 1024, 50 * 1024 * 1024]);
});

test('the example end to end: two storeys at 0.00 and 3.00, the layers of each plan, the rooms and their labels', async () => {
  const r = await read(EXAMPLE);
  assert.deepEqual({ ...r.file, bbox: null }, { schema: 'IFC4', app: 'AidedCAM example generator', unitM: 0.001, products: 19, rooms: 3, bbox: null, noStoreys: false, noGeometry: [] });
  assert.deepEqual(Object.values(r.file.bbox).map(v => +v.toFixed(6)), [120.5, 80.25, -0.25, 130.5, 88.35, 6]);
  assert.deepEqual(originShift(r.file.bbox), { x: 120, y: 80 });
  assert.deepEqual(r.storeys.map(s => [s.name, s.levelM, +s.cutZ.toFixed(6), s.cut]), [['Ισόγειο', 0, 1.1, 9], ['Όροφος 1', 3, 4.1, 7]]);
  const [g, f1] = r.storeys;
  assert.deepEqual(counts(g), { IFC_COLUMN: '1/0', IFC_WALL: '7/0', IFC_STAIR: '1/0', IFC_WINDOW: '1/0', IFC_DOOR: '1/0', IFC_SPACE: '2/0' });
  assert.deepEqual(counts(f1), { IFC_WALL: '6/0', IFC_RAILING: '1/0', IFC_WINDOW: '1/0', IFC_SPACE: '1/0' });
  assert.deepEqual(g.rooms.map(x => [x.name, x.longName, +x.areaM2.toFixed(6), x.areaFrom, x.crossed]), [['Σαλόνι', '', 43.61, 'qto', true], ['Κουζίνα', '', 27.74, 'outline', true]]);
  assert.deepEqual(f1.rooms.map(x => [x.name, x.longName, +x.areaM2.toFixed(6), x.areaFrom]), [['1.01', 'Υπνοδωμάτιο', 36.1, 'outline']]);
  for (const room of [...g.rooms, ...f1.rooms]) assert.ok(inside(room.at[0], room.at[1], room.outline), `${room.name} label inside its outline`);
  assert.deepEqual(g.noGeometry, []);
  r.close();
});

test('the example geometry, to 0.1 mm: the column, the stair cut on its slope, the door and the wall split by it', async () => {
  const r = await read(EXAMPLE);
  const [g] = r.storeys;
  assert.deepEqual(corners(loops(g, 'IFC_COLUMN')[0].pts), [[123.4, 86.05], [123.4, 86.35], [123.7, 86.05], [123.7, 86.35]]);
  assert.deepEqual(corners(loops(g, 'IFC_STAIR')[0].pts), [[129.2, 83.2167], [129.2, 83.6167], [130.1, 83.2167], [130.1, 83.6167]]);
  assert.deepEqual(corners(loops(g, 'IFC_DOOR')[0].pts), [[122.5, 80.35], [122.5, 80.4], [123.4, 80.35], [123.4, 80.4]]);
  const south = loops(g, 'IFC_WALL').map(l => corners(l.pts)).filter(c => c[0][1] === 80.25).sort((a, b) => a[0][0] - b[0][0]);
  assert.deepEqual(south, [[[120.5, 80.25], [120.5, 80.5], [122.5, 80.25], [122.5, 80.5]], [[123.4, 80.25], [123.4, 80.5], [130.5, 80.25], [130.5, 80.5]]]);
  r.close();
});

test('a re-cut on the open model: at 2.20 m the door and windows fall below the cut, at 0.00 m the plan looks just above the floor', async () => {
  const r = await read(EXAMPLE);
  const high = r.recut(2.2);
  assert.deepEqual(high.storeys.map(counts), [
    { IFC_COLUMN: '1/0', IFC_WALL: '5/0', IFC_STAIR: '1/0', IFC_SPACE: '2/0' },
    { IFC_WALL: '5/0', IFC_SPACE: '1/0' },
  ]);
  assert.deepEqual(high.storeys.map(s => +s.cutZ.toFixed(6)), [2.2, 5.2]);
  const floor = r.recut(0);
  assert.deepEqual(floor.storeys.map(counts)[0], { IFC_COLUMN: '1/0', IFC_WALL: '6/0', IFC_STAIR: '1/0', IFC_DOOR: '1/0', IFC_SPACE: '2/0' }, 'the door splits its wall; the window, from 0.90 m, does not');
  r.close();
});

test('the example plans as DXF: they parse back, in mm, with the Greek labels and the shift', async () => {
  const r = await read(EXAMPLE);
  const shift = originShift(r.file.bbox);
  const d = readDxf(storeyDxf({ storey: r.storeys[0], source: 'example-house.ifc', cutM: 1.1, units: 'mm', shift }).bytes);
  assert.equal(d.header.$INSUNITS, '4');
  const by = {};
  for (const e of d.entities) by[`${e.type} ${e.layer}`] = (by[`${e.type} ${e.layer}`] || 0) + 1;
  assert.deepEqual(by, { 'POLYLINE IFC_WALL': 7, 'POLYLINE IFC_DOOR': 1, 'POLYLINE IFC_WINDOW': 1, 'POLYLINE IFC_COLUMN': 1, 'POLYLINE IFC_STAIR': 1, 'POLYLINE IFC_SPACE': 2, 'TEXT IFC_SPACE_TEXT': 4 });
  assert.deepEqual(d.entities.filter(e => e.type === 'TEXT').map(e => e.text), ['Σαλόνι', '43.61 m²', 'Κουζίνα', '27.74 m²']);
  assert.deepEqual(d.header.$EXTMIN.map(v => +v.toFixed(3)), [500, 250, 0]);
  assert.ok(d.comments.includes("Shift: X -120000 mm, Y -80000 mm; add it back to return to the IFC's coordinates"));
  const up = readDxf(storeyDxf({ storey: r.storeys[1], source: 'example-house.ifc', cutM: 1.1, units: 'm' }).bytes);
  assert.deepEqual(up.entities.filter(e => e.type === 'TEXT').map(e => e.text), ['1.01', 'Υπνοδωμάτιο', '36.10 m²']);
  r.close();
});

test('units: feet and centimetres are read from the project, and the plans come out in metres', async () => {
  const ft = await read(smallModel({ length: { foot: true }, storeys: [{ name: 'L1', z: 0 }, { name: 'L2', z: 10 }], elements: [{ storey: 1, box: [0, 0, 0, 10, 1, 9] }] }));
  assert.equal(ft.file.unitM, 0.3048);
  assert.deepEqual(ft.storeys.map(s => +s.levelM.toFixed(6)), [0, 3.048]);
  assert.deepEqual(corners(loops(ft.storeys[1], 'IFC_WALL')[0].pts), [[0, 0], [0, 0.3048], [3.048, 0], [3.048, 0.3048]]);
  ft.close();
  const cm = await read(smallModel({ length: { prefix: 'CENTI' }, storeys: [{ name: 'L1', z: 280 }], elements: [{ storey: 0, box: [0, 0, 0, 500, 20, 280] }] }));
  assert.equal(cm.file.unitM, 0.01);
  assert.deepEqual(cm.storeys.map(s => [+s.levelM.toFixed(6), +s.cutZ.toFixed(6)]), [[2.8, 3.9]]);
  assert.deepEqual(counts(cm.storeys[0]), { IFC_WALL: '1/0' });
  cm.close();
});

test('a storey\'s level is the world Z of its placement, not its Elevation (a building placed 100 m up)', async () => {
  const r = await read(smallModel({ buildingZ: 100000, storeys: [{ name: 'Ground', z: 0, elevation: 0 }, { name: 'First', z: 3000, elevation: 3000 }], elements: [{ storey: 0, box: [0, 0, 0, 1000, 200, 3000] }] }));
  assert.deepEqual(r.storeys.map(s => [s.name, s.levelM]), [['Ground', 100], ['First', 103]]);
  assert.deepEqual(counts(r.storeys[0]), { IFC_WALL: '1/0' });
  r.close();
});

test('no storeys: one plan of everything, cut at 1.10 m above zero', async () => {
  const r = await read(smallModel({ elements: [{ storey: -1, box: [0, 0, 0, 1000, 200, 3000] }] }));
  assert.equal(r.file.noStoreys, true);
  assert.deepEqual(r.storeys.map(s => [s.name, s.levelM, s.cut, counts(s)]), [['', 0, 1, { IFC_WALL: '1/0' }]]);
  r.close();
});

test('an element web-ifc cannot mesh is reported by type and storey; a thin proxy without a Body is a marker', async () => {
  const empty = (m, add) => add('IFCBOOLEANCLIPPINGRESULT', E('DIFFERENCE'), m.boxSolid(1000, 100, 3000), m.boxSolid(1000, 100, 3000));
  const r = await read(smallModel({
    storeys: [{ name: 'S', z: 0 }],
    elements: [
      { storey: 0, box: [0, 0, 0, 1000, 100, 3000] },
      { storey: 0, box: [0, 0, 0, 1000, 100, 3000], solid: empty },
      { storey: 0, type: 'IFCBUILDINGELEMENTPROXY', box: [0, 2000, 1099.8, 500, 2500, 1100.3], ident: 'Annotation' },
      { storey: 0, type: 'IFCBUILDINGELEMENTPROXY', box: [0, 3000, 1099.8, 500, 3500, 1100.3] },
    ],
  }));
  assert.deepEqual(r.storeys[0].noGeometry, [{ type: 'IfcWall', count: 1 }]);
  assert.deepEqual(r.file.noGeometry, [{ type: 'IfcWall', count: 1 }]);
  assert.deepEqual(counts(r.storeys[0]), { IFC_WALL: '1/0', IFC_OTHER: '1/0' }, 'the proxy with a Body is drawn, the marker is not');
  assert.equal(r.file.products, 2);
  r.close();
});

test('non-finite vertices from web-ifc: the bounding box, the shift and the DXF stay finite', async () => {
  const { api: real, W: w } = await openApi();
  let n = 0;
  const bad = new Proxy(real, { get: (t, k) => (k === 'GetVertexArray'
    ? (...a) => { const v = t.GetVertexArray(...a).slice(); if (n++ === 0) { v[0] = NaN; v[7] = Infinity; } return v; }
    : typeof t[k] === 'function' ? t[k].bind(t) : t[k]) });
  const id = bad.OpenModel(enc(smallModel({ storeys: [{ name: 'S', z: 0 }], elements: [{ storey: 0, box: [0, 0, 0, 4000, 200, 3000] }, { storey: 0, box: [0, 2000, 0, 4000, 2200, 3000] }] })), { COORDINATE_TO_ORIGIN: false });
  const r = cutModel(bad, w, id, prepare(bad, w, id), 1.1);
  assert.ok(n >= 2, 'both walls meshed');
  assert.ok(Object.values(r.file.bbox).every(Number.isFinite), JSON.stringify(r.file.bbox));
  const shift = originShift(r.file.bbox);
  assert.ok(Number.isFinite(shift.x) && Number.isFinite(shift.y));
  const out = storeyDxf({ storey: r.storeys[0], source: 'x.ifc', cutM: 1.1, units: 'mm', shift });
  assert.ok(!/NaN|Infinity/.test(new TextDecoder('latin1').decode(out.bytes)));
  const d = readDxf(out.bytes);
  assert.ok(d.entities.length > 0);
  for (const e of d.entities) assert.ok(e.pts.every(Number.isFinite), JSON.stringify(e));
  assert.ok([...d.header.$EXTMIN, ...d.header.$EXTMAX].every(Number.isFinite));
  real.CloseModel(id);
});
