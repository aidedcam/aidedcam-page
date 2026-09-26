// Seconds per segment and the per-tool summary. Pure. Spec §7. Starts from our desktop
// CycleTimeEstimator, adding G96 integration along the move, per-axis rapids, threads, dwell and
// tool changes. The result is a planning estimate: no acceleration, spindle ramp or M-code time.
import { segmentLength, sampleArc } from './geom.js';
import { CYCLE_FAILURES } from './machine.js';

const R_FLOOR = 0.05;       // mm: our desktop CycleTimeEstimator's floor on the radius
const STEPS = 32;           // sub-steps for tapers and arcs under G96
const BOX = new Set([90, 92, 94]);

export function rpmAt(spindle, r) {
  if (spindle.mode === 'css') {
    if (!(spindle.s > 0)) return null;
    const n = (spindle.s * 1000) / (2 * Math.PI * Math.max(R_FLOOR, Math.abs(r)));
    return spindle.max ? Math.min(spindle.max, n) : n;
  }
  return spindle.s > 0 ? spindle.s : null;
}

// Minutes to feed radially from r1 to r2 (same side of the axis) at f mm/rev under G96 with Vc m/min
// and an optional rpm clamp nMax. Above r_c = C/nMax, rpm = C/r, so dt = r·dr/(f·C); below it, rpm = nMax.
export function cssRadialMinutes(r1, r2, f, vc, nMax) {
  const a = Math.min(Math.abs(r1), Math.abs(r2)), b = Math.max(Math.abs(r1), Math.abs(r2));
  const C = (vc * 1000) / (2 * Math.PI);
  const rc = nMax ? C / nMax : 0;
  let t = 0;
  const hiStart = Math.max(a, rc);
  if (b > hiStart) t += (b * b - hiStart * hiStart) / (2 * f * C);
  const loEnd = Math.min(b, rc);
  if (loEnd > a) t += (loEnd - a) / (f * nMax);
  return t;
}

function linePoints(a, b, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push({ x: a.x + (b.x - a.x) * i / n, z: a.z + (b.z - a.z) * i / n });
  return pts;
}

export function segmentSeconds(seg, s) {
  if (seg.kind === 'dwell') return seg.dwell ?? 0;
  if (seg.kind === 'rapid') {
    const dx = Math.abs(seg.to.x - seg.from.x), dz = Math.abs(seg.to.z - seg.from.z);
    return Math.max(dx / s.rapidX, dz / s.rapidZ) * 60;
  }
  const f = seg.feed.f;
  if (!(f > 0)) return null;
  const L = segmentLength(seg);
  if (seg.feed.mode === 'min' && seg.kind !== 'thread') return (L / f) * 60;
  const sp = seg.spindle;
  if (sp.mode !== 'css') return sp.s > 0 ? (L / (f * sp.s)) * 60 : null;
  if (!(sp.s > 0)) return null;
  if (!seg.arc && Math.abs(seg.to.z - seg.from.z) < 1e-9) {
    const r1 = seg.from.x, r2 = seg.to.x;
    const mins = r1 * r2 < 0
      ? cssRadialMinutes(r1, 0, f, sp.s, sp.max) + cssRadialMinutes(0, r2, f, sp.s, sp.max)
      : cssRadialMinutes(r1, r2, f, sp.s, sp.max);
    return mins * 60;
  }
  const pts = seg.arc ? sampleArc(seg.from, seg.to, seg.arc, STEPS) : linePoints(seg.from, seg.to, STEPS);
  let mins = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const n = rpmAt(sp, (a.x + b.x) / 2);
    if (!(n > 0)) return null;
    mins += Math.hypot(b.x - a.x, b.z - a.z) / (f * n);
  }
  return mins * 60;
}

export function computeTimes(run, s) {
  const k = 1 + (s.correctionPct || 0) / 100;
  const rows = new Map();
  const labels = new Map(run.tools.map(t => [t.tool, t.label]));
  const rowFor = tool => {
    const key = tool || '';
    if (!rows.has(key)) {
      rows.set(key, { tool: key, label: labels.get(key) || '', cycles: new Set(), passes: new Set(),
        cutLength: 0, cutSeconds: 0, rapidSeconds: 0, changeSeconds: 0, dwellSeconds: 0, incomplete: false });
    }
    return rows.get(key);
  };
  for (const t of run.tools) rowFor(t.tool);
  for (const seg of run.segments) {
    const sec = segmentSeconds(seg, s);
    seg.seconds = sec === null ? null : sec * k;
    const row = rowFor(seg.tool);
    if (seg.cycle) {
      row.cycles.add(seg.cycle.line);
      const pass = seg.kind === 'pass' || seg.kind === 'thread' || BOX.has(seg.cycle.code);   // a box block is one pass
      if (pass) row.passes.add(`${seg.cycle.line}:${seg.cycle.passIndex}`);
    }
    if (sec === null) { row.incomplete = true; continue; }
    if (seg.kind === 'rapid') row.rapidSeconds += sec;
    else if (seg.kind === 'dwell') row.dwellSeconds += sec;
    else { row.cutSeconds += sec; row.cutLength += segmentLength(seg); }
  }
  for (const c of run.toolChanges) rowFor(c.tool).changeSeconds += s.toolChangeSeconds;
  // A cycle the viewer could not draw has no time of its own: its tool's time is incomplete (spec §5.2).
  for (const e of run.events) if (CYCLE_FAILURES.has(e.type)) rowFor(e.tool).incomplete = true;

  const out = [...rows.values()]
    .filter(r => r.tool !== '' || r.cutSeconds + r.rapidSeconds + r.dwellSeconds > 0 || r.incomplete)
    .map(r => {
      const cut = r.cutSeconds * k, rapid = r.rapidSeconds * k, change = r.changeSeconds * k, dwell = r.dwellSeconds * k;
      return { tool: r.tool, label: r.label, cycles: r.cycles.size, passes: r.passes.size, cutLength: r.cutLength,
        cutSeconds: cut, rapidSeconds: rapid, changeSeconds: change, dwellSeconds: dwell,
        totalSeconds: cut + rapid + change + dwell, incomplete: r.incomplete };
    });
  return { rows: out, total: out.reduce((a, r) => a + r.totalSeconds, 0), incomplete: out.some(r => r.incomplete) };
}

export function formatDuration(sec) {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return '–';
  const t = Math.round(sec);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), r = t % 60;
  const pad = n => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}
