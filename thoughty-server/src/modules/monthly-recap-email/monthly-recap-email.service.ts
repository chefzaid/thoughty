import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Diary, MonthlyRecapEmail, User } from '@/database/entities';
import { EmailService } from '@/modules/auth/services/email.service';
import { OptInEmailSettingsService } from '@/modules/opt-in-email/opt-in-email-settings.service';
import { MONTHLY_RECAP_SCHEDULE } from './monthly-recap-schedule';

/** The writer's monthly recap email setting; its unsubscribe links go through `/api/email-unsubscribe`. */
@Injectable()
export class MonthlyRecapEmailService extends OptInEmailSettingsService {
  constructor(
    @InjectRepository(MonthlyRecapEmail)
    settingRepository: Repository<MonthlyRecapEmail>,
    @InjectRepository(Diary)
    diaryRepository: Repository<Diary>,
    @InjectRepository(User)
    userRepository: Repository<User>,
    emailService: EmailService,
  ) {
    super(settingRepository, diaryRepository, userRepository, emailService, MONTHLY_RECAP_SCHEDULE);
  }
}
