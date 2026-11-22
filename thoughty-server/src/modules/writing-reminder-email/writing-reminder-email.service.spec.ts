import { NotFoundException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { WritingReminderEmailController } from './writing-reminder-email.controller';
import { WritingReminderEmailService } from './writing-reminder-email.service';

describe('WritingReminderEmailService', () => {
  let settingRepository: { findOne: jest.Mock; upsert: jest.Mock };
  let diaryRepository: { exists: jest.Mock };
  let service: WritingReminderEmailService;

  beforeEach(() => {
    // 18:00 UTC on 22 November 2026 is 19:00 in Paris.
    jest.useFakeTimers({ now: new Date('2026-11-22T18:00:00Z') });
    settingRepository = { findOne: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue(undefined) };
    diaryRepository = { exists: jest.fn().mockResolvedValue(true) };
    service = new WritingReminderEmailService(
      settingRepository as never,
      diaryRepository as never,
      { findOne: jest.fn().mockResolvedValue({ id: 3, email: 'writer@example.com', emailVerified: true }) } as never,
      { isConfigured: jest.fn().mockReturnValue(true) } as never,
    );
  });

  afterEach(() => jest.useRealTimers());

  it('is off at eight in the evening for all diaries until the writer saves it', async () => {
    await expect(service.get(3)).resolves.toEqual({
      enabled: false,
      deliveryHour: 20,
      timeZone: null,
      diaryId: null,
      nextSendAt: null,
      emailAvailable: true,
    });
  });

  it('schedules the next time the chosen local hour comes round: today if it is still ahead, else tomorrow', async () => {
    await service.update(3, { enabled: true, deliveryHour: 20, timeZone: 'Europe/Paris', diaryId: 4 });
    expect(settingRepository.upsert).toHaveBeenLastCalledWith(
      { userId: 3, enabled: true, deliveryHour: 20, timeZone: 'Europe/Paris', diaryId: 4, nextSendAt: new Date('2026-11-22T19:00:00Z') },
      ['userId'],
    );

    await service.update(3, { enabled: true, deliveryHour: 9, timeZone: 'Europe/Paris', diaryId: null });
    expect(settingRepository.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ deliveryHour: 9, diaryId: null, nextSendAt: new Date('2026-11-23T08:00:00Z') }),
      ['userId'],
    );
  });

  it('refuses another writer’s diary', async () => {
    diaryRepository.exists.mockResolvedValue(false);
    await expectApiError(service.update(3, { enabled: true, deliveryHour: 20, timeZone: 'UTC', diaryId: 99 }), NotFoundException, 'DIARY_NOT_FOUND');
    expect(settingRepository.upsert).not.toHaveBeenCalled();
  });
});

describe('WritingReminderEmailController', () => {
  it('reads and saves the signed-in writer’s setting', async () => {
    const settings = { enabled: true, deliveryHour: 20, timeZone: 'UTC', diaryId: null, nextSendAt: null, emailAvailable: true };
    const service = { get: jest.fn().mockResolvedValue(settings), update: jest.fn().mockResolvedValue(settings) };
    const controller = new WritingReminderEmailController(service as never);
    const user = { userId: 3 } as never;

    await expect(controller.get(user)).resolves.toBe(settings);
    expect(service.get).toHaveBeenCalledWith(3);

    const dto = { enabled: true, deliveryHour: 20, timeZone: 'UTC', diaryId: null };
    await expect(controller.update(user, dto)).resolves.toBe(settings);
    expect(service.update).toHaveBeenCalledWith(3, dto);
  });
});
