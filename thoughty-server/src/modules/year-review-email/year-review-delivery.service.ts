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
import { type YearRecap, YearRecapService } from './year-recap.service';
import { buildYearReviewEmail } from './year-review-email-content';
import { YEAR_REVIEW_EMAIL_SCHEDULE, yearBefore } from './year-review-email-schedule';

/**
 * Sends the opt-in year in review emails that are due: on January 1 of the writer's year, about the year
 * just ended, at most once a year, only when that year has entries, only to the verified address of a
 * live account.
 */
@Injectable()
export class YearReviewDeliveryService extends OptInEmailDeliveryService<YearRecap> {
  protected readonly table = 'year_review_emails';
  protected readonly kind = 'year-review';
  protected readonly schedule = YEAR_REVIEW_EMAIL_SCHEDULE;
  protected readonly label = 'Year in review';
  protected readonly oneClickPath = '/api/email-unsubscribe';

  constructor(
    dataSource: DataSource,
    private readonly yearRecapService: YearRecapService,
    configService: ConfigService,
    emailService: EmailService,
    nestConfigService: NestConfigService,
  ) {
    super(dataSource, configService, emailService, nestConfigService);
  }

  protected collect({ userId, localDate, diaryId }: DueOptInEmail): Promise<YearRecap | null> {
    return this.yearRecapService.build(userId, yearBefore(localDate), diaryId);
  }

  protected render(recap: YearRecap, _due: DueOptInEmail, links: OptInEmailLinks): RenderedEmail {
    return buildYearReviewEmail({ ...links, recap });
  }
}
