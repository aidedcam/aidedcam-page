// Laser DXF check: the page's side of the engine worker (spec §3, §12). Files are processed one at a
// time, in order. A file that takes longer than the timeout, crashes the worker, or ends in an engine
// error inside it gets an error result and the worker is restarted for the next file. makeWorker is
// injectable for the Node tests.
export const TIMEOUT_MS = 30000;

export function createEngine({
  makeWorker = () => new Worker(new URL('./worker.js?v=20261015', import.meta.url), { type: 'module' }),
  onBootProgress = () => {},
  onReady = () => {},
  timeoutMs = TIMEOUT_MS,
} = {}) {
  let worker = null, ready = false, started = false, disposed = false, nextId = 0, busy = null;
  const queue = [];

  function start() {
    worker = makeWorker();
    worker.onmessage = e => {
      const m = e.data;
      if (m.type === 'boot-progress') { onBootProgress(m.pct); return; }
      if (m.type === 'ready') { ready = true; if (!started) { started = true; onReady(); } arm(); return; }
      if (m.type === 'progress') return;                               // not an answer: keep waiting
      if (!busy || m.id !== busy.id) return;
      if (m.type === 'error' && m.reason === 'engine') { restart(); finish({ ...m, name: m.name || busy.name }); return; }   // the runtime inside may be dead
      finish(m);
    };
    worker.onerror = e => {
      if (e && e.preventDefault) e.preventDefault();
      if (busy) fail(busy, 'engine', (e && e.message) || 'worker error');
      else restart();
    };
  }

  function restart() {
    try { if (worker) worker.terminate(); } catch (e) { /* already gone */ }
    worker = null;
    ready = false;                                                  // the new worker boots again: the next file's timeout waits for its 'ready'
    if (!disposed) start();
  }

  function finish(m) {
    const job = busy;
    busy = null;
    clearTimeout(job.timer);
    job.resolve(m);
    pump();
  }

  function fail(job, reason, message) {
    restart();
    finish({ type: 'error', id: job.id, name: job.name, reason, message });
  }

  // The timeout starts once the engine is ready: the first file also waits for its download.
  function arm() {
    if (busy && !busy.timer) busy.timer = setTimeout(() => { if (busy) fail(busy, 'timeout', `over ${timeoutMs / 1000} s`); }, timeoutMs);
  }

  function pump() {
    if (disposed || busy || !queue.length) return;
    if (!worker) start();
    busy = queue.shift();
    if (ready) arm();
    worker.postMessage({ type: 'process', id: busy.id, name: busy.name, bytes: busy.bytes, settings: busy.settings }, [busy.bytes]);
  }

  return {
    // Resolves with the engine's result or error message (never rejects).
    process(name, bytes, settings = {}) {
      return new Promise(resolve => {
        queue.push({ id: ++nextId, name, bytes, settings, resolve, timer: null });
        pump();
      });
    },
    // Starts the engine download without a file, e.g. when the example order is requested.
    boot() { if (!worker) start(); worker.postMessage({ type: 'boot' }); },
    get ready() { return ready; },
    get pending() { return queue.length + (busy ? 1 : 0); },
    dispose() { disposed = true; if (busy) clearTimeout(busy.timer); try { if (worker) worker.terminate(); } catch (e) { /* ignore */ } worker = null; },
  };
}
