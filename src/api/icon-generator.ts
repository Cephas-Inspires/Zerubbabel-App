import zlib from 'node:zlib';

/**
 * Generates a valid in-memory PNG icon buffer of any size with Zerubbabel executive branding.
 */
export function generateAppIcon(size: number): Buffer {
  const crcTable = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c;
  }

  function crc32(buf: Buffer): number {
    let c = -1;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ -1) >>> 0;
  }

  function chunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.concat([t, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcBuf), 0);
    return Buffer.concat([len, t, data, crc]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowLen = 1 + size * 4;
  const raw = Buffer.alloc(rowLen * size);
  const half = size / 2;
  const badgeRadius = size * 0.44;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowLen;
    raw[rowOffset] = 0; // Filter: None
    for (let x = 0; x < size; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - half;
      const dy = y - half;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < badgeRadius) {
        // Deep executive gradient from Royal Blue to Sapphire (#1e40af to #3b82f6)
        const factor = y / size;
        raw[pxOffset] = Math.floor(30 + factor * 29);      // R: 30 -> 59
        raw[pxOffset + 1] = Math.floor(64 + factor * 66);  // G: 64 -> 130
        raw[pxOffset + 2] = Math.floor(175 + factor * 71); // B: 175 -> 246
        raw[pxOffset + 3] = 255;                           // Alpha
      } else {
        // Dark theme background #0b0f19
        raw[pxOffset] = 11;
        raw[pxOffset + 1] = 15;
        raw[pxOffset + 2] = 25;
        raw[pxOffset + 3] = 255;
      }
    }
  }

  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}
