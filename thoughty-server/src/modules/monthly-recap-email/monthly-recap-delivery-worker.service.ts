import { Injectable } from '@nestjs/common';
import { OptInEmailWorkerService } from '@/modules/opt-in-email/opt-in-email-worker.service';
import { MonthlyRecapDeliveryService } from './monthly-recap-delivery.service';

/** Sends the due monthly recaps every minute inside the background worker process, never in API replicas. */
@Injectable()
export class MonthlyRecapDeliveryWorkerService extends OptInEmailWorkerService {
  constructor(deliveryService: MonthlyRecapDeliveryService) {
    super(deliveryService, 'monthly recap');
  }
}
