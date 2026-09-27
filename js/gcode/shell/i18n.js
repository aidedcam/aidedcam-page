// Shared by both viewers: translation lookup, locale number formatting, and the consent-gated GA
// helper. Strings come from window.GV_I18N, which each page builds from the shared viewer strings
// (js/gcode/i18n-viewer.js) and its own inline keys.
export function lang() { return document.documentElement.lang || 'el'; }

export function t(key, params = {}) {
  const all = window.GV_I18N || {};
  const s = (all[lang()] && all[lang()][key]) ?? (all.en && all.en[key]) ?? key;
  return String(s).replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? ''));
}

export function ga(name, params) {
  try { if (typeof window.gaEvent === 'function') window.gaEvent(name, params || {}); } catch (e) { /* never break the tool */ }
}

// el-GR and it-IT use a decimal comma, en a point.
export function localeOf() { return lang() === 'el' ? 'el-GR' : lang() === 'it' ? 'it-IT' : 'en-US'; }

export function fmtNum(v, decimals) {
  return new Intl.NumberFormat(localeOf(), { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
}
