import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { apiError } from '@/common/errors';
import { isValidTimeZone } from '@/common/utils/time-zone.util';
import { Diary, OnThisDayEmail, User } from '@/database/entities';
import { getUnsubscribeSecret } from '@/modules/auth/auth-secrets';
import { EmailService } from '@/modules/auth/services/email.service';
import type { OnThisDayEmailSettingsDto, UpdateOnThisDayEmailDto } from './dto';
import { DEFAULT_ON_THIS_DAY_HOUR, nextDailySend } from './on-this-day-schedule';
import { verifyUnsubscribeToken } from './on-this-day-unsubscribe-token';

/** The writer's "On this day" email setting, and turning it off from an email's unsubscribe link. */
@Injectable()
export class OnThisDayEmailService {
  private readonly unsubscribeSecret: string;

  constructor(
    @InjectRepository(OnThisDayEmail)
    private readonly settingRepository: Repository<OnThisDayEmail>,
    @InjectRepository(Diary)
    private readonly diaryRepository: Repository<Diary>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService,
    nestConfigService: NestConfigService,
  ) {
    this.unsubscribeSecret = getUnsubscribeSecret(nestConfigService);
  }

  async get(userId: number): Promise<OnThisDayEmailSettingsDto> {
    const [setting, user] = await Promise.all([
      this.settingRepository.findOne({ where: { userId } }),
      this.userRepository.findOne({ where: { id: userId }, select: { id: true, email: true, emailVerified: true } }),
    ]);

    return {
      enabled: setting?.enabled ?? false,
      deliveryHour: setting?.deliveryHour ?? DEFAULT_ON_THIS_DAY_HOUR,
      timeZone: setting?.timeZone ?? null,
      diaryId: setting?.diaryId ?? null,
      nextSendAt: setting?.enabled ? setting.nextSendAt.toISOString() : null,
      emailAvailable: Boolean(user?.email && user.emailVerified && this.emailService.isConfigured()),
    };
  }

  /** Saves the whole setting; the next email is due at the chosen hour, today if it has not passed. */
  async update(userId: number, dto: UpdateOnThisDayEmailDto): Promise<OnThisDayEmailSettingsDto> {
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
        nextSendAt: nextDailySend(new Date(), dto.deliveryHour, dto.timeZone),
      },
      ['userId'],
    );
    return this.get(userId);
  }

  /**
   * Turns the email off for the writer the signed token names, without signing in. Repeating it, or
   * a token for an account that is gone, changes nothing; a token that was not signed here is refused.
   */
  async unsubscribe(token: string): Promise<{ success: true }> {
    const userId = verifyUnsubscribeToken(token, this.unsubscribeSecret);
    if (userId === null) {
      throw apiError(BadRequestException, 'ON_THIS_DAY_UNSUBSCRIBE_INVALID');
    }
    await this.settingRepository.update({ userId, enabled: true }, { enabled: false });
    return { success: true };
  }
}
