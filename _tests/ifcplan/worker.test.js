import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSession, DEFAULT_CUT_M } from '../../js/ifcplan/worker.js';
import { MAX_BYTES } from '../../js/ifcplan/model.js';
import { openApi } from './webifc-node.mjs';
import { smallModel } from './step.mjs';

const EXAMPLE = readFileSync(new URL('../../js/ifcplan/examples/example-house.ifc', import.meta.url));
const buf = b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const text = s => buf(new TextEncoder().encode(s));
const file = (id, bytes, cutM = 1.1, name = 'example-house.ifc') => ({ type: 'process', id, name, bytes, settings: { cutM } });
const recut = (id, cutM) => ({ type: 'process', id, name: 'recut', bytes: new ArrayBuffer(0), settings: { cutM, recut: true } });
const mesh3d = (id, maxTriangles) => ({ type: 'process', id, name: 'mesh3d', bytes: new ArrayBuffer(0), settings: { mesh3d: true, maxTriangles } });

test('a file: the result of spec §3, its buffers listed for transfer', async () => {
  const s = createSession(openApi);
  const { reply, transfer } = await s.process(file(1, buf(EXAMPLE)));
  assert.equal(reply.type, 'result');
  assert.deepEqual([reply.id, reply.name, reply.recut, reply.cutM], [1, 'example-house.ifc', false, 1.1]);
  assert.deepEqual([reply.file.schema, reply.file.products, reply.storeys.length], ['IFC4', 19, 2]);
  assert.ok(transfer.length > 0 && transfer.every(b => b instanceof ArrayBuffer));
  assert.ok(transfer.includes(reply.storeys[0].layers.IFC_WALL.xy.buffer));
  assert.equal(DEFAULT_CUT_M, 1.1);
});

test('a re-cut reuses the open model: no bytes, a new height', async () => {
  const s = createSession(openApi);
  await s.process(file(1, buf(EXAMPLE)));
  const { reply } = await s.process(recut(2, 2.2));
  assert.deepEqual([reply.type, reply.id, reply.name, reply.recut, reply.cutM], ['result', 2, 'example-house.ifc', true, 2.2]);
  assert.deepEqual(reply.storeys.map(st => +st.cutZ.toFixed(6)), [2.2, 5.2]);
  assert.equal(reply.storeys[0].layers.IFC_DOOR, undefined, 'the door is below 2.20 m');
});

test('a re-cut with no open model is stale: after a restart, or once a later file failed', async () => {
  const s = createSession(openApi);
  assert.deepEqual((await s.process(recut(1, 1.1))).reply, { type: 'error', id: 1, reason: 'stale', detail: '' });
  await s.process(file(2, buf(EXAMPLE)));
  assert.equal((await s.process(file(3, text('not an IFC')))).reply.reason, 'read');
  assert.equal((await s.process(recut(4, 1.1))).reply.reason, 'stale');
});

test('errors: read (with what the file is), schema (with the schema found), limit, empty', async () => {
  const s = createSession(openApi);
  const reasons = async m => { const { reply } = await s.process(m); return [reply.type, reply.reason, reply.detail]; };
  assert.deepEqual(await reasons(file(1, text('0\nSECTION\n'))), ['error', 'read', 'not-ifc']);
  assert.deepEqual(await reasons(file(2, buf(Uint8Array.of(0x50, 0x4b, 3, 4, 20, 0)))), ['error', 'read', 'ifczip']);
  assert.deepEqual(await reasons(file(3, text('<?xml version="1.0"?>'))), ['error', 'read', 'ifcxml']);
  const ifc9 = new TextDecoder().decode(EXAMPLE).replace("FILE_SCHEMA(('IFC4'))", "FILE_SCHEMA(('IFC9'))");
  assert.deepEqual(await reasons(file(4, text(ifc9))), ['error', 'schema', 'IFC9']);
  assert.deepEqual(await reasons(file(5, { byteLength: MAX_BYTES + 1 })), ['error', 'limit', '']);
  assert.deepEqual(await reasons(file(6, text(smallModel({ storeys: [{ name: 'S', z: 0 }] })))), ['error', 'empty', '']);
});

test('a crash inside web-ifc is an engine error, and the open model is dropped', async () => {
  const s = createSession(async () => {
    const { api, W } = await openApi();
    let n = 0;
    return { W, api: new Proxy(api, { get: (t, k) => (k === 'StreamAllMeshes' && n++ > 0 ? () => { throw new Error('Aborted(OOM)'); } : typeof t[k] === 'function' ? t[k].bind(t) : t[k]) }) };
  });
  assert.equal((await s.process(file(1, buf(EXAMPLE)))).reply.type, 'result');
  assert.deepEqual((await s.process(recut(2, 2))).reply, { type: 'error', id: 2, reason: 'engine', detail: 'Aborted(OOM)' });
  assert.equal((await s.process(recut(3, 2))).reply.reason, 'stale');
});

test('web-ifc refusing a schema it supports is a read error, not a schema error', async () => {
  const refusing = async () => {
    const { api, W } = await openApi();
    return { W, api: new Proxy(api, { get: (t, k) => (k === 'OpenModel' ? () => -1 : typeof t[k] === 'function' ? t[k].bind(t) : t[k]) }) };
  };
  const s = createSession(refusing);
  const reasons = async m => { const { reply } = await s.process(m); return [reply.type, reply.reason, reply.detail]; };
  assert.deepEqual(await reasons(file(1, buf(EXAMPLE))), ['error', 'read', '']);
  const src = new TextDecoder().decode(EXAMPLE);
  for (const schema of ['IFC2X3', 'IFC4X3', 'IFC4X3_ADD2']) assert.deepEqual(await reasons(file(2, text(src.replace("FILE_SCHEMA(('IFC4'))", `FILE_SCHEMA(('${schema}'))`)))), ['error', 'read', ''], schema);
  assert.deepEqual(await reasons(file(3, text(src.replace("FILE_SCHEMA(('IFC4'))", "FILE_SCHEMA(('IFC9'))")))), ['error', 'schema', 'IFC9']);
});

test('mesh3d on the example: every element the plans draw, per layer, relative to the model lower corner', async () => {
  const s = createSession(openApi);
  const first = await s.process(file(1, buf(EXAMPLE)));
  const { reply, transfer } = await s.process(mesh3d(2, 2000000));
  assert.deepEqual([reply.type, reply.id, reply.name], ['result', 2, 'example-house.ifc']);
  const m = reply.mesh3d;
  const b = first.reply.file.bbox;
  assert.deepEqual(m.origin, [b.x0, b.y0, b.z0]);
  assert.deepEqual(m.origin, [120.5, 80.25, -0.25]);
  assert.equal(m.triangles, 340);
  const tris = Object.fromEntries(Object.entries(m.layers).map(([k, L]) => [k, L.index.length / 3]));
  assert.deepEqual(tris, { IFC_SLAB: 56, IFC_COLUMN: 12, IFC_WALL: 176, IFC_STAIR: 12, IFC_RAILING: 12, IFC_WINDOW: 24, IFC_DOOR: 12, IFC_SPACE: 36 });
  const count = {};
  for (const e of m.elements) count[e.layer] = (count[e.layer] || 0) + 1;
  assert.deepEqual(count, { IFC_SLAB: 3, IFC_COLUMN: 1, IFC_WALL: 10, IFC_STAIR: 1, IFC_RAILING: 1, IFC_WINDOW: 2, IFC_DOOR: 1, IFC_SPACE: 3 });
  assert.deepEqual(m.elements.find(e => e.type === 'IfcDoor'), { type: 'IfcDoor', layer: 'IFC_DOOR', name: 'Πόρτα εισόδου', storey: 0 });
  assert.deepEqual(m.elements.filter(e => e.layer === 'IFC_SPACE').map(e => [e.type, e.name, e.storey]), [['IfcSpace', 'Σαλόνι', 0], ['IfcSpace', 'Κουζίνα', 0], ['IfcSpace', '1.01', 1]]);
  let top = 0;
  for (const L of Object.values(m.layers)) for (let i = 2; i < L.position.length; i += 3) top = Math.max(top, L.position[i]);
  assert.ok(Math.abs(top - 6.25) < 1e-5, `the roof top, 6.25 m above the slab's underside: ${top}`);
  assert.equal(transfer.length, 3 * Object.keys(m.layers).length);
  const again = await s.process(recut(3, 2.2));
  assert.equal(again.reply.recut, true, 'the model stays open for a re-cut');
});

test('mesh3d: stale before any file, "large" over the cap (with the count), and the cap left out means no cap', async () => {
  const s = createSession(openApi);
  assert.deepEqual((await s.process(mesh3d(1, 2000000))).reply, { type: 'error', id: 1, reason: 'stale', detail: '' });
  await s.process(file(2, buf(EXAMPLE)));
  const { reply, transfer } = await s.process(mesh3d(3, 10));
  assert.deepEqual(reply, { type: 'result', id: 3, name: 'example-house.ifc', mesh3d: null, triangles: 340, reason: 'large' });
  assert.deepEqual(transfer, []);
  assert.equal((await s.process(mesh3d(4))).reply.mesh3d.triangles, 340);
});

test('mesh3d skips what the cut skips (a marker proxy); an element outside the storeys has storey -1', async () => {
  const s = createSession(openApi);
  const model = smallModel({
    storeys: [{ name: 'S', z: 0 }],
    elements: [
      { storey: 0, name: 'Wall A', box: [0, 0, 0, 1000, 100, 3000] },
      { storey: 0, type: 'IFCBUILDINGELEMENTPROXY', box: [0, 2000, 1099.8, 500, 2500, 1100.3], ident: 'Annotation' },
      { storey: 0, type: 'IFCBUILDINGELEMENTPROXY', name: 'Thin', box: [0, 3000, 1099.8, 500, 3500, 1100.3] },
      { storey: -1, type: 'IFCCOLUMN', name: 'In the building', box: [2000, 0, 0, 2300, 300, 3000] },
    ],
  });
  const first = await s.process(file(1, text(model), 1.1, 'small.ifc'));
  assert.equal(first.reply.file.products, 3);
  const { reply } = await s.process(mesh3d(2, 2000000));
  assert.deepEqual(reply.mesh3d.elements.map(e => [e.type, e.name, e.storey]), [['IfcColumn', 'In the building', -1], ['IfcWall', 'Wall A', 0], ['IfcBuildingElementProxy', 'Thin', 0]]);
});
