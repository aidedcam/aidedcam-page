// Writes the coverage pre-check's committed drawings (spec §4, §12), so none of them is typed by hand:
//   js/coverage/examples/example-permit.dxf   the page's example (AutoCAD 2000 DXF, metres, ΕΓΣΑ87)
//   js/coverage/examples/layer-template.dxf   the downloadable layer template (R12, layers + a Greek legend)
//   _tests/coverage/fixtures/union.dxf        the browser check's union fixture
// Run from the repo root: node _tests/coverage/make-examples.mjs   (add --check to compare instead of writing)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';
import { dxf2000, dxfR12, rect } from './dxf-writer.mjs';
import { OUTLINES, OPEN, inSurvey } from './example-geometry.mjs';
import { TEMPLATE } from '../../js/coverage/mapping.js';

const root = new URL('../../', import.meta.url);
const check = process.argv.includes('--check');

// The Greek role names come from the tool's own strings, so the legend says what the page says.
function strings() {
  const window = {};
  vm.runInNewContext(readFileSync(new URL('js/coverage/i18n-coverage.js', root), 'utf8'), { window });
  return window.CP_I18N;
}

function example() {
  const layers = [...new Set(OUTLINES.map(o => o.layer))].map(name => ({ name, color: TEMPLATE.find(t => t.layer === name).aci }));
  const polylines = [
    ...OUTLINES.map(o => ({ layer: o.layer, closed: true, verts: inSurvey(o.verts) })),
    ...OPEN.map(o => ({ layer: o.layer, closed: false, verts: inSurvey(o.verts) })),
  ];
  return dxf2000({ units: 6, layers, polylines });
}

function template() {
  const el = strings().el;
  const layers = TEMPLATE.map(t => ({ name: t.layer, color: t.aci }));
  const texts = [];
  let y = 0;
  texts.push({ layer: '0', x: 0, y: y, height: 0.5, text: 'AidedCAM - Προέλεγχος διαγράμματος κάλυψης: πρότυπο στρώσεων' });
  y -= 1.2;
  for (const t of TEMPLATE) {
    const role = el[`cp.role.${t.role}`] + (t.level ? ' - ' + el[`cp.level.${t.level}`] : '');
    texts.push({ layer: t.layer, x: 0, y, height: 0.35, text: `${t.layer}  ${role}`.replace(/−/g, '-') });   // R12 text has no minus sign
    y -= 0.7;
  }
  return dxfR12({ layers, texts });
}

// Hand-worked unions for the browser: overlap 175, touch 200, a frame 800, an arc 164.2699…, survey 200,
// and 50 squares into 2556.
function unionFixture() {
  const b = 1;                                                             // a half circle
  const polylines = [
    ...[rect(0, 0, 10, 10), rect(5, 5, 10, 10)].map(verts => ({ layer: 'OVERLAP', closed: true, verts })),
    ...[rect(0, 50, 10, 10), rect(10, 50, 10, 10)].map(verts => ({ layer: 'TOUCH', closed: true, verts })),
    ...[rect(0, 100, 30, 10), rect(0, 120, 30, 10), rect(0, 100, 10, 30), rect(20, 100, 10, 30)].map(verts => ({ layer: 'FRAME', closed: true, verts })),
    { layer: 'ARC', closed: true, verts: [[0, 160, b], [0, 150], [10, 150], [10, 160]] },
    { layer: 'ARC', closed: true, verts: rect(5, 150, 10, 5) },
    ...[rect(410000, 4495000, 10, 15), rect(410005, 4495005, 10, 10)].map(verts => ({ layer: 'SURVEY', closed: true, verts })),
    // 50 overlapping 8 × 8 squares on a 7 m grid: one 71 × 36 block, the spec §10 speed case.
    ...Array.from({ length: 50 }, (_, i) => ({ layer: 'MANY', closed: true, verts: rect(200 + (i % 10) * 7, (i / 10 | 0) * 7, 8, 8) })),
  ];
  const layers = ['OVERLAP', 'TOUCH', 'FRAME', 'ARC', 'SURVEY', 'MANY'].map((name, i) => ({ name, color: i + 1 }));
  return dxf2000({ units: 6, layers, polylines });
}

const out = {
  'js/coverage/examples/example-permit.dxf': example(),
  'js/coverage/examples/layer-template.dxf': template(),
  '_tests/coverage/fixtures/union.dxf': unionFixture(),
};

// The template's Greek must survive the trip through Windows-1253.
const legend = new TextDecoder('windows-1253').decode(out['js/coverage/examples/layer-template.dxf']);
if (!legend.includes('Οικόπεδο') && !legend.includes('οικόπεδο')) throw new Error('the Greek legend did not round-trip');

let differ = 0;
for (const [path, bytes] of Object.entries(out)) {
  const url = new URL(path, root);
  if (check) {
    let old = null;
    try { old = readFileSync(url); } catch (e) { /* missing */ }
    const same = old && Buffer.compare(old, Buffer.from(bytes)) === 0;
    if (!same) differ++;
    console.log(`${same ? 'same' : 'DIFFERS'}  ${path}`);
  } else {
    mkdirSync(new URL('.', url), { recursive: true });
    writeFileSync(url, bytes);
    console.log(`wrote ${path} (${bytes.length} bytes)`);
  }
}
process.exit(differ ? 1 : 0);
