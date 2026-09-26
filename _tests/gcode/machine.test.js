import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProgram } from '../../js/gcode/parse.js';
import { withDefaults } from '../../js/gcode/settings.js';
import { newContext, executeBlock } from '../../js/gcode/machine.js';

function run(text, settings) {
  const ctx = newContext(parseProgram(text), withDefaults(settings));
  for (ctx.index = 0; ctx.index < ctx.blocks.length; ctx.index++) {
    const b = ctx.blocks[ctx.index];
    if (!b.skipped) executeBlock(ctx, b);
  }
  return ctx;
}
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('first move from unknown position draws nothing', () => {
  const ctx = run('G0 Z15\nG0 X100\nG1 Z-10 F0.2');
  assert.equal(ctx.segments.length, 1);
  assert.deepEqual(ctx.segments[0].from, { x: 50, z: 15 });
  assert.deepEqual(ctx.segments[0].to, { x: 50, z: -10 });
  assert.equal(ctx.segments[0].kind, 'feed');
});

test('U/W are incremental and X is a diameter', () => {
  const ctx = run('G0 X100 Z0\nG1 U-10 W-5 F0.1');
  assert.deepEqual(ctx.segments[0].to, { x: 45, z: -5 });
});

test('modal G1 carries over to a block with only Z', () => {
  const ctx = run('G0 X100 Z0\nG1 X90 F0.2\nZ-20');
  assert.equal(ctx.segments[1].kind, 'feed');
  assert.deepEqual(ctx.segments[1].to, { x: 45, z: -20 });
});

test('G3 with R makes an arc segment', () => {
  const ctx = run('G0 X243.8 Z-20\nG3 X245.8 Z-21 R1 F0.1');
  const s = ctx.segments[0];
  assert.equal(s.kind, 'arc');
  near(s.arc.cx, 121.9); near(s.arc.cz, -21);
});

test('G28 makes the axis unknown, so the next move draws nothing', () => {
  const ctx = run('G0 X100 Z0\nG28 U0\nG0 Z10');
  assert.equal(ctx.segments.length, 0);
  assert.equal(ctx.state.pos.x, null);
  assert.equal(ctx.state.pos.z, 10);
});

test('G50 S is the spindle limit; G50 X Z sets coordinates without moving', () => {
  const ctx = run('G50 S2500\nG50 X100 Z50');
  assert.equal(ctx.state.sMax, 2500);
  assert.deepEqual(ctx.state.pos, { x: 50, z: 50 });
  assert.equal(ctx.segments.length, 0);
});

test('G96 S is the surface speed; G97 S is rpm', () => {
  assert.equal(run('G96 S200').state.s, 200);
  assert.equal(run('G96 S200').state.spindleMode, 'css');
  assert.equal(run('G97 S1200').state.spindleMode, 'rpm');
});

test('inch program: lengths and feeds converted to mm', () => {
  const ctx = run('G20\nG0 X2 Z1\nG1 Z0 F0.01');
  near(ctx.segments[0].from.x, 25.4); near(ctx.segments[0].from.z, 25.4);
  near(ctx.segments[0].feed.f, 0.254);
});

test('numbers without a decimal point can mean microns', () => {
  const ctx = run('G0 X100000 Z0\nG1 Z-5000 F0.2', { integerUnit: 'um' });
  assert.deepEqual(ctx.segments[0].to, { x: 50, z: -5 });
});

test('tool changes and the tool-zero event (glued T0W000 form)', () => {
  const ctx = run('T0101\nT3W303\nT0W000');
  assert.deepEqual(ctx.toolChanges.map(t => t.tool), ['T0101', 'T3W303', 'T0W000']);
  assert.deepEqual(ctx.events.filter(e => e.type === 'tool-zero').map(e => e.tool), ['T0W000']);
});

test('dwell: P in milliseconds, X in seconds', () => {
  const ctx = run('G0 X10 Z0\nG4 P500\nG4 X1.5');
  assert.deepEqual(ctx.segments.filter(s => s.kind === 'dwell').map(s => s.dwell), [0.5, 1.5]);
});

test('facts for checks: missing feed, G96 without G50, Y word', () => {
  const ctx = run('G96 S200\nG0 X100 Z0\nG1 X50\nG0 Y5');
  const types = ctx.events.map(e => e.type);
  assert.ok(types.includes('no-feed'));
  assert.ok(types.includes('css-no-limit'));
  assert.ok(types.includes('milling'));
});

test('G90 modal repeats keep the previous Z', () => {
  const ctx = run('G0 X52 Z2\nG90 X46 Z-30 F0.2\nX42\nX38\nG0 X100');
  assert.equal(ctx.segments.length, 13);
  assert.deepEqual(ctx.segments[8].to, { x: 19, z: 2 });       // third box: rapid in to X38
  assert.deepEqual(ctx.segments[9].to, { x: 19, z: -30 });
  assert.deepEqual(ctx.segments[12].to, { x: 50, z: 2 });      // G0 X100 after the boxes
});

test('system B: G77 is the turning box', () => {
  const ctx = run('G0 X52 Z2\nG77 X46 Z-30 F0.2', { system: 'B' });
  assert.equal(ctx.segments.length, 4);
});

test('G32 is a thread move with the lead as feed', () => {
  const ctx = run('G97 S800\nG0 X19 Z5\nG32 Z-20 F1.5');
  assert.equal(ctx.segments[0].kind, 'thread');
  assert.equal(ctx.segments[0].feed.f, 1.5);
});

test('T<tt>00 on the current tool cancels its offset: no tool change, the tool stays', () => {
  const ctx = run('T0101\nG0 X50 Z2\nG0 X100 Z100 T0100\nT0202\nG0 X50 Z2\nG0 X100 Z100 T0200');
  assert.deepEqual(ctx.toolChanges.map(t => t.tool), ['T0101', 'T0202']);
  assert.deepEqual(ctx.segments.map(s => [s.line, s.tool]), [[3, 'T0101'], [5, 'T0202'], [6, 'T0202']]);
  assert.equal(ctx.events.filter(e => e.type === 'tool-zero').length, 0);   // retract rapids only
});

// R14: T0100 as a brand-new tool's first call (offset 00, nothing to cancel yet) still commits a
// row today. The next call for the SAME tool number with a real offset (T0101) must not split into
// a second row: it is the offset being applied, not a new tool. The row (and any segment already
// tagged with the placeholder T0100) is renamed to this, the first non-00 form.
test('T<tt>00 as a brand-new tool is confirmed by the next same-number offset: one row, the first non-00 form', () => {
  // The leading G0 gives the tool a known starting position, so the retract that follows T0100
  // (still under the placeholder key at that point) actually produces a segment to rename.
  const ctx = run('G0 X60 Z5\nT0100\nG0 X50 Z2\nT0101\nG1 X40 Z-10 F0.2 S1000');
  assert.deepEqual(ctx.toolChanges.map(t => t.tool), ['T0101']);
  assert.deepEqual(ctx.segments.map(s => [s.line, s.tool]), [[3, 'T0101'], [5, 'T0101']]);
  // Fix C2: the immediate tool-zero on selecting T0100 is DROPPED, not renamed onto the merged row.
  // Line 3 is only a rapid (no cut happened while the offset was still zero), so retagging it onto
  // T0101 would wrongly warn about the real cut on line 5, which happens after the offset is applied.
  assert.deepEqual(ctx.events.filter(e => e.type === 'tool-zero').map(e => e.tool), []);
});

test('T<tt>00 on another tool number is still a tool change', () => {
  const ctx = run('T0101\nT0200');
  assert.deepEqual(ctx.toolChanges.map(t => t.tool), ['T0101', 'T0200']);
});

const unsupported = ctx => ctx.events.filter(e => e.type === 'cycle-unsupported');

test('G83 is drawn as written and flagged, and so is its modal repeat until G80', () => {
  const ctx = run('G97 S800 G99\nT0505\nG0 X0 Z5\nG83 Z-30. Q5000 R-3. F0.1\nX10.\nG80\nZ20.');
  assert.deepEqual(unsupported(ctx).map(e => [e.line, e.code, e.tool]), [[4, 83, 'T0505'], [5, 83, 'T0505']]);
  assert.deepEqual(unsupported(ctx).map(e => e.at), [{ x: 0, z: -30 }, { x: 5, z: -30 }]);
  assert.deepEqual(ctx.segments.map(s => [s.line, s.kind, s.to.z]), [[4, 'rapid', -30], [5, 'rapid', -30], [7, 'rapid', 20]]);
});

test('G0–G3 also end the drilling modal; a lone G80 safety line is not flagged', () => {
  const ctx = run('G80 G40 G99\nG0 X0 Z5\nG84 Z-10. F1.\nG0 X20.\nZ10.\nG1 Z0 F0.1');
  assert.deepEqual(unsupported(ctx).map(e => e.line), [3]);
});

test('G34, G12.1/G112 and G7.1/G107 are flagged with the code as written', () => {
  const ctx = run('G0 X10 Z5\nG34 Z-10 F1 K0.1\nG12.1\nG13.1\nG112\nG7.1 C10\nG107 C10');
  assert.deepEqual(unsupported(ctx).map(e => e.code), [34, 12.1, 112, 7.1, 107]);
});

test('cycle blocks are handed back to the caller, not executed', () => {
  const ctx = newContext(parseProgram('G71 U1.5 R0.5'), withDefaults());
  assert.deepEqual(executeBlock(ctx, ctx.blocks[0]), { cycle: 71 });
});
