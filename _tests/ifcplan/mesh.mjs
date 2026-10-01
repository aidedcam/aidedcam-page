// Hand-made meshes for the IFC plan tests, in the worker's form: P = [x, y, z, …] in metres (IFC Z-up) and
// triangle indices.

// An axis-parallel box as 12 triangles (two per face), as web-ifc meshes an extruded rectangle.
export function box(x0, y0, z0, x1, y1, z1) {
  const P = new Float64Array([
    x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0,
    x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1,
  ]);
  const ix = new Uint32Array([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7,          // bottom, top
    0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5,          // front, right
    2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7,          // back, left
  ]);
  return { P, ix };
}

// One triangle.
export const tri = (a, b, c) => ({ P: new Float64Array([...a, ...b, ...c]), ix: new Uint32Array([0, 1, 2]) });

// Every segment a cut gives, as [k, x0, y0, x1, y1] rows.
export function segmentsOf(cut, mesh, planes) {
  const out = [];
  cut(mesh.P, mesh.ix, planes, (k, x0, y0, x1, y1) => out.push([k, x0, y0, x1, y1]));
  return out;
}
