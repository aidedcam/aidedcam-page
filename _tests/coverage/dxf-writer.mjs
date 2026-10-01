// A small DXF writer for the coverage pre-check's committed drawings (the example, the layer template and the
// browser fixture). It writes what AutoCAD writes for these entities, so the engine is tested on real group
// codes, not on a library's round trip:
//   - AutoCAD 2000 (AC1015) with $INSUNITS, a LAYER and a BLOCK_RECORD table, *Model_Space and *Paper_Space
//     blocks, and LWPOLYLINE entities (90 count, 70 flags, 43 width, 10/20 per vertex, 42 bulge after it);
//   - R12 (AC1009) with a LAYER table and TEXT entities, Greek text as Windows-1253 bytes under
//     $DWGCODEPAGE ANSI_1253, the way a Greek AutoCAD saves an R12 DXF.

// Group codes 10–59, 110–149 and 210–239 hold reals (AutoCAD writes them with a decimal point); 60–99, 170–179,
// 270–289 and 370–389 hold integers, written without one (a "6.0" there does not parse as 6).
const isReal = c => (c >= 10 && c <= 59) || (c >= 110 && c <= 149) || (c >= 210 && c <= 239);
const num = (c, v) => {
  if (!isReal(c)) { if (!Number.isInteger(v)) throw new Error(`group ${c} needs an integer, got ${v}`); return String(v); }
  return Number.isInteger(v) ? v.toFixed(1) : String(+v.toFixed(10));
};

// Windows-1253 for ASCII, the Greek block (U+0386–U+03CE map to 0xB6–0xFE) and the few Latin-1 signs it
// shares (§ « » ° ± ½ ©); anything else is refused, so a character the file can't hold never goes in silently.
const SHARED = new Set([0xa7, 0xab, 0xbb, 0xb0, 0xb1, 0xbd, 0xa9]);
export function cp1253(s) {
  const out = [];
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c < 0x80 || SHARED.has(c)) out.push(c);
    else if (c >= 0x0386 && c <= 0x03ce && c !== 0x0387 && c !== 0x038b && c !== 0x038d && c !== 0x03a2) out.push(c - 0x2d0);
    else throw new Error(`no Windows-1253 byte for U+${c.toString(16)}`);
  }
  return Uint8Array.from(out);
}

class Groups {
  constructor() { this.parts = []; }
  g(code, value) { this.parts.push(String(code).padStart(3), typeof value === 'number' ? num(code, value) : String(value)); return this; }
  text() { return this.parts.join('\r\n') + '\r\n'; }
}

// layers: [{ name, color }]; polylines: [{ layer, closed, verts: [[x, y, bulge?], …] }]
export function dxf2000({ units = 6, layers, polylines }) {
  const d = new Groups();
  let handle = 0x100;
  const h = () => (handle++).toString(16).toUpperCase();
  d.g(0, 'SECTION').g(2, 'HEADER')
    .g(9, '$ACADVER').g(1, 'AC1015')
    .g(9, '$DWGCODEPAGE').g(3, 'ANSI_1253')
    .g(9, '$INSUNITS').g(70, units)
    .g(0, 'ENDSEC');
  d.g(0, 'SECTION').g(2, 'TABLES');
  d.g(0, 'TABLE').g(2, 'LAYER').g(5, '2').g(100, 'AcDbSymbolTable').g(70, layers.length + 1);
  for (const l of [{ name: '0', color: 7 }, ...layers]) {
    d.g(0, 'LAYER').g(5, h()).g(330, '2').g(100, 'AcDbSymbolTableRecord').g(100, 'AcDbLayerTableRecord')
      .g(2, l.name).g(70, 0).g(62, l.color || 7).g(6, 'Continuous');
  }
  d.g(0, 'ENDTAB');
  d.g(0, 'TABLE').g(2, 'BLOCK_RECORD').g(5, '1').g(100, 'AcDbSymbolTable').g(70, 2);
  d.g(0, 'BLOCK_RECORD').g(5, '1F').g(330, '1').g(100, 'AcDbSymbolTableRecord').g(100, 'AcDbBlockTableRecord').g(2, '*Model_Space');
  d.g(0, 'BLOCK_RECORD').g(5, '1B').g(330, '1').g(100, 'AcDbSymbolTableRecord').g(100, 'AcDbBlockTableRecord').g(2, '*Paper_Space');
  d.g(0, 'ENDTAB');
  d.g(0, 'ENDSEC');
  d.g(0, 'SECTION').g(2, 'BLOCKS');
  for (const [rec, name, ps] of [['1F', '*Model_Space', false], ['1B', '*Paper_Space', true]]) {
    d.g(0, 'BLOCK').g(5, h()).g(330, rec).g(100, 'AcDbEntity');
    if (ps) d.g(67, 1);
    d.g(8, '0').g(100, 'AcDbBlockBegin').g(2, name).g(70, 0).g(10, 0).g(20, 0).g(30, 0).g(3, name).g(1, '');
    d.g(0, 'ENDBLK').g(5, h()).g(330, rec).g(100, 'AcDbEntity');
    if (ps) d.g(67, 1);
    d.g(8, '0').g(100, 'AcDbBlockEnd');
  }
  d.g(0, 'ENDSEC');
  d.g(0, 'SECTION').g(2, 'ENTITIES');
  for (const p of polylines) {
    d.g(0, 'LWPOLYLINE').g(5, h()).g(330, '1F').g(100, 'AcDbEntity').g(8, p.layer).g(100, 'AcDbPolyline')
      .g(90, p.verts.length).g(70, p.closed ? 1 : 0).g(43, 0);
    for (const [x, y, b] of p.verts) { d.g(10, x).g(20, y); if (b) d.g(42, b); }
  }
  d.g(0, 'ENDSEC');
  d.g(0, 'SECTION').g(2, 'OBJECTS').g(0, 'DICTIONARY').g(5, 'C').g(330, '0').g(100, 'AcDbDictionary').g(0, 'ENDSEC');
  d.g(0, 'EOF');
  return new TextEncoder().encode(d.text());                                   // ASCII only
}

// layers: [{ name, color }]; texts: [{ layer, x, y, height, text }]; Greek text is written in Windows-1253.
export function dxfR12({ layers, texts }) {
  const d = new Groups();
  d.g(0, 'SECTION').g(2, 'HEADER')
    .g(9, '$ACADVER').g(1, 'AC1009')
    .g(9, '$DWGCODEPAGE').g(3, 'ANSI_1253')
    .g(0, 'ENDSEC');
  d.g(0, 'SECTION').g(2, 'TABLES');
  d.g(0, 'TABLE').g(2, 'LAYER').g(70, layers.length + 1);
  for (const l of [{ name: '0', color: 7 }, ...layers]) d.g(0, 'LAYER').g(2, l.name).g(70, 0).g(62, l.color || 7).g(6, 'CONTINUOUS');
  d.g(0, 'ENDTAB');
  // STANDARD on arial.ttf, as in the IFC plans tool: without a STYLE table CAD falls back to txt, which has no Greek.
  d.g(0, 'TABLE').g(2, 'STYLE').g(70, 1);
  d.g(0, 'STYLE').g(2, 'STANDARD').g(70, 0).g(40, 0).g(41, 1).g(50, 0).g(71, 0).g(42, 2.5).g(3, 'arial.ttf').g(4, '');
  d.g(0, 'ENDTAB');
  d.g(0, 'ENDSEC');
  d.g(0, 'SECTION').g(2, 'ENTITIES');
  for (const t of texts) d.g(0, 'TEXT').g(8, t.layer).g(10, t.x).g(20, t.y).g(30, 0).g(40, t.height).g(1, t.text);
  d.g(0, 'ENDSEC');
  d.g(0, 'EOF');
  return cp1253(d.text());
}

// A rectangle as closed-polyline vertices, counter-clockwise from its lower-left corner.
export const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
