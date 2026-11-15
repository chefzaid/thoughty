import { safeJsonParse, type AuthFetchFunction } from './base';
import type { components } from '../../generated/openapi';

export type ComposerDraft = components['schemas']['ComposerDraftResponseDto'];
export type ComposerDraftFields = Omit<ComposerDraft, 'revision' | 'updatedAt'>;

/**
 * What a draft request came to: its data; `conflict` when another device saved, published or discarded the
 * draft since this one last saw it; `offline` when the request never reached the API; `failed` otherwise.
 */
export type DraftOutcome<T> =
  | { status: 'ok'; data: T }
  | { status: 'conflict' }
  | { status: 'offline' }
  | { status: 'failed' };

const JSON_HEADERS = { 'Content-Type': 'application/json' };
async function draftRequest<T>(request: () => Promise<Response>): Promise<DraftOutcome<T>> {
  let response: Response;
  try {
    response = await request();
  } catch {
    // The browser may know it is offline before a request fails; either way the API was not reached
    return { status: 'offline' };
  }
  if (response.status === 409) {
    return { status: 'conflict' };
  }
  if (!response.ok) {
    return { status: 'failed' };
  }
  const data = await safeJsonParse<T>(response);
  return data === null ? { status: 'failed' } : { status: 'ok', data };
}

/** The new entry the writer is still writing, kept by the API so it continues on their other devices. */
export const createComposerDraftService = (authFetch: AuthFetchFunction) => ({
  async load(): Promise<DraftOutcome<ComposerDraft | null>> {
    const outcome = await draftRequest<{ draft: ComposerDraft | null }>(() => authFetch('/api/composer-draft'));
    return outcome.status === 'ok' ? { status: 'ok', data: outcome.data.draft } : outcome;
  },

  /** Saves on top of `baseRevision`, the revision this device last saw (null for none). */
  save(fields: ComposerDraftFields, baseRevision: number | null): Promise<DraftOutcome<ComposerDraft>> {
    return draftRequest(() => authFetch('/api/composer-draft', {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify({ ...fields, baseRevision }),
    }));
  },

  /** Discards the draft, only while it is still at `revision` when one is given. */
  async discard(revision: number | null): Promise<DraftOutcome<null>> {
    const url = revision === null ? '/api/composer-draft' : `/api/composer-draft?revision=${encodeURIComponent(revision)}`;
    const outcome = await draftRequest<{ success: boolean }>(() => authFetch(url, { method: 'DELETE' }));
    return outcome.status === 'ok' ? { status: 'ok', data: null } : outcome;
  },
});

export type ComposerDraftService = ReturnType<typeof createComposerDraftService>;
