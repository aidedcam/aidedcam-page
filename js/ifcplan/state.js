// IFC floor plans: the controller's small decisions (spec §2, §6, §8), kept pure for the Node tests: the stored
// settings, the typed cut height, the GA buckets and the warnings.
import { UNITS, unencodable } from './dxf.js?v=20261001';
import { labelLines } from './rooms.js?v=20261001';

export const SETTINGS_KEY = 'aidedcam-ifcp-settings';
export const DEFAULTS = { cutM: 1.1, units: 'm', origin: false };
export const CUT_MAX = 10;                 // m above each storey's level
export const FAR_KM = 10;                  // coordinates farther than this suggest "move to origin"
export const SAME_LEVEL_M = 0.001;         // storeys this close in world Z sit at one level

const validCut = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= CUT_MAX;

// The settings read back from storage: only well-formed values survive, the rest are the defaults.
export function cleanSettings(obj) {
  const o = obj && typeof obj === 'object' ? obj : {};
  return {
    cutM: validCut(o.cutM) ? o.cutM : DEFAULTS.cutM,
    units: Object.prototype.hasOwnProperty.call(UNITS, o.units) ? o.units : DEFAULTS.units,
    origin: o.origin === true,
  };
}

// A typed cut height in metres: one decimal separator, comma or point, from 0 to 10 m. undefined when it is not one.
export function parseCut(text) {
  const s = String(text).trim();
  if (!/^\d+([.,]\d+)?$/.test(s)) return undefined;
  const v = Number(s.replace(',', '.'));
  return validCut(v) ? v : undefined;
}

// A height as the page shows it: 2 decimals, the page language's separator.
export const showM = (v, lang) => {
  const s = v.toFixed(2);
  return lang === 'en' ? s : s.replace('.', ',');
};

// GA buckets (spec §8): never the size or the storey count itself.
export const sizeBucket = bytes => (bytes < 10 * 1024 * 1024 ? 'under-10mb' : bytes <= 50 * 1024 * 1024 ? '10-50mb' : 'over-50mb');
export const storeysBucket = n => (n <= 1 ? '1' : n <= 5 ? '2-5' : n <= 20 ? '6-20' : 'over-20');

// Every string the DXFs write as text: the file name, the storey names and the room labels.
export function textsOf(result, fileName) {
  const out = [fileName];
  for (const s of result.storeys) {
    out.push(s.name);
    for (const r of s.rooms) out.push(...labelLines(r));
  }
  return out;
}

// The levels (m) shared by two or more storeys, each once, lowest first: their plans are cut at one height.
function sharedLevels(storeys) {
  const levels = storeys.map(s => s.levelM).filter(Number.isFinite).sort((a, b) => a - b);
  const out = [];
  for (let i = 1, start = 0; i <= levels.length; i++) {
    if (i < levels.length && levels[i] - levels[i - 1] <= SAME_LEVEL_M) continue;
    if (i - start > 1) out.push(levels[start]);
    start = i;
  }
  return out;
}

// The warnings of spec §6/§7, each { id, params }, in the order the page lists them.
export function warningsOf(result, { fileName, cutM, origin }) {
  const out = [];
  const f = result.file;
  if (f.noStoreys) out.push({ id: 'nostoreys', params: { h: cutM } });
  const levels = sharedLevels(result.storeys);
  if (levels.length) out.push({ id: 'samelevel', params: { levels } });
  const missing = f.noGeometry.reduce((a, x) => a + x.count, 0);
  if (missing) out.push({ id: 'nogeometry', params: { n: missing, types: f.noGeometry.map(x => `${x.type} ${x.count}`).join(', ') } });
  const b = f.bbox;
  const far = Math.max(Math.abs(b.x0), Math.abs(b.x1), Math.abs(b.y0), Math.abs(b.y1)) / 1000;
  if (!origin && far > FAR_KM) out.push({ id: 'far', params: { km: Math.round(far) } });
  const low = result.storeys.reduce((a, s) => a + s.rooms.filter(r => !r.crossed).length, 0);
  if (low) out.push({ id: 'lowrooms', params: { n: low } });
  const bad = unencodable(textsOf(result, fileName));
  if (bad) out.push({ id: 'cp1253', params: { n: bad } });
  return out;
}
