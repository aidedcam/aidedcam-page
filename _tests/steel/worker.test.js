import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openApi } from '../ifcplan/webifc-node.mjs';
import { smallModel } from '../ifcplan/step.mjs';
import { createSession } from '../../js/steel/worker.js';

const EXAMPLE = readFileSync(new URL('../../js/steel/examples/portal.ifc', import.meta.url));
const buf = b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const session = () => createSession(openApi);

test('before any file, a check or a mesh request answers stale', async () => {
  const s = session();
  assert.deepEqual((await s.process({ id: 1, settings: { check: true } })).reply, { type: 'error', id: 1, reason: 'stale', detail: '' });
  assert.equal((await s.process({ id: 2, settings: { mesh: true } })).reply.reason, 'stale');
});

test('a file: its rows and figures; then the check pass; then the meshes, all from the open model', async () => {
  const s = session();
  const { reply } = await s.process({ id: 1, name: 'portal.ifc', bytes: buf(EXAMPLE), settings: {} });
  assert.equal(reply.type, 'result');
  assert.deepEqual(reply.file, { schema: 'IFC4', members: 16, assemblies: 4, fromGeometry: 0, unitM: 0.001 });
  assert.equal(reply.rows.length, 6);
  assert.ok(reply.rows.every(r => r.checking && r.checkKg === null));
  const c = (await s.process({ id: 2, name: 'check', settings: { check: true } })).reply;
  assert.deepEqual([c.type, c.name, c.checks.length, c.checks.filter(x => x.check).length], ['result', 'portal.ifc', 6, 0]);
  const m = await s.process({ id: 3, name: 'mesh', settings: { mesh: true, maxTriangles: 1e6 } });
  assert.equal(m.reply.mesh.parts.length, 48);
  assert.equal(m.transfer.length, 3);
  const large = (await s.process({ id: 4, settings: { mesh: true, maxTriangles: 5 } })).reply;
  assert.deepEqual([large.mesh, large.reason], [null, 'large']);
});

test('refusals: no steel members, not an IFC, ifcXML, over the size limit', async () => {
  const s = session();
  const walls = smallModel({ storeys: [{ name: 'G', z: 0 }], elements: [{ storey: 0, type: 'IFCWALL', box: [0, 0, 0, 4000, 200, 3000] }] });
  assert.equal((await s.process({ id: 1, name: 'w.ifc', bytes: buf(new TextEncoder().encode(walls)) })).reply.reason, 'nosteel');
  assert.equal((await s.process({ id: 2, settings: { check: true } })).reply.reason, 'stale', 'a refused file leaves no open model');
  const notIfc = (await s.process({ id: 3, name: 'a.ifc', bytes: buf(new TextEncoder().encode('ST\n  1\n')) })).reply;
  assert.deepEqual([notIfc.reason, notIfc.detail], ['read', 'not-ifc']);
  assert.equal((await s.process({ id: 4, name: 'a.ifc', bytes: buf(new TextEncoder().encode('<?xml version="1.0"?><ifcXML/>')) })).reply.detail, 'ifcxml');
  assert.equal((await s.process({ id: 5, name: 'big.ifc', bytes: { byteLength: 151 * 1024 * 1024 } })).reply.reason, 'limit');
});
