import { test } from 'node:test';
import assert from 'node:assert/strict';

// The worker module only needs `self`: stand one in, import it, and drive its onmessage.
const posted = [];
globalThis.self = { postMessage: (msg, transfer) => posted.push({ msg, transfer }) };
await import('../../js/mill/worker.js');

test('analyze → one result message with all eight buffers transferred', () => {
  posted.length = 0;
  self.onmessage({ data: { type: 'analyze', id: 7, text: 'G0 X0 Y0 Z0\nG1 X10 F100', settings: {} } });
  assert.equal(posted.length, 1);
  const { msg, transfer } = posted[0];
  assert.equal(msg.type, 'result');
  assert.equal(msg.id, 7);
  assert.equal(msg.result.moves.count, 1);
  assert.equal(transfer.length, 8);
  assert.equal(new Set(transfer).size, 8);
});

test('progress messages come before the result on a long program', () => {
  posted.length = 0;
  self.onmessage({ data: { type: 'analyze', id: 1, text: 'G0 X0 Y0 Z0\n'.repeat(60000), settings: {} } });
  assert.deepEqual(posted.map(p => p.msg.type), ['progress', 'result']);
});

test('a throw becomes an error message; other message types are ignored', () => {
  posted.length = 0;
  self.onmessage({ data: { type: 'analyze', id: 2, text: 'G0 X0', settings: { get rapidX() { throw new Error('boom'); } } } });
  assert.deepEqual(posted.map(p => [p.msg.type, p.msg.message]), [['error', 'boom']]);
  posted.length = 0;
  self.onmessage({ data: { type: 'ping' } });
  assert.equal(posted.length, 0);
});
