// Shared by both viewers: every way a program gets in (file, keyboard, example, paste button,
// Ctrl+V, drop anywhere), the Greek legacy-encoding fallback, and the lathe ↔ milling handoff.

// Greek comments saved as Windows-1253 decode as U+FFFD under UTF-8: re-decode the same bytes.
export async function readFileText(f) {
  const buf = await f.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buf);
  return utf8.includes('�') ? new TextDecoder('windows-1253').decode(buf) : utf8;
}

// onText(text, source, name) with source 'file' | 'example' | 'paste'. onError(kind) with kind
// 'read' (a file couldn't be read), 'size' (a file over maxBytes, not read) or 'paste' (the browser
// refused the clipboard read).
export function wireInputs({ fileInput, exampleButton, example, pasteButton, dropRoot, isEditing, onText, onError, maxBytes = Infinity }) {
  async function loadFile(f) {
    if (f.size > maxBytes) { onError('size'); return; }
    let text;
    try { text = await readFileText(f); }
    catch (err) { console.error(err); onError('read'); return; }
    onText(text, 'file', f.name);
  }
  // Space opens the file dialog natively; Enter too, for parity with buttons.
  fileInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fileInput.click(); } });
  fileInput.addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0];
    if (f) await loadFile(f);
    e.target.value = '';
  });
  exampleButton.addEventListener('click', () => onText(example, 'example', 'example.nc'));
  pasteButton.addEventListener('click', async () => {
    let txt;
    try { txt = await navigator.clipboard.readText(); }       // only the clipboard read is guarded here
    catch (e) { onError('paste'); return; }
    if (txt) onText(txt, 'paste', '');
  });
  document.addEventListener('paste', e => {
    if (isEditing() || (e.target.closest && e.target.closest('input, textarea, select'))) return;
    const txt = e.clipboardData && e.clipboardData.getData('text');
    if (txt) { e.preventDefault(); onText(txt, 'paste', ''); }
  });
  // Drop anywhere: a file dropped on the nav or footer must load, not navigate away.
  document.addEventListener('dragover', e => { e.preventDefault(); dropRoot.classList.add('gv-dragging'); });
  document.addEventListener('dragleave', e => { if (!e.relatedTarget) dropRoot.classList.remove('gv-dragging'); });
  document.addEventListener('drop', async e => {
    e.preventDefault();
    dropRoot.classList.remove('gv-dragging');
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) await loadFile(f);
    else { const txt = e.dataTransfer.getData('text'); if (txt) onText(txt, 'paste', ''); }
  });
}

// ---- lathe ↔ milling handoff (spec §2): the program moves between the two pages in
// sessionStorage, so it never leaves the browser. The storage object is a parameter so Node can
// test this with a stand-in.
export const HANDOFF_KEY = 'aidedcam-gv-handoff';
export const HANDOFF_MAX_CHARS = 4 * 1024 * 1024;

export function writeHandoff(storage, text, name) {
  if (text.length > HANDOFF_MAX_CHARS) return false;
  try { storage.setItem(HANDOFF_KEY, JSON.stringify({ text, name })); return true; }
  catch (e) { return false; }
}

export function takeHandoff(storage) {
  let raw = null;
  try { raw = storage.getItem(HANDOFF_KEY); storage.removeItem(HANDOFF_KEY); } catch (e) { return null; }
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v.text === 'string' ? { text: v.text, name: typeof v.name === 'string' ? v.name : '' } : null;
  } catch (e) { return null; }
}
