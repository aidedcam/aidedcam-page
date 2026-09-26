import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProgram, parseLine } from '../../js/gcode/parse.js';

const letters = b => b.words.map(w => w.letter + w.raw);

test('words, N number and comment', () => {
  const b = parseLine('N10 G0 G42 X229.5 Z15.366 (PROFILE)', 1);
  assert.equal(b.n, 10);
  assert.deepEqual(letters(b), ['G0', 'G42', 'X229.5', 'Z15.366']);
  assert.equal(b.comment, 'PROFILE');
  assert.equal(b.skipped, null);
});

test('glued words, lowercase and .5 numbers', () => {
  const b = parseLine('g99g18 x.5 z-2.', 3);
  assert.deepEqual(letters(b), ['G99', 'G18', 'X.5', 'Z-2.']);
  assert.equal(b.words[2].value, 0.5);
  assert.equal(b.words[3].value, -2);
  assert.equal(b.words[3].hasDecimal, true);
});

test('semicolon comment and block delete', () => {
  const b = parseLine('/G1 X10 ; note', 1);
  assert.equal(b.deleted, true);
  assert.equal(b.comment, 'note');
  assert.deepEqual(letters(b), ['G1', 'X10']);
});

test('blank, percent, macro and expression lines are skipped', () => {
  assert.equal(parseLine('', 1).skipped, 'blank');
  assert.equal(parseLine('%', 1).skipped, 'blank');
  assert.equal(parseLine('(ONLY A COMMENT)', 1).skipped, 'blank');
  assert.equal(parseLine('#500 = 0', 1).skipped, 'macro');
  assert.equal(parseLine('G1 X[#1+2]', 1).skipped, 'expression');
});

test('T3W303 is one tool call, not a W move', () => {
  const b = parseLine('T3W303', 1);
  assert.equal(b.words.length, 1);
  assert.equal(b.words[0].letter, 'T');
  assert.equal(b.words[0].toolKey, 'T3W303');
});

test('T3 W303 with a space stays two words', () => {
  const b = parseLine('T3 W303', 1);
  assert.deepEqual(letters(b), ['T3', 'W303']);
});

test('CRLF, tabs and line numbers', () => {
  const blocks = parseProgram('G0\tX10\r\nG1 Z-5\r\n');
  assert.equal(blocks.length, 3);
  assert.deepEqual(letters(blocks[1]), ['G1', 'Z-5']);
  assert.equal(blocks[1].line, 2);
});

test('decimal flag and O number', () => {
  assert.equal(parseLine('X100', 1).words[0].hasDecimal, false);
  assert.equal(parseLine('X100.', 1).words[0].hasDecimal, true);
  const o = parseLine('O71', 1);
  assert.equal(o.o, 71);
  assert.deepEqual(o.words, []);
});

test('unclosed comment runs to end of line', () => {
  const b = parseLine('G0 X10 (START', 1);
  assert.deepEqual(letters(b), ['G0', 'X10']);
  assert.equal(b.comment, 'START');
});
