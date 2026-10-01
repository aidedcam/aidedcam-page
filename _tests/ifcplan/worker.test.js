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
