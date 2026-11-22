import { BadRequestException, NotFoundException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { DiaryWritingReminderService } from './diary-writing-reminder.service';

describe('DiaryWritingReminderService', () => {
  let reminders: { find: jest.Mock; upsert: jest.Mock; delete: jest.Mock; update: jest.Mock };
  let account: { findOne: jest.Mock };
  let diaries: { exists: jest.Mock };
  let users: { findOne: jest.Mock };
  let emailService: { isConfigured: jest.Mock };
  let service: DiaryWritingReminderService;

  beforeEach(() => {
    // 18:00 UTC on 22 November 2026 is 19:00 in Paris.
    jest.useFakeTimers({ now: new Date('2026-11-22T18:00:00Z') });
    reminders = {
      find: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
    account = { findOne: jest.fn().mockResolvedValue(null) };
    diaries = { exists: jest.fn().mockResolvedValue(true) };
    users = { findOne: jest.fn().mockResolvedValue({ id: 3, email: 'writer@example.com', emailVerified: true }) };
    emailService = { isConfigured: jest.fn().mockReturnValue(true) };
    service = new DiaryWritingReminderService(reminders as never, account as never, diaries as never, users as never, emailService as never);
  });

  afterEach(() => jest.useRealTimers());

  it('lists the writer’s enabled diary reminders, and whether email can reach them', async () => {
    reminders.find.mockResolvedValue([
      { diaryId: 4, deliveryHour: 7, timeZone: 'Europe/Paris', nextSendAt: new Date('2026-11-23T06:00:00Z') },
    ]);

    await expect(service.list(3)).resolves.toEqual({
      reminders: [{ diaryId: 4, deliveryHour: 7, timeZone: 'Europe/Paris', nextSendAt: '2026-11-23T06:00:00.000Z' }],
      emailAvailable: true,
    });
    expect(reminders.find).toHaveBeenCalledWith({ where: { userId: 3, enabled: true }, order: { diaryId: 'ASC' } });

    users.findOne.mockResolvedValue({ id: 3, email: 'writer@example.com', emailVerified: false });
    expect((await service.list(3)).emailAvailable).toBe(false);
  });

  it('gives a diary its hour in the browser’s zone while the account reminder was never saved', async () => {
    await service.update(3, 4, { deliveryHour: 20, timeZone: 'Europe/Paris' });

    expect(diaries.exists).toHaveBeenCalledWith({ where: { id: 4, userId: 3 } });
    expect(reminders.upsert).toHaveBeenCalledWith(
      { diaryId: 4, userId: 3, enabled: true, deliveryHour: 20, timeZone: 'Europe/Paris', nextSendAt: new Date('2026-11-22T19:00:00Z') },
      ['diaryId'],
    );
  });

  it('keeps the account reminder’s zone over the browser’s, and schedules tomorrow once the hour has passed', async () => {
    account.findOne.mockResolvedValue({ userId: 3, timeZone: 'Asia/Tokyo' });

    await service.update(3, 4, { deliveryHour: 7, timeZone: 'Europe/Paris' });

    // 18:00 UTC is 03:00 on the 23rd in Tokyo, so 07:00 there is still ahead that day.
    expect(reminders.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ timeZone: 'Asia/Tokyo', nextSendAt: new Date('2026-11-22T22:00:00Z') }),
      ['diaryId'],
    );
  });

  it('removes the diary’s own hour with null', async () => {
    await service.update(3, 4, { deliveryHour: null, timeZone: 'UTC' });

    expect(reminders.delete).toHaveBeenCalledWith({ diaryId: 4, userId: 3 });
    expect(reminders.upsert).not.toHaveBeenCalled();
  });

  it('refuses another writer’s diary and an unknown zone', async () => {
    diaries.exists.mockResolvedValue(false);
    await expectApiError(service.update(3, 99, { deliveryHour: 7, timeZone: 'UTC' }), NotFoundException, 'DIARY_NOT_FOUND');
    await expectApiError(service.update(3, 4, { deliveryHour: 7, timeZone: 'Mars/Olympus' }), BadRequestException, 'VALIDATION_FAILED');
    expect(reminders.upsert).not.toHaveBeenCalled();
    expect(reminders.delete).not.toHaveBeenCalled();
  });

  it('moves the diary reminders in another zone to the account reminder’s new zone, each at its own hour', async () => {
    reminders.find.mockResolvedValue([
      { diaryId: 4, deliveryHour: 7, timeZone: 'Europe/Paris' },
      { diaryId: 5, deliveryHour: 21, timeZone: 'America/New_York' },
    ]);

    await service.followTimeZone(3, 'America/New_York');

    expect(reminders.find).toHaveBeenCalledWith({ where: { userId: 3 } });
    expect(reminders.update).toHaveBeenCalledTimes(1);
    // 18:00 UTC is 13:00 in New York, so 07:00 there comes round tomorrow.
    expect(reminders.update).toHaveBeenCalledWith(
      { diaryId: 4 },
      { timeZone: 'America/New_York', nextSendAt: new Date('2026-11-23T12:00:00Z') },
    );
  });
});
