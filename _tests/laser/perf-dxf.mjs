// Writes a synthetic "typical part" at the spec's size (§11: under 5,000 curves) for the browser timing
// page: a 360 × 410 mm plate with 1,250 slots, each two lines and two arcs, so 5,004 curves.
// Run: node _tests/laser/perf-dxf.mjs      Then open /_tests/laser/perf.html on the local server.
import { writeFileSync, mkdirSync } from 'node:fs';

const out = [];
const g = (code, v) => out.push(String(code), String(v));
const n = v => (Math.round(v * 1e6) / 1e6).toString();
const line = (x1, y1, x2, y2) => { g(0, 'LINE'); g(8, 'CUT'); g(10, n(x1)); g(20, n(y1)); g(30, 0); g(11, n(x2)); g(21, n(y2)); g(31, 0); };
const arc = (cx, cy, r, a0, a1) => { g(0, 'ARC'); g(8, 'CUT'); g(10, n(cx)); g(20, n(cy)); g(30, 0); g(40, n(r)); g(50, n(a0)); g(51, n(a1)); };

g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(0, 'ENDSEC');
g(0, 'SECTION'); g(2, 'ENTITIES');
const W = 360, H = 410;
line(0, 0, W, 0); line(W, 0, W, H); line(W, H, 0, H); line(0, H, 0, 0);
let curves = 4;
for (let row = 0; row < 50; row++) {
  for (let col = 0; col < 25; col++) {
    const x = 8 + col * 14, y = 6 + row * 8;           // slot: 6 mm straight, R2 ends, 10 × 4 overall
    line(x, y, x + 6, y); arc(x + 6, y + 2, 2, 270, 90); line(x + 6, y + 4, x, y + 4); arc(x, y + 2, 2, 90, 270);
    curves += 4;
  }
}
g(0, 'ENDSEC'); g(0, 'EOF');

mkdirSync(new URL('../private/', import.meta.url), { recursive: true });
writeFileSync(new URL('../private/perf-5000.dxf', import.meta.url), out.join('\r\n') + '\r\n');
console.log(`perf-5000.dxf: ${curves} curves, 1 part with 1250 holes`);
