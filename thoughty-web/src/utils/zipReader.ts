// Reads ZIP archives straight from a File: only the central directory and the
// file being extracted are loaded, so multi-gigabyte exports stay usable.

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP64_END_OF_CENTRAL_DIRECTORY = 0x06064b50;
const ZIP64_END_LOCATOR = 0x07064b50;
const CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;
const ZIP64_EXTRA_FIELD = 0x0001;
const MAX_UINT16 = 0xffff;
const MAX_UINT32 = 0xffffffff;
const END_RECORD_SIZE = 22;
const MAX_COMMENT_SIZE = 0xffff;

export interface ZipEntry {
  readonly name: string;
  readonly size: number;
  readonly compressedSize: number;
  readonly method: number;
  readonly encrypted: boolean;
  readonly localHeaderOffset: number;
}

export class ZipFormatError extends Error {}

async function readView(blob: Blob, start: number, end: number): Promise<DataView> {
  return new DataView(await blob.slice(start, end).arrayBuffer());
}

function readUint64(view: DataView, offset: number): number {
  return Number(view.getBigUint64(offset, true));
}

async function locateCentralDirectory(blob: Blob): Promise<{ offset: number; size: number; count: number }> {
  const tailStart = Math.max(0, blob.size - END_RECORD_SIZE - MAX_COMMENT_SIZE - 20);
  const tail = await readView(blob, tailStart, blob.size);
  let end = -1;
  for (let position = tail.byteLength - END_RECORD_SIZE; position >= 0; position--) {
    if (tail.getUint32(position, true) === END_OF_CENTRAL_DIRECTORY) {
      end = position;
      break;
    }
  }
  if (end < 0) {
    throw new ZipFormatError('Not a ZIP archive');
  }

  const count = tail.getUint16(end + 10, true);
  const size = tail.getUint32(end + 12, true);
  const offset = tail.getUint32(end + 16, true);
  if (count !== MAX_UINT16 && size !== MAX_UINT32 && offset !== MAX_UINT32) {
    return { offset, size, count };
  }

  const locator = end - 20;
  if (locator < 0 || tail.getUint32(locator, true) !== ZIP64_END_LOCATOR) {
    throw new ZipFormatError('Missing ZIP64 end record');
  }
  const recordOffset = readUint64(tail, locator + 8);
  const record = await readView(blob, recordOffset, recordOffset + 56);
  if (record.getUint32(0, true) !== ZIP64_END_OF_CENTRAL_DIRECTORY) {
    throw new ZipFormatError('Damaged ZIP64 end record');
  }
  return { count: readUint64(record, 32), size: readUint64(record, 40), offset: readUint64(record, 48) };
}

/** Lists the files in an archive, skipping folders. */
export async function readZipEntries(blob: Blob): Promise<ZipEntry[]> {
  const directory = await locateCentralDirectory(blob);
  const view = await readView(blob, directory.offset, directory.offset + directory.size);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];

  let position = 0;
  for (let index = 0; index < directory.count; index++) {
    if (position + 46 > view.byteLength || view.getUint32(position, true) !== CENTRAL_DIRECTORY_HEADER) {
      throw new ZipFormatError('Damaged ZIP directory');
    }
    const flags = view.getUint16(position + 8, true);
    const method = view.getUint16(position + 10, true);
    let compressedSize = view.getUint32(position + 20, true);
    let size = view.getUint32(position + 24, true);
    const nameLength = view.getUint16(position + 28, true);
    const extraLength = view.getUint16(position + 30, true);
    const commentLength = view.getUint16(position + 32, true);
    let localHeaderOffset = view.getUint32(position + 42, true);
    const name = decoder.decode(new Uint8Array(view.buffer, view.byteOffset + position + 46, nameLength));

    // ZIP64 sizes and offsets follow in this order, only for the fields that overflowed
    let extra = position + 46 + nameLength;
    const extraEnd = extra + extraLength;
    while (extra + 4 <= extraEnd) {
      const fieldId = view.getUint16(extra, true);
      const fieldSize = view.getUint16(extra + 2, true);
      if (fieldId === ZIP64_EXTRA_FIELD) {
        let field = extra + 4;
        if (size === MAX_UINT32) {
          size = readUint64(view, field);
          field += 8;
        }
        if (compressedSize === MAX_UINT32) {
          compressedSize = readUint64(view, field);
          field += 8;
        }
        if (localHeaderOffset === MAX_UINT32) {
          localHeaderOffset = readUint64(view, field);
        }
      }
      extra += 4 + fieldSize;
    }

    if (!name.endsWith('/')) {
      entries.push({ name, size, compressedSize, method, encrypted: (flags & 1) === 1, localHeaderOffset });
    }
    position = extraEnd + commentLength;
  }
  return entries;
}

/** Extracts one file from the archive. */
export async function readZipFile(blob: Blob, entry: ZipEntry, type = ''): Promise<Blob> {
  if (entry.encrypted) {
    throw new ZipFormatError(`${entry.name} is encrypted`);
  }
  const header = await readView(blob, entry.localHeaderOffset, entry.localHeaderOffset + 30);
  if (header.getUint32(0, true) !== LOCAL_FILE_HEADER) {
    throw new ZipFormatError(`Damaged ZIP entry ${entry.name}`);
  }
  const dataStart = entry.localHeaderOffset + 30 + header.getUint16(26, true) + header.getUint16(28, true);
  const data = blob.slice(dataStart, dataStart + entry.compressedSize, type);

  if (entry.method === 0) {
    return data;
  }
  if (entry.method !== 8) {
    throw new ZipFormatError(`${entry.name} uses an unsupported compression method`);
  }
  const inflated = await new Response(data.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
  return type ? new Blob([inflated], { type }) : inflated;
}

export async function readZipText(blob: Blob, entry: ZipEntry): Promise<string> {
  return (await readZipFile(blob, entry)).text();
}
