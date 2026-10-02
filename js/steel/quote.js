// Steel take-off: the quote (spec §5, §6.3, §6.5, §6.7). Rows are the pieces of piece.js (or of the IFC worker);
// this groups them by profile and grade, totals them, marks the bath fit, and prices the cost lines from the rates the
// visitor types. Figures: kg to 1 decimal, m² to 2, money to the cent; each cost line is its shown quantity times its
// rate, so the sheet adds up. Pure.
import { bathFit } from './bath.js?v=20261005';

export const VAT_RATE = 0.24;
export const GRADES = ['S235', 'S275', 'S355', 'other'];

// Decimal rounding, half away from zero, on the value as it reads in decimal: the product of a rate and a quantity
// carries binary noise (10.6 × 0.375 is 3.9749999999999996), so it is cleaned to 12 significant digits first and
// shifted by its exponent as text, never multiplied by 10 ** d.
export function round(v, d) {
  if (!Number.isFinite(v) || Math.abs(v) >= 1e15) return v;
  const [m, e] = Math.abs(v).toExponential(11).split('e');
  const r = Math.round(Number(`${m}e${Number(e) + d}`));
  return (v < 0 ? -1 : 1) * Number(`${r}e-${d}`);
}
export const kg1 = v => round(v, 1);
export const m2 = v => round(v, 2);
export const cents = v => round(v, 2);

export const gradeBucket = g => (['S235', 'S275', 'S355'].includes(g) ? g : 'other');

// A thickness or a length in mm as the sheet shows it: at most one decimal.
export const mm = v => String(round(v, 1));

// The profile a row is grouped under: a plate by its thickness ("PL 20"), any other piece by its profile name, with
// spaces and case ignored and * read as x ("HEA 200" and "HEA200" together).
export function profileKey(row) {
  if (row.code === 'B' && row.thickness > 0) return `PL ${mm(row.thickness)}`;
  return String(row.profile || '').toUpperCase().replace(/\s+/g, '').replace(/\*/g, 'X') || '?';
}
const profileLabel = row => (row.code === 'B' && row.thickness > 0 ? `PL ${mm(row.thickness)}` : String(row.profile || '').trim().replace(/\s+/g, ' ') || '?');

const byMark = (a, b) => String(a.mark).localeCompare(String(b.mark), undefined, { numeric: true, sensitivity: 'base' });

// rows → { rows, groups, totals, longest, heaviest, kgByGrade }. Every row gets its bath mark (row.bath). Rows left out
// of the totals (no weight, no length, no quantity) stay listed in their group. sort: 'kg' | 'length' | 'mark'.
export function takeoff(rows, bath, sort = 'kg') {
  const groups = new Map();
  const totals = { marks: rows.length, pieces: 0, kg: 0, m2: 0, lengthM: 0, excluded: 0, noArea: 0, checks: 0, double: 0, no: 0 };
  const kgByGrade = Object.fromEntries(GRADES.map(g => [g, 0]));
  let longest = null, heaviest = null;
  for (const r of rows) {
    r.bath = bathFit(r.box, bath);
    const key = `${profileKey(r)}|${r.grade}`;
    let g = groups.get(key);
    if (!g) groups.set(key, g = { key, profile: profileLabel(r), grade: r.grade, count: 0, lengthM: 0, kg: 0, m2: 0, rows: [] });
    g.rows.push(r);
    const n = r.qty > 0 ? r.qty : 0;
    totals.pieces += n;
    g.count += n;
    if (r.warn.includes('check')) totals.checks++;
    if (r.excluded) { totals.excluded++; continue; }
    if (r.bath === 'double') totals.double += n;
    if (r.bath === 'no') totals.no += n;
    const kg = r.unitKg * n, len = r.lengthMm * n / 1000;
    g.kg += kg; g.lengthM += len;
    totals.kg += kg; totals.lengthM += len;
    kgByGrade[gradeBucket(r.grade)] += kg;
    if (r.unitM2 === null) totals.noArea++;
    else { g.m2 += r.unitM2 * n; totals.m2 += r.unitM2 * n; }
    if (!longest || r.lengthMm > longest.lengthMm) longest = r;
    if (!heaviest || r.unitKg > heaviest.unitKg) heaviest = r;
  }
  const list = [...groups.values()];
  sortTakeoff(list, sort);
  return { rows, groups: list, totals, longest, heaviest, kgByGrade };
}

// Groups and their rows, in place: heaviest or longest first, or by profile and mark.
export function sortTakeoff(groups, sort) {
  const rowKey = { kg: r => -(r.excluded ? -1 : r.unitKg * r.qty), length: r => -r.lengthMm };
  if (sort === 'mark') {
    groups.sort((a, b) => a.profile.localeCompare(b.profile, undefined, { numeric: true }) || a.grade.localeCompare(b.grade));
    for (const g of groups) g.rows.sort(byMark);
  } else {
    const k = rowKey[sort] || rowKey.kg;
    groups.sort((a, b) => (sort === 'length' ? b.lengthM - a.lengthM : b.kg - a.kg) || a.profile.localeCompare(b.profile));
    for (const g of groups) g.rows.sort((a, b) => k(a) - k(b) || byMark(a, b));
  }
  return groups;
}

// The rates as typed: a number ≥ 0, or null when empty (its line stays off the sheet).
export function parseRate(s) {
  const t = String(s == null ? '' : s).trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  const v = Number(t);
  return Number.isFinite(v) && v >= 0 ? v : undefined;            // undefined: not a number
}

// The cost block (spec §6.7). rates: { galv, zinc, paint, steel, perGrade, steelGrade: { S235, S275, S355, other },
// minimum, vat }, each rate a number or null. Returns { lines: [{ id, qty, unit, rate, amount, unpriced? }], unpricedKg, subtotal, minimum,
// minApplies, net, vat, total }.
export function costs(t, rates) {
  const kg = kg1(t.totals.kg), area = m2(t.totals.m2);
  const lines = [], unpricedLines = [];
  const line = (id, qty, unit, rate) => { if (rate !== null && rate !== undefined) lines.push({ id, qty, unit, rate, amount: cents(qty * rate) }); };
  line('galv', kg, 'kg', rates.galv);
  line('zinc', kg, 'kg', rates.zinc);
  line('paint', area, 'm2', rates.paint);
  if (rates.perGrade) {
    // A grade with weight but no rate stays on the sheet, unpriced, so the total is never read as the whole material.
    for (const g of GRADES) {
      if (!(t.kgByGrade[g] > 0)) continue;
      const rate = (rates.steelGrade || {})[g] ?? null;
      if (rate === null) unpricedLines.push({ id: `steel.${g}`, qty: kg1(t.kgByGrade[g]), unit: 'kg', rate: null, amount: null, unpriced: true });
      else line(`steel.${g}`, kg1(t.kgByGrade[g]), 'kg', rate);
    }
    lines.push(...unpricedLines);
  } else line('steel', kg, 'kg', rates.steel);
  const subtotal = cents(lines.reduce((a, l) => a + (l.unpriced ? 0 : l.amount), 0));
  const unpricedKg = kg1(unpricedLines.reduce((a, l) => a + l.qty, 0));
  const minimum = rates.minimum > 0 ? rates.minimum : null;
  const minApplies = minimum !== null && lines.length > unpricedLines.length && subtotal < minimum;
  const net = minApplies ? cents(minimum) : subtotal;
  const vat = rates.vat ? cents(net * VAT_RATE) : 0;
  return { lines, unpricedKg, subtotal, minimum, minApplies, net, vat, vatOn: !!rates.vat, total: cents(net + vat) };
}
