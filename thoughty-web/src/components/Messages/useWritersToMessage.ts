import { useQuery } from '@tanstack/react-query';

import { useFeedService } from '../../hooks/useFeedService';
import type { FollowedUser } from '../../services/api';

export const WRITERS_TO_MESSAGE_QUERY_KEY = ['follows', 'mutual'] as const;

/** The writers the reader follows who follow them back, by name: the ones they may write to. */
export function useWritersToMessage() {
  const feedService = useFeedService();
  return useQuery({
    queryKey: WRITERS_TO_MESSAGE_QUERY_KEY,
    queryFn: async (): Promise<FollowedUser[]> => {
      const result = await feedService.fetchFollows();
      if (!result.data) throw new Error('messagesLoadError');
      const followers = new Set(result.data.followers.map((follower) => follower.id));
      return result.data.following
        .filter((writer) => followers.has(writer.id))
        .sort((left, right) => left.username.localeCompare(right.username));
    },
  });
}
