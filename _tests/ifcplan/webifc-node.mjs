// Loads the vendored browser build of web-ifc (js/ifcplan/vendor/web-ifc/) in Node, for the tests. That build is
// compiled for the web only: it refuses to start when it sees Node's `process`, wants a `window`, and fetches its
// .wasm. So, during Init only, `process` is hidden, `window` is set, and fetch answers with the vendored .wasm. The
// tests then run the same engine bytes the page serves.
import { readFileSync } from 'node:fs';

const DIR = new URL('../../js/ifcplan/vendor/web-ifc/', import.meta.url);

export async function openApi() {
  const W = await import(new URL('web-ifc-api.js', DIR).href);
  const api = new W.IfcAPI();
  const wasm = readFileSync(new URL('web-ifc.wasm', DIR));
  const saved = { process: globalThis.process, fetch: globalThis.fetch };
  globalThis.window = globalThis;
  globalThis.fetch = async () => new Response(wasm, { headers: { 'content-type': 'application/wasm' } });
  Object.defineProperty(globalThis, 'process', { value: undefined, configurable: true, writable: true });
  try {
    await api.Init(p => `http://vendor.invalid/${p}`, true);
  } finally {
    Object.defineProperty(globalThis, 'process', { value: saved.process, configurable: true, writable: true });
    globalThis.fetch = saved.fetch;
    delete globalThis.window;
  }
  api.SetLogLevel(W.LogLevel.LOG_LEVEL_OFF);
  return { api, W };
}
