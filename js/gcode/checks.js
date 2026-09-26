// Turns interpreter facts (events) and cycle records into warnings. Pure. Spec §6.
// Rules for G71/G72 profiles follow our internal cycle-g71-research.md §1.4–1.6 (alarms 064/065/069).
import { flatten } from './geom.js';

export const SEVERITY = {
  'g96-no-g50': 'warn', 'type1-monotonic': 'error', 'p-block': 'error', 'q-block-corner': 'error',
  'tnrc-scope': 'warn', 'start-in-material': 'warn', 'allowance-vs-depth': 'info', 'pq-decimal': 'warn',
  'css-threading': 'warn', 'no-feed': 'warn', 'no-speed': 'warn', 'tool-zero': 'warn', 'subprogram': 'info',
  'skipped': 'info', 'milling': 'info', 'pq-not-found': 'error', 'cycle-no-start': 'warn',
  'cycle-form': 'error', 'cycle-unsupported': 'error', 'type2-pocket': 'info',
};
const EVENT_ID = { 'css-no-limit': 'g96-no-g50', 'css-thread': 'css-threading', 'm98': 'subprogram' };
const ONCE = new Set(['g96-no-g50', 'milling']);

export function runChecks(run) {
  const out = [];
  const add = (id, line, params = {}) => out.push({ id, line, severity: SEVERITY[id], params });
  const seen = new Set();
  let skipped = null;
  const cutTools = new Set(run.segments.filter(s => s.kind !== 'rapid' && s.kind !== 'dwell').map(s => s.tool));

  for (const e of run.events) {
    const id = EVENT_ID[e.type] || e.type;
    if (id === 'skipped') { skipped = skipped || { line: e.line, count: 0 }; skipped.count++; continue; }
    if (!SEVERITY[id]) continue;
    if (id === 'tool-zero' && !cutTools.has(e.tool)) continue;
    const key = ONCE.has(id) ? id : `${id}@${e.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    add(id, e.line, { code: e.code, tool: e.tool, p: e.p, q: e.q });
  }
  if (skipped) add('skipped', skipped.line, { count: skipped.count });
  for (const c of run.cycles) checkRoughCycle(c, add);
  return out.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
}

function checkRoughCycle(c, add) {
  if (![71, 72, 73].includes(c.code) || !c.pBlock) return;
  const params = { code: c.code };
  if (c.type === 'bad') add('p-block', c.pBlock.line, params);
  const last = c.body[c.body.length - 1];
  const qIsArc = !!(last && last.arc && last.line === c.qBlock.line);
  if (hasCorner(c.qBlock, qIsArc)) add('q-block-corner', c.qBlock.line, params);
  if (c.tnrcAtCall !== 40 || c.tnrcAtQ !== 40) add('tnrc-scope', c.line, params);
  if (!c.frame || !c.body.length) return;
  const pts = bodyPoints(c.body).map(c.frame.toN);
  if (c.type === 'I' && !monotonic(pts)) add('type1-monotonic', c.pBlock.line, params);
  if (c.type === 'II' && !monotonic(pts)) add('type2-pocket', c.pBlock.line, params);   // pockets: passes stop at the first rise
  const s = c.frame.toN(c.start);
  let maxD = -Infinity, maxC = -Infinity;                // a loop: a spread of a long profile overflows the stack
  for (const p of pts) { maxD = Math.max(maxD, p.d); maxC = Math.max(maxC, p.c); }
  if (s.d < maxD - 1e-3 || s.c < maxC - 1e-3) add('start-in-material', c.line, params);
  if (c.depth !== null && c.allowD >= c.depth) add('allowance-vs-depth', c.line, params);
}

// Fanuc chamfer/corner words in the Q block: C, or R on a straight move (R on G2/G3 is the radius).
function hasCorner(block, qIsArc) {
  return block.words.some(w => w.letter === 'C') || (!qIsArc && block.words.some(w => w.letter === 'R'));
}

function bodyPoints(body) {
  const flat = flatten(body, 16);
  const pts = flat.length ? [{ x: flat[0].x1, z: flat[0].z1 }] : [];
  for (const s of flat) pts.push({ x: s.x2, z: s.z2 });
  return pts;
}

// In the normalised frame a Type I profile never climbs back in c and never drops in d.
function monotonic(pts) {
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].c > pts[i - 1].c + 1e-6) return false;
    if (pts[i].d < pts[i - 1].d - 1e-6) return false;
  }
  return true;
}
