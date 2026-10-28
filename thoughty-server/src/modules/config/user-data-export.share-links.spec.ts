import { UserDataExportService } from './user-data-export.service';

/** A repository with nothing in it, for the parts of the download these specs do not look at. */
const emptyRepository = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  query: jest.fn().mockResolvedValue([]),
});

describe('UserDataExportService share links', () => {
  it('lists the writer’s private share links without their tokens', async () => {
    const createdAt = new Date('2026-10-28T09:00:00Z');
    const expiresAt = new Date('2026-11-04T09:00:00Z');
    const shareLinkRepository = {
      ...emptyRepository(),
      find: jest.fn().mockResolvedValue([
        {
          id: 7, userId: 1, entryId: 12, bookVersionId: null, tokenHash: 'a'.repeat(64), label: 'For Mum',
          showMood: true, showTags: false, maxViews: 5, viewCount: 2, lastViewedAt: createdAt, expiresAt, createdAt,
        },
      ]),
    };
    const timeCapsules = { reveal: jest.fn(async (rows: unknown[]) => rows) };
    // Constructor order: 18 repositories, the time capsules repository and service, then the share links
    const repositories = Array.from({ length: 19 }, emptyRepository);
    const Service = UserDataExportService as unknown as new (...dependencies: unknown[]) => UserDataExportService;
    const service = new Service(...repositories, timeCapsules, shareLinkRepository);

    const data = await service.downloadData(1);

    expect(data.shareLinks).toEqual([{
      entryId: 12, bookVersionId: null, label: 'For Mum', showMood: true, showTags: false,
      maxViews: 5, viewCount: 2, lastViewedAt: createdAt, expiresAt, createdAt,
    }]);
    expect(JSON.stringify(data)).not.toContain('a'.repeat(64));
    expect(shareLinkRepository.find).toHaveBeenCalledWith({ where: { userId: 1 }, order: { createdAt: 'ASC', id: 'ASC' } });
  });
});
