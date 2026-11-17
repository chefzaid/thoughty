import { AsyncLocalStorage } from 'node:async_hooks';

/** What the request in progress may read of locked diaries and entries. */
export interface ContentAccess {
  /** The writer whose PIN unlock the request carries, or null when it carries none that is valid. */
  readonly unlockedUserId: number | null;
  /** When that unlock ends unless another request extends it. */
  readonly unlockExpiresAt: Date | null;
  /** The SHA-256 of the unlock token the request carries, valid or not; ending the unlock deletes it. */
  readonly unlockTokenHash: string | null;
}

export const LOCKED_ACCESS: ContentAccess = { unlockedUserId: null, unlockExpiresAt: null, unlockTokenHash: null };

const storage = new AsyncLocalStorage<ContentAccess>();

/**
 * Runs `task` (a request, from the unlock middleware) with `access`; everything it awaits sees the same
 * access. Work that runs outside a request, such as a worker or a scheduled email, sees none: there,
 * locked content is always left out.
 */
export function runWithContentAccess<T>(access: ContentAccess, task: () => T): T {
  return storage.run(access, task);
}

/** Runs `task` as no unlock covers it, even when a request started it (a job it queued). */
export function runWithoutUnlock<T>(task: () => T): T {
  return storage.run(LOCKED_ACCESS, task);
}

/** The access of the request in progress; locked outside one. */
export function currentContentAccess(): ContentAccess {
  return storage.getStore() ?? LOCKED_ACCESS;
}

/** Whether the request in progress carries `userId`'s valid PIN unlock. */
export function isContentUnlocked(userId: number): boolean {
  return currentContentAccess().unlockedUserId === userId;
}
