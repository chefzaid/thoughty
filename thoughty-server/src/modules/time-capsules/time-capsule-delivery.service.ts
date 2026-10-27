import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { isValidTimeZone } from '@/common/utils/time-zone.util';
import { type Entry, TimeCapsule } from '@/database/entities';
import { EmailService } from '@/modules/auth/services/email.service';
import { ConfigService } from '@/modules/config';
import { resolveEmailLanguage } from '@/modules/opt-in-email/opt-in-email-layout';
import { buildTimeCapsuleEmail } from './time-capsule-email-content';
import { TimeCapsuleService } from './time-capsules.service';

const DELIVERY_BATCH_SIZE = 50;

interface DueRow {
  id: number;
  email: string | null;
  email_verified: boolean;
}

interface OpenedCapsule {
  capsule: TimeCapsule;
  entry: Entry;
  email: string;
}

/**
 * Opens the time capsules that are due and emails each one to its writer: only capsules whose entry is
 * outside the recycle bin, of live accounts, and the email only to a verified address when this server
 * can send email. A capsule in the recycle bin stays sealed and opens once it is restored.
 */
@Injectable()
export class TimeCapsuleDeliveryService {
  private readonly logger = new Logger(TimeCapsuleDeliveryService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly timeCapsuleService: TimeCapsuleService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly nestConfigService: NestConfigService,
  ) {}

  /** Opens every due capsule in batches and answers how many emails went out. */
  async deliverDue(now = new Date()): Promise<number> {
    let sent = 0;
    for (;;) {
      const { claimed, opened } = await this.openBatch(now);
      for (const capsule of opened) {
        if (await this.send(capsule)) sent++;
      }
      if (claimed < DELIVERY_BATCH_SIZE) {
        return sent;
      }
    }
  }

  /**
   * Opens a batch of due capsules in one transaction. Rows are taken with SKIP LOCKED and opened before the
   * commit, so overlapping runs never open or email a capsule twice. Emails go out after the commit.
   */
  private openBatch(now: Date): Promise<{ claimed: number; opened: OpenedCapsule[] }> {
    const canSend = this.emailService.isConfigured();
    return this.dataSource.transaction(async (manager) => {
      const due = (await manager.query(
        `
          SELECT tc.id, u.email, u.email_verified
          FROM time_capsules tc
          JOIN entries e ON e.id = tc.entry_id AND e.deleted_at IS NULL
          JOIN users u ON u.id = tc.user_id AND u.deleted_at IS NULL
          WHERE tc.opened_at IS NULL AND tc.open_at <= $1
          ORDER BY tc.open_at
          LIMIT $2
          FOR UPDATE OF tc SKIP LOCKED
        `,
        [now, DELIVERY_BATCH_SIZE],
      )) as DueRow[];

      const opened: OpenedCapsule[] = [];
      for (const row of due) {
        const capsule = await manager.getRepository(TimeCapsule).findOneByOrFail({ id: row.id });
        const entry = await this.timeCapsuleService.openCapsule(manager, capsule, now);
        if (canSend && row.email && row.email_verified) {
          opened.push({ capsule, entry, email: row.email });
        }
      }
      return { claimed: due.length, opened };
    });
  }

  /** Logs only the writer's ID: never the address or anything from the journal. */
  private async send({ capsule, entry, email }: OpenedCapsule): Promise<boolean> {
    try {
      const language = resolveEmailLanguage((await this.configService.getConfig(capsule.userId)).language);
      await this.emailService.sendRenderedEmail(
        email,
        buildTimeCapsuleEmail({
          language,
          entry,
          sealedAt: capsule.createdAt,
          timeZone: isValidTimeZone(capsule.timeZone) ? capsule.timeZone : 'UTC',
          frontendUrl: this.nestConfigService.get<string>('FRONTEND_URL', 'http://localhost:5173'),
        }),
      );
      return true;
    } catch (error) {
      // SMTP errors can quote the address, so only their name and reply code are logged
      const code = (error as { responseCode?: unknown }).responseCode;
      const reason = `${error instanceof Error ? error.name : 'unknown error'}${typeof code === 'number' ? ` ${code}` : ''}`;
      this.logger.warn(`Time capsule email for user ${capsule.userId} failed: ${reason}`);
      return false;
    }
  }
}
