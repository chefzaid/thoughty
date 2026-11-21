import { createAccountActivityMock } from '@/modules/auth/account-activity/account-activity.test-helpers';
import { UserDataExportService } from './user-data-export.service';

/** A repository with nothing in it, for the parts of the download these specs do not look at. */
const emptyRepository = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  query: jest.fn().mockResolvedValue([]),
});

/** Constructor order: 19 repositories, the time capsules service, share links, memoir snoozes, the draft, then saved entries. */
function build(composerDraftRepository: ReturnType<typeof emptyRepository>) {
  const timeCapsules = { reveal: jest.fn(async (rows: unknown[]) => rows) };
  const repositories = Array.from({ length: 19 }, emptyRepository);
  const Service = UserDataExportService as unknown as new (...dependencies: unknown[]) => UserDataExportService;
  return new Service(...repositories, timeCapsules, emptyRepository(), emptyRepository(), composerDraftRepository, emptyRepository(), emptyRepository(), emptyRepository(), emptyRepository(), createAccountActivityMock(), emptyRepository(), emptyRepository());
}

describe('UserDataExportService composer draft', () => {
  it('includes the draft still being written, with its revision', async () => {
    const createdAt = new Date('2026-11-14T08:00:00Z');
    const updatedAt = new Date('2026-11-15T09:30:00Z');
    const repository = emptyRepository();
    repository.findOne.mockResolvedValue({
      userId: 1, title: 'Evening walk', content: 'We walked along the river', tags: ['walks'], format: 'plain',
      mood: 4, feelings: ['calm'], revision: 3, createdAt, updatedAt,
    });

    const data = await build(repository).downloadData(1);

    expect(data.composerDraft).toEqual({
      title: 'Evening walk', content: 'We walked along the river', tags: ['walks'], format: 'plain',
      mood: 4, feelings: ['calm'], revision: 3, createdAt, updatedAt,
    });
    expect(repository.findOne).toHaveBeenCalledWith({ where: { userId: 1 } });
  });

  it('writes null when there is no draft', async () => {
    const data = await build(emptyRepository()).downloadData(1);

    expect(data.composerDraft).toBeNull();
  });
});
