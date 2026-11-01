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
const UNIX_HOST = 3;
const FILE_TYPE_MASK = 0o170000;
const SYMLINK_TYPE = 0o120000;
// The characters Windows refuses in a file name; control characters are checked apart
const UNSAFE_NAME_CHARACTERS = /[\\:*?"<>|]/;

export interface ZipEntry {
  readonly name: string;
  readonly size: number;
  readonly compressedSize: number;
  readonly method: number;
  readonly encrypted: boolean;
  readonly localHeaderOffset: number;
  /** A symbolic link made on Unix: its content is the path it points at, never a file of the export. */
  readonly symlink: boolean;
  /** False when the name's bytes are not UTF-8 (a legacy code page), so `name` may not be what was written. */
  readonly utf8Name: boolean;
}

export class ZipFormatError extends Error {}

/** The archive goes past a limit the caller set (too many files, too large a directory). */
export class ZipLimitError extends Error {}

export interface ZipReadLimits {
  /** Most files and folders the archive may hold. */
  readonly maxEntries?: number;
  /** Largest central directory read into memory, in bytes. */
  readonly maxDirectoryBytes?: number;
}

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

function decodeName(decoder: TextDecoder, strict: TextDecoder, bytes: Uint8Array): { name: string; utf8Name: boolean } {
  try {
    return { name: strict.decode(bytes), utf8Name: true };
  } catch {
    return { name: decoder.decode(bytes), utf8Name: false };
  }
}

/**
 * The path of an archive file as a list of folder and file names, or null when it could reach outside
 * the folder it is extracted to or is not a plain name: an absolute path, a drive letter, `..`, a
 * backslash, or a control character.
 */
export function safeZipPath(name: string): string[] | null {
  const control = [...name].some((character) => character.charCodeAt(0) < 0x20 || character.charCodeAt(0) === 0x7f);
  if (name.startsWith('/') || control || UNSAFE_NAME_CHARACTERS.test(name)) {
    return null;
  }
  const segments = name.split('/').filter((segment) => segment !== '' && segment !== '.');
  return segments.length === 0 || segments.includes('..') ? null : segments;
}

/** Lists the files in an archive, skipping folders. */
export async function readZipEntries(blob: Blob, limits: ZipReadLimits = {}): Promise<ZipEntry[]> {
  const directory = await locateCentralDirectory(blob);
  if (directory.count > (limits.maxEntries ?? Number.POSITIVE_INFINITY)) {
    throw new ZipLimitError(`The archive holds ${directory.count} files`);
  }
  if (directory.size > (limits.maxDirectoryBytes ?? Number.POSITIVE_INFINITY)) {
    throw new ZipLimitError(`The archive directory takes ${directory.size} bytes`);
  }
  const view = await readView(blob, directory.offset, directory.offset + directory.size);
  const decoder = new TextDecoder();
  const strict = new TextDecoder('utf-8', { fatal: true });
  const entries: ZipEntry[] = [];

  let position = 0;
  for (let index = 0; index < directory.count; index++) {
    if (position + 46 > view.byteLength || view.getUint32(position, true) !== CENTRAL_DIRECTORY_HEADER) {
      throw new ZipFormatError('Damaged ZIP directory');
    }
    const host = view.getUint8(position + 5);
    const flags = view.getUint16(position + 8, true);
    const method = view.getUint16(position + 10, true);
    let compressedSize = view.getUint32(position + 20, true);
    let size = view.getUint32(position + 24, true);
    const nameLength = view.getUint16(position + 28, true);
    const extraLength = view.getUint16(position + 30, true);
    const commentLength = view.getUint16(position + 32, true);
    const unixMode = view.getUint32(position + 38, true) >>> 16;
    let localHeaderOffset = view.getUint32(position + 42, true);
    const { name, utf8Name } = decodeName(decoder, strict, new Uint8Array(view.buffer, view.byteOffset + position + 46, nameLength));

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
      entries.push({
        name,
        size,
        compressedSize,
        method,
        encrypted: (flags & 1) === 1,
        localHeaderOffset,
        symlink: host === UNIX_HOST && (unixMode & FILE_TYPE_MASK) === SYMLINK_TYPE,
        utf8Name,
      });
    }
    position = extraEnd + commentLength;
  }
  return entries;
}

/** Passes the bytes through, failing once there are more than `maxBytes` of them. */
function limitedTo(maxBytes: number, name: string): TransformStream<Uint8Array, Uint8Array> {
  let total = 0;
  return new TransformStream({
    transform(chunk, controller) {
      total += chunk.byteLength;
      if (total > maxBytes) {
        controller.error(new ZipFormatError(`${name} is larger than the archive says`));
        return;
      }
      controller.enqueue(chunk);
    },
  });
}

/**
 * Extracts one file from the archive. A compressed file may not grow past the size its directory
 * entry gives, so a crafted archive cannot unpack more than the caller checked it would.
 */
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
  const inflated = await new Response(
    data.stream().pipeThrough(new DecompressionStream('deflate-raw')).pipeThrough(limitedTo(entry.size, entry.name)),
  ).blob();
  return type ? new Blob([inflated], { type }) : inflated;
}

export async function readZipText(blob: Blob, entry: ZipEntry): Promise<string> {
  return (await readZipFile(blob, entry)).text();
}
