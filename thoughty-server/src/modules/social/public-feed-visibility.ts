import { NotFoundException } from '@nestjs/common';
import type { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import type { Entry } from '@/database/entities';

/**
 * Restricts an entry query to what the public feed may show: public, moderation-visible,
 * unarchived entries by authors whose accounts are not deleted. The query must alias the
 * entries table as `e` and join the author as `u`.
 */
export function applyPublicFeedVisibility<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
): SelectQueryBuilder<T> {
  return qb
    .andWhere('e.visibility = :visibility', { visibility: 'public' })
    .andWhere('e.moderation_status = :moderationStatus', { moderationStatus: 'visible' })
    .andWhere('e.is_archived = false')
    .andWhere('u.deleted_at IS NULL');
}

/**
 * Joins likes or comments on the queried entries (alias `e`) that come from other people
 * whose accounts are not deleted, as `x` (the interaction) and `xu` (its author).
 */
export function joinEngagementByOthers<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  table: 'entry_likes' | 'entry_comments',
): SelectQueryBuilder<T> {
  return qb
    .innerJoin(table, 'x', 'x.entry_id = e.id AND x.user_id <> e.user_id')
    .innerJoin('users', 'xu', 'xu.id = x.user_id AND xu.deleted_at IS NULL');
}

/**
 * Social interactions exist only around entries the feed may show; anything else
 * answers as missing so private entries cannot be probed.
 */
export async function findFeedVisibleEntry(
  entryRepository: Repository<Entry>,
  entryId: number,
): Promise<Pick<Entry, 'id' | 'userId'>> {
  const entry = await applyPublicFeedVisibility(
    entryRepository
      .createQueryBuilder('e')
      .innerJoin('e.user', 'u')
      .select(['e.id', 'e.userId'])
      .where('e.id = :entryId', { entryId }),
  ).getOne();
  if (!entry) {
    throw new NotFoundException('Entry not found');
  }
  return entry;
}
