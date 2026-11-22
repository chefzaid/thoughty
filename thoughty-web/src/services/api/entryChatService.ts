import { requestJson, type AuthFetchFunction, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';
import { normalizeReaderScope } from './entryReaderService';

/** A reply about the entries of the journal filters, with the entries it read and those it cites. */
export type EntryChatReply = components['schemas']['EntryChatResponseDto'];
/** An entry a reply read, under the number it is cited by. */
export type EntryChatEntry = components['schemas']['EntryChatEntryDto'];

export interface EntryChatMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

/** Only entries dated within these days (`YYYY-MM-DD`), each left empty for no bound. */
export interface EntryChatRange {
  readonly from: string;
  readonly to: string;
}

/** The `POST /api/entries/chat` query: the journal filters of a reader scope (never its month) and the date range. */
export function entryChatParams(scope: string, range: EntryChatRange): URLSearchParams {
  const params = new URLSearchParams(normalizeReaderScope(scope));
  params.delete('month');
  if (range.from) params.set('dateFrom', range.from);
  if (range.to) params.set('dateTo', range.to);
  return params;
}

/** The AI's reply about the entries of the journal filters. Errors are translation keys, or the API's coded reason. */
export const createEntryChatService = (authFetch: AuthFetchFunction) => ({
  send(scope: string, range: EntryChatRange, messages: readonly EntryChatMessage[]): Promise<ServiceResult<EntryChatReply>> {
    return requestJson(
      authFetch(`/api/entries/chat?${entryChatParams(scope, range)}`, { method: 'POST', body: JSON.stringify({ messages }) }),
      'entryChatFailed',
    );
  },
});

export type EntryChatService = ReturnType<typeof createEntryChatService>;
