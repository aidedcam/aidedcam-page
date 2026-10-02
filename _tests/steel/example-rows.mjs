// The example's NC1 set as take-off rows, for the tests that compare it (examples.test.js, ifcread.test.js).
import { readFileSync } from 'node:fs';
import { parseNc1 } from '../../js/steel/nc1.js';
import { nc1Piece } from '../../js/steel/piece.js';

const DIR = new URL('../../js/steel/examples/portal/', import.meta.url);

export function exampleRows() {
  const index = JSON.parse(readFileSync(new URL('index.json', DIR), 'utf8'));
  return index.files.map(f => nc1Piece(parseNc1(readFileSync(new URL(f, DIR), 'latin1')).piece, f));
}
