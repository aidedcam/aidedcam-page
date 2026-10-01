// IFC floor plans, the 3D view: the model's triangles packed in the worker for the page (3D spec §3.1). Pure: no
// web-ifc, no DOM. Per layer, every element's vertices go into one position array and its triangles into one index
// array, and a parallel per-vertex array holds the element's place in the `elements` table (for picking); vertices are
// not shared between elements. Positions are Float32 relative to `origin` (the model's bounding-box minimum), so
// georeferenced coordinates (~5 × 10⁵ m) stay exact to well under a millimetre.

// A typed array that grows by doubling; take() hands over exactly the written part.
function growable(Type) {
  let a = new Type(4096), n = 0;
  return {
    reserve(k) {
      if (n + k <= a.length) return;
      let size = a.length * 2;
      while (size < n + k) size *= 2;
      const b = new Type(size);
      b.set(a.subarray(0, n));
      a = b;
    },
    push(v) { a[n++] = v; },
    get length() { return n; },
    take() { return n === a.length ? a : a.slice(0, n); },
  };
}

// createPacker({ origin: [x0, y0, z0], maxTriangles }) → { add(element), over, triangles, finish() }.
// add({ layer, type, name, storey, P: Float64Array xyz (Z up, metres), ix: Uint32Array }). Every triangle web-ifc gives
// is counted; once the count passes maxTriangles nothing more is packed, and finish() answers "large".
export function createPacker({ origin = [0, 0, 0], maxTriangles = Infinity } = {}) {
  const [ox, oy, oz] = origin;
  const layers = new Map();
  const elements = [];
  let triangles = 0, over = false;

  function add({ layer, type, name, storey, P, ix }) {
    triangles += Math.floor(ix.length / 3);
    if (over || triangles > maxTriangles) { over = true; layers.clear(); elements.length = 0; return; }
    let L = layers.get(layer);
    if (!L) layers.set(layer, L = { position: growable(Float32Array), index: growable(Uint32Array), element: growable(Uint32Array) });
    const e = elements.length;
    elements.push({ type, layer, name, storey });
    const nv = P.length / 3, base = L.element.length;
    L.position.reserve(3 * nv); L.element.reserve(nv);
    let bad = null;
    for (let k = 0; k < nv; k++) {
      const x = P[3 * k] - ox, y = P[3 * k + 1] - oy, z = P[3 * k + 2] - oz;
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        L.position.push(x); L.position.push(y); L.position.push(z);
      } else {
        // A vertex web-ifc could not compute: kept at the origin (a corner of the model's box), its triangles dropped.
        L.position.push(0); L.position.push(0); L.position.push(0);
        (bad || (bad = new Set())).add(k);
      }
      L.element.push(e);
    }
    L.index.reserve(ix.length);
    for (let t = 0; t + 2 < ix.length; t += 3) {
      const a = ix[t], b = ix[t + 1], c = ix[t + 2];
      if (bad && (bad.has(a) || bad.has(b) || bad.has(c))) continue;
      L.index.push(base + a); L.index.push(base + b); L.index.push(base + c);
    }
  }

  // { body, transfer }: body is the reply's part, transfer every buffer in it.
  function finish() {
    if (over) return { body: { mesh3d: null, triangles, reason: 'large' }, transfer: [] };
    const out = {}, transfer = [];
    for (const [name, L] of layers) {
      const position = L.position.take(), index = L.index.take(), element = L.element.take();
      out[name] = { position, index, element };
      transfer.push(position.buffer, index.buffer, element.buffer);
    }
    return { body: { mesh3d: { origin: [ox, oy, oz], layers: out, elements, triangles } }, transfer };
  }

  return { add, finish, get over() { return over; }, get triangles() { return triangles; } };
}

// All at once, for the tests.
export function packMesh(list, options) {
  const p = createPacker(options);
  for (const e of list) p.add(e);
  return p.finish();
}
