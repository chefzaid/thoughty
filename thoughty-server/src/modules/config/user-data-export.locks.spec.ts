import { createAccountActivityMock } from '@/modules/auth/account-activity/account-activity.test-helpers';
import { ContentLockedException } from '@/common/content-lock';
import { asUnlocked } from '@/common/content-lock/content-lock.test-helpers';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { UserDataExportService } from './user-data-export.service';

/** Every repository the export reads, answering nothing. */
function emptyRepository() {
  return { find: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue(null), query: jest.fn().mockResolvedValue([]) };
}

describe('UserDataExportService with locked content', () => {
  const repositories = Array.from({ length: 26 }, emptyRepository);
  const entryRepository = repositories[3]!;
  const service = new (UserDataExportService as unknown as new (...args: unknown[]) => UserDataExportService)(
    ...repositories.slice(0, 19),
    { reveal: jest.fn(async (entries: unknown[]) => entries) },
    ...repositories.slice(19),
    createAccountActivityMock(),
    emptyRepository(),
    emptyRepository(),
  );

  beforeEach(() => entryRepository.query.mockResolvedValue([{ locked: true }]));

  it('needs the PIN unlock while something is locked, since the download holds it all', async () => {
    await expectApiError(service.downloadData(1), ContentLockedException, 'CONTENT_LOCKED');
    expect(entryRepository.query).toHaveBeenCalledWith(expect.stringContaining('is_locked OR diary_locked'), [1]);
    expect(entryRepository.find).not.toHaveBeenCalled();
  });

  it('downloads everything, locked diaries and entries included, once unlocked', async () => {
    await expect(asUnlocked(1, () => service.downloadData(1))).resolves.toHaveProperty('entries', []);
    expect(entryRepository.find).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 1 }, withDeleted: true }));
  });
});
