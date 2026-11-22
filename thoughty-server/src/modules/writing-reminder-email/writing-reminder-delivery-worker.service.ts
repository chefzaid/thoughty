import { Injectable } from '@nestjs/common';
import { OptInEmailWorkerService } from '@/modules/opt-in-email/opt-in-email-worker.service';
import { DiaryWritingReminderDeliveryService } from './diary-writing-reminder-delivery.service';
import { WritingReminderDeliveryService } from './writing-reminder-delivery.service';

/**
 * Sends the due writing reminders, the account's then the diaries' own, every minute inside the
 * background worker process, never in API replicas.
 */
@Injectable()
export class WritingReminderDeliveryWorkerService extends OptInEmailWorkerService {
  constructor(accountReminders: WritingReminderDeliveryService, diaryReminders: DiaryWritingReminderDeliveryService) {
    super(
      { deliverDue: async () => (await accountReminders.deliverDue()) + (await diaryReminders.deliverDue()) },
      'writing reminder',
    );
  }
}
