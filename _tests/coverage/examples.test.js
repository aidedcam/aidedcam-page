import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cp1253, dxf2000 } from './dxf-writer.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = p => readFileSync(new URL(`../../${p}`, import.meta.url));

test('the committed drawings are exactly what the generator writes', () => {
  // Exits non-zero when a committed file differs.
  execFileSync(process.execPath, ['_tests/coverage/make-examples.mjs', '--check'], { cwd: root, stdio: 'pipe' });
});

test('the example states metres and its integer group codes carry no decimal point', () => {
  const text = read('js/coverage/examples/example-permit.dxf').toString('latin1');
  assert.ok(text.includes('  9\r\n$INSUNITS\r\n 70\r\n6\r\n'), '$INSUNITS 6 (a "6.0" there is silently read as millimetres)');
  assert.ok(text.includes('LWPOLYLINE\r\n  5\r\n'), 'handles');
  assert.ok(!/\r\n (?:62|70|90)\r\n-?\d+\.\d/.test(text), 'no real in an integer group');
  assert.ok(text.includes(' 10\r\n410000.0\r\n 20\r\n4495000.0\r\n'), 'the plot in ΕΓΣΑ87');
});

test('the template is R12 with its Greek legend in Windows-1253', () => {
  const bytes = read('js/coverage/examples/layer-template.dxf');
  const text = new TextDecoder('windows-1253').decode(bytes);
  assert.ok(text.includes('$ACADVER\r\n  1\r\nAC1009') && text.includes('$DWGCODEPAGE\r\n  3\r\nANSI_1253'));
  assert.ok(text.includes('AC_PLOT  Οικόπεδο') && text.includes('AC_LVL_B1  Περίγραμμα στάθμης - Υπόγειο -1'), text.slice(-900));
  assert.ok(![...bytes].some(b => b === 0xc2 || b === 0xce), 'no UTF-8 lead bytes');
  // Without a STYLE table CAD draws the legend in STANDARD = txt, which has no Greek glyphs (AutoCAD, ZWCAD, BricsCAD).
  assert.ok(text.includes('  0\r\nTABLE\r\n  2\r\nSTYLE\r\n') && text.includes('  0\r\nSTYLE\r\n  2\r\nSTANDARD\r\n'), 'a STYLE table with STANDARD');
  assert.ok(text.includes('  3\r\narial.ttf\r\n') && !/\r\n  3\r\ntxt(?:\.shx)?\r\n/.test(text), 'STANDARD uses arial.ttf, not txt');
});

test('the writer refuses characters Windows-1253 cannot hold, and integers written as reals', () => {
  assert.deepEqual([...cp1253('Αω§')], [0xc1, 0xf9, 0xa7]);
  assert.throws(() => cp1253('−'), /U\+2212/);
  assert.throws(() => dxf2000({ units: 6.5, layers: [], polylines: [] }), /integer/);
});
