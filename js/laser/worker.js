// The laser engine's worker (spec §3). On the first message it boots the .NET runtime from ./engine/,
// fetching each .wasm as its gzip copy and unpacking it with the browser's DecompressionStream, so any
// static host works. Then it processes one file per 'process' message.
// The ?v= changes on every deploy: dotnet.js names the fingerprinted files of its own publish.
import { dotnet } from './engine/dotnet.js?v=20261015';

const COMPRESSED = new Set(['dotnetwasm', 'assembly', 'pdb', 'icu']);
let total = 0, loaded = 0;

function loadResource(type, name, defaultUri) {
  if (!COMPRESSED.has(type)) return defaultUri;                    // the small JS modules load as they are
  return fetch(defaultUri + '.gz').then(r => {
    if (!r.ok) throw new Error(`engine file missing: ${name}`);
    loaded += Number(r.headers.get('content-length') || 0);
    if (total) self.postMessage({ type: 'boot-progress', pct: Math.min(99, Math.round((100 * loaded) / total)) });
    const body = r.body.pipeThrough(new DecompressionStream('gzip'));
    return new Response(body, { headers: { 'content-type': type === 'dotnetwasm' ? 'application/wasm' : 'application/octet-stream' } });
  });
}

let api = null;
function boot() {
  if (!api) api = (async () => {
    try { total = (await (await fetch('./engine/manifest.json')).json()).bytes || 0; } catch (e) { total = 0; }
    const { getAssemblyExports, getConfig } = await dotnet.withResourceLoader(loadResource).create();
    const exports = await getAssemblyExports(getConfig().mainAssemblyName);
    self.postMessage({ type: 'ready' });
    return exports.Api;
  })();
  return api;
}

self.onmessage = async e => {
  const m = e.data;
  try {
    const engine = await boot();
    if (m.type !== 'process') return;
    self.postMessage({ type: 'progress', id: m.id, stage: 'processing' });
    const result = JSON.parse(engine.Process(new Uint8Array(m.bytes), m.name, JSON.stringify(m.settings || {})));
    result.id = m.id;
    if (result.type === 'result') {
      const dxf = engine.LastDxf();                                   // a copy owned by this worker
      result.dxf = dxf.buffer;
      self.postMessage(result, [dxf.buffer]);
    } else self.postMessage(result);
  } catch (err) {
    self.postMessage({ type: 'error', id: m.id, reason: 'engine', message: String((err && err.message) || err) });
  }
};
