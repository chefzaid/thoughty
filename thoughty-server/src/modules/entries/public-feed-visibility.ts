import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

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
