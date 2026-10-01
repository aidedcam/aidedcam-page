// Reads back the R12 DXF the IFC plans tool writes, strictly enough to catch a broken structure: group codes and
// values in pairs, the sections in order, every POLYLINE closed by a SEQEND, every VERTEX inside a POLYLINE, EOF
// last. Text is decoded from Windows-1253 (the file's $DWGCODEPAGE).
export function readDxf(bytes) {
  const text = new TextDecoder('windows-1253').decode(bytes);
  const crlf = text.includes('\r\n') && !/[^\r]\n/.test(text);
  const lines = text.split('\r\n');
  if (lines.pop() !== '') throw new Error('the file does not end with a line break');
  if (lines.length % 2) throw new Error('an odd number of lines');
  const pairs = [];
  for (let i = 0; i < lines.length; i += 2) {
    if (!/^\s*\d+$/.test(lines[i])) throw new Error(`line ${i + 1}: not a group code: ${lines[i]}`);
    pairs.push([+lines[i], lines[i + 1]]);
  }
  const out = { crlf, padded: lines.filter((_, i) => i % 2 === 0).every(c => c.length === 3), comments: [], header: {}, layers: [], styles: [], sections: [], entities: [] };
  let i = 0;
  const next = () => pairs[i++];
  while (i < pairs.length && pairs[i][0] === 999) out.comments.push(next()[1]);
  for (;;) {
    const [c, v] = next();
    if (c !== 0) throw new Error(`expected 0, got ${c}`);
    if (v === 'EOF') break;
    if (v !== 'SECTION') throw new Error(`expected SECTION, got ${v}`);
    const [c2, name] = next();
    if (c2 !== 2) throw new Error('a section without a name');
    out.sections.push(name);
    const body = [];
    for (;;) { const p = next(); if (!p) throw new Error(`${name}: no ENDSEC`); if (p[0] === 0 && p[1] === 'ENDSEC') break; body.push(p); }
    if (name === 'HEADER') {
      let key = null;
      for (const [k, val] of body) {
        if (k === 9) { key = val; out.header[key] = []; } else out.header[key].push(k === 10 || k === 20 || k === 30 ? +val : val);
      }
      for (const k of Object.keys(out.header)) if (out.header[k].length === 1) out.header[k] = out.header[k][0];
    } else if (name === 'TABLES') {
      let cur = null;
      for (const [k, val] of body) {
        if (k === 0) { cur = val === 'LAYER' ? { name: null, color: null } : val === 'STYLE' ? { style: true } : null; if (cur && !cur.style) out.layers.push(cur); if (cur && cur.style) out.styles.push(cur); continue; }
        if (!cur) continue;
        if (cur.style) { if (k === 2) cur.name = val; if (k === 42) cur.height = +val; } else if (k === 2) cur.name = val; else if (k === 62) cur.color = +val;
      }
    } else if (name === 'ENTITIES') {
      let poly = null, ent = null;
      for (const [k, val] of body) {
        if (k === 0) {
          if (val === 'VERTEX') { if (!poly) throw new Error('a VERTEX outside a POLYLINE'); ent = { v: true }; poly.pts.push(ent); continue; }
          if (val === 'SEQEND') { if (!poly) throw new Error('a SEQEND without a POLYLINE'); poly.pts = poly.pts.flatMap(p => [p.x, p.y]); poly = null; ent = null; continue; }
          if (poly) throw new Error(`${val} inside a POLYLINE`);
          if (val === 'POLYLINE') { poly = { type: 'POLYLINE', layer: null, closed: false, pts: [] }; out.entities.push(poly); ent = poly; continue; }
          if (val === 'TEXT') { ent = { type: 'TEXT' }; out.entities.push(ent); continue; }
          throw new Error(`unexpected entity ${val}`);
        }
        if (!ent) continue;
        if (ent.v) { if (k === 10) ent.x = +val; if (k === 20) ent.y = +val; continue; }
        if (k === 8) ent.layer = val;
        if (ent.type === 'POLYLINE' && k === 70) ent.closed = (+val & 1) === 1;
        if (ent.type === 'TEXT') {
          if (k === 10) ent.x = +val; if (k === 20) ent.y = +val; if (k === 40) ent.h = +val; if (k === 1) ent.text = val;
          if (k === 72) ent.h72 = +val; if (k === 73) ent.v73 = +val; if (k === 11) ent.ax = +val; if (k === 21) ent.ay = +val;
        }
      }
      if (poly) throw new Error('a POLYLINE without its SEQEND');
    }
  }
  if (i !== pairs.length) throw new Error('data after EOF');
  return out;
}
