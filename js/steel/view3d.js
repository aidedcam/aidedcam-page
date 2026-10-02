// Steel take-off: the 3D view (spec §3, §6.6). Self-hosted three.js r186, imported without a ?v= so OrbitControls
// shares its one instance; an orthographic camera, Z up, Fit and the presets Top / Front / Side / Iso. It shows either
// one piece (an NC1 piece from shape3d.js's slabs, in mm) or the IFC's members from the worker's meshes (in m),
// coloured by grade with the selected piece's members highlighted. DOM and WebGL; the pure helpers before
// createView3d are Node-tested. Loaded by the page only when a piece is first shown.
import * as THREE from '../vendor/three/three.module.js';
import { OrbitControls } from '../vendor/three/addons/OrbitControls.js';
import { slabsBox } from './shape3d.js?v=20261005';

export const PRESETS = { top: [0, -1e-4, 1], front: [0, -1, 0], side: [1, 0, 0], iso: [1, -1, 0.8] };
export const GRADE_COLORS = { S235: '#8fa6bf', S275: '#86b39a', S355: '#c9a46a', S450: '#b88fb0', other: '#a9a49b' };
export const HIGHLIGHT = '#e0632b';
export const PART_COLORS = { web: '#9aa9b9', flange: '#7f90a3', plate: '#a8a29a', body: '#9aa9b9' };
const BG = 0xffffff;

export const gradeColor = g => GRADE_COLORS[g] || GRADE_COLORS.other;

// The worker's mesh split for drawing: per grade, the indices of the members not highlighted; and the highlighted
// members' indices. parts: [eid, first, count, …]; gradeOf(eid) → grade; highlight: a Set of eids.
export function splitIndex(mesh, gradeOf, highlight) {
  const lists = new Map(), hi = [];
  const p = mesh.parts;
  for (let k = 0; k < p.length; k += 3) {
    const eid = p[k], first = p[k + 1], count = p[k + 2];
    let out = hi;
    if (!highlight.has(eid)) {
      const g = gradeOf(eid) || 'other';
      if (!lists.has(g)) lists.set(g, []);
      out = lists.get(g);
    }
    for (let i = 0; i < count; i++) out.push(mesh.index[first + i]);
  }
  return { grades: [...lists].map(([g, ix]) => [g, Uint32Array.from(ix)]), highlight: Uint32Array.from(hi) };
}

// The box of the members in a set, in the mesh's own coordinates (m), or null.
export function partsBox(mesh, eids) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const p = mesh.parts;
  for (let k = 0; k < p.length; k += 3) {
    if (!eids.has(p[k])) continue;
    for (let i = p[k + 1]; i < p[k + 1] + p[k + 2]; i++) {
      const v = 3 * mesh.index[i];
      for (let c = 0; c < 3; c++) { const x = mesh.position[v + c]; if (x < min[c]) min[c] = x; if (x > max[c]) max[c] = x; }
    }
  }
  return min[0] <= max[0] ? { min, max } : null;
}

export function hasWebGL2() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return true;
  } catch (e) { return false; }
}

// onLost(): the WebGL context was lost. Throws when WebGL is not available.
export function createView3d(container, { onLost = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(BG, 1);
  const canvas = renderer.domElement;
  canvas.className = 'st-3d-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  container.prepend(canvas);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8f8b80, 2.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(0.45, -0.8, 1.3);
  scene.add(sun);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, canvas);
  controls.screenSpacePanning = true;
  controls.zoomToCursor = true;
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  const content = new THREE.Group();
  scene.add(content);
  let box = null, viewSize = 2, frame = 0, disposed = false, shown = null;

  function render() {
    frame = 0;
    if (!canvas.clientWidth || !canvas.clientHeight) return;
    renderer.render(scene, camera);
  }
  const requestRender = () => { if (!frame && !disposed) frame = requestAnimationFrame(render); };
  controls.addEventListener('change', requestRender);
  canvas.addEventListener('webglcontextlost', () => onLost());

  function applyFrustum() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1, aspect = w / h;
    camera.left = (-viewSize * aspect) / 2; camera.right = (viewSize * aspect) / 2;
    camera.top = viewSize / 2; camera.bottom = -viewSize / 2;
    controls.minZoom = 0.05; controls.maxZoom = 2000;
    camera.updateProjectionMatrix();
  }
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h || disposed) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    applyFrustum();
    requestRender();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  function clear() {
    content.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    content.clear();
    content.scale.set(1, 1, 1);
    box = null; shown = null;
    requestRender();
  }
  const material = color => new THREE.MeshLambertMaterial({ color, flatShading: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const edges = (geometry, color) => new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 30), new THREE.LineBasicMaterial({ color }));

  // One NC1 piece: each slab extruded and placed by its frame; mm scaled to m.
  function showPiece(slabs) {
    clear();
    for (const s of slabs) {
      const shape = new THREE.Shape();
      for (let i = 0; i < s.outline.length; i += 2) (i ? shape.lineTo : shape.moveTo).call(shape, s.outline[i], s.outline[i + 1]);
      for (const hl of s.holes) {
        const path = new THREE.Path();
        for (let i = 0; i < hl.length; i += 2) (i ? path.lineTo : path.moveTo).call(path, hl[i], hl[i + 1]);
        shape.holes.push(path);
      }
      const g = new THREE.ExtrudeGeometry(shape, { depth: s.depth, bevelEnabled: false, curveSegments: 1 });
      const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...s.frame.u), new THREE.Vector3(...s.frame.v), new THREE.Vector3(...s.frame.w));
      m.setPosition(...s.frame.o);
      g.applyMatrix4(m);
      content.add(new THREE.Mesh(g, material(PART_COLORS[s.part] || PART_COLORS.body)));
      content.add(edges(g, 0x3d434b));
    }
    content.scale.setScalar(0.001);
    const b = slabsBox(slabs);
    box = new THREE.Box3(new THREE.Vector3(...b.min).multiplyScalar(0.001), new THREE.Vector3(...b.max).multiplyScalar(0.001));
    shown = 'piece';
    fitView(new THREE.Vector3(...PRESETS.iso));
  }

  // The IFC's members: per grade one mesh, the highlighted members in the highlight colour; fitted on the
  // highlighted members when `focus`, else on the whole model.
  function showModel(mesh, gradeOf, highlight, { focus = false, only = false } = {}) {
    clear();
    const position = new THREE.BufferAttribute(mesh.position, 3);
    const split = splitIndex(mesh, gradeOf, highlight);
    const add = (index, color) => {
      if (!index.length) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', position);
      g.setIndex(new THREE.BufferAttribute(index, 1));
      content.add(new THREE.Mesh(g, material(color)));
    };
    if (!only) for (const [grade, index] of split.grades) add(index, gradeColor(grade));
    add(split.highlight, only ? PART_COLORS.body : HIGHLIGHT);
    const b = (focus || only) && highlight.size ? partsBox(mesh, highlight) : null;
    if (b) box = new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max));
    else { box = new THREE.Box3(); for (const o of content.children) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox); } }
    if (box.isEmpty()) box = null;
    shown = only ? 'member' : 'model';
    fitView(new THREE.Vector3(...PRESETS.iso));
  }

  function fitView(dirOverride) {
    if (!box) { requestRender(); return; }
    const centre = box.getCenter(new THREE.Vector3());
    const radius = Math.max(0.05, box.getSize(new THREE.Vector3()).length() / 2);
    const dir = dirOverride ? dirOverride.clone() : camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-12) dir.set(...PRESETS.iso);
    dir.normalize();
    viewSize = radius * 2.1;
    controls.target.copy(centre);
    camera.position.copy(centre).addScaledVector(dir, radius * 4);
    camera.near = radius * 0.5; camera.far = radius * 8;
    camera.zoom = 1;
    applyFrustum();
    camera.lookAt(centre);
    controls.update();
    requestRender();
  }
  const preset = name => fitView(new THREE.Vector3(...(PRESETS[name] || PRESETS.iso)));

  function destroy() {
    if (disposed) return;
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    observer.disconnect();
    controls.dispose();
    clear();
    renderer.dispose();
    canvas.remove();
  }

  resize();
  return {
    showPiece, showModel, clear, preset, fit: () => fitView(), dispose: destroy, canvas,
    // For the browser check: what is shown, the renderer's geometries, and the drawn pixels that are not background.
    get shown() { return shown; },
    get disposed() { return disposed; },
    get meshes() { return content.children.filter(o => o.isMesh).length; },
    get geometries() { return renderer.info.memory.geometries; },
    ink() {
      render();
      const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, a = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a);
      let n = 0;
      for (let i = 0; i < a.length; i += 4) if (a[i] < 250 || a[i + 1] < 250 || a[i + 2] < 250) n++;
      return n;
    },
  };
}
