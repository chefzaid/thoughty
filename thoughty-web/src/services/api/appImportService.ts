import { readApiErrorMessage, safeJsonParse } from './base';
import type { components } from '../../generated/openapi';

export type AppImportRequest = components['schemas']['AppImportDto'];
export type AppImportEntryRequest = components['schemas']['AppImportEntryDto'];
export type AppImportResponse = components['schemas']['AppImportResponseDto'];
export type ImportAttachmentsResponse = components['schemas']['ImportAttachmentsResponseDto'];

/** An import request's data, or why it failed: `status` 0 is a network error, 429 comes with the wait. */
export type ImportResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: string; readonly status: number; readonly retryAfterSeconds?: number };

async function requestImport<T>(request: Promise<Response>, fallbackError: string): Promise<ImportResult<T>> {
  let response: Response;
  try {
    response = await request;
  } catch (error) {
    console.error(`${fallbackError}:`, error);
    return { ok: false, error: fallbackError, status: 0 };
  }

  if (!response.ok) {
    const retryAfter = Number.parseInt(response.headers.get('Retry-After') ?? '', 10);
    return {
      ok: false,
      error: await readApiErrorMessage(response, fallbackError),
      status: response.status,
      retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : undefined,
    };
  }
  const data = await safeJsonParse<T>(response);
  return data ? { ok: true, data } : { ok: false, error: fallbackError, status: response.status };
}

export const createAppImportService = (authFetch: (url: string, options?: RequestInit) => Promise<Response>) => ({
  importEntries(request: AppImportRequest): Promise<ImportResult<AppImportResponse>> {
    return requestImport(
      authFetch('/api/io/import/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      }),
      'Failed to import entries',
    );
  },

  /** Sends up to 8 files; `entryIds[i]` is the entry that `files[i]` belongs to. */
  uploadAttachments(files: File[], entryIds: number[]): Promise<ImportResult<ImportAttachmentsResponse>> {
    const form = new FormData();
    form.append('entryIds', entryIds.join(','));
    for (const file of files) {
      form.append('files', file);
    }
    return requestImport(authFetch('/api/io/import/attachments', { method: 'POST', body: form }), 'Failed to attach files');
  },
});

export type AppImportService = ReturnType<typeof createAppImportService>;
