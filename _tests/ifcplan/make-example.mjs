// Writes the IFC floor-plans tool's example model, js/ifcplan/examples/example-house.ifc (spec §10): a synthetic IFC4
// house of our own, so no third-party licence applies. Deterministic: the same bytes on every run.
//   node _tests/ifcplan/make-example.mjs           write the file
//   node _tests/ifcplan/make-example.mjs --check   compare with the committed file (exit 1 if it differs)
// Run from the repo root. Lengths in millimetres (as most exports), areas in m².
//
// The house, 10.00 × 8.10 m, its site placed at (120.50, 80.25) m so that "move to origin" has a shift to show:
//   Ισόγειο (level 0.00): 250 mm outer walls, an inner wall at x 6.00–6.10, one door (south) and one window (north)
//     cut into the walls by openings, a 300 × 300 column, a stair flight rising 3.00 m over 4.00 m, the rooms
//     Σαλόνι (with Qto_SpaceBaseQuantities) and Κουζίνα.
//   Όροφος 1 (level 3.00): the floor slab with the stair's void, outer walls, an inner wall at x 5.00–5.10, one
//     window (south), a railing along the void, the room "1.01" / Υπνοδωμάτιο, and the roof slab.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { stepFile, startModel, E, I } from './step.mjs';

const OUT = 'js/ifcplan/examples/example-house.ifc';

const f = stepFile();
const { add, guid } = f;
const { pt, dir, origin, zUp, axis0, project, place, shape, boxSolid } = startModel(f);
const rectLoop = (x0, y0, x1, y1) => add('IFCPOLYLINE', [pt(x0, y0), pt(x1, y0), pt(x1, y1), pt(x0, y1), pt(x0, y0)]);

// ---- the spatial structure ----
const sitePlace = place(null, 120500, 80250, 0);
const site = add('IFCSITE', guid(), null, 'Οικόπεδο', null, null, sitePlace, null, null, E('ELEMENT'), null, null, null, null, null);
const buildingPlace = place(sitePlace, 0, 0, 0);
const building = add('IFCBUILDING', guid(), null, 'Κατοικία', null, null, buildingPlace, null, null, E('ELEMENT'), null, null, null);
add('IFCRELAGGREGATES', guid(), null, null, null, project, [site]);
add('IFCRELAGGREGATES', guid(), null, null, null, site, [building]);

const storeys = [{ name: 'Ισόγειο', level: 0 }, { name: 'Όροφος 1', level: 3000 }].map(s => {
  const p = place(buildingPlace, 0, 0, s.level);
  return { ...s, place: p, ref: add('IFCBUILDINGSTOREY', guid(), null, s.name, null, null, p, null, null, E('ELEMENT'), s.level), elements: [], spaces: [] };
});
add('IFCRELAGGREGATES', guid(), null, null, null, building, storeys.map(s => s.ref));

// ---- the elements: boxes in storey coordinates (mm) ----
function element(storey, type, name, [x0, y0, z0, x1, y1, z1], extra) {
  const p = place(storey.place, x0, y0, z0);
  const e = add(type, guid(), null, name, null, null, p, shape(boxSolid(x1 - x0, y1 - y0, z1 - z0)), ...extra);
  storey.elements.push(e);
  return { ref: e, place: p, x0, y0, z0 };
}
const wall = (s, name, b) => element(s, 'IFCWALL', name, b, [null, E('STANDARD')]);
// An opening through a wall, as a box relative to the wall's placement, filled by a door or a window.
function opening(w, [x0, y0, z0, x1, y1, z1], filler) {
  const o = add('IFCOPENINGELEMENT', guid(), null, 'Άνοιγμα', null, null, place(w.place, x0 - w.x0, y0 - w.y0, z0 - w.z0),
    shape(boxSolid(x1 - x0, y1 - y0, z1 - z0)), null, E('OPENING'));
  add('IFCRELVOIDSELEMENT', guid(), null, null, null, w.ref, o);
  add('IFCRELFILLSELEMENT', guid(), null, null, null, o, filler.ref);
}
function space(storey, name, longName, [x0, y0, z0, x1, y1, z1]) {
  const s = add('IFCSPACE', guid(), null, name, null, null, place(storey.place, x0, y0, z0), shape(boxSolid(x1 - x0, y1 - y0, z1 - z0)),
    longName, E('ELEMENT'), E('INTERNAL'), null);
  storey.spaces.push(s);
  return s;
}

const [g, f1] = storeys;
// Ισόγειο
element(g, 'IFCSLAB', 'Πλάκα ισογείου', [0, 0, -250, 10000, 8100, 0], [null, E('BASESLAB')]);
const gS = wall(g, 'Τοίχος Ν', [0, 0, 0, 10000, 250, 2750]);
const gN = wall(g, 'Τοίχος Β', [0, 7850, 0, 10000, 8100, 2750]);
wall(g, 'Τοίχος Δ', [0, 250, 0, 250, 7850, 2750]);
wall(g, 'Τοίχος Α', [9750, 250, 0, 10000, 7850, 2750]);
wall(g, 'Εσωτερικός τοίχος', [6000, 250, 0, 6100, 7850, 2750]);
opening(gS, [2000, 0, 0, 2900, 250, 2100], element(g, 'IFCDOOR', 'Πόρτα εισόδου', [2000, 100, 0, 2900, 150, 2100], [null, 2100, 900, E('DOOR'), E('SINGLE_SWING_LEFT'), null]));
opening(gN, [3000, 7850, 900, 4500, 8100, 2100], element(g, 'IFCWINDOW', 'Παράθυρο Β', [3000, 7940, 900, 4500, 8010, 2100], [null, 1200, 1500, E('WINDOW'), E('SINGLE_PANEL'), null]));
element(g, 'IFCCOLUMN', 'Υποστύλωμα', [2900, 5800, 0, 3200, 6100, 2750], [null, E('COLUMN')]);
{
  // The stair flight: its side profile (run along y, rise along z), 300 mm thick vertically, extruded 900 mm along x.
  const profile = add('IFCARBITRARYCLOSEDPROFILEDEF', E('AREA'), null,
    add('IFCPOLYLINE', [pt(0, 0), pt(4000, 3000), pt(4000, 2700), pt(400, 0), pt(0, 0)]));
  const position = add('IFCAXIS2PLACEMENT3D', origin, dir([1, 0, 0]), dir([0, 1, 0]));
  const solid = add('IFCEXTRUDEDAREASOLID', profile, position, zUp, 900);
  g.elements.push(add('IFCSTAIRFLIGHT', guid(), null, 'Σκάλα', null, null, place(g.place, 8700, 1500, 0), shape(solid), null, I(16), I(15), 187.5, 266.67, E('STRAIGHT')));
}
const salon = space(g, 'Σαλόνι', null, [250, 250, 0, 6000, 7850, 2750]);
space(g, 'Κουζίνα', null, [6100, 250, 0, 9750, 7850, 2750]);

// Όροφος 1
{
  const profile = add('IFCARBITRARYPROFILEDEFWITHVOIDS', E('AREA'), 'Πλάκα με κενό κλίμακας', rectLoop(0, 0, 10000, 8100), [rectLoop(8650, 1500, 9650, 5500)]);
  const solid = add('IFCEXTRUDEDAREASOLID', profile, axis0, zUp, 250);
  f1.elements.push(add('IFCSLAB', guid(), null, 'Πλάκα ορόφου', null, null, place(f1.place, 0, 0, -250), shape(solid), null, E('FLOOR')));
}
const fS = wall(f1, 'Τοίχος Ν', [0, 0, 0, 10000, 250, 2750]);
wall(f1, 'Τοίχος Β', [0, 7850, 0, 10000, 8100, 2750]);
wall(f1, 'Τοίχος Δ', [0, 250, 0, 250, 7850, 2750]);
wall(f1, 'Τοίχος Α', [9750, 250, 0, 10000, 7850, 2750]);
wall(f1, 'Εσωτερικός τοίχος', [5000, 250, 0, 5100, 7850, 2750]);
opening(fS, [4000, 0, 900, 5500, 250, 2100], element(f1, 'IFCWINDOW', 'Παράθυρο Ν', [4000, 90, 900, 5500, 160, 2100], [null, 1200, 1500, E('WINDOW'), E('SINGLE_PANEL'), null]));
element(f1, 'IFCRAILING', 'Κιγκλίδωμα', [8600, 1500, 0, 8650, 5500, 1200], [null, E('GUARDRAIL')]);
element(f1, 'IFCSLAB', 'Πλάκα οροφής', [0, 0, 2750, 10000, 8100, 3000], [null, E('ROOF')]);
space(f1, '1.01', 'Υπνοδωμάτιο', [250, 250, 0, 5000, 7850, 2750]);

for (const s of storeys) {
  add('IFCRELCONTAINEDINSPATIALSTRUCTURE', guid(), null, null, null, s.elements, s.ref);
  add('IFCRELAGGREGATES', guid(), null, null, null, s.ref, s.spaces);
}

// The quantities of one room: Σαλόνι, 43.70 m² gross, 43.61 m² net (its column off).
const qto = add('IFCELEMENTQUANTITY', guid(), null, 'Qto_SpaceBaseQuantities', null, null, [
  add('IFCQUANTITYAREA', 'GrossFloorArea', null, null, 43.7, null),
  add('IFCQUANTITYAREA', 'NetFloorArea', null, null, 43.61, null),
]);
add('IFCRELDEFINESBYPROPERTIES', guid(), null, null, null, [salon], qto);

const text = f.text({ name: 'example-house.ifc' });
if (process.argv.includes('--check')) {
  const same = existsSync(OUT) && readFileSync(OUT, 'latin1') === text;
  console.log(`${same ? 'same' : 'differs'} ${OUT}`);
  process.exit(same ? 0 : 1);
}
mkdirSync('js/ifcplan/examples', { recursive: true });
writeFileSync(OUT, text, 'latin1');
console.log(`wrote ${OUT} (${text.length} bytes)`);
