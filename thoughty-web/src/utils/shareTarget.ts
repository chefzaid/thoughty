import { getPathForView } from '../types/navigation';
import { MAX_ENTRY_TITLE_LENGTH } from './entryTime';
import {
  MAX_SHARED_TEXT_LENGTH,
  SHARE_NOT_RECEIVED_PARAM,
  SHARE_TARGET_PATH,
  SHARED_FILES_PARAM,
} from '../serviceWorker/shareTargetProtocol';
import { claimSharedFiles } from '../serviceWorker/sharedFilesClient';

/** Where what was shared waits in this tab until the journal's composer takes it, through a sign-in if need be. */
export const SHARED_CONTENT_STORAGE_KEY = 'thoughty.sharedContent';

/** What was shared, as a new entry's title and text, and the files to attach to it. */
export interface SharedContent {
  readonly title: string;
  readonly text: string;
  readonly files?: readonly File[];
}

/**
 * What the share target's address (`/share-target`, see `serviceWorker/shareTargetProtocol.ts`) left in
 * the tab for the composer: the text shared, whether files came with it (which the page holds in memory,
 * `takeSharedFiles`), and whether the share could not be received at all.
 */
export interface CapturedShare {
  readonly title: string;
  readonly text: string;
  readonly withFiles: boolean;
  readonly notReceived: boolean;
}

const oneLine = (value: string) => value.replaceAll(/\s+/g, ' ').trim();

/**
 * Turns what the share sheet sent into a new entry: the text, then the link on a line of its own unless the
 * text already holds it (many apps put the link in the text), and the shared title as the entry's title. With
 * nothing else to write, the title is the text, since an entry needs one. Null when nothing was shared.
 */
export function sharedContentFrom(params: URLSearchParams): SharedContent | null {
  const title = oneLine(params.get('title') ?? '');
  const text = (params.get('text') ?? '').trim();
  const url = (params.get('url') ?? '').trim();
  const body = url && !text.includes(url) ? [text, url].filter(Boolean).join('\n') : text;
  if (!body) {
    return title ? { title: '', text: title.slice(0, MAX_SHARED_TEXT_LENGTH) } : null;
  }
  return { title: title.slice(0, MAX_ENTRY_TITLE_LENGTH), text: body.slice(0, MAX_SHARED_TEXT_LENGTH) };
}

/** This tab's session storage, or null where the browser refuses it (storage switched off, a sandboxed frame). */
function tabStorage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Run once as the page loads, before the app reads the address: on the share target's address, keeps what was
 * shared in this tab, asks the service worker for the files shared with it, and moves to the journal, whose
 * composer takes it once the writer is signed in. The address is replaced, so Back or a reload does not share
 * it again.
 */
export function captureSharedContent(
  location: Pick<Location, 'pathname' | 'search'>,
  history: Pick<History, 'replaceState'>,
  storage: Storage | null = tabStorage(),
  claimFiles: (id: string) => void = claimSharedFiles,
): void {
  if (location.pathname.replace(/\/+$/, '') !== SHARE_TARGET_PATH) {
    return;
  }
  const params = new URLSearchParams(location.search);
  const filesId = params.get(SHARED_FILES_PARAM) ?? '';
  if (filesId) claimFiles(filesId);
  const shared = sharedContentFrom(params);
  const captured: CapturedShare = {
    title: shared?.title ?? '',
    text: shared?.text ?? '',
    withFiles: filesId !== '',
    notReceived: params.has(SHARE_NOT_RECEIVED_PARAM),
  };
  try {
    if (shared || captured.withFiles || captured.notReceived) storage?.setItem(SHARED_CONTENT_STORAGE_KEY, JSON.stringify(captured));
  } catch {
    // A full or refused storage loses what was shared; the journal still opens
  }
  history.replaceState(null, '', getPathForView('journal'));
}

/** Takes what was shared out of this tab's storage, once: null when nothing waits or what waits is not ours. */
export function takeSharedContent(storage: Storage | null = tabStorage()): CapturedShare | null {
  let stored: string | null = null;
  try {
    stored = storage?.getItem(SHARED_CONTENT_STORAGE_KEY) ?? null;
    storage?.removeItem(SHARED_CONTENT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!stored) return null;
  try {
    const { title, text, withFiles, notReceived } = JSON.parse(stored) as Record<string, unknown>;
    if (typeof title !== 'string' || typeof text !== 'string') return null;
    const captured: CapturedShare = {
      title: title.slice(0, MAX_ENTRY_TITLE_LENGTH),
      text: text.slice(0, MAX_SHARED_TEXT_LENGTH),
      withFiles: withFiles === true,
      notReceived: notReceived === true,
    };
    return captured.text.trim() || captured.withFiles || captured.notReceived ? captured : null;
  } catch {
    return null;
  }
}
