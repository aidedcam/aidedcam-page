// The milling 3D view (spec §2, §8): self-hosted three.js, orthographic, Z up. DOM and WebGL only;
// the pure parts (layers, ranges, pick grid, tints) are in scene.js.
import * as THREE from '../vendor/three/three.module.js';
import { OrbitControls } from '../vendor/three/addons/OrbitControls.js';
import { LineSegments2 } from '../vendor/three/addons/LineSegments2.js';
import { LineSegmentsGeometry } from '../vendor/three/addons/LineSegmentsGeometry.js';
import { LineMaterial } from '../vendor/three/addons/LineMaterial.js';
import { buildLayers, layerRange, buildPickGrid, pickNearest, offsetTints } from './scene.js';

const MIN_WIDTH = 1e-3, MAX_WIDTH = 1e6;             // visible width limits, world units (spec: no hang)
const PRESETS = {
  top: [0, -1e-4, 1], front: [0, -1, 0], right: [1, 0, 0], iso: [1, -1, 0.8],
};
const cssColor = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#000';

function crossTexture(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  g.strokeStyle = color; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(7, 7); g.lineTo(25, 25); g.moveTo(25, 7); g.lineTo(7, 25); g.stroke();
  return new THREE.CanvasTexture(c);
}
function letterSprite(text, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = color; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 16, 17);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  s.scale.set(0.8, 0.8, 0.8);
  return s;
}

// onHover(moveIndex | null, point | null, marker | null); onPick(moveIndex | null, point | null, marker | null).
// Throws when WebGL is not available (the page then shows its banner).
export function createView3d(container, { onHover, onPick }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0xffffff, 1);
  const canvas = renderer.domElement;
  canvas.className = 'gv-3d-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');                        // so its aria-label is read out
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1e7, 1e7);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, canvas);
  controls.screenSpacePanning = true;
  controls.zoomToCursor = true;
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  // Axis triad in the bottom-left corner, rendered with the main camera's orientation.
  const triScene = new THREE.Scene();
  const triCam = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.1, 10);
  triCam.up.set(0, 0, 1);
  triScene.add(new THREE.AxesHelper(1));
  const labels = [['X', '#c2410c', [1.3, 0, 0]], ['Y', '#0d7a3e', [0, 1.3, 0]], ['Z', '#4a6f8f', [0, 0, 1.3]]];
  for (const [txt, col, p] of labels) { const s = letterSprite(txt, col); s.position.set(...p); triScene.add(s); }

  const colors = {
    feed: cssColor('--gv-feed'), rapid: cssColor('--gv-rapid'), pass: cssColor('--gv-pass'), hi: cssColor('--gv-hi'),
  };
  let result = null, layers = [], objects = [], hiObj = null, markerObj = null, viewSize = 1, radius = 1;
  const visible = { feed: true, rapid: true, cycle: true, markers: true };
  let range = [0, 0], grid = null, gridTimer = null, frame = 0;

  // ---- rendering on demand ----
  function render() {
    frame = 0;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setViewport(0, 0, w, h);
    renderer.setScissorTest(false);
    renderer.render(scene, camera);
    const dir = camera.position.clone().sub(controls.target).normalize();
    triCam.position.copy(dir.multiplyScalar(4));
    triCam.up.copy(camera.up);
    triCam.lookAt(0, 0, 0);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.setScissorTest(true);
    renderer.setViewport(6, 6, 96, 96);
    renderer.setScissor(6, 6, 96, 96);
    renderer.render(triScene, triCam);
    renderer.setScissorTest(false);
    renderer.autoClear = true;
  }
  function requestRender() { if (!frame) frame = requestAnimationFrame(render); }
  controls.addEventListener('change', () => { requestRender(); staleGrid(); });
  canvas.addEventListener('webglcontextrestored', () => requestRender());   // three.js rebuilds its state; draw again

  // ---- sizing ----
  function applyFrustum() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1, aspect = w / h;
    camera.left = (-viewSize * aspect) / 2; camera.right = (viewSize * aspect) / 2;
    camera.top = viewSize / 2; camera.bottom = -viewSize / 2;
    const frustumW = camera.right - camera.left;
    controls.minZoom = frustumW / MAX_WIDTH;
    controls.maxZoom = frustumW / MIN_WIDTH;
    camera.zoom = Math.min(controls.maxZoom, Math.max(controls.minZoom, camera.zoom));
    camera.updateProjectionMatrix();
    if (hiObj) hiObj.material.resolution.set(w, h);
  }
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    applyFrustum();
    staleGrid();
    requestRender();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  // ---- content ----
  function disposeObjects() {
    for (const o of [...objects, hiObj, markerObj]) {
      if (!o) continue;
      scene.remove(o);
      o.geometry.dispose();
      if (o.material.map) o.material.map.dispose();   // the marker cross texture
      o.material.dispose();
    }
    objects = []; hiObj = null; markerObj = null; layers = []; grid = null;
  }

  function lineObject(layer, color, dashed, tints) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(layer.pos, 3));
    let mat;
    if (tints) {
      const col = new Float32Array(layer.count * 6), c = new THREE.Color();
      for (let j = 0; j < layer.count; j++) {
        c.set(tints[layer.wofs[j] % tints.length]);
        col.set([c.r, c.g, c.b, c.r, c.g, c.b], j * 6);
      }
      geom.setAttribute('color', new THREE.BufferAttribute(col, 3));
      mat = new THREE.LineBasicMaterial({ vertexColors: true });
    } else if (dashed) {
      mat = new THREE.LineDashedMaterial({ color, dashSize: radius / 60, gapSize: radius / 90 });
    } else {
      mat = new THREE.LineBasicMaterial({ color });
    }
    const obj = new THREE.LineSegments(geom, mat);
    if (dashed) obj.computeLineDistances();
    obj.frustumCulled = false;
    return obj;
  }

  function setResult(r, { fit = false } = {}) {
    disposeObjects();
    result = r;
    if (!r || !r.moves.count) { requestRender(); return; }
    const b = r.cutBounds || r.bounds;
    radius = Math.max(1, Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) / 2);
    layers = buildLayers(r.moves);
    const tints = r.workOffsets.length > 1 ? offsetTints(colors.feed, r.workOffsets.length) : null;
    objects = [
      lineObject(layers[0], colors.feed, false, tints),
      lineObject(layers[1], colors.rapid, true, null),
      lineObject(layers[2], colors.pass, false, null),
      lineObject(layers[3], colors.pass, true, null),
    ];
    objects.forEach(o => scene.add(o));
    if (r.markers.length) {
      const pos = new Float32Array(r.markers.length * 3);
      r.markers.forEach((m, i) => pos.set([m.x, m.y, m.z], i * 3));
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      markerObj = new THREE.Points(geom, new THREE.PointsMaterial({ size: 16, sizeAttenuation: false,
        map: crossTexture(colors.hi), transparent: true, depthTest: false }));
      markerObj.renderOrder = 11;
      markerObj.frustumCulled = false;
      scene.add(markerObj);
    }
    range = [0, r.moves.count];
    applyVisibility();
    if (fit) fitView();
    staleGrid();
    requestRender();
  }

  function applyVisibility() {
    if (!layers.length) return;
    const show = [visible.feed, visible.rapid, visible.cycle, visible.cycle];
    layers.forEach((L, i) => {
      const { first, count } = layerRange(L, range[0], range[1]);
      objects[i].geometry.setDrawRange(first * 2, count * 2);
      objects[i].visible = show[i];
    });
    if (markerObj) markerObj.visible = visible.markers;
  }

  // ---- camera ----
  function fitView(dirOverride) {
    if (!result || !result.moves.count) return;
    const b = result.cutBounds || result.bounds;
    const centre = new THREE.Vector3((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
    const dir = dirOverride || camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-12) dir.set(...PRESETS.iso);
    dir.normalize();
    viewSize = radius * 2.2;
    controls.target.copy(centre);
    camera.position.copy(centre).add(dir.multiplyScalar(radius * 4));
    camera.zoom = 1;
    applyFrustum();
    camera.lookAt(centre);
    controls.update();
    requestRender();
  }
  function preset(name) { fitView(new THREE.Vector3(...(PRESETS[name] || PRESETS.iso))); }
  function zoomBy(f) {
    camera.zoom = Math.min(controls.maxZoom, Math.max(controls.minZoom, camera.zoom * f));
    camera.updateProjectionMatrix();
    controls.update();
    requestRender();
    staleGrid();
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
    staleGrid();
  }

  // ---- picking ----
  function staleGrid() {
    grid = null;
    clearTimeout(gridTimer);
    gridTimer = setTimeout(buildGrid, 150);
  }
  function projector() {
    camera.updateMatrixWorld();
    const m = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).elements;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    return (x, y, z, out) => {
      const px = m[0] * x + m[4] * y + m[8] * z + m[12];
      const py = m[1] * x + m[5] * y + m[9] * z + m[13];
      out[0] = ((px + 1) / 2) * w;
      out[1] = ((1 - py) / 2) * h;
      return true;
    };
  }
  function buildGrid() {
    if (!result || !result.moves.count) return;
    const kinds = [visible.rapid, visible.feed, visible.cycle, visible.cycle];   // by move kind 0..3
    const k = result.moves.kind;
    grid = buildPickGrid(result.moves, i => kinds[k[i]] && i >= range[0] && i < range[1],
      projector(), canvas.clientWidth, canvas.clientHeight, 8);
  }
  function worldPointOn(i, sx, sy) {
    const p = result.moves.pos, s = grid.scr;
    const x0 = s[i * 4], y0 = s[i * 4 + 1], x1 = s[i * 4 + 2], y1 = s[i * 4 + 3];
    const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((sx - x0) * dx + (sy - y0) * dy) / l2)) : 0;
    const a = i * 6;
    return { x: p[a] + (p[a + 3] - p[a]) * t, y: p[a + 1] + (p[a + 4] - p[a + 1]) * t, z: p[a + 2] + (p[a + 5] - p[a + 2]) * t };
  }
  function markerAt(sx, sy, tol) {
    if (!result || !markerObj || !visible.markers) return null;
    const project = projector(), out = [0, 0];
    for (const m of result.markers) {
      project(m.x, m.y, m.z, out);
      if (Math.hypot(out[0] - sx, out[1] - sy) <= tol) return m;
    }
    return null;
  }
  function hitAt(e) {
    const rect = canvas.getBoundingClientRect(), sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const tol = e.pointerType === 'touch' ? 16 : 6;          // a finger needs a larger target
    const marker = markerAt(sx, sy, tol + 3);
    if (marker) return { i: null, point: { x: marker.x, y: marker.y, z: marker.z }, marker };
    if (!grid) buildGrid();
    if (!grid) return { i: null, point: null, marker: null };
    const i = pickNearest(grid, sx, sy, tol);
    return { i, point: i === null ? null : worldPointOn(i, sx, sy), marker: null };
  }

  let down = null, pointers = 0;
  canvas.addEventListener('pointerdown', e => { pointers++; down = pointers === 1 ? { x: e.clientX, y: e.clientY } : null; });
  canvas.addEventListener('pointerup', e => {
    pointers = Math.max(0, pointers - 1);
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 4) {
      const h = hitAt(e);
      onPick(h.i, h.point, h.marker);
    }
    down = null;
  });
  canvas.addEventListener('pointercancel', () => { pointers = Math.max(0, pointers - 1); down = null; });
  canvas.addEventListener('pointermove', e => {
    if (e.buttons || pointers) return;                       // dragging: the camera moves, no hover
    const h = hitAt(e);
    onHover(h.i, h.point, h.marker);
  });
  canvas.addEventListener('pointerleave', () => onHover(null, null, null));
  canvas.addEventListener('keydown', e => {
    const step = Math.PI / 36;
    const keys = { '+': () => zoomBy(1.25), '=': () => zoomBy(1.25), '-': () => zoomBy(1 / 1.25), f: () => fitView(), F: () => fitView(),
      ArrowLeft: () => orbit(-step, 0), ArrowRight: () => orbit(step, 0), ArrowUp: () => orbit(0, -step), ArrowDown: () => orbit(0, step) };
    if (keys[e.key]) { e.preventDefault(); keys[e.key](); }
  });

  // ---- highlight ----
  function highlight(indices) {
    if (hiObj) { scene.remove(hiObj); hiObj.geometry.dispose(); hiObj.material.dispose(); hiObj = null; }
    if (result && indices.length) {
      const pos = new Float32Array(indices.length * 6);
      indices.forEach((i, j) => pos.set(result.moves.pos.subarray(i * 6, i * 6 + 6), j * 6));
      const geom = new LineSegmentsGeometry();
      geom.setPositions(pos);
      const mat = new LineMaterial({ color: colors.hi, linewidth: 3, depthTest: false });
      mat.resolution.set(canvas.clientWidth, canvas.clientHeight);
      hiObj = new LineSegments2(geom, mat);
      hiObj.renderOrder = 10;
      hiObj.frustumCulled = false;
      scene.add(hiObj);
    }
    requestRender();
  }

  // ---- snapshot for print: the current view at `scale` × the screen resolution ----
  function snapshot(scale = 2) {
    const before = renderer.getPixelRatio();
    renderer.setPixelRatio(scale);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    render();
    const url = canvas.toDataURL('image/png');
    renderer.setPixelRatio(before);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    render();
    return url;
  }

  resize();
  return {
    setResult,
    clear: () => setResult(null),
    fit: () => fitView(),
    preset,
    zoomBy,
    setLayerVisible(name, on) { visible[name] = on; applyVisibility(); staleGrid(); requestRender(); },
    setRange(start, end) { range = [start, end]; applyVisibility(); staleGrid(); requestRender(); },
    highlight,
    snapshot,
    viewWidth: () => (camera.right - camera.left) / camera.zoom,
    canvas,
  };
}
