import { getPathForView } from '../types/navigation';
import { MAX_ENTRY_TITLE_LENGTH } from './entryTime';

/**
 * The address the installed app's share target opens (`share_target` in `public/site.webmanifest`): the
 * phone's share sheet sends the page or text shared as `title`, `text` and `url` query parameters.
 */
export const SHARE_TARGET_PATH = '/share-target';

/** Where what was shared waits in this tab until the journal's composer takes it, through a sign-in if need be. */
export const SHARED_CONTENT_STORAGE_KEY = 'thoughty.sharedContent';

/** The longest entry text the API accepts. */
const MAX_SHARED_TEXT_LENGTH = 50_000;

/** What was shared, as a new entry's title and text. */
export interface SharedContent {
  readonly title: string;
  readonly text: string;
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
 * shared in this tab and moves to the journal, whose composer takes it once the writer is signed in. The
 * address is replaced, so Back or a reload does not share it again.
 */
export function captureSharedContent(
  location: Pick<Location, 'pathname' | 'search'>,
  history: Pick<History, 'replaceState'>,
  storage: Storage | null = tabStorage(),
): void {
  if (location.pathname.replace(/\/+$/, '') !== SHARE_TARGET_PATH) {
    return;
  }
  const shared = sharedContentFrom(new URLSearchParams(location.search));
  try {
    if (shared) storage?.setItem(SHARED_CONTENT_STORAGE_KEY, JSON.stringify(shared));
  } catch {
    // A full or refused storage loses what was shared; the journal still opens
  }
  history.replaceState(null, '', getPathForView('journal'));
}

/** Takes what was shared out of this tab's storage, once: null when nothing waits or what waits is not ours. */
export function takeSharedContent(storage: Storage | null = tabStorage()): SharedContent | null {
  let stored: string | null = null;
  try {
    stored = storage?.getItem(SHARED_CONTENT_STORAGE_KEY) ?? null;
    storage?.removeItem(SHARED_CONTENT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!stored) return null;
  try {
    const { title, text } = JSON.parse(stored) as Record<string, unknown>;
    return typeof title === 'string' && typeof text === 'string' && text.trim()
      ? { title: title.slice(0, MAX_ENTRY_TITLE_LENGTH), text: text.slice(0, MAX_SHARED_TEXT_LENGTH) }
      : null;
  } catch {
    return null;
  }
}
