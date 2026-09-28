import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../../js/laser/bridge.js';

// A stand-in for the engine worker: boots (answers 'ready' once), then 'progress' and a result per file.
// A file named hang.dxf never answers; crash.dxf raises a worker error; bad.dxf gets a read error;
// abort.dxf gets an engine error (the .NET runtime exited) and from then on that worker answers every file
// with the same engine error. A restarted worker (every one after the first) takes rebootMs to boot, like
// the real engine loading again.
function fakeWorkers({ rebootMs = 0 } = {}) {
  const made = [];
  const makeWorker = () => {
    const delay = made.length ? rebootMs : 0;
    const w = {
      terminated: false, aborted: false, booted: null, onmessage: null, onerror: null,
      post(m) { if (!w.terminated) w.onmessage({ data: m }); },
      postMessage(m) {
        if (!w.booted) w.booted = new Promise(r => setTimeout(r, delay)).then(() => w.post({ type: 'ready' }));
        w.booted.then(() => {
          if (m.type !== 'process' || w.terminated || m.name === 'hang.dxf') return;
          if (m.name === 'crash.dxf') { w.onerror({ message: 'boom', preventDefault() {} }); return; }
          if (m.name === 'abort.dxf') w.aborted = true;
          if (w.aborted) { w.post({ type: 'error', id: m.id, reason: 'engine', message: 'runtime exited' }); return; }
          if (m.name === 'bad.dxf') { w.post({ type: 'error', id: m.id, name: m.name, reason: 'read', message: 'not a DXF' }); return; }
          w.post({ type: 'progress', id: m.id, stage: 'processing' });
          w.post({ type: 'result', id: m.id, name: m.name });
        });
      },
      terminate() { w.terminated = true; },
    };
    made.push(w);
    return w;
  };
  return { made, makeWorker };
}

test('files come back in order, progress messages are not answers', async () => {
  const { made, makeWorker } = fakeWorkers();
  let readyCalls = 0;
  const engine = createEngine({ makeWorker, onReady: () => readyCalls++ });
  const [a, b] = await Promise.all([engine.process('a.dxf', new ArrayBuffer(1)), engine.process('b.dxf', new ArrayBuffer(1))]);
  assert.equal(a.type, 'result'); assert.equal(a.name, 'a.dxf');
  assert.equal(b.type, 'result'); assert.equal(b.name, 'b.dxf');
  assert.equal(made.length, 1);
  assert.equal(readyCalls, 1);
  assert.equal(engine.ready, true);
  assert.equal(engine.pending, 0);
  engine.dispose();
});

test('a file over the timeout gets an error and the next file still works', async () => {
  const { made, makeWorker } = fakeWorkers();
  const engine = createEngine({ makeWorker, timeoutMs: 50 });
  await engine.process('warm.dxf', new ArrayBuffer(1));
  const [hung, next] = await Promise.all([engine.process('hang.dxf', new ArrayBuffer(1)), engine.process('c.dxf', new ArrayBuffer(1))]);
  assert.equal(hung.type, 'error'); assert.equal(hung.reason, 'timeout'); assert.equal(hung.name, 'hang.dxf');
  assert.equal(next.type, 'result'); assert.equal(next.name, 'c.dxf');
  assert.equal(made.length, 2);
  assert.equal(made[0].terminated, true);
  engine.dispose();
});

test('a worker crash gets an error and the next file still works', async () => {
  const { made, makeWorker } = fakeWorkers();
  const engine = createEngine({ makeWorker });
  const [crashed, next] = await Promise.all([engine.process('crash.dxf', new ArrayBuffer(1)), engine.process('d.dxf', new ArrayBuffer(1))]);
  assert.equal(crashed.type, 'error'); assert.equal(crashed.reason, 'engine'); assert.equal(crashed.message, 'boom');
  assert.equal(next.type, 'result'); assert.equal(next.name, 'd.dxf');
  assert.equal(made.length, 2);
  engine.dispose();
});

test('after a restart, the next file waits for the new engine to be ready before its timeout starts', async () => {
  const { made, makeWorker } = fakeWorkers({ rebootMs: 120 });
  const engine = createEngine({ makeWorker, timeoutMs: 50 });
  const [crashed, next] = await Promise.all([engine.process('crash.dxf', new ArrayBuffer(1)), engine.process('e.dxf', new ArrayBuffer(1))]);
  assert.equal(crashed.reason, 'engine');
  assert.equal(next.type, 'result'); assert.equal(next.name, 'e.dxf');
  assert.equal(made.length, 2);
  engine.dispose();
});

test('dispose stops a pending timeout from starting a new engine', async () => {
  const { made, makeWorker } = fakeWorkers();
  const engine = createEngine({ makeWorker, timeoutMs: 30 });
  await engine.process('warm.dxf', new ArrayBuffer(1));
  engine.process('hang.dxf', new ArrayBuffer(1));
  await new Promise(r => setTimeout(r, 0));
  engine.dispose();
  await new Promise(r => setTimeout(r, 80));
  assert.equal(made.length, 1);
});

test('an engine error from inside the worker restarts it and the next file works', async () => {
  const { made, makeWorker } = fakeWorkers();
  const engine = createEngine({ makeWorker });
  const [aborted, next] = await Promise.all([engine.process('abort.dxf', new ArrayBuffer(1)), engine.process('f.dxf', new ArrayBuffer(1))]);
  assert.equal(aborted.type, 'error'); assert.equal(aborted.reason, 'engine');
  assert.equal(next.type, 'result'); assert.equal(next.name, 'f.dxf');
  assert.equal(made.length, 2);
  assert.equal(made[0].terminated, true);
  engine.dispose();
});

test('a read error does not restart the worker', async () => {
  const { made, makeWorker } = fakeWorkers();
  const engine = createEngine({ makeWorker });
  const [bad, next] = await Promise.all([engine.process('bad.dxf', new ArrayBuffer(1)), engine.process('g.dxf', new ArrayBuffer(1))]);
  assert.equal(bad.type, 'error'); assert.equal(bad.reason, 'read');
  assert.equal(next.type, 'result');
  assert.equal(made.length, 1);
  engine.dispose();
});
