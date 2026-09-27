import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMill } from '../../js/mill/analyze.js';
import { K_CFEED } from '../../js/mill/moves.js';

const zs = r => Array.from({ length: r.moves.count }, (_, i) => r.moves.pos[i * 6 + 5]);
const feeds = r => Array.from(r.moves.kind).filter(k => k === K_CFEED).length;
const ids = r => r.warnings.map(w => w.id);

test('G99 returns to R between holes, G98 to the initial level; the initial level is fixed at cycle start', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z50\nG99 G81 X10 Y10 Z-10 R2 F100\nX20\nG98 X30\nG80\nG0 Z60');
  assert.equal(r.cycles, 3);
  assert.equal(feeds(r), 3);
  assert.deepEqual(zs(r), [50, 2, -10, 2, 2, -10, 2, 2, -10, 50, 60]);
});

test('G91: R from the initial level, Z from R, X/Y incremental per K repeat', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z10\nG91 G99 G81 X10 Z-5 R-8 K3 F100\nG80 G90');
  assert.equal(r.cycles, 3);
  const bottoms = [];
  for (let i = 0; i < r.moves.count; i++) {
    if (r.moves.kind[i] === K_CFEED) bottoms.push([r.moves.pos[i * 6 + 3], r.moves.pos[i * 6 + 5]]);
  }
  assert.deepEqual(bottoms, [[10, -3], [20, -3], [30, -3]]);
});

test('K0 stores the cycle without drilling; the next X/Y block drills', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z10\nG81 X10 Y0 Z-5 R2 F100 K0\nX20\nG80');
  assert.equal(r.cycles, 1);
});

test('G0 cancels the cycle: the next block is a plain rapid', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z10\nG81 X10 Y0 Z-5 R2 F100\nG0 X50');
  assert.equal(r.cycles, 1);
  assert.equal(r.moves.pos[(r.moves.count - 1) * 6 + 3], 50);
});

test('peck cycles draw every peck', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z10\nG98 G83 X0 Y0 Z-10 R2 Q5 F100');
  assert.equal(feeds(r), 3);                               // 2 → -3 → -8 → -10
});

test('a missing R draws from the current level and reports cycle-no-r; the row time becomes "–"', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z10\nG81 X10 Y0 Z-5 F100');
  assert.ok(ids(r).includes('cycle-no-r'));
  assert.equal(feeds(r), 1);
  assert.equal(r.timing.rows[0].incomplete, true);
  assert.equal(r.markers.length, 1);
});

test('a peck cycle without Q reports peck-no-q and drills in one feed', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z10\nG83 X10 Y0 Z-5 R2 F100');
  assert.ok(ids(r).includes('peck-no-q'));
  assert.equal(feeds(r), 1);
});

test('a cycle with no known start level starts from R and reports cycle-no-start', () => {
  const r = analyzeMill('G81 X10 Y0 Z-5 R2 F100');
  assert.ok(ids(r).includes('cycle-no-start'));
  assert.equal(feeds(r), 1);
});

test('G76/G87/G88 are approximated; drilling in G18 is not interpreted', () => {
  assert.ok(analyzeMill('G90 G0 X0 Y0 Z10\nG76 X10 Y0 Z-5 R2 Q0.1 F100').warnings
    .some(w => w.id === 'approximated' && w.params.code === 'G76'));
  const g18 = analyzeMill('G90 G0 X0 Y0 Z10\nG18 G81 X10 Y0 Z-5 R2 F100');
  assert.ok(g18.warnings.some(w => w.id === 'unsupported' && w.params.code === 'G81'));
  assert.equal(g18.cycles, 0);
});

test('G84.2/G84.3 are read as G84/G74 tapping', () => {
  const r = analyzeMill('G90 G0 X0 Y0 Z10\nG98 G84.2 X10 Y0 Z-5 R2 F100');
  assert.equal(r.cycles, 1);
  assert.equal(feeds(r), 2);                               // tap in, tap out
});

test('hole time: feed moves at F, rapids at the rapid rate', () => {
  const r = analyzeMill('G90 G0 X10 Y0 Z10\nG98 G81 X10 Y0 Z-5 R2 F100');
  const sec = Array.from(r.moves.seconds);
  // rapid 10 → 2 (8 mm at 30,000 mm/min), feed 2 → -5 (7 mm at 100 mm/min), rapid -5 → 10 (15 mm)
  assert.ok(Math.abs(sec[0] - 0.016) < 1e-6 && Math.abs(sec[1] - 4.2) < 1e-6 && Math.abs(sec[2] - 0.03) < 1e-6);
});
