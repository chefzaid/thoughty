import { NotFoundException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { MonthlyRecapEmailService } from './monthly-recap-email.service';

describe('MonthlyRecapEmailService', () => {
  let settingRepository: { findOne: jest.Mock; upsert: jest.Mock };
  let diaryRepository: { exists: jest.Mock };
  let service: MonthlyRecapEmailService;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-27T05:00:00Z') });
    settingRepository = { findOne: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue(undefined) };
    diaryRepository = { exists: jest.fn().mockResolvedValue(true) };
    service = new MonthlyRecapEmailService(
      settingRepository as never,
      diaryRepository as never,
      { findOne: jest.fn().mockResolvedValue({ id: 3, email: 'writer@example.com', emailVerified: true }) } as never,
      { isConfigured: jest.fn().mockReturnValue(true) } as never,
    );
  });

  afterEach(() => jest.useRealTimers());

  it('is off at eight for all diaries until the writer saves it', async () => {
    await expect(service.get(3)).resolves.toEqual({
      enabled: false,
      deliveryHour: 8,
      timeZone: null,
      diaryId: null,
      nextSendAt: null,
      emailAvailable: true,
    });
  });

  it('schedules the 1st of next month at the chosen local hour', async () => {
    await service.update(3, { enabled: true, deliveryHour: 9, timeZone: 'Europe/Paris', diaryId: 4 });

    expect(settingRepository.upsert).toHaveBeenCalledWith(
      { userId: 3, enabled: true, deliveryHour: 9, timeZone: 'Europe/Paris', diaryId: 4, nextSendAt: new Date('2026-11-01T08:00:00Z') },
      ['userId'],
    );
  });

  it('refuses another writer’s diary', async () => {
    diaryRepository.exists.mockResolvedValue(false);
    await expectApiError(service.update(3, { enabled: true, deliveryHour: 8, timeZone: 'UTC', diaryId: 99 }), NotFoundException, 'DIARY_NOT_FOUND');
    expect(settingRepository.upsert).not.toHaveBeenCalled();
  });
});
