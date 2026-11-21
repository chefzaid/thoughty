import { NotFoundException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import type { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import type { Entry } from '@/database/entities';

/**
 * Restricts an entry query to what the public feed may show: public, moderation-visible,
 * unarchived entries outside the recycle bin, by authors whose accounts are not deleted. The
 * query must alias the entries table as `e` and join the author as `u`.
 */
export function applyPublicFeedVisibility<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
): SelectQueryBuilder<T> {
  return qb
    .andWhere('e.visibility = :visibility', { visibility: 'public' })
    .andWhere('e.moderation_status = :moderationStatus', { moderationStatus: 'visible' })
    .andWhere('e.is_archived = false')
    .andWhere('e.deleted_at IS NULL')
    .andWhere('u.deleted_at IS NULL');
}

/**
 * The writer in `column` and the viewer (`:viewerId`) have not blocked one another, either way. A block
 * takes each writer out of everything social the other sees.
 */
export function notBlockedWith(column: string): string {
  return `NOT EXISTS (
    SELECT 1 FROM user_blocks ub
     WHERE (ub.blocker_id = :viewerId AND ub.blocked_id = ${column})
        OR (ub.blocked_id = :viewerId AND ub.blocker_id = ${column})
  )`;
}

/** The viewer (`:viewerId`) has not muted the writer in `column`. */
export function notMutedBy(column: string): string {
  return `NOT EXISTS (SELECT 1 FROM user_mutes um WHERE um.user_id = :viewerId AND um.muted_id = ${column})`;
}

/**
 * Leaves out what the viewer must not see from the writer in `column`: anyone they have blocked or who has
 * blocked them, and, with `muted`, the writers they muted.
 */
export function excludeHiddenWriters<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  column: string,
  viewerId: number,
  { muted = false }: { muted?: boolean } = {},
): SelectQueryBuilder<T> {
  qb.andWhere(notBlockedWith(column), { viewerId });
  if (muted) qb.andWhere(notMutedBy(column), { viewerId });
  return qb;
}

/**
 * Joins likes or comments on the queried entries (alias `e`) that come from other people
 * whose accounts are not deleted, as `x` (the interaction) and `xu` (its author). A comment
 * the entry's writer hid does not count.
 */
export function joinEngagementByOthers<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  table: 'entry_likes' | 'entry_comments',
): SelectQueryBuilder<T> {
  return qb
    .innerJoin(
      table,
      'x',
      table === 'entry_comments'
        ? 'x.entry_id = e.id AND x.user_id <> e.user_id AND x.hidden_at IS NULL'
        : 'x.entry_id = e.id AND x.user_id <> e.user_id',
    )
    .innerJoin('users', 'xu', 'xu.id = x.user_id AND xu.deleted_at IS NULL');
}

/**
 * Social interactions exist only around entries the feed may show the viewer; anything else, an entry
 * by a writer blocked either way included, answers as missing so private entries and blocks cannot be probed.
 */
export async function findFeedVisibleEntry(
  entryRepository: Repository<Entry>,
  entryId: number,
  viewerId: number,
): Promise<Pick<Entry, 'id' | 'userId' | 'commentPolicy'>> {
  const qb = applyPublicFeedVisibility(
    entryRepository
      .createQueryBuilder('e')
      .innerJoin('e.user', 'u')
      .select(['e.id', 'e.userId', 'e.commentPolicy'])
      .where('e.id = :entryId', { entryId }),
  );
  const entry = await excludeHiddenWriters(qb, 'e.user_id', viewerId).getOne();
  if (!entry) {
    throw apiError(NotFoundException, 'ENTRY_NOT_FOUND');
  }
  return entry;
}
