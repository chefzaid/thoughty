import { Injectable } from '@nestjs/common';
import { OptInEmailWorkerService } from '@/modules/opt-in-email/opt-in-email-worker.service';
import { YearReviewDeliveryService } from './year-review-delivery.service';

/** Sends the due year in review emails every minute inside the background worker process, never in API replicas. */
@Injectable()
export class YearReviewDeliveryWorkerService extends OptInEmailWorkerService {
  constructor(deliveryService: YearReviewDeliveryService) {
    super(deliveryService, 'year in review');
  }
}
