import { HttpStatus } from '@nestjs/common';
import { expectApiError } from '../errors/api-error.test-helpers';
import { apiError } from '../errors/api-error';
import {
  LOCKED_ACCESS,
  currentContentAccess,
  isContentUnlocked,
  runWithContentAccess,
  runWithoutUnlock,
} from './content-access.context';
import { ContentLockedException, TooManyPinAttemptsException } from './content-lock.exceptions';
import {
  assertEntryUnlocked,
  hideLockedEntries,
  hideLockedEntriesSql,
  holdsLockedContent,
  isEntryLocked,
  isEntryWithheld,
  lockedEntrySql,
  readableEntrySql,
  readableEntryWhere,
} from './locked-entries';
import { asUnlocked } from './content-lock.test-helpers';

describe('content access', () => {
  it('is locked outside a request, and for any writer but the one whose unlock the request carries', async () => {
    expect(currentContentAccess()).toBe(LOCKED_ACCESS);
    expect(isContentUnlocked(3)).toBe(false);

    await asUnlocked(3, async () => {
      await Promise.resolve();
      expect(isContentUnlocked(3)).toBe(true);
      expect(isContentUnlocked(4)).toBe(false);
      // A job the request starts runs without the unlock
      expect(runWithoutUnlock(() => isContentUnlocked(3))).toBe(false);
    });
    expect(runWithContentAccess(LOCKED_ACCESS, () => isContentUnlocked(3))).toBe(false);
  });
});

describe('locked entries', () => {
  it('counts an entry locked by its own flag or its diary’s, and withholds it unless unlocked', () => {
    expect(isEntryLocked({ isLocked: false, diaryLocked: false })).toBe(false);
    expect(isEntryLocked({})).toBe(false);
    expect(isEntryLocked({ isLocked: true })).toBe(true);
    expect(isEntryLocked({ diaryLocked: true })).toBe(true);
    expect(isEntryWithheld({ userId: 3, isLocked: true })).toBe(true);
    expect(asUnlocked(3, () => isEntryWithheld({ userId: 3, isLocked: true }))).toBe(false);
    expect(isEntryWithheld({ userId: 3, isLocked: false })).toBe(false);
  });

  it('refuses a withheld entry with 423 CONTENT_LOCKED', async () => {
    await expectApiError(
      Promise.resolve().then(() => assertEntryUnlocked({ userId: 3, diaryLocked: true })),
      ContentLockedException,
      'CONTENT_LOCKED',
    );
    expect(() => asUnlocked(3, () => assertEntryUnlocked({ userId: 3, diaryLocked: true }))).not.toThrow();
    expect(apiError(ContentLockedException, 'CONTENT_LOCKED').getStatus()).toBe(HttpStatus.LOCKED);
    expect(apiError(TooManyPinAttemptsException, 'CONTENT_PIN_BLOCKED').getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });

  it('leaves locked entries out of queries, raw SQL and find options unless unlocked', () => {
    expect(lockedEntrySql()).toBe('(e.is_locked OR e.diary_locked)');
    expect(lockedEntrySql('entry')).toBe('(entry.is_locked OR entry.diary_locked)');
    expect(readableEntrySql(3)).toBe('NOT (e.is_locked OR e.diary_locked)');
    expect(asUnlocked(3, () => readableEntrySql(3))).toBe('TRUE');
    expect(hideLockedEntriesSql(3, 'x')).toBe(' AND NOT (x.is_locked OR x.diary_locked)');
    expect(asUnlocked(3, () => hideLockedEntriesSql(3))).toBe('');
    expect(readableEntryWhere(3)).toEqual({ isLocked: false, diaryLocked: false });
    expect(asUnlocked(3, () => readableEntryWhere(3))).toEqual({});

    const qb = { andWhere: jest.fn() };
    expect(hideLockedEntries(qb as never, 3)).toBe(qb);
    expect(qb.andWhere).toHaveBeenCalledWith('NOT (e.is_locked OR e.diary_locked)');
    asUnlocked(3, () => hideLockedEntries(qb as never, 3));
    expect(qb.andWhere).toHaveBeenCalledTimes(1);
  });

  it('tells whether any diary or entry of the writer is locked', async () => {
    const runner = { query: jest.fn().mockResolvedValueOnce([{ locked: true }]).mockResolvedValueOnce([]) };
    await expect(holdsLockedContent(runner, 3)).resolves.toBe(true);
    await expect(holdsLockedContent(runner, 3)).resolves.toBe(false);
    expect(runner.query).toHaveBeenCalledWith(expect.stringContaining('FROM diaries WHERE user_id = $1 AND is_locked'), [3]);
  });
});
