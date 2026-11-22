import { useQuery } from '@tanstack/react-query';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { createPeopleService } from '../../services/api';
import { writersToday } from '../../utils/entryDate';
import { PEOPLE_QUERY_KEY } from '../../utils/mentions';

/** Whose mentions to count: one person, or anyone in one of the writer's groups. */
export type MentionsScope = { readonly personId: number } | { readonly group: string };

/**
 * How often entries mention the person or the group up to the writer's day. The key sits under the people's, so
 * renaming, regrouping, merging or deleting someone reloads it with the list.
 */
export function usePersonMentions(scope: MentionsScope) {
  const service = useAuthenticatedService(createPeopleService);
  const today = writersToday();
  return useQuery({
    queryKey: [...PEOPLE_QUERY_KEY, 'mentions', 'personId' in scope ? `person:${scope.personId}` : `group:${scope.group}`, today],
    queryFn: async () => {
      const result = 'personId' in scope
        ? await service.mentionsOverTime(scope.personId, today)
        : await service.groupMentionsOverTime(scope.group, today);
      if (!result.data) {
        throw new Error(result.error ?? 'personMentionsFailed');
      }
      return result.data;
    },
  });
}
