import { UserDataExportService } from './user-data-export.service';

/** A repository with nothing in it, for the parts of the download these specs do not look at. */
const emptyRepository = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  query: jest.fn().mockResolvedValue([]),
});

/** Constructor order: 19 repositories, the time capsules service, share links, memoir snoozes, the draft, then saved entries. */
function build(savedEntryRepository: ReturnType<typeof emptyRepository>) {
  const timeCapsules = { reveal: jest.fn(async (rows: unknown[]) => rows) };
  const repositories = Array.from({ length: 19 }, emptyRepository);
  const Service = UserDataExportService as unknown as new (...dependencies: unknown[]) => UserDataExportService;
  return new Service(...repositories, timeCapsules, emptyRepository(), emptyRepository(), emptyRepository(), savedEntryRepository);
}

describe('UserDataExportService saved entries', () => {
  it('lists the entries the writer saved from the feed, oldest first', async () => {
    const repository = emptyRepository();
    repository.find.mockResolvedValue([
      { userId: 1, entryId: 41, createdAt: new Date('2024-03-04T08:00:00Z') },
      { userId: 1, entryId: 7, createdAt: new Date('2024-03-05T08:00:00Z') },
    ]);

    const data = await build(repository).downloadData(1);

    expect(data.savedEntries).toEqual([
      { entryId: 41, savedAt: new Date('2024-03-04T08:00:00Z') },
      { entryId: 7, savedAt: new Date('2024-03-05T08:00:00Z') },
    ]);
    expect(repository.find).toHaveBeenCalledWith({ where: { userId: 1 }, order: { createdAt: 'ASC' } });
  });
});
