import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nc1Piece, gradeOf, differs, plateParts, CHECK_LIMIT } from '../../js/steel/piece.js';

// A parsed piece as nc1.js returns it.
const piece = (o = {}) => ({ order: 'P1', drawing: 'D1', phase: '1', mark: 'B1', grade: 'S355J2', qty: 2, profile: 'HEA200', code: 'I', length: 4000, sawLength: null,
  h: 190, b: 200, tf: 10, tw: 6.5, r: 18, kgm: 42.3, m2m: 1.136, webStart: 0, webEnd: 0, flangeStart: 0, flangeEnd: 0, text: [], holes: [], contours: [], skipped: {}, ...o });
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} vs ${b}`);

test('a profile: nominal kg and m² from the header per metre; the check from the section less its holes', () => {
  const r = nc1Piece(piece({ holes: [{ face: 'o', x: 100, y: 50, d: 22, depth: 0, slot: null }] }), 'B1.nc1');
  near(r.unitKg, 169.2);
  near(r.unitM2, 4.544);
  assert.deepEqual([r.kgFrom, r.m2From, r.mark, r.grade, r.gradeText, r.qty, r.lengthMm, r.file], ['header', 'header', 'B1', 'S355', 'S355J2', 2, 4000, 'B1.nc1']);
  near(r.checkKg, (5383.12 * 4000 - Math.PI * 121 * 10) * 7.85e-6, 1e-5);
  assert.deepEqual(r.warn, []);
  assert.equal(r.excluded, false);
  assert.deepEqual(r.box, [4000, 190, 200]);
});

test('an empty header weight or paint: from the section dimensions', () => {
  const r = nc1Piece(piece({ kgm: 0, m2m: 0 }));
  near(r.unitKg, 5383.12 * 4000 * 7.85e-6, 1e-5);
  near(r.unitM2, 1136.1 * 4000 * 1e-6, 1e-5);
  assert.deepEqual([r.kgFrom, r.m2From], ['section', 'section']);
});

test('a header weight 5 % off its dimensions is ⚠ check; the quoted figure stays the header\'s', () => {
  assert.equal(CHECK_LIMIT, 0.05);
  const r = nc1Piece(piece({ kgm: 46 }));
  assert.ok(r.warn.includes('check'));
  near(r.unitKg, 184);
  assert.equal(r.excluded, false, 'still in the totals');
  assert.equal(differs(100, 105.1), true);
  assert.equal(differs(100, 104.9), false);
  assert.equal(differs(100, null), false);
});

test('a plate: from its contour, inner contours and holes at 7,850 kg/m³, whatever its header says per metre', () => {
  // Tekla writes a plate's weight per m² (160 for 20 mm) in the kg/m field: it must not be read per metre.
  const disc = { kind: 'AK', face: 'v', pts: [{ x: 0, y: 0, r: 116.85 }, { x: 0, y: 233.7, r: 116.85 }] };
  const r = nc1Piece(piece({ code: 'B', profile: 'PL20*233.7', length: 233.7, h: 233, b: 20, tf: 20, tw: 20, kgm: 160, m2m: 2.347, contours: [disc],
    holes: [21.13, -56.94, 70, -56.32, 22.13].map(x => ({ face: 'v', x, y: 100, d: 25, depth: 0, slot: null })) }));
  const net = Math.PI * 116.85 ** 2 - 5 * Math.PI * 156.25;
  near(r.unitKg, net * 20 * 7.85e-6);
  assert.deepEqual([r.kgFrom, r.m2From, r.thickness], ['contour', 'contour', 20]);
  assert.ok(Math.abs(r.box[0] - 233.7) < 0.01 && Math.abs(r.box[1] - 233.7) < 1e-6 && r.box[2] === 20, `box ${r.box}`);
  assert.ok(Math.abs(r.checkKg / r.unitKg - 1) < 0.01);
  assert.deepEqual(r.warn, []);
});

test('a plate without a contour: its header rectangle', () => {
  const r = nc1Piece(piece({ code: 'B', profile: 'FL100*10', length: 500, h: 100, b: 10, tf: 10, tw: 10, kgm: 0, m2m: 0 }));
  near(r.unitKg, 100 * 500 * 10 * 7.85e-6);
  near(r.unitM2, (2 * 50000 + 1200 * 10) * 1e-6);
  assert.deepEqual(r.box, [500, 100, 10]);
  assert.equal(plateParts(piece()).outer, null);
});

test('no weight (a special profile without kg/m), no length, no quantity: ⚠ and left out of the totals', () => {
  const so = nc1Piece(piece({ code: 'SO', profile: 'ZS175*1.5', kgm: 0, m2m: 0 }));
  assert.deepEqual(so.warn, ['noweight', 'noarea']);
  assert.equal(so.excluded, true);
  const soKg = nc1Piece(piece({ code: 'SO', profile: 'ZS175*1.5', kgm: 4.416, m2m: 0 }));
  assert.deepEqual(soKg.warn, ['noarea'], 'a weight but no paint surface: kept, without m²');
  assert.equal(soKg.excluded, false);
  assert.equal(soKg.checkKg, null);
  assert.deepEqual(nc1Piece(piece({ length: 0 })).warn, ['nolength']);
  assert.equal(nc1Piece(piece({ length: 0 })).excluded, true);
  assert.deepEqual(nc1Piece(piece({ qty: 0 })).warn, ['noqty']);
});

test('the grade rule: S235, S275, S355 or S450 when the name holds one, else as written', () => {
  assert.equal(gradeOf('S355J2+N'), 'S355');
  assert.equal(gradeOf('STEEL/S275J0'), 'S275');
  assert.equal(gradeOf('s450'), 'S450');
  assert.equal(gradeOf('A992'), 'A992');
  assert.equal(gradeOf(' STEEL/300PLUS '), 'STEEL/300PLUS');
  assert.equal(gradeOf(''), '');
});

test('round and angle boxes: a tube is D × D; an equal angle without its width is h × h', () => {
  assert.deepEqual(nc1Piece(piece({ code: 'RO', profile: 'CHS114.3*5', h: 114.3, b: 0, tf: 5, tw: 5, kgm: 13.5 })).box, [4000, 114.3, 114.3]);
  assert.deepEqual(nc1Piece(piece({ code: 'L', profile: 'L80*8', h: 80, b: 0, tf: 8, tw: 8, kgm: 9.63 })).box, [4000, 80, 80]);
});

test('a piece that comes out at 0 kg is flagged noweight and left out, like a missing weight', () => {
  const r = nc1Piece(piece({ code: 'B', profile: 'PL', kgm: 0, m2m: 0, h: 0, b: 0, tf: 0, tw: 0 }));   // a plate whose header gives no thickness
  assert.equal(r.unitKg, 0);
  assert.deepEqual(r.warn, ['noweight']);
  assert.equal(r.excluded, true);
  assert.deepEqual(nc1Piece(piece({ length: 0 })).warn, ['nolength'], 'no length: one warning, not two');
});
