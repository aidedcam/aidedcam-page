import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { openApi } from './webifc-node.mjs';

const FILE = new URL('../../js/ifcplan/examples/example-house.ifc', import.meta.url);

test('the generator is deterministic: --check finds the committed example byte-identical', () => {
  const out = execFileSync(process.execPath, ['_tests/ifcplan/make-example.mjs', '--check'], { encoding: 'utf8' });
  assert.equal(out.trim(), 'same js/ifcplan/examples/example-house.ifc');
});

test('the example is IFC4 STEP text in plain ASCII, its Greek names encoded as \\X2\\, its GlobalIds unique', () => {
  const text = readFileSync(FILE, 'latin1');
  assert.ok(text.startsWith('ISO-10303-21;\nHEADER;\n'));
  assert.ok(text.includes("FILE_SCHEMA(('IFC4'));"));
  assert.ok(text.endsWith('END-ISO-10303-21;\n'));
  assert.ok(!/[^\x0a\x20-\x7e]/.test(text), 'ASCII only, LF line ends');
  assert.ok(text.includes("IFCSPACE('1AidedCAMexample"), 'rooms');
  assert.ok(text.includes(String.raw`'\X2\03A303B103BB03CC03BD03B9\X0\'`), 'Σαλόνι');
  const ids = [...text.matchAll(/^#\d+=IFC\w+\('([0-9A-Za-z_$]{22})'/gm)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  assert.ok(ids.length >= 40, `${ids.length} GlobalIds`);
  assert.ok(ids.every(g => /^[0-3]/.test(g)), 'a GlobalId starts with 0–3');
});

test('web-ifc reads the example: two storeys, the elements of spec §10 and the three rooms', async () => {
  const { api, W } = await openApi();
  const id = api.OpenModel(new Uint8Array(readFileSync(FILE)), { COORDINATE_TO_ORIGIN: false });
  assert.equal(api.GetModelSchema(id), 'IFC4');
  const count = t => api.GetLineIDsWithType(id, W[t]).size();
  assert.deepEqual(['IFCBUILDINGSTOREY', 'IFCWALL', 'IFCOPENINGELEMENT', 'IFCDOOR', 'IFCWINDOW', 'IFCCOLUMN', 'IFCSTAIRFLIGHT', 'IFCRAILING', 'IFCSLAB', 'IFCSPACE', 'IFCELEMENTQUANTITY'].map(count), [2, 10, 3, 1, 2, 1, 1, 1, 3, 3, 1]);
  const names = t => { const ids = api.GetLineIDsWithType(id, W[t]), out = []; for (let i = 0; i < ids.size(); i++) out.push(api.GetLine(id, ids.get(i)).Name.value); return out; };
  assert.deepEqual(names('IFCBUILDINGSTOREY'), ['Ισόγειο', 'Όροφος 1']);
  assert.deepEqual(names('IFCSPACE'), ['Σαλόνι', 'Κουζίνα', '1.01']);
  let meshes = 0;
  api.StreamAllMeshes(id, () => meshes++);
  assert.equal(meshes, 19, 'every element but the openings and the rooms');
  api.CloseModel(id);
});
