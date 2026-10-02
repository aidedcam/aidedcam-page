import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openApi } from '../ifcplan/webifc-node.mjs';
import { stepFile, startModel, E } from '../ifcplan/step.mjs';
import { gather } from '../../js/ifcplan/model.js';
import { readSteel, checkSteel, packMeshes, meshFigures, drawnArea, CIRCLE_DRAWN, NOT_STEEL, NOT_STEEL_CLASS, boxInLocalFrame, isNotSteel } from '../../js/steel/ifcread.js';
import { section } from '../../js/steel/section.js';
import { takeoff, kg1, m2 } from '../../js/steel/quote.js';
import { BATH_DEFAULT } from '../../js/steel/bath.js';
import { exampleRows } from './example-rows.mjs';

const EXAMPLE = new URL('../../js/steel/examples/portal.ifc', import.meta.url);
const open = async text => { const { api, W } = await openApi(); return { api, W, id: api.OpenModel(typeof text === 'string' ? new TextEncoder().encode(text) : text, { COORDINATE_TO_ORIGIN: false }) }; };

test('the example IFC: 16 members in 6 rows, 4 assemblies, the marks from Tekla sets, Tag and Name, the grades by rule', async () => {
  const { api, W, id } = await open(new Uint8Array(readFileSync(EXAMPLE)));
  const r = readSteel(api, W, id);
  assert.deepEqual([r.members, r.assemblies, r.fromGeometry, r.unitM], [16, 4, 0, 0.001]);
  assert.deepEqual(r.rows.map(x => [x.mark, x.profile, x.code, x.grade, x.gradeText, x.qty, Math.round(x.lengthMm), x.kgFrom, x.checking]), [
    ['C1', 'HEA200', 'I', 'S355', 'S355J2', 2, 4000, 'profile', true],
    ['BP1', 'PL20*300', 'B', 'S275', 'STEEL/S275JR', 2, 300, 'profile', true],
    ['R1', 'IPE300', 'I', 'S355', 'S355J2', 2, 5025, 'profile', true],
    ['HP1', 'PL15*200', 'B', 'S275', 'STEEL/S275JR', 4, 400, 'profile', true],
    ['CL1', 'L80*8', 'L', 'S275', 'STEEL/S275JR', 4, 150, 'profile', true],
    ['PU1', 'RHS100*50*4', 'M', 'S275', 'STEEL/S275JR', 2, 13500, 'profile', true],
  ]);
  assert.deepEqual(r.rows.map(x => x.thickness || null), [null, 20, null, 15, null, null]);
  assert.equal(r.rows[3].eids.length, 4);
  api.CloseModel(id);
});

test('the IFC and its NC1 export agree within 2 % on kg and m² (spec §1, §10), and per mark', async () => {
  const { api, W, id } = await open(new Uint8Array(readFileSync(EXAMPLE)));
  const ifc = takeoff(readSteel(api, W, id).rows, BATH_DEFAULT), nc1 = takeoff(exampleRows(), BATH_DEFAULT);
  assert.ok(Math.abs(ifc.totals.kg / nc1.totals.kg - 1) < 0.02, `${ifc.totals.kg} vs ${nc1.totals.kg}`);
  assert.ok(Math.abs(ifc.totals.m2 / nc1.totals.m2 - 1) < 0.02, `${ifc.totals.m2} vs ${nc1.totals.m2}`);
  assert.deepEqual([kg1(ifc.totals.kg), m2(ifc.totals.m2), ifc.totals.pieces, ifc.totals.double], [1069.2, 29.88, 16, 2]);
  const byMark = t => Object.fromEntries(t.rows.map(x => [x.mark, x.unitKg]));
  const a = byMark(ifc), b = byMark(nc1);
  for (const k of Object.keys(b)) assert.ok(Math.abs(a[k] / b[k] - 1) < 0.02, `${k}: ${a[k]} vs ${b[k]}`);
  api.CloseModel(id);
});

test('the geometry check pass: every member checked, an uncut member equal to its nominal (drawn ÷ exact undone)', async () => {
  const { api, W, id } = await open(new Uint8Array(readFileSync(EXAMPLE)));
  const read = readSteel(api, W, id);
  const checks = checkSteel(api, W, id, read);
  assert.deepEqual(checks.map(c => c.row), [0, 1, 2, 3, 4, 5]);
  assert.ok(checks.every(c => !c.check), JSON.stringify(checks));
  for (const c of checks) {
    const row = read.rows[c.row];
    assert.ok(Math.abs(c.checkKg / row.unitKg - 1) < 0.02, `${row.mark}: ${c.checkKg} vs ${row.unitKg}`);
  }
  const hea = checks[0];
  assert.ok(Math.abs(hea.checkKg / read.rows[0].unitKg - 1) < 0.001, 'the HEA200 equal once its chamfered fillets are allowed for');
  api.CloseModel(id);
});

// One extrusion per parametric profile, 1,000 mm long, as web-ifc 0.0.78 meshes them.
function probe() {
  const f = stepFile('0ProbeProbeProbe'); const { add, guid } = f; const m = startModel(f);
  const c2 = add('IFCAXIS2PLACEMENT2D', add('IFCCARTESIANPOINT', [0, 0]), null);
  const defs = [
    [add('IFCISHAPEPROFILEDEF', E('AREA'), 'HEA200', c2, 200, 190, 6.5, 10, 18, null, null), { code: 'I', h: 190, b: 200, tf: 10, tw: 6.5, r: 18 }],
    [add('IFCUSHAPEPROFILEDEF', E('AREA'), 'PFC250', c2, 250, 90, 8, 15, 12, null, null), { code: 'U', h: 250, b: 90, tf: 15, tw: 8, r: 12, taper: 0 }],
    [add('IFCUSHAPEPROFILEDEF', E('AREA'), 'UPN200', c2, 200, 75, 8.5, 11.5, 11.5, 6, 0.0798), { code: 'U', h: 200, b: 75, tf: 11.5, tw: 8.5, r: 11.5, r2: 6, taper: 0.08 }],
    [add('IFCLSHAPEPROFILEDEF', E('AREA'), 'L80*8', c2, 80, 80, 8, 10, 5, null), { code: 'L', h: 80, b: 80, tf: 8, tw: 8, r: 10, r2: 5 }],
    [add('IFCTSHAPEPROFILEDEF', E('AREA'), 'T100', c2, 100, 100, 11, 11, 11, null, null, null, null, null), { code: 'T', h: 100, b: 100, tf: 11, tw: 11, r: 11 }],
    [add('IFCRECTANGLEHOLLOWPROFILEDEF', E('AREA'), 'RHS', c2, 50, 100, 4, 4, 6), { code: 'M', h: 100, b: 50, tw: 4, tf: 4, r: 6, ri: 4 }],
    [add('IFCCIRCLEHOLLOWPROFILEDEF', E('AREA'), 'CHS', c2, 57.15, 5), { code: 'RO', h: 114.3, tw: 5 }],
    [add('IFCCIRCLEPROFILEDEF', E('AREA'), 'R40', c2, 20), { code: 'RU', h: 40 }],
  ];
  const els = defs.map(([p], i) => add('IFCMEMBER', guid(), null, `P${i}`, null, null, m.place(null, i * 1000, 0, 0), m.shape(add('IFCEXTRUDEDAREASOLID', p, m.axis0, m.zUp, 1000)), null, null));
  return { text: f.text({ name: 'probe.ifc' }), defs: defs.map(d => d[1]), els: els.map(e => Number(e.slice(1))) };
}

test('web-ifc 0.0.78 draws I fillets as 45° chamfers, U and T without fillets or slope, circles as 11-gons: drawnArea matches its meshes', async () => {
  const { text, defs, els } = probe();
  const { api, id } = await open(text);
  const vol = new Map();
  api.StreamAllMeshes(id, ms => { const g = gather(api, id, ms); vol.set(ms.expressID, meshFigures(g.P, g.ix).volume * 1e9 / 1000); });
  const got = defs.map((s, i) => [s.code, Math.round(vol.get(els[i])), Math.round(drawnArea(s)), Math.round(section(s).area)]);
  for (const [code, mesh, drawn] of got) assert.ok(Math.abs(mesh / drawn - 1) < 0.025, `${code}: mesh ${mesh} vs drawn ${drawn}`);
  assert.deepEqual(got.filter(([c]) => c === 'I' || c === 'RO' || c === 'RU').map(([c, mesh, drawn, exact]) => [c, mesh, drawn, exact]),
    [['I', 5753, 5753, 5383], ['RO', 1625, 1625, 1717], ['RU', 1189, 1189, 1257]], 'the I 6.9 % heavier, the tube 5.3 % lighter: a naive check would flag both');
  assert.equal(+CIRCLE_DRAWN.toFixed(4), 0.9465);
  api.CloseModel(id);
});

test('a member without an extruded body is priced from its mesh, marked; a glass or concrete member is left out', async () => {
  const f = stepFile('1SteelTestSteelT'); const { add, guid } = f; const m = startModel(f);
  const box = (w, d, h) => add('IFCEXTRUDEDAREASOLID', add('IFCRECTANGLEPROFILEDEF', E('AREA'), 'FL20*100', add('IFCAXIS2PLACEMENT2D', add('IFCCARTESIANPOINT', [0, 0]), null), w, d), m.axis0, m.zUp, h);
  // Two solids in one body: not one extrusion, so from the mesh.
  const twin = add('IFCPRODUCTDEFINITIONSHAPE', null, null, [add('IFCSHAPEREPRESENTATION', m.body, 'Body', 'SweptSolid', [box(100, 20, 1000), add('IFCEXTRUDEDAREASOLID', add('IFCRECTANGLEPROFILEDEF', E('AREA'), null, add('IFCAXIS2PLACEMENT2D', add('IFCCARTESIANPOINT', [0, 100]), null), 100, 20), m.axis0, m.zUp, 1000)])]);
  add('IFCBEAM', guid(), null, 'TWIN', null, 'TWIN', m.place(null, 0, 0, 0), twin, 'T1', null);
  add('IFCMEMBER', guid(), null, 'GLAS', null, 'PL10*1000', m.place(null, 0, 500, 0), m.shape(box(1000, 10, 2000)), 'G1', null);
  add('IFCMEMBER', guid(), null, 'FLAT', null, null, m.place(null, 0, 900, 0), m.shape(box(100, 20, 3000)), 'F1', null);
  const { api, W, id } = await open(f.text({ name: 't.ifc' }));
  const r = readSteel(api, W, id);
  const [twinRow, glass, flat] = r.rows;
  assert.deepEqual([twinRow.mark, twinRow.kgFrom, twinRow.warn, twinRow.checking], ['T1', 'geometry', ['geometry'], false]);
  assert.ok(Math.abs(twinRow.unitKg - 2 * 100 * 20 * 1000 * 7.85e-6) < 0.01, `${twinRow.unitKg}`);
  assert.deepEqual([glass.mark, glass.warn, glass.excluded], ['G1', ['notsteel'], true]);
  assert.deepEqual([flat.mark, flat.code, flat.thickness, flat.lengthMm], ['F1', 'B', 20, 3000], 'a rectangle bar: a flat, grouped by thickness');
  assert.ok(Math.abs(flat.unitM2 - (2 * 2000 + 240 * 3000) * 1e-6) < 1e-9, 'every face of a flat');
  assert.equal(r.fromGeometry, 1);
  assert.ok(NOT_STEEL.test('CONCRETE/C30/37') && NOT_STEEL.test('Timber') && !NOT_STEEL.test('STEEL/S275JR') && !NOT_STEEL.test('MISCELLANEOUS/8.8.2'));
  api.CloseModel(id);
});

test('the example IFC members with diverse materials and names: all steel members stay in totals regardless of name', async () => {
  const { api, W, id } = await open(new Uint8Array(readFileSync(EXAMPLE)));
  const r = readSteel(api, W, id);
  // All 16 members in the example are steel members priced from profiles; none excluded
  const excluded = r.rows.filter(row => row.excluded);
  assert.equal(excluded.length, 0, 'no steel members should be excluded');
  // Verify the logic works: rows with grades like S355, S275 do not have 'notsteel' warn
  const noNonSteel = r.rows.every(row => !row.warn.includes('notsteel'));
  assert.ok(noNonSteel, 'all rows should lack notsteel warn');
  api.CloseModel(id);
});

test('the 3D meshes: positions from the lower corner, one index range per member, the cap', async () => {
  const { api, W, id } = await open(new Uint8Array(readFileSync(EXAMPLE)));
  const { mesh, transfer } = packMeshes(api, W, id);
  assert.equal(mesh.parts.length / 3, 16);
  assert.equal(transfer.length, 3);
  let lo = Infinity;
  for (let i = 0; i < mesh.position.length; i++) lo = Math.min(lo, mesh.position[i]);
  assert.ok(Math.abs(lo) < 1e-6, 'relative to the lower corner');
  assert.equal(mesh.index.length / 3, mesh.triangles);
  const large = packMeshes(api, W, id, 10);
  assert.deepEqual([large.mesh, large.triangles > 10], [null, true]);
  api.CloseModel(id);
});

test('the 3D triangle cap is checked during streaming: an uncapped run and a small cap return the same triangle count', async () => {
  const { api, W, id } = await open(new Uint8Array(readFileSync(EXAMPLE)));
  const uncapped = packMeshes(api, W, id, Infinity);
  const capped = packMeshes(api, W, id, 5);
  assert.equal(uncapped.mesh.triangles, capped.triangles, 'both runs count all triangles before stopping');
  assert.ok(uncapped.mesh.triangles > 5, 'example has more than 5 triangles');
  assert.deepEqual([capped.mesh, typeof capped.triangles], [null, 'number']);
  api.CloseModel(id);
});

test('isNotSteel: rejects non-steel materials, rejects names only when material is not a steel grade', () => {
  assert.equal(isNotSteel('CONCRETE/C30/37', 'Normal'), true, 'concrete material rejected');
  assert.equal(isNotSteel('Glass', 'Normal'), true, 'glass material rejected');
  assert.equal(isNotSteel('S275', 'Glass frame'), false, 'S275 member not rejected even if name says Glass');
  assert.equal(isNotSteel('STEEL/S275JR', 'Normal'), false, 'standard steel grade not rejected');
  assert.equal(isNotSteel('MISCELLANEOUS/8.8.2', 'Normal'), false, 'miscellaneous not rejected');
  assert.equal(isNotSteel('Unknown', 'Concrete holder'), true, 'unknown material with non-steel name rejected');
});

test('box in local frame: 45° Z-axis rotation, 30° Y-axis rotation, T undefined fallback', () => {
  // Build P as gather does: (X, -Z, Y) from (X, Y, Z) = T·v with T column-major
  const buildGatherP = (corners, T) => {
    const P = new Float64Array(corners.length);
    for (let k = 0; k < corners.length; k += 3) {
      const x = corners[k], y = corners[k + 1], z = corners[k + 2];
      const X = T[0] * x + T[4] * y + T[8] * z + T[12];
      const Y = T[1] * x + T[5] * y + T[9] * z + T[13];
      const Z = T[2] * x + T[6] * y + T[10] * z + T[14];
      P[k] = X; P[k + 1] = -Z; P[k + 2] = Y;
    }
    return P;
  };
  // Bar 1000 × 100 × 100 in local frame: 8 corners
  const barCorners = [
    0, 0, 0, 1000, 0, 0, 0, 100, 0, 1000, 100, 0, 0, 0, 100, 1000, 0, 100, 0, 100, 100, 1000, 100, 100,
  ];
  // 45° rotation about Z (vertical)
  const cos45 = Math.cos(Math.PI / 4), sin45 = Math.sin(Math.PI / 4);
  const T45 = new Float64Array([cos45, sin45, 0, 0, -sin45, cos45, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const P45 = buildGatherP(barCorners, T45);
  const box45 = boxInLocalFrame(P45, T45);
  const extents45 = [box45[3] - box45[0], box45[4] - box45[1], box45[5] - box45[2]].sort((a, b) => a - b);
  assert.ok(Math.abs(extents45[0] - 100) < 0.01, `45° rotation: min extent ${extents45[0]} ≈ 100`);
  assert.ok(Math.abs(extents45[1] - 100) < 0.01, `45° rotation: mid extent ${extents45[1]} ≈ 100`);
  assert.ok(Math.abs(extents45[2] - 1000) < 0.01, `45° rotation: max extent ${extents45[2]} ≈ 1000`);
  // World box of P45 should be larger than local 100 but smaller than local 1000
  const worldBox45 = boxInLocalFrame(P45, null);
  const worldExt45 = Math.max(worldBox45[3] - worldBox45[0], worldBox45[4] - worldBox45[1]);
  assert.ok(worldExt45 > 700 && worldExt45 < 1000, `world extent ${worldExt45} between 700–1000, differs from exact local 1000`);
  // 30° rotation about Y (horizontal, perpendicular to bar's length)
  const cos30 = Math.cos(Math.PI / 6), sin30 = Math.sin(Math.PI / 6);
  const T30 = new Float64Array([cos30, 0, -sin30, 0, 0, 1, 0, 0, sin30, 0, cos30, 0, 0, 0, 0, 1]);
  const P30 = buildGatherP(barCorners, T30);
  const box30 = boxInLocalFrame(P30, T30);
  const extents30 = [box30[3] - box30[0], box30[4] - box30[1], box30[5] - box30[2]].sort((a, b) => a - b);
  assert.ok(Math.abs(extents30[0] - 100) < 0.01, `30° rotation: min extent ${extents30[0]} ≈ 100`);
  assert.ok(Math.abs(extents30[1] - 100) < 0.01, `30° rotation: mid extent ${extents30[1]} ≈ 100`);
  assert.ok(Math.abs(extents30[2] - 1000) < 0.01, `30° rotation: max extent ${extents30[2]} ≈ 1000`);
  // T undefined: world box
  const worldBox = boxInLocalFrame(P45, null);
  assert.ok(worldBox[0] < worldBox[3] && worldBox[1] < worldBox[4], 'world box has valid extents');
});

test('isNotSteel: concrete and timber strength classes in the material are not steel; steel grades and profile names stay', () => {
  for (const m of ['C30/37', 'C25/30', 'LC25/28', 'Concrete C20/25', 'C24', 'C16', 'D30', 'GL24h', 'GL28c', 'ΣΚΥΡΟΔΕΜΑ C20/25', 'ΞΥΛΟ'])
    assert.equal(isNotSteel(m, 'COLUMN'), true, m);
  for (const m of ['S235', 'S275JR', 'S355J2', 'S420', 'S460', 'STEEL/S355', 'S355 C30'])
    assert.equal(isNotSteel(m, 'BEAM'), false, m);
  assert.equal(isNotSteel('S355', 'C30 frame'), false, 'the name is never tested against the class pattern');
  assert.equal(isNotSteel('Unknown', 'C30 frame'), false, 'a name like C30 is a profile, not concrete');
  assert.equal(NOT_STEEL_CLASS.test('S355'), false);
  assert.equal(NOT_STEEL_CLASS.test('HEA200'), false);
  assert.equal(NOT_STEEL_CLASS.test('IPE300'), false);
  assert.equal(NOT_STEEL_CLASS.test('UPN200'), false);
});
