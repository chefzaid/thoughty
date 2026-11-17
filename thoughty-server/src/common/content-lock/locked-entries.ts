import type { WhereExpressionBuilder } from 'typeorm';
import { apiError } from '../errors/api-error';
import { isContentUnlocked } from './content-access.context';
import { ContentLockedException } from './content-lock.exceptions';

/** The SQL condition "this entry is locked", by its own flag or its diary's (`entries.diary_locked`). */
export function lockedEntrySql(alias = 'e'): string {
  return `(${alias}.is_locked OR ${alias}.diary_locked)`;
}

/** An entry's lock flags, as every entry query selects them. */
export interface EntryLockFlags {
  userId: number;
  isLocked?: boolean | null;
  diaryLocked?: boolean | null;
}

/** Whether the entry is locked, by its own flag or its diary's. */
export function isEntryLocked(entry: Pick<EntryLockFlags, 'isLocked' | 'diaryLocked'>): boolean {
  return Boolean(entry.isLocked || entry.diaryLocked);
}

/** Whether the entry's text, tags, mood, feelings and files must be held back from this request. */
export function isEntryWithheld(entry: EntryLockFlags): boolean {
  return isEntryLocked(entry) && !isContentUnlocked(entry.userId);
}

/** Refuses reading or changing a locked entry (`423 CONTENT_LOCKED`) unless the request is unlocked. */
export function assertEntryUnlocked(entry: EntryLockFlags): void {
  if (isEntryWithheld(entry)) {
    throw apiError(ContentLockedException, 'CONTENT_LOCKED');
  }
}

/**
 * Leaves `userId`'s locked entries (alias `alias`) out of the query unless the request is unlocked: for
 * search, aggregates, exports, AI and every view that would otherwise read their text.
 */
export function hideLockedEntries<T extends WhereExpressionBuilder>(qb: T, userId: number, alias = 'e'): T {
  if (!isContentUnlocked(userId)) {
    qb.andWhere(`NOT ${lockedEntrySql(alias)}`);
  }
  return qb;
}

/** The same for hand-written SQL: ` AND NOT (…)` to append to a WHERE clause, or nothing when unlocked. */
export function hideLockedEntriesSql(userId: number, alias = 'e'): string {
  return isContentUnlocked(userId) ? '' : ` AND NOT ${lockedEntrySql(alias)}`;
}

/** A WHERE condition to chain on a query builder: `NOT (locked)` unless the request is unlocked, else `TRUE`. */
export function readableEntrySql(userId: number, alias = 'e'): string {
  return isContentUnlocked(userId) ? 'TRUE' : `NOT ${lockedEntrySql(alias)}`;
}

/** Anything that runs SQL: a repository, an entity manager or the data source. */
interface SqlRunner {
  query(sql: string, parameters?: unknown[]): Promise<unknown>;
}

/** Whether any of the writer's diaries or entries (the recycle bin included) is locked. */
export async function holdsLockedContent(runner: SqlRunner, userId: number): Promise<boolean> {
  const rows = (await runner.query(
    `SELECT EXISTS (SELECT 1 FROM diaries WHERE user_id = $1 AND is_locked)
         OR EXISTS (SELECT 1 FROM entries WHERE user_id = $1 AND (is_locked OR diary_locked)) AS locked`,
    [userId],
  )) as Array<{ locked: boolean }>;
  return Boolean(rows[0]?.locked);
}

/** The same for TypeORM `find` options: spread into an entry `where` to leave locked entries out unless unlocked. */
export function readableEntryWhere(userId: number): { isLocked?: false; diaryLocked?: false } {
  return isContentUnlocked(userId) ? {} : { isLocked: false, diaryLocked: false };
}
