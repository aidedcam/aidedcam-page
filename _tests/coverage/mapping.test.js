import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, LEVELS, TEMPLATE, normName, templateFor, autoMap, remember, cleanRemembered, layerList, rolesUsed, isClosed, isOpen } from '../../js/coverage/mapping.js';
import { item, rect, result } from './helpers.mjs';

test('the template: 25 layers, every role but Ignore, every level once', () => {
  assert.equal(TEMPLATE.length, 25);
  assert.deepEqual([...new Set(TEMPLATE.map(t => t.role))].sort(), ROLES.filter(r => r !== 'ignore').sort());
  assert.deepEqual(TEMPLATE.filter(t => t.role === 'level').map(t => t.level), LEVELS);
  assert.equal(new Set(TEMPLATE.map(t => normName(t.layer))).size, 25, 'no two template names collide once normalised');
});

test('template names match ignoring case and the separators - _ and spaces', () => {
  for (const name of ['AC_LVL_01', 'ac_lvl_01', 'AC-LVL-01', 'Ac Lvl 01', 'AC__LVL 01', 'aclvl01']) {
    const t = templateFor(name);
    assert.deepEqual(t && [t.role, t.level], ['level', '01'], name);
  }
  assert.equal(templateFor('AC_PLOT').role, 'plot');
  assert.equal(templateFor('AC_LVL_10'), null, 'there is no floor 10');
  assert.equal(templateFor('ΟΙΚΟΠΕΔΟ'), null);
  assert.equal(templateFor('AC_PLOTS'), null);
});

test('auto-fill: template names first, then what this browser remembers, else Ignore', () => {
  const remembered = { 'ΟΡΙΑ ΟΙΚΟΠΕΔΟΥ': { role: 'plot' }, 'ΚΑΤΟΨΗ Α': { role: 'level', level: '01' }, AC_COVER: { role: 'green' }, 'ΠΑΛΙΑ': { role: 'nonsense' } };
  const { map, fromTemplate, fromMemory } = autoMap(['ac-cover', 'ΟΡΙΑ ΟΙΚΟΠΕΔΟΥ', 'ΚΑΤΟΨΗ Α', 'ΠΑΛΙΑ', 'ΤΟΙΧΟΙ', 'AC_COVER'], remembered);
  assert.deepEqual(map['ac-cover'], { role: 'cover' });
  assert.deepEqual(map.AC_COVER, { role: 'cover' }, 'a template name wins over a remembered role');
  assert.deepEqual(map['ΟΡΙΑ ΟΙΚΟΠΕΔΟΥ'], { role: 'plot' });
  assert.deepEqual(map['ΚΑΤΟΨΗ Α'], { role: 'level', level: '01' });
  assert.deepEqual(map['ΠΑΛΙΑ'], { role: 'ignore' }, 'a malformed memory is ignored');
  assert.deepEqual(map['ΤΟΙΧΟΙ'], { role: 'ignore' });
  assert.equal(fromTemplate, 2); assert.equal(fromMemory, 2);
});

test('remembering: roles by layer name; template names and Ignore are not stored; other files keep theirs', () => {
  const before = { 'OTHER FILE': { role: 'green' }, 'ΚΑΤΟΨΗ Α': { role: 'plot' } };
  const after = remember(before, { AC_PLOT: { role: 'plot' }, 'ΚΑΤΟΨΗ Α': { role: 'ignore' }, 'ΚΑΤΟΨΗ Β': { role: 'level', level: '02' }, 'ΜΠΑΛΚΟΝΙΑ': { role: 'balcony' } });
  assert.deepEqual(after, { 'OTHER FILE': { role: 'green' }, 'ΚΑΤΟΨΗ Β': { role: 'level', level: '02' }, 'ΜΠΑΛΚΟΝΙΑ': { role: 'balcony' } });
  assert.deepEqual(cleanRemembered({ a: { role: 'level', level: 'XX' }, b: { role: 'void' }, c: null, d: 'x' }), { b: { role: 'void' } });
  assert.deepEqual(cleanRemembered('not an object'), {});
});

test('the layer list: layers with closed outlines, counted, and the others apart', () => {
  const r = result([
    item('AC_PLOT', rect(0, 0, 20, 25)),
    item('ROOMS', rect(0, 0, 2, 2)), item('ROOMS', rect(5, 0, 3, 2)), item('ROOMS', [[0, 0], [2, 2], [2, 0], [0, 2]], { bad: true }),
    item('ROOMS', [[0, 0], [1, 0], [1, 1]], { closed: false }),
    item('TEXT', [[0, 0], [1, 0]], { closed: false }),
    { id: 'H1', layer: 'HATCH', kind: 'hatch', area: 50, bad: false, path: [] },
  ]);
  const { used, other } = layerList(r);
  assert.deepEqual(used.map(l => [l.name, l.outlines, l.area, l.bad, l.open]), [['AC_PLOT', 1, 500, 0, 0], ['ROOMS', 3, 10, 1, 1]]);
  assert.deepEqual(other.map(l => l.name), ['TEXT', 'HATCH']);
});

test('closed and open: hatches and inserts are never outlines; lines and arcs are not open outlines', () => {
  assert.equal(isClosed({ kind: 'circle', area: 3 }), true);
  assert.equal(isClosed({ kind: 'polyline', area: 0, bad: true }), true);
  assert.equal(isClosed({ kind: 'hatch', area: 3 }), false);
  assert.equal(isOpen({ kind: 'polyline', area: 0 }), true);
  assert.equal(isOpen({ kind: 'line', area: 0 }), false);
  assert.equal(rolesUsed({ a: { role: 'plot' }, b: { role: 'level', level: '00' }, c: { role: 'level', level: '01' }, d: { role: 'ignore' } }), 2);
});
