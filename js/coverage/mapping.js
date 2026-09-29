// Coverage pre-check: the drawing's own layers mapped to roles (spec §4). Pure: no DOM, no engine.
// The template names fill in by themselves, a mapping remembered in this browser fills the rest, everything
// else starts as "Ignore".

// Every role a layer can have, in the order the dropdown lists them.
export const ROLES = ['plot', 'cover', 'level', 'mezz', 'semiopen', 'balcony', 'stairCommon', 'stairUnit', 'void', 'pilotis', 'bsmtMain', 'exclOther', 'green', 'ignore'];

// The levels a level outline can be, lowest first.
export const LEVELS = ['B2', 'B1', '00', '01', '02', '03', '04', '05', '06', '07', '08', '09', 'ATTIC'];
export const isBasement = lv => lv === 'B1' || lv === 'B2';

// Roles whose outlines are spaces inside a level (spec §5.2): assigned by containment, or (balconies) by
// distance.
export const SPACE_ROLES = ['mezz', 'semiopen', 'balcony', 'stairCommon', 'stairUnit', 'void', 'pilotis', 'bsmtMain', 'exclOther'];

// The published AidedCAM layer template, with the AutoCAD colour index the template file gives each layer.
export const TEMPLATE = [
  { layer: 'AC_PLOT', role: 'plot', aci: 1 },
  { layer: 'AC_COVER', role: 'cover', aci: 5 },
  ...LEVELS.map(lv => ({ layer: `AC_LVL_${lv}`, role: 'level', level: lv, aci: 7 })),
  { layer: 'AC_MEZZ', role: 'mezz', aci: 6 },
  { layer: 'AC_SEMIOPEN', role: 'semiopen', aci: 4 },
  { layer: 'AC_BALCONY', role: 'balcony', aci: 30 },
  { layer: 'AC_STAIR_COMMON', role: 'stairCommon', aci: 2 },
  { layer: 'AC_STAIR_UNIT', role: 'stairUnit', aci: 40 },
  { layer: 'AC_VOID', role: 'void', aci: 8 },
  { layer: 'AC_PILOTIS', role: 'pilotis', aci: 9 },
  { layer: 'AC_BSMT_MAIN', role: 'bsmtMain', aci: 150 },
  { layer: 'AC_EXCL_OTHER', role: 'exclOther', aci: 210 },
  { layer: 'AC_GREEN', role: 'green', aci: 3 },
];

// Layer names compared ignoring case and the separators - _ and spaces (spec §4).
export const normName = name => String(name).toUpperCase().replace(/[-_\s]+/g, '');
const BY_NORM = new Map(TEMPLATE.map(t => [normName(t.layer), t]));
export const templateFor = name => BY_NORM.get(normName(name)) || null;

// An outline the rules can measure: a closed curve of the engine (area > 0), or one whose area can't be
// trusted (bad: self-crossing). Hatches and block inserts are not outlines.
export const isOutlineKind = it => it.kind !== 'hatch' && it.kind !== 'insert';
export const isClosed = it => isOutlineKind(it) && (it.area > 0 || !!it.bad);
export const isOpen = it => isOutlineKind(it) && !isClosed(it) && it.kind !== 'line' && it.kind !== 'arc';

// Layers that hold at least one closed outline, with counts and areas, then the rest ("other layers, not
// used"). Sorted as the engine sorted them (by name).
export function layerList(result) {
  const by = new Map();
  for (const it of result.items || []) {
    let l = by.get(it.layer);
    if (!l) by.set(it.layer, l = { name: it.layer, outlines: 0, area: 0, bad: 0, open: 0 });
    if (isClosed(it)) { l.outlines++; if (it.bad) l.bad++; else l.area += it.area; }
    else if (isOpen(it)) l.open++;
  }
  const names = (result.layers || []).map(l => l.name);
  for (const n of by.keys()) if (!names.includes(n)) names.push(n);
  const used = [], other = [];
  for (const n of names) {
    const l = by.get(n) || { name: n, outlines: 0, area: 0, bad: 0, open: 0 };
    (l.outlines > 0 ? used : other).push(l);
  }
  return { used, other };
}

const validRole = r => r && ROLES.includes(r.role) && (r.role !== 'level' || LEVELS.includes(r.level));

// The starting mapping of a file's layers: template names first, then what this browser remembers, else Ignore.
// Returns { map: { layer: { role, level? } }, fromTemplate, fromMemory }.
export function autoMap(layerNames, remembered = {}) {
  const map = {};
  let fromTemplate = 0, fromMemory = 0;
  for (const name of layerNames) {
    const t = templateFor(name);
    if (t) { map[name] = t.level ? { role: t.role, level: t.level } : { role: t.role }; fromTemplate++; continue; }
    const r = Object.prototype.hasOwnProperty.call(remembered, name) ? remembered[name] : null;
    if (validRole(r) && r.role !== 'ignore') { map[name] = r.role === 'level' ? { role: 'level', level: r.level } : { role: r.role }; fromMemory++; continue; }
    map[name] = { role: 'ignore' };
  }
  return { map, fromTemplate, fromMemory };
}

// What is kept in this browser after a change: every layer the visitor gave a role, by name. A template name
// is not stored (it fills in by itself); a layer set back to Ignore is forgotten. Other files' layers stay.
export function remember(remembered, map) {
  const out = { ...remembered };
  for (const [name, r] of Object.entries(map)) {
    if (templateFor(name)) continue;
    if (!validRole(r) || r.role === 'ignore') delete out[name];
    else out[name] = r.role === 'level' ? { role: 'level', level: r.level } : { role: r.role };
  }
  return out;
}

// A remembered mapping read back from storage: only well-formed entries survive.
export function cleanRemembered(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const [name, r] of Object.entries(obj)) if (validRole(r) && r.role !== 'ignore') out[name] = r.role === 'level' ? { role: 'level', level: r.level } : { role: r.role };
  return out;
}

// The number of roles in use (for GA, no names).
export function rolesUsed(map) { return new Set(Object.values(map).map(r => r.role).filter(r => r !== 'ignore')).size; }
