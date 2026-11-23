import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Diary, User, YearReviewEmail } from '@/database/entities';
import { AuthModule } from '@/modules/auth';
import { UserConfigModule } from '@/modules/config';
import { ReviewModule } from '@/modules/review';
import { YearRecapService } from './year-recap.service';
import { YearReviewDeliveryWorkerService } from './year-review-delivery-worker.service';
import { YearReviewDeliveryService } from './year-review-delivery.service';
import { YearReviewEmailController } from './year-review-email.controller';
import { YearReviewEmailService } from './year-review-email.service';

@Module({
  imports: [TypeOrmModule.forFeature([YearReviewEmail, Diary, User]), AuthModule, ReviewModule, UserConfigModule],
  controllers: [YearReviewEmailController],
  providers: [YearReviewEmailService, YearRecapService, YearReviewDeliveryService, YearReviewDeliveryWorkerService],
  exports: [YearReviewDeliveryWorkerService],
})
export class YearReviewEmailModule {}
