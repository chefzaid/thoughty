import { useCallback, useEffect, useState } from 'react';

import type { FeedService, FollowedTopic, FollowedUser, PublicFeedAuthor } from '../../services/api';

const byUsername = (left: FollowedUser, right: FollowedUser) => left.username.localeCompare(right.username);
const byTag = (left: FollowedTopic, right: FollowedTopic) => left.tag.localeCompare(right.tag);
/** A topic is its tag ignoring case, as the API matches it. */
const sameTopic = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

/**
 * Tracks who and which topics the current user follows. Follow changes made on this page override
 * the `isFollowed` flag the feed returned, so every card by the same author stays in sync.
 */
export function useFollows(feedService: FeedService) {
  const [following, setFollowing] = useState<FollowedUser[]>([]);
  const [topics, setTopics] = useState<FollowedTopic[]>([]);
  const [pendingTopics, setPendingTopics] = useState<ReadonlySet<string>>(new Set());
  const [followers, setFollowers] = useState<FollowedUser[]>([]);
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
        setTopics([...result.data.topics].sort(byTag));
        setFollowers([...result.data.followers].sort(byUsername));
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

  const isTopicFollowed = useCallback(
    (tag: string) => topics.some((topic) => sameTopic(topic.tag, tag)),
    [topics],
  );

  const setTopicFollow = useCallback(async (tag: string, follow: boolean) => {
    const key = tag.toLowerCase();
    setPendingTopics((current) => new Set(current).add(key));
    setUpdateError(false);
    const result = await feedService.setTopicFollowing(tag, follow);
    setPendingTopics((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });

    if (!result.data) {
      setUpdateError(true);
      return;
    }

    const { tag: storedTag } = result.data;
    setTopics((current) => {
      const others = current.filter((topic) => !sameTopic(topic.tag, storedTag));
      return follow ? [...others, { tag: storedTag, followedAt: new Date().toISOString() }].sort(byTag) : others;
    });
  }, [feedService]);

  /** Drops a follower; they are not told. */
  const removeFollower = useCallback(async (follower: FollowedUser) => {
    setPendingIds((current) => new Set(current).add(follower.id));
    setUpdateError(false);
    const result = await feedService.removeFollower(follower.id);
    setPendingIds((current) => {
      const next = new Set(current);
      next.delete(follower.id);
      return next;
    });
    if (!result.data) {
      setUpdateError(true);
      return;
    }
    setFollowers((current) => current.filter((user) => user.id !== follower.id));
    setFollowerCount((count) => Math.max(0, count - 1));
  }, [feedService]);

  /** A blocked writer: the follows ended both ways on the server, so they leave both lists here too. */
  const forgetWriter = useCallback((writerId: number) => {
    setOverrides((current) => new Map(current).set(writerId, false));
    setFollowing((current) => current.filter((user) => user.id !== writerId));
    if (followers.some((user) => user.id === writerId)) {
      setFollowers((current) => current.filter((user) => user.id !== writerId));
      setFollowerCount((count) => Math.max(0, count - 1));
    }
  }, [followers]);

  const isTopicPending = useCallback((tag: string) => pendingTopics.has(tag.toLowerCase()), [pendingTopics]);

  return {
    following,
    topics,
    followers,
    followerCount,
    loaded,
    loadError,
    updateError,
    pendingIds,
    isFollowed,
    setFollow,
    isTopicFollowed,
    isTopicPending,
    setTopicFollow,
    removeFollower,
    forgetWriter,
  };
}
