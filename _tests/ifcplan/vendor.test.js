import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { openApi } from './webifc-node.mjs';

const DIR = new URL('../../js/ifcplan/vendor/web-ifc/', import.meta.url);
const sha = name => createHash('sha256').update(readFileSync(new URL(name, DIR))).digest('hex');

// One wall, 4000 × 200 × 3000 mm, as the smallest IFC4 file web-ifc meshes.
const WALL = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [ReferenceView]'),'2;1');
FILE_NAME('wall.ifc','2026-01-01T00:00:00',(''),(''),'','','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCPROJECT('0000000000000000000001',$,'P',$,$,$,$,(#5),#2);
#2=IFCUNITASSIGNMENT((#3));
#3=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);
#4=IFCAXIS2PLACEMENT3D(#6,$,$);
#5=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#4,$);
#6=IFCCARTESIANPOINT((0.,0.,0.));
#7=IFCLOCALPLACEMENT($,#4);
#8=IFCAXIS2PLACEMENT2D(#9,$);
#9=IFCCARTESIANPOINT((2000.,100.));
#10=IFCRECTANGLEPROFILEDEF(.AREA.,$,#8,4000.,200.);
#11=IFCDIRECTION((0.,0.,1.));
#12=IFCEXTRUDEDAREASOLID(#10,#4,#11,3000.);
#13=IFCSHAPEREPRESENTATION(#5,'Body','SweptSolid',(#12));
#14=IFCPRODUCTDEFINITIONSHAPE($,$,(#13));
#15=IFCWALL('0000000000000000000002',$,'W',$,$,#7,#14,$,$);
ENDSEC;
END-ISO-10303-21;
`;

test('the vendored files are web-ifc 0.0.78 as published on npm, with its licence', () => {
  assert.equal(sha('web-ifc-api.js'), '1edb1dd8e8dba63757932f62001f1b2ee812d86594b6ffc5e1e8beebe1f16690');
  assert.equal(sha('web-ifc.wasm'), '1fbd30bd5515ff6ad15268e87aa26e41d57b29411c8461618b63bee92735d349');
  assert.ok(readFileSync(new URL('LICENSE', DIR), 'utf8').startsWith('Mozilla Public License Version 2.0'));
  const src = readFileSync(new URL('SOURCE.md', DIR), 'utf8');
  assert.ok(src.includes('0.0.78') && src.includes('https://github.com/ThatOpen/engine_web-ifc'));
});

test('the vendored browser build opens an IFC in Node and meshes it in metres', async () => {
  const { api, W } = await openApi();
  const id = api.OpenModel(new TextEncoder().encode(WALL), { COORDINATE_TO_ORIGIN: false });
  assert.equal(id, 0);
  assert.equal(api.GetModelSchema(id), 'IFC4');
  const meshes = [];
  api.StreamAllMeshes(id, m => {
    const g = m.geometries.get(0);
    const geo = api.GetGeometry(id, g.geometryExpressID);
    const v = api.GetVertexArray(geo.GetVertexData(), geo.GetVertexDataSize());
    const ix = api.GetIndexArray(geo.GetIndexData(), geo.GetIndexDataSize());
    const T = g.flatTransformation;
    let top = -Infinity;                                       // web-ifc is Y-up: the IFC's Z comes out as Y
    for (let k = 0; k < v.length; k += 6) top = Math.max(top, T[1] * v[k] + T[5] * v[k + 1] + T[9] * v[k + 2] + T[13]);
    meshes.push({ id: m.expressID, type: api.GetNameFromTypeCode(api.GetLineType(id, m.expressID)), tris: ix.length / 3, top });
    geo.delete();
  });
  assert.deepEqual(meshes.map(m => [m.id, m.type, m.tris]), [[15, 'IfcWall', 12]]);
  assert.ok(Math.abs(meshes[0].top - 3) < 1e-9, `top ${meshes[0].top} m`);
  assert.equal(W.IFCWALL, api.GetLineType(id, 15));
  api.CloseModel(id);
});
