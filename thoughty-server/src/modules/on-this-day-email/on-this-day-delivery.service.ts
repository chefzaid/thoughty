import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { EmailService, type RenderedEmail } from '@/modules/auth/services/email.service';
import { ConfigService } from '@/modules/config';
import { EntriesQueryService, type OnThisDayEntry } from '@/modules/entries';
import {
  type DueOptInEmail,
  OptInEmailDeliveryService,
  type OptInEmailLinks,
} from '@/modules/opt-in-email/opt-in-email-delivery.service';
import { buildOnThisDayEmail } from './on-this-day-email-content';
import { ON_THIS_DAY_SCHEDULE } from './on-this-day-schedule';

/**
 * Sends the opt-in "On this day" emails that are due: at most one per writer and local day, only on
 * days with entries from earlier years, only to the verified address of a live account.
 */
@Injectable()
export class OnThisDayDeliveryService extends OptInEmailDeliveryService<OnThisDayEntry[]> {
  protected readonly table = 'on_this_day_emails';
  protected readonly kind = 'on-this-day';
  protected readonly schedule = ON_THIS_DAY_SCHEDULE;
  protected readonly label = 'On this day';
  protected readonly oneClickPath = '/api/on-this-day-email/unsubscribe';

  constructor(
    dataSource: DataSource,
    private readonly entriesQueryService: EntriesQueryService,
    configService: ConfigService,
    emailService: EmailService,
    nestConfigService: NestConfigService,
  ) {
    super(dataSource, configService, emailService, nestConfigService);
  }

  /** The past years' entries for the writer's local day, none on a day without them. */
  protected async collect({ userId, localDate, diaryId }: DueOptInEmail): Promise<OnThisDayEntry[] | null> {
    const [year, month, day] = localDate.split('-').map(Number);
    const entries = await this.entriesQueryService.findOnThisDay(userId, { year, month, day, diaryId });
    return entries.length > 0 ? entries : null;
  }

  protected render(entries: OnThisDayEntry[], { localDate }: DueOptInEmail, links: OptInEmailLinks): RenderedEmail {
    return buildOnThisDayEmail({ ...links, localDate, entries });
  }
}
