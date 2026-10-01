// IFC floor plans, the 3D view (3D spec §3.2, §4): self-hosted three.js (the milling viewer's copy, imported without
// a ?v= so the addons share its one instance), an orthographic camera with Z up, OrbitControls, the presets Top /
// Front / Side / Iso and Fit. One clipping plane at the selected storey's cut; that storey's plan lines drawn at the
// cut in the plan's colours; layers hidden by the legend; GPU picking for the tooltip. DOM and WebGL; the small pure
// helpers before createView3d are Node-tested. Loaded by the page only when the 3D tab is first opened.
import * as THREE from '../vendor/three/three.module.js';
import { OrbitControls } from '../vendor/three/addons/OrbitControls.js';
import { LineSegments2 } from '../vendor/three/addons/LineSegments2.js';
import { LineSegmentsGeometry } from '../vendor/three/addons/LineSegmentsGeometry.js';
import { LineMaterial } from '../vendor/three/addons/LineMaterial.js';
import { style3d } from './palette3d.js?v=20261003';
import { forEachPolyline } from './chain.js?v=20261003';
import { LAYER_COLORS } from './drawing.js?v=20261003';

// Camera directions (from the target towards the camera), Z up.
export const PRESETS = { top: [0, -1e-4, 1], front: [0, -1, 0], side: [1, 0, 0], iso: [1, -1, 0.8] };
export const LIFT = 0.003;                   // m: the cut lines sit this far above the cut, clear of the clipped faces
const BG = 0xffffff;
const OFF = 1e9;                             // the clipping plane's constant with the cut switched off

// GPU picking: element i is drawn in the colour i + 1 (24 bits), the background stays 0.
export const pickColor = i => { const n = i + 1; return [n & 255, (n >> 8) & 255, (n >> 16) & 255]; };
export const pickIndex = (r, g, b) => { const n = r + (g << 8) + (b << 16); return n ? n - 1 : null; };

// A storey's plan polylines (the worker's packed sets, IFC world metres) as line segments for LineSegments2: per layer,
// a Float32Array [x0, y0, z, x1, y1, z, …] relative to origin, at the storey's cut Z plus LIFT.
export function cutSegments(storey, origin) {
  const out = {};
  const z = storey.cutZ - origin[2] + LIFT;
  for (const [name, set] of Object.entries(storey.layers)) {
    let n = 0;
    forEachPolyline(set, (pts, closed) => { const k = pts.length / 2; if (k >= 2) n += closed ? k : k - 1; });
    if (!n) continue;
    const a = new Float32Array(6 * n);
    let j = 0;
    forEachPolyline(set, (pts, closed) => {
      const k = pts.length / 2;
      if (k < 2) return;
      for (let i = closed ? 0 : 1; i < k; i++) {
        const p = i === 0 ? k - 1 : i - 1;
        a[j++] = pts[2 * p] - origin[0]; a[j++] = pts[2 * p + 1] - origin[1]; a[j++] = z;
        a[j++] = pts[2 * i] - origin[0]; a[j++] = pts[2 * i + 1] - origin[1]; a[j++] = z;
      }
    });
    out[name] = a;
  }
  return out;
}

// Whether this browser gives a WebGL2 context (the 3D view needs one). The test context is released at once.
export function hasWebGL2() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return true;
  } catch (e) { return false; }
}

// The element index arrives as an integer attribute (three.js binds a Uint32Array with vertexAttribIPointer).
const PICK_VERTEX = `
attribute uint element;
varying vec3 vPick;
#include <common>
#include <clipping_planes_pars_vertex>
void main() {
  float n = float(element) + 1.0;
  vPick = vec3(mod(n, 256.0), mod(floor(n / 256.0), 256.0), floor(n / 65536.0)) / 255.0;
  #include <begin_vertex>
  #include <project_vertex>
  #include <clipping_planes_vertex>
}`;
const PICK_FRAGMENT = `
varying vec3 vPick;
#include <clipping_planes_pars_fragment>
void main() {
  #include <clipping_planes_fragment>
  gl_FragColor = vec4(vPick, 1.0);
}`;

// onHover(elementIndex | null, clientX, clientY): the element under a still mouse pointer, or under a tap.
// onLost(): the WebGL context was lost. Throws when WebGL is not available.
export function createView3d(container, { onHover = () => {}, onLost = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(BG, 1);
  renderer.localClippingEnabled = true;
  const canvas = renderer.domElement;
  canvas.className = 'ip-3d-canvas';
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

  const plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), OFF);   // keeps z ≤ constant (relative to origin)
  const pickMaterial = new THREE.ShaderMaterial({ vertexShader: PICK_VERTEX, fragmentShader: PICK_FRAGMENT, side: THREE.DoubleSide, clipping: true, clippingPlanes: [plane] });
  const meshes = new Map(), lines = new Map();
  let origin = [0, 0, 0], box = null, radius = 1, viewSize = 2, cutZ = null, hidden = new Set(), pickTarget = null, frame = 0, disposed = false;
  const pixel = new Uint8Array(4);

  // ---- rendering on demand ----
  function render() {
    frame = 0;
    if (!canvas.clientWidth || !canvas.clientHeight) return;
    renderer.render(scene, camera);
  }
  const requestRender = () => { if (!frame && !disposed) frame = requestAnimationFrame(render); };
  controls.addEventListener('change', requestRender);
  canvas.addEventListener('webglcontextlost', () => { stopHover(); onLost(); });

  // ---- sizing ----
  function applyFrustum() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1, aspect = w / h;
    camera.left = (-viewSize * aspect) / 2; camera.right = (viewSize * aspect) / 2;
    camera.top = viewSize / 2; camera.bottom = -viewSize / 2;
    controls.minZoom = 0.05; controls.maxZoom = 2000;
    camera.updateProjectionMatrix();
    for (const o of lines.values()) o.material.resolution.set(w, h);
  }
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h || disposed) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));   // browser zoom or another monitor changes it
    renderer.setSize(w, h, false);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    applyFrustum();
    requestRender();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  // ---- content ----
  function dispose(o) { scene.remove(o); o.geometry.dispose(); o.material.dispose(); }
  function clearLines() { for (const o of lines.values()) dispose(o); lines.clear(); }
  function clear() {
    for (const m of meshes.values()) dispose(m);
    meshes.clear();
    clearLines();
    if (pickTarget) { pickTarget.dispose(); pickTarget = null; }
    box = null; cutZ = null; plane.constant = OFF;
    requestRender();
  }

  // The view is dropped (a lost context): no frame, observer or pick left pending, and the GPU resources released.
  function destroy() {
    if (disposed) return;
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    stopHover();
    observer.disconnect();
    controls.dispose();
    clear();
    pickMaterial.dispose();
    renderer.dispose();
    canvas.remove();
  }

  // mesh: the worker's mesh3d (3D spec §3.1). One Mesh per layer, in the layer's 3D colour; fitted in Iso.
  function setMesh(mesh) {
    clear();
    origin = mesh.origin;
    box = new THREE.Box3();
    for (const [name, L] of Object.entries(mesh.layers)) {
      if (!L.index.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(L.position, 3));
      g.setAttribute('element', new THREE.BufferAttribute(L.element, 1));
      g.setIndex(new THREE.BufferAttribute(L.index, 1));
      g.computeBoundingBox();
      box.union(g.boundingBox);
      const st = style3d(name);
      const mat = new THREE.MeshLambertMaterial({ color: st.color, flatShading: true, side: THREE.DoubleSide, transparent: st.transparent, opacity: st.opacity, depthWrite: !st.transparent, clippingPlanes: [plane] });
      const m = new THREE.Mesh(g, mat);
      m.renderOrder = st.order;
      m.visible = !hidden.has(name);
      scene.add(m);
      meshes.set(name, m);
    }
    if (box.isEmpty()) box = null;
    fitView(new THREE.Vector3(...PRESETS.iso));
  }

  // The cut: z the clipping plane's world Z (the storey's cutZ), or null to show the whole model; storey the plan
  // whose lines are drawn at the cut.
  function setCut(z, storey) {
    cutZ = Number.isFinite(z) ? z : null;
    plane.constant = cutZ === null ? OFF : cutZ - origin[2];
    clearLines();
    if (cutZ !== null && storey && meshes.size) {
      const segs = cutSegments({ layers: storey.layers, cutZ }, origin);
      for (const [name, a] of Object.entries(segs)) {
        const g = new LineSegmentsGeometry();
        g.setPositions(a);
        const mat = new LineMaterial({ color: LAYER_COLORS[name] || LAYER_COLORS.IFC_OTHER, linewidth: 2 });
        mat.resolution.set(canvas.clientWidth || 1, canvas.clientHeight || 1);
        const o = new LineSegments2(g, mat);
        o.renderOrder = 3;
        o.visible = !hidden.has(name);
        scene.add(o);
        lines.set(name, o);
      }
    }
    requestRender();
  }

  function setHidden(set) {
    hidden = new Set(set);
    for (const [name, o] of [...meshes, ...lines]) o.visible = !hidden.has(name);
    requestRender();
  }

  // ---- camera ----
  function fitView(dirOverride) {
    if (!box) { requestRender(); return; }
    const centre = box.getCenter(new THREE.Vector3());
    radius = Math.max(0.5, box.getSize(new THREE.Vector3()).length() / 2);
    const dir = dirOverride ? dirOverride.clone() : camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-12) dir.set(...PRESETS.iso);
    dir.normalize();
    viewSize = radius * 2.1;
    controls.target.copy(centre);
    camera.position.copy(centre).addScaledVector(dir, radius * 4);
    camera.near = radius; camera.far = radius * 8;          // the depth range spans the model only
    camera.zoom = 1;
    applyFrustum();
    camera.lookAt(centre);
    controls.update();
    requestRender();
  }
  const preset = name => fitView(new THREE.Vector3(...(PRESETS[name] || PRESETS.iso)));
  function zoomBy(f) {
    camera.zoom = Math.min(controls.maxZoom, Math.max(controls.minZoom, camera.zoom * f));
    camera.updateProjectionMatrix();
    controls.update();
    requestRender();
  }
  function orbit(dAzimuth, dPolar) {
    const off = camera.position.clone().sub(controls.target);
    off.applyAxisAngle(new THREE.Vector3(0, 0, 1), dAzimuth);
    const right = off.clone().cross(new THREE.Vector3(0, 0, 1));
    if (right.lengthSq() > 1e-12) {
      const next = off.clone().applyAxisAngle(right.normalize(), dPolar);
      const polar = next.angleTo(new THREE.Vector3(0, 0, 1));
      if (polar > 0.01 && polar < Math.PI - 0.01) off.copy(next);
    }
    camera.position.copy(controls.target).add(off);
    camera.lookAt(controls.target);
    controls.update();
    requestRender();
  }

  // ---- picking: the element-index render of one pixel ----
  function pickAt(sx, sy) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!meshes.size || !w || !h || sx < 0 || sy < 0 || sx >= w || sy >= h) return null;
    if (!pickTarget) pickTarget = new THREE.WebGLRenderTarget(1, 1);
    const saved = [];
    for (const [name, m] of meshes) { saved.push([m, m.visible]); if (name === 'IFC_SPACE') m.visible = false; }   // rooms cover the walls
    for (const o of lines.values()) { saved.push([o, o.visible]); o.visible = false; }
    scene.overrideMaterial = pickMaterial;
    camera.setViewOffset(w, h, Math.floor(sx), Math.floor(sy), 1, 1);
    renderer.setRenderTarget(pickTarget);
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(pickTarget, 0, 0, 1, 1, pixel);
    renderer.setRenderTarget(null);
    renderer.setClearColor(BG, 1);
    camera.clearViewOffset();
    scene.overrideMaterial = null;
    for (const [o, v] of saved) o.visible = v;
    return pickIndex(pixel[0], pixel[1], pixel[2]);
  }

  // Hover: at most one pick per animation frame, at the latest pointer position, never while a button is held.
  let hover = null, hoverFrame = 0, down = null, pointers = 0;
  const local = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function stopHover() { if (hoverFrame) cancelAnimationFrame(hoverFrame); hoverFrame = 0; hover = null; }
  function doHover() {
    hoverFrame = 0;
    const q = hover;
    hover = null;
    if (q) onHover(pickAt(q.x, q.y), q.clientX, q.clientY);
  }
  canvas.addEventListener('pointerdown', e => { pointers++; down = pointers === 1 ? { x: e.clientX, y: e.clientY } : null; stopHover(); onHover(null, 0, 0); });
  canvas.addEventListener('pointerup', e => {
    pointers = Math.max(0, pointers - 1);
    if (down && e.pointerType === 'touch' && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 4) {
      const p = local(e);
      onHover(pickAt(p.x, p.y), e.clientX, e.clientY);         // no hover on touch: a tap picks
    }
    down = null;
  });
  canvas.addEventListener('pointercancel', () => { pointers = Math.max(0, pointers - 1); down = null; });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' || e.buttons || pointers) return;
    const p = local(e);
    hover = { x: p.x, y: p.y, clientX: e.clientX, clientY: e.clientY };
    if (!hoverFrame) hoverFrame = requestAnimationFrame(doHover);
  });
  canvas.addEventListener('pointerleave', () => { stopHover(); onHover(null, 0, 0); });
  canvas.addEventListener('keydown', e => {
    const step = Math.PI / 36;
    const keys = { '+': () => zoomBy(1.25), '=': () => zoomBy(1.25), '-': () => zoomBy(1 / 1.25), f: () => fitView(), F: () => fitView(),
      ArrowLeft: () => orbit(-step, 0), ArrowRight: () => orbit(step, 0), ArrowUp: () => orbit(0, -step), ArrowDown: () => orbit(0, step) };
    if (keys[e.key]) { e.preventDefault(); keys[e.key](); }
  });

  resize();
  return {
    setMesh, setCut, setHidden, clear, dispose: destroy, preset, fit: () => fitView(), zoomBy, pickAt, canvas,
    // For the browser check: the cut's world Z (null when off), the layers drawn, the geometries the renderer holds,
    // where a world point is on screen (CSS px in the canvas), and the drawn pixels that are not background.
    get cutZ() { return cutZ; },
    get disposed() { return disposed; },
    get layers() { return [...meshes.keys()].filter(n => meshes.get(n).visible); },
    get lineLayers() { return [...lines.keys()].filter(n => lines.get(n).visible); },
    get geometries() { return renderer.info.memory.geometries; },
    screenOf(x, y, z) {
      const v = new THREE.Vector3(x - origin[0], y - origin[1], z - origin[2]).project(camera);
      return { x: ((v.x + 1) / 2) * canvas.clientWidth, y: ((1 - v.y) / 2) * canvas.clientHeight };
    },
    ink() {
      render();
      const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, a = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a);
      let n = 0, sig = 0;
      for (let i = 0; i < a.length; i += 4) if (a[i] < 250 || a[i + 1] < 250 || a[i + 2] < 250) { n++; sig = (sig * 31 + a[i] + 7 * a[i + 1] + 13 * a[i + 2] + i) >>> 0; }
      return { n, sig };
    },
  };
}
