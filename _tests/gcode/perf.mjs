// Generates a 50,000-line CAM-style lathe program and times the pure pipeline. Run: node _tests/gcode/perf.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { analyze } from '../../js/gcode/analyze.js';
import { buildScene, buildIndex } from '../../js/gcode/render.js';

const lines = ['G21 G99', 'G50 S3000', 'G96 S200 M3', 'T0101', 'G0 X100 Z2'];
let z = 0;
for (let i = 0; lines.length < 50000; i++) {
  const x = 60 + 20 * Math.sin(i / 50);
  z -= 0.01;
  lines.push(i % 25 === 0 ? `G2 X${x.toFixed(3)} Z${z.toFixed(3)} R40` : `G1 X${x.toFixed(3)} Z${z.toFixed(3)} F0.1`);
}
lines.push('M30');
const text = lines.join('\n');
mkdirSync(new URL('../private/', import.meta.url), { recursive: true });
writeFileSync(new URL('../private/perf-50k.nc', import.meta.url), text);

const t0 = performance.now();
const r = analyze(text);
const t1 = performance.now();
const sc = buildScene(r);
buildIndex(sc.polylines, sc.bounds, 64);
const t2 = performance.now();
console.log(`lines ${r.lines} · segments ${r.segments.length} · analyze ${(t1 - t0).toFixed(0)} ms · scene+index ${(t2 - t1).toFixed(0)} ms`);
if (t2 - t0 > 1500) { console.error('Too slow: over 1500 ms for 50k lines'); process.exit(1); }
