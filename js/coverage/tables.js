// Coverage pre-check: the summary, the analytical schedule, the coordinate tables and the mapping as data
// (spec §6, §7). One source for the screen, the clipboard and the .xlsx: each cell has its number (v) and its
// text, and the text is built with the number formatter it is given (the page's locale on screen, a plain
// decimal separator for the clipboard).
import { ARTICLES, RULES_AS_OF, DEFAULT_STOREY } from './rules.js?v=20260930';
import { LEVELS, TEMPLATE } from './mapping.js?v=20260930';

export const M2 = 'm²', M3 = 'm³', M = 'm';

// A number to the clipboard: fixed decimals, the language's separator, no grouping (a grouped "1.380,00"
// reads as 1.38 in some spreadsheets, and "2.000" as two thousand in others).
export const plain = dec => (v, d) => (v == null || !Number.isFinite(v) ? '' : v.toFixed(d).replace('.', dec));

const cell = (v, unit, text) => ({ v, unit, text });
const empty = () => cell(null, '', '—');

export function levelName(t, lv) { return t(`cp.level.${lv}`); }

// The summary: the Υ.ΔΟΜ block, then the sworn-statement block (spec §5.3 "The two blocks").
export function summaryRows(ev, t, n) {
  const rows = [];
  const R = (block, key, label, art, permitted, proposed, mark, extra = {}) => rows.push({ block, key, label, art, permitted, proposed, mark, ids: [], note: '', ...extra });
  const m2 = v => `${n(v, 2)} ${M2}`;
  const E = ev.plot.area;
  const levelIds = ev.levels.flatMap(l => l.ids);

  // Checked by the building office.
  R('ydom', 'plot', t('cp.fig.plot'), 'plot', empty(), cell(E, M2, m2(E)), null, { ids: [ev.plot.id] });
  const c = ev.coverage;
  R('ydom', 'coverage', t('cp.fig.coverage'), 'coverage',
    c.permitted != null ? cell(c.permitted, M2, `${m2(c.permitted)} (${n(ev.terms.sk, Number.isInteger(ev.terms.sk) ? 0 : 2)}%)`) : cell(null, '', t('cp.need.sk')),
    cell(c.area, M2, `${m2(c.area)} (${n(100 * c.ratio, 2)}%)` + (c.state === 'failed' ? ` ⚠ ${t('cp.warn.union-failed')}` : '')),
    c.mark, { ids: c.ids, note: c.state === 'failed' ? t('cp.warn.union-failed') : '' });
  R('ydom', 'uncovered', t('cp.fig.uncovered'), 'uncovered', empty(), cell(ev.uncovered, M2, m2(ev.uncovered)), null, { ids: [ev.plot.id] });
  const vol = ev.volume;
  R('ydom', 'volume', t('cp.fig.volume'), 'volume',
    vol.permitted != null ? cell(vol.permitted, M3, `${n(vol.permitted, 2)} ${M3} (${t('cp.sub.so', { v: n(vol.so, 2) })})`) : cell(null, '', t('cp.need.sd')),
    cell(vol.V, M3, `${n(vol.V, 2)} ${M3} (${t('cp.sub.so', { v: n(vol.achievedSo, 2) })})`), vol.mark,
    { ids: levelIds, note: t('cp.assume.storey') });
  const h = ev.height;
  const hText = (a, b) => (a == null || b == null ? t('cp.need.height') : `${n(a, 2)} + ${n(b, 2)} ${M}`);
  R('ydom', 'height', t('cp.fig.height'), 'height', cell(h.hmax, M, hText(h.hmax, h.roofAllow)), cell(h.h, M, hText(h.h, h.roof)), h.mark,
    { note: h.hint != null ? t('cp.term.hmax.hint', { h: n(h.hint, 2) }) : '' });
  const p = ev.planting;
  R('ydom', 'planting', t('cp.fig.planting'), 'planting',
    p.required != null ? cell(p.required, M2, `${m2(p.required)} (⅔ × ${n(p.mandatory, 2)})`) : cell(null, '', t('cp.need.sk')),
    cell(p.actual, M2, m2(p.actual)), p.mark, { ids: p.ids, note: ev.terms.parking ? t('cp.note.parking') : '' });
  R('ydom', 'setbacks', t('cp.fig.setbacks'), null, cell(null, '', t('cp.notv1')), cell(null, '', t('cp.notv1')), null);
  R('ydom', 'parking', t('cp.fig.parking'), null, cell(null, '', t('cp.notv1')), cell(null, '', t('cp.notv1')), null);

  // On the engineer's sworn statement.
  for (const l of ev.levels) {
    R('sworn', `level-${l.level}`, t('cp.fig.level', { level: levelName(t, l.level) }), l.level.startsWith('B') ? 'basement' : l.level === 'ATTIC' ? 'attic' : 'level',
      empty(), cell(l.domisi, M2, m2(l.domisi)), null, { ids: l.ids });
  }
  if (ev.pilotis.valid != null) {
    R('sworn', 'pilotis', t('cp.fig.pilotis'), 'pilotis', cell(0.5 * c.area, M2, `≥ ${m2(0.5 * c.area)}`), cell(ev.pilotis.total, M2, m2(ev.pilotis.total)), ev.pilotis.valid,
      { note: ev.pilotis.valid ? '' : t('cp.note.pilotis-small') });
  }
  const k = ev.caps;
  if (k.checked) {
    R('sworn', 'semi', t('cp.fig.semi', { cap: n(k.semiCap, 2) }), 'caps', cell(k.semiCap, M2, m2(k.semiCap)), cell(k.semi, M2, m2(k.semi)), k.semiMark,
      { ids: k.semiIds, note: k.overflow > 0 && !k.semiMark ? t('cp.sub.overflow', { v: n(k.overflow, 2) }) : '' });
    R('sworn', 'semiBalc', t('cp.fig.semiBalc', { cap: n(k.totalCap, 2) }), 'caps', cell(k.totalCap, M2, m2(k.totalCap)), cell(k.semi + k.balc, M2, m2(k.semi + k.balc)), k.totalMark,
      { ids: [...k.semiIds, ...k.balcIds], note: k.overflow > 0 && !k.totalMark ? t('cp.sub.overflow', { v: n(k.overflow, 2) }) : '' });
  } else {
    R('sworn', 'semi', t('cp.fig.semiNoSd'), 'caps', cell(null, '', t('cp.need.sd')), cell(k.semi, M2, m2(k.semi)), null, { ids: k.semiIds, note: t('cp.note.capsUnchecked') });
    R('sworn', 'semiBalc', t('cp.fig.semiBalcNoSd'), 'caps', cell(null, '', t('cp.need.sd')), cell(k.semi + k.balc, M2, m2(k.semi + k.balc)), null, { ids: [...k.semiIds, ...k.balcIds], note: t('cp.note.capsUnchecked') });
  }
  const d = ev.domisi;
  R('sworn', 'total', t('cp.fig.total'), 'total',
    d.permitted != null ? cell(d.permitted, M2, `${m2(d.permitted)} (${t('cp.sub.sd', { v: n(ev.terms.sd, 2) })})`) : cell(null, '', t('cp.need.sd')),
    cell(d.total, M2, `${m2(d.total)} (${t('cp.sub.sd', { v: n(d.sd, 2) })})`), d.mark, { ids: levelIds });
  return rows;
}

export const markText = (mark, t) => (mark === true ? '✓' : mark === false ? '✗' : '');
export const articleText = (key, t) => (key ? t('cp.art.chip', { code: ARTICLES[key].code, old: ARTICLES[key].old }) : '');

// The analytical schedule, per level (spec §6): the level outlines, every space with its cap line where a
// cap applies, the level's δόμηση; then the totals and the caps block.
export function scheduleRows(ev, t, n) {
  const rows = [];
  const m2 = v => (v == null ? '' : n(v, 2));
  const R = (kind, label, area, excluded, counts, extra = {}) => rows.push({ kind, label, area, excluded, counts, areaText: m2(area), excludedText: m2(excluded), countsText: m2(counts), ids: [], note: '', ...extra });
  for (const l of ev.levels) {
    R('head', levelName(t, l.level), null, null, null, { ids: l.ids });
    R('gross', t('cp.sch.gross'), l.gross, null, null, { ids: l.ids });
    // Each space: what comes off the level (excluded), or what it adds (a mezzanine); the level's δόμηση is
    // gross − Σ excluded + Σ added.
    for (const x of l.lines) {
      const note = x.note ? t(`cp.note.${x.note}`, { below: x.params && x.params.below ? levelName(t, x.params.below) : '—', half: x.params ? n((x.params.belowGross || 0) / 2, 2) : '' }) : '';
      R('space', t(`cp.role.${x.role}`), x.area, x.added || x.role === 'balcony' ? null : x.excluded, x.added ? x.added : null, { ids: x.id ? [x.id] : [], note, role: x.role });
      if (x.cap != null) R('cap', t('cp.sch.cap', { cap: n(x.cap, 0) }), null, null, null, { ids: x.id ? [x.id] : [], note: x.counts > 0 ? t('cp.sch.capExcess', { v: n(x.counts, 2) }) : t('cp.sch.capWithin') });
    }
    R('domisi', t('cp.sch.levelDomisi', { level: levelName(t, l.level) }), null, null, l.domisi, { ids: l.ids });
  }
  const k = ev.caps;
  R('head', t('cp.sch.totals'), null, null, null);
  R('sum', t('cp.sch.sumLevels'), null, null, ev.levels.reduce((a, l) => a + l.domisi, 0));
  if (k.checked) {
    R('capblock', t('cp.fig.semi', { cap: n(k.semiCap, 2) }), k.semi, null, null, { ids: k.semiIds });
    R('capblock', t('cp.fig.semiBalc', { cap: n(k.totalCap, 2) }), k.semi + k.balc, null, null, { ids: [...k.semiIds, ...k.balcIds] });
    R('overflow', t('cp.sch.overflow'), null, null, k.overflow, { ids: [...k.semiIds, ...k.balcIds] });
  } else {
    R('overflow', t('cp.sch.overflow'), null, null, null, { note: t('cp.note.capsUnchecked') });
  }
  R('total', t('cp.fig.total'), null, null, ev.domisi.total, { ids: ev.levels.flatMap(l => l.ids) });
  return rows;
}

// Coordinate rows for the plot and the building (the coverage union's outline). n formats a coordinate: the page
// passes one without thousands grouping, as coordinate tables are written ("410000,00").
export function coordTables(ev, t, n) {
  const row = r => ({ n: r.n, x: r.x, y: r.y, xText: n(r.x, 2), yText: n(r.y, 2), note: r.arc ? t('cp.coords.arc') : '' });
  const building = [];
  for (const part of ev.coords.building) {
    if (ev.coords.building.length > 1) building.push({ head: true, label: t('cp.coords.part', { n: part.part + 1 }) });
    building.push(...part.rows.map(row));
  }
  return { plot: ev.coords.plot.map(row), building };
}

// The layer → role mapping used, for the export.
export function mappingRows(layers, map, t) {
  return layers.map(l => {
    const r = map[l.name] || { role: 'ignore' };
    return { layer: l.name, role: t(`cp.role.${r.role}`), level: r.role === 'level' ? levelName(t, r.level) : '', outlines: l.outlines, area: l.area };
  });
}

// ---- the clipboard ----
const tsvLine = cells => cells.map(c => String(c ?? '').replace(/[\t\r\n]+/g, ' ')).join('\t');

export function summaryTsv(rows, t) {
  const out = [tsvLine([t('cp.col.figure'), t('cp.col.article'), t('cp.col.permitted'), t('cp.col.proposed'), t('cp.col.mark'), t('cp.col.note')])];
  for (const r of rows) out.push(tsvLine([r.label, articleText(r.art, t), r.permitted.text, r.proposed.text, markText(r.mark, t), r.note]));
  return out.join('\r\n') + '\r\n';
}

export function scheduleTsv(rows, t) {
  const out = [tsvLine([t('cp.sch.col.item'), t('cp.sch.col.area'), t('cp.sch.col.excluded'), t('cp.sch.col.counts'), t('cp.col.note')])];
  for (const r of rows) out.push(tsvLine([r.label, r.areaText, r.excludedText, r.countsText, r.note]));
  return out.join('\r\n') + '\r\n';
}

export function coordsTsv(rows, t) {
  const out = [tsvLine([t('cp.coords.col.n'), t('cp.coords.col.x'), t('cp.coords.col.y'), t('cp.col.note')])];
  for (const r of rows) out.push(r.head ? tsvLine([r.label]) : tsvLine([r.n, r.xText, r.yText, r.note]));
  return out.join('\r\n') + '\r\n';
}

// ---- the workbook (spec §7): Summary, Schedule, Coordinates, Mapping ----
export function workbookFor({ ev, layers, map, file, t, n, nc = n }) {
  const num2 = v => ({ v: v == null ? null : Math.round(v * 1e6) / 1e6, fmt: 'm2' });
  const sum = summaryRows(ev, t, n);
  const summaryRowsX = [];
  for (const block of ['ydom', 'sworn']) {
    summaryRowsX.push({ cells: [t(`cp.block.${block}`)], bold: true });
    for (const r of sum.filter(x => x.block === block)) {
      summaryRowsX.push([r.label, articleText(r.art, t), num2(r.permitted.v), r.permitted.v != null ? r.permitted.unit : '', r.permitted.text, num2(r.proposed.v), r.proposed.v != null ? r.proposed.unit : '', r.proposed.text, markText(r.mark, t), r.note]);
    }
    summaryRowsX.push([]);
  }
  const terms = ev.terms;
  const T = (label, v, unit = '') => [label, '', v == null ? '' : { v, fmt: 'm2' }, unit];
  summaryRowsX.push({ cells: [t('cp.xlsx.inputs')], bold: true });
  summaryRowsX.push(T(t('cp.term.sd'), terms.sd), T(t('cp.term.sk'), terms.sk, '%'), T(t('cp.term.hmax'), terms.hmax, M), T(t('cp.term.roofAllow'), terms.roofAllow, M),
    T(t('cp.term.h'), terms.h, M), T(t('cp.term.roof'), terms.roof, M));
  for (const l of ev.levels) if (!l.level.startsWith('B')) summaryRowsX.push(T(t('cp.term.storey', { level: levelName(t, l.level) }), terms.storey[l.level] ?? DEFAULT_STOREY, M));
  summaryRowsX.push(T(t('cp.term.basementAbove'), terms.basementAbove, M), T(t('cp.term.roofVolume'), terms.roofVolume, M3),
    [t('cp.term.entrance'), '', levelName(t, terms.entrance)], [t('cp.term.parking'), '', terms.parking ? t('cp.yes') : t('cp.no')], []);
  summaryRowsX.push([t('cp.rules.asof')], [t('cp.assume.storey')], [t('cp.xlsx.units', { units: file.units })], [t('cp.disclaimer')]);

  const sched = scheduleRows(ev, t, n).map(r => (r.kind === 'head' || r.kind === 'total' || r.kind === 'domisi'
    ? { cells: [r.label, num2(r.area), num2(r.excluded), num2(r.counts), r.note], bold: true }
    : [r.label, num2(r.area), num2(r.excluded), num2(r.counts), r.note]));
  sched.push([], [t('cp.sch.mezzNote')], [t('cp.disclaimer')]);

  const co = coordTables(ev, t, nc);
  const coordRows = [{ cells: [t('cp.coords.plot')], bold: true }];
  const xy = r => (r.head ? { cells: [r.label], bold: true } : [r.n, { v: r.x, fmt: 'm2' }, { v: r.y, fmt: 'm2' }, r.note]);
  coordRows.push(...co.plot.map(xy));
  if (!ev.coords.plotHasVerts) coordRows.push([t('cp.coords.noVerts')]);
  coordRows.push([], { cells: [t('cp.coords.building')], bold: true }, ...co.building.map(xy));
  if (ev.coverage.state === 'failed' || ev.coverage.state === 'pending') coordRows.push([t('cp.coords.approx')]);
  if (!ev.coords.egsa) coordRows.push([t('cp.warn.not-egsa')]);
  coordRows.push([], [t('cp.disclaimer')]);

  const mapRows = mappingRows(layers, map, t).map(r => [r.layer, r.role, r.level, { v: r.outlines, fmt: 'int' }, num2(r.area)]);
  mapRows.push([], [t('cp.xlsx.units', { units: file.units })], [t('cp.assume.storey')]);
  if (ev.warnings.length) {
    mapRows.push([], { cells: [t('cp.xlsx.warnings')], bold: true });
    for (const w of ev.warnings) mapRows.push([t(`cp.warn.${w.id}`, formatParams(w.params, n))]);
  }
  mapRows.push([], [t('cp.disclaimer')]);

  return [
    {
      name: t('cp.sheet.summary'), note: t('cp.disclaimer'),
      columns: [
        { header: t('cp.col.figure'), width: 40, fmt: 'text' }, { header: t('cp.col.article'), width: 22, fmt: 'text' },
        { header: t('cp.col.permitted'), width: 14, fmt: 'm2' }, { header: t('cp.col.unit'), width: 6, fmt: 'text' }, { header: t('cp.col.permittedText'), width: 28, fmt: 'text' },
        { header: t('cp.col.proposed'), width: 14, fmt: 'm2' }, { header: t('cp.col.unit'), width: 6, fmt: 'text' }, { header: t('cp.col.proposedText'), width: 28, fmt: 'text' },
        { header: t('cp.col.mark'), width: 6, fmt: 'text' }, { header: t('cp.col.note'), width: 40, fmt: 'text' },
      ],
      rows: summaryRowsX,
    },
    {
      name: t('cp.sheet.schedule'),
      columns: [{ header: t('cp.sch.col.item'), width: 40, fmt: 'text' }, { header: t('cp.sch.col.area'), width: 14, fmt: 'm2' }, { header: t('cp.sch.col.excluded'), width: 14, fmt: 'm2' }, { header: t('cp.sch.col.counts'), width: 16, fmt: 'm2' }, { header: t('cp.col.note'), width: 44, fmt: 'text' }],
      rows: sched,
    },
    {
      name: t('cp.sheet.coords'),
      columns: [{ header: t('cp.coords.col.n'), width: 8, fmt: 'int' }, { header: t('cp.coords.col.x'), width: 16, fmt: 'm2' }, { header: t('cp.coords.col.y'), width: 16, fmt: 'm2' }, { header: t('cp.col.note'), width: 24, fmt: 'text' }],
      rows: coordRows,
    },
    {
      name: t('cp.sheet.mapping'),
      columns: [{ header: t('cp.col.layer'), width: 28, fmt: 'text' }, { header: t('cp.col.role'), width: 34, fmt: 'text' }, { header: t('cp.col.level'), width: 16, fmt: 'text' }, { header: t('cp.col.outlines'), width: 10, fmt: 'int' }, { header: t('cp.col.area'), width: 14, fmt: 'm2' }],
      rows: mapRows,
    },
  ];
}

// Warning parameters as text: numbers with two decimals.
export function formatParams(params, n) {
  return Object.fromEntries(Object.entries(params || {}).map(([k, v]) => [k, typeof v === 'number' ? n(v, 2) : String(v ?? '')]));
}

export function xlsxName(fileName) {
  const d = String(fileName).lastIndexOf('.');
  const stem = (d > 0 ? String(fileName).slice(0, d) : String(fileName)).replace(/[^\p{L}\p{N}._ -]+/gu, '_').trim() || 'drawing';
  return `coverage-${stem}.xlsx`;
}

export { RULES_AS_OF, LEVELS, TEMPLATE };
