// The page's example drawing (spec §12): a synthetic permit on the template layers, in metres, placed in
// ΕΓΣΑ87 near X 410 000, Y 4 495 000. No customer data. make-examples.mjs writes it to
// js/coverage/examples/example-permit.dxf, and the rules tests build their outlines from the same numbers.
import { rect } from './dxf-writer.mjs';

export const X0 = 410000, Y0 = 4495000;

// Local metres; the plot is 20 × 25. The four levels are drawn side by side to the right of the plot, each
// 10 × 15, with their spaces inside them and the balconies against their lower edge (outside).
export const OUTLINES = [
  { layer: 'AC_PLOT', verts: rect(0, 0, 20, 25) },                       // 500.00
  { layer: 'AC_COVER', verts: rect(0, 10, 10, 15) },                     // 150.00
  { layer: 'AC_GREEN', verts: rect(10, 0, 10, 14) },                     // 140.00
  { layer: 'AC_LVL_B1', verts: rect(30, 10, 10, 15) },                   // basement −1, auxiliary
  { layer: 'AC_LVL_00', verts: rect(45, 10, 10, 15) },
  { layer: 'AC_SEMIOPEN', verts: rect(45, 10, 5, 4) },                   // 20.00
  { layer: 'AC_STAIR_COMMON', verts: rect(51, 20, 4, 5) },               // 20.00, the entrance level
  { layer: 'AC_LVL_01', verts: rect(60, 10, 10, 15) },
  { layer: 'AC_SEMIOPEN', verts: rect(60, 10, 5, 6) },                   // 30.00
  { layer: 'AC_STAIR_COMMON', verts: rect(66, 20, 4, 5) },               // 20.00
  { layer: 'AC_BALCONY', verts: rect(60, 7, 5, 3) },                     // 15.00, below the outline
  { layer: 'AC_LVL_02', verts: rect(75, 10, 10, 15) },
  { layer: 'AC_SEMIOPEN', verts: rect(75, 10, 5, 8) },                   // 40.00
  { layer: 'AC_STAIR_COMMON', verts: rect(81, 20, 4, 5) },               // 20.00
  { layer: 'AC_BALCONY', verts: rect(75, 7, 5, 3) },                     // 15.00
];

// One open polyline on the planting layer: the page must list it as an open outline, never measure it.
export const OPEN = [{ layer: 'AC_GREEN', verts: [[1, 1], [8, 1], [8, 8]] }];

// The zone terms and heights the example is shown with (spec §12) live with the page's rules.
export { EXAMPLE_TERMS as TERMS } from '../../js/coverage/rules.js';

export const inSurvey = verts => verts.map(([x, y, b]) => (b ? [x + X0, y + Y0, b] : [x + X0, y + Y0]));
