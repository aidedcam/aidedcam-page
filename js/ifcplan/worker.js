// IFC floor plans: the module worker that holds web-ifc (spec §3). It answers the messages of the shared
// js/laser/bridge.js: 'boot' loads web-ifc and answers 'ready'; 'process' with a file's bytes opens the model, cuts
// every storey at settings.cutM and answers { type: 'result' }; 'process' with settings.recut cuts the open model
// again at a new height, without the bytes; 'process' with settings.mesh3d answers the open model's triangles for the
// 3D view (3D spec §3.1), or "large" over settings.maxTriangles. The model stays open until the next file.
// Single-threaded web-ifc, so a static host needs no cross-origin isolation.
// createSession is the whole logic, without the worker's globals, so the Node tests drive it with the same web-ifc.
import * as WebIFC from './vendor/web-ifc/web-ifc-api.js?v=20261003';
import { sniff, prepare, cutModel, forEachElement, typeNamer, nameOf, MAX_BYTES } from './model.js?v=20261003';
import { createPacker } from './mesh3d.js?v=20261003';

export const DEFAULT_CUT_M = 1.1;

// Whether web-ifc reads this schema: IFC2X3, IFC4, IFC4X3 and their aliases (web-ifc's own list).
const supported = (W, schema) => (W.SchemaNames || []).some(names => Array.isArray(names) && names.includes(schema));

// loadApi: async () => ({ api, W }). Returns { boot, process(message) → { reply, transfer } }.
export function createSession(loadApi) {
  let booted = null;
  let open = null;                                            // { id, prep, name, origin }: the model kept for a re-cut
  const boot = () => booted || (booted = loadApi());
  const error = (id, reason, detail = '') => ({ reply: { type: 'error', id, reason, detail }, transfer: [] });

  async function process(m) {
    const { api, W } = await boot();
    const settings = m.settings || {};
    const cutM = Number.isFinite(settings.cutM) ? settings.cutM : DEFAULT_CUT_M;
    try {
      if (settings.recut) {
        if (!open) return error(m.id, 'stale');               // the worker restarted, or the last file failed
        const r = cutModel(api, W, open.id, open.prep, cutM);
        return { reply: { type: 'result', id: m.id, name: open.name, recut: true, cutM, file: r.file, storeys: r.storeys }, transfer: r.transfer };
      }
      if (settings.mesh3d) {
        if (!open) return error(m.id, 'stale');
        const max = Number.isFinite(settings.maxTriangles) && settings.maxTriangles > 0 ? settings.maxTriangles : Infinity;
        const pack = createPacker({ origin: open.origin, maxTriangles: max });
        forEachElement(api, W, open.id, typeNamer(api, open.id), ({ eid, type, layer, m: g }) => {
          pack.add({ layer, type, name: pack.over ? '' : nameOf(api, open.id, eid), storey: open.prep.storeyOf(eid), P: g.P, ix: g.ix });
        });
        const { body, transfer } = pack.finish();
        return { reply: { type: 'result', id: m.id, name: open.name, ...body }, transfer };
      }
      if (open) { try { api.CloseModel(open.id); } catch (e) { /* already gone */ } open = null; }
      if (!m.bytes || m.bytes.byteLength > MAX_BYTES) return error(m.id, 'limit');
      const bytes = new Uint8Array(m.bytes);
      const s = sniff(bytes);
      if (!s.ok) return error(m.id, s.reason, s.detail);
      const id = api.OpenModel(bytes, { COORDINATE_TO_ORIGIN: false });
      // web-ifc refuses a schema it does not know; refusing one it knows means the file itself is unreadable.
      if (id < 0) return supported(W, s.schema) ? error(m.id, 'read') : error(m.id, 'schema', s.schema);
      const prep = prepare(api, W, id);
      const r = cutModel(api, W, id, prep, cutM);
      if (!r.file.products && !r.file.rooms) { api.CloseModel(id); return error(m.id, 'empty'); }
      const b = r.file.bbox;
      open = { id, prep, name: m.name, origin: [b.x0, b.y0, b.z0] };
      return { reply: { type: 'result', id: m.id, name: m.name, recut: false, cutM, file: r.file, storeys: r.storeys }, transfer: r.transfer };
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
  await api.Init(file => new URL(`./vendor/web-ifc/${file}?v=20261003`, import.meta.url).href, true);
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
