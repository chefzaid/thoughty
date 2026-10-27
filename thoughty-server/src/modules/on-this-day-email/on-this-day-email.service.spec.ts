import { BadRequestException, NotFoundException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { OnThisDayEmailService } from './on-this-day-email.service';
import { createUnsubscribeToken } from './on-this-day-unsubscribe-token';

describe('OnThisDayEmailService', () => {
  const secret = 'u'.repeat(48);
  let settingRepository: { findOne: jest.Mock; upsert: jest.Mock; update: jest.Mock };
  let diaryRepository: { exists: jest.Mock };
  let userRepository: { findOne: jest.Mock };
  let emailService: { isConfigured: jest.Mock };
  let service: OnThisDayEmailService;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-27T05:00:00Z') });
    settingRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    diaryRepository = { exists: jest.fn().mockResolvedValue(true) };
    userRepository = { findOne: jest.fn().mockResolvedValue({ id: 3, email: 'writer@example.com', emailVerified: true }) };
    emailService = { isConfigured: jest.fn().mockReturnValue(true) };
    service = new OnThisDayEmailService(
      settingRepository as never,
      diaryRepository as never,
      userRepository as never,
      emailService as never,
      { get: jest.fn((key: string) => (key === 'UNSUBSCRIBE_SECRET' ? secret : undefined)) } as never,
    );
  });

  afterEach(() => jest.useRealTimers());

  it('is off at eight for all diaries until the writer saves it, with no zone yet', async () => {
    await expect(service.get(3)).resolves.toEqual({
      enabled: false,
      deliveryHour: 8,
      timeZone: null,
      diaryId: null,
      nextSendAt: null,
      emailAvailable: true,
    });
  });

  it('says email is unavailable without a verified address or a mail server', async () => {
    userRepository.findOne.mockResolvedValueOnce({ id: 3, email: 'writer@example.com', emailVerified: false });
    expect((await service.get(3)).emailAvailable).toBe(false);

    emailService.isConfigured.mockReturnValue(false);
    expect((await service.get(3)).emailAvailable).toBe(false);
  });

  it('shows the next send only while the email is on', async () => {
    const saved = { userId: 3, enabled: true, deliveryHour: 7, timeZone: 'Europe/Paris', diaryId: 4, nextSendAt: new Date('2026-10-27T06:00:00Z') };
    settingRepository.findOne.mockResolvedValueOnce(saved);
    expect(await service.get(3)).toEqual(expect.objectContaining({ enabled: true, deliveryHour: 7, timeZone: 'Europe/Paris', diaryId: 4, nextSendAt: '2026-10-27T06:00:00.000Z' }));

    settingRepository.findOne.mockResolvedValueOnce({ ...saved, enabled: false });
    expect((await service.get(3)).nextSendAt).toBeNull();
  });

  it('saves the setting and schedules the chosen local hour, today when it has not passed', async () => {
    await service.update(3, { enabled: true, deliveryHour: 7, timeZone: 'Europe/Paris', diaryId: 4 });

    expect(diaryRepository.exists).toHaveBeenCalledWith({ where: { id: 4, userId: 3 } });
    expect(settingRepository.upsert).toHaveBeenCalledWith(
      { userId: 3, enabled: true, deliveryHour: 7, timeZone: 'Europe/Paris', diaryId: 4, nextSendAt: new Date('2026-10-27T06:00:00Z') },
      ['userId'],
    );

    await service.update(3, { enabled: true, deliveryHour: 5, timeZone: 'UTC', diaryId: null });
    expect(settingRepository.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ diaryId: null, nextSendAt: new Date('2026-10-28T05:00:00Z') }),
      ['userId'],
    );
    expect(diaryRepository.exists).toHaveBeenCalledTimes(1);
  });

  it('refuses an unknown time zone and another writer’s diary', async () => {
    await expectApiError(
      service.update(3, { enabled: true, deliveryHour: 7, timeZone: 'Mars/Olympus', diaryId: null }),
      BadRequestException,
      'VALIDATION_FAILED',
    );
    diaryRepository.exists.mockResolvedValue(false);
    await expectApiError(
      service.update(3, { enabled: true, deliveryHour: 7, timeZone: 'UTC', diaryId: 99 }),
      NotFoundException,
      'DIARY_NOT_FOUND',
    );
    expect(settingRepository.upsert).not.toHaveBeenCalled();
  });

  it('turns the email off from a signed link and refuses any other token', async () => {
    await expect(service.unsubscribe(createUnsubscribeToken(3, secret))).resolves.toEqual({ success: true });
    expect(settingRepository.update).toHaveBeenCalledWith({ userId: 3, enabled: true }, { enabled: false });

    await expectApiError(service.unsubscribe(createUnsubscribeToken(3, 'other'.repeat(10))), BadRequestException, 'ON_THIS_DAY_UNSUBSCRIBE_INVALID');
    await expectApiError(service.unsubscribe('nonsense'), BadRequestException, 'ON_THIS_DAY_UNSUBSCRIBE_INVALID');
    expect(settingRepository.update).toHaveBeenCalledTimes(1);
  });
});
