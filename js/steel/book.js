// Steel take-off: the Excel file (spec §6.8): four sheets in the visitor's language, pieces, groups, costs and
// settings, for the DWG quantities tool's writer (js/dwg/xlsx.js, reused unchanged). Figures are the sheet's own
// rounding (kg 1 decimal, m² 2, € 2) stored as numbers; t(key, params) is the page's translation. Pure.
import { kg1, m2, cents } from './quote.js?v=20261005';

const num = v => (Number.isFinite(v) ? { v, fmt: 'num' } : '');
const int = v => (Number.isFinite(v) ? { v, fmt: 'int' } : '');
const BATH = { fits: '✓', double: '⚠', no: '✗' };

// The notes of a row, in words: its warnings, and where its weight comes from when not the header.
// fmt(value, digits) formats a number for the visitor's language (the page's fmtNum); the default is plain.
const plain = (v, d) => v.toFixed(d);
export function rowNotes(r, t, fmt = plain) {
  const out = r.warn.filter(w => w !== 'check').map(w => t(`st.warn.${w}`));
  if (r.warn.includes('check')) out.push(t('st.warn.check.xlsx', { kg: fmt(kg1(r.checkKg), 1) }));
  if (r.bath !== 'fits') out.push(t(`st.bath.${r.bath}`));
  return out.join(' · ');
}

// model: { take: quote.takeoff(), cost: quote.costs(), settings, source }. Returns the sheets for writeXlsx.
export function workbook(model, t, fmt = plain) {
  const { take, cost, settings } = model;
  const pieces = [];
  for (const g of take.groups) {
    for (const r of g.rows) {
      const n = r.qty > 0 ? r.qty : 0;
      pieces.push([r.mark, r.drawing, g.profile, r.gradeText || r.grade, int(r.qty), num(Math.round(r.lengthMm)),
        num(r.unitKg === null ? null : kg1(r.unitKg)), num(r.excluded ? null : kg1(r.unitKg * n)),
        num(r.unitM2 === null ? null : m2(r.unitM2)), num(r.excluded || r.unitM2 === null ? null : m2(r.unitM2 * n)),
        r.kgFrom ? t(`st.from.${r.kgFrom}`) : '', BATH[r.bath] || '', rowNotes(r, t, fmt), r.file || '']);
    }
  }
  const groups = take.groups.map(g => [g.profile, g.grade, int(g.count), num(m2(g.lengthM)), num(kg1(g.kg)), num(m2(g.m2))]);
  const costRows = cost.lines.map(l => [t(`st.cost.${l.id}`), num(l.qty), l.unit === 'm2' ? 'm²' : 'kg', num(l.rate), num(l.amount)]);   // an unpriced line: rate and amount stay empty
  if (!cost.lines.length) costRows.push([t('st.cost.none')]);
  const sumRow = (label, v) => ({ cells: [label, '', '', '', num(v)], bold: true });
  costRows.push(sumRow(t('st.cost.subtotal'), cost.subtotal));
  if (cost.minApplies) costRows.push([t('st.cost.minimum', { min: fmt(cents(cost.minimum), 2) }), '', '', '', num(cost.net)]);
  costRows.push([t(cost.vatOn ? 'st.cost.vat' : 'st.cost.novat'), '', '', '', num(cost.vat)]);
  costRows.push(sumRow(t('st.cost.total'), cost.total));
  if (cost.unpricedKg > 0) costRows.push([t('st.cost.unpriced', { kg: fmt(cost.unpricedKg, 1) })]);
  const r = settings.rates, b = settings.bath;
  const rateRow = (key, v, unit) => [t(key), v === null ? '' : num(v), unit];
  const settingRows = [
    [t('st.set.bath.length'), num(b.length), 'm'], [t('st.set.bath.width'), num(b.width), 'm'], [t('st.set.bath.depth'), num(b.depth), 'm'],
    rateRow('st.set.galv', r.galv, '€/kg'), rateRow('st.set.zinc', r.zinc, '€/kg'), rateRow('st.set.paint', r.paint, '€/m²'),
    ...(r.perGrade ? ['S235', 'S275', 'S355', 'other'].map(g => rateRow(`st.set.steel.${g}`, r.steelGrade[g], '€/kg')) : [rateRow('st.set.steel', r.steel, '€/kg')]),
    rateRow('st.set.minimum', r.minimum, '€'), [t('st.set.vat'), t(r.vat ? 'st.yes' : 'st.no'), ''],
    [], [t('st.xlsx.source'), model.source || ''], [t('st.indicative')], [t('st.bath.note')],
  ];
  return [
    { name: t('st.sheet.pieces'), columns: [
      { header: t('st.col.mark'), width: 14 }, { header: t('st.col.drawing'), width: 12 }, { header: t('st.col.profile'), width: 16 },
      { header: t('st.col.grade'), width: 12 }, { header: t('st.col.qty'), width: 8, fmt: 'int' }, { header: t('st.col.lengthmm'), width: 12 },
      { header: t('st.col.kgeach'), width: 12 }, { header: t('st.col.kg'), width: 12 }, { header: t('st.col.m2each'), width: 12 },
      { header: t('st.col.m2'), width: 12 }, { header: t('st.col.from'), width: 16 }, { header: t('st.col.bath'), width: 8 },
      { header: t('st.col.notes'), width: 40 }, { header: t('st.col.file'), width: 18 },
    ], rows: pieces },
    { name: t('st.sheet.groups'), columns: [
      { header: t('st.col.profile'), width: 18 }, { header: t('st.col.grade'), width: 10 }, { header: t('st.col.qty'), width: 8, fmt: 'int' },
      { header: t('st.col.lengthm'), width: 12 }, { header: t('st.col.kg'), width: 12 }, { header: t('st.col.m2'), width: 12 },
    ], rows: groups, totals: [t('st.total'), '', int(take.totals.pieces), num(m2(take.totals.lengthM)), num(kg1(take.totals.kg)), num(m2(take.totals.m2))] },
    { name: t('st.sheet.costs'), columns: [
      { header: t('st.col.line'), width: 34 }, { header: t('st.col.amountqty'), width: 12 }, { header: t('st.col.unit'), width: 8 },
      { header: t('st.col.rate'), width: 10 }, { header: t('st.col.eur'), width: 12 },
    ], rows: costRows },
    { name: t('st.sheet.settings'), columns: [{ header: t('st.col.setting'), width: 34 }, { header: t('st.col.value'), width: 12 }, { header: t('st.col.unit'), width: 8 }], rows: settingRows },
  ];
}

// The download's name: steel-takeoff-<the IFC's, the ZIP's or the single NC1's stem>.xlsx, or one for n NC1 files.
export function xlsxName(source, count) {
  const s = String(source || '').replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}._ -]+/gu, '_').trim();
  return s ? `steel-takeoff-${s}.xlsx` : `steel-takeoff-${count}-files.xlsx`;
}
