// Shared by both viewers: localStorage that never throws (private mode, blocked storage), and
// settings persistence that stores only the fields a user can change.
export function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
export function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }

// defaults, then whatever was stored, then overrides that must always win.
export function loadStored(key, defaults, overrides = {}) {
  try { return { ...defaults, ...JSON.parse(lsGet(key) || '{}'), ...overrides }; }
  catch (e) { return { ...defaults, ...overrides }; }
}

export function saveStored(key, settings, keys) {
  const out = {};
  for (const k of keys) out[k] = settings[k];
  lsSet(key, JSON.stringify(out));
}
