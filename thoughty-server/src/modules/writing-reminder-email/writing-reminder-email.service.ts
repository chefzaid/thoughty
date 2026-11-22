import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Diary, User, WritingReminderEmail } from '@/database/entities';
import { EmailService } from '@/modules/auth/services/email.service';
import { OptInEmailSettingsService } from '@/modules/opt-in-email/opt-in-email-settings.service';
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
  ) {
    super(settingRepository, diaryRepository, userRepository, emailService, WRITING_REMINDER_SCHEDULE);
  }
}
