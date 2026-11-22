import { Injectable } from '@nestjs/common';
import { OptInEmailWorkerService } from '@/modules/opt-in-email/opt-in-email-worker.service';
import { WritingReminderDeliveryService } from './writing-reminder-delivery.service';

/** Sends the due writing reminders every minute inside the background worker process, never in API replicas. */
@Injectable()
export class WritingReminderDeliveryWorkerService extends OptInEmailWorkerService {
  constructor(deliveryService: WritingReminderDeliveryService) {
    super(deliveryService, 'writing reminder');
  }
}
