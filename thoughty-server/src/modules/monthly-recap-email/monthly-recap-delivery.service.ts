import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { EmailService, type RenderedEmail } from '@/modules/auth/services/email.service';
import { ConfigService } from '@/modules/config';
import {
  type DueOptInEmail,
  OptInEmailDeliveryService,
  type OptInEmailLinks,
} from '@/modules/opt-in-email/opt-in-email-delivery.service';
import { buildMonthlyRecapEmail } from './monthly-recap-email-content';
import { MONTHLY_RECAP_SCHEDULE, monthBefore } from './monthly-recap-schedule';
import { type MonthlyRecap, MonthlyRecapService } from './monthly-recap.service';

/**
 * Sends the opt-in monthly recaps that are due: on the 1st of the writer's month, about the month just
 * ended, at most once a month, only when that month has entries or a memory from an earlier year, only
 * to the verified address of a live account.
 */
@Injectable()
export class MonthlyRecapDeliveryService extends OptInEmailDeliveryService<MonthlyRecap> {
  protected readonly table = 'monthly_recap_emails';
  protected readonly kind = 'monthly-recap';
  protected readonly schedule = MONTHLY_RECAP_SCHEDULE;
  protected readonly label = 'Monthly recap';
  protected readonly oneClickPath = '/api/email-unsubscribe';

  constructor(
    dataSource: DataSource,
    private readonly monthlyRecapService: MonthlyRecapService,
    configService: ConfigService,
    emailService: EmailService,
    nestConfigService: NestConfigService,
  ) {
    super(dataSource, configService, emailService, nestConfigService);
  }

  protected collect({ userId, localDate, diaryId }: DueOptInEmail): Promise<MonthlyRecap | null> {
    return this.monthlyRecapService.build(userId, monthBefore(localDate), diaryId);
  }

  protected render(recap: MonthlyRecap, _due: DueOptInEmail, links: OptInEmailLinks): RenderedEmail {
    return buildMonthlyRecapEmail({ ...links, recap });
  }
}
