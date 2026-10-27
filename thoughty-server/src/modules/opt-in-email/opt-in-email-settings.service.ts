import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { apiError } from '@/common/errors';
import { isValidTimeZone } from '@/common/utils/time-zone.util';
import type { Diary, OptInEmailSetting, User } from '@/database/entities';
import type { EmailService } from '@/modules/auth/services/email.service';
import type { OptInEmailSettingsDto, UpdateOptInEmailDto } from './dto';
import type { OptInEmailSchedule } from './opt-in-email-schedule';

/** Reading and saving a writer's setting for one opt-in email; each email's service supplies its table and schedule. */
export abstract class OptInEmailSettingsService {
  protected constructor(
    protected readonly settingRepository: Repository<OptInEmailSetting>,
    private readonly diaryRepository: Repository<Diary>,
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService,
    private readonly schedule: OptInEmailSchedule,
  ) {}

  async get(userId: number): Promise<OptInEmailSettingsDto> {
    const [setting, user] = await Promise.all([
      this.settingRepository.findOne({ where: { userId } }),
      this.userRepository.findOne({ where: { id: userId }, select: { id: true, email: true, emailVerified: true } }),
    ]);

    return {
      enabled: setting?.enabled ?? false,
      deliveryHour: setting?.deliveryHour ?? this.schedule.defaultHour,
      timeZone: setting?.timeZone ?? null,
      diaryId: setting?.diaryId ?? null,
      nextSendAt: setting?.enabled ? setting.nextSendAt.toISOString() : null,
      emailAvailable: Boolean(user?.email && user.emailVerified && this.emailService.isConfigured()),
    };
  }

  /** Saves the whole setting; the next email is due the next time the schedule comes round at the chosen hour. */
  async update(userId: number, dto: UpdateOptInEmailDto): Promise<OptInEmailSettingsDto> {
    if (!isValidTimeZone(dto.timeZone)) {
      throw apiError(BadRequestException, 'VALIDATION_FAILED', 'Unknown time zone');
    }
    if (dto.diaryId !== null && !(await this.diaryRepository.exists({ where: { id: dto.diaryId, userId } }))) {
      throw apiError(NotFoundException, 'DIARY_NOT_FOUND');
    }

    await this.settingRepository.upsert(
      {
        userId,
        enabled: dto.enabled,
        deliveryHour: dto.deliveryHour,
        timeZone: dto.timeZone,
        diaryId: dto.diaryId,
        nextSendAt: this.schedule.next(new Date(), dto.deliveryHour, dto.timeZone),
      },
      ['userId'],
    );
    return this.get(userId);
  }
}
