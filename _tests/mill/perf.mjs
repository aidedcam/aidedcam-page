// Generates a 1,000,000-line 3D surfacing program (synthetic) and times the milling pipeline.
// Run: node _tests/mill/perf.mjs      Target (spec §3.4): analyze under 4 s.
import { writeFileSync, mkdirSync } from 'node:fs';
import { analyzeMill } from '../../js/mill/analyze.js';

const lines = ['%', 'O0100 (PERF SURFACE)', 'G21 G17 G40 G49 G80 G90', '(BALL MILL D6)', 'T1 M6',
  'G0 G54 X0 Y0 S12000 M3', 'G43 Z20 H1', 'G1 Z0 F2000'];
const N = 1000000, perRow = 1000;
for (let i = 0; lines.length < N - 3; i++) {
  const row = Math.floor(i / perRow), k = i % perRow;
  const x = (row % 2 ? perRow - k : k) * 0.1;             // zig-zag raster, 0.1 mm steps
  const y = row * 0.2;
  const z = -2 - 1.5 * Math.sin(x / 7) * Math.cos(y / 9);
  lines.push(`X${x.toFixed(3)} Y${y.toFixed(3)} Z${z.toFixed(3)}`);
}
lines.push('G0 Z20', 'M30', '%');
const text = lines.join('\n');
mkdirSync(new URL('../private/', import.meta.url), { recursive: true });
writeFileSync(new URL('../private/perf-mill-1m.nc', import.meta.url), text);

const t0 = performance.now();
const r = analyzeMill(text);
const t1 = performance.now();
const mb = (process.memoryUsage().heapUsed / 1048576).toFixed(0);
console.log(`lines ${r.lines} · moves ${r.moves.count} · analyze ${(t1 - t0).toFixed(0)} ms · heap ${mb} MB`);
if (t1 - t0 > 4000) { console.error('Too slow: over 4000 ms for 1M lines'); process.exit(1); }
