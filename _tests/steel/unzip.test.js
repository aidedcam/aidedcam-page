import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipStore } from '../../js/laser/zip.js';
import { readZip, zipEntries, inflateRaw } from '../../js/steel/unzip.js';

const enc = s => new TextEncoder().encode(s);
const dec = b => new TextDecoder().decode(b);
async function deflateRaw(bytes) {
  const s = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

// A small ZIP writer for the tests: entries { name, data, method (0 or 8), flags }, sizes and CRC as given.
async function zip(entries) {
  const parts = [], cen = [];
  let off = 0;
  for (const e of entries) {
    const raw = enc(e.data), body = e.method === 8 ? await deflateRaw(raw) : raw;
    const name = enc(e.name), h = new Uint8Array(30 + name.length), v = new DataView(h.buffer);
    v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, e.flags || 0, true); v.setUint16(8, e.method, true);
    v.setUint32(18, body.length, true); v.setUint32(22, raw.length, true); v.setUint16(26, name.length, true); h.set(name, 30);
    const c = new Uint8Array(46 + name.length), w = new DataView(c.buffer);
    w.setUint32(0, 0x02014b50, true); w.setUint16(6, 20, true); w.setUint16(8, e.flags || 0, true); w.setUint16(10, e.method, true);
    w.setUint32(20, e.csize ?? body.length, true); w.setUint32(24, raw.length, true); w.setUint16(28, name.length, true); w.setUint32(42, off, true); c.set(name, 46);
    parts.push(h, body); cen.push(c);
    off += h.length + body.length;
  }
  const size = cen.reduce((a, c) => a + c.length, 0), end = new Uint8Array(22), x = new DataView(end.buffer);
  x.setUint32(0, 0x06054b50, true); x.setUint16(8, entries.length, true); x.setUint16(10, entries.length, true); x.setUint32(12, size, true); x.setUint32(16, off, true);
  const all = [...parts, ...cen, end], out = new Uint8Array(all.reduce((a, p) => a + p.length, 0));
  let p = 0; for (const a of all) { out.set(a, p); p += a.length; }
  return out;
}

test('stored entries (the laser tool\'s writer): names and bytes back, folders left out', async () => {
  const bytes = zipStore([{ name: 'P1.nc1', bytes: enc('ST\r\n  P1\r\n') }, { name: 'sub/P2.NC1', bytes: enc('ST\n') }]);
  const r = await readZip(bytes);
  assert.equal(r.ok, true);
  assert.deepEqual(r.files.map(f => [f.name, dec(f.bytes)]), [['P1.nc1', 'ST\r\n  P1\r\n'], ['sub/P2.NC1', 'ST\n']]);
  const z = await readZip(await zip([{ name: 'dir/', data: '', method: 0 }, { name: 'dir/a.nc1', data: 'ST', method: 0 }]));
  assert.deepEqual(z.files.map(f => f.name), ['dir/a.nc1']);
});

test('deflated entries through DecompressionStream(\'deflate-raw\')', async () => {
  const text = 'ST\n' + '  HEA200\n'.repeat(500);
  const r = await readZip(await zip([{ name: 'big.nc1', data: text, method: 8 }, { name: 'small.nc', data: 'ST\n', method: 0 }]));
  assert.equal(r.ok, true);
  assert.equal(dec(r.files[0].bytes), text);
  assert.equal(dec(r.files[1].bytes), 'ST\n');
  assert.equal(dec(await inflateRaw(await deflateRaw(enc('abc')))), 'abc');
});

test('refused, naming the reason: another method, encryption, ZIP64, not a ZIP', async () => {
  assert.deepEqual(await readZip(await zip([{ name: 'a.nc1', data: 'ST', method: 12 }])), { ok: false, reason: 'method' });
  assert.deepEqual(await readZip(await zip([{ name: 'a.nc1', data: 'ST', method: 0, flags: 1 }])), { ok: false, reason: 'encrypted' });
  assert.deepEqual(await readZip(await zip([{ name: 'a.nc1', data: 'ST', method: 0, csize: 0xffffffff }])), { ok: false, reason: 'zip64' });
  assert.deepEqual(await readZip(enc('ST\n  not a zip at all, just text\n')), { ok: false, reason: 'notzip' });
  const bad = await zip([{ name: 'a.nc1', data: 'ST'.repeat(50), method: 8 }]);
  bad[34] ^= 0xff; bad[35] ^= 0xff; bad[36] ^= 0xff;                         // the deflate stream damaged
  assert.deepEqual(await readZip(bad), { ok: false, reason: 'notzip' });
  assert.deepEqual(zipEntries(new Uint8Array(10)), { reason: 'notzip' });
});

test('bounded decompression: an entry that lies about its size (deflates to more than usize) is notzip', async () => {
  const text = 'ST\n' + 'x'.repeat(1000);
  const z = await zip([{ name: 'a.nc1', data: text, method: 8, usize: 10 }]); // lie: say it's 10 bytes
  // The zip builder doesn't support usize override in the central directory, so we'll hack it in:
  const v = new DataView(z.buffer);
  // Find the central directory entry for 'a.nc1' and change its usize field (offset 24 from CEN start)
  let cenPos = -1;
  for (let i = 0; i < z.length - 46; i++) {
    if (v.getUint32(i, true) === 0x02014b50) { cenPos = i; break; }
  }
  if (cenPos >= 0) v.setUint32(cenPos + 24, 10, true);
  assert.deepEqual(await readZip(z), { ok: false, reason: 'notzip' });
});

test('bounded decompression: stored entry where data.length !== usize is notzip', async () => {
  const z = await zip([{ name: 'a.nc1', data: 'ST', method: 0, usize: 10 }]);
  const v = new DataView(z.buffer);
  let cenPos = -1;
  for (let i = 0; i < z.length - 46; i++) {
    if (v.getUint32(i, true) === 0x02014b50) { cenPos = i; break; }
  }
  if (cenPos >= 0) v.setUint32(cenPos + 24, 10, true);
  assert.deepEqual(await readZip(z), { ok: false, reason: 'notzip' });
});

test('total size limit: an archive whose entries\' declared sizes sum > 512 MB is notzip', async () => {
  const z = await zip([{ name: 'a.nc1', data: 'ST', method: 0 }, { name: 'b.nc1', data: 'ST', method: 0 }]);
  const v = new DataView(z.buffer);
  // Find both central directory entries and set their usize fields so the sum exceeds 512 MB
  const positions = [];
  for (let i = 0; i < z.length - 46; i++) {
    if (v.getUint32(i, true) === 0x02014b50) positions.push(i);
  }
  if (positions.length >= 2) {
    v.setUint32(positions[0] + 24, 256 * 1024 * 1024 + 1, true);
    v.setUint32(positions[1] + 24, 256 * 1024 * 1024 + 1, true);
  }
  assert.deepEqual(await readZip(z), { ok: false, reason: 'notzip' });
});

test('truncated central directory is notzip', async () => {
  const z = await zip([{ name: 'a.nc1', data: 'ST', method: 0 }]);
  const truncated = z.subarray(0, z.length - 10);
  assert.deepEqual(await readZip(truncated), { ok: false, reason: 'notzip' });
});

test('bad local file header signature is notzip', async () => {
  const z = await zip([{ name: 'a.nc1', data: 'ST', method: 0 }]);
  const v = new DataView(z.buffer);
  // Corrupt the local file header signature
  for (let i = 0; i < z.length - 4; i++) {
    if (v.getUint32(i, true) === 0x04034b50) {
      v.setUint32(i, 0xdeadbeef, true);
      break;
    }
  }
  assert.deepEqual(await readZip(z), { ok: false, reason: 'notzip' });
});
