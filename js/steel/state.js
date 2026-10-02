// Steel take-off: the page's pure helpers (spec §6, §7, §8): the settings as stored, numbers as typed, which files
// a dropped set holds, and the GA bucket. No DOM.
import { BATH_DEFAULT } from './bath.js?v=20261005';
import { parseRate, GRADES } from './quote.js?v=20261005';

export const SETTINGS_KEY = 'aidedcam-steel-settings';
export const NC1_MAX = 2000;                                   // spec §7: the first 2,000 NC1 files are read
export const IFC_MAX_BYTES = 150 * 1024 * 1024;                // spec §7: a larger IFC is refused before reading
export const SORTS = ['kg', 'length', 'mark'];
export const RATE_KEYS = ['galv', 'zinc', 'paint', 'steel', 'minimum'];

// A positive number as typed, with a decimal comma or point; undefined when it is not one.
export function parsePositive(s) {
  const v = parseRate(s);
  return v !== null && v !== undefined && v > 0 ? v : undefined;
}

// A rate as typed: a number ≥ 0, null when the field is empty, undefined when it is not a number.
export const parseRateInput = parseRate;

const rate = v => (v === null || (Number.isFinite(v) && v >= 0) ? v : null);

// The stored settings, cleaned: { bath: { length, width, depth }, rates: { galv, zinc, paint, steel, minimum,
// perGrade, steelGrade: { S235, S275, S355, other }, vat }, sort }. Rates are numbers or null (empty).
export function cleanSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const b = s.bath && typeof s.bath === 'object' ? s.bath : {};
  const r = s.rates && typeof s.rates === 'object' ? s.rates : {};
  const g = r.steelGrade && typeof r.steelGrade === 'object' ? r.steelGrade : {};
  const dim = (v, d) => (Number.isFinite(v) && v > 0 && v < 100 ? v : d);
  return {
    bath: { length: dim(b.length, BATH_DEFAULT.length), width: dim(b.width, BATH_DEFAULT.width), depth: dim(b.depth, BATH_DEFAULT.depth) },
    rates: {
      ...Object.fromEntries(RATE_KEYS.map(k => [k, rate(r[k] ?? null)])),
      perGrade: r.perGrade === true,
      steelGrade: Object.fromEntries(GRADES.map(k => [k, rate(g[k] ?? null)])),
      vat: r.vat !== false,
    },
    sort: SORTS.includes(s.sort) ? s.sort : 'kg',
  };
}

// What a file is, by its name: 'nc1' (.nc1, .nc, any case), 'zip', 'ifc' or 'other'.
export function kindOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(String(name || ''));
  const ext = m ? m[1].toLowerCase() : '';
  return ext === 'nc1' || ext === 'nc' ? 'nc1' : ext === 'zip' ? 'zip' : ext === 'ifc' ? 'ifc' : 'other';
}

// Mac OS clutter: paths with __MACOSX/ or basenames starting with ._ are system files.
export function isMacClutter(path) {
  const name = String(path || '');
  const base = name.replace(/^.*[\\/]/, '');
  return name.includes('__MACOSX/') || base.startsWith('._');
}

// The skipped-list view model: given a set or null, return { hidden, items }.
// Items are { name, reasonKey, line? } where reasonKey is st.skip.<reason>.
export function skippedView(set) {
  if (!set || !set.skipped || !set.skipped.length) return { hidden: true, items: [] };
  return { hidden: false, items: set.skipped.map(x => ({ name: x.name, reasonKey: `st.skip.${x.reason}`, line: x.line })) };
}

// A dropped or chosen set: [{ name }] → { ifc: the first IFC or null, nc1: [...], zips: [...], skipped: [{ name,
// reason }] }. One IFC is read alone (spec §2): with an IFC in the set every other file is skipped ('ifcalone').
export function sortSet(files) {
  const ifc = files.find(f => kindOf(f.name) === 'ifc') || null;
  if (ifc) return { ifc, nc1: [], zips: [], skipped: files.filter(f => f !== ifc).map(f => ({ name: f.name, reason: 'ifcalone' })) };
  const out = { ifc: null, nc1: [], zips: [], skipped: [] };
  for (const f of files) {
    const k = kindOf(f.name);
    if (k === 'nc1') out.nc1.push(f);
    else if (k === 'zip') out.zips.push(f);
    else out.skipped.push({ name: f.name, reason: 'notnc1' });
  }
  return out;
}

// The GA bucket of a piece count (spec §8).
export function piecesBucket(n) {
  return n <= 10 ? '1-10' : n <= 100 ? '11-100' : n <= 1000 ? '101-1000' : 'over-1000';
}
