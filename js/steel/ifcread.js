// Steel take-off: an open web-ifc model read into take-off rows (spec §3, §4, §7). No DOM: it runs in the worker,
// and in the Node tests on the same web-ifc build. `api` is a web-ifc IfcAPI, `W` the web-ifc module. Members are
// IfcBeam, IfcColumn, IfcMember and IfcPlate (and their IFC4 StandardCase forms). A member whose body is one
// IfcExtrudedAreaSolid (also under a boolean clipping or a mapped item) is priced from its profile's parameters; any
// other member from its mesh ("from geometry"). Lengths in mm on the rows; meshes in metres, Z up.
import { unitsOf, gather } from '../ifcplan/model.js?v=20261003';
import { section } from './section.js?v=20261104';
import { ringArea, ringLength, ringPolygon, polygonBox, DENSITY } from './plate.js?v=20261104';
import { gradeOf, differs } from './piece.js?v=20261104';

export const MEMBER_TYPES = ['IFCBEAM', 'IFCBEAMSTANDARDCASE', 'IFCCOLUMN', 'IFCCOLUMNSTANDARDCASE', 'IFCMEMBER', 'IFCMEMBERSTANDARDCASE', 'IFCPLATE', 'IFCPLATESTANDARDCASE'];
const KG_PER_MM3 = DENSITY * 1e-9;
// A member whose material or name says it is not steel: listed, left out of the totals.
export const NOT_STEEL = /\b(CONCRETE|BETON|TIMBER|WOOD|GLULAM|GLASS|GLAS|ALUMIN[A-Z]*)\b/i;
// A material that is only a strength class: concrete (C30/37, LC25/28, C20), timber (C24, D30, GL24h), or the Greek
// name of either. Tested on the material text only: in a name, C30 can be a real profile.
export const NOT_STEEL_CLASS = /(?:^|[^A-Z0-9])(?:L?C\d{2,3}\/\d{2,3}|C\d{2}|D\d{2}|GL\d{2}[HC]?)(?![A-Z0-9])|ΣΚΥΡΟΔΕΜΑ|ΜΠΕΤΟΝ|ΞΥΛΟ|ΞΥΛΕΙΑ/i;
const val = x => (x && typeof x === 'object' && 'value' in x ? x.value : x);
const ref = x => (x && typeof x === 'object' ? x.value : x);

// The member type codes this web-ifc knows.
export const memberCodes = W => MEMBER_TYPES.map(k => W[k]).filter(Number.isFinite);

// The extruded solids of a member's body: walks boolean results (their first operand) and mapped items.
function solidsOf(api, W, id, eid) {
  const out = [];
  const visit = (r, depth) => {
    if (!r || depth > 8) return;
    const item = api.GetLine(id, r);
    const type = api.GetLineType(id, r);
    if (type === W.IFCEXTRUDEDAREASOLID) out.push(item);
    else if (type === W.IFCBOOLEANCLIPPINGRESULT || type === W.IFCBOOLEANRESULT) visit(ref(item.FirstOperand), depth + 1);
    else if (type === W.IFCMAPPEDITEM) {
      const map = api.GetLine(id, ref(item.MappingSource));
      const rep = api.GetLine(id, ref(map.MappedRepresentation));
      for (const it of rep.Items || []) visit(ref(it), depth + 1);
    } else out.push(null);                                        // a brep or anything else: priced from geometry
  };
  try {
    const p = api.GetLine(id, eid);
    if (!p.Representation) return [];
    const pds = api.GetLine(id, ref(p.Representation));
    for (const r of pds.Representations || []) {
      const rep = api.GetLine(id, ref(r));
      const ident = String(val(rep.RepresentationIdentifier) || '').toUpperCase();
      if (ident && ident !== 'BODY') continue;
      for (const it of rep.Items || []) visit(ref(it), 0);
    }
  } catch (e) { return [null]; }
  return out;
}

// A 2D curve of a profile as a ring of { x, y, r } (mm), or null for a curve this reader does not follow: polylines,
// circles, and indexed poly curves of lines and three-point arcs.
function curveRing(api, W, id, cid, mm) {
  const c = api.GetLine(id, cid);
  const type = api.GetLineType(id, cid);
  const xy = p => { const q = api.GetLine(id, ref(p)); return { x: Number(val(q.Coordinates[0])) * mm, y: Number(val(q.Coordinates[1])) * mm, r: 0 }; };
  if (type === W.IFCPOLYLINE) {
    const pts = (c.Points || []).map(xy);
    const a = pts[0], b = pts[pts.length - 1];
    if (pts.length > 1 && Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9) pts.pop();
    return pts.length >= 3 ? pts : null;
  }
  if (type === W.IFCCIRCLE) {
    const pos = api.GetLine(id, ref(c.Position)), o = api.GetLine(id, ref(pos.Location));
    const cx = Number(val(o.Coordinates[0])) * mm, cy = Number(val(o.Coordinates[1])) * mm, R = Number(val(c.Radius)) * mm;
    return [{ x: cx - R, y: cy, r: R }, { x: cx + R, y: cy, r: R }];
  }
  if (type === W.IFCINDEXEDPOLYCURVE) {
    const P = (api.GetLine(id, ref(c.Points)).CoordList || []).map(q => ({ x: Number(val(q[0])) * mm, y: Number(val(q[1])) * mm }));
    // The segments' kinds (IfcLineIndex or IfcArcIndex) are only in the raw line.
    const raw = api.GetRawLineData(id, cid).arguments[1];
    const segs = Array.isArray(raw) && raw.length ? raw.map(sg => ({ arc: sg.typecode === W.IFCARCINDEX, ix: sg.value.map(v => Number(val(v)) - 1) }))
      : [{ arc: false, ix: P.map((_, i) => i) }];
    const ring = [];
    for (const { arc, ix } of segs) {
      if (ix.some(k => !P[k])) return null;
      if (arc && ix.length === 3) {
        // A three-point arc as one ring edge: its radius from the circle through the points, its side from the turn.
        const [a, b, d] = ix.map(k => P[k]);
        const cross = (b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x);
        const R = Math.abs(cross) > 1e-12 ? Math.hypot(b.x - a.x, b.y - a.y) * Math.hypot(d.x - b.x, d.y - b.y) * Math.hypot(d.x - a.x, d.y - a.y) / (2 * Math.abs(cross)) : 0;
        ring.push({ x: a.x, y: a.y, r: cross > 0 ? R : -R });        // (b − a) × (d − a) > 0: b right of a → d, the centre left
      } else for (let k = 0; k < ix.length - 1; k++) ring.push({ ...P[ix[k]], r: 0 });
    }
    const last = segs[segs.length - 1].ix, end = P[last[last.length - 1]], a = ring[0];
    if (a && end && (Math.abs(a.x - end.x) > 1e-9 || Math.abs(a.y - end.y) > 1e-9)) ring.push({ ...end, r: 0 });
    return ring.length >= 2 ? ring : null;
  }
  return null;
}

// A profile definition: { name, s } for the parametric ones (as section() reads them), { name, rings } for a
// rectangle or an arbitrary outline, or null for a profile this reader does not price.
function profileOf(api, W, id, pid, mm) {
  const p = api.GetLine(id, pid);
  const type = api.GetLineType(id, pid);
  const n = k => (val(p[k]) == null ? null : Number(val(p[k])) * mm);
  const name = String(val(p.ProfileName) || '');
  if (type === W.IFCISHAPEPROFILEDEF) return { name, s: { code: 'I', h: n('OverallDepth'), b: n('OverallWidth'), tw: n('WebThickness'), tf: n('FlangeThickness'), r: n('FilletRadius') || 0 } };
  if (type === W.IFCUSHAPEPROFILEDEF) {
    const slope = Number(val(p.FlangeSlope)) || 0;
    return { name, s: { code: 'U', h: n('Depth'), b: n('FlangeWidth'), tw: n('WebThickness'), tf: n('FlangeThickness'), r: n('FilletRadius') || 0, r2: n('EdgeRadius') || 0, taper: Math.tan(slope) } };
  }
  if (type === W.IFCLSHAPEPROFILEDEF) return { name, s: { code: 'L', h: n('Depth'), b: n('Width') || n('Depth'), tw: n('Thickness'), tf: n('Thickness'), r: n('FilletRadius') || 0, r2: n('EdgeRadius') || 0 } };
  if (type === W.IFCTSHAPEPROFILEDEF) return { name, s: { code: 'T', h: n('Depth'), b: n('FlangeWidth'), tw: n('WebThickness'), tf: n('FlangeThickness'), r: n('FilletRadius') || 0 } };
  if (type === W.IFCRECTANGLEHOLLOWPROFILEDEF) return { name, s: { code: 'M', h: n('YDim'), b: n('XDim'), tw: n('WallThickness'), tf: n('WallThickness'), r: n('OuterFilletRadius') || 0, ri: n('InnerFilletRadius') ?? undefined } };
  if (type === W.IFCCIRCLEHOLLOWPROFILEDEF) return { name, s: { code: 'RO', h: 2 * n('Radius'), b: 2 * n('Radius'), tw: n('WallThickness'), tf: n('WallThickness') } };
  if (type === W.IFCCIRCLEPROFILEDEF) return { name, s: { code: 'RU', h: 2 * n('Radius'), b: 2 * n('Radius') } };
  if (type === W.IFCRECTANGLEPROFILEDEF) {
    const x = n('XDim'), y = n('YDim');
    return { name, rect: true, rings: [[{ x: 0, y: 0, r: 0 }, { x, y: 0, r: 0 }, { x, y, r: 0 }, { x: 0, y, r: 0 }]] };
  }
  if (type === W.IFCARBITRARYCLOSEDPROFILEDEF || type === W.IFCARBITRARYPROFILEDEFWITHVOIDS) {
    const outer = curveRing(api, W, id, ref(p.OuterCurve), mm);
    const inner = (p.InnerCurves || []).map(c => curveRing(api, W, id, ref(c), mm));
    return outer && inner.every(Boolean) ? { name, rings: [outer, ...inner] } : null;
  }
  return null;
}

// The area web-ifc 0.0.78 meshes for a parametric profile (measured, and pinned by ifcread.test.js): the I-section's
// root fillets as 45° chamfers; the channel's and the tee's fillets and the channel's flange slope left out; circles
// as 11-gons. The geometry check scales the mesh volume by exact ÷ drawn, so an uncut member checks equal.
export const CIRCLE_DRAWN = 11 * Math.sin(2 * Math.PI / 11) / (2 * Math.PI);
export function drawnArea(s) {
  const exact = section(s);
  if (!exact) return null;
  const r = s.r || 0;
  switch (s.code) {
    case 'I': return exact.area - 4 * (1 - Math.PI / 4) * r * r + 2 * r * r;
    case 'U': case 'C': return 2 * s.b * s.tf + (s.h - 2 * s.tf) * s.tw;
    case 'T': return s.b * s.tf + (s.h - s.tf) * s.tw;
    case 'RO': case 'RU': return exact.area * CIRCLE_DRAWN;
    default: return exact.area;
  }
}

// One extruded solid's nominal figures: { name, code, kg, m2, lengthMm, box, thickness, exact, drawn }. A plate
// (an IfcPlate, or an outline extruded less than its smaller side) and a rectangle bar count every face (spec §4:
// both faces + edges); a profile counts its painted perimeter along its length.
function nominalOf(api, W, id, solid, mm, isPlate) {
  const prof = profileOf(api, W, id, ref(solid.SweptArea), mm);
  const depth = Number(val(solid.Depth)) * mm;
  if (!prof || !(depth > 0)) return null;
  if (prof.s) {
    const s = section(prof.s);
    if (!s) return null;
    const round = prof.s.code === 'RO' || prof.s.code === 'RU';
    const dims = [prof.s.h, round ? prof.s.h : prof.s.code === 'L' ? (prof.s.b || prof.s.h) : prof.s.b];
    return { name: prof.name, code: prof.s.code, kg: s.area * depth * KG_PER_MM3, m2: s.perimeter * depth * 1e-6, lengthMm: depth,
      box: [depth, ...dims], thickness: null, exact: s.area, drawn: drawnArea(prof.s) };
  }
  const [outer, ...inner] = prof.rings;
  const area = Math.abs(ringArea(outer)) - inner.reduce((a, r) => a + Math.abs(ringArea(r)), 0);
  const perimeter = prof.rings.reduce((a, r) => a + ringLength(r), 0);
  const bx = polygonBox(ringPolygon(outer)), dims = [bx.x1 - bx.x0, bx.y1 - bx.y0];
  const plate = isPlate || depth < Math.min(...dims);
  const flat = !plate && prof.rect;
  return {
    name: prof.name, code: plate || flat ? 'B' : 'SO', kg: area * depth * KG_PER_MM3,
    m2: (plate || flat ? 2 * area + perimeter * depth : perimeter * depth) * 1e-6,
    lengthMm: plate ? Math.max(...dims) : depth, box: [depth, ...dims],
    thickness: plate ? depth : flat ? Math.min(...dims) : null, exact: area, drawn: area,
  };
}

// Volume (m³), surface (m²) and bounding box of gather()'s triangles (metres).
export function meshFigures(P, ix) {
  let v = 0, a = 0;
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let k = 0; k < ix.length; k += 3) {
    const i = 3 * ix[k], j = 3 * ix[k + 1], l = 3 * ix[k + 2];
    const ax = P[i], ay = P[i + 1], az = P[i + 2], bx = P[j] - ax, by = P[j + 1] - ay, bz = P[j + 2] - az, cx = P[l] - ax, cy = P[l + 1] - ay, cz = P[l + 2] - az;
    const nx = by * cz - bz * cy, ny = bz * cx - bx * cz, nz = bx * cy - by * cx;
    if (!Number.isFinite(nx + ny + nz)) continue;
    a += Math.hypot(nx, ny, nz) / 2;
    v += (ax * nx + ay * ny + az * nz) / 6;
  }
  for (let k = 0; k < P.length; k += 3) {
    if (!Number.isFinite(P[k] + P[k + 1] + P[k + 2])) continue;
    for (let c = 0; c < 3; c++) { b[c] = Math.min(b[c], P[k + c]); b[c + 3] = Math.max(b[c + 3], P[k + c]); }
  }
  return { volume: Math.abs(v), area: a, box: b };
}

// Whether a member's material or name says it is not steel: test the material first, then the name only
// if the material does not resolve to a steel grade (S235–S450).
export function isNotSteel(gradeText, name) {
  if (NOT_STEEL.test(gradeText)) return true;
  if (!/^S\d{3}$/.test(gradeOf(gradeText)) && NOT_STEEL_CLASS.test(gradeText)) return true;
  if (!/^S\d{3}$/.test(gradeOf(gradeText)) && NOT_STEEL.test(name)) return true;
  return false;
}

// Box of triangles in the local frame. P and T as gather returns them: P in gather's (X, -Z, Y) frame, T in column-major (X, Y, Z).
// Returns [local_x_min, local_y_min, local_z_min, local_x_max, local_y_max, local_z_max]. If T is absent or invalid,
// returns the world box (from P).
export function boxInLocalFrame(P, T) {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  if (!T || T.length < 15) {
    // No transform: compute world box
    for (let k = 0; k < P.length; k += 3) {
      if (!Number.isFinite(P[k] + P[k + 1] + P[k + 2])) continue;
      for (let c = 0; c < 3; c++) { b[c] = Math.min(b[c], P[k + c]); b[c + 3] = Math.max(b[c + 3], P[k + c]); }
    }
    return b;
  }
  // Remap T's columns from (X, Y, Z) frame to P's (X, -Z, Y) frame: each column c becomes (T[4c], -T[4c+2], T[4c+1])
  const a = [
    [T[0], -T[2], T[1]],
    [T[4], -T[6], T[5]],
    [T[8], -T[10], T[9]],
  ];
  for (let k = 0; k < P.length; k += 3) {
    if (!Number.isFinite(P[k] + P[k + 1] + P[k + 2])) continue;
    const x = P[k], y = P[k + 1], z = P[k + 2];
    // Project onto local axes
    const local_x = a[0][0] * x + a[0][1] * y + a[0][2] * z;
    const local_y = a[1][0] * x + a[1][1] * y + a[1][2] * z;
    const local_z = a[2][0] * x + a[2][1] * y + a[2][2] * z;
    b[0] = Math.min(b[0], local_x); b[3] = Math.max(b[3], local_x);
    b[1] = Math.min(b[1], local_y); b[4] = Math.max(b[4], local_y);
    b[2] = Math.min(b[2], local_z); b[5] = Math.max(b[5], local_z);
  }
  return b;
}

// The marks, materials and assemblies of the members, each in one pass over its relations.
function relations(api, W, id, members) {
  const marks = new Map(), grades = new Map(), assembly = new Map();
  const each = (type, fn) => { const ids = api.GetLineIDsWithType(id, type); for (let i = 0; i < ids.size(); i++) fn(api.GetLine(id, ids.get(i))); };
  each(W.IFCRELDEFINESBYPROPERTIES, r => {
    const objs = (r.RelatedObjects || []).map(ref).filter(o => members.has(o));
    if (!objs.length || !r.RelatingPropertyDefinition) return;
    const def = ref(r.RelatingPropertyDefinition);
    if (api.GetLineType(id, def) !== W.IFCPROPERTYSET) return;
    const set = api.GetLine(id, def);
    const setName = String(val(set.Name) || '');
    if (setName !== 'Tekla Common' && setName !== 'Tekla Assembly') return;
    for (const pr of set.HasProperties || []) {
      const p = api.GetLine(id, ref(pr));
      const pn = String(val(p.Name) || '');
      const key = setName === 'Tekla Common' && pn === 'Part mark' ? 'part' : setName === 'Tekla Assembly' && pn === 'Assembly/Cast unit Mark' ? 'assembly' : null;
      const v = String(val(p.NominalValue) ?? '').trim();
      if (!key || !v) continue;
      for (const o of objs) { const m = marks.get(o) || {}; m[key] = v; marks.set(o, m); }
    }
  });
  const materialName = mid => {
    const m = api.GetLine(id, mid);
    const type = api.GetNameFromTypeCode(api.GetLineType(id, mid)).toUpperCase();
    if (type === 'IFCMATERIAL') return String(val(m.Name) || '');
    if (type === 'IFCMATERIALLIST') return m.Materials && m.Materials.length ? materialName(ref(m.Materials[0])) : '';
    if (type === 'IFCMATERIALPROFILESETUSAGE') return materialName(ref(m.ForProfileSet));
    if (type === 'IFCMATERIALPROFILESET') return m.MaterialProfiles && m.MaterialProfiles.length ? materialName(ref(m.MaterialProfiles[0])) : '';
    if (type === 'IFCMATERIALPROFILE' || type === 'IFCMATERIALLAYER') return m.Material ? materialName(ref(m.Material)) : '';
    if (type === 'IFCMATERIALLAYERSETUSAGE') return materialName(ref(m.ForLayerSet));
    if (type === 'IFCMATERIALLAYERSET') return m.MaterialLayers && m.MaterialLayers.length ? materialName(ref(m.MaterialLayers[0])) : '';
    return String(val(m.Name) || '');
  };
  each(W.IFCRELASSOCIATESMATERIAL, r => {
    const objs = (r.RelatedObjects || []).map(ref).filter(o => members.has(o));
    if (!objs.length) return;
    let name = '';
    try { name = materialName(ref(r.RelatingMaterial)); } catch (e) { name = ''; }
    for (const o of objs) if (!grades.has(o)) grades.set(o, name);
  });
  each(W.IFCRELAGGREGATES, r => {
    const whole = ref(r.RelatingObject);
    if (api.GetLineType(id, whole) !== W.IFCELEMENTASSEMBLY) return;
    for (const o of r.RelatedObjects || []) if (members.has(ref(o))) assembly.set(ref(o), whole);
  });
  return { marks, grades, assembly };
}

// The model's members as take-off rows (the same shape as piece.js's), with the members that share a mark, a
// profile, a grade, a length and a weight listed once with their count. A member priced from its profile waits for
// checkSteel (row.checking); one priced from geometry is meshed here, alone (GetFlatMesh: no booleans to wait for).
// Returns { rows, members, assemblies, fromGeometry, unitM, ratio } with ratio: eid → exact ÷ drawn area.
export function readSteel(api, W, id) {
  const unitM = unitsOf(api, W, id).lengthM, mm = unitM * 1000;
  const found = [];                                                // [eid, type code], in the file's order
  for (const c of memberCodes(W)) { const ids = api.GetLineIDsWithType(id, c); for (let i = 0; i < ids.size(); i++) found.push([ids.get(i), c]); }
  const members = new Map(found.sort((a, b) => a[0] - b[0]));
  const ratio = new Map();
  if (!members.size) return { rows: [], members: 0, assemblies: 0, fromGeometry: 0, unitM, ratio };
  const { marks, grades, assembly } = relations(api, W, id, members);
  const rows = [], byKey = new Map();
  let fromGeometry = 0;
  for (const [eid, code] of members) {
    const e = api.GetLine(id, eid);
    const isPlate = code === W.IFCPLATE || code === W.IFCPLATESTANDARDCASE;
    const solids = solidsOf(api, W, id, eid);
    const nominal = solids.length === 1 && solids[0] ? nominalOf(api, W, id, solids[0], mm, isPlate) : null;
    let g = null, t = null, T = null;
    if (!nominal) {
      const flat = api.GetFlatMesh(id, eid);
      if (flat && flat.geometries && flat.geometries.size() > 0) T = flat.geometries.get(0).flatTransformation;
      t = gather(api, id, flat);
      if (t.ix.length) g = meshFigures(t.P, t.ix);
      if (!g) continue;                                            // no body at all
    }
    const m = marks.get(eid) || {};
    const mark = m.part || m.assembly || String(val(e.Tag) || '').trim() || String(val(e.Name) || '').trim();
    const gradeText = grades.get(eid) || '';
    const row = {
      source: 'ifc', file: '', mark, drawing: '', order: '', phase: '', grade: gradeOf(gradeText), gradeText, qty: 1,
      profile: nominal ? nominal.name || String(val(e.ObjectType) || '') : String(val(e.ObjectType) || val(e.Name) || ''),
      code: nominal ? nominal.code : isPlate ? 'B' : 'SO', unitKg: null, unitM2: null, checkKg: null, checkM2: null, checking: !!nominal,
      kgFrom: nominal ? 'profile' : 'geometry', m2From: nominal ? 'profile' : 'geometry', warn: [], eids: [eid], assembly: assembly.get(eid) || null,
    };
    if (nominal) {
      Object.assign(row, { unitKg: nominal.kg, unitM2: nominal.m2, lengthMm: nominal.lengthMm, box: nominal.box });
      if (nominal.thickness) row.thickness = nominal.thickness;
      ratio.set(eid, nominal.drawn > 0 ? nominal.exact / nominal.drawn : 1);
    } else {
      fromGeometry++;
      const b = boxInLocalFrame(t.P, T);
      const d = [b[3] - b[0], b[4] - b[1], b[5] - b[2]].map(v => v * 1000).sort((x, y) => y - x);
      Object.assign(row, { unitKg: g.volume * DENSITY, unitM2: g.area, lengthMm: d[0], box: d });
      row.warn.push('geometry');
      if (isPlate) row.thickness = Math.round(d[2] * 10) / 10;
    }
    const Name = val(e.Name) || '';
    if (isNotSteel(gradeText, Name)) row.warn.push('notsteel');
    if (!(row.unitKg > 0)) row.warn.push('noweight');
    row.excluded = row.warn.includes('noweight') || row.warn.includes('notsteel');
    const key = [row.mark, row.profile, row.grade, Math.round(row.lengthMm), Math.round(row.unitKg * 10), row.excluded].join('|');
    const same = byKey.get(key);
    if (same) { same.qty++; same.eids.push(eid); continue; }
    byKey.set(key, row);
    rows.push(row);
  }
  const assemblies = new Set([...members.keys()].map(e => assembly.get(e)).filter(Boolean)).size;
  return { rows, members: members.size, assemblies, fromGeometry, unitM, ratio };
}

// The geometry check of the members priced from their profiles (spec §4): each member's mesh volume × 7,850, scaled
// by exact ÷ drawn area (drawnArea), and its mesh surface. This pass waits for web-ifc's booleans (bolt holes, cuts),
// so it runs after the rows are shown. Per row, the member farthest from the nominal weight speaks for the row.
// Returns [{ row, checkKg, checkM2, check }] with check true above the 5 % limit.
export function checkSteel(api, W, id, read) {
  const fig = new Map();
  api.StreamAllMeshesWithTypes(id, memberCodes(W), m => {
    const k = read.ratio.get(m.expressID);
    if (k === undefined) return;
    const g = gather(api, id, m);
    if (!g.ix.length) return;
    const f = meshFigures(g.P, g.ix);
    fig.set(m.expressID, { kg: f.volume * DENSITY * k, m2: f.area });
  });
  const out = [];
  read.rows.forEach((r, i) => {
    if (!r.checking) return;
    let worst = null;
    for (const e of r.eids) {
      const f = fig.get(e);
      if (f && (!worst || Math.abs(f.kg - r.unitKg) > Math.abs(worst.kg - r.unitKg))) worst = f;
    }
    out.push({ row: i, checkKg: worst ? worst.kg : null, checkM2: worst ? worst.m2 : null, check: !!worst && differs(r.unitKg, worst.kg) });
  });
  return out;
}

// The members' triangles for the 3D view (spec §3): one Float32 position array relative to the model's lower
// corner, one index array, and per member [eid, first index, index count]. Returns { mesh, transfer } with
// mesh null and reason 'large' above maxTriangles. The triangle cap is checked during streaming; once exceeded,
// no more meshes are held.
export function packMeshes(api, W, id, maxTriangles = Infinity) {
  const list = [];
  let nv = 0, ni = 0;
  let triangles = 0, over = false;
  const lo = [Infinity, Infinity, Infinity];
  api.StreamAllMeshesWithTypes(id, memberCodes(W), m => {
    const g = gather(api, id, m);
    if (!g.ix.length) return;
    triangles += Math.floor(g.ix.length / 3);
    if (over || triangles > maxTriangles) { over = true; list.length = 0; nv = 0; ni = 0; return; }
    list.push({ eid: m.expressID, P: g.P, ix: g.ix });
    nv += g.P.length / 3; ni += g.ix.length;
    for (let k = 0; k < g.P.length; k += 3) for (let c = 0; c < 3; c++) if (Number.isFinite(g.P[k + c])) lo[c] = Math.min(lo[c], g.P[k + c]);
  });
  if (over) return { mesh: null, triangles, transfer: [] };
  const origin = lo.map(v => (Number.isFinite(v) ? v : 0));
  const position = new Float32Array(nv * 3), index = new Uint32Array(ni), parts = new Int32Array(list.length * 3);
  let pv = 0, pi = 0;
  list.forEach((e, k) => {
    for (let j = 0; j < e.P.length; j += 3) for (let c = 0; c < 3; c++) position[3 * pv + 3 * (j / 3) + c] = Number.isFinite(e.P[j + c]) ? e.P[j + c] - origin[c] : 0;
    parts[3 * k] = e.eid; parts[3 * k + 1] = pi; parts[3 * k + 2] = e.ix.length;
    for (let j = 0; j < e.ix.length; j++) index[pi + j] = pv + e.ix[j];
    pv += e.P.length / 3; pi += e.ix.length;
  });
  return { mesh: { origin, position, index, parts, triangles }, transfer: [position.buffer, index.buffer, parts.buffer] };
}
