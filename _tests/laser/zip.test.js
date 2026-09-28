import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, zipStore, uniqueNames } from '../../js/laser/zip.js';

const enc = new TextEncoder();

test('CRC-32 of the standard check string', () => {
  assert.equal(crc32(enc.encode('123456789')), 0xcbf43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test('the archive reads back: local headers, central directory with UTF-8 names, end record', () => {
  const files = [
    { name: 'πλάκα-laser.dxf', bytes: enc.encode('0\nSECTION\n0\nEOF\n') },
    { name: 'b.dxf', bytes: enc.encode('second') },
  ];
  const zip = zipStore(files);
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const dec = new TextDecoder();

  const endAt = zip.length - 22;
  assert.equal(v.getUint32(endAt, true), 0x06054b50);
  assert.equal(v.getUint16(endAt + 8, true), 2);
  assert.equal(v.getUint16(endAt + 10, true), 2);
  let cd = v.getUint32(endAt + 16, true);
  assert.equal(cd + v.getUint32(endAt + 12, true), endAt);

  for (const f of files) {
    assert.equal(v.getUint32(cd, true), 0x02014b50);
    assert.ok(v.getUint16(cd + 8, true) & 0x0800, 'UTF-8 flag');
    const nameLen = v.getUint16(cd + 28, true);
    assert.equal(dec.decode(zip.subarray(cd + 46, cd + 46 + nameLen)), f.name);
    assert.equal(v.getUint32(cd + 16, true), crc32(f.bytes));
    const local = v.getUint32(cd + 42, true);
    assert.equal(v.getUint32(local, true), 0x04034b50);
    assert.ok(v.getUint16(local + 6, true) & 0x0800);
    assert.equal(v.getUint16(local + 8, true), 0, 'stored');
    const size = v.getUint32(local + 18, true);
    const at = local + 30 + v.getUint16(local + 26, true);
    assert.deepEqual(zip.subarray(at, at + size), f.bytes);
    cd += 46 + nameLen;
  }
});

test('two files with the same name get distinct entries', () => {
  assert.deepEqual(uniqueNames(['a-laser.dxf', 'A-laser.dxf', 'b-laser.dxf', 'a-laser.dxf']),
    ['a-laser.dxf', 'A-laser (2).dxf', 'b-laser.dxf', 'a-laser (3).dxf']);
  assert.deepEqual(uniqueNames(['a (2).dxf', 'a.dxf', 'a.dxf']), ['a (2).dxf', 'a.dxf', 'a (3).dxf']);
  assert.deepEqual(uniqueNames(['noext', 'noext']), ['noext', 'noext (2)']);
});
