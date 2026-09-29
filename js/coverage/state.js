// Coverage pre-check: the controller's pure decisions, kept out of ui.js so the Node tests can pin them.
import { DEFAULT_TERMS } from './rules.js?v=20260930';
import { LEVELS } from './mapping.js?v=20260930';

// A typed number: a comma or a point as the decimal separator (Greek and Italian keyboards type a comma), spaces
// ignored. '' is "not typed" (null); anything else that is not a plain non-negative number is refused
// (undefined), including "1.380,5": a grouped number is ambiguous between the languages. So is one group of
// three digits after a separator ("1.380", "2,500"): 1380 on a Greek keyboard, 1.38 on an English one.
export function parseTerm(text) {
  const s = String(text ?? '').replace(/\s+/g, '');
  if (s === '') return null;
  if (s.includes(',') && s.includes('.')) return undefined;
  if (/^\d{1,3}[.,]\d{3}$/.test(s)) return undefined;
  if (!/^\d*[.,]?\d+$|^\d+[.,]$/.test(s)) return undefined;
  const v = Number(s.replace(',', '.'));
  return Number.isFinite(v) ? v : undefined;
}

// The terms stored in this browser, cleaned: numbers or null, a storey height per known level, a known entrance.
export function termsFromStorage(json) {
  let raw = {};
  try { raw = JSON.parse(json || '{}') || {}; } catch (e) { raw = {}; }
  const out = { ...DEFAULT_TERMS, storey: {} };
  for (const k of ['sd', 'sk', 'hmax', 'roofAllow', 'h', 'roof', 'basementAbove', 'roofVolume']) {
    const v = raw[k];
    if (v === null) out[k] = null;
    else if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v;
  }
  if (raw.storey && typeof raw.storey === 'object') {
    for (const [lv, v] of Object.entries(raw.storey)) if (LEVELS.includes(lv) && typeof v === 'number' && Number.isFinite(v) && v > 0) out.storey[lv] = v;
  }
  if (LEVELS.includes(raw.entrance) && raw.entrance !== 'ATTIC') out.entrance = raw.entrance;
  out.parking = raw.parking === true;
  return out;
}

// GA parameters: no names, no figures (spec §9).
export const sizeBucket = bytes => (bytes < 1 << 20 ? 'under-1mb' : bytes < 5 << 20 ? '1-5mb' : 'over-5mb');
export const formatOf = f => (f && f.result && f.result.file ? f.result.file.format : /\.dwg$/i.test((f && f.name) || '') ? 'dwg' : 'dxf');

// The union a mapping needs: one per measured file (the engine's message id) and set of coverage outlines.
export const unionKey = (fileId, ids) => `${fileId}:${[...ids].sort().join(',')}`;
