import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModel, evaluate, coverIds, defaultHmax, ARTICLES, LIMITS, EGSA } from '../../js/coverage/rules.js';
import { autoMap } from '../../js/coverage/mapping.js';
import { item, rect, result, unionOf } from './helpers.mjs';
import { OUTLINES, OPEN, TERMS, inSurvey } from './example-geometry.mjs';

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} ≠ ${b}`);
const lvl = (ev, lv) => ev.levels.find(l => l.level === lv);

// A drawing from [layer, verts] pairs, mapped by the template names, evaluated with the union given.
function run(outlines, terms, union) {
  const items = outlines.map(([layer, verts, opts]) => item(layer, verts, opts));
  const r = result(items);
  const { map } = autoMap(r.layers.map(l => l.name));
  const model = buildModel(r, map);
  return { model, ev: evaluate(model, terms, union === undefined ? unionOf(model.cover.reduce((a, o) => a + o.area, 0)) : union) };
}

// A 20 × 25 plot with a 10 × 15 coverage outline, as most tests start.
const PLOT = ['AC_PLOT', rect(0, 0, 20, 25)];
const COVER = ['AC_COVER', rect(0, 10, 10, 15)];

test('the example drawing gives exactly the figures of spec §12', () => {
  const items = [...OUTLINES.map(o => item(o.layer, inSurvey(o.verts))), ...OPEN.map(o => item(o.layer, inSurvey(o.verts), { closed: false }))];
  const r = result(items);
  const { map, fromTemplate } = autoMap(r.layers.map(l => l.name));
  assert.equal(fromTemplate, 10);
  const model = buildModel(r, map);
  const cover = model.cover[0];
  const ev = evaluate(model, TERMS, unionOf(150, [cover.verts]));
  assert.equal(ev.blocked, null);
  near(ev.plot.area, 500, 'plot');
  near(ev.coverage.area, 150, 'coverage'); near(ev.coverage.permitted, 300, 'permitted coverage'); near(ev.coverage.ratio, 0.3, 'ratio');
  assert.equal(ev.coverage.mark, true);
  near(ev.uncovered, 350, 'uncovered');
  assert.deepEqual(ev.levels.map(l => [l.level, +l.domisi.toFixed(6)]), [['B1', 0], ['00', 110], ['01', 100], ['02', 90]]);
  near(ev.caps.semi, 90, 'semi-open'); near(ev.caps.semiCap, 80, '0.20 P'); assert.equal(ev.caps.semiMark, false);
  near(ev.caps.semi + ev.caps.balc, 120, 'semi-open + balconies'); near(ev.caps.totalCap, 160, '0.40 P'); assert.equal(ev.caps.totalMark, true);
  near(ev.caps.overflow, 10, 'overflow');
  near(ev.domisi.total, 310, 'δόμηση'); near(ev.domisi.sd, 0.62, 'achieved ΣΔ'); near(ev.domisi.permitted, 400, 'P'); assert.equal(ev.domisi.mark, true);
  near(ev.volume.V, 1380, 'volume'); near(ev.volume.so, 4, 'σ.ο.'); near(ev.volume.permitted, 2000, 'permitted V'); near(ev.volume.achievedSo, 2.76, 'achieved σ.ο.');
  assert.equal(ev.volume.mark, true);
  assert.equal(ev.height.mark, true);
  near(ev.planting.mandatory, 200, 'mandatory uncovered'); near(ev.planting.required, 400 / 3, '⅔'); near(ev.planting.actual, 140, 'planting');
  assert.equal(ev.planting.mark, true);
  assert.deepEqual(ev.warnings.map(w => w.id), ['open'], 'only the open outline on the planting layer');
  assert.deepEqual(ev.coords.plot.map(r => [r.n, r.x, r.y]), [[1, 410000, 4495000], [2, 410020, 4495000], [3, 410020, 4495025], [4, 410000, 4495025]]);
  assert.equal(ev.coords.egsa, true);
  assert.equal(ev.coords.building[0].rows.length, 4);
});

test('#1–3: plot area, coverage against Σ.Κ., the uncovered area', () => {
  const { ev } = run([PLOT, COVER, ['AC_COVER', rect(8, 5, 4, 10)]], { sk: 30 }, unionOf(150 + 40 - 20));
  near(ev.plot.area, 500, 'plot');
  near(ev.coverage.area, 170, 'the union, not the sum 190');
  near(ev.coverage.sum, 190, 'sum');
  near(ev.coverage.permitted, 150, '30 % of 500'); assert.equal(ev.coverage.mark, false);
  near(ev.uncovered, 330, 'uncovered');
  assert.deepEqual(ev.coverage.ids.length, 2);
});

test('#2 without Σ.Κ.: the proposed value only, no permitted value and no mark', () => {
  const { ev } = run([PLOT, COVER], {});
  assert.equal(ev.coverage.permitted, null);
  assert.equal(ev.coverage.mark, null);
  assert.equal(ev.planting.required, null);
  assert.equal(ev.planting.mark, null);
});

test('a failed union shows the sum with a warning, and the rest continues', () => {
  const { ev } = run([PLOT, COVER, ['AC_COVER', rect(8, 5, 4, 10)]], { sk: 60 }, { ...unionOf(0), error: 'check' });
  near(ev.coverage.area, 190, 'sum');
  assert.equal(ev.coverage.state, 'failed');
  assert.ok(ev.warnings.some(w => w.id === 'union-failed' && w.ids.length === 2));
  assert.equal(ev.blocked, null);
});

test('a union with outlines it could not use is a failed union too: the sum, and the bad outlines named', () => {
  const { ev } = run([PLOT, ['AC_COVER', rect(0, 10, 10, 15), { id: 'B' }], ['AC_COVER', rect(8, 5, 4, 10), { id: 'C' }]], { sk: 60 }, { ...unionOf(0), bad: ['C'] });
  assert.equal(ev.coverage.state, 'failed');
  near(ev.coverage.area, 190, 'the sum, not the union’s 0');
  assert.deepEqual(ev.warnings.filter(w => w.id === 'union-failed').map(w => w.ids), [['C']]);
});

test('#4 and #5: stair caps at 30, 40 (entrance level) and 25 m², with and without excess', () => {
  const L = (lv, x) => [`AC_LVL_${lv}`, rect(x, 0, 10, 10)];               // 100 m² each
  const { ev } = run([PLOT, COVER,
    L('00', 100), ['AC_STAIR_COMMON', rect(100, 0, 5, 9)],                   // 45 on the entrance level: 40 excluded, 5 counts
    L('01', 120), ['AC_STAIR_COMMON', rect(120, 0, 5, 7)],                   // 35 on a floor: 30 excluded, 5 counts
    L('02', 140), ['AC_STAIR_COMMON', rect(140, 0, 4, 5)], ['AC_STAIR_UNIT', rect(145, 0, 4, 7)],   // 20 all out; unit 28: 25 out, 3 counts
    L('03', 160), ['AC_STAIR_UNIT', rect(160, 0, 4, 5)],                     // 20: all out
  ], { entrance: '00' });
  const line = (lv, role) => lvl(ev, lv).lines.filter(l => l.role === role);
  assert.deepEqual(line('00', 'stairCommon').map(l => [l.cap, l.excluded, l.counts]), [[40, 40, 5]]);
  assert.deepEqual(line('01', 'stairCommon').map(l => [l.cap, l.excluded, l.counts]), [[30, 30, 5]]);
  assert.deepEqual(line('02', 'stairCommon').map(l => [l.cap, l.excluded, l.counts]), [[30, 20, 0]]);
  assert.deepEqual(line('02', 'stairUnit').map(l => [l.cap, l.excluded, l.counts]), [[25, 25, 3]]);
  assert.deepEqual(ev.levels.map(l => [l.level, l.domisi]), [['00', 60], ['01', 70], ['02', 55], ['03', 80]]);
});

test('#5: a common stair on a floor chosen as the entrance level gets the 40 m² cap', () => {
  const { ev } = run([PLOT, COVER, ['AC_LVL_01', rect(100, 0, 10, 10)], ['AC_STAIR_COMMON', rect(100, 0, 5, 7)]], { entrance: '01' });
  assert.deepEqual(lvl(ev, '01').lines[0].excluded, 35);
});

test('#6: the attic counts only above half of the level below it', () => {
  const a = run([PLOT, COVER, ['AC_LVL_00', rect(100, 0, 10, 10)], ['AC_LVL_01', rect(120, 0, 10, 10)], ['AC_LVL_ATTIC', rect(140, 0, 10, 7)]], {}).ev;
  near(lvl(a, 'ATTIC').domisi, 20, '70 − ½ × 100');
  const b = run([PLOT, COVER, ['AC_LVL_01', rect(120, 0, 10, 10)], ['AC_LVL_ATTIC', rect(140, 0, 10, 4)]], {}).ev;
  near(lvl(b, 'ATTIC').domisi, 0, '40 is within half of 100');
  near(b.domisi.total, 100, 'total');
});

test('#6 (Aris ruled 2026-09-29, 206 §6ιδ): the stair up to the attic comes off before the half-of-below check', () => {
  // Levels 00 and 01 of 100 m²; a 10 × 7 attic (70) with a 2 × 4 unit stair (8): check area 62, half of below 50 → 12.
  const L = [PLOT, COVER, ['AC_LVL_00', rect(100, 0, 10, 10)], ['AC_LVL_01', rect(120, 0, 10, 10)], ['AC_LVL_ATTIC', rect(140, 0, 10, 7)]];
  const a = run([...L, ['AC_STAIR_UNIT', rect(141, 1, 2, 4)]], {}).ev;
  near(lvl(a, 'ATTIC').domisi, 12, '70 − 8 − ½ × 100');
  near(a.domisi.total, 212, '100 + 100 + 12');
  const lines = lvl(a, 'ATTIC').lines;
  assert.deepEqual(lines.map(x => [x.role, x.area, x.excluded, x.note]), [['stairUnit', 8, 8, 'attic-stair'], ['atticRest', 62, 50, 'attic-half']]);
  near(lines.reduce((s, x) => s + x.excluded, 0), 70 - 12, 'everything excluded adds up to gross − δόμηση');
  // A common stair counts the same way; 58 − 10 = 48 is within 50, so the attic adds nothing.
  const b = run([PLOT, COVER, ['AC_LVL_01', rect(120, 0, 10, 10)], ['AC_LVL_ATTIC', rect(140, 0, 10, 5.8)], ['AC_STAIR_COMMON', rect(141, 1, 2, 5)]], {}).ev;
  near(lvl(b, 'ATTIC').domisi, 0, '48 ≤ 50');
});

test('#10 (Aris ruled 2026-09-29, 208 §2β): a pilotis excluded from δόμηση adds no volume; one that counts does', () => {
  // Coverage 100; ground 100 with a pilotis, floor 1 100; storey heights 3.
  const at = h => run([PLOT, ['AC_COVER', rect(0, 0, 10, 10)], ['AC_LVL_00', rect(100, 0, 10, 10)], ['AC_PILOTIS', rect(100, 0, 10, h)], ['AC_LVL_01', rect(120, 0, 10, 10)]], { sd: 1 }, unionOf(100)).ev;
  const valid = at(6), small = at(4.9);                    // pilotis 60 (≥ 50 % of 100) and 49
  near(valid.volume.V, (100 - 60) * 3 + 100 * 3, '120 + 300');
  near(lvl(valid, '00').domisi, 40, 'and out of δόμηση');
  near(small.volume.V, 100 * 3 + 100 * 3, 'a pilotis that counts keeps its volume');
  near(lvl(small, '00').domisi, 100, 'and its δόμηση');
});

test('#7: pilotis at 49 % of the coverage counts (✗), at 50 % it is excluded', () => {
  const at = h => run([PLOT, ['AC_COVER', rect(0, 0, 10, 10)], ['AC_LVL_00', rect(100, 0, 10, 10)], ['AC_PILOTIS', rect(100, 0, 10, h)]], {}, unionOf(100)).ev;
  const small = at(4.9), half = at(5);
  assert.equal(small.pilotis.valid, false);
  near(lvl(small, '00').domisi, 100, 'pilotis 49 m² counts');
  assert.ok(small.warnings.some(w => w.id === 'pilotis-small'));
  assert.equal(half.pilotis.valid, true);
  near(lvl(half, '00').domisi, 50, 'pilotis 50 m² excluded');
});

test('#8: semi-open and balcony overflow is counted once', () => {
  // Plot 10 × 10 = 100 and ΣΔ 1: P = 100, semi-open cap 20, semi-open + balconies cap 40.
  const plot = ['AC_PLOT', rect(0, 0, 10, 10)];
  const lv = ['AC_LVL_00', rect(100, 0, 20, 20)];
  const semi = a => ['AC_SEMIOPEN', rect(100, 0, a / 5, 5)];
  const balc = a => ['AC_BALCONY', rect(100, -5, a / 5, 5)];
  const over = (...o) => run([plot, lv, ...o], { sd: 1 }).ev.caps;
  const a = over(semi(25));                   // semi-open alone over
  near(a.overflow, 5, 'semi-open alone'); assert.equal(a.semiMark, false); assert.equal(a.totalMark, true);
  const b = over(semi(15), balc(30));         // the total alone over
  near(b.overflow, 5, 'total alone'); assert.equal(b.semiMark, true); assert.equal(b.totalMark, false);
  const c = over(semi(30), balc(20));         // both over by 10: counted once
  near(c.overflow, 10, 'both, no double count');
  const d = over(semi(30), balc(25));         // both over: the larger excess, 15
  near(d.overflow, 15, 'both, the larger');
  const all = run([plot, lv, semi(30), balc(25)], { sd: 1 }).ev;
  near(all.domisi.total, 400 - 30 + 15, 'level 400 − semi-open 30 + overflow 15');
  const none = run([plot, lv, semi(30), balc(25)], {}).ev;
  assert.equal(none.caps.checked, false); near(none.caps.overflow, 0, 'no ΣΔ: nothing added');
  near(none.domisi.total, 370, 'without ΣΔ');
});

test('#4: mezzanines count in δόμηση', () => {
  const { ev } = run([PLOT, COVER, ['AC_LVL_00', rect(100, 0, 10, 10)], ['AC_MEZZ', rect(101, 1, 4, 5)]], {});
  near(lvl(ev, '00').domisi, 120, '100 + 20');
});

test('#4: voids and other exclusions come off the level; the basement counts 50 % of its main use only', () => {
  const { ev } = run([PLOT, COVER,
    ['AC_LVL_00', rect(100, 0, 10, 10)], ['AC_VOID', rect(101, 1, 2, 2)], ['AC_EXCL_OTHER', rect(104, 1, 3, 2)],
    ['AC_LVL_B1', rect(120, 0, 10, 15)], ['AC_BSMT_MAIN', rect(120, 0, 5, 8)],
  ], {});
  near(lvl(ev, '00').domisi, 100 - 4 - 6, 'void and declared exclusion');
  near(lvl(ev, 'B1').domisi, 20, '50 % of 40');
  near(ev.domisi.total, 110, 'total');
});

test('#10: σ.ο. is 5 × ΣΔ, or 5.5 × ΣΔ when Hmax ≤ 8.50 m', () => {
  const so = hmax => run([PLOT, COVER], { sd: 1, hmax }).ev.volume.so;
  assert.equal(so(8.5), 5.5);
  assert.equal(so(8.51), 5);
  assert.equal(so(null), 5);
});

test('#10: volume = (gross − voids) × storey height, + basement above ground, + roof', () => {
  const { ev } = run([PLOT, COVER,
    ['AC_LVL_00', rect(100, 0, 10, 10)], ['AC_VOID', rect(101, 1, 2, 5)], ['AC_MEZZ', rect(104, 1, 2, 5)],
    ['AC_LVL_B2', rect(120, 0, 10, 10)], ['AC_LVL_B1', rect(140, 0, 10, 10)],
  ], { sd: 1, storey: { '00': 3.5 }, basementAbove: 1.2, roofVolume: 50 });
  near(ev.volume.V, 90 * 3.5 + 100 * 1.2 + 50, 'mezzanines add no volume; only B1 sticks out');
  near(ev.volume.permitted, 2500, '5 × 1 × 500');
});

test('#11: height is a check on typed values', () => {
  const h = t => run([PLOT, COVER], t).ev.height.mark;
  assert.equal(h({ hmax: 11, roofAllow: 2, h: 9.6, roof: 1.5 }), true);
  assert.equal(h({ hmax: 11, roofAllow: 2, h: 9.6, roof: 2.1 }), false);
  assert.equal(h({ hmax: 11, roofAllow: 2, h: 11.01, roof: 0 }), false);
  assert.equal(h({ hmax: 11, roofAllow: 2, h: null, roof: 0 }), null);
});

test('#12: planting, with and without outdoor parking', () => {
  const p = parking => run([PLOT, COVER, ['AC_GREEN', rect(10, 0, 10, 14)]], { sk: 60, parking }).ev.planting;
  const a = p(false);
  near(a.mandatory, 200, '500 − 300'); near(a.required, 133.333333, '⅔ × 200'); assert.equal(a.mark, true);
  const b = p(true);
  near(b.mandatory, 150, '500 − 70 % × 500'); near(b.required, 100, '⅔ × 150');
});

test('§5.2: a space goes to the level containing its centroid; inside two levels’ outlines it goes to neither', () => {
  const { ev, model } = run([PLOT, COVER,
    ['AC_LVL_00', rect(100, 0, 20, 20)], ['AC_LVL_01', rect(100, 0, 10, 10)],      // overlapping plans
    ['AC_SEMIOPEN', rect(101, 1, 2, 2), { id: 'S1' }],                             // centroid (102, 2): inside both
    ['AC_SEMIOPEN', rect(115, 15, 2, 2)],                                          // only in the big one
  ], {});
  assert.deepEqual(model.spaces.map(s => [s.level, s.why || '']), [[null, 'ambiguous'], ['00', '']]);
  near(lvl(ev, '01').domisi, 100, 'nothing guessed'); near(lvl(ev, '00').domisi, 396, '400 − 4');
  assert.deepEqual(ev.warnings.filter(w => w.ids.length).map(w => [w.id, w.params.layer, w.ids]), [['level-ambiguous', 'AC_SEMIOPEN', ['S1']]]);
});

test('§5.2: plans stacked at the same place leave every space out, with a warning each', () => {
  const at = lv => [`AC_LVL_${lv}`, rect(100, 0, 10, 15)];                        // 150 m² each, same XY
  const stair = ['AC_STAIR_COMMON', rect(101, 1, 5, 7)];                           // 35 m² on each level
  const { ev, model } = run([PLOT, COVER, at('00'), stair, at('01'), stair, at('02'), stair], { sd: 1 });
  assert.deepEqual(model.spaces.map(s => s.why), ['ambiguous', 'ambiguous', 'ambiguous']);
  const amb = ev.warnings.filter(w => w.id === 'level-ambiguous');
  assert.equal(amb.length, 3);
  assert.deepEqual(amb.map(w => w.ids[0]).sort(), model.spaces.map(s => s.id).sort());
  assert.ok(amb.every(w => w.params.layer === 'AC_STAIR_COMMON'));
  assert.equal(lvl(ev, '00').lines.filter(l => l.role === 'stairCommon').length, 0, 'no stair counted at 00');
  assert.deepEqual(ev.levels.map(l => +l.domisi.toFixed(6)), [150, 150, 150]);
  assert.ok(!ev.warnings.some(w => w.id === 'duplicate-outline'), 'outlines of different levels, or spaces in no level, are not duplicates');
});

test('§5.3: a duplicated level outline is warned about and still counted twice', () => {
  const { ev } = run([PLOT, COVER, ['AC_LVL_00', rect(100, 0, 10, 10), { id: 'L1' }], ['AC_LVL_00', rect(100, 0, 10, 10), { id: 'L2' }]], {});
  assert.deepEqual(ev.warnings.filter(w => w.ids.length).map(w => [w.id, w.params, w.ids]), [['duplicate-outline', { layer: 'AC_LVL_00' }, ['L1', 'L2']]]);
  near(lvl(ev, '00').gross, 200, 'figures unchanged');
  // 0.02 m² apart is not a duplicate (but it does lie inside the other).
  const b = run([PLOT, COVER, ['AC_LVL_00', rect(100, 0, 10, 10)], ['AC_LVL_00', rect(100, 0, 10, 10.002)]], {}).ev;
  assert.ok(!b.warnings.some(w => w.id === 'duplicate-outline'));
});

test('§5.3: a duplicated semi-open space is warned about and still counted twice', () => {
  const { ev } = run([PLOT, COVER, ['AC_LVL_00', rect(100, 0, 10, 10)],
    ['AC_SEMIOPEN', rect(101, 1, 2, 2), { id: 'S1' }], ['AC_SEMIOPEN', rect(101, 1, 2, 2), { id: 'S2' }]], { sd: 1 });
  assert.deepEqual(ev.warnings.filter(w => w.ids.length).map(w => [w.id, w.params, w.ids]), [['duplicate-outline', { layer: 'AC_SEMIOPEN' }, ['S1', 'S2']]]);
  near(ev.caps.semi, 8, 'figures unchanged');
});

test('§5.3: a level outline inside another of the same level (a courtyard drawn as a plan?) is warned about', () => {
  const { ev } = run([PLOT, COVER, ['AC_LVL_00', rect(100, 0, 20, 20), { id: 'O' }], ['AC_LVL_00', rect(105, 5, 4, 4), { id: 'I' }],
    ['AC_LVL_01', rect(100, 0, 20, 20)], ['AC_LVL_02', rect(130, 0, 20, 20)], ['AC_LVL_02', rect(150, 0, 5, 5)]], {});
  assert.deepEqual(ev.warnings.filter(w => w.ids.length).map(w => [w.id, w.params, w.ids]), [['nested-level', { layer: 'AC_LVL_00' }, ['I', 'O']]]);
  near(lvl(ev, '00').gross, 416, 'figures unchanged');
});

test('§5.2: a balcony within 0.50 m goes to the nearest level; beyond it, or a space outside every level, is left out', () => {
  const { ev, model } = run([['AC_PLOT', rect(0, 0, 10, 10)],
    ['AC_LVL_00', rect(100, 0, 10, 10)], ['AC_LVL_01', rect(130, 0, 10, 10)],
    ['AC_BALCONY', rect(100, -3.5, 5, 3)],                                         // 0.50 below level 00
    ['AC_BALCONY', rect(130, -3.6, 5, 3)],                                         // 0.60 below level 01
    ['AC_SEMIOPEN', rect(200, 0, 2, 2)],                                           // in no level at all
  ], { sd: 1 });
  assert.deepEqual(model.spaces.map(s => [s.role, s.level, s.why || '']), [['balcony', '00', ''], ['balcony', null, 'far'], ['semiopen', null, 'outside']]);
  near(ev.caps.balc, 15, 'only the near balcony');
  near(ev.caps.semi, 0, 'the lost semi-open space is in no figure');
  assert.deepEqual(ev.warnings.filter(w => w.ids.length).map(w => w.id).sort(), ['balcony-far', 'no-level']);
  near(ev.domisi.total, 200, 'both levels, nothing guessed');
});

test('§8: the plot missing or mapped twice blocks the results', () => {
  assert.equal(run([COVER], {}).ev.blocked, 'plot-missing');
  const two = run([PLOT, ['AC_PLOT', rect(50, 0, 5, 5)], COVER], {}).ev;
  assert.equal(two.blocked, 'plot-many');
  assert.equal(two.plotIds.length, 2);
});

test('§5.3: coordinates outside the ΕΓΣΑ87 range for Greece are flagged', () => {
  const at = (x, y) => run([['AC_PLOT', rect(x, y, 20, 25)]], {}).ev;
  assert.equal(at(0, 0).coords.egsa, false);
  assert.ok(at(0, 0).warnings.some(w => w.id === 'not-egsa'));
  assert.equal(at(410000, 4495000).coords.egsa, true);
  assert.equal(at(EGSA.x0 - 0.01, 4495000).coords.egsa, false);
  assert.equal(at(EGSA.x1 - 20, EGSA.y1 - 25).coords.egsa, true);
  assert.equal(at(410000, EGSA.y0 - 1).coords.egsa, false);
});

test('coordinate rows: numbered, with the arc edges marked', () => {
  const b = Math.tan(Math.PI / 8);
  const { ev } = run([['AC_PLOT', [[0, 0], [6, 0, b], [6, 4], [0, 4]]]], {});
  assert.deepEqual(ev.coords.plot.map(r => [r.n, r.x, r.y, r.arc]), [[1, 0, 0, false], [2, 6, 0, true], [3, 6, 4, false], [4, 0, 4, false]]);
});

test('open and self-crossing outlines on a mapped layer are listed and never measured', () => {
  const { ev, model } = run([PLOT, COVER, ['AC_GREEN', rect(10, 0, 10, 14)], ['AC_GREEN', [[1, 1], [8, 1], [8, 8]], { closed: false }], ['AC_GREEN', [[0, 0], [2, 2], [2, 0], [0, 2]], { bad: true }]], { sk: 60 });
  near(ev.planting.actual, 140, 'only the good outline');
  assert.deepEqual(model.excluded.map(x => x.why), ['open', 'bad']);
  assert.deepEqual(ev.warnings.filter(w => w.ids.length).map(w => w.id), ['open', 'bad']);
});

test('warnings: Σ.Κ. above 60 %, a plot area that suggests the wrong units, no levels, no coverage', () => {
  const a = run([PLOT, COVER], { sk: 70 }).ev;
  assert.ok(a.warnings.some(w => w.id === 'sk-high'));
  assert.ok(a.warnings.some(w => w.id === 'no-levels'));
  const b = run([['AC_PLOT', rect(0, 0, 4, 4)]], {}).ev;                        // 16 m²: drawn in cm, read as m?
  assert.ok(b.warnings.some(w => w.id === 'units-check'));
  assert.ok(b.warnings.some(w => w.id === 'no-cover'));
});

test('210 §1: the default height for a ΣΔ', () => {
  assert.deepEqual([0.4, 0.8, 0.81, 1.2, 1.6, 2.0, 2.6, 3, 4].map(defaultHmax), [10.75, 14, 17.25, 17.25, 19.5, 22.75, 26, 30, 32]);
  assert.equal(defaultHmax(null), null);
});

test('every figure cites its Code article, the old one and the date it applies from', () => {
  for (const k of ['plot', 'coverage', 'uncovered', 'level', 'stairs', 'attic', 'pilotis', 'caps', 'total', 'volume', 'height', 'planting', 'coords']) {
    const a = ARTICLES[k];
    assert.ok(a && a.code && a.old && a.from === '2026-06-08', k);
  }
  assert.equal(ARTICLES.coverage.code, '207'); assert.equal(ARTICLES.coverage.old, 'ΝΟΚ 12');
  assert.equal(LIMITS.stairCommon, 30); assert.equal(LIMITS.stairCommonEntrance, 40); assert.equal(LIMITS.stairUnit, 25);
});

test('the union is asked for the coverage outlines only', () => {
  const { model } = run([PLOT, COVER, ['AC_COVER', rect(8, 5, 4, 10)], ['AC_GREEN', rect(10, 0, 10, 14)]], {});
  assert.equal(coverIds(model).length, 2);
});
