import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DiaryWritingReminder } from '@/database/entities';
import { EmailService, type RenderedEmail } from '@/modules/auth/services/email.service';
import { ConfigService } from '@/modules/config';
import {
  type DueOptInEmail,
  OptInEmailDeliveryService,
  type OptInEmailLinks,
} from '@/modules/opt-in-email/opt-in-email-delivery.service';
import { StatsStreakService } from '@/modules/stats/stats-streak.service';
import { buildWritingReminderEmail, type WritingReminder } from './writing-reminder-email-content';
import { WRITING_REMINDER_SCHEDULE } from './writing-reminder-schedule';

/**
 * Sends the opt-in writing reminders that are due: at most one per writer and local day, only on a day
 * they have not written yet (no entry dated that day in the chosen diary, or in any diary), only to the
 * verified address of a live account. A chosen diary with its own hour (Manage Diaries) is reminded at
 * that hour instead, by `DiaryWritingReminderDeliveryService`.
 */
@Injectable()
export class WritingReminderDeliveryService extends OptInEmailDeliveryService<WritingReminder> {
  protected readonly table = 'writing_reminder_emails';
  protected readonly kind = 'writing-reminder';
  protected readonly schedule = WRITING_REMINDER_SCHEDULE;
  protected readonly label = 'Writing reminder';
  protected readonly oneClickPath = '/api/email-unsubscribe';

  constructor(
    dataSource: DataSource,
    private readonly streakService: StatsStreakService,
    configService: ConfigService,
    emailService: EmailService,
    nestConfigService: NestConfigService,
    @InjectRepository(DiaryWritingReminder)
    private readonly diaryReminderRepository: Repository<DiaryWritingReminder>,
  ) {
    super(dataSource, configService, emailService, nestConfigService);
  }

  /**
   * Nothing on a day already written, or when the chosen diary has its own hour; otherwise the streak
   * that writing today would carry on.
   */
  protected async collect({ userId, localDate, diaryId }: DueOptInEmail): Promise<WritingReminder | null> {
    if (diaryId !== null && (await this.diaryReminderRepository.exists({ where: { diaryId, enabled: true } }))) {
      return null;
    }
    const streak = await this.streakService.getStreak(userId, diaryId ?? undefined, localDate);
    return streak.writtenToday ? null : { diaryId, currentStreak: streak.currentStreak, source: 'account' };
  }

  protected render(reminder: WritingReminder, _due: DueOptInEmail, links: OptInEmailLinks): RenderedEmail {
    return buildWritingReminderEmail({ ...links, reminder });
  }
}
