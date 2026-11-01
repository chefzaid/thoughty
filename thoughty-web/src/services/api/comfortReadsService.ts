import { requestJson, type AuthFetchFunction, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';

/** One entry offered to reread: its day, index, title and the start of its text. */
export type ComfortRead = components['schemas']['ComfortReadDto'];
export type ComfortReads = components['schemas']['ComfortReadsResponseDto'];

/**
 * Up to three of the writer's favorite or gratitude entries, never `excludeId` (the entry just written).
 * A failure is never shown: the offer simply does not appear, so its error is only logged.
 */
export const createComfortReadsService = (authFetch: AuthFetchFunction) => ({
  pick(excludeId: number): Promise<ServiceResult<ComfortReads>> {
    const params = new URLSearchParams({ excludeId: String(excludeId) });
    return requestJson(authFetch(`/api/entries/comfort-reads?${params}`), 'comfortReadsLoadFailed');
  },
});

export type ComfortReadsService = ReturnType<typeof createComfortReadsService>;
