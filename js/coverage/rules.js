// Coverage pre-check: the figures of the coverage diagram (spec §5), as pure functions on the mapped outlines
// and the typed terms. No DOM, no engine: a remap or a term change re-runs this in a few milliseconds.
// v1 covers in-plan plots and housing. Every figure carries its article: a later change of the law is an edit
// to ARTICLES (and to the numbers below it names).
import { isClosed, isOpen, isBasement, LEVELS, SPACE_ROLES } from './mapping.js?v=20260930';
import { ringOf, centroid, inside, assign } from './levels.js?v=20260930';

// The law the rules follow (spec §2): Ν.5306/2026 (ΦΕΚ Α' 88/08.06.2026) and circular ΥΠΕΝ/ΔΑΟΚΑ/15494/397/2026.
export const RULES_AS_OF = '2026-06-08';

// Code article, the old article in brackets (ΝΟΚ, Ν.4067/2012, or Ν.4495/2017 for the diagram's content) and
// the date the rule applies from.
const FROM = '2026-06-08';
export const ARTICLES = {
  plot: { code: '325 §3α', old: 'Ν.4495/2017 39 §3', from: FROM },
  coverage: { code: '207', old: 'ΝΟΚ 12', from: FROM },
  uncovered: { code: '207, 212', old: 'ΝΟΚ 12, 17', from: FROM },
  level: { code: '206 §5, §6', old: 'ΝΟΚ 11', from: FROM },
  basement: { code: '206 §6ι', old: 'ΝΟΚ 11 §6', from: FROM },
  stairs: { code: '206 §6δ, §6ε', old: 'ΝΟΚ 11 §6', from: FROM },
  attic: { code: '206 §6ιδ', old: 'ΝΟΚ 11 §6', from: FROM },
  pilotis: { code: '206 §6ιστ', old: 'ΝΟΚ 11 §6', from: FROM },
  caps: { code: '206 §5δ, §6α', old: 'ΝΟΚ 11', from: FROM },
  total: { code: '206', old: 'ΝΟΚ 11', from: FROM },
  volume: { code: '208', old: 'ΝΟΚ 13', from: FROM },
  height: { code: '210, 197 §89–90', old: 'ΝΟΚ 15, 2', from: FROM },
  planting: { code: '212 §2α', old: 'ΝΟΚ 17 §2α', from: FROM },
  coords: { code: '325 §3α', old: 'Ν.4495/2017 39 §3', from: FROM },
};

// The numbers the articles set.
export const LIMITS = {
  skWarn: 60,                         // 207 §1α: above this, the special cases are for the engineer to judge
  stairCommon: 30, stairCommonEntrance: 40, stairUnit: 25,   // 206 §6δ, §6ε (m² per outline per level)
  atticShare: 0.5,                    // 206 §6ιδ
  pilotisShare: 0.5,                  // 206 §6ιστ: of the coverage
  semiShare: 0.2, semiBalcShare: 0.4, // 206 §6α: of the permitted δόμηση
  basementMainShare: 0.5,             // 206 §6ι: housing, main use
  so: 5, soLow: 5.5, soLowHmax: 8.5,  // 208 §1
  plantingShare: 2 / 3, parkingPoints: 10,   // 212 §2α
  unitsLow: 20, unitsHigh: 1e6,       // plot areas that suggest the wrong units (spec §8)
};

// The ΕΓΣΑ87 range for Greece (spec §5.3), metres.
export const EGSA = { x0: 100000, x1: 1000000, y0: 3850000, y1: 4650000 };

export const DEFAULT_STOREY = 3.0;

// The terms a visitor types (spec §5.1). null: not typed.
export const DEFAULT_TERMS = {
  sd: null, sk: null, hmax: null, roofAllow: 2.0, h: null, roof: null,
  storey: {}, basementAbove: 0, roofVolume: 0, entrance: '00', parking: false,
};

// The example drawing's terms (spec §12).
export const EXAMPLE_TERMS = {
  sd: 0.8, sk: 60, hmax: 11, roofAllow: 2, h: 9.6, roof: 1.5,
  storey: { B1: 3, '00': 3.2, '01': 3, '02': 3 }, basementAbove: 0, roofVolume: 0, entrance: '00', parking: false,
};

// 210 §1: the default height for a ΣΔ, the hint beside Hmax.
export function defaultHmax(sd) {
  if (sd == null || !(sd > 0)) return null;
  const table = [[0.4, 10.75], [0.8, 14], [1.2, 17.25], [1.6, 19.5], [2.0, 22.75], [2.6, 26]];
  for (const [upTo, h] of table) if (sd <= upTo + 1e-12) return h;
  return Math.min(10 * sd, 32);
}

// Values are compared as shown, to the cent: a proposal of 300.004 m² against 300.00 permitted is within.
const r2 = v => Math.round(v * 100) / 100;
const within = (proposed, permitted) => (permitted == null || proposed == null ? null : r2(proposed) <= r2(permitted) + 1e-9);
const atLeast = (actual, required) => (required == null || actual == null ? null : r2(actual) >= r2(required) - 1e-9);
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const sum = (list, f = x => x.area) => list.reduce((a, x) => a + f(x), 0);

// The engine's result and the layer mapping, as the outlines the rules work on.
export function buildModel(result, map) {
  const m = { plot: [], cover: [], levels: [], spaces: [], green: [], excluded: [], mapped: 0 };
  (result.items || []).forEach((it, index) => {
    const r = map[it.layer];
    if (!r || r.role === 'ignore') return;
    if (!isClosed(it)) { if (isOpen(it)) m.excluded.push({ id: it.id, index, layer: it.layer, role: r.role, why: 'open' }); return; }
    if (it.bad) { m.excluded.push({ id: it.id, index, layer: it.layer, role: r.role, why: 'bad' }); return; }
    const ring = ringOf(it);
    const o = { id: it.id, index, layer: it.layer, role: r.role, area: it.area, ring, verts: it.verts || null, c: centroid(ring) };
    m.mapped++;
    if (r.role === 'plot') m.plot.push(o);
    else if (r.role === 'cover') m.cover.push(o);
    else if (r.role === 'green') m.green.push(o);
    else if (r.role === 'level') m.levels.push({ ...o, level: r.level });
    else if (SPACE_ROLES.includes(r.role)) m.spaces.push(o);
  });
  m.spaces = assign(m.levels, m.spaces);
  return m;
}

// The coverage outlines the union is asked for (spec §3: only a changed coverage mapping calls the engine).
export const coverIds = model => model.cover.map(o => o.id).sort();

const levelOrder = lv => LEVELS.indexOf(lv);

// Outlines drawn twice, and level outlines inside another of the same level (spec §5.3): warnings only, the
// figures count them as drawn. Duplicates are the same role (and level) with areas within 0.01 m² and centroids
// within 0.01 m; a space in no level is not compared, as it counts nowhere.
const SAME_AREA = 0.01, SAME_PLACE = 0.01;
function drawnTwice(model, W) {
  const groups = new Map();
  const spaces = model.spaces.filter(s => s.level != null);
  for (const o of [...model.plot, ...model.cover, ...model.levels, ...spaces, ...model.green]) {
    const key = o.level != null ? `${o.role}:${o.level}` : o.role;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  }
  const dup = (a, b) => Math.abs(a.area - b.area) <= SAME_AREA && Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1]) <= SAME_PLACE;
  for (const list of groups.values()) {
    list.forEach((o, j) => {
      const first = list.slice(0, j).find(p => dup(p, o));
      if (first) W('duplicate-outline', { layer: o.layer }, [first.id, o.id]);
    });
  }
  for (const o of model.levels) {
    const outer = model.levels.find(p => p !== o && p.level === o.level && !dup(p, o) && inside(o.c, p.ring));
    if (outer) W('nested-level', { layer: o.layer }, [o.id, outer.id]);
  }
}

// All the figures. union: the engine's answer for coverIds(model), or null while it is pending.
export function evaluate(model, termsIn, union) {
  const terms = { ...DEFAULT_TERMS, ...termsIn, storey: { ...(termsIn && termsIn.storey) } };
  const warnings = [];
  const W = (id, params = {}, ids = []) => warnings.push({ id, params, ids });
  for (const x of model.excluded) W(x.why === 'open' ? 'open' : 'bad', { layer: x.layer }, [x.id]);
  drawnTwice(model, W);

  if (model.plot.length !== 1) {
    return { blocked: model.plot.length ? 'plot-many' : 'plot-missing', warnings, plotIds: model.plot.map(p => p.id) };
  }
  const plot = model.plot[0];
  const E = plot.area;
  const sd = num(terms.sd), sk = num(terms.sk), hmax = num(terms.hmax);
  if (E < LIMITS.unitsLow || E > LIMITS.unitsHigh) W('units-check', { area: E });
  if (sk != null && sk > LIMITS.skWarn) W('sk-high', { sk });

  // ---- coverage (207): the union of the coverage outlines ----
  const coverSum = sum(model.cover);
  let cov = coverSum, unionState = 'none';
  if (!model.cover.length) W('no-cover');
  else if (!union) unionState = 'pending';
  else if (union.error || (union.bad && union.bad.length)) {
    // An error, or outlines the engine could not use: the union is incomplete, so the sum stands in for it.
    unionState = 'failed';
    W('union-failed', {}, union.bad && union.bad.length ? [...union.bad] : model.cover.map(o => o.id));
  }
  else { cov = union.area; unionState = 'ok'; }
  const coverage = {
    area: cov, sum: coverSum, state: unionState, ratio: E > 0 ? cov / E : 0,
    permitted: sk != null ? (sk / 100) * E : null, ids: model.cover.map(o => o.id),
  };
  coverage.mark = within(cov, coverage.permitted);

  // ---- levels and their spaces (206) ----
  const unassigned = { far: 'balcony-far', ambiguous: 'level-ambiguous' };
  for (const s of model.spaces) if (s.level == null) W(unassigned[s.why] || 'no-level', { layer: s.layer }, [s.id]);
  const keys = [...new Set(model.levels.map(l => l.level))].sort((a, b) => levelOrder(a) - levelOrder(b));
  if (!keys.length) W('no-levels');
  const grossOf = lv => sum(model.levels.filter(l => l.level === lv));
  const pilotisTotal = sum(model.spaces.filter(s => s.level != null && s.role === 'pilotis'));
  const pilotisValid = pilotisTotal > 0 ? r2(pilotisTotal) >= r2(LIMITS.pilotisShare * cov) - 1e-9 : null;
  if (pilotisValid === false) W('pilotis-small', { share: cov > 0 ? (100 * pilotisTotal) / cov : 0 });

  const levels = keys.map(lv => {
    const outlines = model.levels.filter(l => l.level === lv);
    const gross = sum(outlines);
    const spaces = model.spaces.filter(s => s.level === lv);
    const lines = [];
    let domisi;
    if (isBasement(lv)) {
      // 206 §6ι (housing, one auxiliary basement): only 50 % of the main-use spaces counts; the rest is excluded.
      const main = sum(spaces.filter(s => s.role === 'bsmtMain'));
      for (const s of spaces) lines.push({ id: s.id, role: s.role, area: s.area, excluded: s.role === 'bsmtMain' ? s.area * (1 - LIMITS.basementMainShare) : 0, note: s.role === 'bsmtMain' ? 'bsmt-half' : 'in-basement' });
      domisi = LIMITS.basementMainShare * main;
      lines.push({ role: 'basementRest', area: gross - main, excluded: gross - main, note: 'bsmt-rest' });
    } else if (lv === 'ATTIC') {
      // 206 §6ιδ: the stair up to the attic is not counted, and of the rest only what exceeds half of the level
      // below counts (Aris ruled 2026-09-29, as the 2022 template: check area = attic gross − its stairs).
      const below = keys.filter(k => !isBasement(k) && k !== 'ATTIC').pop();
      const belowGross = below ? grossOf(below) : 0;
      if (!below) W('attic-alone');
      let stairs = 0;
      for (const s of spaces) {
        const stair = s.role === 'stairCommon' || s.role === 'stairUnit';
        if (stair) stairs += s.area;
        lines.push({ id: s.id, role: s.role, area: s.area, excluded: stair ? s.area : 0, note: stair ? 'attic-stair' : 'in-attic' });
      }
      const check = gross - stairs;
      domisi = Math.max(check - LIMITS.atticShare * belowGross, 0);
      lines.push({ role: 'atticRest', area: check, excluded: check - domisi, note: 'attic-half', params: { below, belowGross } });
    } else {
      let d = gross;
      for (const s of spaces) {
        const line = { id: s.id, role: s.role, area: s.area, excluded: 0 };
        switch (s.role) {
          case 'semiopen': case 'void': case 'exclOther':
            line.excluded = s.area; break;
          case 'stairCommon': {
            const cap = lv === terms.entrance ? LIMITS.stairCommonEntrance : LIMITS.stairCommon;
            line.cap = cap; line.excluded = Math.min(s.area, cap); line.counts = s.area - line.excluded; break;
          }
          case 'stairUnit':
            line.cap = LIMITS.stairUnit; line.excluded = Math.min(s.area, LIMITS.stairUnit); line.counts = s.area - line.excluded; break;
          case 'pilotis':
            line.excluded = pilotisValid ? s.area : 0; line.note = pilotisValid ? 'pilotis-ok' : 'pilotis-small'; break;
          case 'mezz':
            line.added = s.area; line.note = 'mezz'; break;
          case 'balcony':
            line.note = 'balcony'; break;
          case 'bsmtMain':
            line.note = 'bsmt-not-basement'; W('bsmt-not-basement', { layer: s.layer }, [s.id]); break;
        }
        d += (line.added || 0) - line.excluded;
        lines.push(line);
      }
      domisi = d;
    }
    return { level: lv, gross, ids: outlines.map(o => o.id), lines, domisi };
  });

  // ---- semi-open and balcony caps (206 §5δ, §6α) ----
  const semi = sum(model.spaces.filter(s => s.level != null && s.role === 'semiopen'));
  const balc = sum(model.spaces.filter(s => s.level != null && s.role === 'balcony'));
  const P = sd != null ? sd * E : null;
  const caps = { semi, balc, P, semiCap: null, totalCap: null, overflow: 0, checked: P != null };
  if (P != null) {
    caps.semiCap = LIMITS.semiShare * P;
    caps.totalCap = LIMITS.semiBalcShare * P;
    // The overflow that counts in δόμηση is counted once: the larger of the two excesses.
    caps.overflow = Math.max(semi - caps.semiCap, semi + balc - caps.totalCap, 0);
    caps.semiMark = within(semi, caps.semiCap);
    caps.totalMark = within(semi + balc, caps.totalCap);
  }
  caps.semiIds = model.spaces.filter(s => s.level != null && s.role === 'semiopen').map(s => s.id);
  caps.balcIds = model.spaces.filter(s => s.level != null && s.role === 'balcony').map(s => s.id);

  // ---- δόμηση total (206) ----
  const total = sum(levels, l => l.domisi) + caps.overflow;
  const domisi = { total, sd: E > 0 ? total / E : 0, permitted: P, mark: within(total, P) };

  // ---- volume (208) ----
  const storeyOf = lv => { const v = num(terms.storey[lv]); return v != null ? v : DEFAULT_STOREY; };
  const volLines = [];
  for (const l of levels) {
    if (isBasement(l.level)) continue;
    // 208 §2β: a pilotis excluded from δόμηση (206 §6ιστ) adds no volume either (Aris ruled 2026-09-29).
    const voids = sum(l.lines.filter(x => x.role === 'void' || (x.role === 'pilotis' && pilotisValid)));
    volLines.push({ level: l.level, area: l.gross - voids, height: storeyOf(l.level), volume: (l.gross - voids) * storeyOf(l.level) });
  }
  const topBasement = levels.filter(l => isBasement(l.level)).pop();
  const bAbove = num(terms.basementAbove) || 0;
  if (topBasement && bAbove > 0) volLines.push({ level: topBasement.level, area: topBasement.gross, height: bAbove, volume: topBasement.gross * bAbove, basement: true });
  const roofV = num(terms.roofVolume) || 0;
  const V = sum(volLines, x => x.volume) + roofV;
  const so = sd != null ? (hmax != null && hmax <= LIMITS.soLowHmax + 1e-9 ? LIMITS.soLow : LIMITS.so) * sd : null;
  const volume = { V, lines: volLines, roof: roofV, so, permitted: so != null ? so * E : null, achievedSo: E > 0 ? V / E : 0 };
  volume.mark = within(V, volume.permitted);

  // ---- height (210, 197 §89–90): a check on typed values ----
  const h = num(terms.h), roof = num(terms.roof), roofAllow = num(terms.roofAllow);
  const height = { hmax, roofAllow, h, roof, hint: defaultHmax(sd) };
  height.mark = hmax != null && h != null && roofAllow != null && roof != null ? within(h, hmax) && within(roof, roofAllow) : null;

  // ---- planting (212 §2α) ----
  const actual = sum(model.green);
  let planting = { actual, mandatory: null, required: null, ids: model.green.map(o => o.id) };
  if (sk != null) {
    const share = sk / 100 + (terms.parking ? LIMITS.parkingPoints / 100 : 0);
    planting.mandatory = E - share * E;
    planting.required = LIMITS.plantingShare * planting.mandatory;
  }
  planting.mark = atLeast(actual, planting.required);

  // ---- coordinates (325 §3α) ----
  const coords = coordinates(plot, model, union, unionState);
  if (!coords.egsa) W('not-egsa');

  return {
    blocked: null, warnings, terms,
    plot: { area: E, id: plot.id }, coverage, uncovered: E - cov,
    levels, caps, domisi, volume, height, planting, pilotis: { total: pilotisTotal, valid: pilotisValid },
    coords,
  };
}

// Vertex rows: { n, x, y, arc } where arc says the edge to the next vertex is an arc.
function vertexRows(verts, start = 1) {
  const rows = [];
  for (let i = 0; i + 2 < verts.length; i += 3) rows.push({ n: start + rows.length, x: verts[i], y: verts[i + 1], arc: verts[i + 2] !== 0 });
  return rows;
}

function coordinates(plot, model, union, unionState) {
  const plotRows = plot.verts ? vertexRows(plot.verts) : [];
  const building = [];
  if (unionState === 'ok') {
    let n = 1;
    union.verts.forEach((v, part) => { const rows = vertexRows(v, n); n += rows.length; building.push({ part, rows }); });
  } else if (unionState === 'failed' || unionState === 'pending') {
    let n = 1;
    model.cover.forEach((o, part) => { if (!o.verts) return; const rows = vertexRows(o.verts, n); n += rows.length; building.push({ part, rows }); });
  }
  const pts = plot.verts ? plotRows.map(r => [r.x, r.y]) : plot.ring;
  const egsa = pts.length > 0 && pts.every(([x, y]) => x >= EGSA.x0 && x <= EGSA.x1 && y >= EGSA.y0 && y <= EGSA.y1);
  return { plot: plotRows, plotHasVerts: !!plot.verts, building, egsa };
}
