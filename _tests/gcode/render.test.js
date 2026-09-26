import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyze } from '../../js/gcode/analyze.js';
import { layerOf, toPathD, buildScene, viewBoxFor, buildIndex, nearestSegment, segmentsByLine } from '../../js/gcode/render.js';

const g71 = analyze(readFileSync(new URL('./fixtures/g71-od.nc', import.meta.url), 'utf8'));

test('layers: rapids, programmed feeds, control-generated passes', () => {
  assert.equal(layerOf({ kind: 'rapid', cycle: null }), 'rapid');
  assert.equal(layerOf({ kind: 'feed', cycle: null }), 'feed');
  assert.equal(layerOf({ kind: 'feed', cycle: { code: 70 } }), 'feed');
  assert.equal(layerOf({ kind: 'pass', cycle: { code: 71 } }), 'pass');
  assert.equal(layerOf({ kind: 'dwell', cycle: null }), null);
});

test('path strings: connected polylines continue, gaps start a new M; y is -x', () => {
  assert.equal(toPathD([[{ x: 0, z: 0 }, { x: 0, z: 10 }], [{ x: 0, z: 10 }, { x: 5, z: 10 }]]), 'M0 0L10 0L10 -5');
  assert.equal(toPathD([[{ x: 0, z: 0 }, { x: 0, z: 10 }], [{ x: 1, z: 0 }, { x: 1, z: 5 }]]), 'M0 0L10 0M0 -1L5 -1');
});

test('scene of the G71 fixture: passes drawn, bounds include the centreline and the last move', () => {
  const sc = buildScene(g71);
  assert.ok(sc.paths.pass.length > 0);
  assert.ok(sc.paths.profile.length > 0);
  assert.equal(sc.bounds.minX, 0);
  assert.equal(sc.bounds.maxZ, 100);
  assert.equal(sc.fitBounds.maxZ, 2);                    // Fit ignores the far rapid to Z100
  assert.equal(sc.fitBounds.maxX, 50);
  assert.deepEqual(sc.starts.find(s => s.code === 71), { x: 50, z: 2, code: 71, line: 11 });
  const vb = viewBoxFor(sc.bounds, 0.05);
  assert.ok(vb.w > 0 && vb.h > 0);
});

test('hover index finds the first roughing pass near its middle', () => {
  const sc = buildScene(g71);
  const idx = buildIndex(sc.polylines, sc.bounds, 64);
  const firstPass = g71.segments.findIndex(s => s.kind === 'pass');
  assert.equal(nearestSegment(idx, sc.polylines, { x: 48.1, z: -10 }, 0.5), firstPass);
  assert.equal(nearestSegment(idx, sc.polylines, { x: 200, z: 500 }, 0.5), null);
});

test('P and Q block labels, once per profile', () => {
  const sc = buildScene(g71);
  assert.deepEqual(sc.labels.map(l => l.text), ['N10', 'N20']);
  assert.deepEqual({ x: sc.labels[0].x, z: sc.labels[0].z }, { x: 30, z: 2 });
});

test('error markers: one per unsupported or failed cycle block, where the position is known', () => {
  const drill = buildScene(analyze('G97 S800 G99\nT0505\nG0 X0 Z5\nG83 Z-30. Q5000 R-3. F0.1\nX10.\nG80\nG0 X20 Z5\nG83 Q5000'));
  assert.deepEqual(drill.markers, [
    { x: 0, z: -30, line: 4, id: 'cycle-unsupported' },      // the block's end point
    { x: 5, z: -30, line: 5, id: 'cycle-unsupported' },      // a modal repeat
    { x: 10, z: 5, line: 8, id: 'cycle-unsupported' },       // no motion: where the cycle starts
  ]);
  const failed = buildScene(analyze('G99 G97 S500\nG0 X100 Z2\nG71 U2 R0.5\nG71 P10 Q99 U0.4 W0.1 F0.25\nN10 G0 X60\nG1 Z-20'));
  assert.deepEqual(failed.markers, [{ x: 50, z: 2, line: 4, id: 'pq-not-found' }]);
  assert.deepEqual(buildScene(analyze('G28 U0 W0\nG74 R1.\nG74 Z-20. Q5000 F0.1')).markers, []);   // start unknown
  assert.deepEqual(buildScene(g71).markers, []);
});

test('line → segments map', () => {
  const m = segmentsByLine(g71.segments);
  assert.equal(m.get(11).length, 41);                  // the G71 second line owns its 41 moves
});
