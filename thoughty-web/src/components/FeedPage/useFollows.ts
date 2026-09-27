import { useCallback, useEffect, useState } from 'react';

import type { FeedService, FollowedUser, PublicFeedAuthor } from '../../services/api';

const byUsername = (left: FollowedUser, right: FollowedUser) => left.username.localeCompare(right.username);

/**
 * Tracks who the current user follows. Follow changes made on this page override
 * the `isFollowed` flag the feed returned, so every card by the same author stays in sync.
 */
export function useFollows(feedService: FeedService) {
  const [following, setFollowing] = useState<FollowedUser[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [updateError, setUpdateError] = useState(false);
  const [overrides, setOverrides] = useState<ReadonlyMap<number, boolean>>(new Map());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<number>>(new Set());

  useEffect(() => {
    let active = true;
    void feedService.fetchFollows().then((result) => {
      if (!active) return;
      if (result.data) {
        setFollowing([...result.data.following].sort(byUsername));
        setFollowerCount(result.data.followerCount);
      }
      setLoadError(!result.data);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [feedService]);

  const isFollowed = useCallback(
    (author: PublicFeedAuthor) => overrides.get(author.id) ?? author.isFollowed,
    [overrides],
  );

  const setFollow = useCallback(async (author: Pick<PublicFeedAuthor, 'id' | 'username' | 'avatarUrl'>, follow: boolean) => {
    setPendingIds((current) => new Set(current).add(author.id));
    setUpdateError(false);
    const result = await feedService.setFollowing(author.id, follow);
    setPendingIds((current) => {
      const next = new Set(current);
      next.delete(author.id);
      return next;
    });

    if (!result.data) {
      setUpdateError(true);
      return;
    }

    setOverrides((current) => new Map(current).set(author.id, follow));
    setFollowing((current) => {
      const others = current.filter((user) => user.id !== author.id);
      if (!follow) return others;
      const followed = {
        id: author.id,
        username: author.username,
        avatarUrl: author.avatarUrl ?? null,
        followedAt: new Date().toISOString(),
      };
      return [...others, followed].sort(byUsername);
    });
  }, [feedService]);

  return { following, followerCount, loaded, loadError, updateError, pendingIds, isFollowed, setFollow };
}
