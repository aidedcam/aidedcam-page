// IFC floor plans: one storey's plan as an R12 DXF (spec §5). Pure: no DOM, no web-ifc.
// AC1009 under $DWGCODEPAGE ANSI_1253, so Greek text is written as Windows-1253 bytes; POLYLINE/VERTEX/SEQEND (no
// LWPOLYLINE in R12) and TEXT; every layer of spec §4 in the table, whether or not this storey uses it.
import { LAYERS } from './layers.js?v=20261103';
import { forEachPolyline } from './chain.js?v=20261103';
import { labelLines } from './rooms.js?v=20261103';

// The drawing units the visitor chooses: the factor from metres and the $INSUNITS code.
export const UNITS = { m: { factor: 1, insunits: 6 }, cm: { factor: 100, insunits: 5 }, mm: { factor: 1000, insunits: 4 } };
export const TEXT_HEIGHT_M = 0.2;          // room labels, in metres of the model (200 in mm, 20 in cm)
const LINE_STEP = 1.6;                     // the labels' line spacing, in text heights

// Windows-1253, bytes 0x80–0xFF (U+FFFD where the code page has no character).
const HIGH = '€�‚ƒ„…†‡�‰�‹�����‘’“”•–—�™�›����' +
  ' ΅Ά£¤¥¦§¨©�«¬­®―°±²³΄µ¶·ΈΉΊ»Ό½ΎΏ' +
  'ΐΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡ�ΣΤΥΦΧΨΩΪΫάέήί' +
  'ΰαβγδεζηθικλμνξοπρςστυφχψωϊϋόύώ�';
const TO_1253 = new Map([...HIGH].map((c, i) => [c, 0x80 + i]).filter(([c]) => c !== '�'));
export const CP1253_HIGH = HIGH;

// A string as Windows-1253 bytes, composed first (NFC), so decomposed Greek and the polytonic acute (U+1F71 → ά)
// are written. A character the code page lacks becomes '?', and is counted.
export function cp1253(s) {
  const out = [];
  let replaced = 0;
  for (const ch of String(s).normalize('NFC')) {
    const c = ch.codePointAt(0);
    if (c < 0x80) { out.push(c); continue; }
    const b = TO_1253.get(ch);
    if (b === undefined) { out.push(0x3f); replaced++; } else out.push(b);
  }
  return { bytes: Uint8Array.from(out), replaced };
}

// How many characters of these strings Windows-1253 can't hold, once composed as cp1253 composes them.
export function unencodable(strings) {
  let n = 0;
  for (const s of strings) for (const ch of String(s == null ? '' : s).normalize('NFC')) if (ch.codePointAt(0) >= 0x80 && !TO_1253.has(ch)) n++;
  return n;
}

// "Move to origin": the model's lower-left corner, rounded down to whole metres.
export function originShift(bbox) {
  return { x: Math.floor(bbox.x0), y: Math.floor(bbox.y0) };
}

// A real: at most 6 decimals, always with a decimal point, never "-0", never NaN or Infinity (written 0).
export function num(v) {
  if (!Number.isFinite(v)) return '0.0';
  let s = String(+v.toFixed(6));
  if (s === '-0') s = '0';
  return /[.e]/.test(s) ? s : `${s}.0`;
}

const line = s => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ');
const fmtM = (v, d) => (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d);

// The plan of one storey. storey: { name, levelM, layers: { LAYER: packed polylines }, rooms: [{ name, longName,
// areaM2, at: [x, y] }] }, in metres in the IFC's coordinates. source: the IFC file name; units: 'm' | 'cm' | 'mm';
// shift: null, or { x, y } in metres subtracted from every coordinate. Returns { bytes, replaced }.
export function storeyDxf({ storey, source, cutM, units = 'm', shift = null }) {
  const u = UNITS[units] || UNITS.m;
  const f = u.factor, sx = shift ? shift.x : 0, sy = shift ? shift.y : 0;
  const X = x => (x - sx) * f, Y = y => (y - sy) * f;
  const out = [];
  const g = (code, value) => { out.push(String(code).padStart(3), value); };
  const unit = units in UNITS ? units : 'm';
  g(999, `IFC floor plan from aidedcam.com/ifc-plans.html`);
  g(999, `Source: ${line(source)}`);
  g(999, `Storey: ${line(storey.name)}, level ${fmtM(storey.levelM, 3)} m`);
  g(999, `Cut: ${fmtM(cutM, 2)} m above the storey level, at ${fmtM(storey.levelM + cutM, 3)} m`);
  g(999, `Units: ${unit}`);
  g(999, shift
    ? `Shift: X ${String(-sx * f)} ${unit}, Y ${String(-sy * f)} ${unit}; add it back to return to the IFC's coordinates`
    : `Shift: none; the IFC's coordinates`);

  // Entities first, to know the extents.
  const ents = [];
  const e = (code, value) => { ents.push(String(code).padStart(3), value); };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const extend = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
  for (const l of LAYERS) {
    const set = storey.layers && storey.layers[l.name];
    if (!set) continue;
    forEachPolyline(set, (pts, closed) => {
      if (pts.length < 4) return;
      e(0, 'POLYLINE'); e(8, l.name); e(66, '1'); e(10, '0.0'); e(20, '0.0'); e(30, '0.0'); e(70, closed ? '1' : '0');
      for (let i = 0; i < pts.length; i += 2) {
        const x = X(pts[i]), y = Y(pts[i + 1]);
        extend(x, y);
        e(0, 'VERTEX'); e(8, l.name); e(10, num(x)); e(20, num(y)); e(30, '0.0');
      }
      e(0, 'SEQEND'); e(8, l.name);
    });
  }
  const h = TEXT_HEIGHT_M * f;
  const texts = [];
  for (const r of storey.rooms || []) {
    if (!r.at) continue;
    const lines = labelLines(r);
    lines.forEach((t, i) => {
      const x = X(r.at[0]), y = Y(r.at[1]) + ((lines.length - 1) / 2 - i) * LINE_STEP * h;
      extend(x, y);
      texts.push(t);
      e(0, 'TEXT'); e(8, 'IFC_SPACE_TEXT'); e(10, num(x)); e(20, num(y)); e(30, '0.0'); e(40, num(h)); e(1, line(t));
      e(72, '1'); e(73, '2'); e(11, num(x)); e(21, num(y)); e(31, '0.0');
    });
  }
  if (x0 > x1) x0 = y0 = x1 = y1 = 0;

  g(0, 'SECTION'); g(2, 'HEADER');
  g(9, '$ACADVER'); g(1, 'AC1009');
  g(9, '$DWGCODEPAGE'); g(3, 'ANSI_1253');
  g(9, '$INSUNITS'); g(70, String(u.insunits));
  g(9, '$EXTMIN'); g(10, num(x0)); g(20, num(y0)); g(30, '0.0');
  g(9, '$EXTMAX'); g(10, num(x1)); g(20, num(y1)); g(30, '0.0');
  g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'TABLES');
  g(0, 'TABLE'); g(2, 'LTYPE'); g(70, '1');
  g(0, 'LTYPE'); g(2, 'CONTINUOUS'); g(70, '0'); g(3, 'Solid line'); g(72, '65'); g(73, '0'); g(40, '0.0');
  g(0, 'ENDTAB');
  g(0, 'TABLE'); g(2, 'LAYER'); g(70, String(LAYERS.length + 1));
  for (const l of [{ name: '0', aci: 7 }, ...LAYERS]) { g(0, 'LAYER'); g(2, l.name); g(70, '0'); g(62, String(l.aci)); g(6, 'CONTINUOUS'); }
  g(0, 'ENDTAB');
  g(0, 'TABLE'); g(2, 'STYLE'); g(70, '1');
  g(0, 'STYLE'); g(2, 'STANDARD'); g(70, '0'); g(40, '0.0'); g(41, '1.0'); g(50, '0.0'); g(71, '0'); g(42, num(h)); g(3, 'arial.ttf'); g(4, '');
  g(0, 'ENDTAB');
  g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'ENTITIES');
  for (const v of ents) out.push(v);
  g(0, 'ENDSEC');
  g(0, 'EOF');
  return cp1253(out.join('\r\n') + '\r\n');
}
