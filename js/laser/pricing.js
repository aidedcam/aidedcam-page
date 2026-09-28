// Laser DXF check: weight, cutting time and totals from the engine's geometry (spec §8). Pure: no DOM.
// The engine gives lengths in mm and areas in mm²; the page shows metres, kg and m:ss.

// Densities in g/cm³ (spec §8).
export const MATERIALS = {
  steel: 7.85, stainless: 7.93, aluminium: 2.70, galvanised: 7.85, copper: 8.96, brass: 8.50,
};

// Typical fiber-laser values (about 3 kW) per material, one row per thickness in mm:
// [thickness, cutting speed mm/min, pierce time s]. Sources and status: _docs/laser-checker/speed-defaults.md.
// The page labels them "typical values: set your machine's"; the shop's own values are saved in the browser.
export const DEFAULT_SPEEDS = {
  steel: [[0.5, 30000, 0.1], [1, 28000, 0.15], [2, 16000, 0.25], [3, 4500, 0.4], [5, 3000, 0.7], [8, 1900, 1.3], [10, 1300, 2], [15, 750, 3.5], [20, 450, 5.5]],
  stainless: [[0.5, 34000, 0.1], [1, 27000, 0.15], [2, 13000, 0.3], [3, 6500, 0.5], [5, 2200, 0.9], [8, 1000, 1.6], [10, 700, 2.3], [15, 250, 4.5], [20, 120, 7]],
  aluminium: [[0.5, 35000, 0.1], [1, 20000, 0.15], [2, 10000, 0.3], [3, 5000, 0.5], [5, 2000, 0.9], [8, 800, 1.6], [10, 450, 2.3], [15, 180, 4.5], [20, 90, 7]],
  galvanised: [[0.5, 27000, 0.15], [1, 25000, 0.2], [2, 13500, 0.3], [3, 3800, 0.5], [5, 2550, 0.9], [8, 1600, 1.6], [10, 1100, 2.3], [15, 640, 4], [20, 380, 6.5]],
  copper: [[0.5, 16000, 0.2], [1, 10000, 0.3], [2, 3500, 0.5], [3, 2200, 0.8], [5, 1000, 1.4], [8, 250, 3], [10, 150, 4.5], [15, 70, 7], [20, 40, 9]],
  brass: [[0.5, 29000, 0.2], [1, 25000, 0.3], [2, 10000, 0.5], [3, 6000, 0.8], [5, 1300, 1.4], [8, 400, 2.8], [10, 220, 4.2], [15, 100, 6.5], [20, 60, 9]],
};
export const DEFAULT_MARK_SPEED = 10000;   // mm/min, all materials

export const THICKNESSES = [0.5, 0.8, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20];

// Cutting speed and pierce time at a thickness: linear between rows, the nearest row outside the table.
export function speedAt(rows, thickness) {
  const r = [...rows].sort((a, b) => a[0] - b[0]);
  if (!r.length) return { cut: 0, pierce: 0, clamped: true };
  if (thickness <= r[0][0]) return { cut: r[0][1], pierce: r[0][2], clamped: thickness < r[0][0] };
  const last = r[r.length - 1];
  if (thickness >= last[0]) return { cut: last[1], pierce: last[2], clamped: thickness > last[0] };
  for (let i = 0; i + 1 < r.length; i++) {
    const [t0, c0, p0] = r[i], [t1, c1, p1] = r[i + 1];
    if (thickness >= t0 && thickness <= t1) {
      const k = (thickness - t0) / (t1 - t0);
      return { cut: c0 + (c1 - c0) * k, pierce: p0 + (p1 - p0) * k, clamped: false };
    }
  }
  return { cut: last[1], pierce: last[2], clamped: true };
}

// kg from mm² × mm × g/cm³.
export const weightKg = (areaMm2, thicknessMm, density) => (areaMm2 * thicknessMm * density) / 1e6;

// One file's numbers for ONE copy (spec §8): its parts plus its open paths.
// result: the engine's JSON. job: { material, thickness }. speeds: { [material]: rows }, markSpeed mm/min.
export function fileNumbers(result, job, speeds = DEFAULT_SPEEDS, markSpeed = DEFAULT_MARK_SPEED) {
  const parts = result.parts || [];
  const ex = result.extras || { openCutLength: 0, openPierces: 0, markLength: 0, markStarts: 0 };
  const area = parts.reduce((a, p) => a + p.area, 0);
  const cutLength = parts.reduce((a, p) => a + p.cutLength, 0) + ex.openCutLength;
  const pierces = parts.reduce((a, p) => a + p.pierces, 0) + ex.openPierces;
  const density = MATERIALS[job.material] ?? MATERIALS.steel;
  const sp = speedAt(speeds[job.material] || DEFAULT_SPEEDS[job.material] || DEFAULT_SPEEDS.steel, job.thickness);
  const cutSeconds = sp.cut > 0 ? (60 * cutLength) / sp.cut : NaN;
  const markSeconds = markSpeed > 0 ? (60 * ex.markLength) / markSpeed : 0;
  const open = ex.openPierces > 0;
  const failed = (result.checks || []).some(c => c.severity === 'error');   // ✖: something may be missing from the sum
  return {
    parts: parts.length,
    area,
    weight: weightKg(area, job.thickness, density),
    cutLength,
    pierces,
    markLength: ex.markLength,
    seconds: cutSeconds + pierces * sp.pierce + markSeconds,
    clamped: sp.clamped,
    incomplete: open || failed,
  };
}

// Order totals: every file's numbers times its quantity. A file that could not be read, or that
// has open paths or an error check, makes the totals "at least" (≥), as on the G-code viewers.
export function orderTotals(rows) {
  const t = { cutLength: 0, pierces: 0, area: 0, weight: 0, seconds: 0, parts: 0, incomplete: false };
  for (const r of rows) {
    if (!r.numbers) { t.incomplete = true; continue; }
    const q = r.qty > 0 ? r.qty : 0;
    const n = r.numbers;
    t.cutLength += n.cutLength * q; t.pierces += n.pierces * q; t.area += n.area * q;
    t.weight += n.weight * q; t.seconds += (Number.isFinite(n.seconds) ? n.seconds : 0) * q; t.parts += n.parts * q;
    if (n.incomplete || !Number.isFinite(n.seconds)) t.incomplete = true;
  }
  return t;
}

// Status for the table (spec §9): error beats warning beats a repair.
export function statusOf(result) {
  if (!result || result.type !== 'result') return 'error';
  const sev = (result.checks || []).map(c => c.severity);
  if (sev.includes('error')) return 'error';
  const repaired = (result.checks || []).some(c => ['gaps-closed', 'duplicates-removed', 'tiny-removed'].includes(c.id));
  return sev.includes('warn') || repaired ? 'warn' : 'ok';
}

export function formatDuration(sec) {
  if (!Number.isFinite(sec)) return '–';
  const t = Math.round(sec), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const pad = n => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
