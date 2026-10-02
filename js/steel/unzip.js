// Steel take-off: reads a .zip of NC1 files (spec §3, §7). The central directory names the entries; stored entries
// are copied and deflated ones go through the browser's DecompressionStream('deflate-raw') (Chrome, Firefox, Safari
// 16.4+, and Node). An encrypted entry, ZIP64 or any other method refuses the whole archive, naming the reason.
// Decompression is bounded by declared sizes to prevent zip bomb expansion. Returns { ok: true, files: [{ name, bytes }] }
// or { ok: false, reason: 'notzip' | 'encrypted' | 'zip64' | 'method' }.
const EOCD = 0x06054b50, CEN = 0x02014b50, LOC = 0x04034b50, EOCD64_LOCATOR = 0x07064b50;
const TOTAL_SIZE_LIMIT = 512 * 1024 * 1024; // 512 MB

// The entries of the central directory, or { reason } when the archive can't be read here.
export function zipEntries(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 22 - 65535); p--) {
    if (v.getUint32(p, true) === EOCD) { end = p; break; }
  }
  if (end < 0) return { reason: 'notzip' };
  if (end >= 20 && v.getUint32(end - 20, true) === EOCD64_LOCATOR) return { reason: 'zip64' };
  const count = v.getUint16(end + 10, true), size = v.getUint32(end + 12, true), at = v.getUint32(end + 16, true);
  if (count === 0xffff || size === 0xffffffff || at === 0xffffffff) return { reason: 'zip64' };
  if (at + size > end) return { reason: 'notzip' };
  const entries = [];
  const utf8 = new TextDecoder('utf-8'), latin1 = new TextDecoder('latin1');
  let totalSize = 0;
  for (let p = at, k = 0; k < count; k++) {
    if (p + 46 > bytes.length || v.getUint32(p, true) !== CEN) return { reason: 'notzip' };
    const flags = v.getUint16(p + 8, true), method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true), usize = v.getUint32(p + 24, true);
    const nameLen = v.getUint16(p + 28, true), extraLen = v.getUint16(p + 30, true), commentLen = v.getUint16(p + 32, true);
    const offset = v.getUint32(p + 42, true);
    const raw = bytes.subarray(p + 46, p + 46 + nameLen);
    const name = (flags & 0x800 ? utf8 : latin1).decode(raw);
    if (flags & 1) return { reason: 'encrypted' };
    if (csize === 0xffffffff || usize === 0xffffffff || offset === 0xffffffff) return { reason: 'zip64' };
    if (!name.endsWith('/')) {
      if (method !== 0 && method !== 8) return { reason: 'method' };
      totalSize += usize;
      if (totalSize > TOTAL_SIZE_LIMIT) return { reason: 'notzip' };
      entries.push({ name, method, csize, usize, offset });
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { entries };
}

// Raw deflate → bytes, through the browser's (or Node's) DecompressionStream, with an optional size limit.
// If maxSize is provided and the decompressed stream exceeds it, throws an error.
export async function inflateRaw(data, maxSize) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const out = [];
  let totalSize = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalSize += value.length;
      if (maxSize !== undefined && totalSize > maxSize) throw new Error('size limit exceeded');
      out.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of out) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  // If maxSize was provided, verify the final size matches exactly (for deflated entries, usize must match)
  if (maxSize !== undefined && result.length !== maxSize) throw new Error('size mismatch');
  return result;
}

export async function readZip(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dir = zipEntries(u8);
  if (dir.reason) return { ok: false, reason: dir.reason };
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const files = [];
  for (const e of dir.entries) {
    if (e.offset + 30 > u8.length || v.getUint32(e.offset, true) !== LOC) return { ok: false, reason: 'notzip' };
    const start = e.offset + 30 + v.getUint16(e.offset + 26, true) + v.getUint16(e.offset + 28, true);
    const data = u8.subarray(start, start + e.csize);
    if (data.length !== e.csize) return { ok: false, reason: 'notzip' };
    let out;
    try {
      if (e.method === 0) {
        // Stored entry: verify the data length matches the declared uncompressed size
        if (data.length !== e.usize) return { ok: false, reason: 'notzip' };
        out = data.slice();
      } else {
        // Deflated entry: decompress with size limit and verify final size
        out = await inflateRaw(data, e.usize);
      }
    } catch (err) { return { ok: false, reason: 'notzip' }; }
    files.push({ name: e.name, bytes: out });
  }
  return { ok: true, files };
}
