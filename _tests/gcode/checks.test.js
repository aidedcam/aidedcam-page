import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseProgram } from '../../js/gcode/parse.js';
import { interpret } from '../../js/gcode/interpret.js';
import { runChecks, SEVERITY } from '../../js/gcode/checks.js';

const check = text => runChecks(interpret(parseProgram(text)));
const ids = ws => ws.map(w => w.id);
const HEAD = 'G21 G99\nG50 S3000\nG96 S200 M3\nT0101\nG0 X100 Z2\nG71 U2 R0.5\nG71 P10 Q20 U0.4 W0.1 F0.25\n';

test('a clean program has no warnings', () => {
  const text = readFileSync(new URL('./fixtures/g71-od.nc', import.meta.url), 'utf8');
  assert.deepEqual(check(text), []);
});

test('G96 without G50 is reported once', () => {
  const ws = check('G99\nG96 S200\nT0101\nG0 X100 Z0\nG1 X50 F0.2\nG1 Z-10');
  assert.deepEqual(ids(ws), ['g96-no-g50']);
  assert.equal(ws[0].severity, 'warn');
});

test('tool zero only when it cuts', () => {
  assert.deepEqual(ids(check('G99 G97 S500\nT0W000\nG0 X10 Z0\nG1 Z-5 F0.1')), ['tool-zero']);
  assert.deepEqual(ids(check('T0100\nM30')), []);
});

// Fix C2: the R14 same-number rename (T<tt>00 confirmed later by T<tt><oo>) must not carry the
// immediate tool-zero it fired on selection onto the merged row unless a real cut happened while
// the offset was still zero - the whole point of the pattern is a turret index with no cutting yet.
test('tool-zero: a same-number offset apply does not warn when nothing cut at offset zero', () => {
  assert.deepEqual(ids(check('G0 X60 Z5\nT0100\nG0 X50 Z2\nT0101\nG1 X40 Z-10 F0.2 S1000')), []);
});

test('tool-zero: a same-number offset apply still warns if it cut before the real offset arrived', () => {
  assert.deepEqual(ids(check('T0100\nG0 X50 Z2\nG1 X40 Z-10 F0.2 S1000\nT0101\nG1 X30 Z-20')), ['tool-zero']);
});

test('Type I profile that is not monotonic (Fanuc alarm 064)', () => {
  const ws = check(HEAD + 'N10 G0 X60\nG1 Z-10 F0.1\nX50\nZ-20\nN20 X100');
  assert.ok(ids(ws).includes('type1-monotonic'));
});

test('P block with Z only (alarm 065)', () => {
  const ws = check(HEAD + 'N10 G0 Z2\nG1 X60 F0.1\nZ-20\nN20 X100');
  assert.ok(ids(ws).includes('p-block'));
});

test('chamfer in the Q block (alarm 069)', () => {
  const ws = check(HEAD + 'N10 G0 X60\nG1 Z-20 F0.1\nN20 X100 C1');
  assert.ok(ids(ws).includes('q-block-corner'));
});

test('G42 still active at the end of the profile', () => {
  const ws = check(HEAD + 'N10 G0 G42 X60\nG1 Z-20 F0.1\nN20 X100');
  assert.ok(ids(ws).includes('tnrc-scope'));
});

test('cycle start inside the material', () => {
  const ws = check('G21 G99\nG50 S3000\nG96 S200 M3\nT0101\nG0 X70 Z2\nG71 U2 R0.5\nG71 P10 Q20 U0.4 W0.1 F0.25\nN10 G0 X60\nG1 Z-20 F0.1\nX100\nN20 Z-40');
  assert.ok(ids(ws).includes('start-in-material'));
});

test('skipped lines are summarised once with a count', () => {
  const ws = check('#1 = 5\n#2 = 6\nG0 X10 Z0');
  assert.equal(ws.length, 1);
  assert.equal(ws[0].id, 'skipped');
  assert.equal(ws[0].params.count, 2);
});

test('Type II profile with a pocket is flagged for verification', () => {
  const ws = check(HEAD + 'N10 G0 X60 Z2\nG1 Z-10 F0.1\nX50\nZ-20\nN20 X100');
  assert.ok(ids(ws).includes('type2-pocket'));
  assert.ok(!ids(ws).includes('type1-monotonic'));
});

test('P/Q with a decimal point', () => {
  const ws = check('G97 S600 G99\nT0606\nG0 X52 Z-10\nG75 R0.5\nG75 X40 Z-14 P2. Q3. F0.05');
  assert.ok(ids(ws).includes('pq-decimal'));
});

test('a very long profile body is checked without a stack overflow', () => {
  const run = interpret(parseProgram(HEAD + 'N10 G0 X60\nG1 Z-20 F0.1\nN20 X100'));
  const n = 300000, from = i => ({ x: 30, z: -20 * i / n });
  run.cycles[0].body = Array.from({ length: n }, (_, i) => ({ kind: 'feed', from: from(i), to: from(i + 1), arc: null, line: 13 }));
  assert.doesNotThrow(() => runChecks(run));
});

test('an unsupported cycle is an error and names its code', () => {
  const ws = check('G0 X0 Z5\nG83 Z-30. Q5000 R-3. F0.1');
  assert.deepEqual(ws.map(w => [w.id, w.severity, w.params.code, w.line]), [['cycle-unsupported', 'error', 83, 2]]);
});

test('tool-zero after an offset cancel: only when the tool then feeds', () => {
  const base = 'G99 G97 S500\nT0101\nG0 X50 Z2\nG1 Z-10 F0.1\nG0 X100 Z100 T0100\n';
  assert.deepEqual(ids(check(base + 'M30')), []);
  const ws = check(base + 'G0 X50 Z2\nG1 Z-20 F0.1\nM30');
  assert.deepEqual(ws.map(w => [w.id, w.line, w.params.tool]), [['tool-zero', 5, 'T0101']]);
});

// Spec §10.4: every rule fires on a bad fixture and stays silent on a good one.
const SETUP = 'G21 G99\nG50 S3000\nG96 S200 M3\nT0101\n';
const PROF = 'N10 G0 X60\nG1 Z-20 F0.1\nX80\nZ-40\nN20 X100';
const RPM = 'G21 G99\nG97 S500 M3\nT0101\n';
const CASES = {
  'g96-no-g50': ['G21 G99\nG96 S200 M3\nT0101\nG0 X100 Z0\nG1 X50 F0.2', SETUP + 'G0 X100 Z0\nG1 X50 F0.2'],
  'type1-monotonic': [HEAD + 'N10 G0 X60\nG1 Z-10 F0.1\nX50\nZ-20\nN20 X100', HEAD + PROF],
  'p-block': [HEAD + 'N10 G0 Z2\nG1 X60 F0.1\nZ-20\nN20 X100', HEAD + PROF],
  'q-block-corner': [HEAD + 'N10 G0 X60\nG1 Z-20 F0.1\nN20 X100 C1', HEAD + 'N10 G0 X60\nG1 Z-20 F0.1\nN20 X100'],
  'tnrc-scope': [HEAD + 'N10 G0 G42 X60\nG1 Z-20 F0.1\nN20 X100', HEAD + 'N10 G0 G42 X60\nG1 Z-20 F0.1\nN20 G40 X100'],
  'start-in-material': [SETUP + 'G0 X70 Z2\nG71 U2 R0.5\nG71 P10 Q20 U0.4 W0.1 F0.25\n' + PROF, HEAD + PROF],
  'allowance-vs-depth': [SETUP + 'G0 X100 Z2\nG71 U0.5 R0.5\nG71 P10 Q20 U2 W0.1 F0.25\n' + PROF, HEAD + PROF],
  'pq-decimal': ['G97 S600 G99\nT0606\nG0 X52 Z-10\nG75 R0.5\nG75 X40 Z-14 P2. Q3. F0.05',
    'G97 S600 G99\nT0606\nG0 X52 Z-10\nG75 R0.5\nG75 X40 Z-14 P2000 Q3000 F0.05'],
  'css-threading': [SETUP + 'G0 X19 Z5\nG32 Z-20 F1.5', 'G21 G99\nG97 S800 M3\nT0101\nG0 X19 Z5\nG32 Z-20 F1.5'],
  'no-feed': [RPM + 'G0 X50 Z2\nG1 Z-20', RPM + 'G0 X50 Z2\nG1 Z-20 F0.2'],
  'no-speed': ['G21 G99\nT0101\nG0 X50 Z2\nG1 Z-20 F0.2', RPM + 'G0 X50 Z2\nG1 Z-20 F0.2'],
  'tool-zero': ['G99 G97 S500\nT0W000\nG0 X10 Z0\nG1 Z-5 F0.1', 'G99 G97 S500\nT0101\nG0 X10 Z0\nG1 Z-5 F0.1'],
  'subprogram': [RPM + 'G0 X10 Z0\nM98 P1000', RPM + 'G0 X10 Z0'],
  'skipped': [RPM + '#1 = 5\nG0 X10 Z0', RPM + 'G0 X10 Z0'],
  'milling': [RPM + 'G17\nG0 X10 Z5', RPM + 'G18\nG0 X10 Z5'],
  'pq-not-found': [HEAD.replace('Q20', 'Q99') + PROF, HEAD + PROF],
  'cycle-no-start': [SETUP + 'G71 U2 R0.5\nG71 P10 Q20 U0.4 W0.1 F0.25\n' + PROF, HEAD + PROF],
  'cycle-form': [SETUP + 'G0 X100 Z2\nG71 P10 Q20 U0.4 W0.1 F0.25\n' + PROF, HEAD + PROF],
  'cycle-unsupported': ['G97 S800 G99\nT0505\nG0 X0 Z5\nG83 Z-30. Q5000 R-3. F0.1\nG80',
    'G97 S800 G99\nT0505\nG0 X0 Z5\nG74 R1.\nG74 Z-30. Q5000 F0.1'],
  'type2-pocket': [HEAD + 'N10 G0 X60 Z2\nG1 Z-10 F0.1\nX50\nZ-20\nN20 X100', HEAD + 'N10 G0 X60 Z2\n' + PROF.slice(PROF.indexOf('\n') + 1)],
};

test('every check id has a bad and a good fixture', () => {
  assert.deepEqual(Object.keys(CASES).sort(), Object.keys(SEVERITY).sort());
});

for (const [id, [bad, good]] of Object.entries(CASES)) {
  test(`check ${id}: fires on its bad fixture, and the good fixture is clean`, () => {
    const b = check(bad);
    assert.ok(ids(b).includes(id), `bad fixture gave [${ids(b)}]`);
    assert.equal(b.find(w => w.id === id).severity, SEVERITY[id]);
    assert.deepEqual(ids(check(good)), []);
  });
}
