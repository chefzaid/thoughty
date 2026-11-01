import { requestJson, type AuthFetchFunction, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';

export type EntryMutationResult = components['schemas']['EntryMutationResponseDto'];
type SetRereadReminderRequest = components['schemas']['SetRereadReminderDto'];

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** Asking to reread an entry on a day, and clearing that reminder (removed, or done from Highlights). */
export const createRereadReminderService = (authFetch: AuthFetchFunction) => ({
  /** Sets or replaces the entry's reminder; `today` is the writer's own day. */
  set(entryId: number, rereadOn: string, today: string): Promise<ServiceResult<EntryMutationResult>> {
    const body: SetRereadReminderRequest = { rereadOn, today };
    return requestJson(
      authFetch(`/api/entries/${entryId}/reread-reminder`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(body) }),
      'rereadSaveFailed',
    );
  },

  clear(entryId: number): Promise<ServiceResult<EntryMutationResult>> {
    return requestJson(authFetch(`/api/entries/${entryId}/reread-reminder`, { method: 'DELETE' }), 'rereadRemoveFailed');
  },
});

export type RereadReminderService = ReturnType<typeof createRereadReminderService>;
