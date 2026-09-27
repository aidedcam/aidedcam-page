// Module worker (spec §3.2): runs analyzeMill off the main thread so the page never freezes.
// Protocol: in { type: 'analyze', id, text, settings }; out { type: 'progress', id, done, total },
// { type: 'result', id, result } (typed-array buffers transferred, not copied) or
// { type: 'error', id, message }.
import { analyzeMill } from './analyze.js';

self.onmessage = e => {
  const { type, id, text, settings } = e.data || {};
  if (type !== 'analyze') return;
  try {
    const result = analyzeMill(text, settings, {
      onProgress: (done, total) => self.postMessage({ type: 'progress', id, done, total }),
    });
    const m = result.moves, li = result.lineIndex;
    self.postMessage({ type: 'result', id, result },
      [m.pos.buffer, m.kind.buffer, m.line.buffer, m.row.buffer, m.wofs.buffer, m.seconds.buffer,
        li.offsets.buffer, li.moves.buffer]);
  } catch (err) {
    self.postMessage({ type: 'error', id, message: String((err && err.message) || err) });
  }
};
