// Text → blocks. Pure: no DOM. See _docs/gcode-viewer/2026-09-26-gcode-viewer-design.md §4.
const WORD_RE = /([A-Z])\s*([+-]?(?:\d+\.?\d*|\.\d+))/g;

export function parseProgram(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const blocks = new Array(lines.length);
  for (let i = 0; i < lines.length; i++) blocks[i] = parseLine(lines[i], i + 1);
  return blocks;
}

export function parseLine(raw, line) {
  const block = { line, n: null, o: null, words: [], comment: null, raw, skipped: null, deleted: false };
  const comments = [];
  // ( ... ) comments, including an unclosed one that runs to the end of the line.
  let s = raw.replace(/\t/g, ' ').replace(/\(([^)]*)\)?/g, (_, c) => { comments.push(c.trim()); return ' '; });
  const semi = s.indexOf(';');
  if (semi >= 0) { comments.push(s.slice(semi + 1).trim()); s = s.slice(0, semi); }
  const text = comments.filter(Boolean).join(' ');
  if (text) block.comment = text;

  s = s.trim();
  if (s.startsWith('/')) { block.deleted = true; s = s.slice(1).trim(); }
  if (s === '' || s === '%') { block.skipped = 'blank'; return block; }
  const up = s.toUpperCase();
  if (up.includes('[')) { block.skipped = 'expression'; return block; }
  if (up.includes('#')) { block.skipped = 'macro'; return block; }

  WORD_RE.lastIndex = 0;
  let m;
  // start/end are offsets into the normalized line (comments and tabs replaced, uppercased),
  // not into block.raw; they exist only to detect a W glued to a T (mergeToolOffsetWord).
  while ((m = WORD_RE.exec(up)) !== null) {
    const numRaw = m[2];
    block.words.push({
      letter: m[1], value: Number(numRaw), raw: numRaw, hasDecimal: numRaw.includes('.'),
      start: m.index, end: m.index + m[0].length,
    });
  }
  mergeToolOffsetWord(block);
  for (const w of block.words) {
    if (w.letter === 'N' && block.n === null) block.n = w.value;
    if (w.letter === 'O' && block.o === null) block.o = w.value;
  }
  block.words = block.words.filter(w => w.letter !== 'N' && w.letter !== 'O');
  return block;
}

// Some controls call tools as T3W303 (tool 3, wear offset 303). Read literally, W303 would be an
// incremental Z move of 303 mm. A W glued to a T (no space between them) belongs to the tool call.
function mergeToolOffsetWord(block) {
  const ws = block.words;
  for (let i = 0; i + 1 < ws.length; i++) {
    if (ws[i].letter === 'T' && ws[i + 1].letter === 'W' && ws[i + 1].start === ws[i].end) {
      ws[i].toolKey = `T${ws[i].raw}W${ws[i + 1].raw}`;
      ws.splice(i + 1, 1);
    }
  }
}
