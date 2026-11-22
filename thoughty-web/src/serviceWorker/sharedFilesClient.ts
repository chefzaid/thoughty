/**
 * The page's side of sharing files to the installed app: as the page loads on the share target's address,
 * it asks the service worker that received the share for the files it keeps (`shareTargetReceiver.ts`),
 * then holds them in memory, never in any storage, until the journal's composer takes them, past a
 * sign-in if need be. A reload loses them (the worker gave them up), which the composer then says.
 */
import { TAKE_SHARED_FILES, type SharedFilesAnswer, type TakeSharedFilesMessage } from './shareTargetProtocol';

/** How long the page waits for the worker's answer, which comes at once when it has the files. */
export const SHARED_FILES_ANSWER_MS = 10_000;

let claimed: Promise<File[]> | null = null;

const filesIn = (answer: unknown): File[] => {
  const files = (answer as Partial<SharedFilesAnswer> | null)?.files;
  return Array.isArray(files) ? files.filter((file): file is File => file instanceof File) : [];
};

function askWorker(id: string, worker: ServiceWorker | null, windowMs: number): Promise<File[]> {
  if (!worker) return Promise.resolve([]);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const finish = (files: File[]) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(files);
    };
    const timer = setTimeout(() => finish([]), windowMs);
    channel.port1.onmessage = (event: MessageEvent) => finish(filesIn(event.data));
    const message: TakeSharedFilesMessage = { type: TAKE_SHARED_FILES, id };
    worker.postMessage(message, [channel.port2]);
  });
}

/** Asks the worker controlling this page for the files kept under `id`, for `takeSharedFiles`. */
export function claimSharedFiles(
  id: string,
  container: Pick<ServiceWorkerContainer, 'controller'> | undefined = globalThis.navigator?.serviceWorker,
  windowMs: number = SHARED_FILES_ANSWER_MS,
): void {
  claimed = askWorker(id, container?.controller ?? null, windowMs);
}

/** The files claimed as the page loaded, once: none when nothing was claimed or the worker had none. */
export function takeSharedFiles(): Promise<File[]> {
  const files = claimed ?? Promise.resolve([]);
  claimed = null;
  return files;
}
