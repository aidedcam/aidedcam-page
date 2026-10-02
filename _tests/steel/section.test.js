import { test } from 'node:test';
import assert from 'node:assert/strict';
import { section, taperOf, plateDims } from '../../js/steel/section.js';

// Published values (A mm², G kg/m, AL m²/m): staticstools.eu section tables (EN 10365 / DIN 1025 / DIN 1026-1 /
// EN 10056-1 / EN 10210-2), HE 200 A also British Steel's HE datasheet (42.3 kg/m, 53.8 cm²); the flat bar from its
// dimensions (EN 10058). Within 1 % (spec §11).
const CATALOGUE = [
  ['HEA 200', { code: 'I', h: 190, b: 200, tf: 10, tw: 6.5, r: 18 }, 5383, 42.3, 1.14],
  ['IPE 300', { code: 'I', h: 300, b: 150, tf: 10.7, tw: 7.1, r: 15 }, 5380, 42.2, 1.16],
  ['UPN 200', { code: 'U', h: 200, b: 75, tf: 11.5, tw: 8.5, r: 11.5, profile: 'UPN 200' }, 3220, 25.3, 0.66],
  ['L 80×8', { code: 'L', h: 80, b: 80, tf: 8, tw: 8, r: 10 }, 1227, 9.63, 0.3114],
  ['RHS 100×50×4', { code: 'M', h: 100, b: 50, tf: 4, tw: 4, r: 6 }, 1120, 8.78, 0.29],
  ['CHS 114.3×5', { code: 'RO', h: 114.3, b: 114.3, tf: 5, tw: 5 }, 1720, 13.5, 0.359],
  ['FL 100×10', { code: 'B', h: 100, b: 10, tf: 10, tw: 10 }, 1000, 7.85, 0.22],
];

test('area, kg/m and painted perimeter against the catalogue, within 1 %', () => {
  for (const [name, s, A, G, AL] of CATALOGUE) {
    const r = section(s);
    const near = (got, want, what) => assert.ok(Math.abs(got / want - 1) < 0.01, `${name} ${what}: ${got} vs ${want}`);
    near(r.area, A, 'A');
    near(r.area * 7850e-6, G, 'G');
    near(r.perimeter / 1000, AL, 'AL');
  }
});

test('the exact formulas: fillets of parallel-flange I sections, the UPN taper, EN 10210 corners', () => {
  const hea = section({ code: 'I', h: 190, b: 200, tf: 10, tw: 6.5, r: 18 });
  assert.equal(+hea.area.toFixed(2), 5383.12);
  assert.equal(+hea.perimeter.toFixed(2), 1136.10);
  assert.equal(taperOf('UPN 200'), 0.08);
  assert.equal(taperOf('U200'), 0.08);
  assert.equal(taperOf('UPE 200'), 0);
  assert.equal(taperOf('PFC250*90'), 0);
  const upe = section({ code: 'U', h: 200, b: 80, tf: 11, tw: 6, r: 13, profile: 'UPE 200' });
  assert.ok(Math.abs(upe.area - 2900) < 30, `UPE 200: ${upe.area} (catalogue 29.0 cm²)`);
  const rhs = section({ code: 'M', h: 100, b: 50, tf: 4, tw: 4, r: 0 });
  assert.equal(+rhs.area.toFixed(1), 1118.8, 'no radius: 1.5 t outside, t inside');
  assert.equal(+section({ code: 'M', h: 100, b: 50, tw: 4, r: 6, ri: 2 }).area.toFixed(1), 1108.5, 'an inner radius given');
  assert.equal(+section({ code: 'RU', h: 20 }).area.toFixed(2), 314.16);
  assert.equal(+section({ code: 'T', h: 100, b: 100, tf: 11, tw: 11, r: 0 }).area.toFixed(0), 2079);
});

test('no section without its dimensions, or for a special profile', () => {
  assert.equal(section({ code: 'SO', h: 175, b: 81, tf: 1.5, tw: 1.5 }), null);
  assert.equal(section({ code: 'I', h: 190, b: 200, tf: 0, tw: 6.5 }), null);
  assert.equal(section({ code: 'RO', h: 10, tw: 6 }), null, 'a wall thicker than the radius');
  assert.equal(section({ code: 'B', h: 0, b: 0, tw: 0, tf: 0 }), null);
});

test('a plate from its header: thickness from the web, else the flange, else the smaller dimension', () => {
  assert.deepEqual(plateDims({ h: 300, b: 20, tf: 20, tw: 20 }), { t: 20, w: 300 });
  assert.deepEqual(plateDims({ h: 10, b: 196.451, tf: 0, tw: 10 }), { t: 10, w: 196.451 });
  assert.deepEqual(plateDims({ h: 200, b: 15, tf: 15, tw: 0 }), { t: 15, w: 200 });
  assert.deepEqual(plateDims({ h: 200, b: 15, tf: 0, tw: 0 }), { t: 15, w: 200 });
});
