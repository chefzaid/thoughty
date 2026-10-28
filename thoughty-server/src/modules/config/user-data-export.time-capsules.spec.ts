import { UserDataExportService } from './user-data-export.service';

/** A repository with nothing in it, for the parts of the download these specs do not look at. */
const emptyRepository = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  query: jest.fn().mockResolvedValue([]),
});

describe('UserDataExportService time capsules', () => {
  it('writes sealed entries as they were sealed, marked with when they open, and lists every capsule', async () => {
    const sealedUntil = new Date('2031-10-27T08:00:00Z');
    const sealedRow = { id: 12, userId: 1, date: '2026-10-27', index: 1, content: '', tags: [], sealedUntil };
    const entryRepository = { ...emptyRepository(), find: jest.fn().mockResolvedValue([sealedRow]) };
    const sealedAt = new Date('2026-10-27T09:00:00Z');
    const capsuleRepository = {
      ...emptyRepository(),
      find: jest.fn().mockResolvedValue([{
        id: 4, entryId: 12, userId: 1, opensOn: '2031-10-27', openHour: 9, timeZone: 'Europe/Paris',
        openAt: sealedUntil, openedAt: null, sealedContent: 'Not written twice', createdAt: sealedAt,
      }]),
    };
    const timeCapsules = { reveal: jest.fn(async (rows: object[]) => rows.map((row) => ({ ...row, content: 'Dear future me' }))) };
    // Constructor order: settings, user, diaries, entries, then 12 more repositories and the two opt-in emails
    const repositories = [emptyRepository(), emptyRepository(), emptyRepository(), entryRepository, ...Array.from({ length: 14 }, emptyRepository)];
    const Service = UserDataExportService as unknown as new (...dependencies: unknown[]) => UserDataExportService;
    const service = new Service(...repositories, capsuleRepository, timeCapsules, emptyRepository());

    const data = await service.downloadData(1);

    expect(timeCapsules.reveal).toHaveBeenCalledWith([sealedRow]);
    expect(data.entries).toEqual([expect.objectContaining({ id: 12, content: 'Dear future me', sealedUntil })]);
    expect(data.timeCapsules).toEqual([{
      entryId: 12, opensOn: '2031-10-27', openHour: 9, timeZone: 'Europe/Paris', openAt: sealedUntil, openedAt: null, sealedAt,
    }]);
    expect(capsuleRepository.find).toHaveBeenCalledWith({ where: { userId: 1 }, order: { createdAt: 'ASC', id: 'ASC' } });
  });
});
