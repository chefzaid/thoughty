import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { apiError } from '@/common/errors';
import { MonthlyRecapEmail, OnThisDayEmail, type OptInEmailSetting } from '@/database/entities';
import { getUnsubscribeSecret } from '@/modules/auth/auth-secrets';
import type { EmailUnsubscribeResultDto } from './dto';
import { verifyEmailUnsubscribeToken } from './email-unsubscribe-token';
import type { OptInEmailKind } from './opt-in-email-kind';

/** Turning off whichever opt-in email a signed unsubscribe link names, without signing in. */
@Injectable()
export class EmailUnsubscribeService {
  private readonly unsubscribeSecret: string;
  private readonly settings: Record<OptInEmailKind, Repository<OptInEmailSetting>>;

  constructor(
    @InjectRepository(OnThisDayEmail)
    onThisDayRepository: Repository<OnThisDayEmail>,
    @InjectRepository(MonthlyRecapEmail)
    monthlyRecapRepository: Repository<MonthlyRecapEmail>,
    nestConfigService: NestConfigService,
  ) {
    this.unsubscribeSecret = getUnsubscribeSecret(nestConfigService);
    this.settings = { 'on-this-day': onThisDayRepository, 'monthly-recap': monthlyRecapRepository };
  }

  /**
   * Turns the token's email off for its writer and says which email it was. Repeating it, or a token for
   * an account that is gone, changes nothing; a token that was not signed here is refused.
   */
  async unsubscribe(token: string): Promise<EmailUnsubscribeResultDto> {
    const verified = verifyEmailUnsubscribeToken(token, this.unsubscribeSecret);
    if (!verified) {
      throw apiError(BadRequestException, 'EMAIL_UNSUBSCRIBE_INVALID');
    }
    await this.settings[verified.kind].update({ userId: verified.userId, enabled: true }, { enabled: false });
    return { success: true, kind: verified.kind };
  }
}
