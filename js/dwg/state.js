// DWG quantities: the controller's pure decisions, kept out of ui.js so the Node tests can pin them.
export const MAX_FILES = 20;                         // per batch (spec §8)
export const MAX_BYTES = 30 * 1024 * 1024;           // per file, checked before the engine sees it
export const UNITS = ['mm', 'cm', 'm', 'inch', 'ft'];

// The items a table row stands for: a layer's items, or one block name's inserts on one layer.
export function rowItems(items, row) {
  const out = [];
  items.forEach((it, i) => {
    if (row.block != null) { if (it.kind === 'insert' && it.block === row.block && it.layer === row.layer) out.push(i); }
    else if (it.layer === row.layer) out.push(i);
  });
  return out;
}

// A click in the drawing: a plain click replaces the selection (or clears it on empty space); Shift+click
// adds or removes one item.
export function clickSelection(current, picked, shift) {
  const s = new Set(current);
  if (picked < 0) return shift ? [...s].sort((a, b) => a - b) : [];
  if (!shift) return [picked];
  if (s.has(picked)) s.delete(picked); else s.add(picked);
  return [...s].sort((a, b) => a - b);
}

// A box: replaces the selection, or with Shift adds to it.
export function boxSelection(current, found, shift) {
  const s = new Set(shift ? current : []);
  for (const i of found) s.add(i);
  return [...s].sort((a, b) => a - b);
}

// Warnings that only inform: almost every drawing has text, blocks hold geometry by design, and a simplified
// drawing still has complete numbers.
export const INFO_WARNINGS = new Set(['not-measured', 'inside-blocks', 'simplified']);

// ✔ / ⚠ / ✖, or null while waiting. ⚠ means something needs the visitor's attention.
export function fileStatus(f) {
  if (!f.result) return null;
  if (f.result.type !== 'result') return 'error';
  return (f.result.warnings || []).some(w => !INFO_WARNINGS.has(w.id)) ? 'warn' : 'ok';
}

// What the engine is asked for one file: the page-wide units for files that state none, and the file's
// own override if the visitor set one.
export function engineSettings(settings, f) {
  const s = { units: settings.units || 'auto' };
  if (f.override && UNITS.includes(f.override)) s.override = f.override;
  return s;
}

// Files the engine will not see: too many for the batch, or too big (an error result made here).
export function admit(existing, incoming) {
  const room = Math.max(0, MAX_FILES - existing);
  const take = incoming.slice(0, room).map(f => (f.bytes.byteLength > MAX_BYTES
    ? { ...f, result: { type: 'error', reason: 'limit', message: 'over 30 MB' } }
    : f));
  return { take, dropped: incoming.length - take.length };
}

// The GA payload after a batch is read (spec §5): counts only, never names.
export function loadedEvent(files) {
  const ok = files.map(f => f.result).filter(r => r && r.type === 'result');
  return {
    files: files.length,
    errors: files.length - ok.length,
    layers: ok.reduce((a, r) => a + r.layers.length, 0),
    blocks: ok.reduce((a, r) => a + r.blocks.reduce((b, x) => b + x.count, 0), 0),
    schedules: ok.reduce((a, r) => a + r.schedules.length, 0),
  };
}
