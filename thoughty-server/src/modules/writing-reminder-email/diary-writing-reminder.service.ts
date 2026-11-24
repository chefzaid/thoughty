import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { apiError } from '@/common/errors';
import { isValidTimeZone } from '@/common/utils/time-zone.util';
import { canReceiveEmail } from '@/common/utils/placeholder-email.util';
import { Diary, DiaryWritingReminder, User, WritingReminderEmail } from '@/database/entities';
import { EmailService } from '@/modules/auth/services/email.service';
import type { DiaryWritingRemindersDto, UpdateDiaryWritingReminderDto } from './dto';
import { WRITING_REMINDER_SCHEDULE } from './writing-reminder-schedule';

/**
 * The diaries' own writing reminder hours, set in Manage Diaries. Each overrides the Profile reminder for
 * its diary and keeps the account reminder's time zone, so one zone holds for every reminder.
 */
@Injectable()
export class DiaryWritingReminderService {
  constructor(
    @InjectRepository(DiaryWritingReminder)
    private readonly reminderRepository: Repository<DiaryWritingReminder>,
    @InjectRepository(WritingReminderEmail)
    private readonly accountReminderRepository: Repository<WritingReminderEmail>,
    @InjectRepository(Diary)
    private readonly diaryRepository: Repository<Diary>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService,
  ) {}

  /** The diaries with their own hour; a row turned off by the unsubscribe link counts as none. */
  async list(userId: number): Promise<DiaryWritingRemindersDto> {
    const [reminders, user] = await Promise.all([
      this.reminderRepository.find({ where: { userId, enabled: true }, order: { diaryId: 'ASC' } }),
      this.userRepository.findOne({ where: { id: userId }, select: { id: true, email: true, emailVerified: true } }),
    ]);
    return {
      reminders: reminders.map((reminder) => ({
        diaryId: reminder.diaryId,
        deliveryHour: reminder.deliveryHour,
        timeZone: reminder.timeZone,
        nextSendAt: reminder.nextSendAt.toISOString(),
      })),
      emailAvailable: canReceiveEmail(user?.email, user?.emailVerified) && this.emailService.isConfigured(),
    };
  }

  /**
   * Gives one of the writer's diaries its own hour (due the next time the clock comes round to it), or
   * removes it with null. A day already reminded is not reminded again after a change of hour.
   */
  async update(userId: number, diaryId: number, dto: UpdateDiaryWritingReminderDto): Promise<DiaryWritingRemindersDto> {
    if (!isValidTimeZone(dto.timeZone)) {
      throw apiError(BadRequestException, 'VALIDATION_FAILED', 'Unknown time zone');
    }
    if (!(await this.diaryRepository.exists({ where: { id: diaryId, userId } }))) {
      throw apiError(NotFoundException, 'DIARY_NOT_FOUND');
    }

    if (dto.deliveryHour === null) {
      await this.reminderRepository.delete({ diaryId, userId });
    } else {
      const account = await this.accountReminderRepository.findOne({ where: { userId }, select: { userId: true, timeZone: true } });
      const timeZone = account?.timeZone ?? dto.timeZone;
      await this.reminderRepository.upsert(
        {
          diaryId,
          userId,
          enabled: true,
          deliveryHour: dto.deliveryHour,
          timeZone,
          nextSendAt: WRITING_REMINDER_SCHEDULE.next(new Date(), dto.deliveryHour, timeZone),
        },
        ['diaryId'],
      );
    }
    return this.list(userId);
  }

  /** Moves the writer's diary reminders to the account reminder's new zone, each at its own hour. */
  async followTimeZone(userId: number, timeZone: string): Promise<void> {
    const moved = await this.reminderRepository.find({ where: { userId } });
    const now = new Date();
    for (const reminder of moved.filter((row) => row.timeZone !== timeZone)) {
      await this.reminderRepository.update(
        { diaryId: reminder.diaryId },
        { timeZone, nextSendAt: WRITING_REMINDER_SCHEDULE.next(now, reminder.deliveryHour, timeZone) },
      );
    }
  }
}
