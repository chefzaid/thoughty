import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import type { PublicFeedScope } from './dto';
import { readableBy } from './public-feed-visibility';

/** Whether the entry (alias `e`) carries a tag of the topics followed by `:userId`, ignoring case. */
const CARRIES_FOLLOWED_TOPIC = `EXISTS (
  SELECT 1 FROM topic_follows tf
   WHERE tf.user_id = :userId AND tf.tag IN (SELECT lower(et.tag) FROM unnest(e.tags) AS et(tag))
)`;

/**
 * Narrows a feed query on entries aliased `e` to one tab, and orders it: the reader's own entries
 * (`mine`), the entries by the writers whose follow is approved or carrying a topic they follow (`following`;
 * only from writers they may read, as a teaser has no tags to show why it is there), the
 * entries they saved (`saved`, the most recently saved first), or everyone else's (`community`).
 */
export function applyFeedScope<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  scope: PublicFeedScope,
  userId: number,
): void {
  if (scope === 'mine') {
    qb.andWhere('e.user_id = :userId', { userId });
  } else if (scope === 'following') {
    qb.andWhere(
      `(e.user_id IN (SELECT f.followed_id FROM user_follows f WHERE f.follower_id = :userId AND f.status = 'approved')
        OR (e.user_id <> :userId AND ${CARRIES_FOLLOWED_TOPIC} AND ${readableBy('e.user_id', 'userId')}))`,
      { userId },
    );
  } else {
    qb.andWhere('e.user_id != :userId', { userId });
  }
  if (scope === 'saved') {
    qb.innerJoin('saved_entries', 's', 's.entry_id = e.id AND s.user_id = :userId', { userId });
    qb.orderBy('s.created_at', 'DESC');
  } else {
    qb.orderBy('e.createdAt', 'DESC');
  }
}

/** Narrows a feed query on entries aliased `e` to those carrying the tag, ignoring case (a topic). */
export function applyFeedTopic<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, tag: string): void {
  qb.andWhere('lower(:topic) IN (SELECT lower(ft.tag) FROM unnest(e.tags) AS ft(tag))', { topic: tag });
}
