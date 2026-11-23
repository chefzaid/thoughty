import { createAccountActivityMock } from '@/modules/auth/account-activity/account-activity.test-helpers';
import { UserDataExportService } from './user-data-export.service';

/** A repository with nothing in it, for the parts of the download these specs do not look at. */
const emptyRepository = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  query: jest.fn().mockResolvedValue([]),
});

describe('UserDataExportService opt-in email settings', () => {
  const build = (
    onThisDayEmail: unknown,
    monthlyRecapEmail: unknown,
    writingReminderEmail: unknown,
    diaryRepository = emptyRepository(),
    yearReviewEmail: unknown = emptyRepository(),
  ) => {
    // Every repository before the two opt-in email ones, in constructor order; the diaries' is the third.
    const others = Array.from({ length: 16 }, emptyRepository);
    others[2] = diaryRepository;
    const Service = UserDataExportService as unknown as new (...repositories: unknown[]) => UserDataExportService;
    const timeCapsules = { reveal: async (entries: unknown[]) => entries };
    return new Service(...others, onThisDayEmail, monthlyRecapEmail, emptyRepository(), timeCapsules, emptyRepository(), emptyRepository(), emptyRepository(), emptyRepository(), emptyRepository(), emptyRepository(), emptyRepository(), createAccountActivityMock(), emptyRepository(), emptyRepository(), writingReminderEmail, emptyRepository(), emptyRepository(), yearReviewEmail);
  };

  it.each(['onThisDayEmail', 'monthlyRecapEmail', 'writingReminderEmail', 'yearReviewEmail'] as const)('includes the %s setting, and null when it was never saved', async (key) => {
    const repositories = {
      onThisDayEmail: emptyRepository(),
      monthlyRecapEmail: emptyRepository(),
      writingReminderEmail: emptyRepository(),
      yearReviewEmail: emptyRepository(),
    };
    const service = build(
      repositories.onThisDayEmail,
      repositories.monthlyRecapEmail,
      repositories.writingReminderEmail,
      emptyRepository(),
      repositories.yearReviewEmail,
    );
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

  it('includes each diary’s own writing reminder hour with the diary, and null for a diary without one', async () => {
    const createdAt = new Date('2026-11-01T10:00:00Z');
    const nextSendAt = new Date('2026-11-23T06:00:00Z');
    const diaries = emptyRepository();
    diaries.find.mockResolvedValue([
      { id: 4, name: 'Work', writingReminder: { diaryId: 4, userId: 1, enabled: true, deliveryHour: 7, timeZone: 'Europe/Paris', nextSendAt, lastSentOn: '2026-11-22', createdAt, updatedAt: createdAt } },
      { id: 5, name: 'Home', writingReminder: null },
    ]);
    const service = build(emptyRepository(), emptyRepository(), emptyRepository(), diaries);

    const exported = (await service.downloadData(1)).diaries as Array<{ id: number; writingReminder: unknown }>;

    expect(diaries.find).toHaveBeenCalledWith({ where: { userId: 1 }, order: { position: 'ASC' }, relations: { writingReminder: true } });
    expect(exported.map((diary) => [diary.id, diary.writingReminder])).toEqual([
      [4, { enabled: true, deliveryHour: 7, timeZone: 'Europe/Paris', nextSendAt, lastSentOn: '2026-11-22', createdAt, updatedAt: createdAt }],
      [5, null],
    ]);
  });
});
