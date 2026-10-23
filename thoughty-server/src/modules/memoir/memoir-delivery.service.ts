import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MemoirProgram } from '@/database/entities';
import { EmailService } from '@/modules/auth/services/email.service';
import { ConfigService } from '@/modules/config';
import { buildMemoirQuestionEmail } from './memoir-email';
import { nextUnansweredQuestion, resolveMemoirLanguage, type MemoirQuestion } from './memoir-questions';
import { isValidTimeZone, nextWeeklyDelivery } from './memoir-schedule';

const DELIVERY_BATCH_SIZE = 50;

interface DueProgramRow {
  id: number;
  user_id: number;
  current_question_id: string | null;
  delivery_weekday: number;
  time_zone: string;
  email_enabled: boolean;
  email: string | null;
  email_verified: boolean;
}

interface PendingEmail {
  userId: number;
  email: string;
  question: MemoirQuestion;
}

@Injectable()
export class MemoirDeliveryService {
  private readonly logger = new Logger(MemoirDeliveryService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(MemoirProgram)
    private readonly programRepository: Repository<MemoirProgram>,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly nestConfigService: NestConfigService,
  ) {}

  /**
   * Moves every due, active program to its next unanswered question and schedules the following
   * week. Rows are claimed with SKIP LOCKED, so overlapping runs never deliver the same week twice;
   * emails go out after the commit and a failed email does not undo the new question.
   */
  async deliverDueQuestions(now = new Date()): Promise<number> {
    const emails = await this.dataSource.transaction(async (manager) => {
      const due = await manager.query(
        `
          SELECT p.id, p.user_id, p.current_question_id, p.delivery_weekday, p.time_zone,
                 p.email_enabled, u.email, u.email_verified
          FROM memoir_programs p
          JOIN users u ON u.id = p.user_id
          WHERE p.status = 'active' AND p.next_delivery_at <= $1 AND u.deleted_at IS NULL
          ORDER BY p.next_delivery_at
          LIMIT $2
          FOR UPDATE OF p SKIP LOCKED
        `,
        [now, DELIVERY_BATCH_SIZE],
      ) as DueProgramRow[];

      const pending: PendingEmail[] = [];
      for (const row of due) {
        // An answer whose entry is in the recycle bin leaves its question open again
        const answered = await manager.query(
          `
            SELECT a.question_id FROM memoir_answers a
            JOIN entries e ON e.id = a.entry_id
            WHERE a.user_id = $1 AND e.deleted_at IS NULL
          `,
          [row.user_id],
        ) as Array<{ question_id: string }>;
        const next = nextUnansweredQuestion(row.current_question_id, new Set(answered.map((item) => item.question_id)));
        const timeZone = isValidTimeZone(row.time_zone) ? row.time_zone : 'UTC';

        await manager.query(
          `
            UPDATE memoir_programs
            SET current_question_id = $2, current_question_at = $3, next_delivery_at = $4, updated_at = $3
            WHERE id = $1
          `,
          [row.id, next?.id ?? null, now, nextWeeklyDelivery(now, row.delivery_weekday, timeZone)],
        );

        if (next && row.email_enabled && row.email_verified && row.email) {
          pending.push({ userId: row.user_id, email: row.email, question: next });
        }
      }
      return pending;
    });

    if (emails.length > 0 && this.emailService.isConfigured()) {
      for (const email of emails) {
        await this.sendQuestionEmail(email, now);
      }
    }
    return emails.length;
  }

  private async sendQuestionEmail({ userId, email, question }: PendingEmail, now: Date): Promise<void> {
    try {
      const language = resolveMemoirLanguage((await this.configService.getConfig(userId)).language);
      const frontendUrl = this.nestConfigService.get<string>('FRONTEND_URL', 'http://localhost:5173');
      await this.emailService.sendMemoirQuestionEmail(email, buildMemoirQuestionEmail(question, language, frontendUrl));
      await this.programRepository.update({ userId }, { lastEmailedAt: now });
    } catch (error) {
      this.logger.warn(`Weekly memoir email for user ${userId} failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
}
