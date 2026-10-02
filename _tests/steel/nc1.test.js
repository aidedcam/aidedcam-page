import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNc1, num, lengthPair, CODES } from '../../js/steel/nc1.js';

// A header as Tekla writes it (DSTV order: order, drawing, phase, mark, grade, quantity, profile, code, length,
// height, flange width, flange thickness, web thickness, radius, kg/m, m²/m, four cut angles, four text lines).
const header = (o = {}) => {
  const f = { order: 'P1', drawing: 'D1', phase: '1', mark: 'B1', grade: 'S355J2', qty: '2', profile: 'HEA200', code: 'I', length: '4000.00',
    h: '190.00', b: '200.00', tf: '10.00', tw: '6.50', r: '18.00', kgm: '42.300', m2m: '1.136', cuts: ['0.000', '0.000', '0.000', '0.000'], ...o };
  return ['ST', '** written by hand', ...['order', 'drawing', 'phase', 'mark', 'grade', 'qty', 'profile', 'code', 'length', 'h', 'b', 'tf', 'tw', 'r', 'kgm', 'm2m'].map(k => `  ${f[k]}`),
    ...f.cuts.map(c => `  ${c}`), '  -', '  -', '  -', '  -'];
};
const file = (lines, eol = '\r\n') => lines.join(eol) + eol;

test('the header: twenty fields in DSTV order, then four text lines; comments skipped anywhere', () => {
  const r = parseNc1(file(header()));
  assert.equal(r.ok, true);
  const p = r.piece;
  assert.deepEqual([p.order, p.drawing, p.phase, p.mark, p.grade, p.qty, p.profile, p.code], ['P1', 'D1', '1', 'B1', 'S355J2', 2, 'HEA200', 'I']);
  assert.deepEqual([p.length, p.h, p.b, p.tf, p.tw, p.r, p.kgm, p.m2m], [4000, 190, 200, 10, 6.5, 18, 42.3, 1.136]);
  assert.deepEqual([p.webStart, p.webEnd, p.flangeStart, p.flangeEnd], [0, 0, 0, 0]);
  assert.deepEqual(p.text, ['-', '-', '-', '-']);
  const lines = header();
  lines.splice(8, 0, '** a comment inside the header');
  assert.equal(parseNc1(file(lines)).piece.profile, 'HEA200');
});

test('CRLF, LF and CR line ends, a BOM, blank lines before ST: the same piece', () => {
  const a = parseNc1(file(header(), '\r\n')).piece, b = parseNc1(file(header(), '\n')).piece, c = parseNc1(file(header(), '\r')).piece;
  const d = parseNc1('﻿\n\n' + file(header(), '\n')).piece;
  for (const x of [b, c, d]) assert.deepEqual(x, a);
});

test('numbers: a decimal comma or point; the length line may carry the saw length after a comma', () => {
  assert.equal(num(' 42,300 '), 42.3);
  assert.equal(num('1.136'), 1.136);
  assert.equal(num(''), null);
  assert.ok(Number.isNaN(num('6236:88')));
  assert.deepEqual(lengthPair('6236.88'), { length: 6236.88, saw: null });
  assert.deepEqual(lengthPair('6236,88'), { length: 6236.88, saw: null }, 'a decimal comma');
  assert.deepEqual(lengthPair('6236.88,6230.00'), { length: 6236.88, saw: 6230 }, 'length, saw length');
  assert.deepEqual(lengthPair('233.70,233.70'), { length: 233.7, saw: 233.7 });
  assert.deepEqual(lengthPair('5000,4998'), { length: 5000, saw: 4998 }, 'four digits after the comma: two values');
  const p = parseNc1(file(header({ kgm: '42,300', m2m: '1,136', length: '4000,5' }))).piece;
  assert.deepEqual([p.length, p.kgm, p.m2m], [4000.5, 42.3, 1.136]);
});

test('the code: blank or unknown reads as SO; a profile and code written the other way round are put back', () => {
  assert.deepEqual(CODES, ['I', 'L', 'U', 'B', 'RU', 'RO', 'M', 'C', 'T', 'SO']);
  assert.equal(parseNc1(file(header({ code: '' }))).piece.code, 'SO');
  assert.equal(parseNc1(file(header({ code: 'Q' }))).piece.code, 'SO');
  const p = parseNc1(file(header({ profile: 'I', code: 'W14X90' }))).piece;
  assert.deepEqual([p.profile, p.code], ['W14X90', 'I']);
  assert.equal(parseNc1(file(header({ code: 'ro' }))).piece.code, 'RO', 'any case');
});

test('missing fields: empty numbers read as 0; a short header or a non-number is broken, with its line', () => {
  const p = parseNc1(file(header({ kgm: '', m2m: '' }))).piece;
  assert.deepEqual([p.kgm, p.m2m], [0, 0]);
  assert.equal(parseNc1(file(header({ qty: '' }))).piece.qty, 0);
  assert.deepEqual(parseNc1(file(header({ length: '6236:88' }))), { ok: false, reason: 'broken', line: 11 });
  assert.deepEqual(parseNc1(file(header({ qty: 'x' }))), { ok: false, reason: 'broken', line: 8 });
  assert.deepEqual(parseNc1(file(header().slice(0, 12))), { ok: false, reason: 'broken', line: 13 });
});

test('a file that is not NC1 (no ST block first) is told apart', () => {
  assert.deepEqual(parseNc1('T\n  1\n'), { ok: false, reason: 'notnc1' });
  assert.deepEqual(parseNc1('0\nSECTION\n2\nENTITIES\n'), { ok: false, reason: 'notnc1' });
  assert.deepEqual(parseNc1(''), { ok: false, reason: 'notnc1' });
});

test('BO: face, x with its reference letter, y, diameter, depth and the slot fields; the face carries over', () => {
  const r = parseNc1(file([...header(), 'BO', '  o   3880.00s    50.00     22.00     0.00', '      3960.00s   150.00     22.00', '  v    100.00u    95.00     18.00     0.0    60.0    0.0    0.0', 'EN']));
  const h = r.piece.holes;
  assert.equal(h.length, 3);
  assert.deepEqual(h[0], { face: 'o', x: 3880, y: 50, d: 22, depth: 0, slot: null, ref: 's', line: 28 });
  assert.equal(h[1].face, 'o', 'a line without a face keeps the one before');
  assert.deepEqual(h[2].slot, { l: 60, w: 0, angle: 0 });
  assert.equal(h[2].ref, 'u');
});

test('AK and IK: x, y and radius, notch suffixes, one contour per face, closed on the first point or at the block end', () => {
  const r = parseNc1(file([...header(), 'AK',
    '  v      0.00u      0.00      0.00', '  v   1952.00       0.00w    10.00', '  v    200.00     100.00    -10.00', '        200.00     110.00t   -10.00', '  v      0.00u      0.00      0.00',
    '  o      0.00s      0.00      0.00       0.00       0.00       0.00       0.00', '        100.00       0.00      0.00       0.00       0.00       0.00       0.00', '        100.00     200.00      0.00',
    'IK', '  v    130.00     150.00    -20.00', '  v    170.00     150.00    -20.00', '  v    130.00     150.00      0.00', 'EN']));
  const c = r.piece.contours;
  assert.deepEqual(c.map(x => `${x.kind}${x.face}${x.pts.length}`), ['AKv4', 'AKo3', 'IKv2']);
  assert.deepEqual(c[0].pts[1], { x: 1952, y: 0, r: 10, ref: '', notch: true });
  assert.deepEqual(c[0].pts[3], { x: 200, y: 110, r: -10, ref: '', notch: true });
  assert.equal(c[0].pts[2].notch, false);
  assert.deepEqual(c[2].pts, [{ x: 130, y: 150, r: -20, ref: '', notch: false }, { x: 170, y: 150, r: -20, ref: '', notch: false }], 'a circle of two arcs');
});

test('SI, KO, PU, KA, numbered and unknown blocks are read and skipped; a data line before any block is broken', () => {
  const r = parseNc1(file([...header(), 'SI', '  v   20.00s   20.00   0.00  10 B1', 'KO', '  v 10.00 10.00 0.00', 'PU', '  v 5 5 0', 'KA', '  v 1 2 3 4', 'E1', '  0.00 0.00 90.00', 'B1', '  1100.00u 53.00 18.00', 'EN', 'BO', '  v 1 1 1']));
  assert.deepEqual(r.piece.skipped, { SI: 1, KO: 1, PU: 1, KA: 1, E1: 1, B1: 1 });
  assert.equal(r.piece.holes.length, 0, 'nothing after EN');
  const bad = parseNc1(file([...header().slice(0, 22), '  v 1 1 1']));
  assert.equal(bad.ok, true, 'without text lines, the next indented line is taken as one');
  assert.deepEqual(parseNc1(file([...header(), 'BO', '  v  12.0  zz  22.0'])), { ok: false, reason: 'broken', line: 28 });
  assert.deepEqual(parseNc1(file([...header(), 'BO', '  v  12.0'])), { ok: false, reason: 'broken', line: 28 });
});

test('a file without EN, and a header without its text lines, still read', () => {
  const r = parseNc1(file([...header().slice(0, 22), 'BO', '  v 10 20 14']));
  assert.equal(r.ok, true);
  assert.deepEqual(r.piece.text, []);
  assert.equal(r.piece.holes.length, 1);
});
