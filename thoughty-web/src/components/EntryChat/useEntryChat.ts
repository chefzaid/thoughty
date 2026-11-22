import { useCallback, useState } from 'react';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import {
  createEntryChatService,
  type EntryChatEntry,
  type EntryChatMessage,
  type EntryChatRange,
} from '../../services/api/entryChatService';

/** A message of the conversation; a reply also holds the entries it read and the numbers it cites. */
export interface EntryChatTurn extends EntryChatMessage {
  readonly entries?: readonly EntryChatEntry[];
  readonly cited?: readonly number[];
}

/** How many entries the last reply read, of how many match. */
export interface EntryChatReading {
  readonly count: number;
  readonly total: number;
}

interface Conversation {
  readonly scope: string;
  /** Counts the conversations started, so a reply knows whether it still belongs to this one. */
  readonly version: number;
  readonly range: EntryChatRange;
  readonly turns: readonly EntryChatTurn[];
  readonly reading: EntryChatReading | null;
  readonly loading: boolean;
  /** A translation key, or the API's coded reason. */
  readonly error: string | null;
}

const NO_RANGE: EntryChatRange = { from: '', to: '' };
const fresh = (scope: string, version: number): Conversation => ({
  scope, version, range: NO_RANGE, turns: [], reading: null, loading: false, error: null,
});

/**
 * A conversation with the AI about the entries of a reader scope (the journal filters), narrowed to a date range.
 * It belongs to that scope: other filters start a new one, and a reply that comes back after that is dropped.
 * Nothing of it is saved; it lasts while the journal stays open.
 */
export function useEntryChat(scope: string) {
  const service = useAuthenticatedService(createEntryChatService);
  const [conversation, setConversation] = useState<Conversation>(() => fresh(scope, 0));
  const current = conversation.scope === scope ? conversation : fresh(scope, conversation.version + 1);
  if (current !== conversation) {
    setConversation(current);
  }

  const setRange = useCallback((range: EntryChatRange) => {
    setConversation((previous) => (previous.turns.length > 0 ? previous : { ...previous, range }));
  }, []);

  const reset = useCallback(() => {
    setConversation((previous) => fresh(previous.scope, previous.version + 1));
  }, []);

  const send = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || current.loading) return;

    const turns: EntryChatTurn[] = [...current.turns, { role: 'user', content }];
    setConversation({ ...current, turns, loading: true, error: null });

    const { data, error } = await service.send(current.scope, current.range, turns.map(({ role, content: words }) => ({ role, content: words })));
    setConversation((previous) => {
      // Other filters, or a new conversation, started meanwhile
      if (previous.scope !== current.scope || previous.version !== current.version) return previous;
      return data
        ? {
          ...previous,
          loading: false,
          turns: [...previous.turns, { role: 'assistant', content: data.reply, entries: data.entries, cited: data.cited }],
          reading: { count: data.entries.length, total: data.total },
        }
        : { ...previous, loading: false, error };
    });
  }, [current, service]);

  return { ...current, setRange, reset, send };
}

export type EntryChatState = ReturnType<typeof useEntryChat>;
