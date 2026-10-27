import { Injectable } from '@nestjs/common';
import { OptInEmailWorkerService } from '@/modules/opt-in-email/opt-in-email-worker.service';
import { OnThisDayDeliveryService } from './on-this-day-delivery.service';

/** Sends the due "On this day" emails every minute inside the background worker process, never in API replicas. */
@Injectable()
export class OnThisDayDeliveryWorkerService extends OptInEmailWorkerService {
  constructor(deliveryService: OnThisDayDeliveryService) {
    super(deliveryService, 'On this day');
  }
}
