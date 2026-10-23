import type { AppImportEntryRequest, AppImportService, ImportResult } from '../../../services/api/appImportService';
import { readZipFile } from '../../../utils/zipReader';
import { MAX_ATTACHMENT_BYTES } from './appImportMedia';
import type { AppExport, ImportedEntry, ImportedMedia } from './appImportTypes';
import { shrinkPhoto } from './shrinkPhoto';

const MAX_BATCH_ENTRIES = 200;
const MAX_BATCH_CHARACTERS = 3_000_000;
const MAX_ENTRY_CHARACTERS = 50_000;
const MAX_FILES_PER_REQUEST = 8;
// The ingress accepts 10 MB per request; leave room for the multipart framing
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
const NETWORK_RETRY_DELAYS = [2, 5, 15];
const MAX_RATE_LIMIT_WAITS = 30;
const DEFAULT_RATE_LIMIT_WAIT = 60;

export interface AppImportOptions {
  readonly diaryId?: number | null;
  readonly journalsAsDiaries: boolean;
}

export interface AppImportProgress {
  readonly phase: 'entries' | 'files';
  readonly done: number;
  readonly total: number;
  /** Seconds until the import resumes after the server asked it to slow down. */
  readonly waitingSeconds?: number;
}

export type FailedFileReason = 'tooLarge' | 'unreadable' | 'rejected';

export interface AppImportSummary {
  readonly imported: number;
  readonly alreadyImported: number;
  readonly attached: number;
  readonly failedFiles: ReadonlyArray<{ readonly name: string; readonly reason: FailedFileReason }>;
  readonly createdDiaries: string[];
  readonly stopped: boolean;
}

export class AppImportError extends Error {}

interface PendingFile {
  readonly entryId: number;
  readonly media: ImportedMedia;
}

function wait(seconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = globalThis.setTimeout(resolve, seconds * 1000);
    signal.addEventListener('abort', () => {
      globalThis.clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

/** Retries network and server errors a few times, and waits out rate limits. */
async function withRetries<T>(
  call: () => Promise<ImportResult<T>>,
  signal: AbortSignal,
  onWait: (seconds: number) => void,
): Promise<ImportResult<T>> {
  let networkRetries = 0;
  let rateLimitWaits = 0;
  for (;;) {
    const result = await call();
    if (result.ok || signal.aborted) {
      return result;
    }
    if (result.status === 429 && rateLimitWaits < MAX_RATE_LIMIT_WAITS) {
      rateLimitWaits++;
      const seconds = Math.min(result.retryAfterSeconds ?? DEFAULT_RATE_LIMIT_WAIT, 900);
      onWait(seconds);
      await wait(seconds, signal);
    } else if ((result.status === 0 || result.status >= 500) && networkRetries < NETWORK_RETRY_DELAYS.length) {
      await wait(NETWORK_RETRY_DELAYS[networkRetries++]!, signal);
    } else {
      return result;
    }
    if (signal.aborted) {
      return result;
    }
  }
}

/** Entries over the server's length limit continue in follow-up entries on the same day. */
function splitLongEntry(entry: ImportedEntry): ImportedEntry[] {
  if (entry.content.length <= MAX_ENTRY_CHARACTERS) {
    return [entry];
  }
  const parts: string[] = [];
  let rest = entry.content;
  while (rest.length > MAX_ENTRY_CHARACTERS) {
    const paragraphEnd = rest.lastIndexOf('\n\n', MAX_ENTRY_CHARACTERS);
    const cut = paragraphEnd > MAX_ENTRY_CHARACTERS / 2 ? paragraphEnd : MAX_ENTRY_CHARACTERS;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  parts.push(rest);
  return parts.map((content, index) => ({
    ...entry,
    sourceId: index === 0 ? entry.sourceId : `${entry.sourceId}.part${index + 1}`,
    content,
    media: index === 0 ? entry.media : [],
  }));
}

function batchEntries(entries: ImportedEntry[]): ImportedEntry[][] {
  const batches: ImportedEntry[][] = [];
  let batch: ImportedEntry[] = [];
  let characters = 0;
  for (const entry of entries.flatMap(splitLongEntry)) {
    if (batch.length === MAX_BATCH_ENTRIES || (batch.length > 0 && characters + entry.content.length > MAX_BATCH_CHARACTERS)) {
      batches.push(batch);
      batch = [];
      characters = 0;
    }
    batch.push(entry);
    characters += entry.content.length;
  }
  if (batch.length > 0) {
    batches.push(batch);
  }
  return batches;
}

function toRequestEntry(entry: ImportedEntry, journalsAsDiaries: boolean): AppImportEntryRequest {
  return {
    sourceId: entry.sourceId,
    date: entry.date,
    ...(entry.timeOfDay ? { timeOfDay: entry.timeOfDay } : {}),
    ...(entry.title ? { title: entry.title } : {}),
    ...(entry.mood ? { mood: entry.mood } : {}),
    content: entry.content,
    tags: entry.tags,
    favorite: entry.favorite,
    ...(journalsAsDiaries ? { journal: entry.journal } : {}),
  };
}

/** The file ready to upload, re-encoded when the server cannot take it as it is. */
async function prepareFile(archive: Blob, media: ImportedMedia): Promise<File | FailedFileReason> {
  let blob: Blob;
  try {
    blob = await readZipFile(archive, media.file, media.mimetype);
  } catch {
    return 'unreadable';
  }

  const isPhoto = media.mimetype.startsWith('image/');
  if (media.convert || (isPhoto && blob.size > MAX_ATTACHMENT_BYTES)) {
    const jpeg = await shrinkPhoto(blob, MAX_ATTACHMENT_BYTES);
    if (!jpeg) {
      return media.convert ? 'unreadable' : 'tooLarge';
    }
    const name = media.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([jpeg], media.convert ? name : media.name, { type: 'image/jpeg' });
  }
  if (blob.size > MAX_ATTACHMENT_BYTES) {
    return 'tooLarge';
  }
  return new File([blob], media.name, { type: media.mimetype });
}

/**
 * Imports the entries in batches, then uploads their photos and recordings.
 * Running it again with the same export skips what is already there.
 */
export async function runAppImport(
  data: AppExport,
  options: AppImportOptions,
  service: AppImportService,
  onProgress: (progress: AppImportProgress) => void,
  signal: AbortSignal,
): Promise<AppImportSummary> {
  const batches = batchEntries(data.entries);
  const total = batches.reduce((sum, batch) => sum + batch.length, 0);
  const pendingFiles: PendingFile[] = [];
  const failedFiles: Array<{ name: string; reason: FailedFileReason }> = [];
  const createdDiaries: string[] = [];
  let imported = 0;
  let alreadyImported = 0;
  let attached = 0;
  let done = 0;

  onProgress({ phase: 'entries', done, total });
  for (const batch of batches) {
    if (signal.aborted) {
      break;
    }
    const result = await withRetries(
      () => service.importEntries({
        source: data.source,
        entries: batch.map((entry) => toRequestEntry(entry, options.journalsAsDiaries)),
        ...(options.diaryId ? { diaryId: options.diaryId } : {}),
        journalsAsDiaries: options.journalsAsDiaries,
      }),
      signal,
      (seconds) => onProgress({ phase: 'entries', done, total, waitingSeconds: seconds }),
    );
    if (!result.ok) {
      if (signal.aborted) {
        break;
      }
      throw new AppImportError(result.error);
    }

    const response = result.data;
    imported += response.importedCount;
    alreadyImported += response.alreadyImportedCount;
    createdDiaries.push(...response.createdDiaries);
    batch.forEach((entry, position) => {
      const saved = response.entries[position];
      if (!saved) {
        return;
      }
      const attachedNames = new Set(saved.attachedFiles);
      for (const media of entry.media) {
        if (!attachedNames.has(media.name) && !attachedNames.has(media.name.replace(/\.[^.]+$/, '.jpg'))) {
          pendingFiles.push({ entryId: saved.entryId, media });
        }
      }
    });
    done += batch.length;
    onProgress({ phase: 'entries', done, total });
  }

  if (data.archive && pendingFiles.length > 0 && !signal.aborted) {
    attached = await uploadFiles(data.archive, pendingFiles, service, onProgress, signal, failedFiles);
  }

  return { imported, alreadyImported, attached, failedFiles, createdDiaries, stopped: signal.aborted };
}

async function uploadFiles(
  archive: Blob,
  pendingFiles: PendingFile[],
  service: AppImportService,
  onProgress: (progress: AppImportProgress) => void,
  signal: AbortSignal,
  failedFiles: Array<{ name: string; reason: FailedFileReason }>,
): Promise<number> {
  const total = pendingFiles.length;
  let done = 0;
  let attached = 0;
  let pack: Array<{ file: File; entryId: number }> = [];
  let packBytes = 0;

  const send = async (files: Array<{ file: File; entryId: number }>): Promise<void> => {
    const result = await withRetries(
      () => service.uploadAttachments(files.map((item) => item.file), files.map((item) => item.entryId)),
      signal,
      (seconds) => onProgress({ phase: 'files', done, total, waitingSeconds: seconds }),
    );
    if (result.ok) {
      attached += result.data.attachments.length;
    } else if (signal.aborted) {
      return;
    } else if (files.length > 1 && result.status >= 400 && result.status < 500 && result.status !== 429) {
      // One refused file fails the whole request; find it by sending them one by one
      for (const item of files) {
        await send([item]);
      }
      return;
    } else if (result.status >= 400 && result.status < 500) {
      failedFiles.push(...files.map((item) => ({ name: item.file.name, reason: 'rejected' as const })));
    } else {
      throw new AppImportError(result.error);
    }
    done += files.length;
    onProgress({ phase: 'files', done, total });
  };

  const flush = async () => {
    if (pack.length > 0) {
      const current = pack;
      pack = [];
      packBytes = 0;
      await send(current);
    }
  };

  onProgress({ phase: 'files', done, total });
  for (const pending of pendingFiles) {
    if (signal.aborted) {
      break;
    }
    const file = await prepareFile(archive, pending.media);
    if (typeof file === 'string') {
      failedFiles.push({ name: pending.media.name, reason: file });
      done++;
      onProgress({ phase: 'files', done, total });
      continue;
    }
    if (pack.length === MAX_FILES_PER_REQUEST || packBytes + file.size > MAX_REQUEST_BYTES) {
      await flush();
    }
    pack.push({ file, entryId: pending.entryId });
    packBytes += file.size;
  }
  if (!signal.aborted) {
    await flush();
  }
  return attached;
}
