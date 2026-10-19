import { crc32, deflateRawSync } from 'node:zlib';

const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP64_END_OF_CENTRAL_DIRECTORY = 0x06064b50;
const ZIP64_END_LOCATOR = 0x07064b50;
const ZIP64_EXTRA_FIELD = 0x0001;
const UTF8_NAMES = 0x0800;
const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;
const VERSION_DEFAULT = 20;
const VERSION_ZIP64 = 45;
const MAX_UINT16 = 0xffff;
const MAX_UINT32 = 0xffffffff;

export type ZipSink = (chunk: Buffer) => Promise<void>;

export interface ZipWriterOptions {
  modifiedAt?: Date;
  /** Offsets at or past this switch to ZIP64 records; only tests lower it. */
  zip64Offset?: number;
}

interface CentralRecord {
  name: Buffer;
  crc: number;
  method: number;
  compressedSize: number;
  size: number;
  offset: number;
}

function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(date.getUTCFullYear(), 1980);
  return {
    time: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
  };
}

/**
 * Writes a ZIP archive one file at a time, so only the current file is held in
 * memory. Sizes and checksums go in each local header; ZIP64 records are added
 * once the archive passes 4 GB or 65,535 files.
 */
export class ZipWriter {
  private offset = 0;
  private readonly records: CentralRecord[] = [];
  private readonly time: number;
  private readonly date: number;
  private readonly zip64Offset: number;

  constructor(
    private readonly sink: ZipSink,
    options: ZipWriterOptions = {},
  ) {
    const stamp = dosDateTime(options.modifiedAt ?? new Date());
    this.time = stamp.time;
    this.date = stamp.date;
    this.zip64Offset = options.zip64Offset ?? MAX_UINT32;
  }

  get fileCount(): number {
    return this.records.length;
  }

  /** Text compresses well; photos and recordings are already compressed, so pass `compress: false`. */
  async addFile(name: string, data: Buffer | string, options: { compress?: boolean } = {}): Promise<void> {
    const raw = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    if (raw.length >= MAX_UINT32) {
      throw new RangeError(`${name} is too large for a ZIP entry`);
    }

    const deflated = options.compress === false ? null : deflateRawSync(raw);
    const useDeflate = deflated !== null && deflated.length < raw.length;
    const body = useDeflate ? deflated : raw;
    const record: CentralRecord = {
      name: Buffer.from(name, 'utf8'),
      crc: crc32(raw),
      method: useDeflate ? METHOD_DEFLATE : METHOD_STORE,
      compressedSize: body.length,
      size: raw.length,
      offset: this.offset,
    };

    const header = Buffer.alloc(30);
    header.writeUInt32LE(LOCAL_FILE_HEADER, 0);
    header.writeUInt16LE(VERSION_DEFAULT, 4);
    header.writeUInt16LE(UTF8_NAMES, 6);
    header.writeUInt16LE(record.method, 8);
    header.writeUInt16LE(this.time, 10);
    header.writeUInt16LE(this.date, 12);
    header.writeUInt32LE(record.crc, 14);
    header.writeUInt32LE(record.compressedSize, 18);
    header.writeUInt32LE(record.size, 22);
    header.writeUInt16LE(record.name.length, 26);
    header.writeUInt16LE(0, 28);

    await this.write(Buffer.concat([header, record.name]));
    await this.write(body);
    this.records.push(record);
  }

  /** Writes the central directory; the archive is complete once this resolves. */
  async finish(): Promise<void> {
    const directoryOffset = this.offset;
    for (const record of this.records) {
      await this.write(this.centralRecord(record));
    }
    const directorySize = this.offset - directoryOffset;
    const needsZip64 =
      this.records.length >= MAX_UINT16 || directoryOffset >= this.zip64Offset || directorySize >= MAX_UINT32;

    if (needsZip64) {
      const zip64RecordOffset = this.offset;
      const zip64Record = Buffer.alloc(56);
      zip64Record.writeUInt32LE(ZIP64_END_OF_CENTRAL_DIRECTORY, 0);
      zip64Record.writeBigUInt64LE(44n, 4);
      zip64Record.writeUInt16LE(VERSION_ZIP64, 12);
      zip64Record.writeUInt16LE(VERSION_ZIP64, 14);
      zip64Record.writeBigUInt64LE(BigInt(this.records.length), 24);
      zip64Record.writeBigUInt64LE(BigInt(this.records.length), 32);
      zip64Record.writeBigUInt64LE(BigInt(directorySize), 40);
      zip64Record.writeBigUInt64LE(BigInt(directoryOffset), 48);

      const locator = Buffer.alloc(20);
      locator.writeUInt32LE(ZIP64_END_LOCATOR, 0);
      locator.writeBigUInt64LE(BigInt(zip64RecordOffset), 8);
      locator.writeUInt32LE(1, 16);
      await this.write(Buffer.concat([zip64Record, locator]));
    }

    const end = Buffer.alloc(22);
    end.writeUInt32LE(END_OF_CENTRAL_DIRECTORY, 0);
    end.writeUInt16LE(needsZip64 ? MAX_UINT16 : this.records.length, 8);
    end.writeUInt16LE(needsZip64 ? MAX_UINT16 : this.records.length, 10);
    end.writeUInt32LE(needsZip64 ? MAX_UINT32 : directorySize, 12);
    end.writeUInt32LE(needsZip64 ? MAX_UINT32 : directoryOffset, 16);
    await this.write(end);
  }

  private centralRecord(record: CentralRecord): Buffer {
    const zip64 = record.offset >= this.zip64Offset;
    const extra = Buffer.alloc(zip64 ? 12 : 0);
    if (zip64) {
      extra.writeUInt16LE(ZIP64_EXTRA_FIELD, 0);
      extra.writeUInt16LE(8, 2);
      extra.writeBigUInt64LE(BigInt(record.offset), 4);
    }

    const header = Buffer.alloc(46);
    header.writeUInt32LE(CENTRAL_DIRECTORY_HEADER, 0);
    header.writeUInt16LE(zip64 ? VERSION_ZIP64 : VERSION_DEFAULT, 4);
    header.writeUInt16LE(zip64 ? VERSION_ZIP64 : VERSION_DEFAULT, 6);
    header.writeUInt16LE(UTF8_NAMES, 8);
    header.writeUInt16LE(record.method, 10);
    header.writeUInt16LE(this.time, 12);
    header.writeUInt16LE(this.date, 14);
    header.writeUInt32LE(record.crc, 16);
    header.writeUInt32LE(record.compressedSize, 20);
    header.writeUInt32LE(record.size, 24);
    header.writeUInt16LE(record.name.length, 28);
    header.writeUInt16LE(extra.length, 30);
    header.writeUInt32LE(zip64 ? MAX_UINT32 : record.offset, 42);
    return Buffer.concat([header, record.name, extra]);
  }

  private async write(chunk: Buffer): Promise<void> {
    await this.sink(chunk);
    this.offset += chunk.length;
  }
}
