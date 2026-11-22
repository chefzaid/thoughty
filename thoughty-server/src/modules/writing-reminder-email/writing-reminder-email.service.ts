import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Diary, User, WritingReminderEmail } from '@/database/entities';
import { EmailService } from '@/modules/auth/services/email.service';
import type { OptInEmailSettingsDto, UpdateOptInEmailDto } from '@/modules/opt-in-email/dto';
import { OptInEmailSettingsService } from '@/modules/opt-in-email/opt-in-email-settings.service';
import { DiaryWritingReminderService } from './diary-writing-reminder.service';
import { WRITING_REMINDER_SCHEDULE } from './writing-reminder-schedule';

/** The writer's writing reminder email setting; its unsubscribe links go through `/api/email-unsubscribe`. */
@Injectable()
export class WritingReminderEmailService extends OptInEmailSettingsService {
  constructor(
    @InjectRepository(WritingReminderEmail)
    settingRepository: Repository<WritingReminderEmail>,
    @InjectRepository(Diary)
    diaryRepository: Repository<Diary>,
    @InjectRepository(User)
    userRepository: Repository<User>,
    emailService: EmailService,
    private readonly diaryReminders: DiaryWritingReminderService,
  ) {
    super(settingRepository, diaryRepository, userRepository, emailService, WRITING_REMINDER_SCHEDULE);
  }

  /** Saves the setting, and the diaries' own reminders follow its time zone. */
  override async update(userId: number, dto: UpdateOptInEmailDto): Promise<OptInEmailSettingsDto> {
    const saved = await super.update(userId, dto);
    await this.diaryReminders.followTimeZone(userId, dto.timeZone);
    return saved;
  }
}
