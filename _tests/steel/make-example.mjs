// Writes the steel take-off's example (spec §10): a small portal frame of our own, so no third-party licence applies,
// as one NC1 file per piece mark in js/steel/examples/portal/ (with index.json, the list the page fetches) and as the
// same frame in IFC4, js/steel/examples/portal.ifc. Deterministic: the same bytes on every run.
//   node _tests/steel/make-example.mjs           write the files
//   node _tests/steel/make-example.mjs --check   compare with the committed files (exit 1 if one differs)
// Run from the repo root. The frame (mm): span 10,000, eaves 4,000, ridge 4,500.
//   C1   2 columns HEA200 S355J2, 4,000 long, 4 holes Ø22 in the top flange
//   R1   2 rafters IPE300 S355J2, 5,025 long, the ridge end cut at 5.7°, 8 holes Ø22 in the web
//   PU1  2 purlins RHS100*50*4 S275JR, 13,500 long (a double dip in the default bath), 4 holes Ø14
//   CL1  4 purlin cleats L80*8 S275JR, 150 long, 2 holes Ø14
//   BP1  2 base plates PL20, 300 × 300, 4 holes Ø26 and a grout hole Ø40 (an inner contour of two arcs)
//   HP1  4 end plates PL15, 200 × 400 with corners of radius 20, 6 holes Ø22
// The NC1 headers carry the catalogue weights and paint surfaces; the IFC carries parametric profiles, the plates as
// profiles with voids, Tekla-style marks (Part mark, Assembly/Cast unit Mark, then Tag, then Name) and the grades as
// materials, in four assemblies.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { stepFile, startModel, E } from '../ifcplan/step.mjs';

const DIR = 'js/steel/examples/portal';
const IFC = 'js/steel/examples/portal.ifc';

// ---- the NC1 files ----
const f2 = v => v.toFixed(2).padStart(10);
const f3 = v => v.toFixed(3).padStart(10);
function nc1(p) {
  const L = ['ST', '** AidedCAM example portal frame', `  ${p.order}`, `  ${p.drawing}`, `  ${p.phase}`, `  ${p.mark}`, `  ${p.grade}`, `  ${p.qty}`,
    `  ${p.profile}`, `  ${p.code}`, `  ${f2(p.length)}`, ...[p.h, p.b, p.tf, p.tw, p.r].map(v => `  ${f2(v)}`), ...[p.kgm, p.m2m].map(v => `  ${f3(v)}`),
    ...(p.cuts || [0, 0, 0, 0]).map(v => `  ${f3(v)}`), '  -', '  -', '  -', '  -'];
  for (const b of p.blocks || []) {
    L.push(b.code);
    for (const row of b.rows) L.push(`  ${row}`);
  }
  L.push('EN');
  return L.join('\r\n') + '\r\n';
}
const hole = (face, x, y, d, ref = 's') => `${face} ${f2(x)}${ref} ${f2(y)} ${f2(d)} ${f2(0)}`;
const pt = (face, x, y, r = 0) => `${face} ${f2(x)}u ${f2(y)} ${f2(r)}`;

const COMMON = { order: 'P-2026-01', phase: '1' };
const PIECES = [
  { ...COMMON, drawing: 'D-101', mark: 'C1', grade: 'S355J2', qty: 2, profile: 'HEA200', code: 'I', length: 4000, h: 190, b: 200, tf: 10, tw: 6.5, r: 18, kgm: 42.3, m2m: 1.136,
    blocks: [{ code: 'BO', rows: [hole('o', 3880, 50, 22), hole('o', 3880, 150, 22), hole('o', 3960, 50, 22), hole('o', 3960, 150, 22)] }] },
  { ...COMMON, drawing: 'D-102', mark: 'R1', grade: 'S355J2', qty: 2, profile: 'IPE300', code: 'I', length: 5025, h: 300, b: 150, tf: 10.7, tw: 7.1, r: 15, kgm: 42.2, m2m: 1.160,
    cuts: [0, 5.7, 0, 0],
    blocks: [{ code: 'BO', rows: [40, 260].flatMap(y => [60, 140, 4885, 4965].map(x => hole('v', x, y, 22))) }] },
  { ...COMMON, drawing: 'D-103', mark: 'PU1', grade: 'S275JR', qty: 2, profile: 'RHS100*50*4', code: 'M', length: 13500, h: 100, b: 50, tf: 4, tw: 4, r: 6, kgm: 8.78, m2m: 0.290,
    blocks: [{ code: 'BO', rows: [100, 13400].flatMap(x => [hole('u', x, 15, 14), hole('u', x, 35, 14)]) }] },
  { ...COMMON, drawing: 'D-103', mark: 'CL1', grade: 'S275JR', qty: 4, profile: 'L80*8', code: 'L', length: 150, h: 80, b: 80, tf: 8, tw: 8, r: 10, kgm: 9.63, m2m: 0.311,
    blocks: [{ code: 'BO', rows: [hole('v', 40, 45, 14), hole('v', 110, 45, 14)] }] },
  { ...COMMON, drawing: 'D-101', mark: 'BP1', grade: 'S275JR', qty: 2, profile: 'PL20*300', code: 'B', length: 300, h: 300, b: 20, tf: 20, tw: 20, r: 0, kgm: 0, m2m: 0,
    blocks: [
      { code: 'AK', rows: [pt('v', 0, 0), pt('v', 300, 0), pt('v', 300, 300), pt('v', 0, 300), pt('v', 0, 0)] },
      { code: 'IK', rows: [pt('v', 130, 150, -20), pt('v', 170, 150, -20), pt('v', 130, 150)] },
      { code: 'BO', rows: [[50, 50], [250, 50], [50, 250], [250, 250]].map(([x, y]) => hole('v', x, y, 26)) },
      { code: 'SI', rows: ['v    20.00s    20.00     0.00   10 BP1'] },
    ] },
  { ...COMMON, drawing: 'D-102', mark: 'HP1', grade: 'S275JR', qty: 4, profile: 'PL15*200', code: 'B', length: 400, h: 200, b: 15, tf: 15, tw: 15, r: 0, kgm: 0, m2m: 0,
    blocks: [
      { code: 'AK', rows: [pt('v', 20, 0), pt('v', 180, 0, 20), pt('v', 200, 20), pt('v', 200, 380, 20), pt('v', 180, 400), pt('v', 20, 400, 20), pt('v', 0, 380), pt('v', 0, 20, 20), pt('v', 20, 0)] },
      { code: 'BO', rows: [[50, 60], [150, 60], [50, 200], [150, 200], [50, 340], [150, 340]].map(([x, y]) => hole('v', x, y, 22)) },
    ] },
];
const files = PIECES.map(p => ({ name: `${p.mark}.nc1`, text: nc1(p) }));
const index = JSON.stringify({ files: files.map(f => f.name) }, null, 2) + '\n';

// ---- the IFC ----
const f = stepFile('2AidedCAMsteelEx');
const { add, guid } = f;
const m = startModel(f, { project: 'AidedCAM example portal frame' });
const P = (x, y, z) => add('IFCCARTESIANPOINT', [x, y, z]);
const D = v => add('IFCDIRECTION', v);
const P2 = (x, y) => add('IFCCARTESIANPOINT', [x, y]);
const centre2 = add('IFCAXIS2PLACEMENT2D', P2(0, 0), null);
const unit = v => { const l = Math.hypot(...v); return v.map(c => c / l); };
const placeAt = (o, axis = null, ref = null) => add('IFCLOCALPLACEMENT', null, add('IFCAXIS2PLACEMENT3D', P(...o), axis ? D(axis) : null, ref ? D(ref) : null));
const extrude = (profile, depth) => m.shape(add('IFCEXTRUDEDAREASOLID', profile, m.axis0, m.zUp, depth));
const label = s => ({ raw: `IFCLABEL('${s}')` });

const site = add('IFCSITE', guid(), null, 'Site', null, null, placeAt([0, 0, 0]), null, null, E('ELEMENT'), null, null, null, null, null);
const building = add('IFCBUILDING', guid(), null, 'Portal', null, null, placeAt([0, 0, 0]), null, null, E('ELEMENT'), null, null, null);
const storey = add('IFCBUILDINGSTOREY', guid(), null, 'Level 0', null, null, placeAt([0, 0, 0]), null, null, E('ELEMENT'), 0);
add('IFCRELAGGREGATES', guid(), null, null, null, m.project, [site]);
add('IFCRELAGGREGATES', guid(), null, null, null, site, [building]);
add('IFCRELAGGREGATES', guid(), null, null, null, building, [storey]);

const HEA200 = add('IFCISHAPEPROFILEDEF', E('AREA'), 'HEA200', centre2, 200, 190, 6.5, 10, 18, null, null);
const IPE300 = add('IFCISHAPEPROFILEDEF', E('AREA'), 'IPE300', centre2, 150, 300, 7.1, 10.7, 15, null, null);
const RHS = add('IFCRECTANGLEHOLLOWPROFILEDEF', E('AREA'), 'RHS100*50*4', centre2, 50, 100, 4, 4, 6);
const L80 = add('IFCLSHAPEPROFILEDEF', E('AREA'), 'L80*8', centre2, 80, 80, 8, 10, 5, null);
const circle = (x, y, r) => add('IFCCIRCLE', add('IFCAXIS2PLACEMENT2D', P2(x, y), null), r);
const polyline = pts => add('IFCPOLYLINE', [...pts, pts[0]].map(([x, y]) => P2(x, y)));
const BASE = add('IFCARBITRARYPROFILEDEFWITHVOIDS', E('AREA'), 'PL20*300', polyline([[0, 0], [300, 0], [300, 300], [0, 300]]),
  [circle(150, 150, 20), ...[[50, 50], [250, 50], [50, 250], [250, 250]].map(([x, y]) => circle(x, y, 13))]);
// The end plate's outline: lines and three-point arcs on one point list (corners of radius 20).
const c45 = 20 - 20 * Math.SQRT1_2;
const list = add('IFCCARTESIANPOINTLIST2D', [[20, 0], [180, 0], [200 - c45, c45], [200, 20], [200, 380], [200 - c45, 400 - c45], [180, 400], [20, 400], [c45, 400 - c45], [0, 380], [0, 20], [c45, c45]]);
const seg = (k, ...ix) => ({ raw: `${k}((${ix.join(',')}))` });
const outline = add('IFCINDEXEDPOLYCURVE', list, [seg('IFCLINEINDEX', 1, 2), seg('IFCARCINDEX', 2, 3, 4), seg('IFCLINEINDEX', 4, 5), seg('IFCARCINDEX', 5, 6, 7),
  seg('IFCLINEINDEX', 7, 8), seg('IFCARCINDEX', 8, 9, 10), seg('IFCLINEINDEX', 10, 11), seg('IFCARCINDEX', 11, 12, 1)], { raw: '.F.' });
const END = add('IFCARBITRARYPROFILEDEFWITHVOIDS', E('AREA'), 'PL15*200', outline,
  [[50, 60], [150, 60], [50, 200], [150, 200], [50, 340], [150, 340]].map(([x, y]) => circle(x, y, 11)));

const parts = [];                                   // { ref, mark: [kind, value], grade }
function part(type, name, tag, placement, shape, mark, grade) {
  const ref = add(type, guid(), null, name, null, null, placement, shape, tag, null);
  parts.push({ ref, mark, grade });
  return ref;
}
const assemblies = [];
function assembly(name, members) {
  const a = add('IFCELEMENTASSEMBLY', guid(), null, name, null, null, placeAt([0, 0, 0]), null, null, E('NOTDEFINED'), E('RIGID_FRAME'));
  add('IFCRELAGGREGATES', guid(), null, null, null, a, members);
  assemblies.push(a);
  return a;
}

const ridge = [5000, 0, 4500];
for (const x of [0, 10000]) {
  const col = part('IFCCOLUMN', 'COLUMN', null, placeAt([x, 0, 0], [0, 0, 1], [0, 1, 0]), extrude(HEA200, 4000), ['part', 'C1'], 'S355J2');
  const base = part('IFCPLATE', 'BP1', null, placeAt([x - 150, -150, -20]), extrude(BASE, 20), null, 'STEEL/S275JR');
  assembly('Column', [col, base]);
  const axis = unit([ridge[0] - x, 0, ridge[2] - 4000]);
  const raf = part('IFCBEAM', 'RAFTER', null, placeAt([x, 0, 4000], axis, [0, 1, 0]), extrude(IPE300, 5025), ['part', 'R1'], 'S355J2');
  const s = x ? -1 : 1;
  const ends = [x + s * 160, 5000 - s * 8].map(px => part('IFCPLATE', 'PLATE', null, placeAt([px, -100, 3850], [1, 0, 0], [0, 1, 0]), extrude(END, 15), ['part', 'HP1'], 'STEEL/S275JR'));
  const cleats = [-1, 1].map(k => part('IFCMEMBER', 'CLEAT', 'CL1', placeAt([x + s * 2500 + k * 60, -75, 4300], [0, 1, 0], [1, 0, 0]), extrude(L80, 150), null, 'STEEL/S275JR'));
  assembly('Rafter', [raf, ...ends, ...cleats]);
}
const purlins = [2500, 7500].map(x => part('IFCMEMBER', 'PURLIN', null, placeAt([x, -6750, 4420], [0, 1, 0], [1, 0, 0]), extrude(RHS, 13500), ['assembly', 'PU1'], 'STEEL/S275JR'));
add('IFCRELCONTAINEDINSPATIALSTRUCTURE', guid(), null, null, null, [...assemblies, ...purlins], storey);

// The marks, as Tekla writes them: a 'Tekla Common' set with the part mark, or a 'Tekla Assembly' set with the
// assembly mark. One set per part; the cleats have only their Tag, the base plates only their Name.
for (const p of parts) {
  if (!p.mark) continue;
  const [kind, value] = p.mark;
  const prop = add('IFCPROPERTYSINGLEVALUE', kind === 'part' ? 'Part mark' : 'Assembly/Cast unit Mark', null, label(value), null);
  const set = add('IFCPROPERTYSET', guid(), null, kind === 'part' ? 'Tekla Common' : 'Tekla Assembly', null, [prop]);
  add('IFCRELDEFINESBYPROPERTIES', guid(), null, null, null, [p.ref], set);
}
for (const grade of ['S355J2', 'STEEL/S275JR']) {
  const mat = add('IFCMATERIAL', grade, null, null);
  add('IFCRELASSOCIATESMATERIAL', guid(), null, null, null, parts.filter(p => p.grade === grade).map(p => p.ref), mat);
}
const ifc = f.text({ name: 'portal.ifc' });

// ---- write or check ----
const outputs = [...files.map(x => [`${DIR}/${x.name}`, x.text]), [`${DIR}/index.json`, index], [IFC, ifc]];
if (process.argv.includes('--check')) {
  let same = true;
  for (const [path, text] of outputs) {
    const ok = existsSync(path) && readFileSync(path, 'latin1') === text;
    if (!ok) { same = false; console.log(`differs ${path}`); }
  }
  console.log(same ? `same ${outputs.length} files` : 'differs');
  process.exit(same ? 0 : 1);
}
mkdirSync(DIR, { recursive: true });
for (const [path, text] of outputs) writeFileSync(path, text, 'latin1');
console.log(`wrote ${outputs.length} files`);
