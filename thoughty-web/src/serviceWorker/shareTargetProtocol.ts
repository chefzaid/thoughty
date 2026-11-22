/**
 * What the installed app's share target (`share_target` in `public/site.webmanifest`), the service worker
 * that receives it and the page agree on. Kept apart so the worker's bundle carries nothing of the app.
 *
 * The share sheet posts a multipart form to `SHARE_TARGET_PATH` with `title`, `text` and `url` fields and
 * the shared files under `SHARED_FILES_FIELD`. The worker answers with a redirect to the same path with the
 * text in its query, plus `SHARED_FILES_PARAM=<id>` when files came with it; the page then asks the worker
 * for those files with a `TAKE_SHARED_FILES` message. Where no worker received the post (none installed),
 * the web server redirects to the path with `SHARE_NOT_RECEIVED_PARAM`, so the writer is told.
 */
export const SHARE_TARGET_PATH = '/share-target';

/** The form fields of the text shared, also the query parameters the page reads them from. */
export const SHARED_TEXT_FIELDS = ['title', 'text', 'url'] as const;

/** The longest text kept of each shared field: the longest entry text the API accepts. */
export const MAX_SHARED_TEXT_LENGTH = 50_000;

/** The form field the share sheet puts the shared files in. */
export const SHARED_FILES_FIELD = 'files';

/** The query parameter naming the files the worker keeps for the page. */
export const SHARED_FILES_PARAM = 'files';

/** The query parameter saying that what was shared could not be received. */
export const SHARE_NOT_RECEIVED_PARAM = 'unreceived';

/** The message the page sends the worker for the files it keeps, with their `id`, and a port for the answer. */
export const TAKE_SHARED_FILES = 'thoughty:take-shared-files';

export interface TakeSharedFilesMessage {
  readonly type: typeof TAKE_SHARED_FILES;
  readonly id: string;
}

/** The worker's answer on the port: the files, or none when it no longer has them. */
export interface SharedFilesAnswer {
  readonly files: File[];
}
