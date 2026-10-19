import { readZipEntries, readZipText, ZipFormatError, type ZipEntry } from '../../../utils/zipReader';
import { baseName } from './appImportMedia';
import type { AppExport, ImportedEntry } from './appImportTypes';
import { isDayOneJournal, parseDayOneJournal, type DayOneMediaLookup } from './dayOne';
import { isJourneyEntry, JOURNEY_JOURNAL, parseJourneyEntry } from './journey';

/** The file is neither a Day One nor a Journey export. */
export class UnsupportedExportError extends Error {}

const ZIP_SIGNATURE = [0x50, 0x4b];
const JOURNEY_READ_CONCURRENCY = 8;

function isMetadataFile(path: string): boolean {
  return path.startsWith('__MACOSX/') || baseName(path).startsWith('._');
}

function stem(path: string): string {
  const name = baseName(path);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function byTime(entries: ImportedEntry[]): ImportedEntry[] {
  return entries.sort((first, second) => first.timestamp - second.timestamp);
}

async function readDayOneArchive(archive: Blob, files: ZipEntry[], journalFiles: ZipEntry[], first: unknown): Promise<AppExport> {
  const media = new Map<string, ZipEntry>();
  for (const file of files) {
    const folders = file.name.split('/').slice(0, -1);
    const folder = folders.at(-1)?.toLowerCase();
    if (folder) {
      media.set(`${folder}/${stem(file.name).toLowerCase()}`, file);
    }
  }
  const lookup: DayOneMediaLookup = (folder, md5) => media.get(`${folder}/${md5}`);

  const entries: ImportedEntry[] = [];
  const journals: string[] = [];
  let skippedMedia = 0;
  for (const [position, file] of journalFiles.entries()) {
    const data = position === 0 ? first : parseJson(await readZipText(archive, file));
    if (!isDayOneJournal(data)) {
      continue;
    }
    const journal = stem(file.name);
    const parsed = parseDayOneJournal(data, journal, lookup);
    entries.push(...parsed.entries);
    skippedMedia += parsed.skippedMedia;
    journals.push(journal);
  }
  return { source: 'dayone', archive, entries: byTime(entries), journals, skippedMedia };
}

async function readJourneyArchive(archive: Blob, files: ZipEntry[], entryFiles: ZipEntry[]): Promise<AppExport> {
  const photos = new Map(files.map((file) => [baseName(file.name).toLowerCase(), file]));
  const entries: ImportedEntry[] = [];
  let skippedMedia = 0;

  for (let start = 0; start < entryFiles.length; start += JOURNEY_READ_CONCURRENCY) {
    const texts = await Promise.all(
      entryFiles.slice(start, start + JOURNEY_READ_CONCURRENCY).map((file) => readZipText(archive, file)),
    );
    texts.forEach((text, offset) => {
      const data = parseJson(text);
      if (isJourneyEntry(data)) {
        const parsed = parseJourneyEntry(data, stem(entryFiles[start + offset]!.name), (name) => photos.get(name));
        entries.push(parsed.entry);
        skippedMedia += parsed.skippedMedia;
      }
    });
  }
  return { source: 'journey', archive, entries: byTime(entries), journals: [JOURNEY_JOURNAL], skippedMedia };
}

async function readArchive(archive: Blob): Promise<AppExport> {
  const files = await readZipEntries(archive);
  const jsonFiles = files.filter((file) => file.name.toLowerCase().endsWith('.json') && !isMetadataFile(file.name));
  const first = jsonFiles[0] ? parseJson(await readZipText(archive, jsonFiles[0])) : undefined;

  if (isDayOneJournal(first)) {
    return readDayOneArchive(archive, files, jsonFiles, first);
  }
  if (isJourneyEntry(first)) {
    return readJourneyArchive(archive, files, jsonFiles);
  }
  throw new UnsupportedExportError('No Day One or Journey entries in this archive');
}

/** Reads a Day One export (ZIP, or its JSON alone) or a Journey ZIP export. */
export async function readAppExport(file: File): Promise<AppExport> {
  const signature = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  if (signature[0] === ZIP_SIGNATURE[0] && signature[1] === ZIP_SIGNATURE[1]) {
    try {
      return await readArchive(file);
    } catch (error) {
      throw error instanceof ZipFormatError ? new UnsupportedExportError(error.message) : error;
    }
  }

  const data = parseJson(await file.text());
  if (isDayOneJournal(data)) {
    const journal = stem(file.name) || 'Journal';
    const parsed = parseDayOneJournal(data, journal, () => undefined);
    return { source: 'dayone', archive: null, entries: byTime(parsed.entries), journals: [journal], skippedMedia: parsed.skippedMedia };
  }
  throw new UnsupportedExportError('Not a Day One or Journey export');
}
