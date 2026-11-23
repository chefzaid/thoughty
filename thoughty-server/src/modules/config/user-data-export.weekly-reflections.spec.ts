import { createAccountActivityMock } from '@/modules/auth/account-activity/account-activity.test-helpers';
import { UserDataExportService } from './user-data-export.service';

/** A repository with nothing in it, for the parts of the download this spec does not look at. */
const emptyRepository = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  query: jest.fn().mockResolvedValue([]),
});

/** Constructor order: 19 repositories, the time capsules service, seven more repositories, the account activity, the weekly reflections, then the access tokens. */
function build(weeklyReflectionRepository: ReturnType<typeof emptyRepository>) {
  const timeCapsules = { reveal: jest.fn(async (rows: unknown[]) => rows) };
  const Service = UserDataExportService as unknown as new (...dependencies: unknown[]) => UserDataExportService;
  return new Service(
    ...Array.from({ length: 19 }, emptyRepository),
    timeCapsules,
    ...Array.from({ length: 7 }, emptyRepository),
    createAccountActivityMock(),
    weeklyReflectionRepository,
    emptyRepository(),
    emptyRepository(),
    emptyRepository(),
    emptyRepository(),
    emptyRepository(),
  );
}

describe('UserDataExportService weekly reflections', () => {
  it('includes each saved weekly reflection, oldest week first, without its ids', async () => {
    const createdAt = new Date('2026-11-21T18:00:00Z');
    const repository = emptyRepository();
    repository.find.mockResolvedValue([
      {
        id: 5, userId: 1, diaryId: 3, weekStart: '2026-11-15', weekEnd: '2026-11-21', themes: ['garden'],
        summary: 'A green week.', question: 'What will grow next?', analyzedEntries: 4, createdAt,
      },
    ]);

    const data = await build(repository).downloadData(1);

    expect(data.weeklyReflections).toEqual([
      {
        diaryId: 3, weekStart: '2026-11-15', weekEnd: '2026-11-21', themes: ['garden'],
        summary: 'A green week.', question: 'What will grow next?', analyzedEntries: 4, generatedAt: createdAt,
      },
    ]);
    expect(repository.find).toHaveBeenCalledWith({ where: { userId: 1 }, order: { weekEnd: 'ASC', id: 'ASC' } });
  });
});
