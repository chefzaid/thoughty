import { Injectable } from '@nestjs/common';
import { OptInEmailWorkerService } from '@/modules/opt-in-email/opt-in-email-worker.service';
import { TimeCapsuleDeliveryService } from './time-capsule-delivery.service';

/** Opens the due time capsules and emails them every minute inside the background worker process, never in API replicas. */
@Injectable()
export class TimeCapsuleDeliveryWorkerService extends OptInEmailWorkerService {
  constructor(deliveryService: TimeCapsuleDeliveryService) {
    super(deliveryService, 'time capsule');
  }
}
