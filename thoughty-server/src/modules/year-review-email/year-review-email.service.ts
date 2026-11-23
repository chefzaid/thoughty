import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Diary, User, YearReviewEmail } from '@/database/entities';
import { EmailService } from '@/modules/auth/services/email.service';
import { OptInEmailSettingsService } from '@/modules/opt-in-email/opt-in-email-settings.service';
import { YEAR_REVIEW_EMAIL_SCHEDULE } from './year-review-email-schedule';

/** The writer's year in review email setting; its unsubscribe links go through `/api/email-unsubscribe`. */
@Injectable()
export class YearReviewEmailService extends OptInEmailSettingsService {
  constructor(
    @InjectRepository(YearReviewEmail)
    settingRepository: Repository<YearReviewEmail>,
    @InjectRepository(Diary)
    diaryRepository: Repository<Diary>,
    @InjectRepository(User)
    userRepository: Repository<User>,
    emailService: EmailService,
  ) {
    super(settingRepository, diaryRepository, userRepository, emailService, YEAR_REVIEW_EMAIL_SCHEDULE);
  }
}
