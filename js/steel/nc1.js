// Steel take-off: the DSTV (NC1) parser (spec §3). One file describes one piece: the ST header, then blocks, each a
// two-character code alone at the start of a line followed by its data lines, up to EN. BO (holes), AK (outer
// contours) and IK (inner contours) are read; SI, KO, PU, KA and any other block are read and skipped. Lines that
// start with ** are comments. Lengths are in mm, the weight in kg/m and the painting surface in m²/m, as DSTV defines
// them. Pure: text in, { ok: true, piece } or { ok: false, reason, line } out.

// The DSTV profile codes; a blank or unknown code is read as SO (special).
export const CODES = ['I', 'L', 'U', 'B', 'RU', 'RO', 'M', 'C', 'T', 'SO'];
const FACES = new Set(['v', 'o', 'u', 'h']);
const BLOCK = /^([A-Z][A-Z0-9])\s*$/;              // a block code: two characters from column 0, alone on the line
const isComment = s => s.trimStart().startsWith('**');

// A DSTV number: a point or a comma as the decimal mark. '' is null; anything else that is not a number is NaN.
export function num(s) {
  const t = String(s == null ? '' : s).trim();
  if (!t) return null;
  if (!/^[+-]?(\d+([.,]\d*)?|[.,]\d+)([eE][+-]?\d+)?$/.test(t)) return NaN;
  return Number(t.replace(',', '.'));
}

// The length line may carry the saw length after a comma ("6236.88,6230.00"). A single comma with at most three
// digits after it and no point is a decimal comma ("6236,88"); otherwise the comma separates the two values.
export function lengthPair(s) {
  const t = String(s == null ? '' : s).trim();
  const parts = t.split(',');
  if (parts.length === 2 && !t.includes('.') && /^\s*\d{1,3}\s*$/.test(parts[1])) return { length: num(t), saw: null };
  if (parts.length >= 2) return { length: num(parts[0]), saw: num(parts[1]) };
  return { length: num(t), saw: null };
}

// One data token: a number with an optional letter suffix ("674.41s", "0.00w", "-10.00").
function token(s) {
  const m = /^([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?)([a-z]*)$/.exec(s);
  return m ? { v: Number(m[1].replace(',', '.')), suffix: m[2] } : null;
}

// A data line: its face (the line's own, or the one before it in the block) and its numbers.
function dataLine(line, face) {
  const parts = line.trim().split(/\s+/);
  let f = face;
  if (FACES.has(parts[0])) f = parts.shift();
  const nums = [];
  for (const p of parts) {
    const x = token(p);
    if (!x) return null;
    nums.push(x);
  }
  return { face: f, nums };
}

const HEADER_TEXT = ['order', 'drawing', 'phase', 'mark', 'grade'];
const HEADER_NUM = ['h', 'b', 'tf', 'tw', 'r', 'kgm', 'm2m', 'webStart', 'webEnd', 'flangeStart', 'flangeEnd'];

export function parseNc1(text) {
  const lines = String(text).replace(/^﻿/, '').split(/\r\n|\r|\n/);
  let i = 0;
  while (i < lines.length && (!lines[i].trim() || isComment(lines[i]))) i++;
  if (i >= lines.length || lines[i].trim() !== 'ST') return { ok: false, reason: 'notnc1' };
  i++;

  // ---- the header: twenty fields, one per line, then up to four lines of text ----
  const fields = [];
  let lastLine = i;
  for (; i < lines.length && fields.length < 20; i++) {
    if (isComment(lines[i])) continue;
    fields.push({ s: lines[i], line: i + 1 });
    lastLine = i + 1;
  }
  if (fields.length < 20) return { ok: false, reason: 'broken', line: Math.min(lastLine + 1, lines.length) };   // the end of the file
  const piece = {};
  HEADER_TEXT.forEach((k, j) => { piece[k] = fields[j].s.trim(); });
  const qty = num(fields[5].s);
  if (Number.isNaN(qty)) return { ok: false, reason: 'broken', line: fields[5].line };
  piece.qty = qty === null ? 0 : qty;
  let profile = fields[6].s.trim(), code = fields[7].s.trim().toUpperCase();
  // Some writers swap the profile name and its code; the code is the one DSTV knows.
  if (CODES.includes(profile.toUpperCase()) && !CODES.includes(code)) [profile, code] = [fields[7].s.trim(), profile.toUpperCase()];
  piece.profile = profile;
  piece.code = CODES.includes(code) ? code : 'SO';
  const len = lengthPair(fields[8].s);
  if (Number.isNaN(len.length) || Number.isNaN(len.saw)) return { ok: false, reason: 'broken', line: fields[8].line };
  piece.length = len.length || 0;
  piece.sawLength = len.saw;
  for (let j = 0; j < HEADER_NUM.length; j++) {
    const v = num(fields[9 + j].s);
    if (Number.isNaN(v)) return { ok: false, reason: 'broken', line: fields[9 + j].line };
    piece[HEADER_NUM[j]] = v === null ? 0 : v;
  }
  piece.text = [];
  while (i < lines.length && piece.text.length < 4 && !BLOCK.test(lines[i])) {
    if (!isComment(lines[i])) piece.text.push(lines[i].trim());
    i++;
  }

  // ---- the blocks ----
  piece.holes = [];
  piece.contours = [];
  piece.skipped = {};
  let block = null, face = 'v', contour = null;
  const endContour = () => { if (contour && contour.pts.length) piece.contours.push(contour); contour = null; };
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || isComment(line)) continue;
    const m = BLOCK.exec(line);
    if (m) {
      endContour();
      block = m[1];
      face = 'v';
      if (block === 'EN') break;
      if (block !== 'BO' && block !== 'AK' && block !== 'IK') piece.skipped[block] = (piece.skipped[block] || 0) + 1;
      continue;
    }
    if (!block) return { ok: false, reason: 'broken', line: i + 1 };
    if (block !== 'BO' && block !== 'AK' && block !== 'IK') continue;
    const d = dataLine(line, face);
    if (!d || d.nums.length < 3) return { ok: false, reason: 'broken', line: i + 1 };
    face = d.face;
    const n = d.nums;
    if (block === 'BO') {
      const slot = n.length > 4 && n[4].v > 0 ? { l: n[4].v, w: n.length > 5 ? n[5].v : 0, angle: n.length > 6 ? n[6].v : 0 } : null;
      piece.holes.push({ face, x: n[0].v, y: n[1].v, d: n[2].v, depth: n.length > 3 ? n[3].v : 0, slot, ref: n[0].suffix, line: i + 1 });
      continue;
    }
    // AK / IK: x, y, radius (an arc from this point to the next, its centre left of the way for a positive radius,
    // right for a negative one), then optional bevel fields.
    // A suffix after x names the edge it is measured from; 'w' or 't' after y marks a notch. A new contour starts at a
    // face change, or after a point that closes the contour on its first point.
    const p = { x: n[0].v, y: n[1].v, r: n[2].v, ref: n[0].suffix, notch: /[wt]/.test(n[1].suffix) };
    if (contour && contour.face !== face) endContour();
    if (!contour) contour = { kind: block, face, pts: [] };
    contour.pts.push(p);
    const first = contour.pts[0];
    if (contour.pts.length >= 3 && Math.abs(p.x - first.x) < 1e-6 && Math.abs(p.y - first.y) < 1e-6) {
      contour.pts.pop();
      endContour();
    }
  }
  endContour();
  return { ok: true, piece };
}
