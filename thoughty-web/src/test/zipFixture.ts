// Builds small ZIP archives for tests, using only APIs that browsers and Node
// share, so unit tests and Playwright specs can both use it.

export interface ZipFixtureFile {
  name: string;
  data: string | Uint8Array;
  /** Stored files are copied as they are; others are deflated. */
  store?: boolean;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function record(size: number, write: (view: DataView) => void): Uint8Array {
  const bytes = new Uint8Array(size);
  write(new DataView(bytes.buffer));
  return bytes;
}

export async function buildZip(files: ZipFixtureFile[], options: { zip64?: boolean } = {}): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const raw = typeof file.data === 'string' ? encoder.encode(file.data) : file.data;
    const body = file.store ? raw : await deflateRaw(raw);
    const name = encoder.encode(file.name);
    const checksum = crc32(raw);
    const method = file.store ? 0 : 8;

    parts.push(record(30, (view) => {
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0x0800, true);
      view.setUint16(8, method, true);
      view.setUint32(14, checksum, true);
      view.setUint32(18, body.length, true);
      view.setUint32(22, raw.length, true);
      view.setUint16(26, name.length, true);
    }), name, body);

    const extra = options.zip64
      ? record(28, (view) => {
        view.setUint16(0, 0x0001, true);
        view.setUint16(2, 24, true);
        view.setBigUint64(4, BigInt(raw.length), true);
        view.setBigUint64(12, BigInt(body.length), true);
        view.setBigUint64(20, BigInt(offset), true);
      })
      : new Uint8Array(0);
    central.push(record(46, (view) => {
      view.setUint32(0, 0x02014b50, true);
      view.setUint16(4, 45, true);
      view.setUint16(6, 45, true);
      view.setUint16(8, 0x0800, true);
      view.setUint16(10, method, true);
      view.setUint32(16, checksum, true);
      view.setUint32(20, options.zip64 ? 0xffffffff : body.length, true);
      view.setUint32(24, options.zip64 ? 0xffffffff : raw.length, true);
      view.setUint16(28, name.length, true);
      view.setUint16(30, extra.length, true);
      view.setUint32(42, options.zip64 ? 0xffffffff : offset, true);
    }), name, extra);

    offset += 30 + name.length + body.length;
  }

  const directorySize = central.reduce((sum, part) => sum + part.length, 0);
  const tail: Uint8Array[] = [];
  if (options.zip64) {
    tail.push(
      record(56, (view) => {
        view.setUint32(0, 0x06064b50, true);
        view.setBigUint64(4, 44n, true);
        view.setBigUint64(24, BigInt(files.length), true);
        view.setBigUint64(32, BigInt(files.length), true);
        view.setBigUint64(40, BigInt(directorySize), true);
        view.setBigUint64(48, BigInt(offset), true);
      }),
      record(20, (view) => {
        view.setUint32(0, 0x07064b50, true);
        view.setBigUint64(8, BigInt(offset + directorySize), true);
        view.setUint32(16, 1, true);
      }),
    );
  }
  tail.push(record(22, (view) => {
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, options.zip64 ? 0xffff : files.length, true);
    view.setUint16(10, options.zip64 ? 0xffff : files.length, true);
    view.setUint32(12, options.zip64 ? 0xffffffff : directorySize, true);
    view.setUint32(16, options.zip64 ? 0xffffffff : offset, true);
  }));

  return new Uint8Array(await new Blob([...parts, ...central, ...tail] as BlobPart[]).arrayBuffer());
}
