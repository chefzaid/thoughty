import { UserDataExportService } from './user-data-export.service';

/** A repository with nothing in it, for the parts of the download these specs do not look at. */
const emptyRepository = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  query: jest.fn().mockResolvedValue([]),
});

describe('UserDataExportService opt-in email settings', () => {
  const build = (onThisDayEmail: unknown, monthlyRecapEmail: unknown) => {
    // Every repository before the two opt-in email ones, in constructor order.
    const others = Array.from({ length: 16 }, emptyRepository);
    const Service = UserDataExportService as unknown as new (...repositories: unknown[]) => UserDataExportService;
    return new Service(...others, onThisDayEmail, monthlyRecapEmail);
  };

  it.each(['onThisDayEmail', 'monthlyRecapEmail'] as const)('includes the %s setting, and null when it was never saved', async (key) => {
    const repositories = { onThisDayEmail: emptyRepository(), monthlyRecapEmail: emptyRepository() };
    const service = build(repositories.onThisDayEmail, repositories.monthlyRecapEmail);
    expect((await service.downloadData(1))[key]).toBeNull();

    const createdAt = new Date('2026-10-01T10:00:00Z');
    const nextSendAt = new Date('2026-11-01T07:00:00Z');
    repositories[key].findOne.mockResolvedValue({
      userId: 1, enabled: true, deliveryHour: 8, timeZone: 'Europe/Paris', diaryId: 4, nextSendAt, lastSentOn: '2026-10-01', createdAt, updatedAt: createdAt,
    });

    expect((await service.downloadData(1))[key]).toEqual({
      enabled: true, deliveryHour: 8, timeZone: 'Europe/Paris', diaryId: 4, nextSendAt, lastSentOn: '2026-10-01', createdAt, updatedAt: createdAt,
    });
    expect(repositories[key].findOne).toHaveBeenCalledWith({ where: { userId: 1 } });
  });
});
