// Steel take-off: one NC1 piece's nominal kg and m², its geometry check figure and its box (spec §4, §5, §7). The
// quoted figures are always the nominal ones; the check is ⚠ above a 5 % difference. Pure.
import { section, plateDims } from './section.js?v=20261005';
import { plateFigures, holeArea, DENSITY } from './plate.js?v=20261005';

export const CHECK_LIMIT = 0.05;
const KG_PER_MM3 = DENSITY * 1e-9;

// The thickness of a profile's face, for the volume its holes take away.
function faceThickness(code, face, s) {
  const t = s.tw > 0 ? s.tw : s.tf;
  if (code === 'I' || code === 'U' || code === 'C' || code === 'T') return face === 'o' || face === 'u' ? (s.tf || t) : (s.tw || t);
  return t || 0;
}

// The grade a piece is grouped and priced by: S235, S275, S355 or S450 when the name holds one, else the name as
// written (spec §3: "STEEL/S275J0" is S275). The NC1 grades follow the same rule, so both sources group alike.
export function gradeOf(name) {
  const s = String(name || '').trim();
  const m = /S(235|275|355|450)/i.exec(s);
  return m ? `S${m[1]}` : s;
}

// Whether a nominal figure and its check differ by more than the limit.
export const differs = (nominal, check) => Number.isFinite(check) && check > 0 && nominal > 0 && Math.abs(nominal - check) / nominal > CHECK_LIMIT;

// The outer and inner rings and the holes of a plate's face v (any face's holes: a plate has one).
export function plateParts(p) {
  const rings = p.contours.filter(c => c.face === 'v');
  const outer = rings.filter(c => c.kind === 'AK').map(c => c.pts);
  return {
    outer: outer.length ? outer.reduce((a, r) => (r.length > a.length ? r : a)) : null,
    inner: rings.filter(c => c.kind === 'IK').map(c => c.pts),
    holes: p.holes,
  };
}

// p: the parser's piece. Returns the take-off row: { source, file, mark, drawing, order, phase, profile, code, grade,
// gradeText (as written), qty, lengthMm, unitKg, unitM2, checkKg, kgFrom, m2From, warn: [...], excluded, box: [mm, mm, mm], nc: p }.
// kgFrom / m2From: 'header', 'section' (from the dimensions) or 'contour' (a plate). warn ids: noweight, noarea,
// nolength, noqty, check.
export function nc1Piece(p, file) {
  const row = {
    source: 'nc1', file, mark: p.mark || '', drawing: p.drawing || '', order: p.order || '', phase: p.phase || '',
    profile: p.profile || '', code: p.code, grade: gradeOf(p.grade), gradeText: p.grade || '', qty: p.qty, lengthMm: p.length,
    unitKg: null, unitM2: null, checkKg: null, kgFrom: null, m2From: null, warn: [], box: [p.length, p.h, p.b], nc: p,
  };
  const L = p.length;
  if (p.code === 'B') {
    const { t, w } = plateDims(p);
    const parts = plateParts(p);
    const outer = parts.outer || [{ x: 0, y: 0, r: 0 }, { x: L, y: 0, r: 0 }, { x: L, y: w, r: 0 }, { x: 0, y: w, r: 0 }];
    const f = plateFigures({ outer, inner: parts.inner, holes: parts.holes, t });
    row.unitKg = f.kg; row.unitM2 = f.m2; row.checkKg = f.check; row.kgFrom = row.m2From = 'contour';
    row.box = [f.box.x1 - f.box.x0, f.box.y1 - f.box.y0, t];
    row.lengthMm = Math.max(row.box[0], row.box[1]);
    row.thickness = t;
  } else {
    const s = section(p);
    if (p.kgm > 0) { row.unitKg = p.kgm * L / 1000; row.kgFrom = 'header'; }
    else if (s) { row.unitKg = s.area * L * KG_PER_MM3; row.kgFrom = 'section'; }
    if (p.m2m > 0) { row.unitM2 = p.m2m * L / 1000; row.m2From = 'header'; }
    else if (s) { row.unitM2 = s.perimeter * L * 1e-6; row.m2From = 'section'; }
    if (s && row.unitKg !== null) {
      const holes = p.holes.reduce((a, h) => a + holeArea(h, faceThickness(p.code, h.face, p)) * faceThickness(p.code, h.face, p), 0);
      row.checkKg = (s.area * L - holes) * KG_PER_MM3;
    }
    if (p.code === 'RO' || p.code === 'RU') row.box = [L, p.h, p.h];
    if (p.code === 'L' && !(p.b > 0)) row.box = [L, p.h, p.h];
  }
  if (row.unitKg === null || (L > 0 && !(row.unitKg > 0))) row.warn.push('noweight');
  if (row.unitM2 === null) row.warn.push('noarea');
  if (!(L > 0)) row.warn.push('nolength');
  if (!(p.qty > 0)) row.warn.push('noqty');
  if (differs(row.unitKg, row.checkKg)) row.warn.push('check');
  row.excluded = row.warn.some(w => w === 'noweight' || w === 'nolength' || w === 'noqty');
  return row;
}
