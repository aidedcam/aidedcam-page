// A minimal IFC (STEP physical file) writer, for the example generator and the tests' small models.
// Numbers are REALs (always with a decimal point); I(n) is an INTEGER, E('X') an enumeration .X., { raw } is written
// as it is, null is $, '*' is *, '#n' a reference, any other string an IFC string (' and \ doubled, non-ASCII as
// \X2\…\X0\).

export const E = v => ({ enum: v });
export const I = v => ({ int: v });

function str(s) {
  let out = '', wide = '';
  const flush = () => { if (wide) { out += `\\X2\\${wide}\\X0\\`; wide = ''; } };
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c >= 0x20 && c < 0x7f) { flush(); out += ch === "'" ? "''" : ch === '\\' ? '\\\\' : ch; } else wide += c.toString(16).toUpperCase().padStart(4, '0');
  }
  flush();
  return `'${out}'`;
}
function real(v) {
  const s = String(+v.toFixed(6));
  return s.includes('.') || s.includes('e') ? s : `${s}.`;
}
function arg(a) {
  if (a === null || a === undefined) return '$';
  if (a === '*') return '*';
  if (typeof a === 'number') return real(a);
  if (typeof a === 'string') return a.startsWith('#') ? a : str(a);
  if (Array.isArray(a)) return `(${a.map(arg).join(',')})`;
  if ('enum' in a) return `.${a.enum}.`;
  if ('int' in a) return String(a.int);
  if ('raw' in a) return a.raw;
  throw new Error(`bad argument ${JSON.stringify(a)}`);
}

// GlobalIds: 22 characters of the IFC base-64 alphabet, numbered after a fixed 16-character prefix.
const B64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';

export function stepFile(prefix = '1AidedCAMexample') {
  const lines = [];
  let guids = 0;
  const f = {
    add(type, ...args) {
      lines.push(`#${lines.length + 1}=${type}(${args.map(arg).join(',')});`);
      return `#${lines.length}`;
    },
    guid() {
      let n = ++guids, s = '';
      while (n) { s = B64[n % 64] + s; n = Math.floor(n / 64); }
      return `${prefix}${s.padStart(6, '0')}`;
    },
    text({ name, schema = 'IFC4', app = 'AidedCAM example generator' }) {
      return [
        'ISO-10303-21;',
        'HEADER;',
        "FILE_DESCRIPTION(('ViewDefinition [ReferenceView_V1.2]'),'2;1');",
        `FILE_NAME('${name}','2026-10-01T00:00:00',('AidedCAM'),('AidedCAM'),'','${app}','');`,
        `FILE_SCHEMA(('${schema}'));`,
        'ENDSEC;',
        'DATA;',
        ...lines,
        'ENDSEC;',
        'END-ISO-10303-21;',
        '',
      ].join('\n');
    },
  };
  return f;
}

// The pieces every model needs, written in this order: origin, Z axis, the identity placement, the units, the
// contexts and the project. length: { prefix: 'MILLI' | 'CENTI' | null } for SI metres, or { foot: true }.
export function startModel(f, { length = { prefix: 'MILLI' }, project = 'AidedCAM example house' } = {}) {
  const { add } = f;
  const pt = (x, y, z) => add('IFCCARTESIANPOINT', z === undefined ? [x, y] : [x, y, z]);
  const dir = v => add('IFCDIRECTION', v);
  const origin = pt(0, 0, 0);
  const zUp = dir([0, 0, 1]);
  const axis0 = add('IFCAXIS2PLACEMENT3D', origin, null, null);
  let lengthUnit;
  if (length.foot) {
    const metre = add('IFCSIUNIT', '*', E('LENGTHUNIT'), null, E('METRE'));
    const dims = add('IFCDIMENSIONALEXPONENTS', I(1), I(0), I(0), I(0), I(0), I(0), I(0));
    lengthUnit = add('IFCCONVERSIONBASEDUNIT', dims, E('LENGTHUNIT'), 'FOOT', add('IFCMEASUREWITHUNIT', { raw: 'IFCLENGTHMEASURE(0.3048)' }, metre));
  } else lengthUnit = add('IFCSIUNIT', '*', E('LENGTHUNIT'), length.prefix ? E(length.prefix) : null, E('METRE'));
  const units = add('IFCUNITASSIGNMENT', [
    lengthUnit,
    add('IFCSIUNIT', '*', E('AREAUNIT'), null, E('SQUARE_METRE')),
    add('IFCSIUNIT', '*', E('VOLUMEUNIT'), null, E('CUBIC_METRE')),
    add('IFCSIUNIT', '*', E('PLANEANGLEUNIT'), null, E('RADIAN')),
  ]);
  const context = add('IFCGEOMETRICREPRESENTATIONCONTEXT', null, 'Model', I(3), 1e-5, axis0, null);
  const body = add('IFCGEOMETRICREPRESENTATIONSUBCONTEXT', 'Body', 'Model', '*', '*', '*', '*', context, null, E('MODEL_VIEW'), null);
  const proj = add('IFCPROJECT', f.guid(), null, project, null, null, null, null, [context], units);
  const place = (relTo, x, y, z) => add('IFCLOCALPLACEMENT', relTo, add('IFCAXIS2PLACEMENT3D', pt(x, y, z), null, null));
  const shape = (item, ident = 'Body') => add('IFCPRODUCTDEFINITIONSHAPE', null, null, [add('IFCSHAPEREPRESENTATION', body, ident, 'SweptSolid', [item])]);
  // A box from (0, 0, 0) to (w, d, h) in its placement.
  const boxSolid = (w, d, h) => add('IFCEXTRUDEDAREASOLID',
    add('IFCRECTANGLEPROFILEDEF', E('AREA'), null, add('IFCAXIS2PLACEMENT2D', pt(w / 2, d / 2), null), w, d), axis0, zUp, h);
  return { pt, dir, origin, zUp, axis0, body, project: proj, place, shape, boxSolid };
}

// A small model for the tests: storeys [{ name, z, elevation }] under a building placed at buildingZ, and elements
// [{ storey: index, or -1 for the building itself; type: 'IFCWALL' …; box: [x0, y0, z0, x1, y1, z1] in the model's
// units; ident: the representation's identifier, 'Body' by default; solid: a ready-made solid instead of the box }].
export function smallModel({ length, buildingZ = 0, storeys = [], elements = [], name = 'small.ifc' } = {}) {
  const f = stepFile('0TestTestTestTest');
  const { add, guid } = f;
  const m = startModel(f, { length, project: 'Test' });
  const bp = m.place(null, 0, 0, buildingZ);
  const building = add('IFCBUILDING', guid(), null, 'B', null, null, bp, null, null, E('ELEMENT'), null, null, null);
  add('IFCRELAGGREGATES', guid(), null, null, null, m.project, [building]);
  const st = storeys.map(s => {
    const p = m.place(bp, 0, 0, s.z);
    return { place: p, ref: add('IFCBUILDINGSTOREY', guid(), null, s.name, null, null, p, null, null, E('ELEMENT'), s.elevation ?? s.z), elements: [] };
  });
  if (st.length) add('IFCRELAGGREGATES', guid(), null, null, null, building, st.map(s => s.ref));
  const inBuilding = [];
  for (const e of elements) {
    const host = e.storey >= 0 ? st[e.storey] : { place: bp, elements: inBuilding };
    const [x0, y0, z0, x1, y1, z1] = e.box;
    const solid = e.solid ? e.solid(m, add) : m.boxSolid(x1 - x0, y1 - y0, z1 - z0);
    host.elements.push(add(e.type || 'IFCWALL', guid(), null, e.name || 'E', null, null, m.place(host.place, x0, y0, z0), m.shape(solid, e.ident || 'Body'), null, null));
  }
  for (const s of st) if (s.elements.length) add('IFCRELCONTAINEDINSPATIALSTRUCTURE', guid(), null, null, null, s.elements, s.ref);
  if (inBuilding.length) add('IFCRELCONTAINEDINSPATIALSTRUCTURE', guid(), null, null, null, inBuilding, building);
  return f.text({ name });
}
