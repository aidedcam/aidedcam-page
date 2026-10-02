// Steel take-off: the module worker that holds web-ifc (spec §3), on the IFC floor plans tool's vendored copy. It
// answers the messages of the shared js/laser/bridge.js: 'boot' loads web-ifc and answers 'ready'; 'process' with an
// IFC's bytes opens the model and answers its take-off rows; 'process' with settings.check answers the open model's
// geometry check; 'process' with settings.mesh answers its members' triangles for the 3D view, or "large" above
// settings.maxTriangles. The model stays open until the next file. Single-threaded web-ifc: a static host needs no
// cross-origin isolation. createSession is the whole logic without the worker's globals, for the Node tests.
import * as WebIFC from '../ifcplan/vendor/web-ifc/web-ifc-api.js?v=20261003';
import { sniff, MAX_BYTES } from '../ifcplan/model.js?v=20261003';
import { readSteel, checkSteel, packMeshes } from './ifcread.js?v=20261104';

const supported = (W, schema) => (W.SchemaNames || []).some(names => Array.isArray(names) && names.includes(schema));

// loadApi: async () => ({ api, W }). Returns { boot, process(message) → { reply, transfer } }.
export function createSession(loadApi) {
  let booted = null;
  let open = null;                                            // { id, read, name }: the model kept for the check and 3D
  const boot = () => booted || (booted = loadApi());
  const error = (id, reason, detail = '') => ({ reply: { type: 'error', id, reason, detail }, transfer: [] });

  async function process(m) {
    const { api, W } = await boot();
    const settings = m.settings || {};
    try {
      if (settings.check || settings.mesh) {
        if (!open) return error(m.id, 'stale');               // the worker restarted, or the last file failed
        if (settings.check) return { reply: { type: 'result', id: m.id, name: open.name, checks: checkSteel(api, W, open.id, open.read) }, transfer: [] };
        const max = Number.isFinite(settings.maxTriangles) && settings.maxTriangles > 0 ? settings.maxTriangles : Infinity;
        const { mesh, triangles, transfer } = packMeshes(api, W, open.id, max);
        return { reply: mesh ? { type: 'result', id: m.id, name: open.name, mesh } : { type: 'result', id: m.id, name: open.name, mesh: null, triangles, reason: 'large' }, transfer };
      }
      if (open) { try { api.CloseModel(open.id); } catch (e) { /* already gone */ } open = null; }
      if (!m.bytes || m.bytes.byteLength > MAX_BYTES) return error(m.id, 'limit');
      const bytes = new Uint8Array(m.bytes);
      const s = sniff(bytes);
      if (!s.ok) return error(m.id, s.reason, s.detail);
      const id = api.OpenModel(bytes, { COORDINATE_TO_ORIGIN: false });
      if (id < 0) return supported(W, s.schema) ? error(m.id, 'read') : error(m.id, 'schema', s.schema);
      const read = readSteel(api, W, id);
      if (!read.rows.length) { api.CloseModel(id); return error(m.id, 'nosteel'); }
      open = { id, read, name: m.name };
      const file = { schema: api.GetModelSchema(id) || s.schema, members: read.members, assemblies: read.assemblies, fromGeometry: read.fromGeometry, unitM: read.unitM };
      return { reply: { type: 'result', id: m.id, name: m.name, file, rows: read.rows }, transfer: [] };
    } catch (err) {
      // web-ifc out of memory or aborted: the bridge restarts the worker on an 'engine' error.
      open = null;
      return error(m.id, 'engine', String((err && err.message) || err));
    }
  }
  return { boot, process };
}

async function browserApi() {
  const api = new WebIFC.IfcAPI();
  await api.Init(file => new URL(`../ifcplan/vendor/web-ifc/${file}?v=20261003`, import.meta.url).href, true);
  api.SetLogLevel(WebIFC.LogLevel.LOG_LEVEL_OFF);
  return { api, W: WebIFC };
}

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  const session = createSession(browserApi);
  let ready = false;
  self.onmessage = async e => {
    const m = e.data;
    try {
      await session.boot();
      if (!ready) { ready = true; self.postMessage({ type: 'ready' }); }
    } catch (err) {
      if (m.type === 'process') self.postMessage({ type: 'error', id: m.id, reason: 'engine', detail: String((err && err.message) || err) });
      return;
    }
    if (m.type !== 'process') return;
    const { reply, transfer } = await session.process(m);
    self.postMessage(reply, transfer);
  };
}
