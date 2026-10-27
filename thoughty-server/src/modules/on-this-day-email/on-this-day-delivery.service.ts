import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { isValidTimeZone, localDateIn } from '@/common/utils/time-zone.util';
import { getUnsubscribeSecret } from '@/modules/auth/auth-secrets';
import { EmailService } from '@/modules/auth/services/email.service';
import { ConfigService } from '@/modules/config';
import { EntriesQueryService, type OnThisDayEntry } from '@/modules/entries';
import { buildOnThisDayEmail, resolveOnThisDayLanguage } from './on-this-day-email-content';
import { nextDailySend } from './on-this-day-schedule';
import { createUnsubscribeToken } from './on-this-day-unsubscribe-token';

const DELIVERY_BATCH_SIZE = 50;

interface DueRow {
  user_id: number;
  delivery_hour: number;
  time_zone: string;
  diary_id: number | null;
  last_sent_on: string | null;
  email: string | null;
  email_verified: boolean;
}

interface PendingEmail {
  userId: number;
  email: string;
  localDate: string;
  entries: OnThisDayEntry[];
}

/**
 * Sends the opt-in "On this day" emails that are due: at most one per writer and local day, only on
 * days with entries from earlier years, only to the verified address of a live account.
 */
@Injectable()
export class OnThisDayDeliveryService {
  private readonly logger = new Logger(OnThisDayDeliveryService.name);
  private readonly unsubscribeSecret: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly entriesQueryService: EntriesQueryService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly nestConfigService: NestConfigService,
  ) {
    this.unsubscribeSecret = getUnsubscribeSecret(nestConfigService);
  }

  /** Works through every due row in batches and answers how many emails went out. */
  async deliverDue(now = new Date()): Promise<number> {
    let sent = 0;
    for (;;) {
      const { claimed, emails } = await this.claimBatch(now);
      for (const email of emails) {
        if (await this.send(email)) sent++;
      }
      if (claimed < DELIVERY_BATCH_SIZE) {
        return sent;
      }
    }
  }

  /**
   * Moves a batch of due rows to their next local day and claims today's email for those who get one.
   * Rows are taken with SKIP LOCKED and `last_sent_on` is written in the same transaction, so overlapping
   * runs, or an hour changed after today's email, never send a day twice. Emails go out after the commit.
   */
  private claimBatch(now: Date): Promise<{ claimed: number; emails: PendingEmail[] }> {
    const canSend = this.emailService.isConfigured();
    return this.dataSource.transaction(async (manager) => {
      const due = (await manager.query(
        `
          SELECT s.user_id, s.delivery_hour, s.time_zone, s.diary_id,
                 TO_CHAR(s.last_sent_on, 'YYYY-MM-DD') AS last_sent_on, u.email, u.email_verified
          FROM on_this_day_emails s
          JOIN users u ON u.id = s.user_id
          WHERE s.enabled AND s.next_send_at <= $1 AND u.deleted_at IS NULL
          ORDER BY s.next_send_at
          LIMIT $2
          FOR UPDATE OF s SKIP LOCKED
        `,
        [now, DELIVERY_BATCH_SIZE],
      )) as DueRow[];

      const emails: PendingEmail[] = [];
      for (const row of due) {
        const timeZone = isValidTimeZone(row.time_zone) ? row.time_zone : 'UTC';
        const localDate = localDateIn(now, timeZone);
        const entries =
          canSend && row.email && row.email_verified && row.last_sent_on !== localDate
            ? await this.findPastEntries(row.user_id, localDate, row.diary_id)
            : [];
        const sending = entries.length > 0;

        await manager.query(
          `
            UPDATE on_this_day_emails
            SET next_send_at = $2, last_sent_on = CASE WHEN $3 THEN $4::date ELSE last_sent_on END
            WHERE user_id = $1
          `,
          [row.user_id, nextDailySend(now, row.delivery_hour, timeZone), sending, localDate],
        );
        if (sending) {
          emails.push({ userId: row.user_id, email: row.email!, localDate, entries });
        }
      }
      return { claimed: due.length, emails };
    });
  }

  private findPastEntries(userId: number, localDate: string, diaryId: number | null): Promise<OnThisDayEntry[]> {
    const [year, month, day] = localDate.split('-').map(Number);
    return this.entriesQueryService.findOnThisDay(userId, { year, month, day, diaryId });
  }

  /** Logs only the writer's ID: never the address or anything from the entries. */
  private async send({ userId, email, localDate, entries }: PendingEmail): Promise<boolean> {
    try {
      const language = resolveOnThisDayLanguage((await this.configService.getConfig(userId)).language);
      const frontendUrl = this.nestConfigService.get<string>('FRONTEND_URL', 'http://localhost:5173');
      const token = createUnsubscribeToken(userId, this.unsubscribeSecret);
      const unsubscribeUrl = new URL('/unsubscribe', frontendUrl);
      unsubscribeUrl.searchParams.set('token', token);
      const oneClickUrl = new URL('/api/on-this-day-email/unsubscribe', frontendUrl);
      oneClickUrl.searchParams.set('token', token);

      await this.emailService.sendRenderedEmail(
        email,
        buildOnThisDayEmail({
          language,
          localDate,
          entries,
          frontendUrl,
          unsubscribeUrl: unsubscribeUrl.toString(),
          oneClickUnsubscribeUrl: oneClickUrl.toString(),
        }),
      );
      return true;
    } catch (error) {
      // SMTP errors can quote the address, so only their name and reply code are logged
      const code = (error as { responseCode?: unknown }).responseCode;
      const reason = `${error instanceof Error ? error.name : 'unknown error'}${typeof code === 'number' ? ` ${code}` : ''}`;
      this.logger.warn(`On this day email for user ${userId} failed: ${reason}`);
      return false;
    }
  }
}
