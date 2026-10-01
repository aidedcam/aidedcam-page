// IFC floor plans: an open web-ifc model read and cut into storey plans (spec §3, steps 2–6). No DOM: it runs in
// the worker, and in the Node tests on the same web-ifc build. `api` is a web-ifc IfcAPI, `W` the web-ifc module
// (for its type codes). Lengths come back in metres, in the IFC's world coordinates; areas in m².
import { cutMesh } from './cut.js?v=20261103';
import { chain, polylineSet } from './chain.js?v=20261103';
import { layerOf, isMarkerProxy } from './layers.js?v=20261103';
import { roomArea, outlineOf, labelPoint } from './rooms.js?v=20261103';

export const MAX_BYTES = 150 * 1024 * 1024;       // refused before reading (spec §7)
export const LARGE_BYTES = 50 * 1024 * 1024;      // accepted, with a "this may take a while" note

// What a file is, from its first bytes: { ok: true, schema } for STEP text, else { ok: false, reason: 'read', detail }
// with detail 'ifczip', 'ifcxml' or 'not-ifc'.
export function sniff(bytes) {
  const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  const head = new TextDecoder('latin1').decode(bytes.subarray(bom, Math.min(bytes.length, 65536)));
  if (head.startsWith('PK\u0003\u0004')) return { ok: false, reason: 'read', detail: 'ifczip' };
  const start = head.trimStart();
  if (start.startsWith('<')) return { ok: false, reason: 'read', detail: 'ifcxml' };
  if (!start.startsWith('ISO-10303-21')) return { ok: false, reason: 'read', detail: 'not-ifc' };
  const m = /FILE_SCHEMA\s*\(\s*\(\s*'([^']*)'/i.exec(head);
  return { ok: true, schema: m ? m[1].trim().toUpperCase() : '' };
}

const PREFIX = { EXA: 1e18, PETA: 1e15, TERA: 1e12, GIGA: 1e9, MEGA: 1e6, KILO: 1e3, HECTO: 1e2, DECA: 1e1, DECI: 1e-1, CENTI: 1e-2, MILLI: 1e-3, MICRO: 1e-6, NANO: 1e-9, PICO: 1e-12, FEMTO: 1e-15, ATTO: 1e-18 };
const val = x => (x && typeof x === 'object' && 'value' in x ? x.value : x);

// Metres per length unit and m² per area unit, from IfcProject.UnitsInContext: SI units with their prefix, and
// conversion-based units (feet, inches …) through their factor. A missing area unit follows the length unit.
export function unitsOf(api, W, id) {
  let lengthM = 1, areaM2 = null;
  const si = u => {
    const p = PREFIX[val(u.Prefix)] || 1;
    const name = String(val(u.Name) || '');
    return name === 'SQUARE_METRE' ? p * p : name === 'CUBIC_METRE' ? p * p * p : p;
  };
  const factor = u => {
    if (!u) return null;
    if (u.ConversionFactor) {
      const mw = u.ConversionFactor;
      const v = Number(val(mw.ValueComponent));
      const base = mw.UnitComponent ? factor(mw.UnitComponent) : 1;
      if (v > 0 && base) return v * base;
      const n = String(val(u.Name) || '').toUpperCase();
      return n.includes('FOOT') ? 0.3048 : n.includes('INCH') ? 0.0254 : null;
    }
    if (u.Name !== undefined) return si(u);
    return null;
  };
  try {
    const ids = api.GetLineIDsWithType(id, W.IFCPROJECT);
    if (ids.size()) {
      const project = api.GetLine(id, ids.get(0), true);
      const units = (project.UnitsInContext && project.UnitsInContext.Units) || [];
      for (const u of units) {
        const type = u && val(u.UnitType);
        if (type === 'LENGTHUNIT') { const f = factor(u); if (f > 0) lengthM = f; }
        if (type === 'AREAUNIT') { const f = factor(u); if (f > 0) areaM2 = f; }
      }
    }
  } catch (e) { /* no usable units: metres */ }
  return { lengthM, areaM2: areaM2 || lengthM * lengthM };
}

// The world Z of a placement: the Z of its location summed along PlacementRelTo (spec §3: a storey's Elevation is
// relative to the building, and wrong for georeferenced files). Rotations of the parents are not applied.
function worldZ(api, id, placementId) {
  let z = 0;
  for (let p = placementId, guard = 0; p && guard < 64; guard++) {
    const lp = api.GetLine(id, p);
    if (!lp || !lp.RelativePlacement) break;
    const ap = api.GetLine(id, lp.RelativePlacement.value);
    const loc = ap && ap.Location ? api.GetLine(id, ap.Location.value) : null;
    const c = loc && loc.Coordinates;
    if (c && c.length > 2) z += Number(val(c[2])) || 0;
    p = lp.PlacementRelTo ? lp.PlacementRelTo.value : 0;
  }
  return z;
}

// The storeys, lowest first: { id, name, levelM }.
export function storeysOf(api, W, id, lengthM) {
  const ids = api.GetLineIDsWithType(id, W.IFCBUILDINGSTOREY);
  const out = [];
  for (let i = 0; i < ids.size(); i++) {
    const sid = ids.get(i);
    const s = api.GetLine(id, sid);
    let z = null;
    try { if (s.ObjectPlacement) z = worldZ(api, id, s.ObjectPlacement.value); } catch (e) { z = null; }
    if (z === null) z = Number(val(s.Elevation)) || 0;
    out.push({ id: sid, name: val(s.Name) || '', levelM: z * lengthM });
  }
  return out.sort((a, b) => a.levelM - b.levelM || a.id - b.id);
}

const BODY_TYPES = new Set(['SWEPTSOLID', 'ADVANCEDSWEPTSOLID', 'BREP', 'ADVANCEDBREP', 'CSG', 'CLIPPING', 'SURFACEMODEL', 'TESSELLATION', 'SOLIDMODEL', 'MAPPEDREPRESENTATION']);

// Does the product carry a Body representation (a solid, not only a footprint, an axis or a box)?
function hasBody(api, id, eid) {
  try {
    const p = api.GetLine(id, eid);
    if (!p.Representation) return false;
    const pds = api.GetLine(id, p.Representation.value);
    for (const r of pds.Representations || []) {
      const rep = api.GetLine(id, r.value);
      const ident = String(val(rep.RepresentationIdentifier) || '').toUpperCase();
      const type = String(val(rep.RepresentationType) || '').toUpperCase();
      if (ident === 'BODY' || ident === 'FACETATION' || (!ident && BODY_TYPES.has(type))) return true;
    }
  } catch (e) { /* unreadable: no */ }
  return false;
}

// What does not change with the cut height: the units, the storeys, the spatial structure, the rooms' names and
// quantities. Read once per file.
export function prepare(api, W, id) {
  const header = (type, k) => { try { const a = api.GetHeaderLine(id, type).arguments; return k(a); } catch (e) { return ''; } };
  const app = header(W.FILE_NAME, a => String(val(a[5]) || val(a[4]) || '')).trim();
  const schema = api.GetModelSchema(id) || '';
  const units = unitsOf(api, W, id);
  const storeys = storeysOf(api, W, id, units.lengthM);
  const storeyIndex = new Map(storeys.map((s, i) => [s.id, i]));

  // The spatial structure: each element's container, each part's whole.
  const up = new Map();
  const each = (type, fn) => { const ids = api.GetLineIDsWithType(id, type); for (let i = 0; i < ids.size(); i++) fn(api.GetLine(id, ids.get(i))); };
  each(W.IFCRELCONTAINEDINSPATIALSTRUCTURE, r => { for (const e of r.RelatedElements || []) if (!up.has(e.value)) up.set(e.value, r.RelatingStructure.value); });
  each(W.IFCRELAGGREGATES, r => { for (const e of r.RelatedObjects || []) if (!up.has(e.value)) up.set(e.value, r.RelatingObject.value); });
  const memo = new Map();
  const storeyOf = eid => {
    if (memo.has(eid)) return memo.get(eid);
    let k = -1;
    for (let p = eid, guard = 0; p && guard < 32; guard++) {
      if (storeyIndex.has(p)) { k = storeyIndex.get(p); break; }
      p = up.get(p);
    }
    memo.set(eid, k);
    return k;
  };

  // The rooms: names, and areas from their quantity set (Qto_SpaceBaseQuantities, or IFC2X3's BaseQuantities).
  const spaces = new Map();
  each(W.IFCSPACE, s => spaces.set(s.expressID, { name: val(s.Name) || '', longName: val(s.LongName) || '', qto: {} }));
  if (spaces.size) {
    each(W.IFCRELDEFINESBYPROPERTIES, r => {
      const objs = (r.RelatedObjects || []).filter(o => spaces.has(o.value));
      if (!objs.length || !r.RelatingPropertyDefinition) return;
      const def = r.RelatingPropertyDefinition.value;
      if (api.GetLineType(id, def) !== W.IFCELEMENTQUANTITY) return;
      const q = api.GetLine(id, def);
      const name = String(val(q.Name) || '');
      if (name !== 'Qto_SpaceBaseQuantities' && name !== 'BaseQuantities') return;
      for (const qr of q.Quantities || []) {
        if (api.GetLineType(id, qr.value) !== W.IFCQUANTITYAREA) continue;
        const a = api.GetLine(id, qr.value);
        const key = val(a.Name) === 'NetFloorArea' ? 'net' : val(a.Name) === 'GrossFloorArea' ? 'gross' : null;
        const v = Number(val(a.AreaValue)) * units.areaM2;
        if (key && v > 0) for (const o of objs) spaces.get(o.value).qto[key] = v;
      }
    });
  }
  return { schema, app, units, storeys, storeyOf, spaces, up };
}

// One element's triangles, in IFC Z-up metres (web-ifc gives Y-up: IFC (x, y, z) = (X, -Z, Y)): { P (Float64 xyz),
// ix, b (its bounding box) }. A vertex web-ifc gives as NaN or Infinity stays out of the bounding box (the cut drops
// its segments); b.x0 > b.x1 when none is finite.
export function gather(api, id, mesh) {
  const gs = mesh.geometries, parts = [];
  let nv = 0, ni = 0;
  for (let i = 0; i < gs.size(); i++) {
    const pg = gs.get(i);
    const geo = api.GetGeometry(id, pg.geometryExpressID);
    const v = api.GetVertexArray(geo.GetVertexData(), geo.GetVertexDataSize());
    const ix = api.GetIndexArray(geo.GetIndexData(), geo.GetIndexDataSize());
    parts.push({ v: v.slice(), ix: ix.slice(), T: pg.flatTransformation });
    nv += v.length / 6; ni += ix.length;
    geo.delete();
  }
  const P = new Float64Array(nv * 3), IX = new Uint32Array(ni);
  let pv = 0, pi = 0;
  const b = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  for (const { v, ix, T } of parts) {
    const base = pv;
    for (let k = 0; k < v.length; k += 6) {
      const x = v[k], y = v[k + 1], z = v[k + 2];
      const X = T[0] * x + T[4] * y + T[8] * z + T[12], Y = T[1] * x + T[5] * y + T[9] * z + T[13], Z = T[2] * x + T[6] * y + T[10] * z + T[14];
      const ix3 = 3 * pv++;
      P[ix3] = X; P[ix3 + 1] = -Z; P[ix3 + 2] = Y;
      if (!(Number.isFinite(X) && Number.isFinite(Y) && Number.isFinite(Z))) continue;
      if (X < b.x0) b.x0 = X; if (X > b.x1) b.x1 = X;
      if (-Z < b.y0) b.y0 = -Z; if (-Z > b.y1) b.y1 = -Z;
      if (Y < b.z0) b.z0 = Y; if (Y > b.z1) b.z1 = Y;
    }
    for (let k = 0; k < ix.length; k++) IX[pi++] = base + ix[k];
  }
  return { P, ix: IX, b };
}

// The IFC type name of an element (IfcWall …), cached per type code.
export function typeNamer(api, id) {
  const names = new Map();
  return eid => {
    const code = api.GetLineType(id, eid);
    let n = names.get(code);
    if (n === undefined) { n = api.GetNameFromTypeCode(code); names.set(code, n); }
    return n;
  };
}

// An element's Name attribute, '' when it has none.
export function nameOf(api, id, eid) {
  try { return String(val(api.GetLine(id, eid).Name) || ''); } catch (e) { return ''; }
}

// Every element the plans draw, with its triangles, in one order: the products first (a type with a layer, IfcSpace
// apart), then the rooms (StreamAllMeshes leaves IfcSpace out). Skipped: no triangles, no finite vertex, and the
// marker proxies of spec §4. fn({ eid, type, layer, m }) with m = gather()'s. The cut and the 3D view both stream
// through here, so they skip the same elements.
export function forEachElement(api, W, id, typeOf, fn) {
  api.StreamAllMeshes(id, mesh => {
    const eid = mesh.expressID;
    const type = typeOf(eid);
    const layer = layerOf(type);
    if (!layer || layer === 'IFC_SPACE') return;
    const m = gather(api, id, mesh);
    if (!m.ix.length || !(m.b.x0 <= m.b.x1)) return;
    if (isMarkerProxy({ type, zSpan: m.b.z1 - m.b.z0, hasBody: m.b.z1 - m.b.z0 < 0.001 && hasBody(api, id, eid) })) return;
    fn({ eid, type, layer, m });
  });
  api.StreamAllMeshesWithTypes(id, [W.IFCSPACE], mesh => {
    const eid = mesh.expressID;
    const m = gather(api, id, mesh);
    if (!m.ix.length || !(m.b.x0 <= m.b.x1)) return;
    fn({ eid, type: 'IfcSpace', layer: 'IFC_SPACE', m });
  });
}

// The plans at one cut height: every mesh cut by every storey's plane in one pass (spec §3 step 5).
// Returns { file, storeys } as the worker answers it (spec §3), with { transfer } the buffers to hand over.
export function cutModel(api, W, id, prep, cutM) {
  const one = prep.storeys.length === 0;
  const storeys = one ? [{ id: 0, name: '', levelM: 0 }] : prep.storeys;
  const planes = storeys.map(s => s.levelM + cutM);
  const plans = storeys.map(() => ({ layers: new Map(), cut: new Set(), rooms: [] }));
  const typeOf = typeNamer(api, id);
  const meshed = new Set();
  const bbox = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  let products = 0;
  const grow = b => {
    bbox.x0 = Math.min(bbox.x0, b.x0); bbox.y0 = Math.min(bbox.y0, b.y0); bbox.z0 = Math.min(bbox.z0, b.z0);
    bbox.x1 = Math.max(bbox.x1, b.x1); bbox.y1 = Math.max(bbox.y1, b.y1); bbox.z1 = Math.max(bbox.z1, b.z1);
  };
  const add = (plan, layer, polylines) => {
    let set = plan.layers.get(layer);
    if (!set) plan.layers.set(layer, set = polylineSet());
    for (const p of polylines) if (p.pts.length >= 4) set.add(p.pts, p.closed);
  };

  // The products cut by every storey's plane; the rooms each on its own storey's plane (spec §5).
  let rooms = 0;
  forEachElement(api, W, id, typeOf, ({ eid, layer, m }) => {
    meshed.add(eid);
    grow(m.b);
    if (layer !== 'IFC_SPACE') {
      products++;
      const segs = planes.map(() => null);
      cutMesh(m.P, m.ix, planes, (k, x0, y0, x1, y1) => { (segs[k] || (segs[k] = [])).push(x0, y0, x1, y1); });
      segs.forEach((s, k) => {
        if (!s) return;
        add(plans[k], layer, chain(s));
        plans[k].cut.add(eid);
      });
      return;
    }
    let k = one ? 0 : prep.storeyOf(eid);
    if (k < 0) {
      // Not in a storey: the highest storey at or below its floor.
      k = 0;
      for (let i = 0; i < storeys.length; i++) if (storeys[i].levelM <= m.b.z0 + 0.01) k = i;
    }
    const info = prep.spaces.get(eid) || { name: '', longName: '', qto: {} };
    const segs = [];
    cutMesh(m.P, m.ix, [planes[k]], (j, x0, y0, x1, y1) => segs.push(x0, y0, x1, y1));
    const pieces = chain(segs);
    let loops = pieces, outline = outlineOf(loops), crossed = outline.length >= 6, at;
    if (crossed) {
      add(plans[k], 'IFC_SPACE', pieces);
      at = labelPoint(outline);
    } else {
      // Lower than the cut: no outline; the label at the middle of its plan, its area from a cut at mid-height.
      const mid = [];
      cutMesh(m.P, m.ix, [(m.b.z0 + m.b.z1) / 2], (j, x0, y0, x1, y1) => mid.push(x0, y0, x1, y1));
      loops = chain(mid);
      outline = outlineOf(loops);
      at = [(m.b.x0 + m.b.x1) / 2, (m.b.y0 + m.b.y1) / 2];
    }
    const area = roomArea(info.qto, outline, loops);         // less the room's own holes: columns, shafts
    plans[k].rooms.push({ id: eid, name: info.name, longName: info.longName, outline: Float64Array.from(crossed ? outline : []), areaM2: area.areaM2, areaFrom: area.areaFrom, at, crossed });
    rooms++;
  });

  // Elements with a body that web-ifc could not mesh (for example a failed boolean): reported, not drawn.
  const missing = storeys.map(() => new Map()), missingAll = new Map();
  for (const eid of prep.up.keys()) {
    if (meshed.has(eid)) continue;
    const type = typeOf(eid);
    if (!layerOf(type) || !hasBody(api, id, eid)) continue;
    const k = one ? 0 : prep.storeyOf(eid);
    if (k >= 0) missing[k].set(type, (missing[k].get(type) || 0) + 1);
    missingAll.set(type, (missingAll.get(type) || 0) + 1);
  }
  const list = m => [...m].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count || (a.type < b.type ? -1 : 1));

  const transfer = [];
  const outStoreys = storeys.map((s, k) => {
    const layers = {};
    for (const [name, set] of plans[k].layers) {
      const p = set.pack();
      layers[name] = p;
      transfer.push(p.xy.buffer, p.ends.buffer, p.closed.buffer);
    }
    for (const r of plans[k].rooms) transfer.push(r.outline.buffer);
    return { name: s.name, levelM: s.levelM, cutZ: planes[k], layers, rooms: plans[k].rooms, cut: plans[k].cut.size, noGeometry: list(missing[k]) };
  });
  if (!(bbox.x0 <= bbox.x1)) for (const k of Object.keys(bbox)) bbox[k] = 0;
  const file = { schema: prep.schema, app: prep.app, unitM: prep.units.lengthM, products, rooms, bbox, noStoreys: one, noGeometry: list(missingAll) };
  return { file, storeys: outStoreys, transfer };
}
