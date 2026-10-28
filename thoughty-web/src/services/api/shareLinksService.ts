import { requestJson, type AuthFetchFunction, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';

export type ShareLink = components['schemas']['ShareLinkResponseDto'];
export type CreatedShareLink = components['schemas']['CreatedShareLinkResponseDto'];
export type ShareLinkList = components['schemas']['ShareLinkListResponseDto'];
export type ShareLinkDraft = components['schemas']['CreateShareLinkDto'];
export type ShareLinkKind = ShareLink['kind'];
export type SharedContent = components['schemas']['SharedContentResponseDto'];
export type SharedEntry = components['schemas']['SharedEntryDto'];
export type SharedAttachment = components['schemas']['SharedAttachmentDto'];
export type SharedBookVersion = components['schemas']['SharedBookVersionDto'];

/** What a private share link shares: one of the writer's entries or book versions. */
export interface ShareLinkTarget {
  readonly kind: ShareLinkKind;
  readonly id: number;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** The writer's private share links. Errors are translation keys, or the API's coded reason. */
export const createShareLinksService = (authFetch: AuthFetchFunction) => ({
  list(target: ShareLinkTarget): Promise<ServiceResult<ShareLinkList>> {
    const query = new URLSearchParams({ kind: target.kind, targetId: String(target.id) });
    return requestJson(authFetch(`/api/share-links?${query.toString()}`), 'shareLinksLoadFailed');
  },

  create(draft: ShareLinkDraft): Promise<ServiceResult<CreatedShareLink>> {
    return requestJson(
      authFetch('/api/share-links', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(draft) }),
      'shareLinkCreateFailed',
    );
  },

  revoke(id: number): Promise<ServiceResult<components['schemas']['SuccessResponseDto']>> {
    return requestJson(authFetch(`/api/share-links/${id}`, { method: 'DELETE' }), 'shareLinkRevokeFailed');
  },
});

export type ShareLinksService = ReturnType<typeof createShareLinksService>;

/** The page a reader opens: `https://<host>/s/<token>`. */
export function shareLinkUrl(token: string, origin: string = globalThis.location.origin): string {
  return `${origin}/s/${encodeURIComponent(token)}`;
}

/** The token of a shared page's address (`/s/<token>`), or null for any other address. */
export function shareTokenFromPath(pathname: string): string | null {
  const match = /^\/s\/([A-Za-z0-9_-]+)\/?$/.exec(pathname);
  return match?.[1] ?? null;
}

const tokenPath = (token: string) => encodeURIComponent(token);

/** A shared entry's file (or a video's poster frame), served for the link alone. */
export function sharedAttachmentUrl(token: string, attachmentId: number, part: 'file' | 'poster' = 'file'): string {
  return part === 'poster'
    ? `/api/shared/${tokenPath(token)}/attachments/${attachmentId}/poster`
    : `/api/shared/${tokenPath(token)}/attachments/${attachmentId}`;
}

/** The shared book version's file, as a download. */
export function sharedBookFileUrl(token: string): string {
  return `/api/shared/${tokenPath(token)}/file`;
}

export type SharedBookFileResult =
  | { readonly status: 'ready'; readonly file: Blob }
  | { readonly status: 'unavailable' }
  | { readonly status: 'failed' };

/** The shared book's file, downloaded without credentials or referrer; a 404 means the link no longer works. */
export async function fetchSharedBookFile(token: string, fetchImpl: typeof fetch = fetch): Promise<SharedBookFileResult> {
  try {
    const response = await fetchImpl(sharedBookFileUrl(token), { credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (response.status === 404) return { status: 'unavailable' };
    if (!response.ok) return { status: 'failed' };
    return { status: 'ready', file: await response.blob() };
  } catch {
    return { status: 'failed' };
  }
}

export type SharedContentResult =
  | { readonly status: 'ready'; readonly content: SharedContent }
  | { readonly status: 'unavailable' }
  | { readonly status: 'failed' };

/**
 * What a private share link shares, read without signing in: no cookie or token goes with it, and no
 * referrer. Any 404 means the link does not work, whatever the reason; other failures can be retried.
 */
export async function fetchSharedContent(token: string, fetchImpl: typeof fetch = fetch): Promise<SharedContentResult> {
  try {
    const response = await fetchImpl(`/api/shared/${tokenPath(token)}`, { credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (response.status === 404) return { status: 'unavailable' };
    if (!response.ok) return { status: 'failed' };
    return { status: 'ready', content: (await response.json()) as SharedContent };
  } catch {
    return { status: 'failed' };
  }
}
