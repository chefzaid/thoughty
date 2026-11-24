import { useCallback, useEffect, useState } from 'react';

import type { FeedService, FollowedTopic, FollowedUser, FollowState, PublicFeedAuthor } from '../../services/api';

/** Where the reader stands with a writer: following them, waiting for their approval, or neither. */
export type FollowStatus = 'following' | 'requested' | 'none';

type Writer = Pick<PublicFeedAuthor, 'id' | 'username' | 'avatarUrl'>;

const byUsername = (left: FollowedUser, right: FollowedUser) => left.username.localeCompare(right.username);
const byTag = (left: FollowedTopic, right: FollowedTopic) => left.tag.localeCompare(right.tag);
/** A topic is its tag ignoring case, as the API matches it. */
const sameTopic = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
const without = (users: FollowedUser[], id: number) => users.filter((user) => user.id !== id);
const toFollowedUser = (writer: Writer): FollowedUser => ({
  id: writer.id,
  username: writer.username,
  avatarUrl: writer.avatarUrl ?? null,
  followedAt: new Date().toISOString(),
});
const statusOf = (state: Pick<FollowState, 'following' | 'requested'>): FollowStatus => {
  if (state.following) return 'following';
  return state.requested ? 'requested' : 'none';
};

/**
 * Tracks who and which topics the current user follows, the follow requests both ways and whether they approve
 * their followers. Follow changes made on this page override the follow state the feed returned, so every card by
 * the same author stays in sync.
 */
export function useFollows(feedService: FeedService) {
  const [following, setFollowing] = useState<FollowedUser[]>([]);
  const [requested, setRequested] = useState<FollowedUser[]>([]);
  const [topics, setTopics] = useState<FollowedTopic[]>([]);
  const [pendingTopics, setPendingTopics] = useState<ReadonlySet<string>>(new Set());
  const [followers, setFollowers] = useState<FollowedUser[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [requests, setRequests] = useState<FollowedUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [updateError, setUpdateError] = useState(false);
  const [overrides, setOverrides] = useState<ReadonlyMap<number, FollowStatus>>(new Map());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<number>>(new Set());

  useEffect(() => {
    let active = true;
    void feedService.fetchFollows().then((result) => {
      if (!active) return;
      if (result.data) {
        setFollowing([...result.data.following].sort(byUsername));
        setRequested([...(result.data.requested ?? [])].sort(byUsername));
        setTopics([...result.data.topics].sort(byTag));
        setFollowers([...result.data.followers].sort(byUsername));
        setFollowerCount(result.data.followerCount);
        setRequests([...(result.data.requests ?? [])].sort(byUsername));
      }
      setLoadError(!result.data);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [feedService]);

  /** Runs a change about one writer, their buttons disabled meanwhile; resolves to its answer, or null when it failed. */
  const track = useCallback(async <T,>(writerId: number, change: () => Promise<{ data: T | null }>): Promise<T | null> => {
    setPendingIds((current) => new Set(current).add(writerId));
    setUpdateError(false);
    const result = await change();
    setPendingIds((current) => {
      const next = new Set(current);
      next.delete(writerId);
      return next;
    });
    if (!result.data) setUpdateError(true);
    return result.data;
  }, []);

  const followStatus = useCallback(
    (author: PublicFeedAuthor): FollowStatus => overrides.get(author.id)
      ?? statusOf({ following: author.isFollowed, requested: author.followRequested }),
    [overrides],
  );

  /** Follows a writer (or asks to, when they approve their followers), or stops following or withdraws the request. */
  const setFollow = useCallback(async (author: Writer, follow: boolean) => {
    const state = await track(author.id, () => feedService.setFollowing(author.id, follow));
    if (!state) return;
    const status = statusOf(state);
    setOverrides((current) => new Map(current).set(author.id, status));
    setFollowing((current) => (status === 'following' ? [...without(current, author.id), toFollowedUser(author)].sort(byUsername) : without(current, author.id)));
    setRequested((current) => (status === 'requested' ? [...without(current, author.id), toFollowedUser(author)].sort(byUsername) : without(current, author.id)));
  }, [feedService, track]);

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
    if (!(await track(follower.id, () => feedService.removeFollower(follower.id)))) return;
    setFollowers((current) => without(current, follower.id));
    setFollowerCount((count) => Math.max(0, count - 1));
  }, [feedService, track]);

  /** Approves a request: the writer joins the followers and reads the reader's public entries. */
  const approveRequest = useCallback(async (writer: FollowedUser) => {
    if (!(await track(writer.id, () => feedService.approveFollower(writer.id)))) return;
    setRequests((current) => without(current, writer.id));
    setFollowers((current) => [...without(current, writer.id), writer].sort(byUsername));
    setFollowerCount((count) => count + 1);
  }, [feedService, track]);

  /** Declines a request; the writer is not told. */
  const declineRequest = useCallback(async (writer: FollowedUser) => {
    if (!(await track(writer.id, () => feedService.removeFollower(writer.id)))) return;
    setRequests((current) => without(current, writer.id));
  }, [feedService, track]);

  /** A blocked writer: the follows and requests ended both ways on the server, so they leave every list here too. */
  const forgetWriter = useCallback((writerId: number) => {
    setOverrides((current) => new Map(current).set(writerId, 'none'));
    setFollowing((current) => without(current, writerId));
    setRequested((current) => without(current, writerId));
    setRequests((current) => without(current, writerId));
    if (followers.some((user) => user.id === writerId)) {
      setFollowers((current) => without(current, writerId));
      setFollowerCount((count) => Math.max(0, count - 1));
    }
  }, [followers]);

  const isTopicPending = useCallback((tag: string) => pendingTopics.has(tag.toLowerCase()), [pendingTopics]);

  return {
    following,
    requested,
    topics,
    followers,
    followerCount,
    requests,
    loaded,
    loadError,
    updateError,
    pendingIds,
    followStatus,
    setFollow,
    isTopicFollowed,
    isTopicPending,
    setTopicFollow,
    removeFollower,
    approveRequest,
    declineRequest,
    forgetWriter,
  };
}
