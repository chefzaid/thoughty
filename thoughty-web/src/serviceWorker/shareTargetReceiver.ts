/**
 * The service worker's side of the share target: it receives what another app shares to the installed app
 * (a multipart `POST` to `/share-target`, see `shareTargetProtocol.ts`) and sends the page on to the same
 * address with the text in its query. Shared files are kept in the worker's memory only, never in a cache
 * or any storage, until the page takes them as it loads, and dropped once taken or after a short window.
 */
import {
  MAX_SHARED_TEXT_LENGTH,
  SHARE_NOT_RECEIVED_PARAM,
  SHARE_TARGET_PATH,
  SHARED_FILES_FIELD,
  SHARED_FILES_PARAM,
  SHARED_TEXT_FIELDS,
  TAKE_SHARED_FILES,
  type SharedFilesAnswer,
  type TakeSharedFilesMessage,
} from './shareTargetProtocol';

/** How long shared files wait for the page, which takes them as soon as it loads. */
export const SHARED_FILES_WINDOW_MS = 2 * 60_000;

/** A message posted to the worker, as much as it reads of one. */
export interface WorkerMessageEventLike {
  readonly data: unknown;
  readonly ports: readonly MessagePort[];
}

interface KeptFiles {
  readonly files: File[];
  readonly release: () => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

/** The shared files waiting for the page, each set under an id that cannot be guessed. */
export class SharedFilesStore {
  private readonly kept = new Map<string, KeptFiles>();

  constructor(
    private readonly newId: () => string = () => crypto.randomUUID(),
    private readonly windowMs: number = SHARED_FILES_WINDOW_MS,
  ) {}

  /** Keeps files for the page; `released` settles once they are taken or the window has passed. */
  keep(files: File[]): { id: string; released: Promise<void> } {
    const id = this.newId();
    let release: () => void = () => undefined;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const timer = setTimeout(() => this.take(id), this.windowMs);
    this.kept.set(id, { files, release, timer });
    return { id, released };
  }

  /** Hands the files over and forgets them: none when the id is unknown, already taken or expired. */
  take(id: string): File[] {
    const kept = this.kept.get(id);
    if (!kept) return [];
    this.kept.delete(id);
    clearTimeout(kept.timer);
    kept.release();
    return kept.files;
  }

  /** How many shares wait for the page. */
  get size(): number {
    return this.kept.size;
  }
}

/** Whether a request is a share posted to the installed app on this origin. */
export function isSharePost(request: Request, origin: string): boolean {
  if (request.method !== 'POST') return false;
  const url = new URL(request.url);
  return url.origin === origin && url.pathname.replace(/\/+$/, '') === SHARE_TARGET_PATH;
}

/** The redirect to the share target's page, and what settles once the files kept for it are released. */
export interface ReceivedShare {
  readonly response: Response;
  readonly released: Promise<void>;
}

/**
 * Reads a posted share: the text goes in the address the page opens (`303`, so the page loads with `GET`),
 * the files wait in `store` under an id that address names. A form that cannot be read sends the page on
 * with nothing but `SHARE_NOT_RECEIVED_PARAM`, so the writer is told.
 */
export async function receiveShare(request: Request, store: SharedFilesStore, origin: string): Promise<ReceivedShare> {
  const target = new URL(SHARE_TARGET_PATH, origin);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    target.searchParams.set(SHARE_NOT_RECEIVED_PARAM, '1');
    return { response: Response.redirect(target.href, 303), released: Promise.resolve() };
  }
  for (const field of SHARED_TEXT_FIELDS) {
    const value = form.get(field);
    if (typeof value === 'string' && value.trim()) target.searchParams.set(field, value.slice(0, MAX_SHARED_TEXT_LENGTH));
  }
  const files = form.getAll(SHARED_FILES_FIELD).filter((value): value is File => typeof value !== 'string' && value.size > 0);
  let released = Promise.resolve();
  if (files.length > 0) {
    const kept = store.keep(files);
    target.searchParams.set(SHARED_FILES_PARAM, kept.id);
    released = kept.released;
  }
  return { response: Response.redirect(target.href, 303), released };
}

/** Answers the page's request for the files kept for it, on the port it sent; false for any other message. */
export function answerSharedFilesRequest(event: WorkerMessageEventLike, store: SharedFilesStore): boolean {
  const message = event.data as Partial<TakeSharedFilesMessage> | null;
  const port = event.ports[0];
  // Without a port to answer on, the files stay for a request that has one
  if (message?.type !== TAKE_SHARED_FILES || typeof message.id !== 'string' || !port) return false;
  const answer: SharedFilesAnswer = { files: store.take(message.id) };
  port.postMessage(answer);
  return true;
}
