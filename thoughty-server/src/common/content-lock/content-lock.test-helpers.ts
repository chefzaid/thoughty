import { runWithContentAccess } from './content-access.context';

/** Runs `task` as a request carrying `userId`'s PIN unlock does. */
export function asUnlocked<T>(userId: number, task: () => T): T {
  return runWithContentAccess(
    { unlockedUserId: userId, unlockExpiresAt: new Date('2030-01-01T00:00:00Z'), unlockTokenHash: 'a'.repeat(64) },
    task,
  );
}

/** The `where` a `find` for a request without an unlock adds, to leave locked entries out. */
export const LOCKED_OUT_WHERE = { isLocked: false, diaryLocked: false } as const;

/** The condition a query builder for a request without an unlock adds. */
export const LOCKED_OUT_SQL = 'NOT (e.is_locked OR e.diary_locked)';
