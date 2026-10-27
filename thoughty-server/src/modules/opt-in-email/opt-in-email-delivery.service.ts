import { Logger } from '@nestjs/common';
import type { ConfigService as NestConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import { isValidTimeZone, localDateIn } from '@/common/utils/time-zone.util';
import { getUnsubscribeSecret } from '@/modules/auth/auth-secrets';
import type { EmailService, RenderedEmail } from '@/modules/auth/services/email.service';
import type { ConfigService } from '@/modules/config';
import { createEmailUnsubscribeToken } from './email-unsubscribe-token';
import type { OptInEmailKind } from './opt-in-email-kind';
import { type EmailLanguage, resolveEmailLanguage } from './opt-in-email-layout';
import type { OptInEmailSchedule } from './opt-in-email-schedule';

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

/** A writer whose email is due, on their clock. */
export interface DueOptInEmail {
  userId: number;
  diaryId: number | null;
  timeZone: string;
  /** The writer's local day (YYYY-MM-DD) the email goes out on. */
  localDate: string;
}

/** What an email needs to link back: the app, its unsubscribe page, and the one-click address mail apps post to. */
export interface OptInEmailLinks {
  language: EmailLanguage;
  frontendUrl: string;
  unsubscribeUrl: string;
  oneClickUnsubscribeUrl: string;
}

interface PendingEmail<TContent> {
  due: DueOptInEmail;
  email: string;
  content: TContent;
}

/**
 * Sends the opt-in emails of one kind that are due: at most one per writer and period of their calendar,
 * only when there is something to send, only to the verified address of a live account. Each email
 * supplies its table, schedule, content and rendering.
 */
export abstract class OptInEmailDeliveryService<TContent> {
  private readonly logger = new Logger(this.constructor.name);
  private readonly unsubscribeSecret: string;

  /** The setting table, one row per writer. */
  protected abstract readonly table: string;
  protected abstract readonly kind: OptInEmailKind;
  protected abstract readonly schedule: OptInEmailSchedule;
  /** How logs name the email. */
  protected abstract readonly label: string;
  /** The API path the email's one-click unsubscribe header posts to. */
  protected abstract readonly oneClickPath: string;

  protected constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly nestConfigService: NestConfigService,
  ) {
    this.unsubscribeSecret = getUnsubscribeSecret(nestConfigService);
  }

  /** What the email holds for this writer and day, or null when there is nothing to send. */
  protected abstract collect(due: DueOptInEmail): Promise<TContent | null>;

  protected abstract render(content: TContent, due: DueOptInEmail, links: OptInEmailLinks): RenderedEmail;

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
   * Moves a batch of due rows to their next time and claims the period's email for those who get one.
   * Rows are taken with SKIP LOCKED and `last_sent_on` is written in the same transaction, so overlapping
   * runs, or an hour changed after the period's email, never send a period twice. Emails go out after the commit.
   */
  private claimBatch(now: Date): Promise<{ claimed: number; emails: Array<PendingEmail<TContent>> }> {
    const canSend = this.emailService.isConfigured();
    return this.dataSource.transaction(async (manager) => {
      const due = (await manager.query(
        `
          SELECT s.user_id, s.delivery_hour, s.time_zone, s.diary_id,
                 TO_CHAR(s.last_sent_on, 'YYYY-MM-DD') AS last_sent_on, u.email, u.email_verified
          FROM ${this.table} s
          JOIN users u ON u.id = s.user_id
          WHERE s.enabled AND s.next_send_at <= $1 AND u.deleted_at IS NULL
          ORDER BY s.next_send_at
          LIMIT $2
          FOR UPDATE OF s SKIP LOCKED
        `,
        [now, DELIVERY_BATCH_SIZE],
      )) as DueRow[];

      const emails: Array<PendingEmail<TContent>> = [];
      for (const row of due) {
        const timeZone = isValidTimeZone(row.time_zone) ? row.time_zone : 'UTC';
        const localDate = localDateIn(now, timeZone);
        const dueEmail: DueOptInEmail = { userId: row.user_id, diaryId: row.diary_id, timeZone, localDate };
        const content =
          canSend && row.email && row.email_verified && !this.sentInPeriod(row.last_sent_on, localDate)
            ? await this.collect(dueEmail)
            : null;
        const sending = content !== null;

        await manager.query(
          `
            UPDATE ${this.table}
            SET next_send_at = $2, last_sent_on = CASE WHEN $3 THEN $4::date ELSE last_sent_on END
            WHERE user_id = $1
          `,
          [row.user_id, this.schedule.next(now, row.delivery_hour, timeZone), sending, localDate],
        );
        if (sending) {
          emails.push({ due: dueEmail, email: row.email!, content });
        }
      }
      return { claimed: due.length, emails };
    });
  }

  private sentInPeriod(lastSentOn: string | null, localDate: string): boolean {
    return lastSentOn !== null && this.schedule.period(lastSentOn) === this.schedule.period(localDate);
  }

  /** Logs only the writer's ID: never the address or anything from the journal. */
  private async send({ due, email, content }: PendingEmail<TContent>): Promise<boolean> {
    try {
      const language = resolveEmailLanguage((await this.configService.getConfig(due.userId)).language);
      const frontendUrl = this.nestConfigService.get<string>('FRONTEND_URL', 'http://localhost:5173');
      const token = createEmailUnsubscribeToken(this.kind, due.userId, this.unsubscribeSecret);
      const unsubscribeUrl = new URL('/unsubscribe', frontendUrl);
      unsubscribeUrl.searchParams.set('token', token);
      const oneClickUrl = new URL(this.oneClickPath, frontendUrl);
      oneClickUrl.searchParams.set('token', token);

      await this.emailService.sendRenderedEmail(
        email,
        this.render(content, due, {
          language,
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
      this.logger.warn(`${this.label} email for user ${due.userId} failed: ${reason}`);
      return false;
    }
  }
}
