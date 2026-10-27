import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { apiError } from '@/common/errors';
import { Diary, OnThisDayEmail, User } from '@/database/entities';
import { getUnsubscribeSecret } from '@/modules/auth/auth-secrets';
import { EmailService } from '@/modules/auth/services/email.service';
import { OptInEmailSettingsService } from '@/modules/opt-in-email/opt-in-email-settings.service';
import { ON_THIS_DAY_SCHEDULE } from './on-this-day-schedule';
import { verifyUnsubscribeToken } from './on-this-day-unsubscribe-token';

/** The writer's "On this day" email setting, and turning it off from an email's unsubscribe link. */
@Injectable()
export class OnThisDayEmailService extends OptInEmailSettingsService {
  private readonly unsubscribeSecret: string;

  constructor(
    @InjectRepository(OnThisDayEmail)
    settingRepository: Repository<OnThisDayEmail>,
    @InjectRepository(Diary)
    diaryRepository: Repository<Diary>,
    @InjectRepository(User)
    userRepository: Repository<User>,
    emailService: EmailService,
    nestConfigService: NestConfigService,
  ) {
    super(settingRepository, diaryRepository, userRepository, emailService, ON_THIS_DAY_SCHEDULE);
    this.unsubscribeSecret = getUnsubscribeSecret(nestConfigService);
  }

  /**
   * Turns the email off for the writer the signed token names, without signing in. Repeating it, or
   * a token for an account that is gone, changes nothing; a token that was not signed here is refused.
   * The email's one-click header posts here; the unsubscribe page uses the shared `/api/email-unsubscribe`.
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
