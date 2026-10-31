import { requestJson, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';

export type RecycleBinPage = components['schemas']['RecycleBinListResponseDto'];
export type TrashedEntry = components['schemas']['TrashedEntryDto'];
export type RecycleBinRestoreResult = components['schemas']['RecycleBinRestoreResponseDto'];
export type RecycleBinDeleteResult = components['schemas']['RecycleBinDeleteResponseDto'];

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** The most entries one restore or delete request may name. */
export const RECYCLE_BIN_SELECTION_MAX = 100;

export interface RestoreOptions {
  /** Puts each entry back where it was in its day instead of at the end of it: the undo right after a delete. */
  readonly inPlace?: boolean;
}

export const createRecycleBinService = (authFetch: (url: string, options?: RequestInit) => Promise<Response>) => ({
  fetchPage(page: number, limit: number): Promise<ServiceResult<RecycleBinPage>> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    return requestJson(authFetch(`/api/recycle-bin?${params}`), 'Failed to load the recycle bin');
  },

  restore(ids: number[], { inPlace }: RestoreOptions = {}): Promise<ServiceResult<RecycleBinRestoreResult>> {
    const body = inPlace ? { ids, inPlace } : { ids };
    return requestJson(
      authFetch('/api/recycle-bin/restore', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) }),
      'Failed to restore entries',
    );
  },

  restoreAll(): Promise<ServiceResult<RecycleBinRestoreResult>> {
    return requestJson(authFetch('/api/recycle-bin/restore-all', { method: 'POST' }), 'Failed to restore entries');
  },

  deletePermanently(ids: number[]): Promise<ServiceResult<RecycleBinDeleteResult>> {
    return requestJson(
      authFetch('/api/recycle-bin/delete', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ ids }) }),
      'Failed to delete entries',
    );
  },

  empty(): Promise<ServiceResult<RecycleBinDeleteResult>> {
    return requestJson(authFetch('/api/recycle-bin', { method: 'DELETE' }), 'Failed to empty the recycle bin');
  },
});

export type RecycleBinService = ReturnType<typeof createRecycleBinService>;
