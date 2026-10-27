import { Module } from '@nestjs/common';
import { AuthModule } from '@/modules/auth';
import { UserConfigModule } from '@/modules/config';
import { TimeCapsuleDeliveryWorkerService } from './time-capsule-delivery-worker.service';
import { TimeCapsuleDeliveryService } from './time-capsule-delivery.service';
import { TimeCapsulesModule } from './time-capsules.module';

/** Opening the due time capsules and emailing them, run by the background worker. */
@Module({
  imports: [TimeCapsulesModule, AuthModule, UserConfigModule],
  providers: [TimeCapsuleDeliveryService, TimeCapsuleDeliveryWorkerService],
  exports: [TimeCapsuleDeliveryWorkerService],
})
export class TimeCapsuleEmailModule {}
